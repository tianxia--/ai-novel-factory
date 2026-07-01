import fs from "node:fs/promises"
import path from "node:path"

import type { StyleEvolutionContract } from "./production-contracts"
import { evaluateStyleEvolutionGate } from "./production-contracts"
import type { AigcBatchDetectionResult } from "./aigc-detector"

const STYLE_EVOLUTION_DIR = ".ai-novel/style/evolution"
const STYLE_SAMPLES_DIR = ".ai-novel/style/evolution/samples"
const STYLE_SEED_PATH = ".ai-novel/style/evolution/style-seed.md"
const USER_STYLE_PROMPT_PATH = ".ai-novel/style/evolution/user-style-prompt.md"
const REFERENCE_TEXT_PATH = ".ai-novel/style/evolution/reference-text.md"
const EVOLUTION_HISTORY_PATH = ".ai-novel/style/evolution/style-evolution-history.json"
const STYLE_CONTRACT_PATH = ".ai-novel/style/evolution/style-contract.json"
const APPROVED_SAMPLE_PATH = ".ai-novel/style/evolution/user-approved-sample.md"
const STYLE_FREEZE_LEDGER_PATH = ".ai-novel/style/evolution/style-freeze-ledger.json"
const STYLE_LOOP_RUNTIME_PATH = ".ai-novel/style/evolution/style-loop-runtime.json"
const STYLE_LOOP_RUNS_PATH = ".ai-novel/style/evolution/style-loop-runs.jsonl"

export interface StyleEvolutionAssetPaths {
  dir: string
  samplesDir: string
  seedPrompt: string
  userStylePrompt: string
  referenceText: string
  history: string
  styleContract: string
  approvedSample: string
  freezeLedger: string
  loopRuntime: string
  loopRuns: string
}

export interface StyleLoopRuntimeIterationRecord {
  iteration: number
  version?: number
  startedAt: string
  completedAt?: string
  seedPrompt?: string
  prompt: string
  sampleExcerpt?: string
  evaluationSource?: "heuristic" | "llm_critic"
  refinementSource?: "heuristic" | "llm_critic"
  freezerSource?: "heuristic" | "llm_critic"
  llmFallbackUsed?: boolean
  fallbackReasons?: string[]
  verdict?: "retry" | "candidate" | "approve"
  overallScore?: number
  forbiddenHits?: string[]
  nextPrompt?: string
  contractAdjustments?: string[]
  stage?: "generated" | "evaluated" | "refined" | "persisted"
  candidateCount?: number
  candidateIndex?: number
  candidateScores?: Array<{
    candidateIndex: number
    overallScore?: number
    verdict?: "retry" | "candidate" | "approve"
    source?: "heuristic" | "llm_critic"
    verificationStatus?: "pending" | "passed" | "blocked" | "warning"
    aigcHighRiskCount?: number
    forbiddenHitCount?: number
    llmFallbackUsed?: boolean
  }>
  candidates?: Array<{
    candidateIndex: number
    persistedVersion?: number
    sample: string
    evaluation: StyleEvolutionEvaluation
    refinement: StyleEvolutionRefinement
    verification: StyleGenerationVerification
    freezer?: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]["freezer"]
    llmFallbackUsed?: boolean
    fallbackReasons?: string[]
  }>
  winningReason?: string
  verificationStatus?: "pending" | "passed" | "blocked" | "warning"
  verificationSummary?: string
  verificationReasons?: string[]
  freezerVerdict?: "block" | "continue" | "ready"
  freezerSummary?: string
  freezerBlockingReasons?: string[]
  aigcRiskScore?: number | null
  aigcThreshold?: number | null
  aigcHighRiskCount?: number
  forbiddenHitCount?: number
}

export interface StyleLoopRuntimeRecord {
  version: 1
  runId: string
  engine: "Style Evolution Engine"
  runtime: "Prompt Loop Runtime"
  gate: "Style Contract Freeze Gate"
  verificationGate: "Generation Verification Gate"
  status: "running" | "completed"
  startedAt: string
  completedAt?: string
  stopReason?: "max_iterations_reached" | "ready_for_approval" | "stable_candidate" | "style_candidates_all_blocked" | "manual_stop"
  requestedIterations: number
  completedIterations: number
  projectTitle?: string
  idea?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  iterationFeedback?: string
  finalVersion?: number
  finalLoopStatus?: NonNullable<StyleEvolutionContract["loop"]>["status"]
  finalConvergence?: NonNullable<StyleEvolutionContract["loop"]>["convergence"]
  iterations: StyleLoopRuntimeIterationRecord[]
}

export interface StyleFreezeLedgerEntry {
  version: number
  createdAt?: string
  samplePath?: string
  source?: "manual" | "loop"
  evaluationSource?: "heuristic" | "llm_critic"
  refinementSource?: "heuristic" | "llm_critic"
  verdict?: "retry" | "candidate" | "approve"
  overallScore?: number
  readyForApproval?: boolean
  stableCandidate?: boolean
  stableRounds?: number
  readyReasons?: string[]
  stabilityReasons?: string[]
  convergenceNote?: string
  contractTightening?: string[]
  rejectionReason?: string
  userDecision?: "pending" | "accepted_for_freeze" | "accepted" | "superseded"
  userDecisionAt?: string
  verificationStatus?: "pending" | "passed" | "blocked" | "warning"
  verificationSummary?: string
  verificationReasons?: string[]
  freezerVerdict?: "block" | "continue" | "ready"
  freezerSummary?: string
  freezerBlockingReasons?: string[]
  llmFallbackUsed?: boolean
  fallbackReasons?: string[]
  aigcRiskScore?: number | null
  aigcThreshold?: number | null
  aigcHighRiskCount?: number
  forbiddenHitCount?: number
}

export interface StyleFreezeLedger {
  version: 1
  generatedAt: string
  latestVersion: number
  stableVersion?: number
  readyVersion?: number
  approvalVersion?: number
  approvalStatus?: "pending" | "approved" | "rejected"
  freezeSummary?: string
  inheritedArtifacts?: string[]
  inheritedRules?: string[]
  convergence?: "unknown" | "exploring" | "improving" | "stable" | "ready"
  convergenceEvidence: string[]
  verificationGate: "Generation Verification Gate"
  verificationStatus?: "pending" | "passed" | "blocked" | "warning"
  verificationVersion?: number
  verificationSummary?: string
  verificationReasons?: string[]
  entries: StyleFreezeLedgerEntry[]
}

export interface StyleEvolutionSnapshot {
  paths: StyleEvolutionAssetPaths
  contract: StyleEvolutionContract
  gate: ReturnType<typeof evaluateStyleEvolutionGate>
  freezeLedger: StyleFreezeLedger
  loopRuntime: StyleLoopRuntimeRecord | null
}

export interface InitializeStyleEvolutionOptions {
  projectTitle?: string
  idea?: string
  seedPrompt?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  overwrite?: boolean
}

export interface StyleEvolutionCandidateInput {
  prompt: string
  sample: string
  review?: string
  createdAt?: string
  iterationFeedback?: string
  source?: "manual" | "loop"
  evaluation?: StyleEvolutionEvaluation
  refinement?: StyleEvolutionRefinement
  freezer?: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]["freezer"]
  llmFallbackUsed?: boolean
  fallbackReasons?: string[]
}

export interface StyleEvolutionCandidatePromptInput {
  projectTitle?: string
  idea?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  seedPrompt?: string
  priorSample?: string
  iterationFeedback?: string
}

export interface StyleEvolutionCandidatePrompt {
  system: string
  user: string
  prompt: string
}

export interface StyleEvolutionEvaluationScores {
  narrativeVoice: number
  sentenceRhythm: number
  dialogueTexture: number
  informationDensity: number
  emotionalTension: number
  readability: number
  requirementAlignment: number
  forbiddenPatternRisk: number
  overall: number
}

export interface StyleEvolutionEvaluation {
  source?: "heuristic" | "llm_critic"
  verdict: "retry" | "candidate" | "approve"
  summary: string
  scores: StyleEvolutionEvaluationScores
  aigc?: {
    enabled: boolean
    status: "passed" | "blocked" | "unavailable"
    provider?: string
    urlConfigured?: boolean
    diagnostics?: string[]
    score: number | null
    threshold: number | null
    highRiskCount: number
    reason: string
    highRiskPreviews: string[]
  }
  strengths: string[]
  deviations: string[]
  forbiddenHits: string[]
  nextFocus: string[]
}

export interface StyleEvolutionRefinement {
  source?: "heuristic" | "llm_critic"
  summary: string
  promptAdjustments: string[]
  contractAdjustments: string[]
  nextPrompt: string
}

export interface StyleGenerationVerification {
  gate: "Generation Verification Gate"
  status: "pending" | "passed" | "blocked" | "warning"
  summary: string
  reasons: string[]
  score: number | null
  threshold: number | null
  highRiskCount: number
  forbiddenHitCount: number
  highRiskPreviews: string[]
  version?: number
  checkedAt?: string
}

export interface StyleEvolutionEvaluationPromptInput {
  projectTitle?: string
  idea?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  prompt?: string
  sample: string
  priorSample?: string
  iterationFeedback?: string
}

export interface StyleEvolutionEvaluationPrompt {
  system: string
  user: string
}

export interface StyleEvolutionRefinementPromptInput extends StyleEvolutionEvaluationPromptInput {
  evaluation: StyleEvolutionEvaluation
}

export interface StyleEvolutionRefinementPrompt {
  system: string
  user: string
}

export interface ParsedStyleEvolutionCritique {
  evaluation: StyleEvolutionEvaluation
  refinement: StyleEvolutionRefinement
}

export interface ParsedStyleEvolutionEvaluation {
  evaluation: StyleEvolutionEvaluation
}

export interface ParsedStyleEvolutionRefinementOnly {
  refinement: StyleEvolutionRefinement
}

export interface ParsedStyleEvolutionFreezeAdvice {
  freezeVerdict: "block" | "continue" | "ready"
  freezeSummary: string
  blockingReasons: string[]
  contractAdjustments: string[]
  forbiddenPatterns: string[]
  positiveExamples: string[]
  inheritedRules: string[]
}

export interface StyleContractExtractionPromptInput {
  sample: string
  prompt?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
}

export interface StyleContractExtractionPrompt {
  system: string
  user: string
}

export interface StyleFreezeAdvicePromptInput {
  sample: string
  prompt?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  evaluation?: StyleEvolutionEvaluation
  refinement?: StyleEvolutionRefinement
}

export interface StyleFreezeAdvicePrompt {
  system: string
  user: string
}

export interface ApproveStyleEvolutionInput {
  version?: number
  sample?: string
  approvedAt?: string
  styleContract?: NonNullable<StyleEvolutionContract["styleContract"]>
  antiPatterns?: string[]
  frozenBasePrompt?: string
  freezeSummary?: string
  positiveExamples?: string[]
  inheritedRules?: string[]
  approvedBy?: "user" | "system"
  freezer?: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]["freezer"]
}

export interface AcceptStyleEvolutionCandidateInput {
  version?: number
  acceptedAt?: string
  acceptedBy?: "user" | "system"
}

export interface RejectStyleEvolutionInput {
  version?: number
  rejectedAt?: string
  rejectionReason: string
}

function styleGenerationVerificationFromEntry(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined,
) {
  if (!entry) return buildStyleGenerationVerification({})
  if (entry.verification) return entry.verification
  if (!entry.evaluation) return buildStyleGenerationVerification({
    version: entry.version,
    checkedAt: entry.createdAt,
  })
  return buildStyleGenerationVerification({
    evaluation: entry.evaluation as StyleEvolutionEvaluation | undefined,
    version: entry.version,
    checkedAt: entry.createdAt,
  })
}

function hasStructuredStyleEvaluation(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined,
) {
  return Boolean(entry?.evaluation || entry?.verification)
}

function isVerifiedStyleCandidate(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined,
) {
  if (!entry) return false
  if (!hasStructuredStyleEvaluation(entry)) return false
  return styleGenerationVerificationFromEntry(entry).status === "passed"
}

function normalizeStyleFreezerVerdict(value: unknown): "block" | "continue" | "ready" {
  if (value === "ready" || value === "approve" || value === "freeze") return "ready"
  if (value === "block" || value === "blocked" || value === "reject") return "block"
  return "continue"
}

function styleEntryFreezerGate(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined,
) {
  return entry?.freezer || null
}

function isStyleCandidateLoopReady(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number] | null | undefined,
  contract: StyleEvolutionContract,
) {
  if (!entry) return false
  const version = Number(entry.version || 0)
  const loop = contract.loop || {}
  const readyVersion = Number(loop.readyVersion || 0)
  const stableVersion = Number(loop.stableVersion || 0)
  const freezerVerdict = styleEntryFreezerGate(entry)?.verdict
  return Boolean(
    entry.readyForApproval
    || (readyVersion && readyVersion === version)
    || (stableVersion && stableVersion === version)
    || freezerVerdict === "ready",
  )
}

function buildReadyReasons(
  evaluation: StyleEvolutionEvaluation | undefined,
  retryPolicy: NonNullable<StyleEvolutionContract["retryPolicy"]>,
  totalRounds: number,
  freezer?: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]["freezer"],
) {
  const reasons: string[] = []
  const overall = Number(evaluation?.scores?.overall || 0)
  if (overall >= Number(retryPolicy.approvalScoreThreshold || 8.6)) {
    reasons.push(`综合评分达到 ${overall.toFixed(1)}。`)
  }
  if ((evaluation?.forbiddenHits?.length || 0) <= Math.max(0, Number(retryPolicy.maxForbiddenHitCount || 1))) {
    reasons.push("禁忌命中处于可冻结范围。")
  }
  if (totalRounds >= Math.max(1, Number(retryPolicy.approvalMinRounds || 2))) {
    reasons.push(`已完成至少 ${totalRounds} 轮有效迭代。`)
  }
  if (evaluation?.verdict === "approve") {
    reasons.push("评估器已判定当前样段可进入用户确认。")
  }
  const verification = buildStyleGenerationVerification({ evaluation })
  if (verification.status === "passed") {
    reasons.push("Generation Verification Gate 已通过。")
  }
  if (freezer?.verdict === "ready") {
    reasons.push("Style Contract Freezer 已判定可以进入整书写法确认。")
  }
  return reasons
}

const EXPLANATION_PATTERNS = [
  { pattern: /解释创作意图|创作意图|本章将|这一章/gu, label: "解释创作意图" },
  { pattern: /总结式|总而言之|归根结底|说到底|最终他明白/gu, label: "总结式升华" },
  { pattern: /未来会|事情很严重|命运齿轮|危险才刚开始/gu, label: "模板化悬念" },
  { pattern: /他知道|她知道|他明白|她明白|意味着/gu, label: "解释性判断过多" },
]

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10))
}

function averageSentenceLength(sample: string) {
  const segments = sample.split(/[。！？!?]/u).map((part) => part.trim()).filter(Boolean)
  if (!segments.length) return 0
  return segments.reduce((sum, segment) => sum + segment.length, 0) / segments.length
}

function extractStyleDirectionTokens(text: string) {
  const tokens = new Set<string>()
  for (const token of ["克制", "冷感", "白描", "热血", "悬疑", "压迫", "动作", "对白", "留白", "古风", "轻松", "幽默"]) {
    if (text.includes(token)) tokens.add(token)
  }
  return [...tokens]
}

function summarizeStrengths(sample: string, dialogueCount: number, sensoryCount: number) {
  const strengths: string[] = []
  if (dialogueCount > 0) strengths.push("样段里有明确对白压力，不是纯说明段。")
  if (sensoryCount >= 2) strengths.push("感官和物件细节足够，画面落点比较具体。")
  if (averageSentenceLength(sample) <= 24) strengths.push("句式偏短，节奏接近网文正文可读区间。")
  if (!strengths.length) strengths.push("样段至少保持了正文输出形态，没有退回解释或大纲口吻。")
  return strengths
}

function summarizeDeviations(
  sample: string,
  userStylePrompt: string,
  forbiddenHits: string[],
  dialogueCount: number,
  avgSentenceLength: number,
) {
  const deviations: string[] = []
  const requestedTokens = extractStyleDirectionTokens(userStylePrompt)
  if (requestedTokens.includes("对白") && dialogueCount === 0) {
    deviations.push("用户要求关注对白质感，但当前样段几乎没有对白。")
  }
  if (requestedTokens.includes("动作") && !/[抬推按握退停看折掀靠走站拢合抽]/u.test(sample)) {
    deviations.push("用户强调动作推进，但当前动作密度还不够。")
  }
  if (avgSentenceLength > 28) {
    deviations.push("句子偏长，解释段风险偏高，节奏还不够利落。")
  }
  if (forbiddenHits.length > 0) {
    deviations.push(`命中禁用风险：${forbiddenHits.join("、")}。`)
  }
  if (!deviations.length && requestedTokens.length === 0) {
    deviations.push("用户风格方向仍然比较抽象，后续可以继续收紧要求。")
  }
  return deviations
}

function summarizeNextFocus(
  deviations: string[],
  forbiddenHits: string[],
  iterationFeedback: string,
  aigc?: StyleEvolutionEvaluation["aigc"],
) {
  const nextFocus: string[] = []
  if (forbiddenHits.length > 0) {
    nextFocus.push("先清掉解释腔、总结腔和模板化悬念。")
  }
  if (aigc?.status === "blocked") {
    nextFocus.push("压低 AI 腔和模板腔，改用更具体的动作、物件、停顿与关系压力承载信息。")
  }
  if (deviations.some((item) => item.includes("对白"))) {
    nextFocus.push("缩短对白，让关系试探落在一句话和停顿里。")
  }
  if (deviations.some((item) => item.includes("动作密度"))) {
    nextFocus.push("增加动作和物件推动，而不是抽象心理说明。")
  }
  if (deviations.some((item) => item.includes("句子偏长"))) {
    nextFocus.push("压短句子，减少解释性中长句。")
  }
  if (iterationFeedback.trim()) {
    nextFocus.push(`优先吸收用户反馈：${iterationFeedback.trim()}`)
  }
  if (!nextFocus.length) {
    nextFocus.push("继续微调声音稳定度，准备进入可确认版本。")
  }
  return nextFocus
}

export function evaluateStyleEvolutionCandidate(input: {
  prompt: string
  sample: string
  userStylePrompt?: string
  iterationFeedback?: string
  aigc?: StyleEvolutionEvaluation["aigc"]
}): StyleEvolutionEvaluation {
  const sample = normalizeText(input.sample)
  const prompt = normalizeText(input.prompt)
  const userStylePrompt = normalizeText(input.userStylePrompt)
  const iterationFeedback = normalizeText(input.iterationFeedback)
  const avgLength = averageSentenceLength(sample)
  const dialogueCount = (sample.match(/[“"'「『]/gu) || []).length + (sample.match(/：/gu) || []).length
  const sensoryCount = (sample.match(/[雨灯门声风血冷热湿痛光影]/gu) || []).length
  const forbiddenHits = EXPLANATION_PATTERNS
    .filter((item) => item.pattern.test(sample))
    .map((item) => item.label)
  const requirementTokens = extractStyleDirectionTokens(`${prompt}\n${userStylePrompt}\n${iterationFeedback}`)
  const requirementMatches = requirementTokens.filter((token) => sample.includes(token)).length

  const narrativeVoice = clampScore(6.6 + Math.min(1.8, requirementMatches * 0.4) - forbiddenHits.length * 0.5)
  const sentenceRhythm = clampScore(avgLength > 28 ? 5.9 : avgLength > 22 ? 7.3 : 8.4)
  const dialogueTexture = clampScore(dialogueCount > 0 ? 7.8 : 5.6)
  const informationDensity = clampScore(sensoryCount >= 4 ? 8.1 : sensoryCount >= 2 ? 7.2 : 5.8)
  const emotionalTension = clampScore(/[停退缩压盯扣攥问没有没有接]/u.test(sample) ? 8.1 : 6.2)
  const readability = clampScore(sample.length >= 120 && sample.length <= 950 ? 8.2 : 6.4)
  const requirementAlignment = clampScore(6.2 + Math.min(2.4, requirementMatches * 0.6) - (iterationFeedback && !sample.includes(iterationFeedback.slice(0, 2)) ? 0.4 : 0))
  const forbiddenPatternRisk = clampScore(forbiddenHits.length === 0 ? 1.5 : Math.min(9.5, forbiddenHits.length * 2.2 + 2))
  const aigcPenalty = input.aigc?.status === "blocked"
    ? Math.min(1.6, 0.5 + (input.aigc.highRiskCount * 0.25) + (typeof input.aigc.score === "number" ? Math.max(0, input.aigc.score - 0.78) : 0))
    : 0
  const overall = clampScore(
    ((narrativeVoice + sentenceRhythm + dialogueTexture + informationDensity + emotionalTension + readability + requirementAlignment + (10 - forbiddenPatternRisk)) / 8) - aigcPenalty,
  )

  const strengths = summarizeStrengths(sample, dialogueCount, sensoryCount)
  const deviations = summarizeDeviations(sample, userStylePrompt, forbiddenHits, dialogueCount, avgLength)
  if (input.aigc?.status === "blocked") {
    deviations.push(`AIGC 检测提示当前样段仍有 ${input.aigc.highRiskCount} 个高风险片段，AI 腔/模板腔风险偏高。`)
  }
  const nextFocus = summarizeNextFocus(deviations, forbiddenHits, iterationFeedback, input.aigc)
  const verdict = forbiddenHits.length > 0 || input.aigc?.status === "blocked" || overall < 7.2
    ? "retry"
    : overall >= 8.6 && deviations.length <= 1
      ? "approve"
      : "candidate"

  return {
    source: "heuristic",
    verdict,
    summary: verdict === "approve"
      ? "样段已接近可冻结的全书统一写法合同，可以进入用户确认。"
      : verdict === "candidate"
        ? "样段已经有可用基底，但还需要一轮定向收紧。"
        : "样段仍需继续迭代，暂不适合作为全书统一写法合同。",
    scores: {
      narrativeVoice,
      sentenceRhythm,
      dialogueTexture,
      informationDensity,
      emotionalTension,
      readability,
      requirementAlignment,
      forbiddenPatternRisk,
      overall,
    },
    aigc: input.aigc,
    strengths,
    deviations,
    forbiddenHits,
    nextFocus,
  }
}

export function normalizeStyleAigcSignal(
  result: AigcBatchDetectionResult,
  diagnostics: {
    urlConfigured?: boolean
    error?: unknown
    context?: string
  } = {},
): NonNullable<StyleEvolutionEvaluation["aigc"]> {
  const threshold = typeof result.threshold === "number" ? result.threshold : null
  const highRiskPreviews = Array.isArray(result.highRiskSegments)
    ? result.highRiskSegments
      .slice(0, 3)
      .map((segment) => segment.segment.text.replace(/\s+/gu, " ").slice(0, 80))
      .filter(Boolean)
    : []
  const diagnosticLines = [
    `provider=${result.provider || "unknown"}`,
    typeof diagnostics.urlConfigured === "boolean" ? `urlConfigured=${diagnostics.urlConfigured ? "yes" : "no"}` : "",
    diagnostics.context ? `context=${diagnostics.context}` : "",
    diagnostics.error
      ? `error=${diagnostics.error instanceof Error ? diagnostics.error.message : String(diagnostics.error)}`
      : "",
  ].filter(Boolean)
  const reason = [
    String(result.reason || "").trim() || "AIGC detection completed.",
    diagnosticLines.length ? `Detector diagnostics: ${diagnosticLines.join(", ")}.` : "",
  ].filter(Boolean).join(" ")
  return {
    enabled: true,
    status: !result.ok
      ? "unavailable"
      : result.highRiskSegments.length > 0 || (typeof result.score === "number" && typeof threshold === "number" && result.score >= threshold)
        ? "blocked"
        : "passed",
    provider: result.provider,
    urlConfigured: diagnostics.urlConfigured,
    diagnostics: diagnosticLines,
    score: typeof result.score === "number" ? result.score : null,
    threshold,
    highRiskCount: Array.isArray(result.highRiskSegments) ? result.highRiskSegments.length : 0,
    reason,
    highRiskPreviews,
  }
}

export function buildStyleGenerationVerification(input: {
  evaluation?: StyleEvolutionEvaluation
  version?: number
  checkedAt?: string
}): StyleGenerationVerification {
  const evaluation = input.evaluation
  const forbiddenHitCount = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits.length : 0
  const aigc = evaluation?.aigc
  const reasons: string[] = []
  let status: StyleGenerationVerification["status"] = "pending"

  if (aigc?.enabled) {
    if (typeof aigc.score === "number") {
      reasons.push(`AIGC 概率 ${aigc.score.toFixed(3)}。`)
    }
    if (typeof aigc.threshold === "number") {
      reasons.push(`风险阈值 ${aigc.threshold.toFixed(3)}。`)
    }
  }
  if (forbiddenHitCount > 0) {
    reasons.push(`命中 ${forbiddenHitCount} 条禁忌模式。`)
  }
  if ((aigc?.highRiskCount || 0) > 0) {
    reasons.push(`AIGC 检测识别出 ${Number(aigc?.highRiskCount || 0)} 个高风险片段。`)
  }
  if (aigc?.reason) {
    reasons.push(aigc.reason)
  }

  if (aigc?.status === "blocked" || forbiddenHitCount > 0) {
    status = "blocked"
  } else if (aigc?.status === "passed" && forbiddenHitCount === 0) {
    status = "passed"
  } else if (aigc?.status === "unavailable") {
    status = "blocked"
  } else if (!aigc?.enabled) {
    status = "blocked"
  }

  const summary = status === "passed"
    ? "Generation Verification Gate 已通过，当前样段的 AIGC 风险与禁忌命中处于可放行范围。"
    : status === "blocked"
      ? "Generation Verification Gate 阻塞，当前样段仍存在 AIGC 风险或禁忌命中，不能直接冻结。"
      : "Generation Verification Gate 等待当前轮评估完成。"

  return {
    gate: "Generation Verification Gate",
    status,
    summary,
    reasons: [...new Set(reasons.filter(Boolean))],
    score: typeof aigc?.score === "number" ? aigc.score : null,
    threshold: typeof aigc?.threshold === "number" ? aigc.threshold : null,
    highRiskCount: Number(aigc?.highRiskCount || 0),
    forbiddenHitCount,
    highRiskPreviews: Array.isArray(aigc?.highRiskPreviews) ? aigc.highRiskPreviews.filter(Boolean) : [],
    version: input.version,
    checkedAt: input.checkedAt || new Date().toISOString(),
  }
}

export function buildStyleEvolutionRefinement(input: {
  prompt: string
  userStylePrompt?: string
  evaluation: StyleEvolutionEvaluation
  iterationFeedback?: string
}): StyleEvolutionRefinement {
  const prompt = normalizeText(input.prompt)
  const userStylePrompt = normalizeText(input.userStylePrompt)
  const iterationFeedback = normalizeText(input.iterationFeedback)
  const adjustments = input.evaluation.nextFocus.map((item) => item.replace(/。$/u, ""))
  const contractAdjustments = input.evaluation.deviations
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => item.replace(/。$/u, ""))
  const nextPrompt = [
    prompt,
    userStylePrompt ? `继续贴合用户风格要求：${userStylePrompt}` : "",
    iterationFeedback ? `必须吸收用户反馈：${iterationFeedback}` : "",
    ...adjustments.map((item) => `- ${item}`),
  ].filter(Boolean).join("\n")

  return {
    source: "heuristic",
    summary: input.evaluation.verdict === "approve"
      ? "保留当前声音，只做轻微收束，准备给用户确认。"
      : "下一轮 prompt 应重点修复偏差项，而不是整体推翻重来。",
    promptAdjustments: adjustments.length ? adjustments : ["保持已有声音，继续收紧稳定度。"],
    contractAdjustments: contractAdjustments.length ? contractAdjustments : ["写法合同可以开始固化 voice、节奏和禁用模式。"],
    nextPrompt,
  }
}

function defaultRetryPolicy(): NonNullable<StyleEvolutionContract["retryPolicy"]> {
  return {
    maxLoopIterations: 6,
    approvalScoreThreshold: 8.6,
    approvalMinRounds: 2,
    stabilityMinRounds: 2,
    stabilityScoreDeltaMax: 0.6,
    retryOnForbiddenHit: true,
    maxForbiddenHitCount: 1,
  }
}

function latestGenerationVerification(
  contract: StyleEvolutionContract,
  history: NonNullable<StyleEvolutionContract["evolutionHistory"]>,
) {
  const latest = [...history].reverse().find((entry) => entry.verification || entry.evaluation)
  if (latest?.verification) {
    return latest.verification
  }
  if (latest?.evaluation) {
    return buildStyleGenerationVerification({
      evaluation: latest.evaluation as StyleEvolutionEvaluation,
      version: latest.version,
      checkedAt: latest.createdAt,
    })
  }
  if (contract.verification) {
    return contract.verification
  }
  return null
}

function approvedGenerationVerification(
  contract: StyleEvolutionContract,
  history: NonNullable<StyleEvolutionContract["evolutionHistory"]>,
) {
  const approvedVersion = Number(contract.approval?.approvedVersion || contract.loop?.approvalVersion || 0)
  const approvedEntry = approvedVersion
    ? history.find((entry) => entry.version === approvedVersion)
    : null
  if (approvedEntry?.verification) {
    return approvedEntry.verification
  }
  if (approvedEntry?.evaluation) {
    return buildStyleGenerationVerification({
      evaluation: approvedEntry.evaluation as StyleEvolutionEvaluation,
      version: approvedEntry.version,
      checkedAt: approvedEntry.createdAt,
    })
  }
  if (contract.verification) {
    return contract.verification
  }
  return latestGenerationVerification(contract, history)
}

function activeContractGenerationVerification(
  contract: StyleEvolutionContract,
  history: NonNullable<StyleEvolutionContract["evolutionHistory"]>,
) {
  const approved = Boolean(
    contract.approvedAt
      || contract.approval?.status === "approved"
      || contract.approval?.approvedVersion
      || contract.loop?.status === "approved",
  )
  return approved
    ? approvedGenerationVerification(contract, history)
    : latestGenerationVerification(contract, history)
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

function buildStableReasons(input: {
  stableWindow: Array<NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]>
  retryPolicy: NonNullable<StyleEvolutionContract["retryPolicy"]>
}) {
  const reasons: string[] = []
  const window = input.stableWindow
  if (!window.length) return reasons
  const scores = window.map((entry) => Number(entry.evaluation?.scores?.overall || 0)).filter((score) => score > 0)
  if (scores.length >= 2) {
    const min = Math.min(...scores)
    const max = Math.max(...scores)
    const drift = roundScore(max - min)
    reasons.push(`最近 ${scores.length} 轮综合评分保持在 ${min.toFixed(1)}-${max.toFixed(1)}，漂移仅 ${drift.toFixed(1)}。`)
  }
  const forbiddenClear = window.every((entry) =>
    (entry.evaluation?.forbiddenHits?.length || 0) <= Math.max(0, Number(input.retryPolicy.maxForbiddenHitCount || 1))
  )
  if (forbiddenClear) {
    reasons.push("最近稳定窗口内禁忌命中持续受控。")
  }
  const verdictStable = window.every((entry) => {
    const verdict = entry.evaluation?.verdict
    return verdict === "candidate" || verdict === "approve"
  })
  if (verdictStable) {
    reasons.push("最近几轮已脱离 retry 区间，开始进入稳定可收束状态。")
  }
  const tighteningTotal = window.reduce((sum, entry) => sum + (entry.contractTightening?.length || 0), 0)
  if (tighteningTotal > 0) {
    reasons.push(`稳定窗口内累计新增 ${tighteningTotal} 条合同收紧建议。`)
  }
  return reasons
}

function computeReadyForApproval(input: {
  evaluation: StyleEvolutionEvaluation | undefined
  retryPolicy: NonNullable<StyleEvolutionContract["retryPolicy"]>
  totalRounds: number
  stable: boolean
  freezer?: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number]["freezer"]
}) {
  const overall = Number(input.evaluation?.scores?.overall || 0)
  const forbiddenHits = input.evaluation?.forbiddenHits?.length || 0
  const thresholdReached = overall >= Number(input.retryPolicy.approvalScoreThreshold || 8.6)
  const roundsReached = input.totalRounds >= Math.max(1, Number(input.retryPolicy.approvalMinRounds || 2))
  const forbiddenOk = forbiddenHits <= Math.max(0, Number(input.retryPolicy.maxForbiddenHitCount || 1))
  const verification = buildStyleGenerationVerification({ evaluation: input.evaluation })
  const verificationOk = verification.status === "passed"
  const freezerReady = input.freezer?.verdict ? input.freezer.verdict === "ready" : true
  const stableReady = input.stable && thresholdReached && roundsReached && forbiddenOk
  return verificationOk && freezerReady && (input.evaluation?.verdict === "approve"
    || stableReady
  )
}

function isOpenStyleEvolutionEntry(
  entry: NonNullable<StyleEvolutionContract["evolutionHistory"]>[number],
  rejectedVersion?: number,
) {
  if (entry.userDecision === "accepted") return false
  if (entry.userDecision === "superseded") return false
  if (rejectedVersion && entry.version === rejectedVersion) return false
  return true
}

function computeStableWindowState(input: {
  history: NonNullable<StyleEvolutionContract["evolutionHistory"]>
  retryPolicy: NonNullable<StyleEvolutionContract["retryPolicy"]>
  rejectedVersion?: number
}) {
  const stabilityMinRounds = Math.max(2, Number(input.retryPolicy.stabilityMinRounds || 2))
  const approvalThreshold = Number(input.retryPolicy.approvalScoreThreshold || 8.6)
  const stabilityScoreDeltaMax = Math.max(0, Number(input.retryPolicy.stabilityScoreDeltaMax || 0.6))
  const stableWindow = input.history.slice(-stabilityMinRounds)
  const stableWindowScores = stableWindow.map((entry) => Number(entry.evaluation?.scores?.overall || 0)).filter((score) => score > 0)
  const stableWindowVerdictOk = stableWindow.length >= stabilityMinRounds
    && stableWindow.every((entry) => {
      const verdict = entry.evaluation?.verdict
      return verdict === "candidate" || verdict === "approve"
    })
  const stableWindowDecisionOk = stableWindow.length >= stabilityMinRounds
    && stableWindow.every((entry) => isOpenStyleEvolutionEntry(entry, input.rejectedVersion))
  const stableWindowForbiddenOk = stableWindow.length >= stabilityMinRounds
    && stableWindow.every((entry) =>
      (entry.evaluation?.forbiddenHits?.length || 0) <= Math.max(0, Number(input.retryPolicy.maxForbiddenHitCount || 1))
    )
  const stableWindowVerificationOk = stableWindow.length >= stabilityMinRounds
    && stableWindow.every((entry) => {
      const verification = entry.verification || buildStyleGenerationVerification({
        evaluation: entry.evaluation as StyleEvolutionEvaluation | undefined,
        version: entry.version,
        checkedAt: entry.createdAt,
      })
      return verification.status === "passed"
    })
  const stableWindowThresholdOk = stableWindow.length >= stabilityMinRounds
    && stableWindow.every((entry) => Number(entry.evaluation?.scores?.overall || 0) >= approvalThreshold - 0.8)
  const stableWindowDrift = stableWindowScores.length >= 2
    ? roundScore(Math.max(...stableWindowScores) - Math.min(...stableWindowScores))
    : Number.NaN
  const stable = stableWindow.length >= stabilityMinRounds
    && stableWindowScores.length >= stabilityMinRounds
    && stableWindowVerdictOk
    && stableWindowDecisionOk
    && stableWindowForbiddenOk
    && stableWindowVerificationOk
    && stableWindowThresholdOk
    && stableWindowDrift <= stabilityScoreDeltaMax
  return {
    stable,
    stableWindow,
    stableWindowScores,
    stableWindowDrift,
  }
}

function deriveLoopState(contract: StyleEvolutionContract): NonNullable<StyleEvolutionContract["loop"]> {
  const history = Array.isArray(contract.evolutionHistory) ? contract.evolutionHistory : []
  const latest = history.at(-1)
  const retryPolicy = contract.retryPolicy || defaultRetryPolicy()
  const approvalThreshold = Number(retryPolicy.approvalScoreThreshold || 8.6)
  const verification = activeContractGenerationVerification(contract, history)
  const rejectedVersion = contract.approval?.status === "rejected" ? contract.approval.rejectedVersion : undefined
  const stableState = computeStableWindowState({ history, retryPolicy, rejectedVersion })
  const readyEntry = [...history]
    .reverse()
    .find((entry) => {
      const entryVerification = styleGenerationVerificationFromEntry(entry)
      return isOpenStyleEvolutionEntry(entry, rejectedVersion)
        && entryVerification.status === "passed"
        && (!styleEntryFreezerGate(entry)?.verdict || styleEntryFreezerGate(entry)?.verdict === "ready")
        && (entry.readyForApproval || entry.evaluation?.verdict === "approve")
    })
  const recent = history.slice(-Math.max(2, Number(retryPolicy.stabilityMinRounds || 2)))
  const convergenceEvidence: string[] = []
  const tighteningCount = history.reduce((sum, entry) => sum + (entry.contractTightening?.length || 0), 0)
  const stableEntry = stableState.stable ? stableState.stableWindow.at(-1) : undefined
  const stabilityReasons = stableState.stable ? buildStableReasons({ stableWindow: stableState.stableWindow, retryPolicy }) : []
  if (recent.length >= 2) {
    const previous = Number(recent[0]?.evaluation?.scores?.overall || 0)
    const current = Number(recent.at(-1)?.evaluation?.scores?.overall || 0)
    if (current >= previous && current > 0) {
      convergenceEvidence.push(`最近两轮综合评分从 ${previous.toFixed(1)} 提升到 ${current.toFixed(1)}。`)
    }
    if ((recent.at(-1)?.contractTightening?.length || 0) > 0) {
      convergenceEvidence.push(`最近一轮新增 ${recent.at(-1)?.contractTightening?.length || 0} 条合同收紧建议。`)
    }
  }
  if (stableState.stable && stabilityReasons.length) {
    convergenceEvidence.push(...stabilityReasons)
  }
  if (readyEntry?.readyReasons?.length) {
    convergenceEvidence.push(...readyEntry.readyReasons)
  }
  const dedupedConvergenceEvidence = [...new Set(convergenceEvidence.filter(Boolean))]
  const readyVersion = readyEntry?.version
  const stableVersion = stableEntry?.version
  const approvalVersion = contract.approval?.approvedVersion
    || contract.loop?.approvalVersion
    || history.find((entry) => entry.sample === contract.approvedSample)?.version
  const approved = Boolean((contract.approval?.status === "approved" || contract.approvedAt) && contract.approvedSample?.trim())
  const latestRejected = Boolean(
    contract.approval?.status === "rejected"
    && contract.approval?.rejectionReason
    && contract.approval?.rejectedVersion === latest?.version,
  )
  const latestRejectionReason = latestRejected ? contract.approval?.rejectionReason : ""
  return {
    status: approved
      ? "approved"
      : readyEntry && readyEntry.version === latest?.version
        ? "ready_for_approval"
        : stableState.stable
          ? "stable_candidate"
        : history.length > 0
          ? "awaiting_user"
          : "idle",
    convergence: approved
      ? "ready"
      : readyEntry && readyEntry.version === latest?.version
        ? "ready"
        : stableState.stable
          ? "stable"
        : history.length >= 2
          ? "improving"
          : history.length === 1
            ? "exploring"
            : "unknown",
    currentIteration: history.length,
    latestVersion: latest?.version || 0,
    stableVersion,
    readyVersion,
    approvalVersion,
    autoIterations: history.filter((entry) => entry.source !== "manual").length,
    stableRounds: stableState.stable ? stableState.stableWindow.length : 0,
    stabilityScore: stableState.stable && stableState.stableWindowScores.length ? roundScore(stableState.stableWindowScores.reduce((sum, score) => sum + score, 0) / stableState.stableWindowScores.length) : 0,
    tighteningCount,
    lastRunAt: latest?.createdAt || contract.approvedAt,
    lastVerdict: approved ? "approve" : latest?.evaluation?.verdict,
    stableSummary: stableState.stable
      ? `v${stableEntry?.version || latest?.version || 0} 前已形成稳定写法窗口，可继续冻结确认。`
      : "",
    readySummary: readyEntry?.evaluation?.summary || readyEntry?.review,
    stabilityReasons,
    readyReasons: readyEntry?.readyReasons || [],
    convergenceEvidence: dedupedConvergenceEvidence,
    verificationStatus: verification?.status || "pending",
    verificationVersion: verification?.version,
    verificationSummary: verification?.summary || "",
    verificationReasons: verification?.reasons || [],
    latestSummary: approved
      ? "用户已确认并冻结本书基础写法。"
      : latestRejected
        ? `用户退回当前候选：${latestRejectionReason}`
      : latest?.evaluation?.summary || "尚未进入写法循环。",
  }
}

function buildStyleFreezeLedger(contract: StyleEvolutionContract): StyleFreezeLedger {
  const history = Array.isArray(contract.evolutionHistory) ? contract.evolutionHistory : []
  const verification = activeContractGenerationVerification(contract, history)
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    latestVersion: Number(contract.loop?.latestVersion || history.at(-1)?.version || 0),
    stableVersion: Number(contract.loop?.stableVersion || 0) || undefined,
    readyVersion: Number(contract.loop?.readyVersion || 0) || undefined,
    approvalVersion: Number(contract.loop?.approvalVersion || contract.approval?.approvedVersion || 0) || undefined,
    approvalStatus: contract.approval?.status || "pending",
    freezeSummary: contract.approval?.freezeSummary,
    inheritedArtifacts: contract.inheritance?.inheritedArtifacts || [],
    inheritedRules: contract.inheritance?.inheritedRules || [],
    convergence: contract.loop?.convergence || "unknown",
    convergenceEvidence: contract.loop?.convergenceEvidence || [],
    verificationGate: "Generation Verification Gate",
    verificationStatus: verification?.status || "pending",
    verificationVersion: verification?.version,
    verificationSummary: verification?.summary || "",
    verificationReasons: verification?.reasons || [],
    entries: history.map((entry) => ({
      version: entry.version,
      createdAt: entry.createdAt,
      samplePath: entry.samplePath,
      source: entry.source,
      evaluationSource: entry.evaluation?.source,
      refinementSource: entry.refinement?.source,
      verdict: entry.evaluation?.verdict,
      overallScore: Number(entry.evaluation?.scores?.overall || 0) || undefined,
      readyForApproval: entry.readyForApproval,
      stableCandidate: Number(contract.loop?.stableVersion || 0) === entry.version,
      stableRounds: Number(contract.loop?.stableVersion || 0) === entry.version ? Number(contract.loop?.stableRounds || 0) : 0,
      readyReasons: entry.readyReasons || [],
      stabilityReasons: Number(contract.loop?.stableVersion || 0) === entry.version ? contract.loop?.stabilityReasons || [] : [],
      convergenceNote: entry.convergenceNote,
      contractTightening: entry.contractTightening || [],
      rejectionReason: entry.rejectionReason,
      userDecision: entry.userDecision,
      userDecisionAt: entry.userDecisionAt,
      verificationStatus: entry.verification?.status || "pending",
      verificationSummary: entry.verification?.summary || "",
      verificationReasons: entry.verification?.reasons || [],
      freezerVerdict: entry.freezer?.verdict,
      freezerSummary: entry.freezer?.summary || "",
      freezerBlockingReasons: entry.freezer?.blockingReasons || [],
      llmFallbackUsed: entry.llmFallbackUsed === true || entry.evaluation?.source === "heuristic" || entry.refinement?.source === "heuristic" || entry.freezer?.source === "heuristic",
      fallbackReasons: entry.fallbackReasons || [],
      aigcRiskScore: entry.verification?.score ?? null,
      aigcThreshold: entry.verification?.threshold ?? null,
      aigcHighRiskCount: Number(entry.verification?.highRiskCount || 0),
      forbiddenHitCount: Number(entry.verification?.forbiddenHitCount || 0),
    })),
  }
}

function loopProtocolEvidenceItem(input: {
  key: string
  label: string
  ok: boolean
  pendingSummary: string
  passedSummary: string
  evidence: string[]
  requiredForFreeze?: boolean
}) {
  return {
    key: input.key,
    label: input.label,
    status: input.ok ? "passed" as const : "blocked" as const,
    summary: input.ok ? input.passedSummary : input.pendingSummary,
    evidence: input.evidence.filter(Boolean),
    requiredForFreeze: input.requiredForFreeze !== false,
  }
}

function deriveStyleLoopProtocol(contract: StyleEvolutionContract): NonNullable<StyleEvolutionContract["loopProtocol"]> {
  const history = Array.isArray(contract.evolutionHistory) ? contract.evolutionHistory : []
  const latest = history.at(-1)
  const approved = Boolean(contract.approvedAt && contract.approval?.status === "approved" && contract.approval.acceptedAsBookStyle === true)
  const verification = contract.verification || activeContractGenerationVerification(contract, history)
  const freezerReady = contract.freezer?.verdict === "ready"
  const inheritanceReady = contract.inheritance?.status === "enforced"
  const styleReady = Boolean(contract.styleContract && contract.frozenBasePrompt?.trim())
  const requiredStages = [
    "seed_prompt_builder",
    "candidate_generator",
    "evaluator_critic",
    "prompt_refiner",
    "loop_controller",
    "generation_verification",
    "user_approval_gate",
    "style_contract_freezer",
    "chapter_inheritance_adapter",
  ]
  const evidence = [
    loopProtocolEvidenceItem({
      key: "seed_prompt_builder",
      label: "Seed Prompt Builder",
      ok: Boolean(contract.seedPrompt?.trim()),
      pendingSummary: "缺少初始 seed prompt。",
      passedSummary: "已生成初始种子 prompt。",
      evidence: [
        contract.userStylePrompt ? "user style prompt captured" : "",
        contract.referenceWorks?.length ? `reference works: ${contract.referenceWorks.length}` : "",
        contract.desiredVibes?.length ? `desired vibes: ${contract.desiredVibes.length}` : "",
        contract.seedForbiddenPatterns?.length ? `seed forbidden patterns: ${contract.seedForbiddenPatterns.length}` : "",
      ],
    }),
    loopProtocolEvidenceItem({
      key: "candidate_generator",
      label: "Candidate Generator",
      ok: history.length > 0,
      pendingSummary: "尚未生成可评估正文样段。",
      passedSummary: `已生成 ${history.length} 个候选样段。`,
      evidence: [
        latest?.version ? `latest version: v${latest.version}` : "",
        latest?.source ? `latest source: ${latest.source}` : "",
      ],
    }),
    loopProtocolEvidenceItem({
      key: "evaluator_critic",
      label: "Evaluator / Critic",
      ok: history.some((entry) => Boolean(entry.evaluation?.scores?.overall)),
      pendingSummary: "候选样段缺少多维评估。",
      passedSummary: "候选样段已完成多维评估。",
      evidence: [
        latest?.evaluation?.source ? `source: ${latest.evaluation.source}` : "",
        typeof latest?.evaluation?.scores?.overall === "number" ? `overall: ${latest.evaluation.scores.overall}` : "",
        latest?.evaluation?.verdict ? `verdict: ${latest.evaluation.verdict}` : "",
      ],
    }),
    loopProtocolEvidenceItem({
      key: "prompt_refiner",
      label: "Prompt Refiner",
      ok: history.some((entry) => Boolean(entry.refinement?.nextPrompt || entry.refinement?.promptAdjustments?.length || entry.contractTightening?.length)),
      pendingSummary: "尚未沉淀 prompt 修订建议。",
      passedSummary: "已沉淀下一轮 prompt 与合同收紧建议。",
      evidence: [
        latest?.refinement?.source ? `source: ${latest.refinement.source}` : "",
        latest?.refinement?.promptAdjustments?.length ? `prompt adjustments: ${latest.refinement.promptAdjustments.length}` : "",
        latest?.contractTightening?.length ? `contract tightening: ${latest.contractTightening.length}` : "",
      ],
    }),
    loopProtocolEvidenceItem({
      key: "loop_controller",
      label: "Loop Controller",
      ok: Boolean(contract.loop?.status && contract.loop.status !== "idle"),
      pendingSummary: "Loop Controller 尚未形成收敛状态。",
      passedSummary: `Loop Controller 状态：${contract.loop?.status || "unknown"}。`,
      evidence: [
        contract.loop?.convergence ? `convergence: ${contract.loop.convergence}` : "",
        contract.loop?.currentIteration ? `iterations: ${contract.loop.currentIteration}` : "",
        contract.loop?.readyVersion ? `ready version: v${contract.loop.readyVersion}` : "",
      ],
    }),
    loopProtocolEvidenceItem({
      key: "generation_verification",
      label: "AIGC / Generation Verification",
      ok: verification?.status === "passed",
      pendingSummary: "Generation Verification Gate 尚未通过。",
      passedSummary: "Generation Verification Gate 已通过。",
      evidence: [
        verification?.status ? `status: ${verification.status}` : "",
        typeof verification?.score === "number" ? `score: ${verification.score}` : "",
        typeof verification?.threshold === "number" ? `threshold: ${verification.threshold}` : "",
        verification?.highRiskCount ? `high risk count: ${verification.highRiskCount}` : "",
      ],
    }),
    loopProtocolEvidenceItem({
      key: "user_approval_gate",
      label: "User Approval Gate",
      ok: approved,
      pendingSummary: "用户尚未确认该写法作为整本书基础写法。",
      passedSummary: "用户已确认该写法适用于整本书。",
      evidence: [
        contract.approval?.approvedVersion ? `approved version: v${contract.approval.approvedVersion}` : "",
        contract.approval?.approvedAt || contract.approvedAt ? `approved at: ${contract.approval?.approvedAt || contract.approvedAt}` : "",
        contract.approval?.acceptedAsBookStyle === true ? "accepted as whole-book style" : "",
      ],
    }),
    loopProtocolEvidenceItem({
      key: "style_contract_freezer",
      label: "Style Contract Freezer",
      ok: freezerReady && styleReady,
      pendingSummary: "Freezer 尚未 ready 或冻结资产不完整。",
      passedSummary: "Style Contract Freezer 已 ready，冻结资产完整。",
      evidence: [
        contract.freezer?.verdict ? `freezer verdict: ${contract.freezer.verdict}` : "",
        contract.frozenBasePrompt?.trim() ? "base writing prompt frozen" : "",
        contract.styleContract ? "style contract frozen" : "",
        contract.styleContract?.forbiddenPatterns?.length ? `forbidden patterns: ${contract.styleContract.forbiddenPatterns.length}` : "",
        contract.styleContract?.positiveExamples?.length ? `positive examples: ${contract.styleContract.positiveExamples.length}` : "",
      ],
    }),
    loopProtocolEvidenceItem({
      key: "chapter_inheritance_adapter",
      label: "Chapter Inheritance Adapter",
      ok: inheritanceReady && freezerReady && verification?.status === "passed",
      pendingSummary: "章节继承适配器尚未 ready。",
      passedSummary: "章节继承适配器已绑定冻结合同、Freezer 和验证证据。",
      evidence: [
        contract.inheritance?.status ? `inheritance: ${contract.inheritance.status}` : "",
        contract.inheritance?.inheritedArtifacts?.length ? `inherited artifacts: ${contract.inheritance.inheritedArtifacts.length}` : "",
        contract.inheritance?.inheritedRules?.length ? `inherited rules: ${contract.inheritance.inheritedRules.length}` : "",
      ],
    }),
  ]
  const completedStages = evidence
    .filter((item) => item.status === "passed")
    .map((item) => item.key)
  const blockedStages = evidence
    .filter((item) => item.status === "blocked")
    .map((item) => item.key)
  return {
    status: approved && blockedStages.length === 0
      ? "approved"
      : blockedStages.includes("generation_verification") || blockedStages.includes("style_contract_freezer")
        ? "blocked"
        : history.length > 0
          ? "running"
          : "pending",
    requiredStages,
    completedStages,
    blockedStages,
    evidence,
  }
}

async function persistStyleFreezeLedger(projectRoot: string, contract: StyleEvolutionContract) {
  const paths = absolutePaths(projectRoot)
  await fs.mkdir(path.dirname(paths.freezeLedger), { recursive: true })
  const ledger = buildStyleFreezeLedger(contract)
  await fs.writeFile(paths.freezeLedger, `${JSON.stringify(ledger, null, 2)}\n`)
  return ledger
}

function formatApprovedStyleRulebook(contract: StyleEvolutionContract): string {
  const style = contract.styleContract
  if (!contract.approvedAt || !style) {
    return ""
  }
  const dialogueRules = style.dialogueRules || []
  const descriptionRules = style.descriptionRules || []
  const emotionRules = style.emotionRules || []
  const pacingRules = style.pacingRules || []
  const povRules = style.povRules || []
  const openingRules = style.openingRules || []
  const endingHookRules = style.endingHookRules || []
  return [
    "# Style Rulebook",
    "",
    "This asset is frozen from the approved Style Evolution contract and must be inherited by every chapter draft, review, and polish pass.",
    "",
    `Approved at: ${contract.approvedAt}`,
    contract.approval?.approvedVersion ? `Approved version: v${contract.approval.approvedVersion}` : "",
    contract.approval?.freezeSummary ? `Freeze summary: ${contract.approval.freezeSummary}` : "",
    contract.verification?.summary ? `Verification summary: ${contract.verification.summary}` : "",
    contract.verification?.status ? `Verification status: ${contract.verification.status}` : "",
    typeof contract.verification?.score === "number" ? `AIGC verification score: ${contract.verification.score.toFixed(3)}` : "",
    typeof contract.verification?.threshold === "number" ? `AIGC verification threshold: ${contract.verification.threshold.toFixed(3)}` : "",
    contract.verification?.highRiskCount ? `High risk segments before freeze: ${contract.verification.highRiskCount}` : "",
    "",
    "## Voice",
    style.voice || "- pending",
    "",
    "## Sentence Rhythm",
    style.sentenceRhythm || "- pending",
    "",
    "## Dialogue Rules",
    ...(dialogueRules.length ? dialogueRules.map((rule) => `- ${rule}`) : ["- pending"]),
    "",
    "## Description Rules",
    ...(descriptionRules.length ? descriptionRules.map((rule) => `- ${rule}`) : ["- pending"]),
    "",
    "## Emotion Rules",
    ...(emotionRules.length ? emotionRules.map((rule) => `- ${rule}`) : ["- pending"]),
    "",
    "## Pacing Rules",
    ...(pacingRules.length ? pacingRules.map((rule) => `- ${rule}`) : ["- pending"]),
    "",
    "## POV Rules",
    ...(povRules.length ? povRules.map((rule) => `- ${rule}`) : ["- pending"]),
    "",
    "## Opening Rules",
    ...(openingRules.length ? openingRules.map((rule) => `- ${rule}`) : ["- pending"]),
    "",
    "## Ending Hook Rules",
    ...(endingHookRules.length ? endingHookRules.map((rule) => `- ${rule}`) : ["- pending"]),
    "",
    "## Retry Policy",
    `- Approval threshold: ${Number(contract.retryPolicy?.approvalScoreThreshold || 8.6).toFixed(1)}`,
    `- Approval min rounds: ${Math.max(1, Number(contract.retryPolicy?.approvalMinRounds || 2))}`,
    `- Stability min rounds: ${Math.max(1, Number(contract.retryPolicy?.stabilityMinRounds || 2))}`,
    `- Max forbidden hits: ${Math.max(0, Number(contract.retryPolicy?.maxForbiddenHitCount || 1))}`,
  ].filter(Boolean).join("\n")
}

function formatApprovedStyleReferences(contract: StyleEvolutionContract): string {
  const style = contract.styleContract
  if (!contract.approvedAt || !style) {
    return ""
  }
  const positiveExamples = style.positiveExamples || []
  const allowedDevices = style.allowedDevices || []
  return [
    "# Style References",
    "",
    "These are the positive references frozen from the approved style loop. They are not to be copied mechanically, but they define the acceptable writing band for the whole book.",
    "",
    "## Positive Examples",
    ...(positiveExamples.length ? positiveExamples.map((example) => `- ${example}`) : ["- pending"]),
    "",
    "## Allowed Devices",
    ...(allowedDevices.length ? allowedDevices.map((item) => `- ${item}`) : ["- pending"]),
    "",
    "## Approved Sample Excerpt",
    contract.approvedSample?.trim() || "- pending",
  ].join("\n")
}

function formatApprovedStyleAntiPatterns(contract: StyleEvolutionContract): string {
  const style = contract.styleContract
  if (!contract.approvedAt || !style) {
    return ""
  }
  const forbiddenPatterns = [...new Set([...(style.forbiddenPatterns || []), ...(contract.antiPatterns || [])])]
  const negativeExamples = style.negativeExamples || []
  const inheritedRules = contract.inheritance?.inheritedRules || []
  return [
    "# Style Anti-Patterns",
    "",
    "These patterns are frozen as disallowed or high-risk writing moves for subsequent chapter production.",
    "",
    "## Forbidden Patterns",
    ...(forbiddenPatterns.length ? forbiddenPatterns.map((item) => `- ${item}`) : ["- pending"]),
    "",
    "## Negative Examples",
    ...(negativeExamples.length ? negativeExamples.map((item) => `- ${item}`) : ["- pending"]),
    "",
    "## Inheritance Rules",
    ...(inheritedRules.length ? inheritedRules.map((rule) => `- ${rule}`) : ["- pending"]),
  ].join("\n")
}

export async function materializeApprovedStyleAssets(projectRoot: string, contract: StyleEvolutionContract) {
  if (!contract?.approvedAt || !contract.styleContract) {
    return
  }
  const styleDir = path.join(projectRoot, ".ai-novel", "style")
  await fs.mkdir(styleDir, { recursive: true })
  const writes: Array<[string, string]> = [
    [path.join(styleDir, "rulebook.md"), formatApprovedStyleRulebook(contract)],
    [path.join(styleDir, "references.md"), formatApprovedStyleReferences(contract)],
    [path.join(styleDir, "anti-patterns.md"), formatApprovedStyleAntiPatterns(contract)],
  ]
  for (const [filePath, content] of writes) {
    if (!content.trim()) continue
    await fs.writeFile(filePath, `${content.trimEnd()}\n`)
  }
}

async function persistStyleEvolutionContractState(projectRoot: string, partial: Partial<StyleEvolutionContract>) {
  const paths = absolutePaths(projectRoot)
  const current = await readOptionalJson<StyleEvolutionContract>(paths.styleContract, {})
  const next: StyleEvolutionContract = {
    ...current,
    ...partial,
  }
  next.retryPolicy = next.retryPolicy || current.retryPolicy || defaultRetryPolicy()
  next.loop = deriveLoopState(next)
  next.loopProtocol = deriveStyleLoopProtocol(next)
  await fs.writeFile(paths.styleContract, `${JSON.stringify(next, null, 2)}\n`)
  await persistStyleFreezeLedger(projectRoot, next)
  return next
}

export async function persistStyleEvolutionRuntimeState(
  projectRoot: string,
  runtime: NonNullable<StyleEvolutionContract["runtime"]>,
) {
  const current = await readOptionalJson<StyleEvolutionContract>(absolutePaths(projectRoot).styleContract, {})
  return persistStyleEvolutionContractState(projectRoot, {
    runtime: {
      ...current.runtime,
      ...runtime,
      engine: "Style Evolution Engine",
      runtime: "Prompt Loop Runtime",
      gate: "Style Contract Freeze Gate",
      verificationGate: "Generation Verification Gate",
    },
  })
}

function relativePaths(): StyleEvolutionAssetPaths {
  return {
    dir: STYLE_EVOLUTION_DIR,
    samplesDir: STYLE_SAMPLES_DIR,
    seedPrompt: STYLE_SEED_PATH,
    userStylePrompt: USER_STYLE_PROMPT_PATH,
    referenceText: REFERENCE_TEXT_PATH,
    history: EVOLUTION_HISTORY_PATH,
    styleContract: STYLE_CONTRACT_PATH,
    approvedSample: APPROVED_SAMPLE_PATH,
    freezeLedger: STYLE_FREEZE_LEDGER_PATH,
    loopRuntime: STYLE_LOOP_RUNTIME_PATH,
    loopRuns: STYLE_LOOP_RUNS_PATH,
  }
}

function absolutePaths(projectRoot: string) {
  const paths = relativePaths()
  return {
    dir: path.join(projectRoot, paths.dir),
    samplesDir: path.join(projectRoot, paths.samplesDir),
    seedPrompt: path.join(projectRoot, paths.seedPrompt),
    userStylePrompt: path.join(projectRoot, paths.userStylePrompt),
    referenceText: path.join(projectRoot, paths.referenceText),
    history: path.join(projectRoot, paths.history),
    styleContract: path.join(projectRoot, paths.styleContract),
    approvedSample: path.join(projectRoot, paths.approvedSample),
    freezeLedger: path.join(projectRoot, paths.freezeLedger),
    loopRuntime: path.join(projectRoot, paths.loopRuntime),
    loopRuns: path.join(projectRoot, paths.loopRuns),
  }
}

function createLoopRunId() {
  return `style_loop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createStyleLoopRuntimeRecord(input: {
  projectTitle?: string
  idea?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  iterationFeedback?: string
  requestedIterations: number
}): StyleLoopRuntimeRecord {
  const referenceWorks = normalizeStringArray(input.referenceWorks)
  const desiredVibes = normalizeStringArray(input.desiredVibes)
  const seedForbiddenPatterns = normalizeStringArray(input.seedForbiddenPatterns)
  return {
    version: 1,
    runId: createLoopRunId(),
    engine: "Style Evolution Engine",
    runtime: "Prompt Loop Runtime",
    gate: "Style Contract Freeze Gate",
    verificationGate: "Generation Verification Gate",
    status: "running",
    startedAt: new Date().toISOString(),
    requestedIterations: Math.max(1, input.requestedIterations),
    completedIterations: 0,
    projectTitle: normalizeText(input.projectTitle) || undefined,
    idea: normalizeText(input.idea) || undefined,
    userStylePrompt: normalizeText(input.userStylePrompt) || undefined,
    referenceText: normalizeText(input.referenceText) || undefined,
    referenceWorks: referenceWorks.length ? referenceWorks : undefined,
    desiredVibes: desiredVibes.length ? desiredVibes : undefined,
    seedForbiddenPatterns: seedForbiddenPatterns.length ? seedForbiddenPatterns : undefined,
    iterationFeedback: normalizeText(input.iterationFeedback) || undefined,
    iterations: [],
  }
}

export async function persistStyleLoopRuntime(projectRoot: string, runtime: StyleLoopRuntimeRecord) {
  const paths = absolutePaths(projectRoot)
  await fs.mkdir(path.dirname(paths.loopRuntime), { recursive: true })
  await fs.writeFile(paths.loopRuntime, `${JSON.stringify(runtime, null, 2)}\n`)
  return runtime
}

export async function appendStyleLoopRunLedger(projectRoot: string, runtime: StyleLoopRuntimeRecord) {
  const paths = absolutePaths(projectRoot)
  await fs.mkdir(path.dirname(paths.loopRuns), { recursive: true })
  const record = {
    recordedAt: new Date().toISOString(),
    runId: runtime.runId,
    status: runtime.status,
    stopReason: runtime.stopReason,
    startedAt: runtime.startedAt,
    completedAt: runtime.completedAt,
    requestedIterations: runtime.requestedIterations,
    completedIterations: runtime.completedIterations,
    finalVersion: runtime.finalVersion,
    finalLoopStatus: runtime.finalLoopStatus,
    finalConvergence: runtime.finalConvergence,
    verificationGate: runtime.verificationGate,
    iterations: runtime.iterations.map((entry) => ({
      iteration: entry.iteration,
      version: entry.version,
      completedAt: entry.completedAt,
      stage: entry.stage,
      candidateCount: entry.candidateCount,
      candidateIndex: entry.candidateIndex,
      candidateScores: entry.candidateScores,
      winningReason: entry.winningReason,
      verificationStatus: entry.verificationStatus,
      verificationSummary: entry.verificationSummary,
      verificationReasons: entry.verificationReasons,
      freezerVerdict: entry.freezerVerdict,
      freezerSummary: entry.freezerSummary,
      freezerBlockingReasons: entry.freezerBlockingReasons,
      aigcRiskScore: entry.aigcRiskScore,
      aigcThreshold: entry.aigcThreshold,
      aigcHighRiskCount: entry.aigcHighRiskCount,
      forbiddenHitCount: entry.forbiddenHitCount,
      candidates: (entry.candidates || []).map((candidate) => ({
        candidateIndex: candidate.candidateIndex,
        persistedVersion: candidate.persistedVersion,
        sampleExcerpt: candidate.sample.replace(/\s+/gu, " ").slice(0, 240),
        verdict: candidate.evaluation?.verdict,
        overallScore: candidate.evaluation?.scores?.overall,
        evaluationSummary: candidate.evaluation?.summary,
        verification: candidate.verification,
        freezer: candidate.freezer,
        refinementSummary: candidate.refinement?.summary,
      })),
    })),
  }
  await fs.appendFile(paths.loopRuns, `${JSON.stringify(record)}\n`)
  return record
}

async function readStyleLoopRuntime(projectRoot: string) {
  const paths = absolutePaths(projectRoot)
  return readOptionalJson<StyleLoopRuntimeRecord | null>(paths.loopRuntime, null)
}

async function readOptionalText(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""
    throw error
  }
}

async function readOptionalJson<T>(filePath: string, fallback: T): Promise<T> {
  const raw = await readOptionalText(filePath)
  if (!raw.trim()) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeTextIfNeeded(filePath: string, content: string, overwrite: boolean) {
  if (!overwrite) {
    const existing = await readOptionalText(filePath)
    if (existing.trim()) return
  }
  await fs.writeFile(filePath, content.endsWith("\n") ? content : `${content}\n`)
}

function normalizeText(value: string | undefined) {
  return value?.trim() || ""
}

function clipStylePromptText(value: unknown, limit: number) {
  const text = normalizeText(typeof value === "string" ? value : String(value ?? "")).replace(/\s+/gu, " ")
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function compactStyleEvaluationForPrompt(evaluation: StyleEvolutionEvaluation) {
  return {
    verdict: evaluation.verdict,
    summary: clipStylePromptText(evaluation.summary, 360),
    scores: evaluation.scores,
    strengths: (evaluation.strengths || []).slice(0, 3).map((item) => clipStylePromptText(item, 140)),
    deviations: (evaluation.deviations || []).slice(0, 3).map((item) => clipStylePromptText(item, 140)),
    forbiddenHits: (evaluation.forbiddenHits || []).slice(0, 4),
    nextFocus: (evaluation.nextFocus || []).slice(0, 4).map((item) => clipStylePromptText(item, 140)),
    aigc: evaluation.aigc ? {
      status: evaluation.aigc.status,
      provider: evaluation.aigc.provider,
      score: evaluation.aigc.score,
      threshold: evaluation.aigc.threshold,
      highRiskCount: evaluation.aigc.highRiskCount,
      highRiskPreviews: (evaluation.aigc.highRiskPreviews || []).slice(0, 2),
    } : undefined,
  }
}

function compactStyleRefinementForPrompt(refinement: StyleEvolutionRefinement) {
  return {
    summary: clipStylePromptText(refinement.summary, 300),
    promptAdjustments: (refinement.promptAdjustments || []).slice(0, 4).map((item) => clipStylePromptText(item, 140)),
    contractAdjustments: (refinement.contractAdjustments || []).slice(0, 4).map((item) => clipStylePromptText(item, 140)),
    nextPrompt: clipStylePromptText(refinement.nextPrompt, 900),
  }
}

function normalizeStringArray(value: string[] | undefined) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))]
    : []
}

function buildSeedPromptProtocol(input: {
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
}) {
  const userStylePrompt = normalizeText(input.userStylePrompt)
  const referenceText = normalizeText(input.referenceText)
  const referenceWorks = normalizeStringArray(input.referenceWorks)
  const desiredVibes = normalizeStringArray(input.desiredVibes)
  const seedForbiddenPatterns = normalizeStringArray(input.seedForbiddenPatterns)
  const rows = [
    userStylePrompt ? `用户风格要求：${userStylePrompt}` : "",
    desiredVibes.length ? `目标气质：${desiredVibes.join("；")}` : "",
    referenceWorks.length ? `参考作品：${referenceWorks.join("；")}` : "",
    seedForbiddenPatterns.length ? `写法禁忌：${seedForbiddenPatterns.join("；")}` : "",
    referenceText ? `参考文本：${referenceText.slice(0, 240)}` : "",
  ].filter(Boolean)
  return {
    rows,
    referenceWorks,
    desiredVibes,
    seedForbiddenPatterns,
  }
}

function defaultSeedPrompt(options: InitializeStyleEvolutionOptions) {
  const title = normalizeText(options.projectTitle) || "Untitled Novel"
  const idea = normalizeText(options.idea) || "未填写核心创意"
  const userStyle = normalizeText(options.userStylePrompt) || "用户尚未补充风格要求。"
  const seedProtocol = buildSeedPromptProtocol(options)
  return [
    "# Style Evolution Seed",
    "",
    `Novel: ${title}`,
    `Core idea: ${idea}`,
    "",
    "## Engine",
    "- Engine: Style Evolution Engine",
    "- Runtime: Prompt Loop Runtime",
    "- Gate: Style Contract Freeze Gate",
    "",
    "## Goal",
    "反复生成短篇小说样段，直到用户确认其可以作为本书正文的基础写法，而不是只适用于单个片段。",
    "",
    "## User Style Direction",
    userStyle,
    ...(seedProtocol.rows.length
      ? [
        "",
        "## Seed Prompt Builder Inputs",
        ...seedProtocol.rows.map((item) => `- ${item}`),
      ]
      : []),
    "",
    "## Loop Tasks",
    "- 先根据用户风格方向、创意和禁忌，生成一版可评估的正文样段。",
    "- 每轮都必须可被评估、可被重写、可被提炼为 style contract。",
    "- 每轮都要追求更稳定的叙述声音、句式节奏、对白压力、描写密度和章末钩子。",
    "- 当样段具备整本书继承价值时，进入冻结候选，而不是提前开始正文。",
    "",
    "## Freeze Target",
    "- base writing prompt",
    "- style contract",
    "- forbidden patterns",
    "- positive examples",
    "- retry policy",
    "",
    "## Hard Requirements",
    "- 只生成小说正文样段，不输出解释、计划或列表。",
    "- 样段必须体现叙述声音、句式节奏、对白规则、描写密度和章末钩子倾向。",
    "- 生成后必须能被提炼成可执行的 style-contract。",
    "- 用户确认前，不能进入正式章节正文创作。",
    "- 必须把整本书可继承性视为目标，而不是只写出一段好看的示例。",
    "- 参考作品只能借鉴声音、结构张力和节奏习惯，不能照抄情节、设定或句子。",
    "- 必须主动规避用户明确列出的写法禁忌与不想要的气质。",
    "",
    "## Anti-Goals",
    "- 不要写成设定说明、世界观介绍、角色小传或剧情大纲。",
    "- 不要用解释性判断代替动作、物件、声音和关系压力。",
    "- 不要为了追求华丽而牺牲可持续的章节写作稳定性。",
  ].join("\n")
}

function buildFallbackStyleContract(sample: string, prompt = ""): NonNullable<StyleEvolutionContract["styleContract"]> {
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
    allowedDevices: ["动作推进", "物件压迫", "短对白", "感官细节"],
    forbiddenPatterns: ["不要总结式升华", "不要模板化转折词", "不要解释创作意图"],
    positiveExamples: shortSample ? [shortSample] : [],
    negativeExamples: [],
  }
}

function normalizeStyleContractForFreeze(
  value: NonNullable<StyleEvolutionContract["styleContract"]>,
  sample: string,
  prompt = "",
): NonNullable<StyleEvolutionContract["styleContract"]> {
  const fallback = buildFallbackStyleContract(sample, prompt)
  return {
    voice: normalizeText(value.voice) || fallback.voice,
    sentenceRhythm: normalizeText(value.sentenceRhythm) || fallback.sentenceRhythm,
    dialogueRules: coerceStringArray(value.dialogueRules).length ? coerceStringArray(value.dialogueRules) : fallback.dialogueRules,
    descriptionRules: coerceStringArray(value.descriptionRules).length ? coerceStringArray(value.descriptionRules) : fallback.descriptionRules,
    emotionRules: coerceStringArray(value.emotionRules).length ? coerceStringArray(value.emotionRules) : fallback.emotionRules,
    pacingRules: coerceStringArray(value.pacingRules).length ? coerceStringArray(value.pacingRules) : fallback.pacingRules,
    povRules: coerceStringArray(value.povRules).length ? coerceStringArray(value.povRules) : fallback.povRules,
    openingRules: coerceStringArray(value.openingRules).length ? coerceStringArray(value.openingRules) : fallback.openingRules,
    endingHookRules: coerceStringArray(value.endingHookRules).length ? coerceStringArray(value.endingHookRules) : fallback.endingHookRules,
    allowedDevices: coerceStringArray(value.allowedDevices).length ? coerceStringArray(value.allowedDevices) : fallback.allowedDevices,
    forbiddenPatterns: coerceStringArray(value.forbiddenPatterns).length ? coerceStringArray(value.forbiddenPatterns) : fallback.forbiddenPatterns,
    positiveExamples: coerceStringArray(value.positiveExamples).length ? coerceStringArray(value.positiveExamples) : fallback.positiveExamples,
    negativeExamples: coerceStringArray(value.negativeExamples),
  }
}

export function validateStyleContractForFreeze(contract: StyleEvolutionContract) {
  const gate = evaluateStyleEvolutionGate(contract)
  if (gate.status !== "blocked") {
    return gate
  }
  const criticalIssue = gate.issues.find((issue) => issue.severity === "critical")
  throw new Error(criticalIssue?.code || "style_contract_freeze_blocked")
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
}

function extractJsonObject(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]?.trim()) return fenced[1].trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start !== -1 && end > start) return trimmed.slice(start, end + 1)
  return ""
}

function parseNumericScore(value: unknown, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return clampScore(value)
}

export function parseStyleEvolutionCritiqueFromText(value: string): ParsedStyleEvolutionCritique | null {
  const jsonText = extractJsonObject(value)
  if (!jsonText) return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return null
  }
  const evaluationPayload = payload.evaluation
  const refinementPayload = payload.refinement
  if (!evaluationPayload || typeof evaluationPayload !== "object" || !refinementPayload || typeof refinementPayload !== "object") {
    return null
  }
  const evaluationRecord = evaluationPayload as Record<string, unknown>
  const refinementRecord = refinementPayload as Record<string, unknown>
  const verdict = evaluationRecord.verdict
  if (verdict !== "retry" && verdict !== "candidate" && verdict !== "approve") {
    return null
  }
  const evaluation: StyleEvolutionEvaluation = {
    source: "llm_critic",
    verdict,
    summary: typeof evaluationRecord.summary === "string" ? evaluationRecord.summary.trim() : "",
    scores: {
      narrativeVoice: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.narrativeVoice, 0),
      sentenceRhythm: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.sentenceRhythm, 0),
      dialogueTexture: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.dialogueTexture, 0),
      informationDensity: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.informationDensity, 0),
      emotionalTension: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.emotionalTension, 0),
      readability: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.readability, 0),
      requirementAlignment: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.requirementAlignment, 0),
      forbiddenPatternRisk: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.forbiddenPatternRisk, 0),
      overall: parseNumericScore((evaluationRecord.scores as Record<string, unknown> | undefined)?.overall, 0),
    },
    strengths: coerceStringArray(evaluationRecord.strengths),
    deviations: coerceStringArray(evaluationRecord.deviations),
    forbiddenHits: coerceStringArray(evaluationRecord.forbiddenHits),
    nextFocus: coerceStringArray(evaluationRecord.nextFocus),
  }
  const refinement: StyleEvolutionRefinement = {
    source: "llm_critic",
    summary: typeof refinementRecord.summary === "string" ? refinementRecord.summary.trim() : "",
    promptAdjustments: coerceStringArray(refinementRecord.promptAdjustments),
    contractAdjustments: coerceStringArray(refinementRecord.contractAdjustments),
    nextPrompt: typeof refinementRecord.nextPrompt === "string" ? refinementRecord.nextPrompt.trim() : "",
  }
  if (!evaluation.summary || !refinement.summary || !refinement.nextPrompt) {
    return null
  }
  return { evaluation, refinement }
}

export function parseStyleEvolutionEvaluationFromText(value: string): ParsedStyleEvolutionEvaluation | null {
  const jsonText = extractJsonObject(value)
  if (!jsonText) return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return null
  }
  const evaluationPayload = payload.evaluation && typeof payload.evaluation === "object"
    ? payload.evaluation as Record<string, unknown>
    : payload
  const verdict = evaluationPayload.verdict
  if (verdict !== "retry" && verdict !== "candidate" && verdict !== "approve") {
    return null
  }
  const evaluation: StyleEvolutionEvaluation = {
    source: "llm_critic",
    verdict,
    summary: typeof evaluationPayload.summary === "string" ? evaluationPayload.summary.trim() : "",
    scores: {
      narrativeVoice: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.narrativeVoice, 0),
      sentenceRhythm: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.sentenceRhythm, 0),
      dialogueTexture: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.dialogueTexture, 0),
      informationDensity: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.informationDensity, 0),
      emotionalTension: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.emotionalTension, 0),
      readability: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.readability, 0),
      requirementAlignment: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.requirementAlignment, 0),
      forbiddenPatternRisk: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.forbiddenPatternRisk, 0),
      overall: parseNumericScore((evaluationPayload.scores as Record<string, unknown> | undefined)?.overall, 0),
    },
    strengths: coerceStringArray(evaluationPayload.strengths),
    deviations: coerceStringArray(evaluationPayload.deviations),
    forbiddenHits: coerceStringArray(evaluationPayload.forbiddenHits),
    nextFocus: coerceStringArray(evaluationPayload.nextFocus),
  }
  if (!evaluation.summary) {
    return null
  }
  return { evaluation }
}

export function parseStyleEvolutionRefinementFromText(value: string): ParsedStyleEvolutionRefinementOnly | null {
  const jsonText = extractJsonObject(value)
  if (!jsonText) return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return null
  }
  const refinementPayload = payload.refinement && typeof payload.refinement === "object"
    ? payload.refinement as Record<string, unknown>
    : payload
  const refinement: StyleEvolutionRefinement = {
    source: "llm_critic",
    summary: typeof refinementPayload.summary === "string" ? refinementPayload.summary.trim() : "",
    promptAdjustments: coerceStringArray(refinementPayload.promptAdjustments),
    contractAdjustments: coerceStringArray(refinementPayload.contractAdjustments),
    nextPrompt: typeof refinementPayload.nextPrompt === "string" ? refinementPayload.nextPrompt.trim() : "",
  }
  if (!refinement.summary || !refinement.nextPrompt) {
    return null
  }
  return { refinement }
}

export function parseStyleFreezeAdviceFromText(value: string): ParsedStyleEvolutionFreezeAdvice | null {
  const jsonText = extractJsonObject(value)
  if (!jsonText) return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return null
  }
  const freezeSummary = typeof payload.freezeSummary === "string" ? payload.freezeSummary.trim() : ""
  const freezeVerdict = normalizeStyleFreezerVerdict(
    payload.freezeVerdict
    || payload.verdict
    || (/还需|继续|暂不|不能|尚未|没有冻结价值|需要重写/u.test(freezeSummary)
      ? "continue"
      : /已形成|可以冻结|可冻结|可持续|ready/u.test(freezeSummary)
        ? "ready"
        : "continue"),
  )
  const blockingReasons = coerceStringArray(payload.blockingReasons)
  const contractAdjustments = coerceStringArray(payload.contractAdjustments)
  const forbiddenPatterns = coerceStringArray(payload.forbiddenPatterns)
  const positiveExamples = coerceStringArray(payload.positiveExamples)
  const inheritedRules = coerceStringArray(payload.inheritedRules)
  if (!freezeSummary) {
    return null
  }
  return {
    freezeVerdict,
    freezeSummary,
    blockingReasons,
    contractAdjustments,
    forbiddenPatterns,
    positiveExamples,
    inheritedRules,
  }
}

export function parseStyleContractFromText(
  value: string,
): NonNullable<StyleEvolutionContract["styleContract"]> | null {
  const jsonText = extractJsonObject(value)
  if (!jsonText) return null
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    return null
  }

  const contract = {
    voice: typeof payload.voice === "string" ? payload.voice.trim() : "",
    sentenceRhythm: typeof payload.sentenceRhythm === "string" ? payload.sentenceRhythm.trim() : "",
    dialogueRules: coerceStringArray(payload.dialogueRules),
    descriptionRules: coerceStringArray(payload.descriptionRules),
    emotionRules: coerceStringArray(payload.emotionRules),
    pacingRules: coerceStringArray(payload.pacingRules),
    povRules: coerceStringArray(payload.povRules),
    openingRules: coerceStringArray(payload.openingRules),
    endingHookRules: coerceStringArray(payload.endingHookRules),
    allowedDevices: coerceStringArray(payload.allowedDevices),
    forbiddenPatterns: coerceStringArray(payload.forbiddenPatterns),
    positiveExamples: coerceStringArray(payload.positiveExamples),
    negativeExamples: coerceStringArray(payload.negativeExamples),
  }

  if (!contract.voice || !contract.sentenceRhythm || contract.forbiddenPatterns.length === 0) {
    return null
  }
  return contract
}

export function buildStyleContractExtractionPrompt(input: StyleContractExtractionPromptInput): StyleContractExtractionPrompt {
  const sample = normalizeText(input.sample)
  const prompt = normalizeText(input.prompt)
  const userStylePrompt = normalizeText(input.userStylePrompt)
  const referenceText = normalizeText(input.referenceText)
  const seedProtocol = buildSeedPromptProtocol(input)
  return {
    system: [
      "你是小说写法合同提炼器。",
      "请从用户确认的小说样段中提炼可执行的写作风格合同。",
      "只输出 JSON 对象，不要输出 Markdown、解释或多余文本。",
      "JSON 字段必须包含：voice, sentenceRhythm, dialogueRules, descriptionRules, emotionRules, pacingRules, povRules, openingRules, endingHookRules, allowedDevices, forbiddenPatterns, positiveExamples, negativeExamples。",
      "除 voice 与 sentenceRhythm 为字符串外，其余字段必须是字符串数组。",
      "规则必须可操作，面向后续章节正文生成和质检。",
    ].join("\n"),
    user: [
      userStylePrompt ? `用户风格要求：\n${userStylePrompt.slice(0, 1200)}` : "",
      seedProtocol.desiredVibes.length ? `目标气质：\n${seedProtocol.desiredVibes.join("\n")}` : "",
      seedProtocol.referenceWorks.length ? `参考作品：\n${seedProtocol.referenceWorks.join("\n")}` : "",
      seedProtocol.seedForbiddenPatterns.length ? `用户明确禁忌：\n${seedProtocol.seedForbiddenPatterns.join("\n")}` : "",
      prompt ? `候选生成 prompt：\n${prompt.slice(0, 1200)}` : "",
      referenceText ? `参考文本：\n${referenceText.slice(0, 1200)}` : "",
      `用户确认样段：\n${sample.slice(0, 2400)}`,
      "请提炼为严格 JSON。",
    ].filter(Boolean).join("\n\n"),
  }
}

export function buildStyleFreezeAdvicePrompt(input: StyleFreezeAdvicePromptInput): StyleFreezeAdvicePrompt {
  const sample = normalizeText(input.sample)
  const prompt = normalizeText(input.prompt)
  const userStylePrompt = normalizeText(input.userStylePrompt)
  const referenceText = normalizeText(input.referenceText)
  const seedProtocol = buildSeedPromptProtocol(input)
  return {
    system: [
      "你是 Style Contract Freeze Gate 的 Freezer。",
      "请基于当前候选样段、评估结果和修订建议，输出本轮是否已具备冻结潜力的冻结建议。",
      "只输出 JSON 对象，不要输出 Markdown、解释或多余文本。",
      "JSON 字段必须包含：freezeVerdict, freezeSummary, blockingReasons, contractAdjustments, forbiddenPatterns, positiveExamples, inheritedRules。",
      "freezeVerdict 只能是 block / continue / ready；只有当前样段已经适合作为整本书后续章节写法底盘时才允许 ready。",
      "freezeSummary 必须是字符串，blockingReasons 和其余字段必须是字符串数组。",
      "blockingReasons 要说明为什么暂时不能冻结；ready 时可以为空数组。",
      "contractAdjustments 要说明 style contract 还应如何收紧。",
      "forbiddenPatterns 要补充本轮最该继续压制的写法禁忌。",
      "positiveExamples 要抽取本轮可复用的正向写法片段。",
      "inheritedRules 要说明若未来冻结，正文应如何强制继承。",
      "每个数组最多 4 条，每条不超过 60 个中文字符；nextPrompt 不要在本步骤输出。",
    ].join("\n"),
    user: [
      userStylePrompt ? `用户风格要求：\n${userStylePrompt.slice(0, 1200)}` : "",
      seedProtocol.desiredVibes.length ? `目标气质：\n${seedProtocol.desiredVibes.join("\n")}` : "",
      seedProtocol.referenceWorks.length ? `参考作品：\n${seedProtocol.referenceWorks.join("\n")}` : "",
      seedProtocol.seedForbiddenPatterns.length ? `用户明确禁忌：\n${seedProtocol.seedForbiddenPatterns.join("\n")}` : "",
      prompt ? `本轮 prompt 摘要：\n${clipStylePromptText(prompt, 700)}` : "",
      referenceText ? `参考文本摘要：\n${clipStylePromptText(referenceText, 600)}` : "",
      input.evaluation ? `本轮评估摘要：\n${JSON.stringify(compactStyleEvaluationForPrompt(input.evaluation), null, 2)}` : "",
      input.refinement ? `本轮修订摘要：\n${JSON.stringify(compactStyleRefinementForPrompt(input.refinement), null, 2)}` : "",
      `本轮样段：\n${sample.slice(0, 1600)}`,
      "请返回严格 JSON。",
    ].filter(Boolean).join("\n\n"),
  }
}

export function buildStyleEvolutionCritiquePrompt(input: {
  projectTitle?: string
  idea?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  prompt: string
  sample: string
  priorSample?: string
  iterationFeedback?: string
}): StyleEvolutionRefinementPrompt {
  const projectTitle = normalizeText(input.projectTitle) || "Untitled Novel"
  const idea = normalizeText(input.idea) || "未填写核心创意"
  const userStylePrompt = normalizeText(input.userStylePrompt)
  const referenceText = normalizeText(input.referenceText)
  const seedProtocol = buildSeedPromptProtocol(input)
  const prompt = normalizeText(input.prompt)
  const sample = normalizeText(input.sample)
  const priorSample = normalizeText(input.priorSample)
  const iterationFeedback = normalizeText(input.iterationFeedback)
  return {
    system: [
      "你是 Style Evolution Engine 的 Critic + Prompt Refiner。",
      "请对当前小说样段进行多维评估，并给出下一轮 prompt 和 style contract 收紧建议。",
      "只输出 JSON 对象，不要输出 Markdown、解释或多余文本。",
      "JSON 结构必须为 { evaluation: {...}, refinement: {...} }。",
      "evaluation 必须包含：verdict, summary, scores, strengths, deviations, forbiddenHits, nextFocus。",
      "scores 必须包含：narrativeVoice, sentenceRhythm, dialogueTexture, informationDensity, emotionalTension, readability, requirementAlignment, forbiddenPatternRisk, overall。",
      "refinement 必须包含：summary, promptAdjustments, contractAdjustments, nextPrompt。",
      "verdict 只能是 retry / candidate / approve。",
      "评分区间统一为 0-10，可以保留一位小数。",
      "要直面偏差，不要客套，不要泛泛而谈。",
      "所有数组最多 4 条；nextPrompt 控制在 900 字以内。",
    ].join("\n"),
    user: [
      `项目：${projectTitle}`,
      `核心创意：${idea}`,
      userStylePrompt ? `用户风格要求：\n${userStylePrompt}` : "",
      seedProtocol.desiredVibes.length ? `目标气质：\n${seedProtocol.desiredVibes.join("\n")}` : "",
      seedProtocol.referenceWorks.length ? `参考作品：\n${seedProtocol.referenceWorks.join("\n")}` : "",
      seedProtocol.seedForbiddenPatterns.length ? `用户明确禁忌：\n${seedProtocol.seedForbiddenPatterns.join("\n")}` : "",
      referenceText ? `参考文本：\n${referenceText.slice(0, 1600)}` : "",
      priorSample ? `上一版样段：\n${priorSample.slice(0, 1200)}` : "",
      iterationFeedback ? `用户本轮反馈：\n${iterationFeedback}` : "",
      `本轮 prompt 摘要：\n${clipStylePromptText(prompt, 900)}`,
      `本轮样段：\n${sample.slice(0, 1600)}`,
      "请返回严格 JSON。",
    ].filter(Boolean).join("\n\n"),
  }
}

export function buildStyleEvolutionEvaluationPrompt(input: {
  projectTitle?: string
  idea?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  prompt: string
  sample: string
  priorSample?: string
  iterationFeedback?: string
}): StyleEvolutionRefinementPrompt {
  const projectTitle = normalizeText(input.projectTitle) || "Untitled Novel"
  const idea = normalizeText(input.idea) || "未填写核心创意"
  const userStylePrompt = normalizeText(input.userStylePrompt)
  const referenceText = normalizeText(input.referenceText)
  const seedProtocol = buildSeedPromptProtocol(input)
  const prompt = normalizeText(input.prompt)
  const sample = normalizeText(input.sample)
  const priorSample = normalizeText(input.priorSample)
  const iterationFeedback = normalizeText(input.iterationFeedback)
  return {
    system: [
      "你是 Style Evolution Engine 的 Evaluator / Critic。",
      "请只负责评估当前小说样段，不要做 prompt 改写。",
      "只输出 JSON 对象，不要输出 Markdown、解释或多余文本。",
      "JSON 结构必须为 { evaluation: {...} }，也允许直接输出 evaluation 对象。",
      "evaluation 必须包含：verdict, summary, scores, strengths, deviations, forbiddenHits, nextFocus。",
      "scores 必须包含：narrativeVoice, sentenceRhythm, dialogueTexture, informationDensity, emotionalTension, readability, requirementAlignment, forbiddenPatternRisk, overall。",
      "verdict 只能是 retry / candidate / approve。",
      "评分区间统一为 0-10，可以保留一位小数。",
    ].join("\n"),
    user: [
      `项目：${projectTitle}`,
      `核心创意：${idea}`,
      userStylePrompt ? `用户风格要求：\n${userStylePrompt}` : "",
      seedProtocol.desiredVibes.length ? `目标气质：\n${seedProtocol.desiredVibes.join("\n")}` : "",
      seedProtocol.referenceWorks.length ? `参考作品：\n${seedProtocol.referenceWorks.join("\n")}` : "",
      seedProtocol.seedForbiddenPatterns.length ? `用户明确禁忌：\n${seedProtocol.seedForbiddenPatterns.join("\n")}` : "",
      referenceText ? `参考文本：\n${referenceText.slice(0, 1600)}` : "",
      priorSample ? `上一版样段：\n${priorSample.slice(0, 1200)}` : "",
      iterationFeedback ? `用户本轮反馈：\n${iterationFeedback}` : "",
      `本轮 prompt 摘要：\n${clipStylePromptText(prompt, 900)}`,
      `本轮样段：\n${sample.slice(0, 1800)}`,
      "请返回严格 JSON。",
    ].filter(Boolean).join("\n\n"),
  }
}

export function buildStyleEvolutionRefinementOnlyPrompt(input: {
  projectTitle?: string
  idea?: string
  userStylePrompt?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  prompt: string
  sample: string
  evaluation: StyleEvolutionEvaluation
  iterationFeedback?: string
}): StyleEvolutionRefinementPrompt {
  const projectTitle = normalizeText(input.projectTitle) || "Untitled Novel"
  const idea = normalizeText(input.idea) || "未填写核心创意"
  const userStylePrompt = normalizeText(input.userStylePrompt)
  const seedProtocol = buildSeedPromptProtocol(input)
  const prompt = normalizeText(input.prompt)
  const sample = normalizeText(input.sample)
  const iterationFeedback = normalizeText(input.iterationFeedback)
  return {
    system: [
      "你是 Style Evolution Engine 的 Prompt Refiner。",
      "请只负责根据评估结果改写下一轮 prompt，并提出 style contract 收紧建议。",
      "只输出 JSON 对象，不要输出 Markdown、解释或多余文本。",
      "JSON 结构必须为 { refinement: {...} }，也允许直接输出 refinement 对象。",
      "refinement 必须包含：summary, promptAdjustments, contractAdjustments, nextPrompt。",
      "summary 不超过 160 字；promptAdjustments 和 contractAdjustments 各最多 4 条，每条不超过 60 字。",
      "nextPrompt 只能保留下一轮最必要的写法指令，必须控制在 900 字以内，不能复制完整评估或完整样段。",
    ].join("\n"),
    user: [
      `项目：${projectTitle}`,
      `核心创意：${idea}`,
      userStylePrompt ? `用户风格要求：\n${userStylePrompt}` : "",
      seedProtocol.desiredVibes.length ? `目标气质：\n${seedProtocol.desiredVibes.join("\n")}` : "",
      seedProtocol.referenceWorks.length ? `参考作品：\n${seedProtocol.referenceWorks.join("\n")}` : "",
      seedProtocol.seedForbiddenPatterns.length ? `用户明确禁忌：\n${seedProtocol.seedForbiddenPatterns.join("\n")}` : "",
      iterationFeedback ? `用户本轮反馈：\n${iterationFeedback}` : "",
      `本轮 prompt 摘要：\n${clipStylePromptText(prompt, 800)}`,
      `本轮样段：\n${sample.slice(0, 1400)}`,
      `本轮评估摘要：\n${JSON.stringify(compactStyleEvaluationForPrompt(input.evaluation), null, 2)}`,
      "请返回严格 JSON。",
    ].filter(Boolean).join("\n\n"),
  }
}

export function buildStyleEvolutionCandidatePrompt(input: StyleEvolutionCandidatePromptInput): StyleEvolutionCandidatePrompt {
  const projectTitle = normalizeText(input.projectTitle) || "Untitled Novel"
  const idea = normalizeText(input.idea) || "未填写核心创意"
  const userStylePrompt = normalizeText(input.userStylePrompt) || "用户尚未补充风格要求。"
  const referenceText = normalizeText(input.referenceText)
  const seedProtocol = buildSeedPromptProtocol(input)
  const seedPrompt = normalizeText(input.seedPrompt)
  const priorSample = normalizeText(input.priorSample)
  const iterationFeedback = normalizeText(input.iterationFeedback)
  const prompt = [
    `为《${projectTitle}》生成一版可供用户确认的小说写法样段。`,
    `核心创意：${idea}`,
    `用户风格要求：${userStylePrompt}`,
    seedProtocol.desiredVibes.length ? `目标气质：${seedProtocol.desiredVibes.join("、")}` : "",
    seedProtocol.referenceWorks.length ? `参考作品：${seedProtocol.referenceWorks.join("、")}` : "",
    seedProtocol.seedForbiddenPatterns.length ? `必须回避：${seedProtocol.seedForbiddenPatterns.join("、")}` : "",
    iterationFeedback ? `本轮用户反馈：${iterationFeedback}` : "",
  ].join("\n")

  const system = [
    "你是 Style Evolution Engine 的 Candidate Generator，只负责生成一段可评估的正文样段。",
    "目标是帮助用户确认整本书的基础叙述声音、句式节奏、对白规则、描写密度和情绪留白。",
    "必须只输出小说正文样段，不要输出标题、解释、列表、计划、Markdown 或自我评价。",
    "样段长度控制在 500-900 个中文字符。",
    "必须有具体场景、人物动作、感官细节、关系压力和一个可追踪钩子。",
    "不要写系统提示、不要提到 prompt、不要总结创作意图。",
  ].join("\n")

  const userBlocks = [
    prompt,
    "\n本轮目标不是写一段孤立好看的示例，而是逼近一份可冻结、可继承到整本书的基础写法。",
    seedProtocol.referenceWorks.length ? `\n参考作品（借鉴声音、节奏和张力，不照抄情节与句子）：\n${seedProtocol.referenceWorks.join("\n")}` : "",
    seedProtocol.desiredVibes.length ? `\n目标气质：\n${seedProtocol.desiredVibes.join("\n")}` : "",
    seedProtocol.seedForbiddenPatterns.length ? `\n必须主动规避的写法禁忌：\n${seedProtocol.seedForbiddenPatterns.join("\n")}` : "",
    seedPrompt ? `\n初始写法 prompt：\n${seedPrompt.slice(0, 1800)}` : "",
    referenceText ? `\n用户参考文本：\n${referenceText.slice(0, 1800)}` : "",
    priorSample ? `\n上一版候选样段：\n${priorSample.slice(0, 1200)}\n\n请在保留优点的基础上更接近用户要求。` : "",
    iterationFeedback ? `\n本轮必须响应的用户反馈：\n${iterationFeedback.slice(0, 1200)}` : "",
    "\n请特别注意：当前样段未来需要被提炼为 base writing prompt、style contract、forbidden patterns、positive examples 和 retry policy 的来源。",
    "\n现在输出一段新的小说正文样段。",
  ]

  return {
    system,
    user: userBlocks.filter(Boolean).join("\n"),
    prompt,
  }
}

export function getStyleEvolutionAssetPaths(projectRoot: string): StyleEvolutionAssetPaths {
  return absolutePaths(projectRoot)
}

export async function initializeStyleEvolution(
  projectRoot: string,
  options: InitializeStyleEvolutionOptions = {},
): Promise<StyleEvolutionSnapshot> {
  const paths = absolutePaths(projectRoot)
  const overwrite = options.overwrite === true
  await fs.mkdir(paths.dir, { recursive: true })
  await fs.mkdir(paths.samplesDir, { recursive: true })
  await writeTextIfNeeded(paths.seedPrompt, normalizeText(options.seedPrompt) || defaultSeedPrompt(options), overwrite)
  if (normalizeText(options.userStylePrompt) || overwrite) {
    await writeTextIfNeeded(paths.userStylePrompt, normalizeText(options.userStylePrompt), overwrite)
  }
  if (normalizeText(options.referenceText) || overwrite) {
    await writeTextIfNeeded(paths.referenceText, normalizeText(options.referenceText), overwrite)
  }
  const existingHistory = await readOptionalText(paths.history)
  if (!existingHistory.trim() || overwrite) {
    await fs.writeFile(paths.history, "[]\n")
  }
  const existingLedger = await readOptionalText(paths.freezeLedger)
  if (!existingLedger.trim() || overwrite) {
    await fs.writeFile(paths.freezeLedger, `${JSON.stringify({
      version: 1,
      generatedAt: new Date().toISOString(),
      latestVersion: 0,
      convergence: "unknown",
      convergenceEvidence: [],
      entries: [],
    }, null, 2)}\n`)
  }
  const existingRuntime = await readOptionalText(paths.loopRuntime)
  if (!existingRuntime.trim() || overwrite) {
    await fs.writeFile(paths.loopRuntime, "null\n")
  }
  await persistStyleEvolutionContractState(projectRoot, {
    runtime: {
      engine: "Style Evolution Engine",
      runtime: "Prompt Loop Runtime",
      gate: "Style Contract Freeze Gate",
      lastRunStatus: "idle",
    },
    seedPrompt: normalizeText(options.seedPrompt) || (await readOptionalText(paths.seedPrompt)).trim(),
    userStylePrompt: normalizeText(options.userStylePrompt) || (await readOptionalText(paths.userStylePrompt)).trim(),
    referenceText: normalizeText(options.referenceText) || (await readOptionalText(paths.referenceText)).trim(),
    referenceWorks: normalizeStringArray(options.referenceWorks),
    desiredVibes: normalizeStringArray(options.desiredVibes),
    seedForbiddenPatterns: normalizeStringArray(options.seedForbiddenPatterns),
    retryPolicy: defaultRetryPolicy(),
  })
  return loadStyleEvolution(projectRoot)
}

export async function appendStyleEvolutionCandidate(
  projectRoot: string,
  input: StyleEvolutionCandidateInput,
): Promise<StyleEvolutionSnapshot> {
  const paths = absolutePaths(projectRoot)
  await fs.mkdir(paths.samplesDir, { recursive: true })
  const history = await readOptionalJson<NonNullable<StyleEvolutionContract["evolutionHistory"]>>(paths.history, [])
  const version = Math.max(0, ...history.map((entry) => entry.version || 0)) + 1
  const samplePath = path.join(paths.samplesDir, `v${String(version).padStart(3, "0")}.md`)
  const prompt = normalizeText(input.prompt)
  const sample = normalizeText(input.sample)
  const review = normalizeText(input.review)
  const createdAt = input.createdAt || new Date().toISOString()
  const currentContract = await readOptionalJson<StyleEvolutionContract>(paths.styleContract, {})
  const retryPolicy = currentContract.retryPolicy || defaultRetryPolicy()
  const freezer = input.freezer
    ? {
      source: input.freezer.source,
      verdict: normalizeStyleFreezerVerdict(input.freezer.verdict),
      summary: normalizeText(input.freezer.summary),
      blockingReasons: normalizeStringArray(input.freezer.blockingReasons),
      checkedAt: input.freezer.checkedAt || createdAt,
    }
    : undefined
  const fallbackReasons = normalizeStringArray(input.fallbackReasons)
  const llmFallbackUsed = Boolean(input.llmFallbackUsed || input.evaluation?.source === "heuristic" || input.refinement?.source === "heuristic" || freezer?.source === "heuristic")
  const totalRounds = history.length + 1
  const projectedHistory = history.concat([{
    version,
    prompt,
    sample,
    review,
    createdAt,
    samplePath: path.relative(projectRoot, samplePath).replace(/\\/gu, "/"),
    iterationFeedback: normalizeText(input.iterationFeedback),
    source: input.source || "manual",
    userDecision: "pending",
    contractTightening: input.refinement?.contractAdjustments || [],
    convergenceNote: input.evaluation?.summary,
    freezer,
    llmFallbackUsed,
    fallbackReasons,
    verification: buildStyleGenerationVerification({
      evaluation: input.evaluation,
      version,
      checkedAt: createdAt,
    }),
    evaluation: input.evaluation,
    refinement: input.refinement,
  }])
  const projectedStableState = computeStableWindowState({ history: projectedHistory, retryPolicy })
  const readyReasons = buildReadyReasons(input.evaluation, retryPolicy, totalRounds)
  const readyForApproval = computeReadyForApproval({
    evaluation: input.evaluation,
    retryPolicy,
    totalRounds,
    stable: projectedStableState.stable,
    freezer,
  })
  await fs.writeFile(samplePath, `${sample}\n`)
  history.push({
    version,
    prompt,
    sample,
    review,
    createdAt,
    samplePath: path.relative(projectRoot, samplePath).replace(/\\/gu, "/"),
    iterationFeedback: normalizeText(input.iterationFeedback),
    source: input.source || "manual",
    readyForApproval,
    readyReasons,
    userDecision: "pending",
    contractTightening: input.refinement?.contractAdjustments || [],
    convergenceNote: input.evaluation?.summary,
    freezer,
    llmFallbackUsed,
    fallbackReasons,
    verification: buildStyleGenerationVerification({
      evaluation: input.evaluation,
      version,
      checkedAt: createdAt,
    }),
    evaluation: input.evaluation,
    refinement: input.refinement,
  })
  await fs.writeFile(paths.history, `${JSON.stringify(history, null, 2)}\n`)
  await persistStyleEvolutionContractState(projectRoot, {
    evolutionHistory: history,
    freezer: freezer
      ? {
        ...freezer,
        version,
      }
      : currentContract.freezer,
    verification: buildStyleGenerationVerification({
      evaluation: input.evaluation,
      version,
      checkedAt: createdAt,
    }),
  })
  return loadStyleEvolution(projectRoot)
}

export async function approveStyleEvolutionSample(
  projectRoot: string,
  input: ApproveStyleEvolutionInput,
): Promise<StyleEvolutionSnapshot> {
  const paths = absolutePaths(projectRoot)
  await fs.mkdir(paths.dir, { recursive: true })
  const history = await readOptionalJson<NonNullable<StyleEvolutionContract["evolutionHistory"]>>(paths.history, [])
  const currentContract = await readOptionalJson<StyleEvolutionContract>(paths.styleContract, {})
  const selected = input.version ? history.find((entry) => entry.version === input.version) : null
  if (!input.version) {
    throw new Error("style_candidate_version_required")
  }
  if (!selected) {
    throw new Error("style_candidate_not_found")
  }
  if (selected && !isOpenStyleEvolutionEntry(
    selected,
    currentContract.approval?.status === "rejected" ? currentContract.approval.rejectedVersion : undefined,
  )) {
    throw new Error("style_candidate_rejected")
  }
  const sample = normalizeText(input.sample) || selected?.sample?.trim() || ""
  if (!sample) {
    throw new Error("approveStyleEvolutionSample requires a sample or an existing history version")
  }
  const selectedVerification = styleGenerationVerificationFromEntry(selected)
  if (selectedVerification.status === "blocked") {
    throw new Error(
      "style_generation_verification_blocked",
    )
  }
  if (!isVerifiedStyleCandidate(selected)) {
    throw new Error("style_candidate_not_verified")
  }
  const approvalFreezer = input.freezer
    ? {
      source: input.freezer.source,
      verdict: normalizeStyleFreezerVerdict(input.freezer.verdict),
      summary: normalizeText(input.freezer.summary),
      blockingReasons: normalizeStringArray(input.freezer.blockingReasons),
      checkedAt: input.freezer.checkedAt || input.approvedAt || new Date().toISOString(),
    }
    : selected.freezer
  const selectedForGate = approvalFreezer ? { ...selected, freezer: approvalFreezer } : selected
  if (!isStyleCandidateLoopReady(selectedForGate, currentContract)) {
    throw new Error("style_candidate_not_ready_for_freeze")
  }
  if (selected.userDecision !== "accepted_for_freeze") {
    throw new Error("style_candidate_not_user_accepted")
  }
  const seedPrompt = await readOptionalText(paths.seedPrompt)
  const userStylePrompt = await readOptionalText(paths.userStylePrompt)
  const prompt = selected?.prompt || userStylePrompt || seedPrompt
  const styleContract = normalizeStyleContractForFreeze(
    input.styleContract || buildFallbackStyleContract(sample, prompt),
    sample,
    prompt,
  )
  const mergedPositiveExamples = [...new Set([
    ...(Array.isArray(styleContract.positiveExamples) ? styleContract.positiveExamples : []),
    ...(Array.isArray(input.positiveExamples) ? input.positiveExamples : []),
  ].map((item) => normalizeText(item)).filter(Boolean))]
  if (mergedPositiveExamples.length) {
    styleContract.positiveExamples = mergedPositiveExamples
  }
  const frozenBasePrompt = normalizeText(input.frozenBasePrompt)
    || normalizeText(selected?.refinement?.nextPrompt)
    || prompt
  const approvedAt = input.approvedAt || new Date().toISOString()
  const approvedVersion = selected?.version
  const nextHistory: NonNullable<StyleEvolutionContract["evolutionHistory"]> = history.map((entry) => {
    if (approvedVersion && entry.version === approvedVersion) {
      return {
        ...entry,
        readyForApproval: true,
        readyReasons: entry.readyReasons?.length
          ? entry.readyReasons
          : buildReadyReasons(entry.evaluation as StyleEvolutionEvaluation | undefined, defaultRetryPolicy(), history.length, approvalFreezer || entry.freezer),
        freezer: approvalFreezer || entry.freezer,
        userDecision: "accepted" as const,
        userDecisionAt: approvedAt,
      }
    }
    return {
      ...entry,
      userDecision: (entry.userDecision === "accepted" ? "accepted" : "superseded") as "accepted" | "superseded",
      userDecisionAt: entry.userDecisionAt,
    }
  })
  const freezeSummary = normalizeText(input.freezeSummary)
    || (selected?.readyReasons?.length
      ? `用户确认 v${selected.version} 为全书基础写法：${selected.readyReasons.join(" ")}`
      : approvedVersion
        ? `用户确认 v${approvedVersion} 为全书基础写法。`
        : "用户确认当前样段为全书基础写法。")
  const inheritedRules = [...new Set([
    ...(Array.isArray(input.inheritedRules) ? input.inheritedRules : []),
    "后续每章必须继承用户冻结后的 base writing prompt。",
    "后续每章必须继承 style contract 中的 voice、节奏、对白与禁忌约束。",
    "正文生产不得绕过已冻结样段重新自由发挥。",
    "如果正文质量返工，返工仍必须在冻结写法合同内部收紧，不得擅自更换写作底盘。",
  ].map((item) => normalizeText(item)).filter(Boolean))]
  const retryPolicy = {
    ...defaultRetryPolicy(),
    ...(currentContract.retryPolicy || {}),
  }
  const contract: StyleEvolutionContract = {
    seedPrompt: seedPrompt.trim(),
    userStylePrompt: userStylePrompt.trim(),
    referenceText: (await readOptionalText(paths.referenceText)).trim(),
    referenceWorks: currentContract.referenceWorks || [],
    desiredVibes: currentContract.desiredVibes || [],
    seedForbiddenPatterns: currentContract.seedForbiddenPatterns || [],
    retryPolicy,
    freezer: approvalFreezer
      ? {
        ...approvalFreezer,
        version: approvedVersion,
      }
      : currentContract.freezer,
    frozenBasePrompt,
    approval: {
      status: "approved",
      approvedVersion,
      approvedAt,
      approvedBy: input.approvedBy || "user",
      freezeSummary,
      acceptedAsBookStyle: true,
    },
    inheritance: {
      status: "enforced",
      inheritedArtifacts: ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"],
      inheritedRules,
      promptSummary: frozenBasePrompt.replace(/\s+/gu, " ").slice(0, 240),
    },
    approvedSample: sample,
    approvedSamplePath: APPROVED_SAMPLE_PATH,
    approvedAt,
    verification: selected?.version ? selectedVerification : buildStyleGenerationVerification({
      evaluation: selected?.evaluation as StyleEvolutionEvaluation | undefined,
      version: approvedVersion,
      checkedAt: approvedAt,
    }),
    styleContract,
    antiPatterns: input.antiPatterns || styleContract.forbiddenPatterns || [],
    evolutionHistory: nextHistory,
  }
  contract.loop = deriveLoopState({
    ...contract,
    loop: {
      ...contract.loop,
      approvalVersion: approvedVersion,
      readyVersion: approvedVersion,
    },
  })
  contract.loopProtocol = deriveStyleLoopProtocol(contract)
  validateStyleContractForFreeze(contract)
  await fs.writeFile(paths.approvedSample, `${sample}\n`)
  await fs.writeFile(paths.history, `${JSON.stringify(nextHistory, null, 2)}\n`)
  await fs.writeFile(paths.styleContract, `${JSON.stringify(contract, null, 2)}\n`)
  await persistStyleFreezeLedger(projectRoot, contract)
  await materializeApprovedStyleAssets(projectRoot, contract)
  return loadStyleEvolution(projectRoot)
}

export async function acceptStyleEvolutionCandidate(
  projectRoot: string,
  input: AcceptStyleEvolutionCandidateInput,
): Promise<StyleEvolutionSnapshot> {
  const paths = absolutePaths(projectRoot)
  const history = await readOptionalJson<NonNullable<StyleEvolutionContract["evolutionHistory"]>>(paths.history, [])
  const currentContract = await readOptionalJson<StyleEvolutionContract>(paths.styleContract, {})
  const selected = input.version ? history.find((entry) => entry.version === input.version) : history.at(-1)
  if (!input.version) {
    throw new Error("style_candidate_version_required")
  }
  if (!selected) {
    throw new Error("style_candidate_not_found")
  }
  if (!isOpenStyleEvolutionEntry(
    selected,
    currentContract.approval?.status === "rejected" ? currentContract.approval.rejectedVersion : undefined,
  )) {
    throw new Error("style_candidate_rejected")
  }
  const selectedVerification = styleGenerationVerificationFromEntry(selected)
  if (selectedVerification.status === "blocked") {
    throw new Error("style_generation_verification_blocked")
  }
  if (!isVerifiedStyleCandidate(selected)) {
    throw new Error("style_candidate_not_verified")
  }
  if (!isStyleCandidateLoopReady(selected, currentContract)) {
    throw new Error("style_candidate_not_ready_for_freeze")
  }

  const acceptedAt = input.acceptedAt || new Date().toISOString()
  const nextHistory: NonNullable<StyleEvolutionContract["evolutionHistory"]> = history.map((entry) => {
    if (entry.version === selected.version) {
      return {
        ...entry,
        readyForApproval: true,
        userDecision: "accepted_for_freeze" as const,
        userDecisionAt: acceptedAt,
      }
    }
    return entry
  })
  await fs.writeFile(paths.history, `${JSON.stringify(nextHistory, null, 2)}\n`)
  await persistStyleEvolutionContractState(projectRoot, {
    approval: {
      status: "pending",
      approvedBy: input.acceptedBy || "user",
      freezeSummary: `用户已接受 v${selected.version} 作为整书写法候选，等待冻结合同预览与最终确认。`,
      acceptedAsBookStyle: false,
    },
    evolutionHistory: nextHistory,
  })
  return loadStyleEvolution(projectRoot)
}

export async function rejectStyleEvolutionSample(
  projectRoot: string,
  input: RejectStyleEvolutionInput,
): Promise<StyleEvolutionSnapshot> {
  const paths = absolutePaths(projectRoot)
  const history = await readOptionalJson<NonNullable<StyleEvolutionContract["evolutionHistory"]>>(paths.history, [])
  const rejectedAt = input.rejectedAt || new Date().toISOString()
  const rejectionReason = normalizeText(input.rejectionReason)
  if (!rejectionReason) {
    throw new Error("rejectStyleEvolutionSample requires a rejectionReason")
  }
  const selected = input.version ? history.find((entry) => entry.version === input.version) : history.at(-1)
  if (!selected?.version) {
    throw new Error("rejectStyleEvolutionSample requires an existing history version")
  }
  const currentContract = await readOptionalJson<StyleEvolutionContract>(paths.styleContract, {})
  if (!isOpenStyleEvolutionEntry(
    selected,
    currentContract.approval?.status === "rejected" ? currentContract.approval.rejectedVersion : undefined,
  )) {
    throw new Error("style_candidate_rejected")
  }
  const nextHistory: NonNullable<StyleEvolutionContract["evolutionHistory"]> = history.map((entry) => {
    if (entry.version === selected.version) {
      return {
        ...entry,
        userDecision: "superseded",
        userDecisionAt: rejectedAt,
        rejectionReason,
      }
    }
    return entry
  })
  await fs.writeFile(paths.history, `${JSON.stringify(nextHistory, null, 2)}\n`)
  await persistStyleEvolutionContractState(projectRoot, {
    approval: {
      status: "rejected",
      rejectedVersion: selected.version,
      rejectedAt,
      rejectionReason,
      acceptedAsBookStyle: false,
    },
    evolutionHistory: nextHistory,
  })
  return loadStyleEvolution(projectRoot)
}

export async function loadStyleEvolution(projectRoot: string): Promise<StyleEvolutionSnapshot> {
  const paths = absolutePaths(projectRoot)
  const contractFromDisk = await readOptionalJson<StyleEvolutionContract>(paths.styleContract, {})
  const history = await readOptionalJson<NonNullable<StyleEvolutionContract["evolutionHistory"]>>(paths.history, [])
  const approvedSample = (await readOptionalText(paths.approvedSample)).trim()
  const contract: StyleEvolutionContract = {
    runtime: {
      engine: "Style Evolution Engine",
      runtime: "Prompt Loop Runtime",
      gate: "Style Contract Freeze Gate",
      verificationGate: "Generation Verification Gate",
      lastRunId: contractFromDisk.runtime?.lastRunId,
      lastRunStatus: contractFromDisk.runtime?.lastRunStatus || "idle",
      lastStopReason: contractFromDisk.runtime?.lastStopReason,
      lastCompletedAt: contractFromDisk.runtime?.lastCompletedAt,
    },
    ...contractFromDisk,
    retryPolicy: contractFromDisk.retryPolicy || defaultRetryPolicy(),
    seedPrompt: contractFromDisk.seedPrompt || (await readOptionalText(paths.seedPrompt)).trim(),
    userStylePrompt: contractFromDisk.userStylePrompt || (await readOptionalText(paths.userStylePrompt)).trim(),
    referenceText: contractFromDisk.referenceText || (await readOptionalText(paths.referenceText)).trim(),
    referenceWorks: normalizeStringArray(contractFromDisk.referenceWorks),
    desiredVibes: normalizeStringArray(contractFromDisk.desiredVibes),
    seedForbiddenPatterns: normalizeStringArray(contractFromDisk.seedForbiddenPatterns),
    approvedSample: contractFromDisk.approvedSample || approvedSample,
    approvedSamplePath: contractFromDisk.approvedSamplePath || (approvedSample ? APPROVED_SAMPLE_PATH : undefined),
    evolutionHistory: contractFromDisk.evolutionHistory || history,
    verification: contractFromDisk.verification,
  }
  const latestVerification = activeContractGenerationVerification(contract, contract.evolutionHistory || [])
  if (latestVerification) {
    contract.verification = {
      gate: "Generation Verification Gate",
      ...latestVerification,
    }
  }
  if (contract.approvedAt && !contract.approval?.approvedAt) {
    contract.approval = {
      status: "approved",
      approvedVersion: contract.loop?.approvalVersion,
      approvedAt: contract.approvedAt,
      approvedBy: contract.approval?.approvedBy || "user",
      freezeSummary: contract.approval?.freezeSummary || "用户已确认当前写法为全书基础写法。",
      acceptedAsBookStyle: true,
    }
  }
  if (contract.frozenBasePrompt?.trim() && !contract.inheritance?.status) {
    contract.inheritance = {
      status: "enforced",
      inheritedArtifacts: ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"],
      inheritedRules: [
        "后续每章必须继承用户冻结后的 base writing prompt。",
        "后续每章必须继承 style contract 中的 voice、节奏、对白与禁忌约束。",
      ],
      promptSummary: contract.frozenBasePrompt.replace(/\s+/gu, " ").slice(0, 240),
    }
  }
  contract.loop = deriveLoopState(contract)
  contract.loopProtocol = deriveStyleLoopProtocol(contract)
  const freezeLedger = await readOptionalJson<StyleFreezeLedger>(paths.freezeLedger, buildStyleFreezeLedger(contract))
  const loopRuntime = await readStyleLoopRuntime(projectRoot)
  await persistStyleFreezeLedger(projectRoot, contract)
  return {
    paths: relativePaths(),
    contract,
    gate: evaluateStyleEvolutionGate(contract),
    freezeLedger: {
      ...freezeLedger,
      ...buildStyleFreezeLedger(contract),
    },
    loopRuntime,
  }
}
