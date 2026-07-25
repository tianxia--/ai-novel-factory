import type { NovelStage } from "./cli-types"
import { withFactoryDb } from "./factory-db"

export type WorkflowExecutionMode = "production" | "debug" | "manual" | "repair"
export type WorkflowLifecycleStatus = "queued" | "running" | "completed" | "invalid" | "failed"
export type WorkflowAttemptKind = "generate" | "parse" | "validate" | "audit" | "repair" | "promote"

export interface WorkflowNodeDefinition<TContext, TResult = void> {
  id: string
  name: string
  stage: NovelStage
  version: string
  execute(context: TContext): Promise<TResult>
}

export type WorkflowNodeMetadata = Omit<WorkflowNodeDefinition<never, never>, "execute">

/**
 * The one entry point shared by single-node debug execution and composed flows.
 * A node owns its business behavior; the kernel only resolves and invokes it.
 */
export class WorkflowKernel<TContext> {
  private readonly nodes = new Map<string, WorkflowNodeDefinition<TContext, unknown>>()

  register<TResult>(definition: WorkflowNodeDefinition<TContext, TResult>) {
    if (this.nodes.has(definition.id)) throw new Error(`workflow_node_already_registered:${definition.id}`)
    this.nodes.set(definition.id, definition as WorkflowNodeDefinition<TContext, unknown>)
    return this
  }

  getNode(nodeId: string): WorkflowNodeDefinition<TContext, unknown> {
    const definition = this.nodes.get(nodeId)
    if (!definition) throw new Error(`workflow_node_not_registered:${nodeId}`)
    return definition
  }

  listNodes(): WorkflowNodeMetadata[] {
    return Array.from(this.nodes.values()).map(({ execute: _execute, ...metadata }) => metadata)
  }

  async executeNode<TResult = unknown>(nodeId: string, context: TContext): Promise<TResult> {
    const definition = this.getNode(nodeId)
    return definition.execute(context) as Promise<TResult>
  }
}

export interface WorkflowTraceReference {
  projectId: string
  runId: string
  stepId: string
  attemptCount: number
  lastSyncedStatus: WorkflowLifecycleStatus
  validationRecorded?: boolean
  lastError?: string | null
}

export interface WorkflowTraceEvidence {
  run: Record<string, unknown> | null
  steps: Record<string, unknown>[]
  attempts: Record<string, unknown>[]
}

export interface InitializeWorkflowTraceInput {
  projectId: string
  externalRunId: string
  runId?: string
  stepId?: string
  node: WorkflowNodeMetadata
  input: unknown
  executionMode: WorkflowExecutionMode
  parentRunId?: string | null
  parentStepId?: string | null
  goal?: string
  idempotencyKey?: string | null
  metadata?: unknown
}

export interface SyncWorkflowTraceInput {
  status: WorkflowLifecycleStatus
  output?: unknown
  error?: string | null
  validation?: { valid: boolean; errors?: unknown[]; warnings?: unknown[] } | null
  metadata?: unknown
  validationInput?: unknown
  validationPromptVersion?: string
  attemptMetadata?: unknown
}

export interface RecordWorkflowAttemptInput {
  kind: WorkflowAttemptKind
  status?: "completed" | "failed" | "cancelled"
  modelConfigId?: string | null
  modelName?: string | null
  promptVersion?: string | null
  promptHash?: string | null
  input?: unknown
  output?: unknown
  error?: unknown
  usage?: unknown
  metadata?: unknown
}

function persistedWorkflowStatus(status: WorkflowLifecycleStatus) {
  if (status === "completed") return { run: "completed" as const, step: "completed" as const }
  if (status === "invalid") return { run: "blocked" as const, step: "failed" as const }
  if (status === "failed") return { run: "failed" as const, step: "failed" as const }
  if (status === "running") return { run: "running" as const, step: "in_progress" as const }
  return { run: "idle" as const, step: "pending" as const }
}

function validationErrorText(value: SyncWorkflowTraceInput) {
  if (value.error) return value.error
  if (value.status !== "invalid") return null
  return (value.validation?.errors || []).map((entry) => String(entry)).join(" | ") || "workflow_validation_failed"
}

/** Durable Run -> Step -> Attempt recording, independent from any HTTP/debug UI. */
export class FactoryWorkflowTraceRecorder {
  constructor(private readonly rootDir: string) {}

  async initialize(input: InitializeWorkflowTraceInput): Promise<WorkflowTraceReference> {
    const runId = input.runId || `${input.executionMode}_${input.externalRunId}`
    const stepId = input.stepId || `step_${input.externalRunId}`
    const existing = await withFactoryDb(this.rootDir, async (db) => {
      const existingRun = db.getWorkflowRun(runId)
      const existingStep = db.listWorkflowSteps(runId).find((step) => step.id === stepId)
      if (existingRun && existingStep) {
        return {
          run: existingRun,
          attempts: db.listWorkflowStepAttempts(stepId),
        }
      }
      const project = db.getProject(input.projectId)
      if (!project) throw new Error("factory_project_not_found")
      if (!existingRun) {
        db.createRun({
          id: runId,
          projectId: input.projectId,
          projectRoot: project.projectRoot,
          parentRunId: input.parentRunId || null,
          kind: "workflow_advance",
          status: "idle",
          goal: input.goal || `${input.executionMode} 单点执行：${input.node.name}`,
          stage: input.node.stage,
        })
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
          metadata: input.metadata,
        })
      }
      return existingRun ? {
        run: existingRun,
        attempts: db.listWorkflowStepAttempts(stepId),
      } : null
    })
    if (existing) {
      const attempts = existing.attempts as Array<Record<string, unknown>>
      const runStatus = String(existing.run.status || "idle")
      const lastSyncedStatus: WorkflowLifecycleStatus = runStatus === "completed"
        ? "completed"
        : runStatus === "blocked"
          ? "invalid"
          : runStatus === "failed"
            ? "failed"
            : runStatus === "running"
              ? "running"
              : "queued"
      return {
        projectId: input.projectId,
        runId,
        stepId,
        attemptCount: attempts.reduce((highest, attempt) => Math.max(highest, Number(attempt.attempt || 0)), 0),
        lastSyncedStatus,
        validationRecorded: attempts.some((attempt) => attempt.kind === "validate"),
        lastError: typeof existing.run.error === "string" ? existing.run.error : null,
      }
    }
    return {
      projectId: input.projectId,
      runId,
      stepId,
      attemptCount: 0,
      lastSyncedStatus: "queued",
      validationRecorded: false,
      lastError: null,
    }
  }

  async sync(trace: WorkflowTraceReference, node: WorkflowNodeMetadata, input: SyncWorkflowTraceInput) {
    if (trace.lastSyncedStatus === input.status) return
    const status = persistedWorkflowStatus(input.status)
    const terminal = input.status === "completed" || input.status === "invalid" || input.status === "failed"
    await withFactoryDb(this.rootDir, async (db) => {
      db.updateWorkflowStep(trace.stepId, status.step, {
        output: terminal ? input.output : undefined,
        error: input.error || null,
        validationStatus: input.validation?.valid === true ? "passed" : input.validation ? "failed" : "pending",
        metadata: input.metadata,
      })
      db.updateRun(trace.runId, status.run, {
        error: validationErrorText(input),
        stage: node.stage,
      })
      if (terminal && !trace.validationRecorded) {
        const attempt = trace.attemptCount + 1
        const attemptId = `${trace.stepId}_attempt_${String(attempt).padStart(3, "0")}`
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
          metadata: input.attemptMetadata,
        })
        db.updateWorkflowStepAttempt(attemptId, input.validation?.valid === true ? "completed" : "failed", {
          output: input.validation,
          error: input.error || input.validation?.errors || null,
        })
        trace.attemptCount = attempt
        trace.validationRecorded = true
      }
    })
    if (!terminal) trace.validationRecorded = false
    trace.lastSyncedStatus = input.status
    trace.lastError = null
  }

  async recordAttempt(trace: WorkflowTraceReference, input: RecordWorkflowAttemptInput) {
    const attempt = trace.attemptCount + 1
    const attemptId = `${trace.stepId}_attempt_${String(attempt).padStart(3, "0")}`
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
        metadata: input.metadata,
      })
      db.updateWorkflowStepAttempt(attemptId, input.status || "completed", {
        output: input.output,
        error: input.error,
        usage: input.usage,
        metadata: input.metadata,
      })
    })
    trace.attemptCount = attempt
    return attemptId
  }

  async loadEvidence(trace: WorkflowTraceReference): Promise<WorkflowTraceEvidence> {
    return withFactoryDb(this.rootDir, async (db) => ({
      run: db.getWorkflowRun(trace.runId),
      steps: db.listWorkflowSteps(trace.runId),
      attempts: db.listWorkflowStepAttempts(trace.stepId),
    })) as Promise<WorkflowTraceEvidence>
  }
}
