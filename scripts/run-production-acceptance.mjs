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

class AcceptanceError extends Error {
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

async function ensureStyleGate(api, projectId, options, report) {
  let stylePayload = await api("GET", `/api/style-evolution?projectId=${encodeURIComponent(projectId)}`, {}, projectId)
  let gate = stylePayload.styleEvolution?.gate || null
  if (gate?.canProceed === true && gate?.status === "passed") {
    report.steps.push({ step: "style_gate", status: "passed_existing", at: now() })
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
  log("Style gate passed.", { version })
  return approved
}

async function advanceUntilPlanningReady(api, projectId, options, report) {
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
  }

  if (!planningReadyStages.has(progress.stage)) {
    throw new AcceptanceError("Planning did not reach chapter task generation.", {
      progress,
      steps,
      maxAdvanceSteps: options.maxAdvanceSteps,
    })
  }

  report.steps.push({ step: "planning_ready", status: "completed", at: now(), progress, advanceSteps: steps })
  log("Planning reached a drafting-ready stage.", progress)
  return status
}

async function ensureStoryFoundation(api, projectId, options, report) {
  let status = await getStatus(api, projectId)
  let readiness = productionReadinessCodes(status)

  const planningIssue = readiness.issueCodes.some((code) => String(code).startsWith("story_planning_assets"))
  if (planningIssue && options.autoRepairStoryAssets) {
    log("Repairing story foundation assets through Studio API.", readiness)
    await api("POST", "/api/production/story-assets/repair", { projectId }, projectId)
    status = await getStatus(api, projectId)
    readiness = productionReadinessCodes(status)
    report.steps.push({ step: "story_assets_repair", status: "completed", at: now(), readiness })
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
  }

  if (!readiness.canProceed || readiness.status !== "passed") {
    throw new AcceptanceError("Production readiness is still blocked before drafting.", {
      readiness,
      productionReadiness: status.productionReadiness || null,
    })
  }

  report.steps.push({ step: "production_readiness", status: "passed", at: now(), readiness })
  log("Production readiness passed.", readiness)
  return status
}

async function runDraftingToCompletion(api, projectId, options, report) {
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
  log("Drafting flow reached complete.", progress)
  return status
}

async function verifyReader(api, projectId, options, report) {
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
    chapterChecks.push({
      chapterNumber,
      title: chapter.title || "",
      wordCount: Number(chapter.wordCount || 0),
      publishReady: chapter.publishReadiness?.ready === true,
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
  report.steps.push({ step: "reader_acceptance", status: "passed", at: now(), totalWords, readableChapters })
  log("Reader acceptance passed.", { totalWords, readableChapters, totalChapters })
  return snapshot
}

async function writeReport(reportPath, report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
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
    error: null,
  }

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
    const detectorSettings = await configureAigcDetector(api, options, report)

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
      await writeReport(options.reportPath, report)
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
    }

    if (!projectId) {
      throw new AcceptanceError("Project id is missing after project creation.")
    }

    await ensureStyleGate(api, projectId, options, report)
    if (options.stopAfterStyle) {
      report.status = "waiting_after_style"
      report.completedAt = now()
      await writeReport(options.reportPath, report)
      log("Stopped after style gate by request.", { reportPath: options.reportPath, projectId })
      return
    }

    await advanceUntilPlanningReady(api, projectId, options, report)
    await ensureStoryFoundation(api, projectId, options, report)
    if (options.stopAfterFoundation) {
      report.status = "waiting_after_foundation"
      report.completedAt = now()
      await writeReport(options.reportPath, report)
      log("Stopped after story foundation by request.", { reportPath: options.reportPath, projectId })
      return
    }

    await runDraftingToCompletion(api, projectId, options, report)
    await verifyReader(api, projectId, options, report)

    report.status = "passed"
    report.completedAt = now()
    await writeReport(options.reportPath, report)
    log("REAL PRODUCTION ACCEPTANCE PASSED.", { projectId, reportPath: options.reportPath })
  } catch (error) {
    report.status = "failed"
    report.completedAt = now()
    report.error = summarizeError(error)
    await writeReport(options.reportPath, report).catch((writeError) => {
      console.error("Failed to write acceptance report:", writeError)
    })
    console.error(`[${now()}] REAL PRODUCTION ACCEPTANCE FAILED.`)
    console.error(JSON.stringify(report.error, null, 2))
    console.error(`Report: ${options.reportPath}`)
    process.exitCode = 1
  }
}

await main()
