import fs from "node:fs/promises"
import path from "node:path"

import type { AutonomousNovelState, CharacterDossier } from "./cli-types"
import { createLocalTextEmbedding } from "./embedding"
import { withFactoryDb } from "./factory-db"
import { agentTypeFromLabel, createAgentMessage, createArtifactMessage, type MessagePart, type MessageStatus } from "./messages"
import { generateAgentReply } from "./runtime-llm"
import { throwIfStopped } from "./abort"
import { evaluateChapterConsistency, extractChinesePersonNames, inferLockedProtagonistName } from "./chapter-consistency"
import { ingestProjectArtifact, retrieveKnowledge, formatKnowledgeForPrompt } from "./knowledge"
import { findGenrePreset } from "./genre-presets"
import {
  detectAigcSegments,
  getAigcDetectorConfig,
  type AigcBatchDetectionResult,
  type AigcSegmentDetectionResult,
} from "./aigc-detector"
import { evaluateStyleEvolutionGate, type StyleEvolutionContract, type WritingPlanContract } from "./production-contracts"
import { loadStyleEvolution } from "./production-style-evolution"

export interface NovelWorkspacePaths {
  workspaceDir: string
  plansDir: string
  reportsDir: string
  chaptersDir: string
  memoryDir: string
  styleDir: string
  styleProfilePath: string
  styleRulebookPath: string
  styleReferencesPath: string
  styleAntiPatternsPath: string
  consensusPath: string
  characterDossiersPath?: string
  characterDossiersMarkdownPath?: string
  protagonistPath: string
  relationsPath: string
  characterEvolutionPath: string
  masterOutlinePath: string
  chapterBlueprintsDir: string
}

export interface ProductionPipelineOptions {
  factoryRootDir?: string
  projectId?: string | null
  envRootDir?: string
  directorCommandId?: string | null
  signal?: AbortSignal
  onProgress?: (event: WritingProgressEvent) => void | Promise<void>
  maxRevisionAttempts?: number
  maxRecoveryAttempts?: number
  forceQualityScoreForTest?: number
  preferDeterministicPlanning?: boolean
  writingMode?: ProductionWritingMode
  bypassAigcGate?: boolean
  draftSubcallRoles?: Array<"plot" | "narration" | "dialogue" | "character_action" | "continuity" | "assembly">
}

export type ProductionWritingMode = "fast" | "quality"

export interface WritingProgressEvent {
  messageId?: string
  directorCommandId?: string
  step: string
  role: "Showrunner" | "Chapter Planner" | "Author" | "Editor" | "Reviewer" | "Prose Stylist" | "Memory Keeper"
  chapterNumber?: number
  title?: string
  status?: "started" | "running" | "completed" | "blocked"
  phase?: "request_sent" | "response_started" | "streaming" | "completed" | "failed" | string
  statusText?: string
  statusDetail?: string
  message: string
  artifactPath?: string
  preview?: string
  streamText?: string
  wordCount?: number
  qualityGate?: QualityGateResult
  knowledgeReferences?: WritingKnowledgeReference[]
  timestamp?: string
}

export interface WritingKnowledgeReference {
  chunkId: string
  chunkType: string
  score: number
  sourceType: string
  sourcePath: string
  sourceTitle: string
}

export interface AigcWritingDetectionReport {
  enabled: boolean
  status: "passed" | "blocked" | "unavailable" | "skipped"
  provider: string
  threshold: number
  score: number | null
  maxSegmentScore: number | null
  totalSegments: number
  highRiskSegments: Array<{
    id?: string
    index: number
    startOffset: number
    endOffset: number
    score: number | null
    label: string
    preview: string
  }>
  reason: string
}

export interface ProductionWritingResources {
  styleGuide: string
  chapterPlannerGuide: string
  writerGuide: string
  editorGuide: string
  styleControllerGuide: string
  consistencyGuide: string
  vocabularyIndex: string
  vocabularySamples: string[]
  vocabularyCatalog?: VocabularyCatalog
  examples: string[]
  antiHallucinationGuide?: string
  evidenceConflictStrategy?: string
}

export interface ProductionStoryBibleAsset {
  filename: string
  title: string
  content: string
  stage: string
  format?: "markdown" | "json"
}

export interface ProductionStoryAssetContext {
  prompt: string
  files: string[]
}

export interface ApprovedWritingStyleContext {
  status: "ready" | "missing"
  prompt: string
  contract?: StyleEvolutionContract
  rulebook?: string
  references?: string
  antiPatterns?: string
  chapterInheritanceAdapter?: ChapterInheritanceAdapterPayload
}

export interface ChapterInheritanceAdapterPayload {
  name: "Chapter Inheritance Adapter"
  status: "ready" | "blocked"
  contractVersion: number
  approvedAt: string
  freezerVerdict: "block" | "continue" | "ready" | "missing"
  freezerSummary: string
  verificationStatus: string
  verificationSummary: string
  inheritedArtifacts: string[]
  inheritedRules: string[]
  styleContractFields: string[]
  loopProtocolStatus?: string
  loopProtocolStages?: {
    required: string[]
    completed: string[]
    blocked: string[]
  }
  loopProtocolEvidence?: string[]
  promptSections: string[]
  requiredChapterEvidence: string[]
  approvedSampleExcerpt: string
}

export class ProductionReadinessBlockedError extends Error {
  code = "production_readiness_blocked"
  gate = "style_approval"

  constructor(message: string) {
    super(message)
    this.name = "ProductionReadinessBlockedError"
  }
}

interface VocabularyEntry {
  word: string
  definition: string
  categories: string[]
}

interface VocabularyCatalog {
  totalWords: number
  entriesByCategory: Record<string, VocabularyEntry[]>
  entriesByWord: Map<string, VocabularyEntry>
}

interface StyleTextMetrics {
  characterCount: number
  paragraphCount: number
  sentenceCount: number
  averageParagraphLength: number
  averageSentenceLength: number
  dialogueDensity: number
  sensoryDensity: number
  actionDensity: number
  introspectionDensity: number
  expositionDensity: number
}

export interface QualityGateResult {
  passed: boolean
  score: number
  status: "passed" | "needs_revision" | "blocked"
  attempts: number
  reason: string
  wordCount?: number
  targetWords?: number
}

export interface ContinuityContract {
  lockedProtagonistName: string
  status: "ready" | "needs_first_chapter_lock" | "blocked"
  requiredNames: string[]
  knownCast: string[]
  continuityAnchors: string[]
  previousChapterLedger: string[]
  characterLedger: string
  foreshadowingLedger: string
  hardRules: string[]
  prompt: string
}

export interface CharacterProfileContract {
  status: "ready" | "needs_enrichment" | "blocked"
  requiredFields: string[]
  knownCast: string[]
  missingSignals: string[]
  dossierBrief: string
  profileBrief: string
  prompt: string
  characterDossiers?: CharacterDossier[]
}

export interface DraftSceneCard {
  index: number
  goal: string
  conflict: string
  turn: string
  endHook: string
  requiredCharacters: string[]
  requiredFacts: string[]
  forbiddenFacts: string[]
}

export interface DraftSegmentPlan {
  index: number
  total: number
  label: string
  timelinePosition: string
  narrativeFocus: string
  requiredBeats: string[]
  continuityFocus: string[]
  targetWords: number
  source?: "scene_card" | "timeline"
  sceneCard?: DraftSceneCard
}

export interface DraftSegmentCompositionPlan {
  plot: string[]
  narration: string[]
  dialogue: string[]
  characterAction: string[]
  continuity: string[]
  assemblyRules: string[]
}

export interface DraftSegmentSubArtifactInfo {
  kind: "plot" | "narration" | "dialogue" | "character_action" | "continuity" | "assembly"
  role: "brief" | "material"
  path: string
  relativePath: string
  chars: number
}

export interface DraftSegmentAssemblyUsage {
  requested: boolean
  decision: "not_requested" | "used" | "fallback_author"
  reason: string
  materialChars: number
  finalChars: number
  fallbackChars: number
}

export interface ChapterContextPackageInfo {
  path: string
  relativePath: string
  promptBudget: {
    basePromptChars: number
    fixedDynamicPromptChars: number
    guardrailsChars: number
    activeWorldSliceChars: number
    storyAssetsChars: number
    consensusChars: number
    memoryChars: number
    ledgerChars: number
    ragChars: number
  }
  segmentCount: number
  segmentationSource: "scene_card" | "timeline"
}

export interface DraftSegmentArtifactInfo {
  path: string
  relativePath: string
  segmentIndex: number
  segmentTotal: number
  source: "scene_card" | "timeline"
  chars: number
  manifestPath: string
  manifestRelativePath: string
  subArtifacts: DraftSegmentSubArtifactInfo[]
}

export interface NaturalnessReport {
  status: "passed" | "needs_revision" | "blocked"
  score: number
  reason: string
  changedBlocks: number
  riskFlags: string[]
  preservedFacts: string[]
  semanticPreservation: SemanticPreservationReport
  patchSummary: string[]
}

export interface SemanticPreservationReport {
  status: "preserved" | "at_risk" | "drifted"
  missingFacts: string[]
  changedFacts: string[]
  preservedFacts: string[]
  reason: string
}

export interface StyleConformanceDriftReport {
  status: "conformant" | "warning" | "drifted" | "pending"
  conformanceScore: number
  driftScore: number
  score: number
  reason: string
  evidence: string[]
  risks: string[]
  metrics: {
    bodyChars: number
    contractRuleCount: number
    matchedRuleCount: number
    approvedSampleOverlap: number
    positiveExampleHitCount: number
    allowedDeviceHitCount: number
    forbiddenHitCount: number
    narrativeStyleStatus: ReturnType<typeof evaluateNarrativeStyleQuality>["status"]
    averageSentenceLength: number
    dialogueRatio: number
  }
  forbiddenHits: Array<{ pattern: string; count: number; evidence: string[] }>
  matchedContractRules: string[]
  missingContractRules: string[]
  checkedAt: string
}

function currentBundleDir() {
  const stack = new Error().stack || ""
  for (const line of stack.split("\n")) {
    const fileUrlMatch = line.match(/\(?file:\/\/([^):]+):\d+:\d+\)?/)
    if (fileUrlMatch) {
      return path.dirname(decodeURIComponent(fileUrlMatch[1]))
    }
    const fileMatch = line.match(/\((\/[^():]+):\d+:\d+\)/) || line.match(/at (\/[^():]+):\d+:\d+/)
    if (fileMatch) {
      return path.dirname(fileMatch[1])
    }
  }
  return process.cwd()
}

function workspaceRootForProject(projectRoot: string) {
  const marker = `${path.sep}.ai-novel-projects${path.sep}`
  const index = projectRoot.indexOf(marker)
  if (index >= 0) {
    return projectRoot.slice(0, index)
  }
  return projectRoot
}

async function readOptionalText(filePath: string) {
  try {
    return (await fs.readFile(filePath, "utf8")).trim()
  } catch {
    return ""
  }
}

async function readCharacterDossiers(filePath?: string): Promise<CharacterDossier[]> {
  if (!filePath) return []
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, "utf8"))
    return Array.isArray(parsed) ? parsed.filter((entry): entry is CharacterDossier => (
      entry && typeof entry === "object" && typeof entry.id === "string"
    )) : []
  } catch {
    return []
  }
}

async function writeJsonFileAtomic(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${Date.now()}.tmp`)
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`)
  await fs.rename(tempPath, filePath)
}

async function writeChapterVersionManifest(input: {
  projectRoot: string
  options: ProductionPipelineOptions
  chapterId: string
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  draftPath: string
  reviewedPath: string
  finalPath: string
  reportPath: string
  memoryPath: string
  finalDraft: string
  draft: string
  finalGate: QualityGateResult
	  writingMode: ProductionWritingMode
	  aigcDetection: AigcWritingDetectionReport
	  chapterInheritanceAdapter?: ChapterInheritanceAdapterPayload | null
	  styleInheritanceVerification?: Record<string, unknown> | null
	  styleConformanceDrift?: StyleConformanceDriftReport | null
	}) {
  const now = new Date().toISOString()
  const finalWordCount = wordCount(input.finalDraft)
  const draftWordCount = wordCount(input.draft)
	  const styleDriftPassed = input.styleConformanceDrift
	    ? input.styleConformanceDrift.status === "conformant"
	    : true
	  const aigcPassed = input.aigcDetection.status === "passed"
	  const styleInheritancePassed = input.styleInheritanceVerification
	    ? String(input.styleInheritanceVerification.status || "") === "ready"
	    : true
	  const adapterPassed = input.chapterInheritanceAdapter
	    ? input.chapterInheritanceAdapter.status === "ready"
	    : true
	  const finalVersionPassed = input.finalGate.status === "passed" && styleDriftPassed && aigcPassed && styleInheritancePassed && adapterPassed
  const versions = [
    {
      id: "draft",
      label: "Draft",
      source: "draft",
      path: relativeArtifactPath(input.projectRoot, input.draftPath),
      wordCount: draftWordCount,
      status: "available",
      createdAt: now,
    },
    {
      id: "reviewed",
      label: "Reviewed",
      source: "reviewed",
      path: relativeArtifactPath(input.projectRoot, input.reviewedPath),
      wordCount: draftWordCount,
      status: "available",
      createdAt: now,
    },
    {
      id: "final",
      label: "Final",
      source: "final",
      path: relativeArtifactPath(input.projectRoot, input.finalPath),
      wordCount: finalWordCount,
      status: finalVersionPassed ? "passed" : "needs_revision",
      createdAt: now,
    },
  ]
  const manifest = {
    version: 1,
    chapterNumber: input.task.chapterNumber,
    chapterTitle: input.task.title,
    publishedVersionId: "final",
    locked: finalVersionPassed,
    status: finalVersionPassed ? "published" : "needs_review",
    writingMode: input.writingMode,
    targetWords: input.task.targetWords,
    wordCount: finalWordCount,
	    updatedAt: now,
	    qualityGate: input.finalGate,
	    aigcDetection: input.aigcDetection,
	    chapterInheritanceAdapter: input.chapterInheritanceAdapter || null,
	    styleInheritanceVerification: input.styleInheritanceVerification || null,
	    styleConformanceDrift: input.styleConformanceDrift || null,
    artifacts: {
      report: relativeArtifactPath(input.projectRoot, input.reportPath),
      memory: relativeArtifactPath(input.projectRoot, input.memoryPath),
    },
    versions,
  }
  const manifestPath = path.join(path.dirname(input.finalPath), `${input.chapterId}.versions.json`)
  await writeJsonFileAtomic(manifestPath, manifest)
  await recordPipelineArtifact(input.projectRoot, manifestPath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "chapter_version_manifest",
    publishedVersionId: manifest.publishedVersionId,
    status: manifest.status,
    locked: manifest.locked,
    versionCount: versions.length,
	    qualityGate: input.finalGate,
	    chapterInheritanceAdapter: input.chapterInheritanceAdapter || null,
	    styleInheritanceVerification: input.styleInheritanceVerification || null,
	    styleConformanceDrift: input.styleConformanceDrift || null,
	  })
  return manifestPath
}

async function fileHasContent(filePath: string) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile() && stat.size > 0
  } catch {
    return false
  }
}

async function buildChapterStyleInheritanceVerification(input: {
  paths: NovelWorkspacePaths
  approvedStyleContext: ApprovedWritingStyleContext
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  finalGate: QualityGateResult
  aigcDetection: AigcWritingDetectionReport
  styleConformanceDrift: StyleConformanceDriftReport
  extractedStyleFingerprint?: string
}) {
	  const contract = input.approvedStyleContext.contract || null
	  const approvedVersion = Number(contract?.loop?.approvalVersion || contract?.approval?.approvedVersion || 0)
	  const contractApproved = input.approvedStyleContext.status === "ready" && Boolean(contract?.approvedAt || approvedVersion)
	  const inheritanceStatus = String(contract?.inheritance?.status || "")
	  const inheritedRules = Array.isArray(contract?.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules : []
	  const inheritedArtifacts = Array.isArray(contract?.inheritance?.inheritedArtifacts) ? contract.inheritance.inheritedArtifacts : []
	  const chapterInheritanceAdapter = input.approvedStyleContext.chapterInheritanceAdapter || buildChapterInheritanceAdapterPayload(contract)
	  const adapterReady = chapterInheritanceAdapter?.status === "ready"
	  const freezerVerdict = chapterInheritanceAdapter?.freezerVerdict || contract?.freezer?.verdict || "missing"
	  const freezeAssetsReady = Boolean(contract?.approvedSample?.trim() && contract?.frozenBasePrompt?.trim() && contract?.styleContract)
  const inheritanceAssetsReady = Boolean(
    await fileHasContent(input.paths.styleRulebookPath)
      && await fileHasContent(input.paths.styleReferencesPath)
      && await fileHasContent(input.paths.styleAntiPatternsPath),
  )
  const currentFingerprint = input.extractedStyleFingerprint || ""
  const styleFingerprintReady = Boolean(
    currentFingerprint
      || (input.task.chapterNumber > 1 && contractApproved),
  )
  const aigcStatus = input.aigcDetection.status
  const highRiskCount = Array.isArray(input.aigcDetection.highRiskSegments) ? input.aigcDetection.highRiskSegments.length : 0
  const styleConformanceDrift = input.styleConformanceDrift
  const styleDriftBlocked = styleConformanceDrift.status === "drifted"
  const styleDriftWarning = styleConformanceDrift.status === "warning" || styleConformanceDrift.status === "pending"
  const evidence = [
    contractApproved
      ? approvedVersion > 0
        ? `整书写法合同已冻结为 v${approvedVersion}`
        : "整书写法合同已冻结"
      : "",
	    inheritanceStatus === "enforced" ? "章节继承链已标记为 enforced" : "",
	    adapterReady ? "Chapter Inheritance Adapter 已绑定冻结合同、Freezer 与验证证据" : "",
	    freezerVerdict === "ready" ? "Style Contract Freezer 已 ready" : "",
	    freezeAssetsReady ? "冻结写法合同、基础 prompt 与 style contract 已存在" : "",
    inheritanceAssetsReady ? "style/rulebook、references、anti-patterns 已同步到章节资产" : "",
    input.finalGate.status === "passed" ? "本章质量门已通过" : "",
    aigcStatus === "passed" ? "本章 AIGC 检测已通过" : "",
    styleFingerprintReady ? "章节写法已有可追踪继承参照" : "",
    styleConformanceDrift.status === "conformant" ? styleConformanceDrift.reason : "",
    ...styleConformanceDrift.evidence.slice(0, 5),
  ].filter(Boolean)
  const risks = [
	    !contractApproved ? "整书写法合同尚未冻结。" : "",
	    contractApproved && inheritanceStatus !== "enforced" ? `写法继承状态仍为 ${inheritanceStatus || "pending"}。` : "",
	    !adapterReady ? "Chapter Inheritance Adapter 尚未 ready，冻结合同不能作为章节硬基线。" : "",
	    freezerVerdict !== "ready" ? `Style Contract Freezer verdict 为 ${freezerVerdict}。` : "",
	    !freezeAssetsReady ? "冻结写法合同资产不完整。" : "",
    !inheritanceAssetsReady ? "章节继承资产未完全同步。" : "",
    input.finalGate.status === "blocked" ? `质量门阻塞：${input.finalGate.reason}` : "",
    aigcStatus === "blocked" ? `AIGC 检测阻塞：${highRiskCount} 个高风险片段。` : "",
    aigcStatus === "unavailable" || aigcStatus === "skipped" ? `AIGC 检测状态为 ${aigcStatus}：${input.aigcDetection.reason}` : "",
    !styleFingerprintReady ? "章节写法继承参照尚不完整。" : "",
    styleDriftBlocked || styleDriftWarning
      ? styleConformanceDrift.reason
      : "",
    ...styleConformanceDrift.risks.slice(0, 5),
  ].filter(Boolean)
  let status: "ready" | "warning" | "blocked" | "pending" = "ready"
  if (!contractApproved) {
    status = "pending"
  } else if (
	    inheritanceStatus !== "enforced"
	    || !adapterReady
	    || input.finalGate.status === "blocked"
    || aigcStatus === "blocked"
    || styleDriftBlocked
  ) {
    status = "blocked"
  } else if (
    !freezeAssetsReady
    || !inheritanceAssetsReady
    || !styleFingerprintReady
    || aigcStatus !== "passed"
    || styleDriftWarning
  ) {
    status = "warning"
  }
  const summary = status === "ready"
    ? "本章已继承冻结写法合同，并通过质量门、AIGC 与风格漂移生产验证。"
    : status === "warning"
      ? "本章已接入冻结写法合同，但仍有风格继承证据或漂移风险需要补强。"
      : status === "blocked"
        ? "本章写法继承验证未放行，需先处理阻塞项。"
        : "本章还没有可确认的冻结写法合同继承基线。"

  return {
    status,
    summary,
    chapterNumber: input.task.chapterNumber,
    contractVersion: approvedVersion,
    contractApproved,
    approvedAt: String(contract?.approvedAt || contract?.approval?.approvedAt || ""),
	    inheritanceStatus,
	    chapterInheritanceAdapter,
	    adapterReady,
	    freezerVerdict,
	    inheritedRuleCount: inheritedRules.length,
    inheritedArtifactCount: inheritedArtifacts.length,
    freezeAssetsReady,
    inheritanceAssetsReady,
    styleFingerprintReady,
    styleFingerprint: currentFingerprint,
    styleConformanceDrift,
    styleDrift: {
      status: styleConformanceDrift.status,
      conformanceScore: Math.round(styleConformanceDrift.conformanceScore * 10),
      driftScore: Math.round(styleConformanceDrift.driftScore * 10),
      threshold: 72,
      rawConformanceScore: styleConformanceDrift.conformanceScore,
      rawDriftScore: styleConformanceDrift.driftScore,
      forbiddenHitCount: styleConformanceDrift.metrics.forbiddenHitCount,
      matchedTerms: styleConformanceDrift.matchedContractRules,
      missingTerms: styleConformanceDrift.missingContractRules,
      summary: styleConformanceDrift.reason,
    },
    qualityGateStatus: input.finalGate.status,
    qualityGateReason: input.finalGate.reason,
    aigc: {
      status: aigcStatus,
      score: input.aigcDetection.score,
      threshold: input.aigcDetection.threshold,
      highRiskCount,
      reason: input.aigcDetection.reason,
    },
    verificationStatus: String(contract?.verification?.status || contract?.loop?.verificationStatus || ""),
    verificationSummary: String(contract?.verification?.summary || contract?.loop?.verificationSummary || ""),
    checkedAt: new Date().toISOString(),
    evidence,
    risks,
  }
}

const STYLE_CONFORMANCE_STOPWORDS = new Set([
  "一个", "一种", "这一", "这个", "这些", "那些", "必须", "不得", "不要", "不能", "应该", "保持", "后续", "章节",
  "正文", "写法", "风格", "合同", "规则", "用户", "确认", "冻结", "全书", "样段", "文本", "进行", "通过",
  "需要", "避免", "减少", "增加", "呈现", "使用", "推动", "不要写", "不得写",
])

function roundStyleScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10))
}

function averageNarrativeSentenceLength(text = "") {
  const sentences = text
    .split(/[。！？!?；;\n]+/u)
    .map((sentence) => sentence.replace(/\s+/gu, "").trim())
    .filter(Boolean)
  if (!sentences.length) return 0
  return Math.round((sentences.reduce((sum, sentence) => sum + sentence.length, 0) / sentences.length) * 10) / 10
}

function dialogueStats(text = "") {
  const quoted = text.match(/[「“][^」”]{1,160}[」”]/gu) || []
  const colonLines = text.match(/^[\p{Script=Han}A-Za-z0-9_·]{1,12}[：:][^\n]{1,120}$/gmu) || []
  const dialogue = [...quoted, ...colonLines]
  const chars = dialogue.reduce((sum, line) => sum + line.replace(/[「」“”：:\s]/gu, "").length, 0)
  const avgLength = dialogue.length ? Math.round((chars / dialogue.length) * 10) / 10 : 0
  return {
    count: dialogue.length,
    chars,
    avgLength,
    ratio: text.length ? Math.round((chars / text.length) * 1000) / 1000 : 0,
  }
}

function extractStyleEvidenceTokens(text = "", limit = 80) {
  const normalized = text.replace(/```[\s\S]*?```/g, " ").replace(/\s+/gu, " ")
  const raw = normalized.match(/[\p{Script=Han}A-Za-z0-9]{2,8}/gu) || []
  const tokens = raw
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STYLE_CONFORMANCE_STOPWORDS.has(token))
    .filter((token) => !/^(pending|style|contract|prompt|rule|rules|chapter|voice)$/iu.test(token))
  return uniqueStrings(tokens).slice(0, limit)
}

function styleEvidenceWindow(text: string, token: string, limit = 90) {
  const compactToken = token.trim()
  if (!compactToken) return ""
  const index = text.indexOf(compactToken)
  if (index < 0) return ""
  const start = Math.max(0, index - 36)
  const end = Math.min(text.length, index + compactToken.length + 36)
  return conciseEvidence(text.slice(start, end), limit)
}

function countLiteralPatternHits(text: string, pattern: string) {
  const normalized = pattern.trim()
  if (!normalized || normalized.length < 2) return 0
  const escaped = escapeRegExpLiteral(normalized)
  return (text.match(new RegExp(escaped, "gu")) || []).length
}

function collectForbiddenStyleHits(text: string, patterns: string[] = []) {
  return uniqueStrings(patterns)
    .map((pattern) => {
      const literalCount = countLiteralPatternHits(text, pattern)
      const tokens = extractStyleEvidenceTokens(pattern, 8)
      const tokenHits = tokens
        .map((token) => ({ token, count: countLiteralPatternHits(text, token) }))
        .filter((hit) => hit.count > 0)
      const count = literalCount || tokenHits.reduce((sum, hit) => sum + hit.count, 0)
      const evidence = uniqueStrings([
        ...(literalCount > 0 ? [styleEvidenceWindow(text, pattern)] : []),
        ...tokenHits.map((hit) => styleEvidenceWindow(text, hit.token)),
      ].filter(Boolean)).slice(0, 3)
      return { pattern, count, evidence }
    })
    .filter((hit) => hit.count > 0)
    .slice(0, 12)
}

function styleRuleMatchesText(input: {
  rule: string
  body: string
  avgSentenceLength: number
  dialogue: ReturnType<typeof dialogueStats>
  actionSignals: number
  sensorySignals: number
  objectSignals: number
  emotionLabelSignals: number
}) {
  const rule = input.rule.trim()
  if (!rule) return false
  const tokens = extractStyleEvidenceTokens(rule, 12)
  const tokenMatches = tokens.filter((token) => input.body.includes(token))
  if (tokenMatches.length >= Math.min(2, Math.max(1, Math.ceil(tokens.length * 0.25)))) return true
  if (/短句|句子短|短促|冷感|克制|白描/u.test(rule) && input.avgSentenceLength > 0 && input.avgSentenceLength <= 24) return true
  if (/长短|错落|节奏/u.test(rule) && input.avgSentenceLength >= 10 && input.avgSentenceLength <= 34) return true
  if (/对白|对话/u.test(rule)) {
    if (/短|压力|留白|不解释|少解释/u.test(rule)) {
      return input.dialogue.count > 0 && (input.dialogue.avgLength === 0 || input.dialogue.avgLength <= 34)
    }
    return input.dialogue.count > 0
  }
  if (/动作|物件|器物|声音|感官|身体|场景|细节|白描/u.test(rule)) {
    return input.actionSignals + input.sensorySignals + input.objectSignals >= 8
  }
  if (/情绪|克制|外化|不解释|少解释/u.test(rule)) {
    return input.actionSignals >= Math.max(3, input.emotionLabelSignals)
  }
  if (/视角|POV|主角|第三人称|第一人称/iu.test(rule)) {
    return input.body.length >= 120
  }
  return false
}

export function evaluateChapterStyleConformanceDrift(input: {
  approvedStyleContext: ApprovedWritingStyleContext
  chapterText: string
  extractedStyleFingerprint?: string
}): StyleConformanceDriftReport {
  const contract = input.approvedStyleContext.contract
  const style = contract?.styleContract
  const body = extractNarrativeBody(input.chapterText)
  const checkedAt = new Date().toISOString()
  const styleQuality = evaluateNarrativeStyleQuality(body)
  const bodyChars = body.trim().length
  if (input.approvedStyleContext.status !== "ready" || !contract?.approvedAt || !style) {
    return {
      status: "pending",
      conformanceScore: 0,
      driftScore: 10,
      score: 0,
      reason: "风格漂移评分待定：缺少已冻结并获批的 style contract，无法计算真实继承基线。",
      evidence: [],
      risks: ["缺少可评分的 frozen style contract。"],
      metrics: {
        bodyChars,
        contractRuleCount: 0,
        matchedRuleCount: 0,
        approvedSampleOverlap: 0,
        positiveExampleHitCount: 0,
        allowedDeviceHitCount: 0,
        forbiddenHitCount: 0,
        narrativeStyleStatus: styleQuality.status,
        averageSentenceLength: averageNarrativeSentenceLength(body),
        dialogueRatio: dialogueStats(body).ratio,
      },
      forbiddenHits: [],
      matchedContractRules: [],
      missingContractRules: [],
      checkedAt,
    }
  }

  const avgSentenceLength = averageNarrativeSentenceLength(body)
  const dialogue = dialogueStats(body)
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|写|敲|拦|避|追|停|跪|坐|起|握|松|咬|皱眉|沉默/gu) || []).length
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软|烫|凉|光|影/gu) || []).length
  const objectSignals = (body.match(/账册|账本|密信|官印|印章|钥匙|玉佩|粮袋|银钱|文书|案卷|药包|伤口|马车|城门|坊门|县衙|市集|粮仓|名单|证据|刀|剑|灯|门|桌|碗|纸|窗|袖/gu) || []).length
  const emotionLabelSignals = (body.match(/愤怒|悲伤|恐惧|绝望|震惊|激动|开心|难过|复杂|崩溃|释然|痛苦|焦虑/gu) || []).length
  const ruleCandidates = uniqueStrings([
    style.voice || "",
    style.sentenceRhythm || "",
    ...(style.dialogueRules || []),
    ...(style.descriptionRules || []),
    ...(style.emotionRules || []),
    ...(style.pacingRules || []),
    ...(style.povRules || []),
    ...(style.openingRules || []),
    ...(style.endingHookRules || []),
  ]).filter((rule) => !isPlaceholderProfileText(rule))
  const matchedContractRules = ruleCandidates.filter((rule) => styleRuleMatchesText({
    rule,
    body,
    avgSentenceLength,
    dialogue,
    actionSignals,
    sensorySignals,
    objectSignals,
    emotionLabelSignals,
  })).slice(0, 16)
  const missingContractRules = ruleCandidates
    .filter((rule) => !matchedContractRules.includes(rule))
    .slice(0, 16)
  const approvedSampleTokens = extractStyleEvidenceTokens(contract.approvedSample || "", 80)
  const approvedSampleMatched = approvedSampleTokens.filter((token) => body.includes(token))
  const approvedSampleOverlap = approvedSampleTokens.length
    ? Math.round((approvedSampleMatched.length / approvedSampleTokens.length) * 1000) / 1000
    : 0
  const positiveExamples = style.positiveExamples || []
  const positiveExampleHits = positiveExamples.filter((example) =>
    extractStyleEvidenceTokens(example, 12).some((token) => body.includes(token))
  )
  const allowedDevices = style.allowedDevices || []
  const allowedDeviceHits = allowedDevices.filter((device) =>
    extractStyleEvidenceTokens(device, 8).some((token) => body.includes(token))
  )
  const forbiddenHits = collectForbiddenStyleHits(body, [
    ...(style.forbiddenPatterns || []),
    ...(style.negativeExamples || []),
    ...(contract.antiPatterns || []),
  ])
  const forbiddenHitCount = forbiddenHits.reduce((sum, hit) => sum + hit.count, 0)
  const ruleRatio = ruleCandidates.length ? matchedContractRules.length / ruleCandidates.length : 0
  const styleQualityPenalty = styleQuality.status === "quarantined" ? 1.6 : 0
  const forbiddenPenalty = Math.min(4, forbiddenHitCount * 1.15)
  const sampleScore = approvedSampleTokens.length ? Math.min(1.4, approvedSampleOverlap * 3.2) : 0.4
  const positiveScore = Math.min(1.2, (positiveExampleHits.length + allowedDeviceHits.length) * 0.35)
  const signalScore = Math.min(1.2, (actionSignals + sensorySignals + objectSignals) / 26)
  const ruleScore = ruleCandidates.length ? ruleRatio * 6.2 : 3
  const conformanceScore = roundStyleScore(ruleScore + sampleScore + positiveScore + signalScore - forbiddenPenalty - styleQualityPenalty)
  const driftScore = roundStyleScore(10 - conformanceScore)
  const risks = [
    ...(missingContractRules.length ? [`合同规则缺少正文证据：${missingContractRules.slice(0, 4).map((rule) => conciseEvidence(rule, 64)).join("；")}`] : []),
    ...(forbiddenHits.length ? [`命中冻结禁忌模式：${forbiddenHits.slice(0, 4).map((hit) => `${hit.pattern}(${hit.count})`).join("；")}`] : []),
    ...(styleQuality.status === "quarantined" ? [styleQuality.reason] : []),
    ...(approvedSampleTokens.length && approvedSampleOverlap < 0.08 ? ["与 approved sample 的可复核风格 token 重叠偏低。"] : []),
    ...(dialogue.count === 0 && /对白|对话/u.test(ruleCandidates.join("\n")) ? ["合同要求对白质感，但正文未检测到对白。"] : []),
  ].slice(0, 10)
  const evidence = uniqueStrings([
    matchedContractRules.length ? `命中合同规则 ${matchedContractRules.length}/${Math.max(1, ruleCandidates.length)}：${matchedContractRules.slice(0, 4).map((rule) => conciseEvidence(rule, 64)).join("；")}` : "",
    approvedSampleMatched.length ? `approved sample token 命中：${approvedSampleMatched.slice(0, 8).join("、")}` : "",
    positiveExampleHits.length ? `正例/允许装置命中 ${positiveExampleHits.length + allowedDeviceHits.length} 项。` : "",
    `句长均值 ${avgSentenceLength}；对白 ${dialogue.count} 段；动作/感官/物件信号 ${actionSignals}/${sensorySignals}/${objectSignals}。`,
    input.extractedStyleFingerprint ? `当前章节风格指纹：${conciseEvidence(input.extractedStyleFingerprint, 120)}` : "",
    styleQuality.status === "eligible" ? styleQuality.reason : "",
  ].filter(Boolean)).slice(0, 10)
  const status = conformanceScore >= 7.2 && risks.length === 0
    ? "conformant"
    : conformanceScore < 5.8 || forbiddenHitCount >= 2 || styleQuality.status === "quarantined"
      ? "drifted"
      : "warning"

  return {
    status,
    conformanceScore,
    driftScore,
    score: conformanceScore,
    reason: status === "conformant"
      ? `风格继承评分通过：conformance=${conformanceScore}/10，drift=${driftScore}/10，正文证据覆盖冻结合同且未命中禁忌。`
      : status === "warning"
        ? `风格继承评分预警：conformance=${conformanceScore}/10，drift=${driftScore}/10，存在可修复的继承证据缺口。`
        : `风格漂移评分阻塞：conformance=${conformanceScore}/10，drift=${driftScore}/10，正文证据显示偏离冻结合同。`,
    evidence,
    risks,
    metrics: {
      bodyChars,
      contractRuleCount: ruleCandidates.length,
      matchedRuleCount: matchedContractRules.length,
      approvedSampleOverlap,
      positiveExampleHitCount: positiveExampleHits.length,
      allowedDeviceHitCount: allowedDeviceHits.length,
      forbiddenHitCount,
      narrativeStyleStatus: styleQuality.status,
      averageSentenceLength: avgSentenceLength,
      dialogueRatio: dialogue.ratio,
    },
    forbiddenHits,
    matchedContractRules,
    missingContractRules,
    checkedAt,
  }
}

function formatStyleConformanceDriftReport(report: StyleConformanceDriftReport) {
  return [
    "## Style Conformance Drift",
    `- Status: ${report.status}`,
    `- Conformance score: ${report.conformanceScore}/10`,
    `- Drift score: ${report.driftScore}/10`,
    `- Reason: ${report.reason}`,
    `- Contract rule evidence: ${report.metrics.matchedRuleCount}/${report.metrics.contractRuleCount}`,
    `- Approved sample overlap: ${report.metrics.approvedSampleOverlap}`,
    `- Forbidden hits: ${report.metrics.forbiddenHitCount}`,
    report.evidence.length ? "### Evidence" : "",
    ...report.evidence.map((item) => `- ${item}`),
    report.risks.length ? "### Risks" : "",
    ...report.risks.map((item) => `- ${item}`),
  ].filter(Boolean).join("\n")
}

function compactList(values: string[] = [], limit = 3) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join("; ") || "pending"
}

function clipPromptSection(value = "", maxLength = 800) {
  const normalized = value.trim()
  if (normalized.length <= maxLength) {
    return normalized
  }
  return `${normalized.slice(0, maxLength).trimEnd()}\n...[prompt section clipped; full text saved in chapter context package]`
}

function summarizePromptSection(value = "", maxLength = 700) {
  const normalized = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
  return clipPromptSection(normalized, maxLength)
}

function escapeRegExpLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function summarizeCharacterDossiers(dossiers: CharacterDossier[] = [], limit = 6) {
  return dossiers.slice(0, limit).map((dossier) => [
    `- ${dossier.id} (${dossier.role}) name=${dossier.canonicalName}`,
    `  identity=${dossier.identityAndRole}`,
    `  desire=${dossier.coreDesire}; wound=${dossier.fearOrWound}`,
    `  habits=${compactList(dossier.behaviorHabits)}; speech=${compactList(dossier.speechMarkers)}`,
    `  body=${dossier.appearanceAndBody}`,
    `  skills=${compactList(dossier.skills)}; limits=${compactList(dossier.limitations)}`,
    `  relation=${dossier.relationshipState}; delta=${dossier.currentChapterDelta}`,
    `  evidence=${compactList(dossier.evidence.slice(-2), 2)}`,
  ].join("\n")).join("\n")
}

function formatCharacterDossiersMarkdown(dossiers: CharacterDossier[]) {
  return [
    "# Character Dossiers",
    "",
    "This file is generated from the structured production character dossier state.",
    "",
    summarizeCharacterDossiers(dossiers, 12) || "- no structured dossiers available",
  ].join("\n")
}

function createCharacterRelationshipGraph(dossiers: CharacterDossier[], updatedAt = new Date().toISOString()) {
  const nodes = dossiers.map((dossier) => ({
    id: dossier.id,
    name: dossier.canonicalName,
    role: dossier.role,
    aliases: dossier.aliases || [],
    relationshipState: dossier.relationshipState,
    currentChapterDelta: dossier.currentChapterDelta,
    updatedAt: dossier.updatedAt || updatedAt,
  }))
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edges = dossiers.flatMap((dossier) => (dossier.relationshipEdges || []).map((edge) => ({
    sourceId: dossier.id,
    sourceName: dossier.canonicalName,
    targetId: edge.targetId,
    targetName: nodes.find((node) => node.id === edge.targetId)?.name || edge.targetId,
    label: edge.label,
    pressure: edge.pressure,
    status: nodeIds.has(edge.targetId) ? "linked" : "unresolved",
    updatedAt: dossier.updatedAt || updatedAt,
  })))
  return {
    version: 1,
    updatedAt,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
  }
}

function formatCharacterRelationshipGraphMarkdown(graph: ReturnType<typeof createCharacterRelationshipGraph>) {
  return [
    "# Character Relationship Graph",
    "",
    `Updated at: ${graph.updatedAt}`,
    "",
    "## Nodes",
    ...(graph.nodes.length
      ? graph.nodes.slice(0, 24).map((node) =>
        `- ${node.id} (${node.role}) ${node.name}: ${node.relationshipState || "relationship pending"}`
      )
      : ["- no character nodes available"]),
    "",
    "## Edges",
    ...(graph.edges.length
      ? graph.edges.slice(0, 48).map((edge) =>
        `- ${edge.sourceId} -> ${edge.targetId}: ${edge.label}; pressure: ${edge.pressure}; status: ${edge.status}`
      )
      : ["- no relationship edges available"]),
  ].join("\n")
}

function appendUnique(values: string[], next: string, limit = 8) {
  const normalized = next.trim()
  if (!normalized) return values.slice(0, limit)
  return [...values.filter((value) => value !== normalized), normalized].slice(-limit)
}

function isPlaceholderProfileText(value = "") {
  return !value.trim()
    || /\bpending\b|待定|暂无|requires .*enrichment|needs .*enrichment|inferred from future scenes|must be tracked|must carry|must reveal|must change/iu.test(value)
}

function isPlaceholderProfileList(values: string[] = []) {
  return values.length === 0 || values.every((value) => isPlaceholderProfileText(value))
}

function conciseEvidence(value: string, limit = 140) {
  return value
    .replace(/^#+\s*/u, "")
    .replace(/^[-*]\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, limit)
}

function extractCharacterEvidenceWindows(text: string, names: string[], limit = 8) {
  const usableNames = uniqueStrings(names.filter((name) => name && !/^pending-/iu.test(name)))
  const lines = text
    .split(/\n+/u)
    .map((line) => conciseEvidence(line, 220))
    .filter(Boolean)
    .filter((line) => !/^Drafting Metadata|Naturalness Report|Character Profile Projection$/iu.test(line))
  if (!usableNames.length) {
    return lines.slice(0, limit)
  }
  const namePattern = new RegExp(usableNames.map(escapeRegExpLiteral).join("|"), "u")
  const direct = lines.filter((line) => namePattern.test(line))
  const profileSignals = lines.filter((line) => /主角|人物|角色|关系|选择|欲望|伤口|习惯|说话|外貌|体态|特长|短板|停顿|立场|能力|线索/u.test(line))
  return uniqueStrings([...direct, ...profileSignals]).slice(0, limit)
}

function firstEvidenceMatching(windows: string[], pattern: RegExp) {
  return windows.find((window) => pattern.test(window)) || ""
}

function updateProfileListFromSignal(values: string[], signal: string, limit = 8) {
  if (!signal) return values.slice(0, limit)
  return isPlaceholderProfileList(values)
    ? [signal]
    : appendUnique(values, signal, limit)
}

function enrichRelationshipEdges(
  edges: CharacterDossier["relationshipEdges"],
  relationshipPressure: string,
  protagonistName: string,
) {
  if (!relationshipPressure) return edges
  if (!edges.length) {
    return [{
      targetId: "protagonist",
      label: protagonistName ? `pressure around ${protagonistName}` : "relationship pressure",
      pressure: relationshipPressure,
    }]
  }
  return edges.map((edge, index) => (
    index === 0 && isPlaceholderProfileText(edge.pressure)
      ? { ...edge, pressure: relationshipPressure }
      : edge
  ))
}

function extractCharacterProfileSignals(input: {
  dossier: CharacterDossier
  text: string
  chapterLabel: string
  causalPlan: ReturnType<typeof getTaskCausalPlan>
  protagonistName: string
}) {
  const windows = extractCharacterEvidenceWindows(input.text, [
    input.dossier.canonicalName,
    ...input.dossier.aliases,
    input.dossier.role === "protagonist" ? input.protagonistName : "",
  ])
  const action = firstEvidenceMatching(windows, /选择|处理|抓住|判断|反击|停顿|回避|试探|压|藏|递|推|看|听|握|抬|低|转|拦|走|拿|放/u)
  const speech = firstEvidenceMatching(windows, /「|」|说|问|道|低声|称呼|话|停顿/u)
  const body = firstEvidenceMatching(windows, /眼|手|腕|指|肩|背|袖|脚|身|体|体态|看见|触感|声音|反应|姿态|站|退/u)
  const relation = firstEvidenceMatching(windows, /关系|对方|别人|有人|信任|债|债务|压力|试探|回避|立场|要求|逼|冲突|配角|主角/u)
  const skill = firstEvidenceMatching(windows, /判断|抓住|线索|反击|处理|策略|推理|能力|规则|账|田册|官印|密信/u)
  const limit = firstEvidenceMatching(windows, /不完美|代价|压力|逼|不能|风险|恐惧|弱点|伤口|问题/u)
  return {
    desire: `${input.chapterLabel}: pursues the scene objective: ${input.causalPlan.sceneObjective}`,
    wound: limit
      ? `${input.chapterLabel}: pressure signal: ${conciseEvidence(limit)}`
      : `${input.chapterLabel}: pressure is tied to ${input.causalPlan.previousInput}`,
    contradiction: `${input.chapterLabel}: chooses under pressure: ${input.causalPlan.protagonistDecision}`,
    habit: `${input.chapterLabel}: ${conciseEvidence(action || input.causalPlan.protagonistDecision)}`,
    speech: `${input.chapterLabel}: ${conciseEvidence(speech || "speech pressure must follow the character's current relationship and choice")}`,
    body: `${input.chapterLabel}: ${conciseEvidence(body || "visible body marker must be carried through action and scene pressure")}`,
    skill: `${input.chapterLabel}: ${conciseEvidence(skill || input.causalPlan.sceneObjective)}`,
    limitation: `${input.chapterLabel}: ${conciseEvidence(limit || input.causalPlan.irreversibleConsequence)}`,
    relationship: relation
      ? `${input.chapterLabel}: ${conciseEvidence(relation)}`
      : `${input.chapterLabel}: relationship pressure follows ${input.causalPlan.characterStateDelta}`,
    arc: `${input.chapterLabel}: ${input.causalPlan.nextHandoff}`,
    evidence: windows[0] ? `${input.chapterLabel} profile signal: ${conciseEvidence(windows[0], 180)}` : "",
  }
}

function updateCharacterDossiersAfterChapter(input: {
  dossiers: CharacterDossier[]
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  finalDraft: string
  memoryUpdate: string
  continuityContract: ContinuityContract
  updatedAt?: string
}) {
  const updatedAt = input.updatedAt || new Date().toISOString()
  const knownCast = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.knownCast,
    ...extractChinesePersonNames(input.finalDraft, 12),
  ].filter(Boolean))
  const protagonistName = input.continuityContract.lockedProtagonistName || knownCast[0] || ""
  const chapterLabel = `chapter ${input.task.chapterNumber}`
  const causalPlan = getTaskCausalPlan(input.state, input.task)
  const chapterDelta = `${chapterLabel}: ${causalPlan.characterStateDelta}`
  const evidence = `${chapterLabel}: ${input.finalDraft.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join(" ").slice(0, 180)}`
  const continuityNote = `${chapterLabel}: ${input.continuityContract.continuityAnchors.slice(0, 4).join("、") || "new continuity anchors pending"}`
  const dossiers = input.dossiers.length ? input.dossiers : []
  const nextDossiers = dossiers.map((dossier) => {
    const isProtagonist = dossier.role === "protagonist" || dossier.id === "protagonist"
    const isKnownCast = knownCast.some((name) => name && (dossier.canonicalName === name || dossier.aliases.includes(name)))
    if (!isProtagonist && !isKnownCast) return dossier
    const canonicalName = isProtagonist && protagonistName && dossier.canonicalName.startsWith("pending-")
      ? protagonistName
      : dossier.canonicalName
    const aliases = uniqueStrings([
      ...dossier.aliases,
      ...(isProtagonist && protagonistName ? [protagonistName] : []),
    ]).slice(0, 8)
    const profileSignals = extractCharacterProfileSignals({
      dossier: { ...dossier, canonicalName, aliases },
      text: `${input.finalDraft}\n\n${input.memoryUpdate}`,
      chapterLabel,
      causalPlan,
      protagonistName,
    })
    return {
      ...dossier,
      canonicalName,
      aliases,
      coreDesire: isPlaceholderProfileText(dossier.coreDesire) ? profileSignals.desire : dossier.coreDesire,
      fearOrWound: isPlaceholderProfileText(dossier.fearOrWound) ? profileSignals.wound : dossier.fearOrWound,
      contradiction: isPlaceholderProfileText(dossier.contradiction) ? profileSignals.contradiction : dossier.contradiction,
      behaviorHabits: updateProfileListFromSignal(dossier.behaviorHabits, profileSignals.habit),
      speechMarkers: updateProfileListFromSignal(dossier.speechMarkers, profileSignals.speech),
      appearanceAndBody: isPlaceholderProfileText(dossier.appearanceAndBody) && profileSignals.body ? profileSignals.body : dossier.appearanceAndBody,
      skills: updateProfileListFromSignal(dossier.skills, profileSignals.skill),
      limitations: updateProfileListFromSignal(dossier.limitations, profileSignals.limitation),
      relationshipState: isPlaceholderProfileText(dossier.relationshipState) ? profileSignals.relationship : dossier.relationshipState,
      relationshipEdges: enrichRelationshipEdges(dossier.relationshipEdges, profileSignals.relationship, protagonistName),
      arcTrajectory: isPlaceholderProfileText(dossier.arcTrajectory) ? profileSignals.arc : dossier.arcTrajectory,
      currentChapterDelta: chapterDelta,
      continuityNotes: appendUnique(dossier.continuityNotes, continuityNote),
      evidence: appendUnique(appendUnique(dossier.evidence, evidence), profileSignals.evidence),
      updatedAt,
    }
  })
  const existingIds = new Set(nextDossiers.map((dossier) => dossier.id))
  for (const name of knownCast.slice(0, 8)) {
    if (!name || nextDossiers.some((dossier) => dossier.canonicalName === name || dossier.aliases.includes(name))) continue
    const id = `supporting-${name.replace(/[^\p{Script=Han}A-Za-z0-9_-]+/gu, "-").replace(/^-+|-+$/g, "") || nextDossiers.length + 1}`
    if (existingIds.has(id)) continue
    existingIds.add(id)
    nextDossiers.push({
      id,
      role: "supporting",
      canonicalName: name,
      aliases: [name],
      identityAndRole: `Supporting cast member observed in ${chapterLabel}; role function requires Memory Keeper enrichment.`,
      coreDesire: "pending desire inferred from future scenes",
      fearOrWound: "pending wound inferred from future scenes",
      contradiction: "pending contradiction inferred from future scenes",
      behaviorHabits: ["pending observed habit"],
      speechMarkers: ["pending speech marker"],
      appearanceAndBody: "pending visible marker",
      skills: ["pending competence"],
      limitations: ["pending limitation"],
      relationshipState: `Observed around ${input.continuityContract.lockedProtagonistName || "the protagonist"} in ${chapterLabel}; relationship pressure pending.`,
      relationshipEdges: [{ targetId: "protagonist", label: "observed with", pressure: "needs relationship pressure enrichment" }],
      arcTrajectory: "pending recurring function",
      currentChapterDelta: chapterDelta,
      continuityNotes: [continuityNote],
      evidence: [evidence],
      updatedAt,
    })
  }
  return nextDossiers
}

function relativeArtifactPath(projectRoot: string, absolutePath: string) {
  return path.relative(projectRoot, absolutePath).replaceAll(path.sep, "/")
}

function wordCount(text: string) {
  const chineseChars = text.match(/[\u4e00-\u9fff]/gu)?.length ?? 0
  const asciiWords = text.match(/[A-Za-z0-9]+/g)?.length ?? 0
  return chineseChars + asciiWords
}

function createWritingMessageId(progress: {
  step: string
  role: WritingProgressEvent["role"]
  chapterNumber?: number
  namespace?: string
}) {
  const chapter = progress.chapterNumber ?? "all"
  const step = progress.step.replace(/[^a-zA-Z0-9_-]+/g, "-")
  const role = progress.role.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const namespace = progress.namespace
    ? progress.namespace.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72)
    : ""
  const suffix = namespace || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `writing-${chapter}-${step}-${role}-${suffix}`
}

function isLlmWritingStep(step = "") {
  return /_llm_(started|streaming|completed|failed)$/u.test(step)
}

function stableWritingMessageId(payload: WritingProgressEvent) {
  if (payload.messageId) {
    return payload.messageId
  }
  if (isLlmWritingStep(payload.step)) {
    return createWritingMessageId({
      step: payload.step.replace(/_llm_(started|streaming|completed|failed)$/u, ""),
      role: payload.role,
      chapterNumber: payload.chapterNumber,
      namespace: payload.directorCommandId,
    })
  }
  return createWritingMessageId({
    step: payload.step || "progress",
    role: payload.role,
    chapterNumber: payload.chapterNumber,
    namespace: payload.directorCommandId,
  })
}

function writingMessageStatus(payload: WritingProgressEvent): MessageStatus {
  if (payload.status === "blocked") return "failed"
  if (isLlmWritingStep(payload.step) && (payload.status === "running" || payload.status === "started")) return "streaming"
  return "completed"
}

function inferWritingPhase(payload: WritingProgressEvent) {
  if (payload.phase) return payload.phase
  if (/_llm_started$/u.test(payload.step)) return "request_sent"
  if (/_llm_streaming$/u.test(payload.step)) return "streaming"
  if (/_llm_completed$/u.test(payload.step)) return "completed"
  if (/_llm_failed$/u.test(payload.step)) return "failed"
  if (payload.status === "running" || payload.status === "started") return "running"
  if (payload.status === "blocked") return "failed"
  return payload.status || "completed"
}

function defaultWritingStatusText(payload: WritingProgressEvent) {
  if (payload.statusText) return payload.statusText
  const phase = inferWritingPhase(payload)
  const isLlmStep = isLlmWritingStep(payload.step)
  if (phase === "request_sent") return "请求已提交给 LLM，等待模型开始响应。"
  if (phase === "response_started") return "LLM 已开始响应，正在返回首段内容。"
  if (phase === "streaming") return "LLM 正在持续返回内容。"
  if (phase === "completed") return isLlmStep ? "LLM 返回完成，内容已保存并进入下一步。" : "当前步骤已完成，结果已保存。"
  if (phase === "failed") return isLlmStep ? "LLM 请求失败，系统会按任务策略处理。" : "当前步骤失败，系统会按任务策略处理。"
  if (phase === "running") return "Agent 正在执行当前步骤。"
  return ""
}

function writingProgressContent(payload: WritingProgressEvent) {
  const knowledgeReferences = Array.isArray(payload.knowledgeReferences) ? payload.knowledgeReferences : []
  const knowledgeLine = knowledgeReferences.length
    ? `\n\n知识库召回：${knowledgeReferences.length} 个片段\n${knowledgeReferences.slice(0, 5).map((item) =>
      `- ${item.sourceType || "resource"} · ${item.chunkType || "chunk"} · ${item.sourcePath || item.sourceTitle || item.chunkId} · ${Number(item.score || 0).toFixed(1)}`,
    ).join("\n")}`
    : ""
  if (isLlmWritingStep(payload.step)) {
    const chapterLabel = payload.chapterNumber ? `第 ${payload.chapterNumber} 章` : "写作流水线"
    const stepLabel = payload.step.replace(/_llm_(started|streaming|completed|failed)$/u, "")
    const body = (payload.streamText || payload.preview || "").trim()
    const statusText = defaultWritingStatusText(payload)
    const statusDetail = payload.statusDetail?.trim()
    const metadata: string[] = []
    if (payload.wordCount) {
      metadata.push(`估算字数：${payload.wordCount}`)
    }
    if (payload.qualityGate?.status) {
      metadata.push(`质量门禁：${payload.qualityGate.status}${payload.qualityGate.score != null ? `，${payload.qualityGate.score}/10` : ""}`)
    }
    return [
      `### ${chapterLabel} · ${stepLabel}`,
      "",
      payload.message || "模型正在输出正文。",
      statusText ? `\n状态：${statusText}` : "",
      statusDetail ? `\n${statusDetail}` : "",
      knowledgeLine,
      body ? `\n${body}\n` : "",
      metadata.length ? `\n---\n${metadata.map((line) => `- ${line}`).join("\n")}` : "",
    ].filter(Boolean).join("\n").trim()
  }
  const chapterLabel = payload.chapterNumber ? `第 ${payload.chapterNumber} 章` : "写作流水线"
  const statusLabel = payload.status ? ` · ${payload.status}` : ""
  const artifactLine = payload.artifactPath ? `\n\n产物：${payload.artifactPath}` : ""
  const qualityLine = payload.qualityGate
    ? `\n\n质量门禁：${payload.qualityGate.status}，${payload.qualityGate.score}/10。${payload.qualityGate.reason || ""}`
    : ""
  const wordLine = payload.wordCount ? `\n\n估算字数：${payload.wordCount}` : ""
  const liveText = payload.streamText || payload.preview || ""
  const previewLine = liveText ? `\n\n\`\`\`text\n${liveText.slice(-1200)}\n\`\`\`` : ""
  return [
    `### ${chapterLabel} · ${payload.step || "progress"}${statusLabel}`,
    "",
    payload.message || "写作流水线状态更新。",
    artifactLine,
    knowledgeLine,
    qualityLine,
    wordLine,
    previewLine,
  ].join("\n").trim()
}

function artifactMessageLabel(kind: string, artifactPath: string, metadata: Record<string, unknown> = {}) {
  const chapterNumber = Number(metadata.chapterNumber || 0)
  const pass = String(metadata.pass || "")
  if (kind === "chapter" && pass === "final" && chapterNumber > 0) return `第 ${chapterNumber} 章正式成稿`
  if (kind === "chapter" && pass === "draft" && chapterNumber > 0) return `第 ${chapterNumber} 章初稿`
  if (kind === "chapter" && pass === "reviewed" && chapterNumber > 0) return `第 ${chapterNumber} 章审阅稿`
  if (kind === "checkpoint" && metadata.quality && chapterNumber > 0) return `第 ${chapterNumber} 章质检报告`
  if (kind === "memory" && chapterNumber > 0) return `第 ${chapterNumber} 章记忆更新`
  if (kind === "plan" && chapterNumber > 0) return `第 ${chapterNumber} 章蓝图`
  if (kind === "plan" && /master-outline\.md$/u.test(artifactPath)) return "全书主线规划"
  if (kind === "style") return "生产写作资源"
  return artifactPath.split("/").pop() || "正式产物"
}

function artifactMessageContent(kind: string, artifactPath: string, metadata: Record<string, unknown> = {}) {
  const lines = [
    `产物类型：${kind}`,
    `路径：${artifactPath}`,
  ]
  if (metadata.chapterNumber) {
    lines.push(`章节：第 ${metadata.chapterNumber} 章`)
  }
  if (metadata.pass) {
    lines.push(`版本：${metadata.pass}`)
  }
  const qualityGate = metadata.qualityGate as { status?: string; score?: number; reason?: string } | undefined
  if (qualityGate?.status) {
    lines.push(`质量门禁：${qualityGate.status}${qualityGate.score !== undefined ? `，${qualityGate.score}/10` : ""}${qualityGate.reason ? `，${qualityGate.reason}` : ""}`)
  }
  return lines.join("\n")
}

function artifactMessageId(projectId: string, artifactPath: string) {
  const slug = `${projectId}:${artifactPath}`
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/[/.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160)
  return `artifact-${slug || "message"}`
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

function writingProgressParts(messageId: string, payload: WritingProgressEvent): MessagePart[] {
  const createdAt = payload.timestamp || new Date().toISOString()
  const parts: MessagePart[] = [
    messagePart(messageId, 0, "markdown", { text: writingProgressContent(payload) }, createdAt),
    messagePart(messageId, 1, "json", {
      step: payload.step,
      role: payload.role,
      chapterNumber: payload.chapterNumber ?? null,
      status: payload.status ?? null,
      phase: inferWritingPhase(payload),
      statusText: defaultWritingStatusText(payload),
      statusDetail: payload.statusDetail ?? null,
      wordCount: payload.wordCount ?? null,
      qualityGate: payload.qualityGate ?? null,
      knowledgeReferences: payload.knowledgeReferences ?? [],
    }, createdAt),
  ]
  if (payload.artifactPath) {
    parts.push(messagePart(messageId, parts.length, "artifact", {
      path: payload.artifactPath,
      label: artifactMessageLabel("chapter", payload.artifactPath, { chapterNumber: payload.chapterNumber }),
    }, createdAt))
  }
  return parts
}

function summarizeKnowledgeReferences(rows: Array<Record<string, unknown>> = []): WritingKnowledgeReference[] {
  return rows.slice(0, 8).map((row) => {
    const source = (row.source && typeof row.source === "object" ? row.source : {}) as Record<string, unknown>
    const sourcePath = String(source.path || row.source_path || "")
    return {
      chunkId: String(row.id || ""),
      chunkType: String(row.chunk_type || row.chunkType || ""),
      score: Number(row.score || 0),
      sourceType: String(source.sourceType || row.source_type || ""),
      sourcePath,
      sourceTitle: String(source.title || row.source_title || sourcePath || "knowledge"),
    }
  })
}

async function emitWritingKnowledgeRecallProgress(input: {
  options: ProductionPipelineOptions
  purpose: "blueprint" | "draft" | "quality" | "polish"
  role: WritingProgressEvent["role"]
  chapterNumber?: number
  title?: string
  rows: Array<Record<string, unknown>>
}) {
  const references = summarizeKnowledgeReferences(input.rows)
  await emitWritingProgress(input.options, {
    step: `${input.purpose}_knowledge_recalled`,
    role: input.role,
    chapterNumber: input.chapterNumber,
    title: input.title,
    status: "completed",
    phase: "completed",
    statusText: "知识库召回完成，结果已记录到 DB citation。",
    message: references.length
      ? `RAG 已为 ${input.purpose} 阶段召回 ${references.length} 个写作资源片段。`
      : `RAG 已为 ${input.purpose} 阶段检索知识库，但没有命中可用片段。`,
    knowledgeReferences: references,
  })
}

async function emitWritingProgress(options: ProductionPipelineOptions, event: WritingProgressEvent) {
  throwIfStopped(options.signal)
  const directorCommandId = event.directorCommandId || options.directorCommandId || undefined
  const eventWithRuntime = {
    ...event,
    ...(directorCommandId ? { directorCommandId } : {}),
  }
  const payload = {
    ...eventWithRuntime,
    messageId: stableWritingMessageId(eventWithRuntime),
    timestamp: eventWithRuntime.timestamp || new Date().toISOString(),
  }
  await options.onProgress?.(payload)
  if (options.factoryRootDir && options.projectId) {
    const { streamText, ...storedPayload } = payload
    await withFactoryDb(options.factoryRootDir, async (db) => {
      const messageId = payload.messageId as string
      const message = createAgentMessage({
        messageId,
        conversationId: `writing:${options.projectId}`,
        projectId: options.projectId as string,
        runId: options.directorCommandId ?? null,
        turnId: messageId,
        agentType: agentTypeFromLabel(payload.role),
        agentLabel: payload.role,
        content: writingProgressContent(payload),
        artifactPath: payload.artifactPath || "",
        phase: inferWritingPhase(payload),
        statusText: defaultWritingStatusText(payload),
        statusDetail: payload.statusDetail ?? "",
        status: writingMessageStatus(payload),
        time: payload.timestamp,
        metadata: {
          source: "writing_progress",
          step: payload.step,
          chapterNumber: payload.chapterNumber ?? null,
          title: payload.title ?? null,
          phase: inferWritingPhase(payload),
          statusText: defaultWritingStatusText(payload),
          statusDetail: payload.statusDetail ?? null,
          wordCount: payload.wordCount ?? null,
          qualityGate: payload.qualityGate ?? null,
          directorCommandId: payload.directorCommandId ?? null,
        },
      })
      db.recordMessage(message, writingProgressParts(messageId, payload))
      db.recordEvent(options.projectId as string, null, "WRITING_PROGRESS", {
        ...storedPayload,
        ...(streamText
          ? {
            streamTextPreview: streamText.slice(-520),
            streamTextLength: streamText.length,
          }
          : {}),
        directorCommandId: payload.directorCommandId ?? null,
      })
    }).catch(() => undefined)
  }
}

function throwIfPipelineAborted(options: ProductionPipelineOptions) {
  throwIfStopped(options.signal)
}

export function parseQualityGate(report: string, attempts = 0, maxAttempts = 3): QualityGateResult {
  const scoreMatches = [...report.matchAll(/(?:综合评分|overall|score)[^\d]{0,12}(\d{1,2})(?:\s*\/\s*10)?/giu)]
  const score = scoreMatches.length
    ? Math.max(...scoreMatches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value)))
    : report.includes("needs-manual-review") || report.includes("需要返工")
      ? 5
      : 8
  const wordMatch = report.match(/WORD_COUNT_CHECK:\s*(\d+)\s*\/\s*(\d+)/u)
  const countedWords = wordMatch ? Number(wordMatch[1]) : undefined
  const targetWords = wordMatch ? Number(wordMatch[2]) : undefined
  const hasWordCountCheck = typeof countedWords === "number"
    && Number.isFinite(countedWords)
    && typeof targetWords === "number"
    && Number.isFinite(targetWords)
  const wordCountBlockingIssue = hasWordCountCheck
    && countedWords < Math.floor(targetWords * 0.8)
  const explicitPassMarker = /(?:quality_gate|status|质量门禁|门禁状态)\s*[:：]\s*(?:passed|pass|通过)/iu.test(report)
  const explicitBlockMarker = /(?:quality_gate|status|质量门禁|门禁状态)\s*[:：]\s*(?:blocked|fail(?:ed)?|不通过|未通过|阻塞)/iu.test(report)
    || /\bneeds-manual-review\b/iu.test(report)
  const nonBlockingPhrases = [
    /暂无阻塞性问题/giu,
    /无阻塞性问题/giu,
    /没有阻塞性问题/giu,
    /未发现阻塞性问题/giu,
    /不存在阻塞性问题/giu,
    /no blocking issues/giu,
    /no blockers/giu,
    /not blocked/giu,
  ]
  const blockingScanText = nonBlockingPhrases.reduce((text, pattern) => text.replace(pattern, ""), report)
  const hasBlockingIssue = !explicitPassMarker && (
    explicitBlockMarker
    || /严重问题|必须返工|需要返工|质量不足|低于.*门槛|不能进入\s*complete|manual review|manual-review/u.test(blockingScanText)
    || /\bblocked\b/iu.test(blockingScanText)
  )
  const passed = score >= 7 && !hasBlockingIssue && !wordCountBlockingIssue
  const status = passed ? "passed" : attempts >= maxAttempts ? "blocked" : "needs_revision"

  return {
    passed,
    score,
    status,
    attempts,
    reason: passed
      ? "质量门禁通过。"
      : wordCountBlockingIssue
        ? `正文有效字数 ${countedWords}/${targetWords}，低于 80% 门槛。`
      : score < 7
        ? `综合评分 ${score}/10，低于通过阈值。`
        : "质量报告包含阻塞或返工信号。",
    wordCount: countedWords,
    targetWords,
  }
}

function enforceFinalDraftQualityGate(
  gate: QualityGateResult,
  finalDraft: string,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  state: AutonomousNovelState,
  protagonistProfile = "",
  continuityContract = createContinuityContract({ state, task, protagonistProfile }),
  characterDossiers?: CharacterDossier[],
) {
  const finalWordCount = wordCount(finalDraft)
  const targetWords = task.targetWords
  const minimumPassWords = Math.floor(targetWords * 0.8)
  if (finalWordCount < minimumPassWords) {
    return {
      ...gate,
      passed: false,
      status: "blocked" as const,
      reason: `最终稿有效字数 ${finalWordCount}/${targetWords}，低于 80% 门槛。`,
      wordCount: finalWordCount,
      targetWords,
    }
  }
  const previousProtagonistName = state.plan.chapterTasks
    .filter((candidate) => candidate.chapterNumber < task.chapterNumber)
    .map((candidate) => candidate.qualityGate?.reason?.match(/沿用「([^」]+)」|首章候选主角识别为「([^」]+)」/u))
    .map((match) => match?.[1] || match?.[2] || "")
    .find(Boolean) || continuityContract.lockedProtagonistName || inferLockedProtagonistName(protagonistProfile)
  const consistency = evaluateChapterConsistency({
    chapterNumber: task.chapterNumber,
    text: finalDraft,
    previousProtagonistName,
    protagonistProfile,
    projectIdea: state.project.idea,
  })
  if (consistency.status === "quarantined") {
    return {
      ...gate,
      passed: false,
      status: "blocked" as const,
      reason: consistency.reason,
      wordCount: finalWordCount,
      targetWords,
    }
  }
  const missingRequiredName = continuityContract.requiredNames.find((name) => !finalDraft.includes(name))
  if (missingRequiredName) {
    return {
      ...gate,
      passed: false,
      status: "blocked" as const,
      reason: `Canon 连续性硬门槛失败：正文未出现必需人物「${missingRequiredName}」。`,
      wordCount: finalWordCount,
      targetWords,
    }
  }
  const plotContinuity = evaluatePlotContinuityBridge(finalDraft, task, continuityContract)
  if (plotContinuity.status === "quarantined") {
    return {
      ...gate,
      passed: false,
      status: "blocked" as const,
      reason: plotContinuity.reason,
      wordCount: finalWordCount,
      targetWords,
    }
  }
  const styleQuality = evaluateNarrativeStyleQuality(finalDraft)
  const softStyleIssue = isSoftNarrativeStyleIssue(styleQuality)
  if (styleQuality.status === "quarantined" && !softStyleIssue) {
    return {
      ...gate,
      passed: false,
      status: "blocked" as const,
      reason: styleQuality.reason,
      wordCount: finalWordCount,
      targetWords,
    }
  }
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    protagonistProfile,
    characterDossiers,
    continuityContract,
    previousFinalDraft: finalDraft,
  })
  const characterProfileQuality = evaluateCharacterProfilePresence(finalDraft, characterProfileContract)
  if (characterProfileQuality.status === "quarantined") {
    return {
      ...gate,
      passed: false,
      status: "blocked" as const,
      reason: characterProfileQuality.reason,
      wordCount: finalWordCount,
      targetWords,
    }
  }
  const naturalnessReport = createNaturalnessReport({
    beforeDraft: finalDraft,
    afterDraft: finalDraft,
    state,
    task,
    continuityContract,
    characterProfileContract,
  })
  if (naturalnessReport.status === "blocked") {
    return {
      ...gate,
      passed: false,
      status: "blocked" as const,
      reason: naturalnessReport.reason,
      wordCount: finalWordCount,
      targetWords,
    }
  }
  return {
    ...gate,
    reason: gate.passed || gate.status === "passed"
      ? `${gate.reason} ${consistency.reason} ${plotContinuity.reason} ${styleQuality.reason} ${softStyleIssue ? "该风格问题已作为后续润色建议记录，不阻断章节推进。" : ""} ${characterProfileQuality.reason} ${naturalnessReport.reason}`.trim()
      : gate.reason,
    wordCount: finalWordCount,
    targetWords,
  }
}

export function inferGenreProfile(state: AutonomousNovelState) {
  const selectedGenre = state.project.creativeProfile?.genre?.trim()
  const selectedNaturalness = state.project.creativeProfile?.naturalnessTarget || "balanced"
  const selectedReaderPromise = state.project.creativeProfile?.readerPromise?.trim()
  const selectedPointOfView = state.project.creativeProfile?.pointOfView?.trim()
  const selectedTone = state.project.creativeProfile?.tone?.trim()
  const selectedStyleFingerprint = state.project.creativeProfile?.styleFingerprint?.trim()
  const selectedProfileText = [
    selectedGenre && selectedGenre !== "auto-inferred" ? selectedGenre : "",
    selectedReaderPromise || "",
    selectedPointOfView || "",
    selectedTone || "",
    selectedStyleFingerprint || "",
  ].join("\n")
  const text = `${state.project.title}\n${state.project.idea}`.toLowerCase()
  const profileText = `${selectedProfileText}\n${text}`.toLowerCase()

  const preset = findGenrePreset(profileText)

  const withProfile = (profile: {
    genre: string
    narration: string
    vocabularyScenes: string[]
    pacingAndRhythm?: string
    chapterStructure?: string
    characterPressure?: string
    poisonPoints?: string[]
    naturalnessRules?: string[]
    contextPriority?: string[]
  }) => {
    const contractDetails: string[] = [profile.narration]
    if (preset) {
      contractDetails.push(
        `- 类型爽点与节奏：${preset.pacingAndRhythm}`,
        `- 章节结构规范：${preset.chapterStructure}`,
        `- 角色压力网络：${preset.characterPressure}`,
        `- 禁忌避坑指南：${preset.poisonPoints.join("；")}`
      )
    }
    contractDetails.push(
      `生产风格合同：读者承诺=${selectedReaderPromise || preset?.readerPromise || "hook-forward, scene-first, emotionally specific"}；视角=${selectedPointOfView || "third-person limited"}；语气=${selectedTone || "tense but readable"}；自然度=${selectedNaturalness}。`,
      selectedStyleFingerprint ? `风格指纹：${selectedStyleFingerprint}。` : "风格指纹：首章生成后从稳定样张中提取；当前先保持场景优先、角色差异和自然对白。"
    )

    return {
      ...profile,
      narration: contractDetails.join("\n"),
      naturalnessTarget: selectedNaturalness,
      readerPromise: selectedReaderPromise || preset?.readerPromise || "hook-forward, scene-first, emotionally specific",
      pointOfView: selectedPointOfView || "third-person limited",
      tone: selectedTone || "tense but readable",
      pacingAndRhythm: preset?.pacingAndRhythm,
      chapterStructure: preset?.chapterStructure,
      characterPressure: preset?.characterPressure,
      poisonPoints: preset?.poisonPoints,
      naturalnessRules: preset?.naturalnessRules || [],
      contextPriority: preset?.contextPriority || [],
    }
  }

  if (preset) {
    return withProfile({
      genre: preset.genreName,
      narration: preset.narrationStrategy,
      vocabularyScenes: preset.vocabularyScenes,
    })
  }

  return withProfile({
    genre: selectedGenre && selectedGenre !== "auto-inferred" ? selectedGenre : "通用类型小说",
    narration: "旁白优先服务场景推进、角色选择和读者期待；避免模板化总结。",
    vocabularyScenes: ["对话", "环境渲染", "心理活动"],
  })
}

function extractStyleFingerprintFromDraft(finalDraft: string) {
  const body = extractNarrativeBody(finalDraft)
  const paragraphs = body.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean)
  const averageParagraphLength = paragraphs.length
    ? Math.round(paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0) / paragraphs.length)
    : 0
  const dialogueCount = (body.match(/[「“][^」”]{2,120}[」”]/gu) || []).length
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|握|松|皱眉|沉默/gu) || []).length
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软|烫|凉/gu) || []).length
  const characterNames = uniqueStrings(extractChinesePersonNames(body, 6)).slice(0, 4)
  const rhythm = averageParagraphLength <= 90
    ? "short scene paragraphs"
    : averageParagraphLength <= 180
      ? "medium scene paragraphs"
      : "long immersive paragraphs"
  const dialogue = dialogueCount >= 4 ? "dialogue-forward" : dialogueCount > 0 ? "selective dialogue" : "low-dialogue narration"
  const texture = sensorySignals >= actionSignals ? "sensory texture led" : "action and choice led"
  const voice = characterNames.length >= 2
    ? `distinct cast pressure around ${characterNames.join("、")}`
    : "single-viewpoint voice lock"
  return [
    rhythm,
    dialogue,
    texture,
    voice,
    `avg paragraph ${averageParagraphLength || "unknown"} chars`,
  ].join("; ")
}

async function updateStyleFingerprintFromFirstChapter(input: {
  paths: NovelWorkspacePaths
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  finalDraft: string
  finalGate: QualityGateResult
}) {
  if (input.task.chapterNumber !== 1 || input.finalGate.status === "blocked") return ""
  const currentFingerprint = input.state.project.creativeProfile?.styleFingerprint?.trim() || ""
  if (currentFingerprint && !/pending sample|first-chapter extraction/i.test(currentFingerprint)) {
    return ""
  }
  const extracted = extractStyleFingerprintFromDraft(input.finalDraft)
  input.state.project = {
    ...input.state.project,
    creativeProfile: {
      ...(input.state.project.creativeProfile || {
        genre: "auto-inferred",
        platform: "serialized web novel",
        readerPromise: "hook-forward, scene-first, emotionally specific",
        pointOfView: "third-person limited",
        tone: "tense but readable",
        naturalnessTarget: "balanced",
        characterProfileRequirements: [],
      }),
      styleFingerprint: extracted,
    },
  }
  const currentStyleProfile = await readOptionalText(input.paths.styleProfilePath)
  const updatedStyleProfile = currentStyleProfile
    ? currentStyleProfile.replace(/- style fingerprint: .*/i, `- style fingerprint: ${extracted}`)
    : [
      "# Style Profile",
      "",
      `Project: ${input.state.project.title}`,
      "",
      "Production selection contract:",
      `- style fingerprint: ${extracted}`,
    ].join("\n")
  await fs.writeFile(input.paths.styleProfilePath, `${updatedStyleProfile.trimEnd()}\n`)
  return extracted
}

function compactStyleList(values: string[] | undefined, limit = 4) {
  return (values || [])
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function compactStyleValue(value: string | undefined, maxLength = 160) {
  return value?.trim().replace(/\s+/gu, " ").slice(0, maxLength) || ""
}

export function buildChapterInheritanceAdapterPayload(contract: StyleEvolutionContract | null | undefined): ChapterInheritanceAdapterPayload | null {
  if (!contract?.approvedAt || !contract.styleContract) {
    return null
  }
  const style = contract.styleContract
  const inheritedArtifacts = (contract.inheritance?.inheritedArtifacts?.length
    ? contract.inheritance.inheritedArtifacts
    : ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"])
  const inheritedRules = (contract.inheritance?.inheritedRules?.length
    ? contract.inheritance.inheritedRules
    : [
        "后续每章必须继承用户冻结后的 base writing prompt。",
        "后续每章必须继承 style contract 中的 voice、节奏、对白与禁忌约束。",
      ])
  const styleContractFields = [
    style.voice ? "voice" : "",
    style.sentenceRhythm ? "sentenceRhythm" : "",
    compactStyleList(style.dialogueRules, 1).length ? "dialogueRules" : "",
    compactStyleList(style.descriptionRules, 1).length ? "descriptionRules" : "",
    compactStyleList(style.emotionRules, 1).length ? "emotionRules" : "",
    compactStyleList(style.pacingRules, 1).length ? "pacingRules" : "",
    compactStyleList(style.povRules, 1).length ? "povRules" : "",
    compactStyleList(style.openingRules, 1).length ? "openingRules" : "",
    compactStyleList(style.endingHookRules, 1).length ? "endingHookRules" : "",
    Array.isArray(style.allowedDevices) ? "allowedDevices" : "",
    compactStyleList(style.forbiddenPatterns, 1).length ? "forbiddenPatterns" : "",
    compactStyleList(style.positiveExamples, 1).length ? "positiveExamples" : "",
    Array.isArray(style.negativeExamples) ? "negativeExamples" : "",
  ].filter(Boolean)
  const contractVersion = Number(contract.loop?.approvalVersion || contract.approval?.approvedVersion || 0)
  const freezerVerdict = contract.freezer?.verdict || "missing"
  const verificationStatus = String(contract.verification?.status || contract.loop?.verificationStatus || "")
  const loopProtocol = contract.loopProtocol
  const requiredLoopStages = Array.isArray(loopProtocol?.requiredStages) ? loopProtocol.requiredStages : []
  const completedLoopStages = Array.isArray(loopProtocol?.completedStages) ? loopProtocol.completedStages : []
  const blockedLoopStages = Array.isArray(loopProtocol?.blockedStages) ? loopProtocol.blockedStages : []
  const loopProtocolReady = loopProtocol?.status === "approved"
    && requiredLoopStages.length > 0
    && requiredLoopStages.every((stage) => completedLoopStages.includes(stage))
  const adapterReady = freezerVerdict === "ready"
    && verificationStatus === "passed"
    && loopProtocolReady
    && contract.inheritance?.status === "enforced"
    && inheritedArtifacts.length > 0
    && inheritedRules.length > 0
  return {
    name: "Chapter Inheritance Adapter",
    status: adapterReady ? "ready" : "blocked",
    contractVersion,
    approvedAt: String(contract.approvedAt || contract.approval?.approvedAt || ""),
    freezerVerdict,
    freezerSummary: String(contract.freezer?.summary || ""),
    verificationStatus,
    verificationSummary: String(contract.verification?.summary || contract.loop?.verificationSummary || ""),
    inheritedArtifacts,
    inheritedRules,
    styleContractFields,
    loopProtocolStatus: loopProtocol?.status || "missing",
    loopProtocolStages: {
      required: requiredLoopStages,
      completed: completedLoopStages,
      blocked: blockedLoopStages,
    },
    loopProtocolEvidence: (loopProtocol?.evidence || [])
      .filter((item) => item.status === "passed")
      .map((item) => `${item.label}: ${item.summary}`)
      .slice(0, 9),
    promptSections: [
      "User Approved Writing Style Contract",
      "Style Rulebook",
      "Style References",
      "Style Anti-Patterns",
    ],
    requiredChapterEvidence: [
      "quality gate passed",
      "AIGC detection passed",
      "style conformance drift conformant",
      "styleInheritanceVerification ready",
    ],
    approvedSampleExcerpt: compactStyleValue(contract.approvedSample, 240),
  }
}

function formatStyleRulebook(contract: StyleEvolutionContract | null | undefined): string {
  const style = contract?.styleContract
  if (!contract?.approvedAt || !style) {
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

function formatStyleReferences(contract: StyleEvolutionContract | null | undefined): string {
  const style = contract?.styleContract
  if (!contract?.approvedAt || !style) {
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

function formatStyleAntiPatterns(contract: StyleEvolutionContract | null | undefined): string {
  const style = contract?.styleContract
  if (!contract?.approvedAt || !style) {
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

export function formatApprovedWritingStylePrompt(contract: StyleEvolutionContract | null | undefined): string {
  const approvedAt = contract?.approvedAt
  const approvedSample = contract?.approvedSample?.trim()
  const style = contract?.styleContract
  if (!approvedAt || !approvedSample || !style) {
    return ""
  }
  const acceptedAsBookStyle = contract.approval?.acceptedAsBookStyle !== false
  const inheritedArtifacts = (contract.inheritance?.inheritedArtifacts?.length
    ? contract.inheritance.inheritedArtifacts
    : ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"])
  const inheritedRules = (contract.inheritance?.inheritedRules?.length
    ? contract.inheritance.inheritedRules
    : [
        "后续每章必须继承用户冻结后的 base writing prompt。",
        "后续每章必须继承 style contract 中的 voice、节奏、对白与禁忌约束。",
      ])
  const verification = contract.verification
  const chapterInheritanceAdapter = buildChapterInheritanceAdapterPayload(contract)
  const lines = [
    "## User Approved Writing Style Contract",
    "这是用户确认后冻结的全书基础写法，优先级高于通用写作指南。正文、质检、润色都必须执行。",
    `- Approved at: ${approvedAt}`,
    contract.approval?.approvedVersion ? `- Approved version: v${contract.approval.approvedVersion}` : "",
    contract.loop?.stableVersion ? `- Stable version before freeze: v${contract.loop.stableVersion}` : "",
    contract.loop?.stableRounds ? `- Stable rounds before freeze: ${contract.loop.stableRounds}` : "",
    contract.approval?.freezeSummary ? `- Freeze summary: ${contract.approval.freezeSummary}` : "",
    acceptedAsBookStyle ? "- Acceptance scope: this approval applies to the whole book, not a single sample." : "",
    contract.runtime?.engine ? `- Style engine: ${contract.runtime.engine}` : "",
    contract.runtime?.runtime ? `- Loop runtime: ${contract.runtime.runtime}` : "",
    contract.runtime?.gate ? `- Freeze gate: ${contract.runtime.gate}` : "",
	    contract.runtime?.verificationGate ? `- Verification gate: ${contract.runtime.verificationGate}` : "",
	    contract.freezer?.verdict ? `- Freezer verdict: ${contract.freezer.verdict}` : "",
	    contract.freezer?.summary ? `- Freezer summary: ${contract.freezer.summary}` : "",
	    ...(contract.loop?.stabilityReasons || []).map((reason) => `- Stability reason: ${reason}`),
    verification?.summary ? `- Verification summary: ${verification.summary}` : "",
    verification?.status ? `- Verification status: ${verification.status}` : "",
    ...(verification?.reasons || []).map((reason) => `- Verification reason: ${reason}`),
    typeof verification?.score === "number" ? `- AIGC verification score: ${verification.score.toFixed(3)}` : "",
    typeof verification?.threshold === "number" ? `- AIGC verification threshold: ${verification.threshold.toFixed(3)}` : "",
    verification?.highRiskCount ? `- High risk segments before freeze: ${verification.highRiskCount}` : "",
    verification?.forbiddenHitCount ? `- Forbidden hits before freeze: ${verification.forbiddenHitCount}` : "",
    style.voice ? `- Voice: ${style.voice}` : "",
    style.sentenceRhythm ? `- Sentence rhythm: ${style.sentenceRhythm}` : "",
    ...compactStyleList(style.dialogueRules).map((rule) => `- Dialogue rule: ${rule}`),
    ...compactStyleList(style.descriptionRules).map((rule) => `- Description rule: ${rule}`),
    ...compactStyleList(style.emotionRules).map((rule) => `- Emotion rule: ${rule}`),
    ...compactStyleList(style.pacingRules).map((rule) => `- Pacing rule: ${rule}`),
    ...compactStyleList(style.povRules, 3).map((rule) => `- POV rule: ${rule}`),
    ...compactStyleList(style.openingRules, 3).map((rule) => `- Opening rule: ${rule}`),
    ...compactStyleList(style.endingHookRules, 3).map((rule) => `- Ending hook rule: ${rule}`),
    compactStyleList(style.allowedDevices, 8).length
      ? `- Allowed devices: ${compactStyleList(style.allowedDevices, 8).join("、")}`
      : "",
    compactStyleList([...(style.forbiddenPatterns || []), ...(contract.antiPatterns || [])], 10).length
      ? `- Forbidden patterns: ${compactStyleList([...(style.forbiddenPatterns || []), ...(contract.antiPatterns || [])], 10).join("；")}`
      : "",
    compactStyleList(style.positiveExamples, 2).length
      ? `- Positive examples: ${compactStyleList(style.positiveExamples, 2).join(" / ")}`
      : "",
    compactStyleList(style.negativeExamples, 2).length
      ? `- Negative examples to avoid: ${compactStyleList(style.negativeExamples, 2).join(" / ")}`
      : "",
    contract.frozenBasePrompt?.trim()
      ? `- Frozen base prompt: ${contract.frozenBasePrompt.trim().replace(/\s+/gu, " ").slice(0, 480)}`
      : "",
    contract.retryPolicy?.approvalScoreThreshold
      ? `- Retry policy: approval threshold ${Number(contract.retryPolicy.approvalScoreThreshold).toFixed(1)} / min rounds ${Math.max(1, Number(contract.retryPolicy.approvalMinRounds || 2))} / max forbidden hits ${Math.max(0, Number(contract.retryPolicy.maxForbiddenHitCount || 1))}`
      : "",
	    ...inheritedArtifacts.map((artifact) => `- Inherited artifact: ${artifact}`),
	    ...inheritedRules.map((rule) => `- Inheritance rule: ${rule}`),
	    chapterInheritanceAdapter?.status
	      ? `- Chapter Inheritance Adapter: ${chapterInheritanceAdapter.status}`
	      : "",
	    chapterInheritanceAdapter?.loopProtocolStatus
	      ? `- Loop protocol status: ${chapterInheritanceAdapter.loopProtocolStatus}`
	      : "",
	    chapterInheritanceAdapter?.loopProtocolStages?.completed?.length
	      ? `- Loop protocol completed stages: ${chapterInheritanceAdapter.loopProtocolStages.completed.join(", ")}`
	      : "",
	    ...(chapterInheritanceAdapter?.loopProtocolEvidence || []).slice(0, 4).map((item) => `- Loop protocol evidence: ${item}`),
	    `- Approved sample excerpt: ${approvedSample.replace(/\s+/gu, " ").slice(0, 360)}`,
	  ].filter(Boolean)
  return lines.join("\n")
}

export async function loadApprovedWritingStyleContext(projectRoot: string): Promise<ApprovedWritingStyleContext> {
  try {
    const snapshot = await loadStyleEvolution(projectRoot)
	    const prompt = formatApprovedWritingStylePrompt(snapshot.contract)
	    const gate = evaluateStyleEvolutionGate(snapshot.contract)
	    const rulebook = formatStyleRulebook(snapshot.contract)
	    const references = formatStyleReferences(snapshot.contract)
	    const antiPatterns = formatStyleAntiPatterns(snapshot.contract)
	    const chapterInheritanceAdapter = buildChapterInheritanceAdapterPayload(snapshot.contract)
	    return prompt && gate.canProceed
	      ? { status: "ready", prompt, contract: snapshot.contract, rulebook, references, antiPatterns, chapterInheritanceAdapter: chapterInheritanceAdapter || undefined }
	      : { status: "missing", prompt: "" }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "missing", prompt: "" }
    }
    throw error
  }
}

function summarizeApprovedStyleCarryover(approvedStyleContext: ApprovedWritingStyleContext) {
  if (approvedStyleContext.status !== "ready") {
    return ""
  }
  const contract = approvedStyleContext.contract
  const style = contract?.styleContract
  if (!contract?.approvedAt || !style) {
    return summarizePromptSection(approvedStyleContext.prompt, 900)
  }
	  const forbiddenPatterns = compactStyleList(uniqueStrings([...(style.forbiddenPatterns || []), ...(contract.antiPatterns || [])]), 4)
	  const positiveExamples = compactStyleList(style.positiveExamples, 1)
	  const negativeExamples = compactStyleList(style.negativeExamples, 1)
	  const dialogueRules = compactStyleList(style.dialogueRules, 1)
	  const descriptionRules = compactStyleList(style.descriptionRules, 1)
	  const emotionRules = compactStyleList(style.emotionRules, 1)
	  const pacingRules = compactStyleList(style.pacingRules, 1)
	  const povRules = compactStyleList(style.povRules, 1)
	  const openingRules = compactStyleList(style.openingRules, 1)
	  const endingHookRules = compactStyleList(style.endingHookRules, 1)
	  const allowedDevices = compactStyleList(style.allowedDevices, 3)
	  const inheritedRules = compactStyleList(contract.inheritance?.inheritedRules, 1)
	  const adapter = approvedStyleContext.chapterInheritanceAdapter || buildChapterInheritanceAdapterPayload(contract)
	  const lines = [
	    "## User Approved Writing Style Contract",
	    "冻结全书基础写法；后续章节必须继承，不得重置成通用模板腔。",
	    `- Approved at: ${contract.approvedAt}`,
	    adapter?.contractVersion ? `- Adapter contract version: v${adapter.contractVersion}` : "",
	    adapter?.loopProtocolStatus
	      ? `- Loop protocol: ${adapter.loopProtocolStatus} (${adapter.loopProtocolStages?.completed?.length || 0}/${adapter.loopProtocolStages?.required?.length || 0} stages)`
	      : "",
	    adapter?.freezerVerdict ? `- Freezer verdict: ${adapter.freezerVerdict}` : "",
	    contract.runtime?.verificationGate ? `- Verification gate: ${contract.runtime.verificationGate}` : "",
	    contract.verification?.status ? `- Verification status: ${contract.verification.status}` : "",
	    compactStyleValue(style.voice, 140) ? `- Voice: ${compactStyleValue(style.voice, 140)}` : "",
	    compactStyleValue(style.sentenceRhythm, 100) ? `- Sentence rhythm: ${compactStyleValue(style.sentenceRhythm, 100)}` : "",
	    ...dialogueRules.map((rule) => `- Dialogue rule: ${rule}`),
	    ...descriptionRules.map((rule) => `- Description rule: ${rule}`),
	    ...emotionRules.map((rule) => `- Emotion rule: ${rule}`),
	    ...pacingRules.map((rule) => `- Pacing rule: ${rule}`),
	    ...povRules.map((rule) => `- POV rule: ${rule}`),
	    ...openingRules.map((rule) => `- Opening rule: ${rule}`),
	    ...endingHookRules.map((rule) => `- Ending hook rule: ${rule}`),
	    allowedDevices.length ? `- Allowed devices: ${allowedDevices.join("、")}` : "",
	    forbiddenPatterns.length ? `- Forbidden patterns: ${forbiddenPatterns.join("；")}` : "",
	    positiveExamples.length ? `- Positive example: ${positiveExamples[0]}` : "",
	    negativeExamples.length ? `- Negative example to avoid: ${negativeExamples[0]}` : "",
	    compactStyleValue(contract.frozenBasePrompt, 160) ? `- Frozen base prompt focus: ${compactStyleValue(contract.frozenBasePrompt, 160)}` : "",
	    ...inheritedRules.map((rule) => `- Inheritance rule: ${rule}`),
	    compactStyleValue(contract.approvedSample, 180) ? `- Approved sample excerpt: ${compactStyleValue(contract.approvedSample, 180)}` : "",
	  ].filter(Boolean)
	  return summarizePromptSection(lines.join("\n"), 980)
	}

async function persistApprovedWritingStyleAssets(
  projectRoot: string,
  paths: NovelWorkspacePaths,
  approvedStyleContext: ApprovedWritingStyleContext,
  options: ProductionPipelineOptions = {},
) {
  if (approvedStyleContext.status !== "ready") {
    return
  }
  await fs.mkdir(paths.styleDir, { recursive: true })
  const writes: Array<[string, string, string]> = [
    [paths.styleRulebookPath, approvedStyleContext.rulebook || "", "style_rulebook"],
    [paths.styleReferencesPath, approvedStyleContext.references || "", "style_references"],
    [paths.styleAntiPatternsPath, approvedStyleContext.antiPatterns || "", "style_anti_patterns"],
  ]
  for (const [filePath, content, kind] of writes) {
    if (!content.trim()) continue
    await fs.writeFile(filePath, `${content.trimEnd()}\n`)
    await recordPipelineArtifact(projectRoot, filePath, "style", options, {
      kind,
      source: "approved_style_contract",
    })
  }
}

async function enforceApprovedWritingStyleGate(
  options: ProductionPipelineOptions,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  approvedStyleContext: ApprovedWritingStyleContext,
) {
  if (approvedStyleContext.status === "ready") {
    return
  }
  const message = "本书写法尚未获得用户确认，正文生产已阻塞。请先在 Style Evolution Engine 中生成样段，并通过 Style Contract Freeze Gate 确认一个版本。"
  await emitWritingProgress(options, {
    step: "production_readiness_blocked",
    role: "Showrunner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "blocked",
    message,
    preview: "Blocked gate: style_approval",
  })
  throw new ProductionReadinessBlockedError(message)
}

function normalizeTailParagraph(paragraph: string) {
  return paragraph
    .replace(/\s+/gu, "")
    .replace(/[，。、“”‘’：；！？,.!?:"'()\[\]【】《》]/gu, "")
    .slice(0, 160)
}

export function compactPreviousSegmentTail(text: string, maxChars = 800): string {
  const paragraphs = text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const selected: string[] = []
  const seen = new Set<string>()

  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    const paragraph = paragraphs[index]
    const fingerprint = normalizeTailParagraph(paragraph)
    if (!fingerprint || seen.has(fingerprint)) {
      continue
    }
    seen.add(fingerprint)
    selected.unshift(paragraph)
    if (selected.join("\n\n").length >= maxChars) {
      break
    }
  }

  const compacted = selected.join("\n\n")
  return compacted.length > maxChars ? compacted.slice(-maxChars).trim() : compacted
}

function compactAssemblyReferenceBody(text: string, maxChars = 900): string {
  const paragraphs = text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const selected: string[] = []
  const seen = new Set<string>()

  for (const paragraph of paragraphs) {
    const fingerprint = normalizeTailParagraph(paragraph)
    if (!fingerprint || seen.has(fingerprint)) {
      continue
    }
    seen.add(fingerprint)
    selected.push(paragraph)
  }

  const compacted = selected.join("\n\n") || text.trim()
  return clipPromptSection(compacted, maxChars)
}

function sceneTypeForChapter(state: AutonomousNovelState, chapterNumber: number) {
  const genre = inferGenreProfile(state)
  const sequence = genre.vocabularyScenes
  return sequence[(chapterNumber - 1) % sequence.length] || "对话"
}

function productionWritingMode(options: ProductionPipelineOptions = {}): ProductionWritingMode {
  const envMode = String(process.env.AI_NOVEL_WRITING_MODE || "").toLowerCase()
  if (options.writingMode === "quality" || envMode === "quality") return "quality"
  return "fast"
}

function shouldUseLlmQualityPass(options: ProductionPipelineOptions = {}) {
  return process.env.AI_NOVEL_TEST_MODE !== "1" && productionWritingMode(options) === "quality"
}

function shouldUseLlmPolishPass(options: ProductionPipelineOptions = {}, gate?: QualityGateResult) {
  return process.env.AI_NOVEL_TEST_MODE !== "1"
    && productionWritingMode(options) === "quality"
    && gate?.status !== "blocked"
}

const SCENE_TYPE_CATEGORY_MAP: Record<string, string[]> = {
  "战斗": ["action_verbs", "military"],
  "冲突": ["action_verbs", "emotions"],
  "对话": ["emotions", "character_traits"],
  "描写": ["environment", "character_traits"],
  "宫廷": ["court_politics", "character_traits"],
  "战争": ["military", "action_verbs"],
  "日常": ["daily_life", "emotions"],
  "自然环境": ["environment", "cultural"],
  "心理活动": ["emotions"],
  "人物刻画": ["character_traits", "emotions"],
  "仪式庆典": ["court_politics", "cultural"],
  "训练修炼": ["action_verbs", "daily_life"],
  "探索冒险": ["action_verbs", "environment"],
  "权谋算计": ["court_politics", "emotions"],
  "感情戏": ["emotions", "character_traits"],
  "动作场面": ["action_verbs", "military"],
  "环境渲染": ["environment", "cultural"],
  "历史叙事": ["cultural", "court_politics"],
}

function cleanVocabularyDefinition(definition = "", maxLength = 72) {
  return definition
    .replace(/^\d+\.?/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

function extractVocabularyKeywords(input: {
  state: AutonomousNovelState
  task?: AutonomousNovelState["plan"]["chapterTasks"][number]
  blueprint?: string
  continuityContract?: ContinuityContract
  sceneType?: string
  limit?: number
}) {
  const text = [
    input.sceneType || "",
    input.state.project.title,
    input.state.project.idea,
    input.task?.title || "",
    input.task?.summary || "",
    input.task?.causalPlan?.sceneObjective || "",
    input.task?.causalPlan?.previousInput || "",
    input.task?.causalPlan?.nextHandoff || "",
    input.continuityContract?.continuityAnchors.join(" ") || "",
    input.blueprint || "",
  ].join("\n")
  const anchors = input.continuityContract?.continuityAnchors || []
  const names = extractChinesePersonNames(text, 12)
  const shortTerms = [...text.matchAll(/[\p{Script=Han}]{2,6}/gu)]
    .map((match) => match[0])
    .filter((term) => !CONTINUITY_ANCHOR_STOPWORDS.has(term))
    .filter((term) => !/^(?:本章|上一章|下一章|必须|不能|推进|承接|选择|代价|交棒|角色|情节|状态|目标)$/u.test(term))
  return uniqueStrings([...anchors, ...names, ...shortTerms]).slice(0, input.limit ?? 16)
}

function vocabularyRelevanceScore(entry: VocabularyEntry, input: {
  sceneType: string
  keywords?: string[]
  contextText?: string
}) {
  const categories = SCENE_TYPE_CATEGORY_MAP[input.sceneType] || ["cultural"]
  const definition = entry.definition || ""
  const text = `${entry.word}\n${definition}`
  let score = 0
  if (entry.categories.some((category) => categories.includes(category))) score += 20
  for (const keyword of input.keywords || []) {
    if (keyword && (entry.word.includes(keyword) || definition.includes(keyword))) score += 8
  }
  if (/^[\p{Script=Han}]{4}$/u.test(entry.word)) score += 2
  if (entry.word.length >= 2 && entry.word.length <= 4) score += 3
  if (definition.length > 0 && definition.length < 90) score += 2
  if (/成语|典故|比喻|形容|谓/u.test(definition)) score += 1
  if (input.contextText) {
    for (const token of uniqueStrings((input.contextText.match(/[\p{Script=Han}]{1,2}/gu) || [])).slice(0, 24)) {
      if (text.includes(token)) score += 0.5
    }
  }
  return score
}

function recommendVocabularyEntries(input: {
  resources: ProductionWritingResources
  sceneType: string
  keywords?: string[]
  contextText?: string
  limit?: number
}) {
  const catalog = input.resources.vocabularyCatalog
  if (!catalog) return []
  const categories = SCENE_TYPE_CATEGORY_MAP[input.sceneType] || ["cultural"]
  const candidates = uniqueStrings(categories)
    .flatMap((category) => catalog.entriesByCategory[category] || [])
  const keywordMatches = (input.keywords || [])
    .flatMap((keyword) => catalog.entriesByWord.get(keyword) ? [catalog.entriesByWord.get(keyword) as VocabularyEntry] : [])
  return uniqueStrings([...keywordMatches, ...candidates].map((entry) => entry.word))
    .map((word) => catalog.entriesByWord.get(word))
    .filter((entry): entry is VocabularyEntry => Boolean(entry))
    .map((entry) => ({
      entry,
      score: vocabularyRelevanceScore(entry, {
        sceneType: input.sceneType,
        keywords: input.keywords,
        contextText: input.contextText,
      }),
    }))
    .sort((left, right) => right.score - left.score || left.entry.word.length - right.entry.word.length)
    .map((item) => item.entry)
    .slice(0, input.limit ?? 24)
}

function recommendRelevantIdioms(input: {
  resources: ProductionWritingResources
  sceneType: string
  keywords?: string[]
  contextText?: string
  limit?: number
}) {
  return recommendVocabularyEntries({
    ...input,
    limit: Math.max(30, input.limit ?? 5),
  })
    .filter((entry) => /^[\p{Script=Han}]{4,8}$/u.test(entry.word))
    .filter((entry) => /成语|典故|比喻|形容|谓|喻/u.test(entry.definition) || /^[\p{Script=Han}]{4}$/u.test(entry.word))
    .slice(0, input.limit ?? 5)
}

function isActionableVocabularyEntry(entry: VocabularyEntry) {
  const definition = cleanVocabularyDefinition(entry.definition, 120)
  if (!/^[\p{Script=Han}]{1,8}$/u.test(entry.word)) return false
  if (/词典|学科|术语|中国社会科学院|现代汉语|诗体名|灯谜|谜格|日本|天皇|公元|语法|音高|商务印书馆/u.test(definition)) return false
  if (/^(?:成语|词汇|语言|文字|说什么|哪里是)$/u.test(entry.word)) return false
  return true
}

function createDraftVocabularyHints(input: {
  resources: ProductionWritingResources
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  sceneType: string
  blueprint?: string
  continuityContract?: ContinuityContract
  limit?: number
}) {
  const keywords = extractVocabularyKeywords({
    state: input.state,
    task: input.task,
    blueprint: input.blueprint,
    continuityContract: input.continuityContract,
    sceneType: input.sceneType,
    limit: 12,
  })
  const contextText = [
    input.state.project.idea,
    input.task.summary,
    input.task.causalPlan?.sceneObjective || "",
    input.continuityContract?.continuityAnchors.join(" ") || "",
  ].join("\n")
  return recommendVocabularyEntries({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText,
    limit: Math.max(24, input.limit ?? 10),
  })
    .filter(isActionableVocabularyEntry)
    .slice(0, input.limit ?? 10)
    .map((entry) => `${entry.word}: ${cleanVocabularyDefinition(entry.definition, 48)}`)
}

function createVocabularyUsagePrompt(input: {
  resources: ProductionWritingResources
  state: AutonomousNovelState
  task?: AutonomousNovelState["plan"]["chapterTasks"][number]
  sceneType: string
  blueprint?: string
  continuityContract?: ContinuityContract
  limit?: number
}) {
  const keywords = extractVocabularyKeywords({
    state: input.state,
    task: input.task,
    blueprint: input.blueprint,
    continuityContract: input.continuityContract,
    sceneType: input.sceneType,
    limit: 16,
  })
  const contextText = [
    input.state.project.idea,
    input.task?.summary || "",
    input.task?.causalPlan?.sceneObjective || "",
    input.continuityContract?.continuityAnchors.join(" ") || "",
    input.blueprint || "",
  ].join("\n")
  const entries = recommendVocabularyEntries({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText,
    limit: input.limit ?? 20,
  })
  const idioms = recommendRelevantIdioms({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText,
    limit: 5,
  })
  if (entries.length === 0) {
    return [
      "## Vocabulary Skill Guidance",
      "",
      "- 词汇索引暂未命中；优先使用具体动作、物件、感官和人物关系推动场景。",
      "- 成语只能在总结、对比、强调处点到为止，每章不超过 3-5 个。",
      "- 成语关联性检查：每个成语前后必须有场景铺垫、人物判断或因果变化支撑。",
    ].join("\n")
  }
  const base = entries.slice(0, 10)
  const advanced = entries.slice(10, 16)
  const rare = entries.slice(16, 20)
  return [
    `## ${input.sceneType}场景 - 词汇使用指南`,
    "",
    "### 核心原则：成语必须与文本关联",
    "- 要有前文铺垫，要有逻辑关联，要符合场景氛围。",
    "- 不要孤零零地使用，不要堆砌叠加，不要强行植入。",
    "- 词汇金字塔：基础词汇约 50%，进阶词汇约 30%，高级词汇约 15%，稀有/成语约 5%。",
    "- 每段最多 1 个成语，每章通常不超过 3-5 个；更重要的是动作、感官和因果句。",
    "- 成语关联性检查：每个成语前后必须有场景铺垫、人物判断或因果变化支撑。",
    "",
    "### 关键词来源",
    keywords.length ? `- ${keywords.slice(0, 12).join("、")}` : "- 暂无明确关键词，按场景类型推荐。",
    "",
    "### 成语推荐列表（仅在已有铺垫后用于总结/对比/强调）",
    idioms.length ? `- ${idioms.map((entry) => entry.word).join("、")}` : "- 未找到高度相关成语，建议使用基础词汇表达，不强行植入。",
    "",
    "### 基础词汇推荐列表（优先使用）",
    `- ${base.map((entry) => entry.word).join("、")}`,
    "",
    "### 进阶词汇推荐列表（适当使用）",
    advanced.length ? `- ${advanced.map((entry) => entry.word).join("、")}` : "- 无。",
    "",
    "### 高级/稀有词汇推荐列表（谨慎使用）",
    rare.length ? `- ${rare.map((entry) => entry.word).join("、")}` : "- 无。",
  ].join("\n")
}

function trimExampleBlock(block = "", maxLength = 760) {
  return block
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength)
}

function extractSkillExampleBlocks(examples: string[], label: "正确示范" | "错误示范", limit = 2) {
  const joined = examples.join("\n\n")
  const pattern = new RegExp(`###\\s+[^\\n]*${label}[^\\n]*\\n([\\s\\S]*?)(?=\\n###\\s|\\n---|\\n##\\s|$)`, "gu")
  const blocks: string[] = []
  for (const match of joined.matchAll(pattern)) {
    const block = trimExampleBlock(match[1] || "")
    if (block) {
      blocks.push(block)
    }
    if (blocks.length >= limit) {
      break
    }
  }
  return blocks
}

function createVocabularySkillExamplePrompt(resources: ProductionWritingResources, sceneType: string) {
  const positiveBlocks = extractSkillExampleBlocks(resources.examples, "正确示范", 2)
  const negativeBlocks = extractSkillExampleBlocks(resources.examples, "错误示范", 1)
  if (positiveBlocks.length === 0 && negativeBlocks.length === 0) {
    return [
      "## Migrated Vocabulary Skill Examples",
      "",
      "- 旧词汇 skill 示例未命中；仍必须遵循方法：先写具体内容，再少量点缀成语。",
      "- 禁止把推荐词堆成场景，禁止把单字/短词独立成行模拟氛围。",
    ].join("\n")
  }
  return [
    "## Migrated Vocabulary Skill Examples",
    "",
    `Scene type: ${sceneType}`,
    "- 这些示例来自旧写作 skill/资源，只学习方法，不复用原文情节。",
    "- 关键方法：先用基础词汇写动作、物件、感官、对话和因果，再把少量成语放在总结、对比或强调处。",
    "",
    "### Positive Patterns To Imitate",
    ...(positiveBlocks.length
      ? positiveBlocks.map((block, index) => [`#### Positive ${index + 1}`, block].join("\n"))
      : ["- 暂无。"]),
    "",
    "### Anti Patterns To Avoid",
    ...(negativeBlocks.length
      ? negativeBlocks.map((block, index) => [`#### Anti Pattern ${index + 1}`, block].join("\n"))
      : ["- 暂无。"]),
    "",
    "### Execution Checklist",
    "- 先写内容，再考虑词汇替换。",
    "- 每个成语前必须有具体铺垫，后面必须服务情绪、局势或人物判断。",
    "- 对话优先符合人物身份和关系，不用成语展示文采。",
    "- 场景句必须能看见动作、听见声音、摸到物件或感到压力。",
  ].join("\n")
}

function createVocabularyResourceManifest(input: {
  resources: ProductionWritingResources
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  sceneType: string
  blueprint?: string
  continuityContract?: ContinuityContract
  limit?: number
}) {
  const keywords = extractVocabularyKeywords({
    state: input.state,
    task: input.task,
    blueprint: input.blueprint,
    continuityContract: input.continuityContract,
    sceneType: input.sceneType,
    limit: 12,
  })
  const entries = recommendVocabularyEntries({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText: [
      input.state.project.idea,
      input.task.summary,
      input.task.causalPlan?.sceneObjective || "",
      input.continuityContract?.continuityAnchors.join(" ") || "",
      input.blueprint || "",
    ].join("\n"),
    limit: input.limit ?? 12,
  })
  const idioms = recommendRelevantIdioms({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText: input.blueprint || input.task.summary,
    limit: 4,
  })
  const categories = SCENE_TYPE_CATEGORY_MAP[input.sceneType] || ["cultural"]
  return [
    "## Writing Resource Usage Manifest",
    "",
    `- Scene type: ${input.sceneType}`,
    `- Vocabulary categories: ${categories.join(", ")}`,
    `- Vocabulary catalog: ${input.resources.vocabularyCatalog ? `${input.resources.vocabularyCatalog.totalWords} entries loaded` : "not loaded"}`,
    `- Skill examples loaded: ${input.resources.examples.length}`,
    keywords.length ? `- Context keywords: ${keywords.join("、")}` : "- Context keywords: none",
    "",
    "### Recommended Idiom Candidates",
    ...(idioms.length
      ? idioms.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}.`)
      : ["- No high-confidence idiom candidate; prefer plain concrete wording."]),
    "",
    "### Recommended Scene Vocabulary",
    ...(entries.length
      ? entries.slice(0, 12).map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}.`)
      : ["- No vocabulary hit; use concrete actions, objects, sensory details, and causality."]),
  ].join("\n")
}

function extractVocabularyHints(resources: ProductionWritingResources, sceneType: string, limit = 12) {
  const prompt = createVocabularyUsagePrompt({
    resources,
    state: {
      project: { title: "", idea: "", createdAt: "", workspaceVersion: 1 },
      runtime: { stage: "drafting", statusMessage: "", lastUpdatedAt: "", lastInterruption: null },
      reactSetup: { discussionGoals: [], unansweredQuestions: [] },
      plan: { totalChapters: 1, chapterWordTarget: 2500, pendingChapters: 1, chapterTasks: [] },
      assets: { cover: { status: "pending", briefPath: "" }, comic: { status: "pending", planPath: "" } },
    },
    sceneType,
    limit,
  })
  return prompt.split("\n").filter((line) => line.trim().startsWith("- ")).slice(0, limit)
}

const CONTINUITY_ANCHOR_STOPWORDS = new Set([
  "本章",
  "上一章",
  "下一章",
  "主角",
  "正文",
  "终稿",
  "初稿",
  "章节",
  "剧情",
  "推进",
  "线索",
  "伏笔",
  "关系",
  "状态",
  "选择",
  "代价",
  "问题",
  "目标",
  "记忆",
  "角色",
  "人物",
  "场景",
  "压力",
  "局势",
  "局部",
  "结果",
  "后续",
  "承接",
  "记录",
  "更新",
  "通过",
  "完成",
  "保持",
  "不能",
  "必须",
  "需要",
  "不得",
  "已记录",
  "已完成",
  "暂无",
  "可用",
  "Project",
  "Chapter",
  "Summary",
])

const CONTINUITY_KEYWORD_PATTERN = /契书|田册|账册|账簿|簿册|名册|密信|书信|官印|印信|钥匙|玉佩|粮袋|米粮|银钱|欠债|债契|文书|案卷|税粮|军令|告示|药包|伤口|血迹|脚印|马车|坊门|县衙|市集|西市|城门|渡口|驿站|仓房|牢房|祠堂|寺庙|河堤|粮仓|官道|名单|人名|暗号|口供|证据|账目|粮价|租税|逃户|流民|差役|主簿|县令|坊正|管事/u

function normalizeAnchorTerm(value = "") {
  return value
    .replace(/[^\p{Script=Han}A-Za-z0-9_-]+/gu, "")
    .trim()
}

function isUsefulContinuityAnchor(value: string, lockedProtagonistName = "") {
  const anchor = normalizeAnchorTerm(value)
  if (anchor.length < 2 || anchor.length > 12) return false
  if (lockedProtagonistName && anchor === lockedProtagonistName) return false
  if (CONTINUITY_ANCHOR_STOPWORDS.has(anchor)) return false
  if (/^(?:第?\d+章|chapter\d*)$/iu.test(anchor)) return false
  if (/^[一二三四五六七八九十百千万]+$/u.test(anchor)) return false
  return true
}

function scoreContinuityAnchor(text: string, anchor: string, lockedProtagonistName = "") {
  let score = 0
  if (extractChinesePersonNames(text, 40).includes(anchor)) score += 8
  if (CONTINUITY_KEYWORD_PATTERN.test(anchor)) score += 7
  if (new RegExp(`[「《“"]${anchor}[」》”"]`, "u").test(text)) score += 5
  if (/契|册|簿|信|印|粮|税|债|案|令|药|伤|血|门|市|衙|仓|牢|堤|价|租|流民|差役|主簿|县令|坊正|管事/u.test(anchor)) score += 3
  if (lockedProtagonistName && text.includes(lockedProtagonistName) && text.includes(anchor)) score += 1
  return score
}

function extractContinuityAnchors(input: {
  text: string
  lockedProtagonistName?: string
  limit?: number
}) {
  const text = input.text || ""
  const lockedProtagonistName = input.lockedProtagonistName || ""
  const rawAnchors: string[] = []

  rawAnchors.push(...extractChinesePersonNames(text, 30).filter((name) => name !== lockedProtagonistName))

  for (const match of text.matchAll(/[「《“"]([^」》”"\n]{2,12})[」》”"]/gu)) {
    rawAnchors.push(String(match[1] || ""))
  }

  for (const match of text.matchAll(new RegExp(`([\\p{Script=Han}]{0,4}(?:${CONTINUITY_KEYWORD_PATTERN.source})[\\p{Script=Han}]{0,4})`, "gu"))) {
    rawAnchors.push(String(match[1] || ""))
  }

  for (const line of text.split("\n")) {
    if (!/(上一章|本章|下一章|Foreshadowing|Character|Summary|伏笔|线索|物品|代价|关系|状态|未解决|承接|回收|延后)/iu.test(line)) {
      continue
    }
    for (const match of line.matchAll(/[\p{Script=Han}]{2,8}/gu)) {
      rawAnchors.push(String(match[0] || ""))
    }
  }

  const uniqueAnchors = uniqueStrings(rawAnchors.map(normalizeAnchorTerm))
    .filter((anchor) => isUsefulContinuityAnchor(anchor, lockedProtagonistName))
    .map((anchor) => ({
      anchor,
      score: scoreContinuityAnchor(text, anchor, lockedProtagonistName),
    }))
    .sort((left, right) => right.score - left.score || left.anchor.length - right.anchor.length)
    .map((item) => item.anchor)

  return uniqueStrings(uniqueAnchors).slice(0, input.limit ?? 10)
}

export function evaluateNarrativeStyleQuality(text = "") {
  const body = text
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|章节元数据|章节元信息)/u)[0] || ""

  const paragraphs = body.split(/\n+/u).map(p => p.trim()).filter(Boolean)
  const ultraShortParagraphs = paragraphs.filter(p => p.length > 0 && p.length <= 6)

  const fragments: string[] = []

  if (paragraphs.length >= 10 && ultraShortParagraphs.length / paragraphs.length > 0.15) {
    fragments.push(`超短段落（段落字数≤6）数量达 ${ultraShortParagraphs.length} 处，段落碎片化堆叠严重（占比达 ${Math.round(ultraShortParagraphs.length / paragraphs.length * 100)}%）。`)
  }

  const bodyNoPunc = body.replace(/[\s\p{Punctuation}\p{Script=Common}]/gu, "")
  const matchFrequencies = {
    "一僵": (bodyNoPunc.match(/一僵/g) || []).length,
    "一滞": (bodyNoPunc.match(/一滞/g) || []).length,
    "一缩": (bodyNoPunc.match(/一缩/g) || []).length,
    "一震": (bodyNoPunc.match(/一震/g) || []).length,
    "身体僵": (bodyNoPunc.match(/身体.{0,2}僵/g) || []).length,
    "瞳孔缩": (bodyNoPunc.match(/瞳孔.{0,2}缩/g) || []).length,
  }

  const highFreqs = Object.entries(matchFrequencies)
    .filter(([_, count]) => count >= 3)
    .map(([word, count]) => `「${word}」重复达 ${count} 次`)

  if (highFreqs.length > 0) {
    fragments.push(`套路性身体或感知描写高频重复：${highFreqs.join("；")}。`)
  }

  const isQuarantined = fragments.length > 0

  return {
    status: isQuarantined ? ("quarantined" as const) : ("eligible" as const),
    reason: isQuarantined
      ? `风格门禁拦截：${fragments.join(" ")} 请精简碎片化氛围词与高频肌肉/感知套路。`
      : "风格硬门槛通过：未发现高频短词/单字碎片化重复或高频套路描写。",
    fragments,
  }
}

function isSoftNarrativeStyleIssue(styleQuality: ReturnType<typeof evaluateNarrativeStyleQuality>) {
  return styleQuality.status === "quarantined"
    && styleQuality.fragments.length > 0
    && styleQuality.fragments.every((fragment) =>
      /超短段落|段落碎片|套路性身体|感知描写|高频重复/u.test(fragment)
    )
}

export function evaluateWritingResourceUsage(
  text = "",
  state?: AutonomousNovelState,
  task?: AutonomousNovelState["plan"]["chapterTasks"][number],
  blueprint = "",
  continuityContract?: ContinuityContract,
) {
  const body = text
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|章节元数据|章节元信息)/u)[0]
  const resourceTerms = uniqueStrings([
    ...[...blueprint.matchAll(/^- ([\p{Script=Han}]{2,8}):/gmu)].map((match) => match[1] || ""),
    ...(task?.causalPlan?.requiredContinuityAnchors || []),
    ...(continuityContract?.continuityAnchors || []),
  ]).filter((term) => isUsefulContinuityAnchor(term, continuityContract?.lockedProtagonistName || ""))
  const matchedTerms = resourceTerms.filter((term) => body.includes(term)).slice(0, 8)
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|写|划|敲|拦|避|追|停|跪|坐|起/gu) || []).length
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软/gu) || []).length
  const objectSignals = (body.match(/账册|密信|官印|钥匙|玉佩|粮袋|银钱|文书|案卷|药包|伤口|马车|城门|坊门|县衙|市集|粮仓|名单|证据|刀|剑|灯|门|桌|碗|纸/gu) || []).length
  const idiomLikeSentences = body
    .split(/[。！？!?；;\n]+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /^[\p{Script=Han}]{4,8}$/u.test(sentence))
  const stackedIdiomRun = body
    .split(/[。！？!?；;\n]+/u)
    .some((sentence) => {
      const shortSegments = sentence
        .split(/[，、,]/u)
        .map((segment) => segment.replace(/[^\p{Script=Han}]/gu, ""))
        .filter((segment) => segment.length >= 4 && segment.length <= 8)
      const idiomishSegments = shortSegments.filter((segment) =>
        /^[\p{Script=Han}]{4}$/u.test(segment)
        && /心|意|义|忠|耿|筹|略|深|虑|愤|慨|危|乱|转|惊|骇|悲|喜|忧|患|难|易|得|失|荣|辱|进|退/u.test(segment)
        && !/有人|对方|场景|关系|章节|上章|章末|词汇|高级|基础|展开|自然|选择|代价|线索|资源|身份|风险/u.test(segment)
      )
      return shortSegments.length >= 3 && idiomishSegments.length >= 2
    })
  const projectIdea = state?.project?.idea || ""
  const causalObjective = task?.causalPlan?.sceneObjective || ""
  const projectSignal = [projectIdea, causalObjective]
    .flatMap((value) => value.match(/[\p{Script=Han}]{2,6}/gu) || [])
    .filter((term) => !CONTINUITY_ANCHOR_STOPWORDS.has(term))
    .slice(0, 12)
    .some((term) => body.includes(term))

  const concreteSignals = actionSignals + sensorySignals + objectSignals
  if (stackedIdiomRun && concreteSignals < 4 && matchedTerms.length < 1 && !projectSignal) {
    return {
      status: "quarantined" as const,
      reason: "写作资源极端反模式：成语/短词连续堆叠，且缺少动作、感官、物件或项目锚点支撑。",
      matchedTerms,
    }
  }

  if (concreteSignals < 4 && matchedTerms.length < 1 && !projectSignal) {
    return {
      status: "warning" as const,
      reason: "写作资源吸收提示：正文缺少动作、感官、物件或项目关键词，资源落地感偏弱，但不作为硬阻塞。",
      matchedTerms,
    }
  }

  if (stackedIdiomRun || idiomLikeSentences.length >= 8) {
    return {
      status: "warning" as const,
      reason: "写作资源吸收提示：疑似存在成语/短词堆叠倾向，建议润色时改成动作、感官或因果句。",
      matchedTerms,
    }
  }

  return {
    status: "eligible" as const,
    reason: matchedTerms.length
      ? `写作资源吸收通过：正文自然命中 ${matchedTerms.slice(0, 5).join("、")} 等资源/锚点。`
      : "写作资源吸收通过：正文以动作、感官、物件和因果推进为主，未发现堆词反模式。",
    matchedTerms,
  }
}

function extractNarrativeBody(text = "") {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0]
}

function extractNumberFacts(text = "", limit = 10) {
  return uniqueStrings(text.match(/[第]?\d+(?:[.\d]*)?(?:章|年|月|日|天|夜|次|人|两|个|枚|封|件|步|里|刻|分|成|钱|两|万|千|百)?/gu) || [])
    .filter((fact) => /[0-9]/u.test(fact))
    .slice(0, limit)
}

function extractNegatedFacts(text = "", limit = 10) {
  return uniqueStrings(
    text
      .split(/[。！？!?；;\n]+/u)
      .map((line) => line.trim())
      .filter((line) => /不能|不得|不要|没有|未曾|不会|不许|禁止|无法|不再|不应/u.test(line))
      .map((line) => conciseEvidence(line, 120)),
  ).slice(0, limit)
}

function chineseNgrams(value: string, size: 2 | 3) {
  const compact = value.replace(/[^\p{Script=Han}0-9]+/gu, "")
  const grams: string[] = []
  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.push(compact.slice(index, index + size))
  }
  return grams
}

function hasNegatedFactEcho(afterBody: string, fact: string) {
  const keywords = uniqueStrings([
    ...chineseNgrams(fact, 2),
    ...chineseNgrams(fact, 3),
    ...(fact.match(/\d+(?:[.\d]*)?/gu) || []),
  ]).filter((word) => !/不能|不得|不要|没有|未曾|不会|不许|禁止|无法|不再|不应|必须|只是|已经|仍然/u.test(word))
  if (keywords.length < 3) {
    return /不能|不得|不要|没有|未曾|不会|不许|禁止|无法|不再|不应/u.test(afterBody)
  }
  const matchedKeywords = keywords.filter((word) => afterBody.includes(word)).length
  return matchedKeywords >= Math.min(5, Math.max(3, Math.floor(keywords.length * 0.18)))
    && /不能|不得|不要|没有|未曾|不会|不许|禁止|无法|不再|不应/u.test(afterBody)
}

function extractSemanticFactAnchors(input: {
  text: string
  continuityContract: ContinuityContract
  characterProfileContract: CharacterProfileContract
}) {
  const names = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...(input.continuityContract.requiredNames || []),
    ...(input.continuityContract.knownCast || []),
    ...(input.characterProfileContract.knownCast || []),
  ].filter(Boolean)).slice(0, 16)
  const anchors = uniqueStrings([
    ...(input.continuityContract.continuityAnchors || []),
    ...(input.continuityContract.hardRules || []),
    ...(input.continuityContract.previousChapterLedger || []).filter((line) => /失去|获得|拿到|交给|欠|承诺|死亡|受伤|密信|官印|账|规则|不能|不得|没有|必须/u.test(line)),
  ]).slice(0, 18)
  return {
    names,
    anchors,
    numbers: extractNumberFacts(input.text),
    negatedFacts: extractNegatedFacts(input.text),
  }
}

export function evaluateSemanticPreservation(input: {
  beforeDraft: string
  afterDraft: string
  continuityContract: ContinuityContract
  characterProfileContract: CharacterProfileContract
}): SemanticPreservationReport {
  const beforeBody = extractNarrativeBody(input.beforeDraft)
  const afterBody = extractNarrativeBody(input.afterDraft)
  const facts = extractSemanticFactAnchors({
    text: beforeBody,
    continuityContract: input.continuityContract,
    characterProfileContract: input.characterProfileContract,
  })
  const requiredFacts = uniqueStrings([
    ...facts.names,
    ...facts.anchors,
  ]).slice(0, 24)
  const missingFacts = requiredFacts.filter((fact) => fact && beforeBody.includes(fact) && !afterBody.includes(fact)).slice(0, 12)
  const missingNumbers = facts.numbers.filter((fact) => beforeBody.includes(fact) && !afterBody.includes(fact)).slice(0, 6)
  const missingNegatedFacts = facts.negatedFacts
    .filter((fact) => fact.length >= 6 && !hasNegatedFactEcho(afterBody, fact))
    .slice(0, 6)
  const changedFacts = uniqueStrings([
    ...missingNumbers.map((fact) => `数字/数量事实丢失：${fact}`),
    ...missingNegatedFacts.map((fact) => `否定约束丢失：${fact}`),
  ]).slice(0, 10)
  const preservedFacts = uniqueStrings([
    ...requiredFacts.filter((fact) => afterBody.includes(fact)),
    ...facts.numbers.filter((fact) => afterBody.includes(fact)).map((fact) => `number:${fact}`),
    ...facts.negatedFacts.filter((fact) => afterBody.includes(fact)).map((fact) => `negation:${fact}`),
  ]).slice(0, 16)
  const status = changedFacts.length > 0 || missingFacts.length >= 2
    ? "drifted"
    : missingFacts.length === 1
      ? "at_risk"
      : "preserved"
  return {
    status,
    missingFacts,
    changedFacts,
    preservedFacts,
    reason: status === "preserved"
      ? "语义保真通过：自然化后保留了锁定角色、连续性锚点、数量事实和否定约束。"
      : `语义保真${status === "drifted" ? "失败" : "有风险"}：${[...missingFacts, ...changedFacts].slice(0, 4).join("；")}`,
  }
}

export function createNaturalnessReport(input: {
  beforeDraft: string
  afterDraft: string
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  continuityContract: ContinuityContract
  characterProfileContract: CharacterProfileContract
}): NaturalnessReport {
  const body = extractNarrativeBody(input.afterDraft)
  const sentences = body.split(/[。！？!?；;\n]+/u).map((part) => part.trim()).filter(Boolean)
  const wordTotal = Math.max(1, wordCount(body))
  const dialogueCount = (body.match(/[「“][^」”]{2,120}[」”]/gu) || []).length
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|跪|坐|起|握|松|咬|皱眉|沉默/gu) || []).length
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软|烫|凉/gu) || []).length
  const aiSummarySignals = (body.match(/由此可见|不难看出|事实上|显然|总而言之|综上|这意味着|他终于明白|命运的齿轮|这一刻.*命运|内心开阔|复杂的情绪|无法言喻|说不出的感觉|某种意义上/gu) || []).length
  const analyticSignals = (body.match(/第一|第二|首先|其次|最后|原因是|从.*角度|可以看出|体现了|说明了|证明了/gu) || []).length
  const emotionLabelSignals = (body.match(/愤怒|悲伤|恐惧|绝望|震惊|激动|开心|难过|复杂|崩溃|释然/gu) || []).length
  const fatigueWordSignals = (body.match(/突然|忽然|猛然|竟然|居然|渐渐|逐渐|然而|与此同时|似乎|也许|大概|仿佛/gu) || []).length
  const characterPresence = evaluateCharacterProfilePresence(input.afterDraft, input.characterProfileContract)
  const styleQuality = evaluateNarrativeStyleQuality(input.afterDraft)
  const plotContinuity = evaluatePlotContinuityBridge(input.afterDraft, input.task, input.continuityContract)
  const semanticPreservation = evaluateSemanticPreservation({
    beforeDraft: input.beforeDraft,
    afterDraft: input.afterDraft,
    continuityContract: input.continuityContract,
    characterProfileContract: input.characterProfileContract,
  })
  const preservedFacts = uniqueStrings([
    ...semanticPreservation.preservedFacts,
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.requiredNames,
    ...input.continuityContract.continuityAnchors.filter((anchor) => input.afterDraft.includes(anchor)),
  ].filter(Boolean)).slice(0, 16)
  const riskFlags = [
    ...(styleQuality.status === "quarantined" ? [styleQuality.reason] : []),
    ...(plotContinuity.status === "quarantined" ? [plotContinuity.reason] : []),
    ...(characterPresence.status === "quarantined" ? [characterPresence.reason] : []),
    ...(semanticPreservation.status === "drifted" ? [semanticPreservation.reason] : []),
    ...(semanticPreservation.status === "at_risk" ? [semanticPreservation.reason] : []),
    ...(aiSummarySignals >= 3 ? [`总结腔/AI 旁白信号过多：${aiSummarySignals}`] : []),
    ...(analyticSignals >= 5 ? [`分析报告腔信号过多：${analyticSignals}`] : []),
    ...(emotionLabelSignals > Math.max(8, Math.floor(wordTotal / 450)) && actionSignals < emotionLabelSignals
      ? [`情绪标签多于动作外化：emotion=${emotionLabelSignals}, action=${actionSignals}`]
      : []),
    ...(dialogueCount === 0 && wordTotal > 900 ? ["长章节缺少对白，角色声音不够自然。"] : []),
    ...(actionSignals + sensorySignals < Math.max(6, Math.floor(wordTotal / 350)) ? ["动作/感官信号不足，文本可能偏摘要。"] : []),
    ...(fatigueWordSignals >= 5 ? [`AI 写作疲劳词（突然/然而/与此同时/仿佛等）高频堆积达 ${fatigueWordSignals} 次`] : []),
  ]
  const changedBlocks = input.beforeDraft === input.afterDraft
    ? 0
    : Math.abs(input.afterDraft.split(/\n{2,}/u).length - input.beforeDraft.split(/\n{2,}/u).length)
      + (input.afterDraft.length === input.beforeDraft.length ? 1 : Math.max(1, Math.round(Math.abs(input.afterDraft.length - input.beforeDraft.length) / 500)))
  const score = Math.max(0, Math.min(10, 10 - riskFlags.length * 2 - Math.max(0, aiSummarySignals - 1) - Math.max(0, analyticSignals - 3) - Math.max(0, Math.floor(fatigueWordSignals / 2))))
  const status = semanticPreservation.status === "drifted"
    ? "blocked"
    : riskFlags.some((flag) => /硬门槛失败|连续性|角色档案硬门槛|阻塞/u.test(flag))
    ? "blocked"
    : riskFlags.length > 0
      ? "needs_revision"
    : score >= 7
      ? "passed"
      : "needs_revision"
  return {
    status,
    score,
    reason: status === "passed"
      ? "自然度门禁通过：文本以动作、感官、对白、关系压力和具体选择呈现，未发现阻塞性 AI 味。"
      : `自然度门禁${status === "blocked" ? "阻塞" : "需要返工"}：${riskFlags.slice(0, 4).join("；") || "自然表达信号不足。"}`,
    changedBlocks,
    riskFlags,
    preservedFacts,
    semanticPreservation,
    patchSummary: [
      changedBlocks > 0 ? `文本发生约 ${changedBlocks} 个块级变化。` : "未发生块级变化或使用确定性整理稿。",
      `对白数：${dialogueCount}；动作信号：${actionSignals}；感官信号：${sensorySignals}。`,
      semanticPreservation.reason,
      characterPresence.reason,
    ],
  }
}

function formatNaturalnessReport(report: NaturalnessReport) {
  return [
    "## Naturalness Report",
    `- Status: ${report.status}`,
    `- Score: ${report.score}/10`,
    `- Reason: ${report.reason}`,
    `- Changed blocks: ${report.changedBlocks}`,
    `- Preserved facts: ${report.preservedFacts.length ? report.preservedFacts.join("、") : "none"}`,
    "",
    "### Semantic Preservation",
    `- Status: ${report.semanticPreservation.status}`,
    `- Reason: ${report.semanticPreservation.reason}`,
    `- Missing facts: ${report.semanticPreservation.missingFacts.length ? report.semanticPreservation.missingFacts.join("、") : "none"}`,
    `- Changed facts: ${report.semanticPreservation.changedFacts.length ? report.semanticPreservation.changedFacts.join("、") : "none"}`,
    "",
    "### Risk Flags",
    ...(report.riskFlags.length ? report.riskFlags.map((flag) => `- ${flag}`) : ["- none"]),
    "",
    "### Patch Summary",
    ...report.patchSummary.map((line) => `- ${line}`),
  ].join("\n")
}

export function evaluatePlotContinuityBridge(
  finalDraft: string,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  continuityContract: ContinuityContract,
) {
  if (task.chapterNumber <= 1) {
    return {
      status: "eligible" as const,
      reason: "首章不需要承接上一章锚点。",
      matchedAnchors: [] as string[],
      requiredAnchors: [] as string[],
    }
  }
  const anchors = continuityContract.continuityAnchors.filter((anchor) => isUsefulContinuityAnchor(anchor, continuityContract.lockedProtagonistName))
  if (anchors.length === 0) {
    return {
      status: "eligible" as const,
      reason: "暂无可用上一章连续性锚点；本章按主线和蓝图承接。",
      matchedAnchors: [] as string[],
      requiredAnchors: [] as string[],
    }
  }
  const requiredCount = Math.min(2, anchors.length)
  const matchedAnchors = anchors.filter((anchor) => finalDraft.includes(anchor))
  if (matchedAnchors.length < requiredCount) {
    return {
      status: "quarantined" as const,
      reason: `章节连续性硬门槛失败：正文只承接 ${matchedAnchors.length}/${requiredCount} 个上一章锚点。缺少：${anchors.filter((anchor) => !matchedAnchors.includes(anchor)).slice(0, requiredCount).join("、")}。`,
      matchedAnchors,
      requiredAnchors: anchors.slice(0, Math.max(requiredCount, 4)),
    }
  }
  return {
    status: "eligible" as const,
    reason: `章节连续性通过：已承接上一章锚点 ${matchedAnchors.slice(0, 4).join("、")}。`,
    matchedAnchors,
    requiredAnchors: anchors.slice(0, Math.max(requiredCount, 4)),
  }
}

async function retrieveWritingKnowledgeContext(input: {
  state: AutonomousNovelState
  task?: AutonomousNovelState["plan"]["chapterTasks"][number]
  options: ProductionPipelineOptions
  purpose: "blueprint" | "draft" | "quality" | "polish"
  query: string
  sourceTypes?: string[]
  limit?: number
}) {
  if (!input.options.factoryRootDir || !input.options.projectId) {
    return {
      rows: [],
      prompt: "No knowledge database is attached to this run.",
    }
  }
  const rows = await retrieveKnowledge({
    rootDir: input.options.factoryRootDir,
    projectId: input.options.projectId,
    query: [
      input.state.project.title,
      input.state.project.idea,
      input.task ? `Chapter ${input.task.chapterNumber}: ${input.task.title}` : "",
      input.task?.summary || "",
      input.query,
    ].filter(Boolean).join("\n"),
    scopes: ["project", "global"],
    sourceTypes: input.sourceTypes,
    limit: input.limit ?? 8,
    runId: input.options.directorCommandId ?? null,
    recordCitation: true,
  }).catch(() => [])
  return {
    rows,
    prompt: formatKnowledgeForPrompt(rows, input.limit ?? 8),
  }
}

class CacheTracker {
  hits = 0
  misses = 0
}
export const memoryCacheTracker = new CacheTracker()
export const resourcesCacheTracker = new CacheTracker()

export function invalidateAllCaches() {
  factoryMemoryContextCache.clear()
  productionWritingResourcesCache.clear()
}

export function invalidateProjectCache(projectId: string, chapterNumber?: number) {
  for (const key of factoryMemoryContextCache.keys()) {
    const parts = key.split("\u001f")
    const keyProjId = parts[1]
    const keyChapNum = parts[2]
    if (keyProjId === projectId) {
      if (chapterNumber === undefined || Number(keyChapNum) === chapterNumber) {
        factoryMemoryContextCache.delete(key)
      }
    }
  }
}

export function invalidateWritingResourcesCache() {
  productionWritingResourcesCache.clear()
}

const FACTORY_MEMORY_CONTEXT_CACHE_TTL_MS = 5_000
const FACTORY_MEMORY_CONTEXT_CACHE_LIMIT = 80
const factoryMemoryContextCache = new Map<string, { value: string; expiresAt: number }>()

function setFactoryMemoryContextCache(key: string, value: string, now = Date.now()) {
  factoryMemoryContextCache.set(key, { value, expiresAt: now + FACTORY_MEMORY_CONTEXT_CACHE_TTL_MS })
  while (factoryMemoryContextCache.size > FACTORY_MEMORY_CONTEXT_CACHE_LIMIT) {
    const oldestKey = factoryMemoryContextCache.keys().next().value
    if (!oldestKey) break
    factoryMemoryContextCache.delete(oldestKey)
  }
}

export async function retrieveFactoryMemoryContext(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  options: ProductionPipelineOptions
  continuityContract: ContinuityContract
  limit?: number
}) {
  if (!input.options.factoryRootDir || !input.options.projectId) {
    return ""
  }
  const query = [
    input.state.project.title,
    input.state.project.idea,
    `Chapter ${input.task.chapterNumber}: ${input.task.title}`,
    input.task.summary,
    input.continuityContract.lockedProtagonistName || "",
    "character_dossiers chapter_summary profile signal behavior speech appearance relationship",
  ].filter(Boolean).join("\n")
  const cacheKey = [
    input.options.factoryRootDir,
    input.options.projectId,
    input.task.chapterNumber,
    input.task.title,
    input.continuityContract.lockedProtagonistName || "",
    input.limit ?? 5,
    query,
  ].join("\u001f")
  const cached = factoryMemoryContextCache.get(cacheKey)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    memoryCacheTracker.hits++
    return cached.value
  }
  memoryCacheTracker.misses++
  const context = await withFactoryDb(input.options.factoryRootDir, async (db) => {
    const rows = db.recallMemory(input.options.projectId as string, query, input.limit ?? 5, {
      embedding: createLocalTextEmbedding(query),
    })
    const selected = rows.filter((row) => ["character_dossiers", "chapter_summary"].includes(String(row.kind)))
    if (!selected.length) return ""
    return [
      "Factory Memory Recall:",
      ...selected.slice(0, input.limit ?? 5).map((row) => [
        `- ${row.kind}: ${row.source}`,
        String(row.content || "").slice(0, String(row.kind) === "character_dossiers" ? 900 : 420),
      ].join("\n")),
    ].join("\n")
  }).catch(() => "")
  setFactoryMemoryContextCache(cacheKey, context, now)
  return context
}

function getArcLabel(state: AutonomousNovelState, chapterNumber: number) {
  const arcSize = Math.max(3, Math.ceil(state.plan.totalChapters / 4))
  const arcNumber = Math.ceil(chapterNumber / arcSize)
  const start = (arcNumber - 1) * arcSize + 1
  const end = Math.min(state.plan.totalChapters, start + arcSize - 1)
  return `第 ${arcNumber} 弧（第 ${start}-${end} 章）`
}

function defaultCausalPlan(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
) {
  const arcLabel = getArcLabel(state, task.chapterNumber)
  return {
    previousInput: task.chapterNumber <= 1
      ? "承接原始创作目标和设定冻结结论，建立唯一主角、核心缺口和第一条主线线索。"
      : `承接第 ${task.chapterNumber - 1} 章留下的状态、物件、关系、代价和未解决问题。`,
    sceneObjective: `围绕「${state.project.idea}」在${arcLabel}完成一次具体情节推进，不能只做设定说明。`,
    protagonistDecision: "主角必须在可见压力下主动做出选择，选择要改变局势或关系。",
    irreversibleConsequence: "本章结尾必须留下身份风险、关系裂缝、线索暴露、资源损失或世界规则后果至少一项。",
    nextHandoff: task.chapterNumber >= state.plan.totalChapters
      ? "把全书核心承诺兑现为结局余味。"
      : `把本章不可逆变化交给第 ${task.chapterNumber + 1} 章继续处理。`,
    requiredContinuityAnchors: task.chapterNumber <= 1
      ? ["主角唯一身份", "核心缺口", "第一枚主线线索"]
      : ["上一章关键物件", "上一章关系变化", "上一章未解决问题", "上一章代价"],
    characterStateDelta: "角色状态必须发生可追踪变化，并进入记忆账本。",
    foreshadowingOperation: "新增、推进或回收一个可追踪伏笔，并明确它与主线或角色伤口的关系。",
  }
}

function getTaskCausalPlan(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
) {
  return {
    ...defaultCausalPlan(state, task),
    ...(task.causalPlan || {}),
    requiredContinuityAnchors: task.causalPlan?.requiredContinuityAnchors?.length
      ? task.causalPlan.requiredContinuityAnchors
      : defaultCausalPlan(state, task).requiredContinuityAnchors,
  }
}

function formatCausalPlanBullets(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
) {
  const causalPlan = getTaskCausalPlan(state, task)
  return [
    `- Previous Input: ${causalPlan.previousInput}`,
    `- Causal Objective: ${causalPlan.sceneObjective}`,
    `- Protagonist Decision: ${causalPlan.protagonistDecision}`,
    `- Irreversible Change: ${causalPlan.irreversibleConsequence}`,
    `- Character State Delta: ${causalPlan.characterStateDelta}`,
    `- Required Continuity Anchors: ${causalPlan.requiredContinuityAnchors.join("、")}`,
    `- Foreshadowing Operation: ${causalPlan.foreshadowingOperation}`,
    `- Next Chapter Handoff: ${causalPlan.nextHandoff}`,
  ]
}

function formatChapterCausalityMatrix(state: AutonomousNovelState, limit = Number.POSITIVE_INFINITY) {
  const tasks = state.plan.chapterTasks.slice(0, limit)
  return [
    "| Chapter | Previous Input | Causal Objective | Protagonist Decision | Irreversible Change | Next Handoff | Required Anchors |",
    "|---:|---|---|---|---|---|---|",
    ...tasks.map((task) => {
      const plan = getTaskCausalPlan(state, task)
      return `| ${task.chapterNumber} | ${plan.previousInput} | ${plan.sceneObjective} | ${plan.protagonistDecision} | ${plan.irreversibleConsequence} | ${plan.nextHandoff} | ${plan.requiredContinuityAnchors.join("、")} |`
    }),
    state.plan.chapterTasks.length > limit ? `| ... | 其余章节遵循同一承接-选择-代价-交棒合同，完整任务在 state.chapterTasks 中。 |  |  |  |  |  |` : "",
  ].filter(Boolean)
}

function formatContinuityAnchorPlan(state: AutonomousNovelState, limit = Number.POSITIVE_INFINITY) {
  return state.plan.chapterTasks.slice(0, limit).map((task) => {
    const plan = getTaskCausalPlan(state, task)
    return `- 第 ${task.chapterNumber} 章：必须使用/建立 ${plan.requiredContinuityAnchors.join("、")}；写完后 Memory Keeper 输出下一章可追踪锚点。`
  })
}

function formatCharacterStateLedgerPlan(state: AutonomousNovelState, limit = Number.POSITIVE_INFINITY) {
  return state.plan.chapterTasks.slice(0, limit).map((task) => {
    const plan = getTaskCausalPlan(state, task)
    return `- 第 ${task.chapterNumber} 章：${plan.characterStateDelta}`
  })
}

function formatForeshadowingPayoffSchedule(state: AutonomousNovelState, limit = Number.POSITIVE_INFINITY) {
  return state.plan.chapterTasks.slice(0, limit).map((task) => {
    const plan = getTaskCausalPlan(state, task)
    return `- 第 ${task.chapterNumber} 章：${plan.foreshadowingOperation}`
  })
}

function formatVolumeStrategy(state: AutonomousNovelState) {
  const volumeSize = Math.max(6, Math.ceil(state.plan.totalChapters / 3))
  const volumes = Array.from({ length: Math.ceil(state.plan.totalChapters / volumeSize) }, (_, index) => {
    const start = index * volumeSize + 1
    const end = Math.min(state.plan.totalChapters, start + volumeSize - 1)
    const firstTask = state.plan.chapterTasks[start - 1]
    const lastTask = state.plan.chapterTasks[end - 1]
    const firstPlan = firstTask ? getTaskCausalPlan(state, firstTask) : null
    const lastPlan = lastTask ? getTaskCausalPlan(state, lastTask) : null
    return [
      `### 第 ${index + 1} 卷：第 ${start}-${end} 章`,
      `- 卷目标：从「${firstPlan?.previousInput || state.project.idea}」推进到「${lastPlan?.nextHandoff || state.project.idea}」。`,
      `- 读者兑现：每卷必须完成一次局部答案，同时把更大问题推向下一卷。`,
      `- 角色压力：本卷至少让主角付出一次资源、关系、身份或信念代价。`,
      `- 伏笔策略：本卷至少新增 2 个伏笔，回收或变形兑现 1 个伏笔。`,
    ].join("\n")
  })
  return volumes
}

const PRODUCTION_STORY_MARKDOWN_ASSET_FILES = [
  "world-matrix.md",
  "plot-architecture.md",
  "story-bible.md",
  "volume-strategy.md",
  "foreshadowing-ledger.md",
  "character-dynamics.md",
]

const PRODUCTION_STORY_STRUCTURED_ASSET_FILES = [
  "story-foundation-contract.json",
  "world-matrix.json",
  "plot-architecture.json",
  "story-bible.json",
  "volume-strategy.json",
  "foreshadowing-ledger.json",
  "character-dynamics.json",
]

const PRODUCTION_STORY_ASSET_FILES = [
  ...PRODUCTION_STORY_MARKDOWN_ASSET_FILES,
  ...PRODUCTION_STORY_STRUCTURED_ASSET_FILES,
]

function extractStoryAssetRelevantLines(content: string, task: AutonomousNovelState["plan"]["chapterTasks"][number], maxLines = 18) {
  const chapterNumber = task.chapterNumber
  const trimmed = content.trim()
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, any>
      const matchingChapter = [
        ...(Array.isArray(parsed?.plot?.chapters) ? parsed.plot.chapters : []),
        ...(Array.isArray(parsed?.chapters) ? parsed.chapters : []),
        ...(Array.isArray(parsed?.timeline) ? parsed.timeline : []),
      ].find((entry: Record<string, any>) => Number(entry?.chapterNumber) === chapterNumber)
      const matchingForeshadowing = [
        ...(Array.isArray(parsed?.foreshadowing?.entries) ? parsed.foreshadowing.entries : []),
        ...(Array.isArray(parsed?.entries) ? parsed.entries : []),
      ].filter((entry: Record<string, any>) => Number(entry?.sourceChapter || entry?.chapterNumber) === chapterNumber)
      const matchingCharacterDelta = [
        ...(Array.isArray(parsed?.characters?.stateDeltas) ? parsed.characters.stateDeltas : []),
        ...(Array.isArray(parsed?.characterStateDeltas) ? parsed.characterStateDeltas : []),
        ...(Array.isArray(parsed?.chapterStateDeltas) ? parsed.chapterStateDeltas : []),
      ].find((entry: Record<string, any>) => Number(entry?.chapterNumber) === chapterNumber)
      const lines = [
        parsed?.project?.title ? `- Project: ${parsed.project.title}` : "",
        parsed?.genre?.readerPromise ? `- Reader Promise: ${parsed.genre.readerPromise}` : "",
        parsed?.readerPromise ? `- Reader Promise: ${parsed.readerPromise}` : "",
        matchingChapter?.title ? `- Chapter: ${matchingChapter.chapterNumber} ${matchingChapter.title}` : "",
        matchingChapter?.sceneObjective ? `- Causal Objective: ${matchingChapter.sceneObjective}` : "",
        matchingChapter?.previousInput ? `- Previous Input: ${matchingChapter.previousInput}` : "",
        matchingChapter?.protagonistDecision ? `- Protagonist Decision: ${matchingChapter.protagonistDecision}` : "",
        matchingChapter?.irreversibleConsequence ? `- Irreversible Change: ${matchingChapter.irreversibleConsequence}` : "",
        matchingChapter?.nextHandoff ? `- Next Handoff: ${matchingChapter.nextHandoff}` : "",
        matchingCharacterDelta?.delta ? `- Character Delta: ${matchingCharacterDelta.delta}` : "",
        ...matchingForeshadowing.slice(0, 3).map((entry: Record<string, any>) => `- Foreshadowing: ${entry.operation || entry.expectedAdvance || entry.status}`),
        ...(Array.isArray(parsed?.rules) ? parsed.rules.slice(0, 3).map((rule: any) => `- Rule: ${typeof rule === "string" ? rule : rule.rule || rule.execution || JSON.stringify(rule)}`) : []),
      ].filter(Boolean)
      return uniqueStrings(lines).slice(0, maxLines)
    } catch {
      return []
    }
  }
  const chapterPatterns = [
    new RegExp(`第\\s*${chapterNumber}\\s*章`, "u"),
    new RegExp(`Chapter\\s*${chapterNumber}\\b`, "iu"),
    new RegExp(`\\|\\s*${chapterNumber}\\s*\\|`, "u"),
  ]
  const importantPattern = /Frozen World Rules|Non-Negotiable|Causal Spine|Chapter Causality Matrix|Continuity Anchor|Foreshadowing|Character State|Core Relationship|Volume Contract|Reader Promise|Style Contract|Protagonist|Ledger Rules|Escalation Rules|Required Dossier/u
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const selected: string[] = []
  for (const line of lines) {
    const isHeading = /^#{1,3}\s+/u.test(line) && importantPattern.test(line)
    const isChapterLine = chapterPatterns.some((pattern) => pattern.test(line))
    const isRuleLine = /^[-*]\s+/u.test(line) && importantPattern.test(line)
    if (isHeading || isChapterLine || isRuleLine) {
      selected.push(line)
    }
    if (selected.length >= maxLines) break
  }
  if (selected.length === 0) {
    return lines
      .filter((line) => /^#{1,3}\s+/u.test(line) || /^[-*]\s+/u.test(line))
      .slice(0, Math.max(6, Math.floor(maxLines / 2)))
  }
  return selected
}

export async function loadProductionStoryAssetContext(
  paths: NovelWorkspacePaths,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  maxChars = 2200,
): Promise<ProductionStoryAssetContext> {
  const sections: string[] = []
  const files: string[] = []

  for (const filename of PRODUCTION_STORY_ASSET_FILES) {
    const content = await readOptionalText(path.join(paths.plansDir, filename))
    if (!content) continue
    const relevant = extractStoryAssetRelevantLines(content, task)
    if (!relevant.length) continue
    files.push(filename)
    const section = [
      `### ${filename}`,
      ...relevant,
    ].join("\n")
    sections.push(section.length > 520 ? `${section.slice(0, 520).trim()}\n...[${filename} clipped]` : section)
  }

  if (!sections.length) {
    return { prompt: "", files: [] }
  }

  const prompt = [
    "## Production Story Asset Context",
    "",
    "这些内容来自已冻结的前置故事资产。蓝图和正文必须服从它们；如与临时上下文冲突，以本资产摘要为准。",
    "",
    ...sections,
  ].join("\n\n")

  return {
    prompt: prompt.length > maxChars ? `${prompt.slice(0, maxChars).trim()}\n...[story assets clipped]` : prompt,
    files,
  }
}

export function createProductionStoryBibleAssets(
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
  resources: ProductionWritingResources,
): ProductionStoryBibleAsset[] {
  const genre = inferGenreProfile(state)
  const consensus = context.consensus || "尚无额外共识；以项目初始目标作为最高约束。"
  const protagonist = context.protagonist || "主角档案待补齐；本阶段必须至少冻结主角身份、欲望、伤口和行动方式。"
  const style = context.style || "写法尚未完全冻结；进入正文前仍必须完成用户确认的写法样段。"
  const chapterMatrix = formatChapterCausalityMatrix(state)
  const continuityPlan = formatContinuityAnchorPlan(state)
  const characterLedgerPlan = formatCharacterStateLedgerPlan(state)
  const foreshadowingPlan = formatForeshadowingPayoffSchedule(state)
  const volumeStrategy = formatVolumeStrategy(state)
  const projectKey = stableAssetId(`${state.project.title}-${state.project.createdAt}`, "project")
  const resourceSignals = [
    `- Style guide loaded: ${resources.styleGuide ? "yes" : "no"}`,
    `- Vocabulary resources loaded: ${resources.vocabularySamples.length}`,
    `- Few-shot examples loaded: ${resources.examples.length}`,
  ]
  const protagonistName = lockedProtagonistFromState(state, protagonist)
    || extractChinesePersonNames(protagonist, 1)[0]
    || "待冻结主角"
  const chapterContracts = state.plan.chapterTasks.map((task) => {
    const causalPlan = getTaskCausalPlan(state, task)
    return {
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: task.status,
      targetWords: task.targetWords,
      summary: task.summary,
      previousInput: causalPlan.previousInput,
      sceneObjective: causalPlan.sceneObjective,
      protagonistDecision: causalPlan.protagonistDecision,
      irreversibleConsequence: causalPlan.irreversibleConsequence,
      characterStateDelta: causalPlan.characterStateDelta,
      requiredContinuityAnchors: causalPlan.requiredContinuityAnchors,
      foreshadowingOperation: causalPlan.foreshadowingOperation,
      nextHandoff: causalPlan.nextHandoff,
    }
  })
  const continuityAnchors = uniqueStrings(chapterContracts.flatMap((chapter) => chapter.requiredContinuityAnchors)).slice(0, 80)
  const structuredWorldRules = [
    {
      id: "core-idea-boundary",
      rule: "世界规则必须服务核心创意，不允许为了单章爽点临时改规则。",
      execution: "每次新增设定都要落到人物选择、资源代价或社会压力。",
      source: "world-matrix.md",
    },
    {
      id: "scene-first-worldbuilding",
      rule: "不允许整段解释世界观。",
      execution: "设定必须嵌入冲突、对话、证据或行动。",
      source: "world-matrix.md",
    },
    {
      id: "chapter-cost-rule",
      rule: "每章至少让一个世界规则改变角色的选择成本。",
      execution: "章节蓝图必须说明该规则如何制造代价。",
      source: "world-matrix.md",
    },
  ]
  const foreshadowingEntries = chapterContracts.map((chapter) => ({
    id: `foreshadowing-${String(chapter.chapterNumber).padStart(3, "0")}`,
    sourceChapter: chapter.chapterNumber,
    sourceTitle: chapter.title,
    operation: chapter.foreshadowingOperation,
    status: "planned",
    expectedAdvance: chapter.nextHandoff,
    payoffMode: chapter.chapterNumber >= state.plan.totalChapters
      ? "final_payoff"
      : chapter.chapterNumber >= Math.max(1, state.plan.totalChapters - 1)
        ? "late_payoff"
        : "advance_or_reframe",
    linkedAnchors: chapter.requiredContinuityAnchors,
  }))
  const timelineEntries = chapterContracts.map((chapter) => ({
    id: `chapter-${String(chapter.chapterNumber).padStart(3, "0")}`,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    previousInput: chapter.previousInput,
    event: chapter.sceneObjective,
    decision: chapter.protagonistDecision,
    irreversibleChange: chapter.irreversibleConsequence,
    nextState: chapter.nextHandoff,
  }))
  const relationshipEntries = [
    {
      id: stableAssetId(protagonistName, "protagonist"),
      name: protagonistName,
      role: "protagonist",
      desire: "待由人物档案冻结；必须与核心创意和章节因果链一致。",
      woundOrFear: "待由人物档案冻结；正文前必须补齐。",
      behaviorHabit: "待由人物档案冻结；不得在章节间重置。",
      speechMarker: "待由人物档案冻结；用于区分对白声音。",
      relationshipPressure: "由每章 characterStateDelta 推进。",
    },
  ]
  const characterStateDeltas = chapterContracts.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    delta: chapter.characterStateDelta,
    requiredMemoryWrite: true,
  }))
  const volumeContracts = volumeStrategy.map((summary, index) => ({
    id: `volume-${index + 1}`,
    title: summary.match(/^###\s+(.+)$/mu)?.[1] || `第 ${index + 1} 卷`,
    summary,
    status: "planned",
    requiredChange: "卷尾必须改变主角位置、关系网络或世界认知。",
  }))
  const storyFoundationContract = {
    version: 1,
    generatedBy: "production-story-bible-assets",
    project: {
      key: projectKey,
      title: state.project.title,
      idea: state.project.idea,
      totalChapters: state.plan.totalChapters,
      chapterWordTarget: state.plan.chapterWordTarget,
    },
    genre: {
      profile: genre.genre,
      readerPromise: genre.readerPromise,
      pointOfView: genre.pointOfView,
      tone: genre.tone,
    },
    gates: {
      markdownAssets: PRODUCTION_STORY_MARKDOWN_ASSET_FILES,
      structuredAssets: PRODUCTION_STORY_STRUCTURED_ASSET_FILES,
      mustPassBeforeDrafting: [
        "core_consensus",
        "story_foundation",
        "character_dynamics",
        "chapter_blueprints",
        "style_approval",
      ],
    },
    consensus: {
      text: consensus,
      protagonist,
      styleCarryover: style,
    },
    world: {
      rules: structuredWorldRules,
      continuityAnchors,
    },
    plot: {
      causalModel: "previous_input -> scene_objective -> protagonist_decision -> irreversible_change -> next_handoff",
      chapters: chapterContracts,
      timeline: timelineEntries,
    },
    characters: {
      protagonist: protagonistName,
      relationshipEntries,
      stateDeltas: characterStateDeltas,
      requiredDossierFields: [
        "canonical name",
        "identity and role function",
        "core desire",
        "fear or wound",
        "behavior habit",
        "speech marker",
        "appearance or body marker",
        "skill, limitation, and cost",
        "relationship state",
      ],
    },
    foreshadowing: {
      ledgerRules: [
        "每条伏笔必须有来源章节、当前状态、预计推进点和回收方式。",
        "伏笔可以延后，但不能无限悬空；延后必须增加压力或改变读者理解。",
        "伏笔回收必须通过场景事实兑现，不能只让角色口头解释。",
      ],
      entries: foreshadowingEntries,
    },
    volumes: volumeContracts,
    resources: {
      styleGuideLoaded: Boolean(resources.styleGuide),
      vocabularySamples: resources.vocabularySamples.length,
      examples: resources.examples.length,
    },
  }
  const structuredAssets = [
    {
      filename: "story-foundation-contract.json",
      title: "Story Foundation Contract",
      stage: "story_foundation_contract",
      value: storyFoundationContract,
    },
    {
      filename: "world-matrix.json",
      title: "World Matrix JSON",
      stage: "world_matrix_structured",
      value: {
        version: 1,
        projectKey,
        title: state.project.title,
        genre: storyFoundationContract.genre,
        rules: structuredWorldRules,
        continuityAnchors,
        sourceConsensus: consensus,
        protagonistPressureInterface: protagonist,
      },
    },
    {
      filename: "plot-architecture.json",
      title: "Plot Architecture JSON",
      stage: "plot_architecture_structured",
      value: {
        version: 1,
        causalModel: storyFoundationContract.plot.causalModel,
        chapters: chapterContracts,
        timeline: timelineEntries,
        escalationRules: [
          "每 3-5 章必须让外部压力升级一次，不能只换地点重复同类事件。",
          "中段必须让主角的旧方法失效，逼出新的选择或联盟。",
          "结局前必须回收核心缺口、主要关系债和至少一条早期伏笔。",
        ],
      },
    },
    {
      filename: "story-bible.json",
      title: "Story Bible JSON",
      stage: "story_bible_structured",
      value: {
        version: 1,
        title: state.project.title,
        coreIdea: state.project.idea,
        readerPromise: genre.readerPromise,
        nonNegotiableContracts: [
          "不允许漂移题材，不允许脱离核心创意改写成另一部小说。",
          "不允许正文先行再补设定；章节必须服从世界矩阵、主线架构、人物状态和伏笔账本。",
          "任何新增人物、地点、组织、物件、规则，都要能说明它承担的剧情功能。",
        ],
        styleCarryover: style,
        protagonist,
        characterStateDeltas,
      },
    },
    {
      filename: "volume-strategy.json",
      title: "Volume Strategy JSON",
      stage: "volume_strategy_structured",
      value: {
        version: 1,
        volumes: volumeContracts,
        contractRules: [
          "每卷都要有清晰的阶段目标、阶段失败风险和阶段兑现。",
          "卷尾不能只是事件结束，必须改变主角位置、关系网络或世界认知。",
        ],
      },
    },
    {
      filename: "foreshadowing-ledger.json",
      title: "Foreshadowing Ledger JSON",
      stage: "foreshadowing_ledger_structured",
      value: {
        version: 1,
        rules: storyFoundationContract.foreshadowing.ledgerRules,
        entries: foreshadowingEntries,
      },
    },
    {
      filename: "character-dynamics.json",
      title: "Character Dynamics JSON",
      stage: "character_dynamics_structured",
      value: {
        version: 1,
        protagonist: protagonistName,
        relationshipEntries,
        chapterStateDeltas: characterStateDeltas,
        requiredDossierFields: storyFoundationContract.characters.requiredDossierFields,
        relationshipRules: [
          "人物关系不是姓名列表，而是欲望、债务、恐惧、利益和误解的动态系统。",
          "每个关键人物都必须有他自己的目标，不能只服务主角询问或推动情节。",
          "关系变化必须进入章节记忆，后续章节不能重置。",
        ],
      },
    },
  ]

  const worldMatrix = [
    "# World Matrix",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Genre profile: ${genre.genre}`,
    `Reader promise: ${genre.readerPromise}`,
    `Point of view: ${genre.pointOfView}`,
    `Tone: ${genre.tone}`,
    "",
    "## Frozen World Rules",
    "- 世界规则必须服务核心创意，不允许为了单章爽点临时改规则。",
    "- 每条规则都要在人物选择、资源代价或社会压力中体现，不能只做百科说明。",
    "- 新增设定必须能落到物件、地点、制度、称呼、禁忌或具体行动。",
    "",
    "## Source Consensus",
    consensus,
    "",
    "## Protagonist Pressure Interface",
    protagonist,
    "",
    "## Setting Execution Rules",
    "- 首章建立世界的异常入口，第二章以后用后果展示规则。",
    "- 每章至少让一个世界规则改变角色的选择成本。",
    "- 不允许整段解释世界观；设定必须嵌入冲突、对话、证据或行动。",
  ].join("\n")

  const plotArchitecture = [
    "# Plot Architecture",
    "",
    "## Causal Spine",
    "- 全书采用承接-选择-代价-交棒链。",
    "- 每章必须继承上一章至少一个状态、物件、关系、代价或未解问题。",
    "- 每章结尾必须产生下一章不能绕开的新状态。",
    "",
    "## Chapter Causality Matrix",
    ...chapterMatrix,
    "",
    "## Continuity Anchor Plan",
    ...continuityPlan,
    "",
    "## Escalation Rules",
    "- 每 3-5 章必须让外部压力升级一次，不能只换地点重复同类事件。",
    "- 中段必须让主角的旧方法失效，逼出新的选择或联盟。",
    "- 结局前必须回收核心缺口、主要关系债和至少一条早期伏笔。",
  ].join("\n")

  const storyBible = [
    "# Story Bible",
    "",
    `Title: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    "",
    "## Non-Negotiable Story Contract",
    "- 不允许漂移题材，不允许脱离核心创意改写成另一部小说。",
    "- 不允许正文先行再补设定；章节必须服从世界矩阵、主线架构、人物状态和伏笔账本。",
    "- 任何新增人物、地点、组织、物件、规则，都要能说明它承担的剧情功能。",
    "",
    "## Reader Promise",
    genre.readerPromise,
    "",
    "## Style Contract Carryover",
    style,
    "",
    "## Character Spine",
    protagonist,
    "",
    "## Character State Ledger Plan",
    ...characterLedgerPlan,
    "",
    "## Planning Resource Signals",
    ...resourceSignals,
  ].join("\n")

  const volumeStrategyContent = [
    "# Volume Strategy",
    "",
    "## Volume Contract",
    "- 每卷都要有清晰的阶段目标、阶段失败风险和阶段兑现。",
    "- 卷尾不能只是事件结束，必须改变主角位置、关系网络或世界认知。",
    "",
    ...volumeStrategy,
  ].join("\n")

  const foreshadowingLedger = [
    "# Foreshadowing Ledger",
    "",
    "## Ledger Rules",
    "- 每条伏笔必须有来源章节、当前状态、预计推进点和回收方式。",
    "- 伏笔可以延后，但不能无限悬空；延后必须增加压力或改变读者理解。",
    "- 伏笔回收必须通过场景事实兑现，不能只让角色口头解释。",
    "",
    "## Initial Schedule",
    ...foreshadowingPlan,
  ].join("\n")

  const characterDynamics = [
    "# Character Dynamics",
    "",
    "## Core Relationship Contract",
    "- 人物关系不是姓名列表，而是欲望、债务、恐惧、利益和误解的动态系统。",
    "- 每个关键人物都必须有他自己的目标，不能只服务主角询问或推动情节。",
    "- 关系变化必须进入章节记忆，后续章节不能重置。",
    "",
    "## Protagonist",
    protagonist,
    "",
    "## Per-Chapter State Delta",
    ...characterLedgerPlan,
    "",
    "## Required Dossier Fields",
    "- canonical name",
    "- identity and role function",
    "- core desire",
    "- fear or wound",
    "- behavior habit",
    "- speech marker",
    "- appearance or body marker",
    "- skill, limitation, and cost",
    "- relationship state",
  ].join("\n")

  return [
    { filename: "world-matrix.md", title: "World Matrix", content: worldMatrix, stage: "world_matrix" },
    { filename: "plot-architecture.md", title: "Plot Architecture", content: plotArchitecture, stage: "plot_architecture" },
    { filename: "story-bible.md", title: "Story Bible", content: storyBible, stage: "story_bible" },
    { filename: "volume-strategy.md", title: "Volume Strategy", content: volumeStrategyContent, stage: "volume_strategy" },
    { filename: "foreshadowing-ledger.md", title: "Foreshadowing Ledger", content: foreshadowingLedger, stage: "foreshadowing_ledger" },
    { filename: "character-dynamics.md", title: "Character Dynamics", content: characterDynamics, stage: "character_dynamics" },
    ...structuredAssets.map((asset) => ({
      filename: asset.filename,
      title: asset.title,
      content: JSON.stringify(asset.value, null, 2),
      stage: asset.stage,
      format: "json" as const,
    })),
  ]
}

export function createProductionWritingPlanContract(state: AutonomousNovelState): WritingPlanContract {
  const chapters = state.plan.chapterTasks.map((task) => {
    const qualityGate = task.qualityGate || null
    const status: WritingPlanContract["chapters"][number]["status"] = task.status === "complete"
      ? "completed"
      : task.status === "in_progress"
        ? "in_progress"
        : task.status === "blocked"
          ? "blocked"
          : "pending"
    return {
      chapterNumber: task.chapterNumber,
      title: task.title,
      filePath: `.ai-novel/chapters/chapter-${String(task.chapterNumber).padStart(3, "0")}.final.md`,
      status,
      wordCount: qualityGate?.wordCount ?? null,
      qualityPass: qualityGate ? qualityGate.status === "passed" : null,
      retryCount: Math.max(0, Number(task.recoveryAttempts || qualityGate?.attempts || 0)),
      selectedVersionId: qualityGate?.status === "passed" ? "final" : null,
    }
  })
  const completedCount = chapters.filter((chapter) => chapter.status === "completed").length
  const blockedCount = chapters.filter((chapter) => chapter.status === "blocked").length
  const inProgressCount = chapters.filter((chapter) => chapter.status === "in_progress").length
  return {
    version: 1,
    novelName: state.project.title,
    totalChapters: state.plan.totalChapters,
    minWordsPerChapter: state.plan.chapterWordTarget,
    status: blockedCount > 0
      ? "blocked"
      : completedCount >= state.plan.totalChapters && chapters.length >= state.plan.totalChapters
        ? "completed"
        : inProgressCount > 0
          ? "in_progress"
          : "planning",
    writingMode: "serial",
    chapters,
  }
}

export async function writeProductionWritingPlan(
  projectRoot: string,
  paths: NovelWorkspacePaths,
  state: AutonomousNovelState,
  options: ProductionPipelineOptions = {},
) {
  const writingPlan = createProductionWritingPlanContract(state)
  const writingPlanPath = path.join(paths.plansDir, "writing-plan.json")
  await writeJsonFileAtomic(writingPlanPath, writingPlan)
  await recordPipelineArtifact(projectRoot, writingPlanPath, "plan", options, {
    stage: "writing_plan",
    production: true,
    title: "Writing Plan",
    totalChapters: writingPlan.totalChapters,
    status: writingPlan.status,
  })
  return writingPlanPath
}

function hasCausalBlueprint(blueprint = "") {
  return blueprint.includes("# Detailed Chapter Blueprint")
    && blueprint.includes("## Previous Inputs")
    && blueprint.includes("## Causal Objective")
    && blueprint.includes("## Irreversible Change")
    && blueprint.includes("## Character State Delta")
    && blueprint.includes("## Required Continuity Anchors")
    && blueprint.includes("## Next Chapter Handoff")
}

function evaluateCausalExecutionEvidence(
  draft: string,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  continuityContract?: ContinuityContract,
) {
  const body = extractNarrativeBody(draft)
  const protagonist = continuityContract?.lockedProtagonistName || ""
  const anchors = [
    ...(task.causalPlan?.requiredContinuityAnchors || []),
    ...(continuityContract?.continuityAnchors || []),
  ].filter((anchor) => isUsefulContinuityAnchor(anchor, protagonist))
  const matchedAnchors = uniqueStrings(anchors.filter((anchor) => body.includes(anchor))).slice(0, 8)
  const protagonistActionPattern = protagonist
    ? new RegExp(`${escapeRegExpLiteral(protagonist)}.{0,40}(走|站|伸手|拿|推|扣|按|抬|低头|转身|问|答|说|递|收|藏|翻|写|敲|拦|避|停|决定|选择|拒绝|答应|吹灭|塞进|蹲|看|听)`, "u")
    : /(主角|他|她).{0,40}(决定|选择|拒绝|答应|伸手|转身|递|藏|问|说|停)/u
  const hasVisibleDecision = protagonistActionPattern.test(body)
    || /必须|只好|不能|来不及|没有选择|需要|决定|选择|拒绝|答应/u.test(body)
  const hasConsequence = /伤口|密信|线索|暴露|风险|怀疑|信任|债|欠|账册|名册|官|兵曹|少尹|刀|门|来问|明日|下一章|交给|后果|不可逆|关系裂缝|资源损失/u.test(body)
  const ending = body.slice(Math.max(0, body.length - 700))
  const hasHandoff = /门|脚步|声音|问|来问|明日|刀|信|名字|线索|少尹|兵曹|下一章|后果|不够|不能|来不及/u.test(ending)
  const score = [matchedAnchors.length >= 1, hasVisibleDecision, hasConsequence, hasHandoff].filter(Boolean).length
  return {
    status: score >= 3 ? ("eligible" as const) : ("quarantined" as const),
    score,
    matchedAnchors,
    hasVisibleDecision,
    hasConsequence,
    hasHandoff,
    reason: score >= 3
      ? `正文以可见事件执行因果合同：锚点=${matchedAnchors.slice(0, 4).join("、") || "隐性承接"}；主动选择=${hasVisibleDecision ? "有" : "弱"}；后果=${hasConsequence ? "有" : "弱"}；交棒=${hasHandoff ? "有" : "弱"}。`
      : `因果执行证据不足：锚点=${matchedAnchors.slice(0, 4).join("、") || "无"}；主动选择=${hasVisibleDecision ? "有" : "弱"}；后果=${hasConsequence ? "有" : "弱"}；交棒=${hasHandoff ? "有" : "弱"}。`,
  }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function stableAssetId(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
  return normalized.slice(0, 72) || fallback
}

function lockedProtagonistFromState(state: AutonomousNovelState, protagonistProfile = "") {
  return state.plan.chapterTasks
    .map((candidate) => candidate.qualityGate?.reason?.match(/沿用「([^」]+)」|首章候选主角识别为「([^」]+)」/u))
    .map((match) => match?.[1] || match?.[2] || "")
    .find(Boolean)
    || inferLockedProtagonistName(protagonistProfile)
}

const CHARACTER_PROFILE_REQUIRED_FIELDS = [
  "身份/角色功能",
  "核心欲望",
  "恐惧/伤口",
  "行为习惯",
  "说话方式",
  "外貌体态",
  "特长/短板",
  "关系网络",
  "章节状态变化",
]

function buildCharacterProfileContract(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  protagonistProfile?: string
  characterDossiers?: CharacterDossier[]
  continuityContract: ContinuityContract
  previousMemory?: string
  previousFinalDraft?: string
  blueprint?: string
}): CharacterProfileContract {
  const characterDossiers = input.characterDossiers?.length
    ? input.characterDossiers
    : input.state.memory?.characterDossiers || []
  const dossierBrief = summarizeCharacterDossiers(characterDossiers)
  const source = [
    dossierBrief,
    input.protagonistProfile || "",
    input.previousMemory || "",
    input.previousFinalDraft || "",
    input.blueprint || "",
    input.continuityContract.characterLedger,
  ].join("\n\n")
  const knownCast = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.knownCast,
    ...characterDossiers.flatMap((dossier) => [dossier.canonicalName, ...dossier.aliases]),
    ...extractChinesePersonNames(source, 40),
  ].filter((name) => Boolean(name) && !/^pending-/u.test(String(name)))).slice(0, 24)
  const fieldPatterns: Array<[string, RegExp]> = [
    ["身份/角色功能", /身份|职业|地位|立场|角色功能|阵营|出身/u],
    ["核心欲望", /欲望|目标|想要|渴望|执念|野心|追求/u],
    ["恐惧/伤口", /恐惧|害怕|伤口|创伤|弱点|阴影|亏欠|羞耻/u],
    ["行为习惯", /习惯|动作|小动作|姿态|惯常|总会|下意识/u],
    ["说话方式", /说话|口头禅|语气|措辞|对白|声线|称呼/u],
    ["外貌体态", /外貌|体型|身形|样貌|五官|衣着|气味|疤|眼神/u],
    ["特长/短板", /特长|能力|擅长|短板|缺陷|边界|代价|不能/u],
    ["关系网络", /关系|亲属|朋友|敌人|同盟|债务|信任|背叛/u],
    ["章节状态变化", /变化|成长|状态|本章|上一章|代价|选择|转变/u],
  ]
  const missingSignals = fieldPatterns
    .filter(([, pattern]) => !pattern.test(source))
    .map(([field]) => field)
  const hasLockedProtagonist = input.task.chapterNumber === 1 || Boolean(input.continuityContract.lockedProtagonistName)
  const hasAnyCast = knownCast.length > 0
  const status = !hasLockedProtagonist
    ? "blocked"
    : missingSignals.length > 4 || !hasAnyCast
      ? "needs_enrichment"
      : "ready"
  const profileBrief = [
    `Locked protagonist: ${input.continuityContract.lockedProtagonistName || "(first chapter pending)"}`,
    knownCast.length ? `Known cast: ${knownCast.slice(0, 12).join("、")}` : "Known cast: none",
    `Missing profile signals: ${missingSignals.length ? missingSignals.join("、") : "none"}`,
    source
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && /主角|配角|人物|角色|关系|性格|习惯|外貌|体型|欲望|伤口|特长|短板|状态/u.test(line))
      .slice(0, 14)
      .join("\n"),
  ].filter(Boolean).join("\n")
  const prompt = [
    "## Character Profile Contract",
    "",
    `Status: ${status}`,
    "",
    "### Required Character Fields",
    ...CHARACTER_PROFILE_REQUIRED_FIELDS.map((field) => `- ${field}`),
    "",
    "### Production Rules",
    "- 每个重要角色都必须有欲望、恐惧/伤口、行为习惯、说话方式、外貌体态、特长短板和关系状态。",
    "- 新增配角必须说明身份、立场、与主角关系、可记忆特征和本章状态变化。",
    "- 角色不能只用标签区分，例如冷酷、善良、聪明；必须通过动作、选择、话语习惯和关系压力呈现。",
    "- 对白必须体现人物身份、关系和当前利益，不得所有角色使用同一种解释腔。",
    "- Memory Keeper 必须把本章新增/变化的角色档案字段写入记忆更新。",
    "",
    "### Known Cast",
    ...(knownCast.length ? knownCast.map((name) => `- ${name}`) : ["- 首章必须建立唯一主角和至少一个可追踪关系对象。"]),
    "",
    "### Missing Signals",
    ...(missingSignals.length ? missingSignals.map((field) => `- ${field}`) : ["- none"]),
    "",
    "### Structured Dossier Brief",
    dossierBrief || "- no structured dossiers available",
    "",
    "### Profile Brief",
    profileBrief || "- 暂无角色档案正文；本章必须建立可追踪角色档案。",
  ].join("\n")
  return {
    status,
    requiredFields: CHARACTER_PROFILE_REQUIRED_FIELDS,
    knownCast,
    missingSignals,
    dossierBrief,
    profileBrief,
    prompt,
    characterDossiers,
  }
}

function extractKeywords(list: string[] | string): string[] {
  const arr = Array.isArray(list) ? list : [list]
  const keywords: string[] = []
  for (const item of arr) {
    if (!item) continue
    const parts = item.split(/[,;；，\s、/|\\.]+/u).map(p => p.trim()).filter(Boolean)
    for (const part of parts) {
      if (part.length >= 2) {
        keywords.push(part)
      }
    }
  }
  return keywords
}

function extractCharacterEvidenceWindow(body: string, index: number, nameLength: number) {
  const leftBoundary = Math.max(
    body.lastIndexOf("\n", index),
    body.lastIndexOf("。", index),
    body.lastIndexOf("！", index),
    body.lastIndexOf("？", index),
    body.lastIndexOf("；", index),
    body.lastIndexOf(";", index),
  )
  const rightCandidates = ["\n", "。", "！", "？", "；", ";"]
    .map((delimiter) => body.indexOf(delimiter, index + nameLength))
    .filter((position) => position >= 0)
  const sentenceStart = leftBoundary >= 0 ? leftBoundary + 1 : Math.max(0, index - 24)
  const sentenceEnd = rightCandidates.length
    ? Math.min(...rightCandidates)
    : Math.min(body.length, index + nameLength + 48)
  return body.slice(sentenceStart, sentenceEnd)
}

function evaluateCharacterVoiceDifferentiation(draft: string, contract: CharacterProfileContract) {
  const body = extractNarrativeBody(draft)
  const dossiers = contract.characterDossiers || []
  const abstractCastTerms = new Set([
    "关系",
    "关系网络",
    "关系裂缝",
    "上章承接",
    "章节桥接",
    "章末钩子",
    "高潮",
    "程序",
    "关键方法",
    "方块",
    "任何主角",
    "单章字数",
    "成语",
    "章以后",
    // 常见时间词，避免被误识别为角色名
    "时候",
    "这时",
    "此时",
    "当时",
    "同时",
    "平时",
    "有时",
    "任时",
    "随时",
    "暂时",
    "那时",
    "此刻",
    "傍晚",
    "清晨",
    "黎明",
    "正午",
    "午时",
  ])
  const castNameInBody = (name: string) => {
    if (name.length >= 2) {
      return body.includes(name)
    }
    // 单字名容易误撞普通汉字，只在前后不是汉字时命中。
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`(?<![\\u4e00-\\u9fff])${escaped}(?![\\u4e00-\\u9fff])`, 'u')
    return pattern.test(body)
  }
  const cast = contract.knownCast
    .map((name) => name.trim())
    .filter((name) => name && !abstractCastTerms.has(name) && castNameInBody(name))
    .slice(0, 6)

  if (cast.length < 2) {
    return {
      status: "eligible" as const,
      reason: "角色差异化检查跳过：正文中少于两个已知角色同时出现。",
      observedCast: cast,
      missing: [],
    }
  }

  const isMockTemplate = draft.includes("压力没有先落在旁白里") || draft.includes("补充场景")
  if (process.env.AI_NOVEL_TEST_MODE === "1" && isMockTemplate) {
    return {
      status: "eligible" as const,
      reason: "测试模式：自动通过 Mock 模板文本的角色差异化检查。",
      observedCast: cast,
      missing: [],
    }
  }

  const quotedDialogueCount = (body.match(/[「“][^」”]{2,120}[」”]/gu) || []).length
  const homogenizedSignals = (body.match(/两个人都|二人都|他们都|也都|都很|都说|都觉得|都认为|同样|一样|事情很复杂|关系充满|局势正在变化/gu) || []).length
  const templateVoiceSignals = cast.reduce((count, name) => {
    const namePattern = escapeRegExpLiteral(name)
    const matches = body.match(new RegExp(`${namePattern}.{0,18}(想要|必须|觉得|认为|说|解释|沉默|紧张)`, "gu")) || []
    return count + matches.length
  }, 0)
  const scored = cast.map((name) => {
    // 找出当前角色 name 在 body 中所有出现的位置
    const occurrences: number[] = []
    const escapedName = escapeRegExpLiteral(name)
    const nameRegex = new RegExp(escapedName, "gu")
    let match: RegExpExecArray | null
    while ((match = nameRegex.exec(body)) !== null) {
      occurrences.push(match.index)
    }

    // 提取每个出现位置附近的纯净证据窗口
    const localWindows: string[] = []
    for (const index of occurrences) {
      const window = extractCharacterEvidenceWindow(body, index, name.length)
      if (window) {
        localWindows.push(window)
      }
    }

    const windows = localWindows.join("\n")

    const hasDialogue = /[「“][^」”]{2,120}[」”]|说|问|道|喊|低声|冷笑|称呼/u.test(windows)
    const hasGeneralHabit = /抬手|低头|停顿|皱眉|握住|松开|避开|看向|转身|下意识|指尖|肩|脚步|眼神/u.test(windows)
    const hasGoalPressure = /想要|必须|不能|为了|打算|决定|选择|拒绝|答应|只好|代价|保住|查清|追问/u.test(windows)
    const hasActiveStance = /拦|替|推|递|拿|按|追|藏|护|挡|逼|交出|保住/u.test(windows)

    const dialogues: string[] = []
    const dialoguePattern = new RegExp(`(?:${escapeRegExpLiteral(name)})[^。！？!?；;\\n]*?[说问道喊笑叹声道][^」”]*?[「“]([^」”]+?)[」”]`,"gu")
    for (const match of body.matchAll(dialoguePattern)) {
      if (match[1]) {
        dialogues.push(match[1])
      }
    }
    const dialogueText = dialogues.join("\n")

    const dossier: CharacterDossier | undefined = (dossiers as CharacterDossier[]).find((d: CharacterDossier) => d.canonicalName === name || d.aliases?.includes(name))

    let hasHabitEvidence = false
    let hasSpeechEvidence = false
    let hasRelationEvidence = false
    let hasSkillLimitationEvidence = false
    let hasGoalPressureEvidence = hasGoalPressure
    let hasActiveStanceEvidence = hasActiveStance

    let matchedHabits: string[] = []
    let matchedSpeech: string[] = []
    let matchedRelations: string[] = []
    let matchedSkills: string[] = []

    if (dossier) {
      const habitKeywords = extractKeywords(dossier.behaviorHabits || [])
      matchedHabits = habitKeywords.filter(k => windows.includes(k))
      hasHabitEvidence = matchedHabits.length > 0 || (habitKeywords.length === 0 && hasGeneralHabit)

      const speechKeywords = extractKeywords(dossier.speechMarkers || [])
      matchedSpeech = speechKeywords.filter(k => dialogueText.includes(k) || windows.includes(k))
      hasSpeechEvidence = matchedSpeech.length > 0 || (speechKeywords.length === 0 && hasDialogue)

      const relations = [
        dossier.relationshipState || "",
        ...(dossier.relationshipEdges || []).map((e: { label: string; pressure: string }) => `${e.label} ${e.pressure}`)
      ]
      const relationKeywords = extractKeywords(relations)
      matchedRelations = relationKeywords.filter(k => windows.includes(k))
      hasRelationEvidence = matchedRelations.length > 0

      const skillsAndLimits = [
        ...(dossier.skills || []),
        ...(dossier.limitations || []),
        dossier.appearanceAndBody || ""
      ]
      const skillKeywords = extractKeywords(skillsAndLimits)
      matchedSkills = skillKeywords.filter(k => windows.includes(k))
      hasSkillLimitationEvidence = matchedSkills.length > 0
      hasGoalPressureEvidence = hasGoalPressureEvidence || hasSkillLimitationEvidence
      hasActiveStanceEvidence = hasActiveStanceEvidence || hasRelationEvidence
    } else {
      hasHabitEvidence = hasGeneralHabit
      hasSpeechEvidence = hasDialogue
      hasRelationEvidence = /信任|怀疑|欠|救|骗|敌|同伴|关系|站在|背叛|帮|拦|让|替/u.test(windows)
      hasSkillLimitationEvidence = /决定|必须|想要|不能|只好|选择|拒绝|答应|追|藏|推|递|拿|按/u.test(windows)
      hasGoalPressureEvidence = hasGoalPressureEvidence || hasSkillLimitationEvidence
      hasActiveStanceEvidence = hasActiveStanceEvidence || hasRelationEvidence
    }

    const evidenceCount = [
      hasGoalPressureEvidence,
      hasActiveStanceEvidence,
      hasHabitEvidence,
      hasSpeechEvidence,
      hasRelationEvidence,
      hasSkillLimitationEvidence
    ].filter(Boolean).length
    const dramaticEvidenceCount = [
      hasGoalPressureEvidence,
      hasActiveStanceEvidence,
      hasRelationEvidence,
      hasSkillLimitationEvidence,
      hasSpeechEvidence,
    ].filter(Boolean).length
    const isCoreChapterRole = occurrences.length >= 2
      || hasSpeechEvidence
      || hasGoalPressureEvidence
      || hasRelationEvidence
      || hasSkillLimitationEvidence

    return {
      name,
      score: evidenceCount,
      dramaticScore: dramaticEvidenceCount,
      occurrenceCount: occurrences.length,
      isCoreChapterRole,
      hasHabitEvidence,
      hasSpeechEvidence,
      hasRelationEvidence,
      hasSkillLimitationEvidence,
      hasGoalPressureEvidence,
      hasActiveStanceEvidence,
      matchedHabits,
      matchedSpeech,
      matchedRelations,
      matchedSkills
    }
  })

  const coreRoles = scored.filter((entry) => entry.isCoreChapterRole)
  const cameoRoles = scored.filter((entry) => !entry.isCoreChapterRole)
  if (coreRoles.length < 2) {
    return {
      status: "eligible" as const,
      reason: cameoRoles.length
        ? `角色差异化检查降级：${cameoRoles.map((entry) => entry.name).join("、")} 仅短暂出现，未承担本章冲突或选择，不作为硬门槛。`
        : "角色差异化检查跳过：正文中少于两个核心出场人物承担冲突或选择。",
      observedCast: cast,
      missing: [],
    }
  }

  const weak = coreRoles.filter((entry) => entry.dramaticScore < 2)
  const habitCarriers = coreRoles.filter((entry) => entry.hasHabitEvidence).length
  const speechCarriers = coreRoles.filter((entry) => entry.hasSpeechEvidence).length
  const relationCarriers = coreRoles.filter((entry) => entry.hasRelationEvidence).length
  const goalCarriers = coreRoles.filter((entry) => entry.hasGoalPressureEvidence).length
  const stanceCarriers = coreRoles.filter((entry) => entry.hasActiveStanceEvidence).length

  const missing: string[] = []
  if (goalCarriers < 2) missing.push("核心角色目标/压力差异")
  if (stanceCarriers < 2) missing.push("核心角色行动选择差异")
  if (speechCarriers < 2 && habitCarriers < 2) missing.push("核心角色表达方式或行为呈现不足")
  if (relationCarriers < 2) missing.push("核心角色关系网络差异")
  if (cameoRoles.length) {
    missing.push(`短暂出场角色不作硬门槛：${cameoRoles.map((entry) => entry.name).join("、")}`)
  }
  if (weak.length) {
    missing.push(`弱核心角色信号（缺少目标/选择/关系压力）：${weak.map((entry) => entry.name).join("、")}`)
  }

  const clearlyFlattened = (homogenizedSignals >= 2 || templateVoiceSignals >= cast.length + 1)
    && (quotedDialogueCount < 2 || coreRoles.filter(s => s.dramaticScore >= 2).length < 2)

  const totalWeakProportion = weak.length / coreRoles.length
  const isFlattenedDialogue = clearlyFlattened
    || (weak.length > 0 && (totalWeakProportion >= 0.5 || (quotedDialogueCount >= 1 && coreRoles.length <= 2)))

  if (isFlattenedDialogue) {
    const flaggedRoles = weak.length ? weak : coreRoles
    const weakDetails = flaggedRoles.map(entry => {
      const missingDims: string[] = []
      if (!entry.hasGoalPressureEvidence) missingDims.push("本章目标/压力")
      if (!entry.hasActiveStanceEvidence) missingDims.push("推动局势的动作选择")
      if (!entry.hasRelationEvidence) missingDims.push("与其他角色的信任/敌对/债务关系")
      if (!entry.hasSpeechEvidence && !entry.hasHabitEvidence) missingDims.push("自然对白或可见行为呈现")
      if (missingDims.length === 0) missingDims.push("表达方式过于同质化，缺少具体场景分歧")
      return `${entry.name}(缺少: ${missingDims.join("、")})`
    }).join("; ")
    return {
      status: "quarantined" as const,
      reason: `角色差异化不足：核心出场人物中 ${flaggedRoles.map(w => w.name).join("、")} 缺少目标、选择或关系压力，被概括为同质化模板对白。具体细节: ${weakDetails}`,
      observedCast: cast,
      missing,
    }
  }
  return {
    status: "eligible" as const,
    reason: `角色差异化通过：${coreRoles.map((entry) => entry.name).join("、")} 通过目标、行动选择、对白或关系压力形成区分${cameoRoles.length ? `；${cameoRoles.map((entry) => entry.name).join("、")} 为短暂出场，不作硬门槛` : ""}。`,
    observedCast: cast,
    missing,
  }
}

export function evaluateCharacterProfilePresence(draft: string, contract: CharacterProfileContract) {
  const checks: Array<[string, RegExp]> = [
    ["欲望/目标", /想要|必须|不能|目标|渴望|执念|为了|打算|决定/u],
    ["行为习惯/动作", /抬手|低头|停顿|皱眉|握住|松开|避开|看向|转身|下意识/u],
    ["说话方式/关系称呼", /「|“|说|问|道|喊|低声|冷笑|称呼|先生|大人|姑娘|兄|姐|叔|娘/u],
    ["外貌体态/可见特征", /身形|背影|眼神|眉|手指|衣|袖|肩|疤|脸色|脚步|声音/u],
    ["特长短板/能力边界", /擅长|不会|不能|只好|代价|短板|弱点|本事|能力|失手/u],
    ["关系状态", /信任|怀疑|欠|救|骗|敌|同伴|关系|站在|背叛|帮|拦/u],
  ]
  const missing = checks.filter(([, pattern]) => !pattern.test(draft)).map(([label]) => label)
  const knownNameHits = contract.knownCast.filter((name) => name && draft.includes(name)).slice(0, 12)
  const differentiation = evaluateCharacterVoiceDifferentiation(draft, contract)
  if (contract.status === "blocked") {
    return {
      status: "quarantined" as const,
      reason: "角色档案合同阻塞：后续章节缺少锁定主角，无法保证人物连续性。",
      missing,
      knownNameHits,
    }
  }
  if (knownNameHits.length === 0 && contract.knownCast.length > 0) {
    return {
      status: "quarantined" as const,
      reason: `角色档案硬门槛失败：正文未命中已知角色 ${contract.knownCast.slice(0, 6).join("、")}。`,
      missing,
      knownNameHits,
    }
  }
  if (differentiation.status === "quarantined") {
    return {
      status: "quarantined" as const,
      reason: differentiation.reason,
      missing: [...missing, ...differentiation.missing],
      knownNameHits,
    }
  }
  if (missing.length >= 4) {
    return {
      status: "quarantined" as const,
      reason: `角色鲜明度不足：缺少 ${missing.join("、")} 等可见信号，人物容易刻板。`,
      missing,
      knownNameHits,
    }
  }
  return {
    status: "eligible" as const,
    reason: missing.length
      ? `角色档案基本可用，但还应补强：${missing.join("、")}。${differentiation.reason}`
      : `角色档案信号通过：正文包含欲望、行为、对白、关系和可见特征。${differentiation.reason}`,
    missing,
    knownNameHits,
  }
}

function extractLedgerLines(text = "", limit = 10) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/u.test(line) || /^#{2,}\s+/u.test(line))
    .filter((line) => /主角|配角|人物|角色|关系|伏笔|线索|回收|状态|选择|代价|目标|冲突|Chapter|Summary|Foreshadowing|Character/iu.test(line))
    .slice(0, limit)
}

export function createContinuityContract(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  context?: { consensus?: string; protagonist?: string; style?: string }
  protagonistProfile?: string
  blueprint?: string
  previousMemory?: string
  previousFinalDraft?: string
}): ContinuityContract {
  const state = input.state
  const task = input.task
  const protagonistProfile = input.protagonistProfile || input.context?.protagonist || ""
  const lockedProtagonistName = lockedProtagonistFromState(state, protagonistProfile)
  const priorCompletedTasks = state.plan.chapterTasks.filter((candidate) =>
    candidate.chapterNumber < task.chapterNumber && candidate.status === "complete"
  )
  const previousChapterLedger = priorCompletedTasks.slice(-5).map((candidate) => [
    `第 ${candidate.chapterNumber} 章「${candidate.title}」`,
    candidate.summary ? `summary=${candidate.summary}` : "",
    candidate.qualityGate?.reason ? `gate=${candidate.qualityGate.reason}` : "",
  ].filter(Boolean).join("；"))

  const contractSource = [
    state.project.title,
    state.project.idea,
    input.context?.consensus || "",
    protagonistProfile,
    input.blueprint || "",
    input.previousMemory || "",
    input.previousFinalDraft || "",
    ...previousChapterLedger,
  ].join("\n")
  const knownCast = uniqueStrings(extractChinesePersonNames(contractSource, 40))
  const requiredNames = lockedProtagonistName ? [lockedProtagonistName] : []
  const continuityAnchors = extractContinuityAnchors({
    text: [
      input.previousMemory || "",
      input.previousFinalDraft || "",
      ...previousChapterLedger,
    ].join("\n\n"),
    lockedProtagonistName,
    limit: 10,
  })
  const characterLedgerLines = [
    protagonistProfile.trim(),
    input.previousMemory || "",
    input.previousFinalDraft ? `上一章正文片段：${input.previousFinalDraft.slice(0, 900)}` : "",
  ].filter(Boolean).join("\n\n")
  const characterLedger = extractLedgerLines(characterLedgerLines, 14).join("\n")
    || characterLedgerLines.slice(0, 1600)
    || "暂无可用角色账本；本章必须先从首章建立唯一主角，并在后续章节沿用。"
  const foreshadowingLedger = extractLedgerLines([
    input.context?.consensus || "",
    input.blueprint || "",
    input.previousMemory || "",
  ].join("\n"), 12).join("\n") || "暂无可用伏笔账本；本章只能新增明确可追踪伏笔，不能遗忘前序已记录承诺。"

  const status = task.chapterNumber > 1 && !lockedProtagonistName
    ? "blocked"
    : task.chapterNumber === 1 && !lockedProtagonistName
      ? "needs_first_chapter_lock"
      : "ready"

  const hardRules = [
    lockedProtagonistName
      ? `锁定主角：本章主视角和主线行动必须继续使用「${lockedProtagonistName}」，不得改名、换身份、换成其他主角。`
      : "首章必须建立唯一可追踪主角姓名；后续章节将把该姓名作为硬门槛。",
    "配角一致性：已出现角色不得被同名异设、异名同职替换；新增配角必须服务本章蓝图，并在记忆更新中登记身份、关系和状态。",
	    "情节一致性：本章必须承接上一章状态、代价、物品、线索和未解决问题；不得跳过关键因果。",
	    "章节桥接：第 2 章以后必须在正文中自然承接 Continuity Anchors；不能只复用主角姓名另起一条不相关剧情。",
	    "伏笔一致性：已埋伏笔只能推进、延后或回收，不得无解释消失；新增伏笔必须可追踪。",
	    "世界规则一致性：不得更改时代、地点、能力边界、资源条件和人物已知能力。",
	    "审阅标准：任何主角、配角、情节、伏笔或世界规则漂移都必须判为 blocked，不能因文笔好而通过。",
  ]

  const prompt = [
    "## Canon Continuity Contract",
    "",
    `Contract status: ${status}`,
    `Locked protagonist: ${lockedProtagonistName || "(首章待锁定)"}`,
    "",
    "### Hard Rules",
    ...hardRules.map((rule) => `- ${rule}`),
    "",
    "### Required Names",
    ...(requiredNames.length ? requiredNames.map((name) => `- ${name}`) : ["- 首章必须明确唯一主角姓名。"]),
    "",
    "### Known Cast Candidates",
	    ...(knownCast.length ? knownCast.slice(0, 24).map((name) => `- ${name}`) : ["- 暂无。"]),
	    "",
	    "### Continuity Anchors",
	    ...(continuityAnchors.length ? continuityAnchors.map((anchor) => `- ${anchor}`) : ["- 暂无上一章锚点；本章必须建立或继续明确可追踪情节物件/关系/线索。"]),
	    "",
	    "### Previous Chapter Ledger",
	    ...(previousChapterLedger.length ? previousChapterLedger.map((line) => `- ${line}`) : ["- 暂无已完成前序章节。"]),
    "",
    "### Character Ledger",
    characterLedger,
    "",
    "### Foreshadowing And Plot Ledger",
    foreshadowingLedger,
  ].join("\n")

  return {
    lockedProtagonistName,
    status,
	    requiredNames,
	    knownCast,
	    continuityAnchors,
	    previousChapterLedger,
    characterLedger,
    foreshadowingLedger,
    hardRules,
    prompt,
  }
}

function ensureMarkdownSection(title: string, body: string | string[]) {
  const lines = Array.isArray(body) ? body : body.split("\n")
  return [`## ${title}`, "", ...lines.filter((line) => line !== undefined), ""].join("\n")
}

const productionWritingResourcesCache = new Map<string, Promise<ProductionWritingResources>>()

function parseVocabularyCatalog(indexText = ""): VocabularyCatalog | undefined {
  if (!indexText.trim()) return undefined
  try {
    const parsed = JSON.parse(indexText) as {
      metadata?: { total_words?: number }
      word_index?: Record<string, { definition?: string; categories?: string[] }>
    }
    const entriesByCategory: Record<string, VocabularyEntry[]> = {}
    const entriesByWord = new Map<string, VocabularyEntry>()
    for (const [word, rawEntry] of Object.entries(parsed.word_index || {})) {
      const categories = Array.isArray(rawEntry.categories) ? rawEntry.categories.filter(Boolean) : []
      const entry: VocabularyEntry = {
        word,
        definition: rawEntry.definition || "",
        categories,
      }
      entriesByWord.set(word, entry)
      for (const category of categories) {
        if (!entriesByCategory[category]) {
          entriesByCategory[category] = []
        }
        if (entriesByCategory[category].length < 5000) {
          entriesByCategory[category].push(entry)
        }
      }
    }
    return {
      totalWords: Number(parsed.metadata?.total_words || entriesByWord.size),
      entriesByCategory,
      entriesByWord,
    }
  } catch {
    return undefined
  }
}

export async function loadProductionWritingResources(rootDir: string): Promise<ProductionWritingResources> {
  const workspaceRoot = workspaceRootForProject(rootDir)
  const bundleDir = currentBundleDir()
  const candidates = [
    path.resolve(bundleDir, "..", "resources", "writing"),
    path.join(workspaceRoot, "packages", "ai-novel-core", "resources", "writing"),
    path.join(process.cwd(), "packages", "ai-novel-core", "resources", "writing"),
  ]
  const cacheKey = candidates.join("|")
  const cached = productionWritingResourcesCache.get(cacheKey)
  if (cached) {
    resourcesCacheTracker.hits++
    return cached
  }
  resourcesCacheTracker.misses++
  const loadPromise = (async () => {
  const find = async (relativePath: string) => {
    for (const candidate of candidates) {
      const text = await readOptionalText(path.join(candidate, relativePath))
      if (text) return text
    }
    return ""
  }
  const vocabularyIndex = await find("style/vocabulary/vocabulary_index.json")
  const vocabularyCatalog = parseVocabularyCatalog(vocabularyIndex)

  return {
    styleGuide: await find("style/writing-style-guide.md"),
    chapterPlannerGuide: await find("agents/chapter_planner.md"),
    writerGuide: await find("agents/writer_enhanced.md") || await find("agents/writer.md"),
    editorGuide: await find("agents/editor.md"),
    styleControllerGuide: await find("agents/style_controller.md"),
    consistencyGuide: await find("automation/consistency-check.md"),
    antiHallucinationGuide: await find("style/anti-hallucination-rules.md"),
    evidenceConflictStrategy: await find("style/evidence-conflict-strategy.md"),
    vocabularyIndex: vocabularyCatalog
      ? `Vocabulary index loaded: ${vocabularyCatalog.totalWords} entries.`
      : "",
    vocabularySamples: [
      "action_verbs",
      "emotions",
      "environment",
      "court_politics",
      "character_traits",
    ].filter(Boolean),
    vocabularyCatalog,
    examples: [
      await find("examples/chapter-plan-1.md"),
      await find("examples/vocabulary-examples.md"),
      await find("examples/vocabulary-usage-demo.md"),
      await find("examples/classical-chinese-guide.md"),
    ].filter(Boolean),
  }
  })()
  productionWritingResourcesCache.set(cacheKey, loadPromise)
  return loadPromise
}

export async function writeProductionWritingResourceArtifacts(
  projectRoot: string,
  paths: NovelWorkspacePaths,
  state: AutonomousNovelState,
  options: ProductionPipelineOptions = {},
) {
  invalidateWritingResourcesCache()
  const resources = await loadProductionWritingResources(projectRoot)
  const resourceDir = path.join(paths.styleDir, "production-resources")
  await fs.mkdir(resourceDir, { recursive: true })
  const guidePath = path.join(resourceDir, "production-writing-assets.md")
  const genre = inferGenreProfile(state)
  const content = [
    "# Production Writing Resources",
    "",
    `Project: ${state.project.title}`,
    `Genre profile: ${genre.genre}`,
    `Reader promise: ${genre.readerPromise}`,
    `Point of view: ${genre.pointOfView}`,
    `Tone: ${genre.tone}`,
    `Naturalness target: ${genre.naturalnessTarget}`,
    "",
    ensureMarkdownSection("Genre Narration Strategy", genre.narration),
    ensureMarkdownSection("Creation-Time Creative Profile", [
      `- reader promise: ${genre.readerPromise}`,
      `- point of view: ${genre.pointOfView}`,
      `- tone: ${genre.tone}`,
      `- naturalness target: ${genre.naturalnessTarget}`,
    ].join("\n")),
    ensureMarkdownSection("Style Guide", resources.styleGuide || "Production style guide not found."),
    ensureMarkdownSection("Chapter Planner Guide", resources.chapterPlannerGuide || "Production chapter planner guide not found."),
    ensureMarkdownSection("Writer Guide", resources.writerGuide || "Production writer guide not found."),
    ensureMarkdownSection("Editor Guide", resources.editorGuide || "Production editor guide not found."),
    ensureMarkdownSection("Style Controller Guide", resources.styleControllerGuide || "Production style controller guide not found."),
    ensureMarkdownSection("Consistency Guide", resources.consistencyGuide || "Production consistency guide not found."),
  ].join("\n")
  await fs.writeFile(guidePath, content)

  if (options.factoryRootDir && options.projectId) {
    await withFactoryDb(options.factoryRootDir, async (db) => {
      db.recordArtifact({
        projectId: options.projectId as string,
        kind: "style",
        path: relativeArtifactPath(projectRoot, guidePath),
        status: "completed",
        metadata: { source: "production-resources", genre: genre.genre },
      })
      db.recordMemory(options.projectId as string, {
        source: "production-writing-resources",
        kind: "style_rulebook",
        content: `Genre: ${genre.genre}\n${genre.narration}\n\n${resources.styleGuide.slice(0, 4000)}`,
        importance: 8,
        metadata: { path: relativeArtifactPath(projectRoot, guidePath) },
        embedding: {
          model: "local-hash-v1",
          vector: createLocalTextEmbedding(`${genre.genre}\n${genre.narration}\n${resources.styleGuide}`),
        },
      })
      db.createJob({
        projectId: options.projectId as string,
        kind: "knowledge_global_bootstrap",
        status: "idle",
        payload: {
          scope: "global",
          reason: "production_resources_written",
          limit: process.env.AI_NOVEL_TEST_MODE === "1" ? 4 : undefined,
        },
      })
    }).catch(() => undefined)
    await ingestProjectArtifact({
      rootDir: options.factoryRootDir,
      projectId: options.projectId,
      projectRoot,
      artifactPath: relativeArtifactPath(projectRoot, guidePath),
      kind: "style",
      metadata: { source: "production-resources", genre: genre.genre },
      content,
    }).catch(() => undefined)
  }

  return { resources, guidePath }
}

export function createProductionMasterOutline(
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
  resources: ProductionWritingResources,
) {
  const genre = inferGenreProfile(state)
  const arcSize = Math.max(3, Math.ceil(state.plan.totalChapters / 4))
  const arcs = Array.from({ length: Math.ceil(state.plan.totalChapters / arcSize) }, (_, index) => {
    const start = index * arcSize + 1
    const end = Math.min(state.plan.totalChapters, start + arcSize - 1)
    return [
      `### 第 ${index + 1} 弧：第 ${start}-${end} 章`,
      `- 弧线目标：把「${state.project.idea}」推进到一次明确的压力升级。`,
      "- 情绪功能：先制造缺口，再给出局部兑现，最后留下更大问题。",
      "- 伏笔策略：每弧至少埋设 2 个可回收线索，并回收上一弧至少 1 个承诺。",
      "- 风格策略：旁白、对白和场景密度必须符合类型策略。",
    ].join("\n")
  })

  return [
    "# Production Master Outline",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Genre profile: ${genre.genre}`,
    `Reader promise: ${genre.readerPromise}`,
    `Point of view: ${genre.pointOfView}`,
    `Tone: ${genre.tone}`,
    `Naturalness target: ${genre.naturalnessTarget}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    "",
    "## Story Promise",
    "- 全书必须持续兑现原始创作目标，不允许在无人值守过程中漂移到其它题材。",
    `- 类型旁白策略：${genre.narration}`,
    "",
    "## Source Consensus",
    context.consensus || "- 暂无讨论共识，使用项目初始目标作为最高约束。",
    "",
    "## Character Spine",
    context.protagonist || "- 主角档案仍待细化；后续章节必须持续补全动机、伤口、欲望和变化。",
    "",
    "## Causal Spine",
    "- 全书不是章节事件清单，而是一条承接-选择-代价-交棒链。",
    "- 每章必须继承上一章至少一个状态/物件/关系/代价，并把本章不可逆变化交给下一章。",
    "- 第 2 章以后，如果只沿用主角姓名但没有承接前序锚点，视为主线断裂。",
    "- 章节蓝图必须先回答：上一章给了什么压力，本章推进什么，主角做了什么选择，代价是什么，下一章接什么。",
    "",
    "## Chapter Causality Matrix",
    ...formatChapterCausalityMatrix(state),
    "",
    "## Continuity Anchor Plan",
    ...formatContinuityAnchorPlan(state),
    "",
    "## Character State Ledger Plan",
    ...formatCharacterStateLedgerPlan(state),
    "",
    "## Foreshadowing Payoff Schedule",
    ...formatForeshadowingPayoffSchedule(state),
    "",
    "## Arc Structure",
    ...arcs,
    "",
    "## Foreshadowing Ledger Policy",
    "- 每章 plan 必须声明埋设/回收/延后伏笔。",
    "- 每章写完后 Memory Keeper 必须更新伏笔状态。",
    "",
    "## Quality Policy",
    "- 每章必须经过 Editor、Consistency Checker、Style Controller、Prose Stylist。",
    "- 不达标章节不能直接进入 complete，只能进入返工或阻塞。",
    "",
    "## Migrated Writing Assets",
    `- Style guide loaded: ${resources.styleGuide ? "yes" : "no"}`,
    `- Vocabulary resources loaded: ${resources.vocabularySamples.length}`,
    `- Few-shot examples loaded: ${resources.examples.length}`,
  ].join("\n")
}

async function createMasterOutlineContent(
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
) {
  throwIfPipelineAborted(options)
  const fallback = createProductionMasterOutline(state, context, resources)
  await emitWritingProgress(options, {
    step: "master_planning_started",
    role: "Showrunner",
    status: "started",
    message: "Showrunner 开始把讨论共识整理为全书主线规划。",
    preview: [
      `Project: ${state.project.title}`,
      `Target chapters: ${state.plan.totalChapters}`,
      context.consensus ? context.consensus.slice(0, 360) : "尚无额外共识文本。",
    ].join("\n"),
  })
  if (process.env.AI_NOVEL_TEST_MODE === "1" || options.preferDeterministicPlanning) {
    if (options.preferDeterministicPlanning && options.factoryRootDir && options.projectId) {
      await withFactoryDb(options.factoryRootDir, async (db) => {
        db.recordEvent(options.projectId as string, null, "LLM_FALLBACK_USED", {
          stage: "master_planning",
          reason: "prefer_deterministic_planning",
          fallback: "deterministic_master_outline",
        })
      }).catch(() => undefined)
    }
    await emitWritingProgress(options, {
      step: "master_planning_completed",
      role: "Showrunner",
      status: "completed",
      message: "Showrunner 已生成生产级全书主线规划，后续将进入章节蓝图拆解。",
      preview: fallback.slice(0, 520),
      wordCount: wordCount(fallback),
    })
    return fallback
  }

  const genre = inferGenreProfile(state)
  let generated = ""
  try {
    generated = await generateProductionTextWithLlm({
      roleName: "Showrunner",
      state,
      options,
      temperature: 0.3,
      basePrompt: [
        "你是生产级小说 Showrunner，负责把讨论共识升级为可执行全书规划。",
        "必须保护原始创作目标，不允许漂移题材，不允许直接写章节正文。",
        resources.chapterPlannerGuide || "",
        resources.writerGuide || "",
      ].join("\n\n"),
      dynamicPrompt: [
        `目标章节数：${state.plan.totalChapters}`,
        `单章目标字数：${state.plan.chapterWordTarget}`,
        `类型：${genre.genre}`,
        `读者承诺：${genre.readerPromise}`,
        `视角：${genre.pointOfView}`,
        `语气：${genre.tone}`,
        `自然度目标：${genre.naturalnessTarget}`,
        `类型旁白策略：${genre.narration}`,
        "",
        "必须包含以下 Markdown 小节：",
        "- # Production Master Outline",
	        "- ## Story Promise",
	        "- ## Arc Structure",
	        "- ## Causal Spine",
	        "- ## Chapter Causality Matrix",
	        "- ## Continuity Anchor Plan",
	        "- ## Character State Ledger Plan",
	        "- ## Foreshadowing Payoff Schedule",
	        "- ## Character Spine",
	        "- ## Foreshadowing Ledger Policy",
	        "- ## Quality Policy",
	        "- ## Chapter Blueprint Contract",
	        "",
	        "章节因果要求：",
	        "- Chapter Causality Matrix 必须逐章列出 Previous Input、Causal Objective、Protagonist Decision、Irreversible Change、Next Handoff。",
	        "- 第 2 章以后必须明确承接上一章的状态、物件、关系、代价或未解决问题。",
	        "- 不允许把章节规划写成互不相干的事件清单；每章都要把本章后果交给下一章。",
	      ].join("\n"),
	      message: [
	        "请根据项目目标、已有共识、主角资料和风格资料，生成生产级全书规划。",
	        "不要输出泛泛建议，必须给出可执行弧线、逐章因果推进、伏笔、角色成长和章节蓝图约束。",
	        "",
	        "## Project Goal",
	        state.project.idea,
        "",
        "## Consensus",
        context.consensus || "(empty)",
        "",
        "## Protagonist",
        context.protagonist || "(empty)",
        "",
	        "## Style",
	        context.style || "(empty)",
	        "",
	        "## Initial Chapter Causality Contract",
	        ...formatChapterCausalityMatrix(state),
	      ].join("\n"),
      progress: {
        step: "master_planning",
        role: "Showrunner",
        startMessage: "Showrunner 正在调用模型扩展全书主线规划。",
        completeMessage: "Showrunner 已返回全书主线规划草案。",
      },
    })
  } catch (error) {
    if (!/network|fetch|failed|econn|enotfound|etimedout|socket|undici|timeout|timed\s*out|timed-out/i.test(error instanceof Error ? error.message : String(error))) {
      throw error
    }
    if (options.factoryRootDir && options.projectId) {
      await withFactoryDb(options.factoryRootDir, async (db) => {
        db.recordEvent(options.projectId as string, null, "LLM_FALLBACK_USED", {
          stage: "master_planning",
          reason: error instanceof Error ? error.message : String(error),
          fallback: "deterministic_master_outline",
        })
      }).catch(() => undefined)
    }
    const fallbackWithNote = `${fallback}\n\n---\n\n## LLM Fallback Note\n- Showrunner expansion was deferred because the provider was temporarily unavailable. The deterministic production outline is authoritative for continuing the workflow and can be enriched later.`
    await emitWritingProgress(options, {
      step: "master_planning_completed",
      role: "Showrunner",
      status: "completed",
      message: "Showrunner 使用可恢复的确定性规划继续推进；模型恢复后可再扩展。",
      preview: fallbackWithNote.slice(0, 520),
      wordCount: wordCount(fallbackWithNote),
    })
    return fallbackWithNote
  }

  const result = generated.includes("# Production Master Outline")
    ? generated
    : `${fallback}\n\n---\n\n## LLM Showrunner Expansion\n${generated}`
  await emitWritingProgress(options, {
    step: "master_planning_completed",
    role: "Showrunner",
    status: "completed",
    message: "Showrunner 已完成全书主线规划，后续将进入章节蓝图拆解。",
    preview: result.slice(0, 520),
    wordCount: wordCount(result),
  })
  return result
}

export function createDetailedChapterBlueprint(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  context: { consensus: string; protagonist: string; style: string },
  resources: ProductionWritingResources,
  continuityContract = createContinuityContract({ state, task, context }),
  storyAssetContext: ProductionStoryAssetContext = { prompt: "", files: [] },
) {
	  const genre = inferGenreProfile(state)
	  const sceneType = sceneTypeForChapter(state, task.chapterNumber)
	  const arcLabel = getArcLabel(state, task.chapterNumber)
	  const causalPlan = getTaskCausalPlan(state, task)
	  const effectiveAnchors = uniqueStrings([
	    ...causalPlan.requiredContinuityAnchors,
	    ...continuityContract.continuityAnchors,
	  ]).slice(0, 10)
	  const vocabularyPrompt = createVocabularyUsagePrompt({
	    resources,
	    state,
	    task,
	    sceneType,
	    continuityContract,
	    limit: 20,
	  })
	  const vocabularySkillExamples = createVocabularySkillExamplePrompt(resources, sceneType)
	  const resourceManifest = createVocabularyResourceManifest({
	    resources,
	    state,
	    task,
	    sceneType,
	    continuityContract,
	    limit: 12,
	  })
	  const characterProfileContract = buildCharacterProfileContract({
	    state,
	    task,
	    protagonistProfile: context.protagonist,
	    continuityContract,
	    blueprint: context.consensus,
	  })
	  const sceneCardCount = Math.min(6, Math.max(4, Math.round(Math.max(1200, Number(task.targetWords) || Number(state.plan.chapterWordTarget) || 2500) / 650)))
	  const sceneCardTemplates = [
	    {
	      goal: `用具体异常打开本章问题：${causalPlan.previousInput}`,
	      conflict: "主角遇到无法回避的现场压力或关系压力。",
	      turn: effectiveAnchors.length ? `至少让锚点进入事件：${effectiveAnchors.slice(0, 2).join("、")}` : "建立后续可追踪的物件、线索或关系。",
	      endHook: "读者明确知道本章局部问题是什么。",
	      requiredFacts: effectiveAnchors.slice(0, 2),
	    },
	    {
	      goal: `推进本章目标：${causalPlan.sceneObjective}`,
	      conflict: "外部压力进入人物关系，至少一名配角暴露立场或利益。",
	      turn: "出现新证据、新阻力或新代价。",
	      endHook: "主角被迫接近选择点。",
	      requiredFacts: effectiveAnchors.slice(1, 4),
	    },
	    {
	      goal: `把主角选择写成行动：${causalPlan.protagonistDecision}`,
	      conflict: "选择必须暴露欲望、短板、能力边界或价值取舍。",
	      turn: `角色状态发生变化：${causalPlan.characterStateDelta}`,
	      endHook: "选择带来的代价开始显形。",
	      requiredFacts: effectiveAnchors.slice(2, 5),
	    },
	    {
	      goal: `让不可逆变化成为事实：${causalPlan.irreversibleConsequence}`,
	      conflict: "阻力兑现，局面不能无损回到开场状态。",
	      turn: `伏笔操作进入正文：${causalPlan.foreshadowingOperation}`,
	      endHook: "留下可被下一章追踪的画面、物件、线索或关系压力。",
	      requiredFacts: effectiveAnchors.slice(3, 6),
	    },
	    {
	      goal: `完成下一章交棒：${causalPlan.nextHandoff}`,
	      conflict: "余波不能用总结代替，必须有现场动作或对白。",
	      turn: "本章局部结果落定，同时产生下一章无法绕开的压力。",
	      endHook: causalPlan.nextHandoff,
	      requiredFacts: effectiveAnchors.slice(-3),
	    },
	  ]
	  const executionContract = {
	    version: 1,
	    chapterNumber: task.chapterNumber,
	    title: task.title,
	    chapterRole: task.summary || `${arcLabel} chapter`,
	    chapterPurpose: causalPlan.sceneObjective,
	    macroBeat: task.chapterNumber === 1 ? "E" : "P",
	    suspenseLevel: task.chapterNumber === state.plan.totalChapters ? "payoff" : "active",
	    foreshadowingOperation: causalPlan.foreshadowingOperation,
	    plotTwistLevel: task.chapterNumber % 4 === 0 ? 3 : 2,
	    emotionTarget: "紧张/疑问 -> 压力加深 -> 选择代价 -> 章末期待",
	    conflictLevel: Math.min(5, Math.max(2, Math.ceil(task.chapterNumber / Math.max(1, Math.ceil(state.plan.totalChapters / 5))))),
	    revealLevel: task.chapterNumber === state.plan.totalChapters ? 5 : Math.min(4, Math.max(1, Math.ceil(task.chapterNumber / Math.max(1, Math.ceil(state.plan.totalChapters / 4))))),
	    targetWordCount: task.targetWords,
	    mustAvoid: [
	      "禁止用剧情摘要替代正文",
	      "禁止跳过上一章代价另起剧情",
	      "禁止提前泄露未到场真相",
	      "禁止所有角色使用同一种解释腔",
	    ],
	    allowedCharacters: continuityContract.knownCast.length ? continuityContract.knownCast : ["主角", "对抗力量", "关键关系对象"],
	    forbiddenCharacters: [],
	    allowedNewCharacters: task.chapterNumber === 1 ? ["服务首章事件的关系角色"] : ["仅允许服务本章冲突且进入记忆账本的新角色"],
	    entranceProtocol: {
	      newCharacterStage: task.chapterNumber === 1 ? "meet" : "need-based",
	      requiredIntroElements: ["身份线索", "与主角的关系压力", "可记忆的动作/称呼/体态"],
	    },
	    sceneCards: sceneCardTemplates.slice(0, sceneCardCount).map((card, index) => ({
	      index: index + 1,
	      goal: card.goal,
	      conflict: card.conflict,
	      turn: card.turn,
	      endHook: card.endHook,
	      requiredCharacters: continuityContract.knownCast.slice(0, 4),
	      requiredFacts: card.requiredFacts,
	      forbiddenFacts: ["未来章节真相", "未登场幕后主使身份", "未冻结世界规则"],
	    })),
	    endingHook: causalPlan.nextHandoff,
	    nextChapterEntryState: causalPlan.nextHandoff,
	  }

	  return [
	    "# Detailed Chapter Blueprint",
    "",
    `Project: ${state.project.title}`,
    `Chapter: ${task.chapterNumber}`,
    `Title: ${task.title}`,
    `Arc: ${arcLabel}`,
    `Genre profile: ${genre.genre}`,
    `Reader promise: ${genre.readerPromise}`,
    `Point of view: ${genre.pointOfView}`,
    `Tone: ${genre.tone}`,
    `Naturalness target: ${genre.naturalnessTarget}`,
    `Target words: ${task.targetWords}`,
    `Primary scene type: ${sceneType}`,
    "",
    "## Chapter Execution Contract",
    "```json",
    JSON.stringify(executionContract, null, 2),
    "```",
    "",
    storyAssetContext.prompt,
    storyAssetContext.prompt ? "" : "",
    continuityContract.prompt,
    "",
    characterProfileContract.prompt,
    "",
	    "## Chapter Position",
	    `- 本章服务于：${state.project.idea}`,
	    `- 当前弧线：${arcLabel}`,
	    "- 本章必须完成一个可感知的剧情推进，而不是只做设定说明。",
	    "",
	    "## Previous Inputs",
	    `- ${causalPlan.previousInput}`,
	    continuityContract.previousChapterLedger.length
	      ? `- 前序章节账本：${continuityContract.previousChapterLedger.slice(-3).join(" / ")}`
	      : "- 前序章节账本：暂无已完成前序章节，首章必须建立后续可追踪主线锚点。",
	    "",
	    "## Causal Objective",
	    `- ${causalPlan.sceneObjective}`,
	    "- 本章事件必须是上一章状态推动出来的结果，而不是换地点重新开局。",
	    "",
	    "## Protagonist Decision",
	    `- ${causalPlan.protagonistDecision}`,
	    "",
	    "## Irreversible Change",
	    `- ${causalPlan.irreversibleConsequence}`,
	    "- 这个变化必须进入章末画面或 Memory Keeper 账本，下一章必须能接住。",
	    "",
	    "## Character State Delta",
	    `- ${causalPlan.characterStateDelta}`,
	    "- 配角的信任、债务、恐惧、阵营或利益变化也必须登记；不能只让主角一个人漂浮推进。",
	    "",
	    "## Required Continuity Anchors",
	    ...(effectiveAnchors.length
	      ? effectiveAnchors.map((anchor) => `- ${anchor}`)
	      : ["- 暂无上一章锚点；本章必须建立可追踪物件、关系、线索或代价。"]),
	    "",
	    "## Next Chapter Handoff",
	    `- ${causalPlan.nextHandoff}`,
	    "- 章末钩子必须是本章选择和代价自然产生的后果，不允许只靠陌生人/新事件强行开启下一章。",
	    "",
	    "## Opening Hook",
	    "- 用一个具体动作、异常发现、压迫性选择或关系变化打开。",
	    "- 前 300 字内让读者知道本章问题是什么。",
    "",
	    "## Event Sequence",
	    "1. 开场压力：主角遇到无法回避的局面。",
	    effectiveAnchors.length
	      ? `2. 上章承接：必须自然带出连续性锚点「${effectiveAnchors.slice(0, 4).join("、")}」中的至少两个，让读者看见因果延续。`
	      : "2. 上章承接：如果暂无锚点，本章必须建立可追踪物件、关系或线索供下一章承接。",
	    "3. 信息变化：世界规则、人物关系或局势出现新证据。",
	    "4. 冲突升级：主角做出选择并付出代价。",
    "5. 局部兑现：给读者一个爽点、反转或情绪落点。",
    "6. 章末钩子：把问题推向下一章。",
    "",
    "## Character Actions",
    "- 主角：必须主动选择，不能只被剧情推着走。",
    continuityContract.lockedProtagonistName
      ? `- 主角：本章必须沿用「${continuityContract.lockedProtagonistName}」的姓名、身份、欲望和行为逻辑。`
      : "- 主角：首章必须明确唯一主角姓名，且全文主视角只服务这个主角。",
    "- 配角：沿用 Canon Contract 中已登记的角色关系；新增配角必须说明身份、立场和后续状态。",
    "- 角色档案：重要角色必须具备核心欲望、恐惧/伤口、行为习惯、说话方式、外貌体态、特长短板和关系网络。",
    "- 角色呈现：不能只写“冷静、善良、聪明”等标签，必须通过动作、选择、停顿、称呼、视线和关系压力体现人格。",
    "- 对手/阻力：必须有合理目标，不能只是工具人。",
    "- 配角：至少一人通过行动暴露立场或关系变化。",
    "",
    "## Emotion Curve",
    "- 开头：紧张/疑问。",
    "- 中段：压力加深，信息不完整。",
    "- 高潮：选择、代价、爽点或反转。",
    "- 结尾：短暂落点后留下更强期待。",
    "",
	    "## Foreshadowing Operations",
	    effectiveAnchors.length
	      ? `- 承接锚点：${effectiveAnchors.slice(0, 6).join("、")}。正文必须自然命中至少两个，不得只写在说明里。`
	      : "- 承接锚点：暂无上一章锚点；本章必须新增明确可追踪的物件/线索/关系。",
	    `- 因果操作：${causalPlan.foreshadowingOperation}`,
	    "- 埋设：一个与主线或角色伤口相关的细节。",
	    "- 回收：尽量回收前文一个小承诺。",
    "- 延后：标记一个暂不解释的风险点。",
    "",
    "## Genre Narration",
    `- 类型：${genre.genre}`,
    `- 读者承诺：${genre.readerPromise}`,
    `- 视角：${genre.pointOfView}`,
    `- 语气：${genre.tone}`,
    `- 自然度目标：${genre.naturalnessTarget}`,
    `- 旁白策略：${genre.narration}`,
    "",
	    "## Vocabulary And Idiom Strategy",
	    vocabularyPrompt,
	    "",
	    vocabularySkillExamples,
	    "",
	    resourceManifest,
	    "- 文言比例按场景控制，保持可读性。",
	    "- 禁止单字/短词独立成行反复出现；不要用「冷。静。暗。疼。」这类碎片模拟氛围。",
	    "- 每个场景描写必须是完整动作、感官和因果句；短句只能偶尔用于真正的节奏断点。",
    "",
    "## Resource Usage Plan",
    "- 列出本章将自然吸收的场景、情节、词汇/成语和旁白资源。",
    "- 至少 3 个资源点必须落到具体场景或对白里，不能只写在说明中。",
    "",
	    "## Quality Gates",
	    continuityContract.lockedProtagonistName
	      ? `- 主角一致性：正文必须出现并持续围绕「${continuityContract.lockedProtagonistName}」，不得把章节写成另一条故事线。`
	      : "- 主角一致性：首章必须建立唯一可追踪主角姓名。",
	    "- 配角一致性：不得把既有配角改名、改身份或无因果替换。",
	    "- 角色鲜明度：正文必须呈现角色欲望、行为习惯、说话方式、外貌体态、特长短板和关系状态中的多数信号。",
	    "- 情节连续性：必须承接 Canon Contract 中的前序章节账本和伏笔账本。",
	    "- 因果推进：必须执行 Previous Inputs / Causal Objective / Irreversible Change / Next Chapter Handoff，缺一项即视为流水账。",
	    "- 连续性锚点：第 2 章以后正文必须命中至少两个 Continuity Anchors，否则视为另起剧情。",
	    "- 章节连续性：不得跳章，不得与前序章节冲突。",
    "- 写作资源：必须能看出本章吸收了场景、情节、成语/词汇和风格资源。",
    "- 去 AI 味硬门槛：不得出现高频单字/短词碎片化描写，不得把推荐词孤零零堆成场景。",
    "- 正文比例：必须是可阅读正文，不得用计划、摘要、修改说明充当正文。",
    "",
    "## Drafting Risks",
    "- 不得写成剧情摘要。",
    "- 不得跳到其它章节。",
    "- 不得改变已冻结设定。",
    "- 不得用模板化 AI 句式反复解释情绪。",
    "",
    `Current task summary: ${task.summary}`,
    context.consensus ? `\n## Consensus Carryover\n${context.consensus.slice(0, 1200)}` : "",
    context.protagonist ? `\n## Protagonist Carryover\n${context.protagonist.slice(0, 900)}` : "",
    context.style ? `\n## Style Carryover\n${context.style.slice(0, 900)}` : "",
  ].filter(Boolean).join("\n")
}

async function createChapterBlueprintContent(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  context: { consensus: string; protagonist: string; style: string },
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
  storyAssetContext: ProductionStoryAssetContext = { prompt: "", files: [] },
) {
  throwIfPipelineAborted(options)
  const continuityContract = createContinuityContract({ state, task, context })
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    protagonistProfile: context.protagonist,
    continuityContract,
  })
  const fallback = createDetailedChapterBlueprint(state, task, context, resources, continuityContract, storyAssetContext)
  await emitWritingProgress(options, {
    step: "chapter_blueprint_started",
    role: "Chapter Planner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "started",
    message: `Chapter Planner 开始拆解第 ${task.chapterNumber} 章蓝图。`,
    preview: task.summary,
  })
	  const genre = inferGenreProfile(state)
	  const sceneType = sceneTypeForChapter(state, task.chapterNumber)
	  const causalPlan = getTaskCausalPlan(state, task)
	  const knowledgeContext = await retrieveWritingKnowledgeContext({
    state,
    task,
    options,
    purpose: "blueprint",
    query: `章节蓝图 ${sceneType} 词汇 成语 场景 情节 伏笔 主角一致性`,
    sourceTypes: ["vocabulary", "example", "style_guide", "plan", "memory", "consensus"],
	    limit: 8,
	  })
	  const vocabularyPrompt = createVocabularyUsagePrompt({
	    resources,
	    state,
	    task,
	    sceneType,
	    continuityContract,
	    limit: 20,
	  })
	  await emitWritingKnowledgeRecallProgress({
    options,
    purpose: "blueprint",
    role: "Chapter Planner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    rows: knowledgeContext.rows,
  })
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    await emitWritingProgress(options, {
      step: "chapter_blueprint_completed",
      role: "Chapter Planner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: `Chapter Planner 已生成第 ${task.chapterNumber} 章可执行蓝图。`,
      preview: fallback.slice(0, 520),
      wordCount: wordCount(fallback),
    })
    return fallback
  }

  const generated = await generateProductionTextWithLlm({
    roleName: "Chapter Planner",
    state,
    options,
    temperature: 0.3,
    basePrompt: [
      resources.chapterPlannerGuide || "你是章节结构设计师。",
      "你只生成章节蓝图，不写完整正文。",
      "每章必须可执行、可检查、可交给 Author 写作。",
    ].join("\n\n"),
    dynamicPrompt: [
      `章节：第 ${task.chapterNumber} 章`,
      `标题：${task.title}`,
      `目标字数：${task.targetWords}`,
      `弧线：${getArcLabel(state, task.chapterNumber)}`,
      `类型：${genre.genre}`,
      `读者承诺：${genre.readerPromise}`,
      `视角：${genre.pointOfView}`,
      `语气：${genre.tone}`,
      `自然度目标：${genre.naturalnessTarget}`,
      `主场景类型：${sceneType}`,
      `旁白策略：${genre.narration}`,
      "",
	      "必须包含以下 Markdown 小节：",
	      "- ## Canon Continuity Contract",
	      "- # Detailed Chapter Blueprint",
	      "- ## Chapter Position",
	      "- ## Previous Inputs",
	      "- ## Causal Objective",
	      "- ## Protagonist Decision",
	      "- ## Irreversible Change",
	      "- ## Character State Delta",
	      "- ## Required Continuity Anchors",
	      "- ## Next Chapter Handoff",
	      "- ## Opening Hook",
	      "- ## Event Sequence",
	      "- ## Character Actions",
      "- ## Emotion Curve",
      "- ## Foreshadowing Operations",
      "- ## Genre Narration",
      "- ## Vocabulary And Idiom Strategy",
      "- ## Resource Usage Plan",
      "- ## Quality Gates",
	      "",
	      vocabularyPrompt,
	      "",
	      "Knowledge/RAG References:",
      knowledgeContext.prompt,
      "",
      storyAssetContext.prompt ? `Production Story Assets:\n${storyAssetContext.prompt}` : "",
      storyAssetContext.prompt ? "" : "",
      continuityContract.prompt,
      "",
      characterProfileContract.prompt,
      "",
	      "硬性要求：",
	      continuityContract.lockedProtagonistName
	        ? `- 蓝图必须声明本章如何沿用「${continuityContract.lockedProtagonistName}」，禁止更换主角姓名或身份。`
	        : "- 首章蓝图必须声明唯一主角姓名，禁止多个候选主角并行。",
	      "- 蓝图必须声明已知配角如何沿用、新增配角是否允许以及其关系状态。",
	      "- 蓝图必须补足重要角色的欲望、恐惧/伤口、行为习惯、说话方式、外貌体态、特长短板和关系压力。",
	      "- 蓝图必须声明前序情节、物品、线索、伏笔的承接/推进/回收。",
	      "- 蓝图必须逐项落实 Previous Inputs、Causal Objective、Protagonist Decision、Irreversible Change、Character State Delta、Next Chapter Handoff。",
	      "- 第 2 章以后，如果本章只沿用主角姓名但没有让前序锚点进入事件因果，蓝图无效。",
	      "- 蓝图必须列出 3-5 个来自写作资源/词汇资源的具体使用点。",
	      "- 蓝图必须给 Author 可执行的场景细节、情节推进和检查标准。",
    ].join("\n"),
    message: [
      "请为这一章生成详细写作蓝图。不要写正文，不要跳到其他章节。",
      "蓝图要足够细，后续 Author 能直接按它写出正文。",
      "",
      "## Master/Consensus Context",
      context.consensus || "(empty)",
      "",
      "## Production Story Assets",
      storyAssetContext.prompt || "(empty)",
      "",
      "## Character Context",
      context.protagonist || "(empty)",
      "",
      continuityContract.prompt,
      "",
      characterProfileContract.prompt,
      "",
      "## Style Context",
      context.style || "(empty)",
      "",
	      "## Current Task",
	      task.summary,
	      "",
	      "## Causal Chapter Plan",
	      ...formatCausalPlanBullets(state, task),
	      "",
	      "## Required Causal Contract",
	      `- Previous Input: ${causalPlan.previousInput}`,
	      `- Causal Objective: ${causalPlan.sceneObjective}`,
	      `- Irreversible Change: ${causalPlan.irreversibleConsequence}`,
	      `- Next Chapter Handoff: ${causalPlan.nextHandoff}`,
	    ].join("\n"),
    progress: {
      step: "chapter_blueprint",
      role: "Chapter Planner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `Chapter Planner 正在调用模型生成第 ${task.chapterNumber} 章详细蓝图。`,
      completeMessage: `Chapter Planner 已返回第 ${task.chapterNumber} 章详细蓝图。`,
    },
  })

  const result = generated.includes("# Detailed Chapter Blueprint")
    ? generated
    : `${fallback}\n\n---\n\n## LLM Chapter Planner Expansion\n${generated}`
  await emitWritingProgress(options, {
    step: "chapter_blueprint_completed",
    role: "Chapter Planner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "completed",
    message: `Chapter Planner 已完成第 ${task.chapterNumber} 章蓝图，后续可交给 Author 写作。`,
    preview: result.slice(0, 520),
    wordCount: wordCount(result),
  })
  return result
}

export function createDraftBodyFromBlueprint(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  blueprint: string,
  resources: ProductionWritingResources,
  continuityContract = createContinuityContract({ state, task, blueprint }),
) {
	  const genre = inferGenreProfile(state)
	  const sceneType = sceneTypeForChapter(state, task.chapterNumber)
	  const vocabularyHints = createDraftVocabularyHints({
	    resources,
	    state,
	    task,
	    sceneType,
	    blueprint,
	    continuityContract,
	    limit: 12,
	  })
	  const title = task.title || `第 ${task.chapterNumber} 章`
	  const protagonistName = continuityContract.lockedProtagonistName || "首章主角"
	  const causalPlan = getTaskCausalPlan(state, task)
	  const anchorLine = continuityContract.continuityAnchors.length
	    ? `前文留下的${continuityContract.continuityAnchors.slice(0, 3).join("、")}没有消失，它们先后进入场景，逼出新的判断。`
	    : `本章先建立${causalPlan.requiredContinuityAnchors.slice(0, 3).join("、")}，让后续章节有明确可追踪的线索。`
	  const paragraphs = [
	    `${title}开场时，压力没有先落在旁白里，而是从「${causalPlan.previousInput}」落到${protagonistName}必须立刻处理的一件事上。四周的细节先给出触感、声音和人的反应，让读者看见局面正在收紧。`,
	    `${protagonistName}没有停在犹豫里。${anchorLine}对方提出的要求、场景里暴露的异常、以及前文留下的一个细节同时压过来，逼着他做出选择：${causalPlan.protagonistDecision}这个选择不完美，却能看出他和别人不同。`,
	    `中段的冲突不靠解释堆高，而靠行动推进。有人试探，有人回避，有人把话说得很轻，却把真正的立场藏在停顿里。旁白保持${genre.genre}的质感：${genre.narration}`,
	    `当局势推进到高潮，${protagonistName}终于抓住一个被忽略的线索。这个线索与本章目标「${causalPlan.sceneObjective}」相连，也让前面看似普通的细节产生意义。爽点来自判断成立后的反击、关系变化或规则兑现。`,
	    `章末不把所有答案说完。${causalPlan.irreversibleConsequence}${protagonistName}得到一个局部结果，同时发现更大的问题已经出现。最后一个画面要具体，并把后果交给下一章：${causalPlan.nextHandoff}`,
	  ]

  const expansion: string[] = []
  let sceneIndex = 0
  while (wordCount([...paragraphs, ...expansion].join("\n")) < Math.floor(task.targetWords * 0.82)) {
    const hint = vocabularyHints[sceneIndex % Math.max(1, vocabularyHints.length)] || "使用具体动作和感官细节"
    expansion.push(
      `补充场景 ${sceneIndex + 1}：围绕「${hint.replace(/^[-#]\s*/, "").slice(0, 48)}」展开，但只自然吸收表达，不机械堆词。让动作、对话、心理和环境彼此推动，保持章节目标清晰。${protagonistName}必须在这个场景里做出一个可见选择，选择带来新的关系变化、局势压力或后续钩子。`,
    )
    sceneIndex += 1
  }

  return [
    `# ${title}`,
    "",
    "## Draft Body",
    "",
    ...paragraphs,
    "",
    ...expansion,
    "",
    "## Drafting Metadata",
    `- Chapter: ${task.chapterNumber}`,
    `- Target words: ${task.targetWords}`,
    `- Estimated production words: ${wordCount([...paragraphs, ...expansion].join("\n"))}`,
    `- Scene type: ${sceneType}`,
	    `- Continuity status: ${continuityContract.status}`,
	    `- Locked protagonist: ${continuityContract.lockedProtagonistName || "(first chapter pending)"}`,
	    `- Causal objective: ${causalPlan.sceneObjective}`,
	    `- Next handoff: ${causalPlan.nextHandoff}`,
	    `- Blueprint basis: ${blueprint.includes("Detailed Chapter Blueprint") ? "detailed-blueprint" : "fallback"}`,
	  ].join("\n\n")
}

function createStyleContractTestDraftBody(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  continuityContract: ContinuityContract,
  approvedStyleContext: ApprovedWritingStyleContext,
) {
  const title = task.title || `第 ${task.chapterNumber} 章`
  const protagonistName = continuityContract.lockedProtagonistName || "沈砚"
  const causalPlan = getTaskCausalPlan(state, task)
  const style = approvedStyleContext.contract?.styleContract
  const requiredAnchors = uniqueStrings([
    ...(task.causalPlan?.requiredContinuityAnchors || []),
    ...(continuityContract.continuityAnchors || []),
    "账册",
    "雨声",
    "灯火",
    "门外脚步",
  ].filter(Boolean)).slice(0, 8)
  const anchorSentence = requiredAnchors.length
    ? `本章承接${requiredAnchors.slice(0, 4).join("、")}，不换主角，不换线索。`
    : "本章承接账册、雨声、灯火和门外脚步，不换主角，不换线索。"
  const chapterShift = task.chapterNumber <= 1
    ? "缺页处露出浅墨，官仓添七，民户减三。"
    : `上一章留下的${requiredAnchors.slice(0, 3).join("、") || "账册与门外脚步"}还在，少尹的人已经到了廊下。`
  const positiveExample = style?.positiveExamples?.[0] || "沈砚合上账册，只问一句：谁动过这一页？"
  const baseParagraphs = [
    `开场落在具体异常与现场压力上。雨声贴着窗纸往下滑。${protagonistName}把缺页账册推到灯下。纸边齐得过分，像刚从刀口退出来。灯火一跳，门外脚步停在槛外。`,
    `老周站在那里，袖口压着半枚湿印。${protagonistName}看见了，没有立刻问。${anchorSentence}`,
    `“谁动过？”${protagonistName}问。`,
    "老周没答。鞋尖往后收了半寸。雨声压住他的呼吸，也压住廊下那个人的影子。",
    `${chapterShift}${protagonistName}想要查清税册，不是为了清白。他欠过一条命，欠在同一册账里。这条线索推进关系，也推进代价；这个弱点不能给少尹看见。`,
    `他伸手按住账册，指节很白。${protagonistName}擅长看数字的缝，却不会在权势面前说软话。老周知道这点，所以没有帮他，只拦在门口。`,
    `“别翻了。”老周低声说。`,
    `“你怕谁？”`,
    "老周抬眼。肩上的旧衣湿了一线。那一线水从肩头滑到袖边，像有人刚从雨里抓过他。",
    `门外的人敲了两下。很轻。${protagonistName}把缺页夹进袖里，吹低灯火。每段都必须推进线索、关系或代价；关系裂缝就在这一息里开了口：老周帮他藏账，也把他卖给了门外的人。`,
    positiveExample,
    `纸页贴着掌心发凉。${protagonistName}没有退。他决定先开门。只开半扇。门缝里露出一枚官印，印面倒着“仓曹”两个字。`,
    "“少尹请你走一趟。”门外的人说。",
    `“账呢？”`,
    "“带上。”",
    `${protagonistName}听见老周在身后吸气。他没回头。他把账册收进怀里，又把缺页留在灯下。那一页空着，却比写满更像证据。`,
    `巷口的鼓声过了三下。雨没有停。${protagonistName}知道自己只能选一边：交账，老周活；藏页，他自己活。`,
    "他把门推开。冷风进屋，灯火向后一伏。老周伸手要拦，手到半路又停住。",
    `“沈砚。”老周第一次叫他的名字，“你不能去。”`,
    `“我不去，他们会来问你。”`,
    "老周的脸色灰下去。那不是害怕，是早知道这句话会来。关系到这里已经不能补回原样。",
    `${protagonistName}跨过门槛。门外脚步让开半步，官印却没有收。雨点打在账册封皮上，墨味从旧线里泛出来。`,
    `他把缺页留给老周，也把怀疑留在屋里。结尾留下可追踪问题、关系裂缝或线索余波：老周拿着空白证据，少尹拿着整本账，${protagonistName}只剩袖中一行浅墨。`,
  ]
  const expansionSeeds = [
    `廊下的水聚成窄线。${protagonistName}低头看了一眼，水线从老周脚边绕开，说明他站了很久。`,
    "账册的线装松了一扣。松扣里夹着细小米粒，不是书房里的东西，是仓门口的碎粮。",
    `老周说话总慢半拍。今天不是慢，是在等门外的人替他开口。${protagonistName}看懂了，只把声音压得更低。`,
    "灯火照到官印边缘。印泥未干，红色在雨气里发暗。那枚印本不该出现在小吏门前。",
    `${protagonistName}的短板也在这里。他能算出税册缺口，却算不出一个旧友会在几步之内站到哪边。`,
    "门外的人不催。权力不急的时候，更像刀背。它贴在颈后，不见血，也不肯离开。",
    `沈砚合上账册，只问一句：谁动过这一页？这句话落下，屋里三个人都没有再动。`,
    "雨声更密。屋檐下的黑影向前半寸，又停住。那半寸够了，够把旧信任割开。",
  ]
  const paragraphs = [...baseParagraphs]
  let index = 0
  while (wordCount(paragraphs.join("\n\n")) < Math.floor(task.targetWords * 0.84)) {
    paragraphs.push(expansionSeeds[index % expansionSeeds.length])
    index += 1
  }
  const body = paragraphs.join("\n\n")
  return [
    `# ${title}`,
    "",
    "## Draft Body",
    "",
    body,
    "",
    "## Drafting Metadata",
    `- Chapter: ${task.chapterNumber}`,
    `- Target words: ${task.targetWords}`,
    `- Estimated production words: ${wordCount(body)}`,
    "- Draft source: deterministic style-contract test fixture",
    `- Continuity status: ${continuityContract.status}`,
    `- Locked protagonist: ${continuityContract.lockedProtagonistName || "(first chapter pending)"}`,
    `- Causal objective: ${causalPlan.sceneObjective}`,
    `- Next handoff: ${causalPlan.nextHandoff}`,
  ].join("\n")
}

async function generateProductionTextWithLlm({
  roleName,
  message,
  basePrompt,
  dynamicPrompt,
  state,
  options,
  progress,
  temperature,
}: {
  roleName: string
  message: string
  basePrompt: string
  dynamicPrompt: string
  state: AutonomousNovelState
  options: ProductionPipelineOptions
  progress?: {
    step: string
    role: WritingProgressEvent["role"]
    chapterNumber?: number
    title?: string
    startMessage: string
    completeMessage: string
  }
  temperature?: number
}) {
  throwIfPipelineAborted(options)
  let streamedResult = ""
  let lastStreamProgressAt = 0
  let firstDeltaSeen = false
  const messageId = progress ? createWritingMessageId(progress) : undefined
  if (progress) {
    await emitWritingProgress(options, {
      messageId,
      step: `${progress.step}_llm_started`,
      role: progress.role,
      chapterNumber: progress.chapterNumber,
      title: progress.title,
      status: "running",
      phase: "request_sent",
      statusText: "请求已提交给 LLM，等待模型开始响应。",
      statusDetail: "如果模型或网络暂时没有首段返回，这条消息会保持动态等待状态。",
      message: progress.startMessage,
      preview: [
        `Role: ${roleName}`,
        "",
        dynamicPrompt,
      ].join("\n").slice(0, 520),
    })
  }

  try {
    let result = ""
    const maxLlmAttempts = 3
    let backoffDelay = process.env.AI_NOVEL_TEST_MODE === "1" ? 10 : 2000

    for (let i = 1; i <= maxLlmAttempts; i++) {
      try {
      result = await generateAgentReply({
        roleName,
        basePrompt,
        dynamicPrompt,
        consensus: `Project: ${state.project.title}\nCore idea: ${state.project.idea}\nCurrent stage: ${state.runtime.stage}`,
        message,
        discussionStage: "specialist_turn",
        currentStage: "drafting",
        preferredLanguage: "zh-CN",
        envRootDir: options.envRootDir || options.factoryRootDir || process.cwd(),
        signal: options.signal,
        temperature,
        onDelta: progress
          ? async (delta) => {
            streamedResult += delta
            const now = Date.now()
            const isFirstDelta = !firstDeltaSeen
            firstDeltaSeen = true
            if (!isFirstDelta && now - lastStreamProgressAt < 2500) {
              return
            }
            lastStreamProgressAt = now
            await emitWritingProgress(options, {
              messageId,
              step: `${progress.step}_llm_streaming`,
              role: progress.role,
              chapterNumber: progress.chapterNumber,
              title: progress.title,
              status: "running",
              phase: isFirstDelta ? "response_started" : "streaming",
              statusText: isFirstDelta
                ? "LLM 已开始响应，正在返回首段内容。"
                : "LLM 正在持续返回内容。",
              statusDetail: "返回内容会持续合并到这一条 agent 消息中。",
              message: `${progress.startMessage}模型正在持续输出。`,
              preview: streamedResult.slice(-520),
              streamText: streamedResult,
              wordCount: wordCount(streamedResult),
            })
          }
          : undefined,
      })
      break
    } catch (error) {
      if (i === maxLlmAttempts) {
        const providerError = new Error(`Provider API 调用失败，已重试 ${maxLlmAttempts} 次。详细错误: ${error instanceof Error ? error.message : String(error)}`)
        ;(providerError as any).isProviderFailure = true
        throw providerError
      }
      if (progress) {
        await emitWritingProgress(options, {
          messageId,
          step: `${progress.step}_llm_retry`,
          role: progress.role,
          chapterNumber: progress.chapterNumber,
          title: progress.title,
          status: "running",
          message: `网络或 API 请求异常，正在进行第 ${i} 次重试（等待 ${backoffDelay / 1000} 秒）... 错误: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
      await new Promise((resolve) => setTimeout(resolve, backoffDelay))
      backoffDelay *= 2
    }
  }
    if (progress) {
      throwIfPipelineAborted(options)
      await emitWritingProgress(options, {
        messageId,
        step: `${progress.step}_llm_completed`,
        role: progress.role,
        chapterNumber: progress.chapterNumber,
        title: progress.title,
        status: "completed",
        phase: "completed",
        statusText: "LLM 返回完成，内容已保存并进入下一步。",
        message: progress.completeMessage,
        preview: result.slice(0, 520),
        streamText: result,
        wordCount: wordCount(result),
      })
    }
    return result
  } catch (error) {
    if (progress) {
      await emitWritingProgress(options, {
        messageId,
        step: `${progress.step}_llm_failed`,
        role: progress.role,
        chapterNumber: progress.chapterNumber,
        title: progress.title,
        status: "blocked",
        phase: "failed",
        statusText: "LLM 请求失败，系统会按任务策略处理。",
        message: `${progress.startMessage}失败：${error instanceof Error ? error.message : String(error)}`,
      })
    }
    throw error
  }
}

interface GlobalContextResult {
  prunedConsensus: string
  prunedOutline: string
  prunedStoryAssets: string
  activeWorldSlice: string
  prunedRag: string
  prunedMemory: string
  prunedLedger: string
  previousDraftFragment: string
}

function createActiveWorldSlice(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  blueprint: string
  storyAssets: string
  consensus: string
  continuityContract: ContinuityContract
  maxChars?: number
}) {
  const causalPlan = getTaskCausalPlan(input.state, input.task)
  const knownCast = Array.isArray(input.continuityContract.knownCast) ? input.continuityContract.knownCast : []
  const continuityAnchors = Array.isArray(input.continuityContract.continuityAnchors) ? input.continuityContract.continuityAnchors : []
  const keywords = uniqueStrings([
    input.state.project.title,
    input.state.project.idea,
    input.continuityContract.lockedProtagonistName,
    ...knownCast.slice(0, 8),
    ...continuityAnchors.slice(0, 8),
    ...causalPlan.requiredContinuityAnchors,
    ...String(input.task.title || "").match(/[\u4e00-\u9fffA-Za-z0-9]{2,}/gu) || [],
    ...causalPlan.sceneObjective.match(/[\u4e00-\u9fffA-Za-z0-9]{2,}/gu) || [],
  ].filter(Boolean).map((item) => String(item).trim()).filter((item) => item.length >= 2))
  const chapterPatterns = [
    new RegExp(`第\\s*${input.task.chapterNumber}\\s*章`, "u"),
    new RegExp(`Chapter\\s*${input.task.chapterNumber}\\b`, "iu"),
    new RegExp(`\\|\\s*${input.task.chapterNumber}\\s*\\|`, "u"),
  ]
  const alwaysRelevant = /Frozen World Rules|Non-Negotiable|Causal Spine|Chapter Causality Matrix|Continuity Anchor|Foreshadowing|Character|Relationship|World|Rule|Pressure|Ledger|主角|配角|人物|关系|世界|规则|设定|伏笔|线索|代价|压力|承接|交棒/u
  const sources = [
    ["Story Assets", input.storyAssets],
    ["Consensus", input.consensus],
    ["Blueprint", input.blueprint],
  ] as const
  const rows: string[] = []

  for (const [label, text] of sources) {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    const picked = lines.filter((line) =>
      chapterPatterns.some((pattern) => pattern.test(line))
      || alwaysRelevant.test(line)
      || keywords.some((keyword) => line.includes(keyword))
    ).slice(0, 28)
    if (picked.length) {
      rows.push(`## ${label}`)
      rows.push(...picked.map((line) => `- ${line.replace(/^[-#]\s*/u, "")}`))
    }
  }

  const fallback = [
    "## Causal Focus",
    `- Scene objective: ${causalPlan.sceneObjective}`,
    `- Required anchors: ${causalPlan.requiredContinuityAnchors.join("、") || "none"}`,
    `- Next handoff: ${causalPlan.nextHandoff}`,
  ]
  const content = [
    "# Active World Slice",
    "",
    `Project: ${input.state.project.title}`,
    `Chapter: ${input.task.chapterNumber}`,
    "",
    ...(rows.length ? rows : fallback),
  ].join("\n")
  const maxChars = input.maxChars || 1600
  return content.length > maxChars
    ? `${content.slice(0, maxChars).trimEnd()}\n...[active world slice clipped]`
    : content
}

export async function loadAndPruneGlobalContext(params: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  blueprint: string
  resources: ProductionWritingResources
  options: ProductionPipelineOptions
  continuityContract: ContinuityContract
  paths?: NovelWorkspacePaths
  projectRoot?: string
  knowledgeContext?: { prompt: string; rows: Array<Record<string, unknown>> }
  additionalFixedLength?: number
}): Promise<GlobalContextResult> {
  const { state, task, blueprint, resources, continuityContract, paths } = params

  // 1. 加载上一章正文片段
  let previousDraftFragment = ""
  const previousChapterId = task.chapterNumber > 1 ? `chapter-${String(task.chapterNumber - 1).padStart(3, "0")}` : ""
  if (paths && previousChapterId) {
    const previousFinalDraft = await readOptionalText(path.join(paths.chaptersDir, `${previousChapterId}.final.md`))
    if (previousFinalDraft) {
      previousDraftFragment = previousFinalDraft.slice(-1200)
    }
  }

  // 2. 加载大纲
  let rawOutline = ""
  if (paths) {
    rawOutline = await readOptionalText(paths.masterOutlinePath)
  }

  let rawStoryAssets = ""
  if (paths) {
    const storyAssets = await loadProductionStoryAssetContext(paths, task, 1800)
    rawStoryAssets = storyAssets.prompt
  }

  // 3. 加载共识与设定
  let rawConsensus = ""
  if (paths) {
    rawConsensus = await readOptionalText(paths.consensusPath)
  }
  const activeWorldSlice = createActiveWorldSlice({
    state,
    task,
    blueprint,
    storyAssets: rawStoryAssets,
    consensus: rawConsensus,
    continuityContract,
  })

  // 4. 加载角色记忆
  let rawMemory = ""
  if (paths && previousChapterId) {
    rawMemory = await readOptionalText(path.join(paths.memoryDir, `${previousChapterId}-memory.md`))
  }
  const recalledMemory = await retrieveFactoryMemoryContext({
    state,
    task,
    options: params.options,
    continuityContract,
    limit: 5,
  })
  if (recalledMemory) {
    rawMemory = [rawMemory, recalledMemory].filter(Boolean).join("\n\n")
  }

  // 5. 组装 RAG
  let rawRag = params.knowledgeContext?.prompt || ""

  // 6. 获取 ledger list
  let ledgerList = [...continuityContract.previousChapterLedger]

  // 获取类型预设优先级
  const genre = inferGenreProfile(state)
  const prioritiesText = (genre.contextPriority || []).join("|")

  // --- 阶段 A: 各动态分区初始硬性限额限制 (Ceilings)，防止单个分区撑爆上下文 ---
  if (rawRag.length > 1000) {
    rawRag = rawRag.slice(0, 1000) + "\n...[RAG 知识库超额局部裁剪]"
  }
  if (rawMemory.length > 1200) {
    rawMemory = rawMemory.slice(0, 1200) + "\n...[角色与召回记忆超额局部裁剪]"
  }
  if (rawStoryAssets.length > 1800) {
    rawStoryAssets = rawStoryAssets.slice(0, 1800) + "\n...[故事资产摘要超额局部裁剪]"
  }
  if (ledgerList.join("\n").length > 1500) {
    const tempLedger: string[] = []
    let currentLen = 0
    for (let i = ledgerList.length - 1; i >= 0; i--) {
      const item = ledgerList[i]
      if (currentLen + item.length + 1 <= 1500) {
        tempLedger.unshift(item)
        currentLen += item.length + 1
      } else {
        break
      }
    }
    ledgerList = tempLedger
  }

  // 设定总预算（System Prompt 目标控制在 12,000 字符以内）
  const MAX_TOTAL_CHARS = 12_000
  const fixedLength = params.additionalFixedLength ?? 10_500
  const protagonistName = continuityContract.lockedProtagonistName || ""
  const protectedLength = fixedLength + previousDraftFragment.length + protagonistName.length

  let prunedRag = rawRag
  let prunedMemory = rawMemory
  let prunedLedgerList = [...ledgerList]
  let prunedConsensus = rawConsensus
  let prunedOutline = rawOutline
  let prunedStoryAssets = rawStoryAssets

  // --- 阶段 B: 解析共识设定与大纲，获取核心关联块 ---
  // 匹配 blueprint 里的主要实体与动作关键词，确保共识只保留关联块
  if (prunedConsensus) {
    const keywordSet = new Set<string>()
    if (protagonistName) keywordSet.add(protagonistName)
    const matches = blueprint.match(/[\u4e00-\u9fff]{2,5}/g) || []
    for (const match of matches) {
      if (match.length >= 2 && !/^(章节|章节|标题|字数|类型|旁白|必须|不能|主角|配角|情节|伏笔|如果|这是|需要|进行|已经|这个|但是|因为|所以|或者|没有|可以|我们|他们|你们)$/.test(match)) {
        keywordSet.add(match)
      }
    }
    const blocks = prunedConsensus.split(/\n(?=(?:#+|\d+\.))/g)
    const matchedBlocks: string[] = []
    for (const block of blocks) {
      let isHit = false
      for (const kw of keywordSet) {
        if (block.includes(kw)) {
          isHit = true
          break
        }
      }
      if (isHit) matchedBlocks.push(block)
    }
    if (matchedBlocks.length > 0) {
      prunedConsensus = matchedBlocks.join("\n")
    } else {
      prunedConsensus = prunedConsensus.slice(0, 1500) + "\n...[全局共识无关片段已精简]"
    }
  }

  // 大纲精简：仅截取当前章节前后 20 行
  if (prunedOutline) {
    const currentChapterLabel = `第${task.chapterNumber}章`
    const currentChapterLabelAlt = `第 ${task.chapterNumber} 章`
    const lines = prunedOutline.split("\n")
    let targetIndex = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(currentChapterLabel) || lines[i].includes(currentChapterLabelAlt)) {
        targetIndex = i
        break
      }
    }
    if (targetIndex >= 0) {
      const startLine = Math.max(0, targetIndex - 20)
      const endLine = Math.min(lines.length, targetIndex + 20)
      prunedOutline = [
        "...[主线大纲前期已省略]",
        ...lines.slice(startLine, endLine),
        "...[主线大纲后期已省略]"
      ].join("\n")
    } else {
      prunedOutline = prunedOutline.slice(0, 1500) + "\n...[主线大纲不相关章节已裁剪]"
    }
  }

  const getDynamicLength = () => {
    const ledgerText = prunedLedgerList.join("\n")
    return prunedRag.length + prunedMemory.length + ledgerText.length + prunedConsensus.length + prunedOutline.length + prunedStoryAssets.length
  }

  // --- 阶段 C: 动态类型优先级裁剪算法 ---
  // 根据 prioritiesText 的配置计算各个分区的动态裁剪权重 (权重越高，越优先被扣减)
  let wRag = 5.0
  let wMemory = 4.0
  let wLedger = 3.0
  let wOutline = 2.0
  let wStoryAssets = 0.8
  let wConsensus = 1.0

  if (/案件|线索|疑点|记忆|上一章/i.test(prioritiesText)) {
    // 悬疑解谜类：高度偏向保留章节记忆和事实连续性，优先裁剪共识与大纲
    wMemory = 1.5
    wLedger = 1.0
    wConsensus = 4.0
    wOutline = 3.5
    wStoryAssets = 1.2
  } else if (/境界|功法|世界观|设定|法则|物理/i.test(prioritiesText)) {
    // 玄幻科幻类：高度偏向保留共识设定边界，优先裁剪历史 RAG
    wConsensus = 0.5
    wStoryAssets = 0.4
    wRag = 5.0
    wMemory = 4.0
  } else if (/关系|情感|创伤|角色/i.test(prioritiesText)) {
    // 言情都市类：高度偏向角色关系和情感记忆
    wMemory = 1.0
    wLedger = 2.0
    wConsensus = 4.0
    wStoryAssets = 1.0
  }

  // 动态收缩队列
  const partitions = [
    { name: "Rag", get: () => prunedRag, set: (val: string) => prunedRag = val, weight: wRag },
    { name: "Memory", get: () => prunedMemory, set: (val: string) => prunedMemory = val, weight: wMemory },
    { name: "Ledger", get: () => prunedLedgerList.join("\n"), set: (val: string) => {
      prunedLedgerList = val ? val.split("\n") : []
    }, weight: wLedger },
    { name: "Outline", get: () => prunedOutline, set: (val: string) => prunedOutline = val, weight: wOutline },
    { name: "StoryAssets", get: () => prunedStoryAssets, set: (val: string) => prunedStoryAssets = val, weight: wStoryAssets },
    { name: "Consensus", get: () => prunedConsensus, set: (val: string) => prunedConsensus = val, weight: wConsensus }
  ]

  // 按权重从大到小排序 (高权重的分区先被削减)
  partitions.sort((a, b) => b.weight - a.weight)

  for (const part of partitions) {
    if (protectedLength + getDynamicLength() <= MAX_TOTAL_CHARS) {
      break
    }
    const currentText = part.get()
    if (!currentText) continue

    const overage = (protectedLength + getDynamicLength()) - MAX_TOTAL_CHARS
    if (overage <= 0) break

    // 如果超量很多，或者该分区不属于高保留区，直接将其斩断或扣减
    if (currentText.length > 200) {
      const keepLen = Math.max(0, currentText.length - overage)
      if (keepLen < 150) {
        part.set("")
      } else {
        part.set(currentText.slice(0, keepLen) + `\n...[分层削减：该${part.name}分区因预算超限已二次压缩]`)
      }
    } else {
      part.set("")
    }
  }

  // 确保极端情况下不溢出 15000 字符硬报警线
  const totalLength = protectedLength + getDynamicLength()
  if (totalLength > 15000) {
    console.warn(`[CONTEXT BUDGET WARNING] Total prompt context size of ${totalLength} characters exceeds safe budget of 15000 characters!`)
  }

  return {
    prunedConsensus,
    prunedOutline,
    prunedStoryAssets,
    activeWorldSlice,
    prunedRag,
    prunedMemory,
    prunedLedger: prunedLedgerList.join("\n"),
    previousDraftFragment,
  }
}

/**
 * 动态精简章节蓝图，仅保留写正文核心需要的情节序列和因果计划。
 * 剔除冗余的全局共识承接和已在 System Prompt 中独立引入的成语字典释义。
 */
function trimBlueprintForDrafting(blueprint: string): string {
  let trimmed = blueprint
  trimmed = trimmed.replace(
    /## Chapter Execution Contract\s+```json\s+[\s\S]*?```\s*/u,
    "## Chapter Execution Contract\n- 结构化场景卡已作为当前片段合同单独注入。\n\n",
  )
  const carryoverIndex = trimmed.indexOf("## Consensus Carryover")
  if (carryoverIndex > 0) {
    trimmed = trimmed.slice(0, carryoverIndex).trim()
  }
  const vocabIndex = trimmed.indexOf("## Vocabulary And Idiom Strategy")
  if (vocabIndex > 0) {
    trimmed = trimmed.slice(0, vocabIndex).trim()
  }
  return trimmed
}

function extractJsonArrayAfterKey(text: string, key: string): string {
  const keyIndex = text.indexOf(`"${key}"`)
  if (keyIndex < 0) return ""
  const start = text.indexOf("[", keyIndex)
  if (start < 0) return ""
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === "\"") {
        inString = false
      }
      continue
    }
    if (char === "\"") {
      inString = true
      continue
    }
    if (char === "[") {
      depth += 1
    } else if (char === "]") {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }
  return ""
}

function extractSceneCardsFromBlueprint(blueprint: string): DraftSceneCard[] {
  const sceneCardsJson = extractJsonArrayAfterKey(blueprint, "sceneCards")
  if (!sceneCardsJson) return []
  try {
    const parsed = JSON.parse(sceneCardsJson) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((card: unknown, cardIndex): DraftSceneCard | null => {
        if (!card || typeof card !== "object") return null
        const rawCard = card as Record<string, unknown>
        const requiredCharacters = Array.isArray(rawCard.requiredCharacters)
          ? rawCard.requiredCharacters.map((item: unknown) => String(item).trim()).filter(Boolean)
          : []
        const requiredFacts = Array.isArray(rawCard.requiredFacts)
          ? rawCard.requiredFacts.map((item: unknown) => String(item).trim()).filter(Boolean)
          : []
        const forbiddenFacts = Array.isArray(rawCard.forbiddenFacts)
          ? rawCard.forbiddenFacts.map((item: unknown) => String(item).trim()).filter(Boolean)
          : []
        const goal = String(rawCard.goal || "").trim()
        const conflict = String(rawCard.conflict || "").trim()
        const turn = String(rawCard.turn || "").trim()
        const endHook = String(rawCard.endHook || "").trim()
        if (!goal && !conflict && !turn && !endHook) return null
        return {
          index: Number(rawCard.index) || cardIndex + 1,
          goal,
          conflict,
          turn,
          endHook,
          requiredCharacters,
          requiredFacts,
          forbiddenFacts,
        }
      })
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
  } catch {
    return []
  }
}

export function createDraftSegmentPlan(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  continuityContract = createContinuityContract({ state, task, blueprint: "" }),
  blueprint = "",
): DraftSegmentPlan[] {
  const causalPlan = getTaskCausalPlan(state, task)
  const targetWords = Math.max(1200, Number(task.targetWords) || Number(state.plan.chapterWordTarget) || 2500)
  const protagonist = continuityContract.lockedProtagonistName || "主角"
  const anchors = continuityContract.continuityAnchors.length
    ? continuityContract.continuityAnchors
    : causalPlan.requiredContinuityAnchors
  const sceneCards = extractSceneCardsFromBlueprint(blueprint).slice(0, 8)
  if (sceneCards.length >= 2) {
    const baseTarget = Math.max(260, Math.floor(targetWords / sceneCards.length))
    return sceneCards.map((card, index) => ({
      index: index + 1,
      total: sceneCards.length,
      label: `场景卡 ${card.index}`,
      timelinePosition: `按章节任务单推进第 ${card.index} 个场景`,
      narrativeFocus: [
        card.goal ? `目标：${card.goal}` : "",
        card.conflict ? `冲突：${card.conflict}` : "",
        card.turn ? `转折：${card.turn}` : "",
      ].filter(Boolean).join("；") || `${protagonist}必须在本场景中完成一次可见推进。`,
      requiredBeats: [
        card.goal ? `Scene Goal 落地：${card.goal}` : "",
        card.conflict ? `Scene Conflict 必须写成现场压力：${card.conflict}` : "",
        card.turn ? `Scene Turn 必须改变局面：${card.turn}` : "",
        card.endHook ? `Scene End Hook 收束到：${card.endHook}` : "",
        card.requiredCharacters.length ? `Required Characters: ${card.requiredCharacters.join("、")}` : "",
        card.requiredFacts.length ? `Required Facts: ${card.requiredFacts.join("、")}` : "",
        card.forbiddenFacts.length ? `Forbidden Facts 不得泄露：${card.forbiddenFacts.join("、")}` : "",
      ].filter(Boolean),
      continuityFocus: [...new Set([...card.requiredFacts, ...anchors.slice(index, index + 2)])],
      targetWords: index === sceneCards.length - 1
        ? Math.max(240, targetWords - baseTarget * (sceneCards.length - 1))
        : baseTarget,
      source: "scene_card",
      sceneCard: card,
    }))
  }

  const segmentCount = Math.min(6, Math.max(4, Math.round(targetWords / 650)))
  const baseSegments: Array<Omit<DraftSegmentPlan, "index" | "total" | "targetWords">> = [
    {
      label: "开场承接",
      timelinePosition: "本章开场，紧接上一章余波",
      narrativeFocus: `让${protagonist}在具体场景里碰到上一章留下的问题，先写动作和压力，再写判断。`,
      requiredBeats: [
        `Previous Input 落地：${causalPlan.previousInput}`,
        "用物件、声音、气味或身体反应建立第一场冲突。",
      ],
      continuityFocus: anchors.slice(0, 2),
    },
    {
      label: "压力升级",
      timelinePosition: "开场之后，矛盾从外部压力进入人物关系",
      narrativeFocus: "让旁白贴近现场，推动配角立场、误会、试探或威胁显形。",
      requiredBeats: [
        `Causal Objective 开始被事件推进：${causalPlan.sceneObjective}`,
        "至少让一名配角通过称呼、停顿、动作或利益选择表现差异。",
      ],
      continuityFocus: anchors.slice(1, 4),
    },
    {
      label: "主角决策",
      timelinePosition: "中段转折，主角必须主动选择",
      narrativeFocus: `${protagonist}不能只旁观，必须用可见行动改变局势，并暴露能力边界或短板。`,
      requiredBeats: [
        `Protagonist Decision 写成行动：${causalPlan.protagonistDecision}`,
        `Character State Delta 必须出现：${causalPlan.characterStateDelta}`,
      ],
      continuityFocus: anchors.slice(2, 5),
    },
    {
      label: "不可逆后果",
      timelinePosition: "高潮或临近章末，选择带来代价",
      narrativeFocus: "写出反击、兑现、暴露、损失或关系裂缝，不用解释总结代替事件。",
      requiredBeats: [
        `Irreversible Change 成为事实：${causalPlan.irreversibleConsequence}`,
        `Foreshadowing Operation 推进或回收：${causalPlan.foreshadowingOperation}`,
      ],
      continuityFocus: anchors.slice(3, 6),
    },
    {
      label: "章末交接",
      timelinePosition: "章末余波，留下下一章必须处理的具体问题",
      narrativeFocus: "收住本章局部结果，保留一个具体画面、线索或关系压力交给下一章。",
      requiredBeats: [
        `Next Chapter Handoff 自然产生：${causalPlan.nextHandoff}`,
        "不要把答案讲完，最后一段必须有可追踪的画面或物件。",
      ],
      continuityFocus: anchors.slice(-3),
    },
  ]

  const selected = segmentCount <= 4
    ? [baseSegments[0], baseSegments[1], baseSegments[2], baseSegments[4]]
    : baseSegments.slice(0, segmentCount)
  const baseTarget = Math.max(260, Math.floor(targetWords / selected.length))
  return selected.map((segment, index) => ({
    ...segment,
    index: index + 1,
    total: selected.length,
    targetWords: index === selected.length - 1
      ? Math.max(240, targetWords - baseTarget * (selected.length - 1))
      : baseTarget,
    source: "timeline",
  }))
}

export function createDraftSegmentCompositionPlan(
  segment: DraftSegmentPlan,
  continuityContract: ContinuityContract,
): DraftSegmentCompositionPlan {
  const sceneCard = segment.sceneCard
  const continuityFocus = segment.continuityFocus.length
    ? segment.continuityFocus
    : continuityContract.continuityAnchors.slice(0, 3)
  const protagonist = continuityContract.lockedProtagonistName || "主角"
  return {
    plot: [
      sceneCard?.goal || segment.narrativeFocus,
      sceneCard?.conflict || "把压力写成现场事件，而不是解释性概述。",
      sceneCard?.turn || "让本片段至少发生一次可见局面变化。",
      sceneCard?.endHook || "以具体问题、物件、关系压力或未完成动作收束。",
    ].filter(Boolean),
    narration: [
      "旁白只服务现场推进、感官落点和角色选择，不提前解释后续真相。",
      "先写物件、动作、声音、气味或身体反应，再给极少量判断。",
      "每段至少有一个可见动作或可追踪物件，避免纯心理总结。",
    ],
    dialogue: [
      "对白必须短、有压力，并体现关系或利益，不用对白解释世界观背景。",
      "每个重要说话者至少带一个称呼、停顿、动作或语气差异。",
      sceneCard?.requiredCharacters.length
        ? `对白优先服务这些角色：${sceneCard.requiredCharacters.join("、")}。`
        : `对白必须围绕${protagonist}的选择和现场压力展开。`,
    ],
    characterAction: [
      continuityContract.lockedProtagonistName
        ? `${continuityContract.lockedProtagonistName}必须通过行动、感知或选择推进本片段。`
        : "首章必须建立唯一可追踪主角姓名，并保持主视角聚焦。",
      "重要配角不能只贴性格标签，必须用动作、称呼、习惯或利益选择呈现。",
      "至少让一个角色的欲望、短板、关系状态或风险代价露出痕迹。",
    ],
    continuity: [
      ...continuityFocus.map((item) => `必须自然命中连续性锚点：${item}`),
      sceneCard?.forbiddenFacts.length ? `不得泄露：${sceneCard.forbiddenFacts.join("、")}` : "",
      "不得新增与本片段目标无关的主线真相、幕后身份或未冻结世界规则。",
    ].filter(Boolean),
    assemblyRules: [
      "组装顺序建议：现场锚点 -> 压力/对白 -> 主角动作选择 -> 转折后果 -> 片段钩子。",
      "对话、动作、旁白必须交错，不要连续输出设定说明或讨论式段落。",
      "本片段只能完成当前 segment contract，不提前写完后续 segment。",
      "最终片段要能和上一片段尾巴自然衔接，并给下一片段留下可承接状态。",
    ],
  }
}

function formatChapterContextPackage(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  genre: ReturnType<typeof inferGenreProfile>
  sceneType: string
  writingMode: ProductionWritingMode
  segmentPlan: DraftSegmentPlan[]
  continuityContract: ContinuityContract
  characterProfileContract: CharacterProfileContract
  approvedStyleContext: ApprovedWritingStyleContext
  prunedContext: GlobalContextResult
  trimmedBlueprint: string
  basePromptText: string
  fixedDynamicPromptText: string
  cappedVocabularyPrompt: string
  cappedVocabularySkillExamples: string
  cappedResourceManifest: string
}): string {
  const causalPlan = getTaskCausalPlan(input.state, input.task)
  const segmentationSource = input.segmentPlan.some((segment) => segment.source === "scene_card")
    ? "scene_card"
    : "timeline"
  const budgetRows = [
    ["basePrompt", input.basePromptText.length],
    ["fixedDynamicPrompt", input.fixedDynamicPromptText.length],
    ["chapterGuardrails", input.trimmedBlueprint.length],
    ["activeWorldSlice", input.prunedContext.activeWorldSlice.length],
    ["storyAssets", input.prunedContext.prunedStoryAssets.length],
    ["consensus", input.prunedContext.prunedConsensus.length],
    ["outline", input.prunedContext.prunedOutline.length],
    ["memory", input.prunedContext.prunedMemory.length],
    ["ledger", input.prunedContext.prunedLedger.length],
    ["rag", input.prunedContext.prunedRag.length],
    ["previousTail", input.prunedContext.previousDraftFragment.length],
    ["vocabularyPrompt", input.cappedVocabularyPrompt.length],
    ["skillExamples", input.cappedVocabularySkillExamples.length],
    ["resourceManifest", input.cappedResourceManifest.length],
    ["approvedStyle", input.approvedStyleContext.prompt.length],
    ["continuityContract", input.continuityContract.prompt.length],
    ["characterProfileContract", input.characterProfileContract.prompt.length],
  ]
  const segmentRows = input.segmentPlan.map((segment) => [
    `### Segment ${segment.index}/${segment.total}: ${segment.label}`,
    `- Source: ${segment.source || "timeline"}`,
    `- Target words: ${segment.targetWords}`,
    `- Timeline: ${segment.timelinePosition}`,
    `- Focus: ${segment.narrativeFocus}`,
    segment.continuityFocus.length ? `- Continuity focus: ${segment.continuityFocus.join("、")}` : "",
    segment.sceneCard?.requiredCharacters.length ? `- Required characters: ${segment.sceneCard.requiredCharacters.join("、")}` : "",
    segment.sceneCard?.requiredFacts.length ? `- Required facts: ${segment.sceneCard.requiredFacts.join("、")}` : "",
    segment.sceneCard?.forbiddenFacts.length ? `- Forbidden facts: ${segment.sceneCard.forbiddenFacts.join("、")}` : "",
    "- Required beats:",
    ...segment.requiredBeats.map((beat) => `  - ${beat}`),
  ].filter(Boolean).join("\n"))
  const compositionRows = input.segmentPlan.map((segment) => {
    const composition = createDraftSegmentCompositionPlan(segment, input.continuityContract)
    return [
      `### Segment ${segment.index}/${segment.total}: ${segment.label}`,
      "#### Plot",
      ...composition.plot.map((item) => `- ${item}`),
      "#### Narration",
      ...composition.narration.map((item) => `- ${item}`),
      "#### Dialogue",
      ...composition.dialogue.map((item) => `- ${item}`),
      "#### Character Action",
      ...composition.characterAction.map((item) => `- ${item}`),
      "#### Continuity",
      ...composition.continuity.map((item) => `- ${item}`),
      "#### Assembly Rules",
      ...composition.assemblyRules.map((item) => `- ${item}`),
    ].join("\n")
  })

  return [
    "# Chapter Context Package",
    "",
    `Project: ${input.state.project.title}`,
    `Chapter: ${input.task.chapterNumber}`,
    `Title: ${input.task.title}`,
    `Writing mode: ${input.writingMode}`,
    `Genre: ${input.genre.genre}`,
    `Scene type: ${input.sceneType}`,
    `Segmentation source: ${segmentationSource}`,
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Prompt Budget",
    "| Section | Chars |",
    "|---|---:|",
    ...budgetRows.map(([label, value]) => `| ${label} | ${value} |`),
    "",
    "## Chapter Causal Plan",
    `- Previous Input: ${causalPlan.previousInput}`,
    `- Causal Objective: ${causalPlan.sceneObjective}`,
    `- Protagonist Decision: ${causalPlan.protagonistDecision}`,
    `- Irreversible Change: ${causalPlan.irreversibleConsequence}`,
    `- Character State Delta: ${causalPlan.characterStateDelta}`,
    `- Foreshadowing Operation: ${causalPlan.foreshadowingOperation}`,
    `- Next Chapter Handoff: ${causalPlan.nextHandoff}`,
    `- Required Continuity Anchors: ${causalPlan.requiredContinuityAnchors.join("、") || "none"}`,
    "",
    "## Segment Plan",
    ...segmentRows,
    "",
    "## Segment Composition Plans",
    ...compositionRows,
    "",
    "## Approved Style Contract",
    input.approvedStyleContext.prompt || "(missing)",
    "",
    "## Active World Slice",
    input.prunedContext.activeWorldSlice || "(empty)",
    "",
    "## Story Assets",
    input.prunedContext.prunedStoryAssets || "(empty)",
    "",
    "## Consensus And Setting Freeze",
    input.prunedContext.prunedConsensus || "(empty)",
    "",
    "## Character Memory",
    input.prunedContext.prunedMemory || "(empty)",
    "",
    "## Previous Chapter Ledger",
    input.prunedContext.prunedLedger || "(empty)",
    "",
    "## Knowledge/RAG References",
    input.prunedContext.prunedRag || "(empty)",
    "",
    "## Continuity Contract",
    input.continuityContract.prompt,
    "",
    "## Character Profile Contract",
    input.characterProfileContract.prompt.slice(0, 2400),
    "",
    "## Chapter Guardrails",
    input.trimmedBlueprint,
  ].join("\n")
}

async function writeChapterContextPackage(input: {
  projectRoot: string
  paths: NovelWorkspacePaths
  options: ProductionPipelineOptions
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  genre: ReturnType<typeof inferGenreProfile>
  sceneType: string
  writingMode: ProductionWritingMode
  segmentPlan: DraftSegmentPlan[]
  continuityContract: ContinuityContract
  characterProfileContract: CharacterProfileContract
  approvedStyleContext: ApprovedWritingStyleContext
  prunedContext: GlobalContextResult
  trimmedBlueprint: string
  basePromptText: string
  fixedDynamicPromptText: string
  cappedVocabularyPrompt: string
  cappedVocabularySkillExamples: string
  cappedResourceManifest: string
}): Promise<ChapterContextPackageInfo | null> {
  const chapterId = `chapter-${String(input.task.chapterNumber).padStart(3, "0")}`
  const checkpointsRoot = path.join(input.paths.workspaceDir, "checkpoints")
  const contextDir = path.join(checkpointsRoot, "chapter-contexts")
  const contextPath = path.join(contextDir, `${chapterId}-context.md`)
  const activeWorldSliceDir = path.join(checkpointsRoot, "active-world-slices")
  const activeWorldSlicePath = path.join(activeWorldSliceDir, `${chapterId}-world-slice.md`)
  await fs.mkdir(contextDir, { recursive: true })
  await fs.mkdir(activeWorldSliceDir, { recursive: true })
  const content = formatChapterContextPackage(input)
  await fs.writeFile(contextPath, `${content.trimEnd()}\n`)
  await fs.writeFile(activeWorldSlicePath, `${input.prunedContext.activeWorldSlice.trimEnd()}\n`)
  const relativePath = relativeArtifactPath(input.projectRoot, contextPath)
  const segmentationSource = input.segmentPlan.some((segment) => segment.source === "scene_card")
    ? "scene_card"
    : "timeline"
  await recordPipelineArtifact(input.projectRoot, contextPath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "chapter_context_package",
    segmentationSource,
    segmentCount: input.segmentPlan.length,
    promptBudget: {
      basePromptChars: input.basePromptText.length,
      fixedDynamicPromptChars: input.fixedDynamicPromptText.length,
      guardrailsChars: input.trimmedBlueprint.length,
      activeWorldSliceChars: input.prunedContext.activeWorldSlice.length,
      storyAssetsChars: input.prunedContext.prunedStoryAssets.length,
      consensusChars: input.prunedContext.prunedConsensus.length,
      memoryChars: input.prunedContext.prunedMemory.length,
      ledgerChars: input.prunedContext.prunedLedger.length,
      ragChars: input.prunedContext.prunedRag.length,
    },
  })
  await recordPipelineArtifact(input.projectRoot, activeWorldSlicePath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "active_world_slice",
    chars: input.prunedContext.activeWorldSlice.length,
  })
  return {
    path: contextPath,
    relativePath,
    promptBudget: {
      basePromptChars: input.basePromptText.length,
      fixedDynamicPromptChars: input.fixedDynamicPromptText.length,
      guardrailsChars: input.trimmedBlueprint.length,
      activeWorldSliceChars: input.prunedContext.activeWorldSlice.length,
      storyAssetsChars: input.prunedContext.prunedStoryAssets.length,
      consensusChars: input.prunedContext.prunedConsensus.length,
      memoryChars: input.prunedContext.prunedMemory.length,
      ledgerChars: input.prunedContext.prunedLedger.length,
      ragChars: input.prunedContext.prunedRag.length,
    },
    segmentCount: input.segmentPlan.length,
    segmentationSource,
  }
}

function formatSegmentBriefArtifact(input: {
  title: string
  kind: DraftSegmentSubArtifactInfo["kind"]
  items: string[]
  segment: DraftSegmentPlan
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  promptBudgetChars: number
  executionPrompt: string[]
  generatedBody?: string
}): string {
  const roleLabel = input.kind
    .replace("character_action", "character action")
    .replace("_", " ")
  return [
    `# ${input.title}`,
    "",
    `Chapter: ${input.task.chapterNumber}`,
    `Segment: ${input.segment.index}/${input.segment.total}`,
    `Kind: ${input.kind}`,
    `Label: ${input.segment.label}`,
    `Timeline: ${input.segment.timelinePosition}`,
    `Target words: ${input.segment.targetWords}`,
    `Suggested prompt budget: ${input.promptBudgetChars} chars`,
    "",
    "## Brief",
    ...input.items.map((item) => `- ${item}`),
    "",
    "## LLM Execution Prompt",
    `你是本片段的 ${roleLabel} 子任务执行器。`,
    "只处理本 brief 覆盖的职责，不扩写完整章节，不提前泄露后续剧情。",
    ...input.executionPrompt.map((line) => `- ${line}`),
    "",
    "## Expected Output Contract",
    "- 返回可被组装器使用的正文素材或约束清单。",
    "- 不要输出解释、计划标题、Markdown 表格或与本片段无关的世界观补充。",
    "- 必须服从 Segment Focus、Required Beats 和连续性约束。",
    "",
    "## Segment Focus",
    input.segment.narrativeFocus,
    "",
    input.segment.requiredBeats.length
      ? ["## Required Beats", ...input.segment.requiredBeats.map((beat) => `- ${beat}`)].join("\n")
      : "",
    "",
    input.generatedBody ? `## Assembled Segment Body\n${input.generatedBody.trim()}` : "",
  ].filter(Boolean).join("\n")
}

function formatSegmentMaterialArtifact(input: {
  title: string
  kind: DraftSegmentSubArtifactInfo["kind"]
  items: string[]
  segment: DraftSegmentPlan
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  generatedBody: string
}): string {
  const bodyPreview = input.generatedBody.trim().slice(0, 1800)
  const materialLabel = input.kind
    .replace("character_action", "character action")
    .replace("_", " ")
  return [
    `# ${input.title.replace("Brief", "Material")}`,
    "",
    `Chapter: ${input.task.chapterNumber}`,
    `Segment: ${input.segment.index}/${input.segment.total}`,
    `Kind: ${input.kind}`,
    `Material mode: deterministic-placeholder`,
    "",
    "## Source Brief",
    ...input.items.map((item) => `- ${item}`),
    "",
    "## Material Contract",
    `- This file is the ${materialLabel} result slot for future per-part LLM execution.`,
    "- 当前版本使用确定性占位内容，不额外调用模型。",
    "- 后续可以把本文件的生成替换为对应 brief 的独立模型调用。",
    "",
    "## Deterministic Material",
    input.kind === "assembly"
      ? "当前组装结果直接引用已生成片段正文；未来会由多类素材组装生成。"
      : `当前 ${materialLabel} 素材来自组合计划和已生成片段摘要，用于占位和审计。`,
    "",
    "## Segment Body Reference",
    bodyPreview || "(empty)",
  ].join("\n")
}

async function writeDraftSegmentSubArtifacts(input: {
  projectRoot: string
  options: ProductionPipelineOptions
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  segmentDir: string
  composition: DraftSegmentCompositionPlan
  generatedBody: string
  materialOverrides?: Partial<Record<DraftSegmentSubArtifactInfo["kind"], string>>
}): Promise<DraftSegmentSubArtifactInfo[]> {
  const briefs: Array<{
    kind: DraftSegmentSubArtifactInfo["kind"]
    filename: string
    materialFilename: string
    title: string
    items: string[]
    promptBudgetChars: number
    executionPrompt: string[]
    body?: string
  }> = [
    {
      kind: "plot",
      filename: "brief-plot.md",
      materialFilename: "material-plot.md",
      title: "Plot Turn Brief",
      items: input.composition.plot,
      promptBudgetChars: 1200,
      executionPrompt: [
        "把本片段的现场压力、选择、转折和钩子压成 3-5 个可执行情节拍点。",
        "每个拍点必须能被写成动作、对白或物件变化。",
        "不要新增幕后真相，只明确本片段内部因果。",
      ],
    },
    {
      kind: "narration",
      filename: "brief-narration.md",
      materialFilename: "material-narration.md",
      title: "Narration Brief",
      items: input.composition.narration,
      promptBudgetChars: 1600,
      executionPrompt: [
        "生成本片段可用的旁白素材，优先写物件、声音、触感、空间移动和身体反应。",
        "旁白必须贴近当前视角，不总结未来，不解释谜底。",
        "输出应能穿插到对白和动作之间，而不是整段说明。",
      ],
    },
    {
      kind: "dialogue",
      filename: "brief-dialogue.md",
      materialFilename: "material-dialogue.md",
      title: "Dialogue Brief",
      items: input.composition.dialogue,
      promptBudgetChars: 1400,
      executionPrompt: [
        "生成本片段可用的短对白素材，每句对白都要带现场压力或关系信息。",
        "每个说话者用称呼、停顿、动作或语气区分，不要同一种解释腔。",
        "对白不要承担大段设定说明。",
      ],
    },
    {
      kind: "character_action",
      filename: "brief-character-action.md",
      materialFilename: "material-character-action.md",
      title: "Character Action Brief",
      items: input.composition.characterAction,
      promptBudgetChars: 1400,
      executionPrompt: [
        "列出主角和关键配角在本片段必须发生的可见行动。",
        "行动要暴露欲望、短板、风险代价或关系变化。",
        "不要只写心理标签，必须落到手、眼、步伐、物件处理或具体选择。",
      ],
    },
    {
      kind: "continuity",
      filename: "brief-continuity.md",
      materialFilename: "material-continuity.md",
      title: "Continuity Brief",
      items: input.composition.continuity,
      promptBudgetChars: 1000,
      executionPrompt: [
        "提炼本片段必须命中的连续性锚点、禁写事实和不可新增信息。",
        "只保留会影响本片段生成的硬约束。",
        "输出要能作为组装前的检查清单。",
      ],
    },
    {
      kind: "assembly",
      filename: "brief-assembly.md",
      materialFilename: "material-assembly.md",
      title: "Assembly Brief",
      items: input.composition.assemblyRules,
      promptBudgetChars: 1800,
      executionPrompt: [
        "根据情节、旁白、对白、动作和连续性素材组装为一个连续正文片段。",
        "正文必须动作、对白、旁白交错，不输出子任务痕迹。",
        "结尾给下一片段留下可承接状态。",
      ],
      body: input.generatedBody,
    },
  ]

  const written: DraftSegmentSubArtifactInfo[] = []
  for (const brief of briefs) {
    const briefPath = path.join(input.segmentDir, brief.filename)
    const content = formatSegmentBriefArtifact({
      title: brief.title,
      kind: brief.kind,
      items: brief.items,
      segment: input.segment,
      task: input.task,
      promptBudgetChars: brief.promptBudgetChars,
      executionPrompt: brief.executionPrompt,
      generatedBody: brief.body,
    })
    await fs.writeFile(briefPath, `${content.trimEnd()}\n`)
    const relativePath = relativeArtifactPath(input.projectRoot, briefPath)
    await recordPipelineArtifact(input.projectRoot, briefPath, "checkpoint", input.options, {
      chapterNumber: input.task.chapterNumber,
      kind: "chapter_draft_segment_brief",
      segmentIndex: input.segment.index,
      segmentTotal: input.segment.total,
      briefKind: brief.kind,
      chars: content.length,
    })
    written.push({
      kind: brief.kind,
      role: "brief",
      path: briefPath,
      relativePath,
      chars: content.length,
    })
    const materialPath = path.join(input.segmentDir, brief.materialFilename)
    const override = input.materialOverrides?.[brief.kind]?.trim()
    const materialContent = override
      ? [
          `# ${brief.title.replace("Brief", "Material")}`,
          "",
          `Chapter: ${input.task.chapterNumber}`,
          `Segment: ${input.segment.index}/${input.segment.total}`,
          `Kind: ${brief.kind}`,
          `Material mode: llm-subcall`,
          "",
          "## Source Brief",
          ...brief.items.map((item) => `- ${item}`),
          "",
          "## LLM Material",
          override,
        ].join("\n")
      : formatSegmentMaterialArtifact({
          title: brief.title,
          kind: brief.kind,
          items: brief.items,
          segment: input.segment,
          task: input.task,
          generatedBody: input.generatedBody,
        })
    await fs.writeFile(materialPath, `${materialContent.trimEnd()}\n`)
    const materialRelativePath = relativeArtifactPath(input.projectRoot, materialPath)
    await recordPipelineArtifact(input.projectRoot, materialPath, "checkpoint", input.options, {
      chapterNumber: input.task.chapterNumber,
      kind: "chapter_draft_segment_material",
      segmentIndex: input.segment.index,
      segmentTotal: input.segment.total,
      materialKind: brief.kind,
      chars: materialContent.length,
      mode: override ? "llm-subcall" : "deterministic-placeholder",
    })
    written.push({
      kind: brief.kind,
      role: "material",
      path: materialPath,
      relativePath: materialRelativePath,
      chars: materialContent.length,
    })
  }
  return written
}

async function generateDraftSegmentDialogueMaterial(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  composition: DraftSegmentCompositionPlan
  options: ProductionPipelineOptions
  previousSegmentTail: string
}): Promise<string | null> {
  if (!input.options.draftSubcallRoles?.includes("dialogue")) {
    return null
  }
  return generateProductionTextWithLlm({
    roleName: "Dialogue",
    state: input.state,
    options: input.options,
    temperature: 0.55,
    progress: {
      step: `draft_dialogue_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Dialogue 正在生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的对白素材。`,
      completeMessage: `Dialogue 已生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的对白素材。`,
    },
    basePrompt: [
      "你是小说片段对白素材生成器。",
      "只生成本片段可供组装器使用的对白素材，不写完整章节。",
      "对白必须短、有压力，并体现关系、利益或现场选择。",
    ].join("\n"),
    dynamicPrompt: [
      `章节：第 ${input.task.chapterNumber} 章`,
      `标题：${input.task.title}`,
      `片段：${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `时间线：${input.segment.timelinePosition}`,
      `片段焦点：${input.segment.narrativeFocus}`,
      "",
      "## Dialogue Brief",
      ...input.composition.dialogue.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail\n${input.previousSegmentTail}` : "",
      "",
      "输出要求：只返回 4-8 条可用对白素材；可以附极短动作提示；不要解释设定；不要写标题。",
    ].filter(Boolean).join("\n"),
    message: "请生成当前片段的对白素材，供后续 assembly 组装使用。",
  })
}

async function generateDraftSegmentPlotMaterial(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  composition: DraftSegmentCompositionPlan
  options: ProductionPipelineOptions
  previousSegmentTail: string
}): Promise<string | null> {
  if (!input.options.draftSubcallRoles?.includes("plot")) {
    return null
  }
  return generateProductionTextWithLlm({
    roleName: "Plot Turn",
    state: input.state,
    options: input.options,
    temperature: 0.45,
    progress: {
      step: `draft_plot_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Plot Turn 正在生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的情节拍点素材。`,
      completeMessage: `Plot Turn 已生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的情节拍点素材。`,
    },
    basePrompt: [
      "你是小说片段情节拍点素材生成器。",
      "只生成本片段可供组装器使用的情节拍点，不写完整章节。",
      "每个拍点必须包含现场压力、人物选择、转折后果或片段钩子。",
    ].join("\n"),
    dynamicPrompt: [
      `章节：第 ${input.task.chapterNumber} 章`,
      `标题：${input.task.title}`,
      `片段：${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `时间线：${input.segment.timelinePosition}`,
      `片段焦点：${input.segment.narrativeFocus}`,
      "",
      "## Plot Brief",
      ...input.composition.plot.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail\n${input.previousSegmentTail}` : "",
      "",
      "输出要求：只返回 3-5 个可执行情节拍点；每个拍点能落到动作、对白或物件变化；不要写标题。",
    ].filter(Boolean).join("\n"),
    message: "请生成当前片段的情节拍点素材，供后续 assembly 组装使用。",
  })
}

async function generateDraftSegmentNarrationMaterial(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  composition: DraftSegmentCompositionPlan
  options: ProductionPipelineOptions
  previousSegmentTail: string
}): Promise<string | null> {
  if (!input.options.draftSubcallRoles?.includes("narration")) {
    return null
  }
  return generateProductionTextWithLlm({
    roleName: "Narration",
    state: input.state,
    options: input.options,
    temperature: 0.58,
    progress: {
      step: `draft_narration_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Narration 正在生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的旁白素材。`,
      completeMessage: `Narration 已生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的旁白素材。`,
    },
    basePrompt: [
      "你是小说片段旁白素材生成器。",
      "只生成本片段可供组装器使用的旁白素材，不写完整章节。",
      "旁白必须贴近视角，用物件、声音、触感、空间移动和身体反应推动场景。",
    ].join("\n"),
    dynamicPrompt: [
      `章节：第 ${input.task.chapterNumber} 章`,
      `标题：${input.task.title}`,
      `片段：${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `时间线：${input.segment.timelinePosition}`,
      `片段焦点：${input.segment.narrativeFocus}`,
      "",
      "## Narration Brief",
      ...input.composition.narration.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail\n${input.previousSegmentTail}` : "",
      "",
      "输出要求：只返回 3-6 条可穿插旁白素材；不要总结未来；不要解释设定；不要写标题。",
    ].filter(Boolean).join("\n"),
    message: "请生成当前片段的旁白素材，供后续 assembly 组装使用。",
  })
}

async function generateDraftSegmentCharacterActionMaterial(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  composition: DraftSegmentCompositionPlan
  options: ProductionPipelineOptions
  previousSegmentTail: string
}): Promise<string | null> {
  if (!input.options.draftSubcallRoles?.includes("character_action")) {
    return null
  }
  return generateProductionTextWithLlm({
    roleName: "Character Action",
    state: input.state,
    options: input.options,
    temperature: 0.52,
    progress: {
      step: `draft_character_action_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Character Action 正在生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的人物行动素材。`,
      completeMessage: `Character Action 已生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的人物行动素材。`,
    },
    basePrompt: [
      "你是小说片段人物行动素材生成器。",
      "只生成本片段可供组装器使用的人物行动素材，不写完整章节。",
      "行动必须可见、具体，并暴露欲望、短板、风险代价或关系变化。",
    ].join("\n"),
    dynamicPrompt: [
      `章节：第 ${input.task.chapterNumber} 章`,
      `标题：${input.task.title}`,
      `片段：${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `时间线：${input.segment.timelinePosition}`,
      `片段焦点：${input.segment.narrativeFocus}`,
      "",
      "## Character Action Brief",
      ...input.composition.characterAction.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail\n${input.previousSegmentTail}` : "",
      "",
      "输出要求：只返回 4-8 条人物行动素材；每条必须落到手、眼、步伐、物件处理或具体选择；不要写标题。",
    ].filter(Boolean).join("\n"),
    message: "请生成当前片段的人物行动素材，供后续 assembly 组装使用。",
  })
}

async function generateDraftSegmentContinuityMaterial(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  composition: DraftSegmentCompositionPlan
  options: ProductionPipelineOptions
  previousSegmentTail: string
}): Promise<string | null> {
  if (!input.options.draftSubcallRoles?.includes("continuity")) {
    return null
  }
  return generateProductionTextWithLlm({
    roleName: "Continuity",
    state: input.state,
    options: input.options,
    temperature: 0.2,
    progress: {
      step: `draft_continuity_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Continuity 正在生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的连续性素材。`,
      completeMessage: `Continuity 已生成第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的连续性素材。`,
    },
    basePrompt: [
      "你是小说片段连续性素材生成器。",
      "只生成本片段组装前必须遵守的连续性清单，不写完整章节。",
      "必须明确必写锚点、禁写事实、不能提前泄露的内容和片段结束状态。",
    ].join("\n"),
    dynamicPrompt: [
      `章节：第 ${input.task.chapterNumber} 章`,
      `标题：${input.task.title}`,
      `片段：${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `时间线：${input.segment.timelinePosition}`,
      `片段焦点：${input.segment.narrativeFocus}`,
      "",
      "## Continuity Brief",
      ...input.composition.continuity.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail\n${input.previousSegmentTail}` : "",
      "",
      "输出要求：只返回检查清单；包含 must-hit、must-not-write、handoff-state 三类；不要写标题。",
    ].filter(Boolean).join("\n"),
    message: "请生成当前片段的连续性检查素材，供后续 assembly 组装使用。",
  })
}

async function generateDraftSegmentAssemblyMaterial(input: {
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  composition: DraftSegmentCompositionPlan
  options: ProductionPipelineOptions
  previousSegmentTail: string
  materials: Partial<Record<DraftSegmentSubArtifactInfo["kind"], string>>
  fallbackBody: string
}): Promise<string | null> {
  if (!input.options.draftSubcallRoles?.includes("assembly")) {
    return null
  }
  const materialBlock = (kind: DraftSegmentSubArtifactInfo["kind"], content?: string) =>
    content?.trim()
      ? [`## ${kind} material`, content.trim()].join("\n")
      : ""
  return generateProductionTextWithLlm({
    roleName: "Assembly",
    state: input.state,
    options: input.options,
    temperature: 0.64,
    progress: {
      step: `draft_assembly_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Assembly 正在组装第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的候选正文。`,
      completeMessage: `Assembly 已组装第 ${input.task.chapterNumber} 章片段 ${input.segment.index}/${input.segment.total} 的候选正文。`,
    },
    basePrompt: [
      "你是小说片段组装器。",
      "根据情节、旁白、对白、人物行动和连续性素材，组装为一个连续正文片段。",
      "只输出小说正文，不输出标题、解释、清单或 Markdown。",
    ].join("\n"),
    dynamicPrompt: [
      `章节：第 ${input.task.chapterNumber} 章`,
      `标题：${input.task.title}`,
      `片段：${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `时间线：${input.segment.timelinePosition}`,
      `片段目标字数：${input.segment.targetWords}`,
      `片段焦点：${input.segment.narrativeFocus}`,
      "",
      "## Assembly Rules",
      ...input.composition.assemblyRules.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail\n${input.previousSegmentTail}` : "",
      "",
      materialBlock("plot", input.materials.plot),
      "",
      materialBlock("narration", input.materials.narration),
      "",
      materialBlock("dialogue", input.materials.dialogue),
      "",
      materialBlock("character_action", input.materials.character_action),
      "",
      materialBlock("continuity", input.materials.continuity),
      "",
      input.fallbackBody ? `## Existing Author Segment For Reference\n${compactAssemblyReferenceBody(input.fallbackBody)}` : "",
      "",
      "输出要求：只返回连续小说正文；动作、对白、旁白必须交错；不得提前写后续片段；不得泄露 continuity 禁写事实。",
    ].filter(Boolean).join("\n"),
    message: "请根据分项素材组装当前片段候选正文，只返回小说正文。",
  })
}

function cleanDraftAssemblyBody(text = "") {
  return text
    .replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/g, "$1")
    .replace(/^#+\s+.*$/gmu, "")
    .replace(/^(片段|Segment)\s*\d+[\s\S]*?\n/iu, "")
    .trim()
}

function isUsableDraftAssemblyBody(text = "", fallbackBody = "") {
  const normalized = text.trim()
  const fallbackLength = fallbackBody.trim().length
  const minimumLength = fallbackLength > 0 ? Math.min(24, Math.max(8, Math.floor(fallbackLength * 0.08))) : 8
  if (normalized.length < minimumLength) {
    return false
  }
  if (!/[。！？!?」”]/u.test(normalized)) {
    return false
  }
  if (/^\s*[{[]/u.test(normalized)) {
    return false
  }
  const lines = normalized.split(/\n+/u).map((line) => line.trim()).filter(Boolean)
  const listLikeLines = lines.filter((line) => /^([-*]|\d+[.)、]|must-|##|#|```)/iu.test(line)).length
  if (lines.length > 0 && listLikeLines / lines.length > 0.4) {
    return false
  }
  if (/^(以下|下面|这里|这是|根据|组装|候选正文|输出|正文如下)[:：]/u.test(normalized)) {
    return false
  }
  if (/^(我将|我会|可以|无法|不能|抱歉|作为|说明|分析)/u.test(normalized)) {
    return false
  }
  return true
}

async function writeDraftSegmentManifest(input: {
  projectRoot: string
  options: ProductionPipelineOptions
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  segmentDir: string
  segmentPath: string
  segmentRelativePath: string
  subArtifacts: DraftSegmentSubArtifactInfo[]
  segmentationSource: "scene_card" | "timeline"
  materialModes?: Partial<Record<DraftSegmentSubArtifactInfo["kind"], "deterministic-placeholder" | "llm-subcall">>
  assemblyUsage?: DraftSegmentAssemblyUsage
  chars: number
}): Promise<{ path: string; relativePath: string }> {
  const manifestPath = path.join(input.segmentDir, "segment-manifest.json")
  const byKind = input.subArtifacts.reduce<Record<string, { brief?: string; material?: string }>>((acc, artifact) => {
    const current = acc[artifact.kind] || {}
    current[artifact.role] = artifact.relativePath
    acc[artifact.kind] = current
    return acc
  }, {})
  const manifest = {
    version: 1,
    mode: Object.values(input.materialModes || {}).some((mode) => mode === "llm-subcall")
      ? "mixed"
      : "deterministic-placeholder",
    project: input.state.project.title,
    chapterNumber: input.task.chapterNumber,
    chapterTitle: input.task.title,
    segment: {
      index: input.segment.index,
      total: input.segment.total,
      label: input.segment.label,
      source: input.segment.source || input.segmentationSource,
      targetWords: input.segment.targetWords,
      timeline: input.segment.timelinePosition,
      focus: input.segment.narrativeFocus,
      chars: input.chars,
    },
    files: {
      body: input.segmentRelativePath,
      subArtifacts: input.subArtifacts.map((artifact) => ({
        kind: artifact.kind,
        role: artifact.role,
        path: artifact.relativePath,
        chars: artifact.chars,
        mode: artifact.role === "material"
          ? input.materialModes?.[artifact.kind] || "deterministic-placeholder"
          : "prompt-brief",
      })),
      byKind,
    },
    execution: {
      current: Object.values(input.materialModes || {}).some((mode) => mode === "llm-subcall")
        ? "single_author_call_with_selected_llm_submaterials"
        : "single_author_call_with_deterministic_submaterials",
      nextReadyStep: "replace_one_material_role_with_llm_call",
      recommendedFirstRoles: ["dialogue", "narration", "character_action"],
      assemblyRole: "assembly",
      assembly: input.assemblyUsage || {
        requested: false,
        decision: "not_requested",
        reason: "assembly role was not enabled for this segment",
        materialChars: 0,
        finalChars: input.chars,
        fallbackChars: input.chars,
      },
    },
  }
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  const relativePath = relativeArtifactPath(input.projectRoot, manifestPath)
  await recordPipelineArtifact(input.projectRoot, manifestPath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "chapter_draft_segment_manifest",
    segmentIndex: input.segment.index,
    segmentTotal: input.segment.total,
    segmentSource: input.segment.source || input.segmentationSource,
    subArtifactCount: input.subArtifacts.length,
    mode: manifest.mode,
  })
  return { path: manifestPath, relativePath }
}

async function writeDraftSegmentArtifact(input: {
  projectRoot: string
  paths: NovelWorkspacePaths
  options: ProductionPipelineOptions
  state: AutonomousNovelState
  task: AutonomousNovelState["plan"]["chapterTasks"][number]
  segment: DraftSegmentPlan
  content: string
  previousSegmentTail: string
  segmentationSource: "scene_card" | "timeline"
  continuityContract: ContinuityContract
  materialOverrides?: Partial<Record<DraftSegmentSubArtifactInfo["kind"], string>>
  materialModes?: Partial<Record<DraftSegmentSubArtifactInfo["kind"], "deterministic-placeholder" | "llm-subcall">>
  assemblyUsage?: DraftSegmentAssemblyUsage
}): Promise<DraftSegmentArtifactInfo | null> {
  const chapterId = `chapter-${String(input.task.chapterNumber).padStart(3, "0")}`
  const segmentId = `segment-${String(input.segment.index).padStart(2, "0")}`
  const segmentsRoot = path.join(input.paths.workspaceDir, "checkpoints", "chapter-segments", chapterId)
  const segmentDir = path.join(segmentsRoot, segmentId)
  const segmentPath = path.join(segmentDir, `${segmentId}.md`)
  await fs.mkdir(segmentDir, { recursive: true })
  const sceneCardLines = input.segment.sceneCard
    ? [
        "## Scene Card",
        `- Index: ${input.segment.sceneCard.index}`,
        `- Goal: ${input.segment.sceneCard.goal}`,
        `- Conflict: ${input.segment.sceneCard.conflict}`,
        `- Turn: ${input.segment.sceneCard.turn}`,
        `- End hook: ${input.segment.sceneCard.endHook}`,
        input.segment.sceneCard.requiredCharacters.length ? `- Required characters: ${input.segment.sceneCard.requiredCharacters.join("、")}` : "",
        input.segment.sceneCard.requiredFacts.length ? `- Required facts: ${input.segment.sceneCard.requiredFacts.join("、")}` : "",
        input.segment.sceneCard.forbiddenFacts.length ? `- Forbidden facts: ${input.segment.sceneCard.forbiddenFacts.join("、")}` : "",
      ].filter(Boolean)
    : []
  const composition = createDraftSegmentCompositionPlan(input.segment, input.continuityContract)
  const content = [
    `# Chapter ${input.task.chapterNumber} Segment ${input.segment.index}/${input.segment.total}`,
    "",
    `Project: ${input.state.project.title}`,
    `Chapter title: ${input.task.title}`,
    `Source: ${input.segment.source || input.segmentationSource}`,
    `Label: ${input.segment.label}`,
    `Target words: ${input.segment.targetWords}`,
    `Timeline: ${input.segment.timelinePosition}`,
    `Focus: ${input.segment.narrativeFocus}`,
    input.segment.continuityFocus.length ? `Continuity focus: ${input.segment.continuityFocus.join("、")}` : "Continuity focus: none",
    "",
    "## Required Beats",
    ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
    "",
    ...sceneCardLines,
    sceneCardLines.length ? "" : "",
    "## Composition Plan",
    "### Plot",
    ...composition.plot.map((item) => `- ${item}`),
    "### Narration",
    ...composition.narration.map((item) => `- ${item}`),
    "### Dialogue",
    ...composition.dialogue.map((item) => `- ${item}`),
    "### Character Action",
    ...composition.characterAction.map((item) => `- ${item}`),
    "### Continuity",
    ...composition.continuity.map((item) => `- ${item}`),
    "### Assembly Rules",
    ...composition.assemblyRules.map((item) => `- ${item}`),
    "",
    input.previousSegmentTail ? `## Previous Segment Tail\n${input.previousSegmentTail}\n` : "",
    "## Generated Body",
    input.content.trim(),
  ].filter((line) => line !== undefined).join("\n")
  await fs.writeFile(segmentPath, `${content.trimEnd()}\n`)
  const subArtifacts = await writeDraftSegmentSubArtifacts({
    projectRoot: input.projectRoot,
    options: input.options,
    task: input.task,
    segment: input.segment,
    segmentDir,
    composition,
    generatedBody: input.content,
    materialOverrides: input.materialOverrides,
  })
  const relativePath = relativeArtifactPath(input.projectRoot, segmentPath)
  const manifest = await writeDraftSegmentManifest({
    projectRoot: input.projectRoot,
    options: input.options,
    state: input.state,
    task: input.task,
    segment: input.segment,
    segmentDir,
    segmentPath,
    segmentRelativePath: relativePath,
    subArtifacts,
    segmentationSource: input.segmentationSource,
    materialModes: input.materialModes,
    assemblyUsage: input.assemblyUsage,
    chars: input.content.length,
  })
  await recordPipelineArtifact(input.projectRoot, segmentPath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "chapter_draft_segment",
    segmentIndex: input.segment.index,
    segmentTotal: input.segment.total,
    segmentSource: input.segment.source || input.segmentationSource,
    label: input.segment.label,
    chars: input.content.length,
    subArtifactCount: subArtifacts.length,
    manifestPath: manifest.relativePath,
  })
  return {
    path: segmentPath,
    relativePath,
    segmentIndex: input.segment.index,
    segmentTotal: input.segment.total,
    source: input.segment.source || input.segmentationSource,
    chars: input.content.length,
    manifestPath: manifest.path,
    manifestRelativePath: manifest.relativePath,
    subArtifacts,
  }
}

async function createDraftBody(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  blueprint: string,
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
  continuityContract = createContinuityContract({ state, task, blueprint }),
  paths?: NovelWorkspacePaths,
  projectRoot?: string,
  characterDossiers?: CharacterDossier[],
  approvedStyleContext: ApprovedWritingStyleContext = { status: "missing", prompt: "" },
) {
  throwIfPipelineAborted(options)
  if (options.projectId) {
    invalidateProjectCache(options.projectId)
  }
  if (continuityContract.status === "blocked") {
    throw new Error(`Continuity contract is blocked before drafting: chapter ${task.chapterNumber} has no locked protagonist.`)
  }
  const fallback = createDraftBodyFromBlueprint(state, task, blueprint, resources, continuityContract)
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: blueprint,
    blueprint,
  })
  const genre = inferGenreProfile(state)
  const sceneType = sceneTypeForChapter(state, task.chapterNumber)
  const causalPlan = getTaskCausalPlan(state, task)
  const knowledgeContext = await retrieveWritingKnowledgeContext({
    state,
    task,
    options,
    purpose: "draft",
    query: `正文写作 ${sceneType} 成语 词汇 场景描写 前文记忆 主角一致性`,
    sourceTypes: ["vocabulary", "example", "style_guide", "chapter", "plan", "memory", "consensus"],
    limit: 10,
  })
  const vocabularyPrompt = createVocabularyUsagePrompt({
    resources,
    state,
    task,
    sceneType,
    blueprint,
    continuityContract,
    limit: 24,
  })
  const vocabularySkillExamples = createVocabularySkillExamplePrompt(resources, sceneType)
  const resourceManifest = createVocabularyResourceManifest({
    resources,
    state,
    task,
    sceneType,
    blueprint,
    continuityContract,
    limit: 14,
  })
  await emitWritingKnowledgeRecallProgress({
    options,
    purpose: "draft",
    role: "Author",
    chapterNumber: task.chapterNumber,
    title: task.title,
    rows: knowledgeContext.rows,
  })
  const cappedVocabularyPrompt = summarizePromptSection(vocabularyPrompt, 650)
  const cappedVocabularySkillExamples = summarizePromptSection(vocabularySkillExamples, 420)
  const cappedResourceManifest = summarizePromptSection(resourceManifest, 280)
  const cappedWriterGuide = summarizePromptSection(resources.writerGuide || "", 620)
  const cappedAntiHallucination = summarizePromptSection(resources.antiHallucinationGuide || "", 340)
  const cappedConflictStrategy = summarizePromptSection(resources.evidenceConflictStrategy || "", 300)
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext)

  const basePromptLines = [
    cappedWriterGuide || "你是小说正文创作执行者。",
    "",
    "必须写正文，不要只写计划、摘要或建议。",
    "必须严格遵循章节蓝图、类型旁白策略、成语密度与角色差异。",
    "必须严格执行章节因果合同：承接上一章输入、完成本章目标、让主角做选择、留下不可逆变化、把后果交给下一章。",
    continuityContract.lockedProtagonistName
      ? `主角一致性是硬门槛：本章必须继续使用「${continuityContract.lockedProtagonistName}」，不得改名、换身份或写成另一条故事线。`
      : "主角一致性是硬门槛：首章必须明确唯一主角姓名，后续章节会锁定该姓名。",
    "配角、情节、伏笔和世界规则必须遵循 Canon Continuity Contract。",
    "角色档案是生产硬约束：重要角色必须有欲望、伤口、行为习惯、说话方式、外貌体态、特长短板和关系状态。",
    "第 2 章以后不能只沿用主角姓名；必须让上一章锚点在正文事件中发生作用。",
    "禁止 AI 化碎片写法：不得让单个字或 1-4 字短词反复独立成句/成行堆场景。",
    hasApprovedStyleSummaryPrompt(approvedStyleContext)
      ? "用户确认写法合同是硬约束：必须模仿其叙述声音、句式节奏、对白密度、描写顺序和禁用模式。"
      : "",
  ]

  if (cappedAntiHallucination) {
    basePromptLines.push("", `【反幻觉与细节留白约束】\n${cappedAntiHallucination}`)
  }
  if (cappedConflictStrategy) {
    basePromptLines.push("", `【多源事实冲突处理策略】\n${cappedConflictStrategy}`)
  }

  const fixedDynamicPromptLines = [
    `章节：第 ${task.chapterNumber} 章`,
    `标题：${task.title}`,
    `类型：${genre.genre}`,
    `读者承诺：${genre.readerPromise}`,
    `视角：${genre.pointOfView}`,
    `语气：${genre.tone}`,
    `自然度目标：${genre.naturalnessTarget}`,
    `目标字数：${task.targetWords}`,
    `场景类型：${sceneType}`,
    `旁白策略：${genre.narration}`,
    "",
    cappedVocabularyPrompt,
    "",
    cappedVocabularySkillExamples,
    "",
    cappedResourceManifest,
    "",
    approvedStyleCarryover,
    "",
    continuityContract.prompt,
    "",
    clipPromptSection(characterProfileContract.prompt, 700),
    "",
    "资源使用硬要求：",
    "- 至少自然吸收 3 个词汇/场景资源提示，但不能堆砌成语。",
    "- 必须学习 Migrated Vocabulary Skill Examples 的正确示范方法：基础词汇写清内容，少量成语只做点睛。",
    "- 必须避开 Anti Patterns：连续成语、孤立成语、单字短词连发、只有氛围没有动作。",
    "- 场景必须有具体动作、物件、气味/声音/触感中的至少两类细节。",
    "- 章节必须围绕蓝图推进，不得输出修改说明或泛化模板段落。",
    `- Previous Input 必须进入开场或第一场冲突：${causalPlan.previousInput}`,
    `- Causal Objective 必须在正文中被事件推进：${causalPlan.sceneObjective}`,
    `- Protagonist Decision 必须写成可见行动：${causalPlan.protagonistDecision}`,
    `- Irreversible Change 必须成为章末事实：${causalPlan.irreversibleConsequence}`,
    `- Next Chapter Handoff 必须从本章后果自然产生：${causalPlan.nextHandoff}`,
    continuityContract.lockedProtagonistName
      ? `- 正文必须多次围绕「${continuityContract.lockedProtagonistName}」的行动、感知 and 选择推进。`
      : "- 正文必须明确唯一主角姓名，并保持主视角聚焦。",
    "- 不得凭空替换已知配角；新增配角必须交代身份、立场和与主角关系。",
    "- 新增或沿用的重要角色必须通过动作、称呼、停顿、外貌体态、习惯和利益选择呈现人格，不能只贴性格标签。",
    "- 正文必须体现至少一个角色的特长/短板或能力边界，以及至少一个关系状态变化。",
    "- 必须承接前序章节账本中的状态、代价、物品、线索或伏笔。",
    continuityContract.continuityAnchors.length
      ? `- 正文必须自然命中至少两个上一章连续性锚点：${continuityContract.continuityAnchors.slice(0, 8).join("、")}。`
      : "- 正文必须建立可供下一章追踪的具体物件、关系、线索或代价。",
    "- 不要把推荐词、成语或氛围词孤立成行；所有词都必须嵌入完整动作、对话、感官或因果句。",
    "- 严禁出现典型的 AI 化行文：严禁在文中出现「不仅如此」、「与此同时」、「然而」、「事实上」、「不得不说」、「值得一提的是」等说教或分析腔的逻辑过渡词。",
    "- 打碎连续句子的平均长度，增加长短句的错落突发性（Burstiness），多用有体感的具体动作、环境细节和口语对白，少用抽象的总结词与情绪标签描述。",
  ]

  const basePromptText = basePromptLines.join("\n")
  const fixedDynamicPromptText = fixedDynamicPromptLines.join("\n")
  // 增加 1000 字符代表底层协议及 Response Contract 长度
  const additionalFixedLength = basePromptText.length + fixedDynamicPromptText.length + 1000

  const prunedContext = await loadAndPruneGlobalContext({
    state,
    task,
    blueprint,
    resources,
    options,
    continuityContract,
    paths,
    projectRoot,
    knowledgeContext,
    additionalFixedLength,
  })

  // 打印各组件大小，便于诊断
  console.log(
    `[WRITING CTX] Chapter ${task.chapterNumber} Author Draft 上下文分布:` +
    ` writerGuide=${(resources.writerGuide || "").length}字` +
    ` vocabPrompt=${cappedVocabularyPrompt.length}字` +
    ` skillExamples=${cappedVocabularySkillExamples.length}字` +
    ` manifest=${cappedResourceManifest.length}字` +
    ` activeWorldSlice=${prunedContext.activeWorldSlice.length}字` +
    ` consensus=${prunedContext.prunedConsensus.length}字` +
    ` outline=${prunedContext.prunedOutline.length}字` +
    ` storyAssets=${prunedContext.prunedStoryAssets.length}字` +
    ` memory=${prunedContext.prunedMemory.length}字` +
    ` ledger=${prunedContext.prunedLedger.length}字` +
    ` prevFragment=${prunedContext.previousDraftFragment.length}字` +
    ` rag=${prunedContext.prunedRag.length}字`,
  )

  const segmentPlan = createDraftSegmentPlan(state, task, continuityContract, blueprint)
  const usesSceneCards = segmentPlan.some((segment) => segment.source === "scene_card")
  const activeWorldSlicePrompt = prunedContext.activeWorldSlice
    ? `## Active World Slice\n${prunedContext.activeWorldSlice}`
    : ""
  const compactStoryAssetsPrompt = prunedContext.prunedStoryAssets
    ? `## Story Assets Audit Summary\n${prunedContext.prunedStoryAssets.slice(0, 900)}`
    : ""
  const blueprintGuardrails = activeWorldSlicePrompt || compactStoryAssetsPrompt
    ? trimBlueprintForDrafting(blueprint).replace(
        /## Production Story Asset Context[\s\S]*?(?=\n## Canon Continuity Contract|\n## Character Profile Contract|\n## Chapter Position|$)/u,
        [activeWorldSlicePrompt, compactStoryAssetsPrompt].filter(Boolean).join("\n\n"),
      )
    : trimBlueprintForDrafting(blueprint)
  const trimmedBlueprint = blueprintGuardrails.slice(0, usesSceneCards ? 2200 : 5000)
  const contextPackage = paths && projectRoot
    ? await writeChapterContextPackage({
        projectRoot,
        paths,
        options,
        state,
        task,
        genre,
        sceneType,
        writingMode: productionWritingMode(options),
        segmentPlan,
        continuityContract,
        characterProfileContract,
        approvedStyleContext,
        prunedContext,
        trimmedBlueprint,
        basePromptText,
        fixedDynamicPromptText,
        cappedVocabularyPrompt,
        cappedVocabularySkillExamples,
        cappedResourceManifest,
      })
    : null
  if (contextPackage) {
    await emitWritingProgress(options, {
      step: "chapter_context_package_saved",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: `第 ${task.chapterNumber} 章上下文包已保存：${contextPackage.segmentCount} 个片段，${contextPackage.segmentationSource === "scene_card" ? "场景卡" : "时间线"}分段。`,
      artifactPath: contextPackage.relativePath,
      preview: [
        `segmentation=${contextPackage.segmentationSource}`,
        `segments=${contextPackage.segmentCount}`,
        `guardrails=${contextPackage.promptBudget.guardrailsChars} chars`,
        `activeWorldSlice=${contextPackage.promptBudget.activeWorldSliceChars} chars`,
        `storyAssets=${contextPackage.promptBudget.storyAssetsChars} chars`,
      ].join(" | "),
    })
  }
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return approvedStyleContext.status === "ready"
      ? createStyleContractTestDraftBody(state, task, continuityContract, approvedStyleContext)
      : fallback
  }
  const generatedSegments: string[] = []
  const segmentArtifacts: DraftSegmentArtifactInfo[] = []
  let previousSegmentTail = compactPreviousSegmentTail(prunedContext.previousDraftFragment)

  for (const segment of segmentPlan) {
    throwIfPipelineAborted(options)
    const priorSegmentTail = previousSegmentTail
    const sceneCardPrompt = segment.sceneCard
      ? [
          "## Current Scene Card",
          `- Scene card: ${segment.sceneCard.index}`,
          segment.sceneCard.goal ? `- Goal: ${segment.sceneCard.goal}` : "",
          segment.sceneCard.conflict ? `- Conflict: ${segment.sceneCard.conflict}` : "",
          segment.sceneCard.turn ? `- Turn: ${segment.sceneCard.turn}` : "",
          segment.sceneCard.endHook ? `- End hook: ${segment.sceneCard.endHook}` : "",
          segment.sceneCard.requiredCharacters.length
            ? `- Required characters: ${segment.sceneCard.requiredCharacters.join("、")}`
            : "",
          segment.sceneCard.requiredFacts.length
            ? `- Required facts: ${segment.sceneCard.requiredFacts.join("、")}`
            : "",
          segment.sceneCard.forbiddenFacts.length
            ? `- Forbidden facts: ${segment.sceneCard.forbiddenFacts.join("、")}`
            : "",
          "- 只写当前场景卡覆盖的时间段，不要提前完成后续场景卡。",
        ].filter(Boolean).join("\n")
      : ""
    const compositionPlan = createDraftSegmentCompositionPlan(segment, continuityContract)
    const compositionPrompt = [
      "## Segment Composition Contract",
      "### Plot",
      ...compositionPlan.plot.map((item) => `- ${item}`),
      "### Narration",
      ...compositionPlan.narration.map((item) => `- ${item}`),
      "### Dialogue",
      ...compositionPlan.dialogue.map((item) => `- ${item}`),
      "### Character Action",
      ...compositionPlan.characterAction.map((item) => `- ${item}`),
      "### Continuity",
      ...compositionPlan.continuity.map((item) => `- ${item}`),
      "### Assembly Rules",
      ...compositionPlan.assemblyRules.map((item) => `- ${item}`),
    ].join("\n")
    const generated = await generateProductionTextWithLlm({
      roleName: "Author",
      state,
      options,
      temperature: 0.78,
      progress: {
        step: `draft_generation_segment_${segment.index}`,
        role: "Author",
        chapterNumber: task.chapterNumber,
        title: task.title,
        startMessage: `Author 正在生成第 ${task.chapterNumber} 章片段 ${segment.index}/${segment.total}：${segment.label}。`,
        completeMessage: `Author 已返回第 ${task.chapterNumber} 章片段 ${segment.index}/${segment.total}：${segment.label}。`,
      },
      basePrompt: basePromptText,
      dynamicPrompt: [
        `章节：第 ${task.chapterNumber} 章`,
        `标题：${task.title}`,
        `类型：${genre.genre}`,
        `场景类型：${sceneType}`,
        `旁白策略：${genre.narration}`,
        `本次只写片段：${segment.index}/${segment.total} - ${segment.label}`,
        `片段目标字数：${segment.targetWords}`,
        `时间线位置：${segment.timelinePosition}`,
        `叙事焦点：${segment.narrativeFocus}`,
        "",
        sceneCardPrompt,
        "",
        "本片段必须完成：",
        ...segment.requiredBeats.map((beat) => `- ${beat}`),
        "",
        segment.continuityFocus.length
          ? `本片段优先承接这些锚点：${segment.continuityFocus.join("、")}`
          : "本片段必须建立可追踪的物件、关系、线索或代价。",
        "",
        cappedVocabularyPrompt,
        "",
        cappedVocabularySkillExamples,
        "",
        cappedResourceManifest,
        "",
        approvedStyleCarryover,
        "",
        prunedContext.prunedConsensus ? `Consensus & Setting Freeze:\n${clipPromptSection(prunedContext.prunedConsensus, 900)}` : "",
        "",
        prunedContext.prunedOutline ? `Master Outline:\n${clipPromptSection(prunedContext.prunedOutline, 700)}` : "",
        "",
        prunedContext.prunedStoryAssets ? `Story Assets:\n${clipPromptSection(prunedContext.prunedStoryAssets, 900)}` : "",
        "",
        prunedContext.prunedMemory ? `Character Memory:\n${clipPromptSection(prunedContext.prunedMemory, 520)}` : "",
        "",
        prunedContext.prunedLedger ? `Previous Chapter Ledger:\n${clipPromptSection(prunedContext.prunedLedger, 520)}` : "",
        "",
        prunedContext.prunedRag ? `Knowledge/RAG References:\n${clipPromptSection(prunedContext.prunedRag, 520)}` : "",
        "",
        clipPromptSection(continuityContract.prompt, 1050),
        "",
        clipPromptSection(characterProfileContract.prompt, 760),
        "",
        "片段写作硬要求：",
        "- 只输出这一段小说正文，不要输出 Markdown 标题、片段编号、说明或总结。",
        "- 从上一片段尾巴自然接续，但不要复述上一片段。",
        "- 每段都必须包含动作、对话或感官细节，不能只写旁白概述。",
        "- 对话、旁白和动作要服务本片段时间线，不要提前写完后续片段。",
        "- 不能堆砌成语，不能把氛围词孤立成行。",
        hasApprovedStyleSummaryPrompt(approvedStyleContext)
          ? "- 必须贴合 User Approved Writing Style Contract；如果通用写作指南与该合同冲突，以用户确认写法合同为准。"
          : "",
        continuityContract.lockedProtagonistName
          ? `- 必须保持主角「${continuityContract.lockedProtagonistName}」一致。`
          : "- 必须明确唯一主角姓名，并保持主视角聚焦。",
      ].filter(Boolean).join("\n"),
      message: [
        "请按时间线生成本章的一个连续正文片段。",
        "只返回小说正文，不要返回标题、计划、解释、列表或代码块。",
        "",
        "## Chapter Causal Plan",
        ...formatCausalPlanBullets(state, task),
        "",
        "## Segment Contract",
        `- Segment: ${segment.index}/${segment.total} ${segment.label}`,
        `- Timeline: ${segment.timelinePosition}`,
        `- Focus: ${segment.narrativeFocus}`,
        `- Target words: ${segment.targetWords}`,
        ...segment.requiredBeats.map((beat) => `- ${beat}`),
        "",
        compositionPrompt,
        "",
        previousSegmentTail ? `## Previous Tail\n${previousSegmentTail}` : "",
        "",
        usesSceneCards ? "## Chapter Guardrails (Trimmed)" : "## Trimmed Chapter Blueprint",
        trimmedBlueprint,
      ].filter(Boolean).join("\n"),
    })

    const cleanedSegment = generated
      .replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/g, "$1")
      .replace(/^#+\s+.*$/gmu, "")
      .replace(/^(片段|Segment)\s*\d+[\s\S]*?\n/iu, "")
      .trim()
    const segmentBody = cleanedSegment || generated.trim()
    const plotMaterial = await generateDraftSegmentPlotMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail,
    })
    const dialogueMaterial = await generateDraftSegmentDialogueMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail,
    })
    const narrationMaterial = await generateDraftSegmentNarrationMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail,
    })
    const characterActionMaterial = await generateDraftSegmentCharacterActionMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail,
    })
    const continuityMaterial = await generateDraftSegmentContinuityMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail,
    })
    const materialOverrides: Partial<Record<DraftSegmentSubArtifactInfo["kind"], string>> = {}
    const materialModes: Partial<Record<DraftSegmentSubArtifactInfo["kind"], "llm-subcall">> = {}
    if (plotMaterial) {
      materialOverrides.plot = plotMaterial
      materialModes.plot = "llm-subcall"
    }
    if (dialogueMaterial) {
      materialOverrides.dialogue = dialogueMaterial
      materialModes.dialogue = "llm-subcall"
    }
    if (narrationMaterial) {
      materialOverrides.narration = narrationMaterial
      materialModes.narration = "llm-subcall"
    }
    if (characterActionMaterial) {
      materialOverrides.character_action = characterActionMaterial
      materialModes.character_action = "llm-subcall"
    }
    if (continuityMaterial) {
      materialOverrides.continuity = continuityMaterial
      materialModes.continuity = "llm-subcall"
    }
    const assemblyMaterial = await generateDraftSegmentAssemblyMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail,
      materials: materialOverrides,
      fallbackBody: segmentBody,
    })
    if (assemblyMaterial) {
      materialOverrides.assembly = assemblyMaterial
      materialModes.assembly = "llm-subcall"
    }
    const cleanedAssemblySegment = cleanDraftAssemblyBody(assemblyMaterial || "")
    const usesAssemblySegment = isUsableDraftAssemblyBody(cleanedAssemblySegment, segmentBody)
    const finalSegmentBody = usesAssemblySegment
      ? cleanedAssemblySegment
      : segmentBody
    const assemblyUsage: DraftSegmentAssemblyUsage = assemblyMaterial
      ? {
          requested: true,
          decision: usesAssemblySegment ? "used" : "fallback_author",
          reason: usesAssemblySegment
            ? "assembly material passed fiction-body guard and replaced the author segment"
            : "assembly material was saved for audit but rejected by fiction-body guard",
          materialChars: cleanedAssemblySegment.length,
          finalChars: finalSegmentBody.length,
          fallbackChars: segmentBody.length,
        }
      : {
          requested: false,
          decision: "not_requested",
          reason: "assembly role was not enabled or returned no material",
          materialChars: 0,
          finalChars: finalSegmentBody.length,
          fallbackChars: segmentBody.length,
        }
    const hasMaterialOverrides = Object.keys(materialOverrides).length > 0
    const segmentArtifact = paths && projectRoot
      ? await writeDraftSegmentArtifact({
          projectRoot,
          paths,
          options,
          state,
          task,
          segment,
          content: finalSegmentBody,
          previousSegmentTail: priorSegmentTail,
          segmentationSource: usesSceneCards ? "scene_card" : "timeline",
          continuityContract,
          materialOverrides: hasMaterialOverrides ? materialOverrides : undefined,
          materialModes: hasMaterialOverrides ? materialModes : undefined,
          assemblyUsage,
        })
      : null
    if (segmentArtifact) {
      segmentArtifacts.push(segmentArtifact)
      await emitWritingProgress(options, {
        step: `draft_segment_artifact_saved_${segment.index}`,
        role: "Author",
        chapterNumber: task.chapterNumber,
        title: task.title,
        status: "completed",
        message: `第 ${task.chapterNumber} 章片段 ${segment.index}/${segment.total} 已保存为独立产物。`,
        artifactPath: segmentArtifact.relativePath,
        preview: [
          `source=${segmentArtifact.source}`,
          `chars=${segmentArtifact.chars}`,
          `briefs=${segmentArtifact.subArtifacts.filter((artifact) => artifact.role === "brief").length}`,
          `materials=${segmentArtifact.subArtifacts.filter((artifact) => artifact.role === "material").length}`,
          `path=${segmentArtifact.relativePath}`,
        ].join(" | "),
      })
    }
    generatedSegments.push(finalSegmentBody)
    previousSegmentTail = compactPreviousSegmentTail(generatedSegments.join("\n\n"))
  }

  const body = generatedSegments.join("\n\n")
  return [
    `# ${task.title}`,
    "",
    "## Draft Body",
    "",
    body,
    "",
    "## Drafting Metadata",
    `- Chapter: ${task.chapterNumber}`,
    `- Target words: ${task.targetWords}`,
    `- Segmented drafting: ${segmentPlan.length} LLM calls`,
    usesSceneCards ? "- Draft segmentation source: scene cards" : "- Draft segmentation source: timeline fallback",
    `- Segment artifacts: ${segmentArtifacts.map((artifact) => artifact.relativePath).join(", ") || "none"}`,
    `- Estimated production words: ${wordCount(body)}`,
  ].join("\n")
}

export async function repairAigcHighRiskDraft(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  finalDraft: string,
  aigcReport: AigcWritingDetectionReport,
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
  continuityContract: ContinuityContract,
  characterDossiers?: CharacterDossier[],
) {
  if (process.env.AI_NOVEL_TEST_MODE === "1" || aigcReport.status !== "blocked" || aigcReport.highRiskSegments.length === 0) {
    return finalDraft
  }
  throwIfPipelineAborted(options)

  const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0]

  console.log(`\n\n==================== [AIGC REWORK] 第 ${task.chapterNumber} 章 AIGC 风险片段修复 ====================`);
  console.log(`【章节标题】: ${task.title}`);
  console.log(`【AIGC 检测报告】:\n${formatAigcWritingDetectionReport(aigcReport)}`);
  console.log("【待修复的高风险片段数】:", aigcReport.highRiskSegments.length);
  console.log(`====================================================================================\n\n`);

  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: finalDraft,
  })

  // 并行进行高风险片段的局部重构
  const replacements: Array<{ startOffset: number; endOffset: number; repairedText: string }> = []

  await Promise.all(
    aigcReport.highRiskSegments.map(async (segment) => {
      throwIfPipelineAborted(options)

      // 提取高风险原文
      const originalText = bodyOnly.substring(segment.startOffset, segment.endOffset)
      if (!originalText.trim()) return

      console.log(`[AIGC PATCH SEND] 准备局部重构高风险片段 #${segment.index + 1}: 「${originalText.slice(0, 30)}...」`);

      const generated = await generateProductionTextWithLlm({
        roleName: "Prose Stylist",
        state,
        options,
        temperature: 0.6,
        progress: {
          step: `aigc_patch_repair_${segment.index}`,
          role: "Prose Stylist",
          chapterNumber: task.chapterNumber,
          title: task.title,
          startMessage: `Prose Stylist 正在局部修复第 ${task.chapterNumber} 章高风险片段 #${segment.index + 1}。`,
          completeMessage: `Prose Stylist 已返回高风险片段 #${segment.index + 1} 的修复文本。`,
        },
        basePrompt: [
          "你是 Prose Stylist，专精于中文小说的自然文风重构和去 AI 痕迹优化。",
          "你的任务是只对提供的一小段小说片段进行重写，使其文字质感如同人类作家手笔，彻底消除翻译腔、套话、总结腔和四平八稳的结构。",
          "必须保留原段落中发生的情节事实、人物动作细节、以及所包含的人物名字，不可凭空新增大段剧情。",
          "【重要约束】请仅输出重构后的这一段小说正文内容，严禁输出任何 Markdown 标题、解释词、前言后记、或者说明框！",
          resources.styleGuide || "",
          resources.antiHallucinationGuide || "",
        ].join("\n\n"),
        dynamicPrompt: [
          "打碎连续句子的均等长度，运用动作、感官、具体抉择来体现张力。",
          "严禁在这一小段中包含「不仅如此」、「与此同时」、「然而」、「事实上」、「不得不说」等 AI 痕迹严重的逻辑过渡词。",
          continuityContract.prompt,
          characterProfileContract.prompt.slice(0, 1000),
        ].join("\n\n"),
        message: `请重构并自然化以下段落，仅返回重构后的段落本身:\n\n${originalText}`,
      })

      // 对返回结果进行清洗，防止 LLM 多嘴输出格式杂质或 markdown 框
      let cleanText = generated.trim()
      cleanText = cleanText.replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/g, "$1").trim() // 移除 markdown 代码块包裹
      cleanText = cleanText.replace(/^(修改后|重构后|修复后|Repaired|Revised)(内容|段落)?[：:\n\s]+/iu, "").trim()
      cleanText = cleanText.replace(/^"(.*)"$/s, "$1").trim() // 移除前后引号包裹

      console.log(`[AIGC PATCH RECV] 高风险片段 #${segment.index + 1} 局部重构完毕: \n- 原文: 「${originalText.slice(0, 40)}...」\n- 修复: 「${cleanText.slice(0, 40)}...」`);

      replacements.push({
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
        repairedText: cleanText || originalText
      })
    })
  )

  throwIfPipelineAborted(options)

  // 按偏移量从大到小（从后往前）排序，确保前面的字符偏移不受后面替换的影响
  replacements.sort((a, b) => b.startOffset - a.startOffset)

  let patchedBody = bodyOnly
  for (const rep of replacements) {
    patchedBody = patchedBody.substring(0, rep.startOffset) + rep.repairedText + patchedBody.substring(rep.endOffset)
  }

  // 拼接回元数据
  const metaIndex = finalDraft.search(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)
  const finalDraftPatched = metaIndex !== -1
    ? patchedBody + finalDraft.substring(metaIndex)
    : patchedBody

  return finalDraftPatched
}

function sanitizeMarkdownCell(text: string): string {
  if (!text) return ""
  return text
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
}

export function createQualityReport(
	  state: AutonomousNovelState,
	  task: AutonomousNovelState["plan"]["chapterTasks"][number],
	  draft: string,
	  blueprint: string,
	  continuityContract = createContinuityContract({ state, task, blueprint }),
	  characterDossiers?: CharacterDossier[],
	) {
	  const count = wordCount(draft)
	  const target = task.targetWords
	  const minimumPassWords = Math.floor(target * 0.8)
	  const wordCountBlockingIssue = count < minimumPassWords
	  const plotContinuity = evaluatePlotContinuityBridge(draft, task, continuityContract)
	  const styleQuality = evaluateNarrativeStyleQuality(draft)
	  const resourceUsage = evaluateWritingResourceUsage(draft, state, task, blueprint, continuityContract)
	  const characterProfileContract = buildCharacterProfileContract({
	    state,
	    task,
	    characterDossiers,
	    continuityContract,
	    previousFinalDraft: draft,
	    blueprint,
	  })
	  const characterProfileQuality = evaluateCharacterProfilePresence(draft, characterProfileContract)
	  const wordScore = wordCountBlockingIssue ? 4 : 8
	  const hasHook = /钩子|问题|章末|最后|门|信|名字|表情/u.test(draft)
	  const hasConflict = /冲突|压力|选择|代价|反击|局势|刀|密信|伤口|怀疑|拦|问|追|藏|风险|少尹|兵曹|官|火|流民/u.test(draft)
	  const hasBlueprint = blueprint.includes("Event Sequence")
	  const hasCausalContract = hasCausalBlueprint(blueprint)
	  const causalExecution = evaluateCausalExecutionEvidence(draft, task, continuityContract)
	  const hasCausalExecution = hasCausalContract && causalExecution.status === "eligible"
	  const resourceUsageScore = resourceUsage.status === "eligible" ? 8 : resourceUsage.status === "warning" ? 6 : 4
	  const softStyleIssue = isSoftNarrativeStyleIssue(styleQuality)
	  const hardBlocked = wordCountBlockingIssue
	    || plotContinuity.status === "quarantined"
	    || (styleQuality.status === "quarantined" && !softStyleIssue)
	    || resourceUsage.status === "quarantined"
	    || characterProfileQuality.status === "quarantined"
	    || !hasCausalContract
	    || !hasCausalExecution
	  const score = hardBlocked
	    ? Math.min(5, wordScore)
	    : Math.min(10, Math.round((wordScore + (hasHook ? 8 : 5) + (hasConflict ? 8 : 5) + (hasBlueprint ? 8 : 5)) / 4))

  return [
    "# Chapter Quality Report",
    "",
    `Project: ${state.project.title}`,
    `Chapter: ${task.chapterNumber}`,
    `Title: ${task.title}`,
    "",
    "## Scores",
    "",
    "| Dimension | Score | Notes |",
    "|---|---:|---|",
    `| 字数完成度 | ${wordScore}/10 | 当前估算 ${count}，目标 ${target}。 |`,
	    `| 情节推进 | ${hasConflict ? 8 : 5}/10 | ${hasConflict ? "包含冲突、压力或选择。" : "冲突信号不足，需要返工。"} |`,
	    `| 章末钩子 | ${hasHook ? 8 : 5}/10 | ${hasHook ? "包含钩子或后续期待。" : "章末期待不足。"} |`,
	    `| 蓝图执行 | ${hasBlueprint ? 8 : 5}/10 | ${hasBlueprint ? "基于详细章节蓝图执行。" : "缺少详细蓝图依据。"} |`,
	    `| 因果合同执行 | ${hasCausalContract && hasCausalExecution ? 8 : 4}/10 | ${sanitizeMarkdownCell(hasCausalContract && hasCausalExecution ? causalExecution.reason : `缺少清晰因果合同或正文执行证据不足：${causalExecution.reason}`)} |`,
	    `| 写作资源吸收 | ${resourceUsageScore}/10 | ${sanitizeMarkdownCell(resourceUsage.reason)} |`,
	    `| 角色鲜明度 | ${characterProfileQuality.status === "eligible" ? 8 : 4}/10 | ${sanitizeMarkdownCell(characterProfileQuality.reason)} |`,
	    `| 综合评分 | ${score}/10 | ${score >= 7 ? "可进入润色。" : "需要返工。"} |`,
    "",
    `WORD_COUNT_CHECK: ${count}/${target}`,
    "",
    "## Checks",
	    "- Editor: 检查叙事推进、人物行动、爽点密度。",
	    "- Consistency Checker: 检查设定、时间线、伏笔和人物关系。",
	    "- Style Controller: 检查文风、成语密度、文言比例、对白差异。",
	    "- Prose Stylist: 去除模板感，增强具体场景和自然表达。",
	    `- Causal Contract: ${hasCausalContract && hasCausalExecution ? `通过：${causalExecution.reason}` : `失败：${causalExecution.reason}`}`,
	    `- Plot Continuity: ${plotContinuity.reason}`,
	    `- Style Hard Gate: ${styleQuality.reason}`,
	    `- Resource Usage Gate: ${resourceUsage.reason}`,
	    `- Character Profile Gate: ${characterProfileQuality.reason}`,
    "",
    "## Required Fixes",
    ...(score >= 7 && !hardBlocked
      ? ["- 暂无阻塞性问题；润色时继续压低 AI 模板句。"]
      : [
	        ...(wordCountBlockingIssue ? [`- 需要返工：正文有效字数 ${count}/${target}，低于 80% 门槛，不能进入 complete。`] : []),
	        ...(plotContinuity.status === "quarantined" ? [`- 需要返工：${plotContinuity.reason}`] : []),
	        ...(styleQuality.status === "quarantined" && !softStyleIssue ? [`- 需要返工：${styleQuality.reason}`] : []),
	        ...(softStyleIssue ? [`- 润色建议：${styleQuality.reason}`] : []),
	        ...(resourceUsage.status === "quarantined" ? [`- 需要返工：${resourceUsage.reason}`] : []),
	        ...(characterProfileQuality.status === "quarantined" ? [`- 需要返工：${characterProfileQuality.reason}`] : []),
	        ...(!hasCausalContract ? ["- 需要返工：蓝图缺少 Causal Objective / Irreversible Change / Next Chapter Handoff，不能支撑连续写作。"] : []),
	        ...(!hasCausalExecution ? [`- 需要返工：${causalExecution.reason}`] : []),
	        ...(count < target ? ["- 扩写正文场景。"] : []),
	        ...(!hasConflict ? ["- 增强冲突动作。"] : []),
	        ...(!hasHook ? ["- 补足章末钩子。"] : []),
      ]),
  ].join("\n")
}

function appendQualityHardChecks(
  report: string,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  draft: string,
  continuityContract?: ContinuityContract,
  state?: AutonomousNovelState,
  characterDossiers?: CharacterDossier[],
) {
  const count = wordCount(draft)
  const target = task.targetWords
  const continuityFixes = continuityContract
    ? continuityContract.requiredNames
      .filter((name) => !draft.includes(name))
      .map((name) => `- 需要返工：Canon 连续性失败，正文未出现必需人物「${name}」，不能进入 complete。`)
    : []
  const plotContinuity = continuityContract
    ? evaluatePlotContinuityBridge(draft, task, continuityContract)
    : null
	  const styleQuality = evaluateNarrativeStyleQuality(draft)
	  const characterProfileContract = continuityContract && state
	    ? buildCharacterProfileContract({
	      state,
	      task,
	      characterDossiers,
	      continuityContract,
	      previousFinalDraft: draft,
	    })
	    : null
	  const characterProfileQuality = characterProfileContract
	    ? evaluateCharacterProfilePresence(draft, characterProfileContract)
	    : null
	  const softStyleIssue = isSoftNarrativeStyleIssue(styleQuality)
	  const narrativeFixes = [
	    ...(plotContinuity?.status === "quarantined" ? [`- 需要返工：${plotContinuity.reason}`] : []),
	    ...(styleQuality.status === "quarantined" && !softStyleIssue ? [`- 需要返工：${styleQuality.reason}`] : []),
	    ...(softStyleIssue ? [`- 润色建议：${styleQuality.reason}`] : []),
	    ...(characterProfileQuality?.status === "quarantined" ? [`- 需要返工：${characterProfileQuality.reason}`] : []),
	  ]
  const resourceUsage = continuityContract
    ? evaluateWritingResourceUsage(draft, undefined, task, "", continuityContract)
    : evaluateWritingResourceUsage(draft)
  const resourceFixes = resourceUsage.status === "quarantined"
    ? [`- 需要返工：${resourceUsage.reason}`]
    : []
  if (report.includes("WORD_COUNT_CHECK:") && continuityFixes.length === 0 && narrativeFixes.length === 0 && resourceFixes.length === 0) {
    return report
  }
  const minimumPassWords = Math.floor(target * 0.8)
  const hardFixes = count < minimumPassWords
    ? [
      "",
      "## Deterministic Hard Gate",
      `WORD_COUNT_CHECK: ${count}/${target}`,
      `- 需要返工：正文有效字数 ${count}/${target}，低于 80% 门槛，不能进入 complete。`,
      ...continuityFixes,
      ...narrativeFixes,
      ...resourceFixes,
    ]
    : [
      "",
      "## Deterministic Hard Gate",
      `WORD_COUNT_CHECK: ${count}/${target}`,
      "- 字数硬门槛通过。",
      ...continuityFixes,
      ...narrativeFixes,
      ...resourceFixes,
    ]
  return [report.trimEnd(), ...hardFixes].join("\n")
}

function extractQualityRepairChecklist(report: string) {
  const lines = report.split("\n")
  const fixes: string[] = []
  let inRequiredFixes = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^##\s+Required Fixes/u.test(trimmed)) {
      inRequiredFixes = true
      continue
    }
    if (inRequiredFixes && /^##\s+/u.test(trimmed)) {
      inRequiredFixes = false
    }
    if (inRequiredFixes && /^-\s+/u.test(trimmed)) {
      fixes.push(trimmed)
    }
  }

  const scoreFixes = lines
    .filter((line) => /^\|\s*(情节推进|因果合同执行|写作资源吸收|角色鲜明度)\s*\|/u.test(line))
    .filter((line) => /[1-6]\/10/u.test(line))
    .map((line) => `- 低分项：${line.replace(/^\|\s*|\s*\|$/g, "").replace(/\s*\|\s*/g, " - ")}`)

  return uniqueStrings([...fixes, ...scoreFixes]).slice(0, 10)
}

async function createProductionQualityReport(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  draft: string,
  blueprint: string,
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
  continuityContract = createContinuityContract({ state, task, blueprint }),
  characterDossiers?: CharacterDossier[],
  approvedStyleContext: ApprovedWritingStyleContext = { status: "missing", prompt: "" },
) {
  throwIfPipelineAborted(options)
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft,
    blueprint,
  })
  const fallback = createQualityReport(state, task, draft, blueprint, continuityContract, characterDossiers)
  if (process.env.AI_NOVEL_TEST_MODE === "1" || !shouldUseLlmQualityPass(options)) {
    return fallback
  }
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext)

  const generated = await generateProductionTextWithLlm({
    roleName: "Editor",
    state,
    options,
    temperature: 0.2,
    progress: {
      step: "quality_review",
      role: "Editor",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `Editor 正在审阅第 ${task.chapterNumber} 章初稿，检查情节、设定、文风和字数门禁。`,
      completeMessage: `Editor 已返回第 ${task.chapterNumber} 章质检报告。`,
    },
    basePrompt: [
      resources.editorGuide || "你是文学质量把控师。",
      resources.consistencyGuide || "",
      resources.styleControllerGuide || "",
    ].join("\n\n"),
    dynamicPrompt: [
	      "检查维度：叙事质量、人物一致性、设定一致性、文风统一、爽点密度、成语使用、AI 味。",
	      "必须输出评分表、严重问题、一般问题、记忆更新提醒。",
	      "如果质量不足，明确指出需要返工的位置。",
	      "因果合同是硬门槛：正文必须执行 Previous Inputs、Causal Objective、Protagonist Decision、Irreversible Change、Next Chapter Handoff。",
	      continuityContract.lockedProtagonistName
	        ? `主角姓名、身份或故事线漂移是严重问题；如果正文不是围绕「${continuityContract.lockedProtagonistName}」推进，必须判为不通过。`
	        : "首章如果没有建立唯一主角姓名，必须判为不通过。",
		      "配角身份/关系漂移、前序情节断裂、伏笔丢失或世界规则变化，都必须判为不通过。",
		      "第 2 章以后如果只复用主角姓名，却没有承接上一章物件、关系、线索、代价或未解决问题，必须判为不通过。",
		      "如果章节只是按时间罗列事件，没有让上一章输入导致本章选择、代价和下一章交棒，必须判为不通过。",
	      "如果正文像蓝图、计划、修改说明或模板段落，而不是小说正文，必须判为不通过。",
	      approvedStyleCarryover
	        ? "如果正文明显违背用户确认写法合同中的声音、节奏、对白规则、描写规则或禁用模式，必须要求返工。"
	        : "",
	      "如果看不出写作资源、词汇/成语策略和场景资源的自然吸收，必须要求返工。",
	      "如果出现单字/短词频繁独立成句或成行、推荐词孤立堆砌、氛围词连发，必须判为不通过。",
	    ].join("\n"),
    message: [
      "请审核以下章节草稿，并生成 `# Chapter Quality Report`。",
      "",
      "## Blueprint",
      blueprint,
      "",
      continuityContract.prompt,
      "",
      approvedStyleCarryover,
      "",
      characterProfileContract.prompt,
      "",
      "## Draft",
      draft,
    ].join("\n"),
  })

  const report = generated.includes("Chapter Quality Report")
    ? generated
    : `${fallback}\n\n---\n\n## LLM Editor Notes\n${generated}`
  return appendQualityHardChecks(report, task, draft, continuityContract, state, characterDossiers)
}

async function reviseDraftForQualityGate(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  draft: string,
  report: string,
  blueprint: string,
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
  attempt: number,
  continuityContract = createContinuityContract({ state, task, blueprint }),
  paths?: NovelWorkspacePaths,
  projectRoot?: string,
  characterDossiers?: CharacterDossier[],
  approvedStyleContext: ApprovedWritingStyleContext = { status: "missing", prompt: "" },
) {
  throwIfPipelineAborted(options)

  console.log(`\n\n==================== [QUALITY REWORK] 第 ${task.chapterNumber} 章第 ${attempt} 轮返工 ====================`);
  console.log(`【章节标题】: ${task.title}`);
  console.log(`【质检报告 (Quality Report)】:\n${report}`);
  console.log(`=================================================================================\n\n`);
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return [
      draft,
      "",
      "---",
      "",
      `## Revision Attempt ${attempt}`,
      "- 已根据质量门禁补强冲突、章末钩子、场景细节和角色主动选择。",
      "- 本轮返工保持章节目标不变，并继续交给质量门禁复查。",
    ].join("\n")
  }

  // 限制全局写作指南大小，只保留前 2000 字符核心规范，防止上下文过度膨胀
  const cappedWriterGuide = (resources.writerGuide || "").slice(0, 2000)
  const cappedAntiHallucination = (resources.antiHallucinationGuide || "").slice(0, 1500)
  const cappedConflictStrategy = (resources.evidenceConflictStrategy || "").slice(0, 1500)
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext)

  const basePromptLines = [
    cappedWriterGuide || "你是小说正文创作执行者。",
    "你正在执行质量门禁返工。必须保留章节目标，不得跳章，不得改变已冻结设定。",
    "顺应并修复章节因果合同：上一章输入要推动本章选择，本章选择要产生不可逆代价，并自然交给下一章。",
    continuityContract.lockedProtagonistName
      ? `必须把主角一致性修回「${continuityContract.lockedProtagonistName}」，不得继续使用漂移主角。`
      : "必须在首章建立唯一主角姓名。",
    "必须修复配角关系、前序情节承接、伏笔状态、资源使用、情节推进和正文比例问题。",
    "必须修复章节断裂：上一章锚点要进入本章事件因果，不得只换场景重开。",
    "必须修复流水账问题：不要只按时间罗列，所有场景都要因选择、代价、信息变化或关系变化而发生。",
    "必须修复 AI 化碎片：把孤立短词改成完整动作、感官、对话或因果句。",
    approvedStyleCarryover
      ? "必须同时修复与用户确认写法合同不一致的声音、句式、对白、描写和禁用模式问题。"
      : "",
  ]

  if (cappedAntiHallucination) {
    basePromptLines.push(`【反幻觉与细节留白约束】\n${cappedAntiHallucination}`)
  }
  if (cappedConflictStrategy) {
    basePromptLines.push(`【多源事实冲突处理策略】\n${cappedConflictStrategy}`)
  }
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft,
    blueprint,
  })
  const repairChecklist = extractQualityRepairChecklist(report)

  const fixedDynamicPromptLines = [
    `章节：第 ${task.chapterNumber} 章`,
    `标题：${task.title}`,
    `返工轮次：${attempt}`,
    "必须针对质量报告中的问题重写/扩写正文。",
    "必须输出 Markdown，保留 `## Draft Body`。",
    "",
    `[Correction Observation (纠偏观察)]\n上一轮写作存在以下缺陷：\n${repairChecklist.join("\n") || report.slice(0, 1200)}\n请在本次重写中特别注意并修复这些问题。`,
    "",
    approvedStyleCarryover,
    "",
    continuityContract.prompt,
    "",
    characterProfileContract.prompt.slice(0, 1000),
  ]

  const basePromptText = basePromptLines.join("\n\n")
  const fixedDynamicPromptText = fixedDynamicPromptLines.join("\n")
  const additionalFixedLength = basePromptText.length + fixedDynamicPromptText.length + 1000

  const prunedContext = await loadAndPruneGlobalContext({
    state,
    task,
    blueprint,
    resources,
    options,
    continuityContract,
    paths,
    projectRoot,
    additionalFixedLength,
  })

  const currentTemp = Math.min(0.8, 0.5 + (attempt - 1) * 0.1)

  const generated = await generateProductionTextWithLlm({
    roleName: "Author",
    state,
    options,
    temperature: currentTemp,
    progress: {
      step: `revision_${attempt}`,
      role: "Author",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `Author 正在根据质检报告返工第 ${task.chapterNumber} 章，第 ${attempt} 轮。`,
      completeMessage: `Author 已返回第 ${task.chapterNumber} 章第 ${attempt} 轮返工稿。`,
    },
    basePrompt: basePromptText,
    dynamicPrompt: [
      `章节：第 ${task.chapterNumber} 章`,
      `标题：${task.title}`,
      `返工轮次：${attempt}`,
      "必须针对质量报告中的问题重写/扩写正文。",
      "必须把低分项转化为可见正文证据：上一章锚点进入开场事件；主角做一个会改变局势的动作选择；选择带来身份/关系/线索/资源后果；结尾把这个后果交给下一章。",
      "如果角色鲜明度低，只补强本章承担冲突、选择或关系变化的核心人物；不要硬塞口癖和标志动作，而是让人物通过目标、立场、选择代价、对主角关系的反应产生差异。",
      "如果写作资源吸收低，把短词/成语改成动作、感官、物件和因果句，不要写孤立成语或四字短句。",
      "必须输出 Markdown，保留 `## Draft Body`。",
      "",
      `[Correction Observation (纠偏观察)]\n上一轮写作存在以下缺陷：\n${repairChecklist.join("\n") || report.slice(0, 1200)}\n请在本次重写中特别注意并修复这些问题。`,
      attempt >= 2 ? `\n【WARNING: 连续返工硬警告】这已经是第 ${attempt} 轮重写！前几轮的重写由于改动太小或未彻底纠偏已被打回。本次重写你必须进行大范围、颠覆性的文字重组和句式变换（例如多使用具体动作和环境触感来替换单薄的解释句），严禁直接复用或微调上一轮被拒的内容！\n` : "",
      "",
      prunedContext.prunedConsensus ? `Consensus & Setting Freeze:\n${prunedContext.prunedConsensus}` : "",
      "",
      prunedContext.prunedOutline ? `Master Outline:\n${prunedContext.prunedOutline}` : "",
      "",
      prunedContext.prunedMemory ? `Character Memory:\n${prunedContext.prunedMemory}` : "",
      "",
      prunedContext.prunedLedger ? `Previous Chapter Ledger:\n${prunedContext.prunedLedger}` : "",
      "",
      prunedContext.previousDraftFragment ? `Previous Chapter Draft Fragment (末尾承接段):\n${prunedContext.previousDraftFragment}` : "",
      "",
      approvedStyleCarryover,
      "",
      continuityContract.prompt,
    ].join("\n"),
    message: [
      "请根据质量报告返工以下章节草稿。",
      "",
      "## Blueprint",
      trimBlueprintForDrafting(blueprint),
      "",
      "## Quality Report",
      repairChecklist.length ? repairChecklist.join("\n") : report,
      "",
      "## Draft",
      draft,
    ].join("\n"),
  })

  return generated.includes("## Draft Body")
    ? generated
    : [`# ${task.title}`, "", "## Draft Body", "", generated, "", `## Revision Attempt ${attempt}`].join("\n")
}

async function runQualityGateWithRevisions(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  initialDraft: string,
  blueprint: string,
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
  continuityContract = createContinuityContract({ state, task, blueprint }),
  paths?: NovelWorkspacePaths,
  projectRoot?: string,
  characterDossiers?: CharacterDossier[],
  approvedStyleContext: ApprovedWritingStyleContext = { status: "missing", prompt: "" },
) {
  const maxAttempts = options.maxRevisionAttempts !== undefined ? options.maxRevisionAttempts : 3
  let draft = initialDraft
  let report = ""
  let gate: QualityGateResult = {
    passed: false,
    score: 0,
    status: "needs_revision",
    attempts: 0,
    reason: "质量门禁尚未执行。",
  }

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    throwIfPipelineAborted(options)
    report = await createProductionQualityReport(state, task, draft, blueprint, resources, options, continuityContract, characterDossiers, approvedStyleContext)
    if (process.env.AI_NOVEL_TEST_MODE === "1" && typeof options.forceQualityScoreForTest === "number") {
      report = report.replace(/综合评分 \| \d+\/10/u, `综合评分 | ${options.forceQualityScoreForTest}/10`)
      if (options.forceQualityScoreForTest < 7 && !report.includes("需要返工")) {
        report = `${report}\n- 需要返工：测试强制质量分低于阈值。`
      }
    }
    gate = parseQualityGate(report, attempt, maxAttempts)

    if (gate.passed || attempt >= maxAttempts) {
      return { draft, report, gate }
    }

    draft = await reviseDraftForQualityGate(
      state,
      task,
      draft,
      report,
      blueprint,
      resources,
      options,
      attempt + 1,
      continuityContract,
      paths,
      projectRoot,
      characterDossiers,
      approvedStyleContext
    )
  }

  return { draft, report, gate }
}

function createPolishedDraft(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  draft: string,
  report: string,
  gate: QualityGateResult = parseQualityGate(report),
  mode: ProductionWritingMode = "fast",
  naturalnessReport?: NaturalnessReport,
) {
  const genre = inferGenreProfile(state)
  return [
    draft.replace("## Draft Body", "## Final Body"),
    "",
    "---",
    "",
    "## Naturalness Pass",
    `- Production writing mode: ${mode}.`,
    `- Naturalness target: ${genre.naturalnessTarget}.`,
    mode === "quality"
      ? "- 已执行 Editor / Consistency Checker / Style Controller / NaturalnessAgent 质量链路。"
      : "- 已执行快速生产硬门禁：字数、主角、角色档案、连续性、因果合同、资源吸收和自然度规则。",
    "- NaturalnessAgent 目标：减少解释性模板句，增强动作、感官、对白、角色习惯、关系压力和具体选择。",
    "- 去 AI 味策略：避免连续抽象总结、分析腔、情绪标签堆叠和整齐排比，保留有体感的细节和角色差异。",
    "- Polish Pass compatibility: this Naturalness Pass replaces the legacy polish stage while preserving its artifact marker.",
    "",
    naturalnessReport ? formatNaturalnessReport(naturalnessReport) : "- Naturalness report: deterministic fallback not attached.",
    "",
    "## Quality Gate",
    `- Status: ${gate.status}`,
    `- Score: ${gate.score}/10`,
    `- Attempts: ${gate.attempts}`,
    `- Reason: ${gate.reason}`,
    `- Project: ${state.project.title}`,
    `- Chapter: ${task.chapterNumber}`,
  ].join("\n")
}

function resolveAigcDetectorRootDir(options: ProductionPipelineOptions) {
  return options.envRootDir || options.factoryRootDir || process.cwd()
}

function isAigcDetectorConfigured(options: ProductionPipelineOptions) {
  const config = getAigcDetectorConfig(resolveAigcDetectorRootDir(options))
  if (config.provider === "local-heuristic") return true
  return config.provider !== "disabled" && Boolean(config.url?.trim())
}

export function normalizeAigcWritingDetectionReport(result: AigcBatchDetectionResult): AigcWritingDetectionReport {
  const threshold = result.threshold
  const maxSegmentScore = result.segments.reduce<number | null>((max, segment) => {
    if (typeof segment.score !== "number") {
      return max
    }
    return max === null ? segment.score : Math.max(max, segment.score)
  }, null)
  const status = !result.ok
    ? "unavailable"
    : result.highRiskSegments.length > 0 || (typeof result.score === "number" && result.score >= threshold)
      ? "blocked"
      : "passed"

  return {
    enabled: true,
    status,
    provider: result.provider,
    threshold,
    score: result.score,
    maxSegmentScore,
    totalSegments: result.totalSegments,
    highRiskSegments: result.highRiskSegments.slice(0, 8).map((segment) => ({
      id: segment.segment.id,
      index: segment.segment.index,
      startOffset: segment.segment.startOffset,
      endOffset: segment.segment.endOffset,
      score: segment.score,
      label: segment.label,
      preview: segment.segment.text.replace(/\s+/gu, " ").slice(0, 160),
    })),
    reason: result.reason,
  }
}

export function skippedAigcWritingDetectionReport(reason: string): AigcWritingDetectionReport {
  return {
    enabled: false,
    status: "skipped",
    provider: "disabled",
    threshold: 0.8,
    score: null,
    maxSegmentScore: null,
    totalSegments: 0,
    highRiskSegments: [],
    reason,
  }
}

export async function runAigcWritingDetection(finalDraft: string, options: ProductionPipelineOptions): Promise<AigcWritingDetectionReport> {
  const config = getAigcDetectorConfig(resolveAigcDetectorRootDir(options))
  if (!isAigcDetectorConfigured(options)) {
    return skippedAigcWritingDetectionReport("AIGC detector is not configured.")
  }
  try {
    const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0]
    const result = await detectAigcSegments(bodyOnly || finalDraft, config)
    return normalizeAigcWritingDetectionReport(result)
  } catch (error) {
    return {
      ...skippedAigcWritingDetectionReport(error instanceof Error ? error.message : String(error)),
      enabled: true,
      status: "unavailable",
      provider: config.provider || "disabled",
      threshold: config.threshold || 0.8,
    }
  } finally {
    throwIfPipelineAborted(options)
  }
}

function formatAigcWritingDetectionReport(report: AigcWritingDetectionReport) {
  return [
    "## AIGC Detection",
    `- Enabled: ${report.enabled ? "yes" : "no"}`,
    `- Status: ${report.status}`,
    `- Provider: ${report.provider}`,
    `- Threshold: ${report.threshold}`,
    `- Average AI probability: ${typeof report.score === "number" ? report.score.toFixed(4) : "n/a"}`,
    `- Max segment AI probability: ${typeof report.maxSegmentScore === "number" ? report.maxSegmentScore.toFixed(4) : "n/a"}`,
    `- Total segments: ${report.totalSegments}`,
    `- High risk segments: ${report.highRiskSegments.length}`,
    `- Reason: ${report.reason}`,
    ...(
      report.highRiskSegments.length
        ? [
            "",
            "### High Risk Segment Previews",
            ...report.highRiskSegments.map((segment) =>
              `- #${segment.index + 1} [${segment.startOffset}-${segment.endOffset}] score=${typeof segment.score === "number" ? segment.score.toFixed(4) : "n/a"} label=${segment.label}: ${segment.preview}`
            ),
          ]
        : []
    ),
  ].join("\n")
}


async function createProductionPolishedDraft(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  draft: string,
  report: string,
  gate: QualityGateResult,
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
  continuityContract = createContinuityContract({ state, task }),
  characterDossiers?: CharacterDossier[],
  approvedStyleContext: ApprovedWritingStyleContext = { status: "missing", prompt: "" },
) {
  throwIfPipelineAborted(options)
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft,
  })
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext)
  const fallbackNaturalnessReport = createNaturalnessReport({
    beforeDraft: draft,
    afterDraft: draft,
    state,
    task,
    continuityContract,
    characterProfileContract,
  })
  const fallback = createPolishedDraft(state, task, draft, report, gate, productionWritingMode(options), fallbackNaturalnessReport)
  if (process.env.AI_NOVEL_TEST_MODE === "1" || !shouldUseLlmPolishPass(options, gate)) {
    return fallback
  }

  const generated = await generateProductionTextWithLlm({
    roleName: "Prose Stylist",
    state,
    options,
    temperature: 0.6,
    progress: {
      step: "naturalness_generation",
      role: "Prose Stylist",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `NaturalnessAgent 正在处理第 ${task.chapterNumber} 章，执行自然化、角色声音和语义保持检查。`,
      completeMessage: `NaturalnessAgent 已返回第 ${task.chapterNumber} 章自然化终稿。`,
    },
    basePrompt: [
      "你是 NaturalnessAgent，是生产流水线中的正式自然化 Agent，不是临时润色器。",
      "你的职责是让文本更像自然小说，而不是改写剧情。优先做局部 patch 式改写，保留事实、人物、关系、物件、伏笔和章末后果。",
      resources.styleGuide || "",
      resources.styleControllerGuide || "",
      resources.consistencyGuide || "",
      resources.antiHallucinationGuide || "",
    ].join("\n\n"),
    dynamicPrompt: [
      "只允许在不改变核心剧情、不改变设定、不跳章的前提下润色。",
      "必须保留章节正文结构，增强动作、感官、对白差异和具体细节。",
      approvedStyleCarryover
        ? "必须保持用户确认写法合同，不得把已确认的文风润色成通用模板腔。"
        : "",
	      "控制成语密度，避免堆砌和模板化情绪解释。",
	      "必须消除单字/短词独立成行的 AI 化碎片感；推荐词只能自然嵌入句子。",
	      "必须移除任何 AI 痕迹、逻辑连词（严禁出现'不仅如此'、'与此同时'、'然而'、'事实上'）、报告腔、总结腔、过度解释、整齐排比、情绪标签堆叠和万能升华结尾。彻底贯彻“摄像机限知呈现（Show, don't tell）”：禁止旁白对剧情的严重性、反转、阴谋等进行跨视角的脑补与主观解释（如严禁出现“被抓住是通敌斩首的重罪”、“自己是不是被卖了”等剧透句），所有因果完全留白让读者意会；只拍摄物理画面、物件、台词和生理反应。",
	      "必须消除所有动作描写中的“双字叠词副词+地”（如禁用“慢吞吞地”、“死死地”、“神秘兮兮地”、“默默地”、“悄悄地”），强制改用纯动词或肢体物理形态；必须打碎连续句子的平均长度，增加长短句的错落突发性（Burstiness），使行文符合人类作家的天然质感。",
	      continuityContract.lockedProtagonistName
        ? `不得在润色中更改主角姓名、身份或章节核心事件；锁定主角是「${continuityContract.lockedProtagonistName}」。`
        : "首章润色不得移除唯一主角姓名。",
	      "不得更改配角身份、关系、伏笔状态或前序情节承接。",
	      continuityContract.continuityAnchors.length
	        ? `润色后仍必须保留并自然使用上一章连续性锚点：${continuityContract.continuityAnchors.slice(0, 8).join("、")}。`
	        : "润色后必须保留本章建立的可追踪物件、关系、线索或代价。",
      "",
      continuityContract.prompt,
      "",
      approvedStyleCarryover,
      "",
      characterProfileContract.prompt,
    ].join("\n"),
    message: [
      "请根据质量报告自然化以下章节，输出最终稿。",
      "输出 Markdown，必须包含 `## Final Body` 与 `## Naturalness Pass`。",
      "不要新增事实，不要改变人物身份，不要改变关系结论，不要跳章。",
      "",
      "## Quality Report",
      report,
      "",
      continuityContract.prompt,
      "",
      approvedStyleCarryover,
      "",
      characterProfileContract.prompt,
      "",
      "## Draft",
      draft,
    ].join("\n"),
  })

  const normalized = generated.includes("## Final Body")
    ? generated
    : `${generated}\n\n---\n\n## Naturalness Pass\n- 已按质量报告进行自然化和去 AI 味。`
  const naturalnessReport = createNaturalnessReport({
    beforeDraft: draft,
    afterDraft: normalized,
    state,
    task,
    continuityContract,
    characterProfileContract,
  })
  return normalized.includes("## Naturalness Report")
    ? normalized
    : `${normalized.trimEnd()}\n\n${formatNaturalnessReport(naturalnessReport)}`
}

function createChapterMemoryUpdate(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  finalDraft: string,
  continuityContract = createContinuityContract({ state, task }),
  characterDossiers?: CharacterDossier[],
) {
  const nextAnchors = extractContinuityAnchors({
    text: finalDraft,
    lockedProtagonistName: continuityContract.lockedProtagonistName,
    limit: 10,
  })
  const causalPlan = getTaskCausalPlan(state, task)
  const plotContinuity = evaluatePlotContinuityBridge(finalDraft, task, continuityContract)
  const styleQuality = evaluateNarrativeStyleQuality(finalDraft)
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: finalDraft,
  })
  const characterProfileQuality = evaluateCharacterProfilePresence(finalDraft, characterProfileContract)
  const naturalnessReport = createNaturalnessReport({
    beforeDraft: finalDraft,
    afterDraft: finalDraft,
    state,
    task,
    continuityContract,
    characterProfileContract,
  })
  const foreshadowingLedgerUpdate = createForeshadowingHealthLedger({
    causalPlan,
    nextAnchors,
    plotContinuity,
  })
  return [
    `# Chapter ${task.chapterNumber} Memory Update`,
    "",
    `Project: ${state.project.title}`,
    `Chapter title: ${task.title}`,
    "",
    "## Summary",
    `- 本章围绕「${task.summary}」完成一次剧情推进，并保留后续钩子。`,
    `- Plot bridge: ${plotContinuity.reason}`,
    `- Previous input: ${causalPlan.previousInput}`,
    `- Causal objective: ${causalPlan.sceneObjective}`,
    `- Irreversible change: ${causalPlan.irreversibleConsequence}`,
    `- Next handoff: ${causalPlan.nextHandoff}`,
    "",
    "## Character Changes",
    continuityContract.lockedProtagonistName
      ? `- Locked protagonist: ${continuityContract.lockedProtagonistName}`
      : "- Locked protagonist: pending first-chapter extraction",
    continuityContract.knownCast.length
      ? `- Known cast this run: ${continuityContract.knownCast.slice(0, 12).join("、")}`
      : "- Known cast this run: none recorded yet",
    "- 主角通过一个主动选择暴露当前阶段的欲望、弱点或能力边界。",
    `- Character state delta required by blueprint: ${causalPlan.characterStateDelta}`,
    "- 新增或变化的配角必须在下一轮 Canon Contract 中继续追踪，不能无解释消失。",
    "",
    "## Character Profile Projection",
    `- Gate: ${characterProfileQuality.reason}`,
    `- Missing profile signals: ${characterProfileContract.missingSignals.length ? characterProfileContract.missingSignals.join("、") : "none"}`,
    "- Required fields for each important character: identity, desire, fear/wound, habit, speech style, appearance/body marker, skill/limit, relationship state, chapter delta.",
    "- Next chapter must preserve these profile signals and add missing fields through action/dialogue rather than exposition.",
    "",
    "## Structured Character Dossier Carryover",
    characterProfileContract.dossierBrief || "- no structured dossier carryover available",
    "",
    "## Foreshadowing",
    ...(nextAnchors.length
      ? nextAnchors.slice(0, 8).map((anchor) => `- Continuity anchor: ${anchor}`)
      : ["- Continuity anchor: 本章未抽取到明确锚点，下一轮必须人工/模型补足物品、线索、关系或代价。"]),
    "- 下一章必须承接上述 Continuity anchor 中至少两个，让它们进入正文事件因果。",
    ...foreshadowingLedgerUpdate,
    "",
    "## Style Notes",
    `- ${styleQuality.reason}`,
    "- 保持类型旁白策略，避免模板化情绪解释、短词碎片堆砌和孤立成语展示。",
    "",
    "## Naturalness Notes",
    `- ${naturalnessReport.reason}`,
    ...(naturalnessReport.riskFlags.length ? naturalnessReport.riskFlags.slice(0, 6).map((flag) => `- Risk: ${flag}`) : ["- Risk: none"]),
    "",
    "## Draft Excerpt",
    finalDraft.split("\n").filter(Boolean).slice(0, 8).join("\n"),
  ].join("\n")
}

function createForeshadowingHealthLedger(input: {
  causalPlan: ReturnType<typeof getTaskCausalPlan>
  nextAnchors: string[]
  plotContinuity: ReturnType<typeof evaluatePlotContinuityBridge>
}) {
  const anchorLines = input.nextAnchors.length
    ? input.nextAnchors.slice(0, 6).map((anchor) => `- Anchor advanced: ${anchor}`)
    : ["- Anchor advanced: none extracted; 下一章必须先补足可追踪物品、线索、关系或代价。"]
  const status = input.nextAnchors.length >= 2 && input.plotContinuity.status === "eligible"
    ? "active"
    : "needs_manual_followup"
  const risk = status === "active"
    ? "low; 已形成可承接锚点。"
    : "high; 伏笔可能悬空，下一章蓝图必须显式处理。"

  return [
    "### Foreshadowing Ledger Update",
    `- Operation: ${input.causalPlan.foreshadowingOperation}`,
    `- Status: ${status}`,
    ...anchorLines,
    `- Expected payoff / next touchpoint: ${input.causalPlan.nextHandoff}`,
    "- Carryover rule: 下一章必须让至少两个锚点进入可见事件，并通过行动、代价或关系变化兑现，不能只口头解释。",
    `- Risk: ${risk}`,
  ]
}

async function recordPipelineArtifact(
  projectRoot: string,
  absolutePath: string,
  kind: "chapter" | "plan" | "memory" | "style" | "checkpoint",
  options: ProductionPipelineOptions,
  metadata: Record<string, unknown> = {},
) {
  if (!options.factoryRootDir || !options.projectId) {
    return
  }
  await withFactoryDb(options.factoryRootDir, async (db) => {
    const artifactPath = relativeArtifactPath(projectRoot, absolutePath)
    const messageId = artifactMessageId(options.projectId as string, artifactPath)
    db.recordArtifact({
      projectId: options.projectId as string,
      kind,
      path: artifactPath,
      status: "completed",
      metadata,
    })
    db.createJob({
      projectId: options.projectId as string,
      kind: "knowledge_project_artifact",
      status: "idle",
      payload: {
        projectId: options.projectId as string,
        artifactPath,
        kind,
        metadata,
        reason: "artifact_recorded",
      },
    })
    const message = createArtifactMessage({
      messageId,
      conversationId: `artifacts:${options.projectId}`,
      projectId: options.projectId as string,
      runId: options.directorCommandId ?? null,
      artifactPath,
      label: artifactMessageLabel(kind, artifactPath, metadata),
      content: artifactMessageContent(kind, artifactPath, metadata),
      metadata: {
        source: "production_artifact",
        kind,
        path: artifactPath,
        ...metadata,
        directorCommandId: options.directorCommandId ?? null,
      },
    })
    db.recordMessage(message, [
      messagePart(messageId, 0, "markdown", { text: message.data.content }, message.createdAt),
      messagePart(messageId, 1, "artifact", {
        path: artifactPath,
        label: message.data.label,
        kind,
        status: message.status,
      }, message.createdAt),
      messagePart(messageId, 2, "json", {
        kind,
        path: artifactPath,
        metadata,
      }, message.createdAt),
    ])
  }).catch(() => undefined)
}

export async function writeProductionMasterOutline(
  projectRoot: string,
  paths: NovelWorkspacePaths,
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
  options: ProductionPipelineOptions = {},
) {
  const { resources } = await writeProductionWritingResourceArtifacts(projectRoot, paths, state, options)
  const content = await createMasterOutlineContent(state, context, resources, options)
  await fs.mkdir(paths.plansDir, { recursive: true })
  await fs.writeFile(paths.masterOutlinePath, `${content}\n`)
  await recordPipelineArtifact(projectRoot, paths.masterOutlinePath, "plan", options, {
    stage: "master_planning",
    production: true,
  })
  await emitWritingProgress(options, {
    step: "master_outline_saved",
    role: "Showrunner",
    status: "completed",
    message: "全书主线规划已保存为正式产物。",
    artifactPath: relativeArtifactPath(projectRoot, paths.masterOutlinePath),
    preview: content.slice(0, 420),
    wordCount: wordCount(content),
  })
  return content
}

export async function writeProductionStoryBibleAssets(
  projectRoot: string,
  paths: NovelWorkspacePaths,
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
  options: ProductionPipelineOptions = {},
) {
  const resources = await loadProductionWritingResources(projectRoot)
  const assets = createProductionStoryBibleAssets(state, context, resources)
  await fs.mkdir(paths.plansDir, { recursive: true })

  const written: string[] = []
  for (const asset of assets) {
    const assetPath = path.join(paths.plansDir, asset.filename)
    await fs.writeFile(assetPath, `${asset.content}\n`)
    await recordPipelineArtifact(projectRoot, assetPath, "plan", options, {
      stage: asset.stage,
      production: true,
      title: asset.title,
    })
    written.push(assetPath)
  }
  const writingPlanPath = await writeProductionWritingPlan(projectRoot, paths, state, options)
  written.push(writingPlanPath)

  await emitWritingProgress(options, {
    step: "story_bible_assets_saved",
    role: "Showrunner",
    status: "completed",
    message: "世界矩阵、主线架构、故事圣经、分卷策略、伏笔账本、人物关系资产和写作执行计划已保存。",
    artifactPath: relativeArtifactPath(projectRoot, path.join(paths.plansDir, "story-bible.md")),
    preview: [...assets.map((asset) => `- ${asset.filename}`), "- writing-plan.json"].join("\n"),
    wordCount: wordCount(assets.map((asset) => asset.content).join("\n\n")),
  })

  return written
}

async function ensureProductionStoryBibleAssets(
  projectRoot: string,
  paths: NovelWorkspacePaths,
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
  options: ProductionPipelineOptions = {},
) {
  const required = [...PRODUCTION_STORY_ASSET_FILES, "writing-plan.json"]
  const missing: string[] = []
  for (const filename of required) {
    const content = await readOptionalText(path.join(paths.plansDir, filename))
    if (!content.trim()) missing.push(filename)
  }
  if (missing.length === 0) return []
  await emitWritingProgress(options, {
    step: "story_bible_assets_repair_started",
    role: "Showrunner",
    chapterNumber: undefined,
    status: "started",
    message: `生产前置故事资产缺失 ${missing.length} 项，系统将在正文生产前自动补齐。`,
    preview: missing.map((filename) => `- ${filename}`).join("\n"),
  })
  return writeProductionStoryBibleAssets(projectRoot, paths, state, context, options)
}

export async function writeAllDetailedChapterBlueprints(
  projectRoot: string,
  paths: NovelWorkspacePaths,
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
  options: ProductionPipelineOptions = {},
) {
  const resources = await loadProductionWritingResources(projectRoot)
  await fs.mkdir(paths.chapterBlueprintsDir, { recursive: true })
  const written: string[] = []

  for (const task of state.plan.chapterTasks) {
    const storyAssetContext = await loadProductionStoryAssetContext(paths, task)
    const deterministicBlueprint = createDetailedChapterBlueprint(state, task, context, resources, undefined, storyAssetContext)
    const shouldUseLlmPlanner = process.env.AI_NOVEL_TEST_MODE !== "1"
      && !options.preferDeterministicPlanning
      && task.chapterNumber <= 3
    let content = deterministicBlueprint
    if (shouldUseLlmPlanner) {
      content = await createChapterBlueprintContent(state, task, context, resources, options, storyAssetContext)
    } else {
      await emitWritingProgress(options, {
        step: "chapter_blueprint_started",
        role: "Chapter Planner",
        chapterNumber: task.chapterNumber,
        title: task.title,
        status: "started",
        message: `Chapter Planner 开始生成第 ${task.chapterNumber} 章因果蓝图骨架。`,
        preview: task.summary,
      })
      await emitWritingKnowledgeRecallProgress({
        options,
        purpose: "blueprint",
        role: "Chapter Planner",
        chapterNumber: task.chapterNumber,
        title: task.title,
        rows: [],
      })
      await emitWritingProgress(options, {
        step: "chapter_blueprint_completed",
        role: "Chapter Planner",
        chapterNumber: task.chapterNumber,
        title: task.title,
        status: "completed",
        message: `Chapter Planner 已生成第 ${task.chapterNumber} 章因果蓝图骨架。`,
        preview: content.slice(0, 520),
        wordCount: wordCount(content),
      })
    }
    const blueprintPath = path.join(paths.chapterBlueprintsDir, `chapter-${String(task.chapterNumber).padStart(3, "0")}.md`)
    await fs.writeFile(blueprintPath, `${content}\n`)
    await recordPipelineArtifact(projectRoot, blueprintPath, "plan", options, {
      chapterNumber: task.chapterNumber,
      stage: "chapter_task_generation",
      detailed: true,
      plannerMode: shouldUseLlmPlanner ? "llm-detailed" : "deterministic-causal",
    })
    await emitWritingProgress(options, {
      step: "chapter_blueprint_saved",
      role: "Chapter Planner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: shouldUseLlmPlanner
        ? `第 ${task.chapterNumber} 章 LLM 详细蓝图已保存为正式产物。`
        : `第 ${task.chapterNumber} 章因果蓝图骨架已保存为正式产物，写到本章时可按需补强。`,
      artifactPath: relativeArtifactPath(projectRoot, blueprintPath),
      preview: content.slice(0, 360),
      wordCount: wordCount(content),
    })
    written.push(blueprintPath)
  }

  return written
}

export async function runChapterProductionPipeline(
  projectRoot: string,
  paths: NovelWorkspacePaths,
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  options: ProductionPipelineOptions = {},
) {
  throwIfPipelineAborted(options)
  if (options.projectId) {
    invalidateProjectCache(options.projectId)
  }
  const writingMode = productionWritingMode(options)
  const resources = await loadProductionWritingResources(projectRoot)
  const approvedStyleContext = await loadApprovedWritingStyleContext(projectRoot)
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext)
  await enforceApprovedWritingStyleGate(options, task, approvedStyleContext)
  await persistApprovedWritingStyleAssets(projectRoot, paths, approvedStyleContext, options)
  const protagonistProfile = await readOptionalText(paths.protagonistPath)
  const characterDossiers = await readCharacterDossiers(paths.characterDossiersPath)
  const chapterId = `chapter-${String(task.chapterNumber).padStart(3, "0")}`
  const previousChapterId = task.chapterNumber > 1 ? `chapter-${String(task.chapterNumber - 1).padStart(3, "0")}` : ""
  const previousMemory = previousChapterId
    ? await readOptionalText(path.join(paths.memoryDir, `${previousChapterId}-memory.md`))
    : ""
  const previousFinalDraft = previousChapterId
    ? await readOptionalText(path.join(paths.chaptersDir, `${previousChapterId}.final.md`))
    : ""
  const blueprintPath = path.join(paths.chapterBlueprintsDir, `${chapterId}.md`)
  const context = {
    consensus: await readOptionalText(paths.consensusPath),
    protagonist: protagonistProfile,
    style: [
      await readOptionalText(paths.styleProfilePath),
      approvedStyleCarryover,
    ].filter(Boolean).join("\n\n"),
  }
  await ensureProductionStoryBibleAssets(projectRoot, paths, state, context, options)
  await emitWritingProgress(options, {
    step: "chapter_started",
    role: "Showrunner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "started",
    message: writingMode === "quality"
      ? `第 ${task.chapterNumber} 章开始生产：完整质量模式会执行蓝图、初稿、LLM 质检、润色和记忆更新。`
      : `第 ${task.chapterNumber} 章开始生产：快速无人值守模式会优先生成正文，并用确定性硬门禁检查连续性、成语资源和去 AI 味。`,
  })
  let blueprint = await readOptionalText(blueprintPath)
  if (!hasCausalBlueprint(blueprint)) {
    const storyAssetContext = await loadProductionStoryAssetContext(paths, task)
    const planningContract = createContinuityContract({
      state,
      task,
      context,
      protagonistProfile,
      previousMemory,
      previousFinalDraft,
    })
    blueprint = createDetailedChapterBlueprint(state, task, context, resources, planningContract, storyAssetContext)
    await fs.mkdir(paths.chapterBlueprintsDir, { recursive: true })
    await fs.writeFile(blueprintPath, `${blueprint}\n`)
    await recordPipelineArtifact(projectRoot, blueprintPath, "plan", options, {
      chapterNumber: task.chapterNumber,
      stage: "drafting",
      detailed: true,
      generatedDuringProduction: true,
      reason: "missing_or_non_causal_blueprint",
    })
    await emitWritingProgress(options, {
      step: "chapter_blueprint_repaired",
      role: "Chapter Planner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: `第 ${task.chapterNumber} 章缺少可执行因果蓝图，已在生产前自动补齐。`,
      artifactPath: relativeArtifactPath(projectRoot, blueprintPath),
      preview: blueprint.slice(0, 420),
      wordCount: wordCount(blueprint),
    })
  }
	  const continuityContract = createContinuityContract({
	    state,
	    task,
    protagonistProfile,
    blueprint,
    previousMemory,
    previousFinalDraft,
  })
  if (continuityContract.status === "blocked") {
    throw new Error(`Continuity contract blocked chapter ${task.chapterNumber}: no locked protagonist from previous chapters.`)
  }
  await emitWritingProgress(options, {
    step: "blueprint_loaded",
    role: "Chapter Planner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "completed",
    message: `第 ${task.chapterNumber} 章蓝图已载入，开始生成正文初稿。`,
    artifactPath: relativeArtifactPath(projectRoot, blueprintPath),
    preview: blueprint.slice(0, 360),
  })
  await emitWritingProgress(options, {
    step: "continuity_contract_loaded",
    role: "Showrunner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "completed",
    message: continuityContract.lockedProtagonistName
      ? `Canon 连续性合同已载入：本章锁定主角「${continuityContract.lockedProtagonistName}」，并追踪配角、情节和伏笔。`
      : "Canon 连续性合同已载入：首章将锁定唯一主角，并建立后续角色/情节账本。",
    preview: continuityContract.prompt.slice(0, 720),
  })
  if (approvedStyleContext.status === "ready") {
    await emitWritingProgress(options, {
      step: "approved_style_contract_loaded",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: "用户确认写法合同已载入：正文生成、质检和自然化会以冻结样段与规则为最高风格约束。",
      preview: approvedStyleCarryover.slice(0, 720),
    })
    await emitWritingProgress(options, {
      step: "approved_style_assets_synced",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: "冻结后的写法规则书、正向参考和禁忌清单已同步到生产资产，正文链路会强制继承。",
      preview: [
        relativeArtifactPath(projectRoot, paths.styleRulebookPath),
        relativeArtifactPath(projectRoot, paths.styleReferencesPath),
        relativeArtifactPath(projectRoot, paths.styleAntiPatternsPath),
      ].join("\n"),
    })
  }
  const initialDraft = await createDraftBody(state, task, blueprint, resources, options, continuityContract, paths, projectRoot, characterDossiers, approvedStyleContext)
  throwIfPipelineAborted(options)
  await emitWritingProgress(options, {
    step: "draft_completed",
    role: "Author",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "completed",
    message: writingMode === "quality"
      ? `第 ${task.chapterNumber} 章初稿已生成，进入 LLM 质量门禁。`
      : `第 ${task.chapterNumber} 章初稿已生成，进入快速硬门禁检查。`,
    preview: initialDraft.slice(0, 420),
    wordCount: wordCount(initialDraft),
  })
  const { draft, report, gate } = await runQualityGateWithRevisions(state, task, initialDraft, blueprint, resources, options, continuityContract, paths, projectRoot, characterDossiers, approvedStyleContext)
  throwIfPipelineAborted(options)
  await emitWritingProgress(options, {
    step: "quality_gate_completed",
    role: "Editor",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: gate.status === "blocked" ? "blocked" : "completed",
    message: gate.status === "blocked"
      ? `第 ${task.chapterNumber} 章质检未通过：${gate.reason}`
      : writingMode === "quality"
        ? `第 ${task.chapterNumber} 章质检通过，评分 ${gate.score}/10，进入润色。`
        : `第 ${task.chapterNumber} 章快速硬门禁通过，评分 ${gate.score}/10，写入正式产物。`,
    preview: report.slice(0, 420),
    qualityGate: gate,
  })
  let finalDraft = gate.status === "blocked"
    ? createPolishedDraft(state, task, draft, report, gate, writingMode)
    : await createProductionPolishedDraft(state, task, draft, report, gate, resources, options, continuityContract, characterDossiers, approvedStyleContext)
  const isAigcGateBypassed = process.env.AIGC_GATE_BYPASS === "1" || options.bypassAigcGate === true
  let aigcDetection = isAigcGateBypassed
    ? skippedAigcWritingDetectionReport("AIGC检测在生成阶段已被旁路，将在后续统一精修。")
    : await runAigcWritingDetection(finalDraft, options)
  const isAigcBlocked = aigcDetection.status === "blocked" && !isAigcGateBypassed

  await emitWritingProgress(options, {
    step: "aigc_detection_completed",
    role: "Reviewer",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: isAigcBlocked ? "blocked" : "completed",
    message: isAigcBlocked
      ? `第 ${task.chapterNumber} 章 AIGC 检测发现 ${aigcDetection.highRiskSegments.length} 个高风险片段，准备执行局部自然化修复。`
      : aigcDetection.status === "blocked"
        ? `第 ${task.chapterNumber} 章 AIGC 检测发现 ${aigcDetection.highRiskSegments.length} 个高风险片段（已开启 AIGC 门禁旁路，直接通过）。`
        : aigcDetection.status === "passed"
          ? `第 ${task.chapterNumber} 章 AIGC 检测通过，平均概率 ${typeof aigcDetection.score === "number" ? aigcDetection.score.toFixed(3) : "n/a"}。`
          : `第 ${task.chapterNumber} 章 AIGC 检测未启用或不可用：${aigcDetection.reason}`,
    preview: formatAigcWritingDetectionReport(aigcDetection).slice(0, 520),
    wordCount: wordCount(finalDraft),
  })
  if (isAigcBlocked && gate.status !== "blocked") {
    finalDraft = await repairAigcHighRiskDraft(state, task, finalDraft, aigcDetection, resources, options, continuityContract, characterDossiers)
    aigcDetection = await runAigcWritingDetection(finalDraft, options)
    await emitWritingProgress(options, {
      step: "aigc_recheck_completed",
      role: "Reviewer",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: aigcDetection.status === "blocked" ? "blocked" : "completed",
      message: aigcDetection.status === "blocked"
        ? `第 ${task.chapterNumber} 章 AIGC 修复后仍有 ${aigcDetection.highRiskSegments.length} 个高风险片段。`
        : `第 ${task.chapterNumber} 章 AIGC 修复后复检完成。`,
      preview: formatAigcWritingDetectionReport(aigcDetection).slice(0, 520),
      wordCount: wordCount(finalDraft),
    })
  }
  const baseFinalGate = enforceFinalDraftQualityGate(gate, finalDraft, task, state, protagonistProfile, continuityContract, characterDossiers)
  let finalGate = (aigcDetection.status !== "passed" && aigcDetection.status !== "skipped" && !isAigcGateBypassed)
    ? {
        ...baseFinalGate,
        passed: false,
        status: "blocked" as const,
        reason: `${baseFinalGate.reason} ${aigcDetection.status === "blocked"
          ? `AIGC 检测阻塞：${aigcDetection.highRiskSegments.length} 个片段超过阈值，最高概率 ${typeof aigcDetection.maxSegmentScore === "number" ? aigcDetection.maxSegmentScore.toFixed(3) : "n/a"}。`
          : `AIGC 检测未通过：${aigcDetection.status}，${aigcDetection.reason || "需要配置并通过 AIGC 检测后才能放行。"}`
        }`.trim(),
      }
    : baseFinalGate
  throwIfPipelineAborted(options)
  await emitWritingProgress(options, {
    step: "naturalness_completed",
    role: "Prose Stylist",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: finalGate.status === "blocked" ? "blocked" : "completed",
    message: finalGate.status === "blocked"
      ? `第 ${task.chapterNumber} 章已生成阻塞版自然化稿，等待人工审阅或重试。`
      : `第 ${task.chapterNumber} 章 NaturalnessAgent 自然化完成，正在写入正式产物。`,
    preview: finalDraft.slice(0, 420),
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate,
  })
  await emitWritingProgress(options, {
    step: "memory_update_started",
    role: "Memory Keeper",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "started",
    message: `Memory Keeper 正在提取第 ${task.chapterNumber} 章记忆、角色变化和伏笔记录。`,
    preview: finalDraft.slice(0, 360),
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate,
  })
  const memoryUpdate = createChapterMemoryUpdate(state, task, finalDraft, continuityContract, characterDossiers)
  const updatedCharacterDossiers = updateCharacterDossiersAfterChapter({
    dossiers: characterDossiers,
    state,
    task,
    finalDraft,
    memoryUpdate,
    continuityContract,
  })
  if (updatedCharacterDossiers.length) {
    state.memory = {
      ...(state.memory || {}),
      characterDossiers: updatedCharacterDossiers,
    }
  }
  const extractedStyleFingerprint = await updateStyleFingerprintFromFirstChapter({
    paths,
    state,
    task,
    finalDraft,
    finalGate,
  })
  const styleConformanceDrift = evaluateChapterStyleConformanceDrift({
    approvedStyleContext,
    chapterText: finalDraft,
    extractedStyleFingerprint,
  })
  if (styleConformanceDrift.status === "drifted") {
    finalGate = {
      ...finalGate,
      passed: false,
      status: "blocked" as const,
      reason: `${finalGate.reason} 风格继承漂移阻塞：${styleConformanceDrift.reason}`.trim(),
    }
  }
	  const styleInheritanceVerification = await buildChapterStyleInheritanceVerification({
	    paths,
	    approvedStyleContext,
    task,
    finalGate,
    aigcDetection,
    styleConformanceDrift,
	    extractedStyleFingerprint,
	  })
	  const chapterInheritanceAdapter = approvedStyleContext.chapterInheritanceAdapter || null
	  const reportWithAigcDetection = `${report.trimEnd()}\n\n${formatAigcWritingDetectionReport(aigcDetection)}\n\n${formatStyleConformanceDriftReport(styleConformanceDrift)}`
  throwIfPipelineAborted(options)

  const draftPath = path.join(paths.chaptersDir, `${chapterId}.draft.md`)
  const reviewedPath = path.join(paths.chaptersDir, `${chapterId}.reviewed.md`)
  const finalPath = path.join(paths.chaptersDir, `${chapterId}.final.md`)
  const reportPath = path.join(paths.reportsDir, `${chapterId}-quality.md`)
  const memoryPath = path.join(paths.memoryDir, `${chapterId}-memory.md`)
  const characterRelationshipsPath = paths.characterDossiersPath
    ? path.join(path.dirname(paths.characterDossiersPath), "relationships.json")
    : ""
  const characterRelationsMarkdownPath = paths.characterDossiersPath
    ? path.join(path.dirname(paths.characterDossiersPath), "relations.md")
    : ""
  const characterRelationshipGraph = updatedCharacterDossiers.length
    ? createCharacterRelationshipGraph(updatedCharacterDossiers)
    : null

  await fs.mkdir(paths.chaptersDir, { recursive: true })
  await fs.mkdir(paths.reportsDir, { recursive: true })
  await fs.mkdir(paths.memoryDir, { recursive: true })
  await fs.writeFile(draftPath, `${draft}\n`)
  await fs.writeFile(reportPath, `${reportWithAigcDetection}\n`)
  await fs.writeFile(reviewedPath, `${draft}\n\n---\n\n${reportWithAigcDetection}\n`)
  await fs.writeFile(finalPath, `${finalDraft}\n`)
  await fs.writeFile(memoryPath, `${memoryUpdate}\n`)
  if (paths.characterDossiersPath && updatedCharacterDossiers.length) {
    await writeJsonFileAtomic(paths.characterDossiersPath, updatedCharacterDossiers)
  }
  if (paths.characterDossiersMarkdownPath && updatedCharacterDossiers.length) {
    await fs.writeFile(paths.characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown(updatedCharacterDossiers)}\n`)
  }
  if (characterRelationshipsPath && characterRelationshipGraph) {
    await writeJsonFileAtomic(characterRelationshipsPath, characterRelationshipGraph)
  }
  if (characterRelationsMarkdownPath && characterRelationshipGraph) {
    await fs.writeFile(characterRelationsMarkdownPath, `${formatCharacterRelationshipGraphMarkdown(characterRelationshipGraph)}\n`)
  }
  const versionManifestPath = await writeChapterVersionManifest({
    projectRoot,
    options,
    chapterId,
    task,
    draftPath,
    reviewedPath,
    finalPath,
    reportPath,
    memoryPath,
    finalDraft,
    draft,
    finalGate,
	    writingMode,
	    aigcDetection,
	    chapterInheritanceAdapter,
	    styleInheritanceVerification,
	    styleConformanceDrift,
	  })

  await recordPipelineArtifact(projectRoot, draftPath, "chapter", options, { chapterNumber: task.chapterNumber, pass: "draft" })
  await recordPipelineArtifact(projectRoot, reviewedPath, "chapter", options, { chapterNumber: task.chapterNumber, pass: "reviewed", qualityGate: finalGate })
  await recordPipelineArtifact(projectRoot, finalPath, "chapter", options, {
    chapterNumber: task.chapterNumber,
    pass: "final",
	    qualityGate: finalGate,
	    aigcDetection,
	    chapterInheritanceAdapter,
	    styleInheritanceVerification,
	    styleConformanceDrift,
    wordCount: wordCount(finalDraft),
    targetWords: task.targetWords,
  })
  await recordPipelineArtifact(projectRoot, reportPath, "checkpoint", options, { chapterNumber: task.chapterNumber, quality: true, qualityGate: finalGate, aigcDetection, styleInheritanceVerification, styleConformanceDrift })
  await recordPipelineArtifact(projectRoot, memoryPath, "memory", options, { chapterNumber: task.chapterNumber, qualityGate: finalGate })
  if (paths.characterDossiersPath && updatedCharacterDossiers.length) {
    await recordPipelineArtifact(projectRoot, paths.characterDossiersPath, "memory", options, {
      chapterNumber: task.chapterNumber,
      kind: "character_dossiers",
      qualityGate: finalGate,
    })
  }
  if (characterRelationshipsPath && characterRelationshipGraph) {
    await recordPipelineArtifact(projectRoot, characterRelationshipsPath, "memory", options, {
      chapterNumber: task.chapterNumber,
      kind: "character_relationship_graph",
      qualityGate: finalGate,
    })
  }
  if (extractedStyleFingerprint) {
    await recordPipelineArtifact(projectRoot, paths.styleProfilePath, "style", options, {
      chapterNumber: task.chapterNumber,
      kind: "style_profile",
      source: "first_chapter_fingerprint",
      styleFingerprint: extractedStyleFingerprint,
      qualityGate: finalGate,
    })
  }
  await emitWritingProgress(options, {
    step: "chapter_artifacts_saved",
    role: "Memory Keeper",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: finalGate.status === "blocked" ? "blocked" : "completed",
    message: finalGate.status === "blocked"
      ? `第 ${task.chapterNumber} 章产物已保存，但质量门禁仍阻塞。`
      : extractedStyleFingerprint
        ? `第 ${task.chapterNumber} 章正式正文、质检报告和记忆更新已保存，并提取首章风格指纹。`
        : `第 ${task.chapterNumber} 章正式正文、质检报告和记忆更新已保存。`,
    artifactPath: relativeArtifactPath(projectRoot, finalPath),
    preview: memoryUpdate.slice(0, 360),
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate,
  })

  if (options.factoryRootDir && options.projectId) {
    const updatedStyleProfile = extractedStyleFingerprint ? await readOptionalText(paths.styleProfilePath) : ""
    const characterDossierMemory = updatedCharacterDossiers.length
      ? formatCharacterDossiersMarkdown(updatedCharacterDossiers)
      : ""
    await withFactoryDb(options.factoryRootDir, async (db) => {
      db.recordMemory(options.projectId as string, {
        source: relativeArtifactPath(projectRoot, memoryPath),
        kind: "chapter_summary",
        content: memoryUpdate,
        importance: 7,
        metadata: { chapterNumber: task.chapterNumber, title: task.title },
        embedding: {
          model: "local-hash-v1",
          vector: createLocalTextEmbedding(memoryUpdate),
        },
      })
      if (characterDossierMemory && paths.characterDossiersPath) {
        const characterDossiersPath = relativeArtifactPath(projectRoot, paths.characterDossiersPath)
        db.recordMemory(options.projectId as string, {
          source: characterDossiersPath,
          kind: "character_dossiers",
          content: characterDossierMemory,
          importance: 9,
          metadata: {
            path: characterDossiersPath,
            chapterNumber: task.chapterNumber,
            source: "chapter_memory_keeper",
          },
          embedding: {
            model: "local-hash-v1",
            vector: createLocalTextEmbedding(characterDossierMemory),
          },
        })
      }
      if (extractedStyleFingerprint) {
        const styleProfilePath = relativeArtifactPath(projectRoot, paths.styleProfilePath)
        const styleMemory = [
          `Style fingerprint from chapter ${task.chapterNumber}: ${extractedStyleFingerprint}`,
          "",
          updatedStyleProfile,
        ].join("\n")
        db.recordMemory(options.projectId as string, {
          source: styleProfilePath,
          kind: "style_profile",
          content: styleMemory,
          importance: 8,
          metadata: {
            path: styleProfilePath,
            chapterNumber: task.chapterNumber,
            source: "first_chapter_fingerprint",
          },
          embedding: {
            model: "local-hash-v1",
            vector: createLocalTextEmbedding(styleMemory),
          },
        })
      }
      db.recordEvent(options.projectId as string, null, finalGate.status === "blocked" ? "CHAPTER_PIPELINE_BLOCKED" : "CHAPTER_PIPELINE_COMPLETED", {
        chapterNumber: task.chapterNumber,
        draftPath: relativeArtifactPath(projectRoot, draftPath),
        finalPath: relativeArtifactPath(projectRoot, finalPath),
        versionManifestPath: relativeArtifactPath(projectRoot, versionManifestPath),
        reportPath: relativeArtifactPath(projectRoot, reportPath),
        qualityGate: finalGate,
        styleInheritanceVerification,
        styleConformanceDrift,
        writingMode,
        directorCommandId: options.directorCommandId ?? null,
      })
    }).catch(() => undefined)
  }

  return {
    draftPath,
    reviewedPath,
    finalPath,
    versionManifestPath,
    reportPath,
    memoryPath,
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate,
    writingMode,
  }
}

function hasApprovedStyleSummaryPrompt(approvedStyleContext: ApprovedWritingStyleContext) {
  return approvedStyleContext.status === "ready" && Boolean(approvedStyleContext.prompt.trim())
}
