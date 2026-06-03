import { renderMessageMarkdown } from "./message-renderer.mjs"

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function defaultFormatClock() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false })
}

export function shouldCollapseDiscussionEntry(entry) {
  if (!entry || entry.streaming || entry.role === "User") {
    return false
  }

  const content = String(entry.content || "")
  return content.length > 320 || content.split("\n").length > 8
}

export function buildRenderableDiscussionEntries({
  recentEntries = [],
  pendingUserMessage = "",
  liveDiscussion = [],
} = {}) {
  const entries = [...recentEntries]

  if (pendingUserMessage) {
    if (typeof pendingUserMessage === "string") {
      entries.push({ key: "pending-user-message", role: "User", content: pendingUserMessage })
    } else {
      entries.push({
        key: pendingUserMessage.key || "pending-user-message",
        role: "User",
        content: pendingUserMessage.content || "",
        timestamp: pendingUserMessage.timestamp,
      })
    }
  }

  entries.push(...liveDiscussion)
  return entries
}

export function shouldAutoScrollDiscussion({ scrollTop = 0, clientHeight = 0, scrollHeight = 0 } = {}, threshold = 48) {
  return scrollTop + clientHeight >= scrollHeight - threshold
}

export function renderDiscussionHtml({
  result = null,
  entries = [],
  roleMeta = {},
  expandedKeys = new Set(),
  formatClock = defaultFormatClock,
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

export function renderDiscussionEntryHtml({
  entry,
  index = 0,
  roleMeta = {},
  expandedKeys = new Set(),
  formatClock = defaultFormatClock,
} = {}) {
  const meta = roleMeta[entry.role] || {
    name: entry.role,
    avatar: "fa-solid fa-feather-pointed",
    kind: "author",
    badge: "协作",
  }

  if (entry.role === "User") {
    return `
      <div class="message-wrapper user-message" data-live-entry-key="${escapeHtml(entry.key || entry.turnId || `user-${index}`)}">
        <div class="message-avatar user"><i class="${meta.avatar}"></i></div>
        <div class="message-content-area">
          <div class="message-info">
            <span class="sender-name">${meta.name}</span>
            <span class="message-time">${formatClock(entry.timestamp || new Date())}</span>
          </div>
          <div class="message-bubble">${escapeHtml(entry.content)}</div>
        </div>
      </div>
    `
  }

  const entryKey = entry.key || entry.turnId || `${entry.role}-${index}`
  const collapsed = shouldCollapseDiscussionEntry(entry) && !expandedKeys.has(entryKey)

  return `
    <div class="message-wrapper agent-message" data-agent="${meta.kind}" data-live-entry-key="${escapeHtml(entryKey)}">
      <div class="message-avatar ${meta.kind}"><i class="${meta.avatar}"></i></div>
      <div class="message-content-area">
        <div class="message-info">
          <span class="sender-name">${meta.name}</span>
          <span class="agent-badge ${meta.kind}-badge">${meta.badge || "协作"}</span>
          <span class="message-time">${formatClock(entry.timestamp || new Date())}</span>
        </div>
        <div class="message-bubble markdown-body ${collapsed ? "is-collapsed" : "is-expanded"}">
          <div class="message-bubble-content">${renderMessageMarkdown(entry.content)}${entry.streaming ? '<span class="stream-cursor">▋</span>' : ""}</div>
          ${shouldCollapseDiscussionEntry(entry)
            ? `<button class="message-expand-button" data-entry-key="${escapeHtml(entryKey)}">${collapsed ? "展开查看" : "收起全文"}</button>`
            : ""}
        </div>
      </div>
    </div>
  `
}
