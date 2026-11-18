import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

export type ChapterBlueprintLearningScope = "project" | "system" | "model"
export type ChapterBlueprintLearningStatus = "candidate" | "promoted" | "deprecated"

export interface ChapterBlueprintStateSnapshot {
  runId: string
  volumeId: string
  startChapter: number
  endChapter: number
  batchExitState: string
  unresolvedRisks: string[]
  endingHook: string
  nextChapterEntryState: string
  nextChapterHandoff: string
}

export interface ChapterBlueprintLearningExperience {
  id: string
  fingerprint: string
  errorCode: string
  scope: ChapterBlueprintLearningScope
  title: string
  instruction: string
  status: ChapterBlueprintLearningStatus
  confidence: number
  seenCount: number
  successfulRepairs: number
  failedRepairs: number
  projectIds: string[]
  modelKeys: string[]
  sourceRunIds: string[]
  createdAt: string
  updatedAt: string
}

export interface ChapterBlueprintLearningAttempt {
  runId: string
  round: number
  createdAt: string
  beforeFingerprints: string[]
  afterFingerprints: string[]
  resolvedFingerprints: string[]
  introducedFingerprints: string[]
  remainingFingerprints: string[]
  passed: boolean
}

export interface ChapterBlueprintLearningConflict {
  id: string
  kind: "canon_conflict" | "repair_oscillation" | "no_progress"
  status: "open" | "resolved"
  fingerprints: string[]
  message: string
  sourceRunIds: string[]
  createdAt: string
  updatedAt: string
}

interface ChapterBlueprintLearningMemory {
  schemaVersion: 1
  scope: ChapterBlueprintLearningScope
  projectId?: string
  projectLabel?: string
  modelKey?: string
  experiences: ChapterBlueprintLearningExperience[]
  attempts: ChapterBlueprintLearningAttempt[]
  conflicts: ChapterBlueprintLearningConflict[]
  stateLedger: ChapterBlueprintStateSnapshot[]
  updatedAt: string
}

export interface ChapterBlueprintLearningContext {
  schemaVersion: 1
  promptVersion: string
  projectId: string
  projectLabel: string
  modelKey: string
  loadedAt: string
  activeExperiences: ChapterBlueprintLearningExperience[]
  candidateExperiences: ChapterBlueprintLearningExperience[]
  attempts: ChapterBlueprintLearningAttempt[]
  conflicts: ChapterBlueprintLearningConflict[]
  stateLedger: ChapterBlueprintStateSnapshot[]
  memoryPaths: {
    project: string
    system: string
    model: string
  }
}

interface ErrorKnowledge {
  fingerprint: string
  errorCode: string
  title: string
  instruction: string
}

const BUILTIN_SYSTEM_EXPERIENCES: Array<Pick<ChapterBlueprintLearningExperience, "fingerprint" | "errorCode" | "title" | "instruction">> = [
  {
    fingerprint: "cross_batch_state_reset",
    errorCode: "CROSS_BATCH_STATE_RESET",
    title: "跨批次状态必须单调继承",
    instruction: "所有倒计时、资源、寿命、伤势和人物位置必须从上一批退出状态逐字继承；没有明确恢复事件时，数值只能保持或按事件代价减少。",
  },
  {
    fingerprint: "ability_cost_not_applied",
    errorCode: "TERMINOLOGY_AND_COST_VIOLATION",
    title: "能力激活与代价必须原子更新",
    instruction: "任何能力、道具或术语一旦在行动中被激活，必须在同一章场景卡、不可逆变化和交接状态中同步登记冻结代价；不愿支付代价时应删除激活动作。",
  },
  {
    fingerprint: "chapter_character_scope",
    errorCode: "CHARACTER_SCOPE_VIOLATION",
    title: "场景人物必须属于本章名单",
    instruction: "每张场景卡的 requiredCharacters 必须属于该章 allowedCharacters 或 allowedNewCharacters，远程投影、传音、观察和下令同样视为参与场景。",
  },
  {
    fingerprint: "arc_cumulative_requirement",
    errorCode: "REQUIRED_COST_NOT_MET",
    title: "弧级要求必须读取累计账本",
    instruction: "判断弧级 requiredCost、requiredEvent 或 requiredState 前，必须先检查当前弧此前所有已通过批次；不得把已兑现的代价重复安排到最后一批。",
  },
  {
    fingerprint: "canon_constraint_conflict",
    errorCode: "CANON_CONSTRAINT_CONFLICT",
    title: "冲突正典必须升级处理",
    instruction: "当出口状态、禁止漂移、上一批冻结状态或数值目标互相排斥时，停止机械重写并报告正典冲突；不得在互斥答案之间来回切换。",
  },
]

const ERROR_PATTERNS: Array<{ match: RegExp; knowledge: ErrorKnowledge }> = [
  {
    match: /CROSS_BATCH_STATE_RESET|状态重置|时间回退|凭空增加/u,
    knowledge: BUILTIN_SYSTEM_EXPERIENCES[0],
  },
  {
    match: /TERMINOLOGY_AND_COST_VIOLATION|能力代价|未扣除.{0,12}寿命|激活.{0,16}未/u,
    knowledge: BUILTIN_SYSTEM_EXPERIENCES[1],
  },
  {
    match: /requiredCharacters.*不在本章允许名单|allowedCharacters 包含未冻结人物|未冻结人物/u,
    knowledge: BUILTIN_SYSTEM_EXPERIENCES[2],
  },
  {
    match: /REQUIRED_COST_NOT_MET|MISSING_REQUIRED_COST|requiredCost/u,
    knowledge: BUILTIN_SYSTEM_EXPERIENCES[3],
  },
  {
    match: /ARC_BOUNDARY_EARLY|弧线进度越界|提前消费|提前进入下一弧/u,
    knowledge: {
      fingerprint: "arc_boundary_early",
      errorCode: "ARC_BOUNDARY_EARLY",
      title: "弧线里程碑不得提前消费",
      instruction: "只允许使用当前批次进度合同明确开放的里程碑；未来弧出口只能作为压力或伏笔，不得写成已经发生的状态。",
    },
  },
  {
    match: /FORBIDDEN_DRIFT_VIOLATION|forbiddenDrift|禁止漂移/u,
    knowledge: {
      fingerprint: "forbidden_drift_violation",
      errorCode: "FORBIDDEN_DRIFT_VIOLATION",
      title: "禁止漂移必须保持有效",
      instruction: "逐章检查冻结 forbiddenDrift；若弧末出口要求形成明确特例，必须先由约束优先级或正典修订显式放行，不能由生成模型自行猜测。",
    },
  },
  {
    match: /WORLD_RULE_VIOLATION|世界规则/u,
    knowledge: {
      fingerprint: "world_rule_violation",
      errorCode: "WORLD_RULE_VIOLATION",
      title: "世界规则和特例必须按优先级执行",
      instruction: "先比较章节锚点、弧级特例、禁止漂移和通用世界规则的优先级；特例只能按冻结规模、代价和时机生效。",
    },
  },
  {
    match: /sourceArcIds 必须|sourceArcId 与/u,
    knowledge: {
      fingerprint: "source_arc_mapping",
      errorCode: "SOURCE_ARC_MAPPING",
      title: "章节与主线弧映射必须确定化",
      instruction: "source.sourceArcIds 必须使用本批实际弧列表，逐章 sourceArcId 必须由章节号确定，禁止模型自行改写或重排。",
    },
  },
]

function nowIso() {
  return new Date().toISOString()
}

function stableKey(value: string, prefix: string) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 16)}`
}

function text(value: unknown) {
  return String(value || "").trim()
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => text(entry)).filter(Boolean) : []
}

function defaultMemory(scope: ChapterBlueprintLearningScope): ChapterBlueprintLearningMemory {
  return {
    schemaVersion: 1,
    scope,
    experiences: [],
    attempts: [],
    conflicts: [],
    stateLedger: [],
    updatedAt: nowIso(),
  }
}

async function readMemory(filename: string, scope: ChapterBlueprintLearningScope) {
  try {
    const parsed = JSON.parse(await fs.readFile(filename, "utf8")) as Partial<ChapterBlueprintLearningMemory>
    return {
      ...defaultMemory(scope),
      ...parsed,
      scope,
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      stateLedger: Array.isArray(parsed.stateLedger) ? parsed.stateLedger : [],
    } satisfies ChapterBlueprintLearningMemory
  } catch {
    return defaultMemory(scope)
  }
}

async function writeMemory(filename: string, memory: ChapterBlueprintLearningMemory) {
  await fs.mkdir(path.dirname(filename), { recursive: true })
  const next = { ...memory, updatedAt: nowIso() }
  const temporary = `${filename}.${process.pid}.tmp`
  await fs.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`)
  await fs.rename(temporary, filename)
}

function createExperience(
  scope: ChapterBlueprintLearningScope,
  knowledge: ErrorKnowledge,
  projectId: string,
  modelKey: string,
  runId: string,
  builtin = false,
): ChapterBlueprintLearningExperience {
  const createdAt = nowIso()
  return {
    id: stableKey(`${scope}:${knowledge.fingerprint}`, "lesson"),
    fingerprint: knowledge.fingerprint,
    errorCode: knowledge.errorCode,
    scope,
    title: knowledge.title,
    instruction: knowledge.instruction,
    status: builtin ? "promoted" : "candidate",
    confidence: builtin ? 0.95 : 0.5,
    seenCount: builtin ? 1 : 0,
    successfulRepairs: builtin ? 1 : 0,
    failedRepairs: 0,
    projectIds: projectId ? [projectId] : [],
    modelKeys: modelKey ? [modelKey] : [],
    sourceRunIds: runId ? [runId] : [],
    createdAt,
    updatedAt: createdAt,
  }
}

function seedSystemMemory(memory: ChapterBlueprintLearningMemory) {
  for (const builtin of BUILTIN_SYSTEM_EXPERIENCES) {
    if (memory.experiences.some((entry) => entry.fingerprint === builtin.fingerprint)) continue
    memory.experiences.push(createExperience("system", builtin, "", "", "builtin", true))
  }
  return memory
}

export function deriveChapterBlueprintProjectIdentity(storyBible: Record<string, unknown>) {
  const project = storyBible.project && typeof storyBible.project === "object" && !Array.isArray(storyBible.project)
    ? storyBible.project as Record<string, unknown>
    : {}
  const title = text(project.title) || "untitled"
  const genre = text(project.genre)
  const protagonist = text(project.protagonist)
  const logline = text(project.logline)
  const signature = JSON.stringify({ title, genre, protagonist, logline })
  return {
    projectId: stableKey(signature, "novel"),
    projectLabel: [title, protagonist].filter(Boolean).join(" · "),
  }
}

export function classifyChapterBlueprintError(error: string): ErrorKnowledge {
  const normalized = text(error)
  const matched = ERROR_PATTERNS.find((entry) => entry.match.test(normalized))
  if (matched) return { ...matched.knowledge }
  const explicitCode = normalized.match(/(?:第\s*\d+\s*章\s*)?([A-Z][A-Z0-9_]{3,})\s*[:：]/u)?.[1]
  const structuralPrefix = normalized.match(/^([\w.[\]-]+)\s/u)?.[1]
  const fingerprintSeed = explicitCode || structuralPrefix || normalized.slice(0, 80) || "unknown"
  const fingerprint = `learned_${createHash("sha256").update(fingerprintSeed).digest("hex").slice(0, 12)}`
  return {
    fingerprint,
    errorCode: explicitCode || "UNCLASSIFIED_VALIDATION_ERROR",
    title: explicitCode ? `学习错误 ${explicitCode}` : "未分类校验错误",
    instruction: "根据错误证据定位最小字段集合，只修复相关字段及直接连续性依赖；修复后重新执行结构与正典审计。",
  }
}

function memoryPaths(rootDir: string, projectId: string, modelKey: string) {
  const learningRoot = path.join(rootDir, ".ai-novel-factory", "learning", "chapter-blueprints")
  return {
    project: path.join(learningRoot, "projects", `${projectId}.json`),
    system: path.join(learningRoot, "system-experiences.json"),
    model: path.join(learningRoot, "models", `${modelKey}.json`),
  }
}

function activeExperience(entry: ChapterBlueprintLearningExperience) {
  if (entry.status === "deprecated") return false
  if (entry.status === "promoted") return true
  return entry.successfulRepairs > 0 && entry.confidence >= 0.55
}

function mergeExperiences(...groups: ChapterBlueprintLearningExperience[][]) {
  const merged = new Map<string, ChapterBlueprintLearningExperience>()
  for (const group of groups) {
    for (const entry of group) {
      const key = `${entry.scope}:${entry.fingerprint}`
      if (!merged.has(key) || (merged.get(key)?.updatedAt || "") < entry.updatedAt) merged.set(key, entry)
    }
  }
  return [...merged.values()].sort((a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title, "zh-CN"))
}

function selectActiveExperiences(experiences: ChapterBlueprintLearningExperience[]) {
  const scopePriority: Record<ChapterBlueprintLearningScope, number> = { project: 3, model: 2, system: 1 }
  const selected = new Map<string, ChapterBlueprintLearningExperience>()
  for (const entry of experiences.filter(activeExperience)) {
    const current = selected.get(entry.fingerprint)
    if (!current
      || scopePriority[entry.scope] > scopePriority[current.scope]
      || (scopePriority[entry.scope] === scopePriority[current.scope] && entry.confidence > current.confidence)) {
      selected.set(entry.fingerprint, entry)
    }
  }
  return [...selected.values()].sort((a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title, "zh-CN"))
}

export async function loadChapterBlueprintLearningContext(input: {
  rootDir: string
  storyBible: Record<string, unknown>
  modelName: string
  runId: string
  stateLedger?: ChapterBlueprintStateSnapshot[]
}) {
  const { projectId, projectLabel } = deriveChapterBlueprintProjectIdentity(input.storyBible)
  const modelKey = stableKey(input.modelName || "unknown-model", "model")
  const paths = memoryPaths(input.rootDir, projectId, modelKey)
  const [projectMemory, rawSystemMemory, modelMemory] = await Promise.all([
    readMemory(paths.project, "project"),
    readMemory(paths.system, "system"),
    readMemory(paths.model, "model"),
  ])
  const systemMemory = seedSystemMemory(rawSystemMemory)
  projectMemory.projectId = projectId
  projectMemory.projectLabel = projectLabel
  modelMemory.modelKey = modelKey
  if (input.stateLedger?.length) {
    const snapshots = new Map(projectMemory.stateLedger.map((entry) => [entry.runId, entry]))
    for (const entry of input.stateLedger) snapshots.set(entry.runId, entry)
    projectMemory.stateLedger = [...snapshots.values()].sort((a, b) => a.startChapter - b.startChapter)
  }
  await Promise.all([
    writeMemory(paths.project, projectMemory),
    writeMemory(paths.system, systemMemory),
    writeMemory(paths.model, modelMemory),
  ])
  const allExperiences = mergeExperiences(projectMemory.experiences, systemMemory.experiences, modelMemory.experiences)
  const activeExperiences = selectActiveExperiences(allExperiences)
  return {
    schemaVersion: 1,
    promptVersion: learningPromptVersion(activeExperiences),
    projectId,
    projectLabel,
    modelKey,
    loadedAt: nowIso(),
    activeExperiences,
    candidateExperiences: allExperiences.filter((entry) => entry.status === "candidate"),
    attempts: projectMemory.attempts.slice(-40),
    conflicts: projectMemory.conflicts.filter((entry) => entry.status === "open"),
    stateLedger: projectMemory.stateLedger,
    memoryPaths: paths,
  } satisfies ChapterBlueprintLearningContext
}

function learningPromptVersion(experiences: ChapterBlueprintLearningExperience[]) {
  const promptInputs = experiences.map((entry) => ({
    fingerprint: entry.fingerprint,
    status: entry.status,
    instruction: entry.instruction,
    confidence: entry.confidence,
  }))
  return `chapter-blueprints-learning-v1@${stableKey(JSON.stringify(promptInputs), "prompt")}`
}

function confidence(successfulRepairs: number, failedRepairs: number) {
  return Number(((successfulRepairs + 1) / (successfulRepairs + failedRepairs + 2)).toFixed(3))
}

function upsertExperience(input: {
  memory: ChapterBlueprintLearningMemory
  scope: ChapterBlueprintLearningScope
  knowledge: ErrorKnowledge
  projectId: string
  modelKey: string
  runId: string
  resolved: boolean
}) {
  let entry = input.memory.experiences.find((candidate) => candidate.fingerprint === input.knowledge.fingerprint)
  if (!entry) {
    entry = createExperience(input.scope, input.knowledge, input.projectId, input.modelKey, input.runId)
    input.memory.experiences.push(entry)
  }
  entry.seenCount += 1
  if (input.resolved) entry.successfulRepairs += 1
  else entry.failedRepairs += 1
  if (!entry.projectIds.includes(input.projectId)) entry.projectIds.push(input.projectId)
  if (!entry.modelKeys.includes(input.modelKey)) entry.modelKeys.push(input.modelKey)
  if (!entry.sourceRunIds.includes(input.runId)) entry.sourceRunIds.push(input.runId)
  entry.sourceRunIds = entry.sourceRunIds.slice(-30)
  entry.confidence = confidence(entry.successfulRepairs, entry.failedRepairs)
  const promotionReady = input.scope === "project"
    ? entry.successfulRepairs >= 2 && entry.confidence >= 0.6
    : input.scope === "model"
      ? entry.successfulRepairs >= 2 && entry.confidence >= 0.6
      : entry.successfulRepairs >= 3 && entry.projectIds.length >= 2 && entry.confidence >= 0.65
  entry.status = promotionReady || entry.status === "promoted" ? "promoted" : entry.status === "deprecated" ? "deprecated" : "candidate"
  entry.updatedAt = nowIso()
}

function detectConflict(attempts: ChapterBlueprintLearningAttempt[], runId: string) {
  const runAttempts = attempts.filter((entry) => entry.runId === runId)
  const latestAttempt = runAttempts.at(-1)
  const simultaneousFingerprints = new Set(latestAttempt?.afterFingerprints || [])
  if (simultaneousFingerprints.has("forbidden_drift_violation") && simultaneousFingerprints.has("arc_boundary_early")) {
    return {
      id: stableKey(`${runId}:arc-exit-vs-forbidden-drift`, "conflict"),
      kind: "canon_conflict",
      status: "open",
      fingerprints: ["forbidden_drift_violation", "arc_boundary_early"],
      message: "同一 Run 同时被要求保留 forbiddenDrift 又被要求兑现互斥的弧末 exitState；这属于上游正典冲突，必须先统一约束，不能继续机械重写。",
      sourceRunIds: [runId],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } satisfies ChapterBlueprintLearningConflict
  }
  const noProgressWindow = 5
  const recentAttempts = runAttempts.slice(-noProgressWindow)
  if (recentAttempts.length === noProgressWindow && recentAttempts.every((entry) => entry.resolvedFingerprints.length === 0 && !entry.passed)) {
    return {
      id: stableKey(`${runId}:no-progress:${recentAttempts.flatMap((entry) => entry.remainingFingerprints).sort().join(",")}`, "conflict"),
      kind: "no_progress",
      status: "open",
      fingerprints: [...new Set(recentAttempts.flatMap((entry) => entry.remainingFingerprints))],
      message: `连续 ${noProgressWindow} 轮没有消除任何错误指纹；Learning Loop 已停止，避免在不可收敛结果上无限消耗模型调用。`,
      sourceRunIds: [runId],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } satisfies ChapterBlueprintLearningConflict
  }
  return null
}

export async function recordChapterBlueprintLearningAttempt(input: {
  rootDir: string
  context: ChapterBlueprintLearningContext
  runId: string
  round: number
  beforeErrors: string[]
  afterErrors: string[]
  passed: boolean
}) {
  const beforeKnowledge = input.beforeErrors.map(classifyChapterBlueprintError)
  const afterKnowledge = input.afterErrors.map(classifyChapterBlueprintError)
  const beforeFingerprints = [...new Set(beforeKnowledge.map((entry) => entry.fingerprint))]
  const afterFingerprints = [...new Set(afterKnowledge.map((entry) => entry.fingerprint))]
  const resolvedFingerprints = beforeFingerprints.filter((entry) => !afterFingerprints.includes(entry))
  const introducedFingerprints = afterFingerprints.filter((entry) => !beforeFingerprints.includes(entry))
  const remainingFingerprints = beforeFingerprints.filter((entry) => afterFingerprints.includes(entry))
  const attempt: ChapterBlueprintLearningAttempt = {
    runId: input.runId,
    round: input.round,
    createdAt: nowIso(),
    beforeFingerprints,
    afterFingerprints,
    resolvedFingerprints,
    introducedFingerprints,
    remainingFingerprints,
    passed: input.passed,
  }
  const [projectMemory, systemMemory, modelMemory] = await Promise.all([
    readMemory(input.context.memoryPaths.project, "project"),
    readMemory(input.context.memoryPaths.system, "system").then(seedSystemMemory),
    readMemory(input.context.memoryPaths.model, "model"),
  ])
  projectMemory.projectId = input.context.projectId
  projectMemory.projectLabel = input.context.projectLabel
  modelMemory.modelKey = input.context.modelKey
  for (const knowledge of beforeKnowledge) {
    const resolved = resolvedFingerprints.includes(knowledge.fingerprint)
    upsertExperience({ memory: projectMemory, scope: "project", knowledge, projectId: input.context.projectId, modelKey: input.context.modelKey, runId: input.runId, resolved })
    upsertExperience({ memory: systemMemory, scope: "system", knowledge, projectId: input.context.projectId, modelKey: input.context.modelKey, runId: input.runId, resolved })
    upsertExperience({ memory: modelMemory, scope: "model", knowledge, projectId: input.context.projectId, modelKey: input.context.modelKey, runId: input.runId, resolved })
  }
  projectMemory.attempts.push(attempt)
  projectMemory.attempts = projectMemory.attempts.slice(-200)
  if (input.passed) {
    for (const existing of projectMemory.conflicts) {
      if (existing.status === "open" && existing.fingerprints.some((fingerprint) => beforeFingerprints.includes(fingerprint))) {
        existing.status = "resolved"
        existing.updatedAt = nowIso()
      }
    }
  }
  const conflict = input.passed ? null : detectConflict(projectMemory.attempts, input.runId)
  if (conflict) {
    const existing = projectMemory.conflicts.find((entry) => entry.id === conflict.id)
    if (existing) existing.updatedAt = nowIso()
    else projectMemory.conflicts.push(conflict)
  }
  await Promise.all([
    writeMemory(input.context.memoryPaths.project, projectMemory),
    writeMemory(input.context.memoryPaths.system, systemMemory),
    writeMemory(input.context.memoryPaths.model, modelMemory),
  ])
  const allExperiences = mergeExperiences(projectMemory.experiences, systemMemory.experiences, modelMemory.experiences)
  const activeExperiences = selectActiveExperiences(allExperiences)
  return {
    ...input.context,
    promptVersion: learningPromptVersion(activeExperiences),
    activeExperiences,
    candidateExperiences: allExperiences.filter((entry) => entry.status === "candidate"),
    attempts: projectMemory.attempts.slice(-40),
    conflicts: projectMemory.conflicts.filter((entry) => entry.status === "open"),
  } satisfies ChapterBlueprintLearningContext
}

export async function recordChapterBlueprintStateSnapshot(input: {
  context: ChapterBlueprintLearningContext
  snapshot: ChapterBlueprintStateSnapshot
}) {
  const memory = await readMemory(input.context.memoryPaths.project, "project")
  const snapshots = new Map(memory.stateLedger.map((entry) => [entry.runId, entry]))
  snapshots.set(input.snapshot.runId, input.snapshot)
  memory.stateLedger = [...snapshots.values()].sort((a, b) => a.startChapter - b.startChapter)
  await writeMemory(input.context.memoryPaths.project, memory)
  return {
    ...input.context,
    stateLedger: memory.stateLedger,
  } satisfies ChapterBlueprintLearningContext
}

export function compileChapterBlueprintLearningPrompt(context: ChapterBlueprintLearningContext) {
  const scopeLabel: Record<ChapterBlueprintLearningScope, string> = {
    system: "系统级可复用经验",
    model: "当前模型适配经验",
    project: "本小说已验证经验",
  }
  const experiences = context.activeExperiences.length
    ? context.activeExperiences.map((entry, index) => `${index + 1}. [${scopeLabel[entry.scope]}｜${entry.status}｜置信度 ${entry.confidence.toFixed(2)}] ${entry.title}：${entry.instruction}`)
    : ["1. 暂无已验证学习经验；本次结果将作为首批学习证据。"]
  const ledger = context.stateLedger.length
    ? context.stateLedger.map((entry) => ({
        runId: entry.runId,
        chapters: `${entry.startChapter}-${entry.endChapter}`,
        batchExitState: entry.batchExitState,
        unresolvedRisks: entry.unresolvedRisks,
        nextChapterEntryState: entry.nextChapterEntryState,
        nextChapterHandoff: entry.nextChapterHandoff,
      }))
    : []
  return [
    `Learning Loop Prompt 版本：${context.promptVersion}`,
    `小说记忆空间：${context.projectLabel}（${context.projectId}）`,
    `模型适配空间：${context.modelKey}`,
    "以下经验来自持久化学习库；系统规则不得写入小说专有名称或情节：",
    ...experiences,
    "当前小说跨批次状态账本（仅属于本小说，不得晋升为系统内容）：",
    ledger.length ? JSON.stringify(ledger, null, 2) : "无历史批次状态。",
    context.conflicts.length
      ? `当前存在未解决学习冲突：${context.conflicts.map((entry) => entry.message).join("｜")}`
      : "当前无未解决学习冲突。",
  ].join("\n")
}

export function chapterBlueprintLearningShouldStop(context: ChapterBlueprintLearningContext, runId: string) {
  const conflict = context.conflicts.find((entry) => (
    entry.status === "open"
    && entry.sourceRunIds.includes(runId)
    && entry.kind === "no_progress"
  ))
  return conflict ? { stop: true, reason: conflict.message, conflict } : { stop: false, reason: "" }
}

export const chapterBlueprintBuiltinLearningRules = BUILTIN_SYSTEM_EXPERIENCES.map((entry) => ({ ...entry }))
