import fs from "node:fs/promises"
import path from "node:path"

import { generateAgentReply } from "./runtime-llm"
import { saveAutonomousState } from "./orchestrator"
import { upsertDiscussionInSuperGraph } from "./super-graph"
import { FactoryDb, makeAgentTurnId, makeRunId, targetToArtifactKind } from "./factory-db"
import { createLocalTextEmbedding } from "./embedding"
import { createAgentMessage, type MessagePart } from "./messages"
import type { AutonomousNovelState, CharacterDossier } from "./cli-types"
import { throwIfStopped } from "./abort"
import { formatKnowledgeForPrompt, retrieveKnowledge } from "./knowledge"
import { buildStoryCoreContext, buildHistoryForAgent, CONTEXT_BUDGET } from "./context-budget"

const AGENT_FLOW = [
  { id: "showrunner", label: "Showrunner" },
  { id: "world-architect", label: "World Architect" },
  { id: "author", label: "Author" },
  { id: "editor", label: "Editor" },
  { id: "reviewer", label: "Reviewer" },
  { id: "prose-stylist", label: "Prose Stylist" },
] as const

const SPECIALIST_FLOW = AGENT_FLOW.filter((agent) => agent.id !== "showrunner")

function workspacePath(rootDir: string, ...parts: string[]) {
  return path.join(rootDir, ".ai-novel", ...parts)
}

async function readText(filePath: string) {
  return fs.readFile(filePath, "utf8")
}

async function readOptionalText(filePath: string) {
  try {
    return await readText(filePath)
  } catch {
    return ""
  }
}

async function readCharacterDossiers(filePath: string): Promise<CharacterDossier[]> {
  try {
    const parsed = JSON.parse(await readText(filePath))
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

function appendSection(current: string, heading: string, bullet: string) {
  if (current.includes(heading)) {
    return `${current.trimEnd()}\n- ${bullet}\n`
  }

  return `${current.trimEnd()}\n\n${heading}\n- ${bullet}\n`
}

function appendUnique(values: string[] = [], next: string, limit = 10) {
  const normalized = next.trim()
  if (!normalized) return values.slice(0, limit)
  return [...values.filter((value) => value !== normalized), normalized].slice(-limit)
}

function compactList(values: string[] = [], limit = 3) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit).join("; ") || "pending"
}

function formatCharacterDossiersMarkdown(dossiers: CharacterDossier[]) {
  return [
    "# Character Dossiers",
    "",
    "This file is generated from the structured production character dossier state.",
    "",
    ...dossiers.slice(0, 12).map((dossier) => [
      `## ${dossier.canonicalName}`,
      `- id: ${dossier.id}`,
      `- role: ${dossier.role}`,
      `- aliases: ${dossier.aliases.join(", ") || "none"}`,
      `- identity and role: ${dossier.identityAndRole}`,
      `- core desire: ${dossier.coreDesire}`,
      `- fear or wound: ${dossier.fearOrWound}`,
      `- habits: ${compactList(dossier.behaviorHabits)}`,
      `- speech: ${compactList(dossier.speechMarkers)}`,
      `- relationship state: ${dossier.relationshipState}`,
      `- current chapter delta: ${dossier.currentChapterDelta}`,
      `- latest evidence: ${dossier.evidence.slice(-2).join(" | ") || "none"}`,
    ].join("\n")),
  ].join("\n\n")
}

function summarizeDossiersForContext(dossiers: CharacterDossier[] = [], limit = 3) {
  const selected = [
    ...dossiers.filter((dossier) => dossier.role === "protagonist"),
    ...dossiers.filter((dossier) => dossier.role !== "protagonist"),
  ].slice(0, limit)
  return selected.map((dossier) => [
    `- ${dossier.id} (${dossier.role}) name=${dossier.canonicalName}`,
    `  desire=${clipText(dossier.coreDesire, 90)}; wound=${clipText(dossier.fearOrWound, 90)}`,
    `  habit=${compactList(dossier.behaviorHabits, 2)}; speech=${compactList(dossier.speechMarkers, 2)}`,
    `  relation=${clipText(dossier.relationshipState, 120)}`,
    `  delta=${clipText(dossier.currentChapterDelta, 120)}`,
  ].join("\n")).join("\n")
}

function updateCharacterDossiersFromDiscussion(input: {
  dossiers: CharacterDossier[]
  targetKind: string
  message: string
  summary: string
  runId: string
}) {
  if (input.targetKind !== "character" && !/主角|角色|人物|性格|character|protagonist/i.test(input.message)) {
    return []
  }
  const updatedAt = new Date().toISOString()
  const evidence = `discussion ${input.runId}: ${input.message}`.slice(0, 240)
  const continuityNote = `discussion ${input.runId}: ${input.summary.replace(/\s+/g, " ").slice(0, 220)}`
  return input.dossiers.map((dossier) => {
    const isProtagonist = dossier.role === "protagonist" || dossier.id === "protagonist"
    if (!isProtagonist) return dossier
    return {
      ...dossier,
      currentChapterDelta: `discussion: ${input.message}`,
      continuityNotes: appendUnique(dossier.continuityNotes, continuityNote),
      evidence: appendUnique(dossier.evidence, evidence),
      updatedAt,
    }
  })
}

function sanitizeConsensusForDiscussion(consensus: string) {
  const blockedPatterns = [
    /option b/i,
    /what is your choice/i,
    /i am standing by/i,
    /type your ideas/i,
    /type "option b"/i,
    /the fast track/i,
    /the custom path/i,
    /cannot move to/i,
    /reply with/i,
    /system status/i,
    /current task/i,
    /word count/i,
    /plot progress/i,
    /character update/i,
    /draft chapter/i,
    /the creative process is now fully autonomous/i,
    /chapter\s+\d+/i,
    /第\s*\d+\s*章/u,
  ]

  const sanitizedLines = consensus
    .split("\n")
    .filter((line) => !blockedPatterns.some((pattern) => pattern.test(line)))

  return sanitizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function extractSummaryBullets(summary: string, limit = 8) {
  const bullets = summary
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .slice(0, limit)

  if (bullets.length > 0) {
    return bullets
  }

  const meaningful = summary
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("###"))
    .slice(0, 4)

  return meaningful.map((line) => `- ${line}`)
}

function buildCompactConsensus(state: AutonomousNovelState, latestSummary: string) {
  return [
    "# Global Consensus",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    `Current workflow stage: ${state.runtime.stage}`,
    "",
    "Confirmed truths:",
    "- 默认输出语言为简体中文。",
    "- 所有讨论必须与当前 workflow stage 保持同步。",
    "- 在未进入 drafting 前，不允许伪装成已经在写具体章节正文。",
    "",
    "Latest discussion summary:",
    ...extractSummaryBullets(latestSummary),
    "",
    "Current open areas:",
    ...state.reactSetup.unansweredQuestions.map((question) => `- ${question}`),
  ].join("\n")
}

function safeArtifactName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "discussion"
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

function discussionMessageParts(messageId: string, input: {
  role: string
  content: string
  discussionStage: string
  target: DiscussionTarget
  currentStage: AutonomousNovelState["runtime"]["stage"]
  createdAt: string
}): MessagePart[] {
  return [
    messagePart(messageId, 0, "markdown", { text: input.content }, input.createdAt),
    messagePart(messageId, 1, "json", {
      role: input.role,
      discussionStage: input.discussionStage,
      target: input.target,
      currentStage: input.currentStage,
      source: "discussion_agent_turn",
    }, input.createdAt),
  ]
}

async function writeDiscussionConsensusArchive(
  rootDir: string,
  input: {
    runId: string
    startedAt: string
    state: AutonomousNovelState
    target: DiscussionTarget
    message: string
    summary: string
    replies: Array<{ role: string; content: string }>
    transcriptRelativePath: string
    contextPacketRelativePath: string
  },
) {
  const consensusDir = workspacePath(rootDir, "consensus")
  const fileName = `discussion-${safeArtifactName(input.runId)}.md`
  const archivePath = path.join(consensusDir, fileName)
  await fs.mkdir(consensusDir, { recursive: true })

  const content = [
    "# Discussion Consensus Archive",
    "",
    `Run: ${input.runId}`,
    `Created at: ${input.startedAt}`,
    `Project: ${input.state.project.title}`,
    `Workflow stage: ${input.state.runtime.stage}`,
    `Target: ${input.target.label}`,
    `Asset: ${input.target.assetPath}`,
    `Transcript: ${input.transcriptRelativePath}`,
    `Context packet: ${input.contextPacketRelativePath}`,
    "",
    "## User Intent",
    "",
    input.message.trim(),
    "",
    "## Showrunner Final Consensus",
    "",
    input.summary.trim(),
    "",
    "## Agent Discussion Outputs",
    "",
    ...input.replies.flatMap((reply, index) => [
      `### ${index + 1}. ${reply.role}`,
      "",
      reply.content.trim(),
      "",
    ]),
  ].join("\n").replace(/\n{4,}/g, "\n\n\n")

  await fs.writeFile(archivePath, `${content.trim()}\n`)
  return {
    absolutePath: archivePath,
    relativePath: `.ai-novel/consensus/${fileName}`,
  }
}

function stageInstructionFor(state: AutonomousNovelState, target: DiscussionTarget) {
  if (state.runtime.stage === "worldbuilding_dialogue") {
    return `当前仍在世界观/设定讨论阶段。允许讨论 ${target.label}，但不允许声称已经进入章节正文写作、具体章次生产、后续弧线蓝图或全自动连续成稿。只能说“建议下一步推进”，不能说“已进入下一阶段”。`
  }

  if (state.runtime.stage === "setting_review") {
    return "当前在设定冻结阶段。允许整理和收敛设定，不允许直接写正文，也不允许宣称已进入主线规划、章节蓝图或某弧总体规划。只能提出下一步建议，不能替状态机宣布阶段跳转。"
  }

  if (state.runtime.stage === "master_planning" || state.runtime.stage === "chapter_task_generation") {
    return "当前在规划阶段。允许讨论主线、卷纲、章节蓝图，不允许伪装成已经完成正文写作；也不能宣称某阶段或某弧已经完成，除非系统状态和真实产物已经写回。"
  }

  if (state.runtime.stage === "drafting") {
    return "当前已进入 drafting。可以讨论正文推进、润色与审稿，但仍需和真实章节任务保持一致。"
  }

  return "所有输出都必须与当前工作流阶段严格保持一致。"
}

function detectDiscussionStageViolation(
  state: AutonomousNovelState,
  target: DiscussionTarget,
  text: string,
) {
  const reasons: string[] = []
  const currentStage = state.runtime.stage
  const combined = text.trim()
  const positiveClaimText = combined
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/(不允许|不能|不得|不要|不可|如果|风险|留到|等待|必须等待|只能|建议下一步|准备进入|可进入|避免|防止|除非|guardrail|risk)/i.test(line))
    .join("\n")

  if (!combined || currentStage === "drafting") {
    return { blocked: false, reason: "" }
  }

  const claimsCurrentDrafting = [
    /(当前阶段|当前状态)\s*[:：]?\s*(drafting|正文写作|writing|写作阶段)/i,
    /(当前已|已进入|已经进入|正式进入|现在进入)\s*[:：]?\s*(drafting|正文写作|writing|写作阶段)/i,
    /(阶段切换确认|设定收敛已完成|设定冻结已完成|规划已完成).{0,40}(进入|切换到|转入)\s*(drafting|正文写作|writing)\s*阶段?/i,
  ].some((pattern) => pattern.test(positiveClaimText))
  const claimsProducedDraft = /(本轮产出|已产出|产出|完成|生成)\s*[:：]?\s*第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,20}(初稿|草稿|正文)|第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,12}(初稿|草稿|正文).{0,20}(已完成|完成|生成|产出)/u.test(positiveClaimText)
  const hasChapterBodyHeading = /(^|\n)\s*(#{1,6}\s*)?第\s*[一二三四五六七八九十百千万\d]+\s*章\s*[·:：-]\s*\S{1,40}(\n|$)/u.test(positiveClaimText)
  const hasDraftBodyLabel = /(^|\n)\s*(正文|草稿正文|draft body)\s*[:：]\s*\S+/iu.test(positiveClaimText)
  const hasRuntimeStageCorrection = /STAGE_GUARD_CORRECTION:\s*true/i.test(combined)

  if (hasRuntimeStageCorrection) {
    reasons.push("模型原始输出触发运行时阶段纠偏，本轮不能写入生产共识。")
  }

  if (claimsCurrentDrafting) {
    reasons.push(`当前系统阶段是 ${currentStage}，但讨论输出宣称已经进入 drafting/正文写作。`)
  }

  if (claimsProducedDraft) {
    reasons.push("讨论输出宣称已经产出具体章节初稿，但生产章节只能由 drafting 阶段的章节流水线写入。")
  }

  if (hasChapterBodyHeading || hasDraftBodyLabel) {
    reasons.push("讨论输出出现章节正文标题或正文块，不能作为设定/规划阶段的正式产物写回。")
  }

  if (
    currentStage === "setting_review" &&
    /(当前已|已进入|进入|已经完成).{0,20}(master_planning|主线规划|章节蓝图|chapter_task_generation|总体规划|弧线蓝图)/i.test(positiveClaimText)
  ) {
    reasons.push("当前仍是设定冻结阶段，但讨论输出把主线规划或章节蓝图描述成既成状态。")
  }

  if (target.kind !== "chapter" && /第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,20}(目标|冲突|场景|开篇|结尾|钩子)/u.test(positiveClaimText)) {
    reasons.push("当前讨论目标不是章节蓝图，却输出了具体章次执行内容。")
  }

  return {
    blocked: reasons.length > 0,
    reason: reasons.join("；"),
  }
}

function buildStageGuardSummary(state: AutonomousNovelState, target: DiscussionTarget, reason: string) {
  return [
    "### 阶段守卫拦截",
    `- 当前系统阶段：${state.runtime.stage}`,
    `- 当前讨论目标：${target.label}`,
    `- 写回资产：${target.assetPath}`,
    `- 拦截原因：${reason}`,
    "",
    "### 处理结果",
    "- 本轮讨论原文只保留在 transcript，作为可审计记录。",
    "- 本轮内容不会写入 global consensus、memory 或生产章节产物。",
    "- 正式章节必须等待状态机进入 drafting，并由章节流水线写入 `.ai-novel/chapters/` 与 DB artifact。",
    "",
    "### Next Step",
    "- 回到当前阶段继续收敛设定/规划，或通过工作流推进生成主线规划和章节蓝图。",
  ].join("\n")
}

function buildAutonomousContext(state: AutonomousNovelState, target: DiscussionTarget) {
  const dossierBrief = summarizeDossiersForContext(state.memory?.characterDossiers || [])
  return [
    "# Autonomous Creation Mode",
    "",
    `Project title: ${state.project.title}`,
    `Core idea seed: ${state.project.idea}`,
    `Current workflow stage: ${state.runtime.stage}`,
    `Scoped target: ${target.label}`,
    `Write-back asset: ${target.assetPath}`,
    "",
    "Structured character dossier snapshot:",
    dossierBrief || "- no structured character dossiers available yet",
    "",
    "Autonomy rules:",
    "- Do not wait for the user to choose paths or options.",
    "- If details are missing, infer strong working assumptions from the title, genre cues, and current target.",
    "- Present assumptions, recommendations, and a converged decision directly.",
    "- The system is expected to take over the creative process and keep moving.",
    "- The canonical workflow state is the runtime stage above. Do not announce a different current stage unless the system snapshot has changed.",
    "- When proposing stage movement, phrase it as a recommendation for the next advance step, not as completed progress.",
    `- Stage guardrail: ${stageInstructionFor(state, target)}`,
  ].join("\n")
}

function clipText(value: string, maxLength: number) {
  const normalized = value.trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return normalized.slice(normalized.length - maxLength).trim()
}

function extractRecentTranscript(transcript: string, blockLimit = 3) {
  const blocks = transcript
    .split(/^##\s+/m)
    .map((block) => block.trim())
    .filter(Boolean)

  const userBlockIndexes: number[] = []
  blocks.forEach((block, index) => {
    if (/^User:/m.test(block)) {
      userBlockIndexes.push(index)
    }
  })
  const selected = new Set(userBlockIndexes.slice(-3))
  blocks.forEach((_, index) => {
    if (index >= blocks.length - blockLimit) {
      selected.add(index)
    }
  })

  return [...selected]
    .sort((left, right) => left - right)
    .map((index) => `## ${blocks[index]}`)
    .join("\n\n")
}

function buildContextPacketText(options: {
  state: AutonomousNovelState
  target: DiscussionTarget
  message: string
  consensus: string
  priorTranscript: string
  recalledMemory?: Array<{ kind?: unknown; content?: unknown; score?: unknown }>
  recalledKnowledge?: Array<{ chunk_type?: unknown; content?: unknown; score?: unknown; source?: unknown }>
}) {
  const recentTranscript = extractRecentTranscript(options.priorTranscript)
  const consensusBullets = extractSummaryBullets(options.consensus, 8)
  const dossierBrief = summarizeDossiersForContext(options.state.memory?.characterDossiers || [])
  const recalledMemory = options.recalledMemory?.length
    ? options.recalledMemory.map((item) => `- [${String(item.kind || "memory")}] ${clipText(String(item.content || ""), 360)} (score: ${Number(item.score || 0)})`)
    : ["- No database memory recall matched this turn yet."]
  const recalledKnowledge = options.recalledKnowledge?.length
    ? options.recalledKnowledge.map((item) => {
        const source = item.source && typeof item.source === "object" ? item.source as Record<string, unknown> : {}
        return `- [${String(item.chunk_type || "knowledge")}] ${clipText(String(item.content || ""), 360)} (source: ${String(source.path || "")}, score: ${Number(item.score || 0).toFixed(2)})`
      })
    : ["- No writing knowledge resources matched this turn yet."]

  return [
    "# Current Context Packet",
    "",
    "Context hierarchy:",
    "1. System/developer protocol and role prompts.",
    "2. Original project mission and workflow stage.",
    "3. Global consensus and committed facts.",
    "4. Recent discussion transcript and user interventions.",
    "5. Super Graph checkpoints, assets, and drift constraints.",
    "6. Current user message for this turn.",
    "",
    "Original mission:",
    `- Project: ${options.state.project.title}`,
    `- Idea: ${options.state.project.idea}`,
    `- Target chapters: ${options.state.plan.totalChapters}`,
    `- Chapter word target: ${options.state.plan.chapterWordTarget}`,
    "",
    "Workflow state:",
    `- Stage: ${options.state.runtime.stage}`,
    `- Last action: ${options.state.runtime.lastAction}`,
    `- Last route: ${options.state.runtime.lastRoute}`,
    `- Autopilot running: ${Boolean(options.state.runtime.autopilot?.running)}`,
    "",
    "Current discussion:",
    `- Target: ${options.target.label}`,
    `- Asset: ${options.target.assetPath}`,
    `- User message: ${options.message}`,
    "",
    "Consensus carryover:",
    ...(consensusBullets.length > 0 ? consensusBullets : ["- No compact consensus has been recorded yet."]),
    "",
    "Structured character dossier carryover:",
    dossierBrief || "- No structured character dossiers have been recorded yet.",
    "",
    "Memory/RAG recall:",
    ...recalledMemory,
    "",
    "Writing knowledge/RAG recall:",
    ...recalledKnowledge,
    "",
    "Recent transcript carryover:",
    recentTranscript || "No previous discussion transcript has been recorded yet.",
  ].join("\n")
}

async function writeCurrentContextPacket(rootDir: string, content: string) {
  const contextDir = workspacePath(rootDir, "context")
  const contextPath = path.join(contextDir, "current-context.md")
  await fs.mkdir(contextDir, { recursive: true })
  await fs.writeFile(contextPath, `${content.trim()}\n`)
  return contextPath
}

interface DiscussionOptions {
  envRootDir?: string
  factoryRootDir?: string
  projectId?: string
  runId?: string
  parentRunId?: string | null
  directorCommandId?: string | null
  signal?: AbortSignal
  onEvent?: (event: { role: string; content: string }) => void | Promise<void>
  onStreamEvent?: (
    event:
      | { type: "agent_start"; messageId?: string; turnId: string; role: string; timestamp?: string; phase?: string; statusText?: string; statusDetail?: string }
      | { type: "agent_delta"; messageId?: string; turnId: string; role: string; delta: string; timestamp?: string; phase?: string; statusText?: string; statusDetail?: string }
      | { type: "agent_complete"; messageId?: string; turnId: string; role: string; content: string; timestamp?: string; phase?: string; statusText?: string; statusDetail?: string }
      | { type: "agent_error"; messageId?: string; turnId: string; role: string; content: string; error: string; timestamp?: string; phase?: string; statusText?: string; statusDetail?: string },
  ) => void | Promise<void>
}

export interface DiscussionTarget {
  kind: "worldbuilding" | "character" | "plot" | "chapter" | "style"
  label: string
  assetPath: string
  instruction: string
}

function inferDiscussionTarget(message: string): DiscussionTarget {
  const normalized = message.toLowerCase()

  if (normalized.includes("第") && normalized.includes("章") || normalized.includes("chapter")) {
    return {
      kind: "chapter",
      label: "chapter blueprint discussion",
      assetPath: ".ai-novel/plans/chapter-blueprints/",
      instruction: "Discuss one chapter blueprint only. Do not draft full prose or invent unrelated chapter titles.",
    }
  }

  if (normalized.includes("主角") || normalized.includes("角色") || normalized.includes("character")) {
    return {
      kind: "character",
      label: "character design discussion",
      assetPath: ".ai-novel/memory/characters/core/protagonist.md",
      instruction: "Refine character setup, motivations, or relations only. Do not branch into unrelated world or chapter drafts.",
    }
  }

  if (normalized.includes("文风") || normalized.includes("语言") || normalized.includes("润色") || normalized.includes("style")) {
    return {
      kind: "style",
      label: "style guide discussion",
      assetPath: ".ai-novel/style/profile.md",
      instruction: "Refine style and voice only. Do not create new plot or chapter content.",
    }
  }

  if (normalized.includes("情节") || normalized.includes("剧情") || normalized.includes("主线") || normalized.includes("伏笔") || normalized.includes("大纲") || normalized.includes("plot")) {
    return {
      kind: "plot",
      label: "plot and outline discussion",
      assetPath: ".ai-novel/plans/master-outline.md",
      instruction: "Refine plot structure, outline beats, or foreshadowing only. Do not draft detached scenes.",
    }
  }

  return {
    kind: "worldbuilding",
    label: "worldbuilding discussion",
    assetPath: ".ai-novel/prompts/global-consensus.md",
    instruction: "Refine world rules, factions, and setting truths only. Stay on the same topic until consensus is reached.",
  }
}

function knowledgeSourceTypesForDiscussionTarget(target: DiscussionTarget) {
  if (target.kind === "style") {
    return ["vocabulary", "style_guide", "example", "quality_rule"]
  }
  if (target.kind === "chapter") {
    return ["vocabulary", "example", "style_guide", "chapter", "plan", "memory", "consensus", "quality_rule"]
  }
  if (target.kind === "plot") {
    return ["vocabulary", "example", "style_guide", "plan", "memory", "consensus", "quality_rule"]
  }
  if (target.kind === "character") {
    return ["vocabulary", "example", "style_guide", "memory", "consensus", "agent_guide"]
  }
  return ["vocabulary", "example", "style_guide", "quality_rule", "consensus", "agent_guide"]
}

export async function runMultiAgentDiscussion(rootDir: string, message: string, options: DiscussionOptions = {}) {
  throwIfStopped(options.signal)
  const statePath = workspacePath(rootDir, "state.json")
  const consensusPath = workspacePath(rootDir, "prompts", "global-consensus.md")
  const protagonistPath = workspacePath(rootDir, "memory", "characters", "core", "protagonist.md")
  const characterDossiersPath = workspacePath(rootDir, "memory", "characters", "dossiers.json")
  const characterDossiersMarkdownPath = workspacePath(rootDir, "memory", "characters", "dossiers.md")
  const styleProfilePath = workspacePath(rootDir, "style", "profile.md")
  const discussionDir = workspacePath(rootDir, "chat")
  const discussionLogPath = path.join(discussionDir, "discussion-log.md")

  await fs.mkdir(discussionDir, { recursive: true })

  const rawConsensus = await readText(consensusPath)
  const state = JSON.parse(await readText(statePath)) as AutonomousNovelState
  const discussionTarget = inferDiscussionTarget(message)
  const runId = options.runId ?? makeRunId("discussion")
  const factoryDb = options.factoryRootDir && options.projectId
    ? await FactoryDb.open(options.factoryRootDir)
    : null
  const priorTranscript = await readOptionalText(discussionLogPath)
  const sanitizedConsensus = sanitizeConsensusForDiscussion(rawConsensus)
  const autonomousContext = buildAutonomousContext(state, discussionTarget)
  const recalledMemory = factoryDb && options.projectId
    ? factoryDb.recallMemory(options.projectId, `${message}\n${discussionTarget.label}`, 6, {
        embedding: createLocalTextEmbedding(`${message}\n${discussionTarget.label}`),
      })
    : []
  const recalledKnowledge = options.factoryRootDir && options.projectId
    ? await retrieveKnowledge({
        rootDir: options.factoryRootDir,
        projectId: options.projectId,
        query: `${message}\n${discussionTarget.label}\n${state.project.idea}`,
        scopes: ["project", "global"],
        sourceTypes: knowledgeSourceTypesForDiscussionTarget(discussionTarget),
        limit: 6,
        runId,
        recordCitation: true,
      }).catch(() => [])
    : []
  const currentContextPacket = buildContextPacketText({
    state,
    target: discussionTarget,
    message,
    consensus: sanitizedConsensus,
    priorTranscript,
    recalledMemory,
    recalledKnowledge,
  })
  const contextPacketPath = await writeCurrentContextPacket(rootDir, currentContextPacket)
  const replies: Array<{ role: string; content: string }> = []
  const transcriptContext = [
    currentContextPacket,
    `Project: ${state.project.title}`,
    `Idea: ${state.project.idea}`,
    `Target: ${discussionTarget.label} -> ${discussionTarget.assetPath}`,
    `User: ${message}`,
  ]
  const storyCoreDossierBrief = summarizeDossiersForContext(state.memory?.characterDossiers || [])
  const transcriptStartedAt = new Date().toISOString()
  if (factoryDb && options.projectId) {
    factoryDb.createRun({
      id: runId,
      projectId: options.projectId,
      projectRoot: rootDir,
      parentRunId: options.parentRunId ?? null,
      kind: "discussion",
      status: "running",
      goal: message,
      stage: state.runtime.stage,
    })
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "context",
      path: ".ai-novel/context/current-context.md",
      status: "completed",
      metadata: { runId, target: discussionTarget, directorCommandId: options.directorCommandId ?? null },
    })
    factoryDb.recordEvent(options.projectId, runId, "DISCUSSION_STARTED", {
      message,
      target: discussionTarget,
      stage: state.runtime.stage,
      contextPacketPath,
      recalledMemoryCount: recalledMemory.length,
      recalledKnowledgeCount: recalledKnowledge.length,
      directorCommandId: options.directorCommandId ?? null,
    })
  }
  await fs.appendFile(
    discussionLogPath,
    [
      `## ${transcriptStartedAt}`,
      ...transcriptContext,
      "Status: in_progress",
      "",
    ].join("\n"),
  )

  async function runAgentTurn(
    agent: { id: string; label: string },
    discussionStage: "opening_brief" | "specialist_turn" | "closing_synthesis",
  ) {
    throwIfStopped(options.signal)
    const turnIndex = replies.length + 1
    const turnId = `${agent.id}-${turnIndex}`
    const dbTurnId = makeAgentTurnId(runId, agent.id, turnIndex)
    const messageId = `${dbTurnId}:message`
    const basePrompt = await readText(workspacePath(rootDir, "prompts", "agents", `${agent.id}.base.md`))
    const dynamicPrompt = await readText(workspacePath(rootDir, "prompts", "agents", `${agent.id}.dynamic.md`))
    factoryDb?.recordAgentTurn({
      runId,
      turnId: dbTurnId,
      role: agent.label,
      stage: discussionStage,
      status: "in_progress",
      input: {
        message,
        discussionTarget,
        currentStage: state.runtime.stage,
        priorTranscript: clipText(priorTranscript, 8000),
        contextPacketPath,
      },
    })
    await options.onStreamEvent?.({
      type: "agent_start",
      messageId,
      turnId,
      role: agent.label,
      timestamp: new Date().toISOString(),
      phase: "request_sent",
      statusText: "请求已送达 LLM，等待模型开始响应。",
      statusDetail: "这条 agent 消息会在模型返回内容时继续更新。",
    })
    let reply = ""
    try {
      // ── 分层上下文组装 ──────────────────────────────────────────────────────
      // Layer 1：小说核心（精简版，≤2000字），所有 Agent 共享
      const storyCoreBase = buildStoryCoreContext(state, sanitizedConsensus, discussionTarget, message)
      const dossierSection = storyCoreDossierBrief ? `\n\n结构化角色档案摘要：\n${storyCoreDossierBrief}` : ""
      const dossierBudget = Math.min(500, Math.floor(CONTEXT_BUDGET.story_core * 0.25))
      const baseBudget = CONTEXT_BUDGET.story_core - dossierBudget
      const compactStoryCoreBase = storyCoreBase.length > baseBudget
        ? `${storyCoreBase.slice(0, baseBudget)}\n…[核心层已截断]`
        : storyCoreBase
      const storyCoreCtx = dossierSection
        ? `${compactStoryCoreBase}${dossierSection.slice(0, dossierBudget)}`.slice(0, CONTEXT_BUDGET.story_core)
        : storyCoreBase
      // Layer 4：过滤后的历史（按角色差异化，独立视角专家为空）
      const historyCtx = buildHistoryForAgent(agent.id, discussionStage, replies, priorTranscript)
      console.log(
        `[CTX BUDGET] Agent: ${agent.label} | Stage: ${discussionStage}` +
        ` | StoryCore: ${storyCoreCtx.length}字` +
        ` | History: ${historyCtx.length}字` +
        ` | Base: ${basePrompt.length}字 | Dynamic: ${dynamicPrompt.length}字`,
      )
      // ────────────────────────────────────────────────────────────────────────
      reply = await generateAgentReply({
        roleName: agent.label,
        basePrompt,
        dynamicPrompt,
        consensus: storyCoreCtx,
        message,
        discussionStage,
        priorTranscript: historyCtx,
        discussionTarget,
        preferredLanguage: "zh-CN",
        currentStage: state.runtime.stage,
        stageInstruction: stageInstructionFor(state, discussionTarget),
        envRootDir: options.envRootDir ?? rootDir,
        signal: options.signal,
        onDelta: async (delta) => {
          await options.onStreamEvent?.({
            type: "agent_delta",
            messageId,
            turnId,
            role: agent.label,
            delta,
            phase: "streaming",
            statusText: "LLM 正在持续返回内容。",
            statusDetail: "返回内容会持续合并到这一条 agent 消息中。",
          })
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const failedAt = new Date().toISOString()
      factoryDb?.recordAgentTurn({
        runId,
        turnId: dbTurnId,
        role: agent.label,
        stage: discussionStage,
        status: "failed",
        input: { message, discussionTarget, currentStage: state.runtime.stage },
        error: errorMessage,
      })
      if (factoryDb && options.projectId) {
        factoryDb.recordMessage(
          createAgentMessage({
            messageId,
            conversationId: runId,
            projectId: options.projectId,
            runId,
            turnId: dbTurnId,
            agentLabel: agent.label,
            content: `LLM 请求失败：${errorMessage}`,
            status: "failed",
            phase: "failed",
            statusText: "LLM 请求失败，已记录错误。",
            statusDetail: errorMessage,
            time: failedAt,
            metadata: {
              discussionStage,
              target: discussionTarget,
              source: "discussion_agent_turn",
              error: errorMessage,
            },
          }),
          discussionMessageParts(messageId, {
            role: agent.label,
            content: `LLM 请求失败：${errorMessage}`,
            discussionStage,
            target: discussionTarget,
            currentStage: state.runtime.stage,
            createdAt: failedAt,
          }),
        )
      }
      await options.onStreamEvent?.({
        type: "agent_error",
        messageId,
        turnId,
        role: agent.label,
        content: `LLM 请求失败：${errorMessage}`,
        error: errorMessage,
        timestamp: failedAt,
        phase: "failed",
        statusText: "LLM 请求失败，已记录错误。",
        statusDetail: errorMessage,
      })
      throw error
    }

    replies.push({ role: agent.label, content: reply })
    const completedAt = new Date().toISOString()
    transcriptContext.push(`${agent.label}: ${reply}`)
    await fs.appendFile(
      discussionLogPath,
      [`## ${completedAt}`, `${agent.label}: ${reply}`, ""].join("\n"),
    )
    factoryDb?.recordAgentTurn({
      runId,
      turnId: dbTurnId,
      role: agent.label,
      stage: discussionStage,
      status: "completed",
      input: { message, discussionTarget, currentStage: state.runtime.stage },
      output: reply,
    })
    if (factoryDb && options.projectId) {
      factoryDb.recordMessage(
        createAgentMessage({
          messageId,
          conversationId: runId,
          projectId: options.projectId,
          runId,
          turnId: dbTurnId,
          agentLabel: agent.label,
          content: reply,
          status: "completed",
          time: completedAt,
          metadata: {
            discussionStage,
            target: discussionTarget,
            source: "discussion_agent_turn",
          },
        }),
        discussionMessageParts(messageId, {
          role: agent.label,
          content: reply,
          discussionStage,
          target: discussionTarget,
          currentStage: state.runtime.stage,
          createdAt: completedAt,
        }),
      )
    }
    await options.onStreamEvent?.({
      type: "agent_complete",
      messageId,
      turnId,
      role: agent.label,
      content: reply,
      timestamp: completedAt,
      phase: "completed",
      statusText: "LLM 返回完成，内容已保存。",
    })
    await options.onEvent?.({ role: agent.label, content: reply })
    return reply
  }

  const showrunner = AGENT_FLOW[0]
  let synthesisReply = ""
  try {
    await runAgentTurn(showrunner, "opening_brief")

    for (const agent of SPECIALIST_FLOW) {
      await runAgentTurn(agent, "specialist_turn")
    }

    synthesisReply = await runAgentTurn(showrunner, "closing_synthesis")
    await fs.appendFile(discussionLogPath, "Status: complete\n\n")
    factoryDb?.updateRun(runId, "completed")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await fs.appendFile(discussionLogPath, `Status: error\nError: ${message}\n\n`)
    factoryDb?.updateRun(runId, "failed", { error: message })
    throw error
  }

  const showrunnerReply = synthesisReply
  const stageGuard = detectDiscussionStageViolation(
    state,
    discussionTarget,
    [
      message,
      ...replies.map((reply) => `${reply.role}: ${reply.content}`),
      showrunnerReply,
    ].join("\n\n"),
  )
  const guardedSummary = stageGuard.blocked
    ? buildStageGuardSummary(state, discussionTarget, stageGuard.reason)
    : showrunnerReply
  const protagonistUpdate = message.includes("主角") ? message : `Protagonist note: ${message}`

  if (stageGuard.blocked) {
    state.runtime.lastRoute = discussionTarget.kind
    state.runtime.lastAction = `discussion_guard_blocked:${discussionTarget.kind}`
    state.runtime.statusMessage = `讨论输出被阶段守卫拦截，未写入生产共识：${stageGuard.reason}`
    await fs.appendFile(discussionLogPath, `Stage Guard: blocked\nReason: ${stageGuard.reason}\n\n`)
    await saveAutonomousState(rootDir, state)
    if (factoryDb && options.projectId) {
      factoryDb.updateProjectState(options.projectId, state)
      factoryDb.recordArtifact({
        projectId: options.projectId,
        kind: "transcript",
        path: ".ai-novel/chat/discussion-log.md",
        status: "completed",
        metadata: { runId, target: discussionTarget, stageGuard: "blocked", directorCommandId: options.directorCommandId ?? null },
      })
      factoryDb.recordEvent(options.projectId, runId, "DISCUSSION_STAGE_GUARD_BLOCKED", {
        target: discussionTarget,
        stage: state.runtime.stage,
        reason: stageGuard.reason,
        transcriptPath: discussionLogPath,
        contextPacketPath,
        directorCommandId: options.directorCommandId ?? null,
      })
      factoryDb.updateRun(runId, "blocked", { error: stageGuard.reason })
    }

    try {
      return {
        runId,
        target: discussionTarget,
        replies,
        transcriptPath: discussionLogPath,
        contextPacketPath,
        summary: guardedSummary,
        stageGuard: {
          status: "blocked" as const,
          reason: stageGuard.reason,
          rawSummary: showrunnerReply,
        },
        writebackSkipped: true,
      }
    } finally {
      factoryDb?.close()
    }
  }

  const updatedConsensus = buildCompactConsensus(state, guardedSummary)
  const currentProtagonist = await readText(protagonistPath)
  const updatedProtagonist = appendSection(currentProtagonist, "Discussion updates", protagonistUpdate)
  const currentDossiers = state.memory?.characterDossiers?.length
    ? state.memory.characterDossiers
    : await readCharacterDossiers(characterDossiersPath)
  const updatedDossiers = updateCharacterDossiersFromDiscussion({
    dossiers: currentDossiers,
    targetKind: discussionTarget.kind,
    message,
    summary: guardedSummary,
    runId,
  })
  if (updatedDossiers.length) {
    state.memory = {
      ...(state.memory || {}),
      characterDossiers: updatedDossiers,
    }
  }

  const currentStyle = await readText(styleProfilePath)
  const updatedStyle = appendSection(
    currentStyle,
    "Discussion-driven adjustments",
    "当前讨论强调更像人写的中文表达，以及严格遵守当前 workflow 阶段。",
  )
  const consensusArchive = await writeDiscussionConsensusArchive(rootDir, {
    runId,
    startedAt: transcriptStartedAt,
    state,
    target: discussionTarget,
    message,
    summary: guardedSummary,
    replies,
    transcriptRelativePath: ".ai-novel/chat/discussion-log.md",
    contextPacketRelativePath: ".ai-novel/context/current-context.md",
  })

  state.runtime.lastRoute = discussionTarget.kind
  state.runtime.lastAction = `discussion:${discussionTarget.kind}`
  state.runtime.statusMessage = `已完成${discussionTarget.label}，共识已写回 ${discussionTarget.assetPath}。`

  await fs.writeFile(consensusPath, updatedConsensus)
  await fs.writeFile(protagonistPath, updatedProtagonist)
  if (updatedDossiers.length) {
    await writeJsonFileAtomic(characterDossiersPath, updatedDossiers)
    await fs.writeFile(characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown(updatedDossiers)}\n`)
  }
  await fs.writeFile(styleProfilePath, updatedStyle)
  await saveAutonomousState(rootDir, state)
  if (factoryDb && options.projectId) {
    factoryDb.updateProjectState(options.projectId, state)
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "transcript",
      path: ".ai-novel/chat/discussion-log.md",
      status: "completed",
      metadata: { runId, target: discussionTarget, consensusArchivePath: consensusArchive.relativePath, directorCommandId: options.directorCommandId ?? null },
    })
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: targetToArtifactKind(discussionTarget),
      path: discussionTarget.assetPath,
      status: "completed",
      metadata: { runId, summary: guardedSummary, directorCommandId: options.directorCommandId ?? null },
    })
    if (updatedDossiers.length) {
      factoryDb.recordArtifact({
        projectId: options.projectId,
        kind: "memory",
        path: ".ai-novel/memory/characters/dossiers.json",
        status: "completed",
        metadata: { runId, target: discussionTarget, source: "discussion_writeback", directorCommandId: options.directorCommandId ?? null },
      })
    }
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "consensus",
      path: ".ai-novel/prompts/global-consensus.md",
      status: "completed",
      metadata: { runId, latestArchivePath: consensusArchive.relativePath, directorCommandId: options.directorCommandId ?? null },
    })
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "consensus",
      path: consensusArchive.relativePath,
      status: "completed",
      metadata: {
        runId,
        target: discussionTarget,
        source: "discussion_archive",
        transcriptPath: ".ai-novel/chat/discussion-log.md",
        contextPacketPath: ".ai-novel/context/current-context.md",
        directorCommandId: options.directorCommandId ?? null,
      },
    })
    const memoryId = factoryDb.recordMemory(options.projectId, {
      source: `discussion:${runId}`,
      kind: discussionTarget.kind,
      content: guardedSummary,
      importance: 3,
      metadata: { target: discussionTarget },
    })
    factoryDb.upsertEmbedding(options.projectId, {
      ownerKind: "memory",
      ownerId: memoryId,
      model: "local-hash-v1",
      vector: createLocalTextEmbedding(guardedSummary),
    })
    factoryDb.recordEvent(options.projectId, runId, "CONSENSUS_UPDATED", {
      target: discussionTarget,
      transcriptPath: discussionLogPath,
      contextPacketPath,
      consensusArchivePath: consensusArchive.relativePath,
      directorCommandId: options.directorCommandId ?? null,
    })
  }

  try {
    await upsertDiscussionInSuperGraph(rootDir, {
      target: discussionTarget,
      summary: guardedSummary,
      transcriptPath: discussionLogPath,
    }, {
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId,
    })
  } catch {
    // Existing workspaces may not have a graph yet; graph repair can run later.
  }

  try {
    return {
      runId,
      target: discussionTarget,
      replies,
      transcriptPath: discussionLogPath,
      contextPacketPath,
      consensusArchivePath: consensusArchive.absolutePath,
      summary: guardedSummary,
      stageGuard: {
        status: "ok" as const,
        reason: "",
      },
      writebackSkipped: false,
    }
  } finally {
    factoryDb?.close()
  }
}
