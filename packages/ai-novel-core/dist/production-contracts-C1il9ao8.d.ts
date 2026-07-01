type ProductionPhase = "phase_0_init" | "phase_1_concept_dialogue" | "phase_2_core_seed" | "phase_3_character_dynamics" | "phase_4_initial_character_state" | "phase_5_world_matrix" | "phase_6_plot_architecture" | "phase_7_story_bible" | "phase_8_volume_strategy" | "phase_9_chapter_blueprints" | "phase_10_writing_plan" | "phase_11_style_evolution" | "phase_12_style_approval" | "phase_13_chapter_execution" | "phase_14_quality_repair" | "phase_15_finalize_complete";
type ProductionGateStatus = "passed" | "blocked" | "warning";
interface ProductionGateIssue {
    code: string;
    severity: "critical" | "warning" | "info";
    message: string;
    recoveryHint: string;
}
interface ProductionGateResult {
    status: ProductionGateStatus;
    canProceed: boolean;
    blockedReason: string | null;
    issues: ProductionGateIssue[];
}
interface ProductionReadinessItem {
    key: string;
    label: string;
    status: ProductionGateStatus;
    detail: string;
    issueCodes: string[];
    recoveryHint: string;
}
interface ProductionReadinessAsset {
    key: string;
    label: string;
    path: string;
    status: ProductionGateStatus;
    detail: string;
}
interface ProductionReadinessGroup {
    key: string;
    label: string;
    status: ProductionGateStatus;
    summary: string;
    assets: ProductionReadinessAsset[];
}
interface ProductionReadinessSnapshot {
    status: ProductionGateStatus;
    canProceed: boolean;
    score: number;
    summary: string;
    blockedReason: string | null;
    items: ProductionReadinessItem[];
    groups: ProductionReadinessGroup[];
    issues: ProductionGateIssue[];
}
interface StyleEvolutionContract {
    loopProtocol?: {
        status?: "pending" | "running" | "ready" | "approved" | "blocked";
        requiredStages?: string[];
        completedStages?: string[];
        blockedStages?: string[];
        evidence?: Array<{
            key: string;
            label: string;
            status: "pending" | "passed" | "blocked" | "warning";
            summary: string;
            evidence: string[];
            requiredForFreeze?: boolean;
        }>;
    };
    runtime?: {
        engine?: "Style Evolution Engine";
        runtime?: "Prompt Loop Runtime";
        gate?: "Style Contract Freeze Gate";
        verificationGate?: "Generation Verification Gate";
        lastRunId?: string;
        lastRunStatus?: "idle" | "running" | "completed";
        lastStopReason?: "max_iterations_reached" | "ready_for_approval" | "stable_candidate" | "style_candidates_all_blocked" | "manual_stop";
        lastCompletedAt?: string;
    };
    retryPolicy?: {
        maxLoopIterations?: number;
        approvalScoreThreshold?: number;
        approvalMinRounds?: number;
        stabilityMinRounds?: number;
        stabilityScoreDeltaMax?: number;
        retryOnForbiddenHit?: boolean;
        maxForbiddenHitCount?: number;
    };
    freezer?: {
        source?: "heuristic" | "llm_critic";
        verdict?: "block" | "continue" | "ready";
        summary?: string;
        blockingReasons?: string[];
        version?: number;
        checkedAt?: string;
    };
    frozenBasePrompt?: string;
    approval?: {
        status?: "pending" | "approved" | "rejected";
        approvedVersion?: number;
        approvedAt?: string;
        approvedBy?: "user" | "system";
        freezeSummary?: string;
        acceptedAsBookStyle?: boolean;
        rejectedVersion?: number;
        rejectedAt?: string;
        rejectionReason?: string;
    };
    inheritance?: {
        status?: "pending" | "enforced";
        inheritedArtifacts?: string[];
        inheritedRules?: string[];
        promptSummary?: string;
    };
    loop?: {
        status?: "idle" | "running" | "awaiting_user" | "stable_candidate" | "ready_for_approval" | "approved";
        convergence?: "unknown" | "exploring" | "improving" | "stable" | "ready";
        currentIteration?: number;
        latestVersion?: number;
        stableVersion?: number;
        readyVersion?: number;
        approvalVersion?: number;
        autoIterations?: number;
        stableRounds?: number;
        stabilityScore?: number;
        lastRunAt?: string;
        lastVerdict?: "retry" | "candidate" | "approve";
        latestSummary?: string;
        stableSummary?: string;
        readySummary?: string;
        stabilityReasons?: string[];
        readyReasons?: string[];
        convergenceEvidence?: string[];
        tighteningCount?: number;
        verificationStatus?: "pending" | "passed" | "blocked" | "warning";
        verificationVersion?: number;
        verificationSummary?: string;
        verificationReasons?: string[];
    };
    verification?: {
        gate?: "Generation Verification Gate";
        status?: "pending" | "passed" | "blocked" | "warning";
        summary?: string;
        reasons?: string[];
        score?: number | null;
        threshold?: number | null;
        highRiskCount?: number;
        forbiddenHitCount?: number;
        highRiskPreviews?: string[];
        version?: number;
        checkedAt?: string;
    };
    seedPrompt?: string;
    userStylePrompt?: string;
    referenceText?: string;
    referenceWorks?: string[];
    desiredVibes?: string[];
    seedForbiddenPatterns?: string[];
    approvedSample?: string;
    approvedSamplePath?: string;
    approvedAt?: string;
    styleContract?: {
        voice?: string;
        sentenceRhythm?: string;
        dialogueRules?: string[];
        descriptionRules?: string[];
        emotionRules?: string[];
        pacingRules?: string[];
        povRules?: string[];
        openingRules?: string[];
        endingHookRules?: string[];
        allowedDevices?: string[];
        forbiddenPatterns?: string[];
        positiveExamples?: string[];
        negativeExamples?: string[];
    };
    antiPatterns?: string[];
    evolutionHistory?: Array<{
        version: number;
        prompt: string;
        sample: string;
        review: string;
        createdAt?: string;
        samplePath?: string;
        iterationFeedback?: string;
        source?: "manual" | "loop";
        readyForApproval?: boolean;
        readyReasons?: string[];
        userDecision?: "pending" | "accepted_for_freeze" | "accepted" | "superseded";
        userDecisionAt?: string;
        rejectionReason?: string;
        contractTightening?: string[];
        convergenceNote?: string;
        freezer?: {
            source?: "heuristic" | "llm_critic";
            verdict?: "block" | "continue" | "ready";
            summary?: string;
            blockingReasons?: string[];
            checkedAt?: string;
        };
        llmFallbackUsed?: boolean;
        fallbackReasons?: string[];
        verification?: {
            gate?: "Generation Verification Gate";
            status?: "pending" | "passed" | "blocked" | "warning";
            summary?: string;
            reasons?: string[];
            score?: number | null;
            threshold?: number | null;
            highRiskCount?: number;
            forbiddenHitCount?: number;
            highRiskPreviews?: string[];
            version?: number;
            checkedAt?: string;
        };
        evaluation?: {
            source?: "heuristic" | "llm_critic";
            verdict?: "retry" | "candidate" | "approve";
            summary?: string;
            scores?: {
                narrativeVoice?: number;
                sentenceRhythm?: number;
                dialogueTexture?: number;
                informationDensity?: number;
                emotionalTension?: number;
                readability?: number;
                requirementAlignment?: number;
                forbiddenPatternRisk?: number;
                overall?: number;
            };
            strengths?: string[];
            deviations?: string[];
            forbiddenHits?: string[];
            nextFocus?: string[];
        };
        refinement?: {
            source?: "heuristic" | "llm_critic";
            summary?: string;
            promptAdjustments?: string[];
            contractAdjustments?: string[];
            nextPrompt?: string;
        };
    }>;
}
interface ChapterSceneCardContract {
    index: number;
    goal: string;
    conflict: string;
    turn: string;
    endHook: string;
    requiredCharacters: string[];
    requiredFacts: string[];
    forbiddenFacts: string[];
}
interface ChapterBlueprintContract {
    chapterNumber: number;
    title: string;
    chapterRole: string;
    chapterPurpose: string;
    macroBeat: "E" | "F" | "P" | "C";
    suspenseLevel: string;
    foreshadowingOperation: string;
    plotTwistLevel: number;
    emotionTarget: string;
    conflictLevel: number;
    revealLevel: number;
    targetWordCount: number;
    mustAvoid: string[];
    allowedCharacters: string[];
    forbiddenCharacters: string[];
    allowedNewCharacters: string[];
    entranceProtocol: {
        newCharacterStage: "rumor" | "trace" | "meet" | "name_reveal";
        requiredIntroElements: string[];
    };
    sceneCards: ChapterSceneCardContract[];
    endingHook: string;
    nextChapterEntryState: string;
}
interface WritingPlanChapterContract {
    chapterNumber: number;
    title: string;
    filePath: string;
    status: "pending" | "in_progress" | "completed" | "failed" | "blocked";
    wordCount: number | null;
    qualityPass: boolean | null;
    retryCount: number;
    selectedVersionId: string | null;
}
interface WritingPlanContract {
    version: 1;
    novelName: string;
    totalChapters: number;
    minWordsPerChapter: number;
    status: "planning" | "in_progress" | "completed" | "blocked";
    writingMode: "serial" | "batch" | "agent_team";
    chapters: WritingPlanChapterContract[];
}
interface ProductionReadinessInput {
    consensusText?: string;
    planningArtifactCount?: number;
    planningRequiredAssetCount?: number;
    planningRequiredAssets?: string[];
    planningMissingRequiredAssets?: string[];
    planningAssetDetails?: ProductionReadinessAsset[];
    storyFoundationApproved?: boolean;
    storyFoundationApprovalPath?: string;
    storyFoundationApprovedAt?: string;
    storyFoundationApprovalFingerprint?: string;
    storyFoundationAssetFingerprint?: string;
    characterAssetDetails?: ProductionReadinessAsset[];
    executionAssetDetails?: ProductionReadinessAsset[];
    blueprintCount?: number;
    totalChapters?: number;
    characterDossierCount?: number;
    characterDossierGaps?: string[];
    styleGate?: ProductionGateResult | null;
    memoryRecallRows?: number;
    memoryLag?: number;
    contextBudgetPercent?: number;
    contextOverBudget?: boolean;
}
declare function evaluateStyleEvolutionGate(contract: StyleEvolutionContract | null | undefined): ProductionGateResult;
declare function evaluateChapterBlueprintGate(blueprint: ChapterBlueprintContract | null | undefined): ProductionGateResult;
declare function evaluateChapterExecutionReadiness(input: {
    style: StyleEvolutionContract | null | undefined;
    blueprint: ChapterBlueprintContract | null | undefined;
}): ProductionGateResult;
declare function evaluateProductionReadiness(input: ProductionReadinessInput): ProductionReadinessSnapshot;

export { type ChapterBlueprintContract as C, type ProductionReadinessSnapshot as P, type StyleEvolutionContract as S, type WritingPlanContract as W, type ProductionGateIssue as a, type ProductionReadinessItem as b, type ProductionReadinessGroup as c, type ProductionGateResult as d, evaluateStyleEvolutionGate as e, type ChapterSceneCardContract as f, type ProductionGateStatus as g, type ProductionPhase as h, type ProductionReadinessAsset as i, type ProductionReadinessInput as j, type WritingPlanChapterContract as k, evaluateChapterBlueprintGate as l, evaluateChapterExecutionReadiness as m, evaluateProductionReadiness as n };
