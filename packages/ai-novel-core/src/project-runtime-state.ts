import type { AutonomousNovelState, NovelStage, TaskStatus } from "./cli-types"

export type ProjectWorkflowStage =
  | NovelStage
  | "empty"
  | "unknown"

export type ProjectProductionStatus =
  | "not_started"
  | "worldbuilding"
  | "planning"
  | "ready_to_draft"
  | "drafting"
  | "reviewing"
  | "replanning"
  | "blocked"
  | "complete"
  | "unknown"

export type ProjectExecutionStatus =
  | "idle"
  | "running"
  | "paused"
  | "queued"
  | "blocked"
  | "stopping"
  | "unknown"

export type ProjectPrimaryAction =
  | "start"
  | "continue"
  | "resume"
  | "pause"
  | "retry_blocked"
  | "review"
  | "none"

export type ProjectNextTarget =
  | { type: "chapter"; chapterNumber: number }
  | { type: "stage"; stage: ProjectWorkflowStage }
  | { type: "project" }
  | null

export interface ProjectChapterProgress {
  totalChapters: number
  completedChapters: number
  passedChapters: number
  contiguousCompletedChapters: number
  pendingChapters: number
  inProgressChapters: number
  blockedChapters: number
  nextChapterNumber: number | null
  progressPercent: number
}

export interface ProjectRuntimeState {
  workflowStage: ProjectWorkflowStage
  rawWorkflowStage: string
  productionStatus: ProjectProductionStatus
  executionStatus: ProjectExecutionStatus
  primaryAction: ProjectPrimaryAction
  primaryActionLabel: string
  nextTarget: ProjectNextTarget
  reason: string
  chapterProgress: ProjectChapterProgress
  runningJobs: number
  recoverableJobs: number
  runnableJobs: number
  activeJobs: number
  updatedAt: string
}

export interface DeriveProjectRuntimeStateInput {
  state?: AutonomousNovelState | Record<string, any> | null
  factorySnapshot?: Record<string, any> | null
  now?: Date | string
}

type ChapterLike = {
  chapterNumber: number
  status: TaskStatus
}

const PRODUCTION_STAGES = new Set<string>([
  "setting_review",
  "master_planning",
  "chapter_task_generation",
  "drafting",
  "reviewing",
  "replanning",
])

const PLANNING_STAGES = new Set<string>([
  "setting_review",
  "master_planning",
])

function toArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function finiteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  return value === "complete" || value === "in_progress" || value === "blocked" || value === "pending"
    ? value
    : "pending"
}

function normalizeChapterRows(rows: unknown): ChapterLike[] {
  return toArray<Record<string, unknown>>(rows)
    .map((row) => ({
      chapterNumber: finiteNumber(row.chapterNumber, 0),
      status: normalizeTaskStatus(row.status),
    }))
    .filter((row) => row.chapterNumber > 0)
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
}

function deriveChapterProgress(state: Record<string, any> | null, factorySnapshot: Record<string, any> | null): ProjectChapterProgress {
  const plan = state?.plan || {}
  const taskSummary = plan.chapterTaskSummary || {}
  const tasks = normalizeChapterRows(plan.chapterTasks)
  const facts = normalizeChapterRows(factorySnapshot?.chapterFacts)
  const rows = facts.length > 0 ? facts : tasks
  const explicitTotal = finiteNumber(plan.totalChapters, 0)
  const summaryTotal = finiteNumber(taskSummary.total, 0)
  const projectTotal = finiteNumber(factorySnapshot?.project?.totalChapters, 0)
  const maxRowChapter = rows.reduce((max, row) => Math.max(max, row.chapterNumber), 0)
  const totalChapters = Math.max(explicitTotal, summaryTotal, projectTotal, maxRowChapter)

  const countStatus = (status: TaskStatus) => rows.filter((row) => row.status === status).length
  const passedChapters = rows.length > 0
    ? countStatus("complete")
    : finiteNumber(taskSummary.complete, 0)
  const inProgressChapters = rows.length > 0
    ? countStatus("in_progress")
    : finiteNumber(taskSummary.inProgress, 0)
  const blockedChapters = rows.length > 0
    ? countStatus("blocked")
    : finiteNumber(taskSummary.blocked, 0)

  let contiguousCompletedChapters = 0
  if (rows.length > 0) {
    const rowsByChapter = new Map(rows.map((row) => [row.chapterNumber, row]))
    for (let chapterNumber = 1; chapterNumber <= totalChapters; chapterNumber += 1) {
      if (rowsByChapter.get(chapterNumber)?.status !== "complete") break
      contiguousCompletedChapters += 1
    }
  } else {
    contiguousCompletedChapters = passedChapters
  }

  const completedChapters = Math.min(passedChapters, contiguousCompletedChapters)
  const pendingFromRows = totalChapters > 0
    ? Math.max(0, totalChapters - passedChapters - inProgressChapters - blockedChapters)
    : 0
  const pendingChapters = rows.length > 0
    ? pendingFromRows
    : finiteNumber(plan.pendingChapters ?? taskSummary.pending, pendingFromRows)
  const nextChapterNumber = totalChapters > 0 && completedChapters < totalChapters
    ? completedChapters + 1
    : null
  const progressPercent = totalChapters > 0
    ? Math.max(0, Math.min(100, Math.round((completedChapters / totalChapters) * 100)))
    : 0

  return {
    totalChapters,
    completedChapters,
    passedChapters,
    contiguousCompletedChapters,
    pendingChapters: Math.max(0, pendingChapters),
    inProgressChapters,
    blockedChapters,
    nextChapterNumber,
    progressPercent,
  }
}

function normalizeStage(rawStage: unknown, progress: ProjectChapterProgress): ProjectWorkflowStage {
  const stage = typeof rawStage === "string" && rawStage ? rawStage : "empty"
  if (stage === "complete") {
    const reallyComplete = progress.totalChapters > 0
      && progress.completedChapters >= progress.totalChapters
      && progress.blockedChapters === 0
      && progress.inProgressChapters === 0
    if (!reallyComplete) {
      return progress.blockedChapters > 0 ? "reviewing" : "drafting"
    }
  }
  if (stage === "worldbuilding_dialogue"
    || stage === "setting_review"
    || stage === "master_planning"
    || stage === "chapter_task_generation"
    || stage === "drafting"
    || stage === "reviewing"
    || stage === "replanning"
    || stage === "complete") {
    return stage
  }
  return stage === "empty" ? "empty" : "unknown"
}

function hasLease(job: Record<string, any>): boolean {
  return Boolean(job.lease_owner || job.leaseOwner)
}

function isJobRecoverable(job: Record<string, any>): boolean {
  return job.status === "paused" || !hasLease(job)
}

function deriveJobCounts(factorySnapshot: Record<string, any> | null) {
  const activeJobs = toArray<Record<string, any>>(factorySnapshot?.activeJobs)
  const runnableJobs = toArray<Record<string, any>>(factorySnapshot?.runnableJobs)
  const activeRuns = toArray<Record<string, any>>(factorySnapshot?.activeRuns)
  const active = activeJobs.length > 0 ? activeJobs : activeRuns
  const recoverableIds = new Set(
    [...active, ...runnableJobs]
      .filter(isJobRecoverable)
      .map((job) => String(job.id || "")),
  )
  const runningJobs = active.filter((job) =>
    job.status === "running"
    && hasLease(job)
    && !recoverableIds.has(String(job.id || "")),
  )
  return {
    activeJobs: active.length,
    runnableJobs: runnableJobs.length,
    runningJobs: runningJobs.length,
    recoverableJobs: recoverableIds.size,
  }
}

function deriveProductionStatus(stage: ProjectWorkflowStage, progress: ProjectChapterProgress): ProjectProductionStatus {
  if (stage === "empty") return "not_started"
  if (stage === "unknown") return "unknown"
  if (stage === "complete") return "complete"
  if (progress.blockedChapters > 0) return "blocked"
  if (stage === "worldbuilding_dialogue") return "worldbuilding"
  if (PLANNING_STAGES.has(stage)) return "planning"
  if (stage === "chapter_task_generation") return "ready_to_draft"
  if (stage === "reviewing") return "reviewing"
  if (stage === "replanning") return "replanning"
  if (stage === "drafting") return "drafting"
  return "unknown"
}

function deriveExecutionStatus(
  state: Record<string, any> | null,
  factorySnapshot: Record<string, any> | null,
  productionStatus: ProjectProductionStatus,
  jobs: ReturnType<typeof deriveJobCounts>,
): ProjectExecutionStatus {
  const autopilot = state?.runtime?.autopilot || {}
  if (autopilot.stopRequested) return "stopping"
  if (jobs.runningJobs > 0 || autopilot.running) return "running"
  if (productionStatus === "blocked" || autopilot.driftStatus === "blocked") return "blocked"
  if (jobs.recoverableJobs > 0) return "paused"
  if (jobs.runnableJobs > 0) return "queued"
  return factorySnapshot || state ? "idle" : "unknown"
}

function actionLabel(action: ProjectPrimaryAction): string {
  switch (action) {
    case "start":
      return "开始创作"
    case "continue":
      return "继续创作"
    case "resume":
      return "继续创作"
    case "pause":
      return "暂停并保留进度"
    case "retry_blocked":
      return "修复阻塞"
    case "review":
      return "进入审阅"
    case "none":
    default:
      return "无需操作"
  }
}

function derivePrimaryAction(
  stage: ProjectWorkflowStage,
  productionStatus: ProjectProductionStatus,
  executionStatus: ProjectExecutionStatus,
  progress: ProjectChapterProgress,
): ProjectPrimaryAction {
  if (executionStatus === "running" || executionStatus === "stopping") return "pause"
  if (executionStatus === "paused" || executionStatus === "queued") return "resume"
  if (productionStatus === "complete") return "none"
  if (productionStatus === "blocked" || executionStatus === "blocked") return "retry_blocked"
  if (productionStatus === "reviewing") return "review"
  const hasChapterWork = progress.completedChapters > 0
    || progress.passedChapters > 0
    || progress.inProgressChapters > 0
    || progress.blockedChapters > 0
  if (PRODUCTION_STAGES.has(stage) || hasChapterWork) {
    return "continue"
  }
  return "start"
}

function deriveNextTarget(
  stage: ProjectWorkflowStage,
  productionStatus: ProjectProductionStatus,
  progress: ProjectChapterProgress,
): ProjectNextTarget {
  if (productionStatus === "complete") return null
  const hasChapterWork = progress.completedChapters > 0
    || progress.passedChapters > 0
    || progress.inProgressChapters > 0
    || progress.blockedChapters > 0
  if (progress.nextChapterNumber && (PRODUCTION_STAGES.has(stage) || hasChapterWork)) {
    return { type: "chapter", chapterNumber: progress.nextChapterNumber }
  }
  if (stage !== "empty" && stage !== "unknown") return { type: "stage", stage }
  return { type: "project" }
}

function deriveReason(
  productionStatus: ProjectProductionStatus,
  executionStatus: ProjectExecutionStatus,
  progress: ProjectChapterProgress,
  nextTarget: ProjectNextTarget,
): string {
  if (executionStatus === "running") return "后台创作任务正在运行。"
  if (executionStatus === "paused") return "检测到可恢复任务，可继续创作。"
  if (executionStatus === "queued") return "任务已在队列中，等待 worker 执行。"
  if (productionStatus === "blocked") {
    const chapterText = nextTarget?.type === "chapter" ? `第 ${nextTarget.chapterNumber} 章` : "当前章节"
    return `${chapterText}存在阻塞，需要修复后继续。`
  }
  if (productionStatus === "complete") return "全部章节任务已完成。"
  if (nextTarget?.type === "chapter") {
    return `项目已进入正文写作，当前没有后台任务运行，可从第 ${nextTarget.chapterNumber} 章继续。`
  }
  if (productionStatus === "not_started" || productionStatus === "worldbuilding") return "项目尚未进入正文生产流程。"
  return "当前没有后台任务运行，可继续推进项目。"
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value) return value
  }
  return ""
}

export function deriveProjectRuntimeState(input: DeriveProjectRuntimeStateInput = {}): ProjectRuntimeState {
  const state = (input.factorySnapshot?.state || input.state || null) as Record<string, any> | null
  const factorySnapshot = input.factorySnapshot || null
  const progress = deriveChapterProgress(state, factorySnapshot)
  const rawWorkflowStage = String(state?.runtime?.stage || "empty")
  const workflowStage = normalizeStage(rawWorkflowStage, progress)
  const productionStatus = deriveProductionStatus(workflowStage, progress)
  const jobs = deriveJobCounts(factorySnapshot)
  const executionStatus = deriveExecutionStatus(state, factorySnapshot, productionStatus, jobs)
  const primaryAction = derivePrimaryAction(workflowStage, productionStatus, executionStatus, progress)
  const nextTarget = deriveNextTarget(workflowStage, productionStatus, progress)
  const updatedAt = typeof input.now === "string"
    ? input.now
    : input.now instanceof Date
      ? input.now.toISOString()
      : firstString(
        state?.runtime?.autopilot?.updatedAt,
        factorySnapshot?.latestEvents?.[0]?.created_at,
        factorySnapshot?.latestEvents?.[0]?.updated_at,
        state?.runtime?.lastUpdatedAt,
        factorySnapshot?.project?.updatedAt,
        factorySnapshot?.project?.createdAt,
      )

  return {
    workflowStage,
    rawWorkflowStage,
    productionStatus,
    executionStatus,
    primaryAction,
    primaryActionLabel: actionLabel(primaryAction),
    nextTarget,
    reason: deriveReason(productionStatus, executionStatus, progress, nextTarget),
    chapterProgress: progress,
    runningJobs: jobs.runningJobs,
    recoverableJobs: jobs.recoverableJobs,
    runnableJobs: jobs.runnableJobs,
    activeJobs: jobs.activeJobs,
    updatedAt,
  }
}
