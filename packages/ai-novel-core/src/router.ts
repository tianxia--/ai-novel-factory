import type { AutonomousNovelState } from "./cli-types"

export type RouteType =
  | "worldbuilding"
  | "workflow_control"
  | "interruption_change"
  | "status_query"

export interface RouteDecision {
  type: RouteType
  reason: string
}

export function routeUserMessage(message: string, state: AutonomousNovelState): RouteDecision {
  const normalized = message.toLowerCase()

  if (
    normalized.includes("阶段") ||
    normalized.includes("状态") ||
    normalized.includes("进度") ||
    normalized.includes("status") ||
    normalized.includes("现在进行到")
  ) {
    return {
      type: "status_query",
      reason: `The message asks about current progress while the project is at ${state.runtime.stage}.`,
    }
  }

  if (
    normalized.includes("继续") ||
    normalized.includes("下一步") ||
    normalized.includes("advance") ||
    normalized.includes("推进")
  ) {
    return {
      type: "workflow_control",
      reason: "The message requests moving the workflow forward.",
    }
  }

  if (
    normalized.includes("整个故事") ||
    normalized.includes("改成") ||
    normalized.includes("重写") ||
    normalized.includes("风格") ||
    normalized.includes("genre")
  ) {
    return {
      type: "interruption_change",
      reason: "The message suggests a change that may alter story direction or project-wide assumptions.",
    }
  }

  return {
    type: "worldbuilding",
    reason: "The message adds or refines story content and should enter the multi-agent discussion flow.",
  }
}
