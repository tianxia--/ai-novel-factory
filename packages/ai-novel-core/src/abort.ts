export const AUTOPILOT_STOP_MESSAGE = "Autopilot stopped by user."

export function isAbortLikeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false
  }
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown }
  return candidate.name === "AbortError"
    || candidate.code === "ABORT_ERR"
    || (typeof candidate.message === "string" && /\babort(?:ed)?\b/i.test(candidate.message))
}

export function isAutopilotStopError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /autopilot stopped by user/i.test(message)
}

export function createAutopilotStopError() {
  return new Error(AUTOPILOT_STOP_MESSAGE)
}

export function throwIfStopped(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAutopilotStopError()
  }
}
