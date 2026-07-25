import {
  FactoryWorkflowTraceRecorder,
  WorkflowKernel
} from "./chunk-ZWH2XUVC.js";
import {
  FactoryLangGraphCheckpointer
} from "./chunk-DETBSEC6.js";

// src/production-workflow.ts
import { randomUUID } from "crypto";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
var ProductionGraphState = Annotation.Root({
  context: Annotation(),
  externalRunId: Annotation(),
  resultState: Annotation(),
  trace: Annotation()
});
var productionNodeCatalog = [
  { id: "production.worldbuilding", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1A\u4E16\u754C\u6784\u5EFA", stage: "worldbuilding_dialogue", version: "compat-v1" },
  { id: "production.setting-review", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1A\u8BBE\u5B9A\u5BA1\u67E5", stage: "setting_review", version: "compat-v1" },
  { id: "production.master-planning", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1A\u5168\u4E66\u89C4\u5212", stage: "master_planning", version: "compat-v1" },
  { id: "production.chapter-task-generation", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1A\u7AE0\u8282\u4EFB\u52A1\u751F\u6210", stage: "chapter_task_generation", version: "compat-v1" },
  { id: "production.drafting", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1A\u7AE0\u8282\u5199\u4F5C", stage: "drafting", version: "compat-v1" },
  { id: "production.aigc-refinement", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1AAIGC \u7CBE\u4FEE", stage: "aigc_refinement", version: "compat-v1" },
  { id: "production.reviewing", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1A\u8D28\u91CF\u5BA1\u67E5", stage: "reviewing", version: "compat-v1" },
  { id: "production.replanning", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1A\u91CD\u89C4\u5212", stage: "replanning", version: "compat-v1" },
  { id: "production.complete", name: "\u751F\u4EA7\u6D41\u7A0B\uFF1A\u5B8C\u6210\u786E\u8BA4", stage: "complete", version: "compat-v1" }
];
function listProductionWorkflowNodes() {
  return productionNodeCatalog.map((node) => ({ ...node }));
}
function resolveProductionWorkflowNode(stage) {
  const node = productionNodeCatalog.find((candidate) => candidate.stage === stage);
  if (!node) throw new Error(`production_workflow_stage_not_registered:${stage}`);
  return node;
}
function createProductionWorkflowKernel(executeAdvance) {
  const kernel = new WorkflowKernel();
  for (const node of productionNodeCatalog) {
    kernel.register({ ...node, execute: executeAdvance });
  }
  return kernel;
}
function productionStateEvidence(state) {
  const chapterTasks = state.plan.chapterTasks || [];
  return {
    stage: state.runtime.stage,
    lastAction: state.runtime.lastAction || null,
    statusMessage: state.runtime.statusMessage || null,
    chapters: {
      total: chapterTasks.length,
      pending: chapterTasks.filter((task) => task.status === "pending").length,
      inProgress: chapterTasks.filter((task) => task.status === "in_progress").length,
      complete: chapterTasks.filter((task) => task.status === "complete").length,
      blocked: chapterTasks.filter((task) => task.status === "blocked").length
    }
  };
}
var ObservableProductionWorkflowRunner = class {
  kernel;
  recorder;
  constructor(factoryRootDir, executeAdvance) {
    this.kernel = createProductionWorkflowKernel(executeAdvance);
    this.recorder = new FactoryWorkflowTraceRecorder(factoryRootDir);
  }
  listNodes() {
    return this.kernel.listNodes();
  }
  async execute(context, externalRunId = randomUUID()) {
    const node = resolveProductionWorkflowNode(context.state.runtime.stage);
    const trace = await this.recorder.initialize({
      projectId: context.projectId,
      externalRunId,
      node,
      input: productionStateEvidence(context.state),
      executionMode: context.executionMode,
      parentRunId: context.parentTrace?.runId || null,
      parentStepId: context.parentTrace?.stepId || null,
      goal: `${context.executionMode === "manual" ? "\u624B\u52A8" : "\u81EA\u52A8"}\u63A8\u8FDB\uFF1A${node.name}`,
      metadata: {
        compatibilityBridge: true,
        projectRoot: context.rootDir,
        ...context.metadata
      }
    });
    await this.recorder.sync(trace, node, {
      status: "running",
      metadata: { compatibilityBridge: true, ...context.metadata }
    });
    try {
      const state = await this.kernel.executeNode(node.id, context);
      await this.recorder.recordAttempt(trace, {
        kind: "generate",
        promptVersion: node.version,
        input: productionStateEvidence(context.state),
        output: productionStateEvidence(state),
        metadata: { compatibilityBridge: true, nodeId: node.id }
      });
      await this.recorder.sync(trace, node, {
        status: "completed",
        output: productionStateEvidence(state),
        validation: { valid: true, errors: [], warnings: [] },
        validationPromptVersion: "production-transition-validator-v1",
        metadata: { compatibilityBridge: true, ...context.metadata },
        attemptMetadata: { nodeId: node.id, resultingStage: state.runtime.stage }
      });
      return { state, trace };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recorder.sync(trace, node, {
        status: "failed",
        error: message,
        validation: { valid: false, errors: [message], warnings: [] },
        validationPromptVersion: "production-transition-validator-v1",
        metadata: { compatibilityBridge: true, ...context.metadata },
        attemptMetadata: { nodeId: node.id }
      });
      throw error;
    }
  }
};
async function executeProductionAdvanceThroughKernel(context, executeAdvance) {
  const enabled = context.enabled ?? process.env.AI_NOVEL_WORKFLOW_KERNEL === "1";
  if (!enabled || !String(context.projectId || "").trim()) return { state: await executeAdvance(), trace: null };
  const externalRunId = context.externalRunId || randomUUID();
  const { enabled: _enabled, externalRunId: _externalRunId, ...workflowContext } = context;
  const runner = new ObservableProductionWorkflowRunner(context.factoryRootDir, async () => executeAdvance());
  const node = resolveProductionWorkflowNode(context.state.runtime.stage);
  const checkpointer = new FactoryLangGraphCheckpointer(
    context.factoryRootDir,
    context.projectId,
    `${context.executionMode}_${externalRunId}`
  );
  const graphConfig = {
    configurable: {
      thread_id: `workflow:${context.projectId}:${externalRunId}`,
      checkpoint_ns: ""
    },
    durability: "sync"
  };
  for await (const restored of checkpointer.list(graphConfig, { limit: 12 })) {
    const restoredState = restored.checkpoint.channel_values.resultState;
    const restoredTrace = restored.checkpoint.channel_values.trace;
    if (restoredState && restoredTrace) return { state: restoredState, trace: restoredTrace };
  }
  const graph = new StateGraph(ProductionGraphState).addNode(node.id, async (graphState) => {
    const result = await runner.execute(graphState.context, graphState.externalRunId);
    return { resultState: result.state, trace: result.trace };
  }).addEdge(START, node.id).addEdge(node.id, END).compile({ checkpointer });
  const output = await graph.invoke({
    context: workflowContext,
    externalRunId,
    resultState: null,
    trace: null
  }, graphConfig);
  if (!output.resultState || !output.trace) throw new Error("production_langgraph_completed_without_result");
  return { state: output.resultState, trace: output.trace };
}

export {
  listProductionWorkflowNodes,
  resolveProductionWorkflowNode,
  createProductionWorkflowKernel,
  ObservableProductionWorkflowRunner,
  executeProductionAdvanceThroughKernel
};
