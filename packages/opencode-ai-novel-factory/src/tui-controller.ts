import {
  executeManualAdvanceCommand,
  executeManualInterruptCommand,
  formatStatus,
  loadAutonomousState,
  prepareCoverGeneration,
  saveAutonomousState,
  runMultiAgentDiscussion,
  routeUserMessage,
  testProviderConnectivity,
  upsertProjectEnvValues,
} from "ai-novel-core"
import type { AutonomousNovelState } from "ai-novel-core"

export type ComposerAction =
  | { type: "chat"; message: string }
  | { type: "advance" }
  | { type: "cover" }
  | { type: "provider-test" }
  | { type: "refresh" }
  | { type: "interrupt"; message: string }
  | { type: "env-update"; updates: Record<string, string> }

export interface ComposerActionResult {
  state: AutonomousNovelState
  summary: string
}

interface ComposerExecutionOptions {
  onStream?: (event: { role: string; content: string }) => void | Promise<void>
}

function parseEnvAssignments(tokens: string[]) {
  const updates: Record<string, string> = {}

  for (const token of tokens) {
    const separator = token.indexOf("=")
    if (separator <= 0) {
      continue
    }

    const key = token.slice(0, separator).trim()
    const value = token.slice(separator + 1).trim()
    if (!value) {
      continue
    }

    if (key === "base_url") {
      updates.LLM_BASE_URL = value
    } else if (key === "api_key") {
      updates.LLM_API_KEY = value
    } else if (key === "model") {
      updates.LLM_MODEL_ID = value
    }
  }

  return updates
}

export function parseComposerInput(rawInput: string): ComposerAction | null {
  const input = rawInput.trim()
  if (!input) {
    return null
  }

  if (!input.startsWith("/")) {
    return {
      type: "chat",
      message: input,
    }
  }

  const [command, ...rest] = input.slice(1).split(/\s+/)
  const normalized = command.toLowerCase()

  if (normalized === "advance") {
    return { type: "advance" }
  }

  if (normalized === "cover") {
    return { type: "cover" }
  }

  if (normalized === "provider-test") {
    return { type: "provider-test" }
  }

  if (normalized === "refresh") {
    return { type: "refresh" }
  }

  if (normalized === "interrupt") {
    return {
      type: "interrupt",
      message: rest.join(" ").trim(),
    }
  }

  if (normalized === "env") {
    return {
      type: "env-update",
      updates: parseEnvAssignments(rest),
    }
  }

  return {
    type: "chat",
    message: input,
  }
}

export async function executeComposerAction(
  rootDir: string,
  action: ComposerAction,
  options: ComposerExecutionOptions = {},
): Promise<ComposerActionResult> {
  if (action.type === "advance") {
    const { state } = await executeManualAdvanceCommand(rootDir, {
      source: "tui",
      requestedBy: "tui:/advance",
    })
    state.runtime.lastRoute = "composer_advance"
    state.runtime.lastAction = "advanced workflow stage from composer"
    await saveAutonomousState(rootDir, state)
    return {
      state,
      summary: `Advanced to ${state.runtime.stage}.`,
    }
  }

  if (action.type === "cover") {
    const state = await prepareCoverGeneration(rootDir)
    state.runtime.lastRoute = "composer_cover"
    state.runtime.lastAction = "prepared cover generation from composer"
    await saveAutonomousState(rootDir, state)
    return {
      state,
      summary: `Cover preparation is now ${state.assets.cover.status}.`,
    }
  }

  if (action.type === "provider-test") {
    const state = await loadAutonomousState(rootDir)
    const result = await testProviderConnectivity()
    state.runtime.lastProviderCheck = result
    state.runtime.lastRoute = "provider_test"
    state.runtime.lastAction = result.ok ? "provider connectivity verified" : "provider connectivity failed"
    await saveAutonomousState(rootDir, state)
    return {
      state,
      summary: `Provider ${result.ok ? "ok" : "failed"}: ${result.message}`,
    }
  }

  if (action.type === "interrupt") {
    const { state } = await executeManualInterruptCommand(rootDir, action.message, {
      source: "tui",
      requestedBy: "tui:/interrupt",
    })
    state.runtime.lastRoute = "composer_interrupt"
    state.runtime.lastAction = "reviewed interruption from composer"
    await saveAutonomousState(rootDir, state)
    return {
      state,
      summary: `Interruption reviewed: ${state.runtime.statusMessage}`,
    }
  }

  if (action.type === "env-update") {
    if (Object.keys(action.updates).length > 0) {
      upsertProjectEnvValues(rootDir, action.updates)
    }

    const state = await loadAutonomousState(rootDir)
    state.runtime.lastRoute = "env_edit"
    state.runtime.lastAction = "updated project .env provider settings"
    await saveAutonomousState(rootDir, state)
    return {
      state,
      summary: Object.keys(action.updates).length > 0
        ? "Updated provider environment settings."
        : "No environment fields were updated.",
    }
  }

  if (action.type === "refresh") {
    const state = await loadAutonomousState(rootDir)
    return {
      state,
      summary: "Refreshed TUI state.",
    }
  }

  const state = await loadAutonomousState(rootDir)
  const route = routeUserMessage(action.message, state)

  if (route.type === "status_query") {
    state.runtime.lastRoute = "status_query"
    state.runtime.lastAction = "reported current project status"
    await saveAutonomousState(rootDir, state)
    return {
      state,
      summary: formatStatus(state),
    }
  }

  if (route.type === "workflow_control") {
    const { state: nextState } = await executeManualAdvanceCommand(rootDir, {
      source: "tui",
      requestedBy: "tui:workflow_control",
    })
    nextState.runtime.lastRoute = "workflow_control"
    nextState.runtime.lastAction = "advanced workflow stage"
    await saveAutonomousState(rootDir, nextState)
    return {
      state: nextState,
      summary: `Advanced to ${nextState.runtime.stage}.`,
    }
  }

  if (route.type === "interruption_change") {
    const { state: nextState } = await executeManualInterruptCommand(rootDir, action.message, {
      source: "tui",
      requestedBy: "tui:interruption_change",
    })
    nextState.runtime.lastRoute = "interruption_change"
    nextState.runtime.lastAction = "reviewed user change request"
    await saveAutonomousState(rootDir, nextState)
    return {
      state: nextState,
      summary: `Interruption routed for ${nextState.runtime.stage}.`,
    }
  }

  const discussion = await runMultiAgentDiscussion(rootDir, action.message, {
    onEvent: options.onStream,
  })
  const nextState = await loadAutonomousState(rootDir)
  nextState.runtime.lastRoute = "discussion_chat"
  nextState.runtime.lastAction = "ran visible multi-agent discussion"
  await saveAutonomousState(rootDir, nextState)
  return {
    state: nextState,
    summary: `Discussion complete: ${discussion.summary}`,
  }
}
