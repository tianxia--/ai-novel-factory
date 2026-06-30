import { renderMessageMarkdown } from "./message-renderer.mjs"
import { messageContent, messageRole, toRenderableMessage } from "./messages.mjs"

const COLLAPSE_CHAR_LIMIT = 320
const COLLAPSE_LINE_LIMIT = 8
const COLLAPSED_PREVIEW_CHAR_LIMIT = 280
const COLLAPSED_PREVIEW_LINE_LIMIT = 8
const STREAMING_PREVIEW_CHAR_LIMIT = 4200
const STREAMING_PREVIEW_LINE_LIMIT = 90

function parseRobustTimestamp(value) {
  if (!value) return NaN
  if (value instanceof Date) return value.getTime()
  if (typeof value === "number") return value
  const str = String(value).trim()

  if (/^\d{2}:\d{2}:\d{2}/.test(str)) {
    const today = new Date().toISOString().split("T")[0]
    const parsed = Date.parse(`${today}T${str}`)
    if (Number.isFinite(parsed)) return parsed
  }

  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(str)) {
    const formatted = str.replace(/\s+/, "T")
    const parsed = Date.parse(formatted)
    if (Number.isFinite(parsed)) return parsed
  }

  const parsed = Date.parse(str)
  if (Number.isFinite(parsed)) return parsed

  return NaN
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function formatDiscussionClock(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  const clock = date.toLocaleTimeString("zh-CN", { hour12: false })
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0")
  return `${clock}.${milliseconds}`
}

function renderEntryClock(entry, formatClock) {
  return entry?.timestamp ? formatClock(entry.timestamp) : ""
}

function jsonToDisplayText(value) {
  if (value === undefined || value === null || value === "") {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function messageParts(message = {}, type = "") {
  const parts = Array.isArray(message.parts) ? message.parts : []
  const normalized = parts
    .filter((part) => part && typeof part === "object")
    .map((part, index) => ({
      ...part,
      id: part.id || `${message.messageId || "message"}:part:${index}`,
      index: Number.isFinite(Number(part.index)) ? Number(part.index) : index,
      type: String(part.type || "text"),
      data: part.data && typeof part.data === "object" ? part.data : {},
    }))
    .sort((left, right) => left.index - right.index)

  return type ? normalized.filter((part) => part.type === type) : normalized
}

function firstMessagePart(message = {}, type = "") {
  return messageParts(message, type)[0] || null
}

function messagePartText(part = null) {
  const data = part?.data && typeof part.data === "object" ? part.data : {}
  const value = data.text ?? data.content ?? data.markdown ?? data.value ?? ""
  return typeof value === "string" ? value : ""
}

function primaryTextPart(message = {}) {
  return firstMessagePart(message, "markdown") || firstMessagePart(message, "text")
}

function primaryMessageContent(message = {}) {
  const primary = messagePartText(primaryTextPart(message))
  return primary || String(messageContent(message) || "")
}

function firstJsonPartData(message = {}) {
  const data = firstMessagePart(message, "json")?.data || {}
  return data && typeof data === "object" ? data : {}
}

function messageExecutionState(message = {}) {
  if (!message || messageRole(message) === "User") {
    return null
  }

  const jsonData = firstJsonPartData(message)
  const metadata = message.metadata && typeof message.metadata === "object" ? message.metadata : {}
  const data = message.data && typeof message.data === "object" ? message.data : {}
  const phase = String(data.phase || metadata.phase || jsonData.phase || "").trim()
  const statusText = String(data.statusText || metadata.statusText || jsonData.statusText || "").trim()
  const statusDetail = String(data.statusDetail || metadata.statusDetail || jsonData.statusDetail || "").trim()
  const status = String(message.status || data.status || jsonData.status || "").trim()
  const activePhases = new Set(["queued", "request_sent", "response_started", "streaming", "running", "started"])
  const failed = status === "failed" || phase === "failed" || status === "blocked"
  const completed = status === "completed" || phase === "completed"
  const active = !failed && !completed && (message.streaming || activePhases.has(phase) || status === "streaming")

  if (!phase && !statusText && !message.streaming && !failed) {
    return null
  }

  const fallbackText = failed
    ? "执行失败，已记录错误。"
    : completed
      ? "执行完成，结果已保存。"
      : phase === "request_sent"
        ? "请求已提交给 LLM，等待模型开始响应。"
        : phase === "response_started"
          ? "LLM 已开始响应，正在返回首段内容。"
          : phase === "streaming" || message.streaming
            ? "LLM 正在持续返回内容。"
            : "Agent 正在执行当前步骤。"

  return {
    phase: phase || (active ? "streaming" : status || "completed"),
    status,
    statusText: statusText || fallbackText,
    statusDetail,
    active,
    failed,
    completed,
  }
}

function renderExecutionStatusHtml(message = {}) {
  const execution = messageExecutionState(message)
  if (!execution) {
    return ""
  }

  const stateClass = execution.failed
    ? "is-failed"
    : execution.completed
      ? "is-completed"
      : execution.active
        ? "is-active"
        : "is-idle"
  const phaseClass = `phase-${execution.phase.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`
  const icon = execution.failed
    ? "fa-solid fa-circle-exclamation"
    : execution.completed
      ? "fa-solid fa-circle-check"
      : execution.phase === "request_sent"
        ? "fa-solid fa-paper-plane"
        : execution.phase === "response_started"
          ? "fa-solid fa-signal"
          : "fa-solid fa-circle-notch fa-spin"

  return `
    <div class="message-execution-status ${stateClass} ${escapeHtml(phaseClass)}">
      <span class="execution-status-icon"><i class="${escapeHtml(icon)}"></i></span>
      <span class="execution-status-copy">
        <span class="execution-status-text">${escapeHtml(execution.statusText)}</span>
        ${execution.statusDetail ? `<span class="execution-status-detail">${escapeHtml(execution.statusDetail)}</span>` : ""}
      </span>
      ${execution.active ? '<span class="execution-status-dots" aria-hidden="true"><span></span><span></span><span></span></span>' : ""}
    </div>
  `
}

function messageArtifactPath(message = {}) {
  const dataPath = message.artifactPath || message.data?.artifactPath || ""
  if (dataPath) {
    return dataPath
  }
  const artifactData = firstMessagePart(message, "artifact")?.data || {}
  const path = artifactData.path || artifactData.artifactPath || artifactData.url || ""
  return typeof path === "string" ? path : ""
}

function renderJsonPart(part, label = "JSON") {
  const displayText = jsonToDisplayText(part?.data || {})
  if (!displayText) {
    return ""
  }
  return `
    <details class="message-part message-part-json">
      <summary>${escapeHtml(label)}</summary>
      <pre><code>${escapeHtml(displayText)}</code></pre>
    </details>
  `
}

function renderArtifactPart(part) {
  const data = part?.data || {}
  const artifactPath = data.path || data.artifactPath || data.url || ""
  const label = data.label || data.title || artifactPath || "产物"
  const kind = data.kind || data.type || ""
  const status = data.status || ""
  const meta = [kind, status, artifactPath].filter(Boolean).join(" · ")
  return `
    <div class="message-part message-part-artifact" data-artifact-path="${escapeHtml(artifactPath)}">
      <div class="message-part-icon"><i class="fa-solid fa-file-lines"></i></div>
      <div class="message-part-body">
        <div class="message-part-title">${escapeHtml(label)}</div>
        ${meta ? `<div class="message-part-meta">${escapeHtml(meta)}</div>` : ""}
      </div>
    </div>
  `
}

function renderImagePart(part) {
  const data = part?.data || {}
  const imageSrc = data.url || data.path || ""
  const caption = data.caption || data.alt || ""
  if (!imageSrc) {
    return ""
  }
  return `
    <div class="message-part message-part-image">
      <img class="message-image-preview" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(data.alt || caption || "image message")}">
      ${caption ? `<div class="message-image-caption">${renderMessageMarkdown(caption)}</div>` : ""}
    </div>
  `
}

function renderToolCallPart(part, index = 0) {
  const data = part?.data || {}
  const toolName = data.toolName || data.name || "tool"
  const input = Object.prototype.hasOwnProperty.call(data, "input")
    ? data.input
    : Object.prototype.hasOwnProperty.call(data, "arguments")
      ? data.arguments
      : data
  return `
    <div class="message-part message-part-tool-call">
      <div class="message-part-title"><i class="fa-solid fa-terminal"></i>${escapeHtml(toolName)}${index > 0 ? ` #${index + 1}` : ""}</div>
      ${renderToolField("Input", input, "message-tool-input")}
    </div>
  `
}

function renderToolResultPart(part, index = 0) {
  const data = part?.data || {}
  const status = data.status || "completed"
  const outputHtml = renderToolField("Output", data.output, "message-tool-output")
  const errorHtml = renderToolField("Error", data.error, "message-tool-error")
  return `
    <div class="message-part message-part-tool-result">
      <div class="message-part-title"><i class="fa-solid fa-square-check"></i>Result${index > 0 ? ` #${index + 1}` : ""}<span>${escapeHtml(status)}</span></div>
      ${outputHtml}${errorHtml}
    </div>
  `
}

function renderMessagePartsHtml(message = {}, {
  skipPartId = "",
  skipTypes = [],
} = {}) {
  const skipTypeSet = new Set(skipTypes)
  const partsHtml = messageParts(message)
    .filter((part) => part.id !== skipPartId && !skipTypeSet.has(part.type))
    .map((part, index) => {
      if (part.type === "markdown" || part.type === "text") {
        const text = messagePartText(part)
        return text
          ? `<div class="message-part message-part-text markdown-body">${renderMessageMarkdown(text)}</div>`
          : ""
      }
      if (part.type === "artifact") return renderArtifactPart(part)
      if (part.type === "image") return renderImagePart(part)
      if (part.type === "tool_call") return renderToolCallPart(part, index)
      if (part.type === "tool_result") return renderToolResultPart(part, index)
      if (part.type === "json") return renderJsonPart(part, "结构化数据")
      return renderJsonPart(part, part.type || "数据")
    })
    .filter(Boolean)

  return partsHtml.length > 0
    ? `<div class="message-parts">${partsHtml.join("")}</div>`
    : ""
}

function messageEntryKey(message, role, index) {
  return message.key || message.turnId || message.messageId || `${role}-${index}`
}

function fallbackRoleMeta(role, messageType = "agent") {
  if (role === "User") {
    return {
      name: "User",
      avatar: "fa-solid fa-user",
      kind: "user",
      badge: "",
    }
  }
  if (messageType === "tool") {
    return {
      name: "Tool",
      avatar: "fa-solid fa-screwdriver-wrench",
      kind: "tool",
      badge: "工具",
    }
  }
  if (messageType === "image") {
    return {
      name: role || "Image",
      avatar: "fa-solid fa-image",
      kind: "asset",
      badge: "图片",
    }
  }
  if (messageType === "artifact") {
    return {
      name: role || "Artifact",
      avatar: "fa-solid fa-file-lines",
      kind: "artifact",
      badge: "产物",
    }
  }
  if (messageType === "status" || messageType === "system") {
    return {
      name: role || "System",
      avatar: "fa-solid fa-circle-info",
      kind: "status",
      badge: "状态",
    }
  }
  return {
    name: role,
    avatar: "fa-solid fa-feather-pointed",
    kind: "author",
    badge: "协作",
  }
}

function messageFrameHtml({
  message,
  role,
  meta,
  entryKey,
  formatClock,
  wrapperClass = "agent-message",
  contentClass = "",
  bubbleClass = "",
  contentHtml = "",
  actionsHtml = "",
  badgeLabel = "",
} = {}) {
  const resolvedBadge = badgeLabel === null ? "" : badgeLabel || meta.badge || "协作"
  const badgeHtml = resolvedBadge
    ? `<span class="agent-badge ${escapeHtml(meta.kind)}-badge">${escapeHtml(resolvedBadge)}</span>`
    : ""

  return `
    <div class="message-wrapper ${escapeHtml(wrapperClass)} message-type-${escapeHtml(message.type || "agent")}" data-agent="${escapeHtml(meta.kind)}" data-agent-type="${escapeHtml(message.data?.agentType || "")}" data-message-id="${escapeHtml(message.messageId || "")}" data-message-type="${escapeHtml(message.type || "agent")}" data-live-entry-key="${escapeHtml(entryKey)}">
      <div class="message-avatar ${escapeHtml(meta.kind)}"><i class="${escapeHtml(meta.avatar)}"></i></div>
      <div class="message-content-area">
        <div class="message-info">
          <span class="sender-name">${escapeHtml(meta.name || role)}</span>
          ${badgeHtml}
          <span class="message-time">${renderEntryClock(message, formatClock)}</span>
        </div>
        <div class="message-bubble ${contentClass} ${bubbleClass}">
          <div class="message-bubble-content">${contentHtml}</div>
          ${actionsHtml}
        </div>
      </div>
    </div>
  `
}

function renderExpandAction(renderState, entryKey) {
  return renderState.collapsible
    ? `<button class="message-expand-button" data-entry-key="${escapeHtml(entryKey)}">${renderState.collapsed ? "展开查看" : "收起全文"}</button>`
    : ""
}

function renderArtifactAction(artifactPath = "", label = "预览产物") {
  return artifactPath
    ? `<button class="message-artifact-button" data-artifact-path="${escapeHtml(artifactPath)}" type="button"><i class="fa-solid fa-file-lines"></i><span>${escapeHtml(label)}</span></button>`
    : ""
}

function renderTextualMessage({
  message,
  role,
  meta,
  entryKey,
  expandedKeys,
  formatClock,
  wrapperClass = "agent-message",
  badgeLabel = "",
  extraBubbleClass = "",
  artifactLabel = "预览产物",
} = {}) {
  const renderState = renderDiscussionEntryContentHtml(message, { entryKey, expandedKeys })
  const artifactPath = messageArtifactPath(message)
  const actionsHtml = `${renderArtifactAction(artifactPath, artifactLabel)}${renderExpandAction(renderState, entryKey)}`
  const bubbleClass = [
    renderState.collapsed ? "is-collapsed" : "is-expanded",
    renderState.previewed ? "is-previewed" : "",
    extraBubbleClass,
  ].filter(Boolean).join(" ")

  return messageFrameHtml({
    message,
    role,
    meta,
    entryKey,
    formatClock,
    wrapperClass,
    contentClass: "markdown-body",
    bubbleClass,
    contentHtml: renderState.html,
    actionsHtml,
    badgeLabel,
  })
}

export function shouldCollapseDiscussionEntry(entry) {
  const message = toRenderableMessage(entry || {})
  if (!entry || message.streaming || messageRole(message) === "User") {
    return false
  }

  const content = primaryMessageContent(message)
  return content.length > COLLAPSE_CHAR_LIMIT || content.split("\n").length > COLLAPSE_LINE_LIMIT
}

function truncateVisibleText(content = "", {
  maxChars = COLLAPSED_PREVIEW_CHAR_LIMIT,
  maxLines = COLLAPSED_PREVIEW_LINE_LIMIT,
  tail = false,
} = {}) {
  const text = String(content || "").replace(/\r\n/g, "\n")
  const lines = text.split("\n")
  const sourceLines = tail ? lines.slice(-maxLines) : lines.slice(0, maxLines)
  let preview = sourceLines.join("\n")

  if (preview.length > maxChars) {
    preview = tail ? preview.slice(-maxChars) : preview.slice(0, maxChars)
  }

  const omittedByLine = lines.length > maxLines
  const omittedByChar = text.length > preview.length
  return {
    text: preview.trim(),
    truncated: omittedByLine || omittedByChar,
  }
}

export function makeCollapsedDiscussionPreview(content = "") {
  const preview = truncateVisibleText(content, {
    maxChars: COLLAPSED_PREVIEW_CHAR_LIMIT,
    maxLines: COLLAPSED_PREVIEW_LINE_LIMIT,
    tail: false,
  })

  return {
    ...preview,
    text: preview.truncated
      ? `${preview.text}\n\n已折叠长内容，展开查看全文。`
      : preview.text,
  }
}

export function makeStreamingDiscussionPreview(content = "") {
  const preview = truncateVisibleText(content, {
    maxChars: STREAMING_PREVIEW_CHAR_LIMIT,
    maxLines: STREAMING_PREVIEW_LINE_LIMIT,
    tail: true,
  })

  return {
    ...preview,
    text: preview.truncated
      ? `正在流式输出，仅显示最新片段；完整内容会保存到讨论记录。\n\n${preview.text}`
      : preview.text,
  }
}

export function getDiscussionRenderState(entry, {
  entryKey = "",
  expandedKeys = new Set(),
} = {}) {
  const message = toRenderableMessage(entry || {})
  const primaryPart = primaryTextPart(message)
  const content = primaryMessageContent(message)
  const streamingPreview = message?.streaming && messageRole(message) !== "User"
    ? makeStreamingDiscussionPreview(content)
    : null
  const collapsible = shouldCollapseDiscussionEntry(entry)
  const collapsed = collapsible && !expandedKeys.has(entryKey)
  const collapsedPreview = collapsed ? makeCollapsedDiscussionPreview(content) : null

  return {
    collapsible,
    collapsed,
    previewed: Boolean(streamingPreview?.truncated || collapsedPreview?.truncated),
    visibleContent: collapsedPreview?.text ?? streamingPreview?.text ?? content,
    primaryPartId: primaryPart?.id || "",
  }
}

export function renderDiscussionEntryContentHtml(entry, options = {}) {
  const message = toRenderableMessage(entry || {})
  const renderState = getDiscussionRenderState(entry, options)
  const executionHtml = renderExecutionStatusHtml(message)
  const partsHtml = renderMessagePartsHtml(message, {
    skipPartId: renderState.primaryPartId,
    skipTypes: message.type === "tool" ? ["tool_call", "tool_result"] : [],
  })
  return {
    ...renderState,
    html: `${executionHtml}${renderMessageMarkdown(renderState.visibleContent)}${message?.streaming ? '<span class="stream-cursor">▋</span>' : ""}${partsHtml}`,
  }
}

export function buildRenderableDiscussionEntries({
  recentEntries = [],
  pendingUserMessage = "",
  pendingUserMessages = null,
  liveDiscussion = [],
} = {}) {
  const identityForEntry = (entry = {}) => entry.messageId || entry.turnId || entry.key || ""
  const entries = []
  const seen = new Map()
  const addEntry = (entry) => {
    const identity = identityForEntry(entry)
    if (identity && seen.has(identity)) {
      entries[seen.get(identity)] = {
        ...entries[seen.get(identity)],
        ...entry,
      }
      return
    }
    if (identity) {
      seen.set(identity, entries.length)
    }
    entries.push(entry)
  }

  recentEntries.forEach((entry, index) => {
    addEntry({ ...toRenderableMessage(entry), __sortIndex: index })
  })
  const pendingMessages = Array.isArray(pendingUserMessages)
    ? pendingUserMessages
    : pendingUserMessage
      ? [pendingUserMessage]
      : []

  for (const pendingMessage of pendingMessages) {
    if (typeof pendingMessage === "string") {
      addEntry({
        ...toRenderableMessage({
          key: `pending-user-message-${entries.length + 1}`,
          role: "User",
          content: pendingMessage,
        }),
        __sortIndex: entries.length,
        __pending: true,
      })
    } else {
      addEntry({
        ...toRenderableMessage({
          key: pendingMessage.key || `pending-user-message-${entries.length + 1}`,
          role: "User",
          content: pendingMessage.content || "",
          timestamp: pendingMessage.timestamp,
        }),
        __sortIndex: entries.length,
        __pending: true,
      })
    }
  }

  liveDiscussion.forEach((entry, index) => {
    addEntry({
      ...toRenderableMessage(entry),
      __sortIndex: entries.length + index,
    })
  })

  return entries
    .sort((left, right) => {
      const leftTime = parseRobustTimestamp(left.timestamp)
      const rightTime = parseRobustTimestamp(right.timestamp)
      const leftHasTime = Number.isFinite(leftTime)
      const rightHasTime = Number.isFinite(rightTime)

      if (leftHasTime && rightHasTime && leftTime !== rightTime) {
        return leftTime - rightTime
      }
      if (leftHasTime !== rightHasTime) {
        return leftHasTime ? -1 : 1
      }
      return left.__sortIndex - right.__sortIndex
    })
    .map(({ __sortIndex, __pending, ...entry }) => entry)
}

export function shouldAutoScrollDiscussion({ scrollTop = 0, clientHeight = 0, scrollHeight = 0 } = {}, threshold = 48) {
  return scrollTop + clientHeight >= scrollHeight - threshold
}

export function renderDiscussionHtml({
  result = null,
  entries = [],
  roleMeta = {},
  expandedKeys = new Set(),
  formatClock = formatDiscussionClock,
} = {}) {
  const resultHtml = result
    ? `
      <div class="discussion-result-card">
        <div class="discussion-result-header">
          <span class="discussion-result-title">Final Consensus</span>
          <span class="discussion-result-target">${escapeHtml(result.target?.label || "discussion target")}</span>
        </div>
        <div class="discussion-result-meta">${escapeHtml(result.target?.assetPath || "")}</div>
        <div class="discussion-result-body markdown-body">${renderMessageMarkdown(result.summary || "")}</div>
      </div>
    `
    : ""

  const entriesHtml = entries.map((entry, index) =>
    renderDiscussionEntryHtml({
      entry,
      index,
      roleMeta,
      expandedKeys,
      formatClock,
    }),
  ).join("")

  return `${entriesHtml}${resultHtml}`
}

function renderUserMessage({ message, role, meta, entryKey, formatClock }) {
  return messageFrameHtml({
    message,
    role,
    meta,
    entryKey,
    formatClock,
    wrapperClass: "user-message",
    bubbleClass: "message-user-bubble",
    contentHtml: escapeHtml(messageContent(message)),
    badgeLabel: null,
  })
}

function renderAgentMessage(context) {
  return renderTextualMessage(context)
}

function renderStatusMessage(context) {
  return renderTextualMessage({
    ...context,
    badgeLabel: context.message.status === "failed" ? "异常" : "状态",
    extraBubbleClass: context.message.status === "failed" ? "message-status-error" : "",
  })
}

function renderArtifactMessage(context) {
  const { message } = context
  const artifactPart = firstMessagePart(message, "artifact")
  return renderTextualMessage({
    ...context,
    badgeLabel: "产物",
    extraBubbleClass: "message-artifact-bubble",
    artifactLabel: artifactPart?.data?.label || message.data?.label || "预览产物",
  })
}

function renderImageMessage({
  message,
  role,
  meta,
  entryKey,
  formatClock,
} = {}) {
  const imagePart = firstMessagePart(message, "image")
  const data = {
    ...(message.data || {}),
    ...(imagePart?.data || {}),
  }
  const imageSrc = data.url || data.path || ""
  const caption = data.caption || data.alt || messagePartText(primaryTextPart(message)) || ""
  const imageHtml = imageSrc
    ? `<img class="message-image-preview" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(data.alt || caption || "image message")}">`
    : `<div class="message-image-missing"><i class="fa-solid fa-image"></i><span>图片资源未就绪</span></div>`
  const captionHtml = caption
    ? `<div class="message-image-caption">${renderMessageMarkdown(caption)}</div>`
    : ""
  const partsHtml = renderMessagePartsHtml(message, {
    skipPartId: imagePart?.id || primaryTextPart(message)?.id || "",
    skipTypes: ["markdown", "text"],
  })

  return messageFrameHtml({
    message,
    role,
    meta,
    entryKey,
    formatClock,
    wrapperClass: "agent-message",
    bubbleClass: "message-image-bubble",
    contentHtml: `${imageHtml}${captionHtml}${partsHtml}`,
    badgeLabel: "图片",
  })
}

function renderToolField(label, value, className = "") {
  const displayText = jsonToDisplayText(value)
  if (!displayText) {
    return ""
  }
  return `
    <div class="message-tool-field ${escapeHtml(className)}">
      <div class="message-tool-field-label">${escapeHtml(label)}</div>
      <pre><code>${escapeHtml(displayText)}</code></pre>
    </div>
  `
}

function renderToolMessage({
  message,
  role,
  meta,
  entryKey,
  formatClock,
} = {}) {
  const data = message.data || {}
  const toolCallParts = messageParts(message, "tool_call")
  const toolResultParts = messageParts(message, "tool_result")
  const firstCallData = toolCallParts[0]?.data || {}
  const firstResultData = toolResultParts[0]?.data || {}
  const toolName = data.toolName || data.name || firstCallData.toolName || firstCallData.name || "tool"
  const status = firstResultData.status || data.status || message.status || "completed"
  const content = messagePartText(primaryTextPart(message)) || data.content || data.summary || ""
  const contentHtml = content
    ? `<div class="message-tool-summary markdown-body">${renderMessageMarkdown(content)}</div>`
    : ""
  const fieldsHtml = toolCallParts.length > 0 || toolResultParts.length > 0
    ? [
      ...toolCallParts.map((part, index) => renderToolField(
        toolCallParts.length > 1 ? `Input ${index + 1}` : "Input",
        Object.prototype.hasOwnProperty.call(part.data || {}, "input") ? part.data.input : part.data,
        "message-tool-input message-part-tool-call",
      )),
      ...toolResultParts.flatMap((part, index) => [
        renderToolField(
          toolResultParts.length > 1 ? `Output ${index + 1}` : "Output",
          part.data?.output,
          "message-tool-output message-part-tool-result",
        ),
        renderToolField(
          toolResultParts.length > 1 ? `Error ${index + 1}` : "Error",
          part.data?.error,
          "message-tool-error message-part-tool-result",
        ),
      ]),
    ].join("")
    : [
      renderToolField("Input", data.input, "message-tool-input"),
      renderToolField("Output", data.output, "message-tool-output"),
      renderToolField("Error", data.error, "message-tool-error"),
    ].join("")

  return messageFrameHtml({
    message,
    role,
    meta,
    entryKey,
    formatClock,
    wrapperClass: "agent-message",
    bubbleClass: "message-tool-bubble",
    contentHtml: `
      <div class="message-tool-header">
        <span class="message-tool-name"><i class="fa-solid fa-screwdriver-wrench"></i>${escapeHtml(toolName)}</span>
        <span class="message-tool-status">${escapeHtml(status)}</span>
      </div>
      ${contentHtml}
      <div class="message-tool-grid">${fieldsHtml}</div>
    `,
    badgeLabel: "工具",
  })
}

export const MESSAGE_RENDERERS = {
  user: renderUserMessage,
  agent: renderAgentMessage,
  system: renderStatusMessage,
  status: renderStatusMessage,
  artifact: renderArtifactMessage,
  image: renderImageMessage,
  tool: renderToolMessage,
  error: renderStatusMessage,
}

export function messageRendererForType(type = "agent") {
  return MESSAGE_RENDERERS[type] || MESSAGE_RENDERERS.agent
}

export function renderDiscussionEntryHtml({
  entry,
  index = 0,
  roleMeta = {},
  expandedKeys = new Set(),
  formatClock = formatDiscussionClock,
} = {}) {
  const message = toRenderableMessage(entry || {})
  const role = messageRole(message)
  const meta = roleMeta[role] || fallbackRoleMeta(role, message.type)
  const entryKey = messageEntryKey(message, role, index)
  const renderer = messageRendererForType(message.type || (role === "User" ? "user" : "agent"))

  return renderer({
    message,
    role,
    meta,
    entryKey,
    index,
    expandedKeys,
    formatClock,
  })
}
