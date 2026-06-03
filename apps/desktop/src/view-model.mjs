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

function parseTranscript(transcript = "") {
  const blocks = transcript
    .split(/^##\s+/m)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.flatMap((block, blockIndex) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
    return lines
      .filter((line) => /^(User|Showrunner|World Architect|Author|Editor|Reviewer|Prose Stylist):/.test(line))
      .map((line, lineIndex) => {
        const separator = line.indexOf(":")
        return {
          key: `transcript-${blockIndex}-${lineIndex}`,
          role: line.slice(0, separator),
          content: line.slice(separator + 1).trim(),
        }
      })
  })
}

export function deriveStudioViewModel({ state, transcript = "", envStatus = null, providerResult = null } = {}) {
  const safeState = state || null
  const stageKey = safeState?.runtime?.stage || "worldbuilding_dialogue"
  const currentStage = STAGE_METADATA[stageKey] || {
    label: stageKey,
    description: safeState?.runtime?.statusMessage || "等待初始化。",
  }

  const stageIndex = WORKFLOW_STEPS.findIndex((step) => step.key === stageKey)
  const workflow = {
    currentStage: {
      key: stageKey,
      ...currentStage,
      rawStatus: safeState?.runtime?.statusMessage || "Workspace not initialized.",
    },
    steps: WORKFLOW_STEPS.map((step, index) => ({
      ...step,
      state: index < stageIndex ? "completed" : index === stageIndex ? "active" : "locked",
    })),
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
    provider,
    storyMemory: {
      idea: safeState?.project?.idea || "请先初始化项目。",
      openQuestions: toArray(safeState?.reactSetup?.unansweredQuestions),
    },
    chapters: {
      pending: safeState?.plan?.pendingChapters || 0,
      items: toArray(safeState?.plan?.chapterTasks).map((task) => ({
        chapterNumber: task.chapterNumber,
        title: task.title,
        status: task.status,
        statusLabel: humanizeTaskStatus(task.status),
        summary: task.summary,
        targetWords: task.targetWords,
      })),
    },
    discussion: {
      recent: parseTranscript(transcript),
    },
    runtime: {
      statusMessage: safeState?.runtime?.statusMessage || "尚未初始化",
      lastRoute: safeState?.runtime?.lastRoute || "unknown",
      lastAction: safeState?.runtime?.lastAction || "none",
      lastUpdatedAt: safeState?.runtime?.lastUpdatedAt || null,
    },
  }
}
