// src/project-runtime-state.ts
var PRODUCTION_STAGES = /* @__PURE__ */ new Set([
  "setting_review",
  "master_planning",
  "chapter_task_generation",
  "drafting",
  "reviewing",
  "replanning"
]);
var PLANNING_STAGES = /* @__PURE__ */ new Set([
  "setting_review",
  "master_planning"
]);
function toArray(value) {
  return Array.isArray(value) ? value : [];
}
function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
function normalizeTaskStatus(value) {
  return value === "complete" || value === "in_progress" || value === "blocked" || value === "pending" ? value : "pending";
}
function normalizeChapterRows(rows) {
  return toArray(rows).map((row) => ({
    chapterNumber: finiteNumber(row.chapterNumber, 0),
    status: normalizeTaskStatus(row.status)
  })).filter((row) => row.chapterNumber > 0).sort((left, right) => left.chapterNumber - right.chapterNumber);
}
function deriveChapterProgress(state, factorySnapshot) {
  const plan = state?.plan || {};
  const taskSummary = plan.chapterTaskSummary || {};
  const tasks = normalizeChapterRows(plan.chapterTasks);
  const facts = normalizeChapterRows(factorySnapshot?.chapterFacts);
  const rows = facts.length > 0 ? facts : tasks;
  const explicitTotal = finiteNumber(plan.totalChapters, 0);
  const summaryTotal = finiteNumber(taskSummary.total, 0);
  const projectTotal = finiteNumber(factorySnapshot?.project?.totalChapters, 0);
  const maxRowChapter = rows.reduce((max, row) => Math.max(max, row.chapterNumber), 0);
  const totalChapters = Math.max(explicitTotal, summaryTotal, projectTotal, maxRowChapter);
  const countStatus = (status) => rows.filter((row) => row.status === status).length;
  const passedChapters = rows.length > 0 ? countStatus("complete") : finiteNumber(taskSummary.complete, 0);
  const inProgressChapters = rows.length > 0 ? countStatus("in_progress") : finiteNumber(taskSummary.inProgress, 0);
  const blockedChapters = rows.length > 0 ? countStatus("blocked") : finiteNumber(taskSummary.blocked, 0);
  let contiguousCompletedChapters = 0;
  if (rows.length > 0) {
    const rowsByChapter = new Map(rows.map((row) => [row.chapterNumber, row]));
    for (let chapterNumber = 1; chapterNumber <= totalChapters; chapterNumber += 1) {
      if (rowsByChapter.get(chapterNumber)?.status !== "complete") break;
      contiguousCompletedChapters += 1;
    }
  } else {
    contiguousCompletedChapters = passedChapters;
  }
  const completedChapters = Math.min(passedChapters, contiguousCompletedChapters);
  const pendingFromRows = totalChapters > 0 ? Math.max(0, totalChapters - passedChapters - inProgressChapters - blockedChapters) : 0;
  const pendingChapters = rows.length > 0 ? pendingFromRows : finiteNumber(plan.pendingChapters ?? taskSummary.pending, pendingFromRows);
  const nextChapterNumber = totalChapters > 0 && completedChapters < totalChapters ? completedChapters + 1 : null;
  const progressPercent = totalChapters > 0 ? Math.max(0, Math.min(100, Math.round(completedChapters / totalChapters * 100))) : 0;
  return {
    totalChapters,
    completedChapters,
    passedChapters,
    contiguousCompletedChapters,
    pendingChapters: Math.max(0, pendingChapters),
    inProgressChapters,
    blockedChapters,
    nextChapterNumber,
    progressPercent
  };
}
function normalizeStage(rawStage, progress) {
  const stage = typeof rawStage === "string" && rawStage ? rawStage : "empty";
  if (stage === "complete") {
    const reallyComplete = progress.totalChapters > 0 && progress.completedChapters >= progress.totalChapters && progress.blockedChapters === 0 && progress.inProgressChapters === 0;
    if (!reallyComplete) {
      return progress.blockedChapters > 0 ? "reviewing" : "drafting";
    }
  }
  if (stage === "worldbuilding_dialogue" || stage === "setting_review" || stage === "master_planning" || stage === "chapter_task_generation" || stage === "drafting" || stage === "reviewing" || stage === "replanning" || stage === "complete") {
    return stage;
  }
  return stage === "empty" ? "empty" : "unknown";
}
function hasLease(job) {
  return Boolean(job.lease_owner || job.leaseOwner);
}
function isJobRecoverable(job) {
  return job.status === "paused" || !hasLease(job);
}
function deriveJobCounts(factorySnapshot) {
  const activeJobs = toArray(factorySnapshot?.activeJobs);
  const runnableJobs = toArray(factorySnapshot?.runnableJobs);
  const activeRuns = toArray(factorySnapshot?.activeRuns);
  const active = activeJobs.length > 0 ? activeJobs : activeRuns;
  const recoverableIds = new Set(
    [...active, ...runnableJobs].filter(isJobRecoverable).map((job) => String(job.id || ""))
  );
  const runningJobs = active.filter(
    (job) => job.status === "running" && hasLease(job) && !recoverableIds.has(String(job.id || ""))
  );
  return {
    activeJobs: active.length,
    runnableJobs: runnableJobs.length,
    runningJobs: runningJobs.length,
    recoverableJobs: recoverableIds.size
  };
}
function deriveProductionStatus(stage, progress) {
  if (stage === "empty") return "not_started";
  if (stage === "unknown") return "unknown";
  if (stage === "complete") return "complete";
  if (progress.blockedChapters > 0) return "blocked";
  if (stage === "worldbuilding_dialogue") return "worldbuilding";
  if (PLANNING_STAGES.has(stage)) return "planning";
  if (stage === "chapter_task_generation") return "ready_to_draft";
  if (stage === "reviewing") return "reviewing";
  if (stage === "replanning") return "replanning";
  if (stage === "drafting") return "drafting";
  return "unknown";
}
function deriveExecutionStatus(state, factorySnapshot, productionStatus, jobs) {
  const autopilot = state?.runtime?.autopilot || {};
  if (autopilot.stopRequested) return "stopping";
  if (jobs.runningJobs > 0 || autopilot.running) return "running";
  if (productionStatus === "blocked" || autopilot.driftStatus === "blocked") return "blocked";
  if (jobs.recoverableJobs > 0) return "paused";
  if (jobs.runnableJobs > 0) return "queued";
  return factorySnapshot || state ? "idle" : "unknown";
}
function actionLabel(action) {
  switch (action) {
    case "start":
      return "\u5F00\u59CB\u521B\u4F5C";
    case "continue":
      return "\u7EE7\u7EED\u521B\u4F5C";
    case "resume":
      return "\u7EE7\u7EED\u521B\u4F5C";
    case "pause":
      return "\u6682\u505C\u5E76\u4FDD\u7559\u8FDB\u5EA6";
    case "retry_blocked":
      return "\u4FEE\u590D\u963B\u585E";
    case "review":
      return "\u8FDB\u5165\u5BA1\u9605";
    case "none":
    default:
      return "\u65E0\u9700\u64CD\u4F5C";
  }
}
function derivePrimaryAction(stage, productionStatus, executionStatus, progress) {
  if (executionStatus === "running" || executionStatus === "stopping") return "pause";
  if (executionStatus === "paused" || executionStatus === "queued") return "resume";
  if (productionStatus === "complete") return "none";
  if (productionStatus === "blocked" || executionStatus === "blocked") return "retry_blocked";
  if (productionStatus === "reviewing") return "review";
  const hasChapterWork = progress.completedChapters > 0 || progress.passedChapters > 0 || progress.inProgressChapters > 0 || progress.blockedChapters > 0;
  if (PRODUCTION_STAGES.has(stage) || hasChapterWork) {
    return "continue";
  }
  return "start";
}
function deriveNextTarget(stage, productionStatus, progress) {
  if (productionStatus === "complete") return null;
  const hasChapterWork = progress.completedChapters > 0 || progress.passedChapters > 0 || progress.inProgressChapters > 0 || progress.blockedChapters > 0;
  if (progress.nextChapterNumber && (PRODUCTION_STAGES.has(stage) || hasChapterWork)) {
    return { type: "chapter", chapterNumber: progress.nextChapterNumber };
  }
  if (stage !== "empty" && stage !== "unknown") return { type: "stage", stage };
  return { type: "project" };
}
function deriveReason(productionStatus, executionStatus, progress, nextTarget) {
  if (executionStatus === "running") return "\u540E\u53F0\u521B\u4F5C\u4EFB\u52A1\u6B63\u5728\u8FD0\u884C\u3002";
  if (executionStatus === "paused") return "\u68C0\u6D4B\u5230\u53EF\u6062\u590D\u4EFB\u52A1\uFF0C\u53EF\u7EE7\u7EED\u521B\u4F5C\u3002";
  if (executionStatus === "queued") return "\u4EFB\u52A1\u5DF2\u5728\u961F\u5217\u4E2D\uFF0C\u7B49\u5F85 worker \u6267\u884C\u3002";
  if (productionStatus === "blocked") {
    const chapterText = nextTarget?.type === "chapter" ? `\u7B2C ${nextTarget.chapterNumber} \u7AE0` : "\u5F53\u524D\u7AE0\u8282";
    return `${chapterText}\u5B58\u5728\u963B\u585E\uFF0C\u9700\u8981\u4FEE\u590D\u540E\u7EE7\u7EED\u3002`;
  }
  if (productionStatus === "complete") return "\u5168\u90E8\u7AE0\u8282\u4EFB\u52A1\u5DF2\u5B8C\u6210\u3002";
  if (nextTarget?.type === "chapter") {
    return `\u9879\u76EE\u5DF2\u8FDB\u5165\u6B63\u6587\u5199\u4F5C\uFF0C\u5F53\u524D\u6CA1\u6709\u540E\u53F0\u4EFB\u52A1\u8FD0\u884C\uFF0C\u53EF\u4ECE\u7B2C ${nextTarget.chapterNumber} \u7AE0\u7EE7\u7EED\u3002`;
  }
  if (productionStatus === "not_started" || productionStatus === "worldbuilding") return "\u9879\u76EE\u5C1A\u672A\u8FDB\u5165\u6B63\u6587\u751F\u4EA7\u6D41\u7A0B\u3002";
  return "\u5F53\u524D\u6CA1\u6709\u540E\u53F0\u4EFB\u52A1\u8FD0\u884C\uFF0C\u53EF\u7EE7\u7EED\u63A8\u8FDB\u9879\u76EE\u3002";
}
function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value) return value;
  }
  return "";
}
function deriveProjectRuntimeState(input = {}) {
  const state = input.factorySnapshot?.state || input.state || null;
  const factorySnapshot = input.factorySnapshot || null;
  const progress = deriveChapterProgress(state, factorySnapshot);
  const rawWorkflowStage = String(state?.runtime?.stage || "empty");
  const workflowStage = normalizeStage(rawWorkflowStage, progress);
  const productionStatus = deriveProductionStatus(workflowStage, progress);
  const jobs = deriveJobCounts(factorySnapshot);
  const executionStatus = deriveExecutionStatus(state, factorySnapshot, productionStatus, jobs);
  const primaryAction = derivePrimaryAction(workflowStage, productionStatus, executionStatus, progress);
  const nextTarget = deriveNextTarget(workflowStage, productionStatus, progress);
  const updatedAt = typeof input.now === "string" ? input.now : input.now instanceof Date ? input.now.toISOString() : firstString(
    state?.runtime?.autopilot?.updatedAt,
    factorySnapshot?.latestEvents?.[0]?.created_at,
    factorySnapshot?.latestEvents?.[0]?.updated_at,
    state?.runtime?.lastUpdatedAt,
    factorySnapshot?.project?.updatedAt,
    factorySnapshot?.project?.createdAt
  );
  return {
    workflowStage,
    rawWorkflowStage,
    productionStatus,
    executionStatus,
    primaryAction,
    primaryActionLabel: actionLabel(primaryAction),
    nextTarget,
    reason: deriveReason(productionStatus, executionStatus, progress, nextTarget),
    chapterProgress: progress,
    runningJobs: jobs.runningJobs,
    recoverableJobs: jobs.recoverableJobs,
    runnableJobs: jobs.runnableJobs,
    activeJobs: jobs.activeJobs,
    updatedAt
  };
}

// src/router.ts
function routeUserMessage(message, state) {
  const normalized = message.toLowerCase();
  if (normalized.includes("\u9636\u6BB5") || normalized.includes("\u72B6\u6001") || normalized.includes("\u8FDB\u5EA6") || normalized.includes("status") || normalized.includes("\u73B0\u5728\u8FDB\u884C\u5230")) {
    return {
      type: "status_query",
      reason: `The message asks about current progress while the project is at ${state.runtime.stage}.`
    };
  }
  if (normalized.includes("\u7EE7\u7EED") || normalized.includes("\u4E0B\u4E00\u6B65") || normalized.includes("advance") || normalized.includes("\u63A8\u8FDB")) {
    return {
      type: "workflow_control",
      reason: "The message requests moving the workflow forward."
    };
  }
  if (normalized.includes("\u6574\u4E2A\u6545\u4E8B") || normalized.includes("\u6539\u6210") || normalized.includes("\u91CD\u5199") || normalized.includes("\u98CE\u683C") || normalized.includes("genre")) {
    return {
      type: "interruption_change",
      reason: "The message suggests a change that may alter story direction or project-wide assumptions."
    };
  }
  return {
    type: "worldbuilding",
    reason: "The message adds or refines story content and should enter the multi-agent discussion flow."
  };
}

export {
  deriveProjectRuntimeState,
  routeUserMessage
};
