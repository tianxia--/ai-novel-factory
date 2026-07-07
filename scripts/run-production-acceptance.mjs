#!/usr/bin/env node

/**
 * Real production acceptance runner for the AI novel factory.
 *
 * This script drives the same Studio API used by the app. It does not mock the
 * LLM, does not import secrets from .env, and does not bypass user-facing gates
 * unless an explicit auto-approval flag is passed.
 *
 * Typical long-form run:
 *
 *   rtk node scripts/run-production-acceptance.mjs \
 *     --chapters 40 \
 *     --chapter-words 3000 \
 *     --auto-approve-style \
 *     --auto-approve-foundation
 *
 * Safety check without generating:
 *
 *   rtk node scripts/run-production-acceptance.mjs --plan-only
 */

import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_TARGET_MIN_WORDS = 100000
const DEFAULT_TARGET_MAX_WORDS = 300000
const DEFAULT_CHAPTERS = 40
const DEFAULT_CHAPTER_WORDS = 3000
const DEFAULT_STYLE_MAX_REQUESTS = 8

export class AcceptanceError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = "AcceptanceError"
    this.details = details
  }
}

function usage() {
  return [
    "Usage:",
    "  rtk node scripts/run-production-acceptance.mjs [options]",
    "",
    "Options:",
    "  --root-dir <path>              Factory root. Default: current workspace.",
    "  --resume-project-id <id>       Resume an existing project instead of creating one.",
    "  --title <text>                 Project title for a new run.",
    "  --idea <text>                  Novel idea for a new run.",
    "  --chapters <n>                 Target chapter count. Default: 40.",
    "  --chapter-words <n>            Target words per chapter. Default: 3000.",
    "  --min-total-words <n>          Final acceptance lower bound. Default: 100000.",
    "  --max-total-words <n>          Final acceptance upper bound. Default: 300000.",
    "  --style-prompt <text>          Style Evolution user style prompt.",
    "  --style-iterations <n>         Style loop iterations per request. Default: 3.",
    "  --style-max-requests <n>       Max Style Evolution API requests before failing. Default: 8.",
    "  --style-candidates <n>         Candidate count per style iteration. Default: 2.",
    "  --aigc-detector-provider <id>   AIGC detector provider: local-heuristic, generic-json, gradio-queue, disabled.",
    "  --aigc-detector-url <url>       AIGC detector endpoint URL.",
    "  --aigc-detector-token <token>   AIGC detector bearer token.",
    "  --aigc-detector-threshold <n>   AIGC detector threshold. Default comes from settings.",
    "  --aigc-detector-timeout-ms <n>  AIGC detector timeout in ms.",
    "  --auto-approve-style           Explicitly approve the generated style candidate.",
    "  --auto-approve-foundation      Explicitly approve story foundation after planning.",
    "  --no-story-repair              Do not call story asset repair if planning assets are weak.",
    "  --skip-provider-health-check   Skip the lightweight real LLM connectivity check.",
    "  --plan-only                    Only validate config and print the intended flow.",
    "  --stop-after-style             Stop after Style Evolution gate.",
    "  --stop-after-foundation        Stop after story foundation readiness.",
    "  --max-advance-steps <n>        Max Studio API advance calls.",
    "  --max-stale-steps <n>          Fail after this many steps without chapter progress. Default: 20.",
    "  --report <path>                JSON report path.",
    "  --help                        Show this help.",
  ].join("\n")
}

function parseArgs(argv) {
  const options = {
    rootDir: WORKSPACE_ROOT,
    resumeProjectId: process.env.AI_NOVEL_ACCEPTANCE_PROJECT_ID || "",
    title: process.env.AI_NOVEL_ACCEPTANCE_TITLE || `Production Acceptance ${new Date().toISOString().slice(0, 10)}`,
    idea: process.env.AI_NOVEL_ACCEPTANCE_IDEA || [
      "A Chinese long-form mystery about a minor archive clerk who discovers that tax ledgers,",
      "family debts, and imperial weather records hide the same impossible contradiction.",
      "The story must support deep worldbuilding, a pressure-tested protagonist, supporting cast,",
      "relationship changes, foreshadowing, hooks, literary prose, and long-range continuity.",
    ].join(" "),
    chapters: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_CHAPTERS, DEFAULT_CHAPTERS),
    chapterWords: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_CHAPTER_WORDS, DEFAULT_CHAPTER_WORDS),
    minTotalWords: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_MIN_WORDS, DEFAULT_TARGET_MIN_WORDS),
    maxTotalWords: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_MAX_WORDS, DEFAULT_TARGET_MAX_WORDS),
    stylePrompt: process.env.AI_NOVEL_ACCEPTANCE_STYLE_PROMPT || [
      "Chinese serialized novel prose. Keep it scene-first, textured, and emotionally precise.",
      "Avoid outline voice, template suspense, explanatory summaries, and stiff AI phrasing.",
      "Characters must have distinct speech, visible habits, changing relationships, and pressure.",
    ].join(" "),
    styleIterations: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_STYLE_ITERATIONS, 3),
    styleMaxRequests: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_STYLE_MAX_REQUESTS, DEFAULT_STYLE_MAX_REQUESTS),
    styleCandidates: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_STYLE_CANDIDATES, 2),
    aigcDetector: {
      provider: process.env.AIGC_DETECTOR_PROVIDER || "local-heuristic",
      url: process.env.AIGC_DETECTOR_URL || "",
      token: process.env.AIGC_DETECTOR_TOKEN || "",
      threshold: process.env.AIGC_DETECTOR_THRESHOLD || "",
      timeoutMs: process.env.AIGC_DETECTOR_TIMEOUT_MS || "",
    },
    autoApproveStyle: readBoolean(process.env.AI_NOVEL_ACCEPTANCE_AUTO_APPROVE_STYLE),
    autoApproveFoundation: readBoolean(process.env.AI_NOVEL_ACCEPTANCE_AUTO_APPROVE_FOUNDATION),
    autoRepairStoryAssets: true,
    providerHealthCheck: !readBoolean(process.env.AI_NOVEL_ACCEPTANCE_SKIP_PROVIDER_HEALTH_CHECK),
    planOnly: false,
    stopAfterStyle: false,
    stopAfterFoundation: false,
    maxAdvanceSteps: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_MAX_ADVANCE_STEPS, 0),
    maxStaleSteps: readPositiveInt(process.env.AI_NOVEL_ACCEPTANCE_MAX_STALE_STEPS, 20),
    reportPath: process.env.AI_NOVEL_ACCEPTANCE_REPORT || "",
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = () => {
      index += 1
      if (index >= argv.length) {
        throw new AcceptanceError(`Missing value after ${arg}`)
      }
      return argv[index]
    }

    if (arg === "--help" || arg === "-h") {
      console.log(usage())
      process.exit(0)
    } else if (arg === "--root-dir") {
      options.rootDir = path.resolve(next())
    } else if (arg === "--resume-project-id") {
      options.resumeProjectId = next().trim()
    } else if (arg === "--title") {
      options.title = next().trim()
    } else if (arg === "--idea") {
      options.idea = next().trim()
    } else if (arg === "--chapters") {
      options.chapters = readPositiveInt(next(), options.chapters)
    } else if (arg === "--chapter-words") {
      options.chapterWords = readPositiveInt(next(), options.chapterWords)
    } else if (arg === "--min-total-words") {
      options.minTotalWords = readPositiveInt(next(), options.minTotalWords)
    } else if (arg === "--max-total-words") {
      options.maxTotalWords = readPositiveInt(next(), options.maxTotalWords)
    } else if (arg === "--style-prompt") {
      options.stylePrompt = next().trim()
    } else if (arg === "--style-iterations") {
      options.styleIterations = readPositiveInt(next(), options.styleIterations)
    } else if (arg === "--style-max-requests") {
      options.styleMaxRequests = readPositiveInt(next(), options.styleMaxRequests)
    } else if (arg === "--style-candidates") {
      options.styleCandidates = readPositiveInt(next(), options.styleCandidates)
    } else if (arg === "--aigc-detector-provider") {
      options.aigcDetector.provider = next().trim()
    } else if (arg === "--aigc-detector-url") {
      options.aigcDetector.url = next().trim()
    } else if (arg === "--aigc-detector-token") {
      options.aigcDetector.token = next().trim()
    } else if (arg === "--aigc-detector-threshold") {
      options.aigcDetector.threshold = next().trim()
    } else if (arg === "--aigc-detector-timeout-ms") {
      options.aigcDetector.timeoutMs = next().trim()
    } else if (arg === "--auto-approve-style") {
      options.autoApproveStyle = true
    } else if (arg === "--auto-approve-foundation") {
      options.autoApproveFoundation = true
    } else if (arg === "--no-story-repair") {
      options.autoRepairStoryAssets = false
    } else if (arg === "--skip-provider-health-check") {
      options.providerHealthCheck = false
    } else if (arg === "--plan-only") {
      options.planOnly = true
    } else if (arg === "--stop-after-style") {
      options.stopAfterStyle = true
    } else if (arg === "--stop-after-foundation") {
      options.stopAfterFoundation = true
    } else if (arg === "--max-advance-steps") {
      options.maxAdvanceSteps = readPositiveInt(next(), options.maxAdvanceSteps)
    } else if (arg === "--max-stale-steps") {
      options.maxStaleSteps = readPositiveInt(next(), options.maxStaleSteps)
    } else if (arg === "--report") {
      options.reportPath = path.resolve(next())
    } else {
      throw new AcceptanceError(`Unknown option: ${arg}`)
    }
  }

  options.rootDir = path.resolve(options.rootDir)
  if (!options.reportPath) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    options.reportPath = path.join(options.rootDir, ".ai-novel-factory", "acceptance-runs", `${stamp}.json`)
  }
  if (!options.maxAdvanceSteps) {
    options.maxAdvanceSteps = options.chapters * 6 + 80
  }
  return options
}

function readPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readBoolean(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase())
}

function now() {
  return new Date().toISOString()
}

function log(message, payload) {
  const suffix = payload === undefined ? "" : ` ${JSON.stringify(payload)}`
  console.log(`[${now()}] ${message}${suffix}`)
}

function summarizeError(error) {
  if (error instanceof AcceptanceError) {
    return {
      name: error.name,
      message: error.message,
      details: error.details,
    }
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { name: "Error", message: String(error) }
}

function redactAcceptanceOptions(options) {
  return {
    ...options,
    idea: compactText(options.idea, 180),
    stylePrompt: compactText(options.stylePrompt, 180),
    aigcDetector: redactAigcDetectorOptions(options.aigcDetector),
  }
}

function redactAigcDetectorOptions(detector) {
  return {
    ...detector,
    token: detector?.token ? "[configured]" : "",
  }
}

function compactText(value, limit = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim()
  return text.length > limit ? `${text.slice(0, limit)}...` : text
}

function assertLongFormTarget(options) {
  const targetWords = options.chapters * options.chapterWords
  if (targetWords < options.minTotalWords || targetWords > options.maxTotalWords) {
    throw new AcceptanceError("Configured target is outside the long-form acceptance range.", {
      chapters: options.chapters,
      chapterWords: options.chapterWords,
      targetWords,
      minTotalWords: options.minTotalWords,
      maxTotalWords: options.maxTotalWords,
    })
  }
}

async function loadStudioApi() {
  const entry = path.join(WORKSPACE_ROOT, "packages", "ai-novel-core", "dist", "studio-server.js")
  const module = await import(`${pathToFileURL(entry).href}?acceptance=${Date.now()}`)
  if (typeof module.handleNovelStudioApi !== "function") {
    throw new AcceptanceError("Cannot load handleNovelStudioApi from dist/studio-server.js.", { entry })
  }
  return module.handleNovelStudioApi
}

async function loadCoreIndexForAcceptance() {
  const entry = path.join(WORKSPACE_ROOT, "packages", "ai-novel-core", "dist", "index.js")
  return import(`${pathToFileURL(entry).href}?acceptanceCore=${Date.now()}`)
}

async function loadChapterBlueprintsForAcceptance(rootDir, projectId, totalChapters) {
  if (!projectId || !totalChapters) return []
  let projectRoot = ""
  try {
    if (projectId === "legacy-root-workspace") {
      projectRoot = rootDir
    } else {
      const core = await loadCoreIndexForAcceptance()
      if (typeof core.resolveManagedProjectRoot !== "function") return []
      projectRoot = await core.resolveManagedProjectRoot(rootDir, projectId)
    }
  } catch {
    return []
  }
  const blueprints = []
  for (let chapterNumber = 1; chapterNumber <= totalChapters; chapterNumber += 1) {
    const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
    const blueprintPath = path.join(projectRoot, ".ai-novel", "plans", "chapter-blueprints", `${chapterId}.md`)
    const content = await fs.readFile(blueprintPath, "utf8").catch(() => "")
    if (content.trim()) {
      blueprints.push({
        chapterNumber,
        path: `.ai-novel/plans/chapter-blueprints/${chapterId}.md`,
        content,
        sceneCards: extractSceneCardsFromBlueprintForAcceptance(content),
      })
    }
  }
  return blueprints
}

function createApi(rootDir, handleNovelStudioApi, report) {
  return async function api(method, pathname, body = {}, projectId = undefined) {
    const startedAt = Date.now()
    const result = await handleNovelStudioApi(rootDir, method, pathname, body, { projectId })
    const elapsedMs = Date.now() - startedAt
    report.apiCalls.push({
      method,
      pathname,
      status: result.status,
      elapsedMs,
      projectId: projectId || body.projectId || null,
    })
    if (result.status >= 400) {
      throw new AcceptanceError(`Studio API ${method} ${pathname} failed with status ${result.status}.`, {
        status: result.status,
        payload: result.payload,
      })
    }
    return result.payload
  }
}

export function findConfiguredLlm(configPayload) {
  const configs = Array.isArray(configPayload.configs) ? configPayload.configs : []
  const routes = Array.isArray(configPayload.routes) ? configPayload.routes : []
  const configured = configs.filter((config) =>
    config
    && config.api_key_configured === true
    && String(config.base_url || "").trim()
    && String(config.model_name || "").trim()
  )
  const active = configured.find((config) => Number(config.is_active || 0) === 1) || configured[0] || null
  const textRoute = routes.find((route) => route.capability === "text")
  const styleRoute = routes.find((route) => route.capability === "style_evolution")
  const textConfig = configured.find((config) => String(config.id) === String(textRoute?.config_id))
    || active
  const styleConfig = configured.find((config) => String(config.id) === String(styleRoute?.config_id))
    || textConfig
    || active
  return {
    configs,
    routes,
    configured,
    active,
    textConfig,
    styleConfig,
  }
}

function assertModelConfigReady(modelInfo) {
  if (!modelInfo.textConfig) {
    throw new AcceptanceError("No usable text LLM route found. Add a model in the app settings before running real acceptance.", {
      configuredCount: modelInfo.configured.length,
    })
  }
  if (!modelInfo.styleConfig) {
    throw new AcceptanceError("No usable Style Evolution LLM route found.", {
      configuredCount: modelInfo.configured.length,
    })
  }
}

export function buildProviderHealthTargets(modelInfo) {
  const byId = new Map()
  const add = (capability, config) => {
    if (!config?.id) {
      return
    }
    const id = String(config.id)
    const existing = byId.get(id)
    if (existing) {
      existing.capabilities.push(capability)
      return
    }
    byId.set(id, {
      capabilities: [capability],
      config,
    })
  }
  add("text", modelInfo.textConfig)
  add("style_evolution", modelInfo.styleConfig)
  return Array.from(byId.values())
}

async function assertProviderHealth(api, modelInfo, report, projectId, enabled) {
  const targets = buildProviderHealthTargets(modelInfo)
  if (!enabled) {
    report.steps.push({
      step: "provider_health",
      status: "skipped",
      at: now(),
      targetCount: targets.length,
    })
    log("Provider health check skipped by flag.", { targetCount: targets.length })
    return
  }

  for (const target of targets) {
    const config = target.config
    const capability = target.capabilities.join("/")
    const payload = {
      id: config.id,
      projectId: projectId || undefined,
      LLM_BASE_URL: config.base_url,
      LLM_MODEL_ID: config.model_name,
      LLM_API_MODE: config.api_mode,
      LLM_API_KEY: "[configured]",
    }
    const response = await api("POST", "/api/provider-test", payload, projectId || undefined)
    const result = response.result || {}
    const step = {
      step: "provider_health",
      status: result.ok ? "passed" : "blocked",
      at: now(),
      capability,
      configId: config.id,
      name: config.name,
      baseUrl: result.baseUrl || config.base_url,
      modelName: result.modelName || config.model_name,
      apiMode: result.apiMode || config.api_mode,
      message: result.message || "",
    }
    report.steps.push(step)
    if (!result.ok) {
      throw new AcceptanceError("LLM provider health check failed before production acceptance.", {
        capability,
        configId: config.id,
        name: config.name,
        baseUrl: step.baseUrl,
        modelName: step.modelName,
        apiMode: step.apiMode,
        message: step.message,
        nextAction: "Open model settings, update the saved API key or route, then rerun this acceptance command.",
      })
    }
    log("Provider health check passed.", {
      capability,
      name: config.name,
      modelName: step.modelName,
      apiMode: step.apiMode,
    })
  }
}

function normalizeAigcProvider(value) {
  return value === "local-heuristic" || value === "generic-json" || value === "gradio-queue" || value === "disabled"
    ? value
    : ""
}

function normalizeAigcDetectorSettings(detector) {
  const settings = {}
  const provider = normalizeAigcProvider(String(detector?.provider || "").trim())
  if (provider) settings.provider = provider
  if (detector?.url) settings.url = String(detector.url).trim()
  if (detector?.token) settings.token = String(detector.token).trim()
  if (detector?.threshold && Number.isFinite(Number(detector.threshold))) {
    settings.threshold = Number(detector.threshold)
  }
  if (detector?.timeoutMs && Number.isFinite(Number(detector.timeoutMs))) {
    settings.timeoutMs = Number(detector.timeoutMs)
  }
  return settings
}

function hasExplicitAigcDetectorSettings(detector) {
  return Object.keys(normalizeAigcDetectorSettings(detector)).length > 0
}

function detectorReady(settingsPayload) {
  const detector = settingsPayload?.settings?.aigcDetector || {}
  if (detector.provider === "disabled") return false
  if (detector.provider === "local-heuristic") return true
  return Boolean(String(detector.url || "").trim())
}

export function buildAcceptanceWritingSettings(aigcDetectorOptions = {}) {
  const settings = {
    autoAigcRefinement: true,
  }
  if (hasExplicitAigcDetectorSettings(aigcDetectorOptions)) {
    settings.aigcDetector = normalizeAigcDetectorSettings(aigcDetectorOptions)
  }
  return settings
}

function getObjectPath(value, pathExpression) {
  return String(pathExpression || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => current && typeof current === "object" ? current[key] : undefined, value)
}

function isFilledAcceptanceValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === "object") return Object.keys(value).length > 0
  return String(value || "").trim().length > 0
}

function countArrayValue(value) {
  return Array.isArray(value) ? value.length : 0
}

function acceptanceJsonSize(value) {
  try {
    return JSON.stringify(value || {}).length
  } catch {
    return 0
  }
}

function normalizeAuditText(value) {
  return String(value || "")
    .replace(/[“”「」『』"'`，。！？!?；;：:\s、,.]/gu, "")
    .trim()
}

function splitBodyParagraphs(body) {
  return String(body || "")
    .split(/\n{2,}/u)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function countAcceptanceBodyWords(body) {
  const text = String(body || "")
    .replace(/```[\s\S]*?```/gu, "")
    .replace(/^#+\s+.*$/gmu, "")
    .replace(/\s+/gu, " ")
  const cjkChars = text.match(/\p{Script=Han}/gu) || []
  const latinTokens = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/gu) || []
  return cjkChars.length + latinTokens.length
}

function countMatches(text, pattern) {
  return (String(text || "").match(pattern) || []).length
}

function evidenceWindowsAroundTerms(text, terms, radius = 160) {
  const source = String(text || "")
  const windows = []
  for (const rawTerm of terms) {
    const term = String(rawTerm || "").trim()
    if (term.length < 2) continue
    let index = source.indexOf(term)
    while (index >= 0) {
      windows.push({
        term,
        text: source.slice(Math.max(0, index - radius), Math.min(source.length, index + term.length + radius)),
      })
      index = source.indexOf(term, index + term.length)
    }
  }
  const seen = new Set()
  return windows.filter((window) => {
    const key = `${window.term}:${window.text}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function extractKnownCastNames(snapshot) {
  const dossiers = Array.isArray(snapshot?.characters?.dossiers) ? snapshot.characters.dossiers : []
  const names = []
  for (const dossier of dossiers) {
    const canonicalName = String(dossier?.canonicalName || dossier?.name || "").trim()
    if (canonicalName) names.push(canonicalName)
    for (const alias of Array.isArray(dossier?.aliases) ? dossier.aliases : []) {
      const value = String(alias || "").trim()
      if (value) names.push(value)
    }
  }
  const relationshipGraph = snapshot?.characters?.relationshipGraph
  const graphCharacters = Array.isArray(relationshipGraph?.characters) ? relationshipGraph.characters : []
  for (const character of graphCharacters) {
    const name = String(character?.name || character?.canonicalName || "").trim()
    if (name) names.push(name)
  }
  return [...new Set(names.filter((name) => name.length >= 2 && !/^(主角|配角|对抗力量|关键关系对象)$/u.test(name)))]
}

const GENERIC_SCENE_CARD_CHARACTER_TERMS = new Set([
  "主角",
  "主人公",
  "任何主角",
  "配角",
  "人物",
  "角色",
  "对抗力量",
  "关键关系对象",
  "服务首章事件的关系角色",
  "关系角色",
  "关系裂缝",
  "关系网络",
  "章末期待",
  "章节桥接",
  "上章承接",
  "章末钩子",
  "沿用",
  "高潮",
  "章节",
  "章事件",
  "章局部",
  "景描写",
  "成语",
  "对话",
  "旁白",
])

function isConcreteSceneCardCharacterName(value) {
  const name = String(value || "").trim()
  if (!name || GENERIC_SCENE_CARD_CHARACTER_TERMS.has(name)) return false
  if (/pending|待定|未命名|任意|任何|关键|关系|章节|章末|钩子|伏笔|线索|世界|规则|读者|场景|情节|旁白|对话|成语/iu.test(name)) {
    return false
  }
  return /^[\u4e00-\u9fff·]{2,8}$/u.test(name)
}

function extractJsonArrayAfterKeyForAcceptance(text, key) {
  const marker = `"${key}"`
  const markerIndex = String(text || "").indexOf(marker)
  if (markerIndex < 0) return ""
  const start = String(text || "").indexOf("[", markerIndex)
  if (start < 0) return ""
  let depth = 0
  let inString = false
  let escaped = false
  const source = String(text || "")
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === "\\") {
        escaped = true
      } else if (char === "\"") {
        inString = false
      }
      continue
    }
    if (char === "\"") {
      inString = true
      continue
    }
    if (char === "[") {
      depth += 1
    } else if (char === "]") {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
  }
  return ""
}

function extractSceneCardsFromBlueprintForAcceptance(blueprintText) {
  const sceneCardsJson = extractJsonArrayAfterKeyForAcceptance(blueprintText, "sceneCards")
  if (!sceneCardsJson) return []
  try {
    const parsed = JSON.parse(sceneCardsJson)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((card, index) => ({
        index: Number(card?.index || index + 1),
        goal: String(card?.goal || "").trim(),
        requiredCharacters: Array.isArray(card?.requiredCharacters)
          ? card.requiredCharacters.map((name) => String(name || "").trim()).filter(Boolean)
          : [],
      }))
      .filter((card) => card.goal || card.requiredCharacters.length)
  } catch {
    return []
  }
}

function normalizeChapterBlueprintsForAcceptance(snapshot) {
  const candidates = [
    snapshot?.chapterBlueprints,
    snapshot?.lore?.chapterBlueprints,
  ].find(Array.isArray) || []
  return candidates
    .map((entry) => {
      const chapterNumber = Number(entry?.chapterNumber || entry?.chapter || 0)
      const content = String(entry?.content || entry?.blueprint || "")
      const sceneCards = Array.isArray(entry?.sceneCards)
        ? entry.sceneCards
        : extractSceneCardsFromBlueprintForAcceptance(content)
      return {
        chapterNumber,
        path: String(entry?.path || ""),
        sceneCards: sceneCards.map((card, index) => ({
          index: Number(card?.index || index + 1),
          requiredCharacters: Array.isArray(card?.requiredCharacters)
            ? card.requiredCharacters.map((name) => String(name || "").trim()).filter(Boolean)
            : [],
        })),
      }
    })
    .filter((entry) => Number.isFinite(entry.chapterNumber) && entry.chapterNumber > 0 && entry.sceneCards.length)
}

function hasSceneCharacterEvidence(body, name) {
  const windows = evidenceWindowsAroundTerms(body, [name], 90)
  if (!windows.length) return false
  return windows.some((window) =>
    /「|」|说|问|道|低声|站|走|退|停|伸手|攥|按|推|拿|递|藏|拦|抬|看|听|合上|扣住|选择|决定|拒绝|债|信任|压力|风险|追索|欠/u.test(window.text)
  )
}

export function auditSceneCardCharacterObligationsForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const blueprints = normalizeChapterBlueprintsForAcceptance(snapshot)
  const blueprintByChapter = new Map(blueprints.map((entry) => [entry.chapterNumber, entry]))
  const issues = []
  const chapterAudits = []
  let auditedChapters = 0
  let passedChapters = 0
  let requiredCharactersTotal = 0

  for (const chapter of chapters) {
    const chapterNumber = Number(chapter?.chapterNumber || 0)
    const blueprint = blueprintByChapter.get(chapterNumber)
    if (!blueprint) continue
    const body = String(chapter?.body || "")
    const cardAudits = blueprint.sceneCards
      .map((card) => {
        const requiredCharacters = [...new Set((card.requiredCharacters || []).filter(isConcreteSceneCardCharacterName))]
        const missingCharacters = requiredCharacters.filter((name) => !body.includes(name))
        const thinEvidenceCharacters = requiredCharacters
          .filter((name) => body.includes(name))
          .filter((name) => !hasSceneCharacterEvidence(body, name))
        return {
          index: Number(card.index || 0),
          requiredCharacters,
          missingCharacters,
          thinEvidenceCharacters,
        }
      })
      .filter((card) => card.requiredCharacters.length)
    if (!cardAudits.length) continue
    auditedChapters += 1
    requiredCharactersTotal += cardAudits.reduce((sum, card) => sum + card.requiredCharacters.length, 0)
    const missingCards = cardAudits.filter((card) => card.missingCharacters.length || card.thinEvidenceCharacters.length)
    if (!missingCards.length) {
      passedChapters += 1
    } else {
      issues.push(`chapter ${chapterNumber}: scene-card required characters missing or thin evidence: ${missingCards.map((card) => {
        const parts = []
        if (card.missingCharacters.length) parts.push(`card ${card.index} missing ${card.missingCharacters.join("、")}`)
        if (card.thinEvidenceCharacters.length) parts.push(`card ${card.index} thin ${card.thinEvidenceCharacters.join("、")}`)
        return parts.join("; ")
      }).join(" | ")}`)
    }
    chapterAudits.push({
      chapterNumber,
      title: chapter?.title || "",
      cardAudits,
      passed: missingCards.length === 0,
    })
  }

  return {
    passed: issues.length === 0,
    issues,
    summary: {
      skipped: auditedChapters === 0,
      auditedChapters,
      passedChapters,
      totalBlueprints: blueprints.length,
      requiredCharactersTotal,
      expectedChapters: Number(options.chapters || snapshot?.project?.totalChapters || chapters.length || 0),
    },
    chapters: chapterAudits,
  }
}

function extractAcceptanceCharacterDossiers(snapshot) {
  const dossiers = Array.isArray(snapshot?.characters?.dossiers) ? snapshot.characters.dossiers : []
  const knownNames = extractKnownCastNames(snapshot)
  const byName = new Map()
  for (const dossier of dossiers) {
    const canonicalName = String(dossier?.canonicalName || dossier?.name || "").trim()
    if (!canonicalName) continue
    byName.set(canonicalName, {
      id: String(dossier?.id || "").trim(),
      name: canonicalName,
      role: String(dossier?.role || dossier?.type || "").trim(),
      coreDesire: String(dossier?.coreDesire || dossier?.desire || dossier?.goal || "").trim(),
      aliases: (Array.isArray(dossier?.aliases) ? dossier.aliases : []).map((alias) => String(alias || "").trim()).filter(Boolean),
      speechMarkers: (Array.isArray(dossier?.speechMarkers) ? dossier.speechMarkers : []).map((item) => String(item || "").trim()).filter(Boolean),
      behaviorHabits: (Array.isArray(dossier?.behaviorHabits) ? dossier.behaviorHabits : []).map((item) => String(item || "").trim()).filter(Boolean),
      relationshipState: String(dossier?.relationshipState || "").trim(),
      relationshipTerms: extractExecutionTerms(dossier?.relationshipState),
      profileTerms: collectAcceptanceStrings([
        dossier?.identityAndRole,
        dossier?.coreDesire,
        dossier?.desire,
        dossier?.goal,
        dossier?.wound,
        dossier?.appearanceAndBody,
        dossier?.relationshipState,
        dossier?.currentChapterDelta,
        dossier?.skills,
        dossier?.speechMarkers,
        dossier?.behaviorHabits,
      ]).map((item) => String(item || "").trim()).filter((item) => item.length >= 2),
    })
  }
  for (const name of knownNames) {
    if (!byName.has(name)) {
      byName.set(name, {
        id: "",
        name,
        role: "",
        coreDesire: "",
        aliases: [],
        speechMarkers: [],
        behaviorHabits: [],
        relationshipState: "",
        relationshipTerms: [],
        profileTerms: [],
      })
    }
  }
  return Array.from(byName.values())
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function collectRegexGroupMatches(text, pattern) {
  const matches = []
  for (const match of String(text || "").matchAll(pattern)) {
    const value = String(match[1] || "").trim()
    if (value) matches.push(value)
  }
  return matches
}

function collectCharacterDialogueSamples(body, names) {
  const speechVerb = "(?:说|问|道|喊|低声|冷笑|答|叹|唤|喝|回|提醒|催促|开口|接话|咬牙|摇头)"
  const samples = []
  for (const rawName of names) {
    const name = String(rawName || "").trim()
    if (!name) continue
    const escapedName = escapeRegExp(name)
    samples.push(
      ...collectRegexGroupMatches(body, new RegExp(`${escapedName}[^。！？!?；;\\n「“]{0,50}${speechVerb}[^「“\\n]{0,24}[「“]([^」”]{2,120})[」”]`, "gu")),
      ...collectRegexGroupMatches(body, new RegExp(`[「“]([^」”]{2,120})[」”][^。！？!?；;\\n]{0,45}${escapedName}[^。！？!?；;\\n]{0,30}${speechVerb}`, "gu")),
      ...collectRegexGroupMatches(body, new RegExp(`${escapedName}[^。！？!?；;\\n]{0,50}${speechVerb}[^：:\\n]{0,20}[：:]\\s*[「“]?([^」”。！？!?；;\\n]{2,80})[」”]?`, "gu")),
    )
  }
  return samples
}

function collectCharacterWindows(body, names, radius = 90) {
  const source = String(body || "")
  const windows = []
  for (const rawName of names) {
    const name = String(rawName || "").trim()
    if (!name) continue
    let index = source.indexOf(name)
    while (index >= 0) {
      windows.push(source.slice(Math.max(0, index - radius), Math.min(source.length, index + name.length + radius)))
      index = source.indexOf(name, index + name.length)
    }
  }
  return windows
}

function isTemplateDialogue(value) {
  return /这件事很重要|情况很复杂|未来.*危险|我们必须|必须继续|我知道了|我明白|你说得对|怎么办|没时间了|很严重|不能再等/u.test(String(value || ""))
}

function isCoreCharacterRole(role) {
  return /protagonist|main|supporting|主角|核心|配角/iu.test(String(role || ""))
}

export function auditCharacterVoiceForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const dossiers = extractAcceptanceCharacterDossiers(snapshot)
  const allBody = chapters.map((chapter) => String(chapter?.body || "")).join("\n\n")
  const issues = []
  const characterAudits = []
  const dialogueOwners = new Map()
  let totalAttributedDialogue = 0
  let templateDialogue = 0

  for (const dossier of dossiers) {
    const names = [dossier.name, ...dossier.aliases].filter(Boolean)
    const bodyMentions = names.reduce((sum, name) => sum + countMatches(allBody, new RegExp(escapeRegExp(name), "gu")), 0)
    const dialogueSamples = collectCharacterDialogueSamples(allBody, names)
    const normalizedDialogue = dialogueSamples.map((sample) => normalizeAuditText(sample)).filter((sample) => sample.length >= 4)
    const uniqueDialogue = [...new Set(normalizedDialogue)]
    const windows = collectCharacterWindows(allBody, names)
    const joinedWindows = windows.join("\n")
    const actionSignals = countMatches(joinedWindows, /走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|握|松|皱眉|沉默|合上|推开|退|挡|攥|盯|避开/gu)
    const pressureSignals = countMatches(joinedWindows, /必须|不能|决定|选择|代价|风险|欠|债|怕|查清|追问|交出|保住|隐瞒|裂缝|怀疑|逼|拦|失去|暴露|不肯|犹豫/gu)
    const matchedSpeechMarkers = dossier.speechMarkers.filter((marker) => marker.length >= 2 && joinedWindows.includes(marker)).slice(0, 5)
    const matchedBehaviorHabits = dossier.behaviorHabits.filter((habit) => habit.length >= 2 && joinedWindows.includes(habit)).slice(0, 5)
    for (const sample of uniqueDialogue) {
      if (sample.length >= 8) {
        const owners = dialogueOwners.get(sample) || new Set()
        owners.add(dossier.name)
        dialogueOwners.set(sample, owners)
      }
    }
    totalAttributedDialogue += dialogueSamples.length
    templateDialogue += dialogueSamples.filter(isTemplateDialogue).length
    characterAudits.push({
      name: dossier.name,
      role: dossier.role,
      mentionCount: bodyMentions,
      dialogueCount: dialogueSamples.length,
      uniqueDialogueCount: uniqueDialogue.length,
      speechMarkerCount: dossier.speechMarkers.length,
      behaviorHabitCount: dossier.behaviorHabits.length,
      actionSignals,
      pressureSignals,
      matchedSpeechMarkers,
      matchedBehaviorHabits,
      distinctiveEvidenceMatched: matchedSpeechMarkers.length + matchedBehaviorHabits.length,
      requiresDistinctiveEvidence: isCoreCharacterRole(dossier.role)
        && (dossier.speechMarkers.length + dossier.behaviorHabits.length) > 0,
      active: bodyMentions > 0 && (dialogueSamples.length > 0 || actionSignals >= 3 || pressureSignals >= 2),
      voiced: dialogueSamples.length > 0,
      sampleDialogue: dialogueSamples.slice(0, 3),
    })
  }

  const knownCast = dossiers.length
  const activeCharacters = characterAudits.filter((audit) => audit.active).length
  const voicedCharacters = characterAudits.filter((audit) => audit.voiced).length
  const requiredCharacters = knownCast >= 3 ? 3 : Math.min(2, knownCast)
  const requiredVoicedCharacters = Math.min(2, knownCast)
  const repeatedAcrossSpeakers = Array.from(dialogueOwners.entries())
    .filter(([, owners]) => owners.size >= 2)
    .map(([sample, owners]) => ({ sample: sample.slice(0, 80), speakers: Array.from(owners) }))
  const templateRatio = totalAttributedDialogue ? templateDialogue / totalAttributedDialogue : 0

  if (knownCast >= 2 && voicedCharacters < requiredVoicedCharacters) {
    issues.push(`character voice evidence ${voicedCharacters}/${knownCast} below required ${requiredVoicedCharacters}`)
  }
  if (knownCast >= 2 && activeCharacters < requiredCharacters) {
    issues.push(`character agency evidence ${activeCharacters}/${knownCast} below required ${requiredCharacters}`)
  }
  if (repeatedAcrossSpeakers.length > 0) {
    issues.push(`same dialogue used across speakers: ${repeatedAcrossSpeakers[0].sample}`)
  }
  if (totalAttributedDialogue >= Math.max(6, requiredVoicedCharacters * 3) && templateRatio > 0.45) {
    issues.push(`template dialogue ratio ${(templateRatio * 100).toFixed(1)}% is too high`)
  }
  const missingDistinctiveEvidence = characterAudits
    .filter((audit) => audit.voiced && audit.requiresDistinctiveEvidence && audit.distinctiveEvidenceMatched === 0)
  if (missingDistinctiveEvidence.length > 0) {
    issues.push(`core character dossier voice/habit evidence missing: ${missingDistinctiveEvidence.map((audit) => audit.name).join("、")}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      knownCast,
      activeCharacters,
      requiredCharacters,
      voicedCharacters,
      requiredVoicedCharacters,
      totalAttributedDialogue,
      templateDialogue,
      templateRatio,
      distinctiveEvidenceCharacters: characterAudits.filter((audit) => audit.distinctiveEvidenceMatched > 0).length,
      missingDistinctiveEvidence: missingDistinctiveEvidence.length,
    },
    repeatedAcrossSpeakers: repeatedAcrossSpeakers.slice(0, 5),
    characters: characterAudits,
  }
}

function identifyProtagonistForAcceptance(snapshot, dossiers) {
  const foundation = snapshot?.lore?.storyFoundation || {}
  const contract = foundation.contract || {}
  const explicitCandidates = [
    getObjectPath(foundation.characterDynamics, "protagonist"),
    getObjectPath(contract, "characters.protagonist"),
    snapshot?.characters?.protagonist,
    snapshot?.project?.protagonist,
  ].map((value) => String(value || "").trim()).filter(Boolean)
  for (const candidate of explicitCandidates) {
    const matched = dossiers.find((dossier) => dossier.name === candidate || dossier.aliases.includes(candidate))
    if (matched) return matched
  }
  const roleMatched = dossiers.find((dossier) => /protagonist|main|主角|核心/u.test(`${dossier.id} ${dossier.role} ${dossier.aliases.join(" ")}`))
  return roleMatched || dossiers[0] || null
}

function countCharacterActionSignals(text) {
  return countMatches(
    text,
    /走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|握|松|皱眉|沉默|合上|推开|退|挡|攥|盯|避开|靠近|离开|打开|关上/gu,
  )
}

function countCharacterPressureSignals(text) {
  return countMatches(
    text,
    /必须|不能|决定|选择|代价|风险|欠|债|怕|查清|追问|交出|保住|隐瞒|裂缝|怀疑|逼|拦|失去|暴露|不肯|犹豫|背叛|威胁|保护|利用|亏欠|试探|让步|翻脸|改变|真相/gu,
  )
}

export function auditCharacterArcForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const dossiers = extractAcceptanceCharacterDossiers(snapshot)
  const protagonist = identifyProtagonistForAcceptance(snapshot, dossiers)
  const issues = []
  const characterAudits = []
  const supportingNamesByChapter = new Map()

  if (dossiers.length < 2) {
    issues.push(`character cast size ${dossiers.length} below required protagonist plus supporting cast`)
  }
  if (!protagonist) {
    issues.push("no protagonist dossier available for character arc audit")
  }

  for (const dossier of dossiers) {
    const names = [dossier.name, ...dossier.aliases].filter(Boolean)
    const mentionedChapters = []
    let dialogueCount = 0
    let actionSignals = 0
    let pressureSignals = 0
    let profileSignals = 0
    for (const chapter of chapters) {
      const body = String(chapter?.body || "")
      const chapterNumber = Number(chapter?.chapterNumber || 0)
      const mentioned = names.some((name) => body.includes(name))
      if (!mentioned) continue
      mentionedChapters.push(chapterNumber)
      if (dossier.name !== protagonist?.name) {
        const supporting = supportingNamesByChapter.get(chapterNumber) || new Set()
        supporting.add(dossier.name)
        supportingNamesByChapter.set(chapterNumber, supporting)
      }
      const windows = collectCharacterWindows(body, names, 150).join("\n")
      dialogueCount += collectCharacterDialogueSamples(body, names).length
      actionSignals += countCharacterActionSignals(windows)
      pressureSignals += countCharacterPressureSignals(windows)
      profileSignals += dossier.profileTerms.filter((term) => term.length >= 2 && term.length <= 18 && windows.includes(term)).length
    }
    const active = mentionedChapters.length > 0 && (dialogueCount > 0 || actionSignals >= 2 || pressureSignals >= 1)
    characterAudits.push({
      name: dossier.name,
      role: dossier.role,
      protagonist: dossier.name === protagonist?.name,
      mentionChapters: mentionedChapters,
      mentionedChapterCount: mentionedChapters.length,
      dialogueCount,
      actionSignals,
      pressureSignals,
      profileSignals,
      active,
    })
  }

  const totalChapters = chapters.length
  const protagonistAudit = protagonist
    ? characterAudits.find((audit) => audit.name === protagonist.name)
    : null
  const protagonistMentionChapters = protagonistAudit?.mentionedChapterCount || 0
  let protagonistAgencyChapters = 0
  let protagonistPressureChapters = 0
  if (protagonist) {
    const names = [protagonist.name, ...protagonist.aliases].filter(Boolean)
    for (const chapter of chapters) {
      const body = String(chapter?.body || "")
      if (!names.some((name) => body.includes(name))) continue
      const windows = collectCharacterWindows(body, names, 170).join("\n")
      if (countCharacterActionSignals(windows) >= 2 && countCharacterPressureSignals(windows) >= 1) protagonistAgencyChapters += 1
      if (countCharacterPressureSignals(windows) >= 1) protagonistPressureChapters += 1
    }
  }

  const supportingAudits = characterAudits.filter((audit) => !audit.protagonist)
  const activeSupporting = supportingAudits.filter((audit) => audit.active).length
  const supportingCoverageChapters = Array.from(supportingNamesByChapter.values()).filter((names) => names.size > 0).length
  const requiredProtagonistChapters = totalChapters >= 6 ? Math.ceil(totalChapters * 0.8) : totalChapters
  const requiredAgencyChapters = totalChapters >= 6 ? Math.ceil(totalChapters * 0.65) : totalChapters
  const requiredPressureChapters = totalChapters >= 6 ? Math.ceil(totalChapters * 0.6) : Math.min(totalChapters, Math.max(1, totalChapters - 1))
  const requiredSupportingCharacters = dossiers.length >= 3 ? Math.min(2, dossiers.length - 1) : Math.min(1, dossiers.length - 1)
  const requiredSupportingCoverage = totalChapters >= 6 ? Math.ceil(totalChapters * 0.6) : Math.ceil(totalChapters * 0.5)

  if (protagonistMentionChapters < requiredProtagonistChapters) {
    issues.push(`protagonist chapter coverage ${protagonistMentionChapters}/${totalChapters} below required ${requiredProtagonistChapters}`)
  }
  if (protagonistAgencyChapters < requiredAgencyChapters) {
    issues.push(`protagonist agency/decision coverage ${protagonistAgencyChapters}/${totalChapters} below required ${requiredAgencyChapters}`)
  }
  if (protagonistPressureChapters < requiredPressureChapters) {
    issues.push(`protagonist pressure/change coverage ${protagonistPressureChapters}/${totalChapters} below required ${requiredPressureChapters}`)
  }
  if (activeSupporting < requiredSupportingCharacters) {
    issues.push(`active supporting cast ${activeSupporting}/${supportingAudits.length} below required ${requiredSupportingCharacters}`)
  }
  if (supportingCoverageChapters < requiredSupportingCoverage) {
    issues.push(`supporting cast chapter coverage ${supportingCoverageChapters}/${totalChapters} below required ${requiredSupportingCoverage}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      knownCast: dossiers.length,
      protagonist: protagonist?.name || "",
      protagonistMentionChapters,
      requiredProtagonistChapters,
      protagonistAgencyChapters,
      requiredAgencyChapters,
      protagonistPressureChapters,
      requiredPressureChapters,
      activeSupporting,
      requiredSupportingCharacters,
      supportingCoverageChapters,
      requiredSupportingCoverage,
    },
    characters: characterAudits,
  }
}

function extractRelationshipEntriesForAcceptance(snapshot) {
  const foundation = snapshot?.lore?.storyFoundation || {}
  const contract = foundation.contract || {}
  const graph = snapshot?.characters?.relationshipGraph || {}
  const sources = [
    getObjectPath(foundation.characterDynamics, "relationshipEntries"),
    getObjectPath(contract, "characters.relationshipEntries"),
    graph.edges,
    graph.relationships,
  ].filter(Array.isArray)
  return sources.flat()
}

function normalizeRelationshipEntryForAcceptance(entry, knownCast, index) {
  const from = String(entry?.from || entry?.source || entry?.sourceName || entry?.characterA || entry?.character1 || "").trim()
  const to = String(entry?.to || entry?.target || entry?.targetName || entry?.characterB || entry?.character2 || "").trim()
  let left = from
  let right = to
  if (!left || !right) {
    const text = collectAcceptanceStrings(entry).join("\n")
    const matched = knownCast.filter((name) => text.includes(name))
    left = left || matched[0] || ""
    right = right || matched.find((name) => name !== left) || ""
  }
  const rawTerms = extractExecutionTerms(entry)
  const pressureTerms = rawTerms.filter((term) => term !== left && term !== right)
  return {
    id: String(entry?.id || `${left || "relationship"}-${right || index + 1}`),
    from: left,
    to: right,
    pressureTerms,
    raw: entry,
  }
}

function relationshipPressureSignalCount(text) {
  return countMatches(
    text,
    /信任|债|欠|隐瞒|背叛|怀疑|逼|拦|交出|保住|裂|选择|代价|风险|同盟|敌|亲近|疏离|承诺|秘密|救|放弃|不肯|答应|拒绝|牵连|威胁|保护|利用|亏欠|试探|让步|撕破|翻脸/gu,
  )
}

function isGenericRelationshipTerm(term) {
  return /^(关系|状态|变化|改变|风险|代价|选择|决定|信任|秘密|压力|人物|角色|当前|本章|章节|发生|推动|必须|不能|交出|保住)$/u
    .test(String(term || "").trim())
}

function specificRelationshipTerms(terms, excludedTerms = []) {
  const excluded = new Set(excludedTerms.map((term) => String(term || "").trim()).filter(Boolean))
  return [...new Set((Array.isArray(terms) ? terms : [])
    .map((term) => String(term || "").trim())
    .filter((term) => term.length >= 2 && !excluded.has(term) && !isGenericRelationshipTerm(term)))]
}

function relationshipCoPresenceWindows(text, left, right, radius = 220) {
  const windows = evidenceWindowsAroundTerms(text, [left, right], radius)
    .filter((window) => window.text.includes(left) && window.text.includes(right))
  const seen = new Set()
  return windows.filter((window) => {
    if (seen.has(window.text)) return false
    seen.add(window.text)
    return true
  })
}

export function auditRelationshipArcForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const knownCast = extractKnownCastNames(snapshot)
  const dossiers = extractAcceptanceCharacterDossiers(snapshot)
  const dossiersByName = new Map(dossiers.map((dossier) => [dossier.name, dossier]))
  const rawEntries = extractRelationshipEntriesForAcceptance(snapshot)
    .map((entry, index) => normalizeRelationshipEntryForAcceptance(entry, knownCast, index))
    .filter((entry) => entry.from && entry.to && entry.from !== entry.to)
  const byPair = new Map()
  for (const entry of rawEntries) {
    const key = `${entry.from}->${entry.to}`
    const existing = byPair.get(key)
    if (existing) {
      existing.pressureTerms = [...new Set([...existing.pressureTerms, ...entry.pressureTerms])]
    } else {
      byPair.set(key, { ...entry, pressureTerms: [...entry.pressureTerms] })
    }
  }
  const entries = Array.from(byPair.values()).map((entry) => {
    const leftDossier = dossiersByName.get(entry.from)
    const rightDossier = dossiersByName.get(entry.to)
    return {
      ...entry,
      pressureTerms: specificRelationshipTerms([
        ...entry.pressureTerms,
        ...(leftDossier?.relationshipTerms || []),
        ...(rightDossier?.relationshipTerms || []),
      ], knownCast),
    }
  })
  const issues = []
  const relationshipAudits = []
  const chaptersWithRelationshipPressure = new Set()
  let activeRelationships = 0
  let evolvingRelationships = 0

  if (entries.length === 0) {
    issues.push("no relationship entries available for relationship arc audit")
  }

  for (const entry of entries) {
    const chapterEvidence = []
    let evidenceChapters = 0
    let pressureChapters = 0
    let stateChangeChapters = 0
    for (const chapter of chapters) {
      const body = String(chapter?.body || "")
      const hasBothCharacters = body.includes(entry.from) && body.includes(entry.to)
      const coPresenceWindows = hasBothCharacters ? relationshipCoPresenceWindows(body, entry.from, entry.to) : []
      const matchedPressureTerms = entry.pressureTerms
        .filter((term) => coPresenceWindows.some((window) => window.text.includes(term)))
        .slice(0, 8)
      const pressureSignals = coPresenceWindows.reduce((sum, window) => sum + relationshipPressureSignalCount(window.text), 0)
      const pressureVisible = coPresenceWindows.length > 0 && (pressureSignals > 0 || matchedPressureTerms.length > 0)
      const stateChangeVisible = coPresenceWindows.some((window) => {
        const windowSignals = relationshipPressureSignalCount(window.text)
        const windowMatchesPressureTerm = entry.pressureTerms.some((term) => window.text.includes(term))
        return windowSignals >= 1 && windowMatchesPressureTerm
      })
      if (hasBothCharacters) evidenceChapters += 1
      if (pressureVisible) {
        pressureChapters += 1
        chaptersWithRelationshipPressure.add(Number(chapter?.chapterNumber || 0))
      }
      if (stateChangeVisible) stateChangeChapters += 1
      chapterEvidence.push({
        chapterNumber: Number(chapter?.chapterNumber || 0),
        hasBothCharacters,
        pressureVisible,
        stateChangeVisible,
        pressureSignals,
        matchedPressureTerms,
        coPresenceWindows: coPresenceWindows.length,
      })
    }
    const requiredPairChapters = chapters.length >= 3 ? Math.ceil(chapters.length * 0.4) : Math.min(1, chapters.length)
    const requiredChangeChapters = chapters.length >= 3 ? 2 : Math.min(1, chapters.length)
    const active = pressureChapters >= requiredPairChapters
    const evolving = stateChangeChapters >= requiredChangeChapters
    if (active) activeRelationships += 1
    if (evolving) evolvingRelationships += 1

    const relationshipIssues = []
    if (evidenceChapters < requiredPairChapters) {
      relationshipIssues.push(`co-presence chapters ${evidenceChapters}/${requiredPairChapters}`)
    }
    if (!active) {
      relationshipIssues.push(`pressure chapters ${pressureChapters}/${requiredPairChapters}`)
    }
    if (!evolving) {
      relationshipIssues.push(`state-change chapters ${stateChangeChapters}/${requiredChangeChapters}`)
    }
    if (relationshipIssues.length) {
      issues.push(`${entry.from}->${entry.to}: ${relationshipIssues.join("; ")}`)
    }
    relationshipAudits.push({
      id: entry.id,
      from: entry.from,
      to: entry.to,
      pressureTerms: entry.pressureTerms.slice(0, 12),
      evidenceChapters,
      pressureChapters,
      stateChangeChapters,
      requiredPairChapters,
      requiredChangeChapters,
      active,
      evolving,
      chapters: chapterEvidence,
      issues: relationshipIssues,
    })
  }

  const requiredRelationships = entries.length >= 2 ? 2 : entries.length
  const requiredCoverage = chapters.length >= 3 ? Math.ceil(chapters.length * 0.6) : chapters.length
  if (activeRelationships < requiredRelationships) {
    issues.push(`active relationship arcs ${activeRelationships}/${entries.length} below required ${requiredRelationships}`)
  }
  if (evolvingRelationships < requiredRelationships) {
    issues.push(`evolving relationship arcs ${evolvingRelationships}/${entries.length} below required ${requiredRelationships}`)
  }
  if (chapters.length > 0 && chaptersWithRelationshipPressure.size < requiredCoverage) {
    issues.push(`chapter relationship pressure coverage ${chaptersWithRelationshipPressure.size}/${chapters.length} below required ${requiredCoverage}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters: chapters.length,
      relationshipEntries: entries.length,
      activeRelationships,
      evolvingRelationships,
      requiredRelationships,
      chaptersWithRelationshipPressure: chaptersWithRelationshipPressure.size,
      requiredCoverage,
    },
    relationships: relationshipAudits,
  }
}

function extractForeshadowingEntries(snapshot) {
  const foundation = snapshot?.lore?.storyFoundation || {}
  const contract = foundation.contract || {}
  const primary = getObjectPath(foundation.foreshadowingLedger, "entries")
  const fallback = getObjectPath(contract, "foreshadowing.entries")
  return Array.isArray(primary) ? primary : Array.isArray(fallback) ? fallback : []
}

function splitLedgerWords(value) {
  return String(value || "")
    .split(/[^\p{Script=Han}A-Za-z0-9]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !/^(chapter|source|status|planned|active|payoff|advance|final|late)$/iu.test(part))
}

function extractForeshadowingAnchorTerms(entry) {
  const anchors = []
  const add = (value) => {
    const text = String(value || "").trim()
    if (text.length >= 2) anchors.push(text)
  }
  for (const value of Array.isArray(entry?.linkedAnchors) ? entry.linkedAnchors : []) add(value)
  for (const value of Array.isArray(entry?.anchors) ? entry.anchors : []) add(value)
  for (const key of ["operation", "expectedAdvance", "expectedTouchpoint", "payoff", "sourceTitle", "title"]) {
    for (const word of splitLedgerWords(entry?.[key])) add(word)
  }
  return [...new Set(anchors)]
    .filter((term) => !/^(伏笔|线索|推进|回收|后续|章节|本章|下一章|上一章|关系|状态|主线|角色|选择|代价)$/u.test(term))
    .slice(0, 12)
}

function chapterBodyByNumber(chapters) {
  const byNumber = new Map()
  for (const chapter of chapters) {
    byNumber.set(Number(chapter?.chapterNumber || 0), String(chapter?.body || ""))
  }
  return byNumber
}

function containsAnyTerm(text, terms) {
  const source = String(text || "")
  return terms.some((term) => source.includes(String(term || "")))
}

const FORESHADOWING_ADVANCE_SIGNAL_PATTERN = /决定|选择|不肯|留下|藏|交出|拦住|推回|合上|按住|追问|拒绝|答应|转身|伸手|扣住|递出|收回|让|导致|因此|于是|代价|风险|裂|暴露|失去|改变|只剩|再也|换来|逼得|牵出|发现|意识到|真相|回收|兑现|揭开|揭示|关系|不能回头|不可逆|拿走|夺回|保住|追索/gu

function foreshadowingEvidenceWindows(text, terms, radius = 140) {
  const source = String(text || "")
  const windows = []
  for (const rawTerm of terms) {
    const term = String(rawTerm || "").trim()
    if (term.length < 2) continue
    let index = source.indexOf(term)
    while (index >= 0) {
      windows.push({
        term,
        text: source.slice(Math.max(0, index - radius), Math.min(source.length, index + term.length + radius)),
      })
      index = source.indexOf(term, index + term.length)
    }
  }
  return windows
}

function hasForeshadowingCausalAdvancement(text, terms) {
  return foreshadowingEvidenceWindows(text, terms)
    .some((window) => countMatches(window.text, FORESHADOWING_ADVANCE_SIGNAL_PATTERN) > 0)
}

function laterChapterText(chapters, sourceChapter) {
  return chapters
    .filter((chapter) => Number(chapter?.chapterNumber || 0) > sourceChapter)
    .map((chapter) => String(chapter?.body || ""))
    .join("\n\n")
}

export function auditForeshadowingPayoffForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const project = snapshot?.project || {}
  const totalChapters = Number(project.totalChapters || options.chapters || chapters.length || 0)
  const entries = extractForeshadowingEntries(snapshot)
  const expectedEntries = totalChapters > 0 ? Math.max(3, Math.ceil(totalChapters / 4)) : 3
  const requiredEntries = Math.min(entries.length, expectedEntries)
  const issues = []
  const byChapter = chapterBodyByNumber(chapters)
  const entryAudits = []
  let seededEntries = 0
  let advancedEntries = 0
  let payoffEntries = 0
  let concreteEntries = 0

  if (entries.length < expectedEntries) {
    issues.push(`foreshadowing ledger entries ${entries.length} below required ${expectedEntries}`)
  }

  for (const [index, entry] of entries.entries()) {
    const sourceChapter = Number(entry?.sourceChapter || entry?.chapterNumber || index + 1)
    const payoffMode = String(entry?.payoffMode || entry?.status || "").trim()
    const anchors = extractForeshadowingAnchorTerms(entry)
    const sourceBody = byChapter.get(sourceChapter) || ""
    const laterBody = laterChapterText(chapters, sourceChapter)
    const seeded = anchors.length > 0 && containsAnyTerm(sourceBody, anchors)
    const advanced = anchors.length > 0 && hasForeshadowingCausalAdvancement(laterBody, anchors)
    const advancementEvidence = foreshadowingEvidenceWindows(laterBody, anchors)
      .filter((window) => countMatches(window.text, FORESHADOWING_ADVANCE_SIGNAL_PATTERN) > 0)
      .map((window) => ({ term: window.term, excerpt: firstTextSlice(window.text.replace(/\s+/gu, " "), 120) }))
    const payoffLike = /payoff|回收|兑现|resolved|closed|final|late/iu.test([
      payoffMode,
      entry?.operation,
      entry?.payoff,
      entry?.expectedAdvance,
      entry?.expectedTouchpoint,
    ].map((part) => String(part || "")).join(" "))
    if (anchors.length > 0) concreteEntries += 1
    if (seeded) seededEntries += 1
    if (advanced) advancedEntries += 1
    if (payoffLike && advanced) payoffEntries += 1
    entryAudits.push({
      id: entry?.id || `entry-${index + 1}`,
      sourceChapter,
      payoffMode,
      anchors: anchors.slice(0, 8),
      seeded,
      advanced,
      advancementEvidence: advancementEvidence.slice(0, 3),
      payoffLike,
    })
  }

  const requiredSeeded = requiredEntries
  const requiredAdvanced = requiredEntries >= 3 ? Math.ceil(requiredEntries * 0.6) : requiredEntries
  if (requiredEntries > 0 && concreteEntries < requiredEntries) {
    issues.push(`foreshadowing concrete anchor coverage ${concreteEntries}/${entries.length} below required ${requiredEntries}`)
  }
  if (requiredEntries > 0 && seededEntries < requiredSeeded) {
    issues.push(`foreshadowing seed evidence ${seededEntries}/${entries.length} below required ${requiredSeeded}`)
  }
  if (requiredEntries > 0 && totalChapters >= 3 && advancedEntries < requiredAdvanced) {
    issues.push(`foreshadowing advance/payoff evidence ${advancedEntries}/${entries.length} below required ${requiredAdvanced}`)
  }
  if (totalChapters >= 3 && !entryAudits.some((entry) => entry.payoffLike && entry.advanced)) {
    issues.push("no foreshadowing entry shows payoff or late-stage advance evidence in chapter text")
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      entries: entries.length,
      expectedEntries,
      concreteEntries,
      seededEntries,
      advancedEntries,
      payoffEntries,
      requiredAdvanced,
    },
    entries: entryAudits,
  }
}

const CONTINUITY_CONCRETE_TERMS = [
  "账本", "账册", "缺页", "信纸", "印章", "官印", "钥匙", "地图", "脚步", "旧账", "证据", "线索",
  "伤口", "债务", "尸体", "药瓶", "木盒", "书卷", "铜镜", "玉佩", "戒指", "铃铛", "符纸", "阵图",
  "门外", "窗纸", "灯火", "雨声", "风声", "雪夜", "长船", "马车", "城门", "宫门", "井口", "石碑",
]

const CONTINUITY_PRESSURE_TERMS = [
  "为何", "为什么", "没有答", "未答", "只剩", "忽然", "线索", "风险", "代价", "怀疑",
  "隐瞒", "暴露", "失去", "追问", "追查", "查清", "交出", "裂缝", "选择", "决定", "真相",
]

function firstTextSlice(value, length) {
  return String(value || "").slice(0, length)
}

function lastTextSlice(value, length) {
  const text = String(value || "")
  return text.slice(Math.max(0, text.length - length))
}

function extractContinuityAnchors(text, knownCast = []) {
  const source = String(text || "")
  const anchors = []
  const push = (term, type) => {
    const value = String(term || "").trim()
    if (type !== "cast" && value.length < 2) return
    if (!value || !source.includes(value)) return
    anchors.push({ value, type })
  }
  for (const name of knownCast) push(name, "cast")
  for (const term of CONTINUITY_CONCRETE_TERMS) push(term, "concrete")
  for (const term of CONTINUITY_PRESSURE_TERMS) push(term, "pressure")
  return [...new Map(anchors.map((anchor) => [`${anchor.type}:${anchor.value}`, anchor])).values()]
}

function sharedContinuityAnchors(leftAnchors, rightAnchors) {
  const rightValues = new Set(rightAnchors.map((anchor) => anchor.value))
  return leftAnchors.filter((anchor) => rightValues.has(anchor.value))
}

function hasContinuationCue(text) {
  return /仍|还|再|又|接着|随后|刚才|昨夜|昨日|翌日|次日|那页|那封|那枚|那道|那个人|门外|脚步|线索|证据|旧账|缺页|余波|没有答|未答/u.test(String(text || ""))
}

export function auditContinuityForAcceptance(snapshot, options = {}) {
  const chapters = (Array.isArray(snapshot?.chapters) ? snapshot.chapters : [])
    .map((chapter) => ({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      body: String(chapter?.body || ""),
    }))
    .filter((chapter) => chapter.chapterNumber > 0)
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
  const knownCast = extractKnownCastNames(snapshot)
  const issues = []
  const transitions = []

  for (let index = 0; index < chapters.length - 1; index += 1) {
    const previous = chapters[index]
    const next = chapters[index + 1]
    const previousTail = lastTextSlice(previous.body, 900)
    const nextHead = firstTextSlice(next.body, 900)
    const previousAnchors = extractContinuityAnchors(previousTail, knownCast)
    const nextAnchors = extractContinuityAnchors(nextHead, knownCast)
    const shared = sharedContinuityAnchors(previousAnchors, nextAnchors)
    const sharedConcrete = shared.filter((anchor) => anchor.type === "concrete")
    const sharedCast = shared.filter((anchor) => anchor.type === "cast")
    const sharedPressure = shared.filter((anchor) => anchor.type === "pressure")
    const bridged = sharedConcrete.length > 0
      || sharedPressure.length > 0
      || sharedCast.length >= 2
      || (sharedCast.length >= 1 && hasContinuationCue(nextHead))
    const transition = {
      fromChapter: previous.chapterNumber,
      toChapter: next.chapterNumber,
      bridged,
      sharedConcrete: sharedConcrete.map((anchor) => anchor.value).slice(0, 8),
      sharedCast: sharedCast.map((anchor) => anchor.value).slice(0, 8),
      sharedPressure: sharedPressure.map((anchor) => anchor.value).slice(0, 8),
      previousAnchorCount: previousAnchors.length,
      nextAnchorCount: nextAnchors.length,
      continuationCue: hasContinuationCue(nextHead),
    }
    transitions.push(transition)
    if (!bridged) {
      issues.push(`chapter ${previous.chapterNumber}->${next.chapterNumber}: no visible handoff anchor from previous tail to next opening`)
    }
  }

  const pairCount = transitions.length
  const bridgedPairs = transitions.filter((transition) => transition.bridged).length
  const requiredBridgedPairs = pairCount >= 3 ? Math.ceil(pairCount * 0.8) : pairCount
  if (pairCount > 0 && bridgedPairs < requiredBridgedPairs) {
    issues.push(`chapter continuity coverage ${bridgedPairs}/${pairCount} below required ${requiredBridgedPairs}/${pairCount}`)
  }
  if (chapters.length !== (Number(snapshot?.project?.totalChapters || options.chapters || chapters.length) || chapters.length)) {
    issues.push(`continuity audit chapter count ${chapters.length} does not match project total`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters: chapters.length,
      transitionPairs: pairCount,
      bridgedPairs,
      requiredBridgedPairs,
      knownCast: knownCast.length,
    },
    transitions,
  }
}

export function auditStoryFoundationForAcceptance(snapshot, options = {}) {
  const project = snapshot?.project || {}
  const totalChapters = Number(project.totalChapters || options.chapters || 0)
  const foundation = snapshot?.lore?.storyFoundation || {}
  const issues = []
  const assetChecks = [
    ["contract", ["genre.readerPromise", "plot.causalModel", "plot.chapters", "characters.requiredDossierFields", "foreshadowing.ledgerRules", "volumes"]],
    ["worldMatrix", ["rules", "continuityAnchors"]],
    ["plotArchitecture", ["chapters", "timeline", "escalationRules"]],
    ["storyBible", ["readerPromise", "nonNegotiableContracts", "characterStateDeltas"]],
    ["volumeStrategy", ["volumes", "contractRules"]],
    ["foreshadowingLedger", ["rules", "entries"]],
    ["characterDynamics", ["relationshipEntries", "chapterStateDeltas", "relationshipRules"]],
    ["writingPlan", ["chapters", "totalChapters", "writingMode"]],
  ]
  const assets = assetChecks.map(([key, requiredPaths]) => {
    const value = foundation[key]
    const size = acceptanceJsonSize(value)
    if (!value || typeof value !== "object" || size < 40) {
      issues.push(`story foundation asset missing or too thin: ${key}`)
    }
    for (const requiredPath of requiredPaths) {
      if (!isFilledAcceptanceValue(getObjectPath(value, requiredPath))) {
        issues.push(`story foundation asset ${key} missing ${requiredPath}`)
      }
    }
    return { key, size }
  })

  const contract = foundation.contract || {}
  const plotChapters = getObjectPath(contract, "plot.chapters")
  const stateDeltas = getObjectPath(contract, "characters.stateDeltas")
    || getObjectPath(foundation.characterDynamics, "chapterStateDeltas")
  const relationshipEntries = getObjectPath(contract, "characters.relationshipEntries")
    || getObjectPath(foundation.characterDynamics, "relationshipEntries")
  const foreshadowingEntries = getObjectPath(foundation.foreshadowingLedger, "entries")
    || getObjectPath(contract, "foreshadowing.entries")
  const volumeContracts = getObjectPath(contract, "volumes") || getObjectPath(foundation.volumeStrategy, "volumes")
  const expectedForeshadowing = totalChapters > 0 ? Math.max(3, Math.ceil(totalChapters / 4)) : 3

  if (totalChapters > 0 && countArrayValue(plotChapters) < totalChapters) {
    issues.push(`plot chapter contract count ${countArrayValue(plotChapters)} is below total chapters ${totalChapters}`)
  }
  if (totalChapters > 0 && countArrayValue(stateDeltas) < totalChapters) {
    issues.push(`character state delta count ${countArrayValue(stateDeltas)} is below total chapters ${totalChapters}`)
  }
  if (countArrayValue(relationshipEntries) < 1) {
    issues.push("character relationship entries are missing")
  }
  if (countArrayValue(foreshadowingEntries) < expectedForeshadowing) {
    issues.push(`foreshadowing entries ${countArrayValue(foreshadowingEntries)} below required ${expectedForeshadowing}`)
  }
  if (countArrayValue(volumeContracts) < 1) {
    issues.push("volume strategy is missing")
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    assets,
    counts: {
      totalChapters,
      plotChapters: countArrayValue(plotChapters),
      characterStateDeltas: countArrayValue(stateDeltas),
      relationshipEntries: countArrayValue(relationshipEntries),
      foreshadowingEntries: countArrayValue(foreshadowingEntries),
      volumes: countArrayValue(volumeContracts),
    },
  }
}

function isPassedGate(value) {
  if (!value || typeof value !== "object") return false
  const status = String(value.status || "").toLowerCase()
  return value.passed === true || status === "passed" || status === "pass" || status === "approved"
}

const MIN_ACCEPTANCE_QUALITY_SCORE = 8
const MIN_ACCEPTANCE_STYLE_CONFORMANCE_SCORE = 7.2

function normalizeAcceptanceScore(value) {
  if (value === null || value === undefined || value === "") return null
  const score = Number(value)
  if (!Number.isFinite(score)) return null
  return score > 10 ? Math.min(10, score / 10) : score
}

function firstNormalizedAcceptanceScore(...values) {
  for (const value of values) {
    const score = normalizeAcceptanceScore(value)
    if (score !== null) return score
  }
  return null
}

function productionCheckPassed(publishReadiness, checkId) {
  const checks = Array.isArray(publishReadiness?.checks) ? publishReadiness.checks : []
  const check = checks.find((entry) => entry?.id === checkId)
  return check ? check.passed === true : false
}

function chapterProductionValidationEvidence(chapter) {
  const versionManifest = chapter?.versionManifest && typeof chapter.versionManifest === "object"
    ? chapter.versionManifest
    : {}
  const publishReadiness = chapter?.publishReadiness && typeof chapter.publishReadiness === "object"
    ? chapter.publishReadiness
    : {}
  const styleInheritanceVerification = chapter?.styleInheritanceVerification
    || publishReadiness.styleInheritanceVerification
    || versionManifest.styleInheritanceVerification
    || null
  const aigcDetection = chapter?.aigcDetection
    || versionManifest.aigcDetection
    || styleInheritanceVerification?.aigc
    || null
  const qualityGate = chapter?.qualityGate
    || versionManifest.qualityGate
    || (styleInheritanceVerification?.qualityGateStatus ? { status: styleInheritanceVerification.qualityGateStatus } : null)
  const styleConformanceDrift = chapter?.styleConformanceDrift
    || versionManifest.styleConformanceDrift
    || styleInheritanceVerification?.styleConformanceDrift
    || styleInheritanceVerification?.styleDrift
    || null
  const publishReady = publishReadiness.ready === true
  const qualityScore = firstNormalizedAcceptanceScore(
    qualityGate?.score,
    qualityGate?.overallScore,
    qualityGate?.summaryScore,
    versionManifest.qualityGate?.score,
  )
  const qualityStatusPassed = isPassedGate(qualityGate) || productionCheckPassed(publishReadiness, "quality_gate")
  const qualityScorePassed = qualityScore !== null && qualityScore >= MIN_ACCEPTANCE_QUALITY_SCORE
  const qualityPassed = qualityStatusPassed && qualityScorePassed
  const highRiskSegments = Array.isArray(aigcDetection?.highRiskSegments) ? aigcDetection.highRiskSegments : []
  const aigcPassed = String(aigcDetection?.status || "").toLowerCase() === "passed"
    && Number(aigcDetection?.highRiskCount || highRiskSegments.length || 0) === 0
  const styleReady = String(styleInheritanceVerification?.status || "").toLowerCase() === "ready"
    || productionCheckPassed(publishReadiness, "style_contract_alignment")
  const styleGenerationPassed = String(styleInheritanceVerification?.verificationStatus || "").toLowerCase() === "passed"
    || productionCheckPassed(publishReadiness, "style_generation_verification")
  const adapterReady = styleInheritanceVerification?.adapterReady === true
    || styleInheritanceVerification?.chapterInheritanceAdapter?.status === "ready"
  const freezerReady = String(styleInheritanceVerification?.freezerVerdict || "").toLowerCase() === "ready"
  const publishBaseReady = styleInheritanceVerification?.publishBaseReady !== false
    && (!Array.isArray(styleInheritanceVerification?.publishBaseMissing) || styleInheritanceVerification.publishBaseMissing.length === 0)
  const styleDriftStatus = String(styleConformanceDrift?.status || styleInheritanceVerification?.styleDrift?.status || "").toLowerCase()
  const styleConformanceScore = firstNormalizedAcceptanceScore(
    styleConformanceDrift?.conformanceScore,
    styleConformanceDrift?.score,
    styleInheritanceVerification?.styleDrift?.rawConformanceScore,
    styleInheritanceVerification?.styleDrift?.conformanceScore,
  )
  const styleScorePassed = styleConformanceScore !== null
    && styleConformanceScore >= MIN_ACCEPTANCE_STYLE_CONFORMANCE_SCORE
  const styleConformant = styleDriftStatus === "conformant" && styleScorePassed
  const evidenceItems = Array.isArray(styleInheritanceVerification?.evidence)
    ? styleInheritanceVerification.evidence
    : []
  const risks = [
    ...(Array.isArray(styleInheritanceVerification?.risks) ? styleInheritanceVerification.risks : []),
    ...(Array.isArray(styleConformanceDrift?.risks) ? styleConformanceDrift.risks : []),
  ].filter(Boolean)
  const checks = {
    publishReady,
    qualityPassed,
    aigcPassed,
    styleReady,
    styleGenerationPassed,
    adapterReady,
    freezerReady,
    publishBaseReady,
    styleConformant,
    hasEvidence: evidenceItems.length > 0,
    noRisks: risks.length === 0,
  }
  return {
    publishReadiness,
    qualityGate,
    aigcDetection,
    styleInheritanceVerification,
    styleConformanceDrift,
    qualityScore,
    styleConformanceScore,
    checks,
    passed: Object.values(checks).every(Boolean),
    risks,
  }
}

export function auditProductionValidationForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const issues = []
  const chapterAudits = []
  let validatedChapters = 0
  let aigcPassedChapters = 0
  let styleReadyChapters = 0
  let qualityPassedChapters = 0

  for (const chapter of chapters) {
    const evidence = chapterProductionValidationEvidence(chapter)
    const chapterNumber = Number(chapter?.chapterNumber || 0)
    const chapterIssues = []
    if (!evidence.checks.publishReady) chapterIssues.push("publish readiness is not ready")
    if (!evidence.checks.qualityPassed) {
      chapterIssues.push(`quality gate score ${evidence.qualityScore ?? "missing"} below required ${MIN_ACCEPTANCE_QUALITY_SCORE}`)
    }
    if (!evidence.checks.aigcPassed) chapterIssues.push("AIGC gate is not passed")
    if (!evidence.checks.styleReady) chapterIssues.push("style inheritance is not ready")
    if (!evidence.checks.styleGenerationPassed) chapterIssues.push("style generation verification is not passed")
    if (!evidence.checks.adapterReady) chapterIssues.push("chapter inheritance adapter is not ready")
    if (!evidence.checks.freezerReady) chapterIssues.push("style freezer is not ready")
    if (!evidence.checks.publishBaseReady) chapterIssues.push("publish base evidence is incomplete")
    if (!evidence.checks.styleConformant) {
      chapterIssues.push(`style conformance score ${evidence.styleConformanceScore ?? "missing"} below required ${MIN_ACCEPTANCE_STYLE_CONFORMANCE_SCORE}`)
    }
    if (!evidence.checks.hasEvidence) chapterIssues.push("production validation evidence is missing")
    if (!evidence.checks.noRisks) chapterIssues.push("production validation risks are still present")

    if (evidence.passed) validatedChapters += 1
    if (evidence.checks.aigcPassed) aigcPassedChapters += 1
    if (evidence.checks.styleReady) styleReadyChapters += 1
    if (evidence.checks.qualityPassed) qualityPassedChapters += 1
    if (chapterIssues.length) {
      issues.push(`chapter ${chapterNumber || "?"}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber,
      title: chapter?.title || "",
      passed: evidence.passed,
      checks: evidence.checks,
      qualityGateStatus: String(evidence.qualityGate?.status || ""),
      qualityScore: evidence.qualityScore,
      aigcStatus: String(evidence.aigcDetection?.status || ""),
      styleStatus: String(evidence.styleInheritanceVerification?.status || ""),
      styleDriftStatus: String(evidence.styleConformanceDrift?.status || evidence.styleInheritanceVerification?.styleDrift?.status || ""),
      styleConformanceScore: evidence.styleConformanceScore,
      riskCount: evidence.risks.length,
      issues: chapterIssues,
    })
  }

  const totalChapters = Number(snapshot?.project?.totalChapters || options.chapters || chapters.length || 0)
  if (chapters.length === 0) issues.push("no readable chapters available for production validation audit")
  if (totalChapters > 0 && chapters.length < totalChapters) {
    issues.push(`production validation readable chapters ${chapters.length} below total chapters ${totalChapters}`)
  }
  if (validatedChapters < chapters.length) {
    issues.push(`production validation chapter coverage ${validatedChapters}/${chapters.length} below required ${chapters.length}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      readableChapters: chapters.length,
      validatedChapters,
      aigcPassedChapters,
      styleReadyChapters,
      qualityPassedChapters,
    },
    chapters: chapterAudits,
  }
}

export function auditReaderWordCountsForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const stats = snapshot?.stats || {}
  const project = snapshot?.project || {}
  const targetWords = Number(options.chapterWords || project.chapterWordTarget || 0)
  const minChapterWords = targetWords > 0 ? Math.floor(targetWords * 0.8) : 0
  const minTotalWords = Number(options.minTotalWords || 0)
  const maxTotalWords = Number(options.maxTotalWords || Number.POSITIVE_INFINITY)
  const metadataTotalWords = Number(stats.totalWords || 0)
  const issues = []
  const chapterAudits = []
  let actualTotalWords = 0
  let chapterWordsPassed = 0
  let metadataConsistentChapters = 0

  for (const chapter of chapters) {
    const body = String(chapter?.body || "")
    const actualWordCount = Number.isFinite(Number(chapter?.actualWordCount))
      ? Number(chapter.actualWordCount)
      : countAcceptanceBodyWords(body)
    const metadataWordCount = Number(chapter?.wordCount || 0)
    const metadataDelta = metadataWordCount > 0
      ? Math.abs(metadataWordCount - actualWordCount)
      : Number.POSITIVE_INFINITY
    const metadataDeltaRatio = metadataWordCount > 0
      ? metadataDelta / Math.max(actualWordCount, 1)
      : Number.POSITIVE_INFINITY
    const chapterIssues = []
    actualTotalWords += actualWordCount
    if (minChapterWords > 0 && actualWordCount < minChapterWords) {
      chapterIssues.push(`actual body words ${actualWordCount} below 80% target ${minChapterWords}`)
    } else {
      chapterWordsPassed += 1
    }
    if (!metadataWordCount) {
      chapterIssues.push("metadata wordCount missing")
    } else if (metadataDeltaRatio > 0.25 && metadataDelta > 120) {
      chapterIssues.push(`metadata wordCount ${metadataWordCount} differs from actual ${actualWordCount}`)
    } else {
      metadataConsistentChapters += 1
    }
    if (chapterIssues.length) {
      issues.push(`chapter ${chapter?.chapterNumber || "?"}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      metadataWordCount,
      actualWordCount,
      metadataDelta,
      metadataDeltaRatio: Number.isFinite(metadataDeltaRatio) ? Number(metadataDeltaRatio.toFixed(3)) : null,
      passed: chapterIssues.length === 0,
      issues: chapterIssues,
    })
  }

  if (chapters.length === 0) issues.push("no readable chapters available for actual word count audit")
  if (minTotalWords > 0 && actualTotalWords < minTotalWords) {
    issues.push(`actual total body words ${actualTotalWords} below required ${minTotalWords}`)
  }
  if (Number.isFinite(maxTotalWords) && actualTotalWords > maxTotalWords) {
    issues.push(`actual total body words ${actualTotalWords} above allowed ${maxTotalWords}`)
  }
  if (metadataTotalWords > 0) {
    const totalDelta = Math.abs(metadataTotalWords - actualTotalWords)
    const totalDeltaRatio = totalDelta / Math.max(actualTotalWords, 1)
    if (totalDeltaRatio > 0.25 && totalDelta > 500) {
      issues.push(`reader stats totalWords ${metadataTotalWords} differs from actual total ${actualTotalWords}`)
    }
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      chapters: chapters.length,
      targetWords,
      minChapterWords,
      metadataTotalWords,
      actualTotalWords,
      minTotalWords,
      maxTotalWords: Number.isFinite(maxTotalWords) ? maxTotalWords : null,
      chapterWordsPassed,
      metadataConsistentChapters,
    },
    chapters: chapterAudits,
  }
}

const READER_NON_NOVEL_PATTERNS = [
  ["quality gate heading", /(?:^|\n)#{1,6}\s*(?:Quality Gate|Chapter Quality Report|章节质量报告|质量报告|质量门禁)\b.*$/imu],
  ["naturalness report heading", /(?:^|\n)#{1,6}\s*(?:Naturalness Report|Naturalness Pass|自然度报告|自然度处理)\b.*$/imu],
  ["drafting metadata heading", /(?:^|\n)#{1,6}\s*(?:Drafting Metadata|Chapter Execution Contract|Drafting Contract|章节元数据|章节元信息|章节执行合同)\b.*$/imu],
  ["style gate heading", /(?:^|\n)#{1,6}\s*(?:Style Contract Freeze Gate|Generation Verification Gate|Style Conformance|写法生成验证|风格漂移|写法继承验证)\b.*$/imu],
  ["aigc report heading", /(?:^|\n)#{1,6}\s*(?:AIGC Detection|AIGC Report|AIGC 检测|AIGC 报告)\b.*$/imu],
  ["quality score table", /\|\s*(?:Dimension|维度)\s*\|\s*(?:Score|评分)\s*\|\s*(?:Notes|说明|备注)\s*\|/iu],
  ["word count check", /\bWORD_COUNT_CHECK\s*:/iu],
  ["required fixes block", /(?:^|\n)#{1,6}\s*(?:Required Fixes|Checks|Scores|风险项|修复要求)\b.*$/imu],
  ["chinese production label", /(?:^|\n)\s*【(?:章节标题|质检报告|AIGC 检测报告|待修复的高风险片段数|质量门禁报告|自然化报告)】/u],
  ["llm request log", /\[(?:LLM REQUEST|LLM RESPONSE|LLM STREAM|CTX BUDGET|WRITING CTX|QUALITY REWORK|AIGC PATCH)[^\]]*\]/iu],
  ["llm transcript fence", /(?:^|\n)={5,}\s*\[(?:LLM|QUALITY|AIGC|CTX|WRITING)[^\]]*\]\s*={5,}/imu],
  ["prompt transcript", /(?:^|\n)(?:Global Consensus|Response contract|System Prompt|User Message|Developer Message|当前工作流阶段)\s*[:：]/imu],
  ["json production fields", /"(?:qualityGate|aigcDetection|publishReadiness|styleInheritanceVerification|styleConformanceDrift)"\s*:/u],
]

function findReaderBodyLeaks(body) {
  const text = String(body || "")
  return READER_NON_NOVEL_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([label, pattern]) => ({ label, pattern: String(pattern) }))
}

export function auditReaderPurityForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const issues = []
  const chapterAudits = []
  let cleanChapters = 0

  for (const chapter of chapters) {
    const leaks = findReaderBodyLeaks(chapter?.body || "")
    if (leaks.length === 0) {
      cleanChapters += 1
    } else {
      issues.push(`chapter ${chapter?.chapterNumber || "?"}: non-novel reader metadata leaked (${leaks.map((leak) => leak.label).join(", ")})`)
    }
    chapterAudits.push({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      clean: leaks.length === 0,
      leaks,
    })
  }

  const totalChapters = Number(snapshot?.project?.totalChapters || options.chapters || chapters.length || 0)
  if (chapters.length === 0) issues.push("no readable chapters available for reader purity audit")
  if (totalChapters > 0 && chapters.length < totalChapters) {
    issues.push(`reader purity readable chapters ${chapters.length} below total chapters ${totalChapters}`)
  }
  if (cleanChapters < chapters.length) {
    issues.push(`reader purity clean chapter coverage ${cleanChapters}/${chapters.length} below required ${chapters.length}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      readableChapters: chapters.length,
      cleanChapters,
      leakedChapters: chapters.length - cleanChapters,
    },
    chapters: chapterAudits,
  }
}

function collectAcceptanceStrings(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return []
  if (typeof value === "string" || typeof value === "number") return [String(value)]
  if (Array.isArray(value)) return value.flatMap((item) => collectAcceptanceStrings(item, depth + 1))
  if (typeof value === "object") return Object.values(value).flatMap((item) => collectAcceptanceStrings(item, depth + 1))
  return []
}

function isGenericExecutionTerm(term) {
  return /^(本章|章节|故事|情节|剧情|主线|推进|塑造|设定|世界观|写作|文本|读者|目标|变化|发生|后续|计划|蓝图|任务|场景|人物|角色|chapter|title|objective)$/iu
    .test(String(term || "").trim())
}

function extractExecutionTerms(value) {
  const text = collectAcceptanceStrings(value).join("\n")
  const terms = new Set()
  const add = (term) => {
    const value = String(term || "").trim()
    if (value.length < 2 || value.length > 10 || isGenericExecutionTerm(value)) return
    terms.add(value)
  }
  for (const word of splitLedgerWords(text)) add(word)
  for (const sequence of text.match(/\p{Script=Han}{2,}/gu) || []) {
    if (sequence.length <= 6) add(sequence)
    for (const size of [2, 3, 4]) {
      for (let index = 0; index <= sequence.length - size; index += 1) {
        add(sequence.slice(index, index + size))
      }
    }
  }
  return Array.from(terms).slice(0, 32)
}

function isGenericPlotNoveltyTerm(term, knownCast = []) {
  const value = String(term || "").trim()
  if (!value || /^[0-9０-９零〇一二三四五六七八九十百千万第章节回卷册部年月日号]+$/u.test(value)) return true
  if (knownCast.includes(value)) return true
  return /^(本章|章节|故事|情节|剧情|主线|推进|塑造|设定|世界观|写作|文本|读者|目标|变化|发生|后续|计划|蓝图|任务|场景|人物|角色|关系|状态|压力|风险|代价|选择|决定|继续|保持|事件|问题|线索|真相|chapter|title|objective)$/iu
    .test(value)
}

function plotNoveltyTermsForEntry(entry, knownCast = []) {
  return [...new Set([
    ...(entry?.planTerms || []),
    ...(entry?.stateDeltaTerms || []),
  ])]
    .map((term) => String(term || "").trim())
    .filter((term) => term.length >= 2 && term.length <= 10)
    .filter((term) => !isGenericPlotNoveltyTerm(term, knownCast))
    .slice(0, 24)
}

function isGenericWorldbuildingTerm(term) {
  return /^(世界|世界观|规则|服务|核心|创意|清晰|题材|读者|承压|持续|钩住|漂移|设定|人物|情节|故事|正文|主角|配角|章节|文本|关系|变化|推进|必须|来源|方式)$/u
    .test(String(term || "").trim())
}

function isGenericWorldbuildingPhrase(term) {
  const text = String(term || "").trim()
  if (text.length < 2) return true
  const compact = text.replace(/[，。、“”‘’：:；;,.\s]/gu, "")
  return compact.length < 2
    || /^(世界规则服务核心创意|设定清晰人物承压情节持续钩住读者|不漂移题材)$/u.test(compact)
}

function addWorldbuildingAnchor(anchors, labels, value) {
  const label = String(value || "").trim()
  if (label.length < 2 || label.length > 18 || isGenericWorldbuildingPhrase(label)) return
  const variants = new Set()
  const addVariant = (term) => {
    const normalized = String(term || "").trim()
    if (normalized.length < 2 || normalized.length > 18 || isGenericWorldbuildingTerm(normalized)) return
    variants.add(normalized)
  }
  addVariant(label)
  for (const word of splitLedgerWords(label)) addVariant(word)
  for (const sequence of label.match(/\p{Script=Han}{2,}/gu) || []) {
    if (sequence.length <= 6) addVariant(sequence)
    if (sequence.length > 3) {
      for (const size of [2, 3, 4]) {
        for (let index = 0; index <= sequence.length - size; index += 1) {
          addVariant(sequence.slice(index, index + size))
        }
      }
    }
  }
  const key = label.replace(/\s+/gu, "")
  if (!key || labels.has(key) || variants.size === 0) return
  labels.add(key)
  anchors.push({ label, variants: Array.from(variants) })
}

function collectWorldbuildingAnchors(value, anchors, labels, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim()
    for (const part of text.split(/[，。、“”‘’：:；;,.!?！？\n]+/u)) {
      addWorldbuildingAnchor(anchors, labels, part)
    }
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectWorldbuildingAnchors(item, anchors, labels, depth + 1)
    return
  }
  if (typeof value === "object") {
    for (const key of ["name", "title", "label", "anchor", "term"]) {
      if (value[key]) addWorldbuildingAnchor(anchors, labels, value[key])
    }
    for (const item of Object.values(value)) collectWorldbuildingAnchors(item, anchors, labels, depth + 1)
  }
}

function extractWorldbuildingAnchors(snapshot) {
  const foundation = snapshot?.lore?.storyFoundation || {}
  const sources = [
    getObjectPath(foundation.worldMatrix, "continuityAnchors"),
    getObjectPath(foundation.worldMatrix, "rules"),
    getObjectPath(foundation.worldMatrix, "locations"),
    getObjectPath(foundation.worldMatrix, "factions"),
    getObjectPath(foundation.worldMatrix, "constraints"),
    getObjectPath(foundation.storyBible, "nonNegotiableContracts"),
  ]
  const anchors = []
  const labels = new Set()
  for (const source of sources) {
    collectWorldbuildingAnchors(source, anchors, labels)
  }
  return anchors.slice(0, 40)
}

function countWorldTextureSignals(body) {
  return countMatches(
    body,
    /官|税|册|账|吏|司|坊|城|门|印|契|债|族|宗|禁|律|规|令|库|档|户|籍|役|粮|盐|商|兵|庙|宫|县|州|衙|市|渡|码头|宗门|王朝|朝廷|帮派|公司|议会|学院|星港|殖民|芯片|网络|系统|规则/gu,
  )
}

function worldbuildingEvidenceWindows(body, anchors) {
  const paragraphs = splitBodyParagraphs(body)
  const sources = paragraphs.length > 0 ? paragraphs : [String(body || "")]
  const windows = []
  for (const source of sources) {
    for (const anchor of anchors) {
      for (const rawTerm of anchor.variants || []) {
        const term = String(rawTerm || "").trim()
        if (term.length < 2 || !source.includes(term)) continue
        windows.push({
          anchor: anchor.label,
          term,
          text: source,
        })
      }
    }
  }
  const seen = new Set()
  return windows.filter((window) => {
    const key = `${window.anchor}:${window.term}:${window.text}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function countWorldRulePressureSignals(text) {
  return countMatches(
    text,
    /因|因而|因此|于是|导致|迫使|逼|不许|禁止|必须|不能|只准|规矩|律令|禁令|契约|税|债|户籍|官印|官府|衙门|朝廷|规则|制度|代价|风险|惩罚|追索|清算|身份|资格|通行|配额|账目|盐价|潮汐|交换/gu,
  )
}

function worldRulePressureEvidence(window, knownCast = []) {
  const text = String(window?.text || "")
  const castSignals = knownCast.filter((name) => text.includes(name)).length
  const actionSignals = countCharacterActionSignals(text)
  const decisionSignals = countMatches(text, /决定|选择|不肯|留下|藏|交出|拦住|推回|合上|按住|追问|承认|拒绝|答应|转身|伸手|扣住|递出|收回/gu)
  const consequenceSignals = countMatches(text, /让|导致|因此|于是|代价|风险|裂|暴露|失去|改变|留下|只剩|再也|换来|逼得|牵出|发现|意识到|真相|关系|不可逆/gu)
  const rulePressureSignals = countWorldRulePressureSignals(text)
  const complete = rulePressureSignals > 0
    && (castSignals > 0 || actionSignals > 0)
    && (decisionSignals > 0 || consequenceSignals > 0)
  return {
    anchor: window.anchor,
    term: window.term,
    complete,
    castSignals,
    actionSignals,
    decisionSignals,
    consequenceSignals,
    rulePressureSignals,
    excerpt: firstTextSlice(text.replace(/\s+/gu, " "), 140),
  }
}

export function auditWorldbuildingIntegrationForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const anchors = extractWorldbuildingAnchors(snapshot)
  const knownCast = extractKnownCastNames(snapshot)
  const issues = []
  const chapterAudits = []
  let anchoredChapters = 0
  let texturedChapters = 0
  let ruleDrivenChapters = 0
  const matchedTerms = new Set()

  if (anchors.length === 0) {
    issues.push("no worldbuilding anchors available for worldbuilding integration audit")
  }

  for (const chapter of chapters) {
    const body = String(chapter?.body || "")
    const matches = anchors
      .filter((anchor) => anchor.variants.some((term) => body.includes(term)))
      .map((anchor) => anchor.label)
    for (const term of matches) matchedTerms.add(term)
    const textureSignals = countWorldTextureSignals(body)
    const requiredMatches = anchors.length >= 3 ? 2 : Math.min(1, anchors.length)
    const anchored = requiredMatches > 0 && matches.length >= requiredMatches
    const textured = textureSignals >= 4
    const ruleEvidence = worldbuildingEvidenceWindows(body, anchors)
      .map((window) => worldRulePressureEvidence(window, knownCast))
    const completeRuleEvidence = ruleEvidence.filter((evidence) => evidence.complete)
    const ruleDriven = completeRuleEvidence.length > 0
    if (anchored) anchoredChapters += 1
    if (textured) texturedChapters += 1
    if (ruleDriven) ruleDrivenChapters += 1
    const chapterIssues = []
    if (!anchored) chapterIssues.push(`world anchor matches ${matches.length}/${requiredMatches}`)
    if (!textured) chapterIssues.push(`weak world texture signals ${textureSignals}`)
    if (!ruleDriven) chapterIssues.push("missing local world-rule pressure tied to character choice/consequence")
    if (chapterIssues.length) {
      issues.push(`chapter ${chapter?.chapterNumber || "?"}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      matchedTerms: matches.slice(0, 10),
      textureSignals,
      anchored,
      textured,
      ruleDriven,
      ruleEvidence: completeRuleEvidence.slice(0, 3),
      issues: chapterIssues,
    })
  }

  const requiredAnchoredChapters = chapters.length >= 3 ? Math.ceil(chapters.length * 0.75) : chapters.length
  const requiredTexturedChapters = chapters.length >= 3 ? Math.ceil(chapters.length * 0.75) : chapters.length
  const requiredRuleDrivenChapters = chapters.length >= 3 ? Math.ceil(chapters.length * 0.75) : chapters.length
  const requiredDistinctTerms = anchors.length >= 4 ? Math.min(4, Math.ceil(anchors.length * 0.4)) : anchors.length
  if (chapters.length === 0) {
    issues.push("no readable chapters available for worldbuilding integration audit")
  }
  if (anchoredChapters < requiredAnchoredChapters) {
    issues.push(`worldbuilding anchor chapter coverage ${anchoredChapters}/${chapters.length} below required ${requiredAnchoredChapters}`)
  }
  if (texturedChapters < requiredTexturedChapters) {
    issues.push(`worldbuilding texture chapter coverage ${texturedChapters}/${chapters.length} below required ${requiredTexturedChapters}`)
  }
  if (ruleDrivenChapters < requiredRuleDrivenChapters) {
    issues.push(`worldbuilding rule-pressure chapter coverage ${ruleDrivenChapters}/${chapters.length} below required ${requiredRuleDrivenChapters}`)
  }
  if (anchors.length > 0 && matchedTerms.size < requiredDistinctTerms) {
    issues.push(`distinct worldbuilding anchors used ${matchedTerms.size}/${anchors.length} below required ${requiredDistinctTerms}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters: chapters.length,
      worldbuildingAnchors: anchors.length,
      distinctMatchedAnchors: matchedTerms.size,
      anchoredChapters,
      requiredAnchoredChapters,
      texturedChapters,
      requiredTexturedChapters,
      ruleDrivenChapters,
      requiredRuleDrivenChapters,
      requiredDistinctTerms,
    },
    anchors: anchors.map((anchor) => anchor.label).slice(0, 20),
    chapters: chapterAudits,
  }
}

function firstArrayValue(...values) {
  return values.find((value) => Array.isArray(value)) || []
}

function plannedChapterNumber(entry, index) {
  return Number(entry?.chapterNumber || entry?.chapter || entry?.number || entry?.index || index + 1)
}

function plannedChaptersForAcceptance(snapshot) {
  const foundation = snapshot?.lore?.storyFoundation || {}
  const contract = foundation.contract || {}
  const planChapters = firstArrayValue(
    getObjectPath(foundation.writingPlan, "chapters"),
    getObjectPath(foundation.plotArchitecture, "chapters"),
    getObjectPath(contract, "plot.chapters"),
  )
  const deltas = firstArrayValue(
    getObjectPath(foundation.characterDynamics, "chapterStateDeltas"),
    getObjectPath(foundation.storyBible, "characterStateDeltas"),
    getObjectPath(contract, "characters.stateDeltas"),
  )
  const deltasByChapter = new Map()
  for (const [index, delta] of deltas.entries()) {
    deltasByChapter.set(plannedChapterNumber(delta, index), delta)
  }
  return planChapters.map((plan, index) => {
    const chapterNumber = plannedChapterNumber(plan, index)
    const stateDelta = deltasByChapter.get(chapterNumber) || null
    return {
      chapterNumber,
      plan,
      stateDelta,
      planTerms: extractExecutionTerms(plan),
      stateDeltaTerms: extractExecutionTerms(stateDelta),
    }
  }).filter((entry) => Number.isFinite(entry.chapterNumber) && entry.chapterNumber > 0)
}

function structuralPhaseDefinitions(totalChapters) {
  return [
    {
      key: "opening",
      label: "opening setup",
      start: 1,
      end: Math.max(1, Math.ceil(totalChapters * 0.2)),
      planPattern: /开端|引子|起点|触发|导火索|建立|出场|入局|初始|破局|问题|契机|第一幕/u,
      bodyPattern: /第一次|开始|发现|入局|触发|决定|选择|看见|听见|查|追问|证据|线索/u,
    },
    {
      key: "turning",
      label: "midpoint turn",
      start: Math.max(1, Math.floor(totalChapters * 0.35)),
      end: Math.max(1, Math.ceil(totalChapters * 0.65)),
      planPattern: /转折|中段|中点|反转|真相|升级|失控|背叛|代价|暴露|改变|不可逆|第二幕/u,
      bodyPattern: /却|原来|忽然|暴露|背叛|真相|意识到|代价|改变|再也|失去|裂|不得不|不能回头|升级/u,
    },
    {
      key: "climax",
      label: "climax/payoff",
      start: Math.max(1, Math.floor(totalChapters * 0.7)),
      end: Math.max(1, Math.ceil(totalChapters * 0.9)),
      planPattern: /高潮|决战|摊牌|最终|回收|揭示|爆发|最大|主线|收束|逼近|终局|第三幕/u,
      bodyPattern: /摊牌|真相|终于|揭开|回收|爆发|最后|不能退|决定|代价|选择|交出|承认|拒绝|只剩/u,
    },
    {
      key: "resolution",
      label: "volume close",
      start: Math.max(1, Math.floor(totalChapters * 0.9)),
      end: totalChapters,
      planPattern: /结尾|收束|卷尾|尾声|新局|余波|改变|位置|关系网络|世界认知|下一卷|下一阶段/u,
      bodyPattern: /天亮|余波|只剩|从此|再也|明日|下一|新的|改变|离开|回头|门外|答案|代价|风险/u,
    },
  ].map((phase) => ({
    ...phase,
    start: Math.min(totalChapters, Math.max(1, phase.start)),
    end: Math.min(totalChapters, Math.max(phase.start, phase.end)),
  }))
}

function textForPlannedEntry(entry) {
  return collectAcceptanceStrings([entry?.plan, entry?.stateDelta]).join("\n")
}

export function auditStructuralProgressionForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const byChapter = chapterBodyByNumber(chapters)
  const plannedChapters = plannedChaptersForAcceptance(snapshot)
  const project = snapshot?.project || {}
  const totalChapters = Number(project.totalChapters || options.chapters || chapters.length || 0)
  const issues = []

  if (totalChapters < 6) {
    return {
      passed: true,
      issues: [],
      summary: {
        totalChapters,
        plannedChapters: plannedChapters.length,
        skipped: true,
        reason: "short-form sample below structural progression threshold",
      },
      phases: [],
    }
  }

  if (plannedChapters.length < totalChapters) {
    issues.push(`structural progression planned chapters ${plannedChapters.length} below total chapters ${totalChapters}`)
  }
  if (chapters.length < totalChapters) {
    issues.push(`structural progression readable chapters ${chapters.length} below total chapters ${totalChapters}`)
  }

  const phases = structuralPhaseDefinitions(totalChapters).map((phase) => {
    const plannedInWindow = plannedChapters.filter((entry) => entry.chapterNumber >= phase.start && entry.chapterNumber <= phase.end)
    const chaptersInWindow = chapters.filter((chapter) => Number(chapter?.chapterNumber || 0) >= phase.start && Number(chapter?.chapterNumber || 0) <= phase.end)
    const planHits = plannedInWindow
      .filter((entry) => phase.planPattern.test(textForPlannedEntry(entry)))
      .map((entry) => entry.chapterNumber)
    const bodyHits = chaptersInWindow
      .filter((chapter) => phase.bodyPattern.test(byChapter.get(Number(chapter?.chapterNumber || 0)) || ""))
      .map((chapter) => Number(chapter?.chapterNumber || 0))
    const passed = planHits.length > 0 && bodyHits.length > 0
    if (!planHits.length) {
      issues.push(`structural phase ${phase.key} missing planned ${phase.label} marker in chapters ${phase.start}-${phase.end}`)
    }
    if (!bodyHits.length) {
      issues.push(`structural phase ${phase.key} missing visible prose ${phase.label} marker in chapters ${phase.start}-${phase.end}`)
    }
    return {
      key: phase.key,
      label: phase.label,
      start: phase.start,
      end: phase.end,
      planHits,
      bodyHits,
      passed,
    }
  })

  const passedPhases = phases.filter((phase) => phase.passed).length
  if (passedPhases < phases.length) {
    issues.push(`long-form structural progression coverage ${passedPhases}/${phases.length} below required ${phases.length}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      plannedChapters: plannedChapters.length,
      readableChapters: chapters.length,
      passedPhases,
      requiredPhases: phases.length,
      skipped: false,
    },
    phases,
  }
}

export function auditPlotExecutionForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const byChapter = chapterBodyByNumber(chapters)
  const plannedChapters = plannedChaptersForAcceptance(snapshot)
  const project = snapshot?.project || {}
  const totalChapters = Number(project.totalChapters || options.chapters || chapters.length || 0)
  const issues = []
  const chapterAudits = []
  let anchoredChapters = 0
  let agencyChapters = 0
  let consequenceChapters = 0
  let stateDeltaChapters = 0
  let executedChapters = 0

  if (plannedChapters.length === 0) {
    issues.push("no planned chapters available for plot execution audit")
  }
  if (totalChapters > 0 && plannedChapters.length < totalChapters) {
    issues.push(`planned chapter entries ${plannedChapters.length} below total chapters ${totalChapters}`)
  }

  const decisionPattern = /决定|选择|不肯|必须|不能|留下|藏|交出|拦住|推回|合上|按住|追问|承认|拒绝|答应|转身|伸手|扣住|递出|收回/gu
  const consequencePattern = /让|导致|因此|于是|代价|风险|裂|暴露|失去|改变|留下|只剩|再也|换来|逼得|牵出|发现|意识到|真相|关系/gu

  for (const entry of plannedChapters) {
    const body = byChapter.get(entry.chapterNumber) || ""
    const terms = [...new Set([...entry.planTerms, ...entry.stateDeltaTerms])]
    const matchedTerms = terms.filter((term) => body.includes(term))
    const requiredTermMatches = terms.length >= 3 ? 2 : Math.min(1, terms.length)
    const objectiveAnchored = requiredTermMatches > 0 && matchedTerms.length >= requiredTermMatches
    const decisionSignals = countMatches(body, decisionPattern)
    const consequenceSignals = countMatches(body, consequencePattern)
    const stateDeltaMatched = entry.stateDeltaTerms.length === 0 || entry.stateDeltaTerms.some((term) => body.includes(term))
    const agencyVisible = decisionSignals > 0
    const consequenceVisible = consequenceSignals > 0
    const paragraphs = splitBodyParagraphs(body)
    const localWindows = []
    for (let index = 0; index < paragraphs.length; index += 1) {
      localWindows.push(paragraphs[index])
      if (index < paragraphs.length - 1) localWindows.push(`${paragraphs[index]}\n\n${paragraphs[index + 1]}`)
    }
    if (paragraphs.length === 0 && body.trim()) localWindows.push(body)
    const localExecutionEvidence = localWindows.map((window) => {
      const localMatchedTerms = terms.filter((term) => window.includes(term))
      const localStateDeltaMatched = entry.stateDeltaTerms.length === 0
        || entry.stateDeltaTerms.some((term) => window.includes(term))
      const localDecisionSignals = countMatches(window, decisionPattern)
      const localConsequenceSignals = countMatches(window, consequencePattern)
      const localObjectiveAnchored = requiredTermMatches > 0 && localMatchedTerms.length >= requiredTermMatches
      const localExecuted = localObjectiveAnchored
        && localDecisionSignals > 0
        && localConsequenceSignals > 0
        && localStateDeltaMatched
      return {
        matchedTerms: localMatchedTerms.slice(0, 8),
        decisionSignals: localDecisionSignals,
        consequenceSignals: localConsequenceSignals,
        stateDeltaMatched: localStateDeltaMatched,
        executed: localExecuted,
        excerpt: firstTextSlice(window.replace(/\s+/gu, " "), 140),
      }
    })
    const localExecuted = localExecutionEvidence.some((evidence) => evidence.executed)
    const executed = objectiveAnchored && agencyVisible && consequenceVisible && stateDeltaMatched && localExecuted

    if (objectiveAnchored) anchoredChapters += 1
    if (agencyVisible) agencyChapters += 1
    if (consequenceVisible) consequenceChapters += 1
    if (stateDeltaMatched) stateDeltaChapters += 1
    if (executed) executedChapters += 1

    const chapterIssues = []
    if (!body.trim()) chapterIssues.push("missing chapter body")
    if (!objectiveAnchored) chapterIssues.push(`planned objective anchors matched ${matchedTerms.length}/${requiredTermMatches}`)
    if (!agencyVisible) chapterIssues.push("missing visible character decision/agency")
    if (!consequenceVisible) chapterIssues.push("missing visible consequence/state change")
    if (!stateDeltaMatched) chapterIssues.push("missing planned character state delta anchor")
    if (objectiveAnchored && agencyVisible && consequenceVisible && stateDeltaMatched && !localExecuted) {
      chapterIssues.push("missing local plot execution evidence tying objective, decision, consequence, and state delta")
    }
    if (chapterIssues.length) {
      issues.push(`chapter ${entry.chapterNumber}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: entry.chapterNumber,
      requiredTermMatches,
      matchedTerms: matchedTerms.slice(0, 10),
      planTerms: entry.planTerms.slice(0, 12),
      stateDeltaTerms: entry.stateDeltaTerms.slice(0, 12),
      decisionSignals,
      consequenceSignals,
      objectiveAnchored,
      agencyVisible,
      consequenceVisible,
      stateDeltaMatched,
      localExecuted,
      localExecutionEvidence: localExecutionEvidence.filter((evidence) => evidence.executed).slice(0, 3),
      executed,
      issues: chapterIssues,
    })
  }

  const requiredExecutedChapters = plannedChapters.length >= 3
    ? Math.ceil(plannedChapters.length * 0.8)
    : plannedChapters.length
  if (plannedChapters.length > 0 && executedChapters < requiredExecutedChapters) {
    issues.push(`plot execution coverage ${executedChapters}/${plannedChapters.length} below required ${requiredExecutedChapters}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters: chapters.length,
      plannedChapters: plannedChapters.length,
      executedChapters,
      requiredExecutedChapters,
      anchoredChapters,
      agencyChapters,
      consequenceChapters,
      stateDeltaChapters,
    },
    chapters: chapterAudits,
  }
}

export function auditPlotNoveltyForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const byChapter = chapterBodyByNumber(chapters)
  const plannedChapters = plannedChaptersForAcceptance(snapshot)
    .slice()
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
  const knownCast = extractKnownCastNames(snapshot)
  const project = snapshot?.project || {}
  const totalChapters = Number(project.totalChapters || options.chapters || chapters.length || 0)
  const issues = []
  const chapterAudits = []

  if (totalChapters < 6 || plannedChapters.length < 6) {
    return {
      passed: true,
      issues: [],
      summary: {
        totalChapters,
        plannedChapters: plannedChapters.length,
        skipped: true,
        reason: "short-form sample below plot novelty threshold",
      },
      chapters: [],
    }
  }

  const cumulativePlanTerms = new Set()
  const bodyNovelTerms = new Set()
  let plannedNovelChapters = 0
  let bodyNovelChapters = 0
  let stagnantRun = 0
  let maxStagnantRun = 0

  for (const entry of plannedChapters) {
    const body = byChapter.get(entry.chapterNumber) || ""
    const terms = plotNoveltyTermsForEntry(entry, knownCast)
    const newPlanTerms = terms.filter((term) => !cumulativePlanTerms.has(term))
    const matchedCurrentTerms = terms.filter((term) => body.includes(term))
    const matchedNewTerms = newPlanTerms.filter((term) => body.includes(term))
    const hasNewPlanTerms = newPlanTerms.length > 0
    const hasNewBodyTerms = matchedNewTerms.length > 0

    if (hasNewPlanTerms) plannedNovelChapters += 1
    if (hasNewBodyTerms) {
      bodyNovelChapters += 1
      stagnantRun = 0
      for (const term of matchedNewTerms) bodyNovelTerms.add(term)
    } else {
      stagnantRun += 1
      maxStagnantRun = Math.max(maxStagnantRun, stagnantRun)
    }

    const chapterIssues = []
    if (!hasNewPlanTerms) chapterIssues.push("no new planned plot terms beyond prior chapters")
    if (hasNewPlanTerms && !hasNewBodyTerms) {
      chapterIssues.push(`new planned plot terms not visible in prose: ${newPlanTerms.slice(0, 5).join("、")}`)
    }
    if (chapterIssues.length) {
      issues.push(`chapter ${entry.chapterNumber}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: entry.chapterNumber,
      plotTerms: terms.slice(0, 12),
      newPlanTerms: newPlanTerms.slice(0, 12),
      matchedCurrentTerms: matchedCurrentTerms.slice(0, 12),
      matchedNewTerms: matchedNewTerms.slice(0, 12),
      hasNewPlanTerms,
      hasNewBodyTerms,
      issues: chapterIssues,
    })
    for (const term of terms) cumulativePlanTerms.add(term)
  }

  const requiredNovelPlanChapters = Math.ceil(plannedChapters.length * 0.75)
  const requiredNovelBodyChapters = Math.ceil(plannedChapters.length * 0.7)
  const requiredDistinctBodyTerms = Math.min(20, Math.max(6, Math.ceil(plannedChapters.length * 1.25)))
  const allowedStagnantRun = plannedChapters.length >= 10 ? 2 : 1

  if (plannedNovelChapters < requiredNovelPlanChapters) {
    issues.push(`planned plot novelty coverage ${plannedNovelChapters}/${plannedChapters.length} below required ${requiredNovelPlanChapters}`)
  }
  if (bodyNovelChapters < requiredNovelBodyChapters) {
    issues.push(`prose plot novelty coverage ${bodyNovelChapters}/${plannedChapters.length} below required ${requiredNovelBodyChapters}`)
  }
  if (bodyNovelTerms.size < requiredDistinctBodyTerms) {
    issues.push(`distinct prose plot novelty terms ${bodyNovelTerms.size} below required ${requiredDistinctBodyTerms}`)
  }
  if (maxStagnantRun > allowedStagnantRun) {
    issues.push(`consecutive stagnant plot chapters ${maxStagnantRun} above allowed ${allowedStagnantRun}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      plannedChapters: plannedChapters.length,
      plannedNovelChapters,
      requiredNovelPlanChapters,
      bodyNovelChapters,
      requiredNovelBodyChapters,
      distinctBodyNoveltyTerms: bodyNovelTerms.size,
      requiredDistinctBodyTerms,
      maxStagnantRun,
      allowedStagnantRun,
      skipped: false,
    },
    chapters: chapterAudits,
  }
}

function auditChapterTailHook(tail, knownCast = []) {
  const text = String(tail || "")
  const hookCue = /[？?]|谁|却|忽然|门外|脚步|信|账|印|刀|血|名字|明日|只剩|没有答|裂缝|代价|风险|线索|仍/u.test(text)
  const genericHookSignals = countMatches(
    text,
    /下一章|后续|未来.*危险|更加危险|更加复杂|一切都不简单|故事.*继续|伏笔.*推进|悬念|钩子|谜团.*加深|没有答案/gu,
  )
  const concreteSignals = countMatches(
    text,
    /账本|账册|缺页|信纸|印章|官印|钥匙|地图|脚步|旧账|证据|线索|门槛|窗纸|灯火|袖口|鞋尖|纸边|墨味|铜牌|玻璃|伞柄|木匣|水缸|供桌|血|刀|门外/gu,
  )
  const causalSignals = countMatches(
    text,
    /决定|选择|不肯|留下|藏|交出|拦住|推回|合上|按住|追问|拒绝|答应|转身|伸手|扣住|递出|收回|让|导致|因此|于是|代价|风险|裂|暴露|失去|改变|只剩|再也|换来|逼得|牵出|发现|意识到|真相|关系|不能回头|不可逆|拿走|夺回|保住|追索/gu,
  )
  const castSignals = knownCast.filter((name) => text.includes(name)).length
  const anchored = concreteSignals > 0 || castSignals > 0
  const ready = hookCue && anchored && causalSignals > 0 && genericHookSignals <= 1
  return {
    ready,
    hookCue,
    genericHookSignals,
    concreteSignals,
    causalSignals,
    castSignals,
    anchored,
  }
}

export function auditNarrativeQualityForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const project = snapshot?.project || {}
  const targetWords = Number(options.chapterWords || project.chapterWordTarget || 0)
  const knownCast = extractKnownCastNames(snapshot)
  const issues = []
  const chapterAudits = []
  const repeatedDialogues = new Map()
  let totalDialogue = 0
  let totalActionSignals = 0
  let totalSensorySignals = 0
  let totalObjectSignals = 0
  let hookReadyChapters = 0
  const mentionedCast = new Set()

  for (const chapter of chapters) {
    const body = String(chapter?.body || "")
    const wordCount = Number(chapter?.actualWordCount || chapter?.wordCount || 0)
    const metadataWordCount = Number(chapter?.wordCount || 0)
    const paragraphs = splitBodyParagraphs(body)
    const paragraphCounts = new Map()
    for (const paragraph of paragraphs) {
      const normalized = normalizeAuditText(paragraph)
      if (normalized.length < 28) continue
      paragraphCounts.set(normalized, (paragraphCounts.get(normalized) || 0) + 1)
    }
    const repeatedParagraphs = Array.from(paragraphCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([sample, count]) => ({ sample: sample.slice(0, 80), count }))
    const dialogues = body.match(/[「“][^」”]{2,160}[」”]/gu) || []
    for (const dialogue of dialogues) {
      const normalized = normalizeAuditText(dialogue)
      if (normalized.length >= 8) {
        repeatedDialogues.set(normalized, (repeatedDialogues.get(normalized) || 0) + 1)
      }
    }
    const actionSignals = countMatches(body, /走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|握|松|皱眉|沉默|合上|推开|退|挡/gu)
    const sensorySignals = countMatches(body, /雨|风|声|灯|冷|热|湿|血|灰|墨|纸|门|窗|脚步|气味|疼|汗|光|影/gu)
    const objectSignals = countMatches(body, /账|册|信|印|刀|门|灯|纸|袖|钥|血|雨|窗|碑|牌|盒|卷|碗|杯|伞|鞋|衣|墨|火/gu)
    const pressureSignals = countMatches(body, /必须|不能|决定|选择|代价|风险|欠|债|怕|查清|追问|交出|保住|隐瞒|裂缝|怀疑|逼|拦|失去|暴露/gu)
    const tail = body.slice(-700)
    const tailHook = auditChapterTailHook(tail, knownCast)
    const hasHook = tailHook.ready
    const castMentions = knownCast.filter((name) => body.includes(name))
    for (const name of castMentions) mentionedCast.add(name)

    totalDialogue += dialogues.length
    totalActionSignals += actionSignals
    totalSensorySignals += sensorySignals
    totalObjectSignals += objectSignals
    if (hasHook) hookReadyChapters += 1

    const chapterIssues = []
    if (!body.trim()) chapterIssues.push("empty body")
    if (targetWords > 0 && wordCount < Math.floor(targetWords * 0.8)) {
      chapterIssues.push(`word count ${wordCount} below 80% of target ${targetWords}`)
    }
    if (repeatedParagraphs.length > 0) chapterIssues.push("repeated paragraph loop")
    if (actionSignals < 8) chapterIssues.push(`weak action signal count ${actionSignals}`)
    if (sensorySignals < 4) chapterIssues.push(`weak sensory/object scene grounding ${sensorySignals}`)
    if (objectSignals < 4) chapterIssues.push(`weak concrete object grounding ${objectSignals}`)
    if (pressureSignals < 3) chapterIssues.push(`weak relationship/choice pressure ${pressureSignals}`)
    if (!hasHook) chapterIssues.push("missing causal concrete chapter tail hook")
    if (castMentions.length === 0 && knownCast.length > 0) chapterIssues.push("no known cast mention")
    if (chapterIssues.length) {
      issues.push(`chapter ${chapter?.chapterNumber || "?"}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      wordCount,
      metadataWordCount,
      dialogueCount: dialogues.length,
      actionSignals,
      sensorySignals,
      objectSignals,
      pressureSignals,
      hookReady: hasHook,
      tailHook,
      castMentions,
      repeatedParagraphs: repeatedParagraphs.slice(0, 3),
      issues: chapterIssues,
    })
  }

  const repeatedDialogueSamples = Array.from(repeatedDialogues.entries())
    .filter(([, count]) => count >= 3)
    .map(([sample, count]) => ({ sample: sample.slice(0, 80), count }))
  const totalChapters = Number(project.totalChapters || options.chapters || chapters.length || 0)
  const requiredDialogue = Math.max(3, Math.ceil((totalChapters || chapters.length) * 1.5))
  if (chapters.length === 0) issues.push("no readable chapters available for narrative audit")
  if (totalDialogue < requiredDialogue) issues.push(`dialogue count ${totalDialogue} below required ${requiredDialogue}`)
  if (knownCast.length >= 2 && mentionedCast.size < 2) {
    issues.push(`known cast coverage ${mentionedCast.size}/${knownCast.length} is too low`)
  }
  if (repeatedDialogueSamples.length > 0) {
    issues.push(`repeated dialogue samples detected: ${repeatedDialogueSamples[0].sample}`)
  }
  const hookRatio = chapters.length ? hookReadyChapters / chapters.length : 0
  if (chapters.length >= 3 && hookRatio < 0.8) {
    issues.push(`chapter hook coverage ${(hookRatio * 100).toFixed(1)}% below 80%`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters: chapters.length,
      totalDialogue,
      requiredDialogue,
      knownCast: knownCast.length,
      mentionedCast: mentionedCast.size,
      hookReadyChapters,
      totalActionSignals,
      totalSensorySignals,
      totalObjectSignals,
    },
    repeatedDialogueSamples: repeatedDialogueSamples.slice(0, 5),
    chapters: chapterAudits,
  }
}

function splitAuditSentences(body) {
  return String(body || "")
    .split(/(?<=[。！？!?])|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
}

function averageValue(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function countDryInstructionSignals(body) {
  return countMatches(
    body,
    /本章|章节|读者|故事|情节|剧情|主线|伏笔|推进|塑造|设定|世界观|写作|文本|爽点|钩子|蓝图|生产|目标清晰|关系变化|人物关系|旁白保持|每段都必须|补充场景|不机械堆词|创作意图/gu,
  )
}

function countGenericSummarySignals(body) {
  return countMatches(
    body,
    /非常严重|更加复杂|更加危险|情况很复杂|未来.*危险|命运安排|内心深处|无法言说|说不清|发生了变化|变得复杂|感到震惊|陷入沉思|充满疑惑|一切都不简单/gu,
  )
}

function paragraphCraftChainEvidence(paragraph, knownCast = []) {
  const text = String(paragraph || "")
  const castSignals = knownCast.filter((name) => text.includes(name)).length
  const dialogueSignals = countMatches(text, /[「“][^」”]{2,120}[」”]/gu)
  const actionSignals = countMatches(text, /走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|握|松|皱眉|沉默|合上|推开|退|挡|攥|盯|避开|吹|夹|藏住/gu)
  const sensorySignals = countMatches(text, /雨|风|声|灯|冷|热|湿|血|灰|墨|纸|门|窗|脚步|气味|疼|汗|光|影|呼吸|触感|指腹|掌心|袖口/gu)
  const objectSignals = countMatches(text, /账本|账册|缺页|信纸|印章|官印|钥匙|地图|脚步|旧账|证据|线索|门槛|窗纸|灯火|袖口|鞋尖|纸边|墨味/gu)
  const consequenceSignals = countMatches(text, /决定|选择|不肯|留下|藏|交出|拦住|拒绝|答应|让|导致|因此|于是|代价|风险|裂|暴露|失去|改变|只剩|再也|换来|逼得|牵出|发现|意识到|真相|关系/gu)
  const summarySignals = countGenericSummarySignals(text)
    + countDryInstructionSignals(text)
    + countMatches(text, /整体|局势|形成|场景感|剧情|继续|推进|所有人物|人物都|关系发生|风险继续|更加/u)
  const complete = (castSignals > 0 || dialogueSignals > 0)
    && actionSignals > 0
    && (sensorySignals > 0 || objectSignals > 0)
    && consequenceSignals > 0
    && summarySignals <= 1
  return {
    complete,
    castSignals,
    dialogueSignals,
    actionSignals,
    sensorySignals,
    objectSignals,
    consequenceSignals,
    summarySignals,
  }
}

export function auditProseTextureForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const knownCast = extractKnownCastNames(snapshot)
  const issues = []
  const chapterAudits = []
  let dryInstructionSignals = 0
  let genericSummarySignals = 0
  let sceneRichChapters = 0
  let variedRhythmChapters = 0
  let craftChainChapters = 0

  for (const chapter of chapters) {
    const body = String(chapter?.body || "")
    const paragraphs = splitBodyParagraphs(body)
    const paragraphChainAudits = paragraphs.map((paragraph) => paragraphCraftChainEvidence(paragraph, knownCast))
    const completeCraftParagraphs = paragraphChainAudits.filter((audit) => audit.complete).length
    const sentences = splitAuditSentences(body)
    const sentenceLengths = sentences.map((sentence) => normalizeAuditText(sentence).length).filter((length) => length > 0)
    const averageSentenceLength = averageValue(sentenceLengths)
    const shortSentenceRatio = sentenceLengths.length
      ? sentenceLengths.filter((length) => length <= 3).length / sentenceLengths.length
      : 0
    const longSentenceRatio = sentenceLengths.length
      ? sentenceLengths.filter((length) => length >= 90).length / sentenceLengths.length
      : 0
    const uniqueSentenceLengthCount = new Set(sentenceLengths.map((length) => Math.round(length / 5) * 5)).size
    const drySignals = countDryInstructionSignals(body)
    const genericSignals = countGenericSummarySignals(body)
    const actionSignals = countMatches(body, /走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|握|松|皱眉|沉默|合上|推开|退|挡|攥|盯|避开|吹|夹|藏住/gu)
    const sensorySignals = countMatches(body, /雨|风|声|灯|冷|热|湿|血|灰|墨|纸|门|窗|脚步|气味|疼|汗|光|影|呼吸|触感|指腹|掌心|袖口/gu)
    const concreteObjectSignals = countMatches(body, /账本|账册|缺页|信纸|印章|官印|钥匙|地图|脚步|旧账|证据|线索|门槛|窗纸|灯火|袖口|鞋尖|纸边|墨味/gu)
    const concreteDensity = body.length
      ? (actionSignals + sensorySignals + concreteObjectSignals) / Math.max(1, body.length / 500)
      : 0
    const dryDensity = body.length
      ? (drySignals + genericSignals) / Math.max(1, body.length / 500)
      : 0
    const sceneRich = concreteDensity >= 8 && sensorySignals >= 4 && concreteObjectSignals >= 3
    const requiredCraftParagraphs = paragraphs.length >= 4 ? 2 : Math.min(1, paragraphs.length)
    const craftChainReady = completeCraftParagraphs >= requiredCraftParagraphs
    const variedRhythm = sentenceLengths.length >= 4
      && uniqueSentenceLengthCount >= 3
      && averageSentenceLength >= 8
      && shortSentenceRatio <= 0.35
      && longSentenceRatio <= 0.45
    if (sceneRich) sceneRichChapters += 1
    if (craftChainReady) craftChainChapters += 1
    if (variedRhythm) variedRhythmChapters += 1
    dryInstructionSignals += drySignals
    genericSummarySignals += genericSignals

    const chapterIssues = []
    if (paragraphs.length < 3) chapterIssues.push(`too few prose paragraphs ${paragraphs.length}`)
    if (!sceneRich) chapterIssues.push(`thin scene texture density ${concreteDensity.toFixed(1)}`)
    if (!craftChainReady) chapterIssues.push(`weak paragraph-level craft chain ${completeCraftParagraphs}/${requiredCraftParagraphs}`)
    if (!variedRhythm) chapterIssues.push("stiff sentence rhythm")
    if (dryDensity > 5) chapterIssues.push(`dry outline/instruction density ${dryDensity.toFixed(1)}`)
    if (genericSignals >= 3) chapterIssues.push(`generic summary phrasing ${genericSignals}`)
    if (chapterIssues.length) {
      issues.push(`chapter ${chapter?.chapterNumber || "?"}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      averageSentenceLength,
      shortSentenceRatio,
      longSentenceRatio,
      uniqueSentenceLengthCount,
      actionSignals,
      sensorySignals,
      concreteObjectSignals,
      concreteDensity,
      drySignals,
      genericSignals,
      dryDensity,
      sceneRich,
      completeCraftParagraphs,
      requiredCraftParagraphs,
      craftChainReady,
      paragraphChainAudits: paragraphChainAudits.slice(0, 5),
      variedRhythm,
      issues: chapterIssues,
    })
  }

  const totalChapters = chapters.length
  const requiredTextureChapters = totalChapters >= 3 ? Math.ceil(totalChapters * 0.8) : totalChapters
  if (totalChapters === 0) issues.push("no readable chapters available for prose texture audit")
  if (sceneRichChapters < requiredTextureChapters) {
    issues.push(`scene-rich chapter coverage ${sceneRichChapters}/${totalChapters} below required ${requiredTextureChapters}`)
  }
  if (variedRhythmChapters < requiredTextureChapters) {
    issues.push(`varied rhythm chapter coverage ${variedRhythmChapters}/${totalChapters} below required ${requiredTextureChapters}`)
  }
  if (craftChainChapters < requiredTextureChapters) {
    issues.push(`paragraph craft chain chapter coverage ${craftChainChapters}/${totalChapters} below required ${requiredTextureChapters}`)
  }
  if (dryInstructionSignals > Math.max(6, totalChapters * 3)) {
    issues.push(`dry outline/instruction signals ${dryInstructionSignals} exceed allowed ${Math.max(6, totalChapters * 3)}`)
  }
  if (genericSummarySignals > Math.max(4, totalChapters * 2)) {
    issues.push(`generic summary signals ${genericSummarySignals} exceed allowed ${Math.max(4, totalChapters * 2)}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      sceneRichChapters,
      craftChainChapters,
      variedRhythmChapters,
      requiredTextureChapters,
      dryInstructionSignals,
      genericSummarySignals,
    },
    chapters: chapterAudits,
  }
}

function countLanguageClicheSignals(body) {
  return countMatches(
    body,
    /命运安排|命运.*齿轮|空气.*凝固|眼神.*复杂|微微一愣|心中一紧|脸色一变|沉默良久|内心深处|无法言说|难以形容|说不清|一切都不简单|某种.*情绪|复杂.*情绪|仿佛.*世界|这一刻.*知道|他知道.*必须|她知道.*必须|事情.*严重|未来.*危险|更加复杂|更加危险|陷入沉思|充满疑惑|感到震惊|深深地|终于意识到/gu,
  )
}

function countAbstractLanguageSignals(body) {
  return countMatches(
    body,
    /感到|觉得|意识到|明白|知道|复杂|严重|危险|未来|命运|内心|情绪|疑惑|震惊|不安|恐惧|痛苦|悲伤|愤怒|沉重|孤独|迷茫|无法|仿佛|某种/gu,
  )
}

function countConcreteCraftSignals(body) {
  const text = String(body || "")
  return countCharacterActionSignals(text)
    + countCharacterPressureSignals(text)
    + countMatches(text, /雨|风|声|灯|冷|热|湿|血|灰|墨|纸|门|窗|脚步|气味|疼|汗|光|影|呼吸|触感|指腹|掌心|袖口|鞋尖|水声|火星/gu)
    + countMatches(text, /账本|账册|缺页|信纸|印章|官印|钥匙|地图|旧账|证据|线索|门槛|窗纸|灯火|袖口|鞋尖|纸边|墨味|铜牌|玻璃|伞柄|木匣|水缸|供桌/gu)
}

function characterBigramDiversity(value) {
  const chars = Array.from(normalizeAuditText(value))
  if (chars.length < 2) return 1
  const bigrams = []
  for (let index = 0; index < chars.length - 1; index += 1) {
    bigrams.push(`${chars[index]}${chars[index + 1]}`)
  }
  return bigrams.length ? new Set(bigrams).size / bigrams.length : 1
}

export function auditLanguageCraftForAcceptance(snapshot, options = {}) {
  const chapters = (Array.isArray(snapshot?.chapters) ? snapshot.chapters : [])
    .map((chapter) => ({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      body: String(chapter?.body || ""),
    }))
    .filter((chapter) => chapter.chapterNumber > 0)
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
  const totalChapters = Number(snapshot?.project?.totalChapters || options.chapters || chapters.length || 0)
  const issues = []

  if (totalChapters < 6 || chapters.length < 6) {
    return {
      passed: true,
      issues: [],
      summary: {
        totalChapters,
        readableChapters: chapters.length,
        skipped: true,
        reason: "short-form sample below language craft threshold",
      },
      chapters: [],
    }
  }

  const chapterAudits = []
  let craftedChapters = 0
  let totalClicheSignals = 0
  let totalAbstractSignals = 0
  let totalConcreteSignals = 0

  for (const chapter of chapters) {
    const body = chapter.body
    const normalizedLength = normalizeAuditText(body).length
    const denominator = Math.max(1, normalizedLength / 1000)
    const clicheSignals = countLanguageClicheSignals(body)
    const abstractSignals = countAbstractLanguageSignals(body)
    const concreteSignals = countConcreteCraftSignals(body)
    const clicheDensity = clicheSignals / denominator
    const abstractDensity = abstractSignals / denominator
    const concreteDensity = concreteSignals / denominator
    const bigramDiversity = characterBigramDiversity(body)
    const allowedClicheSignals = Math.max(2, Math.floor(normalizedLength / 600))
    const issuesForChapter = []

    if (clicheSignals > allowedClicheSignals) {
      issuesForChapter.push(`cliche/template phrasing ${clicheSignals}/${allowedClicheSignals}`)
    }
    if (abstractDensity > Math.max(14, concreteDensity * 1.3)) {
      issuesForChapter.push(`abstract emotion density ${abstractDensity.toFixed(1)} exceeds concrete craft density ${concreteDensity.toFixed(1)}`)
    }
    if (normalizedLength >= 180 && bigramDiversity < 0.5) {
      issuesForChapter.push(`low language diversity ${bigramDiversity.toFixed(2)}`)
    }
    if (normalizedLength >= 80 && concreteSignals < 3) {
      issuesForChapter.push(`weak concrete craft signals ${concreteSignals}`)
    }

    const crafted = issuesForChapter.length === 0
    if (crafted) craftedChapters += 1
    totalClicheSignals += clicheSignals
    totalAbstractSignals += abstractSignals
    totalConcreteSignals += concreteSignals
    if (!crafted) {
      issues.push(`chapter ${chapter.chapterNumber}: ${issuesForChapter.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      normalizedLength,
      clicheSignals,
      allowedClicheSignals,
      abstractSignals,
      concreteSignals,
      clicheDensity,
      abstractDensity,
      concreteDensity,
      bigramDiversity,
      crafted,
      issues: issuesForChapter,
    })
  }

  const requiredCraftedChapters = Math.ceil(chapters.length * 0.8)
  const allowedTotalCliches = Math.max(8, Math.ceil(chapters.length * 1.5))
  if (craftedChapters < requiredCraftedChapters) {
    issues.push(`language craft chapter coverage ${craftedChapters}/${chapters.length} below required ${requiredCraftedChapters}`)
  }
  if (totalClicheSignals > allowedTotalCliches) {
    issues.push(`cliche/template language signals ${totalClicheSignals} exceed allowed ${allowedTotalCliches}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      readableChapters: chapters.length,
      craftedChapters,
      requiredCraftedChapters,
      totalClicheSignals,
      allowedTotalCliches,
      totalAbstractSignals,
      totalConcreteSignals,
      skipped: false,
    },
    chapters: chapterAudits,
  }
}

function countDialogueQuotes(text) {
  return countMatches(text, /[「“][^」”]{2,160}[」”]/gu)
}

function paragraphSceneEvidence(paragraph, knownCast) {
  const text = String(paragraph || "")
  const normalizedLength = normalizeAuditText(text).length
  const castMentions = knownCast.filter((name) => text.includes(name))
  const dialogueCount = countDialogueQuotes(text)
  const actionSignals = countCharacterActionSignals(text)
  const sensorySignals = countMatches(text, /雨|风|声|灯|冷|热|湿|血|灰|墨|纸|门|窗|脚步|气味|疼|汗|光|影|呼吸|触感|指腹|掌心|袖口|鞋尖/gu)
  const objectSignals = countMatches(text, /账本|账册|缺页|信纸|印章|官印|钥匙|地图|旧账|证据|线索|门槛|窗纸|灯火|袖口|鞋尖|纸边|墨味|铜牌|玻璃|伞柄|木匣/gu)
  const pressureSignals = countCharacterPressureSignals(text)
  const consequenceSignals = countMatches(text, /导致|因此|于是|代价|风险|裂|暴露|失去|改变|留下|只剩|再也|换来|逼得|牵出|发现|意识到|真相|关系|不能回头|不可逆/gu)
  const evidenceScore = [
    castMentions.length > 0,
    dialogueCount > 0,
    actionSignals > 0,
    sensorySignals > 0,
    objectSignals > 0,
    pressureSignals > 0 || consequenceSignals > 0,
  ].filter(Boolean).length
  const sceneLike = normalizedLength >= 35
    && evidenceScore >= 3
    && (actionSignals > 0 || dialogueCount > 0)
    && (castMentions.length > 0 || dialogueCount > 0)
  return {
    normalizedLength,
    castMentions,
    dialogueCount,
    actionSignals,
    sensorySignals,
    objectSignals,
    pressureSignals,
    consequenceSignals,
    evidenceScore,
    sceneLike,
    interactionLike: sceneLike && (dialogueCount > 0 || castMentions.length >= 2) && (actionSignals > 0 || pressureSignals > 0),
    consequenceLike: sceneLike && (pressureSignals > 0 || consequenceSignals > 0),
    expositionOnly: normalizedLength >= 45
      && actionSignals === 0
      && dialogueCount === 0
      && sensorySignals === 0
      && objectSignals === 0
      && pressureSignals === 0
      && consequenceSignals === 0,
  }
}

export function auditSceneCompletenessForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const knownCast = extractKnownCastNames(snapshot)
  const issues = []
  const chapterAudits = []
  let sceneCompleteChapters = 0
  let sceneParagraphsTotal = 0
  let interactionParagraphsTotal = 0
  let consequenceParagraphsTotal = 0
  let expositionOnlyParagraphsTotal = 0

  for (const chapter of chapters) {
    const paragraphs = splitBodyParagraphs(chapter?.body || "")
    const paragraphAudits = paragraphs.map((paragraph, index) => ({
      index: index + 1,
      sample: compactText(paragraph, 90),
      ...paragraphSceneEvidence(paragraph, knownCast),
    }))
    const sceneParagraphs = paragraphAudits.filter((paragraph) => paragraph.sceneLike)
    const interactionParagraphs = paragraphAudits.filter((paragraph) => paragraph.interactionLike)
    const consequenceParagraphs = paragraphAudits.filter((paragraph) => paragraph.consequenceLike)
    const expositionOnlyParagraphs = paragraphAudits.filter((paragraph) => paragraph.expositionOnly)
    const requiredSceneParagraphs = paragraphs.length >= 5 ? 3 : Math.min(2, paragraphs.length)
    const allowedExpositionOnlyParagraphs = Math.max(1, Math.floor(paragraphs.length * 0.35))
    const complete = sceneParagraphs.length >= requiredSceneParagraphs
      && interactionParagraphs.length >= 1
      && consequenceParagraphs.length >= 1
      && expositionOnlyParagraphs.length <= allowedExpositionOnlyParagraphs

    if (complete) sceneCompleteChapters += 1
    sceneParagraphsTotal += sceneParagraphs.length
    interactionParagraphsTotal += interactionParagraphs.length
    consequenceParagraphsTotal += consequenceParagraphs.length
    expositionOnlyParagraphsTotal += expositionOnlyParagraphs.length

    const chapterIssues = []
    if (paragraphs.length < 3) chapterIssues.push(`too few scene paragraphs ${paragraphs.length}`)
    if (sceneParagraphs.length < requiredSceneParagraphs) {
      chapterIssues.push(`complete scene paragraphs ${sceneParagraphs.length}/${requiredSceneParagraphs}`)
    }
    if (interactionParagraphs.length < 1) chapterIssues.push("missing character interaction scene")
    if (consequenceParagraphs.length < 1) chapterIssues.push("missing decision/consequence scene beat")
    if (expositionOnlyParagraphs.length > allowedExpositionOnlyParagraphs) {
      chapterIssues.push(`exposition-only paragraphs ${expositionOnlyParagraphs.length} above allowed ${allowedExpositionOnlyParagraphs}`)
    }
    if (chapterIssues.length) {
      issues.push(`chapter ${chapter?.chapterNumber || "?"}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      paragraphCount: paragraphs.length,
      sceneParagraphs: sceneParagraphs.length,
      requiredSceneParagraphs,
      interactionParagraphs: interactionParagraphs.length,
      consequenceParagraphs: consequenceParagraphs.length,
      expositionOnlyParagraphs: expositionOnlyParagraphs.length,
      allowedExpositionOnlyParagraphs,
      complete,
      paragraphs: paragraphAudits.map((paragraph) => ({
        index: paragraph.index,
        sample: paragraph.sample,
        normalizedLength: paragraph.normalizedLength,
        castMentions: paragraph.castMentions,
        dialogueCount: paragraph.dialogueCount,
        actionSignals: paragraph.actionSignals,
        sensorySignals: paragraph.sensorySignals,
        objectSignals: paragraph.objectSignals,
        pressureSignals: paragraph.pressureSignals,
        consequenceSignals: paragraph.consequenceSignals,
        evidenceScore: paragraph.evidenceScore,
        sceneLike: paragraph.sceneLike,
        interactionLike: paragraph.interactionLike,
        consequenceLike: paragraph.consequenceLike,
        expositionOnly: paragraph.expositionOnly,
      })).slice(0, 8),
      issues: chapterIssues,
    })
  }

  const totalChapters = chapters.length
  const requiredCompleteChapters = totalChapters >= 3 ? Math.ceil(totalChapters * 0.85) : totalChapters
  if (totalChapters === 0) issues.push("no readable chapters available for scene completeness audit")
  if (sceneCompleteChapters < requiredCompleteChapters) {
    issues.push(`scene-complete chapter coverage ${sceneCompleteChapters}/${totalChapters} below required ${requiredCompleteChapters}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      sceneCompleteChapters,
      requiredCompleteChapters,
      sceneParagraphsTotal,
      interactionParagraphsTotal,
      consequenceParagraphsTotal,
      expositionOnlyParagraphsTotal,
      knownCast: knownCast.length,
    },
    chapters: chapterAudits,
  }
}

function normalizeVariationFingerprint(value, maxLength = 180) {
  return normalizeAuditText(value)
    .replace(/[0-9０-９零〇一二三四五六七八九十百千万第章节回卷册部年月日号]/gu, "")
    .slice(0, maxLength)
}

function firstMeaningfulSentence(body) {
  return splitAuditSentences(body).find((sentence) => normalizeAuditText(sentence).length >= 8) || firstTextSlice(body, 180)
}

function lastMeaningfulSentence(body) {
  const sentences = splitAuditSentences(body).filter((sentence) => normalizeAuditText(sentence).length >= 8)
  return sentences.at(-1) || lastTextSlice(body, 180)
}

function duplicateChapterFingerprints(chapters, getText, options = {}) {
  const minLength = Number(options.minLength || 24)
  const minCount = Number(options.minCount || 3)
  const maxLength = Number(options.maxLength || 180)
  const groups = new Map()
  for (const chapter of chapters) {
    const chapterNumber = Number(chapter?.chapterNumber || 0)
    const fingerprint = normalizeVariationFingerprint(getText(chapter), maxLength)
    if (fingerprint.length < minLength) continue
    const entry = groups.get(fingerprint) || { fingerprint, chapters: [] }
    entry.chapters.push(chapterNumber)
    groups.set(fingerprint, entry)
  }
  return Array.from(groups.values())
    .filter((entry) => entry.chapters.length >= minCount)
    .map((entry) => ({ ...entry, sample: entry.fingerprint.slice(0, 80) }))
}

function duplicateParagraphFingerprints(chapters) {
  const groups = new Map()
  for (const chapter of chapters) {
    const chapterNumber = Number(chapter?.chapterNumber || 0)
    const seenInChapter = new Set()
    for (const paragraph of splitBodyParagraphs(chapter?.body || "")) {
      const fingerprint = normalizeVariationFingerprint(paragraph, 220)
      if (fingerprint.length < 60 || seenInChapter.has(fingerprint)) continue
      seenInChapter.add(fingerprint)
      const entry = groups.get(fingerprint) || { fingerprint, chapters: [] }
      entry.chapters.push(chapterNumber)
      groups.set(fingerprint, entry)
    }
  }
  return Array.from(groups.values())
    .filter((entry) => entry.chapters.length >= 3)
    .map((entry) => ({ ...entry, sample: entry.fingerprint.slice(0, 100) }))
}

export function auditCrossChapterVariationForAcceptance(snapshot, options = {}) {
  const chapters = (Array.isArray(snapshot?.chapters) ? snapshot.chapters : [])
    .map((chapter) => ({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      body: String(chapter?.body || ""),
    }))
    .filter((chapter) => chapter.chapterNumber > 0)
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
  const project = snapshot?.project || {}
  const totalChapters = Number(project.totalChapters || options.chapters || chapters.length || 0)
  const issues = []

  if (totalChapters < 6 || chapters.length < 6) {
    return {
      passed: true,
      issues: [],
      summary: {
        totalChapters,
        readableChapters: chapters.length,
        skipped: true,
        reason: "short-form sample below cross-chapter variation threshold",
      },
      repeatedOpenings: [],
      repeatedEndings: [],
      repeatedParagraphs: [],
    }
  }

  const openingFingerprints = chapters
    .map((chapter) => normalizeVariationFingerprint(firstMeaningfulSentence(chapter.body), 140))
    .filter((fingerprint) => fingerprint.length >= 18)
  const endingFingerprints = chapters
    .map((chapter) => normalizeVariationFingerprint(lastMeaningfulSentence(chapter.body), 140))
    .filter((fingerprint) => fingerprint.length >= 18)
  const distinctOpenings = new Set(openingFingerprints).size
  const distinctEndings = new Set(endingFingerprints).size
  const requiredDistinctOpenings = Math.ceil(chapters.length * 0.75)
  const requiredDistinctEndings = Math.ceil(chapters.length * 0.7)
  const repeatedOpenings = duplicateChapterFingerprints(chapters, (chapter) => firstMeaningfulSentence(chapter.body), {
    minLength: 18,
    minCount: 3,
    maxLength: 140,
  })
  const repeatedEndings = duplicateChapterFingerprints(chapters, (chapter) => lastMeaningfulSentence(chapter.body), {
    minLength: 18,
    minCount: 3,
    maxLength: 140,
  })
  const repeatedParagraphs = duplicateParagraphFingerprints(chapters)
  const repeatedParagraphChapters = new Set(repeatedParagraphs.flatMap((entry) => entry.chapters))
  const allowedRepeatedParagraphChapters = Math.max(2, Math.floor(chapters.length * 0.25))

  if (distinctOpenings < requiredDistinctOpenings) {
    issues.push(`distinct chapter openings ${distinctOpenings}/${chapters.length} below required ${requiredDistinctOpenings}`)
  }
  if (distinctEndings < requiredDistinctEndings) {
    issues.push(`distinct chapter endings ${distinctEndings}/${chapters.length} below required ${requiredDistinctEndings}`)
  }
  if (repeatedOpenings.length > 0) {
    issues.push(`repeated chapter opening template across chapters ${repeatedOpenings[0].chapters.join(",")}`)
  }
  if (repeatedEndings.length > 0) {
    issues.push(`repeated chapter ending template across chapters ${repeatedEndings[0].chapters.join(",")}`)
  }
  if (repeatedParagraphChapters.size > allowedRepeatedParagraphChapters) {
    issues.push(`repeated long prose paragraphs affect ${repeatedParagraphChapters.size}/${chapters.length} chapters, above allowed ${allowedRepeatedParagraphChapters}`)
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      readableChapters: chapters.length,
      distinctOpenings,
      requiredDistinctOpenings,
      distinctEndings,
      requiredDistinctEndings,
      repeatedOpeningGroups: repeatedOpenings.length,
      repeatedEndingGroups: repeatedEndings.length,
      repeatedParagraphGroups: repeatedParagraphs.length,
      repeatedParagraphChapters: repeatedParagraphChapters.size,
      allowedRepeatedParagraphChapters,
      skipped: false,
    },
    repeatedOpenings: repeatedOpenings.slice(0, 5),
    repeatedEndings: repeatedEndings.slice(0, 5),
    repeatedParagraphs: repeatedParagraphs.slice(0, 8),
  }
}

function countFinalResolutionSignals(body) {
  return countMatches(
    body,
    /摊牌|揭开|揭示|查清|真相|终于|回收|兑现|承认|拒绝|交出|付出|付清|清算|审判|定局|了结|合上|裂开|天亮|尾声|卷尾|余波|新局|从此|再也|改变|翻面|答案|供词|代价|不能退|不可逆|只剩|离开|留下/gu,
  )
}

function countFinalConsequenceSignals(body) {
  return countMatches(
    body,
    /代价|因此|于是|换来|导致|从此|再也|改变|失去|留下|只剩|裂|暴露|身份|位置|关系|债|命|清算|余波|不可逆|供词|答案/gu,
  )
}

function countOpenEndedFinaleSignals(body) {
  return countMatches(
    body,
    /更加危险|更加复杂|更大.*真相|新的危机|继续追查|继续调查|后续|下一章|所有伏笔|未来.*危险|一切都不简单|仍然没有答案|没有答案|谜团.*加深|危机.*升级|还没有结束|只是开始/gu,
  )
}

function uniqueTermsInText(text, terms) {
  const source = String(text || "")
  return [...new Set((terms || []).map((term) => String(term || "").trim()).filter((term) => term.length >= 2))]
    .filter((term) => source.includes(term))
}

export function auditFinalResolutionForAcceptance(snapshot, options = {}) {
  const chapters = (Array.isArray(snapshot?.chapters) ? snapshot.chapters : [])
    .map((chapter) => ({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      body: String(chapter?.body || ""),
    }))
    .filter((chapter) => chapter.chapterNumber > 0)
    .sort((left, right) => left.chapterNumber - right.chapterNumber)
  const totalChapters = Number(snapshot?.project?.totalChapters || options.chapters || chapters.length || 0)
  const issues = []

  if (totalChapters < 6 || chapters.length < 6) {
    return {
      passed: true,
      issues: [],
      summary: {
        totalChapters,
        readableChapters: chapters.length,
        skipped: true,
        reason: "short-form sample below final resolution threshold",
      },
      chapters: [],
    }
  }

  const finalWindowSize = Math.max(2, Math.ceil(chapters.length * 0.25))
  const finalChapters = chapters.slice(-finalWindowSize)
  const finalBody = finalChapters.map((chapter) => chapter.body).join("\n\n")
  const finalChapter = finalChapters.at(-1)
  const finalChapterBody = finalChapter?.body || ""
  const dossiers = extractAcceptanceCharacterDossiers(snapshot)
  const protagonist = identifyProtagonistForAcceptance(snapshot, dossiers)
  const protagonistNames = protagonist ? [protagonist.name, ...protagonist.aliases].filter(Boolean) : []
  const relationshipEntries = extractRelationshipEntriesForAcceptance(snapshot)
    .map((entry, index) => normalizeRelationshipEntryForAcceptance(entry, extractKnownCastNames(snapshot), index))
    .filter((entry) => entry.from && entry.to)
  const relationshipNames = [...new Set(relationshipEntries.flatMap((entry) => [entry.from, entry.to]).filter(Boolean))]
  const foreshadowingTerms = [...new Set(extractForeshadowingEntries(snapshot).flatMap((entry) => extractForeshadowingAnchorTerms(entry)))]
  const payoffAnchors = uniqueTermsInText(finalBody, foreshadowingTerms)
  const finalResolutionSignals = countFinalResolutionSignals(finalBody)
  const finalConsequenceSignals = countFinalConsequenceSignals(finalBody)
  const finalOpenEndedSignals = countOpenEndedFinaleSignals(finalBody)
  const finalChapterResolutionSignals = countFinalResolutionSignals(finalChapterBody)
  const finalChapterConsequenceSignals = countFinalConsequenceSignals(finalChapterBody)
  const finalChapterOpenEndedSignals = countOpenEndedFinaleSignals(finalChapterBody)
  const finalChapterProtagonistMentioned = containsAnyTerm(finalChapterBody, protagonistNames)
  const finalChapterResolved = finalChapterResolutionSignals >= 2
    && finalChapterConsequenceSignals >= 1
    && finalChapterProtagonistMentioned
    && finalChapterOpenEndedSignals <= Math.max(1, finalChapterResolutionSignals)

  const chapterAudits = []
  let resolvedFinalChapters = 0
  let protagonistFinalChapters = 0
  let relationshipFinalChapters = 0
  for (const chapter of finalChapters) {
    const body = chapter.body
    const resolutionSignals = countFinalResolutionSignals(body)
    const consequenceSignals = countFinalConsequenceSignals(body)
    const openEndedSignals = countOpenEndedFinaleSignals(body)
    const protagonistMentioned = containsAnyTerm(body, protagonistNames)
    const relationshipMentions = relationshipNames.filter((name) => body.includes(name))
    const relationshipClosure = relationshipMentions.length >= 2 && countCharacterPressureSignals(body) >= 2
    const payoffAnchorMatches = uniqueTermsInText(body, foreshadowingTerms)
    const resolved = resolutionSignals >= 2
      && consequenceSignals >= 1
      && protagonistMentioned
      && openEndedSignals <= Math.max(1, resolutionSignals)
    if (resolved) resolvedFinalChapters += 1
    if (protagonistMentioned) protagonistFinalChapters += 1
    if (relationshipClosure) relationshipFinalChapters += 1
    const chapterIssues = []
    if (resolutionSignals < 2) chapterIssues.push(`weak resolution signals ${resolutionSignals}`)
    if (consequenceSignals < 1) chapterIssues.push(`weak consequence/aftermath signals ${consequenceSignals}`)
    if (!protagonistMentioned && protagonistNames.length > 0) chapterIssues.push("protagonist absent from final resolution window")
    if (openEndedSignals > Math.max(1, resolutionSignals)) chapterIssues.push(`open-ended escalation dominates ${openEndedSignals}/${resolutionSignals}`)
    chapterAudits.push({
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      resolutionSignals,
      consequenceSignals,
      openEndedSignals,
      protagonistMentioned,
      relationshipMentions: relationshipMentions.slice(0, 8),
      relationshipClosure,
      payoffAnchorMatches: payoffAnchorMatches.slice(0, 8),
      resolved,
      issues: chapterIssues,
    })
  }

  const requiredResolvedFinalChapters = Math.ceil(finalChapters.length * 0.75)
  const requiredProtagonistFinalChapters = finalChapters.length
  const requiredRelationshipFinalChapters = relationshipEntries.length > 0 ? Math.max(1, Math.ceil(finalChapters.length * 0.5)) : 0
  const requiredPayoffAnchors = foreshadowingTerms.length > 0 ? 1 : 0
  const allowedOpenEndedSignals = Math.max(2, Math.floor(finalChapters.length * 1.5))

  if (resolvedFinalChapters < requiredResolvedFinalChapters) {
    issues.push(`final resolution chapter coverage ${resolvedFinalChapters}/${finalChapters.length} below required ${requiredResolvedFinalChapters}`)
  }
  if (protagonistFinalChapters < requiredProtagonistFinalChapters) {
    issues.push(`protagonist final-window coverage ${protagonistFinalChapters}/${finalChapters.length} below required ${requiredProtagonistFinalChapters}`)
  }
  if (relationshipFinalChapters < requiredRelationshipFinalChapters) {
    issues.push(`relationship closure coverage ${relationshipFinalChapters}/${finalChapters.length} below required ${requiredRelationshipFinalChapters}`)
  }
  if (payoffAnchors.length < requiredPayoffAnchors) {
    issues.push(`final payoff anchors ${payoffAnchors.length}/${foreshadowingTerms.length} below required ${requiredPayoffAnchors}`)
  }
  if (finalResolutionSignals < finalChapters.length * 3) {
    issues.push(`final resolution signals ${finalResolutionSignals} below required ${finalChapters.length * 3}`)
  }
  if (finalConsequenceSignals < finalChapters.length * 2) {
    issues.push(`final consequence/aftermath signals ${finalConsequenceSignals} below required ${finalChapters.length * 2}`)
  }
  if (finalOpenEndedSignals > allowedOpenEndedSignals && finalOpenEndedSignals > finalResolutionSignals) {
    issues.push(`open-ended finale signals ${finalOpenEndedSignals} exceed allowed ${allowedOpenEndedSignals} and dominate resolution`)
  }
  if (!finalChapterResolved) {
    issues.push(`final chapter ${finalChapter?.chapterNumber || "?"} does not show concrete resolution and aftermath`)
  }

  for (const chapter of chapterAudits) {
    if (chapter.issues.length) {
      issues.push(`chapter ${chapter.chapterNumber}: ${chapter.issues.join("; ")}`)
    }
  }

  return {
    passed: issues.length === 0,
    issues: [...new Set(issues)],
    summary: {
      totalChapters,
      readableChapters: chapters.length,
      finalWindowSize,
      resolvedFinalChapters,
      requiredResolvedFinalChapters,
      protagonistFinalChapters,
      requiredProtagonistFinalChapters,
      relationshipFinalChapters,
      requiredRelationshipFinalChapters,
      payoffAnchors: payoffAnchors.length,
      requiredPayoffAnchors,
      finalResolutionSignals,
      finalConsequenceSignals,
      finalOpenEndedSignals,
      allowedOpenEndedSignals,
      finalChapterResolved,
      skipped: false,
    },
    payoffAnchors: payoffAnchors.slice(0, 12),
    chapters: chapterAudits,
  }
}

function collectStyleFallbackSignals(payload) {
  const signals = []
  const inspectCandidate = (candidate, label) => {
    if (!candidate || typeof candidate !== "object") return
    if (candidate.llmFallbackUsed === true) signals.push(`${label}: llmFallbackUsed`)
    if (candidate.evaluation?.source === "heuristic") signals.push(`${label}: heuristic evaluation`)
    if (candidate.refinement?.source === "heuristic") signals.push(`${label}: heuristic refinement`)
    if (candidate.freezer?.source === "heuristic") signals.push(`${label}: heuristic freezer`)
    if (Array.isArray(candidate.fallbackReasons)) {
      for (const reason of candidate.fallbackReasons.filter(Boolean).slice(0, 4)) {
        signals.push(`${label}: ${String(reason).slice(0, 220)}`)
      }
    }
  }
  inspectCandidate(payload?.loopIteration, "loopIteration")
  for (const [index, candidate] of (payload?.loopIteration?.candidates || []).entries()) {
    inspectCandidate(candidate, `loopIteration.candidates[${index}]`)
  }
  for (const [index, iteration] of (payload?.loopRun?.iterations || []).entries()) {
    inspectCandidate(iteration, `loopRun.iterations[${index}]`)
    if (iteration.freezerSource === "heuristic") signals.push(`loopRun.iterations[${index}]: heuristic freezerSource`)
    for (const [candidateIndex, candidate] of (iteration.candidates || []).entries()) {
      inspectCandidate(candidate, `loopRun.iterations[${index}].candidates[${candidateIndex}]`)
    }
  }
  const history = payload?.styleEvolution?.contract?.evolutionHistory || []
  const latest = Array.isArray(history) ? history.at(-1) : null
  inspectCandidate(latest, "styleEvolution.contract.latest")
  if (payload?.styleEvolution?.contract?.freezer?.source === "heuristic") {
    signals.push("styleEvolution.contract.freezer: heuristic")
  }
  const inspectFallbackObject = (value, label) => {
    if (!value || typeof value !== "object") return
    if (value.llmFallbackUsed === true) signals.push(`${label}: llmFallbackUsed`)
    if (value.contractExtractionSource === "local_fallback") signals.push(`${label}: local contract extraction fallback`)
    if (value.freezeAdviceSource === "local_fallback") signals.push(`${label}: local freeze advice fallback`)
    if (Array.isArray(value.fallbackReasons)) {
      for (const reason of value.fallbackReasons.filter(Boolean).slice(0, 4)) {
        signals.push(`${label}: ${String(reason).slice(0, 220)}`)
      }
    }
  }
  inspectFallbackObject(payload?.freezePreview, "freezePreview")
  inspectFallbackObject(payload?.styleFreezeApproval, "styleFreezeApproval")
  return [...new Set(signals.filter(Boolean))]
}

function latestStyleCandidate(styleEvolution) {
  const history = styleEvolution?.contract?.evolutionHistory
  return Array.isArray(history) ? history.at(-1) : null
}

function styleCandidateFreezeStatus(candidate) {
  if (!candidate || typeof candidate !== "object") {
    return {
      ready: false,
      verificationStatus: "missing",
      freezerVerdict: "missing",
      reasons: ["Style Evolution did not return a latest candidate."],
    }
  }
  const verificationStatus = candidate.verification?.status || "missing"
  const freezerVerdict = candidate.freezer?.verdict || "missing"
  const fallbackSignals = collectStyleFallbackSignals({ styleEvolution: { contract: { evolutionHistory: [candidate] } } })
  const reasons = [
    verificationStatus !== "passed" ? `verification=${verificationStatus}` : "",
    freezerVerdict !== "ready" ? `freezer=${freezerVerdict}` : "",
    ...((candidate.freezer?.blockingReasons || []).filter(Boolean)),
    ...((candidate.verification?.reasons || []).filter(Boolean)),
    ...fallbackSignals,
  ].filter(Boolean)
  return {
    ready: verificationStatus === "passed" && freezerVerdict === "ready" && fallbackSignals.length === 0,
    verificationStatus,
    freezerVerdict,
    reasons: [...new Set(reasons)].slice(0, 8),
  }
}

function buildStyleIterationFeedback(candidate, status) {
  const parts = [
    "继续进化写法样段，只有 Generation Verification Gate 通过且 Style Contract Freezer verdict=ready 才能冻结。",
    `上一轮状态：verification=${status.verificationStatus}, freezer=${status.freezerVerdict}。`,
    status.reasons.length ? `必须修正：${status.reasons.join("；")}` : "",
    candidate?.refinement?.nextPrompt ? `继承上一轮 Prompt Refiner 的 nextPrompt：${compactText(candidate.refinement.nextPrompt, 700)}` : "",
  ].filter(Boolean)
  return parts.join("\n")
}

async function configureAigcDetector(api, options, report) {
  const writingSettings = buildAcceptanceWritingSettings(options.aigcDetector)
  await api("POST", "/api/settings/writing", {
    settings: writingSettings,
  })
  report.steps.push({
    step: "acceptance_writing_settings_saved",
    status: "completed",
    at: now(),
    autoAigcRefinement: writingSettings.autoAigcRefinement === true,
    aigcDetector: writingSettings.aigcDetector
      ? redactAigcDetectorOptions(writingSettings.aigcDetector)
      : null,
  })
  log("Saved acceptance writing settings through Studio API.", {
    autoAigcRefinement: writingSettings.autoAigcRefinement === true,
    aigcDetector: writingSettings.aigcDetector
      ? redactAigcDetectorOptions(writingSettings.aigcDetector)
      : null,
  })

  const settingsPayload = await api("GET", "/api/settings/writing")
  const detector = settingsPayload.settings?.aigcDetector || {}
  report.steps.push({
    step: "aigc_detector_config",
    status: detectorReady(settingsPayload) ? "passed" : "blocked",
    at: now(),
    provider: detector.provider || "disabled",
    urlConfigured: Boolean(detector.url),
    tokenConfigured: detector.tokenConfigured === true,
    threshold: detector.threshold,
    autoAigcRefinement: settingsPayload.settings?.autoAigcRefinement === true,
  })
  if (!detectorReady(settingsPayload)) {
    throw new AcceptanceError("AIGC detector is not configured. Configure it in app settings or pass --aigc-detector-provider and --aigc-detector-url.", {
      provider: detector.provider || "disabled",
      urlConfigured: Boolean(detector.url),
      nextCommandExample: "rtk node scripts/run-production-acceptance.mjs --aigc-detector-provider local-heuristic --auto-approve-style --auto-approve-foundation",
    })
  }
  log("AIGC detector config is ready.", {
    provider: detector.provider,
    urlConfigured: Boolean(detector.url),
    tokenConfigured: detector.tokenConfigured === true,
    threshold: detector.threshold,
  })
  return detector
}

function chapterProgressFromStatus(statusPayload) {
  const tasks = Array.isArray(statusPayload?.state?.plan?.chapterTasks)
    ? statusPayload.state.plan.chapterTasks
    : []
  return {
    stage: statusPayload?.state?.runtime?.stage || "unknown",
    statusMessage: statusPayload?.state?.runtime?.statusMessage || "",
    total: Number(statusPayload?.state?.plan?.totalChapters || tasks.length || 0),
    pending: Number(statusPayload?.state?.plan?.pendingChapters ?? tasks.filter((task) => task.status === "pending").length),
    complete: tasks.filter((task) => task.status === "complete").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
  }
}

function productionReadinessCodes(statusPayload) {
  const readiness = statusPayload?.productionReadiness || {}
  const issues = Array.isArray(readiness.issues) ? readiness.issues : []
  return {
    status: readiness.status || "unknown",
    canProceed: readiness.canProceed === true,
    summary: readiness.summary || "",
    blockedReason: readiness.blockedReason || "",
    issueCodes: issues.map((issue) => issue.code).filter(Boolean),
  }
}

async function getStatus(api, projectId) {
  return api("GET", `/api/status?projectId=${encodeURIComponent(projectId)}`, {}, projectId)
}

async function maybeWriteCheckpoint(checkpoint, phase, details = {}) {
  if (typeof checkpoint === "function") {
    await checkpoint(phase, details)
  }
}

async function ensureStyleGate(api, projectId, options, report, checkpoint = null) {
  let stylePayload = await api("GET", `/api/style-evolution?projectId=${encodeURIComponent(projectId)}`, {}, projectId)
  let gate = stylePayload.styleEvolution?.gate || null
  if (gate?.canProceed === true && gate?.status === "passed") {
    report.steps.push({ step: "style_gate", status: "passed_existing", at: now() })
    await maybeWriteCheckpoint(checkpoint, "style_gate_passed_existing")
    log("Style gate already passed.")
    return stylePayload
  }

  log("Running Style Evolution through Studio API.", {
    iterations: options.styleIterations,
    maxRequests: options.styleMaxRequests,
    candidates: options.styleCandidates,
  })
  const maxStyleRequests = Math.max(1, options.styleMaxRequests)
  let generated = null
  let candidate = latestStyleCandidate(stylePayload.styleEvolution)
  let candidateStatus = styleCandidateFreezeStatus(candidate)
  let iterationFeedback = candidate && !candidateStatus.ready
    ? buildStyleIterationFeedback(candidate, candidateStatus)
    : ""
  for (let attempt = 1; attempt <= maxStyleRequests; attempt += 1) {
    generated = await api("POST", "/api/style-evolution/generate-candidate", {
      projectId,
      userStylePrompt: options.stylePrompt,
      loopIterations: options.styleIterations,
      candidateCount: options.styleCandidates,
      iterationFeedback: iterationFeedback || undefined,
    }, projectId)
    const fallbackSignals = collectStyleFallbackSignals(generated)
    if (fallbackSignals.length) {
      throw new AcceptanceError("Style Evolution used heuristic/fallback results; production acceptance requires real LLM evaluator/refiner/freezer output.", {
        fallbackSignals: fallbackSignals.slice(0, 12),
        attempt,
        loopRun: generated.loopRun ? {
          runId: generated.loopRun.runId,
          stopReason: generated.loopRun.stopReason,
          completedIterations: generated.loopRun.completedIterations,
        } : null,
      })
    }
    candidate = latestStyleCandidate(generated.styleEvolution)
    candidateStatus = styleCandidateFreezeStatus(candidate)
    const version = Number(candidate?.version || generated.generatedCandidate?.version || 0)
    report.steps.push({
      step: "style_candidate_generated",
      status: candidateStatus.ready ? "ready" : "continue",
      at: now(),
      attempt,
      version,
      verificationStatus: candidateStatus.verificationStatus,
      freezerVerdict: candidateStatus.freezerVerdict,
      reasons: candidateStatus.reasons,
      modelRouting: generated.modelRouting || null,
    })
    await maybeWriteCheckpoint(checkpoint, "style_candidate_generated", {
      attempt,
      version,
      ready: candidateStatus.ready,
      verificationStatus: candidateStatus.verificationStatus,
      freezerVerdict: candidateStatus.freezerVerdict,
    })
    log("Style candidate iteration completed.", {
      attempt,
      version,
      verification: candidateStatus.verificationStatus,
      freezer: candidateStatus.freezerVerdict,
      ready: candidateStatus.ready,
    })
    if (candidateStatus.ready) {
      break
    }
    iterationFeedback = buildStyleIterationFeedback(candidate, candidateStatus)
  }
  const version = Number(candidate?.version || generated?.generatedCandidate?.version || 0)
  if (!version) {
    throw new AcceptanceError("Style Evolution did not produce a candidate version.", {
      generatedCandidate: generated?.generatedCandidate || null,
      loopRun: generated?.loopRun || null,
    })
  }
  if (!candidateStatus?.ready) {
    throw new AcceptanceError("Style Evolution did not reach a freezer-ready candidate within the configured attempts.", {
      version,
      attempts: maxStyleRequests,
      verificationStatus: candidateStatus?.verificationStatus || "missing",
      freezerVerdict: candidateStatus?.freezerVerdict || "missing",
      reasons: candidateStatus?.reasons || [],
      loopRun: generated?.loopRun || null,
    })
  }
  log("Style candidate ready for freeze.", { version, model: generated?.modelRouting?.modelName })

  if (!options.autoApproveStyle) {
    throw new AcceptanceError("Style candidate generated, but style approval is waiting for explicit user confirmation.", {
      projectId,
      version,
      nextCommand: `rtk node scripts/run-production-acceptance.mjs --resume-project-id ${projectId} --auto-approve-style --auto-approve-foundation`,
    })
  }

  await api("POST", "/api/style-evolution/accept", {
    projectId,
    version,
    acceptedAt: now(),
  }, projectId)
  const approved = await api("POST", "/api/style-evolution/approve", {
    projectId,
    version,
    approvedAt: now(),
  }, projectId)
  const approvalFallbackSignals = collectStyleFallbackSignals(approved)
  if (approvalFallbackSignals.length) {
    throw new AcceptanceError("Style freeze approval used local fallback results; production acceptance requires LLM-derived freeze contract and advice.", {
      fallbackSignals: approvalFallbackSignals.slice(0, 12),
      version,
    })
  }
  gate = approved.styleEvolution?.gate || null
  if (gate?.canProceed !== true || gate?.status !== "passed") {
    throw new AcceptanceError("Style approval did not pass the Style Contract Freeze Gate.", {
      gate,
    })
  }
  report.steps.push({ step: "style_gate", status: "passed", at: now(), version })
  await maybeWriteCheckpoint(checkpoint, "style_gate_passed", { version })
  log("Style gate passed.", { version })
  return approved
}

async function advanceUntilPlanningReady(api, projectId, options, report, checkpoint = null) {
  let status = await getStatus(api, projectId)
  let progress = chapterProgressFromStatus(status)
  const planningReadyStages = new Set(["chapter_task_generation", "drafting", "reviewing", "aigc_refinement", "complete"])
  let steps = 0
  while (!planningReadyStages.has(progress.stage) && steps < options.maxAdvanceSteps) {
    log("Advancing planning flow.", progress)
    await api("POST", "/api/advance", { projectId }, projectId)
    status = await getStatus(api, projectId)
    progress = chapterProgressFromStatus(status)
    steps += 1
    await maybeWriteCheckpoint(checkpoint, "planning_progress", { progress, advanceSteps: steps })
  }

  if (!planningReadyStages.has(progress.stage)) {
    throw new AcceptanceError("Planning did not reach chapter task generation.", {
      progress,
      steps,
      maxAdvanceSteps: options.maxAdvanceSteps,
    })
  }

  report.steps.push({ step: "planning_ready", status: "completed", at: now(), progress, advanceSteps: steps })
  await maybeWriteCheckpoint(checkpoint, "planning_ready", { progress, advanceSteps: steps })
  log("Planning reached a drafting-ready stage.", progress)
  return status
}

async function ensureStoryFoundation(api, projectId, options, report, checkpoint = null) {
  let status = await getStatus(api, projectId)
  let readiness = productionReadinessCodes(status)

  const planningIssue = readiness.issueCodes.some((code) => String(code).startsWith("story_planning_assets"))
  if (planningIssue && options.autoRepairStoryAssets) {
    log("Repairing story foundation assets through Studio API.", readiness)
    await api("POST", "/api/production/story-assets/repair", { projectId }, projectId)
    status = await getStatus(api, projectId)
    readiness = productionReadinessCodes(status)
    report.steps.push({ step: "story_assets_repair", status: "completed", at: now(), readiness })
    await maybeWriteCheckpoint(checkpoint, "story_assets_repair", { readiness })
  }

  if (!readiness.canProceed && readiness.issueCodes.includes("story_foundation_approval_missing")) {
    if (!options.autoApproveFoundation) {
      throw new AcceptanceError("Story foundation is ready for review but needs explicit user approval.", {
        projectId,
        readiness,
        nextCommand: `rtk node scripts/run-production-acceptance.mjs --resume-project-id ${projectId} --auto-approve-style --auto-approve-foundation`,
      })
    }
    log("Approving story foundation through Studio API.")
    await api("POST", "/api/production/story-foundation/approve", {
      projectId,
      note: "Real production acceptance run approved the generated world, plot, character, relationship, foreshadowing, volume, blueprint, and writing plan assets for full-novel drafting.",
      approvedBy: "acceptance-runner",
    }, projectId)
    status = await getStatus(api, projectId)
    readiness = productionReadinessCodes(status)
    report.steps.push({ step: "story_foundation_approval", status: "completed", at: now(), readiness })
    await maybeWriteCheckpoint(checkpoint, "story_foundation_approved", { readiness })
  }

  if (!readiness.canProceed || readiness.status !== "passed") {
    throw new AcceptanceError("Production readiness is still blocked before drafting.", {
      readiness,
      productionReadiness: status.productionReadiness || null,
    })
  }

  report.steps.push({ step: "production_readiness", status: "passed", at: now(), readiness })
  await maybeWriteCheckpoint(checkpoint, "production_readiness_passed", { readiness })
  log("Production readiness passed.", readiness)
  return status
}

async function runDraftingToCompletion(api, projectId, options, report, checkpoint = null) {
  let status = await getStatus(api, projectId)
  let progress = chapterProgressFromStatus(status)
  let lastComplete = progress.complete
  let staleSteps = 0

  for (let step = 1; step <= options.maxAdvanceSteps && progress.stage !== "complete"; step += 1) {
    log(`Advancing production step ${step}/${options.maxAdvanceSteps}.`, progress)
    await api("POST", "/api/advance", { projectId }, projectId)
    status = await getStatus(api, projectId)
    progress = chapterProgressFromStatus(status)

    if (progress.complete > lastComplete) {
      staleSteps = 0
      lastComplete = progress.complete
    } else {
      staleSteps += 1
    }

    report.progress.push({ at: now(), step, ...progress })
    await maybeWriteCheckpoint(checkpoint, "drafting_progress", {
      advanceStep: step,
      staleSteps,
      progress,
    })

    if (progress.blocked > 0) {
      throw new AcceptanceError("Chapter production has blocked chapters.", { progress })
    }
    if (staleSteps >= options.maxStaleSteps) {
      throw new AcceptanceError("Chapter production made no chapter progress for too many steps.", {
        progress,
        staleSteps,
        maxStaleSteps: options.maxStaleSteps,
      })
    }
  }

  if (progress.stage !== "complete") {
    throw new AcceptanceError("Production did not complete within the configured advance limit.", {
      progress,
      maxAdvanceSteps: options.maxAdvanceSteps,
    })
  }

  report.steps.push({ step: "drafting_complete", status: "completed", at: now(), progress })
  await maybeWriteCheckpoint(checkpoint, "drafting_complete", { progress })
  log("Drafting flow reached complete.", progress)
  return status
}

async function verifyReader(api, projectId, options, report, checkpoint = null) {
  const snapshot = await api("GET", `/api/reader-snapshot?projectId=${encodeURIComponent(projectId)}`, {}, projectId)
  const stats = snapshot.stats || {}
  const project = snapshot.project || {}
  const chapters = Array.isArray(snapshot.chapters) ? snapshot.chapters : []
  const totalChapters = Number(project.totalChapters || options.chapters)
  const totalWords = Number(stats.totalWords || 0)
  const readableChapters = Number(stats.readableChapters || 0)
  const blockedChapters = chapters.filter((chapter) => chapter?.publishReadiness?.ready !== true)

  if (readableChapters < totalChapters) {
    throw new AcceptanceError("Reader snapshot does not expose every chapter.", {
      readableChapters,
      totalChapters,
    })
  }
  if (totalWords < options.minTotalWords || totalWords > options.maxTotalWords) {
    throw new AcceptanceError("Reader total word count is outside the required 100k-300k acceptance band.", {
      totalWords,
      minTotalWords: options.minTotalWords,
      maxTotalWords: options.maxTotalWords,
    })
  }
  if (blockedChapters.length > 0) {
    throw new AcceptanceError("Some reader chapters are not publish-ready.", {
      blockedChapters: blockedChapters.slice(0, 12).map((chapter) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        missing: chapter.publishReadiness?.missing || [],
      })),
      blockedCount: blockedChapters.length,
    })
  }

  const chapterChecks = []
  const chapterBodies = []
  for (let chapterNumber = 1; chapterNumber <= totalChapters; chapterNumber += 1) {
    const chapterPayload = await api(
      "GET",
      `/api/reader-chapter?projectId=${encodeURIComponent(projectId)}&chapterNumber=${chapterNumber}`,
      {},
      projectId,
    )
    const chapter = chapterPayload.chapter || {}
    const body = String(chapter.body || "")
    if (!body.trim()) {
      throw new AcceptanceError("Reader returned an empty chapter body.", { chapterNumber })
    }
    const metadataWordCount = Number(chapter.wordCount || 0)
    const actualWordCount = countAcceptanceBodyWords(body)
    chapterBodies.push({
      chapterNumber,
      title: chapter.title || "",
      wordCount: metadataWordCount,
      actualWordCount,
      body,
      qualityGate: chapter.qualityGate || null,
      aigcDetection: chapter.aigcDetection || null,
      styleInheritanceVerification: chapter.styleInheritanceVerification || null,
      styleConformanceDrift: chapter.styleConformanceDrift || chapter.versionManifest?.styleConformanceDrift || null,
      publishReadiness: chapter.publishReadiness || null,
      versionManifest: chapter.versionManifest || null,
    })
    chapterChecks.push({
      chapterNumber,
      title: chapter.title || "",
      wordCount: metadataWordCount,
      actualWordCount,
      publishReady: chapter.publishReadiness?.ready === true,
    })
    await maybeWriteCheckpoint(checkpoint, "reader_chapter_checked", {
      chapterNumber,
      checkedChapters: chapterChecks.length,
      totalChapters,
      wordCount: metadataWordCount,
      actualWordCount,
      publishReady: chapter.publishReadiness?.ready === true,
    })
  }

  const chapterBlueprints = await loadChapterBlueprintsForAcceptance(options.rootDir, projectId, totalChapters)
  const auditSnapshot = {
    ...snapshot,
    chapters: chapterBodies,
    chapterBlueprints: chapterBlueprints.length ? chapterBlueprints : snapshot.chapterBlueprints,
  }
  const readerWordCountAudit = auditReaderWordCountsForAcceptance(auditSnapshot, options)
  if (!readerWordCountAudit.passed) {
    throw new AcceptanceError("Reader actual word count acceptance audit failed.", {
      issues: readerWordCountAudit.issues.slice(0, 30),
      summary: readerWordCountAudit.summary,
      chapters: readerWordCountAudit.chapters.filter((chapter) => !chapter.passed).slice(0, 12),
    })
  }
  const storyFoundationAudit = auditStoryFoundationForAcceptance(auditSnapshot, options)
  if (!storyFoundationAudit.passed) {
    throw new AcceptanceError("Story foundation acceptance audit failed.", {
      issues: storyFoundationAudit.issues.slice(0, 20),
      counts: storyFoundationAudit.counts,
    })
  }
  const readerPurityAudit = auditReaderPurityForAcceptance(auditSnapshot, options)
  if (!readerPurityAudit.passed) {
    throw new AcceptanceError("Reader purity acceptance audit failed.", {
      issues: readerPurityAudit.issues.slice(0, 30),
      summary: readerPurityAudit.summary,
      chapters: readerPurityAudit.chapters.filter((chapter) => !chapter.clean).slice(0, 8),
    })
  }
  const productionValidationAudit = auditProductionValidationForAcceptance(auditSnapshot, options)
  if (!productionValidationAudit.passed) {
    throw new AcceptanceError("Production validation acceptance audit failed.", {
      issues: productionValidationAudit.issues.slice(0, 30),
      summary: productionValidationAudit.summary,
      chapters: productionValidationAudit.chapters.slice(0, 8),
    })
  }
  const worldbuildingAudit = auditWorldbuildingIntegrationForAcceptance(auditSnapshot, options)
  if (!worldbuildingAudit.passed) {
    throw new AcceptanceError("Worldbuilding integration acceptance audit failed.", {
      issues: worldbuildingAudit.issues.slice(0, 30),
      summary: worldbuildingAudit.summary,
      anchors: worldbuildingAudit.anchors,
      chapters: worldbuildingAudit.chapters.slice(0, 8),
    })
  }
  const structuralProgressionAudit = auditStructuralProgressionForAcceptance(auditSnapshot, options)
  if (!structuralProgressionAudit.passed) {
    throw new AcceptanceError("Long-form structural progression acceptance audit failed.", {
      issues: structuralProgressionAudit.issues.slice(0, 30),
      summary: structuralProgressionAudit.summary,
      phases: structuralProgressionAudit.phases,
    })
  }
  const plotExecutionAudit = auditPlotExecutionForAcceptance(auditSnapshot, options)
  if (!plotExecutionAudit.passed) {
    throw new AcceptanceError("Plot execution acceptance audit failed.", {
      issues: plotExecutionAudit.issues.slice(0, 30),
      summary: plotExecutionAudit.summary,
      chapters: plotExecutionAudit.chapters.slice(0, 8),
    })
  }
  const plotNoveltyAudit = auditPlotNoveltyForAcceptance(auditSnapshot, options)
  if (!plotNoveltyAudit.passed) {
    throw new AcceptanceError("Plot novelty acceptance audit failed.", {
      issues: plotNoveltyAudit.issues.slice(0, 30),
      summary: plotNoveltyAudit.summary,
      chapters: plotNoveltyAudit.chapters.filter((chapter) => !chapter.hasNewBodyTerms).slice(0, 8),
    })
  }
  const narrativeAudit = auditNarrativeQualityForAcceptance(auditSnapshot, options)
  if (!narrativeAudit.passed) {
    throw new AcceptanceError("Narrative quality acceptance audit failed.", {
      issues: narrativeAudit.issues.slice(0, 30),
      summary: narrativeAudit.summary,
      repeatedDialogueSamples: narrativeAudit.repeatedDialogueSamples,
    })
  }
  const proseTextureAudit = auditProseTextureForAcceptance(auditSnapshot, options)
  if (!proseTextureAudit.passed) {
    throw new AcceptanceError("Prose texture acceptance audit failed.", {
      issues: proseTextureAudit.issues.slice(0, 30),
      summary: proseTextureAudit.summary,
      chapters: proseTextureAudit.chapters.slice(0, 8),
    })
  }
  const languageCraftAudit = auditLanguageCraftForAcceptance(auditSnapshot, options)
  if (!languageCraftAudit.passed) {
    throw new AcceptanceError("Language craft acceptance audit failed.", {
      issues: languageCraftAudit.issues.slice(0, 30),
      summary: languageCraftAudit.summary,
      chapters: languageCraftAudit.chapters.filter((chapter) => !chapter.crafted).slice(0, 8),
    })
  }
  const sceneCompletenessAudit = auditSceneCompletenessForAcceptance(auditSnapshot, options)
  if (!sceneCompletenessAudit.passed) {
    throw new AcceptanceError("Scene completeness acceptance audit failed.", {
      issues: sceneCompletenessAudit.issues.slice(0, 30),
      summary: sceneCompletenessAudit.summary,
      chapters: sceneCompletenessAudit.chapters.slice(0, 8),
    })
  }
  const sceneCardCharacterAudit = auditSceneCardCharacterObligationsForAcceptance(auditSnapshot, options)
  if (!sceneCardCharacterAudit.passed) {
    throw new AcceptanceError("Scene-card character obligation acceptance audit failed.", {
      issues: sceneCardCharacterAudit.issues.slice(0, 30),
      summary: sceneCardCharacterAudit.summary,
      chapters: sceneCardCharacterAudit.chapters.slice(0, 8),
    })
  }
  const crossChapterVariationAudit = auditCrossChapterVariationForAcceptance(auditSnapshot, options)
  if (!crossChapterVariationAudit.passed) {
    throw new AcceptanceError("Cross-chapter variation acceptance audit failed.", {
      issues: crossChapterVariationAudit.issues.slice(0, 30),
      summary: crossChapterVariationAudit.summary,
      repeatedOpenings: crossChapterVariationAudit.repeatedOpenings,
      repeatedEndings: crossChapterVariationAudit.repeatedEndings,
      repeatedParagraphs: crossChapterVariationAudit.repeatedParagraphs,
    })
  }
  const characterVoiceAudit = auditCharacterVoiceForAcceptance(auditSnapshot, options)
  if (!characterVoiceAudit.passed) {
    throw new AcceptanceError("Character voice acceptance audit failed.", {
      issues: characterVoiceAudit.issues.slice(0, 30),
      summary: characterVoiceAudit.summary,
      repeatedAcrossSpeakers: characterVoiceAudit.repeatedAcrossSpeakers,
      characters: characterVoiceAudit.characters.slice(0, 8),
    })
  }
  const characterArcAudit = auditCharacterArcForAcceptance(auditSnapshot, options)
  if (!characterArcAudit.passed) {
    throw new AcceptanceError("Character arc and supporting cast acceptance audit failed.", {
      issues: characterArcAudit.issues.slice(0, 30),
      summary: characterArcAudit.summary,
      characters: characterArcAudit.characters.slice(0, 8),
    })
  }
  const relationshipArcAudit = auditRelationshipArcForAcceptance(auditSnapshot, options)
  if (!relationshipArcAudit.passed) {
    throw new AcceptanceError("Relationship arc acceptance audit failed.", {
      issues: relationshipArcAudit.issues.slice(0, 30),
      summary: relationshipArcAudit.summary,
      relationships: relationshipArcAudit.relationships.slice(0, 8),
    })
  }
  const foreshadowingAudit = auditForeshadowingPayoffForAcceptance(auditSnapshot, options)
  if (!foreshadowingAudit.passed) {
    throw new AcceptanceError("Foreshadowing payoff acceptance audit failed.", {
      issues: foreshadowingAudit.issues.slice(0, 30),
      summary: foreshadowingAudit.summary,
      entries: foreshadowingAudit.entries.slice(0, 12),
    })
  }
  const finalResolutionAudit = auditFinalResolutionForAcceptance(auditSnapshot, options)
  if (!finalResolutionAudit.passed) {
    throw new AcceptanceError("Final resolution acceptance audit failed.", {
      issues: finalResolutionAudit.issues.slice(0, 30),
      summary: finalResolutionAudit.summary,
      payoffAnchors: finalResolutionAudit.payoffAnchors,
      chapters: finalResolutionAudit.chapters.slice(0, 8),
    })
  }
  const continuityAudit = auditContinuityForAcceptance(auditSnapshot, options)
  if (!continuityAudit.passed) {
    throw new AcceptanceError("Cross-chapter continuity acceptance audit failed.", {
      issues: continuityAudit.issues.slice(0, 30),
      summary: continuityAudit.summary,
      transitions: continuityAudit.transitions.slice(0, 12),
    })
  }

  report.finalReader = {
    project,
    stats,
    totalWords,
    readableChapters,
    totalChapters,
    chapterChecks,
  }
  report.finalReaderWordCountAudit = readerWordCountAudit
  report.finalStoryFoundationAudit = storyFoundationAudit
  report.finalReaderPurityAudit = readerPurityAudit
  report.finalProductionValidationAudit = productionValidationAudit
  report.finalWorldbuildingAudit = worldbuildingAudit
  report.finalStructuralProgressionAudit = structuralProgressionAudit
  report.finalPlotExecutionAudit = plotExecutionAudit
  report.finalPlotNoveltyAudit = plotNoveltyAudit
  report.finalNarrativeAudit = narrativeAudit
  report.finalProseTextureAudit = proseTextureAudit
  report.finalLanguageCraftAudit = languageCraftAudit
  report.finalSceneCompletenessAudit = sceneCompletenessAudit
  report.finalSceneCardCharacterAudit = sceneCardCharacterAudit
  report.finalCrossChapterVariationAudit = crossChapterVariationAudit
  report.finalCharacterVoiceAudit = characterVoiceAudit
  report.finalCharacterArcAudit = characterArcAudit
  report.finalRelationshipArcAudit = relationshipArcAudit
  report.finalForeshadowingAudit = foreshadowingAudit
  report.finalResolutionAudit = finalResolutionAudit
  report.finalContinuityAudit = continuityAudit
  report.steps.push({
    step: "reader_acceptance",
    status: "passed",
    at: now(),
    totalWords,
    readableChapters,
    actualTotalWords: readerWordCountAudit.summary.actualTotalWords,
    readerWordCounts: readerWordCountAudit.summary,
    storyFoundation: storyFoundationAudit.counts,
    readerPurity: readerPurityAudit.summary,
    productionValidation: productionValidationAudit.summary,
    worldbuilding: worldbuildingAudit.summary,
    structuralProgression: structuralProgressionAudit.summary,
    plotExecution: plotExecutionAudit.summary,
    plotNovelty: plotNoveltyAudit.summary,
    narrative: narrativeAudit.summary,
    proseTexture: proseTextureAudit.summary,
    languageCraft: languageCraftAudit.summary,
    sceneCompleteness: sceneCompletenessAudit.summary,
    sceneCardCharacters: sceneCardCharacterAudit.summary,
    crossChapterVariation: crossChapterVariationAudit.summary,
    characterVoice: characterVoiceAudit.summary,
    characterArc: characterArcAudit.summary,
    relationshipArc: relationshipArcAudit.summary,
    foreshadowing: foreshadowingAudit.summary,
    finalResolution: finalResolutionAudit.summary,
    continuity: continuityAudit.summary,
  })
  await maybeWriteCheckpoint(checkpoint, "reader_acceptance_passed", {
    totalWords,
    readableChapters,
    totalChapters,
  })
  log("Reader acceptance passed.", {
    totalWords,
    readableChapters,
    totalChapters,
    actualTotalWords: readerWordCountAudit.summary.actualTotalWords,
    readerWordCounts: readerWordCountAudit.summary,
    storyFoundation: storyFoundationAudit.counts,
    readerPurity: readerPurityAudit.summary,
    productionValidation: productionValidationAudit.summary,
    worldbuilding: worldbuildingAudit.summary,
    structuralProgression: structuralProgressionAudit.summary,
    plotExecution: plotExecutionAudit.summary,
    plotNovelty: plotNoveltyAudit.summary,
    narrative: narrativeAudit.summary,
    proseTexture: proseTextureAudit.summary,
    languageCraft: languageCraftAudit.summary,
    sceneCompleteness: sceneCompletenessAudit.summary,
    crossChapterVariation: crossChapterVariationAudit.summary,
    characterVoice: characterVoiceAudit.summary,
    characterArc: characterArcAudit.summary,
    relationshipArc: relationshipArcAudit.summary,
    foreshadowing: foreshadowingAudit.summary,
    finalResolution: finalResolutionAudit.summary,
    continuity: continuityAudit.summary,
  })
  return snapshot
}

export async function writeReport(reportPath, report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
}

export async function writeAcceptanceCheckpoint(reportPath, report, checkpoint = {}) {
  const entry = {
    at: now(),
    status: report?.status || "running",
    projectId: checkpoint.projectId || report?.projectId || null,
    phase: checkpoint.phase || "checkpoint",
    ...checkpoint,
  }
  if (!Array.isArray(report.checkpoints)) {
    report.checkpoints = []
  }
  report.checkpoints.push(entry)
  report.lastCheckpoint = entry
  await writeReport(reportPath, report)
  return entry
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const report = {
    version: 1,
    status: "running",
    startedAt: now(),
    completedAt: null,
    host: os.hostname(),
    options: redactAcceptanceOptions(options),
    projectId: options.resumeProjectId || null,
    apiCalls: [],
    steps: [],
    progress: [],
    finalReader: null,
    finalReaderWordCountAudit: null,
    finalStoryFoundationAudit: null,
    finalReaderPurityAudit: null,
    finalProductionValidationAudit: null,
    finalWorldbuildingAudit: null,
    finalStructuralProgressionAudit: null,
    finalPlotExecutionAudit: null,
    finalPlotNoveltyAudit: null,
    finalNarrativeAudit: null,
    finalProseTextureAudit: null,
    finalLanguageCraftAudit: null,
    finalSceneCompletenessAudit: null,
    finalCrossChapterVariationAudit: null,
    finalCharacterVoiceAudit: null,
    finalCharacterArcAudit: null,
    finalRelationshipArcAudit: null,
    finalForeshadowingAudit: null,
    finalResolutionAudit: null,
    finalContinuityAudit: null,
    checkpoints: [],
    lastCheckpoint: null,
    error: null,
  }
  const checkpoint = async (phase, details = {}) => writeAcceptanceCheckpoint(options.reportPath, report, {
    phase,
    projectId: details.projectId || report.projectId || options.resumeProjectId || null,
    ...details,
  })

  try {
    assertLongFormTarget(options)
    const handleNovelStudioApi = await loadStudioApi()
    const api = createApi(options.rootDir, handleNovelStudioApi, report)

    log("Checking configured LLM providers.")
    const configPayload = await api("GET", "/api/llm-configs")
    const modelInfo = findConfiguredLlm(configPayload)
    assertModelConfigReady(modelInfo)
    report.steps.push({
      step: "llm_config",
      status: "passed",
      at: now(),
      activeModel: modelInfo.active?.model_name || null,
      textModel: modelInfo.textConfig?.model_name || null,
      styleModel: modelInfo.styleConfig?.model_name || null,
      routeCount: modelInfo.routes.length,
    })
    await checkpoint("llm_config_ready")
    await assertProviderHealth(api, modelInfo, report, options.resumeProjectId || null, options.providerHealthCheck)
    await checkpoint("provider_health_checked")
    const detectorSettings = await configureAigcDetector(api, options, report)
    await checkpoint("aigc_detector_ready", { provider: detectorSettings.provider })

    log("Acceptance plan is valid.", {
      rootDir: options.rootDir,
      targetWords: options.chapters * options.chapterWords,
      activeModel: modelInfo.active?.model_name,
      textModel: modelInfo.textConfig?.model_name,
      styleModel: modelInfo.styleConfig?.model_name,
      aigcDetectorProvider: detectorSettings.provider,
      autoApproveStyle: options.autoApproveStyle,
      autoApproveFoundation: options.autoApproveFoundation,
    })

    if (options.planOnly) {
      report.status = "plan_ready"
      report.completedAt = now()
      await checkpoint("plan_ready")
      log("Plan-only acceptance check completed.", { reportPath: options.reportPath })
      return
    }

    let projectId = options.resumeProjectId
    if (!projectId) {
      log("Creating real managed project through Studio API.", {
        chapters: options.chapters,
        chapterWords: options.chapterWords,
      })
      const created = await api("POST", "/api/projects", {
        title: options.title,
        idea: options.idea,
        chapters: options.chapters,
        chapterWords: options.chapterWords,
        creativeProfile: {
          genre: "Chinese long-form mystery",
          platform: "serialized web novel",
          readerPromise: "deep worldbuilding, character pressure, relationship change, foreshadowing, hooks, literary prose, and long-range continuity",
          pointOfView: "third-person limited",
          tone: "scene-first, tense, textured, non-stiff",
          naturalnessTarget: "strict",
        },
      })
      projectId = created.projectId
      report.projectId = projectId
      report.steps.push({ step: "project_created", status: "completed", at: now(), projectId })
      await checkpoint("project_created", { projectId })
    }

    if (!projectId) {
      throw new AcceptanceError("Project id is missing after project creation.")
    }

    await ensureStyleGate(api, projectId, options, report, checkpoint)
    if (options.stopAfterStyle) {
      report.status = "waiting_after_style"
      report.completedAt = now()
      await checkpoint("waiting_after_style", { projectId })
      log("Stopped after style gate by request.", { reportPath: options.reportPath, projectId })
      return
    }

    await advanceUntilPlanningReady(api, projectId, options, report, checkpoint)
    await ensureStoryFoundation(api, projectId, options, report, checkpoint)
    if (options.stopAfterFoundation) {
      report.status = "waiting_after_foundation"
      report.completedAt = now()
      await checkpoint("waiting_after_foundation", { projectId })
      log("Stopped after story foundation by request.", { reportPath: options.reportPath, projectId })
      return
    }

    await runDraftingToCompletion(api, projectId, options, report, checkpoint)
    await verifyReader(api, projectId, options, report, checkpoint)

    report.status = "passed"
    report.completedAt = now()
    await checkpoint("passed", { projectId })
    log("REAL PRODUCTION ACCEPTANCE PASSED.", { projectId, reportPath: options.reportPath })
  } catch (error) {
    report.status = "failed"
    report.completedAt = now()
    report.error = summarizeError(error)
    await checkpoint("failed", { error: report.error }).catch((writeError) => {
      console.error("Failed to write acceptance report:", writeError)
    })
    console.error(`[${now()}] REAL PRODUCTION ACCEPTANCE FAILED.`)
    console.error(JSON.stringify(report.error, null, 2))
    console.error(`Report: ${options.reportPath}`)
    process.exitCode = 1
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ""
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  await main()
}
