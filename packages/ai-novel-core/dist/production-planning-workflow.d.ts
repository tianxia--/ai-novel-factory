import { A as AutonomousNovelState, N as NovelStage } from './cli-types-3z9cP1VA.js';
import { ProductionPipelineOptions } from './writing-pipeline.js';
import { WorkflowNodeMetadata, WorkflowTraceReference } from './workflow-kernel.js';
import './aigc-detector.js';
import './production-contracts-C1il9ao8.js';

type ProductionPlanningNodeId = "production.story-foundation" | "production.chapter-blueprints";
interface ProductionPlanningNodeContext {
    projectRoot: string;
    factoryRootDir: string;
    projectId: string;
    state: AutonomousNovelState;
    options?: ProductionPipelineOptions;
    metadata?: Record<string, unknown>;
}
interface ProductionPlanningNodeInspection {
    currentNode: (WorkflowNodeMetadata & {
        id: ProductionPlanningNodeId;
    }) | null;
    missingFoundationArtifacts: string[];
    missingBlueprintChapters: number[];
}
declare function listProductionPlanningNodes(): {
    id: "production.story-foundation" | "production.chapter-blueprints";
    stage: NovelStage;
    version: string;
    name: string;
}[];
declare function inspectProductionPlanningNode(projectRoot: string, suppliedState?: AutonomousNovelState): Promise<ProductionPlanningNodeInspection>;
declare function executeProductionPlanningNode(context: ProductionPlanningNodeContext, nodeId: ProductionPlanningNodeId, externalRunId?: string): Promise<{
    state: AutonomousNovelState;
    trace: WorkflowTraceReference;
}>;

export { type ProductionPlanningNodeContext, type ProductionPlanningNodeId, type ProductionPlanningNodeInspection, executeProductionPlanningNode, inspectProductionPlanningNode, listProductionPlanningNodes };
