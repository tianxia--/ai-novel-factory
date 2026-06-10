export type NovelStage =
  | "worldbuilding_dialogue"
  | "setting_review"
  | "master_planning"
  | "chapter_task_generation"
  | "drafting"
  | "reviewing"
  | "replanning"
  | "complete"

export type TaskStatus = "pending" | "in_progress" | "complete" | "blocked"

export type InterruptionScope = "local" | "chapter_arc" | "global"

export interface CausalChapterPlan {
  previousInput: string
  sceneObjective: string
  protagonistDecision: string
  irreversibleConsequence: string
  nextHandoff: string
  requiredContinuityAnchors: string[]
  characterStateDelta: string
  foreshadowingOperation: string
}

export interface ChapterTask {
  chapterNumber: number
  title: string
  status: TaskStatus
  summary: string
  targetWords: number
  causalPlan?: CausalChapterPlan
  recoveryAttempts?: number
  recoveryBlocked?: boolean
  recoveryQueuedAt?: string
  contentQuality?: {
    status: "eligible" | "quarantined"
    reason: string
    wordCount?: number
    targetWords?: number
    minimumWords?: number
  }
  qualityGate?: {
    status: "passed" | "needs_revision" | "blocked"
    score: number
    attempts: number
    reason: string
    wordCount?: number
    targetWords?: number
    updatedAt: string
  }
}

export interface InterruptionReview {
  message: string
  scope: InterruptionScope
  reasoning: string
  affectedArtifacts: string[]
  recommendedAction: string
  timestamp: string
}

export interface ProviderTestResult {
  ok: boolean
  checkedAt: string
  baseUrl: string
  modelName: string
  message: string
}

export interface CreativeProfile {
  genre: string
  platform: string
  readerPromise: string
  pointOfView: string
  tone: string
  naturalnessTarget: "light" | "balanced" | "strict"
  styleFingerprint: string
  characterProfileRequirements: string[]
}

export interface AutopilotRuntime {
  running: boolean
  stopRequested: boolean
  startedAt: string | null
  updatedAt: string | null
  lastStep: string | null
  mode?: "idle" | "stream" | "background"
  target?: string | null
  driftScore?: number
  driftStatus?: "ok" | "correcting" | "blocked"
  driftReason?: string | null
  checkpointPath?: string | null
  loopCount?: number
  statusMessage?: string
}

export interface AutonomousNovelState {
  project: {
    title: string
    idea: string
    createdAt: string
    workspaceVersion: number
    autoMode?: "full" | "semi"
    creativeProfile?: CreativeProfile
  }
  runtime: {
    stage: NovelStage
    statusMessage: string
    lastUpdatedAt: string
    lastInterruption: InterruptionReview | null
    lastRoute?: string
    lastAction?: string
    lastProviderCheck?: ProviderTestResult | null
    autopilot?: AutopilotRuntime
  }
  reactSetup: {
    discussionGoals: string[]
    unansweredQuestions: string[]
  }
  plan: {
    totalChapters: number
    chapterWordTarget: number
    pendingChapters: number
    chapterTasks: ChapterTask[]
  }
  assets: {
    cover: {
      status: TaskStatus
      briefPath: string
    }
    comic: {
      status: TaskStatus
      planPath: string
    }
  }
}

export interface InitProjectOptions {
  rootDir: string
  idea: string
  totalChapters: number
  chapterWordTarget: number
  title?: string
  creativeProfile?: Partial<CreativeProfile>
}

export interface InterruptOptions {
  rootDir: string
  message: string
  factoryRootDir?: string
  projectId?: string | null
  directorCommandId?: string | null
}

export interface NovelProjectRecord {
  id: string
  slug: string
  title: string
  idea: string
  createdAt: string
  totalChapters: number
  chapterWordTarget: number
  projectRoot: string
  summary?: {
    source: "db" | "state" | "empty"
    stage: string
    progressPercent: number
    totalChapters: number
    completedChapters: number
    pendingChapters: number
    inProgressChapters: number
    blockedChapters: number
    activeJobs: number
    runnableJobs: number
    latestEventType: string
    latestEventAt: string
    updatedAt: string
  }
}
