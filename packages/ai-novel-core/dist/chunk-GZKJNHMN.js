// src/messages.ts
var AGENT_TYPE_BY_LABEL = {
  Showrunner: "showrunner",
  "World Architect": "world_architect",
  Author: "author",
  Editor: "editor",
  Reviewer: "reviewer",
  "Prose Stylist": "prose_stylist"
};
var AGENT_LABEL_BY_TYPE = {
  showrunner: "Showrunner",
  world_architect: "World Architect",
  author: "Author",
  editor: "Editor",
  reviewer: "Reviewer",
  prose_stylist: "Prose Stylist",
  director: "Director",
  memory_keeper: "Memory Keeper",
  tool_agent: "Tool Agent"
};
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function createMessageId(prefix = "msg") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function agentTypeFromLabel(label = "Author") {
  return AGENT_TYPE_BY_LABEL[label] || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "custom";
}
function agentLabelFromType(agentType = "custom") {
  return AGENT_LABEL_BY_TYPE[agentType] || agentType.split("_").filter(Boolean).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ") || "Agent";
}
function createBaseMessage(input) {
  const time = input.time || input.createdAt || nowIso();
  const status = input.status || "completed";
  return {
    messageId: input.messageId || createMessageId(input.type),
    conversationId: input.conversationId || input.runId || "default",
    projectId: input.projectId,
    runId: input.runId ?? null,
    turnId: input.turnId ?? null,
    parentMessageId: input.parentMessageId ?? null,
    type: input.type,
    status,
    time,
    createdAt: input.createdAt || time,
    updatedAt: input.updatedAt || time,
    completedAt: input.completedAt ?? (status === "completed" || status === "failed" || status === "cancelled" ? time : null),
    data: input.data,
    metadata: input.metadata || {}
  };
}
function createAgentMessage(input) {
  const agentType = input.agentType || agentTypeFromLabel(input.agentLabel || "Author");
  return createBaseMessage({
    ...input,
    messageId: input.messageId || input.turnId || createMessageId("agent"),
    type: "agent",
    data: {
      agentType,
      agentLabel: input.agentLabel || agentLabelFromType(agentType),
      content: input.content || "",
      format: input.format || "markdown",
      artifactPath: input.artifactPath || "",
      phase: input.phase || "",
      statusText: input.statusText || "",
      statusDetail: input.statusDetail || ""
    }
  });
}
function createUserMessage(input) {
  return createBaseMessage({
    ...input,
    type: "user",
    data: {
      content: input.content,
      format: input.format || "plain"
    }
  });
}
function createStatusMessage(input) {
  return createBaseMessage({
    ...input,
    type: "status",
    data: {
      title: input.title,
      content: input.content,
      agentType: input.agentType,
      agentLabel: input.agentLabel,
      format: input.format || "markdown"
    }
  });
}
function createToolMessage(input) {
  return createBaseMessage({
    ...input,
    type: "tool",
    data: {
      toolName: input.toolName,
      status: input.toolStatus || input.status || "completed",
      input: input.input,
      output: input.output,
      error: input.error,
      content: input.content || ""
    }
  });
}
function createArtifactMessage(input) {
  return createBaseMessage({
    ...input,
    type: "artifact",
    data: {
      artifactId: input.artifactId,
      artifactPath: input.artifactPath,
      label: input.label,
      content: input.content || "",
      format: input.format || "markdown"
    }
  });
}
function createImageMessage(input) {
  return createBaseMessage({
    ...input,
    type: "image",
    data: {
      assetId: input.assetId,
      url: input.url || "",
      path: input.path || "",
      mimeType: input.mimeType || "image/png",
      alt: input.alt || "",
      caption: input.caption || ""
    }
  });
}

export {
  createMessageId,
  agentTypeFromLabel,
  agentLabelFromType,
  createBaseMessage,
  createAgentMessage,
  createUserMessage,
  createStatusMessage,
  createToolMessage,
  createArtifactMessage,
  createImageMessage
};
