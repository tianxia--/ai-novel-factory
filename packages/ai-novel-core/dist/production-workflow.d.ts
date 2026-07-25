import { A as AutonomousNovelState, N as NovelStage } from './cli-types-3z9cP1VA.js';
import { WorkflowExecutionMode, WorkflowTraceReference, WorkflowNodeMetadata, WorkflowKernel } from './workflow-kernel.js';

interface ProductionWorkflowContext {
    rootDir: string;
    factoryRootDir: string;
    projectId: string;
    state: AutonomousNovelState;
    executionMode: Extract<WorkflowExecutionMode, "production" | "manual">;
    parentTrace?: WorkflowTraceReference | null;
    metadata?: Record<string, unknown>;
}
type ProductionAdvanceExecutor = (context: ProductionWorkflowContext) => Promise<AutonomousNovelState>;
interface ExecuteProductionAdvanceInput extends ProductionWorkflowContext {
    externalRunId?: string;
    enabled?: boolean;
}
declare function listProductionWorkflowNodes(): {
    id: string;
    stage: NovelStage;
    version: string;
    name: string;
}[];
declare function resolveProductionWorkflowNode(stage: NovelStage): WorkflowNodeMetadata & {
    stage: NovelStage;
};
declare function createProductionWorkflowKernel(executeAdvance: ProductionAdvanceExecutor): WorkflowKernel<ProductionWorkflowContext>;
/**
 * Compatibility bridge for the existing production state machine.
 * Manual and automatic execution differ only by executionMode; both invoke the
 * same registered node and the same injected production advance function.
 */
declare class ObservableProductionWorkflowRunner {
    private readonly kernel;
    private readonly recorder;
    constructor(factoryRootDir: string, executeAdvance: ProductionAdvanceExecutor);
    listNodes(): WorkflowNodeMetadata[];
    execute(context: ProductionWorkflowContext, externalRunId?: string): Promise<{
        state: AutonomousNovelState;
        trace: WorkflowTraceReference;
    }>;
}
/**
 * Rollout seam used by both manual and automatic callers. With the feature flag
 * disabled it is behaviorally identical to the legacy direct call; when enabled
 * the very same callback is executed through the observable kernel.
 */
declare function executeProductionAdvanceThroughKernel(context: ExecuteProductionAdvanceInput, executeAdvance: () => Promise<AutonomousNovelState>): Promise<{
    state: AutonomousNovelState;
    trace: null;
} | {
    state: AutonomousNovelState;
    trace: WorkflowTraceReference;
}>;

export { type ExecuteProductionAdvanceInput, ObservableProductionWorkflowRunner, type ProductionAdvanceExecutor, type ProductionWorkflowContext, createProductionWorkflowKernel, executeProductionAdvanceThroughKernel, listProductionWorkflowNodes, resolveProductionWorkflowNode };
