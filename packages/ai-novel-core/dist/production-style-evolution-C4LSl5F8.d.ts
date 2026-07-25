import { A as AutonomousNovelState, N as NovelStage } from './cli-types-3z9cP1VA.js';
import { S as StyleEvolutionContract, e as evaluateStyleEvolutionGate, d as ProductionGateResult } from './production-contracts-C1il9ao8.js';
import { AigcBatchDetectionResult } from './aigc-detector.js';

type ProjectWorkflowStage = NovelStage | "empty" | "unknown";
type ProjectProductionStatus = "not_started" | "worldbuilding" | "planning" | "ready_to_draft" | "drafting" | "reviewing" | "replanning" | "blocked" | "complete" | "unknown";
type ProjectExecutionStatus = "idle" | "running" | "paused" | "queued" | "blocked" | "stopping" | "unknown";
type ProjectPrimaryAction = "start" | "continue" | "resume" | "pause" | "retry_blocked" | "review" | "none";
type ProjectNextTarget = {
    type: "chapter";
    chapterNumber: number;
} | {
    type: "stage";
    stage: ProjectWorkflowStage;
} | {
    type: "project";
} | null;
interface ProjectChapterProgress {
    totalChapters: number;
    completedChapters: number;
    passedChapters: number;
    contiguousCompletedChapters: number;
    pendingChapters: number;
    inProgressChapters: number;
    blockedChapters: number;
    nextChapterNumber: number | null;
    progressPercent: number;
}
interface ProjectRuntimeState {
    workflowStage: ProjectWorkflowStage;
    rawWorkflowStage: string;
    productionStatus: ProjectProductionStatus;
    executionStatus: ProjectExecutionStatus;
    primaryAction: ProjectPrimaryAction;
    primaryActionLabel: string;
    nextTarget: ProjectNextTarget;
    reason: string;
    chapterProgress: ProjectChapterProgress;
    runningJobs: number;
    recoverableJobs: number;
    runnableJobs: number;
    activeJobs: number;
    updatedAt: string;
}
interface DeriveProjectRuntimeStateInput {
    state?: AutonomousNovelState | Record<string, any> | null;
    factorySnapshot?: Record<string, any> | null;
    now?: Date | string;
}
declare function deriveProjectRuntimeState(input?: DeriveProjectRuntimeStateInput): ProjectRuntimeState;

interface StyleEvolutionAssetPaths {
    dir: string;
    samplesDir: string;
    seedPrompt: string;
    userStylePrompt: string;
    referenceText: string;
    history: string;
    styleContract: string;
    approvedSample: string;
    freezeLedger: string;
    loopRuntime: string;
    loopRuns: string;
}
interface StyleLoopRuntimeIterationRecord {
    iteration: number;
    version?: number;
    startedAt: string;
    completedAt?: string;
    seedPrompt?: string;
    prompt: string;
    sampleExcerpt?: string;
    evaluationSource?: "heuristic" | "llm_critic";
    refinementSource?: "heuristic" | "llm_critic";
    freezerSource?: "heuristic" | "llm_critic";
    llmFallbackUsed?: boolean;
    fallbackReasons?: string[];
    verdict?: "retry" | "candidate" | "approve";
    overallScore?: number;
    forbiddenHits?: string[];
    nextPrompt?: string;
    contractAdjustments?: string[];
    stage?: "generated" | "evaluated" | "refined" | "persisted";
    candidateCount?: number;
    candidateIndex?: number;
    candidateScores?: Array<{
        candidateIndex: number;
        overallScore?: number;
        verdict?: "retry" | "candidate" | "approve";
        source?: "heuristic" | "llm_critic";
        verificationStatus?: "pending" | "passed" | "blocked" | "warning";
        aigcHighRiskCount?: number;
        forbiddenHitCount?: number;
        llmFallbackUsed?: boolean;
    }>;
    candidates?: Array<{
        candidateIndex: number;
        persistedVersion?: number;
        sample: string;
        evaluation: StyleEvolutionEvaluation;
        refinement: StyleEvolutionRefinement;
        verification: StyleGenerationVerification;
        freezer?: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]["freezer"];
        llmFallbackUsed?: boolean;
        fallbackReasons?: string[];
    }>;
    winningReason?: string;
    verificationStatus?: "pending" | "passed" | "blocked" | "warning";
    verificationSummary?: string;
    verificationReasons?: string[];
    freezerVerdict?: "block" | "continue" | "ready";
    freezerSummary?: string;
    freezerBlockingReasons?: string[];
    aigcRiskScore?: number | null;
    aigcThreshold?: number | null;
    aigcHighRiskCount?: number;
    forbiddenHitCount?: number;
}
interface StyleLoopRuntimeRecord {
    version: 1;
    runId: string;
    engine: "Style Evolution Engine";
    runtime: "Prompt Loop Runtime";
    gate: "Style Contract Freeze Gate";
    verificationGate: "Generation Verification Gate";
    status: "running" | "completed";
    startedAt: string;
    completedAt?: string;
    stopReason?: "max_iterations_reached" | "ready_for_approval" | "stable_candidate" | "style_candidates_all_blocked" | "manual_stop";
    requestedIterations: number;
    completedIterations: number;
    projectTitle?: string;
    idea?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    iterationFeedback?: string;
    finalVersion?: number;
    finalLoopStatus?: NonNullable<StyleEvolutionContract["loop"]>["status"];
    finalConvergence?: NonNullable<StyleEvolutionContract["loop"]>["convergence"];
    iterations: StyleLoopRuntimeIterationRecord[];
}
interface StyleFreezeLedgerEntry {
    version: number;
    createdAt?: string;
    samplePath?: string;
    source?: "manual" | "loop";
    evaluationSource?: "heuristic" | "llm_critic";
    refinementSource?: "heuristic" | "llm_critic";
    verdict?: "retry" | "candidate" | "approve";
    overallScore?: number;
    readyForApproval?: boolean;
    stableCandidate?: boolean;
    stableRounds?: number;
    readyReasons?: string[];
    stabilityReasons?: string[];
    convergenceNote?: string;
    contractTightening?: string[];
    rejectionReason?: string;
    userDecision?: "pending" | "accepted_for_freeze" | "accepted" | "superseded";
    userDecisionAt?: string;
    verificationStatus?: "pending" | "passed" | "blocked" | "warning";
    verificationSummary?: string;
    verificationReasons?: string[];
    freezerVerdict?: "block" | "continue" | "ready";
    freezerSummary?: string;
    freezerBlockingReasons?: string[];
    llmFallbackUsed?: boolean;
    fallbackReasons?: string[];
    aigcRiskScore?: number | null;
    aigcThreshold?: number | null;
    aigcHighRiskCount?: number;
    forbiddenHitCount?: number;
}
interface StyleFreezeLedger {
    version: 1;
    generatedAt: string;
    latestVersion: number;
    stableVersion?: number;
    readyVersion?: number;
    approvalVersion?: number;
    approvalStatus?: "pending" | "approved" | "rejected";
    freezeSummary?: string;
    inheritedArtifacts?: string[];
    inheritedRules?: string[];
    convergence?: "unknown" | "exploring" | "improving" | "stable" | "ready";
    convergenceEvidence: string[];
    verificationGate: "Generation Verification Gate";
    verificationStatus?: "pending" | "passed" | "blocked" | "warning";
    verificationVersion?: number;
    verificationSummary?: string;
    verificationReasons?: string[];
    entries: StyleFreezeLedgerEntry[];
}
interface StyleEvolutionSnapshot {
    paths: StyleEvolutionAssetPaths;
    contract: StyleEvolutionContract;
    gate: ReturnType<typeof evaluateStyleEvolutionGate>;
    freezeLedger: StyleFreezeLedger;
    loopRuntime: StyleLoopRuntimeRecord | null;
}
interface InitializeStyleEvolutionOptions {
    projectTitle?: string;
    idea?: string;
    seedPrompt?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    overwrite?: boolean;
}
interface StyleEvolutionCandidateInput {
    prompt: string;
    sample: string;
    review?: string;
    createdAt?: string;
    iterationFeedback?: string;
    source?: "manual" | "loop";
    evaluation?: StyleEvolutionEvaluation;
    refinement?: StyleEvolutionRefinement;
    freezer?: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]["freezer"];
    llmFallbackUsed?: boolean;
    fallbackReasons?: string[];
}
interface StyleEvolutionCandidatePromptInput {
    projectTitle?: string;
    idea?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    seedPrompt?: string;
    priorSample?: string;
    iterationFeedback?: string;
}
interface StyleEvolutionCandidatePrompt {
    system: string;
    user: string;
    prompt: string;
}
interface StyleEvolutionEvaluationScores {
    narrativeVoice: number;
    sentenceRhythm: number;
    dialogueTexture: number;
    informationDensity: number;
    emotionalTension: number;
    readability: number;
    requirementAlignment: number;
    forbiddenPatternRisk: number;
    overall: number;
}
interface StyleEvolutionEvaluation {
    source?: "heuristic" | "llm_critic";
    verdict: "retry" | "candidate" | "approve";
    summary: string;
    scores: StyleEvolutionEvaluationScores;
    aigc?: {
        enabled: boolean;
        status: "passed" | "blocked" | "unavailable";
        provider?: string;
        urlConfigured?: boolean;
        diagnostics?: string[];
        score: number | null;
        threshold: number | null;
        highRiskCount: number;
        reason: string;
        highRiskPreviews: string[];
    };
    strengths: string[];
    deviations: string[];
    forbiddenHits: string[];
    nextFocus: string[];
}
interface StyleEvolutionRefinement {
    source?: "heuristic" | "llm_critic";
    summary: string;
    promptAdjustments: string[];
    contractAdjustments: string[];
    nextPrompt: string;
}
interface StyleGenerationVerification {
    gate: "Generation Verification Gate";
    status: "pending" | "passed" | "blocked" | "warning";
    summary: string;
    reasons: string[];
    score: number | null;
    threshold: number | null;
    highRiskCount: number;
    forbiddenHitCount: number;
    highRiskPreviews: string[];
    version?: number;
    checkedAt?: string;
}
interface StyleEvolutionEvaluationPromptInput {
    projectTitle?: string;
    idea?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    prompt?: string;
    sample: string;
    priorSample?: string;
    iterationFeedback?: string;
}
interface StyleEvolutionEvaluationPrompt {
    system: string;
    user: string;
}
interface StyleEvolutionRefinementPromptInput extends StyleEvolutionEvaluationPromptInput {
    evaluation: StyleEvolutionEvaluation;
}
interface StyleEvolutionRefinementPrompt {
    system: string;
    user: string;
}
interface ParsedStyleEvolutionCritique {
    evaluation: StyleEvolutionEvaluation;
    refinement: StyleEvolutionRefinement;
}
interface ParsedStyleEvolutionEvaluation {
    evaluation: StyleEvolutionEvaluation;
}
interface ParsedStyleEvolutionRefinementOnly {
    refinement: StyleEvolutionRefinement;
}
interface ParsedStyleEvolutionFreezeAdvice {
    freezeVerdict: "block" | "continue" | "ready";
    freezeSummary: string;
    blockingReasons: string[];
    contractAdjustments: string[];
    forbiddenPatterns: string[];
    positiveExamples: string[];
    inheritedRules: string[];
}
interface StyleContractExtractionPromptInput {
    sample: string;
    prompt?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
}
interface StyleContractExtractionPrompt {
    system: string;
    user: string;
}
interface StyleFreezeAdvicePromptInput {
    sample: string;
    prompt?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    evaluation?: StyleEvolutionEvaluation;
    refinement?: StyleEvolutionRefinement;
}
interface StyleFreezeAdvicePrompt {
    system: string;
    user: string;
}
interface ApproveStyleEvolutionInput {
    version?: number;
    sample?: string;
    approvedAt?: string;
    styleContract?: NonNullable<StyleEvolutionContract["styleContract"]>;
    antiPatterns?: string[];
    frozenBasePrompt?: string;
    freezeSummary?: string;
    positiveExamples?: string[];
    inheritedRules?: string[];
    approvedBy?: "user" | "system";
    freezer?: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]["freezer"];
}
interface AcceptStyleEvolutionCandidateInput {
    version?: number;
    acceptedAt?: string;
    acceptedBy?: "user" | "system";
}
interface RejectStyleEvolutionInput {
    version?: number;
    rejectedAt?: string;
    rejectionReason: string;
}
declare function evaluateStyleEvolutionCandidate(input: {
    prompt: string;
    sample: string;
    userStylePrompt?: string;
    iterationFeedback?: string;
    aigc?: StyleEvolutionEvaluation["aigc"];
}): StyleEvolutionEvaluation;
declare function normalizeStyleAigcSignal(result: AigcBatchDetectionResult, diagnostics?: {
    urlConfigured?: boolean;
    error?: unknown;
    context?: string;
}): NonNullable<StyleEvolutionEvaluation["aigc"]>;
declare function buildStyleGenerationVerification(input: {
    evaluation?: StyleEvolutionEvaluation;
    sample?: string;
    version?: number;
    checkedAt?: string;
}): StyleGenerationVerification;
declare function buildStyleEvolutionRefinement(input: {
    prompt: string;
    userStylePrompt?: string;
    evaluation: StyleEvolutionEvaluation;
    iterationFeedback?: string;
}): StyleEvolutionRefinement;
declare function materializeApprovedStyleAssets(projectRoot: string, contract: StyleEvolutionContract): Promise<void>;
declare function persistStyleEvolutionRuntimeState(projectRoot: string, runtime: NonNullable<StyleEvolutionContract["runtime"]>): Promise<StyleEvolutionContract>;
declare function createStyleLoopRuntimeRecord(input: {
    projectTitle?: string;
    idea?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    iterationFeedback?: string;
    requestedIterations: number;
}): StyleLoopRuntimeRecord;
declare function persistStyleLoopRuntime(projectRoot: string, runtime: StyleLoopRuntimeRecord): Promise<StyleLoopRuntimeRecord>;
declare function appendStyleLoopRunLedger(projectRoot: string, runtime: StyleLoopRuntimeRecord): Promise<{
    recordedAt: string;
    runId: string;
    status: "completed" | "running";
    stopReason: "max_iterations_reached" | "ready_for_approval" | "stable_candidate" | "style_candidates_all_blocked" | "manual_stop" | undefined;
    startedAt: string;
    completedAt: string | undefined;
    requestedIterations: number;
    completedIterations: number;
    finalVersion: number | undefined;
    finalLoopStatus: "idle" | "running" | "approved" | "ready_for_approval" | "stable_candidate" | "awaiting_user" | undefined;
    finalConvergence: "unknown" | "ready" | "exploring" | "improving" | "stable" | undefined;
    verificationGate: "Generation Verification Gate";
    iterations: {
        iteration: number;
        version: number | undefined;
        completedAt: string | undefined;
        stage: "generated" | "evaluated" | "refined" | "persisted" | undefined;
        candidateCount: number | undefined;
        candidateIndex: number | undefined;
        candidateScores: {
            candidateIndex: number;
            overallScore?: number;
            verdict?: "retry" | "candidate" | "approve";
            source?: "heuristic" | "llm_critic";
            verificationStatus?: "pending" | "passed" | "blocked" | "warning";
            aigcHighRiskCount?: number;
            forbiddenHitCount?: number;
            llmFallbackUsed?: boolean;
        }[] | undefined;
        winningReason: string | undefined;
        verificationStatus: "pending" | "blocked" | "passed" | "warning" | undefined;
        verificationSummary: string | undefined;
        verificationReasons: string[] | undefined;
        freezerVerdict: "ready" | "block" | "continue" | undefined;
        freezerSummary: string | undefined;
        freezerBlockingReasons: string[] | undefined;
        aigcRiskScore: number | null | undefined;
        aigcThreshold: number | null | undefined;
        aigcHighRiskCount: number | undefined;
        forbiddenHitCount: number | undefined;
        candidates: {
            candidateIndex: number;
            persistedVersion: number | undefined;
            sampleExcerpt: string;
            verdict: "retry" | "candidate" | "approve";
            overallScore: number;
            evaluationSummary: string;
            verification: StyleGenerationVerification;
            freezer: {
                source?: "heuristic" | "llm_critic";
                verdict?: "block" | "continue" | "ready";
                summary?: string;
                blockingReasons?: string[];
                checkedAt?: string;
            } | undefined;
            refinementSummary: string;
        }[];
    }[];
}>;
declare function validateStyleContractForFreeze(contract: StyleEvolutionContract): ProductionGateResult;
declare function parseStyleEvolutionCritiqueFromText(value: string): ParsedStyleEvolutionCritique | null;
declare function parseStyleEvolutionEvaluationFromText(value: string): ParsedStyleEvolutionEvaluation | null;
declare function parseStyleEvolutionRefinementFromText(value: string): ParsedStyleEvolutionRefinementOnly | null;
declare function parseStyleFreezeAdviceFromText(value: string): ParsedStyleEvolutionFreezeAdvice | null;
declare function parseStyleContractFromText(value: string): NonNullable<StyleEvolutionContract["styleContract"]> | null;
declare function buildStyleContractExtractionPrompt(input: StyleContractExtractionPromptInput): StyleContractExtractionPrompt;
declare function buildStyleFreezeAdvicePrompt(input: StyleFreezeAdvicePromptInput): StyleFreezeAdvicePrompt;
declare function buildStyleEvolutionCritiquePrompt(input: {
    projectTitle?: string;
    idea?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    prompt: string;
    sample: string;
    priorSample?: string;
    iterationFeedback?: string;
}): StyleEvolutionRefinementPrompt;
declare function buildStyleEvolutionEvaluationPrompt(input: {
    projectTitle?: string;
    idea?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    prompt: string;
    sample: string;
    priorSample?: string;
    iterationFeedback?: string;
}): StyleEvolutionRefinementPrompt;
declare function buildStyleEvolutionRefinementOnlyPrompt(input: {
    projectTitle?: string;
    idea?: string;
    userStylePrompt?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    prompt: string;
    sample: string;
    evaluation: StyleEvolutionEvaluation;
    iterationFeedback?: string;
}): StyleEvolutionRefinementPrompt;
declare function buildStyleEvolutionCandidatePrompt(input: StyleEvolutionCandidatePromptInput): StyleEvolutionCandidatePrompt;
declare function getStyleEvolutionAssetPaths(projectRoot: string): StyleEvolutionAssetPaths;
declare function initializeStyleEvolution(projectRoot: string, options?: InitializeStyleEvolutionOptions): Promise<StyleEvolutionSnapshot>;
declare function appendStyleEvolutionCandidate(projectRoot: string, input: StyleEvolutionCandidateInput): Promise<StyleEvolutionSnapshot>;
declare function approveStyleEvolutionSample(projectRoot: string, input: ApproveStyleEvolutionInput): Promise<StyleEvolutionSnapshot>;
declare function acceptStyleEvolutionCandidate(projectRoot: string, input: AcceptStyleEvolutionCandidateInput): Promise<StyleEvolutionSnapshot>;
declare function rejectStyleEvolutionSample(projectRoot: string, input: RejectStyleEvolutionInput): Promise<StyleEvolutionSnapshot>;
declare function loadStyleEvolution(projectRoot: string): Promise<StyleEvolutionSnapshot>;

export { initializeStyleEvolution as $, type AcceptStyleEvolutionCandidateInput as A, type StyleFreezeAdvicePrompt as B, type StyleFreezeAdvicePromptInput as C, type DeriveProjectRuntimeStateInput as D, type StyleFreezeLedger as E, type StyleFreezeLedgerEntry as F, type StyleLoopRuntimeRecord as G, acceptStyleEvolutionCandidate as H, type InitializeStyleEvolutionOptions as I, appendStyleEvolutionCandidate as J, appendStyleLoopRunLedger as K, approveStyleEvolutionSample as L, buildStyleContractExtractionPrompt as M, buildStyleEvolutionCandidatePrompt as N, buildStyleEvolutionCritiquePrompt as O, type ProjectRuntimeState as P, buildStyleEvolutionEvaluationPrompt as Q, type RejectStyleEvolutionInput as R, type StyleEvolutionSnapshot as S, buildStyleEvolutionRefinement as T, buildStyleEvolutionRefinementOnlyPrompt as U, buildStyleFreezeAdvicePrompt as V, buildStyleGenerationVerification as W, createStyleLoopRuntimeRecord as X, deriveProjectRuntimeState as Y, evaluateStyleEvolutionCandidate as Z, getStyleEvolutionAssetPaths as _, type StyleLoopRuntimeIterationRecord as a, loadStyleEvolution as a0, materializeApprovedStyleAssets as a1, normalizeStyleAigcSignal as a2, parseStyleContractFromText as a3, parseStyleEvolutionCritiqueFromText as a4, parseStyleEvolutionEvaluationFromText as a5, parseStyleEvolutionRefinementFromText as a6, parseStyleFreezeAdviceFromText as a7, persistStyleEvolutionRuntimeState as a8, persistStyleLoopRuntime as a9, rejectStyleEvolutionSample as aa, validateStyleContractForFreeze as ab, type StyleEvolutionEvaluation as b, type StyleEvolutionRefinement as c, type StyleGenerationVerification as d, type ApproveStyleEvolutionInput as e, type ParsedStyleEvolutionCritique as f, type ParsedStyleEvolutionEvaluation as g, type ParsedStyleEvolutionFreezeAdvice as h, type ParsedStyleEvolutionRefinementOnly as i, type ProjectChapterProgress as j, type ProjectExecutionStatus as k, type ProjectNextTarget as l, type ProjectPrimaryAction as m, type ProjectProductionStatus as n, type ProjectWorkflowStage as o, type StyleContractExtractionPrompt as p, type StyleContractExtractionPromptInput as q, type StyleEvolutionAssetPaths as r, type StyleEvolutionCandidateInput as s, type StyleEvolutionCandidatePrompt as t, type StyleEvolutionCandidatePromptInput as u, type StyleEvolutionEvaluationPrompt as v, type StyleEvolutionEvaluationPromptInput as w, type StyleEvolutionEvaluationScores as x, type StyleEvolutionRefinementPrompt as y, type StyleEvolutionRefinementPromptInput as z };
