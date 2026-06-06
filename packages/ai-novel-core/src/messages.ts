export type MessageStatus = "queued" | "streaming" | "completed" | "failed" | "cancelled"

export type MessageType =
  | "user"
  | "agent"
  | "system"
  | "status"
  | "tool"
  | "artifact"
  | "image"
  | "error"

export type AgentMessageType =
  | "showrunner"
  | "world_architect"
  | "author"
  | "editor"
  | "reviewer"
  | "prose_stylist"
  | "director"
  | "memory_keeper"
  | "tool_agent"
  | "custom"

export interface BaseMessage<TType extends MessageType = MessageType, TData extends Record<string, unknown> = Record<string, unknown>> {
  messageId: string
  conversationId: string
  projectId?: string
  runId?: string | null
  turnId?: string | null
  parentMessageId?: string | null
  type: TType
  status: MessageStatus
  time: string
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  data: TData
  metadata?: Record<string, unknown>
}

export interface UserMessageData extends Record<string, unknown> {
  content: string
  format: "plain" | "markdown"
}

export interface AgentMessageData extends Record<string, unknown> {
  agentType: AgentMessageType | string
  agentLabel: string
  content: string
  format: "plain" | "markdown"
  artifactPath?: string
  phase?: string
  statusText?: string
  statusDetail?: string
}

export interface StatusMessageData extends Record<string, unknown> {
  title: string
  content: string
  agentType?: AgentMessageType | string
  agentLabel?: string
  format: "plain" | "markdown"
}

export interface ToolMessageData extends Record<string, unknown> {
  toolName: string
  status?: MessageStatus | string
  input?: unknown
  output?: unknown
  error?: unknown
  content?: string
}

export interface ArtifactMessageData extends Record<string, unknown> {
  artifactId?: string
  artifactPath: string
  label: string
  content?: string
  format?: "plain" | "markdown"
}

export interface ImageMessageData extends Record<string, unknown> {
  assetId?: string
  url?: string
  path?: string
  mimeType: string
  alt?: string
  caption?: string
}

export type UserMessage = BaseMessage<"user", UserMessageData>
export type AgentMessage = BaseMessage<"agent", AgentMessageData>
export type StatusMessage = BaseMessage<"status", StatusMessageData>
export type ToolMessage = BaseMessage<"tool", ToolMessageData>
export type ArtifactMessage = BaseMessage<"artifact", ArtifactMessageData>
export type ImageMessage = BaseMessage<"image", ImageMessageData>
export type NovelMessage = UserMessage | AgentMessage | StatusMessage | ToolMessage | ArtifactMessage | ImageMessage | BaseMessage

export interface MessagePart {
  id: string
  messageId: string
  index: number
  type: "text" | "markdown" | "image" | "artifact" | "tool_call" | "tool_result" | "json"
  data: Record<string, unknown>
  createdAt: string
}

const AGENT_TYPE_BY_LABEL: Record<string, AgentMessageType> = {
  Showrunner: "showrunner",
  "World Architect": "world_architect",
  Author: "author",
  Editor: "editor",
  Reviewer: "reviewer",
  "Prose Stylist": "prose_stylist",
}

const AGENT_LABEL_BY_TYPE: Record<string, string> = {
  showrunner: "Showrunner",
  world_architect: "World Architect",
  author: "Author",
  editor: "Editor",
  reviewer: "Reviewer",
  prose_stylist: "Prose Stylist",
  director: "Director",
  memory_keeper: "Memory Keeper",
  tool_agent: "Tool Agent",
}

function nowIso() {
  return new Date().toISOString()
}

export function createMessageId(prefix = "msg") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function agentTypeFromLabel(label = "Author"): AgentMessageType | string {
  return AGENT_TYPE_BY_LABEL[label] || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "custom"
}

export function agentLabelFromType(agentType: AgentMessageType | string = "custom") {
  return AGENT_LABEL_BY_TYPE[agentType] || agentType
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ") || "Agent"
}

export function createBaseMessage<TType extends MessageType, TData extends Record<string, unknown>>(input: {
  messageId?: string
  conversationId?: string
  projectId?: string
  runId?: string | null
  turnId?: string | null
  parentMessageId?: string | null
  type: TType
  status?: MessageStatus
  time?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string | null
  data: TData
  metadata?: Record<string, unknown>
}): BaseMessage<TType, TData> {
  const time = input.time || input.createdAt || nowIso()
  const status = input.status || "completed"
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
    metadata: input.metadata || {},
  }
}

export function createAgentMessage(input: {
  messageId?: string
  conversationId?: string
  projectId?: string
  runId?: string | null
  turnId?: string | null
  agentType?: AgentMessageType | string
  agentLabel?: string
  content?: string
  format?: "plain" | "markdown"
  artifactPath?: string
  phase?: string
  statusText?: string
  statusDetail?: string
  status?: MessageStatus
  time?: string
  metadata?: Record<string, unknown>
}): AgentMessage {
  const agentType = input.agentType || agentTypeFromLabel(input.agentLabel || "Author")
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
      statusDetail: input.statusDetail || "",
    },
  })
}

export function createUserMessage(input: {
  messageId?: string
  conversationId?: string
  projectId?: string
  runId?: string | null
  content: string
  format?: "plain" | "markdown"
  status?: MessageStatus
  time?: string
  metadata?: Record<string, unknown>
}): UserMessage {
  return createBaseMessage({
    ...input,
    type: "user",
    data: {
      content: input.content,
      format: input.format || "plain",
    },
  })
}

export function createStatusMessage(input: {
  messageId?: string
  conversationId?: string
  projectId?: string
  runId?: string | null
  turnId?: string | null
  title: string
  content: string
  agentType?: AgentMessageType | string
  agentLabel?: string
  format?: "plain" | "markdown"
  status?: MessageStatus
  time?: string
  metadata?: Record<string, unknown>
}): StatusMessage {
  return createBaseMessage({
    ...input,
    type: "status",
    data: {
      title: input.title,
      content: input.content,
      agentType: input.agentType,
      agentLabel: input.agentLabel,
      format: input.format || "markdown",
    },
  })
}

export function createToolMessage(input: {
  messageId?: string
  conversationId?: string
  projectId?: string
  runId?: string | null
  turnId?: string | null
  parentMessageId?: string | null
  toolName: string
  input?: unknown
  output?: unknown
  error?: unknown
  content?: string
  status?: MessageStatus
  toolStatus?: MessageStatus | string
  time?: string
  metadata?: Record<string, unknown>
}): ToolMessage {
  return createBaseMessage({
    ...input,
    type: "tool",
    data: {
      toolName: input.toolName,
      status: input.toolStatus || input.status || "completed",
      input: input.input,
      output: input.output,
      error: input.error,
      content: input.content || "",
    },
  })
}

export function createArtifactMessage(input: {
  messageId?: string
  conversationId?: string
  projectId?: string
  runId?: string | null
  turnId?: string | null
  parentMessageId?: string | null
  artifactId?: string
  artifactPath: string
  label: string
  content?: string
  format?: "plain" | "markdown"
  status?: MessageStatus
  time?: string
  metadata?: Record<string, unknown>
}): ArtifactMessage {
  return createBaseMessage({
    ...input,
    type: "artifact",
    data: {
      artifactId: input.artifactId,
      artifactPath: input.artifactPath,
      label: input.label,
      content: input.content || "",
      format: input.format || "markdown",
    },
  })
}

export function createImageMessage(input: {
  messageId?: string
  conversationId?: string
  projectId?: string
  runId?: string | null
  turnId?: string | null
  parentMessageId?: string | null
  assetId?: string
  url?: string
  path?: string
  mimeType?: string
  alt?: string
  caption?: string
  status?: MessageStatus
  time?: string
  metadata?: Record<string, unknown>
}): ImageMessage {
  return createBaseMessage({
    ...input,
    type: "image",
    data: {
      assetId: input.assetId,
      url: input.url || "",
      path: input.path || "",
      mimeType: input.mimeType || "image/png",
      alt: input.alt || "",
      caption: input.caption || "",
    },
  })
}
