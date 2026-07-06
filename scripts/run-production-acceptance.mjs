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

function findConfiguredLlm(configPayload) {
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
  const styleConfig = configured.find((config) => String(config.id) === String(styleRoute?.config_id))
    || configured.find((config) => String(config.id) === String(textRoute?.config_id))
    || active
  return {
    configs,
    routes,
    configured,
    active,
    styleConfig,
  }
}

function assertModelConfigReady(modelInfo) {
  if (!modelInfo.active) {
    throw new AcceptanceError("No usable LLM config found. Add a model in the app settings before running real acceptance.", {
      configuredCount: modelInfo.configured.length,
    })
  }
  if (!modelInfo.styleConfig) {
    throw new AcceptanceError("No usable Style Evolution LLM route found.", {
      configuredCount: modelInfo.configured.length,
    })
  }
}

function buildProviderHealthTargets(modelInfo) {
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
  add("text", modelInfo.active)
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

function countMatches(text, pattern) {
  return (String(text || "").match(pattern) || []).length
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

function extractAcceptanceCharacterDossiers(snapshot) {
  const dossiers = Array.isArray(snapshot?.characters?.dossiers) ? snapshot.characters.dossiers : []
  const knownNames = extractKnownCastNames(snapshot)
  const byName = new Map()
  for (const dossier of dossiers) {
    const canonicalName = String(dossier?.canonicalName || dossier?.name || "").trim()
    if (!canonicalName) continue
    byName.set(canonicalName, {
      name: canonicalName,
      aliases: (Array.isArray(dossier?.aliases) ? dossier.aliases : []).map((alias) => String(alias || "").trim()).filter(Boolean),
      speechMarkers: (Array.isArray(dossier?.speechMarkers) ? dossier.speechMarkers : []).map((item) => String(item || "").trim()).filter(Boolean),
      behaviorHabits: (Array.isArray(dossier?.behaviorHabits) ? dossier.behaviorHabits : []).map((item) => String(item || "").trim()).filter(Boolean),
    })
  }
  for (const name of knownNames) {
    if (!byName.has(name)) {
      byName.set(name, { name, aliases: [], speechMarkers: [], behaviorHabits: [] })
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
      mentionCount: bodyMentions,
      dialogueCount: dialogueSamples.length,
      uniqueDialogueCount: uniqueDialogue.length,
      actionSignals,
      pressureSignals,
      matchedSpeechMarkers,
      matchedBehaviorHabits,
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
    },
    repeatedAcrossSpeakers: repeatedAcrossSpeakers.slice(0, 5),
    characters: characterAudits,
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
    const advanced = anchors.length > 0 && containsAnyTerm(laterBody, anchors)
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
    const wordCount = Number(chapter?.wordCount || 0)
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
    const hasHook = /[？?]|谁|却|忽然|门外|脚步|信|账|印|刀|血|名字|下一|明日|只剩|没有答|裂缝|代价|风险|线索|仍/u.test(tail)
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
    if (!hasHook) chapterIssues.push("missing chapter tail hook")
    if (castMentions.length === 0 && knownCast.length > 0) chapterIssues.push("no known cast mention")
    if (chapterIssues.length) {
      issues.push(`chapter ${chapter?.chapterNumber || "?"}: ${chapterIssues.join("; ")}`)
    }
    chapterAudits.push({
      chapterNumber: Number(chapter?.chapterNumber || 0),
      title: chapter?.title || "",
      wordCount,
      dialogueCount: dialogues.length,
      actionSignals,
      sensorySignals,
      objectSignals,
      pressureSignals,
      hookReady: hasHook,
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

export function auditProseTextureForAcceptance(snapshot, options = {}) {
  const chapters = Array.isArray(snapshot?.chapters) ? snapshot.chapters : []
  const issues = []
  const chapterAudits = []
  let dryInstructionSignals = 0
  let genericSummarySignals = 0
  let sceneRichChapters = 0
  let variedRhythmChapters = 0

  for (const chapter of chapters) {
    const body = String(chapter?.body || "")
    const paragraphs = splitBodyParagraphs(body)
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
    const variedRhythm = sentenceLengths.length >= 4
      && uniqueSentenceLengthCount >= 3
      && averageSentenceLength >= 8
      && shortSentenceRatio <= 0.35
      && longSentenceRatio <= 0.45
    if (sceneRich) sceneRichChapters += 1
    if (variedRhythm) variedRhythmChapters += 1
    dryInstructionSignals += drySignals
    genericSummarySignals += genericSignals

    const chapterIssues = []
    if (paragraphs.length < 3) chapterIssues.push(`too few prose paragraphs ${paragraphs.length}`)
    if (!sceneRich) chapterIssues.push(`thin scene texture density ${concreteDensity.toFixed(1)}`)
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
      variedRhythmChapters,
      requiredTextureChapters,
      dryInstructionSignals,
      genericSummarySignals,
    },
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
  if (hasExplicitAigcDetectorSettings(options.aigcDetector)) {
    const settings = normalizeAigcDetectorSettings(options.aigcDetector)
    await api("POST", "/api/settings/writing", {
      settings: {
        aigcDetector: settings,
      },
    })
    report.steps.push({
      step: "aigc_detector_config_saved",
      status: "completed",
      at: now(),
      settings: redactAigcDetectorOptions(settings),
    })
    log("Saved AIGC detector settings through Studio API.", redactAigcDetectorOptions(settings))
  }

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

  const leakPatterns = [
    /Quality Gate/iu,
    /Naturalness Report/iu,
    /Drafting Metadata/iu,
    /Chapter Execution Contract/iu,
    /Style Contract Freeze Gate/iu,
    /LLM REQUEST/iu,
    /AIGC Detection/iu,
    /Generation Verification Gate/iu,
  ]
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
    const leaked = leakPatterns.filter((pattern) => pattern.test(body)).map((pattern) => String(pattern))
    if (!body.trim()) {
      throw new AcceptanceError("Reader returned an empty chapter body.", { chapterNumber })
    }
    if (leaked.length > 0) {
      throw new AcceptanceError("Reader body contains non-novel production metadata.", {
        chapterNumber,
        leaked,
      })
    }
    chapterBodies.push({
      chapterNumber,
      title: chapter.title || "",
      wordCount: Number(chapter.wordCount || 0),
      body,
      publishReadiness: chapter.publishReadiness || null,
    })
    chapterChecks.push({
      chapterNumber,
      title: chapter.title || "",
      wordCount: Number(chapter.wordCount || 0),
      publishReady: chapter.publishReadiness?.ready === true,
    })
    await maybeWriteCheckpoint(checkpoint, "reader_chapter_checked", {
      chapterNumber,
      checkedChapters: chapterChecks.length,
      totalChapters,
      wordCount: Number(chapter.wordCount || 0),
      publishReady: chapter.publishReadiness?.ready === true,
    })
  }

  const auditSnapshot = {
    ...snapshot,
    chapters: chapterBodies,
  }
  const storyFoundationAudit = auditStoryFoundationForAcceptance(auditSnapshot, options)
  if (!storyFoundationAudit.passed) {
    throw new AcceptanceError("Story foundation acceptance audit failed.", {
      issues: storyFoundationAudit.issues.slice(0, 20),
      counts: storyFoundationAudit.counts,
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
  const characterVoiceAudit = auditCharacterVoiceForAcceptance(auditSnapshot, options)
  if (!characterVoiceAudit.passed) {
    throw new AcceptanceError("Character voice acceptance audit failed.", {
      issues: characterVoiceAudit.issues.slice(0, 30),
      summary: characterVoiceAudit.summary,
      repeatedAcrossSpeakers: characterVoiceAudit.repeatedAcrossSpeakers,
      characters: characterVoiceAudit.characters.slice(0, 8),
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
  report.finalStoryFoundationAudit = storyFoundationAudit
  report.finalNarrativeAudit = narrativeAudit
  report.finalProseTextureAudit = proseTextureAudit
  report.finalCharacterVoiceAudit = characterVoiceAudit
  report.finalForeshadowingAudit = foreshadowingAudit
  report.finalContinuityAudit = continuityAudit
  report.steps.push({
    step: "reader_acceptance",
    status: "passed",
    at: now(),
    totalWords,
    readableChapters,
    storyFoundation: storyFoundationAudit.counts,
    narrative: narrativeAudit.summary,
    proseTexture: proseTextureAudit.summary,
    characterVoice: characterVoiceAudit.summary,
    foreshadowing: foreshadowingAudit.summary,
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
    storyFoundation: storyFoundationAudit.counts,
    narrative: narrativeAudit.summary,
    proseTexture: proseTextureAudit.summary,
    characterVoice: characterVoiceAudit.summary,
    foreshadowing: foreshadowingAudit.summary,
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
    finalStoryFoundationAudit: null,
    finalNarrativeAudit: null,
    finalProseTextureAudit: null,
    finalCharacterVoiceAudit: null,
    finalForeshadowingAudit: null,
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
