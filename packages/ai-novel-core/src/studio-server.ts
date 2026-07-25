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
  withFactoryDb,
} from "./server-core"
import { syncCurrentContextPacketFile } from "./context-packet"
import { evaluateKnowledgeBenchmark, retrieveKnowledge, type KnowledgeBenchmarkCase, type KnowledgeBenchmarkResult } from "./knowledge"
import type { KnowledgeRecallRow, KnowledgeScope } from "./factory-db"
import { formatStatus, syncManagedProjectState } from "./orchestrator"
import { routeUserMessage } from "./router"
import { loadActiveLlmConfig, getCachedActiveLlmConfig, loadLlmConfigForCapability } from "./llm-config"
import { requestLlmTextCompletion } from "./runtime-llm"
import { detectAigcSegments, detectAigcText, getAigcDetectorConfig, type AigcBatchDetectionResult, type AigcDetectionConfig, type AigcTextSegment } from "./aigc-detector"
import { deriveProjectRuntimeState } from "./project-runtime-state"
import {
  repairAigcHighRiskDraft,
  runAigcWritingDetection,
  loadProductionWritingResources,
  normalizeAigcWritingDetectionReport,
  createContinuityContract,
  evaluateChapterStyleConformanceDrift,
  loadApprovedWritingStyleContext,
  writeAllDetailedChapterBlueprints,
  writeProductionMasterOutline,
  writeProductionStoryBibleAssets,
  type NovelWorkspacePaths,
} from "./writing-pipeline"
import {
  acceptStyleEvolutionCandidate,
  appendStyleEvolutionCandidate,
  approveStyleEvolutionSample,
  buildStyleEvolutionEvaluationPrompt,
  buildStyleEvolutionRefinementOnlyPrompt,
  buildStyleFreezeAdvicePrompt,
  buildStyleEvolutionCritiquePrompt,
  buildStyleEvolutionRefinement,
  buildStyleContractExtractionPrompt,
  buildStyleEvolutionCandidatePrompt,
  buildStyleGenerationVerification,
  appendStyleLoopRunLedger,
  createStyleLoopRuntimeRecord,
  evaluateStyleEvolutionCandidate,
  initializeStyleEvolution,
  loadStyleEvolution,
  normalizeStyleAigcSignal,
  parseStyleEvolutionEvaluationFromText,
  parseStyleEvolutionRefinementFromText,
  parseStyleFreezeAdviceFromText,
  parseStyleContractFromText,
  parseStyleEvolutionCritiqueFromText,
  persistStyleLoopRuntime,
  persistStyleEvolutionRuntimeState,
  rejectStyleEvolutionSample,
  type StyleEvolutionEvaluation,
  type StyleEvolutionRefinement,
  type StyleLoopRuntimeRecord,
} from "./production-style-evolution"
import {
  evaluateProductionReadiness,
  type ProductionGateResult,
  type StyleEvolutionContract,
} from "./production-contracts"

const PRODUCTION_DEFAULT_TOTAL_CHAPTERS = 40
const PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET = 3000

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

function mergeStyleEvaluationWithAigc<T extends StyleEvolutionEvaluation | null | undefined>(
  evaluation: T,
  aigcSignal: ReturnType<typeof normalizeStyleAigcSignal> | undefined,
): T {
  if (!evaluation || !aigcSignal) {
    return evaluation
  }
  return {
    ...evaluation,
    aigc: aigcSignal,
  } as T
}

function buildStyleFreezerGateRecord(
  freezeAdvice: ReturnType<typeof parseStyleFreezeAdviceFromText> | null | undefined,
  fallback: {
    evaluation?: StyleEvolutionEvaluation
    verification: ReturnType<typeof buildStyleGenerationVerification>
  },
) {
  const checkedAt = new Date().toISOString()
  if (freezeAdvice) {
    return {
      source: "llm_critic" as const,
      verdict: freezeAdvice.freezeVerdict,
      summary: freezeAdvice.freezeSummary,
      blockingReasons: freezeAdvice.blockingReasons,
      checkedAt,
    }
  }
  const blockingReasons = [
    fallback.verification.status !== "passed" ? "Generation Verification Gate 尚未通过。" : "",
  ].filter(Boolean)
  const cautionReasons = [
    Number(fallback.evaluation?.scores?.overall || 0) < 8.6 ? "综合评分尚未达到默认冻结阈值，建议用户确认前继续审阅。" : "",
    fallback.evaluation?.verdict !== "approve" ? "Evaluator 尚未判定当前样段可直接冻结，建议用户确认前继续审阅。" : "",
  ].filter(Boolean)
  return {
    source: "heuristic" as const,
    verdict: blockingReasons.length ? "continue" as const : "ready" as const,
    summary: blockingReasons.length
      ? "本轮缺少 LLM Freezer 结构化放行，继续收紧后再进入冻结确认。"
      : cautionReasons.length
        ? `本轮通过 Generation Verification Gate，可由用户确认是否冻结；${cautionReasons.join(" ")}`
        : "本轮通过本地 Freezer 兜底检查，可以进入冻结确认。",
    blockingReasons: blockingReasons.length ? blockingReasons : cautionReasons,
    checkedAt,
  }
}

function reinforceRefinementWithAigc(
  refinement: StyleEvolutionRefinement,
  aigcSignal: ReturnType<typeof normalizeStyleAigcSignal> | undefined,
) {
  if (aigcSignal?.status !== "blocked") {
    return refinement
  }
  return {
    ...refinement,
    summary: `${refinement.summary} 当前还需要继续压低 AI 腔与模板化表达。`.trim(),
    promptAdjustments: [
      ...new Set([
        ...(refinement.promptAdjustments || []),
        "减少解释性总结和模板化悬念，让动作、物件、停顿和关系冲突承担信息推进。",
        "避免均匀工整的 AI 腔句群，保留更自然的轻重变化与局部粗粝感。",
      ]),
    ],
    contractAdjustments: [
      ...new Set([
        ...(refinement.contractAdjustments || []),
        "把‘避免 AI 腔 / 模板腔 / 解释腔’写入 forbidden patterns 与章节继承规则。",
      ]),
    ],
  }
}

function isStyleEvaluatorDirectApproval(input: {
  evaluation?: StyleEvolutionEvaluation
  verification: ReturnType<typeof buildStyleGenerationVerification>
  retryPolicy: NonNullable<StyleEvolutionContract["retryPolicy"]>
  totalRounds: number
}) {
  const overall = Number(input.evaluation?.scores?.overall || 0)
  const forbiddenHits = input.evaluation?.forbiddenHits?.length || 0
  return Boolean(
    input.evaluation?.source === "llm_critic"
    && input.evaluation.verdict === "approve"
    && input.verification.status === "passed"
    && overall >= Number(input.retryPolicy.approvalScoreThreshold || 8.6)
    && forbiddenHits <= Math.max(0, Number(input.retryPolicy.maxForbiddenHitCount || 1))
    && input.totalRounds >= Math.max(1, Number(input.retryPolicy.approvalMinRounds || 2)),
  )
}

function buildEvaluatorApprovedRefinement(input: {
  evaluation: StyleEvolutionEvaluation
  prompt: string
  aigcSignal: ReturnType<typeof normalizeStyleAigcSignal> | undefined
}): StyleEvolutionRefinement {
  const promptAdjustments = input.evaluation.nextFocus?.length
    ? input.evaluation.nextFocus
    : ["保持 evaluator 已确认的叙事声音、节奏和人物区分。"]
  const contractAdjustments = [
    ...input.evaluation.strengths.slice(0, 3),
    ...input.evaluation.deviations.slice(0, 2).map((item) => `冻结后继续规避：${item}`),
  ].filter(Boolean)
  return reinforceRefinementWithAigc({
    source: "llm_critic",
    summary: "Evaluator 已判定当前样段可进入冻结确认，跳过额外 refiner 请求以避免达标后继续消耗模型调用。",
    promptAdjustments,
    contractAdjustments,
    nextPrompt: input.prompt,
  }, input.aigcSignal)
}

async function detectStyleAigcSignal(
  sample: string,
  config: AigcDetectionConfig,
  context: string,
): Promise<ReturnType<typeof normalizeStyleAigcSignal>> {
  const diagnostics = {
    urlConfigured: Boolean(config.url?.trim()),
    context,
  }
  try {
    const result = await detectAigcSegments(sample, config)
    return normalizeStyleAigcSignal(result, diagnostics)
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

function redactLlmRoutes(routes: Record<string, unknown>[]) {
  return routes.map((route) => ({
    capability: route.capability,
    config_id: route.config_id,
    name: route.name,
    base_url: route.base_url,
    model_name: route.model_name,
    api_mode: route.api_mode || "chat",
    updated_at: route.updated_at,
  }))
}

function normalizeLlmApiMode(value: unknown) {
  return String(value || "chat").trim().toLowerCase() === "responses" ? "responses" : "chat"
}

async function loadStyleEvolutionLlmConfig(rootDir: string) {
  return (
    await loadLlmConfigForCapability(rootDir, "style_evolution")
  ) || (
    await loadLlmConfigForCapability(rootDir, "text")
  )
}

const DRAFT_SUBCALL_ROLE_VALUES = ["plot", "narration", "dialogue", "character_action", "continuity", "assembly"] as const

function normalizeDraftSubcallRoles(value: unknown) {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((role): role is string => typeof role === "string")
    .map((role) => role.trim())
    .filter((role) => DRAFT_SUBCALL_ROLE_VALUES.includes(role as typeof DRAFT_SUBCALL_ROLE_VALUES[number])))]
}

function parseDraftSubcallRolesSetting(value: string | null | undefined) {
  return normalizeDraftSubcallRoles(value ? value.split(",") : [])
}

function normalizeAigcDetectorProviderSetting(value: unknown) {
  return value === "local-heuristic" || value === "generic-json" || value === "gradio-queue" || value === "disabled"
    ? value
    : "local-heuristic"
}

function readAigcDetectorSettingsFromDb(db: { getSystemSetting: (key: string) => string | null }) {
  const readNumber = (key: string, fallback: number) => {
    const rawValue = db.getSystemSetting(key)
    if (rawValue === null || rawValue === undefined || rawValue.trim() === "") {
      return fallback
    }
    const value = Number(rawValue)
    return Number.isFinite(value) ? value : fallback
  }
  return {
    provider: normalizeAigcDetectorProviderSetting(db.getSystemSetting("aigcDetectorProvider")),
    url: db.getSystemSetting("aigcDetectorUrl") || "",
    tokenConfigured: Boolean(db.getSystemSetting("aigcDetectorToken")),
    timeoutMs: readNumber("aigcDetectorTimeoutMs", 30000),
    threshold: readNumber("aigcDetectorThreshold", 0.8),
    requestTextField: db.getSystemSetting("aigcDetectorRequestTextField") || "",
    headersJson: db.getSystemSetting("aigcDetectorHeadersJson") || "",
    segmentMaxChars: readNumber("aigcDetectorSegmentMaxChars", 900),
    segmentMinChars: readNumber("aigcDetectorSegmentMinChars", 180),
    gradioFnIndex: db.getSystemSetting("aigcDetectorGradioFnIndex") || "",
    gradioSessionHashConfigured: Boolean(db.getSystemSetting("aigcDetectorGradioSessionHash")),
    gradioJoinUrl: db.getSystemSetting("aigcDetectorGradioJoinUrl") || "",
    gradioDataUrl: db.getSystemSetting("aigcDetectorGradioDataUrl") || "",
    gradioSkipJoin: db.getSystemSetting("aigcDetectorGradioSkipJoin") === "1",
    gradioInputsJson: db.getSystemSetting("aigcDetectorGradioInputsJson") || "",
  }
}

function writeAigcDetectorSettingsToDb(db: { setSystemSetting: (key: string, value: string) => void }, settings: Record<string, unknown>) {
  const detector = settings.aigcDetector && typeof settings.aigcDetector === "object" && !Array.isArray(settings.aigcDetector)
    ? settings.aigcDetector as Record<string, unknown>
    : null
  if (!detector) return

  const setString = (key: string, value: unknown) => {
    if (typeof value === "string") {
      db.setSystemSetting(key, value.trim())
    }
  }
  const setNumber = (key: string, value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      db.setSystemSetting(key, String(value))
    } else if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      db.setSystemSetting(key, String(Number(value)))
    }
  }
  const setSecret = (key: string, value: unknown) => {
    if (typeof value === "string" && value !== "[configured]") {
      db.setSystemSetting(key, value.trim())
    }
  }

  db.setSystemSetting("aigcDetectorProvider", normalizeAigcDetectorProviderSetting(detector.provider))
  setString("aigcDetectorUrl", detector.url)
  setSecret("aigcDetectorToken", detector.token)
  setNumber("aigcDetectorTimeoutMs", detector.timeoutMs)
  setNumber("aigcDetectorThreshold", detector.threshold)
  setString("aigcDetectorRequestTextField", detector.requestTextField)
  setString("aigcDetectorHeadersJson", detector.headersJson)
  setNumber("aigcDetectorSegmentMaxChars", detector.segmentMaxChars)
  setNumber("aigcDetectorSegmentMinChars", detector.segmentMinChars)
  setNumber("aigcDetectorGradioFnIndex", detector.gradioFnIndex)
  setSecret("aigcDetectorGradioSessionHash", detector.gradioSessionHash)
  setString("aigcDetectorGradioJoinUrl", detector.gradioJoinUrl)
  setString("aigcDetectorGradioDataUrl", detector.gradioDataUrl)
  if (typeof detector.gradioSkipJoin === "boolean") {
    db.setSystemSetting("aigcDetectorGradioSkipJoin", detector.gradioSkipJoin ? "1" : "0")
  }
  setString("aigcDetectorGradioInputsJson", detector.gradioInputsJson)
}

function resolveStyleLoopIterations(value: unknown, fallback: number) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number.parseInt(value, 10)
      : NaN
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(1, Math.min(8, parsed))
}

function resolveStyleCandidateCount(value: unknown, fallback: number) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number.parseInt(value, 10)
      : NaN
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(1, Math.min(4, parsed))
}

function normalizeStylePreviewText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

const STYLE_FREEZE_CONTRACT_EXTRACTION_MAX_TOKENS = 4200
const STYLE_FREEZE_ADVICE_MAX_TOKENS = 1800

function buildLocalFallbackStyleContract(sample: string, prompt = "") {
  const shortSample = sample.replace(/\s+/g, " ").trim().slice(0, 120)
  const voice = prompt.match(/克制|冷感|轻松|幽默|热血|悬疑|古风|白描/u)?.[0]
  return {
    voice: voice ? `${voice}，以用户确认样段为最高写法参照。` : "以用户确认样段为最高写法参照。",
    sentenceRhythm: "保持样段中的句长、停顿、动作密度和情绪留白。",
    dialogueRules: ["对白必须服务关系压力和当前利益，不写同质化解释腔。"],
    descriptionRules: ["描写先给物件、动作、声音、气味和身体反应，再给判断。"],
    emotionRules: ["情绪通过选择、停顿、动作和细节外化，减少直接说明。"],
    pacingRules: ["每个样段都要有压力进入、选择推进和余波钩子。"],
    povRules: ["保持稳定视角，不越权泄露未到场角色或未来信息。"],
    openingRules: ["开场优先落在具体场景压力上。"],
    endingHookRules: ["结尾留下可追踪的问题、关系裂缝或线索。"],
    forbiddenPatterns: ["不要总结式升华", "不要模板化转折词", "不要解释创作意图"],
    positiveExamples: shortSample ? [shortSample] : [],
    negativeExamples: [],
  }
}

function isOpenStudioStyleEntry(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined,
  rejectedVersion?: number,
) {
  if (!entry) return false
  if (entry.userDecision === "accepted") return false
  if (entry.userDecision === "superseded") return false
  if (rejectedVersion && entry.version === rejectedVersion) return false
  return true
}

function studioStyleEntryVerification(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined,
) {
  if (!entry) return buildStyleGenerationVerification({})
  return entry.verification || buildStyleGenerationVerification({
    evaluation: entry.evaluation as StyleEvolutionEvaluation | undefined,
    sample: entry.sample,
    version: entry.version,
    checkedAt: entry.createdAt,
  })
}

function hasStudioStyleEntryEvaluation(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined,
) {
  return Boolean(entry?.evaluation || entry?.verification)
}

function assertFreezableStudioStyleEntry(input: {
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined
  rejectedVersion?: number
}) {
  if (!input.entry) {
    throw new Error("style_candidate_not_found")
  }
  if (!isOpenStudioStyleEntry(input.entry, input.rejectedVersion)) {
    throw new Error("style_candidate_rejected")
  }
  const verification = studioStyleEntryVerification(input.entry)
  if (verification.status === "blocked") {
    throw new Error("style_generation_verification_blocked")
  }
  if (hasStudioStyleEntryEvaluation(input.entry) && verification.status !== "passed") {
    throw new Error("style_candidate_not_verified")
  }
  if (input.entry.userDecision !== "accepted_for_freeze") {
    throw new Error("style_candidate_not_user_accepted")
  }
}

async function readStyleEvolutionAssetSnapshot(projectRoot: string) {
  const styleRoot = path.join(projectRoot, ".ai-novel", "style")
  const evolutionRoot = path.join(styleRoot, "evolution")
  const readAsset = async (assetPath: string) => {
    try {
      const content = await fs.readFile(assetPath, "utf8")
      const trimmed = content.trim()
      return {
        path: path.relative(projectRoot, assetPath),
        exists: true,
        chars: trimmed.length,
        preview: trimmed.slice(0, 420),
      }
    } catch {
      return {
        path: path.relative(projectRoot, assetPath),
        exists: false,
        chars: 0,
        preview: "",
      }
    }
  }

  return {
    freezePackage: {
      approvedSample: await readAsset(path.join(evolutionRoot, "user-approved-sample.md")),
      freezeLedger: await readAsset(path.join(evolutionRoot, "style-freeze-ledger.json")),
      loopRuntime: await readAsset(path.join(evolutionRoot, "style-loop-runtime.json")),
      loopRuns: await readAsset(path.join(evolutionRoot, "style-loop-runs.jsonl")),
    },
    chapterInheritance: {
      rulebook: await readAsset(path.join(styleRoot, "rulebook.md")),
      references: await readAsset(path.join(styleRoot, "references.md")),
      antiPatterns: await readAsset(path.join(styleRoot, "anti-patterns.md")),
    },
  }
}

function styleEvolutionArtifactItems(styleEvolutionAssets: Record<string, any> | null | undefined, options: { includeApprovedSample?: boolean } = {}) {
  const freezePackage = styleEvolutionAssets?.freezePackage || {}
  const fromSnapshot = (key: string, label: string, kind = "style") => {
    const asset = freezePackage?.[key] || {}
    return {
      path: typeof asset.path === "string" && asset.path.trim() ? asset.path.trim() : "",
      label,
      kind,
      status: asset.exists === false ? "missing" : "completed",
      chars: typeof asset.chars === "number" ? asset.chars : undefined,
    }
  }
  return [
    { path: ".ai-novel/style/evolution/style-contract.json", label: "Style contract", kind: "style-contract", status: "completed" },
    { path: ".ai-novel/style/evolution/style-evolution-history.json", label: "Style evolution history", kind: "style-history", status: "completed" },
    fromSnapshot("freezeLedger", "Style freeze ledger", "style-freeze-ledger"),
    fromSnapshot("loopRuntime", "Style loop runtime", "style-loop-runtime"),
    fromSnapshot("loopRuns", "Style loop runs", "style-loop-runs"),
    ...(options.includeApprovedSample ? [fromSnapshot("approvedSample", "User approved sample", "style-approved-sample")] : []),
  ].filter((item) => item.path && item.status !== "missing")
}

async function buildStyleEvolutionWorkspacePayload(
  rootDir: string,
  context: { projectRoot: string; projectId: string },
  state?: Awaited<ReturnType<typeof loadAutonomousState>> | null,
) {
  const [styleEvolution, styleEvolutionAssets, workspacePayload] = await Promise.all([
    loadStyleEvolution(context.projectRoot),
    readStyleEvolutionAssetSnapshot(context.projectRoot),
    createWorkspacePayload(context.projectRoot, state ?? null, {
      rootDir,
      projectId: context.projectId,
      includeTranscript: false,
      compactPayload: true,
    }),
  ])

  return {
    styleEvolution,
    styleEvolutionAssets,
    projectRuntime: workspacePayload.projectRuntime,
    productionReadiness: workspacePayload.productionReadiness,
    factorySnapshot: workspacePayload.factorySnapshot,
    snapshotVersion: workspacePayload.snapshotVersion,
  }
}

async function buildStyleEvolutionWorkspacePayloadSafe(
  rootDir: string,
  context: { projectRoot: string; projectId: string },
  state?: Awaited<ReturnType<typeof loadAutonomousState>> | null,
) {
  try {
    return await buildStyleEvolutionWorkspacePayload(rootDir, context, state)
  } catch (error) {
    console.warn("Style evolution workspace snapshot failed; returning minimal style state.", error)
    const [styleEvolution, styleEvolutionAssets] = await Promise.all([
      loadStyleEvolution(context.projectRoot).catch(() => null),
      readStyleEvolutionAssetSnapshot(context.projectRoot).catch(() => null),
    ])
    return {
      styleEvolution,
      styleEvolutionAssets,
      projectRuntime: null,
      productionReadiness: null,
      factorySnapshot: null,
      snapshotVersion: null,
    }
  }
}

async function buildStyleFreezePreview(input: {
  projectRoot: string
  rootDir: string
  version?: number
  sample?: string
  frozenBasePrompt?: string
  antiPatterns?: string[]
}) {
  const currentStyleEvolution = await loadStyleEvolution(input.projectRoot)
  const history = Array.isArray(currentStyleEvolution.contract.evolutionHistory)
    ? currentStyleEvolution.contract.evolutionHistory
    : []
  const selected = Number.isFinite(input.version) ? history.find((entry) => entry.version === input.version) : history.at(-1)
  if (history.length > 0) {
    assertFreezableStudioStyleEntry({
      entry: selected,
      rejectedVersion: currentStyleEvolution.contract.approval?.status === "rejected"
        ? currentStyleEvolution.contract.approval.rejectedVersion
        : undefined,
    })
  }
  const sampleForExtraction = normalizeStylePreviewText(input.sample) || selected?.sample || currentStyleEvolution.contract.approvedSample || ""
  if (!sampleForExtraction.trim()) {
    throw new Error("style_freeze_preview_requires_sample")
  }
  const promptForExtraction = selected?.prompt || currentStyleEvolution.contract.userStylePrompt || currentStyleEvolution.contract.seedPrompt || ""
  let styleContract: NonNullable<StyleEvolutionContract["styleContract"]> = buildLocalFallbackStyleContract(sampleForExtraction, promptForExtraction)
  let contractExtractionSource: "llm_critic" | "local_fallback" = "local_fallback"
  let freezeAdviceSource: "llm_critic" | "local_fallback" = "local_fallback"
  const fallbackReasons: string[] = []
  let freezeAdvice = null
  const frozenBasePrompt = normalizeStylePreviewText(input.frozenBasePrompt)
    || normalizeStylePreviewText(selected?.refinement?.nextPrompt)
    || currentStyleEvolution.contract.frozenBasePrompt
    || promptForExtraction
  const textConfig = await loadStyleEvolutionLlmConfig(input.rootDir)
  const apiKey = textConfig?._dbApiKey || ""

  if (textConfig && apiKey) {
    try {
      const extractionPrompt = buildStyleContractExtractionPrompt({
        sample: sampleForExtraction,
        prompt: promptForExtraction,
        userStylePrompt: currentStyleEvolution.contract.userStylePrompt,
        referenceText: currentStyleEvolution.contract.referenceText,
        referenceWorks: currentStyleEvolution.contract.referenceWorks,
        desiredVibes: currentStyleEvolution.contract.desiredVibes,
        seedForbiddenPatterns: currentStyleEvolution.contract.seedForbiddenPatterns,
      })
      const rawContract = await requestLlmTextCompletion({
        baseUrl: textConfig.provider.baseUrl,
        apiKey,
        modelName: textConfig.provider.modelName,
        apiMode: textConfig.provider.apiMode,
        timeoutMs: textConfig.provider.timeoutMs,
        temperature: 0.1,
        maxTokens: STYLE_FREEZE_CONTRACT_EXTRACTION_MAX_TOKENS,
        messages: [
          { role: "system", content: extractionPrompt.system },
          { role: "user", content: extractionPrompt.user },
        ],
      })
      const parsedContract = parseStyleContractFromText(rawContract)
      if (parsedContract) {
        styleContract = parsedContract
        contractExtractionSource = "llm_critic"
      } else {
        fallbackReasons.push("style_contract_parse_failed")
      }
    } catch (error) {
      fallbackReasons.push(`style_contract_extraction_failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 360))
      console.warn("Style freeze preview contract extraction failed; falling back to deterministic contract.", error)
    }

    try {
      const freezePrompt = buildStyleFreezeAdvicePrompt({
        sample: sampleForExtraction,
        prompt: promptForExtraction,
        userStylePrompt: currentStyleEvolution.contract.userStylePrompt,
        referenceText: currentStyleEvolution.contract.referenceText,
        referenceWorks: currentStyleEvolution.contract.referenceWorks,
        desiredVibes: currentStyleEvolution.contract.desiredVibes,
        seedForbiddenPatterns: currentStyleEvolution.contract.seedForbiddenPatterns,
        evaluation: selected?.evaluation as StyleEvolutionEvaluation | undefined,
        refinement: selected?.refinement as StyleEvolutionRefinement | undefined,
      })
      const rawFreezeAdvice = await requestLlmTextCompletion({
        baseUrl: textConfig.provider.baseUrl,
        apiKey,
        modelName: textConfig.provider.modelName,
        apiMode: textConfig.provider.apiMode,
        timeoutMs: textConfig.provider.timeoutMs,
        temperature: 0.1,
        maxTokens: STYLE_FREEZE_ADVICE_MAX_TOKENS,
        messages: [
          { role: "system", content: freezePrompt.system },
          { role: "user", content: freezePrompt.user },
        ],
      })
      freezeAdvice = parseStyleFreezeAdviceFromText(rawFreezeAdvice)
      if (freezeAdvice) {
        freezeAdviceSource = "llm_critic"
      } else {
        fallbackReasons.push("style_freeze_advice_parse_failed")
      }
    } catch (error) {
      fallbackReasons.push(`style_freeze_advice_failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 360))
      console.warn("Style freeze preview advice extraction failed; continuing with local fallback.", error)
    }
  } else {
    fallbackReasons.push(textConfig ? "style_freeze_preview_api_key_missing" : "style_freeze_preview_model_config_missing")
  }

  const mergedAntiPatterns = [
    ...(Array.isArray(input.antiPatterns) ? input.antiPatterns : []),
    ...(styleContract.forbiddenPatterns || []),
    ...(freezeAdvice?.forbiddenPatterns || []),
  ].filter(Boolean)
  const uniqueAntiPatterns = [...new Set(mergedAntiPatterns)]
  const positiveExamples = [...new Set([
    ...(styleContract.positiveExamples || []),
    ...(freezeAdvice?.positiveExamples || []),
  ])]
  const inheritedRules = [...new Set([
    ...(freezeAdvice?.inheritedRules || []),
    "后续每章必须继承用户冻结后的 base writing prompt。",
    "后续每章必须继承 style contract 中的 voice、节奏、对白与禁忌约束。",
    "正文生产不得绕过已冻结样段重新自由发挥。",
  ])]
  const freezeSummary = freezeAdvice?.freezeSummary
    || currentStyleEvolution.contract.approval?.freezeSummary
    || (selected?.readyReasons?.length
      ? `如果现在冻结，将以 v${selected.version} 作为全书统一写法合同：${selected.readyReasons.join(" ")}`
      : selected?.version
        ? `如果现在冻结，将以 v${selected.version} 作为全书统一写法合同。`
        : "如果现在冻结，将按当前样段冻结为全书统一写法合同。")
  const previewVerification = buildStyleGenerationVerification({
    evaluation: selected?.evaluation as StyleEvolutionEvaluation | undefined,
    sample: sampleForExtraction,
    version: selected?.version,
    checkedAt: selected?.createdAt,
  })
  const freezer = buildStyleFreezerGateRecord(freezeAdvice, {
    evaluation: selected?.evaluation as StyleEvolutionEvaluation,
    verification: previewVerification,
  })

  return {
    version: selected?.version || null,
    sample: sampleForExtraction,
    frozenBasePrompt,
    freezeSummary,
    styleContract,
    antiPatterns: uniqueAntiPatterns,
    positiveExamples,
    inheritedArtifacts: ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"],
    inheritedRules,
    evaluation: selected?.evaluation || null,
    refinement: selected?.refinement || null,
    freezer,
    llmFallbackUsed: contractExtractionSource !== "llm_critic" || freezeAdviceSource !== "llm_critic",
    fallbackReasons: [...new Set(fallbackReasons.filter(Boolean))],
    contractExtractionSource,
    freezeAdviceSource,
    contractAdjustments: freezeAdvice?.contractAdjustments || selected?.refinement?.contractAdjustments || [],
    approvalScope: "whole_book",
  }
}

async function runStyleEvolutionLoop(options: {
  projectRoot: string
  rootDir: string
  projectTitle?: string
  idea?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  iterationFeedback?: string
  textConfig: NonNullable<Awaited<ReturnType<typeof loadLlmConfigForCapability>>>
  apiKey: string
  maxIterations: number
  candidateCount: number
}) {
  const STYLE_EVALUATION_MAX_TOKENS = 2200
  const STYLE_REFINEMENT_MAX_TOKENS = 2200
  const STYLE_FREEZE_MAX_TOKENS = 1800
  const STYLE_COMBINED_CRITIC_MAX_TOKENS = 2600
  const STYLE_JSON_REPAIR_MAX_TOKENS = 2600
  let styleEvolution = await loadStyleEvolution(options.projectRoot)
  const iterations = []
  const loopRuntime = createStyleLoopRuntimeRecord({
    projectTitle: options.projectTitle,
    idea: options.idea,
    userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
    referenceText: options.referenceText || styleEvolution.contract.referenceText,
    referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
    desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
    seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
    iterationFeedback: options.iterationFeedback,
    requestedIterations: options.maxIterations,
  })
  await persistStyleLoopRuntime(options.projectRoot, loopRuntime)
  await persistStyleEvolutionRuntimeState(options.projectRoot, {
    lastRunId: loopRuntime.runId,
    lastRunStatus: "running",
  })
  const retryPolicy = styleEvolution.contract.retryPolicy || {}
  const approvalThreshold = Number(retryPolicy.approvalScoreThreshold || 8.6)
  const approvalMinRounds = Math.max(1, Number(retryPolicy.approvalMinRounds || 2))
  const maxForbiddenHitCount = Math.max(0, Number(retryPolicy.maxForbiddenHitCount || 1))
  let stopReason = "max_iterations_reached"
  const repairStyleJson = async (kind: "evaluation" | "refinement" | "freezer", rawText: string) => requestLlmTextCompletion({
    baseUrl: options.textConfig.provider.baseUrl,
    apiKey: options.apiKey,
    modelName: options.textConfig.provider.modelName,
    apiMode: options.textConfig.provider.apiMode,
    timeoutMs: options.textConfig.provider.timeoutMs,
    temperature: 0,
    maxTokens: STYLE_JSON_REPAIR_MAX_TOKENS,
    messages: [
      {
        role: "system",
        content: [
          "你是 JSON 修复器。只输出严格 JSON，不要解释。",
          "不得新增评价观点，只能把输入中已有的信息整理进指定结构。",
          "如果缺少字段，用空数组、空字符串或保守默认值补齐。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `目标结构：${kind}`,
          kind === "evaluation"
            ? "输出形如 {\"evaluation\":{\"verdict\":\"candidate|approve|reject\",\"summary\":\"...\",\"scores\":{\"overall\":0},\"strengths\":[],\"deviations\":[],\"forbiddenHits\":[],\"nextFocus\":[]}}"
            : kind === "refinement"
              ? "输出形如 {\"refinement\":{\"summary\":\"...\",\"promptAdjustments\":[],\"contractAdjustments\":[],\"nextPrompt\":\"\"}}"
              : "输出形如 {\"freezeVerdict\":\"ready|continue|block\",\"freezeSummary\":\"...\",\"blockingReasons\":[],\"contractAdjustments\":[],\"forbiddenPatterns\":[],\"positiveExamples\":[],\"inheritedRules\":[]}",
          "待修复文本：",
          rawText,
        ].join("\n\n"),
      },
    ],
  })

  for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
    const latest = Array.isArray(styleEvolution.contract.evolutionHistory)
      ? styleEvolution.contract.evolutionHistory.at(-1)
      : null
    const carriedFeedback = [
      options.iterationFeedback,
      styleEvolution.contract.approval?.status === "rejected" && styleEvolution.contract.approval?.rejectionReason
        ? `用户刚刚拒绝上一轮，必须修正：${styleEvolution.contract.approval.rejectionReason}`
        : "",
      latest?.rejectionReason
        ? `上一轮被用户退回，原因：${latest.rejectionReason}`
        : "",
    ].filter(Boolean).join("\n")
    const promptBundle = buildStyleEvolutionCandidatePrompt({
      projectTitle: options.projectTitle,
      idea: options.idea,
      userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
      referenceText: options.referenceText || styleEvolution.contract.referenceText,
      referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
      desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
      seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
      seedPrompt: latest?.refinement?.nextPrompt
        || styleEvolution.contract.frozenBasePrompt
        || styleEvolution.contract.seedPrompt,
      priorSample: latest?.sample,
      iterationFeedback: carriedFeedback,
    })
    const runtimeIteration = {
      iteration: iteration + 1,
      startedAt: new Date().toISOString(),
      seedPrompt: latest?.refinement?.nextPrompt
        || styleEvolution.contract.frozenBasePrompt
        || styleEvolution.contract.seedPrompt,
      prompt: promptBundle.prompt,
      stage: "generated" as const,
    }

    const generatedCandidates = []
    for (let candidateIndex = 0; candidateIndex < options.candidateCount; candidateIndex += 1) {
      const sample = await requestLlmTextCompletion({
        baseUrl: options.textConfig.provider.baseUrl,
        apiKey: options.apiKey,
        modelName: options.textConfig.provider.modelName,
        apiMode: options.textConfig.provider.apiMode,
        timeoutMs: options.textConfig.provider.timeoutMs,
        temperature: Math.max(0.3, options.textConfig.provider.temperature || 0.8) + candidateIndex * 0.1,
        maxTokens: 1200,
        messages: [
          { role: "system", content: promptBundle.system },
          { role: "user", content: `${promptBundle.user}\n\n候选编号：${candidateIndex + 1}/${options.candidateCount}。请保持同一写法目标，但尝试不同的落点组织。 ` },
        ],
      })
      if (!sample.trim()) {
        throw new Error("style_candidate_empty_response")
      }
      generatedCandidates.push({
        candidateIndex: candidateIndex + 1,
        sample,
      })
    }

    const candidateRuns = []
    for (const generatedCandidate of generatedCandidates) {
      const sample = generatedCandidate.sample
      let aigcSignal: ReturnType<typeof normalizeStyleAigcSignal> | undefined
      const aigcConfig = getAigcDetectorConfig(options.projectRoot)
      aigcSignal = await detectStyleAigcSignal(sample, aigcConfig, "style-evolution-loop")
      let evaluation = evaluateStyleEvolutionCandidate({
        prompt: promptBundle.prompt,
        sample,
        userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
        iterationFeedback: carriedFeedback,
        aigc: aigcSignal,
      })
      let refinement = buildStyleEvolutionRefinement({
        prompt: promptBundle.prompt,
        userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
        evaluation,
        iterationFeedback: carriedFeedback,
      })
      refinement = reinforceRefinementWithAigc(refinement, aigcSignal)
      let freezeAdvice: ReturnType<typeof parseStyleFreezeAdviceFromText> = null
      const fallbackReasons: string[] = []
      try {
        const evaluationPrompt = buildStyleEvolutionEvaluationPrompt({
          projectTitle: options.projectTitle,
          idea: options.idea,
          userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
          referenceText: options.referenceText || styleEvolution.contract.referenceText,
          referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
          desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
          seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
          prompt: promptBundle.prompt,
          sample,
          priorSample: latest?.sample,
          iterationFeedback: carriedFeedback,
        })
        const rawEvaluation = await requestLlmTextCompletion({
          baseUrl: options.textConfig.provider.baseUrl,
          apiKey: options.apiKey,
          modelName: options.textConfig.provider.modelName,
          apiMode: options.textConfig.provider.apiMode,
          timeoutMs: options.textConfig.provider.timeoutMs,
          temperature: 0.1,
          maxTokens: STYLE_EVALUATION_MAX_TOKENS,
          messages: [
            { role: "system", content: evaluationPrompt.system },
            { role: "user", content: evaluationPrompt.user },
          ],
        })
        let parsedEvaluation = parseStyleEvolutionEvaluationFromText(rawEvaluation)
        if (!parsedEvaluation) {
          try {
            parsedEvaluation = parseStyleEvolutionEvaluationFromText(await repairStyleJson("evaluation", rawEvaluation))
          } catch (repairError) {
            fallbackReasons.push(`evaluation_json_repair_failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`.slice(0, 360))
          }
        }
        if (!parsedEvaluation) {
          fallbackReasons.push(`evaluation_parse_failed: ${rawEvaluation.slice(0, 180).replace(/\s+/gu, " ")}`)
        }
        if (parsedEvaluation) {
          evaluation = mergeStyleEvaluationWithAigc(parsedEvaluation.evaluation, aigcSignal)
        }

        const directApprovalVerification = buildStyleGenerationVerification({
          evaluation,
          sample,
          checkedAt: new Date().toISOString(),
        })
        if (isStyleEvaluatorDirectApproval({
          evaluation,
          verification: directApprovalVerification,
          retryPolicy,
          totalRounds: Number(styleEvolution.contract.loop?.currentIteration || styleEvolution.contract.evolutionHistory?.length || 0) + 1,
        })) {
          refinement = buildEvaluatorApprovedRefinement({
            evaluation,
            prompt: promptBundle.prompt,
            aigcSignal,
          })
          freezeAdvice = {
            freezeVerdict: "ready",
            freezeSummary: "Evaluator direct approval: 当前样段已达到可冻结写法底盘。",
            blockingReasons: [],
            contractAdjustments: refinement.contractAdjustments || [],
            forbiddenPatterns: [],
            positiveExamples: evaluation.strengths.slice(0, 4),
            inheritedRules: refinement.promptAdjustments || [],
          }
        } else {
          const refinementPrompt = buildStyleEvolutionRefinementOnlyPrompt({
            projectTitle: options.projectTitle,
            idea: options.idea,
            userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
            referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
            desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
            seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
            prompt: promptBundle.prompt,
            sample,
            evaluation,
            iterationFeedback: carriedFeedback,
          })
          const rawRefinement = await requestLlmTextCompletion({
            baseUrl: options.textConfig.provider.baseUrl,
            apiKey: options.apiKey,
            modelName: options.textConfig.provider.modelName,
            apiMode: options.textConfig.provider.apiMode,
            timeoutMs: options.textConfig.provider.timeoutMs,
            temperature: 0.1,
            maxTokens: STYLE_REFINEMENT_MAX_TOKENS,
            messages: [
              { role: "system", content: refinementPrompt.system },
              { role: "user", content: refinementPrompt.user },
            ],
          })
          let parsedRefinement = parseStyleEvolutionRefinementFromText(rawRefinement)
          if (!parsedRefinement) {
            try {
              parsedRefinement = parseStyleEvolutionRefinementFromText(await repairStyleJson("refinement", rawRefinement))
            } catch (repairError) {
              fallbackReasons.push(`refinement_json_repair_failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`.slice(0, 360))
            }
          }
          if (!parsedRefinement) {
            fallbackReasons.push(`refinement_parse_failed: ${rawRefinement.slice(0, 180).replace(/\s+/gu, " ")}`)
          }
          if (parsedRefinement) {
            refinement = reinforceRefinementWithAigc(parsedRefinement.refinement, aigcSignal)
          }

          const freezePrompt = buildStyleFreezeAdvicePrompt({
            sample,
            prompt: promptBundle.prompt,
            userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
            referenceText: options.referenceText || styleEvolution.contract.referenceText,
            referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
            desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
            seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
            evaluation,
            refinement,
          })
          const rawFreezeAdvice = await requestLlmTextCompletion({
            baseUrl: options.textConfig.provider.baseUrl,
            apiKey: options.apiKey,
            modelName: options.textConfig.provider.modelName,
            apiMode: options.textConfig.provider.apiMode,
            timeoutMs: options.textConfig.provider.timeoutMs,
            temperature: 0.1,
            maxTokens: STYLE_FREEZE_MAX_TOKENS,
            messages: [
              { role: "system", content: freezePrompt.system },
              { role: "user", content: freezePrompt.user },
            ],
          })
          freezeAdvice = parseStyleFreezeAdviceFromText(rawFreezeAdvice)
          if (!freezeAdvice) {
            try {
              freezeAdvice = parseStyleFreezeAdviceFromText(await repairStyleJson("freezer", rawFreezeAdvice))
            } catch (repairError) {
              fallbackReasons.push(`freezer_json_repair_failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`.slice(0, 360))
            }
          }
          if (!freezeAdvice) {
            fallbackReasons.push(`freezer_parse_failed: ${rawFreezeAdvice.slice(0, 180).replace(/\s+/gu, " ")}`)
          }
          if (freezeAdvice) {
            refinement = {
              ...refinement,
              contractAdjustments: [
                ...new Set([...(refinement.contractAdjustments || []), ...(freezeAdvice.contractAdjustments || [])]),
              ],
            }
          }
        }
      } catch (error) {
        fallbackReasons.push(`split_chain_failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 360))
        try {
          const critiquePrompt = buildStyleEvolutionCritiquePrompt({
            projectTitle: options.projectTitle,
            idea: options.idea,
            userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
            referenceText: options.referenceText || styleEvolution.contract.referenceText,
            referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
            desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
            seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
            prompt: promptBundle.prompt,
            sample,
            priorSample: latest?.sample,
            iterationFeedback: carriedFeedback,
          })
          const rawCritique = await requestLlmTextCompletion({
            baseUrl: options.textConfig.provider.baseUrl,
            apiKey: options.apiKey,
            modelName: options.textConfig.provider.modelName,
            apiMode: options.textConfig.provider.apiMode,
            timeoutMs: options.textConfig.provider.timeoutMs,
            temperature: 0.1,
            maxTokens: STYLE_COMBINED_CRITIC_MAX_TOKENS,
            messages: [
              { role: "system", content: critiquePrompt.system },
              { role: "user", content: critiquePrompt.user },
            ],
          })
          const parsedCritique = parseStyleEvolutionCritiqueFromText(rawCritique)
          if (parsedCritique) {
            evaluation = mergeStyleEvaluationWithAigc(parsedCritique.evaluation, aigcSignal)
            refinement = reinforceRefinementWithAigc(parsedCritique.refinement, aigcSignal)
            fallbackReasons.push("split_chain_recovered_by_combined_critic")
          }
        } catch (fallbackError) {
          fallbackReasons.push(`combined_critic_failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`.slice(0, 360))
          console.warn("Style evolution multi-role chain failed; falling back to heuristic evaluator/refiner.", fallbackError)
        }
        console.warn("Style evolution split evaluator/refiner/freezer chain failed; fallback path used.", error)
      }
      const verification = buildStyleGenerationVerification({
        evaluation,
        sample,
        checkedAt: new Date().toISOString(),
      })
      const freezer = buildStyleFreezerGateRecord(freezeAdvice, { evaluation, verification })
      const llmFallbackUsed = evaluation.source === "heuristic" || refinement.source === "heuristic" || freezer.source === "heuristic" || fallbackReasons.length > 0
      candidateRuns.push({
        candidateIndex: generatedCandidate.candidateIndex,
        sample,
        evaluation,
        refinement,
        freezeAdvice,
        verification,
        freezer,
        aigcSignal,
        llmFallbackUsed,
        fallbackReasons,
      })
    }

    candidateRuns.sort((left, right) => {
      const verificationRank = (status: string | undefined) => {
        if (status === "passed") return 0
        if (status === "blocked") return 1
        if (status === "warning") return 2
        if (status === "pending") return 3
        return 3
      }
      const verificationGap = verificationRank(left.verification?.status) - verificationRank(right.verification?.status)
      if (verificationGap !== 0) return verificationGap
      const freezerRank = (verdict: string | undefined) => {
        if (verdict === "ready") return 0
        if (verdict === "continue") return 1
        if (verdict === "block") return 2
        return 1
      }
      const freezerGap = freezerRank(left.freezer?.verdict) - freezerRank(right.freezer?.verdict)
      if (freezerGap !== 0) return freezerGap
      const aigcGap = Number(left.verification?.highRiskCount || left.aigcSignal?.highRiskCount || 0) - Number(right.verification?.highRiskCount || right.aigcSignal?.highRiskCount || 0)
      if (aigcGap !== 0) return aigcGap
      const forbiddenGap = Number(left.verification?.forbiddenHitCount || left.evaluation?.forbiddenHits?.length || 0) - Number(right.verification?.forbiddenHitCount || right.evaluation?.forbiddenHits?.length || 0)
      if (forbiddenGap !== 0) return forbiddenGap
      const scoreGap = Number(right.evaluation?.scores?.overall || 0) - Number(left.evaluation?.scores?.overall || 0)
      if (scoreGap !== 0) return scoreGap
      return left.candidateIndex - right.candidateIndex
    })
    const winner = candidateRuns.find((entry) => entry.verification?.status === "passed")
    if (!winner) {
      stopReason = "style_candidates_all_blocked"
      loopRuntime.iterations.push({
        ...runtimeIteration,
        completedAt: new Date().toISOString(),
        candidateCount: options.candidateCount,
        candidateScores: candidateRuns.map((entry) => ({
          candidateIndex: entry.candidateIndex,
          overallScore: Number(entry.evaluation?.scores?.overall || 0) || undefined,
          verdict: entry.evaluation?.verdict,
          source: entry.evaluation?.source,
          verificationStatus: entry.verification?.status,
          aigcHighRiskCount: Number(entry.verification?.highRiskCount || 0),
          forbiddenHitCount: Number(entry.verification?.forbiddenHitCount || 0),
          llmFallbackUsed: entry.llmFallbackUsed,
        })),
        candidates: candidateRuns.map((entry) => ({
          candidateIndex: entry.candidateIndex,
          sample: entry.sample,
          evaluation: entry.evaluation,
          refinement: entry.refinement,
          verification: entry.verification,
          freezer: entry.freezer,
          llmFallbackUsed: entry.llmFallbackUsed,
          fallbackReasons: entry.fallbackReasons,
        })),
        winningReason: "本轮所有候选都未通过 Generation Verification Gate，未写入正式候选历史。",
        verificationStatus: "blocked",
        verificationSummary: "Generation Verification Gate 阻塞，本轮无可持久化候选。",
        verificationReasons: candidateRuns.flatMap((entry) => entry.verification?.reasons || []).filter(Boolean).slice(0, 8),
        stage: "evaluated",
      })
      loopRuntime.completedIterations = loopRuntime.iterations.length
      break
    }
    const sample = winner.sample
    const evaluation = winner.evaluation
    const refinement = winner.refinement
    const freezeAdvice = winner.freezeAdvice
    const verification = winner.verification
    const freezer = winner.freezer

    styleEvolution = await appendStyleEvolutionCandidate(options.projectRoot, {
      prompt: promptBundle.prompt,
      sample,
      review: evaluation.summary,
      createdAt: new Date().toISOString(),
      iterationFeedback: carriedFeedback,
      source: "loop",
      evaluation,
      refinement,
      freezer,
      llmFallbackUsed: winner.llmFallbackUsed,
      fallbackReasons: winner.fallbackReasons,
    })

    const persistedLatest = Array.isArray(styleEvolution.contract.evolutionHistory)
      ? styleEvolution.contract.evolutionHistory.at(-1)
      : null
    loopRuntime.iterations.push({
      ...runtimeIteration,
      version: persistedLatest?.version || 0,
      completedAt: new Date().toISOString(),
      sampleExcerpt: sample.replace(/\s+/gu, " ").slice(0, 160),
      candidateCount: options.candidateCount,
      candidateIndex: winner.candidateIndex,
      candidateScores: candidateRuns.map((entry) => ({
        candidateIndex: entry.candidateIndex,
        overallScore: Number(entry.evaluation?.scores?.overall || 0) || undefined,
        verdict: entry.evaluation?.verdict,
        source: entry.evaluation?.source,
        verificationStatus: entry.verification?.status,
        aigcHighRiskCount: Number(entry.verification?.highRiskCount || 0),
        forbiddenHitCount: Number(entry.verification?.forbiddenHitCount || 0),
        llmFallbackUsed: entry.llmFallbackUsed,
      })),
      winningReason: verification.status === "passed"
        ? `候选 ${winner.candidateIndex} 通过 Generation Verification Gate，并以 ${Number(evaluation.scores?.overall || 0).toFixed(1)} 分胜出。`
        : `候选 ${winner.candidateIndex} 在当前批次风险最低，验证状态 ${verification.status}，综合评分 ${Number(evaluation.scores?.overall || 0).toFixed(1)}。`,
      evaluationSource: evaluation.source,
      refinementSource: refinement.source,
      freezerSource: freezer?.source,
      verdict: evaluation.verdict,
      overallScore: Number(evaluation.scores?.overall || 0) || undefined,
      forbiddenHits: evaluation.forbiddenHits,
      verificationStatus: verification.status,
      verificationSummary: verification.summary,
      verificationReasons: verification.reasons,
      freezerVerdict: freezer?.verdict,
      freezerSummary: freezer?.summary,
      freezerBlockingReasons: freezer?.blockingReasons,
      llmFallbackUsed: winner.llmFallbackUsed,
      fallbackReasons: winner.fallbackReasons,
      aigcRiskScore: verification.score,
      aigcThreshold: verification.threshold,
      aigcHighRiskCount: verification.highRiskCount,
      forbiddenHitCount: verification.forbiddenHitCount,
      nextPrompt: refinement.nextPrompt,
      contractAdjustments: refinement.contractAdjustments,
      candidates: candidateRuns.map((entry) => ({
        candidateIndex: entry.candidateIndex,
        persistedVersion: entry.candidateIndex === winner.candidateIndex ? (persistedLatest?.version || undefined) : undefined,
        sample: entry.sample,
        evaluation: entry.evaluation,
        refinement: entry.refinement,
        verification: entry.verification,
        freezer: entry.freezer,
        llmFallbackUsed: entry.llmFallbackUsed,
        fallbackReasons: entry.fallbackReasons,
      })),
      stage: "persisted",
    })
    loopRuntime.completedIterations = loopRuntime.iterations.length
    iterations.push({
      version: persistedLatest?.version || 0,
      prompt: promptBundle.prompt,
      sample,
      evaluation,
      refinement,
      verification,
      freezer,
      llmFallbackUsed: winner.llmFallbackUsed,
      fallbackReasons: winner.fallbackReasons,
      candidates: candidateRuns.map((entry) => ({
        candidateIndex: entry.candidateIndex,
        persistedVersion: entry.candidateIndex === winner.candidateIndex ? (persistedLatest?.version || undefined) : undefined,
        sample: entry.sample,
        evaluation: entry.evaluation,
        refinement: entry.refinement,
        verification: entry.verification,
        freezer: entry.freezer,
        llmFallbackUsed: entry.llmFallbackUsed,
        fallbackReasons: entry.fallbackReasons,
      })),
    })

    const totalRounds = Number(styleEvolution.contract.loop?.currentIteration || styleEvolution.contract.evolutionHistory?.length || 0)
    const verificationPassed = verification.status === "passed"
    const freezerReady = freezer?.verdict === "ready"
    const readyForApproval = verificationPassed && freezerReady && ((
      evaluation.scores.overall >= approvalThreshold
      && evaluation.forbiddenHits.length <= maxForbiddenHitCount
      && totalRounds >= approvalMinRounds
    ) || evaluation.verdict === "approve")
    const stableCandidate = styleEvolution.contract.loop?.status === "stable_candidate"

    if (readyForApproval) {
      stopReason = "ready_for_approval"
      break
    }
    if (stableCandidate) {
      stopReason = "stable_candidate"
      break
    }
  }

  loopRuntime.status = "completed"
  loopRuntime.completedAt = new Date().toISOString()
  loopRuntime.stopReason = stopReason as StyleLoopRuntimeRecord["stopReason"]
  loopRuntime.finalVersion = styleEvolution.contract.evolutionHistory?.at(-1)?.version
  loopRuntime.finalLoopStatus = styleEvolution.contract.loop?.status
  loopRuntime.finalConvergence = styleEvolution.contract.loop?.convergence
  await persistStyleLoopRuntime(options.projectRoot, loopRuntime)
  await appendStyleLoopRunLedger(options.projectRoot, loopRuntime)
  await persistStyleEvolutionRuntimeState(options.projectRoot, {
    lastRunId: loopRuntime.runId,
    lastRunStatus: "completed",
    lastStopReason: loopRuntime.stopReason,
    lastCompletedAt: loopRuntime.completedAt,
  })
  styleEvolution = await loadStyleEvolution(options.projectRoot)

  return {
    styleEvolution,
    iterations,
    stopReason,
    loopRuntime,
  }
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
      "/api/reader-snapshot",
      "/api/reader-chapter",
      "/api/reader-chapter-versions/compare",
      "/api/reader-search",
      "/api/transcript",
      "/api/messages",
      "/api/chapters/preview",
      "/api/artifacts/preview",
      "/api/assets/image",
      "/api/knowledge-graph",
      "/api/llm-configs",
      "/api/settings/writing",
      "/api/style-evolution",
    ].includes(pathname)
  }

  if (method === "POST") {
    return [
      "/api/projects",
      "/api/init",
      "/api/advance",
      "/api/production/story-assets/repair",
      "/api/production/protagonist-profile/confirm",
      "/api/production/setting-review/approve",
      "/api/production/setting-review/reject",
      "/api/production/story-foundation/approve",
      "/api/chapters/retry",
      "/api/cover",
      "/api/provider-test",
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
      "/api/llm-config-routes",
      "/api/aigc-detect",
      "/api/settings/writing",
      "/api/aigc/batch-scan",
      "/api/aigc/batch-refine",
      "/api/aigc/mark-workflow-complete",
      "/api/reader-chapter-version",
      "/api/style-evolution/init",
      "/api/style-evolution/candidate",
      "/api/style-evolution/generate-candidate",
      "/api/style-evolution/freeze-preview",
      "/api/style-evolution/accept",
      "/api/style-evolution/approve",
      "/api/style-evolution/reject",
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
  const provider = input.provider === "local-heuristic" || input.provider === "generic-json" || input.provider === "gradio-queue" || input.provider === "disabled"
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
    memory: state.memory,
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
  metadata?: Record<string, unknown>
}): MessagePart[] {
  const metadata = input.metadata || {}
  const artifactItems = [
    typeof metadata.artifactPath === "string" && metadata.artifactPath.trim()
      ? {
          path: metadata.artifactPath.trim(),
          label: typeof metadata.artifactLabel === "string" && metadata.artifactLabel.trim()
            ? metadata.artifactLabel.trim()
            : metadata.artifactPath.trim(),
          kind: typeof metadata.artifactKind === "string" && metadata.artifactKind.trim()
            ? metadata.artifactKind.trim()
            : "artifact",
          status: input.status,
        }
      : null,
    ...(Array.isArray(metadata.artifacts) ? metadata.artifacts : []),
  ]
    .filter((artifact): artifact is Record<string, unknown> => Boolean(artifact) && typeof artifact === "object")
    .map((artifact) => ({
      path: typeof artifact.path === "string" ? artifact.path.trim() : "",
      label: typeof artifact.label === "string" ? artifact.label.trim() : "",
      kind: typeof artifact.kind === "string" ? artifact.kind.trim() : "artifact",
      status: typeof artifact.status === "string" ? artifact.status.trim() : input.status,
      role: typeof artifact.role === "string" ? artifact.role.trim() : "",
      chars: typeof artifact.chars === "number" ? artifact.chars : null,
    }))
    .filter((artifact, index, artifacts) =>
      artifact.path
      && artifacts.findIndex((candidate) => candidate.path === artifact.path) === index,
    )
  const parts: MessagePart[] = [
    messagePart(messageId, 0, "markdown", { text: input.content || `${input.toolName}: ${input.status}` }, input.createdAt),
    messagePart(messageId, 1, "tool_call", {
      toolName: input.toolName,
      input: input.toolInput ?? null,
      artifactPath: artifactItems[0]?.path || "",
      artifacts: artifactItems,
    }, input.createdAt),
  ]
  parts.push(messagePart(messageId, 2, input.error ? "tool_result" : "tool_result", {
    status: input.status,
    output: input.output ?? null,
    error: input.error ?? null,
    artifactPath: artifactItems[0]?.path || "",
    artifacts: artifactItems,
  }, input.createdAt))
  for (const artifact of artifactItems) {
    parts.push(messagePart(messageId, parts.length, "artifact", {
      path: artifact.path,
      label: artifact.label || artifact.path,
      kind: artifact.kind || "artifact",
      status: artifact.status || input.status,
      role: artifact.role || "",
      chars: artifact.chars,
    }, input.createdAt))
  }
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
    metadata: input.metadata,
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

async function writeWorkspaceText(rootDir: string, content: string, ...parts: string[]) {
  const targetPath = path.join(rootDir, ".ai-novel", ...parts)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, content, "utf8")
}

function extractConcreteProtagonistNameForRepair(source = "") {
  const candidates = [
    ...[...source.matchAll(/(?:Canonical Protagonist|核心主角|主角姓名)[:：]\s*([\u4e00-\u9fff·]{2,8})/gmu)].map((match) => match[1]),
    ...[...source.matchAll(/^\s*主角[:：]\s*([\u4e00-\u9fff·]{2,8})/gmu)].map((match) => match[1]),
    ...[...source.matchAll(/^#{3,6}\s*([^（(\n]{2,8})[（(][^）)]*(?:主角|主人公|protagonist)[^）)]*[）)]/gmu)].map((match) => match[1]),
    ...[...source.matchAll(/^\*\*([^*（(\n]{2,8})[（(][^）)]*(?:主角|主人公|protagonist)[^）)]*[）)]\*\*/gmu)].map((match) => match[1]),
    ...[...source.matchAll(/^\*\*([^*（(\n]{2,8})\*\*[（(][^）)]*(?:主角|主人公|protagonist)[^）)]*[）)]/gmu)].map((match) => match[1]),
  ].map((name) => String(name || "").trim())
  return candidates.find((name) =>
    /^[\u4e00-\u9fff·]{2,8}$/u.test(name)
    && !/^(?:主角|主人公|待定|未命名|姓名|角色)$/u.test(name)
  ) || ""
}

function extractVisibleMasterProtagonistNameForRepair(masterOutline = "") {
  const characterSpineMatch = masterOutline.match(/##\s+Character Spine\b([\s\S]*?)(?:\n##\s+|\s*$)/u)
  const stateLedgerMatch = masterOutline.match(/##\s+Character State Ledger Plan\b([\s\S]*?)(?:\n##\s+|\s*$)/u)
  const source = [characterSpineMatch?.[1] || "", stateLedgerMatch?.[1] || ""].filter(Boolean).join("\n\n")
  return extractConcreteProtagonistNameForRepair(source || masterOutline)
}

function getNovelWorkspacePaths(projectRoot: string): NovelWorkspacePaths {
  const workspaceDir = path.join(projectRoot, ".ai-novel")
  const styleDir = path.join(workspaceDir, "style")
  const memoryDir = path.join(workspaceDir, "memory")
  const charactersDir = path.join(memoryDir, "characters")
  const characterCoreDir = path.join(charactersDir, "core")
  const plansDir = path.join(workspaceDir, "plans")

  return {
    workspaceDir,
    plansDir,
    reportsDir: path.join(workspaceDir, "reports"),
    chaptersDir: path.join(workspaceDir, "chapters"),
    memoryDir,
    styleDir,
    styleProfilePath: path.join(styleDir, "profile.md"),
    styleRulebookPath: path.join(styleDir, "rulebook.md"),
    styleReferencesPath: path.join(styleDir, "references.md"),
    styleAntiPatternsPath: path.join(styleDir, "anti-patterns.md"),
    consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
    characterDossiersPath: path.join(charactersDir, "dossiers.json"),
    characterDossiersMarkdownPath: path.join(charactersDir, "dossiers.md"),
    protagonistPath: path.join(characterCoreDir, "protagonist.md"),
    relationsPath: path.join(charactersDir, "relations.md"),
    characterEvolutionPath: path.join(charactersDir, "evolution.md"),
    masterOutlinePath: path.join(plansDir, "master-outline.md"),
    chapterBlueprintsDir: path.join(plansDir, "chapter-blueprints"),
  }
}

const SETTING_REVIEW_APPROVAL_FILE = "setting-review-approval.json"
const SETTING_REVIEW_FILE = "setting-freeze.md"
const STORY_FOUNDATION_APPROVAL_FILE = "story-foundation-approval.json"

async function writeSettingReviewApproval(projectRoot: string, input: {
  approved: boolean
  reviewedBy?: string
  note?: string
  reason?: string
}) {
  const reviewedAt = new Date().toISOString()
  const approval = {
    version: 1,
    status: input.approved ? "approved" : "rejected",
    approved: input.approved,
    reviewedAt,
    reviewedBy: input.reviewedBy || "user",
    note: input.note || (input.approved
      ? "用户已确认当前 setting review packet 可作为后续主线规划的设定提案来源。"
      : "用户拒绝当前 setting review packet；后续规划前必须先修正世界观、人物或主线假设。"),
    rejectionReason: input.approved ? "" : input.reason || input.note || "用户拒绝当前 setting review packet。",
    settingReviewPath: `.ai-novel/plans/${SETTING_REVIEW_FILE}`,
    approvalScope: "setting_review",
  }
  await writeWorkspaceText(projectRoot, `${JSON.stringify(approval, null, 2)}\n`, "plans", SETTING_REVIEW_APPROVAL_FILE)
  return approval
}

async function loadStoryFoundationApproval(projectRoot: string) {
  const approval = await readWorkspaceJson(projectRoot, "plans", STORY_FOUNDATION_APPROVAL_FILE)
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
    return null
  }
  return approval as Record<string, unknown>
}

function isStoryFoundationApproved(approval: Record<string, unknown> | null) {
  return Boolean(approval?.approved === true && String(approval.approvedAt || "").trim())
}

async function writeStoryFoundationApproval(projectRoot: string, input: {
  assetFingerprint?: string
  approvedBy?: string
  note?: string
  assetPaths?: string[]
}) {
  const assetPaths = Array.isArray(input.assetPaths) && input.assetPaths.length
    ? input.assetPaths
    : [
      ".ai-novel/plans/world-matrix.md",
      ".ai-novel/plans/plot-architecture.md",
      ".ai-novel/plans/story-bible.md",
      ".ai-novel/plans/volume-strategy.md",
      ".ai-novel/plans/foreshadowing-ledger.md",
      ".ai-novel/plans/character-dynamics.md",
      ".ai-novel/plans/story-foundation-contract.json",
      ".ai-novel/plans/writing-plan.json",
    ]
  const approval = {
    version: 1,
    approved: true,
    approvedAt: new Date().toISOString(),
    approvedBy: input.approvedBy || "user",
    note: input.note || "用户已确认世界观、主线、人物关系、伏笔账本和写作执行计划可进入正文生产。",
    assetPaths,
    assetFingerprint: input.assetFingerprint || "",
  }
  await writeWorkspaceText(projectRoot, `${JSON.stringify(approval, null, 2)}\n`, "plans", STORY_FOUNDATION_APPROVAL_FILE)
  return approval
}

function readProfileField(body: Record<string, unknown>, key: string, aliases: string[] = []) {
  const source = body.protagonistProfile && typeof body.protagonistProfile === "object" && !Array.isArray(body.protagonistProfile)
    ? body.protagonistProfile as Record<string, unknown>
    : body
  for (const field of [key, ...aliases]) {
    const value = source[field]
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

function buildConfirmedProtagonistProfile(body: Record<string, unknown>) {
  const profile = {
    name: readProfileField(body, "name", ["protagonistName", "canonicalName"]),
    identity: readProfileField(body, "identity", ["identityAndRole", "role"]),
    coreDesire: readProfileField(body, "coreDesire", ["desire"]),
    fearOrWound: readProfileField(body, "fearOrWound", ["wound", "fear"]),
    behaviorHabit: readProfileField(body, "behaviorHabit", ["habit"]),
    speechMarker: readProfileField(body, "speechMarker", ["speech", "dialogueHabit"]),
    relationshipName: readProfileField(body, "relationshipName", ["pressureCharacter", "namedRelationship"]),
    relationshipPressure: readProfileField(body, "relationshipPressure", ["pressure"]),
    note: readProfileField(body, "note", ["sourceNote"]),
    confirmedBy: readProfileField(body, "confirmedBy", ["reviewedBy"]) || "user",
  }
  const requiredFields = [
    "name",
    "identity",
    "coreDesire",
    "fearOrWound",
    "behaviorHabit",
    "speechMarker",
    "relationshipName",
    "relationshipPressure",
  ] as const
  const missingFields = requiredFields.filter((field) => !profile[field])
  return { profile, missingFields }
}

function formatConfirmedProtagonistProfileMarkdown(input: {
  name: string
  identity: string
  coreDesire: string
  fearOrWound: string
  behaviorHabit: string
  speechMarker: string
  relationshipName: string
  relationshipPressure: string
  note?: string
  confirmedBy?: string
}) {
  const confirmedAt = new Date().toISOString()
  return [
    "# Confirmed Protagonist Profile",
    "",
    "Status: confirmed",
    `Confirmed At: ${confirmedAt}`,
    `Confirmed By: ${input.confirmedBy || "user"}`,
    "",
    `Canonical Protagonist: ${input.name}`,
    `核心主角: ${input.name}`,
    `主角姓名: ${input.name}`,
    "",
    `#### ${input.name}（主角 / protagonist）`,
    "",
    `- id: protagonist`,
    `- role: protagonist`,
    `- aliases: ${input.name}、主角`,
    `- identity and role: ${input.identity}`,
    `- core desire: ${input.coreDesire}`,
    `- fear or wound: ${input.fearOrWound}`,
    `- contradiction: ${input.name} 必须在「${input.coreDesire}」和「${input.fearOrWound}」之间持续做选择。`,
    `- behavior habits: ${input.behaviorHabit}`,
    `- speech markers: ${input.speechMarker}`,
    `- named relationship pressure: ${input.relationshipName} - ${input.relationshipPressure}`,
    "",
    "## Production Contract",
    "",
    "- Master planning must use this concrete protagonist and must not replace the name with a role label.",
    "- Story foundation and chapter blueprints must preserve the named relationship pressure above.",
    "- Drafting may add minor scene characters only when the blueprint or quality gate allows them.",
    input.note ? ["", "## User Note", "", input.note].join("\n") : "",
  ].filter(Boolean).join("\n")
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

async function readWorkspaceArtifactJson(rootDir: string, artifactPath: string) {
  const text = await readWorkspaceArtifactText(rootDir, artifactPath)
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
}

function hasItems(value: unknown) {
  return Array.isArray(value) && value.length > 0
}

function planningAssetStructuralIssue(asset: string, value: Record<string, unknown> | null, totalChapters: number) {
  if (!value) return "JSON 无法解析"
  switch (asset) {
    case "story-foundation-contract.json": {
      const plot = value.plot && typeof value.plot === "object" ? value.plot as Record<string, unknown> : {}
      const characters = value.characters && typeof value.characters === "object" ? value.characters as Record<string, unknown> : {}
      if (!nonEmptyString((value.project as Record<string, unknown> | undefined)?.title)
        && !nonEmptyString((value.project as Record<string, unknown> | undefined)?.idea)) return "缺少项目核心信息"
      if (!hasItems(plot.chapters) && !hasItems((plot.causalModel as Record<string, unknown> | undefined)?.chapters)) return "缺少主线章节因果"
      if (!hasItems(characters.requiredDossierFields)) return "缺少人物档案要求"
      return ""
    }
    case "world-matrix.json":
      return hasItems(value.rules) ? "" : "缺少世界规则"
    case "plot-architecture.json":
      return hasItems(value.chapters) ? "" : "缺少章节因果架构"
    case "story-bible.json":
      return nonEmptyString(value.readerPromise) && hasItems(value.nonNegotiableContracts) ? "" : "缺少读者承诺或故事合同"
    case "volume-strategy.json":
      return hasItems(value.volumes) ? "" : "缺少分卷策略"
    case "foreshadowing-ledger.json":
      return hasItems(value.entries) ? "" : "缺少伏笔条目"
    case "character-dynamics.json":
      return hasItems(value.relationshipEntries) || hasItems(value.dossiers) || hasItems(value.relationships) ? "" : "缺少人物关系动态"
    case "writing-plan.json": {
      const chapters = Array.isArray(value.chapters) ? value.chapters : []
      if (!Number.isFinite(Number(value.totalChapters)) || Number(value.totalChapters) <= 0) return "缺少总章节数"
      if (chapters.length < Math.max(1, totalChapters)) return "写作计划未覆盖全书章节"
      return ""
    }
    default:
      return ""
  }
}

async function listWorkspaceFiles(rootDir: string, ...parts: string[]) {
  try {
    return await fs.readdir(path.join(rootDir, ".ai-novel", ...parts))
  } catch {
    return []
  }
}

async function readWorkspaceAssetDataUrl(rootDir: string, artifactPath: string) {
  const normalized = artifactPath.replaceAll("\\", "/").replace(/^\/+/, "")
  if (!normalized.startsWith(".ai-novel/assets/") || normalized.includes("..")) {
    return null
  }

  try {
    const buffer = await fs.readFile(path.join(rootDir, normalized))
    const ext = path.extname(normalized).toLowerCase()
    const mimeType = ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".webp"
        ? "image/webp"
        : "image/png"
    return {
      path: artifactPath,
      mimeType,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    }
  } catch {
    return {
      path: artifactPath,
      mimeType: "",
      dataUrl: "",
    }
  }
}

async function summarizeChapterStyleInheritanceManifests(projectRoot: string) {
  const chapterFiles = await listWorkspaceFiles(projectRoot, "chapters")
  const manifestFiles = chapterFiles
    .filter((fileName) => /^chapter-\d+\.versions\.json$/u.test(fileName))
    .sort()
  if (!manifestFiles.length) {
    return {
      total: 0,
      ready: 0,
      warning: 0,
      blocked: 0,
      pending: 0,
      missing: 0,
      latestBlocked: "",
    }
  }

  let ready = 0
  let warningCount = 0
  let blocked = 0
  let pending = 0
  let missing = 0
  let latestBlocked = ""

  for (const fileName of manifestFiles) {
    const manifest = await readWorkspaceArtifactJson(projectRoot, `.ai-novel/chapters/${fileName}`)
	    const verification = manifest?.styleInheritanceVerification && typeof manifest.styleInheritanceVerification === "object"
	      ? manifest.styleInheritanceVerification as Record<string, unknown>
	      : null
	    const drift = manifest?.styleConformanceDrift && typeof manifest.styleConformanceDrift === "object"
	      ? manifest.styleConformanceDrift as Record<string, unknown>
	      : null
	    if (!verification && !drift) {
	      missing += 1
	      continue
	    }
	    const verificationStatus = verification ? String(verification.status || "pending") : ""
	    const driftStatus = drift ? String(drift.status || "pending") : ""
	    const status = driftStatus === "drifted"
        ? "blocked"
        : driftStatus === "warning" || driftStatus === "pending"
          ? driftStatus
          : verificationStatus
            || (driftStatus === "conformant" ? "ready" : driftStatus)
	    if (status === "ready" || status === "conformant") {
	      ready += 1
	    } else if (status === "warning") {
	      warningCount += 1
	    } else if (status === "blocked" || status === "drifted") {
	      blocked += 1
	      latestBlocked = latestBlocked || String(
	        drift?.reason || verification?.summary || `${fileName} 写法继承验证阻塞`,
	      )
	    } else {
	      pending += 1
    }
  }

  return {
    total: manifestFiles.length,
    ready,
    warning: warningCount,
    blocked,
    pending,
    missing,
    latestBlocked,
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
  } else if (state.runtime.stage === "chapter_task_generation") {
    nextState.runtime.stage = "chapter_task_generation"
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

function createStoryFoundationFingerprint(payload: unknown) {
  return createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 24)
}

function buildStoryFoundationFingerprintInput({
  planningAssetDetails,
  storyFoundationContract,
  worldMatrix,
  plotArchitecture,
  storyBible,
  volumeStrategy,
  foreshadowingLedger,
  characterDynamics,
  writingPlan,
}: {
  planningAssetDetails: Array<Record<string, unknown>>
  storyFoundationContract: Record<string, unknown> | null
  worldMatrix: Record<string, unknown> | null
  plotArchitecture: Record<string, unknown> | null
  storyBible: Record<string, unknown> | null
  volumeStrategy: Record<string, unknown> | null
  foreshadowingLedger: Record<string, unknown> | null
  characterDynamics: Record<string, unknown> | null
  writingPlan: Record<string, unknown> | null
}) {
  return {
    planningAssetDetails,
    storyFoundationContract,
    worldMatrix,
    plotArchitecture,
    storyBible,
    volumeStrategy,
    foreshadowingLedger,
    characterDynamics,
    writingPlan,
  }
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
  const filteredEvents = eventRows.filter((row) => row.type !== "JOB_HEARTBEAT")
  const milestoneTypes = new Set(["PROJECT_CREATED", "CONSENSUS_UPDATED", "CHAPTER_PIPELINE_COMPLETED"])
  const milestoneEvents = filteredEvents.filter((row) => milestoneTypes.has(String(row.type || "")))
  const recentNonMilestoneEvents = filteredEvents.filter((row) => !milestoneTypes.has(String(row.type || "")))
  const semanticEvents = [
    ...milestoneEvents,
    ...recentNonMilestoneEvents,
  ]
    .filter((row, index, rows) => rows.findIndex((candidate) => String(candidate.id || "") === String(row.id || "")) === index)
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
  const eventRows = Array.isArray(snapshot.latestEvents) ? snapshot.latestEvents as Array<Record<string, unknown>> : []
  const milestoneTypes = new Set(["PROJECT_CREATED", "CONSENSUS_UPDATED", "CHAPTER_PIPELINE_COMPLETED"])
  const milestoneEvents = eventRows.filter((row) => milestoneTypes.has(String(row.type || "")))
  const recentNonMilestoneEvents = eventRows.filter((row) => !milestoneTypes.has(String(row.type || "")))
  const compactLatestEvents = [
    ...milestoneEvents,
    ...recentNonMilestoneEvents,
  ]
    .filter((row, index, rows) => rows.findIndex((candidate) => String(candidate.id || "") === String(row.id || "")) === index)
    .slice(0, 24)
    .map((row) => compactSnapshotRow(row))
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
      || artifactPath.includes("chapter-contexts/")
      || artifactPath.includes("chapter-segments/")
      || artifactPath.includes("production-resources/")
  }
  const relevantArtifacts = artifacts.filter((artifact) => {
    const artifactPath = String(artifact.path || "")
    return artifactPath.includes("chapter-blueprints/")
      || artifactPath.includes("chapter-contexts/")
      || artifactPath.includes("chapter-segments/")
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
    latestEvents: compactLatestEvents,
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
  const effectiveCharacterMemoryRows = Math.max(characterMemoryRows.length, dossierCount)
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
      memoryRows: effectiveCharacterMemoryRows,
      missing: incompleteDossierFields,
    },
    memoryRecall: {
      status: effectiveCharacterMemoryRows > 0 && memoryLag <= 1 ? "ready" : memoryLag > 2 ? "warning" : "indexing",
      characterRows: effectiveCharacterMemoryRows,
      chapterRows: chapterMemoryRows.length,
      memoryLag,
      latestSource: String(recentMemory[0]?.source || dossierArtifact?.path || ".ai-novel/memory/characters/dossiers.json"),
      latestKind: String(recentMemory[0]?.kind || (effectiveCharacterMemoryRows > 0 ? "character_dossiers" : "")),
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

async function deriveProductionReadiness(
  projectRoot: string,
  factorySnapshot: Record<string, unknown> | null,
  resolvedState: Awaited<ReturnType<typeof loadAutonomousState>> | null,
  consensus: string,
  productionObservability: Record<string, any>,
) {
  const snapshot = factorySnapshot || {}
  const state = (resolvedState || snapshot.state || null) as Awaited<ReturnType<typeof loadAutonomousState>> | null
  const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts as Array<Record<string, unknown>> : []
  const artifactPath = (artifact: Record<string, unknown>) => String(artifact.path || artifact.source || "")
  const planningArtifactCount = artifacts.filter((artifact) => {
    const value = artifactPath(artifact)
    return /master-outline|setting-freeze|story-bible|plot-architecture|book-contract|world-matrix|volume-strategy|plans\//iu.test(value)
  }).length
  const requiredPlanningAssets = [
    "world-matrix.md",
    "plot-architecture.md",
    "story-bible.md",
    "volume-strategy.md",
    "foreshadowing-ledger.md",
    "character-dynamics.md",
    "story-foundation-contract.json",
    "world-matrix.json",
    "plot-architecture.json",
    "story-bible.json",
    "volume-strategy.json",
    "foreshadowing-ledger.json",
    "character-dynamics.json",
    "writing-plan.json",
  ]
  const hasArtifactPath = (needle: string) => artifacts.some((artifact) => artifactPath(artifact).includes(needle))
  const hasWorkspaceArtifact = async (artifactRelativePath: string) => {
    const text = await readWorkspaceArtifactText(projectRoot, artifactRelativePath)
    return Boolean(text?.trim())
  }
  const artifactSummary = snapshot.artifactSummary && typeof snapshot.artifactSummary === "object"
    ? snapshot.artifactSummary as Record<string, unknown>
    : {}
  const blueprintCount = Number(artifactSummary.blueprints || artifacts.filter((artifact) => artifactPath(artifact).includes("chapter-blueprints/")).length)
  const totalChapters = Number(state?.plan?.totalChapters || (snapshot.project as Record<string, unknown> | undefined)?.totalChapters || 0)
  const planningAssetDetails = await Promise.all(requiredPlanningAssets.map(async (required) => {
    const pathValue = `.ai-novel/plans/${required}`
    const present = hasArtifactPath(required) || await hasWorkspaceArtifact(pathValue)
    const issue = present && required.endsWith(".json")
      ? planningAssetStructuralIssue(required, await readWorkspaceArtifactJson(projectRoot, pathValue), totalChapters)
      : ""
    return {
      key: required.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
      label: required,
      path: pathValue,
      status: present && !issue ? "passed" as const : "blocked" as const,
      detail: present ? issue || "已生成" : "缺失",
    }
  }))
  const presentPlanningAssets = planningAssetDetails
    .filter((asset) => asset.status === "passed")
    .map((asset) => asset.label)
  const missingPlanningAssets = requiredPlanningAssets.filter((required) => !presentPlanningAssets.includes(required))
  const requiredPlanningAssetCount = presentPlanningAssets.length
  const storyFoundationApproval = await loadStoryFoundationApproval(projectRoot)
  const storyFoundationApproved = isStoryFoundationApproved(storyFoundationApproval)
  const storyFoundationApprovalFingerprint = typeof storyFoundationApproval?.assetFingerprint === "string"
    ? String(storyFoundationApproval.assetFingerprint)
    : ""
  const characterDossier = productionObservability.characterDossier || {}
  const memoryRecall = productionObservability.memoryRecall || {}
  const contextBudget = productionObservability.contextBudget || {}
  const diagnostics = productionObservability.diagnostics || {}
  const hasDossiers = hasArtifactPath("memory/characters/dossiers.json")
    || await hasWorkspaceArtifact(".ai-novel/memory/characters/dossiers.json")
  const hasCharacterDynamicsAsset = hasArtifactPath("plans/character-dynamics.json")
    || await hasWorkspaceArtifact(".ai-novel/plans/character-dynamics.json")
  const hasRelationships = hasArtifactPath("memory/characters/relationships.json")
    || await hasWorkspaceArtifact(".ai-novel/memory/characters/relationships.json")
    || hasCharacterDynamicsAsset
  const hasStyleContractArtifact = await hasWorkspaceArtifact(".ai-novel/style/evolution/style-contract.json")
    || await hasWorkspaceArtifact(".ai-novel/style/evolution/user-approved-sample.md")
  const chapterStyleInheritance = await summarizeChapterStyleInheritanceManifests(projectRoot)
  let styleGate: ProductionGateResult | null = null
  let styleContractVerificationStatus = ""

  try {
    const styleEvolution = await loadStyleEvolution(projectRoot)
    styleGate = styleEvolution.gate
    styleContractVerificationStatus = String(styleEvolution.contract?.verification?.status || "")
  } catch {
    styleGate = null
    styleContractVerificationStatus = ""
  }
  const hasFrozenStyleContract = styleGate?.status === "passed" || styleContractVerificationStatus === "passed"
  const storyFoundationAssetFingerprint = createStoryFoundationFingerprint(buildStoryFoundationFingerprintInput({
    planningAssetDetails,
    storyFoundationContract: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/story-foundation-contract.json"),
    worldMatrix: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/world-matrix.json"),
    plotArchitecture: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/plot-architecture.json"),
    storyBible: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/story-bible.json"),
    volumeStrategy: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/volume-strategy.json"),
    foreshadowingLedger: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/foreshadowing-ledger.json"),
    characterDynamics: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/character-dynamics.json"),
    writingPlan: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/writing-plan.json"),
  }))
  const characterAssetDetails = [
    {
      key: "character_dossiers",
      label: "人物档案",
      path: ".ai-novel/memory/characters/dossiers.json",
      status: hasDossiers ? "passed" as const : "blocked" as const,
      detail: hasDossiers ? `${Number(characterDossier.count || 0)} 个档案` : "缺失",
    },
    {
      key: "relationship_graph",
      label: "人物关系图",
      path: ".ai-novel/memory/characters/relationships.json",
      status: hasRelationships ? "passed" as const : "blocked" as const,
      detail: hasRelationships ? "已生成" : "缺失",
    },
  ]
  const executionAssetDetails = [
    {
      key: "chapter_blueprints",
      label: "章节蓝图",
      path: ".ai-novel/chapter-blueprints/",
      status: totalChapters > 0 && blueprintCount >= totalChapters ? "passed" as const : "blocked" as const,
      detail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} 个蓝图`,
    },
    {
      key: "style_contract",
      label: "写法合同",
      path: ".ai-novel/style/evolution/style-contract.json",
      status: hasFrozenStyleContract ? "passed" as const : "blocked" as const,
      detail: hasFrozenStyleContract
        ? "已冻结"
        : hasStyleContractArtifact
          ? "文件存在但验证门未通过"
          : "待确认",
    },
    ...(chapterStyleInheritance.total > 0
      ? [{
          key: "chapter_style_inheritance",
          label: "章节写法继承",
          path: ".ai-novel/chapters/*.versions.json",
          status: chapterStyleInheritance.blocked > 0 || chapterStyleInheritance.missing > 0 || chapterStyleInheritance.pending > 0
            ? "blocked" as const
            : chapterStyleInheritance.warning > 0
              ? "warning" as const
              : "passed" as const,
          detail: chapterStyleInheritance.blocked > 0
            ? `${chapterStyleInheritance.blocked}/${chapterStyleInheritance.total} 章阻塞：${chapterStyleInheritance.latestBlocked}`
            : chapterStyleInheritance.missing > 0
              ? `${chapterStyleInheritance.missing}/${chapterStyleInheritance.total} 章缺少继承验证`
              : chapterStyleInheritance.pending > 0
                ? `${chapterStyleInheritance.pending}/${chapterStyleInheritance.total} 章待验证`
                : chapterStyleInheritance.warning > 0
                  ? `${chapterStyleInheritance.ready}/${chapterStyleInheritance.total} 章通过，${chapterStyleInheritance.warning} 章待补强`
                  : `${chapterStyleInheritance.ready}/${chapterStyleInheritance.total} 章通过`,
        }]
      : []),
  ]
  const chapterStyleInheritanceAsset = executionAssetDetails.find((asset) => asset.key === "chapter_style_inheritance")

  const productionReadiness = evaluateProductionReadiness({
    consensusText: consensus,
    planningArtifactCount,
    planningRequiredAssetCount: requiredPlanningAssetCount,
    planningRequiredAssets: requiredPlanningAssets,
    planningMissingRequiredAssets: missingPlanningAssets,
    planningAssetDetails,
    storyFoundationApproved,
    storyFoundationApprovalPath: `.ai-novel/plans/${STORY_FOUNDATION_APPROVAL_FILE}`,
    storyFoundationApprovedAt: typeof storyFoundationApproval?.approvedAt === "string" ? storyFoundationApproval.approvedAt : undefined,
    storyFoundationApprovalFingerprint,
    storyFoundationAssetFingerprint,
    characterAssetDetails,
    executionAssetDetails,
    blueprintCount,
    totalChapters,
    characterDossierCount: Number(characterDossier.count || 0),
    characterDossierGaps: Array.isArray(characterDossier.missing) ? characterDossier.missing.map(String) : [],
    styleGate,
    memoryRecallRows: Number(memoryRecall.characterRows || 0) + Number(memoryRecall.chapterRows || 0),
    memoryLag: Number(memoryRecall.memoryLag || 0),
    contextBudgetPercent: Number(contextBudget.budgetPercent || 0),
    contextOverBudget: Boolean(diagnostics.contextBudgetOverages?.isOverages),
  })
  if (chapterStyleInheritanceAsset?.status === "blocked") {
    const issue = {
      code: "chapter_style_inheritance_blocked",
      severity: "critical" as const,
      message: chapterStyleInheritanceAsset.detail || "章节写法继承 / 漂移验证仍在阻塞，不能进入发布级生产。",
      action: "先修复 blocked / pending / missing 的章节 styleInheritanceVerification，再继续正文生产或发布。",
    }
    return {
      ...productionReadiness,
      status: "blocked" as const,
      canProceed: false,
      blockedReason: issue.message,
      summary: productionReadiness.summary.includes("阻塞")
        ? productionReadiness.summary
        : `1 项阻塞正文生产：${issue.message}`,
      issues: [
        ...productionReadiness.issues.filter((existing) => existing.code !== issue.code),
        issue,
      ],
    }
  }
  return productionReadiness
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

async function reconcileCoverStateFromMetadata(projectRoot: string, state: Awaited<ReturnType<typeof loadAutonomousState>> | null) {
  if (!state?.assets?.cover) {
    return state
  }

  const cover = state.assets.cover
  const metadataPath = path.join(projectRoot, ".ai-novel", "assets", "cover", "cover-metadata.json")
  const metadata = await fs.readFile(metadataPath, "utf8")
    .then((raw) => JSON.parse(raw) as Record<string, unknown>)
    .catch(() => null)

  if (!metadata || typeof metadata.status !== "string") {
    return state
  }

  const metadataStatus = metadata.status
  if (metadataStatus !== "complete" && metadataStatus !== "failed") {
    return state
  }

  if (cover.status === metadataStatus && cover.metadataPath && (metadataStatus !== "failed" || cover.error)) {
    return state
  }

  cover.status = metadataStatus as "complete" | "failed"
  cover.promptPath = typeof metadata.promptPath === "string" ? metadata.promptPath : cover.promptPath || ".ai-novel/assets/cover/cover-prompt.md"
  cover.imagePath = typeof metadata.imagePath === "string" ? metadata.imagePath : cover.imagePath || ".ai-novel/assets/cover/cover.png"
  cover.metadataPath = ".ai-novel/assets/cover/cover-metadata.json"
  if (typeof metadata.briefPath === "string") {
    cover.briefPath = metadata.briefPath
  }
  if (metadataStatus === "complete") {
    cover.generatedAt = typeof metadata.generatedAt === "string" ? metadata.generatedAt : cover.generatedAt
    delete cover.error
  } else {
    cover.error = typeof metadata.error === "string" ? metadata.error : cover.error || "cover_generation_failed"
  }

  return state
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
  const coverReconciledState = await reconcileCoverStateFromMetadata(projectRoot, rawResolvedState)
  const resolvedState = stateWithChapterFactsForPayload(coverReconciledState, factorySnapshot as Record<string, unknown> | null)
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
  const productionReadiness = await deriveProductionReadiness(
    projectRoot,
    factorySnapshot as Record<string, unknown> | null,
    resolvedState,
    consensus,
    productionObservability,
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
      productionReadiness,
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
    productionReadiness,
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

function tryParseJsonText(text: string) {
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function readWorkspaceJson(projectRoot: string, ...parts: string[]) {
  return tryParseJsonText(await readWorkspaceText(projectRoot, ...parts))
}

function firstNonEmptyLine(text = "") {
  return String(text).split(/\r?\n/).map((line) => line.trim()).find(Boolean) || ""
}

function truncateReaderText(text = "", maxLength = 4200) {
  const normalized = String(text).trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trimEnd()}\n...`
}

function stripWrappingFence(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```$/)
  return match ? match[1].trim() : trimmed
}

function cleanReaderChapterText(raw: string) {
  const text = stripWrappingFence(raw).replace(/\r\n/g, "\n").trim()
  if (!text) return ""

  const startMarkers = [
    /^##\s+(?:Final Body|Reviewed Body|Draft Body|正文|最终正文|修订正文|草稿正文)\s*$/im,
  ]
  let startIndex = 0
  for (const marker of startMarkers) {
    const match = marker.exec(text)
    if (match) {
      startIndex = (match.index || 0) + match[0].length
      break
    }
  }

  const body = text.slice(startIndex)
  const stopPattern = /^##+\s+(?:Naturalness Pass|Naturalness Report|Quality Gate|Drafting Metadata|Polish Pass|Revision Attempt|Semantic Preservation|Risk Flags|Patch Summary|Memory|Chapter Memory|Chapter Quality Report|AIGC|AIGC Report|章节元数据|章节元信息|质量门禁|自然度报告|自然度处理|润色报告|修订记录|记忆|章节记忆)\b.*$/gim
  const stopMatch = stopPattern.exec(body)
  const withoutReports = (stopMatch ? body.slice(0, stopMatch.index) : body).trim()

  return withoutReports
    .replace(/^---\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function readerChapterTitleFromText(cleaned: string, fallback: string, chapterNumber: number) {
  const heading = cleaned.match(/^#\s+(.+)$/m) || cleaned.match(/^第[一二三四五六七八九十百千万0-9]+[章节回][\s　:：-]*(.+)$/m)
  if (heading?.[1]) return heading[1].trim()
  return fallback || `第 ${chapterNumber} 章`
}

function readerChapterTitleFromRaw(raw: string, fallback: string, chapterNumber: number) {
  const heading = raw.match(/^#\s+(.+)$/m)
  if (heading?.[1]) return heading[1].trim()
  return readerChapterTitleFromText(raw, fallback, chapterNumber)
}

function readerWordCount(text: string) {
  const compact = String(text).replace(/\s+/g, "")
  return compact.length
}

async function readReaderChapterVersionManifest(projectRoot: string, chapterNumber: number) {
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
  const text = await readWorkspaceArtifactText(projectRoot, `.ai-novel/chapters/${chapterId}.versions.json`)
  const parsed = text ? tryParseJsonText(text) : null
  if (!parsed || typeof parsed !== "object") return null
  const record = parsed as Record<string, any>
  const versions = Array.isArray(record.versions)
    ? record.versions
        .filter((entry) => entry && typeof entry === "object" && typeof entry.path === "string")
        .map((entry) => ({
          id: String(entry.id || entry.source || ""),
          label: String(entry.label || entry.id || entry.source || ""),
          source: String(entry.source || entry.id || ""),
          path: String(entry.path || ""),
          wordCount: Number(entry.wordCount || 0),
          status: String(entry.status || ""),
          createdAt: String(entry.createdAt || ""),
        }))
        .filter((entry) => entry.id && entry.path)
    : []
  if (!versions.length) return null
  const publishedVersionId = String(record.publishedVersionId || "final")
  return {
    version: Number(record.version || 1),
    chapterNumber,
    chapterTitle: String(record.chapterTitle || ""),
    publishedVersionId,
    locked: Boolean(record.locked),
    status: String(record.status || ""),
    writingMode: String(record.writingMode || ""),
    targetWords: Number(record.targetWords || 0),
	    wordCount: Number(record.wordCount || 0),
	    updatedAt: String(record.updatedAt || ""),
	    qualityGate: record.qualityGate || null,
	    aigcDetection: record.aigcDetection || null,
	    chapterInheritanceAdapter: record.chapterInheritanceAdapter && typeof record.chapterInheritanceAdapter === "object"
	      ? record.chapterInheritanceAdapter
	      : null,
	    styleConformanceDrift: record.styleConformanceDrift && typeof record.styleConformanceDrift === "object"
	      ? record.styleConformanceDrift
	      : null,
	    styleInheritanceVerification: record.styleInheritanceVerification && typeof record.styleInheritanceVerification === "object"
	      ? record.styleInheritanceVerification
	      : null,
    artifacts: record.artifacts && typeof record.artifacts === "object" ? record.artifacts : {},
    publishReadiness: record.publishReadiness && typeof record.publishReadiness === "object" ? record.publishReadiness : null,
    versions,
  }
}

function hasUsableStyleFingerprint(value: unknown) {
  const fingerprint = String(value || "").trim()
  return Boolean(fingerprint && !/pending sample|first-chapter extraction/i.test(fingerprint))
}

function normalizeReaderVerificationStatus(value: unknown): "ready" | "warning" | "blocked" | "pending" {
  const status = String(value || "").trim()
  if (status === "ready" || status === "passed" || status === "conformant") return "ready"
  if (status === "warning") return "warning"
  if (status === "blocked" || status === "drifted") return "blocked"
  return "pending"
}

async function loadReaderStyleContext(
  projectRoot: string,
  state?: Awaited<ReturnType<typeof loadAutonomousState>> | null,
) {
  let styleEvolution: Awaited<ReturnType<typeof loadStyleEvolution>> | null = null
  let styleEvolutionAssets: Awaited<ReturnType<typeof readStyleEvolutionAssetSnapshot>> | null = null
  try {
    styleEvolution = await loadStyleEvolution(projectRoot)
    styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(projectRoot)
  } catch {
    styleEvolution = null
    styleEvolutionAssets = null
  }
  const creativeProfile = state?.project?.creativeProfile && typeof state.project.creativeProfile === "object"
    ? state.project.creativeProfile as unknown as Record<string, unknown>
    : null
  return {
    styleEvolution,
    styleEvolutionAssets,
    creativeProfile,
  }
}

function buildReaderStyleInheritanceVerification(input: {
  chapterNumber: number
  manifest: Awaited<ReturnType<typeof readReaderChapterVersionManifest>> | Record<string, any> | null
  baseChecks: Array<{ id: string; label: string; passed: boolean; detail: string }>
  styleEvolution?: Awaited<ReturnType<typeof loadStyleEvolution>> | null
  styleEvolutionAssets?: Awaited<ReturnType<typeof readStyleEvolutionAssetSnapshot>> | null
  creativeProfile?: Record<string, unknown> | null
}) {
  const manifest = input.manifest && typeof input.manifest === "object"
    ? input.manifest as Record<string, any>
    : null
  const persisted = manifest?.styleInheritanceVerification && typeof manifest.styleInheritanceVerification === "object"
    ? manifest.styleInheritanceVerification as Record<string, any>
    : null
  const styleEvolution = input.styleEvolution || null
  const contract = styleEvolution?.contract || null
  const styleEvolutionAssets = input.styleEvolutionAssets || null
  const creativeProfile = input.creativeProfile || null
  const approvedVersion = Number(contract?.loop?.approvalVersion || contract?.approval?.approvedVersion || 0)
  const contractApproved = Boolean(contract?.approvedAt || approvedVersion)
	  const inheritanceStatus = String(contract?.inheritance?.status || "")
	  const inheritedRules = Array.isArray(contract?.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules : []
	  const inheritedArtifacts = Array.isArray(contract?.inheritance?.inheritedArtifacts) ? contract.inheritance.inheritedArtifacts : []
	  const freezerVerdict = String(contract?.freezer?.verdict || "")
	  const persistedAdapter = manifest?.chapterInheritanceAdapter && typeof manifest.chapterInheritanceAdapter === "object"
	    ? manifest.chapterInheritanceAdapter as Record<string, any>
	    : null
	  const persistedAdapterStatus = String(persistedAdapter?.status || "")
	  const adapterMissing = Boolean(manifest && contractApproved && !persistedAdapter)
	  const persistedAdapterVersion = Number(persistedAdapter?.contractVersion || 0)
	  const adapterVersionChanged = Boolean(
	    approvedVersion > 0
	      && persistedAdapterVersion > 0
	      && persistedAdapterVersion !== approvedVersion,
	  )
  const styleFingerprint = String(creativeProfile?.styleFingerprint || "").trim()
  const styleFingerprintReady = hasUsableStyleFingerprint(styleFingerprint)
  const freezeAssets = styleEvolutionAssets?.freezePackage || null
  const chapterInheritanceAssets = styleEvolutionAssets?.chapterInheritance || null
  const freezeAssetsReady = Boolean(
    freezeAssets?.approvedSample?.exists
      && freezeAssets?.freezeLedger?.exists
      && freezeAssets?.loopRuntime?.exists,
  )
  const inheritanceAssetsReady = Boolean(
    chapterInheritanceAssets?.rulebook?.exists
      && chapterInheritanceAssets?.references?.exists
      && chapterInheritanceAssets?.antiPatterns?.exists,
  )
  const qualityGate = manifest?.qualityGate && typeof manifest.qualityGate === "object"
    ? manifest.qualityGate as Record<string, any>
    : null
  const qualityGateStatus = String(qualityGate?.status || "")
  const qualityGateReason = String(qualityGate?.reason || qualityGate?.summary || "").trim()
  const aigcDetection = manifest?.aigcDetection && typeof manifest.aigcDetection === "object"
    ? manifest.aigcDetection as Record<string, any>
    : null
  const aigcStatus = String(aigcDetection?.status || "")
  const aigcScore = typeof aigcDetection?.score === "number" ? Number(aigcDetection.score) : null
  const aigcThreshold = typeof aigcDetection?.threshold === "number" ? Number(aigcDetection.threshold) : null
  const aigcHighRiskSegments = Array.isArray(aigcDetection?.highRiskSegments) ? aigcDetection.highRiskSegments : []
  const aigcHighRiskCount = aigcHighRiskSegments.length
	  const baseMissing = input.baseChecks.filter((check) => !check.passed)
	  const baseMissingLabels = baseMissing.map((check) => check.label)
	  const styleConformanceDrift = manifest?.styleConformanceDrift && typeof manifest.styleConformanceDrift === "object"
	    ? manifest.styleConformanceDrift as Record<string, any>
	    : null
	  const verificationStatus = String(contract?.verification?.status || contract?.loop?.verificationStatus || "")
	  const currentContractBlocks = !contractApproved
	    || inheritanceStatus !== "enforced"
	    || verificationStatus !== "passed"
	    || freezerVerdict !== "ready"
	    || adapterMissing
	    || persistedAdapterStatus === "blocked"
	    || adapterVersionChanged
	  if (styleConformanceDrift) {
	    const driftStatus = String(styleConformanceDrift.status || "pending")
	    const driftBlocked = driftStatus === "drifted"
	    const driftPending = driftStatus === "pending"
	    const driftWarning = driftStatus === "warning"
	    const driftEvidence = Array.isArray(styleConformanceDrift.evidence) ? styleConformanceDrift.evidence : []
	    const driftRisks = Array.isArray(styleConformanceDrift.risks) ? styleConformanceDrift.risks : []
	    const metrics = styleConformanceDrift.metrics && typeof styleConformanceDrift.metrics === "object"
	      ? styleConformanceDrift.metrics as Record<string, any>
	      : {}
	    const contractRisks = [
	      !contractApproved ? "整书写法合同尚未冻结，当前章节无法完成严格继承验证。" : "",
	      contractApproved && inheritanceStatus !== "enforced" ? `写法继承状态当前为 ${inheritanceStatus || "missing"}。` : "",
	      contractApproved && verificationStatus !== "passed" ? `当前冻结写法合同 Generation Verification Gate 状态为 ${verificationStatus || "missing"}。` : "",
	      contractApproved && freezerVerdict !== "ready" ? `当前冻结写法合同 Style Contract Freezer verdict 为 ${freezerVerdict || "missing"}。` : "",
	      adapterMissing ? "章节版本清单缺少 Chapter Inheritance Adapter，不能证明正文继承了当前冻结合同。" : "",
	      persistedAdapterStatus === "blocked" ? "章节保存的 Chapter Inheritance Adapter 仍处于 blocked。" : "",
	      adapterVersionChanged ? `章节继承 Adapter 记录的是 v${persistedAdapterVersion}，当前冻结合同为 v${approvedVersion}，需要重新生成章节验证。` : "",
	    ].filter(Boolean)
    const status = currentContractBlocks
      ? "blocked"
      : driftBlocked
        ? "blocked"
        : driftWarning
          ? "warning"
          : driftPending
            ? "pending"
            : "ready"
	    return {
	      status,
	      summary: currentContractBlocks
          ? "当前冻结写法合同尚未通过或继承链未 enforced，章节风格漂移结果不能单独放行。"
          : String(styleConformanceDrift.reason || "已读取章节风格漂移评分。"),
	      chapterNumber: input.chapterNumber,
	      contractVersion: approvedVersion,
	      contractApproved,
	      approvedAt: String(contract?.approvedAt || contract?.approval?.approvedAt || ""),
		      inheritanceStatus,
		      chapterInheritanceAdapter: persistedAdapter,
		      adapterReady: persistedAdapterStatus === "ready" && !adapterVersionChanged && !adapterMissing,
		      freezerVerdict,
		      inheritedRuleCount: inheritedRules.length,
	      inheritedArtifactCount: inheritedArtifacts.length,
	      freezeAssetsReady,
	      inheritanceAssetsReady,
	      styleFingerprintReady,
	      styleFingerprint,
	      styleConformanceDrift,
	      styleDrift: {
	        status: driftStatus,
	        conformanceScore: typeof styleConformanceDrift.conformanceScore === "number" ? Math.round(Number(styleConformanceDrift.conformanceScore) * 10) : null,
	        driftScore: typeof styleConformanceDrift.driftScore === "number" ? Math.round(Number(styleConformanceDrift.driftScore) * 10) : null,
	        threshold: 72,
	        rawConformanceScore: styleConformanceDrift.conformanceScore,
	        rawDriftScore: styleConformanceDrift.driftScore,
	        forbiddenHitCount: Number(metrics.forbiddenHitCount || 0),
	        matchedTerms: Array.isArray(styleConformanceDrift.matchedContractRules) ? styleConformanceDrift.matchedContractRules : [],
	        missingTerms: Array.isArray(styleConformanceDrift.missingContractRules) ? styleConformanceDrift.missingContractRules : [],
	        summary: String(styleConformanceDrift.reason || ""),
	      },
	      qualityGateStatus,
	      qualityGateReason,
	      publishBaseReady: baseMissingLabels.length === 0,
	      publishBaseMissing: baseMissing.map((check) => ({
	        id: check.id,
	        label: check.label,
	        detail: check.detail,
	      })),
	      aigc: aigcDetection
	        ? {
	            status: aigcStatus || "unknown",
	            score: aigcScore,
	            threshold: aigcThreshold,
	            highRiskCount: aigcHighRiskCount,
	            reason: String(aigcDetection.reason || ""),
	          }
	        : null,
	      verificationStatus,
	      verificationSummary: String(contract?.verification?.summary || contract?.loop?.verificationSummary || ""),
	      evidence: baseMissingLabels.length || contractRisks.length ? driftEvidence : [...driftEvidence, "当前章节的发布链路基础资产已齐。"],
	      risks: [
          ...driftRisks,
          ...contractRisks,
          ...(baseMissingLabels.length ? [`发布链路仍缺少：${baseMissingLabels.join("、")}。`] : []),
        ],
	    }
	  }
	  if (persisted) {
    const persistedStatus = normalizeReaderVerificationStatus(persisted.status)
    const persistedContractVersion = Number(persisted.contractVersion || 0)
    const contractVersionChanged = Boolean(
      approvedVersion > 0
        && persistedContractVersion > 0
        && persistedContractVersion !== approvedVersion,
    )
    const persistedEvidence = Array.isArray(persisted.evidence) ? persisted.evidence : []
    const persistedRisks = Array.isArray(persisted.risks) ? persisted.risks : []
    const publishBaseMissing = baseMissing.map((check) => ({
      id: check.id,
      label: check.label,
      detail: check.detail,
    }))
	    const contractRisks = [
	      !contractApproved ? "整书写法合同尚未冻结，旧的章节继承验证不能作为当前发布依据。" : "",
	      contractApproved && inheritanceStatus !== "enforced" ? `写法继承状态当前为 ${inheritanceStatus || "missing"}，旧验证需要重新确认。` : "",
	      contractApproved && verificationStatus !== "passed" ? `当前冻结写法合同 Generation Verification Gate 状态为 ${verificationStatus || "missing"}，旧验证需要重新确认。` : "",
	      contractApproved && freezerVerdict !== "ready" ? `当前冻结写法合同 Style Contract Freezer verdict 为 ${freezerVerdict || "missing"}，旧验证需要重新确认。` : "",
	      adapterMissing ? "章节版本清单缺少 Chapter Inheritance Adapter，旧验证不能作为发布依据。" : "",
	      persistedAdapterStatus === "blocked" ? "章节保存的 Chapter Inheritance Adapter 仍处于 blocked，旧验证不能作为发布依据。" : "",
	      adapterVersionChanged ? `章节继承 Adapter 记录的是 v${persistedAdapterVersion}，当前冻结合同为 v${approvedVersion}，需要重新生成章节验证。` : "",
	      contractVersionChanged ? `章节继承验证记录的是 v${persistedContractVersion}，当前冻结合同为 v${approvedVersion}，需要重新验证。` : "",
	    ].filter(Boolean)
	    const publishRisks = baseMissingLabels.length ? [`发布链路仍缺少：${baseMissingLabels.join("、")}。`] : []
	    const downgradedStatus: "ready" | "warning" | "blocked" | "pending" = currentContractBlocks || contractVersionChanged
	      ? "blocked"
      : baseMissingLabels.length > 0 && persistedStatus === "ready"
        ? "warning"
        : persistedStatus
    const summary = downgradedStatus === "blocked" && (currentContractBlocks || contractVersionChanged)
      ? "章节保存的写法继承验证已过期，必须先重新通过当前冻结写法合同与 Generation Verification Gate。"
      : String(persisted.summary || "已读取章节持久化写法继承验证。")
    return {
      ...persisted,
      status: downgradedStatus,
      summary,
      chapterNumber: input.chapterNumber,
      contractVersion: approvedVersion || persistedContractVersion || undefined,
      contractApproved,
	      approvedAt: String(contract?.approvedAt || contract?.approval?.approvedAt || ""),
	      inheritanceStatus,
	      chapterInheritanceAdapter: persistedAdapter,
	      adapterReady: persistedAdapterStatus === "ready" && !adapterVersionChanged && !adapterMissing,
	      freezerVerdict,
	      inheritedRuleCount: inheritedRules.length,
      inheritedArtifactCount: inheritedArtifacts.length,
      freezeAssetsReady,
      inheritanceAssetsReady,
      styleFingerprintReady,
      styleFingerprint,
      qualityGateStatus,
      qualityGateReason,
      publishBaseReady: baseMissingLabels.length === 0,
      publishBaseMissing,
      aigc: aigcDetection
        ? {
            status: aigcStatus || "unknown",
            score: aigcScore,
            threshold: aigcThreshold,
            highRiskCount: aigcHighRiskCount,
            reason: String(aigcDetection.reason || ""),
          }
        : null,
      verificationStatus,
      verificationSummary: String(contract?.verification?.summary || contract?.loop?.verificationSummary || ""),
      evidence: baseMissingLabels.length || contractRisks.length ? persistedEvidence : [...persistedEvidence, "当前章节的发布链路基础资产已齐。"],
      risks: [...persistedRisks, ...contractRisks, ...publishRisks],
	    }
	  }
	  const evidence: string[] = []
  const risks: string[] = []

  if (contractApproved) {
    evidence.push(approvedVersion > 0 ? `整书写法合同已冻结为 v${approvedVersion}` : "整书写法合同已完成冻结")
  } else {
    risks.push("整书写法合同尚未冻结，当前章节无法完成严格继承验证。")
  }

	  if (inheritanceStatus === "enforced") {
	    evidence.push("章节继承链已标记为 enforced。")
	  } else if (contractApproved) {
	    risks.push(inheritanceStatus ? `写法继承状态仍为 ${inheritanceStatus}。` : "写法继承状态尚未进入 enforced。")
	  }

	  if (freezerVerdict === "ready") {
	    evidence.push("Style Contract Freezer 已 ready。")
	  } else if (contractApproved) {
	    risks.push(`Style Contract Freezer verdict 为 ${freezerVerdict || "missing"}。`)
	  }

	  if (persistedAdapterStatus === "ready" && !adapterVersionChanged) {
	    evidence.push("Chapter Inheritance Adapter 已绑定当前冻结合同。")
	  } else if (adapterMissing) {
	    risks.push("章节版本清单缺少 Chapter Inheritance Adapter。")
	  } else if (persistedAdapterStatus === "blocked") {
	    risks.push("Chapter Inheritance Adapter 仍处于 blocked。")
	  } else if (adapterVersionChanged) {
	    risks.push(`章节继承 Adapter 记录的是 v${persistedAdapterVersion}，当前冻结合同为 v${approvedVersion}。`)
	  }

  if (freezeAssetsReady) {
    evidence.push("冻结资产包已完整落地（approved sample / freeze ledger / loop runtime）。")
  } else if (contractApproved) {
    risks.push("冻结资产包还不完整，后续正文继承证据不够扎实。")
  }

  if (inheritanceAssetsReady) {
    evidence.push("章节继承资产已同步（rulebook / references / anti-patterns）。")
  } else if (contractApproved) {
    risks.push("章节继承资产未完全同步，正文可能没有吃到完整写法合同。")
  }

  if (styleFingerprintReady) {
    evidence.push("首章风格指纹已就绪，可作为章节连续性参照。")
  } else {
    risks.push("首章风格指纹尚未稳定提取，暂时缺少章节写法连续性的辅助参照。")
  }

  if (qualityGateStatus === "passed" || qualityGateStatus === "approved" || qualityGateStatus === "pass") {
    evidence.push("本章质量门已通过。")
  } else if (qualityGateStatus === "blocked") {
    risks.push(`本章质量门阻塞：${qualityGateReason || "仍未通过章节质量门。"}。`)
  } else if (qualityGateStatus) {
    risks.push(`本章质量门当前状态为 ${qualityGateStatus}。`)
  } else {
    risks.push("本章尚未形成稳定的质量门结果。")
  }

  if (aigcStatus === "passed") {
    evidence.push(`AIGC 检测通过${typeof aigcScore === "number" ? `（均值 ${aigcScore.toFixed(3)}）` : ""}。`)
  } else if (aigcStatus === "blocked") {
    risks.push(`AIGC 检测阻塞：${aigcHighRiskCount} 个高风险片段${typeof aigcScore === "number" ? `，均值 ${aigcScore.toFixed(3)}` : ""}${typeof aigcThreshold === "number" ? `，阈值 ${aigcThreshold.toFixed(3)}` : ""}。`)
  } else if (aigcStatus) {
    risks.push(`AIGC 检测当前状态为 ${aigcStatus}${aigcDetection?.reason ? `：${String(aigcDetection.reason)}` : ""}。`)
  } else {
    risks.push("当前章节还没有可追踪的 AIGC 检测结果。")
  }

  if (baseMissingLabels.length) {
    risks.push(`发布链路仍缺少：${baseMissingLabels.join("、")}。`)
  } else {
    evidence.push("当前章节的发布链路基础资产已齐。")
  }

  let status: "ready" | "warning" | "blocked" | "pending" = "ready"
  if (!manifest) {
    status = "pending"
  } else if (
    currentContractBlocks
    || qualityGateStatus === "blocked"
    || aigcStatus === "blocked"
  ) {
    status = "blocked"
  } else if (!freezeAssetsReady || !inheritanceAssetsReady || !styleFingerprintReady || baseMissingLabels.length > 0 || !aigcStatus) {
    status = "warning"
  }

  const summary = status === "blocked"
    ? (
      !contractApproved
        ? "整书写法合同还没有冻结，当前章节不能被视为已完成写法继承验证。"
        : verificationStatus !== "passed"
          ? "冻结写法合同的 Generation Verification Gate 尚未通过，当前章节不能被视为稳定继承合同的正文。"
          : aigcStatus === "blocked"
            ? "AIGC 检测仍在阻塞，当前章节还不能被视为稳定继承合同的正文。"
            : qualityGateStatus === "blocked"
              ? "本章质量门仍在阻塞，当前章节还不能被视为稳定继承合同的正文。"
              : "写法继承链还没有完全进入可放行状态。"
    )
    : status === "warning"
      ? "本章已经接上冻结写法合同，但继承证据仍不完整，建议继续补齐验证链。"
      : status === "pending"
        ? "当前章节还没有形成足够的写法继承验证数据。"
        : "本章已经通过冻结合同、质量门与 AIGC 的联合验证，更接近稳定可发布正文。"

  return {
    status,
    summary,
    chapterNumber: input.chapterNumber,
    contractVersion: approvedVersion,
    contractApproved,
	    approvedAt: String(contract?.approvedAt || contract?.approval?.approvedAt || ""),
	    inheritanceStatus,
	    chapterInheritanceAdapter: persistedAdapter,
	    adapterReady: persistedAdapterStatus === "ready" && !adapterVersionChanged && !adapterMissing,
	    freezerVerdict,
	    inheritedRuleCount: inheritedRules.length,
    inheritedArtifactCount: inheritedArtifacts.length,
    freezeAssetsReady,
    inheritanceAssetsReady,
    styleFingerprintReady,
    styleFingerprint,
    qualityGateStatus,
    qualityGateReason,
    publishBaseReady: baseMissingLabels.length === 0,
    publishBaseMissing: baseMissing.map((check) => ({
      id: check.id,
      label: check.label,
      detail: check.detail,
    })),
    aigc: aigcDetection
      ? {
          status: aigcStatus || "unknown",
          score: aigcScore,
          threshold: aigcThreshold,
          highRiskCount: aigcHighRiskCount,
          reason: String(aigcDetection.reason || ""),
        }
      : null,
    verificationStatus,
    verificationSummary: String(contract?.verification?.summary || contract?.loop?.verificationSummary || ""),
    evidence,
    risks,
  }
}

async function buildReaderChapterPublishReadiness(
  projectRoot: string,
  chapterNumber: number,
  manifest: Awaited<ReturnType<typeof readReaderChapterVersionManifest>>,
  options: {
    styleEvolution?: Awaited<ReturnType<typeof loadStyleEvolution>> | null
    styleEvolutionAssets?: Awaited<ReturnType<typeof readStyleEvolutionAssetSnapshot>> | null
    creativeProfile?: Record<string, unknown> | null
  } = {},
) {
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
  const selectedVersion = manifest?.versions?.find((entry) => entry.id === manifest.publishedVersionId)
  const selectedBody = selectedVersion?.path ? await readWorkspaceArtifactText(projectRoot, selectedVersion.path) : ""
  const selectedCleanBody = selectedBody ? cleanReaderChapterText(selectedBody) : ""
  const qualityGate = manifest?.qualityGate && typeof manifest.qualityGate === "object" ? manifest.qualityGate as Record<string, any> : null
  const qualityPassed = Boolean(
    qualityGate?.passed === true
      || qualityGate?.status === "passed"
      || qualityGate?.status === "pass"
      || qualityGate?.status === "approved",
  )
  const styleContractVerificationStatus = String(
    options.styleEvolution?.contract?.verification?.status
      || options.styleEvolution?.contract?.loop?.verificationStatus
      || "",
  )
  const styleContractVerificationPassed = styleContractVerificationStatus === "passed"
  const memoryPath = String((manifest?.artifacts as Record<string, any> | undefined)?.memory || `.ai-novel/memory/${chapterId}-memory.md`)
  const reportPath = String((manifest?.artifacts as Record<string, any> | undefined)?.report || `.ai-novel/reports/${chapterId}-quality.md`)
  const memoryText = await readWorkspaceArtifactText(projectRoot, memoryPath)
  const reportText = await readWorkspaceArtifactText(projectRoot, reportPath)
  const relationshipGraphText = await readWorkspaceText(projectRoot, "memory", "characters", "relationships.json")
  const relationshipGraph = tryParseJsonText(relationshipGraphText)
  const hasRelationshipGraph = Boolean(
    relationshipGraphText.trim()
      && relationshipGraph
      && typeof relationshipGraph === "object"
      && (
        Array.isArray((relationshipGraph as Record<string, any>).edges)
          || Array.isArray((relationshipGraph as Record<string, any>).nodes)
          || Number((relationshipGraph as Record<string, any>).edgeCount || 0) > 0
      ),
  )
  const worldSlicePath = `.ai-novel/checkpoints/active-world-slices/${chapterId}-world-slice.md`
  const activeWorldSlice = await readWorkspaceArtifactText(projectRoot, worldSlicePath)
  const foreshadowingLedger = await readWorkspaceText(projectRoot, "plans", "foreshadowing-ledger.md")
  const checks = [
    {
      id: "version_manifest",
      label: "章节版本清单",
      passed: Boolean(manifest),
      detail: manifest ? `${manifest.versions.length} 个版本` : "缺少 chapter versions manifest",
    },
    {
      id: "selected_version",
      label: "当前阅读版本",
      passed: Boolean(selectedVersion && selectedCleanBody),
      detail: selectedVersion ? selectedVersion.path : "没有选中的可读版本",
    },
    {
      id: "quality_gate",
      label: "质量门禁",
      passed: qualityPassed,
      detail: String(qualityGate?.status || qualityGate?.reason || "未通过或未生成"),
    },
    {
      id: "quality_report",
      label: "质量报告",
      passed: Boolean(reportText?.trim()),
      detail: reportPath,
    },
    {
      id: "style_generation_verification",
      label: "写法生成验证",
      passed: styleContractVerificationPassed,
      detail: styleContractVerificationStatus || "缺少 Generation Verification Gate 结果",
    },
    {
      id: "chapter_memory",
      label: "章节记忆",
      passed: Boolean(memoryText?.trim()),
      detail: memoryPath,
    },
    {
      id: "relationship_graph",
      label: "人物关系图",
      passed: hasRelationshipGraph,
      detail: ".ai-novel/memory/characters/relationships.json",
    },
    {
      id: "active_world_slice",
      label: "活跃世界观切片",
      passed: Boolean(activeWorldSlice?.trim()),
      detail: worldSlicePath,
    },
    {
      id: "foreshadowing_ledger",
      label: "伏笔账本",
      passed: Boolean(foreshadowingLedger.trim()),
      detail: ".ai-novel/plans/foreshadowing-ledger.md",
    },
  ]
  const styleInheritanceVerification = buildReaderStyleInheritanceVerification({
    chapterNumber,
    manifest,
    baseChecks: checks,
    styleEvolution: options.styleEvolution,
    styleEvolutionAssets: options.styleEvolutionAssets,
    creativeProfile: options.creativeProfile,
  })
  if (manifest && typeof manifest === "object") {
    ;(manifest as Record<string, any>).styleInheritanceVerification = styleInheritanceVerification
  }
  const aigcDetection = manifest?.aigcDetection && typeof manifest.aigcDetection === "object"
    ? manifest.aigcDetection as Record<string, any>
    : null
  const qualityGateStatus = String(qualityGate?.status || "")
  const styleChecks = [
    {
      id: "style_contract_alignment",
      label: "写法继承验证",
      passed: styleInheritanceVerification.status === "ready",
      detail: styleInheritanceVerification.summary,
    },
    {
      id: "aigc_gate",
      label: "AIGC 检测",
      passed: String(aigcDetection?.status || "") === "passed",
      detail: String(
        aigcDetection?.status
          ? `${aigcDetection.status}${aigcDetection?.reason ? ` · ${aigcDetection.reason}` : ""}`
          : qualityGateStatus === "blocked" && /AIGC/u.test(String(qualityGate?.reason || ""))
            ? String(qualityGate?.reason || "")
            : "未记录 AIGC 检测结果",
      ),
    },
  ]
  const mergedChecks = [...checks, ...styleChecks]
  const missing = mergedChecks.filter((check) => !check.passed)
  return {
    ready: missing.length === 0,
    status: missing.length === 0 ? "ready" : "needs_review",
    locked: Boolean(manifest?.locked),
    selectedVersionId: manifest?.publishedVersionId || "",
    checkedAt: new Date().toISOString(),
    missing: missing.map((check) => ({ id: check.id, label: check.label, detail: check.detail })),
    checks: mergedChecks,
    styleInheritanceVerification,
  }
}

async function readReaderChapter(
  projectRoot: string,
  task: Partial<ChapterTask> & { chapterNumber: number; finalPath?: string; reviewedPath?: string; draftPath?: string },
  styleContext: {
    styleEvolution?: Awaited<ReturnType<typeof loadStyleEvolution>> | null
    styleEvolutionAssets?: Awaited<ReturnType<typeof readStyleEvolutionAssetSnapshot>> | null
    creativeProfile?: Record<string, unknown> | null
  } = {},
) {
  const chapterNumber = Number(task.chapterNumber)
  const taskRecord = task as Record<string, any>
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
  const versionManifest = await readReaderChapterVersionManifest(projectRoot, chapterNumber)
  const publishReadiness = await buildReaderChapterPublishReadiness(projectRoot, chapterNumber, versionManifest, styleContext)
  const enrichedVersionManifest = versionManifest
    ? { ...versionManifest, publishReadiness }
    : versionManifest
  const manifestCandidates = versionManifest?.versions?.length
    ? [
        ...(versionManifest.versions.filter((entry) => entry.id === versionManifest.publishedVersionId)),
        ...versionManifest.versions.filter((entry) => entry.id !== versionManifest.publishedVersionId),
      ].map((entry) => ({
        source: entry.source || entry.id,
        path: entry.path,
        versionId: entry.id,
      }))
    : []
  const candidates = [
    ...manifestCandidates,
    { source: "final", path: task.finalPath || `.ai-novel/chapters/${chapterId}.final.md` },
    { source: "reviewed", path: task.reviewedPath || `.ai-novel/chapters/${chapterId}.reviewed.md` },
    { source: "draft", path: task.draftPath || `.ai-novel/chapters/${chapterId}.draft.md` },
  ]

  for (const candidate of candidates) {
    const content = await readWorkspaceArtifactText(projectRoot, candidate.path)
    if (content) {
      const body = cleanReaderChapterText(content)
      if (body) {
        return {
          chapterNumber,
          title: readerChapterTitleFromRaw(content, String(task.title || ""), chapterNumber),
          status: String(task.status || (candidate.source === "final" ? "complete" : "available")),
          source: candidate.source,
          versionId: "versionId" in candidate ? candidate.versionId : candidate.source,
          path: candidate.path,
          targetWords: Number(task.targetWords || taskRecord.wordTarget || 0),
          wordCount: readerWordCount(body),
          summary: String(task.summary || ""),
          qualityGate: versionManifest?.qualityGate || task.qualityGate || null,
          aigcDetection: versionManifest?.aigcDetection || null,
          styleInheritanceVerification: publishReadiness.styleInheritanceVerification || null,
          publishReadiness,
          versionManifest: enrichedVersionManifest,
          body,
        }
      }
    }
  }

  return {
    chapterNumber,
    title: String(task.title || `第 ${chapterNumber} 章`),
    status: String(task.status || "pending"),
    source: "",
    versionId: "",
    path: "",
    targetWords: Number(task.targetWords || taskRecord.wordTarget || 0),
    wordCount: 0,
    summary: String(task.summary || ""),
    qualityGate: versionManifest?.qualityGate || task.qualityGate || null,
    aigcDetection: versionManifest?.aigcDetection || null,
    styleInheritanceVerification: publishReadiness.styleInheritanceVerification || null,
    publishReadiness,
    versionManifest: enrichedVersionManifest,
    body: "",
  }
}

function compactReaderChapter(chapter: Record<string, any>) {
  return {
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    status: chapter.status,
    source: chapter.source,
    versionId: chapter.versionId,
    path: chapter.path,
    targetWords: chapter.targetWords,
    wordCount: chapter.wordCount,
    summary: chapter.summary,
    qualityGate: chapter.qualityGate,
    aigcDetection: chapter.aigcDetection,
    styleInheritanceVerification: chapter.styleInheritanceVerification,
    publishReadiness: chapter.publishReadiness,
    versionManifest: chapter.versionManifest,
    hasBody: Boolean(chapter.body),
  }
}

function readerSearchSnippet(text = "", query = "", radius = 72) {
  const source = String(text || "").replace(/\s+/g, " ").trim()
  const needle = String(query || "").trim().toLowerCase()
  if (!source || !needle) return ""
  const index = source.toLowerCase().indexOf(needle)
  if (index < 0) return truncateReaderText(source, radius * 2)
  const start = Math.max(0, index - radius)
  const end = Math.min(source.length, index + needle.length + radius)
  return `${start > 0 ? "..." : ""}${source.slice(start, end).trim()}${end < source.length ? "..." : ""}`
}

function normalizeReaderDiffParagraphs(text = "") {
  return String(text || "")
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter(Boolean)
}

function createReaderVersionComparison(leftBody = "", rightBody = "") {
  const leftParagraphs = normalizeReaderDiffParagraphs(leftBody)
  const rightParagraphs = normalizeReaderDiffParagraphs(rightBody)
  const rightSet = new Set(rightParagraphs)
  const leftSet = new Set(leftParagraphs)
  const unchanged = leftParagraphs.filter((paragraph) => rightSet.has(paragraph)).length
  const removed = leftParagraphs.filter((paragraph) => !rightSet.has(paragraph))
  const added = rightParagraphs.filter((paragraph) => !leftSet.has(paragraph))
  return {
    unchangedParagraphs: unchanged,
    removedParagraphs: removed.length,
    addedParagraphs: added.length,
    leftParagraphs: leftParagraphs.length,
    rightParagraphs: rightParagraphs.length,
    removedPreview: removed.slice(0, 5),
    addedPreview: added.slice(0, 5),
  }
}

function normalizeReaderGraph(rawGraph: any) {
  const nodes = Array.isArray(rawGraph?.nodes) ? rawGraph.nodes : []
  const edges = Array.isArray(rawGraph?.edges) ? rawGraph.edges : []
  const storyNodeTypes = new Set(["character", "location", "faction", "event", "scene", "foreshadowing", "worldrule", "conflict", "relationship", "timelinepoint"])
  const compactNodes = nodes
    .filter((node: any) => storyNodeTypes.has(String(node.type || node.node_type || "").toLowerCase()))
    .slice(0, 80)
    .map((node: any) => ({
      id: String(node.id || ""),
      type: String(node.type || node.node_type || "Story"),
      label: String(node.label || node.name || node.id || "未命名"),
      summary: truncateReaderText(String(node.content || node.description || node.properties?.description || ""), 360),
    }))
  const nodeIds = new Set(compactNodes.map((node: any) => node.id))
  const compactEdges = edges
    .filter((edge: any) => nodeIds.has(String(edge.source || edge.source_id || edge.from_node_id || "")) && nodeIds.has(String(edge.target || edge.target_id || edge.to_node_id || "")))
    .slice(0, 120)
    .map((edge: any, index: number) => ({
      id: String(edge.id || `reader-edge-${index}`),
      source: String(edge.source || edge.source_id || edge.from_node_id || ""),
      target: String(edge.target || edge.target_id || edge.to_node_id || ""),
      label: String(edge.label || edge.type || edge.relation_type || "关联"),
    }))
  return { nodes: compactNodes, edges: compactEdges }
}

function compactReaderProjects(projects: Array<Record<string, any>> = []) {
  return projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    totalChapters: project.totalChapters,
    chapterWordTarget: project.chapterWordTarget,
    summary: project.summary
      ? {
        stage: project.summary.stage,
        progressPercent: project.summary.progressPercent,
        completedChapters: project.summary.completedChapters,
        totalChapters: project.summary.totalChapters,
        updatedAt: project.summary.updatedAt,
      }
      : null,
  }))
}

async function buildReaderSnapshot(rootDir: string, projectId?: string | null) {
  const context = await resolveProjectContext(rootDir, projectId)
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const dbSnapshot = await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId as string)).catch(() => null) as Record<string, any> | null
  const state = dbSnapshot?.state || await tryLoadState(context.projectRoot)
  const project = context.projects.find((entry) => entry.id === context.projectId)
  const stateTasks = Array.isArray(state?.plan?.chapterTasks) ? state.plan.chapterTasks : []
  const chapterFacts = Array.isArray(dbSnapshot?.chapterFacts) ? dbSnapshot.chapterFacts : []
  const styleContext = await loadReaderStyleContext(context.projectRoot, state)
  const taskByNumber = new Map<number, any>()

  for (const task of stateTasks) {
    const chapterNumber = Number(task.chapterNumber)
    if (Number.isFinite(chapterNumber) && chapterNumber > 0) {
      taskByNumber.set(chapterNumber, { ...taskByNumber.get(chapterNumber), ...task })
    }
  }
  for (const fact of chapterFacts) {
    const chapterNumber = Number(fact.chapterNumber || fact.chapter_number)
    if (Number.isFinite(chapterNumber) && chapterNumber > 0) {
      taskByNumber.set(chapterNumber, { ...taskByNumber.get(chapterNumber), ...fact, chapterNumber })
    }
  }

  const projectRoot = context.projectRoot
  const chapterFiles = await listWorkspaceFiles(projectRoot, "chapters")
  for (const fileName of chapterFiles) {
    const match = fileName.match(/^chapter-(\d+)\.(final|reviewed|draft)\.md$/)
    if (!match) continue
    const chapterNumber = Number.parseInt(match[1], 10)
    const source = match[2]
    const current = taskByNumber.get(chapterNumber) || { chapterNumber }
    taskByNumber.set(chapterNumber, {
      ...current,
      chapterNumber,
      [`${source}Path`]: `.ai-novel/chapters/${fileName}`,
    })
  }

  const chapters = (await Promise.all(
    [...taskByNumber.values()]
      .filter((task) => Number.isFinite(Number(task.chapterNumber)) && Number(task.chapterNumber) > 0)
      .sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber))
      .map((task) => readReaderChapter(context.projectRoot as string, task, styleContext)),
  )).filter((chapter) => chapter.body || chapter.path)
  const compactChapters = chapters.map((chapter) => compactReaderChapter(chapter))

  const memoryFiles = await listWorkspaceFiles(context.projectRoot, "memory")
  const memories = await Promise.all(memoryFiles
    .map((fileName) => ({ fileName, match: fileName.match(/^chapter-(\d+)-memory\.md$/) }))
    .filter((entry) => entry.match)
    .sort((a, b) => Number(a.match?.[1] || 0) - Number(b.match?.[1] || 0))
    .map(async (entry) => {
      const chapterNumber = Number(entry.match?.[1] || 0)
      const content = await readWorkspaceText(context.projectRoot as string, "memory", entry.fileName)
      return {
        chapterNumber,
        title: `第 ${chapterNumber} 章记忆`,
        content: truncateReaderText(content, 1600),
      }
    }))

  const dossiersJsonText = await readWorkspaceText(context.projectRoot, "memory", "characters", "dossiers.json")
  const dossiersMarkdown = await readWorkspaceText(context.projectRoot, "memory", "characters", "dossiers.md")
  const relationshipGraphText = await readWorkspaceText(context.projectRoot, "memory", "characters", "relationships.json")
  const relations = await readWorkspaceText(context.projectRoot, "memory", "characters", "relations.md")
  const evolution = await readWorkspaceText(context.projectRoot, "memory", "characters", "evolution.md")
  const graphText = await readWorkspaceText(context.projectRoot, "graph", "super-graph.json")
  const graph = normalizeReaderGraph(tryParseJsonText(graphText))
  const projectRecord = project as Record<string, any> | undefined
  const activeWorldSliceFiles = await listWorkspaceFiles(context.projectRoot, "checkpoints", "active-world-slices")
  const latestActiveWorldSliceFile = activeWorldSliceFiles
    .filter((fileName) => /^chapter-\d+-world-slice\.md$/u.test(fileName))
    .sort()
    .at(-1)
  const activeWorldSlice = latestActiveWorldSliceFile
    ? await readWorkspaceText(context.projectRoot, "checkpoints", "active-world-slices", latestActiveWorldSliceFile)
    : ""
  const storyFoundation = {
    contract: await readWorkspaceJson(context.projectRoot, "plans", "story-foundation-contract.json"),
    worldMatrix: await readWorkspaceJson(context.projectRoot, "plans", "world-matrix.json"),
    plotArchitecture: await readWorkspaceJson(context.projectRoot, "plans", "plot-architecture.json"),
    storyBible: await readWorkspaceJson(context.projectRoot, "plans", "story-bible.json"),
    volumeStrategy: await readWorkspaceJson(context.projectRoot, "plans", "volume-strategy.json"),
    foreshadowingLedger: await readWorkspaceJson(context.projectRoot, "plans", "foreshadowing-ledger.json"),
    characterDynamics: await readWorkspaceJson(context.projectRoot, "plans", "character-dynamics.json"),
    writingPlan: await readWorkspaceJson(context.projectRoot, "plans", "writing-plan.json"),
  }

  const lore = {
    activeWorldSlice: truncateReaderText(activeWorldSlice, 4000),
    activeWorldSlicePath: latestActiveWorldSliceFile ? `.ai-novel/checkpoints/active-world-slices/${latestActiveWorldSliceFile}` : "",
    settingFreeze: truncateReaderText(await readWorkspaceText(context.projectRoot, "plans", "setting-freeze.md"), 5000),
    masterOutline: truncateReaderText(await readWorkspaceText(context.projectRoot, "plans", "master-outline.md"), 5000),
    planBrief: truncateReaderText(await readWorkspaceText(context.projectRoot, "plans", "plan-and-solve-brief.md"), 3000),
    globalConsensus: truncateReaderText(await readWorkspaceText(context.projectRoot, "prompts", "global-consensus.md"), 3000),
    currentContext: truncateReaderText(await readWorkspaceText(context.projectRoot, "memory", "current-context-packet.md"), 3000),
    storyFoundation,
  }
  const readableChapters = chapters.filter((chapter) => chapter.body)
  const totalWords = readableChapters.reduce((sum, chapter) => sum + Number(chapter.wordCount || 0), 0)
  const currentChapterNumber = readableChapters.at(-1)?.chapterNumber || chapters.find((chapter) => chapter.body)?.chapterNumber || 1

  return {
    status: 200,
    payload: {
      activeProjectId: context.projectId,
      projects: compactReaderProjects(context.projects),
      project: {
        id: context.projectId,
        title: state?.project?.title || project?.title || "未命名小说",
        idea: state?.project?.idea || project?.idea || "",
        genre: state?.project?.creativeProfile?.genre || projectRecord?.creativeProfile?.genre || "",
        totalChapters: Number(state?.plan?.totalChapters || project?.totalChapters || chapters.length || 0),
        chapterWordTarget: Number(state?.plan?.chapterWordTarget || project?.chapterWordTarget || 0),
        stage: String(state?.runtime?.stage || project?.summary?.stage || ""),
      },
      chapters: compactChapters,
      currentChapterNumber,
      lore,
      characters: {
        dossiers: tryParseJsonText(dossiersJsonText) || [],
        dossiersMarkdown: truncateReaderText(dossiersMarkdown, 5000),
        relationshipGraph: tryParseJsonText(relationshipGraphText) || null,
        relations: truncateReaderText(relations, 4000),
        evolution: truncateReaderText(evolution, 4000),
      },
      memories,
      graph,
      styleEvolution: styleContext.styleEvolution,
      styleEvolutionAssets: styleContext.styleEvolutionAssets,
      stats: {
        totalChapters: chapters.length,
        readableChapters: readableChapters.length,
        completedChapters: chapters.filter((chapter) => chapter.status === "complete" || chapter.source === "final").length,
        totalWords,
      },
      envStatus: getPublicProjectEnvStatus(rootDir),
    },
  }
}

async function buildReaderChapterSnapshot(rootDir: string, projectId?: string | null, chapterNumberValue?: string | number | null) {
  const chapterNumber = Number(chapterNumberValue)
  if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
    return { status: 400, payload: { error: "chapter_required", envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const context = await resolveProjectContext(rootDir, projectId)
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const dbSnapshot = await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId as string)).catch(() => null) as Record<string, any> | null
  const state = dbSnapshot?.state || await tryLoadState(context.projectRoot)
  const styleContext = await loadReaderStyleContext(context.projectRoot, state)
  const stateTasks = Array.isArray(state?.plan?.chapterTasks) ? state.plan.chapterTasks : []
  const chapterFacts = Array.isArray(dbSnapshot?.chapterFacts) ? dbSnapshot.chapterFacts : []
  const task = { chapterNumber } as Record<string, any>

  for (const sourceTask of stateTasks) {
    if (Number(sourceTask?.chapterNumber) === chapterNumber) {
      Object.assign(task, sourceTask)
      break
    }
  }
  for (const fact of chapterFacts) {
    if (Number(fact?.chapterNumber || fact?.chapter_number) === chapterNumber) {
      Object.assign(task, fact, { chapterNumber })
      break
    }
  }

  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
  const chapterFiles = await listWorkspaceFiles(context.projectRoot, "chapters")
  for (const source of ["final", "reviewed", "draft"]) {
    if (chapterFiles.includes(`${chapterId}.${source}.md`)) {
      task[`${source}Path`] = `.ai-novel/chapters/${chapterId}.${source}.md`
    }
  }

  const chapter = await readReaderChapter(context.projectRoot, task as any, styleContext)
  if (!chapter.body && !chapter.path) {
    return {
      status: 404,
      payload: {
        error: "chapter_not_found",
        activeProjectId: context.projectId,
        chapterNumber,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  return {
    status: 200,
    payload: {
      activeProjectId: context.projectId,
      chapter,
      envStatus: getPublicProjectEnvStatus(rootDir),
    },
  }
}

async function buildReaderChapterVersionCompare(rootDir: string, projectId: string | null | undefined, chapterNumberValue: string | number | null, leftVersionValue?: string | null, rightVersionValue?: string | null) {
  const chapterNumber = Number(chapterNumberValue)
  if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
    return { status: 400, payload: { error: "chapter_required", envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const context = await resolveProjectContext(rootDir, projectId)
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const manifest = await readReaderChapterVersionManifest(context.projectRoot, chapterNumber)
  if (!manifest) {
    return { status: 404, payload: { error: "version_manifest_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus(rootDir) } }
  }
  const leftVersionId = String(leftVersionValue || manifest.publishedVersionId || "final").trim()
  const rightVersionId = String(rightVersionValue || "").trim()
  if (!rightVersionId) {
    return { status: 400, payload: { error: "right_version_required", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus(rootDir) } }
  }
  const leftVersion = manifest.versions.find((entry) => entry.id === leftVersionId)
  const rightVersion = manifest.versions.find((entry) => entry.id === rightVersionId)
  if (!leftVersion || !rightVersion) {
    return { status: 404, payload: { error: "version_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const leftRaw = await readWorkspaceArtifactText(context.projectRoot, leftVersion.path)
  const rightRaw = await readWorkspaceArtifactText(context.projectRoot, rightVersion.path)
  if (!leftRaw || !rightRaw) {
    return { status: 404, payload: { error: "version_file_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const leftBody = cleanReaderChapterText(leftRaw)
  const rightBody = cleanReaderChapterText(rightRaw)
  const comparison = createReaderVersionComparison(leftBody, rightBody)
  return {
    status: 200,
    payload: {
      activeProjectId: context.projectId,
      chapterNumber,
      publishedVersionId: manifest.publishedVersionId,
      left: {
        ...leftVersion,
        title: readerChapterTitleFromRaw(leftRaw, manifest.chapterTitle, chapterNumber),
        wordCount: readerWordCount(leftBody),
        preview: truncateReaderText(leftBody, 2600),
      },
      right: {
        ...rightVersion,
        title: readerChapterTitleFromRaw(rightRaw, manifest.chapterTitle, chapterNumber),
        wordCount: readerWordCount(rightBody),
        preview: truncateReaderText(rightBody, 2600),
      },
      comparison,
      envStatus: getPublicProjectEnvStatus(rootDir),
    },
  }
}

async function updateReaderChapterVersion(rootDir: string, body: Record<string, unknown>, projectId?: string | null) {
  const chapterNumber = Number(body.chapterNumber)
  const requestedVersionId = String(body.versionId || "").trim()
  if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
    return { status: 400, payload: { error: "chapter_required", envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const context = await resolveProjectContext(rootDir, projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
  const manifestPath = path.join(context.projectRoot, ".ai-novel", "chapters", `${chapterId}.versions.json`)
  const rawManifest = await readWorkspaceArtifactText(context.projectRoot, `.ai-novel/chapters/${chapterId}.versions.json`)
  const manifest = rawManifest ? tryParseJsonText(rawManifest) : null
  if (!manifest || typeof manifest !== "object") {
    return { status: 404, payload: { error: "version_manifest_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const record = manifest as Record<string, any>
  const versionId = requestedVersionId || String(record.publishedVersionId || "").trim()
  if (!versionId) {
    return { status: 400, payload: { error: "version_required", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus(rootDir) } }
  }
  const versions = Array.isArray(record.versions) ? record.versions : []
  const selected = versions.find((entry) => entry && typeof entry === "object" && String(entry.id || entry.source || "") === versionId)
  if (!selected) {
    return { status: 404, payload: { error: "version_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus(rootDir) } }
  }
  const selectedPath = String(selected.path || "")
  const selectedBody = selectedPath ? await readWorkspaceArtifactText(context.projectRoot, selectedPath) : null
  if (!selectedBody) {
    return { status: 404, payload: { error: "version_file_not_found", activeProjectId: context.projectId, path: selectedPath, envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const updatedAt = new Date().toISOString()
  const requestedLocked = typeof body.locked === "boolean" ? body.locked : versionId === "final"
  const nextManifest: Record<string, any> = {
    ...record,
    publishedVersionId: versionId,
    locked: requestedLocked,
    status: requestedLocked ? "published" : "selected",
    updatedAt,
    versions: versions.map((entry) => (
      entry && typeof entry === "object" && String(entry.id || entry.source || "") === versionId
        ? { ...entry, selectedAt: updatedAt }
        : entry
    )),
  }
  const state = await tryLoadState(context.projectRoot).catch(() => null)
  const styleContext = await loadReaderStyleContext(context.projectRoot, state)
  const publishReadiness = await buildReaderChapterPublishReadiness(context.projectRoot, chapterNumber, nextManifest as any, styleContext)
  if (requestedLocked && !publishReadiness.ready) {
    return {
      status: 409,
      payload: {
        error: "publish_not_ready",
        activeProjectId: context.projectId,
        publishReadiness,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }
  nextManifest.publishReadiness = publishReadiness
  await fs.mkdir(path.dirname(manifestPath), { recursive: true })
  await fs.writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`)

  const chapterResponse = await buildReaderChapterSnapshot(rootDir, context.projectId, chapterNumber)
  const snapshotResponse = await buildReaderSnapshot(rootDir, context.projectId)
  return {
    status: 200,
    payload: {
      success: true,
      activeProjectId: context.projectId,
      chapter: chapterResponse.status === 200 ? chapterResponse.payload.chapter : null,
      snapshot: snapshotResponse.status === 200 ? snapshotResponse.payload : null,
      envStatus: getPublicProjectEnvStatus(rootDir),
    },
  }
}

async function persistBatchRefineManifestUpdate(input: {
  rootDir: string
  projectRoot: string
  projectId: string
  chapterNumber: number
  finalDraft: string
  finalAigcReport: ReturnType<typeof normalizeAigcWritingDetectionReport>
  styleConformanceDrift: ReturnType<typeof evaluateChapterStyleConformanceDrift>
  refined: boolean
  blockedReason?: string
}) {
  const chapterId = `chapter-${String(input.chapterNumber).padStart(3, "0")}`
  const manifestPath = path.join(input.projectRoot, ".ai-novel", "chapters", `${chapterId}.versions.json`)
  const rawManifest = await readWorkspaceArtifactText(input.projectRoot, `.ai-novel/chapters/${chapterId}.versions.json`)
  const manifest = rawManifest ? tryParseJsonText(rawManifest) : null
  const record: Record<string, any> = manifest && typeof manifest === "object"
    ? manifest as Record<string, any>
    : {
      version: 1,
      chapterNumber: input.chapterNumber,
      publishedVersionId: "final",
      versions: [],
    }
  const versions = Array.isArray(record.versions) ? record.versions : []
  const finalRelativePath = `.ai-novel/chapters/${chapterId}.final.md`
  const finalVersionExists = versions.some((entry) => entry && typeof entry === "object" && String(entry.id || entry.source || "") === "final")
  const nextVersions = finalVersionExists
    ? versions.map((entry) => (
      entry && typeof entry === "object" && String(entry.id || entry.source || "") === "final"
        ? {
          ...entry,
          path: String(entry.path || finalRelativePath),
          wordCount: readerWordCount(cleanReaderChapterText(input.finalDraft)),
          status: input.refined ? "refined" : String(entry.status || "final"),
          updatedAt: new Date().toISOString(),
        }
        : entry
    ))
    : [
      ...versions,
      {
        id: "final",
        label: "Final",
        source: "final",
        path: finalRelativePath,
        wordCount: readerWordCount(cleanReaderChapterText(input.finalDraft)),
        status: input.refined ? "refined" : "final",
        createdAt: new Date().toISOString(),
      },
    ]
  const shouldLock = input.refined
    && input.finalAigcReport.status === "passed"
    && input.styleConformanceDrift.status === "conformant"
    && Boolean(record.locked)
  const nextManifest: Record<string, any> = {
    ...record,
    version: Number(record.version || 1),
    publishedVersionId: String(record.publishedVersionId || "final"),
    locked: shouldLock,
    status: shouldLock ? "published" : "needs_review",
    updatedAt: new Date().toISOString(),
    versions: nextVersions,
    aigcDetection: input.finalAigcReport,
    styleConformanceDrift: input.styleConformanceDrift,
    batchRefine: {
      refined: input.refined,
      blockedReason: input.blockedReason || "",
      checkedAt: new Date().toISOString(),
    },
  }
  const state = await tryLoadState(input.projectRoot).catch(() => null)
  const styleContext = await loadReaderStyleContext(input.projectRoot, state)
  nextManifest.publishReadiness = await buildReaderChapterPublishReadiness(
    input.projectRoot,
    input.chapterNumber,
    nextManifest as any,
    styleContext,
  )
  await fs.mkdir(path.dirname(manifestPath), { recursive: true })
  await fs.writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`)
  return nextManifest
}

async function validateWorkflowCompletionReadiness(
  rootDir: string,
  projectRoot: string,
  projectId: string,
  state: Awaited<ReturnType<typeof loadAutonomousState>>,
) {
  const workspacePayload = await createWorkspacePayload(projectRoot, state, {
    rootDir,
    projectId,
    syncState: false,
    includeTranscript: false,
    compactPayload: true,
  })
  const productionReadiness = workspacePayload.productionReadiness as Record<string, any> | undefined
  if (productionReadiness?.canProceed !== true || productionReadiness?.status !== "passed") {
    return {
      ok: false,
      error: "workflow_completion_readiness_blocked",
      reason: String(productionReadiness?.blockedReason || productionReadiness?.summary || "生产就绪门禁未通过。"),
      productionReadiness,
    }
  }

  const readerSnapshot = await buildReaderSnapshot(rootDir, projectId)
  if (readerSnapshot.status !== 200) {
    return {
      ok: false,
      error: "workflow_completion_reader_snapshot_unavailable",
      reason: String((readerSnapshot.payload as Record<string, any>)?.error || "阅读器发布快照不可用。"),
      productionReadiness,
    }
  }
  const readerPayload = readerSnapshot.payload as Record<string, any>
  const chapters = Array.isArray(readerPayload.chapters) ? readerPayload.chapters : []
  const totalChapters = Number(readerPayload.project?.totalChapters || state.plan?.totalChapters || state.plan?.chapterTasks?.length || 0)
  const readableChapters = Number(readerPayload.stats?.readableChapters || chapters.length || 0)
  const blockedChapters = chapters.filter((chapter: Record<string, any>) => chapter?.publishReadiness?.ready !== true)
  if (totalChapters > 0 && readableChapters < totalChapters) {
    return {
      ok: false,
      error: "workflow_completion_reader_chapters_incomplete",
      reason: `阅读器只发现 ${readableChapters}/${totalChapters} 个可读章节。`,
      productionReadiness,
      readerStats: readerPayload.stats || null,
    }
  }
  if (blockedChapters.length > 0) {
    return {
      ok: false,
      error: "workflow_completion_publish_readiness_blocked",
      reason: `${blockedChapters.length} 个章节发布就绪验证未通过。`,
      productionReadiness,
      blockedChapters: blockedChapters.map((chapter: Record<string, any>) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        missing: chapter.publishReadiness?.missing || [],
        styleInheritanceVerification: chapter.publishReadiness?.styleInheritanceVerification || chapter.styleInheritanceVerification || null,
      })),
    }
  }

  return {
    ok: true,
    productionReadiness,
    readerStats: readerPayload.stats || null,
  }
}

async function buildReaderSearchSnapshot(rootDir: string, projectId?: string | null, queryValue?: string | null, limitValue?: string | number | null) {
  const query = String(queryValue || "").trim()
  if (!query) {
    return { status: 200, payload: { activeProjectId: projectId || null, query, results: [], envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const context = await resolveProjectContext(rootDir, projectId)
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus(rootDir) } }
  }

  const limit = Math.max(1, Math.min(80, Number(limitValue) || 40))
  const projectRoot = context.projectRoot
  const chapterFiles = await listWorkspaceFiles(projectRoot, "chapters")
  const groupedFiles = new Map<number, Record<string, string>>()
  for (const fileName of chapterFiles) {
    const match = fileName.match(/^chapter-(\d+)\.(final|reviewed|draft)\.md$/)
    if (!match) continue
    const chapterNumber = Number.parseInt(match[1], 10)
    const source = match[2]
    groupedFiles.set(chapterNumber, {
      ...(groupedFiles.get(chapterNumber) || {}),
      [source]: `.ai-novel/chapters/${fileName}`,
    })
  }

  const lowerQuery = query.toLowerCase()
  const results = []
  for (const [chapterNumber, paths] of [...groupedFiles.entries()].sort((a, b) => a[0] - b[0])) {
    const source = paths.final ? "final" : paths.reviewed ? "reviewed" : paths.draft ? "draft" : ""
    const path = source ? paths[source] : ""
    if (!path) continue
    const raw = await readWorkspaceArtifactText(projectRoot, path)
    if (!raw) continue
    const body = cleanReaderChapterText(raw)
    if (!body) continue
    const searchable = `${readerChapterTitleFromRaw(raw, "", chapterNumber)}\n${body}`.toLowerCase()
    if (!searchable.includes(lowerQuery)) continue
    const bodyMatches = body.toLowerCase().split(lowerQuery).length - 1
    results.push({
      chapterNumber,
      title: readerChapterTitleFromRaw(raw, "", chapterNumber),
      source,
      path,
      wordCount: readerWordCount(body),
      matchCount: Math.max(1, bodyMatches),
      snippet: readerSearchSnippet(body, query, 92),
    })
    if (results.length >= limit) break
  }

  return {
    status: 200,
    payload: {
      activeProjectId: context.projectId,
      query,
      results,
      envStatus: getPublicProjectEnvStatus(rootDir),
    },
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
  // 轻量路径：列表/刷新场景不需要 getSnapshot 的全量构建（artifacts/memory/graph 等）。
  // 先取轻量摘要 + state_json 的 runtime/plan 摘要字段，仅在必要时回退到 getSnapshot。
  const summaryMeta = await withFactoryDb(rootDir, async (db) => db.getProjectSummaryMeta(project.id)).catch(() => null)

  // state 从磁盘加载（避免 getSnapshot 读 2.75MB 的 state_json 全量解析）；
  // tryLoadState 只解析需要的浅层字段。列表页不需要完整 state 对象。
  const state = await tryLoadState(project.projectRoot).catch(() => null)
  const dbSnapshot: any = null
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
  const totalChapters = Number(state.plan?.totalChapters || project.totalChapters || tasks.length || 0)

  // 章节统计：优先用 DB 轻量摘要（实况），回退到 state.plan.chapterTasks。
  const statusCount = (st: string): number => {
    if (summaryMeta) {
      const hit = summaryMeta.chapterStatusCounts.find((row: any) => row.status === st)
      if (hit) return Number(hit.n)
      return 0
    }
    return tasks.filter((task: any) => task.status === st).length
  }
  const completedChapters = statusCount("complete")
  const inProgressChapters = statusCount("in_progress")
  const blockedChapters = statusCount("blocked")
  const pendingChapters = Math.max(0, totalChapters - completedChapters - inProgressChapters - blockedChapters)
  const progressPercent = totalChapters > 0
    ? Math.max(0, Math.min(100, Math.round((completedChapters / totalChapters) * 100)))
    : 0

  const activeJobs = summaryMeta?.activeJobs || 0
  const runnableJobs = summaryMeta?.runnableJobs || 0

  const projectRuntime = deriveProjectRuntimeState({
    state,
    factorySnapshot: dbSnapshot,
  })
  const progress = projectRuntime.chapterProgress

  return {
    source: summaryMeta ? "db" : "state",
    stage: projectRuntime.workflowStage,
    progressPercent: progress.progressPercent || progressPercent,
    totalChapters: progress.totalChapters || totalChapters,
    completedChapters: progress.completedChapters,
    pendingChapters: progress.pendingChapters,
    inProgressChapters: progress.inProgressChapters,
    blockedChapters: progress.blockedChapters,
    activeJobs,
    runnableJobs,
    latestEventType: summaryMeta?.latestEventType || "",
    latestEventAt: summaryMeta?.latestEventAt || "",
    updatedAt: state.runtime?.lastUpdatedAt || new Date().toISOString(),
    projectRuntime,
    coverStatus: state.assets?.cover?.status || "pending",
    coverImagePath: state.assets?.cover?.imagePath || "",
    coverGeneratedAt: state.assets?.cover?.generatedAt || "",
    coverPromptPath: state.assets?.cover?.promptPath || "",
    coverError: state.assets?.cover?.error || "",
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
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs()
    })
    const routes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes()
    })
    return {
      status: 200,
      payload: {
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(routes),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/llm-configs") {
    const name = String(body.name || "").trim()
    const baseUrl = String(body.baseUrl || "").trim()
    const apiKey = String(body.apiKey || "").trim()
    const modelName = String(body.modelName || "").trim()
    const apiMode = normalizeLlmApiMode(body.apiMode ?? body.api_mode)
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
        db.updateLlmConfig(configId, { name, baseUrl, apiKey: nextApiKey, modelName, apiMode, temperature, timeoutMs })
      } else {
        const existingConfigs = db.listLlmConfigs()
        const hasActiveConfig = existingConfigs.some((config) => Number(config.is_active) === 1)
        db.addLlmConfig({ name, baseUrl, apiKey, modelName, apiMode, temperature, timeoutMs, isActive: !hasActiveConfig })
      }
    })

    await loadActiveLlmConfig(rootDir)

    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs()
    })
    const routes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes()
    })

    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(routes),
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
    const routes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes()
    })

    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(routes),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/llm-config-routes") {
    const routes = body.routes && typeof body.routes === "object" && !Array.isArray(body.routes)
      ? body.routes as Record<string, unknown>
      : null
    if (!routes) {
      return { status: 400, payload: { error: "routes_required" } }
    }

    await withFactoryDb(rootDir, async (db) => {
      for (const [capability, configId] of Object.entries(routes)) {
        if (typeof configId === "string" && configId.trim()) {
          db.setLlmConfigRoute(capability, configId.trim())
        } else {
          db.deleteLlmConfigRoute(capability)
        }
      }
    })

    await loadActiveLlmConfig(rootDir)

    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs()
    })
    const nextRoutes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes()
    })

    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(nextRoutes),
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
    const routes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes()
    })

    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(routes),
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
    const totalChapters = Number.parseInt(String(body.chapters || PRODUCTION_DEFAULT_TOTAL_CHAPTERS), 10)
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET), 10)

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

  if (method === "GET" && requestPathname === "/api/style-evolution") {
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const styleEvolution = await loadStyleEvolution(context.projectRoot)
    const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        styleEvolution,
        styleEvolutionAssets,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/style-evolution/init") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const state = await loadAutonomousState(context.projectRoot).catch(() => null)
    const styleEvolution = await initializeStyleEvolution(context.projectRoot, {
      projectTitle: typeof body.projectTitle === "string" ? body.projectTitle : state?.project?.title,
      idea: typeof body.idea === "string" ? body.idea : state?.project?.idea,
      seedPrompt: typeof body.seedPrompt === "string" ? body.seedPrompt : undefined,
      userStylePrompt: typeof body.userStylePrompt === "string" ? body.userStylePrompt : undefined,
      referenceText: typeof body.referenceText === "string" ? body.referenceText : undefined,
      referenceWorks: Array.isArray(body.referenceWorks) ? body.referenceWorks.filter((item): item is string => typeof item === "string") : undefined,
      desiredVibes: Array.isArray(body.desiredVibes) ? body.desiredVibes.filter((item): item is string => typeof item === "string") : undefined,
      seedForbiddenPatterns: Array.isArray(body.seedForbiddenPatterns) ? body.seedForbiddenPatterns.filter((item): item is string => typeof item === "string") : undefined,
      overwrite: body.overwrite === true,
    })
    const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        styleEvolution,
        styleEvolutionAssets,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/style-evolution/candidate") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
    const sample = typeof body.sample === "string" ? body.sample.trim() : ""
    const review = typeof body.review === "string" ? body.review : undefined
    if (!prompt || !sample) {
      return { status: 400, payload: { error: "prompt_and_sample_required" } }
    }
    const currentStyleEvolution = await loadStyleEvolution(context.projectRoot)
    let aigcSignal: ReturnType<typeof normalizeStyleAigcSignal> | undefined
    const aigcConfig = getAigcDetectorConfig(context.projectRoot)
    aigcSignal = await detectStyleAigcSignal(sample, aigcConfig, "manual-style-candidate")
    const evaluation = evaluateStyleEvolutionCandidate({
      prompt,
      sample,
      userStylePrompt: currentStyleEvolution.contract.userStylePrompt,
      aigc: aigcSignal,
    })
    const refinement = buildStyleEvolutionRefinement({
      prompt,
      userStylePrompt: currentStyleEvolution.contract.userStylePrompt,
      evaluation,
    })
    const verification = buildStyleGenerationVerification({
      evaluation,
      sample,
      checkedAt: new Date().toISOString(),
    })
    const freezer = buildStyleFreezerGateRecord(null, { evaluation, verification })
    const styleEvolution = await appendStyleEvolutionCandidate(context.projectRoot, {
      prompt,
      sample,
      review: review || evaluation.summary,
      evaluation,
      refinement,
      freezer,
      source: "manual",
    })
    const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot)
    const latest = Array.isArray(styleEvolution.contract.evolutionHistory)
      ? styleEvolution.contract.evolutionHistory.at(-1)
      : null
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "workflow-control",
      toolName: "style-evolution.candidate",
      status: "completed",
      input: { source: "manual", sampleChars: sample.length },
      output: {
        version: latest?.version,
        verificationStatus: latest?.verification?.status || styleEvolution.contract.verification?.status || "missing",
        freezerVerdict: latest?.freezer?.verdict || "missing",
        gateStatus: styleEvolution.gate.status,
      },
      content: `Style candidate v${latest?.version || "?"} recorded for review.`,
      metadata: {
        source: "api_style_evolution_candidate",
        artifactPath: ".ai-novel/style/evolution/style-contract.json",
        artifactLabel: "Style contract",
        artifactKind: "style-contract",
        artifacts: styleEvolutionArtifactItems(styleEvolutionAssets),
      },
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        styleEvolution,
        styleEvolutionAssets,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/style-evolution/generate-candidate") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }

    const state = await loadAutonomousState(context.projectRoot).catch(() => null)
    let styleEvolution = await loadStyleEvolution(context.projectRoot)
    const userStylePrompt = typeof body.userStylePrompt === "string" ? body.userStylePrompt.trim() : ""
    const referenceText = typeof body.referenceText === "string" ? body.referenceText.trim() : ""
    const referenceWorks = Array.isArray(body.referenceWorks) ? body.referenceWorks.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []
    const desiredVibes = Array.isArray(body.desiredVibes) ? body.desiredVibes.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []
    const seedForbiddenPatterns = Array.isArray(body.seedForbiddenPatterns) ? body.seedForbiddenPatterns.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : []
    const iterationFeedback = typeof body.iterationFeedback === "string" ? body.iterationFeedback.trim() : ""
    if (!styleEvolution.contract.seedPrompt?.trim() || userStylePrompt || referenceText || referenceWorks.length || desiredVibes.length || seedForbiddenPatterns.length) {
      styleEvolution = await initializeStyleEvolution(context.projectRoot, {
        projectTitle: state?.project?.title,
        idea: state?.project?.idea,
        userStylePrompt: userStylePrompt || styleEvolution.contract.userStylePrompt,
        referenceText: referenceText || styleEvolution.contract.referenceText,
        referenceWorks: referenceWorks.length ? referenceWorks : styleEvolution.contract.referenceWorks,
        desiredVibes: desiredVibes.length ? desiredVibes : styleEvolution.contract.desiredVibes,
        seedForbiddenPatterns: seedForbiddenPatterns.length ? seedForbiddenPatterns : styleEvolution.contract.seedForbiddenPatterns,
      })
    }

    const textConfig = await loadStyleEvolutionLlmConfig(rootDir)
    const apiKey = textConfig?._dbApiKey || ""
    if (!textConfig || !apiKey) {
      return {
        status: 400,
        payload: {
          error: "text_llm_config_required",
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    const loopRun = await runStyleEvolutionLoop({
      projectRoot: context.projectRoot,
      rootDir,
      projectTitle: state?.project?.title,
      idea: state?.project?.idea,
      userStylePrompt: userStylePrompt || styleEvolution.contract.userStylePrompt,
      referenceText: referenceText || styleEvolution.contract.referenceText,
      referenceWorks: referenceWorks.length ? referenceWorks : styleEvolution.contract.referenceWorks,
      desiredVibes: desiredVibes.length ? desiredVibes : styleEvolution.contract.desiredVibes,
      seedForbiddenPatterns: seedForbiddenPatterns.length ? seedForbiddenPatterns : styleEvolution.contract.seedForbiddenPatterns,
      iterationFeedback,
      textConfig,
      apiKey,
      maxIterations: resolveStyleLoopIterations(body.loopIterations, 1),
      candidateCount: resolveStyleCandidateCount(body.candidateCount, 1),
    })
    styleEvolution = loopRun.styleEvolution
    const latestIteration = loopRun.iterations.at(-1)
    if (!latestIteration?.sample?.trim()) {
      const allBlocked = loopRun.stopReason === "style_candidates_all_blocked"
      const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot)
      await recordToolMessage(rootDir, {
        projectId: context.projectId,
        conversationId: "workflow-control",
        runId: loopRun.loopRuntime.runId,
        toolName: "style-evolution.generate-candidate",
        status: allBlocked ? "completed" : "failed",
        input: {
          loopIterations: resolveStyleLoopIterations(body.loopIterations, 1),
          candidateCount: resolveStyleCandidateCount(body.candidateCount, 1),
          userStylePrompt: userStylePrompt || styleEvolution.contract.userStylePrompt || "",
        },
        output: {
          stopReason: loopRun.stopReason,
          completedIterations: loopRun.iterations.length,
          finalLoopStatus: loopRun.loopRuntime.finalLoopStatus,
          finalConvergence: loopRun.loopRuntime.finalConvergence,
        },
        error: allBlocked ? undefined : "style_candidate_empty_response",
        content: allBlocked
          ? "Style Evolution generated candidates, but all were blocked by Generation Verification Gate. The blocked candidates and reasons are available in the loop runtime artifact."
          : "Style Evolution did not return a usable candidate sample.",
        metadata: {
          source: "api_style_evolution_generate_candidate",
          artifactPath: ".ai-novel/style/evolution/style-loop-runtime.json",
          artifactLabel: "Style loop runtime",
          artifactKind: "style-loop-runtime",
          artifacts: styleEvolutionArtifactItems(styleEvolutionAssets),
        },
      })
      return {
        status: allBlocked ? 200 : 502,
        payload: {
          error: allBlocked ? "style_candidates_all_blocked" : "style_candidate_empty_response",
          status: allBlocked ? "blocked" : "failed",
          reason: allBlocked
            ? "本轮所有候选都未通过 Generation Verification Gate，系统没有把失败样段写入正式候选历史；可根据 loopRun.iterations 中的候选与原因继续重试。"
            : undefined,
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets: await readStyleEvolutionAssetSnapshot(context.projectRoot),
	          loopRun: {
	            runId: loopRun.loopRuntime.runId,
	            totalIterations: loopRun.iterations.length,
	            candidateCount: resolveStyleCandidateCount(body.candidateCount, 1),
	            stopReason: loopRun.stopReason,
	            status: loopRun.loopRuntime.status,
	            startedAt: loopRun.loopRuntime.startedAt,
	            completedAt: loopRun.loopRuntime.completedAt,
	            iterations: loopRun.loopRuntime.iterations,
	          },
	          modelRouting: {
	            capability: textConfig._capability || "style_evolution",
	            configId: textConfig._configId,
	            modelName: textConfig.provider.modelName,
	            apiMode: textConfig.provider.apiMode,
	          },
	          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }
    const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot)
    const latest = Array.isArray(styleEvolution.contract.evolutionHistory)
      ? styleEvolution.contract.evolutionHistory.at(-1)
      : null
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "workflow-control",
      runId: loopRun.loopRuntime.runId,
      toolName: "style-evolution.generate-candidate",
      status: "completed",
      input: {
        loopIterations: resolveStyleLoopIterations(body.loopIterations, 1),
        candidateCount: resolveStyleCandidateCount(body.candidateCount, 1),
        userStylePrompt: userStylePrompt || styleEvolution.contract.userStylePrompt || "",
      },
      output: {
        version: styleEvolution.contract.evolutionHistory?.at(-1)?.version,
        candidateIndex: latestIteration.candidates?.[0]?.candidateIndex
          ? latestIteration.candidates.find((entry) => entry.sample === latestIteration.sample)?.candidateIndex
          : 1,
        stopReason: loopRun.stopReason,
        completedIterations: loopRun.iterations.length,
        finalLoopStatus: loopRun.loopRuntime.finalLoopStatus,
        finalConvergence: loopRun.loopRuntime.finalConvergence,
        verificationStatus: latest?.verification?.status || latestIteration.verification?.status || "missing",
        freezerVerdict: latest?.freezer?.verdict || latestIteration.freezer?.verdict || "missing",
        modelName: textConfig.provider.modelName,
      },
      content: `Style Evolution candidate v${latest?.version || "?"} generated: ${loopRun.stopReason}.`,
      metadata: {
        source: "api_style_evolution_generate_candidate",
        artifactPath: ".ai-novel/style/evolution/style-contract.json",
        artifactLabel: "Style contract",
        artifactKind: "style-contract",
        artifacts: styleEvolutionArtifactItems(styleEvolutionAssets),
      },
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        styleEvolution,
        styleEvolutionAssets,
        generatedCandidate: {
          prompt: latestIteration.prompt,
          sample: latestIteration.sample,
          version: styleEvolution.contract.evolutionHistory?.at(-1)?.version,
          candidateIndex: latestIteration.candidates?.[0]?.candidateIndex
            ? latestIteration.candidates.find((entry) => entry.sample === latestIteration.sample)?.candidateIndex
            : 1,
        },
        loopIteration: {
          evaluation: latestIteration.evaluation,
          refinement: latestIteration.refinement,
          verification: latestIteration.verification,
          candidates: latestIteration.candidates || [],
          status: styleEvolution.contract.loop || null,
        },
        loopRun: {
          runId: loopRun.loopRuntime.runId,
          totalIterations: loopRun.iterations.length,
          candidateCount: resolveStyleCandidateCount(body.candidateCount, 1),
          stopReason: loopRun.stopReason,
          status: loopRun.loopRuntime.status,
          startedAt: loopRun.loopRuntime.startedAt,
          completedAt: loopRun.loopRuntime.completedAt,
          finalLoopStatus: loopRun.loopRuntime.finalLoopStatus,
          finalConvergence: loopRun.loopRuntime.finalConvergence,
          iterations: loopRun.iterations.map((entry) => ({
            version: entry.version,
          candidates: entry.candidates || [],
          evaluation: entry.evaluation,
          refinement: entry.refinement,
          verification: entry.verification,
          freezer: entry.freezer,
          freezerSource: entry.freezer?.source,
          llmFallbackUsed: entry.llmFallbackUsed,
          fallbackReasons: entry.fallbackReasons,
        })),
        },
        modelRouting: {
          capability: textConfig._capability || "style_evolution",
          configId: textConfig._configId,
          modelName: textConfig.provider.modelName,
          apiMode: textConfig.provider.apiMode,
        },
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/style-evolution/freeze-preview") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const version = typeof body.version === "number"
      ? body.version
      : typeof body.version === "string" && body.version.trim()
        ? Number.parseInt(body.version, 10)
        : undefined
    const antiPatterns = Array.isArray(body.antiPatterns)
      ? body.antiPatterns.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined
    try {
      const freezePreview = await buildStyleFreezePreview({
        projectRoot: context.projectRoot,
        rootDir,
        version: Number.isFinite(version) ? version : undefined,
        sample: typeof body.sample === "string" ? body.sample : undefined,
        frozenBasePrompt: typeof body.frozenBasePrompt === "string" ? body.frozenBasePrompt : undefined,
        antiPatterns,
      })
      const styleEvolution = await loadStyleEvolution(context.projectRoot)
      const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot)
      await recordToolMessage(rootDir, {
        projectId: context.projectId,
        conversationId: "workflow-control",
        toolName: "style-evolution.freeze-preview",
        status: "completed",
        input: { version: Number.isFinite(version) ? version : undefined },
        output: {
          version: freezePreview.version,
          contractExtractionSource: freezePreview.contractExtractionSource,
          freezeAdviceSource: freezePreview.freezeAdviceSource,
          llmFallbackUsed: freezePreview.llmFallbackUsed,
          freezerVerdict: freezePreview.freezer?.verdict || "missing",
        },
        content: `Style freeze preview prepared for v${freezePreview.version || "?"}.`,
        metadata: {
          source: "api_style_evolution_freeze_preview",
          artifactPath: ".ai-novel/style/evolution/style-contract.json",
          artifactLabel: "Style contract",
          artifactKind: "style-contract",
          artifacts: styleEvolutionArtifactItems(styleEvolutionAssets),
        },
      })
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets,
          freezePreview,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
	    } catch (error) {
	      const styleWorkspace = await buildStyleEvolutionWorkspacePayloadSafe(rootDir, {
	        projectRoot: context.projectRoot,
	        projectId: context.projectId,
	      })
	      return {
	        status: 400,
	        payload: {
	          error: error instanceof Error ? error.message : String(error),
	          activeProjectId: context.projectId,
	          projects: context.projects,
	          ...styleWorkspace,
	          envStatus: getPublicProjectEnvStatus(rootDir),
	        },
	      }
    }
  }

  if (method === "POST" && requestPathname === "/api/style-evolution/approve") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const version = typeof body.version === "number"
      ? body.version
      : typeof body.version === "string" && body.version.trim()
        ? Number.parseInt(body.version, 10)
        : undefined
    const sample = typeof body.sample === "string" ? body.sample : undefined
    let styleContract = body.styleContract && typeof body.styleContract === "object" && !Array.isArray(body.styleContract)
      ? body.styleContract as Record<string, unknown>
      : undefined
    const antiPatterns = Array.isArray(body.antiPatterns)
      ? body.antiPatterns.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined

    try {
      const approvedAt = typeof body.approvedAt === "string" ? body.approvedAt : undefined
      let freezePreview: Awaited<ReturnType<typeof buildStyleFreezePreview>> | null = null
      const approvalFallbackReasons: string[] = []
      try {
        freezePreview = await buildStyleFreezePreview({
          projectRoot: context.projectRoot,
          rootDir,
          version: Number.isFinite(version) ? version : undefined,
          sample,
          frozenBasePrompt: typeof body.frozenBasePrompt === "string" ? body.frozenBasePrompt : undefined,
          antiPatterns,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        if ([
          "style_candidate_not_found",
          "style_candidate_rejected",
          "style_generation_verification_blocked",
          "style_candidate_not_verified",
        ].includes(errorMessage)) {
          throw error
        }
        approvalFallbackReasons.push(`style_freeze_preview_synthesis_failed: ${errorMessage}`.slice(0, 360))
        console.warn("Style approval freeze preview synthesis failed; approval will continue with available contract data.", error)
      }
      if (!freezePreview && !styleContract) {
        approvalFallbackReasons.push("style_approval_contract_will_use_core_local_fallback")
      }
      const styleFreezeApproval = {
        llmFallbackUsed: freezePreview?.llmFallbackUsed === true || approvalFallbackReasons.length > 0,
        fallbackReasons: [...new Set([...(freezePreview?.fallbackReasons || []), ...approvalFallbackReasons].filter(Boolean))],
        contractExtractionSource: freezePreview?.contractExtractionSource || (styleContract ? "provided" : "local_fallback"),
        freezeAdviceSource: freezePreview?.freezeAdviceSource || "local_fallback",
      }
      const styleEvolution = await approveStyleEvolutionSample(context.projectRoot, {
        version: Number.isFinite(version) ? version : undefined,
        sample,
        approvedAt,
        styleContract: (freezePreview?.styleContract as NonNullable<StyleEvolutionContract["styleContract"]> | undefined) || styleContract,
        antiPatterns: antiPatterns || freezePreview?.antiPatterns,
        frozenBasePrompt: typeof body.frozenBasePrompt === "string" ? body.frozenBasePrompt : (freezePreview?.frozenBasePrompt || undefined),
        freezeSummary: freezePreview?.freezeSummary,
        positiveExamples: freezePreview?.positiveExamples,
        inheritedRules: freezePreview?.inheritedRules,
        // 冻结预审在 approve 阶段仅作参考：候选已通过循环 ready 判定并被用户 accept，
        // 预审的 continue 不应再否决用户确认（否则启发式评分低于阈值时 approve 会永久卡死），
        // 回落到 undefined 让 approveStyleEvolutionSample 沿用候选自身的 ready 评审记录。
        freezer: freezePreview?.freezer?.verdict === "ready" ? freezePreview.freezer : undefined,
      })
      const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot)
      await recordToolMessage(rootDir, {
        projectId: context.projectId,
        conversationId: "workflow-control",
        toolName: "style-evolution.approve",
        status: "completed",
        input: { version: Number.isFinite(version) ? version : undefined },
        output: {
          version: styleEvolution.contract.approval?.approvedVersion || version,
          approvalStatus: styleEvolution.contract.approval?.status || "missing",
          gateStatus: styleEvolution.gate.status,
          canProceed: styleEvolution.gate.canProceed,
          contractExtractionSource: styleFreezeApproval.contractExtractionSource,
          freezeAdviceSource: styleFreezeApproval.freezeAdviceSource,
          llmFallbackUsed: styleFreezeApproval.llmFallbackUsed,
          fallbackReasons: styleFreezeApproval.fallbackReasons,
        },
        content: `Style contract approved and frozen at v${styleEvolution.contract.approval?.approvedVersion || version || "?"}.`,
        metadata: {
          source: "api_style_evolution_approve",
          artifactPath: ".ai-novel/style/evolution/user-approved-sample.md",
          artifactLabel: "User approved sample",
          artifactKind: "style-approved-sample",
          artifacts: styleEvolutionArtifactItems(styleEvolutionAssets, { includeApprovedSample: true }),
        },
      })
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets,
          freezePreview,
          styleFreezeApproval,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    } catch (error) {
      return {
        status: 400,
        payload: {
          error: error instanceof Error ? error.message : String(error),
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }
  }

  if (method === "POST" && requestPathname === "/api/style-evolution/accept") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const version = typeof body.version === "number"
      ? body.version
      : typeof body.version === "string" && body.version.trim()
        ? Number.parseInt(body.version, 10)
        : undefined
    try {
      const styleEvolution = await acceptStyleEvolutionCandidate(context.projectRoot, {
        version: Number.isFinite(version) ? version : undefined,
        acceptedAt: typeof body.acceptedAt === "string" ? body.acceptedAt : undefined,
      })
      const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot)
      await recordToolMessage(rootDir, {
        projectId: context.projectId,
        conversationId: "workflow-control",
        toolName: "style-evolution.accept",
        status: "completed",
        input: { version: Number.isFinite(version) ? version : undefined },
        output: {
          version: styleEvolution.contract.approval?.approvedVersion || version,
          approvalStatus: styleEvolution.contract.approval?.status || "missing",
          gateStatus: styleEvolution.gate.status,
          canProceed: styleEvolution.gate.canProceed,
        },
        content: `Style candidate v${version || "?"} accepted for freeze review.`,
        metadata: {
          source: "api_style_evolution_accept",
          artifactPath: ".ai-novel/style/evolution/style-freeze-ledger.json",
          artifactLabel: "Style freeze ledger",
          artifactKind: "style-freeze-ledger",
          artifacts: styleEvolutionArtifactItems(styleEvolutionAssets),
        },
      })
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    } catch (error) {
      return {
        status: 400,
        payload: {
          error: error instanceof Error ? error.message : String(error),
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }
  }

  if (method === "POST" && requestPathname === "/api/style-evolution/reject") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const version = typeof body.version === "number"
      ? body.version
      : typeof body.version === "string" && body.version.trim()
        ? Number.parseInt(body.version, 10)
        : undefined
    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : ""
    try {
      const styleEvolution = await rejectStyleEvolutionSample(context.projectRoot, {
        version: Number.isFinite(version) ? version : undefined,
        rejectionReason,
        rejectedAt: typeof body.rejectedAt === "string" ? body.rejectedAt : undefined,
      })
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets: await readStyleEvolutionAssetSnapshot(context.projectRoot),
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    } catch (error) {
      return {
        status: 400,
        payload: {
          error: error instanceof Error ? error.message : String(error),
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }
  }

  if (method === "GET" && requestPathname === "/api/reader-snapshot") {
    return buildReaderSnapshot(rootDir, options.projectId)
  }

  if (method === "GET" && requestPathname === "/api/reader-chapter") {
    return buildReaderChapterSnapshot(rootDir, options.projectId, requestUrl.searchParams.get("chapterNumber"))
  }

  if (method === "GET" && requestPathname === "/api/reader-chapter-versions/compare") {
    return buildReaderChapterVersionCompare(
      rootDir,
      options.projectId,
      requestUrl.searchParams.get("chapterNumber"),
      requestUrl.searchParams.get("leftVersionId"),
      requestUrl.searchParams.get("rightVersionId"),
    )
  }

  if (method === "GET" && requestPathname === "/api/reader-search") {
    return buildReaderSearchSnapshot(rootDir, options.projectId, requestUrl.searchParams.get("query"), requestUrl.searchParams.get("limit"))
  }

  if (method === "POST" && requestPathname === "/api/reader-chapter-version") {
    return updateReaderChapterVersion(rootDir, body, options.projectId)
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
    const chapterSnapshot = await buildReaderChapterSnapshot(rootDir, context.projectId, chapterNumber).catch(() => null)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        chapterNumber,
        path: relativePath,
        content,
        chapter: chapterSnapshot?.status === 200 ? chapterSnapshot.payload.chapter : null,
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

  if (method === "GET" && requestPathname === "/api/assets/image") {
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const assetPath = String(requestUrl.searchParams.get("path") || "").trim()
    if (!assetPath) {
      return { status: 400, payload: { error: "asset_path_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const asset = await readWorkspaceAssetDataUrl(context.projectRoot, assetPath)
    if (asset === null) {
      return {
        status: 400,
        payload: {
          error: "asset_path_not_allowed",
          path: assetPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }
    if (!asset.dataUrl) {
      return {
        status: 404,
        payload: {
          error: "asset_not_found",
          path: assetPath,
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
        ...asset,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/init") {
    const idea = String(body.idea || "").trim()
    const totalChapters = Number.parseInt(String(body.chapters || PRODUCTION_DEFAULT_TOTAL_CHAPTERS), 10)
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET), 10)

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

  if (method === "POST" && requestPathname === "/api/production/story-assets/repair") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const snapshotState = context.projectId
      ? await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId as string).state).catch(() => null)
      : null
    const fileState = await tryLoadState(context.projectRoot)
    const state = snapshotState ?? fileState
    if (!state) {
      return { status: 404, payload: { error: "workspace_not_initialized", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }

    const paths = getNovelWorkspacePaths(context.projectRoot)
    const storyContext = {
      consensus: await readWorkspaceText(context.projectRoot, "prompts", "global-consensus.md") || "",
      protagonist: await readWorkspaceText(context.projectRoot, "memory", "characters", "core", "protagonist.md"),
      style: await readWorkspaceText(context.projectRoot, "style", "profile.md"),
    }
    const existingMasterOutline = await readWorkspaceText(context.projectRoot, "plans", "master-outline.md")
    const masterProtagonist = extractVisibleMasterProtagonistNameForRepair(existingMasterOutline)
    const profileProtagonist = extractConcreteProtagonistNameForRepair(storyContext.protagonist)
    const repairedMasterOutlinePaths: string[] = []
    if (!masterProtagonist && profileProtagonist) {
      await writeProductionMasterOutline(context.projectRoot, paths, state, storyContext, {
        factoryRootDir: rootDir,
        projectId: context.projectId,
        preferDeterministicPlanning: true,
      })
      repairedMasterOutlinePaths.push(paths.masterOutlinePath)
    }
    const storyAssetPaths = await writeProductionStoryBibleAssets(context.projectRoot, paths, state, storyContext, {
      factoryRootDir: rootDir,
      projectId: context.projectId,
    })
    const blueprintPaths = await writeAllDetailedChapterBlueprints(context.projectRoot, paths, state, storyContext, {
      factoryRootDir: rootDir,
      projectId: context.projectId,
      preferDeterministicPlanning: true,
    })
    const written = [...repairedMasterOutlinePaths, ...storyAssetPaths, ...blueprintPaths]
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "故事基建与章节蓝图已补齐",
      content: "世界矩阵、主线架构、故事圣经、分卷策略、伏笔账本、人物关系资产和详细章节蓝图已重新生成。",
      metadata: {
        source: "api_story_assets_repair",
        written: written.map((item) => path.relative(context.projectRoot as string, item).replaceAll("\\", "/")),
      },
    })
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "story-assets-repair",
      status: "completed",
      input: { projectId: context.projectId },
      output: { writtenCount: written.length },
      content: `已生成 ${written.length} 个生产故事基建资产。`,
      metadata: { source: "api_story_assets_repair" },
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        repairedStoryAssets: written.map((item) => `.ai-novel/${path.relative(path.join(context.projectRoot as string, ".ai-novel"), item).replaceAll("\\", "/")}`),
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (
    method === "POST"
    && requestPathname === "/api/production/protagonist-profile/confirm"
  ) {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const snapshotState = context.projectId
      ? await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId as string).state).catch(() => null)
      : null
    const fileState = await tryLoadState(context.projectRoot)
    const state = snapshotState ?? fileState
    if (!state) {
      return { status: 404, payload: { error: "workspace_not_initialized", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }

    const { profile, missingFields } = buildConfirmedProtagonistProfile(body)
    if (missingFields.length) {
      return {
        status: 400,
        payload: {
          error: "protagonist_profile_incomplete",
          missingFields,
          requiredInput: "name, identity, coreDesire, fearOrWound, behaviorHabit, speechMarker, relationshipName, relationshipPressure",
          artifactPath: ".ai-novel/memory/characters/core/protagonist.md",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    const profileMarkdown = formatConfirmedProtagonistProfileMarkdown(profile)
    const profilePath = ".ai-novel/memory/characters/core/protagonist.md"
    await writeWorkspaceText(context.projectRoot, `${profileMarkdown}\n`, "memory", "characters", "core", "protagonist.md")

    state.runtime.statusMessage = `Protagonist profile confirmed for ${profile.name}. Master planning can now consume the locked profile.`
    await saveAutonomousState(context.projectRoot, state)
    if (context.mode === "managed" && context.projectId) {
      await syncManagedProjectState(rootDir, context.projectId, state).catch(() => undefined)
      await withFactoryDb(rootDir, async (db) => {
        db.recordArtifact({
          projectId: context.projectId as string,
          kind: "memory",
          path: profilePath,
          status: "completed",
          metadata: {
            production: true,
            stage: "protagonist_profile_confirmed",
            source: "api_protagonist_profile_confirm",
            protagonistName: profile.name,
            relationshipName: profile.relationshipName,
          },
        })
      }).catch(() => undefined)
    }
    await recordUserMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      content: [
        `请冻结主角资料：主角姓名是「${profile.name}」。`,
        `身份是「${profile.identity}」。`,
        `核心欲望是「${profile.coreDesire}」。`,
        `伤口/恐惧是「${profile.fearOrWound}」。`,
        `行为习惯是「${profile.behaviorHabit}」。`,
        `说话方式是「${profile.speechMarker}」。`,
        `与「${profile.relationshipName}」的关系压力是「${profile.relationshipPressure}」。`,
      ].join("\n"),
      metadata: {
        source: "api_protagonist_profile_confirm",
        artifactPath: profilePath,
      },
    })
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "主角资料已确认",
      content: `主角「${profile.name}」的身份、欲望、伤口、行为习惯、说话方式和具名关系压力已写入角色核心档案；主线规划可以继续消费这个锁定档案。`,
      metadata: {
        source: "api_protagonist_profile_confirm",
        artifactPath: profilePath,
        protagonistName: profile.name,
      },
    })
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "protagonist-profile.confirm",
      status: "completed",
      input: { projectId: context.projectId, protagonistName: profile.name },
      output: {
        protagonistName: profile.name,
        artifactPath: profilePath,
        relationshipName: profile.relationshipName,
      },
      content: "主角核心档案已写入生产记忆文件，并作为可预览 artifact 进入会话时间线。",
      metadata: {
        source: "api_protagonist_profile_confirm",
        artifactPath: profilePath,
        artifactKind: "character-profile",
        artifactLabel: "protagonist.md",
      },
    })

    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        protagonistProfile: {
          ...profile,
          path: profilePath,
        },
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (
    method === "POST"
    && (requestPathname === "/api/production/setting-review/approve" || requestPathname === "/api/production/setting-review/reject")
  ) {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const state = await tryLoadState(context.projectRoot)
    if (!state) {
      return { status: 404, payload: { error: "workspace_not_initialized", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const settingReviewText = await readWorkspaceText(context.projectRoot, "plans", SETTING_REVIEW_FILE)
    if (!settingReviewText.trim()) {
      return {
        status: 409,
        payload: {
          error: "setting_review_missing",
          message: "Setting review packet is missing. Run worldbuilding advance before approving or rejecting setting review.",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    const approved = requestPathname.endsWith("/approve")
    const note = typeof body.note === "string" ? body.note.trim() : undefined
    const reviewedBy = typeof body.reviewedBy === "string" ? body.reviewedBy.trim() : undefined
    const reason = typeof body.reason === "string" ? body.reason.trim() : undefined
    const approval = await writeSettingReviewApproval(context.projectRoot, {
      approved,
      reviewedBy,
      note,
      reason,
    })
    if (context.mode === "managed" && context.projectId) {
      await withFactoryDb(rootDir, async (db) => {
        db.recordArtifact({
          projectId: context.projectId as string,
          kind: "plan",
          path: `.ai-novel/plans/${SETTING_REVIEW_APPROVAL_FILE}`,
          status: "completed",
          metadata: {
            production: true,
            stage: "setting_review",
            reviewStatus: approval.status,
            approved: approval.approved,
            settingReviewPath: approval.settingReviewPath,
          },
        })
      }).catch(() => undefined)
    }
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: approved ? "设定评审已确认" : "设定评审已退回",
      content: approved
        ? "用户已确认当前设定评审包；后续主线规划可以把它作为已审阅的提案来源。"
        : "用户已退回当前设定评审包；继续规划前需要修正世界观、人物或主线假设。",
      metadata: {
        source: approved ? "api_setting_review_approve" : "api_setting_review_reject",
        approvalPath: `.ai-novel/plans/${SETTING_REVIEW_APPROVAL_FILE}`,
        settingReviewPath: `.ai-novel/plans/${SETTING_REVIEW_FILE}`,
        reviewedAt: approval.reviewedAt,
        reviewStatus: approval.status,
      },
    })
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: approved ? "setting-review.approve" : "setting-review.reject",
      status: "completed",
      input: { projectId: context.projectId, note, reason },
      output: {
        approvalPath: `.ai-novel/plans/${SETTING_REVIEW_APPROVAL_FILE}`,
        settingReviewPath: `.ai-novel/plans/${SETTING_REVIEW_FILE}`,
        reviewedAt: approval.reviewedAt,
        reviewStatus: approval.status,
      },
      content: approved
        ? "设定评审用户确认已写入生产审批文件。"
        : "设定评审退回原因已写入生产审批文件。",
      metadata: {
        source: approved ? "api_setting_review_approve" : "api_setting_review_reject",
        artifactPath: `.ai-novel/plans/${SETTING_REVIEW_APPROVAL_FILE}`,
        artifactKind: "setting-review-approval",
        artifactLabel: "setting-review-approval.json",
        artifacts: [
          {
            path: `.ai-novel/plans/${SETTING_REVIEW_APPROVAL_FILE}`,
            label: "setting-review-approval.json",
            kind: "setting-review-approval",
            status: "completed",
          },
          {
            path: `.ai-novel/plans/${SETTING_REVIEW_FILE}`,
            label: SETTING_REVIEW_FILE,
            kind: "setting-review",
            status: approval.status,
          },
        ],
      },
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        settingReviewApproval: approval,
        ...(await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true })),
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/production/story-foundation/approve") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }
    const snapshotState = context.projectId
      ? await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId as string).state).catch(() => null)
      : null
    const fileState = await tryLoadState(context.projectRoot)
    const state = snapshotState ?? fileState
    if (!state) {
      return { status: 404, payload: { error: "workspace_not_initialized", projects: context.projects, envStatus: getPublicProjectEnvStatus(rootDir) } }
    }

    const note = typeof body.note === "string" ? body.note.trim() : undefined
    const approvedBy = typeof body.approvedBy === "string" ? body.approvedBy.trim() : undefined
    const consensus = await readWorkspaceArtifactText(context.projectRoot, ".ai-novel/prompts/global-consensus.md") || ""
    const planningAssetDetails = await Promise.all([
      "world-matrix.md",
      "plot-architecture.md",
      "story-bible.md",
      "volume-strategy.md",
      "foreshadowing-ledger.md",
      "character-dynamics.md",
      "story-foundation-contract.json",
      "world-matrix.json",
      "plot-architecture.json",
      "story-bible.json",
      "volume-strategy.json",
      "foreshadowing-ledger.json",
      "character-dynamics.json",
      "writing-plan.json",
    ].map(async (required) => {
      const pathValue = `.ai-novel/plans/${required}`
      const present = Boolean((await readWorkspaceArtifactText(context.projectRoot, pathValue))?.trim())
      const issue = present && required.endsWith(".json")
        ? planningAssetStructuralIssue(required, await readWorkspaceArtifactJson(context.projectRoot, pathValue), Number(state?.plan?.totalChapters || 0))
        : ""
      return {
        key: required.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
        label: required,
        path: pathValue,
        status: present && !issue ? "passed" as const : "blocked" as const,
        detail: present ? issue || "已生成" : "缺失",
      }
    }))
    const storyFoundationContract = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/story-foundation-contract.json")
    const worldMatrix = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/world-matrix.json")
    const plotArchitecture = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/plot-architecture.json")
    const storyBible = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/story-bible.json")
    const volumeStrategy = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/volume-strategy.json")
    const foreshadowingLedger = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/foreshadowing-ledger.json")
    const characterDynamics = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/character-dynamics.json")
    const writingPlan = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/writing-plan.json")
    const storyFoundationFingerprintInput = buildStoryFoundationFingerprintInput({
      planningAssetDetails,
      storyFoundationContract,
      worldMatrix,
      plotArchitecture,
      storyBible,
      volumeStrategy,
      foreshadowingLedger,
      characterDynamics,
      writingPlan,
    })
    const storyFoundationAssetFingerprint = createStoryFoundationFingerprint(storyFoundationFingerprintInput)
    const approval = await writeStoryFoundationApproval(context.projectRoot, { note, approvedBy, assetFingerprint: storyFoundationAssetFingerprint })
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "故事基建已确认",
      content: "用户已确认世界观、主线、人物关系、伏笔账本和写作执行计划，可以作为正文生产前提。",
      metadata: {
        source: "api_story_foundation_approve",
        approvalPath: `.ai-novel/plans/${STORY_FOUNDATION_APPROVAL_FILE}`,
        approvedAt: approval.approvedAt,
      },
    })
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "story-foundation-approve",
      status: "completed",
      input: { projectId: context.projectId },
      output: { approvalPath: `.ai-novel/plans/${STORY_FOUNDATION_APPROVAL_FILE}`, approvedAt: approval.approvedAt },
      content: "故事基建用户确认已写入生产审批文件。",
      metadata: { source: "api_story_foundation_approve" },
    })
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        storyFoundationApproval: approval,
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

    // 1. 同步加载状态并设置其状态为 in_progress，以便前端立即渲染绘制中进度
    const state = await loadAutonomousState(context.projectRoot)
    state.assets = state.assets || {}
    state.assets.cover = state.assets.cover || {}
    state.assets.cover.status = "in_progress"
    delete state.assets.cover.error
    await saveAutonomousState(context.projectRoot, state)

    // 2. 异步（无阻塞）拉起真实的封面提示词与图片生成任务
    void (async () => {
      try {
        await prepareCoverGeneration(context.projectRoot as string, {
          factoryRootDir: rootDir,
          projectId: context.projectId,
          reason: "api:/api/cover",
        })
      } catch (err) {
        console.error("Async cover generation failed in background:", err)
      }
    })()

    // 3. 立即返回已经置为 in_progress 的最新状态负载，前端即可立即展现流光
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

    const reqBaseUrl = typeof body.LLM_BASE_URL === "string" ? body.LLM_BASE_URL : (typeof body.baseUrl === "string" ? body.baseUrl : undefined)
    let reqApiKey = typeof body.LLM_API_KEY === "string" ? body.LLM_API_KEY : (typeof body.apiKey === "string" ? body.apiKey : undefined)
    const reqModelName = typeof body.LLM_MODEL_ID === "string" ? body.LLM_MODEL_ID : (typeof body.modelName === "string" ? body.modelName : undefined)
    let reqApiMode = typeof body.LLM_API_MODE === "string" ? body.LLM_API_MODE : (typeof body.apiMode === "string" ? body.apiMode : undefined)
    const configId = typeof body.id === "string" ? body.id.trim() : null

    if (configId) {
      await withFactoryDb(rootDir, async (db) => {
        const currentConfig = db.listLlmConfigs().find((config) => config.id === configId)
        if (reqApiKey === "[configured]" && currentConfig && typeof currentConfig.api_key === "string") {
          reqApiKey = currentConfig.api_key
        }
        if (!reqApiMode && currentConfig && typeof currentConfig.api_mode === "string") {
          reqApiMode = currentConfig.api_mode
        }
      })
    }

    const result = await testProviderConnectivity(
      {
        baseUrl: reqBaseUrl,
        apiKey: reqApiKey,
        modelName: reqModelName,
        apiMode: reqApiMode ? normalizeLlmApiMode(reqApiMode) : undefined,
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

    if (route.type === "workflow_control") {
      const autopilotMessage = createAutopilotKickoffMessage(state)
      const jobId = context.projectId
        ? await ensureDurableAutopilotJob(rootDir, context.projectId, autopilotMessage, { source: "chat_stream_workflow_control" })
        : null
      const updatedState = await markAutopilot(context.projectRoot, {
        running: true,
        stopRequested: false,
        mode: "background",
        target: autopilotMessage,
        statusMessage: "已收到继续推进指令，已写入无人值守任务队列。",
      }, { factoryRootDir: rootDir, projectId: context.projectId })

      await recordStatusMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: runId,
        runId,
        title: "继续推进已接收",
        content: jobId
          ? `已将继续推进指令写入无人值守任务队列：${jobId}。`
          : "已收到继续推进指令。",
        metadata: { source: "api_chat_stream_workflow_control", jobId, route: route.type, reason: route.reason },
      })
      await recordToolMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: runId,
        runId,
        toolName: "autopilot-start",
        status: jobId ? "completed" : "failed",
        input: { message, routedMessage: autopilotMessage },
        output: { jobId, queued: Boolean(jobId) },
        content: jobId
          ? `无人值守任务 ${jobId} 已写入数据库，等待 worker 领取或续跑。`
          : "无人值守任务写入数据库失败，请检查项目状态。",
        metadata: { source: "api_chat_stream_workflow_control", jobId },
      })

      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          events: [],
          discussion: {
            summary: "已转入无人值守推进，不启动多 Agent 讨论。",
            target: "workflow_control",
            writebackSkipped: true,
            replies: [],
          },
          ...(await createWorkspacePayload(context.projectRoot, updatedState, { rootDir, projectId: context.projectId, syncState: true })),
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

  if (method === "GET" && requestPathname === "/api/settings/writing") {
    const settings = await withFactoryDb(rootDir, async (db) => {
      const bypassVal = db.getSystemSetting("bypassAigcGate")
      const autoVal = db.getSystemSetting("autoAigcRefinement")
      const draftSubcallRolesVal = db.getSystemSetting("draftSubcallRoles")
      return {
        bypassAigcGate: bypassVal === "1",
        autoAigcRefinement: autoVal === "1",
        draftSubcallRoles: parseDraftSubcallRolesSetting(draftSubcallRolesVal),
        aigcDetector: readAigcDetectorSettingsFromDb(db),
      }
    }).catch(() => ({
      bypassAigcGate: false,
      autoAigcRefinement: false,
      draftSubcallRoles: [],
      aigcDetector: {
        provider: "local-heuristic",
        url: "",
        tokenConfigured: false,
        timeoutMs: 30000,
        threshold: 0.8,
        requestTextField: "",
        headersJson: "",
        segmentMaxChars: 900,
        segmentMinChars: 180,
        gradioFnIndex: "",
        gradioSessionHashConfigured: false,
        gradioJoinUrl: "",
        gradioDataUrl: "",
        gradioSkipJoin: false,
        gradioInputsJson: "",
      },
    }))
    return {
      status: 200,
      payload: {
        settings,
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/settings/writing") {
    const settings = body.settings as Record<string, unknown> | undefined
    if (settings) {
      await withFactoryDb(rootDir, async (db) => {
        if (typeof settings.bypassAigcGate === "boolean") {
          db.setSystemSetting("bypassAigcGate", settings.bypassAigcGate ? "1" : "0")
        }
        if (typeof settings.autoAigcRefinement === "boolean") {
          db.setSystemSetting("autoAigcRefinement", settings.autoAigcRefinement ? "1" : "0")
        }
        if (Array.isArray(settings.draftSubcallRoles)) {
          db.setSystemSetting("draftSubcallRoles", normalizeDraftSubcallRoles(settings.draftSubcallRoles).join(","))
        }
        writeAigcDetectorSettingsToDb(db, settings)
      }).catch(() => undefined)
    }
    return {
      status: 200,
      payload: {
        success: true,
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/aigc/batch-scan") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required" } }
    }
    const state = await loadAutonomousState(context.projectRoot)
    const totalChapters = state.plan?.totalChapters || state.plan?.chapterTasks?.length || 0
    const results: Record<number, any> = {}

    const detectorConfig = getAigcDetectorConfig(context.projectRoot)
    const approvedStyleContext = await loadApprovedWritingStyleContext(context.projectRoot)

    for (let i = 1; i <= totalChapters; i++) {
      const chapterId = `chapter-${String(i).padStart(3, "0")}`
      const finalDraft = await readWorkspaceText(context.projectRoot, "chapters", `${chapterId}.final.md`)
      if (finalDraft.trim()) {
        try {
          const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0]
          const result = await detectAigcSegments(bodyOnly || finalDraft, detectorConfig)
          const report = normalizeAigcWritingDetectionReport(result)
          const styleConformanceDrift = evaluateChapterStyleConformanceDrift({
            approvedStyleContext,
            chapterText: finalDraft,
          })
          const blockedReason = report.status === "passed" && styleConformanceDrift.status === "conformant"
            ? ""
            : report.status !== "passed"
              ? `AIGC 检测未通过：${report.reason || report.status}`
              : `风格继承漂移未通过：${styleConformanceDrift.reason}`
          const manifestUpdate = await persistBatchRefineManifestUpdate({
            rootDir,
            projectRoot: context.projectRoot,
            projectId: context.projectId,
            chapterNumber: i,
            finalDraft,
            finalAigcReport: report,
            styleConformanceDrift,
            refined: false,
            blockedReason,
          })
          results[i] = {
            report,
            styleConformanceDrift,
            publishReadiness: manifestUpdate.publishReadiness || null,
            refined: false,
            blockedReason,
          }

          await withFactoryDb(rootDir, async (db) => {
            db.recordEvent(context.projectId as string, `aigc_batch_scan_ch_${i}`, "AIGC_DETECTION_COMPLETED", {
              chapterNumber: i,
              aigcReport: report,
              publishReadiness: manifestUpdate.publishReadiness || null,
            })
          }).catch(() => undefined)
        } catch (e) {
          results[i] = { status: "unavailable", reason: String(e) }
        }
      }
    }

    const styleWorkspace = await buildStyleEvolutionWorkspacePayloadSafe(rootDir, {
      projectRoot: context.projectRoot,
      projectId: context.projectId,
    }, await loadAutonomousState(context.projectRoot).catch(() => state))
    return {
      status: 200,
      payload: {
        success: true,
        activeProjectId: context.projectId,
        projects: context.projects,
        results,
        ...styleWorkspace,
        envStatus: getPublicProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && requestPathname === "/api/aigc/batch-refine") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required" } }
    }
	    const state = await loadAutonomousState(context.projectRoot)
	    const approvedStyleContext = await loadApprovedWritingStyleContext(context.projectRoot)
	    if (approvedStyleContext.status !== "ready") {
	      const styleWorkspace = await buildStyleEvolutionWorkspacePayloadSafe(rootDir, {
	        projectRoot: context.projectRoot,
	        projectId: context.projectId,
	      }, state)
	      return {
	        status: 409,
	        payload: {
	          success: false,
	          activeProjectId: context.projectId,
	          projects: context.projects,
	          error: "style_contract_not_ready",
	          reason: "AIGC 批量修正文稿前必须先冻结并通过 Generation Verification Gate 的写法合同。",
	          ...styleWorkspace,
	          envStatus: getPublicProjectEnvStatus(rootDir),
	        },
	      }
    }

    const targetChapter = typeof body.chapterNumber === "number" ? body.chapterNumber : null
    const chapterTasks = state.plan?.chapterTasks || []

    const results: Record<number, any> = {}
    const detectorConfig = getAigcDetectorConfig(context.projectRoot)
    const resources = await loadProductionWritingResources(context.projectRoot)

    const chaptersToRefine = targetChapter !== null
      ? chapterTasks.filter(t => t.chapterNumber === targetChapter)
      : chapterTasks;

    for (const task of chaptersToRefine) {
      const i = task.chapterNumber
      const chapterId = `chapter-${String(i).padStart(3, "0")}`
      let finalDraft = await readWorkspaceText(context.projectRoot, "chapters", `${chapterId}.final.md`)

      if (finalDraft.trim()) {
        try {
          const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0]
          const result = await detectAigcSegments(bodyOnly || finalDraft, detectorConfig)
          const aigcReport = normalizeAigcWritingDetectionReport(result)

          if (aigcReport.status === "blocked" && aigcReport.highRiskSegments.length > 0) {
            const refinedDraft = await repairAigcHighRiskDraft(
              state,
              task,
              finalDraft,
              aigcReport,
              resources,
              { envRootDir: context.projectRoot },
              createContinuityContract({ state, task }),
              state.memory?.characterDossiers || []
            )

            const finalBodyOnly = refinedDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0]
            const checkResult = await detectAigcSegments(finalBodyOnly || refinedDraft, detectorConfig)
            const finalAigcReport = normalizeAigcWritingDetectionReport(checkResult)
            const styleConformanceDrift = evaluateChapterStyleConformanceDrift({
              approvedStyleContext,
              chapterText: refinedDraft,
            })
            const refinedPassed = finalAigcReport.status === "passed" && styleConformanceDrift.status === "conformant"
            const blockedReason = finalAigcReport.status !== "passed"
              ? `AIGC 复检未通过：${finalAigcReport.reason || finalAigcReport.status}`
              : styleConformanceDrift.status !== "conformant"
                ? `风格继承漂移未通过：${styleConformanceDrift.reason}`
                : ""
            if (refinedPassed) {
              await writeWorkspaceText(context.projectRoot, refinedDraft, "chapters", `${chapterId}.final.md`)
            }
            let persistedAigcReport = finalAigcReport
            let persistedStyleConformanceDrift = styleConformanceDrift
            if (!refinedPassed) {
              const persistedBodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0]
              const persistedCheckResult = await detectAigcSegments(persistedBodyOnly || finalDraft, detectorConfig)
              persistedAigcReport = normalizeAigcWritingDetectionReport(persistedCheckResult)
              persistedStyleConformanceDrift = evaluateChapterStyleConformanceDrift({
                approvedStyleContext,
                chapterText: finalDraft,
              })
            }
            const manifestUpdate = await persistBatchRefineManifestUpdate({
              rootDir,
              projectRoot: context.projectRoot,
              projectId: context.projectId,
              chapterNumber: i,
              finalDraft: refinedPassed ? refinedDraft : finalDraft,
              finalAigcReport: persistedAigcReport,
              styleConformanceDrift: persistedStyleConformanceDrift,
              refined: refinedPassed,
              blockedReason,
            })

            results[i] = {
              originalReport: aigcReport,
              finalReport: finalAigcReport,
              persistedReport: persistedAigcReport,
              styleConformanceDrift,
              persistedStyleConformanceDrift,
              publishReadiness: manifestUpdate.publishReadiness || null,
              refined: refinedPassed,
              blockedReason,
            }

            await withFactoryDb(rootDir, async (db) => {
              db.recordEvent(context.projectId as string, `aigc_batch_refine_ch_${i}`, "AIGC_DETECTION_COMPLETED", {
                chapterNumber: i,
                aigcReport: finalAigcReport,
              })
            }).catch(() => undefined)
          } else {
            const styleConformanceDrift = evaluateChapterStyleConformanceDrift({
              approvedStyleContext,
              chapterText: finalDraft,
            })
            const manifestUpdate = await persistBatchRefineManifestUpdate({
              rootDir,
              projectRoot: context.projectRoot,
              projectId: context.projectId,
              chapterNumber: i,
              finalDraft,
              finalAigcReport: aigcReport,
              styleConformanceDrift,
              refined: false,
              blockedReason: aigcReport.status === "passed" && styleConformanceDrift.status === "conformant"
                ? ""
                : "No high risk segments found or detection not blocked, but publish readiness was refreshed.",
            })
            results[i] = {
              report: aigcReport,
              styleConformanceDrift,
              publishReadiness: manifestUpdate.publishReadiness || null,
              refined: false,
              reason: "No high risk segments found or detection not blocked."
            }
          }
        } catch (e) {
          results[i] = { error: String(e) }
        }
      }
	    }

	    const styleWorkspace = await buildStyleEvolutionWorkspacePayloadSafe(rootDir, {
	      projectRoot: context.projectRoot,
	      projectId: context.projectId,
	    }, await loadAutonomousState(context.projectRoot).catch(() => state))
	    return {
	      status: 200,
	      payload: {
	        success: true,
	        activeProjectId: context.projectId,
	        projects: context.projects,
	        results,
	        ...styleWorkspace,
	        envStatus: getPublicProjectEnvStatus(rootDir),
	      },
	    }
  }

  if (method === "POST" && requestPathname === "/api/aigc/mark-workflow-complete") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required" } }
    }
    const state = await loadAutonomousState(context.projectRoot)
    const completionReadiness = await validateWorkflowCompletionReadiness(
      rootDir,
      context.projectRoot,
      context.projectId,
      state,
    )
    if (!completionReadiness.ok) {
      return {
        status: 409,
        payload: {
          success: false,
          activeProjectId: context.projectId,
          projects: context.projects,
          error: completionReadiness.error,
          reason: completionReadiness.reason,
          productionReadiness: completionReadiness.productionReadiness,
          readerStats: completionReadiness.readerStats,
          blockedChapters: completionReadiness.blockedChapters,
          envStatus: getPublicProjectEnvStatus(rootDir),
        },
      }
    }

    state.runtime.stage = "complete"
    state.runtime.statusMessage = "All chapter drafts generated and AIGC batch refinement finalized."
    state.runtime.lastRoute = "workflow"
    state.runtime.lastAction = "workflow_complete"

    await saveAutonomousState(context.projectRoot, state)
    if (context.projectId) {
      await syncManagedProjectState(rootDir, context.projectId, state).catch(() => undefined)
    }

    return {
      status: 200,
      payload: {
        success: true,
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

    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "pragma": "no-cache",
      "expires": "0"
    })
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
        let lastDirtyCheckAt = ""
        const writeSnapshot = async (options: { force?: boolean } = {}) => {
          if (response.writableEnded || response.destroyed || !response.writable) return
          // 轻量脏标记探测：先查 projects.updated_at（走主键索引，<1ms），
          // 只有项目更新时间变了，才重算昂贵的完整 snapshot。
          // 这消除了"无活动时每 2s 仍全量重算 getSnapshot(3.9s)"的永久积压。
          if (!options.force) {
            const dirtyStamp = await withFactoryDb(rootDir, async (db) => {
              return db.getProjectDirtyStamp(context.projectId as string)
            }).catch(() => "")
            if (dirtyStamp && dirtyStamp === lastDirtyCheckAt) {
              if (!response.writableEnded && !response.destroyed && response.writable) {
                try {
                  response.write(`: snapshot unchanged ${new Date().toISOString()}\n\n`)
                } catch {}
              }
              return
            }
            lastDirtyCheckAt = dirtyStamp
          }
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
