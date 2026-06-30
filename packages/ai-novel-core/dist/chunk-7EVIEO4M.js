import {
  createFollowUpAdvanceCommand,
  createManualAdvanceCommand,
  createManualInterruptCommand,
  createManualRetryChapterCommand,
  decideNovelDirectorCommand,
  isGenericAutopilotMessage
} from "./chunk-UIQAXZB3.js";
import {
  advanceAutonomousProject,
  getPublicProjectEnvStatus,
  listAutonomousProjects,
  loadAutonomousState,
  resolveManagedProjectRoot,
  retryChapterProduction,
  reviewInterruption,
  runMultiAgentDiscussion,
  saveAutonomousState,
  upsertCheckpointInSuperGraph
} from "./chunk-KXL2FONS.js";
import {
  createAutopilotStopError,
  isAutopilotStopError,
  throwIfStopped
} from "./chunk-SK3T47GJ.js";
import {
  backfillPendingKnowledgeEmbeddings,
  ingestGlobalWritingResources,
  ingestProjectArtifact
} from "./chunk-Q7A3BTJU.js";
import {
  backfillPendingMemoryEmbeddings,
  withFactoryDb
} from "./chunk-XEYMG4OS.js";

// src/director-commands.ts
async function recordDirectorCommandEvent(options, type, command, payload = {}) {
  if (!options.factoryRootDir || !options.projectId) {
    return;
  }
  await withFactoryDb(options.factoryRootDir, async (db) => db.recordEvent(options.projectId, null, type, {
    commandId: command.id,
    command: command.type,
    stage: command.stage,
    chapterNumber: "chapterNumber" in command ? command.chapterNumber : void 0,
    reason: command.reason,
    source: options.source || "manual",
    ...payload
  })).catch(() => void 0);
}
function baseEventPayload(options) {
  return options.requestedBy ? { requestedBy: options.requestedBy } : {};
}
async function executeManualAdvanceCommand(rootDir, options = {}) {
  const beforeState = await loadAutonomousState(rootDir);
  const command = createManualAdvanceCommand(beforeState, options.reason);
  const basePayload = baseEventPayload(options);
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_DECIDED", command, basePayload);
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_STARTED", command, basePayload);
  try {
    const state = await advanceAutonomousProject(rootDir, {
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId,
      directorCommandId: command.id
    });
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_COMPLETED", command, {
      ...basePayload,
      resultingStage: state.runtime.stage
    });
    return { state, command };
  } catch (error) {
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_FAILED", command, {
      ...basePayload,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
async function executeManualRetryChapterCommand(rootDir, chapterNumber, options = {}) {
  const beforeState = await loadAutonomousState(rootDir);
  const command = createManualRetryChapterCommand(beforeState, chapterNumber, options.reason);
  const basePayload = baseEventPayload(options);
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_DECIDED", command, basePayload);
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_STARTED", command, basePayload);
  try {
    const state = await retryChapterProduction(rootDir, chapterNumber, {
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId,
      directorCommandId: command.id,
      runNow: options.runNow,
      maxRecoveryAttempts: options.maxRecoveryAttempts
    });
    const recoveryLimited = Boolean(state.plan.chapterTasks.find((task) => task.chapterNumber === chapterNumber)?.recoveryBlocked);
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_COMPLETED", command, {
      ...basePayload,
      resultingStage: state.runtime.stage,
      recoveryLimited
    });
    return { state, command, recoveryLimited };
  } catch (error) {
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_FAILED", command, {
      ...basePayload,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
async function executeManualInterruptCommand(rootDir, message, options = {}) {
  const beforeState = await loadAutonomousState(rootDir);
  const command = createManualInterruptCommand(beforeState, message, options.reason);
  const basePayload = baseEventPayload(options);
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_DECIDED", command, basePayload);
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_STARTED", command, basePayload);
  try {
    const review = await reviewInterruption({
      rootDir,
      message,
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId,
      directorCommandId: command.id
    });
    const state = await loadAutonomousState(rootDir);
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_COMPLETED", command, {
      ...basePayload,
      resultingStage: state.runtime.stage,
      interruptionScope: review.scope
    });
    return { state, command };
  } catch (error) {
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_FAILED", command, {
      ...basePayload,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// src/autopilot-worker.ts
import fs from "fs/promises";
import path from "path";
var autopilotJobs = /* @__PURE__ */ new Map();
var AUTOPILOT_LEASE_SECONDS = 60;
var AUTOPILOT_RESTORE_POLL_MS = Math.max(1, AUTOPILOT_LEASE_SECONDS) * 1e3;
var AUTOPILOT_HEARTBEAT_MS = Math.max(5e3, Math.floor(AUTOPILOT_LEASE_SECONDS * 1e3 / 3));
var AUTOPILOT_NETWORK_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 10 : 5e3;
var AUTOPILOT_NETWORK_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 20 : 6e4;
var AUTOPILOT_PROVIDER_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 12 : 1e4;
var AUTOPILOT_PROVIDER_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 24 : 9e4;
var AUTOPILOT_RATE_LIMIT_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 15 : 15e3;
var AUTOPILOT_RATE_LIMIT_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 30 : 12e4;
var AUTOPILOT_NO_PROGRESS_BACKOFF_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 10 : 15e3;
var AUTOPILOT_STALE_LLM_REQUEST_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 25 : 18e4;
var KNOWLEDGE_JOB_LEASE_SECONDS = 120;
var ACTIVE_WRITING_MESSAGE_STATUSES = ["queued", "streaming"];
function makeWorkerOwner() {
  return `worker:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}
async function ensureKnowledgeBootstrapJobs(rootDir, projects) {
  await withFactoryDb(rootDir, async (db) => {
    for (const project of projects) {
      const snapshot = db.getSnapshot(project.id);
      const summary = snapshot.knowledge?.summary || {};
      const knowledgeJobs = db.listProjectJobs(project.id).filter((job) => String(job.kind || "").startsWith("knowledge_"));
      const hasRunnableKnowledgeJob = knowledgeJobs.some((job) => job.status === "idle" || job.status === "running" || job.status === "paused");
      if (hasRunnableKnowledgeJob) {
        continue;
      }
      const queuedJobs = [];
      if (Number(summary.globalSources || 0) === 0) {
        const id = db.createJob({
          projectId: project.id,
          kind: "knowledge_global_bootstrap",
          status: "idle",
          payload: {
            scope: "global",
            reason: "worker_bootstrap_missing_global_index",
            limit: process.env.AI_NOVEL_TEST_MODE === "1" ? 4 : void 0
          }
        });
        queuedJobs.push({ id, kind: "knowledge_global_bootstrap" });
      }
      if (Number(summary.projectSources || 0) === 0) {
        const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
        const artifactPaths = [...new Set(artifacts.map((artifact) => String(artifact.path || "")).filter(
          (artifactPath) => artifactPath.endsWith(".md") && (artifactPath.includes("global-consensus.md") || artifactPath.includes("current-context.md") || artifactPath.includes("discussion-log.md") || artifactPath.includes("setting-freeze.md") || artifactPath.includes("master-outline.md") || artifactPath.includes("chapter-blueprints/") || artifactPath.includes(".final.md") || artifactPath.includes("-quality.md") || artifactPath.includes("-memory.md") || artifactPath.includes("production-resources/"))
        ))];
        for (const artifactPath of artifactPaths.slice(0, 80)) {
          const id = db.createJob({
            projectId: project.id,
            kind: "knowledge_project_artifact",
            status: "idle",
            payload: {
              projectId: project.id,
              artifactPath,
              kind: "artifact",
              reason: "worker_bootstrap_missing_project_index"
            }
          });
          queuedJobs.push({ id, kind: "knowledge_project_artifact", artifactPath });
        }
      }
      if (queuedJobs.length > 0) {
        db.recordEvent(project.id, null, "KNOWLEDGE_BOOTSTRAP_QUEUED", {
          reason: "worker_bootstrap_missing_index",
          jobs: queuedJobs
        });
      }
    }
  }).catch(() => void 0);
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAutopilotStopError());
      return;
    }
    let timer;
    const abortSleep = () => {
      clearTimeout(timer);
      reject(createAutopilotStopError());
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", abortSleep);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abortSleep, { once: true });
  });
}
function readJsonObject(value) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function isTransientNetworkError(error) {
  return classifyTransientNetworkError(error) !== null;
}
function classifyTransientNetworkError(error) {
  if (isAutopilotStopError(error)) {
    return null;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/429|rate limit|too many requests|quota/i.test(message)) {
    return "rate_limit";
  }
  if (/503|502|504|temporar|unavailable|overloaded|bad gateway|gateway timeout/i.test(message)) {
    return "provider_unavailable";
  }
  if (/timeout|timed\s*out|timed-out/i.test(message)) {
    return "timeout";
  }
  if (/network|fetch|failed|econn|enotfound|etimedout|socket|undici|dns|connect|connection reset/i.test(message)) {
    return "connection";
  }
  return null;
}
function nextNetworkRetryDelay(attempt, kind = "connection") {
  const exponent = 2 ** Math.max(0, attempt - 1);
  if (kind === "rate_limit") {
    return Math.min(AUTOPILOT_RATE_LIMIT_RETRY_BASE_MS * exponent, AUTOPILOT_RATE_LIMIT_RETRY_MAX_MS);
  }
  if (kind === "provider_unavailable") {
    return Math.min(AUTOPILOT_PROVIDER_RETRY_BASE_MS * exponent, AUTOPILOT_PROVIDER_RETRY_MAX_MS);
  }
  return Math.min(AUTOPILOT_NETWORK_RETRY_BASE_MS * exponent, AUTOPILOT_NETWORK_RETRY_MAX_MS);
}
function describeTransientNetworkError(kind) {
  if (kind === "rate_limit") {
    return {
      statusPrefix: "\u6A21\u578B\u670D\u52A1\u89E6\u53D1\u9650\u6D41\uFF0C\u6B63\u5728\u6309\u9000\u907F\u7B56\u7565\u81EA\u52A8\u91CD\u8BD5",
      eventMessage: "\u6A21\u578B\u670D\u52A1\u89E6\u53D1\u9650\u6D41\uFF0C\u7CFB\u7EDF\u5C06\u653E\u6162\u8282\u594F\u540E\u7EE7\u7EED\u65E0\u4EBA\u503C\u5B88\u6D41\u7A0B\u3002"
    };
  }
  if (kind === "provider_unavailable") {
    return {
      statusPrefix: "\u6A21\u578B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u6B63\u5728\u7B49\u5F85\u670D\u52A1\u6062\u590D\u540E\u81EA\u52A8\u91CD\u8BD5",
      eventMessage: "\u6A21\u578B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u7CFB\u7EDF\u6B63\u5728\u7B49\u5F85\u670D\u52A1\u6062\u590D\u540E\u7EE7\u7EED\u65E0\u4EBA\u503C\u5B88\u6D41\u7A0B\u3002"
    };
  }
  if (kind === "timeout") {
    return {
      statusPrefix: "\u6A21\u578B\u54CD\u5E94\u8D85\u65F6\uFF0C\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5",
      eventMessage: "\u6A21\u578B\u54CD\u5E94\u8D85\u65F6\uFF0C\u7CFB\u7EDF\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5\u5E76\u4FDD\u7559\u5F53\u524D\u65E0\u4EBA\u503C\u5B88\u8FDB\u5EA6\u3002"
    };
  }
  return {
    statusPrefix: "\u7F51\u7EDC\u8FDE\u63A5\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5",
    eventMessage: "\u7F51\u7EDC\u8FDE\u63A5\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u7CFB\u7EDF\u6B63\u5728\u7B49\u5F85\u6062\u590D\u540E\u7EE7\u7EED\u65E0\u4EBA\u503C\u5B88\u6D41\u7A0B\u3002"
  };
}
function workflowProgressSignature(state) {
  const tasks = state.plan.chapterTasks || [];
  const counts = {
    complete: tasks.filter((task) => task.status === "complete").length,
    pending: tasks.filter((task) => task.status === "pending").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length
  };
  const firstActive = tasks.find((task) => task.status !== "complete");
  return [
    state.runtime.stage,
    state.runtime.lastAction || "",
    state.plan.pendingChapters,
    counts.complete,
    counts.pending,
    counts.inProgress,
    counts.blocked,
    firstActive ? `${firstActive.chapterNumber}:${firstActive.status}:${firstActive.recoveryAttempts || 0}` : "none"
  ].join("|");
}
function hasEarlierActiveTask(state, chapterNumber) {
  return state.plan.chapterTasks.some((task) => task.chapterNumber < chapterNumber && (task.status === "in_progress" || task.status === "blocked"));
}
async function findActiveWritingMessage(rootDir, projectId, chapterNumber) {
  if (!projectId || !chapterNumber) {
    return null;
  }
  return withFactoryDb(rootDir, async (db) => {
    const messages = db.listMessages(projectId, {
      conversationId: `writing:${projectId}`,
      limit: 12
    });
    return messages.find((message) => {
      if (!ACTIVE_WRITING_MESSAGE_STATUSES.includes(message.status)) {
        return false;
      }
      const metadata = message.metadata && typeof message.metadata === "object" ? message.metadata : {};
      return Number(metadata.chapterNumber) === chapterNumber;
    }) || null;
  }).catch(() => null);
}
async function recoverOrphanedInProgressWritingTask(rootDir, projectRoot, projectId, state) {
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "in_progress");
  if (!projectId || !task) {
    return { recovered: false, state };
  }
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, task.chapterNumber);
  if (activeWritingMessage) {
    return { recovered: false, state };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  task.status = "pending";
  task.recoveryBlocked = false;
  task.recoveryQueuedAt = now;
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = `\u7B2C ${task.chapterNumber} \u7AE0\u7684\u6267\u884C\u8BF7\u6C42\u5DF2\u4E22\u5931\uFF0C\u5DF2\u81EA\u52A8\u6062\u590D\u4E3A\u5F85\u5199\u4F5C\u5E76\u51C6\u5907\u91CD\u65B0\u6267\u884C\u3002`;
  await saveAutonomousState(projectRoot, state);
  await withFactoryDb(rootDir, async (db) => {
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId: `writing-${task.chapterNumber}-orphaned-task-recovered`,
      step: "orphaned_in_progress_recovered",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      phase: "completed",
      statusText: "\u7AE0\u8282\u6267\u884C\u8BF7\u6C42\u5DF2\u6062\u590D\uFF0C\u7B49\u5F85\u91CD\u65B0\u5199\u4F5C\u3002",
      message: `\u7B2C ${task.chapterNumber} \u7AE0\u5904\u4E8E in_progress\uFF0C\u4F46\u6CA1\u6709\u6D3B\u52A8\u4E2D\u7684 LLM \u6D88\u606F\uFF0C\u7CFB\u7EDF\u5DF2\u91CD\u65B0\u6392\u961F\u3002`,
      timestamp: now
    });
    db.recordEvent(projectId, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: task.chapterNumber,
      status: "pending",
      reason: "orphaned_in_progress_recovered",
      recoveryAttempts: task.recoveryAttempts || 0,
      recoveryQueuedAt: task.recoveryQueuedAt
    });
    db.updateProjectState(projectId, state);
  }).catch(() => void 0);
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message: state.runtime.statusMessage,
    dedupeKey: `orphaned-in-progress-recovered:${task.chapterNumber}:${task.recoveryQueuedAt}`
  });
  return { recovered: true, state };
}
function messageUpdatedMs(message) {
  if (!message) {
    return 0;
  }
  const candidates = [
    message.updated_at,
    message.updatedAt,
    message.time,
    message.created_at,
    message.createdAt
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}
function activeWritingMessageAgeMs(message, now = Date.now()) {
  const updatedAt = messageUpdatedMs(message);
  return updatedAt > 0 ? Math.max(0, now - updatedAt) : 0;
}
async function recoverStaleWritingRequest(rootDir, projectRoot, projectId, state) {
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "in_progress" || candidate.status === "blocked");
  if (!projectId || !task) {
    return { recovered: false, state };
  }
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, task.chapterNumber);
  if (!activeWritingMessage) {
    return { recovered: false, state };
  }
  const ageMs = activeWritingMessageAgeMs(activeWritingMessage);
  if (ageMs < AUTOPILOT_STALE_LLM_REQUEST_MS) {
    return { recovered: false, state };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const reason = `stale LLM writing message ${String(activeWritingMessage.id || "")} exceeded ${Math.round(AUTOPILOT_STALE_LLM_REQUEST_MS / 1e3)}s without progress`;
  task.status = "pending";
  task.recoveryAttempts = (task.recoveryAttempts || 0) + 1;
  task.recoveryBlocked = false;
  task.recoveryQueuedAt = now;
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = `\u7B2C ${task.chapterNumber} \u7AE0\u7684\u4E0A\u4E00\u6B21 LLM \u8BF7\u6C42\u5DF2\u5931\u8054\uFF0C\u5DF2\u81EA\u52A8\u56DE\u6536\u5E76\u91CD\u65B0\u6392\u961F\u3002`;
  await saveAutonomousState(projectRoot, state);
  await withFactoryDb(rootDir, async (db) => {
    db.markStreamingMessagesFailed(projectId, {
      conversationId: `writing:${projectId}`,
      chapterNumber: task.chapterNumber,
      reason
    });
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId: `writing-${task.chapterNumber}-llm-request-stale-recovered`,
      step: "llm_request_stale_recovered",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      phase: "completed",
      statusText: "\u4E0A\u4E00\u6B21 LLM \u8BF7\u6C42\u5931\u8054\uFF0C\u7CFB\u7EDF\u5DF2\u81EA\u52A8\u56DE\u6536\u5E76\u51C6\u5907\u91CD\u8BD5\u3002",
      message: `\u7B2C ${task.chapterNumber} \u7AE0\u7684\u4E0A\u4E00\u6B21\u6A21\u578B\u8BF7\u6C42\u957F\u65F6\u95F4\u6CA1\u6709\u8FDB\u5C55\uFF0C\u5DF2\u6807\u8BB0\u5931\u8D25\u5E76\u91CD\u65B0\u6392\u961F\u3002`,
      staleMessageId: activeWritingMessage.id || null,
      staleAgeMs: ageMs,
      reason,
      timestamp: now
    });
    db.recordEvent(projectId, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: task.chapterNumber,
      status: "pending",
      reason: "stale_llm_request_recovered",
      recoveryAttempts: task.recoveryAttempts,
      recoveryQueuedAt: task.recoveryQueuedAt
    });
    db.updateProjectState(projectId, state);
  }).catch(() => void 0);
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message: state.runtime.statusMessage,
    dedupeKey: `stale-llm-recovered:${task.chapterNumber}:${String(activeWritingMessage.id || "")}`
  });
  return { recovered: true, state };
}
async function backoffIfActiveWritingMessage(rootDir, projectRoot, projectId, state, signal) {
  const waitingTask = state.plan.chapterTasks.find((task) => task.status === "in_progress" || task.status === "blocked");
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, waitingTask?.chapterNumber ?? null);
  if (!waitingTask || !activeWritingMessage) {
    return false;
  }
  const activeMessageAgeMs = activeWritingMessageAgeMs(activeWritingMessage);
  const staleActiveWritingMessage = activeMessageAgeMs >= AUTOPILOT_STALE_LLM_REQUEST_MS;
  const activeMetadata = activeWritingMessage.metadata && typeof activeWritingMessage.metadata === "object" ? activeWritingMessage.metadata : {};
  const activeStep = typeof activeMetadata.step === "string" ? activeMetadata.step : "";
  const activeStatusText = activeWritingMessage.data && typeof activeWritingMessage.data === "object" ? String(activeWritingMessage.data.statusText || "") : "";
  const message = staleActiveWritingMessage ? `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6A21\u578B\u8BF7\u6C42\u5DF2\u8D85\u8FC7\u6062\u590D\u9608\u503C\uFF0C\u4E0B\u4E00\u8F6E\u5C06\u81EA\u52A8\u56DE\u6536\u5E76\u91CD\u8BD5\u3002` : `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6A21\u578B\u8BF7\u6C42\u4ECD\u5728\u6267\u884C\uFF1A${activeStatusText || activeStep || "\u7B49\u5F85\u6A21\u578B\u54CD\u5E94\u6216\u6301\u7EED\u8F93\u51FA\u4E2D\u3002"}`;
  await markAutopilot(projectRoot, {
    lastStep: staleActiveWritingMessage ? "stale_llm_recovery_pending" : "waiting_for_llm",
    statusMessage: message
  }, autopilotStateStore(rootDir, projectId));
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message,
    dedupeKey: `waiting-for-llm:${state.runtime.stage}:${waitingTask.chapterNumber}:${activeStep}`
  });
  await sleep(AUTOPILOT_NO_PROGRESS_BACKOFF_MS, signal);
  return true;
}
async function backoffIfNoWorkflowProgress(rootDir, projectRoot, projectId, before, after, signal) {
  if (workflowProgressSignature(before) !== workflowProgressSignature(after)) {
    return false;
  }
  const latestState = await loadAutonomousState(projectRoot).catch(() => after);
  const latestPendingTask = latestState.plan.chapterTasks.find((task) => task.status === "pending");
  if (latestPendingTask && !hasEarlierActiveTask(latestState, latestPendingTask.chapterNumber)) {
    await markAutopilot(projectRoot, {
      lastStep: "pending_work_detected",
      statusMessage: `\u7B2C ${latestPendingTask.chapterNumber} \u7AE0\u5DF2\u91CD\u65B0\u6392\u961F\uFF0C\u7EE7\u7EED\u63A8\u8FDB\u751F\u4EA7\u72B6\u6001\u673A\u3002`
    }, autopilotStateStore(rootDir, projectId));
    emitAutopilotEvent(projectRoot, "autopilot_status", {
      stage: latestState.runtime.stage,
      message: `\u7B2C ${latestPendingTask.chapterNumber} \u7AE0\u5DF2\u91CD\u65B0\u6392\u961F\uFF0C\u7EE7\u7EED\u63A8\u8FDB\u751F\u4EA7\u72B6\u6001\u673A\u3002`,
      dedupeKey: `pending-work:${latestPendingTask.chapterNumber}:${latestPendingTask.recoveryQueuedAt || ""}`
    });
    return false;
  }
  const waitingTask = after.plan.chapterTasks.find((task) => task.status === "in_progress" || task.status === "blocked");
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, waitingTask?.chapterNumber ?? null);
  const activeMessageAgeMs = activeWritingMessageAgeMs(activeWritingMessage);
  const staleActiveWritingMessage = Boolean(activeWritingMessage && activeMessageAgeMs >= AUTOPILOT_STALE_LLM_REQUEST_MS);
  const activeMetadata = activeWritingMessage?.metadata && typeof activeWritingMessage.metadata === "object" ? activeWritingMessage.metadata : {};
  const activeStep = typeof activeMetadata.step === "string" ? activeMetadata.step : "";
  const activeStatusText = activeWritingMessage?.data && typeof activeWritingMessage.data === "object" ? String(activeWritingMessage.data.statusText || "") : "";
  const activeMessage = waitingTask && activeWritingMessage ? staleActiveWritingMessage ? `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6A21\u578B\u8BF7\u6C42\u5DF2\u8D85\u8FC7\u6062\u590D\u9608\u503C\uFF0C\u4E0B\u4E00\u8F6E\u5C06\u81EA\u52A8\u56DE\u6536\u5E76\u91CD\u8BD5\u3002` : `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6A21\u578B\u8BF7\u6C42\u4ECD\u5728\u6267\u884C\uFF1A${activeStatusText || activeStep || "\u7B49\u5F85\u6A21\u578B\u54CD\u5E94\u6216\u6301\u7EED\u8F93\u51FA\u4E2D\u3002"}` : "";
  const message = activeMessage || (waitingTask ? `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6682\u65E0\u65B0\u8FDB\u5C55\uFF0C\u7CFB\u7EDF\u8FDB\u5165\u77ED\u6682\u9000\u907F\u7B49\u5F85\uFF0C\u907F\u514D\u7A7A\u8F6C\u5237\u5C4F\u3002` : "\u5DE5\u4F5C\u6D41\u6682\u65E0\u65B0\u8FDB\u5C55\uFF0C\u7CFB\u7EDF\u8FDB\u5165\u77ED\u6682\u9000\u907F\u7B49\u5F85\uFF0C\u907F\u514D\u7A7A\u8F6C\u5237\u5C4F\u3002");
  await markAutopilot(projectRoot, {
    lastStep: staleActiveWritingMessage ? "stale_llm_recovery_pending" : activeWritingMessage ? "waiting_for_llm" : "no_progress_backoff",
    statusMessage: message
  }, autopilotStateStore(rootDir, projectId));
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: after.runtime.stage,
    message,
    dedupeKey: activeWritingMessage ? `waiting-for-llm:${after.runtime.stage}:${waitingTask?.chapterNumber || "none"}:${activeStep}` : `no-progress:${after.runtime.stage}:${waitingTask?.chapterNumber || "none"}`
  });
  await sleep(AUTOPILOT_NO_PROGRESS_BACKOFF_MS, signal);
  return true;
}
function emitAutopilotEvent(projectRoot, type, payload) {
  const job = autopilotJobs.get(projectRoot);
  if (!job) return;
  for (const listener of job.listeners) {
    listener({ type, payload });
  }
}
function throwIfAutopilotStopped(signal) {
  throwIfStopped(signal);
}
function startJobLeaseHeartbeat(rootDir, projectId, jobId, leaseOwner, controller) {
  if (!jobId || process.env.AI_NOVEL_TEST_MODE === "1") {
    return () => void 0;
  }
  const timer = setInterval(() => {
    void withFactoryDb(rootDir, async (db) => {
      const lease = db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS);
      const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : [];
      const currentJob = jobs.find((entry) => entry.id === jobId);
      if (!lease || currentJob && currentJob.status !== "running" && currentJob.status !== "paused") {
        controller.abort();
      }
    }).catch(() => void 0);
  }, AUTOPILOT_HEARTBEAT_MS);
  return () => clearInterval(timer);
}
function getAutopilotJob(projectRoot) {
  return autopilotJobs.get(projectRoot) ?? null;
}
function isAutopilotRunning(projectRoot) {
  return autopilotJobs.has(projectRoot);
}
async function markAutopilot(projectRoot, patch, options = {}) {
  const state = await loadAutonomousState(projectRoot);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const current = state.runtime.autopilot || {
    running: false,
    stopRequested: false,
    startedAt: null,
    updatedAt: null,
    lastStep: null,
    mode: "idle",
    target: null,
    driftScore: 0,
    driftStatus: "ok",
    driftReason: null,
    checkpointPath: null,
    loopCount: 0
  };
  state.runtime.autopilot = {
    ...current,
    ...patch,
    startedAt: patch.running && !current.startedAt ? now : current.startedAt,
    updatedAt: now
  };
  if (patch.statusMessage) {
    state.runtime.statusMessage = patch.statusMessage;
  }
  await saveAutonomousState(projectRoot, state);
  if (options.factoryRootDir && options.projectId) {
    await withFactoryDb(options.factoryRootDir, async (db) => db.updateProjectState(options.projectId, state)).catch(() => void 0);
  }
  return state;
}
function autopilotStateStore(rootDir, projectId) {
  return { factoryRootDir: rootDir, projectId };
}
async function recordAutopilotDirectorCommandEvent(rootDir, projectId, type, command, payload = {}) {
  await recordDirectorCommandEvent({
    factoryRootDir: rootDir,
    projectId,
    source: "autopilot"
  }, type, command, payload);
}
async function writeAutopilotCheckpoint(projectRoot, state, label, details = {}) {
  const checkpointDir = path.join(projectRoot, ".ai-novel", "checkpoints");
  await fs.mkdir(checkpointDir, { recursive: true });
  const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "checkpoint";
  const fileName = `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-${safeLabel}.json`;
  const relativePath = `.ai-novel/checkpoints/${fileName}`;
  await fs.writeFile(
    path.join(checkpointDir, fileName),
    `${JSON.stringify({ state, details, createdAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)}
`
  );
  return relativePath;
}
function evaluateAutopilotDrift({
  before,
  after,
  discussionSummary = "",
  intendedMessage = ""
}) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return {
      status: "ok",
      score: 0,
      reasons: []
    };
  }
  const text = `${discussionSummary}
${after.runtime.statusMessage || ""}`.toLowerCase();
  let score = 0;
  const reasons = [];
  const claimsCurrentDrafting = /(当前阶段|当前状态|当前已|已进入|进入)\s*[:：]?\s*(drafting|正文写作|writing)|进入\s*(drafting|正文写作|writing)\s*阶段/i.test(text);
  const hasDraftBodySignal = /(^|\n)\s*(#\s*)?第\s*[一二三四五六七八九十百\d]+\s*章\s*[·:：]|(^|\n)\s*chapter\s+\d+\s*[·:：-]/i.test(text);
  const hasNextStepDrafting = /(下一步|next step|阶段转换指令|首轮产出|准备进入|建议进入|可进入).*?(drafting|正文写作|第\s*\d+\s*章|chapter\s+\d+)/i.test(text);
  if (before.runtime.stage !== "drafting" && (claimsCurrentDrafting || hasDraftBodySignal)) {
    score += 45;
    reasons.push("\u5F53\u524D\u9636\u6BB5\u5C1A\u672A\u8FDB\u5165 drafting\uFF0C\u4F46\u8F93\u51FA\u51FA\u73B0\u7AE0\u8282\u6B63\u6587\u503E\u5411\u3002");
  }
  if (before.runtime.stage !== "master_planning" && before.runtime.stage !== "chapter_task_generation" && /已进入.*(规划|蓝图|第[一二三四五六七八九十\d]+弧)|进入第[一二三四五六七八九十\d]+弧|第[一二三四五六七八九十\d]+弧.*(已完成|总体规划|蓝图设计)/i.test(text)) {
    score += 40;
    reasons.push("\u8BA8\u8BBA\u6587\u672C\u5BA3\u79F0\u8FDB\u5165\u6216\u5B8C\u6210\u540E\u7EED\u89C4\u5212/\u5F27\u7EBF\u84DD\u56FE\uFF0C\u4F46\u72B6\u6001\u673A\u5C1A\u672A\u63A8\u8FDB\u5230\u5BF9\u5E94\u9636\u6BB5\u3002");
  }
  if (before.runtime.stage === "setting_review" && /(当前位置|当前阶段|当前已).*?(master_planning|主线规划|总体规划|章节蓝图|chapter_task_generation)/i.test(text)) {
    score += 35;
    reasons.push("\u5F53\u524D\u4ECD\u662F\u8BBE\u5B9A\u51BB\u7ED3\u9636\u6BB5\uFF0C\u4F46\u8F93\u51FA\u628A\u4E3B\u7EBF\u89C4\u5212\u6216\u7AE0\u8282\u84DD\u56FE\u63CF\u8FF0\u6210\u65E2\u6210\u72B6\u6001\u3002");
  }
  if (before.runtime.stage === "setting_review" && hasNextStepDrafting && !claimsCurrentDrafting && !hasDraftBodySignal) {
    score = Math.max(0, score - 30);
  }
  const ideaTokens = before.project.idea.toLowerCase().split(/[\s,，。！？!?.、]+/).filter((token) => token.length >= 2).slice(0, 6);
  const matchedIdeaToken = ideaTokens.length === 0 || ideaTokens.some((token) => text.includes(token));
  if (!matchedIdeaToken) {
    score += 20;
    reasons.push("\u672C\u8F6E\u6458\u8981\u6CA1\u6709\u660E\u663E\u56DE\u6263\u6700\u521D\u5C0F\u8BF4\u8BBE\u5B9A\u3002");
  }
  const intendedTokens = intendedMessage.toLowerCase().split(/[\s,，。！？!?.、]+/).filter((token) => token.length >= 2).slice(0, 5);
  const matchedIntendedToken = intendedTokens.length === 0 || intendedTokens.some((token) => text.includes(token));
  if (!matchedIntendedToken) {
    score += 15;
    reasons.push("\u672C\u8F6E\u8F93\u51FA\u4E0E\u5F53\u524D\u6267\u884C\u76EE\u6807\u5173\u8054\u504F\u5F31\u3002");
  }
  if (before.runtime.stage === after.runtime.stage && before.plan.pendingChapters === after.plan.pendingChapters) {
    const loopCount = after.runtime.autopilot?.loopCount || 0;
    if (loopCount > 1) {
      score += 10;
      reasons.push("\u8FDE\u7EED\u5FAA\u73AF\u6CA1\u6709\u4EA7\u751F\u9636\u6BB5\u6216\u7AE0\u8282\u8FDB\u5EA6\u53D8\u5316\u3002");
    }
  }
  if (/请选择|等待用户|需要你决定|无法继续|不能继续/i.test(text)) {
    score += 35;
    reasons.push("\u8F93\u51FA\u51FA\u73B0\u7B49\u5F85\u7528\u6237\u9009\u62E9\u6216\u505C\u6B62\u63A8\u8FDB\u7684\u503E\u5411\u3002");
  }
  const status = score >= 70 ? "blocked" : score >= 35 ? "correcting" : "ok";
  return {
    score,
    status,
    reason: reasons.join("\uFF1B") || "\u76EE\u6807\u4E00\u81F4\uFF0C\u672A\u53D1\u73B0\u660E\u663E\u6F02\u79FB\u3002"
  };
}
async function shouldStopAutopilot(projectRoot, rootDir, projectId) {
  const state = await loadAutonomousState(projectRoot);
  if (state.runtime.autopilot?.stopRequested) {
    return true;
  }
  if (state.plan.chapterTasks.some((task) => task.status === "blocked" && task.recoveryBlocked)) {
    return true;
  }
  if (state.runtime.stage !== "complete") {
    return false;
  }
  return isBookFullyComplete(rootDir, projectId, state);
}
function findRecoveryBlockedTask(state) {
  return state.plan.chapterTasks.find((task) => task.status === "blocked" && task.recoveryBlocked) ?? null;
}
function stateTasksAreFullyComplete(state) {
  const tasks = state.plan.chapterTasks;
  return tasks.length > 0 && tasks.every((task) => task.status === "complete");
}
async function isBookFullyComplete(rootDir, projectId, state) {
  if (projectId) {
    const facts = await withFactoryDb(rootDir, async (db) => db.getChapterFacts(projectId)).catch(() => []);
    if (facts.length > 0) {
      const totalChapters = Number(state.plan.totalChapters || state.plan.chapterTasks.length || facts.length);
      const completedFacts = facts.filter((fact) => fact.status === "complete").length;
      return totalChapters > 0 && completedFacts >= totalChapters;
    }
  }
  return stateTasksAreFullyComplete(state);
}
async function reconcileCompleteRuntimeBeforeWorkerDecision(projectRoot, rootDir, projectId, state) {
  if (state.runtime.stage !== "complete") {
    return state;
  }
  if (await isBookFullyComplete(rootDir, projectId, state)) {
    return state;
  }
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = "\u6570\u636E\u5E93\u7AE0\u8282\u8FDB\u5EA6\u663E\u793A\u4ECD\u6709\u5F85\u5904\u7406\u7AE0\u8282\uFF0C\u5DF2\u4ECE\u5B8C\u6210\u6001\u6062\u590D\u5230\u6B63\u6587\u5199\u4F5C\u3002";
  state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length;
  await saveAutonomousState(projectRoot, state);
  if (projectId) {
    await withFactoryDb(rootDir, async (db) => db.updateProjectState(projectId, state)).catch(() => void 0);
  }
  return state;
}
async function markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, state) {
  const task = findRecoveryBlockedTask(state);
  if (!task) {
    return false;
  }
  const message = `\u7B2C ${task.chapterNumber} \u7AE0\u5DF2\u8FBE\u5230\u81EA\u52A8\u6062\u590D\u4E0A\u9650\uFF0C\u9700\u8981\u4EBA\u5DE5\u5BA1\u9605\u540E\u624D\u80FD\u7EE7\u7EED\u3002`;
  await markAutopilot(projectRoot, {
    running: false,
    stopRequested: false,
    mode: "idle",
    lastStep: "recovery_blocked",
    driftStatus: "blocked",
    driftReason: message,
    statusMessage: message
  }, autopilotStateStore(rootDir, projectId));
  if (jobId) {
    await withFactoryDb(rootDir, async (db) => db.failJob(jobId, message, leaseOwner)).catch(() => void 0);
  }
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message
  });
  return true;
}
async function runAutopilotBackground(options, controller, leaseOwner = makeWorkerOwner()) {
  const { signal } = controller;
  const {
    rootDir,
    projectRoot,
    projectId,
    projects,
    initialMessage,
    mode = "background",
    jobId,
    createSnapshot
  } = options;
  if (jobId) {
    const claimed = await withFactoryDb(rootDir, async (db) => db.claimJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null);
    if (!claimed) {
      return;
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
    statusMessage: "\u81EA\u52A8\u521B\u4F5C\u8FD0\u884C\u4E2D\uFF1A\u7CFB\u7EDF\u5C06\u6301\u7EED\u8BA8\u8BBA\u3001\u63A8\u8FDB\u3001\u5199\u4F5C\uFF0C\u76F4\u5230\u4F60\u4E3B\u52A8\u505C\u6B62\u3002"
  }, autopilotStateStore(rootDir, projectId));
  let nextMessage = initialMessage;
  let lastConsumedJobMessage = initialMessage.trim();
  let correctionMessage = "";
  let networkRetryAttempt = 0;
  const stopLeaseHeartbeat = startJobLeaseHeartbeat(rootDir, projectId, jobId, leaseOwner, controller);
  try {
    while (!await shouldStopAutopilot(projectRoot, rootDir, projectId)) {
      throwIfAutopilotStopped(signal);
      if (jobId) {
        await withFactoryDb(rootDir, async (db) => db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null);
        const latestJob = await withFactoryDb(rootDir, async (db) => {
          const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : [];
          return jobs.find((job) => job.id === jobId) ?? null;
        }).catch(() => null);
        if (latestJob && latestJob.status !== "running" && latestJob.status !== "paused") {
          throw createAutopilotStopError();
        }
        const latestPayload = readJsonObject(latestJob?.payload_json);
        const latestMessage = typeof latestPayload.message === "string" ? latestPayload.message.trim() : "";
        if (latestMessage && latestMessage !== lastConsumedJobMessage) {
          lastConsumedJobMessage = latestMessage;
          nextMessage = latestMessage;
          correctionMessage = "";
          await withFactoryDb(rootDir, async (db) => db.recordEvent(projectId, null, "AUTOPILOT_INSTRUCTION_RECEIVED", {
            jobId,
            message: latestMessage,
            leaseOwner
          })).catch(() => void 0);
          emitAutopilotEvent(projectRoot, "autopilot_status", {
            stage: (await loadAutonomousState(projectRoot)).runtime.stage,
            message: `\u5DF2\u63A5\u6536\u65B0\u7684\u7528\u6237\u6307\u4EE4\uFF1A${latestMessage}`
          });
        }
      }
      let activeDirectorCommand = null;
      try {
        throwIfAutopilotStopped(signal);
        let beforeDiscussion = await reconcileCompleteRuntimeBeforeWorkerDecision(
          projectRoot,
          rootDir,
          projectId,
          await loadAutonomousState(projectRoot)
        );
        const staleRecovery = await recoverStaleWritingRequest(rootDir, projectRoot, projectId, beforeDiscussion);
        if (staleRecovery.recovered) {
          beforeDiscussion = staleRecovery.state;
          networkRetryAttempt = 0;
        }
        const orphanedRecovery = await recoverOrphanedInProgressWritingTask(rootDir, projectRoot, projectId, beforeDiscussion);
        if (orphanedRecovery.recovered) {
          beforeDiscussion = orphanedRecovery.state;
          networkRetryAttempt = 0;
        }
        const currentLoopCount = beforeDiscussion.runtime.autopilot?.loopCount || 0;
        if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, beforeDiscussion)) {
          break;
        }
        if (await backoffIfActiveWritingMessage(rootDir, projectRoot, projectId, beforeDiscussion, signal)) {
          continue;
        }
        const directorCommand = decideNovelDirectorCommand(beforeDiscussion, {
          userMessage: nextMessage,
          correctionMessage
        });
        activeDirectorCommand = directorCommand;
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_DECIDED", directorCommand, {
          userMessage: nextMessage || null,
          correctionActive: Boolean(correctionMessage.trim())
        });
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_STARTED", directorCommand);
        if (directorCommand.type === "advance") {
          const isSemi2 = beforeDiscussion.project?.autoMode === "semi";
          const userConfirmed = isGenericAutopilotMessage(nextMessage || "");
          if (isSemi2 && !userConfirmed) {
            const pauseMessage = `\u5F53\u524D\u5DE5\u4F5C\u6D41\u5DF2\u5B8C\u6210\u8BA8\u8BBA\u4E0E\u5171\u8BC6\uFF0C\u5DF2\u6682\u505C\u4EE5\u7B49\u5F85\u7528\u6237\u786E\u8BA4\u3002`;
            await markAutopilot(projectRoot, {
              running: false,
              stopRequested: false,
              mode: "idle",
              lastStep: "semi_auto_paused",
              statusMessage: pauseMessage
            }, autopilotStateStore(rootDir, projectId));
            if (jobId) {
              await withFactoryDb(rootDir, async (db) => db.pauseJob(jobId, leaseOwner)).catch(() => void 0);
            }
            emitAutopilotEvent(projectRoot, "autopilot_status", {
              stage: beforeDiscussion.runtime.stage,
              message: pauseMessage
            });
            break;
          }
          nextMessage = "";
          emitAutopilotEvent(projectRoot, "autopilot_status", {
            stage: beforeDiscussion.runtime.stage,
            message: directorCommand.reason
          });
          await markAutopilot(projectRoot, {
            lastStep: `advance:${beforeDiscussion.runtime.stage}`,
            loopCount: currentLoopCount + 1,
            driftStatus: "ok",
            driftReason: null,
            statusMessage: "\u5F53\u524D\u9636\u6BB5\u5DF2\u6709\u8DB3\u591F\u4E0A\u4E0B\u6587\uFF0C\u6B63\u5728\u4F18\u5148\u63A8\u8FDB\u751F\u4EA7\u72B6\u6001\u673A\u3002"
          }, autopilotStateStore(rootDir, projectId));
          const advanced2 = await advanceAutonomousProject(projectRoot, {
            factoryRootDir: rootDir,
            projectId,
            directorCommandId: directorCommand.id,
            preferDeterministicPlanning: true,
            signal,
            onProgress: async (event) => {
              emitAutopilotEvent(projectRoot, "writing_progress", event);
            }
          });
          const advanceCheckpoint2 = await writeAutopilotCheckpoint(projectRoot, advanced2, `advance-${advanced2.runtime.stage}`, {
            previousStage: beforeDiscussion.runtime.stage,
            advanceFirst: directorCommand.advanceFirst,
            directorCommandId: directorCommand.id
          });
          try {
            await upsertCheckpointInSuperGraph(projectRoot, {
              path: advanceCheckpoint2,
              label: `advance-${advanced2.runtime.stage}`
            }, {
              factoryRootDir: rootDir,
              projectId
            });
          } catch {
          }
          await markAutopilot(projectRoot, {
            checkpointPath: advanceCheckpoint2
          }, autopilotStateStore(rootDir, projectId));
          emitAutopilotEvent(projectRoot, "snapshot", {
            activeProjectId: projectId,
            projects,
            ...await createSnapshot(projectRoot, advanced2, { rootDir, projectId }),
            envStatus: getPublicProjectEnvStatus(rootDir)
          });
          const advancedFullyComplete2 = advanced2.runtime.stage === "complete" ? await isBookFullyComplete(rootDir, projectId, advanced2) : false;
          if (advancedFullyComplete2) {
            if (jobId) {
              await withFactoryDb(rootDir, async (db) => db.completeJob(jobId, leaseOwner)).catch(() => void 0);
            }
            await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
              resultingStage: advanced2.runtime.stage
            });
            break;
          }
          if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, advanced2)) {
            break;
          }
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
            resultingStage: advanced2.runtime.stage
          });
          networkRetryAttempt = 0;
          await backoffIfNoWorkflowProgress(rootDir, projectRoot, projectId, beforeDiscussion, advanced2, signal);
          continue;
        }
        const discussionMessage = directorCommand.message;
        nextMessage = "";
        correctionMessage = "";
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: beforeDiscussion.runtime.stage,
          message: `\u5F00\u59CB\u81EA\u52A8\u8BA8\u8BBA\uFF1A${discussionMessage}`
        });
        await markAutopilot(projectRoot, {
          lastStep: `discussion:${beforeDiscussion.runtime.stage}`,
          loopCount: currentLoopCount + 1,
          statusMessage: `\u81EA\u52A8\u8BA8\u8BBA\u4E2D\uFF1A${discussionMessage}`
        }, autopilotStateStore(rootDir, projectId));
        const discussion = await runMultiAgentDiscussion(projectRoot, discussionMessage, {
          envRootDir: rootDir,
          factoryRootDir: rootDir,
          projectId: projectId ?? void 0,
          directorCommandId: directorCommand.id,
          signal,
          onStreamEvent: async (event) => {
            emitAutopilotEvent(projectRoot, event.type, event);
          }
        });
        const afterDiscussion = await loadAutonomousState(projectRoot);
        const drift = evaluateAutopilotDrift({
          before: beforeDiscussion,
          after: afterDiscussion,
          discussionSummary: discussion.summary,
          intendedMessage: discussionMessage
        });
        const checkpointPath = await writeAutopilotCheckpoint(projectRoot, afterDiscussion, `loop-${currentLoopCount + 1}-${afterDiscussion.runtime.stage}`, {
          discussionTarget: discussion.target,
          drift,
          directorCommandId: directorCommand.id
        });
        try {
          await upsertCheckpointInSuperGraph(projectRoot, {
            path: checkpointPath,
            label: `loop-${currentLoopCount + 1}-${afterDiscussion.runtime.stage}`,
            drift
          }, {
            factoryRootDir: rootDir,
            projectId
          });
        } catch {
        }
        await markAutopilot(projectRoot, {
          driftScore: drift.score,
          driftStatus: drift.status,
          driftReason: drift.reason,
          checkpointPath,
          lastStep: `guard:${afterDiscussion.runtime.stage}`,
          statusMessage: drift.status === "ok" ? afterDiscussion.runtime.statusMessage : `\u81EA\u52A8\u521B\u4F5C\u5B88\u536B\u68C0\u6D4B\u5230\u76EE\u6807\u6F02\u79FB\uFF1A${drift.reason}`
        }, autopilotStateStore(rootDir, projectId));
        emitAutopilotEvent(projectRoot, "guard", {
          stage: afterDiscussion.runtime.stage,
          drift,
          checkpointPath
        });
        emitAutopilotEvent(projectRoot, "snapshot", {
          activeProjectId: projectId,
          projects,
          discussion,
          ...await createSnapshot(projectRoot, void 0, { rootDir, projectId }),
          envStatus: getPublicProjectEnvStatus(rootDir)
        });
        if (drift.status === "blocked") {
          const canAdvanceDespiteGuard = discussion.writebackSkipped && afterDiscussion.runtime.stage !== "complete";
          if (!canAdvanceDespiteGuard) {
            await markAutopilot(projectRoot, {
              running: false,
              stopRequested: true,
              mode: "idle",
              lastStep: "guard_blocked",
              statusMessage: `\u81EA\u52A8\u521B\u4F5C\u5DF2\u56E0\u4E25\u91CD\u76EE\u6807\u6F02\u79FB\u6682\u505C\uFF1A${drift.reason}`
            }, autopilotStateStore(rootDir, projectId));
            if (jobId) {
              await withFactoryDb(rootDir, async (db) => db.failJob(jobId, drift.reason, leaseOwner)).catch(() => void 0);
            }
            break;
          }
          await markAutopilot(projectRoot, {
            driftStatus: "correcting",
            lastStep: `guard_recoverable:${afterDiscussion.runtime.stage}`,
            statusMessage: `\u8BA8\u8BBA\u8F93\u51FA\u88AB\u9636\u6BB5\u5B88\u536B\u9694\u79BB\uFF0C\u672A\u5199\u5165\u751F\u4EA7\u5171\u8BC6\uFF1B\u65E0\u4EBA\u503C\u5B88\u6D41\u7A0B\u7EE7\u7EED\u6309\u72B6\u6001\u673A\u63A8\u8FDB\uFF1A${drift.reason}`
          }, autopilotStateStore(rootDir, projectId));
        }
        if (drift.status === "correcting") {
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
            resultingStage: afterDiscussion.runtime.stage,
            driftStatus: drift.status
          });
          correctionMessage = [
            "\u4E0A\u4E00\u8F6E\u51FA\u73B0\u76EE\u6807\u6F02\u79FB\uFF0C\u8BF7\u7ACB\u5373\u7EA0\u504F\u3002",
            `\u6F02\u79FB\u539F\u56E0\uFF1A${drift.reason}`,
            `\u539F\u59CB\u5C0F\u8BF4\u76EE\u6807\uFF1A${afterDiscussion.project.idea}`,
            `\u5F53\u524D\u9636\u6BB5\uFF1A${afterDiscussion.runtime.stage}`,
            "\u53EA\u5141\u8BB8\u56F4\u7ED5\u5F53\u524D\u9636\u6BB5\u548C\u5F53\u524D\u8D44\u4EA7\u7EE7\u7EED\uFF0C\u4E0D\u8981\u7B49\u5F85\u7528\u6237\u9009\u62E9\uFF0C\u4E0D\u8981\u8DF3\u5230\u65E0\u5173\u7AE0\u8282\u3002"
          ].join("\n");
          continue;
        }
        if (await shouldStopAutopilot(projectRoot, rootDir, projectId)) {
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
            resultingStage: afterDiscussion.runtime.stage,
            driftStatus: drift.status
          });
          break;
        }
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
          resultingStage: afterDiscussion.runtime.stage,
          driftStatus: drift.status
        });
        const followUpAdvanceCommand = createFollowUpAdvanceCommand(afterDiscussion, directorCommand);
        activeDirectorCommand = followUpAdvanceCommand;
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_DECIDED", followUpAdvanceCommand, {
          parentCommandId: directorCommand.id,
          driftStatus: drift.status
        });
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_STARTED", followUpAdvanceCommand, {
          parentCommandId: directorCommand.id
        });
        const isSemi = afterDiscussion.project?.autoMode === "semi";
        if (isSemi) {
          const pauseMessage = `\u8BA8\u8BBA\u5171\u8BC6\u5DF2\u5199\u56DE\uFF0C\u5DF2\u6682\u505C\u5728 ${afterDiscussion.runtime.stage} \u9636\u6BB5\uFF0C\u7B49\u5F85\u7528\u6237\u5BA1\u9605\u786E\u8BA4\u6210\u679C\u3002`;
          await markAutopilot(projectRoot, {
            running: false,
            stopRequested: false,
            mode: "idle",
            lastStep: "semi_auto_paused",
            statusMessage: pauseMessage
          }, autopilotStateStore(rootDir, projectId));
          if (jobId) {
            await withFactoryDb(rootDir, async (db) => db.pauseJob(jobId, leaseOwner)).catch(() => void 0);
          }
          emitAutopilotEvent(projectRoot, "autopilot_status", {
            stage: afterDiscussion.runtime.stage,
            message: pauseMessage
          });
          break;
        }
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: afterDiscussion.runtime.stage,
          message: followUpAdvanceCommand.reason
        });
        await markAutopilot(projectRoot, {
          lastStep: `advance:${afterDiscussion.runtime.stage}`,
          statusMessage: "\u8BA8\u8BBA\u7ED3\u8BBA\u5DF2\u5199\u56DE\uFF0C\u6B63\u5728\u81EA\u52A8\u63A8\u8FDB\u5DE5\u4F5C\u6D41\u3002"
        }, autopilotStateStore(rootDir, projectId));
        const advanced = await advanceAutonomousProject(projectRoot, {
          factoryRootDir: rootDir,
          projectId,
          directorCommandId: followUpAdvanceCommand.id,
          preferDeterministicPlanning: true,
          signal,
          onProgress: async (event) => {
            emitAutopilotEvent(projectRoot, "writing_progress", event);
          }
        });
        const advanceCheckpoint = await writeAutopilotCheckpoint(projectRoot, advanced, `advance-${advanced.runtime.stage}`, {
          previousStage: afterDiscussion.runtime.stage,
          directorCommandId: followUpAdvanceCommand.id,
          parentDirectorCommandId: directorCommand.id
        });
        try {
          await upsertCheckpointInSuperGraph(projectRoot, {
            path: advanceCheckpoint,
            label: `advance-${advanced.runtime.stage}`
          }, {
            factoryRootDir: rootDir,
            projectId
          });
        } catch {
        }
        await markAutopilot(projectRoot, {
          checkpointPath: advanceCheckpoint
        }, autopilotStateStore(rootDir, projectId));
        emitAutopilotEvent(projectRoot, "snapshot", {
          activeProjectId: projectId,
          projects,
          ...await createSnapshot(projectRoot, advanced, { rootDir, projectId }),
          envStatus: getPublicProjectEnvStatus(rootDir)
        });
        const advancedFullyComplete = advanced.runtime.stage === "complete" ? await isBookFullyComplete(rootDir, projectId, advanced) : false;
        if (advancedFullyComplete) {
          if (jobId) {
            await withFactoryDb(rootDir, async (db) => db.completeJob(jobId, leaseOwner)).catch(() => void 0);
          }
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", followUpAdvanceCommand, {
            resultingStage: advanced.runtime.stage,
            driftStatus: drift.status,
            parentCommandId: directorCommand.id
          });
          break;
        }
        if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, advanced)) {
          break;
        }
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", followUpAdvanceCommand, {
          resultingStage: advanced.runtime.stage,
          driftStatus: drift.status,
          parentCommandId: directorCommand.id
        });
        networkRetryAttempt = 0;
        await backoffIfNoWorkflowProgress(rootDir, projectRoot, projectId, afterDiscussion, advanced, signal);
      } catch (error) {
        if (isAutopilotStopError(error) || signal.aborted) {
          throw error;
        }
        const transientKind = classifyTransientNetworkError(error);
        if (!transientKind) {
          throw error;
        }
        networkRetryAttempt += 1;
        const delayMs = nextNetworkRetryDelay(networkRetryAttempt, transientKind);
        const message = error instanceof Error ? error.message : String(error);
        const retryDescription = describeTransientNetworkError(transientKind);
        if (activeDirectorCommand) {
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_FAILED", activeDirectorCommand, {
            error: message,
            recoverable: true,
            retryAttempt: networkRetryAttempt,
            transientKind
          });
        }
        if (jobId) {
          await withFactoryDb(rootDir, async (db) => db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null);
        }
        await markAutopilot(projectRoot, {
          running: true,
          stopRequested: false,
          mode,
          lastStep: "network_retry",
          driftStatus: "correcting",
          driftReason: message,
          statusMessage: `${retryDescription.statusPrefix}\uFF0C${Math.round(delayMs / 1e3)} \u79D2\u540E\u81EA\u52A8\u91CD\u8BD5\uFF1A${message}`
        }, autopilotStateStore(rootDir, projectId));
        emitAutopilotEvent(projectRoot, "network_retry", {
          attempt: networkRetryAttempt,
          retryInMs: delayMs,
          message,
          transientKind
        });
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: (await loadAutonomousState(projectRoot)).runtime.stage,
          message: `${retryDescription.eventMessage} \u7B2C ${networkRetryAttempt} \u6B21\u91CD\u8BD5\u3002`
        });
        await sleep(delayMs, signal);
        continue;
      }
    }
  } finally {
    stopLeaseHeartbeat();
    const latestState = await loadAutonomousState(projectRoot);
    const recoveryBlocked = findRecoveryBlockedTask(latestState);
    const fullyComplete = await isBookFullyComplete(rootDir, projectId, latestState);
    if (jobId && !fullyComplete && !recoveryBlocked) {
      await withFactoryDb(rootDir, async (db) => {
        const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : [];
        const currentJob = jobs.find((job) => job.id === jobId);
        if (currentJob?.status === "running") {
          db.pauseJob(jobId, leaseOwner);
        }
      }).catch(() => void 0);
    }
    const previousAutopilot = latestState.runtime.autopilot || {};
    const isSemiPaused = previousAutopilot.lastStep === "semi_auto_paused";
    const isGuardBlocked = previousAutopilot.lastStep === "guard_blocked";
    const isNetworkRetryPaused = previousAutopilot.lastStep === "network_retry_paused";
    const finalLastStep = isSemiPaused ? "semi_auto_paused" : isGuardBlocked ? "guard_blocked" : isNetworkRetryPaused ? "network_retry_paused" : recoveryBlocked ? "recovery_blocked" : "stopped";
    const finalStatusMessage = fullyComplete ? "\u81EA\u52A8\u521B\u4F5C\u5DF2\u5B8C\u6210\u5168\u90E8\u7AE0\u8282\u4EFB\u52A1\u3002" : recoveryBlocked ? `\u81EA\u52A8\u521B\u4F5C\u5DF2\u6682\u505C\uFF1A\u7B2C ${recoveryBlocked.chapterNumber} \u7AE0\u8FBE\u5230\u81EA\u52A8\u6062\u590D\u4E0A\u9650\uFF0C\u9700\u8981\u4EBA\u5DE5\u5BA1\u9605\u3002` : isSemiPaused || isGuardBlocked || isNetworkRetryPaused ? latestState.runtime.statusMessage || previousAutopilot.statusMessage || "\u81EA\u52A8\u521B\u4F5C\u5DF2\u505C\u6B62\uFF0C\u8FDB\u5EA6\u548C\u8BA8\u8BBA\u8BB0\u5F55\u5DF2\u4FDD\u5B58\u3002" : "\u81EA\u52A8\u521B\u4F5C\u5DF2\u505C\u6B62\uFF0C\u8FDB\u5EA6\u548C\u8BA8\u8BBA\u8BB0\u5F55\u5DF2\u4FDD\u5B58\u3002";
    const finalState = await markAutopilot(projectRoot, {
      running: false,
      stopRequested: false,
      lastStep: finalLastStep,
      mode: "idle",
      driftStatus: recoveryBlocked ? "blocked" : latestState.runtime.autopilot?.driftStatus,
      driftReason: recoveryBlocked ? `\u7B2C ${recoveryBlocked.chapterNumber} \u7AE0\u8FBE\u5230\u81EA\u52A8\u6062\u590D\u4E0A\u9650\u3002` : latestState.runtime.autopilot?.driftReason,
      statusMessage: finalStatusMessage
    }, autopilotStateStore(rootDir, projectId));
    emitAutopilotEvent(projectRoot, "complete", {
      activeProjectId: projectId,
      projects,
      ...await createSnapshot(projectRoot, finalState, { rootDir, projectId }),
      envStatus: getPublicProjectEnvStatus(rootDir)
    });
  }
}
async function markInterruptedWritingProgress(rootDir, projectId, state, reason) {
  if (!projectId) {
    return;
  }
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "in_progress");
  if (!task) {
    return;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const messageId = `writing-${task.chapterNumber}-autopilot-aborted`;
  await withFactoryDb(rootDir, async (db) => {
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId,
      step: "autopilot_aborted",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "failed",
      phase: "failed",
      statusText: "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u88AB\u4E2D\u65AD\uFF0C\u7B49\u5F85\u6062\u590D\u540E\u91CD\u65B0\u6267\u884C\u3002",
      message: `\u7B2C ${task.chapterNumber} \u7AE0\u7684\u5F53\u524D\u6A21\u578B\u8BF7\u6C42\u5DF2\u4E2D\u65AD\uFF1A${reason}`,
      timestamp: now
    });
    db.markStreamingMessagesFailed(projectId, {
      conversationId: `writing:${projectId}`,
      chapterNumber: task.chapterNumber,
      reason
    });
  }).catch(() => void 0);
}
function ensureAutopilotJob(options) {
  const existing = autopilotJobs.get(options.projectRoot);
  if (existing) {
    if (!options.jobId || existing.jobId === options.jobId) {
      return existing;
    }
    if (!existing.jobId) {
      autopilotJobs.delete(options.projectRoot);
    } else {
      return existing;
    }
  }
  const controller = new AbortController();
  const job = {
    projectRoot: options.projectRoot,
    jobId: options.jobId,
    controller,
    listeners: /* @__PURE__ */ new Set(),
    promise: Promise.resolve()
  };
  job.promise = runAutopilotBackground(options, controller).catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (controller.signal.aborted || isAutopilotStopError(error)) {
      const latestState = await loadAutonomousState(options.projectRoot).catch(() => null);
      if (latestState) {
        await markInterruptedWritingProgress(options.rootDir, options.projectId, latestState, message);
      }
      if (options.jobId) {
        await withFactoryDb(options.rootDir, async (db) => {
          const jobs = options.projectId ? db.listProjectJobs(options.projectId, "autopilot") : [];
          const currentJob = jobs.find((entry) => entry.id === options.jobId);
          if (currentJob?.status === "running" || currentJob?.status === "paused") {
            db.pauseJob(options.jobId);
          }
        }).catch(() => void 0);
      }
      await markAutopilot(options.projectRoot, {
        running: false,
        stopRequested: false,
        mode: "idle",
        lastStep: "stopped",
        statusMessage: "\u81EA\u52A8\u521B\u4F5C\u5DF2\u6682\u505C\uFF0C\u5F53\u524D\u6A21\u578B\u8BF7\u6C42\u5DF2\u4E2D\u65AD\uFF1B\u4EFB\u52A1\u4ECD\u53EF\u4ECE\u6570\u636E\u5E93\u6062\u590D\u3002"
      }, autopilotStateStore(options.rootDir, options.projectId));
      emitAutopilotEvent(options.projectRoot, "complete", { stopped: true });
      return;
    }
    if (isTransientNetworkError(error)) {
      const transientKind = classifyTransientNetworkError(error) || "connection";
      const retryDescription = describeTransientNetworkError(transientKind);
      if (options.jobId) {
        await withFactoryDb(options.rootDir, async (db) => db.pauseJob(options.jobId)).catch(() => void 0);
      }
      await markAutopilot(options.projectRoot, {
        running: false,
        stopRequested: false,
        mode: "idle",
        lastStep: "network_retry_paused",
        driftStatus: "correcting",
        driftReason: message,
        statusMessage: `${retryDescription.statusPrefix}\uFF0C\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5DF2\u4FDD\u7559\u4E3A\u53EF\u6062\u590D\u72B6\u6001\uFF1A${message}`
      }, autopilotStateStore(options.rootDir, options.projectId));
      emitAutopilotEvent(options.projectRoot, "network_retry_paused", { error: message, transientKind });
      return;
    }
    if (options.jobId) {
      await withFactoryDb(options.rootDir, async (db) => db.failJob(options.jobId, message)).catch(() => void 0);
    }
    await markAutopilot(options.projectRoot, {
      running: false,
      stopRequested: false,
      mode: "idle",
      lastStep: "error",
      driftStatus: "blocked",
      driftReason: message,
      statusMessage: `\u81EA\u52A8\u521B\u4F5C\u8FD0\u884C\u5931\u8D25\uFF1A${message}`
    }, autopilotStateStore(options.rootDir, options.projectId));
    emitAutopilotEvent(options.projectRoot, "error", { error: message });
  }).finally(() => {
    autopilotJobs.delete(options.projectRoot);
  });
  autopilotJobs.set(options.projectRoot, job);
  return job;
}
function stopAutopilotJob(projectRoot) {
  const job = autopilotJobs.get(projectRoot);
  if (!job) {
    return false;
  }
  job.controller.abort();
  autopilotJobs.delete(projectRoot);
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    message: "\u5DF2\u6536\u5230\u505C\u6B62\u8BF7\u6C42\uFF0C\u6B63\u5728\u4E2D\u65AD\u5F53\u524D\u6A21\u578B\u8BF7\u6C42\u5E76\u4FDD\u5B58\u8FDB\u5EA6\u3002"
  });
  return true;
}
async function runKnowledgeJobs(rootDir) {
  await backfillPendingKnowledgeEmbeddings(rootDir, { limit: 100 }).catch(() => void 0);
  const projects = await listAutonomousProjects(rootDir).catch(() => []);
  await ensureKnowledgeBootstrapJobs(rootDir, projects);
  const jobs = await withFactoryDb(
    rootDir,
    async (db) => db.listRunnableJobs(void 0, /* @__PURE__ */ new Date(), { includeIdle: true }).filter((job) => String(job.kind || "").startsWith("knowledge_"))
  ).catch(() => []);
  const owner = makeWorkerOwner();
  for (const job of jobs) {
    if (typeof job.id !== "string") {
      continue;
    }
    const claimed = await withFactoryDb(
      rootDir,
      async (db) => db.claimJob(job.id, owner, KNOWLEDGE_JOB_LEASE_SECONDS, /* @__PURE__ */ new Date(), { includeIdle: true })
    ).catch(() => null);
    if (!claimed) {
      continue;
    }
    const payload = typeof claimed.payload === "object" && claimed.payload ? claimed.payload : {};
    try {
      if (claimed.kind === "knowledge_global_bootstrap" || claimed.kind === "knowledge_global_reindex") {
        const limit = Number(payload.limit);
        await ingestGlobalWritingResources(rootDir, {
          limit: Number.isFinite(limit) && limit > 0 ? limit : void 0
        });
      } else if (claimed.kind === "knowledge_project_artifact") {
        const projectId = typeof claimed.project_id === "string" ? claimed.project_id : typeof payload.projectId === "string" ? payload.projectId : "";
        const project = projects.find((entry) => entry.id === projectId);
        const artifactPath = typeof payload.artifactPath === "string" ? payload.artifactPath : "";
        if (!project || !artifactPath) {
          throw new Error("knowledge_project_artifact job is missing project or artifactPath");
        }
        const projectRoot = await resolveManagedProjectRoot(rootDir, project.id);
        await ingestProjectArtifact({
          rootDir,
          projectId: project.id,
          projectRoot,
          artifactPath,
          kind: typeof payload.kind === "string" ? payload.kind : "artifact",
          metadata: typeof payload.metadata === "object" && payload.metadata ? payload.metadata : {}
        });
      }
      await withFactoryDb(rootDir, async (db) => db.completeJob(claimed.id, owner)).catch(() => void 0);
    } catch (error) {
      await withFactoryDb(
        rootDir,
        async (db) => db.failJob(claimed.id, error instanceof Error ? error.message : String(error), owner)
      ).catch(() => void 0);
    }
  }
}
async function restoreAutopilotJobs(rootDir, createSnapshot) {
  await backfillPendingMemoryEmbeddings(rootDir, { limit: 50 }).catch(() => void 0);
  await runKnowledgeJobs(rootDir).catch(() => void 0);
  const projects = await listAutonomousProjects(rootDir);
  const jobs = await withFactoryDb(rootDir, async (db) => {
    db.pruneProjectsExcept(projects.map((project) => project.id));
    db.recoverStaleRuns();
    return db.listRunnableJobs("autopilot");
  }).catch(() => []);
  if (!jobs.length) {
    return;
  }
  const seenProjectIds = /* @__PURE__ */ new Set();
  for (const job of jobs) {
    const projectId = typeof job.project_id === "string" ? job.project_id : null;
    const project = projectId ? projects.find((entry) => entry.id === projectId) : null;
    if (!project || typeof job.id !== "string") {
      continue;
    }
    if (seenProjectIds.has(project.id)) {
      await withFactoryDb(rootDir, async (db) => {
        db.cancelJob(job.id);
        db.recordEvent(project.id, typeof job.run_id === "string" ? job.run_id : null, "JOB_DEDUPED", {
          id: job.id,
          kind: job.kind,
          reason: "Another autopilot job is already scheduled for restore."
        });
      }).catch(() => void 0);
      continue;
    }
    seenProjectIds.add(project.id);
    if (process.env.AI_NOVEL_TEST_MODE === "1" && process.env.AI_NOVEL_TEST_FORCE_WORKER !== "1") {
      await withFactoryDb(rootDir, async (db) => {
        db.recordEvent(project.id, typeof job.run_id === "string" ? job.run_id : null, "JOB_RESTORE_READY", {
          id: job.id,
          kind: job.kind,
          status: job.status,
          leaseExpiresAt: job.lease_expires_at ?? null
        });
      }).catch(() => void 0);
      continue;
    }
    const projectRoot = await resolveManagedProjectRoot(rootDir, project.id).catch(() => null);
    if (!projectRoot || autopilotJobs.has(projectRoot)) {
      continue;
    }
    const state = await loadAutonomousState(projectRoot).catch(() => null);
    const autopilot = state?.runtime?.autopilot || null;
    const payload = typeof job.payload === "object" && job.payload ? job.payload : {};
    const message = typeof payload.message === "string" ? payload.message : "";
    const hasWakeupSignal = isGenericAutopilotMessage(message);
    const manuallyPaused = Boolean(
      autopilot && !autopilot.running && (autopilot.stopRequested || autopilot.lastStep === "stopped" || autopilot.lastStep === "semi_auto_paused" && !hasWakeupSignal)
    );
    if (manuallyPaused) {
      continue;
    }
    ensureAutopilotJob({
      rootDir,
      projectRoot,
      projectId: project.id,
      projects,
      initialMessage: message,
      mode: "background",
      jobId: job.id,
      createSnapshot
    });
  }
}
function scheduleAutopilotRestore(rootDir, createSnapshot) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return null;
  }
  return setInterval(() => {
    void restoreAutopilotJobs(rootDir, createSnapshot);
  }, AUTOPILOT_RESTORE_POLL_MS);
}
async function startAutopilotWorkerRuntime(options) {
  await restoreAutopilotJobs(options.rootDir, options.createSnapshot);
  if (process.env.AI_NOVEL_TEST_MODE === "1" && process.env.AI_NOVEL_TEST_FORCE_WORKER !== "1") {
    return {
      close: () => void 0
    };
  }
  const timer = setInterval(() => {
    void restoreAutopilotJobs(options.rootDir, options.createSnapshot);
  }, options.pollMs ?? AUTOPILOT_RESTORE_POLL_MS);
  return {
    close: () => clearInterval(timer)
  };
}

export {
  recordDirectorCommandEvent,
  executeManualAdvanceCommand,
  executeManualRetryChapterCommand,
  executeManualInterruptCommand,
  getAutopilotJob,
  isAutopilotRunning,
  markAutopilot,
  ensureAutopilotJob,
  stopAutopilotJob,
  restoreAutopilotJobs,
  scheduleAutopilotRestore,
  startAutopilotWorkerRuntime
};
