import fs from "node:fs/promises"
import path from "node:path"

import type { AutonomousNovelState } from "./cli-types"
import { getPublicProjectEnvStatus } from "./env-manager"
import {
  advanceAutonomousProject,
  listAutonomousProjects,
  loadAutonomousState,
  resolveManagedProjectRoot,
  saveAutonomousState,
} from "./orchestrator"
import { runMultiAgentDiscussion } from "./discussion"
import { upsertCheckpointInSuperGraph } from "./super-graph"
import { withFactoryDb } from "./factory-db"
import { backfillPendingMemoryEmbeddings } from "./embedding"
import {
  backfillPendingKnowledgeEmbeddings,
  ingestGlobalWritingResources,
  ingestProjectArtifact,
} from "./knowledge"
import { recordDirectorCommandEvent, type DirectorCommandEventType } from "./director-commands"
import { createFollowUpAdvanceCommand, decideNovelDirectorCommand, isGenericAutopilotMessage, type NovelDirectorCommand } from "./novel-director"
import { createAutopilotStopError, isAutopilotStopError, throwIfStopped } from "./abort"
import type { MessageStatus } from "./messages"
import { executeProductionAdvanceThroughKernel } from "./production-workflow"

export interface AutopilotEvent {
  type: string
  payload: unknown
}

export interface AutopilotJob {
  projectRoot: string
  jobId?: string | null
  controller: AbortController
  listeners: Set<(event: AutopilotEvent) => void>
  promise: Promise<void>
}

export type AutopilotMode = "stream" | "background"

type ProjectList = Awaited<ReturnType<typeof listAutonomousProjects>>

export type AutopilotSnapshotFactory = (
  projectRoot: string,
  state?: AutonomousNovelState | null,
  options?: { rootDir?: string; projectId?: string | null },
) => Promise<Record<string, unknown>>

export interface AutopilotStartOptions {
  rootDir: string
  projectRoot: string
  projectId: string | null
  projects: ProjectList
  initialMessage: string
  mode?: AutopilotMode
  jobId?: string | null
  createSnapshot: AutopilotSnapshotFactory
}

export interface AutopilotWorkerRuntimeOptions {
  rootDir: string
  createSnapshot: AutopilotSnapshotFactory
  pollMs?: number
}

const autopilotJobs = new Map<string, AutopilotJob>()
const AUTOPILOT_LEASE_SECONDS = 60
const AUTOPILOT_RESTORE_POLL_MS = Math.max(1, AUTOPILOT_LEASE_SECONDS) * 1000
const AUTOPILOT_HEARTBEAT_MS = Math.max(5000, Math.floor(AUTOPILOT_LEASE_SECONDS * 1000 / 3))
const AUTOPILOT_NETWORK_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 10 : 5000
const AUTOPILOT_NETWORK_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 20 : 60000
const AUTOPILOT_PROVIDER_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 12 : 10000
const AUTOPILOT_PROVIDER_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 24 : 90000
const AUTOPILOT_RATE_LIMIT_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 15 : 15000
const AUTOPILOT_RATE_LIMIT_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 30 : 120000
const AUTOPILOT_NO_PROGRESS_BACKOFF_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 10 : 15000
const AUTOPILOT_STALE_LLM_REQUEST_MS = process.env.AI_NOVEL_TEST_MODE === "1"
  ? 25
  : 180000
const KNOWLEDGE_JOB_LEASE_SECONDS = 120
const ACTIVE_WRITING_MESSAGE_STATUSES: MessageStatus[] = ["queued", "streaming"]

function makeWorkerOwner() {
  return `worker:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`
}

async function ensureKnowledgeBootstrapJobs(rootDir: string, projects: ProjectList) {
  await withFactoryDb(rootDir, async (db) => {
    for (const project of projects) {
      const snapshot = db.getSnapshot(project.id)
      const summary = snapshot.knowledge?.summary || {}
      const knowledgeJobs = db.listProjectJobs(project.id)
        .filter((job) => String(job.kind || "").startsWith("knowledge_"))
      const hasRunnableKnowledgeJob = knowledgeJobs.some((job) =>
        job.status === "idle" || job.status === "running" || job.status === "paused")
      if (hasRunnableKnowledgeJob) {
        continue
      }

      const queuedJobs: Array<{ id: string; kind: string; artifactPath?: string }> = []
      if (Number(summary.globalSources || 0) === 0) {
        const id = db.createJob({
          projectId: project.id,
          kind: "knowledge_global_bootstrap",
          status: "idle",
          payload: {
            scope: "global",
            reason: "worker_bootstrap_missing_global_index",
            limit: process.env.AI_NOVEL_TEST_MODE === "1" ? 4 : undefined,
          },
        })
        queuedJobs.push({ id, kind: "knowledge_global_bootstrap" })
      }

      if (Number(summary.projectSources || 0) === 0) {
        const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts as Array<Record<string, unknown>> : []
        const artifactPaths = [...new Set(artifacts
          .map((artifact) => String(artifact.path || ""))
          .filter((artifactPath) =>
            artifactPath.endsWith(".md")
            && (
              artifactPath.includes("global-consensus.md")
              || artifactPath.includes("current-context.md")
              || artifactPath.includes("discussion-log.md")
              || artifactPath.includes("setting-freeze.md")
              || artifactPath.includes("master-outline.md")
              || artifactPath.includes("chapter-blueprints/")
              || artifactPath.includes(".final.md")
              || artifactPath.includes("-quality.md")
              || artifactPath.includes("-memory.md")
              || artifactPath.includes("production-resources/")
            ),
          ))]

        for (const artifactPath of artifactPaths.slice(0, 80)) {
          const id = db.createJob({
            projectId: project.id,
            kind: "knowledge_project_artifact",
            status: "idle",
            payload: {
              projectId: project.id,
              artifactPath,
              kind: "artifact",
              reason: "worker_bootstrap_missing_project_index",
            },
          })
          queuedJobs.push({ id, kind: "knowledge_project_artifact", artifactPath })
        }
      }

      if (queuedJobs.length > 0) {
        db.recordEvent(project.id, null, "KNOWLEDGE_BOOTSTRAP_QUEUED", {
          reason: "worker_bootstrap_missing_index",
          jobs: queuedJobs,
        })
      }
    }
  }).catch(() => undefined)
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAutopilotStopError())
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const abortSleep = () => {
      clearTimeout(timer)
      reject(createAutopilotStopError())
    }
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", abortSleep)
      resolve()
    }, ms)
    signal?.addEventListener("abort", abortSleep, { once: true })
  })
}

function readJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function isTransientNetworkError(error: unknown) {
  return classifyTransientNetworkError(error) !== null
}

type TransientNetworkErrorKind = "timeout" | "rate_limit" | "provider_unavailable" | "connection"

function classifyTransientNetworkError(error: unknown): TransientNetworkErrorKind | null {
  if (isAutopilotStopError(error)) {
    return null
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/429|rate limit|too many requests|quota/i.test(message)) {
    return "rate_limit"
  }
  if (/503|502|504|temporar|unavailable|overloaded|bad gateway|gateway timeout/i.test(message)) {
    return "provider_unavailable"
  }
  if (/timeout|timed\s*out|timed-out/i.test(message)) {
    return "timeout"
  }
  if (/network|fetch|failed|econn|enotfound|etimedout|socket|undici|dns|connect|connection reset/i.test(message)) {
    return "connection"
  }
  return null
}

function nextNetworkRetryDelay(attempt: number, kind: TransientNetworkErrorKind = "connection") {
  const exponent = 2 ** Math.max(0, attempt - 1)
  if (kind === "rate_limit") {
    return Math.min(AUTOPILOT_RATE_LIMIT_RETRY_BASE_MS * exponent, AUTOPILOT_RATE_LIMIT_RETRY_MAX_MS)
  }
  if (kind === "provider_unavailable") {
    return Math.min(AUTOPILOT_PROVIDER_RETRY_BASE_MS * exponent, AUTOPILOT_PROVIDER_RETRY_MAX_MS)
  }
  return Math.min(AUTOPILOT_NETWORK_RETRY_BASE_MS * exponent, AUTOPILOT_NETWORK_RETRY_MAX_MS)
}

function describeTransientNetworkError(kind: TransientNetworkErrorKind) {
  if (kind === "rate_limit") {
    return {
      statusPrefix: "模型服务触发限流，正在按退避策略自动重试",
      eventMessage: "模型服务触发限流，系统将放慢节奏后继续无人值守流程。",
    }
  }
  if (kind === "provider_unavailable") {
    return {
      statusPrefix: "模型服务暂时不可用，正在等待服务恢复后自动重试",
      eventMessage: "模型服务暂时不可用，系统正在等待服务恢复后继续无人值守流程。",
    }
  }
  if (kind === "timeout") {
    return {
      statusPrefix: "模型响应超时，正在自动重试",
      eventMessage: "模型响应超时，系统正在自动重试并保留当前无人值守进度。",
    }
  }
  return {
    statusPrefix: "网络连接暂时不可用，正在自动重试",
    eventMessage: "网络连接暂时不可用，系统正在等待恢复后继续无人值守流程。",
  }
}

function workflowProgressSignature(state: AutonomousNovelState) {
  const tasks = state.plan.chapterTasks || []
  const counts = {
    complete: tasks.filter((task) => task.status === "complete").length,
    pending: tasks.filter((task) => task.status === "pending").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
  }
  const firstActive = tasks.find((task) => task.status !== "complete")
  return [
    state.runtime.stage,
    state.runtime.lastAction || "",
    state.plan.pendingChapters,
    counts.complete,
    counts.pending,
    counts.inProgress,
    counts.blocked,
    firstActive ? `${firstActive.chapterNumber}:${firstActive.status}:${firstActive.recoveryAttempts || 0}` : "none",
  ].join("|")
}

function hasEarlierActiveTask(state: AutonomousNovelState, chapterNumber: number) {
  return state.plan.chapterTasks.some((task) =>
    task.chapterNumber < chapterNumber && (task.status === "in_progress" || task.status === "blocked"))
}

async function findActiveWritingMessage(
  rootDir: string,
  projectId: string | null,
  chapterNumber: number | null,
) {
  if (!projectId || !chapterNumber) {
    return null
  }

  return withFactoryDb(rootDir, async (db) => {
    const messages = db.listMessages(projectId, {
      conversationId: `writing:${projectId}`,
      limit: 12,
    })
    return messages.find((message: any) => {
      if (!ACTIVE_WRITING_MESSAGE_STATUSES.includes(message.status as MessageStatus)) {
        return false
      }
      const metadata = message.metadata && typeof message.metadata === "object"
        ? message.metadata as Record<string, unknown>
        : {}
      return Number(metadata.chapterNumber) === chapterNumber
    }) || null
  }).catch(() => null)
}

async function recoverOrphanedInProgressWritingTask(
  rootDir: string,
  projectRoot: string,
  projectId: string | null,
  state: AutonomousNovelState,
) {
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "in_progress")
  if (!projectId || !task) {
    return { recovered: false, state }
  }

  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, task.chapterNumber)
  if (activeWritingMessage) {
    return { recovered: false, state }
  }

  const now = new Date().toISOString()
  task.status = "pending"
  task.recoveryBlocked = false
  task.recoveryQueuedAt = now
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length
  state.runtime.stage = "drafting"
  state.runtime.statusMessage = `第 ${task.chapterNumber} 章的执行请求已丢失，已自动恢复为待写作并准备重新执行。`
  await saveAutonomousState(projectRoot, state)

  await withFactoryDb(rootDir, async (db) => {
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId: `writing-${task.chapterNumber}-orphaned-task-recovered`,
      step: "orphaned_in_progress_recovered",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      phase: "completed",
      statusText: "章节执行请求已恢复，等待重新写作。",
      message: `第 ${task.chapterNumber} 章处于 in_progress，但没有活动中的 LLM 消息，系统已重新排队。`,
      timestamp: now,
    })
    db.recordEvent(projectId, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: task.chapterNumber,
      status: "pending",
      reason: "orphaned_in_progress_recovered",
      recoveryAttempts: task.recoveryAttempts || 0,
      recoveryQueuedAt: task.recoveryQueuedAt,
    })
    db.updateProjectState(projectId, state)
  }).catch(() => undefined)

  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message: state.runtime.statusMessage,
    dedupeKey: `orphaned-in-progress-recovered:${task.chapterNumber}:${task.recoveryQueuedAt}`,
  })

  return { recovered: true, state }
}

function messageUpdatedMs(message: Record<string, unknown> | null | undefined) {
  if (!message) {
    return 0
  }
  const candidates = [
    message.updated_at,
    message.updatedAt,
    message.time,
    message.created_at,
    message.createdAt,
  ]
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue
    }
    const parsed = Date.parse(candidate)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return 0
}

function activeWritingMessageAgeMs(message: Record<string, unknown> | null | undefined, now = Date.now()) {
  const updatedAt = messageUpdatedMs(message)
  return updatedAt > 0 ? Math.max(0, now - updatedAt) : 0
}

async function recoverStaleWritingRequest(
  rootDir: string,
  projectRoot: string,
  projectId: string | null,
  state: AutonomousNovelState,
) {
  const task = state.plan.chapterTasks.find((candidate) =>
    candidate.status === "in_progress" || candidate.status === "blocked")
  if (!projectId || !task) {
    return { recovered: false, state }
  }

  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, task.chapterNumber)
  if (!activeWritingMessage) {
    return { recovered: false, state }
  }
  const ageMs = activeWritingMessageAgeMs(activeWritingMessage as Record<string, unknown>)
  if (ageMs < AUTOPILOT_STALE_LLM_REQUEST_MS) {
    return { recovered: false, state }
  }

  const now = new Date().toISOString()
  const reason = `stale LLM writing message ${String((activeWritingMessage as any).id || "")} exceeded ${Math.round(AUTOPILOT_STALE_LLM_REQUEST_MS / 1000)}s without progress`
  task.status = "pending"
  task.recoveryAttempts = (task.recoveryAttempts || 0) + 1
  task.recoveryBlocked = false
  task.recoveryQueuedAt = now
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length
  state.runtime.stage = "drafting"
  state.runtime.statusMessage = `第 ${task.chapterNumber} 章的上一次 LLM 请求已失联，已自动回收并重新排队。`
  await saveAutonomousState(projectRoot, state)

  await withFactoryDb(rootDir, async (db) => {
    db.markStreamingMessagesFailed(projectId, {
      conversationId: `writing:${projectId}`,
      chapterNumber: task.chapterNumber,
      reason,
    })
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId: `writing-${task.chapterNumber}-llm-request-stale-recovered`,
      step: "llm_request_stale_recovered",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      phase: "completed",
      statusText: "上一次 LLM 请求失联，系统已自动回收并准备重试。",
      message: `第 ${task.chapterNumber} 章的上一次模型请求长时间没有进展，已标记失败并重新排队。`,
      staleMessageId: (activeWritingMessage as any).id || null,
      staleAgeMs: ageMs,
      reason,
      timestamp: now,
    })
    db.recordEvent(projectId, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: task.chapterNumber,
      status: "pending",
      reason: "stale_llm_request_recovered",
      recoveryAttempts: task.recoveryAttempts,
      recoveryQueuedAt: task.recoveryQueuedAt,
    })
    db.updateProjectState(projectId, state)
  }).catch(() => undefined)

  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message: state.runtime.statusMessage,
    dedupeKey: `stale-llm-recovered:${task.chapterNumber}:${String((activeWritingMessage as any).id || "")}`,
  })

  return { recovered: true, state }
}

async function backoffIfActiveWritingMessage(
  rootDir: string,
  projectRoot: string,
  projectId: string | null,
  state: AutonomousNovelState,
  signal?: AbortSignal,
) {
  const waitingTask = state.plan.chapterTasks.find((task) => task.status === "in_progress" || task.status === "blocked")
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, waitingTask?.chapterNumber ?? null)
  if (!waitingTask || !activeWritingMessage) {
    return false
  }

  const activeMessageAgeMs = activeWritingMessageAgeMs(activeWritingMessage as Record<string, unknown> | null)
  const staleActiveWritingMessage = activeMessageAgeMs >= AUTOPILOT_STALE_LLM_REQUEST_MS
  const activeMetadata = activeWritingMessage.metadata && typeof activeWritingMessage.metadata === "object"
    ? activeWritingMessage.metadata as Record<string, unknown>
    : {}
  const activeStep = typeof activeMetadata.step === "string" ? activeMetadata.step : ""
  const activeStatusText = activeWritingMessage.data && typeof activeWritingMessage.data === "object"
    ? String((activeWritingMessage.data as Record<string, unknown>).statusText || "")
    : ""
  const message = staleActiveWritingMessage
    ? `第 ${waitingTask.chapterNumber} 章模型请求已超过恢复阈值，下一轮将自动回收并重试。`
    : `第 ${waitingTask.chapterNumber} 章模型请求仍在执行：${activeStatusText || activeStep || "等待模型响应或持续输出中。"}`
  await markAutopilot(projectRoot, {
    lastStep: staleActiveWritingMessage ? "stale_llm_recovery_pending" : "waiting_for_llm",
    statusMessage: message,
  }, autopilotStateStore(rootDir, projectId))
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message,
    dedupeKey: `waiting-for-llm:${state.runtime.stage}:${waitingTask.chapterNumber}:${activeStep}`,
  })
  await sleep(AUTOPILOT_NO_PROGRESS_BACKOFF_MS, signal)
  return true
}

async function backoffIfNoWorkflowProgress(
  rootDir: string,
  projectRoot: string,
  projectId: string | null,
  before: AutonomousNovelState,
  after: AutonomousNovelState,
  signal?: AbortSignal,
) {
  if (workflowProgressSignature(before) !== workflowProgressSignature(after)) {
    return false
  }
  const latestState = await loadAutonomousState(projectRoot).catch(() => after)
  const latestPendingTask = latestState.plan.chapterTasks.find((task) => task.status === "pending")
  if (latestPendingTask && !hasEarlierActiveTask(latestState, latestPendingTask.chapterNumber)) {
    await markAutopilot(projectRoot, {
      lastStep: "pending_work_detected",
      statusMessage: `第 ${latestPendingTask.chapterNumber} 章已重新排队，继续推进生产状态机。`,
    }, autopilotStateStore(rootDir, projectId))
    emitAutopilotEvent(projectRoot, "autopilot_status", {
      stage: latestState.runtime.stage,
      message: `第 ${latestPendingTask.chapterNumber} 章已重新排队，继续推进生产状态机。`,
      dedupeKey: `pending-work:${latestPendingTask.chapterNumber}:${latestPendingTask.recoveryQueuedAt || ""}`,
    })
    return false
  }
  const waitingTask = after.plan.chapterTasks.find((task) => task.status === "in_progress" || task.status === "blocked")
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, waitingTask?.chapterNumber ?? null)
  const activeMessageAgeMs = activeWritingMessageAgeMs(activeWritingMessage as Record<string, unknown> | null)
  const staleActiveWritingMessage = Boolean(activeWritingMessage && activeMessageAgeMs >= AUTOPILOT_STALE_LLM_REQUEST_MS)
  const activeMetadata = activeWritingMessage?.metadata && typeof activeWritingMessage.metadata === "object"
    ? activeWritingMessage.metadata as Record<string, unknown>
    : {}
  const activeStep = typeof activeMetadata.step === "string" ? activeMetadata.step : ""
  const activeStatusText = activeWritingMessage?.data && typeof activeWritingMessage.data === "object"
    ? String((activeWritingMessage.data as Record<string, unknown>).statusText || "")
    : ""
  const activeMessage = waitingTask && activeWritingMessage
    ? staleActiveWritingMessage
      ? `第 ${waitingTask.chapterNumber} 章模型请求已超过恢复阈值，下一轮将自动回收并重试。`
      : `第 ${waitingTask.chapterNumber} 章模型请求仍在执行：${activeStatusText || activeStep || "等待模型响应或持续输出中。"}`
    : ""
  const message = activeMessage || (waitingTask
    ? `第 ${waitingTask.chapterNumber} 章暂无新进展，系统进入短暂退避等待，避免空转刷屏。`
    : "工作流暂无新进展，系统进入短暂退避等待，避免空转刷屏。")
  await markAutopilot(projectRoot, {
    lastStep: staleActiveWritingMessage ? "stale_llm_recovery_pending" : activeWritingMessage ? "waiting_for_llm" : "no_progress_backoff",
    statusMessage: message,
  }, autopilotStateStore(rootDir, projectId))
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: after.runtime.stage,
    message,
    dedupeKey: activeWritingMessage
      ? `waiting-for-llm:${after.runtime.stage}:${waitingTask?.chapterNumber || "none"}:${activeStep}`
      : `no-progress:${after.runtime.stage}:${waitingTask?.chapterNumber || "none"}`,
  })
  await sleep(AUTOPILOT_NO_PROGRESS_BACKOFF_MS, signal)
  return true
}

function emitAutopilotEvent(projectRoot: string, type: string, payload: unknown) {
  const job = autopilotJobs.get(projectRoot)
  if (!job) return
  for (const listener of job.listeners) {
    listener({ type, payload })
  }
}

function throwIfAutopilotStopped(signal?: AbortSignal) {
  throwIfStopped(signal)
}

function startJobLeaseHeartbeat(
  rootDir: string,
  projectId: string | null,
  jobId: string | null | undefined,
  leaseOwner: string,
  controller: AbortController,
) {
  if (!jobId || process.env.AI_NOVEL_TEST_MODE === "1") {
    return () => undefined
  }

  const timer = setInterval(() => {
    void withFactoryDb(rootDir, async (db) => {
      const lease = db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)
      const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : []
      const currentJob = jobs.find((entry) => entry.id === jobId)
      if (!lease || (currentJob && currentJob.status !== "running" && currentJob.status !== "paused")) {
        controller.abort()
      }
    }).catch(() => undefined)
  }, AUTOPILOT_HEARTBEAT_MS)

  return () => clearInterval(timer)
}

export function getAutopilotJob(projectRoot: string) {
  return autopilotJobs.get(projectRoot) ?? null
}

export function isAutopilotRunning(projectRoot: string) {
  return autopilotJobs.has(projectRoot)
}

export async function markAutopilot(
  projectRoot: string,
  patch: {
    running?: boolean
    stopRequested?: boolean
    lastStep?: string | null
    statusMessage?: string
    mode?: "idle" | AutopilotMode
    target?: string | null
    driftScore?: number
    driftStatus?: "ok" | "correcting" | "blocked"
    driftReason?: string | null
    checkpointPath?: string | null
    loopCount?: number
  },
  options: { factoryRootDir?: string; projectId?: string | null } = {},
) {
  const state = await loadAutonomousState(projectRoot)
  const now = new Date().toISOString()
  const current = state.runtime.autopilot || {
    running: false,
    stopRequested: false,
    startedAt: null,
    updatedAt: null,
    lastStep: null,
    mode: "idle" as const,
    target: null,
    driftScore: 0,
    driftStatus: "ok" as const,
    driftReason: null,
    checkpointPath: null,
    loopCount: 0,
  }

  state.runtime.autopilot = {
    ...current,
    ...patch,
    startedAt: patch.running && !current.startedAt ? now : current.startedAt,
    updatedAt: now,
  }
  if (patch.statusMessage) {
    state.runtime.statusMessage = patch.statusMessage
  }
  await saveAutonomousState(projectRoot, state)
  if (options.factoryRootDir && options.projectId) {
    await withFactoryDb(options.factoryRootDir, async (db) => db.updateProjectState(options.projectId as string, state)).catch(() => undefined)
  }
  return state
}

function autopilotStateStore(rootDir: string, projectId: string | null) {
  return { factoryRootDir: rootDir, projectId }
}

async function recordAutopilotDirectorCommandEvent(
  rootDir: string,
  projectId: string | null,
  type: DirectorCommandEventType,
  command: NovelDirectorCommand,
  payload: Record<string, unknown> = {},
) {
  await recordDirectorCommandEvent({
    factoryRootDir: rootDir,
    projectId,
    source: "autopilot",
  }, type, command, payload)
}

async function writeAutopilotCheckpoint(
  projectRoot: string,
  state: AutonomousNovelState,
  label: string,
  details: Record<string, unknown> = {},
) {
  const checkpointDir = path.join(projectRoot, ".ai-novel", "checkpoints")
  await fs.mkdir(checkpointDir, { recursive: true })
  const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "checkpoint"
  const fileName = `${new Date().toISOString().replace(/[:.]/g, "-")}-${safeLabel}.json`
  const relativePath = `.ai-novel/checkpoints/${fileName}`
  await fs.writeFile(
    path.join(checkpointDir, fileName),
    `${JSON.stringify({ state, details, createdAt: new Date().toISOString() }, null, 2)}\n`,
  )
  return relativePath
}

function evaluateAutopilotDrift({
  before,
  after,
  discussionSummary = "",
  intendedMessage = "",
}: {
  before: AutonomousNovelState
  after: AutonomousNovelState
  discussionSummary?: string
  intendedMessage?: string
}) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return {
      status: "ok" as const,
      score: 0,
      reasons: [] as string[],
    }
  }
  const text = `${discussionSummary}\n${after.runtime.statusMessage || ""}`.toLowerCase()
  let score = 0
  const reasons: string[] = []
  const claimsCurrentDrafting = /(当前阶段|当前状态|当前已|已进入|进入)\s*[:：]?\s*(drafting|正文写作|writing)|进入\s*(drafting|正文写作|writing)\s*阶段/i.test(text)
  const hasDraftBodySignal = /(^|\n)\s*(#\s*)?第\s*[一二三四五六七八九十百\d]+\s*章\s*[·:：]|(^|\n)\s*chapter\s+\d+\s*[·:：-]/i.test(text)
  const hasNextStepDrafting = /(下一步|next step|阶段转换指令|首轮产出|准备进入|建议进入|可进入).*?(drafting|正文写作|第\s*\d+\s*章|chapter\s+\d+)/i.test(text)

  if (before.runtime.stage !== "drafting" && (claimsCurrentDrafting || hasDraftBodySignal)) {
    score += 45
    reasons.push("当前阶段尚未进入 drafting，但输出出现章节正文倾向。")
  }

  if (
    before.runtime.stage !== "master_planning" &&
    before.runtime.stage !== "chapter_task_generation" &&
    /已进入.*(规划|蓝图|第[一二三四五六七八九十\d]+弧)|进入第[一二三四五六七八九十\d]+弧|第[一二三四五六七八九十\d]+弧.*(已完成|总体规划|蓝图设计)/i.test(text)
  ) {
    score += 40
    reasons.push("讨论文本宣称进入或完成后续规划/弧线蓝图，但状态机尚未推进到对应阶段。")
  }

  if (
    before.runtime.stage === "setting_review" &&
    /(当前位置|当前阶段|当前已).*?(master_planning|主线规划|总体规划|章节蓝图|chapter_task_generation)/i.test(text)
  ) {
    score += 35
    reasons.push("当前仍是设定冻结阶段，但输出把主线规划或章节蓝图描述成既成状态。")
  }

  if (before.runtime.stage === "setting_review" && hasNextStepDrafting && !claimsCurrentDrafting && !hasDraftBodySignal) {
    score = Math.max(0, score - 30)
  }

  const ideaTokens = before.project.idea
    .toLowerCase()
    .split(/[\s,，。！？!?.、]+/)
    .filter((token) => token.length >= 2)
    .slice(0, 6)
  const matchedIdeaToken = ideaTokens.length === 0 || ideaTokens.some((token) => text.includes(token))
  if (!matchedIdeaToken) {
    score += 20
    reasons.push("本轮摘要没有明显回扣最初小说设定。")
  }

  const intendedTokens = intendedMessage
    .toLowerCase()
    .split(/[\s,，。！？!?.、]+/)
    .filter((token) => token.length >= 2)
    .slice(0, 5)
  const matchedIntendedToken = intendedTokens.length === 0 || intendedTokens.some((token) => text.includes(token))
  if (!matchedIntendedToken) {
    score += 15
    reasons.push("本轮输出与当前执行目标关联偏弱。")
  }

  if (before.runtime.stage === after.runtime.stage && before.plan.pendingChapters === after.plan.pendingChapters) {
    const loopCount = after.runtime.autopilot?.loopCount || 0
    if (loopCount > 1) {
      score += 10
      reasons.push("连续循环没有产生阶段或章节进度变化。")
    }
  }

  if (/请选择|等待用户|需要你决定|无法继续|不能继续/i.test(text)) {
    score += 35
    reasons.push("输出出现等待用户选择或停止推进的倾向。")
  }

  const status = score >= 70 ? "blocked" : score >= 35 ? "correcting" : "ok"
  return {
    score,
    status: status as "ok" | "correcting" | "blocked",
    reason: reasons.join("；") || "目标一致，未发现明显漂移。",
  }
}

async function shouldStopAutopilot(projectRoot: string, rootDir: string, projectId: string | null) {
  const state = await loadAutonomousState(projectRoot)
  if (state.runtime.autopilot?.stopRequested) {
    return true
  }
  if (state.plan.chapterTasks.some((task) => task.status === "blocked" && task.recoveryBlocked)) {
    return true
  }
  if (state.runtime.stage !== "complete") {
    return false
  }
  return isBookFullyComplete(rootDir, projectId, state)
}

function findRecoveryBlockedTask(state: AutonomousNovelState) {
  return state.plan.chapterTasks.find((task) => task.status === "blocked" && task.recoveryBlocked) ?? null
}

function stateTasksAreFullyComplete(state: AutonomousNovelState) {
  const tasks = state.plan.chapterTasks
  return tasks.length > 0 && tasks.every((task) => task.status === "complete")
}

async function isBookFullyComplete(
  rootDir: string,
  projectId: string | null,
  state: AutonomousNovelState,
) {
  if (projectId) {
    const facts = await withFactoryDb(rootDir, async (db) => db.getChapterFacts(projectId)).catch(() => [])
    if (facts.length > 0) {
      const totalChapters = Number(state.plan.totalChapters || state.plan.chapterTasks.length || facts.length)
      const completedFacts = facts.filter((fact) => fact.status === "complete").length
      return totalChapters > 0 && completedFacts >= totalChapters
    }
  }
  return stateTasksAreFullyComplete(state)
}

async function reconcileCompleteRuntimeBeforeWorkerDecision(
  projectRoot: string,
  rootDir: string,
  projectId: string | null,
  state: AutonomousNovelState,
) {
  if (state.runtime.stage !== "complete") {
    return state
  }
  if (await isBookFullyComplete(rootDir, projectId, state)) {
    return state
  }
  state.runtime.stage = "drafting"
  state.runtime.statusMessage = "数据库章节进度显示仍有待处理章节，已从完成态恢复到正文写作。"
  state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length
  await saveAutonomousState(projectRoot, state)
  if (projectId) {
    await withFactoryDb(rootDir, async (db) => db.updateProjectState(projectId, state)).catch(() => undefined)
  }
  return state
}

async function markAutopilotRecoveryBlocked(
  rootDir: string,
  projectRoot: string,
  projectId: string | null,
  jobId: string | null | undefined,
  leaseOwner: string,
  state: AutonomousNovelState,
) {
  const task = findRecoveryBlockedTask(state)
  if (!task) {
    return false
  }
  const message = `第 ${task.chapterNumber} 章已达到自动恢复上限，需要人工审阅后才能继续。`
  await markAutopilot(projectRoot, {
    running: false,
    stopRequested: false,
    mode: "idle",
    lastStep: "recovery_blocked",
    driftStatus: "blocked",
    driftReason: message,
    statusMessage: message,
  }, autopilotStateStore(rootDir, projectId))
  if (jobId) {
    await withFactoryDb(rootDir, async (db) => db.failJob(jobId, message, leaseOwner)).catch(() => undefined)
  }
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message,
  })
  return true
}

async function runAutopilotBackground(
  options: AutopilotStartOptions,
  controller: AbortController,
  leaseOwner = makeWorkerOwner(),
) {
  const { signal } = controller
  const {
    rootDir,
    projectRoot,
    projectId,
    projects,
    initialMessage,
    mode = "background",
    jobId,
    createSnapshot,
  } = options

  if (jobId) {
    const claimed = await withFactoryDb(rootDir, async (db) => db.claimJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null)
    if (!claimed) {
      return
    }
  }

  await markAutopilot(projectRoot, {
    running: true,
    stopRequested: false,
    lastStep: "starting",
    mode,
    target: initialMessage.trim() || null,
    driftScore: 0,
    driftStatus: "ok",
    driftReason: null,
    statusMessage: "自动创作运行中：系统将持续讨论、推进、写作，直到你主动停止。",
  }, autopilotStateStore(rootDir, projectId))

  let nextMessage = initialMessage
  let lastConsumedJobMessage = initialMessage.trim()
  let correctionMessage = ""
  let networkRetryAttempt = 0
  const stopLeaseHeartbeat = startJobLeaseHeartbeat(rootDir, projectId, jobId, leaseOwner, controller)

  try {
    while (!(await shouldStopAutopilot(projectRoot, rootDir, projectId))) {
      throwIfAutopilotStopped(signal)
      if (jobId) {
        await withFactoryDb(rootDir, async (db) => db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null)
        const latestJob = await withFactoryDb(rootDir, async (db) => {
          const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : []
          return jobs.find((job) => job.id === jobId) ?? null
        }).catch(() => null)
        if (latestJob && latestJob.status !== "running" && latestJob.status !== "paused") {
          throw createAutopilotStopError()
        }
        const latestPayload = readJsonObject(latestJob?.payload_json)
        const latestMessage = typeof latestPayload.message === "string" ? latestPayload.message.trim() : ""
        if (latestMessage && latestMessage !== lastConsumedJobMessage) {
          lastConsumedJobMessage = latestMessage
          nextMessage = latestMessage
          correctionMessage = ""
          await withFactoryDb(rootDir, async (db) => db.recordEvent(projectId, null, "AUTOPILOT_INSTRUCTION_RECEIVED", {
            jobId,
            message: latestMessage,
            leaseOwner,
          })).catch(() => undefined)
          emitAutopilotEvent(projectRoot, "autopilot_status", {
            stage: (await loadAutonomousState(projectRoot)).runtime.stage,
            message: `已接收新的用户指令：${latestMessage}`,
          })
        }
      }
      let activeDirectorCommand: NovelDirectorCommand | null = null
      try {
      throwIfAutopilotStopped(signal)
      let beforeDiscussion = await reconcileCompleteRuntimeBeforeWorkerDecision(
        projectRoot,
        rootDir,
        projectId,
        await loadAutonomousState(projectRoot),
      )
      const staleRecovery = await recoverStaleWritingRequest(rootDir, projectRoot, projectId, beforeDiscussion)
      if (staleRecovery.recovered) {
        beforeDiscussion = staleRecovery.state
        networkRetryAttempt = 0
      }
      const orphanedRecovery = await recoverOrphanedInProgressWritingTask(rootDir, projectRoot, projectId, beforeDiscussion)
      if (orphanedRecovery.recovered) {
        beforeDiscussion = orphanedRecovery.state
        networkRetryAttempt = 0
      }
      const currentLoopCount = beforeDiscussion.runtime.autopilot?.loopCount || 0
      if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, beforeDiscussion)) {
        break
      }
      if (await backoffIfActiveWritingMessage(rootDir, projectRoot, projectId, beforeDiscussion, signal)) {
        continue
      }
      const directorCommand = decideNovelDirectorCommand(beforeDiscussion, {
        userMessage: nextMessage,
        correctionMessage,
      })
      activeDirectorCommand = directorCommand
      await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_DECIDED", directorCommand, {
        userMessage: nextMessage || null,
        correctionActive: Boolean(correctionMessage.trim()),
      })
      await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_STARTED", directorCommand)

      if (directorCommand.type === "advance") {
        const isSemi = beforeDiscussion.project?.autoMode === "semi"
        const userConfirmed = isGenericAutopilotMessage(nextMessage || "")
        if (isSemi && !userConfirmed) {
          const pauseMessage = `当前工作流已完成讨论与共识，已暂停以等待用户确认。`
          await markAutopilot(projectRoot, {
            running: false,
            stopRequested: false,
            mode: "idle",
            lastStep: "semi_auto_paused",
            statusMessage: pauseMessage,
          }, autopilotStateStore(rootDir, projectId))
          if (jobId) {
            await withFactoryDb(rootDir, async (db) => db.pauseJob(jobId, leaseOwner)).catch(() => undefined)
          }
          emitAutopilotEvent(projectRoot, "autopilot_status", {
            stage: beforeDiscussion.runtime.stage,
            message: pauseMessage,
          })
          break
        }

        nextMessage = ""
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: beforeDiscussion.runtime.stage,
          message: directorCommand.reason,
        })
        await markAutopilot(projectRoot, {
          lastStep: `advance:${beforeDiscussion.runtime.stage}`,
          loopCount: currentLoopCount + 1,
          driftStatus: "ok",
          driftReason: null,
          statusMessage: "当前阶段已有足够上下文，正在优先推进生产状态机。",
        }, autopilotStateStore(rootDir, projectId))

        const { state: advanced } = await executeProductionAdvanceThroughKernel({
          rootDir: projectRoot,
          factoryRootDir: rootDir,
          projectId: projectId as string,
          state: beforeDiscussion,
          executionMode: "production",
          externalRunId: directorCommand.id,
          metadata: { directorCommandId: directorCommand.id, source: "autopilot-advance-first" },
        }, () => advanceAutonomousProject(projectRoot, {
          factoryRootDir: rootDir,
          projectId,
          directorCommandId: directorCommand.id,
          preferDeterministicPlanning: true,
          signal,
          onProgress: async (event) => {
            emitAutopilotEvent(projectRoot, "writing_progress", event)
          },
        }))
        const advanceCheckpoint = await writeAutopilotCheckpoint(projectRoot, advanced, `advance-${advanced.runtime.stage}`, {
          previousStage: beforeDiscussion.runtime.stage,
          advanceFirst: directorCommand.advanceFirst,
          directorCommandId: directorCommand.id,
        })
        try {
          await upsertCheckpointInSuperGraph(projectRoot, {
            path: advanceCheckpoint,
            label: `advance-${advanced.runtime.stage}`,
          }, {
            factoryRootDir: rootDir,
            projectId,
          })
        } catch {
          // Graph repair can be run for older workspaces; keep autopilot moving.
        }
        await markAutopilot(projectRoot, {
          checkpointPath: advanceCheckpoint,
        }, autopilotStateStore(rootDir, projectId))
        emitAutopilotEvent(projectRoot, "snapshot", {
          activeProjectId: projectId,
          projects,
          ...(await createSnapshot(projectRoot, advanced, { rootDir, projectId })),
          envStatus: getPublicProjectEnvStatus(rootDir),
        })

        const advancedFullyComplete = advanced.runtime.stage === "complete"
          ? await isBookFullyComplete(rootDir, projectId, advanced)
          : false
        if (advancedFullyComplete) {
          if (jobId) {
            await withFactoryDb(rootDir, async (db) => db.completeJob(jobId, leaseOwner)).catch(() => undefined)
          }
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
            resultingStage: advanced.runtime.stage,
          })
          break
        }
        if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, advanced)) {
          break
        }
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
          resultingStage: advanced.runtime.stage,
        })
        networkRetryAttempt = 0
        await backoffIfNoWorkflowProgress(rootDir, projectRoot, projectId, beforeDiscussion, advanced, signal)
        continue
      }

      const discussionMessage = (directorCommand as any).message
      nextMessage = ""
      correctionMessage = ""

      emitAutopilotEvent(projectRoot, "autopilot_status", {
        stage: beforeDiscussion.runtime.stage,
        message: `开始自动讨论：${discussionMessage}`,
      })
      await markAutopilot(projectRoot, {
        lastStep: `discussion:${beforeDiscussion.runtime.stage}`,
        loopCount: currentLoopCount + 1,
        statusMessage: `自动讨论中：${discussionMessage}`,
      }, autopilotStateStore(rootDir, projectId))

      const discussion = await runMultiAgentDiscussion(projectRoot, discussionMessage, {
        envRootDir: rootDir,
        factoryRootDir: rootDir,
        projectId: projectId ?? undefined,
        directorCommandId: directorCommand.id,
        signal,
        onStreamEvent: async (event) => {
          emitAutopilotEvent(projectRoot, event.type, event)
        },
      })

      const afterDiscussion = await loadAutonomousState(projectRoot)
      const drift = evaluateAutopilotDrift({
        before: beforeDiscussion,
        after: afterDiscussion,
        discussionSummary: discussion.summary,
        intendedMessage: discussionMessage,
      })
      const checkpointPath = await writeAutopilotCheckpoint(projectRoot, afterDiscussion, `loop-${currentLoopCount + 1}-${afterDiscussion.runtime.stage}`, {
        discussionTarget: discussion.target,
        drift,
        directorCommandId: directorCommand.id,
      })
      try {
        await upsertCheckpointInSuperGraph(projectRoot, {
          path: checkpointPath,
          label: `loop-${currentLoopCount + 1}-${afterDiscussion.runtime.stage}`,
          drift,
        }, {
          factoryRootDir: rootDir,
          projectId,
        })
      } catch {
        // Graph repair can be run for older workspaces; keep autopilot moving.
      }
      await markAutopilot(projectRoot, {
        driftScore: drift.score,
        driftStatus: drift.status,
        driftReason: drift.reason,
        checkpointPath,
        lastStep: `guard:${afterDiscussion.runtime.stage}`,
        statusMessage: drift.status === "ok"
          ? afterDiscussion.runtime.statusMessage
          : `自动创作守卫检测到目标漂移：${drift.reason}`,
      }, autopilotStateStore(rootDir, projectId))

      emitAutopilotEvent(projectRoot, "guard", {
        stage: afterDiscussion.runtime.stage,
        drift,
        checkpointPath,
      })
      emitAutopilotEvent(projectRoot, "snapshot", {
        activeProjectId: projectId,
        projects,
        discussion,
        ...(await createSnapshot(projectRoot, undefined, { rootDir, projectId })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      })

      if (drift.status === "blocked") {
        const canAdvanceDespiteGuard = discussion.writebackSkipped && afterDiscussion.runtime.stage !== "complete"
        if (!canAdvanceDespiteGuard) {
          await markAutopilot(projectRoot, {
            running: false,
            stopRequested: true,
            mode: "idle",
            lastStep: "guard_blocked",
            statusMessage: `自动创作已因严重目标漂移暂停：${drift.reason}`,
          }, autopilotStateStore(rootDir, projectId))
          if (jobId) {
            await withFactoryDb(rootDir, async (db) => db.failJob(jobId, drift.reason, leaseOwner)).catch(() => undefined)
          }
          break
        }

        await markAutopilot(projectRoot, {
          driftStatus: "correcting",
          lastStep: `guard_recoverable:${afterDiscussion.runtime.stage}`,
          statusMessage: `讨论输出被阶段守卫隔离，未写入生产共识；无人值守流程继续按状态机推进：${drift.reason}`,
        }, autopilotStateStore(rootDir, projectId))
      }

      if (drift.status === "correcting") {
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
          resultingStage: afterDiscussion.runtime.stage,
          driftStatus: drift.status,
        })
        correctionMessage = [
          "上一轮出现目标漂移，请立即纠偏。",
          `漂移原因：${drift.reason}`,
          `原始小说目标：${afterDiscussion.project.idea}`,
          `当前阶段：${afterDiscussion.runtime.stage}`,
          "只允许围绕当前阶段和当前资产继续，不要等待用户选择，不要跳到无关章节。",
        ].join("\n")
        continue
      }

      if (await shouldStopAutopilot(projectRoot, rootDir, projectId)) {
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
          resultingStage: afterDiscussion.runtime.stage,
          driftStatus: drift.status,
        })
        break
      }

      await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
        resultingStage: afterDiscussion.runtime.stage,
        driftStatus: drift.status,
      })
      const followUpAdvanceCommand = createFollowUpAdvanceCommand(afterDiscussion, directorCommand)
      activeDirectorCommand = followUpAdvanceCommand
      await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_DECIDED", followUpAdvanceCommand, {
        parentCommandId: directorCommand.id,
        driftStatus: drift.status,
      })
      await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_STARTED", followUpAdvanceCommand, {
        parentCommandId: directorCommand.id,
      })

      const isSemi = afterDiscussion.project?.autoMode === "semi"
      if (isSemi) {
        const pauseMessage = `讨论共识已写回，已暂停在 ${afterDiscussion.runtime.stage} 阶段，等待用户审阅确认成果。`
        await markAutopilot(projectRoot, {
          running: false,
          stopRequested: false,
          mode: "idle",
          lastStep: "semi_auto_paused",
          statusMessage: pauseMessage,
        }, autopilotStateStore(rootDir, projectId))
        if (jobId) {
          await withFactoryDb(rootDir, async (db) => db.pauseJob(jobId, leaseOwner)).catch(() => undefined)
        }
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: afterDiscussion.runtime.stage,
          message: pauseMessage,
        })
        break
      }

      emitAutopilotEvent(projectRoot, "autopilot_status", {
        stage: afterDiscussion.runtime.stage,
        message: followUpAdvanceCommand.reason,
      })
      await markAutopilot(projectRoot, {
        lastStep: `advance:${afterDiscussion.runtime.stage}`,
        statusMessage: "讨论结论已写回，正在自动推进工作流。",
      }, autopilotStateStore(rootDir, projectId))

      const { state: advanced } = await executeProductionAdvanceThroughKernel({
        rootDir: projectRoot,
        factoryRootDir: rootDir,
        projectId: projectId as string,
        state: afterDiscussion,
        executionMode: "production",
        externalRunId: followUpAdvanceCommand.id,
        metadata: { directorCommandId: followUpAdvanceCommand.id, source: "autopilot-after-discussion" },
      }, () => advanceAutonomousProject(projectRoot, {
        factoryRootDir: rootDir,
        projectId,
        directorCommandId: followUpAdvanceCommand.id,
        preferDeterministicPlanning: true,
        signal,
        onProgress: async (event) => {
          emitAutopilotEvent(projectRoot, "writing_progress", event)
        },
      }))
      const advanceCheckpoint = await writeAutopilotCheckpoint(projectRoot, advanced, `advance-${advanced.runtime.stage}`, {
        previousStage: afterDiscussion.runtime.stage,
        directorCommandId: followUpAdvanceCommand.id,
        parentDirectorCommandId: directorCommand.id,
      })
      try {
        await upsertCheckpointInSuperGraph(projectRoot, {
          path: advanceCheckpoint,
          label: `advance-${advanced.runtime.stage}`,
        }, {
          factoryRootDir: rootDir,
          projectId,
        })
      } catch {
        // Graph repair can be run for older workspaces; keep autopilot moving.
      }
      await markAutopilot(projectRoot, {
        checkpointPath: advanceCheckpoint,
      }, autopilotStateStore(rootDir, projectId))
      emitAutopilotEvent(projectRoot, "snapshot", {
        activeProjectId: projectId,
        projects,
        ...(await createSnapshot(projectRoot, advanced, { rootDir, projectId })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      })

      const advancedFullyComplete = advanced.runtime.stage === "complete"
        ? await isBookFullyComplete(rootDir, projectId, advanced)
        : false
      if (advancedFullyComplete) {
        if (jobId) {
          await withFactoryDb(rootDir, async (db) => db.completeJob(jobId, leaseOwner)).catch(() => undefined)
        }
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", followUpAdvanceCommand, {
          resultingStage: advanced.runtime.stage,
          driftStatus: drift.status,
          parentCommandId: directorCommand.id,
        })
        break
      }
      if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, advanced)) {
        break
      }
      await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", followUpAdvanceCommand, {
        resultingStage: advanced.runtime.stage,
        driftStatus: drift.status,
        parentCommandId: directorCommand.id,
      })
      networkRetryAttempt = 0
      await backoffIfNoWorkflowProgress(rootDir, projectRoot, projectId, afterDiscussion, advanced, signal)
      } catch (error) {
        if (isAutopilotStopError(error) || signal.aborted) {
          throw error
        }
        const transientKind = classifyTransientNetworkError(error)
        if (!transientKind) {
          throw error
        }
        networkRetryAttempt += 1
        const delayMs = nextNetworkRetryDelay(networkRetryAttempt, transientKind)
        const message = error instanceof Error ? error.message : String(error)
        const retryDescription = describeTransientNetworkError(transientKind)
        if (activeDirectorCommand) {
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_FAILED", activeDirectorCommand, {
            error: message,
            recoverable: true,
            retryAttempt: networkRetryAttempt,
            transientKind,
          })
        }
        if (jobId) {
          await withFactoryDb(rootDir, async (db) => db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null)
        }
        await markAutopilot(projectRoot, {
          running: true,
          stopRequested: false,
          mode,
          lastStep: "network_retry",
          driftStatus: "correcting",
          driftReason: message,
          statusMessage: `${retryDescription.statusPrefix}，${Math.round(delayMs / 1000)} 秒后自动重试：${message}`,
        }, autopilotStateStore(rootDir, projectId))
        emitAutopilotEvent(projectRoot, "network_retry", {
          attempt: networkRetryAttempt,
          retryInMs: delayMs,
          message,
          transientKind,
        })
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: (await loadAutonomousState(projectRoot)).runtime.stage,
          message: `${retryDescription.eventMessage} 第 ${networkRetryAttempt} 次重试。`,
        })
        await sleep(delayMs, signal)
        continue
      }
    }
  } finally {
    stopLeaseHeartbeat()
    const latestState = await loadAutonomousState(projectRoot)
    const recoveryBlocked = findRecoveryBlockedTask(latestState)
    const fullyComplete = await isBookFullyComplete(rootDir, projectId, latestState)
    if (jobId && !fullyComplete && !recoveryBlocked) {
      await withFactoryDb(rootDir, async (db) => {
        const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : []
        const currentJob = jobs.find((job) => job.id === jobId)
        if (currentJob?.status === "running") {
          db.pauseJob(jobId, leaseOwner)
        }
      }).catch(() => undefined)
    }
    const previousAutopilot = (latestState.runtime.autopilot as any) || {}
    const isSemiPaused = previousAutopilot.lastStep === "semi_auto_paused"
    const isGuardBlocked = previousAutopilot.lastStep === "guard_blocked"
    const isNetworkRetryPaused = previousAutopilot.lastStep === "network_retry_paused"

    const finalLastStep = isSemiPaused
      ? "semi_auto_paused"
      : isGuardBlocked
        ? "guard_blocked"
        : isNetworkRetryPaused
          ? "network_retry_paused"
          : recoveryBlocked
            ? "recovery_blocked"
            : "stopped"

    const finalStatusMessage = fullyComplete
      ? "自动创作已完成全部章节任务。"
      : recoveryBlocked
        ? `自动创作已暂停：第 ${recoveryBlocked.chapterNumber} 章达到自动恢复上限，需要人工审阅。`
        : isSemiPaused || isGuardBlocked || isNetworkRetryPaused
          ? (latestState.runtime.statusMessage || previousAutopilot.statusMessage || "自动创作已停止，进度和讨论记录已保存。")
          : "自动创作已停止，进度和讨论记录已保存。"

    const finalState = await markAutopilot(projectRoot, {
      running: false,
      stopRequested: false,
      lastStep: finalLastStep,
      mode: "idle",
      driftStatus: recoveryBlocked ? "blocked" : latestState.runtime.autopilot?.driftStatus,
      driftReason: recoveryBlocked ? `第 ${recoveryBlocked.chapterNumber} 章达到自动恢复上限。` : latestState.runtime.autopilot?.driftReason,
      statusMessage: finalStatusMessage,
    }, autopilotStateStore(rootDir, projectId))
    emitAutopilotEvent(projectRoot, "complete", {
      activeProjectId: projectId,
      projects,
      ...(await createSnapshot(projectRoot, finalState, { rootDir, projectId })),
      envStatus: getPublicProjectEnvStatus(rootDir),
    })
  }
}

async function markInterruptedWritingProgress(
  rootDir: string,
  projectId: string | null,
  state: AutonomousNovelState,
  reason: string,
) {
  if (!projectId) {
    return
  }
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "in_progress")
  if (!task) {
    return
  }
  const now = new Date().toISOString()
  const messageId = `writing-${task.chapterNumber}-autopilot-aborted`
  await withFactoryDb(rootDir, async (db) => {
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId,
      step: "autopilot_aborted",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "failed",
      phase: "failed",
      statusText: "无人值守任务被中断，等待恢复后重新执行。",
      message: `第 ${task.chapterNumber} 章的当前模型请求已中断：${reason}`,
      timestamp: now,
    })
    db.markStreamingMessagesFailed(projectId, {
      conversationId: `writing:${projectId}`,
      chapterNumber: task.chapterNumber,
      reason,
    })
  }).catch(() => undefined)
}

export function ensureAutopilotJob(options: AutopilotStartOptions) {
  const existing = autopilotJobs.get(options.projectRoot)
  if (existing) {
    if (!options.jobId || existing.jobId === options.jobId) {
      return existing
    }
    if (!existing.jobId) {
      autopilotJobs.delete(options.projectRoot)
    } else {
      return existing
    }
  }

  const controller = new AbortController()
  const job: AutopilotJob = {
    projectRoot: options.projectRoot,
    jobId: options.jobId,
    controller,
    listeners: new Set(),
    promise: Promise.resolve(),
  }
  job.promise = runAutopilotBackground(options, controller)
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (controller.signal.aborted || isAutopilotStopError(error)) {
        const latestState = await loadAutonomousState(options.projectRoot).catch(() => null)
        if (latestState) {
          await markInterruptedWritingProgress(options.rootDir, options.projectId, latestState, message)
        }
        if (options.jobId) {
          await withFactoryDb(options.rootDir, async (db) => {
            const jobs = options.projectId ? db.listProjectJobs(options.projectId, "autopilot") : []
            const currentJob = jobs.find((entry) => entry.id === options.jobId)
            if (currentJob?.status === "running" || currentJob?.status === "paused") {
              db.pauseJob(options.jobId as string)
            }
          }).catch(() => undefined)
        }
        await markAutopilot(options.projectRoot, {
          running: false,
          stopRequested: false,
          mode: "idle",
          lastStep: "stopped",
          statusMessage: "自动创作已暂停，当前模型请求已中断；任务仍可从数据库恢复。",
        }, autopilotStateStore(options.rootDir, options.projectId))
        emitAutopilotEvent(options.projectRoot, "complete", { stopped: true })
        return
      }
      if (isTransientNetworkError(error)) {
        const transientKind = classifyTransientNetworkError(error) || "connection"
        const retryDescription = describeTransientNetworkError(transientKind)
        if (options.jobId) {
          await withFactoryDb(options.rootDir, async (db) => db.pauseJob(options.jobId as string)).catch(() => undefined)
        }
        await markAutopilot(options.projectRoot, {
          running: false,
          stopRequested: false,
          mode: "idle",
          lastStep: "network_retry_paused",
          driftStatus: "correcting",
          driftReason: message,
          statusMessage: `${retryDescription.statusPrefix}，无人值守任务已保留为可恢复状态：${message}`,
        }, autopilotStateStore(options.rootDir, options.projectId))
        emitAutopilotEvent(options.projectRoot, "network_retry_paused", { error: message, transientKind })
        return
      }
      if (options.jobId) {
        await withFactoryDb(options.rootDir, async (db) => db.failJob(options.jobId as string, message)).catch(() => undefined)
      }
      await markAutopilot(options.projectRoot, {
        running: false,
        stopRequested: false,
        mode: "idle",
        lastStep: "error",
        driftStatus: "blocked",
        driftReason: message,
        statusMessage: `自动创作运行失败：${message}`,
      }, autopilotStateStore(options.rootDir, options.projectId))
      emitAutopilotEvent(options.projectRoot, "error", { error: message })
    })
    .finally(() => {
      autopilotJobs.delete(options.projectRoot)
    })
  autopilotJobs.set(options.projectRoot, job)
  return job
}

export function stopAutopilotJob(projectRoot: string) {
  const job = autopilotJobs.get(projectRoot)
  if (!job) {
    return false
  }
  job.controller.abort()
  autopilotJobs.delete(projectRoot) // 立刻从运行中 Map 中删除，防止异步时序竞争导致外部状态 API 依旧读取到 running=true
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    message: "已收到停止请求，正在中断当前模型请求并保存进度。",
  })
  return true
}

async function runKnowledgeJobs(rootDir: string) {
  await backfillPendingKnowledgeEmbeddings(rootDir, { limit: 100 }).catch(() => undefined)
  const projects = await listAutonomousProjects(rootDir).catch(() => [])
  await ensureKnowledgeBootstrapJobs(rootDir, projects)
  const jobs = await withFactoryDb(rootDir, async (db) =>
    db.listRunnableJobs(undefined, new Date(), { includeIdle: true })
      .filter((job) => String(job.kind || "").startsWith("knowledge_")),
  ).catch(() => [])
  const owner = makeWorkerOwner()
  for (const job of jobs) {
    if (typeof job.id !== "string") {
      continue
    }
    const claimed = await withFactoryDb(rootDir, async (db) =>
      db.claimJob(job.id as string, owner, KNOWLEDGE_JOB_LEASE_SECONDS, new Date(), { includeIdle: true }),
    ).catch(() => null)
    if (!claimed) {
      continue
    }
    const payload = typeof claimed.payload === "object" && claimed.payload ? claimed.payload as Record<string, unknown> : {}
    try {
      if (claimed.kind === "knowledge_global_bootstrap" || claimed.kind === "knowledge_global_reindex") {
        const limit = Number(payload.limit)
        await ingestGlobalWritingResources(rootDir, {
          limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
        })
      } else if (claimed.kind === "knowledge_project_artifact") {
        const projectId = typeof claimed.project_id === "string" ? claimed.project_id : typeof payload.projectId === "string" ? payload.projectId : ""
        const project = projects.find((entry) => entry.id === projectId)
        const artifactPath = typeof payload.artifactPath === "string" ? payload.artifactPath : ""
        if (!project || !artifactPath) {
          throw new Error("knowledge_project_artifact job is missing project or artifactPath")
        }
        const projectRoot = await resolveManagedProjectRoot(rootDir, project.id)
        await ingestProjectArtifact({
          rootDir,
          projectId: project.id,
          projectRoot,
          artifactPath,
          kind: typeof payload.kind === "string" ? payload.kind : "artifact",
          metadata: typeof payload.metadata === "object" && payload.metadata ? payload.metadata as Record<string, unknown> : {},
        })
      }
      await withFactoryDb(rootDir, async (db) => db.completeJob(claimed.id as string, owner)).catch(() => undefined)
    } catch (error) {
      await withFactoryDb(rootDir, async (db) =>
        db.failJob(claimed.id as string, error instanceof Error ? error.message : String(error), owner),
      ).catch(() => undefined)
    }
  }
}

export async function restoreAutopilotJobs(rootDir: string, createSnapshot: AutopilotSnapshotFactory) {
  await backfillPendingMemoryEmbeddings(rootDir, { limit: 50 }).catch(() => undefined)
  await runKnowledgeJobs(rootDir).catch(() => undefined)
  const projects = await listAutonomousProjects(rootDir)
  const jobs = await withFactoryDb(rootDir, async (db) => {
    db.pruneProjectsExcept(projects.map((project) => project.id))
    db.recoverStaleRuns()
    return db.listRunnableJobs("autopilot")
  }).catch(() => [])
  if (!jobs.length) {
    return
  }

  const seenProjectIds = new Set<string>()
  for (const job of jobs) {
    const projectId = typeof job.project_id === "string" ? job.project_id : null
    const project = projectId ? projects.find((entry) => entry.id === projectId) : null
    if (!project || typeof job.id !== "string") {
      continue
    }
    if (seenProjectIds.has(project.id)) {
      await withFactoryDb(rootDir, async (db) => {
        db.cancelJob(job.id as string)
        db.recordEvent(project.id, typeof job.run_id === "string" ? job.run_id : null, "JOB_DEDUPED", {
          id: job.id,
          kind: job.kind,
          reason: "Another autopilot job is already scheduled for restore.",
        })
      }).catch(() => undefined)
      continue
    }
    seenProjectIds.add(project.id)
    if (process.env.AI_NOVEL_TEST_MODE === "1" && process.env.AI_NOVEL_TEST_FORCE_WORKER !== "1") {
      await withFactoryDb(rootDir, async (db) => {
        db.recordEvent(project.id, typeof job.run_id === "string" ? job.run_id : null, "JOB_RESTORE_READY", {
          id: job.id,
          kind: job.kind,
          status: job.status,
          leaseExpiresAt: job.lease_expires_at ?? null,
        })
      }).catch(() => undefined)
      continue
    }
    const projectRoot = await resolveManagedProjectRoot(rootDir, project.id).catch(() => null)
    if (!projectRoot || autopilotJobs.has(projectRoot)) {
      continue
    }
    const state = await loadAutonomousState(projectRoot).catch(() => null)
    const autopilot = state?.runtime?.autopilot || null
    const payload = typeof job.payload === "object" && job.payload ? job.payload as Record<string, unknown> : {}
    const message = typeof payload.message === "string" ? payload.message : ""
    const hasWakeupSignal = isGenericAutopilotMessage(message)

    const manuallyPaused = Boolean(
      autopilot
      && !autopilot.running
      && (
        autopilot.stopRequested 
        || autopilot.lastStep === "stopped"
        || (autopilot.lastStep === "semi_auto_paused" && !hasWakeupSignal)
      ),
    )
    if (manuallyPaused) {
      continue
    }
    ensureAutopilotJob({
      rootDir,
      projectRoot,
      projectId: project.id,
      projects,
      initialMessage: message,
      mode: "background",
      jobId: job.id,
      createSnapshot,
    })
  }
}

export function scheduleAutopilotRestore(rootDir: string, createSnapshot: AutopilotSnapshotFactory) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return null
  }
  return setInterval(() => {
    void restoreAutopilotJobs(rootDir, createSnapshot)
  }, AUTOPILOT_RESTORE_POLL_MS)
}

export async function startAutopilotWorkerRuntime(options: AutopilotWorkerRuntimeOptions) {
  await restoreAutopilotJobs(options.rootDir, options.createSnapshot)
  if (process.env.AI_NOVEL_TEST_MODE === "1" && process.env.AI_NOVEL_TEST_FORCE_WORKER !== "1") {
    return {
      close: () => undefined,
    }
  }

  const timer = setInterval(() => {
    void restoreAutopilotJobs(options.rootDir, options.createSnapshot)
  }, options.pollMs ?? AUTOPILOT_RESTORE_POLL_MS)

  return {
    close: () => clearInterval(timer),
  }
}
