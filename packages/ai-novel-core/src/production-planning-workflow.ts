import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import { Annotation, END, START, StateGraph } from "@langchain/langgraph"

import type { AutonomousNovelState } from "./cli-types"
import { FactoryLangGraphCheckpointer } from "./factory-langgraph-checkpointer"
import { loadAutonomousState, saveAutonomousState } from "./orchestrator"
import {
  writeAllDetailedChapterBlueprints,
  writeProductionStoryBibleAssets,
  type NovelWorkspacePaths,
  type ProductionPipelineOptions,
} from "./writing-pipeline"
import {
  FactoryWorkflowTraceRecorder,
  WorkflowKernel,
  type WorkflowNodeMetadata,
  type WorkflowTraceReference,
} from "./workflow-kernel"

export type ProductionPlanningNodeId =
  | "production.story-foundation"
  | "production.chapter-blueprints"

export interface ProductionPlanningNodeContext {
  projectRoot: string
  factoryRootDir: string
  projectId: string
  state: AutonomousNovelState
  options?: ProductionPipelineOptions
  metadata?: Record<string, unknown>
}

export interface ProductionPlanningNodeInspection {
  currentNode: (WorkflowNodeMetadata & { id: ProductionPlanningNodeId }) | null
  missingFoundationArtifacts: string[]
  missingBlueprintChapters: number[]
}

const FOUNDATION_FILES = [
  "world-matrix.md",
  "story-bible.md",
  "plot-architecture.md",
  "character-dynamics.md",
  "foreshadowing-ledger.md",
  "story-foundation-contract.json",
  "writing-plan.json",
] as const

const planningNodes: Array<WorkflowNodeMetadata & { id: ProductionPlanningNodeId }> = [
  {
    id: "production.story-foundation",
    name: "生产规划：故事基础资产",
    stage: "master_planning",
    version: "planning-node-v1",
  },
  {
    id: "production.chapter-blueprints",
    name: "生产规划：逐章蓝图",
    stage: "master_planning",
    version: "planning-node-v1",
  },
]

const PlanningGraphState = Annotation.Root({
  context: Annotation<ProductionPlanningNodeContext>(),
  externalRunId: Annotation<string>(),
  resultState: Annotation<AutonomousNovelState | null>(),
  trace: Annotation<WorkflowTraceReference | null>(),
})

function nowIso() {
  return new Date().toISOString()
}

function workspacePaths(projectRoot: string): NovelWorkspacePaths {
  const workspaceDir = path.join(projectRoot, ".ai-novel")
  const plansDir = path.join(workspaceDir, "plans")
  const memoryDir = path.join(workspaceDir, "memory")
  const charactersDir = path.join(memoryDir, "characters")
  return {
    workspaceDir,
    plansDir,
    reportsDir: path.join(workspaceDir, "reports"),
    chaptersDir: path.join(workspaceDir, "chapters"),
    memoryDir,
    styleDir: path.join(workspaceDir, "style"),
    styleProfilePath: path.join(workspaceDir, "style", "profile.md"),
    styleRulebookPath: path.join(workspaceDir, "style", "rulebook.md"),
    styleReferencesPath: path.join(workspaceDir, "style", "references.md"),
    styleAntiPatternsPath: path.join(workspaceDir, "style", "anti-patterns.md"),
    consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
    characterDossiersPath: path.join(charactersDir, "dossiers.json"),
    characterDossiersMarkdownPath: path.join(charactersDir, "dossiers.md"),
    protagonistPath: path.join(charactersDir, "core", "protagonist.md"),
    relationsPath: path.join(charactersDir, "relations.md"),
    characterEvolutionPath: path.join(charactersDir, "evolution.md"),
    masterOutlinePath: path.join(plansDir, "master-outline.md"),
    chapterBlueprintsDir: path.join(plansDir, "chapter-blueprints"),
  }
}

async function readOptionalText(filePath: string) {
  return fs.readFile(filePath, "utf8").catch(() => "")
}

async function loadPlanningContext(paths: NovelWorkspacePaths) {
  return {
    consensus: await readOptionalText(paths.consensusPath),
    protagonist: await readOptionalText(paths.protagonistPath),
    style: await readOptionalText(paths.styleProfilePath),
  }
}

function stateEvidence(state: AutonomousNovelState) {
  return {
    stage: state.runtime.stage,
    lastAction: state.runtime.lastAction || null,
    statusMessage: state.runtime.statusMessage || null,
    pendingChapters: state.plan.chapterTasks.filter((task) => task.status === "pending").length,
  }
}

async function executeStoryFoundation(context: ProductionPlanningNodeContext) {
  if (context.state.runtime.stage !== "master_planning") {
    throw new Error(`production_planning_stage_mismatch:${context.state.runtime.stage}`)
  }
  const paths = workspacePaths(context.projectRoot)
  const planningContext = await loadPlanningContext(paths)
  await writeProductionStoryBibleAssets(
    context.projectRoot,
    paths,
    context.state,
    planningContext,
    { factoryRootDir: context.factoryRootDir, envRootDir: context.options?.envRootDir || context.projectRoot, ...context.options },
  )
  context.state.runtime.stage = "master_planning"
  context.state.runtime.lastRoute = "workflow"
  context.state.runtime.lastAction = "story_foundation_generated"
  context.state.runtime.statusMessage = "Story foundation assets generated. Chapter blueprints have not run yet."
  await saveAutonomousState(context.projectRoot, context.state)
  return context.state
}

async function executeChapterBlueprints(context: ProductionPlanningNodeContext) {
  if (context.state.runtime.stage !== "master_planning") {
    throw new Error(`production_planning_stage_mismatch:${context.state.runtime.stage}`)
  }
  const inspection = await inspectProductionPlanningNode(context.projectRoot, context.state)
  if (inspection.missingFoundationArtifacts.length > 0) {
    throw new Error(`production_story_foundation_required:${inspection.missingFoundationArtifacts.join(",")}`)
  }
  const paths = workspacePaths(context.projectRoot)
  const planningContext = await loadPlanningContext(paths)
  await writeAllDetailedChapterBlueprints(
    context.projectRoot,
    paths,
    context.state,
    planningContext,
    { factoryRootDir: context.factoryRootDir, envRootDir: context.options?.envRootDir || context.projectRoot, ...context.options },
  )
  context.state.runtime.stage = "chapter_task_generation"
  context.state.runtime.lastRoute = "workflow"
  context.state.runtime.lastAction = "chapter_blueprints_generated"
  context.state.runtime.statusMessage = "Detailed chapter blueprints generated. Waiting for production readiness."
  await saveAutonomousState(context.projectRoot, context.state)
  return context.state
}

const planningKernel = new WorkflowKernel<ProductionPlanningNodeContext>()
  .register({ ...planningNodes[0], execute: executeStoryFoundation })
  .register({ ...planningNodes[1], execute: executeChapterBlueprints })

export function listProductionPlanningNodes() {
  return planningNodes.map((node) => ({ ...node }))
}

export async function inspectProductionPlanningNode(
  projectRoot: string,
  suppliedState?: AutonomousNovelState,
): Promise<ProductionPlanningNodeInspection> {
  const state = suppliedState || await loadAutonomousState(projectRoot)
  if (state.runtime.stage !== "master_planning") {
    return { currentNode: null, missingFoundationArtifacts: [], missingBlueprintChapters: [] }
  }
  const paths = workspacePaths(projectRoot)
  const missingFoundationArtifacts: string[] = []
  for (const filename of FOUNDATION_FILES) {
    if (!(await readOptionalText(path.join(paths.plansDir, filename))).trim()) missingFoundationArtifacts.push(filename)
  }
  const missingBlueprintChapters: number[] = []
  for (const task of state.plan.chapterTasks) {
    const blueprintPath = path.join(paths.chapterBlueprintsDir, `chapter-${String(task.chapterNumber).padStart(3, "0")}.md`)
    if (!(await readOptionalText(blueprintPath)).trim()) missingBlueprintChapters.push(task.chapterNumber)
  }
  const currentNode = missingFoundationArtifacts.length > 0
    ? planningNodes[0]
    : missingBlueprintChapters.length > 0
      ? planningNodes[1]
      : null
  return { currentNode: currentNode ? { ...currentNode } : null, missingFoundationArtifacts, missingBlueprintChapters }
}

async function executeWithTrace(
  context: ProductionPlanningNodeContext,
  nodeId: ProductionPlanningNodeId,
  externalRunId: string,
) {
  const node = planningKernel.getNode(nodeId)
  const recorder = new FactoryWorkflowTraceRecorder(context.factoryRootDir)
  const inputEvidence = stateEvidence(context.state)
  const trace = await recorder.initialize({
    projectId: context.projectId,
    externalRunId,
    node,
    input: inputEvidence,
    executionMode: "manual",
    goal: `生产沙盒单点执行：${node.name}`,
    metadata: { isolatedProductionSandbox: true, fineGrainedPlanningNode: true, ...context.metadata },
  })
  await recorder.sync(trace, node, { status: "running", metadata: context.metadata })
  try {
    const state = await planningKernel.executeNode<AutonomousNovelState>(nodeId, context)
    await recorder.recordAttempt(trace, {
      kind: "generate",
      promptVersion: node.version,
      input: inputEvidence,
      output: stateEvidence(state),
      metadata: { nodeId, fineGrainedPlanningNode: true },
    })
    await recorder.sync(trace, node, {
      status: "completed",
      output: stateEvidence(state),
      validation: { valid: true, errors: [], warnings: [] },
      validationPromptVersion: "production-planning-transition-v1",
      attemptMetadata: { nodeId, resultingStage: state.runtime.stage },
    })
    return { state, trace }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recorder.sync(trace, node, {
      status: "failed",
      error: message,
      validation: { valid: false, errors: [message], warnings: [] },
      validationPromptVersion: "production-planning-transition-v1",
      attemptMetadata: { nodeId },
    })
    throw error
  }
}

export async function executeProductionPlanningNode(
  context: ProductionPlanningNodeContext,
  nodeId: ProductionPlanningNodeId,
  externalRunId = `production_planning_${Date.now()}_${randomUUID().slice(0, 8)}`,
) {
  const checkpointer = new FactoryLangGraphCheckpointer(
    context.factoryRootDir,
    context.projectId,
    `manual_${externalRunId}`,
  )
  const graphConfig = {
    configurable: { thread_id: `workflow:${context.projectId}:${externalRunId}`, checkpoint_ns: "" },
    durability: "sync" as const,
  }
  for await (const restored of checkpointer.list(graphConfig, { limit: 12 })) {
    const restoredState = restored.checkpoint.channel_values.resultState as AutonomousNovelState | null | undefined
    const restoredTrace = restored.checkpoint.channel_values.trace as WorkflowTraceReference | null | undefined
    if (restoredState && restoredTrace) return { state: restoredState, trace: restoredTrace }
  }
  const inspection = await inspectProductionPlanningNode(context.projectRoot, context.state)
  if (!inspection.currentNode) throw new Error("production_planning_node_not_available")
  if (inspection.currentNode.id !== nodeId) {
    throw new Error(`production_planning_node_not_current:requested=${nodeId}:current=${inspection.currentNode.id}`)
  }
  const graph = new StateGraph(PlanningGraphState)
    .addNode(nodeId, async (graphState) => {
      const result = await executeWithTrace(graphState.context, nodeId, graphState.externalRunId)
      return { resultState: result.state, trace: result.trace }
    })
    .addEdge(START, nodeId)
    .addEdge(nodeId, END)
    .compile({ checkpointer })
  const output = await graph.invoke({ context, externalRunId, resultState: null, trace: null }, graphConfig)
  if (!output.resultState || !output.trace) throw new Error("production_planning_langgraph_completed_without_result")
  return { state: output.resultState, trace: output.trace }
}
