import fs from "node:fs/promises"
import path from "node:path"

import type {
  AutonomousNovelState,
  ChapterTask,
  InitProjectOptions,
  InterruptOptions,
  InterruptionReview,
  InterruptionScope,
  NovelProjectRecord,
} from "./cli-types"
import { loadLlmConfigFromEnv } from "./llm-config"

const WORKSPACE_DIR = ".ai-novel"
const PROJECTS_DIR = ".ai-novel-projects"
const PROJECTS_REGISTRY_FILE = "projects.json"
const WORKSPACE_VERSION = 1
const MIN_CHAPTER_WORD_TARGET = 2500
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

function buildChapterTasks(totalChapters: number, chapterWordTarget: number): ChapterTask[] {
  return Array.from({ length: totalChapters }, (_, index) => {
    const chapterNumber = index + 1
    return {
      chapterNumber,
      title: `Chapter ${chapterNumber}`,
      status: "pending",
      summary: `Draft chapter ${chapterNumber} against the master plan and active foreshadowing.`,
      targetWords: chapterWordTarget,
    }
  })
}

function buildInitialState(options: InitProjectOptions): AutonomousNovelState {
  const now = new Date().toISOString()
  const title = options.title?.trim() || inferTitleFromIdea(options.idea)
  const chapterTasks = buildChapterTasks(options.totalChapters, options.chapterWordTarget)

  return {
    project: {
      title,
      idea: options.idea.trim(),
      createdAt: now,
      workspaceVersion: WORKSPACE_VERSION,
    },
    runtime: {
      stage: "worldbuilding_dialogue",
      statusMessage: "Collecting worldbuilding answers through the ReAct discussion phase.",
      lastUpdatedAt: now,
      lastInterruption: null,
      lastRoute: "init",
      lastAction: "workspace initialized",
      lastProviderCheck: null,
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
  const llmConfig = loadLlmConfigFromEnv()

  await fs.mkdir(paths.promptsDir, { recursive: true })
  await fs.mkdir(paths.agentPromptsDir, { recursive: true })
  await fs.mkdir(paths.plansDir, { recursive: true })
  await fs.mkdir(paths.reportsDir, { recursive: true })
  await fs.mkdir(paths.styleDir, { recursive: true })
  await fs.mkdir(paths.chaptersDir, { recursive: true })
  await fs.mkdir(paths.coverDir, { recursive: true })
  await fs.mkdir(paths.comicDir, { recursive: true })
  await fs.mkdir(paths.characterCoreDir, { recursive: true })

  await fs.writeFile(paths.statePath, `${JSON.stringify(state, null, 2)}\n`)
  llmConfig.writing.chapterWordTarget = state.plan.chapterWordTarget
  llmConfig.writing.chapterWordMinimum = MIN_CHAPTER_WORD_TARGET
  await fs.writeFile(paths.configPath, `${JSON.stringify(llmConfig, null, 2)}\n`)

  const reactPrompt = [
    "# ReAct Worldbuilding Session",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
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
    "Open slots:",
    "- identity",
    "- wound",
    "- desire",
    "- contradiction",
    "- unique tie to the central conflict",
  ].join("\n")

  const relations = [
    "# Character Relations",
    "",
    "- protagonist: pending",
    "- ally axis: pending",
    "- rival axis: pending",
    "- intimate/conflicted axis: pending",
  ].join("\n")

  const evolution = [
    "# Character Evolution Log",
    "",
    "No chapter-driven character changes recorded yet.",
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
      "# Prose Stylist Base Prompt\n\nYou humanize language, deepen scene texture, and reduce AI-sounding phrasing without changing core plot decisions.",
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

  return state
}

export async function listAutonomousProjects(rootDir: string) {
  return readProjectRegistry(rootDir)
}

export async function resolveManagedProjectRoot(rootDir: string, projectId: string) {
  const projects = await readProjectRegistry(rootDir)
  const project = projects.find((entry) => entry.id === projectId)
  if (!project) {
    throw new Error(`Project '${projectId}' not found.`)
  }

  return project.projectRoot
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
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
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

export async function advanceAutonomousProject(rootDir: string) {
  const state = await loadAutonomousState(rootDir)
  const paths = getWorkspacePaths(rootDir)
  const context = {
    consensus: await readOptionalText(paths.consensusPath),
    protagonist: await readOptionalText(paths.protagonistPath),
    style: await readOptionalText(paths.styleProfilePath),
  }

  if (state.runtime.stage === "worldbuilding_dialogue") {
    await fs.writeFile(paths.settingFreezePath, `${createSettingFreeze(state, context)}\n`)
    state.runtime.stage = "setting_review"
    state.runtime.statusMessage = "Setting freeze drafted. Review the frozen world assumptions before outlining."
    await saveAutonomousState(rootDir, state)
    return state
  }

  if (state.runtime.stage === "setting_review") {
    await fs.writeFile(paths.masterOutlinePath, `${createMasterOutline(state, context)}\n`)
    state.runtime.stage = "master_planning"
    state.runtime.statusMessage = "Master outline generated. Next step is to expand chapter blueprints."
    await saveAutonomousState(rootDir, state)
    return state
  }

  if (state.runtime.stage === "master_planning") {
    await fs.mkdir(paths.chapterBlueprintsDir, { recursive: true })
    await Promise.all(
      state.plan.chapterTasks.map((task) =>
        fs.writeFile(
          path.join(paths.chapterBlueprintsDir, `chapter-${String(task.chapterNumber).padStart(3, "0")}.md`),
          `${createChapterBlueprint(state, task, context)}\n`,
        ),
      ),
    )
    state.runtime.stage = "chapter_task_generation"
    state.runtime.statusMessage = "Chapter blueprints generated. Drafting can begin from the queued tasks."
    await saveAutonomousState(rootDir, state)
    return state
  }

  if (state.runtime.stage === "chapter_task_generation" || state.runtime.stage === "drafting") {
    const nextTask = state.plan.chapterTasks.find((task) => task.status === "pending")

    if (!nextTask) {
      state.runtime.stage = "complete"
      state.runtime.statusMessage = "All chapter drafts have been generated."
      state.plan.pendingChapters = 0
      await saveAutonomousState(rootDir, state)
      return state
    }

    const draftPath = path.join(paths.chaptersDir, `chapter-${String(nextTask.chapterNumber).padStart(3, "0")}.md`)
    await fs.mkdir(paths.chaptersDir, { recursive: true })
    await fs.writeFile(draftPath, `${createChapterDraft(state, nextTask, context)}\n`)
    nextTask.status = "complete"
    state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length
    state.runtime.stage = state.plan.pendingChapters > 0 ? "drafting" : "complete"
    state.runtime.statusMessage =
      state.runtime.stage === "complete"
        ? "All chapter drafts have been generated."
        : `Generated draft for chapter ${nextTask.chapterNumber}. Continue to draft the next queued chapter.`
    await saveAutonomousState(rootDir, state)
    return state
  }

  state.runtime.statusMessage = `No advance action is defined for stage ${state.runtime.stage}.`
  await saveAutonomousState(rootDir, state)
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

  await saveAutonomousState(options.rootDir, state)

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
