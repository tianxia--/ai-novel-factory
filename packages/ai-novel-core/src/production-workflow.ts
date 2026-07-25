import { randomUUID } from "node:crypto"
import { Annotation, END, START, StateGraph } from "@langchain/langgraph"

import type { AutonomousNovelState, NovelStage } from "./cli-types"
import { FactoryLangGraphCheckpointer } from "./factory-langgraph-checkpointer"
import {
  FactoryWorkflowTraceRecorder,
  WorkflowKernel,
  type WorkflowExecutionMode,
  type WorkflowNodeMetadata,
  type WorkflowTraceReference,
} from "./workflow-kernel"

export interface ProductionWorkflowContext {
  rootDir: string
  factoryRootDir: string
  projectId: string
  state: AutonomousNovelState
  executionMode: Extract<WorkflowExecutionMode, "production" | "manual">
  parentTrace?: WorkflowTraceReference | null
  metadata?: Record<string, unknown>
}

export type ProductionAdvanceExecutor = (context: ProductionWorkflowContext) => Promise<AutonomousNovelState>

export interface ExecuteProductionAdvanceInput extends ProductionWorkflowContext {
  externalRunId?: string
  enabled?: boolean
}

const ProductionGraphState = Annotation.Root({
  context: Annotation<ProductionWorkflowContext>(),
  externalRunId: Annotation<string>(),
  resultState: Annotation<AutonomousNovelState | null>(),
  trace: Annotation<WorkflowTraceReference | null>(),
})

const productionNodeCatalog: Array<WorkflowNodeMetadata & { stage: NovelStage }> = [
  { id: "production.worldbuilding", name: "生产流程：世界构建", stage: "worldbuilding_dialogue", version: "compat-v1" },
  { id: "production.setting-review", name: "生产流程：设定审查", stage: "setting_review", version: "compat-v1" },
  { id: "production.master-planning", name: "生产流程：全书规划", stage: "master_planning", version: "compat-v1" },
  { id: "production.chapter-task-generation", name: "生产流程：章节任务生成", stage: "chapter_task_generation", version: "compat-v1" },
  { id: "production.drafting", name: "生产流程：章节写作", stage: "drafting", version: "compat-v1" },
  { id: "production.aigc-refinement", name: "生产流程：AIGC 精修", stage: "aigc_refinement", version: "compat-v1" },
  { id: "production.reviewing", name: "生产流程：质量审查", stage: "reviewing", version: "compat-v1" },
  { id: "production.replanning", name: "生产流程：重规划", stage: "replanning", version: "compat-v1" },
  { id: "production.complete", name: "生产流程：完成确认", stage: "complete", version: "compat-v1" },
]

export function listProductionWorkflowNodes() {
  return productionNodeCatalog.map((node) => ({ ...node }))
}

export function resolveProductionWorkflowNode(stage: NovelStage) {
  const node = productionNodeCatalog.find((candidate) => candidate.stage === stage)
  if (!node) throw new Error(`production_workflow_stage_not_registered:${stage}`)
  return node
}

export function createProductionWorkflowKernel(executeAdvance: ProductionAdvanceExecutor) {
  const kernel = new WorkflowKernel<ProductionWorkflowContext>()
  for (const node of productionNodeCatalog) {
    kernel.register({ ...node, execute: executeAdvance })
  }
  return kernel
}

function productionStateEvidence(state: AutonomousNovelState) {
  const chapterTasks = state.plan.chapterTasks || []
  return {
    stage: state.runtime.stage,
    lastAction: state.runtime.lastAction || null,
    statusMessage: state.runtime.statusMessage || null,
    chapters: {
      total: chapterTasks.length,
      pending: chapterTasks.filter((task) => task.status === "pending").length,
      inProgress: chapterTasks.filter((task) => task.status === "in_progress").length,
      complete: chapterTasks.filter((task) => task.status === "complete").length,
      blocked: chapterTasks.filter((task) => task.status === "blocked").length,
    },
  }
}

/**
 * Compatibility bridge for the existing production state machine.
 * Manual and automatic execution differ only by executionMode; both invoke the
 * same registered node and the same injected production advance function.
 */
export class ObservableProductionWorkflowRunner {
  private readonly kernel: WorkflowKernel<ProductionWorkflowContext>
  private readonly recorder: FactoryWorkflowTraceRecorder

  constructor(factoryRootDir: string, executeAdvance: ProductionAdvanceExecutor) {
    this.kernel = createProductionWorkflowKernel(executeAdvance)
    this.recorder = new FactoryWorkflowTraceRecorder(factoryRootDir)
  }

  listNodes() {
    return this.kernel.listNodes()
  }

  async execute(context: ProductionWorkflowContext, externalRunId: string = randomUUID()) {
    const node = resolveProductionWorkflowNode(context.state.runtime.stage)
    const trace = await this.recorder.initialize({
      projectId: context.projectId,
      externalRunId,
      node,
      input: productionStateEvidence(context.state),
      executionMode: context.executionMode,
      parentRunId: context.parentTrace?.runId || null,
      parentStepId: context.parentTrace?.stepId || null,
      goal: `${context.executionMode === "manual" ? "手动" : "自动"}推进：${node.name}`,
      metadata: {
        compatibilityBridge: true,
        projectRoot: context.rootDir,
        ...context.metadata,
      },
    })
    await this.recorder.sync(trace, node, {
      status: "running",
      metadata: { compatibilityBridge: true, ...context.metadata },
    })
    try {
      const state = await this.kernel.executeNode<AutonomousNovelState>(node.id, context)
      await this.recorder.recordAttempt(trace, {
        kind: "generate",
        promptVersion: node.version,
        input: productionStateEvidence(context.state),
        output: productionStateEvidence(state),
        metadata: { compatibilityBridge: true, nodeId: node.id },
      })
      await this.recorder.sync(trace, node, {
        status: "completed",
        output: productionStateEvidence(state),
        validation: { valid: true, errors: [], warnings: [] },
        validationPromptVersion: "production-transition-validator-v1",
        metadata: { compatibilityBridge: true, ...context.metadata },
        attemptMetadata: { nodeId: node.id, resultingStage: state.runtime.stage },
      })
      return { state, trace }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.recorder.sync(trace, node, {
        status: "failed",
        error: message,
        validation: { valid: false, errors: [message], warnings: [] },
        validationPromptVersion: "production-transition-validator-v1",
        metadata: { compatibilityBridge: true, ...context.metadata },
        attemptMetadata: { nodeId: node.id },
      })
      throw error
    }
  }
}

/**
 * Rollout seam used by both manual and automatic callers. With the feature flag
 * disabled it is behaviorally identical to the legacy direct call; when enabled
 * the very same callback is executed through the observable kernel.
 */
export async function executeProductionAdvanceThroughKernel(
  context: ExecuteProductionAdvanceInput,
  executeAdvance: () => Promise<AutonomousNovelState>,
) {
  const enabled = context.enabled ?? process.env.AI_NOVEL_WORKFLOW_KERNEL === "1"
  if (!enabled || !String(context.projectId || "").trim()) return { state: await executeAdvance(), trace: null }
  const externalRunId = context.externalRunId || randomUUID()
  const { enabled: _enabled, externalRunId: _externalRunId, ...workflowContext } = context
  const runner = new ObservableProductionWorkflowRunner(context.factoryRootDir, async () => executeAdvance())
  const node = resolveProductionWorkflowNode(context.state.runtime.stage)
  const checkpointer = new FactoryLangGraphCheckpointer(
    context.factoryRootDir,
    context.projectId,
    `${context.executionMode}_${externalRunId}`,
  )
  const graphConfig = {
    configurable: {
      thread_id: `workflow:${context.projectId}:${externalRunId}`,
      checkpoint_ns: "",
    },
    durability: "sync" as const,
  }
  for await (const restored of checkpointer.list(graphConfig, { limit: 12 })) {
    const restoredState = restored.checkpoint.channel_values.resultState as AutonomousNovelState | null | undefined
    const restoredTrace = restored.checkpoint.channel_values.trace as WorkflowTraceReference | null | undefined
    if (restoredState && restoredTrace) return { state: restoredState, trace: restoredTrace }
  }
  const graph = new StateGraph(ProductionGraphState)
    .addNode(node.id, async (graphState) => {
      const result = await runner.execute(graphState.context, graphState.externalRunId)
      return { resultState: result.state, trace: result.trace }
    })
    .addEdge(START, node.id)
    .addEdge(node.id, END)
    .compile({ checkpointer })
  const output = await graph.invoke({
    context: workflowContext,
    externalRunId,
    resultState: null,
    trace: null,
  }, graphConfig)
  if (!output.resultState || !output.trace) throw new Error("production_langgraph_completed_without_result")
  return { state: output.resultState, trace: output.trace }
}
