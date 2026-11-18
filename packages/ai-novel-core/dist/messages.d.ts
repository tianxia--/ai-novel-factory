type MessageStatus = "queued" | "streaming" | "completed" | "failed" | "cancelled";
type MessageType = "user" | "agent" | "system" | "status" | "tool" | "artifact" | "image" | "error";
type AgentMessageType = "showrunner" | "world_architect" | "author" | "editor" | "reviewer" | "prose_stylist" | "director" | "memory_keeper" | "tool_agent" | "custom";
interface BaseMessage<TType extends MessageType = MessageType, TData extends Record<string, unknown> = Record<string, unknown>> {
    messageId: string;
    conversationId: string;
    projectId?: string;
    runId?: string | null;
    turnId?: string | null;
    parentMessageId?: string | null;
    type: TType;
    status: MessageStatus;
    time: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string | null;
    data: TData;
    metadata?: Record<string, unknown>;
}
interface UserMessageData extends Record<string, unknown> {
    content: string;
    format: "plain" | "markdown";
}
interface AgentMessageData extends Record<string, unknown> {
    agentType: AgentMessageType | string;
    agentLabel: string;
    content: string;
    format: "plain" | "markdown";
    artifactPath?: string;
    phase?: string;
    statusText?: string;
    statusDetail?: string;
}
interface StatusMessageData extends Record<string, unknown> {
    title: string;
    content: string;
    agentType?: AgentMessageType | string;
    agentLabel?: string;
    format: "plain" | "markdown";
}
interface ToolMessageData extends Record<string, unknown> {
    toolName: string;
    status?: MessageStatus | string;
    input?: unknown;
    output?: unknown;
    error?: unknown;
    content?: string;
}
interface ArtifactMessageData extends Record<string, unknown> {
    artifactId?: string;
    artifactPath: string;
    label: string;
    content?: string;
    format?: "plain" | "markdown";
}
interface ImageMessageData extends Record<string, unknown> {
    assetId?: string;
    url?: string;
    path?: string;
    mimeType: string;
    alt?: string;
    caption?: string;
}
type UserMessage = BaseMessage<"user", UserMessageData>;
type AgentMessage = BaseMessage<"agent", AgentMessageData>;
type StatusMessage = BaseMessage<"status", StatusMessageData>;
type ToolMessage = BaseMessage<"tool", ToolMessageData>;
type ArtifactMessage = BaseMessage<"artifact", ArtifactMessageData>;
type ImageMessage = BaseMessage<"image", ImageMessageData>;
type NovelMessage = UserMessage | AgentMessage | StatusMessage | ToolMessage | ArtifactMessage | ImageMessage | BaseMessage;
interface MessagePart {
    id: string;
    messageId: string;
    index: number;
    type: "text" | "markdown" | "image" | "artifact" | "tool_call" | "tool_result" | "json";
    data: Record<string, unknown>;
    createdAt: string;
}
declare function createMessageId(prefix?: string): string;
declare function agentTypeFromLabel(label?: string): AgentMessageType | string;
declare function agentLabelFromType(agentType?: AgentMessageType | string): string;
declare function createBaseMessage<TType extends MessageType, TData extends Record<string, unknown>>(input: {
    messageId?: string;
    conversationId?: string;
    projectId?: string;
    runId?: string | null;
    turnId?: string | null;
    parentMessageId?: string | null;
    type: TType;
    status?: MessageStatus;
    time?: string;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string | null;
    data: TData;
    metadata?: Record<string, unknown>;
}): BaseMessage<TType, TData>;
declare function createAgentMessage(input: {
    messageId?: string;
    conversationId?: string;
    projectId?: string;
    runId?: string | null;
    turnId?: string | null;
    agentType?: AgentMessageType | string;
    agentLabel?: string;
    content?: string;
    format?: "plain" | "markdown";
    artifactPath?: string;
    phase?: string;
    statusText?: string;
    statusDetail?: string;
    status?: MessageStatus;
    time?: string;
    metadata?: Record<string, unknown>;
}): AgentMessage;
declare function createUserMessage(input: {
    messageId?: string;
    conversationId?: string;
    projectId?: string;
    runId?: string | null;
    content: string;
    format?: "plain" | "markdown";
    status?: MessageStatus;
    time?: string;
    metadata?: Record<string, unknown>;
}): UserMessage;
declare function createStatusMessage(input: {
    messageId?: string;
    conversationId?: string;
    projectId?: string;
    runId?: string | null;
    turnId?: string | null;
    title: string;
    content: string;
    agentType?: AgentMessageType | string;
    agentLabel?: string;
    format?: "plain" | "markdown";
    status?: MessageStatus;
    time?: string;
    metadata?: Record<string, unknown>;
}): StatusMessage;
declare function createToolMessage(input: {
    messageId?: string;
    conversationId?: string;
    projectId?: string;
    runId?: string | null;
    turnId?: string | null;
    parentMessageId?: string | null;
    toolName: string;
    input?: unknown;
    output?: unknown;
    error?: unknown;
    content?: string;
    status?: MessageStatus;
    toolStatus?: MessageStatus | string;
    time?: string;
    metadata?: Record<string, unknown>;
}): ToolMessage;
declare function createArtifactMessage(input: {
    messageId?: string;
    conversationId?: string;
    projectId?: string;
    runId?: string | null;
    turnId?: string | null;
    parentMessageId?: string | null;
    artifactId?: string;
    artifactPath: string;
    label: string;
    content?: string;
    format?: "plain" | "markdown";
    status?: MessageStatus;
    time?: string;
    metadata?: Record<string, unknown>;
}): ArtifactMessage;
declare function createImageMessage(input: {
    messageId?: string;
    conversationId?: string;
    projectId?: string;
    runId?: string | null;
    turnId?: string | null;
    parentMessageId?: string | null;
    assetId?: string;
    url?: string;
    path?: string;
    mimeType?: string;
    alt?: string;
    caption?: string;
    status?: MessageStatus;
    time?: string;
    metadata?: Record<string, unknown>;
}): ImageMessage;

export { type AgentMessage, type AgentMessageData, type AgentMessageType, type ArtifactMessage, type ArtifactMessageData, type BaseMessage, type ImageMessage, type ImageMessageData, type MessagePart, type MessageStatus, type MessageType, type NovelMessage, type StatusMessage, type StatusMessageData, type ToolMessage, type ToolMessageData, type UserMessage, type UserMessageData, agentLabelFromType, agentTypeFromLabel, createAgentMessage, createArtifactMessage, createBaseMessage, createImageMessage, createMessageId, createStatusMessage, createToolMessage, createUserMessage };
