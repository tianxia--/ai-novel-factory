import { A as AutonomousNovelState } from './cli-types-3z9cP1VA.cjs';
import { WorkflowTraceReference, WorkflowNodeMetadata, WorkflowTraceEvidence } from './workflow-kernel.cjs';

type ProductionWorkflowSandboxStatus = "ready" | "running" | "failed";
interface ProductionWorkflowSandboxRun {
    runId: string;
    nodeId: string;
    nodeName: string;
    startedAt: string;
    completedAt: string | null;
    status: "running" | "completed" | "failed";
    beforeStage: string;
    afterStage: string | null;
    beforeState: Record<string, unknown>;
    afterState: Record<string, unknown> | null;
    trace: WorkflowTraceReference | null;
    error: string | null;
}
interface ProductionWorkflowSandboxManifest {
    sandboxId: string;
    projectId: string;
    sourceProjectRoot: string;
    sandboxRoot: string;
    createdAt: string;
    updatedAt: string;
    status: ProductionWorkflowSandboxStatus;
    activeRunId: string | null;
    runs: ProductionWorkflowSandboxRun[];
}
interface ProductionWorkflowSandboxInspection {
    manifest: ProductionWorkflowSandboxManifest;
    state: AutonomousNovelState;
    currentNode: WorkflowNodeMetadata;
    nodes: WorkflowNodeMetadata[];
    canExecuteCurrentNode: boolean;
    workflowEvidence: WorkflowTraceEvidence | null;
    humanGate: {
        id: "setting-review" | "protagonist-profile";
        status: "required" | "approved" | "rejected";
        reviewPath?: string;
        approvalPath: string;
    } | null;
}
/**
 * Runs the real production state-machine node against an isolated copy of a
 * managed project. Factory workflow traces stay durable, while project state
 * and generated artifacts remain inside the sandbox until an explicit promote
 * operation is implemented by the business layer.
 */
declare class ProductionWorkflowSandboxManager {
    private readonly factoryRootDir;
    private readonly sandboxesRoot;
    private readonly traceRecorder;
    constructor(factoryRootDir: string);
    private sandboxRoot;
    private manifestPath;
    create(projectId: string, sandboxId?: string): Promise<ProductionWorkflowSandboxInspection>;
    loadManifest(sandboxId: string): Promise<ProductionWorkflowSandboxManifest>;
    inspect(sandboxId: string): Promise<ProductionWorkflowSandboxInspection>;
    approveSettingReview(sandboxId: string): Promise<ProductionWorkflowSandboxInspection>;
    confirmProtagonistProfile(sandboxId: string, input: Record<string, unknown>): Promise<ProductionWorkflowSandboxInspection>;
    executeNode(sandboxId: string, requestedNodeId: string): Promise<ProductionWorkflowSandboxInspection>;
}

export { type ProductionWorkflowSandboxInspection, ProductionWorkflowSandboxManager, type ProductionWorkflowSandboxManifest, type ProductionWorkflowSandboxRun, type ProductionWorkflowSandboxStatus };
