import { createAgentMessage, createStatusMessage, toRenderableMessage } from "./messages.mjs"

function entryIdentity(entry = {}) {
  return String(entry.messageId || entry.turnId || entry.key || "")
}

function upsertEntry(currentEntries = [], nextEntry = {}, merge = (existing, incoming) => ({ ...existing, ...incoming })) {
  const nextIdentity = entryIdentity(nextEntry)
  if (!nextIdentity) {
    return [...currentEntries, nextEntry]
  }
  const existingIndex = currentEntries.findIndex((entry) => entryIdentity(entry) === nextIdentity)
  if (existingIndex < 0) {
    return [...currentEntries, nextEntry]
  }
  return currentEntries.map((entry, index) => index === existingIndex ? merge(entry, nextEntry) : entry)
}

function isTransientOperationalStatus(entry = {}) {
  const eventName = String(entry.metadata?.eventName || entry.data?.eventName || "")
  const messageId = String(entry.messageId || entry.turnId || "")
  return ["autopilot_status", "network_retry", "job_reused"].includes(eventName)
    || /^(autopilot_status|network_retry|job_reused)-/u.test(messageId)
}

function writingMessageId(payload = {}) {
  const step = String(payload.step || "progress")
  const chapter = payload.chapterNumber || "all"
  if (payload.messageId || payload.turnId) {
    return payload.messageId || payload.turnId
  }
  const normalizedStep = step.replace(/_llm_(started|streaming|completed|failed)$/u, "").replace(/[^a-zA-Z0-9_-]+/g, "-")
  const role = String(payload.role || "Author").toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const namespace = String(payload.directorCommandId || payload.runId || payload.commandId || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
  if (namespace) {
    return `writing-${chapter}-${normalizedStep}-${role}-${namespace}`
  }
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `writing-${chapter}-${normalizedStep}-${role}-${nonce}`
}

function isWritingStreaming(payload = {}) {
  const status = String(payload.status || "")
  const step = String(payload.step || "")
  return status === "running" || status === "started" || /_llm_streaming$|_llm_started$/u.test(step)
}

function inferWritingPhase(payload = {}) {
  if (payload.phase) return String(payload.phase)
  const step = String(payload.step || "")
  if (/_llm_started$/u.test(step)) return "request_sent"
  if (/_llm_streaming$/u.test(step)) {
    return payload.streamText || payload.preview ? "streaming" : "response_started"
  }
  if (/_llm_completed$/u.test(step)) return "completed"
  if (/_llm_failed$/u.test(step)) return "failed"
  if (payload.status === "running" || payload.status === "started") return "running"
  if (payload.status === "blocked") return "failed"
  return String(payload.status || "completed")
}

function defaultWritingStatusText(payload = {}) {
  if (payload.statusText) return String(payload.statusText)
  const phase = inferWritingPhase(payload)
  const isLlmStep = isLlmWritingStep(payload.step)
  if (phase === "request_sent") return "请求已提交给 LLM，等待模型开始响应。"
  if (phase === "response_started") return "LLM 已开始响应，正在返回首段内容。"
  if (phase === "streaming") return "LLM 正在持续返回内容。"
  if (phase === "completed") return isLlmStep ? "LLM 返回完成，内容已保存并进入下一步。" : "当前步骤已完成，结果已保存。"
  if (phase === "failed") return isLlmStep ? "LLM 请求失败，系统会按任务策略处理。" : "当前步骤失败，系统会按任务策略处理。"
  if (phase === "running") return "Agent 正在执行当前步骤。"
  return ""
}

function messagePart(messageId, index, type, data = {}, createdAt = "") {
  return {
    id: `${messageId}:part:${index}`,
    messageId,
    index,
    type,
    data,
    createdAt,
  }
}

function withMarkdownPart(entry = {}, content = "", timestamp = "") {
  const messageId = entry.messageId || entry.turnId || "live-message"
  const parts = Array.isArray(entry.parts) ? entry.parts.slice() : []
  const markdownIndex = parts.findIndex((part) => part.type === "markdown" || part.type === "text")
  const nextPart = messagePart(messageId, markdownIndex >= 0 ? parts[markdownIndex].index ?? markdownIndex : 0, "markdown", { text: content }, timestamp)

  if (markdownIndex >= 0) {
    parts[markdownIndex] = {
      ...parts[markdownIndex],
      ...nextPart,
      id: parts[markdownIndex].id || nextPart.id,
    }
  } else {
    parts.unshift(nextPart)
  }

  return {
    ...entry,
    parts: parts.sort((left, right) => Number(left.index || 0) - Number(right.index || 0)),
  }
}

function writingProgressParts(messageId, payload = {}, content = "") {
  const createdAt = payload.timestamp || new Date().toISOString()
  const parts = [
    messagePart(messageId, 0, "markdown", { text: content }, createdAt),
    messagePart(messageId, 1, "json", {
      step: payload.step || "progress",
      role: payload.role || "Author",
      chapterNumber: payload.chapterNumber || null,
      status: payload.status || null,
      phase: inferWritingPhase(payload),
      statusText: defaultWritingStatusText(payload),
      statusDetail: payload.statusDetail || null,
      wordCount: payload.wordCount || null,
      qualityGate: payload.qualityGate || null,
      knowledgeReferences: payload.knowledgeReferences || [],
    }, createdAt),
  ]

  if (payload.artifactPath) {
    parts.push(messagePart(messageId, parts.length, "artifact", {
      path: payload.artifactPath,
      label: payload.artifactLabel || (payload.chapterNumber ? `第 ${payload.chapterNumber} 章产物` : "写作产物"),
      kind: payload.artifactKind || "chapter",
      status: payload.status || "completed",
    }, createdAt))
  }

  return parts
}

function isLlmWritingStep(step = "") {
  return /_llm_(started|streaming|completed|failed)$/u.test(String(step))
}

function writingProgressContent(payload = {}) {
  const knowledgeReferences = Array.isArray(payload.knowledgeReferences) ? payload.knowledgeReferences : []
  const knowledgeLine = knowledgeReferences.length
    ? `\n\n知识库召回：${knowledgeReferences.length} 个片段\n${knowledgeReferences.slice(0, 5).map((item) =>
      `- ${item.sourceType || "resource"} · ${item.chunkType || "chunk"} · ${item.sourcePath || item.sourceTitle || item.chunkId || ""} · ${Number(item.score || 0).toFixed(1)}`,
    ).join("\n")}`
    : ""
  if (isLlmWritingStep(payload.step)) {
    const chapterLabel = payload.chapterNumber ? `第 ${payload.chapterNumber} 章` : "写作流水线"
    const stepLabel = String(payload.step || "progress").replace(/_llm_(started|streaming|completed|failed)$/u, "")
    const body = String(payload.streamText || payload.preview || "").trim()
    const statusText = defaultWritingStatusText(payload)
    const statusDetail = String(payload.statusDetail || "").trim()
    const metadata = []
    if (payload.wordCount) {
      metadata.push(`- 估算字数：${payload.wordCount}`)
    }
    if (payload.qualityGate?.status) {
      metadata.push(`- 质量门禁：${payload.qualityGate.status}${payload.qualityGate.score != null ? `，${payload.qualityGate.score}/10` : ""}`)
    }
    return [
      `### ${chapterLabel} · ${stepLabel}`,
      "",
      payload.message || "模型正在输出正文。",
      statusText ? `\n状态：${statusText}` : "",
      statusDetail ? `\n${statusDetail}` : "",
      knowledgeLine,
      body ? `\n${body}\n` : "",
      metadata.length ? `\n---\n${metadata.join("\n")}` : "",
    ].filter(Boolean).join("\n").trim()
  }

  const chapterLabel = payload.chapterNumber ? `第 ${payload.chapterNumber} 章` : "写作流水线"
  const statusLabel = payload.status ? ` · ${payload.status}` : ""
  const artifactLine = payload.artifactPath ? `\n\n产物：${payload.artifactPath}` : ""
  const qualityLine = payload.qualityGate
    ? `\n\n质量门禁：${payload.qualityGate.status}，${payload.qualityGate.score}/10。${payload.qualityGate.reason || ""}`
    : ""
  const wordLine = payload.wordCount ? `\n\n估算字数：${payload.wordCount}` : ""
  return [
    `### ${chapterLabel} · ${payload.step || "progress"}${statusLabel}`,
    "",
    payload.message || "写作流水线状态更新。",
    artifactLine,
    knowledgeLine,
    qualityLine,
    wordLine,
  ].join("\n").trim()
}

export function applyLiveDiscussionEvent(currentEntries = [], eventName, payload = {}) {
  if (eventName === "autopilot_status" || eventName === "network_retry" || eventName === "job_reused") {
    const title =
      eventName === "network_retry"
        ? "模型连接重试"
        : eventName === "job_reused"
          ? "无人值守任务已接收"
          : "无人值守状态"
    const detail =
      eventName === "network_retry"
        ? `模型服务暂时不可用，${Math.round((payload.retryInMs || 0) / 1000)} 秒后自动重试。${payload.message ? `\n\n${payload.message}` : ""}`
        : payload.message || "后台任务正在运行。"

    const stableStatusKey = payload.dedupeKey
      || payload.jobId
      || payload.id
      || (eventName === "autopilot_status" ? `${eventName}:${payload.stage || "global"}` : `${eventName}:${detail}`)
    const turnId = payload.turnId || `${eventName}-${String(stableStatusKey).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]+/gu, "-").slice(0, 96)}`
    const nextEntry = toRenderableMessage(createStatusMessage({
      messageId: payload.messageId || turnId,
      turnId,
      role: payload.role || "Showrunner",
      title,
      content: detail,
      time: payload.timestamp,
      metadata: { eventName, jobId: payload.jobId || payload.id || "", dedupeKey: stableStatusKey },
    }))
    const existingIndex = currentEntries.findIndex((entry) => entry.turnId === turnId || entry.messageId === nextEntry.messageId)
    if (existingIndex >= 0) {
      return currentEntries.map((entry, index) => index === existingIndex
        ? {
          ...entry,
          ...nextEntry,
          timestamp: entry.timestamp || nextEntry.timestamp,
          time: entry.time || nextEntry.time,
        }
        : entry)
    }
    return [
      ...currentEntries,
      nextEntry,
    ]
  }

  if (eventName === "agent") {
    const turnId = payload.turnId || `${payload.role || "agent"}-${currentEntries.length + 1}`
    const content = payload.content || ""
    const timestamp = payload.timestamp || new Date().toISOString()
    return [
      ...currentEntries,
      toRenderableMessage({
        ...createAgentMessage({
          messageId: payload.messageId || turnId,
          turnId,
          role: payload.role || "Author",
          content,
          time: payload.timestamp,
        }),
        parts: [messagePart(payload.messageId || turnId, 0, "markdown", { text: content }, timestamp)],
      }),
    ]
  }

  if (eventName === "agent_start") {
    const messageId = payload.messageId || payload.turnId
    const nextEntry = toRenderableMessage({
        ...createAgentMessage({
          messageId,
          turnId: payload.turnId,
          role: payload.role || "Author",
          content: "",
          time: payload.timestamp,
          streaming: true,
          phase: payload.phase || "request_sent",
          statusText: payload.statusText || "请求已送达 LLM，等待模型开始响应。",
          statusDetail: payload.statusDetail || "这条消息会在模型返回内容时继续更新。",
        }),
        parts: [messagePart(messageId || "agent-start", 0, "markdown", { text: "" }, payload.timestamp || new Date().toISOString())],
      })
    return upsertEntry(currentEntries, nextEntry, (entry, incoming) => ({
      ...entry,
      ...incoming,
      timestamp: entry.timestamp || incoming.timestamp,
      time: entry.time || incoming.time,
      parts: entry.parts?.length ? entry.parts : incoming.parts,
    }))
  }

  if (eventName === "agent_delta") {
    const messageId = payload.messageId || payload.turnId
    const existingIndex = currentEntries.findIndex((entry) => entry.messageId === messageId || entry.turnId === payload.turnId)
    if (existingIndex < 0) {
      const timestamp = payload.timestamp || new Date().toISOString()
      const content = payload.delta || ""
      return [
        ...currentEntries,
        toRenderableMessage({
          ...createAgentMessage({
            messageId,
            turnId: payload.turnId,
            role: payload.role || "Author",
            content,
            time: timestamp,
            streaming: true,
            phase: "response_started",
            statusText: payload.statusText || "LLM 已开始响应，正在返回首段内容。",
            statusDetail: payload.statusDetail || "返回内容会持续合并到这一条 agent 消息中。",
          }),
          parts: [messagePart(messageId || "agent-delta", 0, "markdown", { text: content }, timestamp)],
        }),
      ]
    }

    return currentEntries.map((entry, index) => {
      if (index !== existingIndex) return entry
      const content = `${entry.content || entry.data?.content || ""}${payload.delta || ""}`
      const hasExistingContent = Boolean(entry.content || entry.data?.content)
      return withMarkdownPart({
        ...entry,
        content,
        data: {
          ...(entry.data || {}),
          content,
          phase: hasExistingContent ? "streaming" : "response_started",
          statusText: payload.statusText || (hasExistingContent
            ? "LLM 正在持续返回内容。"
            : "LLM 已开始响应，正在返回首段内容。"),
          statusDetail: payload.statusDetail || "返回内容会持续合并到这一条 agent 消息中。",
        },
        status: "streaming",
        streaming: true,
        updatedAt: payload.timestamp || new Date().toISOString(),
      }, content, payload.timestamp || new Date().toISOString())
    })
  }

  if (eventName === "agent_complete") {
    const messageId = payload.messageId || payload.turnId
    const existingIndex = currentEntries.findIndex((entry) => entry.messageId === messageId || entry.turnId === payload.turnId)
    if (existingIndex < 0) {
      const timestamp = payload.timestamp || new Date().toISOString()
      const content = payload.content || ""
      return [
        ...currentEntries,
        toRenderableMessage({
          ...createAgentMessage({
            messageId,
            turnId: payload.turnId,
            role: payload.role || "Author",
            content,
            time: timestamp,
            status: "completed",
            streaming: false,
            phase: "completed",
            statusText: payload.statusText || "LLM 返回完成，内容已保存。",
            statusDetail: payload.statusDetail || "",
          }),
          parts: [messagePart(messageId || "agent-complete", 0, "markdown", { text: content }, timestamp)],
        }),
      ]
    }

    return currentEntries.map((entry, index) => {
      if (index !== existingIndex) return entry
      const content = payload.content || entry.content || entry.data?.content || ""
      return withMarkdownPart({
        ...entry,
        role: payload.role || entry.role,
        content,
        data: {
          ...(entry.data || {}),
          agentLabel: payload.role || entry.data?.agentLabel || entry.role,
          content,
          phase: "completed",
          statusText: payload.statusText || "LLM 返回完成，内容已保存。",
          statusDetail: payload.statusDetail || "",
        },
        status: "completed",
        streaming: false,
        time: entry.time || entry.timestamp || payload.timestamp,
        timestamp: payload.timestamp || entry.timestamp,
        updatedAt: payload.timestamp || new Date().toISOString(),
        completedAt: payload.timestamp || new Date().toISOString(),
      }, content, payload.timestamp || new Date().toISOString())
    })
  }

  if (eventName === "agent_error") {
    const messageId = payload.messageId || payload.turnId
    const timestamp = payload.timestamp || new Date().toISOString()
    const content = payload.content || payload.error || "LLM 请求失败。"
    const nextEntry = toRenderableMessage({
      ...createAgentMessage({
        messageId,
        turnId: payload.turnId,
        role: payload.role || "Author",
        content,
        time: timestamp,
        status: "failed",
        streaming: false,
        phase: "failed",
        statusText: payload.statusText || "LLM 请求失败，已记录错误。",
        statusDetail: payload.statusDetail || payload.error || "",
      }),
      parts: [messagePart(messageId || "agent-error", 0, "markdown", { text: content }, timestamp)],
    })
    return upsertEntry(currentEntries, nextEntry, (entry, incoming) => withMarkdownPart({
      ...entry,
      ...incoming,
      data: {
        ...(entry.data || {}),
        ...(incoming.data || {}),
      },
      status: "failed",
      streaming: false,
      timestamp: incoming.timestamp || entry.timestamp,
      updatedAt: incoming.updatedAt || timestamp,
      completedAt: timestamp,
    }, content, timestamp))
  }

  if (eventName === "writing_progress") {
    const activeEntries = currentEntries.filter((entry) => !isTransientOperationalStatus(entry))
    const turnId = writingMessageId(payload)
    const content = writingProgressContent(payload)
    const createEntry = isLlmWritingStep(payload.step) ? createAgentMessage : createStatusMessage
    const nextEntry = toRenderableMessage({
      ...createEntry({
        messageId: turnId,
        turnId,
        role: payload.role || "Author",
        content,
        artifactPath: isLlmWritingStep(payload.step) ? (payload.artifactPath || "") : "",
        phase: inferWritingPhase(payload),
        statusText: defaultWritingStatusText(payload),
        statusDetail: payload.statusDetail || "",
        streaming: isLlmWritingStep(payload.step) ? isWritingStreaming(payload) : false,
        time: payload.timestamp,
        status: isLlmWritingStep(payload.step)
          ? (isWritingStreaming(payload) ? "streaming" : payload.status || "completed")
          : "completed",
        title: isLlmWritingStep(payload.step) ? "" : (payload.chapterNumber ? `第 ${payload.chapterNumber} 章生产进度` : "写作流水线进度"),
        metadata: {
          eventName,
          step: payload.step || "progress",
          phase: inferWritingPhase(payload),
          statusText: defaultWritingStatusText(payload),
          statusDetail: payload.statusDetail || null,
          chapterNumber: payload.chapterNumber || null,
          qualityGate: payload.qualityGate || null,
          wordCount: payload.wordCount || null,
        },
      }),
      parts: writingProgressParts(turnId, payload, content),
    })

    const existingIndex = activeEntries.findIndex((entry) => entry.turnId === turnId || entry.messageId === turnId)
    if (existingIndex >= 0) {
      return activeEntries.map((entry, index) => index === existingIndex
        ? {
          ...entry,
          ...nextEntry,
          data: {
            ...(entry.data || {}),
            ...(nextEntry.data || {}),
          },
          parts: nextEntry.parts,
          timestamp: entry.timestamp || nextEntry.timestamp,
          time: entry.time || nextEntry.time,
        }
        : entry)
    }

    return [
      ...activeEntries,
      nextEntry,
    ]
  }

  return currentEntries
}
