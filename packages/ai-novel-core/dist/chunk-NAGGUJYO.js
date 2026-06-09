// src/router.ts
function routeUserMessage(message, state) {
  const normalized = message.toLowerCase();
  if (normalized.includes("\u9636\u6BB5") || normalized.includes("\u72B6\u6001") || normalized.includes("\u8FDB\u5EA6") || normalized.includes("status") || normalized.includes("\u73B0\u5728\u8FDB\u884C\u5230")) {
    return {
      type: "status_query",
      reason: `The message asks about current progress while the project is at ${state.runtime.stage}.`
    };
  }
  if (normalized.includes("\u7EE7\u7EED") || normalized.includes("\u4E0B\u4E00\u6B65") || normalized.includes("advance") || normalized.includes("\u63A8\u8FDB")) {
    return {
      type: "workflow_control",
      reason: "The message requests moving the workflow forward."
    };
  }
  if (normalized.includes("\u6574\u4E2A\u6545\u4E8B") || normalized.includes("\u6539\u6210") || normalized.includes("\u91CD\u5199") || normalized.includes("\u98CE\u683C") || normalized.includes("genre")) {
    return {
      type: "interruption_change",
      reason: "The message suggests a change that may alter story direction or project-wide assumptions."
    };
  }
  return {
    type: "worldbuilding",
    reason: "The message adds or refines story content and should enter the multi-agent discussion flow."
  };
}

export {
  routeUserMessage
};
