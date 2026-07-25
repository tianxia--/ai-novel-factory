import { N as NovelStage } from './cli-types-3z9cP1VA.js';

type WorkflowExecutionMode = "production" | "debug" | "manual" | "repair";
type WorkflowLifecycleStatus = "queued" | "running" | "completed" | "invalid" | "failed";
type WorkflowAttemptKind = "generate" | "parse" | "validate" | "audit" | "repair" | "promote";
interface WorkflowNodeDefinition<TContext, TResult = void> {
    id: string;
    name: string;
    stage: NovelStage;
    version: string;
    execute(context: TContext): Promise<TResult>;
}
type WorkflowNodeMetadata = Omit<WorkflowNodeDefinition<never, never>, "execute">;
/**
 * The one entry point shared by single-node debug execution and composed flows.
 * A node owns its business behavior; the kernel only resolves and invokes it.
 */
declare class WorkflowKernel<TContext> {
    private readonly nodes;
    register<TResult>(definition: WorkflowNodeDefinition<TContext, TResult>): this;
    getNode(nodeId: string): WorkflowNodeDefinition<TContext, unknown>;
    listNodes(): WorkflowNodeMetadata[];
    executeNode<TResult = unknown>(nodeId: string, context: TContext): Promise<TResult>;
}
interface WorkflowTraceReference {
    projectId: string;
    runId: string;
    stepId: string;
    attemptCount: number;
    lastSyncedStatus: WorkflowLifecycleStatus;
    validationRecorded?: boolean;
    lastError?: string | null;
}
interface WorkflowTraceEvidence {
    run: Record<string, unknown> | null;
    steps: Record<string, unknown>[];
    attempts: Record<string, unknown>[];
}
interface InitializeWorkflowTraceInput {
    projectId: string;
    externalRunId: string;
    runId?: string;
    stepId?: string;
    node: WorkflowNodeMetadata;
    input: unknown;
    executionMode: WorkflowExecutionMode;
    parentRunId?: string | null;
    parentStepId?: string | null;
    goal?: string;
    idempotencyKey?: string | null;
    metadata?: unknown;
}
interface SyncWorkflowTraceInput {
    status: WorkflowLifecycleStatus;
    output?: unknown;
    error?: string | null;
    validation?: {
        valid: boolean;
        errors?: unknown[];
        warnings?: unknown[];
    } | null;
    metadata?: unknown;
    validationInput?: unknown;
    validationPromptVersion?: string;
    attemptMetadata?: unknown;
}
interface RecordWorkflowAttemptInput {
    kind: WorkflowAttemptKind;
    status?: "completed" | "failed" | "cancelled";
    modelConfigId?: string | null;
    modelName?: string | null;
    promptVersion?: string | null;
    promptHash?: string | null;
    input?: unknown;
    output?: unknown;
    error?: unknown;
    usage?: unknown;
    metadata?: unknown;
}
/** Durable Run -> Step -> Attempt recording, independent from any HTTP/debug UI. */
declare class FactoryWorkflowTraceRecorder {
    private readonly rootDir;
    constructor(rootDir: string);
    initialize(input: InitializeWorkflowTraceInput): Promise<WorkflowTraceReference>;
    sync(trace: WorkflowTraceReference, node: WorkflowNodeMetadata, input: SyncWorkflowTraceInput): Promise<void>;
    recordAttempt(trace: WorkflowTraceReference, input: RecordWorkflowAttemptInput): Promise<string>;
    loadEvidence(trace: WorkflowTraceReference): Promise<WorkflowTraceEvidence>;
}

export { FactoryWorkflowTraceRecorder, type InitializeWorkflowTraceInput, type RecordWorkflowAttemptInput, type SyncWorkflowTraceInput, type WorkflowAttemptKind, type WorkflowExecutionMode, WorkflowKernel, type WorkflowLifecycleStatus, type WorkflowNodeDefinition, type WorkflowNodeMetadata, type WorkflowTraceEvidence, type WorkflowTraceReference };
