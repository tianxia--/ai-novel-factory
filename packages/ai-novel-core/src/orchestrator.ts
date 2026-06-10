import fs from "node:fs/promises"
import { randomUUID } from "node:crypto"
import path from "node:path"

import type {
  AutonomousNovelState,
  ChapterTask,
  CreativeProfile,
  InitProjectOptions,
  InterruptOptions,
  InterruptionReview,
  InterruptionScope,
  NovelProjectRecord,
} from "./cli-types"
import { loadLlmConfigFromEnv } from "./llm-config"
import { initializeSuperGraph } from "./super-graph"
import { withFactoryDb } from "./factory-db"
import {
  runChapterProductionPipeline,
  writeAllDetailedChapterBlueprints,
  writeProductionMasterOutline,
  writeProductionWritingResourceArtifacts,
  type ProductionPipelineOptions,
} from "./writing-pipeline"
import type { ChapterProductionFact } from "./factory-db"
import { throwIfStopped } from "./abort"
import { syncCurrentContextPacketFile } from "./context-packet"

const WORKSPACE_DIR = ".ai-novel"
const PROJECTS_DIR = ".ai-novel-projects"
const PROJECTS_REGISTRY_FILE = "projects.json"
const WORKSPACE_VERSION = 1
const MIN_CHAPTER_WORD_TARGET = 2500
const DEFAULT_CHAPTER_RECOVERY_LIMIT = 3
const DEFAULT_CHARACTER_PROFILE_REQUIREMENTS = [
  "canonical name",
  "identity and role function",
  "core desire",
  "fear or wound",
  "behavior habit",
  "speech marker",
  "appearance or body marker",
  "skill, limitation, and cost",
  "relationship state",
  "current chapter delta",
]
const AGENT_ROLES = [
  "showrunner",
  "world-architect",
  "author",
  "editor",
  "reviewer",
  "prose-stylist",
] as const

function slugifyTitle(title: string) {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return cleaned || "untitled-novel"
}

function inferTitleFromIdea(idea: string) {
  const firstWords = idea.trim().split(/\s+/).slice(0, 6).join(" ")
  return firstWords ? `${firstWords} Project` : "Untitled Novel Project"
}

function stageRoute(stage: AutonomousNovelState["runtime"]["stage"]) {
  switch (stage) {
    case "worldbuilding_dialogue":
      return "worldbuilding"
    case "setting_review":
      return "setting_review"
    case "master_planning":
      return "master_planning"
    case "chapter_task_generation":
      return "chapter_task_generation"
    case "drafting":
      return "drafting"
    case "reviewing":
      return "reviewing"
    case "replanning":
      return "replanning"
    case "complete":
      return "complete"
    default:
      return "workflow"
  }
}

function stampRuntimeProgress(
  state: AutonomousNovelState,
  action: string,
  route = stageRoute(state.runtime.stage),
) {
  state.runtime.lastRoute = route
  state.runtime.lastAction = action
}

function getProjectsPaths(rootDir: string) {
  const projectsRoot = path.join(rootDir, PROJECTS_DIR)
  return {
    projectsRoot,
    registryPath: path.join(projectsRoot, PROJECTS_REGISTRY_FILE),
  }
}

async function readProjectRegistry(rootDir: string): Promise<NovelProjectRecord[]> {
  const { registryPath } = getProjectsPaths(rootDir)
  try {
    const raw = await fs.readFile(registryPath, "utf8")
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeProjectRegistry(rootDir: string, projects: NovelProjectRecord[]) {
  const { projectsRoot, registryPath } = getProjectsPaths(rootDir)
  await fs.mkdir(projectsRoot, { recursive: true })
  await fs.writeFile(registryPath, `${JSON.stringify(projects, null, 2)}\n`)
}

function createUniqueProjectId(baseSlug: string, projects: NovelProjectRecord[]) {
  const existingIds = new Set(projects.map((project) => project.id))
  if (!existingIds.has(baseSlug)) {
    return baseSlug
  }

  let suffix = 2
  while (existingIds.has(`${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}

function resolveProjectRoot(rootDir: string, projectId: string) {
  return path.join(rootDir, PROJECTS_DIR, projectId)
}

function resolveStoredProjectRoot(rootDir: string, projectRoot: string, projectId: string) {
  if (path.isAbsolute(projectRoot)) {
    return projectRoot
  }

  const rootRelative = path.resolve(rootDir, projectRoot)
  const managedRoot = resolveProjectRoot(rootDir, projectId)
  if (path.normalize(projectRoot).includes(`${PROJECTS_DIR}${path.sep}`)) {
    return managedRoot
  }

  return rootRelative
}

function buildChapterCausalPlan(chapterNumber: number, totalChapters: number, projectIdea: string): NonNullable<ChapterTask["causalPlan"]> {
  const arcSize = Math.max(3, Math.ceil(totalChapters / 4))
  const arcNumber = Math.ceil(chapterNumber / arcSize)
  const arcStart = (arcNumber - 1) * arcSize + 1
  const arcEnd = Math.min(totalChapters, arcStart + arcSize - 1)
  const positionInArc = chapterNumber - arcStart + 1
  const isFirstChapter = chapterNumber === 1
  const isLastChapter = chapterNumber === totalChapters
  const previousLabel = isFirstChapter ? "原始创作目标和设定冻结结论" : `第 ${chapterNumber - 1} 章留下的状态、物件、关系、代价和未解决问题`
  const nextLabel = isLastChapter ? "全书结局兑现与余味" : `第 ${chapterNumber + 1} 章必须继续处理的压力、线索和人物关系`
  const phaseObjective = positionInArc === 1
    ? "打开本弧线的新压力，并把上一弧/上一章的代价带入现场"
    : chapterNumber === arcEnd
      ? "兑现本弧线的局部结果，同时制造更高层级的问题"
      : "让当前冲突升级一次，并把主角推向更困难的选择"

  return {
    previousInput: `承接：${previousLabel}；不能只复用主角姓名另起无关剧情。`,
    sceneObjective: `推进：围绕「${projectIdea}」在第 ${arcNumber} 弧（第 ${arcStart}-${arcEnd} 章）完成一次具体情节推进：${phaseObjective}。`,
    protagonistDecision: "主角必须在可见压力下主动做出选择，选择要暴露欲望、弱点、能力边界或价值取舍。",
    irreversibleConsequence: "本章结尾必须留下不可逆变化：身份风险、关系裂缝、线索暴露、资源损失、权力压力或世界规则后果至少一项。",
    nextHandoff: `交棒：把本章的不可逆变化转化为${nextLabel}。`,
    requiredContinuityAnchors: isFirstChapter
      ? ["主角唯一身份", "核心缺口", "第一枚主线线索"]
      : ["上一章关键物件", "上一章关系变化", "上一章未解决问题", "上一章代价"],
    characterStateDelta: "角色状态必须发生可追踪变化：信任、债务、恐惧、野心、伤口或阵营关系至少一项进入记忆账本。",
    foreshadowingOperation: chapterNumber % 3 === 0
      ? "回收或部分兑现一个前序伏笔，同时延后一个更大的问题。"
      : "新增一个可追踪伏笔，并明确它与主线或角色伤口的关系。",
  }
}

function chapterTaskSummary(chapterNumber: number, causalPlan: NonNullable<ChapterTask["causalPlan"]>) {
  return [
    `承接：${causalPlan.previousInput.replace(/^承接：/u, "")}`,
    `推进：${causalPlan.sceneObjective.replace(/^推进：/u, "")}`,
    `选择：${causalPlan.protagonistDecision}`,
    `代价：${causalPlan.irreversibleConsequence}`,
    `交棒：${causalPlan.nextHandoff.replace(/^交棒：/u, "")}`,
  ].join(" ")
}

function buildChapterTasks(totalChapters: number, chapterWordTarget: number, projectIdea: string): ChapterTask[] {
  return Array.from({ length: totalChapters }, (_, index) => {
    const chapterNumber = index + 1
    const causalPlan = buildChapterCausalPlan(chapterNumber, totalChapters, projectIdea)
    return {
      chapterNumber,
      title: `Chapter ${chapterNumber}`,
      status: "pending",
      summary: chapterTaskSummary(chapterNumber, causalPlan),
      targetWords: chapterWordTarget,
      causalPlan,
    }
  })
}

function cleanProfileValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function normalizeNaturalnessTarget(value: unknown): CreativeProfile["naturalnessTarget"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (normalized === "light" || normalized === "strict") {
    return normalized
  }
  return "balanced"
}

function buildCreativeProfile(options: InitProjectOptions): CreativeProfile {
  const input = options.creativeProfile || {}
  return {
    genre: cleanProfileValue(input.genre, "auto-inferred"),
    platform: cleanProfileValue(input.platform, "serialized web novel"),
    readerPromise: cleanProfileValue(input.readerPromise, "hook-forward, scene-first, emotionally specific"),
    pointOfView: cleanProfileValue(input.pointOfView, "third-person limited"),
    tone: cleanProfileValue(input.tone, "tense but readable"),
    naturalnessTarget: normalizeNaturalnessTarget(input.naturalnessTarget),
    styleFingerprint: cleanProfileValue(input.styleFingerprint, "pending sample or first-chapter extraction"),
    characterProfileRequirements: Array.isArray(input.characterProfileRequirements) && input.characterProfileRequirements.length
      ? input.characterProfileRequirements.map((entry) => cleanProfileValue(entry, "")).filter(Boolean)
      : DEFAULT_CHARACTER_PROFILE_REQUIREMENTS,
  }
}

function buildInitialState(options: InitProjectOptions): AutonomousNovelState {
  const now = new Date().toISOString()
  const title = options.title?.trim() || inferTitleFromIdea(options.idea)
  const projectIdea = options.idea.trim()
  const chapterTasks = buildChapterTasks(options.totalChapters, options.chapterWordTarget, projectIdea)
  const creativeProfile = buildCreativeProfile(options)

  return {
    project: {
      title,
      idea: projectIdea,
      createdAt: now,
      workspaceVersion: WORKSPACE_VERSION,
      creativeProfile,
    },
    runtime: {
      stage: "worldbuilding_dialogue",
      statusMessage: "Collecting worldbuilding answers through the ReAct discussion phase.",
      lastUpdatedAt: now,
      lastInterruption: null,
      lastRoute: "init",
      lastAction: "workspace initialized",
      lastProviderCheck: null,
      autopilot: {
        running: false,
        stopRequested: false,
        startedAt: null,
        updatedAt: null,
        lastStep: null,
        mode: "idle",
        target: null,
        driftScore: 0,
        driftStatus: "ok",
        driftReason: null,
        checkpointPath: null,
        loopCount: 0,
      },
    },
    reactSetup: {
      discussionGoals: [
        "Clarify genre, promise, and target reader emotion.",
        "Lock the world rules, power ceiling, and conflict engine.",
        "Define protagonist wound, desire, and long-arc transformation.",
        "Set chapter count, pacing targets, and taboo constraints.",
      ],
      unansweredQuestions: [
        "What emotional payoff should the ending deliver?",
        "What must never happen in this world?",
        "Why is the protagonist uniquely suited to carry the main conflict?",
      ],
    },
    plan: {
      totalChapters: options.totalChapters,
      chapterWordTarget: options.chapterWordTarget,
      pendingChapters: chapterTasks.length,
      chapterTasks,
    },
    assets: {
      cover: {
        status: "pending",
        briefPath: ".ai-novel/assets/cover/cover-brief.md",
      },
      comic: {
        status: "pending",
        planPath: ".ai-novel/assets/comic/comic-plan.md",
      },
    },
  }
}

function getWorkspacePaths(rootDir: string) {
  const workspaceDir = path.join(rootDir, WORKSPACE_DIR)

  return {
    workspaceDir,
    statePath: path.join(workspaceDir, "state.json"),
    promptsDir: path.join(workspaceDir, "prompts"),
    agentPromptsDir: path.join(workspaceDir, "prompts", "agents"),
    consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
    plansDir: path.join(workspaceDir, "plans"),
    reportsDir: path.join(workspaceDir, "reports"),
    styleDir: path.join(workspaceDir, "style"),
    styleProfilePath: path.join(workspaceDir, "style", "profile.md"),
    styleRulebookPath: path.join(workspaceDir, "style", "rulebook.md"),
    styleReferencesPath: path.join(workspaceDir, "style", "references.md"),
    styleAntiPatternsPath: path.join(workspaceDir, "style", "anti-patterns.md"),
    chaptersDir: path.join(workspaceDir, "chapters"),
    assetsDir: path.join(workspaceDir, "assets"),
    coverDir: path.join(workspaceDir, "assets", "cover"),
    comicDir: path.join(workspaceDir, "assets", "comic"),
    memoryDir: path.join(workspaceDir, "memory"),
    charactersDir: path.join(workspaceDir, "memory", "characters"),
    characterCoreDir: path.join(workspaceDir, "memory", "characters", "core"),
    protagonistPath: path.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
    relationsPath: path.join(workspaceDir, "memory", "characters", "relations.md"),
    characterEvolutionPath: path.join(workspaceDir, "memory", "characters", "evolution.md"),
    configPath: path.join(workspaceDir, "config.json"),
    settingFreezePath: path.join(workspaceDir, "plans", "setting-freeze.md"),
    masterOutlinePath: path.join(workspaceDir, "plans", "master-outline.md"),
    chapterBlueprintsDir: path.join(workspaceDir, "plans", "chapter-blueprints"),
    coverPromptPath: path.join(workspaceDir, "assets", "cover", "cover-prompt.md"),
  }
}

async function writeWorkspaceArtifacts(rootDir: string, state: AutonomousNovelState) {
  const paths = getWorkspacePaths(rootDir)
  const llmConfig = loadLlmConfigFromEnv(rootDir)
  const creativeProfile = state.project.creativeProfile || buildCreativeProfile({
    rootDir,
    idea: state.project.idea,
    totalChapters: state.plan.totalChapters,
    chapterWordTarget: state.plan.chapterWordTarget,
    title: state.project.title,
  })

  await fs.mkdir(paths.promptsDir, { recursive: true })
  await fs.mkdir(paths.agentPromptsDir, { recursive: true })
  await fs.mkdir(paths.plansDir, { recursive: true })
  await fs.mkdir(paths.reportsDir, { recursive: true })
  await fs.mkdir(paths.styleDir, { recursive: true })
  await fs.mkdir(paths.chaptersDir, { recursive: true })
  await fs.mkdir(paths.coverDir, { recursive: true })
  await fs.mkdir(paths.comicDir, { recursive: true })
  await fs.mkdir(paths.characterCoreDir, { recursive: true })

  await writeJsonFileAtomic(paths.statePath, state)
  llmConfig.writing.chapterWordTarget = state.plan.chapterWordTarget
  llmConfig.writing.chapterWordMinimum = MIN_CHAPTER_WORD_TARGET
  await writeJsonFileAtomic(paths.configPath, llmConfig)

  const reactPrompt = [
    "# ReAct Worldbuilding Session",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Genre: ${creativeProfile.genre}`,
    `Platform: ${creativeProfile.platform}`,
    `Reader promise: ${creativeProfile.readerPromise}`,
    `Point of view: ${creativeProfile.pointOfView}`,
    `Tone: ${creativeProfile.tone}`,
    `Naturalness target: ${creativeProfile.naturalnessTarget}`,
    "",
    "Goals:",
    ...state.reactSetup.discussionGoals.map((goal) => `- ${goal}`),
    "",
    "Unanswered questions:",
    ...state.reactSetup.unansweredQuestions.map((question) => `- ${question}`),
    "",
    "Instruction:",
    "Discuss one uncertainty at a time, summarize agreed facts after each answer, and stop when enough detail exists to freeze the setting.",
  ].join("\n")

  const planBrief = [
    "# Plan-and-Solve Brief",
    "",
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    "",
    "Outputs to generate after the setting is frozen:",
    "- world bible",
    "- protagonist dossier",
    "- master plot spine",
    "- volume arcs",
    "- foreshadowing ledger",
    "- per-chapter task queue",
  ].join("\n")

  const coverBrief = [
    "# Cover Brief",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    "",
    "Required outputs:",
    "- one primary illustrated cover concept",
    "- title treatment direction",
    "- character focus and visual motifs",
    "- color script tied to genre promise",
    "",
    "Generation notes:",
    "- reflect the final emotional promise of the novel",
    "- avoid generic fantasy poster composition",
    "- reserve space for title and author text",
  ].join("\n")

  const comicPlan = [
    "# Comic Adaptation Plan",
    "",
    `Project: ${state.project.title}`,
    "",
    "Preparation goals:",
    "- define panel density per chapter",
    "- map arcs to episode batches",
    "- extract recurring character reference sheets",
    "- preserve world rules and power effects visually",
    "",
    "Status:",
    "This is a planning stub for a later illustrated storytelling pipeline.",
  ].join("\n")

  const globalConsensus = [
    "# Global Consensus",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    `Genre: ${creativeProfile.genre}`,
    `Platform: ${creativeProfile.platform}`,
    `Reader promise: ${creativeProfile.readerPromise}`,
    `Point of view: ${creativeProfile.pointOfView}`,
    `Tone: ${creativeProfile.tone}`,
    `Naturalness target: ${creativeProfile.naturalnessTarget}`,
    "",
    "Confirmed truths:",
    "- The world, style, and character details in this file are the shared source of truth.",
    "- Agents may propose changes, but only the showrunner summary promotes them into consensus.",
    "",
    "Current open areas:",
    ...state.reactSetup.unansweredQuestions.map((question) => `- ${question}`),
  ].join("\n")

  const styleProfile = [
    "# Style Profile",
    "",
    `Project: ${state.project.title}`,
    "",
    "Production selection contract:",
    `- genre: ${creativeProfile.genre}`,
    `- platform: ${creativeProfile.platform}`,
    `- reader promise: ${creativeProfile.readerPromise}`,
    `- point of view: ${creativeProfile.pointOfView}`,
    `- tone: ${creativeProfile.tone}`,
    `- naturalness target: ${creativeProfile.naturalnessTarget}`,
    `- style fingerprint: ${creativeProfile.styleFingerprint}`,
    "",
    "Target dimensions:",
    "- genre tone: to be discovered with the user",
    "- emotional promise: unresolved",
    "- pacing: hook-forward serialized long-form",
    "- dialogue bias: character-specific, less exposition-heavy",
    "- anti-AI goal: avoid repetitive sentence rhythm and generic scene labeling",
  ].join("\n")

  const styleRulebook = [
    "# Style Rulebook",
    "",
    "Permanent constraints:",
    "- keep prose readable and human-sounding",
    "- do not flatten every character into the same speaking voice",
    "- preserve chapter-level hooks",
    "- use concrete sensory details instead of generic emotion tags",
    "- keep exposition subordinate to scene momentum",
  ].join("\n")

  const styleReferences = [
    "# Style References",
    "",
    "Reference slots:",
    "- dialogue reference: pending",
    "- scene reference: pending",
    "- escalation reference: pending",
    "- emotional texture reference: pending",
  ].join("\n")

  const styleAntiPatterns = [
    "# Style Anti-Patterns",
    "",
    "- repeated abstract emotion naming without embodiment",
    "- generic transition sentences that only move information",
    "- identical dialogue cadence across roles",
    "- summary-heavy scene writing when a dramatized beat is needed",
  ].join("\n")

  const protagonistSeed = [
    "# Protagonist Seed",
    "",
    `Project: ${state.project.title}`,
    `Core idea connection: ${state.project.idea}`,
    "",
    "Required dossier fields:",
    "- canonical name pending",
    "- identity / role function: pending",
    "- core desire: pending",
    "- fear / wound: pending",
    "- contradiction: pending",
    "- unique tie to the central conflict: pending",
    "- behavior habits / repeated gestures: pending",
    "- speech style / address habits: pending",
    "- appearance / body shape / memorable silhouette: pending",
    "- skills / limits / cost of ability: pending",
    "- relationship pressure points: pending",
    "- chapter state delta: pending",
    "",
    "Required profile checklist:",
    ...creativeProfile.characterProfileRequirements.map((entry) => `- ${entry}`),
    "",
    "Production rule:",
    "- Do not let the protagonist be only a label such as cold, kind, smart, or tragic.",
    "- Every chapter should reveal personality through action, choice, habit, speech, body detail, and relationship pressure.",
  ].join("\n")

  const relations = [
    "# Character Relations",
    "",
    "Relationship graph slots:",
    "- protagonist: pending",
    "- ally axis: pending",
    "- rival axis: pending",
    "- intimate/conflicted axis: pending",
    "- family / debt / obligation axis: pending",
    "- antagonist pressure axis: pending",
    "",
    "Per-character minimum contract:",
    ...creativeProfile.characterProfileRequirements.map((entry) => `- ${entry}`),
  ].join("\n")

  const evolution = [
    "# Character Evolution Log",
    "",
    "No chapter-driven character changes recorded yet.",
    "",
    "Update format:",
    "- chapter:",
    "- character:",
    "- desire shift:",
    "- relationship shift:",
    "- habit/voice evidence:",
    "- new wound, fear, skill limit, or cost:",
    "- continuity risk for next chapter:",
  ].join("\n")

  const basePrompts = new Map<string, string>([
    [
      "showrunner",
      "# Showrunner Base Prompt\n\nYou protect the novel's shared truth, decide what becomes consensus, and keep all roles aligned.",
    ],
    [
      "world-architect",
      "# World Architect Base Prompt\n\nYou define world rules, limits, factions, and conflict engines without drifting into prose polish.",
    ],
    [
      "author",
      "# Author Base Prompt\n\nYou create compelling characters, dramatic turns, and emotionally engaging scene intent.",
    ],
    [
      "editor",
      "# Editor Base Prompt\n\nYou guard pacing, clarity, reader momentum, and serialized hook quality.",
    ],
    [
      "reviewer",
      "# Reviewer Base Prompt\n\nYou search for logic gaps, continuity failures, and broken promises in the novel plan.",
    ],
    [
      "prose-stylist",
      "# NaturalnessAgent Base Prompt\n\nYou are the production NaturalnessAgent. You humanize language, deepen scene texture, preserve facts, protect character voice, and reduce AI-sounding phrasing without changing core plot decisions.",
    ],
  ])

  const dynamicPrompts = new Map<string, string>(
    AGENT_ROLES.map((role) => [
      role,
      `# ${role} Dynamic Prompt\n\nCurrent focus:\n- project stage: ${state.runtime.stage}\n- chapter word target: ${state.plan.chapterWordTarget}\n- update this file only through curated consensus refreshes\n`,
    ]),
  )

  await fs.writeFile(path.join(paths.promptsDir, "react-worldbuilding.md"), `${reactPrompt}\n`)
  await fs.writeFile(path.join(paths.plansDir, "plan-and-solve-brief.md"), `${planBrief}\n`)
  await fs.writeFile(paths.consensusPath, `${globalConsensus}\n`)
  await fs.writeFile(paths.styleProfilePath, `${styleProfile}\n`)
  await fs.writeFile(paths.styleRulebookPath, `${styleRulebook}\n`)
  await fs.writeFile(paths.styleReferencesPath, `${styleReferences}\n`)
  await fs.writeFile(paths.styleAntiPatternsPath, `${styleAntiPatterns}\n`)
  await fs.writeFile(paths.protagonistPath, `${protagonistSeed}\n`)
  await fs.writeFile(paths.relationsPath, `${relations}\n`)
  await fs.writeFile(paths.characterEvolutionPath, `${evolution}\n`)
  await fs.writeFile(path.join(paths.coverDir, "cover-brief.md"), `${coverBrief}\n`)
  await fs.writeFile(path.join(paths.comicDir, "comic-plan.md"), `${comicPlan}\n`)

  await Promise.all(
    AGENT_ROLES.flatMap((role) => {
      const base = path.join(paths.agentPromptsDir, `${role}.base.md`)
      const dynamic = path.join(paths.agentPromptsDir, `${role}.dynamic.md`)
      return [
        fs.writeFile(base, `${basePrompts.get(role) ?? ""}\n`),
        fs.writeFile(dynamic, `${dynamicPrompts.get(role) ?? ""}\n`),
      ]
    }),
  )
}

async function readOptionalText(filePath: string) {
  try {
    return (await fs.readFile(filePath, "utf8")).trim()
  } catch {
    return ""
  }
}

async function writeJsonFileAtomic(filePath: string, value: unknown) {
  const data = `${JSON.stringify(value, null, 2)}\n`
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`)
    try {
      const handle = await fs.open(tempPath, "wx")
      try {
        await handle.writeFile(data, "utf8")
        await handle.sync()
      } finally {
        await handle.close()
      }
      await fs.rename(tempPath, filePath)
      return
    } catch (error) {
      await fs.unlink(tempPath).catch(() => undefined)
      if (attempt === 0 && error instanceof Error && "code" in error && error.code === "ENOENT") {
        continue
      }
      throw error
    }
  }
}

function extractBullets(source: string, limit = 4) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .slice(0, limit)
}

function extractSectionBullets(source: string, heading: string, limit = 4) {
  const lines = source.split("\n")
  const headingIndex = lines.findIndex((line) => line.trim() === heading)
  if (headingIndex < 0) {
    return []
  }

  const collected: string[] = []
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) {
      if (collected.length > 0) {
        break
      }
      continue
    }

    if (line.startsWith("#")) {
      break
    }

    if (line.startsWith("- ")) {
      collected.push(line)
      if (collected.length >= limit) {
        break
      }
    }
  }

  return collected
}

function extractMeaningfulLines(source: string, limit = 4) {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, limit)
}

export async function initAutonomousProject(options: InitProjectOptions) {
  const paths = getWorkspacePaths(options.rootDir)

  if (options.chapterWordTarget < MIN_CHAPTER_WORD_TARGET) {
    throw new Error(`Chapter word target must be at least ${MIN_CHAPTER_WORD_TARGET}.`)
  }

  await fs.mkdir(paths.workspaceDir, { recursive: true })

  const state = buildInitialState(options)
  await writeWorkspaceArtifacts(options.rootDir, state)
  await initializeSuperGraph(options.rootDir, state)

  return state
}

export async function listAutonomousProjects(rootDir: string) {
  return readProjectRegistry(rootDir)
}

export async function deleteManagedAutonomousProject(rootDir: string, projectId: string) {
  const projects = await readProjectRegistry(rootDir)
  const project = projects.find((entry) => entry.id === projectId)
  if (!project) {
    return null
  }

  const projectRoot = resolveStoredProjectRoot(rootDir, project.projectRoot, project.id)
  const expectedProjectRoot = path.resolve(resolveProjectRoot(rootDir, project.id))
  if (path.resolve(projectRoot) !== expectedProjectRoot) {
    throw new Error(`Refusing to delete project outside managed workspace: ${projectRoot}`)
  }

  await withFactoryDb(rootDir, async (db) => {
    const cancelledJobs = db.cancelProjectJobs(project.id)
    db.recordEvent(project.id, null, "PROJECT_DELETED", {
      id: project.id,
      title: project.title,
      projectRoot,
      cancelledJobs,
    })
  })
  await fs.rm(projectRoot, { recursive: true, force: true })
  await writeProjectRegistry(rootDir, projects.filter((entry) => entry.id !== project.id))
  await withFactoryDb(rootDir, async (db) => {
    db.deleteProject(project.id)
  })

  return {
    project: {
      ...project,
      projectRoot,
    },
  }
}

export async function resolveManagedProjectRoot(rootDir: string, projectId: string) {
  const projects = await readProjectRegistry(rootDir)
  const project = projects.find((entry) => entry.id === projectId)
  if (!project) {
    throw new Error(`Project '${projectId}' not found.`)
  }

  return resolveStoredProjectRoot(rootDir, project.projectRoot, project.id)
}

export async function createManagedAutonomousProject(options: InitProjectOptions) {
  const projects = await readProjectRegistry(options.rootDir)
  const title = options.title?.trim() || inferTitleFromIdea(options.idea)
  const slug = slugifyTitle(title)
  const projectId = createUniqueProjectId(slug, projects)
  const projectRoot = resolveProjectRoot(options.rootDir, projectId)
  const createdAt = new Date().toISOString()

  const state = await initAutonomousProject({
    ...options,
    rootDir: projectRoot,
    title,
  })

  const record: NovelProjectRecord = {
    id: projectId,
    slug,
    title: state.project.title,
    idea: state.project.idea,
    createdAt,
    totalChapters: state.plan.totalChapters,
    chapterWordTarget: state.plan.chapterWordTarget,
    projectRoot,
  }

  await writeProjectRegistry(options.rootDir, [...projects, record])
  await withFactoryDb(options.rootDir, async (db) => {
    db.upsertProject(record, state)
    db.recordEvent(record.id, null, "PROJECT_CREATED", {
      title: record.title,
      idea: record.idea,
      projectRoot: record.projectRoot,
      creativeProfile: state.project.creativeProfile,
    })
    db.recordArtifact({
      projectId: record.id,
      kind: "consensus",
      path: ".ai-novel/prompts/global-consensus.md",
      status: "completed",
    })
    db.recordArtifact({
      projectId: record.id,
      kind: "context",
      path: ".ai-novel/context/current-context.md",
      status: "pending",
    })
    db.createJob({
      projectId: record.id,
      kind: "knowledge_global_bootstrap",
      status: "idle",
      payload: {
        scope: "global",
        reason: "project_created",
        limit: process.env.AI_NOVEL_TEST_MODE === "1" ? 4 : undefined,
      },
    })
    db.createJob({
      projectId: record.id,
      kind: "knowledge_project_artifact",
      status: "idle",
      payload: {
        projectId: record.id,
        artifactPath: ".ai-novel/prompts/global-consensus.md",
        kind: "consensus",
        reason: "project_created",
      },
    })
  })
  await initializeSuperGraph(projectRoot, state, { factoryRootDir: options.rootDir, projectId })
  return {
    project: record,
    state,
  }
}

export async function loadAutonomousState(rootDir: string) {
  const { statePath } = getWorkspacePaths(rootDir)
  const raw = await fs.readFile(statePath, "utf8")
  return JSON.parse(raw) as AutonomousNovelState
}

export async function saveAutonomousState(rootDir: string, state: AutonomousNovelState) {
  const { statePath } = getWorkspacePaths(rootDir)
  state.runtime.lastUpdatedAt = new Date().toISOString()
  await writeJsonFileAtomic(statePath, state)
  await syncCurrentContextPacketFile(rootDir, state).catch(() => undefined)
}

export async function syncManagedProjectState(rootDir: string, projectId: string, state: AutonomousNovelState) {
  await withFactoryDb(rootDir, async (db) => {
    db.updateProjectState(projectId, state)
  })
}

async function recordWorkflowEvent(
  options: ProductionPipelineOptions,
  type: string,
  payload: unknown,
) {
  if (!options.factoryRootDir || !options.projectId) {
    return
  }
  await withFactoryDb(options.factoryRootDir, async (db) => {
    const eventPayload = payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...payload as Record<string, unknown>, directorCommandId: options.directorCommandId ?? null }
      : { value: payload, directorCommandId: options.directorCommandId ?? null }
    db.recordEvent(options.projectId as string, null, type, eventPayload)
  }).catch(() => undefined)
}

function getMaxRecoveryAttempts(options: ProductionPipelineOptions) {
  return Math.max(1, options.maxRecoveryAttempts ?? DEFAULT_CHAPTER_RECOVERY_LIMIT)
}

async function autoRequeueChapterAfterRecoveryLimit(
  rootDir: string,
  state: AutonomousNovelState,
  task: ChapterTask,
  pipelineOptions: ProductionPipelineOptions,
  reason: string,
) {
  const maxRecoveryAttempts = getMaxRecoveryAttempts(pipelineOptions)
  const previousQualityGate = task.qualityGate || null

  task.status = "pending"
  task.recoveryAttempts = 0
  task.recoveryBlocked = false
  task.recoveryQueuedAt = new Date().toISOString()
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length
  state.runtime.stage = "drafting"
  state.runtime.statusMessage = `Chapter ${task.chapterNumber} reached the recovery limit and was automatically queued for a fresh production pass.`
  stampRuntimeProgress(state, `auto_requeue_chapter:${task.chapterNumber}`)

  await saveAutonomousState(rootDir, state)
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED", {
    chapterNumber: task.chapterNumber,
    maxRecoveryAttempts,
    previousQualityGate,
    reason,
  })
  await recordWorkflowEvent(pipelineOptions, "WRITING_PROGRESS", {
    step: "chapter_auto_rewrite_queued",
    role: "Editor",
    chapterNumber: task.chapterNumber,
    status: "pending",
    message: `Chapter ${task.chapterNumber} reached the unattended recovery limit and was queued for a fresh rewrite.`,
    qualityGate: previousQualityGate,
  })
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
    chapterNumber: task.chapterNumber,
    status: "pending",
    reason: "chapter_auto_rewrite_queued",
    recoveryAttempts: task.recoveryAttempts,
    recoveryQueuedAt: task.recoveryQueuedAt,
  })
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
  }
  return state
}

async function markChapterRecoveryLimitReached(
  rootDir: string,
  state: AutonomousNovelState,
  task: ChapterTask,
  pipelineOptions: ProductionPipelineOptions,
  reason: string,
) {
  return autoRequeueChapterAfterRecoveryLimit(rootDir, state, task, pipelineOptions, reason)
}

async function queueChapterRecovery(
  rootDir: string,
  state: AutonomousNovelState,
  task: ChapterTask,
  pipelineOptions: ProductionPipelineOptions,
  eventPayload: Record<string, unknown> = {},
) {
  const maxRecoveryAttempts = getMaxRecoveryAttempts(pipelineOptions)
  if ((task.recoveryAttempts || 0) >= maxRecoveryAttempts) {
    return markChapterRecoveryLimitReached(
      rootDir,
      state,
      task,
      pipelineOptions,
      String(eventPayload.reason || "automatic_recovery_limit_reached"),
    )
  }

  task.status = "pending"
  task.recoveryAttempts = (task.recoveryAttempts || 0) + 1
  task.recoveryBlocked = false
  task.recoveryQueuedAt = new Date().toISOString()
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length
  state.runtime.stage = "drafting"
  state.runtime.statusMessage = `Recovered blocked chapter ${task.chapterNumber} for another production pass (recovery attempt ${task.recoveryAttempts}/${maxRecoveryAttempts}).`
  stampRuntimeProgress(state, `chapter_recovery_queued:${task.chapterNumber}`)
  await saveAutonomousState(rootDir, state)
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_PIPELINE_RECOVERY_QUEUED", {
    chapterNumber: task.chapterNumber,
    recoveryAttempts: task.recoveryAttempts,
    maxRecoveryAttempts,
    previousQualityGate: task.qualityGate || null,
    ...eventPayload,
  })
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
    chapterNumber: task.chapterNumber,
    status: "pending",
    reason: "chapter_recovery_queued",
    recoveryAttempts: task.recoveryAttempts,
    recoveryQueuedAt: task.recoveryQueuedAt,
  })
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
  }
  return state
}

async function produceChapterTask(
  rootDir: string,
  paths: ReturnType<typeof getWorkspacePaths>,
  state: AutonomousNovelState,
  task: ChapterTask,
  pipelineOptions: ProductionPipelineOptions,
) {
  throwIfStopped(pipelineOptions.signal)
  const writingMode = pipelineOptions.writingMode === "quality" || process.env.AI_NOVEL_WRITING_MODE === "quality"
    ? "quality"
    : "fast"
  task.status = "in_progress"
  task.recoveryQueuedAt = undefined
  state.runtime.stage = "drafting"
  state.runtime.statusMessage = writingMode === "quality"
    ? `Chapter ${task.chapterNumber} is in quality production: blueprint, draft, LLM review, polish, and memory update are running.`
    : `Chapter ${task.chapterNumber} is in fast unattended production: draft generation and deterministic continuity/resource gates are running.`
  stampRuntimeProgress(state, `chapter_production_started:${task.chapterNumber}`)
  await saveAutonomousState(rootDir, state)
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
    await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: task.chapterNumber,
      status: "in_progress",
      reason: "chapter_production_started",
    })
  }
  let produced
  try {
    produced = await runChapterProductionPipeline(rootDir, paths, state, task, pipelineOptions)
  } catch (error: any) {
    if (error.isProviderFailure) {
      task.status = "pending"
      state.runtime.statusMessage = `Provider error: ${error.message}`
      stampRuntimeProgress(state, `provider_failure:${task.chapterNumber}`)
      await saveAutonomousState(rootDir, state)
      if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
        await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
        await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
          chapterNumber: task.chapterNumber,
          status: "pending",
          reason: `provider_failure: ${error.message}`,
        })
      }
    }
    throw error
  }
  throwIfStopped(pipelineOptions.signal)
  task.status = produced.qualityGate.status === "blocked" ? "blocked" : "complete"
  task.qualityGate = {
    ...produced.qualityGate,
    updatedAt: new Date().toISOString(),
  }
  if (task.status === "complete") {
    task.recoveryBlocked = false
  }
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length
  state.runtime.stage = task.status === "blocked"
    ? "reviewing"
    : state.plan.pendingChapters > 0 ? "drafting" : "complete"
  state.runtime.statusMessage = task.status === "blocked"
    ? `Chapter ${task.chapterNumber} is blocked by the quality gate after ${produced.qualityGate.attempts} revision attempt(s): ${produced.qualityGate.reason}`
    : state.runtime.stage === "complete"
      ? "All chapter drafts have been generated."
      : writingMode === "quality"
        ? `Generated, reviewed, polished, and memorized chapter ${task.chapterNumber} (${produced.wordCount} estimated words). Continue to the next queued chapter.`
        : `Generated chapter ${task.chapterNumber} in fast unattended mode and recorded quality gates/memory (${produced.wordCount} estimated words). Continue to the next queued chapter.`
  stampRuntimeProgress(
    state,
    task.status === "blocked"
      ? `chapter_blocked:${task.chapterNumber}`
      : state.runtime.stage === "complete"
        ? "workflow_complete"
        : `chapter_completed:${task.chapterNumber}`,
  )
  await saveAutonomousState(rootDir, state)
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
  }
  return { state, produced }
}

function applyChapterFactsToState(
  state: AutonomousNovelState,
  facts: ChapterProductionFact[],
) {
  const changed: Array<{
    chapterNumber: number
    from: string
    to: string
    reason: string
  }> = []
  const factsByChapter = new Map(facts.map((fact) => [fact.chapterNumber, fact]))

  for (const task of state.plan.chapterTasks) {
    const fact = factsByChapter.get(task.chapterNumber)
    if (!fact) continue
    const previousStatus = task.status
    let nextStatus = task.status
    let reason = ""
    const latestTaskStatusAt = Date.parse(fact.latestTaskStatusAt || "")
    const qualityGateUpdatedAt = Date.parse(fact.qualityGate?.updatedAt || fact.updatedAt || "")
    const taskInstructionIsNewer = Number.isFinite(latestTaskStatusAt)
      && (!Number.isFinite(qualityGateUpdatedAt) || latestTaskStatusAt > qualityGateUpdatedAt)
    const factHasQueuedRecovery = taskInstructionIsNewer
      && (fact.latestTaskStatus === "pending" || fact.latestTaskStatus === "in_progress")

    if (fact.resetAt && fact.status === "pending" && fact.latestTaskStatus === "pending") {
      nextStatus = "pending"
      reason = "chapter queue was reset for a fresh production pass"
      task.recoveryAttempts = 0
      delete task.recoveryBlocked
      delete task.recoveryQueuedAt
      delete task.qualityGate
      delete task.contentQuality
    } else if (fact.status === "in_progress" && !fact.qualityGate) {
      nextStatus = "in_progress"
      reason = fact.latestStep || "latest writing event is running"
    } else if (fact.status === "complete") {
      nextStatus = "complete"
      reason = "quality gate passed"
    } else if (fact.qualityGate?.status === "passed" && fact.contentQuality?.status === "quarantined") {
      nextStatus = "pending"
      reason = fact.contentQuality.reason || "final artifact is quarantined by deterministic checks"
    } else if (factHasQueuedRecovery) {
      nextStatus = fact.status === "in_progress" ? "in_progress" : "pending"
      reason = fact.recoveryQueuedAt
        ? "chapter recovery has been queued after the last blocked quality gate"
        : "chapter task status is newer than the last quality gate"
    } else if (fact.qualityGate?.status === "blocked") {
      nextStatus = "blocked"
      reason = fact.qualityGate.reason || "quality gate blocked; queued for recovery"
    } else if (fact.status === "blocked") {
      nextStatus = "blocked"
      reason = "chapter artifact exists without a passing quality gate"
    }

    if (fact.qualityGate) {
      task.qualityGate = {
        status: fact.qualityGate.status,
        score: Number(fact.qualityGate.score || 0),
        attempts: Number(fact.qualityGate.attempts || 0),
        reason: fact.qualityGate.reason || "",
        wordCount: fact.qualityGate.wordCount,
        targetWords: fact.qualityGate.targetWords,
        updatedAt: fact.qualityGate.updatedAt || fact.updatedAt || new Date().toISOString(),
      }
    }
    if (fact.recoveryQueuedAt && taskInstructionIsNewer) {
      task.recoveryQueuedAt = fact.recoveryQueuedAt
    }
    if (fact.contentQuality) {
      task.contentQuality = {
        status: fact.contentQuality.status,
        reason: fact.contentQuality.reason,
        wordCount: fact.contentQuality.wordCount,
        targetWords: fact.contentQuality.targetWords,
        minimumWords: fact.contentQuality.minimumWords,
      }
    }
    if (
      fact.status === "pending"
      && fact.finalPath
      && fact.contentQuality?.status === "quarantined"
      && previousStatus === "complete"
    ) {
      nextStatus = "pending"
      reason = fact.contentQuality.reason || "final artifact is quarantined by deterministic checks"
    }

    if (previousStatus !== nextStatus) {
      task.status = nextStatus
      changed.push({
        chapterNumber: task.chapterNumber,
        from: previousStatus,
        to: nextStatus,
        reason,
      })
    }
  }

  if (changed.length > 0) {
    state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length
    const hasInProgress = state.plan.chapterTasks.some((task) => task.status === "in_progress")
    const hasPending = state.plan.chapterTasks.some((task) => task.status === "pending")
    const hasBlocked = state.plan.chapterTasks.some((task) => task.status === "blocked")
    state.runtime.stage = hasBlocked
      ? "reviewing"
      : hasInProgress || hasPending
      ? "drafting"
      : "complete"
    state.runtime.statusMessage = hasInProgress
      ? "Chapter production is currently running; state has been synchronized from database facts."
      : `Synchronized ${changed.length} chapter task(s) from database facts.`
    stampRuntimeProgress(
      state,
      hasInProgress ? "synced_chapter_facts_in_progress" : "synced_chapter_facts",
    )
  }

  return changed
}

async function resetChapterQueueFrom(
  state: AutonomousNovelState,
  startChapterNumber: number,
  reason: string,
  pipelineOptions: ProductionPipelineOptions,
) {
  const resetChapters: number[] = []
  for (const task of state.plan.chapterTasks) {
    if (task.chapterNumber < startChapterNumber) {
      continue
    }
    if (task.status === "pending" && !task.qualityGate && !task.contentQuality) {
      continue
    }
    task.status = "pending"
    task.recoveryAttempts = 0
    task.recoveryBlocked = false
    task.recoveryQueuedAt = new Date().toISOString()
    delete task.qualityGate
    delete task.contentQuality
    resetChapters.push(task.chapterNumber)
  }
  if (resetChapters.length === 0) {
    return []
  }
  state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length
  state.runtime.stage = "drafting"
  state.runtime.statusMessage = `章节连续性检查失败：第 ${startChapterNumber} 章起已重置为待重写。${reason}`
  stampRuntimeProgress(state, `chapter_queue_reset_from:${startChapterNumber}`)
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_QUEUE_RESET", {
    resetChapters,
    reason,
    startChapterNumber,
  })
  return resetChapters
}

async function enforceSequentialChapterIntegrity(
  state: AutonomousNovelState,
  pipelineOptions: ProductionPipelineOptions,
) {
  for (const task of state.plan.chapterTasks) {
    if (task.status !== "complete") {
      return []
    }
    if (task.qualityGate?.status !== "passed" || task.contentQuality?.status === "quarantined") {
      const reason = task.contentQuality?.reason || task.qualityGate?.reason || "章节缺少可信通过门禁。"
      return resetChapterQueueFrom(state, task.chapterNumber, reason, pipelineOptions)
    }
  }
  return []
}

async function recoverIncompleteInProgressChapterTasks(
  paths: ReturnType<typeof getWorkspacePaths>,
  state: AutonomousNovelState,
  pipelineOptions: ProductionPipelineOptions,
) {
  const recovered: number[] = []
  const facts = pipelineOptions.factoryRootDir && pipelineOptions.projectId
    ? await withFactoryDb(pipelineOptions.factoryRootDir, async (db) => db.getChapterFacts(pipelineOptions.projectId as string)).catch(() => [])
    : []
  const factsByChapter = new Map(facts.map((fact) => [fact.chapterNumber, fact]))
  for (const task of state.plan.chapterTasks) {
    if (task.status !== "in_progress") {
      continue
    }
    const fact = factsByChapter.get(task.chapterNumber)
    if (fact?.status === "in_progress") {
      continue
    }
    const chapterId = `chapter-${String(task.chapterNumber).padStart(3, "0")}`
    const finalPath = path.join(paths.chaptersDir, `${chapterId}.final.md`)
    try {
      await fs.access(finalPath)
      if (fact?.status === "complete") {
        task.status = "complete"
        task.recoveryBlocked = false
      } else {
        task.status = "blocked"
        task.recoveryAttempts = (task.recoveryAttempts || 0) + 1
        recovered.push(task.chapterNumber)
      }
    } catch {
      task.status = "pending"
      task.recoveryAttempts = (task.recoveryAttempts || 0) + 1
      recovered.push(task.chapterNumber)
    }
  }

  if (recovered.length > 0) {
    state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length
    stampRuntimeProgress(state, "recovered_in_progress_tasks")
    await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASKS_RECOVERED", {
      chapters: recovered,
      reason: "in_progress_without_final_artifact",
    })
  }

  return recovered
}

async function reconcileChapterTaskStatuses(
  state: AutonomousNovelState,
  pipelineOptions: ProductionPipelineOptions,
) {
  const reconciled: Array<{ chapterNumber: number; from: string; to: string; reason: string }> = []
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    const dbReconciled = await withFactoryDb(pipelineOptions.factoryRootDir, async (db) =>
      applyChapterFactsToState(state, db.getChapterFacts(pipelineOptions.projectId as string)),
    ).catch(() => [])
    reconciled.push(...dbReconciled)
  }
  for (const task of state.plan.chapterTasks) {
    const qualityGate = task.qualityGate
    if (
      task.status === "complete"
      && qualityGate
      && qualityGate.status === "blocked"
    ) {
      reconciled.push({
        chapterNumber: task.chapterNumber,
        from: "complete",
        to: "blocked",
        reason: qualityGate.reason || "quality gate did not pass",
      })
      task.status = "blocked"
    }
  }

  if (reconciled.length > 0) {
    state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length
    stampRuntimeProgress(state, "reconciled_blocked_quality_gates")
    await recordWorkflowEvent(pipelineOptions, "CHAPTER_STATUS_RECONCILED", { chapters: reconciled })
  }

  const resetChapters = await enforceSequentialChapterIntegrity(state, pipelineOptions)
  if (resetChapters.length > 0) {
    reconciled.push(...resetChapters.map((chapterNumber) => ({
      chapterNumber,
      from: "complete",
      to: "pending",
      reason: "sequential_integrity_reset",
    })))
  }

  return reconciled
}

function createSettingFreeze(
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
) {
  const consensusHighlights = extractSectionBullets(context.consensus, "Latest discussion summary", 4)
  const protagonistHighlights = extractSectionBullets(context.protagonist, "Discussion updates", 4)
  const styleHighlights = extractSectionBullets(context.style, "Discussion-driven adjustments", 3)

  return [
    "# Setting Freeze",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    "",
    "Discussion-backed consensus:",
    ...(consensusHighlights.length > 0 ? consensusHighlights : ["- No discussion summary captured yet."]),
    "",
    "Protagonist commitments:",
    ...(protagonistHighlights.length > 0 ? protagonistHighlights : ["- Protagonist notes are still sparse."]),
    "",
    "Style commitments:",
    ...(styleHighlights.length > 0 ? styleHighlights : ["- Style adjustments are still sparse."]),
    "",
    "Locked discussion goals:",
    ...state.reactSetup.discussionGoals.map((goal) => `- ${goal}`),
    "",
    "Open questions to resolve with the user before full drafting:",
    ...state.reactSetup.unansweredQuestions.map((question) => `- ${question}`),
  ].join("\n")
}

function createMasterOutline(
  state: AutonomousNovelState,
  context: { consensus: string; protagonist: string; style: string },
) {
  const arcSize = Math.max(3, Math.ceil(state.plan.totalChapters / 4))
  const arcs = Array.from({ length: Math.ceil(state.plan.totalChapters / arcSize) }, (_, index) => {
    const start = index * arcSize + 1
    const end = Math.min(state.plan.totalChapters, start + arcSize - 1)
    return `- Arc ${index + 1}: chapters ${start}-${end} build pressure toward the central promise of "${state.project.idea}".`
  })
  const protagonistHighlights = extractSectionBullets(context.protagonist, "Discussion updates", 3)
  const consensusHighlights = extractSectionBullets(context.consensus, "Latest discussion summary", 3)

  return [
    "# Master Outline",
    "",
    `Project: ${state.project.title}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    "",
    "Planning spine from discussion:",
    ...(consensusHighlights.length > 0 ? consensusHighlights : ["- Preserve the current discussion summary through all arcs."]),
    "",
    "Protagonist arc anchors:",
    ...(protagonistHighlights.length > 0 ? protagonistHighlights : ["- Keep the protagonist tied tightly to the central conflict."]),
    "",
    "Long-form structure:",
    ...arcs,
    "",
    "Required planning tracks:",
    "- protagonist transformation",
    "- escalation ladder",
    "- foreshadowing placement and payoff",
    "- ending promise and emotional landing",
  ].join("\n")
}

function createChapterBlueprint(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  context: { consensus: string; protagonist: string; style: string },
) {
  const protagonistLines = extractSectionBullets(context.protagonist, "Discussion updates", 2)
  const styleLines = extractSectionBullets(context.style, "Discussion-driven adjustments", 2)
  return [
    "# Chapter Blueprint",
    "",
    `Project: ${state.project.title}`,
    `Chapter: ${task.chapterNumber}`,
    `Title: ${task.title}`,
    `Target words: ${task.targetWords}`,
    "",
    "Discussion carryover:",
    ...(protagonistLines.length > 0 ? protagonistLines : ["- Keep the protagonist emotionally consistent with the latest discussion."]),
    ...(styleLines.length > 0 ? styleLines : ["- Keep prose human and scene-forward."]),
    "",
    "Drafting targets:",
    "- advance the main conflict",
    "- reinforce one world rule",
    "- evolve one character relationship or internal conflict",
    "- leave a forward hook for the next chapter",
    "",
    `Current summary: ${task.summary}`,
  ].join("\n")
}

function createChapterDraft(
  state: AutonomousNovelState,
  task: AutonomousNovelState["plan"]["chapterTasks"][number],
  context: { consensus: string; protagonist: string; style: string },
) {
  const protagonistLines = extractMeaningfulLines(context.protagonist, 3)
  const styleLines = extractMeaningfulLines(context.style, 2)
  const consensusLines = extractMeaningfulLines(context.consensus, 2)

  return [
    "# Chapter Draft",
    "",
    `Project: ${state.project.title}`,
    `Chapter: ${task.chapterNumber}`,
    `Title: ${task.title}`,
    `Target words: ${task.targetWords}`,
    "",
    "Scene intent:",
    `This chapter advances the main promise of "${state.project.idea}" while keeping the chapter hook active.`,
    "",
    "Discussion-guided notes:",
    ...(consensusLines.length > 0 ? consensusLines.map((line) => `- ${line}`) : ["- Preserve the latest shared consensus."]),
    ...(protagonistLines.length > 0 ? protagonistLines.map((line) => `- ${line}`) : ["- Keep the protagonist emotionally precise and story-bound."]),
    ...(styleLines.length > 0 ? styleLines.map((line) => `- ${line}`) : ["- Keep the prose humanized and specific."]),
    "",
    "Draft body:",
    `${task.title} opens with immediate pressure on the protagonist, tying the current chapter goal back to the world-level conflict.`,
    `A concrete scene beat should reveal one world rule, deepen one relationship, and make the protagonist's internal contradiction visible.`,
    `The ending beat must leave a clear forward hook that forces movement into chapter ${task.chapterNumber + 1}.`,
  ].join("\n")
}

export async function advanceAutonomousProject(rootDir: string, options: ProductionPipelineOptions = {}) {
  const pipelineOptions = { envRootDir: rootDir, ...options }
  throwIfStopped(pipelineOptions.signal)
  const state = await loadAutonomousState(rootDir)
  const paths = getWorkspacePaths(rootDir)
  const recoveredChapters = await recoverIncompleteInProgressChapterTasks(paths, state, pipelineOptions)
  const reconciledChapters = await reconcileChapterTaskStatuses(state, pipelineOptions)
  if (recoveredChapters.length > 0 && state.runtime.stage === "complete") {
    state.runtime.stage = "drafting"
    state.runtime.statusMessage = `Recovered incomplete chapter task(s): ${recoveredChapters.join(", ")}. Drafting will resume.`
    stampRuntimeProgress(state, "recovered_incomplete_chapters")
  }
  if (reconciledChapters.length > 0) {
    const hasBlocked = state.plan.chapterTasks.some((task) => task.status === "blocked")
    const hasPending = state.plan.chapterTasks.some((task) => task.status === "pending")
    state.runtime.stage = hasBlocked
      ? "reviewing"
      : hasPending
        ? "drafting"
        : state.runtime.stage
    state.runtime.statusMessage = hasBlocked
      ? `Reconciled ${reconciledChapters.length} chapter task(s) whose quality gate had not passed. Review blocked chapters before drafting can continue.`
      : `Reconciled ${reconciledChapters.length} chapter task(s) whose quality gate had not passed. Drafting will resume from the first pending chapter.`
    stampRuntimeProgress(state, "reconciled_chapter_facts")
    await saveAutonomousState(rootDir, state)
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
    }
    return state
  }
  const context = {
    consensus: await readOptionalText(paths.consensusPath),
    protagonist: await readOptionalText(paths.protagonistPath),
    style: await readOptionalText(paths.styleProfilePath),
  }

  if (state.runtime.stage === "worldbuilding_dialogue") {
    throwIfStopped(pipelineOptions.signal)
    await writeProductionWritingResourceArtifacts(rootDir, paths, state, pipelineOptions)
    await fs.writeFile(paths.settingFreezePath, `${createSettingFreeze(state, context)}\n`)
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await withFactoryDb(pipelineOptions.factoryRootDir, async (db) => {
        db.recordArtifact({
          projectId: pipelineOptions.projectId as string,
          kind: "plan",
          path: ".ai-novel/plans/setting-freeze.md",
          status: "completed",
          metadata: { production: true, stage: state.runtime.stage },
        })
      }).catch(() => undefined)
    }
    state.runtime.stage = "setting_review"
    state.runtime.statusMessage = "Setting freeze drafted. Review the frozen world assumptions before outlining."
    stampRuntimeProgress(state, "setting_freeze_generated")
    await saveAutonomousState(rootDir, state)
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
    }
    return state
  }

  if (state.runtime.stage === "setting_review") {
    throwIfStopped(pipelineOptions.signal)
    await writeProductionMasterOutline(rootDir, paths, state, context, pipelineOptions)
    state.runtime.stage = "master_planning"
    state.runtime.statusMessage = "Production master outline generated. Next step is to expand detailed chapter blueprints."
    stampRuntimeProgress(state, "master_outline_generated")
    await saveAutonomousState(rootDir, state)
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
    }
    return state
  }

  if (state.runtime.stage === "master_planning") {
    await writeAllDetailedChapterBlueprints(rootDir, paths, state, context, pipelineOptions)
    state.runtime.stage = "drafting"
    state.runtime.statusMessage = "Detailed chapter blueprints generated for the full book. Drafting has started from the queued chapter tasks."
    stampRuntimeProgress(state, "chapter_blueprints_generated")
    await saveAutonomousState(rootDir, state)
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
    }
    return state
  }

  if (state.runtime.stage === "reviewing") {
    const blockedTask = state.plan.chapterTasks.find((task) => task.status === "blocked")

    if (blockedTask) {
      return queueChapterRecovery(rootDir, state, blockedTask, pipelineOptions, {
        reason: "reviewing_blocked_chapter",
      })
    }

    state.runtime.stage = state.plan.pendingChapters > 0 ? "drafting" : "complete"
    state.runtime.statusMessage = state.runtime.stage === "complete"
      ? "All chapter drafts have been generated."
      : "Reviewing stage cleared; returning to queued drafting tasks."
    stampRuntimeProgress(
      state,
      state.runtime.stage === "complete" ? "workflow_complete" : "reviewing_cleared",
    )
    await saveAutonomousState(rootDir, state)
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
    }
    return state
  }

  if (state.runtime.stage === "chapter_task_generation" || state.runtime.stage === "drafting") {
    const inProgressTask = state.plan.chapterTasks.find((task) => task.status === "in_progress")
    if (inProgressTask) {
      state.runtime.stage = "drafting"
      state.runtime.statusMessage = `Chapter ${inProgressTask.chapterNumber} is still in progress. Waiting for its final artifact and quality gate before starting another chapter.`
      stampRuntimeProgress(state, `chapter_waiting:${inProgressTask.chapterNumber}`)
      await saveAutonomousState(rootDir, state)
      if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
        await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
      }
      return state
    }

    const recoverableBlockedTask = state.plan.chapterTasks.find((task) => task.status === "blocked" && !task.recoveryBlocked)
    if (recoverableBlockedTask) {
      const recovered = await queueChapterRecovery(rootDir, state, recoverableBlockedTask, pipelineOptions, {
        reason: "oldest_blocked_chapter_takes_priority",
      })
      if (recovered.runtime.stage === "reviewing" || recovered.plan.chapterTasks.some((task) => task.status === "blocked" && task.recoveryBlocked)) {
        return recovered
      }
    }
    const nextTask = state.plan.chapterTasks.find((task) => task.status === "pending")

    if (!nextTask) {
      state.runtime.stage = "complete"
      state.runtime.statusMessage = "All chapter drafts have been generated."
      state.plan.pendingChapters = 0
      stampRuntimeProgress(state, "workflow_complete")
      await saveAutonomousState(rootDir, state)
      return state
    }

    return (await produceChapterTask(rootDir, paths, state, nextTask, pipelineOptions)).state
  }

  state.runtime.statusMessage = `No advance action is defined for stage ${state.runtime.stage}.`
  stampRuntimeProgress(state, `noop:${state.runtime.stage}`)
  await saveAutonomousState(rootDir, state)
  return state
}

export async function retryChapterProduction(
  rootDir: string,
  chapterNumber: number,
  options: ProductionPipelineOptions & { runNow?: boolean; maxRecoveryAttempts?: number } = {},
) {
  const pipelineOptions = { envRootDir: rootDir, ...options }
  const state = await loadAutonomousState(rootDir)
  const paths = getWorkspacePaths(rootDir)
  const task = state.plan.chapterTasks.find((candidate) => candidate.chapterNumber === chapterNumber)

  if (!task) {
    throw new Error(`chapter_not_found:${chapterNumber}`)
  }

  const maxRecoveryAttempts = getMaxRecoveryAttempts(pipelineOptions)
  if ((task.recoveryAttempts || 0) >= maxRecoveryAttempts) {
    const recovered = await markChapterRecoveryLimitReached(rootDir, state, task, pipelineOptions, "manual_retry_limit_reached")
    const recoveredTask = recovered.plan.chapterTasks.find((candidate) => candidate.chapterNumber === chapterNumber)
    if (options.runNow && recoveredTask?.status === "pending" && !recoveredTask.recoveryBlocked) {
      return (await produceChapterTask(rootDir, paths, recovered, recoveredTask, pipelineOptions)).state
    }
    return recovered
  }

  const previousStatus = task.status
  task.status = "pending"
  task.recoveryAttempts = (task.recoveryAttempts || 0) + 1
  task.recoveryBlocked = false
  task.recoveryQueuedAt = new Date().toISOString()
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length
  state.runtime.stage = "drafting"
  state.runtime.statusMessage = `Chapter ${task.chapterNumber} has been queued for another production pass (recovery attempt ${task.recoveryAttempts}).`
  stampRuntimeProgress(state, `manual_retry_queued:${task.chapterNumber}`)

  await saveAutonomousState(rootDir, state)
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_PIPELINE_RECOVERY_QUEUED", {
    chapterNumber: task.chapterNumber,
    previousStatus,
    recoveryAttempts: task.recoveryAttempts,
    previousQualityGate: task.qualityGate || null,
    requested: true,
  })
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
    chapterNumber: task.chapterNumber,
    status: "pending",
    reason: "manual_retry_queued",
    recoveryAttempts: task.recoveryAttempts,
    recoveryQueuedAt: task.recoveryQueuedAt,
  })
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => undefined)
  }

  if (options.runNow) {
    return (await produceChapterTask(rootDir, paths, state, task, pipelineOptions)).state
  }

  return state
}

export async function prepareCoverGeneration(rootDir: string) {
  const state = await loadAutonomousState(rootDir)
  const paths = getWorkspacePaths(rootDir)

  const prompt = [
    "# Cover Image Prompt",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    "",
    "Art direction:",
    "- foreground one memorable protagonist silhouette or emblem",
    "- signal genre promise immediately",
    "- leave clean title space",
    "- avoid generic stock-poster composition",
    "",
    "Image prompt seed:",
    `"Create a novel cover for '${state.project.title}' inspired by: ${state.project.idea}"`,
  ].join("\n")

  await fs.writeFile(paths.coverPromptPath, `${prompt}\n`)
  state.assets.cover.status = "in_progress"
  state.runtime.statusMessage = "Cover prompt prepared. Ready for an image-generation step."
  stampRuntimeProgress(state, "cover_prompt_prepared", "cover")
  await saveAutonomousState(rootDir, state)
  return state
}

function classifyInterruption(message: string): {
  scope: InterruptionScope
  affectedArtifacts: string[]
  reasoning: string
  recommendedAction: string
} {
  const normalized = message.toLowerCase()
  const globalSignals = [
    "genre",
    "world rule",
    "worldbuilding",
    "entire",
    "whole story",
    "rewrite the core",
    "core world",
    "整个故事",
    "改成",
    "重写",
    "风格",
  ]
  const chapterArcSignals = [
    "arc",
    "motivation",
    "relationship",
    "foreshadow",
    "villain",
    "supporting character",
    "subplot",
  ]

  const hasGlobalSignal = globalSignals.some((signal) => normalized.includes(signal))
  const hasArcSignal = chapterArcSignals.some((signal) => normalized.includes(signal))

  if (hasGlobalSignal) {
    return {
      scope: "global",
      affectedArtifacts: ["world bible", "master outline", "chapter queue", "foreshadowing ledger"],
      reasoning: "The interruption changes story-wide assumptions, so downstream chapter tasks can no longer be trusted.",
      recommendedAction: "Freeze drafting, regenerate the planning artifacts, and rebuild the chapter queue before resuming.",
    }
  }

  if (hasArcSignal) {
    return {
      scope: "chapter_arc",
      affectedArtifacts: ["current arc outline", "next chapters", "character dossier"],
      reasoning: "The interruption changes a recurring plot or character thread that spans multiple future chapters.",
      recommendedAction: "Revise the active arc plan and refresh affected upcoming chapter tasks before continuing.",
    }
  }

  return {
    scope: "local",
    affectedArtifacts: ["current chapter draft"],
    reasoning: "The interruption looks limited to a nearby scene or wording choice.",
    recommendedAction: "Patch the active draft and continue with the existing chapter queue.",
  }
}

export async function reviewInterruption(options: InterruptOptions) {
  const state = await loadAutonomousState(options.rootDir)
  const assessment = classifyInterruption(options.message)
  const review: InterruptionReview = {
    message: options.message.trim(),
    scope: assessment.scope,
    reasoning: assessment.reasoning,
    affectedArtifacts: assessment.affectedArtifacts,
    recommendedAction: assessment.recommendedAction,
    timestamp: new Date().toISOString(),
  }

  state.runtime.lastInterruption = review
  state.runtime.stage = review.scope === "global" ? "replanning" : state.runtime.stage
  state.runtime.statusMessage = review.recommendedAction
  stampRuntimeProgress(state, `interruption_reviewed:${review.scope}`, "interrupt")

  await saveAutonomousState(options.rootDir, state)
  await recordWorkflowEvent({
    factoryRootDir: options.factoryRootDir,
    projectId: options.projectId ?? undefined,
    directorCommandId: options.directorCommandId ?? null,
  }, "INTERRUPTION_REVIEWED", {
    scope: review.scope,
    message: review.message,
    affectedArtifacts: review.affectedArtifacts,
    recommendedAction: review.recommendedAction,
  })
  if (options.factoryRootDir && options.projectId) {
    await syncManagedProjectState(options.factoryRootDir, options.projectId, state).catch(() => undefined)
  }

  const { reportsDir } = getWorkspacePaths(options.rootDir)
  await fs.mkdir(reportsDir, { recursive: true })
  const logPath = path.join(reportsDir, "interruptions.log.md")
  const header = `## ${review.timestamp}\n- Scope: ${review.scope}\n- Message: ${review.message}\n- Action: ${review.recommendedAction}\n\n`
  await fs.appendFile(logPath, header)

  return review
}

export function formatStatus(state: AutonomousNovelState) {
  const pending = state.plan.chapterTasks.filter((task) => task.status === "pending").length
  const completed = state.plan.chapterTasks.filter((task) => task.status === "complete").length

  return [
    `Project: ${state.project.title}`,
    `Stage: ${state.runtime.stage}`,
    `Status: ${state.runtime.statusMessage}`,
    `Pending chapters: ${pending}`,
    `Completed chapters: ${completed}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    `Cover status: ${state.assets.cover.status}`,
    `Comic status: ${state.assets.comic.status}`,
    state.runtime.lastInterruption
      ? `Last interruption: ${state.runtime.lastInterruption.scope} at ${state.runtime.lastInterruption.timestamp}`
      : "Last interruption: none",
  ].join("\n")
}

export function getWorkspaceSummary(rootDir: string) {
  const paths = getWorkspacePaths(rootDir)

  return {
    rootDir,
    workspaceDir: paths.workspaceDir,
    slug: slugifyTitle(path.basename(rootDir)),
  }
}
