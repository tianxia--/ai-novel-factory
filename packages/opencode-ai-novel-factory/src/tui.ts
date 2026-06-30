import readline from "node:readline"
import fs from "node:fs/promises"
import path from "node:path"

import { loadAutonomousState } from "ai-novel-core"
import type { AutonomousNovelState } from "ai-novel-core"
import { executeComposerAction, parseComposerInput } from "./tui-controller"

interface RenderOptions {
  draftInput?: string
  recentDiscussion?: string[]
  liveDiscussion?: string[]
  systemNote?: string | null
}

function padLine(value: string, width: number) {
  if (value.length >= width) {
    return value.slice(0, width)
  }

  return value + " ".repeat(width - value.length)
}

function borderLine(width: number) {
  return `+${"-".repeat(width - 2)}+`
}

function boxLine(content: string, width: number) {
  return `|${padLine(content, width - 2)}|`
}

function formatTaskLine(task: AutonomousNovelState["plan"]["chapterTasks"][number]) {
  return `#${task.chapterNumber} ${task.title} [${task.status}] ${task.targetWords}w`
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function getRoutedChatMetadata(state: AutonomousNovelState) {
  const runtime = (state.runtime ?? {}) as Record<string, unknown>
  const runtimeMetaCandidates = [
    runtime.chatMeta,
    runtime.lastChat,
    runtime.lastRouting,
    runtime.routing,
  ] as Array<Record<string, unknown> | undefined>

  const lastRoute = pickFirstString(
    runtime.lastRoute,
    ...runtimeMetaCandidates.map((candidate) => candidate?.lastRoute),
    ...runtimeMetaCandidates.map((candidate) => candidate?.route),
    ...runtimeMetaCandidates.map((candidate) => candidate?.type),
    state.runtime.lastInterruption ? "interruption_change" : null,
  )

  const lastAction = pickFirstString(
    runtime.lastAction,
    ...runtimeMetaCandidates.map((candidate) => candidate?.lastAction),
    ...runtimeMetaCandidates.map((candidate) => candidate?.action),
    state.runtime.lastInterruption?.recommendedAction,
    state.runtime.statusMessage,
  )

  return {
    lastRoute: lastRoute ?? "unknown",
    lastAction: lastAction ?? "none",
  }
}

function renderTuiScreenWithDiscussion(state: AutonomousNovelState, options: RenderOptions = {}) {
  const width = 94
  const pendingTasks = state.plan.chapterTasks
    .filter((task) => task.status !== "complete")
    .slice(0, 6)
  const recentDiscussion = options.recentDiscussion ?? []
  const liveDiscussion = options.liveDiscussion ?? []
  const draftInput = options.draftInput ?? ""
  const chatMetadata = getRoutedChatMetadata(state)
  const providerCheck = state.runtime.lastProviderCheck
    ? state.runtime.lastProviderCheck.ok
      ? `ok @ ${state.runtime.lastProviderCheck.checkedAt.slice(11, 19)}`
      : `failed @ ${state.runtime.lastProviderCheck.checkedAt.slice(11, 19)}`
    : "untested"

  const storyMemory = [
    `Idea: ${state.project.idea}`,
    `Open Q1: ${state.reactSetup.unansweredQuestions[0] || "none"}`,
    `Open Q2: ${state.reactSetup.unansweredQuestions[1] || "none"}`,
    `Open Q3: ${state.reactSetup.unansweredQuestions[2] || "none"}`,
  ]

  const workflowControl = [
    `Stage: ${state.runtime.stage}`,
    `Status: ${state.runtime.statusMessage}`,
    `Cover prep: ${state.assets.cover.status}`,
    `Comic prep: ${state.assets.comic.status}`,
    "Provider config: settings/database",
    `Provider test: ${providerCheck}`,
    `Last route: ${chatMetadata.lastRoute}`,
    `Last action: ${chatMetadata.lastAction}`,
  ]

  const composerLines = [
    "Type in the live prompt below the dashboard. Enter sends one line.",
    "Commands: /advance /cover /provider-test /interrupt ...",
    "Model providers are managed in settings.",
    draftInput ? `Last input: ${draftInput}` : "Last input: none yet",
  ]

  const lines = [
    borderLine(width),
    boxLine("AI Novel Factory TUI", width),
    borderLine(width),
    boxLine(`Project: ${state.project.title}`, width),
    boxLine(`Target chapters: ${state.plan.totalChapters} | Chapter word target: ${state.plan.chapterWordTarget}`, width),
    boxLine(`Cover: ${state.assets.cover.status} | Comic: ${state.assets.comic.status}`, width),
    borderLine(width),
    boxLine("Story Memory", width),
    ...storyMemory.map((line) => boxLine(line, width)),
    borderLine(width),
    boxLine("Workflow Control", width),
    ...workflowControl.map((line) => boxLine(line, width)),
    borderLine(width),
    boxLine("Pending chapter tasks", width),
    ...pendingTasks.map((task) => boxLine(formatTaskLine(task), width)),
    ...(pendingTasks.length === 0 ? [boxLine("All chapter tasks completed.", width)] : []),
    borderLine(width),
    boxLine("Recent discussion", width),
    ...(recentDiscussion.length > 0
      ? recentDiscussion.map((line) => boxLine(line, width))
      : [boxLine("No discussion yet.", width)]),
    borderLine(width),
    boxLine("Live agent stream", width),
    ...(liveDiscussion.length > 0
      ? liveDiscussion.map((line) => boxLine(line, width))
      : [boxLine("No live agent stream right now.", width)]),
    borderLine(width),
    ...(state.runtime.lastProviderCheck
      ? [boxLine(`Provider note: ${state.runtime.lastProviderCheck.message}`, width), borderLine(width)]
      : []),
    ...(options.systemNote
      ? [boxLine(`System note: ${options.systemNote}`, width), borderLine(width)]
      : []),
    boxLine("Composer", width),
    ...composerLines.map((line) => boxLine(line, width)),
    borderLine(width),
    boxLine("Exit: Ctrl+C | Use plain text for chat or slash commands for control", width),
    borderLine(width),
  ]

  return lines.join("\n")
}

export function renderTuiScreen(state: AutonomousNovelState, options?: RenderOptions) {
  return renderTuiScreenWithDiscussion(state, options)
}

export function isComposerSubmitKey(str: string, key: { name?: string }) {
  return key.name === "return" || key.name === "enter" || /[\r\n]/.test(str)
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H")
}

async function loadRecentDiscussion(rootDir: string) {
  try {
    const content = await fs.readFile(path.join(rootDir, ".ai-novel", "chat", "discussion-log.md"), "utf8")
    const rolePattern = /^(User|Showrunner|World Architect|Author|Editor|Reviewer|Prose Stylist):\s*(.*)$/
    const sections = content
      .trim()
      .split(/^## /m)
      .map((section) => section.trim())
      .filter(Boolean)

    if (sections.length === 0) {
      return ["No discussion yet."]
    }

    const entries = sections.flatMap((section) => {
      const sectionLines = section
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      const timestamp = sectionLines[0] || ""
      return sectionLines
        .slice(1)
        .filter((line) => rolePattern.test(line))
        .map((line) => ({ timestamp, line }))
    })

    const recentEntries = entries.slice(-8)
    const lines = recentEntries.flatMap((entry) => [
      entry.timestamp ? `When: ${entry.timestamp}` : "",
      entry.line,
    ]).filter(Boolean)

    return lines.length > 0 ? lines : ["No discussion yet."]
  } catch {
    return ["No discussion yet."]
  }
}

export async function runTui(rootDir: string, options?: { once?: boolean }) {
  let lastInput = ""
  let systemNote: string | null = null
  let liveDiscussion: string[] = []

  const render = async () => {
    const state = await loadAutonomousState(rootDir)
    const recentDiscussion = await loadRecentDiscussion(rootDir)
    const screen = renderTuiScreenWithDiscussion(state, {
      draftInput: lastInput,
      recentDiscussion,
      liveDiscussion,
      systemNote,
    })
    clearScreen()
    process.stdout.write(`${screen}\n`)
  }

  await render()
  if (options?.once) {
    return
  }

  if (!process.stdin.isTTY) {
    throw new Error("Interactive TUI requires a TTY terminal.")
  }

  return new Promise<void>((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      prompt: "> ",
    })

    let busy = false

    const cleanup = () => {
      rl.close()
      process.stdout.write("\n")
    }

    const rerenderWithPrompt = async () => {
      await render()
      rl.prompt(true)
    }

    const submitComposer = async (input: string) => {
      const action = parseComposerInput(input)
      if (!action) {
        systemNote = "Composer is empty."
        await rerenderWithPrompt()
        return
      }

      liveDiscussion = []
      const result = await executeComposerAction(rootDir, action, {
        onStream: async (event) => {
          liveDiscussion = [...liveDiscussion.slice(-5), `${event.role}: ${event.content}`]
          systemNote = `Streaming reply from ${event.role}...`
          await rerenderWithPrompt()
        },
      })
      lastInput = input.trim()
      systemNote = result.summary
      await rerenderWithPrompt()
    }

    rl.on("line", async (line) => {
      if (busy) {
        return
      }

      const trimmed = line.trim()
      if (trimmed === "/quit" || trimmed === "/exit") {
        cleanup()
        resolve()
        return
      }

      busy = true
      try {
        await submitComposer(line)
      } catch (error) {
        cleanup()
        reject(error)
        return
      } finally {
        busy = false
      }
    })

    rl.on("SIGINT", () => {
      cleanup()
      resolve()
    })

    rl.on("close", () => {
      resolve()
    })

    rl.prompt()
  })
}
