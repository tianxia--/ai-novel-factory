import {
  withFactoryDb
} from "./chunk-CJRUVXRQ.js";

// src/workflow-kernel.ts
var WorkflowKernel = class {
  nodes = /* @__PURE__ */ new Map();
  register(definition) {
    if (this.nodes.has(definition.id)) throw new Error(`workflow_node_already_registered:${definition.id}`);
    this.nodes.set(definition.id, definition);
    return this;
  }
  getNode(nodeId) {
    const definition = this.nodes.get(nodeId);
    if (!definition) throw new Error(`workflow_node_not_registered:${nodeId}`);
    return definition;
  }
  listNodes() {
    return Array.from(this.nodes.values()).map(({ execute: _execute, ...metadata }) => metadata);
  }
  async executeNode(nodeId, context) {
    const definition = this.getNode(nodeId);
    return definition.execute(context);
  }
};
function persistedWorkflowStatus(status) {
  if (status === "completed") return { run: "completed", step: "completed" };
  if (status === "invalid") return { run: "blocked", step: "failed" };
  if (status === "failed") return { run: "failed", step: "failed" };
  if (status === "running") return { run: "running", step: "in_progress" };
  return { run: "idle", step: "pending" };
}
function validationErrorText(value) {
  if (value.error) return value.error;
  if (value.status !== "invalid") return null;
  return (value.validation?.errors || []).map((entry) => String(entry)).join(" | ") || "workflow_validation_failed";
}
var FactoryWorkflowTraceRecorder = class {
  constructor(rootDir) {
    this.rootDir = rootDir;
  }
  rootDir;
  async initialize(input) {
    const runId = input.runId || `${input.executionMode}_${input.externalRunId}`;
    const stepId = input.stepId || `step_${input.externalRunId}`;
    const existing = await withFactoryDb(this.rootDir, async (db) => {
      const existingRun = db.getWorkflowRun(runId);
      const existingStep = db.listWorkflowSteps(runId).find((step) => step.id === stepId);
      if (existingRun && existingStep) {
        return {
          run: existingRun,
          attempts: db.listWorkflowStepAttempts(stepId)
        };
      }
      const project = db.getProject(input.projectId);
      if (!project) throw new Error("factory_project_not_found");
      if (!existingRun) {
        db.createRun({
          id: runId,
          projectId: input.projectId,
          projectRoot: project.projectRoot,
          parentRunId: input.parentRunId || null,
          kind: "workflow_advance",
          status: "idle",
          goal: input.goal || `${input.executionMode} \u5355\u70B9\u6267\u884C\uFF1A${input.node.name}`,
          stage: input.node.stage
        });
      }
      if (!existingStep) {
        db.createWorkflowStep({
          id: stepId,
          runId,
          projectId: input.projectId,
          name: input.node.name,
          nodeId: input.node.id,
          nodeVersion: input.node.version,
          stage: input.node.stage,
          status: "pending",
          executionMode: input.executionMode,
          validationStatus: "pending",
          input: input.input,
          idempotencyKey: input.idempotencyKey || null,
          parentStepId: input.parentStepId || null,
          metadata: input.metadata
        });
      }
      return existingRun ? {
        run: existingRun,
        attempts: db.listWorkflowStepAttempts(stepId)
      } : null;
    });
    if (existing) {
      const attempts = existing.attempts;
      const runStatus = String(existing.run.status || "idle");
      const lastSyncedStatus = runStatus === "completed" ? "completed" : runStatus === "blocked" ? "invalid" : runStatus === "failed" ? "failed" : runStatus === "running" ? "running" : "queued";
      return {
        projectId: input.projectId,
        runId,
        stepId,
        attemptCount: attempts.reduce((highest, attempt) => Math.max(highest, Number(attempt.attempt || 0)), 0),
        lastSyncedStatus,
        validationRecorded: attempts.some((attempt) => attempt.kind === "validate"),
        lastError: typeof existing.run.error === "string" ? existing.run.error : null
      };
    }
    return {
      projectId: input.projectId,
      runId,
      stepId,
      attemptCount: 0,
      lastSyncedStatus: "queued",
      validationRecorded: false,
      lastError: null
    };
  }
  async sync(trace, node, input) {
    if (trace.lastSyncedStatus === input.status) return;
    const status = persistedWorkflowStatus(input.status);
    const terminal = input.status === "completed" || input.status === "invalid" || input.status === "failed";
    await withFactoryDb(this.rootDir, async (db) => {
      db.updateWorkflowStep(trace.stepId, status.step, {
        output: terminal ? input.output : void 0,
        error: input.error || null,
        validationStatus: input.validation?.valid === true ? "passed" : input.validation ? "failed" : "pending",
        metadata: input.metadata
      });
      db.updateRun(trace.runId, status.run, {
        error: validationErrorText(input),
        stage: node.stage
      });
      if (terminal && !trace.validationRecorded) {
        const attempt = trace.attemptCount + 1;
        const attemptId = `${trace.stepId}_attempt_${String(attempt).padStart(3, "0")}`;
        db.createWorkflowStepAttempt({
          id: attemptId,
          stepId: trace.stepId,
          runId: trace.runId,
          projectId: trace.projectId,
          attempt,
          kind: "validate",
          status: "in_progress",
          promptVersion: input.validationPromptVersion || "workflow-validator-v1",
          input: input.validationInput ?? { output: input.output },
          metadata: input.attemptMetadata
        });
        db.updateWorkflowStepAttempt(attemptId, input.validation?.valid === true ? "completed" : "failed", {
          output: input.validation,
          error: input.error || input.validation?.errors || null
        });
        trace.attemptCount = attempt;
        trace.validationRecorded = true;
      }
    });
    if (!terminal) trace.validationRecorded = false;
    trace.lastSyncedStatus = input.status;
    trace.lastError = null;
  }
  async recordAttempt(trace, input) {
    const attempt = trace.attemptCount + 1;
    const attemptId = `${trace.stepId}_attempt_${String(attempt).padStart(3, "0")}`;
    await withFactoryDb(this.rootDir, async (db) => {
      db.createWorkflowStepAttempt({
        id: attemptId,
        stepId: trace.stepId,
        runId: trace.runId,
        projectId: trace.projectId,
        attempt,
        kind: input.kind,
        status: "in_progress",
        modelConfigId: input.modelConfigId,
        modelName: input.modelName,
        promptVersion: input.promptVersion,
        promptHash: input.promptHash,
        input: input.input,
        metadata: input.metadata
      });
      db.updateWorkflowStepAttempt(attemptId, input.status || "completed", {
        output: input.output,
        error: input.error,
        usage: input.usage,
        metadata: input.metadata
      });
    });
    trace.attemptCount = attempt;
    return attemptId;
  }
  async loadEvidence(trace) {
    return withFactoryDb(this.rootDir, async (db) => ({
      run: db.getWorkflowRun(trace.runId),
      steps: db.listWorkflowSteps(trace.runId),
      attempts: db.listWorkflowStepAttempts(trace.stepId)
    }));
  }
};

export {
  WorkflowKernel,
  FactoryWorkflowTraceRecorder
};
