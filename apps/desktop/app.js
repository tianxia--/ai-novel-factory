import { deriveStudioViewModel } from "./src/view-model.mjs"
import { applyLiveDiscussionEvent } from "./src/live-discussion.mjs"
import { buildRenderableDiscussionEntries, renderDiscussionEntryHtml, renderDiscussionHtml, shouldAutoScrollDiscussion } from "./src/discussion-renderer.mjs"
import { renderMessageMarkdown } from "./src/message-renderer.mjs"

const composerInput = document.getElementById("composer-input")
const chatMessagesBox = document.getElementById("chat-messages-box")
const sendButton = document.getElementById("send-button")
const consoleLogsBox = document.getElementById("console-logs-box")
const projectManagerView = document.getElementById("project-manager-view")
const studioView = document.getElementById("studio-view")
const projectListContainer = document.getElementById("project-list-container")
const projectCountBadge = document.getElementById("project-count-badge")
const openProjectCreateButton = document.getElementById("open-project-create-button")
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

const dashboardState = {
  projects: [],
  activeProjectId: null,
  state: null,
  transcript: "",
  envStatus: null,
  providerResult: null,
  liveDiscussion: [],
  consoleLogs: [],
  pendingUserMessage: null,
  expandedDiscussionKeys: new Set(),
  lastDiscussionResult: null,
  currentView: "manager",
  discussionAutoStickToBottom: true,
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
  const line = `[${formatClock()}] ${message}`
  dashboardState.consoleLogs.push(line)
  dashboardState.consoleLogs = dashboardState.consoleLogs.slice(-14)
  renderLogs()
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

function openProjectCreateModal() {
  projectCreateTitleInput.value = ""
  projectCreateIdeaInput.value = ""
  projectCreateChaptersInput.value = "24"
  projectCreateWordsInput.value = "2500"
  setProjectCreateStatus("", "创建后会直接进入该项目，并自动执行首轮世界观/主线 kickoff 讨论。")
  projectCreateModal.classList.remove("hidden")
}

function closeProjectCreateModal() {
  projectCreateModal.classList.add("hidden")
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let payload = {}
  try {
    payload = await response.json()
  } catch {
    payload = {}
  }

  return { ok: response.ok, status: response.status, payload }
}

function updateSnapshot(payload = {}) {
  dashboardState.projects = Array.isArray(payload.projects) ? payload.projects : dashboardState.projects
  dashboardState.activeProjectId = payload.activeProjectId || payload.projectId || dashboardState.activeProjectId
  dashboardState.state = payload.state || null
  dashboardState.transcript = payload.transcript || ""
  dashboardState.envStatus = payload.envStatus || dashboardState.envStatus
  dashboardState.providerResult = payload.result || dashboardState.providerResult
  dashboardState.lastDiscussionResult = payload.discussion || dashboardState.lastDiscussionResult
}

function renderManagerView() {
  projectCountBadge.textContent = `${dashboardState.projects.length} 个项目`

  if (dashboardState.projects.length === 0) {
    projectListContainer.innerHTML = `
      <div class="project-list-empty">
        当前还没有小说项目。点击右上角的 <strong>新建小说项目</strong>，输入想法、总章数和单章字数后，
        系统会自动初始化独立工作区，并立即发起首轮编剧室讨论。
      </div>
    `
  } else {
    projectListContainer.innerHTML = dashboardState.projects.map((project) => `
      <button class="project-card-button" type="button" data-project-id="${escapeHtml(project.id)}">
        <div class="project-card-top">
          <h3 class="project-card-title">${escapeHtml(project.title)}</h3>
          <span class="badge badge-secondary">${escapeHtml(project.slug)}</span>
        </div>
        <p class="project-card-idea">${escapeHtml(project.idea)}</p>
        <div class="project-card-meta">
          <span><i class="fa-solid fa-list-ol"></i> ${project.totalChapters} 章</span>
          <span><i class="fa-solid fa-file-word"></i> ${Number(project.chapterWordTarget).toLocaleString("zh-CN")} 字/章</span>
        </div>
        <div class="project-card-footer">
          <span><i class="fa-regular fa-clock"></i> ${escapeHtml(formatClock(project.createdAt))}</span>
          <span><i class="fa-solid fa-arrow-right"></i> 进入创作台</span>
        </div>
      </button>
    `).join("")

    projectListContainer.querySelectorAll("[data-project-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectProject(button.dataset.projectId)
      })
    })
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
  const questions = model.storyMemory.openQuestions.length
    ? model.storyMemory.openQuestions.map((question, index) => `
        <li>
          <span class="q-num">Q${index + 1}</span>
          <span class="q-text">${escapeHtml(question)}</span>
        </li>
      `).join("")
    : `<li><span class="q-text">当前没有待决问题，随时可以继续推进。</span></li>`

  container.innerHTML = `
    <div class="memory-section">
      <span class="memory-title"><i class="fa-solid fa-lightbulb"></i> 核心 Idea</span>
      <p class="memory-text">${escapeHtml(model.storyMemory.idea)}</p>
    </div>
    <div class="memory-section">
      <span class="memory-title"><i class="fa-solid fa-circle-question"></i> 世界观待决问题</span>
      <ul class="question-list">${questions}</ul>
    </div>
  `
}

function chapterStatusBadge(task) {
  if (task.status === "complete") {
    return { klass: "badge-completed", label: "已完成", itemClass: "completed", progress: 100 }
  }
  if (task.status === "in_progress") {
    return { klass: "badge-writing", label: "进行中", itemClass: "writing", progress: 58 }
  }
  if (task.status === "blocked") {
    return { klass: "badge-pending", label: "阻塞", itemClass: "", progress: 0 }
  }
  return { klass: "badge-pending", label: "待完成", itemClass: "", progress: 0 }
}

function renderChapters(model) {
  const container = document.getElementById("chapter-list-container")
  const completed = model.chapters.items.filter((item) => item.status === "complete").length
  const percentage = model.chapters.items.length ? Math.round((completed / model.chapters.items.length) * 100) : 0

  document.getElementById("total-progress-badge").textContent = `${percentage}% 已完成`
  document.getElementById("progress-percent").textContent = `${completed} / ${model.chapters.items.length} 章`
  document.getElementById("global-progress-fill").style.width = `${percentage}%`
  container.innerHTML = model.chapters.items.slice(0, 8).map((task) => {
    const badge = chapterStatusBadge(task)
    const canRun = model.workflow.currentStage.key === "drafting" || model.workflow.currentStage.key === "chapter_task_generation"
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
            <button class="btn-action chapter-run-button" data-chapter="${task.chapterNumber}" ${canRun ? "" : "disabled"}>
              <i class="fa-solid fa-play"></i>
            </button>
          </span>
        </div>
        <div class="task-progress-bar">
          <div class="task-progress-fill" style="width: ${badge.progress}%"></div>
        </div>
      </div>
    `
  }).join("")

  container.querySelectorAll(".chapter-run-button").forEach((button) => {
    button.addEventListener("click", () => runAdvance(`章节任务 #${button.dataset.chapter}`))
  })
}

function renderProvider(model) {
  const statusText = document.getElementById("conn-status-text")
  const providerName = document.querySelector(".provider-name")
  const badge = document.querySelector(".provider-badge")
  providerName.textContent = `Model: ${model.provider.modelName}`
  badge.textContent = model.provider.configured ? "已配置" : "待配置"
  badge.classList.toggle("badge-primary", model.provider.configured)

  if (model.provider.testOk) {
    statusText.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i> ${escapeHtml(model.provider.testMessage)}`
  } else if (!model.provider.configured) {
    statusText.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-warning"></i> 缺少配置: ${escapeHtml(model.provider.missing.join(", "))}`
  } else {
    statusText.innerHTML = `<i class="fa-regular fa-clock text-warning"></i> ${escapeHtml(model.provider.testMessage)}`
  }
}

function renderDiscussion(model) {
  const entries = buildRenderableDiscussionEntries({
    recentEntries: model.discussion.recent,
    pendingUserMessage: "",
    liveDiscussion: [],
  })

  if (entries.length === 0) {
    chatMessagesBox.innerHTML = `
      <div class="system-log-message">
        <i class="fa-solid fa-circle-info"></i>
        <span class="log-text">当前还没有讨论记录。输入一句想法，编剧室会实时开始讨论。</span>
      </div>
    `
    return
  }

  const shouldStickBottom = dashboardState.discussionAutoStickToBottom

  chatMessagesBox.innerHTML = renderDiscussionHtml({
    result: dashboardState.lastDiscussionResult,
    entries,
    roleMeta,
    expandedKeys: dashboardState.expandedDiscussionKeys,
    formatClock,
  })

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
    pendingUserMessage: dashboardState.pendingUserMessage,
    liveDiscussion: dashboardState.liveDiscussion,
  })

  if (liveEntries.length === 0) {
    liveRegion.innerHTML = ""
    return
  }

  const shouldStickBottom = dashboardState.discussionAutoStickToBottom
  const activeKeys = new Set()

  for (const [index, entry] of liveEntries.entries()) {
    const entryKey = entry.key || entry.turnId || `${entry.role}-${index}`
    activeKeys.add(entryKey)

    const nextHtml = renderDiscussionEntryHtml({
      entry,
      index,
      roleMeta,
      expandedKeys: dashboardState.expandedDiscussionKeys,
      formatClock,
    }).trim()

    const currentNode = liveRegion.querySelector(`[data-live-entry-key="${entryKey}"]`)
    if (!currentNode) {
      liveRegion.insertAdjacentHTML("beforeend", nextHtml)
      continue
    }

    if (entry.role === "User") {
      continue
    }

    const bubble = currentNode.querySelector(".message-bubble")
    const contentNode = currentNode.querySelector(".message-bubble-content")

    if (!bubble || !contentNode) {
      const template = document.createElement("template")
      template.innerHTML = nextHtml
      const replacement = template.content.firstElementChild
      if (replacement) {
        currentNode.replaceWith(replacement)
      }
      continue
    }

    const entryCollapsed = entry.role !== "User" && String(entry.content || "").length > 320 && !entry.streaming && !dashboardState.expandedDiscussionKeys.has(entryKey)
    bubble.classList.toggle("is-collapsed", entryCollapsed)
    bubble.classList.toggle("is-expanded", !entryCollapsed)
    contentNode.innerHTML = `${renderMessageMarkdown(entry.content)}${entry.streaming ? '<span class="stream-cursor">▋</span>' : ""}`

    let expandButton = bubble.querySelector(".message-expand-button")
    if (!entry.streaming && String(entry.content || "").length > 320) {
      if (!expandButton) {
        expandButton = document.createElement("button")
        expandButton.className = "message-expand-button"
        expandButton.dataset.entryKey = entryKey
        bubble.appendChild(expandButton)
      }
      expandButton.textContent = entryCollapsed ? "展开查看" : "收起全文"
    } else if (expandButton) {
      expandButton.remove()
    }
  }

  liveRegion.querySelectorAll("[data-live-entry-key]").forEach((node) => {
    const key = node.getAttribute("data-live-entry-key")
    if (key && !activeKeys.has(key)) {
      node.remove()
    }
  })

  if (shouldStickBottom) {
    chatMessagesBox.scrollTop = chatMessagesBox.scrollHeight
  }
}

function renderInitPanel(model) {
  initPanel.classList.toggle("hidden", model.initialized)
}

function renderDashboard() {
  const model = deriveStudioViewModel({
    state: dashboardState.state,
    transcript: dashboardState.transcript,
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

  const liveRegion = document.createElement("div")
  liveRegion.dataset.liveRegion = "true"
  chatMessagesBox.appendChild(liveRegion)
  renderLiveDiscussionPatch()
}

function renderDiscussionOnly() {
  renderLiveDiscussionPatch()
}

async function refreshDashboard() {
  if (!dashboardState.activeProjectId) {
    showManagerView()
    return
  }

  const response = await apiRequest(`/api/status?projectId=${encodeURIComponent(dashboardState.activeProjectId)}`)
  updateSnapshot(response.payload)
  if (response.ok) {
    showStudioView()
    renderDashboard()
    addLog(`已刷新工作流状态：${dashboardState.state?.runtime?.stage || "unknown"}`)
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

async function runProviderTest() {
  addLog("开始测试模型连通性...")
  const response = await apiRequest("/api/provider-test", { method: "POST" })
  updateSnapshot(response.payload)
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
  const response = await apiRequest("/api/advance", {
    method: "POST",
    body: { projectId: dashboardState.activeProjectId },
  })
  updateSnapshot(response.payload)
  renderDashboard()
}

async function runCover() {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  addLog("准备封面生成任务...")
  const response = await apiRequest("/api/cover", {
    method: "POST",
    body: { projectId: dashboardState.activeProjectId },
  })
  updateSnapshot(response.payload)
  renderDashboard()
}

async function runInterrupt(message) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }
  addLog(`收到中断调整：${message}`)
  const response = await apiRequest("/api/interrupt", {
    method: "POST",
    body: { message, projectId: dashboardState.activeProjectId },
  })
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
  const response = await apiRequest("/api/provider-test", {
    method: "POST",
    body: payload,
  })
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
  const response = await apiRequest("/api/env", {
    method: "POST",
    body: payload,
  })
  dashboardState.envStatus = response.payload?.envStatus || dashboardState.envStatus
  setProviderModalStatus("is-success", "配置已保存到当前目录的 .env。")
  addLog("已保存 provider 配置到 .env。")
  await refreshDashboard()
  window.setTimeout(() => closeProviderModal(), 500)
}

async function streamChat(message) {
  if (!dashboardState.activeProjectId) {
    addLog("请先选择一个小说项目。")
    return
  }

  dashboardState.pendingUserMessage = {
    key: `pending-user-${Date.now()}`,
    content: message,
    timestamp: new Date().toISOString(),
  }
  dashboardState.liveDiscussion = []
  dashboardState.lastDiscussionResult = null
  renderDiscussionOnly()
  addLog(`编剧室开始讨论：${message}`)

  const response = await fetch("/api/chat-stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, projectId: dashboardState.activeProjectId }),
  })

  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}))
    addLog(payload.error || `讨论失败 (${response.status})`)
    dashboardState.pendingUserMessage = null
    renderDiscussionOnly()
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

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
}

function handleSseChunk(chunk) {
  const lines = chunk.split("\n")
  const eventLine = lines.find((line) => line.startsWith("event:"))
  const dataLine = lines.find((line) => line.startsWith("data:"))
  if (!eventLine || !dataLine) {
    return
  }

  const eventName = eventLine.slice("event:".length).trim()
  const data = JSON.parse(dataLine.slice("data:".length).trim())

  if (eventName === "agent") {
    dashboardState.liveDiscussion = applyLiveDiscussionEvent(dashboardState.liveDiscussion, eventName, data)
    renderDiscussionOnly()
    return
  }

  if (eventName === "agent_start" || eventName === "agent_delta" || eventName === "agent_complete") {
    dashboardState.liveDiscussion = applyLiveDiscussionEvent(dashboardState.liveDiscussion, eventName, data)
    renderDiscussionOnly()
    return
  }

  if (eventName === "complete") {
    updateSnapshot(data)
    dashboardState.pendingUserMessage = null
    dashboardState.liveDiscussion = []
    renderDashboard()
    addLog("讨论完成，状态与共识已回写。")
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
  const response = await apiRequest("/api/projects")
  updateSnapshot(response.payload)
  renderManagerView()
  return response
}

async function selectProject(projectId) {
  dashboardState.activeProjectId = projectId
  await refreshDashboard()
}

async function createProjectFromModal({ title, idea, chapters, chapterWords }) {
  if (!idea) {
    setProjectCreateStatus("is-error", "请输入一句明确的小说想法。")
    return
  }

  setProjectCreateStatus("is-loading", "正在初始化项目并启动首轮编剧室讨论...")
  const response = await apiRequest("/api/projects", {
    method: "POST",
    body: { title, idea, chapters, chapterWords },
  })

  if (!response.ok) {
    setProjectCreateStatus("is-error", response.payload?.error || "项目创建失败。")
    return
  }

  updateSnapshot(response.payload)
  dashboardState.pendingUserMessage = null
  dashboardState.liveDiscussion = []
  showStudioView()
  renderDashboard()
  addLog(`项目已创建：${dashboardState.state?.project?.title || idea}`)
  setProjectCreateStatus("is-success", "项目已创建，首轮 autonomous kickoff 讨论已完成。")
  window.setTimeout(() => closeProjectCreateModal(), 400)
}

async function handleComposerSubmit() {
  const raw = composerInput.value.trim()
  if (!raw) return
  composerInput.value = ""

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
  providerTestButton.addEventListener("click", runModalProviderTest)
  providerSaveButton.addEventListener("click", saveProviderConfigFromModal)
  initButton.addEventListener("click", initializeWorkspace)
  projectCreateSubmitButton.addEventListener("click", () => createProjectFromModal({
    title: projectCreateTitleInput.value.trim(),
    idea: projectCreateIdeaInput.value.trim(),
    chapters: Number.parseInt(projectCreateChaptersInput.value || "24", 10),
    chapterWords: Number.parseInt(projectCreateWordsInput.value || "2500", 10),
  }))
  chatMessagesBox.addEventListener("click", (event) => {
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

  addLog("AI Novel Factory Studio 已启动。")
  await loadProjects()
})
