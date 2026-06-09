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
const sidebarRight = document.getElementById("sidebar-right")
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
const llmConfigsList = document.getElementById("llm-configs-list")
const llmFormTitle = document.getElementById("llm-form-title")
const llmConfigIdInput = document.getElementById("llm-config-id-input")
const llmConfigNameInput = document.getElementById("llm-config-name-input")
const llmConfigCancelEditButton = document.getElementById("llm-config-cancel-edit-button")
const networkStatusBanner = document.getElementById("network-status-banner")
const initPanel = document.getElementById("init-panel")
const initIdeaInput = document.getElementById("init-idea-input")
const initChaptersInput = document.getElementById("init-chapters-input")
const initWordsInput = document.getElementById("init-words-input")
const initButton = document.getElementById("init-button")
const autopilotModeButton = document.getElementById("autopilot-mode-button")
const cocreateReviewRegion = document.querySelector("[data-cocreate-review-region='true']")
const projectCreateModal = document.getElementById("project-create-modal")
const projectCreateModalCloseButton = document.getElementById("project-create-modal-close-button")
const projectCreateTitleInput = document.getElementById("project-create-title-input")
const projectCreateIdeaInput = document.getElementById("project-create-idea-input")
const projectCreateChaptersInput = document.getElementById("project-create-chapters-input")
const AUTOPILOT_RESUME_HINT = "检测到可恢复的自动创作任务，点击“继续创作”后接着上次进度运行。"
const AUTOPILOT_RESUME_HINT_AFTER_NETWORK = "网络已恢复，检测到可继续的自动创作任务，请点击“继续创作”。"
const projectCreateWordsInput = document.getElementById("project-create-words-input")
const projectCreateModalStatus = document.getElementById("project-create-modal-status")
const projectCreateSubmitButton = document.getElementById("project-create-submit-button")
const chapterPreviewModal = document.getElementById("chapter-preview-modal")
const chapterPreviewCloseButton = document.getElementById("chapter-preview-close-button")
const chapterPreviewTitle = document.getElementById("chapter-preview-title")
const chapterPreviewPath = document.getElementById("chapter-preview-path")
const chapterPreviewBody = document.getElementById("chapter-preview-body")
const chapterCopyButton = document.getElementById("chapter-copy-button")
const ACTIVE_PROJECT_STORAGE_KEY = "ai-novel-factory.activeProjectId"
const PANEL_LAYOUT_STORAGE_KEY = "ai-novel-factory.panelLayout"
const NETWORK_RETRY_BASE_MS = 3000
const NETWORK_RETRY_MAX_MS = 30000
const DISCUSSION_PAGE_SIZE = 20

const dashboardState = {
  projects: [],
  activeProjectId: null,
  autopilotAbortController: null,
  chatAbortController: null,
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
  currentPreviewContent: "",
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
  panelLayout: {
    chapterFocus: false,
    modules: {
      overview: true,
      chapters: true,
      observability: false,
      logs: false,
    },
  },
  projectCreateInFlight: false,
  deletingProjectIds: new Set(),
}

function defaultPanelLayout() {
  return {
    chapterFocus: false,
    modules: {
      overview: true,
      chapters: true,
      observability: false,
      logs: false,
    },
  }
}

function panelLayoutStorageKey(projectId = dashboardState.activeProjectId) {
  return `${PANEL_LAYOUT_STORAGE_KEY}.${projectId || "global"}`
}

function normalizePanelLayout(layout = {}) {
  const defaults = defaultPanelLayout()
  const modules = layout?.modules || {}
  return {
    chapterFocus: Boolean(layout?.chapterFocus),
    modules: {
      overview: modules.overview ?? defaults.modules.overview,
      chapters: modules.chapters ?? defaults.modules.chapters,
      observability: modules.observability ?? defaults.modules.observability,
      logs: modules.logs ?? defaults.modules.logs,
    },
  }
}

function loadPanelLayout(projectId = dashboardState.activeProjectId) {
  if (typeof window === "undefined") {
    dashboardState.panelLayout = defaultPanelLayout()
    return dashboardState.panelLayout
  }
  try {
    const stored = window.localStorage.getItem(panelLayoutStorageKey(projectId))
    dashboardState.panelLayout = stored ? normalizePanelLayout(JSON.parse(stored)) : defaultPanelLayout()
  } catch {
    dashboardState.panelLayout = defaultPanelLayout()
  }
  return dashboardState.panelLayout
}

function persistPanelLayout() {
  if (typeof window === "undefined" || !dashboardState.activeProjectId) {
    return
  }
  window.localStorage.setItem(
    panelLayoutStorageKey(),
    JSON.stringify(normalizePanelLayout(dashboardState.panelLayout)),
  )
}

function setPanelModuleExpanded(moduleKey, expanded, { persist = true } = {}) {
  const nextLayout = normalizePanelLayout(dashboardState.panelLayout)
  if (!(moduleKey in nextLayout.modules)) {
    return
  }
  nextLayout.modules[moduleKey] = Boolean(expanded)
  if (moduleKey === "chapters" && !nextLayout.modules.chapters) {
    nextLayout.chapterFocus = false
  }
  dashboardState.panelLayout = nextLayout
  if (persist) {
    persistPanelLayout()
  }
  applySidebarPanelLayout()
}

function togglePanelModule(moduleKey) {
  const current = normalizePanelLayout(dashboardState.panelLayout)
  setPanelModuleExpanded(moduleKey, !current.modules[moduleKey])
}

function setChapterFocus(enabled) {
  const nextLayout = normalizePanelLayout(dashboardState.panelLayout)
  nextLayout.chapterFocus = Boolean(enabled)
  nextLayout.modules.chapters = true
  if (enabled) {
    nextLayout.modules.observability = false
    nextLayout.modules.logs = false
  }
  dashboardState.panelLayout = nextLayout
  persistPanelLayout()
  applySidebarPanelLayout()
}

function updateSidebarModuleSummary(id, value) {
  const element = document.getElementById(id)
  if (element) {
    element.textContent = value
  }
}

function applySidebarPanelLayout() {
  if (!sidebarRight) {
    return
  }
  const layout = normalizePanelLayout(dashboardState.panelLayout)
  sidebarRight.classList.toggle("is-chapter-focus", layout.chapterFocus)
  sidebarRight.querySelectorAll("[data-panel-module]").forEach((section) => {
    const moduleKey = section.dataset.panelModule
    const expanded = Boolean(layout.modules[moduleKey])
    section.classList.toggle("is-expanded", expanded)
    const toggle = section.querySelector("[data-panel-toggle]")
    if (toggle) {
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false")
    }
  })
  const focusButton = document.getElementById("chapter-focus-toggle-button")
  if (focusButton) {
    focusButton.classList.toggle("is-active", layout.chapterFocus)
    focusButton.innerHTML = layout.chapterFocus
      ? `<i class="fa-solid fa-compress"></i> 退出聚焦`
      : `<i class="fa-solid fa-expand"></i> 聚焦章节`
  }
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
  return snapshotJobDisplayState().recoverableJobs.some((job) => job?.kind === "autopilot")
}

function hasRunningAutopilotJob() {
  return snapshotJobDisplayState().runningJobs.some((job) => job?.kind === "autopilot")
}

function dedupeJobs(jobs = []) {
  const seen = new Set()
  return jobs.filter((job) => {
    const id = String(job?.id || "")
    if (!id || seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })
}

function snapshotJobDisplayState(snapshot = dashboardState.factorySnapshot || {}) {
  const activeJobs = Array.isArray(snapshot?.activeJobs) ? snapshot.activeJobs : []
  const runnableJobs = Array.isArray(snapshot?.runnableJobs) ? snapshot.runnableJobs : []
  const recoverableJobs = dedupeJobs(
    [...activeJobs, ...runnableJobs].filter((job) => job?.status === "paused" || !job?.lease_owner),
  )
  const recoverableIds = new Set(recoverableJobs.map((job) => String(job.id || "")))
  const runningJobs = activeJobs.filter((job) =>
    job?.status === "running"
    && job?.lease_owner
    && !recoverableIds.has(String(job.id || "")),
  )
  return {
    runningJobs,
    recoverableJobs,
  }
}

function autopilotControlState() {
  const runtimeAutopilot = dashboardState.state?.runtime?.autopilot || {}
  const recoverable = hasRecoverableAutopilotJob()
  const running = Boolean(runtimeAutopilot.running || hasRunningAutopilotJob() || dashboardState.autopilotStreamConnected)
  return {
    running,
    recoverable,
    paused: recoverable && !running,
    lastStep: runtimeAutopilot.lastStep || "",
    message: runtimeAutopilot.statusMessage || "",
  }
}

function composerStatusIsAutopilotResumeHint() {
  const message = String(dashboardState.composerStatus?.message || "")
  return message === AUTOPILOT_RESUME_HINT || message === AUTOPILOT_RESUME_HINT_AFTER_NETWORK
}

function syncComposerStatusFromAutopilotControl() {
  if (dashboardState.composerStatus.busy) {
    return
  }
  const control = autopilotControlState()
  if (control.paused) {
    if (!composerStatusIsAutopilotResumeHint()) {
      setComposerStatus("warning", AUTOPILOT_RESUME_HINT)
    }
    return
  }
  if (!composerStatusIsAutopilotResumeHint()) {
    return
  }
  if (control.running) {
    setComposerStatus("processing", "后台 worker 正在运行；如果模型超时，会自动重试并保留进度。")
    return
  }
  setComposerStatus("idle", "输入指令后会显示发送和处理状态")
}

function renderAutopilotControls() {
  if (!autopilotStartButton || !autopilotStopButton || !autopilotControlHint) {
    return
  }

  const control = autopilotControlState()
  const hasProject = Boolean(dashboardState.activeProjectId)

  if (autopilotModeButton) {
    autopilotModeButton.disabled = !hasProject || dashboardState.composerStatus.busy
    const currentMode = dashboardState.state?.project?.autoMode || "full"
    if (currentMode === "semi") {
      autopilotModeButton.querySelector("span").textContent = "半自动共创"
      autopilotModeButton.querySelector("i").className = "fa-solid fa-hands-holding-child"
      autopilotModeButton.title = "当前模式：半自动共创。将在关键产出节点暂停等待您审阅。"
    } else {
      autopilotModeButton.querySelector("span").textContent = "全自动托管"
      autopilotModeButton.querySelector("i").className = "fa-solid fa-robot"
      autopilotModeButton.title = "当前模式：全自动托管。系统将完全自动完成创作与推进。"
    }
  }

  autopilotStartButton.disabled = !hasProject || control.running || dashboardState.composerStatus.busy
  autopilotStopButton.disabled = !hasProject || !control.running
  autopilotStartButton.querySelector("span").textContent = control.running
    ? "创作进行中"
    : control.paused
      ? "继续创作"
      : "开始创作"
  autopilotStartButton.querySelector("i").className = control.running
    ? "fa-solid fa-spinner fa-spin"
    : control.paused
      ? "fa-solid fa-rotate-right"
      : "fa-solid fa-play"
  autopilotStopButton.querySelector("span").textContent = control.running ? "暂停并保留进度" : "暂停"

  let hint = "进入项目后手动开始自动创作"
  if (!hasProject) {
    hint = "请选择项目后开始"
    autopilotStartButton.title = "项目尚未初始化/选择，请先在左侧选择或创建小说项目"
    autopilotStopButton.title = "请先选择小说项目"
  } else if (dashboardState.composerStatus.busy) {
    hint = "后台正在处理上一条指令，请稍候"
    autopilotStartButton.title = "后台正在处理上一条指令，请稍候"
    autopilotStopButton.title = "可暂停当前创作进程"
  } else if (control.running) {
    hint = "自动创作运行中，可随时暂停并保留进度"
    autopilotStartButton.title = "自动创作正在运行中"
    autopilotStopButton.title = "点击暂停自动创作，安全保留当前章节进度"
  } else {
    autopilotStartButton.title = "点击开始自动创作小说"
    autopilotStopButton.title = "当前未在运行中"
    if (control.paused) {
      hint = "检测到可恢复任务，点击继续创作"
    } else if (control.lastStep === "awaiting_user_start") {
      hint = "项目已就绪，点击开始创作"
    } else if (control.message) {
      hint = control.message
    }
  }
  autopilotControlHint.textContent = hint
}

async function toggleAutopilotMode() {
  if (!dashboardState.activeProjectId || dashboardState.composerStatus.busy) {
    return
  }
  
  const currentMode = dashboardState.state?.project?.autoMode || "full"
  const nextMode = currentMode === "semi" ? "full" : "semi"
  
  setComposerStatus("processing", `正在切换创作模式为 ${nextMode === "semi" ? "半自动共创" : "全自动托管"}...`)
  renderAutopilotControls()
  
  try {
    const response = await apiRequest("/api/autopilot/mode", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        autoMode: nextMode
      }
    })
    
    if (response.ok) {
      updateSnapshot(response.payload)
      setComposerStatus("success", `模式已成功切换为：${nextMode === "semi" ? "🤝 半自动共创" : "🤖 全自动托管"}`)
    } else {
      setComposerStatus("error", `模式切换失败: ${response.payload?.error || response.status}`)
    }
  } catch (err) {
    setComposerStatus("error", `模式切换请求出错: ${err.message}`)
  } finally {
    renderAutopilotControls()
  }
}

async function sendCocreateFeedback(feedback) {
  try {
    await streamAutopilot(feedback)
  } catch (err) {
    console.error("Failed to send cocreate feedback:", err)
    setComposerStatus("error", `发送修改反馈失败: ${err.message}`)
  }
}

function renderCocreateReviewPanel(model) {
  if (!cocreateReviewRegion) {
    return
  }

  const control = autopilotControlState()
  const isSemi = dashboardState.state?.project?.autoMode === "semi"
  const isPausedForReview = isSemi && !control.running && control.lastStep === "semi_auto_paused"

  if (!isPausedForReview) {
    cocreateReviewRegion.classList.add("hidden")
    cocreateReviewRegion.innerHTML = ""
    return
  }

  cocreateReviewRegion.classList.remove("hidden")

  const consensusText = model.storyMemory?.consensus || "（当前暂无生成的讨论共识草案）"
  const statusMessage = control.message || "工作流已暂停，等待您的审阅。"

  cocreateReviewRegion.innerHTML = `
    <div class="cocreate-review-card">
      <div class="review-header">
        <i class="fa-solid fa-hands-holding-child"></i>
        <span>人机共创审阅面板 (半自动模式)</span>
      </div>
      <div class="review-body">
        <div class="review-desc">
          <i class="fa-solid fa-circle-info"></i>
          <span>${escapeHtml(statusMessage)}</span>
        </div>
        <div class="review-consensus-box">
          <div class="consensus-title">当前讨论共识预览：</div>
          <pre class="consensus-content">${escapeHtml(consensusText)}</pre>
        </div>
      </div>
      <div class="review-footer">
        <div class="review-input-wrapper">
          <input type="text" id="review-feedback-input" placeholder="输入具体的修改意见（例如：反派动机还需要加强，多写一些细节...）" autocomplete="off">
          <button class="btn-review-action btn-review-feedback" id="btn-review-feedback" type="button">
            <i class="fa-solid fa-comment-medical"></i> 提交修改建议
          </button>
        </div>
        <button class="btn-review-action btn-review-approve" id="btn-review-approve" type="button">
          <i class="fa-solid fa-circle-check"></i> 确认无误，继续推进
        </button>
      </div>
    </div>
  `

  const approveBtn = cocreateReviewRegion.querySelector("#btn-review-approve")
  const feedbackBtn = cocreateReviewRegion.querySelector("#btn-review-feedback")
  const feedbackInput = cocreateReviewRegion.querySelector("#review-feedback-input")

  approveBtn?.addEventListener("click", async () => {
    approveBtn.disabled = true
    if (feedbackBtn) feedbackBtn.disabled = true
    if (feedbackInput) feedbackInput.disabled = true
    setComposerStatus("processing", "正在确认推进，发送继续指令...")
    await sendCocreateFeedback("继续")
  })

  feedbackBtn?.addEventListener("click", async () => {
    const feedback = feedbackInput?.value?.trim()
    if (!feedback) {
      alert("请输入具体的修改建议内容！")
      return
    }
    approveBtn.disabled = true
    feedbackBtn.disabled = true
    if (feedbackInput) feedbackInput.disabled = true
    setComposerStatus("processing", "正在提交修改建议并唤醒讨论...")
    await sendCocreateFeedback(feedback)
  })
  
  feedbackInput?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      feedbackBtn?.click()
    }
  })
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
  if (autopilotControlState().paused) {
    setComposerStatus("warning", AUTOPILOT_RESUME_HINT_AFTER_NETWORK)
    addLog("检测到可继续的自动创作任务，等待手动继续。")
  }
  renderAutopilotControls()
}

function renderLogs() {
  consoleLogsBox.innerHTML = dashboardState.consoleLogs.length
    ? dashboardState.consoleLogs.map((line) => `<div class="log-line">${escapeHtml(line)}</div>`).join("")
    : `<div class="log-empty">等待创作运行日志。</div>`
  updateSidebarModuleSummary("logs-panel-summary", dashboardState.consoleLogs.length ? `${dashboardState.consoleLogs.length} 条记录` : "等待日志")
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

let savedLlmConfigs = []

async function loadLlmConfigsList() {
  if (!llmConfigsList) return
  llmConfigsList.innerHTML = `<div class="modal-status is-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>正在加载已保存的配置...</span></div>`
  try {
    const response = await apiRequest("/api/llm-configs")
    savedLlmConfigs = response.payload?.configs || []
    renderLlmConfigsList()
  } catch (error) {
    llmConfigsList.innerHTML = `<div class="modal-status is-error"><i class="fa-solid fa-circle-exclamation"></i><span>加载失败：${escapeHtml(error.message)}</span></div>`
  }
}

function renderLlmConfigsList() {
  if (!llmConfigsList) return
  if (savedLlmConfigs.length === 0) {
    llmConfigsList.innerHTML = `
      <div class="workflow-empty">
        <i class="fa-solid fa-robot"></i>
        <span>没有保存的模型配置，请在右侧表单添加。</span>
      </div>
    `
    return
  }

  llmConfigsList.innerHTML = savedLlmConfigs
    .map((config) => {
      const isActive = config.is_active === 1
      const activePart = isActive
        ? `<span class="active-badge">使用中</span>`
        : `<button class="llm-action-btn btn-activate" data-id="${escapeHtml(config.id)}" title="激活此配置"><i class="fa-solid fa-bolt"></i></button>`

      return `
        <div class="llm-config-item ${isActive ? "active" : ""}">
          <div class="llm-config-item-info">
            <strong>${escapeHtml(config.name)}</strong>
            <span>${escapeHtml(config.base_url)}</span>
            <small>${escapeHtml(config.model_name)}</small>
          </div>
          <div class="llm-config-item-actions">
            ${activePart}
            <button class="llm-action-btn btn-edit" data-id="${escapeHtml(config.id)}" title="编辑此配置"><i class="fa-solid fa-pen"></i></button>
            <button class="llm-action-btn btn-delete" data-id="${escapeHtml(config.id)}" title="删除此配置"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `
    })
    .join("")
}

function editLlmConfig(id) {
  const config = savedLlmConfigs.find((c) => c.id === id)
  if (!config) return

  llmConfigIdInput.value = config.id
  llmConfigNameInput.value = config.name
  providerBaseUrlInput.value = config.base_url
  providerApiKeyInput.value = config.api_key
  providerModelInput.value = config.model_name

  llmFormTitle.textContent = "编辑模型配置"
  llmConfigCancelEditButton.classList.remove("hidden")
  setProviderModalStatus("", "正在编辑模型配置，修改后点击保存。")
}

function cancelEditLlmConfig() {
  llmConfigIdInput.value = ""
  llmConfigNameInput.value = ""
  providerBaseUrlInput.value = ""
  providerApiKeyInput.value = ""
  providerModelInput.value = ""

  llmFormTitle.textContent = "添加模型配置"
  llmConfigCancelEditButton.classList.add("hidden")
  setProviderModalStatus("", "填写后可先测试连接，再保存。")
}

async function activateLlmConfig(id) {
  setProviderModalStatus("is-loading", "正在激活选中的模型配置...")
  try {
    const response = await apiRequest("/api/llm-configs/activate", {
      method: "POST",
      body: { id },
    })
    savedLlmConfigs = response.payload?.configs || []
    renderLlmConfigsList()
    setProviderModalStatus("is-success", "模型激活成功，已开始使用该配置。")
    addLog("已成功激活选中的模型配置。")
    await refreshDashboard()
  } catch (error) {
    setProviderModalStatus("is-error", `激活失败：${error.message}`)
  }
}

async function deleteLlmConfig(id) {
  if (!confirm("确定要删除这个模型配置吗？")) {
    return
  }
  setProviderModalStatus("is-loading", "正在删除选中的模型配置...")
  try {
    const response = await apiRequest(`/api/llm-configs?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    savedLlmConfigs = response.payload?.configs || []
    renderLlmConfigsList()
    
    if (llmConfigIdInput.value === id) {
      cancelEditLlmConfig()
    }
    
    setProviderModalStatus("is-success", "配置已成功删除。")
    addLog("模型配置删除成功。")
    await refreshDashboard()
  } catch (error) {
    setProviderModalStatus("is-error", `删除失败：${error.message}`)
  }
}

function openProviderModal() {
  cancelEditLlmConfig()
  setProviderModalStatus("", "填写后可先测试连接，再保存。")
  providerConfigModal.classList.remove("hidden")
  loadLlmConfigsList().catch((error) => {
    console.error("Failed to load llm configs list:", error)
  })
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
  syncComposerStatusFromAutopilotControl()
  renderAutopilotControls()
}

function getManagerProjectProgress(project, activeModel) {
  const summary = project?.id === dashboardState.activeProjectId
    ? activeModel?.productionSummary || project?.summary || null
    : project?.summary || null
  if (!summary || summary.source === "empty") {
    return {
      percent: 0,
      label: "等待生产状态",
      detail: "尚未从数据库快照读取到生产进度",
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
  if (summary.inProgressChapters > 0) {
    parts.push(`进行中 ${summary.inProgressChapters}`)
  }
  if (summary.blockedChapters > 0) {
    parts.push(`阻塞 ${summary.blockedChapters}`)
  }
  if (summary.activeJobs > 0) {
    parts.push(`后台 ${summary.activeJobs}`)
  } else if (summary.runnableJobs > 0) {
    parts.push(`可恢复 ${summary.runnableJobs}`)
  }
  return {
    percent,
    label: parts.join(" · "),
    detail: summary.source === "db" ? "DB 主事实源" : summary.source === "state" ? "state 缓存" : "等待状态",
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
      <div class="project-hero-card" id="project-list-empty-create">
        <div class="hero-card-glow"></div>
        <div class="hero-card-content">
          <div class="hero-icon-wrapper">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </div>
          <h2>开启您的第一本 AI 小说</h2>
          <p>智能小说创作工坊能够根据您的一句灵感，全自动为您构建大纲、人物设定、冲突脑图并推进高品质章节写作。仅需 1 分钟即可完成项目初始化。</p>
          <button class="btn-hero-action" type="button">
            <i class="fa-solid fa-plus"></i> 立即创建小说项目
          </button>
        </div>
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
  const continueNode = document.getElementById("manager-continue-panel")
  const modelNode = document.getElementById("manager-model-name")
  const serviceNode = document.getElementById("manager-service-status")
  const apiKeyNode = document.getElementById("manager-api-key-status")
  const goalDoneNode = document.getElementById("manager-goal-done")
  const goalTotalNode = document.getElementById("manager-goal-total")
  const goalFillNode = document.getElementById("manager-goal-fill")
  const goalHintNode = document.getElementById("manager-goal-hint")
  const activityNode = document.getElementById("manager-activity-list")
  const activeProject = dashboardState.projects.find((project) => project.id === dashboardState.activeProjectId) || null
  const summary = model?.productionSummary || null
  const automation = model?.workflow?.automation || null

  if (continueNode) {
    if (activeProject && summary) {
      const jobState = snapshotJobDisplayState()
      const runningJobs = jobState.runningJobs.length
      const recoverableJobs = jobState.recoverableJobs.length
      const jobCopy = runningJobs > 0
        ? `${runningJobs} 个后台任务运行中`
        : recoverableJobs > 0
          ? `${recoverableJobs} 个任务可恢复`
          : "暂无后台任务"
      continueNode.innerHTML = `
        <div class="manager-panel-title"><span></span> 继续创作</div>
        <div class="manager-continue-card">
          <small>当前项目</small>
          <strong>《${escapeHtml(activeProject.title)}》</strong>
          <p>${escapeHtml(summary.stage || "unknown")} · ${Number(summary.progressPercent || 0)}% · 完成 ${Number(summary.completedChapters || 0)}/${Number(summary.totalChapters || 0)} 章</p>
          <div class="manager-continue-meta">
            <span><i class="fa-solid fa-database"></i> ${escapeHtml(summary.source === "db" ? "DB 主事实源" : "state 缓存")}</span>
            <span><i class="fa-solid fa-rotate"></i> ${escapeHtml(jobCopy)}</span>
          </div>
          <button class="manager-continue-button" type="button" data-manager-continue-project="${escapeHtml(activeProject.id)}">
            <i class="fa-solid fa-arrow-right"></i>
            <span>进入创作指挥舱</span>
          </button>
        </div>
      `
      continueNode.querySelector("[data-manager-continue-project]")?.addEventListener("click", (event) => {
        event.stopPropagation()
        selectProject(activeProject.id)
      })
    } else {
      continueNode.innerHTML = `
        <div class="manager-panel-title"><span></span> 继续创作</div>
        <div class="manager-continue-empty">
          <strong>${dashboardState.projects.length ? "选择一部小说" : "还没有小说项目"}</strong>
          <p>${dashboardState.projects.length ? "选择项目后，这里会显示阶段、章节进度和可恢复任务。" : "新建项目后，会在这里看到继续创作入口。"}</p>
        </div>
      `
    }
  }

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
    const activities = []
    if (summary) {
      if (summary.blockedChapters > 0) {
        activities.push({
          text: `${summary.blockedChapters} 个章节阻塞，需要人工审阅或重试。`,
          time: summary.latestEventAt ? formatClock(summary.latestEventAt) : "刚刚",
        })
      }
      if (automation?.kind === "warning" || automation?.kind === "error") {
        activities.push({
          text: `${automation.label}：${automation.detail || "需要确认后继续。"}`,
          time: dashboardState.state?.runtime?.updatedAt ? formatClock(dashboardState.state.runtime.updatedAt) : "刚刚",
        })
      }
      activities.push({
        text: `当前阶段 ${summary.stage}${summary.isComplete ? "，全书主流程已完成" : "，可进入创作台继续推进。"}`,
        time: dashboardState.state?.runtime?.updatedAt ? formatClock(dashboardState.state.runtime.updatedAt) : "刚刚",
      })
      activities.push({
        text: `生产进度 ${summary.progressPercent}%：完成 ${summary.completedChapters}/${summary.totalChapters}，待写 ${summary.pendingChapters}。`,
        time: summary.latestEventAt ? formatClock(summary.latestEventAt) : "刚刚",
      })
    }
    dashboardState.projects.slice(0, Math.max(0, 4 - activities.length)).forEach((project) => {
      activities.push({
        text: `《${project.title}》可进入创作指挥舱。`,
        time: formatClock(project.createdAt),
      })
    })
    activityNode.innerHTML = (activities.length ? activities : [{ text: "等待项目创建或选择", time: "刚刚" }]).slice(0, 4).map((activity) => `
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
  if (typeof window !== "undefined") {
    window.localStorage.setItem("ai-novel-factory.currentView", "manager")
  }
  projectManagerView.classList.remove("hidden")
  studioView.classList.add("hidden")
  renderManagerView()
}

function showStudioView() {
  dashboardState.currentView = "studio"
  if (typeof window !== "undefined") {
    window.localStorage.setItem("ai-novel-factory.currentView", "studio")
  }
  projectManagerView.classList.add("hidden")
  studioView.classList.remove("hidden")
  applySidebarPanelLayout()
}

function renderProjectCard(model) {
  document.getElementById("project-title-display").textContent = model.project.title || model.project.id || "未命名项目"
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

  const automationNode = document.getElementById("workflow-automation-status")
  if (automationNode) {
    const automation = model.workflow.automation || { kind: "idle", label: "后台空闲", detail: "" }
    automationNode.className = `workflow-automation-status is-${automation.kind || "idle"}`
    
    let iconClass = "fa-robot"
    if (automation.kind === "processing") iconClass = "fa-spinner fa-spin"
    else if (automation.kind === "success") iconClass = "fa-circle-check"
    else if (automation.kind === "warning") iconClass = "fa-triangle-exclamation"
    else if (automation.kind === "error") iconClass = "fa-circle-xmark"

    automationNode.innerHTML = `
      <div class="workflow-automation-title">
        <i class="fa-solid ${iconClass}"></i>
        <span>${escapeHtml(automation.label || "无人值守自动创作")}</span>
      </div>
      <p>${escapeHtml(automation.detail || "当前无正在运行的后台无人值守任务。")}</p>
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

function jobDisplayLabel(job = {}) {
  const kind = String(job.kind || "job")
  const status = String(job.status || "unknown")
  const lease = job.lease_owner ? "worker 执行中" : "等待领取"
  return `${kind} · ${status} · ${lease}`
}

function eventDisplayLabel(type = "") {
  const labels = {
    AUTOPILOT_MESSAGE_SUBMITTED: "用户指令入队",
    AUTOPILOT_INSTRUCTION_RECEIVED: "worker 接收指令",
    CHAPTER_PIPELINE_COMPLETED: "章节流水线完成",
    CHAPTER_PIPELINE_BLOCKED: "章节质量阻塞",
    CHAPTER_PIPELINE_RECOVERY_QUEUED: "章节返工排队",
    DIRECTOR_COMMAND_DECIDED: "Director 已决策",
    DIRECTOR_COMMAND_STARTED: "Director 开始执行",
    DIRECTOR_COMMAND_COMPLETED: "Director 执行完成",
    JOB_CREATED: "后台任务创建",
    JOB_REUSED: "复用后台任务",
    JOB_UPDATED: "后台任务更新",
    KNOWLEDGE_REINDEX_QUEUED: "知识库重建排队",
    KNOWLEDGE_EVALUATION_COMPLETED: "知识库评估完成",
    PROJECT_STATE_UPDATED: "项目状态更新",
  }
  return labels[type] || type || "未知事件"
}

function eventPayloadSummary(event = {}) {
  const payload = readEventPayload(event)
  const parts = []
  if (payload.chapterNumber) parts.push(`第 ${payload.chapterNumber} 章`)
  if (payload.command) parts.push(String(payload.command))
  if (payload.action) parts.push(String(payload.action))
  if (payload.status) parts.push(String(payload.status))
  if (payload.qualityGate?.score != null) parts.push(`评分 ${payload.qualityGate.score}/10`)
  if (payload.toolName) parts.push(String(payload.toolName))
  if (payload.jobId) parts.push(`job ${String(payload.jobId).slice(0, 8)}`)
  return parts.join(" · ")
}

function toolMessageSummary(message = {}) {
  const data = message.data || {}
  const parts = Array.isArray(message.parts) ? message.parts : []
  const callPart = parts.find((part) => part.type === "tool_call") || null
  const resultPart = parts.find((part) => part.type === "tool_result") || null
  const toolName = data.toolName || data.name || callPart?.data?.toolName || callPart?.data?.name || "tool"
  const status = resultPart?.data?.status || data.status || message.status || "completed"
  const content = data.summary || data.content || resultPart?.data?.error || ""
  return {
    toolName: String(toolName),
    status: String(status),
    content: String(content || ""),
    time: message.time || message.created_at || message.createdAt || message.updated_at || "",
  }
}

function renderCreationObservability(model = null) {
  const container = document.getElementById("creation-observability-panel")
  if (!container) {
    return
  }
  const snapshot = dashboardState.factorySnapshot || {}
  const jobState = snapshotJobDisplayState(snapshot)
  const runningJobs = jobState.runningJobs
  const recoverableJobs = jobState.recoverableJobs
  const latestEvents = Array.isArray(snapshot.latestEvents) ? snapshot.latestEvents : []
  const recentMessages = Array.isArray(snapshot.recentMessages) ? snapshot.recentMessages : []
  const toolMessages = recentMessages
    .filter((message) => message?.type === "tool")
    .slice(0, 3)
    .map(toolMessageSummary)
  const visibleEvents = latestEvents
    .filter((event) => event?.type !== "JOB_HEARTBEAT")
    .slice(0, 4)
  const runningJobRows = runningJobs.slice(0, 2).map((job) => `
    <div class="observability-job-row">
      <span><i class="fa-solid fa-gears"></i>${escapeHtml(jobDisplayLabel(job))}</span>
      <small>${escapeHtml(job.updated_at ? formatClock(job.updated_at) : "等待刷新")}</small>
    </div>
  `).join("")
  const recoverableJobRows = recoverableJobs.slice(0, 2).map((job) => `
    <div class="observability-job-row">
      <span><i class="fa-solid fa-rotate-right"></i>${escapeHtml(jobDisplayLabel(job))}</span>
      <small>${escapeHtml(job.updated_at ? formatClock(job.updated_at) : "等待刷新")}</small>
    </div>
  `).join("")
  const toolRows = toolMessages.length
    ? toolMessages.map((tool) => `
      <div class="observability-tool-row">
        <span><i class="fa-solid fa-screwdriver-wrench"></i>${escapeHtml(tool.toolName)}</span>
        <strong>${escapeHtml(tool.status)}</strong>
        ${tool.content ? `<small>${escapeHtml(tool.content).slice(0, 96)}</small>` : ""}
      </div>
    `).join("")
    : `<div class="observability-empty">暂无工具调用记录。</div>`
  const eventRows = visibleEvents.length
    ? visibleEvents.map((event) => {
        const summary = eventPayloadSummary(event)
        return `
          <div class="observability-event-row">
            <span>${escapeHtml(eventDisplayLabel(event.type))}</span>
            <small>${escapeHtml(event.created_at ? formatClock(event.created_at) : event.createdAt ? formatClock(event.createdAt) : "")}</small>
            ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
          </div>
        `
      }).join("")
    : `<div class="observability-empty">暂无最近事件。</div>`
  const source = model?.productionSummary?.source === "db" ? "DB Snapshot" : "State Cache"
  updateSidebarModuleSummary("observability-panel-summary", `${runningJobs.length} 运行 / ${recoverableJobs.length} 可恢复`)

  container.innerHTML = `
    <div class="panel-header">
      <span><i class="fa-solid fa-tower-observation"></i> 创作过程观察</span>
      <span class="observability-source">${escapeHtml(source)}</span>
    </div>
    <div class="observability-summary-grid">
      <span><strong>${runningJobs.length}</strong><small>运行任务</small></span>
      <span><strong>${recoverableJobs.length}</strong><small>可恢复</small></span>
      <span><strong>${toolMessages.length}</strong><small>工具调用</small></span>
    </div>
    ${runningJobRows ? `<div class="observability-section"><strong>正在执行</strong><div class="observability-job-list">${runningJobRows}</div></div>` : ""}
    ${recoverableJobRows ? `<div class="observability-section"><strong>可恢复任务</strong><div class="observability-job-list">${recoverableJobRows}</div></div>` : ""}
    <div class="observability-section">
      <strong>最近工具 / MCP / Skill</strong>
      ${toolRows}
    </div>
    <div class="observability-section">
      <strong>最近生产事件</strong>
      ${eventRows}
    </div>
  `
}

function chapterStatusBadge(task) {
  if (task.displayStatus === "blocked_by_previous" || task.blockedByPrevious) {
    return { klass: "badge-secondary", label: "等待前序", itemClass: "blocked blocked-by-previous", progress: 0 }
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
  updateSidebarModuleSummary("overview-panel-summary", `${completed} / ${total} 章 · ${percentage}%`)
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
  const visibleRangeLabel = visibleItems.length
    ? `第 ${windowStart || visibleItems[0]?.chapterNumber || "?"}-${windowEnd || visibleItems.at(-1)?.chapterNumber || "?"} 章 / 共 ${total} 章`
    : total > 0
      ? `共 ${total} 章，等待任务窗口`
      : "等待章节任务"
  updateSidebarModuleSummary("chapter-panel-summary", visibleRangeLabel)
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
  const emptyState = visibleItems.length === 0
    ? `
      <div class="chapter-list-empty">
        <i class="fa-solid fa-list-check"></i>
        <span>等待数据库快照同步章节任务。</span>
        <small>这里只有正式入库的章节任务；中间讨论区里的草稿或实时输出不会直接出现在这里。</small>
        ${total > 0 ? `<small>当前项目目标 ${total} 章；任务窗口生成后可在这里分页查看全部章节。</small>` : ""}
      </div>
    `
    : ""
  container.innerHTML = `${draftOnlyNotice}${pagination}${windowNotice}${emptyState}${visibleItems.map((task) => {
    const badge = chapterStatusBadge(task)
    const canRun = !task.blockedByPrevious && !task.recoveryBlocked && (task.status === "blocked"
      || model.workflow.currentStage.key === "drafting"
      || model.workflow.currentStage.key === "chapter_task_generation")
    const qualityGate = task.qualityGate || null
    const qualityLabel = task.blockedByPrevious
      ? "⚠️ 前序章节存在阻塞：请先点击上方标红章节的「重试/介入」修复问题，后续章节将自动恢复。"
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
    chatMessagesBox.querySelector("[data-discussion-context-region]")
    && chatMessagesBox.querySelector("[data-discussion-history-region]")
    && chatMessagesBox.querySelector("[data-discussion-empty-region]")
    && chatMessagesBox.querySelector("[data-discussion-static-region]")
    && chatMessagesBox.querySelector("[data-discussion-result-region]")
    && chatMessagesBox.querySelector("[data-live-region]"),
  )
  if (hasShell) {
    return false
  }

  chatMessagesBox.innerHTML = `
    <div data-discussion-context-region="true"></div>
    <div data-discussion-history-region="true"></div>
    <div data-discussion-empty-region="true"></div>
    <div data-discussion-static-region="true"></div>
    <div data-discussion-result-region="true"></div>
    <div data-live-region="true"></div>
  `
  return true
}

function renderDiscussionContextBanner(model, staticCount, hasLiveEntries) {
  const stageLabel = model.workflow?.currentStage?.label || "等待快照"
  const totalChapters = Number(model.project?.totalChapters || 0)
  const chapterCount = Array.isArray(model.chapters?.items) ? model.chapters.items.length : 0
  const page = Number(model.chapters?.window?.page || dashboardState.chapterPage || 1)
  const pageCount = Number(model.chapters?.window?.pageCount || 1)
  const chapterHint = chapterCount > 0
    ? `右侧“正式章节任务”当前显示 ${chapterCount} 条，全部章节通过分页查看（第 ${page}/${pageCount} 页）。`
    : totalChapters > 0
      ? `右侧“正式章节任务”会在章节任务正式入库后显示；当前目标 ${totalChapters} 章。`
      : "右侧“正式章节任务”会在数据库快照同步后显示。"
  return `
    <div class="discussion-context-banner">
      <div class="discussion-context-title">
        <i class="fa-solid fa-circle-info"></i>
        <span>当前正式阶段：${escapeHtml(stageLabel)}</span>
      </div>
      <p>这里展示的是可追踪讨论记录与实时执行流${hasLiveEntries ? "（含当前流式输出）" : ""}，不等同于左侧正式阶段。</p>
      <small>已加载 ${staticCount} 条讨论记录。${escapeHtml(chapterHint)}</small>
    </div>
  `
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

  patchHtmlRegion(
    "[data-discussion-context-region]",
    renderDiscussionContextBanner(model, staticEntries.length, hasLiveEntries),
  )
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
  const hasActiveProject = Boolean(dashboardState.activeProjectId)
  initPanel.classList.toggle("hidden", !hasActiveProject || model.initialized)
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
  renderCreationObservability(model)
  renderProvider(model)
  renderChapters(model)
  renderDiscussion(model)
  renderCocreateReviewPanel(model)
  renderInitPanel(model)
  renderComposerStatus()
  applySidebarPanelLayout()
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
  renderCreationObservability(model)
  renderDiscussion(model)
  renderCocreateReviewPanel(model)
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
  dashboardState.currentPreviewContent = ""
  if (chapterCopyButton) {
    chapterCopyButton.disabled = true
  }
}

function renderPreviewContent(key, role, content) {
  let cleanedContent = (content || "").trim()
  // 匹配并去掉各种形式的 # Final Body \n
  cleanedContent = cleanedContent.replace(/^(#+\s+Final\s+Body\r?\n?|#+\s+final\s+body\r?\n?)/i, "")
  cleanedContent = cleanedContent.trim()

  const renderedHtml = renderDiscussionEntryContentHtml({
    key,
    role,
    content: cleanedContent || "（内容为空）",
    streaming: false,
  }, {
    entryKey: key,
    expandedKeys: new Set([key]),
  }).html

  return `<div class="novel-reader-wrapper">${renderedHtml}</div>`
}

async function previewArtifact(path) {
  if (!path || !dashboardState.activeProjectId) {
    return
  }

  chapterPreviewTitle.textContent = "产物预览"
  chapterPreviewPath.textContent = path
  chapterPreviewBody.innerHTML = `<div class="modal-status is-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>正在读取产物...</span></div>`
  
  if (chapterCopyButton) {
    chapterCopyButton.disabled = true
  }
  dashboardState.currentPreviewContent = ""
  
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
    const content = response.payload.content || ""
    const fileName = String(response.payload.path || path).split("/").pop() || "产物"
    chapterPreviewTitle.textContent = fileName
    chapterPreviewPath.textContent = response.payload.path || path
    chapterPreviewBody.innerHTML = renderPreviewContent(`artifact-preview-${stableTextHash(path)}`, "Showrunner", content)
    
    dashboardState.currentPreviewContent = content
    if (chapterCopyButton) {
      chapterCopyButton.disabled = false
    }
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
  
  if (chapterCopyButton) {
    chapterCopyButton.disabled = true
  }
  dashboardState.currentPreviewContent = ""
  
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
    const content = response.payload.content || ""
    chapterPreviewTitle.textContent = `第 ${response.payload.chapterNumber} 章预览`
    chapterPreviewPath.textContent = response.payload.path || "正式章节文件"
    chapterPreviewBody.innerHTML = renderPreviewContent(`chapter-preview-${chapterNumber}`, "Author", content)
    
    dashboardState.currentPreviewContent = content
    if (chapterCopyButton) {
      chapterCopyButton.disabled = false
    }
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
  const id = llmConfigIdInput.value.trim()
  const name = llmConfigNameInput.value.trim()
  const baseUrl = providerBaseUrlInput.value.trim()
  const apiKey = providerApiKeyInput.value.trim()
  const modelName = providerModelInput.value.trim()

  if (!name || !baseUrl || !apiKey || !modelName) {
    setProviderModalStatus("is-error", "请填写所有必填字段（名称、URL、Key、Model ID）。")
    return
  }

  setProviderModalStatus("is-loading", "正在保存模型配置...")
  let response
  try {
    const payload = { name, baseUrl, apiKey, modelName }
    if (id) {
      payload.id = id
    }
    response = await apiRequest("/api/llm-configs", {
      method: "POST",
      body: payload,
    })
  } catch (error) {
    setProviderModalStatus("is-error", `配置无法保存：${networkErrorMessage(error)}。`)
    return
  }
  
  savedLlmConfigs = response.payload?.configs || []
  renderLlmConfigsList()
  cancelEditLlmConfig()
  
  setProviderModalStatus("is-success", "模型配置已成功保存。")
  addLog("已成功保存大模型配置。")
  await refreshDashboard()
}

async function streamChat(message) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    setComposerStatus("warning", "请先选择一个小说项目。")
    return
  }

  if (dashboardState.chatAbortController) {
    dashboardState.chatAbortController.abort()
    dashboardState.chatAbortController = null
  }
  const abortController = new AbortController()
  dashboardState.chatAbortController = abortController

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
      signal: abortController.signal,
    })
  } catch (error) {
    if (error.name === "AbortError") {
      return
    }
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
    if (error.name === "AbortError") {
      return
    }
    if (isNetworkError(error)) {
      markNetworkOffline(error)
    }
    setComposerStatus("warning", `讨论流已断开：${networkErrorMessage(error)}。恢复连接后会刷新记录。`)
    addLog(`讨论流已断开：${networkErrorMessage(error)}。恢复连接后会刷新最新讨论记录。`)
  } finally {
    if (dashboardState.chatAbortController === abortController) {
      dashboardState.chatAbortController = null
    }
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

  if (dashboardState.autopilotAbortController) {
    dashboardState.autopilotAbortController.abort()
    dashboardState.autopilotAbortController = null
  }
  const abortController = new AbortController()
  dashboardState.autopilotAbortController = abortController

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
      if (error.name === "AbortError") {
        return
      }
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
      signal: abortController.signal,
    })
  } catch (error) {
    if (error.name === "AbortError") {
      return
    }
    if (dashboardState.autopilotAbortController === abortController) {
      dashboardState.autopilotStreamConnected = false
    }
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
    if (dashboardState.autopilotAbortController === abortController) {
      dashboardState.autopilotStreamConnected = false
    }
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
    if (error.name === "AbortError") {
      return
    }
    if (isNetworkError(error)) {
      markNetworkOffline(error)
    }
    setComposerStatus("warning", `无人值守实时连接已断开：${networkErrorMessage(error)}。5秒后自动重新订阅...`)
    addLog(`无人值守实时连接已断开：${networkErrorMessage(error)}。5秒后会自动重新订阅。`)
    
    // 只有当不是主动停止（abortController 依旧有效）时，才触发自动重连
    if (dashboardState.autopilotAbortController === abortController) {
      setTimeout(() => {
        if (dashboardState.activeProjectId && !dashboardState.autopilotStreamConnected) {
          addLog("正在自动重新连接状态流...")
          streamAutopilot("", { skipStart: true, resume: true }).catch(() => {})
        }
      }, 5000)
    }
  } finally {
    if (dashboardState.autopilotAbortController === abortController) {
      dashboardState.autopilotStreamConnected = false
      dashboardState.autopilotAbortController = null
    }
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
  const currentView = window.localStorage.getItem("ai-novel-factory.currentView") || "manager"
  if (currentView === "studio" && storedProjectId && dashboardState.projects.some((project) => project.id === storedProjectId)) {
    dashboardState.activeProjectId = storedProjectId
    loadPanelLayout(storedProjectId)
    await refreshDashboard({ includeDiscussionHistory: true })
    maybeResumeAutopilotFromSnapshot()
  } else {
    showManagerView()
  }
  return response
}

async function selectProject(projectId) {
  if (dashboardState.autopilotAbortController) {
    dashboardState.autopilotAbortController.abort()
    dashboardState.autopilotAbortController = null
  }
  if (dashboardState.chatAbortController) {
    dashboardState.chatAbortController.abort()
    dashboardState.chatAbortController = null
  }
  dashboardState.autopilotStreamConnected = false
  dashboardState.autopilotActive = false

  dashboardState.activeProjectId = projectId
  loadPanelLayout(projectId)
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
  const control = autopilotControlState()
  syncComposerStatusFromAutopilotControl()
  if (control.paused) {
    addLog("检测到可恢复的自动创作任务，等待手动继续。")
  }
  
  // 无论控制状态如何，如果目前没有建立长连接，都在后台静默发起订阅，以自动侦测正在运行或重试的后台任务
  if (!dashboardState.autopilotStreamConnected) {
    addLog("正在后台静默连接状态流...")
    streamAutopilot("", { skipStart: true, resume: true }).catch((error) => {
      console.warn("静默连接状态流失败:", error)
    })
  }
  renderAutopilotControls()
  return control.paused
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

async function runComposerAction(action) {
  if (dashboardState.composerStatus.busy) {
    setComposerStatus("warning", "上一条消息正在提交，请等待当前请求送达后再操作。", { busy: true })
    return
  }

  if (action === "advance") return runAdvance("composer action")
  if (action === "cover") return runCover()
  if (action === "provider-test") return runProviderTest()
  if (action === "stop") return requestStopAutopilot()
  if (action === "interrupt") {
    const message = composerInput.value.trim()
    if (message) {
      composerInput.value = ""
      return runInterrupt(message)
    }
    window.insertCommand("/interrupt")
    return
  }
}

  document.addEventListener("DOMContentLoaded", async () => {
  sendButton.addEventListener("click", handleComposerSubmit)
  document.querySelectorAll("[data-composer-action]").forEach((button) => {
    button.addEventListener("click", () => runComposerAction(button.dataset.composerAction || ""))
  })
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
  chapterCopyButton?.addEventListener("click", async () => {
    const textToCopy = dashboardState.currentPreviewContent || ""
    if (!textToCopy) return

    try {
      await navigator.clipboard.writeText(textToCopy)
      
      const span = chapterCopyButton.querySelector("span")
      const icon = chapterCopyButton.querySelector("i")
      if (span && icon) {
        const originalText = span.textContent
        const originalIconClass = icon.className
        
        span.textContent = "已复制！"
        icon.className = "fa-solid fa-circle-check"
        chapterCopyButton.classList.add("btn-success-feedback")
        
        setTimeout(() => {
          span.textContent = originalText
          icon.className = originalIconClass
          chapterCopyButton.classList.remove("btn-success-feedback")
        }, 1500)
      }
    } catch (err) {
      console.error("复制失败:", err)
      alert("复制失败，请手动选择复制。")
    }
  })

  // ── 知识图谱 Modal ────────────────────────────────────────────
  const knowledgeGraphModal = document.getElementById("knowledge-graph-modal")
  const knowledgeGraphIframe = document.getElementById("knowledge-graph-iframe")
  const knowledgeGraphModalClose = document.getElementById("knowledge-graph-modal-close")
  const openKnowledgeGraphButton = document.getElementById("open-knowledge-graph-button")
  const kgModalProjectName = document.getElementById("kg-modal-project-name")

  function openKnowledgeGraphModal() {
    if (!knowledgeGraphModal || !knowledgeGraphIframe) return
    // 设置项目名称标签
    if (kgModalProjectName) {
      const projectTitle = dashboardState.state?.project?.title || document.getElementById("project-title-display")?.textContent || ""
      kgModalProjectName.textContent = projectTitle && projectTitle !== "等待选择小说项目" ? projectTitle : ""
    }
    // 每次打开图谱时，都向 iframe 发送最新数据（确保热更新和后续的数据同步）
    const sendGraphData = async () => {
      let graphNodes = []
      let graphEdges = []
      try {
        const res = await apiRequest(`/api/knowledge-graph?projectId=${dashboardState.activeProjectId}`)
        if (res.ok && res.payload) {
          graphNodes = res.payload.nodes || []
          graphEdges = res.payload.edges || []
        }
      } catch (err) {
        console.error("Failed to fetch knowledge graph:", err)
      }

      knowledgeGraphIframe.contentWindow?.postMessage({
        type: "NOVEL_GRAPH_DATA",
        projectId: dashboardState.activeProjectId,
        projectName: dashboardState.state?.project?.title || document.getElementById("project-title-display")?.textContent || "未命名项目",
        snapshot: {
          ...dashboardState.factorySnapshot,
          graphNodes: graphNodes,
          graphEdges: graphEdges,
        },
        state: dashboardState.state,
      }, "*")
    }

    // 显示 modal
    knowledgeGraphModal.classList.remove("hidden")
    document.body.style.overflow = "hidden"

    // 加载图谱页面（仅首次加载，避免重复刷新）
    // 必须等待真正加载完毕才能 postMessage，否则会发给空的 iframe
    const currentSrc = knowledgeGraphIframe.getAttribute("src");
    if (!currentSrc || currentSrc !== "./knowledge-graph.html") {
      knowledgeGraphIframe.addEventListener("load", sendGraphData, { once: true })
      knowledgeGraphIframe.setAttribute("src", "./knowledge-graph.html");
    } else {
      sendGraphData()
    }
  }

  function closeKnowledgeGraphModal() {
    if (!knowledgeGraphModal) return
    knowledgeGraphModal.classList.add("hidden")
    document.body.style.overflow = ""
  }

  openKnowledgeGraphButton?.addEventListener("click", openKnowledgeGraphModal)
  knowledgeGraphModalClose?.addEventListener("click", closeKnowledgeGraphModal)
  knowledgeGraphModal?.addEventListener("click", (event) => {
    if (event.target === knowledgeGraphModal) {
      closeKnowledgeGraphModal()
    }
  })
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !knowledgeGraphModal?.classList.contains("hidden")) {
      closeKnowledgeGraphModal()
    }
  })
  // ── 知识图谱 Modal 结束 ────────────────────────────────────────

  providerTestButton.addEventListener("click", runModalProviderTest)
  providerSaveButton.addEventListener("click", saveProviderConfigFromModal)
  llmConfigCancelEditButton?.addEventListener("click", cancelEditLlmConfig)

  llmConfigsList?.addEventListener("click", (event) => {
    const activateBtn = event.target.closest(".btn-activate")
    if (activateBtn) {
      const id = activateBtn.dataset.id
      if (id) activateLlmConfig(id).catch(console.error)
      return
    }

    const editBtn = event.target.closest(".btn-edit")
    if (editBtn) {
      const id = editBtn.dataset.id
      if (id) editLlmConfig(id)
      return
    }

    const deleteBtn = event.target.closest(".btn-delete")
    if (deleteBtn) {
      const id = deleteBtn.dataset.id
      if (id) deleteLlmConfig(id).catch(console.error)
      return
    }
  })

  initButton.addEventListener("click", initializeWorkspace)
  autopilotStartButton?.addEventListener("click", startAutopilotFromButton)
  autopilotStopButton?.addEventListener("click", requestStopAutopilot)
  autopilotModeButton?.addEventListener("click", toggleAutopilotMode)
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
  const btnScrollBottom = document.getElementById("btn-scroll-bottom")
  if (btnScrollBottom) {
    btnScrollBottom.addEventListener("click", () => {
      chatMessagesBox.scrollTo({
        top: chatMessagesBox.scrollHeight,
        behavior: "smooth"
      })
      dashboardState.discussionAutoStickToBottom = true
      btnScrollBottom.classList.add("hidden")
    })
  }

  chatMessagesBox.addEventListener("scroll", () => {
    dashboardState.discussionAutoStickToBottom = shouldAutoScrollDiscussion(chatMessagesBox)
    if (btnScrollBottom) {
      const isFarFromBottom = chatMessagesBox.scrollHeight - chatMessagesBox.scrollTop - chatMessagesBox.clientHeight > 300
      btnScrollBottom.classList.toggle("hidden", !isFarFromBottom)
    }
  })
  sidebarRight?.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-panel-toggle]")
    if (toggle) {
      const moduleKey = toggle.dataset.panelToggle
      if (moduleKey) {
        togglePanelModule(moduleKey)
      }
      return
    }

    const focusButton = event.target.closest("#chapter-focus-toggle-button")
    if (focusButton) {
      setChapterFocus(!normalizePanelLayout(dashboardState.panelLayout).chapterFocus)
    }
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
  loadPanelLayout()
  applySidebarPanelLayout()
  addLog("AI Novel Factory Studio 已启动。")
  await loadProjects()

  // 渐隐并隐藏首屏全屏 Loading 遮罩层
  const appMask = document.getElementById("app-loading-mask")
  if (appMask) {
    appMask.style.opacity = "0"
    appMask.style.pointerEvents = "none"
    setTimeout(() => {
      appMask.style.visibility = "hidden"
    }, 500)
  }
})
