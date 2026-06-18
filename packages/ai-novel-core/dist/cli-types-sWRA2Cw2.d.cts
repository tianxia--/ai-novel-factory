type NovelStage = "worldbuilding_dialogue" | "setting_review" | "master_planning" | "chapter_task_generation" | "drafting" | "reviewing" | "replanning" | "complete";
type TaskStatus = "pending" | "in_progress" | "complete" | "blocked";
type InterruptionScope = "local" | "chapter_arc" | "global";
interface CausalChapterPlan {
    previousInput: string;
    sceneObjective: string;
    protagonistDecision: string;
    irreversibleConsequence: string;
    nextHandoff: string;
    requiredContinuityAnchors: string[];
    characterStateDelta: string;
    foreshadowingOperation: string;
}
interface ChapterTask {
    chapterNumber: number;
    title: string;
    status: TaskStatus;
    summary: string;
    targetWords: number;
    causalPlan?: CausalChapterPlan;
    recoveryAttempts?: number;
    recoveryBlocked?: boolean;
    recoveryQueuedAt?: string;
    contentQuality?: {
        status: "eligible" | "quarantined";
        reason: string;
        wordCount?: number;
        targetWords?: number;
        minimumWords?: number;
    };
    qualityGate?: {
        status: "passed" | "needs_revision" | "blocked";
        score: number;
        attempts: number;
        reason: string;
        wordCount?: number;
        targetWords?: number;
        updatedAt: string;
    };
}
interface InterruptionReview {
    message: string;
    scope: InterruptionScope;
    reasoning: string;
    affectedArtifacts: string[];
    recommendedAction: string;
    timestamp: string;
}
interface ProviderTestResult {
    ok: boolean;
    checkedAt: string;
    baseUrl: string;
    modelName: string;
    message: string;
}
interface CreativeProfile {
    genre: string;
    platform: string;
    readerPromise: string;
    pointOfView: string;
    tone: string;
    naturalnessTarget: "light" | "balanced" | "strict";
    styleFingerprint: string;
    characterProfileRequirements: string[];
}
interface CharacterDossier {
    id: string;
    role: "protagonist" | "deuteragonist" | "antagonist" | "supporting" | "relationship-axis";
    canonicalName: string;
    aliases: string[];
    identityAndRole: string;
    coreDesire: string;
    fearOrWound: string;
    contradiction: string;
    behaviorHabits: string[];
    speechMarkers: string[];
    appearanceAndBody: string;
    skills: string[];
    limitations: string[];
    relationshipState: string;
    relationshipEdges: Array<{
        targetId: string;
        label: string;
        pressure: string;
    }>;
    arcTrajectory: string;
    currentChapterDelta: string;
    continuityNotes: string[];
    evidence: string[];
    updatedAt: string;
}
interface AutopilotRuntime {
    running: boolean;
    stopRequested: boolean;
    startedAt: string | null;
    updatedAt: string | null;
    lastStep: string | null;
    mode?: "idle" | "stream" | "background";
    target?: string | null;
    driftScore?: number;
    driftStatus?: "ok" | "correcting" | "blocked";
    driftReason?: string | null;
    checkpointPath?: string | null;
    loopCount?: number;
    statusMessage?: string;
}
interface AutonomousNovelState {
    project: {
        title: string;
        idea: string;
        createdAt: string;
        workspaceVersion: number;
        autoMode?: "full" | "semi";
        creativeProfile?: CreativeProfile;
    };
    runtime: {
        stage: NovelStage;
        statusMessage: string;
        lastUpdatedAt: string;
        lastInterruption: InterruptionReview | null;
        lastRoute?: string;
        lastAction?: string;
        lastProviderCheck?: ProviderTestResult | null;
        autopilot?: AutopilotRuntime;
    };
    reactSetup: {
        discussionGoals: string[];
        unansweredQuestions: string[];
    };
    plan: {
        totalChapters: number;
        chapterWordTarget: number;
        pendingChapters: number;
        chapterTasks: ChapterTask[];
    };
    memory?: {
        characterDossiers: CharacterDossier[];
    };
    assets: {
        cover: {
            status: TaskStatus;
            briefPath: string;
        };
        comic: {
            status: TaskStatus;
            planPath: string;
        };
    };
}
interface InitProjectOptions {
    rootDir: string;
    idea: string;
    totalChapters: number;
    chapterWordTarget: number;
    title?: string;
    creativeProfile?: Partial<CreativeProfile>;
}
interface InterruptOptions {
    rootDir: string;
    message: string;
    factoryRootDir?: string;
    projectId?: string | null;
    directorCommandId?: string | null;
}
interface NovelProjectRecord {
    id: string;
    slug: string;
    title: string;
    idea: string;
    createdAt: string;
    totalChapters: number;
    chapterWordTarget: number;
    projectRoot: string;
    summary?: {
        source: "db" | "state" | "empty";
        stage: string;
        progressPercent: number;
        totalChapters: number;
        completedChapters: number;
        pendingChapters: number;
        inProgressChapters: number;
        blockedChapters: number;
        activeJobs: number;
        runnableJobs: number;
        latestEventType: string;
        latestEventAt: string;
        updatedAt: string;
    };
}

export type { AutonomousNovelState as A, CreativeProfile as C, InterruptionReview as I, NovelProjectRecord as N, ProviderTestResult as P, TaskStatus as T, NovelStage as a, AutopilotRuntime as b, ChapterTask as c, CharacterDossier as d, CausalChapterPlan as e, InitProjectOptions as f, InterruptOptions as g, InterruptionScope as h };
