import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { withFactoryDb } from "./factory-db"

export type AigcDetectorProvider = "disabled" | "generic-json" | "gradio-queue"

export type AigcDetectionStatus = "ai_likely" | "human_likely" | "uncertain" | "unavailable"

export interface AigcDetectorSegmentOptions {
  maxChars?: number
  minChars?: number
}

export interface AigcDetectorGradioOptions {
  fnIndex?: number
  sessionHash?: string
  joinUrl?: string
  dataUrl?: string
  skipJoin?: boolean
  inputs?: unknown[]
}

export interface AigcDetectionConfig {
  provider?: AigcDetectorProvider
  url?: string
  token?: string
  timeoutMs?: number
  threshold?: number
  headers?: Record<string, string>
  requestTextField?: string
  segment?: AigcDetectorSegmentOptions
  gradio?: AigcDetectorGradioOptions
  fetchImpl?: typeof fetch
  throwOnError?: boolean
}

export interface AigcDetectionInput {
  text: string
  id?: string
  metadata?: Record<string, unknown>
}

export interface AigcTextSegment extends AigcDetectionInput {
  index: number
  startOffset: number
  endOffset: number
}

export interface AigcDetectionResult {
  ok: boolean
  provider: AigcDetectorProvider
  status: AigcDetectionStatus
  score: number | null
  label: string
  confidence: number | null
  raw: unknown
  reason: string
}

export interface AigcSegmentDetectionResult extends AigcDetectionResult {
  segment: AigcTextSegment
  charCount: number
}

export interface AigcBatchDetectionResult {
  ok: boolean
  provider: AigcDetectorProvider
  status: AigcDetectionStatus
  score: number | null
  confidence: number | null
  threshold: number
  totalSegments: number
  highRiskSegments: AigcSegmentDetectionResult[]
  segments: AigcSegmentDetectionResult[]
  reason: string
}

interface ServerSentEvent {
  event?: string
  data: string
}

const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_THRESHOLD = 0.8
const DEFAULT_SEGMENT_MAX_CHARS = 900
const DEFAULT_SEGMENT_MIN_CHARS = 180
const requireBuiltin = createRequire(path.join(process.cwd(), "ai-novel-factory-runtime.js"))
const MANAGED_PROJECTS_SEGMENT = `${path.sep}.ai-novel-projects${path.sep}`
const AIGC_SETTING_KEYS = {
  provider: "aigcDetectorProvider",
  url: "aigcDetectorUrl",
  token: "aigcDetectorToken",
  timeoutMs: "aigcDetectorTimeoutMs",
  threshold: "aigcDetectorThreshold",
  headersJson: "aigcDetectorHeadersJson",
  requestTextField: "aigcDetectorRequestTextField",
  segmentMaxChars: "aigcDetectorSegmentMaxChars",
  segmentMinChars: "aigcDetectorSegmentMinChars",
  gradioFnIndex: "aigcDetectorGradioFnIndex",
  gradioSessionHash: "aigcDetectorGradioSessionHash",
  gradioJoinUrl: "aigcDetectorGradioJoinUrl",
  gradioDataUrl: "aigcDetectorGradioDataUrl",
  gradioSkipJoin: "aigcDetectorGradioSkipJoin",
  gradioInputsJson: "aigcDetectorGradioInputsJson",
} as const

export function getAigcDetectorConfigFromEnv(env: Record<string, string | undefined> = process.env): AigcDetectionConfig {
  return {
    provider: readProvider(env.AIGC_DETECTOR_PROVIDER),
    url: readOptionalString(env.AIGC_DETECTOR_URL),
    token: readOptionalString(env.AIGC_DETECTOR_TOKEN),
    timeoutMs: readPositiveInteger(env.AIGC_DETECTOR_TIMEOUT_MS),
    threshold: readScore(env.AIGC_DETECTOR_THRESHOLD),
    headers: readHeaders(env.AIGC_DETECTOR_HEADERS_JSON),
    requestTextField: readOptionalString(env.AIGC_DETECTOR_REQUEST_TEXT_FIELD),
    segment: {
      maxChars: readPositiveInteger(env.AIGC_DETECTOR_SEGMENT_MAX_CHARS),
      minChars: readPositiveInteger(env.AIGC_DETECTOR_SEGMENT_MIN_CHARS),
    },
    gradio: {
      fnIndex: readInteger(env.AIGC_DETECTOR_GRADIO_FN_INDEX),
      sessionHash: readOptionalString(env.AIGC_DETECTOR_GRADIO_SESSION_HASH),
      joinUrl: readOptionalString(env.AIGC_DETECTOR_GRADIO_JOIN_URL),
      dataUrl: readOptionalString(env.AIGC_DETECTOR_GRADIO_DATA_URL),
      skipJoin: env.AIGC_DETECTOR_GRADIO_SKIP_JOIN === "1",
      inputs: readJsonArray(env.AIGC_DETECTOR_GRADIO_INPUTS_JSON),
    },
  }
}

export function getAigcDetectorConfig(rootDir?: string): AigcDetectionConfig {
  if (!rootDir) {
    return getAigcDetectorConfigFromEnv()
  }
  try {
    const settingsEnv = readAigcSettingsEnv(rootDir)
    return getAigcDetectorConfigFromEnv({ ...process.env, ...settingsEnv })
  } catch {
    return getAigcDetectorConfigFromEnv()
  }
}

export async function getAigcDetectorConfigFromSettings(rootDir: string): Promise<AigcDetectionConfig> {
  const settingsEnv = await readAigcSettingsEnvAsync(rootDir)
  return getAigcDetectorConfigFromEnv({ ...process.env, ...settingsEnv })
}

export function createAigcDetectorClient(config: AigcDetectionConfig = getAigcDetectorConfigFromEnv()) {
  return {
    config,
    detectText(input: string | AigcDetectionInput, override?: AigcDetectionConfig) {
      return detectAigcText(input, mergeAigcDetectorConfig(config, override))
    },
    detectSegments(input: string | AigcDetectionInput | AigcTextSegment[], override?: AigcDetectionConfig) {
      return detectAigcSegments(input, mergeAigcDetectorConfig(config, override))
    },
    splitText(text: string, options?: AigcDetectorSegmentOptions) {
      return splitAigcTextIntoSegments(text, options ?? config.segment)
    },
  }
}

export async function detectAigcText(
  input: string | AigcDetectionInput,
  config: AigcDetectionConfig = getAigcDetectorConfigFromEnv(),
): Promise<AigcDetectionResult> {
  const provider = config.provider ?? "disabled"
  const text = typeof input === "string" ? input : input.text

  if (provider === "disabled") {
    return unavailableResult(provider, "AIGC detector is disabled.", null)
  }

  if (!text.trim()) {
    return unavailableResult(provider, "AIGC detector received empty text.", null)
  }

  if (!config.url?.trim()) {
    return unavailableResult(provider, "AIGC detector URL is not configured.", null)
  }

  try {
    if (provider === "generic-json") {
      return await detectWithGenericJson(text, config)
    }
    if (provider === "gradio-queue") {
      return await detectWithGradioQueue(text, config)
    }
    return unavailableResult(provider, `Unsupported AIGC detector provider: ${String(provider)}`, null)
  } catch (error) {
    if (config.throwOnError) {
      throw error
    }
    return unavailableResult(provider, error instanceof Error ? error.message : String(error), null)
  }
}

export async function detectAigcSegments(
  input: string | AigcDetectionInput | AigcTextSegment[],
  config: AigcDetectionConfig = getAigcDetectorConfigFromEnv(),
): Promise<AigcBatchDetectionResult> {
  const provider = config.provider ?? "disabled"
  const threshold = config.threshold ?? DEFAULT_THRESHOLD
  const segments = Array.isArray(input)
    ? input
    : splitAigcTextIntoSegments(typeof input === "string" ? input : input.text, config.segment)
  const results: AigcSegmentDetectionResult[] = []

  for (const segment of segments) {
    const result = await detectAigcText(segment, config)
    results.push({
      ...result,
      segment,
      charCount: segment.text.length,
    })
  }

  const scoredResults = results.filter((result) => typeof result.score === "number")
  const totalChars = scoredResults.reduce((sum, result) => sum + Math.max(1, result.charCount), 0)
  const score = totalChars > 0
    ? scoredResults.reduce((sum, result) => sum + Number(result.score) * Math.max(1, result.charCount), 0) / totalChars
    : null
  const highRiskSegments = results
    .filter((result) => result.status === "ai_likely" || (typeof result.score === "number" && result.score >= threshold))
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))

  const failedResults = results.filter((result) => !result.ok)

  return {
    ok: results.some((result) => result.ok),
    provider,
    status: score === null ? "unavailable" : scoreToStatus(score, threshold),
    score,
    confidence: score === null ? null : Math.max(score, 1 - score),
    threshold,
    totalSegments: segments.length,
    highRiskSegments,
    segments: results,
    reason: highRiskSegments.length > 0
      ? `${highRiskSegments.length} segment(s) reached the AIGC risk threshold.`
      : failedResults.length > 0
        ? `AIGC detection failed: ${Array.from(new Set(failedResults.map((r) => r.reason))).join("; ")}`
        : "Segmented AIGC detection completed.",
  }
}

export function splitAigcTextIntoSegments(text: string, options: AigcDetectorSegmentOptions = {}): AigcTextSegment[] {
  const maxChars = Math.max(120, options.maxChars ?? DEFAULT_SEGMENT_MAX_CHARS)
  const minChars = Math.max(1, Math.min(options.minChars ?? DEFAULT_SEGMENT_MIN_CHARS, maxChars))
  const paragraphs = collectParagraphs(text)
  const pieces = paragraphs.flatMap((paragraph) => splitLongParagraph(paragraph, maxChars))
  const segments: AigcTextSegment[] = []
  let pending: Omit<AigcTextSegment, "index" | "id"> | null = null

  for (const piece of pieces) {
    if (!pending) {
      pending = { text: piece.text, startOffset: piece.startOffset, endOffset: piece.endOffset, metadata: piece.metadata }
      continue
    }

    const joinedLength = pending.text.length + 1 + piece.text.length
    if (pending.text.length < minChars || joinedLength <= maxChars) {
      pending = {
        ...pending,
        text: `${pending.text}\n${piece.text}`,
        endOffset: piece.endOffset,
      }
      continue
    }

    segments.push({ ...pending, index: segments.length, id: `segment-${segments.length + 1}` })
    pending = { text: piece.text, startOffset: piece.startOffset, endOffset: piece.endOffset, metadata: piece.metadata }
  }

  if (pending) {
    segments.push({ ...pending, index: segments.length, id: `segment-${segments.length + 1}` })
  }

  return segments
}

export function parseAigcDetectorSse(payload: string): ServerSentEvent[] {
  const events: ServerSentEvent[] = []
  let eventName: string | undefined
  const dataLines: string[] = []

  for (const rawLine of payload.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd()
    if (!line) {
      if (dataLines.length > 0 || eventName) {
        events.push({ event: eventName, data: dataLines.join("\n") })
      }
      eventName = undefined
      dataLines.length = 0
      continue
    }
    if (line.startsWith(":")) {
      continue
    }
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim()
      continue
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart())
    }
  }

  if (dataLines.length > 0 || eventName) {
    events.push({ event: eventName, data: dataLines.join("\n") })
  }

  return events
}

function mergeAigcDetectorConfig(base: AigcDetectionConfig, override: AigcDetectionConfig = {}): AigcDetectionConfig {
  return {
    ...base,
    ...override,
    headers: { ...base.headers, ...override.headers },
    segment: { ...base.segment, ...override.segment },
    gradio: { ...base.gradio, ...override.gradio },
  }
}

async function detectWithGenericJson(text: string, config: AigcDetectionConfig): Promise<AigcDetectionResult> {
  const response = await requestWithTimeout(config.url ?? "", {
    method: "POST",
    headers: createHeaders(config, "application/json"),
    body: JSON.stringify({ [config.requestTextField || "text"]: text }),
  }, config)
  const raw = await readResponseBody(response)
  if (!response.ok) {
    return unavailableResult("generic-json", `Detector returned HTTP ${response.status}.`, raw)
  }
  return normalizeAigcDetectionResult(raw, "generic-json", config.threshold)
}

async function detectWithGradioQueue(text: string, config: AigcDetectionConfig): Promise<AigcDetectionResult> {
  const rootUrl = normalizeGradioRootUrl(config.url ?? "")
  const sessionHash = config.gradio?.sessionHash || createSessionHash()
  const joinUrl = config.gradio?.joinUrl || `${rootUrl}/gradio_api/queue/join${formatTokenQuery(config.token)}`
  const dataUrl = config.gradio?.dataUrl || `${rootUrl}/gradio_api/queue/data?session_hash=${encodeURIComponent(sessionHash)}${formatStudioTokenParam(config.token)}`

  if (!config.gradio?.skipJoin) {
    const joinPayload = {
      data: createGradioInputs(text, config.gradio?.inputs),
      event_data: null,
      fn_index: config.gradio?.fnIndex ?? 0,
      session_hash: sessionHash,
    }
    const joinResponse = await requestWithTimeout(joinUrl, {
      method: "POST",
      headers: createHeaders(config, "application/json"),
      body: JSON.stringify(joinPayload),
    }, config)
    const joinRaw = await readResponseBody(joinResponse)
    if (!joinResponse.ok) {
      return unavailableResult("gradio-queue", `Gradio detector join returned HTTP ${joinResponse.status}.`, joinRaw)
    }
  }

  const dataResponse = await requestWithTimeout(dataUrl, {
    method: "GET",
    headers: createHeaders(config, undefined, { accept: "text/event-stream" }),
  }, config)
  const rawText = await dataResponse.text()
  if (!dataResponse.ok) {
    return unavailableResult("gradio-queue", `Gradio detector stream returned HTTP ${dataResponse.status}.`, rawText)
  }

  const raw = extractGradioQueueOutput(parseAigcDetectorSse(rawText))
  return normalizeAigcDetectionResult(raw, "gradio-queue", config.threshold)
}

async function requestWithTimeout(url: string, init: RequestInit, config: AigcDetectionConfig): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    return await (config.fetchImpl ?? fetch)(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  const body = await response.text()
  if (!body.trim()) {
    return null
  }
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

function normalizeAigcDetectionResult(raw: unknown, provider: AigcDetectorProvider, threshold = DEFAULT_THRESHOLD): AigcDetectionResult {
  const score = findScore(raw)
  const label = findStringField(raw, ["label", "status", "result", "prediction", "class", "message"]) || inferLabel(raw)
  const normalizedScore = normalizeScore(score)
  const status = statusFromLabel(label) || (normalizedScore === null ? "uncertain" : scoreToStatus(normalizedScore, threshold))
  const confidence = normalizeScore(findNumberField(raw, ["confidence", "probability", "prob"])) ?? (
    normalizedScore === null ? null : Math.max(normalizedScore, 1 - normalizedScore)
  )

  return {
    ok: normalizedScore !== null || status !== "unavailable",
    provider,
    status,
    score: normalizedScore,
    label: label || status,
    confidence,
    raw,
    reason: normalizedScore === null
      ? "Detector response did not include a normalized score; status was inferred from labels."
      : "Detector response normalized.",
  }
}

function unavailableResult(provider: AigcDetectorProvider, reason: string, raw: unknown): AigcDetectionResult {
  return {
    ok: false,
    provider,
    status: "unavailable",
    score: null,
    label: "unavailable",
    confidence: null,
    raw,
    reason,
  }
}

function scoreToStatus(score: number, threshold: number): AigcDetectionStatus {
  if (score >= threshold) {
    return "ai_likely"
  }
  if (score <= 1 - threshold) {
    return "human_likely"
  }
  return "uncertain"
}

function createHeaders(config: AigcDetectionConfig, contentType?: string, extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...config.headers, ...extra }
  if (contentType) {
    headers["content-type"] = contentType
  }
  if (config.token && !headers.authorization) {
    headers.authorization = `Bearer ${config.token}`
  }
  return headers
}

function collectParagraphs(text: string): AigcTextSegment[] {
  const paragraphs: AigcTextSegment[] = []
  const pattern = /\S[^\n]*(?:\n(?!\s*\n)\S[^\n]*)*/g
  for (const match of text.matchAll(pattern)) {
    const value = match[0].trim()
    if (!value) {
      continue
    }
    const leadingWhitespace = match[0].length - match[0].trimStart().length
    const startOffset = (match.index ?? 0) + leadingWhitespace
    paragraphs.push({
      id: `paragraph-${paragraphs.length + 1}`,
      index: paragraphs.length,
      text: value,
      startOffset,
      endOffset: startOffset + value.length,
    })
  }
  return paragraphs
}

function splitLongParagraph(segment: AigcTextSegment, maxChars: number): AigcTextSegment[] {
  if (segment.text.length <= maxChars) {
    return [segment]
  }

  const fragments = segment.text.match(/[^。！？!?；;]+[。！？!?；;]?|.+/g) || [segment.text]
  const pieces: AigcTextSegment[] = []
  let pending = ""
  let pendingStart = segment.startOffset
  let searchOffset = 0

  for (const fragment of fragments) {
    const localIndex = segment.text.indexOf(fragment, searchOffset)
    const fragmentStart = segment.startOffset + Math.max(0, localIndex)
    searchOffset = Math.max(searchOffset, localIndex + fragment.length)

    if (!pending) {
      pending = fragment
      pendingStart = fragmentStart
      continue
    }

    if (pending.length + fragment.length <= maxChars) {
      pending += fragment
      continue
    }

    pieces.push({
      id: `segment-piece-${pieces.length + 1}`,
      index: pieces.length,
      text: pending.trim(),
      startOffset: pendingStart,
      endOffset: pendingStart + pending.trim().length,
    })
    pending = fragment
    pendingStart = fragmentStart
  }

  if (pending.trim()) {
    pieces.push({
      id: `segment-piece-${pieces.length + 1}`,
      index: pieces.length,
      text: pending.trim(),
      startOffset: pendingStart,
      endOffset: pendingStart + pending.trim().length,
    })
  }

  return pieces.flatMap((piece) => hardSplitSegment(piece, maxChars))
}

function hardSplitSegment(segment: AigcTextSegment, maxChars: number): AigcTextSegment[] {
  if (segment.text.length <= maxChars) {
    return [segment]
  }
  const pieces: AigcTextSegment[] = []
  for (let offset = 0; offset < segment.text.length; offset += maxChars) {
    const text = segment.text.slice(offset, offset + maxChars)
    pieces.push({
      id: `segment-hard-${pieces.length + 1}`,
      index: pieces.length,
      text,
      startOffset: segment.startOffset + offset,
      endOffset: segment.startOffset + offset + text.length,
    })
  }
  return pieces
}

function extractGradioQueueOutput(events: ServerSentEvent[]): unknown {
  const parsedEvents = events
    .map((event): any => parseJson(event.data) ?? event.data)
    .filter((event) => event !== "")
  const completed = [...parsedEvents].reverse().find((event) =>
    isRecord(event) && (event.msg === "process_completed" || event.output || event.success === true)
  )
  if (isRecord(completed) && "output" in completed) {
    const output = completed.output
    if (isRecord(output) && "data" in output) {
      return output.data
    }
    return output
  }
  return completed ?? parsedEvents.at(-1) ?? null
}

function createGradioInputs(text: string, inputs: unknown[] | undefined): unknown[] {
  if (!inputs || inputs.length === 0) {
    return [text]
  }
  return inputs.map((input) => input === "$text" ? text : input)
}

function normalizeGradioRootUrl(url: string): string {
  const parsed = new URL(url)
  const queueIndex = parsed.pathname.indexOf("/gradio_api/")
  if (queueIndex >= 0) {
    parsed.pathname = parsed.pathname.slice(0, queueIndex)
    parsed.search = ""
  }
  return parsed.toString().replace(/\/$/, "")
}

function formatTokenQuery(token: string | undefined): string {
  return token ? `?studio_token=${encodeURIComponent(token)}` : ""
}

function formatStudioTokenParam(token: string | undefined): string {
  return `&studio_token=${encodeURIComponent(token || "")}`
}

function createSessionHash(): string {
  return Math.random().toString(36).slice(2, 14)
}

function findScore(raw: unknown): number | null {
  return findNumberField(raw, [
    "score",
    "aiProbability",
    "aigcProbability",
    "ai_probability",
    "aigc_probability",
    "aiProb",
    "aigcProb",
    "ai_score",
    "aigc_score",
    "fakeProbability",
  ]) ?? parseScoreFromText(raw)
}

function findNumberField(raw: unknown, names: string[]): number | null {
  const queue: unknown[] = [raw]
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()))
  while (queue.length > 0) {
    const value = queue.shift()
    if (Array.isArray(value)) {
      queue.push(...value)
      continue
    }
    if (!isRecord(value)) {
      continue
    }
    for (const [key, child] of Object.entries(value)) {
      if (normalizedNames.has(key.toLowerCase())) {
        const number = typeof child === "number" ? child : typeof child === "string" ? Number(child) : NaN
        if (Number.isFinite(number)) {
          return number
        }
      }
      if (isRecord(child) || Array.isArray(child)) {
        queue.push(child)
      }
    }
  }
  return null
}

function findStringField(raw: unknown, names: string[]): string {
  const queue: unknown[] = [raw]
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()))
  while (queue.length > 0) {
    const value = queue.shift()
    if (Array.isArray(value)) {
      queue.push(...value)
      continue
    }
    if (!isRecord(value)) {
      continue
    }
    for (const [key, child] of Object.entries(value)) {
      if (normalizedNames.has(key.toLowerCase()) && (typeof child === "string" || typeof child === "number")) {
        return String(child)
      }
      if (isRecord(child) || Array.isArray(child)) {
        queue.push(child)
      }
    }
  }
  return ""
}

function inferLabel(raw: unknown): string {
  if (typeof raw === "string") {
    return raw.slice(0, 120)
  }
  if (Array.isArray(raw)) {
    const text = raw.find((item) => typeof item === "string")
    return typeof text === "string" ? text.slice(0, 120) : ""
  }
  return ""
}

function statusFromLabel(label: string): AigcDetectionStatus | null {
  const normalized = label.toLowerCase()
  if (!normalized) {
    return null
  }
  if (/human|人工|人类|真人|非ai|非机器/.test(normalized)) {
    return "human_likely"
  }
  if (/\bai\b|aigc|机器|模型|生成|疑似ai|ai生成/.test(normalized)) {
    return "ai_likely"
  }
  if (/uncertain|unknown|不确定|无法判断/.test(normalized)) {
    return "uncertain"
  }
  return null
}

function parseScoreFromText(raw: unknown): number | null {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw)
  const percentMatch = text.match(/(?:AI|AIGC|机器|生成|疑似)[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)\s*%/i)
  if (percentMatch) {
    return Number(percentMatch[1]) / 100
  }
  const decimalMatch = text.match(/(?:AI|AIGC|机器|生成|疑似)[^0-9]{0,12}(0?\.[0-9]+)/i)
  return decimalMatch ? Number(decimalMatch[1]) : null
}

function normalizeScore(score: number | null): number | null {
  if (score === null || !Number.isFinite(score)) {
    return null
  }
  if (score > 1 && score <= 100) {
    return score / 100
  }
  return Math.min(1, Math.max(0, score))
}

function readProvider(value: string | undefined): AigcDetectorProvider {
  if (value === "generic-json" || value === "gradio-queue" || value === "disabled") {
    return value
  }
  return "disabled"
}

function readOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function readInteger(value: string | undefined): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : undefined
}

function readPositiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function readScore(value: string | undefined): number | undefined {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return undefined
  }
  return normalizeScore(parsed) ?? undefined
}

function readHeaders(value: string | undefined): Record<string, string> | undefined {
  const parsed = parseJson(value || "")
  if (!isRecord(parsed)) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(parsed)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
}

function readJsonArray(value: string | undefined): unknown[] | undefined {
  const parsed = parseJson(value || "")
  return Array.isArray(parsed) ? parsed : undefined
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readAigcSettingsEnv(rootDir: string): Record<string, string | undefined> {
  const factoryRoot = inferAigcFactoryRoot(rootDir)
  try {
    const dbPath = path.join(factoryRoot, ".ai-novel-factory", "factory.sqlite")
    if (!fs.existsSync(dbPath)) {
      return {}
    }
    const sqlite = requireBuiltin("node:sqlite") as { DatabaseSync: new (path: string) => { prepare: (sql: string) => { all: () => Array<{ key: string; value: string }> }, close: () => void } }
    const db = new sqlite.DatabaseSync(dbPath)
    try {
      const rows = db.prepare("SELECT key, value FROM system_settings").all() as Array<{ key: string; value: string }>
      return aigcSettingsRowsToEnv(rows)
    } finally {
      db.close()
    }
  } catch {
    return {}
  }
}

async function readAigcSettingsEnvAsync(rootDir: string): Promise<Record<string, string | undefined>> {
  const factoryRoot = inferAigcFactoryRoot(rootDir)
  return withFactoryDb(factoryRoot, async (db) => aigcSettingsRowsToEnv(db.listSystemSettings())).catch(() => ({}))
}

function aigcSettingsRowsToEnv(rows: Array<{ key: string; value: string }>): Record<string, string | undefined> {
  const settings = new Map(rows.map((row) => [row.key, row.value]))
  const value = (key: string) => settings.get(key) || undefined
  return {
    AIGC_DETECTOR_PROVIDER: value(AIGC_SETTING_KEYS.provider),
    AIGC_DETECTOR_URL: value(AIGC_SETTING_KEYS.url),
    AIGC_DETECTOR_TOKEN: value(AIGC_SETTING_KEYS.token),
    AIGC_DETECTOR_TIMEOUT_MS: value(AIGC_SETTING_KEYS.timeoutMs),
    AIGC_DETECTOR_THRESHOLD: value(AIGC_SETTING_KEYS.threshold),
    AIGC_DETECTOR_HEADERS_JSON: value(AIGC_SETTING_KEYS.headersJson),
    AIGC_DETECTOR_REQUEST_TEXT_FIELD: value(AIGC_SETTING_KEYS.requestTextField),
    AIGC_DETECTOR_SEGMENT_MAX_CHARS: value(AIGC_SETTING_KEYS.segmentMaxChars),
    AIGC_DETECTOR_SEGMENT_MIN_CHARS: value(AIGC_SETTING_KEYS.segmentMinChars),
    AIGC_DETECTOR_GRADIO_FN_INDEX: value(AIGC_SETTING_KEYS.gradioFnIndex),
    AIGC_DETECTOR_GRADIO_SESSION_HASH: value(AIGC_SETTING_KEYS.gradioSessionHash),
    AIGC_DETECTOR_GRADIO_JOIN_URL: value(AIGC_SETTING_KEYS.gradioJoinUrl),
    AIGC_DETECTOR_GRADIO_DATA_URL: value(AIGC_SETTING_KEYS.gradioDataUrl),
    AIGC_DETECTOR_GRADIO_SKIP_JOIN: value(AIGC_SETTING_KEYS.gradioSkipJoin),
    AIGC_DETECTOR_GRADIO_INPUTS_JSON: value(AIGC_SETTING_KEYS.gradioInputsJson),
  }
}

function inferAigcWorkspaceRootFromManagedProject(rootDir: string) {
  const index = rootDir.indexOf(MANAGED_PROJECTS_SEGMENT)
  if (index < 0) {
    return null
  }
  return rootDir.slice(0, index) || path.parse(rootDir).root
}

function inferAigcFactoryRoot(rootDir: string) {
  const resolvedRootDir = path.resolve(rootDir)
  return inferAigcWorkspaceRootFromManagedProject(resolvedRootDir) || resolvedRootDir
}
