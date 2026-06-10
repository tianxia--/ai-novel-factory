const STAGE_METADATA = {
  worldbuilding_dialogue: {
    label: "世界观探讨",
    description: "正通过多智能体 ReAct 讨论阶段收集并论证世界观设定。",
  },
  setting_review: {
    label: "设定冻结",
    description: "世界观与角色骨架已进入冻结整理，准备形成正式设定资产。",
  },
  master_planning: {
    label: "主线规划",
    description: "Showrunner 正在整合完整主线、分卷结构与关键伏笔。",
  },
  chapter_task_generation: {
    label: "章节蓝图",
    description: "系统正按主线和伏笔表拆解精细章节蓝图。",
  },
  drafting: {
    label: "正文写作",
    description: "章节草稿与润色闭环已经启动，正文正在连续产出。",
  },
  reviewing: {
    label: "审校中",
    description: "编辑、审稿和润色角色正在交叉校验成稿质量。",
  },
  replanning: {
    label: "重规划",
    description: "用户变更触发了结构重算，系统正在重新规划后续产物。",
  },
  complete: {
    label: "已完成",
    description: "全书主流程已经完成，当前处于结果整理阶段。",
  },
}

const WORKFLOW_STEPS = [
  { key: "worldbuilding_dialogue", title: "世界观探讨", subtitle: "多智能体协作设定" },
  { key: "setting_review", title: "设定冻结", subtitle: "锁定主角与规则边界" },
  { key: "master_planning", title: "主线规划", subtitle: "形成完整剧情脉络" },
  { key: "chapter_task_generation", title: "章节蓝图", subtitle: "拆解卷纲与章节任务" },
  { key: "drafting", title: "正文写作", subtitle: "草稿、润色、审稿联动" },
  { key: "complete", title: "全书完成", subtitle: "产物收口与导出" },
]

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function humanizeTaskStatus(status) {
  if (status === "complete") return "已完成"
  if (status === "in_progress") return "进行中"
  if (status === "blocked") return "阻塞"
  return "待处理"
}

function humanizeContentQuality(contentQuality) {
  if (!contentQuality || typeof contentQuality !== "object") return ""
  if (contentQuality.status === "quarantined") return "待重写"
  if (contentQuality.status === "eligible") return "已核验"
  return ""
}

function parseDateMs(value) {
  const time = Date.parse(String(value || ""))
  return Number.isFinite(time) ? time : 0
}

function deriveJobRuntimeStatus(factorySnapshot = null) {
  const activeJobs = toArray(factorySnapshot?.activeJobs)
  const runnableJobs = toArray(factorySnapshot?.runnableJobs)
  const latestJob = activeJobs[0] || toArray(factorySnapshot?.latestJobs)[0] || null

  if (!activeJobs.length) {
    return null
  }

  const leaseExpiresAt = latestJob?.lease_expires_at || null
  const leaseOwner = latestJob?.lease_owner || null
  const leaseActive = leaseExpiresAt ? parseDateMs(leaseExpiresAt) > Date.now() : false

  if (runnableJobs.length > 0 && !leaseActive) {
    return {
      kind: "warning",
      label: "等待 worker 领取",
      detail: `数据库中有 ${runnableJobs.length} 个可恢复任务，尚未检测到有效 worker lease。`,
    }
  }

  if (leaseOwner && leaseActive) {
    return {
      kind: "processing",
      label: "worker 正在执行",
      detail: `任务已由 ${leaseOwner} 领取，lease 有效至 ${new Date(leaseExpiresAt).toLocaleTimeString("zh-CN", { hour12: false })}。`,
    }
  }

  return {
    kind: "processing",
    label: "任务已排队",
    detail: `数据库中有 ${activeJobs.length} 个无人值守任务，等待后台执行状态刷新。`,
  }
}

function deriveAutomationStatus(runtime = {}, factorySnapshot = null) {
  const autopilot = runtime.autopilot || {}
  const lastStep = autopilot.lastStep || runtime.lastAction || "idle"
  const driftStatus = autopilot.driftStatus || "ok"
  const driftScore = Number(autopilot.driftScore || 0)
  const jobStatus = deriveJobRuntimeStatus(factorySnapshot)
  const hasActiveJob = toArray(factorySnapshot?.activeJobs).length > 0
  const latestEvent = toArray(factorySnapshot?.latestEvents)[0] || null
  const latestPayload = (() => {
    if (!latestEvent?.payload_json) return {}
    try {
      const parsed = JSON.parse(latestEvent.payload_json)
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  })()
  const latestAutopilot = latestPayload.autopilot && typeof latestPayload.autopilot === "object"
    ? latestPayload.autopilot
    : null

  if (runtime.stage === "complete") {
    return {
      kind: "success",
      label: "主流程已完成",
      detail: runtime.statusMessage || "全部章节任务已完成。",
    }
  }

  if (lastStep === "network_retry" || latestAutopilot?.lastStep === "network_retry") {
    return {
      kind: "warning",
      label: "网络/模型重试中",
      detail: latestAutopilot?.statusMessage || runtime.statusMessage || autopilot.driftReason || "连接恢复后会继续。",
    }
  }

  if (latestEvent?.type === "AUTOPILOT_INSTRUCTION_QUEUED") {
    return {
      kind: "processing",
      label: "新指令已排队",
      detail: "你的最新消息已写入数据库，worker 会在下一轮读取并继续。",
    }
  }

  if (latestEvent?.type === "AUTOPILOT_INSTRUCTION_RECEIVED") {
    return {
      kind: "processing",
      label: "新指令已送达",
      detail: "worker 已接收你的最新消息，正在继续无人值守流程。",
    }
  }

  if (driftStatus === "blocked") {
    return {
      kind: "error",
      label: "目标漂移已阻塞",
      detail: autopilot.driftReason || runtime.statusMessage || "需要人工确认后继续。",
    }
  }

  if (autopilot.stopRequested) {
    return {
      kind: "warning",
      label: "停止请求已送达",
      detail: "当前轮结束后会保存进度并暂停。",
    }
  }

  if (driftStatus === "correcting") {
    return {
      kind: "warning",
      label: "正在纠偏",
      detail: autopilot.driftReason || runtime.statusMessage || "系统会回到原始目标和当前阶段。",
    }
  }

  if (jobStatus?.kind === "warning") {
    return jobStatus
  }

  if (hasActiveJob && String(lastStep).startsWith("discussion:")) {
    return {
      kind: "processing",
      label: "自动讨论中",
      detail: runtime.statusMessage || "agent 正在形成可写回结论。",
    }
  }

  if (hasActiveJob && String(lastStep).startsWith("guard:")) {
    return {
      kind: "processing",
      label: "守卫检查中",
      detail: `漂移评分 ${driftScore}，正在确认讨论结论是否与当前阶段一致。`,
    }
  }

  if (hasActiveJob && String(lastStep).startsWith("advance:")) {
    return {
      kind: "processing",
      label: "自动推进中",
      detail: runtime.statusMessage || "讨论结论已写回，正在推进真实工作流状态。",
    }
  }

  if (autopilot.running && hasActiveJob) {
    return jobStatus || {
      kind: "processing",
      label: "无人值守运行中",
      detail: runtime.statusMessage || "系统会持续讨论、写回、推进。",
    }
  }

  if (jobStatus) {
    return jobStatus
  }

  const hasAutopilotHistory = Boolean(autopilot.startedAt || autopilot.updatedAt || autopilot.target || autopilot.lastStep === "stopped")
  if (runtime.stage !== "complete" && !hasActiveJob && hasAutopilotHistory && (autopilot.lastStep === "stopped" || autopilot.mode === "idle")) {
    return {
      kind: "warning",
      label: "无人值守已暂停",
      detail: runtime.statusMessage || "数据库中没有可恢复任务；发送“继续”或点击启动后，统一管理者会重新接管。",
    }
  }

  return {
    kind: "idle",
    label: "等待下一步",
    detail: runtime.statusMessage || "发送消息或启动无人值守流程后会更新。",
  }
}

function artifactPath(row) {
  return String(row?.path || "")
}

function artifactChapterNumber(row) {
  const match = artifactPath(row).match(/chapter-(\d+)/)
  return match ? Number(match[1]) : null
}

function readJson(value, fallback = null) {
  if (value && typeof value === "object") {
    return value
  }
  if (typeof value !== "string" || !value.trim()) {
    return fallback
  }
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function qualityGateFromRecord(record) {
  const metadata = readJson(record?.metadata_json, record?.metadata || null)
  const payload = readJson(record?.payload_json, record?.payload || null)
  return metadata?.qualityGate || payload?.qualityGate || null
}

function isKnowledgeJob(job) {
  return String(job?.kind || "").startsWith("knowledge_")
}

function jobUpdatedAt(job) {
  return job?.updated_at || job?.updatedAt || job?.created_at || job?.createdAt || ""
}

function deriveKnowledgeJobStatusFromRows(jobs = []) {
  const knowledgeJobs = toArray(jobs)
    .filter(isKnowledgeJob)
    .slice()
    .sort((left, right) => parseDateMs(jobUpdatedAt(right)) - parseDateMs(jobUpdatedAt(left)))
  if (!knowledgeJobs.length) {
    return null
  }

  const activeJobs = knowledgeJobs.filter((job) =>
    ["idle", "running", "paused"].includes(String(job.status || "")))
  const runningJobs = activeJobs.filter((job) => String(job.status || "") === "running")
  const leaseActive = runningJobs.some((job) => {
    const expiresAt = job.lease_expires_at || job.leaseExpiresAt || ""
    return parseDateMs(expiresAt) > Date.now()
  })
  if (runningJobs.length > 0 && leaseActive) {
    const owner = runningJobs.find((job) => job.lease_owner || job.leaseOwner)?.lease_owner
      || runningJobs.find((job) => job.lease_owner || job.leaseOwner)?.leaseOwner
      || "worker"
    return {
      kind: "running",
      label: "worker 正在索引",
      detail: `${runningJobs.length} 个知识库任务正在由 ${owner} 处理，完成后会刷新可召回片段和引用来源。`,
    }
  }
  if (activeJobs.length > 0) {
    return {
      kind: "queued",
      label: "重建已排队",
      detail: `${activeJobs.length} 个知识库后台任务已在数据库队列中，等待 worker 领取或续租。`,
    }
  }

  const latestJob = knowledgeJobs[0]
  const latestStatus = String(latestJob.status || "")
  if (latestStatus === "completed") {
    return {
      kind: "success",
      label: "最近重建完成",
      detail: "最近一次知识库任务已完成，当前统计来自数据库快照。",
    }
  }
  if (latestStatus === "failed") {
    return {
      kind: "warning",
      label: "最近重建失败",
      detail: "最近一次知识库任务失败，请检查后台 worker 日志或重新排队。",
    }
  }
  return null
}

function deriveKnowledgeJobStatusFromEvents(latestEvents = []) {
  const knowledgeJobEvents = toArray(latestEvents)
    .map((event) => ({
      event,
      payload: readJson(event?.payload_json, event?.payload || {}),
    }))
    .filter(({ event, payload }) =>
      event?.type === "KNOWLEDGE_REINDEX_QUEUED"
      || String(payload?.kind || "").startsWith("knowledge_")
      || toArray(payload?.jobs).some(isKnowledgeJob),
    )
  const latestKnowledgeEvent = knowledgeJobEvents[0] || null
  const queuedJobCount = toArray(latestKnowledgeEvent?.payload?.jobs)
    .filter(isKnowledgeJob)
    .length
  const latestJobStatus = String(latestKnowledgeEvent?.payload?.status || "")
  const latestEventType = String(latestKnowledgeEvent?.event?.type || "")
  if (latestEventType === "KNOWLEDGE_REINDEX_QUEUED") {
    return {
      kind: "queued",
      label: "重建已排队",
      detail: queuedJobCount > 0
        ? `已有 ${queuedJobCount} 个知识库后台任务等待 worker 处理。`
        : "知识库重建任务已写入数据库，等待 worker 处理。",
    }
  }
  if (latestEventType === "JOB_CLAIMED" && isKnowledgeJob(latestKnowledgeEvent?.payload)) {
    return {
      kind: "running",
      label: "worker 正在索引",
      detail: "知识库任务已被 worker 领取，完成后会刷新可召回片段和引用来源。",
    }
  }
  if (latestEventType === "JOB_UPDATED" && latestJobStatus === "completed") {
    return {
      kind: "success",
      label: "最近重建完成",
      detail: "最近一次知识库任务已完成，当前统计来自数据库快照。",
    }
  }
  if (latestEventType === "JOB_UPDATED" && latestJobStatus === "failed") {
    return {
      kind: "warning",
      label: "最近重建失败",
      detail: "最近一次知识库任务失败，请检查后台 worker 日志或重新排队。",
    }
  }
  return null
}

function normalizeKnowledgeEvaluation(value = null) {
  const payload = value?.payload || readJson(value?.payload_json, null)
  const summary = payload?.summary || value?.summary || null
  if (!summary || typeof summary !== "object") {
    return null
  }
  const cases = toArray(payload?.cases || value?.cases).slice(0, 6).map((item) => ({
    name: String(item?.name || ""),
    query: String(item?.query || ""),
    k: Number(item?.k || 0),
    hitAtK: Number(item?.hitAtK || 0),
    recallAtK: Number(item?.recallAtK || 0),
    precisionAtK: Number(item?.precisionAtK || 0),
    matchedCount: toArray(item?.matchedChunkIds).length,
    missedCount: toArray(item?.missedChunkIds).length,
  }))
  return {
    createdAt: String(value?.created_at || value?.createdAt || ""),
    summary: {
      totalCases: Number(summary.totalCases || 0),
      hitRateAtK: Number(summary.hitRateAtK || 0),
      meanRecallAtK: Number(summary.meanRecallAtK || 0),
      meanPrecisionAtK: Number(summary.meanPrecisionAtK || 0),
    },
    cases,
  }
}

function deriveKnowledgeStatus(factorySnapshot = null) {
  const knowledge = factorySnapshot?.knowledge || {}
  const summary = knowledge.summary || {}
  const sources = toArray(knowledge.sources)
  const chunks = toArray(knowledge.chunks)
  const citations = toArray(knowledge.citations)
  const jobs = toArray(knowledge.jobs)
  const latestEvaluation = normalizeKnowledgeEvaluation(knowledge.latestEvaluation)
  const normalizedSummary = {
    globalSources: Number(summary.globalSources || 0),
    projectSources: Number(summary.projectSources || 0),
    readyChunks: Number(summary.readyChunks || 0),
    pendingChunks: Number(summary.pendingChunks || 0),
    failedChunks: Number(summary.failedChunks || 0),
  }
  const jobStatus = deriveKnowledgeJobStatusFromRows(jobs)
    || deriveKnowledgeJobStatusFromEvents(factorySnapshot?.latestEvents)
    || {
      kind: "idle",
      label: "后台空闲",
      detail: "可手动重建知识库，任务会进入 durable job 队列。",
    }
  const recentCitations = citations.slice(0, 5).map((citation) => {
    const results = toArray(readJson(citation.results_json, citation.results || []))
    const usedChunkIds = toArray(readJson(citation.used_chunk_ids_json, citation.usedChunkIds || []))
    const uniqueSources = []
    const seen = new Set()
    for (const result of results) {
      const sourcePath = String(result?.sourcePath || result?.source_path || "")
      const sourceType = String(result?.sourceType || result?.source_type || "")
      const key = `${sourceType}:${sourcePath}`
      if (!sourcePath || seen.has(key)) continue
      seen.add(key)
      uniqueSources.push({
        path: sourcePath,
        sourceType,
        score: Number(result?.score || 0),
      })
    }
    return {
      id: String(citation.id || ""),
      query: String(citation.query || ""),
      createdAt: String(citation.created_at || citation.createdAt || ""),
      resultCount: results.length,
      usedChunkCount: usedChunkIds.length,
      sources: uniqueSources.slice(0, 4),
    }
  })
  const topSources = sources.slice(0, 6).map((source) => ({
    id: String(source.id || ""),
    scope: String(source.scope || ""),
    sourceType: String(source.source_type || source.sourceType || ""),
    path: String(source.path || ""),
    title: String(source.title || source.path || "knowledge"),
    status: String(source.status || "unknown"),
    updatedAt: String(source.updated_at || source.updatedAt || ""),
  }))
  const recentChunks = chunks.slice(0, 4).map((chunk) => ({
    id: String(chunk.id || ""),
    chunkType: String(chunk.chunk_type || chunk.chunkType || ""),
    sourcePath: String(chunk.source_path || chunk.sourcePath || ""),
    sourceTitle: String(chunk.source_title || chunk.sourceTitle || ""),
    preview: String(chunk.content || "").replace(/\s+/g, " ").trim().slice(0, 120),
  }))
  const totalSources = normalizedSummary.globalSources + normalizedSummary.projectSources
  const hasIndexedChunks = normalizedSummary.readyChunks > 0
  const status = hasIndexedChunks
    ? "ready"
    : normalizedSummary.pendingChunks > 0
      ? "indexing"
      : normalizedSummary.failedChunks > 0
        ? "warning"
        : "empty"

  return {
    status,
    label: status === "ready" ? "已建立" : status === "indexing" ? "索引中" : status === "warning" ? "需检查" : "等待索引",
    summary: normalizedSummary,
    totalSources,
    recentCitations,
    topSources,
    recentChunks,
    hasIndexedChunks,
    jobStatus,
    latestEvaluation,
  }
}

function artifactUpdatedAt(row) {
  return row?.updated_at || row?.created_at || row?.updatedAt || row?.createdAt || ""
}

function artifactLabel(row) {
  const path = artifactPath(row)
  const kind = String(row?.kind || "")
  if (path.includes("global-consensus.md")) return "全局共识"
  if (path.includes("/consensus/")) return "本轮共识归档"
  if (path.includes("current-context.md")) return "当前上下文包"
  if (path.includes("discussion-log.md") || kind === "transcript") return "完整讨论记录"
  if (path.includes("setting-freeze.md")) return "设定冻结稿"
  if (path.includes("master-outline.md")) return "主线大纲"
  if (path.includes("/knowledge/evaluation")) return "知识库召回评估"
  if (path.includes("production-resources/")) return "写作资源"
  const chapterMatch = path.match(/chapter-(\d+)/)
  if (path.includes("chapter-blueprints/") && chapterMatch) return `第 ${Number(chapterMatch[1])} 章蓝图`
  if (path.includes(".final.md") && chapterMatch) return `第 ${Number(chapterMatch[1])} 章正文`
  if (path.includes("-quality.md") && chapterMatch) return `第 ${Number(chapterMatch[1])} 章质检`
  if (path.includes("-memory.md") && chapterMatch) return `第 ${Number(chapterMatch[1])} 章记忆`
  if (kind === "transcript") return "讨论记录"
  return path.split("/").pop() || kind || "产物"
}

function artifactCategory(row) {
  const path = artifactPath(row)
  const kind = String(row?.kind || "")
  if (kind === "consensus" || path.includes("global-consensus.md")) return "共识"
  if (path.includes("/consensus/")) return "共识"
  if (kind === "context" || path.includes("current-context.md")) return "上下文"
  if (kind === "plan" || path.includes("/plans/") || path.includes("chapter-blueprints/")) return "规划"
  if (path.includes("/knowledge/")) return "知识库"
  if (kind === "style" || path.includes("production-resources/")) return "写作资源"
  if (kind === "chapter" || path.includes(".final.md")) return "正文"
  if (kind === "checkpoint" || path.includes("-quality.md")) return "质检"
  if (kind === "memory" || path.includes("-memory.md")) return "记忆"
  if (kind === "transcript" || path.includes("discussion-log.md")) return "讨论"
  return "其他"
}

function deriveArtifactPreviews(factorySnapshot = null) {
  const seen = new Set()
  return toArray(factorySnapshot?.artifacts)
    .filter((row) => {
      const path = artifactPath(row)
      if (!path || seen.has(path)) return false
      seen.add(path)
      return path.startsWith(".ai-novel/")
    })
    .map((row) => ({
      key: artifactPath(row),
      path: artifactPath(row),
      label: artifactLabel(row),
      category: artifactCategory(row),
      status: row?.status || "unknown",
      updatedAt: artifactUpdatedAt(row),
    }))
}

function healthLabel(status = "") {
  if (status === "ready") return "正常"
  if (status === "watch") return "关注"
  if (status === "warning") return "需检查"
  if (status === "indexing") return "索引中"
  if (status === "needs_setup") return "待建立"
  return "未知"
}

function deriveProductionObservabilityView({ state = null, factorySnapshot = null, contextPacket = "" } = {}) {
  const provided = factorySnapshot?.productionObservability && typeof factorySnapshot.productionObservability === "object"
    ? factorySnapshot.productionObservability
    : null
  const artifacts = toArray(factorySnapshot?.artifacts)
  const recentMemory = toArray(factorySnapshot?.recentMemory)
  const creativeProfile = state?.project?.creativeProfile || factorySnapshot?.state?.project?.creativeProfile || {}
  const styleArtifact = artifacts.find((artifact) => artifactPath(artifact).includes("style/profile.md")) || null
  const dossierArtifact = artifacts.find((artifact) => artifactPath(artifact).includes("memory/characters/dossiers.json")) || null
  const characterRows = recentMemory.filter((row) => row.kind === "character_dossiers")
  const chapterRows = recentMemory.filter((row) => row.kind === "chapter_summary")
  const dossierCount = toArray(state?.memory?.characterDossiers || factorySnapshot?.state?.memory?.characterDossiers).length
  const fallback = {
    style: {
      status: styleArtifact || creativeProfile?.styleFingerprint ? "ready" : "needs_setup",
      genre: creativeProfile?.genre || "",
      readerPromise: creativeProfile?.readerPromise || "",
      pointOfView: creativeProfile?.pointOfView || "",
      tone: creativeProfile?.tone || "",
      naturalnessTarget: creativeProfile?.naturalnessTarget || "",
      styleFingerprint: creativeProfile?.styleFingerprint || "",
      artifactPath: styleArtifact ? artifactPath(styleArtifact) : ".ai-novel/style/profile.md",
      missing: [],
    },
    characterDossier: {
      status: dossierCount > 0 || dossierArtifact ? "ready" : "needs_setup",
      count: dossierCount,
      artifactPath: dossierArtifact ? artifactPath(dossierArtifact) : ".ai-novel/memory/characters/dossiers.json",
      memoryRows: characterRows.length,
      missing: [],
    },
    memoryRecall: {
      status: characterRows.length > 0 ? "ready" : recentMemory.length > 0 ? "indexing" : "needs_setup",
      characterRows: characterRows.length,
      chapterRows: chapterRows.length,
      memoryLag: 0,
      latestSource: recentMemory[0]?.source || "",
      latestKind: recentMemory[0]?.kind || "",
      pendingEmbeddings: recentMemory.filter((row) => row.embedding_status === "pending").length,
    },
    contextBudget: {
      status: contextPacket.length > 20_000 ? "warning" : contextPacket.length > 15_000 ? "watch" : "ready",
      estimatedChars: contextPacket.length,
      budgetLimit: 24_000,
      budgetPercent: Math.min(100, Math.round((contextPacket.length / 24_000) * 100)),
      sections: [{ key: "contextPacket", label: "Context packet", chars: contextPacket.length }],
    },
    qualitySignals: {
      latestNaturalnessReason: "",
      completedChapters: 0,
      blockedChapters: 0,
    },
  }
  const merged = {
    style: { ...fallback.style, ...(provided?.style || {}) },
    characterDossier: { ...fallback.characterDossier, ...(provided?.characterDossier || {}) },
    memoryRecall: { ...fallback.memoryRecall, ...(provided?.memoryRecall || {}) },
    contextBudget: { ...fallback.contextBudget, ...(provided?.contextBudget || {}) },
    qualitySignals: { ...fallback.qualitySignals, ...(provided?.qualitySignals || {}) },
  }
  return {
    ...merged,
    style: { ...merged.style, label: healthLabel(merged.style.status) },
    characterDossier: { ...merged.characterDossier, label: healthLabel(merged.characterDossier.status) },
    memoryRecall: { ...merged.memoryRecall, label: healthLabel(merged.memoryRecall.status) },
    contextBudget: { ...merged.contextBudget, label: healthLabel(merged.contextBudget.status) },
  }
}

function deriveProductionPipelineStatus(factorySnapshot = null) {
  const artifacts = toArray(factorySnapshot?.artifacts)
  const latestEvents = toArray(factorySnapshot?.latestEvents)
  const state = factorySnapshot?.state || null
  const artifactSummary = factorySnapshot?.artifactSummary || {}
  const chapterFacts = toArray(factorySnapshot?.chapterFacts)
  const blueprintArtifacts = artifacts.filter((artifact) => artifactPath(artifact).includes("plans/chapter-blueprints/"))
  const finalChapterArtifacts = artifacts.filter((artifact) => artifactPath(artifact).includes(".final.md"))
  const qualityArtifacts = artifacts.filter((artifact) => artifactPath(artifact).includes("-quality.md"))
  const memoryArtifacts = artifacts.filter((artifact) => artifactPath(artifact).includes("-memory.md"))
  const transcriptArtifacts = artifacts.filter((artifact) => artifact.kind === "transcript" || artifactPath(artifact).includes("discussion-log.md"))
  const transcriptLooksLikeDrafting = latestEvents.some((event) => {
    const payload = `${event?.payload_json || ""} ${event?.metadata_json || ""}`
    return /第\s*\d+\s*章|chapter-\d+|drafting|初稿/i.test(payload)
  })
  const latestFinal = finalChapterArtifacts[0] || null
  const latestQualityEvent = latestEvents.find((event) =>
    event?.type === "CHAPTER_PIPELINE_BLOCKED" || event?.type === "CHAPTER_PIPELINE_COMPLETED")
  const taskQualityRecord = toArray(state?.plan?.chapterTasks).find((task) => task?.qualityGate?.status && task.qualityGate.status !== "passed")
    || toArray(state?.plan?.chapterTasks).find((task) => task?.qualityGate)
  const latestQualityRecord = latestQualityEvent || qualityArtifacts.find((artifact) => qualityGateFromRecord(artifact)) || null
  const latestQualityGate = taskQualityRecord?.qualityGate || (latestQualityRecord ? qualityGateFromRecord(latestQualityRecord) : null)
  const latestQualityPayload = readJson(latestQualityEvent?.payload_json, latestQualityEvent?.payload || null)
  const latestQualityChapter = taskQualityRecord?.chapterNumber
    ?? latestQualityPayload?.chapterNumber
    ?? readJson(qualityArtifacts[0]?.metadata_json, qualityArtifacts[0]?.metadata || null)?.chapterNumber
    ?? null

  return {
    blueprints: Number(artifactSummary.blueprints ?? blueprintArtifacts.length),
    finalChapters: Number(artifactSummary.finalChapters ?? finalChapterArtifacts.length),
    finalChapterFiles: Number(artifactSummary.finalChapterFiles ?? finalChapterArtifacts.length),
    passedFinalChapters: Number(artifactSummary.passedFinalChapters ?? chapterFacts.filter((fact) => fact.status === "complete").length),
    blockedFinalChapters: Number(artifactSummary.blockedFinalChapters ?? chapterFacts.filter((fact) => fact.status === "blocked").length),
    quarantinedFinalChapters: Number(artifactSummary.quarantinedFinalChapters ?? chapterFacts.filter((fact) => fact.contentQuality?.status === "quarantined").length),
    untrustedPassedGates: Number(artifactSummary.untrustedPassedGates ?? chapterFacts.filter((fact) => fact.qualityGate?.status === "passed" && fact.contentQuality?.status === "quarantined").length),
    qualityReports: Number(artifactSummary.qualityReports ?? qualityArtifacts.length),
    memoryUpdates: Number(artifactSummary.memoryUpdates ?? memoryArtifacts.length),
    latestFinalPath: artifactSummary.latestFinalPath || (latestFinal ? artifactPath(latestFinal) : ""),
    transcriptDraftOnly: state?.runtime?.stage !== "drafting"
      && finalChapterArtifacts.length === 0
      && transcriptArtifacts.length > 0
      && (transcriptLooksLikeDrafting || state?.runtime?.autopilot?.driftStatus === "blocked"),
    latestQualityGate: latestQualityGate
      ? {
        status: latestQualityGate.status || "unknown",
        score: Number.isFinite(Number(latestQualityGate.score)) ? Number(latestQualityGate.score) : null,
        attempts: Number.isFinite(Number(latestQualityGate.attempts)) ? Number(latestQualityGate.attempts) : 0,
        reason: latestQualityGate.reason || "",
        chapterNumber: latestQualityChapter,
      }
      : null,
    hasProductionArtifacts: Number(artifactSummary.total || 0) > 0 || blueprintArtifacts.length > 0 || finalChapterArtifacts.length > 0,
  }
}

function deriveProductionSummary(state = null, factorySnapshot = null, pipeline = null) {
  const snapshotState = factorySnapshot?.state || null
  const sourceState = snapshotState || state || null
  const tasks = toArray(sourceState?.plan?.chapterTasks)
  const chapterFacts = toArray(factorySnapshot?.chapterFacts)
  const taskSummary = sourceState?.plan?.chapterTaskSummary || {}
  const totalChapters = Number(sourceState?.plan?.totalChapters || taskSummary.total || tasks.length || 0)
  const chapterWordTarget = Number(sourceState?.plan?.chapterWordTarget || 2500)
  const passedChapters = chapterFacts.length > 0
    ? chapterFacts.filter((fact) => fact.status === "complete").length
    : Number.isFinite(Number(taskSummary.complete))
    ? Number(taskSummary.complete)
    : tasks.filter((task) => task.status === "complete").length
  let contiguousCompletedChapters = 0
  if (chapterFacts.length > 0) {
    const factsByChapter = new Map(chapterFacts.map((fact) => [Number(fact.chapterNumber), fact]))
    for (let chapterNumber = 1; chapterNumber <= totalChapters; chapterNumber += 1) {
      if (factsByChapter.get(chapterNumber)?.status !== "complete") break
      contiguousCompletedChapters += 1
    }
  } else if (Number.isFinite(Number(taskSummary.complete)) && tasks.length < totalChapters) {
    contiguousCompletedChapters = Number(taskSummary.complete)
  } else {
    for (const task of tasks) {
      if (task.status !== "complete") break
      contiguousCompletedChapters += 1
    }
  }
  const completedChapters = Math.min(passedChapters, contiguousCompletedChapters)
  const inProgressChapters = chapterFacts.length > 0
    ? chapterFacts.filter((fact) => fact.status === "in_progress").length
    : Number.isFinite(Number(taskSummary.inProgress))
    ? Number(taskSummary.inProgress)
    : tasks.filter((task) => task.status === "in_progress").length
  const blockedChapters = chapterFacts.length > 0
    ? chapterFacts.filter((fact) => fact.status === "blocked").length
    : Number.isFinite(Number(taskSummary.blocked))
    ? Number(taskSummary.blocked)
    : tasks.filter((task) => task.status === "blocked").length
  const pendingChapters = chapterFacts.length > 0
    ? Math.max(0, totalChapters - passedChapters - inProgressChapters - blockedChapters)
    : Number.isFinite(Number(sourceState?.plan?.pendingChapters))
    ? Number(sourceState.plan.pendingChapters)
    : Number.isFinite(Number(taskSummary.pending))
      ? Number(taskSummary.pending)
      : tasks.filter((task) => task.status === "pending").length
  const artifactFinalChapters = Number(pipeline?.finalChapterFiles ?? pipeline?.finalChapters ?? 0)
  const quarantinedChapters = Number(pipeline?.quarantinedFinalChapters || 0)
  const untrustedPassedGates = Number(pipeline?.untrustedPassedGates || 0)
  const syncWarning = quarantinedChapters > 0
    ? `DB 中已有 ${artifactFinalChapters} 个成稿文件，但 ${quarantinedChapters} 个未通过确定性字数门禁，其中 ${untrustedPassedGates} 个是旧 passed 记录；当前连续正式进度到第 ${completedChapters} 章，需从最早待重写章节恢复。`
    : artifactFinalChapters > completedChapters
    ? `DB 中已有 ${artifactFinalChapters} 个成稿文件，其中 ${passedChapters} 章通过质量门禁；当前连续正式进度到第 ${completedChapters} 章，后续章节需等待前序阻塞修复后重校确认。`
    : ""
  const progressPercent = totalChapters > 0
    ? Math.max(0, Math.min(100, Math.round((completedChapters / totalChapters) * 100)))
    : 0
  const latestEvent = toArray(factorySnapshot?.latestEvents)[0] || null
  const rawStage = sourceState?.runtime?.stage || "unknown"
  const normalizedStage = rawStage === "complete" && !(
    totalChapters > 0
    && completedChapters >= totalChapters
    && blockedChapters === 0
    && inProgressChapters === 0
  )
    ? (blockedChapters > 0 ? "reviewing" : "drafting")
    : rawStage
  const isComplete = normalizedStage === "complete"
    && totalChapters > 0
    && completedChapters >= totalChapters
    && blockedChapters === 0
    && inProgressChapters === 0

  return {
    source: snapshotState ? "db" : sourceState ? "state" : "empty",
    stage: normalizedStage,
    rawStage,
    statusMessage: sourceState?.runtime?.statusMessage || "",
    totalChapters,
    chapterWordTarget,
    completedChapters,
    passedChapters,
    contiguousCompletedChapters,
    pendingChapters: Math.max(0, pendingChapters),
    inProgressChapters,
    blockedChapters,
    quarantinedChapters,
    untrustedPassedGates,
    finalChapters: completedChapters,
    artifactFinalChapters,
    blueprints: Number(pipeline?.blueprints || 0),
    qualityReports: Number(pipeline?.qualityReports || 0),
    memoryUpdates: Number(pipeline?.memoryUpdates || 0),
    syncWarning,
    progressPercent,
    estimatedWords: Math.max(0, completedChapters * chapterWordTarget),
    latestFinalPath: pipeline?.latestFinalPath || "",
    latestEventType: latestEvent?.type || "",
    latestEventAt: latestEvent?.created_at || latestEvent?.updated_at || "",
    isComplete,
  }
}

function mergeChapterFactIntoTask(task, fact) {
  if (!fact) return task
  const contentQuality = fact.contentQuality || task.contentQuality || null
  const quarantined = contentQuality?.status === "quarantined"
  const resolvedStatus = fact.status || task.status
  const prefersQuarantineLabel = quarantined && resolvedStatus !== "in_progress"
  return {
    ...task,
    status: resolvedStatus,
    statusLabel: prefersQuarantineLabel ? humanizeContentQuality(contentQuality) : humanizeTaskStatus(resolvedStatus),
    qualityGate: fact.qualityGate || task.qualityGate || null,
    contentQuality,
    artifactPath: fact.finalPath || task.artifactPath || "",
    latestStep: fact.latestStep || "",
    latestEventAt: fact.latestEventAt || "",
  }
}

function applySequentialChapterBlocking(items) {
  let firstUnfinishedSeen = false
  return items.map((item) => {
    const blockedByPrevious = firstUnfinishedSeen && item.status !== "complete"
    if (item.status !== "complete") {
      firstUnfinishedSeen = true
    }
    return blockedByPrevious
      ? {
        ...item,
        blockedByPrevious: true,
        displayStatus: "blocked_by_previous",
        statusLabel: "前序阻塞",
      }
      : item
  })
}

function parseRoleBlocks(block, blockIndex) {
  const rolePattern = /^(User|Showrunner|World Architect|Author|Editor|Reviewer|Prose Stylist):\s*(.*)$/
  const entries = []
  let current = null

  for (const line of block.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(rolePattern)
    if (match) {
      if (current) {
        entries.push(current)
      }
      current = {
        key: `transcript-${blockIndex}-${entries.length}`,
        role: match[1],
        content: match[2].trim(),
      }
      continue
    }

    if (current) {
      current.content = [current.content, trimmed].filter(Boolean).join("\n")
    }
  }

  if (current) {
    entries.push(current)
  }

  return entries
}

function parseTranscript(transcript = "") {
  const blocks = transcript
    .split(/^##\s+/m)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.flatMap((block, blockIndex) => parseRoleBlocks(block, blockIndex))
}

function entriesFromRecentMessages(factorySnapshot = null) {
  const rows = toArray(factorySnapshot?.recentMessages)
  if (rows.length === 0) {
    return []
  }
  const normalizeParts = (parts = []) => Array.isArray(parts)
    ? parts
      .filter((part) => part && typeof part === "object")
      .map((part, index) => ({
        ...part,
        id: part.id || `${part.messageId || part.message_id || "message"}:part:${index}`,
        messageId: part.messageId || part.message_id || "",
        index: Number.isFinite(Number(part.index ?? part.part_index)) ? Number(part.index ?? part.part_index) : index,
        type: String(part.type || "text"),
        data: part.data && typeof part.data === "object" ? part.data : {},
        createdAt: part.createdAt || part.created_at || "",
      }))
      .sort((left, right) => left.index - right.index)
    : []
  const artifactPathFromParts = (parts = []) => {
    const artifactPart = parts.find((part) => part.type === "artifact" && part.data && typeof part.data === "object")
    const path = artifactPart?.data?.path || artifactPart?.data?.artifactPath || artifactPart?.data?.url || ""
    return typeof path === "string" ? path : ""
  }
  return rows.slice().reverse().map((row, index) => {
    const data = row.data && typeof row.data === "object" ? row.data : {}
    const parts = normalizeParts(row.parts)
    const type = String(row.type || "agent")
    const role = type === "user" ? "User" : String(data.agentLabel || data.agentType || "Agent")
    const content = type === "status"
      ? [data.title ? `### ${String(data.title)}` : "", data.content ? String(data.content) : ""].filter(Boolean).join("\n\n")
      : String(data.content || data.caption || data.alt || data.path || data.url || "")
    return {
      key: `message-${row.id || index}`,
      messageId: String(row.id || row.messageId || ""),
      conversationId: String(row.conversation_id || row.conversationId || ""),
      runId: String(row.run_id || row.runId || ""),
      turnId: String(row.turn_id || row.turnId || ""),
      type,
      status: String(row.status || "completed"),
      role,
      content,
      timestamp: String(row.time || row.created_at || row.createdAt || ""),
      time: String(row.time || row.created_at || row.createdAt || ""),
      data,
      parts,
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      artifactPath: typeof data.artifactPath === "string" ? data.artifactPath : artifactPathFromParts(parts),
    }
  })
}

function extractConsensusSummary(consensus = "") {
  const lines = consensus
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  const start = lines.findIndex((line) => line === "Latest discussion summary:")
  if (start >= 0) {
    const summary = []
    for (const line of lines.slice(start + 1)) {
      if (!line.startsWith("-")) break
      summary.push(line)
    }
    if (summary.length > 0) {
      return summary.join("\n")
    }
  }

  return lines.filter((line) => line.startsWith("-")).slice(0, 8).join("\n")
}

export function deriveStudioViewModel({ state, transcript = "", discussionEntries = null, consensus = "", contextPacket = "", envStatus = null, providerResult = null, factorySnapshot = null } = {}) {
  const safeState = factorySnapshot?.state || state || null
  const productionPipeline = deriveProductionPipelineStatus(factorySnapshot)
  const productionSummary = deriveProductionSummary(safeState, factorySnapshot, productionPipeline)
  const stageKey = productionSummary.stage || safeState?.runtime?.stage || "worldbuilding_dialogue"
  const currentStage = STAGE_METADATA[stageKey] || {
    label: stageKey,
    description: safeState?.runtime?.statusMessage || "等待初始化。",
  }
  const runtimeStatusMessage = safeState?.runtime?.statusMessage || currentStage.description

  const stageIndex = WORKFLOW_STEPS.findIndex((step) => step.key === stageKey)
  const workflow = {
    currentStage: {
      key: stageKey,
      ...currentStage,
      description: runtimeStatusMessage,
      rawStatus: runtimeStatusMessage || "Workspace not initialized.",
    },
    steps: WORKFLOW_STEPS.map((step, index) => ({
      ...step,
      state: index < stageIndex ? "completed" : index === stageIndex ? "active" : "locked",
    })),
    automation: deriveAutomationStatus({
      ...(safeState?.runtime || {}),
      stage: stageKey,
    }, factorySnapshot),
  }

  const providerCheck = providerResult || safeState?.runtime?.lastProviderCheck || null
  const provider = {
    configured: envStatus?.configured ?? Boolean(providerCheck?.baseUrl),
    modelName: providerCheck?.modelName || envStatus?.resolved?.modelName || "未检测",
    testOk: providerCheck?.ok || false,
    testMessage: providerCheck?.message || "尚未测试",
    checkedAt: providerCheck?.checkedAt || null,
    missing: envStatus?.missing || [],
  }

  const artifacts = deriveArtifactPreviews(factorySnapshot)
  const productionObservability = deriveProductionObservabilityView({
    state: safeState,
    factorySnapshot,
    contextPacket,
  })
  const chapterFactsByNumber = new Map(toArray(factorySnapshot?.chapterFacts).map((fact) => [Number(fact.chapterNumber), fact]))
  const blueprintPathByChapter = new Map(
    toArray(factorySnapshot?.artifacts)
      .filter((row) => artifactPath(row).includes("chapter-blueprints/"))
      .map((row) => [artifactChapterNumber(row), artifactPath(row)])
      .filter(([chapterNumber, path]) => Number.isFinite(chapterNumber) && path),
  )

  return {
    initialized: Boolean(safeState),
    project: {
      title: safeState?.project?.title || "未初始化项目",
      idea: safeState?.project?.idea || "",
      totalChapters: safeState?.plan?.totalChapters || 0,
      chapterWordTarget: safeState?.plan?.chapterWordTarget || 2500,
      coverStatus: safeState?.assets?.cover?.status || "pending",
      comicStatus: safeState?.assets?.comic?.status || "pending",
    },
    workflow,
    productionPipeline,
    productionSummary,
    provider,
    storyMemory: {
      idea: safeState?.project?.idea || "请先初始化项目。",
      openQuestions: toArray(safeState?.reactSetup?.unansweredQuestions),
      consensus,
      consensusSummary: extractConsensusSummary(consensus),
      contextPacket,
      artifacts: artifacts.filter((artifact) => ["共识", "上下文", "讨论", "规划", "写作资源", "知识库"].includes(artifact.category)),
      knowledge: deriveKnowledgeStatus(factorySnapshot),
      style: productionObservability.style,
      characterDossier: productionObservability.characterDossier,
      memoryRecall: productionObservability.memoryRecall,
      contextBudget: productionObservability.contextBudget,
      qualitySignals: productionObservability.qualitySignals,
    },
    artifacts,
    chapters: {
      pending: safeState?.plan?.pendingChapters || 0,
      window: {
        start: Number(safeState?.plan?.chapterTaskSummary?.windowStart || 0),
        end: Number(safeState?.plan?.chapterTaskSummary?.windowEnd || 0),
        size: Number(safeState?.plan?.chapterTaskSummary?.windowed || 0),
        total: Number(safeState?.plan?.chapterTaskSummary?.total || safeState?.plan?.totalChapters || 0),
      },
      items: applySequentialChapterBlocking(toArray(safeState?.plan?.chapterTasks).map((task) => mergeChapterFactIntoTask({
        chapterNumber: task.chapterNumber,
        title: task.title,
        status: task.status,
        statusLabel: humanizeTaskStatus(task.status),
        summary: task.summary,
        targetWords: task.targetWords,
        recoveryAttempts: Number(task.recoveryAttempts || 0),
        recoveryBlocked: Boolean(task.recoveryBlocked),
        qualityGate: task.qualityGate || null,
        blueprintPath: blueprintPathByChapter.get(Number(task.chapterNumber)) || "",
      }, chapterFactsByNumber.get(Number(task.chapterNumber))))),
    },
    discussion: {
      recent: Array.isArray(discussionEntries)
        ? discussionEntries
        : entriesFromRecentMessages(factorySnapshot).length > 0
          ? entriesFromRecentMessages(factorySnapshot)
          : parseTranscript(transcript),
    },
    runtime: {
      statusMessage: safeState?.runtime?.statusMessage || "尚未初始化",
      lastRoute: safeState?.runtime?.lastRoute || "unknown",
      lastAction: safeState?.runtime?.lastAction || "none",
      lastUpdatedAt: safeState?.runtime?.lastUpdatedAt || null,
    },
  }
}
