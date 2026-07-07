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
const readerView = document.getElementById("reader-view")
const studioWorkspaceShell = document.getElementById("studio-workspace-shell")
const workspaceTabDiscussion = document.getElementById("workspace-tab-discussion")
const workspaceTabStyle = document.getElementById("workspace-tab-style")
const workspacePanelDiscussion = document.getElementById("workspace-panel-discussion")
const workspacePanelStyle = document.getElementById("workspace-panel-style")
const readerBackButton = document.getElementById("reader-back-button")
const readerStudioButton = document.getElementById("reader-studio-button")
const readerProjectTitle = document.getElementById("reader-project-title")
const readerProjectMeta = document.getElementById("reader-project-meta")
const readerSearchInput = document.getElementById("reader-search-input")
const readerChapterSelect = document.getElementById("reader-chapter-select")
const readerPrevChapterButton = document.getElementById("reader-prev-chapter")
const readerNextChapterButton = document.getElementById("reader-next-chapter")
const readerBookmarkToggle = document.getElementById("reader-bookmark-toggle")
const readerCatalogToggle = document.getElementById("reader-catalog-toggle")
const readerInsightsToggle = document.getElementById("reader-insights-toggle")
const readerWidthToggle = document.getElementById("reader-width-toggle")
const readerFontDown = document.getElementById("reader-font-down")
const readerFontUp = document.getElementById("reader-font-up")
const readerThemeToggle = document.getElementById("reader-theme-toggle")
const readerFocusToggle = document.getElementById("reader-focus-toggle")
const readerProgressFill = document.getElementById("reader-progress-fill")
const readerShell = document.getElementById("reader-shell")
const readerCatalogCount = document.getElementById("reader-catalog-count")
const readerCatalogFilter = document.getElementById("reader-catalog-filter")
const readerCatalogList = document.getElementById("reader-catalog-list")
const readerPage = document.getElementById("reader-page")
const readerChapterNav = document.getElementById("reader-chapter-nav")
const readerTabs = document.getElementById("reader-tabs")
const readerInsightBody = document.getElementById("reader-insight-body")
const sidebarRight = document.getElementById("sidebar-right")
const styleWorkspacePanel = document.getElementById("style-workspace-panel")
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
const providerApiModeInput = document.getElementById("provider-api-mode-input")
const providerTestButton = document.getElementById("provider-test-button")
const providerSaveButton = document.getElementById("provider-save-button")
const providerModalStatus = document.getElementById("provider-modal-status")
const llmConfigsList = document.getElementById("llm-configs-list")
const llmFormTitle = document.getElementById("llm-form-title")
const llmConfigIdInput = document.getElementById("llm-config-id-input")
const llmConfigNameInput = document.getElementById("llm-config-name-input")
const llmConfigCancelEditButton = document.getElementById("llm-config-cancel-edit-button")
const llmRouteInputs = {
  text: document.getElementById("llm-route-text"),
  style_evolution: document.getElementById("llm-route-style-evolution"),
  image: document.getElementById("llm-route-image"),
  video: document.getElementById("llm-route-video"),
  audio: document.getElementById("llm-route-audio"),
  embedding: document.getElementById("llm-route-embedding"),
}
const tabBtnRouting = document.getElementById("tab-btn-routing")
const tabBtnModels = document.getElementById("tab-btn-models")
const tabBtnWriting = document.getElementById("tab-btn-writing")
const tabContentRouting = document.getElementById("tab-content-routing")
const tabContentModels = document.getElementById("tab-content-models")
const tabContentWriting = document.getElementById("tab-content-writing")
const llmFooterLeft = document.getElementById("llm-footer-left")
const llmFooterRightButtons = document.getElementById("llm-footer-right-buttons")
const writingFooterRightButtons = document.getElementById("writing-footer-right-buttons")
const settingBypassAigc = document.getElementById("setting-bypass-aigc")
const settingAutoRefine = document.getElementById("setting-auto-refine")
const draftSubcallRoleCheckboxes = Array.from(document.querySelectorAll("[data-draft-subcall-role]"))
const writingSettingsSaveButton = document.getElementById("writing-settings-save-button")
const writingSettingsStatus = document.getElementById("writing-settings-status")
const writingSettingsStatusText = document.getElementById("writing-settings-status-text")

const aigcRefinementPanel = document.getElementById("aigc-refinement-panel")
const refineScanAllBtn = document.getElementById("refine-scan-all-btn")
const refineAutoAllBtn = document.getElementById("refine-auto-all-btn")
const refineCompleteBtn = document.getElementById("refine-complete-btn")
const refineStatTotal = document.getElementById("refine-stat-total")
const refineStatPending = document.getElementById("refine-stat-pending")
const refineStatBlocked = document.getElementById("refine-stat-blocked")
const refineStatPassed = document.getElementById("refine-stat-passed")
const refineProgressContainer = document.getElementById("refine-progress-container")
const refineProgressTitle = document.getElementById("refine-progress-title")
const refineProgressPercent = document.getElementById("refine-progress-percent")
const refineProgressFill = document.getElementById("refine-progress-fill")
const refineProgressDesc = document.getElementById("refine-progress-desc")
const refineChaptersGrid = document.getElementById("refine-chapters-grid")

const CONFIGURED_SECRET_PLACEHOLDER = "[configured]"
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
const projectCreateGenreInput = document.getElementById("project-create-genre-input")
const projectCreateNaturalnessInput = document.getElementById("project-create-naturalness-input")
const projectCreateReaderPromiseInput = document.getElementById("project-create-reader-promise-input")
const projectCreatePovInput = document.getElementById("project-create-pov-input")
const projectCreateToneInput = document.getElementById("project-create-tone-input")
const projectCreateStyleFingerprintInput = document.getElementById("project-create-style-fingerprint-input")
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
const READER_SETTINGS_STORAGE_KEY = "ai-novel-factory.readerSettings"
const NETWORK_RETRY_BASE_MS = 3000
const NETWORK_RETRY_MAX_MS = 30000
const STARTUP_LOADING_MASK_FALLBACK_MS = 8000
const DISCUSSION_PAGE_SIZE = 20
const PRODUCTION_DEFAULT_TOTAL_CHAPTERS = 40
const PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET = 3000

// Project wizard state and DOM references
let currentCreateStep = 1;

const projectCreatePrevButton = document.getElementById("project-create-prev-button");
const projectCreateNextButton = document.getElementById("project-create-next-button");
const projectCreateQuickButton = document.getElementById("project-create-quick-button");
const genrePromiseText = document.getElementById("genre-promise-text");
const genrePoisonsList = document.getElementById("genre-poisons-list");

const FRONTEND_GENRE_PRESETS = {
  "auto-inferred": {
    readerPromise: "系统会根据你的小说创意想法，自动识别最贴近的题材类型，并自动应用其对应的写作模板与读者承诺。",
    poisons: [
      "根据识别出的题材自动拦截低智反派、流水账等通用 AI 毒点。",
      "适合不想做复杂设定、完全交给系统的快捷创作。"
    ]
  },
  "修仙/仙侠": {
    readerPromise: "逆天改命的出尘感、天道无情的修行代价与人情冷暖。",
    poisons: [
      "修仙者动辄因鸡毛蒜皮像市井流氓般无脑辱骂",
      "修行没有感悟与历练，全靠疯狂吃药平推",
      "活了数千年的老怪表现得毫无心智深度与城府"
    ]
  },
  "玄幻": {
    readerPromise: "力量进阶、世界观奇观、跨阶御敌的极致爽感。",
    poisons: [
      "强行弱智化对手以显得主角聪明",
      "战力体系崩溃，战斗描写全靠大喊功法招式与境界名字",
      "主角无代价升级，缺乏成长阻力与修行因果"
    ]
  },
  "悬疑": {
    readerPromise: "烧脑解谜的智商博弈、信息茧房拆除的震撼、危机降临的压迫恐惧感。",
    poisons: [
      "破案侦探缺乏证据链支撑，全靠灵光一现拍脑门",
      "严禁机械降神：绝不允许在最后关头凭空冒出前文从未提及的新线索破案",
      "反派在最后关头像动漫角色般滔滔不绝主动交代过程"
    ]
  },
  "都市/现实": {
    readerPromise: "现代职场/生活的强烈代入感、人情往来的情绪共鸣、逆袭规则的爽感。",
    poisons: [
      "强行塞入低端、反智的无脑嘲讽打脸套路",
      "主角专业技能漏洞百出，脱离现实社会常识",
      "职场合作写成儿戏般的小学宫斗"
    ]
  },
  "言情/情感": {
    readerPromise: "情感戏的过山车张力、拉扯感与宿命救赎感。",
    poisons: [
      "男女主角强行降智陷入小学级误会（形成憋气/憋宝）",
      "强行堆砌工业糖精，缺乏情感因果递进",
      "为了虐而虐，撕碎人物底线尊严"
    ]
  },
  "历史/古代": {
    readerPromise: "宏大的时代沧桑感、官场谋略交锋、以超前心智重塑古风秩序的爽感。",
    poisons: [
      "古代人物满口现代网络烂梗与超前政治用语",
      "历史背景漏洞百出，称谓与度量衡极度反智",
      "强行让历史英烈名臣沦为主角降智的陪衬"
    ]
  },
  "科幻/赛博": {
    readerPromise: "硬核理论降维打击的震撼、宇宙尺度下的存在主义思考、高科技奇观的冰冷震撼。",
    poisons: [
      "技术概念解释完全脱离基本数理逻辑，沦为民科臆想",
      "太空科幻背景下依然只是换了马甲的冷兵器物理砍杀",
      "技术仅仅作为背景，对人物生存状态和道德抉择无实际约束"
    ]
  },
  "无限流": {
    readerPromise: "诡异规则极限拆解的智谋快感、生死绝境下的人性多面性、关卡奖励与技能兑换。",
    poisons: [
      "主角一进入副本就如同拿到剧本般无所不能，缺乏探索的悬念",
      "主神生存规则形同虚设，沦为主角无脑秀个人武力的沙盒",
      "队友智商全部下线，既无对抗思维也无自救能力"
    ]
  }
};


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
  projectRuntime: null,
  knowledgeEvaluation: null,
  knowledgeSearch: {
    query: "",
    status: "idle",
    message: "",
    result: null,
  },
  styleEvolution: null,
  styleEvolutionAssets: null,
  styleEvolutionUi: {
    loading: false,
    message: "",
    error: "",
    selectedVersion: null,
    lastLoopRun: null,
    lastModelRouting: null,
    rejectionReasonDraft: "",
    lastCandidateBatch: [],
    freezePreview: null,
  },
  coverPolling: {
    projectId: "",
    timer: null,
    attempts: 0,
  },
  coverPreview: {
    path: "",
    dataUrl: "",
    loading: false,
  },
  coverPreviews: {},
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
  reader: {
    snapshot: null,
    loading: false,
    chapterLoadingNumbers: new Set(),
    error: "",
    chapterError: "",
    chapterNumber: null,
    search: "",
    catalogFilter: "all",
    searchResults: [],
    searchLoading: false,
    searchError: "",
    searchTimer: null,
    fontSize: 18,
    theme: "dark",
    width: "normal",
    panel: "characters",
    focusMode: false,
    catalogCollapsed: false,
    insightsCollapsed: false,
    bookmarks: [],
    chapterProgress: {},
    versionCompare: null,
    versionCompareLoading: false,
    versionCompareError: "",
    progressSaveTimer: null,
  },
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
    workspace: "discussion",
    modules: {
      overview: true,
      style: true,
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
    workspace: "discussion",
    modules: {
      overview: true,
      style: true,
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
    workspace: layout?.workspace === "style" ? "style" : "discussion",
    modules: {
      overview: modules.overview ?? defaults.modules.overview,
      style: modules.style ?? defaults.modules.style,
      chapters: modules.chapters ?? defaults.modules.chapters,
      observability: modules.observability ?? defaults.modules.observability,
      logs: modules.logs ?? defaults.modules.logs,
    },
  }
}

function setWorkspaceView(workspace, { persist = true } = {}) {
  const nextLayout = normalizePanelLayout(dashboardState.panelLayout)
  nextLayout.workspace = workspace === "style" ? "style" : "discussion"
  dashboardState.panelLayout = nextLayout
  if (persist) {
    persistPanelLayout()
  }
  applySidebarPanelLayout()
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
  const workspace = layout.workspace || "discussion"
  studioWorkspaceShell?.setAttribute("data-workspace", workspace)
  sidebarRight?.setAttribute("data-workspace", workspace)
  workspaceTabDiscussion?.classList.toggle("is-active", workspace === "discussion")
  workspaceTabDiscussion?.setAttribute("aria-selected", workspace === "discussion" ? "true" : "false")
  workspaceTabStyle?.classList.toggle("is-active", workspace === "style")
  workspaceTabStyle?.setAttribute("aria-selected", workspace === "style" ? "true" : "false")
  workspacePanelDiscussion?.classList.toggle("is-active", workspace === "discussion")
  workspacePanelStyle?.classList.toggle("is-active", workspace === "style")
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

function loadReaderSettings() {
  if (typeof window === "undefined") return
  try {
    const stored = JSON.parse(window.localStorage.getItem(READER_SETTINGS_STORAGE_KEY) || "{}")
    if (Number.isFinite(Number(stored.fontSize))) {
      dashboardState.reader.fontSize = Math.max(15, Math.min(26, Number(stored.fontSize)))
    }
    if (stored.theme === "paper" || stored.theme === "dark") {
      dashboardState.reader.theme = stored.theme
    }
    if (stored.width === "wide" || stored.width === "normal") {
      dashboardState.reader.width = stored.width
    }
    if (stored.panel) {
      dashboardState.reader.panel = String(stored.panel)
    }
    dashboardState.reader.focusMode = Boolean(stored.focusMode)
    dashboardState.reader.catalogCollapsed = Boolean(stored.catalogCollapsed)
    dashboardState.reader.insightsCollapsed = Boolean(stored.insightsCollapsed)
  } catch {
    // Ignore malformed local settings.
  }
}

function saveReaderSettings() {
  if (typeof window === "undefined") return
  window.localStorage.setItem(READER_SETTINGS_STORAGE_KEY, JSON.stringify({
    fontSize: dashboardState.reader.fontSize,
    theme: dashboardState.reader.theme,
    width: dashboardState.reader.width,
    panel: dashboardState.reader.panel,
    focusMode: dashboardState.reader.focusMode,
    catalogCollapsed: dashboardState.reader.catalogCollapsed,
    insightsCollapsed: dashboardState.reader.insightsCollapsed,
  }))
}

function readerBookmarksStorageKey(projectId = dashboardState.activeProjectId) {
  return `ai-novel-factory.readerBookmarks.${projectId || "default"}`
}

function loadReaderBookmarks(projectId = dashboardState.activeProjectId) {
  if (typeof window === "undefined" || !projectId) return []
  try {
    const value = JSON.parse(window.localStorage.getItem(readerBookmarksStorageKey(projectId)) || "[]")
    return Array.isArray(value)
      ? value
        .map((bookmark) => ({
          chapterNumber: Number(bookmark.chapterNumber),
          title: String(bookmark.title || ""),
          note: String(bookmark.note || ""),
          scrollRatio: Number.isFinite(Number(bookmark.scrollRatio)) ? Math.max(0, Math.min(1, Number(bookmark.scrollRatio))) : 0,
          updatedAt: String(bookmark.updatedAt || ""),
        }))
        .filter((bookmark) => Number.isFinite(bookmark.chapterNumber) && bookmark.chapterNumber > 0)
      : []
  } catch {
    return []
  }
}

function saveReaderBookmarks(projectId = dashboardState.activeProjectId) {
  if (typeof window === "undefined" || !projectId) return
  window.localStorage.setItem(readerBookmarksStorageKey(projectId), JSON.stringify(dashboardState.reader.bookmarks || []))
}

function readerProgressStorageKey(projectId = dashboardState.activeProjectId) {
  return `ai-novel-factory.readerProgress.${projectId || "default"}`
}

function readerChapterProgressStorageKey(projectId = dashboardState.activeProjectId) {
  return `ai-novel-factory.readerChapterProgress.${projectId || "default"}`
}

function loadReaderChapterProgress(projectId = dashboardState.activeProjectId) {
  if (typeof window === "undefined" || !projectId) return {}
  try {
    const value = JSON.parse(window.localStorage.getItem(readerChapterProgressStorageKey(projectId)) || "{}")
    if (!value || typeof value !== "object") return {}
    return Object.fromEntries(Object.entries(value).map(([chapterNumber, entry]) => {
      const progress = typeof entry === "object" && entry !== null ? entry : {}
      return [chapterNumber, {
        ratio: Number.isFinite(Number(progress.ratio)) ? Math.max(0, Math.min(1, Number(progress.ratio))) : 0,
        completed: Boolean(progress.completed),
        updatedAt: String(progress.updatedAt || ""),
      }]
    }))
  } catch {
    return {}
  }
}

function saveReaderChapterProgress(projectId = dashboardState.activeProjectId) {
  if (typeof window === "undefined" || !projectId) return
  window.localStorage.setItem(readerChapterProgressStorageKey(projectId), JSON.stringify(dashboardState.reader.chapterProgress || {}))
}

function loadReaderProgress(projectId = dashboardState.activeProjectId) {
  if (typeof window === "undefined" || !projectId) return null
  try {
    const progress = JSON.parse(window.localStorage.getItem(readerProgressStorageKey(projectId)) || "{}")
    return {
      chapterNumber: Number.isFinite(Number(progress.chapterNumber)) ? Number(progress.chapterNumber) : null,
      scrollRatio: Number.isFinite(Number(progress.scrollRatio)) ? Math.max(0, Math.min(1, Number(progress.scrollRatio))) : 0,
    }
  } catch {
    return null
  }
}

function saveReaderProgress(scrollRatio = null) {
  if (typeof window === "undefined" || !dashboardState.activeProjectId || !dashboardState.reader.chapterNumber) return
  const ratio = scrollRatio === null ? currentReaderScrollRatio() : scrollRatio
  updateReaderChapterProgress(ratio)
  window.localStorage.setItem(readerProgressStorageKey(), JSON.stringify({
    chapterNumber: Number(dashboardState.reader.chapterNumber),
    scrollRatio: Math.max(0, Math.min(1, Number(ratio) || 0)),
    updatedAt: new Date().toISOString(),
  }))
  saveReaderChapterProgress()
  renderReaderCatalog()
  updateReaderStatsStrip()
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

function currentProjectRuntime() {
  return dashboardState.projectRuntime
    || dashboardState.factorySnapshot?.projectRuntime
    || dashboardState.projects.find((project) => project.id === dashboardState.activeProjectId)?.summary?.projectRuntime
    || null
}

function hasStartedProductionWorkflow() {
  const projectRuntime = currentProjectRuntime()
  if (projectRuntime?.primaryAction === "continue"
    || projectRuntime?.primaryAction === "resume"
    || projectRuntime?.primaryAction === "pause"
    || projectRuntime?.productionStatus === "drafting"
    || projectRuntime?.productionStatus === "reviewing"
    || projectRuntime?.productionStatus === "blocked"
    || projectRuntime?.productionStatus === "replanning"
    || projectRuntime?.nextTarget?.type === "chapter") {
    return true
  }
  const stage = dashboardState.state?.runtime?.stage || ""
  const productionStages = new Set(["setting_review", "master_planning", "chapter_task_generation", "drafting", "reviewing", "replanning"])
  if (!productionStages.has(stage)) {
    return false
  }
  const summary = dashboardState.factorySnapshot?.productionSummary || dashboardState.projects.find((project) => project.id === dashboardState.activeProjectId)?.summary || {}
  const completed = Number(summary.completedChapters ?? dashboardState.state?.plan?.chapterTaskSummary?.complete ?? 0)
  const blocked = Number(summary.blockedChapters ?? dashboardState.state?.plan?.chapterTaskSummary?.blocked ?? 0)
  const inProgress = Number(summary.inProgressChapters ?? dashboardState.state?.plan?.chapterTaskSummary?.inProgress ?? 0)
  return completed > 0 || blocked > 0 || inProgress > 0 || stage === "drafting" || stage === "reviewing"
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
  const projectRuntime = currentProjectRuntime()
  const recoverable = hasRecoverableAutopilotJob()
  const workflowStarted = hasStartedProductionWorkflow()
  const running = Boolean(
    projectRuntime?.executionStatus === "running"
    || runtimeAutopilot.running
    || hasRunningAutopilotJob()
    || (dashboardState.autopilotActive && dashboardState.autopilotStreamConnected),
  )
  return {
    running,
    recoverable: recoverable || projectRuntime?.executionStatus === "paused" || projectRuntime?.executionStatus === "queued",
    workflowStarted,
    paused: (recoverable || projectRuntime?.executionStatus === "paused" || projectRuntime?.executionStatus === "queued") && !running,
    primaryAction: projectRuntime?.primaryAction || "",
    primaryActionLabel: projectRuntime?.primaryActionLabel || "",
    reason: projectRuntime?.reason || "",
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
    : control.primaryActionLabel && control.primaryAction !== "pause" && control.primaryAction !== "none"
      ? control.primaryActionLabel
      : control.paused || control.workflowStarted
      ? "继续创作"
      : "开始创作"
  autopilotStartButton.querySelector("i").className = control.running
    ? "fa-solid fa-spinner fa-spin"
    : control.paused || control.workflowStarted
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
    autopilotStopButton.title = "当前未在运行中"
    if (control.paused) {
      autopilotStartButton.title = "点击继续可恢复的自动创作任务"
      hint = "检测到可恢复任务，点击继续创作"
    } else if (control.workflowStarted) {
      autopilotStartButton.title = "点击继续现有章节生产流程"
      hint = control.reason || "项目已进入生产流程，点击继续创作"
    } else if (control.lastStep === "awaiting_user_start") {
      autopilotStartButton.title = "点击开始自动创作小说"
      hint = "项目已就绪，点击开始创作"
    } else if (control.message) {
      autopilotStartButton.title = "点击继续自动创作小说"
      hint = control.message
    } else {
      autopilotStartButton.title = "点击开始自动创作小说"
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

function getCocreateReviewContent(model) {
  const stage = model.runtime?.stage || ""
  const chapterNumber = model.runtime?.chapterNumber
  const artifacts = Array.isArray(model.artifacts) ? model.artifacts : []

  if (stage === "outline" || stage === "master_planning") {
    const outlineArtifact = artifacts.find((art) => art.path && art.path.includes("master-outline"))
    if (outlineArtifact && outlineArtifact.content) {
      return {
        title: "生成的主线大纲预览：",
        content: outlineArtifact.content
      }
    }
  }

  if ((stage === "blueprint" || stage === "chapter_task_generation") && chapterNumber) {
    const paddedCh = String(chapterNumber).padStart(3, "0")
    const bpArtifact = artifacts.find((art) => art.path && art.path.includes(`chapter-${paddedCh}`) && art.path.includes("blueprint"))
    if (bpArtifact && bpArtifact.content) {
      return {
        title: `第 ${chapterNumber} 章生成的章节蓝图预览：`,
        content: bpArtifact.content
      }
    }
  }

  if ((stage === "drafting" || stage === "quality" || stage === "reviewing") && chapterNumber) {
    const paddedCh = String(chapterNumber).padStart(3, "0")
    const draftArtifact = artifacts.find((art) => art.path && art.path.includes(`chapter-${paddedCh}`) && (art.path.includes("draft") || art.path.includes("final")))
    if (draftArtifact && draftArtifact.content) {
      return {
        title: `第 ${chapterNumber} 章正文草稿预览：`,
        content: draftArtifact.content
      }
    }
  }

  // 1. 优先尝试从 artifacts 提取最新被加载了完整内容的讨论/共识文件
  const discussionArtifacts = artifacts
    .filter((art) => art.path && (art.path.includes("discussion-") || art.path.includes("consensus")))
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))

  const latestDiscussion = discussionArtifacts[0]
  if (latestDiscussion && latestDiscussion.content) {
    return {
      title: "当前人机讨论收敛草案预览：",
      content: latestDiscussion.content
    }
  }

  // 2. 其次尝试展示全局共识
  if (model.storyMemory?.consensus) {
    return {
      title: "当前讨论共识预览：",
      content: model.storyMemory.consensus
    }
  }

  // 3. 兜底展示当前系统阻碍/运行日志说明
  return {
    title: "当前工作流进展与建议：",
    content: model.runtime?.statusMessage || "工作流已暂停，当前暂无生成的讨论共识草案或草稿文件。"
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

  const reviewData = getCocreateReviewContent(model)
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
          <div class="consensus-title">${escapeHtml(reviewData.title)}</div>
          <pre class="consensus-content">${escapeHtml(reviewData.content)}</pre>
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
      return !identity || !persistedIds.has(identity)
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

const llmCapabilityLabels = {
  text: "文本",
  style_evolution: "Style Evolution",
  image: "图片",
  video: "视频",
  audio: "音频",
  embedding: "Embedding",
}

const llmApiModeLabels = {
  chat: "OpenAI Chat",
  responses: "OpenAI Responses",
}

function normalizeLlmApiMode(value) {
  return value === "responses" ? "responses" : "chat"
}

let savedLlmConfigs = []
let savedLlmRoutes = []

async function loadLlmConfigsList() {
  if (!llmConfigsList) return
  llmConfigsList.innerHTML = `<div class="modal-status is-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>正在加载已保存的配置...</span></div>`
  try {
    const response = await apiRequest("/api/llm-configs")
    if (!response.ok) {
      throw new Error(response.payload?.error || "加载失败")
    }
    savedLlmConfigs = response.payload?.configs || []
    savedLlmRoutes = response.payload?.routes || []
    renderLlmConfigsList()
  } catch (error) {
    llmConfigsList.innerHTML = `<div class="modal-status is-error"><i class="fa-solid fa-circle-exclamation"></i><span>加载失败：${escapeHtml(error.message)}</span></div>`
    renderLlmRouteSelectors()
  }
}

function routeConfigId(capability) {
  const route = savedLlmRoutes.find((item) => item.capability === capability)
  if (typeof route?.config_id === "string") {
    return route.config_id
  }
  if (capability === "text") {
    const activeConfig = savedLlmConfigs.find((config) => config.is_active === 1)
    return typeof activeConfig?.id === "string" ? activeConfig.id : ""
  }
  if (capability === "style_evolution") {
    return routeConfigId("text")
  }
  return ""
}

function capabilitiesForConfig(configId) {
  return Object.entries(llmCapabilityLabels)
    .filter(([capability]) => routeConfigId(capability) === configId)
    .map(([, label]) => label)
}

function renderLlmRouteSelectors() {
  Object.entries(llmRouteInputs).forEach(([capability, input]) => {
    if (!input) return
    const selectedConfigId = routeConfigId(capability)
    const fallbackLabel = capability === "text"
      ? "未指定（使用当前文本默认）"
      : capability === "style_evolution"
        ? "未指定（继承文本生成模型）"
        : "未指定（回退当前文本默认模型）"
    const configOptions = savedLlmConfigs
      .map((config) => {
        const selected = config.id === selectedConfigId ? " selected" : ""
        const label = `${config.name} · ${config.model_name}`
        return `<option value="${escapeHtml(config.id)}"${selected}>${escapeHtml(label)}</option>`
      })
      .join("")
    input.innerHTML = `<option value="">${escapeHtml(fallbackLabel)}</option>${configOptions}`
    input.value = selectedConfigId
    input.disabled = savedLlmConfigs.length === 0
  })
}

function renderLlmConfigsList() {
  if (!llmConfigsList) return
  renderLlmRouteSelectors()
  if (savedLlmConfigs.length === 0) {
    llmConfigsList.innerHTML = `
      <div class="workflow-empty">
        <i class="fa-solid fa-robot"></i>
        <span>没有保存的模型配置，请点击右上角添加。</span>
      </div>
    `
    return
  }

  llmConfigsList.innerHTML = savedLlmConfigs
    .map((config) => {
      const routeBadges = capabilitiesForConfig(config.id)
        .map((label) => `<span class="llm-route-badge">${escapeHtml(label)}</span>`)
        .join("")

      return `
        <div class="llm-config-item" data-id="${escapeHtml(config.id)}">
          <div class="llm-config-item-info">
            <strong>${escapeHtml(config.name)}</strong>
            <span>${escapeHtml(config.base_url)}</span>
            <small>${escapeHtml(config.model_name)} · ${escapeHtml(llmApiModeLabels[normalizeLlmApiMode(config.api_mode)] || "OpenAI Chat")}</small>
            ${routeBadges ? `<div class="llm-route-badges">${routeBadges}</div>` : ""}
          </div>
          <div class="llm-config-item-actions">
            <button class="llm-action-btn btn-test-item" data-id="${escapeHtml(config.id)}" title="测试连通性"><i class="fa-solid fa-plug-circle-check"></i></button>
            <button class="llm-action-btn btn-edit" data-id="${escapeHtml(config.id)}" title="编辑此配置"><i class="fa-solid fa-pen"></i></button>
            <button class="llm-action-btn btn-delete" data-id="${escapeHtml(config.id)}" title="删除此配置"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `
    })
    .join("")
}

async function runItemProviderTest(id, btn) {
  const config = savedLlmConfigs.find((c) => c.id === id)
  if (!config) return

  const originalHtml = btn.innerHTML
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`
  btn.disabled = true

  const payload = {
    id: config.id,
    LLM_BASE_URL: config.base_url,
    LLM_MODEL_ID: config.model_name,
    LLM_API_MODE: normalizeLlmApiMode(config.api_mode),
    LLM_API_KEY: "[configured]"
  }

  try {
    const response = await apiRequest("/api/provider-test", {
      method: "POST",
      body: payload
    })
    const result = response.payload?.result
    if (result?.ok) {
      btn.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i>`
      addLog(`模型 "${config.name}" 测试连接成功：${result.modelName}`)
    } else {
      btn.innerHTML = `<i class="fa-solid fa-xmark" style="color: #ef4444;"></i>`
      alert(`测试失败：${result?.message || "未知原因"}`)
    }
  } catch (error) {
    btn.innerHTML = `<i class="fa-solid fa-xmark" style="color: #ef4444;"></i>`
    alert(`测试发生网络错误：${error.message}`)
  } finally {
    setTimeout(() => {
      btn.innerHTML = originalHtml
      btn.disabled = false
    }, 2000)
  }
}

function switchProviderTab(tabName) {
  const tabs = {
    routing: {
      btn: document.getElementById("tab-btn-routing"),
      content: document.getElementById("tab-content-routing")
    },
    models: {
      btn: document.getElementById("tab-btn-models"),
      content: document.getElementById("tab-content-models")
    },
    writing: {
      btn: document.getElementById("tab-btn-writing"),
      content: document.getElementById("tab-content-writing")
    }
  }

  const footer = document.getElementById("provider-modal-footer")
  const saveWritingBtn = document.getElementById("writing-settings-save-button")

  Object.entries(tabs).forEach(([name, t]) => {
    if (!t.btn || !t.content) return
    if (name === tabName) {
      t.btn.classList.add("active")
      t.btn.style.borderBottomColor = "var(--primary-color)"
      t.btn.style.color = "var(--text-main)"
      t.content.classList.remove("hidden")
      t.content.classList.add("tab-content-active")
    } else {
      t.btn.classList.remove("active")
      t.btn.style.borderBottomColor = "transparent"
      t.btn.style.color = "var(--text-muted)"
      t.content.classList.add("hidden")
      t.content.classList.remove("tab-content-active")
    }
  })

  if (tabName === "writing") {
    footer?.classList.remove("hidden")
    saveWritingBtn?.classList.remove("hidden")
    loadWritingSettings().catch(() => undefined)
  } else {
    footer?.classList.add("hidden")
    saveWritingBtn?.classList.add("hidden")
  }
}

function openProviderModal() {
  cancelEditLlmConfig()

  document.getElementById("provider-form-modal")?.classList.add("hidden")
  switchProviderTab("routing")

  providerConfigModal.classList.remove("hidden")

  loadLlmConfigsList().catch((error) => {
    console.error("Failed to load llm configs list:", error)
  })
}

function closeProviderModal() {
  providerConfigModal.classList.add("hidden")
  document.getElementById("provider-form-modal")?.classList.add("hidden")
}

function editLlmConfig(id) {
  const config = savedLlmConfigs.find((c) => c.id === id)
  if (!config) return

  llmConfigIdInput.value = config.id
  llmConfigNameInput.value = config.name
  providerBaseUrlInput.value = config.base_url
  providerApiKeyInput.value = config.api_key_configured ? CONFIGURED_SECRET_PLACEHOLDER : ""
  providerModelInput.value = config.model_name
  if (providerApiModeInput) providerApiModeInput.value = normalizeLlmApiMode(config.api_mode)

  llmFormTitle.textContent = "编辑模型配置"
  llmConfigCancelEditButton?.classList.remove("hidden")
  setProviderModalStatus("", "正在编辑模型配置，修改后点击保存。")
}

function cancelEditLlmConfig() {
  llmConfigIdInput.value = ""
  llmConfigNameInput.value = ""
  providerBaseUrlInput.value = ""
  providerApiKeyInput.value = ""
  providerModelInput.value = ""
  if (providerApiModeInput) providerApiModeInput.value = "chat"

  llmFormTitle.textContent = "添加模型配置"
  llmConfigCancelEditButton?.classList.add("hidden")
  setProviderModalStatus("", "填写后可先测试连接，再保存。")
}

async function activateLlmConfig(id) {
  setProviderModalStatus("is-loading", "正在设为文本生成默认模型...")
  try {
    const response = await apiRequest("/api/llm-configs/activate", {
      method: "POST",
      body: { id },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "设置失败")
    }
    savedLlmConfigs = response.payload?.configs || []
    savedLlmRoutes = response.payload?.routes || []
    renderLlmConfigsList()
    setProviderModalStatus("is-success", "文本生成默认模型已更新。")
    addLog("已更新文本生成默认模型。")
    await refreshDashboard()
  } catch (error) {
    setProviderModalStatus("is-error", `设置失败：${error.message}`)
  }
}

async function saveLlmConfigRoutes() {
  const routes = {}
  Object.entries(llmRouteInputs).forEach(([capability, input]) => {
    if (input) {
      routes[capability] = input.value
      input.disabled = true
    }
  })

  setProviderModalStatus("is-loading", "正在保存用途分配...")
  try {
    const response = await apiRequest("/api/llm-config-routes", {
      method: "POST",
      body: { routes },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "保存失败")
    }
    savedLlmConfigs = response.payload?.configs || []
    savedLlmRoutes = response.payload?.routes || []
    renderLlmConfigsList()
    setProviderModalStatus("is-success", "用途分配已保存，不同能力会使用对应默认模型。")
    addLog("已保存模型用途分配。")
    await refreshDashboard()
  } catch (error) {
    setProviderModalStatus("is-error", `用途分配保存失败：${networkErrorMessage(error)}。`)
    renderLlmRouteSelectors()
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
    if (!response.ok) {
      throw new Error(response.payload?.error || "删除失败")
    }
    savedLlmConfigs = response.payload?.configs || []
    savedLlmRoutes = response.payload?.routes || []
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

// openProviderModal and closeProviderModal duplicates removed


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

function updateCreateProjectWizard() {
  // 1. Toggle Step Contents
  for (let i = 1; i <= 3; i++) {
    const stepEl = document.getElementById(`project-create-step-${i}`);
    if (stepEl) {
      if (i === currentCreateStep) {
        stepEl.classList.remove("hidden");
      } else {
        stepEl.classList.add("hidden");
      }
    }
  }

  // 2. Update Wizard Step Indicators
  const indicatorSteps = document.querySelectorAll(".wizard-steps-indicator .wizard-step");
  indicatorSteps.forEach((stepEl) => {
    const stepNum = parseInt(stepEl.getAttribute("data-step"), 10);
    if (stepNum === currentCreateStep) {
      stepEl.classList.add("active");
      stepEl.classList.remove("completed");
    } else if (stepNum < currentCreateStep) {
      stepEl.classList.remove("active");
      stepEl.classList.add("completed");
    } else {
      stepEl.classList.remove("active");
      stepEl.classList.remove("completed");
    }
  });

  // 3. Toggle Footer Buttons
  if (currentCreateStep === 1) {
    projectCreatePrevButton.classList.add("hidden");
    projectCreateNextButton.classList.remove("hidden");
    projectCreateQuickButton.classList.remove("hidden");
    projectCreateSubmitButton.classList.add("hidden");
  } else if (currentCreateStep === 2) {
    projectCreatePrevButton.classList.remove("hidden");
    projectCreateNextButton.classList.remove("hidden");
    projectCreateQuickButton.classList.add("hidden");
    projectCreateSubmitButton.classList.add("hidden");
  } else if (currentCreateStep === 3) {
    projectCreatePrevButton.classList.remove("hidden");
    projectCreateNextButton.classList.add("hidden");
    projectCreateQuickButton.classList.add("hidden");
    projectCreateSubmitButton.classList.remove("hidden");
  }
}

function updateGenreDetails(genre) {
  const preset = FRONTEND_GENRE_PRESETS[genre] || FRONTEND_GENRE_PRESETS["auto-inferred"];
  genrePromiseText.textContent = preset.readerPromise;

  genrePoisonsList.innerHTML = "";
  preset.poisons.forEach((poison) => {
    const li = document.createElement("li");
    li.textContent = poison;
    genrePoisonsList.appendChild(li);
  });
}

function selectGenreCard(cardEl) {
  document.querySelectorAll(".genre-cards-grid .genre-card").forEach((el) => {
    el.classList.remove("selected");
  });
  cardEl.classList.add("selected");
  const genre = cardEl.getAttribute("data-genre");
  projectCreateGenreInput.value = genre;
  updateGenreDetails(genre);
}

function openProjectCreateModal() {
  setProjectCreateBusy(false)
  projectCreateTitleInput.value = ""
  projectCreateIdeaInput.value = ""
  projectCreateChaptersInput.value = "24"
  projectCreateWordsInput.value = "2500"
  projectCreateNaturalnessInput.value = "balanced"
  projectCreatePovInput.value = "third-person limited"
  projectCreateToneInput.value = "tense but readable"
  projectCreateReaderPromiseInput.value = "auto"
  projectCreateStyleFingerprintInput.value = ""

  // Reset genre card selections
  projectCreateGenreInput.value = "auto-inferred"
  document.querySelectorAll(".genre-cards-grid .genre-card").forEach((el) => {
    if (el.getAttribute("data-genre") === "auto-inferred") {
      el.classList.add("selected");
    } else {
      el.classList.remove("selected");
    }
  });
  updateGenreDetails("auto-inferred");

  // Reset wizard steps
  currentCreateStep = 1;
  updateCreateProjectWizard();

  setProjectCreateStatus("", "项目创建后将生成完整的设定与大纲，你需要手动点击“开始创作”。")
  projectCreateModal.classList.remove("hidden")
}

function closeProjectCreateModal(options = {}) {
  if (dashboardState.projectCreateInFlight && !options.force) return
  projectCreateModal.classList.add("hidden")
  currentCreateStep = 1;
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
    if (!Object.prototype.hasOwnProperty.call(payload, "projectRuntime")) {
      dashboardState.projectRuntime = dashboardState.factorySnapshot?.projectRuntime || null
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "projectRuntime")) {
    dashboardState.projectRuntime = payload.projectRuntime || payload.factorySnapshot?.projectRuntime || null
  } else if (payload.factorySnapshot?.projectRuntime) {
    dashboardState.projectRuntime = payload.factorySnapshot.projectRuntime
  }
  if (Object.prototype.hasOwnProperty.call(payload, "knowledgeEvaluation")) {
    dashboardState.knowledgeEvaluation = payload.knowledgeEvaluation || null
  }
  if (Object.prototype.hasOwnProperty.call(payload, "styleEvolution")) {
    dashboardState.styleEvolution = payload.styleEvolution || null
    const history = Array.isArray(dashboardState.styleEvolution?.contract?.evolutionHistory)
      ? dashboardState.styleEvolution.contract.evolutionHistory
      : []
    const selectedVersion = Number(dashboardState.styleEvolutionUi?.selectedVersion || 0)
    if (!history.length) {
      dashboardState.styleEvolutionUi = {
        ...dashboardState.styleEvolutionUi,
        selectedVersion: null,
      }
    } else if (!selectedVersion || !history.some((entry) => Number(entry?.version || 0) === selectedVersion)) {
      dashboardState.styleEvolutionUi = {
        ...dashboardState.styleEvolutionUi,
        selectedVersion: Number(history[history.length - 1]?.version || 0) || null,
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "styleEvolutionAssets")) {
    dashboardState.styleEvolutionAssets = payload.styleEvolutionAssets || null
  }
  if (Object.prototype.hasOwnProperty.call(payload, "freezePreview")) {
    dashboardState.styleEvolutionUi = {
      ...dashboardState.styleEvolutionUi,
      freezePreview: payload.freezePreview || null,
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, "modelRouting")) {
    dashboardState.styleEvolutionUi = {
      ...dashboardState.styleEvolutionUi,
      lastModelRouting: payload.modelRouting || null,
    }
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

      const summary = project.summary || {}
      const coverStatus = summary.coverStatus || "pending"
      const coverImagePath = summary.coverImagePath || ""
      const coverVersion = summary.coverGeneratedAt || ""
      const cacheKey = coverPreviewCacheKey(project.id, coverImagePath, coverVersion)
      const cached = coverImagePath ? dashboardState.coverPreviews[cacheKey] : null
      const coverDataUrl = cached ? cached.dataUrl : ""
      const coverLoading = cached ? cached.loading : false

      // Trigger automatic image fetching for each project cover
      if (coverStatus === "complete" && coverImagePath && !coverDataUrl && !coverLoading) {
        loadCoverPreview(coverImagePath, project.id, coverVersion)
      }

      // Generate cover column markup
      let coverHtml = ""
      if (coverStatus === "in_progress") {
        coverHtml = `
          <div class="project-list-cover-inner is-loading" title="AI 正在为您精心绘制小说封面...">
            <div class="shimmer-effect"></div>
            <i class="fa-solid fa-wand-magic-sparkles fa-spin"></i>
            <span>AI绘制中</span>
          </div>
        `
      } else if (coverStatus === "complete" && coverImagePath) {
        if (coverDataUrl) {
          coverHtml = `
            <div class="project-list-cover-inner" data-cover-preview-path="${escapeHtml(coverImagePath)}" data-cover-project-id="${project.id}" data-cover-version="${escapeHtml(coverVersion)}" title="点击查看大图">
              <img class="project-list-cover-img" src="${escapeHtml(coverDataUrl)}" alt="小说封面">
            </div>
          `
        } else {
          coverHtml = `
            <div class="project-list-cover-inner is-loading" title="封面加载中...">
              <i class="fa-solid fa-spinner fa-spin"></i>
              <span>加载中...</span>
            </div>
          `
        }
      } else if (coverStatus === "failed") {
        coverHtml = `
          <div class="project-list-cover-inner is-failed" title="封面绘制失败">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>绘制失败</span>
          </div>
        `
      } else {
        coverHtml = `
          <div class="project-list-cover-inner is-pending" title="待生成 AI 封面">
            <i class="fa-solid fa-image"></i>
            <span>待生成</span>
          </div>
        `
      }

      return `
      <article class="project-card-button" data-project-id="${escapeHtml(project.id)}">
        <div class="project-card-flex-container">
          <div class="project-card-cover-side">
            ${coverHtml}
          </div>
          <div class="project-card-info-side">
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
              <button class="project-card-read" type="button" data-project-reader-id="${escapeHtml(project.id)}">阅读器 <i class="fa-solid fa-book-open-reader"></i></button>
              <button class="project-card-enter" type="button" data-project-enter-id="${escapeHtml(project.id)}">进入创作台 <i class="fa-solid fa-arrow-right"></i></button>
            </div>
          </div>
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
        if (event.target.closest("[data-cover-preview-path]")) {
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

    projectListContainer.querySelectorAll("[data-project-reader-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation()
        openReader(button.dataset.projectReaderId)
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
  const summary = model?.productionSummary || activeProject?.summary || null
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
  readerView?.classList.add("hidden")
  renderManagerView()
}

function showStudioView() {
  dashboardState.currentView = "studio"
  if (typeof window !== "undefined") {
    window.localStorage.setItem("ai-novel-factory.currentView", "studio")
  }
  projectManagerView.classList.add("hidden")
  studioView.classList.remove("hidden")
  readerView?.classList.add("hidden")
  applySidebarPanelLayout()
}

function showReaderView() {
  dashboardState.currentView = "reader"
  if (typeof window !== "undefined") {
    window.localStorage.setItem("ai-novel-factory.currentView", "reader")
  }
  projectManagerView.classList.add("hidden")
  studioView.classList.add("hidden")
  readerView?.classList.remove("hidden")
  renderReaderView()
}

function hideAppLoadingMask() {
  const appMask = document.getElementById("app-loading-mask")
  if (!appMask) return
  if (appMask.dataset.hidden === "true") return
  appMask.dataset.hidden = "true"
  appMask.style.opacity = "0"
  appMask.style.pointerEvents = "none"
  appMask.style.visibility = "hidden"
  window.setTimeout(() => {
    appMask.style.display = "none"
  }, 500)
}

function handleStartupLoadFailure(error) {
  console.error("启动同步失败:", error)
  addLog(`启动同步失败：${networkErrorMessage(error)}。请检查服务连接后重试。`)
  if (!dashboardState.currentView || dashboardState.currentView === "studio") {
    showManagerView()
  } else {
    renderManagerView()
  }
}

function coverPreviewCacheKey(projectId, path, version = "") {
  return `${projectId}:${path}:${version || "current"}`
}

function clearCoverPreviewCache(projectId) {
  if (!projectId) return
  const prefix = `${projectId}:`
  Object.keys(dashboardState.coverPreviews).forEach((key) => {
    if (key.startsWith(prefix)) {
      delete dashboardState.coverPreviews[key]
    }
  })
  if (projectId === dashboardState.activeProjectId) {
    dashboardState.coverPreview = { path: "", dataUrl: "", loading: false }
  }
}

function renderProjectCard(model) {
  document.getElementById("project-title-display").textContent = model.project.title || model.project.id || "未命名项目"

  const coverContainer = document.getElementById("sidebar-project-cover-container")
  const coverStatus = model.project.coverStatus || "pending"
  const coverPath = model.project.coverImagePath || ""
  const coverVersion = model.project.coverGeneratedAt || ""
  const coverPromptPath = model.project.coverPromptPath || ""
  const projectId = model.project.id || dashboardState.activeProjectId

  // Query global cache for cover dataUrl
  const cacheKey = coverPreviewCacheKey(projectId, coverPath, coverVersion)
  const cached = coverPath ? dashboardState.coverPreviews[cacheKey] : null
  const coverDataUrl = cached ? cached.dataUrl : ""
  const coverLoading = cached ? cached.loading : false

  // Trigger loading automatically if completed but not fetched
  if (coverStatus === "complete" && coverPath && !coverDataUrl && !coverLoading) {
    loadCoverPreview(coverPath, projectId, coverVersion)
  }

  // 1. Render cover container
  if (coverContainer) {
    if (coverStatus === "in_progress") {
      coverContainer.innerHTML = `
        <div class="sidebar-cover-loading" title="AI 正在为您精心绘制小说封面...">
          <div class="shimmer-effect"></div>
          <div class="loading-content">
            <i class="fa-solid fa-wand-magic-sparkles fa-spin"></i>
            <span>封面绘制中</span>
          </div>
        </div>
      `
    } else if (coverStatus === "complete" && coverPath) {
      if (coverDataUrl) {
        coverContainer.innerHTML = `
          <div class="book-cover-3d-wrapper" data-cover-preview-path="${escapeHtml(coverPath)}" data-cover-version="${escapeHtml(coverVersion)}" title="点击查看封面大图">
            <div class="book-spine"></div>
            <img class="book-cover-image" src="${escapeHtml(coverDataUrl)}" alt="小说封面">
            <div class="book-cover-shine"></div>
          </div>
        `
      } else {
        coverContainer.innerHTML = `
          <div class="sidebar-cover-loading" title="正在载入封面...">
            <div class="loading-content">
              <i class="fa-solid fa-spinner fa-spin"></i>
              <span>正在载入...</span>
            </div>
          </div>
        `
      }
    } else if (coverStatus === "failed") {
      coverContainer.innerHTML = `
        <div class="sidebar-cover-failed" data-cover-regenerate="true" title="封面绘制失败，点击重试">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>绘制失败</span>
          <small>点击重试</small>
        </div>
      `
    } else {
      // pending
      coverContainer.innerHTML = `
        <div class="sidebar-cover-pending" data-cover-regenerate="true" title="点击一键生成 AI 封面">
          <i class="fa-solid fa-plus"></i>
          <span>生成封面</span>
        </div>
      `
    }
  }

  // 2. Render sidebar metadata item
  const coverStatusNode = document.getElementById("cover-status")
  const coverStatusHtml = coverStatus === "in_progress"
    ? `<i class="fa-solid fa-wand-magic-sparkles"></i> 生成中`
    : coverStatus === "complete"
      ? `<i class="fa-solid fa-circle-check"></i> 已保存`
      : coverStatus === "failed"
        ? `<i class="fa-solid fa-triangle-exclamation"></i> 失败`
        : `<i class="fa-regular fa-clock"></i> 待生成`

  coverStatusNode.innerHTML = `
    <span class="cover-status-line">${coverStatusHtml}</span>
    ${coverStatus === "complete" && coverPath
      ? `<button class="meta-inline-action" type="button" data-cover-preview-path="${escapeHtml(coverPath)}" data-cover-version="${escapeHtml(coverVersion)}" title="预览保存好的封面"><i class="fa-solid fa-image"></i></button>`
      : ""}
    ${coverPromptPath
      ? `<button class="meta-inline-action" type="button" data-artifact-path="${escapeHtml(coverPromptPath)}" title="查看封面提示词"><i class="fa-solid fa-file-lines"></i></button>`
      : ""}
    <button class="meta-inline-action" type="button" data-cover-regenerate="true" title="${coverStatus === "failed" ? "重新生成封面" : "生成封面"}">
      <i class="fa-solid fa-rotate-right"></i>
    </button>
    ${coverStatus === "failed" && model.project.coverError ? `<br><small class="cover-error" style="color: var(--text-danger); font-size: 0.72rem; display: block; margin-top: 2px;">${escapeHtml(model.project.coverError)}</small>` : ""}
  `
  document.getElementById("comic-status").innerHTML = model.project.comicStatus === "in_progress"
    ? `<i class="fa-solid fa-pen-nib"></i> 准备中`
    : model.project.comicStatus === "complete"
      ? `<i class="fa-solid fa-circle-check"></i> 已完成`
      : `<i class="fa-regular fa-clock"></i> 待生成`

  const chaptersEl = document.getElementById("sidebar-meta-chapters")
  const wordsEl = document.getElementById("sidebar-meta-words")
  if (chaptersEl) chaptersEl.textContent = `${model.project.totalChapters} 章`
  if (wordsEl) wordsEl.textContent = `${model.project.chapterWordTarget.toLocaleString("zh-CN")} 字`
}

function workflowReadinessStatus(status) {
  if (status === "passed") return { label: "就绪", icon: "fa-circle-check", klass: "is-passed" }
  if (status === "warning") return { label: "关注", icon: "fa-triangle-exclamation", klass: "is-warning" }
  return { label: "阻塞", icon: "fa-lock", klass: "is-blocked" }
}

function renderWorkflowReadinessIssues(readiness) {
  const issues = Array.isArray(readiness?.issues) ? readiness.issues : []
  const visibleIssues = issues
    .filter((issue) => issue && issue.severity !== "info")
    .slice(0, 2)
  if (visibleIssues.length === 0 && !readiness?.blockedReason) {
    return ""
  }
  const fallbackIssue = readiness?.blockedReason
    ? [{ message: readiness.blockedReason, recoveryHint: "" }]
    : []
  return `
    <div class="workflow-readiness-issues">
      ${[...visibleIssues, ...fallbackIssue].slice(0, 2).map((issue) => `
        <div class="workflow-readiness-issue">
          <strong>${escapeHtml(issue.message || "准备度阻塞")}</strong>
          ${issue.recoveryHint ? `<small>${escapeHtml(issue.recoveryHint)}</small>` : ""}
        </div>
      `).join("")}
    </div>
  `
}

function renderWorkflowReadinessGroups(readiness) {
  const groups = Array.isArray(readiness?.groups) ? readiness.groups : []
  if (!groups.length) return ""
  return `
    <div class="workflow-readiness-groups">
      ${groups.map((group) => {
        const groupMeta = workflowReadinessStatus(group.status)
        const assets = Array.isArray(group.assets) ? group.assets : []
        return `
          <div class="workflow-readiness-group ${groupMeta.klass}">
            <div class="workflow-readiness-group-head">
              <i class="fa-solid ${groupMeta.icon}"></i>
              <span>${escapeHtml(group.label || group.key || "准备项")}</span>
              <small>${escapeHtml(group.summary || "")}</small>
            </div>
            <div class="workflow-readiness-assets">
              ${assets.slice(0, 8).map((asset) => {
                const assetMeta = workflowReadinessStatus(asset.status)
                const assetPath = String(asset.path || "")
                return `
                  <button class="workflow-readiness-asset ${assetMeta.klass}" type="button" data-artifact-path="${escapeHtml(assetPath)}" title="${escapeHtml(assetPath ? `预览 ${assetPath}` : "暂无可预览路径")}" ${assetPath ? "" : "disabled"}>
                    <i class="fa-solid ${assetMeta.icon}"></i>
                    <span>${escapeHtml(asset.label || asset.key || "资产")}</span>
                    <small>${escapeHtml(asset.detail || asset.path || "")}</small>
                  </button>
                `
              }).join("")}
            </div>
          </div>
        `
      }).join("")}
    </div>
  `
}

function buildWorkflowReadiness(model) {
  if (model?.productionReadiness && Array.isArray(model.productionReadiness.items)) {
    return model.productionReadiness
  }
  const artifacts = Array.isArray(model.artifacts) ? model.artifacts : []
  const artifactPathText = (artifact) => String(artifact?.path || artifact?.key || "")
  const hasArtifact = (pattern) => artifacts.some((artifact) => pattern.test(artifactPathText(artifact)))
  const storyMemory = model.storyMemory || {}
  const productionSummary = model.productionSummary || {}
  const pipeline = model.productionPipeline || {}
  const styleGate = dashboardState.styleEvolution?.gate || {}
  const totalChapters = Number(productionSummary.totalChapters || model.project?.totalChapters || 0)
  const blueprintCount = Number(productionSummary.blueprints || pipeline.blueprints || 0)
  const memoryRecall = storyMemory.memoryRecall || {}
  const contextBudget = storyMemory.contextBudget || {}
  const characterDossier = storyMemory.characterDossier || {}
  const consensusReady = Boolean(String(storyMemory.consensusSummary || storyMemory.consensus || "").trim())
  const hasPlanningArtifact = hasArtifact(/master-outline|setting-freeze|plans\/|story-bible|plot-architecture|book-contract/iu)

  const items = [
    {
      label: "核心共识",
      status: consensusReady ? "passed" : "blocked",
      detail: consensusReady ? "已有可追踪共识" : "缺少创作共识",
    },
    {
      label: "世界/主线",
      status: hasPlanningArtifact ? "passed" : "warning",
      detail: hasPlanningArtifact ? "已有规划产物" : "建议补齐世界观、主线和故事圣经",
    },
    {
      label: "人物关系",
      status: Number(characterDossier.count || 0) > 0 || characterDossier.status === "ready" ? "passed" : "blocked",
      detail: Number(characterDossier.count || 0) > 0
        ? `${Number(characterDossier.count || 0)} 个档案`
        : "缺少人物档案",
    },
    {
      label: "章节蓝图",
      status: totalChapters > 0 && blueprintCount >= totalChapters ? "passed" : "blocked",
      detail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} 个蓝图`,
    },
    {
      label: "Style Freeze",
      status: styleGate.status === "passed" ? "passed" : "blocked",
      detail: styleGate.status === "passed" ? "已冻结全书写法合同" : "需要完成 Loop 并冻结 style contract",
    },
    {
      label: "记忆/RAG",
      status: memoryRecall.status === "ready" ? "passed" : "warning",
      detail: `${Number(memoryRecall.characterRows || 0) + Number(memoryRecall.chapterRows || 0)} 条可召回`,
    },
    {
      label: "上下文预算",
      status: contextBudget.status === "warning" ? "warning" : "passed",
      detail: `${Number(contextBudget.budgetPercent || 0)}%`,
    },
  ]

  const passed = items.filter((item) => item.status === "passed").length
  const warning = items.filter((item) => item.status === "warning").length
  const blocked = items.filter((item) => item.status === "blocked").length
  const score = Math.round(((passed + warning * 0.5) / Math.max(1, items.length)) * 100)
  return {
    items,
    score,
    status: blocked > 0 ? "blocked" : warning > 0 ? "warning" : "passed",
    summary: blocked > 0
      ? `${blocked} 项阻塞正文生产`
      : warning > 0
        ? `${warning} 项建议补强`
        : "正文生产准备完成",
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
    const readiness = buildWorkflowReadiness(model)
    const readinessMeta = workflowReadinessStatus(readiness.status)
    const latestChapterContextPath = pipeline.latestChapterContextPath || ""
    const latestDraftSegmentPath = pipeline.latestDraftSegmentPath || ""
    const latestDraftSegmentBriefPath = pipeline.latestDraftSegmentBriefPath || ""
    const latestDraftSegmentMaterialPath = pipeline.latestDraftSegmentMaterialPath || ""
    const latestDraftSegmentManifestPath = pipeline.latestDraftSegmentManifestPath || ""
    productionNode.classList.toggle("has-artifacts", Boolean(pipeline.hasProductionArtifacts))
    productionNode.innerHTML = `
      <div class="workflow-production-summary">
        <div>
          <strong>${Number(summary.progressPercent || 0)}%</strong>
          <span>${summary.isComplete ? "全书主流程已完成" : `阶段 ${escapeHtml(summary.stage || "unknown")}`}</span>
        </div>
        <small>${summary.source === "db" ? "DB 主事实源" : "state artifact/cache"}</small>
      </div>
      <div class="workflow-readiness ${readinessMeta.klass}">
        <div class="workflow-readiness-head">
          <span><i class="fa-solid ${readinessMeta.icon}"></i> 生产准备度</span>
          <button class="workflow-readiness-repair" type="button" data-repair-story-assets title="补齐故事基建资产">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </button>
          <button class="workflow-readiness-repair" type="button" data-approve-story-foundation title="确认故事基建">
            <i class="fa-solid fa-check"></i>
          </button>
          <strong>${readiness.score}%</strong>
          <small>${escapeHtml(readiness.summary)}</small>
        </div>
        <div class="workflow-readiness-grid">
          ${readiness.items.map((item) => {
            const meta = workflowReadinessStatus(item.status)
            return `
              <div class="workflow-readiness-item ${meta.klass}">
                <i class="fa-solid ${meta.icon}"></i>
                <span>${escapeHtml(item.label)}</span>
                <small>${escapeHtml(item.detail)}</small>
                ${item.recoveryHint && item.status !== "passed" ? `<em>${escapeHtml(item.recoveryHint)}</em>` : ""}
              </div>
            `
          }).join("")}
        </div>
        ${renderWorkflowReadinessIssues(readiness)}
        ${renderWorkflowReadinessGroups(readiness)}
      </div>
      <div class="workflow-production-grid">
        <span>蓝图 <strong>${Number(summary.blueprints || pipeline.blueprints || 0)}</strong></span>
      <span>完成 <strong>${Number(summary.completedChapters || 0)}/${Number(summary.totalChapters || 0)}</strong></span>
      <span>成稿文件 <strong>${Number(summary.artifactFinalChapters || pipeline.finalChapters || 0)}</strong></span>
      <span>质检 <strong>${Number(summary.qualityReports || pipeline.qualityReports || 0)}</strong></span>
      <span>记忆 <strong>${Number(summary.memoryUpdates || pipeline.memoryUpdates || 0)}</strong></span>
        <span>上下文包 <strong>${Number(pipeline.chapterContextPackages || 0)}</strong></span>
        <span>片段包 <strong>${Number(pipeline.draftSegmentArtifacts || 0)}</strong></span>
        <span>片段 brief <strong>${Number(pipeline.draftSegmentBriefArtifacts || 0)}</strong></span>
        <span>片段 material <strong>${Number(pipeline.draftSegmentMaterialArtifacts || 0)}</strong></span>
        <span>片段 manifest <strong>${Number(pipeline.draftSegmentManifestArtifacts || 0)}</strong></span>
        <span>待写 <strong>${Number(summary.pendingChapters || 0)}</strong></span>
        <span>阻塞 <strong>${Number(summary.blockedChapters || 0)}</strong></span>
      </div>
      ${latestDraftSegmentPath ? `
        <button class="workflow-context-package" type="button" data-artifact-path="${escapeHtml(latestDraftSegmentPath)}" title="查看最近章节片段">
          <i class="fa-solid fa-layer-group"></i>
          <span>最近片段包</span>
          <small>${escapeHtml(latestDraftSegmentPath)}</small>
        </button>
      ` : ""}
      ${latestDraftSegmentBriefPath ? `
        <button class="workflow-context-package" type="button" data-artifact-path="${escapeHtml(latestDraftSegmentBriefPath)}" title="查看最近片段 brief">
          <i class="fa-solid fa-list-check"></i>
          <span>最近片段 brief</span>
          <small>${escapeHtml(latestDraftSegmentBriefPath)}</small>
        </button>
      ` : ""}
      ${latestDraftSegmentMaterialPath ? `
        <button class="workflow-context-package" type="button" data-artifact-path="${escapeHtml(latestDraftSegmentMaterialPath)}" title="查看最近片段 material">
          <i class="fa-solid fa-puzzle-piece"></i>
          <span>最近片段 material</span>
          <small>${escapeHtml(latestDraftSegmentMaterialPath)}</small>
        </button>
      ` : ""}
      ${latestDraftSegmentManifestPath ? `
        <button class="workflow-context-package" type="button" data-artifact-path="${escapeHtml(latestDraftSegmentManifestPath)}" title="查看最近片段 manifest 与 assembly 决策">
          <i class="fa-solid fa-diagram-project"></i>
          <span>最近片段 manifest</span>
          <small>${escapeHtml(latestDraftSegmentManifestPath)}</small>
        </button>
      ` : ""}
      ${latestChapterContextPath ? `
        <button class="workflow-context-package" type="button" data-artifact-path="${escapeHtml(latestChapterContextPath)}" title="查看最近章节生成上下文">
          <i class="fa-solid fa-box-archive"></i>
          <span>最近上下文包</span>
          <small>${escapeHtml(latestChapterContextPath)}</small>
        </button>
      ` : ""}
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
  const style = model.storyMemory.style || {}
  const characterDossier = model.storyMemory.characterDossier || {}
  const memoryRecall = model.storyMemory.memoryRecall || {}
  const contextBudget = model.storyMemory.contextBudget || {}
  const budgetSections = Array.isArray(contextBudget.sections) ? contextBudget.sections : []
  const statusClass = (status = "") => ["ready", "watch", "warning", "indexing", "needs_setup"].includes(status) ? status : "unknown"
  const chipList = (items = [], empty = "无缺口") => items.length
    ? items.slice(0, 5).map((item) => `<span class="knowledge-chip is-muted">${escapeHtml(item)}</span>`).join("")
    : `<span class="knowledge-chip">${escapeHtml(empty)}</span>`

  const diagnostics = model.storyMemory.diagnostics || {}
  let diagnosticsHtml = ""
  if (diagnostics) {
    const blockedChapters = Array.isArray(diagnostics.blockedChapters) ? diagnostics.blockedChapters : []
    const dossierGaps = Array.isArray(diagnostics.characterDossierGaps) ? diagnostics.characterDossierGaps : []
    const overages = diagnostics.contextBudgetOverages || {}
    const rag = diagnostics.ragRecall || {}
    const lease = diagnostics.workerLeaseIssues || {}

    const blockedRows = blockedChapters.length
      ? blockedChapters.map(chap => `
          <div class="diagnostic-row is-error">
            <span>#${chap.chapterNumber} ${escapeHtml(chap.title)} (重试 ${chap.recoveryAttempts} 次${chap.recoveryBlocked ? " · 已锁" : ""})</span>
            <p>${escapeHtml(chap.blockReason)}</p>
          </div>
        `).join("")
      : `<div class="diagnostic-row is-success"><span><i class="fa-solid fa-circle-check"></i> 无阻塞章节</span></div>`

    const gapChips = dossierGaps.length
      ? dossierGaps.map(gap => `<span class="knowledge-chip is-muted">${escapeHtml(gap)}</span>`).join("")
      : `<span class="knowledge-chip is-success"><i class="fa-solid fa-check"></i> 档案字段完整</span>`

    const overagesHtml = overages.isOverages
      ? `<div class="diagnostic-row is-warning"><span>⚠️ 上下文预算超限！当前 ${overages.estimatedChars} / 限制 ${overages.budgetLimit} 字符（超 ${overages.overageChars}）</span></div>`
      : `<div class="diagnostic-row is-success"><span><i class="fa-solid fa-circle-check"></i> 上下文容量正常：${overages.estimatedChars} / ${overages.budgetLimit}</span></div>`

    const leaseHtml = lease.hasIssues
      ? lease.staleJobs.map(job => `
          <div class="diagnostic-row is-warning">
            <span>⚠️ 租约超时任务：job ${job.id.slice(0, 8)} (${job.kind})</span>
            <small>占用者 ${job.leaseOwner} · 过期 ${formatClock(job.leaseExpiresAt)}</small>
          </div>
        `).join("")
      : `<div class="diagnostic-row is-success"><span><i class="fa-solid fa-circle-check"></i> Worker 租约心跳均正常</span></div>`

    diagnosticsHtml = `
      <div class="diagnostics-panel">
        <div class="diagnostic-section">
          <strong><i class="fa-solid fa-ban"></i> 阻塞原因及质检门禁</strong>
          <div class="diagnostic-list">${blockedRows}</div>
        </div>
        <div class="diagnostic-section">
          <strong><i class="fa-solid fa-gauge-high"></i> 上下文越界状态</strong>
          <div class="diagnostic-list">${overagesHtml}</div>
        </div>
        <div class="diagnostic-section">
          <strong><i class="fa-solid fa-circle-exclamation"></i> 角色档案空白字段 (Gaps)</strong>
          <div class="knowledge-chip-row">${gapChips}</div>
        </div>
        <div class="diagnostic-section">
          <strong><i class="fa-solid fa-database"></i> 知识库 RAG 与向量积压</strong>
          <div class="diagnostic-list">
            <div class="diagnostic-row">
              <span>项目资源: ${rag.projectSources} · 全局资源: ${rag.globalSources}</span>
            </div>
            <div class="diagnostic-row">
              <span>最近一轮 RAG 召回数量: ${rag.recentRecallCount}</span>
            </div>
            <div class="diagnostic-row">
              <span>记忆向量积压排队数: ${Number(diagnostics.memoryEmbeddingBacklog || 0)}</span>
            </div>
          </div>
        </div>
        <div class="diagnostic-section">
          <strong><i class="fa-solid fa-microchip"></i> Worker 状态与租约异常</strong>
          <div class="diagnostic-list">${leaseHtml}</div>
        </div>
      </div>
    `
  }
  const productionHealth = `
    <div class="observability-grid">
      <div class="observability-card is-${escapeHtml(statusClass(style.status))}">
        <span><i class="fa-solid fa-pen-nib"></i> 风格合同</span>
        <strong>${escapeHtml(style.label || "未知")}</strong>
        <small>${escapeHtml([style.genre, style.naturalnessTarget].filter(Boolean).join(" · ") || "等待风格档案")}</small>
      </div>
      <div class="observability-card is-${escapeHtml(statusClass(characterDossier.status))}">
        <span><i class="fa-solid fa-id-card"></i> 角色档案</span>
        <strong>${Number(characterDossier.count || 0)}</strong>
        <small>${escapeHtml(characterDossier.label || "未知")} · memory ${Number(characterDossier.memoryRows || 0)}</small>
      </div>
      <div class="observability-card is-${escapeHtml(statusClass(memoryRecall.status))}">
        <span><i class="fa-solid fa-brain"></i> 记忆召回</span>
        <strong>${Number(memoryRecall.characterRows || 0) + Number(memoryRecall.chapterRows || 0)}</strong>
        <small>${escapeHtml(memoryRecall.label || "未知")} · lag ${Number(memoryRecall.memoryLag || 0)}</small>
      </div>
      <div class="observability-card is-${escapeHtml(statusClass(contextBudget.status))}">
        <span><i class="fa-solid fa-gauge-high"></i> 上下文预算</span>
        <strong>${Number(contextBudget.budgetPercent || 0)}%</strong>
        <small>${Number(contextBudget.estimatedChars || 0)} / ${Number(contextBudget.budgetLimit || 0)} chars</small>
      </div>
    </div>
    <div class="observability-detail">
      <span>${escapeHtml(style.styleFingerprint || "等待风格指纹")}</span>
      <div class="knowledge-chip-row">${chipList([...(style.missing || []), ...(characterDossier.missing || [])], "档案完整")}</div>
      <div class="context-budget-bars">
        ${budgetSections.slice(0, 4).map((section) => {
          const percent = Math.min(100, Math.round((Number(section.chars || 0) / Math.max(1, Number(contextBudget.budgetLimit || 24000))) * 100))
          return `
            <div class="context-budget-row">
              <span>${escapeHtml(section.label || section.key || "section")}</span>
              <div><i style="width:${percent}%"></i></div>
              <small>${Number(section.chars || 0)}</small>
            </div>
          `
        }).join("")}
      </div>
    </div>
  `
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
      <span class="memory-title"><i class="fa-solid fa-heart-pulse"></i> 生产记忆健康</span>
      ${productionHealth}
    </div>
    <div class="memory-section">
      <span class="memory-title"><i class="fa-solid fa-chart-pie"></i> 生产质量与诊断观察</span>
      ${diagnosticsHtml}
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
    ? `${windowStart || visibleItems[0]?.chapterNumber || "?"}-${windowEnd || visibleItems.at(-1)?.chapterNumber || "?"} 章 · 共 ${total} 章`
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

function styleGateLabel(styleEvolution = dashboardState.styleEvolution) {
  const gate = styleEvolution?.gate || {}
  if (gate.status === "passed") {
    return { label: "已确认", klass: "is-passed", icon: "fa-circle-check" }
  }
  if (gate.status === "warning") {
    return { label: "可用但需补强", klass: "is-warning", icon: "fa-triangle-exclamation" }
  }
  return { label: "阻塞正文", klass: "is-blocked", icon: "fa-lock" }
}

function latestStyleCandidate(styleEvolution = dashboardState.styleEvolution) {
  const history = Array.isArray(styleEvolution?.contract?.evolutionHistory)
    ? styleEvolution.contract.evolutionHistory
    : []
  return history.length ? history[history.length - 1] : null
}

function styleHistory(styleEvolution = dashboardState.styleEvolution) {
  return Array.isArray(styleEvolution?.contract?.evolutionHistory)
    ? styleEvolution.contract.evolutionHistory
    : []
}

function findStyleCandidateByVersion(version, styleEvolution = dashboardState.styleEvolution) {
  const targetVersion = Number(version || 0)
  if (!targetVersion) return null
  return styleHistory(styleEvolution).find((entry) => Number(entry?.version || 0) === targetVersion) || null
}

function selectedStyleCandidate(styleEvolution = dashboardState.styleEvolution) {
  const selectedVersion = Number(dashboardState.styleEvolutionUi?.selectedVersion || 0)
  return findStyleCandidateByVersion(selectedVersion, styleEvolution) || latestStyleCandidate(styleEvolution)
}

function styleRejectedVersion(styleEvolution = dashboardState.styleEvolution) {
  const approval = styleEvolution?.contract?.approval || {}
  return approval.status === "rejected" ? Number(approval.rejectedVersion || 0) : 0
}

function styleCandidateVerificationSnapshot(candidate = null) {
  const verification = candidate?.verification || null
  if (verification?.status) {
    return verification
  }
  const evaluation = candidate?.evaluation || {}
  const aigc = evaluation?.aigc || {}
  const forbiddenHits = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits : []
  const highRiskCount = Number(aigc?.highRiskCount || 0)
  const blocked = aigc?.status === "blocked" || highRiskCount > 0 || forbiddenHits.length > 0
  if (blocked) {
    return {
      status: "blocked",
      highRiskCount,
      forbiddenHitCount: forbiddenHits.length,
      summary: aigc?.reason || evaluation?.summary || "Generation Verification Gate 阻塞。",
    }
  }
  if (aigc?.enabled && aigc?.status === "passed") {
    return {
      status: "passed",
      score: aigc.score,
      threshold: aigc.threshold,
      highRiskCount: 0,
      forbiddenHitCount: 0,
      summary: aigc?.reason || evaluation?.summary || "Generation Verification Gate 已通过。",
    }
  }
  if (evaluation?.summary || evaluation?.verdict) {
    return {
      status: "warning",
      highRiskCount,
      forbiddenHitCount: forbiddenHits.length,
      summary: "当前候选已有评估，但缺少可冻结的生成验证证据。",
    }
  }
  return { status: "pending", highRiskCount: 0, forbiddenHitCount: 0 }
}

function styleSelectedVerificationSnapshot(selected = null, contract = {}) {
  if (selected?.version) {
    return styleCandidateVerificationSnapshot(selected)
  }
  return contract?.verification || { status: "pending", highRiskCount: 0, forbiddenHitCount: 0 }
}

function styleCandidateActionState(candidate = null, styleEvolution = dashboardState.styleEvolution) {
  const version = Number(candidate?.version || 0)
  const verification = styleCandidateVerificationSnapshot(candidate)
  const evaluation = candidate?.evaluation || {}
  const forbiddenHits = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits : []
  const rejectedVersion = styleRejectedVersion(styleEvolution)
  const loop = styleEvolution?.contract?.loop || {}
  const readyVersion = Number(loop.readyVersion || 0)
  const stableVersion = Number(loop.stableVersion || 0)
  const freezerVerdict = String(candidate?.freezer?.verdict || styleEvolution?.contract?.freezer?.verdict || "")
  const loopReady = Boolean(
    candidate?.readyForApproval
    || (version && readyVersion === version)
    || (version && stableVersion === version)
    || freezerVerdict === "ready",
  )
  const terminalReasons = []
  const reasons = []
  if (!version) reasons.push("请先选择一个候选版本。")
  if (candidate?.userDecision === "accepted_for_freeze") terminalReasons.push("这个版本已被接受，正在等待冻结合同确认。")
  if (candidate?.userDecision === "accepted") terminalReasons.push("这个版本已经冻结为整书写法。")
  if (candidate?.userDecision === "superseded") terminalReasons.push("这个版本已被后续轮次覆盖。")
  if (rejectedVersion && rejectedVersion === version) terminalReasons.push("这个版本已经被你退回。")
  reasons.push(...terminalReasons.filter((reason) => !/等待冻结合同确认/u.test(reason)))
  if (version && candidate?.userDecision !== "accepted_for_freeze" && candidate?.userDecision !== "accepted") {
    reasons.push("必须先点击“接受本轮”，再冻结为整书写法合同。")
  }
  if (verification.status === "blocked") reasons.push("Generation Verification / AIGC 仍然阻塞。")
  if (verification.status !== "passed") reasons.push("必须先通过 Generation Verification Gate。")
  if (Number(verification.highRiskCount || 0) > 0) reasons.push(`仍有 ${Number(verification.highRiskCount || 0)} 个 AIGC 高风险片段。`)
  if (forbiddenHits.length > 0) reasons.push(`仍命中 ${forbiddenHits.length} 条写法禁忌。`)
  if (freezerVerdict === "block") reasons.push("Style Contract Freezer 已阻塞当前候选。")
  if (freezerVerdict === "continue") reasons.push("Style Contract Freezer 要求继续迭代收紧，尚未放行冻结。")
  if (version && !loopReady) reasons.push("Loop Controller 尚未把当前候选标记为 ready/stable，不能冻结成整书写法。")
  const acceptBlockers = reasons.filter((reason) => !/必须先点击“接受本轮”/u.test(reason))
  return {
    canFreeze: version > 0 && reasons.length === 0 && candidate?.userDecision === "accepted_for_freeze",
    canAccept: version > 0
      && acceptBlockers.length === 0
      && candidate?.userDecision !== "accepted_for_freeze"
      && candidate?.userDecision !== "accepted",
    canReject: version > 0
      && candidate?.userDecision !== "accepted"
      && candidate?.userDecision !== "superseded"
      && !(rejectedVersion && rejectedVersion === version),
    canSave: !version || terminalReasons.length === 0,
    reason: reasons[0] || "当前候选已通过冻结前置门禁。",
    acceptReason: acceptBlockers[0] || "当前候选已通过生成验证，可以先接受本轮。",
    saveReason: terminalReasons[0] || "",
    reasons,
  }
}

function styleActionDisabledAttr(actionState = {}, loading = false, action = "freeze") {
  const disabled = action === "reject"
    ? loading || !actionState.canReject
    : action === "save"
      ? loading || !actionState.canSave
    : action === "accept"
      ? loading || !actionState.canAccept
    : loading || !actionState.canFreeze
  return disabled ? "disabled" : ""
}

function styleActionTitle(actionState = {}, action = "freeze") {
  if (action === "save") {
    return actionState.canSave ? "保存为当前 Style Evolution 候选样段" : (actionState.saveReason || "当前候选不能保存")
  }
  if (action === "reject") {
    return actionState.canReject ? "退回当前候选并让下一轮吸收原因" : (actionState.reason || "当前候选不能退回")
  }
  if (action === "accept") {
    return actionState.canAccept ? "接受本轮候选，进入冻结合同预览与确认" : (actionState.acceptReason || actionState.reason || "当前候选不能接受")
  }
  return actionState.canFreeze ? "当前候选可以进入整书写法冻结链" : (actionState.reason || "当前候选不能冻结")
}

function renderStyleActionGateReasons(actionState = {}) {
  const reasons = Array.isArray(actionState.reasons) ? actionState.reasons.filter(Boolean) : []
  if (!reasons.length) {
    return `
      <div class="style-freeze-action-reasons is-passed">
        <strong>Freeze Gate 可执行</strong>
        <span>当前候选已通过生成验证门，可以进入冻结预演或正式确认。</span>
      </div>
    `
  }
  return `
    <div class="style-freeze-action-reasons is-blocked">
      <strong>当前不能冻结</strong>
      ${reasons.slice(0, 4).map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}
    </div>
  `
}

function styleContractSummaryRows(styleContract = {}) {
  const rows = []
  const pushRow = (label, value) => {
    const text = Array.isArray(value) ? value.filter(Boolean).slice(0, 3).join("；") : String(value || "").trim()
    if (text) rows.push({ label, text })
  }
  pushRow("叙述声音", styleContract.voice)
  pushRow("句式节奏", styleContract.sentenceRhythm)
  pushRow("对白规则", styleContract.dialogueRules)
  pushRow("描写规则", styleContract.descriptionRules)
  pushRow("禁用模式", styleContract.forbiddenPatterns)
  pushRow("正例", styleContract.positiveExamples)
  return rows
}

function styleLoopStatusLabel(loop = {}) {
  const status = String(loop.status || "idle")
  if (status === "approved") return { label: "已冻结", klass: "is-passed" }
  if (status === "ready_for_approval") return { label: "可确认", klass: "is-warning" }
  if (status === "stable_candidate") return { label: "已稳定", klass: "is-passed" }
  if (status === "awaiting_user") return { label: "待迭代", klass: "is-warning" }
  if (status === "running") return { label: "运行中", klass: "is-warning" }
  return { label: "未启动", klass: "is-blocked" }
}

function styleLoopConvergenceLabel(value) {
  const normalized = String(value || "unknown")
  if (normalized === "ready") return "已收敛"
  if (normalized === "stable") return "趋于稳定"
  if (normalized === "improving") return "持续收紧"
  if (normalized === "exploring") return "探索中"
  return "待判断"
}

function styleFreezeLedger(styleEvolution = dashboardState.styleEvolution) {
  return styleEvolution?.freezeLedger || { entries: [], convergenceEvidence: [] }
}

function styleLoopRuntime(styleEvolution = dashboardState.styleEvolution) {
  return styleEvolution?.loopRuntime || null
}

function styleEvolutionAssets() {
  return dashboardState.styleEvolutionAssets || {
    freezePackage: {},
    chapterInheritance: {},
  }
}

function renderStyleAssetEvidence(asset, emptyLabel) {
  if (!asset?.exists) {
    return `<div class="style-loop-empty">${escapeHtml(emptyLabel)}</div>`
  }
  return `
    <div class="style-loop-asset-evidence">
      <div class="style-loop-ledger-meta">
        <span>${escapeHtml(asset.path || "unknown")}</span>
        <span>${Number(asset.chars || 0)} chars</span>
      </div>
      <pre>${escapeHtml(asset.preview || "")}</pre>
    </div>
  `
}

function latestLoopCandidateBatch() {
  if (Array.isArray(dashboardState.styleEvolutionUi?.lastCandidateBatch) && dashboardState.styleEvolutionUi.lastCandidateBatch.length) {
    return dashboardState.styleEvolutionUi.lastCandidateBatch
  }
  const runtimeIterations = dashboardState.styleEvolution?.loopRuntime?.iterations
  if (!Array.isArray(runtimeIterations) || !runtimeIterations.length) {
    return []
  }
  const latestWithCandidates = [...runtimeIterations].reverse().find((entry) => Array.isArray(entry?.candidates) && entry.candidates.length)
  return latestWithCandidates?.candidates || []
}

function styleCandidatePersistedVersion(candidate = {}) {
  const persistedVersion = Number(candidate?.persistedVersion || 0)
  if (persistedVersion > 0) return persistedVersion
  const version = Number(candidate?.version || 0)
  return version > 0 ? version : 0
}

function styleVerdictMeta(verdict) {
  const normalized = String(verdict || "")
  if (normalized === "approve") return { label: "可冻结", klass: "is-passed" }
  if (normalized === "candidate") return { label: "可继续收紧", klass: "is-warning" }
  if (normalized === "retry") return { label: "继续迭代", klass: "is-blocked" }
  return { label: "待评估", klass: "is-idle" }
}

function styleUserDecisionMeta(value) {
  const normalized = String(value || "pending")
  if (normalized === "accepted_for_freeze") return { label: "已接受，待冻结", klass: "is-passed" }
  if (normalized === "accepted") return { label: "用户已接受", klass: "is-passed" }
  if (normalized === "superseded") return { label: "已被后续覆盖", klass: "is-idle" }
  return { label: "待用户决定", klass: "is-warning" }
}

function styleScoreRows(evaluation = {}) {
  const scores = evaluation?.scores || {}
  const labels = [
    ["narrativeVoice", "叙述声音"],
    ["sentenceRhythm", "句式节奏"],
    ["dialogueTexture", "对白质感"],
    ["informationDensity", "信息密度"],
    ["emotionalTension", "情绪张力"],
    ["readability", "网文可读性"],
    ["requirementAlignment", "需求贴合"],
    ["forbiddenPatternRisk", "禁忌风险"],
    ["overall", "综合评分"],
  ]
  return labels
    .map(([key, label]) => ({ key, label, value: Number(scores?.[key] || 0) }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
}

function styleAigcMeta(aigc = {}) {
  const status = String(aigc?.status || "unavailable")
  if (status === "passed") return { label: "AIGC 风险受控", klass: "is-passed" }
  if (status === "blocked") return { label: "AIGC 风险偏高", klass: "is-blocked" }
  return { label: "AIGC 未启用/不可用", klass: "is-warning" }
}

function styleGenerationVerificationMeta(evaluation = {}) {
  const hasAigc = Boolean(evaluation?.aigc?.enabled)
  const blocked = evaluation?.aigc?.status === "blocked"
    || (Array.isArray(evaluation?.forbiddenHits) && evaluation.forbiddenHits.length > 0)
  const ready = hasAigc && !blocked
  if (ready) return { label: "Generation Verification Gate 已通过", klass: "is-passed" }
  if (blocked) return { label: "Generation Verification Gate 阻塞", klass: "is-blocked" }
  return { label: "Generation Verification Gate 待判断", klass: "is-warning" }
}

function styleGenerationVerificationStatusMeta(verification = {}, evaluation = {}) {
  const status = String(verification?.status || "")
  if (status === "passed") return { label: "Generation Verification Gate 已通过", klass: "is-passed" }
  if (status === "blocked") return { label: "Generation Verification Gate 阻塞", klass: "is-blocked" }
  if (status === "warning") return { label: "Generation Verification Gate 证据不足", klass: "is-warning" }
  return styleGenerationVerificationMeta(evaluation)
}

function renderStyleLoopList(items = [], emptyText = "当前轮没有更多说明。") {
  const rows = (Array.isArray(items) ? items : []).filter(Boolean)
  if (!rows.length) return `<div class="style-loop-empty">${escapeHtml(emptyText)}</div>`
  return `
    <div class="style-loop-list">
      ${rows.map((item) => `<div class="style-loop-list-item">${escapeHtml(item)}</div>`).join("")}
    </div>
  `
}

function styleCandidateDiagnosticsRows(candidate = {}, { selectedSample = "", winningReason = "" } = {}) {
  const verification = candidate?.verification || {}
  const evaluation = candidate?.evaluation || {}
  const refinement = candidate?.refinement || {}
  const freezer = candidate?.freezer || {}
  const persistedVersion = styleCandidatePersistedVersion(candidate)
  const isWinner = Boolean(
    candidate?.sample
    && selectedSample
    && String(candidate.sample).trim() === String(selectedSample).trim(),
  )
  const verificationReasons = Array.isArray(verification?.reasons) ? verification.reasons : []
  const forbiddenHits = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits : []
  const highRiskPreviews = Array.isArray(evaluation?.aigc?.highRiskPreviews) ? evaluation.aigc.highRiskPreviews : []
  const freezerReasons = Array.isArray(freezer?.blockingReasons) ? freezer.blockingReasons : []
  const rows = [
    isWinner ? `竞争结果：胜出候选${persistedVersion ? `，已落盘为 v${persistedVersion}` : ""}${winningReason ? `；${winningReason}` : ""}` : "",
    !isWinner && persistedVersion ? `竞争结果：未胜出，但已保留为 v${persistedVersion} 供回看。` : "",
    !isWinner && !persistedVersion ? "竞争结果：被淘汰，未写入正式候选历史，只保留在本轮 Runtime 诊断里。" : "",
    verification?.status ? `Generation Verification Gate：${verification.status}` : "",
    verification?.summary ? `验证摘要：${verification.summary}` : "",
    typeof verification?.score === "number" ? `AIGC 概率：${Number(verification.score).toFixed(3)}` : "",
    typeof verification?.threshold === "number" ? `风险阈值：${Number(verification.threshold).toFixed(3)}` : "",
    typeof verification?.highRiskCount === "number" ? `高风险片段：${Number(verification.highRiskCount)} 个` : "",
    forbiddenHits.length ? `禁忌命中：${forbiddenHits.join("；")}` : "",
    ...verificationReasons.map((item) => `验证原因：${item}`),
    freezer?.verdict ? `Freezer 判定：${freezer.verdict}${freezer?.summary ? `，${freezer.summary}` : ""}` : "",
    ...freezerReasons.map((item) => `Freezer 阻塞：${item}`),
    refinement?.summary ? `Prompt Refiner：${refinement.summary}` : "",
    ...highRiskPreviews.slice(0, 2).map((item) => `高风险摘录：${item}`),
    candidate?.sample && !isWinner ? `样段摘录：${String(candidate.sample).slice(0, 180)}` : "",
  ].filter(Boolean)

  if (!rows.length) {
    rows.push("当前候选没有足够诊断信息；请重新运行 Loop，让系统补齐评估、验证与淘汰依据。")
  }
  return rows
}

function styleRetryPolicyRows(retryPolicy = {}) {
  const rows = []
  const pushRow = (label, value, formatter = (entry) => String(entry || "").trim()) => {
    const formatted = formatter(value)
    if (formatted) rows.push(`${label}：${formatted}`)
  }
  pushRow("最大自动迭代", retryPolicy.maxLoopIterations, (value) => Number(value) > 0 ? `${Number(value)} 轮` : "")
  pushRow("确认分数门槛", retryPolicy.approvalScoreThreshold, (value) => Number(value) > 0 ? `${Number(value).toFixed(1)} 分` : "")
  pushRow("最少确认轮次", retryPolicy.approvalMinRounds, (value) => Number(value) > 0 ? `${Number(value)} 轮` : "")
  pushRow("稳定最少轮次", retryPolicy.stabilityMinRounds, (value) => Number(value) > 0 ? `${Number(value)} 轮` : "")
  pushRow("稳定分差上限", retryPolicy.stabilityScoreDeltaMax, (value) => Number(value) >= 0 ? `${Number(value).toFixed(1)} 分` : "")
  pushRow("禁忌命中上限", retryPolicy.maxForbiddenHitCount, (value) => Number(value) >= 0 ? `${Number(value)} 次` : "")
  pushRow("命中禁忌是否重试", retryPolicy.retryOnForbiddenHit, (value) => value === true ? "是" : value === false ? "否" : "")
  return rows
}

function styleFreezeDigestSections(payload = {}) {
  const styleContract = payload.styleContract || {}
  const retryPolicy = payload.retryPolicy || {}
  const verification = payload.verification || {}
  const verificationItems = summarizeGenerationVerificationLines({
    verification,
    evaluation: payload.evaluation || {},
    fallbackStatus: payload.verificationStatus,
    fallbackSummary: payload.verificationSummary,
    fallbackReasons: payload.verificationReasons,
  })
  return [
    {
      title: "冻结摘要",
      items: [payload.freezeSummary].filter(Boolean),
      empty: "当前还没有冻结摘要。",
    },
    {
      title: "冻结基础 Prompt",
      items: [payload.frozenBasePrompt].filter(Boolean),
      empty: "当前还没有冻结基础 prompt。",
    },
    {
      title: "写法合同",
      items: styleContractSummaryRows(styleContract).map((row) => `${row.label}：${row.text}`),
      empty: "当前还没有可冻结的 style contract。",
    },
    {
      title: "正向例子",
      items: Array.isArray(payload.positiveExamples) ? payload.positiveExamples : (Array.isArray(styleContract.positiveExamples) ? styleContract.positiveExamples : []),
      empty: "当前还没有可冻结的正向例子。",
    },
    {
      title: "禁忌清单",
      items: Array.isArray(payload.antiPatterns) ? payload.antiPatterns : (Array.isArray(styleContract.forbiddenPatterns) ? styleContract.forbiddenPatterns : []),
      empty: "当前还没有可冻结的禁忌清单。",
    },
    {
      title: "章节继承规则",
      items: Array.isArray(payload.inheritedRules) ? payload.inheritedRules : [],
      empty: "当前还没有章节继承规则。",
    },
    {
      title: "继承资产",
      items: Array.isArray(payload.inheritedArtifacts) ? payload.inheritedArtifacts : [],
      empty: "当前还没有继承资产清单。",
    },
    {
      title: "合同收紧动作",
      items: Array.isArray(payload.contractAdjustments) ? payload.contractAdjustments : [],
      empty: "当前还没有额外的合同收紧动作。",
    },
    {
      title: "生成验证门",
      items: verificationItems,
      empty: "当前还没有可冻结的生成验证证据。",
    },
    {
      title: "Retry Policy",
      items: styleRetryPolicyRows(retryPolicy),
      empty: "当前还没有明确的 retry policy。",
    },
  ]
}

function renderStyleFreezeDigestCard(title, subtitle, payload = {}, options = {}) {
  const sections = styleFreezeDigestSections(payload)
  const sample = String(payload.sample || "").trim()
  const note = String(options.note || "").trim()
  const approvalScope = String(payload.approvalScope || "").trim()
  return `
    <div class="style-loop-card style-freeze-digest-card ${options.emphasisClass || ""}">
      <div class="style-loop-section-head compact">
        <div>
          <span>${escapeHtml(title)}</span>
          <small>${escapeHtml(subtitle)}</small>
        </div>
      </div>
      ${approvalScope ? `
        <div class="style-loop-pill-row">
          <span class="style-loop-pill is-warning">${escapeHtml(approvalScope === "whole_book" ? "作用范围：全书写法" : approvalScope)}</span>
        </div>
      ` : ""}
      ${sample ? `
        <div class="style-loop-subsection">
          <b>样段基线</b>
          <div class="style-loop-quote">${escapeHtml(sample)}</div>
        </div>
      ` : ""}
      ${note ? `
        <div class="style-loop-note">${escapeHtml(note)}</div>
      ` : ""}
      ${sections.map((section) => `
        <div class="style-loop-subsection">
          <b>${escapeHtml(section.title)}</b>
          ${renderStyleLoopList(section.items, section.empty)}
        </div>
      `).join("")}
    </div>
  `
}

function summarizeStyleDiffLines(left = {}, right = {}) {
  const diffs = []
  const leftEval = left?.evaluation || {}
  const rightEval = right?.evaluation || {}
  const leftRefine = left?.refinement || {}
  const rightRefine = right?.refinement || {}
  const leftVerification = left?.verification || {}
  const rightVerification = right?.verification || {}

  if (Number(left?.version || 0) && Number(right?.version || 0) && Number(left.version) !== Number(right.version)) {
    diffs.push(`版本变化：v${Number(left.version)} -> v${Number(right.version)}`)
  }
  if (leftEval?.summary && rightEval?.summary && leftEval.summary !== rightEval.summary) {
    diffs.push(`评估摘要变化：${leftEval.summary} -> ${rightEval.summary}`)
  }
  const leftOverall = Number(leftEval?.scores?.overall || 0)
  const rightOverall = Number(rightEval?.scores?.overall || 0)
  if (leftOverall > 0 && rightOverall > 0 && leftOverall !== rightOverall) {
    diffs.push(`综合评分：${leftOverall.toFixed(1)} -> ${rightOverall.toFixed(1)}`)
  }
  const leftForbidden = Array.isArray(leftEval?.forbiddenHits) ? leftEval.forbiddenHits : []
  const rightForbidden = Array.isArray(rightEval?.forbiddenHits) ? rightEval.forbiddenHits : []
  if (leftForbidden.join("|") !== rightForbidden.join("|")) {
    diffs.push(`禁忌命中变化：${leftForbidden.length || 0} -> ${rightForbidden.length || 0}`)
  }
  if (leftVerification?.status && rightVerification?.status && leftVerification.status !== rightVerification.status) {
    diffs.push(`生成验证门：${leftVerification.status} -> ${rightVerification.status}`)
  }
  const leftRisk = Number(leftVerification?.highRiskCount || 0)
  const rightRisk = Number(rightVerification?.highRiskCount || 0)
  if (leftRisk !== rightRisk) {
    diffs.push(`高风险片段：${leftRisk} -> ${rightRisk}`)
  }
  const leftAdjustments = Array.isArray(leftRefine?.contractAdjustments) ? leftRefine.contractAdjustments : []
  const rightAdjustments = Array.isArray(rightRefine?.contractAdjustments) ? rightRefine.contractAdjustments : []
  if (leftAdjustments.join("|") !== rightAdjustments.join("|")) {
    diffs.push(`合同收紧项：${leftAdjustments.length || 0} -> ${rightAdjustments.length || 0}`)
  }
  return diffs
}

function styleNumericMetric(value) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function styleSignedDelta(value, digits = 1) {
  const parsed = styleNumericMetric(value)
  if (parsed === null) return ""
  if (Math.abs(parsed) < 0.0001) return "持平"
  return `${parsed > 0 ? "+" : ""}${parsed.toFixed(digits)}`
}

function styleCandidateOverallScore(candidate = null, fallbackEvaluation = {}) {
  return styleNumericMetric(candidate?.evaluation?.scores?.overall ?? fallbackEvaluation?.scores?.overall)
}

function styleCandidateAigcScore(candidate = null, fallbackVerification = {}, fallbackEvaluation = {}) {
  return styleNumericMetric(
    candidate?.verification?.score
    ?? candidate?.evaluation?.aigc?.score
    ?? fallbackVerification?.score
    ?? fallbackEvaluation?.aigc?.score,
  )
}

function styleCandidateHighRiskCount(candidate = null, fallbackVerification = {}, fallbackEvaluation = {}) {
  return styleNumericMetric(
    candidate?.verification?.highRiskCount
    ?? candidate?.evaluation?.aigc?.highRiskCount
    ?? fallbackVerification?.highRiskCount
    ?? fallbackEvaluation?.aigc?.highRiskCount
    ?? 0,
  ) ?? 0
}

function styleCandidateForbiddenHitCount(candidate = null, fallbackEvaluation = {}) {
  const hits = Array.isArray(candidate?.evaluation?.forbiddenHits)
    ? candidate.evaluation.forbiddenHits
    : (Array.isArray(fallbackEvaluation?.forbiddenHits) ? fallbackEvaluation.forbiddenHits : [])
  return hits.length
}

function styleCandidateArrayMetric(candidate = null, key = "", fallbackRefinement = {}) {
  const candidateRows = Array.isArray(candidate?.refinement?.[key]) ? candidate.refinement[key] : null
  const fallbackRows = Array.isArray(fallbackRefinement?.[key]) ? fallbackRefinement[key] : []
  return (candidateRows || fallbackRows).filter(Boolean)
}

function styleNewArrayItems(currentRows = [], previousRows = []) {
  const previousSet = new Set((Array.isArray(previousRows) ? previousRows : []).map((item) => String(item || "").trim()).filter(Boolean))
  return (Array.isArray(currentRows) ? currentRows : [])
    .map((item) => String(item || "").trim())
    .filter((item) => item && !previousSet.has(item))
}

function previousStyleCandidateForVersion(history = [], selectedVersion = 0) {
  const targetVersion = Number(selectedVersion || 0)
  if (!targetVersion) return null
  const entries = (Array.isArray(history) ? history : [])
    .filter((entry) => Number(entry?.version || 0) > 0)
    .sort((left, right) => Number(left.version || 0) - Number(right.version || 0))
  const selectedIndex = entries.findIndex((entry) => Number(entry?.version || 0) === targetVersion)
  if (selectedIndex > 0) return entries[selectedIndex - 1]
  return entries.slice().reverse().find((entry) => Number(entry?.version || 0) < targetVersion) || null
}

function buildStyleIterationDeltaRows({
  selected = null,
  previous = null,
  evaluation = {},
  refinement = {},
  verification = {},
  loop = {},
} = {}) {
  const selectedVersion = Number(selected?.version || 0)
  const previousVersion = Number(previous?.version || 0)
  if (!selectedVersion) {
    return ["先运行 Candidate Generator，产生候选版本后才会展示 Loop Delta。"]
  }
  if (!previousVersion) {
    return [`当前是 v${selectedVersion}，这是第一轮候选；从第二轮开始会显示“上一轮 -> 本轮”的评分、AIGC、禁忌和收紧变化。`]
  }

  const rows = [`版本轨迹：v${previousVersion} -> v${selectedVersion}`]
  const previousOverall = styleCandidateOverallScore(previous)
  const currentOverall = styleCandidateOverallScore(selected, evaluation)
  if (previousOverall !== null && currentOverall !== null) {
    const delta = currentOverall - previousOverall
    rows.push(`综合评分：上一轮 ${previousOverall.toFixed(1)} -> 本轮 ${currentOverall.toFixed(1)}（${styleSignedDelta(delta, 1)}）`)
  }

  const previousAigcScore = styleCandidateAigcScore(previous)
  const currentAigcScore = styleCandidateAigcScore(selected, verification, evaluation)
  if (previousAigcScore !== null && currentAigcScore !== null) {
    const delta = currentAigcScore - previousAigcScore
    const trend = delta < 0 ? `下降 ${Math.abs(delta).toFixed(3)}` : delta > 0 ? `上升 ${delta.toFixed(3)}` : "持平"
    rows.push(`AIGC 风险分：上一轮 ${previousAigcScore.toFixed(3)} -> 本轮 ${currentAigcScore.toFixed(3)}（${trend}）`)
  }

  const previousHighRisk = styleCandidateHighRiskCount(previous)
  const currentHighRisk = styleCandidateHighRiskCount(selected, verification, evaluation)
  if (previousHighRisk !== currentHighRisk) {
    rows.push(`AIGC 高风险片段：上一轮 ${previousHighRisk} -> 本轮 ${currentHighRisk}`)
  }

  const previousForbidden = styleCandidateForbiddenHitCount(previous)
  const currentForbidden = styleCandidateForbiddenHitCount(selected, evaluation)
  if (previousForbidden !== currentForbidden) {
    rows.push(`禁忌命中：上一轮 ${previousForbidden} -> 本轮 ${currentForbidden}`)
  }

  const previousStatus = String(previous?.verification?.status || "").trim()
  const currentStatus = String(selected?.verification?.status || verification?.status || "").trim()
  if (previousStatus && currentStatus && previousStatus !== currentStatus) {
    rows.push(`Generation Verification Gate：${previousStatus} -> ${currentStatus}`)
  }

  const previousVerdict = String(previous?.evaluation?.verdict || "").trim()
  const currentVerdict = String(selected?.evaluation?.verdict || evaluation?.verdict || "").trim()
  if (previousVerdict && currentVerdict && previousVerdict !== currentVerdict) {
    rows.push(`Evaluator 判定：${previousVerdict} -> ${currentVerdict}`)
  }

  if (Boolean(previous?.readyForApproval) !== Boolean(selected?.readyForApproval)) {
    rows.push(`User Approval Gate：${previous?.readyForApproval ? "上一轮已达确认门槛" : "上一轮未达确认门槛"} -> ${selected?.readyForApproval ? "本轮可进入用户确认" : "本轮仍需继续迭代"}`)
  }

  const currentPromptAdjustments = styleCandidateArrayMetric(selected, "promptAdjustments", refinement)
  const previousPromptAdjustments = styleCandidateArrayMetric(previous, "promptAdjustments")
  const newPromptAdjustments = styleNewArrayItems(currentPromptAdjustments, previousPromptAdjustments)
  if (newPromptAdjustments.length) {
    rows.push(`Prompt Refiner 新增 ${newPromptAdjustments.length} 条 prompt 调整：${newPromptAdjustments.slice(0, 2).join("；")}`)
  } else if (currentPromptAdjustments.length) {
    rows.push(`Prompt Refiner 延续 ${currentPromptAdjustments.length} 条 prompt 调整，继续压回下一轮生成。`)
  }

  const currentContractAdjustments = styleCandidateArrayMetric(selected, "contractAdjustments", refinement)
  const previousContractAdjustments = styleCandidateArrayMetric(previous, "contractAdjustments")
  const newContractAdjustments = styleNewArrayItems(currentContractAdjustments, previousContractAdjustments)
  if (newContractAdjustments.length) {
    rows.push(`Style Contract 新增 ${newContractAdjustments.length} 条收紧：${newContractAdjustments.slice(0, 2).join("；")}`)
  } else if (currentContractAdjustments.length) {
    rows.push(`Style Contract 延续 ${currentContractAdjustments.length} 条收紧约束，供后续轮次继续继承。`)
  }

  if (loop?.convergence) {
    rows.push(`Loop Controller 当前收敛判断：${styleLoopConvergenceLabel(loop.convergence)}`)
  }

  return rows.length > 1
    ? rows
    : rows.concat("本轮和上一轮暂时没有可见指标差异；如果用户仍不满意，Controller 应继续生成差异更明确的候选。")
}

function summarizeGenerationVerificationLines({
  verification = {},
  evaluation = {},
  fallbackStatus = "",
  fallbackSummary = "",
  fallbackReasons = [],
} = {}) {
  const status = String(verification?.status || fallbackStatus || "").trim()
  const summary = String(verification?.summary || fallbackSummary || "").trim()
  const reasons = Array.isArray(verification?.reasons) && verification.reasons.length
    ? verification.reasons
    : (Array.isArray(fallbackReasons) ? fallbackReasons : [])
  const forbiddenHits = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits : []
  const lines = [
    status ? `验证状态：${status}` : "",
    summary ? `验证摘要：${summary}` : "",
    typeof verification?.score === "number" ? `AIGC 概率：${Number(verification.score).toFixed(3)}` : "",
    typeof verification?.threshold === "number" ? `风险阈值：${Number(verification.threshold).toFixed(3)}` : "",
    typeof verification?.highRiskCount === "number" ? `高风险片段：${Number(verification.highRiskCount)} 个` : "",
    forbiddenHits.length ? `禁忌命中：${forbiddenHits.length} 条` : "",
    ...reasons,
  ]
  return lines.filter(Boolean)
}

function buildVerificationGateEvidence(verification = {}, evaluation = {}) {
  const status = String(verification?.status || "").trim()
  const highRiskCount = Number(
    verification?.highRiskCount
    ?? evaluation?.aigc?.highRiskCount
    ?? 0,
  )
  const forbiddenHits = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits : []
  const evidenceRows = []

  if (status === "blocked") {
    if (highRiskCount > 0) {
      evidenceRows.push({
        status: "blocked",
        title: "AIGC 风险阻塞",
        detail: `${highRiskCount} 个高风险片段仍未压下去，当前不能进入冻结。`,
      })
    }
    if (forbiddenHits.length > 0) {
      evidenceRows.push({
        status: "blocked",
        title: "禁忌命中阻塞",
        detail: `当前仍命中 ${forbiddenHits.length} 条禁忌模式，写法合同还不够干净。`,
      })
    }
    if (!evidenceRows.length) {
      evidenceRows.push({
        status: "blocked",
        title: "生成验证阻塞",
        detail: verification?.summary || "当前样段仍未通过生成验证门，不能直接冻结。",
      })
    }
  } else if (status === "warning") {
    evidenceRows.push({
      status: "warning",
      title: "验证证据待补齐",
      detail: "当前还没有足够证据证明这轮样段可以安全冻结成整书写法。",
    })
  } else if (status === "passed") {
    evidenceRows.push({
      status: "passed",
      title: "生成验证已放行",
      detail: "AIGC 风险和禁忌命中处于可放行范围，可以继续逼近用户确认与冻结。",
    })
  } else {
    evidenceRows.push({
      status: "warning",
      title: "等待生成验证",
      detail: "先产出本轮样段与验证证据，再判断能否继续冻结。",
    })
  }

  return evidenceRows
}

function buildVerificationDrivenRefinementRows({
  verification = {},
  evaluation = {},
  refinement = {},
} = {}) {
  const status = String(verification?.status || "").trim()
  const highRiskCount = Number(verification?.highRiskCount || evaluation?.aigc?.highRiskCount || 0)
  const forbiddenHits = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits : []
  const nextFocus = Array.isArray(evaluation?.nextFocus) ? evaluation.nextFocus : []
  const promptAdjustments = Array.isArray(refinement?.promptAdjustments) ? refinement.promptAdjustments : []
  const contractAdjustments = Array.isArray(refinement?.contractAdjustments) ? refinement.contractAdjustments : []
  const rows = []

  if (status === "blocked" && highRiskCount > 0) {
    rows.push(`因为 AIGC 风险仍然阻塞，下一轮 prompt 需要优先压缩模板腔、解释腔和重复表达，至少修掉 ${highRiskCount} 个高风险片段。`)
  }
  if (status === "blocked" && forbiddenHits.length > 0) {
    rows.push(`因为仍命中 ${forbiddenHits.length} 条禁忌，下一轮 style contract 需要把这些模式写成更硬的负约束，而不是只停留在提醒层。`)
  }
  if (status === "warning") {
    rows.push("因为当前验证证据不足，下一轮要补齐能证明这套写法可放行的样段质量和验证依据。")
  }
  if (nextFocus.length > 0) {
    rows.push(`下一轮重点会优先围绕：${nextFocus.slice(0, 3).join("；")}`)
  }
  if (promptAdjustments.length > 0) {
    rows.push(`下一轮 prompt 已收紧 ${promptAdjustments.length} 条：${promptAdjustments.slice(0, 2).join("；")}`)
  }
  if (contractAdjustments.length > 0) {
    rows.push(`写法合同已收紧 ${contractAdjustments.length} 条：${contractAdjustments.slice(0, 2).join("；")}`)
  }
  if (!rows.length) {
    rows.push("当前还没有形成足够清晰的“验证结论 -> 下一轮收紧动作”链路。")
  }

  return rows
}

function buildNextLoopExecutionRows({
  loop = {},
  ui = {},
  evaluation = {},
  refinement = {},
  verification = {},
  retryPolicy = {},
} = {}) {
  const totalIterations = Number(ui?.lastLoopRun?.totalIterations || loop?.autoIterations || 0)
  const candidateCount = Number(ui?.lastLoopRun?.candidateCount || 0)
  const stopReason = String(ui?.lastLoopRun?.stopReason || loop?.lastStopReason || "").trim()
  const nextFocus = Array.isArray(evaluation?.nextFocus) ? evaluation.nextFocus : []
  const promptAdjustments = Array.isArray(refinement?.promptAdjustments) ? refinement.promptAdjustments : []
  const contractAdjustments = Array.isArray(refinement?.contractAdjustments) ? refinement.contractAdjustments : []
  const rows = [
    totalIterations > 0 ? `下一轮将沿用最近一次 Loop 节奏：最多 ${totalIterations} 轮。` : "",
    candidateCount > 0 ? `下一轮每轮继续产出 ${candidateCount} 个候选，再进行竞争与淘汰。` : "",
    verification?.status === "blocked"
      ? "因为当前生成验证门阻塞，Loop Controller 不会直接放行冻结，而会优先把风险重新压回下一轮。"
      : verification?.status === "passed"
        ? "当前验证已放行，Loop Controller 的重点会转向稳定性复核与用户确认。"
        : "当前 Loop Controller 会继续等待更完整的验证与收敛证据。",
    nextFocus.length ? `下一轮关注点：${nextFocus.slice(0, 3).join("；")}` : "",
    promptAdjustments.length ? `下一轮 prompt 收紧：${promptAdjustments.slice(0, 2).join("；")}` : "",
    contractAdjustments.length ? `下一轮合同收紧：${contractAdjustments.slice(0, 2).join("；")}` : "",
    stopReason ? `最近一次停止原因：${stopReason}` : "",
    styleRetryPolicyRows(retryPolicy).length ? `重试策略：${styleRetryPolicyRows(retryPolicy).slice(0, 2).join(" / ")}` : "",
  ].filter(Boolean)

  return rows.length ? rows : ["当前还没有形成足够清晰的下一轮执行计划。"]
}

function buildRejectionInjectionPreviewRows({
  selected = null,
  rejectionDraft = "",
  refinement = {},
  evaluation = {},
  verification = {},
} = {}) {
  const reason = String(rejectionDraft || selected?.rejectionReason || "").trim()
  const nextPrompt = String(refinement?.nextPrompt || selected?.refinement?.nextPrompt || "").trim()
  const nextFocus = Array.isArray(evaluation?.nextFocus) ? evaluation.nextFocus : []
  const promptAdjustments = Array.isArray(refinement?.promptAdjustments) ? refinement.promptAdjustments : []
  const contractAdjustments = Array.isArray(refinement?.contractAdjustments) ? refinement.contractAdjustments : []
  const verificationSummary = String(verification?.summary || selected?.verification?.summary || "").trim()
  const rows = []

  rows.push(reason
    ? `用户退回指令会写入下一轮：${reason}`
    : "填写退回原因后，Loop Controller 会把它作为下一轮必须修正的用户指令。")
  if (nextPrompt) {
    rows.push(`下一轮会以 Refiner 当前 prompt 为底稿：${nextPrompt.replace(/\s+/gu, " ").slice(0, 180)}`)
  }
  if (verificationSummary) {
    rows.push(`生成验证结论会继续参与收紧：${verificationSummary}`)
  }
  if (nextFocus.length) {
    rows.push(`Evaluator 下一轮关注点：${nextFocus.slice(0, 3).join("；")}`)
  }
  if (promptAdjustments.length) {
    rows.push(`Prompt Refiner 已给出 ${promptAdjustments.length} 条 prompt 调整：${promptAdjustments.slice(0, 2).join("；")}`)
  }
  if (contractAdjustments.length) {
    rows.push(`Style Contract 将优先收紧：${contractAdjustments.slice(0, 2).join("；")}`)
  }

  return rows
}

function renderRejectionInjectionPreview({
  selected = null,
  rejectionDraft = "",
  refinement = {},
  evaluation = {},
  verification = {},
} = {}) {
  return renderStyleLoopList(
    buildRejectionInjectionPreviewRows({ selected, rejectionDraft, refinement, evaluation, verification }),
    "填写退回原因后，系统会预览下一轮如何吸收这条反馈。",
  )
}

function buildChapterInheritanceEvidenceRows({
  approvedVersion = 0,
  contract = {},
  freezeAssets = {},
  inheritanceAssets = {},
} = {}) {
  const inheritedRules = Array.isArray(contract?.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules : []
  const inheritedArtifacts = Array.isArray(contract?.inheritance?.inheritedArtifacts) ? contract.inheritance.inheritedArtifacts : []
  const rows = [
    approvedVersion ? `当前整书写法已冻结为 v${approvedVersion}，正文生产必须继承这份合同。` : "当前还没有正式冻结版本，章节生产不应该自由放行。",
    freezeAssets?.approvedSample?.exists ? "用户确认样段已写入冻结资产包。" : "",
    freezeAssets?.freezeLedger?.exists ? "style-freeze-ledger.json 已落地，可追踪冻结决策。" : "",
    freezeAssets?.loopRuntime?.exists ? "style-loop-runtime.json 已落地，可追踪整条 loop 轨迹。" : "",
    inheritanceAssets?.rulebook?.exists ? "style/rulebook.md 已同步到章节继承链。" : "",
    inheritanceAssets?.references?.exists ? "style/references.md 已同步到章节继承链。" : "",
    inheritanceAssets?.antiPatterns?.exists ? "style/anti-patterns.md 已同步到章节继承链。" : "",
    inheritedArtifacts.length ? `已登记 ${inheritedArtifacts.length} 项继承资产。` : "",
    inheritedRules.length ? `已登记 ${inheritedRules.length} 条正文强制继承规则。` : "",
  ].filter(Boolean)

  return rows.length ? rows : ["当前还没有形成足够明确的章节继承证据。"]
}

function buildReaderStyleInheritanceRows({
  chapter = {},
  snapshot = {},
} = {}) {
  const verification = chapter?.styleInheritanceVerification || chapter?.publishReadiness?.styleInheritanceVerification || {}
  const styleEvolution = snapshot?.styleEvolution || {}
  const contract = styleEvolution?.contract || {}
  const loop = contract?.loop || {}
  const approvedVersion = Number(verification?.contractVersion || loop?.approvalVersion || 0)
  const inheritance = contract?.inheritance || {}
  const inheritedRules = Array.isArray(inheritance?.inheritedRules) ? inheritance.inheritedRules : []
  const inheritedArtifacts = Array.isArray(inheritance?.inheritedArtifacts) ? inheritance.inheritedArtifacts : []
  const frozenBasePrompt = String(contract?.frozenBasePrompt || "").trim()
  const styleContract = contract?.styleContract || {}
  const positiveExamples = Array.isArray(styleContract?.positiveExamples) ? styleContract.positiveExamples : []
  const forbiddenPatterns = Array.isArray(styleContract?.forbiddenPatterns) ? styleContract.forbiddenPatterns : []
  const qualityGate = chapter?.qualityGate || {}
  const publishReadiness = chapter?.publishReadiness || chapter?.versionManifest?.publishReadiness || {}
  const evidence = Array.isArray(verification?.evidence) ? verification.evidence : []

  const rows = [
    approvedVersion ? `当前章节应继承整书写法合同 v${approvedVersion}。` : "当前项目还没有正式冻结整书写法合同。",
    verification?.summary ? `继承结论：${verification.summary}` : "",
    contract?.frozenBasePrompt ? "冻结基础 prompt 已存在。" : "",
    frozenBasePrompt ? `冻结基线：${readerPlainPreview(frozenBasePrompt, 120)}` : "",
    inheritance?.status ? `继承状态：${inheritance.status}` : "",
    inheritedRules.length ? `继承规则 ${inheritedRules.length} 条。` : "",
    inheritedRules.length ? `规则摘要：${readerPlainPreview(inheritedRules.slice(0, 2).join("；"), 120)}` : "",
    inheritedArtifacts.length ? `继承资产 ${inheritedArtifacts.length} 项。` : "",
    positiveExamples.length ? `正向例子 ${positiveExamples.length} 条。` : "",
    forbiddenPatterns.length ? `禁忌模式 ${forbiddenPatterns.length} 条。` : "",
    verification?.freezeAssetsReady ? "冻结资产包已完整落地。" : "",
    verification?.inheritanceAssetsReady ? "章节继承资产已同步。" : "",
    verification?.styleFingerprintReady ? "首章风格指纹已可用。" : "",
    evidence.slice(0, 4).map((item) => `验证证据：${item}`),
    qualityGate?.status ? `本章质量门状态：${qualityGate.status}` : "",
    publishReadiness?.ready === true ? "本章发布检查已通过。" : "",
    publishReadiness?.ready === false ? "本章发布检查仍未完全通过，需继续复核继承与质量门。": "",
  ].flat().filter(Boolean)

  return rows.length ? rows : ["当前还没有可展示的章节写法继承信息。"]
}

function buildReaderStyleDriftRows({
  chapter = {},
  snapshot = {},
} = {}) {
  const verification = chapter?.styleInheritanceVerification || chapter?.publishReadiness?.styleInheritanceVerification || {}
  const styleDrift = verification?.styleDrift || verification?.styleConformanceDrift || verification?.styleConformance || {}
  const styleForbiddenHitCount = typeof styleDrift?.forbiddenHitCount === "number"
    ? Number(styleDrift.forbiddenHitCount)
    : typeof styleDrift?.metrics?.forbiddenHitCount === "number"
      ? Number(styleDrift.metrics.forbiddenHitCount)
      : null
  const styleEvolution = snapshot?.styleEvolution || {}
  const contract = styleEvolution?.contract || {}
  const loop = contract?.loop || {}
  const approvedVersion = Number(verification?.contractVersion || loop?.approvalVersion || 0)
  const gate = chapter?.qualityGate || {}
  const aigcDetection = chapter?.aigcDetection || chapter?.versionManifest?.aigcDetection || verification?.aigc || {}
  const publishReadiness = chapter?.publishReadiness || chapter?.versionManifest?.publishReadiness || {}
  const missingReadiness = Array.isArray(publishReadiness?.missing) ? publishReadiness.missing : []
  const missingLabels = missingReadiness.map((entry) => entry?.label || entry?.id).filter(Boolean)
  const publishBaseMissing = Array.isArray(verification?.publishBaseMissing) ? verification.publishBaseMissing : []
  const blockedReason = String(gate?.reason || gate?.summary || "").trim()
  const aigcReason = String(aigcDetection?.reason || "").trim()
  const risks = Array.isArray(verification?.risks) ? verification.risks : []
  const rows = []

  if (!approvedVersion) {
    rows.push("当前还没有正式冻结整书写法合同，所以本章暂时无法做严格的写法偏离判断。")
  } else {
    rows.push(`本章当前应与整书写法合同 v${approvedVersion} 保持一致。`)
  }

  if (verification?.summary) {
    rows.push(`当前验证结论：${verification.summary}`)
  }

  if (typeof styleDrift?.conformanceScore === "number" || typeof styleDrift?.driftScore === "number") {
    const scoreText = typeof styleDrift?.conformanceScore === "number"
      ? `继承分 ${Number(styleDrift.conformanceScore).toFixed(0)}/100`
      : "继承分待计算"
    const driftText = typeof styleDrift?.driftScore === "number"
      ? `漂移 ${Number(styleDrift.driftScore).toFixed(0)}/100`
      : "漂移待计算"
    const thresholdText = typeof styleDrift?.threshold === "number"
      ? `稳定阈值 ${Number(styleDrift.threshold).toFixed(0)}`
      : "稳定阈值待确认"
    rows.push(`真实风格漂移评分：${scoreText}，${driftText}，${thresholdText}。`)
  }

  if (typeof styleForbiddenHitCount === "number") {
    rows.push(`禁忌写法命中：${styleForbiddenHitCount} 条${typeof styleDrift?.maxForbiddenHitCount === "number" ? `，允许上限 ${Number(styleDrift.maxForbiddenHitCount)}` : ""}。`)
  }

  if (Array.isArray(styleDrift?.matchedTerms) && styleDrift.matchedTerms.length) {
    rows.push(`本章命中的冻结合同词：${styleDrift.matchedTerms.slice(0, 6).join("、")}。`)
  }

  if (gate?.status === "blocked") {
    rows.push(`本章质量门当前阻塞：${blockedReason || "仍未通过章节质量门。"} 这通常意味着它还不适合被视为稳定继承合同的正文。`)
  } else if (gate?.status) {
    rows.push(`本章质量门状态：${gate.status}。`)
  }

  if (aigcDetection?.status === "blocked") {
    rows.push(`AIGC 检测当前阻塞：${Number(aigcDetection?.highRiskCount || aigcDetection?.highRiskSegments?.length || 0)} 个高风险片段${aigcReason ? `，${aigcReason}` : ""}。`)
  } else if (aigcDetection?.status === "passed") {
    rows.push(`AIGC 检测已通过${typeof aigcDetection?.score === "number" ? `，均值 ${Number(aigcDetection.score).toFixed(3)}` : ""}。`)
  } else if (aigcDetection?.status) {
    rows.push(`AIGC 检测状态：${aigcDetection.status}${aigcReason ? `，${aigcReason}` : ""}。`)
  }

  if (publishReadiness?.ready === false && missingLabels.length > 0) {
    rows.push(`发布检查尚未完成：${missingLabels.join("、")}。在这些项补齐前，本章仍有偏离冻结写法合同的风险。`)
  } else if (publishReadiness?.ready === true) {
    rows.push("本章发布检查已通过，说明它在当前质量链路里更接近稳定继承合同的正文。")
  }

  if (publishBaseMissing.length > 0) {
    rows.push(`写法验证链仍缺少：${publishBaseMissing.map((entry) => entry?.label || entry?.id).filter(Boolean).join("、")}。`)
  }

  if (contract?.inheritance?.status) {
    rows.push(`当前整书继承链状态：${contract.inheritance.status}。`)
  }

  risks.slice(0, 4).forEach((risk) => {
    rows.push(`风险提示：${risk}`)
  })

  return rows.length ? rows : ["当前还没有足够证据判断本章是否偏离冻结写法合同。"]
}

function renderLoopPhaseBoard({
  selected = null,
  history = [],
  candidateBatch = [],
  loop = {},
  verification = {},
  refinement = {},
  freezePreview = null,
  approvedVersion = 0,
  contract = {},
} = {}) {
  const candidateCount = Math.max(
    Array.isArray(candidateBatch) ? candidateBatch.length : 0,
    Array.isArray(history) ? history.length : 0,
    selected?.version ? 1 : 0,
  )
  const evaluation = selected?.evaluation || {}
  const freezer = freezePreview?.freezer || selected?.freezer || contract?.freezer || {}
  const userApproved = Boolean(approvedVersion || selected?.userDecision === "accepted" || contract?.approval?.acceptedAsBookStyle)
  const approvalReady = Boolean(selected?.readyForApproval || loop?.readyVersion || freezePreview?.version)
  const phaseCards = [
    {
      phase: "01",
      label: "Seed Prompt Builder",
      status: contract?.seedPrompt || contract?.userStylePrompt ? "passed" : "blocked",
      title: contract?.userStylePrompt ? "种子协议已写入" : "等待种子输入",
      detail: contract?.referenceWorks?.length
        ? `参考 ${contract.referenceWorks.length} 项`
        : contract?.desiredVibes?.length
          ? `气质 ${contract.desiredVibes.length} 项`
          : "先定义风格要求、参考作品、禁忌与气质",
    },
    {
      phase: "02",
      label: "Candidate Generator",
      status: candidateCount ? "passed" : "blocked",
      title: candidateCount ? `${candidateCount} 个候选/轮次` : "尚未生成候选",
      detail: selected?.version ? `当前审阅 v${selected.version}` : "先运行 Candidate Generator 产出可比较样段",
    },
    {
      phase: "03",
      label: "Evaluator / Critic",
      status: evaluation?.summary ? "passed" : selected?.sample ? "warning" : "blocked",
      title: evaluation?.verdict ? `评估 ${evaluation.verdict}` : "等待评估",
      detail: evaluation?.summary || "评估叙述声音、节奏、对白、信息密度和偏差",
    },
    {
      phase: "Gate",
      label: "AIGC / Generation Verification",
      status: verification?.status === "passed" ? "passed" : verification?.status === "blocked" ? "blocked" : selected?.sample ? "warning" : "blocked",
      title: verification?.status ? `验证 ${verification.status}` : "等待验证",
      detail: verification?.summary || "AIGC 检测、禁忌命中和模板腔风险必须先通过",
    },
    {
      phase: "04",
      label: "Prompt Refiner",
      status: refinement?.nextPrompt ? "passed" : selected?.evaluation?.summary ? "warning" : "blocked",
      title: refinement?.nextPrompt ? "下一轮 prompt 已收紧" : "等待 prompt 修订建议",
      detail: refinement?.summary || "把评估和生成验证结果反写回下一轮 prompt",
    },
    {
      phase: "05",
      label: "Loop Controller",
      status: loop?.readyVersion || loop?.stableVersion || loop?.currentIteration ? "passed" : candidateCount ? "warning" : "blocked",
      title: loop?.readyVersion ? `可确认 v${loop.readyVersion}` : loop?.currentIteration ? `已跑 ${Number(loop.currentIteration)} 轮` : "等待 Loop 运行",
      detail: loop?.stableVersion ? `稳定版本 v${loop.stableVersion}` : "根据评估、验证和 refiner 结果决定继续迭代或进入确认",
    },
    {
      phase: "06",
      label: "User Approval Gate",
      status: userApproved ? "passed" : approvalReady ? "warning" : "blocked",
      title: userApproved
        ? `用户已确认 v${approvedVersion || selected?.version || ""}`.trim()
        : approvalReady
          ? "等待用户确认"
          : "尚未达到确认门槛",
      detail: userApproved
        ? "确认的是整本书后续统一继承的写法底盘"
        : "用户满意样段后，才允许进入正式冻结",
    },
    {
      phase: "07",
      label: "Style Contract Freezer",
      status: String(freezer?.verdict || "") === "ready" || approvedVersion ? "passed" : freezePreview?.version || freezer?.verdict ? "warning" : "blocked",
      title: approvedVersion
        ? `冻结 v${approvedVersion}`
        : freezer?.verdict
          ? `Freezer ${freezer.verdict}`
          : "等待 Freezer verdict",
      detail: freezer?.summary || contract?.approval?.freezeSummary || "Freezer 必须明确 ready，才能把样段固化成合同",
    },
    {
      phase: "08",
      label: "Chapter Inheritance Adapter",
      status: approvedVersion && contract?.inheritance?.status ? "passed" : approvedVersion ? "warning" : "blocked",
      title: contract?.inheritance?.status || (approvedVersion ? "等待继承资产" : "冻结后才会下发"),
      detail: approvedVersion
        ? "rulebook / references / anti-patterns 会作为后续章节基线"
        : "未冻结前，章节生产继续被写法门禁约束",
    },
  ]

  return `
    <div class="style-loop-phase-board">
      ${phaseCards.map((card) => `
        <div class="style-loop-phase-card is-${card.status}">
          <div class="style-loop-phase-top">
            <span>${escapeHtml(card.phase)} · ${escapeHtml(card.label)}</span>
            <span class="style-loop-pill is-${card.status}">${escapeHtml(card.title)}</span>
          </div>
          <strong>${escapeHtml(card.detail)}</strong>
        </div>
      `).join("")}
    </div>
  `
}

function renderCurrentIterationFlow({
  selected = null,
  previousCandidate = null,
  evaluation = {},
  refinement = {},
  verification = {},
  loop = {},
  contract = {},
  historyOptions = "",
  approvedVersion = 0,
  rejectionDraft = "",
  loading = false,
  selectedVersion = 0,
}) {
  const aigcMeta = styleAigcMeta(evaluation?.aigc)
  const scoreRows = styleScoreRows(evaluation)
  const selectedVerdictMeta = styleVerdictMeta(evaluation?.verdict)
  const selectedDecisionMeta = styleUserDecisionMeta(selected?.userDecision)
  const actionState = styleCandidateActionState(selected)
  const approvalChecklistCard = renderStyleApprovalChecklist(selected, loop)
  const approvalDecisionCard = renderStyleApprovalDecisionCard({
    selected,
    approved: approvedVersion ? { version: approvedVersion, sample: contract?.approvedSample || "" } : null,
    stable: null,
    readyVersion: Number(loop.readyVersion || 0),
  })
  const freezeSummaryRows = [
    selected?.readyForApproval ? `当前版本 v${selectedVersion} 已达到可确认门槛。` : "",
    selected?.verification?.status ? `生成验证门状态：${selected.verification.status}` : "",
    selected?.verification?.summary ? `验证摘要：${selected.verification.summary}` : "",
    typeof selected?.verification?.score === "number" ? `AIGC 概率 ${Number(selected.verification.score).toFixed(3)} / 阈值 ${typeof selected?.verification?.threshold === "number" ? Number(selected.verification.threshold).toFixed(3) : "n/a"}` : "",
    selected?.verification?.highRiskCount ? `AIGC 高风险片段 ${Number(selected.verification.highRiskCount)} 个。` : "",
    selected?.evaluation?.verdict ? `评估判定：${selected.evaluation.verdict}` : "",
    selected?.refinement?.contractAdjustments?.length ? `合同收紧建议 ${selected.refinement.contractAdjustments.length} 条。` : "",
    approvedVersion && approvedVersion === selectedVersion ? "这是当前正式冻结版本。" : "",
  ].filter(Boolean)
  const verificationRows = [
    verification?.summary ? `验证摘要：${verification.summary}` : "",
    ...(Array.isArray(verification?.reasons) ? verification.reasons.map((item) => `验证依据：${item}`) : []),
    evaluation?.aigc?.enabled ? "AIGC 检测已进入生成验证环节。" : "",
    typeof evaluation?.aigc?.score === "number" ? `AIGC 概率：${Number(evaluation.aigc.score).toFixed(3)}` : "",
    typeof evaluation?.aigc?.threshold === "number" ? `风险阈值：${Number(evaluation.aigc.threshold).toFixed(3)}` : "",
    evaluation?.aigc?.highRiskCount ? `高风险片段：${Number(evaluation.aigc.highRiskCount)} 个` : "",
    evaluation?.aigc?.reason ? `检测结论：${evaluation.aigc.reason}` : "",
    ...(Array.isArray(evaluation?.aigc?.highRiskPreviews) ? evaluation.aigc.highRiskPreviews.map((item) => `高风险摘录：${item}`) : []),
  ].filter(Boolean)
  const verificationEvidence = buildVerificationGateEvidence(verification, evaluation)
  const freezeImpactRows = [
    verification?.status === "passed"
      ? "当前验证门已放行，系统可以继续进入用户确认与冻结预演。"
      : verification?.status === "blocked"
        ? "当前验证门阻塞，Style Contract Freeze Gate 不允许放行整书写法。"
        : "当前验证门证据不足，暂时不应该直接冻结整书写法。",
    verification?.status === "passed"
      ? "一旦用户确认，rulebook / references / anti-patterns 会被正式下发给章节生产。"
      : "在验证门通过前，章节继承资产只能停留在预备态，不能作为正式正文基线。",
    Number(verification?.highRiskCount || evaluation?.aigc?.highRiskCount || 0) > 0
      ? `当前还有 ${Number(verification?.highRiskCount || evaluation?.aigc?.highRiskCount || 0)} 个高风险片段，需要在下一轮继续修复。`
      : "",
    Array.isArray(evaluation?.forbiddenHits) && evaluation.forbiddenHits.length
      ? `当前还有 ${evaluation.forbiddenHits.length} 条禁忌命中，需要继续收紧 prompt 和 style contract。`
      : "",
  ].filter(Boolean)
  const verificationDrivenRefinementRows = buildVerificationDrivenRefinementRows({
    verification,
    evaluation,
    refinement,
  })
  const rejectionInjectionPreview = renderRejectionInjectionPreview({
    selected,
    rejectionDraft,
    refinement,
    evaluation,
    verification,
  })
  const loopDeltaRows = buildStyleIterationDeltaRows({
    selected,
    previous: previousCandidate,
    evaluation,
    refinement,
    verification,
    loop,
  })
  const seedRows = summarizeSeedProtocolLines({
    referenceText: contract?.referenceText,
    referenceWorks: contract?.referenceWorks,
    desiredVibes: contract?.desiredVibes,
    seedForbiddenPatterns: contract?.seedForbiddenPatterns,
  })
  const seedPromptText = String(contract?.seedPrompt || contract?.userStylePrompt || "").trim()

  return `
    <div class="style-iteration-flow">
      <div class="style-iteration-main-lane">
        <div class="style-loop-card style-iteration-flow-card is-input">
          <div class="style-loop-section-head compact">
            <div>
              <span>01 Seed Prompt Builder</span>
              <small>用户风格输入 · 参考锚点 · 写法禁忌</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            这里固定本书最初的写法种子。后面的每一轮候选、评审、反思和冻结，都不能脱离这个起点自由漂移。
          </div>
          <div class="style-loop-subsection">
            <b>基础写法种子</b>
            <div class="style-loop-quote style-loop-evidence-block">${escapeHtml(seedPromptText || "初始化 Style Evolution Engine 后，这里会显示用户确认的基础写法种子。")}</div>
          </div>
          <div class="style-loop-subsection">
            <b>种子协议摘要</b>
            ${renderStyleLoopList(seedRows, "当前还没有参考作品、目标气质或写法禁忌。")}
          </div>
        </div>

        <div class="style-iteration-flow-connector">
          <span>Seed Prompt Builder 形成种子后，Candidate Generator 才开始生成可评估样段</span>
        </div>

        <div class="style-loop-card style-iteration-flow-card is-input">
          <div class="style-loop-section-head compact">
            <div>
              <span>02 Candidate Generator</span>
              <small>${selected?.source === "manual" ? "人工录入" : "Loop 自动生成"} · 当前候选 v${selectedVersion || selected?.version || "?"}</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            候选样段不是最终写法，只是本轮 Evaluator / Critic、Generation Verification 和 Prompt Refiner 的输入。
          </div>
          <div class="style-loop-subsection">
            <b>本轮 Prompt</b>
            <div class="style-loop-quote style-loop-evidence-block">${escapeHtml(String(selected?.prompt || "").trim() || "运行 Loop 后，这里会显示 Candidate Generator 实际使用的 prompt。")}</div>
          </div>
          <div class="style-loop-subsection">
            <b>本轮生成样段</b>
            <div class="style-loop-quote style-loop-evidence-block style-loop-sample-evidence">${escapeHtml(String(selected?.sample || "").trim() || "运行 Loop 后，这里会显示本轮候选正文样段。")}</div>
          </div>
          <div class="style-loop-subsection">
            <b>本轮评估摘要</b>
            <div class="style-loop-quote style-loop-evidence-block">${escapeHtml(evaluation.summary || selected?.review || "Evaluator / Critic 完成后，这里会显示本轮整体判断。")}</div>
          </div>
        </div>

        <div class="style-iteration-flow-connector">
          <span>首轮生成后，进入多维评审，不直接冻结</span>
        </div>

        <div class="style-loop-card style-iteration-flow-card is-eval">
          <div class="style-loop-section-head compact">
            <div>
              <span>03 Evaluator / Critic</span>
              <small>${escapeHtml(`${selectedVerdictMeta.label} · ${selectedDecisionMeta.label}`)} · 多维评审</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            这里拆开看声音、节奏、对白、信息密度和禁忌命中，判断这一轮到底像不像你要的那本书。
          </div>
          ${scoreRows.length ? `
            <div class="style-loop-score-grid style-loop-score-grid-iteration">
              ${scoreRows.map((row) => `
                <div class="style-loop-score-card ${row.key === "overall" ? "is-overall" : ""}">
                  <span>${escapeHtml(row.label)}</span>
                  <strong>${row.value.toFixed(1)}</strong>
                </div>
              `).join("")}
            </div>
          ` : ""}
          <div class="style-loop-subsection">
            <b>优势</b>
            ${renderStyleLoopList(evaluation.strengths, "当前轮还没有优势总结。")}
          </div>
          <div class="style-loop-subsection">
            <b>偏差</b>
            ${renderStyleLoopList(evaluation.deviations, "当前轮还没有偏差分析。")}
          </div>
          <div class="style-loop-subsection">
            <b>禁忌命中</b>
            ${renderStyleLoopList(evaluation.forbiddenHits, "当前轮没有命中禁忌模式。")}
          </div>
        </div>

        <div class="style-iteration-flow-connector">
          <span>评审之后必须过 AIGC / Generation Verification Gate，再决定能不能进入冻结链</span>
        </div>

        <div class="style-loop-card style-iteration-flow-card is-verify">
          <div class="style-loop-section-head compact">
            <div>
              <span>Gate AIGC / Generation Verification</span>
              <small>${escapeHtml(aigcMeta.label)} · 生成验证门，不占主阶段编号</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            这一步专门拦截 AI 腔、模板腔和高风险片段。AIGC 检测是生成验证的一部分，不是额外附属功能；样段就算“看上去不错”，只要验证不过，也不能拿去冻结成整书写法。
          </div>
          <div class="style-verification-gate-evidence">
            ${verificationEvidence.map((item) => `
              <div class="style-verification-gate-evidence-item is-${item.status}">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.detail)}</span>
              </div>
            `).join("")}
          </div>
          ${renderStyleLoopList(verificationRows, "当前轮还没有 AIGC 生成验证结果。")}
          <div class="style-loop-subsection">
            <b>对冻结与继承的影响</b>
            ${renderStyleLoopList(freezeImpactRows, "当前还没有形成冻结影响说明。")}
          </div>
        </div>

        <div class="style-iteration-flow-connector">
          <span>验证结果会直接反推下一轮 prompt 和 style contract，让系统知道为什么改、改哪里、先压什么风险</span>
        </div>

        <div class="style-loop-card style-iteration-flow-card is-refine">
          <div class="style-loop-section-head compact">
            <div>
              <span>04 Prompt Refiner</span>
              <small>${escapeHtml(`${refinement.source || "unknown"} · ${refinement.summary || "等待生成"}`)} · 反思与改写</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            系统会总结这一轮为什么不够像，并把问题重新压回 prompt、写法合同和下一轮关注点里，形成真正的自进化闭环。
          </div>
          <div class="style-loop-subsection">
            <b>验证驱动的下一轮收紧</b>
            ${renderStyleLoopList(verificationDrivenRefinementRows, "当前还没有形成验证驱动的收紧说明。")}
          </div>
          <div class="style-loop-subsection">
            <b>下一轮基础 Prompt</b>
            <div class="style-loop-quote">${escapeHtml(refinement.nextPrompt || "系统会在每轮评估后，产出下一轮 prompt 的收紧版本。")}</div>
          </div>
          <div class="style-loop-subsection">
            <b>下一轮重点</b>
            ${renderStyleLoopList(evaluation.nextFocus, "当前轮还没有下一轮重点。")}
          </div>
          <div class="style-loop-subsection">
            <b>Prompt 调整</b>
            ${renderStyleLoopList(refinement.promptAdjustments, "当前轮还没有 prompt 调整建议。")}
          </div>
          <div class="style-loop-subsection">
            <b>合同收紧</b>
            ${renderStyleLoopList(refinement.contractAdjustments, "当前轮还没有合同收紧建议。")}
          </div>
        </div>

        <div class="style-iteration-flow-connector">
          <span>Refiner 的下一轮 prompt 交给 Controller，决定继续跑、收紧，还是进入人工确认</span>
        </div>

        <div class="style-loop-card style-iteration-flow-card is-controller">
          <div class="style-loop-section-head compact">
            <div>
              <span>05 Loop Controller</span>
              <small>${loop.readyVersion ? `可确认 v${loop.readyVersion}` : loop.stableVersion ? `稳定 v${loop.stableVersion}` : loop.status || "等待运行"}</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            Controller 读取评估、AIGC 验证和 Refiner 输出，判断继续生成候选、收紧 prompt、预览冻结，还是等待用户批准。
          </div>
          <div class="style-loop-subsection">
            <b>下一轮执行</b>
            ${renderStyleLoopList([
              loop.currentIteration ? `当前迭代：${Number(loop.currentIteration)}` : "",
              loop.readyVersion ? `可确认版本：v${loop.readyVersion}` : "",
              loop.stableVersion ? `稳定版本：v${loop.stableVersion}` : "",
              loop.convergence ? `收敛状态：${styleLoopConvergenceLabel(loop.convergence)}` : "",
              refinement.nextPrompt ? "下一轮 prompt 已由 Refiner 准备好。" : "",
            ].filter(Boolean), "Controller 还没有足够信号决定下一步。")}
          </div>
          <div class="style-loop-subsection">
            <b>本轮进化证据</b>
            ${renderStyleLoopList(loopDeltaRows, "当前还没有形成上一轮到本轮的可追踪变化。")}
          </div>
        </div>

        <div class="style-iteration-flow-connector">
          <span>Controller 放行后，只有用户确认“整本书以后按这个写”，系统才允许冻结写法合同</span>
        </div>

        <div class="style-loop-card style-iteration-flow-card is-approval">
          <div class="style-loop-section-head compact">
            <div>
              <span>06 User Approval Gate</span>
              <small>${approvedVersion ? `用户已确认 v${approvedVersion}` : loop.readyVersion ? `待确认 v${loop.readyVersion}` : "未达确认门槛"}</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            这里确认的是“这本书后续都按这个写法写”，不是只给当前样段打一个好评。用户没有确认前，系统不能把样段固化成全书合同。
          </div>
          <label class="style-evolution-field">
            <span>若不接受本轮，请写明退回原因</span>
            <textarea data-style-rejection-reason rows="3" placeholder="例如：对白还是太像解释，人物压迫感不够，动作推进不够明确。">${escapeHtml(rejectionDraft)}</textarea>
          </label>
          <div class="style-loop-subsection style-rejection-injection-preview" data-style-rejection-preview>
            <b>退回后下一轮注入预览</b>
            ${rejectionInjectionPreview}
          </div>
          <div class="style-loop-subsection">
            <b>用户确认判断</b>
            ${renderStyleLoopList(freezeSummaryRows, "当前还没有足够的冻结决策摘要。")}
          </div>
          ${renderStyleActionGateReasons(actionState)}
        </div>

        <div class="style-iteration-flow-connector">
          <span>用户确认后，Freezer 必须明确 ready，才会生成正式 style contract 和冻结资产</span>
        </div>

        <div class="style-loop-card style-iteration-flow-card is-gate">
          <div class="style-loop-section-head compact">
            <div>
              <span>07 Style Contract Freezer</span>
              <small>${approvedVersion ? `已冻结 v${approvedVersion}` : contract?.freezer?.verdict ? `Freezer ${contract.freezer.verdict}` : "等待 Freezer verdict"}</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            Freezer 负责把用户确认样段提炼成可执行合同：base prompt、style contract、禁忌模式、正向例子和 retry policy。只有 verdict=ready 才能进入正文继承。
          </div>
          <div class="style-loop-subsection">
            <b>Freezer 判定</b>
            ${renderStyleLoopList([
              contract?.freezer?.verdict ? `正式 verdict：${contract.freezer.verdict}` : "",
              contract?.freezer?.summary ? `正式摘要：${contract.freezer.summary}` : "",
              selected?.freezer?.verdict ? `候选 verdict：${selected.freezer.verdict}` : "",
              selected?.freezer?.summary ? `候选摘要：${selected.freezer.summary}` : "",
              contract?.approval?.freezeSummary ? `冻结说明：${contract.approval.freezeSummary}` : "",
            ].filter(Boolean), "当前还没有 Freezer ready 判定。")}
          </div>
          <div class="style-loop-subsection">
            <b>冻结动作</b>
            ${renderStyleLoopList([
              "base writing prompt",
              "style contract",
              "forbidden patterns",
              "positive examples",
              "retry policy",
            ], "冻结后资产会显示在这里。")}
          </div>
        </div>

        <div class="style-iteration-flow-connector">
          <span>冻结成功后，合同、正向参考和禁忌模式会下发到后续章节生产</span>
        </div>

        <div class="style-loop-card style-iteration-flow-card is-inheritance">
          <div class="style-loop-section-head compact">
            <div>
              <span>08 Chapter Inheritance Adapter</span>
              <small>${escapeHtml(contract?.inheritance?.status || (approvedVersion ? "等待继承资产" : "冻结后启用"))}</small>
            </div>
          </div>
          <div class="style-iteration-flow-note">
            章节继承不是说明文字，而是正文生产的硬约束：冻结合同、rulebook、references 和 anti-patterns 会共同约束后续章节。
          </div>
          <div class="style-loop-subsection">
            <b>继承基线</b>
            ${renderStyleLoopList([
              approvedVersion ? `冻结版本：v${approvedVersion}` : "",
              contract?.frozenBasePrompt ? "base writing prompt 已冻结。" : "",
              ...(Array.isArray(contract?.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules.slice(0, 4) : []),
            ].filter(Boolean), "当前还没有冻结版本可供章节继承。")}
          </div>
        </div>
      </div>

      <div class="style-iteration-flow-side">
        ${approvalChecklistCard}
        ${approvalDecisionCard}
      </div>
    </div>
  `
}

function summarizeSeedProtocolLines({
  referenceText = "",
  referenceWorks = [],
  desiredVibes = [],
  seedForbiddenPatterns = [],
} = {}) {
  const trimmedReferenceText = String(referenceText || "").trim()
  const works = Array.isArray(referenceWorks) ? referenceWorks.filter(Boolean) : []
  const vibes = Array.isArray(desiredVibes) ? desiredVibes.filter(Boolean) : []
  const forbidden = Array.isArray(seedForbiddenPatterns) ? seedForbiddenPatterns.filter(Boolean) : []
  return [
    trimmedReferenceText ? `参考文本锚点：${Math.min(trimmedReferenceText.length, 1800)} chars` : "",
    vibes.length ? `目标气质：${vibes.join("、")}` : "",
    works.length ? `参考作品：${works.join("、")}` : "",
    forbidden.length ? `写法禁忌：${forbidden.join("、")}` : "",
  ].filter(Boolean)
}

function styleApprovalRecommendation(selected = null) {
  const verificationStatus = String(selected?.verification?.status || "").trim()
  const overall = Number(selected?.evaluation?.scores?.overall || 0)
  const highRiskCount = Number(selected?.verification?.highRiskCount || 0)
  const forbiddenHits = Array.isArray(selected?.evaluation?.forbiddenHits) ? selected.evaluation.forbiddenHits : []
  if (verificationStatus === "blocked") {
    return "当前不建议冻结。先把 AIGC 高风险片段和禁忌命中压下去，再继续收紧写法合同。"
  }
  if (verificationStatus === "warning") {
    return "当前还不建议直接冻结。先补齐生成验证证据，再判断是否能作为整书写法。"
  }
  if (selected?.readyForApproval && overall >= 8 && highRiskCount === 0 && forbiddenHits.length === 0) {
    return "当前版本适合进入整书写法确认。只要你认可这个声音和节奏，就可以冻结为后续正文基线。"
  }
  if (selected?.readyForApproval) {
    return "当前版本已经接近可冻结状态，但仍建议对对白、节奏和风险项做最后一轮复核。"
  }
  return "当前版本还在收敛期，先继续跑 Loop，让系统把写法和风险一起压稳。"
}

function buildStyleApprovalChecklist(selected = null, loop = {}) {
  const verificationStatus = String(selected?.verification?.status || "").trim()
  const overall = Number(selected?.evaluation?.scores?.overall || 0)
  const forbiddenHits = Array.isArray(selected?.evaluation?.forbiddenHits) ? selected.evaluation.forbiddenHits : []
  const highRiskCount = Number(selected?.verification?.highRiskCount || 0)
  const hasConvergence = Boolean(
    String(selected?.convergenceNote || "").trim()
    || (Array.isArray(loop?.convergenceEvidence) && loop.convergenceEvidence.length)
  )
  return [
    {
      label: "本轮已达到可确认门槛",
      passed: Boolean(selected?.readyForApproval),
      detail: selected?.readyForApproval ? "系统已允许进入整书写法确认。" : "当前仍在 Loop 收敛阶段。",
    },
    {
      label: "AIGC 风险受控",
      passed: verificationStatus === "passed" && highRiskCount === 0,
      detail: verificationStatus === "passed"
        ? "当前没有阻塞冻结的高风险片段。"
        : verificationStatus === "blocked"
          ? `仍有 ${highRiskCount} 个高风险片段阻塞冻结。`
          : "生成验证证据还不完整。",
    },
    {
      label: "禁忌命中已压住",
      passed: forbiddenHits.length === 0,
      detail: forbiddenHits.length === 0 ? "当前没有命中禁忌模式。" : `当前仍命中 ${forbiddenHits.length} 条禁忌。`,
    },
    {
      label: "风格评分达到冻结区间",
      passed: overall >= 8,
      detail: overall > 0 ? `当前综合评分 ${overall.toFixed(1)} 分。` : "当前还没有完整评分。",
    },
    {
      label: "写法已形成收敛证据",
      passed: hasConvergence,
      detail: hasConvergence ? "本轮已经沉淀出可解释的收敛依据。" : "当前还缺少明确的收敛说明。",
    },
  ]
}

function renderStyleApprovalChecklist(selected = null, loop = {}) {
  const checklist = buildStyleApprovalChecklist(selected, loop)
  const passCount = checklist.filter((item) => item.passed).length
  const allPassed = checklist.length > 0 && passCount === checklist.length
  return `
    <div class="style-loop-card style-approval-gate-card ${allPassed ? "is-passed" : "is-warning"}">
      <div class="style-loop-section-head compact">
        <div>
          <span>Approval Gate Checklist</span>
          <small>${allPassed ? "当前可以作为整书写法进入冻结" : `已满足 ${passCount}/${checklist.length} 项，还不能盲目冻结`}</small>
        </div>
      </div>
      <div class="style-approval-checklist">
        ${checklist.map((item) => `
          <div class="style-approval-checklist-item ${item.passed ? "is-passed" : "is-pending"}">
            <div class="style-approval-checklist-top">
              <span>${escapeHtml(item.label)}</span>
              <span class="style-loop-pill is-${item.passed ? "passed" : "warning"}">${item.passed ? "通过" : "待处理"}</span>
            </div>
            <small>${escapeHtml(item.detail)}</small>
          </div>
        `).join("")}
      </div>
    </div>
  `
}

function renderStyleApprovalDecisionCard({ selected = null, approved = null, stable = null, readyVersion = 0 }) {
  const selectedVersion = Number(selected?.version || 0)
  const approvedVersion = Number(approved?.version || 0)
  const stableVersion = Number(stable?.version || 0)
  const compareTarget = approvedVersion ? approved : stableVersion && stableVersion !== selectedVersion ? stable : null
  const compareLabel = approvedVersion
    ? `对比已冻结版本 v${approvedVersion}`
    : stableVersion && stableVersion !== selectedVersion
      ? `对比稳定版本 v${stableVersion}`
      : ""
  const diffLines = compareTarget ? summarizeStyleDiffLines(compareTarget, selected) : []
  const verificationLines = summarizeGenerationVerificationLines({
    verification: selected?.verification || {},
    evaluation: selected?.evaluation || {},
  })
  const reasons = [
    selected?.readyForApproval ? "当前版本已经达到 Freeze Gate 的可确认门槛。" : "",
    selected?.userDecision === "accepted_for_freeze" ? "这个版本已被用户接受，正在等待冻结合同预览与最终确认。" : "",
    selected?.userDecision === "accepted" ? "这个版本已经被用户接受为整书写法。" : "",
    selected?.verification?.status ? `生成验证门状态：${selected.verification.status}` : "",
    selected?.convergenceNote ? `收敛说明：${selected.convergenceNote}` : "",
  ].filter(Boolean)

  return `
    <div class="style-loop-card style-approval-decision-card">
      <div class="style-loop-section-head compact">
        <div>
          <span>Whole-Book Style Approval</span>
          <small>${selectedVersion ? `当前候选 v${selectedVersion} 等待整书写法确认` : "等待选择候选版本"}</small>
        </div>
      </div>
      <div class="style-loop-subsection">
        <b>确认语义</b>
        ${renderStyleLoopList([
          "确认的不是某一段字面内容，而是整本书后续统一继承的写法底盘。",
          "一旦冻结，base prompt / style contract / forbidden patterns / positive examples / retry policy 都会成为正文生产基线。",
        ], "当前还没有审批语义说明。")}
      </div>
      <div class="style-loop-subsection">
        <b>当前整书确认判断</b>
        ${renderStyleLoopList(reasons, "当前版本还没有形成明确的审批判断。")}
      </div>
      <div class="style-loop-subsection">
        <b>生成验证依据</b>
        ${renderStyleLoopList(verificationLines, "当前还没有足够的生成验证证据。")}
      </div>
      ${compareLabel ? `
        <div class="style-loop-subsection">
          <b>${escapeHtml(compareLabel)}</b>
          ${renderStyleLoopList(diffLines, "当前版本与参考版本没有明显差异。")}
        </div>
      ` : ""}
      <div class="style-loop-subsection">
        <b>系统建议</b>
        ${renderStyleLoopList([styleApprovalRecommendation(selected)], "当前还没有审批建议。")}
      </div>
      <div class="style-loop-subsection">
        <b>一旦确认会发生什么</b>
        ${renderStyleLoopList([
          readyVersion ? `系统当前识别的可确认版本：v${readyVersion}` : "",
          selectedVersion ? `你确认的是整本书未来统一继承的写法版本 v${selectedVersion}。` : "",
          "正文生产会强制继承冻结合同，不再自由漂移。",
          "后续返工只能在已冻结的写法合同内部继续收紧。",
        ].filter(Boolean), "当前还没有冻结后的后果说明。")}
      </div>
    </div>
  `
}

function styleLoopStageCards({ seedPrompt = "", history = [], evaluation = {}, refinement = {}, verification = {}, selected = null, loop = {}, gate = {}, freezePreview = null, approvedVersion = 0, contract = {} }) {
  const hasSeed = Boolean(String(seedPrompt || "").trim())
  const hasCandidates = history.length > 0
  const hasEvaluation = Boolean(evaluation.summary || (evaluation.scores && Object.keys(evaluation.scores).length))
  const hasRefinement = Boolean(refinement.summary || refinement.nextPrompt || (Array.isArray(refinement.promptAdjustments) && refinement.promptAdjustments.length))
  const verificationStatus = String(verification?.status || loop?.verificationStatus || "pending")
  const readyForApproval = Boolean(selected?.readyForApproval || loop.readyVersion || freezePreview?.version)
  const isApproved = Boolean(approvedVersion || gate.status === "passed")
  const hasInheritance = Boolean(isApproved && Array.isArray(contract?.inheritance?.inheritedRules) && contract.inheritance.inheritedRules.length)
  const freezerVerdict = String(contract?.freezer?.verdict || selected?.freezer?.verdict || freezePreview?.freezer?.verdict || "")
  return [
    {
      label: "Seed Prompt Builder",
      detail: hasSeed ? "已构建本书写法种子" : "等待初始化风格种子",
      status: hasSeed ? "passed" : "blocked",
    },
    {
      label: "Candidate Generator",
      detail: hasCandidates ? `已产出 ${history.length} 轮候选` : "还没有进入候选生成",
      status: hasCandidates ? "passed" : "blocked",
    },
    {
      label: "Evaluator / Critic",
      detail: hasEvaluation ? "本轮已有多维评估结果" : "等待评估叙述声音、节奏、对白等维度",
      status: hasEvaluation ? "passed" : hasCandidates ? "warning" : "blocked",
    },
    {
      label: "Gate: AIGC / Generation Verification",
      detail: verificationStatus === "passed"
        ? "当前样段已通过生成验证"
        : verificationStatus === "blocked"
          ? "AIGC 风险或禁忌命中仍然阻塞"
          : verificationStatus === "warning"
            ? "验证信息还不完整"
            : "等待本轮生成验证",
      status: verificationStatus === "passed" ? "passed" : verificationStatus === "blocked" ? "blocked" : verificationStatus === "warning" ? "warning" : hasEvaluation ? "warning" : "blocked",
    },
    {
      label: "Prompt Refiner",
      detail: hasRefinement ? "已产出下一轮 prompt / 合同收紧建议" : "等待本轮反思与改写建议",
      status: hasRefinement ? "passed" : hasEvaluation ? "warning" : "blocked",
    },
    {
      label: "Loop Controller",
      detail: loop?.status ? `状态: ${styleLoopStatusLabel(loop).label}` : "等待启动",
      status: loop?.status === "running" || hasCandidates ? "passed" : "blocked",
    },
    {
      label: "User Approval Gate",
      detail: isApproved ? `已确认 v${approvedVersion || loop.approvalVersion}` : readyForApproval ? "已达到可确认门槛，等待用户放行" : "还未达到可确认门槛",
      status: isApproved ? "passed" : readyForApproval ? "warning" : "blocked",
    },
    {
      label: "Style Contract Freezer",
      detail: isApproved ? "冻结合同已形成" : freezerVerdict ? `Freezer ${freezerVerdict}` : freezePreview ? "已有冻结预演" : "尚未形成冻结合同",
      status: isApproved || freezerVerdict === "ready" ? "passed" : freezePreview || freezerVerdict ? "warning" : "blocked",
    },
    {
      label: "Chapter Inheritance Adapter",
      detail: hasInheritance ? "已准备继承到正文生产" : isApproved ? "等待继承资产完全同步" : "冻结后启用继承",
      status: hasInheritance ? "passed" : isApproved ? "warning" : "blocked",
    },
  ]
}

function styleLoopProtocolCards({
  seedPrompt = "",
  referenceText = "",
  history = [],
  candidateBatch = [],
  evaluation = {},
  refinement = {},
  verification = {},
  selected = null,
  loop = {},
  freezePreview = null,
  approvedVersion = 0,
  contract = {},
  inheritanceAssets = {},
}) {
  const verificationMeta = styleGenerationVerificationStatusMeta(verification, evaluation)
  const aigcMeta = styleAigcMeta(evaluation?.aigc)
  const selectedVersion = Number(selected?.version || 0)
  const stableVersion = Number(loop?.stableVersion || 0)
  const readyVersion = Number(loop?.readyVersion || 0)
  const inheritanceReady = [
    inheritanceAssets?.rulebook?.exists,
    inheritanceAssets?.references?.exists,
    inheritanceAssets?.antiPatterns?.exists,
  ].filter(Boolean).length
  const verificationStatus = String(verification?.status || loop?.verificationStatus || "").trim()
  const verificationSummary = String(verification?.summary || "").trim()
  const forbiddenHits = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits : []
  const contractTightening = Array.isArray(refinement?.contractAdjustments) ? refinement.contractAdjustments.length : 0
  const promptAdjustments = Array.isArray(refinement?.promptAdjustments) ? refinement.promptAdjustments.length : 0
  const seedLines = summarizeSeedProtocolLines({
    referenceText,
    referenceWorks: contract.referenceWorks,
    desiredVibes: contract.desiredVibes,
    seedForbiddenPatterns: contract.seedForbiddenPatterns,
  })
  const seedSummary = seedLines.length
    ? seedLines.slice(0, 2).join(" / ")
    : "当前主要依赖用户风格要求作为起点"
  const freezerVerdict = String(contract?.freezer?.verdict || selected?.freezer?.verdict || freezePreview?.freezer?.verdict || "").trim()
  const freezerSummary = String(contract?.freezer?.summary || selected?.freezer?.summary || freezePreview?.freezer?.summary || contract?.approval?.freezeSummary || "").trim()

  return [
    {
      stage: "01",
      title: "风格种子",
      status: seedPrompt ? "passed" : "blocked",
      detail: seedPrompt ? "seed prompt 已形成" : "等待初始化",
      meta: seedPrompt ? seedSummary : "当前主要依赖用户风格要求作为起点",
    },
    {
      stage: "02",
      title: "候选并行",
      status: history.length ? "passed" : "blocked",
      detail: history.length
        ? `${candidateBatch.length || 1} 个候选进入竞争`
        : "还没有样段候选",
      meta: stableVersion
        ? `当前稳定版本 v${stableVersion}，继续与新候选竞争`
        : "每轮先生成样段，再从候选中选出当前领先版本",
    },
    {
      stage: "03",
      title: "多维评审",
      status: evaluation?.summary ? "passed" : history.length ? "warning" : "blocked",
      detail: evaluation?.summary || "等待评审结果",
      meta: Number(evaluation?.scores?.overall || 0)
        ? `综合评分 ${Number(evaluation.scores.overall).toFixed(1)}，同时评估叙事声音、节奏、对白、信息密度`
        : "当前轮尚未得到完整评分",
    },
    {
      stage: "Gate",
      title: "AIGC / 生成验证门",
      status: verificationMeta.klass === "is-passed" ? "passed" : verificationMeta.klass === "is-blocked" ? "blocked" : "warning",
      detail: verificationSummary || verificationMeta.label,
      meta: verificationStatus === "passed"
        ? `${aigcMeta.label}，${forbiddenHits.length ? `但仍有 ${forbiddenHits.length} 条禁忌待复核` : "禁忌命中受控"}`
        : verificationStatus === "blocked"
          ? `${aigcMeta.label}，${Number(verification?.highRiskCount || 0)} 个高风险片段阻塞放行`
          : "AIGC 检测与禁忌命中会一起决定这轮是否允许继续靠近冻结",
    },
    {
      stage: "04",
      title: "反思收紧",
      status: refinement?.nextPrompt || promptAdjustments || contractTightening ? "passed" : verificationStatus === "passed" ? "warning" : "blocked",
      detail: refinement?.summary || "等待系统反思如何收紧 prompt 与 style contract",
      meta: refinement?.nextPrompt
        ? `${promptAdjustments} 条 prompt 调整 / ${contractTightening} 条合同收紧`
        : "这一层读取评审与生成验证结论，再决定下一轮该怎么写得更像目标作品而不是更像模型",
    },
    {
      stage: "05",
      title: "Loop Controller",
      status: loop?.readyVersion || loop?.stableVersion || loop?.currentIteration ? "passed" : history.length ? "warning" : "blocked",
      detail: loop?.readyVersion ? `可确认 v${loop.readyVersion}` : loop?.stableVersion ? `稳定 v${loop.stableVersion}` : loop?.currentIteration ? `已运行 ${Number(loop.currentIteration)} 轮` : "等待 Loop 运行",
      meta: loop?.convergence
        ? `收敛状态：${styleLoopConvergenceLabel(loop.convergence)}；Generation Verification Gate 作为放行门同步参与判断`
        : "读取评估、验证和反思结果，决定继续迭代、进入确认或退回收紧",
    },
    {
      stage: "06",
      title: "整书写法确认",
      status: approvedVersion ? "passed" : readyVersion ? "warning" : "blocked",
      detail: approvedVersion ? `用户已确认 v${approvedVersion}` : readyVersion ? `当前待确认 v${readyVersion}` : "还未到可确认门槛",
      meta: approvedVersion
        ? "确认的是整本书后续统一继承的写法，不是单一示例段落"
        : selectedVersion
          ? `当前审阅焦点 v${selectedVersion}，只有稳定通过验证后才允许用户拍板`
          : "先让样段通过评审和验证，再谈用户确认",
    },
    {
      stage: "07",
      title: "Style Contract Freezer",
      status: approvedVersion || freezerVerdict === "ready" ? "passed" : freezePreview?.version || freezerVerdict ? "warning" : "blocked",
      detail: approvedVersion ? `合同已冻结 v${approvedVersion}` : freezerVerdict ? `Freezer ${freezerVerdict}` : freezePreview?.version ? `已有冻结预演 v${freezePreview.version}` : "尚未形成冻结合同",
      meta: freezerSummary || "Freezer 必须把用户确认样段提炼为可执行合同，并明确 verdict=ready",
    },
    {
      stage: "08",
      title: "章节继承适配器",
      status: approvedVersion && inheritanceReady >= 3 ? "passed" : approvedVersion || inheritanceReady > 0 ? "warning" : "blocked",
      detail: approvedVersion ? `继承资产同步 ${inheritanceReady}/3` : "冻结后启用继承",
      meta: approvedVersion
        ? "章节生产会强制继承 rulebook、references 与 anti-patterns"
        : "冻结后才会把写法底盘下发给正文生产链",
    },
  ]
}

function renderStyleLoopStageRail(cards = []) {
  return `
    <div class="style-loop-stage-rail">
      ${cards.map((card) => `
        <div class="style-loop-stage-card is-${card.status || "blocked"}">
          <span>${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.detail)}</strong>
        </div>
      `).join("")}
    </div>
  `
}

function renderStyleLoopProtocolGrid(cards = []) {
  return `
    <div class="style-loop-protocol-grid">
      ${cards.map((card) => `
        <div class="style-loop-protocol-card is-${card.status || "blocked"}">
          <div class="style-loop-protocol-top">
            <span class="style-loop-protocol-stage">${escapeHtml(card.stage || "--")}</span>
            <span class="style-loop-pill is-${card.status || "blocked"}">${escapeHtml(card.title || "未命名阶段")}</span>
          </div>
          <strong>${escapeHtml(card.detail || "等待状态")}</strong>
          <small>${escapeHtml(card.meta || "当前没有额外说明。")}</small>
        </div>
      `).join("")}
    </div>
  `
}

function renderStyleGateNextActions({ gate = {}, selected = null, loop = {}, freezePreview = null, evaluation = {} }) {
  if (gate.status === "passed") {
    return `
      <div class="style-loop-action-list">
        <div class="style-loop-action-item is-primary">
          <strong>Style Contract Freeze Gate 已通过</strong>
          <span>当前写法合同已经冻结，后续章节会强制继承这套基线，包括基础 prompt、style contract、禁忌模式与重试策略。</span>
        </div>
      </div>
    `
  }

  const actions = []
  if (!selected?.sample) {
    actions.push({
      title: "优先动作: 运行 Loop",
      detail: "先运行 Candidate Generator，至少产出一版可评估的正文样段，再进入评估与收敛。",
      primary: true,
    })
  } else if (selected?.sample && !selected?.readyForApproval && !loop.readyVersion) {
    const reasons = [
      evaluation?.summary,
      Array.isArray(evaluation?.deviations) && evaluation.deviations.length ? `偏差: ${evaluation.deviations.slice(0, 2).join("；")}` : "",
      Array.isArray(evaluation?.forbiddenHits) && evaluation.forbiddenHits.length ? `禁忌命中: ${evaluation.forbiddenHits.slice(0, 2).join("；")}` : "",
      loop?.stableRounds ? `当前稳定轮次 ${loop.stableRounds}` : "",
    ].filter(Boolean).join(" | ")
    actions.push({
      title: "优先动作: 继续收敛",
      detail: `当前样段还没达到 Freeze Gate 的确认门槛，需要继续迭代收紧 prompt 和 style contract。${reasons ? ` ${reasons}` : ""}`,
      primary: true,
    })
  } else if ((selected?.readyForApproval || loop.readyVersion) && !freezePreview) {
    actions.push({
      title: "优先动作: 预览冻结合同",
      detail: "当前已经接近放行，可以先预览 Style Contract Freeze Gate，检查冻结后会沉淀哪些资产与章节继承规则。",
      primary: true,
    })
  } else if ((selected?.readyForApproval || loop.readyVersion || freezePreview?.version) && gate.status !== "passed") {
    actions.push({
      title: "优先动作: 接受本轮后冻结全书合同",
      detail: "先确认当前样段是否能代表整本书写法，再执行 Style Contract Freezer。冻结后章节生产会继承同一套风格基线。",
      primary: true,
    })
  }

  if (selected?.sample && !freezePreview) {
    actions.push({
      title: "检查冻结资产",
      detail: "确认冻结摘要中已经包含 base writing prompt、style contract、正向例子、禁忌模式与 retry policy。",
      primary: false,
    })
  }

  if (selected?.sample && gate.status !== "passed") {
    actions.push({
      title: "确认范围",
      detail: "用户确认的是整本书的统一写法，不是当前单次调用碰巧写得顺眼的一段。",
      primary: false,
    })
  }

  if (!actions.length) {
    return renderStyleLoopList([], "当前没有额外的下一步动作。")
  }

  return `
    <div class="style-loop-action-list">
      ${actions.map((item) => `
        <div class="style-loop-action-item ${item.primary ? "is-primary" : ""}">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.detail)}</span>
        </div>
      `).join("")}
    </div>
  `
}

function renderRuntimeSignalGrid({ loop = {}, loopRuntime = null, retryPolicy = {}, history = [] }) {
  return `
    <div class="style-loop-runtime-grid">
      <div class="style-loop-runtime-card">
        <span>Prompt Loop Runtime</span>
        <strong>${escapeHtml(loopRuntime?.status || loop.status || "idle")}</strong>
        <small>${loopRuntime?.stopReason ? `停止原因：${loopRuntime.stopReason}` : "等待正式 Loop Run"}</small>
      </div>
      <div class="style-loop-runtime-card">
        <span>当前迭代</span>
        <strong>${Number(loop.currentIteration || history.length || 0)}</strong>
        <small>${loop.readyVersion ? `可确认 v${loop.readyVersion}` : "尚未达到确认门"}</small>
      </div>
      <div class="style-loop-runtime-card">
        <span>收敛判定</span>
        <strong>${escapeHtml(styleLoopConvergenceLabel(loop.convergence))}</strong>
        <small>${loop.stableVersion ? `稳定 v${loop.stableVersion}` : "尚未形成稳定版本"}</small>
      </div>
      <div class="style-loop-runtime-card">
        <span>Retry Policy</span>
        <strong>${escapeHtml(styleRetryPolicyRows(retryPolicy).slice(0, 1).join("") || "待定义")}</strong>
        <small>${escapeHtml(styleRetryPolicyRows(retryPolicy).slice(1, 3).join(" / ") || "等待策略同步")}</small>
      </div>
    </div>
  `
}

function renderStyleEngineCockpit({
  gateMeta = {},
  loopMeta = {},
  loop = {},
  loopRuntime = null,
  verification = {},
  selected = null,
  freezePreview = null,
  approvedVersion = 0,
  contract = {},
  retryPolicy = {},
}) {
  const verificationMeta = styleGenerationVerificationStatusMeta(verification, selected?.evaluation || {})
  const verificationLines = summarizeGenerationVerificationLines({
    verification,
    evaluation: selected?.evaluation || {},
    fallbackStatus: loop?.verificationStatus,
    fallbackSummary: loopRuntime?.verificationSummary,
  })
  const inheritanceRules = Array.isArray(contract?.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules : []
  const nextAction = styleApprovalRecommendation(selected)
  const freezeStatusLabel = approvedVersion
    ? `已冻结 v${approvedVersion}`
    : freezePreview?.version
      ? `预演 v${freezePreview.version}`
      : loop?.readyVersion
        ? `待确认 v${loop.readyVersion}`
        : "尚未冻结"
  const loopModeLabel = loopRuntime?.iterations?.length
    ? `最近一次正式 run ${loopRuntime.iterations.length} 轮`
    : loop?.currentIteration
      ? `当前累计 ${Number(loop.currentIteration)} 轮`
      : "等待首次 Loop"
  const controllerPolicy = styleRetryPolicyRows(retryPolicy).slice(0, 2)
  const seedLines = summarizeSeedProtocolLines({
    referenceText: contract?.referenceText,
    referenceWorks: contract?.referenceWorks,
    desiredVibes: contract?.desiredVibes,
    seedForbiddenPatterns: contract?.seedForbiddenPatterns,
  })

  return `
    <div class="style-engine-cockpit">
      <div class="style-engine-cockpit-hero">
        <div class="style-engine-cockpit-title">
          <span>Engine Cockpit</span>
          <strong>${escapeHtml(loopMeta.label)} · ${escapeHtml(styleLoopConvergenceLabel(loop.convergence))}</strong>
          <small>把 Prompt Loop Runtime、Generation Verification Gate、Freeze Gate 和正文继承信号放到一个主驾驶舱里，不用翻很多卡片才能判断现在该做什么。</small>
        </div>
        <div class="style-engine-cockpit-pills">
          <span class="style-loop-pill ${gateMeta.klass || "is-blocked"}">${escapeHtml(gateMeta.label || "阻塞正文")}</span>
          <span class="style-loop-pill ${loopMeta.klass || "is-blocked"}">${escapeHtml(loopModeLabel)}</span>
          <span class="style-loop-pill ${verificationMeta.klass}">${escapeHtml(verificationMeta.label)}</span>
          <span class="style-loop-pill ${approvedVersion ? "is-passed" : freezePreview?.version || loop?.readyVersion ? "is-warning" : "is-blocked"}">${escapeHtml(freezeStatusLabel)}</span>
        </div>
      </div>
      <div class="style-engine-cockpit-grid">
        <div class="style-engine-cockpit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Seed Protocol</span>
              <small>${escapeHtml(seedLines.length ? `${seedLines.length} 条种子约束` : "待补充")}</small>
            </div>
          </div>
          ${renderStyleLoopList(seedLines, "现在还没有把参考作品、目标气质、写法禁忌明确写进种子协议。")}
        </div>
        <div class="style-engine-cockpit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Prompt Loop Runtime</span>
              <small>${escapeHtml(loopRuntime?.status || loop?.status || "idle")}</small>
            </div>
          </div>
          ${renderStyleLoopList([
            `当前迭代：${Number(loop.currentIteration || 0) || 0}`,
            loop?.stableVersion ? `稳定版本：v${loop.stableVersion}` : "",
            loop?.readyVersion ? `可确认版本：v${loop.readyVersion}` : "",
            loopRuntime?.stopReason ? `停止原因：${loopRuntime.stopReason}` : "",
            ...controllerPolicy,
          ].filter(Boolean), "Loop Runtime 还没有形成正式运行轨迹。")}
        </div>
        <div class="style-engine-cockpit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Generation Verification Gate</span>
              <small>${escapeHtml(verification?.status || "pending")}</small>
            </div>
          </div>
          ${renderStyleLoopList(verificationLines, "当前还没有足够的生成验证证据。")}
        </div>
        <div class="style-engine-cockpit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Freeze Gate</span>
              <small>${escapeHtml(freezeStatusLabel)}</small>
            </div>
          </div>
          ${renderStyleLoopList([
            approvedVersion ? `当前正式写法合同来自 v${approvedVersion}` : "",
            freezePreview?.freezeSummary ? `预演摘要：${freezePreview.freezeSummary}` : "",
            contract?.approval?.freezeSummary ? `正式摘要：${contract.approval.freezeSummary}` : "",
            selected?.readyForApproval ? "当前轮达到可确认门槛。" : "",
            selected?.convergenceNote ? `收敛说明：${selected.convergenceNote}` : "",
          ].filter(Boolean), "还没有形成可以冻结整本书写法的合同。")}
        </div>
        <div class="style-engine-cockpit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Chapter Inheritance Adapter</span>
              <small>${escapeHtml(contract?.inheritance?.status || "pending")}</small>
            </div>
          </div>
          ${renderStyleLoopList([
            approvedVersion ? "后续正文必须继承冻结合同。" : "",
            ...inheritanceRules.slice(0, 4),
            !approvedVersion && nextAction ? `当前建议：${nextAction}` : "",
          ].filter(Boolean), "冻结前不会放行章节正文自由发挥。")}
        </div>
      </div>
    </div>
  `
}

function renderEngineComponentGrid({
  seedPrompt = "",
  history = [],
  evaluation = {},
  refinement = {},
  verification = {},
  selected = null,
  loop = {},
  gate = {},
  freezePreview = null,
  approvedVersion = 0,
  contract = {},
  freezeLedger = {},
  freezeAssets = {},
  inheritanceAssets = {},
}) {
  const hasSeed = Boolean(String(seedPrompt || "").trim())
  const hasCandidates = history.length > 0
  const hasEvaluation = Boolean(evaluation.summary || (evaluation.scores && Object.keys(evaluation.scores).length))
  const hasRefinement = Boolean(refinement.summary || refinement.nextPrompt || (Array.isArray(refinement.promptAdjustments) && refinement.promptAdjustments.length))
  const verificationStatus = String(verification?.status || loop?.verificationStatus || "pending")
  const readyForApproval = Boolean(selected?.readyForApproval || loop.readyVersion || freezePreview?.version)
  const isApproved = Boolean(approvedVersion || gate.status === "passed")
  const frozenBasePromptReady = Boolean(String(contract?.frozenBasePrompt || freezePreview?.frozenBasePrompt || "").trim())
  const styleContractReady = Boolean((contract?.styleContract && Object.keys(contract.styleContract).length) || (freezePreview?.styleContract && Object.keys(freezePreview.styleContract).length))
  const freezePackageReady = Boolean(
    freezeAssets?.approvedSample?.exists
    || freezeAssets?.freezeLedger?.exists
    || freezeAssets?.loopRuntime?.exists
  )
  const inheritanceReadyCount = [
    inheritanceAssets?.rulebook?.exists,
    inheritanceAssets?.references?.exists,
    inheritanceAssets?.antiPatterns?.exists,
  ].filter(Boolean).length
  const inheritanceReadyForChapters = Boolean(isApproved && inheritanceReadyCount >= 3)
  const convergenceEvidence = Array.isArray(loop?.convergenceEvidence) ? loop.convergenceEvidence.length : 0
  const freezeArtifactCount = Array.isArray(freezeLedger?.inheritedArtifacts) ? freezeLedger.inheritedArtifacts.length : 0

  const rows = [
    {
      label: "Seed Prompt Builder",
      status: hasSeed ? "passed" : "blocked",
      detail: hasSeed ? "已初始化写法种子" : "等待初始化",
      meta: hasSeed ? "用户风格要求与参考已进入引擎" : "缺少种子 prompt",
    },
    {
      label: "Candidate Generator",
      status: hasCandidates ? "passed" : "blocked",
      detail: hasCandidates ? `已产出 ${history.length} 轮` : "未生成候选",
      meta: hasCandidates ? "支持多轮样段竞争" : "还没有候选样段",
    },
    {
      label: "Evaluator / Critic",
      status: hasEvaluation ? "passed" : hasCandidates ? "warning" : "blocked",
      detail: hasEvaluation ? "多维评分已落地" : "等待评估",
      meta: hasEvaluation ? `${styleScoreRows(evaluation).length} 个有效评分维度` : "叙述声音 / 节奏 / 对白等维度尚未成形",
    },
    {
      label: "Generation Verification Gate",
      status: verificationStatus === "passed" ? "passed" : verificationStatus === "blocked" ? "blocked" : verificationStatus === "warning" ? "warning" : hasEvaluation ? "warning" : "blocked",
      detail: verificationStatus === "passed" ? "验证已通过" : verificationStatus === "blocked" ? "验证阻塞" : verificationStatus === "warning" ? "验证待补证" : "等待验证",
      meta: verification?.summary || loop?.verificationSummary || "会综合 AIGC 风险、禁忌命中与高风险片段来决定能否继续放行。",
    },
    {
      label: "Prompt Refiner",
      status: hasRefinement ? "passed" : verificationStatus === "passed" ? "warning" : "blocked",
      detail: hasRefinement ? "已有收紧建议" : "等待改写建议",
      meta: hasRefinement ? `${Array.isArray(refinement.promptAdjustments) ? refinement.promptAdjustments.length : 0} 条 prompt 调整` : "读取评审与生成验证结论后，才形成下一轮 prompt。",
    },
    {
      label: "Loop Controller",
      status: loop?.status === "running" || hasCandidates ? "passed" : "blocked",
      detail: loop?.status ? `状态: ${styleLoopStatusLabel(loop).label}` : "等待启动",
      meta: `稳定证据 ${convergenceEvidence} 条 / 收紧次数 ${Number(loop?.tighteningCount || 0)}`,
    },
    {
      label: "User Approval Gate",
      status: isApproved ? "passed" : readyForApproval ? "warning" : "blocked",
      detail: isApproved ? `已确认 v${approvedVersion || loop?.approvalVersion || "-"}` : readyForApproval ? "等待用户确认" : "未达确认门槛",
      meta: readyForApproval ? "用户确认的是整本书未来统一写法" : "还不能确认整本书写法",
    },
    {
      label: "Style Contract Freezer",
      status: isApproved && frozenBasePromptReady && styleContractReady ? "passed" : freezePreview ? "warning" : "blocked",
      detail: isApproved ? "冻结合同已形成" : freezePreview ? "已有冻结预演" : "尚未冻结",
      meta: `${freezeArtifactCount} 类冻结资产 / ${freezePackageReady ? "已写入资产包" : "资产包未齐"}`,
    },
    {
      label: "Chapter Inheritance Adapter",
      status: inheritanceReadyForChapters ? "passed" : inheritanceReadyCount > 0 ? "warning" : "blocked",
      detail: inheritanceReadyForChapters ? "冻结后继承链已就绪" : inheritanceReadyCount > 0 ? "继承资产已预备" : "尚未形成继承链",
      meta: inheritanceReadyForChapters
        ? `rulebook / references / anti-patterns: ${inheritanceReadyCount}/3`
        : approvedVersion
          ? `已冻结，但继承资产仍是 ${inheritanceReadyCount}/3`
          : `冻结前仅做继承预备：${inheritanceReadyCount}/3`,
    },
  ]

  return `
    <div class="style-engine-component-grid">
      ${rows.map((row) => `
        <div class="style-engine-component-card is-${row.status}">
          <div class="style-engine-component-top">
            <span>${escapeHtml(row.label)}</span>
            <span class="style-loop-pill is-${row.status}">${escapeHtml(row.detail)}</span>
          </div>
          <strong>${escapeHtml(row.meta)}</strong>
        </div>
      `).join("")}
    </div>
  `
}

function renderFreezeInheritanceBridge({
  freezePreview = null,
  approvedVersion = 0,
  contract = {},
  freezeLedger = {},
  freezeAssets = {},
  inheritanceAssets = {},
}) {
  const previewArtifactCount = Array.isArray(freezePreview?.inheritedArtifacts) ? freezePreview.inheritedArtifacts.length : 0
  const frozenArtifactCount = Array.isArray(contract?.inheritance?.inheritedArtifacts) ? contract.inheritance.inheritedArtifacts.length : 0
  const verificationSummary = contract?.verification?.summary || freezeLedger?.verificationSummary || ""
  const verificationReasons = Array.isArray(contract?.verification?.reasons) && contract.verification.reasons.length
    ? contract.verification.reasons
    : Array.isArray(freezeLedger?.verificationReasons) ? freezeLedger.verificationReasons : []
  const inheritanceReady = [
    inheritanceAssets?.rulebook?.exists ? "style/rulebook.md" : "",
    inheritanceAssets?.references?.exists ? "style/references.md" : "",
    inheritanceAssets?.antiPatterns?.exists ? "style/anti-patterns.md" : "",
  ].filter(Boolean)
  const chapterInheritanceEvidenceRows = buildChapterInheritanceEvidenceRows({
    approvedVersion,
    contract,
    freezeAssets,
    inheritanceAssets,
  })

  return `
    <div class="style-freeze-bridge-grid">
      <div class="style-loop-card">
        <div class="style-loop-section-head compact">
          <div>
            <span>Style Contract Freezer</span>
            <small>${freezePreview?.version ? `当前预演 v${freezePreview.version}` : approvedVersion ? `当前正式版本 v${approvedVersion}` : "等待冻结"}</small>
          </div>
        </div>
        ${renderStyleLoopList([
          freezePreview?.freezeSummary ? `预演摘要：${freezePreview.freezeSummary}` : "",
          contract?.approval?.freezeSummary ? `正式摘要：${contract.approval.freezeSummary}` : "",
          previewArtifactCount ? `预演继承资产：${previewArtifactCount} 项` : "",
          frozenArtifactCount ? `正式继承资产：${frozenArtifactCount} 项` : "",
        ].filter(Boolean), "冻结器还没有形成完整合同。")}
      </div>
      <div class="style-loop-card">
        <div class="style-loop-section-head compact">
          <div>
            <span>Generation Verification Gate</span>
            <small>${escapeHtml(contract?.verification?.status || freezeLedger?.verificationStatus || "pending")}</small>
          </div>
        </div>
        ${renderStyleLoopList([
          verificationSummary,
          ...verificationReasons,
        ].filter(Boolean), "验证门还没有沉淀出可冻结的验证摘要。")}
      </div>
      <div class="style-loop-card">
        <div class="style-loop-section-head compact">
          <div>
            <span>Chapter Inheritance Adapter</span>
            <small>${escapeHtml(contract?.inheritance?.status || "pending")}</small>
          </div>
        </div>
        ${renderStyleLoopList([
          ...(Array.isArray(contract?.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules : []),
          ...inheritanceReady.map((item) => `已落地：${item}`),
        ], "继承适配器还没有把冻结合同同步到章节生产。")}
      </div>
      <div class="style-loop-card">
        <div class="style-loop-section-head compact">
          <div>
            <span>Chapter Production Handoff</span>
            <small>${approvedVersion ? "后续正文必须继承" : "正文生产仍被门禁阻塞"}</small>
          </div>
        </div>
        ${renderStyleLoopList([
          approvedVersion ? `当前正式写法版本：v${approvedVersion}` : "",
          contract?.frozenBasePrompt ? "base writing prompt 已冻结" : "",
          freezeAssets?.freezeLedger?.exists ? "freeze ledger 已写入" : "",
          freezeAssets?.loopRuntime?.exists ? "loop runtime 已写入" : "",
          inheritanceAssets?.rulebook?.exists ? "章节规则书已同步" : "",
          inheritanceAssets?.references?.exists ? "正向参考已同步" : "",
          inheritanceAssets?.antiPatterns?.exists ? "禁忌模式已同步" : "",
          Array.isArray(freezeLedger?.convergenceEvidence) && freezeLedger.convergenceEvidence.length ? `收敛证据 ${freezeLedger.convergenceEvidence.length} 条` : "",
        ].filter(Boolean), "当前还没有形成足够的冻结与继承证据，正文生产不应该放行。")}
      </div>
      <div class="style-loop-card style-loop-card-span-full">
        <div class="style-loop-section-head compact">
          <div>
            <span>Chapter Inheritance Evidence</span>
            <small>${approvedVersion ? "冻结资产是否真的下发到了章节生产" : "冻结前只允许继承预备，不允许正式继承"}</small>
          </div>
        </div>
        ${renderStyleLoopList(chapterInheritanceEvidenceRows, "当前还没有形成章节继承证据。")}
      </div>
    </div>
  `
}

function renderStyleDecisionLab({
  selected = null,
  approved = null,
  stable = null,
  candidateBatch = [],
  freezePreview = null,
  contract = {},
  loading = false,
}) {
  const selectedVersion = Number(selected?.version || 0)
  const approvedVersion = Number(approved?.version || 0)
  const stableVersion = Number(stable?.version || 0)
  const compareReference = approvedVersion
    ? approved
    : stableVersion && stableVersion !== selectedVersion
      ? stable
      : null
  const compareLabel = approvedVersion
    ? `当前候选 vs 已冻结 v${approvedVersion}`
    : stableVersion && stableVersion !== selectedVersion
      ? `当前候选 vs 稳定版本 v${stableVersion}`
      : "当前候选 vs 当前冻结预演"
  const diffLines = compareReference
    ? summarizeStyleDiffLines(compareReference, selected)
    : summarizeStyleDiffLines(freezePreview || {}, selected || {})
  const selectedEvaluation = selected?.evaluation || {}
  const selectedVerification = selected?.verification || {}
  const selectedAigc = selectedEvaluation?.aigc || {}
  const selectedPrompt = String(selected?.prompt || "").trim()
  const selectedSample = String(selected?.sample || "").trim()
  const approvedSample = String(approved?.sample || "").trim()
  const stableSample = String(stable?.sample || "").trim()
  const freezePreviewSample = String(freezePreview?.sample || "").trim()
  const referenceCandidate = compareReference || freezePreview || null
  const referencePrompt = String(referenceCandidate?.prompt || approved?.prompt || stable?.prompt || "").trim()
  const referenceSample = String(referenceCandidate?.sample || "").trim()
  const referenceLabel = approvedVersion
    ? `已冻结 v${approvedVersion}`
    : stableVersion && stableVersion !== selectedVersion
      ? `稳定版本 v${stableVersion}`
      : freezePreview?.version
        ? `冻结预演 v${freezePreview.version}`
        : "当前参考版本"
  const selectedVersionSet = new Set([Number(selectedVersion || 0)].filter(Boolean))
  const rankedCandidates = candidateBatch.length
    ? candidateBatch
        .slice()
        .sort((left, right) => Number(right?.evaluation?.scores?.overall || 0) - Number(left?.evaluation?.scores?.overall || 0))
    : []
  const runtimeWinningReason = String(
    dashboardState.styleEvolution?.loopRuntime?.iterations?.find?.((entry) => {
      if (!Array.isArray(entry?.candidates)) return false
      return entry.candidates.some((candidate) => styleCandidatePersistedVersion(candidate) === selectedVersion)
    })?.winningReason
    || "",
  ).trim()
  const fallbackHistoryCandidates = !rankedCandidates.length
    ? [selected, stable, approved]
        .filter(Boolean)
        .filter((entry, index, list) => list.findIndex((item) => Number(item?.version || 0) === Number(entry?.version || 0)) === index)
        .map((candidate) => {
          const version = Number(candidate?.version || 0)
          const overall = Number(candidate?.evaluation?.scores?.overall || 0)
          const verdict = String(candidate?.evaluation?.verdict || "pending")
          const riskCount = Number(candidate?.evaluation?.aigc?.highRiskCount || 0)
          const forbiddenCount = Array.isArray(candidate?.evaluation?.forbiddenHits) ? candidate.evaluation.forbiddenHits.length : 0
          const summary = String(candidate?.evaluation?.summary || "").trim()
          const isSelected = selectedVersionSet.has(version)
          return `
            <button
              class="style-candidate-selector-card ${isSelected ? "is-selected" : ""}"
              type="button"
              data-style-select-version="${version}"
            >
              <div class="style-candidate-selector-top">
                <strong>v${version || "-"}</strong>
                <span class="style-loop-pill is-${verdict === "approve" ? "passed" : verdict === "candidate" ? "warning" : "blocked"}">${escapeHtml(verdict)}</span>
              </div>
              <div class="style-candidate-selector-meta">
                <span>${overall ? `${overall.toFixed(1)} 分` : "未评分"}</span>
                <span>${riskCount ? `${riskCount} 个高风险片段` : "AIGC 风险受控"}</span>
                <span>${forbiddenCount ? `${forbiddenCount} 条禁忌` : "无禁忌命中"}</span>
              </div>
              <small>${escapeHtml(summary || "当前版本还没有评估摘要。")}</small>
            </button>
          `
        })
    : []
  const candidateSelectorCards = rankedCandidates.map((candidate) => {
    const version = styleCandidatePersistedVersion(candidate)
    const overall = Number(candidate?.evaluation?.scores?.overall || 0)
    const verdict = String(candidate?.evaluation?.verdict || "pending")
    const verification = candidate?.verification || {}
    const riskCount = Number(verification?.highRiskCount || candidate?.evaluation?.aigc?.highRiskCount || 0)
    const forbiddenCount = Number(verification?.forbiddenHitCount || (Array.isArray(candidate?.evaluation?.forbiddenHits) ? candidate.evaluation.forbiddenHits.length : 0))
    const summary = String(candidate?.evaluation?.summary || "").trim()
    const diagnosticsRows = styleCandidateDiagnosticsRows(candidate, {
      selectedSample,
      winningReason: runtimeWinningReason,
    })
    const isSelected = selectedVersionSet.has(version)
    const isPersisted = version > 0
    const shellTag = isPersisted
      ? `button type="button" data-style-select-version="${version}"`
      : `div role="group" aria-label="未落盘候选诊断"`
    return `
      <${shellTag}
        class="style-candidate-selector-card ${isSelected ? "is-selected" : ""} ${isPersisted ? "" : "is-readonly"}"
      >
        <div class="style-candidate-selector-top">
          <strong>${isPersisted ? `v${version}` : candidate?.candidateIndex ? `候选 #${candidate.candidateIndex}` : "未落盘候选"}</strong>
          <span class="style-loop-pill is-${verification?.status === "passed" || verdict === "approve" ? "passed" : verdict === "candidate" ? "warning" : "blocked"}">${escapeHtml(verification?.status || verdict)}</span>
        </div>
        <div class="style-candidate-selector-meta">
          <span>${overall ? `${overall.toFixed(1)} 分` : "未评分"}</span>
          <span>${riskCount ? `${riskCount} 个高风险片段` : "AIGC 风险受控"}</span>
          <span>${forbiddenCount ? `${forbiddenCount} 条禁忌` : "无禁忌命中"}</span>
        </div>
        <small>${escapeHtml(summary || verification?.summary || (isPersisted ? "当前候选还没有评估摘要。" : "该候选仅保存在 Runtime 诊断里，不能直接冻结。"))}</small>
        <div class="style-candidate-diagnostics">
          ${diagnosticsRows.slice(0, 4).map((row) => `<span>${escapeHtml(row)}</span>`).join("")}
        </div>
        ${!isPersisted ? `<small class="style-candidate-readonly-note">未写入正式候选历史。可参考失败原因后重跑 Loop，或复制样段手工补录。</small>` : ""}
      </${isPersisted ? "button" : "div"}>
    `
  })
  const selectedSignals = [
    selectedVersion ? `当前审阅版本：v${selectedVersion}` : "",
    selected?.readyForApproval ? "已达到可确认门槛。" : "",
    selectedEvaluation?.summary ? `评估摘要：${selectedEvaluation.summary}` : "",
    selectedVerification?.summary ? `验证摘要：${selectedVerification.summary}` : "",
    typeof selectedVerification?.score === "number" ? `AIGC 概率：${Number(selectedVerification.score).toFixed(3)}` : "",
    typeof selectedVerification?.threshold === "number" ? `风险阈值：${Number(selectedVerification.threshold).toFixed(3)}` : "",
    selectedVerification?.highRiskCount ? `高风险片段：${Number(selectedVerification.highRiskCount)} 个` : "",
    Array.isArray(selectedEvaluation?.forbiddenHits) && selectedEvaluation.forbiddenHits.length
      ? `禁忌命中：${selectedEvaluation.forbiddenHits.join("；")}`
      : "禁忌命中：无",
  ].filter(Boolean)
  const selectedRiskPreviews = Array.isArray(selectedAigc?.highRiskPreviews) ? selectedAigc.highRiskPreviews : []
  const actionState = styleCandidateActionState(selected)
  const frozenSummaryRows = [
    approvedVersion ? `正式冻结版本：v${approvedVersion}` : "",
    contract?.approval?.freezeSummary ? `正式冻结摘要：${contract.approval.freezeSummary}` : "",
    freezePreview?.version ? `冻结预演版本：v${freezePreview.version}` : "",
    freezePreview?.freezeSummary ? `预演摘要：${freezePreview.freezeSummary}` : "",
    contract?.frozenBasePrompt ? "base writing prompt 已冻结" : "",
    Array.isArray(contract?.styleContract?.forbiddenPatterns) && contract.styleContract.forbiddenPatterns.length
      ? `冻结禁忌：${contract.styleContract.forbiddenPatterns.slice(0, 3).join("；")}`
      : "",
  ].filter(Boolean)
  const comparePanels = [
    {
      title: selectedVersion ? `当前审阅 v${selectedVersion}` : "当前审阅版本",
      subtitle: selectedEvaluation?.summary || "当前焦点版本",
      sample: selectedSample,
      prompt: selectedPrompt,
    },
    {
      title: referenceLabel,
      subtitle: compareLabel,
      sample: referenceSample,
      prompt: referencePrompt,
    },
    {
      title: freezePreview?.version ? `冻结预演 v${freezePreview.version}` : "冻结预演",
      subtitle: freezePreview?.freezeSummary || "确认前先看系统准备冻结什么",
      sample: freezePreviewSample || approvedSample || stableSample,
      prompt: String(freezePreview?.frozenBasePrompt || contract?.frozenBasePrompt || "").trim(),
    },
  ]

  return `
    <div class="style-loop-section">
      <div class="style-loop-section-head">
        <div>
          <span>Decision Lab</span>
          <small>把候选竞争、AIGC 放行、冻结预演和正式合同并排对照，帮助你决定这轮该继续收紧还是正式冻结</small>
        </div>
      </div>
      <div class="style-loop-card style-decision-lab-toolbar">
        <div class="style-loop-section-head compact">
          <div>
            <span>Decision Actions</span>
            <small>先切换审阅版本，再决定是继续 Loop、预演冻结，还是直接冻结为整书写法合同</small>
          </div>
        </div>
        <div class="style-evolution-actions style-decision-lab-actions-row">
          <button class="btn-command style-generate-button" type="button" data-style-generate-candidate ${loading ? "disabled" : ""}>
            <i class="fa-solid fa-wand-magic-sparkles"></i> 运行 Loop
          </button>
          <button class="btn-command" type="button" data-style-save-candidate ${styleActionDisabledAttr(actionState, loading, "save")} title="${escapeHtml(styleActionTitle(actionState, "save"))}">
            <i class="fa-solid fa-floppy-disk"></i> 手工补录
          </button>
        </div>
      </div>
      <div class="style-decision-lab-grid">
        <div class="style-loop-card style-decision-lab-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>候选竞争看板</span>
              <small>${rankedCandidates.length ? `${rankedCandidates.length} 个候选参与竞争` : "当前没有并行候选，回退展示关键历史版本"}</small>
            </div>
          </div>
          ${(candidateSelectorCards.length || fallbackHistoryCandidates.length)
            ? `<div class="style-candidate-selector-grid">${candidateSelectorCards.join("")}</div>`
            : renderStyleLoopList([], "当前还没有本轮候选对比。")}
          ${!candidateSelectorCards.length && fallbackHistoryCandidates.length
            ? `<div class="style-candidate-selector-grid">${fallbackHistoryCandidates.join("")}</div>`
            : ""}
        </div>
        <div class="style-loop-card style-decision-lab-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>AIGC 放行舱</span>
              <small>${escapeHtml(selectedVerification?.status || "pending")}</small>
            </div>
          </div>
          ${renderStyleLoopList([
            ...selectedSignals,
            ...selectedRiskPreviews.map((item) => `高风险摘录：${item}`),
          ], "当前还没有足够的放行信号。")}
        </div>
        <div class="style-loop-card style-decision-lab-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>${escapeHtml(compareLabel)}</span>
              <small>${compareReference ? "看差异，不凭感觉拍板" : "当前没有现成参考版本时，至少对照冻结预演"}</small>
            </div>
          </div>
          ${renderStyleLoopList(diffLines, "当前候选与参考版本没有明显结构性差异。")}
        </div>
        <div class="style-loop-card style-decision-lab-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>冻结前后对照</span>
              <small>${approvedVersion ? "正式合同已存在，可直接对照" : freezePreview?.version ? "当前已有冻结预演" : "等待冻结预演"}</small>
            </div>
          </div>
          ${renderStyleLoopList(frozenSummaryRows, "先点“预览冻结合同”，再检查系统到底准备冻结什么。")}
        </div>
      </div>
      <div class="style-decision-compare-grid">
        ${comparePanels.map((panel) => `
          <div class="style-loop-card style-decision-compare-card">
            <div class="style-loop-section-head compact">
              <div>
                <span>${escapeHtml(panel.title)}</span>
                <small>${escapeHtml(panel.subtitle || "等待内容")}</small>
              </div>
            </div>
            <div class="style-loop-subsection">
              <b>Prompt</b>
              <div class="style-loop-quote">${escapeHtml(panel.prompt || "当前没有可展示的 prompt。")}</div>
            </div>
            <div class="style-loop-subsection">
              <b>样段</b>
              <div class="style-loop-quote">${escapeHtml(panel.sample || "当前没有可展示的样段。")}</div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `
}

function renderStyleTimeline(history = [], contract = {}, selectedVersion = 0) {
  if (!history.length) {
    return `
      <div class="style-loop-empty">
        还没有进入任何轮次。先初始化种子 prompt，再启动 Loop。
      </div>
    `
  }
  const approvalVersion = Number(contract?.loop?.approvalVersion || 0)
  const readyVersion = Number(contract?.loop?.readyVersion || 0)
  return `
    <div class="style-loop-timeline">
      ${history.slice().reverse().map((entry) => {
        const version = Number(entry?.version || 0)
        const overall = Number(entry?.evaluation?.scores?.overall || 0)
        const verdictMeta = styleVerdictMeta(entry?.evaluation?.verdict)
        const decisionMeta = styleUserDecisionMeta(entry?.userDecision)
        const isSelected = version === Number(selectedVersion || 0)
        const acceptedLabel = approvalVersion === version
          ? "用户已冻结"
          : readyVersion === version
            ? "达到可确认"
            : entry?.source === "manual"
              ? "人工写入"
              : "Loop 产出"
        return `
          <button
            class="style-loop-timeline-item ${isSelected ? "is-selected" : ""}"
            type="button"
            data-style-select-version="${version}"
          >
            <div class="style-loop-timeline-top">
              <strong>v${version}</strong>
              <span class="style-loop-pill ${verdictMeta.klass}">${escapeHtml(verdictMeta.label)}</span>
            </div>
            <div class="style-loop-timeline-meta">
              <span>${escapeHtml(acceptedLabel)}</span>
              <span>${overall ? `${overall.toFixed(1)} 分` : "未评分"}</span>
            </div>
            <div class="style-loop-timeline-meta">
              <span class="style-loop-pill ${decisionMeta.klass}">${escapeHtml(decisionMeta.label)}</span>
              <span>${entry?.readyForApproval ? "达到可确认门槛" : "继续收敛中"}</span>
            </div>
            <div class="style-loop-timeline-summary">${escapeHtml((entry?.evaluation?.summary || entry?.review || "等待摘要").trim())}</div>
            <div class="style-loop-timeline-meta">
              <span>${escapeHtml(entry?.createdAt ? formatClock(entry.createdAt) : "无时间")}</span>
              <span>${escapeHtml(entry?.iterationFeedback ? "含本轮反馈" : "无额外反馈")}</span>
            </div>
          </button>
        `
      }).join("")}
    </div>
  `
}

function buildStyleEvolutionPanelHtml() {
  const styleEvolution = dashboardState.styleEvolution || null
  const contract = styleEvolution?.contract || {}
  const loop = contract.loop || {}
  const gate = styleEvolution?.gate || { status: "blocked", issues: [] }
  const freezeLedger = styleFreezeLedger(styleEvolution)
  const loopRuntime = styleLoopRuntime(styleEvolution)
  const assets = styleEvolutionAssets()
  const freezeAssets = assets.freezePackage || {}
  const inheritanceAssets = assets.chapterInheritance || {}
  const candidateBatch = latestLoopCandidateBatch()
  const gateMeta = styleGateLabel(styleEvolution)
  const loopMeta = styleLoopStatusLabel(loop)
  const issues = Array.isArray(gate.issues) ? gate.issues : []
  const history = styleHistory(styleEvolution)
  const latest = latestStyleCandidate(styleEvolution)
  const selected = selectedStyleCandidate(styleEvolution)
  const approvedSample = String(contract.approvedSample || "").trim()
  const userStylePrompt = String(contract.userStylePrompt || "").trim()
  const seedPrompt = String(contract.seedPrompt || "").trim()
  const referenceText = String(contract.referenceText || "").trim()
  const referenceWorks = Array.isArray(contract.referenceWorks) ? contract.referenceWorks : []
  const desiredVibes = Array.isArray(contract.desiredVibes) ? contract.desiredVibes : []
  const seedForbiddenPatterns = Array.isArray(contract.seedForbiddenPatterns) ? contract.seedForbiddenPatterns : []
  const frozenBasePrompt = String(contract.frozenBasePrompt || "").trim()
  const evaluation = selected?.evaluation || {}
  const refinement = selected?.refinement || {}
  const verification = styleSelectedVerificationSnapshot(selected, contract)
  const scoreRows = styleScoreRows(evaluation)
  const aigcMeta = styleAigcMeta(evaluation?.aigc)
  const generationVerificationMeta = styleGenerationVerificationStatusMeta(verification, evaluation)
  const retryPolicy = contract.retryPolicy || {}
  const maxLoopIterations = Math.max(1, Number(retryPolicy.maxLoopIterations || 6))
  const contractSummaryRows = styleContractSummaryRows(contract.styleContract)
  const selectedVersion = Number(selected?.version || latest?.version || 0)
  const previousCandidate = previousStyleCandidateForVersion(history, selectedVersion)
  const timeline = renderStyleTimeline(history, contract, selectedVersion)
  const historyOptions = history.length
    ? history.map((entry) => `<option value="${entry.version}" ${entry.version === selectedVersion ? "selected" : ""}>v${entry.version} · ${escapeHtml((entry.evaluation?.summary || entry.review || entry.prompt || "候选样段").slice(0, 24))}</option>`).join("")
    : `<option value="">暂无候选</option>`
  const selectedVerdictMeta = styleVerdictMeta(evaluation?.verdict)
  const selectedDecisionMeta = styleUserDecisionMeta(selected?.userDecision)
  const approvedVersion = Number(loop.approvalVersion || 0)
  const stableVersion = Number(loop.stableVersion || 0)
  const stableCandidate = stableVersion ? findStyleCandidateByVersion(stableVersion, styleEvolution) : null
  const ledgerEntries = Array.isArray(freezeLedger.entries) ? freezeLedger.entries : []
  const ui = dashboardState.styleEvolutionUi || {}
  const loading = Boolean(ui.loading)
  const freezePreview = ui.freezePreview || null
  const modelRouting = ui.lastModelRouting || {}
  const modelRoutingText = modelRouting?.modelName
    ? `${modelRouting.modelName} · ${modelRouting.apiMode || "chat"} · ${modelRouting.capability || "text"}`
    : ""
  const rejectionDraft = String(ui.rejectionReasonDraft || selected?.rejectionReason || contract.approval?.rejectionReason || "").trim()
  const freezePreviewDigest = freezePreview || null
  const nextLoopExecutionRows = buildNextLoopExecutionRows({
    loop,
    ui,
    evaluation,
    refinement,
    verification,
    retryPolicy,
  })
  const frozenDigest = approvedVersion
    ? {
      version: approvedVersion,
      sample: approvedSample || findStyleCandidateByVersion(approvedVersion, styleEvolution)?.sample || "",
      frozenBasePrompt,
      freezeSummary: contract.approval?.freezeSummary || freezeLedger.freezeSummary || "",
      styleContract: contract.styleContract || {},
      antiPatterns: Array.isArray(contract.styleContract?.forbiddenPatterns) ? contract.styleContract.forbiddenPatterns : [],
      positiveExamples: Array.isArray(contract.styleContract?.positiveExamples) ? contract.styleContract.positiveExamples : [],
      retryPolicy: contract.retryPolicy || {},
      inheritedArtifacts: Array.isArray(contract.inheritance?.inheritedArtifacts) ? contract.inheritance.inheritedArtifacts : [],
      inheritedRules: Array.isArray(contract.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules : [],
      contractAdjustments: Array.isArray(findStyleCandidateByVersion(approvedVersion, styleEvolution)?.refinement?.contractAdjustments)
        ? findStyleCandidateByVersion(approvedVersion, styleEvolution).refinement.contractAdjustments
        : [],
      approvalScope: contract.approval?.acceptedAsBookStyle ? "whole_book" : "",
      verification: contract.verification || {},
      verificationStatus: freezeLedger.verificationStatus || "",
      verificationSummary: freezeLedger.verificationSummary || "",
      verificationReasons: Array.isArray(freezeLedger.verificationReasons) ? freezeLedger.verificationReasons : [],
      evaluation: findStyleCandidateByVersion(approvedVersion, styleEvolution)?.evaluation || {},
    }
    : null
  const loopStageCards = styleLoopStageCards({
    seedPrompt,
    history,
    evaluation,
    refinement,
    verification,
    selected,
    loop,
    gate,
    freezePreview,
    approvedVersion,
    contract,
  })
  const samplePreview = selected?.sample || approvedSample || latest?.sample || ""
  const sampleTitle = approvedVersion && approvedVersion === selectedVersion
    ? `用户确认样段 v${selectedVersion}`
    : selected
      ? `当前审阅样段 v${selectedVersion}`
      : "候选样段"
  const currentPrompt = selected?.prompt || latest?.prompt || ""
  const currentSample = selected?.sample || latest?.sample || ""
  const iterationFeedbackValue = selected?.iterationFeedback || latest?.iterationFeedback || ""
  const loopOverview = `
    <div class="style-loop-section">
      <div class="style-loop-section-head">
        <div>
          <span>Style Evolution Engine</span>
          <small>写法不再是一次性 prompt，而是完整的闭环引擎</small>
        </div>
      </div>
      ${renderStyleLoopStageRail(loopStageCards)}
      ${renderRuntimeSignalGrid({ loop, loopRuntime, retryPolicy, history })}
      <div class="style-loop-overview">
        <div class="style-loop-overview-row">
          <span>状态</span>
          <strong class="${loopMeta.klass}">${escapeHtml(loopMeta.label)}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>当前迭代</span>
          <strong>${Number(loop.currentIteration || history.length || 0)}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>收敛阶段</span>
          <strong>${escapeHtml(styleLoopConvergenceLabel(loop.convergence))}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>生成验证门</span>
          <strong>${escapeHtml(verification?.status || loop.verificationStatus || "pending")}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>可确认版本</span>
          <strong>${loop.readyVersion ? `v${loop.readyVersion}` : "未达到"}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>稳定版本</span>
          <strong>${stableVersion ? `v${stableVersion}` : "未形成"}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>自动轮数</span>
          <strong>${Number(loop.autoIterations || 0)}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>收紧次数</span>
          <strong>${Number(loop.tighteningCount || 0)}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>稳定轮数</span>
          <strong>${Number(loop.stableRounds || 0)}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>最终冻结</span>
          <strong>${approvedVersion ? `v${approvedVersion}` : "未冻结"}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>运行时状态</span>
          <strong>${escapeHtml(loopRuntime?.status || contract.runtime?.lastRunStatus || "idle")}</strong>
        </div>
        <div class="style-loop-overview-row">
          <span>重试策略</span>
          <strong>${escapeHtml(styleRetryPolicyRows(retryPolicy).slice(0, 2).join(" / ") || "待定义")}</strong>
        </div>
      </div>
    </div>
  `
  const loopProtocolCards = styleLoopProtocolCards({
    seedPrompt,
    referenceText,
    history,
    candidateBatch,
    evaluation,
    refinement,
    verification,
    selected,
    loop,
    freezePreview,
    approvedVersion,
    contract,
    inheritanceAssets,
  })
  const engineComponentGrid = renderEngineComponentGrid({
    seedPrompt,
    history,
    evaluation,
    refinement,
    verification,
    selected,
    loop,
    gate,
    freezePreview,
    approvedVersion,
    contract,
    freezeLedger,
    freezeAssets,
    inheritanceAssets,
  })
  const freezeInheritanceBridge = renderFreezeInheritanceBridge({
    freezePreview,
    approvedVersion,
    contract,
    freezeLedger,
    freezeAssets,
    inheritanceAssets,
  })
  const approvalDecisionCard = renderStyleApprovalDecisionCard({
    selected,
    approved: approvedVersion ? findStyleCandidateByVersion(approvedVersion, styleEvolution) : null,
    stable: stableCandidate,
    readyVersion: Number(loop.readyVersion || 0),
  })
  const approvalChecklistCard = renderStyleApprovalChecklist(selected, loop)
  const loopPhaseBoard = renderLoopPhaseBoard({
    selected,
    history,
    candidateBatch,
    loop,
    verification,
    refinement,
    freezePreview,
    approvedVersion,
    contract,
  })
  const currentIterationFlow = renderCurrentIterationFlow({
    selected,
    previousCandidate,
    evaluation,
    refinement,
    verification,
    loop,
    contract,
    historyOptions,
    approvedVersion,
    rejectionDraft,
    loading,
    selectedVersion,
  })
  const decisionLab = renderStyleDecisionLab({
    selected,
    approved: approvedVersion ? findStyleCandidateByVersion(approvedVersion, styleEvolution) : null,
    stable: stableCandidate,
    candidateBatch,
    freezePreview,
    contract,
    loading,
  })
  const engineCockpit = renderStyleEngineCockpit({
    gateMeta,
    loopMeta,
    loop,
    loopRuntime,
    verification,
    selected,
    freezePreview,
    approvedVersion,
    contract,
    retryPolicy,
  })
  const contractSummary = gate.status === "passed" && contractSummaryRows.length
    ? `
      <div class="style-evolution-contract">
        <div class="style-loop-section-head">
        <div>
          <span>冻结后的全书写法合同</span>
          <small>后续所有章节必须继承这里的写法约束</small>
        </div>
        <small>${contractSummaryRows.length} 项</small>
      </div>
      ${contract.approval?.freezeSummary ? `
        <div class="style-loop-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>冻结说明</span>
              <small>${contract.approval?.acceptedAsBookStyle ? "用户确认的是整本书写法，不是单次样段" : "待确认冻结范围"}</small>
            </div>
          </div>
          <p>${escapeHtml(contract.approval.freezeSummary)}</p>
        </div>
      ` : ""}
      ${Array.isArray(contract.inheritance?.inheritedRules) && contract.inheritance.inheritedRules.length ? `
        <div class="style-loop-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>正文强制继承</span>
              <small>${escapeHtml(contract.inheritance?.status || "pending")}</small>
            </div>
          </div>
          ${renderStyleLoopList(contract.inheritance.inheritedRules, "冻结后还没有继承规则。")}
        </div>
      ` : ""}
      ${frozenBasePrompt ? `
        <div class="style-evolution-contract-row">
          <b>冻结基础 Prompt</b>
          <span>${escapeHtml(frozenBasePrompt)}</span>
        </div>
        ` : ""}
        ${contractSummaryRows.map((row) => `
          <div class="style-evolution-contract-row">
            <b>${escapeHtml(row.label)}</b>
            <span>${escapeHtml(row.text)}</span>
          </div>
        `).join("")}
      </div>
    `
    : ""
  const inheritanceHandoffSection = `
    <div class="style-loop-section style-loop-section-focus">
      <div class="style-loop-section-head">
        <div>
          <span>冻结合同 -> 章节继承</span>
          <small>用户一旦确认整书写法，系统就要把冻结合同强制下发给正文生产，而不是让后续章节重新自由发挥。</small>
        </div>
      </div>
      ${freezeInheritanceBridge}
      <div class="style-loop-three-column">
        <div class="style-loop-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Style Rulebook</span>
              <small>${escapeHtml(contract?.inheritance?.status || "pending")}</small>
            </div>
          </div>
          ${renderStyleAssetEvidence(inheritanceAssets.rulebook, "还没有生成 style/rulebook.md。")}
        </div>
        <div class="style-loop-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Positive References</span>
              <small>正文生产继承的正向参考</small>
            </div>
          </div>
          ${renderStyleAssetEvidence(inheritanceAssets.references, "还没有生成 style/references.md。")}
        </div>
        <div class="style-loop-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Forbidden Patterns</span>
              <small>正文生产继承的禁忌清单</small>
            </div>
          </div>
          ${renderStyleAssetEvidence(inheritanceAssets.antiPatterns, "还没有生成 style/anti-patterns.md。")}
        </div>
      </div>
    </div>
  `
  const issueRows = issues.length
    ? issues.slice(0, 3).map((issue) => `
      <div class="style-evolution-issue ${issue.severity === "critical" ? "is-critical" : "is-warning"}">
        <strong>${escapeHtml(issue.message || issue.code || "写法门禁提示")}</strong>
        <span>${escapeHtml(issue.recoveryHint || "")}</span>
      </div>
    `).join("")
    : `<div class="style-evolution-issue is-passed"><strong>写法门禁通过</strong><span>可作为正式章节的基础写作风格。</span></div>`
  const auditEvidenceSection = `
    <div class="style-loop-section style-loop-section-audit style-loop-section-audit-shell">
      <details class="style-loop-audit-details">
        <summary class="style-loop-audit-summary">
          <div class="style-loop-section-head">
            <div>
              <span>审计与证据舱</span>
              <small>这些内容用于回溯、核验和排障，默认折叠，不再和主 loop 工作面抢视线。</small>
            </div>
            <small>展开查看证据</small>
          </div>
        </summary>
        <div class="style-loop-audit-stack">
        <div class="style-loop-card style-loop-audit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>轮次时间线</span>
              <small>${history.length} 轮</small>
            </div>
          </div>
          ${timeline}
        </div>

        <div class="style-loop-card style-loop-audit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Prompt Loop Runtime Ledger</span>
              <small>${ledgerEntries.length} 条正式轨迹</small>
            </div>
          </div>
          <div class="style-loop-three-column">
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>冻结摘要</span>
                  <small>${escapeHtml(freezeLedger.approvalStatus || "pending")}</small>
                </div>
              </div>
              <p>${escapeHtml(freezeLedger.freezeSummary || contract.approval?.freezeSummary || "当前还没有最终冻结说明。")}</p>
            </div>
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>稳定证据</span>
                  <small>${loop.stableVersion ? `v${loop.stableVersion}` : "未形成稳定版本"}</small>
                </div>
              </div>
              ${renderStyleLoopList(loop.stabilityReasons || freezeLedger.convergenceEvidence || [], "当前还没有形成明确的稳定证据。")}
            </div>
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>继承清单</span>
                  <small>${Array.isArray(freezeLedger.inheritedArtifacts) ? freezeLedger.inheritedArtifacts.length : 0} 项</small>
                </div>
              </div>
              ${renderStyleLoopList(freezeLedger.inheritedArtifacts || contract.inheritance?.inheritedArtifacts || [], "冻结后还没有继承资产。")}
            </div>
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>Runtime 轨迹</span>
                  <small>${loopRuntime?.runId ? "最近一次正式 Loop Run" : "暂无运行记录"}</small>
                </div>
              </div>
              ${renderStyleLoopList([
                loopRuntime?.runId ? `Run ID: ${loopRuntime.runId}` : "",
                loopRuntime?.requestedIterations ? `请求轮数：${loopRuntime.requestedIterations}` : "",
                loopRuntime?.completedIterations || loopRuntime?.completedIterations === 0 ? `完成轮数：${loopRuntime.completedIterations}` : "",
                loopRuntime?.stopReason ? `停止原因：${loopRuntime.stopReason}` : contract.runtime?.lastStopReason ? `停止原因：${contract.runtime.lastStopReason}` : "",
                loopRuntime?.finalLoopStatus ? `最终状态：${loopRuntime.finalLoopStatus}` : "",
                loopRuntime?.finalConvergence ? `最终收敛：${loopRuntime.finalConvergence}` : "",
                modelRoutingText ? `模型路由：${modelRoutingText}` : "",
              ].filter(Boolean), "当前还没有正式的 runtime 轨迹。")}
            </div>
          </div>
          <div class="style-loop-ledger">
            ${ledgerEntries.length ? ledgerEntries.slice().reverse().map((entry) => `
              <div class="style-loop-ledger-row ${entry.version === approvedVersion ? "is-approved" : entry.version === stableVersion ? "is-stable" : ""}">
                <div class="style-loop-ledger-main">
                  <strong>v${Number(entry.version || 0)}</strong>
                  <span>${escapeHtml(entry.verdict || "pending")}</span>
                  <span>${entry.overallScore ? `${Number(entry.overallScore).toFixed(1)} 分` : "未评分"}</span>
                  <span>${entry.stableCandidate ? `稳定 ${Number(entry.stableRounds || 0)} 轮` : entry.readyForApproval ? "达到可确认" : "继续收紧"}</span>
                </div>
                <div class="style-loop-ledger-meta">
                  <span>${escapeHtml(entry.userDecision || "pending")}</span>
                  <span>${escapeHtml(entry.evaluationSource || "unknown")} / ${escapeHtml(entry.refinementSource || "unknown")}</span>
                </div>
                <div class="style-loop-ledger-notes">
                  ${renderStyleLoopList([
                    ...(entry.stabilityReasons || []),
                    ...(entry.readyReasons || []),
                    ...(entry.contractTightening || []),
                    entry.rejectionReason ? `用户退回原因：${entry.rejectionReason}` : "",
                  ].filter(Boolean), "本轮账本没有额外注记。")}
                </div>
              </div>
            `).join("") : `<div class="style-loop-empty">冻结账本还没有任何记录。</div>`}
          </div>
          ${Array.isArray(loopRuntime?.iterations) && loopRuntime.iterations.length ? `
            <div class="style-loop-runtime-list">
              ${loopRuntime.iterations.map((entry) => `
                <div class="style-loop-runtime-item">
                  <div class="style-loop-ledger-main">
                    <strong>第 ${Number(entry.iteration || 0)} 轮</strong>
                    <span>${escapeHtml(entry.verdict || "pending")}</span>
                    <span>${entry.overallScore ? `${Number(entry.overallScore).toFixed(1)} 分` : "未评分"}</span>
                    <span>${escapeHtml(entry.stage || "unknown")}</span>
                  </div>
                  <div class="style-loop-ledger-meta">
                    <span>
                      评估 ${escapeHtml(entry.evaluationSource || "unknown")}
                      · 改写 ${escapeHtml(entry.refinementSource || "unknown")}
                      ${entry.freezerSource ? `· 冻结 ${escapeHtml(entry.freezerSource)}` : ""}
                    </span>
                    <span>${entry.version ? `落盘 v${entry.version}` : "未落盘版本"}</span>
                  </div>
                  <div class="style-loop-ledger-notes">
                    ${renderStyleLoopList([
                      entry.candidateCount ? `本轮候选数：${entry.candidateCount}` : "",
                      entry.candidateIndex ? `胜出候选：#${entry.candidateIndex}` : "",
                      entry.winningReason ? `胜出理由：${entry.winningReason}` : "",
                      entry.prompt ? `Prompt：${entry.prompt}` : "",
                      entry.sampleExcerpt ? `样段摘录：${entry.sampleExcerpt}` : "",
                      entry.nextPrompt ? `下一轮 Prompt：${entry.nextPrompt}` : "",
                      ...(entry.contractAdjustments || []).map((item) => `合同收紧：${item}`),
                    ].filter(Boolean), "当前轮 runtime 没有额外细节。")}
                  </div>
                </div>
              `).join("")}
            </div>
          ` : ""}
          ${candidateBatch.length ? `
            <div class="style-loop-runtime-list">
              <div class="style-loop-section-head compact">
                <div>
                  <span>本轮并行候选</span>
                  <small>先竞争，再选出胜出样段进入后续冻结链</small>
                </div>
              </div>
              ${candidateBatch.map((candidate) => `
                <div class="style-loop-runtime-item ${candidate.sample === samplePreview ? "is-approved" : ""}">
                  <div class="style-loop-ledger-main">
                    <strong>候选 #${Number(candidate.candidateIndex || 0)}</strong>
                    <span>${escapeHtml(candidate.evaluation?.verdict || "pending")}</span>
                    <span>${escapeHtml(candidate.verification?.status || "pending")}</span>
                    <span>${Number(candidate.evaluation?.scores?.overall || 0) ? `${Number(candidate.evaluation.scores.overall).toFixed(1)} 分` : "未评分"}</span>
                  </div>
                  <div class="style-loop-ledger-notes">
                    ${renderStyleLoopList(styleCandidateDiagnosticsRows(candidate, {
                      selectedSample: samplePreview,
                      winningReason: loopRuntime?.iterations?.find?.((entry) => Array.isArray(entry?.candidates) && entry.candidates.includes(candidate))?.winningReason || "",
                    }), "当前候选没有额外信息。")}
                  </div>
                </div>
              `).join("")}
            </div>
          ` : ""}
        </div>

        <div class="style-loop-card style-loop-audit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>冻结资产包</span>
              <small>保留整本书写法基线的正式产物</small>
            </div>
          </div>
          <div class="style-loop-three-column">
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>Approved Sample</span>
                  <small>用户最终接受的基础样段</small>
                </div>
              </div>
              ${renderStyleAssetEvidence(freezeAssets.approvedSample, "还没有生成 user-approved-sample.md。")}
            </div>
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>Freeze Ledger</span>
                  <small>冻结、稳定、退回与收敛证据账本</small>
                </div>
              </div>
              ${renderStyleAssetEvidence(freezeAssets.freezeLedger, "还没有生成 style-freeze-ledger.json。")}
            </div>
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>Loop Runtime</span>
                  <small>正式 loop run 的运行轨迹</small>
                </div>
              </div>
              ${renderStyleAssetEvidence(freezeAssets.loopRuntime, "还没有生成 style-loop-runtime.json。")}
            </div>
          </div>
        </div>

        <div class="style-loop-card style-loop-audit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Engine Components</span>
              <small>查看 8 个部件当前是否都已可用</small>
            </div>
          </div>
          ${engineComponentGrid}
        </div>

        <div class="style-loop-card style-loop-audit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Decision Lab</span>
              <small>用于比较候选、冻结预演和正式合同</small>
            </div>
          </div>
          ${decisionLab}
        </div>

        <div class="style-loop-card style-loop-audit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Loop Runtime Snapshot</span>
              <small>排查为什么某一轮没有通过</small>
            </div>
          </div>
          ${loopOverview}
        </div>

        <div class="style-loop-card style-loop-audit-card">
          <div class="style-loop-section-head compact">
            <div>
              <span>Loop Issues</span>
              <small>保留门禁问题与放行证据</small>
            </div>
          </div>
          <div class="style-evolution-issues">${issueRows}</div>
        </div>
        </div>
      </details>
  `
  updateSidebarModuleSummary(
    "style-panel-summary",
    gate.status === "passed"
      ? `已冻结 · ${history.length} 轮`
      : history.length > 0
        ? `${loopMeta.label} · ${history.length} 轮`
        : "等待 Loop",
  )

  const gateCallout = `
    <div class="style-workspace-callout ${gateMeta.klass}">
      <div class="style-workspace-callout-head">
        <span><i class="fa-solid ${gateMeta.icon}"></i> ${escapeHtml(gateMeta.label)}</span>
        <strong>${escapeHtml(gate.blockedReason || contract.styleContract?.voice || "Style Evolution Engine 还没有产出并冻结可继承的全书写法合同。")}</strong>
      </div>
      <small>${escapeHtml(contract.approvedAt ? `冻结于 ${formatClock(contract.approvedAt)}` : "正文生产前必须先完成 Loop 收敛并通过 Style Contract Freeze Gate")}</small>
    </div>
  `

  const gateFocusRows = [
    verification?.summary ? `生成验证：${verification.summary}` : "生成验证：等待本轮样段与 AIGC 检测完成",
    loop.readyVersion ? `可确认版本：v${loop.readyVersion}` : "可确认版本：当前还没收敛到可确认门槛",
    loop.stableVersion ? `稳定版本：v${loop.stableVersion}` : "稳定版本：当前还没有形成稳定写法",
    approvedVersion ? `正式冻结：v${approvedVersion}` : freezePreview?.version ? `冻结预演：v${freezePreview.version}` : "冻结预演：当前还没有形成",
    gate.blockedReason ? `当前阻塞：${gate.blockedReason}` : "",
  ].filter(Boolean)
  const topGateIssues = issues.slice(0, 3).map((issue) => `${issue.message || issue.code || "写法门禁提示"}${issue.recoveryHint ? `：${issue.recoveryHint}` : ""}`)
  const actionState = styleCandidateActionState(selected)
  const rejectionInjectionPreview = renderRejectionInjectionPreview({
    selected,
    rejectionDraft,
    refinement,
    evaluation,
    verification,
  })
  const primaryApprovalActions = `
    <div class="style-loop-card style-freeze-action-strip">
      <div class="style-loop-section-head compact">
        <div>
          <span>Freeze Action Strip</span>
          <small>当前候选通过验证后，直接在这里预演、冻结或退回下一轮</small>
        </div>
        <small>${selectedVersion ? `v${selectedVersion}` : "等待候选"}</small>
      </div>
      <div class="style-freeze-action-grid">
        <label class="style-evolution-field style-freeze-action-version">
          <span>确认版本</span>
          <select data-style-approve-version>${historyOptions}</select>
        </label>
        <div class="style-evolution-actions style-freeze-action-buttons">
          <button class="btn-command" type="button" data-style-save-candidate ${styleActionDisabledAttr(actionState, loading, "save")} title="${escapeHtml(styleActionTitle(actionState, "save"))}">
            <i class="fa-solid fa-floppy-disk"></i> 手工补录
          </button>
          <button class="btn-command" type="button" data-style-accept ${styleActionDisabledAttr(actionState, loading, "accept")} title="${escapeHtml(styleActionTitle(actionState, "accept"))}">
            <i class="fa-solid fa-check"></i> 接受本轮
          </button>
          <button class="btn-command" type="button" data-style-freeze-preview ${styleActionDisabledAttr(actionState, loading)} title="${escapeHtml(styleActionTitle(actionState))}">
            <i class="fa-solid fa-eye"></i> 预览冻结合同
          </button>
          <button class="btn-command style-confirm-button" type="button" data-style-approve ${styleActionDisabledAttr(actionState, loading)} title="${escapeHtml(styleActionTitle(actionState))}">
            <i class="fa-solid fa-snowflake"></i> 冻结全书合同
          </button>
          <button class="btn-command" type="button" data-style-reject ${styleActionDisabledAttr(actionState, loading, "reject")} title="${escapeHtml(styleActionTitle(actionState, "reject"))}">
            <i class="fa-solid fa-rotate-left"></i> 退回本轮
          </button>
        </div>
      </div>
      <label class="style-evolution-field style-freeze-action-reason">
        <span>退回原因 / 下一轮修正指令</span>
        <textarea data-style-rejection-reason rows="2" placeholder="例如：对白还像解释，动作推进不够，要继续压缩旁白。">${escapeHtml(rejectionDraft)}</textarea>
      </label>
      <div class="style-loop-subsection style-rejection-injection-preview" data-style-rejection-preview>
        <b>退回后下一轮注入预览</b>
        ${rejectionInjectionPreview}
      </div>
      ${renderStyleActionGateReasons(actionState)}
    </div>
  `
  const seedPromptBuilderOpen = history.length === 0 && !seedPrompt && !userStylePrompt
  const seedPromptBuilder = `
    <details class="style-loop-section style-loop-section-muted style-seed-prompt-details" ${seedPromptBuilderOpen ? "open" : ""}>
      <summary class="style-loop-secondary-summary">
        <div class="style-loop-section-head">
          <div>
            <span>Seed Prompt Builder / 手工补录</span>
            <small>调整初始风格、参考文本和手工候选；日常迭代优先使用上方主工作台的运行 Loop。</small>
          </div>
          <small>${seedPromptBuilderOpen ? "首次配置" : "展开高级输入"}</small>
        </div>
      </summary>
      <div class="style-loop-workbench">
        <div class="style-loop-stage-panel">
          <div class="style-loop-section-head compact">
            <div>
              <span>01 Seed Prompt Builder</span>
              <small>先收束“这本书想怎么写”，不是先盲写正文</small>
            </div>
          </div>
          <label class="style-evolution-field">
            <span>风格要求</span>
            <textarea data-style-user-prompt rows="3" placeholder="例如：克制、冷感、白描；动作和物件推动悬疑。">${escapeHtml(userStylePrompt)}</textarea>
          </label>
          <label class="style-evolution-field">
            <span>参考作品</span>
            <textarea data-style-reference-works rows="2" placeholder="每行一个，例如：漫长的季节 / 白夜行 / 隐秘的角落">${escapeHtml(referenceWorks.join("\n"))}</textarea>
          </label>
          <div class="style-loop-two-column">
            <label class="style-evolution-field">
              <span>想要的气质</span>
              <textarea data-style-desired-vibes rows="3" placeholder="每行一个，例如：冷感、压迫、克制、宿命感、潮湿感">${escapeHtml(desiredVibes.join("\n"))}</textarea>
            </label>
            <label class="style-evolution-field">
              <span>明确禁忌</span>
              <textarea data-style-seed-forbidden-patterns rows="3" placeholder="每行一个，例如：不要解释创作意图 / 不要鸡汤总结 / 不要同质化对白">${escapeHtml(seedForbiddenPatterns.join("\n"))}</textarea>
            </label>
          </div>
          <label class="style-evolution-field">
            <span>参考文本 / 风格锚点</span>
            <textarea data-style-reference-text rows="4" placeholder="贴一小段你想参考的文本，系统会只借鉴声音、节奏和气质，不直接照抄。">${escapeHtml(referenceText)}</textarea>
          </label>
          <label class="style-evolution-field">
            <span>本轮反馈 / 迭代要求</span>
            <textarea data-style-iteration-feedback rows="3" placeholder="例如：保留冷感白描，但对白再短一点，减少解释，多用动作压迫。">${escapeHtml(iterationFeedbackValue)}</textarea>
          </label>
          <div class="style-loop-two-column">
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>初始种子 Prompt</span>
                  <small>${seedPrompt ? "作为起点存在" : "尚未初始化"}</small>
                </div>
              </div>
              <p>${seedPrompt ? escapeHtml(seedPrompt) : "还没有写法种子 prompt。"}</p>
            </div>
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>参考文本 / 风格锚点</span>
                  <small>${referenceText ? "本轮可参考" : referenceWorks.length || desiredVibes.length || seedForbiddenPatterns.length ? "种子协议已补充" : "当前未提供"}</small>
                </div>
              </div>
              <p>${referenceText
                ? escapeHtml(referenceText)
                : [
                  desiredVibes.length ? `目标气质：${desiredVibes.join("、")}` : "",
                  referenceWorks.length ? `参考作品：${referenceWorks.join("、")}` : "",
                  seedForbiddenPatterns.length ? `写法禁忌：${seedForbiddenPatterns.join("、")}` : "",
                ].filter(Boolean).join(" | ") || "当前没有额外参考文本，系统主要依赖用户风格要求和循环评估。"}</p>
            </div>
          </div>
          <details class="style-loop-card style-manual-candidate-details">
            <summary class="style-loop-secondary-summary">
              <div class="style-loop-section-head compact">
                <div>
                  <span>手工补录候选</span>
                  <small>只在需要把外部样段纳入同一套评估/冻结链时使用；主流程优先运行 Loop。</small>
                </div>
                <small>展开录入</small>
              </div>
            </summary>
            <div class="style-manual-candidate-form">
              <label class="style-evolution-field">
                <span>候选 Prompt</span>
                <textarea data-style-candidate-prompt rows="4" placeholder="手工补录候选时，填写生成这段样段的 prompt。"></textarea>
              </label>
              <label class="style-evolution-field">
                <span>候选样段</span>
                <textarea data-style-candidate-sample rows="7" placeholder="贴入需要纳入 Style Evolution Engine 的候选正文样段。"></textarea>
              </label>
              <label class="style-evolution-field">
                <span>候选评审摘要</span>
                <input data-style-candidate-review type="text" placeholder="例如：可作为全书基础写法，但对白还可更短。">
              </label>
            </div>
          </details>
          <div class="style-evolution-actions style-evolution-actions-inline">
            <button class="btn-command" type="button" data-style-init ${loading ? "disabled" : ""}>
              <i class="fa-solid ${loading ? "fa-spinner fa-spin" : "fa-seedling"}"></i> 初始化
            </button>
            <button class="btn-command" type="button" data-style-refresh ${loading ? "disabled" : ""}>
              <i class="fa-solid fa-rotate"></i> 刷新
            </button>
          </div>
        </div>
        <div class="style-loop-stage-panel">
          <div class="style-loop-section-head compact">
            <div>
              <span>02 Candidate Generator / Loop Run Controls</span>
              <small>这里只配置候选生成规模；是否继续、收紧或进入确认由 Loop Controller 根据验证结果决定</small>
            </div>
          </div>
          <div class="style-loop-two-column">
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>Candidate Generator</span>
                  <small>每轮产出可比较样段</small>
                </div>
              </div>
              <p>候选数只决定本轮并行尝试的样段数量；样段随后必须进入 Evaluator / Critic 和 Generation Verification Gate。</p>
            </div>
            <div class="style-loop-card">
              <div class="style-loop-section-head compact">
                <div>
                  <span>Loop Controller</span>
                  <small>读取评估、验证和 Refiner 输出</small>
                </div>
              </div>
              <p>迭代轮数是本次运行上限。Controller 会把失败原因压回下一轮 prompt，只有 ready/stable 才能进入 User Approval Gate。</p>
            </div>
          </div>
          <div class="style-loop-control-row">
            <div class="style-loop-control-selects">
              <label class="style-evolution-field">
                <span>本次自动迭代轮数</span>
                <select data-style-loop-iterations>
                  ${Array.from({ length: maxLoopIterations }, (_, index) => {
                    const value = index + 1
                    const loopRunIterations = Number(ui?.lastLoopRun?.totalIterations || 1)
                    return `<option value="${value}" ${value === loopRunIterations ? "selected" : ""}>${value} 轮</option>`
                  }).join("")}
                </select>
              </label>
              <label class="style-evolution-field">
                <span>每轮候选数</span>
                <select data-style-candidate-count>
                  ${Array.from({ length: 4 }, (_, index) => {
                    const value = index + 1
                    const candidateCount = Number(ui?.lastLoopRun?.candidateCount || 1)
                    return `<option value="${value}" ${value === candidateCount ? "selected" : ""}>${value} 个</option>`
                  }).join("")}
                </select>
              </label>
            </div>
            <div class="style-evolution-actions style-loop-run-actions">
              <button class="btn-command style-generate-button" type="button" data-style-generate-candidate ${loading ? "disabled" : ""}>
                <i class="fa-solid ${loading ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"}"></i> 运行 Loop
              </button>
            </div>
          </div>
          <div class="style-loop-card">
            <div class="style-loop-section-head compact">
              <div>
                <span>本轮运行说明</span>
                <small>${ui?.lastLoopRun?.stopReason ? `停止原因：${ui.lastLoopRun.stopReason}` : "等待运行"}</small>
              </div>
            </div>
            ${renderStyleLoopList([
              ui?.lastLoopRun?.totalIterations ? `实际运行 ${ui.lastLoopRun.totalIterations} 轮` : "",
              ui?.lastLoopRun?.candidateCount ? `每轮 ${ui.lastLoopRun.candidateCount} 个候选` : "",
              modelRoutingText ? `模型路由：${modelRoutingText}` : "",
              loop.readyVersion ? `当前可确认版本：v${loop.readyVersion}` : "",
              loop.stableVersion ? `当前稳定版本：v${loop.stableVersion}` : "",
            ].filter(Boolean), "还没有正式 Loop 运行记录。")}
          </div>
          <div class="style-loop-card">
            <div class="style-loop-section-head compact">
              <div>
                <span>Retry Policy</span>
                <small>系统何时继续迭代、何时允许进入用户确认</small>
              </div>
            </div>
            ${renderStyleLoopList(styleRetryPolicyRows(retryPolicy), "当前还没有配置重试与收敛策略。")}
          </div>
          <div class="style-loop-card">
            <div class="style-loop-section-head compact">
              <div>
                <span>下一轮执行计划</span>
                <small>把 Prompt Refiner 的收紧结论真正交给 Loop Controller 执行</small>
              </div>
            </div>
            ${renderStyleLoopList(nextLoopExecutionRows, "当前还没有形成下一轮执行计划。")}
          </div>
        </div>
        <div class="style-loop-stage-panel style-loop-stage-panel-runtime">
          <div class="style-loop-section-head compact">
            <div>
              <span>03 Verification + Freeze Readiness</span>
              <small>这里不重复展示评估全文，只保留当前最关键的放行信号和阻塞点</small>
            </div>
          </div>
          <div class="style-evolution-status ${generationVerificationMeta.klass}">
            <div>
              <span><i class="fa-solid fa-shield-halved"></i> ${escapeHtml(generationVerificationMeta.label)}</span>
              <strong>${escapeHtml(
                verification?.summary
                  || (generationVerificationMeta.klass === "is-passed"
                    ? "当前样段已经通过生成验证，可以继续逼近用户确认。"
                    : generationVerificationMeta.klass === "is-blocked"
                      ? "当前样段仍被 AIGC 风险、模板腔或禁忌命中阻塞，不能进入冻结。"
                      : "当前还没有足够的生成验证证据。")
              )}</strong>
            </div>
            <small>这块是 Freeze Gate 的驾驶舱，不再重复完整评审报告。</small>
          </div>
          <div class="style-loop-subsection">
            <b>当前放行信号</b>
            ${renderStyleLoopList(gateFocusRows, "当前还没有足够的放行信号。")}
          </div>
          <div class="style-loop-subsection">
            <b>当前阻塞焦点</b>
            ${topGateIssues.length
              ? renderStyleLoopList(topGateIssues, "当前没有新的阻塞说明。")
              : renderStyleGateNextActions({ gate, selected, loop, freezePreview, evaluation })}
          </div>
        </div>
      </div>
    </details>
  `
  const currentIterationWorkbench = `
    <div class="style-loop-section style-loop-section-focus">
      <div class="style-loop-section-head">
        <div>
          <span>当前迭代主工作台</span>
          <small>把本轮 prompt、样段、评估、反思、用户判断与冻结动作压进同一个连续回路里，真正贴近 Loop Engineering 的操作面</small>
        </div>
        <small>${selectedVersion ? `v${selectedVersion}` : "等待候选"}</small>
      </div>
      ${currentIterationFlow}
      ${(freezePreviewDigest || frozenDigest) ? `
        <div class="style-freeze-compare-grid">
          ${freezePreviewDigest ? renderStyleFreezeDigestCard(
            "Freeze Preview",
            freezePreviewDigest.version ? `如果现在冻结，将使用 v${freezePreviewDigest.version}` : "当前样段预览",
            freezePreviewDigest,
            {
              emphasisClass: "is-preview",
              note: "这一步只是预演最终冻结结果，方便你看清楚系统到底会把哪些写法固定下来。",
            },
          ) : ""}
          ${frozenDigest ? renderStyleFreezeDigestCard(
            "Frozen Contract",
            approvedVersion ? `当前正式写法合同来自 v${approvedVersion}` : "尚未冻结",
            frozenDigest,
            {
              emphasisClass: "is-frozen",
              note: "这个版本会作为整本书后续章节的强制继承基线，不再自由漂移。",
            },
          ) : ""}
        </div>
      ` : ""}
    </div>
  `

  return `
    ${gateCallout}
    ${currentIterationWorkbench}
    <div class="style-loop-section style-loop-section-focus style-loop-section-map">
      <div class="style-loop-section-head">
        <div>
          <span>Loop Engineering Runtime</span>
          <small>Seed Prompt Builder -> Candidate Generator -> Evaluator/Critic -> AIGC / Generation Verification Gate -> Prompt Refiner -> Loop Controller -> User Approval Gate -> Style Contract Freezer -> Chapter Inheritance Adapter。</small>
        </div>
      </div>
      ${loopPhaseBoard}
      ${primaryApprovalActions}
    </div>
    ${seedPromptBuilder}
    ${contractSummary}
    ${inheritanceHandoffSection}
    <div class="style-loop-section style-loop-section-muted">
      <details class="style-loop-secondary-details">
        <summary class="style-loop-secondary-summary">
          <div class="style-loop-section-head">
            <div>
              <span>Loop Engineering Protocol</span>
              <small>这是闭环协议摘要，解释这套引擎怎么从种子一路走到冻结继承。</small>
            </div>
            <small>展开协议摘要</small>
          </div>
        </summary>
        ${renderStyleLoopProtocolGrid(loopProtocolCards)}
      </details>
    </div>
    <div class="style-loop-section style-loop-section-muted">
      <div class="style-loop-section-head">
        <div>
          <span>Freeze Gate 下一步</span>
          <small>系统为什么还没放行正文，以及现在最该做什么</small>
        </div>
      </div>
      <div class="style-loop-card">
        ${renderStyleGateNextActions({ gate, selected, loop, freezePreview, evaluation })}
      </div>
    </div>
    <div class="style-loop-section style-loop-section-muted">
      <details class="style-loop-secondary-details">
        <summary class="style-loop-secondary-summary">
          <div class="style-loop-section-head">
            <div>
              <span>Engine Cockpit</span>
              <small>当你需要看全局状态、收敛信号和运行时概况时，再看这里；它不再压在主工作链前面。</small>
            </div>
            <small>展开全局总览</small>
          </div>
        </summary>
        ${engineCockpit}
      </details>
    </div>
    ${auditEvidenceSection}
    ${ui.message ? `<div class="style-evolution-message is-success">${escapeHtml(ui.message)}</div>` : ""}
    ${ui.error ? `<div class="style-evolution-message is-error">${escapeHtml(ui.error)}</div>` : ""}
  `
}

function buildStyleEvolutionSidebarHtml() {
  const styleEvolution = dashboardState.styleEvolution || null
  const contract = styleEvolution?.contract || {}
  const loop = contract.loop || {}
  const gate = styleEvolution?.gate || { status: "blocked", issues: [] }
  const selected = selectedStyleCandidate(styleEvolution)
  const evaluation = selected?.evaluation || {}
  const verification = styleSelectedVerificationSnapshot(selected, contract)
  const gateMeta = styleGateLabel(styleEvolution)
  const loopMeta = styleLoopStatusLabel(loop)
  const approvedVersion = Number(loop.approvalVersion || 0)
  const readyVersion = Number(loop.readyVersion || 0)
  const stableVersion = Number(loop.stableVersion || 0)
  const issues = Array.isArray(gate.issues) ? gate.issues : []
  const selectedVersion = Number(selected?.version || 0)
  const iterationFacts = [
    selectedVersion ? `当前审阅版本：v${selectedVersion}` : "当前还没有进入正式迭代轮次",
    Number(loop.currentIteration || 0) > 0 ? `累计迭代：${Number(loop.currentIteration)} 轮` : "累计迭代：0 轮",
    evaluation?.summary ? `本轮评估：${evaluation.summary}` : "本轮评估：等待候选样段产生后再进入",
    selected?.refinement?.nextPrompt ? "下一轮 Prompt 已生成" : "下一轮 Prompt：等待评估后收紧",
  ].filter(Boolean)
  const freezeFacts = [
    readyVersion ? `可确认版本：v${readyVersion}` : "还没有达到整书写法确认门槛",
    stableVersion ? `稳定版本：v${stableVersion}` : "还没有形成稳定版本",
    approvedVersion ? `已冻结版本：v${approvedVersion}` : "尚未冻结正式写法合同",
    verification?.status ? `生成验证门：${verification.status}` : "生成验证门等待本轮样段",
    Number(verification?.highRiskCount || 0) > 0 ? `AIGC 高风险：${Number(verification.highRiskCount)} 段` : "AIGC 高风险：0 段或未阻塞",
  ].filter(Boolean)
  const topIssues = issues.slice(0, 2).map((issue) => ({
    title: issue.message || issue.code || "写法门禁提示",
    detail: issue.recoveryHint || "",
  }))

  return `
    <div class="style-sidebar-summary">
      <div class="style-sidebar-summary-status ${gateMeta.klass}">
        <span><i class="fa-solid ${gateMeta.icon}"></i> ${escapeHtml(gateMeta.label)}</span>
        <strong>${escapeHtml(loopMeta.label)}</strong>
      </div>
      <button class="style-sidebar-summary-open" type="button" data-open-style-workspace="true">
        <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
        <span>在主工作区打开完整引擎</span>
      </button>
      <div class="style-sidebar-summary-card">
        <div class="style-loop-section-head compact">
          <div>
            <span>当前迭代</span>
            <small>右侧只保留当前轮的核心状态，不再平行复制整套主面板</small>
          </div>
        </div>
        ${renderStyleLoopList(iterationFacts, "等待 Style Evolution Engine 首次运行。")}
      </div>
      <div class="style-sidebar-summary-card">
        <div class="style-loop-section-head compact">
          <div>
            <span>冻结与放行</span>
            <small>这本书现在是否能进入整书写法确认，以及离冻结还有多远</small>
          </div>
        </div>
        ${renderStyleLoopList(freezeFacts, "冻结门和生成验证门还没有足够证据。")}
      </div>
      <div class="style-sidebar-summary-card">
        <div class="style-loop-section-head compact">
          <div>
            <span>Freeze Gate 下一步</span>
            <small>${escapeHtml(gate.blockedReason || "先生成候选，再评估与收敛。")}</small>
          </div>
        </div>
        ${topIssues.length
          ? renderStyleLoopList(topIssues.map((item) => `${item.title}${item.detail ? `：${item.detail}` : ""}`), "当前没有新的阻塞说明。")
          : renderStyleGateNextActions({ gate, selected, loop, freezePreview: null, evaluation })}
      </div>
    </div>
  `
}

function renderStyleEvolutionPanel() {
  const sidebarContainer = document.getElementById("style-evolution-panel")
  const workspaceContainer = styleWorkspacePanel
  if (!sidebarContainer && !workspaceContainer) return
  const panelHtml = buildStyleEvolutionPanelHtml()
  const sidebarHtml = buildStyleEvolutionSidebarHtml()
  if (sidebarContainer) {
    sidebarContainer.innerHTML = sidebarHtml
  }
  if (workspaceContainer) {
    workspaceContainer.innerHTML = `
      <div class="style-workspace-hero">
        <div>
          <span>Style Evolution Engine</span>
          <strong>Seed Prompt Builder -> Candidate Generator -> Evaluator/Critic -> AIGC / Generation Verification Gate -> Prompt Refiner -> Loop Controller -> User Approval Gate -> Style Contract Freezer -> Chapter Inheritance Adapter</strong>
          <small>这里是完整的 Loop Engineering 工作台。系统会先反复自进化写法样段，只有通过生成验证并得到你的整书确认后，才冻结合同并强制继承到正文生产。</small>
        </div>
      </div>
      ${panelHtml}
    `
  }
}

function readStyleSeedArrayField(container, selector) {
  return String(container?.querySelector(selector)?.value || "")
    .split(/\n+/u)
    .map((item) => item.trim())
    .filter(Boolean)
}

function stylePanelContainerFromEvent(event) {
  return event?.target?.closest?.("#style-workspace-panel, #style-evolution-panel")
    || styleWorkspacePanel
    || document.getElementById("style-evolution-panel")
}

function currentStylePanelContainer(container = null) {
  return container || styleWorkspacePanel || document.getElementById("style-evolution-panel")
}

function selectedStyleVersionFromContainer(container = null, trigger = null) {
  const scopedActionRoot = trigger?.closest?.(".style-freeze-action-strip, .style-iteration-flow-card.is-gate")
  const scopedVersion = Number(scopedActionRoot?.querySelector("[data-style-approve-version]")?.value || 0)
  if (scopedVersion) return scopedVersion
  const panel = currentStylePanelContainer(container)
  const selectVersion = Number(panel?.querySelector("[data-style-approve-version]")?.value || 0)
  const uiVersion = Number(dashboardState.styleEvolutionUi?.selectedVersion || 0)
  const selectedVersion = Number(selectedStyleCandidate()?.version || 0)
  return selectVersion || uiVersion || selectedVersion || 0
}

function assertStyleCandidateFreezable(version, actionLabel = "执行冻结动作") {
  const candidate = findStyleCandidateByVersion(version)
  const actionState = styleCandidateActionState(candidate)
  if (!actionState.canFreeze) {
    throw new Error(`${actionLabel}前需要先通过冻结前置门禁：${actionState.reason}`)
  }
}

function assertStyleCandidateRejectable(version) {
  const candidate = findStyleCandidateByVersion(version)
  const actionState = styleCandidateActionState(candidate)
  if (!actionState.canReject) {
    throw new Error(`退回当前轮前需要先选择可退回候选：${actionState.reason}`)
  }
}

async function loadStyleEvolutionSnapshot() {
  if (!dashboardState.activeProjectId) return false
  const response = await apiRequest(`/api/style-evolution?projectId=${encodeURIComponent(dashboardState.activeProjectId)}`)
  if (!response.ok) {
    dashboardState.styleEvolutionUi = {
      loading: false,
      message: "",
      error: response.payload?.error || "style_evolution_load_failed",
    }
    return false
  }
  updateSnapshot(response.payload)
  return true
}

async function refreshStyleEvolution(options = {}) {
  if (!dashboardState.activeProjectId) return
  dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: true, error: options.silent ? dashboardState.styleEvolutionUi.error : "" }
  if (!options.silent) renderStyleEvolutionPanel()
  try {
    const loaded = await loadStyleEvolutionSnapshot()
    if (!loaded) {
      throw new Error(dashboardState.styleEvolutionUi.error || "style_evolution_load_failed")
    }
    dashboardState.styleEvolutionUi = { loading: false, message: options.message || "", error: "" }
  } catch (error) {
    dashboardState.styleEvolutionUi = { loading: false, message: "", error: error.message || String(error) }
  }
  renderDashboard()
}

async function initializeStyleEvolutionFromPanel(container = null) {
  if (!dashboardState.activeProjectId) return
  container = currentStylePanelContainer(container)
  const userStylePrompt = container?.querySelector("[data-style-user-prompt]")?.value || ""
  const referenceText = container?.querySelector("[data-style-reference-text]")?.value || ""
  const referenceWorks = readStyleSeedArrayField(container, "[data-style-reference-works]")
  const desiredVibes = readStyleSeedArrayField(container, "[data-style-desired-vibes]")
  const seedForbiddenPatterns = readStyleSeedArrayField(container, "[data-style-seed-forbidden-patterns]")
  const iterationFeedback = container?.querySelector("[data-style-iteration-feedback]")?.value || ""
  dashboardState.styleEvolutionUi = { loading: true, message: "", error: "" }
  renderStyleEvolutionPanel()
  try {
    const response = await apiRequest("/api/style-evolution/init", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        userStylePrompt,
        referenceText,
        referenceWorks,
        desiredVibes,
        seedForbiddenPatterns,
        iterationFeedback,
      },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "style_evolution_init_failed")
    }
    updateSnapshot(response.payload)
    dashboardState.styleEvolutionUi = { loading: false, message: "Style Evolution Engine 已初始化。", error: "" }
  } catch (error) {
    dashboardState.styleEvolutionUi = { loading: false, message: "", error: error.message || String(error) }
  }
  renderDashboard()
}

async function generateStyleEvolutionCandidateFromPanel(container = null) {
  if (!dashboardState.activeProjectId) return
  container = currentStylePanelContainer(container)
  const userStylePrompt = container?.querySelector("[data-style-user-prompt]")?.value || ""
  const referenceText = container?.querySelector("[data-style-reference-text]")?.value || ""
  const referenceWorks = readStyleSeedArrayField(container, "[data-style-reference-works]")
  const desiredVibes = readStyleSeedArrayField(container, "[data-style-desired-vibes]")
  const seedForbiddenPatterns = readStyleSeedArrayField(container, "[data-style-seed-forbidden-patterns]")
  const iterationFeedback = container?.querySelector("[data-style-iteration-feedback]")?.value || ""
  const loopIterations = Number(container?.querySelector("[data-style-loop-iterations]")?.value || 1)
  const candidateCount = Number(container?.querySelector("[data-style-candidate-count]")?.value || 1)
  dashboardState.styleEvolutionUi = { loading: true, message: "", error: "" }
  renderStyleEvolutionPanel()
  try {
    const response = await apiRequest("/api/style-evolution/generate-candidate", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        userStylePrompt,
        referenceText,
        referenceWorks,
        desiredVibes,
        seedForbiddenPatterns,
        iterationFeedback,
        loopIterations,
        candidateCount,
      },
    })
    if (!response.ok) {
      if (response.payload?.error === "style_candidates_all_blocked") {
        updateSnapshot(response.payload)
        const totalIterations = Number(response.payload?.loopRun?.totalIterations || 1)
        const stopReason = response.payload?.loopRun?.stopReason || "style_candidates_all_blocked"
        const latestRuntimeIteration = response.payload?.loopRun?.iterations?.at?.(-1)
        dashboardState.styleEvolutionUi = {
          loading: false,
          selectedVersion: Number(dashboardState.styleEvolutionUi?.selectedVersion || 0) || null,
          lastLoopRun: {
            totalIterations,
            candidateCount: Number(response.payload?.loopRun?.candidateCount || candidateCount || 1),
            stopReason,
          },
          lastCandidateBatch: latestRuntimeIteration?.candidates || [],
          message: "",
          error: response.payload?.reason || "本轮所有候选都未通过 Generation Verification Gate。",
        }
        renderDashboard()
        return
      }
      throw new Error(response.payload?.error || "style_candidate_generate_failed")
    }
    updateSnapshot(response.payload)
    const version = response.payload?.generatedCandidate?.version
    const verdict = response.payload?.loopIteration?.evaluation?.verdict
    const totalIterations = Number(response.payload?.loopRun?.totalIterations || 1)
    const stopReason = response.payload?.loopRun?.stopReason
    dashboardState.styleEvolutionUi = {
      loading: false,
      selectedVersion: Number(version || dashboardState.styleEvolutionUi?.selectedVersion || 0) || null,
      lastLoopRun: {
        totalIterations,
        candidateCount: Number(response.payload?.loopRun?.candidateCount || candidateCount || 1),
        stopReason: stopReason || "max_iterations_reached",
      },
      lastCandidateBatch: response.payload?.loopIteration?.candidates || [],
      message: version
        ? `Loop 本次跑了 ${totalIterations} 轮，每轮 ${Number(response.payload?.loopRun?.candidateCount || candidateCount || 1)} 个候选，停在 v${version}，当前判断：${verdict || "candidate"}，停止原因：${stopReason || "max_iterations_reached"}。`
        : "Loop 已完成一轮样段进化。",
      error: "",
    }
  } catch (error) {
    dashboardState.styleEvolutionUi = { loading: false, message: "", error: error.message || String(error) }
  }
  renderDashboard()
}

async function saveStyleEvolutionCandidateFromPanel(container = null) {
  if (!dashboardState.activeProjectId) return
  container = currentStylePanelContainer(container)
  const prompt = container?.querySelector("[data-style-candidate-prompt]")?.value?.trim() || ""
  const sample = container?.querySelector("[data-style-candidate-sample]")?.value?.trim() || ""
  const review = container?.querySelector("[data-style-candidate-review]")?.value?.trim() || ""
  if (!prompt || !sample) {
    dashboardState.styleEvolutionUi = { loading: false, message: "", error: "请填写候选 prompt 和样段。" }
    renderStyleEvolutionPanel()
    return
  }
  dashboardState.styleEvolutionUi = { loading: true, message: "", error: "" }
  renderStyleEvolutionPanel()
  try {
    const response = await apiRequest("/api/style-evolution/candidate", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        prompt,
        sample,
        review,
      },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "style_candidate_save_failed")
    }
    updateSnapshot(response.payload)
    const version = Number(response.payload?.styleEvolution?.contract?.evolutionHistory?.at?.(-1)?.version || 0)
    dashboardState.styleEvolutionUi = {
      ...dashboardState.styleEvolutionUi,
      loading: false,
      selectedVersion: version || dashboardState.styleEvolutionUi?.selectedVersion || null,
      message: "候选样段已保存。",
      error: "",
    }
  } catch (error) {
    dashboardState.styleEvolutionUi = { loading: false, message: "", error: error.message || String(error) }
  }
  renderDashboard()
}

async function approveStyleEvolutionFromPanel(container = null, trigger = null) {
  if (!dashboardState.activeProjectId) return
  container = currentStylePanelContainer(container)
  const version = selectedStyleVersionFromContainer(container, trigger)
  if (!version) {
    dashboardState.styleEvolutionUi = { loading: false, message: "", error: "请先保存至少一个候选样段。" }
    renderStyleEvolutionPanel()
    return
  }
  try {
    assertStyleCandidateFreezable(version, "冻结全书合同")
  } catch (error) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: error.message || String(error) }
    renderStyleEvolutionPanel()
    return
  }
  dashboardState.styleEvolutionUi = { loading: true, message: "", error: "" }
  renderStyleEvolutionPanel()
  try {
    const response = await apiRequest("/api/style-evolution/approve", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        version,
      },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "style_approval_failed")
    }
    updateSnapshot(response.payload)
    dashboardState.styleEvolutionUi = {
      ...dashboardState.styleEvolutionUi,
      loading: false,
      selectedVersion: version || dashboardState.styleEvolutionUi?.selectedVersion || null,
      message: "已冻结本书基础写法合同。",
      error: "",
    }
  } catch (error) {
    dashboardState.styleEvolutionUi = { loading: false, message: "", error: error.message || String(error) }
  }
  renderDashboard()
}

async function acceptStyleEvolutionFromPanel(container = null, trigger = null) {
  if (!dashboardState.activeProjectId) return
  container = currentStylePanelContainer(container)
  const version = selectedStyleVersionFromContainer(container, trigger)
  if (!version) {
    dashboardState.styleEvolutionUi = { loading: false, message: "", error: "请先选择要接受的轮次。" }
    renderStyleEvolutionPanel()
    return
  }
  try {
    assertStyleCandidateFreezable(version, "接受本轮")
  } catch (error) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: error.message || String(error) }
    renderStyleEvolutionPanel()
    return
  }
  dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: true, message: "", error: "" }
  renderStyleEvolutionPanel()
  try {
    const response = await apiRequest("/api/style-evolution/accept", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        version,
      },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "style_accept_failed")
    }
    updateSnapshot(response.payload)
    dashboardState.styleEvolutionUi = {
      ...dashboardState.styleEvolutionUi,
      loading: false,
      selectedVersion: version || dashboardState.styleEvolutionUi?.selectedVersion || null,
      message: "已接受本轮样段，下一步请预览并冻结全书写法合同。",
      error: "",
    }
  } catch (error) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: error.message || String(error) }
  }
  renderDashboard()
}

async function previewStyleEvolutionFreezeFromPanel(container = null, trigger = null) {
  if (!dashboardState.activeProjectId) return
  container = currentStylePanelContainer(container)
  const version = selectedStyleVersionFromContainer(container, trigger)
  if (!version) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: "请先选择要预览冻结的轮次。" }
    renderStyleEvolutionPanel()
    return
  }
  try {
    assertStyleCandidateFreezable(version, "预览冻结合同")
  } catch (error) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: error.message || String(error) }
    renderStyleEvolutionPanel()
    return
  }
  dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: true, message: "", error: "" }
  renderStyleEvolutionPanel()
  try {
    const response = await apiRequest("/api/style-evolution/freeze-preview", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        version,
      },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "style_freeze_preview_failed")
    }
    updateSnapshot(response.payload)
    dashboardState.styleEvolutionUi = {
      ...dashboardState.styleEvolutionUi,
      loading: false,
      selectedVersion: version || dashboardState.styleEvolutionUi?.selectedVersion || null,
      message: "冻结合同预览已更新。",
      error: "",
    }
  } catch (error) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: error.message || String(error) }
  }
  renderDashboard()
}

async function rejectStyleEvolutionFromPanel(container = null, trigger = null) {
  if (!dashboardState.activeProjectId) return
  container = currentStylePanelContainer(container)
  const version = selectedStyleVersionFromContainer(container, trigger)
  const scopedReasonRoot = trigger?.closest?.(".style-freeze-action-strip, .style-iteration-flow-card.is-gate")
  const rejectionReason = scopedReasonRoot?.querySelector("[data-style-rejection-reason]")?.value?.trim()
    || container?.querySelector("[data-style-rejection-reason]")?.value?.trim()
    || ""
  if (!version) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: "请先选择要退回的轮次。" }
    renderStyleEvolutionPanel()
    return
  }
  try {
    assertStyleCandidateRejectable(version)
  } catch (error) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: error.message || String(error) }
    renderStyleEvolutionPanel()
    return
  }
  if (!rejectionReason) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: "请先填写退回原因，系统才知道下一轮该修什么。" }
    renderStyleEvolutionPanel()
    return
  }
  dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: true, message: "", error: "", rejectionReasonDraft: rejectionReason }
  renderStyleEvolutionPanel()
  try {
    const response = await apiRequest("/api/style-evolution/reject", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        version,
        rejectionReason,
      },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "style_rejection_failed")
    }
    updateSnapshot(response.payload)
    dashboardState.styleEvolutionUi = {
      ...dashboardState.styleEvolutionUi,
      loading: false,
      selectedVersion: version || dashboardState.styleEvolutionUi?.selectedVersion || null,
      rejectionReasonDraft: rejectionReason,
      message: "已退回当前轮，下一轮会自动吸收这条拒绝理由。",
      error: "",
    }
  } catch (error) {
    dashboardState.styleEvolutionUi = { ...dashboardState.styleEvolutionUi, loading: false, message: "", error: error.message || String(error) }
  }
  renderDashboard()
}

function selectStyleEvolutionVersion(version) {
  dashboardState.styleEvolutionUi = {
    ...dashboardState.styleEvolutionUi,
    selectedVersion: Number(version || 0) || null,
    freezePreview: null,
    message: "",
    error: "",
  }
  renderStyleEvolutionPanel()
}

function handleStyleEvolutionPanelClick(event) {
  const container = stylePanelContainerFromEvent(event)
  if (!container?.contains(event.target)) return false
  if (event.target.closest("[data-style-init]")) {
    initializeStyleEvolutionFromPanel(container)
    return true
  }
  if (event.target.closest("[data-style-refresh]")) {
    refreshStyleEvolution()
    return true
  }
  if (event.target.closest("[data-style-generate-candidate]")) {
    generateStyleEvolutionCandidateFromPanel(container)
    return true
  }
  if (event.target.closest("[data-style-save-candidate]")) {
    saveStyleEvolutionCandidateFromPanel(container)
    return true
  }
  const acceptButton = event.target.closest("[data-style-accept]")
  if (acceptButton) {
    acceptStyleEvolutionFromPanel(container, acceptButton)
    return true
  }
  const approveButton = event.target.closest("[data-style-approve]")
  if (approveButton) {
    approveStyleEvolutionFromPanel(container, approveButton)
    return true
  }
  const freezePreviewButton = event.target.closest("[data-style-freeze-preview]")
  if (freezePreviewButton) {
    previewStyleEvolutionFreezeFromPanel(container, freezePreviewButton)
    return true
  }
  const rejectButton = event.target.closest("[data-style-reject]")
  if (rejectButton) {
    rejectStyleEvolutionFromPanel(container, rejectButton)
    return true
  }
  const selectVersionButton = event.target.closest("[data-style-select-version]")
  if (selectVersionButton) {
    selectStyleEvolutionVersion(selectVersionButton.dataset.styleSelectVersion)
    return true
  }
  if (event.target.closest("[data-open-style-workspace]")) {
    setWorkspaceView("style")
    return true
  }
  return false
}

function handleStyleEvolutionPanelChange(event) {
  const select = event.target.closest?.("[data-style-approve-version]")
  if (!select) return false
  const container = stylePanelContainerFromEvent(event)
  if (!container?.contains(event.target)) return false
  selectStyleEvolutionVersion(select.value)
  return true
}

function handleStyleEvolutionPanelInput(event) {
  const input = event.target.closest?.("[data-style-rejection-reason]")
  if (!input) return false
  const container = stylePanelContainerFromEvent(event)
  if (!container?.contains(event.target)) return false
  const rejectionDraft = String(input.value || "")
  dashboardState.styleEvolutionUi = {
    ...dashboardState.styleEvolutionUi,
    rejectionReasonDraft: rejectionDraft,
  }
  document.querySelectorAll("[data-style-rejection-reason]").forEach((field) => {
    if (field !== input && field.value !== rejectionDraft) {
      field.value = rejectionDraft
    }
  })
  const styleEvolution = dashboardState.styleEvolution || null
  const contract = styleEvolution?.contract || {}
  const selected = selectedStyleCandidate(styleEvolution)
  const evaluation = selected?.evaluation || {}
  const refinement = selected?.refinement || {}
  const verification = styleSelectedVerificationSnapshot(selected, contract)
  const previewHtml = `
    <b>退回后下一轮注入预览</b>
    ${renderRejectionInjectionPreview({ selected, rejectionDraft, refinement, evaluation, verification })}
  `
  document.querySelectorAll("[data-style-rejection-preview]").forEach((preview) => {
    preview.innerHTML = previewHtml
  })
  return true
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
  const recentEntries = model.discussion.recent.filter((entry) => {
    const identity = entryIdentity(entry)
    return !identity || !liveIdentities.has(identity)
  })
  const allEntries = buildRenderableDiscussionEntries({
    recentEntries,
    pendingUserMessages: dashboardState.pendingUserMessages,
    liveDiscussion: dashboardState.liveDiscussion,
  })
  const hasLiveEntries = dashboardState.pendingUserMessages.length > 0 || dashboardState.liveDiscussion.length > 0
  const entrySignature = allEntries
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
    renderDiscussionContextBanner(model, allEntries.length, hasLiveEntries),
  )
  patchHtmlRegion("[data-discussion-history-region]", renderDiscussionHistoryBar())
  patchHtmlRegion(
    "[data-discussion-empty-region]",
    allEntries.length === 0
      ? `<div class="system-log-message">
        <i class="fa-solid fa-circle-info"></i>
        <span class="log-text">当前还没有讨论记录。输入一句想法，编剧室会实时开始讨论。</span>
      </div>`
      : "",
  )

  if (shellCreated || dashboardState.discussionStaticSignature !== signature) {
    dashboardState.discussionStaticSignature = signature
    patchDiscussionEntries(chatMessagesBox.querySelector("[data-discussion-static-region]"), allEntries)
    patchHtmlRegion("[data-live-region]", "")
    patchHtmlRegion("[data-discussion-result-region]", renderDiscussionHtml({
      result: dashboardState.lastDiscussionResult,
      entries: [],
      roleMeta,
      expandedKeys: dashboardState.expandedDiscussionKeys,
      formatClock: formatDiscussionClock,
    }))
  }

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

async function loadWritingSettings() {
  try {
    const res = await fetch("/api/settings/writing")
    if (res.ok) {
      const data = await res.json()
      if (data && data.settings) {
        settingBypassAigc.checked = Boolean(data.settings.bypassAigcGate)
        settingAutoRefine.checked = Boolean(data.settings.autoAigcRefinement)
        const enabledDraftSubcallRoles = new Set(Array.isArray(data.settings.draftSubcallRoles) ? data.settings.draftSubcallRoles : [])
        draftSubcallRoleCheckboxes.forEach((checkbox) => {
          checkbox.checked = enabledDraftSubcallRoles.has(checkbox.dataset.draftSubcallRole)
        })
      }
    }
  } catch (e) {
    console.error("Failed to load writing settings:", e)
  }
}

async function saveWritingSettings() {
  writingSettingsStatus.style.display = "none"
  writingSettingsSaveButton.disabled = true
  try {
    const res = await fetch("/api/settings/writing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        settings: {
          bypassAigcGate: settingBypassAigc.checked,
          autoAigcRefinement: settingAutoRefine.checked,
          draftSubcallRoles: draftSubcallRoleCheckboxes
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => checkbox.dataset.draftSubcallRole)
            .filter(Boolean),
        }
      })
    })
    if (res.ok) {
      writingSettingsStatus.className = "modal-status is-success"
      writingSettingsStatusText.textContent = "写作与开发设置已成功保存！"
    } else {
      writingSettingsStatus.className = "modal-status is-error"
      writingSettingsStatusText.textContent = "保存设置失败，请重试。"
    }
  } catch (e) {
    writingSettingsStatus.className = "modal-status is-error"
    writingSettingsStatusText.textContent = `保存出错: ${e.message}`
  } finally {
    writingSettingsStatus.style.display = "flex"
    writingSettingsSaveButton.disabled = false
    setTimeout(() => {
      writingSettingsStatus.style.display = "none"
    }, 3000)
  }
}

function showRefineProgress(title, percent, kind = "") {
  refineProgressContainer.classList.remove("hidden")
  refineProgressTitle.textContent = title
  refineProgressPercent.textContent = `${percent}%`
  refineProgressFill.style.width = `${percent}%`
  if (kind === "is-error") {
    refineProgressContainer.style.background = "rgba(239, 68, 68, 0.05)"
    refineProgressContainer.style.borderColor = "rgba(239, 68, 68, 0.2)"
  } else {
    refineProgressContainer.style.background = "rgba(168, 85, 247, 0.03)"
    refineProgressContainer.style.borderColor = "var(--border-color-glow)"
  }
}

function hideRefineProgress() {
  refineProgressContainer.classList.add("hidden")
}

function aigcResultStatus(result = {}) {
  const publishReadiness = result?.publishReadiness || {}
  const report = result?.persistedReport || result?.finalReport || result?.report || result
  const styleDrift = result?.persistedStyleConformanceDrift || result?.styleConformanceDrift || {}
  if (result?.error) return "blocked"
  if (publishReadiness.ready === false) return "blocked"
  if (report?.status === "blocked" || report?.status === "unavailable") return "blocked"
  if (styleDrift?.status && styleDrift.status !== "conformant") return "blocked"
  if (publishReadiness.ready === true && report?.status === "passed" && (!styleDrift?.status || styleDrift.status === "conformant")) return "passed"
  if (report?.status === "passed" && (!styleDrift?.status || styleDrift.status === "conformant")) return "passed"
  return "pending"
}

function aigcResultMessage(result = {}) {
  const publishReadiness = result?.publishReadiness || {}
  const report = result?.persistedReport || result?.finalReport || result?.report || result
  const styleDrift = result?.persistedStyleConformanceDrift || result?.styleConformanceDrift || {}
  const missing = Array.isArray(publishReadiness?.missing)
    ? publishReadiness.missing.map((entry) => entry?.label || entry?.id).filter(Boolean)
    : []
  return result?.blockedReason
    || result?.reason
    || result?.error
    || report?.reason
    || styleDrift?.reason
    || (missing.length ? `发布检查缺少：${missing.join("、")}` : "")
    || ""
}

window.previewChapterInRefine = function(chapterNumber) {
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
  openChapterPreview(chapterId)
}

window.refineChapterSingle = async function(chapterNumber) {
  showRefineProgress(`正在精修第 ${chapterNumber} 章...`, 30)
  try {
    const res = await fetch("/api/aigc/batch-refine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId: dashboardState.activeProjectId, chapterNumber })
    })
    if (res.ok) {
      const data = await res.json()
      showRefineProgress(`第 ${chapterNumber} 章精修完成！`, 100)
      setTimeout(() => hideRefineProgress(), 1500)
      if (dashboardState.state && dashboardState.state.plan && dashboardState.state.plan.chapterTasks) {
        const task = dashboardState.state.plan.chapterTasks.find(t => t.chapterNumber === chapterNumber)
        if (task && data.payload && data.payload.results && data.payload.results[chapterNumber]) {
          const result = data.payload.results[chapterNumber]
          task.aigcStatus = aigcResultStatus(result)
          task.aigcReason = aigcResultMessage(result)
          renderDashboard()
        }
      }
    } else {
      let payload = {}
      try { payload = await res.json() } catch {}
      updateSnapshot(payload)
      renderDashboard()
      showRefineProgress(payload.reason || payload.error || "精修失败，请重试。", 100, "is-error")
      setTimeout(() => hideRefineProgress(), 2000)
    }
  } catch (e) {
    showRefineProgress(`精修失败: ${e.message}`, 100, "is-error")
    setTimeout(() => hideRefineProgress(), 2000)
  }
}

function renderAigcRefinementPanel(model) {
  const isRefineStage = model.workflow?.currentStage?.key === "aigc_refinement"
  aigcRefinementPanel.classList.toggle("hidden", !isRefineStage)
  studioWorkspaceShell?.classList.toggle("hidden", isRefineStage)
  chatMessagesBox.classList.toggle("hidden", false)

  const composer = document.querySelector(".composer-container")
  if (composer) {
    composer.classList.toggle("hidden", isRefineStage)
  }
  document.getElementById("btn-scroll-bottom")?.classList.toggle("hidden", isRefineStage)

  if (!isRefineStage) return

  const tasks = Array.isArray(model.state?.plan?.chapterTasks) ? model.state.plan.chapterTasks : []
  refineStatTotal.textContent = tasks.length

  let pendingCount = 0
  let blockedCount = 0
  let passedCount = 0

  refineChaptersGrid.innerHTML = tasks.map((task) => {
    const status = task.aigcStatus || "pending"
    const reason = String(task.aigcReason || "").trim()
    if (status === "pending") pendingCount++
    else if (status === "blocked") blockedCount++
    else if (status === "passed" || status === "skipped") passedCount++

    let statusPill = `<span style="font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600; background:rgba(245,158,11,0.1); color:var(--warning-color);"><i class="fa-solid fa-clock"></i> 待检测</span>`
    if (status === "passed") {
      statusPill = `<span style="font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600; background:rgba(16,185,129,0.1); color:var(--success-color);"><i class="fa-solid fa-circle-check"></i> 安全</span>`
    } else if (status === "blocked") {
      statusPill = `<span style="font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600; background:rgba(239,68,68,0.1); color:var(--danger-color);"><i class="fa-solid fa-circle-exclamation"></i> AI痕迹重</span>`
    } else if (status === "skipped") {
      statusPill = `<span style="font-size:11px; padding:2px 6px; border-radius:4px; font-weight:600; background:rgba(255,255,255,0.05); color:var(--text-muted);"><i class="fa-solid fa-angles-right"></i> 已旁路</span>`
    }

    return `
      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:8px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div>
            <strong style="font-size:12px; color:var(--primary-color); display:block; margin-bottom:2px;">第 ${task.chapterNumber} 章</strong>
            <h5 style="font-size:14px; color:var(--text-main); font-weight:600; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</h5>
            ${reason ? `<p style="margin:6px 0 0; font-size:11px; line-height:1.45; color:var(--text-muted); max-width:220px;">${escapeHtml(reason)}</p>` : ""}
          </div>
          ${statusPill}
        </div>
        <div style="display:flex; gap:8px; border-top:1px solid rgba(255,255,255,0.03); padding-top:10px;">
          <button class="btn-command" onclick="previewChapterInRefine(${task.chapterNumber})" type="button" style="flex:1; padding:4px 8px; font-size:12px; background:rgba(255,255,255,0.03); color:var(--text-main); border:1px solid var(--border-color);">
            <i class="fa-regular fa-eye"></i> 预览
          </button>
          <button class="btn-command" onclick="refineChapterSingle(${task.chapterNumber})" type="button" style="flex:1; padding:4px 8px; font-size:12px; background:rgba(168,85,247,0.1); color:var(--primary-color); border:1px solid rgba(168,85,247,0.2);" ${status === "passed" ? "disabled style='opacity:0.5;'" : ""}>
            <i class="fa-solid fa-wand-magic-sparkles"></i> 精修
          </button>
        </div>
      </div>
    `
  }).join("\n")

  refineStatPending.textContent = pendingCount
  refineStatBlocked.textContent = blockedCount
  refineStatPassed.textContent = passedCount
}

function renderInitPanel(model) {
  const hasActiveProject = Boolean(dashboardState.activeProjectId)
  initPanel.classList.toggle("hidden", !hasActiveProject || model.initialized)
}

function showCoverLightbox(dataUrl) {
  const lightboxModal = document.getElementById("cover-preview-lightbox-modal")
  const lightboxImage = document.getElementById("cover-lightbox-image")
  if (lightboxModal && lightboxImage) {
    lightboxImage.src = dataUrl
    lightboxModal.classList.remove("hidden")
  }
}

function closeCoverLightbox() {
  const lightboxModal = document.getElementById("cover-preview-lightbox-modal")
  const lightboxImage = document.getElementById("cover-lightbox-image")
  if (lightboxModal) {
    lightboxModal.classList.add("hidden")
  }
  if (lightboxImage) {
    lightboxImage.src = ""
  }
}

function readerChapters() {
  return Array.isArray(dashboardState.reader.snapshot?.chapters)
    ? dashboardState.reader.snapshot.chapters
    : []
}

function currentReaderChapter() {
  const chapters = readerChapters()
  return chapters.find((chapter) => Number(chapter.chapterNumber) === Number(dashboardState.reader.chapterNumber))
    || chapters.find((chapter) => chapter.hasBody || chapter.body)
    || chapters[0]
    || null
}

function currentReaderBookmark() {
  const chapterNumber = Number(dashboardState.reader.chapterNumber)
  return (dashboardState.reader.bookmarks || []).find((bookmark) => Number(bookmark.chapterNumber) === chapterNumber) || null
}

function toggleReaderBookmark() {
  const chapter = currentReaderChapter()
  if (!chapter || !dashboardState.activeProjectId) return
  const chapterNumber = Number(chapter.chapterNumber)
  const bookmarks = dashboardState.reader.bookmarks || []
  const existingIndex = bookmarks.findIndex((bookmark) => Number(bookmark.chapterNumber) === chapterNumber)
  if (existingIndex >= 0) {
    bookmarks.splice(existingIndex, 1)
  } else {
    bookmarks.push({
      chapterNumber,
      title: chapter.title || `第 ${chapterNumber} 章`,
      note: "",
      scrollRatio: currentReaderScrollRatio(),
      updatedAt: new Date().toISOString(),
    })
    bookmarks.sort((left, right) => Number(left.chapterNumber) - Number(right.chapterNumber))
  }
  dashboardState.reader.bookmarks = bookmarks
  saveReaderBookmarks()
  renderReaderView()
}

function updateReaderBookmarkNote(chapterNumber, note) {
  const bookmark = (dashboardState.reader.bookmarks || []).find((entry) => Number(entry.chapterNumber) === Number(chapterNumber))
  if (!bookmark) return
  bookmark.note = String(note || "")
  bookmark.updatedAt = new Date().toISOString()
  saveReaderBookmarks()
  renderReaderBookmarkButton()
}

function highlightReaderText(value, query) {
  const html = escapeHtml(value)
  const needle = String(query || "").trim()
  if (!needle) return html
  const escapedNeedle = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return html.replace(new RegExp(escapedNeedle, "gi"), (match) => `<mark>${match}</mark>`)
}

function markdownishToReaderHtml(text, query = "") {
  const blocks = String(text || "").replace(/\r\n/g, "\n").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  if (blocks.length === 0) {
    return `<div class="reader-empty-state"><i class="fa-regular fa-file-lines"></i><strong>这一章还没有可读正文</strong></div>`
  }
  return blocks.map((block) => {
    const heading = block.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = Math.min(3, heading[1].length + 1)
      return `<h${level}>${highlightReaderText(heading[2], query)}</h${level}>`
    }
    return `<p>${highlightReaderText(block, query).replace(/\n/g, "<br>")}</p>`
  }).join("")
}

function readerPlainPreview(text = "", max = 160) {
  const compact = String(text).replace(/[#>*_\-\[\]()`]/g, "").replace(/\s+/g, " ").trim()
  return compact.length > max ? `${compact.slice(0, max).trim()}...` : compact
}

function readerFilteredChapters() {
  const query = dashboardState.reader.search.trim().toLowerCase()
  const filter = dashboardState.reader.catalogFilter || "all"
  const bookmarkNumbers = new Set((dashboardState.reader.bookmarks || []).map((bookmark) => Number(bookmark.chapterNumber)))
  return readerChapters().filter((chapter) => {
    const chapterNumber = Number(chapter.chapterNumber)
    const progress = dashboardState.reader.chapterProgress?.[String(chapterNumber)] || {}
    if (filter === "unread" && progress.completed) return false
    if (filter === "bookmarked" && !bookmarkNumbers.has(chapterNumber)) return false
    if (!query) return true
    return String(chapter.title || "").toLowerCase().includes(query)
      || String(chapter.summary || "").toLowerCase().includes(query)
      || String(chapter.body || "").toLowerCase().includes(query)
  })
}

function scheduleReaderSearch() {
  if (dashboardState.reader.searchTimer) {
    window.clearTimeout(dashboardState.reader.searchTimer)
  }
  const query = dashboardState.reader.search.trim()
  if (!query || !dashboardState.activeProjectId) {
    dashboardState.reader.searchResults = []
    dashboardState.reader.searchLoading = false
    dashboardState.reader.searchError = ""
    renderReaderCatalog()
    return
  }
  dashboardState.reader.searchLoading = true
  dashboardState.reader.searchError = ""
  renderReaderCatalog()
  dashboardState.reader.searchTimer = window.setTimeout(() => {
    dashboardState.reader.searchTimer = null
    runReaderSearch(query)
  }, 350)
}

async function runReaderSearch(query) {
  if (!dashboardState.activeProjectId || query !== dashboardState.reader.search.trim()) return
  try {
    const params = new URLSearchParams({
      projectId: dashboardState.activeProjectId,
      query,
      limit: "40",
    })
    const response = await apiRequest(`/api/reader-search?${params.toString()}`)
    if (!response.ok) {
      throw new Error(response.payload?.error || `reader search failed: ${response.status}`)
    }
    if (query === dashboardState.reader.search.trim()) {
      dashboardState.reader.searchResults = Array.isArray(response.payload?.results) ? response.payload.results : []
      dashboardState.reader.searchError = ""
    }
  } catch (error) {
    if (query === dashboardState.reader.search.trim()) {
      dashboardState.reader.searchResults = []
      dashboardState.reader.searchError = networkErrorMessage(error)
    }
  } finally {
    if (query === dashboardState.reader.search.trim()) {
      dashboardState.reader.searchLoading = false
      renderReaderCatalog()
    }
  }
}

function mergeReaderChapter(chapter) {
  if (!dashboardState.reader.snapshot || !chapter) return
  const chapters = readerChapters()
  const chapterNumber = Number(chapter.chapterNumber)
  const index = chapters.findIndex((entry) => Number(entry.chapterNumber) === chapterNumber)
  const nextChapter = { ...(index >= 0 ? chapters[index] : {}), ...chapter, hasBody: Boolean(chapter.body) }
  if (index >= 0) {
    chapters[index] = nextChapter
  } else {
    chapters.push(nextChapter)
    chapters.sort((left, right) => Number(left.chapterNumber) - Number(right.chapterNumber))
  }
}

async function ensureReaderChapterBody(chapterNumber = dashboardState.reader.chapterNumber, options = {}) {
  const chapter = readerChapters().find((entry) => Number(entry.chapterNumber) === Number(chapterNumber))
  const normalizedChapterNumber = Number(chapterNumber)
  if (!chapter || chapter.body || !chapter.hasBody || dashboardState.reader.chapterLoadingNumbers.has(normalizedChapterNumber)) return
  dashboardState.reader.chapterLoadingNumbers.add(normalizedChapterNumber)
  dashboardState.reader.chapterError = ""
  if (!options.silent) renderReaderView()
  try {
    const params = new URLSearchParams({
      projectId: dashboardState.activeProjectId,
      chapterNumber: String(normalizedChapterNumber),
    })
    const response = await apiRequest(`/api/reader-chapter?${params.toString()}`)
    if (!response.ok) {
      throw new Error(response.payload?.error || `reader chapter failed: ${response.status}`)
    }
    mergeReaderChapter(response.payload?.chapter)
  } catch (error) {
    dashboardState.reader.chapterError = networkErrorMessage(error)
  } finally {
    dashboardState.reader.chapterLoadingNumbers.delete(normalizedChapterNumber)
    renderReaderView()
    if (Number(dashboardState.reader.chapterNumber) === normalizedChapterNumber) {
      restoreReaderScroll(options.scrollRatio ?? 0)
    }
  }
}

async function publishReaderChapterVersion(chapterNumber, versionId) {
  const normalizedChapterNumber = Number(chapterNumber)
  const normalizedVersionId = String(versionId || "").trim()
  if (!dashboardState.activeProjectId || !Number.isFinite(normalizedChapterNumber) || !normalizedVersionId) return
  const chapter = readerChapters().find((entry) => Number(entry.chapterNumber) === normalizedChapterNumber)
  if (chapter?.versionManifest?.publishedVersionId === normalizedVersionId) return
  dashboardState.reader.chapterLoadingNumbers.add(normalizedChapterNumber)
  dashboardState.reader.chapterError = ""
  renderReaderView()
  try {
    const response = await apiRequest("/api/reader-chapter-version", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        chapterNumber: normalizedChapterNumber,
        versionId: normalizedVersionId,
        locked: false,
      },
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || `reader version failed: ${response.status}`)
    }
    if (response.payload?.snapshot) {
      dashboardState.reader.snapshot = response.payload.snapshot
    }
    mergeReaderChapter(response.payload?.chapter)
    dashboardState.reader.chapterNumber = normalizedChapterNumber
  } catch (error) {
    dashboardState.reader.chapterError = networkErrorMessage(error)
  } finally {
    dashboardState.reader.chapterLoadingNumbers.delete(normalizedChapterNumber)
    renderReaderView()
    restoreReaderScroll(0)
  }
}

async function toggleReaderChapterLock(chapterNumber, locked) {
  const normalizedChapterNumber = Number(chapterNumber)
  if (!dashboardState.activeProjectId || !Number.isFinite(normalizedChapterNumber)) return
  const chapter = readerChapters().find((entry) => Number(entry.chapterNumber) === normalizedChapterNumber)
  const versionId = chapter?.versionManifest?.publishedVersionId || chapter?.versionId || chapter?.source || ""
  if (!versionId) return
  dashboardState.reader.chapterLoadingNumbers.add(normalizedChapterNumber)
  dashboardState.reader.chapterError = ""
  dashboardState.reader.versionCompareError = ""
  renderReaderView()
  try {
    const response = await apiRequest("/api/reader-chapter-version", {
      method: "POST",
      body: {
        projectId: dashboardState.activeProjectId,
        chapterNumber: normalizedChapterNumber,
        versionId,
        locked: Boolean(locked),
      },
    })
    if (!response.ok) {
      const missing = Array.isArray(response.payload?.publishReadiness?.missing)
        ? response.payload.publishReadiness.missing.map((entry) => entry.label || entry.id).filter(Boolean).join("、")
        : ""
      throw new Error(missing ? `发布检查未通过：${missing}` : response.payload?.error || `reader lock failed: ${response.status}`)
    }
    if (response.payload?.snapshot) {
      dashboardState.reader.snapshot = response.payload.snapshot
    }
    mergeReaderChapter(response.payload?.chapter)
    dashboardState.reader.chapterNumber = normalizedChapterNumber
  } catch (error) {
    dashboardState.reader.versionCompareError = networkErrorMessage(error)
  } finally {
    dashboardState.reader.chapterLoadingNumbers.delete(normalizedChapterNumber)
    renderReaderView()
  }
}

async function loadReaderVersionComparison(chapterNumber, rightVersionId) {
  const normalizedChapterNumber = Number(chapterNumber)
  const normalizedRightVersionId = String(rightVersionId || "").trim()
  if (!dashboardState.activeProjectId || !Number.isFinite(normalizedChapterNumber) || !normalizedRightVersionId) return
  const chapter = readerChapters().find((entry) => Number(entry.chapterNumber) === normalizedChapterNumber)
  const leftVersionId = chapter?.versionManifest?.publishedVersionId || chapter?.versionId || "final"
  if (leftVersionId === normalizedRightVersionId) {
    dashboardState.reader.versionCompare = null
    dashboardState.reader.versionCompareError = ""
    renderReaderInsights()
    return
  }
  dashboardState.reader.versionCompareLoading = true
  dashboardState.reader.versionCompareError = ""
  renderReaderInsights()
  try {
    const params = new URLSearchParams({
      projectId: dashboardState.activeProjectId,
      chapterNumber: String(normalizedChapterNumber),
      leftVersionId,
      rightVersionId: normalizedRightVersionId,
    })
    const response = await apiRequest(`/api/reader-chapter-versions/compare?${params.toString()}`)
    if (!response.ok) {
      throw new Error(response.payload?.error || `reader compare failed: ${response.status}`)
    }
    dashboardState.reader.versionCompare = response.payload
  } catch (error) {
    dashboardState.reader.versionCompare = null
    dashboardState.reader.versionCompareError = networkErrorMessage(error)
  } finally {
    dashboardState.reader.versionCompareLoading = false
    renderReaderInsights()
  }
}

function readerMainScroller() {
  return document.querySelector(".reader-main")
}

function currentReaderScrollRatio() {
  const scroller = readerMainScroller()
  if (!scroller) return 0
  const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight)
  return Math.max(0, Math.min(1, scroller.scrollTop / max))
}

function updateReaderProgressFill() {
  if (!readerProgressFill) return
  const ratio = currentReaderScrollRatio()
  readerProgressFill.style.width = `${Math.round(ratio * 100)}%`
  updateReaderChapterProgress(ratio)
  updateReaderStatsStrip()
}

function updateReaderChapterProgress(ratio = currentReaderScrollRatio()) {
  if (!dashboardState.activeProjectId || !dashboardState.reader.chapterNumber) return
  const chapterNumber = Number(dashboardState.reader.chapterNumber)
  const key = String(chapterNumber)
  const current = dashboardState.reader.chapterProgress?.[key] || {}
  const nextRatio = Math.max(Number(current.ratio || 0), Math.max(0, Math.min(1, Number(ratio) || 0)))
  const completed = Boolean(current.completed) || nextRatio >= 0.92
  dashboardState.reader.chapterProgress = {
    ...(dashboardState.reader.chapterProgress || {}),
    [key]: {
      ratio: nextRatio,
      completed,
      updatedAt: new Date().toISOString(),
    },
  }
}

function readerReadingMinutes(wordCount = 0) {
  return Math.max(1, Math.ceil(Number(wordCount || 0) / 520))
}

function readerOverallProgress() {
  const chapters = readerChapters()
  const readable = chapters.filter((chapter) => chapter.hasBody || chapter.body)
  if (readable.length === 0) {
    return { completed: 0, total: 0, percent: 0 }
  }
  const progressByChapter = dashboardState.reader.chapterProgress || {}
  const completed = readable.filter((chapter) => {
    const progress = progressByChapter[String(Number(chapter.chapterNumber))] || {}
    return Boolean(progress.completed) || Number(progress.ratio || 0) >= 0.92
  }).length
  return {
    completed,
    total: readable.length,
    percent: Math.round((completed / readable.length) * 100),
  }
}

function readerChapterProgressSummary(chapter = currentReaderChapter()) {
  const progress = dashboardState.reader.chapterProgress?.[String(Number(chapter?.chapterNumber || 0))] || {}
  const ratio = Math.max(0, Math.min(1, Math.max(Number(progress.ratio || 0), currentReaderScrollRatio())))
  return {
    ratio,
    percent: Math.round(ratio * 100),
    completed: Boolean(progress.completed) || ratio >= 0.92,
  }
}

function readerStatsStripHtml(chapter = currentReaderChapter()) {
  if (!chapter) return ""
  const chapterProgress = readerChapterProgressSummary(chapter)
  const overall = readerOverallProgress()
  const bookmarked = Boolean(currentReaderBookmark())
  return `
    <div class="reader-stats-strip" id="reader-stats-strip">
      <span><i class="fa-solid fa-location-dot"></i> 本章 ${chapterProgress.completed ? "已读" : `${chapterProgress.percent}%`}</span>
      <span><i class="fa-solid fa-layer-group"></i> 全书 ${overall.completed}/${overall.total} · ${overall.percent}%</span>
      <span><i class="fa-regular fa-clock"></i> 约 ${readerReadingMinutes(chapter.wordCount)} 分钟</span>
      <span><i class="${bookmarked ? "fa-solid" : "fa-regular"} fa-bookmark"></i> ${bookmarked ? "已加书签" : "未加书签"}</span>
    </div>
  `
}

function updateReaderStatsStrip() {
  const strip = document.getElementById("reader-stats-strip")
  const chapter = currentReaderChapter()
  if (!strip || !chapter) return
  strip.outerHTML = readerStatsStripHtml(chapter)
}

function restoreReaderScroll(scrollRatio = 0) {
  const scroller = readerMainScroller()
  if (!scroller) return
  window.requestAnimationFrame(() => {
    const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
    scroller.scrollTop = Math.round(max * Math.max(0, Math.min(1, Number(scrollRatio) || 0)))
    updateReaderProgressFill()
  })
}

function changeReaderChapter(chapterNumber, options = {}) {
  const chapters = readerChapters()
  const target = chapters.find((chapter) => Number(chapter.chapterNumber) === Number(chapterNumber))
  if (!target) return
  dashboardState.reader.chapterNumber = Number(target.chapterNumber)
  dashboardState.reader.chapterError = ""
  renderReaderView()
  saveReaderProgress(options.scrollRatio ?? 0)
  restoreReaderScroll(options.scrollRatio ?? 0)
  ensureReaderChapterBody(target.chapterNumber, { scrollRatio: options.scrollRatio ?? 0 })
}

function jumpToReaderBookmark(chapterNumber) {
  const bookmark = (dashboardState.reader.bookmarks || []).find((entry) => Number(entry.chapterNumber) === Number(chapterNumber))
  changeReaderChapter(chapterNumber, { scrollRatio: bookmark?.scrollRatio ?? 0 })
}

function adjacentReaderChapter(direction) {
  const chapters = readerChapters().filter((chapter) => chapter.hasBody || chapter.body)
  const currentIndex = chapters.findIndex((chapter) => Number(chapter.chapterNumber) === Number(dashboardState.reader.chapterNumber))
  if (currentIndex < 0) return null
  return chapters[currentIndex + direction] || null
}

function renderReaderCatalog() {
  const chapters = readerFilteredChapters()
  const allChapters = readerChapters()
  const query = dashboardState.reader.search.trim()
  const searchResults = Array.isArray(dashboardState.reader.searchResults) ? dashboardState.reader.searchResults : []
  const progressByChapter = dashboardState.reader.chapterProgress || {}
  if (readerCatalogFilter) {
    readerCatalogFilter.querySelectorAll("[data-reader-catalog-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.readerCatalogFilter === (dashboardState.reader.catalogFilter || "all"))
    })
  }
  if (readerCatalogCount) {
    readerCatalogCount.textContent = query
      ? `${searchResults.length} 条命中`
      : `${chapters.length}/${allChapters.length} 章`
  }
  if (readerChapterSelect) {
    readerChapterSelect.innerHTML = allChapters.map((chapter) => `
      <option value="${Number(chapter.chapterNumber)}"${Number(chapter.chapterNumber) === Number(dashboardState.reader.chapterNumber) ? " selected" : ""}>
        第 ${Number(chapter.chapterNumber)} 章 ${escapeHtml(chapter.title || "")}
      </option>
    `).join("")
  }
  if (!readerCatalogList) return
  const searchHtml = query
    ? `
      <div class="reader-search-results">
        <div class="reader-search-heading">
          <strong>全文搜索</strong>
          <span>${dashboardState.reader.searchLoading ? "搜索中..." : `${searchResults.length} 条结果`}</span>
        </div>
        ${dashboardState.reader.searchError
          ? `<div class="reader-side-empty">${escapeHtml(dashboardState.reader.searchError)}</div>`
          : searchResults.length
            ? searchResults.map((result) => `
              <button class="reader-search-result" type="button" data-reader-search-chapter="${Number(result.chapterNumber)}">
                <span>第 ${Number(result.chapterNumber)} 章 · ${Number(result.matchCount || 1)} 处</span>
                <strong>${escapeHtml(result.title || "未命名章节")}</strong>
                <small>${highlightReaderText(readerPlainPreview(result.snippet || "", 180), query)}</small>
              </button>
            `).join("")
            : `<div class="reader-side-empty">${dashboardState.reader.searchLoading ? "正在扫描已生成正文。" : "没有全文命中。"}</div>`}
      </div>
    `
    : ""
  const chapterHtml = chapters.length
    ? chapters.map((chapter) => `
      <button class="reader-catalog-item${Number(chapter.chapterNumber) === Number(dashboardState.reader.chapterNumber) ? " active" : ""}" type="button" data-reader-chapter="${Number(chapter.chapterNumber)}">
        <span>第 ${Number(chapter.chapterNumber)} 章</span>
        <strong>${escapeHtml(chapter.title || "未命名章节")}</strong>
        <small>${Number(chapter.wordCount || 0).toLocaleString("zh-CN")} 字 · ${escapeHtml(chapter.source || chapter.status || (chapter.hasBody ? "可阅读" : "未生成"))}</small>
        ${(() => {
          const progress = progressByChapter[String(Number(chapter.chapterNumber))] || {}
          const ratio = Math.max(0, Math.min(1, Number(progress.ratio || 0)))
          if (!ratio && !progress.completed) return ""
          const label = progress.completed ? "已读" : `${Math.max(1, Math.round(ratio * 100))}%`
          return `<em class="reader-catalog-progress${progress.completed ? " complete" : ""}"><i style="width:${Math.round(ratio * 100)}%"></i><b>${label}</b></em>`
        })()}
      </button>
    `).join("")
    : `<div class="reader-side-empty">没有匹配的章节。</div>`
  readerCatalogList.innerHTML = `${searchHtml}${chapterHtml}`
}

function renderReaderChapter() {
  const chapter = currentReaderChapter()
  if (!readerPage) return
  if (!chapter) {
    readerPage.innerHTML = `<div class="reader-empty-state"><i class="fa-regular fa-folder-open"></i><strong>还没有可阅读章节</strong></div>`
    if (readerChapterNav) readerChapterNav.innerHTML = ""
    return
  }
  const previousChapter = adjacentReaderChapter(-1)
  const nextChapter = adjacentReaderChapter(1)
  if (readerPrevChapterButton) readerPrevChapterButton.disabled = !previousChapter
  if (readerNextChapterButton) readerNextChapterButton.disabled = !nextChapter
  readerPage.style.setProperty("--reader-font-size", `${dashboardState.reader.fontSize}px`)
  const isCurrentChapterLoading = dashboardState.reader.chapterLoadingNumbers.has(Number(chapter.chapterNumber))
    && Number(chapter.chapterNumber) === Number(dashboardState.reader.chapterNumber)
    && !chapter.body
  const bodyHtml = isCurrentChapterLoading
    ? `<div class="reader-empty-state"><i class="fa-solid fa-spinner fa-spin"></i><strong>正在载入本章正文</strong></div>`
    : dashboardState.reader.chapterError && !chapter.body
      ? `<div class="reader-empty-state"><i class="fa-solid fa-triangle-exclamation"></i><strong>${escapeHtml(dashboardState.reader.chapterError)}</strong></div>`
      : markdownishToReaderHtml(chapter.body || "", dashboardState.reader.search)
  readerPage.innerHTML = `
    <header class="reader-chapter-header">
      <span>第 ${Number(chapter.chapterNumber)} 章</span>
      <h1>${escapeHtml(chapter.title || "未命名章节")}</h1>
      <div>
        <em>${Number(chapter.wordCount || 0).toLocaleString("zh-CN")} 字</em>
        <em>${escapeHtml(chapter.source || chapter.status || "未生成")}</em>
        ${chapter.path ? `<em>${escapeHtml(chapter.path)}</em>` : ""}
      </div>
      ${readerStatsStripHtml(chapter)}
    </header>
    <div class="reader-body">
      ${bodyHtml}
    </div>
  `
  if (readerChapterNav) {
    readerChapterNav.innerHTML = `
      <button type="button" data-reader-nav-chapter="${previousChapter ? Number(previousChapter.chapterNumber) : ""}" ${previousChapter ? "" : "disabled"}>
        <i class="fa-solid fa-arrow-left"></i>
        <span>${previousChapter ? `第 ${Number(previousChapter.chapterNumber)} 章` : "已经是第一章"}</span>
      </button>
      <button type="button" data-reader-nav-chapter="${nextChapter ? Number(nextChapter.chapterNumber) : ""}" ${nextChapter ? "" : "disabled"}>
        <span>${nextChapter ? `第 ${Number(nextChapter.chapterNumber)} 章` : "已经是最新章节"}</span>
        <i class="fa-solid fa-arrow-right"></i>
      </button>
    `
  }
}

function renderReaderBookmarkButton() {
  if (!readerBookmarkToggle) return
  const bookmark = currentReaderBookmark()
  readerBookmarkToggle.classList.toggle("is-active", Boolean(bookmark))
  readerBookmarkToggle.innerHTML = bookmark
    ? `<i class="fa-solid fa-bookmark"></i>`
    : `<i class="fa-regular fa-bookmark"></i>`
  readerBookmarkToggle.title = bookmark ? "移除当前章书签" : "给当前章添加书签"
}

function readerCharacterCards() {
  const dossiers = dashboardState.reader.snapshot?.characters?.dossiers
  if (!Array.isArray(dossiers) || dossiers.length === 0) return ""
  return dossiers.slice(0, 12).map((character) => `
    <div class="reader-info-card">
      <strong>${escapeHtml(character.canonicalName || character.name || character.id || "未命名角色")}</strong>
      <small>${escapeHtml(character.role || "角色")}</small>
      <p>${escapeHtml(readerPlainPreview(character.identityAndRole || character.currentChapterDelta || character.relationshipState || "", 220))}</p>
    </div>
  `).join("")
}

function readerTextCard(title, text) {
  const content = readerPlainPreview(text, 900)
  if (!content) return ""
  return `
    <div class="reader-info-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(content)}</p>
    </div>
  `
}

function readerStructuredListCard(title, items = [], options = {}) {
  if (!Array.isArray(items) || items.length === 0) return ""
  const limit = Number(options.limit || 6)
  const rows = items.slice(0, limit).map((item, index) => {
    const heading = options.heading
      ? options.heading(item, index)
      : item.title || item.name || item.rule || item.operation || item.id || `条目 ${index + 1}`
    const meta = options.meta ? options.meta(item, index) : item.status || item.role || item.sourceChapter || ""
    const body = options.body
      ? options.body(item, index)
      : item.execution || item.sceneObjective || item.delta || item.summary || item.relationshipPressure || item.nextHandoff || ""
    return `
      <li>
        <strong>${escapeHtml(String(heading || ""))}</strong>
        ${meta ? `<small>${escapeHtml(String(meta))}</small>` : ""}
        ${body ? `<p>${escapeHtml(readerPlainPreview(String(body), 180))}</p>` : ""}
      </li>
    `
  }).join("")
  return `
    <div class="reader-info-card reader-structured-card">
      <strong>${escapeHtml(title)}</strong>
      <ul>${rows}</ul>
    </div>
  `
}

function readerRelationshipCards() {
  const snapshot = dashboardState.reader.snapshot || {}
  const foundation = snapshot.lore?.storyFoundation || {}
  const characterDynamics = foundation.characterDynamics || {}
  const relationshipGraph = snapshot.characters?.relationshipGraph || {}
  const relationshipEdges = Array.isArray(relationshipGraph.edges) ? relationshipGraph.edges : []
  const relationshipNodes = Array.isArray(relationshipGraph.nodes) ? relationshipGraph.nodes : []
  const relationshipNodeById = new Map(relationshipNodes.map((node) => [String(node.id), node]))
  const structuredRelationshipCards = relationshipEdges.slice(0, 16).map((edge) => {
    const source = relationshipNodeById.get(String(edge.sourceId))
    const target = relationshipNodeById.get(String(edge.targetId))
    const sourceLabel = edge.sourceName || source?.name || edge.sourceId || "未知角色"
    const targetLabel = edge.targetName || target?.name || edge.targetId || "未知对象"
    return `
      <div class="reader-info-card reader-relation-card reader-character-relation-card">
        <strong>${escapeHtml(sourceLabel)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHtml(targetLabel)}</strong>
        <small>${escapeHtml(edge.label || "关系")} · ${escapeHtml(edge.status || "tracked")}</small>
        <p>${escapeHtml(readerPlainPreview(edge.pressure || "", 180))}</p>
      </div>
    `
  }).join("")
  const graphNodes = Array.isArray(snapshot.graph?.nodes) ? snapshot.graph.nodes : []
  const graphEdges = Array.isArray(snapshot.graph?.edges) ? snapshot.graph.edges : []
  const nodeById = new Map(graphNodes.map((node) => [String(node.id), node]))
  const edgeCards = graphEdges.slice(0, 12).map((edge) => {
    const source = nodeById.get(String(edge.source))
    const target = nodeById.get(String(edge.target))
    const sourceLabel = source?.label || edge.source || "未知节点"
    const targetLabel = target?.label || edge.target || "未知节点"
    return `
      <div class="reader-info-card reader-relation-card">
        <strong>${escapeHtml(sourceLabel)} <i class="fa-solid fa-arrow-right-long"></i> ${escapeHtml(targetLabel)}</strong>
        <small>${escapeHtml(edge.label || "关联")}</small>
      </div>
    `
  }).join("")
  return [
    readerStructuredListCard("结构化人物动态", Array.isArray(characterDynamics.relationshipEntries) ? characterDynamics.relationshipEntries : [], {
      heading: (entry) => entry.name || entry.id || "角色",
      meta: (entry) => entry.role || "relationship",
      body: (entry) => entry.relationshipPressure || entry.desire || entry.delta || "",
    }),
    readerStructuredListCard("章节人物变化", Array.isArray(characterDynamics.chapterStateDeltas) ? characterDynamics.chapterStateDeltas : [], {
      heading: (entry) => `第 ${Number(entry.chapterNumber || 0)} 章`,
      body: (entry) => entry.delta || "",
    }),
    structuredRelationshipCards ? `<div class="reader-relation-list">${structuredRelationshipCards}</div>` : "",
    readerTextCard("人物关系", snapshot.characters?.relations),
    readerTextCard("角色变化", snapshot.characters?.evolution),
    edgeCards ? `<div class="reader-relation-list">${edgeCards}</div>` : "",
  ].filter(Boolean).join("")
}

function readerBookmarkCards() {
  const bookmarks = Array.isArray(dashboardState.reader.bookmarks) ? dashboardState.reader.bookmarks : []
  if (bookmarks.length === 0) {
    return `<div class="reader-side-empty">暂无书签。给当前章节加一个书签后，可以在这里写备注和快速跳回。</div>`
  }
  return bookmarks.map((bookmark) => `
    <div class="reader-info-card reader-bookmark-card${Number(bookmark.chapterNumber) === Number(dashboardState.reader.chapterNumber) ? " active" : ""}">
      <button type="button" class="reader-bookmark-jump" data-reader-bookmark-jump="${Number(bookmark.chapterNumber)}">
        <span>第 ${Number(bookmark.chapterNumber)} 章</span>
        <strong>${escapeHtml(bookmark.title || `第 ${Number(bookmark.chapterNumber)} 章`)}</strong>
      </button>
      <textarea data-reader-bookmark-note="${Number(bookmark.chapterNumber)}" rows="3" placeholder="写一点阅读备注">${escapeHtml(bookmark.note || "")}</textarea>
    </div>
  `).join("")
}

function renderReaderInsights() {
  const panel = dashboardState.reader.panel
  const snapshot = dashboardState.reader.snapshot || {}
  const chapter = currentReaderChapter()
  if (readerTabs) {
    readerTabs.querySelectorAll("[data-reader-panel]").forEach((button) => {
      button.classList.toggle("active", button.dataset.readerPanel === panel)
    })
  }
  if (!readerInsightBody) return
  if (!snapshot.project) {
    readerInsightBody.innerHTML = `<div class="reader-side-empty">等待项目资料载入。</div>`
    return
  }

  if (panel === "characters") {
    readerInsightBody.innerHTML = readerCharacterCards()
      || readerTextCard("人物档案", snapshot.characters?.dossiersMarkdown)
      || `<div class="reader-side-empty">暂无人物档案。</div>`
    return
  }
  if (panel === "relationships") {
    readerInsightBody.innerHTML = readerRelationshipCards()
      || `<div class="reader-side-empty">暂无关系资料。</div>`
    return
  }
  if (panel === "lore") {
    const foundation = snapshot.lore?.storyFoundation || {}
    const worldMatrix = foundation.worldMatrix || {}
    const storyContract = foundation.contract || {}
    readerInsightBody.innerHTML = [
      storyContract?.genre?.readerPromise ? readerTextCard("读者承诺", storyContract.genre.readerPromise) : "",
      readerStructuredListCard("世界规则", Array.isArray(worldMatrix.rules) ? worldMatrix.rules : [], {
        heading: (entry) => entry.rule || entry.id || "世界规则",
        meta: (entry) => entry.id || entry.source || "",
        body: (entry) => entry.execution || entry.rule || "",
      }),
      Array.isArray(worldMatrix.continuityAnchors) && worldMatrix.continuityAnchors.length
        ? readerTextCard("连续性锚点", worldMatrix.continuityAnchors.join("、"))
        : "",
      readerTextCard("活跃世界观切片", snapshot.lore?.activeWorldSlice),
      readerTextCard("世界观冻结", snapshot.lore?.settingFreeze),
      readerTextCard("全局共识", snapshot.lore?.globalConsensus),
      readerTextCard("当前上下文", snapshot.lore?.currentContext),
    ].filter(Boolean).join("") || `<div class="reader-side-empty">暂无世界观资料。</div>`
    return
  }
  if (panel === "plot") {
    const foundation = snapshot.lore?.storyFoundation || {}
    const plotArchitecture = foundation.plotArchitecture || foundation.contract?.plot || {}
    const foreshadowingLedger = foundation.foreshadowingLedger || foundation.contract?.foreshadowing || {}
    const writingPlan = foundation.writingPlan || {}
    const graphNodes = Array.isArray(snapshot.graph?.nodes) ? snapshot.graph.nodes : []
    readerInsightBody.innerHTML = [
      chapter?.summary ? readerTextCard("本章任务", chapter.summary) : "",
      readerStructuredListCard("章节因果线", Array.isArray(plotArchitecture.chapters) ? plotArchitecture.chapters : [], {
        heading: (entry) => `第 ${Number(entry.chapterNumber || 0)} 章 · ${entry.title || ""}`,
        meta: (entry) => entry.status || entry.macroBeat || "",
        body: (entry) => entry.sceneObjective || entry.event || entry.nextHandoff || "",
      }),
      readerStructuredListCard("伏笔账本", Array.isArray(foreshadowingLedger.entries) ? foreshadowingLedger.entries : [], {
        heading: (entry) => `第 ${Number(entry.sourceChapter || entry.chapterNumber || 0)} 章`,
        meta: (entry) => entry.status || entry.payoffMode || "",
        body: (entry) => entry.operation || entry.expectedAdvance || "",
      }),
      readerStructuredListCard("写作执行计划", Array.isArray(writingPlan.chapters) ? writingPlan.chapters : [], {
        heading: (entry) => `第 ${Number(entry.chapterNumber || 0)} 章 · ${entry.title || ""}`,
        meta: (entry) => entry.status || "",
        body: (entry) => `${entry.filePath || ""}${entry.qualityPass === true ? " · quality passed" : ""}`,
      }),
      readerTextCard("主线规划", snapshot.lore?.masterOutline || snapshot.lore?.planBrief),
      graphNodes.slice(0, 10).map((node) => `
        <div class="reader-info-card">
          <strong>${escapeHtml(node.label)}</strong>
          <small>${escapeHtml(node.type)}</small>
          <p>${escapeHtml(readerPlainPreview(node.summary, 180))}</p>
        </div>
      `).join(""),
    ].filter(Boolean).join("") || `<div class="reader-side-empty">暂无剧情资料。</div>`
    return
  }
  if (panel === "memory") {
    const memories = Array.isArray(snapshot.memories) ? snapshot.memories : []
    const currentMemory = memories.find((entry) => Number(entry.chapterNumber) === Number(chapter?.chapterNumber))
    readerInsightBody.innerHTML = currentMemory
      ? readerTextCard(currentMemory.title, currentMemory.content)
      : memories.slice(-5).reverse().map((entry) => readerTextCard(entry.title, entry.content)).join("") || `<div class="reader-side-empty">暂无章节记忆。</div>`
    return
  }
  if (panel === "bookmarks") {
    readerInsightBody.innerHTML = readerBookmarkCards()
    return
  }
  if (panel === "quality") {
    const gate = chapter?.qualityGate || {}
    const versionManifest = chapter?.versionManifest || {}
    const publishReadiness = chapter?.publishReadiness || versionManifest.publishReadiness || {}
    const missingReadiness = Array.isArray(publishReadiness.missing) ? publishReadiness.missing : []
    const versions = Array.isArray(versionManifest.versions) ? versionManifest.versions : []
    const styleInheritanceRows = buildReaderStyleInheritanceRows({
      chapter,
      snapshot,
    })
    const styleDriftRows = buildReaderStyleDriftRows({
      chapter,
      snapshot,
    })
    const comparison = dashboardState.reader.versionCompare
    const comparisonStats = comparison?.comparison || {}
    const addedPreview = Array.isArray(comparisonStats.addedPreview) ? comparisonStats.addedPreview : []
    const removedPreview = Array.isArray(comparisonStats.removedPreview) ? comparisonStats.removedPreview : []
    const diffPreviewCard = comparison && (addedPreview.length || removedPreview.length)
      ? `
        <div class="reader-version-diff-list">
          ${addedPreview.length ? `
            <section>
              <span>候选新增</span>
              ${addedPreview.slice(0, 3).map((paragraph) => `<p>${escapeHtml(readerPlainPreview(paragraph, 180))}</p>`).join("")}
            </section>
          ` : ""}
          ${removedPreview.length ? `
            <section>
              <span>当前移除</span>
              ${removedPreview.slice(0, 3).map((paragraph) => `<p>${escapeHtml(readerPlainPreview(paragraph, 180))}</p>`).join("")}
            </section>
          ` : ""}
        </div>
      `
      : ""
    const comparisonCard = dashboardState.reader.versionCompareLoading
      ? `<div class="reader-info-card reader-version-compare"><strong>版本对比</strong><p>正在读取版本差异...</p></div>`
      : dashboardState.reader.versionCompareError
        ? `<div class="reader-info-card reader-version-compare"><strong>版本对比</strong><p>${escapeHtml(dashboardState.reader.versionCompareError)}</p></div>`
        : comparison
          ? `
            <div class="reader-info-card reader-version-compare">
              <strong>版本对比</strong>
              <small>${escapeHtml(comparison.left?.label || comparison.left?.id || "当前")} -> ${escapeHtml(comparison.right?.label || comparison.right?.id || "候选")}</small>
              <p>新增 ${Number(comparisonStats.addedParagraphs || 0)} 段，移除 ${Number(comparisonStats.removedParagraphs || 0)} 段，保留 ${Number(comparisonStats.unchangedParagraphs || 0)} 段。</p>
              <div class="reader-version-preview-grid">
                <section>
                  <span>${escapeHtml(comparison.left?.label || comparison.left?.id || "当前版本")} · ${Number(comparison.left?.wordCount || 0).toLocaleString("zh-CN")} 字</span>
                  <p>${escapeHtml(readerPlainPreview(comparison.left?.preview || "", 520))}</p>
                </section>
                <section>
                  <span>${escapeHtml(comparison.right?.label || comparison.right?.id || "候选版本")} · ${Number(comparison.right?.wordCount || 0).toLocaleString("zh-CN")} 字</span>
                  <p>${escapeHtml(readerPlainPreview(comparison.right?.preview || "", 520))}</p>
                </section>
              </div>
              ${diffPreviewCard}
              <button type="button" class="reader-version-apply" data-reader-version-apply="${escapeHtml(comparison.right?.id || "")}" data-reader-version-chapter="${Number(comparison.chapterNumber || chapter?.chapterNumber || dashboardState.reader.chapterNumber || 0)}">设为当前阅读版本</button>
            </div>
          `
          : ""
    const versionCards = versions.slice(0, 6).map((entry) => {
      const isActive = entry.id === versionManifest.publishedVersionId
      return `
      <button type="button" class="reader-version-row${isActive ? " active" : ""}" data-reader-version-id="${escapeHtml(entry.id || entry.source || "")}" data-reader-version-chapter="${Number(chapter?.chapterNumber || dashboardState.reader.chapterNumber || 0)}" ${isActive ? "disabled" : ""}>
        <span>${escapeHtml(entry.label || entry.id || entry.source || "版本")}</span>
        <small>${escapeHtml(isActive ? "当前" : entry.status || entry.source || "")}</small>
        <em>${Number(entry.wordCount || 0).toLocaleString("zh-CN")} 字</em>
      </button>
    `
    }).join("")
    readerInsightBody.innerHTML = `
      <div class="reader-info-card">
        <strong>阅读统计</strong>
        <p>可读章节 ${Number(snapshot.stats?.readableChapters || 0)}/${Number(snapshot.stats?.totalChapters || 0)}，正文约 ${Number(snapshot.stats?.totalWords || 0).toLocaleString("zh-CN")} 字。</p>
      </div>
      ${versions.length ? `
        <div class="reader-info-card reader-version-card">
          <strong>发布版本</strong>
          <small>${escapeHtml(versionManifest.locked ? "已封版" : "待确认")} · ${escapeHtml(publishReadiness.ready ? "发布检查通过" : "发布检查待补齐")}</small>
          <p>当前阅读：${escapeHtml(versionManifest.publishedVersionId || chapter?.versionId || chapter?.source || "final")}</p>
          <div class="reader-publish-readiness ${publishReadiness.ready ? "ready" : "needs-review"}">
            <span>${escapeHtml(publishReadiness.ready ? "可发布" : `缺 ${missingReadiness.length || 0} 项`)}</span>
            <p>${escapeHtml(publishReadiness.ready ? "版本、质量门禁、记忆、关系、世界观和伏笔账本均已就绪。" : missingReadiness.map((entry) => entry.label || entry.id).join("、") || "等待发布检查。")}</p>
          </div>
          <div class="reader-version-list">${versionCards}</div>
          <button type="button" class="reader-version-lock" data-reader-version-lock="${versionManifest.locked ? "0" : "1"}" data-reader-version-chapter="${Number(chapter?.chapterNumber || dashboardState.reader.chapterNumber || 0)}">${versionManifest.locked ? "取消封版" : "通过检查并封版"}</button>
          ${comparisonCard}
        </div>
      ` : ""}
      <div class="reader-info-card">
        <strong>当前章节质量</strong>
        <small>${escapeHtml(gate.status || chapter?.status || "unknown")}</small>
        <p>${escapeHtml(readerPlainPreview(gate.reason || gate.summary || "暂无质量说明。", 240))}</p>
      </div>
      <div class="reader-info-card reader-style-inheritance-card">
        <strong>写法继承</strong>
        <small>${escapeHtml(styleInheritanceRows[0] || "等待冻结写法合同")}</small>
        <ul>
          ${styleInheritanceRows.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
      <div class="reader-info-card reader-style-inheritance-card">
        <strong>合同偏离风险</strong>
        <small>${escapeHtml(styleDriftRows[0] || "等待更多章节证据")}</small>
        <ul>
          ${styleDriftRows.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    `
  }
}

function renderReaderView() {
  if (!readerView) return
  readerView.dataset.theme = dashboardState.reader.theme
  readerView.dataset.width = dashboardState.reader.width
  readerView.classList.toggle("is-loading", dashboardState.reader.loading)
  readerView.classList.toggle("is-focus-mode", dashboardState.reader.focusMode)
  readerView.classList.toggle("is-catalog-collapsed", dashboardState.reader.catalogCollapsed)
  readerView.classList.toggle("is-insights-collapsed", dashboardState.reader.insightsCollapsed)
  if (readerCatalogToggle) {
    readerCatalogToggle.classList.toggle("is-active", !dashboardState.reader.catalogCollapsed)
    readerCatalogToggle.title = dashboardState.reader.catalogCollapsed ? "显示目录" : "隐藏目录"
  }
  if (readerInsightsToggle) {
    readerInsightsToggle.classList.toggle("is-active", !dashboardState.reader.insightsCollapsed)
    readerInsightsToggle.title = dashboardState.reader.insightsCollapsed ? "显示资料栏" : "隐藏资料栏"
  }
  if (readerWidthToggle) {
    readerWidthToggle.classList.toggle("is-active", dashboardState.reader.width === "wide")
    readerWidthToggle.title = dashboardState.reader.width === "wide" ? "切换为标准宽度" : "切换为宽屏阅读"
  }
  if (readerFocusToggle) {
    readerFocusToggle.innerHTML = dashboardState.reader.focusMode
      ? `<i class="fa-solid fa-minimize"></i>`
      : `<i class="fa-solid fa-maximize"></i>`
    readerFocusToggle.title = dashboardState.reader.focusMode ? "退出专注阅读" : "专注阅读"
  }
  const snapshot = dashboardState.reader.snapshot
  if (readerProjectTitle) {
    readerProjectTitle.textContent = snapshot?.project?.title || "小说阅读器"
  }
  if (readerProjectMeta) {
    readerProjectMeta.textContent = snapshot
      ? `${Number(snapshot.stats?.readableChapters || 0)}/${Number(snapshot.stats?.totalChapters || 0)} 章 · ${Number(snapshot.stats?.totalWords || 0).toLocaleString("zh-CN")} 字`
      : dashboardState.reader.loading ? "正在载入章节与设定" : "等待载入"
  }
  if (readerSearchInput && readerSearchInput.value !== dashboardState.reader.search) {
    readerSearchInput.value = dashboardState.reader.search
  }
  renderReaderBookmarkButton()
  if (dashboardState.reader.loading) {
    readerPage.innerHTML = `<div class="reader-empty-state"><i class="fa-solid fa-spinner fa-spin"></i><strong>正在同步章节正文与设定资料</strong></div>`
    return
  }
  if (dashboardState.reader.error) {
    readerPage.innerHTML = `<div class="reader-empty-state"><i class="fa-solid fa-triangle-exclamation"></i><strong>${escapeHtml(dashboardState.reader.error)}</strong></div>`
    return
  }
  renderReaderCatalog()
  renderReaderChapter()
  renderReaderInsights()
}

async function loadReaderSnapshot(projectId = dashboardState.activeProjectId) {
  if (!projectId) return
  dashboardState.reader.loading = true
  dashboardState.reader.error = ""
  dashboardState.reader.searchResults = []
  dashboardState.reader.searchError = ""
  dashboardState.reader.searchLoading = false
  renderReaderView()
  try {
    const params = new URLSearchParams({ projectId })
    const response = await apiRequest(`/api/reader-snapshot?${params.toString()}`)
    if (!response.ok) {
      throw new Error(response.payload?.error || `reader snapshot failed: ${response.status}`)
    }
    dashboardState.reader.snapshot = response.payload
    dashboardState.activeProjectId = response.payload?.activeProjectId || projectId
    dashboardState.reader.bookmarks = loadReaderBookmarks(dashboardState.activeProjectId)
    dashboardState.reader.chapterProgress = loadReaderChapterProgress(dashboardState.activeProjectId)
    const storedProgress = loadReaderProgress(dashboardState.activeProjectId)
    dashboardState.reader.chapterNumber = dashboardState.reader.chapterNumber
      || storedProgress?.chapterNumber
      || response.payload?.currentChapterNumber
      || response.payload?.chapters?.find((chapter) => chapter.hasBody || chapter.body)?.chapterNumber
      || response.payload?.chapters?.[0]?.chapterNumber
      || null
    dashboardState.envStatus = response.payload?.envStatus || dashboardState.envStatus
    renderReaderView()
    await ensureReaderChapterBody(dashboardState.reader.chapterNumber, {
      silent: true,
      scrollRatio: storedProgress?.chapterNumber && Number(storedProgress.chapterNumber) === Number(dashboardState.reader.chapterNumber)
        ? storedProgress.scrollRatio
        : 0,
    })
    if (storedProgress?.chapterNumber && Number(storedProgress.chapterNumber) === Number(dashboardState.reader.chapterNumber)) {
      window.requestAnimationFrame(() => restoreReaderScroll(storedProgress.scrollRatio))
    }
  } catch (error) {
    dashboardState.reader.error = networkErrorMessage(error)
  } finally {
    dashboardState.reader.loading = false
    renderReaderView()
  }
}

async function openReader(projectId = dashboardState.activeProjectId) {
  if (!projectId) return
  dashboardState.activeProjectId = projectId
  dashboardState.reader.chapterNumber = loadReaderProgress(projectId)?.chapterNumber || null
  window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId)
  showReaderView()
  await loadReaderSnapshot(projectId)
}

function renderDashboard() {
  if (dashboardState.currentView === "manager") {
    renderManagerView()
    return
  }
  if (dashboardState.currentView === "reader") {
    renderReaderView()
    return
  }

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
  renderStyleEvolutionPanel()
  renderDiscussion(model)
  renderCocreateReviewPanel(model)
  renderInitPanel(model)
  renderAigcRefinementPanel(model)
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
    await loadStyleEvolutionSnapshot()
    renderStyleEvolutionPanel()
    renderAutopilotControls()
    return
  }
  updateSnapshot(response.payload)
  if (response.ok) {
    if (options.includeTranscript || options.includeDiscussionHistory) {
      await loadDiscussionHistory({ silent: true })
    }
    await loadStyleEvolutionSnapshot()
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

async function repairStoryAssets(button) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  if (button) {
    button.disabled = true
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`
  }
  addLog("正在补齐故事基建资产...")
  let response
  try {
    response = await apiRequest("/api/production/story-assets/repair", {
      method: "POST",
      body: { projectId: dashboardState.activeProjectId },
    })
  } catch (error) {
    addLog(`故事基建补齐失败：${networkErrorMessage(error)}。`)
    if (button) {
      button.disabled = false
      button.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i>`
    }
    return
  }
  if (!response.ok) {
    addLog(`故事基建补齐失败：${response.payload?.error || `HTTP ${response.status}`}。`)
    if (button) {
      button.disabled = false
      button.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i>`
    }
    return
  }
  updateSnapshot(response.payload)
  renderDashboard()
  const writtenCount = Array.isArray(response.payload?.repairedStoryAssets)
    ? response.payload.repairedStoryAssets.length
    : 0
  addLog(`故事基建已补齐：${writtenCount} 个资产。`)
}

async function approveStoryFoundation(button) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  if (button) {
    button.disabled = true
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`
  }
  addLog("正在确认故事基建...")
  let response
  try {
    response = await apiRequest("/api/production/story-foundation/approve", {
      method: "POST",
      body: { projectId: dashboardState.activeProjectId },
    })
  } catch (error) {
    addLog(`故事基建确认失败：${networkErrorMessage(error)}。`)
    if (button) {
      button.disabled = false
      button.innerHTML = `<i class="fa-solid fa-check"></i>`
    }
    return
  }
  if (!response.ok) {
    addLog(`故事基建确认失败：${response.payload?.error || `HTTP ${response.status}`}。`)
    if (button) {
      button.disabled = false
      button.innerHTML = `<i class="fa-solid fa-check"></i>`
    }
    return
  }
  updateSnapshot(response.payload)
  renderDashboard()
  addLog("故事基建已确认，正文生产门禁会继续检查章节蓝图、Style Contract Freeze Gate 和记忆条件。")
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
  const manifestSummary = renderSegmentManifestSummary(cleanedContent)
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

  return `<div class="novel-reader-wrapper">${manifestSummary}${renderedHtml}</div>`
}

function renderSegmentManifestSummary(content) {
  let manifest = null
  try {
    manifest = JSON.parse(content)
  } catch {
    return ""
  }
  const assembly = manifest?.execution?.assembly
  if (!assembly || typeof assembly !== "object") {
    return ""
  }
  const decision = String(assembly.decision || "not_requested")
  const meta = decision === "used"
    ? { klass: "is-passed", icon: "fa-circle-check", label: "Assembly 已采用" }
    : decision === "fallback_author"
      ? { klass: "is-revision", icon: "fa-shield-halved", label: "Assembly 已回退" }
      : { klass: "is-empty", icon: "fa-circle-info", label: "Assembly 未启用" }
  return `
    <div class="segment-manifest-summary ${meta.klass}">
      <span><i class="fa-solid ${meta.icon}"></i> ${meta.label}</span>
      <strong>${escapeHtml(decision)}</strong>
      <small>${escapeHtml(assembly.reason || "暂无原因")}</small>
      <div>
        <em>material ${Number(assembly.materialChars || 0)}</em>
        <em>final ${Number(assembly.finalChars || 0)}</em>
        <em>fallback ${Number(assembly.fallbackChars || 0)}</em>
      </div>
    </div>
  `
}

function buildChapterPreviewVerificationCard(chapter = {}, snapshot = dashboardState.reader.snapshot || {}) {
  const verification = chapter?.styleInheritanceVerification || chapter?.publishReadiness?.styleInheritanceVerification || {}
  const qualityGate = chapter?.qualityGate || {}
  const aigc = chapter?.aigcDetection || verification?.aigc || {}
  const publishReadiness = chapter?.publishReadiness || chapter?.versionManifest?.publishReadiness || {}
  const styleEvolution = snapshot?.styleEvolution || {}
  const contract = styleEvolution?.contract || {}
  const contractVersion = Number(verification?.contractVersion || contract?.loop?.approvalVersion || contract?.approval?.approvedVersion || 0)
  const styleDrift = verification?.styleDrift || verification?.styleConformanceDrift || verification?.styleConformance || {}
  const styleForbiddenHitCount = typeof styleDrift?.forbiddenHitCount === "number"
    ? Number(styleDrift.forbiddenHitCount)
    : typeof styleDrift?.metrics?.forbiddenHitCount === "number"
      ? Number(styleDrift.metrics.forbiddenHitCount)
      : null
  const evidence = Array.isArray(verification?.evidence) ? verification.evidence : []
  const risks = Array.isArray(verification?.risks) ? verification.risks : []
  const missing = Array.isArray(verification?.publishBaseMissing)
    ? verification.publishBaseMissing
    : Array.isArray(publishReadiness?.missing)
      ? publishReadiness.missing
      : []
  const status = String(verification?.status || "pending")
  const statusMeta = status === "ready"
    ? { klass: "is-ready", label: "写法继承验证通过" }
    : status === "warning"
      ? { klass: "is-warning", label: "写法继承验证待补强" }
      : status === "blocked"
        ? { klass: "is-blocked", label: "写法继承验证阻塞" }
        : { klass: "is-pending", label: "写法继承验证待生成" }

  const summary = verification?.summary
    || "当前还没有形成完整的章节写法继承验证结果。"
  const rows = [
    contractVersion ? `冻结合同：v${contractVersion}` : "冻结合同：未确认",
    verification?.inheritanceStatus ? `继承状态：${verification.inheritanceStatus}` : "",
    qualityGate?.status ? `质量门：${qualityGate.status}` : "",
    aigc?.status ? `AIGC：${aigc.status}${typeof aigc?.score === "number" ? ` · ${Number(aigc.score).toFixed(3)}` : ""}` : "",
    typeof styleDrift?.conformanceScore === "number" ? `继承分：${Number(styleDrift.conformanceScore).toFixed(0)}/100` : "",
    typeof styleDrift?.driftScore === "number" ? `漂移：${Number(styleDrift.driftScore).toFixed(0)}/100` : "",
    typeof styleForbiddenHitCount === "number" ? `禁忌命中：${styleForbiddenHitCount}` : "",
    publishReadiness?.ready === true ? "发布检查：通过" : publishReadiness?.ready === false ? `发布检查：缺 ${Array.isArray(publishReadiness?.missing) ? publishReadiness.missing.length : 0} 项` : "",
    verification?.styleFingerprintReady ? "首章风格指纹：已就绪" : "",
  ].filter(Boolean)

  const evidenceHtml = evidence.length
    ? `
      <div class="chapter-preview-verification-section">
        <strong>验证证据</strong>
        <ul>
          ${evidence.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </div>
    `
    : ""

  const riskHtml = (risks.length || missing.length)
    ? `
      <div class="chapter-preview-verification-section">
        <strong>当前风险</strong>
        <ul>
          ${risks.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          ${missing.slice(0, 4).map((item) => `<li>${escapeHtml(`待补项：${item?.label || item?.id || "未命名项"}${item?.detail ? `（${item.detail}）` : ""}`)}</li>`).join("")}
        </ul>
      </div>
    `
    : ""

  return `
    <section class="chapter-preview-verification ${statusMeta.klass}">
      <div class="chapter-preview-verification-head">
        <span>${escapeHtml(statusMeta.label)}</span>
        <small>${escapeHtml(contractVersion ? `合同 v${contractVersion}` : "等待冻结合同")}</small>
      </div>
      <p>${escapeHtml(summary)}</p>
      ${rows.length ? `
        <div class="chapter-preview-verification-grid">
          ${rows.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
      ` : ""}
      ${evidenceHtml}
      ${riskHtml}
    </section>
  `
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

async function loadCoverPreview(path, targetProjectId, version = "") {
  const projectId = targetProjectId || dashboardState.activeProjectId
  if (!path || !projectId) {
    return
  }
  const cacheKey = coverPreviewCacheKey(projectId, path, version)
  // Check cache and status
  const existing = dashboardState.coverPreviews[cacheKey]
  if (existing && (existing.dataUrl || existing.loading)) {
    return
  }

  dashboardState.coverPreviews[cacheKey] = { dataUrl: "", loading: true }
  if (projectId === dashboardState.activeProjectId) {
    dashboardState.coverPreview = { path, dataUrl: "", loading: true }
  }

  try {
    const params = new URLSearchParams({
      projectId,
      path,
    })
    if (version) {
      params.set("v", version)
    }
    const response = await apiRequest(`/api/assets/image?${params.toString()}`)
    const dataUrl = response.payload.dataUrl || ""

    dashboardState.coverPreviews[cacheKey] = {
      dataUrl,
      loading: false,
    }

    if (projectId === dashboardState.activeProjectId) {
      dashboardState.coverPreview = {
        path,
        dataUrl,
        loading: false,
      }
    }
    renderDashboard()
  } catch (error) {
    dashboardState.coverPreviews[cacheKey] = { dataUrl: "", loading: false }
    if (projectId === dashboardState.activeProjectId) {
      dashboardState.coverPreview = { path: "", dataUrl: "", loading: false }
    }
    addLog(`封面预览暂时无法打开：${networkErrorMessage(error)}。`)
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
    const chapter = response.payload.chapter || readerChapters().find((entry) => Number(entry.chapterNumber) === Number(chapterNumber)) || null
    chapterPreviewTitle.textContent = `第 ${response.payload.chapterNumber} 章预览`
    chapterPreviewPath.textContent = response.payload.path || "正式章节文件"
    chapterPreviewBody.innerHTML = `
      ${chapter ? buildChapterPreviewVerificationCard(chapter) : ""}
      ${renderPreviewContent(`chapter-preview-${chapterNumber}`, "Author", content)}
    `

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

function stopCoverPolling() {
  if (dashboardState.coverPolling.timer) {
    clearTimeout(dashboardState.coverPolling.timer)
  }
  dashboardState.coverPolling = {
    projectId: "",
    timer: null,
    attempts: 0,
  }
}

function scheduleCoverStatusPoll(projectId) {
  if (!projectId) return
  if (dashboardState.coverPolling.projectId !== projectId) {
    stopCoverPolling()
    dashboardState.coverPolling.projectId = projectId
  }

  if (dashboardState.coverPolling.timer) {
    clearTimeout(dashboardState.coverPolling.timer)
  }

  dashboardState.coverPolling.timer = setTimeout(async () => {
    dashboardState.coverPolling.timer = null
    if (dashboardState.activeProjectId !== projectId) {
      stopCoverPolling()
      return
    }

    dashboardState.coverPolling.attempts += 1
    try {
      await refreshDashboard({ silent: true })
      const activeProject = dashboardState.projects.find((project) => project.id === projectId)
      const coverStatus = dashboardState.state?.assets?.cover?.status || activeProject?.summary?.coverStatus || "pending"
      if (coverStatus === "in_progress" && dashboardState.coverPolling.attempts < 40) {
        scheduleCoverStatusPoll(projectId)
        return
      }
      stopCoverPolling()
      if (coverStatus === "complete") {
        addLog("封面已生成并保存。")
      } else if (coverStatus === "failed") {
        addLog(`封面生成失败：${dashboardState.state?.assets?.cover?.error || "请查看封面状态详情。"}`)
      }
    } catch (error) {
      if (dashboardState.coverPolling.attempts < 40) {
        scheduleCoverStatusPoll(projectId)
        return
      }
      stopCoverPolling()
      addLog(`封面状态刷新失败：${networkErrorMessage(error)}。`)
    }
  }, 3000)
}

async function runCover() {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  addLog("准备封面生成任务...")
  clearCoverPreviewCache(dashboardState.activeProjectId)
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
  scheduleCoverStatusPoll(dashboardState.activeProjectId)
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

async function runModalProviderTest() {
  const id = llmConfigIdInput.value.trim()
  const apiKey = providerApiKeyInput.value.trim()
  const payload = {
    LLM_BASE_URL: providerBaseUrlInput.value.trim(),
    LLM_MODEL_ID: providerModelInput.value.trim(),
    LLM_API_MODE: normalizeLlmApiMode(providerApiModeInput?.value),
  }
  if (id) {
    payload.id = id
  }
  if (apiKey) {
    payload.LLM_API_KEY = apiKey
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
  const apiMode = normalizeLlmApiMode(providerApiModeInput?.value)

  if (!name || !baseUrl || !apiKey || !modelName) {
    setProviderModalStatus("is-error", "请填写所有必填字段（名称、URL、Key、Model ID）。")
    return
  }

  setProviderModalStatus("is-loading", "正在保存模型配置...")
  let response
  try {
    const payload = { name, baseUrl, apiKey, modelName, apiMode }
    if (id) {
      payload.id = id
    }
    response = await apiRequest("/api/llm-configs", {
      method: "POST",
      body: payload,
    })
    if (!response.ok) {
      throw new Error(response.payload?.error || "配置保存失败")
    }
  } catch (error) {
    setProviderModalStatus("is-error", `配置无法保存：${networkErrorMessage(error)}。`)
    return
  }

  savedLlmConfigs = response.payload?.configs || []
  savedLlmRoutes = response.payload?.routes || []
  renderLlmConfigsList()
  cancelEditLlmConfig()
  document.getElementById("provider-form-modal")?.classList.add("hidden")

  setProviderModalStatus("is-success", "模型配置已保存；可在用途分配中指定不同能力使用的模型。")
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
  } else if (options.resume && !options.silent) {
    setComposerStatus("processing", "正在恢复无人值守任务监听。", { busy: true })
  }
  if (!options.silent) {
    dashboardState.autopilotActive = true
  }
  dashboardState.autopilotStreamConnected = true
  if (message) {
    appendPendingUserMessage(message)
  }
  dashboardState.lastDiscussionResult = null
  renderDashboard()
  if (message) {
    appendLiveStatusCard("你的指令已显示在聊天区，正在提交到无人值守后台任务。")
  }
  if (!options.silent) {
    addLog(message
      ? `无人值守自动创作开始：${message}`
      : options.resume
        ? "正在手动继续无人值守自动创作。"
        : "无人值守自动创作继续运行。")
  }

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
  } else if (options.skipStart && !options.silent) {
    setComposerStatus("processing", "已发现数据库中的无人值守任务，正在连接状态流。", { busy: true })
    appendLiveStatusCard("检测到数据库中已有无人值守任务，正在连接统一管理者的状态流。")
  }

  let response
  try {
    if (dashboardState.composerStatus.busy && !options.silent) {
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
  if (dashboardState.autopilotActive && dashboardState.autopilotStreamConnected) {
    setComposerStatus("warning", "自动创作状态流已经连接。")
    return
  }
  // 如果存在静默后台长连，先关闭它，再启动正式创作
  if (dashboardState.autopilotAbortController) {
    dashboardState.autopilotAbortController.abort()
    dashboardState.autopilotAbortController = null
    dashboardState.autopilotStreamConnected = false
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
    chapters: Number.parseInt(initChaptersInput.value || String(PRODUCTION_DEFAULT_TOTAL_CHAPTERS), 10),
    chapterWords: Number.parseInt(initWordsInput.value || String(PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET), 10),
  })
}

async function loadProjects() {
  console.log("loadProjects: Start");
  let response
  try {
    console.log("loadProjects: calling /api/projects...");
    response = await apiRequest("/api/projects")
    console.log("loadProjects: apiRequest successful");
  } catch (error) {
    console.log("loadProjects: apiRequest failed:", error);
    addLog(`加载项目列表失败：${networkErrorMessage(error)}。网络恢复后会自动重试。`)
    renderManagerView()
    return { ok: false, status: 0, payload: {} }
  }
  console.log("loadProjects: calling updateSnapshot...");
  updateSnapshot(response.payload)
  console.log("loadProjects: calling renderManagerView...");
  renderManagerView()
  console.log("loadProjects: renderManagerView done");
  const storedProjectId = window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)
  const currentView = window.localStorage.getItem("ai-novel-factory.currentView") || "manager"
  console.log("loadProjects: storedProjectId=", storedProjectId, "currentView=", currentView);
  if (currentView === "studio" && storedProjectId && dashboardState.projects.some((project) => project.id === storedProjectId)) {
    console.log("loadProjects: switching to studio view...");
    dashboardState.activeProjectId = storedProjectId
    loadPanelLayout(storedProjectId)
    showStudioView()
    renderDashboard()
    restoreStudioProjectInBackground(storedProjectId)
  } else if (currentView === "reader" && storedProjectId && dashboardState.projects.some((project) => project.id === storedProjectId)) {
    console.log("loadProjects: switching to reader view...");
    dashboardState.activeProjectId = storedProjectId
    dashboardState.reader.chapterNumber = loadReaderProgress(storedProjectId)?.chapterNumber || null
    showReaderView()
    loadReaderSnapshot(storedProjectId).catch((error) => {
      if (dashboardState.activeProjectId === storedProjectId) {
        dashboardState.reader.error = networkErrorMessage(error)
        dashboardState.reader.loading = false
        renderReaderView()
      }
    })
  } else {
    console.log("loadProjects: switching to manager view...");
    showManagerView()
  }
  console.log("loadProjects: End");
  return response
}

function restoreStudioProjectInBackground(projectId) {
  refreshDashboard({ includeDiscussionHistory: true })
    .then(() => {
      if (dashboardState.activeProjectId !== projectId || dashboardState.currentView !== "studio") {
        return
      }
      maybeResumeAutopilotFromSnapshot()
    })
    .catch((error) => {
      if (dashboardState.activeProjectId === projectId) {
        addLog(`恢复创作台失败：${networkErrorMessage(error)}。`)
      }
    })
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
  dashboardState.styleEvolution = null
  dashboardState.styleEvolutionUi = { loading: false, message: "", error: "" }
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
    const hasActiveOrPausedJob = Boolean(control.running || control.recoverable)
    addLog("正在后台静默连接状态流...")
    streamAutopilot("", {
      skipStart: true,
      resume: hasActiveOrPausedJob,
      silent: !hasActiveOrPausedJob,
    }).catch((error) => {
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

async function createProjectFromModal({ title, idea, chapters, chapterWords, creativeProfile }) {
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
      body: { title, idea, chapters, chapterWords, creativeProfile },
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
    addLog("模型配置已改为仅通过设置面板维护，请在全局设置中新增或编辑模型。")
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
  const handleCoverClick = (event) => {
    const regenerateButton = event.target.closest("[data-cover-regenerate]")
    if (regenerateButton) {
      runCover()
      return
    }

    const previewButton = event.target.closest("[data-cover-preview-path]")
    if (previewButton) {
      const path = previewButton.dataset.coverPreviewPath || ""
      const projectId = previewButton.dataset.coverProjectId || dashboardState.activeProjectId
      const version = previewButton.dataset.coverVersion || ""
      const cacheKey = coverPreviewCacheKey(projectId, path, version)
      const cached = path ? dashboardState.coverPreviews[cacheKey] : null
      const coverDataUrl = cached ? cached.dataUrl : ""
      if (coverDataUrl) {
        showCoverLightbox(coverDataUrl)
      } else {
        loadCoverPreview(path, projectId, version)
      }
      return
    }

    const promptButton = event.target.closest("[data-artifact-path]")
    if (promptButton) {
      previewArtifact(promptButton.dataset.artifactPath || "")
    }
  }
  document.getElementById("cover-status")?.addEventListener("click", handleCoverClick)
  document.getElementById("sidebar-project-cover-container")?.addEventListener("click", handleCoverClick)
  document.getElementById("workflow-production-status")?.addEventListener("click", (event) => {
    const repairButton = event.target.closest("[data-repair-story-assets]")
    if (repairButton) {
      repairStoryAssets(repairButton)
      return
    }
    const approveButton = event.target.closest("[data-approve-story-foundation]")
    if (approveButton) {
      approveStoryFoundation(approveButton)
      return
    }

    const artifactButton = event.target.closest("[data-artifact-path]")
    if (!artifactButton) return
    previewArtifact(artifactButton.dataset.artifactPath || "")
  })

  // Listen to list container clicks for project covers (to open large lightboxes)
  document.getElementById("project-list-container")?.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-cover-preview-path]")
    if (previewButton) {
      event.stopPropagation()
      const path = previewButton.dataset.coverPreviewPath || ""
      const projectId = previewButton.dataset.coverProjectId || ""
      const version = previewButton.dataset.coverVersion || ""
      const cacheKey = coverPreviewCacheKey(projectId, path, version)
      const cached = path ? dashboardState.coverPreviews[cacheKey] : null
      const coverDataUrl = cached ? cached.dataUrl : ""
      if (coverDataUrl) {
        showCoverLightbox(coverDataUrl)
      } else if (path && projectId) {
        loadCoverPreview(path, projectId, version)
      }
    }
  })

  // Lightbox modal close bindings
  document.getElementById("cover-lightbox-close-button")?.addEventListener("click", closeCoverLightbox)
  document.getElementById("cover-preview-lightbox-modal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      closeCoverLightbox()
    }
  })
  openProjectCreateButton.addEventListener("click", openProjectCreateModal)
  managerProviderSettingsButton?.addEventListener("click", openProviderModal)
  backToProjectsButton.addEventListener("click", showManagerView)
  readerBackButton?.addEventListener("click", showManagerView)
  readerStudioButton?.addEventListener("click", async () => {
    if (!dashboardState.activeProjectId) return
    await refreshDashboard({ includeDiscussionHistory: true })
  })
  document.getElementById("open-reader-button")?.addEventListener("click", () => openReader())
  readerSearchInput?.addEventListener("input", () => {
    dashboardState.reader.search = readerSearchInput.value
    renderReaderView()
    scheduleReaderSearch()
  })
  readerChapterSelect?.addEventListener("change", () => {
    changeReaderChapter(Number(readerChapterSelect.value))
  })
  readerCatalogFilter?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reader-catalog-filter]")
    if (!button) return
    dashboardState.reader.catalogFilter = button.dataset.readerCatalogFilter || "all"
    renderReaderCatalog()
  })
  readerCatalogList?.addEventListener("click", (event) => {
    const searchButton = event.target.closest("[data-reader-search-chapter]")
    if (searchButton) {
      changeReaderChapter(Number(searchButton.dataset.readerSearchChapter))
      return
    }
    const button = event.target.closest("[data-reader-chapter]")
    if (!button) return
    changeReaderChapter(Number(button.dataset.readerChapter))
  })
  readerPrevChapterButton?.addEventListener("click", () => {
    const previousChapter = adjacentReaderChapter(-1)
    if (previousChapter) changeReaderChapter(previousChapter.chapterNumber)
  })
  readerNextChapterButton?.addEventListener("click", () => {
    const nextChapter = adjacentReaderChapter(1)
    if (nextChapter) changeReaderChapter(nextChapter.chapterNumber)
  })
  readerBookmarkToggle?.addEventListener("click", toggleReaderBookmark)
  readerCatalogToggle?.addEventListener("click", () => {
    dashboardState.reader.catalogCollapsed = !dashboardState.reader.catalogCollapsed
    saveReaderSettings()
    renderReaderView()
  })
  readerInsightsToggle?.addEventListener("click", () => {
    dashboardState.reader.insightsCollapsed = !dashboardState.reader.insightsCollapsed
    saveReaderSettings()
    renderReaderView()
  })
  readerWidthToggle?.addEventListener("click", () => {
    dashboardState.reader.width = dashboardState.reader.width === "wide" ? "normal" : "wide"
    saveReaderSettings()
    renderReaderView()
  })
  readerChapterNav?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reader-nav-chapter]")
    if (!button || !button.dataset.readerNavChapter) return
    changeReaderChapter(Number(button.dataset.readerNavChapter))
  })
  readerMainScroller()?.addEventListener("scroll", () => {
    updateReaderProgressFill()
    if (dashboardState.reader.progressSaveTimer) {
      window.clearTimeout(dashboardState.reader.progressSaveTimer)
    }
    dashboardState.reader.progressSaveTimer = window.setTimeout(() => {
      dashboardState.reader.progressSaveTimer = null
      saveReaderProgress()
    }, 500)
  })
  readerTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-reader-panel]")
    if (!button) return
    dashboardState.reader.panel = button.dataset.readerPanel
    saveReaderSettings()
    renderReaderInsights()
  })
  readerInsightBody?.addEventListener("click", (event) => {
    const applyButton = event.target.closest("[data-reader-version-apply]")
    if (applyButton) {
      publishReaderChapterVersion(Number(applyButton.dataset.readerVersionChapter), applyButton.dataset.readerVersionApply)
      return
    }
    const lockButton = event.target.closest("[data-reader-version-lock]")
    if (lockButton) {
      toggleReaderChapterLock(Number(lockButton.dataset.readerVersionChapter), lockButton.dataset.readerVersionLock === "1")
      return
    }
    const versionButton = event.target.closest("[data-reader-version-id]")
    if (versionButton) {
      loadReaderVersionComparison(Number(versionButton.dataset.readerVersionChapter), versionButton.dataset.readerVersionId)
      return
    }
    const button = event.target.closest("[data-reader-bookmark-jump]")
    if (!button) return
    jumpToReaderBookmark(Number(button.dataset.readerBookmarkJump))
  })
  readerInsightBody?.addEventListener("input", (event) => {
    const noteInput = event.target.closest("[data-reader-bookmark-note]")
    if (!noteInput) return
    updateReaderBookmarkNote(Number(noteInput.dataset.readerBookmarkNote), noteInput.value)
  })
  readerFontDown?.addEventListener("click", () => {
    dashboardState.reader.fontSize = Math.max(15, dashboardState.reader.fontSize - 1)
    saveReaderSettings()
    renderReaderChapter()
  })
  readerFontUp?.addEventListener("click", () => {
    dashboardState.reader.fontSize = Math.min(26, dashboardState.reader.fontSize + 1)
    saveReaderSettings()
    renderReaderChapter()
  })
  readerThemeToggle?.addEventListener("click", () => {
    dashboardState.reader.theme = dashboardState.reader.theme === "dark" ? "paper" : "dark"
    saveReaderSettings()
    renderReaderView()
  })
  readerFocusToggle?.addEventListener("click", () => {
    dashboardState.reader.focusMode = !dashboardState.reader.focusMode
    saveReaderSettings()
    renderReaderView()
  })
  document.addEventListener("keydown", (event) => {
    if (dashboardState.currentView !== "reader") return
    if (event.target && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return
    if (event.key === "ArrowLeft") {
      const previousChapter = adjacentReaderChapter(-1)
      if (previousChapter) changeReaderChapter(previousChapter.chapterNumber)
    } else if (event.key === "ArrowRight") {
      const nextChapter = adjacentReaderChapter(1)
      if (nextChapter) changeReaderChapter(nextChapter.chapterNumber)
    }
  })
  providerModalCloseButton.addEventListener("click", closeProviderModal)

  document.getElementById("tab-btn-routing")?.addEventListener("click", () => switchProviderTab("routing"))
  document.getElementById("tab-btn-models")?.addEventListener("click", () => switchProviderTab("models"))
  document.getElementById("tab-btn-writing")?.addEventListener("click", () => switchProviderTab("writing"))

  writingSettingsSaveButton.addEventListener("click", saveWritingSettings)

  refineScanAllBtn.addEventListener("click", async () => {
    if (!dashboardState.activeProjectId) return
    refineScanAllBtn.disabled = true
    showRefineProgress("准备扫描全书 AIGC 风险中...", 10)
    try {
      const res = await fetch("/api/aigc/batch-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: dashboardState.activeProjectId })
      })
      let payload = {}
      try { payload = await res.json() } catch {}
      updateSnapshot(payload)
      if (res.ok) {
        showRefineProgress("全书 AIGC 扫描完成！正在刷新评分...", 100)
        if (dashboardState.state?.plan?.chapterTasks && payload?.results) {
          dashboardState.state.plan.chapterTasks.forEach((task) => {
            const result = payload.results?.[task.chapterNumber]
            if (result) {
              task.aigcStatus = aigcResultStatus(result)
              task.aigcReason = aigcResultMessage(result)
            }
          })
        }
        renderDashboard()
        setTimeout(() => {
          hideRefineProgress()
          refreshDashboard().catch(() => undefined)
        }, 1500)
      } else {
        renderDashboard()
        showRefineProgress(payload.reason || payload.error || "扫描失败，请稍后重试。", 100, "is-error")
        setTimeout(() => hideRefineProgress(), 2000)
      }
    } catch (e) {
      showRefineProgress(`扫描出错: ${e.message}`, 100, "is-error")
      setTimeout(() => hideRefineProgress(), 2000)
    } finally {
      refineScanAllBtn.disabled = false
    }
  })

  refineAutoAllBtn.addEventListener("click", async () => {
    if (!dashboardState.activeProjectId) return
    refineAutoAllBtn.disabled = true
    showRefineProgress("正在启动一键全自动批量精修...", 20)
    try {
      const res = await fetch("/api/aigc/batch-refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: dashboardState.activeProjectId })
      })
      let payload = {}
      try { payload = await res.json() } catch {}
      updateSnapshot(payload)
      if (res.ok) {
        showRefineProgress("一键批量精修已启动或已完成！正在更新章节事实...", 100)
        if (dashboardState.state?.plan?.chapterTasks && payload?.results) {
          dashboardState.state.plan.chapterTasks.forEach((task) => {
            const result = payload.results?.[task.chapterNumber]
            if (result) {
              task.aigcStatus = aigcResultStatus(result)
              task.aigcReason = aigcResultMessage(result)
            }
          })
        }
        renderDashboard()
        setTimeout(() => {
          hideRefineProgress()
          refreshDashboard().catch(() => undefined)
        }, 1500)
      } else {
        renderDashboard()
        showRefineProgress(payload.reason || payload.error || "批量精修失败，请重试。", 100, "is-error")
        setTimeout(() => hideRefineProgress(), 2000)
      }
    } catch (e) {
      showRefineProgress(`批量精修出错: ${e.message}`, 100, "is-error")
      setTimeout(() => hideRefineProgress(), 2000)
    } finally {
      refineAutoAllBtn.disabled = false
    }
  })

  refineCompleteBtn.addEventListener("click", async () => {
    if (!dashboardState.activeProjectId) return
    if (!confirm("确定要标记全书创作完成并封存工作流吗？")) return
    refineCompleteBtn.disabled = true
    try {
      const res = await fetch("/api/aigc/mark-workflow-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: dashboardState.activeProjectId })
      })
      if (res.ok) {
        addLog("小说工作流已顺利归档，标记为已完成。")
        await refreshDashboard()
      } else {
        alert("操作失败，请重试。")
      }
    } catch (e) {
      alert(`出错: ${e.message}`)
    } finally {
      refineCompleteBtn.disabled = false
    }
  })
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
  workspaceTabDiscussion?.addEventListener("click", () => {
    setWorkspaceView("discussion")
  })
  workspaceTabStyle?.addEventListener("click", () => {
    setWorkspaceView("style")
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

  document.getElementById("provider-form-close-button")?.addEventListener("click", () => {
    document.getElementById("provider-form-modal")?.classList.add("hidden")
  })
  document.getElementById("provider-form-cancel-button")?.addEventListener("click", () => {
    document.getElementById("provider-form-modal")?.classList.add("hidden")
  })

  document.getElementById("btn-add-provider")?.addEventListener("click", () => {
    cancelEditLlmConfig()
    document.getElementById("provider-form-modal")?.classList.remove("hidden")
  })

  Object.values(llmRouteInputs).forEach((input) => {
    input?.addEventListener("change", () => {
      saveLlmConfigRoutes().catch(console.error)
    })
  })

  llmConfigsList?.addEventListener("click", (event) => {
    const testItemBtn = event.target.closest(".btn-test-item")
    if (testItemBtn) {
      const id = testItemBtn.dataset.id
      if (id) runItemProviderTest(id, testItemBtn).catch(console.error)
      return
    }

    const deleteBtn = event.target.closest(".btn-delete")
    if (deleteBtn) {
      const id = deleteBtn.dataset.id
      if (id) deleteLlmConfig(id).catch(console.error)
      return
    }

    const editBtn = event.target.closest(".btn-edit")
    if (editBtn) {
      const id = editBtn.dataset.id
      if (id) {
        editLlmConfig(id)
        document.getElementById("provider-form-modal")?.classList.remove("hidden")
      }
      return
    }

    const configItem = event.target.closest(".llm-config-item")
    if (configItem) {
      if (event.target.closest(".llm-action-btn")) return
      const id = configItem.dataset.id
      if (id) {
        editLlmConfig(id)
        document.getElementById("provider-form-modal")?.classList.remove("hidden")
      }
      return
    }
  })

  initButton.addEventListener("click", initializeWorkspace)
  autopilotStartButton?.addEventListener("click", startAutopilotFromButton)
  autopilotStopButton?.addEventListener("click", requestStopAutopilot)
  autopilotModeButton?.addEventListener("click", toggleAutopilotMode)
  // Project Creation Wizard navigation and submission handlers
  document.querySelector(".genre-cards-grid")?.addEventListener("click", (event) => {
    const card = event.target.closest(".genre-card");
    if (card) {
      selectGenreCard(card);
    }
  });

  projectCreatePrevButton.addEventListener("click", () => {
    if (currentCreateStep > 1) {
      setProjectCreateStatus("", "项目创建后将生成完整的设定与大纲，你需要手动点击“开始创作”。");
      currentCreateStep--;
      updateCreateProjectWizard();
    }
  });

  projectCreateNextButton.addEventListener("click", () => {
    if (currentCreateStep === 1) {
      const idea = projectCreateIdeaInput.value.trim();
      if (!idea) {
        setProjectCreateStatus("is-error", "请输入一句明确的小说想法。");
        return;
      }
    }
    if (currentCreateStep < 3) {
      setProjectCreateStatus("", "项目创建后将生成完整的设定与大纲，你需要手动点击“开始创作”。");
      currentCreateStep++;
      updateCreateProjectWizard();
    }
  });

  // Quick Create - Fully managed by system matching user request
  projectCreateQuickButton.addEventListener("click", () => {
    const idea = projectCreateIdeaInput.value.trim();
    if (!idea) {
      setProjectCreateStatus("is-error", "请输入小说想法才能使用快速创建。");
      return;
    }
    let chapters = Number.parseInt(projectCreateChaptersInput.value, 10);
    if (Number.isNaN(chapters) || chapters < 1) {
      chapters = PRODUCTION_DEFAULT_TOTAL_CHAPTERS;
    }
    let chapterWords = Number.parseInt(projectCreateWordsInput.value, 10);
    if (Number.isNaN(chapterWords) || chapterWords < 1000) {
      chapterWords = PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET;
    }
    createProjectFromModal({
      title: projectCreateTitleInput.value.trim(),
      idea,
      chapters,
      chapterWords,
      creativeProfile: {
        genre: "auto-inferred",
        platform: "serialized web novel",
        readerPromise: "",
        pointOfView: "third-person limited",
        tone: "tense but readable",
        naturalnessTarget: "balanced",
        styleFingerprint: "",
      }
    });
  });

  // Regular detailed wizard completion submission
  projectCreateSubmitButton.addEventListener("click", () => {
    let chapters = Number.parseInt(projectCreateChaptersInput.value, 10);
    if (Number.isNaN(chapters) || chapters < 1) {
      chapters = PRODUCTION_DEFAULT_TOTAL_CHAPTERS;
    }
    let chapterWords = Number.parseInt(projectCreateWordsInput.value, 10);
    if (Number.isNaN(chapterWords) || chapterWords < 1000) {
      chapterWords = PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET;
    }
    createProjectFromModal({
      title: projectCreateTitleInput.value.trim(),
      idea: projectCreateIdeaInput.value.trim(),
      chapters,
      chapterWords,
      creativeProfile: {
        genre: projectCreateGenreInput.value,
        platform: "serialized web novel",
        readerPromise: projectCreateReaderPromiseInput.value === "auto" ? "" : projectCreateReaderPromiseInput.value,
        pointOfView: projectCreatePovInput.value,
        tone: projectCreateToneInput.value,
        naturalnessTarget: projectCreateNaturalnessInput.value,
        styleFingerprint: projectCreateStyleFingerprintInput.value.trim(),
      }
    });
  });
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
  styleWorkspacePanel?.addEventListener("click", (event) => {
    handleStyleEvolutionPanelClick(event)
  })
  styleWorkspacePanel?.addEventListener("change", (event) => {
    handleStyleEvolutionPanelChange(event)
  })
  styleWorkspacePanel?.addEventListener("input", (event) => {
    handleStyleEvolutionPanelInput(event)
  })
  sidebarRight?.addEventListener("click", (event) => {
    if (handleStyleEvolutionPanelClick(event)) {
      return
    }

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
      return
    }

    const workspaceTab = event.target.closest("[data-workspace-tab]")
    if (workspaceTab) {
      setWorkspaceView(workspaceTab.dataset.workspaceTab || "discussion")
      return
    }
  })
  sidebarRight?.addEventListener("change", (event) => {
    handleStyleEvolutionPanelChange(event)
  })
  sidebarRight?.addEventListener("input", (event) => {
    handleStyleEvolutionPanelInput(event)
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

  console.log("DOMContentLoaded: Start");
  renderNetworkStatus()
  console.log("DOMContentLoaded: renderNetworkStatus done");
  loadPanelLayout()
  console.log("DOMContentLoaded: loadPanelLayout done");
  loadReaderSettings()
  applySidebarPanelLayout()
  console.log("DOMContentLoaded: applySidebarPanelLayout done");
  addLog("AI Novel Factory Studio 已启动。")
  console.log("DOMContentLoaded: addLog done, calling loadProjects...");
  const startupMaskFallbackTimer = window.setTimeout(() => {
    hideAppLoadingMask()
    addLog("项目列表加载较慢，已先打开界面并在后台继续同步。")
  }, STARTUP_LOADING_MASK_FALLBACK_MS)
  try {
    await loadProjects()
    console.log("DOMContentLoaded: loadProjects finished, hiding loading mask");
  } catch (error) {
    handleStartupLoadFailure(error)
  } finally {
    window.clearTimeout(startupMaskFallbackTimer)
    hideAppLoadingMask()
  }
})
