const DEBUG_API = "http://127.0.0.1:4314"
const WORLD_NODE = "world-foundation"
const CHARACTER_NODE = "character-planning"
const INITIAL_STATE_NODE = "initial-character-state"
const WORLD_MATRIX_NODE = "world-matrix"
const PLOT_ARCHITECTURE_NODE = "plot-architecture"
const STORY_BIBLE_NODE = "story-bible"
const VOLUME_STRATEGY_NODE = "volume-strategy"
const CHAPTER_BLUEPRINTS_NODE = "chapter-blueprints"
const STYLE_PROFILE_NODE = "style-profile"
const SINGLE_CHAPTER_CONTEXT_NODE = "single-chapter-context"
const CHAPTER_DRAFT_NODE = "chapter-draft"
const CHAPTER_COMMIT_NODE = "chapter-commit"
const CONTINUOUS_CHAPTER_NODE = "continuous-chapter-production"
const CHAPTER_REVIEW_NODE = "chapter-review"
const TERMINAL_STATUSES = ["completed", "invalid", "failed", "paused"]
const CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT = 5
const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => Array.from(document.querySelectorAll(selector))

const state = {
  activeNode: WORLD_NODE,
  runs: { [WORLD_NODE]: null, [CHARACTER_NODE]: null, [INITIAL_STATE_NODE]: null, [WORLD_MATRIX_NODE]: null, [PLOT_ARCHITECTURE_NODE]: null, [STORY_BIBLE_NODE]: null, [VOLUME_STRATEGY_NODE]: null, [CHAPTER_BLUEPRINTS_NODE]: null, [STYLE_PROFILE_NODE]: null, [SINGLE_CHAPTER_CONTEXT_NODE]: null, [CHAPTER_DRAFT_NODE]: null, [CHAPTER_COMMIT_NODE]: null, [CONTINUOUS_CHAPTER_NODE]: null, [CHAPTER_REVIEW_NODE]: null },
  runIds: { [WORLD_NODE]: null, [CHARACTER_NODE]: null, [INITIAL_STATE_NODE]: null, [WORLD_MATRIX_NODE]: null, [PLOT_ARCHITECTURE_NODE]: null, [STORY_BIBLE_NODE]: null, [VOLUME_STRATEGY_NODE]: null, [CHAPTER_BLUEPRINTS_NODE]: null, [STYLE_PROFILE_NODE]: null, [SINGLE_CHAPTER_CONTEXT_NODE]: null, [CHAPTER_DRAFT_NODE]: null, [CHAPTER_COMMIT_NODE]: null, [CONTINUOUS_CHAPTER_NODE]: null, [CHAPTER_REVIEW_NODE]: null },
  pollTimers: { [WORLD_NODE]: null, [CHARACTER_NODE]: null, [INITIAL_STATE_NODE]: null, [WORLD_MATRIX_NODE]: null, [PLOT_ARCHITECTURE_NODE]: null, [STORY_BIBLE_NODE]: null, [VOLUME_STRATEGY_NODE]: null, [CHAPTER_BLUEPRINTS_NODE]: null, [STYLE_PROFILE_NODE]: null, [SINGLE_CHAPTER_CONTEXT_NODE]: null, [CHAPTER_DRAFT_NODE]: null, [CHAPTER_COMMIT_NODE]: null, [CONTINUOUS_CHAPTER_NODE]: null, [CHAPTER_REVIEW_NODE]: null },
  activeTab: "input",
  chapterBlueprintHistory: [],
  modelConfigs: [],
  projects: [],
  selectedModelConfigId: window.localStorage.getItem("flow-debug.model-config-id") || "",
  selectedProjectId: window.localStorage.getItem("flow-debug.project-id") || "",
  modelConfigError: "",
  projectError: "",
  productionSandbox: null,
  productionSandboxBusy: false,
  productionSandboxError: "",
  productionSandboxPollToken: 0,
  chapterBlueprintAutoRun: { active: false, stopRequested: false, completedBatches: 0, lastMessage: "" },
  continuousChapterAutoRun: { active: false, stopRequested: false, completedBatches: 0, lastMessage: "" },
  committedChapterCoverage: null,
  committedChapterCoverageProjectId: "",
  chapterReader: { selectedChapter: null, loading: false, error: "", chapter: null },
  chapterReview: { loading: false, error: "", report: null },
  styleFreezeBusy: false,
  lastEventCount: { [WORLD_NODE]: 0, [CHARACTER_NODE]: 0, [INITIAL_STATE_NODE]: 0, [WORLD_MATRIX_NODE]: 0, [PLOT_ARCHITECTURE_NODE]: 0, [STORY_BIBLE_NODE]: 0, [VOLUME_STRATEGY_NODE]: 0, [CHAPTER_BLUEPRINTS_NODE]: 0, [STYLE_PROFILE_NODE]: 0, [SINGLE_CHAPTER_CONTEXT_NODE]: 0, [CHAPTER_DRAFT_NODE]: 0, [CHAPTER_COMMIT_NODE]: 0, [CONTINUOUS_CHAPTER_NODE]: 0, [CHAPTER_REVIEW_NODE]: 0 },
}

function selectedFactoryProjectId() {
  const current = String(state.selectedProjectId || "").trim()
  if (state.projects.some((project) => project.id === current)) return current
  const selectedFromDom = String($("#debug-project-select")?.value || "").trim()
  if (state.projects.some((project) => project.id === selectedFromDom)) {
    state.selectedProjectId = selectedFromDom
    window.localStorage.setItem("flow-debug.project-id", selectedFromDom)
    return selectedFromDom
  }
  const fallback = state.projects[0]?.id || ""
  if (fallback) {
    state.selectedProjectId = fallback
    window.localStorage.setItem("flow-debug.project-id", fallback)
  }
  return fallback
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function activeRun() {
  return state.runs[state.activeNode]
}

function selectedDebugModelId() {
  return String(state.selectedModelConfigId || "").trim()
}

function debugRunBindingInput() {
  return {
    modelConfigId: selectedDebugModelId(),
    factoryProjectId: selectedFactoryProjectId(),
  }
}

function worldFormInput() {
  return {
    ...debugRunBindingInput(),
    title: $("#title").value.trim(),
    coreIdea: $("#core-idea").value.trim(),
    genre: $("#genre").value.trim(),
    audience: $("#audience").value.trim(),
    tone: $("#tone").value.trim(),
    protagonistSeed: $("#protagonist-seed").value.trim(),
    mustInclude: $("#must-include").value.trim(),
    mustAvoid: $("#must-avoid").value.trim(),
    totalChapters: Number($("#total-chapters").value),
    temperature: Number($("#temperature").value),
  }
}

function characterFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[WORLD_NODE],
    planningFocus: $("#planning-focus").value.trim(),
    temperature: Number($("#character-temperature").value),
  }
}

function initialStateFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[CHARACTER_NODE],
    stateFocus: $("#initial-state-focus").value.trim(),
    openingChapter: Number($("#opening-chapter").value),
    temperature: Number($("#initial-state-temperature").value),
  }
}

function worldMatrixFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[INITIAL_STATE_NODE],
    matrixFocus: $("#world-matrix-focus").value.trim(),
    temperature: Number($("#world-matrix-temperature").value),
  }
}

function plotArchitectureFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[WORLD_MATRIX_NODE],
    architectureFocus: $("#plot-architecture-focus").value.trim(),
    temperature: Number($("#plot-architecture-temperature").value),
  }
}

function storyBibleFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[PLOT_ARCHITECTURE_NODE],
    bibleFocus: $("#story-bible-focus").value.trim(),
    temperature: Number($("#story-bible-temperature").value),
  }
}

function volumeStrategyFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[STORY_BIBLE_NODE],
    strategyFocus: $("#volume-strategy-focus").value.trim(),
    targetVolumeCount: Number($("#volume-strategy-target-count").value),
    temperature: Number($("#volume-strategy-temperature").value),
  }
}

function chapterBlueprintFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[VOLUME_STRATEGY_NODE],
    blueprintFocus: $("#chapter-blueprints-focus").value.trim(),
    volumeId: $("#chapter-blueprints-volume-id").value,
    startChapter: Number($("#chapter-blueprints-start-chapter").value),
    endChapter: Number($("#chapter-blueprints-end-chapter").value),
    targetWordCount: Number($("#chapter-blueprints-target-words").value),
    temperature: Number($("#chapter-blueprints-temperature").value),
  }
}

function styleProfileFormInput() {
  const aigcMode = $("#style-profile-aigc-mode").value
  const aigcModeMap = {
    merged_balanced: { aigcGranularity: "merged_sentence", aigcPolicy: "balanced" },
    node09_strict: { aigcGranularity: "node09", aigcPolicy: "strict_any_sentence" },
    sentence_strict: { aigcGranularity: "sentence", aigcPolicy: "strict_any_sentence" },
    paragraph_overall: { aigcGranularity: "paragraph", aigcPolicy: "overall_only" },
  }
  const mappedAigcMode = aigcModeMap[aigcMode] || aigcModeMap.merged_balanced
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[CHAPTER_BLUEPRINTS_NODE],
    styleFocus: $("#style-profile-focus").value.trim(),
    humanBaselineText: $("#style-profile-human-baseline").value.trim(),
    aigcMode,
    ...mappedAigcMode,
    aigcMinSegmentChars: Number($("#style-profile-aigc-min-segment-chars").value),
    sampleChapter: Number($("#style-profile-sample-chapter").value),
    maxRounds: Number($("#style-profile-max-rounds").value),
    temperature: Number($("#style-profile-temperature").value),
  }
}

function singleChapterContextFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[STYLE_PROFILE_NODE],
    chapterNumber: Number($("#single-chapter-context-chapter").value),
    targetWordCount: Number($("#single-chapter-context-target-words").value),
    contextFocus: $("#single-chapter-context-focus").value.trim(),
  }
}

function chapterDraftFormInput() {
  const contextRun = state.runs[SINGLE_CHAPTER_CONTEXT_NODE]
  const contextChapter = Number(contextRun?.result?.source?.chapterNumber || contextRun?.input?.chapterNumber || 1)
  const contextTargetWords = Number(contextRun?.result?.source?.targetWordCount || contextRun?.input?.targetWordCount || $("#chapter-draft-target-words").value)
  const targetWordCount = Number($("#chapter-draft-target-words").value)
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[SINGLE_CHAPTER_CONTEXT_NODE],
    chapterNumber: contextChapter,
    targetWordCount: Number.isInteger(targetWordCount) ? targetWordCount : contextTargetWords,
    draftFocus: $("#chapter-draft-focus").value.trim(),
    temperature: Number($("#chapter-draft-temperature").value),
    maxRepairRounds: Number($("#chapter-draft-max-repair-rounds").value),
    aigcPolicy: $("#chapter-draft-aigc-policy").value,
    aigcMinSegmentChars: 120,
  }
}

function chapterCommitFormInput() {
  const draftRun = state.runs[CHAPTER_DRAFT_NODE]
  const finalCandidate = draftRun?.result?.finalCandidate || draftRun?.result?.draft || {}
  const chapterNumber = Number(finalCandidate.chapterNumber || draftRun?.input?.chapterNumber || 1)
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[CHAPTER_DRAFT_NODE],
    chapterNumber,
    commitNote: $("#chapter-commit-note")?.value.trim() || "",
  }
}

function continuousChapterFormInput() {
  return {
    ...debugRunBindingInput(),
    upstreamRunId: state.runIds[STYLE_PROFILE_NODE],
    startChapter: Number($("#continuous-chapter-start").value),
    endChapter: Number($("#continuous-chapter-end").value),
    targetWordCount: Number($("#continuous-chapter-target-words").value),
    maxRepairRounds: Number($("#continuous-chapter-max-repair-rounds").value),
    aigcPolicy: $("#continuous-chapter-aigc-policy").value,
    aigcMinSegmentChars: 120,
    temperature: Number($("#continuous-chapter-temperature").value),
    productionFocus: $("#continuous-chapter-focus").value.trim(),
  }
}

function chapterReviewFormInput() {
  return {
    ...debugRunBindingInput(),
    firstChapter: Number($("#chapter-review-start")?.value || 1),
    lastChapter: Number($("#chapter-review-end")?.value || state.committedChapterCoverage?.lastContinuousChapter || 1),
  }
}

function firstVolumeRangeFromStyleRun(styleRun = state.runs[STYLE_PROFILE_NODE]) {
  const volumeStrategy = styleRun?.input?.volumeStrategy || {}
  const volumes = Array.isArray(volumeStrategy.volumes) ? volumeStrategy.volumes : []
  const firstVolume = volumes.find((volume) => String(volume.id || "") === "volume_01") || volumes[0] || null
  const blueprints = Array.isArray(styleRun?.input?.chapterBlueprints?.blueprints) ? styleRun.input.chapterBlueprints.blueprints : []
  const firstVolumeBlueprints = firstVolume
    ? blueprints.filter((entry) => String(entry.volumeId || "") === String(firstVolume.id || ""))
    : blueprints
  const blueprintChapters = firstVolumeBlueprints.map((entry) => Number(entry.chapterNumber)).filter((chapter) => Number.isInteger(chapter))
  const fallbackStart = blueprintChapters.length ? Math.min(...blueprintChapters) : 1
  const fallbackEnd = blueprintChapters.length ? Math.max(...blueprintChapters) : fallbackStart
  return {
    volumeId: String(firstVolume?.id || "volume_01"),
    title: String(firstVolume?.title || "第一卷"),
    startChapter: Number(firstVolume?.startChapter || fallbackStart),
    endChapter: Number(firstVolume?.endChapter || fallbackEnd),
  }
}

function restoreDrafts() {
  const raw = window.localStorage.getItem("world-foundation-debug.draft")
  if (raw) {
    try {
      const draft = JSON.parse(raw)
      const fields = {
        title: "#title",
        coreIdea: "#core-idea",
        genre: "#genre",
        audience: "#audience",
        tone: "#tone",
        protagonistSeed: "#protagonist-seed",
        mustInclude: "#must-include",
        mustAvoid: "#must-avoid",
        totalChapters: "#total-chapters",
        temperature: "#temperature",
      }
      Object.entries(fields).forEach(([key, selector]) => {
        if (draft[key] !== undefined) $(selector).value = String(draft[key])
      })
    } catch {}
  }
  const characterRaw = window.localStorage.getItem("character-planning-debug.draft")
  if (characterRaw) {
    try {
      const draft = JSON.parse(characterRaw)
      if (draft.planningFocus !== undefined) $("#planning-focus").value = String(draft.planningFocus)
      if (draft.temperature !== undefined) $("#character-temperature").value = String(draft.temperature)
    } catch {}
  }
  const initialStateRaw = window.localStorage.getItem("initial-character-state-debug.draft")
  if (initialStateRaw) {
    try {
      const draft = JSON.parse(initialStateRaw)
      if (draft.stateFocus !== undefined) $("#initial-state-focus").value = String(draft.stateFocus)
      if (draft.temperature !== undefined) $("#initial-state-temperature").value = String(draft.temperature)
    } catch {}
  }
  const worldMatrixRaw = window.localStorage.getItem("world-matrix-debug.draft")
  if (worldMatrixRaw) {
    try {
      const draft = JSON.parse(worldMatrixRaw)
      if (draft.matrixFocus !== undefined) $("#world-matrix-focus").value = String(draft.matrixFocus)
      if (draft.temperature !== undefined) $("#world-matrix-temperature").value = String(draft.temperature)
    } catch {}
  }
  const plotArchitectureRaw = window.localStorage.getItem("plot-architecture-debug.draft")
  if (plotArchitectureRaw) {
    try {
      const draft = JSON.parse(plotArchitectureRaw)
      if (draft.architectureFocus !== undefined) $("#plot-architecture-focus").value = String(draft.architectureFocus)
      if (draft.temperature !== undefined) $("#plot-architecture-temperature").value = String(draft.temperature)
    } catch {}
  }
  const storyBibleRaw = window.localStorage.getItem("story-bible-debug.draft")
  if (storyBibleRaw) {
    try {
      const draft = JSON.parse(storyBibleRaw)
      if (draft.bibleFocus !== undefined) $("#story-bible-focus").value = String(draft.bibleFocus)
      if (draft.temperature !== undefined) $("#story-bible-temperature").value = String(draft.temperature)
    } catch {}
  }
  const volumeStrategyRaw = window.localStorage.getItem("volume-strategy-debug.draft")
  if (volumeStrategyRaw) {
    try {
      const draft = JSON.parse(volumeStrategyRaw)
      if (draft.strategyFocus !== undefined) $("#volume-strategy-focus").value = String(draft.strategyFocus)
      if (draft.targetVolumeCount !== undefined) $("#volume-strategy-target-count").value = String(draft.targetVolumeCount)
      if (draft.temperature !== undefined) $("#volume-strategy-temperature").value = String(draft.temperature)
    } catch {}
  }
  const chapterBlueprintRaw = window.localStorage.getItem("chapter-blueprints-debug.draft")
  if (chapterBlueprintRaw) {
    try {
      const draft = JSON.parse(chapterBlueprintRaw)
      if (draft.blueprintFocus !== undefined) $("#chapter-blueprints-focus").value = String(draft.blueprintFocus)
      if (draft.volumeId !== undefined) $("#chapter-blueprints-volume-id").dataset.restoredValue = String(draft.volumeId)
      if (draft.startChapter !== undefined) $("#chapter-blueprints-start-chapter").value = String(draft.startChapter)
      if (draft.endChapter !== undefined) $("#chapter-blueprints-end-chapter").value = String(draft.endChapter)
      if (draft.targetWordCount !== undefined) $("#chapter-blueprints-target-words").value = String(draft.targetWordCount)
      if (draft.temperature !== undefined) $("#chapter-blueprints-temperature").value = String(draft.temperature)
    } catch {}
  }
  const styleProfileRaw = window.localStorage.getItem("style-profile-debug.draft")
  if (styleProfileRaw) {
    try {
      const draft = JSON.parse(styleProfileRaw)
      if (draft.styleFocus !== undefined) $("#style-profile-focus").value = String(draft.styleFocus)
      if (draft.humanBaselineText !== undefined) $("#style-profile-human-baseline").value = String(draft.humanBaselineText)
      if (draft.aigcMode !== undefined) $("#style-profile-aigc-mode").value = String(draft.aigcMode)
      if (draft.aigcMinSegmentChars !== undefined) $("#style-profile-aigc-min-segment-chars").value = String(draft.aigcMinSegmentChars)
      if (draft.sampleChapter !== undefined) $("#style-profile-sample-chapter").value = String(draft.sampleChapter)
      if (draft.maxRounds !== undefined) $("#style-profile-max-rounds").value = String(draft.maxRounds)
      if (draft.temperature !== undefined) $("#style-profile-temperature").value = String(draft.temperature)
    } catch {}
  }
  const singleChapterContextRaw = window.localStorage.getItem("single-chapter-context-debug.draft")
  if (singleChapterContextRaw) {
    try {
      const draft = JSON.parse(singleChapterContextRaw)
      if (draft.chapterNumber !== undefined) $("#single-chapter-context-chapter").value = String(draft.chapterNumber)
      if (draft.targetWordCount !== undefined) $("#single-chapter-context-target-words").value = String(draft.targetWordCount)
      if (draft.contextFocus !== undefined) $("#single-chapter-context-focus").value = String(draft.contextFocus)
    } catch {}
  }
  const chapterDraftRaw = window.localStorage.getItem("chapter-draft-debug.draft")
  if (chapterDraftRaw) {
    try {
      const draft = JSON.parse(chapterDraftRaw)
      if (draft.targetWordCount !== undefined) $("#chapter-draft-target-words").value = String(draft.targetWordCount)
      if (draft.draftFocus !== undefined) $("#chapter-draft-focus").value = String(draft.draftFocus)
      if (draft.temperature !== undefined) $("#chapter-draft-temperature").value = String(draft.temperature)
      if (draft.maxRepairRounds !== undefined) $("#chapter-draft-max-repair-rounds").value = String(draft.maxRepairRounds)
      if (draft.aigcPolicy !== undefined) $("#chapter-draft-aigc-policy").value = String(draft.aigcPolicy)
    } catch {}
  }
}

function characterTarget(totalChapters) {
  if (totalChapters <= 60) return 6
  if (totalChapters <= 150) return 8
  if (totalChapters <= 300) return 10
  return 12
}

function plotArcTarget(totalChapters) {
  return Math.max(4, Math.min(10, Math.ceil(totalChapters / 60)))
}

function volumeTarget(arcCount) {
  if (arcCount <= 1) return 1
  return Math.max(2, Math.min(12, arcCount, Math.ceil(arcCount / 2)))
}

function worldCharacters(run) {
  return Array.isArray(run?.result?.characters) ? run.result.characters : []
}

function plannedCharacters(run) {
  return Array.isArray(run?.result?.characters) ? run.result.characters : []
}

function initialStateCharacters(run) {
  return Array.isArray(run?.result?.characters) ? run.result.characters : []
}

function openingLocations(run) {
  const locations = initialStateCharacters(run).map((character) => String(character.location || "").trim()).filter(Boolean)
  const primaryLocation = String(run?.result?.openingFrame?.primaryLocation || "").trim()
  if (primaryLocation) locations.push(primaryLocation)
  return [...new Set(locations)]
}

function chapterBlueprintHistoryFor(volumeId) {
  const upstreamRunId = state.runIds[VOLUME_STRATEGY_NODE]
  return state.chapterBlueprintHistory.filter((run) => run.upstreamRunId === upstreamRunId && run.volumeId === volumeId)
}

function selectedChapterBlueprintVolume() {
  const volumeRun = state.runs[VOLUME_STRATEGY_NODE]
  const volumeId = $("#chapter-blueprints-volume-id")?.value
  return Array.isArray(volumeRun?.result?.volumes)
    ? volumeRun.result.volumes.find((entry) => entry.id === volumeId) || null
    : null
}

function chapterBlueprintCoverageFor(selectedVolume) {
  const history = selectedVolume ? chapterBlueprintHistoryFor(selectedVolume.id) : []
  const volumeStart = Number(selectedVolume?.startChapter || 0)
  const volumeEnd = Number(selectedVolume?.endChapter || 0)
  const volumeTotal = volumeEnd >= volumeStart ? volumeEnd - volumeStart + 1 : 0
  const generated = new Set()
  const valid = new Set()
  history.forEach((run) => {
    if (run.blueprintCount > 0) for (let chapter = run.startChapter; chapter <= run.endChapter; chapter += 1) generated.add(chapter)
    if (run.status === "completed" && run.valid) for (let chapter = run.startChapter; chapter <= run.endChapter; chapter += 1) valid.add(chapter)
  })
  const firstMissing = selectedVolume ? Array.from({ length: volumeTotal }, (_, index) => volumeStart + index).find((chapter) => !valid.has(chapter)) : null
  return { history, volumeStart, volumeEnd, volumeTotal, generated, valid, firstMissing }
}

function completedChapterBlueprintCoverage() {
  const completed = state.chapterBlueprintHistory
    .filter((run) => run.status === "completed" && run.valid && run.blueprintCount > 0)
    .sort((a, b) => Number(a.startChapter) - Number(b.startChapter) || Number(a.endChapter) - Number(b.endChapter))
  const chapters = new Set()
  completed.forEach((run) => {
    for (let chapter = Number(run.startChapter); chapter <= Number(run.endChapter); chapter += 1) chapters.add(chapter)
  })
  const sortedChapters = [...chapters].sort((a, b) => a - b)
  return {
    completed,
    chapters,
    firstChapter: sortedChapters[0] || 0,
    lastChapter: sortedChapters.at(-1) || 0,
    count: sortedChapters.length,
  }
}

function renderChapterBlueprintLearning(run) {
  const learning = run?.learning
  const active = Array.isArray(learning?.activeExperiences) ? learning.activeExperiences : []
  const candidates = Array.isArray(learning?.candidateExperiences) ? learning.candidateExperiences : []
  const stateLedger = Array.isArray(learning?.stateLedger) ? learning.stateLedger : []
  const conflicts = Array.isArray(learning?.conflicts) ? learning.conflicts.filter((entry) => entry.status !== "resolved") : []
  $("#chapter-learning-prompt-version").textContent = learning?.promptVersion || "尚未加载"
  $("#chapter-learning-active-count").textContent = String(active.length)
  $("#chapter-learning-candidate-count").textContent = String(candidates.length)
  $("#chapter-learning-state-count").textContent = String(stateLedger.length)
  $("#chapter-learning-conflict-count").textContent = String(conflicts.length)
  $("#chapter-learning-experiences").innerHTML = active.length
    ? active.slice(0, 12).map((entry) => `
      <article class="learning-rule ${escapeHtml(entry.scope || "system")}">
        <span>${escapeHtml(entry.scope || "system")} · ${escapeHtml(entry.status || "candidate")} · ${Number(entry.confidence || 0).toFixed(2)}</span>
        <strong>${escapeHtml(entry.title || entry.fingerprint || "未命名经验")}</strong>
        <p>${escapeHtml(entry.instruction || "")}</p>
      </article>`).join("")
    : '<div class="loop-trace-empty">当前 Run 尚未加载经验；运行节点或修复当前结果后会建立学习上下文。</div>'
  const conflictPanel = $("#chapter-learning-conflicts")
  conflictPanel.hidden = conflicts.length === 0
  conflictPanel.innerHTML = conflicts.map((entry) => `<article><strong>${escapeHtml(entry.kind || "conflict")}</strong><p>${escapeHtml(entry.message || "")}</p></article>`).join("")
}

function renderChapterBlueprintLedger(selectedVolume, chapterReady) {
  const { history, volumeStart, volumeEnd, volumeTotal, generated, valid, firstMissing } = chapterBlueprintCoverageFor(selectedVolume)
  $("#chapter-blueprints-generated-count").textContent = String(generated.size)
  $("#chapter-blueprints-valid-count").textContent = String(valid.size)
  $("#chapter-blueprints-volume-total").textContent = String(volumeTotal)
  $("#chapter-blueprints-coverage-bar").style.width = `${volumeTotal ? Math.min(100, valid.size / volumeTotal * 100) : 0}%`
  const activeChapterRun = state.runs[CHAPTER_BLUEPRINTS_NODE]
  renderChapterBlueprintLearning(activeChapterRun)
  const rangeSignature = selectedVolume && Number.isInteger(firstMissing)
    ? `${state.runIds[VOLUME_STRATEGY_NODE] || "none"}:${selectedVolume.id}:${firstMissing}`
    : ""
  const volumeSelect = $("#chapter-blueprints-volume-id")
  if (rangeSignature && volumeSelect.dataset.nextRangeSignature !== rangeSignature && !["queued", "running"].includes(activeChapterRun?.status)) {
    const startInput = $("#chapter-blueprints-start-chapter")
    const endInput = $("#chapter-blueprints-end-chapter")
    const requestedCount = Number(endInput.value) - Number(startInput.value) + 1
    const batchSize = Number.isInteger(requestedCount) && requestedCount >= 1 ? Math.min(requestedCount, CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT) : CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT
    startInput.value = String(firstMissing)
    endInput.value = String(Math.min(firstMissing + batchSize - 1, volumeEnd))
    volumeSelect.dataset.nextRangeSignature = rangeSignature
  }
  $("#chapter-blueprints-coverage-detail").textContent = !chapterReady
    ? "等待分卷策略。"
    : firstMissing === undefined
      ? `本卷第 ${volumeStart}-${volumeEnd} 章已全部通过结构与正典语义审计。`
      : `下一处未通过章节从第 ${firstMissing} 章开始；已调用 ${generated.size} 章，真正通过 ${valid.size} 章。`
  $("#chapter-blueprints-coverage-grid").innerHTML = selectedVolume
    ? Array.from({ length: volumeTotal }, (_, index) => {
      const chapter = volumeStart + index
      const className = valid.has(chapter) ? "valid" : generated.has(chapter) ? "generated" : ""
      return `<span class="${className}" title="第 ${chapter} 章">${chapter}</span>`
    }).join("")
    : ""
  const continueButton = $("#chapter-blueprints-continue-button")
  const autoRun = state.chapterBlueprintAutoRun
  continueButton.disabled = autoRun.active || !chapterReady || firstMissing === undefined || firstMissing === null
  continueButton.dataset.nextChapter = firstMissing === undefined || firstMissing === null ? "" : String(firstMissing)
  const autoButton = $("#chapter-blueprints-auto-button")
  if (autoButton) {
    autoButton.disabled = autoRun.stopRequested || (!autoRun.active && (!chapterReady || firstMissing === undefined || firstMissing === null))
    autoButton.classList.toggle("active", autoRun.active)
    autoButton.textContent = autoRun.active ? autoRun.stopRequested ? "停止中…" : "停止自动生成" : "自动生成全卷"
  }
  const autoStatus = $("#chapter-blueprints-auto-status")
  if (autoStatus) {
    autoStatus.textContent = autoRun.active
      ? `自动全卷运行中：${autoRun.lastMessage || `已完成 ${autoRun.completedBatches} 批，等待当前批次结果。`}`
      : !chapterReady
        ? "自动全卷：等待分卷策略通过。"
        : firstMissing === undefined
          ? `自动全卷：本卷第 ${volumeStart}-${volumeEnd} 章已全部通过。`
          : `自动全卷：点击后将从第 ${firstMissing} 章开始，每批最多 ${CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT} 章，失败会自动停下并保留日志。`
  }
  const runButtonLabel = $("#chapter-blueprints-run-button span:last-child")
  if (runButtonLabel) runButtonLabel.textContent = Number.isInteger(firstMissing)
    ? `生成下一批：从第 ${firstMissing} 章开始`
    : firstMissing === undefined ? "本卷已全部通过" : "运行章节蓝图节点"
  const activeValidationErrors = Array.isArray(activeChapterRun?.validation?.errors) ? activeChapterRun.validation.errors : []
  const runEvents = Array.isArray(activeChapterRun?.events) ? activeChapterRun.events : []
  const cacheEvents = runEvents.filter((event) => event.phase === "prompt-cache" && event.data)
  const cacheTotals = cacheEvents.reduce((totals, event) => ({
    promptTokens: totals.promptTokens + Number(event.data?.promptTokens || 0),
    cachedTokens: totals.cachedTokens + Number(event.data?.cachedTokens || 0),
    cacheMissTokens: totals.cacheMissTokens + Number(event.data?.cacheMissTokens || 0),
    reasoningTokens: totals.reasoningTokens + Number(event.data?.reasoningTokens || 0),
  }), { promptTokens: 0, cachedTokens: 0, cacheMissTokens: 0, reasoningTokens: 0 })
  const aggregateCacheHitRate = cacheTotals.promptTokens > 0 ? cacheTotals.cachedTokens / cacheTotals.promptTokens * 100 : 0
  $("#chapter-blueprints-cache-status").textContent = cacheEvents.length
    ? `上下文缓存：本 Run 已统计 ${cacheEvents.length} 次模型调用，累计命中 ${cacheTotals.cachedTokens}/${cacheTotals.promptTokens} tokens（${aggregateCacheHitRate.toFixed(1)}%），未命中 ${cacheTotals.cacheMissTokens}，推理 ${cacheTotals.reasoningTokens}。`
    : "上下文缓存：历史 Run 未记录 usage；新 Run 将显示命中 Token、未命中 Token、命中率和推理 Token。"
  const latestLoopAnchor = runEvents.findLastIndex((event) => event.phase === "repair-loop" && (
    String(event.message || "").includes("正典审计未通过，自动把")
    || String(event.message || "").includes("首次完整校验发现")
  ))
  const loopCycleEvents = latestLoopAnchor >= 0 ? runEvents.slice(Math.max(0, latestLoopAnchor - 1)) : []
  const loopEvents = loopCycleEvents.filter((event) => event.level !== "stream" && ["repair-loop", "manual-repair", "semantic-audit"].includes(event.phase))
  const loopStarts = loopEvents.filter((event) => event.phase === "manual-repair" && String(event.message || "").includes("本次循环"))
  const automaticLoopRound = loopEvents.reduce((maximum, event) => Math.max(maximum, Number(event.data?.repairRound || 0)), 0)
  const lastLoopEvent = loopEvents.at(-1)
  const shownLoopRound = Math.max(loopStarts.length, automaticLoopRound)
  const legacyFixedLoop = loopEvents.some((event) => Number(event.data?.maximumAutoRepairRounds || event.data?.maximumLoopRounds || 0) === 3
    || /(?:第\s*\d+\/3\s*轮|最多\s*3\s*轮)/u.test(String(event.message || "")))
  $("#chapter-blueprints-loop-status").textContent = !activeChapterRun
    ? "持续收敛 Learning Loop：生成、校验、错误原文回写、定向修复并复检；不再固定 3 轮，成功、正典冲突或连续无进展时停止。"
    : ["queued", "running"].includes(activeChapterRun.status) && lastLoopEvent
      ? `持续收敛运行中：第 ${Math.max(1, shownLoopRound)} 轮 · ${lastLoopEvent.message}`
      : activeChapterRun.status === "completed" && shownLoopRound
        ? `持续收敛已完成：执行 ${shownLoopRound} 轮后通过结构校验与独立正典审计。`
        : activeChapterRun.status === "invalid" && lastLoopEvent
          ? legacyFixedLoop
            ? `历史 Run（旧版固定 3 轮策略）已停止：当前剩余 ${activeValidationErrors.length} 个错误。新运行将使用持续收敛策略。最后结果：${lastLoopEvent.message}`
            : `持续收敛已停止：已执行 ${shownLoopRound} 轮，当前剩余 ${activeValidationErrors.length} 个错误。最后结果：${lastLoopEvent.message}`
      : "Learning Loop 待命：若校验失败，将记录错误指纹、验证修复效果并更新分层经验。"
  $("#chapter-blueprints-loop-trace").innerHTML = loopEvents.length
    ? loopEvents.slice(-14).map((event) => `<div class="loop-step ${escapeHtml(event.level || "info")}"><span>${escapeHtml(event.phase || "loop")}</span><p>${escapeHtml(event.message || "")}</p></div>`).join("")
    : '<div class="loop-trace-empty">等待触发自动闭环；触发后会按顺序显示审计、错误回填、定向修复和复检。</div>'
  const auditPendingOnly = Boolean(activeChapterRun?.result)
    && !activeChapterRun?.semanticAudit
    && activeValidationErrors.length === 1
    && activeValidationErrors[0].includes("尚未执行正典审计")
  const repairButton = $("#chapter-blueprints-repair-button")
  repairButton.disabled = autoRun.active || !activeChapterRun?.result || activeChapterRun?.validation?.valid === true || auditPendingOnly || ["queued", "running"].includes(activeChapterRun?.status)
  const auditButton = $("#chapter-blueprints-audit-button")
  auditButton.disabled = autoRun.active || !auditPendingOnly || ["queued", "running"].includes(activeChapterRun?.status)
  $("#chapter-blueprints-history").innerHTML = history.length
    ? history.map((run) => {
      const statusLabel = run.status === "completed" && run.valid ? "通过" : run.status === "invalid" ? "未通过" : run.status === "failed" ? "失败/中断" : run.status === "running" ? "运行中" : run.status
      return `<button type="button" class="batch-run-row ${escapeHtml(run.status)} ${run.valid ? "valid" : ""} ${state.runIds[CHAPTER_BLUEPRINTS_NODE] === run.runId ? "active" : ""}" data-chapter-run-id="${escapeHtml(run.runId)}"><span>${escapeHtml(statusLabel)}</span><strong>第 ${Number(run.startChapter)}-${Number(run.endChapter)} 章 · ${escapeHtml(run.runId)}</strong><small>${run.errorCount || 0} 错误</small></button>`
    }).join("")
    : '<div class="empty compact">尚无章节蓝图 Run。</div>'
}

function syncFormState() {
  const worldInput = worldFormInput()
  const characterInput = characterFormInput()
  const initialStateInput = initialStateFormInput()
  const worldMatrixInput = worldMatrixFormInput()
  const plotArchitectureInput = plotArchitectureFormInput()
  const storyBibleInput = storyBibleFormInput()
  const volumeStrategyInput = volumeStrategyFormInput()
  let chapterBlueprintInput = chapterBlueprintFormInput()
  const styleProfileInput = styleProfileFormInput()
  const singleChapterContextInput = singleChapterContextFormInput()
  const chapterDraftInput = chapterDraftFormInput()
  const chapterCommitInput = chapterCommitFormInput()
  const continuousChapterInput = continuousChapterFormInput()
  const chapterReviewInput = chapterReviewFormInput()
  window.localStorage.setItem("world-foundation-debug.draft", JSON.stringify(worldInput))
  window.localStorage.setItem("character-planning-debug.draft", JSON.stringify(characterInput))
  window.localStorage.setItem("initial-character-state-debug.draft", JSON.stringify(initialStateInput))
  window.localStorage.setItem("world-matrix-debug.draft", JSON.stringify(worldMatrixInput))
  window.localStorage.setItem("plot-architecture-debug.draft", JSON.stringify(plotArchitectureInput))
  window.localStorage.setItem("story-bible-debug.draft", JSON.stringify(storyBibleInput))
  window.localStorage.setItem("volume-strategy-debug.draft", JSON.stringify(volumeStrategyInput))
  window.localStorage.setItem("chapter-blueprints-debug.draft", JSON.stringify(chapterBlueprintInput))
  window.localStorage.setItem("style-profile-debug.draft", JSON.stringify(styleProfileInput))
  window.localStorage.setItem("single-chapter-context-debug.draft", JSON.stringify(singleChapterContextInput))
  window.localStorage.setItem("chapter-draft-debug.draft", JSON.stringify(chapterDraftInput))
  window.localStorage.setItem("chapter-commit-debug.draft", JSON.stringify(chapterCommitInput))
  window.localStorage.setItem("continuous-chapter-debug.draft", JSON.stringify(continuousChapterInput))
  window.localStorage.setItem("chapter-review-debug.draft", JSON.stringify(chapterReviewInput))
  $("#idea-count").textContent = `${worldInput.coreIdea.length} / 20`
  $("#temperature-value").textContent = worldInput.temperature.toFixed(2)
  $("#character-temperature-value").textContent = characterInput.temperature.toFixed(2)
  $("#initial-state-temperature-value").textContent = initialStateInput.temperature.toFixed(2)
  $("#world-matrix-temperature-value").textContent = worldMatrixInput.temperature.toFixed(2)
  $("#plot-architecture-temperature-value").textContent = plotArchitectureInput.temperature.toFixed(2)
  $("#story-bible-temperature-value").textContent = storyBibleInput.temperature.toFixed(2)
  $("#volume-strategy-temperature-value").textContent = volumeStrategyInput.temperature.toFixed(2)
  $("#chapter-blueprints-temperature-value").textContent = chapterBlueprintInput.temperature.toFixed(2)
  $("#style-profile-temperature-value").textContent = styleProfileInput.temperature.toFixed(2)
  $("#chapter-draft-temperature-value").textContent = chapterDraftInput.temperature.toFixed(2)
  $("#continuous-chapter-temperature-value").textContent = continuousChapterInput.temperature.toFixed(2)
  let chapterBatchCount = Number.isInteger(chapterBlueprintInput.startChapter) && Number.isInteger(chapterBlueprintInput.endChapter)
    ? chapterBlueprintInput.endChapter - chapterBlueprintInput.startChapter + 1
    : 0
  $("#chapter-blueprints-batch-count").value = chapterBatchCount > 0 ? String(chapterBatchCount) : "—"
  const anyBusy = state.chapterBlueprintAutoRun.active || state.continuousChapterAutoRun.active || [WORLD_NODE, CHARACTER_NODE, INITIAL_STATE_NODE, WORLD_MATRIX_NODE, PLOT_ARCHITECTURE_NODE, STORY_BIBLE_NODE, VOLUME_STRATEGY_NODE, CHAPTER_BLUEPRINTS_NODE, STYLE_PROFILE_NODE, SINGLE_CHAPTER_CONTEXT_NODE, CHAPTER_DRAFT_NODE, CHAPTER_COMMIT_NODE, CONTINUOUS_CHAPTER_NODE].some((nodeId) => ["queued", "running"].includes(state.runs[nodeId]?.status))
  const worldReady = state.runs[WORLD_NODE]?.status === "completed" && state.runs[WORLD_NODE]?.validation?.valid
  const characterReady = state.runs[CHARACTER_NODE]?.status === "completed" && state.runs[CHARACTER_NODE]?.validation?.valid
  const initialStateReady = state.runs[INITIAL_STATE_NODE]?.status === "completed" && state.runs[INITIAL_STATE_NODE]?.validation?.valid
  const worldMatrixReady = state.runs[WORLD_MATRIX_NODE]?.status === "completed" && state.runs[WORLD_MATRIX_NODE]?.validation?.valid
  const plotArchitectureReady = state.runs[PLOT_ARCHITECTURE_NODE]?.status === "completed" && state.runs[PLOT_ARCHITECTURE_NODE]?.validation?.valid
  const storyBibleReady = state.runs[STORY_BIBLE_NODE]?.status === "completed" && state.runs[STORY_BIBLE_NODE]?.validation?.valid
  const volumeStrategyReady = state.runs[VOLUME_STRATEGY_NODE]?.status === "completed" && state.runs[VOLUME_STRATEGY_NODE]?.validation?.valid
  const chapterBlueprintReady = state.runs[CHAPTER_BLUEPRINTS_NODE]?.status === "completed" && state.runs[CHAPTER_BLUEPRINTS_NODE]?.validation?.valid
  const styleProfileReady = state.runs[STYLE_PROFILE_NODE]?.status === "completed" && state.runs[STYLE_PROFILE_NODE]?.validation?.valid
  const styleProfileFrozen = state.runs[STYLE_PROFILE_NODE]?.result?.freeze?.status === "approved"
  const singleChapterContextReady = state.runs[SINGLE_CHAPTER_CONTEXT_NODE]?.status === "completed" && state.runs[SINGLE_CHAPTER_CONTEXT_NODE]?.validation?.valid
  const chapterDraftReady = state.runs[CHAPTER_DRAFT_NODE]?.status === "completed" && state.runs[CHAPTER_DRAFT_NODE]?.validation?.valid
  const committedChaptersForContinuous = Array.isArray(state.committedChapterCoverage?.chapters) ? state.committedChapterCoverage.chapters : []
  const continuousOverlapsCommitted = Number.isInteger(continuousChapterInput.startChapter) && Number.isInteger(continuousChapterInput.endChapter)
    ? committedChaptersForContinuous.some((chapter) => chapter >= continuousChapterInput.startChapter && chapter <= continuousChapterInput.endChapter)
    : false
  const continuousExpectedNext = Number(state.committedChapterCoverage?.nextChapter || 1)
  const selectedVolume = Array.isArray(state.runs[VOLUME_STRATEGY_NODE]?.result?.volumes)
    ? state.runs[VOLUME_STRATEGY_NODE].result.volumes.find((volume) => volume.id === chapterBlueprintInput.volumeId)
    : null
  if (selectedVolume && Number.isInteger(chapterBlueprintInput.startChapter) && Number.isInteger(chapterBlueprintInput.endChapter) && chapterBatchCount > CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT) {
    $("#chapter-blueprints-end-chapter").value = String(Math.min(chapterBlueprintInput.startChapter + CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT - 1, Number(selectedVolume.endChapter)))
    chapterBlueprintInput = chapterBlueprintFormInput()
    chapterBatchCount = chapterBlueprintInput.endChapter - chapterBlueprintInput.startChapter + 1
    window.localStorage.setItem("chapter-blueprints-debug.draft", JSON.stringify(chapterBlueprintInput))
    $("#chapter-blueprints-batch-count").value = String(chapterBatchCount)
  }
  const selectedVolumeCoverage = selectedVolume ? chapterBlueprintCoverageFor(selectedVolume) : null
  const availableArcCount = Array.isArray(state.runs[STORY_BIBLE_NODE]?.input?.plotArchitecture?.arcArchitecture)
    ? state.runs[STORY_BIBLE_NODE].input.plotArchitecture.arcArchitecture.length
    : 0
  $("#run-button").disabled = anyBusy || !worldInput.title || worldInput.coreIdea.length < 20 || !worldInput.factoryProjectId
  $("#character-run-button").disabled = anyBusy || !worldReady
  $("#initial-state-run-button").disabled = anyBusy || !characterReady
  $("#world-matrix-run-button").disabled = anyBusy || !initialStateReady
  $("#plot-architecture-run-button").disabled = anyBusy || !worldMatrixReady
  $("#story-bible-run-button").disabled = anyBusy || !plotArchitectureReady
  $("#volume-strategy-run-button").disabled = anyBusy || !storyBibleReady || !Number.isInteger(volumeStrategyInput.targetVolumeCount) || volumeStrategyInput.targetVolumeCount < Math.min(2, availableArcCount) || volumeStrategyInput.targetVolumeCount > Math.min(12, availableArcCount)
  $("#chapter-blueprints-run-button").disabled = anyBusy
    || !volumeStrategyReady
    || !selectedVolume
    || selectedVolumeCoverage?.firstMissing === undefined
    || !Number.isInteger(chapterBlueprintInput.startChapter)
    || !Number.isInteger(chapterBlueprintInput.endChapter)
    || chapterBlueprintInput.startChapter < Number(selectedVolume?.startChapter || 0)
    || chapterBlueprintInput.endChapter > Number(selectedVolume?.endChapter || 0)
    || chapterBatchCount < 1
    || chapterBatchCount > CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT
    || !Number.isInteger(chapterBlueprintInput.targetWordCount)
    || chapterBlueprintInput.targetWordCount < 1000
    || chapterBlueprintInput.targetWordCount > 10000
  const activeBlueprints = Array.isArray(state.runs[CHAPTER_BLUEPRINTS_NODE]?.result?.blueprints) ? state.runs[CHAPTER_BLUEPRINTS_NODE].result.blueprints : []
  const completedBlueprintCoverageForStyle = completedChapterBlueprintCoverage()
  $("#style-profile-run-button").disabled = anyBusy
    || (!chapterBlueprintReady && completedBlueprintCoverageForStyle.count <= 0)
    || (!activeBlueprints.length && completedBlueprintCoverageForStyle.count <= 0)
    || !Number.isInteger(styleProfileInput.sampleChapter)
  $("#style-profile-aigc-calibration-button").disabled = $("#style-profile-run-button").disabled
  const activeStyleProfileRun = state.runs[STYLE_PROFILE_NODE]
  const styleCanFreeze = Boolean(activeStyleProfileRun?.status === "completed" && activeStyleProfileRun?.validation?.valid === true && activeStyleProfileRun?.result?.selectedCandidate?.sample)
  const styleAlreadyFrozen = activeStyleProfileRun?.result?.freeze?.status === "approved"
  const styleFreezeButton = $("#style-profile-freeze-button")
  styleFreezeButton.disabled = anyBusy || state.styleFreezeBusy || !styleCanFreeze || styleAlreadyFrozen
  styleFreezeButton.querySelector("span:last-child").textContent = state.styleFreezeBusy
    ? "正在冻结…"
    : styleAlreadyFrozen
      ? "已冻结为正式文风合同"
      : "冻结当前候选为正式文风合同"
  $("#single-chapter-context-run-button").disabled = anyBusy
    || !styleProfileReady
    || !styleProfileFrozen
    || !Number.isInteger(singleChapterContextInput.chapterNumber)
    || !Number.isInteger(singleChapterContextInput.targetWordCount)
    || singleChapterContextInput.targetWordCount < 800
    || singleChapterContextInput.targetWordCount > 10000
  $("#chapter-draft-run-button").disabled = anyBusy
    || !singleChapterContextReady
    || !Number.isInteger(chapterDraftInput.targetWordCount)
    || chapterDraftInput.targetWordCount < 800
    || chapterDraftInput.targetWordCount > 12000
    || !Number.isInteger(chapterDraftInput.maxRepairRounds)
    || chapterDraftInput.maxRepairRounds < 0
    || chapterDraftInput.maxRepairRounds > 12
    || !selectedDebugModelId()
  $("#chapter-commit-run-button").disabled = anyBusy
    || !chapterDraftReady
    || !chapterCommitInput.upstreamRunId
    || !Number.isInteger(chapterCommitInput.chapterNumber)
  $("#continuous-chapter-run-button").disabled = anyBusy
    || !styleProfileReady
    || !styleProfileFrozen
    || !continuousChapterInput.upstreamRunId
    || !selectedDebugModelId()
    || !Number.isInteger(continuousChapterInput.startChapter)
    || !Number.isInteger(continuousChapterInput.endChapter)
    || continuousChapterInput.startChapter < 1
    || continuousChapterInput.endChapter < continuousChapterInput.startChapter
    || continuousChapterInput.endChapter - continuousChapterInput.startChapter + 1 > 100
    || continuousOverlapsCommitted
    || (committedChaptersForContinuous.length > 0 && continuousChapterInput.startChapter !== continuousExpectedNext)
    || !Number.isInteger(continuousChapterInput.targetWordCount)
    || continuousChapterInput.targetWordCount < 800
    || continuousChapterInput.targetWordCount > 12000
    || !Number.isInteger(continuousChapterInput.maxRepairRounds)
    || continuousChapterInput.maxRepairRounds < 0
    || continuousChapterInput.maxRepairRounds > 12
  const continuousAutoButton = $("#continuous-chapter-auto-button")
  const continuousStopButton = $("#continuous-chapter-stop-button")
  if (continuousAutoButton && continuousStopButton) {
    const continuousCanAuto = styleProfileReady && styleProfileFrozen && selectedDebugModelId() && !state.continuousChapterAutoRun.active
    continuousAutoButton.disabled = anyBusy || !continuousCanAuto
    continuousStopButton.disabled = !state.continuousChapterAutoRun.active
    continuousAutoButton.querySelector("span:last-child").textContent = state.continuousChapterAutoRun.active ? "自动续跑中…" : "自动续跑到第一卷结束"
  }

  const characterNodeButton = $('[data-node="character-planning"]')
  const characterNodeState = $("#character-node-state")
  const characterRun = state.runs[CHARACTER_NODE]
  characterNodeButton.classList.toggle("ready", Boolean(worldReady && !characterRun))
  characterNodeButton.classList.toggle("running", Boolean(characterRun && ["queued", "running"].includes(characterRun.status)))
  if (characterRun?.status === "completed") characterNodeState.textContent = "已通过"
  else if (characterRun?.status === "invalid") characterNodeState.textContent = "验证失败"
  else if (characterRun?.status === "failed") characterNodeState.textContent = "执行失败"
  else if (characterRun && ["queued", "running"].includes(characterRun.status)) characterNodeState.textContent = "运行中"
  else if (worldReady) characterNodeState.textContent = "可以运行"
  else characterNodeState.textContent = "等待上游"

  const initialNodeButton = $('[data-node="initial-character-state"]')
  const initialNodeState = $("#initial-state-node-state")
  const initialRun = state.runs[INITIAL_STATE_NODE]
  initialNodeButton.classList.toggle("ready", Boolean(characterReady && !initialRun))
  initialNodeButton.classList.toggle("running", Boolean(initialRun && ["queued", "running"].includes(initialRun.status)))
  if (initialRun?.status === "completed") initialNodeState.textContent = "已通过"
  else if (initialRun?.status === "invalid") initialNodeState.textContent = "验证失败"
  else if (initialRun?.status === "failed") initialNodeState.textContent = "执行失败"
  else if (initialRun && ["queued", "running"].includes(initialRun.status)) initialNodeState.textContent = "运行中"
  else if (characterReady) initialNodeState.textContent = "可以运行"
  else initialNodeState.textContent = "等待上游"

  const matrixNodeButton = $('[data-node="world-matrix"]')
  const matrixNodeState = $("#world-matrix-node-state")
  const matrixRun = state.runs[WORLD_MATRIX_NODE]
  matrixNodeButton.classList.toggle("ready", Boolean(initialStateReady && !matrixRun))
  matrixNodeButton.classList.toggle("running", Boolean(matrixRun && ["queued", "running"].includes(matrixRun.status)))
  if (matrixRun?.status === "completed") matrixNodeState.textContent = "已通过"
  else if (matrixRun?.status === "invalid") matrixNodeState.textContent = "验证失败"
  else if (matrixRun?.status === "failed") matrixNodeState.textContent = "执行失败"
  else if (matrixRun && ["queued", "running"].includes(matrixRun.status)) matrixNodeState.textContent = "运行中"
  else if (initialStateReady) matrixNodeState.textContent = "可以运行"
  else matrixNodeState.textContent = "等待上游"

  const plotNodeButton = $('[data-node="plot-architecture"]')
  const plotNodeState = $("#plot-architecture-node-state")
  const plotRun = state.runs[PLOT_ARCHITECTURE_NODE]
  plotNodeButton.classList.toggle("ready", Boolean(worldMatrixReady && !plotRun))
  plotNodeButton.classList.toggle("running", Boolean(plotRun && ["queued", "running"].includes(plotRun.status)))
  if (plotRun?.status === "completed") plotNodeState.textContent = "已通过"
  else if (plotRun?.status === "invalid") plotNodeState.textContent = "验证失败"
  else if (plotRun?.status === "failed") plotNodeState.textContent = "执行失败"
  else if (plotRun && ["queued", "running"].includes(plotRun.status)) plotNodeState.textContent = "运行中"
  else if (worldMatrixReady) plotNodeState.textContent = "可以运行"
  else plotNodeState.textContent = "等待上游"

  const bibleNodeButton = $('[data-node="story-bible"]')
  const bibleNodeState = $("#story-bible-node-state")
  const bibleRun = state.runs[STORY_BIBLE_NODE]
  bibleNodeButton.classList.toggle("ready", Boolean(plotArchitectureReady && !bibleRun))
  bibleNodeButton.classList.toggle("running", Boolean(bibleRun && ["queued", "running"].includes(bibleRun.status)))
  if (bibleRun?.status === "completed") bibleNodeState.textContent = "已通过"
  else if (bibleRun?.status === "invalid") bibleNodeState.textContent = "验证失败"
  else if (bibleRun?.status === "failed") bibleNodeState.textContent = "执行失败"
  else if (bibleRun && ["queued", "running"].includes(bibleRun.status)) bibleNodeState.textContent = "运行中"
  else if (plotArchitectureReady) bibleNodeState.textContent = "可以运行"
  else bibleNodeState.textContent = "等待上游"

  const volumeNodeButton = $('[data-node="volume-strategy"]')
  const volumeNodeState = $("#volume-strategy-node-state")
  const volumeRun = state.runs[VOLUME_STRATEGY_NODE]
  volumeNodeButton.classList.toggle("ready", Boolean(storyBibleReady && !volumeRun))
  volumeNodeButton.classList.toggle("running", Boolean(volumeRun && ["queued", "running"].includes(volumeRun.status)))
  if (volumeRun?.status === "completed") volumeNodeState.textContent = "已通过"
  else if (volumeRun?.status === "invalid") volumeNodeState.textContent = "验证失败"
  else if (volumeRun?.status === "failed") volumeNodeState.textContent = "执行失败"
  else if (volumeRun && ["queued", "running"].includes(volumeRun.status)) volumeNodeState.textContent = "运行中"
  else if (storyBibleReady) volumeNodeState.textContent = "可以运行"
  else volumeNodeState.textContent = "等待上游"

  const chapterNodeButton = $('[data-node="chapter-blueprints"]')
  const chapterNodeState = $("#chapter-blueprints-node-state")
  const chapterRun = state.runs[CHAPTER_BLUEPRINTS_NODE]
  const chapterAuditPending = isChapterAuditPending(chapterRun)
  chapterNodeButton.classList.toggle("ready", Boolean(volumeStrategyReady && !chapterRun))
  chapterNodeButton.classList.toggle("running", Boolean(chapterRun && ["queued", "running"].includes(chapterRun.status)))
  if (chapterRun?.status === "completed") chapterNodeState.textContent = "已通过"
  else if (chapterAuditPending) chapterNodeState.textContent = "待审计"
  else if (chapterRun?.status === "invalid") chapterNodeState.textContent = "验证失败"
  else if (chapterRun?.status === "failed") chapterNodeState.textContent = "执行失败"
  else if (chapterRun && ["queued", "running"].includes(chapterRun.status)) chapterNodeState.textContent = "运行中"
  else if (volumeStrategyReady) chapterNodeState.textContent = "可以运行"
  else chapterNodeState.textContent = "等待上游"

  const styleNodeButton = $('[data-node="style-profile"]')
  const styleNodeState = $("#style-profile-node-state")
  const styleRun = state.runs[STYLE_PROFILE_NODE]
  styleNodeButton.classList.toggle("ready", Boolean(chapterBlueprintReady && !styleRun))
  styleNodeButton.classList.toggle("running", Boolean(styleRun && ["queued", "running"].includes(styleRun.status)))
  if (styleRun?.status === "completed") styleNodeState.textContent = "已通过"
  else if (styleRun?.status === "invalid") styleNodeState.textContent = "验证失败"
  else if (styleRun?.status === "failed") styleNodeState.textContent = "执行失败"
  else if (styleRun && ["queued", "running"].includes(styleRun.status)) styleNodeState.textContent = "运行中"
  else if (chapterBlueprintReady) styleNodeState.textContent = "可以运行"
  else styleNodeState.textContent = "等待上游"

  const contextNodeButton = $('[data-node="single-chapter-context"]')
  const contextNodeState = $("#single-chapter-context-node-state")
  const contextRun = state.runs[SINGLE_CHAPTER_CONTEXT_NODE]
  contextNodeButton.classList.toggle("ready", Boolean(styleProfileReady && styleProfileFrozen && !contextRun))
  contextNodeButton.classList.toggle("running", Boolean(contextRun && ["queued", "running"].includes(contextRun.status)))
  if (contextRun?.status === "completed") contextNodeState.textContent = "已通过"
  else if (contextRun?.status === "invalid") contextNodeState.textContent = "验证失败"
  else if (contextRun?.status === "failed") contextNodeState.textContent = "执行失败"
  else if (contextRun && ["queued", "running"].includes(contextRun.status)) contextNodeState.textContent = "运行中"
  else if (styleProfileReady && styleProfileFrozen) contextNodeState.textContent = "可以运行"
  else if (styleProfileReady) contextNodeState.textContent = "等待冻结"
  else contextNodeState.textContent = "等待上游"

  const draftNodeButton = $('[data-node="chapter-draft"]')
  const draftNodeState = $("#chapter-draft-node-state")
  const draftRun = state.runs[CHAPTER_DRAFT_NODE]
  draftNodeButton.classList.toggle("ready", Boolean(singleChapterContextReady && !draftRun))
  draftNodeButton.classList.toggle("running", Boolean(draftRun && ["queued", "running"].includes(draftRun.status)))
  if (draftRun?.status === "completed") draftNodeState.textContent = "已通过"
  else if (draftRun?.status === "invalid") draftNodeState.textContent = "验证失败"
  else if (draftRun?.status === "failed") draftNodeState.textContent = "执行失败"
  else if (draftRun && ["queued", "running"].includes(draftRun.status)) draftNodeState.textContent = "运行中"
  else if (singleChapterContextReady) draftNodeState.textContent = "可以运行"
  else draftNodeState.textContent = "等待上游"

  const commitNodeButton = $('[data-node="chapter-commit"]')
  const commitNodeState = $("#chapter-commit-node-state")
  const commitRun = state.runs[CHAPTER_COMMIT_NODE]
  if (commitNodeButton && commitNodeState) {
    commitNodeButton.classList.toggle("ready", Boolean(chapterDraftReady && !commitRun))
    commitNodeButton.classList.toggle("running", Boolean(commitRun && ["queued", "running"].includes(commitRun.status)))
    if (commitRun?.status === "completed") commitNodeState.textContent = "已冻结"
    else if (commitRun?.status === "invalid") commitNodeState.textContent = "验证失败"
    else if (commitRun?.status === "failed") commitNodeState.textContent = "执行失败"
    else if (commitRun && ["queued", "running"].includes(commitRun.status)) commitNodeState.textContent = "运行中"
    else if (chapterDraftReady) commitNodeState.textContent = "可以冻结"
    else commitNodeState.textContent = "等待正文"
  }

  const continuousNodeButton = $('[data-node="continuous-chapter-production"]')
  const continuousNodeState = $("#continuous-chapter-node-state")
  const continuousRun = state.runs[CONTINUOUS_CHAPTER_NODE]
  if (continuousNodeButton && continuousNodeState) {
    continuousNodeButton.classList.toggle("ready", Boolean(styleProfileReady && styleProfileFrozen && !continuousRun))
    continuousNodeButton.classList.toggle("running", Boolean(continuousRun && ["queued", "running"].includes(continuousRun.status)))
    if (continuousRun?.status === "completed") continuousNodeState.textContent = "已完成"
    else if (continuousRun?.status === "invalid") continuousNodeState.textContent = "中断/失败"
    else if (continuousRun?.status === "failed") continuousNodeState.textContent = "执行失败"
    else if (continuousRun?.status === "paused") continuousNodeState.textContent = "已暂停"
    else if (continuousRun && ["queued", "running"].includes(continuousRun.status)) continuousNodeState.textContent = "运行中"
    else if (styleProfileReady && styleProfileFrozen) continuousNodeState.textContent = "可以运行"
    else continuousNodeState.textContent = "等待文风"
  }
  const chapterReviewButton = $("#chapter-review-run-button")
  if (chapterReviewButton) {
    chapterReviewButton.disabled = anyBusy || state.chapterReview.loading || !chapterReviewInput.factoryProjectId || !Number.isInteger(chapterReviewInput.firstChapter) || !Number.isInteger(chapterReviewInput.lastChapter) || chapterReviewInput.lastChapter < chapterReviewInput.firstChapter
    chapterReviewButton.querySelector("span:last-child").textContent = state.chapterReview.loading ? "正在读取复盘…" : "读取并生成复盘"
  }
}

function isChapterAuditPending(run) {
  const errors = run?.validation?.errors
  return run?.nodeId === CHAPTER_BLUEPRINTS_NODE
    && run.status === "invalid"
    && !run.semanticAudit
    && Array.isArray(errors)
    && errors.length === 1
    && errors[0].includes("尚未执行正典审计")
}

async function api(path, options = {}) {
  const response = await fetch(`${DEBUG_API}${path}`, {
    method: options.method || "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(readableApiError(payload, response.status))
  return payload
}

async function refreshCommittedChapterCoverage() {
  const projectId = selectedFactoryProjectId()
  if (!projectId) {
    state.committedChapterCoverage = null
    state.committedChapterCoverageProjectId = ""
    return
  }
  try {
    state.committedChapterCoverage = await api(`/committed-chapters?factoryProjectId=${encodeURIComponent(projectId)}&firstChapter=1`)
    state.committedChapterCoverageProjectId = projectId
  } catch {
    state.committedChapterCoverage = null
    state.committedChapterCoverageProjectId = projectId
  }
}

async function loadCommittedChapterText(chapterNumber) {
  const projectId = selectedFactoryProjectId()
  if (!projectId || !Number.isInteger(Number(chapterNumber))) return
  state.chapterReader = { selectedChapter: Number(chapterNumber), loading: true, error: "", chapter: state.chapterReader.chapter }
  renderEvidence()
  try {
    const chapter = await api(`/committed-chapters/${Number(chapterNumber)}?factoryProjectId=${encodeURIComponent(projectId)}`)
    state.chapterReader = { selectedChapter: Number(chapterNumber), loading: false, error: "", chapter }
  } catch (error) {
    state.chapterReader = { selectedChapter: Number(chapterNumber), loading: false, error: error.message, chapter: null }
  }
  renderEvidence()
}

function readableApiError(payload, status) {
  if (payload?.error === "factory_project_required_for_debug_trace") {
    return payload.message || "运行调试节点前必须先绑定一个小说工厂项目；请在顶部项目下拉框选择项目后再运行。"
  }
  return payload?.error || `HTTP ${status}`
}

function renderModelSwitcher() {
  const select = $("#debug-model-select")
  const models = state.modelConfigs
  const signature = models.map((model) => `${model.id}:${model.name}:${model.modelName}:${model.isGlobalTextRoute}`).join("|")
  if (select.dataset.signature !== signature) {
    select.dataset.signature = signature
    select.innerHTML = models.length
      ? models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name)} · ${escapeHtml(model.modelName)}${model.isGlobalTextRoute ? "（全局）" : ""}</option>`).join("")
      : '<option value="">没有可用的文本模型</option>'
  }
  select.disabled = models.length === 0
  if (models.some((model) => model.id === state.selectedModelConfigId)) {
    select.value = state.selectedModelConfigId
  }
  const selected = models.find((model) => model.id === select.value) || null
  if (selected && selected.id !== state.selectedModelConfigId) {
    state.selectedModelConfigId = selected.id
  }
  $("#debug-model-name").textContent = selected ? `${selected.name} · ${selected.modelName}` : "—"
  $("#debug-model-mode").textContent = selected ? selected.apiMode : "—"
  const status = $("#debug-model-status")
  const busyRun = Object.values(state.runs).find((run) => run && ["queued", "running"].includes(run.status))
  status.className = state.modelConfigError ? "warning" : selected ? "ready" : ""
  status.textContent = state.modelConfigError
    ? `模型列表读取失败：${state.modelConfigError}`
    : !selected
      ? "请先在模型设置中配置至少一个文本模型。"
      : busyRun
        ? `当前 ${activeNodeName()} 请求已冻结原模型；${selected.modelName} 仅用于下一次新 Run。`
        : `下一次 ${activeNodeName()} Run 将使用 ${selected.modelName}；不会修改正式项目的全局路由。`
}

function renderProjectBinding() {
  const select = $("#debug-project-select")
  const projects = state.projects
  const signature = projects.map((project) => `${project.id}:${project.title}`).join("|")
  if (select.dataset.signature !== signature) {
    select.dataset.signature = signature
    select.innerHTML = projects.length
      ? projects.map((project) => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.title)} · ${escapeHtml(project.id)}</option>`).join("")
      : '<option value="">没有可绑定的小说工厂项目</option>'
  }
  select.disabled = projects.length === 0
  if (projects.some((project) => project.id === state.selectedProjectId)) select.value = state.selectedProjectId
  const selected = projects.find((project) => project.id === select.value) || null
  if (selected && selected.id !== state.selectedProjectId) state.selectedProjectId = selected.id
  if (selected) window.localStorage.setItem("flow-debug.project-id", selected.id)
  const status = $("#debug-project-status")
  status.className = state.projectError ? "warning" : selected ? "ready" : ""
  status.textContent = state.projectError
    ? `项目列表读取失败：${state.projectError}`
    : selected
      ? `调试证据将归属“${selected.title}”，只写 Run / Step / Attempt，不改正式小说状态。`
      : "请先在小说工厂中创建项目，再运行单点调试。"
}

function protagonistProfileFromDebugRun() {
  const characters = state.runs[CHARACTER_NODE]?.result?.characters
  if (!Array.isArray(characters)) return null
  const protagonist = characters.find((character) => /主角|protagonist/iu.test(String(character?.role || character?.narrativeFunction || "")))
  if (!protagonist) return null
  const relationship = Array.isArray(protagonist.relationships)
    ? protagonist.relationships.find((entry) => String(entry?.target || entry?.targetName || "").trim() && String(entry?.pressure || entry?.dynamic || "").trim())
    : null
  const profile = {
    name: String(protagonist.name || "").trim(),
    identity: String(protagonist.identity || protagonist.identityAndRole || "").trim(),
    coreDesire: String(protagonist.desire || protagonist.coreDesire || "").trim(),
    fearOrWound: [protagonist.fear, protagonist.wound, protagonist.fearOrWound].filter(Boolean).map(String).join("；").trim(),
    behaviorHabit: Array.isArray(protagonist.behaviorHabits) ? protagonist.behaviorHabits.map(String).join("；") : String(protagonist.behaviorHabit || "").trim(),
    speechMarker: String(protagonist.speechPattern || protagonist.speechMarker || "").trim(),
    relationshipName: String(relationship?.target || relationship?.targetName || "").trim(),
    relationshipPressure: String(relationship?.pressure || relationship?.dynamic || "").trim(),
  }
  return Object.values(profile).every(Boolean) ? profile : null
}

function renderProductionSandbox() {
  const inspection = state.productionSandbox
  const manifest = inspection?.manifest
  const sameProject = Boolean(manifest && manifest.projectId === state.selectedProjectId)
  const busy = state.productionSandboxBusy || manifest?.status === "running"
  const runs = sameProject && Array.isArray(manifest.runs) ? [...manifest.runs].reverse() : []
  const latestRun = runs[0] || null
  const elapsedSeconds = latestRun?.startedAt
    ? Math.max(0, Math.round((new Date(latestRun.completedAt || Date.now()).getTime() - new Date(latestRun.startedAt).getTime()) / 1000))
    : 0
  const evidence = inspection?.workflowEvidence
  const evidenceRunStatus = evidence?.run?.status || null
  const evidenceStep = Array.isArray(evidence?.steps) ? evidence.steps.at(-1) : null
  const humanGate = sameProject ? inspection?.humanGate : null
  const debugProtagonist = protagonistProfileFromDebugRun()
  $("#production-sandbox-id").textContent = sameProject ? manifest.sandboxId : "尚未创建"
  $("#production-sandbox-stage").textContent = sameProject ? inspection.state?.runtime?.stage || "—" : "—"
  $("#production-sandbox-node").textContent = sameProject ? `${inspection.currentNode?.name || "—"} · ${inspection.currentNode?.id || "—"}` : "—"
  $("#production-sandbox-run-count").textContent = sameProject ? String(manifest.runs?.length || 0) : "0"
  const status = $("#production-sandbox-status")
  status.className = `production-sandbox-status ${state.productionSandboxError ? "error" : busy ? "running" : sameProject ? "ready" : ""}`
  status.textContent = state.productionSandboxError
    ? `沙盒操作失败：${state.productionSandboxError}`
    : busy
      ? `正在执行 ${latestRun?.nodeName || inspection?.currentNode?.name || "真实生产节点"} · ${elapsedSeconds} 秒 · 后端 ${evidenceStep?.status || evidenceRunStatus || "正在接收请求"}。页面每秒同步一次，正式项目保持不动。`
      : humanGate?.id === "setting-review" && humanGate.status === "required"
        ? `当前是人工门禁：请先审阅 ${humanGate.reviewPath}，点击“批准设定评审”后才能运行 ${inspection.currentNode.name}。`
      : humanGate?.status === "rejected"
          ? "当前设定评审已被拒绝；需要重新复制或修订沙盒设定后再继续。"
        : humanGate?.id === "protagonist-profile" && humanGate.status === "required"
          ? debugProtagonist
            ? `主线规划缺少正式主角档案；可把已通过人物节点中的“${debugProtagonist.name}”导入当前沙盒后继续。`
            : "主线规划缺少正式主角档案；请先完成人物规划节点，或在正式小说工厂确认主角资料。"
      : sameProject
        ? `当前只能运行 ${inspection.currentNode.name}；完成后沙盒将停在下一生产阶段。`
        : "先创建沙盒；正式项目不会被推进。"
  $("#production-sandbox-create").disabled = busy || !state.selectedProjectId
  $("#production-sandbox-create").textContent = sameProject ? "重新复制正式状态" : "创建当前状态沙盒"
  $("#production-sandbox-approve").hidden = humanGate?.status !== "required"
    || humanGate?.id !== "setting-review"
  $("#production-sandbox-approve").disabled = busy || humanGate?.status !== "required" || humanGate?.id !== "setting-review"
  $("#production-sandbox-import-protagonist").hidden = humanGate?.id !== "protagonist-profile" || humanGate?.status !== "required"
  $("#production-sandbox-import-protagonist").disabled = busy || !debugProtagonist
  $("#production-sandbox-import-protagonist").textContent = debugProtagonist ? `导入人物节点：${debugProtagonist.name}` : "导入人物节点主角"
  $("#production-sandbox-run").disabled = !sameProject || busy || inspection.canExecuteCurrentNode === false
  $("#production-sandbox-run").textContent = sameProject ? `运行：${inspection.currentNode.name}` : "运行当前生产节点"
  $("#production-sandbox-history").innerHTML = runs.length
    ? runs.map((run) => {
      const duration = run.startedAt
        ? Math.max(0, Math.round((new Date(run.completedAt || Date.now()).getTime() - new Date(run.startedAt).getTime()) / 1000))
        : 0
      return `<article class="${escapeHtml(run.status)}"><strong>${escapeHtml(run.nodeName)}</strong><br>${escapeHtml(run.beforeStage)} → ${escapeHtml(run.afterStage || "执行中")} · ${escapeHtml(run.status)} · ${duration}s<br>${escapeHtml(run.startedAt || "")}${run.trace?.runId ? `<br>Run ${escapeHtml(run.trace.runId)}` : ""}${run.error ? `<br>${escapeHtml(run.error)}` : ""}</article>`
    }).join("")
    : "<span>尚无生产节点执行记录。</span>"
  const liveEntries = []
  if (latestRun) {
    liveEntries.push(`<li><time>${escapeHtml(latestRun.startedAt || "")}</time><span>请求已接收：${escapeHtml(latestRun.nodeName)}（${escapeHtml(latestRun.runId)}）</span></li>`)
  }
  if (evidence?.run) {
    liveEntries.push(`<li><time>RUN</time><span>${escapeHtml(evidence.run.id || "—")} · ${escapeHtml(evidence.run.status || "—")} · ${escapeHtml(evidence.run.stage || "—")}</span></li>`)
  }
  for (const step of Array.isArray(evidence?.steps) ? evidence.steps : []) {
    liveEntries.push(`<li><time>STEP</time><span>${escapeHtml(step.node_id || step.name || "—")} · ${escapeHtml(step.status || "—")} · 校验 ${escapeHtml(step.validation_status || "pending")}</span></li>`)
  }
  for (const attempt of Array.isArray(evidence?.attempts) ? evidence.attempts : []) {
    liveEntries.push(`<li><time>TRY ${escapeHtml(attempt.attempt || "")}</time><span>${escapeHtml(attempt.kind || "—")} · ${escapeHtml(attempt.status || "—")}${attempt.model_name ? ` · ${escapeHtml(attempt.model_name)}` : ""}</span></li>`)
  }
  if (latestRun?.status === "completed") liveEntries.push(`<li><time>DONE</time><span>节点完成：${escapeHtml(latestRun.beforeStage)} → ${escapeHtml(latestRun.afterStage || "—")}，耗时 ${elapsedSeconds}s</span></li>`)
  if (latestRun?.status === "failed") liveEntries.push(`<li><time>FAIL</time><span>${escapeHtml(latestRun.error || "节点执行失败")}</span></li>`)
  $("#production-sandbox-live-log").innerHTML = liveEntries.length
    ? liveEntries.join("")
    : "<li><time>IDLE</time><span>尚未执行生产节点。</span></li>"
}

async function approveProductionSandboxSettingReview() {
  const inspection = state.productionSandbox
  if (!inspection?.manifest?.sandboxId || inspection.humanGate?.status !== "required" || state.productionSandboxBusy) return
  state.productionSandboxBusy = true
  state.productionSandboxError = ""
  renderProductionSandbox()
  try {
    state.productionSandbox = await api(`/production-sandboxes/${encodeURIComponent(inspection.manifest.sandboxId)}/actions/approve-setting-review`, { method: "POST" })
  } catch (error) {
    state.productionSandboxError = error.message
  } finally {
    state.productionSandboxBusy = false
    renderProductionSandbox()
  }
}

async function importProductionSandboxProtagonist() {
  const inspection = state.productionSandbox
  const profile = protagonistProfileFromDebugRun()
  if (!inspection?.manifest?.sandboxId || inspection.humanGate?.id !== "protagonist-profile" || !profile || state.productionSandboxBusy) return
  state.productionSandboxBusy = true
  state.productionSandboxError = ""
  renderProductionSandbox()
  try {
    state.productionSandbox = await api(`/production-sandboxes/${encodeURIComponent(inspection.manifest.sandboxId)}/actions/confirm-protagonist`, {
      method: "POST",
      body: profile,
    })
  } catch (error) {
    state.productionSandboxError = error.message
  } finally {
    state.productionSandboxBusy = false
    renderProductionSandbox()
  }
}

function waitForProductionSandboxPoll(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

async function followProductionSandboxRun(sandboxId, token, ownedByRequest) {
  while (token === state.productionSandboxPollToken) {
    await waitForProductionSandboxPoll(1000)
    if (token !== state.productionSandboxPollToken) return
    try {
      const latest = await api(`/production-sandboxes/${encodeURIComponent(sandboxId)}`)
      if (token !== state.productionSandboxPollToken) return
      state.productionSandbox = latest
      const running = latest.manifest?.status === "running"
      if (!running && !ownedByRequest) state.productionSandboxBusy = false
      renderProductionSandbox()
      if (!running) return
    } catch (error) {
      if (!ownedByRequest) state.productionSandboxError = `状态同步失败：${error.message}`
      renderProductionSandbox()
    }
  }
}

async function createProductionSandbox() {
  if (!state.selectedProjectId || state.productionSandboxBusy) return
  state.productionSandboxPollToken += 1
  state.productionSandboxBusy = true
  state.productionSandboxError = ""
  $("#production-sandbox-console").open = true
  renderProductionSandbox()
  try {
    state.productionSandbox = await api("/production-sandboxes", {
      method: "POST",
      body: { projectId: state.selectedProjectId },
    })
    window.localStorage.setItem(`flow-debug.production-sandbox.${state.selectedProjectId}`, state.productionSandbox.manifest.sandboxId)
  } catch (error) {
    state.productionSandboxError = error.message
  } finally {
    state.productionSandboxBusy = false
    renderProductionSandbox()
  }
}

async function runProductionSandboxNode() {
  const inspection = state.productionSandbox
  if (!inspection?.manifest?.sandboxId || !inspection.currentNode?.id || state.productionSandboxBusy) return
  state.productionSandboxBusy = true
  state.productionSandboxError = ""
  state.productionSandboxPollToken += 1
  const pollToken = state.productionSandboxPollToken
  void followProductionSandboxRun(inspection.manifest.sandboxId, pollToken, true)
  renderProductionSandbox()
  try {
    state.productionSandbox = await api(`/production-sandboxes/${encodeURIComponent(inspection.manifest.sandboxId)}/nodes/${encodeURIComponent(inspection.currentNode.id)}/run`, { method: "POST" })
  } catch (error) {
    state.productionSandboxError = error.message
    try {
      state.productionSandbox = await api(`/production-sandboxes/${encodeURIComponent(inspection.manifest.sandboxId)}`)
    } catch {}
  } finally {
    state.productionSandboxPollToken += 1
    state.productionSandboxBusy = false
    renderProductionSandbox()
  }
}

async function hydrateProductionSandbox() {
  if (!state.selectedProjectId) {
    state.productionSandboxPollToken += 1
    state.productionSandboxBusy = false
    return renderProductionSandbox()
  }
  const sandboxId = window.localStorage.getItem(`flow-debug.production-sandbox.${state.selectedProjectId}`)
  if (!sandboxId) {
    state.productionSandboxPollToken += 1
    state.productionSandboxBusy = false
    return renderProductionSandbox()
  }
  try {
    state.productionSandbox = await api(`/production-sandboxes/${encodeURIComponent(sandboxId)}`)
    state.productionSandboxError = ""
    if (state.productionSandbox.manifest?.status === "running") {
      state.productionSandboxBusy = true
      state.productionSandboxPollToken += 1
      void followProductionSandboxRun(sandboxId, state.productionSandboxPollToken, false)
    } else {
      state.productionSandboxBusy = false
    }
  } catch {
    window.localStorage.removeItem(`flow-debug.production-sandbox.${state.selectedProjectId}`)
    state.productionSandbox = null
  }
  renderProductionSandbox()
}

async function refreshProjects() {
  try {
    const payload = await api("/projects")
    state.projects = Array.isArray(payload.projects) ? payload.projects : []
    const remembered = state.projects.find((project) => project.id === state.selectedProjectId)
    state.selectedProjectId = remembered?.id || state.projects[0]?.id || ""
    state.projectError = ""
    if (state.selectedProjectId) window.localStorage.setItem("flow-debug.project-id", state.selectedProjectId)
  } catch (error) {
    state.projects = []
    state.projectError = error.message
  }
  renderProjectBinding()
  await hydrateProductionSandbox()
  syncFormState()
}

async function refreshModelConfigs() {
  try {
    const payload = await api("/llm-configs")
    state.modelConfigs = Array.isArray(payload.models) ? payload.models : []
    const remembered = state.modelConfigs.find((model) => model.id === state.selectedModelConfigId)
    const fallback = state.modelConfigs.find((model) => model.isGlobalTextRoute) || state.modelConfigs[0]
    state.selectedModelConfigId = remembered?.id || fallback?.id || ""
    state.modelConfigError = ""
    if (state.selectedModelConfigId) {
      window.localStorage.setItem("flow-debug.model-config-id", state.selectedModelConfigId)
    }
  } catch (error) {
    state.modelConfigs = []
    state.modelConfigError = error.message
  }
  renderModelSwitcher()
}

function bindModelSwitcher() {
  $("#debug-model-select").addEventListener("change", (event) => {
    state.selectedModelConfigId = event.target.value
    window.localStorage.setItem("flow-debug.model-config-id", state.selectedModelConfigId)
    renderModelSwitcher()
  })
  $("#debug-project-select").addEventListener("change", (event) => {
    state.selectedProjectId = event.target.value
    window.localStorage.setItem("flow-debug.project-id", state.selectedProjectId)
    state.productionSandboxPollToken += 1
    state.productionSandboxBusy = false
    state.productionSandbox = null
    state.productionSandboxError = ""
    renderProjectBinding()
    void hydrateProductionSandbox()
    syncFormState()
  })
}

async function refreshChapterBlueprintHistory() {
  const upstreamRunId = state.runIds[VOLUME_STRATEGY_NODE]
  if (!upstreamRunId) {
    state.chapterBlueprintHistory = []
    return
  }
  try {
    const payload = await api(`/chapter-blueprint-runs?upstreamRunId=${encodeURIComponent(upstreamRunId)}`)
    state.chapterBlueprintHistory = Array.isArray(payload.runs) ? payload.runs : []
  } catch {
    state.chapterBlueprintHistory = []
  }
}

function setService(mode, label) {
  $("#service-badge").className = `service-badge ${mode}`
  $("#service-label").textContent = label
}

async function checkHealth() {
  try {
    const health = await api("/health")
    const nodeCount = Array.isArray(health.nodes) ? health.nodes.length : 1
    setService("online", health.mode === "real-llm-only" ? `${nodeCount} 个真实节点在线` : "执行器在线")
  } catch {
    setService("offline", "执行器未启动")
  }
}

function activeNodeName() {
  return state.activeNode === WORLD_NODE ? "世界观"
    : state.activeNode === CHARACTER_NODE ? "人物规划"
      : state.activeNode === INITIAL_STATE_NODE ? "人物初始状态"
        : state.activeNode === WORLD_MATRIX_NODE ? "世界矩阵"
          : state.activeNode === PLOT_ARCHITECTURE_NODE ? "主线架构"
            : state.activeNode === STORY_BIBLE_NODE ? "故事圣经"
              : state.activeNode === VOLUME_STRATEGY_NODE ? "分卷策略"
                : state.activeNode === CHAPTER_BLUEPRINTS_NODE ? "章节蓝图"
                  : state.activeNode === STYLE_PROFILE_NODE ? "文风自进化"
                    : state.activeNode === SINGLE_CHAPTER_CONTEXT_NODE ? "单章上下文"
                      : state.activeNode === CHAPTER_DRAFT_NODE ? "单章完整生产"
                        : state.activeNode === CHAPTER_COMMIT_NODE ? "章节正文冻结"
                          : state.activeNode === CONTINUOUS_CHAPTER_NODE ? "连续章节生产"
                            : "阅读复盘"
}

function statusCopy(run) {
  const nodeName = activeNodeName()
  if (!run) {
    if (state.activeNode === CHAPTER_REVIEW_NODE) {
      if (state.chapterReview.loading) return { title: "正在读取章节复盘", detail: "只读扫描已冻结章节、蓝图和门禁日志，不调用模型。" }
      if (state.chapterReview.error) return { title: "阅读复盘读取失败", detail: state.chapterReview.error }
      if (state.chapterReview.report) return { title: "阅读复盘已生成", detail: `已检查第 ${state.chapterReview.report.range?.firstChapter || "—"}-${state.chapterReview.report.range?.lastChapter || "—"} 章；可在“样段/正文”或“结构化结果”查看。` }
      return { title: "等待阅读复盘", detail: "点击左侧按钮，读取已冻结章节并判断主线/世界观/文风问题。" }
    }
    if (state.activeNode === WORLD_NODE) return { title: "尚未运行", detail: "填写左侧输入，然后手动启动一次真实模型调用。" }
    if (state.activeNode === CHARACTER_NODE) return { title: "等待人物规划", detail: state.runs[WORLD_NODE]?.status === "completed" ? "上游世界观已就绪，可以手动运行节点 02。" : "必须先完成并通过节点 01。" }
    if (state.activeNode === INITIAL_STATE_NODE) return { title: "等待人物初始状态", detail: state.runs[CHARACTER_NODE]?.status === "completed" ? "上游人物规划已就绪，可以手动运行节点 03。" : "必须先完成并通过节点 02。" }
    if (state.activeNode === WORLD_MATRIX_NODE) return { title: "等待世界矩阵", detail: state.runs[INITIAL_STATE_NODE]?.status === "completed" ? "上游人物初始状态已就绪，可以手动运行节点 04。" : "必须先完成并通过节点 03。" }
    if (state.activeNode === PLOT_ARCHITECTURE_NODE) return { title: "等待主线架构", detail: state.runs[WORLD_MATRIX_NODE]?.status === "completed" ? "上游世界矩阵已就绪，可以手动运行节点 05。" : "必须先完成并通过节点 04。" }
    if (state.activeNode === STORY_BIBLE_NODE) return { title: "等待故事圣经", detail: state.runs[PLOT_ARCHITECTURE_NODE]?.status === "completed" ? "上游主线架构已就绪，可以手动运行节点 06。" : "必须先完成并通过节点 05。" }
    if (state.activeNode === VOLUME_STRATEGY_NODE) return { title: "等待分卷策略", detail: state.runs[STORY_BIBLE_NODE]?.status === "completed" ? "上游故事圣经已就绪，可以手动运行节点 07。" : "必须先完成并通过节点 06。" }
    if (state.activeNode === CHAPTER_BLUEPRINTS_NODE) return { title: "等待章节蓝图", detail: state.runs[VOLUME_STRATEGY_NODE]?.status === "completed" ? "上游分卷策略已就绪，可以选择卷和章节批次后手动运行节点 08。" : "必须先完成并通过节点 07。" }
    if (state.activeNode === STYLE_PROFILE_NODE) return { title: "等待文风自进化", detail: state.runs[CHAPTER_BLUEPRINTS_NODE]?.status === "completed" ? "上游章节蓝图已就绪，可以手动运行节点 09。" : "必须先完成并通过节点 08。" }
    if (state.activeNode === SINGLE_CHAPTER_CONTEXT_NODE) return { title: "等待单章上下文", detail: state.runs[STYLE_PROFILE_NODE]?.result?.freeze?.status === "approved" ? "第 9 节点文风合同已冻结，可以手动运行节点 10。" : "必须先完成并冻结节点 09。" }
    if (state.activeNode === CHAPTER_DRAFT_NODE) return { title: "等待单章完整生产", detail: state.runs[SINGLE_CHAPTER_CONTEXT_NODE]?.status === "completed" ? "第 10 节点单章上下文已就绪，可以手动运行节点 11。" : "必须先完成并通过节点 10。" }
    if (state.activeNode === CHAPTER_COMMIT_NODE) return { title: "等待章节正文冻结", detail: state.runs[CHAPTER_DRAFT_NODE]?.status === "completed" ? "第 11 节点正文已通过，可以冻结为章节资产。" : "必须先完成并通过节点 11。" }
    return { title: "等待连续章节生产", detail: state.runs[STYLE_PROFILE_NODE]?.result?.freeze?.status === "approved" ? "第 9 节点文风合同已冻结，可以选择章节范围后运行节点 13。" : "必须先完成并冻结节点 09。" }
  }
  if (run.result?.mode === "aigc_detector_calibration") {
    if (run.status === "queued") return { title: "AIGC 检测器校准 Run 已创建", detail: "正在准备样本与检测服务。" }
    if (run.status === "running") return { title: "正在校准 AIGC 检测器", detail: run.events.at(-1)?.message || "正在逐条检测样本。" }
    if (run.status === "completed") return { title: "AIGC 检测器校准完成", detail: `trustLevel=${run.result.trustLevel || "unknown"}；请查看“结构化结果”和“验证”。` }
    if (run.status === "invalid") return { title: "AIGC 检测器校准未通过", detail: run.validation?.errors?.[0] || "检测器可能与当前题材域不匹配。" }
    if (run.status === "paused") return { title: "AIGC 检测器校准已暂停", detail: run.pauseReason || "当前校准 Run 已停止。" }
    return { title: "AIGC 检测器校准失败", detail: run.error || "查看日志中的失败记录。" }
  }
  if (run.status === "queued") return { title: `${nodeName} Run 已创建`, detail: "执行器正在准备隔离目录和模型配置。" }
  if (run.status === "running") return { title: `真实模型正在生成${nodeName}`, detail: run.events.at(-1)?.message || "等待模型输出。" }
  if (run.status === "completed") return { title: `${nodeName}通过完整验证`, detail: state.activeNode === CHAPTER_BLUEPRINTS_NODE ? "结构与独立正典语义审计均已通过；结果仍只存在于 debug run。" : state.activeNode === CHAPTER_COMMIT_NODE ? "正文已冻结为调试章节资产，可在“样例/正文”查看完整内容和资产路径。" : state.activeNode === CONTINUOUS_CHAPTER_NODE ? "所选章节已逐章生成并冻结；可在“结构化结果”查看每章子 Run 和资产路径。" : "结果仅存在于 debug run，尚未写入正式项目。" }
  if (run.status === "paused") return { title: `${nodeName}运行已暂停`, detail: run.pauseReason || "当前 Run 已停止后续轮次；可以切换模型后重新运行。" }
  if (isChapterAuditPending(run)) return { title: "章节蓝图结构已通过，等待正典审计", detail: "当前 1–10 章已保留；点击“仅跑正典审计”只审计现有结果，不会重新生成章节蓝图。" }
  if (run.status === "invalid") return { title: "模型已返回，但内容验证失败", detail: "查看“验证”页签中的具体字段和数量问题。" }
  return { title: `${nodeName}节点执行失败`, detail: run.error || "查看日志中的失败记录。" }
}

function renderNodeNavigation() {
  $$("#node-nav [data-node]").forEach((button) => button.classList.toggle("active", button.dataset.node === state.activeNode))
  const isWorld = state.activeNode === WORLD_NODE
  const isCharacter = state.activeNode === CHARACTER_NODE
  const isInitialState = state.activeNode === INITIAL_STATE_NODE
  const isWorldMatrix = state.activeNode === WORLD_MATRIX_NODE
  const isPlotArchitecture = state.activeNode === PLOT_ARCHITECTURE_NODE
  const isStoryBible = state.activeNode === STORY_BIBLE_NODE
  const isVolumeStrategy = state.activeNode === VOLUME_STRATEGY_NODE
  const isChapterBlueprints = state.activeNode === CHAPTER_BLUEPRINTS_NODE
  const isStyleProfile = state.activeNode === STYLE_PROFILE_NODE
  const isSingleChapterContext = state.activeNode === SINGLE_CHAPTER_CONTEXT_NODE
  const isChapterDraft = state.activeNode === CHAPTER_DRAFT_NODE
  const isChapterCommit = state.activeNode === CHAPTER_COMMIT_NODE
  const isContinuousChapter = state.activeNode === CONTINUOUS_CHAPTER_NODE
  const isChapterReview = state.activeNode === CHAPTER_REVIEW_NODE
  $("#world-input-panel").hidden = !isWorld
  $("#character-input-panel").hidden = !isCharacter
  $("#initial-state-input-panel").hidden = !isInitialState
  $("#world-matrix-input-panel").hidden = !isWorldMatrix
  $("#plot-architecture-input-panel").hidden = !isPlotArchitecture
  $("#story-bible-input-panel").hidden = !isStoryBible
  $("#volume-strategy-input-panel").hidden = !isVolumeStrategy
  $("#chapter-blueprints-input-panel").hidden = !isChapterBlueprints
  $("#style-profile-input-panel").hidden = !isStyleProfile
  $("#single-chapter-context-input-panel").hidden = !isSingleChapterContext
  $("#chapter-draft-input-panel").hidden = !isChapterDraft
  $("#chapter-commit-input-panel").hidden = !isChapterCommit
  $("#continuous-chapter-input-panel").hidden = !isContinuousChapter
  $("#chapter-review-input-panel").hidden = !isChapterReview
  $("#brand-index").textContent = isWorld ? "01" : isCharacter ? "02" : isInitialState ? "03" : isWorldMatrix ? "04" : isPlotArchitecture ? "05" : isStoryBible ? "06" : isVolumeStrategy ? "07" : isChapterBlueprints ? "08" : isStyleProfile ? "09" : isSingleChapterContext ? "10" : isChapterDraft ? "11" : isChapterCommit ? "12" : isContinuousChapter ? "13" : "14"
  $("#brand-title").textContent = isWorld ? "世界观生成节点" : isCharacter ? "人物规划节点" : isInitialState ? "人物初始状态节点" : isWorldMatrix ? "世界矩阵节点" : isPlotArchitecture ? "主线架构节点" : isStoryBible ? "故事圣经节点" : isVolumeStrategy ? "分卷策略节点" : isChapterBlueprints ? "章节蓝图节点" : isStyleProfile ? "文风自进化节点" : isSingleChapterContext ? "单章上下文节点" : isChapterDraft ? "单章完整生产节点" : isChapterCommit ? "章节正文冻结节点" : isContinuousChapter ? "连续章节生产节点" : "章节阅读复盘节点"
}

function renderUpstream() {
  const worldRun = state.runs[WORLD_NODE]
  const ready = worldRun?.status === "completed" && worldRun?.validation?.valid
  const characters = worldCharacters(worldRun)
  const totalChapters = Number(worldRun?.input?.totalChapters || 0)
  $("#upstream-title").textContent = ready ? String(worldRun.result?.project?.title || worldRun.input?.title || "世界观已就绪") : "等待世界观节点"
  $("#upstream-detail").textContent = ready
    ? `服务端将锁定这份世界观结果，完整继承 ${characters.length} 名已有角色后再规划扩容。`
    : "请先完成并通过节点 01。"
  $("#upstream-run-id").textContent = ready ? worldRun.runId : "—"
  $("#upstream-character-count").textContent = String(characters.length)
  $("#character-target-count").textContent = ready ? String(Math.max(characters.length, characterTarget(totalChapters))) : "—"
  $("#upstream-character-list").innerHTML = ready
    ? characters.map((character) => `<span>${escapeHtml(character.name || "未命名")}</span>`).join("")
    : ""

  const characterRun = state.runs[CHARACTER_NODE]
  const characterReady = characterRun?.status === "completed" && characterRun?.validation?.valid
  const planned = plannedCharacters(characterRun)
  const relationshipCount = Array.isArray(characterRun?.result?.relationshipGraph) ? characterRun.result.relationshipGraph.length : 0
  $("#initial-state-upstream-title").textContent = characterReady ? "人物集合已冻结" : "等待人物规划节点"
  $("#initial-state-upstream-detail").textContent = characterReady
    ? `节点 03 将初始化 ${planned.length} 人及 ${relationshipCount} 条关系，不允许新增人物。`
    : "请先完成并通过节点 02。"
  $("#initial-state-upstream-run-id").textContent = characterReady ? characterRun.runId : "—"
  $("#initial-state-character-count").textContent = String(planned.length)
  $("#initial-state-relationship-count").textContent = String(relationshipCount)
  $("#initial-state-count-display").value = characterReady ? String(planned.length) : "—"
  $("#initial-state-character-list").innerHTML = characterReady
    ? planned.map((character) => `<span>${escapeHtml(character.name || "未命名")}</span>`).join("")
    : ""

  const initialRun = state.runs[INITIAL_STATE_NODE]
  const matrixRun = state.runs[WORLD_MATRIX_NODE]
  const lockedInitialSnapshot = matrixRun?.input?.initialCharacterState
  const matrixSourceRun = lockedInitialSnapshot
    ? { runId: matrixRun.input.upstreamRunId, result: lockedInitialSnapshot, input: { worldFoundation: matrixRun.input.worldFoundation } }
    : initialRun
  const initialReady = Boolean(lockedInitialSnapshot) || (initialRun?.status === "completed" && initialRun?.validation?.valid)
  const matrixCharacters = initialStateCharacters(matrixSourceRun)
  const matrixLocations = openingLocations(matrixSourceRun)
  const matrixRuleCount = Array.isArray(matrixSourceRun?.input?.worldFoundation?.worldRules) ? matrixSourceRun.input.worldFoundation.worldRules.length : 0
  const matrixClockCount = Array.isArray(matrixSourceRun?.result?.activeClocks) ? matrixSourceRun.result.activeClocks.length : 0
  $("#world-matrix-upstream-title").textContent = initialReady ? (lockedInitialSnapshot ? "本次 Run 的开场状态快照" : "开场人物状态已冻结") : "等待人物初始状态节点"
  $("#world-matrix-upstream-detail").textContent = initialReady
    ? `节点 04 将把 ${matrixCharacters.length} 人、${matrixLocations.length} 个开场地点、${matrixRuleCount} 条规则与 ${matrixClockCount} 个倒计时连接成世界矩阵。`
    : "请先完成并通过节点 03。"
  $("#world-matrix-upstream-run-id").textContent = initialReady ? matrixSourceRun.runId : "—"
  $("#world-matrix-character-count").textContent = String(matrixCharacters.length)
  $("#world-matrix-location-count").textContent = String(matrixLocations.length)
  $("#world-matrix-rule-count").value = initialReady ? String(matrixRuleCount) : "—"
  $("#world-matrix-clock-count").value = initialReady ? String(matrixClockCount) : "—"
  $("#world-matrix-location-list").innerHTML = initialReady
    ? matrixLocations.map((location) => `<span>${escapeHtml(location)}</span>`).join("")
    : ""

  const plotRun = state.runs[PLOT_ARCHITECTURE_NODE]
  const lockedMatrixSnapshot = plotRun?.input?.worldMatrix
  const plotSourceRun = lockedMatrixSnapshot
    ? { runId: plotRun.input.upstreamRunId, result: lockedMatrixSnapshot, input: plotRun.input }
    : matrixRun
  const plotReady = Boolean(lockedMatrixSnapshot) || (matrixRun?.status === "completed" && matrixRun?.validation?.valid)
  const plotCharacters = Array.isArray(plotSourceRun?.input?.characterPlanning?.characters) ? plotSourceRun.input.characterPlanning.characters : []
  const plotAnchors = Array.isArray(plotSourceRun?.result?.continuityAnchors) ? plotSourceRun.result.continuityAnchors : []
  const causalInputs = Array.isArray(plotSourceRun?.result?.handoffToPlotArchitecture?.causalInputs) ? plotSourceRun.result.handoffToPlotArchitecture.causalInputs : []
  const plotTotalChapters = Number(plotSourceRun?.input?.totalChapters || 0)
  $("#plot-architecture-upstream-title").textContent = plotReady ? (lockedMatrixSnapshot ? "本次 Run 的世界矩阵快照" : "世界矩阵已冻结") : "等待世界矩阵节点"
  $("#plot-architecture-upstream-detail").textContent = plotReady
    ? `节点 05 将把 ${plotCharacters.length} 名人物、${plotAnchors.length} 条连续性锚点和 ${causalInputs.length} 个因果输入组织为 ${plotArcTarget(plotTotalChapters)} 条宏观因果弧。`
    : "请先完成并通过节点 04。"
  $("#plot-architecture-upstream-run-id").textContent = plotReady ? plotSourceRun.runId : "—"
  $("#plot-architecture-character-count").textContent = String(plotCharacters.length)
  $("#plot-architecture-anchor-count").textContent = String(plotAnchors.length)
  $("#plot-architecture-total-chapters").value = plotReady ? String(plotTotalChapters) : "—"
  $("#plot-architecture-arc-count").value = plotReady ? String(plotArcTarget(plotTotalChapters)) : "—"
  $("#plot-architecture-causal-list").innerHTML = plotReady
    ? causalInputs.slice(0, 8).map((item) => `<span>${escapeHtml(item)}</span>`).join("")
    : ""

  const bibleRun = state.runs[STORY_BIBLE_NODE]
  const lockedPlotSnapshot = bibleRun?.input?.plotArchitecture
  const bibleSourceRun = lockedPlotSnapshot
    ? { runId: bibleRun.input.upstreamRunId, result: lockedPlotSnapshot, input: bibleRun.input }
    : plotRun
  const bibleReady = Boolean(lockedPlotSnapshot) || (plotRun?.status === "completed" && plotRun?.validation?.valid)
  const bibleArcs = Array.isArray(bibleSourceRun?.result?.arcArchitecture) ? bibleSourceRun.result.arcArchitecture : []
  const bibleAnchors = Array.isArray(bibleSourceRun?.result?.continuityPlan) ? bibleSourceRun.result.continuityPlan : []
  const bibleCharacters = Array.isArray(bibleSourceRun?.input?.characterPlanning?.characters) ? bibleSourceRun.input.characterPlanning.characters : []
  const bibleRelationships = Array.isArray(bibleSourceRun?.input?.characterPlanning?.relationshipGraph) ? bibleSourceRun.input.characterPlanning.relationshipGraph : []
  const lockedMainline = Array.isArray(bibleSourceRun?.result?.handoffToStoryBible?.lockedMainline) ? bibleSourceRun.result.handoffToStoryBible.lockedMainline : []
  $("#story-bible-upstream-title").textContent = bibleReady ? (lockedPlotSnapshot ? "本次 Run 的主线架构快照" : "主线架构已冻结") : "等待主线架构节点"
  $("#story-bible-upstream-detail").textContent = bibleReady
    ? `节点 06 将冻结 ${bibleCharacters.length} 名人物、${bibleRelationships.length} 条关系、${bibleArcs.length} 条主线弧和 ${bibleAnchors.length} 条连续性锚点。`
    : "请先完成并通过节点 05。"
  $("#story-bible-upstream-run-id").textContent = bibleReady ? bibleSourceRun.runId : "—"
  $("#story-bible-arc-count").textContent = String(bibleArcs.length)
  $("#story-bible-anchor-count").textContent = String(bibleAnchors.length)
  $("#story-bible-character-count").value = bibleReady ? String(bibleCharacters.length) : "—"
  $("#story-bible-relationship-count").value = bibleReady ? String(bibleRelationships.length) : "—"
  $("#story-bible-lock-list").innerHTML = bibleReady
    ? lockedMainline.slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("")
    : ""

  const volumeRun = state.runs[VOLUME_STRATEGY_NODE]
  const lockedBibleSnapshot = volumeRun?.input?.storyBible
  const volumeSourceRun = lockedBibleSnapshot
    ? { runId: volumeRun.input.upstreamRunId, result: lockedBibleSnapshot, input: volumeRun.input }
    : bibleRun
  const volumeReady = Boolean(lockedBibleSnapshot) || (bibleRun?.status === "completed" && bibleRun?.validation?.valid)
  const volumeArcs = Array.isArray(volumeSourceRun?.input?.plotArchitecture?.arcArchitecture) ? volumeSourceRun.input.plotArchitecture.arcArchitecture : []
  const volumeCharacters = Array.isArray(volumeSourceRun?.result?.characterCanon) ? volumeSourceRun.result.characterCanon : []
  const volumePromises = Array.isArray(volumeSourceRun?.result?.promiseLedger) ? volumeSourceRun.result.promiseLedger : []
  const allowedBreaks = Array.isArray(volumeSourceRun?.result?.handoffToVolumeStrategy?.allowedVolumeBreaks) ? volumeSourceRun.result.handoffToVolumeStrategy.allowedVolumeBreaks : []
  const volumeTotalChapters = Number(volumeSourceRun?.input?.totalChapters || 0)
  const targetInput = $("#volume-strategy-target-count")
  const maxVolumeCount = Math.max(1, Math.min(12, volumeArcs.length))
  targetInput.max = String(maxVolumeCount)
  const currentTarget = Number(targetInput.value)
  if (volumeReady && (!Number.isInteger(currentTarget) || currentTarget < Math.min(2, maxVolumeCount) || currentTarget > maxVolumeCount)) targetInput.value = String(volumeTarget(volumeArcs.length))
  $("#volume-strategy-upstream-title").textContent = volumeReady ? (lockedBibleSnapshot ? "本次 Run 的故事圣经快照" : "故事圣经已冻结") : "等待故事圣经节点"
  $("#volume-strategy-upstream-detail").textContent = volumeReady
    ? `节点 07 将把 ${volumeArcs.length} 条主线弧分组为连续卷，并安排 ${volumeCharacters.length} 名人物与 ${volumePromises.length} 条伏笔承诺。`
    : "请先完成并通过节点 06。"
  $("#volume-strategy-upstream-run-id").textContent = volumeReady ? volumeSourceRun.runId : "—"
  $("#volume-strategy-arc-count").textContent = String(volumeArcs.length)
  $("#volume-strategy-promise-count").textContent = String(volumePromises.length)
  $("#volume-strategy-total-chapters").value = volumeReady ? String(volumeTotalChapters) : "—"
  $("#volume-strategy-character-count").value = volumeReady ? String(volumeCharacters.length) : "—"
  $("#volume-strategy-break-list").innerHTML = volumeReady
    ? allowedBreaks.slice(0, 6).map((item) => `<span>${escapeHtml(item)}</span>`).join("")
    : ""

  const chapterRun = state.runs[CHAPTER_BLUEPRINTS_NODE]
  const lockedVolumeSnapshot = chapterRun?.input?.volumeStrategy
  const chapterSourceRun = lockedVolumeSnapshot
    ? { runId: chapterRun.input.upstreamRunId, result: lockedVolumeSnapshot, input: chapterRun.input }
    : volumeRun
  const chapterReady = Boolean(lockedVolumeSnapshot) || (volumeRun?.status === "completed" && volumeRun?.validation?.valid)
  const chapterVolumes = Array.isArray(chapterSourceRun?.result?.volumes) ? chapterSourceRun.result.volumes : []
  const chapterCharacters = Array.isArray(chapterSourceRun?.input?.storyBible?.characterCanon) ? chapterSourceRun.input.storyBible.characterCanon : []
  const volumeSelect = $("#chapter-blueprints-volume-id")
  const optionSignature = `${chapterSourceRun?.runId || "none"}:${chapterVolumes.map((entry) => entry.id).join("|")}`
  if (volumeSelect.dataset.optionSignature !== optionSignature) {
    const requestedValue = volumeSelect.dataset.restoredValue || volumeSelect.value
    volumeSelect.innerHTML = chapterVolumes.length
      ? chapterVolumes.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.title || entry.id)} · 第 ${Number(entry.startChapter)}-${Number(entry.endChapter)} 章</option>`).join("")
      : '<option value="">等待分卷策略</option>'
    if (chapterVolumes.some((entry) => entry.id === requestedValue)) volumeSelect.value = requestedValue
    delete volumeSelect.dataset.restoredValue
    volumeSelect.dataset.optionSignature = optionSignature
  }
  const selectedVolume = chapterVolumes.find((entry) => entry.id === volumeSelect.value)
  const startInput = $("#chapter-blueprints-start-chapter")
  const endInput = $("#chapter-blueprints-end-chapter")
  if (selectedVolume) {
    const start = Number(selectedVolume.startChapter)
    const end = Number(selectedVolume.endChapter)
    startInput.min = String(start)
    startInput.max = String(end)
    endInput.min = String(start)
    endInput.max = String(end)
    const rangeSignature = `${chapterSourceRun?.runId || "none"}:${selectedVolume.id}`
    if (volumeSelect.dataset.rangeSignature !== rangeSignature) {
      startInput.value = String(start)
      endInput.value = String(Math.min(start + CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT - 1, end))
      volumeSelect.dataset.rangeSignature = rangeSignature
    }
  }
  $("#chapter-blueprints-upstream-title").textContent = chapterReady ? (lockedVolumeSnapshot ? "本次 Run 的分卷策略快照" : "分卷策略已冻结") : "等待分卷策略节点"
  $("#chapter-blueprints-upstream-detail").textContent = chapterReady
    ? `节点 08 将在所选卷内生成连续章节蓝图；稳定模式单次最多 ${CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT} 章，共有 ${chapterVolumes.length} 卷、${chapterCharacters.length} 名正典人物可供约束。`
    : "请先完成并通过节点 07。"
  $("#chapter-blueprints-upstream-run-id").textContent = chapterReady ? chapterSourceRun.runId : "—"
  $("#chapter-blueprints-volume-count").textContent = String(chapterVolumes.length)
  $("#chapter-blueprints-character-count").textContent = String(chapterCharacters.length)
  $("#chapter-blueprints-volume-list").innerHTML = chapterReady
    ? chapterVolumes.map((entry) => `<span>${escapeHtml(entry.id)} · 第 ${Number(entry.startChapter)}-${Number(entry.endChapter)} 章</span>`).join("")
    : ""
  renderChapterBlueprintLedger(selectedVolume, chapterReady)

  const styleRun = state.runs[STYLE_PROFILE_NODE]
  const lockedChapterBlueprintSnapshot = styleRun?.input?.chapterBlueprints
  const completedBlueprintCoverage = completedChapterBlueprintCoverage()
  const styleSourceRun = lockedChapterBlueprintSnapshot
    ? { runId: styleRun.input.upstreamRunId, result: lockedChapterBlueprintSnapshot, input: styleRun.input }
    : chapterRun
  const styleReady = Boolean(lockedChapterBlueprintSnapshot) || completedBlueprintCoverage.count > 0
  const styleBlueprints = Array.isArray(styleSourceRun?.result?.blueprints) ? styleSourceRun.result.blueprints : []
  const firstStyleChapter = lockedChapterBlueprintSnapshot
    ? Number(styleBlueprints[0]?.chapterNumber || styleSourceRun?.input?.startChapter || 1)
    : completedBlueprintCoverage.firstChapter || 1
  const lastStyleChapter = lockedChapterBlueprintSnapshot
    ? Number(styleBlueprints.at(-1)?.chapterNumber || styleSourceRun?.input?.endChapter || firstStyleChapter)
    : completedBlueprintCoverage.lastChapter || firstStyleChapter
  const sampleInput = $("#style-profile-sample-chapter")
  if (styleReady) {
    sampleInput.min = String(firstStyleChapter)
    sampleInput.max = String(lastStyleChapter)
    const currentSample = Number(sampleInput.value)
    if (!Number.isInteger(currentSample) || currentSample < firstStyleChapter || currentSample > lastStyleChapter) sampleInput.value = String(firstStyleChapter)
  }
  $("#style-profile-upstream-title").textContent = styleReady ? (lockedChapterBlueprintSnapshot ? "本次 Run 的章节蓝图快照" : "章节蓝图已冻结") : "等待章节蓝图节点"
  $("#style-profile-upstream-detail").textContent = styleReady
    ? lockedChapterBlueprintSnapshot
      ? `节点 09 已锁定本次聚合快照：${styleBlueprints.length} 章蓝图，范围第 ${firstStyleChapter}-${lastStyleChapter} 章；只生成文风样段，不写入正式正文。`
      : `节点 09 将聚合同一分卷策略下全部已通过章节蓝图：${completedBlueprintCoverage.count} 章，范围第 ${firstStyleChapter}-${lastStyleChapter} 章；只生成文风样段，不写入正式正文。`
    : "请先完成并通过节点 08。"
  $("#style-profile-upstream-run-id").textContent = styleReady ? (styleSourceRun?.runId || state.runIds[CHAPTER_BLUEPRINTS_NODE] || "聚合全部已通过批次") : "—"
  $("#style-profile-blueprint-count").textContent = String(lockedChapterBlueprintSnapshot ? styleBlueprints.length : completedBlueprintCoverage.count)
  $("#style-profile-blueprint-count-display").value = styleReady ? String(lockedChapterBlueprintSnapshot ? styleBlueprints.length : completedBlueprintCoverage.count) : "—"
  $("#style-profile-sample-display").textContent = styleReady ? `第 ${Number(sampleInput.value)} 章` : "—"
  $("#style-profile-blueprint-list").innerHTML = styleReady
    ? lockedChapterBlueprintSnapshot
      ? styleBlueprints.slice(0, 8).map((entry) => `<span>第 ${Number(entry.chapterNumber)} 章 · ${escapeHtml(entry.title || "")}</span>`).join("")
      : completedBlueprintCoverage.completed.slice(0, 12).map((run) => `<span>第 ${Number(run.startChapter)}-${Number(run.endChapter)} 章 · ${escapeHtml(run.runId)}</span>`).join("")
    : ""

  const contextRun = state.runs[SINGLE_CHAPTER_CONTEXT_NODE]
  const contextStyleRun = state.runs[STYLE_PROFILE_NODE]
  const contextStyleInput = contextStyleRun?.input || {}
  const contextBlueprints = Array.isArray(contextStyleInput.chapterBlueprints?.blueprints) ? contextStyleInput.chapterBlueprints.blueprints : styleBlueprints
  const contextFirstChapter = Number(contextBlueprints[0]?.chapterNumber || firstStyleChapter || 1)
  const contextLastChapter = Number(contextBlueprints.at(-1)?.chapterNumber || lastStyleChapter || contextFirstChapter)
  const contextChapterInput = $("#single-chapter-context-chapter")
  const contextFrozen = contextStyleRun?.result?.freeze?.status === "approved"
  if (contextBlueprints.length) {
    contextChapterInput.min = String(contextFirstChapter)
    contextChapterInput.max = String(contextLastChapter)
    const currentChapter = Number(contextChapterInput.value)
    if (!Number.isInteger(currentChapter) || currentChapter < contextFirstChapter || currentChapter > contextLastChapter) contextChapterInput.value = String(contextFirstChapter)
  }
  $("#single-chapter-context-upstream-title").textContent = contextFrozen ? "文风合同已冻结" : contextStyleRun?.status === "completed" ? "等待冻结第 9 节点" : "等待第 9 节点"
  $("#single-chapter-context-upstream-detail").textContent = contextFrozen
    ? `节点 10 将为第 ${Number(contextChapterInput.value)} 章组装写作输入包；不会调用模型、不会生成正文。`
    : contextStyleRun?.status === "completed"
      ? "第 9 节点已通过，但还没有冻结为正式文风合同。请先点击节点 09 的冻结按钮。"
      : "请先完成并冻结节点 09。"
  $("#single-chapter-context-style-run-id").textContent = contextStyleRun?.runId || contextRun?.input?.upstreamRunId || "—"
  $("#single-chapter-context-range").textContent = contextBlueprints.length ? `第 ${contextFirstChapter}-${contextLastChapter} 章` : "—"

  const draftRun = state.runs[CHAPTER_DRAFT_NODE]
  const draftContextRun = state.runs[SINGLE_CHAPTER_CONTEXT_NODE]
  const draftContextReady = draftContextRun?.status === "completed" && draftContextRun?.validation?.valid
  const draftChapterNumber = Number(draftContextRun?.result?.source?.chapterNumber || draftContextRun?.input?.chapterNumber || 0)
  const draftTargetWords = Number(draftContextRun?.result?.source?.targetWordCount || draftContextRun?.input?.targetWordCount || $("#chapter-draft-target-words").value || 2500)
  $("#chapter-draft-upstream-title").textContent = draftContextReady ? "单章上下文包已就绪" : "等待第 10 节点"
  $("#chapter-draft-upstream-detail").textContent = draftContextReady
    ? `节点 11 将一键生产第 ${draftChapterNumber || "—"} 章：正文候选、基础门禁、AIGC 检测和自动修复 loop；只保存在 debug run，不会提交正式章节。`
    : "请先完成并通过节点 10。"
  $("#chapter-draft-context-run-id").textContent = draftContextReady ? draftContextRun.runId : draftRun?.input?.upstreamRunId || "—"
  $("#chapter-draft-chapter-display").textContent = draftChapterNumber ? `第 ${draftChapterNumber} 章 · 约 ${draftTargetWords} 字` : "—"
  $("#chapter-draft-chapter").value = draftChapterNumber ? `第 ${draftChapterNumber} 章` : "—"
  if (draftContextReady && (!Number($("#chapter-draft-target-words").value) || $("#chapter-draft-target-words").dataset.contextRunId !== draftContextRun.runId)) {
    $("#chapter-draft-target-words").value = String(draftTargetWords)
    $("#chapter-draft-target-words").dataset.contextRunId = draftContextRun.runId
  }

  const commitRun = state.runs[CHAPTER_COMMIT_NODE]
  const commitDraftRun = state.runs[CHAPTER_DRAFT_NODE]
  const commitDraftReady = commitDraftRun?.status === "completed" && commitDraftRun?.validation?.valid
  const commitCandidate = commitDraftRun?.result?.finalCandidate || commitDraftRun?.result?.draft || {}
  const commitChapterNumber = Number(commitCandidate.chapterNumber || commitDraftRun?.input?.chapterNumber || 0)
  const commitCharCount = Number(commitCandidate.charCount || String(commitCandidate.text || "").length || 0)
  $("#chapter-commit-upstream-title").textContent = commitDraftReady ? "正文候选已通过" : "等待第 11 节点"
  $("#chapter-commit-upstream-detail").textContent = commitDraftReady
    ? `可以冻结第 ${commitChapterNumber || "—"} 章：${commitCharCount || "—"} 字符。冻结后会形成可追溯章节资产，后续章节可基于它继续。`
    : "请先完成并通过节点 11。"
  $("#chapter-commit-draft-run-id").textContent = commitDraftReady ? commitDraftRun.runId : commitRun?.input?.upstreamRunId || "—"
  $("#chapter-commit-chapter-display").textContent = commitChapterNumber ? `第 ${commitChapterNumber} 章 · ${commitCharCount || "—"} 字符` : "—"
  $("#chapter-commit-frozen-path").textContent = commitRun?.result?.frozenChapter?.assetPath || "—"

  const continuousStyleRun = state.runs[STYLE_PROFILE_NODE]
  const continuousStyleFrozen = continuousStyleRun?.result?.freeze?.status === "approved"
  const continuousBlueprints = Array.isArray(continuousStyleRun?.input?.chapterBlueprints?.blueprints) ? continuousStyleRun.input.chapterBlueprints.blueprints : []
  const continuousFirstChapter = Number(continuousBlueprints[0]?.chapterNumber || 1)
  const continuousLastChapter = Number(continuousBlueprints.at(-1)?.chapterNumber || continuousFirstChapter)
  const firstVolumeRange = firstVolumeRangeFromStyleRun(continuousStyleRun)
  const committedCoverage = state.committedChapterCoverage || {}
  const committedChapters = Array.isArray(committedCoverage.chapters) ? committedCoverage.chapters : []
  const nextChapter = Number(committedCoverage.nextChapter || continuousFirstChapter)
  const recommendedStart = Math.max(continuousFirstChapter, Math.min(continuousLastChapter, nextChapter))
  const recommendedEnd = Math.min(recommendedStart + 2, continuousLastChapter)
  $("#continuous-chapter-upstream-title").textContent = continuousStyleFrozen ? "文风合同与章节蓝图已就绪" : "等待第 9 节点冻结"
  $("#continuous-chapter-upstream-detail").textContent = continuousStyleFrozen
    ? `节点 13 会自动串联节点 10→11→12；已冻结 ${committedChapters.length} 章，最后连续到第 ${Number(committedCoverage.lastContinuousChapter || 0)} 章，下一章建议从第 ${recommendedStart} 章开始。第一卷范围：第 ${firstVolumeRange.startChapter}-${firstVolumeRange.endChapter} 章。`
    : "请先完成并冻结第 9 节点。"
  $("#continuous-chapter-style-run-id").textContent = continuousStyleRun?.runId || "—"
  $("#continuous-chapter-range").textContent = continuousBlueprints.length
    ? `蓝图第 ${continuousFirstChapter}-${continuousLastChapter} 章；已冻结：${committedChapters.length ? committedChapters.slice(0, 20).join("、") + (committedChapters.length > 20 ? "…" : "") : "无"}`
    : "—"
  const coverageSignature = `${continuousStyleRun?.runId || ""}:${committedChapters.join(",")}:${recommendedStart}:${recommendedEnd}`
  if (continuousStyleFrozen && $("#continuous-chapter-start").dataset.coverageSignature !== coverageSignature) {
    $("#continuous-chapter-start").value = String(recommendedStart)
    $("#continuous-chapter-end").value = String(recommendedEnd)
    $("#continuous-chapter-start").dataset.coverageSignature = coverageSignature
  }
  const autoStatus = $("#continuous-chapter-auto-status")
  if (autoStatus) autoStatus.textContent = state.continuousChapterAutoRun.lastMessage || `自动续跑：每批 3 章，直到 ${firstVolumeRange.title} 第 ${firstVolumeRange.endChapter} 章。`

  const reviewCoverage = state.committedChapterCoverage || {}
  const reviewChapters = Array.isArray(reviewCoverage.chapters) ? reviewCoverage.chapters : []
  const reviewLast = Number(reviewCoverage.lastContinuousChapter || 0)
  const reviewNext = Number(reviewCoverage.nextChapter || 1)
  $("#chapter-review-upstream-title").textContent = reviewChapters.length ? "已读取冻结章节库" : "等待章节资产"
  $("#chapter-review-upstream-detail").textContent = reviewChapters.length
    ? `当前可复盘第 ${reviewChapters[0]}-${reviewLast} 章；这一步不生成正文，只检查已冻结资产。`
    : "先完成至少一章正文冻结。"
  $("#chapter-review-count").textContent = String(reviewChapters.length)
  $("#chapter-review-last").textContent = reviewLast ? `第 ${reviewLast} 章` : "—"
  $("#chapter-review-next").textContent = reviewNext ? `第 ${reviewNext} 章` : "—"
  const reviewSignature = `${reviewChapters.join(",")}:${reviewLast}`
  const reviewEndInput = $("#chapter-review-end")
  if (reviewEndInput && reviewLast && reviewEndInput.dataset.coverageSignature !== reviewSignature) {
    $("#chapter-review-start").value = String(reviewChapters[0] || 1)
    reviewEndInput.value = String(reviewLast)
    reviewEndInput.dataset.coverageSignature = reviewSignature
  }
}

function renderStatus() {
  const run = activeRun()
  const copy = statusCopy(run)
  const localStatus = state.activeNode === CHAPTER_REVIEW_NODE
    ? state.chapterReview.loading ? "running" : state.chapterReview.error ? "failed" : state.chapterReview.report ? "completed" : "idle"
    : "idle"
  $("#run-status").className = `run-status ${run?.status || localStatus}`
  $("#run-status-title").textContent = copy.title
  $("#run-status-detail").textContent = copy.detail
  $("#run-id").textContent = run?.runId || (state.activeNode === CHAPTER_REVIEW_NODE && state.chapterReview.report ? "local-readonly-review" : "—")
  $("#model-name").textContent = run?.provider?.modelName || (state.activeNode === CHAPTER_REVIEW_NODE ? "no-llm" : "—")
  const elapsed = run?.events?.at(-1)?.elapsedMs || 0
  $("#elapsed").textContent = elapsed >= 1000 ? `${(elapsed / 1000).toFixed(1)} s` : `${elapsed} ms`
  const pauseButton = $("#pause-run-button")
  const canPause = Boolean(run?.runId && ["queued", "running"].includes(run.status))
  pauseButton.hidden = !canPause
  pauseButton.disabled = Boolean(run?.pauseRequestedAt)
  pauseButton.textContent = run?.pauseRequestedAt ? "暂停中…" : "暂停运行"
}

function latestStyleSampleFromRun(run) {
  if (!run || run.nodeId !== STYLE_PROFILE_NODE) return null
  const selected = run.result?.selectedCandidate
  if (selected?.sample) {
    const aigc = selected.evaluation?.aigc || {}
    const verification = selected.verification || {}
    return {
      sample: String(selected.sample),
      round: selected.round,
      verdict: selected.evaluation?.verdict || "—",
      overall: selected.evaluation?.scores?.overall,
      aigcStatus: aigc.status,
      aigcScore: aigc.score,
      aigcThreshold: aigc.threshold,
      verificationStatus: verification.status,
      source: "selected",
    }
  }
  const sampleEvent = [...(run.events || [])].reverse().find((event) => typeof event.data?.sample === "string" && event.data.sample.trim())
  if (sampleEvent) {
    return {
      sample: String(sampleEvent.data.sample),
      round: sampleEvent.data.round,
      verdict: "评估中",
      overall: undefined,
      aigcStatus: sampleEvent.data.aigcStatus,
      aigcScore: sampleEvent.data.aigcScore,
      aigcThreshold: sampleEvent.data.aigcThreshold,
      verificationStatus: sampleEvent.data.verificationStatus,
      source: "latest-event",
    }
  }
  return null
}

function renderStyleSampleMonitor() {
  const panel = $("#style-sample-monitor")
  const run = activeRun()
  const sampleInfo = latestStyleSampleFromRun(run)
  const isStyleNode = state.activeNode === STYLE_PROFILE_NODE
  panel.hidden = !isStyleNode
  if (!isStyleNode) return
  const text = $("#style-sample-monitor-text")
  const meta = $("#style-sample-monitor-meta")
  const strip = $("#style-score-strip")
  if (!sampleInfo) {
    meta.textContent = run ? "节点 09 正在运行或尚未产生样段。" : "等待节点 09 输出样段。"
    text.textContent = "等待完整样段。"
    strip.innerHTML = ""
    return
  }
  text.textContent = sampleInfo.sample
  const aigcMeta = sampleInfo.aigcStatus
    ? ` · AIGC ${sampleInfo.aigcStatus}${sampleInfo.aigcScore !== undefined && sampleInfo.aigcScore !== null ? ` ${Number(sampleInfo.aigcScore).toFixed(3)}` : ""}${sampleInfo.aigcThreshold !== undefined && sampleInfo.aigcThreshold !== null ? `/${Number(sampleInfo.aigcThreshold).toFixed(3)}` : ""}`
    : ""
  const verificationMeta = sampleInfo.verificationStatus ? ` · Gate ${sampleInfo.verificationStatus}` : ""
  meta.textContent = `第 ${sampleInfo.round || "—"} 轮 · ${sampleInfo.verdict || "—"}${sampleInfo.overall !== undefined ? ` · ${Number(sampleInfo.overall).toFixed(1)} 分` : ""}${aigcMeta}${verificationMeta} · ${sampleInfo.sample.length} 字符 · ${sampleInfo.source === "selected" ? "最终选中候选" : "最新生成样段"}`
  const iterations = Array.isArray(run?.result?.iterations) ? run.result.iterations : []
  strip.innerHTML = iterations.length
    ? iterations.map((entry) => {
      const score = entry?.evaluation?.scores?.overall
      const aigcStatus = entry?.evaluation?.aigc?.status || "—"
      const verificationStatus = entry?.verification?.status || "—"
      const selected = Number(entry?.round) === Number(sampleInfo.round)
      return `<span class="${selected ? "selected" : ""}">R${escapeHtml(entry?.round || "—")} · ${escapeHtml(entry?.evaluation?.verdict || "—")} · ${score !== undefined ? escapeHtml(Number(score).toFixed(1)) : "—"} · AIGC ${escapeHtml(aigcStatus)} · Gate ${escapeHtml(verificationStatus)} · ${String(entry?.sample || "").length}字</span>`
    }).join("")
    : ""
}

function renderEvents() {
  const events = activeRun()?.events || []
  $("#event-count").textContent = `${events.length} events`
  const stream = $("#event-stream")
  if (!events.length) {
    const nodeName = activeNodeName()
    stream.innerHTML = `<div class="empty">等待你手动运行${nodeName}节点。</div>`
    return
  }
  const shouldScroll = events.length > state.lastEventCount[state.activeNode]
  const eventDetails = (event) => {
    if (!event.data) return ""
    const sample = typeof event.data.sample === "string" ? event.data.sample.trim() : ""
    return `<details><summary>详细数据</summary>${sample ? `<div class="event-full-sample"><strong>完整样段 · ${sample.length} 字符</strong><pre>${escapeHtml(sample)}</pre></div>` : ""}<pre>${escapeHtml(JSON.stringify(event.data, null, 2))}</pre></details>`
  }
  stream.innerHTML = events.map((event) => `
    <article class="event-row ${escapeHtml(event.level)}">
      <span class="event-elapsed">+${(event.elapsedMs / 1000).toFixed(1)}s</span>
      <span class="event-phase"><i></i>${escapeHtml(event.phase)}</span>
      <div class="event-message">${escapeHtml(event.message)}${eventDetails(event)}</div>
    </article>
  `).join("")
  if (shouldScroll) stream.scrollTop = stream.scrollHeight
  state.lastEventCount[state.activeNode] = events.length
}

function jsonPath(parentPath, key, isArrayItem) {
  if (isArrayItem) return `${parentPath}[${key}]`
  const property = String(key)
  return /^[A-Za-z_$][\w$]*$/.test(property)
    ? `${parentPath}.${property}`
    : `${parentPath}[${JSON.stringify(property)}]`
}

function jsonScalar(value) {
  if (value === null) return { type: "null", text: "null" }
  if (typeof value === "string") return { type: "string", text: JSON.stringify(value) }
  if (typeof value === "number") return { type: "number", text: Number.isFinite(value) ? String(value) : "null" }
  if (typeof value === "boolean") return { type: "boolean", text: String(value) }
  return { type: "null", text: String(value) }
}

function renderJsonNode(key, value, parentPath = "$", isArrayItem = false) {
  const path = jsonPath(parentPath, key, isArrayItem)
  const keyText = isArrayItem ? String(key) : JSON.stringify(String(key))
  const keyMarkup = `<span class="json-key-wrap"><span class="json-key ${isArrayItem ? "index" : ""}">${escapeHtml(keyText)}</span><span class="json-colon">:</span></span>`
  const isBranch = value !== null && typeof value === "object"

  if (!isBranch) {
    const scalar = jsonScalar(value)
    const isLongString = scalar.type === "string" && scalar.text.length > 80
    const valueMarkup = isLongString
      ? `<details class="json-long-string" open><summary><span class="json-value string">${escapeHtml(`${scalar.text.slice(0, 160)}…`)}</span><span class="json-meta">${scalar.text.length} 字符</span></summary><pre>${escapeHtml(scalar.text)}</pre></details>`
      : `<span class="json-value ${scalar.type}">${escapeHtml(scalar.text)}</span>`
    return `<div class="json-node json-leaf" data-json-path="${escapeHtml(path)}" title="${escapeHtml(path)}">${keyMarkup}${valueMarkup}</div>`
  }

  const isArray = Array.isArray(value)
  const entries = isArray ? value.map((entry, index) => [index, entry]) : Object.entries(value)
  const openBracket = isArray ? "[" : "{"
  const closeBracket = isArray ? "]" : "}"
  const countLabel = isArray ? `${entries.length} 项` : `${entries.length} 字段`
  const children = entries.length
    ? entries.map(([childKey, childValue]) => renderJsonNode(childKey, childValue, path, isArray)).join("")
    : `<div class="json-empty-value">空${isArray ? "数组" : "对象"}</div>`

  return `
    <details class="json-node json-branch" data-json-path="${escapeHtml(path)}">
      <summary title="${escapeHtml(path)}">${keyMarkup}<span class="json-bracket">${openBracket}</span><span class="json-meta">${countLabel}</span><span class="json-bracket">${closeBracket}</span></summary>
      <div class="json-children">${children}</div>
    </details>`
}

function renderJsonTree(value) {
  const isArray = Array.isArray(value)
  const entries = value !== null && typeof value === "object"
    ? (isArray ? value.map((entry, index) => [index, entry]) : Object.entries(value))
    : [["value", value]]
  const nodes = entries.map(([key, entry]) => renderJsonNode(key, entry, "$", isArray)).join("")
  const nodeCount = entries.length ? nodes.match(/class="json-node/g)?.length || 0 : 0
  const rawJson = JSON.stringify(value, null, 2)

  return `
    <section class="json-viewer" aria-label="可折叠 JSON 查看器">
      <div class="json-toolbar">
        <label class="json-search">
          <span>查找</span>
          <input id="json-tree-search" type="search" placeholder="字段、值或关键词" autocomplete="off" spellcheck="false" />
        </label>
        <span id="json-match-count" class="json-match-count">${nodeCount} 个节点</span>
        <div class="json-actions" aria-label="JSON 展开控制">
          <button type="button" data-json-action="copy">复制完整 JSON</button>
          <button type="button" data-json-action="raw">原始 JSON</button>
          <button type="button" data-json-action="tree" hidden>树形 JSON</button>
          <button type="button" data-json-action="expand">全部展开</button>
          <button type="button" data-json-action="collapse">全部收起</button>
        </div>
      </div>
      <div class="json-tree" data-json-tree>${nodes || '<div class="json-empty-value">空对象</div>'}</div>
      <pre class="json-raw" data-json-raw hidden>${escapeHtml(rawJson)}</pre>
    </section>`
}

function renderStyleEvolutionSamples(run) {
  const result = run?.result || {}
  if (result.mode !== "style_evolution_debug_loop") {
    return '<div class="empty">当前节点没有文风样段。只有节点 09「文风自进化」会在这里显示最终样段全文。</div>'
  }
  const selected = result.selectedCandidate || {}
  const selectedSample = String(selected.sample || "").trim()
  const iterations = Array.isArray(result.iterations) ? result.iterations : []
  const rounds = iterations.map((entry) => {
    const sample = String(entry?.sample || "").trim()
    const verdict = entry?.evaluation?.verdict || "—"
    const score = entry?.evaluation?.scores?.overall
    const aigc = entry?.evaluation?.aigc || {}
    const verification = entry?.verification || {}
    const aigcText = aigc.status
      ? ` · AIGC ${aigc.status}${aigc.score !== undefined && aigc.score !== null ? ` ${Number(aigc.score).toFixed(3)}` : ""}${aigc.threshold !== undefined && aigc.threshold !== null ? `/${Number(aigc.threshold).toFixed(3)}` : ""}`
      : ""
    const verificationText = verification.status ? ` · Gate ${verification.status}` : ""
    return `
      <details class="style-sample-round">
        <summary>第 ${escapeHtml(entry?.round || "—")} 轮 · ${escapeHtml(verdict)}${score !== undefined ? ` · ${escapeHtml(Number(score).toFixed(1))} 分` : ""}${escapeHtml(aigcText)}${escapeHtml(verificationText)} · ${sample.length} 字符</summary>
        <pre>${escapeHtml(sample || "这一轮没有样段。")}</pre>
      </details>`
  }).join("")
  const selectedAigc = selected.evaluation?.aigc || {}
  const selectedVerification = selected.verification || {}
  const selectedAigcText = selectedAigc.status
    ? ` · AIGC ${selectedAigc.status}${selectedAigc.score !== undefined && selectedAigc.score !== null ? ` ${Number(selectedAigc.score).toFixed(3)}` : ""}${selectedAigc.threshold !== undefined && selectedAigc.threshold !== null ? `/${Number(selectedAigc.threshold).toFixed(3)}` : ""}`
    : ""
  const selectedVerificationText = selectedVerification.status ? ` · Gate ${selectedVerification.status}` : ""
  const freeze = result.freeze || {}
  const renderFreezeList = (title, items) => Array.isArray(items) && items.length
    ? `<div class="style-freeze-preview-list"><h4>${escapeHtml(title)}</h4><ul>${items.slice(0, 12).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`
    : ""
  const freezePreview = freeze.status === "approved"
    ? `<section class="style-freeze-preview">
        <header>
          <span class="eyebrow">FROZEN STYLE CONTRACT</span>
          <h3>已沉淀为正式文风资产</h3>
          <p>${escapeHtml(freeze.freezeSummary || "样段、风格、用户规范和 AIGC 修复经验已冻结。")}</p>
        </header>
        <div class="style-freeze-preview-grid">
          ${renderFreezeList("用户关注点抽取", freeze.focusRules)}
          ${renderFreezeList("后续继承规则", freeze.inheritedRules)}
          ${renderFreezeList("AIGC 修复经验", freeze.aigcLessons)}
          ${renderFreezeList("禁用写法", freeze.antiPatterns)}
        </div>
        <details class="style-sample-round">
          <summary>查看冻结后的 styleContract JSON</summary>
          <pre>${escapeHtml(JSON.stringify(freeze.styleContract || {}, null, 2))}</pre>
        </details>
      </section>`
    : `<section class="style-freeze-preview is-pending">
        <header>
          <span class="eyebrow">FREEZE READY</span>
          <h3>候选已通过，等待你确认冻结</h3>
          <p>冻结后会把完整样段、文风规则、文风进化关注点规范、AIGC 修复经验写入 .ai-novel/style/evolution。</p>
        </header>
      </section>`
  return `
    <section class="style-sample-view">
      <header>
        <span class="eyebrow">SELECTED SAMPLE</span>
        <h3>最终候选样段全文</h3>
        <p>第 ${escapeHtml(selected.round || "—")} 轮 · ${escapeHtml(selected.evaluation?.verdict || "—")}${escapeHtml(selectedAigcText)}${escapeHtml(selectedVerificationText)} · ${selectedSample.length} 字符。这里显示的是完整样段，不是日志预览。</p>
      </header>
      <pre>${escapeHtml(selectedSample || "还没有选中的文风样段。")}</pre>
      ${freezePreview}
      ${rounds ? `<div class="style-sample-rounds"><h3>全部迭代样段</h3>${rounds}</div>` : ""}
    </section>`
	}

function renderChapterDraftText(run) {
  const draft = run?.result?.finalCandidate || run?.result?.draft || {}
  const text = String(draft.text || run?.rawResponse || "").trim()
  if (run?.nodeId !== CHAPTER_DRAFT_NODE) return '<div class="empty">当前节点没有正文候选。节点 11「单章完整生产」会在这里显示完整正文。</div>'
  const attempts = Array.isArray(run?.result?.productionFlow?.attempts) ? run.result.productionFlow.attempts : []
  const attemptRows = attempts.length
    ? `<div class="style-score-strip">${attempts.map((entry) => {
      const validation = entry.validation || {}
      const aigc = entry.aigc || {}
      return `<span>R${escapeHtml(entry.attempt || "—")} · ${validation.valid ? "通过" : "未过"} · AIGC ${escapeHtml(aigc.passed ? "通过" : "未过")} ${aigc.score !== undefined && aigc.score !== null ? escapeHtml(Number(aigc.score).toFixed(3)) : "—"} · ${escapeHtml(entry.charCount || 0)}字</span>`
    }).join("")}</div>`
    : ""
  return `
    <section class="style-sample-view chapter-draft-view">
      <header>
        <span class="eyebrow">FINAL CANDIDATE</span>
        <h3>第 ${escapeHtml(draft.chapterNumber || run?.input?.chapterNumber || "—")} 章最终正文候选</h3>
        <p>${escapeHtml(draft.title || "未命名章节")} · ${Number(draft.charCount || text.length)} 字符 · 第 ${escapeHtml(draft.attempt || attempts.length || 1)} 版。这里显示完整正文，不是日志预览。</p>
      </header>
      ${attemptRows}
      <pre>${escapeHtml(text || "尚未生成正文初稿。")}</pre>
    </section>`
}

function renderChapterCommitText(run) {
  if (run?.nodeId !== CHAPTER_COMMIT_NODE) return '<div class="empty">当前节点没有冻结正文。</div>'
  const frozen = run?.result?.frozenChapter || {}
  const text = String(frozen.text || "")
  return `
    <section class="style-sample-view chapter-draft-view">
      <header>
        <span class="eyebrow">FROZEN CHAPTER</span>
        <h3>第 ${escapeHtml(frozen.chapterNumber || run?.input?.chapterNumber || "—")} 章已冻结正文</h3>
        <p>${escapeHtml(frozen.title || "未命名章节")} · ${Number(frozen.charCount || text.length)} 字符 · 来源 Run：${escapeHtml(frozen.sourceDraftRunId || run?.input?.upstreamRunId || "—")}</p>
        <p>资产：${escapeHtml(frozen.assetPath || "—")}</p>
      </header>
      <pre>${escapeHtml(text || "尚未冻结正文。")}</pre>
    </section>`
}

function renderChapterLibrary() {
  const coverage = state.committedChapterCoverage || {}
  const assets = Array.isArray(coverage.assets) ? coverage.assets : []
  const chapters = Array.isArray(coverage.chapters) ? coverage.chapters : []
  const selectedChapter = Number(state.chapterReader.selectedChapter || chapters[0] || 0)
  const chapter = state.chapterReader.chapter || {}
  const text = String(chapter.text || "")
  const selectedAsset = assets.find((asset) => Number(asset.chapterNumber) === selectedChapter) || {}
  return `
    <section class="chapter-library">
      <aside class="chapter-library-sidebar">
        <header>
          <span class="eyebrow">CHAPTER ASSETS</span>
          <h3>已冻结章节</h3>
          <p>${chapters.length ? `共 ${chapters.length} 章，连续到第 ${escapeHtml(coverage.lastContinuousChapter || 0)} 章，下一章 ${escapeHtml(coverage.nextChapter || "—")}。` : "还没有冻结章节。"}</p>
        </header>
        <div class="chapter-library-list">
          ${assets.length
            ? assets.map((asset) => {
              const active = Number(asset.chapterNumber) === selectedChapter
              return `<button type="button" class="${active ? "active" : ""}" data-read-chapter="${escapeHtml(asset.chapterNumber)}">
                <span>第 ${escapeHtml(asset.chapterNumber)} 章</span>
                <strong>${escapeHtml(asset.title || "未命名章节")}</strong>
                <small>${escapeHtml(asset.charCount || 0)} 字符</small>
              </button>`
            }).join("")
            : '<div class="empty compact">暂无冻结章节。先运行第 12 或第 13。</div>'}
        </div>
      </aside>
      <article class="chapter-reader">
        <header>
          <div>
            <span class="eyebrow">READING VIEW</span>
            <h3>${selectedChapter ? `第 ${escapeHtml(selectedChapter)} 章 · ${escapeHtml(chapter.title || selectedAsset.title || "点击左侧章节读取")}` : "选择章节阅读"}</h3>
            <p>${chapter.charCount || selectedAsset.charCount ? `${escapeHtml(chapter.charCount || selectedAsset.charCount)} 字符` : "点击左侧章节后，这里显示完整正文。"}${chapter.sourceDraftRunId ? ` · 来源 ${escapeHtml(chapter.sourceDraftRunId)}` : ""}</p>
          </div>
          <button type="button" data-copy-chapter-text ${text ? "" : "disabled"}>复制正文</button>
        </header>
        ${state.chapterReader.loading
          ? '<div class="empty">正在读取章节正文…</div>'
          : state.chapterReader.error
            ? `<div class="validation-fail">读取失败：${escapeHtml(state.chapterReader.error)}</div>`
            : text
              ? `<pre>${escapeHtml(text)}</pre>`
              : '<div class="empty">请从左侧选择一章。</div>'}
      </article>
    </section>`
}

function renderChapterReviewSummary() {
  const report = state.chapterReview.report
  if (state.chapterReview.loading) return '<div class="empty">正在读取章节库、蓝图和门禁日志…</div>'
  if (state.chapterReview.error) return `<div class="validation-fail">读取失败：${escapeHtml(state.chapterReview.error)}</div>`
  if (!report) return '<div class="empty">点击左侧“读取并生成复盘”，这里会显示当前已写章节是否符合主线和世界观。</div>'
  const summary = report.summary || {}
  const blocker = report.nextChapterBlocker || null
  const chapterRows = Array.isArray(report.chapters) ? report.chapters : []
  const issueRows = Array.isArray(report.issueHighlights) ? report.issueHighlights : []
  return `
    <section class="chapter-review-board">
      <header>
        <div>
          <span class="eyebrow">READING REVIEW</span>
          <h3>${escapeHtml(summary.verdict || "已生成阅读复盘")}</h3>
          <p>${escapeHtml(summary.currentStoryPosition || "已读取冻结章节。")}</p>
        </div>
        <button type="button" data-copy-review-json>复制复盘 JSON</button>
      </header>
      <div class="review-metrics">
        <div><dt>已检查</dt><dd>第 ${escapeHtml(report.range?.firstChapter || "—")}-${escapeHtml(report.range?.lastChapter || "—")} 章</dd></div>
        <div><dt>冻结覆盖</dt><dd>${escapeHtml(report.coverage?.count || 0)} 章 / 连续到 ${escapeHtml(report.coverage?.lastContinuousChapter || 0)}</dd></div>
        <div><dt>下一章</dt><dd>第 ${escapeHtml(report.coverage?.nextChapter || "—")} 章</dd></div>
        <div><dt>检查结论</dt><dd>${escapeHtml(summary.mainlineFit || "—")} / ${escapeHtml(summary.worldviewFit || "—")}</dd></div>
      </div>
      <article class="review-block">
        <h4>当前情节</h4>
        <p>${escapeHtml(summary.plotNow || "—")}</p>
      </article>
      <article class="review-block">
        <h4>主线/世界观判断</h4>
        <ul>
          ${(summary.assessments || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>暂无判断。</li>"}
        </ul>
      </article>
      ${blocker ? `<article class="review-block warning">
        <h4>当前停止点</h4>
        <p>${escapeHtml(blocker.summary || "下一章还未通过。")}</p>
        ${(blocker.errors || []).length ? `<ul>${blocker.errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      </article>` : ""}
      <div class="review-two-col">
        <article class="review-block">
          <h4>需要人工关注</h4>
          ${issueRows.length
            ? `<ul>${issueRows.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
            : "<p>未发现必须立即清理的问题。</p>"}
        </article>
        <article class="review-block">
          <h4>建议下一步</h4>
          <ul>${(summary.nextActions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>
      </div>
      <div class="review-chapter-list">
        ${chapterRows.map((chapter) => `<article class="${chapter.valid === false ? "invalid" : "valid"}">
          <span>第 ${escapeHtml(chapter.chapterNumber)} 章</span>
          <strong>${escapeHtml(chapter.title || "未命名")}</strong>
          <p>${escapeHtml(chapter.blueprintGoal || "")}</p>
          <small>${escapeHtml(chapter.warningSummary || "无阻断问题")}</small>
        </article>`).join("")}
      </div>
    </section>`
}

function setJsonTreeExpanded(expanded) {
  $$("#evidence-content .json-branch").forEach((branch) => { branch.open = expanded })
  $$("#evidence-content .json-long-string").forEach((branch) => { branch.open = expanded })
}

async function copyCurrentJsonViewer() {
  const raw = $("#evidence-content [data-json-raw]")?.textContent || ""
  if (!raw) return
  await navigator.clipboard.writeText(raw)
}

function setJsonViewerMode(mode) {
  const tree = $("#evidence-content [data-json-tree]")
  const raw = $("#evidence-content [data-json-raw]")
  const rawButton = $("#evidence-content [data-json-action='raw']")
  const treeButton = $("#evidence-content [data-json-action='tree']")
  const expandButton = $("#evidence-content [data-json-action='expand']")
  const collapseButton = $("#evidence-content [data-json-action='collapse']")
  if (!tree || !raw) return
  const showRaw = mode === "raw"
  tree.hidden = showRaw
  raw.hidden = !showRaw
  if (rawButton) rawButton.hidden = showRaw
  if (treeButton) treeButton.hidden = !showRaw
  if (expandButton) expandButton.hidden = showRaw
  if (collapseButton) collapseButton.hidden = showRaw
}

function filterJsonTree(query) {
  const tree = $("#evidence-content .json-tree")
  const counter = $("#json-match-count")
  if (!tree || !counter) return
  const normalized = query.trim().toLocaleLowerCase()
  const allNodes = Array.from(tree.querySelectorAll(".json-node"))

  if (!normalized) {
    allNodes.forEach((node) => {
      node.hidden = false
      node.classList.remove("json-match")
      node.querySelector(":scope > summary")?.classList.remove("json-match")
    })
    counter.textContent = `${allNodes.length} 个节点`
    return
  }

  let matchCount = 0
  const visit = (node, ancestorMatched = false) => {
    const isBranch = node.classList.contains("json-branch")
    const label = isBranch ? node.querySelector(":scope > summary") : node
    const selfMatched = Boolean(label?.textContent.toLocaleLowerCase().includes(normalized))
    if (selfMatched) matchCount += 1
    label?.classList.toggle("json-match", selfMatched)

    let childMatched = false
    if (isBranch) {
      const children = Array.from(node.querySelector(":scope > .json-children")?.children || [])
      children.forEach((child) => {
        if (visit(child, ancestorMatched || selfMatched)) childMatched = true
      })
    }

    const visible = ancestorMatched || selfMatched || childMatched
    node.hidden = !visible
    if (isBranch && visible) node.open = true
    return visible
  }

  Array.from(tree.children).forEach((node) => visit(node))
  counter.textContent = matchCount ? `${matchCount} 处匹配` : "无匹配"
}

function evidenceText(tab) {
  const run = activeRun()
  if (tab === "chapters") return renderChapterLibrary()
  if (state.activeNode === CHAPTER_REVIEW_NODE) {
    if (tab === "input") return renderJsonTree(chapterReviewFormInput())
    if (tab === "sample" || tab === "validation") return renderChapterReviewSummary()
    if (tab === "result") return state.chapterReview.report ? renderJsonTree(state.chapterReview.report) : renderChapterReviewSummary()
    if (tab === "workflow") return '<div class="empty">阅读复盘是本地只读检查，不创建模型 Run，也不推进正式工作流。</div>'
    return '<div class="empty">阅读复盘节点不调用模型，因此没有 Prompt、原始响应、正典审计或学习记忆。</div>'
  }
  if (!run) return '<div class="empty">启动后，这里会显示本次运行的完整证据。</div>'
  if (tab === "input") return renderJsonTree(run.input)
  if (tab === "sample") return run.nodeId === CHAPTER_DRAFT_NODE ? renderChapterDraftText(run) : run.nodeId === CHAPTER_COMMIT_NODE ? renderChapterCommitText(run) : renderStyleEvolutionSamples(run)
  if (tab === "prompt") {
    if (!run.prompts) return '<div class="empty">Prompt 尚未冻结。</div>'
    return `
      <div class="prompt-block"><h3>最终 System Prompt（实际发送）</h3><pre>${escapeHtml(run.prompts.systemPrompt || "")}</pre></div>
      <div class="prompt-block"><h3>User Message（实际发送）</h3><pre>${escapeHtml(run.prompts.userMessage)}</pre></div>
      <div class="prompt-block"><h3>Base Prompt 组件</h3><pre>${escapeHtml(run.prompts.basePrompt)}</pre></div>
      <div class="prompt-block"><h3>Dynamic Prompt 组件（含锁定的上游数据）</h3><pre>${escapeHtml(run.prompts.dynamicPrompt)}</pre></div>`
  }
  if (tab === "raw") return run.rawResponse ? `<pre>${escapeHtml(run.rawResponse)}</pre>` : '<div class="empty">等待模型原始响应。</div>'
  if (tab === "result") return run.result ? renderJsonTree(run.result) : '<div class="empty">尚未解析出结构化结果。</div>'
  if (tab === "audit") return run.semanticAudit ? renderJsonTree(run.semanticAudit) : '<div class="empty">本次 Run 没有独立正典语义审计，因此不能被批准。</div>'
  if (tab === "learning") return run.learning ? renderJsonTree(run.learning) : '<div class="empty">本次 Run 尚未加载 Learning Loop 记忆。</div>'
  if (tab === "workflow") {
    if (!run.workflowTrace) return '<div class="empty">这是接入统一工作流记录前创建的旧 Run，没有 FactoryDB 轨迹。</div>'
    return renderJsonTree({
      trace: run.workflowTrace,
      run: run.workflowEvidence?.run || null,
      steps: run.workflowEvidence?.steps || [],
      attempts: run.workflowEvidence?.attempts || [],
      debugBranch: run.workflowBranchEvidence || (run.workflowBranch ? { reference: run.workflowBranch } : null),
    })
  }
  if (!run.validation) return '<div class="empty">等待结构验证。</div>'
  const summary = isChapterAuditPending(run)
    ? '<div class="validation-pass">✓ 章节蓝图结构验证通过，正在等待独立正典语义审计；现有蓝图尚未被标记为完整通过。</div>'
    : run.validation.valid
    ? `<div class="validation-pass">✓ ${state.activeNode === CHAPTER_BLUEPRINTS_NODE ? "结构与独立正典语义审计均通过" : "结构验证通过"}。本次结果可以进入人工审阅，但尚未应用到正式项目。</div>`
    : '<div class="validation-fail">✕ 结构验证失败。此次 run 不会被标记为成功。</div>'
  const issues = [...run.validation.errors.map((item) => `错误：${item}`), ...run.validation.warnings.map((item) => `警告：${item}`)]
  return `${summary}${issues.length ? `<ul class="validation-list">${issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}`
}

function renderEvidence() {
  $("#evidence-content").innerHTML = evidenceText(state.activeTab)
}

function renderAll() {
  renderNodeNavigation()
  renderModelSwitcher()
  renderProjectBinding()
  renderProductionSandbox()
  renderUpstream()
  renderStatus()
  renderStyleSampleMonitor()
  renderEvents()
  renderEvidence()
  syncFormState()
}

function stopPolling(nodeId) {
  if (state.pollTimers[nodeId]) window.clearInterval(state.pollTimers[nodeId])
  state.pollTimers[nodeId] = null
}

async function pollRun(nodeId) {
  const runId = state.runIds[nodeId]
  if (!runId) return
  try {
    state.runs[nodeId] = await api(`/runs/${encodeURIComponent(runId)}`)
    renderAll()
    if (TERMINAL_STATUSES.includes(state.runs[nodeId].status)) {
      stopPolling(nodeId)
      if (nodeId === CHAPTER_BLUEPRINTS_NODE) {
        await refreshChapterBlueprintHistory()
        renderAll()
      }
      if (nodeId === CHAPTER_COMMIT_NODE || nodeId === CONTINUOUS_CHAPTER_NODE) {
        await refreshCommittedChapterCoverage()
        renderAll()
      }
    }
  } catch (error) {
    stopPolling(nodeId)
    setService("offline", `读取 Run 失败：${error.message}`)
  }
}

async function pauseActiveRun() {
  const nodeId = state.activeNode
  const run = state.runs[nodeId]
  if (!run?.runId || !["queued", "running"].includes(run.status)) return
  run.pauseRequestedAt = new Date().toISOString()
  renderAll()
  try {
    const paused = await api(`/runs/${encodeURIComponent(run.runId)}/pause`, {
      method: "POST",
      body: { reason: "用户需要暂停当前运行并切换模型。" },
    })
    state.runs[nodeId] = { ...run, ...paused, status: paused.status || "paused" }
    await pollRun(nodeId)
  } catch (error) {
    run.pauseRequestedAt = null
    setService("offline", `暂停失败：${error.message}`)
    renderAll()
  }
}

function startPolling(nodeId) {
  stopPolling(nodeId)
  state.pollTimers[nodeId] = window.setInterval(() => pollRun(nodeId), 650)
}

function rememberRun(nodeId, runId) {
  state.runIds[nodeId] = runId
  window.localStorage.setItem(`flow-debug.run.${nodeId}`, runId)
}

function clearChapterBlueprintRun() {
  stopPolling(CHAPTER_COMMIT_NODE)
  state.runs[CHAPTER_COMMIT_NODE] = null
  state.runIds[CHAPTER_COMMIT_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${CHAPTER_COMMIT_NODE}`)
  stopPolling(CHAPTER_DRAFT_NODE)
  state.runs[CHAPTER_DRAFT_NODE] = null
  state.runIds[CHAPTER_DRAFT_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${CHAPTER_DRAFT_NODE}`)
  stopPolling(SINGLE_CHAPTER_CONTEXT_NODE)
  state.runs[SINGLE_CHAPTER_CONTEXT_NODE] = null
  state.runIds[SINGLE_CHAPTER_CONTEXT_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${SINGLE_CHAPTER_CONTEXT_NODE}`)
  stopPolling(STYLE_PROFILE_NODE)
  state.runs[STYLE_PROFILE_NODE] = null
  state.runIds[STYLE_PROFILE_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${STYLE_PROFILE_NODE}`)
  stopPolling(CHAPTER_BLUEPRINTS_NODE)
  state.runs[CHAPTER_BLUEPRINTS_NODE] = null
  state.runIds[CHAPTER_BLUEPRINTS_NODE] = null
  state.chapterBlueprintHistory = []
  window.localStorage.removeItem(`flow-debug.run.${CHAPTER_BLUEPRINTS_NODE}`)
}

function clearVolumeStrategyRun() {
  clearChapterBlueprintRun()
  stopPolling(VOLUME_STRATEGY_NODE)
  state.runs[VOLUME_STRATEGY_NODE] = null
  state.runIds[VOLUME_STRATEGY_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${VOLUME_STRATEGY_NODE}`)
}

async function startWorldRun(event) {
  event.preventDefault()
  const input = worldFormInput()
  if (!input.title || input.coreIdea.length < 20) return
  if (!input.factoryProjectId) {
    state.runs[WORLD_NODE] = {
      nodeId: WORLD_NODE,
      status: "failed",
      runId: null,
      input,
      events: [{ at: new Date().toISOString(), level: "error", message: "运行调试节点前必须先绑定小说工厂项目。" }],
      provider: null,
      error: "运行调试节点前必须先绑定小说工厂项目；请先在顶部项目下拉框选择项目。",
    }
    renderAll()
    return
  }
  stopPolling(WORLD_NODE)
  clearVolumeStrategyRun()
  state.runs[WORLD_NODE] = { nodeId: WORLD_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.runs[CHARACTER_NODE] = null
  state.runIds[CHARACTER_NODE] = null
  state.runs[INITIAL_STATE_NODE] = null
  state.runIds[INITIAL_STATE_NODE] = null
  state.runs[WORLD_MATRIX_NODE] = null
  state.runIds[WORLD_MATRIX_NODE] = null
  state.runs[PLOT_ARCHITECTURE_NODE] = null
  state.runIds[PLOT_ARCHITECTURE_NODE] = null
  state.runs[STORY_BIBLE_NODE] = null
  state.runIds[STORY_BIBLE_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${CHARACTER_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${INITIAL_STATE_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${WORLD_MATRIX_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${PLOT_ARCHITECTURE_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${STORY_BIBLE_NODE}`)
  state.lastEventCount[WORLD_NODE] = 0
  renderAll()
  try {
    const created = await api("/runs", { method: "POST", body: input })
    rememberRun(WORLD_NODE, created.runId)
    state.runs[WORLD_NODE].runId = created.runId
    renderAll()
    await pollRun(WORLD_NODE)
    startPolling(WORLD_NODE)
  } catch (error) {
    state.runs[WORLD_NODE] = { nodeId: WORLD_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startCharacterRun(event) {
  event.preventDefault()
  const input = characterFormInput()
  const worldRun = state.runs[WORLD_NODE]
  if (!input.upstreamRunId || worldRun?.status !== "completed") return
  stopPolling(CHARACTER_NODE)
  clearVolumeStrategyRun()
  state.runs[CHARACTER_NODE] = { nodeId: CHARACTER_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.runs[INITIAL_STATE_NODE] = null
  state.runIds[INITIAL_STATE_NODE] = null
  state.runs[WORLD_MATRIX_NODE] = null
  state.runIds[WORLD_MATRIX_NODE] = null
  state.runs[PLOT_ARCHITECTURE_NODE] = null
  state.runIds[PLOT_ARCHITECTURE_NODE] = null
  state.runs[STORY_BIBLE_NODE] = null
  state.runIds[STORY_BIBLE_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${INITIAL_STATE_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${WORLD_MATRIX_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${PLOT_ARCHITECTURE_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${STORY_BIBLE_NODE}`)
  state.lastEventCount[CHARACTER_NODE] = 0
  renderAll()
  try {
    const created = await api("/character-runs", { method: "POST", body: input })
    rememberRun(CHARACTER_NODE, created.runId)
    state.runs[CHARACTER_NODE].runId = created.runId
    renderAll()
    await pollRun(CHARACTER_NODE)
    startPolling(CHARACTER_NODE)
  } catch (error) {
    state.runs[CHARACTER_NODE] = { nodeId: CHARACTER_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startInitialStateRun(event) {
  event.preventDefault()
  const input = initialStateFormInput()
  const characterRun = state.runs[CHARACTER_NODE]
  if (!input.upstreamRunId || characterRun?.status !== "completed") return
  stopPolling(INITIAL_STATE_NODE)
  clearVolumeStrategyRun()
  state.runs[INITIAL_STATE_NODE] = { nodeId: INITIAL_STATE_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.runs[WORLD_MATRIX_NODE] = null
  state.runIds[WORLD_MATRIX_NODE] = null
  state.runs[PLOT_ARCHITECTURE_NODE] = null
  state.runIds[PLOT_ARCHITECTURE_NODE] = null
  state.runs[STORY_BIBLE_NODE] = null
  state.runIds[STORY_BIBLE_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${WORLD_MATRIX_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${PLOT_ARCHITECTURE_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${STORY_BIBLE_NODE}`)
  state.lastEventCount[INITIAL_STATE_NODE] = 0
  renderAll()
  try {
    const created = await api("/initial-state-runs", { method: "POST", body: input })
    rememberRun(INITIAL_STATE_NODE, created.runId)
    state.runs[INITIAL_STATE_NODE].runId = created.runId
    renderAll()
    await pollRun(INITIAL_STATE_NODE)
    startPolling(INITIAL_STATE_NODE)
  } catch (error) {
    state.runs[INITIAL_STATE_NODE] = { nodeId: INITIAL_STATE_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startWorldMatrixRun(event) {
  event.preventDefault()
  const input = worldMatrixFormInput()
  const initialRun = state.runs[INITIAL_STATE_NODE]
  if (!input.upstreamRunId || initialRun?.status !== "completed") return
  stopPolling(WORLD_MATRIX_NODE)
  clearVolumeStrategyRun()
  state.runs[WORLD_MATRIX_NODE] = { nodeId: WORLD_MATRIX_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.runs[PLOT_ARCHITECTURE_NODE] = null
  state.runIds[PLOT_ARCHITECTURE_NODE] = null
  state.runs[STORY_BIBLE_NODE] = null
  state.runIds[STORY_BIBLE_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${PLOT_ARCHITECTURE_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${STORY_BIBLE_NODE}`)
  state.lastEventCount[WORLD_MATRIX_NODE] = 0
  renderAll()
  try {
    const created = await api("/world-matrix-runs", { method: "POST", body: input })
    rememberRun(WORLD_MATRIX_NODE, created.runId)
    state.runs[WORLD_MATRIX_NODE].runId = created.runId
    renderAll()
    await pollRun(WORLD_MATRIX_NODE)
    startPolling(WORLD_MATRIX_NODE)
  } catch (error) {
    state.runs[WORLD_MATRIX_NODE] = { nodeId: WORLD_MATRIX_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startPlotArchitectureRun(event) {
  event.preventDefault()
  const input = plotArchitectureFormInput()
  const matrixRun = state.runs[WORLD_MATRIX_NODE]
  if (!input.upstreamRunId || matrixRun?.status !== "completed") return
  stopPolling(PLOT_ARCHITECTURE_NODE)
  clearVolumeStrategyRun()
  state.runs[PLOT_ARCHITECTURE_NODE] = { nodeId: PLOT_ARCHITECTURE_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.runs[STORY_BIBLE_NODE] = null
  state.runIds[STORY_BIBLE_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${STORY_BIBLE_NODE}`)
  state.lastEventCount[PLOT_ARCHITECTURE_NODE] = 0
  renderAll()
  try {
    const created = await api("/plot-architecture-runs", { method: "POST", body: input })
    rememberRun(PLOT_ARCHITECTURE_NODE, created.runId)
    state.runs[PLOT_ARCHITECTURE_NODE].runId = created.runId
    renderAll()
    await pollRun(PLOT_ARCHITECTURE_NODE)
    startPolling(PLOT_ARCHITECTURE_NODE)
  } catch (error) {
    state.runs[PLOT_ARCHITECTURE_NODE] = { nodeId: PLOT_ARCHITECTURE_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startStoryBibleRun(event) {
  event.preventDefault()
  const input = storyBibleFormInput()
  const plotRun = state.runs[PLOT_ARCHITECTURE_NODE]
  if (!input.upstreamRunId || plotRun?.status !== "completed") return
  stopPolling(STORY_BIBLE_NODE)
  clearVolumeStrategyRun()
  state.runs[STORY_BIBLE_NODE] = { nodeId: STORY_BIBLE_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.lastEventCount[STORY_BIBLE_NODE] = 0
  renderAll()
  try {
    const created = await api("/story-bible-runs", { method: "POST", body: input })
    rememberRun(STORY_BIBLE_NODE, created.runId)
    state.runs[STORY_BIBLE_NODE].runId = created.runId
    renderAll()
    await pollRun(STORY_BIBLE_NODE)
    startPolling(STORY_BIBLE_NODE)
  } catch (error) {
    state.runs[STORY_BIBLE_NODE] = { nodeId: STORY_BIBLE_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startVolumeStrategyRun(event) {
  event.preventDefault()
  const input = volumeStrategyFormInput()
  const bibleRun = state.runs[STORY_BIBLE_NODE]
  const arcCount = Array.isArray(bibleRun?.input?.plotArchitecture?.arcArchitecture) ? bibleRun.input.plotArchitecture.arcArchitecture.length : 0
  if (!input.upstreamRunId || bibleRun?.status !== "completed" || !Number.isInteger(input.targetVolumeCount) || input.targetVolumeCount < Math.min(2, arcCount) || input.targetVolumeCount > Math.min(12, arcCount)) return
  stopPolling(VOLUME_STRATEGY_NODE)
  clearChapterBlueprintRun()
  state.runs[VOLUME_STRATEGY_NODE] = { nodeId: VOLUME_STRATEGY_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.lastEventCount[VOLUME_STRATEGY_NODE] = 0
  renderAll()
  try {
    const created = await api("/volume-strategy-runs", { method: "POST", body: input })
    rememberRun(VOLUME_STRATEGY_NODE, created.runId)
    state.runs[VOLUME_STRATEGY_NODE].runId = created.runId
    renderAll()
    await pollRun(VOLUME_STRATEGY_NODE)
    startPolling(VOLUME_STRATEGY_NODE)
  } catch (error) {
    state.runs[VOLUME_STRATEGY_NODE] = { nodeId: VOLUME_STRATEGY_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startChapterBlueprintRun(event) {
  event.preventDefault()
  let input = chapterBlueprintFormInput()
  const volumeRun = state.runs[VOLUME_STRATEGY_NODE]
  let volume = Array.isArray(volumeRun?.result?.volumes)
    ? volumeRun.result.volumes.find((entry) => entry.id === input.volumeId)
    : null
  const coverage = volume ? chapterBlueprintCoverageFor(volume) : null
  if (volume && Number.isInteger(coverage?.firstMissing) && input.startChapter !== coverage.firstMissing) {
    const requestedCount = input.endChapter - input.startChapter + 1
    const batchSize = Number.isInteger(requestedCount) && requestedCount >= 1 ? Math.min(requestedCount, CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT) : CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT
    $("#chapter-blueprints-start-chapter").value = String(coverage.firstMissing)
    $("#chapter-blueprints-end-chapter").value = String(Math.min(coverage.firstMissing + batchSize - 1, Number(volume.endChapter)))
    $("#chapter-blueprints-volume-id").dataset.nextRangeSignature = `${state.runIds[VOLUME_STRATEGY_NODE] || "none"}:${volume.id}:${coverage.firstMissing}`
    input = chapterBlueprintFormInput()
    volume = volumeRun.result.volumes.find((entry) => entry.id === input.volumeId)
  }
  const batchCount = input.endChapter - input.startChapter + 1
  if (!input.upstreamRunId
    || volumeRun?.status !== "completed"
    || !volumeRun?.validation?.valid
    || !volume
    || !Number.isInteger(input.startChapter)
    || !Number.isInteger(input.endChapter)
    || input.startChapter < Number(volume.startChapter)
    || input.endChapter > Number(volume.endChapter)
    || batchCount < 1
    || batchCount > CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT
    || !Number.isInteger(input.targetWordCount)
    || input.targetWordCount < 1000
    || input.targetWordCount > 10000
    || coverage?.firstMissing === undefined) return
  stopPolling(CHAPTER_BLUEPRINTS_NODE)
  state.runs[CHAPTER_BLUEPRINTS_NODE] = { nodeId: CHAPTER_BLUEPRINTS_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.lastEventCount[CHAPTER_BLUEPRINTS_NODE] = 0
  renderAll()
  try {
    const created = await api("/chapter-blueprint-runs", { method: "POST", body: input })
    rememberRun(CHAPTER_BLUEPRINTS_NODE, created.runId)
    state.runs[CHAPTER_BLUEPRINTS_NODE].runId = created.runId
    await refreshChapterBlueprintHistory()
    renderAll()
    await pollRun(CHAPTER_BLUEPRINTS_NODE)
    startPolling(CHAPTER_BLUEPRINTS_NODE)
  } catch (error) {
    state.runs[CHAPTER_BLUEPRINTS_NODE] = { nodeId: CHAPTER_BLUEPRINTS_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startStyleProfileRun(event) {
  event.preventDefault()
  const input = styleProfileFormInput()
  const chapterRun = state.runs[CHAPTER_BLUEPRINTS_NODE]
  const blueprints = Array.isArray(chapterRun?.result?.blueprints) ? chapterRun.result.blueprints : []
  if (!input.upstreamRunId || chapterRun?.status !== "completed" || !chapterRun?.validation?.valid || !blueprints.length) return
  stopPolling(SINGLE_CHAPTER_CONTEXT_NODE)
  stopPolling(CHAPTER_DRAFT_NODE)
  stopPolling(CHAPTER_COMMIT_NODE)
  state.runs[SINGLE_CHAPTER_CONTEXT_NODE] = null
  state.runIds[SINGLE_CHAPTER_CONTEXT_NODE] = null
  state.runs[CHAPTER_DRAFT_NODE] = null
  state.runIds[CHAPTER_DRAFT_NODE] = null
  state.runs[CHAPTER_COMMIT_NODE] = null
  state.runIds[CHAPTER_COMMIT_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${SINGLE_CHAPTER_CONTEXT_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${CHAPTER_DRAFT_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${CHAPTER_COMMIT_NODE}`)
  stopPolling(STYLE_PROFILE_NODE)
  state.runs[STYLE_PROFILE_NODE] = { nodeId: STYLE_PROFILE_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.lastEventCount[STYLE_PROFILE_NODE] = 0
  renderAll()
  try {
    const created = await api("/style-profile-runs", { method: "POST", body: input })
    rememberRun(STYLE_PROFILE_NODE, created.runId)
    state.runs[STYLE_PROFILE_NODE].runId = created.runId
    renderAll()
    await pollRun(STYLE_PROFILE_NODE)
    startPolling(STYLE_PROFILE_NODE)
  } catch (error) {
    state.runs[STYLE_PROFILE_NODE] = { nodeId: STYLE_PROFILE_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startStyleAigcCalibrationRun() {
  const input = styleProfileFormInput()
  const chapterRun = state.runs[CHAPTER_BLUEPRINTS_NODE]
  const blueprints = Array.isArray(chapterRun?.result?.blueprints) ? chapterRun.result.blueprints : []
  if (!input.upstreamRunId || chapterRun?.status !== "completed" || !chapterRun?.validation?.valid || !blueprints.length) return
  stopPolling(STYLE_PROFILE_NODE)
  state.runs[STYLE_PROFILE_NODE] = { nodeId: STYLE_PROFILE_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: { modelName: "AIGC calibration" } }
  state.lastEventCount[STYLE_PROFILE_NODE] = 0
  renderAll()
  try {
    const created = await api("/style-profile-aigc-calibration-runs", { method: "POST", body: input })
    rememberRun(STYLE_PROFILE_NODE, created.runId)
    state.runs[STYLE_PROFILE_NODE].runId = created.runId
    renderAll()
    await pollRun(STYLE_PROFILE_NODE)
    startPolling(STYLE_PROFILE_NODE)
  } catch (error) {
    state.runs[STYLE_PROFILE_NODE] = { nodeId: STYLE_PROFILE_NODE, status: "failed", runId: null, input, events: [], provider: { modelName: "AIGC calibration" }, error: error.message }
    renderAll()
  }
}

async function freezeStyleProfileCandidate() {
  const run = state.runs[STYLE_PROFILE_NODE]
  if (!run?.runId || run.status !== "completed" || run.validation?.valid !== true || !run.result?.selectedCandidate?.sample || run.result?.freeze?.status === "approved") return
  state.styleFreezeBusy = true
  renderAll()
  try {
    const frozen = await api(`/style-profile-runs/${encodeURIComponent(run.runId)}/freeze`, { method: "POST" })
    run.result = { ...(run.result || {}), freeze: frozen.freeze }
    await pollRun(STYLE_PROFILE_NODE)
    state.activeTab = "sample"
    $$("#evidence-tabs button").forEach((entry) => entry.classList.toggle("active", entry.dataset.tab === "sample"))
  } catch (error) {
    run.error = error.message
  } finally {
    state.styleFreezeBusy = false
    renderAll()
  }
}

async function startSingleChapterContextRun(event) {
  event.preventDefault()
  const input = singleChapterContextFormInput()
  const styleRun = state.runs[STYLE_PROFILE_NODE]
  if (!input.upstreamRunId || styleRun?.status !== "completed" || styleRun?.validation?.valid !== true || styleRun?.result?.freeze?.status !== "approved") return
  stopPolling(SINGLE_CHAPTER_CONTEXT_NODE)
  stopPolling(CHAPTER_DRAFT_NODE)
  stopPolling(CHAPTER_COMMIT_NODE)
  state.runs[CHAPTER_DRAFT_NODE] = null
  state.runIds[CHAPTER_DRAFT_NODE] = null
  state.runs[CHAPTER_COMMIT_NODE] = null
  state.runIds[CHAPTER_COMMIT_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${CHAPTER_DRAFT_NODE}`)
  window.localStorage.removeItem(`flow-debug.run.${CHAPTER_COMMIT_NODE}`)
  state.runs[SINGLE_CHAPTER_CONTEXT_NODE] = { nodeId: SINGLE_CHAPTER_CONTEXT_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: { modelName: "no-llm" } }
  state.lastEventCount[SINGLE_CHAPTER_CONTEXT_NODE] = 0
  renderAll()
  try {
    const created = await api("/single-chapter-context-runs", { method: "POST", body: input })
    rememberRun(SINGLE_CHAPTER_CONTEXT_NODE, created.runId)
    state.runs[SINGLE_CHAPTER_CONTEXT_NODE].runId = created.runId
    renderAll()
    await pollRun(SINGLE_CHAPTER_CONTEXT_NODE)
    startPolling(SINGLE_CHAPTER_CONTEXT_NODE)
  } catch (error) {
    state.runs[SINGLE_CHAPTER_CONTEXT_NODE] = { nodeId: SINGLE_CHAPTER_CONTEXT_NODE, status: "failed", runId: null, input, events: [], provider: { modelName: "no-llm" }, error: error.message }
    renderAll()
  }
}

async function startChapterDraftRun(event) {
  event.preventDefault()
  const input = chapterDraftFormInput()
  const contextRun = state.runs[SINGLE_CHAPTER_CONTEXT_NODE]
  if (!input.upstreamRunId || contextRun?.status !== "completed" || contextRun?.validation?.valid !== true || !selectedDebugModelId()) return
  stopPolling(CHAPTER_COMMIT_NODE)
  state.runs[CHAPTER_COMMIT_NODE] = null
  state.runIds[CHAPTER_COMMIT_NODE] = null
  window.localStorage.removeItem(`flow-debug.run.${CHAPTER_COMMIT_NODE}`)
  stopPolling(CHAPTER_DRAFT_NODE)
  state.runs[CHAPTER_DRAFT_NODE] = { nodeId: CHAPTER_DRAFT_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
  state.lastEventCount[CHAPTER_DRAFT_NODE] = 0
  renderAll()
  try {
    const created = await api("/chapter-draft-runs", { method: "POST", body: input })
    rememberRun(CHAPTER_DRAFT_NODE, created.runId)
    state.runs[CHAPTER_DRAFT_NODE].runId = created.runId
    renderAll()
    await pollRun(CHAPTER_DRAFT_NODE)
    startPolling(CHAPTER_DRAFT_NODE)
  } catch (error) {
    state.runs[CHAPTER_DRAFT_NODE] = { nodeId: CHAPTER_DRAFT_NODE, status: "failed", runId: null, input, events: [], provider: null, error: error.message }
    renderAll()
  }
}

async function startChapterCommitRun(event) {
  event.preventDefault()
  const input = chapterCommitFormInput()
  const draftRun = state.runs[CHAPTER_DRAFT_NODE]
  if (!input.upstreamRunId || draftRun?.status !== "completed" || draftRun?.validation?.valid !== true) return
  stopPolling(CHAPTER_COMMIT_NODE)
  state.runs[CHAPTER_COMMIT_NODE] = { nodeId: CHAPTER_COMMIT_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: { modelName: "no-llm" } }
  state.lastEventCount[CHAPTER_COMMIT_NODE] = 0
  renderAll()
  try {
    const created = await api("/chapter-commit-runs", { method: "POST", body: input })
    rememberRun(CHAPTER_COMMIT_NODE, created.runId)
    state.runs[CHAPTER_COMMIT_NODE].runId = created.runId
    renderAll()
    await pollRun(CHAPTER_COMMIT_NODE)
    await refreshCommittedChapterCoverage()
    startPolling(CHAPTER_COMMIT_NODE)
  } catch (error) {
    state.runs[CHAPTER_COMMIT_NODE] = { nodeId: CHAPTER_COMMIT_NODE, status: "failed", runId: null, input, events: [], provider: { modelName: "no-llm" }, error: error.message }
    renderAll()
  }
}

async function startContinuousChapterRun(event) {
  event.preventDefault()
  const input = continuousChapterFormInput()
  const styleRun = state.runs[STYLE_PROFILE_NODE]
  if (!input.upstreamRunId || styleRun?.status !== "completed" || styleRun?.validation?.valid !== true || styleRun?.result?.freeze?.status !== "approved" || !selectedDebugModelId()) return
  stopPolling(CONTINUOUS_CHAPTER_NODE)
  state.runs[CONTINUOUS_CHAPTER_NODE] = { nodeId: CONTINUOUS_CHAPTER_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: { modelName: "workflow-orchestrator" } }
  state.lastEventCount[CONTINUOUS_CHAPTER_NODE] = 0
  renderAll()
  try {
    const created = await api("/continuous-chapter-production-runs", { method: "POST", body: input })
    rememberRun(CONTINUOUS_CHAPTER_NODE, created.runId)
    state.runs[CONTINUOUS_CHAPTER_NODE].runId = created.runId
    renderAll()
    await pollRun(CONTINUOUS_CHAPTER_NODE)
    await refreshCommittedChapterCoverage()
    startPolling(CONTINUOUS_CHAPTER_NODE)
  } catch (error) {
    state.runs[CONTINUOUS_CHAPTER_NODE] = { nodeId: CONTINUOUS_CHAPTER_NODE, status: "failed", runId: null, input, events: [], provider: { modelName: "workflow-orchestrator" }, error: error.message }
    renderAll()
  }
}

function updateContinuousChapterAutoRun(message) {
  state.continuousChapterAutoRun.lastMessage = message
  renderAll()
}

async function waitForContinuousChapterRunTerminal(runId) {
  while (true) {
    const run = await api(`/runs/${encodeURIComponent(runId)}`)
    state.runs[CONTINUOUS_CHAPTER_NODE] = run
    renderAll()
    if (TERMINAL_STATUSES.includes(run.status)) return run
    await sleep(1200)
  }
}

async function startContinuousChapterAutoRun() {
  const styleRun = state.runs[STYLE_PROFILE_NODE]
  if (state.continuousChapterAutoRun.active || styleRun?.status !== "completed" || styleRun?.validation?.valid !== true || styleRun?.result?.freeze?.status !== "approved" || !selectedDebugModelId()) return
  const volumeRange = firstVolumeRangeFromStyleRun(styleRun)
  state.continuousChapterAutoRun = { active: true, stopRequested: false, completedBatches: 0, lastMessage: `准备自动续跑到 ${volumeRange.title} 第 ${volumeRange.endChapter} 章。` }
  renderAll()
  try {
    while (!state.continuousChapterAutoRun.stopRequested) {
      await refreshCommittedChapterCoverage()
      const coverage = state.committedChapterCoverage || {}
      const nextChapter = Math.max(Number(coverage.nextChapter || volumeRange.startChapter), volumeRange.startChapter)
      if (nextChapter > volumeRange.endChapter) {
        updateContinuousChapterAutoRun(`${volumeRange.title} 已完成：连续冻结到第 ${Number(coverage.lastContinuousChapter || volumeRange.endChapter)} 章。`)
        break
      }
      const batchStart = nextChapter
      const batchEnd = Math.min(batchStart + 2, volumeRange.endChapter)
      $("#continuous-chapter-start").value = String(batchStart)
      $("#continuous-chapter-end").value = String(batchEnd)
      const input = continuousChapterFormInput()
      updateContinuousChapterAutoRun(`正在自动续跑第 ${batchStart}-${batchEnd} 章；已完成 ${state.continuousChapterAutoRun.completedBatches} 批。`)
      stopPolling(CONTINUOUS_CHAPTER_NODE)
      state.runs[CONTINUOUS_CHAPTER_NODE] = { nodeId: CONTINUOUS_CHAPTER_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: { modelName: "workflow-orchestrator" } }
      state.lastEventCount[CONTINUOUS_CHAPTER_NODE] = 0
      renderAll()
      const created = await api("/continuous-chapter-production-runs", { method: "POST", body: input })
      rememberRun(CONTINUOUS_CHAPTER_NODE, created.runId)
      state.runs[CONTINUOUS_CHAPTER_NODE].runId = created.runId
      renderAll()
      const terminalRun = await waitForContinuousChapterRunTerminal(created.runId)
      await refreshCommittedChapterCoverage()
      if (terminalRun.status !== "completed" || terminalRun.validation?.valid !== true) {
        updateContinuousChapterAutoRun(`自动续跑停止：第 ${batchStart}-${batchEnd} 章未通过，请查看当前 Run 日志。`)
        break
      }
      state.continuousChapterAutoRun.completedBatches += 1
      updateContinuousChapterAutoRun(`第 ${batchStart}-${batchEnd} 章已完成并冻结，准备扫描下一批。`)
      await sleep(800)
    }
    if (state.continuousChapterAutoRun.stopRequested) updateContinuousChapterAutoRun("自动续跑已停止；当前批次结束后不再继续。")
  } catch (error) {
    updateContinuousChapterAutoRun(`自动续跑异常停止：${error.message}`)
  } finally {
    state.continuousChapterAutoRun.active = false
    state.continuousChapterAutoRun.stopRequested = false
    await refreshCommittedChapterCoverage()
    renderAll()
  }
}

function stopContinuousChapterAutoRun() {
  if (!state.continuousChapterAutoRun.active) return
  state.continuousChapterAutoRun.stopRequested = true
  updateContinuousChapterAutoRun("已请求停止自动续跑；当前批次结束后停止。")
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function updateChapterBlueprintAutoRun(message) {
  state.chapterBlueprintAutoRun.lastMessage = message
  renderAll()
}

async function waitForChapterBlueprintRunTerminal(runId) {
  while (true) {
    const run = await api(`/runs/${encodeURIComponent(runId)}`)
    state.runs[CHAPTER_BLUEPRINTS_NODE] = run
    renderAll()
    if (TERMINAL_STATUSES.includes(run.status)) {
      await refreshChapterBlueprintHistory()
      renderAll()
      return run
    }
    await sleep(1000)
  }
}

async function startChapterBlueprintAutoRun() {
  if (state.chapterBlueprintAutoRun.active) {
    state.chapterBlueprintAutoRun.stopRequested = true
    updateChapterBlueprintAutoRun("已收到停止请求；当前批次会继续等到终态，之后不再启动下一批。")
    return
  }
  const volumeRun = state.runs[VOLUME_STRATEGY_NODE]
  const selectedVolume = selectedChapterBlueprintVolume()
  if (volumeRun?.status !== "completed" || !volumeRun?.validation?.valid || !selectedVolume) return
  stopPolling(CHAPTER_BLUEPRINTS_NODE)
  state.chapterBlueprintAutoRun = { active: true, stopRequested: false, completedBatches: 0, lastMessage: "准备读取章节覆盖进度。" }
  renderAll()
  try {
    while (!state.chapterBlueprintAutoRun.stopRequested) {
      await refreshChapterBlueprintHistory()
      const volume = selectedChapterBlueprintVolume()
      const coverage = volume ? chapterBlueprintCoverageFor(volume) : null
      if (!volume || !coverage) {
        updateChapterBlueprintAutoRun("没有找到当前卷，自动生成已停止。")
        break
      }
      if (coverage.firstMissing === undefined) {
        updateChapterBlueprintAutoRun(`本卷第 ${coverage.volumeStart}-${coverage.volumeEnd} 章已经全部通过。`)
        break
      }
      const startChapter = coverage.firstMissing
      const endChapter = Math.min(startChapter + CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT - 1, coverage.volumeEnd)
      $("#chapter-blueprints-start-chapter").value = String(startChapter)
      $("#chapter-blueprints-end-chapter").value = String(endChapter)
      $("#chapter-blueprints-volume-id").dataset.nextRangeSignature = `${state.runIds[VOLUME_STRATEGY_NODE] || "none"}:${volume.id}:${startChapter}`
      const input = chapterBlueprintFormInput()
      window.localStorage.setItem("chapter-blueprints-debug.draft", JSON.stringify(input))
      state.runs[CHAPTER_BLUEPRINTS_NODE] = { nodeId: CHAPTER_BLUEPRINTS_NODE, status: "queued", runId: "正在创建…", input, events: [], provider: null }
      state.lastEventCount[CHAPTER_BLUEPRINTS_NODE] = 0
      updateChapterBlueprintAutoRun(`启动第 ${startChapter}-${endChapter} 章；每批最多 ${CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT} 章。`)
      const created = await api("/chapter-blueprint-runs", { method: "POST", body: input })
      rememberRun(CHAPTER_BLUEPRINTS_NODE, created.runId)
      state.runs[CHAPTER_BLUEPRINTS_NODE].runId = created.runId
      await refreshChapterBlueprintHistory()
      updateChapterBlueprintAutoRun(`第 ${startChapter}-${endChapter} 章运行中：${created.runId}`)
      const run = await waitForChapterBlueprintRunTerminal(created.runId)
      if (run.status !== "completed" || run.validation?.valid !== true) {
        updateChapterBlueprintAutoRun(`第 ${startChapter}-${endChapter} 章未通过，自动生成已停止；请查看当前 Run 日志和验证结果。`)
        break
      }
      state.chapterBlueprintAutoRun.completedBatches += 1
      updateChapterBlueprintAutoRun(`第 ${startChapter}-${endChapter} 章已通过，准备继续下一批。`)
      await sleep(350)
    }
  } catch (error) {
    updateChapterBlueprintAutoRun(`自动生成异常停止：${error.message}`)
  } finally {
    const finalMessage = state.chapterBlueprintAutoRun.lastMessage
    const completedBatches = state.chapterBlueprintAutoRun.completedBatches
    state.chapterBlueprintAutoRun = { active: false, stopRequested: false, completedBatches, lastMessage: finalMessage }
    await refreshChapterBlueprintHistory()
    renderAll()
  }
}

async function startChapterBlueprintAudit() {
  const run = state.runs[CHAPTER_BLUEPRINTS_NODE]
  if (!run?.runId || !run.result || run.semanticAudit || ["queued", "running"].includes(run.status)) return
  stopPolling(CHAPTER_BLUEPRINTS_NODE)
  run.status = "queued"
  run.error = null
  renderAll()
  try {
    await api(`/chapter-blueprint-runs/${encodeURIComponent(run.runId)}/audit`, { method: "POST" })
    await pollRun(CHAPTER_BLUEPRINTS_NODE)
    startPolling(CHAPTER_BLUEPRINTS_NODE)
  } catch (error) {
    run.status = "invalid"
    run.error = error.message
    renderAll()
  }
}

async function startChapterBlueprintRepair() {
  const run = state.runs[CHAPTER_BLUEPRINTS_NODE]
  if (!run?.runId || !run.result || run.validation?.valid === true || ["queued", "running"].includes(run.status)) return
  stopPolling(CHAPTER_BLUEPRINTS_NODE)
  run.status = "queued"
  run.error = null
  renderAll()
  try {
    await api(`/chapter-blueprint-runs/${encodeURIComponent(run.runId)}/repair`, { method: "POST" })
    await pollRun(CHAPTER_BLUEPRINTS_NODE)
    startPolling(CHAPTER_BLUEPRINTS_NODE)
  } catch (error) {
    run.status = "invalid"
    run.error = error.message
    renderAll()
  }
}

async function loadRememberedOrLatest(nodeId) {
  const remembered = window.localStorage.getItem(`flow-debug.run.${nodeId}`)
  if (remembered) {
    try {
      const run = await api(`/runs/${encodeURIComponent(remembered)}`)
      state.runs[nodeId] = run
      state.runIds[nodeId] = run.runId
      if (["queued", "running"].includes(run.status)) startPolling(nodeId)
      return
    } catch {}
  }
  try {
    const run = await api(`/runs/latest?nodeId=${encodeURIComponent(nodeId)}`)
    state.runs[nodeId] = run
    rememberRun(nodeId, run.runId)
  } catch {}
}

async function hydrateRuns() {
  await loadRememberedOrLatest(WORLD_NODE)
  await loadRememberedOrLatest(CHARACTER_NODE)
  await loadRememberedOrLatest(INITIAL_STATE_NODE)
  await loadRememberedOrLatest(WORLD_MATRIX_NODE)
  await loadRememberedOrLatest(PLOT_ARCHITECTURE_NODE)
  await loadRememberedOrLatest(STORY_BIBLE_NODE)
  await loadRememberedOrLatest(VOLUME_STRATEGY_NODE)
  await refreshChapterBlueprintHistory()
  await refreshCommittedChapterCoverage()
  await loadRememberedOrLatest(CHAPTER_BLUEPRINTS_NODE)
  await loadRememberedOrLatest(STYLE_PROFILE_NODE)
  await loadRememberedOrLatest(SINGLE_CHAPTER_CONTEXT_NODE)
  await loadRememberedOrLatest(CHAPTER_DRAFT_NODE)
  await loadRememberedOrLatest(CHAPTER_COMMIT_NODE)
  await loadRememberedOrLatest(CONTINUOUS_CHAPTER_NODE)
  renderAll()
}

function switchNode(nodeId) {
  if (nodeId !== WORLD_NODE && nodeId !== CHARACTER_NODE && nodeId !== INITIAL_STATE_NODE && nodeId !== WORLD_MATRIX_NODE && nodeId !== PLOT_ARCHITECTURE_NODE && nodeId !== STORY_BIBLE_NODE && nodeId !== VOLUME_STRATEGY_NODE && nodeId !== CHAPTER_BLUEPRINTS_NODE && nodeId !== STYLE_PROFILE_NODE && nodeId !== SINGLE_CHAPTER_CONTEXT_NODE && nodeId !== CHAPTER_DRAFT_NODE && nodeId !== CHAPTER_COMMIT_NODE && nodeId !== CONTINUOUS_CHAPTER_NODE && nodeId !== CHAPTER_REVIEW_NODE) return
  state.activeNode = nodeId
  state.lastEventCount[nodeId] = 0
  renderAll()
}

async function openChapterBlueprintRun(runId) {
  if (!runId) return
  try {
    const run = await api(`/runs/${encodeURIComponent(runId)}`)
    state.runs[CHAPTER_BLUEPRINTS_NODE] = run
    rememberRun(CHAPTER_BLUEPRINTS_NODE, run.runId)
    state.activeNode = CHAPTER_BLUEPRINTS_NODE
    state.lastEventCount[CHAPTER_BLUEPRINTS_NODE] = 0
    renderAll()
  } catch (error) {
    setService("offline", `读取历史 Run 失败：${error.message}`)
  }
}

async function startChapterReview(event) {
  event.preventDefault()
  const input = chapterReviewFormInput()
  if (!input.factoryProjectId) {
    state.chapterReview = { loading: false, error: "请先在顶部选择小说工厂项目。", report: null }
    renderAll()
    return
  }
  state.chapterReview = { loading: true, error: "", report: state.chapterReview.report }
  state.activeTab = "sample"
  $$("#evidence-tabs button").forEach((entry) => entry.classList.toggle("active", entry.dataset.tab === "sample"))
  renderAll()
  try {
    const query = new URLSearchParams({
      factoryProjectId: input.factoryProjectId,
      firstChapter: String(input.firstChapter),
      lastChapter: String(input.lastChapter),
    })
    const report = await api(`/chapter-review?${query.toString()}`)
    state.chapterReview = { loading: false, error: "", report }
    await refreshCommittedChapterCoverage()
    renderAll()
  } catch (error) {
    state.chapterReview = { loading: false, error: error.message, report: null }
    renderAll()
  }
}

function bindEvents() {
  $("#production-sandbox-create").addEventListener("click", () => void createProductionSandbox())
  $("#production-sandbox-approve").addEventListener("click", () => void approveProductionSandboxSettingReview())
  $("#production-sandbox-import-protagonist").addEventListener("click", () => void importProductionSandboxProtagonist())
  $("#production-sandbox-run").addEventListener("click", () => void runProductionSandboxNode())
  $("#run-form").addEventListener("input", syncFormState)
  $("#run-form").addEventListener("submit", startWorldRun)
  $("#character-run-form").addEventListener("input", syncFormState)
  $("#character-run-form").addEventListener("submit", startCharacterRun)
  $("#initial-state-run-form").addEventListener("input", syncFormState)
  $("#initial-state-run-form").addEventListener("submit", startInitialStateRun)
  $("#world-matrix-run-form").addEventListener("input", syncFormState)
  $("#world-matrix-run-form").addEventListener("submit", startWorldMatrixRun)
  $("#plot-architecture-run-form").addEventListener("input", syncFormState)
  $("#plot-architecture-run-form").addEventListener("submit", startPlotArchitectureRun)
  $("#story-bible-run-form").addEventListener("input", syncFormState)
  $("#story-bible-run-form").addEventListener("submit", startStoryBibleRun)
  $("#volume-strategy-run-form").addEventListener("input", syncFormState)
  $("#volume-strategy-run-form").addEventListener("submit", startVolumeStrategyRun)
  $("#chapter-blueprints-run-form").addEventListener("input", syncFormState)
  $("#chapter-blueprints-run-form").addEventListener("submit", startChapterBlueprintRun)
  $("#style-profile-run-form").addEventListener("input", syncFormState)
  $("#style-profile-run-form").addEventListener("submit", startStyleProfileRun)
  $("#style-profile-aigc-calibration-button").addEventListener("click", startStyleAigcCalibrationRun)
  $("#style-profile-freeze-button").addEventListener("click", freezeStyleProfileCandidate)
  $("#single-chapter-context-run-form").addEventListener("input", syncFormState)
  $("#single-chapter-context-run-form").addEventListener("submit", startSingleChapterContextRun)
  $("#chapter-draft-run-form").addEventListener("input", syncFormState)
  $("#chapter-draft-run-form").addEventListener("submit", startChapterDraftRun)
  $("#chapter-commit-run-form").addEventListener("input", syncFormState)
  $("#chapter-commit-run-form").addEventListener("submit", startChapterCommitRun)
  $("#continuous-chapter-run-form").addEventListener("input", syncFormState)
  $("#continuous-chapter-run-form").addEventListener("submit", startContinuousChapterRun)
  $("#continuous-chapter-auto-button").addEventListener("click", startContinuousChapterAutoRun)
  $("#continuous-chapter-stop-button").addEventListener("click", stopContinuousChapterAutoRun)
  $("#chapter-review-run-form").addEventListener("input", syncFormState)
  $("#chapter-review-run-form").addEventListener("submit", startChapterReview)
  $("#pause-run-button").addEventListener("click", pauseActiveRun)
  $("#style-sample-copy-button").addEventListener("click", async () => {
    const sample = latestStyleSampleFromRun(activeRun())?.sample || ""
    if (!sample) return
    try {
      await navigator.clipboard.writeText(sample)
      $("#style-sample-copy-button").textContent = "已复制"
      window.setTimeout(() => { $("#style-sample-copy-button").textContent = "复制完整样段" }, 1200)
    } catch {
      $("#style-sample-copy-button").textContent = "复制失败"
      window.setTimeout(() => { $("#style-sample-copy-button").textContent = "复制完整样段" }, 1200)
    }
  })
  $("#chapter-blueprints-volume-id").addEventListener("change", () => {
    delete $("#chapter-blueprints-volume-id").dataset.rangeSignature
    renderAll()
  })
  $("#chapter-blueprints-continue-button").addEventListener("click", () => {
    const nextChapter = Number($("#chapter-blueprints-continue-button").dataset.nextChapter)
    const volumeRun = state.runs[VOLUME_STRATEGY_NODE]
    const selectedVolume = Array.isArray(volumeRun?.result?.volumes) ? volumeRun.result.volumes.find((entry) => entry.id === $("#chapter-blueprints-volume-id").value) : null
    if (!Number.isInteger(nextChapter) || !selectedVolume) return
    $("#chapter-blueprints-start-chapter").value = String(nextChapter)
    $("#chapter-blueprints-end-chapter").value = String(Math.min(nextChapter + CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT - 1, Number(selectedVolume.endChapter)))
    $("#chapter-blueprints-volume-id").dataset.nextRangeSignature = `${state.runIds[VOLUME_STRATEGY_NODE] || "none"}:${selectedVolume.id}:${nextChapter}`
    syncFormState()
  })
  $("#chapter-blueprints-auto-button").addEventListener("click", () => void startChapterBlueprintAutoRun())
  $("#chapter-blueprints-audit-button").addEventListener("click", () => void startChapterBlueprintAudit())
  $("#chapter-blueprints-repair-button").addEventListener("click", () => void startChapterBlueprintRepair())
  $("#chapter-blueprints-history").addEventListener("click", (event) => {
    const button = event.target.closest("[data-chapter-run-id]")
    if (button) void openChapterBlueprintRun(button.dataset.chapterRunId)
  })
  $("#node-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-node]")
    if (button) switchNode(button.dataset.node)
  })
  $("#evidence-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]")
    if (!button) return
    state.activeTab = button.dataset.tab
    $$("#evidence-tabs button").forEach((entry) => entry.classList.toggle("active", entry === button))
    renderEvidence()
    if (state.activeTab === "chapters") void refreshCommittedChapterCoverage().then(() => {
      const chapters = Array.isArray(state.committedChapterCoverage?.chapters) ? state.committedChapterCoverage.chapters : []
      if (!state.chapterReader.selectedChapter && chapters.length) void loadCommittedChapterText(chapters[0])
      else renderEvidence()
    })
  })
  $("#evidence-content").addEventListener("click", (event) => {
    const chapterButton = event.target.closest("[data-read-chapter]")
    if (chapterButton) {
      void loadCommittedChapterText(Number(chapterButton.dataset.readChapter))
      return
    }
    const copyChapterButton = event.target.closest("[data-copy-chapter-text]")
    if (copyChapterButton) {
      const text = String(state.chapterReader.chapter?.text || "")
      if (text) void navigator.clipboard.writeText(text).then(() => {
        const original = copyChapterButton.textContent
        copyChapterButton.textContent = "已复制"
        window.setTimeout(() => { copyChapterButton.textContent = original }, 1000)
      })
      return
    }
    const copyReviewButton = event.target.closest("[data-copy-review-json]")
    if (copyReviewButton) {
      const text = state.chapterReview.report ? JSON.stringify(state.chapterReview.report, null, 2) : ""
      if (text) void navigator.clipboard.writeText(text).then(() => {
        const original = copyReviewButton.textContent
        copyReviewButton.textContent = "已复制"
        window.setTimeout(() => { copyReviewButton.textContent = original }, 1000)
      })
      return
    }
    const action = event.target.closest("[data-json-action]")?.dataset.jsonAction
    if (action === "expand") setJsonTreeExpanded(true)
    if (action === "collapse") setJsonTreeExpanded(false)
    if (action === "raw") setJsonViewerMode("raw")
    if (action === "tree") setJsonViewerMode("tree")
    if (action === "copy") {
      void copyCurrentJsonViewer().then(() => {
        const button = event.target.closest("[data-json-action]")
        if (!button) return
        const original = button.textContent
        button.textContent = "已复制"
        window.setTimeout(() => { button.textContent = original }, 1000)
      })
    }
  })
  $("#evidence-content").addEventListener("input", (event) => {
    if (event.target.matches("#json-tree-search")) filterJsonTree(event.target.value)
  })
}

restoreDrafts()
bindEvents()
bindModelSwitcher()
renderAll()
checkHealth()
refreshModelConfigs()
refreshProjects()
hydrateRuns()
