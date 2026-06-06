import { deriveStudioViewModel } from "./src/view-model.mjs"
import { applyLiveDiscussionEvent } from "./src/live-discussion.mjs"
import { buildRenderableDiscussionEntries, formatDiscussionClock, renderDiscussionEntryContentHtml, renderDiscussionEntryHtml, renderDiscussionHtml, shouldAutoScrollDiscussion } from "./src/discussion-renderer.mjs"

const composerInput = document.getElementById("composer-input")
const chatMessagesBox = document.getElementById("chat-messages-box")
const sendButton = document.getElementById("send-button")
const composerStatus = document.getElementById("composer-status")
const autopilotStartButton = document.getElementById("autopilot-start-button")
const autopilotStopButton = document.getElementById("autopilot-stop-button")
const autopilotControlHint = document.getElementById("autopilot-control-hint")
const consoleLogsBox = document.getElementById("console-logs-box")
const projectManagerView = document.getElementById("project-manager-view")
const studioView = document.getElementById("studio-view")
const projectListContainer = document.getElementById("project-list-container")
const projectCountBadge = document.getElementById("project-count-badge")
const openProjectCreateButton = document.getElementById("open-project-create-button")
const managerProviderSettingsButton = document.getElementById("manager-provider-settings-button")
const backToProjectsButton = document.getElementById("back-to-projects-button")
const providerCard = document.getElementById("provider-card")
const providerEditButton = document.getElementById("provider-edit-button")
const providerConfigModal = document.getElementById("provider-config-modal")
const providerModalCloseButton = document.getElementById("provider-modal-close-button")
const providerBaseUrlInput = document.getElementById("provider-base-url-input")
const providerApiKeyInput = document.getElementById("provider-api-key-input")
const providerModelInput = document.getElementById("provider-model-input")
const providerTestButton = document.getElementById("provider-test-button")
const providerSaveButton = document.getElementById("provider-save-button")
const providerModalStatus = document.getElementById("provider-modal-status")
const networkStatusBanner = document.getElementById("network-status-banner")
const initPanel = document.getElementById("init-panel")
const initIdeaInput = document.getElementById("init-idea-input")
const initChaptersInput = document.getElementById("init-chapters-input")
const initWordsInput = document.getElementById("init-words-input")
const initButton = document.getElementById("init-button")
const projectCreateModal = document.getElementById("project-create-modal")
const projectCreateModalCloseButton = document.getElementById("project-create-modal-close-button")
const projectCreateTitleInput = document.getElementById("project-create-title-input")
const projectCreateIdeaInput = document.getElementById("project-create-idea-input")
const projectCreateChaptersInput = document.getElementById("project-create-chapters-input")
const projectCreateWordsInput = document.getElementById("project-create-words-input")
const projectCreateModalStatus = document.getElementById("project-create-modal-status")
const projectCreateSubmitButton = document.getElementById("project-create-submit-button")
const chapterPreviewModal = document.getElementById("chapter-preview-modal")
const chapterPreviewCloseButton = document.getElementById("chapter-preview-close-button")
const chapterPreviewTitle = document.getElementById("chapter-preview-title")
const chapterPreviewPath = document.getElementById("chapter-preview-path")
const chapterPreviewBody = document.getElementById("chapter-preview-body")
const ACTIVE_PROJECT_STORAGE_KEY = "ai-novel-factory.activeProjectId"
const NETWORK_RETRY_BASE_MS = 3000
const NETWORK_RETRY_MAX_MS = 30000
const DISCUSSION_PAGE_SIZE = 20

const dashboardState = {
  projects: [],
  activeProjectId: null,
  state: null,
  transcript: "",
  discussionEntries: [],
  discussionMeta: null,
  discussionPagination: null,
  discussionHistoryLoading: false,
  consensus: "",
  contextPacket: "",
  factorySnapshot: null,
  knowledgeEvaluation: null,
  knowledgeSearch: {
    query: "",
    status: "idle",
    message: "",
    result: null,
  },
  envStatus: null,
  providerResult: null,
  liveDiscussion: [],
  consoleLogs: [],
  pendingUserMessages: [],
  composerStatus: {
    kind: "idle",
    message: "输入指令后会显示发送和处理状态",
    busy: false,
  },
  expandedDiscussionKeys: new Set(),
  lastDiscussionResult: null,
  currentView: "manager",
  discussionAutoStickToBottom: true,
  lastAgentDeltaStatusAt: 0,
  autopilotActive: false,
  autopilotStreamConnected: false,
  network: {
    status: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "online",
    retryTimer: null,
    retryDelayMs: NETWORK_RETRY_BASE_MS,
    lastError: null,
    reconnectingAutopilot: false,
  },
  discussionRenderFrame: null,
  lastStatusLogSignature: "",
  lastSnapshotLogSignature: "",
  lastAutopilotStatusSignature: "",
  lastAutopilotStatusAt: 0,
  lastLogDedupe: {
    message: "",
    at: 0,
  },
  snapshotVersion: "",
  discussionStaticSignature: "",
  chapterPage: 1,
  chapterPageSize: 20,
  projectCreateInFlight: false,
  deletingProjectIds: new Set(),
}

const roleMeta = {
  User: { name: "你 (创作导演)", avatar: "fa-solid fa-user-astronaut", kind: "user" },
  Showrunner: { name: "Showrunner (执行制片)", avatar: "fa-solid fa-clapperboard", kind: "showrunner", badge: "编排中心" },
  "World Architect": { name: "World Architect (世界观架构师)", avatar: "fa-solid fa-earth-asia", kind: "worldbuilder", badge: "世界设定" },
  Author: { name: "Author (小说主笔)", avatar: "fa-solid fa-feather-pointed", kind: "author", badge: "文本生成" },
  Editor: { name: "Editor (责任编辑)", avatar: "fa-solid fa-file-pen", kind: "editor", badge: "审校润色" },
  Reviewer: { name: "Reviewer (评审专家)", avatar: "fa-solid fa-magnifying-glass-chart", kind: "reviewer", badge: "质量评估" },
  "Prose Stylist": { name: "Prose Stylist (润色师)", avatar: "fa-solid fa-wand-magic-sparkles", kind: "editor", badge: "去 AI 化" },
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatClock(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleTimeString("zh-CN", { hour12: false })
}

function addLog(message) {
  const now = Date.now()
  if (
    message === dashboardState.consoleLogs.at(-1)?.replace(/^\[[^\]]+\]\s*/, "")
    || (message === dashboardState.lastLogDedupe.message && now - dashboardState.lastLogDedupe.at < 10000)
  ) {
    return
  }
  dashboardState.lastLogDedupe = { message, at: now }
  const line = `[${formatClock()}] ${message}`
  dashboardState.consoleLogs.push(line)
  dashboardState.consoleLogs = dashboardState.consoleLogs.slice(-14)
  renderLogs()
}

function stableTextHash(value = "") {
  const text = String(value)
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0
  }
  return `${text.length}:${hash >>> 0}`
}

function dashboardProgressSignature() {
  const stage = dashboardState.state?.runtime?.stage || "unknown"
  const pending = dashboardState.state?.plan?.pendingChapters ?? "?"
  const complete = dashboardState.state?.plan?.chapterTaskSummary?.complete
    ?? (Array.isArray(dashboardState.state?.plan?.chapterTasks)
      ? dashboardState.state.plan.chapterTasks.filter((task) => task.status === "complete").length
      : "?")
  const autopilot = dashboardState.state?.runtime?.autopilot || {}
  const activeJobs = Array.isArray(dashboardState.factorySnapshot?.activeJobs)
    ? dashboardState.factorySnapshot.activeJobs.length
    : 0
  const runnableJobs = Array.isArray(dashboardState.factorySnapshot?.runnableJobs)
    ? dashboardState.factorySnapshot.runnableJobs.length
    : 0
  const finalFiles = dashboardState.factorySnapshot?.artifactSummary?.finalChapters ?? 0
  const chapterSummary = dashboardState.state?.plan?.chapterTaskSummary || {}
  const activeJobSignature = Array.isArray(dashboardState.factorySnapshot?.activeJobs)
    ? dashboardState.factorySnapshot.activeJobs
      .map((job) => `${job.id || ""}:${job.status || ""}:${job.lease_owner ? "leased" : "queued"}`)
      .join(",")
    : ""
  return [
    stage,
    pending,
    complete,
    chapterSummary.inProgress ?? "?",
    chapterSummary.blocked ?? "?",
    finalFiles,
    autopilot.lastStep || "",
    autopilot.driftStatus || "",
    activeJobs,
    runnableJobs,
    activeJobSignature,
  ].join("|")
}

function stableRowListSignature(rows = [], fields = []) {
  if (!Array.isArray(rows)) {
    return ""
  }
  return rows.map((row) => fields.map((field) => String(row?.[field] ?? "")).join("=")).join("|")
}

function dashboardStructureSignature() {
  const snapshot = dashboardState.factorySnapshot || {}
  const state = dashboardState.state || {}
  const runtime = state.runtime || {}
  const plan = state.plan || {}
  const artifactSummary = snapshot.artifactSummary || {}
  const knowledgeSummary = snapshot.knowledge?.summary || {}
  return [
    runtime.stage || "unknown",
    runtime.lastRoute || "",
    runtime.lastAction || "",
    runtime.autopilot?.running ? "autopilot-running" : "autopilot-idle",
    runtime.autopilot?.lastStep || "",
    plan.pendingChapters ?? "",
    plan.chapterTaskSummary ? JSON.stringify(plan.chapterTaskSummary) : "",
    stableRowListSignature(snapshot.chapterFacts, ["chapterNumber", "status", "latestStep", "latestEventStatus", "finalPath", "reportPath", "updatedAt"]),
    stableRowListSignature(snapshot.activeJobs, ["id", "kind", "status", "lease_owner"]),
    stableRowListSignature(snapshot.runnableJobs, ["id", "kind", "status"]),
    JSON.stringify(artifactSummary),
    JSON.stringify(knowledgeSummary),
  ].join("::")
}

function renderComposerStatus() {
  if (!composerStatus || !sendButton) {
    return
  }

  const kind = dashboardState.composerStatus.kind || "idle"
  const message = dashboardState.composerStatus.message || "输入指令后会显示发送和处理状态"
  const busy = Boolean(dashboardState.composerStatus.busy)
  const icon =
    kind === "processing"
      ? "fa-solid fa-spinner fa-spin"
      : kind === "sent"
        ? "fa-solid fa-paper-plane"
        : kind === "success"
          ? "fa-solid fa-circle-check"
          : kind === "warning"
            ? "fa-solid fa-triangle-exclamation"
            : kind === "error"
              ? "fa-solid fa-circle-exclamation"
              : "fa-regular fa-circle"

  composerStatus.classList.remove("is-idle", "is-sent", "is-processing", "is-success", "is-warning", "is-error")
  composerStatus.classList.add(`is-${kind}`)
  composerStatus.innerHTML = `<i class="${icon}"></i><span>${escapeHtml(message)}</span>`
  sendButton.disabled = busy
  sendButton.setAttribute("aria-busy", busy ? "true" : "false")
  sendButton.innerHTML = busy
    ? '<i class="fa-solid fa-spinner fa-spin"></i>'
    : '<i class="fa-solid fa-paper-plane"></i>'
  renderAutopilotControls()
}

function hasRecoverableAutopilotJob() {
  const activeJobs = Array.isArray(dashboardState.factorySnapshot?.activeJobs)
    ? dashboardState.factorySnapshot.activeJobs
    : []
  const runnableJobs = Array.isArray(dashboardState.factorySnapshot?.runnableJobs)
    ? dashboardState.factorySnapshot.runnableJobs
    : []
  return [...activeJobs, ...runnableJobs].some((job) => job?.kind === "autopilot" && (job.status === "running" || job.status === "paused"))
}

function autopilotControlState() {
  const runtimeAutopilot = dashboardState.state?.runtime?.autopilot || {}
  const running = Boolean(runtimeAutopilot.running || dashboardState.autopilotActive || dashboardState.autopilotStreamConnected)
  const recoverable = hasRecoverableAutopilotJob()
  return {
    running,
    recoverable,
    paused: recoverable && !running,
    lastStep: runtimeAutopilot.lastStep || "",
    message: runtimeAutopilot.statusMessage || "",
  }
}

function renderAutopilotControls() {
  if (!autopilotStartButton || !autopilotStopButton || !autopilotControlHint) {
    return
  }

  const control = autopilotControlState()
  const hasProject = Boolean(dashboardState.activeProjectId)
  autopilotStartButton.disabled = !hasProject || control.running || dashboardState.composerStatus.busy
  autopilotStopButton.disabled = !hasProject || !control.running
  autopilotStartButton.querySelector("span").textContent = control.paused ? "继续创作" : "开始创作"
  autopilotStartButton.querySelector("i").className = control.paused ? "fa-solid fa-rotate-right" : "fa-solid fa-play"
  autopilotStopButton.querySelector("span").textContent = control.running ? "暂停并保留进度" : "暂停"

  let hint = "进入项目后手动开始自动创作"
  if (!hasProject) {
    hint = "请选择项目后开始"
  } else if (control.running) {
    hint = "自动创作运行中，可随时暂停并保留进度"
  } else if (control.paused) {
    hint = "检测到可恢复任务，点击继续创作"
  } else if (control.lastStep === "awaiting_user_start") {
    hint = "项目已就绪，点击开始创作"
  } else if (control.message) {
    hint = control.message
  }
  autopilotControlHint.textContent = hint
}

function appendLiveStatusCard(message, options = {}) {
  const stableKey = options.dedupeKey || message
  dashboardState.liveDiscussion = applyLiveDiscussionEvent(
    dashboardState.liveDiscussion,
    "autopilot_status",
    {
      message,
      role: options.role || "Showrunner",
      dedupeKey: stableKey,
      turnId: options.turnId || `status-${stableTextHash(stableKey).replace(/[^a-z0-9]+/gi, "-")}`,
      timestamp: new Date().toISOString(),
    },
  )
  scheduleDiscussionRender()
}

function appendPendingUserMessage(message) {
  if (!message) {
    return null
  }
  const entry = {
    key: `pending-user-${Date.now()}-${dashboardState.pendingUserMessages.length + 1}`,
    content: message,
    timestamp: new Date().toISOString(),
  }
  dashboardState.pendingUserMessages = [...dashboardState.pendingUserMessages, entry].slice(-12)
  return entry
}

function acknowledgePendingMessages(persistedEntries = []) {
  const persistedUserMessages = new Set(
    (Array.isArray(persistedEntries) ? persistedEntries : [])
      .filter((entry) => entry?.role === "User")
      .map((entry) => String(entry.content || "")),
  )
  if (Array.isArray(dashboardState.pendingUserMessages) && dashboardState.pendingUserMessages.length > 0) {
    dashboardState.pendingUserMessages = dashboardState.pendingUserMessages.filter((entry) => !persistedUserMessages.has(entry.content))
  }
  const persistedIds = persistedEntryIdentitySet(persistedEntries)
  if (persistedIds.size > 0) {
    dashboardState.liveDiscussion = dashboardState.liveDiscussion.filter((entry) => {
      const identity = entryIdentity(entry)
      return !identity || !persistedIds.has(identity) || !isTransientOperationalStatus(entry)
    })
  }
}

function mergeDiscussionEntries(existingEntries = [], nextEntries = []) {
  const merged = []
  const seen = new Set()
  const addEntry = (entry) => {
    const key = entry?.messageId || entry?.id || entry?.turnId || entry?.turn_id || entry?.key || `${entry?.role || entry?.type || "entry"}:${entry?.timestamp || entry?.time || ""}:${entry?.content || entry?.data?.content || ""}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    merged.push(entry)
  }

  nextEntries.forEach(addEntry)
  existingEntries.forEach(addEntry)
  return merged
}

function entryIdentity(entry = {}) {
  return String(entry?.messageId || entry?.turnId || entry?.key || "")
}

function persistedEntryIdentitySet(entries = []) {
  return new Set((Array.isArray(entries) ? entries : []).map(entryIdentity).filter(Boolean))
}

function isTransientOperationalStatus(entry = {}) {
  const eventName = String(entry.metadata?.eventName || entry.data?.eventName || "")
  const messageId = String(entry.messageId || entry.turnId || "")
  return ["autopilot_status", "network_retry", "job_reused"].includes(eventName)
    || /^(autopilot_status|network_retry|job_reused)-/u.test(messageId)
}

function currentPersistedDiscussionEntries() {
  const entries = []
  if (Array.isArray(dashboardState.discussionEntries)) {
    entries.push(...dashboardState.discussionEntries)
  }
  if (Array.isArray(dashboardState.factorySnapshot?.recentMessages)) {
    entries.push(...dashboardState.factorySnapshot.recentMessages)
  }
  return entries
}

function clearLiveConversation() {
  dashboardState.pendingUserMessages = []
  dashboardState.liveDiscussion = []
}

function readEventPayload(event) {
  if (!event?.payload_json) {
    return {}
  }
  try {
    const payload = JSON.parse(event.payload_json)
    return payload && typeof payload === "object" ? payload : {}
  } catch {
    return {}
  }
}

function syncComposerStatusFromLatestEvents() {
  const latestEvents = Array.isArray(dashboardState.factorySnapshot?.latestEvents)
    ? dashboardState.factorySnapshot.latestEvents
    : []
  const latestEvent = latestEvents[0]
  if (!latestEvent || dashboardState.composerStatus.busy) {
    return
  }
  const payload = readEventPayload(latestEvent)

  if (latestEvent.type === "AUTOPILOT_MESSAGE_SUBMITTED" || latestEvent.type === "AUTOPILOT_INSTRUCTION_QUEUED") {
    setComposerStatus("sent", "消息已写入无人值守任务队列，等待 worker 下一轮处理。")
    return
  }

  if (latestEvent.type === "AUTOPILOT_INSTRUCTION_RECEIVED") {
    setComposerStatus("processing", "worker 已接收你的最新指令，正在继续处理。")
    return
  }

  if (latestEvent.type === "PROJECT_STATE_UPDATED") {
    const autopilot = payload.autopilot || {}
    if (autopilot.lastStep === "network_retry") {
      setComposerStatus("warning", autopilot.statusMessage || payload.statusMessage || "模型服务暂时不可用，系统会自动重试。")
      return
    }
  }

  if (latestEvent.type === "JOB_HEARTBEAT" && dashboardState.state?.runtime?.autopilot?.running) {
    setComposerStatus("processing", "后台 worker 正在运行；如果模型超时，会自动重试并保留进度。")
  }
}

function setComposerStatus(kind, message, options = {}) {
  dashboardState.composerStatus = {
    kind,
    message,
    busy: Boolean(options.busy),
  }
  renderComposerStatus()
}

function resetComposerStatusSoon(message = "处理完成，状态已同步。") {
  setComposerStatus("success", message)
  window.setTimeout(() => {
    if (dashboardState.composerStatus.kind === "success") {
      setComposerStatus("idle", "输入指令后会显示发送和处理状态")
    }
  }, 2600)
}

function networkErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error || "network error")
}

function isNetworkError(error) {
  const message = networkErrorMessage(error).toLowerCase()
  return /network|fetch|failed|abort|econn|enotfound|etimedout|socket|offline|断网|连接/i.test(message)
}

function isProviderTimeoutMessage(message = "") {
  return /llm request timed out|provider activity|模型.*超时|响应超时|timed out/i.test(String(message))
}

function renderNetworkStatus() {
  if (!networkStatusBanner) {
    return
  }

  networkStatusBanner.classList.remove("is-online", "is-offline", "is-recovering")
  networkStatusBanner.classList.add(`is-${dashboardState.network.status}`)

  const icon =
    dashboardState.network.status === "online"
      ? "fa-solid fa-wifi"
      : dashboardState.network.status === "recovering"
        ? "fa-solid fa-rotate fa-spin"
        : "fa-solid fa-wifi-slash"
  const label =
    dashboardState.network.status === "online"
      ? "连接正常"
      : dashboardState.network.status === "recovering"
        ? "网络已恢复，正在重新同步并继续任务..."
        : isProviderTimeoutMessage(dashboardState.network.lastError)
          ? `模型响应超时，后台会自动重试...${dashboardState.network.lastError ? ` (${dashboardState.network.lastError})` : ""}`
          : `网络连接中断，正在重试...${dashboardState.network.lastError ? ` (${dashboardState.network.lastError})` : ""}`

  networkStatusBanner.innerHTML = `<i class="${icon}"></i><span>${escapeHtml(label)}</span>`
}

function scheduleNetworkProbe() {
  if (dashboardState.network.retryTimer) {
    return
  }

  dashboardState.network.retryTimer = window.setTimeout(async () => {
    dashboardState.network.retryTimer = null
    try {
      await probeConnection()
    } catch {
      dashboardState.network.retryDelayMs = Math.min(dashboardState.network.retryDelayMs * 1.5, NETWORK_RETRY_MAX_MS)
      scheduleNetworkProbe()
    }
  }, dashboardState.network.retryDelayMs)
}

function markNetworkOffline(error) {
  const message = networkErrorMessage(error)
  const wasOnline = dashboardState.network.status === "online"
  dashboardState.network.status = "offline"
  dashboardState.network.lastError = message
  renderNetworkStatus()
  if (dashboardState.composerStatus.busy) {
    setComposerStatus("warning", `${isProviderTimeoutMessage(message) ? "模型响应超时" : "网络连接中断"}，系统会自动重试：${message}`, { busy: false })
  }
  if (wasOnline) {
    addLog(`${isProviderTimeoutMessage(message) ? "模型响应超时" : "网络连接中断"}：${message}。系统会自动重试，后台无人值守任务不会停止。`)
  }
  scheduleNetworkProbe()
}

async function markNetworkOnline() {
  const wasOffline = dashboardState.network.status !== "online"
  dashboardState.network.status = "online"
  dashboardState.network.retryDelayMs = NETWORK_RETRY_BASE_MS
  dashboardState.network.lastError = null
  if (dashboardState.network.retryTimer) {
    window.clearTimeout(dashboardState.network.retryTimer)
    dashboardState.network.retryTimer = null
  }
  renderNetworkStatus()
  if (wasOffline) {
    if (dashboardState.composerStatus.kind === "warning") {
      setComposerStatus("processing", "网络已恢复，正在同步并继续处理。", {
        busy: Boolean(dashboardState.pendingUserMessages.length && !dashboardState.autopilotActive),
      })
    }
    addLog("网络已恢复，正在同步最新状态并继续监听任务。")
    await resumeAfterNetworkRecovery()
  }
}

async function probeConnection() {
  dashboardState.network.status = "recovering"
  renderNetworkStatus()
  const response = await fetch("/api/projects", { method: "GET" })
  if (!response.ok) {
    throw new Error(`probe failed (${response.status})`)
  }
  const payload = await response.json().catch(() => ({}))
  updateSnapshot(payload)
  if (dashboardState.currentView === "manager") {
    renderManagerView()
  }
  await markNetworkOnline()
}

async function resumeAfterNetworkRecovery() {
  if (!dashboardState.activeProjectId) {
    return
  }
  await refreshDashboard({ silent: true }).catch((error) => {
    if (isNetworkError(error)) {
      markNetworkOffline(error)
      return
    }
    addLog(error instanceof Error ? error.message : String(error))
  })
  if (hasRecoverableAutopilotJob()) {
    setComposerStatus("warning", "网络已恢复，检测到可继续的自动创作任务，请点击“继续创作”。")
    addLog("检测到可继续的自动创作任务，等待手动继续。")
    renderAutopilotControls()
  }
}

function renderLogs() {
  consoleLogsBox.innerHTML = dashboardState.consoleLogs.map((line) => `<div class="log-line">${escapeHtml(line)}</div>`).join("")
  consoleLogsBox.scrollTop = consoleLogsBox.scrollHeight
}

function setProviderModalStatus(kind, message) {
  providerModalStatus.classList.remove("is-success", "is-error", "is-loading")
  if (kind) {
    providerModalStatus.classList.add(kind)
  }

  const icon =
    kind === "is-success"
      ? "fa-solid fa-circle-check"
      : kind === "is-error"
        ? "fa-solid fa-circle-exclamation"
        : kind === "is-loading"
          ? "fa-solid fa-spinner fa-spin"
          : "fa-solid fa-circle-info"

  providerModalStatus.innerHTML = `<i class="${icon}"></i><span>${escapeHtml(message)}</span>`
}

function openProviderModal() {
  providerBaseUrlInput.value = dashboardState.envStatus?.resolved?.baseUrl || ""
  providerApiKeyInput.value = ""
  providerModelInput.value = dashboardState.envStatus?.resolved?.modelName || ""
  setProviderModalStatus("", "填写后可先测试连接，再保存配置。")
  providerConfigModal.classList.remove("hidden")
}

function closeProviderModal() {
  providerConfigModal.classList.add("hidden")
}

function setProjectCreateStatus(kind, message) {
  projectCreateModalStatus.classList.remove("is-success", "is-error", "is-loading")
  if (kind) {
    projectCreateModalStatus.classList.add(kind)
  }

  const icon =
    kind === "is-success"
      ? "fa-solid fa-circle-check"
      : kind === "is-error"
        ? "fa-solid fa-circle-exclamation"
        : kind === "is-loading"
          ? "fa-solid fa-spinner fa-spin"
          : "fa-solid fa-circle-info"

  projectCreateModalStatus.innerHTML = `<i class="${icon}"></i><span>${escapeHtml(message)}</span>`
}

function setProjectCreateBusy(isBusy) {
  dashboardState.projectCreateInFlight = Boolean(isBusy)
  projectCreateSubmitButton.disabled = dashboardState.projectCreateInFlight
  projectCreateTitleInput.disabled = dashboardState.projectCreateInFlight
  projectCreateIdeaInput.disabled = dashboardState.projectCreateInFlight
  projectCreateChaptersInput.disabled = dashboardState.projectCreateInFlight
  projectCreateWordsInput.disabled = dashboardState.projectCreateInFlight
  projectCreateModalCloseButton.disabled = dashboardState.projectCreateInFlight
  projectCreateSubmitButton.innerHTML = dashboardState.projectCreateInFlight
    ? `<i class="fa-solid fa-spinner fa-spin"></i> 创建中`
    : `<i class="fa-solid fa-wand-magic-sparkles"></i> 创建项目`
}

function openProjectCreateModal() {
  setProjectCreateBusy(false)
  projectCreateTitleInput.value = ""
  projectCreateIdeaInput.value = ""
  projectCreateChaptersInput.value = "24"
  projectCreateWordsInput.value = "2500"
  setProjectCreateStatus("", "创建后只初始化独立工作区；进入创作台后需要手动点击开始创作。")
  projectCreateModal.classList.remove("hidden")
}

function closeProjectCreateModal(options = {}) {
  if (dashboardState.projectCreateInFlight && !options.force) return
  projectCreateModal.classList.add("hidden")
}

async function apiRequest(path, options = {}) {
  let response
  try {
    response = await fetch(path, {
      method: options.method || "GET",
      headers: options.body ? { "content-type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch (error) {
    if (isNetworkError(error)) {
      markNetworkOffline(error)
    }
    throw error
  }

  let payload = {}
  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  if (response.ok && dashboardState.network.status !== "online") {
    await markNetworkOnline()
  }

  return { ok: response.ok, status: response.status, payload }
}

function updateSnapshot(payload = {}) {
  const previousProjectId = dashboardState.activeProjectId
  dashboardState.projects = Array.isArray(payload.projects) ? payload.projects : dashboardState.projects
  dashboardState.activeProjectId = payload.activeProjectId || payload.projectId || dashboardState.activeProjectId
  if (previousProjectId && dashboardState.activeProjectId !== previousProjectId) {
    dashboardState.discussionStaticSignature = ""
    dashboardState.snapshotVersion = ""
    dashboardState.chapterPage = 1
    dashboardState.discussionPagination = null
  }
  if (typeof payload.snapshotVersion === "string") {
    dashboardState.snapshotVersion = payload.snapshotVersion
  }
  if (Object.prototype.hasOwnProperty.call(payload, "state")) {
    dashboardState.state = payload.state || null
  }
  if (Object.prototype.hasOwnProperty.call(payload, "transcript")) {
    dashboardState.transcript = payload.transcript || ""
  }
  if (Array.isArray(payload.entries)) {
    dashboardState.discussionEntries = payload.appendDiscussionHistory
      ? mergeDiscussionEntries(dashboardState.discussionEntries, payload.entries)
      : payload.entries
    dashboardState.discussionMeta = payload.meta || null
  }
  if (payload.pagination && typeof payload.pagination === "object") {
    dashboardState.discussionPagination = payload.pagination
  }
  if (Object.prototype.hasOwnProperty.call(payload, "factorySnapshot")) {
    dashboardState.factorySnapshot = payload.factorySnapshot || null
  }
  if (Object.prototype.hasOwnProperty.call(payload, "knowledgeEvaluation")) {
    dashboardState.knowledgeEvaluation = payload.knowledgeEvaluation || null
  }
  if (Array.isArray(payload.messages)) {
    const recentMessages = payload.appendDiscussionHistory
      ? mergeDiscussionEntries(dashboardState.factorySnapshot?.recentMessages || [], payload.messages)
      : payload.messages
    dashboardState.factorySnapshot = {
      ...(dashboardState.factorySnapshot || {}),
      recentMessages,
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "consensus")) {
    dashboardState.consensus = payload.consensus || ""
  }
  if (Object.prototype.hasOwnProperty.call(payload, "contextPacket")) {
    dashboardState.contextPacket = payload.contextPacket || ""
  }
  dashboardState.envStatus = payload.envStatus || dashboardState.envStatus
  dashboardState.providerResult = payload.result || dashboardState.providerResult
  dashboardState.lastDiscussionResult = payload.discussion || dashboardState.lastDiscussionResult
  dashboardState.autopilotActive = Boolean(dashboardState.state?.runtime?.autopilot?.running)
  syncComposerStatusFromLatestEvents()
  renderAutopilotControls()
}

function getManagerProjectProgress(project, activeModel) {
  const summary = project?.id === dashboardState.activeProjectId ? activeModel?.productionSummary : null
  if (!summary || summary.source === "empty") {
    return {
      percent: 0,
      label: "未载入状态",
      detail: "选择项目后同步 DB 状态",
    }
  }

  const stageLabels = {
    worldbuilding_dialogue: "世界观探讨",
    setting_review: "设定冻结",
    master_planning: "主线规划",
    chapter_task_generation: "章节蓝图",
    drafting: "正文写作",
    reviewing: "质量审阅",
    replanning: "重新规划",
    complete: "已完成",
  }
  const percent = Number(summary.progressPercent || 0)
  const stageLabel = stageLabels[summary.stage] || summary.stage || "工作流"
  const parts = [
    `${percent}%`,
    stageLabel,
    `完成 ${summary.completedChapters}/${summary.totalChapters}`,
    `待写 ${summary.pendingChapters}`,
  ]
  if (summary.blockedChapters > 0) {
    parts.push(`阻塞 ${summary.blockedChapters}`)
  }
  return {
    percent,
    label: parts.join(" · "),
    detail: summary.source === "db" ? "DB 主事实源" : "state 缓存",
  }
}

function renderManagerView() {
  projectCountBadge.textContent = `${dashboardState.projects.length} 个项目`
  const activeModel = dashboardState.state
    ? deriveStudioViewModel({
      state: dashboardState.state,
      transcript: dashboardState.transcript,
      consensus: dashboardState.consensus,
      contextPacket: dashboardState.contextPacket,
      factorySnapshot: dashboardState.factorySnapshot,
      envStatus: dashboardState.envStatus,
      providerResult: dashboardState.providerResult,
    })
    : null
  renderManagerSidebar(activeModel)

  if (dashboardState.projects.length === 0) {
    projectListContainer.innerHTML = `
      <div class="project-list-empty" id="project-list-empty-create">
        <i class="fa-solid fa-plus"></i>
        <strong>新建另一部小说项目</strong>
        <p>输入想法、总章数和单章字数后，系统会快速初始化独立工作区；进入创作台后再手动开始。</p>
      </div>
    `
    document.getElementById("project-list-empty-create")?.addEventListener("click", openProjectCreateModal)
  } else {
    projectListContainer.innerHTML = dashboardState.projects.map((project) => {
      const progress = getManagerProjectProgress(project, activeModel)
      const isDeleting = dashboardState.deletingProjectIds.has(project.id)
      return `
      <article class="project-card-button" data-project-id="${escapeHtml(project.id)}">
        <div class="project-card-top">
          <div class="project-card-title-group">
            <h3 class="project-card-title">${escapeHtml(project.title)}</h3>
            <span class="badge badge-secondary">${escapeHtml(project.slug)}</span>
          </div>
          <button class="project-card-delete" type="button" data-project-delete-id="${escapeHtml(project.id)}" aria-label="删除项目：${escapeHtml(project.title)}" ${isDeleting ? "disabled" : ""}>
            <i class="fa-solid ${isDeleting ? "fa-spinner fa-spin" : "fa-trash-can"}"></i>
          </button>
        </div>
        <p class="project-card-idea">${escapeHtml(project.idea)}</p>
        <div class="project-card-meta">
          <span><i class="fa-solid fa-list-ol"></i> ${project.totalChapters} 章</span>
          <span><i class="fa-solid fa-file-word"></i> ${Number(project.chapterWordTarget).toLocaleString("zh-CN")} 字/章</span>
          <span><i class="fa-regular fa-clock"></i> ${escapeHtml(formatClock(project.createdAt))}</span>
          <span><i class="fa-solid fa-layer-group"></i> 自动编剧室</span>
        </div>
        <div class="project-card-footer">
          <div class="project-card-progress">
            <div class="project-card-progress-labels">
              <span>写作进度</span>
              <span>${escapeHtml(progress.label)}</span>
            </div>
            <div class="project-card-progress-bar" title="${escapeHtml(progress.detail)}"><div style="width: ${progress.percent}%"></div></div>
          </div>
          <button class="project-card-enter" type="button" data-project-enter-id="${escapeHtml(project.id)}">进入创作台 <i class="fa-solid fa-arrow-right"></i></button>
        </div>
      </article>
    `
    }).join("")
    projectListContainer.insertAdjacentHTML("beforeend", `
      <div class="project-list-empty" id="project-list-empty-create">
        <i class="fa-solid fa-plus"></i>
        新建另一部小说项目
      </div>
    `)
    document.getElementById("project-list-empty-create")?.addEventListener("click", openProjectCreateModal)

    projectListContainer.querySelectorAll("[data-project-id]").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("[data-project-delete-id]")) {
          return
        }
        selectProject(card.dataset.projectId)
      })
    })

    projectListContainer.querySelectorAll("[data-project-delete-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation()
        deleteProject(button.dataset.projectDeleteId)
      })
    })

    projectListContainer.querySelectorAll("[data-project-enter-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation()
        selectProject(button.dataset.projectEnterId)
      })
    })
  }
}

function renderManagerSidebar(model = null) {
  const modelName = dashboardState.envStatus?.resolved?.modelName || "待配置"
  const configured = Boolean(dashboardState.envStatus?.configured)
  const missing = dashboardState.envStatus?.missing || []
  const modelNode = document.getElementById("manager-model-name")
  const serviceNode = document.getElementById("manager-service-status")
  const apiKeyNode = document.getElementById("manager-api-key-status")
  const goalDoneNode = document.getElementById("manager-goal-done")
  const goalTotalNode = document.getElementById("manager-goal-total")
  const goalFillNode = document.getElementById("manager-goal-fill")
  const goalHintNode = document.getElementById("manager-goal-hint")
  const activityNode = document.getElementById("manager-activity-list")

  if (modelNode) {
    modelNode.innerHTML = `<i class="fa-solid fa-robot"></i> ${escapeHtml(modelName)}`
  }
  if (serviceNode) {
    serviceNode.textContent = configured ? "正常" : "待配置"
    serviceNode.classList.toggle("is-warning", !configured)
  }
  if (apiKeyNode) {
    const apiReady = configured || !missing.includes("LLM_API_KEY")
    apiKeyNode.textContent = apiReady ? "已配置" : "待配置"
    apiKeyNode.classList.toggle("is-warning", !apiReady)
  }

  const summary = model?.productionSummary || null
  const totalWords = summary?.totalChapters
    ? Math.max(1, summary.totalChapters * summary.chapterWordTarget)
    : 6000
  const doneWords = summary?.estimatedWords || 0
  const clampedDone = Math.min(doneWords, totalWords)
  const percentage = summary ? summary.progressPercent : Math.round((clampedDone / totalWords) * 100)
  if (goalDoneNode) goalDoneNode.textContent = clampedDone.toLocaleString("zh-CN")
  if (goalTotalNode) goalTotalNode.textContent = `${totalWords.toLocaleString("zh-CN")} 字`
  if (goalFillNode) goalFillNode.style.width = `${percentage}%`
  if (goalHintNode) {
    goalHintNode.textContent = summary
      ? `${percentage}% · 连续完成 ${summary.completedChapters}/${summary.totalChapters} 章 · 过检 ${summary.passedChapters ?? summary.finalChapters} · 文件 ${summary.artifactFinalChapters ?? summary.finalChapters} · ${summary.source === "db" ? "DB 主事实源" : "state 缓存"}`
      : `还差 ${(totalWords - clampedDone).toLocaleString("zh-CN")} 字`
  }

  if (activityNode) {
    const activities = dashboardState.projects.slice(0, 4).map((project) => ({
      text: `《${project.title}》项目已接入生产工作流`,
      time: formatClock(project.createdAt),
    }))
    if (summary) {
      activities.unshift({
        text: `生产进度 ${summary.progressPercent}%：完成 ${summary.completedChapters}/${summary.totalChapters}，待写 ${summary.pendingChapters}，阻塞 ${summary.blockedChapters}`,
        time: summary.latestEventAt ? formatClock(summary.latestEventAt) : "刚刚",
      })
      activities.unshift({
        text: `当前阶段 ${summary.stage}${summary.isComplete ? "，全书主流程已完成" : ""}`,
        time: dashboardState.state?.runtime?.updatedAt ? formatClock(dashboardState.state.runtime.updatedAt) : "刚刚",
      })
    }
    activityNode.innerHTML = (activities.length ? activities : [{ text: "等待项目创建或选择", time: "刚刚" }]).map((activity) => `
      <div class="manager-activity-item">
        <span></span>
        <div>
          <p>${escapeHtml(activity.text)}</p>
          <small>${escapeHtml(activity.time)}</small>
        </div>
      </div>
    `).join("")
  }
}

function showManagerView() {
  dashboardState.currentView = "manager"
  projectManagerView.classList.remove("hidden")
  studioView.classList.add("hidden")
  renderManagerView()
}

function showStudioView() {
  dashboardState.currentView = "studio"
  projectManagerView.classList.add("hidden")
  studioView.classList.remove("hidden")
}

function renderProjectCard(model) {
  document.getElementById("project-title-display").textContent = model.project.idea || model.project.title
  document.getElementById("cover-status").innerHTML = model.project.coverStatus === "in_progress"
    ? `<i class="fa-solid fa-wand-magic-sparkles"></i> 生成中`
    : model.project.coverStatus === "complete"
      ? `<i class="fa-solid fa-circle-check"></i> 已完成`
      : `<i class="fa-regular fa-clock"></i> 待生成`
  document.getElementById("comic-status").innerHTML = model.project.comicStatus === "in_progress"
    ? `<i class="fa-solid fa-pen-nib"></i> 准备中`
    : model.project.comicStatus === "complete"
      ? `<i class="fa-solid fa-circle-check"></i> 已完成`
      : `<i class="fa-regular fa-clock"></i> 待生成`

  const metaValues = document.querySelectorAll(".project-meta-grid .meta-value")
  if (metaValues.length >= 2) {
    metaValues[0].textContent = `${model.project.totalChapters} 章`
    metaValues[1].textContent = `${model.project.chapterWordTarget.toLocaleString("zh-CN")} 字`
  }
}

function renderWorkflow(model) {
  document.getElementById("stage-badge").textContent = model.workflow.currentStage.label
  document.getElementById("current-stage-text").textContent = model.workflow.currentStage.key
  document.getElementById("current-stage-desc").textContent = model.workflow.currentStage.description
  const automation = model.workflow.automation || { kind: "idle", label: "等待下一步", detail: "" }
  const automationNode = document.getElementById("workflow-automation-status")
  if (automationNode) {
    const icon =
      automation.kind === "processing"
        ? "fa-solid fa-spinner fa-spin"
        : automation.kind === "success"
          ? "fa-solid fa-circle-check"
          : automation.kind === "warning"
            ? "fa-solid fa-triangle-exclamation"
            : automation.kind === "error"
              ? "fa-solid fa-circle-exclamation"
              : "fa-regular fa-circle"
    automationNode.classList.remove("is-idle", "is-processing", "is-success", "is-warning", "is-error")
    automationNode.classList.add(`is-${automation.kind}`)
    automationNode.innerHTML = `
      <div class="workflow-automation-title">
        <i class="${icon}"></i>
        <span>${escapeHtml(automation.label)}</span>
      </div>
      <p>${escapeHtml(automation.detail || "")}</p>
    `
  }

  const productionNode = document.getElementById("workflow-production-status")
  if (productionNode) {
    const pipeline = model.productionPipeline || {}
    const summary = model.productionSummary || {}
    const gate = pipeline.latestQualityGate || null
    const gateLabel = gate
      ? gate.status === "blocked"
        ? "质量阻塞"
        : gate.status === "passed"
          ? "门禁通过"
          : "需要返工"
      : "等待质检"
    const gateClass = gate
      ? gate.status === "blocked"
        ? "is-blocked"
        : gate.status === "passed"
          ? "is-passed"
          : "is-revision"
      : "is-empty"
    productionNode.classList.toggle("has-artifacts", Boolean(pipeline.hasProductionArtifacts))
    productionNode.innerHTML = `
      <div class="workflow-production-summary">
        <div>
          <strong>${Number(summary.progressPercent || 0)}%</strong>
          <span>${summary.isComplete ? "全书主流程已完成" : `阶段 ${escapeHtml(summary.stage || "unknown")}`}</span>
        </div>
        <small>${summary.source === "db" ? "DB 主事实源" : "state artifact/cache"}</small>
      </div>
      <div class="workflow-production-grid">
        <span>蓝图 <strong>${Number(summary.blueprints || pipeline.blueprints || 0)}</strong></span>
      <span>完成 <strong>${Number(summary.completedChapters || 0)}/${Number(summary.totalChapters || 0)}</strong></span>
      <span>成稿文件 <strong>${Number(summary.artifactFinalChapters || pipeline.finalChapters || 0)}</strong></span>
      <span>质检 <strong>${Number(summary.qualityReports || pipeline.qualityReports || 0)}</strong></span>
      <span>记忆 <strong>${Number(summary.memoryUpdates || pipeline.memoryUpdates || 0)}</strong></span>
        <span>待写 <strong>${Number(summary.pendingChapters || 0)}</strong></span>
        <span>阻塞 <strong>${Number(summary.blockedChapters || 0)}</strong></span>
      </div>
      ${summary.syncWarning ? `
        <div class="workflow-sync-warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${escapeHtml(summary.syncWarning)}</span>
        </div>
      ` : ""}
      <div class="workflow-quality-gate ${gateClass}">
        <span>${escapeHtml(gateLabel)}</span>
        <strong>${gate?.score == null ? "--" : `${gate.score}/10`}</strong>
        <small>${gate ? `第 ${gate.chapterNumber || "?"} 章 · 返工 ${Number(gate.attempts || 0)} 次` : "DB 暂无门禁结果"}</small>
      </div>
      ${gate?.reason ? `<p class="workflow-quality-reason">${escapeHtml(gate.reason)}</p>` : ""}
      ${pipeline.transcriptDraftOnly ? `
        <div class="workflow-draft-warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>讨论记录中出现章节草稿，但尚未通过生产流水线入库；正式进度仍以 DB 章节产物为准。</span>
        </div>
      ` : ""}
      <p>${summary.latestFinalPath ? `最近成稿：${escapeHtml(summary.latestFinalPath)}` : "生产产物会从数据库快照同步。"}</p>
      ${summary.latestEventType ? `<p>最近事件：${escapeHtml(summary.latestEventType)}</p>` : ""}
    `
  }

  const workflowStepper = document.getElementById("workflow-stepper")
  workflowStepper.innerHTML = model.workflow.steps.map((step) => {
    const icon = step.state === "completed"
      ? "fa-solid fa-check"
      : step.key === "drafting"
        ? "fa-solid fa-pen-nib"
        : step.key === "master_planning"
          ? "fa-solid fa-route"
          : step.key === "chapter_task_generation"
            ? "fa-solid fa-list-ol"
            : "fa-solid fa-comments"

    return `
      <div class="step-item ${step.state}">
        <div class="step-indicator">
          <i class="${icon}"></i>
        </div>
        <div class="step-details">
          <h4>${escapeHtml(step.title)}</h4>
          <p>${escapeHtml(step.subtitle)}</p>
        </div>
      </div>
    `
  }).join("")
}

function renderStoryMemory(model) {
  const container = document.getElementById("story-memory-content")
  const artifacts = Array.isArray(model.storyMemory.artifacts) ? model.storyMemory.artifacts : []
  const knowledge = model.storyMemory.knowledge || {}
  const knowledgeSummary = knowledge.summary || {}
  const knowledgeCitations = Array.isArray(knowledge.recentCitations) ? knowledge.recentCitations : []
  const knowledgeSources = Array.isArray(knowledge.topSources) ? knowledge.topSources : []
  const knowledgeJobStatus = knowledge.jobStatus || { kind: "idle", label: "后台空闲", detail: "" }
  const knowledgeEvaluation = knowledge.latestEvaluation || dashboardState.knowledgeEvaluation || null
  const evaluationSummary = knowledgeEvaluation?.summary || null
  const knowledgeSearch = dashboardState.knowledgeSearch || { query: "", status: "idle", message: "", result: null }
  const knowledgeSearchRows = Array.isArray(knowledgeSearch.result?.rows) ? knowledgeSearch.result.rows : []
  const artifactIcon = (category) => {
    if (category === "共识") return "fa-clipboard-check"
    if (category === "上下文") return "fa-layer-group"
    if (category === "讨论") return "fa-comments"
    if (category === "写作资源") return "fa-feather-pointed"
    if (category === "规划") return "fa-route"
    return "fa-file-lines"
  }
  const consensusSummary = model.storyMemory.consensusSummary
    ? `<pre class="memory-pre">${escapeHtml(model.storyMemory.consensusSummary)}</pre>`
    : `<p class="memory-text">还没有形成可展示的最新共识。完成一次编剧室讨论后会自动写入并显示在这里。</p>`
  const contextPacket = model.storyMemory.contextPacket
    ? `<pre class="memory-pre memory-pre-compact">${escapeHtml(model.storyMemory.contextPacket)}</pre>`
    : `<p class="memory-text">当前还没有上下文包。下一次讨论会自动生成。</p>`
  const questions = model.storyMemory.openQuestions.length
    ? model.storyMemory.openQuestions.map((question, index) => `
        <li>
          <span class="q-num">Q${index + 1}</span>
          <span class="q-text">${escapeHtml(question)}</span>
        </li>
      `).join("")
    : `<li><span class="q-text">当前没有待决问题，随时可以继续推进。</span></li>`
  const artifactCards = artifacts.length
    ? artifacts.map((artifact) => `
      <button class="artifact-preview-card" type="button" data-artifact-path="${escapeHtml(artifact.path)}">
        <span class="artifact-preview-icon"><i class="fa-solid ${artifactIcon(artifact.category)}"></i></span>
        <span class="artifact-preview-main">
          <strong>${escapeHtml(artifact.label)}</strong>
          <small>${escapeHtml(artifact.category)} · ${escapeHtml(artifact.status || "unknown")}</small>
        </span>
        <i class="fa-solid fa-eye"></i>
      </button>
    `).join("")
    : `<p class="memory-text">形成共识、设定冻结、主线规划或写作资源后，会在这里出现可预览产物。</p>`
  const citationCards = knowledgeCitations.length
    ? knowledgeCitations.map((citation) => {
        const sourceLabels = citation.sources?.length
          ? citation.sources.map((source) => `<span>${escapeHtml(source.sourceType || "resource")} · ${escapeHtml(source.path)}</span>`).join("")
          : `<span>本次召回记录未返回具体来源。</span>`
        const createdAt = citation.createdAt ? ` · ${escapeHtml(formatClock(citation.createdAt))}` : ""
        return `
          <div class="knowledge-citation-card">
            <strong>${escapeHtml(citation.query || "未命名查询")}${createdAt}</strong>
            <small>命中 ${Number(citation.resultCount || 0)} 条，使用 ${Number(citation.usedChunkCount || 0)} 个片段</small>
            <div class="knowledge-source-list">${sourceLabels}</div>
          </div>
        `
      }).join("")
    : `<p class="memory-text">写作、讨论或章节蓝图检索知识库后，会在这里显示最近引用来源。</p>`
  const sourceChips = knowledgeSources.length
    ? knowledgeSources.map((source) => `
      <span class="knowledge-chip" title="${escapeHtml(source.path)}">
        ${escapeHtml(source.scope === "global" ? "全局" : "项目")} · ${escapeHtml(source.sourceType || "resource")}
      </span>
    `).join("")
    : `<span class="knowledge-chip is-muted">等待后台索引</span>`
  const evaluationCard = evaluationSummary
    ? `
      <div class="knowledge-evaluation-card">
        <span><strong>${Number(evaluationSummary.totalCases || 0)}</strong><small>评估样本</small></span>
        <span><strong>${Math.round(Number(evaluationSummary.hitRateAtK || 0) * 100)}%</strong><small>Hit@K</small></span>
        <span><strong>${Math.round(Number(evaluationSummary.meanRecallAtK || 0) * 100)}%</strong><small>Recall@K</small></span>
        <span><strong>${Math.round(Number(evaluationSummary.meanPrecisionAtK || 0) * 100)}%</strong><small>Precision@K</small></span>
      </div>
    `
    : `<p class="memory-text">运行召回评估后，会显示 Hit@K、Recall@K 和 Precision@K。</p>`
  const searchStatus = knowledgeSearch.message
    ? `<p class="knowledge-search-status is-${escapeHtml(knowledgeSearch.status || "idle")}">${escapeHtml(knowledgeSearch.message)}</p>`
    : ""
  const searchResults = knowledgeSearchRows.length
    ? knowledgeSearchRows.map((row) => {
        const source = row.source || {}
        const score = Number(row.score || 0).toFixed(1)
        return `
          <button class="knowledge-search-result" type="button" data-source-path="${escapeHtml(source.path || "")}">
            <span class="knowledge-search-result-head">
              <strong>${escapeHtml(source.title || source.path || row.chunkType || "knowledge")}</strong>
              <small>${escapeHtml(source.scope === "global" ? "全局" : "项目")} · ${escapeHtml(source.sourceType || "resource")} · ${escapeHtml(row.chunkType || "chunk")} · ${score}</small>
            </span>
            <span class="knowledge-search-preview">${escapeHtml(row.preview || row.content || "")}</span>
            <span class="knowledge-search-path">${escapeHtml(source.path || row.chunkId || "")}</span>
          </button>
        `
      }).join("")
    : knowledgeSearch.result
      ? `<p class="memory-text">这次查询没有命中片段。可以换成更具体的成语、场景词、人物名或章节约束。</p>`
      : `<p class="memory-text">输入一句查询，手动验证写作资源、成语、示例和项目产物是否能被召回。</p>`

  container.innerHTML = `
    <div class="memory-section">
      <span class="memory-title"><i class="fa-solid fa-lightbulb"></i> 核心 Idea</span>
      <p class="memory-text">${escapeHtml(model.storyMemory.idea)}</p>
    </div>
    <div class="memory-section">
      <span class="memory-title"><i class="fa-solid fa-clipboard-check"></i> 最新共识</span>
      ${consensusSummary}
    </div>
    <div class="memory-section">
      <span class="memory-title"><i class="fa-solid fa-layer-group"></i> 当前上下文包</span>
      ${contextPacket}
    </div>
    <div class="memory-section">
      <span class="memory-title"><i class="fa-solid fa-folder-open"></i> 已形成产物</span>
      <div class="artifact-preview-list">${artifactCards}</div>
    </div>
    <div class="memory-section">
      <div class="memory-title memory-title-action">
        <span><i class="fa-solid fa-database"></i> 知识库 / RAG</span>
        <span class="memory-action-group">
          <button class="memory-icon-button" type="button" data-knowledge-evaluate title="运行知识库召回评估">
            <i class="fa-solid fa-chart-line"></i>
          </button>
          <button class="memory-icon-button" type="button" data-knowledge-reindex title="重建知识库索引">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </span>
      </div>
      <div class="knowledge-summary-grid">
        <span><strong>${Number(knowledgeSummary.globalSources || 0)}</strong><small>全局资源</small></span>
        <span><strong>${Number(knowledgeSummary.projectSources || 0)}</strong><small>项目资源</small></span>
        <span><strong>${Number(knowledgeSummary.readyChunks || 0)}</strong><small>可召回片段</small></span>
        <span><strong>${Number(knowledgeSummary.pendingChunks || 0)}</strong><small>索引中</small></span>
      </div>
      <div class="knowledge-job-status is-${escapeHtml(knowledgeJobStatus.kind || "idle")}">
        <span><i class="fa-solid fa-circle"></i> ${escapeHtml(knowledgeJobStatus.label || "后台空闲")}</span>
        <small>${escapeHtml(knowledgeJobStatus.detail || "")}</small>
      </div>
      <div class="knowledge-chip-row">${sourceChips}</div>
      <form class="knowledge-search-form" data-knowledge-search-form>
        <input
          class="knowledge-search-input"
          type="search"
          name="query"
          value="${escapeHtml(knowledgeSearch.query || "")}"
          placeholder="检索成语、场景、人物约束"
          aria-label="检索知识库"
        >
        <button class="memory-icon-button" type="submit" title="检索知识库" ${knowledgeSearch.status === "loading" ? "disabled" : ""}>
          <i class="fa-solid ${knowledgeSearch.status === "loading" ? "fa-spinner fa-spin" : "fa-magnifying-glass"}"></i>
        </button>
      </form>
      ${searchStatus}
      <div class="knowledge-search-results">${searchResults}</div>
      ${evaluationCard}
      <div class="knowledge-citation-list">${citationCards}</div>
    </div>
    <div class="memory-section">
      <span class="memory-title"><i class="fa-solid fa-circle-question"></i> 世界观待决问题</span>
      <ul class="question-list">${questions}</ul>
    </div>
  `

  container.querySelectorAll(".artifact-preview-card").forEach((button) => {
    button.addEventListener("click", () => {
      previewArtifact(button.dataset.artifactPath || "")
    })
  })
  container.querySelector("[data-knowledge-reindex]")?.addEventListener("click", () => {
    reindexKnowledge()
  })
  container.querySelector("[data-knowledge-evaluate]")?.addEventListener("click", () => {
    evaluateKnowledge()
  })
  container.querySelector("[data-knowledge-search-form]")?.addEventListener("submit", (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    searchKnowledge(String(formData.get("query") || ""))
  })
  container.querySelectorAll(".knowledge-search-result").forEach((button) => {
    button.addEventListener("click", () => {
      const sourcePath = button.dataset.sourcePath || ""
      if (sourcePath) {
        previewArtifact(sourcePath)
      }
    })
  })
}

function chapterStatusBadge(task) {
  if (task.displayStatus === "blocked_by_previous" || task.blockedByPrevious) {
    return { klass: "badge-blocked", label: "前序阻塞", itemClass: "blocked blocked-by-previous", progress: 25 }
  }
  if (task.status === "complete") {
    return { klass: "badge-completed", label: "已完成", itemClass: "completed", progress: 100 }
  }
  if (task.status === "in_progress") {
    return { klass: "badge-writing", label: "进行中", itemClass: "writing", progress: 58 }
  }
  if (task.status === "blocked") {
    return { klass: "badge-blocked", label: "阻塞", itemClass: "blocked", progress: 0 }
  }
  return { klass: "badge-pending", label: "待完成", itemClass: "", progress: 0 }
}

function renderChapters(model) {
  const container = document.getElementById("chapter-list-container")
  const summary = model.productionSummary || {}
  const completed = Number.isFinite(Number(summary.completedChapters))
    ? Number(summary.completedChapters)
    : model.chapters.items.filter((item) => item.status === "complete").length
  const total = Number.isFinite(Number(summary.totalChapters)) && Number(summary.totalChapters) > 0
    ? Number(summary.totalChapters)
    : model.chapters.items.length
  const percentage = total ? Math.round((completed / total) * 100) : 0

  document.getElementById("total-progress-badge").textContent = `${percentage}% 已完成`
  document.getElementById("progress-total-label").textContent = `总进度 (${total}章)`
  document.getElementById("progress-percent").textContent = `${completed} / ${total} 章`
  document.getElementById("global-progress-fill").style.width = `${percentage}%`
  const draftOnlyNotice = model.productionPipeline?.transcriptDraftOnly
    ? `
      <div class="chapter-sync-notice">
        <i class="fa-solid fa-circle-info"></i>
        <span>中间讨论里的章节草稿尚未写入正式章节文件，下面显示的是 DB 中真实章节任务。</span>
      </div>
    `
    : ""
  const visibleItems = model.chapters.items
  const windowInfo = model.chapters.window || {}
  const page = Number(windowInfo.page || dashboardState.chapterPage || 1)
  const pageSize = Number(windowInfo.pageSize || dashboardState.chapterPageSize || 20)
  const pageCount = Math.max(1, Number(windowInfo.pageCount || Math.ceil(total / pageSize) || 1))
  const windowStart = Number(windowInfo.start || visibleItems[0]?.chapterNumber || 0)
  const windowEnd = Number(windowInfo.end || visibleItems.at(-1)?.chapterNumber || 0)
  const windowSize = Number(windowInfo.size || model.chapters.items.length || 0)
  const windowNotice = total > visibleItems.length
    ? `
      <div class="chapter-sync-notice">
        <i class="fa-solid fa-layer-group"></i>
        <span>当前显示第 ${windowStart || "?"}-${windowEnd || "?"} 章，共 ${windowSize} 条；总任务 ${total} 章。</span>
      </div>
    `
    : ""
  const pagination = total > pageSize
    ? `
      <div class="chapter-pagination" aria-label="章节分页">
        <button class="chapter-page-button" data-page="${Math.max(1, page - 1)}" ${page <= 1 ? "disabled" : ""} title="上一页">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <span>第 <strong>${page}</strong> / ${pageCount} 页</span>
        <button class="chapter-page-button" data-page="${Math.min(pageCount, page + 1)}" ${page >= pageCount ? "disabled" : ""} title="下一页">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
        <input class="chapter-page-input" type="number" min="1" max="${pageCount}" value="${page}" aria-label="跳转页码">
      </div>
    `
    : ""
  container.innerHTML = `${draftOnlyNotice}${pagination}${windowNotice}${visibleItems.map((task) => {
    const badge = chapterStatusBadge(task)
    const canRun = !task.blockedByPrevious && !task.recoveryBlocked && (task.status === "blocked"
      || model.workflow.currentStage.key === "drafting"
      || model.workflow.currentStage.key === "chapter_task_generation")
    const qualityGate = task.qualityGate || null
    const qualityLabel = task.blockedByPrevious
      ? "前序章节未通过，当前章节虽有成稿文件，但需等待前序修复后重校确认"
      : qualityGate
      ? `${task.recoveryBlocked ? "需人工审阅 · " : ""}评分 ${qualityGate.score}/10 · 返工 ${qualityGate.attempts || 0} 次${task.recoveryAttempts ? ` · 恢复 ${task.recoveryAttempts} 次` : ""}`
      : ""
    const blueprintPath = task.blueprintPath || ""
    return `
      <div class="chapter-task-item ${badge.itemClass}" data-chapter="${task.chapterNumber}">
        <div class="chapter-info-row">
          <span class="chapter-num">#${task.chapterNumber}</span>
          <span class="chapter-title">${escapeHtml(task.title)}</span>
          <span class="chapter-status-badge ${badge.klass}">${badge.label}</span>
        </div>
        <div class="chapter-details-row">
          <span class="word-target"><i class="fa-solid fa-file-word"></i> ${task.targetWords} 字</span>
          <span class="actions">
            <button class="btn-action chapter-blueprint-button" data-artifact-path="${escapeHtml(blueprintPath)}" ${blueprintPath ? "" : "disabled"} title="${blueprintPath ? "预览章节蓝图" : "章节蓝图尚未生成"}">
              <i class="fa-solid fa-route"></i>
            </button>
            <button class="btn-action chapter-preview-button" data-chapter="${task.chapterNumber}" title="预览正式章节文件">
              <i class="fa-solid fa-book-open"></i>
            </button>
            <button class="btn-action chapter-run-button" data-chapter="${task.chapterNumber}" data-status="${escapeHtml(task.status)}" ${canRun ? "" : "disabled"} title="${task.blockedByPrevious ? "前序章节未通过，需先修复前序章节" : task.recoveryBlocked ? "已达到恢复上限，需要人工审阅" : "执行章节任务"}">
              <i class="fa-solid ${task.recoveryBlocked ? "fa-lock" : task.status === "blocked" ? "fa-rotate-right" : "fa-play"}"></i>
            </button>
          </span>
        </div>
        ${qualityLabel ? `<div class="chapter-quality-row ${task.blockedByPrevious ? "is-blocked" : task.recoveryBlocked ? "is-limited" : qualityGate?.status === "blocked" ? "is-blocked" : ""}">${escapeHtml(qualityLabel)}</div>` : ""}
        <div class="task-progress-bar">
          <div class="task-progress-fill" style="width: ${badge.progress}%"></div>
        </div>
      </div>
    `
  }).join("")}`

  container.querySelectorAll(".chapter-run-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.status === "blocked") {
        retryChapter(Number(button.dataset.chapter || 0))
        return
      }
      runAdvance(`章节任务 #${button.dataset.chapter}`)
    })
  })
  container.querySelectorAll(".chapter-preview-button").forEach((button) => {
    button.addEventListener("click", () => {
      previewChapter(Number(button.dataset.chapter || 0))
    })
  })
  container.querySelectorAll(".chapter-blueprint-button").forEach((button) => {
    button.addEventListener("click", () => {
      previewArtifact(button.dataset.artifactPath || "")
    })
  })
  container.querySelectorAll(".chapter-page-button").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.page || page)
      setChapterPage(nextPage)
    })
  })
  container.querySelectorAll(".chapter-page-input").forEach((input) => {
    input.addEventListener("change", () => {
      const nextPage = Math.max(1, Math.min(pageCount, Number(input.value || page)))
      setChapterPage(nextPage)
    })
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        const nextPage = Math.max(1, Math.min(pageCount, Number(input.value || page)))
        setChapterPage(nextPage)
      }
    })
  })
}

async function setChapterPage(page) {
  const nextPage = Math.max(1, Number(page || 1))
  if (nextPage === dashboardState.chapterPage) {
    return
  }
  dashboardState.chapterPage = nextPage
  dashboardState.snapshotVersion = ""
  await refreshDashboard({ preserveScroll: true })
}

function renderProvider(model) {
  const statusText = document.getElementById("conn-status-text")
  const providerName = document.querySelector(".provider-name")
  const badge = document.querySelector(".provider-badge")
  providerName.textContent = `Model: ${model.provider.modelName}`
  badge.textContent = model.provider.configured ? "已配置" : "待配置"
  badge.classList.toggle("badge-primary", model.provider.configured)

  if (dashboardState.network.status === "offline") {
    statusText.innerHTML = `<i class="fa-solid fa-wifi-slash text-warning"></i> 网络已断开，正在自动重试`
  } else if (dashboardState.network.status === "recovering") {
    statusText.innerHTML = `<i class="fa-solid fa-rotate fa-spin text-warning"></i> 网络恢复中，正在重新同步`
  } else if (model.provider.testOk) {
    statusText.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> ${escapeHtml(model.provider.testMessage)}`
  } else if (!model.provider.configured) {
    statusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-warning"></i> 缺少配置: ${escapeHtml(model.provider.missing.join(", "))}`
  } else {
    statusText.innerHTML = `<i class="fa-regular fa-clock text-warning"></i> ${escapeHtml(model.provider.testMessage)}`
  }
}

function renderDiscussionHistoryBar() {
  const pagination = dashboardState.discussionPagination || {}
  const totalMessages = Number(pagination.totalMessages || dashboardState.discussionMeta?.totalEntries || 0)
  const visibleMessages = Array.isArray(dashboardState.discussionEntries) ? dashboardState.discussionEntries.length : 0
  const hasMore = Boolean(pagination.hasMore)
  const loading = Boolean(dashboardState.discussionHistoryLoading)

  if (totalMessages <= 0 && visibleMessages <= 0) {
    return ""
  }

  return `
    <div class="discussion-history-bar">
      <button class="discussion-history-button" type="button" data-load-older-messages ${hasMore && !loading ? "" : "disabled"}>
        <i class="fa-solid ${loading ? "fa-spinner fa-spin" : "fa-clock-rotate-left"}"></i>
        <span>${loading ? "正在加载" : hasMore ? "加载更早记录" : "已显示全部"}</span>
      </button>
      <span>${visibleMessages}/${totalMessages || visibleMessages} 条消息</span>
    </div>
  `
}

function ensureDiscussionShell() {
  const hasShell = Boolean(
    chatMessagesBox.querySelector("[data-discussion-history-region]")
    && chatMessagesBox.querySelector("[data-discussion-empty-region]")
    && chatMessagesBox.querySelector("[data-discussion-static-region]")
    && chatMessagesBox.querySelector("[data-discussion-result-region]")
    && chatMessagesBox.querySelector("[data-live-region]"),
  )
  if (hasShell) {
    return false
  }

  chatMessagesBox.innerHTML = `
    <div data-discussion-history-region="true"></div>
    <div data-discussion-empty-region="true"></div>
    <div data-discussion-static-region="true"></div>
    <div data-discussion-result-region="true"></div>
    <div data-live-region="true"></div>
  `
  return true
}

function patchHtmlRegion(selector, html = "") {
  const region = chatMessagesBox.querySelector(selector)
  if (!region) {
    return
  }
  const nextHtml = String(html || "").trim()
  if (region.innerHTML.trim() !== nextHtml) {
    region.innerHTML = nextHtml
  }
}

function createElementFromHtml(html = "") {
  const template = document.createElement("template")
  template.innerHTML = String(html || "").trim()
  return template.content.firstElementChild
}

function copyElementAttributes(currentNode, nextNode) {
  if (!currentNode || !nextNode) {
    return
  }

  Array.from(currentNode.attributes).forEach((attribute) => {
    if (!nextNode.hasAttribute(attribute.name)) {
      currentNode.removeAttribute(attribute.name)
    }
  })
  Array.from(nextNode.attributes).forEach((attribute) => {
    if (currentNode.getAttribute(attribute.name) !== attribute.value) {
      currentNode.setAttribute(attribute.name, attribute.value)
    }
  })
}

function patchElementInnerHtml(currentNode, nextNode) {
  if (!currentNode || !nextNode) {
    return false
  }
  copyElementAttributes(currentNode, nextNode)
  if (currentNode.innerHTML !== nextNode.innerHTML) {
    currentNode.innerHTML = nextNode.innerHTML
  }
  return true
}

function discussionActionKey(node) {
  if (!node) {
    return ""
  }
  if (node.classList?.contains("message-artifact-button")) {
    return "artifact"
  }
  if (node.classList?.contains("message-expand-button")) {
    return "expand"
  }
  return node.getAttribute?.("data-action-key") || `${node.tagName || "node"}:${node.className || ""}`
}

function patchBubbleActions(currentBubble, nextBubble) {
  const currentActions = Array.from(currentBubble.children)
    .filter((node) => !node.classList.contains("message-bubble-content"))
  const nextActions = Array.from(nextBubble.children)
    .filter((node) => !node.classList.contains("message-bubble-content"))
  const activeKeys = new Set()

  nextActions.forEach((nextAction) => {
    const key = discussionActionKey(nextAction)
    if (!key) {
      return
    }
    activeKeys.add(key)
    const currentAction = currentActions.find((node) => discussionActionKey(node) === key)
    if (!currentAction) {
      currentBubble.appendChild(nextAction.cloneNode(true))
      return
    }
    copyElementAttributes(currentAction, nextAction)
    if (currentAction.innerHTML !== nextAction.innerHTML) {
      currentAction.innerHTML = nextAction.innerHTML
    }
  })

  currentActions.forEach((node) => {
    const key = discussionActionKey(node)
    if (!key || !activeKeys.has(key)) {
      node.remove()
    }
  })

  nextActions.forEach((nextAction) => {
    const key = discussionActionKey(nextAction)
    const currentAction = Array.from(currentBubble.children)
      .find((node) => !node.classList.contains("message-bubble-content") && discussionActionKey(node) === key)
    if (currentAction) {
      currentBubble.appendChild(currentAction)
    }
  })
}

function patchDiscussionEntryNode(currentNode, nextNode) {
  if (!currentNode || !nextNode) {
    return false
  }

  if (currentNode.tagName !== nextNode.tagName) {
    currentNode.replaceWith(nextNode)
    return true
  }

  copyElementAttributes(currentNode, nextNode)
  patchElementInnerHtml(currentNode.querySelector(".message-avatar"), nextNode.querySelector(".message-avatar"))
  patchElementInnerHtml(currentNode.querySelector(".message-info"), nextNode.querySelector(".message-info"))

  const currentBubble = currentNode.querySelector(".message-bubble")
  const nextBubble = nextNode.querySelector(".message-bubble")
  if (!currentBubble || !nextBubble) {
    if (currentNode.innerHTML !== nextNode.innerHTML) {
      currentNode.innerHTML = nextNode.innerHTML
    }
    return true
  }

  copyElementAttributes(currentBubble, nextBubble)
  const currentContent = currentBubble.querySelector(".message-bubble-content")
  const nextContent = nextBubble.querySelector(".message-bubble-content")
  if (!patchElementInnerHtml(currentContent, nextContent)) {
    currentBubble.innerHTML = nextBubble.innerHTML
    return true
  }
  patchBubbleActions(currentBubble, nextBubble)
  return true
}

function patchDiscussionEntries(region, entries = []) {
  if (!region) {
    return
  }

  const activeKeys = new Set()
  entries.forEach((entry, index) => {
    const nextNode = createElementFromHtml(renderDiscussionEntryHtml({
      entry,
      index,
      roleMeta,
      expandedKeys: dashboardState.expandedDiscussionKeys,
      formatClock: formatDiscussionClock,
    }))
    if (!nextNode) {
      return
    }

    const entryKey = nextNode.getAttribute("data-live-entry-key")
    if (!entryKey) {
      region.appendChild(nextNode)
      return
    }
    activeKeys.add(entryKey)

    const currentNode = Array.from(region.children)
      .find((node) => node.getAttribute("data-live-entry-key") === entryKey)
    if (currentNode) {
      patchDiscussionEntryNode(currentNode, nextNode)
    } else {
      region.appendChild(nextNode)
    }

    const renderedNode = Array.from(region.children)
      .find((node) => node.getAttribute("data-live-entry-key") === entryKey)
    if (renderedNode && region.children[index] !== renderedNode) {
      region.insertBefore(renderedNode, region.children[index] || null)
    }
  })

  Array.from(region.children).forEach((node) => {
    const entryKey = node.getAttribute("data-live-entry-key")
    if (entryKey && !activeKeys.has(entryKey)) {
      node.remove()
    }
  })
}

function renderDiscussion(model) {
  const liveIdentities = persistedEntryIdentitySet(dashboardState.liveDiscussion)
  const staticEntries = buildRenderableDiscussionEntries({
    recentEntries: model.discussion.recent,
  }).filter((entry) => {
    const identity = entryIdentity(entry)
    return !identity || !liveIdentities.has(identity)
  })
  const hasLiveEntries = dashboardState.pendingUserMessages.length > 0 || dashboardState.liveDiscussion.length > 0
  const entrySignature = staticEntries
    .map((entry) => [
      entry.key || entry.turnId || "",
      entry.role || "",
      entry.timestamp || "",
      entry.status || "",
      entry.streaming ? "streaming" : "",
      entry.data?.phase || entry.metadata?.phase || "",
      entry.data?.statusText || entry.metadata?.statusText || "",
      stableTextHash(entry.content || ""),
    ].join(":"))
    .join("|")
  const resultSignature = dashboardState.lastDiscussionResult
    ? `${dashboardState.lastDiscussionResult.target?.assetPath || ""}:${stableTextHash(dashboardState.lastDiscussionResult.summary || "")}`
    : ""
  const expandedSignature = [...dashboardState.expandedDiscussionKeys].sort().join("|")
  const signature = `${entrySignature}::${resultSignature}::${expandedSignature}`
  const shellCreated = ensureDiscussionShell()
  const shouldStickBottom = dashboardState.discussionAutoStickToBottom

  patchHtmlRegion("[data-discussion-history-region]", renderDiscussionHistoryBar())
  patchHtmlRegion(
    "[data-discussion-empty-region]",
    staticEntries.length === 0 && !hasLiveEntries
      ? `<div class="system-log-message">
        <i class="fa-solid fa-circle-info"></i>
        <span class="log-text">当前还没有讨论记录。输入一句想法，编剧室会实时开始讨论。</span>
      </div>`
      : "",
  )

  if (shellCreated || dashboardState.discussionStaticSignature !== signature) {
    dashboardState.discussionStaticSignature = signature
    patchDiscussionEntries(chatMessagesBox.querySelector("[data-discussion-static-region]"), staticEntries)
    patchHtmlRegion("[data-discussion-result-region]", renderDiscussionHtml({
      result: dashboardState.lastDiscussionResult,
      entries: [],
      roleMeta,
      expandedKeys: dashboardState.expandedDiscussionKeys,
      formatClock: formatDiscussionClock,
    }))
  }
  renderLiveDiscussionPatch()

  if (shouldStickBottom) {
    chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight
  }
}

function renderLiveDiscussionPatch() {
  const liveRegion = chatMessagesBox.querySelector("[data-live-region]")
  if (!liveRegion) {
    return
  }

  const liveEntries = buildRenderableDiscussionEntries({
    recentEntries: [],
    pendingUserMessages: dashboardState.pendingUserMessages,
    liveDiscussion: dashboardState.liveDiscussion,
  })

  if (liveEntries.length === 0) {
    liveRegion.innerHTML = ""
    return
  }

  const shouldStickBottom = dashboardState.discussionAutoStickToBottom
  patchDiscussionEntries(liveRegion, liveEntries)

  if (shouldStickBottom) {
    chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight
  }
}

function ensureLiveRegion() {
  ensureDiscussionShell()
}

function renderInitPanel(model) {
  initPanel.classList.toggle("hidden", model.initialized)
}

function renderDashboard() {
  const model = deriveStudioViewModel({
    state: dashboardState.state,
    transcript: dashboardState.transcript,
    discussionEntries: dashboardState.discussionEntries,
    consensus: dashboardState.consensus,
    contextPacket: dashboardState.contextPacket,
    factorySnapshot: dashboardState.factorySnapshot,
    envStatus: dashboardState.envStatus,
    providerResult: dashboardState.providerResult,
  })

  renderProjectCard(model)
  renderWorkflow(model)
  renderStoryMemory(model)
  renderProvider(model)
  renderChapters(model)
  renderDiscussion(model)
  renderInitPanel(model)
  renderComposerStatus()
}

function renderDiscussionOnly() {
  const model = deriveStudioViewModel({
    state: dashboardState.state,
    transcript: dashboardState.transcript,
    discussionEntries: dashboardState.discussionEntries,
    consensus: dashboardState.consensus,
    contextPacket: dashboardState.contextPacket,
    factorySnapshot: dashboardState.factorySnapshot,
    envStatus: dashboardState.envStatus,
    providerResult: dashboardState.providerResult,
  })
  renderDiscussion(model)
}

function scheduleDiscussionRender() {
  if (dashboardState.discussionRenderFrame) {
    return
  }

  dashboardState.discussionRenderFrame = window.requestAnimationFrame(() => {
    dashboardState.discussionRenderFrame = null
    if (chatMessagesBox.querySelector("[data-live-region]")) {
      renderLiveDiscussionPatch()
      return
    }
    renderDiscussionOnly()
  })
}

async function refreshDashboard(options = {}) {
  if (!dashboardState.activeProjectId) {
    showManagerView()
    return
  }

  const params = new URLSearchParams({ projectId: dashboardState.activeProjectId })
  params.set("chapterPage", String(dashboardState.chapterPage || 1))
  params.set("chapterPageSize", String(dashboardState.chapterPageSize || 20))
  if (!options.includeTranscript && !options.includeDiscussionHistory && dashboardState.snapshotVersion) {
    params.set("knownSnapshotVersion", dashboardState.snapshotVersion)
  }
  const response = await apiRequest(`/api/status?${params.toString()}`)
  if (response.ok && response.payload?.notModified) {
    if (typeof response.payload.snapshotVersion === "string") {
      dashboardState.snapshotVersion = response.payload.snapshotVersion
    }
    renderAutopilotControls()
    return
  }
  updateSnapshot(response.payload)
  if (response.ok) {
    if (options.includeTranscript || options.includeDiscussionHistory) {
      await loadDiscussionHistory({ silent: true })
    }
    showStudioView()
    renderDashboard()
    if (!options.silent) {
      const signature = dashboardProgressSignature()
      if (signature !== dashboardState.lastStatusLogSignature) {
        dashboardState.lastStatusLogSignature = signature
        addLog(`工作流状态已刷新：${dashboardState.state?.runtime?.stage || "unknown"}`)
      }
    }
    return
  }

  if (response.status === 409) {
    showManagerView()
    addLog("当前存在多个小说项目，请先在项目管理页选择一个。")
    return
  }

  if (response.status === 404) {
    addLog("当前目录还没有初始化 .ai-novel 工作区。")
    showManagerView()
    return
  }

  renderDashboard()
}

async function loadDiscussionHistory(options = {}) {
  if (!dashboardState.activeProjectId) {
    return
  }
  const params = new URLSearchParams({
    projectId: dashboardState.activeProjectId,
    limit: String(options.limit || DISCUSSION_PAGE_SIZE),
  })
  if (Number.isFinite(Number(options.offset)) && Number(options.offset) > 0) {
    params.set("offset", String(Number(options.offset)))
  }
  const response = await apiRequest(`/api/messages?${params.toString()}`)
  if (response.ok) {
    updateSnapshot({ ...response.payload, appendDiscussionHistory: Boolean(options.append) })
    return
  }

  const fallbackResponse = await apiRequest(`/api/transcript?${params.toString()}`)
  if (fallbackResponse.ok) {
    updateSnapshot({ ...fallbackResponse.payload, appendDiscussionHistory: Boolean(options.append) })
    if (!options.silent) {
      addLog("已从兼容讨论记录加载历史；新项目会优先使用消息系统。")
    }
    return
  }

  if (!options.silent) {
    addLog("讨论历史暂时无法加载，状态同步不受影响。")
  }
}

async function loadOlderDiscussionHistory() {
  const pagination = dashboardState.discussionPagination || {}
  if (!pagination.hasMore || dashboardState.discussionHistoryLoading) {
    return
  }

  dashboardState.discussionHistoryLoading = true
  renderDiscussionOnly()
  try {
    await loadDiscussionHistory({
      silent: true,
      append: true,
      limit: pagination.limit || DISCUSSION_PAGE_SIZE,
      offset: pagination.nextOffset ?? (Number(pagination.offset || 0) + Number(pagination.returned || 0)),
    })
  } catch (error) {
    addLog(`更早讨论记录加载失败：${networkErrorMessage(error)}`)
  } finally {
    dashboardState.discussionHistoryLoading = false
    renderDiscussionOnly()
  }
}

async function runProviderTest() {
  addLog("开始测试模型连通性...")
  let response
  try {
    response = await apiRequest("/api/provider-test", {
      method: "POST",
      body: dashboardState.activeProjectId ? { projectId: dashboardState.activeProjectId } : null,
    })
  } catch (error) {
    addLog(`模型连通性测试暂时失败：${networkErrorMessage(error)}`)
    return
  }
  dashboardState.providerResult = response.payload?.result || dashboardState.providerResult
  dashboardState.envStatus = response.payload?.envStatus || dashboardState.envStatus
  dashboardState.projects = Array.isArray(response.payload?.projects) ? response.payload.projects : dashboardState.projects
  if (dashboardState.currentView === "studio") {
    renderDashboard()
  } else {
    renderManagerView()
  }
  addLog(response.payload?.result?.message || "模型测试完成。")
}

async function runAdvance(label = "workflow") {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  addLog(`推进工作流：${label}`)
  let response
  try {
    response = await apiRequest("/api/advance", {
      method: "POST",
      body: { projectId: dashboardState.activeProjectId },
    })
  } catch (error) {
    addLog(`推进暂时中断：${networkErrorMessage(error)}。恢复连接后可继续。`)
    return
  }
  updateSnapshot(response.payload)
  renderDashboard()
  if (response.payload?.recoveryLimited) {
    addLog(`第 ${chapterNumber} 章已达到自动恢复上限，需要人工审阅后再继续。`)
  }
}

async function retryChapter(chapterNumber) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  if (!chapterNumber) {
    addLog("章节编号无效，无法重新生产。")
    return
  }
  addLog(`重新生产第 ${chapterNumber} 章，执行质量返工闭环。`)
  let response
  try {
    response = await apiRequest("/api/chapters/retry", {
      method: "POST",
      body: { projectId: dashboardState.activeProjectId, chapterNumber, runNow: true },
    })
  } catch (error) {
    addLog(`章节重试暂时中断：${networkErrorMessage(error)}。恢复连接后可继续。`)
    return
  }
  updateSnapshot(response.payload)
  renderDashboard()
}

async function reindexKnowledge(scope = "all") {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    setComposerStatus("warning", "请先选择一个小说项目。")
    return
  }
  addLog("正在排队重建知识库索引...")
  setComposerStatus("processing", "正在把知识库重建任务写入后台队列。", { busy: true })
  let response
  try {
    response = await apiRequest("/api/knowledge/reindex", {
      method: "POST",
      body: { projectId: dashboardState.activeProjectId, scope },
    })
  } catch (error) {
    setComposerStatus("warning", `知识库重建请求未送达：${networkErrorMessage(error)}。`)
    addLog(`知识库重建请求暂时中断：${networkErrorMessage(error)}。`)
    return
  }
  updateSnapshot(response.payload)
  renderDashboard()
  const queued = Array.isArray(response.payload?.queuedKnowledgeJobs)
    ? response.payload.queuedKnowledgeJobs.length
    : 0
  resetComposerStatusSoon(`知识库重建已排队：${queued} 个后台任务。`)
  addLog(`知识库重建已排队：${queued} 个后台任务。`)
}

async function evaluateKnowledge() {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    setComposerStatus("warning", "请先选择一个小说项目。")
    return
  }
  addLog("正在运行知识库召回评估...")
  setComposerStatus("processing", "正在评估知识库召回命中率。", { busy: true })
  let response
  try {
    response = await apiRequest("/api/knowledge/evaluate", {
      method: "POST",
      body: { projectId: dashboardState.activeProjectId, k: 8 },
    })
  } catch (error) {
    setComposerStatus("warning", `知识库评估请求未送达：${networkErrorMessage(error)}。`)
    addLog(`知识库评估请求暂时中断：${networkErrorMessage(error)}。`)
    return
  }
  if (!response.ok) {
    const message = response.payload?.message || response.payload?.error || "知识库评估失败。"
    setComposerStatus("warning", String(message))
    addLog(String(message))
    return
  }
  updateSnapshot(response.payload)
  renderDashboard()
  const summary = response.payload?.knowledgeEvaluation?.summary || {}
  const caseCount = Number(summary.totalCases || 0)
  const hitRate = Math.round(Number(summary.hitRateAtK || 0) * 100)
  const recall = Math.round(Number(summary.meanRecallAtK || 0) * 100)
  resetComposerStatusSoon(`知识库评估完成：${caseCount} 个样本，Hit@K ${hitRate}%，Recall@K ${recall}%。`)
  addLog(`知识库评估完成：${caseCount} 个样本，Hit@K ${hitRate}%，Recall@K ${recall}%。`)
}

async function searchKnowledge(query) {
  const normalizedQuery = String(query || "").trim()
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    setComposerStatus("warning", "请先选择一个小说项目。")
    return
  }
  if (!normalizedQuery) {
    dashboardState.knowledgeSearch = {
      query: "",
      status: "warning",
      message: "请输入要检索的成语、场景、设定或章节约束。",
      result: null,
    }
    renderDashboard()
    return
  }

  dashboardState.knowledgeSearch = {
    ...dashboardState.knowledgeSearch,
    query: normalizedQuery,
    status: "loading",
    message: "正在检索知识库片段...",
  }
  renderDashboard()
  setComposerStatus("processing", "正在检索知识库片段。", { busy: true })

  let response
  try {
    response = await apiRequest("/api/knowledge/search", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        query: normalizedQuery,
        scopes: ["global", "project"],
        limit: 8,
      },
    })
  } catch (error) {
    dashboardState.knowledgeSearch = {
      ...dashboardState.knowledgeSearch,
      status: "warning",
      message: `知识库检索请求未送达：${networkErrorMessage(error)}。`,
    }
    renderDashboard()
    setComposerStatus("warning", dashboardState.knowledgeSearch.message)
    addLog(dashboardState.knowledgeSearch.message)
    return
  }

  if (!response.ok) {
    const message = String(response.payload?.message || response.payload?.error || "知识库检索失败。")
    dashboardState.knowledgeSearch = {
      ...dashboardState.knowledgeSearch,
      status: "warning",
      message,
    }
    renderDashboard()
    setComposerStatus("warning", message)
    addLog(message)
    return
  }

  updateSnapshot(response.payload)
  const result = response.payload?.knowledgeSearch || null
  const total = Number(result?.total || 0)
  dashboardState.knowledgeSearch = {
    query: normalizedQuery,
    status: "success",
    message: `知识库检索完成，命中 ${total} 个片段。`,
    result,
  }
  renderDashboard()
  resetComposerStatusSoon(`知识库检索完成：命中 ${total} 个片段。`)
  addLog(`知识库检索完成：${normalizedQuery}，命中 ${total} 个片段。`)
}

function closeChapterPreviewModal() {
  chapterPreviewModal?.classList.add("hidden")
}

function renderPreviewContent(key, role, content) {
  return renderDiscussionEntryContentHtml({
    key,
    role,
    content: content || "",
    streaming: false,
  }, {
    entryKey: key,
    expandedKeys: new Set([key]),
  }).html
}

async function previewArtifact(path) {
  if (!path || !dashboardState.activeProjectId) {
    return
  }

  chapterPreviewTitle.textContent = "产物预览"
  chapterPreviewPath.textContent = path
  chapterPreviewBody.innerHTML = `<div class="modal-status is-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>正在读取产物...</span></div>`
  chapterPreviewModal.classList.remove("hidden")

  try {
    const params = new URLSearchParams({
      projectId: dashboardState.activeProjectId,
      path,
    })
    const response = await apiRequest(`/api/artifacts/preview?${params.toString()}`)
    if (!response.ok) {
      chapterPreviewBody.innerHTML = `
        <div class="modal-status is-error">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>没有找到这个产物文件。DB 记录仍在，但对应 artifact/cache 文件可能尚未生成或已移动。</span>
        </div>
      `
      return
    }
    const fileName = String(response.payload.path || path).split("/").pop() || "产物"
    chapterPreviewTitle.textContent = fileName
    chapterPreviewPath.textContent = response.payload.path || path
    chapterPreviewBody.innerHTML = renderPreviewContent(`artifact-preview-${stableTextHash(path)}`, "Showrunner", response.payload.content || "")
  } catch (error) {
    chapterPreviewBody.innerHTML = `
      <div class="modal-status is-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>${escapeHtml(error instanceof Error ? error.message : String(error))}</span>
      </div>
    `
  }
}

async function previewChapter(chapterNumber) {
  if (!chapterNumber || !dashboardState.activeProjectId) {
    return
  }

  chapterPreviewTitle.textContent = `第 ${chapterNumber} 章预览`
  chapterPreviewPath.textContent = "正在读取正式章节文件..."
  chapterPreviewBody.innerHTML = `<div class="modal-status is-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>正在读取章节正文...</span></div>`
  chapterPreviewModal.classList.remove("hidden")

  try {
    const params = new URLSearchParams({
      projectId: dashboardState.activeProjectId,
      chapterNumber: String(chapterNumber),
    })
    const response = await apiRequest(`/api/chapters/preview?${params.toString()}`)
    if (!response.ok) {
      chapterPreviewPath.textContent = `.ai-novel/chapters/chapter-${String(chapterNumber).padStart(3, "0")}.final.md`
      chapterPreviewBody.innerHTML = `
        <div class="modal-status is-error">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>没有找到正式成稿文件。讨论文本里的章节内容不会被当作生产章节。</span>
        </div>
      `
      return
    }
    chapterPreviewTitle.textContent = `第 ${response.payload.chapterNumber} 章预览`
    chapterPreviewPath.textContent = response.payload.path || "正式章节文件"
    chapterPreviewBody.innerHTML = renderPreviewContent(`chapter-preview-${chapterNumber}`, "Author", response.payload.content || "")
  } catch (error) {
    chapterPreviewBody.innerHTML = `
      <div class="modal-status is-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>${escapeHtml(error instanceof Error ? error.message : String(error))}</span>
      </div>
    `
  }
}

async function runCover() {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  addLog("准备封面生成任务...")
  let response
  try {
    response = await apiRequest("/api/cover", {
      method: "POST",
      body: { projectId: dashboardState.activeProjectId },
    })
  } catch (error) {
    addLog(`封面任务暂时中断：${networkErrorMessage(error)}。`)
    return
  }
  updateSnapshot(response.payload)
  renderDashboard()
}

async function runInterrupt(message) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  if (dashboardState.autopilotActive) {
    await requestStopAutopilot()
  }
  addLog(`收到中断调整：${message}`)
  let response
  try {
    response = await apiRequest("/api/interrupt", {
      method: "POST",
      body: { message, projectId: dashboardState.activeProjectId },
    })
  } catch (error) {
    addLog(`中断调整暂时无法提交：${networkErrorMessage(error)}。网络恢复后请重新提交。`)
    return
  }
  updateSnapshot(response.payload)
  renderDashboard()
}

function parseEnvAssignments(text) {
  const tokens = text.split(/\s+/).filter(Boolean)
  const updates = {}

  for (const token of tokens) {
    const separator = token.indexOf("=")
    if (separator <= 0) continue
    const key = token.slice(0, separator)
    const value = token.slice(separator + 1)
    if (!value) continue
    if (key === "base_url") updates.LLM_BASE_URL = value
    if (key === "api_key") updates.LLM_API_KEY = value
    if (key === "model") updates.LLM_MODEL_ID = value
  }

  return updates
}

async function runModalProviderTest() {
  const payload = {
    LLM_BASE_URL: providerBaseUrlInput.value.trim(),
    LLM_API_KEY: providerApiKeyInput.value.trim(),
    LLM_MODEL_ID: providerModelInput.value.trim(),
  }

  setProviderModalStatus("is-loading", "正在测试当前输入的模型配置...")
  let response
  try {
    response = await apiRequest("/api/provider-test", {
      method: "POST",
      body: payload,
    })
  } catch (error) {
    setProviderModalStatus("is-error", `网络连接中断：${networkErrorMessage(error)}。系统会自动重试。`)
    return
  }
  const result = response.payload?.result
  if (result?.ok) {
    setProviderModalStatus("is-success", result.message)
    addLog(`模型测试成功：${result.modelName}`)
    return
  }

  setProviderModalStatus("is-error", result?.message || "模型测试失败。")
  addLog(result?.message || "模型测试失败。")
}

async function saveProviderConfigFromModal() {
  const payload = {
    LLM_BASE_URL: providerBaseUrlInput.value.trim(),
    LLM_API_KEY: providerApiKeyInput.value.trim(),
    LLM_MODEL_ID: providerModelInput.value.trim(),
  }

  setProviderModalStatus("is-loading", "正在保存当前配置到 .env ...")
  let response
  try {
    response = await apiRequest("/api/env", {
      method: "POST",
      body: payload,
    })
  } catch (error) {
    setProviderModalStatus("is-error", `配置暂时无法保存：${networkErrorMessage(error)}。`)
    return
  }
  dashboardState.envStatus = response.payload?.envStatus || dashboardState.envStatus
  setProviderModalStatus("is-success", "配置已保存到当前目录的 .env。")
  addLog("已保存 provider 配置到 .env。")
  await refreshDashboard()
  window.setTimeout(() => closeProviderModal(), 500)
}

async function streamChat(message) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    setComposerStatus("warning", "请先选择一个小说项目。")
    return
  }

  setComposerStatus("sent", "消息已发送，正在交给编剧室 agent。", { busy: true })
  appendPendingUserMessage(message)
  dashboardState.lastDiscussionResult = null
  renderDiscussionOnly()
  addLog(`编剧室开始讨论：${message}`)

  let response
  try {
    setComposerStatus("processing", "正在连接讨论流，等待 agent 响应。", { busy: true })
    response = await fetch("/api/chat-stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, projectId: dashboardState.activeProjectId }),
    })
  } catch (error) {
    if (isNetworkError(error)) {
      markNetworkOffline(error)
    }
    setComposerStatus("warning", `讨论流连接中断：${networkErrorMessage(error)}。恢复连接后会同步记录。`)
    addLog(`讨论流连接中断：${networkErrorMessage(error)}。网络恢复后会同步已保存记录。`)
    return
  }

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}))
    setComposerStatus("error", payload.error || `讨论失败 (${response.status})`)
    addLog(payload.error || `讨论失败 (${response.status})`)
    acknowledgePendingMessages(currentPersistedDiscussionEntries())
    renderDiscussionOnly()
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  setComposerStatus("processing", "消息已送达，agent 正在讨论。", { busy: true })

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      while (buffer.includes("\n\n")) {
        const separator = buffer.indexOf("\n\n")
        const chunk = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)
        handleSseChunk(chunk)
      }
    }
  } catch (error) {
    if (isNetworkError(error)) {
      markNetworkOffline(error)
    }
    setComposerStatus("warning", `讨论流已断开：${networkErrorMessage(error)}。恢复连接后会刷新记录。`)
    addLog(`讨论流已断开：${networkErrorMessage(error)}。恢复连接后会刷新最新讨论记录。`)
  } finally {
    if (dashboardState.composerStatus.busy) {
      resetComposerStatusSoon("讨论已结束或已保存。")
    }
  }
}

async function streamAutopilot(message, options = {}) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    setComposerStatus("warning", "请先选择一个小说项目。")
    return
  }

  if (message) {
    setComposerStatus("sent", "消息已提交，正在创建无人值守任务。", { busy: true })
  } else if (options.resume) {
    setComposerStatus("processing", "正在恢复无人值守任务监听。", { busy: true })
  }
  dashboardState.autopilotActive = true
  dashboardState.autopilotStreamConnected = true
  if (message) {
    appendPendingUserMessage(message)
  }
  dashboardState.lastDiscussionResult = null
  renderDashboard()
  if (message) {
    appendLiveStatusCard("你的指令已显示在聊天区，正在提交到无人值守后台任务。")
  }
  addLog(message
    ? `无人值守自动创作开始：${message}`
    : options.resume
      ? "正在手动继续无人值守自动创作。"
      : "无人值守自动创作继续运行。")

  if (!options.skipStart && (message || !dashboardState.state?.runtime?.autopilot?.running)) {
    let startResponse
    try {
      setComposerStatus("processing", "正在把消息写入任务队列。", { busy: true })
      startResponse = await apiRequest("/api/autopilot/start", {
        method: "POST",
        body: { message, projectId: dashboardState.activeProjectId },
      })
    } catch (error) {
      dashboardState.autopilotStreamConnected = false
      setComposerStatus("warning", `启动请求未送达：${networkErrorMessage(error)}。网络恢复后会自动重试连接。`)
      renderDashboard()
      addLog(`无人值守启动请求暂时失败：${networkErrorMessage(error)}。网络恢复后会自动重试连接。`)
      return
    }
    updateSnapshot(startResponse.payload)
    setComposerStatus("processing", "任务已写入数据库，后台 agent/worker 正在处理。")
    appendLiveStatusCard("指令已写入数据库任务队列；如果已有后台任务，会复用原任务继续处理。")
    renderDashboard()
  } else if (options.skipStart) {
    setComposerStatus("processing", "已发现数据库中的无人值守任务，正在连接状态流。", { busy: true })
    appendLiveStatusCard("检测到数据库中已有无人值守任务，正在连接统一管理者的状态流。")
  }

  let response
  try {
    if (dashboardState.composerStatus.busy) {
      setComposerStatus("processing", "正在连接无人值守状态流。", { busy: true })
    }
    response = await fetch("/api/autopilot-stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: dashboardState.activeProjectId }),
    })
  } catch (error) {
    dashboardState.autopilotStreamConnected = false
    setComposerStatus("warning", `实时连接断开：${networkErrorMessage(error)}。后台任务会保留。`)
    renderDashboard()
    if (isNetworkError(error)) {
      markNetworkOffline(error)
    }
    addLog(`无人值守实时连接断开：${networkErrorMessage(error)}。后台任务会保留，网络恢复后自动重连。`)
    return
  }

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}))
    setComposerStatus("error", payload.error || `实时订阅失败 (${response.status})，后台任务仍可能继续运行。`)
    addLog(payload.error || `实时订阅失败 (${response.status})，后台任务仍可能继续运行。`)
    acknowledgePendingMessages(currentPersistedDiscussionEntries())
    dashboardState.autopilotStreamConnected = false
    renderDashboard()
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  setComposerStatus("processing", "已连接，后台任务正在处理；你仍可继续输入或主动暂停。")

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      while (buffer.includes("\n\n")) {
        const separator = buffer.indexOf("\n\n")
        const chunk = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)
        handleSseChunk(chunk)
      }
    }
  } catch (error) {
    if (isNetworkError(error)) {
      markNetworkOffline(error)
    }
    setComposerStatus("warning", `无人值守实时连接已断开：${networkErrorMessage(error)}。恢复后会重新订阅。`)
    addLog(`无人值守实时连接已断开：${networkErrorMessage(error)}。网络恢复后会自动重新订阅。`)
  } finally {
    dashboardState.autopilotStreamConnected = false
    renderAutopilotControls()
    if (dashboardState.composerStatus.busy) {
      resetComposerStatusSoon("无人值守任务状态已同步。")
    }
  }
}

async function requestStopAutopilot() {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    setComposerStatus("warning", "请先选择一个小说项目。")
    return
  }

  setComposerStatus("processing", "正在发送暂停请求。", { busy: true })
  addLog("正在请求暂停自动创作...")
  let response
  try {
    response = await apiRequest("/api/stop", {
      method: "POST",
      body: { projectId: dashboardState.activeProjectId },
    })
  } catch (error) {
    setComposerStatus("warning", `暂停请求未送达：${networkErrorMessage(error)}。恢复连接后请再次暂停。`)
    addLog(`暂停请求暂时无法送达：${networkErrorMessage(error)}。恢复连接后请再次暂停。`)
    return
  }
  updateSnapshot(response.payload)
  resetComposerStatusSoon("暂停请求已送达，任务状态已同步。")
  renderDashboard()
}

function startAutopilotFromButton() {
  if (dashboardState.autopilotStreamConnected) {
    setComposerStatus("warning", "自动创作状态流已经连接。")
    return
  }
  setComposerStatus("processing", "正在手动开始自动创作。", { busy: true })
  streamAutopilot("", { resume: true }).catch((error) => {
    addLog(error instanceof Error ? error.message : String(error))
  })
}

function handleSseChunk(chunk) {
  const lines = chunk.split("\n")
  const eventLine = lines.find((line) => line.startsWith("event:"))
  const dataLines = lines.filter((line) => line.startsWith("data:"))
  if (!eventLine || dataLines.length === 0) {
    return
  }

  const eventName = eventLine.slice("event:".length).trim()
  const data = JSON.parse(dataLines.map((line) => line.slice("data:".length).trim()).join("\n"))

  if (eventName === "agent") {
    setComposerStatus("processing", "agent 已开始输出，正在接收讨论内容。", { busy: true })
    dashboardState.liveDiscussion = applyLiveDiscussionEvent(dashboardState.liveDiscussion, eventName, data)
    scheduleDiscussionRender()
    return
  }

  if (eventName === "agent_start" || eventName === "agent_delta" || eventName === "agent_complete" || eventName === "agent_error") {
    if (eventName === "agent_start") {
      setComposerStatus(
        "processing",
        dashboardState.autopilotActive
          ? `${data.role || "Agent"} 已接收无人值守任务，后台运行中。`
          : `${data.role || "Agent"} 已接收消息，正在处理。`,
        { busy: !dashboardState.autopilotActive },
      )
    } else if (eventName === "agent_delta") {
      const now = Date.now()
      if (now - dashboardState.lastAgentDeltaStatusAt > 1000) {
        dashboardState.lastAgentDeltaStatusAt = now
        setComposerStatus(
          "processing",
          dashboardState.autopilotActive
            ? "无人值守自动创作正在后台运行；可继续输入，暂停请发 /stop。"
            : `${data.role || "Agent"} 正在输出内容。`,
          { busy: !dashboardState.autopilotActive },
        )
      }
    } else if (eventName === "agent_complete") {
      setComposerStatus(
        "processing",
        dashboardState.autopilotActive
          ? `${data.role || "Agent"} 输出已保存，后台继续推进。`
          : `${data.role || "Agent"} 输出已保存，正在同步状态。`,
          { busy: !dashboardState.autopilotActive },
        )
    } else if (eventName === "agent_error") {
      setComposerStatus("error", `${data.role || "Agent"} 请求失败：${data.error || "已记录错误。"}`)
      addLog(`${data.role || "Agent"} 请求失败：${data.error || "已记录错误。"}`)
    }
    dashboardState.liveDiscussion = applyLiveDiscussionEvent(dashboardState.liveDiscussion, eventName, data)
    scheduleDiscussionRender()
    return
  }

  if (eventName === "autopilot_status") {
    const statusSignature = `${data.dedupeKey || ""}:${data.stage || ""}:${data.message || ""}`
    const now = Date.now()
    if (statusSignature === dashboardState.lastAutopilotStatusSignature && now - dashboardState.lastAutopilotStatusAt < 10000) {
      return
    }
    dashboardState.lastAutopilotStatusSignature = statusSignature
    dashboardState.lastAutopilotStatusAt = now
    setComposerStatus("processing", data.message || "自动创作任务正在处理。")
    addLog(data.message || "自动创作状态更新。")
    dashboardState.liveDiscussion = applyLiveDiscussionEvent(dashboardState.liveDiscussion, eventName, data)
    scheduleDiscussionRender()
    return
  }

  if (eventName === "writing_progress") {
    const chapterLabel = data.chapterNumber ? `第 ${data.chapterNumber} 章` : "写作流水线"
    setComposerStatus("processing", `${chapterLabel}：${data.message || "正在写作。"} `)
    addLog(`${chapterLabel}：${data.message || data.step || "写作进度更新。"}`)
    dashboardState.liveDiscussion = applyLiveDiscussionEvent(dashboardState.liveDiscussion, eventName, data)
    scheduleDiscussionRender()
    return
  }

  if (eventName === "guard") {
    const drift = data.drift || {}
    addLog(`守卫检查：${drift.status || "ok"} / ${drift.score ?? 0} - ${drift.reason || "目标一致"}`)
    return
  }

  if (eventName === "network_retry") {
    dashboardState.network.status = isProviderTimeoutMessage(data.message) ? "recovering" : "offline"
    dashboardState.network.lastError = data.message || "provider network error"
    renderNetworkStatus()
    setComposerStatus("warning", `模型服务暂时不可用，${Math.round((data.retryInMs || 0) / 1000)} 秒后自动重试。`)
    addLog(`模型服务暂时不可用，${Math.round((data.retryInMs || 0) / 1000)} 秒后自动重试（第 ${data.attempt || 1} 次）。`)
    dashboardState.liveDiscussion = applyLiveDiscussionEvent(dashboardState.liveDiscussion, eventName, data)
    scheduleDiscussionRender()
    return
  }

  if (eventName === "snapshot") {
    const previousSnapshotVersion = dashboardState.snapshotVersion
    const previousStructureSignature = dashboardStructureSignature()
    if (data.snapshotVersion && data.snapshotVersion === previousSnapshotVersion) {
      syncComposerStatusFromLatestEvents()
      return
    }
    updateSnapshot(data)
    acknowledgePendingMessages(currentPersistedDiscussionEntries())
    const nextStructureSignature = dashboardStructureSignature()
    const signature = dashboardProgressSignature()
    const changed = signature !== dashboardState.lastSnapshotLogSignature
    dashboardState.lastSnapshotLogSignature = signature
    const structureChanged = previousStructureSignature !== nextStructureSignature
    if (changed && structureChanged) {
      resetComposerStatusSoon(`状态已同步：${dashboardState.state?.runtime?.stage || "unknown"}`)
    }
    if (structureChanged) {
      renderDashboard()
    } else {
      renderDiscussionOnly()
      renderComposerStatus()
    }
    if (changed && structureChanged) {
      addLog(`状态已同步：${dashboardState.state?.runtime?.stage || "unknown"}`)
    }
    return
  }

  if (eventName === "error") {
    setComposerStatus("error", data.error || "自动创作发生错误。")
    addLog(data.error || "自动创作发生错误。")
    clearLiveConversation()
    dashboardState.autopilotActive = false
    dashboardState.autopilotStreamConnected = false
    renderDashboard()
    return
  }

  if (eventName === "complete") {
    updateSnapshot(data)
    clearLiveConversation()
    dashboardState.autopilotActive = false
    dashboardState.autopilotStreamConnected = false
    resetComposerStatusSoon("自动创作已暂停或完成，状态与记录已保存。")
    renderDashboard()
    addLog("自动创作已暂停或完成，状态与记录已保存。")
  }
}

async function initializeWorkspace() {
  await createProjectFromModal({
    title: initIdeaInput.value.trim(),
    idea: initIdeaInput.value.trim(),
    chapters: Number.parseInt(initChaptersInput.value || "24", 10),
    chapterWords: Number.parseInt(initWordsInput.value || "2500", 10),
  })
}

async function loadProjects() {
  let response
  try {
    response = await apiRequest("/api/projects")
  } catch (error) {
    addLog(`加载项目列表失败：${networkErrorMessage(error)}。网络恢复后会自动重试。`)
    renderManagerView()
    return { ok: false, status: 0, payload: {} }
  }
  updateSnapshot(response.payload)
  renderManagerView()
  const storedProjectId = window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)
  if (storedProjectId && dashboardState.projects.some((project) => project.id === storedProjectId)) {
    dashboardState.activeProjectId = storedProjectId
    await refreshDashboard({ includeDiscussionHistory: true })
    maybeResumeAutopilotFromSnapshot()
  }
  return response
}

async function selectProject(projectId) {
  dashboardState.activeProjectId = projectId
  dashboardState.transcript = ""
  dashboardState.discussionEntries = []
  dashboardState.discussionMeta = null
  dashboardState.discussionPagination = null
  dashboardState.discussionHistoryLoading = false
  dashboardState.discussionStaticSignature = ""
  clearLiveConversation()
  window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId)
  await refreshDashboard({ includeDiscussionHistory: true })
  maybeResumeAutopilotFromSnapshot()
}

function maybeResumeAutopilotFromSnapshot() {
  if (!dashboardState.activeProjectId) {
    return false
  }
  if (!hasRecoverableAutopilotJob()) {
    renderAutopilotControls()
    return false
  }

  setComposerStatus("warning", "检测到可恢复的自动创作任务，点击“继续创作”后接着上次进度运行。")
  addLog("检测到可恢复的自动创作任务，等待手动继续。")
  renderAutopilotControls()
  return true
}

async function deleteProject(projectId) {
  if (!projectId || dashboardState.deletingProjectIds.has(projectId)) {
    return
  }

  const project = dashboardState.projects.find((entry) => entry.id === projectId)
  const title = project?.title || projectId
  const confirmed = window.confirm(`确定删除《${title}》吗？\n\n这会删除该项目工作区和相关本地文件，操作不可撤销。`)
  if (!confirmed) {
    return
  }

  dashboardState.deletingProjectIds.add(projectId)
  renderManagerView()
  addLog(`正在删除项目：${title}`)

  let response
  try {
    response = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
      body: { projectId },
    })
  } catch (error) {
    dashboardState.deletingProjectIds.delete(projectId)
    renderManagerView()
    addLog(`删除项目失败：${networkErrorMessage(error)}。`)
    return
  }

  dashboardState.deletingProjectIds.delete(projectId)

  if (!response.ok) {
    renderManagerView()
    addLog(`删除项目失败：${response.payload?.error || response.status}`)
    return
  }

  const deletedProjectId = response.payload?.deletedProject?.id || projectId
  updateSnapshot(response.payload)
  if (dashboardState.activeProjectId === deletedProjectId) {
    dashboardState.activeProjectId = null
    dashboardState.state = null
    dashboardState.transcript = ""
    dashboardState.discussionEntries = []
    dashboardState.discussionMeta = null
    dashboardState.discussionPagination = null
    dashboardState.factorySnapshot = null
    clearLiveConversation()
    window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY)
  }
  renderManagerView()
  addLog(`项目已删除：${response.payload?.deletedProject?.title || title}`)
}

async function createProjectFromModal({ title, idea, chapters, chapterWords }) {
  if (dashboardState.projectCreateInFlight) return
  if (!idea) {
    setProjectCreateStatus("is-error", "请输入一句明确的小说想法。")
    return
  }

  setProjectCreateBusy(true)
  setProjectCreateStatus("is-loading", "正在创建项目，请不要重复提交...")
  let response
  try {
    response = await apiRequest("/api/projects", {
      method: "POST",
      body: { title, idea, chapters, chapterWords },
    })
  } catch (error) {
    setProjectCreateBusy(false)
    setProjectCreateStatus("is-error", `项目创建暂时中断：${networkErrorMessage(error)}。网络恢复后请重试。`)
    return
  }

  if (!response.ok) {
    setProjectCreateBusy(false)
    setProjectCreateStatus("is-error", response.payload?.error || "项目创建失败。")
    return
  }

  updateSnapshot(response.payload)
  if (dashboardState.activeProjectId) {
    window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, dashboardState.activeProjectId)
  }
  clearLiveConversation()
  showManagerView()
  addLog(`项目已创建：${dashboardState.state?.project?.title || idea}`)
  setProjectCreateStatus("is-success", "项目已创建，已停留在项目列表；进入创作台后可手动开始创作。")
  window.setTimeout(() => closeProjectCreateModal({ force: true }), 400)
  window.setTimeout(() => setProjectCreateBusy(false), 650)
}

async function handleComposerSubmit() {
  const raw = composerInput.value.trim()
  if (!raw) return
  composerInput.value = ""

  if (raw === "/stop") return requestStopAutopilot()
  if (dashboardState.composerStatus.busy) {
    setComposerStatus("warning", "上一条消息正在提交，请等待当前请求送达后再发送。", { busy: true })
    return
  }
  if (raw === "/advance") return runAdvance("slash command")
  if (raw === "/cover") return runCover()
  if (raw === "/provider-test") return runProviderTest()
  if (raw.startsWith("/interrupt")) return runInterrupt(raw.replace("/interrupt", "").trim())
  if (raw.startsWith("/env")) {
    const updates = parseEnvAssignments(raw.replace("/env", "").trim())
    await apiRequest("/api/env", { method: "POST", body: updates })
    await refreshDashboard()
    addLog("已通过 composer 更新 provider 配置。")
    return
  }

  await streamChat(raw)
}

window.insertCommand = (command) => {
  composerInput.value = `${command} `
  composerInput.focus()
}

window.simulateWrite = () => {
  runAdvance("chapter action")
}

  document.addEventListener("DOMContentLoaded", async () => {
  sendButton.addEventListener("click", handleComposerSubmit)
  composerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      handleComposerSubmit()
    }
  })
  providerCard.addEventListener("click", runProviderTest)
  providerEditButton.addEventListener("click", (event) => {
    event.stopPropagation()
    openProviderModal()
  })
  openProjectCreateButton.addEventListener("click", openProjectCreateModal)
  managerProviderSettingsButton?.addEventListener("click", openProviderModal)
  backToProjectsButton.addEventListener("click", showManagerView)
  providerModalCloseButton.addEventListener("click", closeProviderModal)
  providerConfigModal.addEventListener("click", (event) => {
    if (event.target === providerConfigModal) {
      closeProviderModal()
    }
  })
  projectCreateModalCloseButton.addEventListener("click", closeProjectCreateModal)
  projectCreateModal.addEventListener("click", (event) => {
    if (event.target === projectCreateModal) {
      closeProjectCreateModal()
    }
  })
  chapterPreviewCloseButton?.addEventListener("click", closeChapterPreviewModal)
  chapterPreviewModal?.addEventListener("click", (event) => {
    if (event.target === chapterPreviewModal) {
      closeChapterPreviewModal()
    }
  })
  providerTestButton.addEventListener("click", runModalProviderTest)
  providerSaveButton.addEventListener("click", saveProviderConfigFromModal)
  initButton.addEventListener("click", initializeWorkspace)
  autopilotStartButton?.addEventListener("click", startAutopilotFromButton)
  autopilotStopButton?.addEventListener("click", requestStopAutopilot)
  projectCreateSubmitButton.addEventListener("click", () => createProjectFromModal({
    title: projectCreateTitleInput.value.trim(),
    idea: projectCreateIdeaInput.value.trim(),
    chapters: Number.parseInt(projectCreateChaptersInput.value || "24", 10),
    chapterWords: Number.parseInt(projectCreateWordsInput.value || "2500", 10),
  }))
  chatMessagesBox.addEventListener("click", (event) => {
    const loadOlderButton = event.target.closest("[data-load-older-messages]")
    if (loadOlderButton) {
      loadOlderDiscussionHistory()
      return
    }

    const artifactButton = event.target.closest(".message-artifact-button")
    if (artifactButton) {
      previewArtifact(artifactButton.dataset.artifactPath || "")
      return
    }

    const button = event.target.closest(".message-expand-button")
    if (!button) {
      return
    }

    const entryKey = button.dataset.entryKey
    if (!entryKey) {
      return
    }

    if (dashboardState.expandedDiscussionKeys.has(entryKey)) {
      dashboardState.expandedDiscussionKeys.delete(entryKey)
    } else {
      dashboardState.expandedDiscussionKeys.add(entryKey)
    }

    renderDiscussionOnly()
  })
  chatMessagesBox.addEventListener("scroll", () => {
    dashboardState.discussionAutoStickToBottom = shouldAutoScrollDiscussion(chatMessagesBox)
  })
  window.addEventListener("offline", () => {
    markNetworkOffline(new Error("browser offline"))
  })
  window.addEventListener("online", () => {
    dashboardState.network.status = "recovering"
    renderNetworkStatus()
    addLog("浏览器检测到网络恢复，正在重新连接服务。")
    probeConnection().catch((error) => {
      markNetworkOffline(error)
    })
  })

  renderNetworkStatus()
  addLog("AI Novel Factory Studio 已启动。")
  await loadProjects()
})
