import { A as AutonomousNovelState } from './cli-types-3z9cP1VA.cjs';
export { e as AssetStatus, b as AutopilotRuntime, f as CausalChapterPlan, c as ChapterTask, d as CharacterDossier, C as CreativeProfile, g as InitProjectOptions, h as InterruptOptions, I as InterruptionReview, i as InterruptionScope, a as NovelProjectRecord, N as NovelStage, P as ProviderTestResult, T as TaskStatus } from './cli-types-3z9cP1VA.cjs';
export { A as ActiveLlmConfig, L as LlmApiMode, a as LlmCapability, b as LlmProviderConfig, c as ProjectEnvStatus, d as ProjectEnvValues, P as PublicProjectEnvStatus, e as ensureEnvLlmConfigImported, g as getCachedActiveLlmConfig, f as getProjectEnvCandidatePaths, h as getProjectEnvPath, i as getProjectEnvStatus, j as getPublicProjectEnvStatus, l as loadActiveLlmConfig, k as loadLlmConfigForCapability, m as loadLlmConfigFromEnv, r as readProjectEnv, n as resolveFactoryRootDir, o as resolveProjectEnvWritePath, s as setCachedActiveLlmConfig, u as upsertProjectEnvValues } from './llm-config-Rvjshu2J.cjs';
export { L as LlmUsageMetrics, a as advanceAutonomousProject, c as createManagedAutonomousProject, d as deleteManagedAutonomousProject, e as extractLlmUsageMetrics, f as formatStatus, g as generateAgentReply, b as getWorkspaceSummary, i as initAutonomousProject, l as listAutonomousProjects, h as loadAutonomousState, p as prepareCoverGeneration, r as requestLlmTextCompletion, j as resolveManagedProjectRoot, k as retryChapterProduction, m as reviewInterruption, s as saveAutonomousState, n as syncManagedProjectState, t as testProviderConnectivity } from './server-core-DWrwsSxx.cjs';
export { AigcBatchDetectionResult, AigcDetectionConfig, AigcDetectionInput, AigcDetectionResult, AigcDetectionStatus, AigcDetectorGradioOptions, AigcDetectorProvider, AigcDetectorSegmentOptions, AigcSegmentDetectionResult, AigcTextSegment, createAigcDetectorClient, detectAigcSegments, detectAigcText, getAigcDetectorConfig, getAigcDetectorConfigFromEnv, getAigcDetectorConfigFromSettings, parseAigcDetectorSse, splitAigcTextIntoSegments } from './aigc-detector.cjs';
export { A as AcceptStyleEvolutionCandidateInput, e as ApproveStyleEvolutionInput, D as DeriveProjectRuntimeStateInput, I as InitializeStyleEvolutionOptions, f as ParsedStyleEvolutionCritique, g as ParsedStyleEvolutionEvaluation, h as ParsedStyleEvolutionFreezeAdvice, i as ParsedStyleEvolutionRefinementOnly, j as ProjectChapterProgress, k as ProjectExecutionStatus, l as ProjectNextTarget, m as ProjectPrimaryAction, n as ProjectProductionStatus, P as ProjectRuntimeState, o as ProjectWorkflowStage, R as RejectStyleEvolutionInput, p as StyleContractExtractionPrompt, q as StyleContractExtractionPromptInput, r as StyleEvolutionAssetPaths, s as StyleEvolutionCandidateInput, t as StyleEvolutionCandidatePrompt, u as StyleEvolutionCandidatePromptInput, b as StyleEvolutionEvaluation, v as StyleEvolutionEvaluationPrompt, w as StyleEvolutionEvaluationPromptInput, x as StyleEvolutionEvaluationScores, c as StyleEvolutionRefinement, y as StyleEvolutionRefinementPrompt, z as StyleEvolutionRefinementPromptInput, S as StyleEvolutionSnapshot, B as StyleFreezeAdvicePrompt, C as StyleFreezeAdvicePromptInput, E as StyleFreezeLedger, F as StyleFreezeLedgerEntry, d as StyleGenerationVerification, a as StyleLoopRuntimeIterationRecord, G as StyleLoopRuntimeRecord, H as acceptStyleEvolutionCandidate, J as appendStyleEvolutionCandidate, K as appendStyleLoopRunLedger, L as approveStyleEvolutionSample, M as buildStyleContractExtractionPrompt, N as buildStyleEvolutionCandidatePrompt, O as buildStyleEvolutionCritiquePrompt, Q as buildStyleEvolutionEvaluationPrompt, T as buildStyleEvolutionRefinement, U as buildStyleEvolutionRefinementOnlyPrompt, V as buildStyleFreezeAdvicePrompt, W as buildStyleGenerationVerification, X as createStyleLoopRuntimeRecord, Y as deriveProjectRuntimeState, Z as evaluateStyleEvolutionCandidate, _ as getStyleEvolutionAssetPaths, $ as initializeStyleEvolution, a0 as loadStyleEvolution, a1 as materializeApprovedStyleAssets, a2 as normalizeStyleAigcSignal, a3 as parseStyleContractFromText, a4 as parseStyleEvolutionCritiqueFromText, a5 as parseStyleEvolutionEvaluationFromText, a6 as parseStyleEvolutionRefinementFromText, a7 as parseStyleFreezeAdviceFromText, a8 as persistStyleEvolutionRuntimeState, a9 as persistStyleLoopRuntime, aa as rejectStyleEvolutionSample, ab as validateStyleContractForFreeze } from './production-style-evolution-cLLrVfPf.cjs';
export { A as AgentTurnInput, b as ArtifactRecordInput, C as ChapterProductionFact, c as CheckpointInput, D as DiscussionTarget, d as FactoryDb, F as FactoryOperationalStatus, e as KnowledgeChunkInput, f as KnowledgeChunkRow, g as KnowledgeCitationInput, a as KnowledgeRecallRow, K as KnowledgeScope, h as KnowledgeSourceInput, M as MessageListOptions, P as ProjectSnapshot, S as StepStatus, i as SuperGraph, j as SuperGraphEdge, k as SuperGraphEdgeType, l as SuperGraphNode, m as SuperGraphNodeType, n as SuperGraphValidationIssue, W as WorkflowCheckpointQuery, o as WorkflowRunInput, p as WorkflowStepAttemptInput, q as WorkflowStepInput, r as buildInitialSuperGraph, s as buildSuperGraphIndex, t as getFactoryDbPath, u as initializeSuperGraph, v as loadSuperGraph, w as loadSuperGraphForUpdate, x as makeAgentTurnId, y as makeRunId, z as runMultiAgentDiscussion, B as saveSuperGraph, E as superGraphFromDbRows, G as targetToArtifactKind, H as upsertCheckpointInSuperGraph, I as upsertDiscussionInSuperGraph, J as validateSuperGraph, L as withFactoryDb } from './factory-db-CA4bu7Jl.cjs';
export { backfillPendingMemoryEmbeddings, createLocalTextEmbedding } from './embedding.cjs';
export { IngestKnowledgeSourceOptions, KnowledgeBenchmarkCase, KnowledgeBenchmarkCaseResult, KnowledgeBenchmarkResult, KnowledgeChunkDraft, KnowledgeRetrievalEvaluation, KnowledgeRetrieveOptions, backfillPendingKnowledgeEmbeddings, chunkKnowledgeContent, evaluateKnowledgeBenchmark, evaluateKnowledgeRetrieval, formatKnowledgeForPrompt, ingestGlobalWritingResources, ingestKnowledgeSource, ingestProjectArtifact, retrieveKnowledge } from './knowledge.cjs';
export { AigcWritingDetectionReport, ApprovedWritingStyleContext, ChapterContextPackageInfo, ChapterInheritanceAdapterPayload, ChapterNaturalnessStageResult, ChapterProductionCommitResult, ChapterQualityStageResult, CharacterProfileContract, ContinuityContract, DraftSceneCard, DraftSegmentArtifactInfo, DraftSegmentAssemblyUsage, DraftSegmentCompositionPlan, DraftSegmentPlan, DraftSegmentSubArtifactInfo, NaturalnessReport, NovelWorkspacePaths, PreparedChapterProductionInputs, ProductionPipelineOptions, ProductionPlanningBlockedError, ProductionPlanningStoryContext, ProductionReadinessBlockedError, ProductionStoryAssetContext, ProductionStoryBibleAsset, ProductionWritingMode, ProductionWritingResources, QualityGateResult, SemanticPreservationReport, StyleConformanceDriftReport, WritingArtifactRef, WritingKnowledgeReference, WritingLlmTrace, WritingProgressEvent, WritingToolTrace, WritingWorkflowTrace, buildChapterInheritanceAdapterPayload, commitChapterProductionStage, compactPreviousSegmentTail, createContinuityContract, createDetailedChapterBlueprint, createDraftBody, createDraftBodyFromBlueprint, createDraftSegmentCompositionPlan, createDraftSegmentPlan, createNaturalnessReport, createProductionMasterOutline, createProductionStoryBibleAssets, createProductionWritingPlanContract, createQualityReport, evaluateChapterStyleConformanceDrift, evaluateCharacterProfilePresence, evaluateNarrativeStyleQuality, evaluatePlotContinuityBridge, evaluateSceneCardCharacterObligations, evaluateSemanticPreservation, evaluateUnplannedCharacterDrift, evaluateWritingResourceUsage, formatApprovedWritingStylePrompt, inferGenreProfile, invalidateAllCaches, invalidateProjectCache, invalidateWritingResourcesCache, loadAndPruneGlobalContext, loadApprovedWritingStyleContext, loadProductionStoryAssetContext, loadProductionWritingResources, memoryCacheTracker, normalizeAigcWritingDetectionReport, parseQualityGate, prepareChapterProductionInputs, repairAigcHighRiskDraft, resourcesCacheTracker, retrieveFactoryMemoryContext, runAigcWritingDetection, runChapterNaturalnessStage, runChapterProductionPipeline, runQualityGateWithRevisions, sanitizeKnownCastNames, skippedAigcWritingDetectionReport, writeAllDetailedChapterBlueprints, writeProductionMasterOutline, writeProductionStoryBibleAssets, writeProductionWritingPlan, writeProductionWritingResourceArtifacts } from './writing-pipeline.cjs';
import { NovelDirectorCommand } from './novel-director.cjs';
export { NovelDirectorInput, buildDirectorDiscussionMessage, createFollowUpAdvanceCommand, createManualAdvanceCommand, createManualInterruptCommand, createManualRetryChapterCommand, decideNovelDirectorCommand, isGenericAutopilotMessage, shouldAdvanceBeforeDiscussion } from './novel-director.cjs';
export { createWorkerWorkspacePayload, getNovelAutopilotWorkerStatus, runNovelAutopilotWorkerCli, runNovelAutopilotWorkerOnce, startNovelAutopilotWorker } from './worker.cjs';
export { AgentMessage, AgentMessageData, AgentMessageType, ArtifactMessage, ArtifactMessageData, BaseMessage, ImageMessage, ImageMessageData, MessagePart, MessageStatus, MessageType, NovelMessage, StatusMessage, StatusMessageData, ToolMessage, ToolMessageData, UserMessage, UserMessageData, agentLabelFromType, agentTypeFromLabel, createAgentMessage, createArtifactMessage, createBaseMessage, createImageMessage, createMessageId, createStatusMessage, createToolMessage, createUserMessage } from './messages.cjs';
export { C as ChapterBlueprintContract, f as ChapterSceneCardContract, a as ProductionGateIssue, d as ProductionGateResult, g as ProductionGateStatus, h as ProductionPhase, i as ProductionReadinessAsset, c as ProductionReadinessGroup, j as ProductionReadinessInput, b as ProductionReadinessItem, P as ProductionReadinessSnapshot, S as StyleEvolutionContract, k as WritingPlanChapterContract, W as WritingPlanContract, l as evaluateChapterBlueprintGate, m as evaluateChapterExecutionReadiness, n as evaluateProductionReadiness, e as evaluateStyleEvolutionGate } from './production-contracts-C1il9ao8.cjs';

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

export { AutonomousNovelState, type ChapterConsistencyInput, type ChapterConsistencyResult, type DirectorCommandEventType, type ManualAdvanceOptions, type ManualDirectorCommandOptions, type ManualInterruptOptions, type ManualRetryChapterOptions, NovelDirectorCommand, type RouteDecision, type RouteType, evaluateChapterConsistency, executeManualAdvanceCommand, executeManualInterruptCommand, executeManualRetryChapterCommand, extractChinesePersonNames, inferLockedProtagonistName, recordDirectorCommandEvent, routeUserMessage };
