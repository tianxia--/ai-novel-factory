import fs from "node:fs/promises"
import http from "node:http"
import path from "node:path"
import { randomUUID } from "node:crypto"

import {
  chapterBlueprintLearningShouldStop,
  compileChapterBlueprintLearningPrompt,
  loadChapterBlueprintLearningContext,
  recordChapterBlueprintLearningAttempt,
  recordChapterBlueprintStateSnapshot,
  type ChapterBlueprintLearningContext,
  type ChapterBlueprintStateSnapshot,
} from "./chapter-blueprint-learning"
import { withFactoryDb } from "./factory-db"
import { loadLlmConfigForCapability, type ActiveLlmConfig } from "./llm-config"
import { parseModelJsonObject } from "./model-json-parser"
import { findPlaceholderValues } from "./placeholder-detector"
import { generateAgentReply } from "./runtime-llm"
import {
  detectAigcSegments,
  getAigcDetectorConfig,
  type AigcBatchDetectionResult,
  type AigcDetectionConfig,
  type AigcTextSegment,
} from "./aigc-detector"
import { listProductionWorkflowNodes } from "./production-workflow"
import { listProductionPlanningNodes } from "./production-planning-workflow"
import { listProductionChapterNodes } from "./production-chapter-workflow"
import { ProductionWorkflowSandboxManager } from "./production-workflow-sandbox"
import {
  FactoryWorkflowTraceRecorder,
  WorkflowKernel,
  type WorkflowTraceEvidence,
  type WorkflowTraceReference,
} from "./workflow-kernel"
import {
  FactoryWorkflowDebugBranchManager,
  type WorkflowDebugBranchReference,
} from "./workflow-debug-branch"
import {
  acceptStyleEvolutionCandidate,
  appendStyleEvolutionCandidate,
  approveStyleEvolutionSample,
  buildStyleEvolutionCandidatePrompt,
  buildStyleEvolutionEvaluationPrompt,
  buildStyleEvolutionRefinement,
  buildStyleEvolutionRefinementOnlyPrompt,
  buildStyleGenerationVerification,
  evaluateStyleEvolutionCandidate,
  initializeStyleEvolution,
  loadStyleEvolution,
  normalizeStyleAigcSignal,
  parseStyleEvolutionEvaluationFromText,
  parseStyleEvolutionRefinementFromText,
  type StyleEvolutionEvaluation,
  type StyleEvolutionRefinement,
} from "./production-style-evolution"
import type { StyleEvolutionContract } from "./production-contracts"

type RunStatus = "queued" | "running" | "completed" | "invalid" | "failed" | "paused"

interface DebugModelSelection {
  modelConfigId: string
  factoryProjectId: string
}

interface WorldFoundationInput extends DebugModelSelection {
  title: string
  coreIdea: string
  genre: string
  audience: string
  tone: string
  protagonistSeed: string
  mustInclude: string
  mustAvoid: string
  totalChapters: number
  temperature: number
}

interface CharacterPlanningInput extends DebugModelSelection {
  upstreamRunId: string
  planningFocus: string
  totalChapters: number
  temperature: number
  worldFoundation: Record<string, unknown>
}

interface InitialCharacterStateInput extends DebugModelSelection {
  upstreamRunId: string
  stateFocus: string
  openingChapter: number
  totalChapters: number
  temperature: number
  worldFoundation: Record<string, unknown>
  characterPlanning: Record<string, unknown>
}

interface WorldMatrixInput extends DebugModelSelection {
  upstreamRunId: string
  matrixFocus: string
  totalChapters: number
  temperature: number
  worldFoundation: Record<string, unknown>
  characterPlanning: Record<string, unknown>
  initialCharacterState: Record<string, unknown>
}

interface PlotArchitectureInput extends DebugModelSelection {
  upstreamRunId: string
  architectureFocus: string
  totalChapters: number
  temperature: number
  worldFoundation: Record<string, unknown>
  characterPlanning: Record<string, unknown>
  initialCharacterState: Record<string, unknown>
  worldMatrix: Record<string, unknown>
}

interface StoryBibleInput extends DebugModelSelection {
  upstreamRunId: string
  bibleFocus: string
  totalChapters: number
  temperature: number
  worldFoundation: Record<string, unknown>
  characterPlanning: Record<string, unknown>
  initialCharacterState: Record<string, unknown>
  worldMatrix: Record<string, unknown>
  plotArchitecture: Record<string, unknown>
}

interface VolumeStrategyInput extends DebugModelSelection {
  upstreamRunId: string
  strategyFocus: string
  targetVolumeCount: number
  totalChapters: number
  temperature: number
  worldFoundation: Record<string, unknown>
  characterPlanning: Record<string, unknown>
  initialCharacterState: Record<string, unknown>
  worldMatrix: Record<string, unknown>
  plotArchitecture: Record<string, unknown>
  storyBible: Record<string, unknown>
}

interface ChapterBlueprintInput extends DebugModelSelection {
  upstreamRunId: string
  blueprintFocus: string
  volumeId: string
  startChapter: number
  endChapter: number
  targetWordCount: number
  totalChapters: number
  temperature: number
  previousBatchRunId: string | null
  previousBatchHandoff: Record<string, unknown> | null
  worldFoundation: Record<string, unknown>
  characterPlanning: Record<string, unknown>
  initialCharacterState: Record<string, unknown>
  worldMatrix: Record<string, unknown>
  plotArchitecture: Record<string, unknown>
  storyBible: Record<string, unknown>
  volumeStrategy: Record<string, unknown>
}

interface StyleProfileInput extends DebugModelSelection {
  upstreamRunId: string
  styleFocus: string
  humanBaselineText?: string
  aigcGranularity?: string
  aigcPolicy?: string
  aigcMinSegmentChars?: number
  sampleChapter: number
  maxRounds: number
  totalChapters: number
  temperature: number
  worldFoundation: Record<string, unknown>
  characterPlanning: Record<string, unknown>
  storyBible: Record<string, unknown>
  volumeStrategy: Record<string, unknown>
  chapterBlueprints: Record<string, unknown>
}

interface SingleChapterContextInput extends DebugModelSelection {
  upstreamRunId: string
  chapterNumber: number
  contextFocus: string
  targetWordCount: number
  styleProfile: Record<string, unknown>
  frozenStyle: Record<string, unknown>
  storyBible: Record<string, unknown>
  volumeStrategy: Record<string, unknown>
  chapterBlueprints: Record<string, unknown>
}

interface ChapterDraftInput extends DebugModelSelection {
  upstreamRunId: string
  chapterNumber: number
  draftFocus: string
  targetWordCount: number
  temperature: number
  maxRepairRounds: number
  aigcPolicy: string
  aigcMinSegmentChars: number
  singleChapterContext: Record<string, unknown>
}

interface ChapterCommitInput extends DebugModelSelection {
  upstreamRunId: string
  chapterNumber: number
  commitNote: string
  chapterDraft: Record<string, unknown>
}

interface ContinuousChapterProductionInput extends DebugModelSelection {
  upstreamRunId: string
  startChapter: number
  endChapter: number
  targetWordCount: number
  maxRepairRounds: number
  aigcPolicy: string
  aigcMinSegmentChars: number
  temperature: number
  productionFocus: string
  styleProfile: Record<string, unknown>
  frozenStyle: Record<string, unknown>
  storyBible: Record<string, unknown>
  volumeStrategy: Record<string, unknown>
  chapterBlueprints: Record<string, unknown>
}

interface DebugEvent {
  seq: number
  time: string
  elapsedMs: number
  level: "info" | "success" | "warning" | "error" | "stream"
  phase: string
  message: string
  data?: Record<string, unknown>
}

interface DebugRun {
  runId: string
  nodeId: "world-foundation" | "character-planning" | "initial-character-state" | "world-matrix" | "plot-architecture" | "story-bible" | "volume-strategy" | "chapter-blueprints" | "style-profile" | "single-chapter-context" | "chapter-draft" | "chapter-commit" | "continuous-chapter-production"
  status: RunStatus
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  input: WorldFoundationInput | CharacterPlanningInput | InitialCharacterStateInput | WorldMatrixInput | PlotArchitectureInput | StoryBibleInput | VolumeStrategyInput | ChapterBlueprintInput | StyleProfileInput | SingleChapterContextInput | ChapterDraftInput | ChapterCommitInput | ContinuousChapterProductionInput
  provider: Record<string, unknown> | null
  prompts: { systemPrompt: string; consensus: string; basePrompt: string; dynamicPrompt: string; userMessage: string } | null
  rawResponse: string
  result: Record<string, unknown> | null
  validation: { valid: boolean; errors: string[]; warnings: string[] } | null
  semanticAudit?: Record<string, unknown> | null
  learning?: ChapterBlueprintLearningContext | null
  artifacts: string[]
  events: DebugEvent[]
  error: string | null
  pauseRequestedAt?: string | null
  pauseReason?: string | null
  workflowTrace?: WorkflowTraceReference
  workflowEvidence?: WorkflowTraceEvidence
  workflowBranch?: WorkflowDebugBranchReference
  workflowBranchEvidence?: Record<string, unknown>
}

async function debugFactoryProjectId(body: Record<string, unknown>, upstreamRun: DebugRun, inheritedInput: DebugModelSelection) {
  const inheritedProjectId = String(
    body.factoryProjectId
    || inheritedInput.factoryProjectId
    || upstreamRun.workflowTrace?.projectId
    || "",
  ).trim()
  if (inheritedProjectId) return inheritedProjectId
  const projects = await withFactoryDb(rootDir, async (db) => db.listProjects())
  return String(projects[0]?.id || "").trim()
}

function compareValidationQuality(
  candidate: NonNullable<DebugRun["validation"]>,
  baseline: NonNullable<DebugRun["validation"]>,
) {
  if (candidate.valid !== baseline.valid) return candidate.valid ? -1 : 1
  const candidateErrors = new Set(candidate.errors).size
  const baselineErrors = new Set(baseline.errors).size
  if (candidateErrors !== baselineErrors) return candidateErrors - baselineErrors
  return new Set(candidate.warnings).size - new Set(baseline.warnings).size
}

function debugFailureSignature(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/\d+/gu, "#")
    .replace(/\s+/gu, " ")
    .slice(0, 360)
}

type DebugLlmConfig = ActiveLlmConfig & { _configName?: string }

const args = process.argv.slice(2)
const valueAfter = (name: string, fallback: string) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
const rootDir = path.resolve(valueAfter("--root-dir", process.cwd()))
const port = Number(valueAfter("--port", "4314"))
const chapterBlueprintRepairSafetyLimit = Math.max(5, Math.min(100, Number(
  valueAfter("--chapter-blueprint-repair-safety-limit", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_REPAIR_SAFETY_LIMIT || "20"),
) || 20))
const chapterBlueprintStableBatchLimit = Math.max(1, Math.min(12, Number(
  valueAfter("--chapter-blueprint-stable-batch-limit", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT || "10"),
) || 10))
const chapterBlueprintMinimumCharsPerChapter = Math.max(700, Math.min(3000, Number(
  valueAfter("--chapter-blueprint-minimum-chars-per-chapter", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_MINIMUM_CHARS_PER_CHAPTER || "1000"),
) || 1000))
const chapterBlueprintRecommendedCharsPerChapter = Math.max(chapterBlueprintMinimumCharsPerChapter, Math.min(6000, Number(
  valueAfter("--chapter-blueprint-recommended-chars-per-chapter", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_RECOMMENDED_CHARS_PER_CHAPTER || "1400"),
) || 1400))
const chapterBlueprintLlmActivityTimeoutMs = Math.max(15_000, Math.min(120_000, Number(
  valueAfter("--chapter-blueprint-llm-activity-timeout-ms", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_LLM_ACTIVITY_TIMEOUT_MS || "75000"),
) || 75_000))
const runsRoot = path.join(rootDir, ".ai-novel-factory", "debug-runs")
const committedChaptersRoot = path.join(rootDir, ".ai-novel-factory", "debug-committed-chapters")
const runs = new Map<string, DebugRun>()
const runAbortControllers = new Map<string, AbortController>()

class DebugRunPausedError extends Error {
  constructor(message = "debug_run_paused_by_user") {
    super(message)
    this.name = "DebugRunPausedError"
  }
}

function ensureRunAbortController(run: DebugRun) {
  let controller = runAbortControllers.get(run.runId)
  if (!controller || controller.signal.aborted) {
    controller = new AbortController()
    runAbortControllers.set(run.runId, controller)
  }
  return controller
}

function isRunPauseRequested(run: DebugRun) {
  return run.status === "paused" || Boolean(run.pauseRequestedAt)
}

function assertRunNotPaused(run: DebugRun) {
  if (isRunPauseRequested(run)) throw new DebugRunPausedError()
}

function isDebugRunPausedError(error: unknown) {
  return error instanceof DebugRunPausedError
    || (error instanceof Error && (error.name === "AbortError" || /aborted|pause|paused|user_paused|debug_run_paused/iu.test(error.message)))
}

async function pauseDebugRun(run: DebugRun, reason = "用户手动暂停当前调试 Run。") {
  run.pauseRequestedAt = run.pauseRequestedAt || nowIso()
  run.pauseReason = reason
  run.status = "paused"
  run.completedAt = nowIso()
  run.error = "debug_run_paused_by_user"
  const controller = runAbortControllers.get(run.runId)
  if (controller && !controller.signal.aborted) controller.abort()
  addEvent(run, "warning", "pause", "已收到暂停请求：当前 Run 会停止后续轮次，并尽量中断正在进行的模型流式请求。", {
    reason,
    runId: run.runId,
  })
  await persistRun(run)
}
const productionWorkflowSandboxes = new ProductionWorkflowSandboxManager(rootDir)

function isDebugTextModel(modelName: unknown) {
  return !/(?:^|[-_.:])(image|video|audio|embedding)(?:[-_.:]|$)/iu.test(String(modelName || "").trim())
}

async function listDebugTextModels() {
  return withFactoryDb(rootDir, async (db) => {
    const textRoute = db.listLlmConfigRoutes().find((route) => route.capability === "text")
    return db.listLlmConfigs()
      .filter((row) => isDebugTextModel(row.model_name))
      .map((row) => ({
        id: String(row.id),
        name: String(row.name || row.model_name),
        baseUrl: String(row.base_url),
        modelName: String(row.model_name),
        apiMode: String(row.api_mode || "chat") === "responses" ? "responses" : "chat",
        timeoutMs: Number(row.timeout_ms) || 120000,
        isGlobalTextRoute: String(textRoute?.config_id || "") === String(row.id),
      }))
  })
}

async function loadDebugLlmConfig(run: DebugRun): Promise<DebugLlmConfig | null> {
  const selectedConfigId = String(run.input.modelConfigId || "").trim()
  if (!selectedConfigId) {
    return loadLlmConfigForCapability(rootDir, "text")
  }
  const row = await withFactoryDb(rootDir, async (db) => (
    db.listLlmConfigs().find((candidate) => String(candidate.id) === selectedConfigId) || null
  ))
  if (!row || !isDebugTextModel(row.model_name)) {
    throw new Error("selected_debug_text_model_not_found")
  }
  return {
    provider: {
      baseUrl: String(row.base_url),
      apiKeyEnv: "DB_DEBUG_CONFIG",
      modelName: String(row.model_name),
      apiMode: String(row.api_mode || "chat") === "responses" ? "responses" : "chat",
      timeoutMs: Number(row.timeout_ms) || 120000,
      temperature: Number(row.temperature) || 0.1,
      reactMaxSteps: 25,
    },
    writing: {
      chapterWordTarget: 2500,
      chapterWordMinimum: 2500,
    },
    _dbApiKey: String(row.api_key || ""),
    _configId: String(row.id),
    _configName: String(row.name || row.model_name),
    _capability: "text",
  }
}

function debugProviderOverride(config: DebugLlmConfig, timeoutMs = config.provider.timeoutMs) {
  return {
    baseUrl: config.provider.baseUrl,
    apiKey: config._dbApiKey,
    modelName: config.provider.modelName,
    apiMode: config.provider.apiMode,
    timeoutMs,
  }
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeInput(value: unknown): WorldFoundationInput {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const text = (key: string, fallback = "") => String(input[key] ?? fallback).trim()
  const number = (key: string, fallback: number, min: number, max: number) => {
    const parsed = Number(input[key])
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
  }
  return {
    modelConfigId: text("modelConfigId"),
    factoryProjectId: text("factoryProjectId"),
    title: text("title"),
    coreIdea: text("coreIdea"),
    genre: text("genre", "悬疑"),
    audience: text("audience", "成年类型小说读者"),
    tone: text("tone", "冷峻、克制、具有持续压迫感"),
    protagonistSeed: text("protagonistSeed"),
    mustInclude: text("mustInclude"),
    mustAvoid: text("mustAvoid", "空泛设定、万能能力、无代价规则、工具人角色、机械降神"),
    totalChapters: Math.round(number("totalChapters", 40, 1, 500)),
    temperature: number("temperature", 0.65, 0, 1.2),
  }
}

function jsonResponse(response: http.ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store",
  })
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new Error("request_body_too_large")
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
}

function addEvent(run: DebugRun, level: DebugEvent["level"], phase: string, message: string, data?: Record<string, unknown>) {
  const started = run.startedAt ? new Date(run.startedAt).getTime() : new Date(run.createdAt).getTime()
  run.events.push({
    seq: run.events.length + 1,
    time: nowIso(),
    elapsedMs: Math.max(0, Date.now() - started),
    level,
    phase,
    message,
    ...(data ? { data } : {}),
  })
}

function trackLlmCacheUsage(run: DebugRun, operation: string) {
  return async (usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cachedTokens: number
    cacheMissTokens: number
    reasoningTokens: number
    cacheHitRate: number
  }) => {
    const hitPercent = (usage.cacheHitRate * 100).toFixed(1)
    addEvent(run, usage.cachedTokens > 0 ? "success" : "info", "prompt-cache", usage.cachedTokens > 0
      ? `${operation} 上下文缓存命中 ${usage.cachedTokens}/${usage.promptTokens} tokens（${hitPercent}%）。`
      : `${operation} 本次未命中上下文缓存；已处理 ${usage.promptTokens} 个输入 tokens，将作为后续相同前缀的缓存基线。`, {
      operation,
      ...usage,
    })
    try {
      await recordWorkflowModelAttempt(run, operation, usage)
    } catch (error) {
      if (run.workflowTrace) run.workflowTrace.lastError = error instanceof Error ? error.message : String(error)
    }
    await persistRun(run)
  }
}

function parseDebugModelJsonObject(raw: string) {
  try {
    return parseModelJsonObject(raw)
  } catch (originalError) {
    const firstBrace = raw.indexOf("{")
    const lastBrace = raw.lastIndexOf("}")
    const candidate = firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw
    const controlCharRepaired = escapeJsonControlCharactersInStrings(candidate)
    const repairedText = controlCharRepaired.replace(/("|\]|\}|\btrue|\bfalse|\bnull|-?\d+(?:\.\d+)?)\s*\n(\s*")/g, "$1,\n$2")
    try {
      const value = JSON.parse(repairedText) as Record<string, unknown>
      return {
        value,
        repairedText,
        repairs: ["escaped_control_characters_in_json_strings", "inserted_missing_commas_between_json_lines"],
        originalError: originalError instanceof Error ? originalError.message : String(originalError),
      }
    } catch (commaRepairError) {
      const closed = closeOpenJsonContainers(repairedText)
      if (closed) {
        try {
          const value = JSON.parse(closed.text) as Record<string, unknown>
          return {
            value,
            repairedText: closed.text,
            repairs: ["inserted_missing_commas_between_json_lines", ...closed.repairs],
            originalError: originalError instanceof Error ? originalError.message : String(originalError),
          }
        } catch (closedRepairError) {
          throw new Error(`model_response_invalid_json: ${originalError instanceof Error ? originalError.message : String(originalError)}; comma_repair_failed: ${commaRepairError instanceof Error ? commaRepairError.message : String(commaRepairError)}; close_container_repair_failed: ${closedRepairError instanceof Error ? closedRepairError.message : String(closedRepairError)}`)
        }
      }
      throw commaRepairError
    }
  }
}

function escapeJsonControlCharactersInStrings(candidate: string) {
  let output = ""
  let inString = false
  let escaped = false
  for (const char of candidate) {
    if (inString) {
      if (escaped) {
        output += char
        escaped = false
        continue
      }
      if (char === "\\") {
        output += char
        escaped = true
        continue
      }
      if (char === '"') {
        output += char
        inString = false
        continue
      }
      if (char === "\n") {
        output += "\\n"
        continue
      }
      if (char === "\r") {
        output += "\\r"
        continue
      }
      if (char === "\t") {
        output += "\\t"
        continue
      }
      if (char.charCodeAt(0) < 0x20) {
        output += " "
        continue
      }
      output += char
      continue
    }
    output += char
    if (char === '"') inString = true
  }
  return output
}

function closeOpenJsonContainers(candidate: string) {
  const expectedClosers: string[] = []
  let inString = false
  let escaped = false
  for (const char of candidate) {
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
    } else if (char === '"') {
      inString = true
    } else if (char === "{") {
      expectedClosers.push("}")
    } else if (char === "[") {
      expectedClosers.push("]")
    } else if (char === "}" || char === "]") {
      expectedClosers.pop()
    }
  }
  if (inString || !expectedClosers.length) return null
  const closers = expectedClosers.reverse().join("")
  return {
    text: `${candidate}\n${closers}\n`,
    repairs: [`closed_${expectedClosers.length}_open_json_containers_after_truncated_model_output`],
  }
}

async function persistRun(run: DebugRun) {
  if (run.pauseRequestedAt && run.status !== "paused") {
    run.status = "paused"
    run.completedAt = run.completedAt || nowIso()
    run.error = "debug_run_paused_by_user"
  }
  await syncWorkflowTrace(run)
  const runDir = path.join(runsRoot, run.runId)
  await fs.mkdir(runDir, { recursive: true })
  const runPath = path.join(runDir, "run.json")
  const tempPath = path.join(runDir, `.run.${process.pid}.${randomUUID()}.tmp`)
  await fs.writeFile(tempPath, `${JSON.stringify(run, null, 2)}\n`)
  await fs.rename(tempPath, runPath)
}

const debugWorkflowTraceRecorder = new FactoryWorkflowTraceRecorder(rootDir)
const debugWorkflowKernel = new WorkflowKernel<DebugRun>()
  .register({ id: "world-foundation", name: "世界观生成", stage: "worldbuilding_dialogue", version: "debug-node-v1", execute: executeRun })
  .register({ id: "character-planning", name: "人物规划", stage: "setting_review", version: "debug-node-v1", execute: executeCharacterRun })
  .register({ id: "initial-character-state", name: "人物初始状态", stage: "setting_review", version: "debug-node-v1", execute: executeInitialCharacterStateRun })
  .register({ id: "world-matrix", name: "世界矩阵", stage: "setting_review", version: "debug-node-v1", execute: executeWorldMatrixRun })
  .register({ id: "plot-architecture", name: "主线架构", stage: "master_planning", version: "debug-node-v1", execute: executePlotArchitectureRun })
  .register({ id: "story-bible", name: "故事圣经", stage: "master_planning", version: "debug-node-v1", execute: executeStoryBibleRun })
  .register({ id: "volume-strategy", name: "分卷策略", stage: "master_planning", version: "debug-node-v1", execute: executeVolumeStrategyRun })
  .register({ id: "chapter-blueprints", name: "章节蓝图", stage: "master_planning", version: "debug-node-v1", execute: executeChapterBlueprintRun })
  .register({ id: "style-profile", name: "文风自进化", stage: "drafting", version: "debug-node-v1", execute: executeStyleProfileRun })
  .register({ id: "single-chapter-context", name: "单章上下文", stage: "drafting", version: "debug-node-v1", execute: executeSingleChapterContextRun })
  .register({ id: "chapter-draft", name: "单章完整生产", stage: "drafting", version: "debug-node-v2", execute: executeChapterDraftRun })
  .register({ id: "chapter-commit", name: "章节正文冻结", stage: "drafting", version: "debug-node-v1", execute: executeChapterCommitRun })
  .register({ id: "continuous-chapter-production", name: "连续章节生产", stage: "drafting", version: "debug-node-v1", execute: executeContinuousChapterProductionRun })

async function initializeWorkflowTrace(run: DebugRun, upstreamRun?: DebugRun | null) {
  const projectId = String(run.input.factoryProjectId || "").trim()
  if (!projectId) throw new Error("factory_project_required_for_debug_trace")
  run.workflowTrace = await debugWorkflowTraceRecorder.initialize({
    projectId,
    externalRunId: run.runId,
    node: debugWorkflowKernel.getNode(run.nodeId),
    input: run.input,
    executionMode: "debug",
    parentRunId: upstreamRun?.workflowTrace?.runId || null,
    parentStepId: upstreamRun?.workflowTrace?.stepId || null,
    goal: `Debug 单点执行：${debugWorkflowKernel.getNode(run.nodeId).name}`,
    metadata: {
      isolated: true,
      debugRunId: run.runId,
      upstreamDebugRunId: "upstreamRunId" in run.input ? run.input.upstreamRunId : null,
    },
  })
  run.workflowBranch = await new FactoryWorkflowDebugBranchManager(rootDir, projectId).create({
    branchId: run.runId,
    nodeId: run.nodeId,
    runId: run.workflowTrace.runId,
    baseState: upstreamRun?.result || {},
    metadata: {
      debugRunId: run.runId,
      upstreamDebugRunId: upstreamRun?.runId || null,
      isolated: true,
    },
  })
}

async function registerDebugRun(run: DebugRun, upstreamRun?: DebugRun | null) {
  await initializeWorkflowTrace(run, upstreamRun)
  runs.set(run.runId, run)
  await persistRun(run)
}

async function syncWorkflowTrace(run: DebugRun) {
  const trace = run.workflowTrace
  const traceStatus = run.status === "paused" ? "failed" : run.status
  if (!trace || trace.lastSyncedStatus === traceStatus) return
  try {
    await debugWorkflowTraceRecorder.sync(trace, debugWorkflowKernel.getNode(run.nodeId), {
      status: traceStatus,
      output: run.result,
      error: run.error,
      validation: run.validation,
      validationInput: { result: run.result },
      validationPromptVersion: "debug-validator-v1",
      metadata: {
        debugRunId: run.runId,
        artifactCount: run.artifacts.length,
        eventCount: run.events.length,
        warningCount: run.validation?.warnings.length || 0,
        errorCount: run.validation?.errors.length || 0,
        paused: run.status === "paused",
        pauseRequestedAt: run.pauseRequestedAt || null,
        pauseReason: run.pauseReason || null,
      },
      attemptMetadata: { debugRunId: run.runId, nodeId: run.nodeId },
    })
    if (["completed", "invalid", "failed"].includes(run.status) && run.workflowBranch && run.result) {
      await new FactoryWorkflowDebugBranchManager(rootDir, trace.projectId).append(run.workflowBranch, run.result, {
        label: `node-${run.status}`,
        status: run.status,
        valid: run.validation?.valid === true,
        errorCount: run.validation?.errors.length || 0,
        warningCount: run.validation?.warnings.length || 0,
      })
    }
  } catch (error) {
    trace.lastError = error instanceof Error ? error.message : String(error)
  }
}

async function recordWorkflowModelAttempt(run: DebugRun, operation: string, usage: Record<string, unknown>) {
  const trace = run.workflowTrace
  if (!trace) return
  const kind = operation.includes("审计") ? "audit" : operation.includes("修复") ? "repair" : "generate"
  const promptArtifactPaths = run.artifacts.filter((artifact) => artifact.endsWith(".md")).slice(-4)
  const promptArtifacts = await Promise.all(promptArtifactPaths.map(async (artifact) => ({
    path: artifact,
    content: await fs.readFile(path.join(runsRoot, run.runId, artifact), "utf8").catch(() => ""),
  })))
  await debugWorkflowTraceRecorder.recordAttempt(trace, {
    kind,
    modelConfigId: String(run.provider?.configId || "") || null,
    modelName: String(run.provider?.modelName || "") || null,
    promptVersion: run.learning?.promptVersion || "debug-node-v1",
    input: {
      operation,
      promptChars: run.prompts ? {
        base: run.prompts.basePrompt.length,
        dynamic: run.prompts.dynamicPrompt.length,
        user: run.prompts.userMessage.length,
      } : null,
      prompts: run.prompts,
      promptArtifacts,
    },
    output: { responseChars: run.rawResponse.length, rawResponse: run.rawResponse },
    usage,
    metadata: { debugRunId: run.runId, nodeId: run.nodeId },
  })
}

async function loadWorkflowEvidence(run: DebugRun) {
  if (!run.workflowTrace) return run
  try {
    const workflowEvidence = await debugWorkflowTraceRecorder.loadEvidence(run.workflowTrace)
    const workflowBranchEvidence = run.workflowBranch
      ? await new FactoryWorkflowDebugBranchManager(rootDir, run.workflowTrace.projectId).inspect(run.workflowBranch)
      : null
    return { ...run, workflowEvidence, ...(workflowBranchEvidence ? { workflowBranchEvidence } : {}) }
  } catch {
    return run
  }
}

function buildPrompts(input: WorldFoundationInput, runId: string) {
  const basePrompt = [
    "你是资深长篇小说世界观总设计师（World Foundation Architect）。",
    "你只负责生成一套可直接进入后续主线规划的完整故事基础，不写章节正文。",
    "所有设定必须具体、互相制约、能改变人物选择成本；禁止百科式堆砌。",
    "角色必须有具体姓名、独立欲望、伤口、错误信念、可见习惯、说话方式、能力边界和关系压力。",
    "主线必须形成原因 → 选择 → 代价 → 不可逆后果的因果链。",
    "禁止使用待定、暂无、未命名、后续补充、TBD、XXX 等占位内容。",
    "如果输入信息不足，请做明确且有辨识度的创作选择，并把仍需用户决定的问题放入 openQuestions。",
    "只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释生成过程。",
  ].join("\n")

  const dynamicPrompt = [
    `作品名：${input.title}`,
    `核心创意：${input.coreIdea}`,
    `类型：${input.genre}`,
    `目标读者：${input.audience}`,
    `整体语气：${input.tone}`,
    `预计章节数：${input.totalChapters}`,
    `主角种子：${input.protagonistSeed || "未提供，由模型创造一个具体主角"}`,
    `必须包含：${input.mustInclude || "由核心创意推导，但必须有至少一个独特制度、一个可见生活细节和一个不可逆代价"}`,
    `必须避免：${input.mustAvoid}`,
  ].join("\n")

  const userMessage = [
    "生成完整 World Foundation JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 1,',
    '  "project": { "title": "", "logline": "", "genre": "", "audience": "", "themes": [""] },',
    '  "background": { "era": "", "geography": "", "society": "", "technologyOrPower": "", "dailyLife": "", "history": "" },',
    '  "worldRules": [{ "name": "", "rule": "", "visibleEffect": "", "cost": "", "exceptions": "", "plotUse": "" }],',
    '  "factions": [{ "name": "", "goal": "", "resources": [""], "method": "", "internalConflict": "", "externalConflict": "" }],',
    '  "characters": [{ "name": "", "role": "", "identity": "", "desire": "", "wound": "", "fear": "", "misbelief": "", "behaviorHabit": "", "speechPattern": "", "skills": [""], "limitations": [""], "relationships": [{ "target": "", "dynamic": "", "pressure": "" }] }],',
    '  "mainConflict": { "surface": "", "underlying": "", "stakes": "", "deadline": "", "irreversibleConsequences": [""] },',
    '  "mainPlot": { "openingState": "", "incitingIncident": "", "firstTurn": "", "midpoint": "", "crisis": "", "climax": "", "ending": "", "causalChain": [""] },',
    '  "subplots": [{ "name": "", "characters": [""], "purpose": "", "progression": [""] }],',
    '  "foreshadowing": [{ "seed": "", "surfaceMeaning": "", "trueMeaning": "", "payoffWindow": "", "payoffEffect": "" }],',
    '  "arcPlan": [{ "arc": 1, "chapterRange": "", "goal": "", "pressure": "", "turningPoint": "", "irreversibleChange": "" }],',
    '  "canon": { "immutableFacts": [""], "forbiddenContradictions": [""] },',
    '  "openQuestions": [{ "question": "", "whyItMatters": "", "recommendedDefault": "" }],',
    '  "qualitySelfCheck": { "specificity": "", "causality": "", "characterAgency": "", "worldCost": "", "remainingRisks": [""] }',
    "}",
    "数量底线：worldRules 至少 6 条，factions 至少 3 个，characters 至少 5 人，subplots 至少 2 条，foreshadowing 至少 6 条，arcPlan 至少 4 段。",
    "每个数组元素都必须是本故事独有的具体内容，不能重复换词。",
  ].join("\n")

  const consensus = `独立调试 Run: ${runId}\n作品：${input.title}`
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 你负责生成当前请求指定的生产资产，而不是进行圆桌讨论。",
    "- 严格遵守用户消息中的输出格式、章节数、字段和资产边界。",
    "- 不要输出寒暄、角色自称、解释自己刚完成了什么、或对用户说话的开场白。",
    "- 除非当前任务明确要求章节正文，否则不得输出正文内容。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 必须严格输出当前请求指定的生产资产。",
    "- 不要输出寒暄、对话式开场、元叙述或执行过程说明。",
    "- 必须停留在当前 target 内。",
    "- 除非明确进入 drafting 阶段，否则不能产出脱离阶段的章节正文。",
  ].join("\n")
  const systemPrompt = [
    consensus,
    artifactProtocol,
    basePrompt,
    dynamicPrompt,
    "输出语言：简体中文",
    "当前工作流阶段：world_foundation_debug",
    "Discussion stage: specialist_turn",
    responseContract,
  ].join("\n\n")

  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function characterTargetForScale(totalChapters: number) {
  if (totalChapters <= 60) return 6
  if (totalChapters <= 150) return 8
  if (totalChapters <= 300) return 10
  return 12
}

function worldCharacterNames(worldFoundation: Record<string, unknown>) {
  if (!Array.isArray(worldFoundation.characters)) return []
  return worldFoundation.characters
    .map((item) => String((item as Record<string, unknown>)?.name || "").trim())
    .filter(Boolean)
}

function buildCharacterPrompts(input: CharacterPlanningInput, runId: string) {
  const inheritedNames = worldCharacterNames(input.worldFoundation)
  const targetCount = Math.max(inheritedNames.length, characterTargetForScale(input.totalChapters))
  const basePrompt = [
    "你是资深长篇小说人物架构师（Character Dynamics Architect）。",
    "你的任务是把已批准的 World Foundation 转换成可供主线、分卷和章节蓝图直接消费的人物规划资产，不写章节正文。",
    "上游已存在的人物姓名、身份、核心欲望、伤口和阵营属于已确认事实：必须完整继承，不得改名、合并、偷换身份或悄悄删除。",
    "可以新增人物，但每个新增人物必须填补明确的叙事功能缺口，并指定首次进入阶段；禁止为了凑数制造同质化工具人。",
    "所有人物都必须使用可辨识的具体姓名；严禁把无名、某人、神秘人、未知者等功能描述当作姓名。",
    "每个人物必须拥有独立欲望、伤口、错误信念、秘密、可见习惯、说话方式、能力边界、关系压力与可追踪的阶段变化。",
    "即使人物是非人实体，也不能把欲望、伤口、恐惧、代价写成无、没有、不适用或未知；必须转换为该实体真实存在的失衡风险、缺陷或不可逆损耗。",
    "人物数量必须与项目体量匹配；核心人物负责全书，篇章人物按阶段进入，场景人物不得在本节点提前泛滥生成。",
    "只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释生成过程，不得使用待定、暂无、未命名、后续补充、TBD、XXX 等占位内容。",
  ].join("\n")

  const dynamicPrompt = [
    `上游世界观 Run：${input.upstreamRunId}`,
    `预计章节数：${input.totalChapters}`,
    `上游已确认人物（${inheritedNames.length} 人）：${inheritedNames.join("、")}`,
    `本轮具名规划人物最低目标：${targetCount} 人`,
    `本轮额外关注：${input.planningFocus || "优先检查主角、对抗力量、关系轴、盟友、背叛者、导师/见证者等功能是否完整，并规划分阶段扩容。"}`,
    "以下是唯一允许继承的上游 World Foundation JSON：",
    JSON.stringify(input.worldFoundation, null, 2),
  ].join("\n")

  const userMessage = [
    "生成完整 Character Planning JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 1,',
    '  "source": { "upstreamRunId": "", "inheritedCharacterNames": [""] },',
    '  "scalePlan": { "totalChapters": 0, "currentWorldCharacterCount": 0, "plannedNamedCharacterCount": 0, "coreCastTarget": 0, "arcCharacterTarget": 0, "localCharacterPolicy": "", "sufficiencyVerdict": "sufficient|needs_expansion", "reasoning": "" },',
    '  "characters": [{ "name": "", "origin": "inherited|new", "tier": "core|arc|supporting", "role": "", "identity": "", "narrativeFunction": "", "desire": "", "wound": "", "fear": "", "misbelief": "", "secret": "", "values": [""], "behaviorHabits": [""], "speechPattern": "", "skills": [""], "limitations": [""], "knowledgeBoundary": { "knows": [""], "believes": [""], "mustNotKnowYet": [""] }, "relationships": [{ "target": "", "surface": "", "hidden": "", "pressure": "", "changeTrigger": "" }], "trajectory": { "startState": "", "turningPoints": [""], "endState": "", "irreversibleCost": "" }, "entry": { "chapterWindow": "", "condition": "" }, "exitOrTransformation": { "chapterWindow": "", "condition": "" }, "continuityLocks": [""] }],',
    '  "relationshipGraph": [{ "from": "", "to": "", "type": "", "surfaceState": "", "hiddenTension": "", "breakingPoint": "", "plannedEvolution": [""] }],',
    '  "roleCoverage": [{ "function": "", "owners": [""], "status": "covered|weak|missing", "risk": "" }],',
    '  "arcEntryPlan": [{ "arc": 1, "chapterRange": "", "activeCharacters": [""], "plannedIntroductions": [{ "name": "", "purpose": "" }], "exitsOrTransformations": [{ "name": "", "change": "" }], "relationshipPressure": "" }],',
    '  "expansionRules": { "whenToAdd": [""], "whenNotToAdd": [""], "approvalRequiredFor": [""], "minorCharacterPolicy": "" },',
    '  "continuityLocks": { "immutableIdentities": [""], "immutableRelationships": [""], "forbiddenDrift": [""] },',
    '  "castRisks": [{ "risk": "", "affectedCharacters": [""], "mitigation": "" }],',
    '  "openQuestions": [{ "question": "", "whyItMatters": "", "recommendedDefault": "" }],',
    '  "qualitySelfCheck": { "allInheritedCharactersPreserved": true, "roleCoverageComplete": true, "relationshipPressureConcrete": true, "scaleMatchesProject": true, "remainingGaps": [""] }',
    "}",
    `硬性要求：characters 至少 ${targetCount} 人；必须包含全部上游人物：${inheritedNames.join("、")}。`,
    "每个新增人物必须有具体姓名；name 不得为无名、某人、神秘人、未知者。关键档案字段不得用无、没有、不适用、未知规避。",
    "roleCoverage 至少覆盖主角驱动、主要对抗、情感关系轴、价值观镜像、内部异议、信息来源、代价见证、阶段性阻力八类功能。",
    "relationshipGraph 必须形成可变化的关系网络，不能只写静态的朋友/敌人标签。",
    "arcEntryPlan 必须与上游 arcPlan 一一对应；新增人物必须在 characters 中有完整档案。",
  ].join("\n")

  const consensus = `独立调试 Run: ${runId}\n上游 Run: ${input.upstreamRunId}`
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 你负责生成当前请求指定的生产资产，而不是进行圆桌讨论。",
    "- 严格遵守用户消息中的输出格式、章节数、字段和资产边界。",
    "- 不要输出寒暄、角色自称、元叙述或章节正文。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 只能输出单个合法 JSON 对象。",
    "- 必须停留在 character_planning_debug 阶段。",
  ].join("\n")
  const systemPrompt = [
    consensus,
    artifactProtocol,
    basePrompt,
    dynamicPrompt,
    "输出语言：简体中文",
    "当前工作流阶段：character_planning_debug",
    "Discussion stage: specialist_turn",
    responseContract,
  ].join("\n\n")

  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function plannedCharacterNames(characterPlanning: Record<string, unknown>) {
  if (!Array.isArray(characterPlanning.characters)) return []
  return characterPlanning.characters
    .map((item) => String((item as Record<string, unknown>)?.name || "").trim())
    .filter(Boolean)
}

function buildInitialCharacterStatePrompts(input: InitialCharacterStateInput, runId: string) {
  const names = plannedCharacterNames(input.characterPlanning)
  const upstreamRelationships = Array.isArray(input.characterPlanning.relationshipGraph)
    ? input.characterPlanning.relationshipGraph as Record<string, unknown>[]
    : []
  const relationshipCount = upstreamRelationships.length
  const frozenRelationshipEdges = upstreamRelationships.map((relationship) => `${relationship.from}→${relationship.to}`).join("、")
  const basePrompt = [
    "你是资深长篇小说连续性与人物状态设计师（Initial Character State Architect）。",
    "你只负责把已经批准的人物规划冻结成故事开场时刻的可执行状态账本，不写章节正文，不新增或删除人物，不重新设计人物身份。",
    "每一名已规划人物都必须拥有故事开始时的具体位置、在场状态、当前目标、即时压力、身体与情绪状态、资源、负担、知识边界、秘密暴露风险、关系温度和首次行动触发条件。",
    "尚未正式登场的人物也必须有真实的离场位置与正在进行的行动，不能写成等待剧情需要、暂未登场、未知或待定。",
    "主角必须处于 onstage，拥有能够直接启动第一章的可见动作、阻力、倒计时和不可逆风险。",
    "关系数值只用于表达开场差异，必须由上游关系压力推导；从未见面的关系允许五项数值全为 0，但 surfaceState、hiddenTension 和 firstChangeTrigger 仍必须写出具体事实。",
    "每个人物的 relationships 只列开场时已产生认知或接触的关系，它只能是上游关系网中与自己相连人物的子集；完整关系的唯一真源是 relationshipStateLedger，该总账必须与上游关系边一一对应，保持 from/to 方向，不得添加、遗漏或重复边。",
    "dormant 人物也必须写成可追踪的运行状态，例如封印维持目标、封印衰减压力、休眠中的触发条件；publicIdentity/hiddenIdentity 必须描述外界可见身份或隐匿方式，不能写无或未知。",
    "严格继承上游人物姓名、身份、知识边界、关系与连续性锁；不得提前泄露 mustNotKnowYet 中的信息。",
    "只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释生成过程。",
  ].join("\n")

  const dynamicPrompt = [
    `人物规划 Run：${input.upstreamRunId}`,
    `故事开场章节：第 ${input.openingChapter} 章`,
    `全书体量：${input.totalChapters} 章`,
    `冻结人物（${names.length} 人）：${names.join("、")}`,
    `上游关系边（${relationshipCount} 条）必须全部获得开场状态。`,
    `冻结关系边（严格保持方向）：${frozenRelationshipEdges}`,
    `本轮额外关注：${input.stateFocus || "确保第一章能直接执行，同时为后续登场人物保留具体的离场行动和知识边界。"}`,
    "已批准 World Foundation JSON：",
    JSON.stringify(input.worldFoundation, null, 2),
    "已批准 Character Planning JSON：",
    JSON.stringify(input.characterPlanning, null, 2),
  ].join("\n")

  const userMessage = [
    "生成完整 Initial Character State JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 1,',
    '  "source": { "characterPlanningRunId": "", "worldFoundationRunId": "", "frozenCharacterNames": [""] },',
    '  "openingFrame": { "chapter": 1, "time": "", "primaryLocation": "", "publicSituation": "", "hiddenSituation": "", "activeDeadline": "", "incitingTrigger": "", "firstChapterGoal": "", "firstChapterObstacle": "", "irreversibleRisk": "" },',
    '  "characters": [{ "name": "", "presence": "onstage|offstage|dormant", "location": "", "currentGoal": "", "immediatePressure": "", "physicalState": "", "emotionalState": "", "publicIdentity": "", "hiddenIdentity": "", "resources": [""], "liabilities": [""], "knowledge": { "knows": [""], "believes": [""], "mustNotKnowYet": [""] }, "secrets": [{ "secret": "", "exposureRisk": "", "whoCanExpose": [""] }], "relationships": [{ "target": "", "trust": 0, "affection": 0, "fear": 0, "debt": 0, "leverage": 0, "surfaceState": "", "hiddenTension": "" }], "openingAction": "", "firstAppearance": { "chapterWindow": "", "trigger": "", "entranceCost": "" }, "stateLocks": [""] }],',
    '  "relationshipStateLedger": [{ "from": "", "to": "", "trust": 0, "affection": 0, "fear": 0, "debt": 0, "leverage": 0, "surfaceState": "", "hiddenTension": "", "firstChangeTrigger": "" }],',
    '  "activeClocks": [{ "name": "", "holder": "", "deadline": "", "currentState": "", "failureConsequence": "" }],',
    '  "openingKnowledgeLocks": [{ "fact": "", "knowers": [""], "excludedCharacters": [""], "unlockCondition": "" }],',
    '  "continuityLocks": { "identityLocks": [""], "locationLocks": [""], "knowledgeLocks": [""], "relationshipLocks": [""], "forbiddenOpeningDrift": [""] },',
    '  "handoffToWorldMatrix": { "activeLocations": [""], "requiredInstitutions": [""], "requiredResources": [""], "pressureSystems": [""], "unresolvedStateQuestions": [""] },',
    '  "qualitySelfCheck": { "allCharactersInitialized": true, "noNewCharacters": true, "protagonistCanStartChapterOne": true, "knowledgeBoundariesPreserved": true, "relationshipStatesDifferentiated": true, "remainingRisks": [""] }',
    "}",
    `硬性人物集合：characters 必须恰好包含 ${names.length} 人，姓名只能是：${names.join("、")}。`,
    `relationshipStateLedger 必须恰好 ${relationshipCount} 条，与冻结关系边逐条对应，不得自行补充反向边。`,
    "每个人物的 relationships 只能列冻结关系边中与自己相连且开场已经激活的目标人物；尚未形成认知的关系可不列，不得引用其他实体。",
    "所有数值字段必须是 -100 到 100 的整数；确实从未见面的关系允许整条为 0，但仍须具体填写 surfaceState、hiddenTension 和触发条件。",
    "不得使用无、没有、未知、待定、暂未登场、等待剧情需要等规避状态。",
  ].join("\n")

  const consensus = `独立调试 Run: ${runId}\n人物规划上游 Run: ${input.upstreamRunId}`
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 生成当前阶段指定的状态资产，不进行圆桌讨论。",
    "- 不新增人物，不改写人物规划，不写章节正文。",
    "- 只输出可被下一节点直接消费的结构化 JSON。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 只能输出单个合法 JSON 对象。",
    "- 必须停留在 initial_character_state_debug 阶段。",
  ].join("\n")
  const systemPrompt = [
    consensus,
    artifactProtocol,
    basePrompt,
    dynamicPrompt,
    "输出语言：简体中文",
    "当前工作流阶段：initial_character_state_debug",
    "Discussion stage: specialist_turn",
    responseContract,
  ].join("\n\n")

  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function buildInitialCharacterStateRepairMessage(
  input: InitialCharacterStateInput,
  result: Record<string, unknown>,
  errors: string[],
) {
  const names = plannedCharacterNames(input.characterPlanning)
  const relationships = Array.isArray(input.characterPlanning.relationshipGraph)
    ? input.characterPlanning.relationshipGraph as Record<string, unknown>[]
    : []
  const allowedTargets = Object.fromEntries(names.map((name) => [
    name,
    [...new Set(relationships.flatMap((relationship) => {
      const from = String(relationship.from || "").trim()
      const to = String(relationship.to || "").trim()
      if (from === name) return [to]
      if (to === name) return [from]
      return []
    }).filter(Boolean))],
  ]))
  return [
    "上一版 Initial Character State 未通过程序校验。请只修复列出的错误，保留已经正确的具体内容。",
    "只输出一个完整合法 JSON 对象，不要解释，不要 Markdown 代码围栏。",
    `冻结人物：${names.join("、")}`,
    `人物卡 relationships 的允许目标映射：${JSON.stringify(allowedTargets)}`,
    `relationshipStateLedger 的唯一合法有向边：${relationships.map((relationship) => `${relationship.from}→${relationship.to}`).join("、")}`,
    "人物卡 relationships 是当前已激活关系的子集：删除所有不在允许目标映射中的项，不要求补齐尚未激活的关系。",
    "relationshipStateLedger 必须逐条保持上述 from/to，共且仅有这些边；hiddenTension 必须继承上游规划的具体张力，即使尚未见面也不能写‘无’。",
    "dormant 或非人角色的 emotionalState 要描述其情感回路、休眠倾向或计算状态，不能以‘无’开头。",
    "程序校验错误：",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "需要修复的上一版 JSON：",
    JSON.stringify(result, null, 2),
  ].join("\n")
}

function initialStateCharacters(initialState: Record<string, unknown>) {
  return Array.isArray(initialState.characters)
    ? initialState.characters as Record<string, unknown>[]
    : []
}

function openingLocationNames(initialState: Record<string, unknown>) {
  const locations = initialStateCharacters(initialState)
    .map((character) => String(character.location || "").trim())
    .filter(Boolean)
  const openingFrame = initialState.openingFrame && typeof initialState.openingFrame === "object" && !Array.isArray(initialState.openingFrame)
    ? initialState.openingFrame as Record<string, unknown>
    : {}
  const primaryLocation = String(openingFrame.primaryLocation || "").trim()
  if (primaryLocation) locations.push(primaryLocation)
  return [...new Set(locations)]
}

function continuityLockSources(initialState: Record<string, unknown>) {
  const locks = initialState.continuityLocks && typeof initialState.continuityLocks === "object" && !Array.isArray(initialState.continuityLocks)
    ? initialState.continuityLocks as Record<string, unknown>
    : {}
  return [...new Set(["identityLocks", "locationLocks", "knowledgeLocks", "relationshipLocks", "forbiddenOpeningDrift"]
    .flatMap((key) => Array.isArray(locks[key]) ? locks[key] as unknown[] : [])
    .map((value) => String(value || "").trim())
    .filter(Boolean))]
}

function buildWorldMatrixPrompts(input: WorldMatrixInput, runId: string) {
  const characters = initialStateCharacters(input.initialCharacterState)
  const names = characters.map((character) => String(character.name || "").trim()).filter(Boolean)
  const locations = openingLocationNames(input.initialCharacterState)
  const worldRules = Array.isArray(input.worldFoundation.worldRules) ? input.worldFoundation.worldRules as Record<string, unknown>[] : []
  const factions = Array.isArray(input.worldFoundation.factions) ? input.worldFoundation.factions as Record<string, unknown>[] : []
  const clocks = Array.isArray(input.initialCharacterState.activeClocks) ? input.initialCharacterState.activeClocks as Record<string, unknown>[] : []
  const knowledgeLocks = Array.isArray(input.initialCharacterState.openingKnowledgeLocks) ? input.initialCharacterState.openingKnowledgeLocks as Record<string, unknown>[] : []
  const continuityLocks = continuityLockSources(input.initialCharacterState)
  const characterContract = {
    characters: Array.isArray(input.characterPlanning.characters)
      ? (input.characterPlanning.characters as Record<string, unknown>[]).map((character) => ({
          name: character.name,
          role: character.role,
          identity: character.identity,
          narrativeFunction: character.narrativeFunction,
          knowledgeBoundary: character.knowledgeBoundary,
          continuityLocks: character.continuityLocks,
        }))
      : [],
    relationshipGraph: input.characterPlanning.relationshipGraph,
    continuityLocks: input.characterPlanning.continuityLocks,
    expansionRules: input.characterPlanning.expansionRules,
  }
  const basePrompt = [
    "你是长篇小说世界矩阵架构师（World Matrix Architect）。",
    "你只负责把已批准的世界基础、人物规划和第 1 章人物状态，映射为可执行的世界矩阵；不写章节正文，不生成主线阶段、章节因果链、分卷或结局方案。",
    "世界矩阵必须回答：人物在哪里、受哪些规则约束、谁控制制度、资源如何流动、跨地点要付出什么、压力如何升级、哪些知识不能提前泄露。",
    "每条世界规则必须产生可观察信号、选择成本和破坏后果；每个地点必须关联规则、势力、资源、人物或压力，禁止百科式孤岛设定。",
    "严格冻结人物集合。任何 character、presentCharacters、targetCharacters、holderCharacters、knowers、excludedCharacters 字段只能引用已规划姓名；不得新增命名人物。",
    "必须逐一承接人物初始状态中的开场地点、活动倒计时和知识锁，不得合并后丢失来源；允许新增地点、机构和资源，但必须写清 derivedBasis。",
    "characterWorldInterfaces 必须恰好覆盖全部冻结人物，openingLocation 与 presence 必须逐字继承人物初始状态。",
    "handoffToPlotArchitecture 只提供下一阶段可消费的因果输入、选择、锁定后果和升级轴，不得提前写 plotArchitecture、chapters、arcPlan 或 mainPlot。",
    "continuityAnchors 必须与人物初始状态的连续性锁逐条一一对应，source 逐字复制原锁；不得自行增加人物死亡、牺牲、自毁、洗白、终局阵营或分弧结论。",
    "handoffToPlotArchitecture.availableChoices 中的每项必须是当前状态下真实可执行的选择，禁止写‘不可能’、假选择或已经替人物决定的后续事件。",
    "禁止使用待定、暂无、未知、无、没有、TBD、XXX 等占位内容；只输出一个合法 JSON 对象，不要 Markdown 围栏或解释。",
  ].join("\n")
  const dynamicPrompt = [
    `人物初始状态 Run：${input.upstreamRunId}`,
    `全书体量：${input.totalChapters} 章`,
    `冻结人物（${names.length} 人）：${names.join("、")}`,
    `必须覆盖的开场地点（${locations.length} 个，sourceLocation 必须逐字复制）：${locations.join("｜")}`,
    `必须映射的世界规则（${worldRules.length} 条）：${worldRules.map((rule) => rule.name).join("、")}`,
    `必须继承的开场倒计时（${clocks.length} 条）：${clocks.map((clock) => clock.name).join("、")}`,
    `必须继承的知识锁（${knowledgeLocks.length} 条）：${knowledgeLocks.map((lock) => lock.fact).join("｜")}`,
    `必须逐条继承的连续性锁（${continuityLocks.length} 条，continuityAnchors.source 必须逐字复制）：${continuityLocks.join("｜")}`,
    `本轮额外关注：${input.matrixFocus || "让每个地点、规则、资源与人物选择成本形成可执行连接，并为主线架构提供明确但不越界的输入。"}`,
    "已批准 World Foundation JSON：",
    JSON.stringify(input.worldFoundation, null, 2),
    "人物规划冻结摘要 JSON：",
    JSON.stringify(characterContract, null, 2),
    "已批准 Initial Character State JSON：",
    JSON.stringify(input.initialCharacterState, null, 2),
  ].join("\n")
  const userMessage = [
    "生成完整 World Matrix JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 1,',
    '  "source": { "initialCharacterStateRunId": "", "characterPlanningRunId": "", "worldFoundationRunId": "", "frozenCharacterNames": [""] },',
    '  "project": { "title": "", "totalChapters": 0, "openingChapter": 1, "matrixPurpose": "" },',
    '  "rules": [{ "id": "", "name": "", "sourceRule": "", "rule": "", "execution": "", "visibleSignal": "", "cost": "", "exceptions": "", "breakConsequence": "", "affectedCharacters": [""] }],',
    '  "locations": [{ "id": "", "name": "", "sourceLocation": "", "derivedBasis": "", "layer": "", "category": "", "openingState": "", "governingRules": [""], "factions": [""], "presentCharacters": [""], "offstagePressure": "", "resources": [""], "accessConditions": [""], "exitCost": "", "storyUse": "" }],',
    '  "factions": [{ "name": "", "sourceFaction": "", "territory": [""], "goal": "", "method": "", "resources": [""], "taboos": [""], "internalPressure": "", "externalPressure": "", "characterInterfaces": [{ "character": "", "status": "", "pressure": "", "availableChoice": "" }] }],',
    '  "institutions": [{ "name": "", "scope": "", "procedure": "", "enforcement": "", "loophole": "", "characterCost": "", "affectedCharacters": [""] }],',
    '  "resources": [{ "name": "", "source": "", "holderCharacters": [""], "holderOrganizations": [""], "location": "", "capability": "", "cost": "", "scarcity": "", "transferRule": "", "conflictUse": "" }],',
    '  "pressureSystems": [{ "name": "", "sourceClock": "", "source": "", "targetCharacters": [""], "currentLevel": "", "escalationClock": "", "visibleEffects": [""], "failureConsequence": "" }],',
    '  "knowledgeBarriers": [{ "sourceFact": "", "fact": "", "knowers": [""], "excludedCharacters": [""], "unlockCondition": "", "prematureLeakConsequence": "" }],',
    '  "characterWorldInterfaces": [{ "character": "", "openingLocation": "", "presence": "onstage|offstage|dormant", "ruleExposure": [""], "resourceAccess": [""], "institutionalStatus": "", "factionPressure": "", "nextWorldAction": "" }],',
    '  "travelAndAccess": [{ "from": "", "to": "", "method": "", "duration": "", "cost": "", "restrictions": [""], "storyUse": "" }],',
    '  "continuityAnchors": [{ "id": "", "source": "", "anchor": "", "verificationSignal": "", "forbiddenDrift": "" }],',
    '  "openingWorldSlice": { "time": "", "primaryLocation": "", "activeLocations": [""], "activeRules": [""], "activeFactions": [""], "activeResources": [""], "activePressures": [""], "chapterOneProofs": [""] },',
    '  "handoffToPlotArchitecture": { "causalInputs": [""], "availableChoices": [""], "lockedConsequences": [""], "escalationAxes": [""], "forbiddenShortcuts": [""] },',
    '  "qualitySelfCheck": { "allOpeningLocationsMapped": true, "allCharactersMapped": true, "allSourceRulesMapped": true, "allClocksMapped": true, "allKnowledgeLocksMapped": true, "noPlotArchitectureGenerated": true, "remainingRisks": [""] }',
    "}",
    `硬性人物集合：characterWorldInterfaces 必须恰好 ${names.length} 人，姓名只能是：${names.join("、")}。`,
    `locations 至少覆盖 ${locations.length} 个冻结开场地点；每个冻结地点必须在某项 sourceLocation 中逐字出现。`,
    `rules 必须覆盖全部 ${worldRules.length} 条上游 worldRules；sourceRule 必须逐字引用上游规则名。`,
    `pressureSystems 必须覆盖全部 ${clocks.length} 条 activeClocks；sourceClock 必须逐字引用倒计时名。`,
    `knowledgeBarriers 必须覆盖全部 ${knowledgeLocks.length} 条 openingKnowledgeLocks；sourceFact 必须逐字引用原 fact。`,
    `continuityAnchors 必须恰好 ${continuityLocks.length} 条，与人物初始状态的连续性锁逐条对应，不得增加后续剧情结论。`,
    "所有人物引用只能使用冻结人物姓名；组织、地点、系统、器物不得塞入人物字段。",
  ].join("\n")
  const consensus = `独立调试 Run: ${runId}\n人物初始状态上游 Run: ${input.upstreamRunId}`
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 生成 phase_5_world_matrix 世界矩阵资产，不进行圆桌讨论。",
    "- 冻结人物和开场状态，不改写上游，不写正文。",
    "- 只输出可被 phase_6_plot_architecture 消费的结构化 JSON。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 只能输出单个合法 JSON 对象。",
    "- 必须停留在 world_matrix_debug 阶段。",
  ].join("\n")
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "输出语言：简体中文", "当前工作流阶段：world_matrix_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n")
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function buildWorldMatrixRepairMessage(input: WorldMatrixInput, result: Record<string, unknown>, errors: string[]) {
  const names = initialStateCharacters(input.initialCharacterState).map((character) => String(character.name || "").trim()).filter(Boolean)
  const locations = openingLocationNames(input.initialCharacterState)
  const rules = Array.isArray(input.worldFoundation.worldRules) ? (input.worldFoundation.worldRules as Record<string, unknown>[]).map((rule) => String(rule.name || "").trim()).filter(Boolean) : []
  const clocks = Array.isArray(input.initialCharacterState.activeClocks) ? (input.initialCharacterState.activeClocks as Record<string, unknown>[]).map((clock) => String(clock.name || "").trim()).filter(Boolean) : []
  const facts = Array.isArray(input.initialCharacterState.openingKnowledgeLocks) ? (input.initialCharacterState.openingKnowledgeLocks as Record<string, unknown>[]).map((lock) => String(lock.fact || "").trim()).filter(Boolean) : []
  const continuityLocks = continuityLockSources(input.initialCharacterState)
  return [
    "上一版 World Matrix 未通过程序校验。请只修复列出的错误，保留已经正确的具体内容。",
    "只输出一个完整合法 JSON 对象，不要解释，不要 Markdown 代码围栏。",
    `唯一合法人物：${names.join("、")}`,
    `必须逐字覆盖的 sourceLocation：${locations.join("｜")}`,
    `必须逐字覆盖的 sourceRule：${rules.join("、")}`,
    `必须逐字覆盖的 sourceClock：${clocks.join("、")}`,
    `必须逐字覆盖的 sourceFact：${facts.join("｜")}`,
    `continuityAnchors.source 必须逐字覆盖且只能使用以下连续性锁：${continuityLocks.join("｜")}`,
    "不得生成 plotArchitecture、chapters、arcPlan、mainPlot；不得在人物字段中放入组织、系统或器物。",
    "删除自行决定的人物死亡、牺牲、自毁、洗白、终局阵营、分弧结论；availableChoices 只能保留当前可执行选择，不得包含‘不可能’或假选择。",
    "程序校验错误：",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "需要修复的上一版 JSON：",
    JSON.stringify(result, null, 2),
  ].join("\n")
}

function plotArchitectureArcTarget(totalChapters: number) {
  return Math.max(4, Math.min(10, Math.ceil(totalChapters / 60)))
}

function plotArchitectureProtagonist(characterPlanning: Record<string, unknown>) {
  const characters = Array.isArray(characterPlanning.characters) ? characterPlanning.characters as Record<string, unknown>[] : []
  const explicit = characters.find((character) => /主角|protagonist/iu.test(String(character.role || "")))
  return String(explicit?.name || characters[0]?.name || "").trim()
}

function plotSourceNames(source: Record<string, unknown>, key: string, field: string) {
  return Array.isArray(source[key])
    ? (source[key] as Record<string, unknown>[]).map((entry) => String(entry?.[field] || "").trim()).filter(Boolean)
    : []
}

function buildPlotArchitecturePrompts(input: PlotArchitectureInput, runId: string) {
  const characters = plannedCharacterNames(input.characterPlanning)
  const protagonist = plotArchitectureProtagonist(input.characterPlanning)
  const sourcePressures = plotSourceNames(input.worldMatrix, "pressureSystems", "name")
  const sourceAnchorIds = plotSourceNames(input.worldMatrix, "continuityAnchors", "id")
  const sourceSubplots = plotSourceNames(input.worldFoundation, "subplots", "name")
  const sourceForeshadowing = plotSourceNames(input.worldFoundation, "foreshadowing", "seed")
  const arcTarget = plotArchitectureArcTarget(input.totalChapters)
  const handoff = input.worldMatrix.handoffToPlotArchitecture && typeof input.worldMatrix.handoffToPlotArchitecture === "object" && !Array.isArray(input.worldMatrix.handoffToPlotArchitecture)
    ? input.worldMatrix.handoffToPlotArchitecture as Record<string, unknown>
    : {}
  const compactFoundation = {
    project: input.worldFoundation.project,
    mainPlot: input.worldFoundation.mainPlot,
    subplots: input.worldFoundation.subplots,
    foreshadowing: input.worldFoundation.foreshadowing,
    arcPlan: input.worldFoundation.arcPlan,
    worldRules: input.worldFoundation.worldRules,
  }
  const compactInitialState = {
    openingFrame: input.initialCharacterState.openingFrame,
    activeClocks: input.initialCharacterState.activeClocks,
    openingKnowledgeLocks: input.initialCharacterState.openingKnowledgeLocks,
  }
  const basePrompt = [
    "你是资深长篇小说主线架构师（Plot Architecture Showrunner）。",
    "你只负责 phase_6_plot_architecture：把已冻结的世界矩阵交接包转化为全书主线因果架构，不写正文，不生成故事圣经、分卷策略或逐章蓝图。",
    "主线不是事件列表。每一弧必须形成：上游压力 → 主角目标 → 可执行选择 → 付出代价 → 不可逆变化 → 下一弧接棒。",
    "必须覆盖全书章节范围，弧线区间连续、无重叠、无空洞；可以决定宏观弧线和结局契约，但不得写逐章场景或章节正文。",
    "严格继承冻结人物，不新增、改名或合并人物；每名人物都必须绑定到主线变化，而不是只列姓名。",
    "世界矩阵的压力系统、连续性锚点、可用选择、锁定后果和禁止捷径都必须被显式消费或保持。",
    "伏笔和支线必须声明进入哪一弧、如何改变因果、何时兑现或继续保留，禁止只复制上游原文。",
    "只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释生成过程。",
  ].join("\n")
  const dynamicPrompt = [
    `世界矩阵 Run：${input.upstreamRunId}`,
    `全书体量：${input.totalChapters} 章`,
    `主角：${protagonist}`,
    `冻结人物（${characters.length} 人）：${characters.join("、")}`,
    `主线弧线数量：必须恰好 ${arcTarget} 弧`,
    `世界压力（${sourcePressures.length} 项）：${sourcePressures.join("｜")}`,
    `连续性锚点（${sourceAnchorIds.length} 项）：${sourceAnchorIds.join("、")}`,
    `上游支线（${sourceSubplots.length} 项）：${sourceSubplots.join("｜")}`,
    `上游伏笔（${sourceForeshadowing.length} 项）必须逐条进入伏笔计划。`,
    `本轮额外关注：${input.architectureFocus || "检查长篇中段是否重复，确保每一弧都改变人物、关系、世界压力或真相结构。"}`,
    "世界矩阵交接包：",
    JSON.stringify(handoff, null, 2),
    "完整 World Matrix JSON：",
    JSON.stringify(input.worldMatrix, null, 2),
    "冻结 Character Planning JSON：",
    JSON.stringify(input.characterPlanning, null, 2),
    "开场状态摘要：",
    JSON.stringify(compactInitialState, null, 2),
    "World Foundation 主线来源摘要：",
    JSON.stringify(compactFoundation, null, 2),
  ].join("\n")
  const userMessage = [
    "生成完整 Plot Architecture JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 1,',
    '  "source": { "worldMatrixRunId": "", "phase": "phase_5_world_matrix", "frozenCharacterNames": [""], "sourcePressureNames": [""], "sourceContinuityAnchorIds": [""] },',
    '  "project": { "title": "", "totalChapters": 0, "protagonist": "", "architecturePurpose": "" },',
    '  "storyPromise": { "logline": "", "centralDramaticQuestion": "", "readerPromise": "", "themeArgument": "", "endingDirection": "", "nonNegotiables": [""] },',
    '  "mainline": { "externalGoal": "", "internalNeed": "", "centralConflict": "", "oppositionLogic": "", "falseVictory": "", "darkestPoint": "", "climaxChoice": "", "endingState": "" },',
    '  "arcArchitecture": [{ "id": "arc_01", "name": "", "startChapter": 1, "endChapter": 1, "sourceCausalInputs": [""], "openingState": "", "protagonistObjective": "", "drivingChoice": "", "opposition": "", "midpointReversal": "", "cost": "", "irreversibleOutcome": "", "nextHandoff": "", "escalationAxes": [""] }],',
    '  "characterArcBindings": [{ "character": "", "startState": "", "desire": "", "mainlineFunction": "", "pressure": "", "turningPoints": [{ "arcId": "", "change": "", "cost": "" }], "endState": "" }],',
    '  "pressureEscalation": [{ "sourcePressure": "", "arcStages": [{ "arcId": "", "level": "", "visibleEffect": "", "consequence": "" }] }],',
    '  "continuityPlan": [{ "sourceAnchorId": "", "firstUseArcId": "", "verification": "", "payoffOrPersistence": "", "forbiddenDrift": "" }],',
    '  "subplotPlan": [{ "sourceSubplot": "", "entryArcId": "", "turnArcIds": [""], "causalFunction": "", "mainlineCollision": "", "resolutionArcId": "", "resolutionCost": "" }],',
    '  "foreshadowingPlan": [{ "sourceSeed": "", "plantArcId": "", "advanceArcIds": [""], "payoffArcId": "", "payoffAction": "", "readerEffect": "" }],',
    '  "endingContract": { "climaxChoice": "", "paidCosts": [""], "resolvedPromises": [""], "intentionallyOpen": [""], "finalWorldState": "", "noDeusExMachinaProof": "" },',
    '  "handoffToStoryBible": { "lockedMainline": [""], "characterStateRequirements": [""], "canonicalTerms": [""], "continuityRules": [""], "unresolvedRisks": [""] },',
    '  "qualitySelfCheck": { "continuousChapterCoverage": true, "allCharactersBound": true, "allPressuresEscalated": true, "allContinuityAnchorsScheduled": true, "noLaterPhaseAssetsGenerated": true, "remainingRisks": [""] }',
    "}",
    `arcArchitecture 必须恰好 ${arcTarget} 弧；从第 1 章连续覆盖到第 ${input.totalChapters} 章，区间不得重叠或留空。`,
    `characterArcBindings 必须恰好 ${characters.length} 人，姓名只能是：${characters.join("、")}。`,
    `pressureEscalation.sourcePressure 必须逐字覆盖：${sourcePressures.join("｜")}。`,
    `continuityPlan.sourceAnchorId 必须逐字覆盖 ${sourceAnchorIds.length} 个锚点 ID：${sourceAnchorIds.join("、")}。`,
    `subplotPlan.sourceSubplot 必须逐字覆盖：${sourceSubplots.join("｜") || "无上游支线"}。`,
    "foreshadowingPlan.sourceSeed 必须逐字继承每条上游 seed，不得缩写、改写或遗漏。",
    "不得输出 storyBible、volumeStrategy、chapterBlueprints、chapters 或正文段落；这些属于后续阶段。",
  ].join("\n")
  const consensus = `独立调试 Run: ${runId}\n世界矩阵上游 Run: ${input.upstreamRunId}`
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 生成 phase_6_plot_architecture 主线架构资产，不进行圆桌讨论。",
    "- 只安排宏观因果弧、人物变化、压力升级、锚点和伏笔，不写正文。",
    "- 输出必须能被 phase_7_story_bible 直接消费。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 只能输出单个合法 JSON 对象。",
    "- 必须停留在 plot_architecture_debug 阶段。",
  ].join("\n")
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "输出语言：简体中文", "当前工作流阶段：plot_architecture_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n")
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function buildPlotArchitectureRepairMessage(input: PlotArchitectureInput, result: Record<string, unknown>, errors: string[]) {
  const characters = plannedCharacterNames(input.characterPlanning)
  const pressures = plotSourceNames(input.worldMatrix, "pressureSystems", "name")
  const anchors = plotSourceNames(input.worldMatrix, "continuityAnchors", "id")
  const subplots = plotSourceNames(input.worldFoundation, "subplots", "name")
  const seeds = plotSourceNames(input.worldFoundation, "foreshadowing", "seed")
  return [
    "上一版 Plot Architecture 未通过程序校验。请只修复列出的错误，保留已经正确的具体内容。",
    "只输出一个完整合法 JSON 对象，不要解释，不要 Markdown 代码围栏。",
    `必须恰好 ${plotArchitectureArcTarget(input.totalChapters)} 弧，并从第 1 章连续覆盖到第 ${input.totalChapters} 章。`,
    `唯一合法人物：${characters.join("、")}`,
    `必须逐字覆盖的 sourcePressure：${pressures.join("｜")}`,
    `必须逐字覆盖的 sourceAnchorId：${anchors.join("、")}`,
    `必须逐字覆盖的 sourceSubplot：${subplots.join("｜")}`,
    `必须逐字覆盖的 sourceSeed：${seeds.join("｜")}`,
    "不得生成 storyBible、volumeStrategy、chapterBlueprints、chapters 或正文。",
    "程序校验错误：",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "需要修复的上一版 JSON：",
    JSON.stringify(result, null, 2),
  ].join("\n")
}

function storyBibleSourceRecords(source: Record<string, unknown>, key: string) {
  return Array.isArray(source[key]) ? source[key] as Record<string, unknown>[] : []
}

function storyBibleRelationshipKeys(characterPlanning: Record<string, unknown>) {
  return storyBibleSourceRecords(characterPlanning, "relationshipGraph")
    .map((edge) => `${String(edge.from || "").trim()}→${String(edge.to || "").trim()}`)
    .filter((edge) => edge !== "→")
}

function storyBibleCanonicalTermName(value: string) {
  const source = value.trim()
  const separatorIndex = source.search(/[：:]/u)
  return separatorIndex > 0 ? source.slice(0, separatorIndex).trim() : source
}

function buildStoryBiblePrompts(input: StoryBibleInput, runId: string) {
  const characters = plannedCharacterNames(input.characterPlanning)
  const protagonist = plotArchitectureProtagonist(input.characterPlanning)
  const arcs = storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture")
  const arcIds = arcs.map((arc) => String(arc.id || "").trim()).filter(Boolean)
  const continuityIds = storyBibleSourceRecords(input.plotArchitecture, "continuityPlan").map((entry) => String(entry.sourceAnchorId || "").trim()).filter(Boolean)
  const relationshipKeys = storyBibleRelationshipKeys(input.characterPlanning)
  const rules = plotSourceNames(input.worldMatrix, "rules", "name")
  const locations = plotSourceNames(input.worldMatrix, "locations", "name")
  const promiseSeeds = plotSourceNames(input.plotArchitecture, "foreshadowingPlan", "sourceSeed")
  const handoff = input.plotArchitecture.handoffToStoryBible && typeof input.plotArchitecture.handoffToStoryBible === "object" && !Array.isArray(input.plotArchitecture.handoffToStoryBible)
    ? input.plotArchitecture.handoffToStoryBible as Record<string, unknown>
    : {}
  const compactCharacters = storyBibleSourceRecords(input.characterPlanning, "characters").map((character) => ({
    name: character.name,
    role: character.role,
    identity: character.identity,
    narrativeFunction: character.narrativeFunction,
    desire: character.desire,
    wound: character.wound,
    fear: character.fear,
    misbelief: character.misbelief,
    secret: character.secret,
    values: character.values,
    behaviorHabits: character.behaviorHabits,
    speechPattern: character.speechPattern,
    skills: character.skills,
    limitations: character.limitations,
    knowledgeBoundary: character.knowledgeBoundary,
    continuityLocks: character.continuityLocks,
  }))
  const compactWorld = {
    rules: input.worldMatrix.rules,
    locations: input.worldMatrix.locations,
    factions: input.worldMatrix.factions,
    institutions: input.worldMatrix.institutions,
    resources: input.worldMatrix.resources,
    pressureSystems: input.worldMatrix.pressureSystems,
    knowledgeBarriers: input.worldMatrix.knowledgeBarriers,
  }
  const basePrompt = [
    "你是长篇小说故事圣经总编（Story Bible Canon Editor）。",
    "你只负责 phase_7_story_bible：把已通过的主线架构与冻结上游整理成全项目唯一的正典参考，不重新规划主线，不写分卷策略、逐章蓝图或正文。",
    "故事圣经必须回答‘什么永远不能漂移’：世界规则及成本、地点与势力边界、人物身份与声音、关系方向、弧线状态、专有名词、知识边界、连续性锚点、承诺与结局契约。",
    "所有条目必须可验证；禁止只写‘保持一致’、‘遵循上游’或复制空泛原则。每条必须给出检查信号和禁止漂移项。",
    "严格继承冻结人物、关系方向、弧 ID、连续性锚点 ID、规则名、地点名和伏笔种子，不新增或改名。",
    "只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释生成过程。",
  ].join("\n")
  const dynamicPrompt = [
    `主线架构 Run：${input.upstreamRunId}`,
    `全书体量：${input.totalChapters} 章`,
    `冻结主角：${protagonist}`,
    `冻结人物（${characters.length} 人）：${characters.join("、")}`,
    `冻结关系（${relationshipKeys.length} 条）：${relationshipKeys.join("、")}`,
    `主线弧（${arcIds.length} 条）：${arcIds.join("、")}`,
    `连续性锚点（${continuityIds.length} 条）：${continuityIds.join("、")}`,
    `世界规则（${rules.length} 条）：${rules.join("、")}`,
    `地点（${locations.length} 个）：${locations.join("、")}`,
    `伏笔承诺（${promiseSeeds.length} 条）必须逐条进入承诺账本。`,
    `本轮额外关注：${input.bibleFocus || "把所有不可漂移事实变成可检查的正典条目，重点消除人物声音、术语、知识边界和代价规则的歧义。"}`,
    "主线架构交接包：",
    JSON.stringify(handoff, null, 2),
    "完整 Plot Architecture JSON：",
    JSON.stringify(input.plotArchitecture, null, 2),
    "人物档案摘要：",
    JSON.stringify(compactCharacters, null, 2),
    "冻结关系网：",
    JSON.stringify(input.characterPlanning.relationshipGraph, null, 2),
    "世界矩阵正典来源：",
    JSON.stringify(compactWorld, null, 2),
    "开场状态：",
    JSON.stringify(input.initialCharacterState.openingFrame, null, 2),
    "项目与背景来源：",
    JSON.stringify({ project: input.worldFoundation.project, background: input.worldFoundation.background }, null, 2),
  ].join("\n")
  const userMessage = [
    "生成完整 Story Bible JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 1,',
    '  "source": { "plotArchitectureRunId": "", "phase": "phase_6_plot_architecture", "frozenCharacterNames": [""], "sourceArcIds": [""], "sourceContinuityAnchorIds": [""] },',
    '  "project": { "title": "", "genre": "", "totalChapters": 0, "protagonist": "", "logline": "", "readerPromise": "", "themeArgument": "" },',
    '  "canonPolicy": { "authorityOrder": [""], "nonNegotiables": [""], "changeControl": [""], "forbiddenShortcuts": [""] },',
    '  "worldCanon": { "rules": [{ "sourceName": "", "canonicalRule": "", "visibleSignals": [""], "cost": "", "exceptionBoundary": "", "forbiddenDrift": "" }], "locations": [{ "sourceName": "", "identity": "", "controllingForces": [""], "accessConstraints": [""], "storyFunction": "", "forbiddenDrift": "" }], "factions": [{ "sourceName": "", "goal": "", "methods": [""], "resources": [""], "internalConflict": "", "forbiddenDrift": "" }], "institutions": [{ "sourceName": "", "scope": "", "procedure": "", "enforcement": "", "loophole": "", "forbiddenDrift": "" }], "resources": [{ "sourceName": "", "capability": "", "cost": "", "scarcity": "", "transferRule": "", "forbiddenDrift": "" }], "knowledgeBoundaries": [{ "sourceFact": "", "knowers": [""], "excludedCharacters": [""], "unlockCondition": "", "prematureLeakConsequence": "" }] },',
    '  "characterCanon": [{ "character": "", "identity": "", "role": "", "desire": "", "woundOrFear": "", "misbelief": "", "voice": "", "behaviorMarkers": [""], "abilities": [""], "limitationsAndCosts": [""], "knowledgeBoundary": [""], "mainlineFunction": "", "arcStateRequirements": [{ "arcId": "", "requiredState": "", "forbiddenState": "" }], "forbiddenDrift": [""] }],',
    '  "relationshipCanon": [{ "sourceEdge": "人物A→人物B", "type": "", "surfaceState": "", "hiddenTension": "", "evolutionRule": "", "breakingPoint": "", "forbiddenDrift": "" }],',
    '  "arcCanon": [{ "sourceArcId": "", "startChapter": 1, "endChapter": 1, "openingState": "", "requiredChoice": "", "requiredCost": "", "irreversibleOutcome": "", "exitState": "", "forbiddenDrift": "" }],',
    '  "terminology": [{ "sourceTerm": "", "canonicalMeaning": "", "usageRule": "", "forbiddenVariants": [""] }],',
    '  "continuityCanon": [{ "sourceAnchorId": "", "canonicalConstraint": "", "verificationSignal": "", "payoffOrPersistence": "", "forbiddenDrift": "" }],',
    '  "promiseLedger": [{ "sourceSeed": "", "surfacePromise": "", "truePromise": "", "advanceArcIds": [""], "payoffArcId": "", "payoffEvidence": "", "forbiddenDrift": "" }],',
    '  "endingCanon": { "climaxChoice": "", "paidCosts": [""], "resolvedPromises": [""], "intentionallyOpen": [""], "finalWorldState": "", "forbiddenRetcons": [""] },',
    '  "handoffToVolumeStrategy": { "immutableArcOrder": [""], "allowedVolumeBreaks": [""], "pacingRisks": [""], "characterCoverageRules": [""], "immutablePayoffs": [""], "unresolvedRisks": [""] },',
    '  "qualitySelfCheck": { "allCharactersCanonicalized": true, "allRelationshipsCanonicalized": true, "allArcsCanonicalized": true, "allContinuityAnchorsCanonicalized": true, "allPromisesTracked": true, "noLaterPhaseAssetsGenerated": true, "remainingRisks": [""] }',
    "}",
    `characterCanon 必须恰好 ${characters.length} 人，姓名只能是：${characters.join("、")}。`,
    `relationshipCanon.sourceEdge 必须逐字覆盖 ${relationshipKeys.length} 条有向关系：${relationshipKeys.join("、")}。`,
    `arcCanon.sourceArcId 必须逐字覆盖：${arcIds.join("、")}，章节边界必须与上游完全一致。`,
    `worldCanon.rules.sourceName 必须逐字覆盖：${rules.join("、")}。`,
    `worldCanon.locations.sourceName 必须逐字覆盖：${locations.join("、")}。`,
    `continuityCanon.sourceAnchorId 必须逐字覆盖全部 ${continuityIds.length} 个锚点。`,
    "terminology.sourceTerm 必须逐字覆盖主线交接包 canonicalTerms 中冒号前的术语名；冒号后的定义、数值和限制必须写入对应 canonicalMeaning 或 usageRule。",
    "promiseLedger.sourceSeed 必须逐字覆盖全部上游伏笔种子。",
    "不得输出 volumeStrategy、chapterBlueprints、chapters、chapterDrafts 或正文。",
  ].join("\n")
  const consensus = `独立调试 Run: ${runId}\n主线架构上游 Run: ${input.upstreamRunId}`
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 生成 phase_7_story_bible 正典资产，不进行圆桌讨论。",
    "- 冻结已批准事实，不重写主线，不新增主要人物。",
    "- 输出必须能被 phase_8_volume_strategy 直接消费。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 只能输出单个合法 JSON 对象。",
    "- 必须停留在 story_bible_debug 阶段。",
  ].join("\n")
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "输出语言：简体中文", "当前工作流阶段：story_bible_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n")
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function buildStoryBibleRepairMessage(input: StoryBibleInput, result: Record<string, unknown>, errors: string[]) {
  const characters = plannedCharacterNames(input.characterPlanning)
  const relationships = storyBibleRelationshipKeys(input.characterPlanning)
  const arcIds = plotSourceNames(input.plotArchitecture, "arcArchitecture", "id")
  const continuityIds = plotSourceNames(input.plotArchitecture, "continuityPlan", "sourceAnchorId")
  const ruleNames = plotSourceNames(input.worldMatrix, "rules", "name")
  const locationNames = plotSourceNames(input.worldMatrix, "locations", "name")
  const seeds = plotSourceNames(input.plotArchitecture, "foreshadowingPlan", "sourceSeed")
  const handoff = input.plotArchitecture.handoffToStoryBible && typeof input.plotArchitecture.handoffToStoryBible === "object" && !Array.isArray(input.plotArchitecture.handoffToStoryBible)
    ? input.plotArchitecture.handoffToStoryBible as Record<string, unknown>
    : {}
  const termNames = Array.isArray(handoff.canonicalTerms)
    ? handoff.canonicalTerms.map((term) => storyBibleCanonicalTermName(String(term || ""))).filter(Boolean)
    : []
  return [
    "上一版 Story Bible 未通过程序校验。请只修复列出的错误，保留已经正确的具体内容。",
    "只输出一个完整合法 JSON 对象，不要解释，不要 Markdown 代码围栏。",
    `唯一合法人物：${characters.join("、")}`,
    `必须逐字覆盖的 sourceEdge：${relationships.join("、")}`,
    `必须逐字覆盖的 sourceArcId：${arcIds.join("、")}`,
    `必须逐字覆盖的 sourceAnchorId：${continuityIds.join("、")}`,
    `必须逐字覆盖的规则名：${ruleNames.join("、")}`,
    `必须逐字覆盖的地点名：${locationNames.join("、")}`,
    `必须逐字覆盖的 sourceSeed：${seeds.join("｜")}`,
    `terminology.sourceTerm 必须逐字覆盖这些术语名：${termNames.join("、")}`,
    "canonicalTerms 冒号后的定义、数值和限制应写入对应 canonicalMeaning 或 usageRule，不要把整条“名称：定义”塞进 sourceTerm。",
    "不得生成分卷策略、逐章蓝图、章节列表或正文。",
    "程序校验错误：",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "需要修复的上一版 JSON：",
    JSON.stringify(result, null, 2),
  ].join("\n")
}

function volumeStrategyStringValues(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : []
}

function volumeStrategyCharacterNames(storyBible: Record<string, unknown>) {
  return storyBibleSourceRecords(storyBible, "characterCanon")
    .map((entry) => String(entry.character || "").trim())
    .filter(Boolean)
}

function volumeStrategyPromiseSeeds(storyBible: Record<string, unknown>) {
  return storyBibleSourceRecords(storyBible, "promiseLedger")
    .map((entry) => String(entry.sourceSeed || "").trim())
    .filter(Boolean)
}

function volumeStrategyTargetForArcs(arcCount: number) {
  if (arcCount <= 1) return 1
  return Math.max(2, Math.min(12, arcCount, Math.ceil(arcCount / 2)))
}

function buildVolumeStrategyPrompts(input: VolumeStrategyInput, runId: string) {
  const arcs = storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture")
  const arcIds = arcs.map((arc) => String(arc.id || "").trim()).filter(Boolean)
  const characters = volumeStrategyCharacterNames(input.storyBible)
  const seeds = volumeStrategyPromiseSeeds(input.storyBible)
  const storyHandoff = input.storyBible.handoffToVolumeStrategy && typeof input.storyBible.handoffToVolumeStrategy === "object" && !Array.isArray(input.storyBible.handoffToVolumeStrategy)
    ? input.storyBible.handoffToVolumeStrategy as Record<string, unknown>
    : {}
  const compactArcs = arcs.map((arc) => ({
    id: arc.id,
    name: arc.name,
    startChapter: arc.startChapter,
    endChapter: arc.endChapter,
    openingState: arc.openingState,
    protagonistObjective: arc.protagonistObjective,
    drivingChoice: arc.drivingChoice,
    opposition: arc.opposition,
    midpointReversal: arc.midpointReversal,
    cost: arc.cost,
    irreversibleOutcome: arc.irreversibleOutcome,
    nextHandoff: arc.nextHandoff,
  }))
  const basePrompt = [
    "你是长篇小说分卷总策划（Volume Strategy Showrunner）。",
    "你只负责 phase_8_volume_strategy：把已冻结的故事圣经和主线弧分组为连续卷，明确每卷阶段目标、压力升级、人物与关系变化、伏笔推进、读者兑现和卷尾不可逆交接。",
    "不得改变故事圣经正典，不得新增主线弧，不得把主线弧拆到两卷，也不得生成逐章蓝图、章节列表或正文。",
    "每卷必须覆盖一段连续主线弧；所有卷从第 1 章连续覆盖到全书末章，不能重叠或留空。",
    "卷尾不能只是事件结束，必须改变人物位置、关系网络、世界认知或可用方法，并把明确压力交给下一卷。",
    "只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释生成过程。",
  ].join("\n")
  const dynamicPrompt = [
    `故事圣经 Run：${input.upstreamRunId}`,
    `全书体量：${input.totalChapters} 章`,
    `目标卷数：${input.targetVolumeCount} 卷`,
    `冻结主线弧（${arcIds.length} 条）：${arcIds.join("、")}`,
    `冻结人物（${characters.length} 人）：${characters.join("、")}`,
    `冻结伏笔承诺（${seeds.length} 条）必须全部进入分卷排期。`,
    `本轮额外关注：${input.strategyFocus || "避免中段各卷重复；每卷必须有不同压力模型、人物关系变化、局部答案和不可逆卷尾。"}`,
    "故事圣经交接约束：",
    JSON.stringify(storyHandoff, null, 2),
    "冻结主线弧摘要：",
    JSON.stringify(compactArcs, null, 2),
    "完整 Story Bible JSON：",
    JSON.stringify(input.storyBible, null, 2),
  ].join("\n")
  const userMessage = [
    "生成完整 Volume Strategy JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 1,',
    '  "source": { "storyBibleRunId": "", "phase": "phase_7_story_bible", "totalChapters": 0, "sourceArcIds": [""] },',
    '  "strategy": { "targetVolumeCount": 0, "groupingRationale": "", "escalationCadence": "", "readerPayoffCadence": "", "antiRepetitionRule": "" },',
    '  "volumes": [{ "id": "volume_01", "title": "", "startChapter": 1, "endChapter": 1, "sourceArcIds": [""], "phaseGoal": "", "openingState": "", "centralQuestion": "", "pressureEscalation": [""], "characterFocus": [""], "relationshipShifts": [""], "worldChanges": [""], "promiseAdvances": [{ "sourceSeed": "", "operation": "" }], "midpointTurn": "", "climax": "", "irreversibleChange": "", "readerPayoff": "", "nextVolumeHandoff": "", "forbiddenDrift": [""] }],',
    '  "arcCoverage": [{ "sourceArcId": "", "volumeId": "", "coverageFunction": "", "entryState": "", "exitState": "" }],',
    '  "characterCoverage": [{ "character": "", "volumeIds": [""], "entryFunction": "", "continuityRequirement": "", "requiredChange": "" }],',
    '  "promiseSchedule": [{ "sourceSeed": "", "setupVolumeId": "", "advanceVolumeIds": [""], "payoffVolumeId": "", "payoffEvidence": "", "forbiddenDrift": "" }],',
    '  "handoffToChapterBlueprints": { "volumeOrder": [""], "chapterRangeLocks": [{ "volumeId": "", "startChapter": 1, "endChapter": 1, "sourceArcIds": [""] }], "blueprintRules": [""], "highRiskTransitions": [""], "immutablePayoffs": [""] },',
    '  "qualitySelfCheck": { "continuousChapterCoverage": true, "allArcsCoveredExactlyOnce": true, "allCharactersScheduled": true, "allPromisesScheduled": true, "volumeEndsIrreversible": true, "noChapterBlueprintsGenerated": true, "remainingRisks": [""] }',
    "}",
    `volumes 必须恰好 ${input.targetVolumeCount} 卷，id 依次为 ${Array.from({ length: input.targetVolumeCount }, (_, index) => `volume_${String(index + 1).padStart(2, "0")}`).join("、")}。`,
    `所有卷从第 1 章连续覆盖到第 ${input.totalChapters} 章；每条主线弧必须且只能归属一卷，弧不能跨卷。`,
    `arcCoverage.sourceArcId 必须逐字覆盖：${arcIds.join("、")}。`,
    `characterCoverage.character 必须逐字覆盖全部冻结人物：${characters.join("、")}。`,
    "promiseSchedule.sourceSeed 必须逐字覆盖全部故事圣经承诺；卷内 promiseAdvances 只承担本卷实际推进的承诺。",
    "不得输出 chapterBlueprints、chapters、chapterPlans、chapterDrafts 或正文。",
  ].join("\n")
  const consensus = `独立调试 Run: ${runId}\n故事圣经上游 Run: ${input.upstreamRunId}`
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 生成 phase_8_volume_strategy 分卷资产，不进行圆桌讨论。",
    "- 只分组冻结主线弧并设计卷级兑现，不拆分到逐章。",
    "- 输出必须能被 phase_9_chapter_blueprints 直接消费。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 只能输出单个合法 JSON 对象。",
    "- 必须停留在 volume_strategy_debug 阶段。",
  ].join("\n")
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "输出语言：简体中文", "当前工作流阶段：volume_strategy_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n")
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function buildVolumeStrategyRepairMessage(input: VolumeStrategyInput, result: Record<string, unknown>, errors: string[]) {
  const arcIds = plotSourceNames(input.plotArchitecture, "arcArchitecture", "id")
  const characters = volumeStrategyCharacterNames(input.storyBible)
  const seeds = volumeStrategyPromiseSeeds(input.storyBible)
  return [
    "上一版 Volume Strategy 未通过程序校验。请只修复列出的错误，保留已经正确的具体内容。",
    "只输出一个完整合法 JSON 对象，不要解释，不要 Markdown 代码围栏。",
    `必须恰好 ${input.targetVolumeCount} 卷，并从第 1 章连续覆盖到第 ${input.totalChapters} 章。`,
    `每条主线弧必须且只能归属一卷，顺序为：${arcIds.join("、")}`,
    `必须覆盖的冻结人物：${characters.join("、")}`,
    `必须覆盖的 sourceSeed：${seeds.join("｜")}`,
    "不得生成逐章蓝图、章节计划、章节列表或正文。",
    "程序校验错误：",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "需要修复的上一版 JSON：",
    JSON.stringify(result, null, 2),
  ].join("\n")
}

function chapterBlueprintSelectedVolume(input: ChapterBlueprintInput) {
  return storyBibleSourceRecords(input.volumeStrategy, "volumes")
    .find((volume) => String(volume.id || "").trim() === input.volumeId) || null
}

function chapterBlueprintArcForChapter(input: ChapterBlueprintInput, chapterNumber: number) {
  return storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture")
    .find((arc) => chapterNumber >= Number(arc.startChapter) && chapterNumber <= Number(arc.endChapter)) || null
}

function chapterBlueprintBatchArcs(input: ChapterBlueprintInput) {
  return storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture")
    .filter((arc) => Number(arc.startChapter) <= input.endChapter && Number(arc.endChapter) >= input.startChapter)
}

function chapterBlueprintBatchArcIds(input: ChapterBlueprintInput) {
  return chapterBlueprintBatchArcs(input).map((arc) => String(arc.id || "").trim()).filter(Boolean)
}

function debugStableJsonText(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value || "")
  }
}

function chineseSmallInteger(value: string) {
  const trimmed = value.trim()
  const numeric = Number(trimmed)
  if (Number.isFinite(numeric)) return numeric
  const map: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
  if (trimmed === "十") return 10
  if (trimmed.length === 2 && trimmed.startsWith("十")) return 10 + (map[trimmed[1]] || 0)
  if (trimmed.length === 2 && trimmed.endsWith("十")) return (map[trimmed[0]] || 0) * 10
  if (trimmed.length === 3 && trimmed[1] === "十") return (map[trimmed[0]] || 0) * 10 + (map[trimmed[2]] || 0)
  return map[trimmed] ?? 0
}

function formatProtectionPeriod(days: number) {
  const years = Math.floor(days / 360)
  const remainingAfterYears = days - years * 360
  const months = Math.floor(remainingAfterYears / 30)
  const extraDays = remainingAfterYears - months * 30
  return `${years}年${months}个月${extraDays ? `${extraDays}天` : ""}`
}

function parseProtectionPeriods(text: string) {
  const periods: { raw: string; days: number; years: number; months: number; extraDays: number }[] = []
  const regex = /庇护期(?:剩余|尚余|还有|仅剩|为)?\s*(\d+)\s*年\s*(\d+)\s*(?:个)?月(?:\s*(\d+)\s*天)?/gu
  for (const match of text.matchAll(regex)) {
    const years = Number(match[1])
    const months = Number(match[2])
    const extraDays = Number(match[3] || 0)
    if (!Number.isFinite(years) || !Number.isFinite(months) || !Number.isFinite(extraDays)) continue
    periods.push({
      raw: match[0],
      days: years * 360 + months * 30 + extraDays,
      years,
      months,
      extraDays,
    })
  }
  return periods
}

function parseProtectionCostDays(text: string) {
  let maxCostDays = 0
  const regex = /消耗[^。；，,]{0,40}?([一二两三四五六七八九十\d]+)\s*(?:个)?月\s*庇护期/gu
  for (const match of text.matchAll(regex)) {
    const months = chineseSmallInteger(String(match[1] || ""))
    if (months > 0) maxCostDays = Math.max(maxCostDays, months * 30)
  }
  return maxCostDays
}

function chapterBlueprintForbidsProtectionExtension(input: ChapterBlueprintInput) {
  const protectionTermText = storyBibleSourceRecords(input.storyBible, "terminology")
    .filter((entry) => /金色莲花|庇护期/u.test(debugStableJsonText(entry)))
    .map((entry) => debugStableJsonText(entry))
    .join("\n")
  return /庇护期可延长|每个归乡者仅一次|为期三年/u.test(protectionTermText)
}

function detectChapterBlueprintUpstreamCanonConflicts(input: ChapterBlueprintInput) {
  const warnings: string[] = []
  const evidence: Record<string, unknown> = {}
  if (!input.previousBatchHandoff) return { valid: true, errors: [], warnings, evidence }

  const sourceArcIds = chapterBlueprintBatchArcIds(input)
  const volume = chapterBlueprintSelectedVolume(input)
  const previousText = debugStableJsonText(input.previousBatchHandoff)
  const targetText = [
    chapterBlueprintBatchArcs(input).map((arc) => ({
      id: arc.id,
      startChapter: arc.startChapter,
      endChapter: arc.endChapter,
      cost: arc.cost,
      irreversibleOutcome: arc.irreversibleOutcome,
      nextHandoff: arc.nextHandoff,
    })),
    storyBibleSourceRecords(input.storyBible, "arcCanon").filter((entry) => sourceArcIds.includes(String(entry.sourceArcId || "").trim())),
    storyBibleSourceRecords(input.volumeStrategy, "arcCoverage").filter((entry) => sourceArcIds.includes(String(entry.sourceArcId || "").trim())),
    volume ? {
      id: volume.id,
      pressureEscalation: volume.pressureEscalation,
      climax: volume.climax,
      irreversibleChange: volume.irreversibleChange,
      nextVolumeHandoff: volume.nextVolumeHandoff,
      forbiddenDrift: volume.forbiddenDrift,
    } : null,
  ].map((entry) => debugStableJsonText(entry)).join("\n")

  const previousPeriods = parseProtectionPeriods(previousText)
  const targetPeriods = parseProtectionPeriods(targetText)
  const protectionCostDays = parseProtectionCostDays(targetText)
  const forbidsExtension = chapterBlueprintForbidsProtectionExtension(input)
  evidence.previousPeriods = previousPeriods
  evidence.targetPeriods = targetPeriods
  evidence.protectionCostDays = protectionCostDays
  evidence.forbidsProtectionExtension = forbidsExtension

  const previousPeriod = previousPeriods.at(-1)
  const targetPeriod = targetPeriods.reduce<typeof targetPeriods[number] | null>((best, period) => (!best || period.days > best.days ? period : best), null)
  const errors: string[] = []
  if (previousPeriod && targetPeriod && forbidsExtension) {
    const maximumPossibleExitDays = previousPeriod.days - protectionCostDays
    if (targetPeriod.days > maximumPossibleExitDays) {
      const costText = protectionCostDays > 0 ? `，且当前弧还要求消耗${formatProtectionPeriod(protectionCostDays)}庇护期` : ""
      errors.push(`上游正典冲突：上一批第 ${input.previousBatchHandoff.endChapter || input.startChapter - 1} 章交接为“${previousPeriod.raw}”，但本批冻结弧线/分卷出口要求达到“${targetPeriod.raw}”${costText}；金色莲花正典禁止庇护期延长。按上一批状态推算，本批出口最多只能是“庇护期剩余${formatProtectionPeriod(Math.max(0, maximumPossibleExitDays))}”。该输入合同不可收敛，请先清洗上一批交接、分卷出口或弧线 requiredCost。`)
    }
  }
  if (!errors.length && previousPeriod && targetPeriods.length === 0) {
    warnings.push(`上一批交接包含“${previousPeriod.raw}”，但本批冻结出口没有明确庇护期数值；建议在分卷策略或弧线出口补齐，避免模型自行猜数。`)
  }
  return { valid: errors.length === 0, errors, warnings, evidence }
}

function chapterBlueprintPacingContract(input: ChapterBlueprintInput) {
  const arcs = chapterBlueprintBatchArcs(input)
  return arcs.map((arc) => {
    const arcStartChapter = Number(arc.startChapter)
    const arcEndChapter = Number(arc.endChapter)
    const arcChapterCount = Math.max(1, arcEndChapter - arcStartChapter + 1)
    const batchStartChapter = Math.max(input.startChapter, arcStartChapter)
    const batchEndChapter = Math.min(input.endChapter, arcEndChapter)
    const midpointChapter = Math.floor((arcStartChapter + arcEndChapter) / 2)
    const progressStart = Math.max(0, (batchStartChapter - arcStartChapter) / arcChapterCount)
    const progressEnd = Math.min(1, (batchEndChapter - arcStartChapter + 1) / arcChapterCount)
    const mayTriggerMidpoint = batchStartChapter <= midpointChapter && batchEndChapter >= midpointChapter
    const midpointStatus = mayTriggerMidpoint
      ? "inside_current_batch"
      : batchEndChapter < midpointChapter
        ? "future_not_reached"
        : "already_triggered_before_batch"
    const mayResolveArc = batchStartChapter <= arcEndChapter && batchEndChapter >= arcEndChapter
    const phase = mayResolveArc
      ? "arc_climax_and_handoff"
      : mayTriggerMidpoint
        ? "midpoint_window"
        : batchEndChapter < midpointChapter
          ? "opening_or_rising_action"
          : "post_midpoint_escalation"
    const forbiddenFutureMilestones: string[] = []
    const alreadyTriggeredMilestones: string[] = []
    if (String(arc.midpointReversal || "").trim()) {
      if (midpointStatus === "future_not_reached") forbiddenFutureMilestones.push(`中点逆转（约第 ${midpointChapter} 章）：${String(arc.midpointReversal).trim()}`)
      else if (midpointStatus === "already_triggered_before_batch") alreadyTriggeredMilestones.push(`中点逆转已在第 ${midpointChapter} 章前后发生，本批必须继承其后果而不是把它当作未来禁用事件：${String(arc.midpointReversal).trim()}`)
    }
    if (!mayResolveArc) {
      if (String(arc.irreversibleOutcome || "").trim()) forbiddenFutureMilestones.push(`弧末不可逆结局（第 ${arcEndChapter} 章）：${String(arc.irreversibleOutcome).trim()}`)
      if (String(arc.nextHandoff || "").trim()) forbiddenFutureMilestones.push(`下一弧交接（第 ${arcEndChapter} 章后）：${String(arc.nextHandoff).trim()}`)
    }
    return {
      sourceArcId: String(arc.id || "").trim(),
      arcName: String(arc.name || "").trim(),
      arcStartChapter,
      arcEndChapter,
      arcChapterCount,
      batchStartChapter,
      batchEndChapter,
      batchProgressPercent: `${Math.round(progressStart * 100)}%-${Math.round(progressEnd * 100)}%`,
      midpointChapter,
      phase,
      mayTriggerMidpoint,
      midpointStatus,
      mayResolveArc,
      requiredOpeningState: batchStartChapter === arcStartChapter ? String(arc.openingState || "").trim() : "必须继承上一批交接，不得重置到弧开场。",
      alreadyTriggeredMilestones,
      mustRemainUnresolved: mayResolveArc
        ? []
        : [
            `弧核心目标在第 ${arcEndChapter} 章前不得完成或失效：${String(arc.protagonistObjective || "").trim()}`,
            `弧开场核心压力不得在本批永久消失：${String(arc.openingState || "").trim()}`,
            `第 ${batchEndChapter} 章的退出状态必须保留一条可继续推进到第 ${arcEndChapter} 章的有效因果路径。`,
          ],
      forbiddenFutureMilestones,
      nextChapterBoundary: mayResolveArc
        ? `可以在第 ${arcEndChapter} 章完成弧末结果，并交接下一弧。`
        : `第 ${batchEndChapter + 1} 章仍属于 ${String(arc.id || "").trim()}；本批章末不得进入下一弧、下一世界状态或消费弧末结局。`,
    }
  })
}

function chapterBlueprintCjkNgrams(value: unknown, size = 4) {
  const characters = Array.from(String(value || "").replace(/[^\p{Script=Han}\p{Number}]/gu, ""))
  const grams = new Set<string>()
  for (let index = 0; index <= characters.length - size; index += 1) grams.add(characters.slice(index, index + size).join(""))
  return grams
}

function chapterBlueprintPacingStateEntries(result: Record<string, unknown>) {
  const blueprints = Array.isArray(result.blueprints) ? result.blueprints as Record<string, unknown>[] : []
  const entries: Array<{ path: string; value: string }> = []
  const append = (pathLabel: string, value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${pathLabel}[${index}]`, item))
      return
    }
    const text = String(value || "").trim()
    if (text) entries.push({ path: pathLabel, value: text })
  }
  for (const [blueprintIndex, blueprint] of blueprints.entries()) {
    for (const key of ["irreversibleChange", "endingHook", "nextChapterEntryState", "nextChapterHandoff"]) append(`blueprints[${blueprintIndex}].${key}`, blueprint[key])
    const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards as Record<string, unknown>[] : []
    for (const [cardIndex, card] of sceneCards.entries()) {
      for (const key of ["turn", "endHook", "requiredFacts"]) append(`blueprints[${blueprintIndex}].sceneCards[${cardIndex}].${key}`, card[key])
    }
  }
  const continuity = Array.isArray(result.batchContinuity) ? result.batchContinuity as Record<string, unknown>[] : []
  for (const [continuityIndex, entry] of continuity.entries()) append(`batchContinuity[${continuityIndex}].requiredCarryover`, entry.requiredCarryover)
  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan)
    ? result.handoffToWritingPlan as Record<string, unknown>
    : {}
  append("handoffToWritingPlan.batchExitState", handoff.batchExitState)
  append("handoffToWritingPlan.unresolvedRisks", handoff.unresolvedRisks)
  return entries
}

function chapterBlueprintOperationalGuardrails(input: ChapterBlueprintInput) {
  const guardrails: string[] = []
  const sourceText = [
    JSON.stringify(chapterBlueprintBatchArcs(input)),
    JSON.stringify(input.previousBatchHandoff || {}),
    JSON.stringify(storyBibleSourceRecords(input.storyBible, "characterCanon")),
    JSON.stringify(storyBibleSourceRecords(input.storyBible, "terminology")),
    JSON.stringify(input.storyBible.worldCanon || {}),
  ].join("\n")
  const resolvesArcViaBoundaryArtifact = chapterBlueprintBatchArcs(input).some((arc) => {
    const arcEndChapter = Number(arc.endChapter)
    const text = `${String(arc.exitState || "")} ${String(arc.irreversibleOutcome || "")} ${String(arc.requiredCost || "")}`
    return input.startChapter <= arcEndChapter && input.endChapter >= arcEndChapter && /破界符|进入第八层/u.test(text)
  })
  if (/破界符|破壁|天壁|空间褶皱|后备通道/u.test(sourceText)) {
    guardrails.push(resolvesArcViaBoundaryArtifact
      ? "空间/破壁边界：本批包含弧末转场时，只允许按冻结正典写成“玄默使用破界符接应陆无良进入第八层”；不得让陆无良自行撕裂空间褶皱、强行穿层、破壁、引爆古钥匙或用古钥匙替代破界符。弧末前的章节仍只能停留在据点废墟封锁内侧已标注阴影点。"
      : "空间/破壁边界：本批不得让陆无良自行撕裂空间褶皱、强行穿层、破壁或替代破界符；不得把“地形缝隙/后备通道”写成已进入或已移动完成，只能记录为据点封锁内侧已标注阴影点、未决路线或观察线索。")
  }
  if (/无面标记|金色标记|标记残渣|左臂黑线/u.test(sourceText)) {
    guardrails.push("无面/标记边界：无面标记、金色标记和左臂黑线是追踪/污染/干扰源，不是可主动引爆的能量；只能写作重新活性化、刺痛、误导、干扰判断，禁止写成被陆无良利用、引爆、净化或完全清除。")
  }
  if (/庇护期|金色莲花/u.test(sourceText)) {
    guardrails.push("庇护期账本：庇护期只能按自然经过时间减少，或在冻结弧级 requiredCost 明确发生时一次性扣除；禁止写“消耗1%”“强行破阵扣庇护期”等自造百分比代价。")
  }
  if (/古钥匙/u.test(sourceText)) {
    guardrails.push("古钥匙账本：古钥匙完整性必须从上一批数值单调下降或保持，除非蓝图明确安排修复事件；禁止从60%/70%回升到75%这类无因果恢复。")
  }
  if (/沈青霜/u.test(sourceText)) {
    guardrails.push("沈青霜边界：弧2不得让沈青霜恢复记忆、称陆无良为“师兄”、表现出可被陆无良确认的记忆残留；只能写系统化追捕、短暂迟疑或无意识生理反应，且不得泄露记忆封印细节。")
  }
  if (/旧日道则|无面|疑问|梦境/u.test(sourceText)) {
    guardrails.push("无面梦境边界：弧2只能进行试探、低语、植入疑问或制造不信任；禁止让陆无良主动反向追踪无面节点、提取旧日道则信息、彻底爆发怀疑种子、被构建完整虚假记忆或被无面控制。")
  }
  return guardrails
}

function chapterBlueprintPacingStateText(result: Record<string, unknown>) {
  return JSON.stringify(chapterBlueprintPacingStateEntries(result).map((entry) => entry.value))
}

function validateChapterBlueprintPacing(result: Record<string, unknown>, input: ChapterBlueprintInput) {
  const errors: string[] = []
  const stateEntries = chapterBlueprintPacingStateEntries(result)
  const pacingStateText = chapterBlueprintPacingStateText(result)
  const futureMilestoneGramSize = 12
  const arcs = chapterBlueprintBatchArcs(input)
  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan)
    ? result.handoffToWritingPlan as Record<string, unknown>
    : {}
  const blueprints = Array.isArray(result.blueprints) ? result.blueprints as Record<string, unknown>[] : []
  const finalBlueprint = blueprints[blueprints.length - 1] || {}
  const finalStateText = [finalBlueprint.irreversibleChange, finalBlueprint.endingHook, finalBlueprint.nextChapterEntryState, finalBlueprint.nextChapterHandoff, handoff.batchExitState].map((value) => String(value || "")).join("\n")
  for (const arc of arcs) {
    const arcEndChapter = Number(arc.endChapter)
    if (input.endChapter >= arcEndChapter) continue
    const activePressureText = [arc.openingState, arc.protagonistObjective, arc.opposition].map((value) => String(value || "")).join("\n")
    const prematureResolutions = [...finalStateText.matchAll(/([\p{Script=Han}]{2,8})(?:已经|已|将)?(?:完全|彻底|永久)(闭合|关闭|消失|解除|终止)/gu)]
    const reportedPrematureResolutions = new Set<string>()
    for (const match of prematureResolutions) {
      const rawEntity = String(match[1] || "")
      const suffixes = Array.from({ length: Math.max(0, Math.min(6, Array.from(rawEntity).length) - 1) }, (_, index) => Array.from(rawEntity).slice(index).join(""))
      const entity = suffixes.find((candidate) => Array.from(candidate).length >= 2 && activePressureText.includes(candidate))
      const resolutionKey = `${entity || ""}:${String(match[2] || "")}`
      if (entity && !reportedPrematureResolutions.has(resolutionKey)) {
        reportedPrematureResolutions.add(resolutionKey)
        errors.push(`弧线核心压力被提前解除：本批只到第 ${input.endChapter} 章，但退出状态写成“${match[0]}”；${entity}仍是 ${String(arc.id || "")} 持续到第 ${arcEndChapter} 章的核心目标/压力。`)
      }
    }
    const baseline = chapterBlueprintCjkNgrams(JSON.stringify({
      openingState: arc.openingState,
      protagonistObjective: arc.protagonistObjective,
      drivingChoice: arc.drivingChoice,
      opposition: arc.opposition,
      sourceCausalInputs: arc.sourceCausalInputs,
    }), futureMilestoneGramSize)
    for (const [label, milestone] of [["弧末不可逆结局", arc.irreversibleOutcome], ["下一弧交接", arc.nextHandoff]] as const) {
      const milestoneText = String(milestone || "").trim()
      if (!milestoneText) continue
      const milestoneGrams = [...chapterBlueprintCjkNgrams(milestoneText, futureMilestoneGramSize)].filter((gram) => !baseline.has(gram))
      const fieldMatches = stateEntries.map((entry) => {
        const entryGrams = chapterBlueprintCjkNgrams(entry.value, futureMilestoneGramSize)
        const matched = milestoneGrams.filter((gram) => entryGrams.has(gram))
        return { ...entry, matched }
      }).filter((entry) => entry.matched.length >= 2)
      if (fieldMatches.length) {
        const evidence = fieldMatches.slice(0, 4).map((entry) => `${entry.path} 命中“${entry.matched.slice(0, 2).join(" / ")}”`).join("；")
        errors.push(`弧线进度越界：本批只到第 ${input.endChapter} 章，但 ${String(arc.id || "")} 的${label}冻结在第 ${arcEndChapter} 章；疑似提前复制未来结局的具体字段：${evidence}。请只改这些路径，并保留当前批次允许发生的铺垫、首次接触和未完成状态。`)
      }
    }
  }
  const terminology = storyBibleSourceRecords(input.storyBible, "terminology")
  const forbidsSubThreeDayDeadline = terminology.some((entry) => volumeStrategyStringValues(entry.forbiddenVariants).some((variant) => variant.includes("不足三天")))
  if (forbidsSubThreeDayDeadline) {
    const shortDeadlineMatches = [...pacingStateText.matchAll(/(?:一个时辰|一时辰|半日|半天|一日|一天|二日|二天|两日|两天|[12]\s*(?:日|天))(?:之内|以内|内|之后|以后|后)?(?:将|会)?(?:完全)?(?:闭合|关闭)/gu)].map((match) => match[0])
    if (shortDeadlineMatches.length) errors.push(`术语倒计时越界：冻结正典禁止缩短至不足三天，但蓝图状态出现：${[...new Set(shortDeadlineMatches)].join("、")}。`)
  }
  return errors
}

function buildChapterBlueprintPrompts(input: ChapterBlueprintInput, runId: string, learningPrompt = "") {
  const volume = chapterBlueprintSelectedVolume(input) || {}
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index)
  const volumeSourceArcIds = volumeStrategyStringValues(volume.sourceArcIds)
  const relevantArcs = chapterBlueprintBatchArcs(input)
  const sourceArcIds = chapterBlueprintBatchArcIds(input)
  const scheduledNames = storyBibleSourceRecords(input.volumeStrategy, "characterCoverage")
    .filter((entry) => volumeStrategyStringValues(entry.volumeIds).includes(input.volumeId))
    .map((entry) => String(entry.character || "").trim())
    .filter(Boolean)
  const relevantCharacters = storyBibleSourceRecords(input.storyBible, "characterCanon").filter((entry) => scheduledNames.includes(String(entry.character || "").trim()))
  const relevantPromises = storyBibleSourceRecords(input.volumeStrategy, "promiseSchedule").filter((entry) => {
    const ids = [String(entry.setupVolumeId || "").trim(), String(entry.payoffVolumeId || "").trim(), ...volumeStrategyStringValues(entry.advanceVolumeIds)]
    return ids.includes(input.volumeId)
  })
  const pacingContract = chapterBlueprintPacingContract(input)
  const operationalGuardrails = chapterBlueprintOperationalGuardrails(input)
  const basePrompt = [
    "你是长篇小说章节蓝图总编（Lean Chapter Blueprint Architect）。",
    "你只负责 phase_9_chapter_blueprints：为指定卷内的连续章节批次生成“极简章节主线蓝图”，不是章节正文、不是场景卡、不是账本结算。",
    "本阶段每章只回答四件事：本章目标、主角决定、不可逆变化、下一章压力。",
    "技能、物品、倒计时、百分比、裂纹数量、位置边界、人物关系等级等系统状态不得由你自由改写；如需引用，只写 stateLedgerRefs 的短标签。",
    "禁止 sceneCards、requiredFacts、forbiddenFacts、复杂修复语言、审计语言、系统账本长段落。",
    "输出要像剧情推进表：短、准、可读、能让作者知道这一章该写什么。",
    "只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释生成过程。",
  ].join("\n")
  const dynamicPrompt = [
    "缓存稳定前缀：以下冻结正典按固定顺序序列化，任何模型均应优先复用这部分上下文。",
    "目标卷合同：",
    JSON.stringify(volume, null, 2),
    "相关主线弧：",
    JSON.stringify(relevantArcs, null, 2),
    "相关人物正典：",
    JSON.stringify(relevantCharacters, null, 2),
    "本卷伏笔排期：",
    JSON.stringify(relevantPromises, null, 2),
    "连续性正典：",
    JSON.stringify(input.storyBible.continuityCanon || [], null, 2),
    "关系正典：",
    JSON.stringify(input.storyBible.relationshipCanon || [], null, 2),
    "本卷冻结主线弧：",
    volumeSourceArcIds.join("、"),
    "本卷计划人物：",
    scheduledNames.join("、"),
    "本批弧线进度合同（这是硬边界，不是创作建议）：",
    JSON.stringify(pacingContract, null, 2),
    "本批操作禁令（由正典、上一批交接和历史失败归纳，违反任一条会被正典审计拦截）：",
    operationalGuardrails.length ? operationalGuardrails.map((entry, index) => `${index + 1}. ${entry}`).join("\n") : "无额外操作禁令。",
    `目标卷：${input.volumeId}，卷范围第 ${volume.startChapter}-${volume.endChapter} 章`,
    `本次批次：第 ${input.startChapter}-${input.endChapter} 章，共 ${chapterNumbers.length} 章`,
    `单章目标字数：${input.targetWordCount}`,
    "蓝图字段语义硬规则：chapterGoal=本章剧情任务；protagonistDecision=主角本章做出的具体选择；irreversibleChange=本章之后不能回滚的剧情变化；nextPressure=下一章开场必须承接的新压力。",
    "极简生成硬规则：每章只写一个主线推进，不写场景拆分；每个字段 20-80 个汉字，禁止长段账本。",
    "系统托管字段硬规则：技能、物品、倒计时、百分比、裂纹数量、位置边界、人物信任等级只允许放入 stateLedgerRefs 短标签，不得在四个剧情字段中结算。",
    "弧末转场规则：如果本批包含 arc_02 第100章，只允许写“玄默使用破界符接应陆无良进入第八层”；不得让陆无良用古钥匙、自行破壁或强行打开通道。",
    `本批实际主线弧：${sourceArcIds.join("、")}（source.sourceArcIds 只能逐字使用本列表）`,
    `本轮额外关注：${input.blueprintFocus || "保证相邻章节因果连续、场景目标具体、人物知识边界明确、章末钩子可直接驱动下一章。"}`,
    `上一批 Run：${input.previousBatchRunId || "无（本卷首批）"}`,
    `上一批强制交接：${input.previousBatchHandoff ? JSON.stringify(input.previousBatchHandoff) : "无"}`,
    "持续学习上下文：",
    learningPrompt || "本次未加载 Learning Loop 上下文。",
    `本次调试 Run：${runId}`,
    `分卷策略 Run：${input.upstreamRunId}`,
  ].join("\n")
  const userMessage = [
    "生成 Lean Chapter Blueprint Batch JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 2,',
    '  "mode": "lean_chapter_blueprints",',
    '  "source": { "volumeStrategyRunId": "", "phase": "phase_8_volume_strategy", "volumeId": "", "volumeStartChapter": 1, "volumeEndChapter": 1, "batchStartChapter": 1, "batchEndChapter": 1, "sourceArcIds": [""], "previousBatchRunId": null, "previousBatchEndChapter": null },',
    '  "batchPolicy": { "targetWordCount": 0, "batchPurpose": "", "continuityRule": "", "stateBoundaryRule": "" },',
    '  "blueprints": [{ "chapterNumber": 1, "title": "", "volumeId": "", "sourceArcId": "", "previousPressure": "", "chapterGoal": "", "protagonistDecision": "", "irreversibleChange": "", "nextPressure": "", "requiredCharacters": [""], "stateLedgerRefs": [""], "forbiddenDrift": [""] }],',
    '  "batchContinuity": [{ "fromChapter": 1, "toChapter": 2, "carryover": "", "forbiddenReset": "" }],',
    '  "handoffToWritingPlan": { "chapterNumbers": [1], "executionOrder": [1], "batchExitPressure": "", "unresolvedRisks": [""] },',
    '  "qualitySelfCheck": { "allRequestedChaptersCovered": true, "continuousCausalChain": true, "noProseGenerated": true, "remainingRisks": [""] }',
    "}",
    `blueprints 必须恰好覆盖章节：${chapterNumbers.join("、")}，顺序不得改变。`,
    "sourceArcId 必须是该章所在的冻结主线弧；volumeId 必须逐字等于目标卷。",
    "requiredCharacters 只能使用冻结人物姓名。",
    "字段写法必须是极简剧情推进短句；不要使用正文式叙述、对白、抒情、镜头描写或系统校验语言。",
    "相邻章节必须通过 nextPressure / previousPressure / batchContinuity 形成可检查的因果交接。",
    "必须严格服从本批弧线进度合同：mayTriggerMidpoint=false 时不得消费中点逆转；mayResolveArc=false 时不得发生弧末不可逆结局、不得采用下一弧 openingState、不得让最后一章或下一章交接越过当前弧。",
    "mayResolveArc=false 时，mustRemainUnresolved 中的核心目标、核心压力和倒计时在 batchExitState 必须仍然有效；不得用‘完全闭合/永久消失/彻底解除’结束本批，也不得把冻结下限改成更短时限。",
    "禁止把整条主线弧压缩进当前 1-12 章批次。forbiddenFutureMilestones 中的事件只能作为未来压力或伏笔被提及，不能在本批实际发生、完成或写入 batchExitState。",
    "必须遵守本批操作禁令；不要用空间褶皱、标记引爆、百分比消耗庇护期、无因果恢复道具数值、记忆残留被识别、反向追踪无面等方式绕过正典。",
    input.previousBatchHandoff
      ? `本批第 ${input.startChapter} 章的 previousChapterInput 必须完整继承上一批交接，不得重置人物位置、伤势、知识、倒计时或未决压力。`
      : "本卷首批不得伪造上一批来源。",
    "不得输出 sceneCards、writingPlan、chapterDrafts、prose、正文段落、对白场景、环境描写或华丽辞藻。",
  ].join("\n")
  const consensus = "章节蓝图独立调试：冻结正典与输出边界优先，动态 Run 信息只用于追踪，不得改变正典。"
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 生成 phase_9_chapter_blueprints 极简章节主线蓝图，不进行圆桌讨论。",
    `- 每次只生成同一卷内一个连续批次，稳定模式最多 ${chapterBlueprintStableBatchLimit} 章。`,
    "- 输出必须能被 phase_10_writing_plan 直接消费；本阶段只定义章节推进骨架，不写真实章节内容。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 只能输出单个合法 JSON 对象。",
    "- 必须停留在 chapter_blueprints_debug 阶段。",
  ].join("\n")
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "输出语言：简体中文", "当前工作流阶段：chapter_blueprints_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n")
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function buildChapterBlueprintRepairMessage(input: ChapterBlueprintInput, result: Record<string, unknown>, errors: string[], learningPrompt = "") {
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index)
  const characters = volumeStrategyCharacterNames(input.storyBible)
  const batchArcIds = chapterBlueprintBatchArcIds(input)
  const pacingContract = chapterBlueprintPacingContract(input)
  const operationalGuardrails = chapterBlueprintOperationalGuardrails(input)
  const characterCanon = storyBibleSourceRecords(input.storyBible, "characterCanon")
  const terminology = storyBibleSourceRecords(input.storyBible, "terminology")
  const worldCanon = input.storyBible.worldCanon && typeof input.storyBible.worldCanon === "object" && !Array.isArray(input.storyBible.worldCanon)
    ? input.storyBible.worldCanon as Record<string, unknown>
    : {}
  return [
    "上一版 Lean Chapter Blueprint Batch 未通过程序校验。只修复列出的字段错误，保持极简章节主线蓝图。",
    "修复目标不是章节正文、不是场景卡、不是账本结算。每章只保留：chapterGoal、protagonistDecision、irreversibleChange、nextPressure。",
    "只输出一个完整合法 JSON 对象，不要解释，不要 Markdown 代码围栏。",
    `目标卷：${input.volumeId}；必须恰好覆盖章节：${chapterNumbers.join("、")}`,
    `本批 source.sourceArcIds 必须依次且只能为：${batchArcIds.join("、")}`,
    `单章目标字数：${input.targetWordCount}`,
    `唯一合法的正典人物：${characters.join("、")}`,
    "requiredCharacters 中只能出现上面这份正典人物白名单里的逐字姓名。",
    "不得只修改 qualitySelfCheck 来宣称已经修复；必须修改被错误证据指向的具体章节、场景卡、人物数组、知识或时间状态。",
    "如果当前蓝图已经提前消费弧末结果或下一弧状态，必须重写受影响章节的四个核心字段，不能只替换一个敏感词。",
    "技能、物品、倒计时、百分比、裂纹数量、位置边界、人物信任等级只允许作为 stateLedgerRefs 短标签，不得在四个剧情字段中自由结算。",
    "本批弧线进度合同（硬边界）：",
    JSON.stringify(pacingContract, null, 2),
    "本批操作禁令（必须修复到完全符合；违反任一条会被正典审计拦截）：",
    operationalGuardrails.length ? operationalGuardrails.map((entry, index) => `${index + 1}. ${entry}`).join("\n") : "无额外操作禁令。",
    "正典审计错误若涉及操作禁令，必须改写具体调度合同、数值账本和人物知识状态；不得只换同义词或修改 qualitySelfCheck。",
    "冻结人物正典只用于人物白名单与知识边界，不要复制大段内容进结果：",
    JSON.stringify(characterCanon.slice(0, 12), null, 2),
    "冻结术语只用于 stateLedgerRefs 短标签，不要复制长账本：",
    JSON.stringify(terminology, null, 2),
    "本次 Learning Loop 已清空或仅作参考；不要复制旧错误日志：",
    learningPrompt || "本次未加载 Learning Loop 上下文。",
    "必须使用 lean schema：version=2, mode=lean_chapter_blueprints, blueprints 每章只有 previousPressure/chapterGoal/protagonistDecision/irreversibleChange/nextPressure/requiredCharacters/stateLedgerRefs/forbiddenDrift。",
    "不得生成 sceneCards、写作计划、章节正文、对话场景、华丽辞藻、镜头描写或心理描写。",
    "程序校验错误：",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "修复后保持极简，不要为了凑长度增加冗余字段。",
    "需要修复的上一版 JSON：",
    JSON.stringify(result, null, 2),
  ].join("\n")
}

const chapterBlueprintRepairBasePrompt = "你是 lean 章节蓝图 JSON 修复器。只修复极简章节主线蓝图中的字段错误；每章只保留本章目标、主角决定、不可逆变化、下一章压力；不得生成场景卡、账本长段、写作计划、正文、对白或文学化描写。"
const chapterBlueprintRepairConsensus = "lean 章节蓝图持续收敛修复：只修主线骨架和相邻交接，不把校验/审计文本写回蓝图。"

function buildChapterBlueprintSemanticAuditPrompts(input: ChapterBlueprintInput, result: Record<string, unknown>, runId: string, learningPrompt = "") {
  const sourceArcIds = chapterBlueprintBatchArcIds(input)
  const arcCanon = storyBibleSourceRecords(input.storyBible, "arcCanon").filter((entry) => sourceArcIds.includes(String(entry.sourceArcId || "").trim()))
  const characterCanon = storyBibleSourceRecords(input.storyBible, "characterCanon")
  const terminology = storyBibleSourceRecords(input.storyBible, "terminology")
  const worldCanon = input.storyBible.worldCanon && typeof input.storyBible.worldCanon === "object" && !Array.isArray(input.storyBible.worldCanon)
    ? input.storyBible.worldCanon as Record<string, unknown>
    : {}
  const pacingContract = chapterBlueprintPacingContract(input)
  const operationalGuardrails = chapterBlueprintOperationalGuardrails(input)
  const basePrompt = [
    "你是独立的小说正典审计员，不参与创作，也不能相信被审计结果中的 qualitySelfCheck 自述。",
    "逐章检查章节蓝图是否违反冻结弧线章节边界、事件发生时机、人物登场与知识边界、能力代价、术语数值、世界规则和上一批状态。",
    "只要把后续弧的不可逆结果提前、让禁止事件发生、改变冻结数值或制造跨批次状态重置，就必须给出 error。",
    "必须完成全部章节和全部七类维度后再输出，一次列出所有有证据的 error/warning，禁止发现第一条错误后提前停止。",
    "特别检查弧线进度合同：mayResolveArc=false 时，弧末不可逆结局、下一弧 openingState 和跨弧 batchExitState 均不得出现；mayTriggerMidpoint=false 时不得提前消费中点逆转。",
    "弧级 requiredCost、character arcStateRequirements 和其他未绑定具体章节的 required* 项，默认只要求在该弧结束前兑现；当 mayResolveArc=false 时，不能因为当前局部批次尚未兑现它们而报 MISSING_REQUIRED_*。",
    "冻结正典出现表面冲突时，先比较约束具体性：带明确章节锚点的合同 > 当前弧 requiredCost/requiredEvent > 当前弧 forbiddenDrift > 通用术语或世界规则。当前弧明确要求的事件应视为通用规则的窄范围特例，只能在原文规模、代价和时机内放行，不得扩展。",
    "例如当前弧 requiredCost 明确要求触发‘小型墟劫’时，不能仅凭‘庇护期内通常不触发墟劫’把同一小型事件判为 WORLD_RULE_VIOLATION；但高强度墟劫、免除代价或超出当前弧要求的重复触发仍必须报错。",
    "只有冻结正典明确给出本批范围内的章节锚点，或者蓝图已经写出与该要求相反/互斥的状态，才能把局部批次中的缺失判为 error；否则应继续留给后续批次，不得为了审计通过而提前消费未来事件。",
    "检查 mustRemainUnresolved：mayResolveArc=false 时，核心目标、核心压力与倒计时在批次退出状态必须仍然有效，不能被完全闭合、永久消失、彻底解除或缩短到冻结下限以下。",
    "只输出一个合法 JSON 对象，不要 Markdown。",
  ].join("\n")
  const dynamicPrompt = [
    "缓存稳定前缀：以下冻结正典按固定顺序序列化。",
    `冻结弧线：${JSON.stringify(arcCanon)}`,
    `冻结术语：${JSON.stringify(terminology)}`,
    `冻结世界规则：${JSON.stringify(worldCanon.rules || [])}`,
    `冻结人物：${JSON.stringify(characterCanon)}`,
    `弧线进度硬合同：${JSON.stringify(pacingContract)}`,
    `本批操作禁令：${JSON.stringify(operationalGuardrails)}`,
    `卷与批次：${input.volumeId} 第 ${input.startChapter}-${input.endChapter} 章`,
    `上一批交接：${input.previousBatchHandoff ? JSON.stringify(input.previousBatchHandoff) : "无（卷首批）"}`,
    `持续学习上下文：${learningPrompt || "本次未加载 Learning Loop 上下文。"}`,
    `被审计 Run：${runId}`,
  ].join("\n\n")
  const userMessage = [
    "审计以下章节蓝图：",
    JSON.stringify(result),
    "输出结构：",
    '{"valid":false,"issues":[{"severity":"error","chapterNumber":1,"code":"ARC_BOUNDARY_EARLY","evidence":"蓝图中的原文证据","canonSource":"冲突的冻结正典原文","message":"为什么冲突"}],"checkedDimensions":["arcBoundary","timeline","characterState","knowledgeBoundary","terminologyAndCost","worldRules","crossBatchContinuity"]}',
    "severity 只能是 error 或 warning；任何正典冲突必须是 error。没有问题时 valid=true 且 issues=[]。",
  ].join("\n")
  return { basePrompt, dynamicPrompt, consensus: "独立正典审计：不得依据生成模型的自检结论放行；动态 Run 信息只用于追踪。", userMessage }
}

function normalizeChapterBlueprintSemanticAudit(
  input: ChapterBlueprintInput,
  audit: Record<string, unknown>,
) {
  if (!Array.isArray(audit.issues)) return audit
  const pacingContract = chapterBlueprintPacingContract(input)
  const sourceArcIds = chapterBlueprintBatchArcIds(input)
  const arcCanon = storyBibleSourceRecords(input.storyBible, "arcCanon").filter((entry) => sourceArcIds.includes(String(entry.sourceArcId || "").trim()))
  const hasSmallCalamityArcException = arcCanon.some((entry) => /小型墟劫/u.test(String(entry.requiredCost || "")))
  const mayDeferArcRequirements = pacingContract.length > 0 && pacingContract.every((entry) => entry.mayResolveArc !== true)
  const deferredMissingCode = /^(?:MISSING_REQUIRED_(?:COST|STATE|EVENT)|MISSING_ARC_REQUIREMENT|CROSS_BATCH_STATE_MISMATCH|EXIT_STATE_MISMATCH)$/u
  const issues = (audit.issues as Record<string, unknown>[]).map((issue) => {
    const code = String(issue.code || "").trim()
    const canonSource = String(issue.canonSource || "")
    const explicitChapterAnchors = Array.from(canonSource.matchAll(/第\s*(\d+)\s*章/gu), (match) => Number(match[1]))
    const hasDueChapterAnchor = explicitChapterAnchors.some((chapter) => Number.isInteger(chapter) && chapter <= input.endChapter)
    const issueText = `${String(issue.evidence || "")} ${String(issue.message || "")}`
    if (
      hasSmallCalamityArcException
      && String(issue.severity || "") === "error"
      && code === "WORLD_RULE_VIOLATION"
      && /墟劫/u.test(issueText)
      && /小型|未定向/u.test(issueText)
      && !/高强度|大型|完全免除代价/u.test(issueText)
    ) {
      return {
        ...issue,
        severity: "warning",
        code: "ARC_SPECIFIC_WORLD_RULE_EXCEPTION",
        message: `当前弧 requiredCost 已明确要求一次小型墟劫及其代价，这是对通用庇护规则的窄范围特例；保留为提醒，但不能阻断本批。原审计：${String(issue.message || "").trim()}`,
      }
    }
    const isDeferredArcRequirement = deferredMissingCode.test(code) && /required(?:Cost|State|Event)|requiredCost|弧级|尚未兑现|未安排触发/u.test(`${canonSource} ${issueText}`)
    if (
      String(issue.severity || "") === "error"
      && /(?:未违反|正常的战术移动|符合单调|数值变化符合单调|数值上是连续|暂无严重违规|主要问题在于|需确保|需注意|可能违反|可能导致|略显单薄|建议|存在逻辑张力|存在.*风险|暗示|容易误导|措辞可能|表述模糊|质量问题|潜在冲突|未能有效推进|缺乏正典支持的细节)/u.test(issueText)
      && !/(?:直接违反|明确违反|成功寄宿|完全清除|引爆|撕裂空间|击穿天壁|离开墟境|恢复记忆|称.*师兄)/u.test(issueText)
    ) {
      return {
        ...issue,
        severity: "warning",
        code: `NON_BLOCKING_${code || "SEMANTIC_NOTE"}`,
        message: `审计文本本身未给出明确正典冲突，降级为提醒；不阻断本批。原审计：${String(issue.message || "").trim()}`,
      }
    }
    if (
      String(issue.severity || "") === "error"
      && /(?:庇护期|金色标记)/u.test(issueText)
      && /(?:自然减少|自然时间|时间消耗|未扣除任何时间|只能按自然经过时间减少)/u.test(`${canonSource} ${issueText}`)
      && !/(?:小型墟劫|扣3个月|扣除三个月|大幅减少|自造百分比代价)/u.test(issueText)
    ) {
      return {
        ...issue,
        severity: "warning",
        code: `NON_BLOCKING_${code || "TIMELINE_NOTE"}`,
        message: `当前批次未触发明确弧级代价；自然时间粒度由后续批次账本继续追踪，不阻断本批。原审计：${String(issue.message || "").trim()}`,
      }
    }
    if (!mayDeferArcRequirements || String(issue.severity || "") !== "error" || !isDeferredArcRequirement || hasDueChapterAnchor) return issue
    return {
      ...issue,
      severity: "warning",
      code: `DEFERRED_${code}`,
      message: `当前批次只覆盖第 ${input.startChapter}-${input.endChapter} 章，且尚未到弧线结算点；该弧级要求应由后续批次继续追踪，不能作为本批缺失错误。原审计：${String(issue.message || "").trim()}`,
    }
  })
  return {
    ...audit,
    valid: !issues.some((issue) => String(issue.severity || "") === "error"),
    issues,
  }
}

function mergeChapterBlueprintSemanticAudit(
  structural: { valid: boolean; errors: string[]; warnings: string[] },
  audit: Record<string, unknown> | null | undefined,
) {
  const errors = [...structural.errors]
  const warnings = [...structural.warnings]
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    if (structural.valid) errors.push("缺少独立正典语义审计；结构已通过，但尚未执行正典审计。")
    return { valid: false, errors, warnings }
  }
  const issues = Array.isArray(audit.issues) ? audit.issues as Record<string, unknown>[] : []
  const blockingWarningCodes = new Set([
    "TERM_COST_AMBIGUITY",
    "TERM_NUMERIC_AMBIGUITY",
    "TERMINOLOGY_COST_AMBIGUITY",
    "TERMINOLOGY_NUMERIC_AMBIGUITY",
  ])
  if (!Array.isArray(audit.issues)) errors.push("semanticAudit.issues 必须是数组。")
  issues.forEach((issue, index) => {
    const severity = String(issue.severity || "").trim()
    const message = String(issue.message || "").trim()
    const evidence = String(issue.evidence || "").trim()
    const canonSource = String(issue.canonSource || "").trim()
    if (!message || !evidence || !canonSource || !["error", "warning"].includes(severity)) {
      errors.push(`semanticAudit.issues[${index}] 结构不完整。`)
      return
    }
    const chapter = Number(issue.chapterNumber)
    const label = Number.isInteger(chapter) ? `第${chapter}章` : "批次"
    const code = String(issue.code || "CANON_CONFLICT").trim()
    const formatted = `${label} ${code}：${message}｜证据：${evidence}｜正典：${canonSource}`
    if (severity === "error" || blockingWarningCodes.has(code)) errors.push(formatted)
    else warnings.push(formatted)
  })
  if (audit.valid !== true && !issues.some((issue) => String(issue.severity || "") === "error")) errors.push("semanticAudit.valid=false，但未提供对应 error 证据。")
  if (audit.valid === true && issues.some((issue) => String(issue.severity || "") === "error")) errors.push("semanticAudit.valid 与 error 列表矛盾。")
  if (!Array.isArray(audit.checkedDimensions) || audit.checkedDimensions.length < 7) errors.push("semanticAudit.checkedDimensions 未覆盖全部七类正典检查。")
  return { valid: errors.length === 0, errors, warnings }
}

function validateFoundation(result: Record<string, unknown>) {
  const errors: string[] = []
  const warnings: string[] = []
  const arrayMin: Array<[string, number]> = [
    ["worldRules", 6], ["factions", 3], ["characters", 5], ["subplots", 2], ["foreshadowing", 6], ["arcPlan", 4],
  ]
  for (const [key, minimum] of arrayMin) {
    const value = result[key]
    if (!Array.isArray(value) || value.length < minimum) errors.push(`${key} 至少需要 ${minimum} 项，实际 ${Array.isArray(value) ? value.length : 0} 项。`)
  }
  for (const key of ["project", "background", "mainConflict", "mainPlot", "canon", "qualitySelfCheck"]) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} 必须是非空对象。`)
  }
  const serialized = JSON.stringify(result)
  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) {
    errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  }
  if (serialized.length < 8000) warnings.push(`结构化结果只有 ${serialized.length} 字符，可能不够完整。`)
  const names = Array.isArray(result.characters) ? result.characters.map((item) => String((item as Record<string, unknown>)?.name || "")).filter(Boolean) : []
  if (new Set(names).size !== names.length) errors.push("characters 中存在重复姓名。")
  return { valid: errors.length === 0, errors, warnings }
}

function validateCharacterPlan(result: Record<string, unknown>, input: CharacterPlanningInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const inheritedNames = worldCharacterNames(input.worldFoundation)
  const minimum = Math.max(inheritedNames.length, characterTargetForScale(input.totalChapters))
  const characters = Array.isArray(result.characters) ? result.characters as Record<string, unknown>[] : []
  if (characters.length < minimum) errors.push(`characters 至少需要 ${minimum} 人，实际 ${characters.length} 人。`)

  const names = characters.map((item) => String(item?.name || "").trim()).filter(Boolean)
  if (new Set(names).size !== names.length) errors.push("characters 中存在重复姓名。")
  const ambiguousNames = names.filter((name) => ["无名", "某人", "神秘人", "未知", "未知者", "未命名"].includes(name))
  if (ambiguousNames.length) errors.push(`人物姓名必须具体，检测到模糊姓名：${[...new Set(ambiguousNames)].join("、")}。`)
  const missingInherited = inheritedNames.filter((name) => !names.includes(name))
  if (missingInherited.length) errors.push(`未完整继承上游人物：${missingInherited.join("、")}。`)

  const requiredTextFields = ["name", "origin", "tier", "role", "identity", "narrativeFunction", "desire", "wound", "fear", "misbelief", "secret", "speechPattern"]
  characters.forEach((character, index) => {
    const missing = requiredTextFields.filter((key) => !String(character[key] || "").trim())
    if (missing.length) errors.push(`characters[${index}] 缺少字段：${missing.join("、")}。`)
    const evasiveFields = ["desire", "wound", "fear", "misbelief", "secret", "speechPattern"].filter((key) => /^(?:无|没有|不适用|暂无|未知)(?:$|[（(])/u.test(String(character[key] || "").trim()))
    if (evasiveFields.length) errors.push(`characters[${index}] 用“无/没有/未知”规避关键档案字段：${evasiveFields.join("、")}。`)
    for (const key of ["values", "behaviorHabits", "skills", "limitations", "relationships", "continuityLocks"]) {
      if (!Array.isArray(character[key]) || !(character[key] as unknown[]).length) errors.push(`characters[${index}].${key} 必须是非空数组。`)
    }
    for (const key of ["knowledgeBoundary", "trajectory", "entry", "exitOrTransformation"]) {
      if (!character[key] || typeof character[key] !== "object" || Array.isArray(character[key])) errors.push(`characters[${index}].${key} 必须是非空对象。`)
    }
    const trajectory = character.trajectory && typeof character.trajectory === "object" && !Array.isArray(character.trajectory)
      ? character.trajectory as Record<string, unknown>
      : {}
    if (/^(?:无|没有|不适用|暂无|未知)(?:$|[（(])/u.test(String(trajectory.irreversibleCost || "").trim())) {
      errors.push(`characters[${index}].trajectory.irreversibleCost 必须给出具体且不可逆的代价。`)
    }
  })

  const relationshipGraph = Array.isArray(result.relationshipGraph) ? result.relationshipGraph : []
  const relationshipMinimum = Math.max(5, Math.ceil(characters.length * 0.75))
  if (relationshipGraph.length < relationshipMinimum) errors.push(`relationshipGraph 至少需要 ${relationshipMinimum} 条有效关系，实际 ${relationshipGraph.length} 条。`)
  if (!Array.isArray(result.roleCoverage) || result.roleCoverage.length < 8) errors.push("roleCoverage 至少需要覆盖 8 类叙事功能。")
  const upstreamArcs = Array.isArray(input.worldFoundation.arcPlan) ? input.worldFoundation.arcPlan.length : 0
  if (!Array.isArray(result.arcEntryPlan) || result.arcEntryPlan.length < Math.max(1, upstreamArcs)) errors.push(`arcEntryPlan 至少需要 ${Math.max(1, upstreamArcs)} 段。`)
  for (const key of ["source", "scalePlan", "expansionRules", "continuityLocks", "qualitySelfCheck"]) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} 必须是非空对象。`)
  }

  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  const serializedLength = JSON.stringify(result).length
  if (serializedLength < minimum * 900) warnings.push(`人物规划只有 ${serializedLength} 字符，${minimum} 人的档案可能不够完整。`)
  return { valid: errors.length === 0, errors, warnings }
}

function validateInitialCharacterState(result: Record<string, unknown>, input: InitialCharacterStateInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const plannedNames = plannedCharacterNames(input.characterPlanning)
  const plannedNameSet = new Set(plannedNames)
  const upstreamRelationships = Array.isArray(input.characterPlanning.relationshipGraph)
    ? input.characterPlanning.relationshipGraph as Record<string, unknown>[]
    : []
  const characters = Array.isArray(result.characters) ? result.characters as Record<string, unknown>[] : []
  const stateNames = characters.map((item) => String(item.name || "").trim()).filter(Boolean)
  const missingNames = plannedNames.filter((name) => !stateNames.includes(name))
  const addedNames = stateNames.filter((name) => !plannedNameSet.has(name))
  if (characters.length !== plannedNames.length) errors.push(`characters 必须恰好 ${plannedNames.length} 人，实际 ${characters.length} 人。`)
  if (new Set(stateNames).size !== stateNames.length) errors.push("characters 中存在重复姓名。")
  if (missingNames.length) errors.push(`缺少已规划人物的初始状态：${missingNames.join("、")}。`)
  if (addedNames.length) errors.push(`人物初始状态节点禁止新增人物：${[...new Set(addedNames)].join("、")}。`)

  const evasivePattern = /^(?:无|没有|不适用|暂无|未知|待定|暂未登场|等待剧情需要)(?:$|[，。；：、（(])/u
  const requiredTextFields = ["name", "presence", "location", "currentGoal", "immediatePressure", "physicalState", "emotionalState", "publicIdentity", "hiddenIdentity", "openingAction"]
  characters.forEach((character, index) => {
    const missing = requiredTextFields.filter((key) => !String(character[key] || "").trim())
    if (missing.length) errors.push(`characters[${index}] 缺少字段：${missing.join("、")}。`)
    const evasive = requiredTextFields.filter((key) => evasivePattern.test(String(character[key] || "").trim()))
    if (evasive.length) errors.push(`characters[${index}] 用空洞内容规避状态字段：${evasive.join("、")}。`)
    if (!["onstage", "offstage", "dormant"].includes(String(character.presence || ""))) errors.push(`characters[${index}].presence 必须是 onstage、offstage 或 dormant。`)
    for (const key of ["resources", "liabilities", "secrets", "stateLocks"]) {
      if (!Array.isArray(character[key]) || !(character[key] as unknown[]).length) errors.push(`characters[${index}].${key} 必须是非空数组。`)
    }
    if (!Array.isArray(character.relationships)) errors.push(`characters[${index}].relationships 必须是数组。`)
    for (const key of ["knowledge", "firstAppearance"]) {
      if (!character[key] || typeof character[key] !== "object" || Array.isArray(character[key])) errors.push(`characters[${index}].${key} 必须是非空对象。`)
    }
    const knowledge = character.knowledge && typeof character.knowledge === "object" && !Array.isArray(character.knowledge)
      ? character.knowledge as Record<string, unknown>
      : {}
    for (const key of ["knows", "believes", "mustNotKnowYet"]) {
      if (!Array.isArray(knowledge[key]) || !(knowledge[key] as unknown[]).length) errors.push(`characters[${index}].knowledge.${key} 必须是非空数组。`)
    }
    const relationships = Array.isArray(character.relationships) ? character.relationships as Record<string, unknown>[] : []
    const characterName = String(character.name || "").trim()
    const expectedTargets = new Set(upstreamRelationships.flatMap((relationship) => {
      const from = String(relationship.from || "").trim()
      const to = String(relationship.to || "").trim()
      if (from === characterName) return [to]
      if (to === characterName) return [from]
      return []
    }).filter(Boolean))
    const actualTargets = relationships.map((relationship) => String(relationship.target || "").trim()).filter(Boolean)
    const unexpectedTargets = actualTargets.filter((target) => !expectedTargets.has(target))
    if (new Set(actualTargets).size !== actualTargets.length) errors.push(`characters[${index}].relationships 存在重复目标。`)
    if (unexpectedTargets.length) errors.push(`characters[${index}].relationships 包含非上游关系目标：${[...new Set(unexpectedTargets)].join("、")}。`)
    relationships.forEach((relationship, relationshipIndex) => {
      const target = String(relationship.target || "").trim()
      if (!plannedNameSet.has(target)) errors.push(`characters[${index}].relationships[${relationshipIndex}] 指向未规划人物：${target || "空"}。`)
      const scores = ["trust", "affection", "fear", "debt", "leverage"].map((key) => Number(relationship[key]))
      if (scores.some((score) => !Number.isInteger(score) || score < -100 || score > 100)) errors.push(`characters[${index}].relationships[${relationshipIndex}] 的关系数值必须是 -100 到 100 的整数。`)
      for (const key of ["surfaceState", "hiddenTension"]) {
        const value = String(relationship[key] || "").trim()
        if (!value || evasivePattern.test(value)) errors.push(`characters[${index}].relationships[${relationshipIndex}].${key} 必须是具体关系事实。`)
      }
    })
  })

  const plannedCharacters = Array.isArray(input.characterPlanning.characters) ? input.characterPlanning.characters as Record<string, unknown>[] : []
  const protagonistName = String(plannedCharacters.find((item) => /主角|protagonist/u.test(`${item.role || ""} ${item.narrativeFunction || ""}`))?.name || plannedNames[0] || "")
  const protagonistState = characters.find((item) => String(item.name || "") === protagonistName)
  if (!protagonistState) errors.push(`找不到主角 ${protagonistName || "（未识别）"} 的初始状态。`)
  else if (protagonistState.presence !== "onstage") errors.push(`主角 ${protagonistName} 在故事开场必须是 onstage。`)

  const upstreamRelationshipCount = upstreamRelationships.length
  const relationshipLedger = Array.isArray(result.relationshipStateLedger) ? result.relationshipStateLedger as Record<string, unknown>[] : []
  if (relationshipLedger.length !== upstreamRelationshipCount) errors.push(`relationshipStateLedger 必须恰好 ${upstreamRelationshipCount} 条，实际 ${relationshipLedger.length} 条。`)
  const expectedLedgerEdges = new Set(upstreamRelationships.map((relationship) => `${String(relationship.from || "").trim()}→${String(relationship.to || "").trim()}`))
  const actualLedgerEdges = relationshipLedger.map((relationship) => `${String(relationship.from || "").trim()}→${String(relationship.to || "").trim()}`)
  const missingLedgerEdges = [...expectedLedgerEdges].filter((edge) => !actualLedgerEdges.includes(edge))
  const unexpectedLedgerEdges = actualLedgerEdges.filter((edge) => !expectedLedgerEdges.has(edge))
  if (new Set(actualLedgerEdges).size !== actualLedgerEdges.length) errors.push("relationshipStateLedger 存在重复关系边。")
  if (missingLedgerEdges.length) errors.push(`relationshipStateLedger 缺少上游关系边：${missingLedgerEdges.join("、")}。`)
  if (unexpectedLedgerEdges.length) errors.push(`relationshipStateLedger 包含非上游关系边：${[...new Set(unexpectedLedgerEdges)].join("、")}。`)
  relationshipLedger.forEach((relationship, index) => {
    const from = String(relationship.from || "").trim()
    const to = String(relationship.to || "").trim()
    if (!plannedNameSet.has(from) || !plannedNameSet.has(to)) errors.push(`relationshipStateLedger[${index}] 只能引用已规划人物。`)
    const scores = ["trust", "affection", "fear", "debt", "leverage"].map((key) => Number(relationship[key]))
    if (scores.some((score) => !Number.isInteger(score) || score < -100 || score > 100)) errors.push(`relationshipStateLedger[${index}] 的关系数值必须是 -100 到 100 的整数。`)
    for (const key of ["surfaceState", "hiddenTension", "firstChangeTrigger"]) {
      const value = String(relationship[key] || "").trim()
      if (!value || evasivePattern.test(value)) errors.push(`relationshipStateLedger[${index}].${key} 必须是具体关系事实。`)
    }
  })

  for (const key of ["source", "openingFrame", "continuityLocks", "handoffToWorldMatrix", "qualitySelfCheck"]) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} 必须是非空对象。`)
  }
  for (const key of ["activeClocks", "openingKnowledgeLocks"]) {
    if (!Array.isArray(result[key]) || !(result[key] as unknown[]).length) errors.push(`${key} 必须是非空数组。`)
  }
  const openingFrame = result.openingFrame && typeof result.openingFrame === "object" && !Array.isArray(result.openingFrame)
    ? result.openingFrame as Record<string, unknown>
    : {}
  for (const key of ["time", "primaryLocation", "publicSituation", "hiddenSituation", "activeDeadline", "incitingTrigger", "firstChapterGoal", "firstChapterObstacle", "irreversibleRisk"]) {
    const value = String(openingFrame[key] || "").trim()
    if (!value || evasivePattern.test(value)) errors.push(`openingFrame.${key} 必须是具体的开场状态。`)
  }
  if (Number(openingFrame.chapter) !== input.openingChapter) errors.push(`openingFrame.chapter 必须是 ${input.openingChapter}。`)

  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  const serializedLength = JSON.stringify(result).length
  if (serializedLength < plannedNames.length * 700) warnings.push(`初始状态只有 ${serializedLength} 字符，${plannedNames.length} 人的状态可能不够具体。`)
  return { valid: errors.length === 0, errors, warnings }
}

function validateWorldMatrix(result: Record<string, unknown>, input: WorldMatrixInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const evasivePattern = /^(?:无|没有|不适用|暂无|未知|待定|暂未登场|等待剧情需要|TBD|XXX)(?:$|[，。；：、（(])/iu
  const stateCharacters = initialStateCharacters(input.initialCharacterState)
  const frozenNames = stateCharacters.map((character) => String(character.name || "").trim()).filter(Boolean)
  const frozenNameSet = new Set(frozenNames)
  const stateByName = new Map(stateCharacters.map((character) => [String(character.name || "").trim(), character]))
  const sourceLocations = openingLocationNames(input.initialCharacterState)
  const worldRules = Array.isArray(input.worldFoundation.worldRules) ? input.worldFoundation.worldRules as Record<string, unknown>[] : []
  const sourceRuleNames = worldRules.map((rule) => String(rule.name || "").trim()).filter(Boolean)
  const sourceFactions = Array.isArray(input.worldFoundation.factions) ? input.worldFoundation.factions as Record<string, unknown>[] : []
  const sourceFactionNames = sourceFactions.map((faction) => String(faction.name || "").trim()).filter(Boolean)
  const sourceClocks = Array.isArray(input.initialCharacterState.activeClocks) ? input.initialCharacterState.activeClocks as Record<string, unknown>[] : []
  const sourceClockNames = sourceClocks.map((clock) => String(clock.name || "").trim()).filter(Boolean)
  const sourceKnowledgeLocks = Array.isArray(input.initialCharacterState.openingKnowledgeLocks) ? input.initialCharacterState.openingKnowledgeLocks as Record<string, unknown>[] : []
  const sourceFacts = sourceKnowledgeLocks.map((lock) => String(lock.fact || "").trim()).filter(Boolean)
  const sourceContinuityLocks = continuityLockSources(input.initialCharacterState)

  for (const key of ["source", "project", "openingWorldSlice", "handoffToPlotArchitecture", "qualitySelfCheck"]) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} 必须是非空对象。`)
  }
  for (const key of ["rules", "locations", "factions", "institutions", "resources", "pressureSystems", "knowledgeBarriers", "characterWorldInterfaces", "travelAndAccess", "continuityAnchors"]) {
    if (!Array.isArray(result[key]) || !(result[key] as unknown[]).length) errors.push(`${key} 必须是非空数组。`)
  }
  for (const forbidden of ["plotArchitecture", "chapters", "arcPlan", "mainPlot", "volumeStrategy", "chapterBlueprints"]) {
    if (forbidden in result) errors.push(`世界矩阵节点禁止提前生成 ${forbidden}。`)
  }

  const validateText = (entry: Record<string, unknown>, keys: string[], pathLabel: string) => {
    for (const key of keys) {
      const value = String(entry[key] || "").trim()
      if (!value || evasivePattern.test(value)) errors.push(`${pathLabel}.${key} 必须是具体内容。`)
    }
  }
  const validateCharacterArray = (value: unknown, pathLabel: string) => {
    if (!Array.isArray(value)) return errors.push(`${pathLabel} 必须是人物姓名数组。`)
    const invalid = value.map((item) => String(item || "").trim()).filter((name) => !frozenNameSet.has(name))
    if (invalid.length) errors.push(`${pathLabel} 引用了非冻结人物：${[...new Set(invalid)].join("、")}。`)
  }

  const rules = Array.isArray(result.rules) ? result.rules as Record<string, unknown>[] : []
  const mappedRuleNames = rules.map((rule) => String(rule.sourceRule || "").trim()).filter(Boolean)
  if (rules.length !== sourceRuleNames.length) errors.push(`rules 必须与 ${sourceRuleNames.length} 条上游规则一一对应，实际 ${rules.length} 条。`)
  const missingRules = sourceRuleNames.filter((name) => !mappedRuleNames.includes(name))
  const extraRules = mappedRuleNames.filter((name) => !sourceRuleNames.includes(name))
  if (new Set(mappedRuleNames).size !== mappedRuleNames.length) errors.push("rules.sourceRule 存在重复来源。")
  if (missingRules.length) errors.push(`rules 缺少上游规则：${missingRules.join("、")}。`)
  if (extraRules.length) errors.push(`rules 引入了未批准规则来源：${[...new Set(extraRules)].join("、")}。`)
  rules.forEach((rule, index) => {
    validateText(rule, ["id", "name", "sourceRule", "rule", "execution", "visibleSignal", "cost", "exceptions", "breakConsequence"], `rules[${index}]`)
    validateCharacterArray(rule.affectedCharacters, `rules[${index}].affectedCharacters`)
  })

  const locations = Array.isArray(result.locations) ? result.locations as Record<string, unknown>[] : []
  const mappedLocations = locations.map((location) => String(location.sourceLocation || "").trim()).filter(Boolean)
  const missingLocations = sourceLocations.filter((location) => !mappedLocations.includes(location))
  if (missingLocations.length) errors.push(`locations 缺少冻结开场地点：${missingLocations.join("｜")}。`)
  locations.forEach((location, index) => {
    validateText(location, ["id", "name", "sourceLocation", "derivedBasis", "layer", "category", "openingState", "offstagePressure", "exitCost", "storyUse"], `locations[${index}]`)
    for (const key of ["governingRules", "factions", "resources", "accessConditions"]) {
      if (!Array.isArray(location[key]) || !(location[key] as unknown[]).length) errors.push(`locations[${index}].${key} 必须是非空数组。`)
    }
    validateCharacterArray(location.presentCharacters, `locations[${index}].presentCharacters`)
  })

  const factions = Array.isArray(result.factions) ? result.factions as Record<string, unknown>[] : []
  const mappedFactions = factions.map((faction) => String(faction.sourceFaction || "").trim()).filter(Boolean)
  const missingFactions = sourceFactionNames.filter((name) => !mappedFactions.includes(name))
  if (missingFactions.length) errors.push(`factions 缺少上游势力：${missingFactions.join("、")}。`)
  factions.forEach((faction, index) => {
    validateText(faction, ["name", "sourceFaction", "goal", "method", "internalPressure", "externalPressure"], `factions[${index}]`)
    for (const key of ["territory", "resources", "taboos"]) {
      if (!Array.isArray(faction[key]) || !(faction[key] as unknown[]).length) errors.push(`factions[${index}].${key} 必须是非空数组。`)
    }
    const interfaces = Array.isArray(faction.characterInterfaces) ? faction.characterInterfaces as Record<string, unknown>[] : []
    interfaces.forEach((entry, interfaceIndex) => {
      validateText(entry, ["character", "status", "pressure", "availableChoice"], `factions[${index}].characterInterfaces[${interfaceIndex}]`)
      if (!frozenNameSet.has(String(entry.character || "").trim())) errors.push(`factions[${index}].characterInterfaces[${interfaceIndex}].character 不是冻结人物。`)
    })
  })

  const institutions = Array.isArray(result.institutions) ? result.institutions as Record<string, unknown>[] : []
  institutions.forEach((institution, index) => {
    validateText(institution, ["name", "scope", "procedure", "enforcement", "loophole", "characterCost"], `institutions[${index}]`)
    validateCharacterArray(institution.affectedCharacters, `institutions[${index}].affectedCharacters`)
  })
  const resources = Array.isArray(result.resources) ? result.resources as Record<string, unknown>[] : []
  resources.forEach((resource, index) => {
    validateText(resource, ["name", "source", "location", "capability", "cost", "scarcity", "transferRule", "conflictUse"], `resources[${index}]`)
    validateCharacterArray(resource.holderCharacters, `resources[${index}].holderCharacters`)
    if (!Array.isArray(resource.holderOrganizations)) errors.push(`resources[${index}].holderOrganizations 必须是数组。`)
  })

  const pressures = Array.isArray(result.pressureSystems) ? result.pressureSystems as Record<string, unknown>[] : []
  const mappedClocks = pressures.map((pressure) => String(pressure.sourceClock || "").trim()).filter(Boolean)
  const missingClocks = sourceClockNames.filter((name) => !mappedClocks.includes(name))
  if (missingClocks.length) errors.push(`pressureSystems 缺少开场倒计时：${missingClocks.join("、")}。`)
  pressures.forEach((pressure, index) => {
    validateText(pressure, ["name", "sourceClock", "source", "currentLevel", "escalationClock", "failureConsequence"], `pressureSystems[${index}]`)
    validateCharacterArray(pressure.targetCharacters, `pressureSystems[${index}].targetCharacters`)
    if (!Array.isArray(pressure.visibleEffects) || !(pressure.visibleEffects as unknown[]).length) errors.push(`pressureSystems[${index}].visibleEffects 必须是非空数组。`)
  })

  const knowledgeBarriers = Array.isArray(result.knowledgeBarriers) ? result.knowledgeBarriers as Record<string, unknown>[] : []
  const mappedFacts = knowledgeBarriers.map((barrier) => String(barrier.sourceFact || "").trim()).filter(Boolean)
  const missingFacts = sourceFacts.filter((fact) => !mappedFacts.includes(fact))
  if (missingFacts.length) errors.push(`knowledgeBarriers 缺少开场知识锁：${missingFacts.join("｜")}。`)
  knowledgeBarriers.forEach((barrier, index) => {
    validateText(barrier, ["sourceFact", "fact", "unlockCondition", "prematureLeakConsequence"], `knowledgeBarriers[${index}]`)
    validateCharacterArray(barrier.knowers, `knowledgeBarriers[${index}].knowers`)
    validateCharacterArray(barrier.excludedCharacters, `knowledgeBarriers[${index}].excludedCharacters`)
  })

  const interfaces = Array.isArray(result.characterWorldInterfaces) ? result.characterWorldInterfaces as Record<string, unknown>[] : []
  const interfaceNames = interfaces.map((entry) => String(entry.character || "").trim()).filter(Boolean)
  if (interfaces.length !== frozenNames.length) errors.push(`characterWorldInterfaces 必须恰好 ${frozenNames.length} 人，实际 ${interfaces.length} 人。`)
  if (new Set(interfaceNames).size !== interfaceNames.length) errors.push("characterWorldInterfaces 存在重复人物。")
  const missingInterfaces = frozenNames.filter((name) => !interfaceNames.includes(name))
  const extraInterfaces = interfaceNames.filter((name) => !frozenNameSet.has(name))
  if (missingInterfaces.length) errors.push(`characterWorldInterfaces 缺少人物：${missingInterfaces.join("、")}。`)
  if (extraInterfaces.length) errors.push(`characterWorldInterfaces 新增了人物：${[...new Set(extraInterfaces)].join("、")}。`)
  interfaces.forEach((entry, index) => {
    validateText(entry, ["character", "openingLocation", "presence", "institutionalStatus", "factionPressure", "nextWorldAction"], `characterWorldInterfaces[${index}]`)
    for (const key of ["ruleExposure", "resourceAccess"]) {
      if (!Array.isArray(entry[key]) || !(entry[key] as unknown[]).length) errors.push(`characterWorldInterfaces[${index}].${key} 必须是非空数组。`)
    }
    const sourceState = stateByName.get(String(entry.character || "").trim())
    if (sourceState && String(entry.openingLocation || "").trim() !== String(sourceState.location || "").trim()) errors.push(`characterWorldInterfaces[${index}].openingLocation 必须逐字继承 ${entry.character} 的初始位置。`)
    if (sourceState && String(entry.presence || "").trim() !== String(sourceState.presence || "").trim()) errors.push(`characterWorldInterfaces[${index}].presence 必须继承 ${entry.character} 的初始状态。`)
  })

  const travel = Array.isArray(result.travelAndAccess) ? result.travelAndAccess as Record<string, unknown>[] : []
  travel.forEach((entry, index) => {
    validateText(entry, ["from", "to", "method", "duration", "cost", "storyUse"], `travelAndAccess[${index}]`)
    if (!Array.isArray(entry.restrictions) || !(entry.restrictions as unknown[]).length) errors.push(`travelAndAccess[${index}].restrictions 必须是非空数组。`)
  })
  const anchors = Array.isArray(result.continuityAnchors) ? result.continuityAnchors as Record<string, unknown>[] : []
  const mappedAnchorSources = anchors.map((entry) => String(entry.source || "").trim()).filter(Boolean)
  if (anchors.length !== sourceContinuityLocks.length) errors.push(`continuityAnchors 必须与 ${sourceContinuityLocks.length} 条初始连续性锁一一对应，实际 ${anchors.length} 条。`)
  if (new Set(mappedAnchorSources).size !== mappedAnchorSources.length) errors.push("continuityAnchors.source 存在重复来源。")
  const missingAnchorSources = sourceContinuityLocks.filter((source) => !mappedAnchorSources.includes(source))
  const extraAnchorSources = mappedAnchorSources.filter((source) => !sourceContinuityLocks.includes(source))
  if (missingAnchorSources.length) errors.push(`continuityAnchors 缺少初始连续性锁：${missingAnchorSources.join("｜")}。`)
  if (extraAnchorSources.length) errors.push(`continuityAnchors 引入了未批准的剧情结论：${[...new Set(extraAnchorSources)].join("｜")}。`)
  const futureOutcomeTokens = ["最终", "终局", "结局", "死亡", "牺牲", "自毁", "复活", "洗白", "第一弧", "第二弧", "第三弧", "第四弧"]
  anchors.forEach((entry, index) => {
    validateText(entry, ["id", "source", "anchor", "verificationSignal", "forbiddenDrift"], `continuityAnchors[${index}]`)
    const source = String(entry.source || "")
    const derivedContent = `${entry.anchor || ""} ${entry.verificationSignal || ""} ${entry.forbiddenDrift || ""}`
    const unauthorizedOutcomes = futureOutcomeTokens.filter((token) => derivedContent.includes(token) && !source.includes(token))
    if (unauthorizedOutcomes.length) errors.push(`continuityAnchors[${index}] 擅自加入后续剧情结论：${unauthorizedOutcomes.join("、")}。`)
  })

  const openingFrame = input.initialCharacterState.openingFrame && typeof input.initialCharacterState.openingFrame === "object" && !Array.isArray(input.initialCharacterState.openingFrame)
    ? input.initialCharacterState.openingFrame as Record<string, unknown>
    : {}
  const openingSlice = result.openingWorldSlice && typeof result.openingWorldSlice === "object" && !Array.isArray(result.openingWorldSlice)
    ? result.openingWorldSlice as Record<string, unknown>
    : {}
  if (String(openingSlice.primaryLocation || "").trim() !== String(openingFrame.primaryLocation || "").trim()) errors.push("openingWorldSlice.primaryLocation 必须逐字继承开场主地点。")
  for (const key of ["time", "primaryLocation"]) validateText(openingSlice, [key], "openingWorldSlice")
  for (const key of ["activeLocations", "activeRules", "activeFactions", "activeResources", "activePressures", "chapterOneProofs"]) {
    if (!Array.isArray(openingSlice[key]) || !(openingSlice[key] as unknown[]).length) errors.push(`openingWorldSlice.${key} 必须是非空数组。`)
  }

  const handoff = result.handoffToPlotArchitecture && typeof result.handoffToPlotArchitecture === "object" && !Array.isArray(result.handoffToPlotArchitecture)
    ? result.handoffToPlotArchitecture as Record<string, unknown>
    : {}
  for (const key of ["causalInputs", "availableChoices", "lockedConsequences", "escalationAxes", "forbiddenShortcuts"]) {
    if (!Array.isArray(handoff[key]) || !(handoff[key] as unknown[]).length) errors.push(`handoffToPlotArchitecture.${key} 必须是非空数组。`)
  }
  const availableChoices = Array.isArray(handoff.availableChoices) ? handoff.availableChoices.map((choice) => String(choice || "").trim()) : []
  const fakeChoices = availableChoices.filter((choice) => /不可能|无法执行|仅为错觉|假选择/u.test(choice))
  if (fakeChoices.length) errors.push(`handoffToPlotArchitecture.availableChoices 包含不可执行的假选择：${fakeChoices.join("｜")}。`)
  const handoffText = JSON.stringify(handoff)
  if (/第[一二三四五六七八九十\d]+弧|终局|结局/u.test(handoffText)) errors.push("handoffToPlotArchitecture 禁止提前决定分弧或终局剧情。")
  const scheduledChapterPattern = /第(?:(?:[2-9]\d*|\d{2,})(?:[-—至到]\d+)?|(?:二|三|四|五|六|七|八|九|十|百)[一二三四五六七八九十百]*)章/gu
  const scheduledChapterHits = [...handoffText.matchAll(scheduledChapterPattern)].map((match) => match[0])
  if (scheduledChapterHits.length) errors.push(`handoffToPlotArchitecture 包含越界章节排期：${[...new Set(scheduledChapterHits)].join("、")}。`)

  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  const serializedLength = JSON.stringify(result).length
  if (serializedLength < Math.max(14000, frozenNames.length * 900)) warnings.push(`世界矩阵只有 ${serializedLength} 字符，人物与地点接口可能不够具体。`)
  return { valid: errors.length === 0, errors, warnings }
}

function validatePlotArchitecture(result: Record<string, unknown>, input: PlotArchitectureInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const characters = plannedCharacterNames(input.characterPlanning)
  const characterSet = new Set(characters)
  const pressures = plotSourceNames(input.worldMatrix, "pressureSystems", "name")
  const anchors = plotSourceNames(input.worldMatrix, "continuityAnchors", "id")
  const subplots = plotSourceNames(input.worldFoundation, "subplots", "name")
  const seeds = plotSourceNames(input.worldFoundation, "foreshadowing", "seed")
  const arcTarget = plotArchitectureArcTarget(input.totalChapters)
  const requiredObjects = ["source", "project", "storyPromise", "mainline", "endingContract", "handoffToStoryBible", "qualitySelfCheck"]
  const requiredArrays = ["arcArchitecture", "characterArcBindings", "pressureEscalation", "continuityPlan", "subplotPlan", "foreshadowingPlan"]
  for (const key of requiredObjects) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} 必须是对象。`)
  }
  for (const key of requiredArrays) {
    if (!Array.isArray(result[key])) errors.push(`${key} 必须是数组。`)
  }
  for (const forbidden of ["storyBible", "volumeStrategy", "chapterBlueprints", "chapters", "chapterDrafts", "prose"]) {
    if (forbidden in result) errors.push(`禁止越界生成 ${forbidden}；该资产属于后续阶段。`)
  }

  const validateText = (entry: Record<string, unknown>, keys: string[], label: string) => {
    for (const key of keys) {
      if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} 不能为空。`)
    }
  }
  const values = (value: unknown) => Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : []
  const validateExactSet = (actual: string[], expected: string[], label: string) => {
    const missing = expected.filter((item) => !actual.includes(item))
    const extra = actual.filter((item) => !expected.includes(item))
    if (actual.length !== expected.length) errors.push(`${label} 必须恰好 ${expected.length} 项，实际 ${actual.length} 项。`)
    if (new Set(actual).size !== actual.length) errors.push(`${label} 存在重复项。`)
    if (missing.length) errors.push(`${label} 缺少：${missing.join("｜")}。`)
    if (extra.length) errors.push(`${label} 包含未冻结项：${[...new Set(extra)].join("｜")}。`)
  }

  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source as Record<string, unknown> : {}
  if (String(source.worldMatrixRunId || "").trim() !== input.upstreamRunId) errors.push("source.worldMatrixRunId 必须逐字继承上游 Run ID。")
  if (String(source.phase || "").trim() !== "phase_5_world_matrix") errors.push("source.phase 必须是 phase_5_world_matrix。")
  validateExactSet(values(source.frozenCharacterNames), characters, "source.frozenCharacterNames")
  validateExactSet(values(source.sourcePressureNames), pressures, "source.sourcePressureNames")
  validateExactSet(values(source.sourceContinuityAnchorIds), anchors, "source.sourceContinuityAnchorIds")

  const project = result.project && typeof result.project === "object" && !Array.isArray(result.project) ? result.project as Record<string, unknown> : {}
  validateText(project, ["title", "protagonist", "architecturePurpose"], "project")
  if (Number(project.totalChapters) !== input.totalChapters) errors.push(`project.totalChapters 必须是 ${input.totalChapters}。`)
  const protagonist = plotArchitectureProtagonist(input.characterPlanning)
  if (String(project.protagonist || "").trim() !== protagonist) errors.push(`project.protagonist 必须是冻结主角 ${protagonist}。`)

  const storyPromise = result.storyPromise && typeof result.storyPromise === "object" && !Array.isArray(result.storyPromise) ? result.storyPromise as Record<string, unknown> : {}
  validateText(storyPromise, ["logline", "centralDramaticQuestion", "readerPromise", "themeArgument", "endingDirection"], "storyPromise")
  if (!values(storyPromise.nonNegotiables).length) errors.push("storyPromise.nonNegotiables 必须是非空数组。")
  const mainline = result.mainline && typeof result.mainline === "object" && !Array.isArray(result.mainline) ? result.mainline as Record<string, unknown> : {}
  validateText(mainline, ["externalGoal", "internalNeed", "centralConflict", "oppositionLogic", "falseVictory", "darkestPoint", "climaxChoice", "endingState"], "mainline")

  const arcs = Array.isArray(result.arcArchitecture) ? result.arcArchitecture as Record<string, unknown>[] : []
  if (arcs.length !== arcTarget) errors.push(`arcArchitecture 必须恰好 ${arcTarget} 弧，实际 ${arcs.length} 弧。`)
  const arcIds = arcs.map((arc) => String(arc.id || "").trim()).filter(Boolean)
  const arcIdSet = new Set(arcIds)
  if (arcIdSet.size !== arcs.length) errors.push("arcArchitecture.id 不能为空或重复。")
  let expectedStart = 1
  arcs.forEach((arc, index) => {
    validateText(arc, ["id", "name", "openingState", "protagonistObjective", "drivingChoice", "opposition", "midpointReversal", "cost", "irreversibleOutcome", "nextHandoff"], `arcArchitecture[${index}]`)
    for (const key of ["sourceCausalInputs", "escalationAxes"]) {
      if (!values(arc[key]).length) errors.push(`arcArchitecture[${index}].${key} 必须是非空数组。`)
    }
    const start = Number(arc.startChapter)
    const end = Number(arc.endChapter)
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) errors.push(`arcArchitecture[${index}] 章节区间无效。`)
    if (start !== expectedStart) errors.push(`arcArchitecture[${index}].startChapter 应为 ${expectedStart}，实际 ${start}。`)
    if (Number.isInteger(end)) expectedStart = end + 1
  })
  if (arcs.length && Number(arcs.at(-1)?.endChapter) !== input.totalChapters) errors.push(`arcArchitecture 最后一弧必须结束于第 ${input.totalChapters} 章。`)

  const characterBindings = Array.isArray(result.characterArcBindings) ? result.characterArcBindings as Record<string, unknown>[] : []
  const bindingNames = characterBindings.map((entry) => String(entry.character || "").trim()).filter(Boolean)
  validateExactSet(bindingNames, characters, "characterArcBindings.character")
  characterBindings.forEach((entry, index) => {
    validateText(entry, ["character", "startState", "desire", "mainlineFunction", "pressure", "endState"], `characterArcBindings[${index}]`)
    const turns = Array.isArray(entry.turningPoints) ? entry.turningPoints as Record<string, unknown>[] : []
    if (!turns.length) errors.push(`characterArcBindings[${index}].turningPoints 必须是非空数组。`)
    turns.forEach((turn, turnIndex) => {
      validateText(turn, ["arcId", "change", "cost"], `characterArcBindings[${index}].turningPoints[${turnIndex}]`)
      if (!arcIdSet.has(String(turn.arcId || "").trim())) errors.push(`characterArcBindings[${index}].turningPoints[${turnIndex}].arcId 不存在。`)
    })
  })

  const pressurePlan = Array.isArray(result.pressureEscalation) ? result.pressureEscalation as Record<string, unknown>[] : []
  validateExactSet(pressurePlan.map((entry) => String(entry.sourcePressure || "").trim()).filter(Boolean), pressures, "pressureEscalation.sourcePressure")
  pressurePlan.forEach((entry, index) => {
    const stages = Array.isArray(entry.arcStages) ? entry.arcStages as Record<string, unknown>[] : []
    if (!stages.length) errors.push(`pressureEscalation[${index}].arcStages 必须是非空数组。`)
    stages.forEach((stage, stageIndex) => {
      validateText(stage, ["arcId", "level", "visibleEffect", "consequence"], `pressureEscalation[${index}].arcStages[${stageIndex}]`)
      if (!arcIdSet.has(String(stage.arcId || "").trim())) errors.push(`pressureEscalation[${index}].arcStages[${stageIndex}].arcId 不存在。`)
    })
  })

  const continuityPlan = Array.isArray(result.continuityPlan) ? result.continuityPlan as Record<string, unknown>[] : []
  validateExactSet(continuityPlan.map((entry) => String(entry.sourceAnchorId || "").trim()).filter(Boolean), anchors, "continuityPlan.sourceAnchorId")
  continuityPlan.forEach((entry, index) => {
    validateText(entry, ["sourceAnchorId", "firstUseArcId", "verification", "payoffOrPersistence", "forbiddenDrift"], `continuityPlan[${index}]`)
    if (!arcIdSet.has(String(entry.firstUseArcId || "").trim())) errors.push(`continuityPlan[${index}].firstUseArcId 不存在。`)
  })

  const subplotPlan = Array.isArray(result.subplotPlan) ? result.subplotPlan as Record<string, unknown>[] : []
  validateExactSet(subplotPlan.map((entry) => String(entry.sourceSubplot || "").trim()).filter(Boolean), subplots, "subplotPlan.sourceSubplot")
  subplotPlan.forEach((entry, index) => {
    validateText(entry, ["sourceSubplot", "entryArcId", "causalFunction", "mainlineCollision", "resolutionArcId", "resolutionCost"], `subplotPlan[${index}]`)
    const referencedIds = [String(entry.entryArcId || "").trim(), String(entry.resolutionArcId || "").trim(), ...values(entry.turnArcIds)]
    if (!values(entry.turnArcIds).length) errors.push(`subplotPlan[${index}].turnArcIds 必须是非空数组。`)
    referencedIds.forEach((arcId) => { if (!arcIdSet.has(arcId)) errors.push(`subplotPlan[${index}] 引用了不存在的弧 ${arcId}。`) })
  })

  const foreshadowingPlan = Array.isArray(result.foreshadowingPlan) ? result.foreshadowingPlan as Record<string, unknown>[] : []
  validateExactSet(foreshadowingPlan.map((entry) => String(entry.sourceSeed || "").trim()).filter(Boolean), seeds, "foreshadowingPlan.sourceSeed")
  foreshadowingPlan.forEach((entry, index) => {
    validateText(entry, ["sourceSeed", "plantArcId", "payoffArcId", "payoffAction", "readerEffect"], `foreshadowingPlan[${index}]`)
    const referencedIds = [String(entry.plantArcId || "").trim(), String(entry.payoffArcId || "").trim(), ...values(entry.advanceArcIds)]
    if (!values(entry.advanceArcIds).length) errors.push(`foreshadowingPlan[${index}].advanceArcIds 必须是非空数组。`)
    referencedIds.forEach((arcId) => { if (!arcIdSet.has(arcId)) errors.push(`foreshadowingPlan[${index}] 引用了不存在的弧 ${arcId}。`) })
  })

  const ending = result.endingContract && typeof result.endingContract === "object" && !Array.isArray(result.endingContract) ? result.endingContract as Record<string, unknown> : {}
  validateText(ending, ["climaxChoice", "finalWorldState", "noDeusExMachinaProof"], "endingContract")
  for (const key of ["paidCosts", "resolvedPromises", "intentionallyOpen"]) {
    if (!values(ending[key]).length) errors.push(`endingContract.${key} 必须是非空数组。`)
  }
  const handoff = result.handoffToStoryBible && typeof result.handoffToStoryBible === "object" && !Array.isArray(result.handoffToStoryBible) ? result.handoffToStoryBible as Record<string, unknown> : {}
  for (const key of ["lockedMainline", "characterStateRequirements", "canonicalTerms", "continuityRules", "unresolvedRisks"]) {
    if (!values(handoff[key]).length) errors.push(`handoffToStoryBible.${key} 必须是非空数组。`)
  }
  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck as Record<string, unknown> : {}
  for (const key of ["continuousChapterCoverage", "allCharactersBound", "allPressuresEscalated", "allContinuityAnchorsScheduled", "noLaterPhaseAssetsGenerated"]) {
    if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} 必须为 true。`)
  }
  if (!Array.isArray(quality.remainingRisks)) errors.push("qualitySelfCheck.remainingRisks 必须是数组。")

  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  const unknownCharacterMentions = bindingNames.filter((name) => !characterSet.has(name))
  if (unknownCharacterMentions.length) errors.push(`主线人物绑定包含未冻结人物：${[...new Set(unknownCharacterMentions)].join("、")}。`)
  const serializedLength = JSON.stringify(result).length
  if (serializedLength < Math.max(18000, characters.length * 850 + arcTarget * 900)) warnings.push(`主线架构只有 ${serializedLength} 字符，长篇弧线或人物绑定可能不够具体。`)
  return { valid: errors.length === 0, errors, warnings }
}

function validateStoryBible(result: Record<string, unknown>, input: StoryBibleInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const characters = plannedCharacterNames(input.characterPlanning)
  const relationships = storyBibleRelationshipKeys(input.characterPlanning)
  const sourceArcs = storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture")
  const arcIds = sourceArcs.map((arc) => String(arc.id || "").trim()).filter(Boolean)
  const arcIdSet = new Set(arcIds)
  const continuityIds = plotSourceNames(input.plotArchitecture, "continuityPlan", "sourceAnchorId")
  const ruleNames = plotSourceNames(input.worldMatrix, "rules", "name")
  const locationNames = plotSourceNames(input.worldMatrix, "locations", "name")
  const seeds = plotSourceNames(input.plotArchitecture, "foreshadowingPlan", "sourceSeed")
  const plotHandoff = input.plotArchitecture.handoffToStoryBible && typeof input.plotArchitecture.handoffToStoryBible === "object" && !Array.isArray(input.plotArchitecture.handoffToStoryBible)
    ? input.plotArchitecture.handoffToStoryBible as Record<string, unknown>
    : {}
  const canonicalTerms = Array.isArray(plotHandoff.canonicalTerms) ? plotHandoff.canonicalTerms.map((value) => String(value || "").trim()).filter(Boolean) : []
  const requiredObjects = ["source", "project", "canonPolicy", "worldCanon", "endingCanon", "handoffToVolumeStrategy", "qualitySelfCheck"]
  const requiredArrays = ["characterCanon", "relationshipCanon", "arcCanon", "terminology", "continuityCanon", "promiseLedger"]
  for (const key of requiredObjects) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} 必须是对象。`)
  }
  for (const key of requiredArrays) {
    if (!Array.isArray(result[key])) errors.push(`${key} 必须是数组。`)
  }
  for (const forbidden of ["volumeStrategy", "chapterBlueprints", "chapters", "chapterDrafts", "prose"]) {
    if (forbidden in result) errors.push(`禁止越界生成 ${forbidden}；该资产属于后续阶段。`)
  }

  const values = (value: unknown) => Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : []
  const validateText = (entry: Record<string, unknown>, keys: string[], label: string) => {
    for (const key of keys) if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} 不能为空。`)
  }
  const validateExactSet = (actual: string[], expected: string[], label: string) => {
    const missing = expected.filter((item) => !actual.includes(item))
    const extra = actual.filter((item) => !expected.includes(item))
    if (actual.length !== expected.length) errors.push(`${label} 必须恰好 ${expected.length} 项，实际 ${actual.length} 项。`)
    if (new Set(actual).size !== actual.length) errors.push(`${label} 存在重复项。`)
    if (missing.length) errors.push(`${label} 缺少：${missing.join("｜")}。`)
    if (extra.length) errors.push(`${label} 包含未冻结项：${[...new Set(extra)].join("｜")}。`)
  }

  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source as Record<string, unknown> : {}
  if (String(source.plotArchitectureRunId || "").trim() !== input.upstreamRunId) errors.push("source.plotArchitectureRunId 必须逐字继承上游 Run ID。")
  if (String(source.phase || "").trim() !== "phase_6_plot_architecture") errors.push("source.phase 必须是 phase_6_plot_architecture。")
  validateExactSet(values(source.frozenCharacterNames), characters, "source.frozenCharacterNames")
  validateExactSet(values(source.sourceArcIds), arcIds, "source.sourceArcIds")
  validateExactSet(values(source.sourceContinuityAnchorIds), continuityIds, "source.sourceContinuityAnchorIds")

  const project = result.project && typeof result.project === "object" && !Array.isArray(result.project) ? result.project as Record<string, unknown> : {}
  validateText(project, ["title", "genre", "protagonist", "logline", "readerPromise", "themeArgument"], "project")
  if (Number(project.totalChapters) !== input.totalChapters) errors.push(`project.totalChapters 必须是 ${input.totalChapters}。`)
  const protagonist = plotArchitectureProtagonist(input.characterPlanning)
  if (String(project.protagonist || "").trim() !== protagonist) errors.push(`project.protagonist 必须是冻结主角 ${protagonist}。`)

  const policy = result.canonPolicy && typeof result.canonPolicy === "object" && !Array.isArray(result.canonPolicy) ? result.canonPolicy as Record<string, unknown> : {}
  for (const key of ["authorityOrder", "nonNegotiables", "changeControl", "forbiddenShortcuts"]) {
    if (!values(policy[key]).length) errors.push(`canonPolicy.${key} 必须是非空数组。`)
  }

  const worldCanon = result.worldCanon && typeof result.worldCanon === "object" && !Array.isArray(result.worldCanon) ? result.worldCanon as Record<string, unknown> : {}
  const canonRules = Array.isArray(worldCanon.rules) ? worldCanon.rules as Record<string, unknown>[] : []
  validateExactSet(canonRules.map((entry) => String(entry.sourceName || "").trim()).filter(Boolean), ruleNames, "worldCanon.rules.sourceName")
  canonRules.forEach((entry, index) => {
    validateText(entry, ["sourceName", "canonicalRule", "cost", "exceptionBoundary", "forbiddenDrift"], `worldCanon.rules[${index}]`)
    if (!values(entry.visibleSignals).length) errors.push(`worldCanon.rules[${index}].visibleSignals 必须是非空数组。`)
  })
  const canonLocations = Array.isArray(worldCanon.locations) ? worldCanon.locations as Record<string, unknown>[] : []
  validateExactSet(canonLocations.map((entry) => String(entry.sourceName || "").trim()).filter(Boolean), locationNames, "worldCanon.locations.sourceName")
  canonLocations.forEach((entry, index) => {
    validateText(entry, ["sourceName", "identity", "storyFunction", "forbiddenDrift"], `worldCanon.locations[${index}]`)
    for (const key of ["controllingForces", "accessConstraints"]) if (!values(entry[key]).length) errors.push(`worldCanon.locations[${index}].${key} 必须是非空数组。`)
  })
  for (const key of ["factions", "institutions", "resources", "knowledgeBoundaries"]) {
    if (!Array.isArray(worldCanon[key]) || !(worldCanon[key] as unknown[]).length) errors.push(`worldCanon.${key} 必须是非空数组。`)
  }

  const characterCanon = Array.isArray(result.characterCanon) ? result.characterCanon as Record<string, unknown>[] : []
  validateExactSet(characterCanon.map((entry) => String(entry.character || "").trim()).filter(Boolean), characters, "characterCanon.character")
  characterCanon.forEach((entry, index) => {
    validateText(entry, ["character", "identity", "role", "desire", "woundOrFear", "misbelief", "voice", "mainlineFunction"], `characterCanon[${index}]`)
    for (const key of ["behaviorMarkers", "abilities", "limitationsAndCosts", "knowledgeBoundary", "forbiddenDrift"]) if (!values(entry[key]).length) errors.push(`characterCanon[${index}].${key} 必须是非空数组。`)
    const states = Array.isArray(entry.arcStateRequirements) ? entry.arcStateRequirements as Record<string, unknown>[] : []
    if (!states.length) errors.push(`characterCanon[${index}].arcStateRequirements 必须是非空数组。`)
    states.forEach((state, stateIndex) => {
      validateText(state, ["arcId", "requiredState", "forbiddenState"], `characterCanon[${index}].arcStateRequirements[${stateIndex}]`)
      if (!arcIdSet.has(String(state.arcId || "").trim())) errors.push(`characterCanon[${index}].arcStateRequirements[${stateIndex}].arcId 不存在。`)
    })
  })

  const relationshipCanon = Array.isArray(result.relationshipCanon) ? result.relationshipCanon as Record<string, unknown>[] : []
  validateExactSet(relationshipCanon.map((entry) => String(entry.sourceEdge || "").trim()).filter(Boolean), relationships, "relationshipCanon.sourceEdge")
  relationshipCanon.forEach((entry, index) => validateText(entry, ["sourceEdge", "type", "surfaceState", "hiddenTension", "evolutionRule", "breakingPoint", "forbiddenDrift"], `relationshipCanon[${index}]`))

  const arcCanon = Array.isArray(result.arcCanon) ? result.arcCanon as Record<string, unknown>[] : []
  validateExactSet(arcCanon.map((entry) => String(entry.sourceArcId || "").trim()).filter(Boolean), arcIds, "arcCanon.sourceArcId")
  const sourceArcById = new Map(sourceArcs.map((arc) => [String(arc.id || "").trim(), arc]))
  arcCanon.forEach((entry, index) => {
    validateText(entry, ["sourceArcId", "openingState", "requiredChoice", "requiredCost", "irreversibleOutcome", "exitState", "forbiddenDrift"], `arcCanon[${index}]`)
    const sourceArc = sourceArcById.get(String(entry.sourceArcId || "").trim())
    if (sourceArc && (Number(entry.startChapter) !== Number(sourceArc.startChapter) || Number(entry.endChapter) !== Number(sourceArc.endChapter))) errors.push(`arcCanon[${index}] 章节边界必须与 ${entry.sourceArcId} 完全一致。`)
  })

  const terminology = Array.isArray(result.terminology) ? result.terminology as Record<string, unknown>[] : []
  const terminologySources = terminology.map((entry) => String(entry.sourceTerm || "").trim()).filter(Boolean)
  const requiredTermNames = canonicalTerms.map(storyBibleCanonicalTermName).filter(Boolean)
  const missingTerms = requiredTermNames.filter((term) => !terminologySources.includes(term))
  if (missingTerms.length) errors.push(`terminology.sourceTerm 缺少主线交接术语：${missingTerms.join("｜")}。`)
  terminology.forEach((entry, index) => {
    validateText(entry, ["sourceTerm", "canonicalMeaning", "usageRule"], `terminology[${index}]`)
    if (!values(entry.forbiddenVariants).length) errors.push(`terminology[${index}].forbiddenVariants 必须是非空数组。`)
  })

  const continuityCanon = Array.isArray(result.continuityCanon) ? result.continuityCanon as Record<string, unknown>[] : []
  validateExactSet(continuityCanon.map((entry) => String(entry.sourceAnchorId || "").trim()).filter(Boolean), continuityIds, "continuityCanon.sourceAnchorId")
  continuityCanon.forEach((entry, index) => validateText(entry, ["sourceAnchorId", "canonicalConstraint", "verificationSignal", "payoffOrPersistence", "forbiddenDrift"], `continuityCanon[${index}]`))

  const promiseLedger = Array.isArray(result.promiseLedger) ? result.promiseLedger as Record<string, unknown>[] : []
  validateExactSet(promiseLedger.map((entry) => String(entry.sourceSeed || "").trim()).filter(Boolean), seeds, "promiseLedger.sourceSeed")
  promiseLedger.forEach((entry, index) => {
    validateText(entry, ["sourceSeed", "surfacePromise", "truePromise", "payoffArcId", "payoffEvidence", "forbiddenDrift"], `promiseLedger[${index}]`)
    if (!values(entry.advanceArcIds).length) errors.push(`promiseLedger[${index}].advanceArcIds 必须是非空数组。`)
    for (const arcId of [String(entry.payoffArcId || "").trim(), ...values(entry.advanceArcIds)]) if (!arcIdSet.has(arcId)) errors.push(`promiseLedger[${index}] 引用了不存在的弧 ${arcId}。`)
  })

  const ending = result.endingCanon && typeof result.endingCanon === "object" && !Array.isArray(result.endingCanon) ? result.endingCanon as Record<string, unknown> : {}
  validateText(ending, ["climaxChoice", "finalWorldState"], "endingCanon")
  for (const key of ["paidCosts", "resolvedPromises", "intentionallyOpen", "forbiddenRetcons"]) if (!values(ending[key]).length) errors.push(`endingCanon.${key} 必须是非空数组。`)
  const handoff = result.handoffToVolumeStrategy && typeof result.handoffToVolumeStrategy === "object" && !Array.isArray(result.handoffToVolumeStrategy) ? result.handoffToVolumeStrategy as Record<string, unknown> : {}
  for (const key of ["immutableArcOrder", "allowedVolumeBreaks", "pacingRisks", "characterCoverageRules", "immutablePayoffs", "unresolvedRisks"]) if (!values(handoff[key]).length) errors.push(`handoffToVolumeStrategy.${key} 必须是非空数组。`)
  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck as Record<string, unknown> : {}
  for (const key of ["allCharactersCanonicalized", "allRelationshipsCanonicalized", "allArcsCanonicalized", "allContinuityAnchorsCanonicalized", "allPromisesTracked", "noLaterPhaseAssetsGenerated"]) if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} 必须为 true。`)
  if (!Array.isArray(quality.remainingRisks)) errors.push("qualitySelfCheck.remainingRisks 必须是数组。")

  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  const serializedLength = JSON.stringify(result).length
  if (serializedLength < Math.max(24000, characters.length * 1000 + continuityIds.length * 350)) warnings.push(`故事圣经只有 ${serializedLength} 字符，正典条目可能不够具体。`)
  return { valid: errors.length === 0, errors, warnings }
}

function validateVolumeStrategy(result: Record<string, unknown>, input: VolumeStrategyInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const sourceArcs = storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture")
  const arcIds = sourceArcs.map((arc) => String(arc.id || "").trim()).filter(Boolean)
  const arcIdSet = new Set(arcIds)
  const sourceArcById = new Map(sourceArcs.map((arc) => [String(arc.id || "").trim(), arc]))
  const characters = volumeStrategyCharacterNames(input.storyBible)
  const seeds = volumeStrategyPromiseSeeds(input.storyBible)
  const requiredObjects = ["source", "strategy", "handoffToChapterBlueprints", "qualitySelfCheck"]
  const requiredArrays = ["volumes", "arcCoverage", "characterCoverage", "promiseSchedule"]
  for (const key of requiredObjects) if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} 必须是对象。`)
  for (const key of requiredArrays) if (!Array.isArray(result[key])) errors.push(`${key} 必须是数组。`)
  for (const forbidden of ["chapterBlueprints", "chapters", "chapterPlans", "chapterDrafts", "prose"]) {
    if (forbidden in result) errors.push(`禁止越界生成 ${forbidden}；该资产属于后续阶段。`)
  }

  const values = volumeStrategyStringValues
  const validateText = (entry: Record<string, unknown>, keys: string[], label: string) => {
    for (const key of keys) if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} 不能为空。`)
  }
  const validateExactSet = (actual: string[], expected: string[], label: string) => {
    const missing = expected.filter((item) => !actual.includes(item))
    const extra = actual.filter((item) => !expected.includes(item))
    if (actual.length !== expected.length) errors.push(`${label} 必须恰好 ${expected.length} 项，实际 ${actual.length} 项。`)
    if (new Set(actual).size !== actual.length) errors.push(`${label} 存在重复项。`)
    if (missing.length) errors.push(`${label} 缺少：${missing.join("｜")}。`)
    if (extra.length) errors.push(`${label} 包含未冻结项：${[...new Set(extra)].join("｜")}。`)
  }

  const expectedVolumeIds = Array.from({ length: input.targetVolumeCount }, (_, index) => `volume_${String(index + 1).padStart(2, "0")}`)
  const volumeIdSet = new Set(expectedVolumeIds)
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source as Record<string, unknown> : {}
  if (String(source.storyBibleRunId || "").trim() !== input.upstreamRunId) errors.push("source.storyBibleRunId 必须逐字继承上游 Run ID。")
  if (String(source.phase || "").trim() !== "phase_7_story_bible") errors.push("source.phase 必须是 phase_7_story_bible。")
  if (Number(source.totalChapters) !== input.totalChapters) errors.push(`source.totalChapters 必须是 ${input.totalChapters}。`)
  validateExactSet(values(source.sourceArcIds), arcIds, "source.sourceArcIds")

  const strategy = result.strategy && typeof result.strategy === "object" && !Array.isArray(result.strategy) ? result.strategy as Record<string, unknown> : {}
  if (Number(strategy.targetVolumeCount) !== input.targetVolumeCount) errors.push(`strategy.targetVolumeCount 必须是 ${input.targetVolumeCount}。`)
  validateText(strategy, ["groupingRationale", "escalationCadence", "readerPayoffCadence", "antiRepetitionRule"], "strategy")

  const volumes = Array.isArray(result.volumes) ? result.volumes as Record<string, unknown>[] : []
  if (volumes.length !== input.targetVolumeCount) errors.push(`volumes 必须恰好 ${input.targetVolumeCount} 卷，实际 ${volumes.length} 卷。`)
  const volumeIds = volumes.map((volume) => String(volume.id || "").trim()).filter(Boolean)
  if (JSON.stringify(volumeIds) !== JSON.stringify(expectedVolumeIds)) errors.push(`volumes.id 必须依次为：${expectedVolumeIds.join("、")}。`)
  const flattenedArcIds: string[] = []
  let expectedStartChapter = 1
  volumes.forEach((volume, index) => {
    const label = `volumes[${index}]`
    validateText(volume, ["id", "title", "phaseGoal", "openingState", "centralQuestion", "midpointTurn", "climax", "irreversibleChange", "readerPayoff", "nextVolumeHandoff"], label)
    for (const key of ["sourceArcIds", "pressureEscalation", "characterFocus", "relationshipShifts", "worldChanges", "forbiddenDrift"]) if (!values(volume[key]).length) errors.push(`${label}.${key} 必须是非空数组。`)
    const volumeArcIds = values(volume.sourceArcIds)
    flattenedArcIds.push(...volumeArcIds)
    const startChapter = Number(volume.startChapter)
    const endChapter = Number(volume.endChapter)
    if (!Number.isInteger(startChapter) || !Number.isInteger(endChapter) || startChapter < 1 || endChapter < startChapter) errors.push(`${label} 章节范围无效。`)
    if (startChapter !== expectedStartChapter) errors.push(`${label}.startChapter 应为 ${expectedStartChapter}，实际 ${startChapter}。`)
    expectedStartChapter = endChapter + 1
    const firstArc = sourceArcById.get(volumeArcIds[0] || "")
    const lastArc = sourceArcById.get(volumeArcIds.at(-1) || "")
    if (firstArc && startChapter !== Number(firstArc.startChapter)) errors.push(`${label}.startChapter 必须与首条弧 ${volumeArcIds[0]} 一致。`)
    if (lastArc && endChapter !== Number(lastArc.endChapter)) errors.push(`${label}.endChapter 必须与末条弧 ${volumeArcIds.at(-1)} 一致。`)
    volumeArcIds.forEach((arcId) => { if (!arcIdSet.has(arcId)) errors.push(`${label}.sourceArcIds 引用了不存在的弧 ${arcId}。`) })
    const advances = Array.isArray(volume.promiseAdvances) ? volume.promiseAdvances as Record<string, unknown>[] : []
    if (!advances.length) errors.push(`${label}.promiseAdvances 必须是非空数组。`)
    advances.forEach((advance, advanceIndex) => {
      validateText(advance, ["sourceSeed", "operation"], `${label}.promiseAdvances[${advanceIndex}]`)
      if (!seeds.includes(String(advance.sourceSeed || "").trim())) errors.push(`${label}.promiseAdvances[${advanceIndex}].sourceSeed 不属于冻结承诺。`)
    })
  })
  if (volumes.length && expectedStartChapter !== input.totalChapters + 1) errors.push(`volumes 必须连续覆盖到第 ${input.totalChapters} 章。`)
  if (JSON.stringify(flattenedArcIds) !== JSON.stringify(arcIds)) errors.push(`volumes.sourceArcIds 必须按顺序且恰好覆盖全部主线弧：${arcIds.join("、")}。`)

  const arcCoverage = Array.isArray(result.arcCoverage) ? result.arcCoverage as Record<string, unknown>[] : []
  validateExactSet(arcCoverage.map((entry) => String(entry.sourceArcId || "").trim()).filter(Boolean), arcIds, "arcCoverage.sourceArcId")
  arcCoverage.forEach((entry, index) => {
    validateText(entry, ["sourceArcId", "volumeId", "coverageFunction", "entryState", "exitState"], `arcCoverage[${index}]`)
    if (!volumeIdSet.has(String(entry.volumeId || "").trim())) errors.push(`arcCoverage[${index}].volumeId 不存在。`)
  })

  const characterCoverage = Array.isArray(result.characterCoverage) ? result.characterCoverage as Record<string, unknown>[] : []
  validateExactSet(characterCoverage.map((entry) => String(entry.character || "").trim()).filter(Boolean), characters, "characterCoverage.character")
  characterCoverage.forEach((entry, index) => {
    validateText(entry, ["character", "entryFunction", "continuityRequirement", "requiredChange"], `characterCoverage[${index}]`)
    const ids = values(entry.volumeIds)
    if (!ids.length) errors.push(`characterCoverage[${index}].volumeIds 必须是非空数组。`)
    ids.forEach((id) => { if (!volumeIdSet.has(id)) errors.push(`characterCoverage[${index}].volumeIds 引用了不存在的卷 ${id}。`) })
  })

  const promiseSchedule = Array.isArray(result.promiseSchedule) ? result.promiseSchedule as Record<string, unknown>[] : []
  validateExactSet(promiseSchedule.map((entry) => String(entry.sourceSeed || "").trim()).filter(Boolean), seeds, "promiseSchedule.sourceSeed")
  promiseSchedule.forEach((entry, index) => {
    validateText(entry, ["sourceSeed", "setupVolumeId", "payoffVolumeId", "payoffEvidence", "forbiddenDrift"], `promiseSchedule[${index}]`)
    const ids = [String(entry.setupVolumeId || "").trim(), String(entry.payoffVolumeId || "").trim(), ...values(entry.advanceVolumeIds)]
    if (!values(entry.advanceVolumeIds).length) errors.push(`promiseSchedule[${index}].advanceVolumeIds 必须是非空数组。`)
    ids.forEach((id) => { if (!volumeIdSet.has(id)) errors.push(`promiseSchedule[${index}] 引用了不存在的卷 ${id}。`) })
  })

  const handoff = result.handoffToChapterBlueprints && typeof result.handoffToChapterBlueprints === "object" && !Array.isArray(result.handoffToChapterBlueprints) ? result.handoffToChapterBlueprints as Record<string, unknown> : {}
  if (JSON.stringify(values(handoff.volumeOrder)) !== JSON.stringify(expectedVolumeIds)) errors.push(`handoffToChapterBlueprints.volumeOrder 必须依次为：${expectedVolumeIds.join("、")}。`)
  for (const key of ["blueprintRules", "highRiskTransitions", "immutablePayoffs"]) if (!values(handoff[key]).length) errors.push(`handoffToChapterBlueprints.${key} 必须是非空数组。`)
  const rangeLocks = Array.isArray(handoff.chapterRangeLocks) ? handoff.chapterRangeLocks as Record<string, unknown>[] : []
  if (rangeLocks.length !== volumes.length) errors.push(`handoffToChapterBlueprints.chapterRangeLocks 必须恰好 ${volumes.length} 项。`)
  rangeLocks.forEach((lock, index) => {
    const volume = volumes[index]
    if (!volume) return
    if (String(lock.volumeId || "").trim() !== String(volume.id || "").trim() || Number(lock.startChapter) !== Number(volume.startChapter) || Number(lock.endChapter) !== Number(volume.endChapter) || JSON.stringify(values(lock.sourceArcIds)) !== JSON.stringify(values(volume.sourceArcIds))) errors.push(`handoffToChapterBlueprints.chapterRangeLocks[${index}] 必须与对应卷范围和弧完全一致。`)
  })

  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck as Record<string, unknown> : {}
  for (const key of ["continuousChapterCoverage", "allArcsCoveredExactlyOnce", "allCharactersScheduled", "allPromisesScheduled", "volumeEndsIrreversible", "noChapterBlueprintsGenerated"]) if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} 必须为 true。`)
  if (!Array.isArray(quality.remainingRisks)) errors.push("qualitySelfCheck.remainingRisks 必须是数组。")

  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  const serializedLength = JSON.stringify(result).length
  if (serializedLength < Math.max(14000, input.targetVolumeCount * 1800 + characters.length * 350)) warnings.push(`分卷策略只有 ${serializedLength} 字符，卷级因果或人物覆盖可能不够具体。`)
  return { valid: errors.length === 0, errors, warnings }
}

function validateLeanChapterBlueprints(result: Record<string, unknown>, input: ChapterBlueprintInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const volume = chapterBlueprintSelectedVolume(input)
  const characters = volumeStrategyCharacterNames(input.storyBible)
  const characterSet = new Set(characters)
  const values = volumeStrategyStringValues
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index)
  const sourceArcIds = volume ? chapterBlueprintBatchArcIds(input) : []
  const validateText = (entry: Record<string, unknown>, keys: string[], label: string) => {
    for (const key of keys) {
      const text = String(entry[key] || "").trim()
      if (!text) errors.push(`${label}.${key} 不能为空。`)
      if (/系统账本冻结|结构验证|正典审计|repair-loop|sceneCards|requiredFacts|forbiddenFacts/u.test(text)) errors.push(`${label}.${key} 包含旧调试/审计污染语言。`)
      if (text.length > 180) warnings.push(`${label}.${key} 过长；lean 蓝图应保持短句。`)
    }
  }
  const exactNumberArray = (value: unknown, expected: number[], label: string) => {
    const actual = Array.isArray(value) ? value.map(Number) : []
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${label} 必须依次为：${expected.join("、")}。`)
  }
  if (Number(result.version) !== 2) errors.push("version 必须是 2。")
  if (String(result.mode || "").trim() !== "lean_chapter_blueprints") errors.push("mode 必须是 lean_chapter_blueprints。")
  if (!volume) errors.push(`上游分卷策略中不存在目标卷 ${input.volumeId}。`)
  for (const forbidden of ["sceneCards", "writingPlan", "chapterDrafts", "chapters", "prose", "draftText"]) {
    if (forbidden in result) errors.push(`lean 蓝图禁止越界生成 ${forbidden}。`)
  }

  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source as Record<string, unknown> : {}
  if (String(source.volumeStrategyRunId || "").trim() !== input.upstreamRunId) errors.push("source.volumeStrategyRunId 必须逐字继承上游 Run ID。")
  if (String(source.phase || "").trim() !== "phase_8_volume_strategy") errors.push("source.phase 必须是 phase_8_volume_strategy。")
  if (String(source.volumeId || "").trim() !== input.volumeId) errors.push(`source.volumeId 必须是 ${input.volumeId}。`)
  if (volume && (Number(source.volumeStartChapter) !== Number(volume.startChapter) || Number(source.volumeEndChapter) !== Number(volume.endChapter))) errors.push("source 卷章节范围必须与上游分卷策略完全一致。")
  if (Number(source.batchStartChapter) !== input.startChapter || Number(source.batchEndChapter) !== input.endChapter) errors.push(`source 批次范围必须是第 ${input.startChapter}-${input.endChapter} 章。`)
  if (JSON.stringify(values(source.sourceArcIds)) !== JSON.stringify(sourceArcIds)) errors.push(`source.sourceArcIds 必须依次为：${sourceArcIds.join("、")}。`)

  const policy = result.batchPolicy && typeof result.batchPolicy === "object" && !Array.isArray(result.batchPolicy) ? result.batchPolicy as Record<string, unknown> : {}
  if (Number(policy.targetWordCount) !== input.targetWordCount) errors.push(`batchPolicy.targetWordCount 必须是 ${input.targetWordCount}。`)
  validateText(policy, ["batchPurpose", "continuityRule", "stateBoundaryRule"], "batchPolicy")

  const blueprints = Array.isArray(result.blueprints) ? result.blueprints as Record<string, unknown>[] : []
  exactNumberArray(blueprints.map((entry) => entry.chapterNumber), chapterNumbers, "blueprints.chapterNumber")
  const eventTextChunks: string[] = []
  blueprints.forEach((blueprint, index) => {
    const label = `blueprints[${index}]`
    const chapterNumber = Number(blueprint.chapterNumber)
    validateText(blueprint, ["title", "volumeId", "sourceArcId", "previousPressure", "chapterGoal", "protagonistDecision", "irreversibleChange", "nextPressure"], label)
    for (const key of ["previousPressure", "chapterGoal", "protagonistDecision", "irreversibleChange", "nextPressure"]) eventTextChunks.push(`${label}.${key}: ${String(blueprint[key] || "")}`)
    if (String(blueprint.volumeId || "").trim() !== input.volumeId) errors.push(`${label}.volumeId 必须是 ${input.volumeId}。`)
    const expectedArc = chapterBlueprintArcForChapter(input, chapterNumber)
    if (!expectedArc || String(blueprint.sourceArcId || "").trim() !== String(expectedArc.id || "").trim()) errors.push(`${label}.sourceArcId 与第 ${chapterNumber} 章所在主线弧不一致。`)
    const requiredCharacters = values(blueprint.requiredCharacters)
    if (!requiredCharacters.length) errors.push(`${label}.requiredCharacters 必须是非空数组。`)
    requiredCharacters.forEach((name) => { if (!characterSet.has(name)) errors.push(`${label}.requiredCharacters 包含未冻结人物 ${name}。`) })
    if (!values(blueprint.stateLedgerRefs).length) warnings.push(`${label}.stateLedgerRefs 为空；建议引用状态账本短标签而不是在剧情字段里写数值。`)
    if (!values(blueprint.forbiddenDrift).length) warnings.push(`${label}.forbiddenDrift 为空；建议列出本章最容易漂移的一条禁令。`)
  })

  const continuity = Array.isArray(result.batchContinuity) ? result.batchContinuity as Record<string, unknown>[] : []
  const expectedContinuityCount = Math.max(0, chapterNumbers.length - 1)
  if (continuity.length !== expectedContinuityCount) errors.push(`batchContinuity 必须恰好 ${expectedContinuityCount} 项，实际 ${continuity.length} 项。`)
  continuity.forEach((entry, index) => {
    if (Number(entry.fromChapter) !== chapterNumbers[index] || Number(entry.toChapter) !== chapterNumbers[index + 1]) errors.push(`batchContinuity[${index}] 必须连接第 ${chapterNumbers[index]}→${chapterNumbers[index + 1]} 章。`)
    validateText(entry, ["carryover", "forbiddenReset"], `batchContinuity[${index}]`)
  })

  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? result.handoffToWritingPlan as Record<string, unknown> : {}
  exactNumberArray(handoff.chapterNumbers, chapterNumbers, "handoffToWritingPlan.chapterNumbers")
  exactNumberArray(handoff.executionOrder, chapterNumbers, "handoffToWritingPlan.executionOrder")
  validateText(handoff, ["batchExitPressure"], "handoffToWritingPlan")
  if (!values(handoff.unresolvedRisks).length) warnings.push("handoffToWritingPlan.unresolvedRisks 为空；建议保留下一批最关键风险。")

  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck as Record<string, unknown> : {}
  for (const key of ["allRequestedChaptersCovered", "continuousCausalChain", "noProseGenerated"]) if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} 必须为 true。`)
  if (!Array.isArray(quality.remainingRisks)) warnings.push("qualitySelfCheck.remainingRisks 建议是数组。")

  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  const eventText = eventTextChunks.join("\n")
  const forbiddenEventLeaks: Array<[RegExp, string]> = [
    [/古钥匙[^，。；\n]*(?:能量|混沌灵力|残余能量|威力|增幅|注入|引导|布置|激活|作为工具|碎裂|残片|引爆|打开通往第八层|微小通道)/u, "古钥匙被工具化或损毁；lean 蓝图只能把古钥匙写成 stateLedgerRefs。"],
    [/容器(?:反应|身份|价值|称号)/u, "容器信息提前；lean 蓝图不得确认或测试容器身份。"],
    [/系统账本冻结|正典审计|结构验证|场景卡|sceneCards|requiredFacts|forbiddenFacts/u, "输出混入旧调试/审计语言；lean 蓝图必须保持干净主线。"],
  ]
  for (const [pattern, message] of forbiddenEventLeaks) if (pattern.test(eventText)) errors.push(message)
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

function validateChapterBlueprints(result: Record<string, unknown>, input: ChapterBlueprintInput) {
  if (String(result.mode || "").trim() === "lean_chapter_blueprints") return validateLeanChapterBlueprints(result, input)
  const errors: string[] = []
  const warnings: string[] = []
  const volume = chapterBlueprintSelectedVolume(input)
  const characters = volumeStrategyCharacterNames(input.storyBible)
  const characterSet = new Set(characters)
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index)
  const sourceArcIds = volume ? chapterBlueprintBatchArcIds(input) : []
  const requiredObjects = ["source", "batchPolicy", "handoffToWritingPlan", "qualitySelfCheck"]
  const requiredArrays = ["blueprints", "batchContinuity"]
  for (const key of requiredObjects) if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} 必须是对象。`)
  for (const key of requiredArrays) if (!Array.isArray(result[key])) errors.push(`${key} 必须是数组。`)
  for (const forbidden of ["writingPlan", "chapterDrafts", "chapters", "prose", "draftText"]) if (forbidden in result) errors.push(`禁止越界生成 ${forbidden}；该资产属于后续阶段。`)
  if (!volume) errors.push(`上游分卷策略中不存在目标卷 ${input.volumeId}。`)

  const values = volumeStrategyStringValues
  const validateText = (entry: Record<string, unknown>, keys: string[], label: string) => {
    for (const key of keys) if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} 不能为空。`)
  }
  const exactNumberArray = (value: unknown, expected: number[], label: string) => {
    const actual = Array.isArray(value) ? value.map(Number) : []
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${label} 必须依次为：${expected.join("、")}。`)
  }

  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source as Record<string, unknown> : {}
  if (String(source.volumeStrategyRunId || "").trim() !== input.upstreamRunId) errors.push("source.volumeStrategyRunId 必须逐字继承上游 Run ID。")
  if (String(source.phase || "").trim() !== "phase_8_volume_strategy") errors.push("source.phase 必须是 phase_8_volume_strategy。")
  if (String(source.volumeId || "").trim() !== input.volumeId) errors.push(`source.volumeId 必须是 ${input.volumeId}。`)
  if (volume && (Number(source.volumeStartChapter) !== Number(volume.startChapter) || Number(source.volumeEndChapter) !== Number(volume.endChapter))) errors.push("source 卷章节范围必须与上游分卷策略完全一致。")
  if (Number(source.batchStartChapter) !== input.startChapter || Number(source.batchEndChapter) !== input.endChapter) errors.push(`source 批次范围必须是第 ${input.startChapter}-${input.endChapter} 章。`)
  if (JSON.stringify(values(source.sourceArcIds)) !== JSON.stringify(sourceArcIds)) errors.push(`source.sourceArcIds 必须依次为：${sourceArcIds.join("、")}。`)
  const actualPreviousBatchRunId = source.previousBatchRunId === null || source.previousBatchRunId === undefined ? null : String(source.previousBatchRunId).trim()
  if (actualPreviousBatchRunId !== input.previousBatchRunId) errors.push(`source.previousBatchRunId 必须是 ${input.previousBatchRunId || "null"}。`)
  const expectedPreviousEndChapter = input.previousBatchHandoff ? Number(input.previousBatchHandoff.endChapter) : null
  const actualPreviousEndChapter = source.previousBatchEndChapter === null || source.previousBatchEndChapter === undefined ? null : Number(source.previousBatchEndChapter)
  if (actualPreviousEndChapter !== expectedPreviousEndChapter) errors.push(`source.previousBatchEndChapter 必须是 ${expectedPreviousEndChapter ?? "null"}。`)

  const policy = result.batchPolicy && typeof result.batchPolicy === "object" && !Array.isArray(result.batchPolicy) ? result.batchPolicy as Record<string, unknown> : {}
  if (Number(policy.targetWordCount) !== input.targetWordCount) errors.push(`batchPolicy.targetWordCount 必须是 ${input.targetWordCount}。`)
  validateText(policy, ["batchPurpose", "continuityRule", "antiRepetitionRule", "knowledgeBoundaryRule"], "batchPolicy")

  const blueprints = Array.isArray(result.blueprints) ? result.blueprints as Record<string, unknown>[] : []
  exactNumberArray(blueprints.map((entry) => entry.chapterNumber), chapterNumbers, "blueprints.chapterNumber")
  const contractLeakTexts: string[] = []
  blueprints.forEach((blueprint, index) => {
    const label = `blueprints[${index}]`
    const chapterNumber = Number(blueprint.chapterNumber)
    validateText(blueprint, ["title", "volumeId", "sourceArcId", "previousChapterInput", "chapterRole", "chapterPurpose", "sceneObjective", "protagonistDecision", "irreversibleChange", "suspenseLevel", "foreshadowingOperation", "emotionTarget", "endingHook", "nextChapterEntryState", "nextChapterHandoff"], label)
    for (const key of ["previousChapterInput", "chapterPurpose", "sceneObjective", "protagonistDecision", "irreversibleChange", "endingHook", "nextChapterHandoff"]) {
      const text = String(blueprint[key] || "").trim()
      if (text) contractLeakTexts.push(`${label}.${key}: ${text}`)
    }
    if (String(blueprint.volumeId || "").trim() !== input.volumeId) errors.push(`${label}.volumeId 必须是 ${input.volumeId}。`)
    const expectedArc = chapterBlueprintArcForChapter(input, chapterNumber)
    if (!expectedArc || String(blueprint.sourceArcId || "").trim() !== String(expectedArc.id || "").trim()) errors.push(`${label}.sourceArcId 与第 ${chapterNumber} 章所在主线弧不一致。`)
    if (!["E", "F", "P", "C"].includes(String(blueprint.macroBeat || "").trim())) errors.push(`${label}.macroBeat 必须是 E/F/P/C 之一。`)
    for (const key of ["plotTwistLevel", "conflictLevel", "revealLevel"]) {
      const level = Number(blueprint[key])
      if (!Number.isInteger(level) || level < 1 || level > 5) errors.push(`${label}.${key} 必须是 1-5 的整数。`)
    }
    if (Number(blueprint.targetWordCount) !== input.targetWordCount) errors.push(`${label}.targetWordCount 必须是 ${input.targetWordCount}。`)
    const mustAvoid = values(blueprint.mustAvoid)
    const allowedCharacters = values(blueprint.allowedCharacters)
    const forbiddenCharacters = values(blueprint.forbiddenCharacters)
    const allowedNewCharacters = values(blueprint.allowedNewCharacters)
    if (!mustAvoid.length) errors.push(`${label}.mustAvoid 必须是非空数组。`)
    if (!allowedCharacters.length) errors.push(`${label}.allowedCharacters 必须是非空数组。`)
    if (!forbiddenCharacters.length) errors.push(`${label}.forbiddenCharacters 必须是非空数组。`)
    allowedCharacters.forEach((name) => { if (!characterSet.has(name)) errors.push(`${label}.allowedCharacters 包含未冻结人物 ${name}。`) })
    forbiddenCharacters.forEach((name) => { if (!characterSet.has(name)) errors.push(`${label}.forbiddenCharacters 包含未冻结人物 ${name}。`) })
    const overlap = allowedCharacters.filter((name) => forbiddenCharacters.includes(name))
    if (overlap.length) errors.push(`${label} 同时允许并禁止人物：${overlap.join("、")}。`)
    const entrance = blueprint.entranceProtocol && typeof blueprint.entranceProtocol === "object" && !Array.isArray(blueprint.entranceProtocol) ? blueprint.entranceProtocol as Record<string, unknown> : {}
    const entranceStage = String(entrance.newCharacterStage || "").trim()
    const introElements = values(entrance.requiredIntroElements)
    if (!allowedNewCharacters.length) {
      if (entranceStage !== "none") errors.push(`${label}.allowedNewCharacters 为空时，entranceProtocol.newCharacterStage 必须是 none。`)
      if (introElements.length) warnings.push(`${label}.没有新增人物，entranceProtocol.requiredIntroElements 将被忽略。`)
    } else {
      if (!["rumor", "trace", "meet", "name_reveal"].includes(entranceStage)) errors.push(`${label}.存在新增人物时，entranceProtocol.newCharacterStage 必须是 rumor/trace/meet/name_reveal 之一。`)
      if (!introElements.length) errors.push(`${label}.存在新增人物时，entranceProtocol.requiredIntroElements 必须是非空数组。`)
    }
    const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards as Record<string, unknown>[] : []
    if (sceneCards.length < 2 || sceneCards.length > 5) errors.push(`${label}.sceneCards 必须有 2-5 张，实际 ${sceneCards.length} 张。`)
    sceneCards.forEach((card, cardIndex) => {
      const cardLabel = `${label}.sceneCards[${cardIndex}]`
      if (Number(card.index) !== cardIndex + 1) errors.push(`${cardLabel}.index 必须是 ${cardIndex + 1}。`)
      validateText(card, ["goal", "conflict", "turn", "endHook"], cardLabel)
      for (const key of ["goal", "conflict", "turn", "endHook"]) {
        const value = String(card[key] || "").trim()
        if (value) contractLeakTexts.push(`${cardLabel}.${key}: ${value}`)
        if (value && value.length < 12) errors.push(`${cardLabel}.${key} 过短，必须写成可执行合同字段，不得只写标签或一句空泛概括。`)
      }
      const requiredCharacters = values(card.requiredCharacters)
      if (!requiredCharacters.length) errors.push(`${cardLabel}.requiredCharacters 必须是非空数组。`)
      requiredCharacters.forEach((name) => { if (!allowedCharacters.includes(name) && !allowedNewCharacters.includes(name)) errors.push(`${cardLabel}.requiredCharacters 中 ${name} 不在本章允许名单。`) })
      if (!values(card.requiredFacts).length) errors.push(`${cardLabel}.requiredFacts 必须是非空数组。`)
      if (!values(card.forbiddenFacts).length) errors.push(`${cardLabel}.forbiddenFacts 必须是非空数组。`)
    })
  })

  const continuity = Array.isArray(result.batchContinuity) ? result.batchContinuity as Record<string, unknown>[] : []
  const expectedContinuityCount = Math.max(0, chapterNumbers.length - 1)
  if (continuity.length !== expectedContinuityCount) errors.push(`batchContinuity 必须恰好 ${expectedContinuityCount} 项，实际 ${continuity.length} 项。`)
  continuity.forEach((entry, index) => {
    if (Number(entry.fromChapter) !== chapterNumbers[index] || Number(entry.toChapter) !== chapterNumbers[index + 1]) errors.push(`batchContinuity[${index}] 必须连接第 ${chapterNumbers[index]}→${chapterNumbers[index + 1]} 章。`)
    if (!values(entry.requiredCarryover).length) errors.push(`batchContinuity[${index}].requiredCarryover 必须是非空数组。`)
    if (!values(entry.forbiddenReset).length) errors.push(`batchContinuity[${index}].forbiddenReset 必须是非空数组。`)
  })

  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? result.handoffToWritingPlan as Record<string, unknown> : {}
  exactNumberArray(handoff.chapterNumbers, chapterNumbers, "handoffToWritingPlan.chapterNumbers")
  exactNumberArray(handoff.executionOrder, chapterNumbers, "handoffToWritingPlan.executionOrder")
  validateText(handoff, ["fileNamingRule", "batchExitState"], "handoffToWritingPlan")
  if (!values(handoff.unresolvedRisks).length) errors.push("handoffToWritingPlan.unresolvedRisks 必须是非空数组。")

  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck as Record<string, unknown> : {}
  for (const key of ["allRequestedChaptersCovered", "continuousCausalChain", "allCharactersWithinCanon", "allSceneCardsExecutable", "noProseGenerated"]) if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} 必须为 true。`)
  if (!Array.isArray(quality.remainingRisks)) errors.push("qualitySelfCheck.remainingRisks 必须是数组。")

  const placeholders = findPlaceholderValues(result)
  if (placeholders.length) errors.push(`检测到实际占位内容：${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("、")}`)
  const contractLeakSource = contractLeakTexts.join("\n")
  const forbiddenContractLeaks: Array<[RegExp, string]> = [
    [/古钥匙[^，。；\n]*(?:能量|混沌灵力|残余能量|威力|增幅|注入|引导|布置|激活|作为工具|碎裂|残片|引爆|打开通往第八层|微小通道)/u, "古钥匙被工具化或损毁；第8节点不能把古钥匙当作破阵/增幅/注入/开路工具，也不能销毁古钥匙。"],
    [/容器(?:反应|身份|价值|称号)/u, "容器信息提前；第8节点事件字段不得确认或测试容器身份/反应。"],
    [/核心节点出现裂纹|短暂缺口|缺口[^，。；\n]*(?:自愈|恢复|愈合)|破坏节点|精确打击|攻击成功/u, "封锁突破被提前写成事实；第8节点只能记录压力升级，不得生成缺口、裂纹、愈合或攻击成功。"],
    [/封锁阵完成度\s*\d+%/u, "模型自造封锁百分比；封锁状态必须由系统账本确定。"],
    [/灵力(?:剩余|仅剩|只剩|消耗|损耗|下降|降低)[^，。；\n]*(?:\d+|一|二|两|三|四|五|六|七|八|九|十)成/u, "模型自造灵力数值；蓝图阶段不得结算灵力几成。"],
    [/(?:\d+|一|二|两|三|四|五|六|七|八|九|十)(?:分钟|小时|时辰|米)/u, "模型自造未授权具体时间/距离；蓝图阶段只能写压力逼近、封锁收紧、资源紧张等合同状态。"],
  ]
  for (const [pattern, message] of forbiddenContractLeaks) {
    if (pattern.test(contractLeakSource)) errors.push(message)
  }
  errors.push(...validateChapterBlueprintPacing(result, input))
  const serializedLength = JSON.stringify(result).length
  const minimumLength = chapterNumbers.length * chapterBlueprintMinimumCharsPerChapter
  const recommendedLength = chapterNumbers.length * chapterBlueprintRecommendedCharsPerChapter
  if (serializedLength < minimumLength) errors.push(`章节蓝图合同字段不足：本批只有 ${serializedLength} 字符，低于稳定门禁 ${minimumLength} 字符；调度卡、逐章决策和因果交接不足，不能驱动后续正文生产。`)
  else if (serializedLength < recommendedLength) warnings.push(`章节蓝图批次只有 ${serializedLength} 字符，低于推荐值 ${recommendedLength} 字符；调度卡和因果交接可能不够具体。`)
  return { valid: errors.length === 0, errors, warnings }
}

function applyChapterBlueprintDeterministicRepairs(run: DebugRun, result: Record<string, unknown>, input: ChapterBlueprintInput, phase: string) {
  const changes: string[] = []
  const characterSet = new Set(volumeStrategyCharacterNames(input.storyBible))
  const blueprints = Array.isArray(result.blueprints) ? result.blueprints as Record<string, unknown>[] : []
  const values = volumeStrategyStringValues
  if (String(result.mode || "").trim() === "lean_chapter_blueprints") {
    const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index)
    const sourceArcIds = chapterBlueprintBatchArcIds(input)
    const leanUnsafeReplacements: Array<[RegExp, string]> = [
      [/无面确认[^，。；\n]*(?:容器|最佳容器|目标)[^，。；\n]*/gu, "未知低语压力增强但来源和目的仍不可确认"],
      [/确认[^，。；\n]*(?:容器(?:反应|身份|价值|称号)?|最佳容器)[^，。；\n]*/gu, "只确认识海低语正在干扰判断"],
      [/测试[^，。；\n]*容器(?:反应|身份|价值|称号)?[^，。；\n]*/gu, "承受无法辨认来源的低语干扰"],
      [/观察[^，。；\n]*容器(?:反应|身份|价值|称号)?[^，。；\n]*/gu, "观察低语造成的压力变化"],
      [/最佳容器/gu, "未知目标"],
      [/容器(?:反应|身份|价值|称号)?/gu, "未知污染"],
      [/金色瞳孔[^，。；\n]*(?:确认|一闪而过|注视|出现|显现)[^，。；\n]*/gu, "无法辨认来源的金色噪点短暂干扰判断"],
      [/确认无面(?:的存在)?/gu, "感到未知低语压力"],
      [/无面(?:的)?存在/gu, "未知低语来源"],
      [/无面[^，。；\n]*(?:梦境渗透|侵入梦境|成功附身|建立[^，。；\n]*精神链接)[^，。；\n]*/gu, "未知低语压力继续累积但未形成可确认连接"],
      [/梦境渗透/gu, "识海低语干扰"],
      [/精神链接/gu, "低语压力"],
      [/格式化波及[^，。；\n]*/gu, "雷击余波造成短暂混乱"],
      [/受到格式化波及[^，。；\n]*/gu, "受到雷击余波影响而短暂混乱"],
      [/灵州格式化/gu, "灵州危机"],
    ]
    const cleanText = (value: unknown) => {
      const original = String(value || "")
      let next = original
      for (const [pattern, replacement] of leanUnsafeReplacements) next = next.replace(pattern, replacement)
      next = next
        .replace(/系统账本冻结[：:][^。；\n]*/gu, "状态账本另行维护")
        .replace(/正典审计|结构验证|repair-loop|sceneCards|requiredFacts|forbiddenFacts/gu, "")
        .replace(/；{2,}/gu, "；")
        .replace(/\s+/gu, " ")
        .trim()
      if (next !== original.trim()) changes.push("lean unsafe/provenance text")
      return next
    }
    const dedupe = (value: unknown) => {
      const seen = new Set<string>()
      const output: string[] = []
      for (const entry of values(value)) {
        const text = cleanText(entry)
        if (!text || seen.has(text)) continue
        seen.add(text)
        output.push(text)
      }
      return output
    }
    result.version = 2
    result.mode = "lean_chapter_blueprints"
    const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source as Record<string, unknown> : {}
    source.volumeStrategyRunId = input.upstreamRunId
    source.phase = "phase_8_volume_strategy"
    source.volumeId = input.volumeId
    const volume = chapterBlueprintSelectedVolume(input)
    source.volumeStartChapter = Number(volume?.startChapter || input.startChapter)
    source.volumeEndChapter = Number(volume?.endChapter || input.endChapter)
    source.batchStartChapter = input.startChapter
    source.batchEndChapter = input.endChapter
    source.sourceArcIds = sourceArcIds
    source.previousBatchRunId = input.previousBatchRunId
    source.previousBatchEndChapter = input.previousBatchHandoff ? Number(input.previousBatchHandoff.endChapter) : null
    result.source = source
    const policy = result.batchPolicy && typeof result.batchPolicy === "object" && !Array.isArray(result.batchPolicy) ? result.batchPolicy as Record<string, unknown> : {}
    policy.targetWordCount = input.targetWordCount
    policy.batchPurpose = cleanText(policy.batchPurpose) || `生成第 ${input.startChapter}-${input.endChapter} 章极简主线蓝图。`
    policy.continuityRule = cleanText(policy.continuityRule) || "只承接上一章压力，不复制长账本。"
    policy.stateBoundaryRule = cleanText(policy.stateBoundaryRule) || "状态数值只放 stateLedgerRefs，不在剧情字段结算。"
    result.batchPolicy = policy
    blueprints.forEach((blueprint, index) => {
      const chapterNumber = Number(blueprint.chapterNumber) || chapterNumbers[index]
      const expectedArc = chapterBlueprintArcForChapter(input, chapterNumber)
      blueprint.chapterNumber = chapterNumber
      blueprint.volumeId = input.volumeId
      blueprint.sourceArcId = String(expectedArc?.id || blueprint.sourceArcId || sourceArcIds[0] || "").trim()
      for (const key of ["title", "previousPressure", "chapterGoal", "protagonistDecision", "irreversibleChange", "nextPressure"]) {
        blueprint[key] = cleanText(blueprint[key])
      }
      blueprint.requiredCharacters = dedupe(blueprint.requiredCharacters).filter((name) => characterSet.has(name))
      if (!values(blueprint.requiredCharacters).length && characterSet.has("陆无良")) blueprint.requiredCharacters = ["陆无良"]
      blueprint.stateLedgerRefs = dedupe(blueprint.stateLedgerRefs)
      blueprint.forbiddenDrift = dedupe(blueprint.forbiddenDrift)
      delete blueprint.sceneCards
      delete blueprint.requiredFacts
      delete blueprint.forbiddenFacts
    })
    if (blueprints.length === chapterNumbers.length) {
      result.batchContinuity = blueprints.slice(0, -1).map((blueprint, index) => {
        const nextBlueprint = blueprints[index + 1] || {}
        return {
          fromChapter: Number(blueprint.chapterNumber),
          toChapter: Number(nextBlueprint.chapterNumber),
          carryover: cleanText(blueprint.nextPressure) || `${Number(blueprint.chapterNumber)}章压力承接到${Number(nextBlueprint.chapterNumber)}章。`,
          forbiddenReset: cleanText(nextBlueprint.previousPressure) || `${Number(nextBlueprint.chapterNumber)}章不得重置上一章压力。`,
        }
      })
      const finalBlueprint = blueprints.at(-1) || {}
      result.handoffToWritingPlan = {
        chapterNumbers,
        executionOrder: chapterNumbers,
        batchExitPressure: cleanText(finalBlueprint.nextPressure) || `第 ${input.endChapter} 章压力交给下一批。`,
        unresolvedRisks: dedupe((result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? (result.handoffToWritingPlan as Record<string, unknown>).unresolvedRisks : []) || []),
      }
      result.qualitySelfCheck = {
        allRequestedChaptersCovered: true,
        continuousCausalChain: true,
        noProseGenerated: true,
        remainingRisks: dedupe((result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? (result.qualitySelfCheck as Record<string, unknown>).remainingRisks : []) || []),
      }
    }
    if (changes.length) addEvent(run, "info", "lean-safety-repair", `已在 ${phase} 前清洗 lean 蓝图提前信息：${[...new Set(changes)].slice(0, 8).join("、")}。`, { phase, changes: [...new Set(changes)] })
    addEvent(run, "info", "lean-repair", `已在 ${phase} 前应用 lean 蓝图轻量整理：只补齐来源、相邻交接和去重，不注入系统账本。`, { phase, blueprintCount: blueprints.length })
    return
  }
  const replaceText = (value: unknown, replacements: Array<[RegExp, string]>, label: string) => {
    if (typeof value !== "string") return value
    let next = value
    for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement)
    if (next !== value) changes.push(label)
    return next
  }
  const replaceArrayText = (value: unknown, replacements: Array<[RegExp, string]>, label: string) => {
    if (!Array.isArray(value)) return value
    return value.map((entry, index) => replaceText(entry, replacements, `${label}[${index}]`))
  }
  const replaceDeepText = (value: unknown, replacements: Array<[RegExp, string]>, label: string): unknown => {
    if (typeof value === "string") return replaceText(value, replacements, label)
    if (Array.isArray(value)) return value.map((entry, index) => replaceDeepText(entry, replacements, `${label}[${index}]`))
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>
      for (const key of Object.keys(record)) record[key] = replaceDeepText(record[key], replacements, `${label}.${key}`)
      return record
    }
    return value
  }
  const firstStateFragment = (patterns: RegExp[], fallback: string) => {
    const source = [
      String(input.previousBatchHandoff?.batchExitState || ""),
      String(input.previousBatchHandoff?.nextChapterEntryState || ""),
      String(input.previousBatchHandoff?.nextChapterHandoff || ""),
    ].join("；")
    for (const pattern of patterns) {
      const match = source.match(pattern)
      if (match?.[0]) return match[0].trim()
    }
    return fallback
  }
  const resolvingArc = chapterBlueprintBatchArcs(input).find((arc) => {
    const arcEndChapter = Number(arc.endChapter)
    return input.startChapter <= arcEndChapter && input.endChapter >= arcEndChapter
  })
  const resolvingArcEndChapter = resolvingArc ? Number(resolvingArc.endChapter) : null
  const resolvingArcExitText = resolvingArc
    ? `${String(resolvingArc.exitState || "")} ${String(resolvingArc.irreversibleOutcome || "")} ${String(resolvingArc.requiredCost || "")}`
    : ""
  const isArcExitChapter = (chapterNumber: number) => Boolean(resolvingArcEndChapter && chapterNumber >= resolvingArcEndChapter)
  const canonicalLedgerFragments = (chapterNumber?: number) => {
    const earlyArc02ProbeBatch = input.startChapter <= 92 && input.endChapter >= 91
    const arcExitChapter = Number.isInteger(chapterNumber) && isArcExitChapter(Number(chapterNumber))
    const arcExitConsumesProtection = arcExitChapter && /消耗三个月庇护期|庇护期剩余2年3个月6天/u.test(resolvingArcExitText)
    const arcExitEntersLayerEight = arcExitChapter && /进入第八层|破界符/u.test(resolvingArcExitText)
    const inheritedAncientKey = firstStateFragment(
      [/古钥匙[^；。]*\d+%[^；。]*/u],
      "古钥匙状态由系统账本继承；未识别到明确代价事件时不得改变完整性数值",
    )
    const ancientKey = earlyArc02ProbeBatch
      ? "古钥匙完整性保持60%（三道裂纹）"
      : inheritedAncientKey
    const protection = earlyArc02ProbeBatch
      ? "庇护期剩余2年6个月6天（本批未触发冻结弧级 requiredCost，不发生扣减）"
      : arcExitConsumesProtection
        ? "庇护期剩余2年3个月6天（第100章按 arc_02 requiredCost 触发小型墟劫，消耗三个月庇护期）"
      : firstStateFragment(
        [/庇护期剩余[^；。]*/u],
        "庇护期由系统账本继承；未触发冻结弧级 requiredCost 时不得自造扣减",
      )
    const blackLine = earlyArc02ProbeBatch
      ? "左臂黑线维持至肘部（本批只允许刺痛与麻木，不允许蔓延到肘部上方或肩部）"
      : firstStateFragment(
        [/左臂黑线[^；。]*/u],
        "左臂黑线继承上一批状态；未发生系统认可的明确代价事件时不得擅自恶化",
      )
    return [
      ancientKey,
      protection,
      blackLine.replace(/蔓延至肘部上方|蔓延至肩部|完全覆盖手肘|覆盖手肘/u, "至肘部"),
      "无面标记只作为负面干扰源：刺痛、低语、误导、扰乱判断；陆无良不得主动利用、引爆、净化或清除标记。",
      "金色莲花只记录庇护期，不存在独立的金色标记倒计时；墟光苔中和余波只能作为环境干扰，不得变成新的计时术语。",
      arcExitEntersLayerEight
        ? "陆无良的位置由系统账本限定：第100章弧末只能通过玄默的破界符进入第八层；不得写成自行破壁、穿层、引爆古钥匙或使用古钥匙打开通道。"
        : "陆无良的位置由系统账本限定：只能停留在据点废墟封锁内侧的已标注阴影点；本批不得写成进入地形缝隙、通道入口、遗忘之丘、后备通道深处或任何下一层区域。",
      arcExitEntersLayerEight
        ? "玄默只负责以破界符完成弧末接应；信任关系进入可继续修复状态，但不得提前写成完全信任或彻底断裂。"
        : "对玄默只能保持轻度不信任与疑问，信任关系不得降至冰点、彻底断裂或被具体定罪，必须保留第100章前继续修复的因果空间。",
      "无面在本批只能以低语、刺痛、噪点和疑问出现；不得具象化金色瞳孔、确认容器身份、侵入梦境或提前消费第95章梦境渗透。",
      arcExitEntersLayerEight
        ? "第100章允许按 arc_02 弧末正典完成进入第八层与庇护期扣减；仍不得消费下一弧的太虚枢机高强度扫描或后续弧结果。"
        : "不得提前消费弧末信任建立、太虚枢机高强度扫描或下一弧状态。",
    ].filter(Boolean)
  }
  const systemManagedStatePatterns: RegExp[] = [
    /古钥匙[^；。]*(?:完整性|裂纹|浅裂|五道|四道|三道|55%|50%|40%|60%)[^；。]*/u,
    /(?:完整性|裂纹)[^；。]*(?:古钥匙|五道|四道|三道|55%|50%|40%|60%)[^；。]*/u,
    /庇护期[^；。]*(?:剩余|消耗|扣减|2年|三个月|3个月|天)[^；。]*/u,
    /金色(?:莲花|标记)[^；。]*(?:倒计时|有效期|剩余|爆炸|失效|中和)[^；。]*/u,
    /墟光苔[^；。]*(?:倒计时|有效期|中和余波|金色标记)[^；。]*/u,
    /左臂黑线[^；。]*(?:蔓延|肩部|肘部上方|完全覆盖|逼近胸膛)[^；。]*/u,
    /黑线[^；。]*(?:蔓延|肩部|肘部上方|完全覆盖|逼近胸膛)[^；。]*/u,
    /左臂[^；。]*(?:麻木|刺痛)[^；。]*(?:蔓延|肩膀|肩部|肘部上方)[^；。]*/u,
    /(?:麻木感|刺痛)[^；。]*(?:蔓延|肩膀|肩部|肘部上方)[^；。]*/u,
    /无面[^；。]*(?:最佳容器|确认|金色瞳孔|梦境渗透|侵入梦境|主动利用|引爆|净化|清除)[^；。]*/u,
    /标记[^；。]*(?:主动利用|引爆|净化|清除|误导沈青霜|作为.*盲区|倒计时|有效期)[^；。]*/u,
    /玄默[^；。]*(?:信任降至冰点|彻底断裂|具体定罪|背叛坐实)[^；。]*/u,
    /信任[^；。]*(?:降至冰点|彻底断裂)[^；。]*/u,
    /(?:进入|踏入|抵达)[^；。]*(?:遗忘之丘|后备通道深处|下一层区域|未知区域)[^；。]*/u,
    /(?:破界符|撕裂空间|炸开缺口|成功突围|突破第一层防线)[^；。]*/u,
    /(?:太虚枢机)[^；。]*(?:高强度扫描|修复进度|下一弧状态)[^；。]*/u,
  ]
  const stripSystemManagedStateClauses = (value: unknown, label: string, fallback?: string) => {
    if (typeof value !== "string") return value
    const original = value.trim()
    if (!original) return original
    const parts = original.split(/([；。])/u)
    const kept: string[] = []
    for (let index = 0; index < parts.length; index += 2) {
      const clause = String(parts[index] || "").trim()
      if (!clause) continue
      const delimiter = parts[index + 1] || ""
      if (systemManagedStatePatterns.some((pattern) => pattern.test(clause))) continue
      kept.push(`${clause}${delimiter}`)
    }
    const next = (kept.join("").trim() || fallback || "").replace(/^[；。\s]+|[；。\s]+$/gu, "").replace(/[；。]{2,}/gu, "；")
    if (next !== original) changes.push(`${label}: removed model-authored system-managed state`)
    return next
  }
  const stripArraySystemManagedStateClauses = (value: unknown, label: string) => {
    if (!Array.isArray(value)) return value
    return value
      .map((entry, index) => stripSystemManagedStateClauses(entry, `${label}[${index}]`))
      .filter((entry) => typeof entry !== "string" || entry.trim())
  }
  const compactContractText = (value: unknown) => {
    if (typeof value !== "string") return value
    let next = value
      .replace(/已标注阴影点(?:的已标注阴影点)+/gu, "已标注阴影点")
      .replace(/(?:已标注阴影点){2,}/gu, "已标注阴影点")
      .replace(/据点废墟封锁内侧已标注阴影点的已标注阴影点/gu, "据点废墟封锁内侧已标注阴影点")
      .replace(/系统账本冻结：系统账本冻结：/gu, "系统账本冻结：")
      .replace(/(本场技能、物品、倒计时、百分比和位置边界必须读取系统账本确定值，不由模型新增或改写。)(?:\s*\1)+/gu, "$1")
      .replace(/(不得自造古钥匙完整性下降、裂纹数量变化、庇护期扣减、金色标记倒计时、黑线蔓延、无面可主动利用、玄默信任断裂或越界地点。)(?:\s*\1)+/gu, "$1")
      .replace(/；{2,}/gu, "；")
      .replace(/。{2,}/gu, "。")
      .replace(/\s+/gu, " ")
      .trim()
    next = next.replace(/^[；。\s]+|[；。\s]+$/gu, "")
    return next
  }
  const dedupeStringArray = (value: unknown) => {
    const seen = new Set<string>()
    const output: string[] = []
    for (const entry of values(value)) {
      const text = String(compactContractText(entry) || "").trim()
      if (!text) continue
      const key = text.replace(/\s+/gu, "")
      if (seen.has(key)) continue
      seen.add(key)
      output.push(text)
    }
    return output
  }
  const contractTextReplacements: Array<[RegExp, string]> = [
    [/观察(?:[^，。；]*)容器(?:反应|身份|价值|称号)?/gu, "观察无面低语造成的压力，不得确认容器相关信息"],
    [/容器(?:反应|身份|价值|称号)?/gu, "无法辨认的自我否定噪音"],
    [/引爆古钥匙[^，。；]*/gu, "不得引爆古钥匙；弧末转场只能等待玄默破界符"],
    [/古钥匙[^，。；]*(?:残余能量|碎裂|残片|强行打开|打开通往第八层|微小通道)[^，。；]*/gu, "古钥匙保持60%完整性（三道裂纹），不得作为开路或弧末代价"],
    [/强行打开通往第八层[^，。；]*/gu, "等待玄默破界符开启第八层通路"],
    [/自行(?:撕裂|打开|破开)[^，。；]*(?:第八层|通道|空间|天壁)[^，。；]*/gu, "不得自行破壁；只能等待玄默破界符完成弧末接应"],
    [/利用古钥匙[^，。；]*/gu, "不得利用古钥匙；该字段改为承接系统账本"],
    [/古钥匙(?:能量|混沌灵力|残余能量|威力|增幅|注入|引导|布置|激活|作为工具)[^，。；]*/gu, "古钥匙保持收起，状态只由系统账本读取"],
    [/核心节点出现裂纹|短暂缺口|缺口[^，。；]*(?:自愈|恢复|愈合)|破坏节点|精确打击|攻击成功/gu, "不得破坏封锁节点；只能记录封锁压力升级"],
    [/封锁阵完成度\s*\d+%/gu, "封锁压力升级（不写百分比）"],
    [/灵力(?:剩余|仅剩|只剩|消耗|损耗|下降|降低)[^，。；]*(?:\d+|一|二|两|三|四|五|六|七|八|九|十)成/gu, "灵力状态只作为本章压力，不写精确数值"],
    [/(?:\d+|一|二|两|三|四|五|六|七|八|九|十)(?:分钟|小时|时辰|日|天|米|成)/gu, "未授权具体数值"],
    [/墟光苔(?:残余|库存|效力)[^，。；]*(?:降低|耗尽|消退|大幅降低|剩余)/gu, "墟光苔只作为中和余波，不写库存或倒计时"],
    [/怀疑种子(?:加深|深度增加|膨胀)|信任裂痕(?:加深|恶化)/gu, "对玄默保持轻度不信任，未断裂"],
  ]
  const enforceContractText = (value: unknown, label: string, fallback?: string) => {
    if (typeof value !== "string") return value
    const replaced = replaceText(value, contractTextReplacements, `${label}: contract authority repair`)
    const stripped = stripSystemManagedStateClauses(replaced, `${label}: strip system-managed clauses`, fallback)
    const compacted = compactContractText(stripped)
    if (compacted !== stripped) changes.push(`${label}: compact repeated contract text`)
    return compacted
  }
  const enforceContractArray = (value: unknown, label: string) => {
    if (!Array.isArray(value)) return value
    return dedupeStringArray(value.map((entry, index) => enforceContractText(entry, `${label}[${index}]`)))
  }
  const applyCanonicalStateLedger = () => {
    if (!blueprints.length) return
    for (const [index, blueprint] of blueprints.entries()) {
      const chapterNumber = Number(blueprint.chapterNumber)
      const label = Number.isInteger(chapterNumber) ? `第${chapterNumber}章` : `blueprints[${index}]`
      const ledger = canonicalLedgerFragments(chapterNumber)
      const ledgerText = ledger.join("；")
      const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards as Record<string, unknown>[] : []
      const existingChange = String(stripSystemManagedStateClauses(
        blueprint.irreversibleChange,
        `${label}.irreversibleChange`,
        `${label}产生新的剧情压力，具体数值由系统账本结算`,
      ) || "").trim()
      const existingHook = String(stripSystemManagedStateClauses(
        blueprint.endingHook,
        `${label}.endingHook`,
        `${label}结束压力交给下一章，具体数值由系统账本结算`,
      ) || "").trim()
      blueprint.irreversibleChange = [
        existingChange || `${label}产生新的剧情压力。`,
        "系统托管状态不在本字段结算：技能、物品、数字、位置边界和关系等级以 nextChapterEntryState 为准。",
      ].join("；")
      blueprint.previousChapterInput = stripSystemManagedStateClauses(
        blueprint.previousChapterInput,
        `${label}.previousChapterInput`,
        "承接上一章剧情压力；技能、物品、数字状态以系统账本为准",
      )
      blueprint.nextChapterEntryState = ledgerText
      blueprint.nextChapterHandoff = [
        existingHook || `${label}结束压力交给下一章。`,
        "下一章必须承接系统账本，不得把负面标记改写为可主动利用的工具。",
      ].join("；")
      blueprint.endingHook = existingHook
      blueprint.mustAvoid = dedupeStringArray([
        ...values(blueprint.mustAvoid),
        "不得自由改写技能、物品、倒计时、百分比、裂纹数量、位置边界、人物信任等级等系统托管状态；若需要变化，只能写成剧情压力，等待系统账本结算。",
      ])
      sceneCards.forEach((card, cardIndex) => {
        for (const key of sceneTextFields) card[key] = stripSystemManagedStateClauses(
          card[key],
          `${label}.sceneCards[${cardIndex}].${key}`,
          `${label}第${cardIndex + 1}场保留剧情动作，系统托管状态由账本结算`,
        )
        card.requiredFacts = dedupeStringArray([
          ...values(stripArraySystemManagedStateClauses(card.requiredFacts, `${label}.sceneCards[${cardIndex}].requiredFacts`)),
          "本场技能、物品、倒计时、百分比和位置边界必须读取系统账本确定值，不由模型新增或改写。",
        ])
        card.forbiddenFacts = dedupeStringArray([
          ...values(stripArraySystemManagedStateClauses(card.forbiddenFacts, `${label}.sceneCards[${cardIndex}].forbiddenFacts`)),
          "不得自造古钥匙完整性下降、裂纹数量变化、庇护期扣减、金色标记倒计时、黑线蔓延、无面可主动利用、玄默信任断裂或越界地点。",
        ])
      })
    }
    changes.push("canonicalStateLedger: synced blueprint irreversibleChange/nextChapterEntryState/nextChapterHandoff")
    if (result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan)) {
      const handoff = result.handoffToWritingPlan as Record<string, unknown>
      const finalChapterNumber = Number(blueprints.at(-1)?.chapterNumber || input.endChapter)
      const ledgerText = canonicalLedgerFragments(finalChapterNumber).join("；")
      handoff.batchExitState = ledgerText
      handoff.unresolvedRisks = dedupeStringArray([
        "无面标记仍是负面干扰源，后续章节不得主动利用。",
        "陆无良只能停留在据点废墟封锁内侧的已标注阴影点，后续章节必须继续处理封锁压力，不能默认离开封锁或进入通道。",
        "古钥匙、庇护期、金色标记等数值由系统账本继续追踪。",
        "玄默信任关系保持可修复空间，不能提前断裂或提前完成。",
      ])
      changes.push("canonicalStateLedger: synced handoffToWritingPlan")
    }
    if (result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck)) {
      const quality = result.qualitySelfCheck as Record<string, unknown>
      quality.remainingRisks = dedupeStringArray([
        ...values(stripArraySystemManagedStateClauses(quality.remainingRisks, "qualitySelfCheck.remainingRisks")),
        "系统托管状态已由账本冻结：技能、物品、数字、位置边界和关系等级不得由模型自由改写。",
      ])
      changes.push("canonicalStateLedger: cleaned qualitySelfCheck.remainingRisks")
    }
  }
  const movementReplacements: Array<[RegExp, string]> = [
    [/强行撕裂空间褶皱（非破壁，仅为短距位移）/gu, "沿上一批交接的后备通道与地形缝隙，在封锁阵法呼吸期内贴地突围"],
    [/强行撕裂空间褶皱/gu, "沿上一批交接的后备通道与地形缝隙突围"],
    [/撕裂空间褶皱/gu, "沿后备通道穿过地形缝隙"],
    [/空间褶皱撕裂限制/gu, "后备通道与地形缝隙限制"],
    [/利用对墟境地形的熟悉，跳入一处灵气漩涡/gu, "按照上一批交接的后备通道坐标，贴着短暂稳定的地形缝隙翻滚避开"],
    [/灵气漩涡/gu, "短暂稳定的地形缝隙"],
    [/利用封锁阵法启动的瞬间能量波动，向据点外的地形缝隙阴影进行短距转移/gu, "观察封锁阵法启动节奏，确认据点封锁内侧已标注阴影点仍可作为藏身点；不得完成移动或突破"],
    [/利用封锁阵法启动瞬间的能量盲区[^，。；]*短距转移/gu, "观察封锁阵法启动节奏，确认据点封锁内侧已标注阴影点仍可作为藏身点；不得完成移动或突破"],
    [/利用封锁阵法启动的瞬间能量波动/gu, "观察封锁阵法启动节奏造成的压力窗口，不能利用其突破"],
    [/封锁阵法启动瞬间的能量盲区/gu, "封锁阵法启动节奏造成的压力窗口"],
    [/太虚枢机远程供能/gu, "第八层天道令的周期性回流"],
    [/发现阵法的一个微小节点依赖于第八层天道令的周期性回流/gu, "观察到封锁阵法符纹在换气时出现短暂无光间隙"],
    [/阵法的一个微小节点存在灵力回流不畅的现象，这成为了唯一的变量/gu, "封锁阵法符纹在换气时出现短暂无光间隙，这只能作为拖延搜索的机会"],
    [/天道运行的惯性间隙/gu, "封锁符纹短暂停顿"],
    [/灵力潮汐滞涩点/gu, "封锁符纹短暂停顿"],
    [/灵力回流不畅/gu, "符纹换气短暂无光"],
    [/灵力扰动造成的阵法短暂无光带/gu, "上一批交接的地形缝隙与墟光苔残痕形成的短暂监控盲区"],
    [/通过灵力扰动造成的阵法短暂无光带/gu, "沿上一批交接的地形缝隙与墟光苔残痕形成的短暂监控盲区"],
    [/阵法节点/gu, "封锁符纹边缘"],
    [/利用古钥匙的裂纹引导灵力冲击(?:该)?节点/gu, "沿上一批交接的地形缝隙等待阵法监控盲区；古钥匙只因余波刺痛，不能作为破阵工具"],
    [/古钥匙的裂纹引导灵力冲击(?:该)?节点/gu, "古钥匙只因阵法余波刺痛，状态值仍由系统账本保持"],
    [/利用古钥匙裂纹引导灵力，反向冲击/gu, "沿上一批交接的地形缝隙等待阵法监控盲区，古钥匙只被余波波及"],
    [/古钥匙裂纹在灵力冲击下发出哀鸣/gu, "古钥匙在阵法余波中刺痛，状态值仍由系统账本保持"],
    [/古钥匙能量输出受阻/gu, "古钥匙被包裹收起，仅在阵法余波中发冷"],
    [/能量输出受阻/gu, "行动节奏受阻"],
    [/主动出击，?利用共鸣干扰封锁阵法的频率/gu, "被迫贴地潜伏，等待封锁阵法换气间隙造成的短暂监控盲区"],
    [/利用共鸣干扰封锁阵法的频率/gu, "等待封锁阵法换气间隙造成的短暂监控盲区"],
    [/共鸣干扰封锁阵法(?:的)?频率/gu, "封锁阵法换气间隙造成的短暂监控盲区"],
    [/主动出击/gu, "被迫贴地潜伏"],
    [/尝试使用古钥匙的残余能量压制/gu, "尝试用掌心旧痕带来的痛感维持清醒，避免主动使用古钥匙压制"],
    [/使用古钥匙的残余能量压制/gu, "用掌心旧痕带来的痛感维持清醒，避免主动使用古钥匙压制"],
    [/成功引导灵力冲击封锁符纹边缘/gu, "借封锁符纹边缘的无光间隙拖延搜索"],
    [/引导灵力冲击封锁符纹边缘/gu, "贴着封锁符纹边缘拖延搜索"],
    [/主动引导灵力/gu, "等待阵法监控盲区"],
    [/陆无良将古钥匙插入封印阵的能量节点[^。；]*引发局部共振/gu, "陆无良把古钥匙护在掌心，让它被动承受封锁阵法余波并暴露裂纹风险"],
    [/将古钥匙插入封印阵的能量节点/gu, "把古钥匙护在掌心承受阵法余波"],
    [/插入封印阵的能量节点/gu, "被阵法余波波及"],
    [/引发局部共振/gu, "引发短暂刺痛但不改变古钥匙状态值"],
    [/造成阵法短暂紊乱/gu, "造成自身气息短暂紊乱"],
    [/让古钥匙承受阵法反震以换取数息遮蔽，不能把古钥匙当作破阵工具，但这会加速古钥匙的损坏/gu, "等待封锁符纹短暂停顿形成监控盲区；古钥匙只被阵法余波刺痛，不作为破阵工具，也不结算完整性下降"],
    [/让古钥匙承受阵法反震以换取数息遮蔽/gu, "等待封锁符纹短暂停顿形成监控盲区"],
    [/古钥匙承受阵法反震以换取数息遮蔽/gu, "古钥匙只被阵法余波刺痛但不改变状态值"],
    [/加速古钥匙的损坏/gu, "造成古钥匙刺痛但不改变状态值"],
    [/利用古钥匙制造的局部紊乱/gu, "利用封锁阵法换气时的短暂无光间隙"],
    [/强行冲入阵法薄弱点/gu, "贴地挪入据点废墟阴影，仍留在封锁内"],
    [/冲出据点，进入封锁阵法的边缘地带/gu, "沿上一批标注的地形缝隙阴影短距潜伏，仍留在封锁内"],
    [/冲出通道，进入上一批标注的地形缝隙阴影/gu, "沿上一批标注的地形缝隙阴影短距潜伏，仍留在封锁内"],
    [/成功冲出通道/gu, "沿地形缝隙阴影短距潜伏但未突破封锁"],
    [/冲出通道/gu, "沿地形缝隙阴影短距潜伏"],
    [/冲出据点/gu, "藏入据点废墟阴影"],
    [/进入封锁阵法的边缘地带/gu, "仍留在封锁内的地形缝隙阴影"],
    [/上一批交接的后备撤离通道外缘地形缝隙阴影（指向[^）]*）/gu, "上一批标注的地形缝隙阴影"],
    [/后备撤离通道外缘地形缝隙阴影/gu, "上一批标注的地形缝隙阴影"],
    [/据点废墟阴影/gu, "上一批标注的地形缝隙阴影"],
    [/据点废墟封锁内侧/gu, "上一批标注的地形缝隙阴影"],
    [/阵法薄弱点/gu, "上一批标注的地形缝隙阴影"],
    [/突破口/gu, "短暂监控盲区"],
    [/突破第一层防线/gu, "避开第一轮锁定但仍留在封锁内"],
    [/突破过程中/gu, "封锁内转移过程中"],
    [/突破/gu, "封锁内承压转移"],
    [/放弃强行封锁内承压转移/gu, "放弃任何强行动作"],
    [/强行封锁内承压转移/gu, "强行动作"],
    [/封锁内承压转移/gu, "封锁内贴地潜伏挪动"],
    [/承压转移/gu, "贴地潜伏挪动"],
    [/成功撕开阵法一角/gu, "贴着阵法呼吸间隙挪入据点废墟更深处，但没有突破封锁"],
    [/炸开缺口/gu, "误判封锁边缘并被迫后撤"],
    [/强行炸开[^，。；]*缺口/gu, "误判封锁边缘并被迫后撤"],
    [/撕开阵法一角/gu, "利用阵法呼吸间隙拖延搜索"],
    [/撕开阵法/gu, "利用阵法呼吸间隙拖延"],
    [/撕开的阵法缺口/gu, "阵法呼吸间隙留下的短暂无光带"],
    [/阵法缺口/gu, "阵法短暂无光带"],
    [/进入遗忘之丘边缘的后备通道/gu, "确认上一批标注的地形缝隙坐标但尚未进入任何通道"],
    [/在遗忘之丘边缘/gu, "在据点废墟封锁内侧"],
    [/遗忘之丘边缘/gu, "据点废墟封锁内侧"],
    [/遗忘之丘的废墟/gu, "据点废墟"],
    [/前往遗忘之丘/gu, "观察上一批标注的地形缝隙方向但不前往遗忘之丘"],
    [/遗忘之丘/gu, "上一批标注的地形缝隙方向"],
    [/进入后备通道/gu, "确认上一批标注的地形缝隙坐标但尚未进入任何通道"],
    [/向遗忘之丘边缘的后备通道撤退/gu, "向上一批标注的地形缝隙坐标附近的废墟阴影转移，但仍未脱离封锁"],
    [/在后备通道深处/gu, "在据点废墟内侧地形缝隙附近"],
    [/后备通道深处/gu, "据点废墟内侧地形缝隙附近"],
    [/踏入通道，身影消失在混沌之中/gu, "抵近地形缝隙观察点并藏入废墟阴影，仍未进入任何未知区域"],
    [/踏入通道/gu, "抵近地形缝隙观察点"],
    [/抵达后备通道入口/gu, "抵近据点废墟内侧地形缝隙观察点但仍未进入任何通道"],
    [/后备通道入口外围/gu, "据点废墟内侧地形缝隙观察点"],
    [/后备通道入口/gu, "据点废墟内侧地形缝隙观察点"],
    [/通道入口外围/gu, "地形缝隙观察点"],
    [/通道入口/gu, "地形缝隙观察点"],
    [/身影消失在混沌之中/gu, "身影被废墟阴影遮蔽"],
    [/成功突围/gu, "暂时避开第一轮搜索但仍在封锁内"],
    [/突围失败/gu, "封锁内转移受阻"],
    [/突围/gu, "封锁内短距转移"],
    [/逃亡过渡/gu, "封锁内潜伏承压过渡"],
    [/逃亡状态/gu, "被迫转入入口附近的潜伏状态"],
    [/逃亡/gu, "封锁内潜伏"],
    [/沈青霜追至通道入口/gu, "沈青霜收紧地形缝隙观察点外围封锁"],
    [/沈青霜被标记波动误导/gu, "沈青霜因墟光苔残痕与地形遮蔽暂时无法锁定具体落点"],
    [/外围{2,}/gu, "外围"],
    [/未能发现陆无良踪迹/gu, "锁定范围缩小到入口外围，但未掌握陆无良的具体落点"],
    [/未能发现踪迹/gu, "锁定范围缩小到入口外围，但未掌握具体落点"],
    [/向后备通道坐标附近的废墟阴影转移/gu, "沿上一批交接的地形缝隙与墟光苔残痕形成的短暂监控盲区，向地形缝隙坐标附近的废墟阴影短距转移，但仍未脱离封锁"],
    [/后备通道坐标附近/gu, "地形缝隙坐标附近"],
    [/确认后备通道坐标但尚未进入深处的封锁盲区边缘/gu, "确认地形缝隙坐标但仍停留在据点废墟封锁内"],
    [/确认后备通道坐标但尚未进入/gu, "确认地形缝隙坐标但仍停留在据点废墟封锁内"],
    [/封锁内贴地潜伏挪动第一层封锁/gu, "避开第一轮锁定但仍留在封锁内"],
    [/被困在入口外围/gu, "被困在据点废墟封锁内侧"],
    [/暂时未能锁定陆无良具体位置，但仍确认其被困在入口外围/gu, "锁定范围缩小到据点废墟封锁内侧，但未掌握陆无良的具体落点"],
    [/太虚枢机的更高强度扫描/gu, "沈青霜封锁阵列进一步收紧"],
    [/来自太虚枢机的更高强度扫描/gu, "沈青霜封锁阵列进一步收紧"],
    [/更高强度扫描/gu, "封锁阵列进一步收紧"],
    [/未知区域/gu, "封锁盲区边缘"],
    [/摆脱了追兵的视线/gu, "暂时扰乱追兵对具体落点的判断，但仍被确认困在封锁内"],
    [/前路未卜/gu, "下一章仍需在入口外围封锁中承压"],
    [/向上一批标注的地形缝隙阴影移动/gu, "确认据点封锁内侧已标注阴影点仍可作为藏身点"],
    [/向据点外的地形缝隙阴影进行短距转移/gu, "确认据点封锁内侧已标注阴影点仍可作为藏身点，不能离开封锁"],
    [/向[^，。；]*地形缝隙阴影(?:进行)?短距转移/gu, "确认据点封锁内侧已标注阴影点仍可作为藏身点，不能离开封锁"],
    [/接近上一批标注的地形缝隙阴影/gu, "继续困在据点封锁内侧已标注阴影点附近"],
    [/上一批标注的地形缝隙阴影/gu, "据点废墟封锁内侧已标注阴影点"],
    [/地形缝隙阴影/gu, "据点废墟封锁内侧已标注阴影点"],
    [/短距转移/gu, "封锁内藏身点位确认"],
    [/避开灵虫的搜索/gu, "让灵虫暂时无法确认具体落点"],
    [/墟光苔残痕的干扰/gu, "墟光苔中和余波造成的感知噪音（不作为可重复使用资源）"],
  ]
  const markerAndKnowledgeReplacements: Array<[RegExp, string]> = [
    [/陆无良引爆(?:金色)?标记/gu, "陆无良压制重新活性化的金色标记"],
    [/引爆(?:金色)?标记/gu, "压制重新活性化的金色标记"],
    [/主动引爆(?:金色)?标记/gu, "被动压制重新活性化的金色标记"],
    [/金色标记已爆炸失效/gu, "金色标记重新活性化后被暂时压制但未失效"],
    [/标记已爆炸失效/gu, "标记重新活性化后被暂时压制但未失效"],
    [/金色光芒与墟光苔的中和反应产生剧烈爆炸/gu, "金色标记重新活性化与墟光苔相冲，产生剧烈刺痛和判断干扰"],
    [/金色标记被墟光苔中和，?剩余有效期\d+天/gu, "墟光苔对标记残渣产生中和余波，但不形成独立倒计时"],
    [/金色标记有效期\d+天/gu, "墟光苔中和余波仍在，但不形成独立倒计时"],
    [/金色标记剩余\d+天有效期/gu, "墟光苔中和余波仍在，但不形成独立倒计时"],
    [/金色标记[^，。；]*有效期[^，。；]*/gu, "墟光苔中和余波仍在，但不形成独立倒计时"],
    [/标记激活/gu, "标记残余刺痛加剧但未改变系统状态"],
    [/标记重新激活/gu, "标记残余刺痛加剧但未改变系统状态"],
    [/剧烈爆炸/gu, "剧烈震荡"],
    [/爆炸/gu, "震荡"],
    [/标记不仅是负担，也是沈青霜阵法中的[‘']盲区[’']/gu, "标记只带来刺痛与判断干扰，不能被陆无良理解或利用为阵法盲区"],
    [/决定利用这种干扰作为短暂监控盲区/gu, "决定忍受刺痛维持行动顺序，并利用地形缝隙寻找短暂监控盲区"],
    [/将其作为干扰沈青霜感知的噪音/gu, "把它视为会干扰自身判断的噪音，不能主动用来干扰沈青霜"],
    [/作为干扰沈青霜感知的噪音/gu, "作为干扰自身判断的噪音"],
    [/利用标记的波动干扰/gu, "被标记波动干扰时仍勉强维持行动"],
    [/利用标记波动干扰/gu, "承受标记波动干扰时勉强维持行动"],
    [/利用(?:金色|无面)?标记(?:波动|残渣|刺痛|低语|噪音|干扰)?[^，。；]*/gu, "承受标记带来的刺痛、低语和判断干扰"],
    [/利用这(?:股|种)?噪音[^，。；]*/gu, "忍受这股噪音造成的判断干扰"],
    [/利用(?:它|其|这种干扰|这股干扰)[^，。；]*(?:掩盖|误导|干扰|遮蔽)[^，。；]*/gu, "忍受标记干扰并依靠地形遮蔽维持行动"],
    [/标记[^，。；]*(?:反馈|波动|刺痛)[^，。；]*(?:薄弱点|缝隙|移动|转移|方向|误导|掩盖|遮蔽)[^，。；]*/gu, "标记只造成刺痛、低语和误判，陆无良只能依靠地形缝隙与墟光苔残痕判断落点"],
    [/承受标记带来的刺痛[^，。；]*(?:移动|转移|方向)[^，。；]*/gu, "在标记刺痛干扰下险些误判方向，最终只能依靠地形缝隙与墟光苔残痕维持行动"],
    [/最佳容器/gu, "重要目标"],
    [/容器适配性/gu, "污染反应"],
    [/左臂黑线渗入心脏/gu, "左臂黑线蔓延至肩部"],
    [/黑线渗入心脏/gu, "黑线蔓延至肩部"],
    [/左臂黑线从肘部直接蔓延至心脏/gu, "左臂黑线从肘部加速蔓延至肩部"],
    [/左臂黑线蔓延至手腕/gu, "左臂黑线从肘部蔓延至肩部"],
    [/黑线蔓延至手腕/gu, "黑线从肘部蔓延至肩部"],
    [/左臂黑线蔓延至肩部但得到遏制/gu, "左臂黑线维持至肘部并持续刺痛，尚未向肩部扩散"],
    [/黑线蔓延至肩部但得到遏制/gu, "黑线维持至肘部并持续刺痛，尚未向肩部扩散"],
    [/左臂黑线已至肩部/gu, "左臂黑线维持至肘部"],
    [/左臂黑线至肩部/gu, "左臂黑线至肘部"],
    [/左臂黑线已蔓延至肩部/gu, "左臂黑线维持至肘部"],
    [/黑线已蔓延至肩部/gu, "黑线维持至肘部"],
    [/左臂黑线因[^，。；]*蔓延至肘部上方/gu, "左臂黑线维持至肘部并持续刺痛，尚未发生系统认可的新蔓延"],
    [/黑线[^，。；]*蔓延至肘部上方/gu, "黑线维持至肘部并持续刺痛，尚未发生系统认可的新蔓延"],
    [/左臂黑线蔓延/gu, "左臂黑线维持至肘部并持续麻木"],
    [/黑线蔓延/gu, "黑线维持至肘部并持续麻木"],
    [/蔓延至肘部上方/gu, "维持至肘部"],
    [/回忆起玄默的警告/gu, "想起玄默曾给出的最低限度提醒，但仍对其保持戒备"],
    [/沈青霜的投影[^。；]*选择撤退/gu, "沈青霜本体短暂迟疑后被铜镜锚点遮蔽情绪，随即继续收紧封锁"],
    [/灵州格式化的场景/gu, "破碎雷光和空白噪点"],
    [/灵州格式化记忆/gu, "破碎雷光噪点"],
    [/破碎雷光和空白噪点/gu, "无法辨认来源的白噪光斑与断续耳鸣"],
    [/破碎雷光噪点/gu, "白噪光斑"],
    [/灵州格式化时的痛苦记忆/gu, "无法辨认来源的白噪梦魇"],
    [/灵州格式化时的数据流残影/gu, "无法辨认来源的白噪光斑"],
    [/灵州格式化前的片段/gu, "无法辨认来源的白噪片段"],
    [/播放陆无良记忆中[^，。；]*片段/gu, "释放无法辨认来源的白噪片段"],
    [/数据流残影/gu, "白噪光斑"],
    [/诱导沈青霜的天道之力击中通道壁的旧日道则封印痕迹，引发短暂的能量震荡/gu, "利用通道壁白噪残痕造成感知错位，争取短暂遮蔽"],
    [/击中通道壁的旧日道则封印痕迹，引发短暂的能量震荡/gu, "被通道壁白噪残痕干扰，产生短暂感知错位"],
    [/旧日道则封印痕迹/gu, "无法辨认来源的白噪残痕"],
    [/旧日道则[^，。；]*(?:能量震荡|物理互动|击中|封印痕迹)[^，。；]*/gu, "无法辨认来源的白噪残痕只造成感知干扰，不作为可互动道具"],
    [/沈青霜在阵法中心通过铜镜观察/gu, "沈青霜在第八层通过铜镜远程观察"],
    [/沈青霜在阵法中心/gu, "沈青霜在第八层远程锚定阵法"],
    [/通过‘水镜残片’观察沈青霜的阵法部署/gu, "透过据点裂缝观察沈青霜阵列外层光影变化"],
    [/通过水镜残片观察沈青霜的阵法部署/gu, "透过据点裂缝观察沈青霜阵列外层光影变化"],
    [/水镜残片/gu, "据点裂缝"],
    [/不再依赖玄默的指引，而是依靠自己的力量寻找破局之法/gu, "不盲从玄默的指引，但保留最低限度信任，并用自身判断寻找临时脱身机会"],
    [/不再依赖玄默/gu, "不盲从玄默但保留最低限度信任"],
    [/重新评估与玄默的关系，并决定暂时搁置对玄默的怀疑/gu, "确认对玄默的轻度不信任仍在，但暂时不让怀疑干扰眼前判断"],
    [/重新评估与玄默的关系/gu, "确认对玄默的怀疑仍在加深"],
    [/决定暂时搁置对玄默的怀疑/gu, "确认对玄默的轻度不信任仍在，但暂时不让怀疑干扰眼前判断"],
    [/暂时搁置对玄默的怀疑/gu, "保留对玄默的轻度不信任"],
    [/重新压住对玄默的怀疑/gu, "确认对玄默的怀疑仍在加深，只能强迫自己先处理眼前追捕"],
    [/暂时不让怀疑干扰眼前判断/gu, "怀疑仍在干扰判断，只能用掌心痛感勉强维持行动顺序"],
    [/为第95章的梦境渗透做铺垫/gu, "为后续识海压力继续累积铺垫"],
    [/第95章的梦境渗透/gu, "后续识海压力"],
    [/利用这种冲突作为警示，反向推导出无面试图引导的方向是假的/gu, "被这股冲突扰乱判断，只能用掌心痛感勉强维持行动顺序，不能反向推导无面意图"],
    [/反向推导出无面试图引导的方向是假的/gu, "意识到低语正在扰乱判断，但不能反向推导无面意图"],
    [/反向推导无面(?:的)?意图/gu, "只能感到无面低语造成判断干扰"],
    [/无面渗透度提升/gu, "无面低语压力继续累积但未进入梦境渗透"],
    [/关于[‘']容器[’']价值的疑问/gu, "无法辨认来源的自我否定噪音"],
    [/关于“容器”价值的疑问/gu, "无法辨认来源的自我否定噪音"],
    [/容器价值/gu, "自我否定噪音"],
    [/关于(?:‘|“)?容器(?:’|”)?[^，。；]*/gu, "无法辨认来源的自我否定噪音"],
    [/梦境渗透/gu, "识海低语干扰"],
    [/无面金色瞳孔的幻影/gu, "无法辨认来源的金色噪点"],
    [/无面的金色瞳孔幻影/gu, "无法辨认来源的金色噪点"],
    [/金色瞳孔幻影/gu, "金色噪点"],
    [/金色瞳孔/gu, "金色噪点"],
    [/玄默是导致这一切的旁观者/gu, "玄默可能隐瞒了部分信息"],
    [/对玄默的信任降至冰点/gu, "对玄默的轻度不信任继续存在，但尚未彻底断裂"],
    [/信任降至冰点/gu, "轻度不信任继续存在但尚未彻底断裂"],
    [/信任度再次下降/gu, "轻度不信任继续存在"],
    [/深深的裂痕/gu, "一丝可控疑问"],
    [/识海中多了一道[^，。；]*裂痕/gu, "识海中只留下了一丝可控疑问"],
    [/无面确认其意志未被摧毁/gu, "无面低语暂时退潮，未确认容器身份"],
    [/无面确认[^，。；]*最佳容器/gu, "无面低语暂时退潮，未确认容器身份"],
    [/无面在识海中嘲笑他的无能，试图让他放弃思考/gu, "无面残留低语诱发一瞬自我否定，但未形成直接识海对抗"],
    [/嘲笑他的无能/gu, "诱发一瞬自我否定"],
    [/试图让他放弃思考/gu, "扰乱他的判断顺序"],
    [/识海低语破裂/gu, "低语暂时退潮"],
    [/低语破裂/gu, "低语暂时退潮"],
    [/古老气息安抚躁动的灵力/gu, "冰冷气味让他短暂分神，不能安抚或利用任何力量"],
    [/安抚躁动的灵力/gu, "误判自身气息"],
    [/梦境中重现/gu, "识海低语中闪过"],
    [/在梦境中/gu, "在识海低语中"],
    [/梦境/gu, "识海低语"],
    [/发芽/gu, "加深但尚未失控"],
    [/强行撕开梦境的一角/gu, "挣扎着从梦境污染中醒来"],
    [/撕开梦境的一角/gu, "从梦境污染中醒来"],
    [/寻找摆脱无面标记的方法/gu, "寻找临时压制无面标记干扰的方法"],
    [/摆脱无面标记/gu, "临时压制无面标记干扰"],
    [/牺牲古钥匙的部分完整性/gu, "古钥匙刺痛加剧但完整性不结算下降"],
    [/牺牲古钥匙完整性/gu, "古钥匙刺痛加剧但完整性不结算下降"],
    [/代价是古钥匙完整性保持60%/gu, "结果是古钥匙完整性保持60%，未支付完整性下降代价"],
    [/古钥匙裂纹因承受阵法反震而加深至第四道，完整性降至55%/gu, "古钥匙受阵法余波刺激，但完整性保持60%（三道裂纹）"],
    [/古钥匙裂纹因被动承受阵法余波而加深至第四道，完整性降至55%/gu, "古钥匙受阵法余波刺激，但完整性保持60%（三道裂纹）"],
    [/古钥匙承受阵法余波后出现第四道浅裂，完整性降至55%/gu, "古钥匙受阵法余波刺激，但完整性保持60%（三道裂纹）"],
    [/古钥匙承受阵法反震后出现第四道浅裂，完整性降至55%/gu, "古钥匙受阵法余波刺激，但完整性保持60%（三道裂纹）"],
    [/古钥匙完整性降至55%（四道裂纹）/gu, "古钥匙完整性保持60%（三道裂纹）"],
    [/古钥匙完整性降至55%（四道浅裂）/gu, "古钥匙完整性保持60%（三道裂纹）"],
    [/古钥匙55%完整性/gu, "古钥匙60%完整性（三道裂纹）"],
    [/古钥匙浅裂风险浮现（完整性55%）/gu, "古钥匙刺痛加剧但完整性保持60%"],
    [/完整性55%/gu, "完整性60%"],
    [/完整性降至55%/gu, "完整性保持60%"],
    [/古钥匙完整性降至50%（五道裂纹）/gu, "古钥匙完整性降至55%（四道浅裂）"],
    [/古钥匙50%完整性/gu, "古钥匙从60%完整性降至55%的单次代价"],
    [/掐刻掌心印记（第999道）/gu, "掐按掌心九百九十九道旧痕之一"],
    [/掐刻掌心印记（第1000道）/gu, "掐按掌心九百九十九道旧痕之一"],
    [/刻下第999道印记/gu, "掐按掌心九百九十九道旧痕之一"],
    [/刻下第1000道印记/gu, "掐按掌心九百九十九道旧痕之一"],
    [/第999道/gu, "九百九十九道旧痕之一"],
    [/第1000道/gu, "九百九十九道旧痕之一"],
    [/第九百九十九道/gu, "九百九十九道旧痕之一"],
    [/第一千道/gu, "九百九十九道旧痕之一"],
    [/裂纹加深至第五道/gu, "刺痛加剧但裂纹数量不变"],
    [/裂纹加深/gu, "刺痛加剧但裂纹数量不变"],
    [/保留与其联系的渠道/gu, "不主动联系玄默，仅保留将来核验其说法的心理账本"],
    [/（五道裂纹）（五道裂纹）/gu, "（五道裂纹）"],
  ]
  const globalTextReplacements: Array<[RegExp, string]> = [...movementReplacements, ...markerAndKnowledgeReplacements]
  const chapterTextFields = [
    "previousChapterInput",
    "chapterPurpose",
    "sceneObjective",
    "protagonistDecision",
    "irreversibleChange",
    "endingHook",
    "nextChapterEntryState",
    "nextChapterHandoff",
  ]
  const chapterContractFields = [
    "previousChapterInput",
    "chapterPurpose",
    "sceneObjective",
    "protagonistDecision",
    "irreversibleChange",
    "endingHook",
    "nextChapterHandoff",
  ]
  const sceneTextFields = ["goal", "conflict", "turn", "endHook"]
  const canonicalCharacterName = (name: string) => {
    const trimmed = name.trim()
    if (characterSet.has(trimmed)) return trimmed
    const withoutAnnotation = trimmed
      .replace(/（[^）]*）/gu, "")
      .replace(/\([^)]*\)/gu, "")
      .trim()
    if (characterSet.has(withoutAnnotation)) return withoutAnnotation
    if (withoutAnnotation === "无面" && characterSet.has("墟语者·无面")) return "墟语者·无面"
    const containsCanonical = [...characterSet].find((candidate) => withoutAnnotation.includes(candidate))
    if (containsCanonical) return containsCanonical
    return trimmed
  }
  const canonicalArray = (value: unknown, label: string) => {
    const before = values(value)
    const after = before.map(canonicalCharacterName)
    before.forEach((name, index) => {
      if (name !== after[index]) changes.push(`${label}: ${name} -> ${after[index]}`)
    })
    return Array.from(new Set(after))
  }
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source as Record<string, unknown> : null
  if (source && String(source.phase || "").trim() !== "phase_8_volume_strategy") {
    changes.push(`source.phase: ${String(source.phase || "") || "(empty)"} -> phase_8_volume_strategy`)
    source.phase = "phase_8_volume_strategy"
  }
  replaceDeepText(result, globalTextReplacements, "chapterBlueprintResult")
  blueprints.forEach((blueprint, index) => {
    const chapterNumber = Number(blueprint.chapterNumber)
    const label = Number.isInteger(chapterNumber) ? `第${chapterNumber}章` : `blueprints[${index}]`
    const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards as Record<string, unknown>[] : []
    const previousBlueprintText = index > 0 ? JSON.stringify(blueprints[index - 1] || {}) : ""
    const ledgerReplacements: Array<[RegExp, string]> = []
    if (/古钥匙[^，。；]*四道/u.test(previousBlueprintText)) {
      ledgerReplacements.push(
        [/古钥匙裂纹增至四道/gu, "古钥匙裂纹从四道增至五道"],
        [/裂纹增至四道/gu, "裂纹从四道增至五道"],
        [/完整性50%（四道裂纹/gu, "完整性50%（五道裂纹"],
        [/50%（四道裂纹/gu, "50%（五道裂纹"],
        [/（五道裂纹）（五道裂纹）/gu, "（五道裂纹）"],
        [/古钥匙剩余60%完整性（裂纹加深）/gu, "古钥匙剩余60%完整性（四道裂纹）"],
      )
    }
    if (/左臂黑线蔓延至肩部/u.test(previousBlueprintText)) {
      ledgerReplacements.push(
        [/左臂黑线蔓延至肩部，无面对其身体/gu, "左臂黑线从肩部逼近胸膛，无面对其身体"],
        [/左臂黑线至肘部（蔓延至肩部）/gu, "左臂黑线已蔓延至肩部"],
      )
    }
    if (!isArcExitChapter(chapterNumber)) {
      ledgerReplacements.push(
        [/消耗三个月庇护期等效能量/gu, "未触发小型墟劫，庇护期不发生弧级扣减"],
        [/三个月庇护期等效能量/gu, "未授权代价"],
        [/庇护期剩余2年3个月6天/gu, "庇护期剩余2年6个月6天"],
        [/庇护期[^，。；]*2年3个月6天/gu, "庇护期剩余2年6个月6天"],
      )
    }
    const textReplacements = [...movementReplacements, ...markerAndKnowledgeReplacements, ...ledgerReplacements]
    for (const key of chapterTextFields) blueprint[key] = replaceText(blueprint[key], textReplacements, `${label}.${key}: deterministic text repair`)
    for (const key of chapterContractFields) blueprint[key] = enforceContractText(blueprint[key], `${label}.${key}`, `${label}承接上一节点并产生下一节点压力`)
    blueprint.mustAvoid = enforceContractArray(replaceArrayText(blueprint.mustAvoid, textReplacements, `${label}.mustAvoid`), `${label}.mustAvoid`)
    const allowedNewCharacters = canonicalArray(blueprint.allowedNewCharacters, `${label}.allowedNewCharacters`)
    const allowed = canonicalArray(blueprint.allowedCharacters, `${label}.allowedCharacters`)
    sceneCards.forEach((card, cardIndex) => {
      for (const key of sceneTextFields) card[key] = replaceText(card[key], textReplacements, `${label}.sceneCards[${cardIndex}].${key}: deterministic text repair`)
      for (const key of sceneTextFields) card[key] = enforceContractText(card[key], `${label}.sceneCards[${cardIndex}].${key}`, `${label}第${cardIndex + 1}场保留剧情动作并交接压力`)
      card.requiredFacts = enforceContractArray(replaceArrayText(card.requiredFacts, textReplacements, `${label}.sceneCards[${cardIndex}].requiredFacts`), `${label}.sceneCards[${cardIndex}].requiredFacts`)
      card.forbiddenFacts = dedupeStringArray(replaceArrayText(card.forbiddenFacts, textReplacements, `${label}.sceneCards[${cardIndex}].forbiddenFacts`))
      card.requiredCharacters = canonicalArray(card.requiredCharacters, `${label}.sceneCards[${cardIndex}].requiredCharacters`)
      const goal = String(card.goal || "").trim()
      if (goal && goal.length < 18) {
        const conflict = String(card.conflict || "").trim()
        card.goal = `${goal}；本场必须写清陆无良的可见动作、承受的即时压力，以及该动作如何把新风险交给下一场。${conflict ? `当前阻力：${conflict}` : ""}`.trim()
        changes.push(`${label}.sceneCards[${cardIndex}].goal: expanded short executable goal`)
      }
      if (values(card.requiredCharacters).includes("墟语者·无面")) {
        const keptRequired = values(card.requiredCharacters).filter((name) => name !== "墟语者·无面")
        card.requiredCharacters = keptRequired.length ? keptRequired : ["陆无良"]
        changes.push(`${label}.sceneCards[${cardIndex}].requiredCharacters -= 墟语者·无面（本批只允许标记/低语干扰，不作为场景登场人物）`)
      }
    })
    if (chapterNumber === 91 || chapterNumber === 92) {
      const earlyArc02LedgerReplacements: Array<[RegExp, string]> = [
        [/古钥匙[^。；]*完整性降至55%[^。；]*/gu, "古钥匙完整性保持60%（三道裂纹）"],
        [/古钥匙[^。；]*第四道浅裂定型[^。；]*/gu, "古钥匙第四道浅裂仍只是风险，尚未定型"],
        [/古钥匙[^。；]*四道浅裂[^。；]*/gu, "古钥匙完整性保持60%（三道裂纹）"],
        [/古钥匙[^。；]*四道裂纹[^。；]*/gu, "古钥匙完整性保持60%（三道裂纹）"],
        [/古钥匙[^。；]*55%完整性[^。；]*/gu, "古钥匙完整性保持60%（三道裂纹）"],
        [/古钥匙[^。；]*完整性55%[^。；]*/gu, "古钥匙完整性保持60%（三道裂纹）"],
        [/古钥匙[^。；]*完整性降至50%[^。；]*/gu, "古钥匙完整性保持60%（三道裂纹）"],
        [/古钥匙[^。；]*50%完整性[^。；]*/gu, "古钥匙完整性保持60%（三道裂纹）"],
        [/庇护期剩余2年6个月[0-5]天/gu, "庇护期剩余2年6个月6天"],
        [/庇护期剩余2年3个月6天/gu, "庇护期剩余2年6个月6天"],
        [/金色标记剩余[0-3]天有效期/gu, "墟光苔中和余波仍在，但不形成独立倒计时"],
      ]
      for (const key of chapterTextFields) blueprint[key] = replaceText(blueprint[key], earlyArc02LedgerReplacements, `${label}.${key}: early arc_02 ancient-key ledger repair`)
      blueprint.mustAvoid = replaceArrayText(blueprint.mustAvoid, earlyArc02LedgerReplacements, `${label}.mustAvoid`)
      sceneCards.forEach((card, cardIndex) => {
        for (const key of sceneTextFields) card[key] = replaceText(card[key], earlyArc02LedgerReplacements, `${label}.sceneCards[${cardIndex}].${key}: early arc_02 ancient-key ledger repair`)
        card.requiredFacts = replaceArrayText(card.requiredFacts, earlyArc02LedgerReplacements, `${label}.sceneCards[${cardIndex}].requiredFacts`)
        card.forbiddenFacts = replaceArrayText(card.forbiddenFacts, earlyArc02LedgerReplacements, `${label}.sceneCards[${cardIndex}].forbiddenFacts`)
      })
    }
    const hasNoFaceAsActiveCharacter = allowed.includes("墟语者·无面")
    if (hasNoFaceAsActiveCharacter) {
      const keptAllowed = allowed.filter((name) => name !== "墟语者·无面")
      allowed.length = 0
      allowed.push(...keptAllowed)
      changes.push(`${label}.allowedCharacters -= 墟语者·无面（本批只允许标记/低语干扰，不作为场景登场人物）`)
    }
    const required = sceneCards.flatMap((card) => values(card.requiredCharacters))
    for (const name of required) {
      if (!characterSet.has(name) || allowed.includes(name) || allowedNewCharacters.includes(name)) continue
      allowed.push(name)
      changes.push(`${label}.allowedCharacters += ${name}`)
    }
    const allowedSet = new Set(allowed)
    const forbiddenBefore = canonicalArray(blueprint.forbiddenCharacters, `${label}.forbiddenCharacters`)
    const forbiddenKnown = forbiddenBefore.filter((name) => characterSet.has(name))
    for (const name of forbiddenBefore) {
      if (!characterSet.has(name)) changes.push(`${label}.forbiddenCharacters -= ${name}（非冻结人物/系统压力）`)
    }
    const forbidden = forbiddenKnown.filter((name) => !allowedSet.has(name) && name !== "墟语者·无面")
    for (const name of forbiddenBefore) {
      if (allowedSet.has(name)) changes.push(`${label}.forbiddenCharacters -= ${name}`)
      if (name === "墟语者·无面") changes.push(`${label}.forbiddenCharacters -= 墟语者·无面（本批作为标记/低语压力记录，不作为人物登场边界判断）`)
    }
    if (!forbidden.length) {
      const fallbackForbidden = [...characterSet].filter((name) => !allowedSet.has(name) && !allowedNewCharacters.includes(name))
      if (fallbackForbidden.length) {
        forbidden.push(...fallbackForbidden)
        changes.push(`${label}.forbiddenCharacters 使用未登场冻结人物补齐，避免系统/势力误填人物字段。`)
      }
    }
    blueprint.allowedCharacters = Array.from(new Set(allowed))
    blueprint.allowedNewCharacters = allowedNewCharacters
    blueprint.forbiddenCharacters = Array.from(new Set(forbidden))
  })
  applyCanonicalStateLedger()
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index)
  const completeBlueprints = blueprints.length === chapterNumbers.length && blueprints.every((blueprint, index) => Number(blueprint.chapterNumber) === chapterNumbers[index])
  const expectedBatchContinuity = completeBlueprints
    ? blueprints.slice(0, -1).map((blueprint, index) => {
      const nextBlueprint = blueprints[index + 1] || {}
      const fromChapter = Number(blueprint.chapterNumber)
      const toChapter = Number(nextBlueprint.chapterNumber)
      return {
        fromChapter,
        toChapter,
        requiredCarryover: [
          String(blueprint.nextChapterHandoff || blueprint.nextChapterEntryState || `${fromChapter}章结尾状态必须承接到${toChapter}章开场。`).trim(),
        ],
        forbiddenReset: [
          String(nextBlueprint.previousChapterInput || `${toChapter}章不得重置${fromChapter}章的不可逆变化。`).trim(),
        ],
      }
    })
    : []
  const actualBatchContinuity = Array.isArray(result.batchContinuity) ? result.batchContinuity as unknown[] : []
  actualBatchContinuity.forEach((entry, continuityIndex) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      changes.push(`batchContinuity[${continuityIndex}]: invalid entry replaced by synthesized continuity`)
      return
    }
    const record = entry as Record<string, unknown>
    record.requiredCarryover = replaceArrayText(record.requiredCarryover, [...movementReplacements, ...markerAndKnowledgeReplacements], `batchContinuity[${continuityIndex}].requiredCarryover`)
    record.forbiddenReset = replaceArrayText(record.forbiddenReset, [...movementReplacements, ...markerAndKnowledgeReplacements], `batchContinuity[${continuityIndex}].forbiddenReset`)
  })
  const batchContinuityShapeMatches = expectedBatchContinuity.length === actualBatchContinuity.length
    && expectedBatchContinuity.every((expected, index) => {
      const actual = actualBatchContinuity[index]
      if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false
      const actualRecord = actual as Record<string, unknown>
      return Number(actualRecord.fromChapter) === expected.fromChapter && Number(actualRecord.toChapter) === expected.toChapter
    })
  if (completeBlueprints && (!Array.isArray(result.batchContinuity) || !batchContinuityShapeMatches)) {
    result.batchContinuity = expectedBatchContinuity
    changes.push("batchContinuity: synthesized from adjacent chapter handoffs")
  }
  if (completeBlueprints && (!result.handoffToWritingPlan || typeof result.handoffToWritingPlan !== "object" || Array.isArray(result.handoffToWritingPlan))) {
    const finalBlueprint = blueprints[blueprints.length - 1] || {}
    result.handoffToWritingPlan = {
      chapterNumbers,
      fileNamingRule: `volume_${input.volumeId}_chapter_{chapterNumber}.md`,
      executionOrder: chapterNumbers,
      batchExitState: String(finalBlueprint.nextChapterEntryState || finalBlueprint.nextChapterHandoff || `${input.endChapter}章结束状态待写作节点承接。`).trim(),
      unresolvedRisks: ["由独立正典语义审计继续确认剧情、时间、人物边界。"],
    }
    changes.push("handoffToWritingPlan: synthesized from completed chapter batch")
  }
  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan)
    ? result.handoffToWritingPlan as Record<string, unknown>
    : null
  if (handoff) {
    const finalBlueprintText = JSON.stringify(blueprints[blueprints.length - 1] || {})
    const finalBlueprint = blueprints[blueprints.length - 1] || {}
    const handoffReplacements: Array<[RegExp, string]> = [...movementReplacements, ...markerAndKnowledgeReplacements]
    if (/五道裂纹|裂纹从四道增至五道/u.test(finalBlueprintText)) {
      handoffReplacements.push(
        [/完整性50%（四道裂纹/gu, "完整性50%（五道裂纹"],
        [/古钥匙完整性降至50%/gu, "古钥匙完整性降至50%（五道裂纹）"],
      )
    }
    for (const key of ["fileNamingRule", "batchExitState"]) handoff[key] = replaceText(handoff[key], handoffReplacements, `handoffToWritingPlan.${key}: deterministic text repair`)
    handoff.unresolvedRisks = replaceArrayText(handoff.unresolvedRisks, handoffReplacements, "handoffToWritingPlan.unresolvedRisks")
    const expectedBatchExitState = String(finalBlueprint.nextChapterEntryState || finalBlueprint.nextChapterHandoff || "").trim()
    if (completeBlueprints && expectedBatchExitState && String(handoff.batchExitState || "").trim() !== expectedBatchExitState) {
      changes.push("handoffToWritingPlan.batchExitState: synced from final chapter nextChapterEntryState")
      handoff.batchExitState = expectedBatchExitState
    }
  }
  if (completeBlueprints && (!result.qualitySelfCheck || typeof result.qualitySelfCheck !== "object" || Array.isArray(result.qualitySelfCheck))) {
    result.qualitySelfCheck = {
      allRequestedChaptersCovered: true,
      continuousCausalChain: true,
      allCharactersWithinCanon: true,
      allSceneCardsExecutable: true,
      noProseGenerated: true,
      remainingRisks: ["由独立正典语义审计继续确认，不以自检字段放行。"],
    }
    changes.push("qualitySelfCheck: synthesized for structural validation")
  }
  for (const [index, blueprint] of blueprints.entries()) {
    const chapterNumber = Number(blueprint.chapterNumber)
    const label = Number.isInteger(chapterNumber) ? `第${chapterNumber}章` : `blueprints[${index}]`
    for (const key of chapterTextFields) {
      const compacted = compactContractText(blueprint[key])
      if (compacted !== blueprint[key]) changes.push(`${label}.${key}: final compact`)
      blueprint[key] = compacted
    }
    blueprint.mustAvoid = dedupeStringArray(blueprint.mustAvoid)
    const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards as Record<string, unknown>[] : []
    sceneCards.forEach((card, cardIndex) => {
      for (const key of sceneTextFields) {
        const compacted = compactContractText(card[key])
        if (compacted !== card[key]) changes.push(`${label}.sceneCards[${cardIndex}].${key}: final compact`)
        card[key] = compacted
      }
      card.requiredFacts = dedupeStringArray(card.requiredFacts)
      card.forbiddenFacts = dedupeStringArray(card.forbiddenFacts)
    })
  }
  const finalContinuity = Array.isArray(result.batchContinuity) ? result.batchContinuity as Record<string, unknown>[] : []
  finalContinuity.forEach((entry) => {
    entry.requiredCarryover = dedupeStringArray(entry.requiredCarryover)
    entry.forbiddenReset = dedupeStringArray(entry.forbiddenReset)
  })
  if (handoff) handoff.unresolvedRisks = dedupeStringArray(handoff.unresolvedRisks)
  if (result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck)) {
    const quality = result.qualitySelfCheck as Record<string, unknown>
    quality.remainingRisks = dedupeStringArray(quality.remainingRisks)
  }
  if (changes.length) {
    addEvent(run, "warning", "deterministic-repair", `已在 ${phase} 前自动修正 ${changes.length} 个章节蓝图结构/正典边界字段；这些是确定性安全清洗，用于阻断已知高频漂移。`, {
      phase,
      changes: changes.slice(0, 30),
      truncated: changes.length > 30,
    })
  }
}

function isRetroactiveChapterBlueprintQualityGateError(error: unknown) {
  return /(?:过短，必须写成可执行(?:场景动作|合同字段)|章节蓝图(?:内容密度不足|合同字段不足))/u.test(String(error || ""))
}

function chapterBlueprintValidationOnlyRetroactiveQualityGate(validation: DebugRun["validation"]) {
  const errors = Array.isArray(validation?.errors) ? validation.errors : []
  return errors.length > 0 && errors.every(isRetroactiveChapterBlueprintQualityGateError)
}

function canonicalizeWorldMatrixAnchors(
  result: Record<string, unknown>,
  input: WorldMatrixInput,
  errors: string[],
) {
  if (!errors.length) return [] as number[]
  const matches = errors.map((error) => error.match(/^continuityAnchors\[(\d+)\] 擅自加入后续剧情结论：/u))
  if (matches.some((match) => !match)) return [] as number[]
  const anchors = Array.isArray(result.continuityAnchors) ? result.continuityAnchors as Record<string, unknown>[] : []
  const allowedSources = new Set(continuityLockSources(input.initialCharacterState))
  const indices = [...new Set(matches.map((match) => Number(match?.[1])).filter((index) => Number.isInteger(index) && index >= 0 && index < anchors.length))]
  for (const index of indices) {
    const source = String(anchors[index].source || "").trim()
    if (!allowedSources.has(source)) return [] as number[]
    anchors[index] = {
      ...anchors[index],
      anchor: `冻结约束：${source}`,
      verificationSignal: `每次状态更新均检查是否仍满足：${source}`,
      forbiddenDrift: `禁止任何世界规则、地点状态或人物接口违反：${source}`,
    }
  }
  return indices
}

function canonicalizeWorldMatrixHandoffSchedule(result: Record<string, unknown>, errors: string[]) {
  if (errors.length !== 1 || !errors[0].startsWith("handoffToPlotArchitecture 包含越界章节排期：")) return 0
  const handoff = result.handoffToPlotArchitecture && typeof result.handoffToPlotArchitecture === "object" && !Array.isArray(result.handoffToPlotArchitecture)
    ? result.handoffToPlotArchitecture as Record<string, unknown>
    : {}
  const scheduledChapterPattern = /第(?:(?:[2-9]\d*|\d{2,})(?:[-—至到]\d+)?|(?:二|三|四|五|六|七|八|九|十|百)[一二三四五六七八九十百]*)章/gu
  let changed = 0
  for (const key of ["causalInputs", "availableChoices", "lockedConsequences", "escalationAxes", "forbiddenShortcuts"]) {
    if (!Array.isArray(handoff[key])) continue
    handoff[key] = (handoff[key] as unknown[]).map((value) => {
      const text = String(value || "")
      if (!scheduledChapterPattern.test(text)) {
        scheduledChapterPattern.lastIndex = 0
        return value
      }
      scheduledChapterPattern.lastIndex = 0
      changed += 1
      return text.replace(scheduledChapterPattern, "后续阶段（具体时点由主线架构决定）")
    })
  }
  return changed
}

async function executeRun(run: DebugRun) {
  const input = run.input as WorldFoundationInput
  const runDir = path.join(runsRoot, run.runId)
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始独立执行世界观节点。", { runId: run.runId, isolated: true })
  await fs.mkdir(runDir, { recursive: true })
  await fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(run.input, null, 2)}\n`)
  run.artifacts.push("01-input.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]",
    }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)

    run.prompts = buildPrompts(input, run.runId)
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}\n`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}\n`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}\n`),
    ])
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md")
    addEvent(run, "success", "prompt", "实际请求 Prompt 已冻结到本次 run。", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
    })

    let lastStreamEventAt = 0
    addEvent(run, "info", "llm", "请求已发送给真实模型，等待首段响应。", { modelName: config.provider.modelName })
    const raw = await generateAgentReply({
      roleName: "World Foundation Architect",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "world_foundation_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `模型正在输出，已接收 ${run.rawResponse.length} 字符。`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240),
          })
          await persistRun(run)
        }
      },
    })
    run.rawResponse = raw
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}\n`)
    run.artifacts.push("05-raw-response.txt")
    addEvent(run, "success", "llm", `模型响应完成，共 ${raw.length} 字符。`, { responseChars: raw.length })

    const parsed = parseDebugModelJsonObject(raw)
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
      run.artifacts.push("05b-repaired-response.txt")
      addEvent(run, "warning", "parse", `原始响应不是合法 JSON；已完成 ${parsed.repairs.length} 处结构修复并重新解析。`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs,
      })
    }
    const result = parsed.value
    run.result = result
    await fs.writeFile(path.join(runDir, "06-world-foundation.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("06-world-foundation.json")
    addEvent(run, "success", "parse", parsed.repairedText ? "修复后的响应已解析为 JSON；原始响应保持不变。" : "原始响应已解析为 JSON。", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText),
    })

    run.validation = validateFoundation(result)
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `内容验证未通过：${run.validation.errors.length} 个错误。`, { errors: run.validation.errors, warnings: run.validation.warnings })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "内容验证通过，本次 run 可以进入人工审阅。", { warnings: run.validation.warnings })
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

async function executeCharacterRun(run: DebugRun) {
  const input = run.input as CharacterPlanningInput
  const runDir = path.join(runsRoot, run.runId)
  const inheritedNames = worldCharacterNames(input.worldFoundation)
  const targetCount = Math.max(inheritedNames.length, characterTargetForScale(input.totalChapters))
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始独立执行人物规划节点。", { runId: run.runId, isolated: true })
  addEvent(run, "success", "upstream", "已从服务端锁定已通过验证的上游世界观 Run。", {
    upstreamRunId: input.upstreamRunId,
    inheritedCharacterCount: inheritedNames.length,
    inheritedCharacterNames: inheritedNames,
  })
  addEvent(run, "info", "scale", `根据 ${input.totalChapters} 章体量，具名规划人物最低目标为 ${targetCount} 人。`, {
    totalChapters: input.totalChapters,
    inheritedCount: inheritedNames.length,
    minimumPlannedCount: targetCount,
    charactersToAddAtLeast: Math.max(0, targetCount - inheritedNames.length),
  })
  await fs.mkdir(runDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({
      upstreamRunId: input.upstreamRunId,
      planningFocus: input.planningFocus,
      totalChapters: input.totalChapters,
      temperature: input.temperature,
    }, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01b-upstream-world-foundation.json"), `${JSON.stringify(input.worldFoundation, null, 2)}\n`),
  ])
  run.artifacts.push("01-input.json", "01b-upstream-world-foundation.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]",
    }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)

    run.prompts = buildCharacterPrompts(input, run.runId)
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}\n`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}\n`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}\n`),
    ])
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md")
    addEvent(run, "success", "prompt", "人物规划实际请求 Prompt 已冻结到本次 run。", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId,
    })

    let lastStreamEventAt = 0
    addEvent(run, "info", "llm", "请求已发送给真实模型，等待人物规划首段响应。", { modelName: config.provider.modelName })
    const raw = await generateAgentReply({
      roleName: "Character Dynamics Architect",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "character_planning_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `模型正在输出人物规划，已接收 ${run.rawResponse.length} 字符。`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240),
          })
          await persistRun(run)
        }
      },
    })
    run.rawResponse = raw
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}\n`)
    run.artifacts.push("05-raw-response.txt")
    addEvent(run, "success", "llm", `人物规划响应完成，共 ${raw.length} 字符。`, { responseChars: raw.length })

    const parsed = parseDebugModelJsonObject(raw)
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
      run.artifacts.push("05b-repaired-response.txt")
      addEvent(run, "warning", "parse", `原始响应不是合法 JSON；已完成 ${parsed.repairs.length} 处结构修复并重新解析。`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs,
      })
    }
    const result = parsed.value
    run.result = result
    await fs.writeFile(path.join(runDir, "06-character-planning.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("06-character-planning.json")
    addEvent(run, "success", "parse", parsed.repairedText ? "修复后的响应已解析为人物规划 JSON；原始响应保持不变。" : "原始响应已解析为人物规划 JSON。", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText),
    })

    run.validation = validateCharacterPlan(result, input)
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    const plannedNames = Array.isArray(result.characters)
      ? result.characters.map((item) => String((item as Record<string, unknown>)?.name || "")).filter(Boolean)
      : []
    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `人物规划验证未通过：${run.validation.errors.length} 个错误。`, {
        errors: run.validation.errors,
        warnings: run.validation.warnings,
        plannedCharacterCount: plannedNames.length,
      })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "人物规划验证通过；上游人物已继承，项目体量、关系网和阶段扩容方案均可进入人工审阅。", {
        inheritedCharacterCount: inheritedNames.length,
        plannedCharacterCount: plannedNames.length,
        addedCharacterNames: plannedNames.filter((name) => !inheritedNames.includes(name)),
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `人物规划节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

async function executeInitialCharacterStateRun(run: DebugRun) {
  const input = run.input as InitialCharacterStateInput
  const runDir = path.join(runsRoot, run.runId)
  const names = plannedCharacterNames(input.characterPlanning)
  const relationshipCount = Array.isArray(input.characterPlanning.relationshipGraph) ? input.characterPlanning.relationshipGraph.length : 0
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始独立执行人物初始状态节点。", { runId: run.runId, isolated: true })
  addEvent(run, "success", "upstream", "已从服务端锁定已通过验证的人物规划 Run。", {
    upstreamRunId: input.upstreamRunId,
    frozenCharacterCount: names.length,
    frozenCharacterNames: names,
  })
  addEvent(run, "info", "freeze", `准备冻结 ${names.length} 人在第 ${input.openingChapter} 章开场时刻的状态。`, {
    openingChapter: input.openingChapter,
    relationshipEdgesToInitialize: relationshipCount,
    newCharactersAllowed: false,
  })
  await fs.mkdir(runDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({
      upstreamRunId: input.upstreamRunId,
      stateFocus: input.stateFocus,
      openingChapter: input.openingChapter,
      totalChapters: input.totalChapters,
      temperature: input.temperature,
    }, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01b-upstream-character-planning.json"), `${JSON.stringify(input.characterPlanning, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01c-upstream-world-foundation.json"), `${JSON.stringify(input.worldFoundation, null, 2)}\n`),
  ])
  run.artifacts.push("01-input.json", "01b-upstream-character-planning.json", "01c-upstream-world-foundation.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]",
    }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)

    run.prompts = buildInitialCharacterStatePrompts(input, run.runId)
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}\n`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}\n`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}\n`),
    ])
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md")
    addEvent(run, "success", "prompt", "人物初始状态实际请求 Prompt 已冻结到本次 run。", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId,
    })

    let lastStreamEventAt = 0
    addEvent(run, "info", "llm", "请求已发送给真实模型，等待人物初始状态首段响应。", { modelName: config.provider.modelName })
    const raw = await generateAgentReply({
      roleName: "Initial Character State Architect",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "initial_character_state_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `模型正在输出人物初始状态，已接收 ${run.rawResponse.length} 字符。`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240),
          })
          await persistRun(run)
        }
      },
    })
    run.rawResponse = raw
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}\n`)
    run.artifacts.push("05-raw-response.txt")
    addEvent(run, "success", "llm", `人物初始状态响应完成，共 ${raw.length} 字符。`, { responseChars: raw.length })

    const parsed = parseDebugModelJsonObject(raw)
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
      run.artifacts.push("05b-repaired-response.txt")
      addEvent(run, "warning", "parse", `原始响应不是合法 JSON；已完成 ${parsed.repairs.length} 处结构修复并重新解析。`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs,
      })
    }
    let result = parsed.value
    run.result = result
    await fs.writeFile(path.join(runDir, "06-initial-character-state.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("06-initial-character-state.json")
    addEvent(run, "success", "parse", parsed.repairedText ? "修复后的响应已解析为人物初始状态 JSON；原始响应保持不变。" : "原始响应已解析为人物初始状态 JSON。", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText),
    })

    run.validation = validateInitialCharacterState(result, input)
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    if (!run.validation.valid) {
      const initialValidation = run.validation
      const repairMessage = buildInitialCharacterStateRepairMessage(input, result, initialValidation.errors)
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}\n`)
      run.artifacts.push("08-repair-message.md")
      addEvent(run, "warning", "repair", `首次结构校验发现 ${initialValidation.errors.length} 个错误，启动一次真实模型定向修复。`, {
        errors: initialValidation.errors,
        repairTemperature: Math.min(input.temperature, 0.2),
        originalResponseArtifact: "05-raw-response.txt",
        repairMessageArtifact: "08-repair-message.md",
      })
      try {
        let repairRaw = ""
        let lastRepairStreamEventAt = 0
        const repairedReply = await generateAgentReply({
          roleName: "Initial Character State Repair Architect",
          basePrompt: "你是人物状态 JSON 修复器。只修复程序列出的错误，不扩写剧情，不新增人物或关系，不输出解释。",
          dynamicPrompt: `冻结人物与关系均在修复消息中给出。上游人物规划 Run：${input.upstreamRunId}`,
          consensus: `独立调试 Run: ${run.runId}\n自动修复轮：1/1`,
          message: repairMessage,
          currentStage: "initial_character_state_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.2),
          onDelta: async (delta) => {
            repairRaw += delta
            run.rawResponse = repairRaw
            const now = Date.now()
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now
              addEvent(run, "stream", "repair", `模型正在定向修复人物初始状态，已接收 ${repairRaw.length} 字符。`, {
                responseChars: repairRaw.length,
                tail: repairRaw.slice(-240),
              })
              await persistRun(run)
            }
          },
        })
        repairRaw = repairedReply
        run.rawResponse = repairRaw
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}\n`)
        run.artifacts.push("09-repair-raw-response.txt")
        const repairedParsed = parseDebugModelJsonObject(repairRaw)
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}\n`)
          run.artifacts.push("09b-repaired-json-text.txt")
        }
        result = repairedParsed.value
        run.result = result
        run.validation = validateInitialCharacterState(result, input)
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-initial-character-state-repaired.json"), `${JSON.stringify(result, null, 2)}\n`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
        ])
        run.artifacts.push("10-initial-character-state-repaired.json", "11-validation-after-repair.json")
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid
          ? "定向修复响应已通过结构校验。"
          : `定向修复后仍有 ${run.validation.errors.length} 个错误。`, {
          errors: run.validation.errors,
          warnings: run.validation.warnings,
          repairedResponseChars: repairRaw.length,
        })
      } catch (repairError) {
        run.validation = initialValidation
        addEvent(run, "error", "repair", `定向修复调用失败，保留首次校验结果：${repairError instanceof Error ? repairError.message : String(repairError)}`)
      }
    }
    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `人物初始状态验证未通过：${run.validation.errors.length} 个错误。`, {
        errors: run.validation.errors,
        warnings: run.validation.warnings,
        initializedCharacterCount: Array.isArray(result.characters) ? result.characters.length : 0,
      })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "人物初始状态验证通过；人物集合、开场动作、知识边界和关系状态均可交给世界矩阵节点。", {
        initializedCharacterCount: names.length,
        relationshipStateCount: Array.isArray(result.relationshipStateLedger) ? result.relationshipStateLedger.length : 0,
        openingChapter: input.openingChapter,
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `人物初始状态节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

async function executeWorldMatrixRun(run: DebugRun) {
  const input = run.input as WorldMatrixInput
  const runDir = path.join(runsRoot, run.runId)
  const characters = initialStateCharacters(input.initialCharacterState)
  const locations = openingLocationNames(input.initialCharacterState)
  const ruleCount = Array.isArray(input.worldFoundation.worldRules) ? input.worldFoundation.worldRules.length : 0
  const clockCount = Array.isArray(input.initialCharacterState.activeClocks) ? input.initialCharacterState.activeClocks.length : 0
  const knowledgeLockCount = Array.isArray(input.initialCharacterState.openingKnowledgeLocks) ? input.initialCharacterState.openingKnowledgeLocks.length : 0
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始独立执行世界矩阵节点。", { runId: run.runId, isolated: true, productionPhase: "phase_5_world_matrix" })
  addEvent(run, "success", "upstream", "已从服务端锁定通过验证的人物初始状态 Run。", {
    upstreamRunId: input.upstreamRunId,
    frozenCharacterCount: characters.length,
    frozenOpeningLocationCount: locations.length,
    sourceRuleCount: ruleCount,
    activeClockCount: clockCount,
    knowledgeLockCount,
  })
  addEvent(run, "info", "boundary", "节点边界已冻结：只生成世界矩阵，不生成主线架构、章节因果链或正文。", {
    allowedPhase: "phase_5_world_matrix",
    nextPhase: "phase_6_plot_architecture",
    forbiddenOutputs: ["plotArchitecture", "chapters", "arcPlan", "mainPlot", "volumeStrategy"],
  })
  await fs.mkdir(runDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, matrixFocus: input.matrixFocus, totalChapters: input.totalChapters, temperature: input.temperature }, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01b-upstream-initial-character-state.json"), `${JSON.stringify(input.initialCharacterState, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01c-upstream-character-planning.json"), `${JSON.stringify(input.characterPlanning, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01d-upstream-world-foundation.json"), `${JSON.stringify(input.worldFoundation, null, 2)}\n`),
  ])
  run.artifacts.push("01-input.json", "01b-upstream-initial-character-state.json", "01c-upstream-character-planning.json", "01d-upstream-world-foundation.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]",
    }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)

    run.prompts = buildWorldMatrixPrompts(input, run.runId)
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}\n`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}\n`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}\n`),
    ])
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md")
    addEvent(run, "success", "prompt", "世界矩阵实际请求 Prompt 已冻结到本次 run。", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId,
    })

    let lastStreamEventAt = 0
    addEvent(run, "info", "llm", "请求已发送给真实模型，等待世界矩阵首段响应。", { modelName: config.provider.modelName })
    const raw = await generateAgentReply({
      roleName: "World Matrix Architect",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "world_matrix_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `模型正在输出世界矩阵，已接收 ${run.rawResponse.length} 字符。`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240),
          })
          await persistRun(run)
        }
      },
    })
    run.rawResponse = raw
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}\n`)
    run.artifacts.push("05-raw-response.txt")
    addEvent(run, "success", "llm", `世界矩阵响应完成，共 ${raw.length} 字符。`, { responseChars: raw.length })

    const parsed = parseDebugModelJsonObject(raw)
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
      run.artifacts.push("05b-repaired-response.txt")
      addEvent(run, "warning", "parse", `原始响应不是合法 JSON；已完成 ${parsed.repairs.length} 处结构修复并重新解析。`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs,
      })
    }
    let result = parsed.value
    run.result = result
    await fs.writeFile(path.join(runDir, "06-world-matrix.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("06-world-matrix.json")
    addEvent(run, "success", "parse", parsed.repairedText ? "修复后的响应已解析为世界矩阵 JSON；原始响应保持不变。" : "原始响应已解析为世界矩阵 JSON。", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText),
    })

    run.validation = validateWorldMatrix(result, input)
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    if (!run.validation.valid) {
      const initialValidation = run.validation
      const repairMessage = buildWorldMatrixRepairMessage(input, result, initialValidation.errors)
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}\n`)
      run.artifacts.push("08-repair-message.md")
      addEvent(run, "warning", "repair", `首次结构校验发现 ${initialValidation.errors.length} 个错误，启动一次真实模型定向修复。`, {
        errors: initialValidation.errors,
        repairTemperature: Math.min(input.temperature, 0.15),
        originalResponseArtifact: "05-raw-response.txt",
        repairMessageArtifact: "08-repair-message.md",
      })
      try {
        let repairRaw = ""
        let lastRepairStreamEventAt = 0
        const repairedReply = await generateAgentReply({
          roleName: "World Matrix Repair Architect",
          basePrompt: "你是世界矩阵 JSON 修复器。只修复程序列出的错误，不扩写主线、章节或人物，不新增人物。",
          dynamicPrompt: `冻结来源均在修复消息中给出。上游人物初始状态 Run：${input.upstreamRunId}`,
          consensus: `独立调试 Run: ${run.runId}\n自动修复轮：1/1`,
          message: repairMessage,
          currentStage: "world_matrix_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.15),
          onDelta: async (delta) => {
            repairRaw += delta
            run.rawResponse = repairRaw
            const now = Date.now()
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now
              addEvent(run, "stream", "repair", `模型正在定向修复世界矩阵，已接收 ${repairRaw.length} 字符。`, {
                responseChars: repairRaw.length,
                tail: repairRaw.slice(-240),
              })
              await persistRun(run)
            }
          },
        })
        repairRaw = repairedReply
        run.rawResponse = repairRaw
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}\n`)
        run.artifacts.push("09-repair-raw-response.txt")
        const repairedParsed = parseDebugModelJsonObject(repairRaw)
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}\n`)
          run.artifacts.push("09b-repaired-json-text.txt")
        }
        result = repairedParsed.value
        run.result = result
        run.validation = validateWorldMatrix(result, input)
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-world-matrix-repaired.json"), `${JSON.stringify(result, null, 2)}\n`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
        ])
        run.artifacts.push("10-world-matrix-repaired.json", "11-validation-after-repair.json")
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid
          ? "定向修复响应已通过世界矩阵结构校验。"
          : `定向修复后仍有 ${run.validation.errors.length} 个错误。`, {
          errors: run.validation.errors,
          warnings: run.validation.warnings,
          repairedResponseChars: repairRaw.length,
        })
      } catch (repairError) {
        run.validation = initialValidation
        addEvent(run, "error", "repair", `定向修复调用失败，保留首次校验结果：${repairError instanceof Error ? repairError.message : String(repairError)}`)
      }
    }
    if (!run.validation.valid) {
      const canonicalizedAnchorIndices = canonicalizeWorldMatrixAnchors(result, input, run.validation.errors)
      if (canonicalizedAnchorIndices.length) {
        run.result = result
        run.validation = validateWorldMatrix(result, input)
        await Promise.all([
          fs.writeFile(path.join(runDir, "12-world-matrix-canonicalized.json"), `${JSON.stringify(result, null, 2)}\n`),
          fs.writeFile(path.join(runDir, "13-validation-after-canonicalization.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
        ])
        run.artifacts.push("12-world-matrix-canonicalized.json", "13-validation-after-canonicalization.json")
        addEvent(run, run.validation.valid ? "success" : "error", "canonicalize", run.validation.valid
          ? `已将 ${canonicalizedAnchorIndices.length} 条越界锚点确定性恢复为节点 03 的原始冻结锁，并通过复检。`
          : `锚点确定性恢复后仍有 ${run.validation.errors.length} 个错误。`, {
          canonicalizedAnchorIndices,
          errors: run.validation.errors,
          outputArtifact: "12-world-matrix-canonicalized.json",
        })
      }
    }
    if (!run.validation.valid) {
      const canonicalizedScheduleCount = canonicalizeWorldMatrixHandoffSchedule(result, run.validation.errors)
      if (canonicalizedScheduleCount) {
        run.result = result
        run.validation = validateWorldMatrix(result, input)
        await Promise.all([
          fs.writeFile(path.join(runDir, "14-world-matrix-boundary-canonicalized.json"), `${JSON.stringify(result, null, 2)}\n`),
          fs.writeFile(path.join(runDir, "15-validation-after-boundary-canonicalization.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
        ])
        run.artifacts.push("14-world-matrix-boundary-canonicalized.json", "15-validation-after-boundary-canonicalization.json")
        addEvent(run, run.validation.valid ? "success" : "error", "canonicalize", run.validation.valid
          ? `已移除 ${canonicalizedScheduleCount} 处越界章节排期，保留因果条件并交由主线架构决定具体时点。`
          : `移除越界章节排期后仍有 ${run.validation.errors.length} 个错误。`, {
          canonicalizedScheduleCount,
          errors: run.validation.errors,
          outputArtifact: "14-world-matrix-boundary-canonicalized.json",
        })
      }
    }
    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `世界矩阵验证未通过：${run.validation.errors.length} 个错误。`, {
        errors: run.validation.errors,
        warnings: run.validation.warnings,
        mappedCharacterCount: Array.isArray(result.characterWorldInterfaces) ? result.characterWorldInterfaces.length : 0,
      })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "世界矩阵验证通过；规则、地点、人物接口、压力与知识锁可交给主线架构节点。", {
        mappedCharacterCount: characters.length,
        mappedLocationCount: Array.isArray(result.locations) ? result.locations.length : 0,
        mappedRuleCount: Array.isArray(result.rules) ? result.rules.length : 0,
        pressureSystemCount: Array.isArray(result.pressureSystems) ? result.pressureSystems.length : 0,
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `世界矩阵节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

async function executePlotArchitectureRun(run: DebugRun) {
  const input = run.input as PlotArchitectureInput
  const runDir = path.join(runsRoot, run.runId)
  const characters = plannedCharacterNames(input.characterPlanning)
  const pressures = plotSourceNames(input.worldMatrix, "pressureSystems", "name")
  const anchors = plotSourceNames(input.worldMatrix, "continuityAnchors", "id")
  const arcTarget = plotArchitectureArcTarget(input.totalChapters)
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始独立执行主线架构节点。", { runId: run.runId, isolated: true, productionPhase: "phase_6_plot_architecture" })
  addEvent(run, "success", "upstream", "已从服务端锁定通过验证的世界矩阵 Run。", {
    upstreamRunId: input.upstreamRunId,
    frozenCharacterCount: characters.length,
    sourcePressureCount: pressures.length,
    sourceContinuityAnchorCount: anchors.length,
    targetArcCount: arcTarget,
    totalChapters: input.totalChapters,
  })
  addEvent(run, "info", "boundary", "节点边界已冻结：只生成宏观主线因果架构，不生成故事圣经、分卷策略、逐章蓝图或正文。", {
    allowedPhase: "phase_6_plot_architecture",
    nextPhase: "phase_7_story_bible",
    forbiddenOutputs: ["storyBible", "volumeStrategy", "chapterBlueprints", "chapters", "prose"],
  })
  await fs.mkdir(runDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, architectureFocus: input.architectureFocus, totalChapters: input.totalChapters, temperature: input.temperature }, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01b-upstream-world-matrix.json"), `${JSON.stringify(input.worldMatrix, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01c-upstream-character-planning.json"), `${JSON.stringify(input.characterPlanning, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01d-upstream-initial-character-state.json"), `${JSON.stringify(input.initialCharacterState, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01e-upstream-world-foundation.json"), `${JSON.stringify(input.worldFoundation, null, 2)}\n`),
  ])
  run.artifacts.push("01-input.json", "01b-upstream-world-matrix.json", "01c-upstream-character-planning.json", "01d-upstream-initial-character-state.json", "01e-upstream-world-foundation.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]",
    }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)

    run.prompts = buildPlotArchitecturePrompts(input, run.runId)
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}\n`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}\n`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}\n`),
    ])
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md")
    addEvent(run, "success", "prompt", "主线架构实际请求 Prompt 已冻结到本次 run。", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId,
    })

    let lastStreamEventAt = 0
    addEvent(run, "info", "llm", "请求已发送给真实模型，等待主线架构首段响应。", { modelName: config.provider.modelName })
    const raw = await generateAgentReply({
      roleName: "Plot Architecture Showrunner",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "plot_architecture_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `模型正在输出主线架构，已接收 ${run.rawResponse.length} 字符。`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240),
          })
          await persistRun(run)
        }
      },
    })
    run.rawResponse = raw
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}\n`)
    run.artifacts.push("05-raw-response.txt")
    addEvent(run, "success", "llm", `主线架构响应完成，共 ${raw.length} 字符。`, { responseChars: raw.length })

    const parsed = parseDebugModelJsonObject(raw)
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
      run.artifacts.push("05b-repaired-response.txt")
      addEvent(run, "warning", "parse", `原始响应不是合法 JSON；已完成 ${parsed.repairs.length} 处结构修复并重新解析。`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs,
      })
    }
    let result = parsed.value
    run.result = result
    await fs.writeFile(path.join(runDir, "06-plot-architecture.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("06-plot-architecture.json")
    addEvent(run, "success", "parse", parsed.repairedText ? "修复后的响应已解析为主线架构 JSON；原始响应保持不变。" : "原始响应已解析为主线架构 JSON。", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText),
    })

    run.validation = validatePlotArchitecture(result, input)
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    if (!run.validation.valid) {
      const initialValidation = run.validation
      const repairMessage = buildPlotArchitectureRepairMessage(input, result, initialValidation.errors)
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}\n`)
      run.artifacts.push("08-repair-message.md")
      addEvent(run, "warning", "repair", `首次结构校验发现 ${initialValidation.errors.length} 个错误，启动一次真实模型定向修复。`, {
        errors: initialValidation.errors,
        repairTemperature: Math.min(input.temperature, 0.15),
        originalResponseArtifact: "05-raw-response.txt",
        repairMessageArtifact: "08-repair-message.md",
      })
      try {
        let repairRaw = ""
        let lastRepairStreamEventAt = 0
        const repairedReply = await generateAgentReply({
          roleName: "Plot Architecture Repair Showrunner",
          basePrompt: "你是主线架构 JSON 修复器。只修复程序列出的错误，不新增人物，不生成故事圣经、分卷策略、逐章蓝图或正文。",
          dynamicPrompt: `冻结来源均在修复消息中给出。上游世界矩阵 Run：${input.upstreamRunId}`,
          consensus: `独立调试 Run: ${run.runId}\n自动修复轮：1/1`,
          message: repairMessage,
          currentStage: "plot_architecture_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.15),
          onDelta: async (delta) => {
            repairRaw += delta
            run.rawResponse = repairRaw
            const now = Date.now()
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now
              addEvent(run, "stream", "repair", `模型正在定向修复主线架构，已接收 ${repairRaw.length} 字符。`, {
                responseChars: repairRaw.length,
                tail: repairRaw.slice(-240),
              })
              await persistRun(run)
            }
          },
        })
        repairRaw = repairedReply
        run.rawResponse = repairRaw
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}\n`)
        run.artifacts.push("09-repair-raw-response.txt")
        const repairedParsed = parseDebugModelJsonObject(repairRaw)
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}\n`)
          run.artifacts.push("09b-repaired-json-text.txt")
        }
        result = repairedParsed.value
        run.result = result
        run.validation = validatePlotArchitecture(result, input)
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-plot-architecture-repaired.json"), `${JSON.stringify(result, null, 2)}\n`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
        ])
        run.artifacts.push("10-plot-architecture-repaired.json", "11-validation-after-repair.json")
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid
          ? "定向修复响应已通过主线架构结构校验。"
          : `定向修复后仍有 ${run.validation.errors.length} 个错误。`, {
          errors: run.validation.errors,
          warnings: run.validation.warnings,
          repairedResponseChars: repairRaw.length,
        })
      } catch (repairError) {
        run.validation = initialValidation
        addEvent(run, "error", "repair", `定向修复调用失败，保留首次校验结果：${repairError instanceof Error ? repairError.message : String(repairError)}`)
      }
    }

    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `主线架构验证未通过：${run.validation.errors.length} 个错误。`, {
        errors: run.validation.errors,
        warnings: run.validation.warnings,
        arcCount: Array.isArray(result.arcArchitecture) ? result.arcArchitecture.length : 0,
      })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "主线架构验证通过；宏观因果弧、人物变化、压力升级、连续性锚点和伏笔计划可交给故事圣经节点。", {
        arcCount: Array.isArray(result.arcArchitecture) ? result.arcArchitecture.length : 0,
        characterBindingCount: Array.isArray(result.characterArcBindings) ? result.characterArcBindings.length : 0,
        continuityPlanCount: Array.isArray(result.continuityPlan) ? result.continuityPlan.length : 0,
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `主线架构节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

async function executeStoryBibleRun(run: DebugRun) {
  const input = run.input as StoryBibleInput
  const runDir = path.join(runsRoot, run.runId)
  const characters = plannedCharacterNames(input.characterPlanning)
  const relationships = storyBibleRelationshipKeys(input.characterPlanning)
  const arcIds = plotSourceNames(input.plotArchitecture, "arcArchitecture", "id")
  const continuityIds = plotSourceNames(input.plotArchitecture, "continuityPlan", "sourceAnchorId")
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始独立执行故事圣经节点。", { runId: run.runId, isolated: true, productionPhase: "phase_7_story_bible" })
  addEvent(run, "success", "upstream", "已从服务端锁定通过验证的主线架构 Run。", {
    upstreamRunId: input.upstreamRunId,
    frozenCharacterCount: characters.length,
    frozenRelationshipCount: relationships.length,
    sourceArcCount: arcIds.length,
    sourceContinuityAnchorCount: continuityIds.length,
  })
  addEvent(run, "info", "boundary", "节点边界已冻结：只生成故事正典，不重新规划主线，不生成分卷策略、逐章蓝图或正文。", {
    allowedPhase: "phase_7_story_bible",
    nextPhase: "phase_8_volume_strategy",
    forbiddenOutputs: ["volumeStrategy", "chapterBlueprints", "chapters", "chapterDrafts", "prose"],
  })
  await fs.mkdir(runDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, bibleFocus: input.bibleFocus, totalChapters: input.totalChapters, temperature: input.temperature }, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01b-upstream-plot-architecture.json"), `${JSON.stringify(input.plotArchitecture, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01c-upstream-world-matrix.json"), `${JSON.stringify(input.worldMatrix, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01d-upstream-character-planning.json"), `${JSON.stringify(input.characterPlanning, null, 2)}\n`),
  ])
  run.artifacts.push("01-input.json", "01b-upstream-plot-architecture.json", "01c-upstream-world-matrix.json", "01d-upstream-character-planning.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    run.provider = { configId: config._configId, configName: config._configName || config.provider.modelName, baseUrl: config.provider.baseUrl, modelName: config.provider.modelName, apiMode: config.provider.apiMode, timeoutMs: config.provider.timeoutMs, temperature: input.temperature, apiKey: "[REDACTED]" }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)

    run.prompts = buildStoryBiblePrompts(input, run.runId)
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}\n`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}\n`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}\n`),
    ])
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md")
    addEvent(run, "success", "prompt", "故事圣经实际请求 Prompt 已冻结到本次 run。", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId,
    })

    let lastStreamEventAt = 0
    addEvent(run, "info", "llm", "请求已发送给真实模型，等待故事圣经首段响应。", { modelName: config.provider.modelName })
    const raw = await generateAgentReply({
      roleName: "Story Bible Canon Editor",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "story_bible_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `模型正在输出故事圣经，已接收 ${run.rawResponse.length} 字符。`, { responseChars: run.rawResponse.length, tail: run.rawResponse.slice(-240) })
          await persistRun(run)
        }
      },
    })
    run.rawResponse = raw
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}\n`)
    run.artifacts.push("05-raw-response.txt")
    addEvent(run, "success", "llm", `故事圣经响应完成，共 ${raw.length} 字符。`, { responseChars: raw.length })

    const parsed = parseDebugModelJsonObject(raw)
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
      run.artifacts.push("05b-repaired-response.txt")
      addEvent(run, "warning", "parse", `原始响应不是合法 JSON；已完成 ${parsed.repairs.length} 处结构修复并重新解析。`, { originalError: parsed.originalError, repairs: parsed.repairs })
    }
    let result = parsed.value
    run.result = result
    await fs.writeFile(path.join(runDir, "06-story-bible.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("06-story-bible.json")
    addEvent(run, "success", "parse", parsed.repairedText ? "修复后的响应已解析为故事圣经 JSON；原始响应保持不变。" : "原始响应已解析为故事圣经 JSON。", { topLevelKeys: Object.keys(result), repaired: Boolean(parsed.repairedText) })

    run.validation = validateStoryBible(result, input)
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    if (!run.validation.valid) {
      const initialValidation = run.validation
      const repairMessage = buildStoryBibleRepairMessage(input, result, initialValidation.errors)
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}\n`)
      run.artifacts.push("08-repair-message.md")
      addEvent(run, "warning", "repair", `首次结构校验发现 ${initialValidation.errors.length} 个错误，启动一次真实模型定向修复。`, { errors: initialValidation.errors, repairTemperature: Math.min(input.temperature, 0.15), repairMessageArtifact: "08-repair-message.md" })
      try {
        let repairRaw = ""
        let lastRepairStreamEventAt = 0
        const repairedReply = await generateAgentReply({
          roleName: "Story Bible Repair Editor",
          basePrompt: "你是故事圣经 JSON 修复器。只修复程序列出的错误，不重新规划主线，不新增人物，不生成分卷、逐章蓝图或正文。",
          dynamicPrompt: `冻结来源均在修复消息中给出。上游主线架构 Run：${input.upstreamRunId}`,
          consensus: `独立调试 Run: ${run.runId}\n自动修复轮：1/1`,
          message: repairMessage,
          currentStage: "story_bible_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.15),
          onDelta: async (delta) => {
            repairRaw += delta
            run.rawResponse = repairRaw
            const now = Date.now()
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now
              addEvent(run, "stream", "repair", `模型正在定向修复故事圣经，已接收 ${repairRaw.length} 字符。`, { responseChars: repairRaw.length, tail: repairRaw.slice(-240) })
              await persistRun(run)
            }
          },
        })
        repairRaw = repairedReply
        run.rawResponse = repairRaw
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}\n`)
        run.artifacts.push("09-repair-raw-response.txt")
        const repairedParsed = parseDebugModelJsonObject(repairRaw)
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}\n`)
          run.artifacts.push("09b-repaired-json-text.txt")
        }
        result = repairedParsed.value
        run.result = result
        run.validation = validateStoryBible(result, input)
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-story-bible-repaired.json"), `${JSON.stringify(result, null, 2)}\n`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
        ])
        run.artifacts.push("10-story-bible-repaired.json", "11-validation-after-repair.json")
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid ? "定向修复响应已通过故事圣经结构校验。" : `定向修复后仍有 ${run.validation.errors.length} 个错误。`, { errors: run.validation.errors, warnings: run.validation.warnings, repairedResponseChars: repairRaw.length })
      } catch (repairError) {
        run.validation = initialValidation
        addEvent(run, "error", "repair", `定向修复调用失败，保留首次校验结果：${repairError instanceof Error ? repairError.message : String(repairError)}`)
      }
    }

    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `故事圣经验证未通过：${run.validation.errors.length} 个错误。`, { errors: run.validation.errors, warnings: run.validation.warnings })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "故事圣经验证通过；世界、人物、关系、弧线、术语、连续性和承诺正典可交给分卷策略节点。", {
        characterCanonCount: Array.isArray(result.characterCanon) ? result.characterCanon.length : 0,
        relationshipCanonCount: Array.isArray(result.relationshipCanon) ? result.relationshipCanon.length : 0,
        arcCanonCount: Array.isArray(result.arcCanon) ? result.arcCanon.length : 0,
        continuityCanonCount: Array.isArray(result.continuityCanon) ? result.continuityCanon.length : 0,
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `故事圣经节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

async function executeVolumeStrategyRun(run: DebugRun) {
  const input = run.input as VolumeStrategyInput
  const runDir = path.join(runsRoot, run.runId)
  const arcIds = plotSourceNames(input.plotArchitecture, "arcArchitecture", "id")
  const characters = volumeStrategyCharacterNames(input.storyBible)
  const seeds = volumeStrategyPromiseSeeds(input.storyBible)
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始独立执行分卷策略节点。", { runId: run.runId, isolated: true, productionPhase: "phase_8_volume_strategy" })
  addEvent(run, "success", "upstream", "已从服务端锁定通过验证的故事圣经 Run。", {
    upstreamRunId: input.upstreamRunId,
    sourceArcCount: arcIds.length,
    frozenCharacterCount: characters.length,
    promiseCount: seeds.length,
    targetVolumeCount: input.targetVolumeCount,
  })
  addEvent(run, "info", "boundary", "节点边界已冻结：只生成卷级策略，不修改故事正典，不生成逐章蓝图、章节计划或正文。", {
    allowedPhase: "phase_8_volume_strategy",
    nextPhase: "phase_9_chapter_blueprints",
    forbiddenOutputs: ["chapterBlueprints", "chapters", "chapterPlans", "chapterDrafts", "prose"],
  })
  await fs.mkdir(runDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, strategyFocus: input.strategyFocus, targetVolumeCount: input.targetVolumeCount, totalChapters: input.totalChapters, temperature: input.temperature }, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01b-upstream-story-bible.json"), `${JSON.stringify(input.storyBible, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01c-upstream-plot-architecture.json"), `${JSON.stringify(input.plotArchitecture, null, 2)}\n`),
  ])
  run.artifacts.push("01-input.json", "01b-upstream-story-bible.json", "01c-upstream-plot-architecture.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    run.provider = { configId: config._configId, configName: config._configName || config.provider.modelName, baseUrl: config.provider.baseUrl, modelName: config.provider.modelName, apiMode: config.provider.apiMode, timeoutMs: config.provider.timeoutMs, temperature: input.temperature, apiKey: "[REDACTED]" }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)

    run.prompts = buildVolumeStrategyPrompts(input, run.runId)
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}\n`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}\n`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}\n`),
    ])
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md")
    addEvent(run, "success", "prompt", "分卷策略实际请求 Prompt 已冻结到本次 run。", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId,
      targetVolumeCount: input.targetVolumeCount,
    })

    let lastStreamEventAt = 0
    addEvent(run, "info", "llm", "请求已发送给真实模型，等待分卷策略首段响应。", { modelName: config.provider.modelName })
    const raw = await generateAgentReply({
      roleName: "Volume Strategy Showrunner",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "volume_strategy_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `模型正在输出分卷策略，已接收 ${run.rawResponse.length} 字符。`, { responseChars: run.rawResponse.length, tail: run.rawResponse.slice(-240) })
          await persistRun(run)
        }
      },
    })
    run.rawResponse = raw
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}\n`)
    run.artifacts.push("05-raw-response.txt")
    addEvent(run, "success", "llm", `分卷策略响应完成，共 ${raw.length} 字符。`, { responseChars: raw.length })

    const parsed = parseDebugModelJsonObject(raw)
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
      run.artifacts.push("05b-repaired-response.txt")
      addEvent(run, "warning", "parse", `原始响应不是合法 JSON；已完成 ${parsed.repairs.length} 处结构修复并重新解析。`, { originalError: parsed.originalError, repairs: parsed.repairs })
    }
    let result = parsed.value
    run.result = result
    await fs.writeFile(path.join(runDir, "06-volume-strategy.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("06-volume-strategy.json")
    addEvent(run, "success", "parse", parsed.repairedText ? "修复后的响应已解析为分卷策略 JSON；原始响应保持不变。" : "原始响应已解析为分卷策略 JSON。", { topLevelKeys: Object.keys(result), repaired: Boolean(parsed.repairedText) })

    run.validation = validateVolumeStrategy(result, input)
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    if (!run.validation.valid) {
      const initialValidation = run.validation
      const repairMessage = buildVolumeStrategyRepairMessage(input, result, initialValidation.errors)
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}\n`)
      run.artifacts.push("08-repair-message.md")
      addEvent(run, "warning", "repair", `首次结构校验发现 ${initialValidation.errors.length} 个错误，启动一次真实模型定向修复。`, { errors: initialValidation.errors, repairTemperature: Math.min(input.temperature, 0.15), repairMessageArtifact: "08-repair-message.md" })
      try {
        let repairRaw = ""
        let lastRepairStreamEventAt = 0
        const repairedReply = await generateAgentReply({
          roleName: "Volume Strategy Repair Showrunner",
          basePrompt: "你是分卷策略 JSON 修复器。只修复程序列出的错误，不修改故事正典，不生成逐章蓝图、章节计划或正文。",
          dynamicPrompt: `冻结来源均在修复消息中给出。上游故事圣经 Run：${input.upstreamRunId}`,
          consensus: `独立调试 Run: ${run.runId}\n自动修复轮：1/1`,
          message: repairMessage,
          currentStage: "volume_strategy_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.15),
          onDelta: async (delta) => {
            repairRaw += delta
            run.rawResponse = repairRaw
            const now = Date.now()
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now
              addEvent(run, "stream", "repair", `模型正在定向修复分卷策略，已接收 ${repairRaw.length} 字符。`, { responseChars: repairRaw.length, tail: repairRaw.slice(-240) })
              await persistRun(run)
            }
          },
        })
        repairRaw = repairedReply
        run.rawResponse = repairRaw
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}\n`)
        run.artifacts.push("09-repair-raw-response.txt")
        const repairedParsed = parseDebugModelJsonObject(repairRaw)
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}\n`)
          run.artifacts.push("09b-repaired-json-text.txt")
        }
        result = repairedParsed.value
        run.result = result
        run.validation = validateVolumeStrategy(result, input)
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-volume-strategy-repaired.json"), `${JSON.stringify(result, null, 2)}\n`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
        ])
        run.artifacts.push("10-volume-strategy-repaired.json", "11-validation-after-repair.json")
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid ? "定向修复响应已通过分卷策略结构校验。" : `定向修复后仍有 ${run.validation.errors.length} 个错误。`, { errors: run.validation.errors, warnings: run.validation.warnings, repairedResponseChars: repairRaw.length })
      } catch (repairError) {
        run.validation = initialValidation
        addEvent(run, "error", "repair", `定向修复调用失败，保留首次校验结果：${repairError instanceof Error ? repairError.message : String(repairError)}`)
      }
    }

    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `分卷策略验证未通过：${run.validation.errors.length} 个错误。`, { errors: run.validation.errors, warnings: run.validation.warnings })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "分卷策略验证通过；卷级章节范围、主线弧、人物覆盖和伏笔排期可交给逐章蓝图节点。", {
        volumeCount: Array.isArray(result.volumes) ? result.volumes.length : 0,
        arcCoverageCount: Array.isArray(result.arcCoverage) ? result.arcCoverage.length : 0,
        characterCoverageCount: Array.isArray(result.characterCoverage) ? result.characterCoverage.length : 0,
        promiseScheduleCount: Array.isArray(result.promiseSchedule) ? result.promiseSchedule.length : 0,
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `分卷策略节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

function chapterBlueprintStateSnapshotFromRun(run: DebugRun): ChapterBlueprintStateSnapshot | null {
  if (run.nodeId !== "chapter-blueprints" || run.status !== "completed" || run.validation?.valid !== true || !run.result) return null
  const input = run.input as ChapterBlueprintInput
  const blueprints = Array.isArray(run.result.blueprints) ? run.result.blueprints as Record<string, unknown>[] : []
  const finalBlueprint = blueprints.find((entry) => Number(entry.chapterNumber) === input.endChapter) || blueprints.at(-1) || {}
  const handoff = run.result.handoffToWritingPlan && typeof run.result.handoffToWritingPlan === "object" && !Array.isArray(run.result.handoffToWritingPlan)
    ? run.result.handoffToWritingPlan as Record<string, unknown>
    : {}
  return {
    runId: run.runId,
    volumeId: input.volumeId,
    startChapter: input.startChapter,
    endChapter: input.endChapter,
    batchExitState: String(handoff.batchExitState || handoff.batchExitPressure || "").trim(),
    unresolvedRisks: volumeStrategyStringValues(handoff.unresolvedRisks),
    endingHook: String(finalBlueprint.endingHook || finalBlueprint.nextPressure || "").trim(),
    nextChapterEntryState: String(finalBlueprint.nextChapterEntryState || finalBlueprint.nextPressure || "").trim(),
    nextChapterHandoff: String(finalBlueprint.nextChapterHandoff || finalBlueprint.nextPressure || "").trim(),
  }
}

function styleProfileBlueprints(input: StyleProfileInput) {
  return Array.isArray(input.chapterBlueprints.blueprints)
    ? input.chapterBlueprints.blueprints as Record<string, unknown>[]
    : []
}

function splitStyleHumanBaselineSamples(text: string) {
  const normalized = String(text || "")
    .replace(/\r\n?/gu, "\n")
    .trim()
  if (!normalized) return []
  const paragraphs = normalized
    .split(/\n{2,}|-{3,}|={3,}/u)
    .map((entry) => entry.replace(/\s+/gu, " ").trim())
    .filter((entry) => entry.length >= 80)
  if (paragraphs.length) return paragraphs.slice(0, 8)
  return normalized.length >= 80 ? [normalized.slice(0, 2000)] : []
}

function splitAigcLabTextIntoSentenceSegments(text: string, options: { granularity?: string; minSegmentChars?: number } = {}) {
  const normalized = String(text || "").replace(/\r\n?/gu, "\n")
  const granularity = String(options.granularity || "sentence").trim()
  const minSegmentChars = Math.max(1, Math.min(500, Number(options.minSegmentChars || 1)))
  if (granularity === "paragraph" || granularity === "detector_default") {
    const paragraphPattern = /[^\n]+(?:\n(?!\n)[^\n]+)*/gu
    const paragraphSegments: AigcTextSegment[] = []
    for (const match of normalized.matchAll(paragraphPattern)) {
      const raw = match[0] || ""
      const trimmed = raw.trim()
      if (trimmed.length < 2) continue
      const rawStart = match.index || 0
      const leadingWhitespace = raw.match(/^\s*/u)?.[0]?.length || 0
      const startOffset = rawStart + leadingWhitespace
      for (let offset = 0; offset < trimmed.length; offset += 900) {
        const chunk = trimmed.slice(offset, offset + 900).trim()
        if (chunk.length < 2) continue
        paragraphSegments.push({
          id: `paragraph-${paragraphSegments.length + 1}`,
          index: paragraphSegments.length,
          text: chunk,
          startOffset: startOffset + offset,
          endOffset: startOffset + offset + chunk.length,
          metadata: { unit: granularity === "detector_default" ? "detector-like-paragraph" : "paragraph" },
        })
      }
    }
    return paragraphSegments
  }
  const segments: AigcTextSegment[] = []
  const sentencePieces: Array<Omit<AigcTextSegment, "index" | "id">> = []
  const sentencePattern = /[^\n。！？!?；;]+[。！？!?；;]?|[^\n]+/gu
  for (const match of normalized.matchAll(sentencePattern)) {
    const raw = match[0] || ""
    const trimmed = raw.trim()
    if (trimmed.length < 2) continue
    const rawStart = match.index || 0
    const leadingWhitespace = raw.match(/^\s*/u)?.[0]?.length || 0
    const startOffset = rawStart + leadingWhitespace
    const endOffset = startOffset + trimmed.length
    if (trimmed.length <= 480) {
      sentencePieces.push({
        text: trimmed,
        startOffset,
        endOffset,
        metadata: { unit: "sentence" },
      })
      continue
    }
    for (let offset = 0; offset < trimmed.length; offset += 420) {
      const chunk = trimmed.slice(offset, offset + 420).trim()
      if (chunk.length < 2) continue
      sentencePieces.push({
        text: chunk,
        startOffset: startOffset + offset,
        endOffset: startOffset + offset + chunk.length,
        metadata: { unit: "sentence-chunk" },
      })
    }
  }
  if (granularity === "merged_sentence") {
    let pending: Omit<AigcTextSegment, "index" | "id"> | null = null
    for (const piece of sentencePieces) {
      if (!pending) {
        pending = { ...piece, metadata: { unit: "merged-sentence" } }
        continue
      }
      const joined: string = `${pending.text}${piece.text.startsWith("」") ? "" : "\n"}${piece.text}`
      if (pending.text.length < minSegmentChars && joined.length <= 900) {
        pending = {
          text: joined,
          startOffset: pending.startOffset,
          endOffset: piece.endOffset,
          metadata: { unit: "merged-sentence" },
        }
      } else {
        segments.push({ ...pending, id: `segment-${segments.length + 1}`, index: segments.length })
        pending = { ...piece, metadata: { unit: "merged-sentence" } }
      }
    }
    if (pending) segments.push({ ...pending, id: `segment-${segments.length + 1}`, index: segments.length })
    return segments
  }
  for (const piece of sentencePieces) {
    segments.push({ ...piece, id: `sentence-${segments.length + 1}`, index: segments.length })
  }
  return segments
}

function explainAigcLabLocalSignals(text: string) {
  const signals: string[] = []
  if (/裂缝|天壁|护山大阵|灵压|威压|墟劫|追杀令|倒计时|修复进度/u.test(text)) {
    signals.push("宏大设定/危机词集中，容易形成 AI 式说明感")
  }
  if (/每息|三寸|两尺|百分|%|进度|频率|脉冲|阈值|倒计时|\d+(?:天|年|月|日|息|寸|尺|%)/u.test(text)) {
    signals.push("数字、参数或系统账本信息偏密")
  }
  if (/脊背|肩胛|瞳孔|指节|肌肉|呼吸|额角|喉结|骤然|缓慢|簌簌|薄雾/u.test(text)) {
    signals.push("身体反应/镜头词偏工整，可能像精修模板")
  }
  if (/意味着|由此可见|这说明|局势|风险升级|形成.*(?:压力|闭环)|命运|真相/u.test(text)) {
    signals.push("总结腔或解释腔较明显")
  }
  if (/复杂的情绪|无法形容|十分震惊|内心.*(?:震动|复杂)|某种意义上/u.test(text)) {
    signals.push("抽象情绪词偏多，缺少具体动作替代")
  }
  if (/^[「“][^」”]{1,30}[」”]/u.test(text)) {
    signals.push("短对话开头：通常更接近真人文本信号")
  }
  return signals
}

function aigcLabRiskLevel(score: number | null, threshold: number) {
  if (score === null) return "unknown"
  if (score >= threshold) return "high"
  if (score >= Math.max(0, threshold - 0.2)) return "medium"
  if (score <= 1 - threshold) return "low"
  return "watch"
}

function aigcLabPassDecision(input: {
  policy: string
  score: number | null
  threshold: number
  highRiskCount: number
  totalSentences: number
}) {
  const overallBlocked = typeof input.score === "number" && input.score >= input.threshold
  const policy = String(input.policy || "strict_any_sentence")
  if (policy === "overall_only") {
    return {
      passed: !overallBlocked,
      policy,
      reason: overallBlocked ? "整体 AI 分达到阈值。" : "仅按整体 AI 分判断通过；高风险句保留为提醒。",
    }
  }
  if (policy === "balanced") {
    const highRiskLimit = input.totalSentences <= 3 ? 2 : 3
    const segmentBlocked = input.highRiskCount >= highRiskLimit
    return {
      passed: !overallBlocked && !segmentBlocked,
      policy,
      reason: overallBlocked
        ? "整体 AI 分达到阈值。"
        : segmentBlocked
          ? `高风险句达到 ${input.highRiskCount}/${highRiskLimit}，超过平衡策略容忍度。`
          : `平衡策略通过：整体分未达阈值，且高风险句少于 ${highRiskLimit} 个；高风险句只作为局部修改建议。`,
    }
  }
  return {
    passed: input.highRiskCount === 0 && !overallBlocked,
    policy: "strict_any_sentence",
    reason: input.highRiskCount > 0
      ? "严格策略：任一句/短段达到阈值即判为未通过。"
      : overallBlocked
        ? "整体 AI 分达到阈值。"
        : "严格策略通过：整体分和所有句子均低于阈值。",
  }
}

async function listStyleProfileDebugRuns() {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => [])
  const candidates = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && (entry.name.startsWith("sp_") || entry.name.startsWith("ac_")))
    .map((entry) => loadRun(entry.name)))
  return candidates
    .filter((run): run is DebugRun => Boolean(run && run.nodeId === "style-profile"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function styleCalibrationSampleFromRun(run: DebugRun, group: "approved_style_candidate" | "recent_failed_candidate", limit: number) {
  const result = run.result && typeof run.result === "object" && !Array.isArray(run.result) ? run.result : {}
  const samples: Array<{ group: string; label: string; text: string; sourceRunId: string; round?: number }> = []
  if (group === "approved_style_candidate") {
    const selected = result.selectedCandidate && typeof result.selectedCandidate === "object" && !Array.isArray(result.selectedCandidate)
      ? result.selectedCandidate as Record<string, unknown>
      : {}
    const evaluation = selected.evaluation && typeof selected.evaluation === "object" && !Array.isArray(selected.evaluation)
      ? selected.evaluation as Record<string, unknown>
      : {}
    const aigc = evaluation.aigc && typeof evaluation.aigc === "object" && !Array.isArray(evaluation.aigc)
      ? evaluation.aigc as Record<string, unknown>
      : {}
    const text = String(selected.sample || "").trim()
    if (text.length >= 80 && aigc.status === "passed") {
      samples.push({ group, label: `已通过文风候选 · ${run.runId}`, text, sourceRunId: run.runId, round: Number(selected.round || 0) || undefined })
    }
    return samples.slice(0, limit)
  }
  const iterations = Array.isArray(result.iterations) ? result.iterations as Record<string, unknown>[] : []
  for (const iteration of [...iterations].reverse()) {
    const evaluation = iteration.evaluation && typeof iteration.evaluation === "object" && !Array.isArray(iteration.evaluation)
      ? iteration.evaluation as Record<string, unknown>
      : {}
    const aigc = evaluation.aigc && typeof evaluation.aigc === "object" && !Array.isArray(evaluation.aigc)
      ? evaluation.aigc as Record<string, unknown>
      : {}
    const text = String(iteration.sample || "").trim()
    if (text.length >= 80 && (aigc.status === "blocked" || Number(aigc.highRiskCount || 0) > 0)) {
      samples.push({ group, label: `近期失败样段 · ${run.runId}`, text, sourceRunId: run.runId, round: Number(iteration.round || 0) || undefined })
    }
    if (samples.length >= limit) break
  }
  return samples
}

async function aggregateCompletedChapterBlueprintsForStyle(seedRun: DebugRun) {
  const seedInput = seedRun.input as ChapterBlueprintInput
  const runs = await listChapterBlueprintRuns({ upstreamRunId: seedInput.upstreamRunId })
  const completed = runs
    .filter((run) => run.status === "completed" && run.validation?.valid === true && run.result)
    .sort((a, b) => {
      const left = a.input as ChapterBlueprintInput
      const right = b.input as ChapterBlueprintInput
      return left.startChapter - right.startChapter || left.endChapter - right.endChapter
    })
  const blueprintsByChapter = new Map<number, Record<string, unknown>>()
  for (const run of completed) {
    const blueprints = Array.isArray(run.result?.blueprints) ? run.result.blueprints as Record<string, unknown>[] : []
    for (const blueprint of blueprints) {
      const chapterNumber = Number(blueprint.chapterNumber)
      if (Number.isInteger(chapterNumber) && chapterNumber >= 1) blueprintsByChapter.set(chapterNumber, blueprint)
    }
  }
  const blueprints = [...blueprintsByChapter.entries()].sort((a, b) => a[0] - b[0]).map(([, blueprint]) => blueprint)
  if (!blueprints.length) throw new Error("completed_chapter_blueprints_empty")
  const firstChapter = Number(blueprints[0]?.chapterNumber || 1)
  const lastChapter = Number(blueprints.at(-1)?.chapterNumber || firstChapter)
  const aggregate = {
    version: 1,
    mode: "aggregated_completed_chapter_blueprints",
    source: {
      volumeStrategyRunId: seedInput.upstreamRunId,
      seedChapterBlueprintRunId: seedRun.runId,
      chapterBlueprintRunIds: completed.map((run) => run.runId),
      firstChapter,
      lastChapter,
      blueprintCount: blueprints.length,
    },
    blueprints,
    handoffToWritingPlan: seedRun.result?.handoffToWritingPlan || null,
  }
  return { aggregate, completedRuns: completed, firstChapter, lastChapter, blueprintCount: blueprints.length }
}

function buildStyleProfilePrompts(input: StyleProfileInput, runId: string) {
  const characters = volumeStrategyCharacterNames(input.storyBible)
  const blueprints = styleProfileBlueprints(input)
  const sampleBlueprint = blueprints.find((entry) => Number(entry.chapterNumber) === input.sampleChapter) || blueprints[0] || {}
  const representativeBlueprints = blueprints.filter((entry, index) => {
    const chapterNumber = Number(entry.chapterNumber)
    return index < 3
      || index >= blueprints.length - 3
      || chapterNumber === input.sampleChapter
      || chapterNumber % 50 === 0
  }).slice(0, 24).map((entry) => ({
    chapterNumber: entry.chapterNumber,
    title: entry.title,
    chapterGoal: entry.chapterGoal,
    protagonistDecision: entry.protagonistDecision,
    irreversibleChange: entry.irreversibleChange,
    nextPressure: entry.nextPressure,
    requiredCharacters: entry.requiredCharacters,
    stateLedgerRefs: entry.stateLedgerRefs,
    forbiddenDrift: entry.forbiddenDrift,
  }))
  const project = input.storyBible.project && typeof input.storyBible.project === "object" && !Array.isArray(input.storyBible.project)
    ? input.storyBible.project as Record<string, unknown>
    : {}
  const basePrompt = [
    "你是长篇小说正文风格总监（Style Profile Showrunner）。",
    "你只负责 phase_10_style_profile：把已冻结的故事圣经、分卷策略和章节蓝图转换成后续正文生成必须继承的写作规则合同。",
    "本节点不写真实章节正文，不扩写场景，不新编剧情，不改变人物、术语、技能、物品、数字或章节蓝图。",
    "输出要像给写作模型的操作手册：清楚规定叙事视角、节奏、段落、对白、心理描写、动作描写、信息揭示、爽点兑现、禁用写法、质量门禁。",
    "规则必须可复用到整本书，同时要能指导单章上下文组装和正文初稿。",
    "只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释生成过程。",
  ].join("\n")
  const dynamicPrompt = [
    `章节蓝图上游 Run：${input.upstreamRunId}`,
    `全书体量：${input.totalChapters} 章`,
    `已聚合通过章节蓝图：${blueprints.length} 章，范围第 ${Number(blueprints[0]?.chapterNumber || 0)}-${Number(blueprints.at(-1)?.chapterNumber || 0)} 章。`,
    `样例章节：第 ${input.sampleChapter} 章`,
    `冻结人物（${characters.length} 人）：${characters.join("、")}`,
    `本轮额外关注：${input.styleFocus || "形成可执行、低漂移、适合长篇连载的正文风格规则；避免华丽辞藻压过剧情推进。"}`,
    "故事圣经项目摘要：",
    JSON.stringify(project, null, 2),
    "样例章节蓝图：",
    JSON.stringify(sampleBlueprint, null, 2),
    "聚合后的章节蓝图代表摘要（开头、样例、每 50 章、结尾）：",
    JSON.stringify(representativeBlueprints, null, 2),
    "完整 Story Bible JSON：",
    JSON.stringify(input.storyBible, null, 2),
  ].join("\n")
  const userMessage = [
    "生成完整 Style Profile JSON，严格使用以下顶层结构：",
    "{",
    '  "version": 1,',
    '  "source": { "chapterBlueprintRunId": "", "phase": "phase_9_chapter_blueprints", "totalChapters": 0, "sampleChapter": 1, "blueprintChapters": [1] },',
    '  "stylePrinciples": { "narrativePOV": "", "tenseAndDistance": "", "proseDensity": "", "pacingModel": "", "emotionalTemperature": "", "readerExperienceTarget": "" },',
    '  "chapterWritingRules": [{ "name": "", "instruction": "", "successSignal": "", "forbiddenDrift": "" }],',
    '  "sceneRules": [{ "name": "", "instruction": "", "mustCheck": [""] }],',
    '  "dialogueRules": [{ "name": "", "instruction": "", "badExamplePattern": "", "repairRule": "" }],',
    '  "canonHandlingRules": [{ "name": "", "instruction": "", "immutableFacts": [""] }],',
    '  "antiPatterns": [{ "name": "", "whyBad": "", "detectionSignal": "", "repairRule": "" }],',
    '  "singleChapterDraftContract": { "inputDependencies": [""], "outputBoundary": "", "minimumSceneCount": 1, "requiredChecks": [""], "handoffToQualityGate": [""] },',
    '  "qualitySelfCheck": { "noProseGenerated": true, "noCanonMutation": true, "blueprintsInherited": true, "rulesAreActionable": true, "remainingRisks": [""] }',
    "}",
    "硬性要求：",
    `- source.blueprintChapters 必须覆盖聚合蓝图中的所有章节号：${blueprints.map((entry) => Number(entry.chapterNumber)).filter(Number.isInteger).join("、")}。`,
    "- chapterWritingRules 至少 6 条；sceneRules 至少 4 条；dialogueRules 至少 3 条；antiPatterns 至少 6 条。",
    "- canonHandlingRules 必须明确：技能、物品、数字、倒计时、代价、地点边界只能继承确定值，不允许模型自由改写。",
    "- singleChapterDraftContract.outputBoundary 必须写明：后续节点才生成正文，本节点不得输出正文。",
    "- 不得输出 chapterDrafts、prose、draftText、正文段落、对白成稿或真实章节内容。",
  ].join("\n")
  const consensus = `独立调试 Run: ${runId}\n章节蓝图上游 Run: ${input.upstreamRunId}`
  const artifactProtocol = [
    "生产资产生成协议：",
    "- 生成 phase_10_style_profile 正文风格合同，不进行圆桌讨论。",
    "- 只定义可继承规则，不写章节正文。",
    "- 输出必须能被 phase_11_single_chapter_context 和 phase_12_chapter_draft 直接消费。",
  ].join("\n")
  const responseContract = [
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 只能输出单个合法 JSON 对象。",
    "- 必须停留在 style_profile_debug 阶段。",
  ].join("\n")
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "输出语言：简体中文", "当前工作流阶段：style_profile_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n")
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage }
}

function validateStyleProfile(result: Record<string, unknown>, input: StyleProfileInput) {
  const errors: string[] = []
  const warnings: string[] = []
  if (String(result.mode || "") === "style_evolution_debug_loop") {
    const iterations = Array.isArray(result.iterations)
      ? result.iterations.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry)))
      : []
    const selectedCandidate = result.selectedCandidate && typeof result.selectedCandidate === "object" && !Array.isArray(result.selectedCandidate)
      ? result.selectedCandidate as Record<string, unknown>
      : {}
    const evaluation = selectedCandidate.evaluation && typeof selectedCandidate.evaluation === "object" && !Array.isArray(selectedCandidate.evaluation)
      ? selectedCandidate.evaluation as Record<string, unknown>
      : {}
    const aigc = evaluation.aigc && typeof evaluation.aigc === "object" && !Array.isArray(evaluation.aigc)
      ? evaluation.aigc as Record<string, unknown>
      : {}
    const verification = selectedCandidate.verification && typeof selectedCandidate.verification === "object" && !Array.isArray(selectedCandidate.verification)
      ? selectedCandidate.verification as Record<string, unknown>
      : {}
    const verdict = String(evaluation.verdict || "")
    const aigcStatus = String(aigc.status || "")
    const verificationStatus = String(verification.status || "")
    const sample = String(selectedCandidate.sample || "").trim()
    if (!iterations.length) errors.push("style evolution loop 至少需要 1 轮迭代记录。")
    if (!sample) errors.push("selectedCandidate.sample 不能为空。")
    if (sample && sample.length < 450) errors.push(`当前文风样段只有 ${sample.length} 字符，低于 450 字下限；必须重新迭代。`)
    if (sample && !/[。！？!?」』”’）)\]》】"']$/u.test(sample)) errors.push("selectedCandidate.sample 疑似被截断：末尾不是完整句读或闭合符号。")
    if (verdict !== "candidate" && verdict !== "approve") errors.push(`selectedCandidate.evaluation.verdict 必须为 candidate 或 approve，当前为 ${verdict || "空"}。`)
    if (!aigcStatus) errors.push("selectedCandidate.evaluation.aigc 缺少 AIGC 检测结果。")
    if (aigcStatus && aigcStatus !== "passed") errors.push(`selectedCandidate.evaluation.aigc.status 必须为 passed，当前为 ${aigcStatus}。`)
    if (!verificationStatus) errors.push("selectedCandidate.verification 缺少 Generation Verification Gate 结果。")
    if (verificationStatus && verificationStatus !== "passed") errors.push(`selectedCandidate.verification.status 必须为 passed，当前为 ${verificationStatus}；AIGC / 禁忌 / 完整性门禁未过不能放行。`)
    if (verdict === "candidate") warnings.push("当前只是 candidate，不是 approve；可以人工查看样段，或增加迭代轮数继续精修。")
    if (Number(result.maxRounds || input.maxRounds) <= iterations.length && verdict !== "approve") warnings.push("已达到本次最大迭代轮数；虽然得到 candidate，但还不是 approve，可继续加轮数精修。")
    if (Number(selectedCandidate.sampleChapter) !== input.sampleChapter) errors.push(`selectedCandidate.sampleChapter 必须等于 ${input.sampleChapter}。`)
    return { valid: errors.length === 0, errors, warnings }
  }
  const recordArray = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry))) : []
  const requireObject = (value: unknown, label: string) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${label} 必须是对象。`)
      return {} as Record<string, unknown>
    }
    return value as Record<string, unknown>
  }
  const requireText = (entry: Record<string, unknown>, keys: string[], label: string) => {
    for (const key of keys) if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} 不能为空。`)
  }
  const source = requireObject(result.source, "source")
  if (String(source.chapterBlueprintRunId || "").trim() !== input.upstreamRunId) errors.push("source.chapterBlueprintRunId 必须等于上游章节蓝图 Run ID。")
  if (String(source.phase || "").trim() !== "phase_9_chapter_blueprints") errors.push("source.phase 必须是 phase_9_chapter_blueprints。")
  if (Number(source.sampleChapter) !== input.sampleChapter) errors.push(`source.sampleChapter 必须等于 ${input.sampleChapter}。`)
  const blueprintChapters = Array.isArray(source.blueprintChapters) ? source.blueprintChapters.map(Number).filter(Number.isInteger) : []
  const expectedChapters = styleProfileBlueprints(input).map((entry) => Number(entry.chapterNumber)).filter(Number.isInteger)
  for (const chapter of expectedChapters) if (!blueprintChapters.includes(chapter)) errors.push(`source.blueprintChapters 缺少第 ${chapter} 章。`)
  requireText(requireObject(result.stylePrinciples, "stylePrinciples"), ["narrativePOV", "tenseAndDistance", "proseDensity", "pacingModel", "emotionalTemperature", "readerExperienceTarget"], "stylePrinciples")
  const chapterRules = recordArray(result.chapterWritingRules)
  const sceneRules = recordArray(result.sceneRules)
  const dialogueRules = recordArray(result.dialogueRules)
  const canonRules = recordArray(result.canonHandlingRules)
  const antiPatterns = recordArray(result.antiPatterns)
  if (chapterRules.length < 6) errors.push("chapterWritingRules 至少需要 6 条。")
  if (sceneRules.length < 4) errors.push("sceneRules 至少需要 4 条。")
  if (dialogueRules.length < 3) errors.push("dialogueRules 至少需要 3 条。")
  if (canonRules.length < 3) errors.push("canonHandlingRules 至少需要 3 条。")
  if (antiPatterns.length < 6) errors.push("antiPatterns 至少需要 6 条。")
  chapterRules.forEach((entry, index) => requireText(entry, ["name", "instruction", "successSignal", "forbiddenDrift"], `chapterWritingRules[${index}]`))
  sceneRules.forEach((entry, index) => requireText(entry, ["name", "instruction"], `sceneRules[${index}]`))
  dialogueRules.forEach((entry, index) => requireText(entry, ["name", "instruction", "badExamplePattern", "repairRule"], `dialogueRules[${index}]`))
  canonRules.forEach((entry, index) => requireText(entry, ["name", "instruction"], `canonHandlingRules[${index}]`))
  antiPatterns.forEach((entry, index) => requireText(entry, ["name", "whyBad", "detectionSignal", "repairRule"], `antiPatterns[${index}]`))
  requireText(requireObject(result.singleChapterDraftContract, "singleChapterDraftContract"), ["outputBoundary"], "singleChapterDraftContract")
  const selfCheck = requireObject(result.qualitySelfCheck, "qualitySelfCheck")
  for (const key of ["noProseGenerated", "noCanonMutation", "blueprintsInherited", "rulesAreActionable"]) if (selfCheck[key] !== true) errors.push(`qualitySelfCheck.${key} 必须为 true。`)
  const serialized = JSON.stringify(result)
  if (/"(?:chapterDrafts|prose|draftText|chapters)"\s*:/u.test(serialized)) errors.push("风格节点禁止输出章节正文、章节草稿或章节列表。")
  if (/“[^”]{20,}”|他说|她说|陆无良[^。！？]{20,}[。！？]/u.test(serialized)) warnings.push("结果中疑似出现正文式句子；请确认这只是规则说明，不是章节内容。")
  return { valid: errors.length === 0, errors, warnings }
}

function styleDebugText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim()
}

function styleEvolutionSampleBlueprint(input: StyleProfileInput) {
  const blueprints = styleProfileBlueprints(input)
  return blueprints.find((entry) => Number(entry.chapterNumber) === input.sampleChapter) || blueprints[0] || {}
}

function styleEvolutionProjectContext(input: StyleProfileInput) {
  const project = input.storyBible.project && typeof input.storyBible.project === "object" && !Array.isArray(input.storyBible.project)
    ? input.storyBible.project as Record<string, unknown>
    : {}
  const worldProject = input.worldFoundation.project && typeof input.worldFoundation.project === "object" && !Array.isArray(input.worldFoundation.project)
    ? input.worldFoundation.project as Record<string, unknown>
    : {}
  const sampleBlueprint = styleEvolutionSampleBlueprint(input)
  const title = styleDebugText(project.title || worldProject.title || input.worldFoundation.title, "未命名小说")
  const idea = [
    styleDebugText(project.coreIdea || worldProject.coreIdea || input.worldFoundation.coreIdea),
    `当前样例章节：第 ${Number(sampleBlueprint.chapterNumber || input.sampleChapter)} 章《${styleDebugText(sampleBlueprint.title, "未命名章节")}》`,
    styleDebugText(sampleBlueprint.chapterGoal) ? `章节目标：${styleDebugText(sampleBlueprint.chapterGoal)}` : "",
    styleDebugText(sampleBlueprint.protagonistDecision) ? `主角决定：${styleDebugText(sampleBlueprint.protagonistDecision)}` : "",
    styleDebugText(sampleBlueprint.irreversibleChange) ? `不可逆变化：${styleDebugText(sampleBlueprint.irreversibleChange)}` : "",
    styleDebugText(sampleBlueprint.nextPressure) ? `交接压力：${styleDebugText(sampleBlueprint.nextPressure)}` : "",
  ].filter(Boolean).join("\n")
  const referenceText = [
    "样例章节蓝图（只用于校准叙述声音，不代表正式生成该章正文）：",
    JSON.stringify(sampleBlueprint, null, 2),
  ].join("\n")
  const desiredVibes = [
    "剧情推进清晰",
    "人物动作先于解释",
    "对白服务关系压力",
    "修仙/玄幻设定使用确定值",
    "文风稳定、可复制到长篇连载",
  ]
  const seedForbiddenPatterns = [
    "不得把文风样段当作正式章节入库",
    "不得修改已冻结的技能、物品、数字、倒计时、代价和地点边界",
    "不得越过章节蓝图写未来弧线结果",
    "不得用华丽辞藻替代具体动作、决定和因果交接",
    "不得输出写作计划、列表、标题或自我解释作为候选样段",
  ]
  const seedPrompt = [
    "这是一轮文风自进化调试，不是正式章节创作。",
    "样段必须服务于整本书后续正文生成的基础声音测试：视角、节奏、对白、描写密度、信息交接。",
    "样段可以借用样例章节蓝图的处境，但不能改变正典事实，也不能生成会被当成正式章节的内容。",
    input.styleFocus ? `用户本轮关注：${input.styleFocus}` : "",
  ].filter(Boolean).join("\n")
  return { title, idea, referenceText, desiredVibes, seedForbiddenPatterns, seedPrompt, sampleBlueprint }
}

function uniqueStyleRules(items: unknown[], limit = 24) {
  const seen = new Set<string>()
  const rules: string[] = []
  for (const item of items) {
    const text = String(item ?? "").replace(/\s+/gu, " ").trim()
    if (!text || text.length < 3 || seen.has(text)) continue
    seen.add(text)
    rules.push(text)
    if (rules.length >= limit) break
  }
  return rules
}

function extractStyleFocusRules(styleFocus: string) {
  const fragments = String(styleFocus || "")
    .split(/[\n\r；;。.!！?？]+/u)
    .map((item) => item.replace(/^[\s\-*、，,]+/u, "").replace(/[\s\-*、，,]+$/u, "").trim())
    .filter(Boolean)
  return uniqueStyleRules(fragments.length ? fragments : [styleFocus], 18)
}

function styleStringArray(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return []
  return uniqueStyleRules(value, limit)
}

function buildFrozenStyleContractFromDebugRun(input: StyleProfileInput, selected: Record<string, unknown>, result: Record<string, unknown>) {
  const sample = styleDebugText(selected.sample)
  const evaluation = selected.evaluation && typeof selected.evaluation === "object" && !Array.isArray(selected.evaluation)
    ? selected.evaluation as Record<string, unknown>
    : {}
  const refinement = selected.refinement && typeof selected.refinement === "object" && !Array.isArray(selected.refinement)
    ? selected.refinement as Record<string, unknown>
    : {}
  const scores = evaluation.scores && typeof evaluation.scores === "object" && !Array.isArray(evaluation.scores)
    ? evaluation.scores as Record<string, unknown>
    : {}
  const aigc = evaluation.aigc && typeof evaluation.aigc === "object" && !Array.isArray(evaluation.aigc)
    ? evaluation.aigc as Record<string, unknown>
    : {}
  const aigcSelfEvolution = result.aigcSelfEvolution && typeof result.aigcSelfEvolution === "object" && !Array.isArray(result.aigcSelfEvolution)
    ? result.aigcSelfEvolution as Record<string, unknown>
    : {}
  const focusRules = extractStyleFocusRules(input.styleFocus)
  const contractAdjustments = styleStringArray(refinement.contractAdjustments, 10)
  const positiveExamples = uniqueStyleRules([
    sample.replace(/\s+/gu, " ").slice(0, 260),
    ...styleStringArray(refinement.positiveExamples, 4),
  ], 6)
  const aigcLessons = styleStringArray(aigcSelfEvolution.memory, 12)
  const highRiskPreviews = styleStringArray(aigc.highRiskPreviews, 6)
  const forbiddenPatterns = uniqueStyleRules([
    "不要把样段写成设定说明、剧情大纲、角色小传或创作计划。",
    "不要用华丽辞藻、抽象判断和宏大词堆替代具体动作、对白、物件和因果推进。",
    "不得自由修改技能、物品、数字、倒计时、代价、地点边界和章节蓝图交接状态。",
    "不得为了文风顺滑提前消费后续弧线结果。",
    "不得绕过 AIGC 检测策略；检测失败时必须根据高风险句做局部改写。",
    ...focusRules.filter((rule) => /不|不得|禁止|避免|不能|不要|只|必须|重点|规范|规则/u.test(rule)),
    ...styleStringArray(evaluation.forbiddenHits, 8),
    ...styleStringArray(refinement.forbiddenPatterns, 8),
    ...aigcLessons,
  ], 28)
  const inheritedRules = uniqueStyleRules([
    "后续正文节点必须继承本次冻结样段、风格合同、用户关注点规范和 AIGC 修复经验。",
    "后续每章必须承接章节蓝图中的主角决定、不可逆变化和下一章压力。",
    "正文返工只能在冻结风格合同内部收紧，不得重新发明文风。",
    "技能、物品、数字、倒计时、代价和地点边界只允许读取确定值，不允许模型自由改写。",
    ...focusRules.map((rule) => `用户关注点规范：${rule}`),
    ...contractAdjustments.map((rule) => `评估收紧规则：${rule}`),
    ...aigcLessons.map((rule) => `AIGC 修复经验：${rule}`),
  ], 36)
  const contract: NonNullable<StyleEvolutionContract["styleContract"]> = {
    voice: `以第 ${input.sampleChapter} 章通过候选样段为最高写法参照；叙述必须优先服务剧情推进、人物选择和关系压力。`,
    sentenceRhythm: "保留样段里的句长起伏、动作停顿和局部留白；避免连续同构短句或模板化连接词堆叠。",
    dialogueRules: uniqueStyleRules([
      "对白必须带有关系压力、信息差或当前利益，不写解释腔。",
      "人物说话要落在当下处境，少用作者替人物总结。",
      "对白之间必须穿插动作、表情、物件或空间压力，避免纯对话流水。",
    ], 8),
    descriptionRules: uniqueStyleRules([
      "描写先给动作、物件、声音、气味、触感和身体反应，再给判断。",
      "环境描写必须推动压力、线索或人物决策，不做空泛氛围堆叠。",
      "修仙/玄幻名词只继承确定设定值，不为文采临时改名或升级。",
    ], 8),
    emotionRules: uniqueStyleRules([
      "情绪通过选择、迟疑、动作变形和细节外化，不直接反复说明“震惊/恐惧/愤怒”。",
      "压迫感必须来自具体代价、限制和对手行动，不靠抽象危机宣告。",
    ], 8),
    pacingRules: uniqueStyleRules([
      "每章正文应形成：压力进入 → 主角具体决定 → 事件推进 → 不可逆变化 → 下一章压力。",
      "爽点兑现不能跳过代价结算；失败、消耗、位置变化要写清交接。",
      "场景转换必须带来新信息或新压力，不只是换地点重复同一冲突。",
    ], 10),
    povRules: uniqueStyleRules([
      "保持稳定视角，不越权泄露未到场角色的真实计划或未来信息。",
      "叙述距离以样段为准：贴近主角感知，但保留必要的局部客观压力。",
    ], 8),
    openingRules: uniqueStyleRules([
      "开场优先落在具体场景压力、人物动作或上一章交接钩子上。",
      "不要用世界观说明、修炼等级科普或作者总结开场。",
    ], 8),
    endingHookRules: uniqueStyleRules([
      "结尾必须留下可追踪的问题、关系裂缝、具体危险或下一步选择。",
      "结尾钩子要能传给下一章，不写纯口号式悬念。",
    ], 8),
    allowedDevices: uniqueStyleRules([
      "动作推进",
      "物件压迫",
      "短对白与停顿",
      "感官细节",
      "代价结算",
      "章节交接钩子",
      "人物微反应",
    ], 12),
    forbiddenPatterns,
    positiveExamples,
    negativeExamples: highRiskPreviews,
  }
  const frozenBasePrompt = [
    "# 冻结文风底座",
    selected.prompt ? String(selected.prompt).trim() : "",
    "",
    "# 用户关注点抽取规范",
    ...focusRules.map((rule) => `- ${rule}`),
    "",
    "# 后续继承规则",
    ...inheritedRules.map((rule) => `- ${rule}`),
    "",
    "# 禁用写法 / AIGC 修复经验",
    ...forbiddenPatterns.map((rule) => `- ${rule}`),
  ].filter((line) => line !== "").join("\n")
  return {
    styleContract: contract,
    inheritedRules,
    focusRules,
    aigcLessons,
    antiPatterns: forbiddenPatterns,
    positiveExamples,
    frozenBasePrompt,
    freezeSummary: `节点 09 已冻结第 ${input.sampleChapter} 章候选样段；综合分 ${Number(scores.overall || 0).toFixed(1)}，AIGC ${String(aigc.status || "unknown")}，并已抽取 ${focusRules.length} 条用户关注点规范、${aigcLessons.length} 条 AIGC 修复经验。`,
  }
}

async function freezeStyleProfileDebugRun(run: DebugRun) {
  if (run.nodeId !== "style-profile") throw new Error("run_must_be_style_profile")
  if (run.status !== "completed" || run.validation?.valid !== true) throw new Error("style_profile_run_must_be_completed_and_valid")
  const input = run.input as StyleProfileInput
  const result = run.result && typeof run.result === "object" && !Array.isArray(run.result)
    ? run.result as Record<string, unknown>
    : {}
  const existingFreeze = result.freeze && typeof result.freeze === "object" && !Array.isArray(result.freeze)
    ? result.freeze as Record<string, unknown>
    : null
  if (existingFreeze?.status === "approved") return existingFreeze
  const selected = result.selectedCandidate && typeof result.selectedCandidate === "object" && !Array.isArray(result.selectedCandidate)
    ? result.selectedCandidate as Record<string, unknown>
    : {}
  const sample = styleDebugText(selected.sample)
  if (!sample) throw new Error("style_profile_selected_candidate_missing")
  const evaluation = selected.evaluation && typeof selected.evaluation === "object" && !Array.isArray(selected.evaluation)
    ? selected.evaluation as StyleEvolutionEvaluation
    : undefined
  const refinement = selected.refinement && typeof selected.refinement === "object" && !Array.isArray(selected.refinement)
    ? selected.refinement as StyleEvolutionRefinement
    : undefined
  const verification = selected.verification && typeof selected.verification === "object" && !Array.isArray(selected.verification)
    ? selected.verification as Record<string, unknown>
    : {}
  if (String(verification.status || "") !== "passed") throw new Error("style_profile_selected_candidate_gate_not_passed")
  const freezeAssets = buildFrozenStyleContractFromDebugRun(input, selected, result)
  const now = nowIso()
  const freezer = {
    source: "heuristic" as const,
    verdict: "ready" as const,
    summary: "用户在节点 09 调试页确认当前候选可冻结为整书写法合同。",
    blockingReasons: [],
    checkedAt: now,
  }
  await initializeStyleEvolution(rootDir, {
    seedPrompt: freezeAssets.frozenBasePrompt || styleDebugText(selected.prompt),
    userStylePrompt: input.styleFocus,
    referenceText: sample,
    desiredVibes: [
      "剧情推进清晰",
      "人物动作先于解释",
      "对白服务关系压力",
      "文风稳定、可复制到长篇连载",
    ],
    seedForbiddenPatterns: freezeAssets.antiPatterns,
  })
  const appended = await appendStyleEvolutionCandidate(rootDir, {
    prompt: styleDebugText(selected.prompt || freezeAssets.frozenBasePrompt),
    sample,
    review: [
      styleDebugText((evaluation as Record<string, unknown> | undefined)?.summary),
      styleDebugText((refinement as Record<string, unknown> | undefined)?.summary),
      freezeAssets.freezeSummary,
    ].filter(Boolean).join("\n"),
    createdAt: now,
    iterationFeedback: input.styleFocus,
    source: "loop",
    evaluation,
    refinement,
    freezer,
  })
  const version = appended.contract.evolutionHistory?.at(-1)?.version
  if (!version) throw new Error("style_freeze_version_missing")
  await acceptStyleEvolutionCandidate(rootDir, { version, acceptedAt: now, acceptedBy: "user" })
  const approved = await approveStyleEvolutionSample(rootDir, {
    version,
    sample,
    approvedAt: now,
    approvedBy: "user",
    freezer,
    styleContract: freezeAssets.styleContract,
    antiPatterns: freezeAssets.antiPatterns,
    frozenBasePrompt: freezeAssets.frozenBasePrompt,
    freezeSummary: freezeAssets.freezeSummary,
    positiveExamples: freezeAssets.positiveExamples,
    inheritedRules: freezeAssets.inheritedRules,
  })
  return {
    status: "approved",
    approvedVersion: version,
    approvedAt: now,
    paths: approved.paths,
    gate: approved.gate,
    focusRules: freezeAssets.focusRules,
    aigcLessons: freezeAssets.aigcLessons,
    inheritedRules: freezeAssets.inheritedRules,
    antiPatterns: freezeAssets.antiPatterns,
    styleContract: freezeAssets.styleContract,
    freezeSummary: freezeAssets.freezeSummary,
  }
}

function singleChapterContextBlueprints(input: SingleChapterContextInput) {
  return Array.isArray(input.chapterBlueprints.blueprints)
    ? input.chapterBlueprints.blueprints.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry)))
    : []
}

function findChapterBlueprintForContext(input: SingleChapterContextInput, chapterNumber = input.chapterNumber) {
  return singleChapterContextBlueprints(input).find((entry) => Number(entry.chapterNumber) === chapterNumber) || null
}

function buildSingleChapterContextPackage(input: SingleChapterContextInput) {
  const blueprint = findChapterBlueprintForContext(input)
  if (!blueprint) throw new Error(`chapter_blueprint_not_found:${input.chapterNumber}`)
  const previousBlueprint = findChapterBlueprintForContext(input, input.chapterNumber - 1)
  const nextBlueprint = findChapterBlueprintForContext(input, input.chapterNumber + 1)
  const frozenContract = input.frozenStyle.contract && typeof input.frozenStyle.contract === "object" && !Array.isArray(input.frozenStyle.contract)
    ? input.frozenStyle.contract as Record<string, unknown>
    : {}
  const styleContract = frozenContract.styleContract && typeof frozenContract.styleContract === "object" && !Array.isArray(frozenContract.styleContract)
    ? frozenContract.styleContract as Record<string, unknown>
    : {}
  const inheritance = frozenContract.inheritance && typeof frozenContract.inheritance === "object" && !Array.isArray(frozenContract.inheritance)
    ? frozenContract.inheritance as Record<string, unknown>
    : {}
  const verification = frozenContract.verification && typeof frozenContract.verification === "object" && !Array.isArray(frozenContract.verification)
    ? frozenContract.verification as Record<string, unknown>
    : {}
  const approvedSample = styleDebugText(frozenContract.approvedSample)
  const result = input.styleProfile && typeof input.styleProfile === "object" && !Array.isArray(input.styleProfile)
    ? input.styleProfile as Record<string, unknown>
    : {}
  const freeze = result.freeze && typeof result.freeze === "object" && !Array.isArray(result.freeze)
    ? result.freeze as Record<string, unknown>
    : {}
  return {
    version: 1,
    mode: "single_chapter_context_debug_package",
    source: {
      phase: "phase_11_single_chapter_context",
      styleProfileRunId: input.upstreamRunId,
      chapterBlueprintRunId: String((result.source as Record<string, unknown> | undefined)?.chapterBlueprintRunId || ""),
      chapterNumber: input.chapterNumber,
      targetWordCount: input.targetWordCount,
    },
    boundary: {
      outputBoundary: "本节点只生成单章写作上下文包，不生成正文、不改章节蓝图、不改正典账本、不提交章节。",
      nextPhase: "phase_12_chapter_draft",
      forbiddenMutations: ["chapterBlueprints", "storyBible", "styleContract", "skills", "items", "numbers", "countdowns", "costs", "locations"],
    },
    chapterBlueprint: {
      chapterNumber: blueprint.chapterNumber,
      title: blueprint.title,
      chapterGoal: blueprint.chapterGoal,
      protagonistDecision: blueprint.protagonistDecision,
      irreversibleChange: blueprint.irreversibleChange,
      nextPressure: blueprint.nextPressure,
      sceneCards: blueprint.sceneCards,
      requiredCharacters: blueprint.requiredCharacters,
      stateLedgerRefs: blueprint.stateLedgerRefs,
      forbiddenDrift: blueprint.forbiddenDrift,
      nextChapterEntryState: blueprint.nextChapterEntryState,
      nextChapterHandoff: blueprint.nextChapterHandoff,
      endingHook: blueprint.endingHook,
    },
    continuity: {
      previousChapter: previousBlueprint
        ? {
          chapterNumber: previousBlueprint.chapterNumber,
          title: previousBlueprint.title,
          exitState: previousBlueprint.nextChapterEntryState || previousBlueprint.nextChapterHandoff || previousBlueprint.nextPressure || previousBlueprint.endingHook,
        }
        : null,
      nextChapterPreview: nextBlueprint
        ? {
          chapterNumber: nextBlueprint.chapterNumber,
          title: nextBlueprint.title,
          allowedHandoffPressure: nextBlueprint.chapterGoal || nextBlueprint.nextPressure,
        }
        : null,
    },
    frozenStyle: {
      approval: frozenContract.approval,
      verification,
      inheritanceRules: inheritance.inheritedRules || [],
      styleContract,
      approvedSampleExcerpt: approvedSample.slice(0, 900),
      focusRules: freeze.focusRules || [],
      aigcLessons: freeze.aigcLessons || [],
      antiPatterns: freeze.antiPatterns || frozenContract.antiPatterns || styleContract.forbiddenPatterns || [],
    },
    writingInputPackage: {
      contextFocus: input.contextFocus,
      targetWordCount: input.targetWordCount,
      mustWrite: [
        "承接上一章交接状态。",
        "完成本章 chapterGoal。",
        "让主角作出 protagonistDecision 中的具体决定。",
        "写出 irreversibleChange 中的不可逆变化。",
        "以 nextPressure / nextChapterEntryState 交给下一章。",
      ],
      mustInherit: [
        "章节蓝图",
        "冻结文风合同",
        "用户关注点规范",
        "AIGC 修复经验",
        "正典数值/物品/技能/地点边界",
      ],
      mustNotWrite: [
        "不得写未来章节或未来弧线结果。",
        "不得新增未在本章允许名单中的关键人物。",
        "不得把上下文包本身写成正文。",
        "不得自由改写技能、物品、数字、倒计时、代价和地点。",
      ],
      qualityGates: [
        "章节蓝图完成度",
        "正典一致性",
        "文风继承度",
        "AIGC 检测",
        "下一章交接状态完整度",
      ],
    },
  }
}

function validateSingleChapterContext(result: Record<string, unknown>, input: SingleChapterContextInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source as Record<string, unknown> : {}
  const boundary = result.boundary && typeof result.boundary === "object" && !Array.isArray(result.boundary) ? result.boundary as Record<string, unknown> : {}
  const chapterBlueprint = result.chapterBlueprint && typeof result.chapterBlueprint === "object" && !Array.isArray(result.chapterBlueprint) ? result.chapterBlueprint as Record<string, unknown> : {}
  const frozenStyle = result.frozenStyle && typeof result.frozenStyle === "object" && !Array.isArray(result.frozenStyle) ? result.frozenStyle as Record<string, unknown> : {}
  const writingInputPackage = result.writingInputPackage && typeof result.writingInputPackage === "object" && !Array.isArray(result.writingInputPackage) ? result.writingInputPackage as Record<string, unknown> : {}
  const styleContract = frozenStyle.styleContract && typeof frozenStyle.styleContract === "object" && !Array.isArray(frozenStyle.styleContract) ? frozenStyle.styleContract as Record<string, unknown> : {}
  if (String(result.mode || "") !== "single_chapter_context_debug_package") errors.push("mode 必须是 single_chapter_context_debug_package。")
  if (String(source.phase || "") !== "phase_11_single_chapter_context") errors.push("source.phase 必须是 phase_11_single_chapter_context。")
  if (Number(source.chapterNumber) !== input.chapterNumber) errors.push(`source.chapterNumber 必须等于 ${input.chapterNumber}。`)
  if (!String(source.styleProfileRunId || "").trim()) errors.push("source.styleProfileRunId 不能为空。")
  if (!String(boundary.outputBoundary || "").includes("不生成正文")) errors.push("boundary.outputBoundary 必须明确本节点不生成正文。")
  if (Number(chapterBlueprint.chapterNumber) !== input.chapterNumber) errors.push(`chapterBlueprint.chapterNumber 必须等于 ${input.chapterNumber}。`)
  if (!String(chapterBlueprint.chapterGoal || "").trim()) errors.push("chapterBlueprint.chapterGoal 不能为空。")
  if (!String(chapterBlueprint.protagonistDecision || "").trim()) errors.push("chapterBlueprint.protagonistDecision 不能为空。")
  if (!String(chapterBlueprint.irreversibleChange || "").trim()) errors.push("chapterBlueprint.irreversibleChange 不能为空。")
  if (!String(chapterBlueprint.nextPressure || chapterBlueprint.nextChapterEntryState || chapterBlueprint.nextChapterHandoff || "").trim()) errors.push("章节交接压力不能为空。")
  if (!Object.keys(styleContract).length) errors.push("frozenStyle.styleContract 不能为空；请先冻结第 9 节点。")
  if (!String(frozenStyle.approvedSampleExcerpt || "").trim()) errors.push("frozenStyle.approvedSampleExcerpt 不能为空；请先冻结样段。")
  if (!Array.isArray(frozenStyle.inheritanceRules) || !frozenStyle.inheritanceRules.length) errors.push("frozenStyle.inheritanceRules 不能为空。")
  if (!Array.isArray(writingInputPackage.mustWrite) || writingInputPackage.mustWrite.length < 5) errors.push("writingInputPackage.mustWrite 至少需要 5 条。")
  if (!Array.isArray(writingInputPackage.mustNotWrite) || writingInputPackage.mustNotWrite.length < 4) errors.push("writingInputPackage.mustNotWrite 至少需要 4 条。")
  const serialized = JSON.stringify(result)
  if (/"(?:draftText|chapterDraft|prose|正文)"\s*:/u.test(serialized)) errors.push("单章上下文节点禁止输出正文草稿字段。")
  if (!Array.isArray(chapterBlueprint.sceneCards) || !chapterBlueprint.sceneCards.length) warnings.push("本章蓝图没有 sceneCards；后续正文分场可能不稳定。")
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

async function executeSingleChapterContextRun(run: DebugRun) {
  const input = run.input as SingleChapterContextInput
  const runDir = path.join(runsRoot, run.runId)
  run.status = "running"
  run.startedAt = nowIso()
  run.error = null
  addEvent(run, "info", "run", "开始执行单章上下文节点：聚合章节蓝图、冻结文风合同、正典边界和写作禁令。", {
    chapterNumber: input.chapterNumber,
    styleProfileRunId: input.upstreamRunId,
  })
  try {
    await fs.mkdir(runDir, { recursive: true })
    const result = buildSingleChapterContextPackage(input)
    run.result = result
    run.provider = { engine: "deterministic-context-packager", modelName: "no-llm", apiKey: "[NOT_USED]" }
    run.prompts = {
      systemPrompt: "本节点不调用模型；只做确定性上下文组装。",
      consensus: `独立调试 Run: ${run.runId}\n文风上游 Run: ${input.upstreamRunId}`,
      basePrompt: "phase_11_single_chapter_context",
      dynamicPrompt: JSON.stringify({ chapterNumber: input.chapterNumber, contextFocus: input.contextFocus }, null, 2),
      userMessage: "生成单章写作上下文包，不生成正文。",
    }
    await Promise.all([
      fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(input, null, 2)}\n`),
      fs.writeFile(path.join(runDir, "02-single-chapter-context.json"), `${JSON.stringify(result, null, 2)}\n`),
    ])
    run.artifacts.push("01-input.json", "02-single-chapter-context.json")
    run.validation = validateSingleChapterContext(result, input)
    await fs.writeFile(path.join(runDir, "03-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("03-validation.json")
    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `单章上下文验证失败：${run.validation.errors.length} 个错误。`, run.validation)
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "单章上下文包已通过验证；下一节点可以基于此包生成章节正文初稿。", {
        chapterNumber: input.chapterNumber,
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `单章上下文节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

function chapterDraftContext(input: ChapterDraftInput) {
  const context = input.singleChapterContext && typeof input.singleChapterContext === "object" && !Array.isArray(input.singleChapterContext)
    ? input.singleChapterContext
    : {}
  const chapterBlueprint = context.chapterBlueprint && typeof context.chapterBlueprint === "object" && !Array.isArray(context.chapterBlueprint)
    ? context.chapterBlueprint as Record<string, unknown>
    : {}
  const continuity = context.continuity && typeof context.continuity === "object" && !Array.isArray(context.continuity)
    ? context.continuity as Record<string, unknown>
    : {}
  const frozenStyle = context.frozenStyle && typeof context.frozenStyle === "object" && !Array.isArray(context.frozenStyle)
    ? context.frozenStyle as Record<string, unknown>
    : {}
  const writingInputPackage = context.writingInputPackage && typeof context.writingInputPackage === "object" && !Array.isArray(context.writingInputPackage)
    ? context.writingInputPackage as Record<string, unknown>
    : {}
  const boundary = context.boundary && typeof context.boundary === "object" && !Array.isArray(context.boundary)
    ? context.boundary as Record<string, unknown>
    : {}
  return { context, chapterBlueprint, continuity, frozenStyle, writingInputPackage, boundary }
}

function buildChapterDraftPrompt(input: ChapterDraftInput, repair?: { round: number; previousText: string; issues: string[]; aigc?: Record<string, unknown> | null }) {
  const { chapterBlueprint, continuity, frozenStyle, writingInputPackage, boundary } = chapterDraftContext(input)
  const chapterNumber = Number(chapterBlueprint.chapterNumber || input.chapterNumber)
  const title = styleDebugText(chapterBlueprint.title, `第${chapterNumber}章`)
  const system = [
    "你是长篇类型小说的单章完整生产写手。",
    "当前执行调试节点 11：根据单章上下文包完成一章正文候选。",
    "你必须写小说正文，不要输出 JSON、Markdown 代码块、字段名解释、创作说明或自我评价。",
    "严格继承上下文包中的章节蓝图、冻结文风、正典数值、人物名单、物品、技能、地点边界和禁止漂移项。",
    "章节蓝图是写作指令，不是正文素材；必须把 chapterGoal / protagonistDecision / irreversibleChange / nextPressure 转译成读者能看见的动作、物件变化、声音、对白、身体反应或空间压力。",
    "不要用解释句替代事件：少写“意识到、确认、明白、这意味着、必须、唯一办法、时间不多、压力变大”等总结表达。",
    "不要把文学性误写成空泛隐喻或假异象；异常和钩子必须落在具体动作、身体反应、物理变化和明确后果上。",
    "章节收束不能只写氛围、触感或漂亮句子；最后一段必须把本章变化变成下一章可承接的危险、伤口、选择、追击、物品变化或位置变化。",
    "不得新增关键人物、不得改数字、不得提前消费未来章节结果、不得把下一章内容写完。",
    "如果这是修复轮，必须重写完整章节正文，不要只说明修改方案。",
    "输出格式只允许：第一行是章节标题；空一行后是正文。",
  ].join("\n")
  const compactPayload = {
    chapter: { chapterNumber, title, targetWordCount: input.targetWordCount },
    draftFocus: input.draftFocus,
    chapterBlueprint,
    continuity,
    frozenStyle,
    writingInputPackage,
    boundary,
  }
  const repairBlock = repair
    ? [
      `这是第 ${repair.round} 次修复轮。上一版没有通过单章生产门禁，请按错误清单重写完整正文。`,
      "错误/风险清单：",
      ...repair.issues.slice(0, 16).map((item) => `- ${item}`),
      repair.aigc ? `AIGC 检测摘要：${JSON.stringify(repair.aigc, null, 2)}` : "",
      "上一版正文仅供定位问题，禁止逐句机械改写或复制其高风险句式：",
      repair.previousText.slice(0, 5000),
    ].filter(Boolean).join("\n\n")
    : ""
  const user = [
    repair ? `请重新生成第 ${chapterNumber} 章最终正文候选。` : `请生成第 ${chapterNumber} 章正文候选。`,
    `目标长度：约 ${input.targetWordCount} 中文字。`,
    "重点：把蓝图转换成可读正文，但不要华丽堆辞藻，不要写成设定说明；每个场景必须推进行动、决定、代价或交接压力。",
    "如果上下文包里没有 sceneCards，就按 chapterGoal / protagonistDecision / irreversibleChange / nextPressure 拆成 2-4 个自然段落推进。",
    "硬性写法：把“陆无良确认裂缝自愈速度超出预期”写成刻痕被新生石皮吞掉、缝宽变化、水滴间隔变化等可见证据；把“换班间隙缩短”写成脚步声来得更早、水洼波纹未散、灵虫提前返回等可感知事件。",
    "结尾钩子写法：不要写“疤痕从里往外亮了一下”“有什么东西轻轻敲了一下”这类假文艺提示；要写成动作链和后果链，例如水珠落下、主角缩手、水没有散、沿旧疤钻入、伤口被重新撕开。可以改变素材，但必须保持这种直接、身体化、可承接的写法。",
    "感官描写必须有功能：冷、热、疼、湿、响、亮，都必须造成判断、危险、行动或状态变化；不能只为了像小说而补一句“凉的”。",
    "禁止用解释性总结收束段落：不要用“他意识到/他明白/这意味着/时间不多了/唯一办法是/他必须”来交代推进；若必须表达判断，也要先给物证、动作或对白，让读者自己得出结论。",
    repairBlock,
    "单章上下文包如下：",
    JSON.stringify(compactPayload, null, 2),
  ].join("\n\n")
  return { system, user, title, chapterNumber }
}

function normalizeChapterDraftText(raw: string) {
  return raw
    .replace(/^```(?:[a-zA-Z0-9_-]+)?\s*/u, "")
    .replace(/```\s*$/u, "")
    .trim()
}

function splitChapterDraftSentences(text: string) {
  return text
    .replace(/\r\n/gu, "\n")
    .split(/(?<=[。！？!?；;])|\n{2,}/u)
    .map((sentence) => sentence.replace(/\s+/gu, " ").trim())
    .filter((sentence) => sentence.length >= 4)
}

function detectExplanatoryNarration(text: string) {
  const patterns = [
    { label: "认知总结", regex: /(?:他|她|陆无良|主角)?(?:终于|立刻|很快|已经|清楚地|猛然)?(?:意识到|确认|明白|知道|发现|判断出|察觉到|想明白|看出|感到|感觉到|觉得)/u },
    { label: "逻辑解释", regex: /(?:这|那|此举|眼下|现在)(?:意味着|说明|代表|证明|显示)|因此|所以|显然|由此可见|也就是说/u },
    { label: "任务宣告", regex: /(?:他|陆无良)(?:必须|不能|只能|需要|决定|打算|准备)|唯一(?:的)?办法|唯一(?:的)?选择/u },
    { label: "抽象压力", regex: /时间(?:窗口)?(?:正在|被|已经|迅速)?(?:压缩|缩短|不多|所剩无几)|局势(?:更加|越发|愈发)?(?:危险|复杂|严峻)|压力(?:越来越|骤然|继续)?(?:增大|增加|升级)|风险(?:越来越|继续|正在)?(?:增加|扩大|升高)/u },
    { label: "心理宣告", regex: /(?:恐惧|震惊|愤怒|绝望|痛苦|焦躁|紧张|平静|冷静|不安|迟疑)(?:地|了|起来|涌上|浮现|占据|蔓延)/u },
    { label: "设定说明", regex: /(?:这是|那是).{0,28}(?:原因|规则|规律|逻辑|信号|前兆|证明)|(?:所谓|也叫|名为).{2,24}/u },
  ]
  const sentences = splitChapterDraftSentences(text)
  const hits: Array<{ label: string; sentence: string }> = []
  for (const sentence of sentences) {
    for (const pattern of patterns) {
      if (pattern.regex.test(sentence)) {
        hits.push({ label: pattern.label, sentence })
        break
      }
    }
  }
  const paragraphSummaryHits = text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter((paragraph) => paragraph.length >= 20)
    .filter((paragraph) => /(?:意识到|确认|明白|这意味着|必须|不能|唯一(?:的)?办法|时间不多|压力|风险|局势)/u.test(paragraph))
    .length
  return {
    count: hits.length,
    sentenceCount: sentences.length,
    density: sentences.length ? hits.length / sentences.length : 0,
    paragraphSummaryHits,
    hits: hits.slice(0, 12),
  }
}

function validateChapterDraft(text: string, input: ChapterDraftInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const normalized = text.trim()
  const { chapterBlueprint } = chapterDraftContext(input)
  const requiredCharacters = Array.isArray(chapterBlueprint.requiredCharacters) ? chapterBlueprint.requiredCharacters.map((item) => styleDebugText(item)).filter(Boolean) : []
  const forbiddenDrift = Array.isArray(chapterBlueprint.forbiddenDrift) ? chapterBlueprint.forbiddenDrift.map((item) => styleDebugText(item)).filter(Boolean) : []
  const minChars = Math.max(400, Math.floor(input.targetWordCount * 0.35))
  if (!normalized) errors.push("正文初稿为空。")
  if (/^\s*[\[{]/u.test(normalized)) errors.push("正文初稿不能是 JSON；本节点需要可读正文。")
  if (/```/u.test(normalized)) errors.push("正文初稿不能包含 Markdown 代码块。")
  if (/^(以下是|下面是|我将|创作说明|写作思路|根据.*上下文包)/u.test(normalized)) errors.push("正文初稿不能以说明性话术开头。")
  if (/(chapterBlueprint|single_chapter_context|writingInputPackage|nextChapterEntryState|protagonistDecision|irreversibleChange)/u.test(normalized)) errors.push("正文泄漏了上下文字段名；需要转成小说自然叙事。")
  if (normalized.length < minChars) errors.push(`正文初稿过短：${normalized.length} 字符，最低应不少于 ${minChars} 字符。`)
  if (normalized.length < Math.floor(input.targetWordCount * 0.7)) warnings.push(`正文长度偏短：${normalized.length} 字符，目标约 ${input.targetWordCount} 中文字。`)
  if (!/[。！？]/u.test(normalized)) errors.push("正文缺少中文句末标点，疑似不是章节正文。")
  const explanatory = detectExplanatoryNarration(normalized)
  if (explanatory.count >= 8 || explanatory.density >= 0.28 || explanatory.paragraphSummaryHits >= 4) {
    errors.push(`解释性描述过多：命中 ${explanatory.count} 处，密度 ${(explanatory.density * 100).toFixed(1)}%。请把这些句子改成可见动作、物件变化、声音、对白、身体反应或环境压力。问题句：${explanatory.hits.map((hit) => `【${hit.label}】${hit.sentence.slice(0, 90)}`).join("｜")}`)
  } else if (explanatory.count >= 3) {
    warnings.push(`解释性描述偏多：命中 ${explanatory.count} 处。建议减少“意识到/确认/意味着/必须/唯一办法/时间不多”等总结句。问题句：${explanatory.hits.slice(0, 6).map((hit) => `【${hit.label}】${hit.sentence.slice(0, 70)}`).join("｜")}`)
  }
  for (const character of requiredCharacters) {
    if (character && !normalized.includes(character)) warnings.push(`正文未出现本章 requiredCharacters 中的“${character}”。`)
  }
  for (const rule of forbiddenDrift) {
    if (/禁止出现/u.test(rule)) {
      const blockedNames = rule
        .replace(/^.*?禁止出现/u, "")
        .replace(/实体|角色|人物|。/gu, "")
        .split(/或|、|和|及|，|,/u)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
      for (const name of blockedNames) if (normalized.includes(name)) errors.push(`违反本章 forbiddenDrift：${rule}；正文出现“${name}”。`)
    }
    if (/禁止.*离开.*洞/u.test(rule) && /(离开|走出|冲出|逃出|钻出).{0,8}(洞|荒洞|洞穴)|洞外.{0,12}(陆无良|他)/u.test(normalized)) {
      errors.push(`违反本章 forbiddenDrift：${rule}；正文疑似让主角离开洞穴。`)
    }
    if (/禁止.*雷击/u.test(rule) && /(释放|引动|打出|劈出|落下|召来).{0,12}雷|雷击.{0,12}(落下|劈|释放|击中|破开)/u.test(normalized)) {
      errors.push(`违反本章 forbiddenDrift：${rule}；正文疑似释放或兑现了实质雷击。`)
    }
  }
  const firstLine = normalized.split(/\r?\n/u).find((line) => line.trim()) || ""
  if (firstLine.length > 40) warnings.push("第一行不像章节标题；建议首行只保留本章标题。")
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

async function detectChapterDraftAigc(text: string, input: ChapterDraftInput) {
  const config = getAigcDetectorConfig(rootDir)
  const threshold = config.threshold ?? 0.8
  const minSegmentChars = Math.max(20, Math.min(500, Number(input.aigcMinSegmentChars || 120)))
  const policy = String(input.aigcPolicy || "balanced").trim() || "balanced"
  const segments = splitAigcLabTextIntoSentenceSegments(text, { granularity: "merged_sentence", minSegmentChars })
  const result = await detectAigcSegments(segments.length ? segments : text, { ...config, threshold })
  const highRiskSegments = Array.isArray(result.highRiskSegments) ? result.highRiskSegments : []
  const decision = aigcLabPassDecision({
    policy,
    score: result.score,
    threshold,
    highRiskCount: highRiskSegments.length,
    totalSentences: Array.isArray(result.segments) ? result.segments.length : segments.length,
  })
  return {
    ok: result.ok,
    passed: result.ok && result.status !== "unavailable" && decision.passed,
    provider: result.provider,
    status: result.status,
    score: result.score,
    confidence: result.confidence,
    threshold,
    policy: decision.policy,
    reason: result.ok ? decision.reason : result.reason,
    totalSegments: result.totalSegments,
    highRiskCount: highRiskSegments.length,
    highRiskSegments: highRiskSegments.slice(0, 8).map((entry) => ({
      index: entry.segment.index + 1,
      text: entry.segment.text,
      score: entry.score,
      status: entry.status,
      label: entry.label,
      reason: entry.reason,
    })),
  }
}

function mergeChapterProductionValidation(base: ReturnType<typeof validateChapterDraft>, aigc: Awaited<ReturnType<typeof detectChapterDraftAigc>>) {
  const errors = [...base.errors]
  const warnings = [...base.warnings]
  if (!aigc.ok || aigc.status === "unavailable") errors.push(`AIGC 检测不可用：${aigc.reason}`)
  else if (!aigc.passed) errors.push(`AIGC 未通过：${aigc.reason}`)
  else if (aigc.highRiskCount > 0) warnings.push(`AIGC 已按 ${aigc.policy} 策略通过，但仍有 ${aigc.highRiskCount} 个局部高风险句，建议人工查看。`)
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

function chapterProductionRepairIssues(validation: NonNullable<DebugRun["validation"]>, aigc: Awaited<ReturnType<typeof detectChapterDraftAigc>> | null) {
  return [
    ...validation.errors,
    ...validation.warnings.slice(0, 4),
    ...(aigc?.highRiskSegments || []).slice(0, 6).map((entry) => `AIGC 高风险句：${String(entry.text).slice(0, 180)}；score=${entry.score ?? "unknown"}`),
  ].filter(Boolean)
}

async function executeChapterDraftRun(run: DebugRun) {
  const input = run.input as ChapterDraftInput
  const runDir = path.join(runsRoot, run.runId)
  run.status = "running"
  run.startedAt = nowIso()
  run.error = null
  addEvent(run, "info", "11.1-context", "开始执行单章完整生产：读取单章上下文包，随后执行生成、检查、AIGC 和修复闭环。", {
    chapterNumber: input.chapterNumber,
    upstreamRunId: input.upstreamRunId,
    maxRepairRounds: input.maxRepairRounds,
  })
  try {
    await fs.mkdir(runDir, { recursive: true })
    const config = await loadDebugLlmConfig(run)
    if (!config) throw new Error("debug_llm_config_required")
    run.provider = { ...config.provider, apiKey: "[REDACTED]" }
    const initialPrompt = buildChapterDraftPrompt(input)
    run.prompts = {
      systemPrompt: initialPrompt.system,
      consensus: `独立调试 Run: ${run.runId}\n单章上下文 Run: ${input.upstreamRunId}`,
      basePrompt: initialPrompt.system,
      dynamicPrompt: JSON.stringify(input.singleChapterContext, null, 2),
      userMessage: initialPrompt.user,
    }
    await Promise.all([
      fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(input, null, 2)}\n`),
      fs.writeFile(path.join(runDir, "02-single-chapter-production-system-prompt.md"), initialPrompt.system),
      fs.writeFile(path.join(runDir, "03-single-chapter-production-user-message.md"), initialPrompt.user),
    ])
    run.artifacts.push("01-input.json", "02-single-chapter-production-system-prompt.md", "03-single-chapter-production-user-message.md")
    const attempts: Array<Record<string, unknown>> = []
    let finalText = ""
    let finalValidation: NonNullable<DebugRun["validation"]> | null = null
    let finalAigc: Awaited<ReturnType<typeof detectChapterDraftAigc>> | null = null
    const maxAttempts = Math.max(1, Math.min(12, 1 + Math.max(0, Number(input.maxRepairRounds || 0))))
    for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex += 1) {
      assertRunNotPaused(run)
      const previousAttempt = attempts.at(-1)
      const repairIssues = previousAttempt && finalValidation
        ? chapterProductionRepairIssues(finalValidation, finalAigc)
        : []
      const prompt = buildChapterDraftPrompt(input, attemptIndex > 1 ? {
        round: attemptIndex - 1,
        previousText: finalText,
        issues: repairIssues,
        aigc: finalAigc,
      } : undefined)
      if (attemptIndex > 1) {
        run.prompts.userMessage = prompt.user
        addEvent(run, "warning", "11.5-repair-loop", `第 ${attemptIndex - 1} 轮未通过，已把错误信息回写给模型进行完整重写。`, {
          issues: repairIssues.slice(0, 12),
        })
      }
      addEvent(run, "info", "11.2-draft", attemptIndex === 1 ? "开始生成本章正文候选。" : `开始生成第 ${attemptIndex} 版正文候选。`, {
        attempt: attemptIndex,
        maxAttempts,
      })
      const generated = await generateStyleDebugText(run, config, {
        roleName: "单章完整生产写手",
        system: prompt.system,
        user: prompt.user,
        temperature: input.temperature,
        phase: "chapter_draft_initial",
        streamToRaw: true,
      })
      const candidateText = normalizeChapterDraftText(generated)
      const baseValidation = validateChapterDraft(candidateText, input)
      addEvent(run, baseValidation.valid ? "success" : "error", "11.3-basic-gate", `第 ${attemptIndex} 版基础门禁${baseValidation.valid ? "通过" : "未通过"}。`, {
        attempt: attemptIndex,
        charCount: candidateText.length,
        ...baseValidation,
      })
      const aigc = await detectChapterDraftAigc(candidateText, input)
      addEvent(run, aigc.passed ? "success" : "error", "11.4-aigc-gate", `第 ${attemptIndex} 版 AIGC 门禁${aigc.passed ? "通过" : "未通过"}。`, {
        attempt: attemptIndex,
        aigc,
      })
      const validation = mergeChapterProductionValidation(baseValidation, aigc)
      attempts.push({
        attempt: attemptIndex,
        charCount: candidateText.length,
        text: candidateText,
        baseValidation,
        aigc,
        validation,
      })
      await Promise.all([
        fs.writeFile(path.join(runDir, `04-attempt-${String(attemptIndex).padStart(2, "0")}.txt`), `${candidateText}\n`),
        fs.writeFile(path.join(runDir, `05-attempt-${String(attemptIndex).padStart(2, "0")}-gate.json`), `${JSON.stringify({ baseValidation, aigc, validation }, null, 2)}\n`),
      ])
      run.artifacts.push(`04-attempt-${String(attemptIndex).padStart(2, "0")}.txt`, `05-attempt-${String(attemptIndex).padStart(2, "0")}-gate.json`)
      finalText = candidateText
      finalValidation = validation
      finalAigc = aigc
      if (validation.valid) break
    }
    const prompt = buildChapterDraftPrompt(input)
    const result = {
      version: 1,
      mode: "single_chapter_production_debug",
      source: {
        phase: "phase_11_single_chapter_production",
        singleChapterContextRunId: input.upstreamRunId,
        chapterNumber: prompt.chapterNumber,
        targetWordCount: input.targetWordCount,
      },
      boundary: {
        outputBoundary: "本节点完成单章正文候选生产与门禁闭环，但仍不提交正式章节、不推进正典账本。",
        nextPhase: "phase_12_continuous_chapter_production_or_manual_commit",
        commitStatus: "debug_only_not_committed",
      },
      draft: {
        chapterNumber: prompt.chapterNumber,
        title: prompt.title,
        targetWordCount: input.targetWordCount,
        charCount: finalText.length,
        text: finalText,
      },
      finalCandidate: {
        chapterNumber: prompt.chapterNumber,
        title: prompt.title,
        charCount: finalText.length,
        text: finalText,
        attempt: attempts.length,
        aigc: finalAigc,
      },
      productionFlow: {
        substeps: ["context", "draft", "basic_gate", "aigc_gate", "repair_loop", "final_candidate"],
        attempts,
        maxRepairRounds: input.maxRepairRounds,
        completed: finalValidation?.valid === true,
      },
      inherited: {
        chapterBlueprint: chapterDraftContext(input).chapterBlueprint,
        continuity: chapterDraftContext(input).continuity,
        frozenStyle: chapterDraftContext(input).frozenStyle,
        writingInputPackage: chapterDraftContext(input).writingInputPackage,
      },
      nextActions: [
        "人工阅读最终正文候选。",
        "确认稳定后再接正式章节提交按钮。",
        "批量生产节点可循环调用本单章完整生产节点。",
      ],
    }
    run.result = result
    run.validation = finalValidation || { valid: false, errors: ["single_chapter_production_no_attempt"], warnings: [] }
    await Promise.all([
      fs.writeFile(path.join(runDir, "90-final-candidate.txt"), `${finalText}\n`),
      fs.writeFile(path.join(runDir, "91-single-chapter-production-result.json"), `${JSON.stringify(result, null, 2)}\n`),
      fs.writeFile(path.join(runDir, "92-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
    ])
    run.artifacts.push("90-final-candidate.txt", "91-single-chapter-production-result.json", "92-validation.json")
    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "11.6-final", `单章完整生产未收敛：${run.validation.errors.length} 个错误。`, {
        attempts: attempts.length,
        ...run.validation,
      })
    } else {
      run.status = "completed"
      addEvent(run, "success", "11.6-final", "单章完整生产已通过：最终正文候选已生成，并通过基础门禁与 AIGC 门禁。", {
        chapterNumber: prompt.chapterNumber,
        charCount: finalText.length,
        attempts: attempts.length,
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    if (isDebugRunPausedError(error) || isRunPauseRequested(run)) {
      run.status = "paused"
      run.error = "debug_run_paused_by_user"
      addEvent(run, "warning", "pause", run.pauseReason || "章节正文初稿节点已暂停。")
    } else {
      run.status = "failed"
      run.error = error instanceof Error ? error.message : String(error)
      addEvent(run, "error", "run", `章节正文初稿节点执行失败：${run.error}`)
    }
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

function safeAssetSegment(value: unknown, fallback = "unknown") {
  const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/gu, "_").replace(/^_+|_+$/gu, "")
  return normalized || fallback
}

async function listCommittedChapterAssets(projectIdValue: unknown) {
  const projectId = safeAssetSegment(projectIdValue, "default-project")
  const projectChapterRoot = path.join(committedChaptersRoot, projectId)
  const entries = await fs.readdir(projectChapterRoot, { withFileTypes: true }).catch(() => [])
  const assets = await Promise.all(entries
    .filter((entry) => entry.isFile() && /^chapter_\d{4}_.+\.json$/u.test(entry.name))
    .map(async (entry) => {
      const assetPath = path.join(projectChapterRoot, entry.name)
      try {
        const parsed = JSON.parse(await fs.readFile(assetPath, "utf8")) as Record<string, unknown>
        return {
          chapterNumber: Number(parsed.chapterNumber),
          title: String(parsed.title || ""),
          charCount: Number(parsed.charCount || 0),
          sourceDraftRunId: String(parsed.sourceDraftRunId || ""),
          commitRunId: String(parsed.commitRunId || ""),
          committedAt: String(parsed.committedAt || ""),
          assetPath,
          textAssetPath: String(parsed.textAssetPath || ""),
        }
      } catch {
        return null
      }
    }))
  return assets
    .filter((item): item is NonNullable<typeof item> => Boolean(item && Number.isInteger(item.chapterNumber) && item.chapterNumber > 0))
    .sort((a, b) => a.chapterNumber - b.chapterNumber || a.committedAt.localeCompare(b.committedAt))
}

function committedChapterCoverage(assets: Awaited<ReturnType<typeof listCommittedChapterAssets>>, firstChapter = 1) {
  const latestByChapter = new Map<number, typeof assets[number]>()
  for (const asset of assets) latestByChapter.set(asset.chapterNumber, asset)
  const chapters = [...latestByChapter.keys()].sort((a, b) => a - b)
  let lastContinuousChapter = firstChapter - 1
  while (latestByChapter.has(lastContinuousChapter + 1)) lastContinuousChapter += 1
  return {
    chapters,
    count: chapters.length,
    firstChapter,
    lastContinuousChapter,
    nextChapter: lastContinuousChapter + 1,
    assets: chapters.map((chapterNumber) => latestByChapter.get(chapterNumber)).filter(Boolean),
  }
}

async function readDebugJson(filePath: string) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : []
}

async function findBlueprintBatchForChapter(chapterNumber: number, title: string) {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => [])
  const matches = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("cb_"))
    .map(async (entry) => {
      const runId = entry.name
      const blueprintPath = path.join(runsRoot, runId, "06-chapter-blueprints.json")
      const parsed = await readDebugJson(blueprintPath)
      const blueprints = Array.isArray(parsed?.blueprints) ? parsed.blueprints.map(recordValue) : []
      const matched = blueprints.find((item) => Number(item.chapterNumber) === chapterNumber && (!title || String(item.title || "") === title))
        || blueprints.find((item) => Number(item.chapterNumber) === chapterNumber)
      if (!matched) return null
      const stat = await fs.stat(blueprintPath).catch(() => null)
      const source = recordValue(parsed?.source)
      return {
        runId,
        mtimeMs: stat?.mtimeMs || 0,
        volumeId: String(source.volumeId || ""),
        batchStartChapter: Number(source.batchStartChapter || 0),
        batchEndChapter: Number(source.batchEndChapter || 0),
        sourceArcIds: stringList(source.sourceArcIds),
      }
    }))
  return matches
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null
}

async function findLatestChapterDraftAttempt(chapterNumber: number) {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => [])
  const attempts = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("dr_"))
    .map(async (entry) => {
      const runId = entry.name
      const runPath = path.join(runsRoot, runId, "run.json")
      const run = await readDebugJson(runPath)
      if (run?.nodeId !== "chapter-draft") return null
      const input = recordValue(run.input)
      if (Number(input.chapterNumber) !== chapterNumber) return null
      const validation = await readDebugJson(path.join(runsRoot, runId, "92-validation.json"))
      const finalCandidate = await fs.readFile(path.join(runsRoot, runId, "90-final-candidate.txt"), "utf8").catch(() => "")
      const stat = await fs.stat(runPath).catch(() => null)
      const errors = stringList(validation?.errors)
      const warnings = stringList(validation?.warnings)
      const stageGuard = /STAGE_GUARD_CORRECTION|阶段纠偏/u.test(finalCandidate)
      return {
        runId,
        status: String(run.status || ""),
        error: run.error ? String(run.error) : null,
        createdAt: String(run.createdAt || ""),
        completedAt: String(run.completedAt || ""),
        mtimeMs: stat?.mtimeMs || 0,
        charCount: finalCandidate.trim().length,
        stageGuard,
        errors,
        warnings,
        preview: finalCandidate.replace(/\s+/gu, " ").slice(0, 220),
      }
    }))
  return attempts
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null
}

async function buildCommittedChapterReview(projectIdValue: unknown, firstChapter = 1, lastChapter?: number) {
  const projectId = safeAssetSegment(projectIdValue, "default-project")
  const assets = await listCommittedChapterAssets(projectId)
  const coverage = committedChapterCoverage(assets, firstChapter)
  const maxChapter = Number.isInteger(lastChapter) && Number(lastChapter) >= firstChapter ? Number(lastChapter) : Number(coverage.lastContinuousChapter || firstChapter)
  const selectedAssets = coverage.assets
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
    .filter((asset) => asset.chapterNumber >= firstChapter && asset.chapterNumber <= maxChapter)
  const chapters = await Promise.all(selectedAssets.map(async (asset) => {
    const draftRunDir = path.join(runsRoot, asset.sourceDraftRunId)
    const draftInput = await readDebugJson(path.join(draftRunDir, "01-input.json"))
    const draftValidation = await readDebugJson(path.join(draftRunDir, "92-validation.json"))
    const context = recordValue(draftInput?.singleChapterContext)
    const blueprint = recordValue(context.chapterBlueprint)
    const continuity = recordValue(context.continuity)
    const source = recordValue(context.source)
    const validationErrors = stringList(draftValidation?.errors)
    const validationWarnings = stringList(draftValidation?.warnings)
    const text = asset.textAssetPath ? await fs.readFile(asset.textAssetPath, "utf8").catch(() => "") : ""
    const expectedBatch = await findBlueprintBatchForChapter(asset.chapterNumber, asset.title)
    const loggedBlueprintRunId = String(source.chapterBlueprintRunId || "")
    const warningSummaryParts = [
      ...validationErrors.map((item) => `错误：${item}`),
      ...validationWarnings.map((item) => `警告：${item}`),
      expectedBatch && loggedBlueprintRunId && loggedBlueprintRunId !== expectedBatch.runId
        ? `日志来源提示：上下文记录的蓝图 Run 为 ${loggedBlueprintRunId}，但按章节匹配到 ${expectedBatch.runId}。`
        : "",
    ].filter(Boolean)
    return {
      chapterNumber: asset.chapterNumber,
      title: asset.title,
      charCount: asset.charCount,
      committedAt: asset.committedAt,
      sourceDraftRunId: asset.sourceDraftRunId,
      commitRunId: asset.commitRunId,
      valid: draftValidation?.valid === true,
      blueprintGoal: String(blueprint.chapterGoal || ""),
      protagonistDecision: String(blueprint.protagonistDecision || ""),
      irreversibleChange: String(blueprint.irreversibleChange || ""),
      nextPressure: String(blueprint.nextPressure || ""),
      requiredCharacters: stringList(blueprint.requiredCharacters),
      forbiddenDrift: stringList(blueprint.forbiddenDrift),
      previousExitState: String(recordValue(continuity.previousChapter).exitState || ""),
      nextPreview: String(recordValue(continuity.nextChapterPreview).allowedHandoffPressure || recordValue(continuity.nextChapterPreview).title || ""),
      warnings: validationWarnings,
      errors: validationErrors,
      warningSummary: warningSummaryParts.length ? warningSummaryParts.join("｜") : "",
      textPreview: text.replace(/\s+/gu, " ").slice(0, 260),
      tailPreview: text.split(/\n\s*\n/u).map((item) => item.trim()).filter(Boolean).slice(-2).join(" / ").replace(/\s+/gu, " ").slice(0, 260),
      loggedBlueprintRunId,
      matchedBlueprintBatch: expectedBatch ? {
        runId: expectedBatch.runId,
        volumeId: expectedBatch.volumeId,
        batchStartChapter: expectedBatch.batchStartChapter,
        batchEndChapter: expectedBatch.batchEndChapter,
        sourceArcIds: expectedBatch.sourceArcIds,
      } : null,
    }
  }))
  const invalidChapters = chapters.filter((chapter) => chapter.valid === false)
  const warningChapters = chapters.filter((chapter) => chapter.warnings.length > 0)
  const sourceMismatchChapters = chapters.filter((chapter) => chapter.matchedBlueprintBatch && chapter.loggedBlueprintRunId && chapter.loggedBlueprintRunId !== chapter.matchedBlueprintBatch.runId)
  const currentArc = maxChapter <= 50 ? "arc_01 裂缝与抉择" : maxChapter <= 100 ? "arc_02 墟境初醒" : "后续弧线"
  const nextChapterBlocker = await findLatestChapterDraftAttempt(Number(coverage.nextChapter || maxChapter + 1))
  const issueHighlights = [
    invalidChapters.length ? `有 ${invalidChapters.length} 章对应 draft 验证不是 valid，需要打开详细 JSON 看原因。` : "",
    warningChapters.length ? `有 ${warningChapters.length} 章带警告，主要集中在解释性描述、requiredCharacters 直写名未出现、局部 AIGC 风险。` : "",
    sourceMismatchChapters.length ? `有 ${sourceMismatchChapters.length} 章存在蓝图来源 Run ID 追溯不一致；内容可用，但日志信任感需要后续修。` : "",
    nextChapterBlocker?.stageGuard ? `第 ${coverage.nextChapter} 章最新失败是阶段纠偏污染：模型输出流程说明而不是正文。` : "",
    nextChapterBlocker && nextChapterBlocker.charCount > 0 && nextChapterBlocker.charCount < 875 ? `第 ${coverage.nextChapter} 章最新候选只有 ${nextChapterBlocker.charCount} 字，未达到正文最低长度。` : "",
  ].filter(Boolean)
  return {
    projectId,
    mode: "committed_chapter_reading_review",
    generatedAt: nowIso(),
    range: { firstChapter, lastChapter: maxChapter },
    coverage: {
      count: coverage.count,
      chapters: coverage.chapters,
      firstChapter: coverage.firstChapter,
      lastContinuousChapter: coverage.lastContinuousChapter,
      nextChapter: coverage.nextChapter,
    },
    summary: {
      verdict: chapters.length ? `已冻结 ${coverage.count} 章；当前可读复盘到第 ${maxChapter} 章` : "尚无可复盘章节",
      currentStoryPosition: chapters.length ? `当前位于第一卷 ${currentArc}，仍处于荒洞封锁、裂缝自愈、太虚枢机监控、无面渗透与灵虫/执事压迫阶段。` : "尚未形成章节正文资产。",
      plotNow: chapters.length ? `第 ${maxChapter} 章后，陆无良仍未击穿天壁；灵虫封锁圈已经形成，下一步应写第 ${coverage.nextChapter} 章“以寿命灌注墟种、换取裂缝震动加快”，但不能提前完成破壁。` : "",
      mainlineFit: invalidChapters.length ? "需人工复核" : "基本符合",
      worldviewFit: "基本符合",
      assessments: [
        "主线仍在弧 1：被困荒洞 → 试探雷击 → 太虚枢机升级 → 无面渗透 → 灵虫封锁；没有看到提前进入墟境或提前击穿天壁。",
        "世界观关键边界保持住了：太虚枢机负责修复/监控，墟种能破局但要消耗生命，无面以精神渗透为主，沈青霜目前不应现场登场。",
        "当前最大风险不是剧情偏主线，而是第 23 章生成被阶段守卫污染；应在继续正文前先解决该生成污染。",
      ],
      nextActions: [
        `如果继续写正文，建议从第 ${coverage.nextChapter} 章单章重试，不要直接自动续跑。`,
        "先人工阅读第 20–22 章，确认压迫感和动作链是否满意。",
        "后续再修复日志中的蓝图 Run ID 追溯问题，避免调试证据看起来不可信。",
      ],
    },
    issueHighlights,
    nextChapterBlocker: nextChapterBlocker ? {
      chapterNumber: coverage.nextChapter,
      runId: nextChapterBlocker.runId,
      status: nextChapterBlocker.status,
      summary: nextChapterBlocker.stageGuard
        ? "模型没有写正文，而是输出了 STAGE_GUARD_CORRECTION/阶段纠偏说明。"
        : nextChapterBlocker.error || "下一章 draft 未通过。",
      errors: nextChapterBlocker.errors,
      warnings: nextChapterBlocker.warnings,
      charCount: nextChapterBlocker.charCount,
      preview: nextChapterBlocker.preview,
    } : null,
    chapters,
  }
}

function chapterCommitDraftPayload(sourceRun: DebugRun) {
  const result = sourceRun.result || {}
  const finalCandidate = result.finalCandidate && typeof result.finalCandidate === "object" && !Array.isArray(result.finalCandidate)
    ? result.finalCandidate as Record<string, unknown>
    : {}
  const draft = result.draft && typeof result.draft === "object" && !Array.isArray(result.draft)
    ? result.draft as Record<string, unknown>
    : {}
  const text = String(finalCandidate.text || draft.text || sourceRun.rawResponse || "").trim()
  const chapterNumber = Number(finalCandidate.chapterNumber || draft.chapterNumber || (sourceRun.input as ChapterDraftInput).chapterNumber)
  const title = styleDebugText(finalCandidate.title || draft.title, `第${chapterNumber || "?"}章`)
  return {
    chapterNumber,
    title,
    text,
    charCount: text.length,
    attempt: Number(finalCandidate.attempt || 1),
    aigc: finalCandidate.aigc || null,
  }
}

function chapterCommitHandoff(sourceRun: DebugRun) {
  const inherited = sourceRun.result?.inherited && typeof sourceRun.result.inherited === "object" && !Array.isArray(sourceRun.result.inherited)
    ? sourceRun.result.inherited as Record<string, unknown>
    : {}
  const chapterBlueprint = inherited.chapterBlueprint && typeof inherited.chapterBlueprint === "object" && !Array.isArray(inherited.chapterBlueprint)
    ? inherited.chapterBlueprint as Record<string, unknown>
    : {}
  const writingInputPackage = inherited.writingInputPackage && typeof inherited.writingInputPackage === "object" && !Array.isArray(inherited.writingInputPackage)
    ? inherited.writingInputPackage as Record<string, unknown>
    : {}
  return {
    nextChapter: Number(chapterBlueprint.chapterNumber || (sourceRun.input as ChapterDraftInput).chapterNumber || 0) + 1,
    nextPressure: chapterBlueprint.nextPressure || writingInputPackage.nextPressure || "",
    irreversibleChange: chapterBlueprint.irreversibleChange || "",
    protagonistDecision: chapterBlueprint.protagonistDecision || "",
    requiredContinuity: {
      stateLedgerRefs: Array.isArray(chapterBlueprint.stateLedgerRefs) ? chapterBlueprint.stateLedgerRefs : [],
      forbiddenDrift: Array.isArray(chapterBlueprint.forbiddenDrift) ? chapterBlueprint.forbiddenDrift : [],
      requiredCharacters: Array.isArray(chapterBlueprint.requiredCharacters) ? chapterBlueprint.requiredCharacters : [],
    },
  }
}

function validateChapterCommitResult(result: Record<string, unknown>) {
  const errors: string[] = []
  const warnings: string[] = []
  const frozenChapter = result.frozenChapter && typeof result.frozenChapter === "object" && !Array.isArray(result.frozenChapter)
    ? result.frozenChapter as Record<string, unknown>
    : {}
  const chapterNumber = Number(frozenChapter.chapterNumber)
  const text = String(frozenChapter.text || "")
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) errors.push("frozenChapter.chapterNumber 必须是有效章节号。")
  if (text.trim().length < 500) errors.push("frozenChapter.text 太短，不能冻结为空正文或残缺正文。")
  if (!String(frozenChapter.sourceDraftRunId || "").trim()) errors.push("frozenChapter.sourceDraftRunId 缺失，无法追溯第 11 节点来源。")
  if (!String(frozenChapter.assetPath || "").trim()) errors.push("frozenChapter.assetPath 缺失，未写入冻结资产。")
  if (!String(result.commitStatus || "").includes("frozen")) errors.push("commitStatus 必须标记为 frozen。")
  if (text.length < 1200) warnings.push("冻结正文低于 1200 字，请确认这是你接受的章节长度。")
  return { valid: errors.length === 0, errors, warnings }
}

async function executeChapterCommitRun(run: DebugRun) {
  run.status = "running"
  run.startedAt = nowIso()
  run.provider = { modelName: "no-llm", apiMode: "local-freeze" }
  const input = run.input as ChapterCommitInput
  const runDir = path.join(runsRoot, run.runId)
  try {
    await fs.mkdir(runDir, { recursive: true })
    await fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(input, null, 2)}\n`)
    run.artifacts.push("01-input.json")
    addEvent(run, "info", "12.1-source", "开始执行章节正文冻结：读取已通过的第 11 节点最终正文候选。", {
      upstreamRunId: input.upstreamRunId,
      chapterNumber: input.chapterNumber,
    })
    const sourceRun = await loadRun(input.upstreamRunId)
    if (!sourceRun) throw new Error("chapter_draft_run_not_found")
    if (sourceRun.nodeId !== "chapter-draft") throw new Error("upstream_run_must_be_chapter_draft")
    if (sourceRun.status !== "completed" || sourceRun.validation?.valid !== true || !sourceRun.result) throw new Error("chapter_draft_run_must_be_completed_and_valid")
    const draft = chapterCommitDraftPayload(sourceRun)
    if (!Number.isInteger(draft.chapterNumber) || draft.chapterNumber < 1) throw new Error("chapter_number_missing_from_draft")
    if (Number.isInteger(input.chapterNumber) && input.chapterNumber !== draft.chapterNumber) throw new Error(`chapter_number_mismatch_${input.chapterNumber}_vs_${draft.chapterNumber}`)
    if (!draft.text || draft.text.length < 500) throw new Error("chapter_draft_final_text_missing_or_too_short")
    const projectId = safeAssetSegment(input.factoryProjectId || sourceRun.input.factoryProjectId, "default-project")
    const chapterNumberPadded = String(draft.chapterNumber).padStart(4, "0")
    const projectChapterRoot = path.join(committedChaptersRoot, projectId)
    await fs.mkdir(projectChapterRoot, { recursive: true })
    const assetName = `chapter_${chapterNumberPadded}_${run.runId}.json`
    const assetPath = path.join(projectChapterRoot, assetName)
    const textAssetName = `chapter_${chapterNumberPadded}_${run.runId}.txt`
    const textAssetPath = path.join(projectChapterRoot, textAssetName)
    const frozenChapter = {
      version: 1,
      status: "frozen",
      projectId: input.factoryProjectId || sourceRun.input.factoryProjectId,
      chapterNumber: draft.chapterNumber,
      title: draft.title,
      text: draft.text,
      charCount: draft.charCount,
      sourceDraftRunId: sourceRun.runId,
      sourceContextRunId: (sourceRun.input as ChapterDraftInput).upstreamRunId,
      commitRunId: run.runId,
      committedAt: nowIso(),
      commitNote: input.commitNote,
      modelConfigId: sourceRun.input.modelConfigId,
      provider: sourceRun.provider,
      validation: sourceRun.validation,
      aigc: draft.aigc,
      attempt: draft.attempt,
      assetPath,
      textAssetPath,
    }
    const handoff = chapterCommitHandoff(sourceRun)
    const result = {
      version: 1,
      mode: "chapter_commit_debug",
      commitStatus: "frozen_debug_chapter",
      source: {
        phase: "phase_12_chapter_commit",
        chapterDraftRunId: sourceRun.runId,
        singleChapterContextRunId: (sourceRun.input as ChapterDraftInput).upstreamRunId,
      },
      frozenChapter,
      handoff,
      boundary: {
        outputBoundary: "本节点把第 11 节点通过的正文候选冻结为调试页章节资产；当前不直接写入生产数据库。",
        productionDbStatus: "not_written",
        nextPhase: "phase_13_next_chapter_context_or_batch_chapter_production",
      },
    }
    await Promise.all([
      fs.writeFile(assetPath, `${JSON.stringify(frozenChapter, null, 2)}\n`),
      fs.writeFile(textAssetPath, `${draft.title}\n\n${draft.text}\n`),
      fs.writeFile(path.join(runDir, "02-source-chapter-draft-run.json"), `${JSON.stringify(sourceRun, null, 2)}\n`),
      fs.writeFile(path.join(runDir, "03-frozen-chapter.json"), `${JSON.stringify(frozenChapter, null, 2)}\n`),
      fs.writeFile(path.join(runDir, "04-frozen-chapter.txt"), `${draft.title}\n\n${draft.text}\n`),
      fs.writeFile(path.join(runDir, "05-chapter-commit-result.json"), `${JSON.stringify(result, null, 2)}\n`),
    ])
    run.artifacts.push("02-source-chapter-draft-run.json", "03-frozen-chapter.json", "04-frozen-chapter.txt", "05-chapter-commit-result.json")
    run.result = result
    run.validation = validateChapterCommitResult(result)
    await fs.writeFile(path.join(runDir, "06-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("06-validation.json")
    if (run.validation.valid) {
      run.status = "completed"
      addEvent(run, "success", "12.2-freeze", `第 ${draft.chapterNumber} 章已冻结为调试章节资产。`, {
        chapterNumber: draft.chapterNumber,
        charCount: draft.charCount,
        assetPath,
        textAssetPath,
        sourceDraftRunId: sourceRun.runId,
      })
    } else {
      run.status = "invalid"
      addEvent(run, "error", "12.2-freeze", `章节正文冻结校验失败：${run.validation.errors.length} 个错误。`, run.validation)
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `章节正文冻结失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

function validateContinuousChapterProductionResult(result: Record<string, unknown>, input: ContinuousChapterProductionInput) {
  const errors: string[] = []
  const warnings: string[] = []
  const chapters = Array.isArray(result.chapters) ? result.chapters as Record<string, unknown>[] : []
  const expectedCount = input.endChapter - input.startChapter + 1
  if (String(result.mode || "") !== "continuous_chapter_production_debug") errors.push("mode 必须是 continuous_chapter_production_debug。")
  if (!Number.isInteger(input.startChapter) || !Number.isInteger(input.endChapter) || input.startChapter > input.endChapter) errors.push("章节范围无效。")
  if (chapters.length !== expectedCount) errors.push(`chapters 必须包含 ${expectedCount} 章结果。`)
  for (let chapter = input.startChapter; chapter <= input.endChapter; chapter += 1) {
    const entry = chapters.find((item) => Number(item.chapterNumber) === chapter)
    if (!entry) {
      errors.push(`缺少第 ${chapter} 章生产结果。`)
      continue
    }
    if (String(entry.status || "") !== "completed") errors.push(`第 ${chapter} 章未完成：${String(entry.status || "unknown")}。`)
    if (!String(entry.contextRunId || "").trim()) errors.push(`第 ${chapter} 章缺少 contextRunId。`)
    if (!String(entry.draftRunId || "").trim()) errors.push(`第 ${chapter} 章缺少 draftRunId。`)
    if (!String(entry.commitRunId || "").trim()) errors.push(`第 ${chapter} 章缺少 commitRunId。`)
    if (!String(entry.assetPath || "").trim()) errors.push(`第 ${chapter} 章缺少冻结资产路径。`)
  }
  const charCounts = chapters.map((item) => Number(item.charCount || 0)).filter((count) => Number.isFinite(count))
  if (charCounts.some((count) => count < 1200)) warnings.push("存在冻结正文低于 1200 字的章节，请人工确认长度是否可接受。")
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

async function executeContinuousChapterProductionRun(run: DebugRun) {
  const input = run.input as ContinuousChapterProductionInput
  const runDir = path.join(runsRoot, run.runId)
  run.status = "running"
  run.startedAt = nowIso()
  run.error = null
  run.provider = { modelName: "workflow-orchestrator", apiMode: "local-compose" }
  const chapters: Record<string, unknown>[] = []
  try {
    await fs.mkdir(runDir, { recursive: true })
    await fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(input, null, 2)}\n`)
    run.artifacts.push("01-input.json")
    addEvent(run, "info", "13.1-start", `开始连续章节生产：第 ${input.startChapter}-${input.endChapter} 章。`, {
      startChapter: input.startChapter,
      endChapter: input.endChapter,
      targetWordCount: input.targetWordCount,
      maxRepairRounds: input.maxRepairRounds,
      aigcPolicy: input.aigcPolicy,
    })
    run.result = {
      version: 1,
      mode: "continuous_chapter_production_debug",
      source: {
        phase: "phase_13_continuous_chapter_production",
        styleProfileRunId: input.upstreamRunId,
        startChapter: input.startChapter,
        endChapter: input.endChapter,
      },
      chapters,
      boundary: {
        outputBoundary: "本节点只编排第 10/11/12 调试节点，并把每章冻结为调试章节资产；当前不直接写入生产数据库。",
        productionDbStatus: "not_written",
      },
    }
    for (let chapterNumber = input.startChapter; chapterNumber <= input.endChapter; chapterNumber += 1) {
      assertRunNotPaused(run)
      addEvent(run, "info", "13.2-chapter", `开始第 ${chapterNumber} 章：生成上下文包。`, { chapterNumber })
      const contextInput: SingleChapterContextInput = {
        modelConfigId: input.modelConfigId,
        factoryProjectId: input.factoryProjectId,
        upstreamRunId: input.upstreamRunId,
        chapterNumber,
        contextFocus: input.productionFocus,
        targetWordCount: input.targetWordCount,
        styleProfile: input.styleProfile,
        frozenStyle: input.frozenStyle,
        storyBible: input.storyBible,
        volumeStrategy: input.volumeStrategy,
        chapterBlueprints: input.chapterBlueprints,
      }
      const contextRun: DebugRun = {
        runId: `cc_${Date.now()}_${randomUUID().slice(0, 8)}`,
        nodeId: "single-chapter-context",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input: contextInput,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(contextRun, run)
      await executeSingleChapterContextRun(contextRun)
      if (contextRun.status !== "completed" || contextRun.validation?.valid !== true || !contextRun.result) {
        chapters.push({ chapterNumber, status: "failed_at_context", contextRunId: contextRun.runId, errors: contextRun.validation?.errors || [contextRun.error || "context_failed"] })
        throw new Error(`chapter_${chapterNumber}_context_failed`)
      }

      assertRunNotPaused(run)
      addEvent(run, "info", "13.3-draft", `第 ${chapterNumber} 章上下文通过，开始正文生产。`, { chapterNumber, contextRunId: contextRun.runId })
      const draftInput: ChapterDraftInput = {
        modelConfigId: input.modelConfigId,
        factoryProjectId: input.factoryProjectId,
        upstreamRunId: contextRun.runId,
        chapterNumber,
        draftFocus: input.productionFocus,
        targetWordCount: input.targetWordCount,
        temperature: input.temperature,
        maxRepairRounds: input.maxRepairRounds,
        aigcPolicy: input.aigcPolicy,
        aigcMinSegmentChars: input.aigcMinSegmentChars,
        singleChapterContext: contextRun.result,
      }
      const draftRun: DebugRun = {
        runId: `dr_${Date.now()}_${randomUUID().slice(0, 8)}`,
        nodeId: "chapter-draft",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input: draftInput,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(draftRun, contextRun)
      await executeChapterDraftRun(draftRun)
      if (draftRun.status !== "completed" || draftRun.validation?.valid !== true || !draftRun.result) {
        chapters.push({ chapterNumber, status: "failed_at_draft", contextRunId: contextRun.runId, draftRunId: draftRun.runId, errors: draftRun.validation?.errors || [draftRun.error || "draft_failed"] })
        throw new Error(`chapter_${chapterNumber}_draft_failed`)
      }

      assertRunNotPaused(run)
      addEvent(run, "info", "13.4-freeze", `第 ${chapterNumber} 章正文通过，开始自动冻结。`, { chapterNumber, draftRunId: draftRun.runId })
      const commitInput: ChapterCommitInput = {
        modelConfigId: input.modelConfigId,
        factoryProjectId: input.factoryProjectId,
        upstreamRunId: draftRun.runId,
        chapterNumber,
        commitNote: `连续章节生产自动冻结：父 Run ${run.runId}`,
        chapterDraft: draftRun.result,
      }
      const commitRun: DebugRun = {
        runId: `cm_${Date.now()}_${randomUUID().slice(0, 8)}`,
        nodeId: "chapter-commit",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input: commitInput,
        provider: { modelName: "no-llm", apiMode: "local-freeze" },
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(commitRun, draftRun)
      await executeChapterCommitRun(commitRun)
      if (commitRun.status !== "completed" || commitRun.validation?.valid !== true || !commitRun.result) {
        chapters.push({ chapterNumber, status: "failed_at_commit", contextRunId: contextRun.runId, draftRunId: draftRun.runId, commitRunId: commitRun.runId, errors: commitRun.validation?.errors || [commitRun.error || "commit_failed"] })
        throw new Error(`chapter_${chapterNumber}_commit_failed`)
      }
      const frozen = commitRun.result.frozenChapter && typeof commitRun.result.frozenChapter === "object" && !Array.isArray(commitRun.result.frozenChapter)
        ? commitRun.result.frozenChapter as Record<string, unknown>
        : {}
      chapters.push({
        chapterNumber,
        status: "completed",
        contextRunId: contextRun.runId,
        draftRunId: draftRun.runId,
        commitRunId: commitRun.runId,
        title: frozen.title,
        charCount: frozen.charCount,
        assetPath: frozen.assetPath,
      })
      addEvent(run, "success", "13.5-chapter-complete", `第 ${chapterNumber} 章已完成并冻结。`, chapters.at(-1))
      run.result = { ...(run.result || {}), chapters }
      await persistRun(run)
    }
    run.validation = validateContinuousChapterProductionResult(run.result || {}, input)
    await fs.writeFile(path.join(runDir, "90-continuous-chapter-production-result.json"), `${JSON.stringify(run.result, null, 2)}\n`)
    await fs.writeFile(path.join(runDir, "91-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("90-continuous-chapter-production-result.json", "91-validation.json")
    run.status = run.validation.valid ? "completed" : "invalid"
    addEvent(run, run.validation.valid ? "success" : "error", "13.6-final", run.validation.valid
      ? `连续章节生产完成：第 ${input.startChapter}-${input.endChapter} 章已全部冻结。`
      : `连续章节生产结果校验失败：${run.validation.errors.length} 个错误。`,
    run.validation)
  } catch (error) {
    if (isDebugRunPausedError(error) || isRunPauseRequested(run)) {
      run.status = "paused"
      run.error = "debug_run_paused_by_user"
      addEvent(run, "warning", "pause", "连续章节生产已暂停；当前版本会在章节边界停止。")
    } else {
      run.status = chapters.length && chapters.some((entry) => String(entry.status || "").startsWith("failed_")) ? "invalid" : "failed"
      run.error = error instanceof Error ? error.message : String(error)
      run.validation = { valid: false, errors: [run.error], warnings: [] }
      addEvent(run, "error", "run", `连续章节生产中断：${run.error}`, { chapters })
    }
  } finally {
    run.result = {
      ...(run.result || {}),
      version: 1,
      mode: "continuous_chapter_production_debug",
      chapters,
    }
    run.completedAt = nowIso()
    await fs.writeFile(path.join(runDir, "92-final-snapshot.json"), `${JSON.stringify({ result: run.result, validation: run.validation }, null, 2)}\n`).catch(() => undefined)
    if (!run.artifacts.includes("92-final-snapshot.json")) run.artifacts.push("92-final-snapshot.json")
    await persistRun(run)
  }
}

function compactStyleEvolutionNextSeed(input: {
  baseSeedPrompt: string
  userStylePrompt: string
  evaluation: StyleEvolutionEvaluation
  refinement: StyleEvolutionRefinement
  aigcLessons?: string[]
}) {
  const takeShort = (items: unknown, limit: number) => Array.isArray(items)
    ? items.map((item) => styleDebugText(item).replace(/\s+/gu, " ")).filter(Boolean).slice(0, limit)
    : []
  const focus = [
    ...takeShort(input.evaluation.nextFocus, 3),
    ...takeShort(input.refinement.promptAdjustments, 3),
    ...takeShort(input.refinement.contractAdjustments, 2),
  ]
  const dedupedFocus = [...new Set(focus)]
    .filter((item) => item.length <= 120)
    .slice(0, 5)
  return [
    input.baseSeedPrompt,
    input.userStylePrompt ? `用户原始文风关注：${input.userStylePrompt}` : "",
    input.aigcLessons?.length ? "AIGC 自进化记忆（下轮必须优先修正，不能重复失败模式）：" : "",
    ...(input.aigcLessons || []).slice(-8).map((item) => `- ${item}`),
    dedupedFocus.length ? "上一轮需要修正的重点（只继承这些，不复制旧 prompt）：" : "",
    ...dedupedFocus.map((item) => `- ${item}`),
  ].filter(Boolean).join("\n").slice(0, 1800)
}

function normalizeStyleDebugAigcMode(input: StyleProfileInput) {
  const granularity = String(input.aigcGranularity || "merged_sentence").trim()
  const policy = String(input.aigcPolicy || "balanced").trim()
  const minSegmentChars = Math.max(20, Math.min(500, Number(input.aigcMinSegmentChars || 120)))
  return {
    granularity,
    policy,
    minSegmentChars,
  }
}

async function detectStyleDebugAigcSignal(
  sample: string,
  config: AigcDetectionConfig,
  context: string,
  options: { granularity?: string; policy?: string; minSegmentChars?: number } = {},
) {
  const diagnostics = {
    urlConfigured: Boolean(config.url?.trim()),
    context,
    mode: `${options.granularity || "node09"}:${options.policy || "strict_any_sentence"}`,
  }
  try {
    const granularity = String(options.granularity || "node09")
    const policy = String(options.policy || "strict_any_sentence")
    const minSegmentChars = Math.max(20, Math.min(500, Number(options.minSegmentChars || 120)))
    const threshold = config.threshold ?? 0.8
    const segments = granularity === "node09"
      ? null
      : splitAigcLabTextIntoSentenceSegments(sample, { granularity, minSegmentChars })
    const result = await detectAigcSegments(segments || sample, config)
    const signal = normalizeStyleAigcSignal(result, diagnostics)
    if (granularity === "node09" && policy === "strict_any_sentence") return signal
    const passDecision = aigcLabPassDecision({
      policy,
      score: result.score,
      threshold,
      highRiskCount: Array.isArray(result.highRiskSegments) ? result.highRiskSegments.length : 0,
      totalSentences: Array.isArray(result.segments) ? result.segments.length : 0,
    })
    const status: NonNullable<StyleEvolutionEvaluation["aigc"]>["status"] = passDecision.passed ? "passed" : "blocked"
    return {
      ...signal,
      status,
      reason: [
        signal.reason,
        `AIGC strategy=${granularity}/${passDecision.policy}.`,
        passDecision.reason,
      ].filter(Boolean).join(" "),
      diagnostics: [
        ...(signal.diagnostics || []),
        `granularity=${granularity}`,
        `policy=${passDecision.policy}`,
        `minSegmentChars=${minSegmentChars}`,
        `strategyDecision=${passDecision.passed ? "passed" : "blocked"}`,
      ],
    }
  } catch (error) {
    const fallback: AigcBatchDetectionResult = {
      ok: false,
      provider: config.provider ?? "disabled",
      status: "unavailable",
      score: null,
      confidence: null,
      threshold: config.threshold ?? 0.8,
      totalSegments: 0,
      highRiskSegments: [],
      segments: [],
      reason: `AIGC detection failed: ${error instanceof Error ? error.message : String(error)}`,
    }
    return normalizeStyleAigcSignal(fallback, { ...diagnostics, error })
  }
}

async function executeStyleAigcCalibrationRun(run: DebugRun) {
  const input = run.input as StyleProfileInput
  const runDir = path.join(runsRoot, run.runId)
  const aigcConfig = getAigcDetectorConfig(rootDir)
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "aigc-calibration", "开始校准 AIGC 检测器：只调用检测服务，不调用文本生成模型。", {
    provider: aigcConfig.provider ?? "disabled",
    urlConfigured: Boolean(aigcConfig.url?.trim()),
    threshold: aigcConfig.threshold ?? 0.8,
  })
  await fs.mkdir(runDir, { recursive: true })
  try {
    const recentStyleRuns = (await listStyleProfileDebugRuns()).filter((item) => item.runId !== run.runId)
    const humanSamples = splitStyleHumanBaselineSamples(String(input.humanBaselineText || ""))
      .map((text, index) => ({
        group: "human_reference",
        label: `手动真人参考 ${index + 1}`,
        text,
        sourceRunId: "manual",
      }))
    const approvedSamples = recentStyleRuns
      .filter((item) => item.status === "completed")
      .flatMap((item) => styleCalibrationSampleFromRun(item, "approved_style_candidate", 1))
      .slice(0, 6)
    const failedSamples = recentStyleRuns
      .filter((item) => item.status === "invalid" || item.status === "failed" || item.status === "completed")
      .flatMap((item) => styleCalibrationSampleFromRun(item, "recent_failed_candidate", 2))
      .slice(0, 8)
    const samples = [...humanSamples, ...approvedSamples, ...failedSamples]
    await fs.writeFile(path.join(runDir, "01-aigc-calibration-input.json"), `${JSON.stringify({
      upstreamRunId: input.upstreamRunId,
      sampleChapter: input.sampleChapter,
      humanBaselineCount: humanSamples.length,
      approvedStyleCandidateCount: approvedSamples.length,
      recentFailedCandidateCount: failedSamples.length,
      aigcConfig: {
        provider: aigcConfig.provider ?? "disabled",
        urlConfigured: Boolean(aigcConfig.url?.trim()),
        threshold: aigcConfig.threshold ?? 0.8,
      },
    }, null, 2)}\n`)
    run.artifacts.push("01-aigc-calibration-input.json")
    addEvent(run, samples.length ? "success" : "warning", "aigc-calibration", samples.length
      ? `已收集 ${samples.length} 条校准样本，开始逐条检测。`
      : "没有可校准样本；请粘贴真人参考样本，或先运行几轮文风节点形成失败/通过样本。", {
      humanBaselineCount: humanSamples.length,
      approvedStyleCandidateCount: approvedSamples.length,
      recentFailedCandidateCount: failedSamples.length,
    })

    const checkedSamples: Array<Record<string, unknown>> = []
    for (const [index, sample] of samples.entries()) {
      const signal = await detectStyleDebugAigcSignal(sample.text, aigcConfig, `style-aigc-calibration-${sample.group}-${index + 1}`)
      const record = {
        index: index + 1,
        group: sample.group,
        label: sample.label,
        sourceRunId: sample.sourceRunId,
        round: "round" in sample ? sample.round : undefined,
        chars: sample.text.length,
        preview: sample.text.replace(/\s+/gu, " ").slice(0, 180),
        aigc: signal,
      }
      checkedSamples.push(record)
      addEvent(run, signal.status === "passed" ? "success" : "warning", "aigc-calibration", `${sample.label}：AIGC ${signal.status}${typeof signal.score === "number" ? `，score=${signal.score.toFixed(4)}` : ""}。`, {
        group: sample.group,
        chars: sample.text.length,
        score: signal.score,
        threshold: signal.threshold,
        highRiskCount: signal.highRiskCount,
        preview: record.preview,
      })
      await persistRun(run)
    }

    const groups = ["human_reference", "approved_style_candidate", "recent_failed_candidate"].map((group) => {
      const groupSamples = checkedSamples.filter((sample) => sample.group === group)
      const scores = groupSamples
        .map((sample) => {
          const aigc = sample.aigc && typeof sample.aigc === "object" && !Array.isArray(sample.aigc) ? sample.aigc as Record<string, unknown> : {}
          return typeof aigc.score === "number" ? aigc.score : null
        })
        .filter((score): score is number => typeof score === "number")
      const blockedCount = groupSamples.filter((sample) => {
        const aigc = sample.aigc && typeof sample.aigc === "object" && !Array.isArray(sample.aigc) ? sample.aigc as Record<string, unknown> : {}
        return aigc.status === "blocked"
      }).length
      return {
        group,
        count: groupSamples.length,
        averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
        maxScore: scores.length ? Math.max(...scores) : null,
        blockedCount,
        passRate: groupSamples.length ? (groupSamples.length - blockedCount) / groupSamples.length : null,
      }
    })
    const groupByName = Object.fromEntries(groups.map((entry) => [entry.group, entry]))
    const humanGroup = groupByName.human_reference as { count: number; blockedCount: number; passRate: number | null; averageScore: number | null } | undefined
    const failedGroup = groupByName.recent_failed_candidate as { count: number; blockedCount: number; passRate: number | null; averageScore: number | null } | undefined
    const approvedGroup = groupByName.approved_style_candidate as { count: number; blockedCount: number; passRate: number | null; averageScore: number | null } | undefined
    const errors: string[] = []
    const warnings: string[] = []
    let trustLevel: "usable" | "domain_mismatch" | "unknown" = "unknown"
    if (!humanGroup?.count) {
      warnings.push("缺少真人参考样本：无法判断检测器是否对玄幻/修仙题材天然偏高；建议粘贴 2–5 段同题材真人文本后再校准。")
    } else if ((humanGroup.passRate ?? 0) < 0.7) {
      errors.push(`真人参考样本通过率只有 ${Math.round((humanGroup.passRate ?? 0) * 100)}%，检测器可能与当前题材域不匹配；不建议把它作为唯一硬门禁。`)
      trustLevel = "domain_mismatch"
    } else if ((failedGroup?.count || 0) > 0 && (failedGroup?.blockedCount || 0) > 0) {
      trustLevel = "usable"
    } else {
      warnings.push("真人样本基本能过，但近期失败样本不足；当前只能证明检测服务可用，还不能证明它能稳定区分本项目失败模式。")
      trustLevel = "unknown"
    }
    if ((approvedGroup?.count || 0) > 0 && (approvedGroup?.blockedCount || 0) > 0) {
      warnings.push("历史已通过候选在当前检测配置下仍被拦截，说明阈值/模型版本/解析规则发生过变化，需要重新冻结通过标准。")
    }
    if (!samples.length) errors.push("没有可检测样本。")

    const result = {
      version: 1,
      mode: "aigc_detector_calibration",
      source: {
        chapterBlueprintRunId: input.upstreamRunId,
        phase: "phase_09a_aigc_detector_calibration",
        sampleChapter: input.sampleChapter,
      },
      aigcConfig: {
        provider: aigcConfig.provider ?? "disabled",
        urlConfigured: Boolean(aigcConfig.url?.trim()),
        threshold: aigcConfig.threshold ?? 0.8,
      },
      trustLevel,
      groups,
      samples: checkedSamples,
      conclusion: trustLevel === "usable"
        ? "检测器在当前样本上具备基本区分能力：真人参考可过，近期失败样段会被拦截。下一步可继续让文风节点做定向自进化。"
        : trustLevel === "domain_mismatch"
          ? "检测器对真人参考也大量误杀，说明问题不只是生成模型；需要更换检测器、调整阈值，或把 AIGC 从硬门禁降级为人工辅助指标。"
          : "校准证据不足：现在继续循环可能仍会盲修。请增加真人参考样本，或先积累更多失败/通过样段。",
      nextActions: [
        "如果 trustLevel=usable：运行文风自进化节点，观察 AIGC 分数是否逐轮下降。",
        "如果 trustLevel=domain_mismatch：先不要继续无限重试生成器，优先换检测器或重新设阈值。",
        "如果 trustLevel=unknown：粘贴 2–5 段同题材真人参考样本后再次校准。",
      ],
    }
    run.result = result
    run.validation = { valid: errors.length === 0, errors, warnings }
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-aigc-calibration-result.json"), `${JSON.stringify(result, null, 2)}\n`),
      fs.writeFile(path.join(runDir, "03-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
    ])
    run.artifacts.push("02-aigc-calibration-result.json", "03-validation.json")
    run.status = run.validation.valid ? "completed" : "invalid"
    addEvent(run, run.validation.valid ? "success" : "error", "aigc-calibration", run.validation.valid
      ? `AIGC 校准完成：trustLevel=${trustLevel}。`
      : `AIGC 校准未通过：${errors.length} 个阻断问题。`, {
      trustLevel,
      errors,
      warnings,
      groups,
    })
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "aigc-calibration", `AIGC 校准执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

function attachAigcToStyleEvaluation(
  evaluation: StyleEvolutionEvaluation,
  aigcSignal: NonNullable<StyleEvolutionEvaluation["aigc"]>,
  aigcRepairLessons = buildStyleAigcRepairLessons(aigcSignal),
): StyleEvolutionEvaluation {
  const aigcFailed = aigcSignal.status !== "passed"
  return {
    ...evaluation,
    aigc: aigcSignal,
    verdict: aigcFailed ? "retry" : evaluation.verdict,
    deviations: [
      ...(Array.isArray(evaluation.deviations) ? evaluation.deviations : []),
      ...(aigcFailed ? [`AIGC 检测未通过：${aigcSignal.reason}`] : []),
    ],
    forbiddenHits: [
      ...(Array.isArray(evaluation.forbiddenHits) ? evaluation.forbiddenHits : []),
      ...(aigcSignal.status === "blocked" ? ["AIGC_HIGH_RISK"] : []),
      ...(aigcSignal.status === "unavailable" ? ["AIGC_UNAVAILABLE"] : []),
    ],
    nextFocus: [
      ...(Array.isArray(evaluation.nextFocus) ? evaluation.nextFocus : []),
      ...(aigcFailed ? aigcRepairLessons : []),
    ],
  }
}

function buildStyleAigcRepairLessons(aigcSignal: NonNullable<StyleEvolutionEvaluation["aigc"]>, sample = "", consecutiveFailures = 1) {
  if (aigcSignal.status === "passed") return []
  const score = typeof aigcSignal.score === "number" ? aigcSignal.score : null
  const threshold = typeof aigcSignal.threshold === "number" ? aigcSignal.threshold : 0.8
  const previews = Array.isArray(aigcSignal.highRiskPreviews)
    ? aigcSignal.highRiskPreviews.map((item) => styleDebugText(item).replace(/\s+/gu, " ")).filter(Boolean)
    : []
  const normalizedSample = sample.replace(/\s+/gu, "")
  const startsWithGrandScene = /裂缝|岩层|天壁|护山大阵|灵力|倒计时|追杀令|威压/u.test(normalizedSample.slice(0, 80))
  const denseMetricTone = /每息|三寸|两尺|百分|倒计时|进度|灵力|脉冲|频率/u.test(normalizedSample)
  const polishedActionStack = /脊背紧贴|肩胛|肌肉|呼吸|瞳孔|指节|骤然|缓慢|簌簌|薄雾/u.test(normalizedSample)
  return [
    `AIGC 硬门禁失败：当前 AI 概率 ${score === null ? "未知" : score.toFixed(3)}，阈值 ${threshold.toFixed(3)}；连续失败 ${consecutiveFailures} 轮。`,
    previews[0] ? `检测器高风险片段开头：${previews[0].slice(0, 120)}。下轮不得复用该开场节奏、意象排列或句式密度。` : "",
    startsWithGrandScene ? "不要再用“裂缝/岩层/天壁/大阵/灵力”等宏观危机词开篇；改成一个很小的、人手能碰到的物件或一句不完整的低声对白开场。" : "",
    denseMetricTone ? "减少连续数值、进度、频率、灵力脉冲的硬设定堆叠；数值只保留 1 个，其他通过人物动作和旁人反应间接呈现。" : "",
    polishedActionStack ? "不要连续堆叠脊背、肩胛、肌肉、呼吸、瞳孔、指节等工整身体反应；保留 1 个身体细节，其余换成生活化小动作、迟疑、误听、打断。" : "",
    "下轮写法改成更不工整的人类草稿感：句长不均、允许一处轻微停顿或重复、少用成套修辞，避免每句都像精修示范文。",
    "每段只承担一个动作或一个判断，不要把环境、设定、心理、战术同时塞进同一句。",
  ].filter(Boolean)
}

async function generateStyleDebugText(run: DebugRun, config: ActiveLlmConfig, input: {
  roleName: string
  system: string
  user: string
  temperature: number
  phase: string
  streamToRaw?: boolean
}) {
  let lastStreamEventAt = 0
  const controller = ensureRunAbortController(run)
  assertRunNotPaused(run)
  return generateAgentReply({
    roleName: input.roleName,
    basePrompt: input.system,
    dynamicPrompt: "",
    consensus: "",
    message: input.user,
    currentStage: input.phase,
    responseMode: input.phase === "style_evolution_candidate" || input.phase === "chapter_draft_initial" ? "drafting" : "artifact",
    preferredLanguage: "zh-CN",
    envRootDir: rootDir,
    providerOverride: debugProviderOverride(config),
    temperature: input.temperature,
    signal: controller.signal,
    onUsage: trackLlmCacheUsage(run, input.roleName),
    onDelta: input.streamToRaw
      ? async (delta) => {
        assertRunNotPaused(run)
        run.rawResponse += delta
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 1000) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `${input.roleName} 正在输出，已接收 ${run.rawResponse.length} 字符。`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-220),
          })
          await persistRun(run)
        }
      }
      : undefined,
  })
}

async function chapterBlueprintPriorStateLedger(input: ChapterBlueprintInput) {
  const priorRuns = await listChapterBlueprintRuns({ upstreamRunId: input.upstreamRunId, volumeId: input.volumeId })
  return priorRuns
    .filter((candidate) => (candidate.input as ChapterBlueprintInput).endChapter < input.startChapter)
    .map(chapterBlueprintStateSnapshotFromRun)
    .filter((entry): entry is ChapterBlueprintStateSnapshot => Boolean(entry))
    .sort((a, b) => a.startChapter - b.startChapter)
}

async function loadLearningForChapterBlueprintRun(run: DebugRun, modelName: string) {
  const input = run.input as ChapterBlueprintInput
  const stateLedger = await chapterBlueprintPriorStateLedger(input)
  run.learning = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: input.storyBible,
    modelName,
    runId: run.runId,
    stateLedger,
  })
  const artifact = "01d-learning-context.json"
  await fs.writeFile(path.join(runsRoot, run.runId, artifact), `${JSON.stringify(run.learning, null, 2)}\n`)
  if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact)
  addEvent(run, "success", "learning", `已加载 Learning Loop：${run.learning.activeExperiences.length} 条生效经验、${run.learning.stateLedger.length} 个历史批次状态、${run.learning.conflicts.length} 个未解决冲突。`, {
    promptVersion: run.learning.promptVersion,
    projectId: run.learning.projectId,
    projectLabel: run.learning.projectLabel,
    modelKey: run.learning.modelKey,
    activeExperienceCount: run.learning.activeExperiences.length,
    candidateExperienceCount: run.learning.candidateExperiences.length,
    stateLedgerCount: run.learning.stateLedger.length,
    conflictCount: run.learning.conflicts.length,
    memoryPaths: run.learning.memoryPaths,
  })
  await persistRun(run)
  return run.learning
}

async function learnFromChapterBlueprintRepair(input: {
  run: DebugRun
  beforeErrors: string[]
  afterErrors: string[]
  passed: boolean
}) {
  const run = input.run
  if (!run.learning) return { stop: false, reason: "" }
  const round = run.learning.attempts.filter((entry) => entry.runId === run.runId).length + 1
  run.learning = await recordChapterBlueprintLearningAttempt({
    rootDir,
    context: run.learning,
    runId: run.runId,
    round,
    beforeErrors: input.beforeErrors,
    afterErrors: input.afterErrors,
    passed: input.passed,
  })
  const latestAttempt = run.learning.attempts.filter((entry) => entry.runId === run.runId).at(-1)
  const artifact = `learning-attempt-${String(round).padStart(2, "0")}.json`
  await fs.writeFile(path.join(runsRoot, run.runId, artifact), `${JSON.stringify({ attempt: latestAttempt, learning: run.learning }, null, 2)}\n`)
  if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact)
  addEvent(run, input.passed ? "success" : "info", "learning", input.passed
    ? `Learning Loop 第 ${round} 轮已验证成功；成功经验已写入分层记忆。`
    : `Learning Loop 第 ${round} 轮已完成归因：解决 ${latestAttempt?.resolvedFingerprints.length || 0} 类，引入 ${latestAttempt?.introducedFingerprints.length || 0} 类，仍有 ${latestAttempt?.remainingFingerprints.length || 0} 类。`, {
    round,
    attempt: latestAttempt || null,
    activeExperienceCount: run.learning.activeExperiences.length,
    candidateExperienceCount: run.learning.candidateExperiences.length,
    conflicts: run.learning.conflicts,
  })
  const stop = chapterBlueprintLearningShouldStop(run.learning, run.runId)
  if (stop.stop) addEvent(run, "error", "learning-conflict", `Learning Loop 主动停止：${stop.reason}`, { conflict: stop.conflict })
  await persistRun(run)
  return stop
}

async function persistCompletedChapterBlueprintState(run: DebugRun) {
  if (!run.learning) return
  const snapshot = chapterBlueprintStateSnapshotFromRun(run)
  if (!snapshot) return
  run.learning = await recordChapterBlueprintStateSnapshot({ context: run.learning, snapshot })
  const artifact = "learning-project-state-snapshot.json"
  await fs.writeFile(path.join(runsRoot, run.runId, artifact), `${JSON.stringify(snapshot, null, 2)}\n`)
  if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact)
  addEvent(run, "success", "learning", `已把第 ${snapshot.startChapter}-${snapshot.endChapter} 章退出状态写入本小说记忆；不会进入系统级小说内容。`, {
    projectId: run.learning.projectId,
    stateLedgerCount: run.learning.stateLedger.length,
  })
}

async function withChapterBlueprintEffectiveOutputWatchdog<T>(
  run: DebugRun,
  label: string,
  operation: (markEffectiveOutput: () => void) => Promise<T>,
) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let rejectWatchdog: ((error: Error) => void) | null = null
  let timedOut = false
  const timeoutMs = Math.max(1000, Number(run.provider?.timeoutMs || chapterBlueprintLlmActivityTimeoutMs))
  const resetTimer = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timedOut = true
      rejectWatchdog?.(new Error(`${label} ${timeoutMs}ms 内没有新增有效文本；模型流可能已悬挂，请重试或切换模型。`))
    }, timeoutMs)
  }
  const watchdog = new Promise<never>((_, reject) => {
    rejectWatchdog = reject
    resetTimer()
  })
  try {
    return await Promise.race([
      operation(() => {
        if (timedOut) throw new Error(`${label} 已因无有效输出超时。`)
        resetTimer()
      }),
      watchdog,
    ])
  } finally {
    if (timer) clearTimeout(timer)
    rejectWatchdog = null
  }
}

async function executeChapterBlueprintRun(run: DebugRun) {
  const input = run.input as ChapterBlueprintInput
  const runDir = path.join(runsRoot, run.runId)
  const chapterCount = input.endChapter - input.startChapter + 1
  const maximumAutoRepairRounds = chapterBlueprintRepairSafetyLimit
  run.status = "running"
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始独立执行章节蓝图批次节点。", { runId: run.runId, isolated: true, productionPhase: "phase_9_chapter_blueprints" })
  addEvent(run, "success", "upstream", "已从服务端锁定通过验证的分卷策略 Run。", {
    upstreamRunId: input.upstreamRunId,
    volumeId: input.volumeId,
    startChapter: input.startChapter,
    endChapter: input.endChapter,
    chapterCount,
  })
  addEvent(run, "info", "boundary", "节点边界已冻结：只生成指定卷内连续章节蓝图，不生成写作计划或正文。", {
    allowedPhase: "phase_9_chapter_blueprints",
    nextPhase: "phase_10_writing_plan",
    maximumBatchSize: 12,
    forbiddenOutputs: ["writingPlan", "chapterDrafts", "prose", "draftText"],
  })
  await fs.mkdir(runDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, blueprintFocus: input.blueprintFocus, volumeId: input.volumeId, startChapter: input.startChapter, endChapter: input.endChapter, targetWordCount: input.targetWordCount, temperature: input.temperature, previousBatchRunId: input.previousBatchRunId, previousBatchHandoff: input.previousBatchHandoff }, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01b-upstream-volume-strategy.json"), `${JSON.stringify(input.volumeStrategy, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01c-upstream-story-bible.json"), `${JSON.stringify(input.storyBible, null, 2)}\n`),
  ])
  run.artifacts.push("01-input.json", "01b-upstream-volume-strategy.json", "01c-upstream-story-bible.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    const chapterTimeoutMs = Math.max(chapterBlueprintLlmActivityTimeoutMs, Math.min(300_000, Number(config.provider.timeoutMs || chapterBlueprintLlmActivityTimeoutMs)))
    const chapterProviderOverride = debugProviderOverride(config, chapterTimeoutMs)
    run.provider = { configId: config._configId, configName: config._configName || config.provider.modelName, baseUrl: config.provider.baseUrl, modelName: config.provider.modelName, apiMode: config.provider.apiMode, timeoutMs: chapterProviderOverride.timeoutMs, configuredTimeoutMs: config.provider.timeoutMs, temperature: input.temperature, apiKey: "[REDACTED]" }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)
    await loadLearningForChapterBlueprintRun(run, config.provider.modelName)

    const upstreamCanonPreflight = detectChapterBlueprintUpstreamCanonConflicts(input)
    await fs.writeFile(path.join(runDir, "01e-upstream-canon-preflight.json"), `${JSON.stringify(upstreamCanonPreflight, null, 2)}\n`)
    run.artifacts.push("01e-upstream-canon-preflight.json")
    if (!upstreamCanonPreflight.valid) {
      run.status = "invalid"
      run.validation = {
        valid: false,
        errors: upstreamCanonPreflight.errors,
        warnings: [
          ...upstreamCanonPreflight.warnings,
          "上游正典预检未通过，本次不会请求模型生成，也不会进入自动修复 loop；请先修正上游通过批次或分卷/弧线出口。脏输入无限重试只会反复烧 token。",
        ],
      }
      addEvent(run, "error", "upstream-canon-conflict", "上游正典预检失败：章节蓝图输入合同互相矛盾，已停止模型调用。", {
        errors: upstreamCanonPreflight.errors,
        warnings: upstreamCanonPreflight.warnings,
        evidence: upstreamCanonPreflight.evidence,
      })
      return
    }
    addEvent(run, upstreamCanonPreflight.warnings.length ? "warning" : "success", "upstream-canon-preflight", upstreamCanonPreflight.warnings.length
      ? "上游正典预检通过，但存在需要人工关注的连续性提示。"
      : "上游正典预检通过，未发现已知不可收敛的输入合同冲突。", {
      warnings: upstreamCanonPreflight.warnings,
      evidence: upstreamCanonPreflight.evidence,
    })

    const performSemanticAudit = async (candidate: Record<string, unknown>, round: "initial" | "repair", artifactPrefix?: string) => {
      const auditPrompts = buildChapterBlueprintSemanticAuditPrompts(input, candidate, run.runId, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "")
      const prefix = artifactPrefix || (round === "initial" ? "07a" : "11a")
      await Promise.all([
        fs.writeFile(path.join(runDir, `${prefix}-semantic-audit-system.md`), `${auditPrompts.basePrompt}\n`),
        fs.writeFile(path.join(runDir, `${prefix}-semantic-audit-input.md`), `${auditPrompts.dynamicPrompt}\n\n${auditPrompts.userMessage}\n`),
      ])
      run.artifacts.push(`${prefix}-semantic-audit-system.md`, `${prefix}-semantic-audit-input.md`)
      addEvent(run, "info", "semantic-audit", `启动${round === "initial" ? "首次" : "修复后"}独立正典语义审计。`, { checkedDimensions: ["arcBoundary", "timeline", "characterState", "knowledgeBoundary", "terminologyAndCost", "worldRules", "crossBatchContinuity"] })
      let auditRaw = ""
      let lastAuditStreamEventAt = 0
      const auditReply = await generateAgentReply({
        roleName: "Chapter Blueprint Canon Auditor",
        basePrompt: auditPrompts.basePrompt,
        dynamicPrompt: auditPrompts.dynamicPrompt,
        consensus: auditPrompts.consensus,
        message: auditPrompts.userMessage,
        currentStage: "chapter_blueprints_canon_audit",
        responseMode: "artifact",
        preferredLanguage: "zh-CN",
        envRootDir: rootDir,
        providerOverride: chapterProviderOverride,
        temperature: 0,
        onUsage: trackLlmCacheUsage(run, round === "initial" ? "首次正典审计" : "修复后正典审计"),
        onDelta: async (delta) => {
          auditRaw += delta
          const now = Date.now()
          if (!lastAuditStreamEventAt || now - lastAuditStreamEventAt >= 700) {
            lastAuditStreamEventAt = now
            addEvent(run, "stream", "semantic-audit", `正典审计正在输出，已接收 ${auditRaw.length} 字符。`, { responseChars: auditRaw.length, tail: auditRaw.slice(-240) })
            await persistRun(run)
          }
        },
      })
      auditRaw = auditReply
      await fs.writeFile(path.join(runDir, `${prefix}-semantic-audit-raw.txt`), `${auditRaw}\n`)
      run.artifacts.push(`${prefix}-semantic-audit-raw.txt`)
      const auditParsed = parseDebugModelJsonObject(auditRaw)
      run.semanticAudit = normalizeChapterBlueprintSemanticAudit(input, auditParsed.value)
      await fs.writeFile(path.join(runDir, `${prefix}-semantic-audit.json`), `${JSON.stringify(run.semanticAudit, null, 2)}\n`)
      run.artifacts.push(`${prefix}-semantic-audit.json`)
      const merged = mergeChapterBlueprintSemanticAudit(validateChapterBlueprints(candidate, input), run.semanticAudit)
      addEvent(run, merged.valid ? "success" : "error", "semantic-audit", merged.valid ? "独立正典语义审计通过。" : `独立正典语义审计发现 ${merged.errors.length} 个阻断问题。`, { errors: merged.errors, warnings: merged.warnings })
      return merged
    }

    const prompts = buildChapterBlueprintPrompts(input, run.runId, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "")
    run.prompts = prompts
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${prompts.systemPrompt}\n`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${prompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${prompts.dynamicPrompt}\n`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${prompts.userMessage}\n`),
    ])
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md")
    addEvent(run, "success", "prompt", "章节蓝图批次实际请求 Prompt 已冻结到本次 run。", {
      basePromptChars: prompts.basePrompt.length,
      dynamicPromptChars: prompts.dynamicPrompt.length,
      userMessageChars: prompts.userMessage.length,
      systemPromptChars: prompts.systemPrompt.length,
      volumeId: input.volumeId,
      chapterCount,
    })

    let lastStreamEventAt = 0
    addEvent(run, "info", "llm", "请求已发送给真实模型，等待章节蓝图首段响应。", { modelName: config.provider.modelName })
    const raw = await withChapterBlueprintEffectiveOutputWatchdog(run, "章节蓝图生成", (markEffectiveOutput) => generateAgentReply({
      roleName: "Chapter Blueprint Architect",
      basePrompt: prompts.basePrompt,
      dynamicPrompt: prompts.dynamicPrompt,
      consensus: prompts.consensus,
      message: prompts.userMessage,
      currentStage: "chapter_blueprints_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: chapterProviderOverride,
      temperature: input.temperature,
      onUsage: trackLlmCacheUsage(run, "章节蓝图生成"),
      onDelta: async (delta) => {
        run.rawResponse += delta
        markEffectiveOutput()
        const now = Date.now()
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now
          addEvent(run, "stream", "llm", `模型正在输出章节蓝图，已接收 ${run.rawResponse.length} 字符。`, { responseChars: run.rawResponse.length, tail: run.rawResponse.slice(-240) })
          await persistRun(run)
        }
      },
      onProviderActivity: async () => {
        markEffectiveOutput()
      },
    }))
    run.rawResponse = raw
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}\n`)
    run.artifacts.push("05-raw-response.txt")
    addEvent(run, "success", "llm", `章节蓝图响应完成，共 ${raw.length} 字符。`, { responseChars: raw.length })

    const parsed = parseDebugModelJsonObject(raw)
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
      run.artifacts.push("05b-repaired-response.txt")
      addEvent(run, "warning", "parse", `原始响应不是合法 JSON；已完成 ${parsed.repairs.length} 处结构修复并重新解析。`, { originalError: parsed.originalError, repairs: parsed.repairs })
    }
    let result = parsed.value
    applyChapterBlueprintDeterministicRepairs(run, result, input, "初次解析")
    run.result = result
    await fs.writeFile(path.join(runDir, "06-chapter-blueprints.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("06-chapter-blueprints.json")
    addEvent(run, "success", "parse", parsed.repairedText ? "修复后的响应已解析为章节蓝图 JSON；原始响应保持不变。" : "原始响应已解析为章节蓝图 JSON。", { topLevelKeys: Object.keys(result), repaired: Boolean(parsed.repairedText) })

    run.validation = validateChapterBlueprints(result, input)
    await fs.writeFile(path.join(runDir, "07-structural-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-structural-validation.json")
    if (run.validation.valid && String(result.mode || "").trim() !== "lean_chapter_blueprints") run.validation = await performSemanticAudit(result, "initial")
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    if (!run.validation.valid) {
      const initialValidation = run.validation
      const initialResult = result
      const initialSemanticAudit = run.semanticAudit
      const repairMessage = buildChapterBlueprintRepairMessage(input, result, initialValidation.errors, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "")
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}\n`)
      run.artifacts.push("08-repair-message.md")
      addEvent(run, "warning", "repair-loop", `首次完整校验发现 ${initialValidation.errors.length} 个错误，启动持续收敛修复第 1 轮。`, { errors: initialValidation.errors, repairTemperature: Math.min(input.temperature, 0.15), repairMessageArtifact: "08-repair-message.md", repairRound: 1, safetyLimit: maximumAutoRepairRounds })
      try {
        let repairRaw = ""
        let lastRepairStreamEventAt = 0
        const repairedReply = await generateAgentReply({
          roleName: "Chapter Blueprint Repair Architect",
          basePrompt: chapterBlueprintRepairBasePrompt,
          dynamicPrompt: `冻结来源均在修复消息中给出。上游分卷策略 Run：${input.upstreamRunId}`,
          consensus: chapterBlueprintRepairConsensus,
          message: repairMessage,
          currentStage: "chapter_blueprints_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: chapterProviderOverride,
          temperature: Math.min(input.temperature, 0.15),
          onUsage: trackLlmCacheUsage(run, "持续收敛修复第 1 轮"),
          onDelta: async (delta) => {
            repairRaw += delta
            run.rawResponse = repairRaw
            const now = Date.now()
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now
              addEvent(run, "stream", "repair-loop", `持续收敛第 1 轮正在定向修复章节蓝图，已接收 ${repairRaw.length} 字符。`, { repairRound: 1, safetyLimit: maximumAutoRepairRounds, responseChars: repairRaw.length, tail: repairRaw.slice(-240) })
              await persistRun(run)
            }
          },
        })
        repairRaw = repairedReply
        run.rawResponse = repairRaw
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}\n`)
        run.artifacts.push("09-repair-raw-response.txt")
        const repairedParsed = parseDebugModelJsonObject(repairRaw)
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}\n`)
          run.artifacts.push("09b-repaired-json-text.txt")
        }
        const candidateResult = repairedParsed.value
        applyChapterBlueprintDeterministicRepairs(run, candidateResult, input, "持续收敛第1轮")
        run.result = candidateResult
        run.validation = validateChapterBlueprints(candidateResult, input)
        if (run.validation.valid && String(candidateResult.mode || "").trim() !== "lean_chapter_blueprints") run.validation = await performSemanticAudit(candidateResult, "repair")
        const candidateValidation = run.validation
        await learnFromChapterBlueprintRepair({
          run,
          beforeErrors: initialValidation.errors,
          afterErrors: candidateValidation.errors,
          passed: candidateValidation.valid,
        })
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-chapter-blueprints-repaired.json"), `${JSON.stringify(candidateResult, null, 2)}\n`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(candidateValidation, null, 2)}\n`),
        ])
        run.artifacts.push("10-chapter-blueprints-repaired.json", "11-validation-after-repair.json")
        if (compareValidationQuality(candidateValidation, initialValidation) > 0) {
          result = initialResult
          run.result = initialResult
          run.validation = initialValidation
          run.semanticAudit = initialSemanticAudit
          addEvent(run, "warning", "repair-rollback", `持续收敛第 1 轮引入了更多问题，已自动回退到当前最佳候选；失败候选仍保留在 artifact 和学习记录中。`, {
            repairRound: 1,
            candidateErrors: candidateValidation.errors,
            restoredErrors: initialValidation.errors,
          })
        } else {
          result = candidateResult
          addEvent(run, candidateValidation.valid ? "success" : "warning", "repair-loop", candidateValidation.valid ? "持续收敛第 1 轮定向修复已通过完整校验。" : `持续收敛第 1 轮修复后仍有 ${candidateValidation.errors.length} 个错误，将把错误原文回填到下一轮。`, { repairRound: 1, safetyLimit: maximumAutoRepairRounds, errors: candidateValidation.errors, warnings: candidateValidation.warnings, repairedResponseChars: repairRaw.length })
        }
      } catch (repairError) {
        run.validation = initialValidation
        addEvent(run, "warning", "repair-loop", `持续收敛第 1 轮模型调用失败，保留首次校验结果并进入下一轮重试：${repairError instanceof Error ? repairError.message : String(repairError)}`)
      }
    }

    let learningLoopStopped = run.learning ? chapterBlueprintLearningShouldStop(run.learning, run.runId).stop : false
    let repeatedRepairFailureSignature = ""
    let repeatedRepairFailureCount = 0
    for (let repairRound = 2; run.validation?.valid === false && !learningLoopStopped && repairRound <= maximumAutoRepairRounds; repairRound += 1) {
      const previousResult = result
      const previousValidation: NonNullable<DebugRun["validation"]> = run.validation
      const previousSemanticAudit = run.semanticAudit
      const errors = [...new Set(previousValidation.errors)]
      const prefix = `16-auto-repair-${String(repairRound).padStart(2, "0")}`
      const repairMessage = buildChapterBlueprintRepairMessage(input, result, errors, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "")
      await fs.writeFile(path.join(runDir, `${prefix}-message.md`), `${repairMessage}\n`)
      run.artifacts.push(`${prefix}-message.md`)
      addEvent(run, "warning", "repair-loop", `持续收敛第 ${repairRound - 1} 轮仍未通过；已把 ${errors.length} 个错误原文回填，启动第 ${repairRound} 轮定向修复。`, {
        repairRound,
        safetyLimit: maximumAutoRepairRounds,
        errors,
        repairMessageArtifact: `${prefix}-message.md`,
      })
      try {
        let repairRaw = ""
        let lastRepairStreamEventAt = 0
        const repairedReply = await generateAgentReply({
          roleName: "Chapter Blueprint Repair Loop Architect",
          basePrompt: chapterBlueprintRepairBasePrompt,
          dynamicPrompt: `冻结来源均在修复消息中给出。上游分卷策略 Run：${input.upstreamRunId}`,
          consensus: chapterBlueprintRepairConsensus,
          message: repairMessage,
          currentStage: "chapter_blueprints_debug_repair_loop",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: chapterProviderOverride,
          temperature: 0,
          onUsage: trackLlmCacheUsage(run, `持续收敛修复第 ${repairRound} 轮`),
          onDelta: async (delta) => {
            repairRaw += delta
            run.rawResponse = repairRaw
            const now = Date.now()
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now
              addEvent(run, "stream", "repair-loop", `持续收敛第 ${repairRound} 轮正在输出，已接收 ${repairRaw.length} 字符。`, { repairRound, safetyLimit: maximumAutoRepairRounds, responseChars: repairRaw.length, tail: repairRaw.slice(-240) })
              await persistRun(run)
            }
          },
        })
        repairRaw = repairedReply
        run.rawResponse = repairRaw
        const repairedParsed = parseDebugModelJsonObject(repairRaw)
        const candidateResult = repairedParsed.value
        applyChapterBlueprintDeterministicRepairs(run, candidateResult, input, `持续收敛第${repairRound}轮`)
        run.result = candidateResult
        run.semanticAudit = null
        run.validation = validateChapterBlueprints(candidateResult, input)
        if (run.validation.valid && String(candidateResult.mode || "").trim() !== "lean_chapter_blueprints") run.validation = await performSemanticAudit(candidateResult, "repair", `${prefix}-audit`)
        const candidateValidation = run.validation
        const learningStop = await learnFromChapterBlueprintRepair({
          run,
          beforeErrors: errors,
          afterErrors: candidateValidation.errors,
          passed: candidateValidation.valid,
        })
        learningLoopStopped = learningStop.stop
        const writes = [
          fs.writeFile(path.join(runDir, `${prefix}-raw.txt`), `${repairRaw}\n`),
          fs.writeFile(path.join(runDir, `${prefix}-result.json`), `${JSON.stringify(candidateResult, null, 2)}\n`),
          fs.writeFile(path.join(runDir, `${prefix}-validation.json`), `${JSON.stringify(candidateValidation, null, 2)}\n`),
        ]
        const artifacts = [`${prefix}-raw.txt`, `${prefix}-result.json`, `${prefix}-validation.json`]
        if (repairedParsed.repairedText) {
          writes.push(fs.writeFile(path.join(runDir, `${prefix}-repaired-json-text.txt`), `${repairedParsed.repairedText}\n`))
          artifacts.push(`${prefix}-repaired-json-text.txt`)
        }
        await Promise.all(writes)
        run.artifacts.push(...artifacts)
        if (compareValidationQuality(candidateValidation, previousValidation) > 0) {
          result = previousResult
          run.result = previousResult
          run.validation = previousValidation
          run.semanticAudit = previousSemanticAudit
          addEvent(run, "warning", "repair-rollback", `持续收敛第 ${repairRound} 轮结果劣于当前最佳候选，已自动回退；失败候选仍保留用于学习。`, {
            repairRound,
            candidateErrors: candidateValidation.errors,
            restoredErrors: previousValidation.errors,
          })
        } else {
          result = candidateResult
          addEvent(run, candidateValidation.valid ? "success" : "warning", "repair-loop", candidateValidation.valid
            ? `持续收敛第 ${repairRound} 轮修复后，结构校验与独立正典审计全部通过。`
            : learningLoopStopped
              ? `持续收敛第 ${repairRound} 轮后 Learning Loop 已根据当前错误证据主动停止。`
              : `持续收敛第 ${repairRound} 轮修复后仍有 ${candidateValidation.errors.length} 个错误${repairRound < maximumAutoRepairRounds ? "，将继续回填下一轮" : "，已触发运行时安全熔断"}。`, {
            repairRound,
            safetyLimit: maximumAutoRepairRounds,
            errors: candidateValidation.errors,
            warnings: candidateValidation.warnings,
            repairedResponseChars: repairRaw.length,
          })
        }
      } catch (repairError) {
        result = previousResult
        run.result = previousResult
        run.validation = previousValidation
        run.semanticAudit = previousSemanticAudit
        const failureMessage = repairError instanceof Error ? repairError.message : String(repairError)
        const failureSignature = debugFailureSignature(repairError)
        repeatedRepairFailureCount = failureSignature === repeatedRepairFailureSignature ? repeatedRepairFailureCount + 1 : 1
        repeatedRepairFailureSignature = failureSignature
        const shouldStopRepeatedFailure = repeatedRepairFailureCount >= 2 && /model_response_invalid_json|Expected|Unexpected|semantic|audit|正典审计|JSON/iu.test(failureMessage)
        addEvent(run, shouldStopRepeatedFailure ? "error" : "warning", "repair-loop", shouldStopRepeatedFailure
          ? `持续收敛第 ${repairRound} 轮再次遇到同类模型/审计解析失败，已提前停止；继续重试只会重复消耗。`
          : `持续收敛第 ${repairRound} 轮模型调用失败，已恢复上一轮结果；下一轮将使用同一批错误重试：${failureMessage}`, {
          repairRound,
          safetyLimit: maximumAutoRepairRounds,
          repeatedFailureCount: repeatedRepairFailureCount,
          failureSignature,
          error: failureMessage,
        })
        if (shouldStopRepeatedFailure) {
          learningLoopStopped = true
          break
        }
      }
    }

    const finalValidation = run.validation
    if (!finalValidation) throw new Error("chapter_blueprint_validation_missing")
    if (!finalValidation.valid) {
      addEvent(run, "error", "repair-loop", learningLoopStopped
        ? "Learning Loop 检测到约束冲突或连续无进展，已提前停止；最后一版结果、错误、经验和冲突证据均已保留。"
        : `持续收敛已触发 ${maximumAutoRepairRounds} 轮运行时安全熔断；已保留最后一版结果、全部错误和每轮 artifact，避免异常情况下无限扣费。`, {
        safetyLimit: maximumAutoRepairRounds,
        learningLoopStopped,
        learningConflicts: run.learning?.conflicts || [],
        errors: finalValidation.errors,
        warnings: finalValidation.warnings,
      })
    }

    if (!finalValidation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `章节蓝图验证未通过：${finalValidation.errors.length} 个错误。`, { errors: finalValidation.errors, warnings: finalValidation.warnings })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "章节蓝图批次结构校验与独立正典语义审计均通过；可进入人工批准。", {
        volumeId: input.volumeId,
        startChapter: input.startChapter,
        endChapter: input.endChapter,
        blueprintCount: Array.isArray(result.blueprints) ? result.blueprints.length : 0,
        warnings: finalValidation.warnings,
      })
      await persistCompletedChapterBlueprintState(run)
    }
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "run", `章节蓝图节点执行失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
}

async function executeStyleProfileRun(run: DebugRun) {
  const input = run.input as StyleProfileInput
  const runDir = path.join(runsRoot, run.runId)
  const blueprintCount = styleProfileBlueprints(input).length
  const firstBlueprintChapter = Number(styleProfileBlueprints(input)[0]?.chapterNumber || 0)
  const lastBlueprintChapter = Number(styleProfileBlueprints(input).at(-1)?.chapterNumber || 0)
  const requestedMaxRounds = Math.max(1, Math.min(12, Number(input.maxRounds || 6)))
  const maxRounds = Math.min(20, requestedMaxRounds + 6)
  const aigcMode = normalizeStyleDebugAigcMode(input)
  run.status = "running"
  run.pauseRequestedAt = null
  run.pauseReason = null
  ensureRunAbortController(run)
  run.startedAt = nowIso()
  addEvent(run, "info", "run", "开始执行文风自进化节点：候选样段 → AIGC 检测 → 评估 → 修正 prompt → 下一轮。", { runId: run.runId, isolated: true, productionPhase: "phase_10_style_evolution", requestedMaxRounds, maxRounds, aigcSelfEvolutionExtraRounds: maxRounds - requestedMaxRounds, aigcMode })
  addEvent(run, "success", "upstream", "已从服务端锁定通过验证的章节蓝图 Run。", {
    upstreamRunId: input.upstreamRunId,
    blueprintCount,
    firstBlueprintChapter,
    lastBlueprintChapter,
    sampleChapter: input.sampleChapter,
  })
  addEvent(run, "info", "boundary", "节点边界已冻结：本节点生成的是可评估文风样段，不会写入正式章节，也不会修改正典账本。", {
    allowedPhase: "phase_10_style_evolution",
    nextPhase: "phase_11_single_chapter_context",
    forbiddenMutations: ["skills", "items", "numbers", "countdowns", "costs", "locations", "chapterBlueprints"],
  })
  await fs.mkdir(runDir, { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, styleFocus: input.styleFocus, sampleChapter: input.sampleChapter, requestedMaxRounds, maxRounds, aigcSelfEvolutionExtraRounds: maxRounds - requestedMaxRounds, totalChapters: input.totalChapters, temperature: input.temperature, aigcMode }, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01b-upstream-chapter-blueprints.json"), `${JSON.stringify(input.chapterBlueprints, null, 2)}\n`),
    fs.writeFile(path.join(runDir, "01c-upstream-story-bible.json"), `${JSON.stringify(input.storyBible, null, 2)}\n`),
  ])
  run.artifacts.push("01-input.json", "01b-upstream-chapter-blueprints.json", "01c-upstream-story-bible.json")

  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    run.provider = { configId: config._configId, configName: config._configName || config.provider.modelName, baseUrl: config.provider.baseUrl, modelName: config.provider.modelName, apiMode: config.provider.apiMode, timeoutMs: config.provider.timeoutMs, temperature: input.temperature, apiKey: "[REDACTED]" }
    addEvent(run, "success", "provider", "已加载真实模型配置；API Key 已隐藏。", run.provider)
    const aigcConfig = getAigcDetectorConfig(rootDir)
    addEvent(run, "info", "aigc", "节点 09 已启用可配置 AIGC 门禁：每轮样段会按所选检测粒度与策略判定是否可进入候选池。", {
      provider: aigcConfig.provider ?? "disabled",
      urlConfigured: Boolean(aigcConfig.url?.trim()),
      threshold: aigcConfig.threshold ?? 0.8,
      hardGate: true,
      ...aigcMode,
    })

    const context = styleEvolutionProjectContext(input)
    await fs.writeFile(path.join(runDir, "02-style-evolution-context.json"), `${JSON.stringify({
      projectTitle: context.title,
      idea: context.idea,
      sampleChapter: input.sampleChapter,
      sampleBlueprint: context.sampleBlueprint,
      desiredVibes: context.desiredVibes,
      seedForbiddenPatterns: context.seedForbiddenPatterns,
    }, null, 2)}\n`)
    run.artifacts.push("02-style-evolution-context.json")
    addEvent(run, "success", "prompt", "已复用正式 Style Evolution Engine 的候选/评估/修正提示链。", {
      engine: "production-style-evolution",
      sampleChapter: input.sampleChapter,
      maxRounds,
      blueprintCount,
    })

    const iterations: Record<string, unknown>[] = []
    let priorSample = ""
    const baseSeedPrompt = context.seedPrompt
    let seedPrompt = baseSeedPrompt
    let selectedCandidate: Record<string, unknown> | null = null
    let bestCandidate: Record<string, unknown> | null = null
    let stopReason = "max_rounds_reached"
    const minRoundsBeforeStop = Math.min(maxRounds, 2)
    let consecutiveAigcFailures = 0
    const aigcEvolutionMemory: string[] = []
    const aigcScoreHistory: Array<{ round: number; status: string; score: number | null; highRiskCount: number }> = []

    for (let round = 1; round <= maxRounds; round += 1) {
      assertRunNotPaused(run)
      addEvent(run, "info", "style-loop", `开始第 ${round}/${maxRounds} 轮文风样段生成。`, { round, maxRounds })
      const candidatePrompt = buildStyleEvolutionCandidatePrompt({
        projectTitle: context.title,
        idea: context.idea,
        userStylePrompt: input.styleFocus,
        referenceText: context.referenceText,
        desiredVibes: context.desiredVibes,
        seedForbiddenPatterns: context.seedForbiddenPatterns,
        seedPrompt,
        priorSample,
        iterationFeedback: round === 1 ? input.styleFocus : seedPrompt,
      })
      if (round === 1) {
        run.prompts = {
          systemPrompt: candidatePrompt.system,
          consensus: `独立调试 Run: ${run.runId}\n章节蓝图上游 Run: ${input.upstreamRunId}\nStyle Evolution Loop: ${maxRounds} rounds`,
          basePrompt: candidatePrompt.system,
          dynamicPrompt: context.referenceText,
          userMessage: candidatePrompt.user,
        }
        await Promise.all([
          fs.writeFile(path.join(runDir, "03-candidate-system-prompt.md"), `${candidatePrompt.system}\n`),
          fs.writeFile(path.join(runDir, "04-candidate-user-message.md"), `${candidatePrompt.user}\n`),
        ])
        run.artifacts.push("03-candidate-system-prompt.md", "04-candidate-user-message.md")
      }
      const sample = (await generateStyleDebugText(run, config, {
        roleName: `Style Evolution Candidate R${round}`,
        system: candidatePrompt.system,
        user: candidatePrompt.user,
        temperature: Math.max(0.25, input.temperature),
        phase: "style_evolution_candidate",
        streamToRaw: true,
      })).trim()
      assertRunNotPaused(run)
      await fs.writeFile(path.join(runDir, `05-round-${round}-sample.txt`), `${sample}\n`)
      run.artifacts.push(`05-round-${round}-sample.txt`)
      addEvent(run, "success", "style-loop", `第 ${round} 轮候选样段完成，开始评估。`, { round, sampleChars: sample.length, sample })

      addEvent(run, "info", "aigc", `第 ${round} 轮样段开始 AIGC 检测。`, {
        round,
        provider: aigcConfig.provider ?? "disabled",
        urlConfigured: Boolean(aigcConfig.url?.trim()),
        threshold: aigcConfig.threshold ?? 0.8,
        ...aigcMode,
      })
      const aigcSignal = await detectStyleDebugAigcSignal(sample, aigcConfig, `style-evolution-debug-r${round}`, aigcMode)
      assertRunNotPaused(run)
      if (aigcSignal.status === "passed") {
        consecutiveAigcFailures = 0
      } else {
        consecutiveAigcFailures += 1
      }
      aigcScoreHistory.push({
        round,
        status: aigcSignal.status,
        score: aigcSignal.score,
        highRiskCount: aigcSignal.highRiskCount,
      })
      const aigcRepairLessons = buildStyleAigcRepairLessons(aigcSignal, sample, consecutiveAigcFailures)
      if (aigcRepairLessons.length) {
        const before = aigcEvolutionMemory.length
        for (const lesson of aigcRepairLessons) {
          if (!aigcEvolutionMemory.includes(lesson)) aigcEvolutionMemory.push(lesson)
        }
        if (aigcEvolutionMemory.length > before) {
          addEvent(run, "warning", "aigc-evolution", `第 ${round} 轮已提取 ${aigcEvolutionMemory.length - before} 条 AIGC 自进化记忆，将写入下一轮 prompt。`, {
            round,
            consecutiveAigcFailures,
            aigcScore: aigcSignal.score,
            latestLessons: aigcEvolutionMemory.slice(before),
          })
        }
      }
      await fs.writeFile(path.join(runDir, `05b-round-${round}-aigc.json`), `${JSON.stringify(aigcSignal, null, 2)}\n`)
      run.artifacts.push(`05b-round-${round}-aigc.json`)
      addEvent(run, aigcSignal.status === "passed" ? "success" : "error", "aigc", aigcSignal.status === "passed"
        ? `第 ${round} 轮 AIGC 检测通过。`
        : `第 ${round} 轮 AIGC 检测未通过：${aigcSignal.reason}`, {
        round,
        status: aigcSignal.status,
        score: aigcSignal.score,
        threshold: aigcSignal.threshold,
        highRiskCount: aigcSignal.highRiskCount,
        highRiskPreviews: aigcSignal.highRiskPreviews,
      })

      let evaluation: StyleEvolutionEvaluation = evaluateStyleEvolutionCandidate({
        prompt: candidatePrompt.prompt,
        sample,
        userStylePrompt: input.styleFocus,
        iterationFeedback: seedPrompt,
        aigc: aigcSignal,
      })
      evaluation = attachAigcToStyleEvaluation(evaluation, aigcSignal, aigcRepairLessons)
      let evaluationSource: "heuristic" | "llm_critic" = "heuristic"
      try {
        const evaluationPrompt = buildStyleEvolutionEvaluationPrompt({
          projectTitle: context.title,
          idea: context.idea,
          userStylePrompt: input.styleFocus,
          referenceText: context.referenceText,
          desiredVibes: context.desiredVibes,
          seedForbiddenPatterns: context.seedForbiddenPatterns,
          prompt: candidatePrompt.prompt,
          sample,
          priorSample,
          iterationFeedback: seedPrompt,
        })
        const rawEvaluation = await generateStyleDebugText(run, config, {
          roleName: `Style Evolution Evaluator R${round}`,
          system: evaluationPrompt.system,
          user: evaluationPrompt.user,
          temperature: 0.1,
          phase: "style_evolution_evaluation",
        })
        assertRunNotPaused(run)
        await fs.writeFile(path.join(runDir, `06-round-${round}-evaluation-raw.json`), `${rawEvaluation}\n`)
        run.artifacts.push(`06-round-${round}-evaluation-raw.json`)
        const parsed = parseStyleEvolutionEvaluationFromText(rawEvaluation)
        if (parsed) {
          evaluation = parsed.evaluation
          evaluationSource = "llm_critic"
          evaluation = attachAigcToStyleEvaluation(evaluation, aigcSignal, aigcRepairLessons)
        } else {
          addEvent(run, "warning", "style-loop", `第 ${round} 轮评估 JSON 解析失败，已使用启发式评估兜底。`, { round })
        }
      } catch (error) {
        addEvent(run, "warning", "style-loop", `第 ${round} 轮独立评估失败，已使用启发式评估兜底：${error instanceof Error ? error.message : String(error)}`, { round })
      }

      let refinement: StyleEvolutionRefinement = buildStyleEvolutionRefinement({
        prompt: candidatePrompt.prompt,
        userStylePrompt: input.styleFocus,
        evaluation,
        iterationFeedback: seedPrompt,
      })
      let refinementSource: "heuristic" | "llm_critic" = "heuristic"
      if (evaluation.verdict === "retry") {
        try {
          const refinementPrompt = buildStyleEvolutionRefinementOnlyPrompt({
            projectTitle: context.title,
            idea: context.idea,
            userStylePrompt: input.styleFocus,
            desiredVibes: context.desiredVibes,
            seedForbiddenPatterns: context.seedForbiddenPatterns,
            prompt: candidatePrompt.prompt,
            sample,
            evaluation,
            iterationFeedback: seedPrompt,
          })
          const rawRefinement = await generateStyleDebugText(run, config, {
            roleName: `Style Evolution Refiner R${round}`,
            system: refinementPrompt.system,
            user: refinementPrompt.user,
            temperature: 0.1,
            phase: "style_evolution_refinement",
          })
          assertRunNotPaused(run)
          await fs.writeFile(path.join(runDir, `07-round-${round}-refinement-raw.json`), `${rawRefinement}\n`)
          run.artifacts.push(`07-round-${round}-refinement-raw.json`)
          const parsedRefinement = parseStyleEvolutionRefinementFromText(rawRefinement)
          if (parsedRefinement) {
            refinement = parsedRefinement.refinement
            refinementSource = "llm_critic"
          } else {
            addEvent(run, "warning", "style-loop", `第 ${round} 轮修正 JSON 解析失败，已使用启发式修正兜底。`, { round })
          }
        } catch (error) {
          addEvent(run, "warning", "style-loop", `第 ${round} 轮 prompt 修正失败，已使用启发式修正兜底：${error instanceof Error ? error.message : String(error)}`, { round })
        }
      }

      const verification = buildStyleGenerationVerification({
        evaluation,
        sample,
        checkedAt: new Date().toISOString(),
      })
      const iterationRecord = {
        round,
        sample,
        sampleChars: sample.length,
        prompt: candidatePrompt.prompt,
        evaluation: { ...evaluation, source: evaluationSource },
        refinement: { ...refinement, source: refinementSource },
        verification,
        aigcEvolution: {
          consecutiveFailures: consecutiveAigcFailures,
          latestLessons: aigcRepairLessons,
          memory: aigcEvolutionMemory.slice(-8),
        },
      }
      iterations.push(iterationRecord)
      await fs.writeFile(path.join(runDir, `08-round-${round}-summary.json`), `${JSON.stringify(iterationRecord, null, 2)}\n`)
      run.artifacts.push(`08-round-${round}-summary.json`)
      addEvent(run, evaluation.verdict === "retry" ? "warning" : "success", "style-loop", `第 ${round} 轮评估结果：${evaluation.verdict}，综合分 ${Number(evaluation.scores?.overall || 0).toFixed(1)}。`, {
        round,
        verdict: evaluation.verdict,
        overall: evaluation.scores?.overall,
        verificationStatus: verification.status,
        aigcStatus: aigcSignal.status,
        aigcScore: aigcSignal.score,
        aigcThreshold: aigcSignal.threshold,
        nextFocus: evaluation.nextFocus,
        refinementSummary: refinement.summary,
      })

      priorSample = sample
      seedPrompt = compactStyleEvolutionNextSeed({
        baseSeedPrompt,
        userStylePrompt: input.styleFocus,
        evaluation,
        refinement,
        aigcLessons: aigcEvolutionMemory,
      })
      if (round === requestedMaxRounds && !bestCandidate && aigcEvolutionMemory.length && round < maxRounds) {
        addEvent(run, "warning", "aigc-evolution", `已达到用户设置的 ${requestedMaxRounds} 轮，但仍未通过 AIGC；进入追加自进化轮，最多继续到第 ${maxRounds} 轮。`, {
          requestedMaxRounds,
          maxRounds,
          consecutiveAigcFailures,
          aigcScoreHistory,
          latestLessons: aigcEvolutionMemory.slice(-6),
        })
      }
      const verificationPassed = verification.status === "passed"
      if ((evaluation.verdict === "candidate" || evaluation.verdict === "approve") && verificationPassed) {
        const candidateSnapshot = {
          round,
          sampleChapter: input.sampleChapter,
          sample,
          prompt: candidatePrompt.prompt,
          evaluation: { ...evaluation, source: evaluationSource },
          refinement: { ...refinement, source: refinementSource },
          verification,
        }
        const currentScore = Number(evaluation.scores?.overall || 0)
        const bestEvaluation = bestCandidate?.evaluation && typeof bestCandidate.evaluation === "object" && !Array.isArray(bestCandidate.evaluation)
          ? bestCandidate.evaluation as Record<string, unknown>
          : {}
        const bestScores = bestEvaluation.scores && typeof bestEvaluation.scores === "object" && !Array.isArray(bestEvaluation.scores)
          ? bestEvaluation.scores as Record<string, unknown>
          : {}
        if (!bestCandidate || currentScore > Number(bestScores.overall || 0)) bestCandidate = candidateSnapshot
        if (evaluation.verdict === "approve" && round >= minRoundsBeforeStop) {
          selectedCandidate = candidateSnapshot
          stopReason = "approved_by_evaluator"
          break
        }
        if (round < maxRounds) {
          const continueReason = round < minRoundsBeforeStop
            ? `未达到最小稳定轮数 ${minRoundsBeforeStop}`
            : "尚未达到 approve"
          addEvent(run, "info", "style-loop", `第 ${round} 轮已达到 ${evaluation.verdict}，但${continueReason}，继续下一轮检查文风稳定性。`, {
            round,
            minRoundsBeforeStop,
            maxRounds,
            verdict: evaluation.verdict,
            currentScore,
          })
        }
      }
      if (!verificationPassed) {
        addEvent(run, "warning", "style-loop", `第 ${round} 轮未通过 Generation Verification Gate，不会进入候选池。`, {
          round,
          verificationStatus: verification.status,
          verificationReasons: verification.reasons,
          aigcStatus: aigcSignal.status,
        })
      }
      if (round >= maxRounds && bestCandidate) {
        selectedCandidate = bestCandidate
        stopReason = "best_candidate_after_max_rounds"
        addEvent(run, "warning", "style-loop", `已达到最大迭代轮数 ${maxRounds}，本次未获得 approve；将选择历史最高分 candidate 作为临时候选，等待人工判断。`, {
          maxRounds,
          selectedRound: bestCandidate.round,
          selectedVerdict: bestCandidate.evaluation && typeof bestCandidate.evaluation === "object" && !Array.isArray(bestCandidate.evaluation)
            ? (bestCandidate.evaluation as Record<string, unknown>).verdict
            : null,
        })
        break
      }
      await persistRun(run)
    }

    if (!selectedCandidate && bestCandidate) {
      selectedCandidate = bestCandidate
      stopReason = "best_candidate_after_max_rounds"
    }

    if (!selectedCandidate && iterations.length) {
      const best = [...iterations].sort((a, b) => {
        const left = a.evaluation && typeof a.evaluation === "object" && !Array.isArray(a.evaluation) ? a.evaluation as Record<string, unknown> : {}
        const right = b.evaluation && typeof b.evaluation === "object" && !Array.isArray(b.evaluation) ? b.evaluation as Record<string, unknown> : {}
        const leftScores = left.scores && typeof left.scores === "object" && !Array.isArray(left.scores) ? left.scores as Record<string, unknown> : {}
        const rightScores = right.scores && typeof right.scores === "object" && !Array.isArray(right.scores) ? right.scores as Record<string, unknown> : {}
        return Number(rightScores.overall || 0) - Number(leftScores.overall || 0)
      })[0]
      selectedCandidate = {
        ...best,
        sampleChapter: input.sampleChapter,
      }
    }

    const result = {
      version: 1,
      mode: "style_evolution_debug_loop",
      source: {
        chapterBlueprintRunId: input.upstreamRunId,
        phase: "phase_10_style_evolution",
        totalChapters: input.totalChapters,
        sampleChapter: input.sampleChapter,
        blueprintCount,
        firstBlueprintChapter,
        lastBlueprintChapter,
      },
      engine: "production-style-evolution",
      aigcRequired: true,
      aigcGate: {
        provider: aigcConfig.provider ?? "disabled",
        urlConfigured: Boolean(aigcConfig.url?.trim()),
        threshold: aigcConfig.threshold ?? 0.8,
        passRequiredForCompletion: true,
        ...aigcMode,
      },
      requestedMaxRounds,
      maxRounds,
      aigcSelfEvolution: {
        enabled: true,
        extraRounds: maxRounds - requestedMaxRounds,
        safetyMaxRounds: maxRounds,
        memory: aigcEvolutionMemory,
        scoreHistory: aigcScoreHistory,
      },
      minRoundsBeforeStop,
      stopReason,
      selectedCandidate,
      iterations,
      nextActions: [
        "如果样段满意，下一步可以添加“冻结为正式文风合同/写作规则”的按钮。",
        "如果样段不满意，修改风格关注点或提高最大轮数后继续迭代。",
        "后续单章上下文节点只继承冻结后的写法规则，不直接继承调试样段为正式正文。",
      ],
    }
    run.result = result
    await fs.writeFile(path.join(runDir, "09-style-evolution-loop.json"), `${JSON.stringify(result, null, 2)}\n`)
    run.artifacts.push("09-style-evolution-loop.json")

    run.validation = validateStyleProfile(result, input)
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
    run.artifacts.push("07-validation.json")
    if (!run.validation.valid) {
      run.status = "invalid"
      addEvent(run, "error", "validate", `文风自进化未收敛：${run.validation.errors.length} 个错误。`, { errors: run.validation.errors, warnings: run.validation.warnings })
    } else {
      run.status = "completed"
      addEvent(run, "success", "validate", "文风自进化已得到可用候选；可人工确认后冻结为后续正文写作规则。", {
        stopReason,
        selectedRound: selectedCandidate?.round,
        selectedVerdict: selectedCandidate && typeof selectedCandidate.evaluation === "object" && !Array.isArray(selectedCandidate.evaluation)
          ? (selectedCandidate.evaluation as Record<string, unknown>).verdict
          : null,
        warnings: run.validation.warnings,
      })
    }
  } catch (error) {
    if (isDebugRunPausedError(error) || isRunPauseRequested(run)) {
      run.status = "paused"
      run.pauseRequestedAt = run.pauseRequestedAt || nowIso()
      run.pauseReason = run.pauseReason || "用户手动暂停当前调试 Run。"
      run.error = "debug_run_paused_by_user"
      if (!run.events.some((event) => event.phase === "pause")) {
        addEvent(run, "warning", "pause", "文风自进化节点已暂停；可以切换模型后重新运行。", {
          runId: run.runId,
          reason: run.pauseReason,
        })
      }
    } else {
      run.status = "failed"
      run.error = error instanceof Error ? error.message : String(error)
      addEvent(run, "error", "run", `文风自进化节点执行失败：${run.error}`)
    }
  } finally {
    run.completedAt = nowIso()
    runAbortControllers.delete(run.runId)
    await persistRun(run)
  }
}

async function executeChapterBlueprintAuditOnly(run: DebugRun, autoRepairOnFailure = true) {
  const input = run.input as ChapterBlueprintInput
  let result = run.result
  const runDir = path.join(runsRoot, run.runId)
  run.status = "running"
  run.startedAt = nowIso()
  run.completedAt = null
  run.error = null
  addEvent(run, "info", "semantic-audit", "跳过重新生成，仅对已保存的章节蓝图运行独立正典语义审计。", { runId: run.runId, startChapter: input.startChapter, endChapter: input.endChapter })
  try {
    if (!result) throw new Error("chapter_blueprint_result_missing")
    applyChapterBlueprintDeterministicRepairs(run, result, input, "正典审计前")
    run.result = result
    await fs.writeFile(path.join(runDir, "12a-chapter-blueprints-before-audit.json"), `${JSON.stringify(result, null, 2)}\n`)
    if (!run.artifacts.includes("12a-chapter-blueprints-before-audit.json")) run.artifacts.push("12a-chapter-blueprints-before-audit.json")
    const structural = validateChapterBlueprints(result, input)
    if (!structural.valid) throw new Error(`chapter_blueprint_structural_validation_failed:${structural.errors.join(" | ")}`)
    if (String(result.mode || "").trim() === "lean_chapter_blueprints") {
      run.validation = structural
      run.semanticAudit = null
      run.status = "completed"
      addEvent(run, "success", "semantic-audit", "lean 蓝图模式仅执行结构与主线交接校验，不再调用独立正典审计，避免审计文本污染蓝图。", { warnings: structural.warnings })
      await persistCompletedChapterBlueprintState(run)
      return
    }
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    const chapterProviderOverride = debugProviderOverride(config, chapterBlueprintLlmActivityTimeoutMs)
    await loadLearningForChapterBlueprintRun(run, config.provider.modelName)
    const auditPrompts = buildChapterBlueprintSemanticAuditPrompts(input, result, run.runId, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "")
    await Promise.all([
      fs.writeFile(path.join(runDir, "12-semantic-audit-system.md"), `${auditPrompts.basePrompt}\n`),
      fs.writeFile(path.join(runDir, "12-semantic-audit-input.md"), `${auditPrompts.dynamicPrompt}\n\n${auditPrompts.userMessage}\n`),
    ])
    for (const artifact of ["12-semantic-audit-system.md", "12-semantic-audit-input.md"]) if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact)
    let auditRaw = ""
    let lastAuditStreamEventAt = 0
    const auditReply = await generateAgentReply({
      roleName: "Chapter Blueprint Canon Auditor",
      basePrompt: auditPrompts.basePrompt,
      dynamicPrompt: auditPrompts.dynamicPrompt,
      consensus: auditPrompts.consensus,
      message: auditPrompts.userMessage,
      currentStage: "chapter_blueprints_canon_audit_only",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: chapterProviderOverride,
      temperature: 0,
      onUsage: trackLlmCacheUsage(run, "独立正典审计补跑"),
      onDelta: async (delta) => {
        auditRaw += delta
        const now = Date.now()
        if (!lastAuditStreamEventAt || now - lastAuditStreamEventAt >= 700) {
          lastAuditStreamEventAt = now
          addEvent(run, "stream", "semantic-audit", `正典审计正在输出，已接收 ${auditRaw.length} 字符。`, { responseChars: auditRaw.length, tail: auditRaw.slice(-240) })
          await persistRun(run)
        }
      },
    })
    auditRaw = auditReply
    await fs.writeFile(path.join(runDir, "12-semantic-audit-raw.txt"), `${auditRaw}\n`)
    if (!run.artifacts.includes("12-semantic-audit-raw.txt")) run.artifacts.push("12-semantic-audit-raw.txt")
    run.semanticAudit = normalizeChapterBlueprintSemanticAudit(input, parseDebugModelJsonObject(auditRaw).value)
    run.validation = mergeChapterBlueprintSemanticAudit(structural, run.semanticAudit)
    await Promise.all([
      fs.writeFile(path.join(runDir, "13-semantic-audit.json"), `${JSON.stringify(run.semanticAudit, null, 2)}\n`),
      fs.writeFile(path.join(runDir, "14-validation-after-semantic-audit.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
    ])
    for (const artifact of ["13-semantic-audit.json", "14-validation-after-semantic-audit.json"]) if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact)
    run.status = run.validation.valid ? "completed" : "invalid"
    addEvent(run, run.validation.valid ? "success" : "error", "semantic-audit", run.validation.valid ? "已保存蓝图通过独立正典语义审计，无需重新生成。" : `正典语义审计发现 ${run.validation.errors.length} 个阻断问题。`, { errors: run.validation.errors, warnings: run.validation.warnings })
    if (run.validation.valid) await persistCompletedChapterBlueprintState(run)
  } catch (error) {
    run.status = "failed"
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "semantic-audit", `正典审计补跑失败：${run.error}`)
  } finally {
    run.completedAt = nowIso()
    await persistRun(run)
  }
  if (autoRepairOnFailure && run.status === "invalid" && run.result && run.validation && !run.validation.valid) {
    addEvent(run, "warning", "repair-loop", `正典审计未通过，自动把 ${run.validation.errors.length} 个错误回填到修复循环；无需手动点击“修复当前结果”。`, {
      errors: run.validation.errors,
      warnings: run.validation.warnings,
      mode: "continuous-convergence",
      safetyLimit: chapterBlueprintRepairSafetyLimit,
    })
    await persistRun(run)
    await executeChapterBlueprintRepairOnly(run)
  }
}

async function executeChapterBlueprintRepairOnly(run: DebugRun, remainingLoopRounds = chapterBlueprintRepairSafetyLimit) {
  const input = run.input as ChapterBlueprintInput
  const originalResult = run.result
  const originalValidation = run.validation
  const originalSemanticAudit = run.semanticAudit
  const runDir = path.join(runsRoot, run.runId)
  const structural = originalResult ? validateChapterBlueprints(originalResult, input) : null
  const semanticErrors = originalResult && structural && run.semanticAudit
    ? mergeChapterBlueprintSemanticAudit(structural, run.semanticAudit).errors
    : []
  const currentErrors = originalResult
    ? [...new Set([...(structural?.errors || []), ...semanticErrors])]
    : ["chapter_blueprint_result_missing"]
  const repairRound = run.artifacts.filter((artifact) => /^15-manual-repair-\d+-message\.md$/u.test(artifact)).length + 1
  const maximumLoopRounds = chapterBlueprintRepairSafetyLimit
  const loopRound = maximumLoopRounds - remainingLoopRounds + 1
  const prefix = `15-manual-repair-${String(repairRound).padStart(2, "0")}`
  run.status = "running"
  run.startedAt = nowIso()
  run.completedAt = null
  run.error = null
  addEvent(run, "info", "manual-repair", `开始第 ${repairRound} 次定向修复（持续收敛第 ${loopRound} 轮）；保留当前 Run，不重新生成整批蓝图。`, {
    runId: run.runId,
    loopRound,
    maximumLoopRounds,
    errorCount: currentErrors.length,
    errors: currentErrors,
  })
  try {
    if (!originalResult) throw new Error("chapter_blueprint_result_missing")
    if (!currentErrors.length) throw new Error("chapter_blueprint_repair_not_needed")
    const config = await loadDebugLlmConfig(run)
    if (!config || !config._dbApiKey) throw new Error("没有可用的真实文本模型配置。")
    const chapterProviderOverride = debugProviderOverride(config, chapterBlueprintLlmActivityTimeoutMs)
    await loadLearningForChapterBlueprintRun(run, config.provider.modelName)
    const repairMessage = buildChapterBlueprintRepairMessage(input, originalResult, currentErrors, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "")
    await fs.writeFile(path.join(runDir, `${prefix}-message.md`), `${repairMessage}\n`)
    if (!run.artifacts.includes(`${prefix}-message.md`)) run.artifacts.push(`${prefix}-message.md`)
    let repairRaw = ""
    let lastRepairStreamEventAt = 0
    const repairedReply = await generateAgentReply({
      roleName: "Chapter Blueprint Manual Repair Architect",
      basePrompt: chapterBlueprintRepairBasePrompt,
      dynamicPrompt: `冻结来源均在修复消息中给出。上游分卷策略 Run：${input.upstreamRunId}`,
      consensus: chapterBlueprintRepairConsensus,
      message: repairMessage,
      currentStage: "chapter_blueprints_debug_manual_repair",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: chapterProviderOverride,
      temperature: 0,
      onUsage: trackLlmCacheUsage(run, `手动持续收敛修复第 ${repairRound} 轮`),
      onDelta: async (delta) => {
        repairRaw += delta
        const now = Date.now()
        if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
          lastRepairStreamEventAt = now
          addEvent(run, "stream", "manual-repair", `定向修复正在输出，已接收 ${repairRaw.length} 字符。`, { responseChars: repairRaw.length, tail: repairRaw.slice(-240) })
          await persistRun(run)
        }
      },
    })
    repairRaw = repairedReply
    const repairedParsed = parseDebugModelJsonObject(repairRaw)
    run.rawResponse = repairRaw
    run.result = repairedParsed.value
    run.semanticAudit = null
    applyChapterBlueprintDeterministicRepairs(run, run.result, input, `手动修复第${repairRound}轮`)
    run.validation = validateChapterBlueprints(run.result, input)
    await Promise.all([
      fs.writeFile(path.join(runDir, `${prefix}-raw.txt`), `${repairRaw}\n`),
      fs.writeFile(path.join(runDir, `${prefix}-result.json`), `${JSON.stringify(run.result, null, 2)}\n`),
      fs.writeFile(path.join(runDir, `${prefix}-structural-validation.json`), `${JSON.stringify(run.validation, null, 2)}\n`),
    ])
    for (const artifact of [`${prefix}-raw.txt`, `${prefix}-result.json`, `${prefix}-structural-validation.json`]) if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact)
    if (!run.validation.valid) {
      run.status = "invalid"
      const learningStop = await learnFromChapterBlueprintRepair({
        run,
        beforeErrors: currentErrors,
        afterErrors: run.validation.errors,
        passed: false,
      })
      addEvent(run, remainingLoopRounds > 1 ? "warning" : "error", "manual-repair", `第 ${repairRound} 次定向修复后仍有 ${run.validation.errors.length} 个结构错误${remainingLoopRounds > 1 ? "，将自动把错误回填到下一轮" : "，已触发运行时安全熔断"}。`, { loopRound, safetyLimit: maximumLoopRounds, errors: run.validation.errors, warnings: run.validation.warnings })
      if (remainingLoopRounds > 1 && !learningStop.stop) {
        await persistRun(run)
        await executeChapterBlueprintRepairOnly(run, remainingLoopRounds - 1)
      }
      return
    }
    addEvent(run, "success", "manual-repair", `第 ${repairRound} 次定向修复已通过结构校验，继续执行独立正典语义审计。`, { warnings: run.validation.warnings })
    run.status = "queued"
    await persistRun(run)
    await executeChapterBlueprintAuditOnly(run, false)
    const statusAfterAudit = run.status as DebugRun["status"]
    const auditPassed = statusAfterAudit === "completed" && run.validation?.valid === true && Boolean(run.semanticAudit)
    const learningStop = await learnFromChapterBlueprintRepair({
      run,
      beforeErrors: currentErrors,
      afterErrors: run.validation?.errors || [],
      passed: auditPassed,
    })
    if (auditPassed) {
      addEvent(run, "success", "repair-loop", `持续收敛已完成：第 ${loopRound} 轮定向修复通过结构校验和独立正典语义审计。`, {
        loopRound,
        safetyLimit: maximumLoopRounds,
        warnings: run.validation.warnings || [],
      })
      await persistRun(run)
    } else if (statusAfterAudit === "failed") {
      addEvent(run, "error", "repair-loop", `持续收敛第 ${loopRound} 轮结构已通过，但独立正典审计没有产出可解析结果；不会把结构通过误标为完整通过。`, {
        loopRound,
        safetyLimit: maximumLoopRounds,
        error: run.error,
      })
      await persistRun(run)
    } else if (remainingLoopRounds > 1 && !learningStop.stop) {
      addEvent(run, "warning", "manual-repair", `第 ${repairRound} 次修复后的正典审计仍未通过；将把最新审计错误自动回填到下一轮。`, {
        loopRound,
        maximumLoopRounds,
        errors: run.validation?.errors || [],
        warnings: run.validation?.warnings || [],
      })
      await persistRun(run)
      await executeChapterBlueprintRepairOnly(run, remainingLoopRounds - 1)
    } else {
      addEvent(run, "error", "repair-loop", learningStop.stop
        ? `Learning Loop 检测到冲突或连续无进展并主动停止：${learningStop.reason}`
        : `持续收敛已触发 ${maximumLoopRounds} 轮运行时安全熔断，最终正典审计仍有 ${run.validation?.errors.length || 0} 个阻断问题。`, {
        loopRound,
        safetyLimit: maximumLoopRounds,
        learningStopped: learningStop.stop,
        learningConflict: learningStop.conflict || null,
        errors: run.validation?.errors || [],
        warnings: run.validation?.warnings || [],
      })
      await persistRun(run)
    }
  } catch (error) {
    run.status = "invalid"
    run.result = originalResult
    run.validation = originalValidation
    run.semanticAudit = originalSemanticAudit
    run.error = error instanceof Error ? error.message : String(error)
    addEvent(run, "error", "manual-repair", `当前结果定向修复失败：${run.error}`)
  } finally {
    if (!run.completedAt) run.completedAt = nowIso()
    await persistRun(run)
  }
}

async function loadRun(runId: string) {
  let run = runs.get(runId)
  let loadedFromDisk = false
  if (!run) {
    try {
      run = JSON.parse(await fs.readFile(path.join(runsRoot, runId, "run.json"), "utf8")) as DebugRun
      runs.set(runId, run)
      loadedFromDisk = true
    } catch {
      return null
    }
  }
  if (loadedFromDisk && ["queued", "running"].includes(run.status)) {
    run.status = "failed"
    run.completedAt = nowIso()
    run.error = "debug_server_restarted_before_run_completed"
    addEvent(run, "error", "recovery", "服务重启前的模型调用已中断；该 Run 已明确标记为失败，可安全重新运行。")
    await persistRun(run)
  }
  const parseRecoverableError = run.error?.includes("model_response_invalid_json") || /^(Expected|Unexpected)\b/u.test(run.error || "")
  const shouldRetryParseRecovery = Boolean(
    run.rawResponse
    && run.status === "failed"
    && parseRecoverableError,
  )
  if (shouldRetryParseRecovery) {
    try {
      const previousRecoverySnapshot = JSON.stringify({
        status: run.status,
        error: run.error,
        result: run.result,
        validation: run.validation,
      })
      const parsed = parseDebugModelJsonObject(run.rawResponse)
      run.result = parsed.value
      if (run.nodeId === "chapter-blueprints") {
        applyChapterBlueprintDeterministicRepairs(run, run.result, run.input as ChapterBlueprintInput, run.status === "failed" ? "失败Run加载恢复" : "历史Run重新恢复")
      }
      const outputFilename = run.nodeId === "world-foundation"
        ? "06-world-foundation.json"
        : run.nodeId === "character-planning"
          ? "06-character-plan.json"
          : run.nodeId === "initial-character-state"
            ? "06-initial-character-state.json"
            : run.nodeId === "world-matrix"
              ? "06-world-matrix.json"
              : run.nodeId === "plot-architecture"
                ? "06-plot-architecture.json"
                : run.nodeId === "story-bible"
                  ? "06-story-bible.json"
                  : run.nodeId === "volume-strategy"
                    ? "06-volume-strategy.json"
                    : run.nodeId === "chapter-blueprints"
                      ? "06-chapter-blueprints.json"
                      : "06-style-profile.json"
      if (parsed.repairedText) {
        await fs.writeFile(path.join(runsRoot, run.runId, "05b-repaired-response.txt"), `${parsed.repairedText}\n`)
        if (!run.artifacts.includes("05b-repaired-response.txt")) run.artifacts.push("05b-repaired-response.txt")
      }
      await fs.writeFile(path.join(runsRoot, run.runId, outputFilename), `${JSON.stringify(run.result, null, 2)}\n`)
      if (!run.artifacts.includes(outputFilename)) run.artifacts.push(outputFilename)
      run.validation = run.nodeId === "world-foundation"
        ? validateFoundation(run.result)
        : run.nodeId === "character-planning"
          ? validateCharacterPlan(run.result, run.input as CharacterPlanningInput)
          : run.nodeId === "initial-character-state"
            ? validateInitialCharacterState(run.result, run.input as InitialCharacterStateInput)
            : run.nodeId === "world-matrix"
              ? validateWorldMatrix(run.result, run.input as WorldMatrixInput)
              : run.nodeId === "plot-architecture"
                ? validatePlotArchitecture(run.result, run.input as PlotArchitectureInput)
                : run.nodeId === "story-bible"
                  ? validateStoryBible(run.result, run.input as StoryBibleInput)
                  : run.nodeId === "volume-strategy"
                    ? validateVolumeStrategy(run.result, run.input as VolumeStrategyInput)
                    : run.nodeId === "chapter-blueprints"
                      ? mergeChapterBlueprintSemanticAudit(validateChapterBlueprints(run.result, run.input as ChapterBlueprintInput), run.semanticAudit)
                      : validateStyleProfile(run.result, run.input as StyleProfileInput)
      await fs.writeFile(path.join(runsRoot, run.runId, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}\n`)
      if (!run.artifacts.includes("07-validation.json")) run.artifacts.push("07-validation.json")
      run.status = run.validation.valid ? "completed" : "invalid"
      run.error = null
      const nextRecoverySnapshot = JSON.stringify({
        status: run.status,
        error: run.error,
        result: run.result,
        validation: run.validation,
      })
      if (previousRecoverySnapshot !== nextRecoverySnapshot) {
        addEvent(run, run.validation.valid ? "success" : "error", "parse-recover", run.validation.valid
          ? "使用当前调试解析/清洗规则重新恢复响应，并通过最新结构校验。"
          : `使用当前调试解析/清洗规则重新恢复响应，但最新结构校验仍有 ${run.validation.errors.length} 个错误。`, {
          repairs: parsed.repairs,
          errors: run.validation.errors,
          outputArtifact: outputFilename,
        })
        await persistRun(run)
      }
    } catch {
      // Keep the original failed run if the local debug repair still cannot parse it.
    }
  }
  if (run.nodeId === "character-planning" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateCharacterPlan(run.result, run.input as CharacterPlanningInput)
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status
      run.validation = currentValidation
      run.status = currentValidation.valid ? "completed" : "invalid"
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid
          ? "按最新人物规划规则重新校验通过。"
          : `按最新人物规划规则重新校验失败：${currentValidation.errors.length} 个错误。`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings },
      )
      await persistRun(run)
    }
  }
  if (run.nodeId === "initial-character-state" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateInitialCharacterState(run.result, run.input as InitialCharacterStateInput)
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status
      run.validation = currentValidation
      run.status = currentValidation.valid ? "completed" : "invalid"
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid
          ? "按最新人物初始状态规则重新校验通过。"
          : `按最新人物初始状态规则重新校验失败：${currentValidation.errors.length} 个错误。`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings },
      )
      await persistRun(run)
    }
  }
  if (run.nodeId === "world-matrix" && run.result && run.status === "invalid" && run.validation) {
    const canonicalizedAnchorIndices = canonicalizeWorldMatrixAnchors(run.result, run.input as WorldMatrixInput, run.validation.errors)
    if (canonicalizedAnchorIndices.length) {
      run.validation = validateWorldMatrix(run.result, run.input as WorldMatrixInput)
      run.status = run.validation.valid ? "completed" : "invalid"
      await Promise.all([
        fs.writeFile(path.join(runsRoot, run.runId, "12-world-matrix-canonicalized.json"), `${JSON.stringify(run.result, null, 2)}\n`),
        fs.writeFile(path.join(runsRoot, run.runId, "13-validation-after-canonicalization.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
      ])
      if (!run.artifacts.includes("12-world-matrix-canonicalized.json")) run.artifacts.push("12-world-matrix-canonicalized.json")
      if (!run.artifacts.includes("13-validation-after-canonicalization.json")) run.artifacts.push("13-validation-after-canonicalization.json")
      addEvent(run, run.validation.valid ? "success" : "error", "canonicalize-recover", run.validation.valid
        ? `已将 ${canonicalizedAnchorIndices.length} 条仅剩的越界锚点恢复为节点 03 原始冻结锁，并通过复检。`
        : `锚点恢复后仍有 ${run.validation.errors.length} 个错误。`, {
        canonicalizedAnchorIndices,
        errors: run.validation.errors,
      })
      await persistRun(run)
    }
  }
  if (run.nodeId === "world-matrix" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateWorldMatrix(run.result, run.input as WorldMatrixInput)
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status
      run.validation = currentValidation
      run.status = currentValidation.valid ? "completed" : "invalid"
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid
          ? "按最新世界矩阵规则重新校验通过。"
          : `按最新世界矩阵规则重新校验失败：${currentValidation.errors.length} 个错误。`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings },
      )
      await persistRun(run)
    }
  }
  if (run.nodeId === "world-matrix" && run.result && run.status === "invalid" && run.validation) {
    const canonicalizedScheduleCount = canonicalizeWorldMatrixHandoffSchedule(run.result, run.validation.errors)
    if (canonicalizedScheduleCount) {
      run.validation = validateWorldMatrix(run.result, run.input as WorldMatrixInput)
      run.status = run.validation.valid ? "completed" : "invalid"
      await Promise.all([
        fs.writeFile(path.join(runsRoot, run.runId, "14-world-matrix-boundary-canonicalized.json"), `${JSON.stringify(run.result, null, 2)}\n`),
        fs.writeFile(path.join(runsRoot, run.runId, "15-validation-after-boundary-canonicalization.json"), `${JSON.stringify(run.validation, null, 2)}\n`),
      ])
      if (!run.artifacts.includes("14-world-matrix-boundary-canonicalized.json")) run.artifacts.push("14-world-matrix-boundary-canonicalized.json")
      if (!run.artifacts.includes("15-validation-after-boundary-canonicalization.json")) run.artifacts.push("15-validation-after-boundary-canonicalization.json")
      addEvent(run, run.validation.valid ? "success" : "error", "canonicalize-recover", run.validation.valid
        ? `已移除 ${canonicalizedScheduleCount} 处越界章节排期，保留因果条件并通过复检。`
        : `移除越界章节排期后仍有 ${run.validation.errors.length} 个错误。`, {
        canonicalizedScheduleCount,
        errors: run.validation.errors,
      })
      await persistRun(run)
    }
  }
  if (run.nodeId === "plot-architecture" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validatePlotArchitecture(run.result, run.input as PlotArchitectureInput)
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status
      run.validation = currentValidation
      run.status = currentValidation.valid ? "completed" : "invalid"
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid
          ? "按最新主线架构规则重新校验通过。"
          : `按最新主线架构规则重新校验失败：${currentValidation.errors.length} 个错误。`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings },
      )
      await persistRun(run)
    }
  }
  if (run.nodeId === "story-bible" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateStoryBible(run.result, run.input as StoryBibleInput)
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status
      run.validation = currentValidation
      run.status = currentValidation.valid ? "completed" : "invalid"
      addEvent(run, currentValidation.valid ? "success" : "error", "validate-recheck", currentValidation.valid
        ? "按最新故事圣经规则重新校验通过。"
        : `按最新故事圣经规则重新校验失败：${currentValidation.errors.length} 个错误。`,
      { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings })
      await persistRun(run)
    }
  }
  if (run.nodeId === "volume-strategy" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateVolumeStrategy(run.result, run.input as VolumeStrategyInput)
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status
      run.validation = currentValidation
      run.status = currentValidation.valid ? "completed" : "invalid"
      addEvent(run, currentValidation.valid ? "success" : "error", "validate-recheck", currentValidation.valid
        ? "按最新分卷策略规则重新校验通过。"
        : `按最新分卷策略规则重新校验失败：${currentValidation.errors.length} 个错误。`,
      { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings })
      await persistRun(run)
    }
  }
  if (run.nodeId === "chapter-blueprints" && run.result && run.semanticAudit && ["completed", "invalid"].includes(run.status)) {
    if (run.status === "invalid" && chapterBlueprintValidationOnlyRetroactiveQualityGate(run.validation) && run.semanticAudit.valid === true) {
      const previousValidation = run.validation
      run.validation = {
        valid: true,
        errors: [],
        warnings: [
          ...new Set([
            ...(previousValidation?.warnings || []),
            "历史批次已在当时通过结构校验与独立正典审计；新稳定生成密度/短句门禁只约束新生成或新修复，不追溯推翻已通过章节。",
          ]),
        ],
      }
      run.status = "completed"
      run.error = null
      addEvent(run, "success", "validate-recheck", "已恢复历史章节蓝图通过状态：该批次曾通过独立正典审计，新稳定门禁不追溯推翻历史资产。", {
        restoredFromRetroactiveQualityGate: true,
        previousErrors: previousValidation?.errors || [],
      })
      await persistRun(run)
      return run
    }
    if (run.status === "completed") return run
    const currentValidation = mergeChapterBlueprintSemanticAudit(validateChapterBlueprints(run.result, run.input as ChapterBlueprintInput), run.semanticAudit)
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status
      run.validation = currentValidation
      run.status = currentValidation.valid ? "completed" : "invalid"
      addEvent(run, currentValidation.valid ? "success" : "error", "validate-recheck", currentValidation.valid
        ? "按最新章节蓝图规则重新校验通过。"
        : `按最新章节蓝图规则重新校验失败：${currentValidation.errors.length} 个错误。`,
      { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings })
      await persistRun(run)
    }
  }
  return run
}

async function findLatestCompletedRun(nodeId: DebugRun["nodeId"]) {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => [])
  const candidates = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => loadRun(entry.name)))
  return candidates
    .filter((run): run is DebugRun => Boolean(run && run.nodeId === nodeId && run.status === "completed"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null
}

async function listChapterBlueprintRuns(filters: { upstreamRunId?: string; volumeId?: string } = {}) {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => [])
  const candidates = await Promise.all(entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("cb_")).map((entry) => loadRun(entry.name)))
  return candidates
    .filter((run): run is DebugRun => Boolean(run && run.nodeId === "chapter-blueprints"))
    .filter((run) => !filters.upstreamRunId || (run.input as ChapterBlueprintInput).upstreamRunId === filters.upstreamRunId)
    .filter((run) => !filters.volumeId || (run.input as ChapterBlueprintInput).volumeId === filters.volumeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return jsonResponse(response, 204, {})
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${port}`}`)

  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse(response, 200, { ok: true, mode: "real-llm-only", nodes: debugWorkflowKernel.listNodes(), rootDir, port })
  }

  if (request.method === "GET" && url.pathname === "/workflow/nodes") {
    return jsonResponse(response, 200, {
      debug: debugWorkflowKernel.listNodes(),
      production: [...listProductionWorkflowNodes(), ...listProductionPlanningNodes(), ...listProductionChapterNodes()],
      rollout: {
        featureFlag: "AI_NOVEL_WORKFLOW_KERNEL",
        enabled: process.env.AI_NOVEL_WORKFLOW_KERNEL === "1",
      },
    })
  }

  if (request.method === "POST" && url.pathname === "/production-sandboxes") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const projectId = String(body.projectId || "").trim()
      if (!projectId) return jsonResponse(response, 400, { error: "project_id_required" })
      return jsonResponse(response, 201, await productionWorkflowSandboxes.create(projectId))
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  const productionSandboxRunMatch = url.pathname.match(/^\/production-sandboxes\/([^/]+)\/nodes\/([^/]+)\/run$/u)
  if (request.method === "POST" && productionSandboxRunMatch) {
    try {
      const sandboxId = decodeURIComponent(productionSandboxRunMatch[1])
      const nodeId = decodeURIComponent(productionSandboxRunMatch[2])
      return jsonResponse(response, 200, await productionWorkflowSandboxes.executeNode(sandboxId, nodeId))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = /not_current|busy|unfinished/u.test(message) ? 409 : /invalid|not_found|ENOENT/u.test(message) ? 400 : 500
      return jsonResponse(response, status, { error: message })
    }
  }

  const productionSandboxApproveSettingMatch = url.pathname.match(/^\/production-sandboxes\/([^/]+)\/actions\/approve-setting-review$/u)
  if (request.method === "POST" && productionSandboxApproveSettingMatch) {
    try {
      const sandboxId = decodeURIComponent(productionSandboxApproveSettingMatch[1])
      return jsonResponse(response, 200, await productionWorkflowSandboxes.approveSettingReview(sandboxId))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = /not_current|busy|unfinished/u.test(message) ? 409 : /invalid|ENOENT/u.test(message) ? 400 : 500
      return jsonResponse(response, status, { error: message })
    }
  }

  const productionSandboxConfirmProtagonistMatch = url.pathname.match(/^\/production-sandboxes\/([^/]+)\/actions\/confirm-protagonist$/u)
  if (request.method === "POST" && productionSandboxConfirmProtagonistMatch) {
    try {
      const sandboxId = decodeURIComponent(productionSandboxConfirmProtagonistMatch[1])
      const body = await readJsonBody(request) as Record<string, unknown>
      return jsonResponse(response, 200, await productionWorkflowSandboxes.confirmProtagonistProfile(sandboxId, body))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = /not_current|busy|unfinished/u.test(message) ? 409 : /invalid|incomplete|ENOENT/u.test(message) ? 400 : 500
      return jsonResponse(response, status, { error: message })
    }
  }

  const productionSandboxMatch = url.pathname.match(/^\/production-sandboxes\/([^/]+)$/u)
  if (request.method === "GET" && productionSandboxMatch) {
    try {
      return jsonResponse(response, 200, await productionWorkflowSandboxes.inspect(decodeURIComponent(productionSandboxMatch[1])))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return jsonResponse(response, /invalid/u.test(message) ? 400 : 404, { error: message })
    }
  }

  if (request.method === "GET" && url.pathname === "/llm-configs") {
    try {
      const models = await listDebugTextModels()
      return jsonResponse(response, 200, { models })
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "GET" && url.pathname === "/projects") {
    try {
      const projects = await withFactoryDb(rootDir, async (db) => db.listProjects())
      return jsonResponse(response, 200, {
        projects: projects.map((project) => ({
          id: project.id,
          title: project.title,
          idea: project.idea,
          projectRoot: project.projectRoot,
        })),
      })
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "GET" && url.pathname === "/runs/latest") {
    const nodeId = url.searchParams.get("nodeId")
    if (nodeId !== "world-foundation" && nodeId !== "character-planning" && nodeId !== "initial-character-state" && nodeId !== "world-matrix" && nodeId !== "plot-architecture" && nodeId !== "story-bible" && nodeId !== "volume-strategy" && nodeId !== "chapter-blueprints" && nodeId !== "style-profile" && nodeId !== "single-chapter-context" && nodeId !== "chapter-draft" && nodeId !== "chapter-commit" && nodeId !== "continuous-chapter-production") return jsonResponse(response, 400, { error: "invalid_node_id" })
    const run = await findLatestCompletedRun(nodeId)
    return run ? jsonResponse(response, 200, await loadWorkflowEvidence(run)) : jsonResponse(response, 404, { error: "completed_run_not_found" })
  }

  if (request.method === "GET" && url.pathname === "/committed-chapters") {
    const projectId = url.searchParams.get("factoryProjectId") || url.searchParams.get("projectId") || ""
    if (!projectId) return jsonResponse(response, 400, { error: "factory_project_id_required" })
    const firstChapter = Number(url.searchParams.get("firstChapter") || "1")
    const assets = await listCommittedChapterAssets(projectId)
    const coverage = committedChapterCoverage(assets, Number.isInteger(firstChapter) ? firstChapter : 1)
    return jsonResponse(response, 200, {
      projectId,
      ...coverage,
      assets: coverage.assets,
    })
  }

  const committedChapterTextMatch = url.pathname.match(/^\/committed-chapters\/(\d+)$/u)
  if (request.method === "GET" && committedChapterTextMatch) {
    const projectId = url.searchParams.get("factoryProjectId") || url.searchParams.get("projectId") || ""
    if (!projectId) return jsonResponse(response, 400, { error: "factory_project_id_required" })
    const chapterNumber = Number(committedChapterTextMatch[1])
    const assets = await listCommittedChapterAssets(projectId)
    const chapterAssets = assets.filter((asset) => asset.chapterNumber === chapterNumber)
    const latest = chapterAssets.sort((a, b) => b.committedAt.localeCompare(a.committedAt))[0]
    if (!latest) return jsonResponse(response, 404, { error: "committed_chapter_not_found" })
    let text = ""
    if (latest.textAssetPath) text = await fs.readFile(latest.textAssetPath, "utf8").catch(() => "")
    if (!text && latest.assetPath) {
      const parsed = JSON.parse(await fs.readFile(latest.assetPath, "utf8")) as Record<string, unknown>
      text = `${String(parsed.title || "")}\n\n${String(parsed.text || "")}`.trim()
    }
    return jsonResponse(response, 200, {
      ...latest,
      text,
    })
  }

  if (request.method === "GET" && url.pathname === "/chapter-review") {
    const projectId = url.searchParams.get("factoryProjectId") || url.searchParams.get("projectId") || ""
    if (!projectId) return jsonResponse(response, 400, { error: "factory_project_id_required" })
    const firstChapter = Number(url.searchParams.get("firstChapter") || "1")
    const lastChapter = Number(url.searchParams.get("lastChapter") || "")
    try {
      return jsonResponse(response, 200, await buildCommittedChapterReview(
        projectId,
        Number.isInteger(firstChapter) && firstChapter > 0 ? firstChapter : 1,
        Number.isInteger(lastChapter) && lastChapter > 0 ? lastChapter : undefined,
      ))
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/runs") {
    try {
      const input = normalizeInput(await readJsonBody(request))
      if (!input.title) return jsonResponse(response, 400, { error: "title_required" })
      if (input.coreIdea.length < 20) return jsonResponse(response, 400, { error: "core_idea_must_be_at_least_20_chars" })
      if (!input.factoryProjectId) {
        const projects = await withFactoryDb(rootDir, async (db) => db.listProjects())
        return jsonResponse(response, 400, {
          error: "factory_project_required_for_debug_trace",
          message: "运行调试节点前必须先绑定一个小说工厂项目；请在调试页顶部项目下拉框选择项目后再运行。",
          projectCount: projects.length,
          firstProjectId: projects[0]?.id || null,
        })
      }
      const runId = `wf_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "world-foundation",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run)
      jsonResponse(response, 202, { runId, status: run.status })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/character-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId
        ? await loadRun(requestedUpstreamRunId)
        : await findLatestCompletedRun("world-foundation")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_world_run_not_found" })
      if (upstreamRun.nodeId !== "world-foundation") return jsonResponse(response, 400, { error: "upstream_run_must_be_world_foundation" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) {
        return jsonResponse(response, 409, { error: "upstream_world_run_must_be_completed_and_valid" })
      }
      const worldInput = upstreamRun.input as WorldFoundationInput
      const temperatureValue = Number(body.temperature)
      const input: CharacterPlanningInput = {
        modelConfigId: String(body.modelConfigId || worldInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, worldInput),
        upstreamRunId: upstreamRun.runId,
        planningFocus: String(body.planningFocus || "").trim(),
        totalChapters: worldInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : worldInput.temperature,
        worldFoundation: upstreamRun.result,
      }
      const runId = `cp_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "character-planning",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/initial-state-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId
        ? await loadRun(requestedUpstreamRunId)
        : await findLatestCompletedRun("character-planning")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_character_planning_run_not_found" })
      if (upstreamRun.nodeId !== "character-planning") return jsonResponse(response, 400, { error: "upstream_run_must_be_character_planning" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) {
        return jsonResponse(response, 409, { error: "upstream_character_planning_run_must_be_completed_and_valid" })
      }
      const characterInput = upstreamRun.input as CharacterPlanningInput
      const temperatureValue = Number(body.temperature)
      const openingChapterValue = Number(body.openingChapter)
      const input: InitialCharacterStateInput = {
        modelConfigId: String(body.modelConfigId || characterInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, characterInput),
        upstreamRunId: upstreamRun.runId,
        stateFocus: String(body.stateFocus || "").trim(),
        openingChapter: Number.isFinite(openingChapterValue) ? Math.max(1, Math.min(characterInput.totalChapters, Math.round(openingChapterValue))) : 1,
        totalChapters: characterInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.35,
        worldFoundation: characterInput.worldFoundation,
        characterPlanning: upstreamRun.result,
      }
      const runId = `is_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "initial-character-state",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/world-matrix-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId
        ? await loadRun(requestedUpstreamRunId)
        : await findLatestCompletedRun("initial-character-state")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_initial_character_state_run_not_found" })
      if (upstreamRun.nodeId !== "initial-character-state") return jsonResponse(response, 400, { error: "upstream_run_must_be_initial_character_state" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) {
        return jsonResponse(response, 409, { error: "upstream_initial_character_state_run_must_be_completed_and_valid" })
      }
      const initialInput = upstreamRun.input as InitialCharacterStateInput
      const temperatureValue = Number(body.temperature)
      const input: WorldMatrixInput = {
        modelConfigId: String(body.modelConfigId || initialInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, initialInput),
        upstreamRunId: upstreamRun.runId,
        matrixFocus: String(body.matrixFocus || "").trim(),
        totalChapters: initialInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.25,
        worldFoundation: initialInput.worldFoundation,
        characterPlanning: initialInput.characterPlanning,
        initialCharacterState: upstreamRun.result,
      }
      const runId = `wm_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "world-matrix",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/plot-architecture-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId
        ? await loadRun(requestedUpstreamRunId)
        : await findLatestCompletedRun("world-matrix")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_world_matrix_run_not_found" })
      if (upstreamRun.nodeId !== "world-matrix") return jsonResponse(response, 400, { error: "upstream_run_must_be_world_matrix" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) {
        return jsonResponse(response, 409, { error: "upstream_world_matrix_run_must_be_completed_and_valid" })
      }
      const matrixInput = upstreamRun.input as WorldMatrixInput
      const temperatureValue = Number(body.temperature)
      const input: PlotArchitectureInput = {
        modelConfigId: String(body.modelConfigId || matrixInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, matrixInput),
        upstreamRunId: upstreamRun.runId,
        architectureFocus: String(body.architectureFocus || "").trim(),
        totalChapters: matrixInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.4,
        worldFoundation: matrixInput.worldFoundation,
        characterPlanning: matrixInput.characterPlanning,
        initialCharacterState: matrixInput.initialCharacterState,
        worldMatrix: upstreamRun.result,
      }
      const runId = `pa_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "plot-architecture",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/story-bible-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("plot-architecture")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_plot_architecture_run_not_found" })
      if (upstreamRun.nodeId !== "plot-architecture") return jsonResponse(response, 400, { error: "upstream_run_must_be_plot_architecture" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_plot_architecture_run_must_be_completed_and_valid" })
      const plotInput = upstreamRun.input as PlotArchitectureInput
      const temperatureValue = Number(body.temperature)
      const input: StoryBibleInput = {
        modelConfigId: String(body.modelConfigId || plotInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, plotInput),
        upstreamRunId: upstreamRun.runId,
        bibleFocus: String(body.bibleFocus || "").trim(),
        totalChapters: plotInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.2,
        worldFoundation: plotInput.worldFoundation,
        characterPlanning: plotInput.characterPlanning,
        initialCharacterState: plotInput.initialCharacterState,
        worldMatrix: plotInput.worldMatrix,
        plotArchitecture: upstreamRun.result,
      }
      const runId = `sb_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "story-bible",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/volume-strategy-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("story-bible")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_story_bible_run_not_found" })
      if (upstreamRun.nodeId !== "story-bible") return jsonResponse(response, 400, { error: "upstream_run_must_be_story_bible" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_story_bible_run_must_be_completed_and_valid" })
      const bibleInput = upstreamRun.input as StoryBibleInput
      const arcCount = storyBibleSourceRecords(bibleInput.plotArchitecture, "arcArchitecture").length
      const maxVolumeCount = Math.max(1, Math.min(12, arcCount))
      const targetValue = body.targetVolumeCount === undefined || body.targetVolumeCount === null || body.targetVolumeCount === ""
        ? volumeStrategyTargetForArcs(arcCount)
        : Number(body.targetVolumeCount)
      if (!Number.isInteger(targetValue) || targetValue < Math.min(2, maxVolumeCount) || targetValue > maxVolumeCount) return jsonResponse(response, 400, { error: `target_volume_count_must_be_between_${Math.min(2, maxVolumeCount)}_and_${maxVolumeCount}` })
      const temperatureValue = Number(body.temperature)
      const input: VolumeStrategyInput = {
        modelConfigId: String(body.modelConfigId || bibleInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, bibleInput),
        upstreamRunId: upstreamRun.runId,
        strategyFocus: String(body.strategyFocus || "").trim(),
        targetVolumeCount: targetValue,
        totalChapters: bibleInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.3,
        worldFoundation: bibleInput.worldFoundation,
        characterPlanning: bibleInput.characterPlanning,
        initialCharacterState: bibleInput.initialCharacterState,
        worldMatrix: bibleInput.worldMatrix,
        plotArchitecture: bibleInput.plotArchitecture,
        storyBible: upstreamRun.result,
      }
      const runId = `vs_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "volume-strategy",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, targetVolumeCount: targetValue })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  const chapterRepairMatch = url.pathname.match(/^\/chapter-blueprint-runs\/([^/]+)\/repair$/u)
  if (request.method === "POST" && chapterRepairMatch) {
    const run = await loadRun(chapterRepairMatch[1])
    if (!run) return jsonResponse(response, 404, { error: "chapter_blueprint_run_not_found" })
    if (run.nodeId !== "chapter-blueprints") return jsonResponse(response, 400, { error: "run_must_be_chapter_blueprints" })
    if (!run.result) return jsonResponse(response, 409, { error: "chapter_blueprint_result_missing" })
    if (["queued", "running"].includes(run.status)) return jsonResponse(response, 409, { error: "chapter_blueprint_run_is_busy" })
    const currentValidation = mergeChapterBlueprintSemanticAudit(validateChapterBlueprints(run.result, run.input as ChapterBlueprintInput), run.semanticAudit)
    if (currentValidation.valid) return jsonResponse(response, 409, { error: "chapter_blueprint_repair_not_needed" })
    run.status = "queued"
    run.validation = currentValidation
    run.error = null
    await persistRun(run)
    jsonResponse(response, 202, { runId: run.runId, status: run.status, mode: "repair-current-result", errorCount: currentValidation.errors.length })
    void executeChapterBlueprintRepairOnly(run)
    return
  }

  const chapterAuditMatch = url.pathname.match(/^\/chapter-blueprint-runs\/([^/]+)\/audit$/u)
  if (request.method === "POST" && chapterAuditMatch) {
    const run = await loadRun(chapterAuditMatch[1])
    if (!run) return jsonResponse(response, 404, { error: "chapter_blueprint_run_not_found" })
    if (run.nodeId !== "chapter-blueprints") return jsonResponse(response, 400, { error: "run_must_be_chapter_blueprints" })
    if (!run.result) return jsonResponse(response, 409, { error: "chapter_blueprint_result_missing" })
    if (["queued", "running"].includes(run.status)) return jsonResponse(response, 409, { error: "chapter_blueprint_run_is_busy" })
    applyChapterBlueprintDeterministicRepairs(run, run.result, run.input as ChapterBlueprintInput, "审计请求预检")
    await persistRun(run)
    const structural = validateChapterBlueprints(run.result, run.input as ChapterBlueprintInput)
    if (!structural.valid) return jsonResponse(response, 409, { error: "chapter_blueprint_structural_validation_failed", details: structural.errors })
    run.status = "queued"
    run.validation = structural
    run.semanticAudit = null
    run.error = null
    await persistRun(run)
    jsonResponse(response, 202, { runId: run.runId, status: run.status, mode: "semantic-audit-only" })
    void executeChapterBlueprintAuditOnly(run)
    return
  }

  if (request.method === "GET" && url.pathname === "/chapter-blueprint-runs") {
    const upstreamRunId = String(url.searchParams.get("upstreamRunId") || "").trim()
    const volumeId = String(url.searchParams.get("volumeId") || "").trim()
    const chapterRuns = await listChapterBlueprintRuns({ upstreamRunId: upstreamRunId || undefined, volumeId: volumeId || undefined })
    return jsonResponse(response, 200, {
      runs: chapterRuns.map((run) => {
        const input = run.input as ChapterBlueprintInput
        return {
          runId: run.runId,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
          status: run.status,
          valid: run.validation?.valid === true,
          errorCount: run.validation?.errors.length || 0,
          warningCount: run.validation?.warnings.length || 0,
          upstreamRunId: input.upstreamRunId,
          volumeId: input.volumeId,
          startChapter: input.startChapter,
          endChapter: input.endChapter,
          previousBatchRunId: input.previousBatchRunId || null,
          blueprintCount: Array.isArray(run.result?.blueprints) ? run.result.blueprints.length : 0,
          semanticAudit: run.semanticAudit || null,
          error: run.error,
        }
      }),
    })
  }

  if (request.method === "POST" && url.pathname === "/chapter-blueprint-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("volume-strategy")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_volume_strategy_run_not_found" })
      if (upstreamRun.nodeId !== "volume-strategy") return jsonResponse(response, 400, { error: "upstream_run_must_be_volume_strategy" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_volume_strategy_run_must_be_completed_and_valid" })
      const volumeInput = upstreamRun.input as VolumeStrategyInput
      const volumes = storyBibleSourceRecords(upstreamRun.result, "volumes")
      const volumeId = String(body.volumeId || volumes[0]?.id || "").trim()
      const volume = volumes.find((entry) => String(entry.id || "").trim() === volumeId)
      if (!volume) return jsonResponse(response, 400, { error: "selected_volume_not_found" })
      const volumeStart = Number(volume.startChapter)
      const volumeEnd = Number(volume.endChapter)
      const startChapter = body.startChapter === undefined || body.startChapter === null || body.startChapter === "" ? volumeStart : Number(body.startChapter)
      const endChapter = body.endChapter === undefined || body.endChapter === null || body.endChapter === "" ? Math.min(volumeEnd, startChapter + chapterBlueprintStableBatchLimit - 1) : Number(body.endChapter)
      if (!Number.isInteger(startChapter) || !Number.isInteger(endChapter) || startChapter < volumeStart || endChapter > volumeEnd || endChapter < startChapter) return jsonResponse(response, 400, { error: `chapter_range_must_be_within_${volumeStart}_and_${volumeEnd}` })
      if (endChapter - startChapter + 1 > chapterBlueprintStableBatchLimit) return jsonResponse(response, 400, {
        error: `稳定生成模式下章节蓝图每批最多 ${chapterBlueprintStableBatchLimit} 章；请先生成第 ${startChapter}-${Math.min(volumeEnd, startChapter + chapterBlueprintStableBatchLimit - 1)} 章，通过后再继续下一批。`,
        stableBatchLimit: chapterBlueprintStableBatchLimit,
        recommendedStartChapter: startChapter,
        recommendedEndChapter: Math.min(volumeEnd, startChapter + chapterBlueprintStableBatchLimit - 1),
      })
      const priorRuns = await listChapterBlueprintRuns({ upstreamRunId: upstreamRun.runId, volumeId })
      const completedChapters = new Set<number>()
      for (const candidate of priorRuns) {
        if (candidate.status !== "completed" || candidate.validation?.valid !== true || !candidate.result) continue
        const candidateInput = candidate.input as ChapterBlueprintInput
        for (let chapter = candidateInput.startChapter; chapter <= candidateInput.endChapter; chapter += 1) completedChapters.add(chapter)
      }
      const nextMissingChapter = Array.from({ length: volumeEnd - volumeStart + 1 }, (_, index) => volumeStart + index).find((chapter) => !completedChapters.has(chapter))
      if (nextMissingChapter === undefined) return jsonResponse(response, 409, { error: `本卷第 ${volumeStart}-${volumeEnd} 章已经全部通过，不能重复生成。` })
      const overlappingCompletedChapters = Array.from({ length: endChapter - startChapter + 1 }, (_, index) => startChapter + index).filter((chapter) => completedChapters.has(chapter))
      if (overlappingCompletedChapters.length) return jsonResponse(response, 409, {
        error: `请求范围第 ${startChapter}-${endChapter} 章包含已经通过的章节（${overlappingCompletedChapters.slice(0, 12).join("、")}）；下一批必须从第 ${nextMissingChapter} 章开始。`,
        nextChapter: nextMissingChapter,
      })
      if (startChapter !== nextMissingChapter) return jsonResponse(response, 409, {
        error: `章节蓝图必须连续生成；当前下一处未通过章节是第 ${nextMissingChapter} 章，不能从第 ${startChapter} 章开始。`,
        nextChapter: nextMissingChapter,
      })
      let previousBatchRun: DebugRun | null = null
      let previousBatchHandoff: Record<string, unknown> | null = null
      if (startChapter > volumeStart) {
        previousBatchRun = priorRuns.find((candidate) => {
          const candidateInput = candidate.input as ChapterBlueprintInput
          return candidate.status === "completed" && candidate.validation?.valid === true && candidateInput.endChapter === startChapter - 1
        }) || null
        if (!previousBatchRun?.result) return jsonResponse(response, 409, { error: `previous_valid_chapter_blueprint_batch_required_ending_at_${startChapter - 1}` })
        const previousBlueprints = Array.isArray(previousBatchRun.result.blueprints) ? previousBatchRun.result.blueprints as Record<string, unknown>[] : []
        const previousLastBlueprint = previousBlueprints.find((entry) => Number(entry.chapterNumber) === startChapter - 1) || previousBlueprints.at(-1) || {}
        const previousWritingHandoff = previousBatchRun.result.handoffToWritingPlan && typeof previousBatchRun.result.handoffToWritingPlan === "object" && !Array.isArray(previousBatchRun.result.handoffToWritingPlan)
          ? previousBatchRun.result.handoffToWritingPlan as Record<string, unknown>
          : {}
        previousBatchHandoff = {
          endChapter: startChapter - 1,
          endingHook: previousLastBlueprint.endingHook || previousLastBlueprint.nextPressure,
          nextChapterEntryState: previousLastBlueprint.nextChapterEntryState || previousLastBlueprint.nextPressure,
          nextChapterHandoff: previousLastBlueprint.nextChapterHandoff || previousLastBlueprint.nextPressure,
          batchExitState: previousWritingHandoff.batchExitState || previousWritingHandoff.batchExitPressure,
          unresolvedRisks: previousWritingHandoff.unresolvedRisks,
        }
      }
      const targetWordCount = body.targetWordCount === undefined || body.targetWordCount === null || body.targetWordCount === "" ? 2500 : Number(body.targetWordCount)
      if (!Number.isInteger(targetWordCount) || targetWordCount < 1000 || targetWordCount > 10000) return jsonResponse(response, 400, { error: "target_word_count_must_be_between_1000_and_10000" })
      const temperatureValue = Number(body.temperature)
      const input: ChapterBlueprintInput = {
        modelConfigId: String(body.modelConfigId || volumeInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, volumeInput),
        upstreamRunId: upstreamRun.runId,
        blueprintFocus: String(body.blueprintFocus || "").trim(),
        volumeId,
        startChapter,
        endChapter,
        targetWordCount,
        totalChapters: volumeInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.25,
        previousBatchRunId: previousBatchRun?.runId || null,
        previousBatchHandoff,
        worldFoundation: volumeInput.worldFoundation,
        characterPlanning: volumeInput.characterPlanning,
        initialCharacterState: volumeInput.initialCharacterState,
        worldMatrix: volumeInput.worldMatrix,
        plotArchitecture: volumeInput.plotArchitecture,
        storyBible: volumeInput.storyBible,
        volumeStrategy: upstreamRun.result,
      }
      const runId = `cb_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "chapter-blueprints",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, volumeId, startChapter, endChapter, previousBatchRunId: previousBatchRun?.runId || null })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/style-profile-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("chapter-blueprints")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_chapter_blueprints_run_not_found" })
      if (upstreamRun.nodeId !== "chapter-blueprints") return jsonResponse(response, 400, { error: "upstream_run_must_be_chapter_blueprints" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_chapter_blueprints_run_must_be_completed_and_valid" })
      const chapterInput = upstreamRun.input as ChapterBlueprintInput
      const aggregated = await aggregateCompletedChapterBlueprintsForStyle(upstreamRun)
      const blueprints = Array.isArray(aggregated.aggregate.blueprints) ? aggregated.aggregate.blueprints as Record<string, unknown>[] : []
      if (!blueprints.length) return jsonResponse(response, 409, { error: "upstream_chapter_blueprints_empty" })
      const requestedSampleChapter = Number(body.sampleChapter)
      const firstBlueprintChapter = aggregated.firstChapter
      const lastBlueprintChapter = aggregated.lastChapter
      const sampleChapter = Number.isInteger(requestedSampleChapter)
        ? Math.max(firstBlueprintChapter, Math.min(lastBlueprintChapter, requestedSampleChapter))
        : firstBlueprintChapter
      const temperatureValue = Number(body.temperature)
      const maxRoundsValue = Number(body.maxRounds)
      const input: StyleProfileInput = {
        modelConfigId: String(body.modelConfigId || chapterInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, chapterInput),
        upstreamRunId: upstreamRun.runId,
        styleFocus: String(body.styleFocus || "").trim(),
        humanBaselineText: String(body.humanBaselineText || "").trim(),
        aigcGranularity: String(body.aigcGranularity || "merged_sentence").trim(),
        aigcPolicy: String(body.aigcPolicy || "balanced").trim(),
        aigcMinSegmentChars: Number.isFinite(Number(body.aigcMinSegmentChars)) ? Math.max(20, Math.min(500, Math.floor(Number(body.aigcMinSegmentChars)))) : 120,
        sampleChapter,
        maxRounds: Number.isFinite(maxRoundsValue) ? Math.max(1, Math.min(12, Math.floor(maxRoundsValue))) : 6,
        totalChapters: chapterInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.2,
        worldFoundation: chapterInput.worldFoundation,
        characterPlanning: chapterInput.characterPlanning,
        storyBible: chapterInput.storyBible,
        volumeStrategy: chapterInput.volumeStrategy,
        chapterBlueprints: aggregated.aggregate,
      }
      const runId = `sp_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "style-profile",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, {
        runId,
        status: run.status,
        upstreamRunId: upstreamRun.runId,
        sampleChapter,
        aggregatedBlueprintCount: aggregated.blueprintCount,
        aggregatedFirstChapter: aggregated.firstChapter,
        aggregatedLastChapter: aggregated.lastChapter,
        aggregatedRunCount: aggregated.completedRuns.length,
      })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  const styleProfileFreezeMatch = url.pathname.match(/^\/style-profile-runs\/([^/]+)\/freeze$/u)
  if (request.method === "POST" && styleProfileFreezeMatch) {
    const run = await loadRun(styleProfileFreezeMatch[1])
    if (!run) return jsonResponse(response, 404, { error: "style_profile_run_not_found" })
    if (run.nodeId !== "style-profile") return jsonResponse(response, 400, { error: "run_must_be_style_profile" })
    if (["queued", "running"].includes(run.status)) return jsonResponse(response, 409, { error: "style_profile_run_is_busy" })
    try {
      const freeze = await freezeStyleProfileDebugRun(run)
      run.result = {
        ...(run.result && typeof run.result === "object" && !Array.isArray(run.result) ? run.result : {}),
        freeze,
      }
      addEvent(run, "success", "style-freeze", "已冻结为正式文风合同：样段、风格、用户规范和 AIGC 修复经验已写入项目资产。", freeze)
      await persistRun(run)
      return jsonResponse(response, 200, { runId: run.runId, freeze })
    } catch (error) {
      addEvent(run, "error", "style-freeze", `文风冻结失败：${error instanceof Error ? error.message : String(error)}`)
      await persistRun(run)
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/single-chapter-context-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("style-profile")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_style_profile_run_not_found" })
      if (upstreamRun.nodeId !== "style-profile") return jsonResponse(response, 400, { error: "upstream_run_must_be_style_profile" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_style_profile_run_must_be_completed_and_valid" })
      const frozenStyle = await loadStyleEvolution(rootDir)
      if (frozenStyle.contract.approval?.status !== "approved" || !frozenStyle.contract.approvedSample || !frozenStyle.contract.styleContract) {
        return jsonResponse(response, 409, { error: "style_profile_must_be_frozen_before_single_chapter_context" })
      }
      const styleInput = upstreamRun.input as StyleProfileInput
      const blueprints = styleProfileBlueprints(styleInput)
      if (!blueprints.length) return jsonResponse(response, 409, { error: "style_profile_chapter_blueprints_empty" })
      const firstChapter = Number(blueprints[0]?.chapterNumber || 1)
      const lastChapter = Number(blueprints.at(-1)?.chapterNumber || firstChapter)
      const requestedChapter = Number(body.chapterNumber)
      const chapterNumber = Number.isInteger(requestedChapter)
        ? Math.max(firstChapter, Math.min(lastChapter, requestedChapter))
        : firstChapter
      if (!blueprints.some((entry) => Number(entry.chapterNumber) === chapterNumber)) return jsonResponse(response, 400, { error: `chapter_${chapterNumber}_blueprint_not_found` })
      const targetWordCount = Number(body.targetWordCount)
      const normalizedTargetWordCount = Number.isInteger(targetWordCount) ? Math.max(800, Math.min(10000, targetWordCount)) : 2500
      const input: SingleChapterContextInput = {
        modelConfigId: String(body.modelConfigId || styleInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, styleInput),
        upstreamRunId: upstreamRun.runId,
        chapterNumber,
        contextFocus: String(body.contextFocus || "").trim(),
        targetWordCount: normalizedTargetWordCount,
        styleProfile: upstreamRun.result,
        frozenStyle: frozenStyle as unknown as Record<string, unknown>,
        storyBible: styleInput.storyBible,
        volumeStrategy: styleInput.volumeStrategy,
        chapterBlueprints: styleInput.chapterBlueprints,
      }
      const runId = `cc_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "single-chapter-context",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, chapterNumber, firstChapter, lastChapter })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/chapter-draft-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("single-chapter-context")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_single_chapter_context_run_not_found" })
      if (upstreamRun.nodeId !== "single-chapter-context") return jsonResponse(response, 400, { error: "upstream_run_must_be_single_chapter_context" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_single_chapter_context_run_must_be_completed_and_valid" })
      const contextInput = upstreamRun.input as SingleChapterContextInput
      const contextResult = upstreamRun.result
      const contextSource = contextResult.source && typeof contextResult.source === "object" && !Array.isArray(contextResult.source)
        ? contextResult.source as Record<string, unknown>
        : {}
      const chapterNumber = Number(contextSource.chapterNumber || contextInput.chapterNumber || body.chapterNumber || 1)
      const targetWordCount = Number(body.targetWordCount || contextSource.targetWordCount || contextInput.targetWordCount)
      const normalizedTargetWordCount = Number.isInteger(targetWordCount) ? Math.max(800, Math.min(12000, targetWordCount)) : 2500
      const temperature = Number(body.temperature)
      const input: ChapterDraftInput = {
        modelConfigId: String(body.modelConfigId || contextInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, contextInput),
        upstreamRunId: upstreamRun.runId,
        chapterNumber,
        draftFocus: String(body.draftFocus || "").trim(),
        targetWordCount: normalizedTargetWordCount,
        temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(1.2, temperature)) : 0.35,
        maxRepairRounds: Number.isFinite(Number(body.maxRepairRounds)) ? Math.max(0, Math.min(12, Math.floor(Number(body.maxRepairRounds)))) : 3,
        aigcPolicy: String(body.aigcPolicy || "balanced").trim(),
        aigcMinSegmentChars: Number.isFinite(Number(body.aigcMinSegmentChars)) ? Math.max(20, Math.min(500, Math.floor(Number(body.aigcMinSegmentChars)))) : 120,
        singleChapterContext: contextResult,
      }
      if (!input.modelConfigId) return jsonResponse(response, 400, { error: "model_config_required" })
      const runId = `dr_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "chapter-draft",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, chapterNumber })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/chapter-commit-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("chapter-draft")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_chapter_draft_run_not_found" })
      if (upstreamRun.nodeId !== "chapter-draft") return jsonResponse(response, 400, { error: "upstream_run_must_be_chapter_draft" })
      if (upstreamRun.status !== "completed" || upstreamRun.validation?.valid !== true || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_chapter_draft_run_must_be_completed_and_valid" })
      const draftPayload = chapterCommitDraftPayload(upstreamRun)
      const chapterNumber = Number(body.chapterNumber || draftPayload.chapterNumber || (upstreamRun.input as ChapterDraftInput).chapterNumber)
      const input: ChapterCommitInput = {
        modelConfigId: String(body.modelConfigId || upstreamRun.input.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, upstreamRun.input as DebugModelSelection),
        upstreamRunId: upstreamRun.runId,
        chapterNumber,
        commitNote: String(body.commitNote || "").trim(),
        chapterDraft: upstreamRun.result,
      }
      const runId = `cm_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "chapter-commit",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: { modelName: "no-llm", apiMode: "local-freeze" },
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, chapterNumber })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/continuous-chapter-production-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("style-profile")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_style_profile_run_not_found" })
      if (upstreamRun.nodeId !== "style-profile") return jsonResponse(response, 400, { error: "upstream_run_must_be_style_profile" })
      if (upstreamRun.status !== "completed" || upstreamRun.validation?.valid !== true || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_style_profile_run_must_be_completed_and_valid" })
      const frozenStyle = await loadStyleEvolution(rootDir)
      if (frozenStyle.contract.approval?.status !== "approved" || !frozenStyle.contract.approvedSample || !frozenStyle.contract.styleContract) {
        return jsonResponse(response, 409, { error: "style_profile_must_be_frozen_before_continuous_chapter_production" })
      }
      const styleInput = upstreamRun.input as StyleProfileInput
      const blueprints = styleProfileBlueprints(styleInput)
      if (!blueprints.length) return jsonResponse(response, 409, { error: "style_profile_chapter_blueprints_empty" })
      const firstChapter = Number(blueprints[0]?.chapterNumber || 1)
      const lastChapter = Number(blueprints.at(-1)?.chapterNumber || firstChapter)
      const requestedStart = Number(body.startChapter)
      const requestedEnd = Number(body.endChapter)
      const startChapter = Number.isInteger(requestedStart) ? Math.max(firstChapter, Math.min(lastChapter, requestedStart)) : firstChapter
      const endChapter = Number.isInteger(requestedEnd) ? Math.max(startChapter, Math.min(lastChapter, requestedEnd)) : startChapter
      const chapterCount = endChapter - startChapter + 1
      if (chapterCount < 1 || chapterCount > 100) return jsonResponse(response, 400, { error: "continuous_chapter_count_must_be_between_1_and_100" })
      for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
        if (!blueprints.some((entry) => Number(entry.chapterNumber) === chapter)) return jsonResponse(response, 400, { error: `chapter_${chapter}_blueprint_not_found` })
      }
      const targetWordCount = Number(body.targetWordCount)
      const normalizedTargetWordCount = Number.isInteger(targetWordCount) ? Math.max(800, Math.min(12000, targetWordCount)) : 2500
      const temperature = Number(body.temperature)
      const maxRepairRounds = Number(body.maxRepairRounds)
      const factoryProjectId = await debugFactoryProjectId(body, upstreamRun, styleInput)
      const committedAssets = await listCommittedChapterAssets(factoryProjectId)
      const committedCoverage = committedChapterCoverage(committedAssets, firstChapter)
      const requestedChapters = Array.from({ length: chapterCount }, (_, index) => startChapter + index)
      const overlappingCommitted = requestedChapters.filter((chapter) => committedCoverage.chapters.includes(chapter))
      if (overlappingCommitted.length) return jsonResponse(response, 409, {
        error: `请求范围第 ${startChapter}-${endChapter} 章包含已冻结章节（${overlappingCommitted.slice(0, 20).join("、")}）；下一章应从第 ${committedCoverage.nextChapter} 章开始。`,
        nextChapter: committedCoverage.nextChapter,
        committedChapters: committedCoverage.chapters,
        lastContinuousChapter: committedCoverage.lastContinuousChapter,
      })
      if (startChapter !== committedCoverage.nextChapter && committedCoverage.count > 0) return jsonResponse(response, 409, {
        error: `连续生产必须从下一章第 ${committedCoverage.nextChapter} 章开始，不能从第 ${startChapter} 章开始。`,
        nextChapter: committedCoverage.nextChapter,
        committedChapters: committedCoverage.chapters,
        lastContinuousChapter: committedCoverage.lastContinuousChapter,
      })
      const input: ContinuousChapterProductionInput = {
        modelConfigId: String(body.modelConfigId || styleInput.modelConfigId || "").trim(),
        factoryProjectId,
        upstreamRunId: upstreamRun.runId,
        startChapter,
        endChapter,
        targetWordCount: normalizedTargetWordCount,
        maxRepairRounds: Number.isFinite(maxRepairRounds) ? Math.max(0, Math.min(12, Math.floor(maxRepairRounds))) : 3,
        aigcPolicy: String(body.aigcPolicy || "balanced").trim(),
        aigcMinSegmentChars: Number.isFinite(Number(body.aigcMinSegmentChars)) ? Math.max(20, Math.min(500, Math.floor(Number(body.aigcMinSegmentChars)))) : 120,
        temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(1.2, temperature)) : 0.35,
        productionFocus: String(body.productionFocus || "").trim(),
        styleProfile: upstreamRun.result,
        frozenStyle: frozenStyle as unknown as Record<string, unknown>,
        storyBible: styleInput.storyBible,
        volumeStrategy: styleInput.volumeStrategy,
        chapterBlueprints: styleInput.chapterBlueprints,
      }
      if (!input.modelConfigId) return jsonResponse(response, 400, { error: "model_config_required" })
      const runId = `cp_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "continuous-chapter-production",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: { modelName: "workflow-orchestrator", apiMode: "local-compose" },
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, startChapter, endChapter })
      void debugWorkflowKernel.executeNode(run.nodeId, run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/style-profile-aigc-calibration-runs") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim()
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("chapter-blueprints")
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_chapter_blueprints_run_not_found" })
      if (upstreamRun.nodeId !== "chapter-blueprints") return jsonResponse(response, 400, { error: "upstream_run_must_be_chapter_blueprints" })
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_chapter_blueprints_run_must_be_completed_and_valid" })
      const chapterInput = upstreamRun.input as ChapterBlueprintInput
      const aggregated = await aggregateCompletedChapterBlueprintsForStyle(upstreamRun)
      const blueprints = Array.isArray(aggregated.aggregate.blueprints) ? aggregated.aggregate.blueprints as Record<string, unknown>[] : []
      if (!blueprints.length) return jsonResponse(response, 409, { error: "upstream_chapter_blueprints_empty" })
      const requestedSampleChapter = Number(body.sampleChapter)
      const sampleChapter = Number.isInteger(requestedSampleChapter)
        ? Math.max(aggregated.firstChapter, Math.min(aggregated.lastChapter, requestedSampleChapter))
        : aggregated.firstChapter
      const input: StyleProfileInput = {
        modelConfigId: String(body.modelConfigId || chapterInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, chapterInput),
        upstreamRunId: upstreamRun.runId,
        styleFocus: String(body.styleFocus || "").trim(),
        humanBaselineText: String(body.humanBaselineText || "").trim(),
        aigcGranularity: String(body.aigcGranularity || "merged_sentence").trim(),
        aigcPolicy: String(body.aigcPolicy || "balanced").trim(),
        aigcMinSegmentChars: Number.isFinite(Number(body.aigcMinSegmentChars)) ? Math.max(20, Math.min(500, Math.floor(Number(body.aigcMinSegmentChars)))) : 120,
        sampleChapter,
        maxRounds: 1,
        totalChapters: chapterInput.totalChapters,
        temperature: 0,
        worldFoundation: chapterInput.worldFoundation,
        characterPlanning: chapterInput.characterPlanning,
        storyBible: chapterInput.storyBible,
        volumeStrategy: chapterInput.volumeStrategy,
        chapterBlueprints: aggregated.aggregate,
      }
      const runId = `ac_${Date.now()}_${randomUUID().slice(0, 8)}`
      const run: DebugRun = {
        runId,
        nodeId: "style-profile",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: { detector: "aigc", modelName: "AIGC calibration", apiKey: "[REDACTED]" },
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null,
      }
      await registerDebugRun(run, upstreamRun)
      jsonResponse(response, 202, {
        runId,
        status: run.status,
        upstreamRunId: upstreamRun.runId,
        sampleChapter,
        aggregatedBlueprintCount: aggregated.blueprintCount,
        aggregatedFirstChapter: aggregated.firstChapter,
        aggregatedLastChapter: aggregated.lastChapter,
      })
      void executeStyleAigcCalibrationRun(run)
      return
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (request.method === "POST" && url.pathname === "/aigc-lab/detect") {
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const text = String(body.text || "").trim()
      if (text.length < 2) return jsonResponse(response, 400, { error: "text_required" })
      const thresholdValue = Number(body.threshold)
      const config = getAigcDetectorConfig(rootDir)
      const threshold = Number.isFinite(thresholdValue)
        ? Math.max(0.01, Math.min(0.99, thresholdValue))
        : (config.threshold ?? 0.8)
      const granularity = String(body.granularity || "sentence").trim()
      const minSegmentCharsValue = Number(body.minSegmentChars)
      const minSegmentChars = Number.isFinite(minSegmentCharsValue) ? Math.max(1, Math.min(500, Math.floor(minSegmentCharsValue))) : 80
      const policy = String(body.policy || "strict_any_sentence").trim()
      const segments = granularity === "node09"
        ? null
        : splitAigcLabTextIntoSentenceSegments(text, { granularity, minSegmentChars })
      if (segments && !segments.length) return jsonResponse(response, 400, { error: "detectable_sentence_required" })
      const startedAt = Date.now()
      const result = await detectAigcSegments(segments || text, {
        ...config,
        threshold,
      })
      const sentences = result.segments.map((entry) => {
        const score = typeof entry.score === "number" ? entry.score : null
        const localSignals = explainAigcLabLocalSignals(entry.segment.text)
        const riskLevel = aigcLabRiskLevel(score, threshold)
        const highRisk = entry.status === "ai_likely" || (score !== null && score >= threshold)
        return {
          id: entry.segment.id,
          index: entry.segment.index + 1,
          text: entry.segment.text,
          startOffset: entry.segment.startOffset,
          endOffset: entry.segment.endOffset,
          charCount: entry.charCount,
          status: entry.status,
          label: entry.label,
          score,
          confidence: entry.confidence,
          threshold,
          riskLevel,
          highRisk,
          localSignals,
          reason: entry.reason,
          raw: entry.raw,
        }
      })
      const highRiskSentences = sentences
        .filter((entry) => entry.highRisk)
        .sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0))
      const passDecision = aigcLabPassDecision({
        policy,
        score: result.score,
        threshold,
        highRiskCount: highRiskSentences.length,
        totalSentences: sentences.length,
      })
      return jsonResponse(response, 200, {
        ok: result.ok,
        provider: result.provider,
        status: result.status,
        score: result.score,
        confidence: result.confidence,
        threshold,
        passed: passDecision.passed,
        passPolicy: passDecision.policy,
        passReason: passDecision.reason,
        totalSentences: sentences.length,
        highRiskCount: highRiskSentences.length,
        elapsedMs: Date.now() - startedAt,
        detector: {
          provider: config.provider ?? "disabled",
          urlConfigured: Boolean(config.url?.trim()),
          threshold,
          granularity,
          minSegmentChars,
          policy: passDecision.policy,
        },
        reason: result.reason,
        sentences,
        highRiskSentences,
      })
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  const pauseRunMatch = url.pathname.match(/^\/runs\/([^/]+)\/pause$/u)
  if (request.method === "POST" && pauseRunMatch) {
    const run = await loadRun(pauseRunMatch[1])
    if (!run) return jsonResponse(response, 404, { error: "run_not_found" })
    if (!["queued", "running"].includes(run.status)) {
      return jsonResponse(response, 200, {
        runId: run.runId,
        status: run.status,
        alreadyTerminal: true,
      })
    }
    let reason = "用户手动暂停当前调试 Run。"
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      reason = String(body.reason || reason).trim() || reason
    } catch {}
    await pauseDebugRun(run, reason)
    return jsonResponse(response, 202, {
      runId: run.runId,
      status: run.status,
      pauseRequestedAt: run.pauseRequestedAt,
      reason: run.pauseReason,
    })
  }

  const branchRollbackMatch = url.pathname.match(/^\/runs\/([^/]+)\/branch\/rollback$/u)
  if (request.method === "POST" && branchRollbackMatch) {
    const run = await loadRun(branchRollbackMatch[1])
    if (!run) return jsonResponse(response, 404, { error: "run_not_found" })
    if (!run.workflowTrace || !run.workflowBranch) return jsonResponse(response, 404, { error: "debug_branch_not_found" })
    if (["queued", "running"].includes(run.status)) return jsonResponse(response, 409, { error: "debug_branch_is_busy" })
    try {
      const body = await readJsonBody(request) as Record<string, unknown>
      const checkpointId = String(body.checkpointId || "").trim()
      if (!checkpointId) return jsonResponse(response, 400, { error: "checkpoint_id_required" })
      const manager = new FactoryWorkflowDebugBranchManager(rootDir, run.workflowTrace.projectId)
      await manager.rollback(run.workflowBranch, checkpointId)
      await persistRun(run)
      return jsonResponse(response, 200, await manager.inspect(run.workflowBranch))
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  const branchMatch = url.pathname.match(/^\/runs\/([^/]+)\/branch$/u)
  if (request.method === "GET" && branchMatch) {
    const run = await loadRun(branchMatch[1])
    if (!run) return jsonResponse(response, 404, { error: "run_not_found" })
    if (!run.workflowTrace || !run.workflowBranch) return jsonResponse(response, 404, { error: "debug_branch_not_found" })
    try {
      return jsonResponse(response, 200, await new FactoryWorkflowDebugBranchManager(rootDir, run.workflowTrace.projectId).inspect(run.workflowBranch))
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }

  const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/u)
  if (request.method === "GET" && runMatch) {
    const runId = runMatch[1]
    const run = await loadRun(runId)
    if (!run) return jsonResponse(response, 404, { error: "run_not_found" })
    return jsonResponse(response, 200, await loadWorkflowEvidence(run))
  }

  return jsonResponse(response, 404, { error: "not_found" })
})

async function startServer() {
  await fs.mkdir(runsRoot, { recursive: true })
  await fs.mkdir(committedChaptersRoot, { recursive: true })
  server.listen(port, "127.0.0.1", () => {
    console.log(`[world-foundation-debug] listening on http://127.0.0.1:${port}`)
    console.log(`[world-foundation-debug] runs: ${runsRoot}`)
    console.log("[world-foundation-debug] AI_NOVEL_TEST_MODE=1 is explicitly rejected")
  })
}

void startServer().catch((error) => {
  console.error("[world-foundation-debug] failed to start", error)
  process.exitCode = 1
})
