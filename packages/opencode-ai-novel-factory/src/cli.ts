#!/usr/bin/env node

import {
  executeManualAdvanceCommand,
  executeManualInterruptCommand,
  formatStatus,
  getWorkspaceSummary,
  initAutonomousProject,
  listAutonomousProjects,
  loadAutonomousState,
  prepareCoverGeneration,
  resolveManagedProjectRoot,
  saveAutonomousState,
  runMultiAgentDiscussion,
  routeUserMessage,
  testProviderConnectivity,
} from "ai-novel-core"
import { runTui } from "./tui"

function printHelp() {
  console.log(`ai-novel CLI

Usage:
  ai-novel init --idea "..." [--chapters 120] [--chapter-words 2500] [--title "Novel title"]
  ai-novel status
  ai-novel advance
  ai-novel cover
  ai-novel provider-test
  ai-novel chat --message "..."
  ai-novel interrupt --message "..."
  ai-novel tui [--once]
`)
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv
  const flags: Record<string, string> = {}

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith("--")) {
      continue
    }

    const key = token.slice(2)
    const next = rest[index + 1]
    if (!next || next.startsWith("--")) {
      flags[key] = "true"
      continue
    }

    flags[key] = next
    index += 1
  }

  return { command, flags }
}

async function loadCliProjectContext(rootDir: string, flags: Record<string, string> = {}) {
  try {
    return {
      project: null,
      projectRoot: rootDir,
      state: await loadAutonomousState(rootDir),
    }
  } catch (error) {
    if ((error as Error & { code?: string })?.code !== "ENOENT") {
      throw error
    }
  }

  const projects = await listAutonomousProjects(rootDir)
  if (projects.length === 0) {
    throw new Error("No AI Novel Factory project found. Run `ai-novel init --idea \"...\"` first.")
  }

  const requestedProjectId = flags["project-id"] || flags.projectId || flags.project
  const project = requestedProjectId
    ? projects.find((entry) => entry.id === requestedProjectId)
    : projects[0]

  if (!project) {
    throw new Error(`Project '${requestedProjectId}' not found. Available projects: ${projects.map((entry) => entry.id).join(", ")}`)
  }

  const projectRoot = await resolveManagedProjectRoot(rootDir, project.id)
  return {
    project,
    projectRoot,
    state: await loadAutonomousState(projectRoot),
  }
}

async function run() {
  const { command, flags } = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()

  switch (command) {
    case "init": {
      const idea = flags.idea?.trim()
      if (!idea) {
        throw new Error("`ai-novel init` requires `--idea`.")
      }

      const totalChapters = Number.parseInt(flags.chapters || "24", 10)
      if (!Number.isFinite(totalChapters) || totalChapters <= 0) {
        throw new Error("`--chapters` must be a positive integer.")
      }

      const chapterWordTarget = Number.parseInt(flags["chapter-words"] || "2500", 10)
      if (!Number.isFinite(chapterWordTarget) || chapterWordTarget <= 0) {
        throw new Error("`--chapter-words` must be a positive integer.")
      }

      const state = await initAutonomousProject({
        rootDir,
        idea,
        totalChapters,
        chapterWordTarget,
        title: flags.title,
      })

      const workspace = getWorkspaceSummary(rootDir)
      console.log(`Initialized autonomous novel workspace at ${workspace.workspaceDir}`)
      console.log(`Stage: ${state.runtime.stage}`)
      console.log(`Target chapters: ${state.plan.totalChapters}`)
      console.log(`Chapter word target: ${state.plan.chapterWordTarget}`)
      return
    }

    case "status": {
      const { project, state } = await loadCliProjectContext(rootDir, flags)
      if (project) {
        console.log(`Project: ${project.title} (${project.id})`)
      }
      console.log(formatStatus(state))
      return
    }

    case "advance": {
      const { projectRoot } = await loadCliProjectContext(rootDir, flags)
      const { state } = await executeManualAdvanceCommand(projectRoot, {
        source: "cli",
        requestedBy: "cli:advance",
      })
      console.log(`Stage: ${state.runtime.stage}`)
      console.log(`Status: ${state.runtime.statusMessage}`)
      return
    }

    case "cover": {
      const { projectRoot } = await loadCliProjectContext(rootDir, flags)
      const state = await prepareCoverGeneration(projectRoot)
      console.log(`Cover status: ${state.assets.cover.status}`)
      console.log(`Status: ${state.runtime.statusMessage}`)
      return
    }

    case "provider-test": {
      const { projectRoot, state } = await loadCliProjectContext(rootDir, flags)
      const result = await testProviderConnectivity({}, projectRoot)
      state.runtime.lastProviderCheck = result
      state.runtime.lastRoute = "provider_test"
      state.runtime.lastAction = result.ok ? "provider connectivity verified" : "provider connectivity failed"
      await saveAutonomousState(projectRoot, state)
      console.log(`Provider status: ${result.ok ? "ok" : "failed"}`)
      console.log(`Base URL: ${result.baseUrl}`)
      console.log(`Model: ${result.modelName}`)
      console.log(`Message: ${result.message}`)
      return
    }

    case "chat": {
      const message = flags.message?.trim()
      if (!message) {
        throw new Error("`ai-novel chat` requires `--message`.")
      }

      const { projectRoot, state } = await loadCliProjectContext(rootDir, flags)
      const route = routeUserMessage(message, state)
      console.log(`Route: ${route.type}`)
      console.log(`Reason: ${route.reason}`)

      if (route.type === "status_query") {
        state.runtime.lastRoute = "status_query"
        state.runtime.lastAction = "reported current project status"
        await saveAutonomousState(projectRoot, state)
        console.log(formatStatus(state))
        return
      }

      if (route.type === "workflow_control") {
        const { state: nextState } = await executeManualAdvanceCommand(projectRoot, {
          source: "cli",
          requestedBy: "cli:chat:workflow_control",
        })
        nextState.runtime.lastRoute = "workflow_control"
        nextState.runtime.lastAction = "advanced workflow stage"
        await saveAutonomousState(projectRoot, nextState)
        console.log(`Stage: ${nextState.runtime.stage}`)
        console.log(`Status: ${nextState.runtime.statusMessage}`)
        return
      }

      if (route.type === "interruption_change") {
        const { state: nextState } = await executeManualInterruptCommand(projectRoot, message, {
          source: "cli",
          requestedBy: "cli:chat:interruption_change",
        })
        const review = nextState.runtime.lastInterruption
        nextState.runtime.lastRoute = "interruption_change"
        nextState.runtime.lastAction = "reviewed user change request"
        await saveAutonomousState(projectRoot, nextState)
        console.log(`Interruption scope: ${review?.scope || "unknown"}`)
        console.log(`Stage: ${nextState.runtime.stage}`)
        console.log(`Action: ${review?.recommendedAction || nextState.runtime.statusMessage}`)
        return
      }

      const discussion = await runMultiAgentDiscussion(projectRoot, message)
      const nextState = await loadAutonomousState(projectRoot)
      nextState.runtime.lastRoute = "discussion_chat"
      nextState.runtime.lastAction = "ran visible multi-agent discussion"
      await saveAutonomousState(projectRoot, nextState)
      for (const reply of discussion.replies) {
        console.log(`${reply.role}: ${reply.content}`)
      }
      console.log(`Summary: ${discussion.summary}`)
      return
    }

    case "interrupt": {
      const message = flags.message?.trim()
      if (!message) {
        throw new Error("`ai-novel interrupt` requires `--message`.")
      }

      const { projectRoot } = await loadCliProjectContext(rootDir, flags)
      const { state } = await executeManualInterruptCommand(projectRoot, message, {
        source: "cli",
        requestedBy: "cli:interrupt",
      })
      const review = state.runtime.lastInterruption
      const stage = review.scope === "global" ? "replanning" : "in_progress"

      console.log(`Interruption scope: ${review.scope}`)
      console.log(`Recommended stage: ${stage}`)
      console.log(`Reasoning: ${review.reasoning}`)
      console.log(`Action: ${review.recommendedAction}`)
      return
    }

    case "tui": {
      const { projectRoot } = await loadCliProjectContext(rootDir, flags)
      await runTui(projectRoot, { once: flags.once === "true" })
      return
    }

    case "help":
    case "--help":
    case "-h":
    case undefined: {
      printHelp()
      return
    }

    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
