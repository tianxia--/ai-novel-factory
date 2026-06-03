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

export interface ChapterTask {
  chapterNumber: number
  title: string
  status: TaskStatus
  summary: string
  targetWords: number
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

export interface AutonomousNovelState {
  project: {
    title: string
    idea: string
    createdAt: string
    workspaceVersion: number
  }
  runtime: {
    stage: NovelStage
    statusMessage: string
    lastUpdatedAt: string
    lastInterruption: InterruptionReview | null
    lastRoute?: string
    lastAction?: string
    lastProviderCheck?: ProviderTestResult | null
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
}

export interface InterruptOptions {
  rootDir: string
  message: string
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
}
