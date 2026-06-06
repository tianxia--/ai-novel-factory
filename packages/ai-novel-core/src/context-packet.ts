import fs from "node:fs/promises"
import path from "node:path"

import type { AutonomousNovelState } from "./cli-types"

export function getContextFocusForStage(stage: AutonomousNovelState["runtime"]["stage"]) {
  switch (stage) {
    case "worldbuilding_dialogue":
      return {
        target: "worldbuilding discussion",
        asset: ".ai-novel/prompts/global-consensus.md",
      }
    case "setting_review":
      return {
        target: "setting review",
        asset: ".ai-novel/plans/setting-freeze.md",
      }
    case "master_planning":
      return {
        target: "master planning",
        asset: ".ai-novel/plans/master-outline.md",
      }
    case "chapter_task_generation":
      return {
        target: "chapter blueprint planning",
        asset: ".ai-novel/plans/chapter-blueprints/",
      }
    case "drafting":
      return {
        target: "chapter drafting",
        asset: ".ai-novel/chapters/",
      }
    case "reviewing":
      return {
        target: "chapter quality review",
        asset: ".ai-novel/reports/",
      }
    case "replanning":
      return {
        target: "replanning",
        asset: ".ai-novel/reports/interruptions.log.md",
      }
    case "complete":
      return {
        target: "completed production review",
        asset: ".ai-novel/chapters/",
      }
    default:
      return {
        target: "workflow",
        asset: ".ai-novel/",
      }
  }
}

export function syncContextPacketStateText(
  current: string,
  state: AutonomousNovelState,
) {
  if (!current.includes("Workflow state:")) {
    return current
  }
  const focus = getContextFocusForStage(state.runtime.stage)
  return current
    .replace(/^- Stage: .*$/m, `- Stage: ${state.runtime.stage}`)
    .replace(/^- Last action: .*$/m, `- Last action: ${state.runtime.lastAction}`)
    .replace(/^- Last route: .*$/m, `- Last route: ${state.runtime.lastRoute}`)
    .replace(/^- Autopilot running: .*$/m, `- Autopilot running: ${Boolean(state.runtime.autopilot?.running)}`)
    .replace(/^- Target: .*$/m, `- Target: ${focus.target}`)
    .replace(/^- Asset: .*$/m, `- Asset: ${focus.asset}`)
}

export function createCurrentContextPacketText(state: AutonomousNovelState) {
  const focus = getContextFocusForStage(state.runtime.stage)
  return [
    "# Current Context Packet",
    "",
    "Context hierarchy:",
    "1. System/developer protocol and role prompts.",
    "2. Original project mission and workflow stage.",
    "3. Global consensus and committed facts.",
    "4. Recent discussion transcript and user interventions.",
    "5. Super Graph checkpoints, assets, and drift constraints.",
    "6. Current user message or background worker instruction.",
    "",
    "Original mission:",
    `- Project: ${state.project.title}`,
    `- Idea: ${state.project.idea}`,
    `- Target chapters: ${state.plan.totalChapters}`,
    `- Chapter word target: ${state.plan.chapterWordTarget}`,
    "",
    "Workflow state:",
    `- Stage: ${state.runtime.stage}`,
    `- Last action: ${state.runtime.lastAction}`,
    `- Last route: ${state.runtime.lastRoute}`,
    `- Autopilot running: ${Boolean(state.runtime.autopilot?.running)}`,
    `- Target: ${focus.target}`,
    `- Asset: ${focus.asset}`,
    "",
    "Consensus carryover:",
    "- No compact consensus has been recorded yet.",
    "",
    "Memory/RAG recall:",
    "- No database memory recall matched this turn yet.",
  ].join("\n")
}

export async function syncCurrentContextPacketFile(
  projectRoot: string,
  state: AutonomousNovelState,
) {
  const contextPath = path.join(projectRoot, ".ai-novel", "context", "current-context.md")
  const current = await fs.readFile(contextPath, "utf8").catch(() => "")
  if (!current) {
    await fs.mkdir(path.dirname(contextPath), { recursive: true })
    await fs.writeFile(contextPath, `${createCurrentContextPacketText(state)}\n`)
    return
  }
  const next = syncContextPacketStateText(current, state)
  if (next === current) {
    return
  }
  await fs.writeFile(contextPath, next.endsWith("\n") ? next : `${next}\n`)
}
