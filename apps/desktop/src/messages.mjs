const AGENT_TYPE_BY_LABEL = {
  Showrunner: "showrunner",
  "World Architect": "world_architect",
  Author: "author",
  Editor: "editor",
  Reviewer: "reviewer",
  "Prose Stylist": "prose_stylist",
  Tool: "tool_agent",
}

const AGENT_LABEL_BY_TYPE = Object.fromEntries(
  Object.entries(AGENT_TYPE_BY_LABEL).map(([label, type]) => [type, label]),
)

function nowIso() {
  return new Date().toISOString()
}

function safeMessageId(prefix = "message") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeMessageParts(parts = []) {
  return Array.isArray(parts)
    ? parts
      .filter((part) => part && typeof part === "object")
      .map((part, index) => ({
        ...part,
        id: part.id || `${part.messageId || part.message_id || "message"}:part:${index}`,
        messageId: part.messageId || part.message_id || "",
        index: Number.isFinite(Number(part.index ?? part.part_index)) ? Number(part.index ?? part.part_index) : index,
        type: String(part.type || "text"),
        data: part.data && typeof part.data === "object" ? part.data : {},
        createdAt: part.createdAt || part.created_at || "",
      }))
      .sort((left, right) => left.index - right.index)
    : []
}

function artifactPathFromParts(parts = []) {
  const artifactPart = parts.find((part) => part.type === "artifact" && part.data && typeof part.data === "object")
  const path = artifactPart?.data?.path || artifactPart?.data?.artifactPath || artifactPart?.data?.url || ""
  return typeof path === "string" ? path : ""
}

export function agentTypeFromRole(role = "Author") {
  return AGENT_TYPE_BY_LABEL[role] || String(role || "agent").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "agent"
}

export function roleFromAgentType(agentType = "agent") {
  return AGENT_LABEL_BY_TYPE[agentType] || agentType
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Agent"
}

export function createBaseMessage({
  messageId = "",
  conversationId = "",
  runId = "",
  turnId = "",
  type = "text",
  status = "completed",
  time = "",
  createdAt = "",
  updatedAt = "",
  data = {},
  metadata = {},
} = {}) {
  const timestamp = time || createdAt || nowIso()
  const id = messageId || turnId || safeMessageId(type)
  return {
    messageId: id,
    conversationId,
    runId,
    turnId,
    type,
    status,
    time: timestamp,
    createdAt: createdAt || timestamp,
    updatedAt: updatedAt || timestamp,
    data: data && typeof data === "object" ? data : {},
    metadata: metadata && typeof metadata === "object" ? metadata : {},
  }
}

export function createUserMessage({
  messageId,
  content = "",
  time,
  status = "completed",
  metadata,
} = {}) {
  return createBaseMessage({
    messageId,
    type: "user",
    status,
    time,
    data: {
      content,
      format: "plain",
    },
    metadata,
  })
}

export function createAgentMessage({
  messageId,
  turnId,
  role = "Author",
  agentType = "",
  content = "",
  time,
  status = "completed",
  streaming = false,
  artifactPath = "",
  phase = "",
  statusText = "",
  statusDetail = "",
  metadata,
} = {}) {
  const resolvedAgentType = agentType || agentTypeFromRole(role)
  return createBaseMessage({
    messageId: messageId || turnId,
    turnId,
    type: "agent",
    status: streaming ? "streaming" : status,
    time,
    data: {
      agentType: resolvedAgentType,
      agentLabel: role || roleFromAgentType(resolvedAgentType),
      content,
      format: "markdown",
      artifactPath,
      phase,
      statusText,
      statusDetail,
    },
    metadata,
  })
}

export function createStatusMessage({
  messageId,
  turnId,
  role = "Showrunner",
  agentType = "",
  title = "",
  content = "",
  time,
  status = "completed",
  metadata,
} = {}) {
  const resolvedAgentType = agentType || agentTypeFromRole(role)
  return createBaseMessage({
    messageId: messageId || turnId,
    turnId,
    type: "status",
    status,
    time,
    data: {
      agentType: resolvedAgentType,
      agentLabel: role || roleFromAgentType(resolvedAgentType),
      title,
      content,
      format: "markdown",
    },
    metadata,
  })
}

export function createArtifactMessage({
  messageId,
  conversationId = "",
  runId = "",
  turnId = "",
  role = "Author",
  agentType = "",
  artifactId = "",
  label = "",
  artifactPath = "",
  content = "",
  format = "markdown",
  time,
  status = "completed",
  metadata,
} = {}) {
  const resolvedAgentType = agentType || agentTypeFromRole(role)
  return createBaseMessage({
    messageId,
    conversationId,
    runId,
    turnId,
    type: "artifact",
    status,
    time,
    data: {
      agentType: resolvedAgentType,
      agentLabel: role || roleFromAgentType(resolvedAgentType),
      artifactId,
      label,
      artifactPath,
      content,
      format,
    },
    metadata,
  })
}

export function createImageMessage({
  messageId,
  conversationId = "",
  runId = "",
  turnId = "",
  role = "Author",
  agentType = "",
  assetId = "",
  url = "",
  path = "",
  mimeType = "image/png",
  alt = "",
  caption = "",
  time,
  status = "completed",
  metadata,
} = {}) {
  const resolvedAgentType = agentType || agentTypeFromRole(role)
  return createBaseMessage({
    messageId,
    conversationId,
    runId,
    turnId,
    type: "image",
    status,
    time,
    data: {
      agentType: resolvedAgentType,
      agentLabel: role || roleFromAgentType(resolvedAgentType),
      assetId,
      url,
      path,
      mimeType,
      alt,
      caption,
    },
    metadata,
  })
}

export function createToolMessage({
  messageId,
  conversationId = "",
  runId = "",
  turnId = "",
  toolName = "tool",
  input,
  output,
  error,
  content = "",
  time,
  status = "completed",
  toolStatus = "",
  metadata,
} = {}) {
  return createBaseMessage({
    messageId,
    conversationId,
    runId,
    turnId,
    type: "tool",
    status,
    time,
    data: {
      toolName,
      status: toolStatus || status,
      input,
      output,
      error,
      content,
    },
    metadata,
  })
}

export function messageRole(message = {}) {
  if (message.type === "user") return "User"
  if (message.type === "tool") return "Tool"
  return message.data?.agentLabel || roleFromAgentType(message.data?.agentType || "agent")
}

export function messageContent(message = {}) {
  if (message.type === "user") return message.data?.content || ""
  if (message.type === "status") {
    return [message.data?.title ? `### ${message.data.title}` : "", message.data?.content || ""].filter(Boolean).join("\n\n")
  }
  if (message.type === "image") {
    return [message.data?.caption || message.data?.alt || "", message.data?.path || message.data?.url || ""].filter(Boolean).join("\n\n")
  }
  if (message.type === "artifact") {
    return [message.data?.label ? `### ${message.data.label}` : "", message.data?.content || "", message.data?.artifactPath || ""].filter(Boolean).join("\n\n")
  }
  if (message.type === "tool") {
    return [message.data?.content || "", message.data?.toolName ? `工具：${message.data.toolName}` : ""].filter(Boolean).join("\n\n")
  }
  return message.data?.content || ""
}

export function normalizeMessage(input = {}) {
  if (input.messageId && input.type && input.data) {
    const parts = normalizeMessageParts(input.parts)
    const artifactPath = input.artifactPath || input.data?.artifactPath || artifactPathFromParts(parts) || ""
    return {
      ...input,
      parts,
      time: input.time || input.timestamp || input.createdAt || "",
      timestamp: input.timestamp || input.time || input.createdAt || "",
      role: input.role || messageRole(input),
      content: input.content ?? messageContent(input),
      streaming: input.streaming ?? input.status === "streaming",
      artifactPath,
    }
  }

  if (input.role === "User") {
    const hasTime = Boolean(input.timestamp || input.time || input.createdAt)
    const message = createUserMessage({
      messageId: input.messageId || input.key,
      content: input.content || "",
      time: input.timestamp || input.time,
      status: input.status || "completed",
    })
    return {
      ...message,
      time: hasTime ? message.time : "",
      createdAt: hasTime ? message.createdAt : "",
      updatedAt: hasTime ? message.updatedAt : "",
      timestamp: hasTime ? input.timestamp || input.time || message.time : "",
      key: input.key,
    }
  }

  const hasTime = Boolean(input.timestamp || input.time || input.createdAt)
  const message = createAgentMessage({
    messageId: input.messageId || input.turnId || input.key,
    turnId: input.turnId,
    role: input.role || "Author",
    content: input.content || "",
    time: input.timestamp || input.time,
    status: input.status || (input.streaming ? "streaming" : "completed"),
    streaming: Boolean(input.streaming),
    artifactPath: input.artifactPath || "",
    phase: input.phase || input.data?.phase || "",
    statusText: input.statusText || input.data?.statusText || "",
    statusDetail: input.statusDetail || input.data?.statusDetail || "",
  })
  return {
    ...message,
    time: hasTime ? message.time : "",
    createdAt: hasTime ? message.createdAt : "",
    updatedAt: hasTime ? message.updatedAt : "",
    timestamp: hasTime ? input.timestamp || input.time || message.time : "",
    key: input.key,
  }
}

export function toRenderableMessage(input = {}) {
  const message = normalizeMessage(input)
  const parts = normalizeMessageParts(message.parts)
  return {
    ...message,
    parts,
    key: input.key || message.messageId,
    role: message.role || messageRole(message),
    content: message.content ?? messageContent(message),
    timestamp: message.timestamp || message.time || message.createdAt,
    streaming: message.streaming ?? message.status === "streaming",
    artifactPath: message.artifactPath || message.data?.artifactPath || artifactPathFromParts(parts) || "",
  }
}
