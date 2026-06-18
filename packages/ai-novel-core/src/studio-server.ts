import fs from "node:fs/promises"
import path from "node:path"
import http from "node:http"
import { createHash } from "node:crypto"

import {
  ensureAutopilotJob,
  getAutopilotJob,
  isAutopilotRunning,
  markAutopilot,
  restoreAutopilotJobs,
  scheduleAutopilotRestore,
  stopAutopilotJob,
  type AutopilotEvent,
} from "./autopilot-worker"
import {
  executeManualAdvanceCommand,
  executeManualInterruptCommand,
  executeManualRetryChapterCommand,
} from "./director-commands"
import { buildSuperGraphIndex, superGraphFromDbRows, validateSuperGraph } from "./super-graph"
import { createStatusMessage, createToolMessage, createUserMessage, type MessagePart, type MessageStatus } from "./messages"
import {
  advanceAutonomousProject,
  createManagedAutonomousProject,
  deleteManagedAutonomousProject,
  initAutonomousProject,
  listAutonomousProjects,
  loadAutonomousState,
  makeRunId,
  prepareCoverGeneration,
  resolveManagedProjectRoot,
  runMultiAgentDiscussion,
  saveAutonomousState,
  testProviderConnectivity,
  getPublicProjectEnvStatus as getRawPublicEnvStatus,
  upsertProjectEnvValues,
  withFactoryDb,
} from "./server-core"
import { syncCurrentContextPacketFile } from "./context-packet"
import { evaluateKnowledgeBenchmark, retrieveKnowledge, type KnowledgeBenchmarkCase, type KnowledgeBenchmarkResult } from "./knowledge"
import type { KnowledgeRecallRow, KnowledgeScope } from "./factory-db"
import { formatStatus } from "./orchestrator"
import { routeUserMessage } from "./router"
import { ensureEnvLlmConfigImported, loadActiveLlmConfig, getCachedActiveLlmConfig } from "./llm-config"
import { detectAigcSegments, detectAigcText, getAigcDetectorConfig, type AigcDetectionConfig, type AigcTextSegment } from "./aigc-detector"
import { deriveProjectRuntimeState } from "./project-runtime-state"

function getPublicProjectEnvStatus(rootDir = process.cwd()) {
  const status = getRawPublicEnvStatus(rootDir)
  const activeLlm = getCachedActiveLlmConfig()
  if (activeLlm) {
    status.configured = true
    status.resolved = {
      baseUrl: activeLlm.provider.baseUrl,
      modelName: activeLlm.provider.modelName,
      apiKeyPresent: true,
    }
    status.missing = status.missing.filter(
      (k: string) => k !== "LLM_API_KEY" && k !== "LLM_BASE_URL" && k !== "LLM_MODEL_ID"
    )
  }
  return status
}

function redactLlmConfig(config: Record<string, unknown>) {
  return {
    ...config,
    api_key: config.api_key ? "[configured]" : "",
    api_key_configured: Boolean(config.api_key),
  }
}

function redactLlmConfigs(configs: Record<string, unknown>[]) {
  return configs.map((config) => redactLlmConfig(config))
}



import type { ChapterTask } from "./cli-types"

interface ServerOptions {
  rootDir?: string
  port?: number
  staticDir?: string
  embeddedWorker?: boolean
}

interface ApiCallOptions {
  projectId?: string | null
  embeddedWorker?: boolean
  onStreamEvent?: (event: { role: string; content: string }) => void | Promise<void>
  onAgentStreamEvent?: (
    event:
      | { type: "agent_start"; messageId?: string; turnId: string; role: string; timestamp?: string }
      | { type: "agent_delta"; messageId?: string; turnId: string; role: string; delta: string; timestamp?: string }
      | { type: "agent_complete"; messageId?: string; turnId: string; role: string; content: string; timestamp?: string }
      | { type: "agent_error"; messageId?: string; turnId: string; role: string; content: string; error: string; timestamp?: string; phase?: string; statusText?: string; statusDetail?: string },
  ) => void | Promise<void>
}

function json(response: http.ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(payload))
}

export function writeServerErrorResponse(
  response: Pick<http.ServerResponse, "headersSent" | "writableEnded" | "writeHead" | "write" | "end">,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error)

  if (response.headersSent) {
    if (!response.writableEnded) {
      response.write(`event: error\n`)
      response.write(`data: ${JSON.stringify({ error: message })}\n\n`)
      response.end()
    }
    return
  }

  json(response as http.ServerResponse, 500, { error: message })
}

function eventStreamHeaders(response: http.ServerResponse) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  })
}

function writeSse(response: http.ServerResponse, eventName: string, data: unknown) {
  if (response.writableEnded || response.destroyed || !response.writable) {
    return
  }
  try {
    response.write(`event: ${eventName}\n`)
    response.write(`data: ${JSON.stringify(data)}\n\n`)
  } catch {}
}

function pct(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`
}

function formatKnowledgeEvaluationReport(evaluation: KnowledgeBenchmarkResult) {
  const lines = [
    "# Knowledge Retrieval Evaluation",
    "",
    `- Total Cases: ${evaluation.summary.totalCases}`,
    `- Hit@K: ${pct(evaluation.summary.hitRateAtK)}`,
    `- Mean Recall@K: ${pct(evaluation.summary.meanRecallAtK)}`,
    `- Mean Precision@K: ${pct(evaluation.summary.meanPrecisionAtK)}`,
    "",
    "## Cases",
    "",
  ]
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
      "",
    )
  }
  return `${lines.join("\n").trim()}\n`
}

function shouldUseEmbeddedWorker(value?: boolean) {
  return value ?? (process.env.AI_NOVEL_EMBEDDED_WORKER === "1")
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim()
  if (!raw) {
    return {}
  }

  return JSON.parse(raw) as Record<string, unknown>
}

function readJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value !== "string" || !value.trim()) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function readKnowledgeScopes(value: unknown): KnowledgeScope[] | undefined {
  const scopes = readStringArray(value).filter((scope): scope is KnowledgeScope =>
    scope === "global" || scope === "project")
  return scopes.length ? scopes : undefined
}

function normalizeKnowledgeSearchRow(row: KnowledgeRecallRow) {
  const source = row.source || {}
  const content = String(row.content || "")
  const sourcePath = String(source.path || row.source_path || "")
  const sourceType = String(source.sourceType || row.source_type || "")
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
      title: String(source.title || row.source_title || sourcePath || "knowledge"),
    },
  }
}

function isJsonApiRequest(method: string | undefined, pathname: string) {
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
      "/api/llm-configs",
    ].includes(pathname)
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
      "/api/llm-configs/activate",
      "/api/aigc-detect",
    ].includes(pathname)
  }

  if (method === "DELETE") {
    return pathname.startsWith("/api/projects/") || pathname === "/api/llm-configs"
  }

  return false
}

async function forwardJsonApiRequest(
  rootDir: string,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  url: URL,
  options: { embeddedWorker?: boolean } = {},
) {
  const method = request.method || "GET"
  const pathname = url.pathname
  const body = method === "POST" || method === "DELETE" ? await readJsonBody(request) : {}
  const projectId = typeof body.projectId === "string" ? body.projectId : url.searchParams.get("projectId")
  const pathWithSearch = url.search ? `${pathname}${url.search}` : pathname
  const result = await handleNovelStudioApi(rootDir, method, pathWithSearch, body, {
    projectId,
    embeddedWorker: options.embeddedWorker,
  })
  json(response, result.status, result.payload)
}

function mergeApiAigcDetectorConfig(base: AigcDetectionConfig, value: unknown): AigcDetectionConfig {
  if (!value || typeof value !== "object") {
    return base
  }
  const input = value as Record<string, unknown>
  const provider = input.provider === "generic-json" || input.provider === "gradio-queue" || input.provider === "disabled"
    ? input.provider
    : base.provider
  return {
    ...base,
    provider,
    url: typeof input.url === "string" ? input.url : base.url,
    token: typeof input.token === "string" ? input.token : base.token,
    timeoutMs: typeof input.timeoutMs === "number" && input.timeoutMs > 0 ? input.timeoutMs : base.timeoutMs,
    threshold: typeof input.threshold === "number" ? input.threshold : base.threshold,
    requestTextField: typeof input.requestTextField === "string" ? input.requestTextField : base.requestTextField,
    segment: {
      ...base.segment,
      ...(typeof input.segment === "object" && input.segment !== null ? input.segment as AigcDetectionConfig["segment"] : {}),
    },
    gradio: {
      ...base.gradio,
      ...(typeof input.gradio === "object" && input.gradio !== null ? input.gradio as AigcDetectionConfig["gradio"] : {}),
    },
  }
}

function readApiAigcSegments(value: unknown[]): AigcTextSegment[] {
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return []
    }
    const segment = item as Record<string, unknown>
    const text = typeof segment.text === "string" ? segment.text : ""
    if (!text.trim()) {
      return []
    }
    const startOffset = typeof segment.startOffset === "number" ? segment.startOffset : 0
    const endOffset = typeof segment.endOffset === "number" ? segment.endOffset : startOffset + text.length
    return [{
      id: typeof segment.id === "string" ? segment.id : `segment-${index + 1}`,
      index: typeof segment.index === "number" ? segment.index : index,
      text,
      startOffset,
      endOffset,
      metadata: typeof segment.metadata === "object" && segment.metadata !== null ? segment.metadata as Record<string, unknown> : undefined,
    }]
  })
}

function serializeState(state: Awaited<ReturnType<typeof loadAutonomousState>>) {
  return {
    project: state.project,
    runtime: state.runtime,
    reactSetup: state.reactSetup,
    plan: state.plan,
    assets: state.assets,
  }
}

async function readDiscussionTranscript(rootDir: string) {
  try {
    return await fs.readFile(path.join(rootDir, ".ai-novel", "chat", "discussion-log.md"), "utf8")
  } catch {
    return ""
  }
}

async function appendAutopilotSubmissionTranscript(
  rootDir: string,
  input: {
    message: string
    jobId?: string | null
    stage?: string
  },
) {
  const message = input.message.trim()
  if (!message) return null
  const chatDir = path.join(rootDir, ".ai-novel", "chat")
  const submittedAt = new Date().toISOString()
  await fs.mkdir(chatDir, { recursive: true })
  await fs.appendFile(
    path.join(chatDir, "discussion-log.md"),
    [
      `## ${submittedAt}`,
      `User: ${message}`,
      `System: 已接收无人值守创作指令，并写入后台任务队列。${input.jobId ? ` Job: ${input.jobId}.` : ""}`,
      `Status: autopilot_submitted`,
      input.stage ? `Stage: ${input.stage}` : "",
      "",
    ].filter(Boolean).join("\n"),
  )
  return submittedAt
}

async function recordUserMessage(rootDir: string, input: {
  projectId?: string | null
  conversationId: string
  runId?: string | null
  content: string
  time?: string
  metadata?: Record<string, unknown>
}) {
  if (!input.projectId || !input.content.trim()) return null
  const message = createUserMessage({
    conversationId: input.conversationId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    content: input.content.trim(),
    time: input.time,
    metadata: input.metadata,
  })
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, userMessageParts(message.messageId, {
    content: message.data.content,
    createdAt: message.time,
    metadata: message.metadata,
  }))).catch(() => undefined)
  return message
}

async function recordStatusMessage(rootDir: string, input: {
  projectId?: string | null
  conversationId: string
  runId?: string | null
  title: string
  content: string
  time?: string
  metadata?: Record<string, unknown>
}) {
  if (!input.projectId) return null
  const message = createStatusMessage({
    conversationId: input.conversationId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    title: input.title,
    content: input.content,
    agentType: "director",
    agentLabel: "System",
    time: input.time,
    metadata: input.metadata,
  })
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, statusMessageParts(message.messageId, {
    title: message.data.title,
    content: message.data.content,
    createdAt: message.time,
    metadata: message.metadata,
  }))).catch(() => undefined)
  return message
}

function messagePart(messageId: string, index: number, type: MessagePart["type"], data: Record<string, unknown>, createdAt: string): MessagePart {
  return {
    id: `${messageId}:part:${index}`,
    messageId,
    index,
    type,
    data,
    createdAt,
  }
}

function userMessageParts(messageId: string, input: {
  content: string
  createdAt: string
  metadata?: Record<string, unknown>
}): MessagePart[] {
  return [
    messagePart(messageId, 0, "text", { text: input.content }, input.createdAt),
    messagePart(messageId, 1, "json", {
      source: input.metadata?.source || "user",
      metadata: input.metadata || {},
    }, input.createdAt),
  ]
}

function statusMessageParts(messageId: string, input: {
  title: string
  content: string
  createdAt: string
  metadata?: Record<string, unknown>
}): MessagePart[] {
  const text = [input.title ? `### ${input.title}` : "", input.content].filter(Boolean).join("\n\n")
  return [
    messagePart(messageId, 0, "markdown", { text }, input.createdAt),
    messagePart(messageId, 1, "json", {
      source: input.metadata?.source || "status",
      title: input.title,
      metadata: input.metadata || {},
    }, input.createdAt),
  ]
}

function toolMessageParts(messageId: string, input: {
  toolName: string
  status: MessageStatus
  toolInput?: unknown
  output?: unknown
  error?: unknown
  content?: string
  createdAt: string
}): MessagePart[] {
  const parts: MessagePart[] = [
    messagePart(messageId, 0, "markdown", { text: input.content || `${input.toolName}: ${input.status}` }, input.createdAt),
    messagePart(messageId, 1, "tool_call", {
      toolName: input.toolName,
      input: input.toolInput ?? null,
    }, input.createdAt),
  ]
  parts.push(messagePart(messageId, 2, input.error ? "tool_result" : "tool_result", {
    status: input.status,
    output: input.output ?? null,
    error: input.error ?? null,
  }, input.createdAt))
  return parts
}

async function recordToolMessage(rootDir: string, input: {
  projectId?: string | null
  conversationId: string
  runId?: string | null
  toolName: string
  status?: MessageStatus
  input?: unknown
  output?: unknown
  error?: unknown
  content?: string
  time?: string
  metadata?: Record<string, unknown>
}) {
  if (!input.projectId) return null
  const status = input.status || "completed"
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
    metadata: input.metadata,
  })
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, toolMessageParts(message.messageId, {
    toolName: input.toolName,
    status,
    toolInput: input.input,
    output: input.output,
    error: input.error,
    content: input.content,
    createdAt: message.createdAt,
  }))).catch(() => undefined)
  return message
}

async function writeKnowledgeEvaluationArtifact(rootDir: string, projectRoot: string, projectId: string, evaluation: KnowledgeBenchmarkResult) {
  const relativePath = ".ai-novel/knowledge/evaluation-latest.md"
  const absolutePath = path.join(projectRoot, relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, formatKnowledgeEvaluationReport(evaluation), "utf8")
  await withFactoryDb(rootDir, async (db) => {
    db.recordArtifact({
      projectId,
      kind: "checkpoint",
      path: relativePath,
      status: "completed",
      metadata: {
        source: "knowledge-evaluate",
        summary: evaluation.summary,
      },
    })
  })
  return relativePath
}

function parseTranscriptTimestamp(value = "") {
  const firstLine = String(value || "").split("\n")[0]?.trim() || ""
  const parsed = Date.parse(firstLine)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : ""
}

function parseTranscriptEntries(transcript = "", { limit = 80 } = {}) {
  const rolePattern = /^(User|System|Showrunner|World Architect|Author|Editor|Reviewer|Prose Stylist):\s*(.*)$/
  const blocks = transcript
    .split(/^##\s+/m)
    .map((block) => block.trim())
    .filter(Boolean)
  const entries: Array<{ key: string; role: string; content: string }> = []

  blocks.forEach((block, blockIndex) => {
    const timestamp = parseTranscriptTimestamp(block)
    let current: { key: string; role: string; content: string; timestamp?: string } | null = null
    for (const line of block.split("\n").slice(timestamp ? 1 : 0)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const match = trimmed.match(rolePattern)
      if (match) {
        if (current) entries.push(current)
        current = {
          key: `transcript-${blockIndex}-${entries.length}`,
          role: match[1],
          content: match[2].trim(),
          ...(timestamp ? { timestamp } : {}),
        }
        continue
      }
      if (current) {
        current.content = [current.content, trimmed].filter(Boolean).join("\n")
      }
    }
    if (current) entries.push(current)
  })

  const recentEntries = entries.slice(-limit)
  return {
    entries: recentEntries.map((entry, index) => ({ ...entry, key: `history-${entries.length - recentEntries.length + index}` })),
    meta: {
      totalEntries: entries.length,
      returnedEntries: recentEntries.length,
      truncated: entries.length > recentEntries.length,
      transcriptBytes: Buffer.byteLength(transcript),
    },
  }
}

function messageRowsToEntries(rows: Array<Record<string, unknown>> = [], { limit = 80, transcriptBytes = 0 } = {}) {
  const normalizeParts = (parts: unknown) => Array.isArray(parts)
    ? parts
      .filter((part): part is Record<string, unknown> => Boolean(part) && typeof part === "object")
      .map((part, index) => ({
        id: String(part.id || `${part.messageId || part.message_id || "message"}:part:${index}`),
        messageId: String(part.messageId || part.message_id || ""),
        index: Number.isFinite(Number(part.index ?? part.part_index)) ? Number(part.index ?? part.part_index) : index,
        type: String(part.type || "text"),
        data: part.data && typeof part.data === "object" ? part.data : {},
        createdAt: String(part.createdAt || part.created_at || ""),
      }))
      .sort((left, right) => left.index - right.index)
    : []
  const artifactPathFromParts = (parts: ReturnType<typeof normalizeParts>) => {
    const artifactPart = parts.find((part) => part.type === "artifact" && part.data && typeof part.data === "object")
    const artifactData = artifactPart?.data as Record<string, unknown> | undefined
    const path = artifactData?.path || artifactData?.artifactPath || artifactData?.url || ""
    return typeof path === "string" ? path : ""
  }
  const selectedRows = rows.slice(0, limit).reverse()
  const entries = selectedRows.map((row, index) => {
    const data = row.data && typeof row.data === "object" ? row.data as Record<string, unknown> : {}
    const parts = normalizeParts(row.parts)
    const type = String(row.type || "agent")
    const isUser = type === "user"
    const role = isUser
      ? "User"
      : String(data.agentLabel || data.agentType || "Agent")
    const content = type === "status"
      ? [data.title ? `### ${String(data.title)}` : "", data.content ? String(data.content) : ""].filter(Boolean).join("\n\n")
      : String(data.content || data.caption || data.alt || data.path || data.url || "")
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
      artifactPath: typeof data.artifactPath === "string" ? data.artifactPath : artifactPathFromParts(parts),
    }
  })

  return {
    entries,
    meta: {
      totalEntries: rows.length,
      returnedEntries: entries.length,
      truncated: rows.length > entries.length,
      transcriptBytes,
      source: "messages",
    },
  }
}

function discussionEntriesFromSnapshot(factorySnapshot: Record<string, unknown> | null, { limit = 80 } = {}) {
  const recentMessages = Array.isArray(factorySnapshot?.recentMessages)
    ? factorySnapshot.recentMessages as Array<Record<string, unknown>>
    : []
  if (recentMessages.length === 0) {
    return null
  }
  return messageRowsToEntries(recentMessages, { limit })
}

async function readWorkspaceText(rootDir: string, ...parts: string[]) {
  try {
    return await fs.readFile(path.join(rootDir, ".ai-novel", ...parts), "utf8")
  } catch {
    return ""
  }
}

async function syncCurrentContextPacketState(
  projectRoot: string,
  state: Awaited<ReturnType<typeof loadAutonomousState>> | null,
) {
  if (!state) return
  await syncCurrentContextPacketFile(projectRoot, state)
}

async function readWorkspaceArtifactText(rootDir: string, artifactPath: string) {
  const normalized = artifactPath.replaceAll("\\", "/").replace(/^\/+/, "")
  if (!normalized.startsWith(".ai-novel/") || normalized.includes("..")) {
    return null
  }

  try {
    return await fs.readFile(path.join(rootDir, normalized), "utf8")
  } catch {
    return ""
  }
}

function compactStateForPayload(
  state: Awaited<ReturnType<typeof loadAutonomousState>> | null,
  options: { chapterPage?: number; chapterPageSize?: number } = {},
) {
  if (!state) return null
  const tasks = state.plan.chapterTasks
  const pageSize = Math.max(1, Math.min(100, Number.isFinite(Number(options.chapterPageSize)) ? Number(options.chapterPageSize) : 20))
  const pageCount = Math.max(1, Math.ceil(tasks.length / pageSize))
  const firstActiveIndex = tasks.findIndex((task) => task.status !== "complete")
  const defaultPage = firstActiveIndex >= 0 ? Math.floor(firstActiveIndex / pageSize) + 1 : pageCount
  const page = Math.max(1, Math.min(pageCount, Number.isFinite(Number(options.chapterPage)) ? Number(options.chapterPage) : defaultPage))
  const startIndex = (page - 1) * pageSize
  const visibleTasks = tasks.slice(startIndex, startIndex + pageSize)
  const windowStart = visibleTasks.length > 0 ? Number(visibleTasks[0]?.chapterNumber || firstActiveIndex + 1 || 1) : 0
  const windowEnd = visibleTasks.length > 0 ? Number(visibleTasks[visibleTasks.length - 1]?.chapterNumber || windowStart) : 0
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
        pageCount,
      },
    },
  }
}

function stateWithChapterFactsForPayload(
  state: Awaited<ReturnType<typeof loadAutonomousState>> | null,
  factorySnapshot: Record<string, unknown> | null,
) {
  if (!state || !Array.isArray(factorySnapshot?.chapterFacts)) {
    return state
  }
  const stageAllowsChapterFactOverlay = state.runtime.stage === "chapter_task_generation"
    || state.runtime.stage === "drafting"
    || state.runtime.stage === "reviewing"
    || state.runtime.stage === "complete"
  if (!stageAllowsChapterFactOverlay) {
    return state
  }

  const factsByChapter = new Map(
    factorySnapshot.chapterFacts.map((fact) => [Number((fact as Record<string, unknown>).chapterNumber), fact as Record<string, unknown>]),
  )
  const normalizeTaskStatus = (value: unknown) =>
    value === "pending" || value === "in_progress" || value === "complete" || value === "blocked"
      ? value
      : null
  const normalizeGateStatus = (value: unknown) =>
    value === "passed" || value === "needs_revision" || value === "blocked"
      ? value
      : null
  const timestampMs = (value: unknown) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return 0
    }
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const nextState = serializeState(state)
  nextState.plan.chapterTasks = state.plan.chapterTasks.map((task) => {
    const fact = factsByChapter.get(Number(task.chapterNumber))
    if (!fact) return task
    const qualityGate = fact.qualityGate && typeof fact.qualityGate === "object"
      ? fact.qualityGate as Record<string, unknown>
      : null
    const factStatus = normalizeTaskStatus(fact.status)
    const gateStatus = normalizeGateStatus(qualityGate?.status)
    const latestTaskStatusAt = timestampMs(fact.latestTaskStatusAt)
    const qualityGateUpdatedAt = timestampMs(
      typeof qualityGate?.updatedAt === "string"
        ? qualityGate.updatedAt
        : typeof fact.updatedAt === "string"
          ? fact.updatedAt
          : "",
    )
    const recoveryStatusIsCurrent = latestTaskStatusAt > 0
      && latestTaskStatusAt > qualityGateUpdatedAt
      && (fact.latestTaskStatus === "pending" || fact.latestTaskStatus === "in_progress")
    return {
      ...task,
      status: recoveryStatusIsCurrent
        ? (fact.latestTaskStatus as ChapterTask["status"])
        : factStatus || task.status,
      recoveryQueuedAt: typeof fact.recoveryQueuedAt === "string" && recoveryStatusIsCurrent
        ? fact.recoveryQueuedAt
        : task.recoveryQueuedAt,
      contentQuality: fact.contentQuality && typeof fact.contentQuality === "object"
        ? fact.contentQuality as ChapterTask["contentQuality"]
        : task.contentQuality,
      qualityGate: qualityGate && gateStatus
        ? {
          ...task.qualityGate,
          status: gateStatus,
          score: Number(qualityGate.score || 0),
          attempts: Number(qualityGate.attempts || 0),
          reason: String(qualityGate.reason || ""),
          wordCount: Number.isFinite(Number(qualityGate.wordCount)) ? Number(qualityGate.wordCount) : undefined,
          targetWords: Number.isFinite(Number(qualityGate.targetWords)) ? Number(qualityGate.targetWords) : undefined,
          updatedAt: String(qualityGate.updatedAt || fact.updatedAt || fact.latestEventAt || new Date().toISOString()),
        }
        : task.qualityGate,
    }
  })
  nextState.plan.pendingChapters = nextState.plan.chapterTasks.filter((task) => task.status === "pending").length
  const hasInProgress = nextState.plan.chapterTasks.some((task) => task.status === "in_progress")
  const hasPending = nextState.plan.chapterTasks.some((task) => task.status === "pending")
  const hasBlocked = nextState.plan.chapterTasks.some((task) => task.status === "blocked")
  if (hasBlocked) {
    nextState.runtime.stage = "reviewing"
  } else if (hasInProgress || hasPending) {
    nextState.runtime.stage = "drafting"
  } else if (nextState.plan.chapterTasks.length > 0) {
    nextState.runtime.stage = "complete"
  }
  return nextState
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function createSnapshotVersion(payload: unknown) {
  return createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 24)
}

function stripVolatileRowFields(row: Record<string, unknown>) {
  const {
    id,
    created_at,
    updated_at,
    lease_expires_at,
    payload_json,
    metadata_json,
    ...rest
  } = row
  return {
    ...rest,
    ...(typeof payload_json === "string" ? { payload_json } : {}),
    ...(typeof metadata_json === "string" ? { metadata_json } : {}),
  }
}

function semanticFactorySnapshotForVersion(factorySnapshot: Record<string, unknown> | null) {
  if (!factorySnapshot) return null
  const eventRows = Array.isArray(factorySnapshot.latestEvents)
    ? factorySnapshot.latestEvents as Array<Record<string, unknown>>
    : []
  const semanticEvents = eventRows
    .filter((row) => row.type !== "JOB_HEARTBEAT")
    .slice(0, 16)
    .map(stripVolatileRowFields)
  const jobRows = (rows: unknown) => Array.isArray(rows)
    ? (rows as Array<Record<string, unknown>>).map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      leased: Boolean(row.lease_owner),
    }))
    : []
  const messageRows = (rows: unknown) => Array.isArray(rows)
    ? (rows as Array<Record<string, unknown>>).slice(0, 24).map((row) => ({
      id: row.id,
      conversation_id: row.conversation_id,
      type: row.type,
      status: row.status,
      time: row.time,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
      data_json: row.data_json,
      metadata_json: row.metadata_json,
    }))
    : []

  return {
    project: factorySnapshot.project,
    state: factorySnapshot.state,
    projectRuntime: factorySnapshot.projectRuntime,
    artifactSummary: factorySnapshot.artifactSummary,
    productionObservability: factorySnapshot.productionObservability,
    chapterFacts: factorySnapshot.chapterFacts,
    activeJobs: jobRows(factorySnapshot.activeJobs),
    runnableJobs: jobRows(factorySnapshot.runnableJobs),
    latestRuns: Array.isArray(factorySnapshot.latestRuns)
      ? (factorySnapshot.latestRuns as Array<Record<string, unknown>>).slice(0, 8).map(stripVolatileRowFields)
      : [],
    latestEvents: semanticEvents,
    artifacts: Array.isArray(factorySnapshot.artifacts)
      ? (factorySnapshot.artifacts as Array<Record<string, unknown>>).map((row) => ({
        kind: row.kind,
        path: row.path,
        status: row.status,
        version: row.version,
        metadata_json: row.metadata_json,
      }))
      : [],
    messageCount: Array.isArray(factorySnapshot.recentMessages)
      ? factorySnapshot.recentMessages.length
      : 0,
    recentMessages: messageRows(factorySnapshot.recentMessages),
    recentMemory: Array.isArray(factorySnapshot.recentMemory)
      ? (factorySnapshot.recentMemory as Array<Record<string, unknown>>).map((row) => ({
        id: row.id,
        source: row.source,
        kind: row.kind,
        content: row.content,
        embedding_status: row.embedding_status,
      }))
      : [],
    checkpoints: Array.isArray(factorySnapshot.checkpoints)
      ? (factorySnapshot.checkpoints as Array<Record<string, unknown>>).map(stripVolatileRowFields)
      : [],
    graphNodes: Array.isArray(factorySnapshot.graphNodes)
      ? (factorySnapshot.graphNodes as Array<Record<string, unknown>>).map(stripVolatileRowFields)
      : [],
    graphEdges: Array.isArray(factorySnapshot.graphEdges)
      ? (factorySnapshot.graphEdges as Array<Record<string, unknown>>).map(stripVolatileRowFields)
      : [],
  }
}

function truncateText(value: unknown, maxLength: number) {
  if (typeof value !== "string" || value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}...`
}

function compactSnapshotRow(row: Record<string, unknown>, limits: { payload?: number; metadata?: number; content?: number } = {}) {
  const compacted = { ...row }
  if (typeof compacted.payload_json === "string") {
    compacted.payload_json = truncateText(compacted.payload_json, limits.payload ?? 700)
  }
  if (typeof compacted.metadata_json === "string") {
    compacted.metadata_json = truncateText(compacted.metadata_json, limits.metadata ?? 700)
  }
  if (typeof compacted.content === "string") {
    compacted.content = truncateText(compacted.content, limits.content ?? 260)
  }
  return compacted
}

function compactFactorySnapshotForPayload(factorySnapshot: Record<string, unknown> | null) {
  if (!factorySnapshot) return factorySnapshot
  const snapshot = factorySnapshot
  const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts as Array<Record<string, unknown>> : []
  const isPinnedArtifact = (artifact: Record<string, unknown>) => {
    const artifactPath = String(artifact.path || "")
    return artifactPath.includes("global-consensus.md")
      || artifactPath.includes("/consensus/")
      || artifactPath.includes("current-context.md")
      || artifactPath.includes("style/profile.md")
      || artifactPath.includes("memory/characters/dossiers.json")
      || artifactPath.includes("discussion-log.md")
      || artifactPath.includes("setting-freeze.md")
      || artifactPath.includes("master-outline.md")
      || artifactPath.includes("production-resources/")
  }
  const relevantArtifacts = artifacts.filter((artifact) => {
    const artifactPath = String(artifact.path || "")
    return artifactPath.includes("chapter-blueprints/")
      || artifactPath.includes(".final.md")
      || artifactPath.includes("-quality.md")
      || artifactPath.includes("-memory.md")
      || artifactPath.includes("master-outline.md")
      || artifactPath.includes("setting-freeze.md")
      || artifactPath.includes("global-consensus.md")
      || artifactPath.includes("/consensus/")
      || artifactPath.includes("current-context.md")
      || artifactPath.includes("style/profile.md")
      || artifactPath.includes("memory/characters/dossiers.json")
      || artifactPath.includes("discussion-log.md")
      || artifactPath.includes("production-resources/")
      || artifact.kind === "transcript"
  })
  const artifactRowsByPath = new Map<string, Record<string, unknown>>()
  for (const row of [...relevantArtifacts.filter(isPinnedArtifact), ...relevantArtifacts]) {
    const key = String(row.path || row.id || "")
    if (key && !artifactRowsByPath.has(key)) {
      artifactRowsByPath.set(key, row)
    }
  }

  return {
    ...snapshot,
    latestRuns: Array.isArray(snapshot.latestRuns) ? snapshot.latestRuns.slice(0, 6).map((row) => compactSnapshotRow(row as Record<string, unknown>)) : [],
    latestEvents: Array.isArray(snapshot.latestEvents) ? snapshot.latestEvents.slice(0, 24).map((row) => compactSnapshotRow(row as Record<string, unknown>)) : [],
    artifacts: [...artifactRowsByPath.values()].slice(0, 80).map((row) => compactSnapshotRow(row)),
    recentMemory: Array.isArray(snapshot.recentMemory)
      ? snapshot.recentMemory.slice(0, 6).map((row) => compactSnapshotRow(row as Record<string, unknown>, { content: 260, metadata: 420 }))
      : [],
    checkpoints: Array.isArray(snapshot.checkpoints) ? snapshot.checkpoints.slice(0, 6).map((row) => compactSnapshotRow(row as Record<string, unknown>)) : [],
    graphNodes: Array.isArray(snapshot.graphNodes) ? snapshot.graphNodes.slice(0, 60).map((row) => compactSnapshotRow(row as Record<string, unknown>, { metadata: 500 })) : [],
    graphEdges: Array.isArray(snapshot.graphEdges) ? snapshot.graphEdges.slice(0, 80).map((row) => compactSnapshotRow(row as Record<string, unknown>, { metadata: 500 })) : [],
  }
}

function parseMetadataRow(row: Record<string, unknown> | null | undefined) {
  if (!row || typeof row !== "object") return null
  const metadata = row.metadata
  if (metadata && typeof metadata === "object") return metadata as Record<string, unknown>
  const metadataJson = row.metadata_json
  if (typeof metadataJson !== "string" || !metadataJson.trim()) return null
  try {
    const parsed = JSON.parse(metadataJson)
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function deriveProductionObservability(
  factorySnapshot: Record<string, unknown> | null,
  resolvedState: Awaited<ReturnType<typeof loadAutonomousState>> | null,
  contextPacket: string,
) {
  const snapshot = factorySnapshot || {}
  const state = (resolvedState || snapshot.state || null) as Awaited<ReturnType<typeof loadAutonomousState>> | null
  const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts as Array<Record<string, unknown>> : []
  const recentMemory = Array.isArray(snapshot.recentMemory) ? snapshot.recentMemory as Array<Record<string, unknown>> : []
  const chapterFacts = Array.isArray(snapshot.chapterFacts) ? snapshot.chapterFacts as Array<Record<string, unknown>> : []
  const creativeProfile = state?.project?.creativeProfile || null
  const artifactPath = (row: Record<string, unknown>) => String(row.path || row.source || "")
  const styleArtifact = artifacts.find((row) => artifactPath(row).includes("style/profile.md")) || null
  const dossierArtifact = artifacts.find((row) => artifactPath(row).includes("memory/characters/dossiers.json")) || null
  const characterMemoryRows = recentMemory.filter((row) => String(row.kind || "") === "character_dossiers")
  const chapterMemoryRows = recentMemory.filter((row) => String(row.kind || "") === "chapter_summary")
  const latestQuality = chapterFacts.find((fact) => fact.qualityGate)
  const latestNaturalness = latestQuality?.qualityGate && typeof latestQuality.qualityGate === "object"
    ? (latestQuality.qualityGate as Record<string, unknown>).reason || ""
    : ""
  const estimatedChars = [
    contextPacket,
    state?.project?.idea || "",
    state?.project?.title || "",
    ...(state?.plan?.chapterTasks || []).slice(0, 20).map((task) => `${task.title} ${task.summary}`),
  ].join("\n").length
  const budgetLimit = 24_000
  const budgetPercent = budgetLimit > 0 ? Math.min(100, Math.round((estimatedChars / budgetLimit) * 100)) : 0
  const contextSections = [
    { key: "contextPacket", label: "Context packet", chars: contextPacket.length },
    { key: "chapterWindow", label: "Chapter window", chars: (state?.plan?.chapterTasks || []).slice(0, 20).map((task) => `${task.title} ${task.summary}`).join("\n").length },
    { key: "creativeProfile", label: "Creative profile", chars: JSON.stringify(creativeProfile || {}).length },
  ]
  const missingStyle = [
    !creativeProfile?.genre ? "genre" : "",
    !creativeProfile?.readerPromise ? "reader promise" : "",
    !creativeProfile?.styleFingerprint || /pending sample|first-chapter extraction/i.test(String(creativeProfile.styleFingerprint)) ? "style fingerprint" : "",
    !creativeProfile?.naturalnessTarget ? "naturalness target" : "",
  ].filter(Boolean)
  const dossierCount = Array.isArray(state?.memory?.characterDossiers) ? state.memory.characterDossiers.length : 0
  const incompleteDossierFields = (state?.memory?.characterDossiers || []).flatMap((dossier) => {
    const missing = [
      !dossier.coreDesire ? "desire" : "",
      !dossier.behaviorHabits?.length ? "habit" : "",
      !dossier.speechMarkers?.length ? "speech" : "",
      !dossier.relationshipState ? "relationship" : "",
    ].filter(Boolean)
    return missing.length ? [`${dossier.canonicalName || dossier.id}: ${missing.join(", ")}`] : []
  }).slice(0, 6)
  const memoryLag = Math.max(0, chapterFacts.filter((fact) => fact.status === "complete").length - chapterMemoryRows.length)

  const now = new Date()
  const activeJobs = Array.isArray(snapshot.activeJobs) ? snapshot.activeJobs as Array<Record<string, unknown>> : []
  const staleJobsList = activeJobs.filter((job) => {
    if (!job.lease_expires_at) return false
    return new Date(String(job.lease_expires_at)) < now
  }).map((job) => ({
    id: String(job.id || ""),
    kind: String(job.kind || ""),
    leaseOwner: String(job.lease_owner || ""),
    leaseExpiresAt: String(job.lease_expires_at || ""),
  }))

  const blockedChaptersList = (state?.plan?.chapterTasks || [])
    .filter((task) => task.status === "blocked")
    .map((task) => {
      const fact = chapterFacts.find((f) => Number(f.chapterNumber) === task.chapterNumber)
      return {
        chapterNumber: task.chapterNumber,
        title: task.title,
        recoveryAttempts: task.recoveryAttempts || 0,
        recoveryBlocked: Boolean(task.recoveryBlocked),
        blockReason: fact?.qualityGate && typeof fact.qualityGate === "object"
          ? (fact.qualityGate as Record<string, unknown>).reason || "未知门禁拦截"
          : "未知门禁拦截",
      }
    })

  const knowledgeObj = (snapshot.knowledge || {}) as Record<string, any>
  const summaryObj = (knowledgeObj.summary || {}) as Record<string, any>

  const diagnostics = {
    blockedChapters: blockedChaptersList,
    latestGateReason: blockedChaptersList[0]?.blockReason || "",
    contextBudgetOverages: {
      isOverages: estimatedChars > budgetLimit,
      estimatedChars,
      budgetLimit,
      overageChars: Math.max(0, estimatedChars - budgetLimit),
    },
    ragRecall: {
      projectSources: Number(summaryObj.projectSources || 0),
      globalSources: Number(summaryObj.globalSources || 0),
      recentRecallCount: recentMemory.filter((row) => String(row.kind || "") === "rag").length,
    },
    characterDossierGaps: incompleteDossierFields,
    workerLeaseIssues: {
      hasIssues: staleJobsList.length > 0,
      staleJobs: staleJobsList,
    },
    memoryEmbeddingBacklog: recentMemory.filter((row) => String(row.embedding_status || "") === "pending").length,
  }

  return {
    style: {
      status: missingStyle.length === 0 ? "ready" : missingStyle.length <= 1 ? "warning" : "needs_setup",
      genre: creativeProfile?.genre || "",
      readerPromise: creativeProfile?.readerPromise || "",
      pointOfView: creativeProfile?.pointOfView || "",
      tone: creativeProfile?.tone || "",
      naturalnessTarget: creativeProfile?.naturalnessTarget || "",
      styleFingerprint: creativeProfile?.styleFingerprint || "",
      artifactPath: styleArtifact ? artifactPath(styleArtifact) : ".ai-novel/style/profile.md",
      updatedAt: styleArtifact?.updated_at || styleArtifact?.created_at || "",
      missing: missingStyle,
    },
    characterDossier: {
      status: dossierCount > 0 && incompleteDossierFields.length === 0 ? "ready" : dossierCount > 0 ? "warning" : "needs_setup",
      count: dossierCount,
      artifactPath: dossierArtifact ? artifactPath(dossierArtifact) : ".ai-novel/memory/characters/dossiers.json",
      updatedAt: dossierArtifact?.updated_at || dossierArtifact?.created_at || "",
      memoryRows: characterMemoryRows.length,
      missing: incompleteDossierFields,
    },
    memoryRecall: {
      status: characterMemoryRows.length > 0 && memoryLag <= 1 ? "ready" : memoryLag > 2 ? "warning" : "indexing",
      characterRows: characterMemoryRows.length,
      chapterRows: chapterMemoryRows.length,
      memoryLag,
      latestSource: String(recentMemory[0]?.source || ""),
      latestKind: String(recentMemory[0]?.kind || ""),
      pendingEmbeddings: recentMemory.filter((row) => String(row.embedding_status || "") === "pending").length,
    },
    contextBudget: {
      status: budgetPercent >= 90 ? "warning" : budgetPercent >= 70 ? "watch" : "ready",
      estimatedChars,
      budgetLimit,
      budgetPercent,
      sections: contextSections,
    },
    qualitySignals: {
      latestNaturalnessReason: String(latestNaturalness || ""),
      completedChapters: chapterFacts.filter((fact) => fact.status === "complete").length,
      blockedChapters: chapterFacts.filter((fact) => fact.status === "blocked").length,
    },
    metadata: {
      styleMetadata: parseMetadataRow(styleArtifact),
      dossierMetadata: parseMetadataRow(dossierArtifact),
    },
    diagnostics,
  }
}

function normalizeAutopilotRuntimeForPayload(
  state: Awaited<ReturnType<typeof loadAutonomousState>> | null,
  factorySnapshot: Record<string, unknown> | null,
) {
  if (!state?.runtime?.autopilot) return state
  const activeJobs = Array.isArray(factorySnapshot?.activeJobs) ? factorySnapshot.activeJobs : []
  const hasRunningJob = activeJobs.some((job) => job && job.status !== "paused" && job.status !== "failed" && job.status !== "completed")
  if (hasRunningJob) {
    if (state.runtime.autopilot.running) {
      return state
    }
    return {
      ...state,
      runtime: {
        ...state.runtime,
        statusMessage: "自动创作运行中：后台 worker 已领取任务，正在按数据库进度继续推进。",
        autopilot: {
          ...state.runtime.autopilot,
          running: true,
          stopRequested: false,
          mode: "background" as const,
          lastStep: state.runtime.autopilot.lastStep === "stopped" ? "worker:running" : state.runtime.autopilot.lastStep,
          statusMessage: "后台 worker 正在执行无人值守任务。",
        },
      },
    }
  }
  if (!state.runtime.autopilot.running && !state.runtime.autopilot.stopRequested) {
    return state
  }
  return {
    ...state,
    runtime: {
      ...state.runtime,
      statusMessage: state.runtime.statusMessage || "无人值守任务当前未运行。",
      autopilot: {
        ...state.runtime.autopilot,
        running: false,
        stopRequested: false,
        mode: "idle" as const,
        lastStep: "stopped",
        statusMessage: state.runtime.autopilot.statusMessage || "数据库中没有可执行的无人值守任务；当前没有后台 worker 在运行。",
      },
    },
  }
}

async function createWorkspacePayload(
  projectRoot: string,
  state?: Awaited<ReturnType<typeof loadAutonomousState>> | null,
  options: {
    rootDir?: string
    projectId?: string | null
    syncState?: boolean
    includeTranscript?: boolean
    compactPayload?: boolean
    chapterPage?: number
    chapterPageSize?: number
  } = {},
) {
  const diskState = options.syncState ? await tryLoadState(projectRoot) : null
  const factorySnapshot = options.rootDir && options.projectId
    ? await withFactoryDb(options.rootDir, async (db) => db.getSnapshot(options.projectId as string)).catch(() => null)
    : null
  const rawResolvedState = normalizeAutopilotRuntimeForPayload(
    factorySnapshot?.state ?? state ?? diskState,
    factorySnapshot as Record<string, unknown> | null,
  )
  const resolvedState = stateWithChapterFactsForPayload(rawResolvedState, factorySnapshot as Record<string, unknown> | null)
  const serializedResolvedState = resolvedState ? stableJson(serializeState(resolvedState)) : null
  const serializedDiskState = diskState ? stableJson(serializeState(diskState)) : null
  const serializedDbState = factorySnapshot?.state ? stableJson(serializeState(factorySnapshot.state)) : null
  const shouldPersistResolvedState = options.syncState
    && resolvedState
    && serializedResolvedState
    && serializedDiskState
    && serializedDiskState !== serializedResolvedState
  if (shouldPersistResolvedState) {
    await saveAutonomousState(projectRoot, resolvedState).catch(() => undefined)
  }
  if (options.syncState && resolvedState) {
    await syncCurrentContextPacketState(projectRoot, resolvedState).catch(() => undefined)
  }
  const shouldSyncDbState = options.syncState
    && options.rootDir
    && options.projectId
    && resolvedState
    && serializedResolvedState
    && serializedDbState
    && serializedDbState !== serializedResolvedState
  if (shouldSyncDbState) {
    await withFactoryDb(options.rootDir as string, async (db) => {
      db.updateProjectState(options.projectId as string, resolvedState)
    }).catch(() => undefined)
  }
  const dbGraph = factorySnapshot && options.projectId && factorySnapshot.graphNodes.length > 0
    ? superGraphFromDbRows(options.projectId, factorySnapshot.graphNodes, factorySnapshot.graphEdges)
    : null
  const graphDir = path.join(projectRoot, ".ai-novel", "graph")
  const fileGraphIndex = await fs.readFile(path.join(graphDir, "index.json"), "utf8")
    .then((raw) => JSON.parse(raw))
    .catch(() => null)
  const fileGraphViolations = await fs.readFile(path.join(graphDir, "violations.json"), "utf8")
    .then((raw) => JSON.parse(raw))
    .catch(() => [])
  const graphIndex = dbGraph ? buildSuperGraphIndex(dbGraph) : fileGraphIndex
  const graphViolations = dbGraph ? validateSuperGraph(dbGraph) : fileGraphViolations
  const useCompactPayload = options.includeTranscript === false || options.compactPayload === true
  const compactState = useCompactPayload
    ? compactStateForPayload(resolvedState, {
      chapterPage: options.chapterPage,
      chapterPageSize: options.chapterPageSize,
    })
    : resolvedState ? serializeState(resolvedState) : null
  const consensus = await readWorkspaceText(projectRoot, "prompts", "global-consensus.md")
  const contextPacket = await readWorkspaceText(projectRoot, "context", "current-context.md")
  const productionObservability = deriveProductionObservability(
    factorySnapshot as Record<string, unknown> | null,
    resolvedState,
    contextPacket,
  )
  const projectRuntime = deriveProjectRuntimeState({
    state: resolvedState as Record<string, unknown> | null,
    factorySnapshot: factorySnapshot as Record<string, unknown> | null,
  })
  const compactFactorySnapshot = factorySnapshot
    ? {
      ...factorySnapshot,
      state: compactState,
      productionObservability,
      projectRuntime,
    }
    : null
  const responseFactorySnapshot = useCompactPayload
    ? compactFactorySnapshotForPayload(compactFactorySnapshot)
    : compactFactorySnapshot

  const payload = {
    state: compactState,
    projectRuntime,
    consensus,
    contextPacket,
    graphIndex,
    graphViolations,
    factorySnapshot: responseFactorySnapshot,
  }
  const snapshotVersion = createSnapshotVersion({
    state: compactState,
    projectRuntime,
    consensus,
    contextPacket,
    graphViolations,
    factorySnapshot: semanticFactorySnapshotForVersion(responseFactorySnapshot),
  })
  if (options.includeTranscript !== false) {
    const transcript = await readDiscussionTranscript(projectRoot)
    const messageEntries = discussionEntriesFromSnapshot(factorySnapshot as Record<string, unknown> | null)
    return {
      ...payload,
      snapshotVersion,
      transcript,
      ...(messageEntries
        ? { ...messageEntries, meta: { ...messageEntries.meta, transcriptBytes: Buffer.byteLength(transcript) } }
        : parseTranscriptEntries(transcript)),
    }
  }
  return {
    ...payload,
    snapshotVersion,
  }
}

async function tryLoadState(projectRoot: string) {
  try {
    return await loadAutonomousState(projectRoot)
  } catch {
    return null
  }
}

async function ensureDurableAutopilotJob(
  rootDir: string,
  projectId: string | null | undefined,
  message: string,
  options: { source?: string } = {},
) {
  if (!projectId) {
    return null
  }

  return withFactoryDb(rootDir, async (db) => {
    const projectJobs = db.listProjectJobs(projectId, "autopilot")
    const activeJobs = projectJobs
      .filter((job) => job.status === "running" || job.status === "paused")
      .sort((left, right) =>
        String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || "")),
      )
    const recoverableFailedJob = projectJobs
      .filter((job) => job.status === "failed" && db.jobFailureLooksRecoverable(String(job.id)))
      .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))[0]
    const reusableJob = activeJobs[0] ?? recoverableFailedJob

    for (const duplicate of activeJobs.slice(1)) {
      db.cancelJob(String(duplicate.id))
    }

    if (reusableJob?.id) {
      if (reusableJob.status === "failed") {
        db.resumeJob(String(reusableJob.id), { message, mode: "background" })
      } else {
        db.updateJobPayload(String(reusableJob.id), { message, mode: "background", submittedAt: new Date().toISOString() })
      }
      db.recordEvent(projectId, typeof reusableJob.run_id === "string" ? reusableJob.run_id : null, "JOB_REUSED", {
        id: reusableJob.id,
        kind: reusableJob.kind,
        status: reusableJob.status,
        requestedMessage: message,
        source: options.source || "autopilot",
      })
      db.recordEvent(projectId, typeof reusableJob.run_id === "string" ? reusableJob.run_id : null, "AUTOPILOT_INSTRUCTION_QUEUED", {
        id: reusableJob.id,
        message,
        status: reusableJob.status,
        source: options.source || "autopilot",
      })
      return String(reusableJob.id)
    }

    const jobId = db.createJob({
      projectId,
      kind: "autopilot",
      status: "running",
      payload: { message, mode: "background", source: options.source || "autopilot" },
    })
    db.recordEvent(projectId, null, "AUTOPILOT_INSTRUCTION_QUEUED", {
      id: jobId,
      message,
      status: "running",
      source: options.source || "autopilot",
    })
    return jobId
  }).catch(() => null)
}

function createAutopilotKickoffMessage(state: Awaited<ReturnType<typeof loadAutonomousState>>) {
  const chapterTasks = Array.isArray(state.plan?.chapterTasks) ? state.plan.chapterTasks : []
  const nextTask = chapterTasks.find((task) => task.status !== "complete")
  if (state.runtime?.stage === "drafting" || state.runtime?.stage === "reviewing" || state.runtime?.stage === "chapter_task_generation") {
    return [
      `继续小说《${state.project.title || state.project.idea}》的章节正文生产流程。`,
      `当前阶段：${state.runtime.stage}。不要重新构思世界观、主角核心或主线方向。`,
      nextTask
        ? `从第 ${nextTask.chapterNumber} 章「${nextTask.title || `Chapter ${nextTask.chapterNumber}`}」继续，按既有章节队列、角色档案、记忆和质量门禁推进。`
        : "检查章节队列，继续处理下一个 pending、blocked 或可恢复的章节任务。",
      `目标总章数：${state.plan.totalChapters}，单章字数：${state.plan.chapterWordTarget}。`,
      "优先执行正文写作、质量修订、自然度/AIGC 检测与记忆写回，不要回到首轮设定讨论。",
    ].join("")
  }

  return [
    `请基于小说想法“${state.project.idea}”接管创作流程。`,
    "先完成世界观基线、主角核心、主线方向的首轮统一讨论。",
    `目标总章数：${state.plan.totalChapters}，单章字数：${state.plan.chapterWordTarget}。`,
    "不要向我提问选项，缺失信息请自行建立高质量工作假设，并给出统一结论。",
  ].join("")
}

async function enqueueKnowledgeReindexJobs(
  rootDir: string,
  projectId: string,
  scope: "global" | "project" | "all" = "all",
  options: { limit?: number; reason?: string } = {},
) {
  return withFactoryDb(rootDir, async (db) => {
    const snapshot = db.getSnapshot(projectId)
    const queued: Array<{ id: string; kind: string; artifactPath?: string }> = []
    const reason = options.reason || "api_reindex"

    if (scope === "global" || scope === "all") {
      const id = db.createJob({
        projectId,
        kind: "knowledge_global_reindex",
        status: "idle",
        payload: {
          scope: "global",
          reason,
          limit: options.limit,
        },
      })
      queued.push({ id, kind: "knowledge_global_reindex" })
    }

    if (scope === "project" || scope === "all") {
      const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts as Array<Record<string, unknown>> : []
      const artifactPaths = [...new Set(artifacts
        .map((artifact) => String(artifact.path || ""))
        .filter((artifactPath) =>
          artifactPath.endsWith(".md")
          && (
            artifactPath.includes("global-consensus.md")
            || artifactPath.includes("/consensus/")
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

      for (const artifactPath of artifactPaths.slice(0, 200)) {
        const id = db.createJob({
          projectId,
          kind: "knowledge_project_artifact",
          status: "idle",
          payload: {
            projectId,
            artifactPath,
            kind: "artifact",
            reason,
          },
        })
        queued.push({ id, kind: "knowledge_project_artifact", artifactPath })
      }
    }

    db.recordEvent(projectId, null, "KNOWLEDGE_REINDEX_QUEUED", {
      scope,
      reason,
      jobs: queued,
    })
    return queued
  })
}

async function stopInProcessAutopilotBeforeProjectDelete(projectRoot: string) {
  const job = getAutopilotJob(projectRoot)
  if (!job) {
    return false
  }

  stopAutopilotJob(projectRoot)
  await Promise.race([
    job.promise.catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ])
  return true
}

async function buildProjectSummary(rootDir: string, project: any): Promise<any> {
  let dbSnapshot: any = null
  try {
    dbSnapshot = await withFactoryDb(rootDir, async (db) => db.getSnapshot(project.id)).catch(() => null)
  } catch (e) {}

  const state = dbSnapshot?.state || await tryLoadState(project.projectRoot).catch(() => null)
  if (!state) {
    const projectRuntime = deriveProjectRuntimeState({
      state: null,
      factorySnapshot: dbSnapshot,
    })
    return {
      source: "empty",
      stage: projectRuntime.workflowStage === "empty" ? "worldbuilding_dialogue" : projectRuntime.workflowStage,
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
      updatedAt: new Date().toISOString(),
      projectRuntime,
    }
  }

  const tasks: any[] = Array.isArray(state.plan?.chapterTasks) ? state.plan.chapterTasks : []
  const chapterFacts: any[] = Array.isArray(dbSnapshot?.chapterFacts) ? dbSnapshot.chapterFacts : []
  const totalChapters = Number(state.plan?.totalChapters || project.totalChapters || tasks.length || 0)
  
  const passedChapters = chapterFacts.length > 0
    ? chapterFacts.filter((fact: any) => fact.status === "complete").length
    : tasks.filter((task: any) => task.status === "complete").length

  let contiguousCompletedChapters = 0
  if (chapterFacts.length > 0) {
    const factsByChapter = new Map(chapterFacts.map((fact: any) => [Number(fact.chapterNumber), fact]))
    for (let ch = 1; ch <= totalChapters; ch += 1) {
      const factRecord = factsByChapter.get(ch) as any
      if (factRecord?.status !== "complete") break
      contiguousCompletedChapters += 1
    }
  } else {
    for (const task of tasks) {
      if (task.status !== "complete") break
      contiguousCompletedChapters += 1
    }
  }
  const completedChapters = Math.min(passedChapters, contiguousCompletedChapters)

  const inProgressChapters = chapterFacts.length > 0
    ? chapterFacts.filter((fact: any) => fact.status === "in_progress").length
    : tasks.filter((task: any) => task.status === "in_progress").length

  const blockedChapters = chapterFacts.length > 0
    ? chapterFacts.filter((fact: any) => fact.status === "blocked").length
    : tasks.filter((task: any) => task.status === "blocked").length

  const pendingChapters = Math.max(0, totalChapters - completedChapters - inProgressChapters - blockedChapters)
  const progressPercent = totalChapters > 0
    ? Math.max(0, Math.min(100, Math.round((completedChapters / totalChapters) * 100)))
    : 0

  const activeJobs = Array.isArray(dbSnapshot?.activeRuns) ? dbSnapshot.activeRuns.length : 0
  const runnableJobs = Array.isArray(dbSnapshot?.runnableJobs) ? dbSnapshot.runnableJobs.length : 0
  
  const latestEvent = Array.isArray(dbSnapshot?.latestEvents) ? dbSnapshot.latestEvents[0] : null
  const projectRuntime = deriveProjectRuntimeState({
    state,
    factorySnapshot: dbSnapshot,
  })
  const progress = projectRuntime.chapterProgress

  return {
    source: dbSnapshot ? "db" : "state",
    stage: projectRuntime.workflowStage,
    progressPercent: progress.progressPercent || progressPercent,
    totalChapters: progress.totalChapters || totalChapters,
    completedChapters: progress.completedChapters,
    pendingChapters: progress.pendingChapters,
    inProgressChapters: progress.inProgressChapters,
    blockedChapters: progress.blockedChapters,
    activeJobs,
    runnableJobs,
    latestEventType: latestEvent?.type || "",
    latestEventAt: latestEvent?.created_at || latestEvent?.updated_at || "",
    updatedAt: state.runtime?.lastUpdatedAt || new Date().toISOString(),
    projectRuntime,
  }
}

async function reconcileFactoryProjectsWithRegistry(rootDir: string) {
  const projects = await listAutonomousProjects(rootDir)
  await withFactoryDb(rootDir, async (db) => {
    const removedProjectIds = db.pruneProjectsExcept(projects.map((project) => project.id))
    for (const projectId of removedProjectIds) {
      db.recordEvent(null, null, "ORPHAN_PROJECT_PRUNED", { projectId })
    }
  }).catch(() => undefined)

  for (const project of projects) {
    project.summary = await buildProjectSummary(rootDir, project)
  }

  return projects
}

async function resolveProjectContext(rootDir: string, projectId?: string | null) {
  const projects = await reconcileFactoryProjectsWithRegistry(rootDir)

  if (projectId) {
    return {
      projects,
      projectId,
      projectRoot: await resolveManagedProjectRoot(rootDir, projectId),
      mode: "managed" as const,
    }
  }

  if (projects.length === 1) {
    return {
      projects,
      projectId: projects[0].id,
      projectRoot: await resolveManagedProjectRoot(rootDir, projects[0].id),
      mode: "managed" as const,
    }
  }

  if (projects.length > 1) {
    return {
      projects,
      projectId: null,
      projectRoot: null,
      mode: "selection_required" as const,
    }
  }

  const legacyState = await tryLoadState(rootDir)
  if (legacyState) {
    return {
      projects: [],
      projectId: "legacy-root-workspace",
      projectRoot: rootDir,
      mode: "legacy" as const,
    }
  }

  return {
    projects,
    projectId: null,
    projectRoot: null,
    mode: "empty" as const,
  }
}

export async function handleNovelStudioApi(
  rootDir: string,
  method: string,
  pathname: string,
  body: Record<string, unknown> = {},
  options: ApiCallOptions = {},
) {
  const requestUrl = new URL(pathname, "http://local")
  const requestPathname = requestUrl.pathname

  if (method === "POST" && requestPathname === "/api/aigc-detect") {
    const text = typeof body.text === "string" ? body.text : ""
    const mode = body.mode === "text" ? "text" : "segments"
    const detectorConfig = mergeApiAigcDetectorConfig(getAigcDetectorConfig(rootDir), body.config)
    const segments = Array.isArray(body.segments) ? readApiAigcSegments(body.segments) : null

    if (!text.trim() && (!segments || segments.length === 0)) {
      return { status: 400, payload: { error: "text_required" } }
    }

    const result = mode === "text" && !segments
      ? await detectAigcText(text, detectorConfig)
      : await detectAigcSegments(segments ?? text, detectorConfig)

    return {
      status: 200,
      payload: {
        result,
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/llm-configs") {
    await ensureEnvLlmConfigImported(rootDir)
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs()
    })
    return {
      status: 200,
      payload: {
        configs: redactLlmConfigs(configs),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/llm-configs") {
    const name = String(body.name || "").trim()
    const baseUrl = String(body.baseUrl || "").trim()
    const apiKey = String(body.apiKey || "").trim()
    const modelName = String(body.modelName || "").trim()
    const temperature = typeof body.temperature === "number" ? body.temperature : 0.1
    const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : 120000
    const configId = typeof body.id === "string" ? body.id.trim() : null
    const isConfiguredPlaceholder = apiKey === "[configured]"

    if (!name || !baseUrl || (!apiKey && !configId) || !modelName) {
      return { status: 400, payload: { error: "missing_fields" } }
    }

    await withFactoryDb(rootDir, async (db) => {
      if (configId) {
        const currentConfig = db.listLlmConfigs().find((config) => config.id === configId)
        if (!currentConfig) {
          throw new Error("llm_config_not_found")
        }
        const nextApiKey = isConfiguredPlaceholder && typeof currentConfig?.api_key === "string"
          ? currentConfig.api_key
          : apiKey
        if (!nextApiKey) {
          throw new Error("missing_api_key")
        }
        db.updateLlmConfig(configId, { name, baseUrl, apiKey: nextApiKey, modelName, temperature, timeoutMs })
      } else {
        const existingConfigs = db.listLlmConfigs()
        const hasActiveConfig = existingConfigs.some((config) => Number(config.is_active) === 1)
        db.addLlmConfig({ name, baseUrl, apiKey, modelName, temperature, timeoutMs, isActive: !hasActiveConfig })
      }
    })

    await loadActiveLlmConfig(rootDir)

    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs()
    })

    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/llm-configs/activate") {
    const id = typeof body.id === "string" ? body.id.trim() : null
    if (!id) {
      return { status: 400, payload: { error: "id_required" } }
    }

    await withFactoryDb(rootDir, async (db) => {
      db.activateLlmConfig(id)
    })

    await loadActiveLlmConfig(rootDir)

    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs()
    })

    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
      },
    }
  }

  if (method === "DELETE" && requestPathname === "/api/llm-configs") {
    const id = requestUrl.searchParams.get("id")
    if (!id) {
      return { status: 400, payload: { error: "id_required" } }
    }

    await withFactoryDb(rootDir, async (db) => {
      db.deleteLlmConfig(id)
    })

    await loadActiveLlmConfig(rootDir)

    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs()
    })

    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/projects") {
    return {
      status: 200,
      payload: {
        projects: await reconcileFactoryProjectsWithRegistry(rootDir),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "DELETE" && requestPathname.startsWith("/api/projects/")) {
    const projectId = decodeURIComponent(requestPathname.replace(/^\/api\/projects\//, "")).trim()
    if (!projectId) {
      return { status: 400, payload: { error: "project_id_required" } }
    }

    const projectRoot = await resolveManagedProjectRoot(rootDir, projectId).catch(() => null)
    const stoppedInProcess = projectRoot
      ? await stopInProcessAutopilotBeforeProjectDelete(projectRoot)
      : false
    const deleted = await deleteManagedAutonomousProject(rootDir, projectId)
    if (!deleted) {
      return {
        status: 404,
        payload: {
          error: "project_not_found",
          projects: await listAutonomousProjects(rootDir),
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    return {
      status: 200,
      payload: {
        deletedProject: deleted.project,
        stoppedInProcess,
        projects: await listAutonomousProjects(rootDir),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/health") {
    return {
      status: 200,
      payload: {
        ok: true,
        service: "ai-novel-server",
        checkedAt: new Date().toISOString(),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/ready") {
    try {
      await reconcileFactoryProjectsWithRegistry(rootDir)
      const factory = await withFactoryDb(rootDir, async (db) => db.getOperationalStatus())
      return {
        status: 200,
        payload: {
          ok: true,
          service: "ai-novel-server",
          factory,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    } catch (error) {
      return {
        status: 503,
        payload: {
          ok: false,
          service: "ai-novel-server",
          error: error instanceof Error ? error.message : String(error),
          checkedAt: new Date().toISOString(),
        },
      }
    }
  }

  if (method === "POST" && requestPathname === "/api/projects") {
    const idea = String(body.idea || "").trim()
    const totalChapters = Number.parseInt(String(body.chapters || "24"), 10)
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || "2500"), 10)

    if (!idea) {
      return { status: 400, payload: { error: "idea_required" } }
    }

    const created = await createManagedAutonomousProject({
      rootDir,
      idea,
      totalChapters,
      chapterWordTarget,
      title: typeof body.title === "string" ? body.title : undefined,
      creativeProfile: body.creativeProfile && typeof body.creativeProfile === "object"
        ? body.creativeProfile as Record<string, unknown>
        : undefined,
    })
    await recordStatusMessage(rootDir, {
      projectId: created.project.id,
      conversationId: "workflow-control",
      runId: null,
      title: "项目已创建",
      content: "已建立独立工作区。自动创作不会自动启动，请进入创作台后点击“开始创作”。",
      metadata: { source: "project_created", kickoffQueued: false },
    })
    const state = await markAutopilot(created.project.projectRoot, {
      running: false,
      stopRequested: false,
      mode: "idle",
      target: null,
      lastStep: "awaiting_user_start",
      statusMessage: "项目已创建，等待手动开始自动创作。",
    }, { factoryRootDir: rootDir, projectId: created.project.id })

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
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/knowledge-graph") {
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }

    let graph = { nodes: [] as any[], edges: [] as any[] }
    try {
      const dbGraph = await withFactoryDb(rootDir, async (db) => db.getGraph(context.projectId as string))
      if (dbGraph && Array.isArray(dbGraph.nodes) && dbGraph.nodes.length > 0) {
        const storyNodeTypes = new Set([
          "Character", "Location", "Faction", "Event", "Scene", 
          "Foreshadowing", "WorldRule", "Conflict", "Relationship", "TimelinePoint"
        ])

        const nodes = dbGraph.nodes.map(n => {
          let properties: Record<string, any> = {}
          try {
            properties = typeof n.metadata_json === "string" ? JSON.parse(n.metadata_json) : (n.metadata_json || {})
          } catch (e) {}
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
          }
        })

        const storyNodes = nodes.filter(n => {
          const lowerType = String(n.node_type || "").toLowerCase()
          return Array.from(storyNodeTypes).some(st => st.toLowerCase() === lowerType)
        })

        if (storyNodes.length > 0) {
          const storyNodeIds = new Set(storyNodes.map(n => n.id))
          const edges = dbGraph.edges
            .filter(e => storyNodeIds.has(e.from_node_id) && storyNodeIds.has(e.to_node_id))
            .map((e, index) => ({
              id: e.id || `db-edge-${index}`,
              source_id: e.from_node_id,
              target_id: e.to_node_id,
              relation_type: e.type || "关联",
              metadata_json: e.metadata_json || "{}"
            }))

          graph = { nodes: storyNodes, edges }
        }
      }
    } catch (err) {
      console.error("Failed to query graph from factory db:", err)
    }

    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...graph,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/status") {
    const includeTranscript = requestUrl.searchParams.get("includeTranscript") === "1"
    const chapterPage = Number.parseInt(String(requestUrl.searchParams.get("chapterPage") || ""), 10)
    const chapterPageSize = Number.parseInt(String(requestUrl.searchParams.get("chapterPageSize") || ""), 10)
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (context.mode === "selection_required") {
      return {
        status: 409,
        payload: {
          error: "project_selection_required",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    if (!context.projectRoot) {
      return {
        status: 404,
        payload: {
          error: "workspace_not_initialized",
          transcript: "",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    const snapshotState = context.projectId
      ? await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId as string).state).catch(() => null)
      : null
    const fileState = await tryLoadState(context.projectRoot)
    const state = snapshotState ?? fileState
    if (!state) {
      return {
        status: 404,
        payload: {
          error: "workspace_not_initialized",
          transcript: "",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    const workspacePayload = await createWorkspacePayload(context.projectRoot, state, {
      rootDir,
      projectId: context.projectId,
      syncState: true,
      includeTranscript,
      chapterPage: Number.isFinite(chapterPage) ? chapterPage : undefined,
      chapterPageSize: Number.isFinite(chapterPageSize) ? chapterPageSize : undefined,
    })
    const knownSnapshotVersion = requestUrl.searchParams.get("knownSnapshotVersion")
    if (!includeTranscript && knownSnapshotVersion && knownSnapshotVersion === workspacePayload.snapshotVersion) {
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          notModified: true,
          snapshotVersion: workspacePayload.snapshotVersion,
        },
      }
    }

    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...workspacePayload,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/transcript") {
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const limit = Math.max(1, Math.min(200, Number.parseInt(requestUrl.searchParams.get("limit") || "80", 10)))
    const transcript = await readDiscussionTranscript(context.projectRoot)
    const messageEntries = context.projectId
      ? await withFactoryDb(rootDir, async (db) => messageRowsToEntries(db.listMessages(context.projectId as string, { limit }), { limit, transcriptBytes: Buffer.byteLength(transcript) })).catch(() => null)
      : null
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(messageEntries ?? parseTranscriptEntries(transcript, { limit })),
        transcript,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/messages") {
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const limit = Math.max(1, Math.min(500, Number.parseInt(requestUrl.searchParams.get("limit") || "80", 10)))
    const offset = Math.max(0, Number.parseInt(requestUrl.searchParams.get("offset") || "0", 10) || 0)
    const conversationId = requestUrl.searchParams.get("conversationId") || undefined
    const messagePage = await withFactoryDb(rootDir, async (db) => {
      const totalMessages = db.countMessages(context.projectId as string, { conversationId })
      const messages = db.listMessages(context.projectId as string, { limit, offset, conversationId })
      return { messages, totalMessages }
    }).catch(() => ({ messages: [], totalMessages: 0 }))
    const messages = messagePage.messages
    const totalMessages = messagePage.totalMessages
    const nextOffset = offset + messages.length
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        messages,
        ...messageRowsToEntries(messages as Array<Record<string, unknown>>, { limit }),
        pagination: {
          limit,
          offset,
          returned: messages.length,
          totalMessages,
          hasMore: nextOffset < totalMessages,
          nextOffset: nextOffset < totalMessages ? nextOffset : null,
          conversationId: conversationId || null,
        },
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/chapters/preview") {
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const chapterNumber = Number.parseInt(String(requestUrl.searchParams.get("chapterNumber") || ""), 10)
    if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return { status: 400, payload: { error: "chapter_number_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
    const relativePath = `.ai-novel/chapters/${chapterId}.final.md`
    const content = await readWorkspaceText(context.projectRoot, "chapters", `${chapterId}.final.md`)
    if (!content) {
      return {
        status: 404,
        payload: {
          error: "chapter_not_found",
          chapterNumber,
          path: relativePath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        chapterNumber,
        path: relativePath,
        content,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/artifacts/preview") {
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const artifactPath = String(requestUrl.searchParams.get("path") || "").trim()
    if (!artifactPath) {
      return { status: 400, payload: { error: "artifact_path_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const content = await readWorkspaceArtifactText(context.projectRoot, artifactPath)
    if (content === null) {
      return {
        status: 400,
        payload: {
          error: "artifact_path_not_allowed",
          path: artifactPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }
    if (!content) {
      return {
        status: 404,
        payload: {
          error: "artifact_not_found",
          path: artifactPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        path: artifactPath,
        content,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/init") {
    const idea = String(body.idea || "").trim()
    const totalChapters = Number.parseInt(String(body.chapters || "24"), 10)
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || "2500"), 10)

    if (!idea) {
      return { status: 400, payload: { error: "idea_required" } }
    }

    const state = await initAutonomousProject({
      rootDir,
      idea,
      totalChapters,
      chapterWordTarget,
      title: typeof body.title === "string" ? body.title : undefined,
    })

    return { status: 200, payload: await createWorkspacePayload(rootDir, state, { rootDir, projectId: "legacy-root-workspace", syncState: true }) }
  }

  if (method === "POST" && requestPathname === "/api/advance") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const { state } = await executeManualAdvanceCommand(context.projectRoot, {
      factoryRootDir: rootDir,
      projectId: context.projectId,
      source: "api",
      requestedBy: "api:/api/advance",
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/chapters/retry") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const chapterNumber = Number.parseInt(String(body.chapterNumber || ""), 10)
    if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return { status: 400, payload: { error: "chapter_number_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    try {
      const { state, recoveryLimited } = await executeManualRetryChapterCommand(context.projectRoot, chapterNumber, {
        factoryRootDir: rootDir,
        projectId: context.projectId,
        source: "api",
        requestedBy: "api:/api/chapters/retry",
        runNow: body.runNow !== false,
      })
      await recordStatusMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: "workflow-control",
        title: "章节重试已接收",
        content: recoveryLimited
          ? `第 ${chapterNumber} 章已达到自动恢复上限，需要人工审阅后再继续。`
          : `第 ${chapterNumber} 章已进入质量返工闭环，系统会按 DB 状态继续推进。`,
        metadata: {
          source: "api_chapter_retry",
          chapterNumber,
          recoveryLimited,
        },
      })
      await recordToolMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: "workflow-control",
        toolName: "chapter-retry",
        status: recoveryLimited ? "failed" : "completed",
        input: {
          chapterNumber,
          runNow: body.runNow !== false,
        },
        output: {
          recoveryLimited,
          chapterStatus: state.plan.chapterTasks[chapterNumber - 1]?.status || null,
          stage: state.runtime.stage,
        },
        content: recoveryLimited
          ? `第 ${chapterNumber} 章重试已触达恢复上限。`
          : `第 ${chapterNumber} 章重试命令已执行并写回数据库状态。`,
        metadata: {
          source: "api_chapter_retry",
          chapterNumber,
          recoveryLimited,
        },
      })
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          recoveryLimited,
          ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("chapter_not_found:")) {
        return { status: 404, payload: { error: "chapter_not_found", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
      }
      throw error
    }
  }

  if (method === "POST" && requestPathname === "/api/knowledge/reindex") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const requestedScope = String(body.scope || "all")
    const scope = requestedScope === "global" || requestedScope === "project" || requestedScope === "all"
      ? requestedScope
      : "all"
    const limit = Number(body.limit)
    const queuedKnowledgeJobs = await enqueueKnowledgeReindexJobs(rootDir, context.projectId, scope, {
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      reason: "api_reindex",
    })
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "knowledge-control",
      runId: null,
      toolName: "knowledge-reindex",
      status: "completed",
      input: { scope, limit: Number.isFinite(limit) && limit > 0 ? limit : null },
      output: { queuedJobs: queuedKnowledgeJobs },
      content: `知识库重建任务已写入数据库：${queuedKnowledgeJobs.length} 个后台任务。`,
      metadata: { source: "api_knowledge_reindex", scope },
    })
    const state = await tryLoadState(context.projectRoot)
    return {
      status: 202,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        queuedKnowledgeJobs,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/knowledge/search") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }

    const query = String(body.query || "").trim()
    if (!query) {
      return {
        status: 400,
        payload: {
          error: "query_required",
          message: "请输入要检索的成语、场景、设定或章节约束。",
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    const requestedLimit = Number(body.limit)
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(20, Math.floor(requestedLimit))
      : 8
    const scopes = readKnowledgeScopes(body.scopes)
    const sourceTypes = readStringArray(body.sourceTypes)
    const chunkTypes = readStringArray(body.chunkTypes)
    const rows = await retrieveKnowledge({
      rootDir,
      projectId: context.projectId,
      query,
      scopes,
      sourceTypes: sourceTypes.length ? sourceTypes : undefined,
      chunkTypes: chunkTypes.length ? chunkTypes : undefined,
      limit,
      recordCitation: true,
    })
    const knowledgeSearch = {
      query,
      filters: {
        scopes: scopes || ["global", "project"],
        sourceTypes,
        chunkTypes,
        limit,
      },
      total: rows.length,
      rows: rows.map(normalizeKnowledgeSearchRow),
      searchedAt: new Date().toISOString(),
    }
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
          source: row.source,
        })),
      },
      content: `知识库手动检索完成：${query}，命中 ${knowledgeSearch.total} 个片段。`,
      metadata: { source: "api_knowledge_search", query },
    })
    const state = await tryLoadState(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        knowledgeSearch,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/knowledge/evaluate") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const requestedK = Number(body.k)
    const k = Number.isFinite(requestedK) && requestedK > 0 ? Math.floor(requestedK) : 8
    const explicitCases = Array.isArray(body.cases) ? body.cases : []
    const cases = explicitCases.length > 0
      ? explicitCases.map((item, index) => {
          const record = item && typeof item === "object" ? item as Record<string, unknown> : {}
          const expectedChunkIds = Array.isArray(record.expectedChunkIds)
            ? record.expectedChunkIds.map((id) => String(id)).filter(Boolean)
            : []
          return {
            name: String(record.name || `manual-${index + 1}`),
            query: String(record.query || ""),
            expectedChunkIds,
            projectId: context.projectId,
            scopes: Array.isArray(record.scopes) ? record.scopes.filter((scope) => scope === "global" || scope === "project") : ["global", "project"],
            sourceTypes: Array.isArray(record.sourceTypes) ? record.sourceTypes.map((value) => String(value)).filter(Boolean) : undefined,
            chunkTypes: Array.isArray(record.chunkTypes) ? record.chunkTypes.map((value) => String(value)).filter(Boolean) : undefined,
            k: Number.isFinite(Number(record.k)) && Number(record.k) > 0 ? Math.floor(Number(record.k)) : k,
          } as KnowledgeBenchmarkCase
        }).filter((item) => item.query && item.expectedChunkIds.length > 0)
      : await withFactoryDb(rootDir, async (db) => {
          const snapshot = db.getSnapshot(context.projectId as string)
          return (Array.isArray(snapshot.knowledge?.citations) ? snapshot.knowledge.citations : [])
            .map((citation, index) => {
              const expectedChunkIds = readJsonArray(citation.used_chunk_ids_json)
                .map((id) => String(id))
                .filter(Boolean)
              return {
                name: `recent-citation-${index + 1}`,
                query: String(citation.query || ""),
                expectedChunkIds,
                projectId: context.projectId,
                scopes: ["global", "project"],
                k,
              } as KnowledgeBenchmarkCase
            })
            .filter((item) => item.query && item.expectedChunkIds.length > 0)
            .slice(0, 6)
        }).catch(() => [])

    if (!cases.length) {
      return {
        status: 422,
        payload: {
          error: "knowledge_benchmark_cases_required",
          message: "需要提供包含 query 和 expectedChunkIds 的 cases，或先产生带 used chunk 的知识库引用记录。",
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    const evaluation = await evaluateKnowledgeBenchmark(rootDir, cases)
    const evaluationArtifactPath = await writeKnowledgeEvaluationArtifact(rootDir, context.projectRoot, context.projectId, evaluation)
    await withFactoryDb(rootDir, async (db) => {
      db.recordEvent(context.projectId as string, null, "KNOWLEDGE_EVALUATION_COMPLETED", {
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
          missedChunkIds: item.missedChunkIds,
        })),
      })
    }).catch(() => undefined)
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "knowledge-control",
      runId: null,
      toolName: "knowledge-evaluate",
      status: "completed",
      input: { caseCount: cases.length, k, explicit: explicitCases.length > 0 },
      output: { ...evaluation, artifactPath: evaluationArtifactPath },
      content: `知识库召回评估完成：${evaluation.summary.totalCases} 个样本，Hit@K ${(evaluation.summary.hitRateAtK * 100).toFixed(0)}%，平均 Recall@K ${(evaluation.summary.meanRecallAtK * 100).toFixed(0)}%。`,
      metadata: { source: "api_knowledge_evaluate", artifactPath: evaluationArtifactPath },
    })
    const state = await tryLoadState(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        knowledgeEvaluation: evaluation,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/cover") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const state = await prepareCoverGeneration(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/provider-test") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    const result = await testProviderConnectivity(
      {
        baseUrl: typeof body.LLM_BASE_URL === "string" ? body.LLM_BASE_URL : undefined,
        apiKey: typeof body.LLM_API_KEY === "string" ? body.LLM_API_KEY : undefined,
        modelName: typeof body.LLM_MODEL_ID === "string" ? body.LLM_MODEL_ID : undefined,
      },
      rootDir,
    )
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: result.ok ? "模型连通性测试通过" : "模型连通性测试失败",
      content: result.message || (result.ok ? "Provider reachable." : "Provider unavailable."),
      metadata: {
        source: "api_provider_test",
        ok: result.ok,
        baseUrl: result.baseUrl,
        modelName: result.modelName,
      },
    })
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "provider-test",
      status: result.ok ? "completed" : "failed",
      input: {
        baseUrl: result.baseUrl,
        modelName: result.modelName,
        hasApiKey: Boolean(typeof body.LLM_API_KEY === "string" ? body.LLM_API_KEY : undefined),
      },
      output: {
        ok: result.ok,
        message: result.message,
      },
      content: result.message || (result.ok ? "Provider reachable." : "Provider unavailable."),
      metadata: {
        source: "api_provider_test",
        ok: result.ok,
        baseUrl: result.baseUrl,
        modelName: result.modelName,
      },
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.mode === "managed" ? context.projectId : null,
        projects: context.projects,
        result,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && requestPathname === "/api/env") {
    return {
      status: 200,
      payload: {
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/env") {
    const updates = Object.fromEntries(
      Object.entries(body).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0,
      ),
    )

    if (Object.keys(updates).length > 0) {
      upsertProjectEnvValues(rootDir, updates)
    }

    return {
      status: 200,
      payload: {
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/interrupt") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const message = String(body.message || "").trim()
    if (!message) {
      return { status: 400, payload: { error: "message_required" } }
    }

    const { state } = await executeManualInterruptCommand(context.projectRoot, message, {
      factoryRootDir: rootDir,
      projectId: context.projectId,
      source: "api",
      requestedBy: "api:/api/interrupt",
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/chat") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const message = String(body.message || "").trim()
    if (!message) {
      return { status: 400, payload: { error: "message_required" } }
    }

    const runId = makeRunId("discussion")
    await recordUserMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: runId,
      runId,
      content: message,
      metadata: { source: "api_chat" },
    })
    const discussion = await runMultiAgentDiscussion(context.projectRoot, message, {
      runId,
      envRootDir: rootDir,
      factoryRootDir: context.mode === "managed" ? rootDir : undefined,
      projectId: context.mode === "managed" ? context.projectId ?? undefined : undefined,
    })
    const state = await loadAutonomousState(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        discussion,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/chat-stream") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const message = String(body.message || "").trim()
    if (!message) {
      return { status: 400, payload: { error: "message_required" } }
    }

    const state = await loadAutonomousState(context.projectRoot)
    const route = routeUserMessage(message, state)

    const runId = makeRunId("discussion")
    await recordUserMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: runId,
      runId,
      content: message,
      metadata: { source: "api_chat_stream", route: route.type, reason: route.reason },
    })

    if (route.type === "status_query") {
      const statusText = formatStatus(state)
      await recordStatusMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: runId,
        runId,
        title: "当前项目状态",
        content: statusText,
        metadata: { source: "api_chat_stream_status_query" },
      })

      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          events: [],
          discussion: {
            summary: `已报告当前项目状态：${state.runtime.statusMessage}`,
            target: "status",
            writebackSkipped: true,
            replies: [],
          },
          ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    const streamed: Array<{ role: string; content: string }> = []
    const discussion = await runMultiAgentDiscussion(context.projectRoot, message, {
      runId,
      envRootDir: rootDir,
      factoryRootDir: context.mode === "managed" ? rootDir : undefined,
      projectId: context.mode === "managed" ? context.projectId ?? undefined : undefined,
      onStreamEvent: async (event) => {
        await options.onAgentStreamEvent?.(event)
      },
      onEvent: async (event) => {
        streamed.push(event)
        await options.onStreamEvent?.(event)
      },
    })

    const updatedState = await loadAutonomousState(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        events: streamed,
        discussion,
        ...(await createWorkspacePayload(context.projectRoot, updatedState, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && (requestPathname === "/api/mode" || requestPathname === "/api/autopilot/mode")) {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const autoMode = typeof body.autoMode === "string" ? body.autoMode : "full"
    if (autoMode !== "full" && autoMode !== "semi") {
      return { status: 400, payload: { error: "invalid_auto_mode" } }
    }

    const state = await loadAutonomousState(context.projectRoot)
    state.project.autoMode = autoMode
    await saveAutonomousState(context.projectRoot, state)

    if (context.projectId) {
      await withFactoryDb(rootDir, async (db) => {
        db.updateProjectState(context.projectId as string, state)
      }).catch(() => undefined)
    }

    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "无人值守创作模式已切换",
      content: `系统创作模式已成功切换为：${autoMode === "semi" ? "🤝 半自动共创模式" : "🤖 全自动托管模式"}。`,
      metadata: {
        source: "api_autopilot_mode",
        autoMode,
      },
    })

    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && (requestPathname === "/api/stop" || requestPathname === "/api/autopilot/stop")) {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }

    const stoppedInProcess = stopAutopilotJob(context.projectRoot)
    const stopStatusMessage = stoppedInProcess
      ? "已收到暂停请求，正在中断当前模型请求并保存进度。"
      : "已收到暂停请求，已暂停数据库中的无人值守任务，后续可继续恢复。"
    const state = await markAutopilot(context.projectRoot, {
      running: isAutopilotRunning(context.projectRoot) && !stoppedInProcess,
      stopRequested: true,
      lastStep: "stop_requested",
      statusMessage: stopStatusMessage,
    }, { factoryRootDir: rootDir, projectId: context.projectId })
    if (context.projectId) {
      await withFactoryDb(rootDir, async (db) => {
        const jobs = db.listProjectJobs(context.projectId as string, "autopilot")
          .filter((job) => job.status === "running" || job.status === "paused")
        for (const job of jobs) {
          db.pauseJob(String(job.id))
        }
        return jobs.length
      }).catch(() => undefined)
    }
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "无人值守暂停请求已接收",
      content: stopStatusMessage,
      metadata: {
        source: "api_autopilot_stop",
        stoppedInProcess,
      },
    })
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "autopilot-stop",
      status: "completed",
      input: {
        projectId: context.projectId,
      },
      output: {
        stoppedInProcess,
        pausedDurableJobs: Boolean(context.projectId),
      },
      content: stopStatusMessage,
      metadata: {
        source: "api_autopilot_stop",
        stoppedInProcess,
      },
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/autopilot/start") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }

    let message = typeof body.message === "string" ? body.message.trim() : ""
    const latestState = await tryLoadState(context.projectRoot)
    if (!message && latestState) {
      message = createAutopilotKickoffMessage(latestState)
    }
    let jobId: string | null = null
    if (context.projectId) {
      jobId = await ensureDurableAutopilotJob(rootDir, context.projectId, message, { source: "autopilot_start" })
    }
    const submittedAt = await appendAutopilotSubmissionTranscript(context.projectRoot, {
      message,
      jobId,
      stage: latestState?.runtime?.stage,
    })
    if (context.projectId && message.trim()) {
      await recordUserMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        content: message,
        time: submittedAt || undefined,
        metadata: { source: "autopilot_start", jobId },
      })
      await recordStatusMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        title: "无人值守任务已接收",
        content: `已接收无人值守创作指令，并写入后台任务队列。${jobId ? ` Job: ${jobId}.` : ""}`,
        time: submittedAt || undefined,
        metadata: { source: "autopilot_start", jobId },
      })
      await recordToolMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        toolName: "autopilot-start",
        status: jobId ? "completed" : "failed",
        input: {
          message,
          mode: "background",
        },
        output: {
          jobId,
          queued: Boolean(jobId),
        },
        content: jobId
          ? `无人值守任务 ${jobId} 已写入数据库，等待 worker 领取或续跑。`
          : "无人值守任务写入数据库失败，请检查项目状态。",
        time: submittedAt || undefined,
        metadata: { source: "autopilot_start", jobId },
      })
      await withFactoryDb(rootDir, async (db) => {
        db.recordArtifact({
          projectId: context.projectId as string,
          kind: "transcript",
          path: ".ai-novel/chat/discussion-log.md",
          status: "completed",
          metadata: { jobId, source: "autopilot_submission", submittedAt },
        })
        db.recordEvent(context.projectId as string, null, "AUTOPILOT_MESSAGE_SUBMITTED", {
          message,
          jobId,
          submittedAt,
        })
      }).catch(() => undefined)
    }
    if (shouldUseEmbeddedWorker(options.embeddedWorker) && process.env.AI_NOVEL_TEST_MODE !== "1") {
      if (jobId && !isAutopilotRunning(context.projectRoot)) {
        await withFactoryDb(rootDir, async (db) => {
          db.releaseJobLease(jobId as string, "embedded_worker_start_takeover")
        }).catch(() => undefined)
      }
      ensureAutopilotJob({
        rootDir,
        projectRoot: context.projectRoot,
        projectId: context.projectId,
        projects: context.projects,
        initialMessage: message,
        mode: "background",
        jobId,
        createSnapshot: createWorkspacePayload,
      })
    }
    const state = await markAutopilot(context.projectRoot, {
      running: true,
      stopRequested: false,
      mode: "background",
      target: message.trim() || null,
      statusMessage: shouldUseEmbeddedWorker(options.embeddedWorker)
        ? "无人值守自动创作已在后台启动。关闭页面后，本地服务仍会继续运行。"
        : "无人值守自动创作任务已写入数据库，独立 worker 会领取并持续执行。",
    }, { factoryRootDir: rootDir, projectId: context.projectId })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  return { status: 404, payload: { error: "not_found" } }
}

function resolveStaticFile(staticDir: string, pathname: string) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "")
  return path.join(staticDir, relative)
}

async function serveStatic(staticDir: string, pathname: string, response: http.ServerResponse) {
  const filePath = resolveStaticFile(staticDir, pathname)
  try {
    const content = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : ext === ".js" || ext === ".mjs"
            ? "application/javascript; charset=utf-8"
            : ext === ".json"
              ? "application/json; charset=utf-8"
              : "application/octet-stream"

    response.writeHead(200, { "content-type": contentType })
    response.end(content)
    return true
  } catch {
    return false
  }
}

export async function startNovelStudioServer(options: ServerOptions = {}) {
  const rootDir = options.rootDir ?? process.cwd()
  await loadActiveLlmConfig(rootDir)
  const staticDir = options.staticDir
  const embeddedWorker = shouldUseEmbeddedWorker(options.embeddedWorker)

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1")
      const pathname = url.pathname
      const queryProjectId = url.searchParams.get("projectId")

      if (request.method === "POST" && pathname === "/api/chat-stream") {
        const body = await readJsonBody(request)
        eventStreamHeaders(response)

        const result = await handleNovelStudioApi(rootDir, "POST", "/api/chat-stream", body, {
          projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId,
          onAgentStreamEvent: async (event) => {
            response.write(`event: ${event.type}\n`)
            response.write(`data: ${JSON.stringify(event)}\n\n`)
          },
        })
        response.write(`event: complete\n`)
        response.write(`data: ${JSON.stringify(result.payload)}\n\n`)
        response.end()
        return
      }

      if (request.method === "POST" && pathname === "/api/autopilot-stream") {
        const body = await readJsonBody(request)
        const context = await resolveProjectContext(rootDir, typeof body.projectId === "string" ? body.projectId : queryProjectId)
        eventStreamHeaders(response)

        if (!context.projectRoot) {
          writeSse(response, "error", { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) })
          response.end()
          return
        }

        const job = embeddedWorker ? getAutopilotJob(context.projectRoot) : null
        const listener = job
          ? (event: AutopilotEvent) => {
              if (response.writableEnded || response.destroyed || !response.writable) return
              writeSse(response, event.type, event.payload)
              if (event.type === "complete" || event.type === "error") {
                try {
                  response.end()
                } catch {}
              }
            }
          : null
        if (job && listener) {
          job.listeners.add(listener)
        }
        let lastStreamSnapshotVersion = ""
        const writeSnapshot = async (options: { force?: boolean } = {}) => {
          if (response.writableEnded || response.destroyed || !response.writable) return
          const state = await tryLoadState(context.projectRoot as string)
          const snapshotPayload = {
            activeProjectId: context.projectId,
            projects: context.projects,
            ...(await createWorkspacePayload(context.projectRoot as string, state, { rootDir, projectId: context.projectId })),
            envStatus: getPublicProjectEnvStatus(rootDir),
          }
          const snapshotVersion = typeof snapshotPayload.snapshotVersion === "string" ? snapshotPayload.snapshotVersion : ""
          if (!options.force && snapshotVersion && snapshotVersion === lastStreamSnapshotVersion) {
            if (!response.writableEnded && !response.destroyed && response.writable) {
              try {
                response.write(`: snapshot unchanged ${new Date().toISOString()}\n\n`)
              } catch {}
            }
            return
          }
          lastStreamSnapshotVersion = snapshotVersion
          writeSse(response, "snapshot", snapshotPayload)
        }
        const snapshotTimer = setInterval(() => {
          void writeSnapshot().catch((error) => {
            if (!response.writableEnded && !response.destroyed && response.writable) {
              writeSse(response, "error", { error: error instanceof Error ? error.message : String(error) })
            }
          })
        }, 2000)
        request.on("close", () => {
          clearInterval(snapshotTimer)
          if (job && listener) {
            job.listeners.delete(listener)
          }
        })
        writeSse(response, "autopilot_status", {
          message: embeddedWorker
            ? "已连接本进程内嵌无人值守任务监听。"
            : "已连接无人值守任务状态监听；执行由独立 worker 按数据库任务恢复。",
          projectId: context.projectId,
          hasEmbeddedJob: Boolean(job),
        })
        await writeSnapshot({ force: true })
        return
      }

      if (isJsonApiRequest(request.method, pathname)) {
        await forwardJsonApiRequest(rootDir, request, response, url, { embeddedWorker })
        return
      }

      if (staticDir && request.method === "GET") {
        const served = await serveStatic(staticDir, pathname, response)
        if (served) {
          return
        }
      }

      json(response, 404, { error: "not_found" })
    } catch (error) {
      writeServerErrorResponse(response, error)
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => resolve())
  })
  const restoreTimer = embeddedWorker ? scheduleAutopilotRestore(rootDir, createWorkspacePayload) : null
  if (embeddedWorker) {
    await restoreAutopilotJobs(rootDir, createWorkspacePayload)
  }

  const address = server.address()
  const port = typeof address === "object" && address ? address.port : options.port ?? 0

  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        if (restoreTimer) {
          clearInterval(restoreTimer)
        }
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      }),
  }
}

export async function runNovelStudioServerCli(args = process.argv.slice(2)) {
  const flags = new Map<string, string>()

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith("--")) {
      continue
    }

    const key = token.slice(2)
    const next = args[index + 1]
    if (!next || next.startsWith("--")) {
      flags.set(key, "true")
      continue
    }
    flags.set(key, next)
    index += 1
  }

  const rootDir = flags.get("root-dir") || process.cwd()
  const staticDir = flags.get("static-dir")
  const port = flags.get("port") ? Number.parseInt(flags.get("port") || "4310", 10) : 4310
  const embeddedWorker = flags.get("embedded-worker") === "true"

  const { port: actualPort } = await startNovelStudioServer({
    rootDir,
    staticDir,
    port,
    embeddedWorker,
  })

  console.log(`AI Novel Studio server listening on http://127.0.0.1:${actualPort}`)
}
