import fs from "node:fs/promises"
import path from "node:path"

import { generateAgentReply } from "./runtime-llm"
import type { AutonomousNovelState } from "./cli-types"

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

function appendSection(current: string, heading: string, bullet: string) {
  if (current.includes(heading)) {
    return `${current.trimEnd()}\n- ${bullet}\n`
  }

  return `${current.trimEnd()}\n\n${heading}\n- ${bullet}\n`
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

function stageInstructionFor(state: AutonomousNovelState, target: DiscussionTarget) {
  if (state.runtime.stage === "worldbuilding_dialogue") {
    return `当前仍在世界观/设定讨论阶段。允许讨论 ${target.label}，但不允许声称已经进入章节正文写作、具体章次生产或全自动连续成稿。`
  }

  if (state.runtime.stage === "setting_review") {
    return "当前在设定冻结阶段。允许整理和收敛设定，不允许直接写正文。"
  }

  if (state.runtime.stage === "master_planning" || state.runtime.stage === "chapter_task_generation") {
    return "当前在规划阶段。允许讨论主线、卷纲、章节蓝图，不允许伪装成已经完成正文写作。"
  }

  if (state.runtime.stage === "drafting") {
    return "当前已进入 drafting。可以讨论正文推进、润色与审稿，但仍需和真实章节任务保持一致。"
  }

  return "所有输出都必须与当前工作流阶段严格保持一致。"
}

function buildAutonomousContext(state: AutonomousNovelState, target: DiscussionTarget) {
  return [
    "# Autonomous Creation Mode",
    "",
    `Project title: ${state.project.title}`,
    `Core idea seed: ${state.project.idea}`,
    `Current workflow stage: ${state.runtime.stage}`,
    `Scoped target: ${target.label}`,
    `Write-back asset: ${target.assetPath}`,
    "",
    "Autonomy rules:",
    "- Do not wait for the user to choose paths or options.",
    "- If details are missing, infer strong working assumptions from the title, genre cues, and current target.",
    "- Present assumptions, recommendations, and a converged decision directly.",
    "- The system is expected to take over the creative process and keep moving.",
    `- Stage guardrail: ${stageInstructionFor(state, target)}`,
  ].join("\n")
}

interface DiscussionOptions {
  onEvent?: (event: { role: string; content: string }) => void | Promise<void>
  onStreamEvent?: (
    event:
      | { type: "agent_start"; turnId: string; role: string }
      | { type: "agent_delta"; turnId: string; role: string; delta: string }
      | { type: "agent_complete"; turnId: string; role: string; content: string },
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

export async function runMultiAgentDiscussion(rootDir: string, message: string, options: DiscussionOptions = {}) {
  const statePath = workspacePath(rootDir, "state.json")
  const consensusPath = workspacePath(rootDir, "prompts", "global-consensus.md")
  const protagonistPath = workspacePath(rootDir, "memory", "characters", "core", "protagonist.md")
  const styleProfilePath = workspacePath(rootDir, "style", "profile.md")
  const discussionDir = workspacePath(rootDir, "chat")
  const discussionLogPath = path.join(discussionDir, "discussion-log.md")

  await fs.mkdir(discussionDir, { recursive: true })

  const rawConsensus = await readText(consensusPath)
  const state = JSON.parse(await readText(statePath)) as AutonomousNovelState
  const discussionTarget = inferDiscussionTarget(message)
  const sanitizedConsensus = sanitizeConsensusForDiscussion(rawConsensus)
  const autonomousContext = buildAutonomousContext(state, discussionTarget)
  const replies: Array<{ role: string; content: string }> = []
  const transcriptContext = [
    `Project: ${state.project.title}`,
    `Idea: ${state.project.idea}`,
    `Target: ${discussionTarget.label} -> ${discussionTarget.assetPath}`,
    `User: ${message}`,
  ]

  async function runAgentTurn(
    agent: { id: string; label: string },
    discussionStage: "opening_brief" | "specialist_turn" | "closing_synthesis",
  ) {
    const turnId = `${agent.id}-${replies.length + 1}`
    const basePrompt = await readText(workspacePath(rootDir, "prompts", "agents", `${agent.id}.base.md`))
    const dynamicPrompt = await readText(workspacePath(rootDir, "prompts", "agents", `${agent.id}.dynamic.md`))
    await options.onStreamEvent?.({
      type: "agent_start",
      turnId,
      role: agent.label,
    })
    const reply = await generateAgentReply({
      roleName: agent.label,
      basePrompt,
      dynamicPrompt,
      consensus: [autonomousContext, sanitizedConsensus].filter(Boolean).join("\n\n"),
      message,
      discussionStage,
      priorTranscript: transcriptContext.join("\n"),
      discussionTarget,
      preferredLanguage: "zh-CN",
      currentStage: state.runtime.stage,
      stageInstruction: stageInstructionFor(state, discussionTarget),
      onDelta: async (delta) => {
        await options.onStreamEvent?.({
          type: "agent_delta",
          turnId,
          role: agent.label,
          delta,
        })
      },
    })

    replies.push({ role: agent.label, content: reply })
    transcriptContext.push(`${agent.label}: ${reply}`)
    await options.onStreamEvent?.({
      type: "agent_complete",
      turnId,
      role: agent.label,
      content: reply,
    })
    await options.onEvent?.({ role: agent.label, content: reply })
    return reply
  }

  const showrunner = AGENT_FLOW[0]
  await runAgentTurn(showrunner, "opening_brief")

  for (const agent of SPECIALIST_FLOW) {
    await runAgentTurn(agent, "specialist_turn")
  }

  const synthesisReply = await runAgentTurn(showrunner, "closing_synthesis")

  const transcriptBlock = [
    `## ${new Date().toISOString()}`,
    ...transcriptContext,
    "",
  ].join("\n")

  await fs.appendFile(discussionLogPath, transcriptBlock)

  const showrunnerReply = synthesisReply
  const protagonistUpdate = message.includes("主角") ? message : `Protagonist note: ${message}`

  const updatedConsensus = buildCompactConsensus(state, showrunnerReply)
  const currentProtagonist = await readText(protagonistPath)
  const updatedProtagonist = appendSection(currentProtagonist, "Discussion updates", protagonistUpdate)

  const currentStyle = await readText(styleProfilePath)
  const updatedStyle = appendSection(
    currentStyle,
    "Discussion-driven adjustments",
    "当前讨论强调更像人写的中文表达，以及严格遵守当前 workflow 阶段。",
  )

  state.runtime.lastRoute = discussionTarget.kind
  state.runtime.lastAction = `discussion:${discussionTarget.kind}`
  state.runtime.statusMessage = `正在围绕${discussionTarget.label}进行讨论，并等待把共识写回 ${discussionTarget.assetPath}。`

  await fs.writeFile(consensusPath, updatedConsensus)
  await fs.writeFile(protagonistPath, updatedProtagonist)
  await fs.writeFile(styleProfilePath, updatedStyle)
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)

  return {
    target: discussionTarget,
    replies,
    transcriptPath: discussionLogPath,
    summary: showrunnerReply,
  }
}
