import { A as AutonomousNovelState } from './cli-types-sWRA2Cw2.cjs';
export { b as AutopilotRuntime, e as CausalChapterPlan, c as ChapterTask, d as CharacterDossier, C as CreativeProfile, f as InitProjectOptions, g as InterruptOptions, I as InterruptionReview, h as InterruptionScope, N as NovelProjectRecord, a as NovelStage, P as ProviderTestResult, T as TaskStatus } from './cli-types-sWRA2Cw2.cjs';
export { a as ProjectEnvStatus, b as ProjectEnvValues, P as PublicProjectEnvStatus, g as getProjectEnvCandidatePaths, c as getProjectEnvPath, d as getProjectEnvStatus, e as getPublicProjectEnvStatus, r as readProjectEnv, f as resolveProjectEnvWritePath, u as upsertProjectEnvValues } from './env-manager-BY-bHMi5.cjs';
export { a as advanceAutonomousProject, c as createManagedAutonomousProject, d as deleteManagedAutonomousProject, f as formatStatus, g as generateAgentReply, b as getWorkspaceSummary, i as initAutonomousProject, l as listAutonomousProjects, e as loadAutonomousState, p as prepareCoverGeneration, r as resolveManagedProjectRoot, h as retryChapterProduction, j as reviewInterruption, s as saveAutonomousState, k as syncManagedProjectState, t as testProviderConnectivity } from './server-core-DjeLSvtu.cjs';
export { AigcBatchDetectionResult, AigcDetectionConfig, AigcDetectionInput, AigcDetectionResult, AigcDetectionStatus, AigcDetectorGradioOptions, AigcDetectorProvider, AigcDetectorSegmentOptions, AigcSegmentDetectionResult, AigcTextSegment, createAigcDetectorClient, detectAigcSegments, detectAigcText, getAigcDetectorConfig, getAigcDetectorConfigFromEnv, parseAigcDetectorSse, splitAigcTextIntoSegments } from './aigc-detector.cjs';
export { D as DeriveProjectRuntimeStateInput, a as ProjectChapterProgress, b as ProjectExecutionStatus, c as ProjectNextTarget, d as ProjectPrimaryAction, e as ProjectProductionStatus, P as ProjectRuntimeState, f as ProjectWorkflowStage, g as deriveProjectRuntimeState } from './project-runtime-state-Cs5Q9tsV.cjs';
export { A as AgentTurnInput, b as ArtifactRecordInput, C as ChapterProductionFact, c as CheckpointInput, D as DiscussionTarget, d as FactoryDb, F as FactoryOperationalStatus, e as KnowledgeChunkInput, f as KnowledgeChunkRow, g as KnowledgeCitationInput, a as KnowledgeRecallRow, K as KnowledgeScope, h as KnowledgeSourceInput, M as MessageListOptions, P as ProjectSnapshot, S as SuperGraph, i as SuperGraphEdge, j as SuperGraphEdgeType, k as SuperGraphNode, l as SuperGraphNodeType, m as SuperGraphValidationIssue, W as WorkflowRunInput, n as buildInitialSuperGraph, o as buildSuperGraphIndex, p as getFactoryDbPath, q as initializeSuperGraph, r as loadSuperGraph, s as loadSuperGraphForUpdate, t as makeAgentTurnId, u as makeRunId, v as runMultiAgentDiscussion, w as saveSuperGraph, x as superGraphFromDbRows, y as targetToArtifactKind, z as upsertCheckpointInSuperGraph, B as upsertDiscussionInSuperGraph, E as validateSuperGraph, G as withFactoryDb } from './factory-db-Ba0neSIC.cjs';
export { backfillPendingMemoryEmbeddings, createLocalTextEmbedding } from './embedding.cjs';
export { IngestKnowledgeSourceOptions, KnowledgeBenchmarkCase, KnowledgeBenchmarkCaseResult, KnowledgeBenchmarkResult, KnowledgeChunkDraft, KnowledgeRetrievalEvaluation, KnowledgeRetrieveOptions, backfillPendingKnowledgeEmbeddings, chunkKnowledgeContent, evaluateKnowledgeBenchmark, evaluateKnowledgeRetrieval, formatKnowledgeForPrompt, ingestGlobalWritingResources, ingestKnowledgeSource, ingestProjectArtifact, retrieveKnowledge } from './knowledge.cjs';
export { AigcWritingDetectionReport, CharacterProfileContract, ContinuityContract, NaturalnessReport, NovelWorkspacePaths, ProductionPipelineOptions, ProductionWritingMode, ProductionWritingResources, QualityGateResult, SemanticPreservationReport, WritingKnowledgeReference, WritingProgressEvent, createContinuityContract, createDetailedChapterBlueprint, createDraftBodyFromBlueprint, createNaturalnessReport, createProductionMasterOutline, evaluateCharacterProfilePresence, evaluateNarrativeStyleQuality, evaluatePlotContinuityBridge, evaluateSemanticPreservation, evaluateWritingResourceUsage, inferGenreProfile, invalidateAllCaches, invalidateProjectCache, invalidateWritingResourcesCache, loadAndPruneGlobalContext, loadProductionWritingResources, memoryCacheTracker, parseQualityGate, resourcesCacheTracker, retrieveFactoryMemoryContext, runChapterProductionPipeline, writeAllDetailedChapterBlueprints, writeProductionMasterOutline, writeProductionWritingResourceArtifacts } from './writing-pipeline.cjs';
import { NovelDirectorCommand } from './novel-director.cjs';
export { NovelDirectorInput, buildDirectorDiscussionMessage, createFollowUpAdvanceCommand, createManualAdvanceCommand, createManualInterruptCommand, createManualRetryChapterCommand, decideNovelDirectorCommand, isGenericAutopilotMessage, shouldAdvanceBeforeDiscussion } from './novel-director.cjs';
export { createWorkerWorkspacePayload, getNovelAutopilotWorkerStatus, runNovelAutopilotWorkerCli, runNovelAutopilotWorkerOnce, startNovelAutopilotWorker } from './worker.cjs';
export { AgentMessage, AgentMessageData, AgentMessageType, ArtifactMessage, ArtifactMessageData, BaseMessage, ImageMessage, ImageMessageData, MessagePart, MessageStatus, MessageType, NovelMessage, StatusMessage, StatusMessageData, ToolMessage, ToolMessageData, UserMessage, UserMessageData, agentLabelFromType, agentTypeFromLabel, createAgentMessage, createArtifactMessage, createBaseMessage, createImageMessage, createMessageId, createStatusMessage, createToolMessage, createUserMessage } from './messages.cjs';

interface LlmProviderConfig {
    provider: {
        baseUrl: string;
        apiKeyEnv: string;
        modelName: string;
        timeoutMs: number;
        temperature: number;
        reactMaxSteps: number;
    };
    writing: {
        chapterWordTarget: number;
        chapterWordMinimum: number;
    };
}
declare function loadLlmConfigFromEnv(rootDir?: string): LlmProviderConfig;
interface ActiveLlmConfig extends LlmProviderConfig {
    _dbApiKey?: string;
}
declare function getCachedActiveLlmConfig(): ActiveLlmConfig | null;
declare function setCachedActiveLlmConfig(config: ActiveLlmConfig | null): void;
declare function ensureEnvLlmConfigImported(rootDir?: string): Promise<void>;
declare function resolveFactoryRootDir(dir?: string): string;
declare function loadActiveLlmConfig(rootDir?: string): Promise<ActiveLlmConfig | null>;

type RouteType = "worldbuilding" | "workflow_control" | "interruption_change" | "status_query";
interface RouteDecision {
    type: RouteType;
    reason: string;
}
declare function routeUserMessage(message: string, state: AutonomousNovelState): RouteDecision;

type DirectorCommandEventType = "DIRECTOR_COMMAND_DECIDED" | "DIRECTOR_COMMAND_STARTED" | "DIRECTOR_COMMAND_COMPLETED" | "DIRECTOR_COMMAND_FAILED";
interface ManualDirectorCommandOptions {
    factoryRootDir?: string;
    projectId?: string | null;
    requestedBy?: string;
    source?: string;
}
interface ManualAdvanceOptions extends ManualDirectorCommandOptions {
    reason?: string;
}
interface ManualRetryChapterOptions extends ManualDirectorCommandOptions {
    runNow?: boolean;
    maxRecoveryAttempts?: number;
    reason?: string;
}
interface ManualInterruptOptions extends ManualDirectorCommandOptions {
    reason?: string;
}
declare function recordDirectorCommandEvent(options: ManualDirectorCommandOptions, type: DirectorCommandEventType, command: NovelDirectorCommand, payload?: Record<string, unknown>): Promise<void>;
declare function executeManualAdvanceCommand(rootDir: string, options?: ManualAdvanceOptions): Promise<{
    state: AutonomousNovelState;
    command: NovelDirectorCommand;
}>;
declare function executeManualRetryChapterCommand(rootDir: string, chapterNumber: number, options?: ManualRetryChapterOptions): Promise<{
    state: AutonomousNovelState;
    command: NovelDirectorCommand;
    recoveryLimited: boolean;
}>;
declare function executeManualInterruptCommand(rootDir: string, message: string, options?: ManualInterruptOptions): Promise<{
    state: AutonomousNovelState;
    command: NovelDirectorCommand;
}>;

interface ChapterConsistencyInput {
    chapterNumber: number;
    text: string;
    previousProtagonistName?: string | null;
    protagonistProfile?: string;
    projectIdea?: string;
}
interface ChapterConsistencyResult {
    status: "eligible" | "quarantined";
    reason: string;
    protagonistName?: string;
    detectedNames: string[];
}
declare function extractChinesePersonNames(text?: string, limit?: number): string[];
declare function inferLockedProtagonistName(profile?: string): string;
declare function evaluateChapterConsistency(input: ChapterConsistencyInput): ChapterConsistencyResult;

export { type ActiveLlmConfig, AutonomousNovelState, type ChapterConsistencyInput, type ChapterConsistencyResult, type DirectorCommandEventType, type LlmProviderConfig, type ManualAdvanceOptions, type ManualDirectorCommandOptions, type ManualInterruptOptions, type ManualRetryChapterOptions, NovelDirectorCommand, type RouteDecision, type RouteType, ensureEnvLlmConfigImported, evaluateChapterConsistency, executeManualAdvanceCommand, executeManualInterruptCommand, executeManualRetryChapterCommand, extractChinesePersonNames, getCachedActiveLlmConfig, inferLockedProtagonistName, loadActiveLlmConfig, loadLlmConfigFromEnv, recordDirectorCommandEvent, resolveFactoryRootDir, routeUserMessage, setCachedActiveLlmConfig };
