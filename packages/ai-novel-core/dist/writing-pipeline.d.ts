import { A as AutonomousNovelState } from './cli-types-B17O02vG.js';

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
}
type ProductionWritingMode = "fast" | "quality";
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
    preview?: string;
    streamText?: string;
    wordCount?: number;
    qualityGate?: QualityGateResult;
    knowledgeReferences?: WritingKnowledgeReference[];
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
}
interface NaturalnessReport {
    status: "passed" | "needs_revision" | "blocked";
    score: number;
    reason: string;
    changedBlocks: number;
    riskFlags: string[];
    preservedFacts: string[];
    patchSummary: string[];
}
declare function parseQualityGate(report: string, attempts?: number, maxAttempts?: number): QualityGateResult;
declare function inferGenreProfile(state: AutonomousNovelState): {
    narration: string;
    naturalnessTarget: "light" | "balanced" | "strict";
    readerPromise: string;
    pointOfView: string;
    tone: string;
    genre: string;
    vocabularyScenes: string[];
};
declare function evaluateNarrativeStyleQuality(text?: string): {
    status: "quarantined";
    reason: string;
    fragments: string[];
} | {
    status: "eligible";
    reason: string;
    fragments: string[];
};
declare function evaluateWritingResourceUsage(text?: string, state?: AutonomousNovelState, task?: AutonomousNovelState["plan"]["chapterTasks"][number], blueprint?: string, continuityContract?: ContinuityContract): {
    status: "quarantined";
    reason: string;
    matchedTerms: string[];
} | {
    status: "eligible";
    reason: string;
    matchedTerms: string[];
};
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
declare function retrieveFactoryMemoryContext(input: {
    state: AutonomousNovelState;
    task: AutonomousNovelState["plan"]["chapterTasks"][number];
    options: ProductionPipelineOptions;
    continuityContract: ContinuityContract;
    limit?: number;
}): Promise<string>;
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
}, resources: ProductionWritingResources, continuityContract?: ContinuityContract): string;
declare function createDraftBodyFromBlueprint(state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], blueprint: string, resources: ProductionWritingResources, continuityContract?: ContinuityContract): string;
declare function writeProductionMasterOutline(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, context: {
    consensus: string;
    protagonist: string;
    style: string;
}, options?: ProductionPipelineOptions): Promise<string>;
declare function writeAllDetailedChapterBlueprints(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, context: {
    consensus: string;
    protagonist: string;
    style: string;
}, options?: ProductionPipelineOptions): Promise<string[]>;
declare function runChapterProductionPipeline(projectRoot: string, paths: NovelWorkspacePaths, state: AutonomousNovelState, task: AutonomousNovelState["plan"]["chapterTasks"][number], options?: ProductionPipelineOptions): Promise<{
    draftPath: string;
    reviewedPath: string;
    finalPath: string;
    reportPath: string;
    memoryPath: string;
    wordCount: number;
    qualityGate: {
        reason: string;
        wordCount: number;
        targetWords: number;
        passed: boolean;
        score: number;
        status: "passed" | "needs_revision" | "blocked";
        attempts: number;
    };
    writingMode: ProductionWritingMode;
}>;

export { type CharacterProfileContract, type ContinuityContract, type NaturalnessReport, type NovelWorkspacePaths, type ProductionPipelineOptions, type ProductionWritingMode, type ProductionWritingResources, type QualityGateResult, type WritingKnowledgeReference, type WritingProgressEvent, createContinuityContract, createDetailedChapterBlueprint, createDraftBodyFromBlueprint, createProductionMasterOutline, evaluateCharacterProfilePresence, evaluateNarrativeStyleQuality, evaluatePlotContinuityBridge, evaluateWritingResourceUsage, inferGenreProfile, loadProductionWritingResources, parseQualityGate, retrieveFactoryMemoryContext, runChapterProductionPipeline, writeAllDetailedChapterBlueprints, writeProductionMasterOutline, writeProductionWritingResourceArtifacts };
