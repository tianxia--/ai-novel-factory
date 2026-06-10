import {
  routeUserMessage
} from "./chunk-NAGGUJYO.js";
import "./chunk-SDIPDDNZ.js";
import {
  ensureAutopilotJob,
  executeManualAdvanceCommand,
  executeManualInterruptCommand,
  executeManualRetryChapterCommand,
  getAutopilotJob,
  isAutopilotRunning,
  markAutopilot,
  restoreAutopilotJobs,
  scheduleAutopilotRestore,
  stopAutopilotJob
} from "./chunk-FIIOMPAW.js";
import "./chunk-6NBXMMHP.js";
import {
  buildSuperGraphIndex,
  createManagedAutonomousProject,
  deleteManagedAutonomousProject,
  formatStatus,
  initAutonomousProject,
  listAutonomousProjects,
  loadAutonomousState,
  prepareCoverGeneration,
  resolveManagedProjectRoot,
  runMultiAgentDiscussion,
  saveAutonomousState,
  superGraphFromDbRows,
  syncCurrentContextPacketFile,
  validateSuperGraph
} from "./chunk-5TQO6Q4U.js";
import {
  getCachedActiveLlmConfig,
  getPublicProjectEnvStatus,
  loadActiveLlmConfig,
  testProviderConnectivity,
  upsertProjectEnvValues
} from "./chunk-5LJQUNJF.js";
import {
  evaluateKnowledgeBenchmark,
  retrieveKnowledge
} from "./chunk-HL3WMSH6.js";
import {
  makeRunId,
  withFactoryDb
} from "./chunk-CRFEPMYG.js";
import {
  createStatusMessage,
  createToolMessage,
  createUserMessage
} from "./chunk-GZKJNHMN.js";

// src/studio-server.ts
import fs from "fs/promises";
import path from "path";
import http from "http";
import { createHash } from "crypto";
function getPublicProjectEnvStatus2(rootDir = process.cwd()) {
  const status = getPublicProjectEnvStatus(rootDir);
  const activeLlm = getCachedActiveLlmConfig();
  if (activeLlm) {
    status.configured = true;
    status.resolved = {
      baseUrl: activeLlm.provider.baseUrl,
      modelName: activeLlm.provider.modelName,
      apiKeyPresent: true
    };
    status.missing = status.missing.filter(
      (k) => k !== "LLM_API_KEY" && k !== "LLM_BASE_URL" && k !== "LLM_MODEL_ID"
    );
  }
  return status;
}
function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}
function writeServerErrorResponse(response, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (response.headersSent) {
    if (!response.writableEnded) {
      response.write(`event: error
`);
      response.write(`data: ${JSON.stringify({ error: message })}

`);
      response.end();
    }
    return;
  }
  json(response, 500, { error: message });
}
function eventStreamHeaders(response) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
}
function writeSse(response, eventName, data) {
  response.write(`event: ${eventName}
`);
  response.write(`data: ${JSON.stringify(data)}

`);
}
function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}
function formatKnowledgeEvaluationReport(evaluation) {
  const lines = [
    "# Knowledge Retrieval Evaluation",
    "",
    `- Total Cases: ${evaluation.summary.totalCases}`,
    `- Hit@K: ${pct(evaluation.summary.hitRateAtK)}`,
    `- Mean Recall@K: ${pct(evaluation.summary.meanRecallAtK)}`,
    `- Mean Precision@K: ${pct(evaluation.summary.meanPrecisionAtK)}`,
    "",
    "## Cases",
    ""
  ];
  for (const item of evaluation.cases) {
    lines.push(
      `### ${item.name || "Unnamed Case"}`,
      "",
      `- Query: ${item.query}`,
      `- K: ${item.k}`,
      `- Hit@K: ${item.hitAtK}`,
      `- Recall@K: ${pct(item.recallAtK)}`,
      `- Precision@K: ${pct(item.precisionAtK)}`,
      `- Matched Chunks: ${item.matchedChunkIds.length ? item.matchedChunkIds.join(", ") : "none"}`,
      `- Missed Chunks: ${item.missedChunkIds.length ? item.missedChunkIds.join(", ") : "none"}`,
      ""
    );
  }
  return `${lines.join("\n").trim()}
`;
}
function shouldUseEmbeddedWorker(value) {
  return value ?? process.env.AI_NOVEL_EMBEDDED_WORKER === "1";
}
async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}
function readJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function readStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}
function readKnowledgeScopes(value) {
  const scopes = readStringArray(value).filter((scope) => scope === "global" || scope === "project");
  return scopes.length ? scopes : void 0;
}
function normalizeKnowledgeSearchRow(row) {
  const source = row.source || {};
  const content = String(row.content || "");
  const sourcePath = String(source.path || row.source_path || "");
  const sourceType = String(source.sourceType || row.source_type || "");
  return {
    id: String(row.id || ""),
    chunkId: String(row.id || ""),
    score: Number(row.score || 0),
    chunkType: String(row.chunk_type || row.chunkType || ""),
    content,
    preview: content.replace(/\s+/g, " ").trim().slice(0, 360),
    metadata: row.metadata || {},
    source: {
      id: String(source.id || row.source_id || ""),
      scope: String(row.scope || ""),
      sourceType,
      path: sourcePath,
      title: String(source.title || row.source_title || sourcePath || "knowledge")
    }
  };
}
function isJsonApiRequest(method, pathname) {
  if (method === "GET") {
    return [
      "/api/projects",
      "/api/health",
      "/api/ready",
      "/api/status",
      "/api/transcript",
      "/api/messages",
      "/api/chapters/preview",
      "/api/artifacts/preview",
      "/api/env",
      "/api/knowledge-graph",
      "/api/llm-configs"
    ].includes(pathname);
  }
  if (method === "POST") {
    return [
      "/api/projects",
      "/api/init",
      "/api/advance",
      "/api/chapters/retry",
      "/api/cover",
      "/api/provider-test",
      "/api/env",
      "/api/interrupt",
      "/api/chat",
      "/api/stop",
      "/api/autopilot/stop",
      "/api/autopilot/start",
      "/api/autopilot/mode",
      "/api/mode",
      "/api/knowledge/reindex",
      "/api/knowledge/search",
      "/api/knowledge/evaluate",
      "/api/llm-configs",
      "/api/llm-configs/activate"
    ].includes(pathname);
  }
  if (method === "DELETE") {
    return pathname.startsWith("/api/projects/") || pathname === "/api/llm-configs";
  }
  return false;
}
async function forwardJsonApiRequest(rootDir, request, response, url, options = {}) {
  const method = request.method || "GET";
  const pathname = url.pathname;
  const body = method === "POST" || method === "DELETE" ? await readJsonBody(request) : {};
  const projectId = typeof body.projectId === "string" ? body.projectId : url.searchParams.get("projectId");
  const pathWithSearch = url.search ? `${pathname}${url.search}` : pathname;
  const result = await handleNovelStudioApi(rootDir, method, pathWithSearch, body, {
    projectId,
    embeddedWorker: options.embeddedWorker
  });
  json(response, result.status, result.payload);
}
function serializeState(state) {
  return {
    project: state.project,
    runtime: state.runtime,
    reactSetup: state.reactSetup,
    plan: state.plan,
    assets: state.assets
  };
}
async function readDiscussionTranscript(rootDir) {
  try {
    return await fs.readFile(path.join(rootDir, ".ai-novel", "chat", "discussion-log.md"), "utf8");
  } catch {
    return "";
  }
}
async function appendAutopilotSubmissionTranscript(rootDir, input) {
  const message = input.message.trim();
  if (!message) return null;
  const chatDir = path.join(rootDir, ".ai-novel", "chat");
  const submittedAt = (/* @__PURE__ */ new Date()).toISOString();
  await fs.mkdir(chatDir, { recursive: true });
  await fs.appendFile(
    path.join(chatDir, "discussion-log.md"),
    [
      `## ${submittedAt}`,
      `User: ${message}`,
      `System: \u5DF2\u63A5\u6536\u65E0\u4EBA\u503C\u5B88\u521B\u4F5C\u6307\u4EE4\uFF0C\u5E76\u5199\u5165\u540E\u53F0\u4EFB\u52A1\u961F\u5217\u3002${input.jobId ? ` Job: ${input.jobId}.` : ""}`,
      `Status: autopilot_submitted`,
      input.stage ? `Stage: ${input.stage}` : "",
      ""
    ].filter(Boolean).join("\n")
  );
  return submittedAt;
}
async function recordUserMessage(rootDir, input) {
  if (!input.projectId || !input.content.trim()) return null;
  const message = createUserMessage({
    conversationId: input.conversationId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    content: input.content.trim(),
    time: input.time,
    metadata: input.metadata
  });
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, userMessageParts(message.messageId, {
    content: message.data.content,
    createdAt: message.time,
    metadata: message.metadata
  }))).catch(() => void 0);
  return message;
}
async function recordStatusMessage(rootDir, input) {
  if (!input.projectId) return null;
  const message = createStatusMessage({
    conversationId: input.conversationId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    title: input.title,
    content: input.content,
    agentType: "director",
    agentLabel: "System",
    time: input.time,
    metadata: input.metadata
  });
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, statusMessageParts(message.messageId, {
    title: message.data.title,
    content: message.data.content,
    createdAt: message.time,
    metadata: message.metadata
  }))).catch(() => void 0);
  return message;
}
function messagePart(messageId, index, type, data, createdAt) {
  return {
    id: `${messageId}:part:${index}`,
    messageId,
    index,
    type,
    data,
    createdAt
  };
}
function userMessageParts(messageId, input) {
  return [
    messagePart(messageId, 0, "text", { text: input.content }, input.createdAt),
    messagePart(messageId, 1, "json", {
      source: input.metadata?.source || "user",
      metadata: input.metadata || {}
    }, input.createdAt)
  ];
}
function statusMessageParts(messageId, input) {
  const text = [input.title ? `### ${input.title}` : "", input.content].filter(Boolean).join("\n\n");
  return [
    messagePart(messageId, 0, "markdown", { text }, input.createdAt),
    messagePart(messageId, 1, "json", {
      source: input.metadata?.source || "status",
      title: input.title,
      metadata: input.metadata || {}
    }, input.createdAt)
  ];
}
function toolMessageParts(messageId, input) {
  const parts = [
    messagePart(messageId, 0, "markdown", { text: input.content || `${input.toolName}: ${input.status}` }, input.createdAt),
    messagePart(messageId, 1, "tool_call", {
      toolName: input.toolName,
      input: input.toolInput ?? null
    }, input.createdAt)
  ];
  parts.push(messagePart(messageId, 2, input.error ? "tool_result" : "tool_result", {
    status: input.status,
    output: input.output ?? null,
    error: input.error ?? null
  }, input.createdAt));
  return parts;
}
async function recordToolMessage(rootDir, input) {
  if (!input.projectId) return null;
  const status = input.status || "completed";
  const message = createToolMessage({
    conversationId: input.conversationId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    toolName: input.toolName,
    status,
    toolStatus: status,
    input: input.input,
    output: input.output,
    error: input.error,
    content: input.content,
    time: input.time,
    metadata: input.metadata
  });
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, toolMessageParts(message.messageId, {
    toolName: input.toolName,
    status,
    toolInput: input.input,
    output: input.output,
    error: input.error,
    content: input.content,
    createdAt: message.createdAt
  }))).catch(() => void 0);
  return message;
}
async function writeKnowledgeEvaluationArtifact(rootDir, projectRoot, projectId, evaluation) {
  const relativePath = ".ai-novel/knowledge/evaluation-latest.md";
  const absolutePath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, formatKnowledgeEvaluationReport(evaluation), "utf8");
  await withFactoryDb(rootDir, async (db) => {
    db.recordArtifact({
      projectId,
      kind: "checkpoint",
      path: relativePath,
      status: "completed",
      metadata: {
        source: "knowledge-evaluate",
        summary: evaluation.summary
      }
    });
  });
  return relativePath;
}
function parseTranscriptTimestamp(value = "") {
  const firstLine = String(value || "").split("\n")[0]?.trim() || "";
  const parsed = Date.parse(firstLine);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}
function parseTranscriptEntries(transcript = "", { limit = 80 } = {}) {
  const rolePattern = /^(User|System|Showrunner|World Architect|Author|Editor|Reviewer|Prose Stylist):\s*(.*)$/;
  const blocks = transcript.split(/^##\s+/m).map((block) => block.trim()).filter(Boolean);
  const entries = [];
  blocks.forEach((block, blockIndex) => {
    const timestamp = parseTranscriptTimestamp(block);
    let current = null;
    for (const line of block.split("\n").slice(timestamp ? 1 : 0)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(rolePattern);
      if (match) {
        if (current) entries.push(current);
        current = {
          key: `transcript-${blockIndex}-${entries.length}`,
          role: match[1],
          content: match[2].trim(),
          ...timestamp ? { timestamp } : {}
        };
        continue;
      }
      if (current) {
        current.content = [current.content, trimmed].filter(Boolean).join("\n");
      }
    }
    if (current) entries.push(current);
  });
  const recentEntries = entries.slice(-limit);
  return {
    entries: recentEntries.map((entry, index) => ({ ...entry, key: `history-${entries.length - recentEntries.length + index}` })),
    meta: {
      totalEntries: entries.length,
      returnedEntries: recentEntries.length,
      truncated: entries.length > recentEntries.length,
      transcriptBytes: Buffer.byteLength(transcript)
    }
  };
}
function messageRowsToEntries(rows = [], { limit = 80, transcriptBytes = 0 } = {}) {
  const normalizeParts = (parts) => Array.isArray(parts) ? parts.filter((part) => Boolean(part) && typeof part === "object").map((part, index) => ({
    id: String(part.id || `${part.messageId || part.message_id || "message"}:part:${index}`),
    messageId: String(part.messageId || part.message_id || ""),
    index: Number.isFinite(Number(part.index ?? part.part_index)) ? Number(part.index ?? part.part_index) : index,
    type: String(part.type || "text"),
    data: part.data && typeof part.data === "object" ? part.data : {},
    createdAt: String(part.createdAt || part.created_at || "")
  })).sort((left, right) => left.index - right.index) : [];
  const artifactPathFromParts = (parts) => {
    const artifactPart = parts.find((part) => part.type === "artifact" && part.data && typeof part.data === "object");
    const artifactData = artifactPart?.data;
    const path2 = artifactData?.path || artifactData?.artifactPath || artifactData?.url || "";
    return typeof path2 === "string" ? path2 : "";
  };
  const selectedRows = rows.slice(0, limit).reverse();
  const entries = selectedRows.map((row, index) => {
    const data = row.data && typeof row.data === "object" ? row.data : {};
    const parts = normalizeParts(row.parts);
    const type = String(row.type || "agent");
    const isUser = type === "user";
    const role = isUser ? "User" : String(data.agentLabel || data.agentType || "Agent");
    const content = type === "status" ? [data.title ? `### ${String(data.title)}` : "", data.content ? String(data.content) : ""].filter(Boolean).join("\n\n") : String(data.content || data.caption || data.alt || data.path || data.url || "");
    return {
      key: `message-${String(row.id || index)}`,
      messageId: String(row.id || row.messageId || ""),
      conversationId: String(row.conversation_id || row.conversationId || ""),
      runId: typeof row.run_id === "string" ? row.run_id : typeof row.runId === "string" ? row.runId : "",
      turnId: typeof row.turn_id === "string" ? row.turn_id : typeof row.turnId === "string" ? row.turnId : "",
      type,
      status: String(row.status || "completed"),
      role,
      content,
      timestamp: String(row.time || row.created_at || row.createdAt || ""),
      time: String(row.time || row.created_at || row.createdAt || ""),
      data,
      parts,
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      artifactPath: typeof data.artifactPath === "string" ? data.artifactPath : artifactPathFromParts(parts)
    };
  });
  return {
    entries,
    meta: {
      totalEntries: rows.length,
      returnedEntries: entries.length,
      truncated: rows.length > entries.length,
      transcriptBytes,
      source: "messages"
    }
  };
}
function discussionEntriesFromSnapshot(factorySnapshot, { limit = 80 } = {}) {
  const recentMessages = Array.isArray(factorySnapshot?.recentMessages) ? factorySnapshot.recentMessages : [];
  if (recentMessages.length === 0) {
    return null;
  }
  return messageRowsToEntries(recentMessages, { limit });
}
async function readWorkspaceText(rootDir, ...parts) {
  try {
    return await fs.readFile(path.join(rootDir, ".ai-novel", ...parts), "utf8");
  } catch {
    return "";
  }
}
async function syncCurrentContextPacketState(projectRoot, state) {
  if (!state) return;
  await syncCurrentContextPacketFile(projectRoot, state);
}
async function readWorkspaceArtifactText(rootDir, artifactPath) {
  const normalized = artifactPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith(".ai-novel/") || normalized.includes("..")) {
    return null;
  }
  try {
    return await fs.readFile(path.join(rootDir, normalized), "utf8");
  } catch {
    return "";
  }
}
function compactStateForPayload(state, options = {}) {
  if (!state) return null;
  const tasks = state.plan.chapterTasks;
  const pageSize = Math.max(1, Math.min(100, Number.isFinite(Number(options.chapterPageSize)) ? Number(options.chapterPageSize) : 20));
  const pageCount = Math.max(1, Math.ceil(tasks.length / pageSize));
  const firstActiveIndex = tasks.findIndex((task) => task.status !== "complete");
  const defaultPage = firstActiveIndex >= 0 ? Math.floor(firstActiveIndex / pageSize) + 1 : pageCount;
  const page = Math.max(1, Math.min(pageCount, Number.isFinite(Number(options.chapterPage)) ? Number(options.chapterPage) : defaultPage));
  const startIndex = (page - 1) * pageSize;
  const visibleTasks = tasks.slice(startIndex, startIndex + pageSize);
  const windowStart = visibleTasks.length > 0 ? Number(visibleTasks[0]?.chapterNumber || firstActiveIndex + 1 || 1) : 0;
  const windowEnd = visibleTasks.length > 0 ? Number(visibleTasks[visibleTasks.length - 1]?.chapterNumber || windowStart) : 0;
  return {
    ...serializeState(state),
    plan: {
      ...state.plan,
      chapterTasks: visibleTasks,
      chapterTaskSummary: {
        total: tasks.length,
        complete: tasks.filter((task) => task.status === "complete").length,
        pending: tasks.filter((task) => task.status === "pending").length,
        inProgress: tasks.filter((task) => task.status === "in_progress").length,
        blocked: tasks.filter((task) => task.status === "blocked").length,
        windowed: visibleTasks.length,
        windowStart,
        windowEnd,
        page,
        pageSize,
        pageCount
      }
    }
  };
}
function stateWithChapterFactsForPayload(state, factorySnapshot) {
  if (!state || !Array.isArray(factorySnapshot?.chapterFacts)) {
    return state;
  }
  const stageAllowsChapterFactOverlay = state.runtime.stage === "chapter_task_generation" || state.runtime.stage === "drafting" || state.runtime.stage === "reviewing" || state.runtime.stage === "complete";
  if (!stageAllowsChapterFactOverlay) {
    return state;
  }
  const factsByChapter = new Map(
    factorySnapshot.chapterFacts.map((fact) => [Number(fact.chapterNumber), fact])
  );
  const normalizeTaskStatus = (value) => value === "pending" || value === "in_progress" || value === "complete" || value === "blocked" ? value : null;
  const normalizeGateStatus = (value) => value === "passed" || value === "needs_revision" || value === "blocked" ? value : null;
  const timestampMs = (value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return 0;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const nextState = serializeState(state);
  nextState.plan.chapterTasks = state.plan.chapterTasks.map((task) => {
    const fact = factsByChapter.get(Number(task.chapterNumber));
    if (!fact) return task;
    const qualityGate = fact.qualityGate && typeof fact.qualityGate === "object" ? fact.qualityGate : null;
    const factStatus = normalizeTaskStatus(fact.status);
    const gateStatus = normalizeGateStatus(qualityGate?.status);
    const latestTaskStatusAt = timestampMs(fact.latestTaskStatusAt);
    const qualityGateUpdatedAt = timestampMs(
      typeof qualityGate?.updatedAt === "string" ? qualityGate.updatedAt : typeof fact.updatedAt === "string" ? fact.updatedAt : ""
    );
    const recoveryStatusIsCurrent = latestTaskStatusAt > 0 && latestTaskStatusAt > qualityGateUpdatedAt && (fact.latestTaskStatus === "pending" || fact.latestTaskStatus === "in_progress");
    return {
      ...task,
      status: recoveryStatusIsCurrent ? fact.latestTaskStatus : factStatus || task.status,
      recoveryQueuedAt: typeof fact.recoveryQueuedAt === "string" && recoveryStatusIsCurrent ? fact.recoveryQueuedAt : task.recoveryQueuedAt,
      contentQuality: fact.contentQuality && typeof fact.contentQuality === "object" ? fact.contentQuality : task.contentQuality,
      qualityGate: qualityGate && gateStatus ? {
        ...task.qualityGate,
        status: gateStatus,
        score: Number(qualityGate.score || 0),
        attempts: Number(qualityGate.attempts || 0),
        reason: String(qualityGate.reason || ""),
        wordCount: Number.isFinite(Number(qualityGate.wordCount)) ? Number(qualityGate.wordCount) : void 0,
        targetWords: Number.isFinite(Number(qualityGate.targetWords)) ? Number(qualityGate.targetWords) : void 0,
        updatedAt: String(qualityGate.updatedAt || fact.updatedAt || fact.latestEventAt || (/* @__PURE__ */ new Date()).toISOString())
      } : task.qualityGate
    };
  });
  nextState.plan.pendingChapters = nextState.plan.chapterTasks.filter((task) => task.status === "pending").length;
  const hasInProgress = nextState.plan.chapterTasks.some((task) => task.status === "in_progress");
  const hasPending = nextState.plan.chapterTasks.some((task) => task.status === "pending");
  const hasBlocked = nextState.plan.chapterTasks.some((task) => task.status === "blocked");
  if (hasBlocked) {
    nextState.runtime.stage = "reviewing";
  } else if (hasInProgress || hasPending) {
    nextState.runtime.stage = "drafting";
  } else if (nextState.plan.chapterTasks.length > 0) {
    nextState.runtime.stage = "complete";
  }
  return nextState;
}
function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function createSnapshotVersion(payload) {
  return createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 24);
}
function stripVolatileRowFields(row) {
  const {
    id,
    created_at,
    updated_at,
    lease_expires_at,
    payload_json,
    metadata_json,
    ...rest
  } = row;
  return {
    ...rest,
    ...typeof payload_json === "string" ? { payload_json } : {},
    ...typeof metadata_json === "string" ? { metadata_json } : {}
  };
}
function semanticFactorySnapshotForVersion(factorySnapshot) {
  if (!factorySnapshot) return null;
  const eventRows = Array.isArray(factorySnapshot.latestEvents) ? factorySnapshot.latestEvents : [];
  const semanticEvents = eventRows.filter((row) => row.type !== "JOB_HEARTBEAT").slice(0, 16).map(stripVolatileRowFields);
  const jobRows = (rows) => Array.isArray(rows) ? rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    leased: Boolean(row.lease_owner)
  })) : [];
  const messageRows = (rows) => Array.isArray(rows) ? rows.slice(0, 24).map((row) => ({
    id: row.id,
    conversation_id: row.conversation_id,
    type: row.type,
    status: row.status,
    time: row.time,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    data_json: row.data_json,
    metadata_json: row.metadata_json
  })) : [];
  return {
    project: factorySnapshot.project,
    state: factorySnapshot.state,
    artifactSummary: factorySnapshot.artifactSummary,
    chapterFacts: factorySnapshot.chapterFacts,
    activeJobs: jobRows(factorySnapshot.activeJobs),
    runnableJobs: jobRows(factorySnapshot.runnableJobs),
    latestRuns: Array.isArray(factorySnapshot.latestRuns) ? factorySnapshot.latestRuns.slice(0, 8).map(stripVolatileRowFields) : [],
    latestEvents: semanticEvents,
    artifacts: Array.isArray(factorySnapshot.artifacts) ? factorySnapshot.artifacts.map((row) => ({
      kind: row.kind,
      path: row.path,
      status: row.status,
      version: row.version,
      metadata_json: row.metadata_json
    })) : [],
    messageCount: Array.isArray(factorySnapshot.recentMessages) ? factorySnapshot.recentMessages.length : 0,
    recentMessages: messageRows(factorySnapshot.recentMessages),
    recentMemory: Array.isArray(factorySnapshot.recentMemory) ? factorySnapshot.recentMemory.map((row) => ({
      id: row.id,
      source: row.source,
      kind: row.kind,
      content: row.content,
      embedding_status: row.embedding_status
    })) : [],
    checkpoints: Array.isArray(factorySnapshot.checkpoints) ? factorySnapshot.checkpoints.map(stripVolatileRowFields) : [],
    graphNodes: Array.isArray(factorySnapshot.graphNodes) ? factorySnapshot.graphNodes.map(stripVolatileRowFields) : [],
    graphEdges: Array.isArray(factorySnapshot.graphEdges) ? factorySnapshot.graphEdges.map(stripVolatileRowFields) : []
  };
}
function truncateText(value, maxLength) {
  if (typeof value !== "string" || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}
function compactSnapshotRow(row, limits = {}) {
  const compacted = { ...row };
  if (typeof compacted.payload_json === "string") {
    compacted.payload_json = truncateText(compacted.payload_json, limits.payload ?? 700);
  }
  if (typeof compacted.metadata_json === "string") {
    compacted.metadata_json = truncateText(compacted.metadata_json, limits.metadata ?? 700);
  }
  if (typeof compacted.content === "string") {
    compacted.content = truncateText(compacted.content, limits.content ?? 260);
  }
  return compacted;
}
function compactFactorySnapshotForPayload(factorySnapshot) {
  if (!factorySnapshot) return factorySnapshot;
  const snapshot = factorySnapshot;
  const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
  const isPinnedArtifact = (artifact) => {
    const artifactPath = String(artifact.path || "");
    return artifactPath.includes("global-consensus.md") || artifactPath.includes("/consensus/") || artifactPath.includes("current-context.md") || artifactPath.includes("discussion-log.md") || artifactPath.includes("setting-freeze.md") || artifactPath.includes("master-outline.md") || artifactPath.includes("production-resources/");
  };
  const relevantArtifacts = artifacts.filter((artifact) => {
    const artifactPath = String(artifact.path || "");
    return artifactPath.includes("chapter-blueprints/") || artifactPath.includes(".final.md") || artifactPath.includes("-quality.md") || artifactPath.includes("-memory.md") || artifactPath.includes("master-outline.md") || artifactPath.includes("setting-freeze.md") || artifactPath.includes("global-consensus.md") || artifactPath.includes("/consensus/") || artifactPath.includes("current-context.md") || artifactPath.includes("discussion-log.md") || artifactPath.includes("production-resources/") || artifact.kind === "transcript";
  });
  const artifactRowsByPath = /* @__PURE__ */ new Map();
  for (const row of [...relevantArtifacts.filter(isPinnedArtifact), ...relevantArtifacts]) {
    const key = String(row.path || row.id || "");
    if (key && !artifactRowsByPath.has(key)) {
      artifactRowsByPath.set(key, row);
    }
  }
  return {
    ...snapshot,
    latestRuns: Array.isArray(snapshot.latestRuns) ? snapshot.latestRuns.slice(0, 6).map((row) => compactSnapshotRow(row)) : [],
    latestEvents: Array.isArray(snapshot.latestEvents) ? snapshot.latestEvents.slice(0, 24).map((row) => compactSnapshotRow(row)) : [],
    artifacts: [...artifactRowsByPath.values()].slice(0, 80).map((row) => compactSnapshotRow(row)),
    recentMemory: Array.isArray(snapshot.recentMemory) ? snapshot.recentMemory.slice(0, 6).map((row) => compactSnapshotRow(row, { content: 260, metadata: 420 })) : [],
    checkpoints: Array.isArray(snapshot.checkpoints) ? snapshot.checkpoints.slice(0, 6).map((row) => compactSnapshotRow(row)) : [],
    graphNodes: Array.isArray(snapshot.graphNodes) ? snapshot.graphNodes.slice(0, 60).map((row) => compactSnapshotRow(row, { metadata: 500 })) : [],
    graphEdges: Array.isArray(snapshot.graphEdges) ? snapshot.graphEdges.slice(0, 80).map((row) => compactSnapshotRow(row, { metadata: 500 })) : []
  };
}
function normalizeAutopilotRuntimeForPayload(state, factorySnapshot) {
  if (!state?.runtime?.autopilot) return state;
  const activeJobs = Array.isArray(factorySnapshot?.activeJobs) ? factorySnapshot.activeJobs : [];
  const hasRunningJob = activeJobs.some((job) => job && job.status !== "paused" && job.status !== "failed" && job.status !== "completed");
  if (hasRunningJob) {
    if (state.runtime.autopilot.running) {
      return state;
    }
    return {
      ...state,
      runtime: {
        ...state.runtime,
        statusMessage: "\u81EA\u52A8\u521B\u4F5C\u8FD0\u884C\u4E2D\uFF1A\u540E\u53F0 worker \u5DF2\u9886\u53D6\u4EFB\u52A1\uFF0C\u6B63\u5728\u6309\u6570\u636E\u5E93\u8FDB\u5EA6\u7EE7\u7EED\u63A8\u8FDB\u3002",
        autopilot: {
          ...state.runtime.autopilot,
          running: true,
          stopRequested: false,
          mode: "background",
          lastStep: state.runtime.autopilot.lastStep === "stopped" ? "worker:running" : state.runtime.autopilot.lastStep,
          statusMessage: "\u540E\u53F0 worker \u6B63\u5728\u6267\u884C\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u3002"
        }
      }
    };
  }
  if (!state.runtime.autopilot.running && !state.runtime.autopilot.stopRequested) {
    return state;
  }
  return {
    ...state,
    runtime: {
      ...state.runtime,
      statusMessage: state.runtime.statusMessage || "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5F53\u524D\u672A\u8FD0\u884C\u3002",
      autopilot: {
        ...state.runtime.autopilot,
        running: false,
        stopRequested: false,
        mode: "idle",
        lastStep: "stopped",
        statusMessage: state.runtime.autopilot.statusMessage || "\u6570\u636E\u5E93\u4E2D\u6CA1\u6709\u53EF\u6267\u884C\u7684\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\uFF1B\u5F53\u524D\u6CA1\u6709\u540E\u53F0 worker \u5728\u8FD0\u884C\u3002"
      }
    }
  };
}
async function createWorkspacePayload(projectRoot, state, options = {}) {
  const diskState = options.syncState ? await tryLoadState(projectRoot) : null;
  const factorySnapshot = options.rootDir && options.projectId ? await withFactoryDb(options.rootDir, async (db) => db.getSnapshot(options.projectId)).catch(() => null) : null;
  const rawResolvedState = normalizeAutopilotRuntimeForPayload(
    factorySnapshot?.state ?? state ?? diskState,
    factorySnapshot
  );
  const resolvedState = stateWithChapterFactsForPayload(rawResolvedState, factorySnapshot);
  const serializedResolvedState = resolvedState ? stableJson(serializeState(resolvedState)) : null;
  const serializedDiskState = diskState ? stableJson(serializeState(diskState)) : null;
  const serializedDbState = factorySnapshot?.state ? stableJson(serializeState(factorySnapshot.state)) : null;
  const shouldPersistResolvedState = options.syncState && resolvedState && serializedResolvedState && serializedDiskState && serializedDiskState !== serializedResolvedState;
  if (shouldPersistResolvedState) {
    await saveAutonomousState(projectRoot, resolvedState).catch(() => void 0);
  }
  if (options.syncState && resolvedState) {
    await syncCurrentContextPacketState(projectRoot, resolvedState).catch(() => void 0);
  }
  const shouldSyncDbState = options.syncState && options.rootDir && options.projectId && resolvedState && serializedResolvedState && serializedDbState && serializedDbState !== serializedResolvedState;
  if (shouldSyncDbState) {
    await withFactoryDb(options.rootDir, async (db) => {
      db.updateProjectState(options.projectId, resolvedState);
    }).catch(() => void 0);
  }
  const dbGraph = factorySnapshot && options.projectId && factorySnapshot.graphNodes.length > 0 ? superGraphFromDbRows(options.projectId, factorySnapshot.graphNodes, factorySnapshot.graphEdges) : null;
  const graphDir = path.join(projectRoot, ".ai-novel", "graph");
  const fileGraphIndex = await fs.readFile(path.join(graphDir, "index.json"), "utf8").then((raw) => JSON.parse(raw)).catch(() => null);
  const fileGraphViolations = await fs.readFile(path.join(graphDir, "violations.json"), "utf8").then((raw) => JSON.parse(raw)).catch(() => []);
  const graphIndex = dbGraph ? buildSuperGraphIndex(dbGraph) : fileGraphIndex;
  const graphViolations = dbGraph ? validateSuperGraph(dbGraph) : fileGraphViolations;
  const useCompactPayload = options.includeTranscript === false || options.compactPayload === true;
  const compactState = useCompactPayload ? compactStateForPayload(resolvedState, {
    chapterPage: options.chapterPage,
    chapterPageSize: options.chapterPageSize
  }) : resolvedState ? serializeState(resolvedState) : null;
  const compactFactorySnapshot = factorySnapshot ? {
    ...factorySnapshot,
    state: compactState
  } : null;
  const responseFactorySnapshot = useCompactPayload ? compactFactorySnapshotForPayload(compactFactorySnapshot) : compactFactorySnapshot;
  const consensus = await readWorkspaceText(projectRoot, "prompts", "global-consensus.md");
  const contextPacket = await readWorkspaceText(projectRoot, "context", "current-context.md");
  const payload = {
    state: compactState,
    consensus,
    contextPacket,
    graphIndex,
    graphViolations,
    factorySnapshot: responseFactorySnapshot
  };
  const snapshotVersion = createSnapshotVersion({
    state: compactState,
    consensus,
    contextPacket,
    graphViolations,
    factorySnapshot: semanticFactorySnapshotForVersion(responseFactorySnapshot)
  });
  if (options.includeTranscript !== false) {
    const transcript = await readDiscussionTranscript(projectRoot);
    const messageEntries = discussionEntriesFromSnapshot(factorySnapshot);
    return {
      ...payload,
      snapshotVersion,
      transcript,
      ...messageEntries ? { ...messageEntries, meta: { ...messageEntries.meta, transcriptBytes: Buffer.byteLength(transcript) } } : parseTranscriptEntries(transcript)
    };
  }
  return {
    ...payload,
    snapshotVersion
  };
}
async function tryLoadState(projectRoot) {
  try {
    return await loadAutonomousState(projectRoot);
  } catch {
    return null;
  }
}
async function ensureDurableAutopilotJob(rootDir, projectId, message, options = {}) {
  if (!projectId) {
    return null;
  }
  return withFactoryDb(rootDir, async (db) => {
    const projectJobs = db.listProjectJobs(projectId, "autopilot");
    const activeJobs = projectJobs.filter((job) => job.status === "running" || job.status === "paused").sort(
      (left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || ""))
    );
    const recoverableFailedJob = projectJobs.filter((job) => job.status === "failed" && db.jobFailureLooksRecoverable(String(job.id))).sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))[0];
    const reusableJob = activeJobs[0] ?? recoverableFailedJob;
    for (const duplicate of activeJobs.slice(1)) {
      db.cancelJob(String(duplicate.id));
    }
    if (reusableJob?.id) {
      if (reusableJob.status === "failed") {
        db.resumeJob(String(reusableJob.id), { message, mode: "background" });
      } else {
        db.updateJobPayload(String(reusableJob.id), { message, mode: "background", submittedAt: (/* @__PURE__ */ new Date()).toISOString() });
      }
      db.recordEvent(projectId, typeof reusableJob.run_id === "string" ? reusableJob.run_id : null, "JOB_REUSED", {
        id: reusableJob.id,
        kind: reusableJob.kind,
        status: reusableJob.status,
        requestedMessage: message,
        source: options.source || "autopilot"
      });
      db.recordEvent(projectId, typeof reusableJob.run_id === "string" ? reusableJob.run_id : null, "AUTOPILOT_INSTRUCTION_QUEUED", {
        id: reusableJob.id,
        message,
        status: reusableJob.status,
        source: options.source || "autopilot"
      });
      return String(reusableJob.id);
    }
    const jobId = db.createJob({
      projectId,
      kind: "autopilot",
      status: "running",
      payload: { message, mode: "background", source: options.source || "autopilot" }
    });
    db.recordEvent(projectId, null, "AUTOPILOT_INSTRUCTION_QUEUED", {
      id: jobId,
      message,
      status: "running",
      source: options.source || "autopilot"
    });
    return jobId;
  }).catch(() => null);
}
function createAutopilotKickoffMessage(state) {
  return [
    `\u8BF7\u57FA\u4E8E\u5C0F\u8BF4\u60F3\u6CD5\u201C${state.project.idea}\u201D\u63A5\u7BA1\u521B\u4F5C\u6D41\u7A0B\u3002`,
    "\u5148\u5B8C\u6210\u4E16\u754C\u89C2\u57FA\u7EBF\u3001\u4E3B\u89D2\u6838\u5FC3\u3001\u4E3B\u7EBF\u65B9\u5411\u7684\u9996\u8F6E\u7EDF\u4E00\u8BA8\u8BBA\u3002",
    `\u76EE\u6807\u603B\u7AE0\u6570\uFF1A${state.plan.totalChapters}\uFF0C\u5355\u7AE0\u5B57\u6570\uFF1A${state.plan.chapterWordTarget}\u3002`,
    "\u4E0D\u8981\u5411\u6211\u63D0\u95EE\u9009\u9879\uFF0C\u7F3A\u5931\u4FE1\u606F\u8BF7\u81EA\u884C\u5EFA\u7ACB\u9AD8\u8D28\u91CF\u5DE5\u4F5C\u5047\u8BBE\uFF0C\u5E76\u7ED9\u51FA\u7EDF\u4E00\u7ED3\u8BBA\u3002"
  ].join("");
}
async function enqueueKnowledgeReindexJobs(rootDir, projectId, scope = "all", options = {}) {
  return withFactoryDb(rootDir, async (db) => {
    const snapshot = db.getSnapshot(projectId);
    const queued = [];
    const reason = options.reason || "api_reindex";
    if (scope === "global" || scope === "all") {
      const id = db.createJob({
        projectId,
        kind: "knowledge_global_reindex",
        status: "idle",
        payload: {
          scope: "global",
          reason,
          limit: options.limit
        }
      });
      queued.push({ id, kind: "knowledge_global_reindex" });
    }
    if (scope === "project" || scope === "all") {
      const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
      const artifactPaths = [...new Set(artifacts.map((artifact) => String(artifact.path || "")).filter(
        (artifactPath) => artifactPath.endsWith(".md") && (artifactPath.includes("global-consensus.md") || artifactPath.includes("/consensus/") || artifactPath.includes("current-context.md") || artifactPath.includes("discussion-log.md") || artifactPath.includes("setting-freeze.md") || artifactPath.includes("master-outline.md") || artifactPath.includes("chapter-blueprints/") || artifactPath.includes(".final.md") || artifactPath.includes("-quality.md") || artifactPath.includes("-memory.md") || artifactPath.includes("production-resources/"))
      ))];
      for (const artifactPath of artifactPaths.slice(0, 200)) {
        const id = db.createJob({
          projectId,
          kind: "knowledge_project_artifact",
          status: "idle",
          payload: {
            projectId,
            artifactPath,
            kind: "artifact",
            reason
          }
        });
        queued.push({ id, kind: "knowledge_project_artifact", artifactPath });
      }
    }
    db.recordEvent(projectId, null, "KNOWLEDGE_REINDEX_QUEUED", {
      scope,
      reason,
      jobs: queued
    });
    return queued;
  });
}
async function stopInProcessAutopilotBeforeProjectDelete(projectRoot) {
  const job = getAutopilotJob(projectRoot);
  if (!job) {
    return false;
  }
  stopAutopilotJob(projectRoot);
  await Promise.race([
    job.promise.catch(() => void 0),
    new Promise((resolve) => setTimeout(resolve, 5e3))
  ]);
  return true;
}
async function buildProjectSummary(rootDir, project) {
  let dbSnapshot = null;
  try {
    dbSnapshot = await withFactoryDb(rootDir, async (db) => db.getSnapshot(project.id)).catch(() => null);
  } catch (e) {
  }
  const state = dbSnapshot?.state || await tryLoadState(project.projectRoot).catch(() => null);
  if (!state) {
    return {
      source: "empty",
      stage: "worldbuilding_dialogue",
      progressPercent: 0,
      totalChapters: project.totalChapters || 0,
      completedChapters: 0,
      pendingChapters: project.totalChapters || 0,
      inProgressChapters: 0,
      blockedChapters: 0,
      activeJobs: 0,
      runnableJobs: 0,
      latestEventType: "",
      latestEventAt: "",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  const tasks = Array.isArray(state.plan?.chapterTasks) ? state.plan.chapterTasks : [];
  const chapterFacts = Array.isArray(dbSnapshot?.chapterFacts) ? dbSnapshot.chapterFacts : [];
  const totalChapters = Number(state.plan?.totalChapters || project.totalChapters || tasks.length || 0);
  const passedChapters = chapterFacts.length > 0 ? chapterFacts.filter((fact) => fact.status === "complete").length : tasks.filter((task) => task.status === "complete").length;
  let contiguousCompletedChapters = 0;
  if (chapterFacts.length > 0) {
    const factsByChapter = new Map(chapterFacts.map((fact) => [Number(fact.chapterNumber), fact]));
    for (let ch = 1; ch <= totalChapters; ch += 1) {
      const factRecord = factsByChapter.get(ch);
      if (factRecord?.status !== "complete") break;
      contiguousCompletedChapters += 1;
    }
  } else {
    for (const task of tasks) {
      if (task.status !== "complete") break;
      contiguousCompletedChapters += 1;
    }
  }
  const completedChapters = Math.min(passedChapters, contiguousCompletedChapters);
  const inProgressChapters = chapterFacts.length > 0 ? chapterFacts.filter((fact) => fact.status === "in_progress").length : tasks.filter((task) => task.status === "in_progress").length;
  const blockedChapters = chapterFacts.length > 0 ? chapterFacts.filter((fact) => fact.status === "blocked").length : tasks.filter((task) => task.status === "blocked").length;
  const pendingChapters = Math.max(0, totalChapters - completedChapters - inProgressChapters - blockedChapters);
  const progressPercent = totalChapters > 0 ? Math.max(0, Math.min(100, Math.round(completedChapters / totalChapters * 100))) : 0;
  const activeJobs = Array.isArray(dbSnapshot?.activeRuns) ? dbSnapshot.activeRuns.length : 0;
  const runnableJobs = Array.isArray(dbSnapshot?.runnableJobs) ? dbSnapshot.runnableJobs.length : 0;
  const latestEvent = Array.isArray(dbSnapshot?.latestEvents) ? dbSnapshot.latestEvents[0] : null;
  return {
    source: dbSnapshot ? "db" : "state",
    stage: state.runtime?.stage || "worldbuilding_dialogue",
    progressPercent,
    totalChapters,
    completedChapters,
    pendingChapters,
    inProgressChapters,
    blockedChapters,
    activeJobs,
    runnableJobs,
    latestEventType: latestEvent?.type || "",
    latestEventAt: latestEvent?.created_at || latestEvent?.updated_at || "",
    updatedAt: state.runtime?.lastUpdatedAt || (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function reconcileFactoryProjectsWithRegistry(rootDir) {
  const projects = await listAutonomousProjects(rootDir);
  await withFactoryDb(rootDir, async (db) => {
    const removedProjectIds = db.pruneProjectsExcept(projects.map((project) => project.id));
    for (const projectId of removedProjectIds) {
      db.recordEvent(null, null, "ORPHAN_PROJECT_PRUNED", { projectId });
    }
  }).catch(() => void 0);
  for (const project of projects) {
    project.summary = await buildProjectSummary(rootDir, project);
  }
  return projects;
}
async function resolveProjectContext(rootDir, projectId) {
  const projects = await reconcileFactoryProjectsWithRegistry(rootDir);
  if (projectId) {
    return {
      projects,
      projectId,
      projectRoot: await resolveManagedProjectRoot(rootDir, projectId),
      mode: "managed"
    };
  }
  if (projects.length === 1) {
    return {
      projects,
      projectId: projects[0].id,
      projectRoot: await resolveManagedProjectRoot(rootDir, projects[0].id),
      mode: "managed"
    };
  }
  if (projects.length > 1) {
    return {
      projects,
      projectId: null,
      projectRoot: null,
      mode: "selection_required"
    };
  }
  const legacyState = await tryLoadState(rootDir);
  if (legacyState) {
    return {
      projects: [],
      projectId: "legacy-root-workspace",
      projectRoot: rootDir,
      mode: "legacy"
    };
  }
  return {
    projects,
    projectId: null,
    projectRoot: null,
    mode: "empty"
  };
}
async function handleNovelStudioApi(rootDir, method, pathname, body = {}, options = {}) {
  const requestUrl = new URL(pathname, "http://local");
  const requestPathname = requestUrl.pathname;
  if (method === "GET" && requestPathname === "/api/llm-configs") {
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    return {
      status: 200,
      payload: {
        configs
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/llm-configs") {
    const name = String(body.name || "").trim();
    const baseUrl = String(body.baseUrl || "").trim();
    const apiKey = String(body.apiKey || "").trim();
    const modelName = String(body.modelName || "").trim();
    const temperature = typeof body.temperature === "number" ? body.temperature : 0.1;
    const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : 12e4;
    if (!name || !baseUrl || !apiKey || !modelName) {
      return { status: 400, payload: { error: "missing_fields" } };
    }
    const configId = typeof body.id === "string" ? body.id.trim() : null;
    await withFactoryDb(rootDir, async (db) => {
      if (configId) {
        db.updateLlmConfig(configId, { name, baseUrl, apiKey, modelName, temperature, timeoutMs });
      } else {
        db.addLlmConfig({ name, baseUrl, apiKey, modelName, temperature, timeoutMs });
      }
    });
    await loadActiveLlmConfig(rootDir);
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    return {
      status: 200,
      payload: {
        success: true,
        configs
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/llm-configs/activate") {
    const id = typeof body.id === "string" ? body.id.trim() : null;
    if (!id) {
      return { status: 400, payload: { error: "id_required" } };
    }
    await withFactoryDb(rootDir, async (db) => {
      db.activateLlmConfig(id);
    });
    await loadActiveLlmConfig(rootDir);
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    return {
      status: 200,
      payload: {
        success: true,
        configs
      }
    };
  }
  if (method === "DELETE" && requestPathname === "/api/llm-configs") {
    const id = requestUrl.searchParams.get("id");
    if (!id) {
      return { status: 400, payload: { error: "id_required" } };
    }
    await withFactoryDb(rootDir, async (db) => {
      db.deleteLlmConfig(id);
    });
    await loadActiveLlmConfig(rootDir);
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    return {
      status: 200,
      payload: {
        success: true,
        configs
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/projects") {
    return {
      status: 200,
      payload: {
        projects: await reconcileFactoryProjectsWithRegistry(rootDir),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "DELETE" && requestPathname.startsWith("/api/projects/")) {
    const projectId = decodeURIComponent(requestPathname.replace(/^\/api\/projects\//, "")).trim();
    if (!projectId) {
      return { status: 400, payload: { error: "project_id_required" } };
    }
    const projectRoot = await resolveManagedProjectRoot(rootDir, projectId).catch(() => null);
    const stoppedInProcess = projectRoot ? await stopInProcessAutopilotBeforeProjectDelete(projectRoot) : false;
    const deleted = await deleteManagedAutonomousProject(rootDir, projectId);
    if (!deleted) {
      return {
        status: 404,
        payload: {
          error: "project_not_found",
          projects: await listAutonomousProjects(rootDir),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    return {
      status: 200,
      payload: {
        deletedProject: deleted.project,
        stoppedInProcess,
        projects: await listAutonomousProjects(rootDir),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/health") {
    return {
      status: 200,
      payload: {
        ok: true,
        service: "ai-novel-server",
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/ready") {
    try {
      await reconcileFactoryProjectsWithRegistry(rootDir);
      const factory = await withFactoryDb(rootDir, async (db) => db.getOperationalStatus());
      return {
        status: 200,
        payload: {
          ok: true,
          service: "ai-novel-server",
          factory,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    } catch (error) {
      return {
        status: 503,
        payload: {
          ok: false,
          service: "ai-novel-server",
          error: error instanceof Error ? error.message : String(error),
          checkedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    }
  }
  if (method === "POST" && requestPathname === "/api/projects") {
    const idea = String(body.idea || "").trim();
    const totalChapters = Number.parseInt(String(body.chapters || "24"), 10);
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || "2500"), 10);
    if (!idea) {
      return { status: 400, payload: { error: "idea_required" } };
    }
    const created = await createManagedAutonomousProject({
      rootDir,
      idea,
      totalChapters,
      chapterWordTarget,
      title: typeof body.title === "string" ? body.title : void 0,
      creativeProfile: body.creativeProfile && typeof body.creativeProfile === "object" ? body.creativeProfile : void 0
    });
    await recordStatusMessage(rootDir, {
      projectId: created.project.id,
      conversationId: "workflow-control",
      runId: null,
      title: "\u9879\u76EE\u5DF2\u521B\u5EFA",
      content: "\u5DF2\u5EFA\u7ACB\u72EC\u7ACB\u5DE5\u4F5C\u533A\u3002\u81EA\u52A8\u521B\u4F5C\u4E0D\u4F1A\u81EA\u52A8\u542F\u52A8\uFF0C\u8BF7\u8FDB\u5165\u521B\u4F5C\u53F0\u540E\u70B9\u51FB\u201C\u5F00\u59CB\u521B\u4F5C\u201D\u3002",
      metadata: { source: "project_created", kickoffQueued: false }
    });
    const state = await markAutopilot(created.project.projectRoot, {
      running: false,
      stopRequested: false,
      mode: "idle",
      target: null,
      lastStep: "awaiting_user_start",
      statusMessage: "\u9879\u76EE\u5DF2\u521B\u5EFA\uFF0C\u7B49\u5F85\u624B\u52A8\u5F00\u59CB\u81EA\u52A8\u521B\u4F5C\u3002"
    }, { factoryRootDir: rootDir, projectId: created.project.id });
    return {
      status: 201,
      payload: {
        activeProjectId: created.project.id,
        projectId: created.project.id,
        projects: await reconcileFactoryProjectsWithRegistry(rootDir),
        kickoffQueued: false,
        autopilotJobId: null,
        autopilotQueued: false,
        state,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/knowledge-graph") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    let graph = { nodes: [], edges: [] };
    try {
      const dbGraph = await withFactoryDb(rootDir, async (db) => db.getGraph(context.projectId));
      if (dbGraph && Array.isArray(dbGraph.nodes) && dbGraph.nodes.length > 0) {
        const storyNodeTypes = /* @__PURE__ */ new Set([
          "Character",
          "Location",
          "Faction",
          "Event",
          "Scene",
          "Foreshadowing",
          "WorldRule",
          "Conflict",
          "Relationship",
          "TimelinePoint"
        ]);
        const nodes = dbGraph.nodes.map((n) => {
          let properties = {};
          try {
            properties = typeof n.metadata_json === "string" ? JSON.parse(n.metadata_json) : n.metadata_json || {};
          } catch (e) {
          }
          return {
            id: n.id,
            node_type: n.type,
            label: n.label,
            content: properties.description || properties.desc || n.label,
            metadata_json: JSON.stringify({
              importance: properties.importance || 3,
              tags: properties.tags || [],
              ...properties
            })
          };
        });
        const storyNodes = nodes.filter((n) => {
          const lowerType = String(n.node_type || "").toLowerCase();
          return Array.from(storyNodeTypes).some((st) => st.toLowerCase() === lowerType);
        });
        if (storyNodes.length > 0) {
          const storyNodeIds = new Set(storyNodes.map((n) => n.id));
          const edges = dbGraph.edges.filter((e) => storyNodeIds.has(e.from_node_id) && storyNodeIds.has(e.to_node_id)).map((e, index) => ({
            id: e.id || `db-edge-${index}`,
            source_id: e.from_node_id,
            target_id: e.to_node_id,
            relation_type: e.type || "\u5173\u8054",
            metadata_json: e.metadata_json || "{}"
          }));
          graph = { nodes: storyNodes, edges };
        }
      }
    } catch (err) {
      console.error("Failed to query graph from factory db:", err);
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...graph,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/status") {
    const includeTranscript = requestUrl.searchParams.get("includeTranscript") === "1";
    const chapterPage = Number.parseInt(String(requestUrl.searchParams.get("chapterPage") || ""), 10);
    const chapterPageSize = Number.parseInt(String(requestUrl.searchParams.get("chapterPageSize") || ""), 10);
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (context.mode === "selection_required") {
      return {
        status: 409,
        payload: {
          error: "project_selection_required",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    if (!context.projectRoot) {
      return {
        status: 404,
        payload: {
          error: "workspace_not_initialized",
          transcript: "",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const snapshotState = context.projectId ? await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId).state).catch(() => null) : null;
    const fileState = await tryLoadState(context.projectRoot);
    const state = snapshotState ?? fileState;
    if (!state) {
      return {
        status: 404,
        payload: {
          error: "workspace_not_initialized",
          transcript: "",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const workspacePayload = await createWorkspacePayload(context.projectRoot, state, {
      rootDir,
      projectId: context.projectId,
      syncState: true,
      includeTranscript,
      chapterPage: Number.isFinite(chapterPage) ? chapterPage : void 0,
      chapterPageSize: Number.isFinite(chapterPageSize) ? chapterPageSize : void 0
    });
    const knownSnapshotVersion = requestUrl.searchParams.get("knownSnapshotVersion");
    if (!includeTranscript && knownSnapshotVersion && knownSnapshotVersion === workspacePayload.snapshotVersion) {
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          notModified: true,
          snapshotVersion: workspacePayload.snapshotVersion
        }
      };
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...workspacePayload,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/transcript") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const limit = Math.max(1, Math.min(200, Number.parseInt(requestUrl.searchParams.get("limit") || "80", 10)));
    const transcript = await readDiscussionTranscript(context.projectRoot);
    const messageEntries = context.projectId ? await withFactoryDb(rootDir, async (db) => messageRowsToEntries(db.listMessages(context.projectId, { limit }), { limit, transcriptBytes: Buffer.byteLength(transcript) })).catch(() => null) : null;
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...messageEntries ?? parseTranscriptEntries(transcript, { limit }),
        transcript,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/messages") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const limit = Math.max(1, Math.min(500, Number.parseInt(requestUrl.searchParams.get("limit") || "80", 10)));
    const offset = Math.max(0, Number.parseInt(requestUrl.searchParams.get("offset") || "0", 10) || 0);
    const conversationId = requestUrl.searchParams.get("conversationId") || void 0;
    const messagePage = await withFactoryDb(rootDir, async (db) => {
      const totalMessages2 = db.countMessages(context.projectId, { conversationId });
      const messages2 = db.listMessages(context.projectId, { limit, offset, conversationId });
      return { messages: messages2, totalMessages: totalMessages2 };
    }).catch(() => ({ messages: [], totalMessages: 0 }));
    const messages = messagePage.messages;
    const totalMessages = messagePage.totalMessages;
    const nextOffset = offset + messages.length;
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        messages,
        ...messageRowsToEntries(messages, { limit }),
        pagination: {
          limit,
          offset,
          returned: messages.length,
          totalMessages,
          hasMore: nextOffset < totalMessages,
          nextOffset: nextOffset < totalMessages ? nextOffset : null,
          conversationId: conversationId || null
        },
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/chapters/preview") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const chapterNumber = Number.parseInt(String(requestUrl.searchParams.get("chapterNumber") || ""), 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return { status: 400, payload: { error: "chapter_number_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`;
    const relativePath = `.ai-novel/chapters/${chapterId}.final.md`;
    const content = await readWorkspaceText(context.projectRoot, "chapters", `${chapterId}.final.md`);
    if (!content) {
      return {
        status: 404,
        payload: {
          error: "chapter_not_found",
          chapterNumber,
          path: relativePath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        chapterNumber,
        path: relativePath,
        content,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/artifacts/preview") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const artifactPath = String(requestUrl.searchParams.get("path") || "").trim();
    if (!artifactPath) {
      return { status: 400, payload: { error: "artifact_path_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const content = await readWorkspaceArtifactText(context.projectRoot, artifactPath);
    if (content === null) {
      return {
        status: 400,
        payload: {
          error: "artifact_path_not_allowed",
          path: artifactPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    if (!content) {
      return {
        status: 404,
        payload: {
          error: "artifact_not_found",
          path: artifactPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        path: artifactPath,
        content,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/init") {
    const idea = String(body.idea || "").trim();
    const totalChapters = Number.parseInt(String(body.chapters || "24"), 10);
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || "2500"), 10);
    if (!idea) {
      return { status: 400, payload: { error: "idea_required" } };
    }
    const state = await initAutonomousProject({
      rootDir,
      idea,
      totalChapters,
      chapterWordTarget,
      title: typeof body.title === "string" ? body.title : void 0
    });
    return { status: 200, payload: await createWorkspacePayload(rootDir, state, { rootDir, projectId: "legacy-root-workspace", syncState: true }) };
  }
  if (method === "POST" && requestPathname === "/api/advance") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const { state } = await executeManualAdvanceCommand(context.projectRoot, {
      factoryRootDir: rootDir,
      projectId: context.projectId,
      source: "api",
      requestedBy: "api:/api/advance"
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/chapters/retry") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const chapterNumber = Number.parseInt(String(body.chapterNumber || ""), 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return { status: 400, payload: { error: "chapter_number_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    try {
      const { state, recoveryLimited } = await executeManualRetryChapterCommand(context.projectRoot, chapterNumber, {
        factoryRootDir: rootDir,
        projectId: context.projectId,
        source: "api",
        requestedBy: "api:/api/chapters/retry",
        runNow: body.runNow !== false
      });
      await recordStatusMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: "workflow-control",
        title: "\u7AE0\u8282\u91CD\u8BD5\u5DF2\u63A5\u6536",
        content: recoveryLimited ? `\u7B2C ${chapterNumber} \u7AE0\u5DF2\u8FBE\u5230\u81EA\u52A8\u6062\u590D\u4E0A\u9650\uFF0C\u9700\u8981\u4EBA\u5DE5\u5BA1\u9605\u540E\u518D\u7EE7\u7EED\u3002` : `\u7B2C ${chapterNumber} \u7AE0\u5DF2\u8FDB\u5165\u8D28\u91CF\u8FD4\u5DE5\u95ED\u73AF\uFF0C\u7CFB\u7EDF\u4F1A\u6309 DB \u72B6\u6001\u7EE7\u7EED\u63A8\u8FDB\u3002`,
        metadata: {
          source: "api_chapter_retry",
          chapterNumber,
          recoveryLimited
        }
      });
      await recordToolMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: "workflow-control",
        toolName: "chapter-retry",
        status: recoveryLimited ? "failed" : "completed",
        input: {
          chapterNumber,
          runNow: body.runNow !== false
        },
        output: {
          recoveryLimited,
          chapterStatus: state.plan.chapterTasks[chapterNumber - 1]?.status || null,
          stage: state.runtime.stage
        },
        content: recoveryLimited ? `\u7B2C ${chapterNumber} \u7AE0\u91CD\u8BD5\u5DF2\u89E6\u8FBE\u6062\u590D\u4E0A\u9650\u3002` : `\u7B2C ${chapterNumber} \u7AE0\u91CD\u8BD5\u547D\u4EE4\u5DF2\u6267\u884C\u5E76\u5199\u56DE\u6570\u636E\u5E93\u72B6\u6001\u3002`,
        metadata: {
          source: "api_chapter_retry",
          chapterNumber,
          recoveryLimited
        }
      });
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          recoveryLimited,
          ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("chapter_not_found:")) {
        return { status: 404, payload: { error: "chapter_not_found", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
      }
      throw error;
    }
  }
  if (method === "POST" && requestPathname === "/api/knowledge/reindex") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const requestedScope = String(body.scope || "all");
    const scope = requestedScope === "global" || requestedScope === "project" || requestedScope === "all" ? requestedScope : "all";
    const limit = Number(body.limit);
    const queuedKnowledgeJobs = await enqueueKnowledgeReindexJobs(rootDir, context.projectId, scope, {
      limit: Number.isFinite(limit) && limit > 0 ? limit : void 0,
      reason: "api_reindex"
    });
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "knowledge-control",
      runId: null,
      toolName: "knowledge-reindex",
      status: "completed",
      input: { scope, limit: Number.isFinite(limit) && limit > 0 ? limit : null },
      output: { queuedJobs: queuedKnowledgeJobs },
      content: `\u77E5\u8BC6\u5E93\u91CD\u5EFA\u4EFB\u52A1\u5DF2\u5199\u5165\u6570\u636E\u5E93\uFF1A${queuedKnowledgeJobs.length} \u4E2A\u540E\u53F0\u4EFB\u52A1\u3002`,
      metadata: { source: "api_knowledge_reindex", scope }
    });
    const state = await tryLoadState(context.projectRoot);
    return {
      status: 202,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        queuedKnowledgeJobs,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/knowledge/search") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const query = String(body.query || "").trim();
    if (!query) {
      return {
        status: 400,
        payload: {
          error: "query_required",
          message: "\u8BF7\u8F93\u5165\u8981\u68C0\u7D22\u7684\u6210\u8BED\u3001\u573A\u666F\u3001\u8BBE\u5B9A\u6216\u7AE0\u8282\u7EA6\u675F\u3002",
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const requestedLimit = Number(body.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(20, Math.floor(requestedLimit)) : 8;
    const scopes = readKnowledgeScopes(body.scopes);
    const sourceTypes = readStringArray(body.sourceTypes);
    const chunkTypes = readStringArray(body.chunkTypes);
    const rows = await retrieveKnowledge({
      rootDir,
      projectId: context.projectId,
      query,
      scopes,
      sourceTypes: sourceTypes.length ? sourceTypes : void 0,
      chunkTypes: chunkTypes.length ? chunkTypes : void 0,
      limit,
      recordCitation: true
    });
    const knowledgeSearch = {
      query,
      filters: {
        scopes: scopes || ["global", "project"],
        sourceTypes,
        chunkTypes,
        limit
      },
      total: rows.length,
      rows: rows.map(normalizeKnowledgeSearchRow),
      searchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "knowledge-control",
      runId: null,
      toolName: "knowledge-search",
      status: "completed",
      input: knowledgeSearch.filters,
      output: {
        query,
        total: knowledgeSearch.total,
        rows: knowledgeSearch.rows.map((row) => ({
          chunkId: row.chunkId,
          score: row.score,
          chunkType: row.chunkType,
          source: row.source
        }))
      },
      content: `\u77E5\u8BC6\u5E93\u624B\u52A8\u68C0\u7D22\u5B8C\u6210\uFF1A${query}\uFF0C\u547D\u4E2D ${knowledgeSearch.total} \u4E2A\u7247\u6BB5\u3002`,
      metadata: { source: "api_knowledge_search", query }
    });
    const state = await tryLoadState(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        knowledgeSearch,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/knowledge/evaluate") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const requestedK = Number(body.k);
    const k = Number.isFinite(requestedK) && requestedK > 0 ? Math.floor(requestedK) : 8;
    const explicitCases = Array.isArray(body.cases) ? body.cases : [];
    const cases = explicitCases.length > 0 ? explicitCases.map((item, index) => {
      const record = item && typeof item === "object" ? item : {};
      const expectedChunkIds = Array.isArray(record.expectedChunkIds) ? record.expectedChunkIds.map((id) => String(id)).filter(Boolean) : [];
      return {
        name: String(record.name || `manual-${index + 1}`),
        query: String(record.query || ""),
        expectedChunkIds,
        projectId: context.projectId,
        scopes: Array.isArray(record.scopes) ? record.scopes.filter((scope) => scope === "global" || scope === "project") : ["global", "project"],
        sourceTypes: Array.isArray(record.sourceTypes) ? record.sourceTypes.map((value) => String(value)).filter(Boolean) : void 0,
        chunkTypes: Array.isArray(record.chunkTypes) ? record.chunkTypes.map((value) => String(value)).filter(Boolean) : void 0,
        k: Number.isFinite(Number(record.k)) && Number(record.k) > 0 ? Math.floor(Number(record.k)) : k
      };
    }).filter((item) => item.query && item.expectedChunkIds.length > 0) : await withFactoryDb(rootDir, async (db) => {
      const snapshot = db.getSnapshot(context.projectId);
      return (Array.isArray(snapshot.knowledge?.citations) ? snapshot.knowledge.citations : []).map((citation, index) => {
        const expectedChunkIds = readJsonArray(citation.used_chunk_ids_json).map((id) => String(id)).filter(Boolean);
        return {
          name: `recent-citation-${index + 1}`,
          query: String(citation.query || ""),
          expectedChunkIds,
          projectId: context.projectId,
          scopes: ["global", "project"],
          k
        };
      }).filter((item) => item.query && item.expectedChunkIds.length > 0).slice(0, 6);
    }).catch(() => []);
    if (!cases.length) {
      return {
        status: 422,
        payload: {
          error: "knowledge_benchmark_cases_required",
          message: "\u9700\u8981\u63D0\u4F9B\u5305\u542B query \u548C expectedChunkIds \u7684 cases\uFF0C\u6216\u5148\u4EA7\u751F\u5E26 used chunk \u7684\u77E5\u8BC6\u5E93\u5F15\u7528\u8BB0\u5F55\u3002",
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const evaluation = await evaluateKnowledgeBenchmark(rootDir, cases);
    const evaluationArtifactPath = await writeKnowledgeEvaluationArtifact(rootDir, context.projectRoot, context.projectId, evaluation);
    await withFactoryDb(rootDir, async (db) => {
      db.recordEvent(context.projectId, null, "KNOWLEDGE_EVALUATION_COMPLETED", {
        artifactPath: evaluationArtifactPath,
        summary: evaluation.summary,
        cases: evaluation.cases.map((item) => ({
          name: item.name,
          query: item.query,
          k: item.k,
          hitAtK: item.hitAtK,
          recallAtK: item.recallAtK,
          precisionAtK: item.precisionAtK,
          matchedChunkIds: item.matchedChunkIds,
          missedChunkIds: item.missedChunkIds
        }))
      });
    }).catch(() => void 0);
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "knowledge-control",
      runId: null,
      toolName: "knowledge-evaluate",
      status: "completed",
      input: { caseCount: cases.length, k, explicit: explicitCases.length > 0 },
      output: { ...evaluation, artifactPath: evaluationArtifactPath },
      content: `\u77E5\u8BC6\u5E93\u53EC\u56DE\u8BC4\u4F30\u5B8C\u6210\uFF1A${evaluation.summary.totalCases} \u4E2A\u6837\u672C\uFF0CHit@K ${(evaluation.summary.hitRateAtK * 100).toFixed(0)}%\uFF0C\u5E73\u5747 Recall@K ${(evaluation.summary.meanRecallAtK * 100).toFixed(0)}%\u3002`,
      metadata: { source: "api_knowledge_evaluate", artifactPath: evaluationArtifactPath }
    });
    const state = await tryLoadState(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        knowledgeEvaluation: evaluation,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/cover") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const state = await prepareCoverGeneration(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/provider-test") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    const result = await testProviderConnectivity(
      {
        baseUrl: typeof body.LLM_BASE_URL === "string" ? body.LLM_BASE_URL : void 0,
        apiKey: typeof body.LLM_API_KEY === "string" ? body.LLM_API_KEY : void 0,
        modelName: typeof body.LLM_MODEL_ID === "string" ? body.LLM_MODEL_ID : void 0
      },
      rootDir
    );
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: result.ok ? "\u6A21\u578B\u8FDE\u901A\u6027\u6D4B\u8BD5\u901A\u8FC7" : "\u6A21\u578B\u8FDE\u901A\u6027\u6D4B\u8BD5\u5931\u8D25",
      content: result.message || (result.ok ? "Provider reachable." : "Provider unavailable."),
      metadata: {
        source: "api_provider_test",
        ok: result.ok,
        baseUrl: result.baseUrl,
        modelName: result.modelName
      }
    });
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "provider-test",
      status: result.ok ? "completed" : "failed",
      input: {
        baseUrl: result.baseUrl,
        modelName: result.modelName,
        hasApiKey: Boolean(typeof body.LLM_API_KEY === "string" ? body.LLM_API_KEY : void 0)
      },
      output: {
        ok: result.ok,
        message: result.message
      },
      content: result.message || (result.ok ? "Provider reachable." : "Provider unavailable."),
      metadata: {
        source: "api_provider_test",
        ok: result.ok,
        baseUrl: result.baseUrl,
        modelName: result.modelName
      }
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.mode === "managed" ? context.projectId : null,
        projects: context.projects,
        result,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/env") {
    return {
      status: 200,
      payload: {
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/env") {
    const updates = Object.fromEntries(
      Object.entries(body).filter(
        (entry) => typeof entry[1] === "string" && entry[1].trim().length > 0
      )
    );
    if (Object.keys(updates).length > 0) {
      upsertProjectEnvValues(rootDir, updates);
    }
    return {
      status: 200,
      payload: {
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/interrupt") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const message = String(body.message || "").trim();
    if (!message) {
      return { status: 400, payload: { error: "message_required" } };
    }
    const { state } = await executeManualInterruptCommand(context.projectRoot, message, {
      factoryRootDir: rootDir,
      projectId: context.projectId,
      source: "api",
      requestedBy: "api:/api/interrupt"
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/chat") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const message = String(body.message || "").trim();
    if (!message) {
      return { status: 400, payload: { error: "message_required" } };
    }
    const runId = makeRunId("discussion");
    await recordUserMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: runId,
      runId,
      content: message,
      metadata: { source: "api_chat" }
    });
    const discussion = await runMultiAgentDiscussion(context.projectRoot, message, {
      runId,
      envRootDir: rootDir,
      factoryRootDir: context.mode === "managed" ? rootDir : void 0,
      projectId: context.mode === "managed" ? context.projectId ?? void 0 : void 0
    });
    const state = await loadAutonomousState(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        discussion,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/chat-stream") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const message = String(body.message || "").trim();
    if (!message) {
      return { status: 400, payload: { error: "message_required" } };
    }
    const state = await loadAutonomousState(context.projectRoot);
    const route = routeUserMessage(message, state);
    const runId = makeRunId("discussion");
    await recordUserMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: runId,
      runId,
      content: message,
      metadata: { source: "api_chat_stream", route: route.type, reason: route.reason }
    });
    if (route.type === "status_query") {
      const statusText = formatStatus(state);
      await recordStatusMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: runId,
        runId,
        title: "\u5F53\u524D\u9879\u76EE\u72B6\u6001",
        content: statusText,
        metadata: { source: "api_chat_stream_status_query" }
      });
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          events: [],
          discussion: {
            summary: `\u5DF2\u62A5\u544A\u5F53\u524D\u9879\u76EE\u72B6\u6001\uFF1A${state.runtime.statusMessage}`,
            target: "status",
            writebackSkipped: true,
            replies: []
          },
          ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const streamed = [];
    const discussion = await runMultiAgentDiscussion(context.projectRoot, message, {
      runId,
      envRootDir: rootDir,
      factoryRootDir: context.mode === "managed" ? rootDir : void 0,
      projectId: context.mode === "managed" ? context.projectId ?? void 0 : void 0,
      onStreamEvent: async (event) => {
        await options.onAgentStreamEvent?.(event);
      },
      onEvent: async (event) => {
        streamed.push(event);
        await options.onStreamEvent?.(event);
      }
    });
    const updatedState = await loadAutonomousState(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        events: streamed,
        discussion,
        ...await createWorkspacePayload(context.projectRoot, updatedState, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && (requestPathname === "/api/mode" || requestPathname === "/api/autopilot/mode")) {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const autoMode = typeof body.autoMode === "string" ? body.autoMode : "full";
    if (autoMode !== "full" && autoMode !== "semi") {
      return { status: 400, payload: { error: "invalid_auto_mode" } };
    }
    const state = await loadAutonomousState(context.projectRoot);
    state.project.autoMode = autoMode;
    await saveAutonomousState(context.projectRoot, state);
    if (context.projectId) {
      await withFactoryDb(rootDir, async (db) => {
        db.updateProjectState(context.projectId, state);
      }).catch(() => void 0);
    }
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "\u65E0\u4EBA\u503C\u5B88\u521B\u4F5C\u6A21\u5F0F\u5DF2\u5207\u6362",
      content: `\u7CFB\u7EDF\u521B\u4F5C\u6A21\u5F0F\u5DF2\u6210\u529F\u5207\u6362\u4E3A\uFF1A${autoMode === "semi" ? "\u{1F91D} \u534A\u81EA\u52A8\u5171\u521B\u6A21\u5F0F" : "\u{1F916} \u5168\u81EA\u52A8\u6258\u7BA1\u6A21\u5F0F"}\u3002`,
      metadata: {
        source: "api_autopilot_mode",
        autoMode
      }
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && (requestPathname === "/api/stop" || requestPathname === "/api/autopilot/stop")) {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const stoppedInProcess = stopAutopilotJob(context.projectRoot);
    const stopStatusMessage = stoppedInProcess ? "\u5DF2\u6536\u5230\u6682\u505C\u8BF7\u6C42\uFF0C\u6B63\u5728\u4E2D\u65AD\u5F53\u524D\u6A21\u578B\u8BF7\u6C42\u5E76\u4FDD\u5B58\u8FDB\u5EA6\u3002" : "\u5DF2\u6536\u5230\u6682\u505C\u8BF7\u6C42\uFF0C\u5DF2\u6682\u505C\u6570\u636E\u5E93\u4E2D\u7684\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\uFF0C\u540E\u7EED\u53EF\u7EE7\u7EED\u6062\u590D\u3002";
    const state = await markAutopilot(context.projectRoot, {
      running: isAutopilotRunning(context.projectRoot) && !stoppedInProcess,
      stopRequested: true,
      lastStep: "stop_requested",
      statusMessage: stopStatusMessage
    }, { factoryRootDir: rootDir, projectId: context.projectId });
    if (context.projectId) {
      await withFactoryDb(rootDir, async (db) => {
        const jobs = db.listProjectJobs(context.projectId, "autopilot").filter((job) => job.status === "running" || job.status === "paused");
        for (const job of jobs) {
          db.pauseJob(String(job.id));
        }
        return jobs.length;
      }).catch(() => void 0);
    }
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "\u65E0\u4EBA\u503C\u5B88\u6682\u505C\u8BF7\u6C42\u5DF2\u63A5\u6536",
      content: stopStatusMessage,
      metadata: {
        source: "api_autopilot_stop",
        stoppedInProcess
      }
    });
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "autopilot-stop",
      status: "completed",
      input: {
        projectId: context.projectId
      },
      output: {
        stoppedInProcess,
        pausedDurableJobs: Boolean(context.projectId)
      },
      content: stopStatusMessage,
      metadata: {
        source: "api_autopilot_stop",
        stoppedInProcess
      }
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/autopilot/start") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    let message = typeof body.message === "string" ? body.message.trim() : "";
    const latestState = await tryLoadState(context.projectRoot);
    if (!message && latestState) {
      message = createAutopilotKickoffMessage(latestState);
    }
    let jobId = null;
    if (context.projectId) {
      jobId = await ensureDurableAutopilotJob(rootDir, context.projectId, message, { source: "autopilot_start" });
    }
    const submittedAt = await appendAutopilotSubmissionTranscript(context.projectRoot, {
      message,
      jobId,
      stage: latestState?.runtime?.stage
    });
    if (context.projectId && message.trim()) {
      await recordUserMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        content: message,
        time: submittedAt || void 0,
        metadata: { source: "autopilot_start", jobId }
      });
      await recordStatusMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        title: "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5DF2\u63A5\u6536",
        content: `\u5DF2\u63A5\u6536\u65E0\u4EBA\u503C\u5B88\u521B\u4F5C\u6307\u4EE4\uFF0C\u5E76\u5199\u5165\u540E\u53F0\u4EFB\u52A1\u961F\u5217\u3002${jobId ? ` Job: ${jobId}.` : ""}`,
        time: submittedAt || void 0,
        metadata: { source: "autopilot_start", jobId }
      });
      await recordToolMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        toolName: "autopilot-start",
        status: jobId ? "completed" : "failed",
        input: {
          message,
          mode: "background"
        },
        output: {
          jobId,
          queued: Boolean(jobId)
        },
        content: jobId ? `\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1 ${jobId} \u5DF2\u5199\u5165\u6570\u636E\u5E93\uFF0C\u7B49\u5F85 worker \u9886\u53D6\u6216\u7EED\u8DD1\u3002` : "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5199\u5165\u6570\u636E\u5E93\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u9879\u76EE\u72B6\u6001\u3002",
        time: submittedAt || void 0,
        metadata: { source: "autopilot_start", jobId }
      });
      await withFactoryDb(rootDir, async (db) => {
        db.recordArtifact({
          projectId: context.projectId,
          kind: "transcript",
          path: ".ai-novel/chat/discussion-log.md",
          status: "completed",
          metadata: { jobId, source: "autopilot_submission", submittedAt }
        });
        db.recordEvent(context.projectId, null, "AUTOPILOT_MESSAGE_SUBMITTED", {
          message,
          jobId,
          submittedAt
        });
      }).catch(() => void 0);
    }
    if (shouldUseEmbeddedWorker(options.embeddedWorker) && process.env.AI_NOVEL_TEST_MODE !== "1") {
      if (jobId && !isAutopilotRunning(context.projectRoot)) {
        await withFactoryDb(rootDir, async (db) => {
          db.releaseJobLease(jobId, "embedded_worker_start_takeover");
        }).catch(() => void 0);
      }
      ensureAutopilotJob({
        rootDir,
        projectRoot: context.projectRoot,
        projectId: context.projectId,
        projects: context.projects,
        initialMessage: message,
        mode: "background",
        jobId,
        createSnapshot: createWorkspacePayload
      });
    }
    const state = await markAutopilot(context.projectRoot, {
      running: true,
      stopRequested: false,
      mode: "background",
      target: message.trim() || null,
      statusMessage: shouldUseEmbeddedWorker(options.embeddedWorker) ? "\u65E0\u4EBA\u503C\u5B88\u81EA\u52A8\u521B\u4F5C\u5DF2\u5728\u540E\u53F0\u542F\u52A8\u3002\u5173\u95ED\u9875\u9762\u540E\uFF0C\u672C\u5730\u670D\u52A1\u4ECD\u4F1A\u7EE7\u7EED\u8FD0\u884C\u3002" : "\u65E0\u4EBA\u503C\u5B88\u81EA\u52A8\u521B\u4F5C\u4EFB\u52A1\u5DF2\u5199\u5165\u6570\u636E\u5E93\uFF0C\u72EC\u7ACB worker \u4F1A\u9886\u53D6\u5E76\u6301\u7EED\u6267\u884C\u3002"
    }, { factoryRootDir: rootDir, projectId: context.projectId });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  return { status: 404, payload: { error: "not_found" } };
}
function resolveStaticFile(staticDir, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  return path.join(staticDir, relative);
}
async function serveStatic(staticDir, pathname, response) {
  const filePath = resolveStaticFile(staticDir, pathname);
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : ext === ".js" || ext === ".mjs" ? "application/javascript; charset=utf-8" : ext === ".json" ? "application/json; charset=utf-8" : "application/octet-stream";
    response.writeHead(200, { "content-type": contentType });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}
async function startNovelStudioServer(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  await loadActiveLlmConfig(rootDir);
  const staticDir = options.staticDir;
  const embeddedWorker = shouldUseEmbeddedWorker(options.embeddedWorker);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = url.pathname;
      const queryProjectId = url.searchParams.get("projectId");
      if (request.method === "POST" && pathname === "/api/chat-stream") {
        const body = await readJsonBody(request);
        eventStreamHeaders(response);
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/chat-stream", body, {
          projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId,
          onAgentStreamEvent: async (event) => {
            response.write(`event: ${event.type}
`);
            response.write(`data: ${JSON.stringify(event)}

`);
          }
        });
        response.write(`event: complete
`);
        response.write(`data: ${JSON.stringify(result.payload)}

`);
        response.end();
        return;
      }
      if (request.method === "POST" && pathname === "/api/autopilot-stream") {
        const body = await readJsonBody(request);
        const context = await resolveProjectContext(rootDir, typeof body.projectId === "string" ? body.projectId : queryProjectId);
        eventStreamHeaders(response);
        if (!context.projectRoot) {
          writeSse(response, "error", { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) });
          response.end();
          return;
        }
        const job = embeddedWorker ? getAutopilotJob(context.projectRoot) : null;
        const listener = job ? (event) => {
          if (response.writableEnded) return;
          writeSse(response, event.type, event.payload);
          if (event.type === "complete" || event.type === "error") {
            response.end();
          }
        } : null;
        if (job && listener) {
          job.listeners.add(listener);
        }
        let lastStreamSnapshotVersion = "";
        const writeSnapshot = async (options2 = {}) => {
          if (response.writableEnded) return;
          const state = await tryLoadState(context.projectRoot);
          const snapshotPayload = {
            activeProjectId: context.projectId,
            projects: context.projects,
            ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId }),
            envStatus: getPublicProjectEnvStatus2(rootDir)
          };
          const snapshotVersion = typeof snapshotPayload.snapshotVersion === "string" ? snapshotPayload.snapshotVersion : "";
          if (!options2.force && snapshotVersion && snapshotVersion === lastStreamSnapshotVersion) {
            response.write(`: snapshot unchanged ${(/* @__PURE__ */ new Date()).toISOString()}

`);
            return;
          }
          lastStreamSnapshotVersion = snapshotVersion;
          writeSse(response, "snapshot", snapshotPayload);
        };
        const snapshotTimer = setInterval(() => {
          void writeSnapshot().catch((error) => {
            if (!response.writableEnded) {
              writeSse(response, "error", { error: error instanceof Error ? error.message : String(error) });
            }
          });
        }, 2e3);
        request.on("close", () => {
          clearInterval(snapshotTimer);
          if (job && listener) {
            job.listeners.delete(listener);
          }
        });
        writeSse(response, "autopilot_status", {
          message: embeddedWorker ? "\u5DF2\u8FDE\u63A5\u672C\u8FDB\u7A0B\u5185\u5D4C\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u76D1\u542C\u3002" : "\u5DF2\u8FDE\u63A5\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u72B6\u6001\u76D1\u542C\uFF1B\u6267\u884C\u7531\u72EC\u7ACB worker \u6309\u6570\u636E\u5E93\u4EFB\u52A1\u6062\u590D\u3002",
          projectId: context.projectId,
          hasEmbeddedJob: Boolean(job)
        });
        await writeSnapshot({ force: true });
        return;
      }
      if (isJsonApiRequest(request.method, pathname)) {
        await forwardJsonApiRequest(rootDir, request, response, url, { embeddedWorker });
        return;
      }
      if (staticDir && request.method === "GET") {
        const served = await serveStatic(staticDir, pathname, response);
        if (served) {
          return;
        }
      }
      json(response, 404, { error: "not_found" });
    } catch (error) {
      writeServerErrorResponse(response, error);
    }
  });
  await new Promise((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => resolve());
  });
  const restoreTimer = embeddedWorker ? scheduleAutopilotRestore(rootDir, createWorkspacePayload) : null;
  if (embeddedWorker) {
    await restoreAutopilotJobs(rootDir, createWorkspacePayload);
  }
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 0;
  return {
    server,
    port,
    close: () => new Promise((resolve, reject) => {
      if (restoreTimer) {
        clearInterval(restoreTimer);
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    })
  };
}
async function runNovelStudioServerCli(args = process.argv.slice(2)) {
  const flags = /* @__PURE__ */ new Map();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, "true");
      continue;
    }
    flags.set(key, next);
    index += 1;
  }
  const rootDir = flags.get("root-dir") || process.cwd();
  const staticDir = flags.get("static-dir");
  const port = flags.get("port") ? Number.parseInt(flags.get("port") || "4310", 10) : 4310;
  const embeddedWorker = flags.get("embedded-worker") === "true";
  const { port: actualPort } = await startNovelStudioServer({
    rootDir,
    staticDir,
    port,
    embeddedWorker
  });
  console.log(`AI Novel Studio server listening on http://127.0.0.1:${actualPort}`);
}
export {
  handleNovelStudioApi,
  runNovelStudioServerCli,
  startNovelStudioServer,
  writeServerErrorResponse
};
