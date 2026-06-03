export function applyLiveDiscussionEvent(currentEntries = [], eventName, payload = {}) {
  if (eventName === "agent") {
    return [
      ...currentEntries,
      {
        turnId: payload.turnId || `${payload.role || "agent"}-${currentEntries.length + 1}`,
        role: payload.role || "Author",
        content: payload.content || "",
        streaming: false,
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    ]
  }

  if (eventName === "agent_start") {
    return [
      ...currentEntries,
      {
        turnId: payload.turnId,
        role: payload.role || "Author",
        content: "",
        streaming: true,
        timestamp: payload.timestamp || new Date().toISOString(),
      },
    ]
  }

  if (eventName === "agent_delta") {
    return currentEntries.map((entry) => {
      if (entry.turnId !== payload.turnId) {
        return entry
      }

      return {
        ...entry,
        content: `${entry.content || ""}${payload.delta || ""}`,
      }
    })
  }

  if (eventName === "agent_complete") {
    return currentEntries.map((entry) => {
      if (entry.turnId !== payload.turnId) {
        return entry
      }

      return {
        ...entry,
        role: payload.role || entry.role,
        content: payload.content || entry.content || "",
        streaming: false,
      }
    })
  }

  return currentEntries
}
