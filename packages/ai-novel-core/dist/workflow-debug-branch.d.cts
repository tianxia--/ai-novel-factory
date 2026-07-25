import { WorkflowTraceReference } from './workflow-kernel.cjs';
import './cli-types-3z9cP1VA.cjs';

interface WorkflowDebugBranchReference {
    branchId: string;
    threadId: string;
    checkpointNamespace: string;
    runId: string | null;
    baseCheckpointId: string;
    lastCheckpointId: string;
}
interface WorkflowStateDiffEntry {
    operation: "add" | "remove" | "replace";
    path: string;
    before?: unknown;
    after?: unknown;
}
declare function diffWorkflowState(before: unknown, after: unknown, path?: string): WorkflowStateDiffEntry[];
declare class FactoryWorkflowDebugBranchManager {
    private readonly rootDir;
    private readonly projectId;
    constructor(rootDir: string, projectId: string);
    private saver;
    private config;
    create(input: {
        branchId: string;
        nodeId: string;
        runId?: string | null;
        baseState: unknown;
        metadata?: Record<string, unknown>;
    }): Promise<WorkflowDebugBranchReference>;
    append(reference: WorkflowDebugBranchReference, state: unknown, metadata?: Record<string, unknown>): Promise<WorkflowDebugBranchReference>;
    inspect(reference: WorkflowDebugBranchReference): Promise<{
        reference: WorkflowDebugBranchReference;
        base: {
            checkpointId: string;
            createdAt: string;
            state: unknown;
            metadata: {};
            parentCheckpointId: any;
        };
        latest: {
            checkpointId: string;
            createdAt: string;
            state: unknown;
            metadata: {};
            parentCheckpointId: any;
        } | null;
        history: {
            checkpointId: string;
            createdAt: string;
            state: unknown;
            metadata: {};
            parentCheckpointId: any;
        }[];
        diff: WorkflowStateDiffEntry[];
    }>;
    rollback(reference: WorkflowDebugBranchReference, checkpointId: string): Promise<WorkflowDebugBranchReference>;
    promote<TResult>(reference: WorkflowDebugBranchReference, trace: WorkflowTraceReference, apply: (state: unknown, diff: WorkflowStateDiffEntry[]) => Promise<TResult>): Promise<{
        result: TResult;
        reference: WorkflowDebugBranchReference;
        diff: WorkflowStateDiffEntry[];
    }>;
}

export { FactoryWorkflowDebugBranchManager, type WorkflowDebugBranchReference, type WorkflowStateDiffEntry, diffWorkflowState };
