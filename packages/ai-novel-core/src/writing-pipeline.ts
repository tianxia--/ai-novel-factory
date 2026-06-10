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
}

export interface NaturalnessReport {
  status: "passed" | "needs_revision" | "blocked"
  score: number
  reason: string
  changedBlocks: number
  riskFlags: string[]
  preservedFacts: string[]
  patchSummary: string[]
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

function compactList(values: string[] = [], limit = 3) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, limit)
    .join("; ") || "pending"
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

function appendUnique(values: string[], next: string, limit = 8) {
  const normalized = next.trim()
  if (!normalized) return values.slice(0, limit)
  return [...values.filter((value) => value !== normalized), normalized].slice(-limit)
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
  const chapterDelta = `${chapterLabel}: ${getTaskCausalPlan(input.state, input.task).characterStateDelta}`
  const evidence = `${chapterLabel}: ${input.finalDraft.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join(" ").slice(0, 180)}`
  const continuityNote = `${chapterLabel}: ${input.continuityContract.continuityAnchors.slice(0, 4).join("、") || "new continuity anchors pending"}`
  const dossiers = input.dossiers.length ? input.dossiers : []
  const nextDossiers = dossiers.map((dossier) => {
    const isProtagonist = dossier.role === "protagonist" || dossier.id === "protagonist"
    const isKnownCast = knownCast.some((name) => name && (dossier.canonicalName === name || dossier.aliases.includes(name)))
    if (!isProtagonist && !isKnownCast) return dossier
    return {
      ...dossier,
      canonicalName: isProtagonist && protagonistName && dossier.canonicalName.startsWith("pending-")
        ? protagonistName
        : dossier.canonicalName,
      aliases: uniqueStrings([
        ...dossier.aliases,
        ...(isProtagonist && protagonistName ? [protagonistName] : []),
      ]).slice(0, 8),
      currentChapterDelta: chapterDelta,
      continuityNotes: appendUnique(dossier.continuityNotes, continuityNote),
      evidence: appendUnique(dossier.evidence, evidence),
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

function writingMessageStatus(status: WritingProgressEvent["status"]): MessageStatus {
  if (status === "blocked") return "failed"
  if (status === "running" || status === "started") return "streaming"
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
        status: writingMessageStatus(payload.status),
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
  if (styleQuality.status === "quarantined") {
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
      ? `${gate.reason} ${consistency.reason} ${plotContinuity.reason} ${styleQuality.reason} ${characterProfileQuality.reason} ${naturalnessReport.reason}`.trim()
      : gate.reason,
    wordCount: finalWordCount,
    targetWords,
  }
}

function inferGenreProfile(state: AutonomousNovelState) {
  const selectedGenre = state.project.creativeProfile?.genre?.trim()
  const selectedNaturalness = state.project.creativeProfile?.naturalnessTarget || "balanced"
  const selectedReaderPromise = state.project.creativeProfile?.readerPromise?.trim()
  const selectedPointOfView = state.project.creativeProfile?.pointOfView?.trim()
  const selectedTone = state.project.creativeProfile?.tone?.trim()
  const selectedProfileText = [
    selectedGenre && selectedGenre !== "auto-inferred" ? selectedGenre : "",
    selectedReaderPromise || "",
    selectedPointOfView || "",
    selectedTone || "",
  ].join("\n")
  const text = `${state.project.title}\n${state.project.idea}`.toLowerCase()
  const profileText = `${selectedProfileText}\n${text}`.toLowerCase()
  const withProfile = (profile: { genre: string; narration: string; vocabularyScenes: string[] }) => ({
    ...profile,
    naturalnessTarget: selectedNaturalness,
    readerPromise: selectedReaderPromise || "hook-forward, scene-first, emotionally specific",
    pointOfView: selectedPointOfView || "third-person limited",
    tone: selectedTone || "tense but readable",
  })
  if (/仙侠|修仙|玄幻|剑|神|魔|灵|immortal|fantasy|xianxia/i.test(profileText)) {
    return withProfile({
      genre: "玄幻/仙侠",
      narration: "旁白要强调规则边界、代价、奇观感与境界压力；战斗场景用动作动词和感官细节，不堆术语。",
      vocabularyScenes: ["战斗", "自然环境", "训练修炼", "心理活动"],
    })
  }
  if (/权谋|宫廷|朝堂|帝|王|court|palace|politic/i.test(profileText)) {
    return withProfile({
      genre: "权谋/宫廷",
      narration: "旁白要突出信息差、礼制压力、对话潜台词与局势变化；正式场合允许较高文言比例。",
      vocabularyScenes: ["宫廷", "权谋算计", "对话", "仪式庆典"],
    })
  }
  if (/悬疑|谜|案|侦探|mystery|crime|thriller/i.test(profileText)) {
    return withProfile({
      genre: "悬疑",
      narration: "旁白要控制线索显隐、误导和节奏；场景细节必须可回收，不写无意义氛围。",
      vocabularyScenes: ["环境渲染", "心理活动", "对话"],
    })
  }
  if (/爱情|言情|恋|romance|love/i.test(profileText)) {
    return withProfile({
      genre: "言情/情感",
      narration: "旁白要贴近情绪细节、关系推进和身体反应；冲突要落在选择、误解和欲望上。",
      vocabularyScenes: ["感情戏", "心理活动", "对话", "日常"],
    })
  }
  if (/都市|职场|现实|city|urban/i.test(profileText)) {
    return withProfile({
      genre: "都市/现实",
      narration: "旁白要保留生活质感、职业细节和人物关系张力；语言以现代自然为主。",
      vocabularyScenes: ["日常", "对话", "心理活动"],
    })
  }
  return withProfile({
    genre: selectedGenre && selectedGenre !== "auto-inferred" ? selectedGenre : "通用类型小说",
    narration: "旁白优先服务场景推进、角色选择和读者期待；避免模板化总结。",
    vocabularyScenes: ["对话", "环境渲染", "心理活动"],
  })
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
    "",
    "### 关键词来源",
    keywords.length ? `- ${keywords.slice(0, 12).join("、")}` : "- 暂无明确关键词，按场景类型推荐。",
    "",
    "### 成语关联性检查",
    ...(idioms.length
      ? idioms.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}；仅在已有铺垫后用于总结/对比/强调。`)
      : ["- 未找到高度相关成语，建议使用基础词汇表达，不强行植入。"]),
    "",
    "### 基础词汇 - 优先使用",
    ...base.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}`),
    "",
    "### 进阶词汇 - 适当使用",
    ...(advanced.length ? advanced.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}`) : ["- 无。"]),
    "",
    "### 高级/稀有词汇 - 谨慎使用",
    ...(rare.length ? rare.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}`) : ["- 无。"]),
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
    .split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|章节元数据|章节元信息)/u)[0]
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^#{1,6}\s/u.test(line) && !/^[-*]\s/u.test(line))
  const fragments = lines
    .map((line) => line.replace(/[，。！？；：、,.!?;:\s"'“”‘’（）()《》「」]/gu, ""))
    .filter((line) => /^[\p{Script=Han}]{1,4}$/u.test(line))
  const fragmentCounts = new Map<string, number>()
  for (const fragment of fragments) {
    fragmentCounts.set(fragment, (fragmentCounts.get(fragment) || 0) + 1)
  }
  const repeatedFragment = [...fragmentCounts.entries()]
    .filter(([fragment, count]) => fragment.length <= 3 && count >= 3)
    .sort((left, right) => right[1] - left[1])[0]
  let maxConsecutiveFragments = 0
  let currentConsecutiveFragments = 0
  for (const line of lines) {
    const compact = line.replace(/[，。！？；：、,.!?;:\s"'“”‘’（）()《》「」]/gu, "")
    if (/^[\p{Script=Han}]{1,4}$/u.test(compact)) {
      currentConsecutiveFragments += 1
      maxConsecutiveFragments = Math.max(maxConsecutiveFragments, currentConsecutiveFragments)
    } else {
      currentConsecutiveFragments = 0
    }
  }
  const sentenceFragments = body
    .split(/[。！？!?；;\n]+/u)
    .map((sentence) => sentence.replace(/[，、：:,.…\s"'“”‘’（）()《》「」]/gu, ""))
    .filter((sentence) => /^[\p{Script=Han}]{1,4}$/u.test(sentence))
  if (repeatedFragment) {
    return {
      status: "quarantined" as const,
      reason: `风格硬门槛失败：短词/单字碎片「${repeatedFragment[0]}」重复 ${repeatedFragment[1]} 次，AI 化痕迹过重。`,
      fragments,
    }
  }
  if (maxConsecutiveFragments >= 3) {
    return {
      status: "quarantined" as const,
      reason: `风格硬门槛失败：连续 ${maxConsecutiveFragments} 行短词/单字碎片化描写，必须改成完整动作、感官和因果句。`,
      fragments,
    }
  }
  if (sentenceFragments.length >= 10) {
    return {
      status: "quarantined" as const,
      reason: `风格硬门槛失败：全文出现 ${sentenceFragments.length} 个孤立短句碎片，AI 化节奏过重。`,
      fragments: sentenceFragments,
    }
  }
  return {
    status: "eligible" as const,
    reason: "风格硬门槛通过：未发现高频短词/单字碎片化重复。",
    fragments,
  }
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

  if (stackedIdiomRun || idiomLikeSentences.length >= 8) {
    return {
      status: "quarantined" as const,
      reason: "写作资源硬门槛失败：疑似把成语/短词堆成场景，未自然嵌入动作、感官或因果句。",
      matchedTerms,
    }
  }

  const concreteSignals = actionSignals + sensorySignals + objectSignals
  if (concreteSignals < 4 && matchedTerms.length < 1 && !projectSignal) {
    return {
      status: "quarantined" as const,
      reason: "写作资源硬门槛失败：正文缺少动作、感官、物件或项目关键词，资源没有落到具体场景。",
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

function createNaturalnessReport(input: {
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
  const aiSummarySignals = (body.match(/由此可见|不难看出|事实上|显然|总而言之|综上|这意味着|他终于明白|命运的齿轮|这一刻.*命运|内心深处|复杂的情绪|无法言喻|说不出的感觉|某种意义上/gu) || []).length
  const analyticSignals = (body.match(/第一|第二|首先|其次|最后|原因是|从.*角度|可以看出|体现了|说明了|证明了/gu) || []).length
  const emotionLabelSignals = (body.match(/愤怒|悲伤|恐惧|绝望|震惊|激动|开心|难过|复杂|崩溃|释然/gu) || []).length
  const characterPresence = evaluateCharacterProfilePresence(input.afterDraft, input.characterProfileContract)
  const styleQuality = evaluateNarrativeStyleQuality(input.afterDraft)
  const plotContinuity = evaluatePlotContinuityBridge(input.afterDraft, input.task, input.continuityContract)
  const preservedFacts = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.requiredNames,
    ...input.continuityContract.continuityAnchors.filter((anchor) => input.afterDraft.includes(anchor)),
  ].filter(Boolean)).slice(0, 12)
  const riskFlags = [
    ...(styleQuality.status === "quarantined" ? [styleQuality.reason] : []),
    ...(plotContinuity.status === "quarantined" ? [plotContinuity.reason] : []),
    ...(characterPresence.status === "quarantined" ? [characterPresence.reason] : []),
    ...(aiSummarySignals >= 3 ? [`总结腔/AI 旁白信号过多：${aiSummarySignals}`] : []),
    ...(analyticSignals >= 5 ? [`分析报告腔信号过多：${analyticSignals}`] : []),
    ...(emotionLabelSignals > Math.max(8, Math.floor(wordTotal / 450)) && actionSignals < emotionLabelSignals
      ? [`情绪标签多于动作外化：emotion=${emotionLabelSignals}, action=${actionSignals}`]
      : []),
    ...(dialogueCount === 0 && wordTotal > 900 ? ["长章节缺少对白，角色声音不够自然。"] : []),
    ...(actionSignals + sensorySignals < Math.max(6, Math.floor(wordTotal / 350)) ? ["动作/感官信号不足，文本可能偏摘要。"] : []),
  ]
  const changedBlocks = input.beforeDraft === input.afterDraft
    ? 0
    : Math.abs(input.afterDraft.split(/\n{2,}/u).length - input.beforeDraft.split(/\n{2,}/u).length)
      + (input.afterDraft.length === input.beforeDraft.length ? 1 : Math.max(1, Math.round(Math.abs(input.afterDraft.length - input.beforeDraft.length) / 500)))
  const score = Math.max(0, Math.min(10, 10 - riskFlags.length * 2 - Math.max(0, aiSummarySignals - 1) - Math.max(0, analyticSignals - 3)))
  const status = riskFlags.some((flag) => /硬门槛失败|连续性|角色档案硬门槛|阻塞/u.test(flag))
    ? "blocked"
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
    patchSummary: [
      changedBlocks > 0 ? `文本发生约 ${changedBlocks} 个块级变化。` : "未发生块级变化或使用确定性整理稿。",
      `对白数：${dialogueCount}；动作信号：${actionSignals}；感官信号：${sensorySignals}。`,
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

function hasCausalBlueprint(blueprint = "") {
  return blueprint.includes("# Detailed Chapter Blueprint")
    && blueprint.includes("## Previous Inputs")
    && blueprint.includes("## Causal Objective")
    && blueprint.includes("## Irreversible Change")
    && blueprint.includes("## Character State Delta")
    && blueprint.includes("## Required Continuity Anchors")
    && blueprint.includes("## Next Chapter Handoff")
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
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
  }
}

function evaluateCharacterVoiceDifferentiation(draft: string, contract: CharacterProfileContract) {
  const body = extractNarrativeBody(draft)
  const cast = contract.knownCast
    .map((name) => name.trim())
    .filter((name) => name && body.includes(name))
    .slice(0, 6)
  if (cast.length < 2) {
    return {
      status: "eligible" as const,
      reason: "角色差异化检查跳过：正文中少于两个已知角色同时出现。",
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
    const pattern = new RegExp(`${escapeRegExpLiteral(name)}[\\s\\S]{0,90}|[\\s\\S]{0,70}${escapeRegExpLiteral(name)}`, "gu")
    const windows = [...body.matchAll(pattern)].map((match) => match[0]).join("\n")
    const dialogue = /[「“][^」”]{2,120}[」”]|说|问|道|喊|低声|冷笑|称呼/u.test(windows)
    const habit = /抬手|低头|停顿|皱眉|握住|松开|避开|看向|转身|下意识|指尖|肩|脚步|眼神/u.test(windows)
    const relation = /信任|怀疑|欠|救|骗|敌|同伴|关系|站在|背叛|帮|拦|让|替/u.test(windows)
    const agency = /决定|必须|想要|不能|只好|选择|拒绝|答应|追|藏|推|递|拿|按/u.test(windows)
    const score = [dialogue, habit, relation, agency].filter(Boolean).length
    return { name, score, dialogue, habit, relation, agency }
  })

  const weak = scored.filter((entry) => entry.score < 2)
  const dialogueCarriers = scored.filter((entry) => entry.dialogue).length
  const habitCarriers = scored.filter((entry) => entry.habit).length
  const agencyCarriers = scored.filter((entry) => entry.agency).length
  const concreteCarriers = scored.filter((entry) => entry.dialogue || entry.habit || entry.relation || entry.agency).length
  const missing = [
    ...(dialogueCarriers < 2 ? ["多角色对白/称呼差异"] : []),
    ...(habitCarriers < 2 ? ["多角色行为习惯差异"] : []),
    ...(agencyCarriers < 2 ? ["多角色主动选择差异"] : []),
    ...(weak.length ? [`弱角色信号：${weak.map((entry) => entry.name).join("、")}`] : []),
  ]

  const clearlyFlattened = (homogenizedSignals >= 2 || templateVoiceSignals >= cast.length + 1)
    && (quotedDialogueCount < 2 || concreteCarriers < 2)
  if (clearlyFlattened) {
    return {
      status: "quarantined" as const,
      reason: `角色差异化不足：${missing.join("；") || "多角色被同质化模板概括"}，检测到 ${homogenizedSignals} 个同质化概括信号和 ${templateVoiceSignals} 个模板声音信号。`,
      observedCast: cast,
      missing,
    }
  }
  return {
    status: "eligible" as const,
    reason: `角色差异化通过：${cast.join("、")} 至少通过对白、习惯动作或主动选择形成区分。`,
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
    return cached
  }
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
) {
  throwIfPipelineAborted(options)
  const continuityContract = createContinuityContract({ state, task, context })
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    protagonistProfile: context.protagonist,
    continuityContract,
  })
  const fallback = createDetailedChapterBlueprint(state, task, context, resources, continuityContract)
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

async function generateProductionTextWithLlm({
  roleName,
  message,
  basePrompt,
  dynamicPrompt,
  state,
  options,
  progress,
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
  prunedRag: string
  prunedMemory: string
  prunedLedger: string
  previousDraftFragment: string
}

async function loadAndPruneGlobalContext(params: {
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

  // 3. 加载共识与设定
  let rawConsensus = ""
  if (paths) {
    rawConsensus = await readOptionalText(paths.consensusPath)
  }

  // 4. 加载角色记忆
  let rawMemory = ""
  if (paths && previousChapterId) {
    rawMemory = await readOptionalText(path.join(paths.memoryDir, `${previousChapterId}-memory.md`))
  }

  // 5. 组装 RAG
  let rawRag = params.knowledgeContext?.prompt || ""

  // 6. 获取 ledger list
  let ledgerList = [...continuityContract.previousChapterLedger]

  // 设定总预算（字符数）：System Prompt 目标控制在 12,000 字以内
  // 注意：blueprint 传入的是 message（User Message），不计入 System Prompt 预算
  const MAX_TOTAL_CHARS = 12_000

  // 静态保护区：
  // 采用调用方实测的不参与裁剪的固定内容总长度 + 动态加载的承接片段长度
  const fixedLength = params.additionalFixedLength ?? 10_500
  const protagonistName = continuityContract.lockedProtagonistName || ""

  const protectedLength =
    fixedLength +
    previousDraftFragment.length +
    protagonistName.length


  let prunedRag = rawRag
  let prunedMemory = rawMemory
  let prunedLedgerList = [...ledgerList]
  let prunedConsensus = rawConsensus
  let prunedOutline = rawOutline

  // 计算当前动态区总长
  const getDynamicLength = () => {
    const ledgerText = prunedLedgerList.join("\n")
    return prunedRag.length + prunedMemory.length + ledgerText.length + prunedConsensus.length + prunedOutline.length
  }

  // 阶段 1：裁剪 RAG 与 角色记忆
  if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
    if (prunedRag.length > 1000) {
      prunedRag = prunedRag.slice(0, 1000) + "\n...[RAG 知识库因 Token 限制被裁剪]"
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      if (prunedMemory.length > 800) {
        prunedMemory = prunedMemory.slice(0, 800) + "\n...[角色记忆因 Token 限制被裁剪]"
      }
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedRag = ""
      prunedMemory = ""
    }
  }

  // 阶段 2：裁剪 Chapter Ledger
  if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
    while (prunedLedgerList.length > 2 && protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedLedgerList.shift()
    }
    if (prunedLedgerList.length > 1 && protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedLedgerList = [prunedLedgerList[prunedLedgerList.length - 1]]
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedLedgerList = []
    }
  }

  // 阶段 3：裁剪 Consensus & Setting Freeze
  if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS && prunedConsensus) {
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
      if (isHit) {
        matchedBlocks.push(block)
      }
    }

    if (matchedBlocks.length > 0) {
      prunedConsensus = matchedBlocks.join("\n")
    } else {
      prunedConsensus = prunedConsensus.slice(0, 1500) + "\n...[全局共识因 Token 限制被缩减]"
    }

    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedConsensus = prunedConsensus.slice(0, 500)
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedConsensus = ""
    }
  }

  // 阶段 4：裁剪 Master Outline
  if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS && prunedOutline) {
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
      prunedOutline = prunedOutline.slice(0, 1500) + "\n...[主线大纲因 Token 限制被缩减]"
    }

    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedOutline = prunedOutline.slice(0, 500)
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedOutline = ""
    }
  }

  return {
    prunedConsensus,
    prunedOutline,
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
) {
  throwIfPipelineAborted(options)
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
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return fallback
  }

  // 对词汇/示例/资源清单加硬上限，防止无限膨胀（这三项不在裁剪级联内）
  const cappedVocabularyPrompt = vocabularyPrompt.slice(0, 1000)
  const cappedVocabularySkillExamples = vocabularySkillExamples.slice(0, 800)
  const cappedResourceManifest = resourceManifest.slice(0, 500)

  // 限制全局写作指南大小，只保留前 2000 字符核心规范，防止上下文过度膨胀
  const cappedWriterGuide = (resources.writerGuide || "").slice(0, 2000)

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
  ]

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
    continuityContract.prompt,
    "",
    characterProfileContract.prompt.slice(0, 1800),
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
    ` consensus=${prunedContext.prunedConsensus.length}字` +
    ` outline=${prunedContext.prunedOutline.length}字` +
    ` memory=${prunedContext.prunedMemory.length}字` +
    ` ledger=${prunedContext.prunedLedger.length}字` +
    ` prevFragment=${prunedContext.previousDraftFragment.length}字` +
    ` rag=${prunedContext.prunedRag.length}字`,
  )

  const generated = await generateProductionTextWithLlm({
    roleName: "Author",
    state,
    options,
    progress: {
      step: "draft_generation",
      role: "Author",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `Author 正在根据第 ${task.chapterNumber} 章蓝图生成正文初稿。`,
      completeMessage: `Author 已返回第 ${task.chapterNumber} 章初稿，准备进入质检。`,
    },
    basePrompt: basePromptText,
    dynamicPrompt: [
      `章节：第 ${task.chapterNumber} 章`,
      `标题：${task.title}`,
      `目标字数：${task.targetWords}`,
      `类型：${genre.genre}`,
      `场景类型：${sceneType}`,
      `旁白策略：${genre.narration}`,
      "",
      cappedVocabularyPrompt,
      "",
      cappedVocabularySkillExamples,
      "",
      cappedResourceManifest,
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
      "Knowledge/RAG References:",
      prunedContext.prunedRag,
      "",
      continuityContract.prompt,
      "",
      characterProfileContract.prompt.slice(0, 1800),
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
    ].join("\n"),
    message: [
      "请按以下详细章节蓝图生成本章正文草稿。",
      "输出 Markdown，必须包含 `# 章节标题` 和 `## Draft Body`。",
      "不要写解释，不要让用户选择，不要跳章。",
      "",
      "## Causal Chapter Plan",
      ...formatCausalPlanBullets(state, task),
      "",
      trimBlueprintForDrafting(blueprint),
    ].join("\n"),
  })

  return generated.includes("## Draft Body")
    ? generated
    : [`# ${task.title}`, "", "## Draft Body", "", generated, "", "## Drafting Metadata", `- Chapter: ${task.chapterNumber}`].join("\n")
}

	function createQualityReport(
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
	  const hasConflict = /冲突|压力|选择|代价|反击|局势/u.test(draft)
	  const hasBlueprint = blueprint.includes("Event Sequence")
	  const hasCausalContract = hasCausalBlueprint(blueprint)
	  const hasCausalSignals = /承接|上一章|前文|选择|代价|不可逆|交给|下一章|后果/u.test(draft)
	  const hasCausalExecution = hasCausalContract && (hasCausalSignals || (hasBlueprint && hasConflict && hasHook))
	  const hardBlocked = wordCountBlockingIssue
	    || plotContinuity.status === "quarantined"
	    || styleQuality.status === "quarantined"
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
	    `| 因果合同执行 | ${hasCausalContract && hasCausalExecution ? 8 : 4}/10 | ${hasCausalContract && hasCausalExecution ? "蓝图包含因果合同，正文体现承接、选择、代价或交棒。" : "缺少清晰因果合同或正文未执行承接-选择-代价-交棒。"} |`,
	    `| 写作资源吸收 | ${resourceUsage.status === "eligible" ? 8 : 4}/10 | ${resourceUsage.reason} |`,
	    `| 角色鲜明度 | ${characterProfileQuality.status === "eligible" ? 8 : 4}/10 | ${characterProfileQuality.reason} |`,
	    `| 综合评分 | ${score}/10 | ${score >= 7 ? "可进入润色。" : "需要返工。"} |`,
    "",
    `WORD_COUNT_CHECK: ${count}/${target}`,
    "",
    "## Checks",
	    "- Editor: 检查叙事推进、人物行动、爽点密度。",
	    "- Consistency Checker: 检查设定、时间线、伏笔和人物关系。",
	    "- Style Controller: 检查文风、成语密度、文言比例、对白差异。",
	    "- Prose Stylist: 去除模板感，增强具体场景和自然表达。",
	    `- Causal Contract: ${hasCausalContract && hasCausalExecution ? "通过：章节不是孤立事件，已有承接、选择、代价或交棒。" : "失败：章节可能变成流水账或孤立事件。"}`,
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
	        ...(styleQuality.status === "quarantined" ? [`- 需要返工：${styleQuality.reason}`] : []),
	        ...(resourceUsage.status === "quarantined" ? [`- 需要返工：${resourceUsage.reason}`] : []),
	        ...(characterProfileQuality.status === "quarantined" ? [`- 需要返工：${characterProfileQuality.reason}`] : []),
	        ...(!hasCausalContract ? ["- 需要返工：蓝图缺少 Causal Objective / Irreversible Change / Next Chapter Handoff，不能支撑连续写作。"] : []),
	        ...(!hasCausalExecution ? ["- 需要返工：正文没有清晰执行承接-选择-代价-交棒，容易变成流水账。"] : []),
	        "- 扩写正文场景。",
        "- 增强冲突动作。",
        "- 补足章末钩子。",
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
	  const narrativeFixes = [
	    ...(plotContinuity?.status === "quarantined" ? [`- 需要返工：${plotContinuity.reason}`] : []),
	    ...(styleQuality.status === "quarantined" ? [`- 需要返工：${styleQuality.reason}`] : []),
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

async function createProductionQualityReport(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  draft: string,
  blueprint: string,
  resources: ProductionWritingResources,
  options: ProductionPipelineOptions,
  continuityContract = createContinuityContract({ state, task, blueprint }),
  characterDossiers?: CharacterDossier[],
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

  const generated = await generateProductionTextWithLlm({
    roleName: "Editor",
    state,
    options,
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
) {
  throwIfPipelineAborted(options)
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
  ]
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft,
    blueprint,
  })

  const fixedDynamicPromptLines = [
    `章节：第 ${task.chapterNumber} 章`,
    `标题：${task.title}`,
    `返工轮次：${attempt}`,
    "必须针对质量报告中的问题重写/扩写正文。",
    "必须输出 Markdown，保留 `## Draft Body`。",
    "",
    `[Correction Observation (纠偏观察)]\n上一轮写作存在以下缺陷：\n${report.slice(0, 1500)}\n请在本次重写中特别注意并修复这些问题。`,
    "",
    continuityContract.prompt,
    "",
    characterProfileContract.prompt,
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

  const generated = await generateProductionTextWithLlm({
    roleName: "Author",
    state,
    options,
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
      "必须输出 Markdown，保留 `## Draft Body`。",
      "",
      `[Correction Observation (纠偏观察)]\n上一轮写作存在以下缺陷：\n${report.slice(0, 1500)}\n请在本次重写中特别注意并修复这些问题。`,
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
      continuityContract.prompt,
    ].join("\n"),
    message: [
      "请根据质量报告返工以下章节草稿。",
      "",
      "## Blueprint",
      trimBlueprintForDrafting(blueprint),
      "",
      "## Quality Report",
      report,
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
    report = await createProductionQualityReport(state, task, draft, blueprint, resources, options, continuityContract, characterDossiers)
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
      characterDossiers
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
) {
  throwIfPipelineAborted(options)
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft,
  })
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
    ].join("\n\n"),
    dynamicPrompt: [
      "只允许在不改变核心剧情、不改变设定、不跳章的前提下润色。",
      "必须保留章节正文结构，增强动作、感官、对白差异和具体细节。",
	      "控制成语密度，避免堆砌和模板化情绪解释。",
	      "必须消除单字/短词独立成行的 AI 化碎片感；推荐词只能自然嵌入句子。",
	      "必须移除报告腔、总结腔、过度解释、整齐排比、情绪标签堆叠和万能升华结尾。",
	      "必须让角色通过习惯动作、说话方式、外貌体态、能力边界和关系压力呈现人格。",
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
    const deterministicBlueprint = createDetailedChapterBlueprint(state, task, context, resources)
    const shouldUseLlmPlanner = process.env.AI_NOVEL_TEST_MODE !== "1"
      && !options.preferDeterministicPlanning
      && task.chapterNumber <= 3
    let content = deterministicBlueprint
    if (shouldUseLlmPlanner) {
      content = await createChapterBlueprintContent(state, task, context, resources, options)
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
  const writingMode = productionWritingMode(options)
  const resources = await loadProductionWritingResources(projectRoot)
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
    style: await readOptionalText(paths.styleProfilePath),
  }
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
    const planningContract = createContinuityContract({
      state,
      task,
      context,
      protagonistProfile,
      previousMemory,
      previousFinalDraft,
    })
    blueprint = createDetailedChapterBlueprint(state, task, context, resources, planningContract)
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
  const initialDraft = await createDraftBody(state, task, blueprint, resources, options, continuityContract, paths, projectRoot, characterDossiers)
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
  const { draft, report, gate } = await runQualityGateWithRevisions(state, task, initialDraft, blueprint, resources, options, continuityContract, paths, projectRoot, characterDossiers)
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
  const finalDraft = gate.status === "blocked"
    ? createPolishedDraft(state, task, draft, report, gate, writingMode)
    : await createProductionPolishedDraft(state, task, draft, report, gate, resources, options, continuityContract, characterDossiers)
  const finalGate = enforceFinalDraftQualityGate(gate, finalDraft, task, state, protagonistProfile, continuityContract, characterDossiers)
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
  throwIfPipelineAborted(options)

  const draftPath = path.join(paths.chaptersDir, `${chapterId}.draft.md`)
  const reviewedPath = path.join(paths.chaptersDir, `${chapterId}.reviewed.md`)
  const finalPath = path.join(paths.chaptersDir, `${chapterId}.final.md`)
  const reportPath = path.join(paths.reportsDir, `${chapterId}-quality.md`)
  const memoryPath = path.join(paths.memoryDir, `${chapterId}-memory.md`)

  await fs.mkdir(paths.chaptersDir, { recursive: true })
  await fs.mkdir(paths.reportsDir, { recursive: true })
  await fs.mkdir(paths.memoryDir, { recursive: true })
  await fs.writeFile(draftPath, `${draft}\n`)
  await fs.writeFile(reportPath, `${report}\n`)
  await fs.writeFile(reviewedPath, `${draft}\n\n---\n\n${report}\n`)
  await fs.writeFile(finalPath, `${finalDraft}\n`)
  await fs.writeFile(memoryPath, `${memoryUpdate}\n`)
  if (paths.characterDossiersPath && updatedCharacterDossiers.length) {
    await writeJsonFileAtomic(paths.characterDossiersPath, updatedCharacterDossiers)
  }
  if (paths.characterDossiersMarkdownPath && updatedCharacterDossiers.length) {
    await fs.writeFile(paths.characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown(updatedCharacterDossiers)}\n`)
  }

  await recordPipelineArtifact(projectRoot, draftPath, "chapter", options, { chapterNumber: task.chapterNumber, pass: "draft" })
  await recordPipelineArtifact(projectRoot, reviewedPath, "chapter", options, { chapterNumber: task.chapterNumber, pass: "reviewed", qualityGate: finalGate })
  await recordPipelineArtifact(projectRoot, finalPath, "chapter", options, {
    chapterNumber: task.chapterNumber,
    pass: "final",
    qualityGate: finalGate,
    wordCount: wordCount(finalDraft),
    targetWords: task.targetWords,
  })
  await recordPipelineArtifact(projectRoot, reportPath, "checkpoint", options, { chapterNumber: task.chapterNumber, quality: true, qualityGate: finalGate })
  await recordPipelineArtifact(projectRoot, memoryPath, "memory", options, { chapterNumber: task.chapterNumber, qualityGate: finalGate })
  if (paths.characterDossiersPath && updatedCharacterDossiers.length) {
    await recordPipelineArtifact(projectRoot, paths.characterDossiersPath, "memory", options, {
      chapterNumber: task.chapterNumber,
      kind: "character_dossiers",
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
      : `第 ${task.chapterNumber} 章正式正文、质检报告和记忆更新已保存。`,
    artifactPath: relativeArtifactPath(projectRoot, finalPath),
    preview: memoryUpdate.slice(0, 360),
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate,
  })

  if (options.factoryRootDir && options.projectId) {
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
      db.recordEvent(options.projectId as string, null, finalGate.status === "blocked" ? "CHAPTER_PIPELINE_BLOCKED" : "CHAPTER_PIPELINE_COMPLETED", {
        chapterNumber: task.chapterNumber,
        draftPath: relativeArtifactPath(projectRoot, draftPath),
        finalPath: relativeArtifactPath(projectRoot, finalPath),
        reportPath: relativeArtifactPath(projectRoot, reportPath),
        qualityGate: finalGate,
        writingMode,
        directorCommandId: options.directorCommandId ?? null,
      })
    }).catch(() => undefined)
  }

  return {
    draftPath,
    reviewedPath,
    finalPath,
    reportPath,
    memoryPath,
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate,
    writingMode,
  }
}
