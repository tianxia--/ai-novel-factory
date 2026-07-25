import { d as CharacterDossier, A as AutonomousNovelState } from './cli-types-3z9cP1VA.cjs';
import { AigcBatchDetectionResult } from './aigc-detector.cjs';
import { S as StyleEvolutionContract, W as WritingPlanContract } from './production-contracts-C1il9ao8.cjs';

interface NovelWorkspacePaths {
    workspaceDir: string;
    plansDir: string;
    reportsDir: string;
    chaptersDir: string;
    memoryDir: string;
    styleDir: string;
    styleProfilePath: string;
    styleRulebookPath: string;
    styleReferencesPath: string;
    styleAntiPatternsPath: string;
    consensusPath: string;
    characterDossiersPath?: string;
    characterDossiersMarkdownPath?: string;
    protagonistPath: string;
    relationsPath: string;
    characterEvolutionPath: string;
    masterOutlinePath: string;
    chapterBlueprintsDir: string;
}
interface ProductionPipelineOptions {
    factoryRootDir?: string;
    projectId?: string | null;
    envRootDir?: string;
    directorCommandId?: string | null;
    signal?: AbortSignal;
    onProgress?: (event: WritingProgressEvent) => void | Promise<void>;
    maxRevisionAttempts?: number;
    maxRecoveryAttempts?: number;
    forceQualityScoreForTest?: number;
    preferDeterministicPlanning?: boolean;
    writingMode?: ProductionWritingMode;
    bypassAigcGate?: boolean;
    draftSubcallRoles?: Array<"plot" | "narration" | "dialogue" | "character_action" | "continuity" | "assembly">;
}
type ProductionWritingMode = "fast" | "quality";
interface WritingWorkflowTrace {
    kind: "status" | "llm_request" | "llm_response" | "llm_retry" | "llm_error" | "artifact_saved" | "gate" | "knowledge_recall" | "tool_call";
    groupId?: string;
    stage?: string;
    summary?: string;
    collapsed?: boolean;
    expandableArtifactPath?: string;
}
interface WritingLlmTrace {
    roleName: string;
    requestChars?: number;
    basePromptChars?: number;
    dynamicPromptChars?: number;
    messageChars?: number;
    responseChars?: number;
    streamedChars?: number;
    temperature?: number;
    attempt?: number;
    maxAttempts?: number;
}
interface WritingArtifactRef {
    path: string;
    label?: string;
    kind?: string;
    role?: string;
    status?: string;
    chars?: number;
}
interface WritingToolTrace {
    toolName: string;
    status?: string;
    inputSummary?: string;
    outputSummary?: string;
    artifactPath?: string;
}
interface WritingProgressEvent {
    messageId?: string;
    directorCommandId?: string;
    step: string;
    role: "Showrunner" | "Chapter Planner" | "Author" | "Editor" | "Reviewer" | "Prose Stylist" | "Memory Keeper";
    chapterNumber?: number;
    title?: string;
    status?: "started" | "running" | "completed" | "blocked";
    phase?: "request_sent" | "response_started" | "streaming" | "completed" | "failed" | string;
    statusText?: string;
    statusDetail?: string;
    message: string;
    artifactPath?: string;
    artifactLabel?: string;
    artifactKind?: string;
    artifacts?: WritingArtifactRef[];
    preview?: string;
    streamText?: string;
    wordCount?: number;
    qualityGate?: QualityGateResult;
    knowledgeReferences?: WritingKnowledgeReference[];
    workflow?: WritingWorkflowTrace;
    llm?: WritingLlmTrace;
    tools?: WritingToolTrace[];
    timestamp?: string;
}
interface WritingKnowledgeReference {
    chunkId: string;
    chunkType: string;
    score: number;
    sourceType: string;
    sourcePath: string;
    sourceTitle: string;
}
interface AigcWritingDetectionReport {
    enabled: boolean;
    status: "passed" | "blocked" | "unavailable" | "skipped";
    provider: string;
    threshold: number;
    score: number | null;
    maxSegmentScore: number | null;
    totalSegments: number;
    highRiskSegments: Array<{
        id?: string;
        index: number;
        startOffset: number;
        endOffset: number;
        score: number | null;
        label: string;
        preview: string;
    }>;
    reason: string;
}
interface ProductionWritingResources {
    styleGuide: string;
    chapterPlannerGuide: string;
    writerGuide: string;
    editorGuide: string;
    styleControllerGuide: string;
    consistencyGuide: string;
    vocabularyIndex: string;
    vocabularySamples: string[];
    vocabularyCatalog?: VocabularyCatalog;
    examples: string[];
    antiHallucinationGuide?: string;
    evidenceConflictStrategy?: string;
}
interface ProductionStoryBibleAsset {
    filename: string;
    title: string;
    content: string;
    stage: string;
    format?: "markdown" | "json";
}
interface ProductionStoryAssetContext {
    prompt: string;
    files: string[];
}
interface ProductionPlanningStoryContext {
    masterOutline?: string;
}
interface ApprovedWritingStyleContext {
    status: "ready" | "missing";
    prompt: string;
    contract?: StyleEvolutionContract;
    rulebook?: string;
    references?: string;
    antiPatterns?: string;
    chapterInheritanceAdapter?: ChapterInheritanceAdapterPayload;
}
interface ChapterInheritanceAdapterPayload {
    name: "Chapter Inheritance Adapter";
    status: "ready" | "blocked";
    contractVersion: number;
    approvedAt: string;
    freezerVerdict: "block" | "continue" | "ready" | "missing";
    freezerSummary: string;
    verificationStatus: string;
    verificationSummary: string;
    inheritedArtifacts: string[];
    inheritedRules: string[];
    styleContractFields: string[];
    loopProtocolStatus?: string;
    loopProtocolStages?: {
        required: string[];
        completed: string[];
        blocked: string[];
    };
    loopProtocolEvidence?: string[];
    promptSections: string[];
    requiredChapterEvidence: string[];
    approvedSampleExcerpt: string;
}
declare class ProductionReadinessBlockedError extends Error {
    code: string;
    gate: string;
    constructor(message: string);
}
declare class ProductionPlanningBlockedError extends Error {
    code: string;
    gate: string;
    constructor(message: string);
}
interface VocabularyEntry {
    word: string;
    definition: string;
    categories: string[];
}
interface VocabularyCatalog {
    totalWords: number;
    entriesByCategory: Record<string, VocabularyEntry[]>;
    entriesByWord: Map<string, VocabularyEntry>;
}
interface QualityGateResult {
    passed: boolean;
    score: number;
    status: "passed" | "needs_revision" | "blocked";
    attempts: number;
    reason: string;
    wordCount?: number;
    targetWords?: number;
}
interface ContinuityContract {
    lockedProtagonistName: string;
    status: "ready" | "needs_first_chapter_lock" | "blocked";
    requiredNames: string[];
    knownCast: string[];
    continuityAnchors: string[];
    previousChapterLedger: string[];
    characterLedger: string;
    foreshadowingLedger: string;
    hardRules: string[];
    prompt: string;
}
interface CharacterProfileContract {
    status: "ready" | "needs_enrichment" | "blocked";
    requiredFields: string[];
    knownCast: string[];
    missingSignals: string[];
    dossierBrief: string;
    profileBrief: string;
    prompt: string;
    characterDossiers?: CharacterDossier[];
}
interface DraftSceneCard {
    index: number;
    goal: string;
    conflict: string;
    turn: string;
    endHook: string;
    requiredCharacters: string[];
    requiredFacts: string[];
    forbiddenFacts: string[];
}
interface DraftSegmentPlan {
    index: number;
    total: number;
    label: string;
    timelinePosition: string;
    narrativeFocus: string;
    requiredBeats: string[];
    continuityFocus: string[];
    targetWords: number;
    source?: "scene_card" | "timeline";
    sceneCard?: DraftSceneCard;
}
interface DraftSegmentCompositionPlan {
    plot: string[];
    narration: string[];
    dialogue: string[];
    characterAction: string[];
    continuity: string[];
    assemblyRules: string[];
}
interface DraftSegmentSubArtifactInfo {
    kind: "plot" | "narration" | "dialogue" | "character_action" | "continuity" | "assembly";
    role: "brief" | "material";
    path: string;
    relativePath: string;
    chars: number;
}
interface DraftSegmentAssemblyUsage {
    requested: boolean;
    decision: "not_requested" | "used" | "fallback_author";
    reason: string;
    materialChars: number;
    finalChars: number;
    fallbackChars: number;
}
interface ChapterContextPackageInfo {
    path: string;
    relativePath: string;
    promptBudget: {
        basePromptChars: number;
        fixedDynamicPromptChars: number;
        guardrailsChars: number;
        activeWorldSliceChars: number;
        storyAssetsChars: number;
        consensusChars: number;
        memoryChars: number;
        ledgerChars: number;
        ragChars: number;
    };
    segmentCount: number;
    segmentationSource: "scene_card" | "timeline";
}
interface DraftSegmentArtifactInfo {
    path: string;
    relativePath: string;
    segmentIndex: number;
    segmentTotal: number;
    source: "scene_card" | "timeline";
    chars: number;
    manifestPath: string;
    manifestRelativePath: string;
    subArtifacts: DraftSegmentSubArtifactInfo[];
}
interface NaturalnessReport {
    status: "passed" | "needs_revision" | "blocked";
    score: number;
    reason: string;
    changedBlocks: number;
    riskFlags: string[];
    preservedFacts: string[];
    semanticPreservation: SemanticPreservationReport;
    patchSummary: string[];
}
interface SemanticPreservationReport {
    status: "preserved" | "at_risk" | "drifted";
    missingFacts: string[];
    changedFacts: string[];
    preservedFacts: string[];
    reason: string;
}
interface StyleConformanceDriftReport {
    status: "conformant" | "warning" | "drifted" | "pending";
    conformanceScore: number;
    driftScore: number;
    score: number;
    reason: string;
    evidence: string[];
    risks: string[];
    metrics: {
        bodyChars: number;
        contractRuleCount: number;
        matchedRuleCount: number;
        approvedSampleOverlap: number;
        positiveExampleHitCount: number;
        allowedDeviceHitCount: number;
        forbiddenHitCount: number;
        narrativeStyleStatus: ReturnType<typeof evaluateNarrativeStyleQuality>["status"];
        averageSentenceLength: number;
        dialogueRatio: number;
    };
    forbiddenHits: Array<{
        pattern: string;
        count: number;
        evidence: string[];
    }>;
    matchedContractRules: string[];
    missingContractRules: string[];
    checkedAt: string;
}
declare function evaluateChapterStyleConformanceDrift(input: {
    approvedStyleContext: ApprovedWritingStyleContext;
    chapterText: string;
    extractedStyleFingerprint?: string;
}): StyleConformanceDriftReport;
declare function parseQualityGate(report: string, attempts?: number, maxAttempts?: number): QualityGateResult;
declare function evaluateUnplannedCharacterDrift(finalDraft: string, continuityContract: ContinuityContract, characterDossiers?: CharacterDossier[]): {
    status: "quarantined";
    reason: string;
    risks: {
        name: string;
        occurrences: number;
        keyContext: boolean;
    }[];
} | {
    status: "eligible";
    reason: string;
    risks: {
        name: string;
        occurrences: number;
        keyContext: boolean;
    }[];
};
declare function inferGenreProfile(state: AutonomousNovelState): {
    narration: string;
    naturalnessTarget: "light" | "balanced" | "strict";
    readerPromise: string;
    pointOfView: string;
    tone: string;
    pacingAndRhythm: string | undefined;
    chapterStructure: string | undefined;
    characterPressure: string | undefined;
    poisonPoints: string[] | undefined;
    naturalnessRules: string[];
    contextPriority: string[];
    genre: string;
    vocabularyScenes: string[];
};
declare function buildChapterInheritanceAdapterPayload(contract: StyleEvolutionContract | null | undefined): ChapterInheritanceAdapterPayload | null;
declare function formatApprovedWritingStylePrompt(contract: StyleEvolutionContract | null | undefined): string;
declare function loadApprovedWritingStyleContext(projectRoot: string): Promise<ApprovedWritingStyleContext>;
declare function compactPreviousSegmentTail(text: string, maxChars?: number): string;
declare function evaluateNarrativeStyleQuality(text?: string): {
    status: "eligible" | "quarantined";
    reason: string;
    fragments: string[];
};
declare function evaluateWritingResourceUsage(text?: string, state?: AutonomousNovelState, task?: AutonomousNovelState["plan"]["chapterTasks"][number], blueprint?: string, continuityContract?: ContinuityContract): {
    status: "quarantined";
    reason: string;
    matchedTerms: string[];
} | {
    status: "warning";
    reason: string;
    matchedTerms: string[];
} | {
    status: "eligible";
    reason: string;
    matchedTerms: string[];
};
declare function evaluateSemanticPreservation(input: {
    beforeDraft: string;
    afterDraft: string;
    continuityContract: ContinuityContract;
    characterProfileContract: CharacterProfileContract;
}): SemanticPreservationReport;
declare function createNaturalnessReport(input: {
    beforeDraft: string;
    afterDraft: string;
    state: AutonomousNovelState;
    task: AutonomousNovelState["plan"]["chapterTasks"][number];
    continuityContract: ContinuityContract;
    characterProfileContract: CharacterProfileContract;
}): NaturalnessReport;
declare function evaluatePlotContinuityBridge(finalDraft: string, task: AutonomousNovelState["plan"]["chapterTasks"][number], continuityContract: ContinuityContract): {
    status: "eligible";
    reason: string;
    matchedAnchors: string[];
    requiredAnchors: string[];
} | {
    status: "quarantined";
    reason: string;
    matchedAnchors: string[];
    requiredAnchors: string[];
};
declare class CacheTracker {
    hits: number;
    misses: number;
}
declare const memoryCacheTracker: CacheTracker;
declare const resourcesCacheTracker: CacheTracker;
declare function invalidateAllCaches(): void;
declare function invalidateProjectCache(projectId: string, chapterNumber?: number): void;
declare function invalidateWritingResourcesCache(): void;
declare function retrieveFactoryMemoryContext(input: {
    state: AutonomousNovelState;
    task: AutonomousNovelState["plan"]["chapterTasks"][number];
    options: ProductionPipelineOptions;
    continuityContract: ContinuityContract;
    limit?: number;
}): Promise<string>;
declare function loadProductionStoryAssetContext(paths: NovelWorkspacePaths, task: AutonomousNovelState["plan"]["chapterTasks"][number], maxChars?: number): Promise<ProductionStoryAssetContext>;
declare function createProductionStoryBibleAssets(state: AutonomousNovelState, context: {
    consensus: string;
    protagonist: string;
    style: string;
}, resources: ProductionWritingResources, planningContext?: ProductionPlanningStoryContext): ProductionStoryBibleAsset[];
declare function createProductionWritingPlanContract(state: AutonomousNovelState): WritingPlanContract;
declare function writeProductionWritingPlan(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, options?: ProductionPipelineOptions): Promise<string>;
declare function sanitizeKnownCastNames(names?: string[], limit?: number): string[];
declare function evaluateSceneCardCharacterObligations(draft: string, blueprint?: string, continuityContract?: ContinuityContract): {
    status: "eligible";
    reason: string;
    cardAudits: {
        index: number;
        requiredCharacters: string[];
        missingCharacters: string[];
        requiredFacts: string[];
        missingFacts: string[];
        executionAudits: {
            label: string;
            terms: string[];
            matchedTerms: string[];
            hasEvidence: boolean;
        }[];
    }[];
} | {
    status: "quarantined";
    reason: string;
    cardAudits: {
        index: number;
        requiredCharacters: string[];
        missingCharacters: string[];
        requiredFacts: string[];
        missingFacts: string[];
        executionAudits: {
            label: string;
            terms: string[];
            matchedTerms: string[];
            hasEvidence: boolean;
        }[];
    }[];
};
declare function evaluateCharacterProfilePresence(draft: string, contract: CharacterProfileContract): {
    status: "quarantined";
    reason: string;
    missing: string[];
    knownNameHits: string[];
} | {
    status: "eligible";
    reason: string;
    missing: string[];
    knownNameHits: string[];
};
declare function createContinuityContract(input: {
    state: AutonomousNovelState;
    task: AutonomousNovelState["plan"]["chapterTasks"][number];
    context?: {
        consensus?: string;
        protagonist?: string;
        style?: string;
    };
    protagonistProfile?: string;
    blueprint?: string;
    previousMemory?: string;
    previousFinalDraft?: string;
}): ContinuityContract;
declare function loadProductionWritingResources(rootDir: string): Promise<ProductionWritingResources>;
declare function writeProductionWritingResourceArtifacts(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, options?: ProductionPipelineOptions): Promise<{
    resources: ProductionWritingResources;
    guidePath: string;
}>;
declare function createProductionMasterOutline(state: AutonomousNovelState, context: {
    consensus: string;
    protagonist: string;
    style: string;
}, resources: ProductionWritingResources): string;
declare function createDetailedChapterBlueprint(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], context: {
    consensus: string;
    protagonist: string;
    style: string;
}, resources: ProductionWritingResources, continuityContract?: ContinuityContract, storyAssetContext?: ProductionStoryAssetContext): string;
declare function createDraftBodyFromBlueprint(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], blueprint: string, resources: ProductionWritingResources, continuityContract?: ContinuityContract): string;
interface GlobalContextResult {
    prunedConsensus: string;
    prunedOutline: string;
    prunedStoryAssets: string;
    activeWorldSlice: string;
    prunedRag: string;
    prunedMemory: string;
    prunedLedger: string;
    previousDraftFragment: string;
}
declare function loadAndPruneGlobalContext(params: {
    state: AutonomousNovelState;
    task: AutonomousNovelState["plan"]["chapterTasks"][number];
    blueprint: string;
    resources: ProductionWritingResources;
    options: ProductionPipelineOptions;
    continuityContract: ContinuityContract;
    paths?: NovelWorkspacePaths;
    projectRoot?: string;
    knowledgeContext?: {
        prompt: string;
        rows: Array<Record<string, unknown>>;
    };
    additionalFixedLength?: number;
}): Promise<GlobalContextResult>;
declare function createDraftSegmentPlan(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], continuityContract?: ContinuityContract, blueprint?: string): DraftSegmentPlan[];
declare function createDraftSegmentCompositionPlan(segment: DraftSegmentPlan, continuityContract: ContinuityContract): DraftSegmentCompositionPlan;
declare function createDraftBody(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], blueprint: string, resources: ProductionWritingResources, options: ProductionPipelineOptions, continuityContract?: ContinuityContract, paths?: NovelWorkspacePaths, projectRoot?: string, characterDossiers?: CharacterDossier[], approvedStyleContext?: ApprovedWritingStyleContext): Promise<string>;
declare function repairAigcHighRiskDraft(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], finalDraft: string, aigcReport: AigcWritingDetectionReport, resources: ProductionWritingResources, options: ProductionPipelineOptions, continuityContract: ContinuityContract, characterDossiers?: CharacterDossier[]): Promise<string>;
declare function createQualityReport(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], draft: string, blueprint: string, continuityContract?: ContinuityContract, characterDossiers?: CharacterDossier[]): string;
declare function runQualityGateWithRevisions(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], initialDraft: string, blueprint: string, resources: ProductionWritingResources, options: ProductionPipelineOptions, continuityContract?: ContinuityContract, paths?: NovelWorkspacePaths, projectRoot?: string, characterDossiers?: CharacterDossier[], approvedStyleContext?: ApprovedWritingStyleContext): Promise<{
    draft: string;
    report: string;
    gate: QualityGateResult;
}>;
declare function normalizeAigcWritingDetectionReport(result: AigcBatchDetectionResult): AigcWritingDetectionReport;
declare function skippedAigcWritingDetectionReport(reason: string): AigcWritingDetectionReport;
declare function runAigcWritingDetection(finalDraft: string, options: ProductionPipelineOptions): Promise<AigcWritingDetectionReport>;
declare function writeProductionMasterOutline(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, context: {
    consensus: string;
    protagonist: string;
    style: string;
}, options?: ProductionPipelineOptions): Promise<string>;
declare function writeProductionStoryBibleAssets(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, context: {
    consensus: string;
    protagonist: string;
    style: string;
}, options?: ProductionPipelineOptions): Promise<string[]>;
declare function writeAllDetailedChapterBlueprints(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, context: {
    consensus: string;
    protagonist: string;
    style: string;
}, options?: ProductionPipelineOptions): Promise<string[]>;
interface PreparedChapterProductionInputs {
    writingMode: ProductionWritingMode;
    resources: ProductionWritingResources;
    approvedStyleContext: ApprovedWritingStyleContext;
    approvedStyleCarryover: string;
    protagonistProfile: string;
    characterDossiers: CharacterDossier[];
    chapterId: string;
    previousMemory: string;
    previousFinalDraft: string;
    blueprintPath: string;
    context: {
        consensus: string;
        protagonist: string;
        style: string;
    };
    blueprint: string;
    continuityContract: ContinuityContract;
}
interface ChapterQualityStageResult {
    draft: string;
    report: string;
    gate: QualityGateResult;
}
interface ChapterNaturalnessStageResult extends ChapterQualityStageResult {
    finalDraft: string;
    finalGate: QualityGateResult;
    aigcDetection: AigcWritingDetectionReport;
    writingMode: ProductionWritingMode;
}
/**
 * Prepares the exact inputs consumed by draft and quality production without
 * generating prose. Fine-grained workflow nodes use this boundary while the
 * legacy full chapter pipeline remains behaviorally unchanged.
 */
declare function prepareChapterProductionInputs(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], options?: ProductionPipelineOptions): Promise<PreparedChapterProductionInputs>;
/**
 * Runs the production polish, AIGC review and final naturalness gate from a
 * durable quality checkpoint. It deliberately performs no chapter/memory
 * commit so a workflow may inspect or retry the result before promotion.
 */
declare function runChapterNaturalnessStage(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], quality: ChapterQualityStageResult, prepared: PreparedChapterProductionInputs, options?: ProductionPipelineOptions): Promise<ChapterNaturalnessStageResult>;
interface ChapterProductionCommitResult {
    draftPath: string;
    reviewedPath: string;
    finalPath: string;
    versionManifestPath: string;
    reportPath: string;
    memoryPath: string;
    wordCount: number;
    qualityGate: QualityGateResult;
    writingMode: ProductionWritingMode;
}
/** Commits a previously inspected naturalness checkpoint to chapter and memory artifacts. */
declare function commitChapterProductionStage(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], prepared: PreparedChapterProductionInputs, naturalness: ChapterNaturalnessStageResult, options?: ProductionPipelineOptions): Promise<ChapterProductionCommitResult>;
declare function runChapterProductionPipeline(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], options?: ProductionPipelineOptions): Promise<ChapterProductionCommitResult>;

export { type AigcWritingDetectionReport, type ApprovedWritingStyleContext, type ChapterContextPackageInfo, type ChapterInheritanceAdapterPayload, type ChapterNaturalnessStageResult, type ChapterProductionCommitResult, type ChapterQualityStageResult, type CharacterProfileContract, type ContinuityContract, type DraftSceneCard, type DraftSegmentArtifactInfo, type DraftSegmentAssemblyUsage, type DraftSegmentCompositionPlan, type DraftSegmentPlan, type DraftSegmentSubArtifactInfo, type NaturalnessReport, type NovelWorkspacePaths, type PreparedChapterProductionInputs, type ProductionPipelineOptions, ProductionPlanningBlockedError, type ProductionPlanningStoryContext, ProductionReadinessBlockedError, type ProductionStoryAssetContext, type ProductionStoryBibleAsset, type ProductionWritingMode, type ProductionWritingResources, type QualityGateResult, type SemanticPreservationReport, type StyleConformanceDriftReport, type WritingArtifactRef, type WritingKnowledgeReference, type WritingLlmTrace, type WritingProgressEvent, type WritingToolTrace, type WritingWorkflowTrace, buildChapterInheritanceAdapterPayload, commitChapterProductionStage, compactPreviousSegmentTail, createContinuityContract, createDetailedChapterBlueprint, createDraftBody, createDraftBodyFromBlueprint, createDraftSegmentCompositionPlan, createDraftSegmentPlan, createNaturalnessReport, createProductionMasterOutline, createProductionStoryBibleAssets, createProductionWritingPlanContract, createQualityReport, evaluateChapterStyleConformanceDrift, evaluateCharacterProfilePresence, evaluateNarrativeStyleQuality, evaluatePlotContinuityBridge, evaluateSceneCardCharacterObligations, evaluateSemanticPreservation, evaluateUnplannedCharacterDrift, evaluateWritingResourceUsage, formatApprovedWritingStylePrompt, inferGenreProfile, invalidateAllCaches, invalidateProjectCache, invalidateWritingResourcesCache, loadAndPruneGlobalContext, loadApprovedWritingStyleContext, loadProductionStoryAssetContext, loadProductionWritingResources, memoryCacheTracker, normalizeAigcWritingDetectionReport, parseQualityGate, prepareChapterProductionInputs, repairAigcHighRiskDraft, resourcesCacheTracker, retrieveFactoryMemoryContext, runAigcWritingDetection, runChapterNaturalnessStage, runChapterProductionPipeline, runQualityGateWithRevisions, sanitizeKnownCastNames, skippedAigcWritingDetectionReport, writeAllDetailedChapterBlueprints, writeProductionMasterOutline, writeProductionStoryBibleAssets, writeProductionWritingPlan, writeProductionWritingResourceArtifacts };
