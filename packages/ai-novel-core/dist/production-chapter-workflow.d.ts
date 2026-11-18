import { A as AutonomousNovelState, N as NovelStage } from './cli-types-3z9cP1VA.js';
import { ProductionPipelineOptions } from './writing-pipeline.js';
import { WorkflowNodeMetadata, WorkflowTraceReference } from './workflow-kernel.js';
import './aigc-detector.js';
import './production-contracts-C1il9ao8.js';

type ProductionChapterNodeId = "production.chapter-draft" | "production.chapter-quality" | "production.chapter-naturalness" | "production.chapter-commit";
interface ProductionChapterNodeContext {
    projectRoot: string;
    factoryRootDir: string;
    projectId: string;
    state: AutonomousNovelState;
    chapterNumber: number;
    options?: ProductionPipelineOptions;
    metadata?: Record<string, unknown>;
}
interface ProductionChapterNodeInspection {
    currentNode: (WorkflowNodeMetadata & {
        id: ProductionChapterNodeId;
    }) | null;
    chapterNumber: number | null;
    draftCheckpointPath: string | null;
    qualityCheckpointPath: string | null;
    naturalnessCheckpointPath: string | null;
    commitCheckpointPath: string | null;
}
declare function listProductionChapterNodes(): {
    id: "production.chapter-draft" | "production.chapter-quality" | "production.chapter-naturalness" | "production.chapter-commit";
    stage: NovelStage;
    version: string;
    name: string;
}[];
declare function inspectProductionChapterNode(projectRoot: string, suppliedState?: AutonomousNovelState): Promise<ProductionChapterNodeInspection>;
declare function executeProductionChapterNode(context: ProductionChapterNodeContext, nodeId: ProductionChapterNodeId, externalRunId?: string): Promise<{
    state: AutonomousNovelState;
    trace: WorkflowTraceReference;
}>;

export { type ProductionChapterNodeContext, type ProductionChapterNodeId, type ProductionChapterNodeInspection, executeProductionChapterNode, inspectProductionChapterNode, listProductionChapterNodes };
