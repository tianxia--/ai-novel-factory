import {
  deriveProjectRuntimeState,
  routeUserMessage
} from "./chunk-ZEQLUYVF.js";
import {
  ensureAutopilotJob,
  executeManualAdvanceCommand,
  executeManualInterruptCommand,
  executeManualRetryChapterCommand,
  getAutopilotJob,
  isAutopilotRunning,
  markAutopilot,
  restoreAutopilotJobs,
  scheduleAutopilotRestore,
  stopAutopilotJob
} from "./chunk-MGJCPGOO.js";
import "./chunk-UIQAXZB3.js";
import "./chunk-SDIPDDNZ.js";
import {
  buildSuperGraphIndex,
  createManagedAutonomousProject,
  deleteManagedAutonomousProject,
  formatStatus,
  getPublicProjectEnvStatus,
  initAutonomousProject,
  listAutonomousProjects,
  loadAutonomousState,
  prepareCoverGeneration,
  resolveManagedProjectRoot,
  runMultiAgentDiscussion,
  saveAutonomousState,
  superGraphFromDbRows,
  syncCurrentContextPacketFile,
  syncManagedProjectState,
  validateSuperGraph
} from "./chunk-MZ23773U.js";
import {
  acceptStyleEvolutionCandidate,
  appendStyleEvolutionCandidate,
  appendStyleLoopRunLedger,
  approveStyleEvolutionSample,
  buildStyleContractExtractionPrompt,
  buildStyleEvolutionCandidatePrompt,
  buildStyleEvolutionCritiquePrompt,
  buildStyleEvolutionEvaluationPrompt,
  buildStyleEvolutionRefinement,
  buildStyleEvolutionRefinementOnlyPrompt,
  buildStyleFreezeAdvicePrompt,
  buildStyleGenerationVerification,
  createContinuityContract,
  createStyleLoopRuntimeRecord,
  evaluateChapterStyleConformanceDrift,
  evaluateProductionReadiness,
  evaluateStyleEvolutionCandidate,
  getCachedActiveLlmConfig,
  initializeStyleEvolution,
  loadActiveLlmConfig,
  loadApprovedWritingStyleContext,
  loadLlmConfigForCapability,
  loadProductionWritingResources,
  loadStyleEvolution,
  normalizeAigcWritingDetectionReport,
  normalizeStyleAigcSignal,
  parseStyleContractFromText,
  parseStyleEvolutionCritiqueFromText,
  parseStyleEvolutionEvaluationFromText,
  parseStyleEvolutionRefinementFromText,
  parseStyleFreezeAdviceFromText,
  persistStyleEvolutionRuntimeState,
  persistStyleLoopRuntime,
  rejectStyleEvolutionSample,
  repairAigcHighRiskDraft,
  requestLlmTextCompletion,
  testProviderConnectivity,
  writeProductionStoryBibleAssets
} from "./chunk-SHVFZGMN.js";
import {
  detectAigcSegments,
  detectAigcText,
  getAigcDetectorConfig
} from "./chunk-QJPQANB5.js";
import {
  evaluateKnowledgeBenchmark,
  retrieveKnowledge
} from "./chunk-E4OGC67J.js";
import "./chunk-4A6LNSPI.js";
import {
  makeRunId,
  withFactoryDb
} from "./chunk-JD3MNOTZ.js";
import {
  createStatusMessage,
  createToolMessage,
  createUserMessage
} from "./chunk-GZKJNHMN.js";

// src/studio-server.ts
import fs from "fs/promises";
import path from "path";
import http from "http";
import { createHash } from "crypto";
var PRODUCTION_DEFAULT_TOTAL_CHAPTERS = 40;
var PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET = 3e3;
function getPublicProjectEnvStatus2(rootDir = process.cwd()) {
  const status = getPublicProjectEnvStatus(rootDir);
  const activeLlm = getCachedActiveLlmConfig();
  if (activeLlm) {
    status.configured = true;
    status.resolved = {
      baseUrl: activeLlm.provider.baseUrl,
      modelName: activeLlm.provider.modelName,
      apiKeyPresent: true
    };
    status.missing = status.missing.filter(
      (k) => k !== "LLM_API_KEY" && k !== "LLM_BASE_URL" && k !== "LLM_MODEL_ID"
    );
  }
  return status;
}
function mergeStyleEvaluationWithAigc(evaluation, aigcSignal) {
  if (!evaluation || !aigcSignal) {
    return evaluation;
  }
  return {
    ...evaluation,
    aigc: aigcSignal
  };
}
function buildStyleFreezerGateRecord(freezeAdvice, fallback) {
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (freezeAdvice) {
    return {
      source: "llm_critic",
      verdict: freezeAdvice.freezeVerdict,
      summary: freezeAdvice.freezeSummary,
      blockingReasons: freezeAdvice.blockingReasons,
      checkedAt
    };
  }
  const blockingReasons = [
    fallback.verification.status !== "passed" ? "Generation Verification Gate \u5C1A\u672A\u901A\u8FC7\u3002" : ""
  ].filter(Boolean);
  const cautionReasons = [
    Number(fallback.evaluation?.scores?.overall || 0) < 8.6 ? "\u7EFC\u5408\u8BC4\u5206\u5C1A\u672A\u8FBE\u5230\u9ED8\u8BA4\u51BB\u7ED3\u9608\u503C\uFF0C\u5EFA\u8BAE\u7528\u6237\u786E\u8BA4\u524D\u7EE7\u7EED\u5BA1\u9605\u3002" : "",
    fallback.evaluation?.verdict !== "approve" ? "Evaluator \u5C1A\u672A\u5224\u5B9A\u5F53\u524D\u6837\u6BB5\u53EF\u76F4\u63A5\u51BB\u7ED3\uFF0C\u5EFA\u8BAE\u7528\u6237\u786E\u8BA4\u524D\u7EE7\u7EED\u5BA1\u9605\u3002" : ""
  ].filter(Boolean);
  return {
    source: "heuristic",
    verdict: blockingReasons.length ? "continue" : "ready",
    summary: blockingReasons.length ? "\u672C\u8F6E\u7F3A\u5C11 LLM Freezer \u7ED3\u6784\u5316\u653E\u884C\uFF0C\u7EE7\u7EED\u6536\u7D27\u540E\u518D\u8FDB\u5165\u51BB\u7ED3\u786E\u8BA4\u3002" : cautionReasons.length ? `\u672C\u8F6E\u901A\u8FC7 Generation Verification Gate\uFF0C\u53EF\u7531\u7528\u6237\u786E\u8BA4\u662F\u5426\u51BB\u7ED3\uFF1B${cautionReasons.join(" ")}` : "\u672C\u8F6E\u901A\u8FC7\u672C\u5730 Freezer \u515C\u5E95\u68C0\u67E5\uFF0C\u53EF\u4EE5\u8FDB\u5165\u51BB\u7ED3\u786E\u8BA4\u3002",
    blockingReasons: blockingReasons.length ? blockingReasons : cautionReasons,
    checkedAt
  };
}
function reinforceRefinementWithAigc(refinement, aigcSignal) {
  if (aigcSignal?.status !== "blocked") {
    return refinement;
  }
  return {
    ...refinement,
    summary: `${refinement.summary} \u5F53\u524D\u8FD8\u9700\u8981\u7EE7\u7EED\u538B\u4F4E AI \u8154\u4E0E\u6A21\u677F\u5316\u8868\u8FBE\u3002`.trim(),
    promptAdjustments: [
      .../* @__PURE__ */ new Set([
        ...refinement.promptAdjustments || [],
        "\u51CF\u5C11\u89E3\u91CA\u6027\u603B\u7ED3\u548C\u6A21\u677F\u5316\u60AC\u5FF5\uFF0C\u8BA9\u52A8\u4F5C\u3001\u7269\u4EF6\u3001\u505C\u987F\u548C\u5173\u7CFB\u51B2\u7A81\u627F\u62C5\u4FE1\u606F\u63A8\u8FDB\u3002",
        "\u907F\u514D\u5747\u5300\u5DE5\u6574\u7684 AI \u8154\u53E5\u7FA4\uFF0C\u4FDD\u7559\u66F4\u81EA\u7136\u7684\u8F7B\u91CD\u53D8\u5316\u4E0E\u5C40\u90E8\u7C97\u7C9D\u611F\u3002"
      ])
    ],
    contractAdjustments: [
      .../* @__PURE__ */ new Set([
        ...refinement.contractAdjustments || [],
        "\u628A\u2018\u907F\u514D AI \u8154 / \u6A21\u677F\u8154 / \u89E3\u91CA\u8154\u2019\u5199\u5165 forbidden patterns \u4E0E\u7AE0\u8282\u7EE7\u627F\u89C4\u5219\u3002"
      ])
    ]
  };
}
function isStyleEvaluatorDirectApproval(input) {
  const overall = Number(input.evaluation?.scores?.overall || 0);
  const forbiddenHits = input.evaluation?.forbiddenHits?.length || 0;
  return Boolean(
    input.evaluation?.source === "llm_critic" && input.evaluation.verdict === "approve" && input.verification.status === "passed" && overall >= Number(input.retryPolicy.approvalScoreThreshold || 8.6) && forbiddenHits <= Math.max(0, Number(input.retryPolicy.maxForbiddenHitCount || 1)) && input.totalRounds >= Math.max(1, Number(input.retryPolicy.approvalMinRounds || 2))
  );
}
function buildEvaluatorApprovedRefinement(input) {
  const promptAdjustments = input.evaluation.nextFocus?.length ? input.evaluation.nextFocus : ["\u4FDD\u6301 evaluator \u5DF2\u786E\u8BA4\u7684\u53D9\u4E8B\u58F0\u97F3\u3001\u8282\u594F\u548C\u4EBA\u7269\u533A\u5206\u3002"];
  const contractAdjustments = [
    ...input.evaluation.strengths.slice(0, 3),
    ...input.evaluation.deviations.slice(0, 2).map((item) => `\u51BB\u7ED3\u540E\u7EE7\u7EED\u89C4\u907F\uFF1A${item}`)
  ].filter(Boolean);
  return reinforceRefinementWithAigc({
    source: "llm_critic",
    summary: "Evaluator \u5DF2\u5224\u5B9A\u5F53\u524D\u6837\u6BB5\u53EF\u8FDB\u5165\u51BB\u7ED3\u786E\u8BA4\uFF0C\u8DF3\u8FC7\u989D\u5916 refiner \u8BF7\u6C42\u4EE5\u907F\u514D\u8FBE\u6807\u540E\u7EE7\u7EED\u6D88\u8017\u6A21\u578B\u8C03\u7528\u3002",
    promptAdjustments,
    contractAdjustments,
    nextPrompt: input.prompt
  }, input.aigcSignal);
}
async function detectStyleAigcSignal(sample, config, context) {
  const diagnostics = {
    urlConfigured: Boolean(config.url?.trim()),
    context
  };
  try {
    const result = await detectAigcSegments(sample, config);
    return normalizeStyleAigcSignal(result, diagnostics);
  } catch (error) {
    const fallback = {
      ok: false,
      provider: config.provider ?? "disabled",
      status: "unavailable",
      score: null,
      confidence: null,
      threshold: config.threshold ?? 0.8,
      totalSegments: 0,
      highRiskSegments: [],
      segments: [],
      reason: `AIGC detection failed: ${error instanceof Error ? error.message : String(error)}`
    };
    return normalizeStyleAigcSignal(fallback, { ...diagnostics, error });
  }
}
function redactLlmConfig(config) {
  return {
    ...config,
    api_key: config.api_key ? "[configured]" : "",
    api_key_configured: Boolean(config.api_key)
  };
}
function redactLlmConfigs(configs) {
  return configs.map((config) => redactLlmConfig(config));
}
function redactLlmRoutes(routes) {
  return routes.map((route) => ({
    capability: route.capability,
    config_id: route.config_id,
    name: route.name,
    base_url: route.base_url,
    model_name: route.model_name,
    api_mode: route.api_mode || "chat",
    updated_at: route.updated_at
  }));
}
function normalizeLlmApiMode(value) {
  return String(value || "chat").trim().toLowerCase() === "responses" ? "responses" : "chat";
}
async function loadStyleEvolutionLlmConfig(rootDir) {
  return await loadLlmConfigForCapability(rootDir, "style_evolution") || await loadLlmConfigForCapability(rootDir, "text");
}
var DRAFT_SUBCALL_ROLE_VALUES = ["plot", "narration", "dialogue", "character_action", "continuity", "assembly"];
function normalizeDraftSubcallRoles(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((role) => typeof role === "string").map((role) => role.trim()).filter((role) => DRAFT_SUBCALL_ROLE_VALUES.includes(role)))];
}
function parseDraftSubcallRolesSetting(value) {
  return normalizeDraftSubcallRoles(value ? value.split(",") : []);
}
function normalizeAigcDetectorProviderSetting(value) {
  return value === "local-heuristic" || value === "generic-json" || value === "gradio-queue" || value === "disabled" ? value : "local-heuristic";
}
function readAigcDetectorSettingsFromDb(db) {
  const readNumber = (key, fallback) => {
    const rawValue = db.getSystemSetting(key);
    if (rawValue === null || rawValue === void 0 || rawValue.trim() === "") {
      return fallback;
    }
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : fallback;
  };
  return {
    provider: normalizeAigcDetectorProviderSetting(db.getSystemSetting("aigcDetectorProvider")),
    url: db.getSystemSetting("aigcDetectorUrl") || "",
    tokenConfigured: Boolean(db.getSystemSetting("aigcDetectorToken")),
    timeoutMs: readNumber("aigcDetectorTimeoutMs", 3e4),
    threshold: readNumber("aigcDetectorThreshold", 0.8),
    requestTextField: db.getSystemSetting("aigcDetectorRequestTextField") || "",
    headersJson: db.getSystemSetting("aigcDetectorHeadersJson") || "",
    segmentMaxChars: readNumber("aigcDetectorSegmentMaxChars", 900),
    segmentMinChars: readNumber("aigcDetectorSegmentMinChars", 180),
    gradioFnIndex: db.getSystemSetting("aigcDetectorGradioFnIndex") || "",
    gradioSessionHashConfigured: Boolean(db.getSystemSetting("aigcDetectorGradioSessionHash")),
    gradioJoinUrl: db.getSystemSetting("aigcDetectorGradioJoinUrl") || "",
    gradioDataUrl: db.getSystemSetting("aigcDetectorGradioDataUrl") || "",
    gradioSkipJoin: db.getSystemSetting("aigcDetectorGradioSkipJoin") === "1",
    gradioInputsJson: db.getSystemSetting("aigcDetectorGradioInputsJson") || ""
  };
}
function writeAigcDetectorSettingsToDb(db, settings) {
  const detector = settings.aigcDetector && typeof settings.aigcDetector === "object" && !Array.isArray(settings.aigcDetector) ? settings.aigcDetector : null;
  if (!detector) return;
  const setString = (key, value) => {
    if (typeof value === "string") {
      db.setSystemSetting(key, value.trim());
    }
  };
  const setNumber = (key, value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      db.setSystemSetting(key, String(value));
    } else if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      db.setSystemSetting(key, String(Number(value)));
    }
  };
  const setSecret = (key, value) => {
    if (typeof value === "string" && value !== "[configured]") {
      db.setSystemSetting(key, value.trim());
    }
  };
  db.setSystemSetting("aigcDetectorProvider", normalizeAigcDetectorProviderSetting(detector.provider));
  setString("aigcDetectorUrl", detector.url);
  setSecret("aigcDetectorToken", detector.token);
  setNumber("aigcDetectorTimeoutMs", detector.timeoutMs);
  setNumber("aigcDetectorThreshold", detector.threshold);
  setString("aigcDetectorRequestTextField", detector.requestTextField);
  setString("aigcDetectorHeadersJson", detector.headersJson);
  setNumber("aigcDetectorSegmentMaxChars", detector.segmentMaxChars);
  setNumber("aigcDetectorSegmentMinChars", detector.segmentMinChars);
  setNumber("aigcDetectorGradioFnIndex", detector.gradioFnIndex);
  setSecret("aigcDetectorGradioSessionHash", detector.gradioSessionHash);
  setString("aigcDetectorGradioJoinUrl", detector.gradioJoinUrl);
  setString("aigcDetectorGradioDataUrl", detector.gradioDataUrl);
  if (typeof detector.gradioSkipJoin === "boolean") {
    db.setSystemSetting("aigcDetectorGradioSkipJoin", detector.gradioSkipJoin ? "1" : "0");
  }
  setString("aigcDetectorGradioInputsJson", detector.gradioInputsJson);
}
function resolveStyleLoopIterations(value, fallback) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(8, parsed));
}
function resolveStyleCandidateCount(value, fallback) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(4, parsed));
}
function normalizeStylePreviewText(value) {
  return typeof value === "string" ? value.trim() : "";
}
function buildLocalFallbackStyleContract(sample, prompt = "") {
  const shortSample = sample.replace(/\s+/g, " ").trim().slice(0, 120);
  const voice = prompt.match(/克制|冷感|轻松|幽默|热血|悬疑|古风|白描/u)?.[0];
  return {
    voice: voice ? `${voice}\uFF0C\u4EE5\u7528\u6237\u786E\u8BA4\u6837\u6BB5\u4E3A\u6700\u9AD8\u5199\u6CD5\u53C2\u7167\u3002` : "\u4EE5\u7528\u6237\u786E\u8BA4\u6837\u6BB5\u4E3A\u6700\u9AD8\u5199\u6CD5\u53C2\u7167\u3002",
    sentenceRhythm: "\u4FDD\u6301\u6837\u6BB5\u4E2D\u7684\u53E5\u957F\u3001\u505C\u987F\u3001\u52A8\u4F5C\u5BC6\u5EA6\u548C\u60C5\u7EEA\u7559\u767D\u3002",
    dialogueRules: ["\u5BF9\u767D\u5FC5\u987B\u670D\u52A1\u5173\u7CFB\u538B\u529B\u548C\u5F53\u524D\u5229\u76CA\uFF0C\u4E0D\u5199\u540C\u8D28\u5316\u89E3\u91CA\u8154\u3002"],
    descriptionRules: ["\u63CF\u5199\u5148\u7ED9\u7269\u4EF6\u3001\u52A8\u4F5C\u3001\u58F0\u97F3\u3001\u6C14\u5473\u548C\u8EAB\u4F53\u53CD\u5E94\uFF0C\u518D\u7ED9\u5224\u65AD\u3002"],
    emotionRules: ["\u60C5\u7EEA\u901A\u8FC7\u9009\u62E9\u3001\u505C\u987F\u3001\u52A8\u4F5C\u548C\u7EC6\u8282\u5916\u5316\uFF0C\u51CF\u5C11\u76F4\u63A5\u8BF4\u660E\u3002"],
    pacingRules: ["\u6BCF\u4E2A\u6837\u6BB5\u90FD\u8981\u6709\u538B\u529B\u8FDB\u5165\u3001\u9009\u62E9\u63A8\u8FDB\u548C\u4F59\u6CE2\u94A9\u5B50\u3002"],
    povRules: ["\u4FDD\u6301\u7A33\u5B9A\u89C6\u89D2\uFF0C\u4E0D\u8D8A\u6743\u6CC4\u9732\u672A\u5230\u573A\u89D2\u8272\u6216\u672A\u6765\u4FE1\u606F\u3002"],
    openingRules: ["\u5F00\u573A\u4F18\u5148\u843D\u5728\u5177\u4F53\u573A\u666F\u538B\u529B\u4E0A\u3002"],
    endingHookRules: ["\u7ED3\u5C3E\u7559\u4E0B\u53EF\u8FFD\u8E2A\u7684\u95EE\u9898\u3001\u5173\u7CFB\u88C2\u7F1D\u6216\u7EBF\u7D22\u3002"],
    forbiddenPatterns: ["\u4E0D\u8981\u603B\u7ED3\u5F0F\u5347\u534E", "\u4E0D\u8981\u6A21\u677F\u5316\u8F6C\u6298\u8BCD", "\u4E0D\u8981\u89E3\u91CA\u521B\u4F5C\u610F\u56FE"],
    positiveExamples: shortSample ? [shortSample] : [],
    negativeExamples: []
  };
}
function isOpenStudioStyleEntry(entry, rejectedVersion) {
  if (!entry) return false;
  if (entry.userDecision === "accepted") return false;
  if (entry.userDecision === "superseded") return false;
  if (rejectedVersion && entry.version === rejectedVersion) return false;
  return true;
}
function studioStyleEntryVerification(entry) {
  if (!entry) return buildStyleGenerationVerification({});
  return entry.verification || buildStyleGenerationVerification({
    evaluation: entry.evaluation,
    version: entry.version,
    checkedAt: entry.createdAt
  });
}
function hasStudioStyleEntryEvaluation(entry) {
  return Boolean(entry?.evaluation || entry?.verification);
}
function assertFreezableStudioStyleEntry(input) {
  if (!input.entry) {
    throw new Error("style_candidate_not_found");
  }
  if (!isOpenStudioStyleEntry(input.entry, input.rejectedVersion)) {
    throw new Error("style_candidate_rejected");
  }
  const verification = studioStyleEntryVerification(input.entry);
  if (verification.status === "blocked") {
    throw new Error("style_generation_verification_blocked");
  }
  if (hasStudioStyleEntryEvaluation(input.entry) && verification.status !== "passed") {
    throw new Error("style_candidate_not_verified");
  }
  if (input.entry.userDecision !== "accepted_for_freeze") {
    throw new Error("style_candidate_not_user_accepted");
  }
}
async function readStyleEvolutionAssetSnapshot(projectRoot) {
  const styleRoot = path.join(projectRoot, ".ai-novel", "style");
  const evolutionRoot = path.join(styleRoot, "evolution");
  const readAsset = async (assetPath) => {
    try {
      const content = await fs.readFile(assetPath, "utf8");
      const trimmed = content.trim();
      return {
        path: path.relative(projectRoot, assetPath),
        exists: true,
        chars: trimmed.length,
        preview: trimmed.slice(0, 420)
      };
    } catch {
      return {
        path: path.relative(projectRoot, assetPath),
        exists: false,
        chars: 0,
        preview: ""
      };
    }
  };
  return {
    freezePackage: {
      approvedSample: await readAsset(path.join(evolutionRoot, "user-approved-sample.md")),
      freezeLedger: await readAsset(path.join(evolutionRoot, "style-freeze-ledger.json")),
      loopRuntime: await readAsset(path.join(evolutionRoot, "style-loop-runtime.json")),
      loopRuns: await readAsset(path.join(evolutionRoot, "style-loop-runs.jsonl"))
    },
    chapterInheritance: {
      rulebook: await readAsset(path.join(styleRoot, "rulebook.md")),
      references: await readAsset(path.join(styleRoot, "references.md")),
      antiPatterns: await readAsset(path.join(styleRoot, "anti-patterns.md"))
    }
  };
}
async function buildStyleEvolutionWorkspacePayload(rootDir, context, state) {
  const [styleEvolution, styleEvolutionAssets, workspacePayload] = await Promise.all([
    loadStyleEvolution(context.projectRoot),
    readStyleEvolutionAssetSnapshot(context.projectRoot),
    createWorkspacePayload(context.projectRoot, state ?? null, {
      rootDir,
      projectId: context.projectId,
      includeTranscript: false,
      compactPayload: true
    })
  ]);
  return {
    styleEvolution,
    styleEvolutionAssets,
    projectRuntime: workspacePayload.projectRuntime,
    productionReadiness: workspacePayload.productionReadiness,
    factorySnapshot: workspacePayload.factorySnapshot,
    snapshotVersion: workspacePayload.snapshotVersion
  };
}
async function buildStyleEvolutionWorkspacePayloadSafe(rootDir, context, state) {
  try {
    return await buildStyleEvolutionWorkspacePayload(rootDir, context, state);
  } catch (error) {
    console.warn("Style evolution workspace snapshot failed; returning minimal style state.", error);
    const [styleEvolution, styleEvolutionAssets] = await Promise.all([
      loadStyleEvolution(context.projectRoot).catch(() => null),
      readStyleEvolutionAssetSnapshot(context.projectRoot).catch(() => null)
    ]);
    return {
      styleEvolution,
      styleEvolutionAssets,
      projectRuntime: null,
      productionReadiness: null,
      factorySnapshot: null,
      snapshotVersion: null
    };
  }
}
async function buildStyleFreezePreview(input) {
  const currentStyleEvolution = await loadStyleEvolution(input.projectRoot);
  const history = Array.isArray(currentStyleEvolution.contract.evolutionHistory) ? currentStyleEvolution.contract.evolutionHistory : [];
  const selected = Number.isFinite(input.version) ? history.find((entry) => entry.version === input.version) : history.at(-1);
  if (history.length > 0) {
    assertFreezableStudioStyleEntry({
      entry: selected,
      rejectedVersion: currentStyleEvolution.contract.approval?.status === "rejected" ? currentStyleEvolution.contract.approval.rejectedVersion : void 0
    });
  }
  const sampleForExtraction = normalizeStylePreviewText(input.sample) || selected?.sample || currentStyleEvolution.contract.approvedSample || "";
  if (!sampleForExtraction.trim()) {
    throw new Error("style_freeze_preview_requires_sample");
  }
  const promptForExtraction = selected?.prompt || currentStyleEvolution.contract.userStylePrompt || currentStyleEvolution.contract.seedPrompt || "";
  let styleContract = buildLocalFallbackStyleContract(sampleForExtraction, promptForExtraction);
  let contractExtractionSource = "local_fallback";
  let freezeAdviceSource = "local_fallback";
  const fallbackReasons = [];
  let freezeAdvice = null;
  const frozenBasePrompt = normalizeStylePreviewText(input.frozenBasePrompt) || normalizeStylePreviewText(selected?.refinement?.nextPrompt) || currentStyleEvolution.contract.frozenBasePrompt || promptForExtraction;
  const textConfig = await loadStyleEvolutionLlmConfig(input.rootDir);
  const apiKey = textConfig?._dbApiKey || "";
  if (textConfig && apiKey) {
    try {
      const extractionPrompt = buildStyleContractExtractionPrompt({
        sample: sampleForExtraction,
        prompt: promptForExtraction,
        userStylePrompt: currentStyleEvolution.contract.userStylePrompt,
        referenceText: currentStyleEvolution.contract.referenceText,
        referenceWorks: currentStyleEvolution.contract.referenceWorks,
        desiredVibes: currentStyleEvolution.contract.desiredVibes,
        seedForbiddenPatterns: currentStyleEvolution.contract.seedForbiddenPatterns
      });
      const rawContract = await requestLlmTextCompletion({
        baseUrl: textConfig.provider.baseUrl,
        apiKey,
        modelName: textConfig.provider.modelName,
        apiMode: textConfig.provider.apiMode,
        timeoutMs: textConfig.provider.timeoutMs,
        temperature: 0.1,
        maxTokens: 1600,
        messages: [
          { role: "system", content: extractionPrompt.system },
          { role: "user", content: extractionPrompt.user }
        ]
      });
      const parsedContract = parseStyleContractFromText(rawContract);
      if (parsedContract) {
        styleContract = parsedContract;
        contractExtractionSource = "llm_critic";
      } else {
        fallbackReasons.push("style_contract_parse_failed");
      }
    } catch (error) {
      fallbackReasons.push(`style_contract_extraction_failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 360));
      console.warn("Style freeze preview contract extraction failed; falling back to deterministic contract.", error);
    }
    try {
      const freezePrompt = buildStyleFreezeAdvicePrompt({
        sample: sampleForExtraction,
        prompt: promptForExtraction,
        userStylePrompt: currentStyleEvolution.contract.userStylePrompt,
        referenceText: currentStyleEvolution.contract.referenceText,
        referenceWorks: currentStyleEvolution.contract.referenceWorks,
        desiredVibes: currentStyleEvolution.contract.desiredVibes,
        seedForbiddenPatterns: currentStyleEvolution.contract.seedForbiddenPatterns,
        evaluation: selected?.evaluation,
        refinement: selected?.refinement
      });
      const rawFreezeAdvice = await requestLlmTextCompletion({
        baseUrl: textConfig.provider.baseUrl,
        apiKey,
        modelName: textConfig.provider.modelName,
        apiMode: textConfig.provider.apiMode,
        timeoutMs: textConfig.provider.timeoutMs,
        temperature: 0.1,
        maxTokens: 1200,
        messages: [
          { role: "system", content: freezePrompt.system },
          { role: "user", content: freezePrompt.user }
        ]
      });
      freezeAdvice = parseStyleFreezeAdviceFromText(rawFreezeAdvice);
      if (freezeAdvice) {
        freezeAdviceSource = "llm_critic";
      } else {
        fallbackReasons.push("style_freeze_advice_parse_failed");
      }
    } catch (error) {
      fallbackReasons.push(`style_freeze_advice_failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 360));
      console.warn("Style freeze preview advice extraction failed; continuing with local fallback.", error);
    }
  } else {
    fallbackReasons.push(textConfig ? "style_freeze_preview_api_key_missing" : "style_freeze_preview_model_config_missing");
  }
  const mergedAntiPatterns = [
    ...Array.isArray(input.antiPatterns) ? input.antiPatterns : [],
    ...styleContract.forbiddenPatterns || [],
    ...freezeAdvice?.forbiddenPatterns || []
  ].filter(Boolean);
  const uniqueAntiPatterns = [...new Set(mergedAntiPatterns)];
  const positiveExamples = [.../* @__PURE__ */ new Set([
    ...styleContract.positiveExamples || [],
    ...freezeAdvice?.positiveExamples || []
  ])];
  const inheritedRules = [.../* @__PURE__ */ new Set([
    ...freezeAdvice?.inheritedRules || [],
    "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F\u7528\u6237\u51BB\u7ED3\u540E\u7684 base writing prompt\u3002",
    "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F style contract \u4E2D\u7684 voice\u3001\u8282\u594F\u3001\u5BF9\u767D\u4E0E\u7981\u5FCC\u7EA6\u675F\u3002",
    "\u6B63\u6587\u751F\u4EA7\u4E0D\u5F97\u7ED5\u8FC7\u5DF2\u51BB\u7ED3\u6837\u6BB5\u91CD\u65B0\u81EA\u7531\u53D1\u6325\u3002"
  ])];
  const freezeSummary = freezeAdvice?.freezeSummary || currentStyleEvolution.contract.approval?.freezeSummary || (selected?.readyReasons?.length ? `\u5982\u679C\u73B0\u5728\u51BB\u7ED3\uFF0C\u5C06\u4EE5 v${selected.version} \u4F5C\u4E3A\u5168\u4E66\u7EDF\u4E00\u5199\u6CD5\u5408\u540C\uFF1A${selected.readyReasons.join(" ")}` : selected?.version ? `\u5982\u679C\u73B0\u5728\u51BB\u7ED3\uFF0C\u5C06\u4EE5 v${selected.version} \u4F5C\u4E3A\u5168\u4E66\u7EDF\u4E00\u5199\u6CD5\u5408\u540C\u3002` : "\u5982\u679C\u73B0\u5728\u51BB\u7ED3\uFF0C\u5C06\u6309\u5F53\u524D\u6837\u6BB5\u51BB\u7ED3\u4E3A\u5168\u4E66\u7EDF\u4E00\u5199\u6CD5\u5408\u540C\u3002");
  const previewVerification = buildStyleGenerationVerification({
    evaluation: selected?.evaluation,
    version: selected?.version,
    checkedAt: selected?.createdAt
  });
  const freezer = buildStyleFreezerGateRecord(freezeAdvice, {
    evaluation: selected?.evaluation,
    verification: previewVerification
  });
  return {
    version: selected?.version || null,
    sample: sampleForExtraction,
    frozenBasePrompt,
    freezeSummary,
    styleContract,
    antiPatterns: uniqueAntiPatterns,
    positiveExamples,
    inheritedArtifacts: ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"],
    inheritedRules,
    evaluation: selected?.evaluation || null,
    refinement: selected?.refinement || null,
    freezer,
    llmFallbackUsed: contractExtractionSource !== "llm_critic" || freezeAdviceSource !== "llm_critic",
    fallbackReasons: [...new Set(fallbackReasons.filter(Boolean))],
    contractExtractionSource,
    freezeAdviceSource,
    contractAdjustments: freezeAdvice?.contractAdjustments || selected?.refinement?.contractAdjustments || [],
    approvalScope: "whole_book"
  };
}
async function runStyleEvolutionLoop(options) {
  let styleEvolution = await loadStyleEvolution(options.projectRoot);
  const iterations = [];
  const loopRuntime = createStyleLoopRuntimeRecord({
    projectTitle: options.projectTitle,
    idea: options.idea,
    userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
    referenceText: options.referenceText || styleEvolution.contract.referenceText,
    referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
    desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
    seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
    iterationFeedback: options.iterationFeedback,
    requestedIterations: options.maxIterations
  });
  await persistStyleLoopRuntime(options.projectRoot, loopRuntime);
  await persistStyleEvolutionRuntimeState(options.projectRoot, {
    lastRunId: loopRuntime.runId,
    lastRunStatus: "running"
  });
  const retryPolicy = styleEvolution.contract.retryPolicy || {};
  const approvalThreshold = Number(retryPolicy.approvalScoreThreshold || 8.6);
  const approvalMinRounds = Math.max(1, Number(retryPolicy.approvalMinRounds || 2));
  const maxForbiddenHitCount = Math.max(0, Number(retryPolicy.maxForbiddenHitCount || 1));
  let stopReason = "max_iterations_reached";
  for (let iteration = 0; iteration < options.maxIterations; iteration += 1) {
    const latest = Array.isArray(styleEvolution.contract.evolutionHistory) ? styleEvolution.contract.evolutionHistory.at(-1) : null;
    const carriedFeedback = [
      options.iterationFeedback,
      styleEvolution.contract.approval?.status === "rejected" && styleEvolution.contract.approval?.rejectionReason ? `\u7528\u6237\u521A\u521A\u62D2\u7EDD\u4E0A\u4E00\u8F6E\uFF0C\u5FC5\u987B\u4FEE\u6B63\uFF1A${styleEvolution.contract.approval.rejectionReason}` : "",
      latest?.rejectionReason ? `\u4E0A\u4E00\u8F6E\u88AB\u7528\u6237\u9000\u56DE\uFF0C\u539F\u56E0\uFF1A${latest.rejectionReason}` : ""
    ].filter(Boolean).join("\n");
    const promptBundle = buildStyleEvolutionCandidatePrompt({
      projectTitle: options.projectTitle,
      idea: options.idea,
      userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
      referenceText: options.referenceText || styleEvolution.contract.referenceText,
      referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
      desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
      seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
      seedPrompt: latest?.refinement?.nextPrompt || styleEvolution.contract.frozenBasePrompt || styleEvolution.contract.seedPrompt,
      priorSample: latest?.sample,
      iterationFeedback: carriedFeedback
    });
    const runtimeIteration = {
      iteration: iteration + 1,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      seedPrompt: latest?.refinement?.nextPrompt || styleEvolution.contract.frozenBasePrompt || styleEvolution.contract.seedPrompt,
      prompt: promptBundle.prompt,
      stage: "generated"
    };
    const generatedCandidates = [];
    for (let candidateIndex = 0; candidateIndex < options.candidateCount; candidateIndex += 1) {
      const sample2 = await requestLlmTextCompletion({
        baseUrl: options.textConfig.provider.baseUrl,
        apiKey: options.apiKey,
        modelName: options.textConfig.provider.modelName,
        apiMode: options.textConfig.provider.apiMode,
        timeoutMs: options.textConfig.provider.timeoutMs,
        temperature: Math.max(0.3, options.textConfig.provider.temperature || 0.8) + candidateIndex * 0.1,
        maxTokens: 1200,
        messages: [
          { role: "system", content: promptBundle.system },
          { role: "user", content: `${promptBundle.user}

\u5019\u9009\u7F16\u53F7\uFF1A${candidateIndex + 1}/${options.candidateCount}\u3002\u8BF7\u4FDD\u6301\u540C\u4E00\u5199\u6CD5\u76EE\u6807\uFF0C\u4F46\u5C1D\u8BD5\u4E0D\u540C\u7684\u843D\u70B9\u7EC4\u7EC7\u3002 ` }
        ]
      });
      if (!sample2.trim()) {
        throw new Error("style_candidate_empty_response");
      }
      generatedCandidates.push({
        candidateIndex: candidateIndex + 1,
        sample: sample2
      });
    }
    const candidateRuns = [];
    for (const generatedCandidate of generatedCandidates) {
      const sample2 = generatedCandidate.sample;
      let aigcSignal;
      const aigcConfig = getAigcDetectorConfig(options.projectRoot);
      aigcSignal = await detectStyleAigcSignal(sample2, aigcConfig, "style-evolution-loop");
      let evaluation2 = evaluateStyleEvolutionCandidate({
        prompt: promptBundle.prompt,
        sample: sample2,
        userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
        iterationFeedback: carriedFeedback,
        aigc: aigcSignal
      });
      let refinement2 = buildStyleEvolutionRefinement({
        prompt: promptBundle.prompt,
        userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
        evaluation: evaluation2,
        iterationFeedback: carriedFeedback
      });
      refinement2 = reinforceRefinementWithAigc(refinement2, aigcSignal);
      let freezeAdvice2 = null;
      const fallbackReasons = [];
      try {
        const evaluationPrompt = buildStyleEvolutionEvaluationPrompt({
          projectTitle: options.projectTitle,
          idea: options.idea,
          userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
          referenceText: options.referenceText || styleEvolution.contract.referenceText,
          referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
          desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
          seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
          prompt: promptBundle.prompt,
          sample: sample2,
          priorSample: latest?.sample,
          iterationFeedback: carriedFeedback
        });
        const rawEvaluation = await requestLlmTextCompletion({
          baseUrl: options.textConfig.provider.baseUrl,
          apiKey: options.apiKey,
          modelName: options.textConfig.provider.modelName,
          apiMode: options.textConfig.provider.apiMode,
          timeoutMs: options.textConfig.provider.timeoutMs,
          temperature: 0.1,
          maxTokens: 900,
          messages: [
            { role: "system", content: evaluationPrompt.system },
            { role: "user", content: evaluationPrompt.user }
          ]
        });
        const parsedEvaluation = parseStyleEvolutionEvaluationFromText(rawEvaluation);
        if (parsedEvaluation) {
          evaluation2 = mergeStyleEvaluationWithAigc(parsedEvaluation.evaluation, aigcSignal);
        }
        const directApprovalVerification = buildStyleGenerationVerification({
          evaluation: evaluation2,
          checkedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (isStyleEvaluatorDirectApproval({
          evaluation: evaluation2,
          verification: directApprovalVerification,
          retryPolicy,
          totalRounds: Number(styleEvolution.contract.loop?.currentIteration || styleEvolution.contract.evolutionHistory?.length || 0) + 1
        })) {
          refinement2 = buildEvaluatorApprovedRefinement({
            evaluation: evaluation2,
            prompt: promptBundle.prompt,
            aigcSignal
          });
          freezeAdvice2 = {
            freezeVerdict: "ready",
            freezeSummary: "Evaluator direct approval: \u5F53\u524D\u6837\u6BB5\u5DF2\u8FBE\u5230\u53EF\u51BB\u7ED3\u5199\u6CD5\u5E95\u76D8\u3002",
            blockingReasons: [],
            contractAdjustments: refinement2.contractAdjustments || [],
            forbiddenPatterns: [],
            positiveExamples: evaluation2.strengths.slice(0, 4),
            inheritedRules: refinement2.promptAdjustments || []
          };
        } else {
          const refinementPrompt = buildStyleEvolutionRefinementOnlyPrompt({
            projectTitle: options.projectTitle,
            idea: options.idea,
            userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
            referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
            desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
            seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
            prompt: promptBundle.prompt,
            sample: sample2,
            evaluation: evaluation2,
            iterationFeedback: carriedFeedback
          });
          const rawRefinement = await requestLlmTextCompletion({
            baseUrl: options.textConfig.provider.baseUrl,
            apiKey: options.apiKey,
            modelName: options.textConfig.provider.modelName,
            apiMode: options.textConfig.provider.apiMode,
            timeoutMs: options.textConfig.provider.timeoutMs,
            temperature: 0.1,
            maxTokens: 1400,
            messages: [
              { role: "system", content: refinementPrompt.system },
              { role: "user", content: refinementPrompt.user }
            ]
          });
          const parsedRefinement = parseStyleEvolutionRefinementFromText(rawRefinement);
          if (parsedRefinement) {
            refinement2 = reinforceRefinementWithAigc(parsedRefinement.refinement, aigcSignal);
          }
          const freezePrompt = buildStyleFreezeAdvicePrompt({
            sample: sample2,
            prompt: promptBundle.prompt,
            userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
            referenceText: options.referenceText || styleEvolution.contract.referenceText,
            referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
            desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
            seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
            evaluation: evaluation2,
            refinement: refinement2
          });
          const rawFreezeAdvice = await requestLlmTextCompletion({
            baseUrl: options.textConfig.provider.baseUrl,
            apiKey: options.apiKey,
            modelName: options.textConfig.provider.modelName,
            apiMode: options.textConfig.provider.apiMode,
            timeoutMs: options.textConfig.provider.timeoutMs,
            temperature: 0.1,
            maxTokens: 800,
            messages: [
              { role: "system", content: freezePrompt.system },
              { role: "user", content: freezePrompt.user }
            ]
          });
          freezeAdvice2 = parseStyleFreezeAdviceFromText(rawFreezeAdvice);
          if (freezeAdvice2) {
            refinement2 = {
              ...refinement2,
              contractAdjustments: [
                .../* @__PURE__ */ new Set([...refinement2.contractAdjustments || [], ...freezeAdvice2.contractAdjustments || []])
              ]
            };
          }
        }
      } catch (error) {
        fallbackReasons.push(`split_chain_failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 360));
        try {
          const critiquePrompt = buildStyleEvolutionCritiquePrompt({
            projectTitle: options.projectTitle,
            idea: options.idea,
            userStylePrompt: options.userStylePrompt || styleEvolution.contract.userStylePrompt,
            referenceText: options.referenceText || styleEvolution.contract.referenceText,
            referenceWorks: options.referenceWorks || styleEvolution.contract.referenceWorks,
            desiredVibes: options.desiredVibes || styleEvolution.contract.desiredVibes,
            seedForbiddenPatterns: options.seedForbiddenPatterns || styleEvolution.contract.seedForbiddenPatterns,
            prompt: promptBundle.prompt,
            sample: sample2,
            priorSample: latest?.sample,
            iterationFeedback: carriedFeedback
          });
          const rawCritique = await requestLlmTextCompletion({
            baseUrl: options.textConfig.provider.baseUrl,
            apiKey: options.apiKey,
            modelName: options.textConfig.provider.modelName,
            apiMode: options.textConfig.provider.apiMode,
            timeoutMs: options.textConfig.provider.timeoutMs,
            temperature: 0.1,
            maxTokens: 1e3,
            messages: [
              { role: "system", content: critiquePrompt.system },
              { role: "user", content: critiquePrompt.user }
            ]
          });
          const parsedCritique = parseStyleEvolutionCritiqueFromText(rawCritique);
          if (parsedCritique) {
            evaluation2 = mergeStyleEvaluationWithAigc(parsedCritique.evaluation, aigcSignal);
            refinement2 = reinforceRefinementWithAigc(parsedCritique.refinement, aigcSignal);
            fallbackReasons.push("split_chain_recovered_by_combined_critic");
          }
        } catch (fallbackError) {
          fallbackReasons.push(`combined_critic_failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`.slice(0, 360));
          console.warn("Style evolution multi-role chain failed; falling back to heuristic evaluator/refiner.", fallbackError);
        }
        console.warn("Style evolution split evaluator/refiner/freezer chain failed; fallback path used.", error);
      }
      const verification2 = buildStyleGenerationVerification({
        evaluation: evaluation2,
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      const freezer2 = buildStyleFreezerGateRecord(freezeAdvice2, { evaluation: evaluation2, verification: verification2 });
      const llmFallbackUsed = evaluation2.source === "heuristic" || refinement2.source === "heuristic" || freezer2.source === "heuristic" || fallbackReasons.length > 0;
      candidateRuns.push({
        candidateIndex: generatedCandidate.candidateIndex,
        sample: sample2,
        evaluation: evaluation2,
        refinement: refinement2,
        freezeAdvice: freezeAdvice2,
        verification: verification2,
        freezer: freezer2,
        aigcSignal,
        llmFallbackUsed,
        fallbackReasons
      });
    }
    candidateRuns.sort((left, right) => {
      const verificationRank = (status) => {
        if (status === "passed") return 0;
        if (status === "blocked") return 1;
        if (status === "warning") return 2;
        if (status === "pending") return 3;
        return 3;
      };
      const verificationGap = verificationRank(left.verification?.status) - verificationRank(right.verification?.status);
      if (verificationGap !== 0) return verificationGap;
      const freezerRank = (verdict) => {
        if (verdict === "ready") return 0;
        if (verdict === "continue") return 1;
        if (verdict === "block") return 2;
        return 1;
      };
      const freezerGap = freezerRank(left.freezer?.verdict) - freezerRank(right.freezer?.verdict);
      if (freezerGap !== 0) return freezerGap;
      const aigcGap = Number(left.verification?.highRiskCount || left.aigcSignal?.highRiskCount || 0) - Number(right.verification?.highRiskCount || right.aigcSignal?.highRiskCount || 0);
      if (aigcGap !== 0) return aigcGap;
      const forbiddenGap = Number(left.verification?.forbiddenHitCount || left.evaluation?.forbiddenHits?.length || 0) - Number(right.verification?.forbiddenHitCount || right.evaluation?.forbiddenHits?.length || 0);
      if (forbiddenGap !== 0) return forbiddenGap;
      const scoreGap = Number(right.evaluation?.scores?.overall || 0) - Number(left.evaluation?.scores?.overall || 0);
      if (scoreGap !== 0) return scoreGap;
      return left.candidateIndex - right.candidateIndex;
    });
    const winner = candidateRuns.find((entry) => entry.verification?.status === "passed");
    if (!winner) {
      stopReason = "style_candidates_all_blocked";
      loopRuntime.iterations.push({
        ...runtimeIteration,
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        candidateCount: options.candidateCount,
        candidateScores: candidateRuns.map((entry) => ({
          candidateIndex: entry.candidateIndex,
          overallScore: Number(entry.evaluation?.scores?.overall || 0) || void 0,
          verdict: entry.evaluation?.verdict,
          source: entry.evaluation?.source,
          verificationStatus: entry.verification?.status,
          aigcHighRiskCount: Number(entry.verification?.highRiskCount || 0),
          forbiddenHitCount: Number(entry.verification?.forbiddenHitCount || 0),
          llmFallbackUsed: entry.llmFallbackUsed
        })),
        candidates: candidateRuns.map((entry) => ({
          candidateIndex: entry.candidateIndex,
          sample: entry.sample,
          evaluation: entry.evaluation,
          refinement: entry.refinement,
          verification: entry.verification,
          freezer: entry.freezer,
          llmFallbackUsed: entry.llmFallbackUsed,
          fallbackReasons: entry.fallbackReasons
        })),
        winningReason: "\u672C\u8F6E\u6240\u6709\u5019\u9009\u90FD\u672A\u901A\u8FC7 Generation Verification Gate\uFF0C\u672A\u5199\u5165\u6B63\u5F0F\u5019\u9009\u5386\u53F2\u3002",
        verificationStatus: "blocked",
        verificationSummary: "Generation Verification Gate \u963B\u585E\uFF0C\u672C\u8F6E\u65E0\u53EF\u6301\u4E45\u5316\u5019\u9009\u3002",
        verificationReasons: candidateRuns.flatMap((entry) => entry.verification?.reasons || []).filter(Boolean).slice(0, 8),
        stage: "evaluated"
      });
      loopRuntime.completedIterations = loopRuntime.iterations.length;
      break;
    }
    const sample = winner.sample;
    const evaluation = winner.evaluation;
    const refinement = winner.refinement;
    const freezeAdvice = winner.freezeAdvice;
    const verification = winner.verification;
    const freezer = winner.freezer;
    styleEvolution = await appendStyleEvolutionCandidate(options.projectRoot, {
      prompt: promptBundle.prompt,
      sample,
      review: evaluation.summary,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      iterationFeedback: carriedFeedback,
      source: "loop",
      evaluation,
      refinement,
      freezer,
      llmFallbackUsed: winner.llmFallbackUsed,
      fallbackReasons: winner.fallbackReasons
    });
    const persistedLatest = Array.isArray(styleEvolution.contract.evolutionHistory) ? styleEvolution.contract.evolutionHistory.at(-1) : null;
    loopRuntime.iterations.push({
      ...runtimeIteration,
      version: persistedLatest?.version || 0,
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      sampleExcerpt: sample.replace(/\s+/gu, " ").slice(0, 160),
      candidateCount: options.candidateCount,
      candidateIndex: winner.candidateIndex,
      candidateScores: candidateRuns.map((entry) => ({
        candidateIndex: entry.candidateIndex,
        overallScore: Number(entry.evaluation?.scores?.overall || 0) || void 0,
        verdict: entry.evaluation?.verdict,
        source: entry.evaluation?.source,
        verificationStatus: entry.verification?.status,
        aigcHighRiskCount: Number(entry.verification?.highRiskCount || 0),
        forbiddenHitCount: Number(entry.verification?.forbiddenHitCount || 0),
        llmFallbackUsed: entry.llmFallbackUsed
      })),
      winningReason: verification.status === "passed" ? `\u5019\u9009 ${winner.candidateIndex} \u901A\u8FC7 Generation Verification Gate\uFF0C\u5E76\u4EE5 ${Number(evaluation.scores?.overall || 0).toFixed(1)} \u5206\u80DC\u51FA\u3002` : `\u5019\u9009 ${winner.candidateIndex} \u5728\u5F53\u524D\u6279\u6B21\u98CE\u9669\u6700\u4F4E\uFF0C\u9A8C\u8BC1\u72B6\u6001 ${verification.status}\uFF0C\u7EFC\u5408\u8BC4\u5206 ${Number(evaluation.scores?.overall || 0).toFixed(1)}\u3002`,
      evaluationSource: evaluation.source,
      refinementSource: refinement.source,
      freezerSource: freezer?.source,
      verdict: evaluation.verdict,
      overallScore: Number(evaluation.scores?.overall || 0) || void 0,
      forbiddenHits: evaluation.forbiddenHits,
      verificationStatus: verification.status,
      verificationSummary: verification.summary,
      verificationReasons: verification.reasons,
      freezerVerdict: freezer?.verdict,
      freezerSummary: freezer?.summary,
      freezerBlockingReasons: freezer?.blockingReasons,
      llmFallbackUsed: winner.llmFallbackUsed,
      fallbackReasons: winner.fallbackReasons,
      aigcRiskScore: verification.score,
      aigcThreshold: verification.threshold,
      aigcHighRiskCount: verification.highRiskCount,
      forbiddenHitCount: verification.forbiddenHitCount,
      nextPrompt: refinement.nextPrompt,
      contractAdjustments: refinement.contractAdjustments,
      candidates: candidateRuns.map((entry) => ({
        candidateIndex: entry.candidateIndex,
        persistedVersion: entry.candidateIndex === winner.candidateIndex ? persistedLatest?.version || void 0 : void 0,
        sample: entry.sample,
        evaluation: entry.evaluation,
        refinement: entry.refinement,
        verification: entry.verification,
        freezer: entry.freezer,
        llmFallbackUsed: entry.llmFallbackUsed,
        fallbackReasons: entry.fallbackReasons
      })),
      stage: "persisted"
    });
    loopRuntime.completedIterations = loopRuntime.iterations.length;
    iterations.push({
      version: persistedLatest?.version || 0,
      prompt: promptBundle.prompt,
      sample,
      evaluation,
      refinement,
      verification,
      freezer,
      llmFallbackUsed: winner.llmFallbackUsed,
      fallbackReasons: winner.fallbackReasons,
      candidates: candidateRuns.map((entry) => ({
        candidateIndex: entry.candidateIndex,
        persistedVersion: entry.candidateIndex === winner.candidateIndex ? persistedLatest?.version || void 0 : void 0,
        sample: entry.sample,
        evaluation: entry.evaluation,
        refinement: entry.refinement,
        verification: entry.verification,
        freezer: entry.freezer,
        llmFallbackUsed: entry.llmFallbackUsed,
        fallbackReasons: entry.fallbackReasons
      }))
    });
    const totalRounds = Number(styleEvolution.contract.loop?.currentIteration || styleEvolution.contract.evolutionHistory?.length || 0);
    const verificationPassed = verification.status === "passed";
    const freezerReady = freezer?.verdict === "ready";
    const readyForApproval = verificationPassed && freezerReady && (evaluation.scores.overall >= approvalThreshold && evaluation.forbiddenHits.length <= maxForbiddenHitCount && totalRounds >= approvalMinRounds || evaluation.verdict === "approve");
    const stableCandidate = styleEvolution.contract.loop?.status === "stable_candidate";
    if (readyForApproval) {
      stopReason = "ready_for_approval";
      break;
    }
    if (stableCandidate) {
      stopReason = "stable_candidate";
      break;
    }
  }
  loopRuntime.status = "completed";
  loopRuntime.completedAt = (/* @__PURE__ */ new Date()).toISOString();
  loopRuntime.stopReason = stopReason;
  loopRuntime.finalVersion = styleEvolution.contract.evolutionHistory?.at(-1)?.version;
  loopRuntime.finalLoopStatus = styleEvolution.contract.loop?.status;
  loopRuntime.finalConvergence = styleEvolution.contract.loop?.convergence;
  await persistStyleLoopRuntime(options.projectRoot, loopRuntime);
  await appendStyleLoopRunLedger(options.projectRoot, loopRuntime);
  await persistStyleEvolutionRuntimeState(options.projectRoot, {
    lastRunId: loopRuntime.runId,
    lastRunStatus: "completed",
    lastStopReason: loopRuntime.stopReason,
    lastCompletedAt: loopRuntime.completedAt
  });
  styleEvolution = await loadStyleEvolution(options.projectRoot);
  return {
    styleEvolution,
    iterations,
    stopReason,
    loopRuntime
  };
}
function json(response, status, payload) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}
function writeServerErrorResponse(response, error) {
  const message = error instanceof Error ? error.message : String(error);
  if (response.headersSent) {
    if (!response.writableEnded) {
      response.write(`event: error
`);
      response.write(`data: ${JSON.stringify({ error: message })}

`);
      response.end();
    }
    return;
  }
  json(response, 500, { error: message });
}
function eventStreamHeaders(response) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive"
  });
}
function writeSse(response, eventName, data) {
  if (response.writableEnded || response.destroyed || !response.writable) {
    return;
  }
  try {
    response.write(`event: ${eventName}
`);
    response.write(`data: ${JSON.stringify(data)}

`);
  } catch {
  }
}
function pct(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}
function formatKnowledgeEvaluationReport(evaluation) {
  const lines = [
    "# Knowledge Retrieval Evaluation",
    "",
    `- Total Cases: ${evaluation.summary.totalCases}`,
    `- Hit@K: ${pct(evaluation.summary.hitRateAtK)}`,
    `- Mean Recall@K: ${pct(evaluation.summary.meanRecallAtK)}`,
    `- Mean Precision@K: ${pct(evaluation.summary.meanPrecisionAtK)}`,
    "",
    "## Cases",
    ""
  ];
  for (const item of evaluation.cases) {
    lines.push(
      `### ${item.name || "Unnamed Case"}`,
      "",
      `- Query: ${item.query}`,
      `- K: ${item.k}`,
      `- Hit@K: ${item.hitAtK}`,
      `- Recall@K: ${pct(item.recallAtK)}`,
      `- Precision@K: ${pct(item.precisionAtK)}`,
      `- Matched Chunks: ${item.matchedChunkIds.length ? item.matchedChunkIds.join(", ") : "none"}`,
      `- Missed Chunks: ${item.missedChunkIds.length ? item.missedChunkIds.join(", ") : "none"}`,
      ""
    );
  }
  return `${lines.join("\n").trim()}
`;
}
function shouldUseEmbeddedWorker(value) {
  return value ?? process.env.AI_NOVEL_EMBEDDED_WORKER === "1";
}
async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw);
}
function readJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function readStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}
function readKnowledgeScopes(value) {
  const scopes = readStringArray(value).filter((scope) => scope === "global" || scope === "project");
  return scopes.length ? scopes : void 0;
}
function normalizeKnowledgeSearchRow(row) {
  const source = row.source || {};
  const content = String(row.content || "");
  const sourcePath = String(source.path || row.source_path || "");
  const sourceType = String(source.sourceType || row.source_type || "");
  return {
    id: String(row.id || ""),
    chunkId: String(row.id || ""),
    score: Number(row.score || 0),
    chunkType: String(row.chunk_type || row.chunkType || ""),
    content,
    preview: content.replace(/\s+/g, " ").trim().slice(0, 360),
    metadata: row.metadata || {},
    source: {
      id: String(source.id || row.source_id || ""),
      scope: String(row.scope || ""),
      sourceType,
      path: sourcePath,
      title: String(source.title || row.source_title || sourcePath || "knowledge")
    }
  };
}
function isJsonApiRequest(method, pathname) {
  if (method === "GET") {
    return [
      "/api/projects",
      "/api/health",
      "/api/ready",
      "/api/status",
      "/api/reader-snapshot",
      "/api/reader-chapter",
      "/api/reader-chapter-versions/compare",
      "/api/reader-search",
      "/api/transcript",
      "/api/messages",
      "/api/chapters/preview",
      "/api/artifacts/preview",
      "/api/assets/image",
      "/api/knowledge-graph",
      "/api/llm-configs",
      "/api/settings/writing",
      "/api/style-evolution"
    ].includes(pathname);
  }
  if (method === "POST") {
    return [
      "/api/projects",
      "/api/init",
      "/api/advance",
      "/api/production/story-assets/repair",
      "/api/chapters/retry",
      "/api/cover",
      "/api/provider-test",
      "/api/interrupt",
      "/api/chat",
      "/api/stop",
      "/api/autopilot/stop",
      "/api/autopilot/start",
      "/api/autopilot/mode",
      "/api/mode",
      "/api/knowledge/reindex",
      "/api/knowledge/search",
      "/api/knowledge/evaluate",
      "/api/llm-configs",
      "/api/llm-configs/activate",
      "/api/llm-config-routes",
      "/api/aigc-detect",
      "/api/settings/writing",
      "/api/aigc/batch-scan",
      "/api/aigc/batch-refine",
      "/api/aigc/mark-workflow-complete",
      "/api/reader-chapter-version",
      "/api/style-evolution/init",
      "/api/style-evolution/candidate",
      "/api/style-evolution/generate-candidate",
      "/api/style-evolution/freeze-preview",
      "/api/style-evolution/accept",
      "/api/style-evolution/approve",
      "/api/style-evolution/reject"
    ].includes(pathname);
  }
  if (method === "DELETE") {
    return pathname.startsWith("/api/projects/") || pathname === "/api/llm-configs";
  }
  return false;
}
async function forwardJsonApiRequest(rootDir, request, response, url, options = {}) {
  const method = request.method || "GET";
  const pathname = url.pathname;
  const body = method === "POST" || method === "DELETE" ? await readJsonBody(request) : {};
  const projectId = typeof body.projectId === "string" ? body.projectId : url.searchParams.get("projectId");
  const pathWithSearch = url.search ? `${pathname}${url.search}` : pathname;
  const result = await handleNovelStudioApi(rootDir, method, pathWithSearch, body, {
    projectId,
    embeddedWorker: options.embeddedWorker
  });
  json(response, result.status, result.payload);
}
function mergeApiAigcDetectorConfig(base, value) {
  if (!value || typeof value !== "object") {
    return base;
  }
  const input = value;
  const provider = input.provider === "local-heuristic" || input.provider === "generic-json" || input.provider === "gradio-queue" || input.provider === "disabled" ? input.provider : base.provider;
  return {
    ...base,
    provider,
    url: typeof input.url === "string" ? input.url : base.url,
    token: typeof input.token === "string" ? input.token : base.token,
    timeoutMs: typeof input.timeoutMs === "number" && input.timeoutMs > 0 ? input.timeoutMs : base.timeoutMs,
    threshold: typeof input.threshold === "number" ? input.threshold : base.threshold,
    requestTextField: typeof input.requestTextField === "string" ? input.requestTextField : base.requestTextField,
    segment: {
      ...base.segment,
      ...typeof input.segment === "object" && input.segment !== null ? input.segment : {}
    },
    gradio: {
      ...base.gradio,
      ...typeof input.gradio === "object" && input.gradio !== null ? input.gradio : {}
    }
  };
}
function readApiAigcSegments(value) {
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const segment = item;
    const text = typeof segment.text === "string" ? segment.text : "";
    if (!text.trim()) {
      return [];
    }
    const startOffset = typeof segment.startOffset === "number" ? segment.startOffset : 0;
    const endOffset = typeof segment.endOffset === "number" ? segment.endOffset : startOffset + text.length;
    return [{
      id: typeof segment.id === "string" ? segment.id : `segment-${index + 1}`,
      index: typeof segment.index === "number" ? segment.index : index,
      text,
      startOffset,
      endOffset,
      metadata: typeof segment.metadata === "object" && segment.metadata !== null ? segment.metadata : void 0
    }];
  });
}
function serializeState(state) {
  return {
    project: state.project,
    runtime: state.runtime,
    reactSetup: state.reactSetup,
    plan: state.plan,
    memory: state.memory,
    assets: state.assets
  };
}
async function readDiscussionTranscript(rootDir) {
  try {
    return await fs.readFile(path.join(rootDir, ".ai-novel", "chat", "discussion-log.md"), "utf8");
  } catch {
    return "";
  }
}
async function appendAutopilotSubmissionTranscript(rootDir, input) {
  const message = input.message.trim();
  if (!message) return null;
  const chatDir = path.join(rootDir, ".ai-novel", "chat");
  const submittedAt = (/* @__PURE__ */ new Date()).toISOString();
  await fs.mkdir(chatDir, { recursive: true });
  await fs.appendFile(
    path.join(chatDir, "discussion-log.md"),
    [
      `## ${submittedAt}`,
      `User: ${message}`,
      `System: \u5DF2\u63A5\u6536\u65E0\u4EBA\u503C\u5B88\u521B\u4F5C\u6307\u4EE4\uFF0C\u5E76\u5199\u5165\u540E\u53F0\u4EFB\u52A1\u961F\u5217\u3002${input.jobId ? ` Job: ${input.jobId}.` : ""}`,
      `Status: autopilot_submitted`,
      input.stage ? `Stage: ${input.stage}` : "",
      ""
    ].filter(Boolean).join("\n")
  );
  return submittedAt;
}
async function recordUserMessage(rootDir, input) {
  if (!input.projectId || !input.content.trim()) return null;
  const message = createUserMessage({
    conversationId: input.conversationId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    content: input.content.trim(),
    time: input.time,
    metadata: input.metadata
  });
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, userMessageParts(message.messageId, {
    content: message.data.content,
    createdAt: message.time,
    metadata: message.metadata
  }))).catch(() => void 0);
  return message;
}
async function recordStatusMessage(rootDir, input) {
  if (!input.projectId) return null;
  const message = createStatusMessage({
    conversationId: input.conversationId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    title: input.title,
    content: input.content,
    agentType: "director",
    agentLabel: "System",
    time: input.time,
    metadata: input.metadata
  });
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, statusMessageParts(message.messageId, {
    title: message.data.title,
    content: message.data.content,
    createdAt: message.time,
    metadata: message.metadata
  }))).catch(() => void 0);
  return message;
}
function messagePart(messageId, index, type, data, createdAt) {
  return {
    id: `${messageId}:part:${index}`,
    messageId,
    index,
    type,
    data,
    createdAt
  };
}
function userMessageParts(messageId, input) {
  return [
    messagePart(messageId, 0, "text", { text: input.content }, input.createdAt),
    messagePart(messageId, 1, "json", {
      source: input.metadata?.source || "user",
      metadata: input.metadata || {}
    }, input.createdAt)
  ];
}
function statusMessageParts(messageId, input) {
  const text = [input.title ? `### ${input.title}` : "", input.content].filter(Boolean).join("\n\n");
  return [
    messagePart(messageId, 0, "markdown", { text }, input.createdAt),
    messagePart(messageId, 1, "json", {
      source: input.metadata?.source || "status",
      title: input.title,
      metadata: input.metadata || {}
    }, input.createdAt)
  ];
}
function toolMessageParts(messageId, input) {
  const parts = [
    messagePart(messageId, 0, "markdown", { text: input.content || `${input.toolName}: ${input.status}` }, input.createdAt),
    messagePart(messageId, 1, "tool_call", {
      toolName: input.toolName,
      input: input.toolInput ?? null
    }, input.createdAt)
  ];
  parts.push(messagePart(messageId, 2, input.error ? "tool_result" : "tool_result", {
    status: input.status,
    output: input.output ?? null,
    error: input.error ?? null
  }, input.createdAt));
  return parts;
}
async function recordToolMessage(rootDir, input) {
  if (!input.projectId) return null;
  const status = input.status || "completed";
  const message = createToolMessage({
    conversationId: input.conversationId,
    projectId: input.projectId,
    runId: input.runId ?? null,
    toolName: input.toolName,
    status,
    toolStatus: status,
    input: input.input,
    output: input.output,
    error: input.error,
    content: input.content,
    time: input.time,
    metadata: input.metadata
  });
  await withFactoryDb(rootDir, async (db) => db.recordMessage(message, toolMessageParts(message.messageId, {
    toolName: input.toolName,
    status,
    toolInput: input.input,
    output: input.output,
    error: input.error,
    content: input.content,
    createdAt: message.createdAt
  }))).catch(() => void 0);
  return message;
}
async function writeKnowledgeEvaluationArtifact(rootDir, projectRoot, projectId, evaluation) {
  const relativePath = ".ai-novel/knowledge/evaluation-latest.md";
  const absolutePath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, formatKnowledgeEvaluationReport(evaluation), "utf8");
  await withFactoryDb(rootDir, async (db) => {
    db.recordArtifact({
      projectId,
      kind: "checkpoint",
      path: relativePath,
      status: "completed",
      metadata: {
        source: "knowledge-evaluate",
        summary: evaluation.summary
      }
    });
  });
  return relativePath;
}
function parseTranscriptTimestamp(value = "") {
  const firstLine = String(value || "").split("\n")[0]?.trim() || "";
  const parsed = Date.parse(firstLine);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}
function parseTranscriptEntries(transcript = "", { limit = 80 } = {}) {
  const rolePattern = /^(User|System|Showrunner|World Architect|Author|Editor|Reviewer|Prose Stylist):\s*(.*)$/;
  const blocks = transcript.split(/^##\s+/m).map((block) => block.trim()).filter(Boolean);
  const entries = [];
  blocks.forEach((block, blockIndex) => {
    const timestamp = parseTranscriptTimestamp(block);
    let current = null;
    for (const line of block.split("\n").slice(timestamp ? 1 : 0)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(rolePattern);
      if (match) {
        if (current) entries.push(current);
        current = {
          key: `transcript-${blockIndex}-${entries.length}`,
          role: match[1],
          content: match[2].trim(),
          ...timestamp ? { timestamp } : {}
        };
        continue;
      }
      if (current) {
        current.content = [current.content, trimmed].filter(Boolean).join("\n");
      }
    }
    if (current) entries.push(current);
  });
  const recentEntries = entries.slice(-limit);
  return {
    entries: recentEntries.map((entry, index) => ({ ...entry, key: `history-${entries.length - recentEntries.length + index}` })),
    meta: {
      totalEntries: entries.length,
      returnedEntries: recentEntries.length,
      truncated: entries.length > recentEntries.length,
      transcriptBytes: Buffer.byteLength(transcript)
    }
  };
}
function messageRowsToEntries(rows = [], { limit = 80, transcriptBytes = 0 } = {}) {
  const normalizeParts = (parts) => Array.isArray(parts) ? parts.filter((part) => Boolean(part) && typeof part === "object").map((part, index) => ({
    id: String(part.id || `${part.messageId || part.message_id || "message"}:part:${index}`),
    messageId: String(part.messageId || part.message_id || ""),
    index: Number.isFinite(Number(part.index ?? part.part_index)) ? Number(part.index ?? part.part_index) : index,
    type: String(part.type || "text"),
    data: part.data && typeof part.data === "object" ? part.data : {},
    createdAt: String(part.createdAt || part.created_at || "")
  })).sort((left, right) => left.index - right.index) : [];
  const artifactPathFromParts = (parts) => {
    const artifactPart = parts.find((part) => part.type === "artifact" && part.data && typeof part.data === "object");
    const artifactData = artifactPart?.data;
    const path2 = artifactData?.path || artifactData?.artifactPath || artifactData?.url || "";
    return typeof path2 === "string" ? path2 : "";
  };
  const selectedRows = rows.slice(0, limit).reverse();
  const entries = selectedRows.map((row, index) => {
    const data = row.data && typeof row.data === "object" ? row.data : {};
    const parts = normalizeParts(row.parts);
    const type = String(row.type || "agent");
    const isUser = type === "user";
    const role = isUser ? "User" : String(data.agentLabel || data.agentType || "Agent");
    const content = type === "status" ? [data.title ? `### ${String(data.title)}` : "", data.content ? String(data.content) : ""].filter(Boolean).join("\n\n") : String(data.content || data.caption || data.alt || data.path || data.url || "");
    return {
      key: `message-${String(row.id || index)}`,
      messageId: String(row.id || row.messageId || ""),
      conversationId: String(row.conversation_id || row.conversationId || ""),
      runId: typeof row.run_id === "string" ? row.run_id : typeof row.runId === "string" ? row.runId : "",
      turnId: typeof row.turn_id === "string" ? row.turn_id : typeof row.turnId === "string" ? row.turnId : "",
      type,
      status: String(row.status || "completed"),
      role,
      content,
      timestamp: String(row.time || row.created_at || row.createdAt || ""),
      time: String(row.time || row.created_at || row.createdAt || ""),
      data,
      parts,
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      artifactPath: typeof data.artifactPath === "string" ? data.artifactPath : artifactPathFromParts(parts)
    };
  });
  return {
    entries,
    meta: {
      totalEntries: rows.length,
      returnedEntries: entries.length,
      truncated: rows.length > entries.length,
      transcriptBytes,
      source: "messages"
    }
  };
}
function discussionEntriesFromSnapshot(factorySnapshot, { limit = 80 } = {}) {
  const recentMessages = Array.isArray(factorySnapshot?.recentMessages) ? factorySnapshot.recentMessages : [];
  if (recentMessages.length === 0) {
    return null;
  }
  return messageRowsToEntries(recentMessages, { limit });
}
async function readWorkspaceText(rootDir, ...parts) {
  try {
    return await fs.readFile(path.join(rootDir, ".ai-novel", ...parts), "utf8");
  } catch {
    return "";
  }
}
async function writeWorkspaceText(rootDir, content, ...parts) {
  const targetPath = path.join(rootDir, ".ai-novel", ...parts);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}
function getNovelWorkspacePaths(projectRoot) {
  const workspaceDir = path.join(projectRoot, ".ai-novel");
  const styleDir = path.join(workspaceDir, "style");
  const memoryDir = path.join(workspaceDir, "memory");
  const charactersDir = path.join(memoryDir, "characters");
  const characterCoreDir = path.join(charactersDir, "core");
  const plansDir = path.join(workspaceDir, "plans");
  return {
    workspaceDir,
    plansDir,
    reportsDir: path.join(workspaceDir, "reports"),
    chaptersDir: path.join(workspaceDir, "chapters"),
    memoryDir,
    styleDir,
    styleProfilePath: path.join(styleDir, "profile.md"),
    styleRulebookPath: path.join(styleDir, "rulebook.md"),
    styleReferencesPath: path.join(styleDir, "references.md"),
    styleAntiPatternsPath: path.join(styleDir, "anti-patterns.md"),
    consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
    characterDossiersPath: path.join(charactersDir, "dossiers.json"),
    characterDossiersMarkdownPath: path.join(charactersDir, "dossiers.md"),
    protagonistPath: path.join(characterCoreDir, "protagonist.md"),
    relationsPath: path.join(charactersDir, "relations.md"),
    characterEvolutionPath: path.join(charactersDir, "evolution.md"),
    masterOutlinePath: path.join(plansDir, "master-outline.md"),
    chapterBlueprintsDir: path.join(plansDir, "chapter-blueprints")
  };
}
var STORY_FOUNDATION_APPROVAL_FILE = "story-foundation-approval.json";
async function loadStoryFoundationApproval(projectRoot) {
  const approval = await readWorkspaceJson(projectRoot, "plans", STORY_FOUNDATION_APPROVAL_FILE);
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) {
    return null;
  }
  return approval;
}
function isStoryFoundationApproved(approval) {
  return Boolean(approval?.approved === true && String(approval.approvedAt || "").trim());
}
async function writeStoryFoundationApproval(projectRoot, input) {
  const assetPaths = Array.isArray(input.assetPaths) && input.assetPaths.length ? input.assetPaths : [
    ".ai-novel/plans/world-matrix.md",
    ".ai-novel/plans/plot-architecture.md",
    ".ai-novel/plans/story-bible.md",
    ".ai-novel/plans/volume-strategy.md",
    ".ai-novel/plans/foreshadowing-ledger.md",
    ".ai-novel/plans/character-dynamics.md",
    ".ai-novel/plans/story-foundation-contract.json",
    ".ai-novel/plans/writing-plan.json"
  ];
  const approval = {
    version: 1,
    approved: true,
    approvedAt: (/* @__PURE__ */ new Date()).toISOString(),
    approvedBy: input.approvedBy || "user",
    note: input.note || "\u7528\u6237\u5DF2\u786E\u8BA4\u4E16\u754C\u89C2\u3001\u4E3B\u7EBF\u3001\u4EBA\u7269\u5173\u7CFB\u3001\u4F0F\u7B14\u8D26\u672C\u548C\u5199\u4F5C\u6267\u884C\u8BA1\u5212\u53EF\u8FDB\u5165\u6B63\u6587\u751F\u4EA7\u3002",
    assetPaths,
    assetFingerprint: input.assetFingerprint || ""
  };
  await writeWorkspaceText(projectRoot, `${JSON.stringify(approval, null, 2)}
`, "plans", STORY_FOUNDATION_APPROVAL_FILE);
  return approval;
}
async function syncCurrentContextPacketState(projectRoot, state) {
  if (!state) return;
  await syncCurrentContextPacketFile(projectRoot, state);
}
async function readWorkspaceArtifactText(rootDir, artifactPath) {
  const normalized = artifactPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith(".ai-novel/") || normalized.includes("..")) {
    return null;
  }
  try {
    return await fs.readFile(path.join(rootDir, normalized), "utf8");
  } catch {
    return "";
  }
}
async function readWorkspaceArtifactJson(rootDir, artifactPath) {
  const text = await readWorkspaceArtifactText(rootDir, artifactPath);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}
function planningAssetStructuralIssue(asset, value, totalChapters) {
  if (!value) return "JSON \u65E0\u6CD5\u89E3\u6790";
  switch (asset) {
    case "story-foundation-contract.json": {
      const plot = value.plot && typeof value.plot === "object" ? value.plot : {};
      const characters = value.characters && typeof value.characters === "object" ? value.characters : {};
      if (!nonEmptyString(value.project?.title) && !nonEmptyString(value.project?.idea)) return "\u7F3A\u5C11\u9879\u76EE\u6838\u5FC3\u4FE1\u606F";
      if (!hasItems(plot.chapters) && !hasItems(plot.causalModel?.chapters)) return "\u7F3A\u5C11\u4E3B\u7EBF\u7AE0\u8282\u56E0\u679C";
      if (!hasItems(characters.requiredDossierFields)) return "\u7F3A\u5C11\u4EBA\u7269\u6863\u6848\u8981\u6C42";
      return "";
    }
    case "world-matrix.json":
      return hasItems(value.rules) ? "" : "\u7F3A\u5C11\u4E16\u754C\u89C4\u5219";
    case "plot-architecture.json":
      return hasItems(value.chapters) ? "" : "\u7F3A\u5C11\u7AE0\u8282\u56E0\u679C\u67B6\u6784";
    case "story-bible.json":
      return nonEmptyString(value.readerPromise) && hasItems(value.nonNegotiableContracts) ? "" : "\u7F3A\u5C11\u8BFB\u8005\u627F\u8BFA\u6216\u6545\u4E8B\u5408\u540C";
    case "volume-strategy.json":
      return hasItems(value.volumes) ? "" : "\u7F3A\u5C11\u5206\u5377\u7B56\u7565";
    case "foreshadowing-ledger.json":
      return hasItems(value.entries) ? "" : "\u7F3A\u5C11\u4F0F\u7B14\u6761\u76EE";
    case "character-dynamics.json":
      return hasItems(value.relationshipEntries) || hasItems(value.dossiers) || hasItems(value.relationships) ? "" : "\u7F3A\u5C11\u4EBA\u7269\u5173\u7CFB\u52A8\u6001";
    case "writing-plan.json": {
      const chapters = Array.isArray(value.chapters) ? value.chapters : [];
      if (!Number.isFinite(Number(value.totalChapters)) || Number(value.totalChapters) <= 0) return "\u7F3A\u5C11\u603B\u7AE0\u8282\u6570";
      if (chapters.length < Math.max(1, totalChapters)) return "\u5199\u4F5C\u8BA1\u5212\u672A\u8986\u76D6\u5168\u4E66\u7AE0\u8282";
      return "";
    }
    default:
      return "";
  }
}
async function listWorkspaceFiles(rootDir, ...parts) {
  try {
    return await fs.readdir(path.join(rootDir, ".ai-novel", ...parts));
  } catch {
    return [];
  }
}
async function readWorkspaceAssetDataUrl(rootDir, artifactPath) {
  const normalized = artifactPath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized.startsWith(".ai-novel/assets/") || normalized.includes("..")) {
    return null;
  }
  try {
    const buffer = await fs.readFile(path.join(rootDir, normalized));
    const ext = path.extname(normalized).toLowerCase();
    const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
    return {
      path: artifactPath,
      mimeType,
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`
    };
  } catch {
    return {
      path: artifactPath,
      mimeType: "",
      dataUrl: ""
    };
  }
}
async function summarizeChapterStyleInheritanceManifests(projectRoot) {
  const chapterFiles = await listWorkspaceFiles(projectRoot, "chapters");
  const manifestFiles = chapterFiles.filter((fileName) => /^chapter-\d+\.versions\.json$/u.test(fileName)).sort();
  if (!manifestFiles.length) {
    return {
      total: 0,
      ready: 0,
      warning: 0,
      blocked: 0,
      pending: 0,
      missing: 0,
      latestBlocked: ""
    };
  }
  let ready = 0;
  let warningCount = 0;
  let blocked = 0;
  let pending = 0;
  let missing = 0;
  let latestBlocked = "";
  for (const fileName of manifestFiles) {
    const manifest = await readWorkspaceArtifactJson(projectRoot, `.ai-novel/chapters/${fileName}`);
    const verification = manifest?.styleInheritanceVerification && typeof manifest.styleInheritanceVerification === "object" ? manifest.styleInheritanceVerification : null;
    const drift = manifest?.styleConformanceDrift && typeof manifest.styleConformanceDrift === "object" ? manifest.styleConformanceDrift : null;
    if (!verification && !drift) {
      missing += 1;
      continue;
    }
    const verificationStatus = verification ? String(verification.status || "pending") : "";
    const driftStatus = drift ? String(drift.status || "pending") : "";
    const status = driftStatus === "drifted" ? "blocked" : driftStatus === "warning" || driftStatus === "pending" ? driftStatus : verificationStatus || (driftStatus === "conformant" ? "ready" : driftStatus);
    if (status === "ready" || status === "conformant") {
      ready += 1;
    } else if (status === "warning") {
      warningCount += 1;
    } else if (status === "blocked" || status === "drifted") {
      blocked += 1;
      latestBlocked = latestBlocked || String(
        drift?.reason || verification?.summary || `${fileName} \u5199\u6CD5\u7EE7\u627F\u9A8C\u8BC1\u963B\u585E`
      );
    } else {
      pending += 1;
    }
  }
  return {
    total: manifestFiles.length,
    ready,
    warning: warningCount,
    blocked,
    pending,
    missing,
    latestBlocked
  };
}
function compactStateForPayload(state, options = {}) {
  if (!state) return null;
  const tasks = state.plan.chapterTasks;
  const pageSize = Math.max(1, Math.min(100, Number.isFinite(Number(options.chapterPageSize)) ? Number(options.chapterPageSize) : 20));
  const pageCount = Math.max(1, Math.ceil(tasks.length / pageSize));
  const firstActiveIndex = tasks.findIndex((task) => task.status !== "complete");
  const defaultPage = firstActiveIndex >= 0 ? Math.floor(firstActiveIndex / pageSize) + 1 : pageCount;
  const page = Math.max(1, Math.min(pageCount, Number.isFinite(Number(options.chapterPage)) ? Number(options.chapterPage) : defaultPage));
  const startIndex = (page - 1) * pageSize;
  const visibleTasks = tasks.slice(startIndex, startIndex + pageSize);
  const windowStart = visibleTasks.length > 0 ? Number(visibleTasks[0]?.chapterNumber || firstActiveIndex + 1 || 1) : 0;
  const windowEnd = visibleTasks.length > 0 ? Number(visibleTasks[visibleTasks.length - 1]?.chapterNumber || windowStart) : 0;
  return {
    ...serializeState(state),
    plan: {
      ...state.plan,
      chapterTasks: visibleTasks,
      chapterTaskSummary: {
        total: tasks.length,
        complete: tasks.filter((task) => task.status === "complete").length,
        pending: tasks.filter((task) => task.status === "pending").length,
        inProgress: tasks.filter((task) => task.status === "in_progress").length,
        blocked: tasks.filter((task) => task.status === "blocked").length,
        windowed: visibleTasks.length,
        windowStart,
        windowEnd,
        page,
        pageSize,
        pageCount
      }
    }
  };
}
function stateWithChapterFactsForPayload(state, factorySnapshot) {
  if (!state || !Array.isArray(factorySnapshot?.chapterFacts)) {
    return state;
  }
  const stageAllowsChapterFactOverlay = state.runtime.stage === "chapter_task_generation" || state.runtime.stage === "drafting" || state.runtime.stage === "reviewing" || state.runtime.stage === "complete";
  if (!stageAllowsChapterFactOverlay) {
    return state;
  }
  const factsByChapter = new Map(
    factorySnapshot.chapterFacts.map((fact) => [Number(fact.chapterNumber), fact])
  );
  const normalizeTaskStatus = (value) => value === "pending" || value === "in_progress" || value === "complete" || value === "blocked" ? value : null;
  const normalizeGateStatus = (value) => value === "passed" || value === "needs_revision" || value === "blocked" ? value : null;
  const timestampMs = (value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return 0;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const nextState = serializeState(state);
  nextState.plan.chapterTasks = state.plan.chapterTasks.map((task) => {
    const fact = factsByChapter.get(Number(task.chapterNumber));
    if (!fact) return task;
    const qualityGate = fact.qualityGate && typeof fact.qualityGate === "object" ? fact.qualityGate : null;
    const factStatus = normalizeTaskStatus(fact.status);
    const gateStatus = normalizeGateStatus(qualityGate?.status);
    const latestTaskStatusAt = timestampMs(fact.latestTaskStatusAt);
    const qualityGateUpdatedAt = timestampMs(
      typeof qualityGate?.updatedAt === "string" ? qualityGate.updatedAt : typeof fact.updatedAt === "string" ? fact.updatedAt : ""
    );
    const recoveryStatusIsCurrent = latestTaskStatusAt > 0 && latestTaskStatusAt > qualityGateUpdatedAt && (fact.latestTaskStatus === "pending" || fact.latestTaskStatus === "in_progress");
    return {
      ...task,
      status: recoveryStatusIsCurrent ? fact.latestTaskStatus : factStatus || task.status,
      recoveryQueuedAt: typeof fact.recoveryQueuedAt === "string" && recoveryStatusIsCurrent ? fact.recoveryQueuedAt : task.recoveryQueuedAt,
      contentQuality: fact.contentQuality && typeof fact.contentQuality === "object" ? fact.contentQuality : task.contentQuality,
      qualityGate: qualityGate && gateStatus ? {
        ...task.qualityGate,
        status: gateStatus,
        score: Number(qualityGate.score || 0),
        attempts: Number(qualityGate.attempts || 0),
        reason: String(qualityGate.reason || ""),
        wordCount: Number.isFinite(Number(qualityGate.wordCount)) ? Number(qualityGate.wordCount) : void 0,
        targetWords: Number.isFinite(Number(qualityGate.targetWords)) ? Number(qualityGate.targetWords) : void 0,
        updatedAt: String(qualityGate.updatedAt || fact.updatedAt || fact.latestEventAt || (/* @__PURE__ */ new Date()).toISOString())
      } : task.qualityGate
    };
  });
  nextState.plan.pendingChapters = nextState.plan.chapterTasks.filter((task) => task.status === "pending").length;
  const hasInProgress = nextState.plan.chapterTasks.some((task) => task.status === "in_progress");
  const hasPending = nextState.plan.chapterTasks.some((task) => task.status === "pending");
  const hasBlocked = nextState.plan.chapterTasks.some((task) => task.status === "blocked");
  if (hasBlocked) {
    nextState.runtime.stage = "reviewing";
  } else if (state.runtime.stage === "chapter_task_generation") {
    nextState.runtime.stage = "chapter_task_generation";
  } else if (hasInProgress || hasPending) {
    nextState.runtime.stage = "drafting";
  } else if (nextState.plan.chapterTasks.length > 0) {
    nextState.runtime.stage = "complete";
  }
  return nextState;
}
function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function createSnapshotVersion(payload) {
  return createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 24);
}
function createStoryFoundationFingerprint(payload) {
  return createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 24);
}
function buildStoryFoundationFingerprintInput({
  planningAssetDetails,
  storyFoundationContract,
  worldMatrix,
  plotArchitecture,
  storyBible,
  volumeStrategy,
  foreshadowingLedger,
  characterDynamics,
  writingPlan
}) {
  return {
    planningAssetDetails,
    storyFoundationContract,
    worldMatrix,
    plotArchitecture,
    storyBible,
    volumeStrategy,
    foreshadowingLedger,
    characterDynamics,
    writingPlan
  };
}
function stripVolatileRowFields(row) {
  const {
    id,
    created_at,
    updated_at,
    lease_expires_at,
    payload_json,
    metadata_json,
    ...rest
  } = row;
  return {
    ...rest,
    ...typeof payload_json === "string" ? { payload_json } : {},
    ...typeof metadata_json === "string" ? { metadata_json } : {}
  };
}
function semanticFactorySnapshotForVersion(factorySnapshot) {
  if (!factorySnapshot) return null;
  const eventRows = Array.isArray(factorySnapshot.latestEvents) ? factorySnapshot.latestEvents : [];
  const filteredEvents = eventRows.filter((row) => row.type !== "JOB_HEARTBEAT");
  const milestoneTypes = /* @__PURE__ */ new Set(["PROJECT_CREATED", "CONSENSUS_UPDATED", "CHAPTER_PIPELINE_COMPLETED"]);
  const milestoneEvents = filteredEvents.filter((row) => milestoneTypes.has(String(row.type || "")));
  const recentNonMilestoneEvents = filteredEvents.filter((row) => !milestoneTypes.has(String(row.type || "")));
  const semanticEvents = [
    ...milestoneEvents,
    ...recentNonMilestoneEvents
  ].filter((row, index, rows) => rows.findIndex((candidate) => String(candidate.id || "") === String(row.id || "")) === index).map(stripVolatileRowFields);
  const jobRows = (rows) => Array.isArray(rows) ? rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    leased: Boolean(row.lease_owner)
  })) : [];
  const messageRows = (rows) => Array.isArray(rows) ? rows.slice(0, 24).map((row) => ({
    id: row.id,
    conversation_id: row.conversation_id,
    type: row.type,
    status: row.status,
    time: row.time,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    data_json: row.data_json,
    metadata_json: row.metadata_json
  })) : [];
  return {
    project: factorySnapshot.project,
    state: factorySnapshot.state,
    projectRuntime: factorySnapshot.projectRuntime,
    artifactSummary: factorySnapshot.artifactSummary,
    productionObservability: factorySnapshot.productionObservability,
    chapterFacts: factorySnapshot.chapterFacts,
    activeJobs: jobRows(factorySnapshot.activeJobs),
    runnableJobs: jobRows(factorySnapshot.runnableJobs),
    latestRuns: Array.isArray(factorySnapshot.latestRuns) ? factorySnapshot.latestRuns.slice(0, 8).map(stripVolatileRowFields) : [],
    latestEvents: semanticEvents,
    artifacts: Array.isArray(factorySnapshot.artifacts) ? factorySnapshot.artifacts.map((row) => ({
      kind: row.kind,
      path: row.path,
      status: row.status,
      version: row.version,
      metadata_json: row.metadata_json
    })) : [],
    messageCount: Array.isArray(factorySnapshot.recentMessages) ? factorySnapshot.recentMessages.length : 0,
    recentMessages: messageRows(factorySnapshot.recentMessages),
    recentMemory: Array.isArray(factorySnapshot.recentMemory) ? factorySnapshot.recentMemory.map((row) => ({
      id: row.id,
      source: row.source,
      kind: row.kind,
      content: row.content,
      embedding_status: row.embedding_status
    })) : [],
    checkpoints: Array.isArray(factorySnapshot.checkpoints) ? factorySnapshot.checkpoints.map(stripVolatileRowFields) : [],
    graphNodes: Array.isArray(factorySnapshot.graphNodes) ? factorySnapshot.graphNodes.map(stripVolatileRowFields) : [],
    graphEdges: Array.isArray(factorySnapshot.graphEdges) ? factorySnapshot.graphEdges.map(stripVolatileRowFields) : []
  };
}
function truncateText(value, maxLength) {
  if (typeof value !== "string" || value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}
function compactSnapshotRow(row, limits = {}) {
  const compacted = { ...row };
  if (typeof compacted.payload_json === "string") {
    compacted.payload_json = truncateText(compacted.payload_json, limits.payload ?? 700);
  }
  if (typeof compacted.metadata_json === "string") {
    compacted.metadata_json = truncateText(compacted.metadata_json, limits.metadata ?? 700);
  }
  if (typeof compacted.content === "string") {
    compacted.content = truncateText(compacted.content, limits.content ?? 260);
  }
  return compacted;
}
function compactFactorySnapshotForPayload(factorySnapshot) {
  if (!factorySnapshot) return factorySnapshot;
  const snapshot = factorySnapshot;
  const eventRows = Array.isArray(snapshot.latestEvents) ? snapshot.latestEvents : [];
  const milestoneTypes = /* @__PURE__ */ new Set(["PROJECT_CREATED", "CONSENSUS_UPDATED", "CHAPTER_PIPELINE_COMPLETED"]);
  const milestoneEvents = eventRows.filter((row) => milestoneTypes.has(String(row.type || "")));
  const recentNonMilestoneEvents = eventRows.filter((row) => !milestoneTypes.has(String(row.type || "")));
  const compactLatestEvents = [
    ...milestoneEvents,
    ...recentNonMilestoneEvents
  ].filter((row, index, rows) => rows.findIndex((candidate) => String(candidate.id || "") === String(row.id || "")) === index).slice(0, 24).map((row) => compactSnapshotRow(row));
  const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
  const isPinnedArtifact = (artifact) => {
    const artifactPath = String(artifact.path || "");
    return artifactPath.includes("global-consensus.md") || artifactPath.includes("/consensus/") || artifactPath.includes("current-context.md") || artifactPath.includes("style/profile.md") || artifactPath.includes("memory/characters/dossiers.json") || artifactPath.includes("discussion-log.md") || artifactPath.includes("setting-freeze.md") || artifactPath.includes("master-outline.md") || artifactPath.includes("chapter-contexts/") || artifactPath.includes("chapter-segments/") || artifactPath.includes("production-resources/");
  };
  const relevantArtifacts = artifacts.filter((artifact) => {
    const artifactPath = String(artifact.path || "");
    return artifactPath.includes("chapter-blueprints/") || artifactPath.includes("chapter-contexts/") || artifactPath.includes("chapter-segments/") || artifactPath.includes(".final.md") || artifactPath.includes("-quality.md") || artifactPath.includes("-memory.md") || artifactPath.includes("master-outline.md") || artifactPath.includes("setting-freeze.md") || artifactPath.includes("global-consensus.md") || artifactPath.includes("/consensus/") || artifactPath.includes("current-context.md") || artifactPath.includes("style/profile.md") || artifactPath.includes("memory/characters/dossiers.json") || artifactPath.includes("discussion-log.md") || artifactPath.includes("production-resources/") || artifact.kind === "transcript";
  });
  const artifactRowsByPath = /* @__PURE__ */ new Map();
  for (const row of [...relevantArtifacts.filter(isPinnedArtifact), ...relevantArtifacts]) {
    const key = String(row.path || row.id || "");
    if (key && !artifactRowsByPath.has(key)) {
      artifactRowsByPath.set(key, row);
    }
  }
  return {
    ...snapshot,
    latestRuns: Array.isArray(snapshot.latestRuns) ? snapshot.latestRuns.slice(0, 6).map((row) => compactSnapshotRow(row)) : [],
    latestEvents: compactLatestEvents,
    artifacts: [...artifactRowsByPath.values()].slice(0, 80).map((row) => compactSnapshotRow(row)),
    recentMemory: Array.isArray(snapshot.recentMemory) ? snapshot.recentMemory.slice(0, 6).map((row) => compactSnapshotRow(row, { content: 260, metadata: 420 })) : [],
    checkpoints: Array.isArray(snapshot.checkpoints) ? snapshot.checkpoints.slice(0, 6).map((row) => compactSnapshotRow(row)) : [],
    graphNodes: Array.isArray(snapshot.graphNodes) ? snapshot.graphNodes.slice(0, 60).map((row) => compactSnapshotRow(row, { metadata: 500 })) : [],
    graphEdges: Array.isArray(snapshot.graphEdges) ? snapshot.graphEdges.slice(0, 80).map((row) => compactSnapshotRow(row, { metadata: 500 })) : []
  };
}
function parseMetadataRow(row) {
  if (!row || typeof row !== "object") return null;
  const metadata = row.metadata;
  if (metadata && typeof metadata === "object") return metadata;
  const metadataJson = row.metadata_json;
  if (typeof metadataJson !== "string" || !metadataJson.trim()) return null;
  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function deriveProductionObservability(factorySnapshot, resolvedState, contextPacket) {
  const snapshot = factorySnapshot || {};
  const state = resolvedState || snapshot.state || null;
  const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
  const recentMemory = Array.isArray(snapshot.recentMemory) ? snapshot.recentMemory : [];
  const chapterFacts = Array.isArray(snapshot.chapterFacts) ? snapshot.chapterFacts : [];
  const creativeProfile = state?.project?.creativeProfile || null;
  const artifactPath = (row) => String(row.path || row.source || "");
  const styleArtifact = artifacts.find((row) => artifactPath(row).includes("style/profile.md")) || null;
  const dossierArtifact = artifacts.find((row) => artifactPath(row).includes("memory/characters/dossiers.json")) || null;
  const characterMemoryRows = recentMemory.filter((row) => String(row.kind || "") === "character_dossiers");
  const chapterMemoryRows = recentMemory.filter((row) => String(row.kind || "") === "chapter_summary");
  const latestQuality = chapterFacts.find((fact) => fact.qualityGate);
  const latestNaturalness = latestQuality?.qualityGate && typeof latestQuality.qualityGate === "object" ? latestQuality.qualityGate.reason || "" : "";
  const estimatedChars = [
    contextPacket,
    state?.project?.idea || "",
    state?.project?.title || "",
    ...(state?.plan?.chapterTasks || []).slice(0, 20).map((task) => `${task.title} ${task.summary}`)
  ].join("\n").length;
  const budgetLimit = 24e3;
  const budgetPercent = budgetLimit > 0 ? Math.min(100, Math.round(estimatedChars / budgetLimit * 100)) : 0;
  const contextSections = [
    { key: "contextPacket", label: "Context packet", chars: contextPacket.length },
    { key: "chapterWindow", label: "Chapter window", chars: (state?.plan?.chapterTasks || []).slice(0, 20).map((task) => `${task.title} ${task.summary}`).join("\n").length },
    { key: "creativeProfile", label: "Creative profile", chars: JSON.stringify(creativeProfile || {}).length }
  ];
  const missingStyle = [
    !creativeProfile?.genre ? "genre" : "",
    !creativeProfile?.readerPromise ? "reader promise" : "",
    !creativeProfile?.styleFingerprint || /pending sample|first-chapter extraction/i.test(String(creativeProfile.styleFingerprint)) ? "style fingerprint" : "",
    !creativeProfile?.naturalnessTarget ? "naturalness target" : ""
  ].filter(Boolean);
  const dossierCount = Array.isArray(state?.memory?.characterDossiers) ? state.memory.characterDossiers.length : 0;
  const effectiveCharacterMemoryRows = Math.max(characterMemoryRows.length, dossierCount);
  const incompleteDossierFields = (state?.memory?.characterDossiers || []).flatMap((dossier) => {
    const missing = [
      !dossier.coreDesire ? "desire" : "",
      !dossier.behaviorHabits?.length ? "habit" : "",
      !dossier.speechMarkers?.length ? "speech" : "",
      !dossier.relationshipState ? "relationship" : ""
    ].filter(Boolean);
    return missing.length ? [`${dossier.canonicalName || dossier.id}: ${missing.join(", ")}`] : [];
  }).slice(0, 6);
  const memoryLag = Math.max(0, chapterFacts.filter((fact) => fact.status === "complete").length - chapterMemoryRows.length);
  const now = /* @__PURE__ */ new Date();
  const activeJobs = Array.isArray(snapshot.activeJobs) ? snapshot.activeJobs : [];
  const staleJobsList = activeJobs.filter((job) => {
    if (!job.lease_expires_at) return false;
    return new Date(String(job.lease_expires_at)) < now;
  }).map((job) => ({
    id: String(job.id || ""),
    kind: String(job.kind || ""),
    leaseOwner: String(job.lease_owner || ""),
    leaseExpiresAt: String(job.lease_expires_at || "")
  }));
  const blockedChaptersList = (state?.plan?.chapterTasks || []).filter((task) => task.status === "blocked").map((task) => {
    const fact = chapterFacts.find((f) => Number(f.chapterNumber) === task.chapterNumber);
    return {
      chapterNumber: task.chapterNumber,
      title: task.title,
      recoveryAttempts: task.recoveryAttempts || 0,
      recoveryBlocked: Boolean(task.recoveryBlocked),
      blockReason: fact?.qualityGate && typeof fact.qualityGate === "object" ? fact.qualityGate.reason || "\u672A\u77E5\u95E8\u7981\u62E6\u622A" : "\u672A\u77E5\u95E8\u7981\u62E6\u622A"
    };
  });
  const knowledgeObj = snapshot.knowledge || {};
  const summaryObj = knowledgeObj.summary || {};
  const diagnostics = {
    blockedChapters: blockedChaptersList,
    latestGateReason: blockedChaptersList[0]?.blockReason || "",
    contextBudgetOverages: {
      isOverages: estimatedChars > budgetLimit,
      estimatedChars,
      budgetLimit,
      overageChars: Math.max(0, estimatedChars - budgetLimit)
    },
    ragRecall: {
      projectSources: Number(summaryObj.projectSources || 0),
      globalSources: Number(summaryObj.globalSources || 0),
      recentRecallCount: recentMemory.filter((row) => String(row.kind || "") === "rag").length
    },
    characterDossierGaps: incompleteDossierFields,
    workerLeaseIssues: {
      hasIssues: staleJobsList.length > 0,
      staleJobs: staleJobsList
    },
    memoryEmbeddingBacklog: recentMemory.filter((row) => String(row.embedding_status || "") === "pending").length
  };
  return {
    style: {
      status: missingStyle.length === 0 ? "ready" : missingStyle.length <= 1 ? "warning" : "needs_setup",
      genre: creativeProfile?.genre || "",
      readerPromise: creativeProfile?.readerPromise || "",
      pointOfView: creativeProfile?.pointOfView || "",
      tone: creativeProfile?.tone || "",
      naturalnessTarget: creativeProfile?.naturalnessTarget || "",
      styleFingerprint: creativeProfile?.styleFingerprint || "",
      artifactPath: styleArtifact ? artifactPath(styleArtifact) : ".ai-novel/style/profile.md",
      updatedAt: styleArtifact?.updated_at || styleArtifact?.created_at || "",
      missing: missingStyle
    },
    characterDossier: {
      status: dossierCount > 0 && incompleteDossierFields.length === 0 ? "ready" : dossierCount > 0 ? "warning" : "needs_setup",
      count: dossierCount,
      artifactPath: dossierArtifact ? artifactPath(dossierArtifact) : ".ai-novel/memory/characters/dossiers.json",
      updatedAt: dossierArtifact?.updated_at || dossierArtifact?.created_at || "",
      memoryRows: effectiveCharacterMemoryRows,
      missing: incompleteDossierFields
    },
    memoryRecall: {
      status: effectiveCharacterMemoryRows > 0 && memoryLag <= 1 ? "ready" : memoryLag > 2 ? "warning" : "indexing",
      characterRows: effectiveCharacterMemoryRows,
      chapterRows: chapterMemoryRows.length,
      memoryLag,
      latestSource: String(recentMemory[0]?.source || dossierArtifact?.path || ".ai-novel/memory/characters/dossiers.json"),
      latestKind: String(recentMemory[0]?.kind || (effectiveCharacterMemoryRows > 0 ? "character_dossiers" : "")),
      pendingEmbeddings: recentMemory.filter((row) => String(row.embedding_status || "") === "pending").length
    },
    contextBudget: {
      status: budgetPercent >= 90 ? "warning" : budgetPercent >= 70 ? "watch" : "ready",
      estimatedChars,
      budgetLimit,
      budgetPercent,
      sections: contextSections
    },
    qualitySignals: {
      latestNaturalnessReason: String(latestNaturalness || ""),
      completedChapters: chapterFacts.filter((fact) => fact.status === "complete").length,
      blockedChapters: chapterFacts.filter((fact) => fact.status === "blocked").length
    },
    metadata: {
      styleMetadata: parseMetadataRow(styleArtifact),
      dossierMetadata: parseMetadataRow(dossierArtifact)
    },
    diagnostics
  };
}
async function deriveProductionReadiness(projectRoot, factorySnapshot, resolvedState, consensus, productionObservability) {
  const snapshot = factorySnapshot || {};
  const state = resolvedState || snapshot.state || null;
  const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
  const artifactPath = (artifact) => String(artifact.path || artifact.source || "");
  const planningArtifactCount = artifacts.filter((artifact) => {
    const value = artifactPath(artifact);
    return /master-outline|setting-freeze|story-bible|plot-architecture|book-contract|world-matrix|volume-strategy|plans\//iu.test(value);
  }).length;
  const requiredPlanningAssets = [
    "world-matrix.md",
    "plot-architecture.md",
    "story-bible.md",
    "volume-strategy.md",
    "foreshadowing-ledger.md",
    "character-dynamics.md",
    "story-foundation-contract.json",
    "world-matrix.json",
    "plot-architecture.json",
    "story-bible.json",
    "volume-strategy.json",
    "foreshadowing-ledger.json",
    "character-dynamics.json",
    "writing-plan.json"
  ];
  const hasArtifactPath = (needle) => artifacts.some((artifact) => artifactPath(artifact).includes(needle));
  const hasWorkspaceArtifact = async (artifactRelativePath) => {
    const text = await readWorkspaceArtifactText(projectRoot, artifactRelativePath);
    return Boolean(text?.trim());
  };
  const artifactSummary = snapshot.artifactSummary && typeof snapshot.artifactSummary === "object" ? snapshot.artifactSummary : {};
  const blueprintCount = Number(artifactSummary.blueprints || artifacts.filter((artifact) => artifactPath(artifact).includes("chapter-blueprints/")).length);
  const totalChapters = Number(state?.plan?.totalChapters || snapshot.project?.totalChapters || 0);
  const planningAssetDetails = await Promise.all(requiredPlanningAssets.map(async (required) => {
    const pathValue = `.ai-novel/plans/${required}`;
    const present = hasArtifactPath(required) || await hasWorkspaceArtifact(pathValue);
    const issue = present && required.endsWith(".json") ? planningAssetStructuralIssue(required, await readWorkspaceArtifactJson(projectRoot, pathValue), totalChapters) : "";
    return {
      key: required.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
      label: required,
      path: pathValue,
      status: present && !issue ? "passed" : "blocked",
      detail: present ? issue || "\u5DF2\u751F\u6210" : "\u7F3A\u5931"
    };
  }));
  const presentPlanningAssets = planningAssetDetails.filter((asset) => asset.status === "passed").map((asset) => asset.label);
  const missingPlanningAssets = requiredPlanningAssets.filter((required) => !presentPlanningAssets.includes(required));
  const requiredPlanningAssetCount = presentPlanningAssets.length;
  const storyFoundationApproval = await loadStoryFoundationApproval(projectRoot);
  const storyFoundationApproved = isStoryFoundationApproved(storyFoundationApproval);
  const storyFoundationApprovalFingerprint = typeof storyFoundationApproval?.assetFingerprint === "string" ? String(storyFoundationApproval.assetFingerprint) : "";
  const characterDossier = productionObservability.characterDossier || {};
  const memoryRecall = productionObservability.memoryRecall || {};
  const contextBudget = productionObservability.contextBudget || {};
  const diagnostics = productionObservability.diagnostics || {};
  const hasDossiers = hasArtifactPath("memory/characters/dossiers.json") || await hasWorkspaceArtifact(".ai-novel/memory/characters/dossiers.json");
  const hasCharacterDynamicsAsset = hasArtifactPath("plans/character-dynamics.json") || await hasWorkspaceArtifact(".ai-novel/plans/character-dynamics.json");
  const hasRelationships = hasArtifactPath("memory/characters/relationships.json") || await hasWorkspaceArtifact(".ai-novel/memory/characters/relationships.json") || hasCharacterDynamicsAsset;
  const hasStyleContractArtifact = await hasWorkspaceArtifact(".ai-novel/style/evolution/style-contract.json") || await hasWorkspaceArtifact(".ai-novel/style/evolution/user-approved-sample.md");
  const chapterStyleInheritance = await summarizeChapterStyleInheritanceManifests(projectRoot);
  let styleGate = null;
  let styleContractVerificationStatus = "";
  try {
    const styleEvolution = await loadStyleEvolution(projectRoot);
    styleGate = styleEvolution.gate;
    styleContractVerificationStatus = String(styleEvolution.contract?.verification?.status || "");
  } catch {
    styleGate = null;
    styleContractVerificationStatus = "";
  }
  const hasFrozenStyleContract = styleGate?.status === "passed" || styleContractVerificationStatus === "passed";
  const storyFoundationAssetFingerprint = createStoryFoundationFingerprint(buildStoryFoundationFingerprintInput({
    planningAssetDetails,
    storyFoundationContract: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/story-foundation-contract.json"),
    worldMatrix: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/world-matrix.json"),
    plotArchitecture: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/plot-architecture.json"),
    storyBible: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/story-bible.json"),
    volumeStrategy: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/volume-strategy.json"),
    foreshadowingLedger: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/foreshadowing-ledger.json"),
    characterDynamics: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/character-dynamics.json"),
    writingPlan: await readWorkspaceArtifactJson(projectRoot, ".ai-novel/plans/writing-plan.json")
  }));
  const characterAssetDetails = [
    {
      key: "character_dossiers",
      label: "\u4EBA\u7269\u6863\u6848",
      path: ".ai-novel/memory/characters/dossiers.json",
      status: hasDossiers ? "passed" : "blocked",
      detail: hasDossiers ? `${Number(characterDossier.count || 0)} \u4E2A\u6863\u6848` : "\u7F3A\u5931"
    },
    {
      key: "relationship_graph",
      label: "\u4EBA\u7269\u5173\u7CFB\u56FE",
      path: ".ai-novel/memory/characters/relationships.json",
      status: hasRelationships ? "passed" : "blocked",
      detail: hasRelationships ? "\u5DF2\u751F\u6210" : "\u7F3A\u5931"
    }
  ];
  const executionAssetDetails = [
    {
      key: "chapter_blueprints",
      label: "\u7AE0\u8282\u84DD\u56FE",
      path: ".ai-novel/chapter-blueprints/",
      status: totalChapters > 0 && blueprintCount >= totalChapters ? "passed" : "blocked",
      detail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} \u4E2A\u84DD\u56FE`
    },
    {
      key: "style_contract",
      label: "\u5199\u6CD5\u5408\u540C",
      path: ".ai-novel/style/evolution/style-contract.json",
      status: hasFrozenStyleContract ? "passed" : "blocked",
      detail: hasFrozenStyleContract ? "\u5DF2\u51BB\u7ED3" : hasStyleContractArtifact ? "\u6587\u4EF6\u5B58\u5728\u4F46\u9A8C\u8BC1\u95E8\u672A\u901A\u8FC7" : "\u5F85\u786E\u8BA4"
    },
    ...chapterStyleInheritance.total > 0 ? [{
      key: "chapter_style_inheritance",
      label: "\u7AE0\u8282\u5199\u6CD5\u7EE7\u627F",
      path: ".ai-novel/chapters/*.versions.json",
      status: chapterStyleInheritance.blocked > 0 || chapterStyleInheritance.missing > 0 || chapterStyleInheritance.pending > 0 ? "blocked" : chapterStyleInheritance.warning > 0 ? "warning" : "passed",
      detail: chapterStyleInheritance.blocked > 0 ? `${chapterStyleInheritance.blocked}/${chapterStyleInheritance.total} \u7AE0\u963B\u585E\uFF1A${chapterStyleInheritance.latestBlocked}` : chapterStyleInheritance.missing > 0 ? `${chapterStyleInheritance.missing}/${chapterStyleInheritance.total} \u7AE0\u7F3A\u5C11\u7EE7\u627F\u9A8C\u8BC1` : chapterStyleInheritance.pending > 0 ? `${chapterStyleInheritance.pending}/${chapterStyleInheritance.total} \u7AE0\u5F85\u9A8C\u8BC1` : chapterStyleInheritance.warning > 0 ? `${chapterStyleInheritance.ready}/${chapterStyleInheritance.total} \u7AE0\u901A\u8FC7\uFF0C${chapterStyleInheritance.warning} \u7AE0\u5F85\u8865\u5F3A` : `${chapterStyleInheritance.ready}/${chapterStyleInheritance.total} \u7AE0\u901A\u8FC7`
    }] : []
  ];
  const chapterStyleInheritanceAsset = executionAssetDetails.find((asset) => asset.key === "chapter_style_inheritance");
  const productionReadiness = evaluateProductionReadiness({
    consensusText: consensus,
    planningArtifactCount,
    planningRequiredAssetCount: requiredPlanningAssetCount,
    planningRequiredAssets: requiredPlanningAssets,
    planningMissingRequiredAssets: missingPlanningAssets,
    planningAssetDetails,
    storyFoundationApproved,
    storyFoundationApprovalPath: `.ai-novel/plans/${STORY_FOUNDATION_APPROVAL_FILE}`,
    storyFoundationApprovedAt: typeof storyFoundationApproval?.approvedAt === "string" ? storyFoundationApproval.approvedAt : void 0,
    storyFoundationApprovalFingerprint,
    storyFoundationAssetFingerprint,
    characterAssetDetails,
    executionAssetDetails,
    blueprintCount,
    totalChapters,
    characterDossierCount: Number(characterDossier.count || 0),
    characterDossierGaps: Array.isArray(characterDossier.missing) ? characterDossier.missing.map(String) : [],
    styleGate,
    memoryRecallRows: Number(memoryRecall.characterRows || 0) + Number(memoryRecall.chapterRows || 0),
    memoryLag: Number(memoryRecall.memoryLag || 0),
    contextBudgetPercent: Number(contextBudget.budgetPercent || 0),
    contextOverBudget: Boolean(diagnostics.contextBudgetOverages?.isOverages)
  });
  if (chapterStyleInheritanceAsset?.status === "blocked") {
    const issue = {
      code: "chapter_style_inheritance_blocked",
      severity: "critical",
      message: chapterStyleInheritanceAsset.detail || "\u7AE0\u8282\u5199\u6CD5\u7EE7\u627F / \u6F02\u79FB\u9A8C\u8BC1\u4ECD\u5728\u963B\u585E\uFF0C\u4E0D\u80FD\u8FDB\u5165\u53D1\u5E03\u7EA7\u751F\u4EA7\u3002",
      action: "\u5148\u4FEE\u590D blocked / pending / missing \u7684\u7AE0\u8282 styleInheritanceVerification\uFF0C\u518D\u7EE7\u7EED\u6B63\u6587\u751F\u4EA7\u6216\u53D1\u5E03\u3002"
    };
    return {
      ...productionReadiness,
      status: "blocked",
      canProceed: false,
      blockedReason: issue.message,
      summary: productionReadiness.summary.includes("\u963B\u585E") ? productionReadiness.summary : `1 \u9879\u963B\u585E\u6B63\u6587\u751F\u4EA7\uFF1A${issue.message}`,
      issues: [
        ...productionReadiness.issues.filter((existing) => existing.code !== issue.code),
        issue
      ]
    };
  }
  return productionReadiness;
}
function normalizeAutopilotRuntimeForPayload(state, factorySnapshot) {
  if (!state?.runtime?.autopilot) return state;
  const activeJobs = Array.isArray(factorySnapshot?.activeJobs) ? factorySnapshot.activeJobs : [];
  const hasRunningJob = activeJobs.some((job) => job && job.status !== "paused" && job.status !== "failed" && job.status !== "completed");
  if (hasRunningJob) {
    if (state.runtime.autopilot.running) {
      return state;
    }
    return {
      ...state,
      runtime: {
        ...state.runtime,
        statusMessage: "\u81EA\u52A8\u521B\u4F5C\u8FD0\u884C\u4E2D\uFF1A\u540E\u53F0 worker \u5DF2\u9886\u53D6\u4EFB\u52A1\uFF0C\u6B63\u5728\u6309\u6570\u636E\u5E93\u8FDB\u5EA6\u7EE7\u7EED\u63A8\u8FDB\u3002",
        autopilot: {
          ...state.runtime.autopilot,
          running: true,
          stopRequested: false,
          mode: "background",
          lastStep: state.runtime.autopilot.lastStep === "stopped" ? "worker:running" : state.runtime.autopilot.lastStep,
          statusMessage: "\u540E\u53F0 worker \u6B63\u5728\u6267\u884C\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u3002"
        }
      }
    };
  }
  if (!state.runtime.autopilot.running && !state.runtime.autopilot.stopRequested) {
    return state;
  }
  return {
    ...state,
    runtime: {
      ...state.runtime,
      statusMessage: state.runtime.statusMessage || "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5F53\u524D\u672A\u8FD0\u884C\u3002",
      autopilot: {
        ...state.runtime.autopilot,
        running: false,
        stopRequested: false,
        mode: "idle",
        lastStep: "stopped",
        statusMessage: state.runtime.autopilot.statusMessage || "\u6570\u636E\u5E93\u4E2D\u6CA1\u6709\u53EF\u6267\u884C\u7684\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\uFF1B\u5F53\u524D\u6CA1\u6709\u540E\u53F0 worker \u5728\u8FD0\u884C\u3002"
      }
    }
  };
}
async function reconcileCoverStateFromMetadata(projectRoot, state) {
  if (!state?.assets?.cover) {
    return state;
  }
  const cover = state.assets.cover;
  const metadataPath = path.join(projectRoot, ".ai-novel", "assets", "cover", "cover-metadata.json");
  const metadata = await fs.readFile(metadataPath, "utf8").then((raw) => JSON.parse(raw)).catch(() => null);
  if (!metadata || typeof metadata.status !== "string") {
    return state;
  }
  const metadataStatus = metadata.status;
  if (metadataStatus !== "complete" && metadataStatus !== "failed") {
    return state;
  }
  if (cover.status === metadataStatus && cover.metadataPath && (metadataStatus !== "failed" || cover.error)) {
    return state;
  }
  cover.status = metadataStatus;
  cover.promptPath = typeof metadata.promptPath === "string" ? metadata.promptPath : cover.promptPath || ".ai-novel/assets/cover/cover-prompt.md";
  cover.imagePath = typeof metadata.imagePath === "string" ? metadata.imagePath : cover.imagePath || ".ai-novel/assets/cover/cover.png";
  cover.metadataPath = ".ai-novel/assets/cover/cover-metadata.json";
  if (typeof metadata.briefPath === "string") {
    cover.briefPath = metadata.briefPath;
  }
  if (metadataStatus === "complete") {
    cover.generatedAt = typeof metadata.generatedAt === "string" ? metadata.generatedAt : cover.generatedAt;
    delete cover.error;
  } else {
    cover.error = typeof metadata.error === "string" ? metadata.error : cover.error || "cover_generation_failed";
  }
  return state;
}
async function createWorkspacePayload(projectRoot, state, options = {}) {
  const diskState = options.syncState ? await tryLoadState(projectRoot) : null;
  const factorySnapshot = options.rootDir && options.projectId ? await withFactoryDb(options.rootDir, async (db) => db.getSnapshot(options.projectId)).catch(() => null) : null;
  const rawResolvedState = normalizeAutopilotRuntimeForPayload(
    factorySnapshot?.state ?? state ?? diskState,
    factorySnapshot
  );
  const coverReconciledState = await reconcileCoverStateFromMetadata(projectRoot, rawResolvedState);
  const resolvedState = stateWithChapterFactsForPayload(coverReconciledState, factorySnapshot);
  const serializedResolvedState = resolvedState ? stableJson(serializeState(resolvedState)) : null;
  const serializedDiskState = diskState ? stableJson(serializeState(diskState)) : null;
  const serializedDbState = factorySnapshot?.state ? stableJson(serializeState(factorySnapshot.state)) : null;
  const shouldPersistResolvedState = options.syncState && resolvedState && serializedResolvedState && serializedDiskState && serializedDiskState !== serializedResolvedState;
  if (shouldPersistResolvedState) {
    await saveAutonomousState(projectRoot, resolvedState).catch(() => void 0);
  }
  if (options.syncState && resolvedState) {
    await syncCurrentContextPacketState(projectRoot, resolvedState).catch(() => void 0);
  }
  const shouldSyncDbState = options.syncState && options.rootDir && options.projectId && resolvedState && serializedResolvedState && serializedDbState && serializedDbState !== serializedResolvedState;
  if (shouldSyncDbState) {
    await withFactoryDb(options.rootDir, async (db) => {
      db.updateProjectState(options.projectId, resolvedState);
    }).catch(() => void 0);
  }
  const dbGraph = factorySnapshot && options.projectId && factorySnapshot.graphNodes.length > 0 ? superGraphFromDbRows(options.projectId, factorySnapshot.graphNodes, factorySnapshot.graphEdges) : null;
  const graphDir = path.join(projectRoot, ".ai-novel", "graph");
  const fileGraphIndex = await fs.readFile(path.join(graphDir, "index.json"), "utf8").then((raw) => JSON.parse(raw)).catch(() => null);
  const fileGraphViolations = await fs.readFile(path.join(graphDir, "violations.json"), "utf8").then((raw) => JSON.parse(raw)).catch(() => []);
  const graphIndex = dbGraph ? buildSuperGraphIndex(dbGraph) : fileGraphIndex;
  const graphViolations = dbGraph ? validateSuperGraph(dbGraph) : fileGraphViolations;
  const useCompactPayload = options.includeTranscript === false || options.compactPayload === true;
  const compactState = useCompactPayload ? compactStateForPayload(resolvedState, {
    chapterPage: options.chapterPage,
    chapterPageSize: options.chapterPageSize
  }) : resolvedState ? serializeState(resolvedState) : null;
  const consensus = await readWorkspaceText(projectRoot, "prompts", "global-consensus.md");
  const contextPacket = await readWorkspaceText(projectRoot, "context", "current-context.md");
  const productionObservability = deriveProductionObservability(
    factorySnapshot,
    resolvedState,
    contextPacket
  );
  const productionReadiness = await deriveProductionReadiness(
    projectRoot,
    factorySnapshot,
    resolvedState,
    consensus,
    productionObservability
  );
  const projectRuntime = deriveProjectRuntimeState({
    state: resolvedState,
    factorySnapshot
  });
  const compactFactorySnapshot = factorySnapshot ? {
    ...factorySnapshot,
    state: compactState,
    productionObservability,
    productionReadiness,
    projectRuntime
  } : null;
  const responseFactorySnapshot = useCompactPayload ? compactFactorySnapshotForPayload(compactFactorySnapshot) : compactFactorySnapshot;
  const payload = {
    state: compactState,
    projectRuntime,
    consensus,
    contextPacket,
    graphIndex,
    graphViolations,
    productionReadiness,
    factorySnapshot: responseFactorySnapshot
  };
  const snapshotVersion = createSnapshotVersion({
    state: compactState,
    projectRuntime,
    consensus,
    contextPacket,
    graphViolations,
    factorySnapshot: semanticFactorySnapshotForVersion(responseFactorySnapshot)
  });
  if (options.includeTranscript !== false) {
    const transcript = await readDiscussionTranscript(projectRoot);
    const messageEntries = discussionEntriesFromSnapshot(factorySnapshot);
    return {
      ...payload,
      snapshotVersion,
      transcript,
      ...messageEntries ? { ...messageEntries, meta: { ...messageEntries.meta, transcriptBytes: Buffer.byteLength(transcript) } } : parseTranscriptEntries(transcript)
    };
  }
  return {
    ...payload,
    snapshotVersion
  };
}
async function tryLoadState(projectRoot) {
  try {
    return await loadAutonomousState(projectRoot);
  } catch {
    return null;
  }
}
function tryParseJsonText(text) {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
async function readWorkspaceJson(projectRoot, ...parts) {
  return tryParseJsonText(await readWorkspaceText(projectRoot, ...parts));
}
function truncateReaderText(text = "", maxLength = 4200) {
  const normalized = String(text).trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}
...`;
}
function stripWrappingFence(text) {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : trimmed;
}
function cleanReaderChapterText(raw) {
  const text = stripWrappingFence(raw).replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  const startMarkers = [
    /^##\s+(?:Final Body|Reviewed Body|Draft Body|正文|最终正文|修订正文|草稿正文)\s*$/im
  ];
  let startIndex = 0;
  for (const marker of startMarkers) {
    const match = marker.exec(text);
    if (match) {
      startIndex = (match.index || 0) + match[0].length;
      break;
    }
  }
  const body = text.slice(startIndex);
  const stopPattern = /^##+\s+(?:Naturalness Pass|Naturalness Report|Quality Gate|Drafting Metadata|Polish Pass|Revision Attempt|Semantic Preservation|Risk Flags|Patch Summary|Memory|Chapter Memory|Chapter Quality Report|AIGC|AIGC Report|章节元数据|章节元信息|质量门禁|自然度报告|自然度处理|润色报告|修订记录|记忆|章节记忆)\b.*$/gim;
  const stopMatch = stopPattern.exec(body);
  const withoutReports = (stopMatch ? body.slice(0, stopMatch.index) : body).trim();
  return withoutReports.replace(/^---\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
function readerChapterTitleFromText(cleaned, fallback, chapterNumber) {
  const heading = cleaned.match(/^#\s+(.+)$/m) || cleaned.match(/^第[一二三四五六七八九十百千万0-9]+[章节回][\s　:：-]*(.+)$/m);
  if (heading?.[1]) return heading[1].trim();
  return fallback || `\u7B2C ${chapterNumber} \u7AE0`;
}
function readerChapterTitleFromRaw(raw, fallback, chapterNumber) {
  const heading = raw.match(/^#\s+(.+)$/m);
  if (heading?.[1]) return heading[1].trim();
  return readerChapterTitleFromText(raw, fallback, chapterNumber);
}
function readerWordCount(text) {
  const compact = String(text).replace(/\s+/g, "");
  return compact.length;
}
async function readReaderChapterVersionManifest(projectRoot, chapterNumber) {
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`;
  const text = await readWorkspaceArtifactText(projectRoot, `.ai-novel/chapters/${chapterId}.versions.json`);
  const parsed = text ? tryParseJsonText(text) : null;
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed;
  const versions = Array.isArray(record.versions) ? record.versions.filter((entry) => entry && typeof entry === "object" && typeof entry.path === "string").map((entry) => ({
    id: String(entry.id || entry.source || ""),
    label: String(entry.label || entry.id || entry.source || ""),
    source: String(entry.source || entry.id || ""),
    path: String(entry.path || ""),
    wordCount: Number(entry.wordCount || 0),
    status: String(entry.status || ""),
    createdAt: String(entry.createdAt || "")
  })).filter((entry) => entry.id && entry.path) : [];
  if (!versions.length) return null;
  const publishedVersionId = String(record.publishedVersionId || "final");
  return {
    version: Number(record.version || 1),
    chapterNumber,
    chapterTitle: String(record.chapterTitle || ""),
    publishedVersionId,
    locked: Boolean(record.locked),
    status: String(record.status || ""),
    writingMode: String(record.writingMode || ""),
    targetWords: Number(record.targetWords || 0),
    wordCount: Number(record.wordCount || 0),
    updatedAt: String(record.updatedAt || ""),
    qualityGate: record.qualityGate || null,
    aigcDetection: record.aigcDetection || null,
    chapterInheritanceAdapter: record.chapterInheritanceAdapter && typeof record.chapterInheritanceAdapter === "object" ? record.chapterInheritanceAdapter : null,
    styleConformanceDrift: record.styleConformanceDrift && typeof record.styleConformanceDrift === "object" ? record.styleConformanceDrift : null,
    styleInheritanceVerification: record.styleInheritanceVerification && typeof record.styleInheritanceVerification === "object" ? record.styleInheritanceVerification : null,
    artifacts: record.artifacts && typeof record.artifacts === "object" ? record.artifacts : {},
    publishReadiness: record.publishReadiness && typeof record.publishReadiness === "object" ? record.publishReadiness : null,
    versions
  };
}
function hasUsableStyleFingerprint(value) {
  const fingerprint = String(value || "").trim();
  return Boolean(fingerprint && !/pending sample|first-chapter extraction/i.test(fingerprint));
}
function normalizeReaderVerificationStatus(value) {
  const status = String(value || "").trim();
  if (status === "ready" || status === "passed" || status === "conformant") return "ready";
  if (status === "warning") return "warning";
  if (status === "blocked" || status === "drifted") return "blocked";
  return "pending";
}
async function loadReaderStyleContext(projectRoot, state) {
  let styleEvolution = null;
  let styleEvolutionAssets = null;
  try {
    styleEvolution = await loadStyleEvolution(projectRoot);
    styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(projectRoot);
  } catch {
    styleEvolution = null;
    styleEvolutionAssets = null;
  }
  const creativeProfile = state?.project?.creativeProfile && typeof state.project.creativeProfile === "object" ? state.project.creativeProfile : null;
  return {
    styleEvolution,
    styleEvolutionAssets,
    creativeProfile
  };
}
function buildReaderStyleInheritanceVerification(input) {
  const manifest = input.manifest && typeof input.manifest === "object" ? input.manifest : null;
  const persisted = manifest?.styleInheritanceVerification && typeof manifest.styleInheritanceVerification === "object" ? manifest.styleInheritanceVerification : null;
  const styleEvolution = input.styleEvolution || null;
  const contract = styleEvolution?.contract || null;
  const styleEvolutionAssets = input.styleEvolutionAssets || null;
  const creativeProfile = input.creativeProfile || null;
  const approvedVersion = Number(contract?.loop?.approvalVersion || contract?.approval?.approvedVersion || 0);
  const contractApproved = Boolean(contract?.approvedAt || approvedVersion);
  const inheritanceStatus = String(contract?.inheritance?.status || "");
  const inheritedRules = Array.isArray(contract?.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules : [];
  const inheritedArtifacts = Array.isArray(contract?.inheritance?.inheritedArtifacts) ? contract.inheritance.inheritedArtifacts : [];
  const freezerVerdict = String(contract?.freezer?.verdict || "");
  const persistedAdapter = manifest?.chapterInheritanceAdapter && typeof manifest.chapterInheritanceAdapter === "object" ? manifest.chapterInheritanceAdapter : null;
  const persistedAdapterStatus = String(persistedAdapter?.status || "");
  const adapterMissing = Boolean(manifest && contractApproved && !persistedAdapter);
  const persistedAdapterVersion = Number(persistedAdapter?.contractVersion || 0);
  const adapterVersionChanged = Boolean(
    approvedVersion > 0 && persistedAdapterVersion > 0 && persistedAdapterVersion !== approvedVersion
  );
  const styleFingerprint = String(creativeProfile?.styleFingerprint || "").trim();
  const styleFingerprintReady = hasUsableStyleFingerprint(styleFingerprint);
  const freezeAssets = styleEvolutionAssets?.freezePackage || null;
  const chapterInheritanceAssets = styleEvolutionAssets?.chapterInheritance || null;
  const freezeAssetsReady = Boolean(
    freezeAssets?.approvedSample?.exists && freezeAssets?.freezeLedger?.exists && freezeAssets?.loopRuntime?.exists
  );
  const inheritanceAssetsReady = Boolean(
    chapterInheritanceAssets?.rulebook?.exists && chapterInheritanceAssets?.references?.exists && chapterInheritanceAssets?.antiPatterns?.exists
  );
  const qualityGate = manifest?.qualityGate && typeof manifest.qualityGate === "object" ? manifest.qualityGate : null;
  const qualityGateStatus = String(qualityGate?.status || "");
  const qualityGateReason = String(qualityGate?.reason || qualityGate?.summary || "").trim();
  const aigcDetection = manifest?.aigcDetection && typeof manifest.aigcDetection === "object" ? manifest.aigcDetection : null;
  const aigcStatus = String(aigcDetection?.status || "");
  const aigcScore = typeof aigcDetection?.score === "number" ? Number(aigcDetection.score) : null;
  const aigcThreshold = typeof aigcDetection?.threshold === "number" ? Number(aigcDetection.threshold) : null;
  const aigcHighRiskSegments = Array.isArray(aigcDetection?.highRiskSegments) ? aigcDetection.highRiskSegments : [];
  const aigcHighRiskCount = aigcHighRiskSegments.length;
  const baseMissing = input.baseChecks.filter((check) => !check.passed);
  const baseMissingLabels = baseMissing.map((check) => check.label);
  const styleConformanceDrift = manifest?.styleConformanceDrift && typeof manifest.styleConformanceDrift === "object" ? manifest.styleConformanceDrift : null;
  const verificationStatus = String(contract?.verification?.status || contract?.loop?.verificationStatus || "");
  const currentContractBlocks = !contractApproved || inheritanceStatus !== "enforced" || verificationStatus !== "passed" || freezerVerdict !== "ready" || adapterMissing || persistedAdapterStatus === "blocked" || adapterVersionChanged;
  if (styleConformanceDrift) {
    const driftStatus = String(styleConformanceDrift.status || "pending");
    const driftBlocked = driftStatus === "drifted";
    const driftPending = driftStatus === "pending";
    const driftWarning = driftStatus === "warning";
    const driftEvidence = Array.isArray(styleConformanceDrift.evidence) ? styleConformanceDrift.evidence : [];
    const driftRisks = Array.isArray(styleConformanceDrift.risks) ? styleConformanceDrift.risks : [];
    const metrics = styleConformanceDrift.metrics && typeof styleConformanceDrift.metrics === "object" ? styleConformanceDrift.metrics : {};
    const contractRisks = [
      !contractApproved ? "\u6574\u4E66\u5199\u6CD5\u5408\u540C\u5C1A\u672A\u51BB\u7ED3\uFF0C\u5F53\u524D\u7AE0\u8282\u65E0\u6CD5\u5B8C\u6210\u4E25\u683C\u7EE7\u627F\u9A8C\u8BC1\u3002" : "",
      contractApproved && inheritanceStatus !== "enforced" ? `\u5199\u6CD5\u7EE7\u627F\u72B6\u6001\u5F53\u524D\u4E3A ${inheritanceStatus || "missing"}\u3002` : "",
      contractApproved && verificationStatus !== "passed" ? `\u5F53\u524D\u51BB\u7ED3\u5199\u6CD5\u5408\u540C Generation Verification Gate \u72B6\u6001\u4E3A ${verificationStatus || "missing"}\u3002` : "",
      contractApproved && freezerVerdict !== "ready" ? `\u5F53\u524D\u51BB\u7ED3\u5199\u6CD5\u5408\u540C Style Contract Freezer verdict \u4E3A ${freezerVerdict || "missing"}\u3002` : "",
      adapterMissing ? "\u7AE0\u8282\u7248\u672C\u6E05\u5355\u7F3A\u5C11 Chapter Inheritance Adapter\uFF0C\u4E0D\u80FD\u8BC1\u660E\u6B63\u6587\u7EE7\u627F\u4E86\u5F53\u524D\u51BB\u7ED3\u5408\u540C\u3002" : "",
      persistedAdapterStatus === "blocked" ? "\u7AE0\u8282\u4FDD\u5B58\u7684 Chapter Inheritance Adapter \u4ECD\u5904\u4E8E blocked\u3002" : "",
      adapterVersionChanged ? `\u7AE0\u8282\u7EE7\u627F Adapter \u8BB0\u5F55\u7684\u662F v${persistedAdapterVersion}\uFF0C\u5F53\u524D\u51BB\u7ED3\u5408\u540C\u4E3A v${approvedVersion}\uFF0C\u9700\u8981\u91CD\u65B0\u751F\u6210\u7AE0\u8282\u9A8C\u8BC1\u3002` : ""
    ].filter(Boolean);
    const status2 = currentContractBlocks ? "blocked" : driftBlocked ? "blocked" : driftWarning ? "warning" : driftPending ? "pending" : "ready";
    return {
      status: status2,
      summary: currentContractBlocks ? "\u5F53\u524D\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u5C1A\u672A\u901A\u8FC7\u6216\u7EE7\u627F\u94FE\u672A enforced\uFF0C\u7AE0\u8282\u98CE\u683C\u6F02\u79FB\u7ED3\u679C\u4E0D\u80FD\u5355\u72EC\u653E\u884C\u3002" : String(styleConformanceDrift.reason || "\u5DF2\u8BFB\u53D6\u7AE0\u8282\u98CE\u683C\u6F02\u79FB\u8BC4\u5206\u3002"),
      chapterNumber: input.chapterNumber,
      contractVersion: approvedVersion,
      contractApproved,
      approvedAt: String(contract?.approvedAt || contract?.approval?.approvedAt || ""),
      inheritanceStatus,
      chapterInheritanceAdapter: persistedAdapter,
      adapterReady: persistedAdapterStatus === "ready" && !adapterVersionChanged && !adapterMissing,
      freezerVerdict,
      inheritedRuleCount: inheritedRules.length,
      inheritedArtifactCount: inheritedArtifacts.length,
      freezeAssetsReady,
      inheritanceAssetsReady,
      styleFingerprintReady,
      styleFingerprint,
      styleConformanceDrift,
      styleDrift: {
        status: driftStatus,
        conformanceScore: typeof styleConformanceDrift.conformanceScore === "number" ? Math.round(Number(styleConformanceDrift.conformanceScore) * 10) : null,
        driftScore: typeof styleConformanceDrift.driftScore === "number" ? Math.round(Number(styleConformanceDrift.driftScore) * 10) : null,
        threshold: 72,
        rawConformanceScore: styleConformanceDrift.conformanceScore,
        rawDriftScore: styleConformanceDrift.driftScore,
        forbiddenHitCount: Number(metrics.forbiddenHitCount || 0),
        matchedTerms: Array.isArray(styleConformanceDrift.matchedContractRules) ? styleConformanceDrift.matchedContractRules : [],
        missingTerms: Array.isArray(styleConformanceDrift.missingContractRules) ? styleConformanceDrift.missingContractRules : [],
        summary: String(styleConformanceDrift.reason || "")
      },
      qualityGateStatus,
      qualityGateReason,
      publishBaseReady: baseMissingLabels.length === 0,
      publishBaseMissing: baseMissing.map((check) => ({
        id: check.id,
        label: check.label,
        detail: check.detail
      })),
      aigc: aigcDetection ? {
        status: aigcStatus || "unknown",
        score: aigcScore,
        threshold: aigcThreshold,
        highRiskCount: aigcHighRiskCount,
        reason: String(aigcDetection.reason || "")
      } : null,
      verificationStatus,
      verificationSummary: String(contract?.verification?.summary || contract?.loop?.verificationSummary || ""),
      evidence: baseMissingLabels.length || contractRisks.length ? driftEvidence : [...driftEvidence, "\u5F53\u524D\u7AE0\u8282\u7684\u53D1\u5E03\u94FE\u8DEF\u57FA\u7840\u8D44\u4EA7\u5DF2\u9F50\u3002"],
      risks: [
        ...driftRisks,
        ...contractRisks,
        ...baseMissingLabels.length ? [`\u53D1\u5E03\u94FE\u8DEF\u4ECD\u7F3A\u5C11\uFF1A${baseMissingLabels.join("\u3001")}\u3002`] : []
      ]
    };
  }
  if (persisted) {
    const persistedStatus = normalizeReaderVerificationStatus(persisted.status);
    const persistedContractVersion = Number(persisted.contractVersion || 0);
    const contractVersionChanged = Boolean(
      approvedVersion > 0 && persistedContractVersion > 0 && persistedContractVersion !== approvedVersion
    );
    const persistedEvidence = Array.isArray(persisted.evidence) ? persisted.evidence : [];
    const persistedRisks = Array.isArray(persisted.risks) ? persisted.risks : [];
    const publishBaseMissing = baseMissing.map((check) => ({
      id: check.id,
      label: check.label,
      detail: check.detail
    }));
    const contractRisks = [
      !contractApproved ? "\u6574\u4E66\u5199\u6CD5\u5408\u540C\u5C1A\u672A\u51BB\u7ED3\uFF0C\u65E7\u7684\u7AE0\u8282\u7EE7\u627F\u9A8C\u8BC1\u4E0D\u80FD\u4F5C\u4E3A\u5F53\u524D\u53D1\u5E03\u4F9D\u636E\u3002" : "",
      contractApproved && inheritanceStatus !== "enforced" ? `\u5199\u6CD5\u7EE7\u627F\u72B6\u6001\u5F53\u524D\u4E3A ${inheritanceStatus || "missing"}\uFF0C\u65E7\u9A8C\u8BC1\u9700\u8981\u91CD\u65B0\u786E\u8BA4\u3002` : "",
      contractApproved && verificationStatus !== "passed" ? `\u5F53\u524D\u51BB\u7ED3\u5199\u6CD5\u5408\u540C Generation Verification Gate \u72B6\u6001\u4E3A ${verificationStatus || "missing"}\uFF0C\u65E7\u9A8C\u8BC1\u9700\u8981\u91CD\u65B0\u786E\u8BA4\u3002` : "",
      contractApproved && freezerVerdict !== "ready" ? `\u5F53\u524D\u51BB\u7ED3\u5199\u6CD5\u5408\u540C Style Contract Freezer verdict \u4E3A ${freezerVerdict || "missing"}\uFF0C\u65E7\u9A8C\u8BC1\u9700\u8981\u91CD\u65B0\u786E\u8BA4\u3002` : "",
      adapterMissing ? "\u7AE0\u8282\u7248\u672C\u6E05\u5355\u7F3A\u5C11 Chapter Inheritance Adapter\uFF0C\u65E7\u9A8C\u8BC1\u4E0D\u80FD\u4F5C\u4E3A\u53D1\u5E03\u4F9D\u636E\u3002" : "",
      persistedAdapterStatus === "blocked" ? "\u7AE0\u8282\u4FDD\u5B58\u7684 Chapter Inheritance Adapter \u4ECD\u5904\u4E8E blocked\uFF0C\u65E7\u9A8C\u8BC1\u4E0D\u80FD\u4F5C\u4E3A\u53D1\u5E03\u4F9D\u636E\u3002" : "",
      adapterVersionChanged ? `\u7AE0\u8282\u7EE7\u627F Adapter \u8BB0\u5F55\u7684\u662F v${persistedAdapterVersion}\uFF0C\u5F53\u524D\u51BB\u7ED3\u5408\u540C\u4E3A v${approvedVersion}\uFF0C\u9700\u8981\u91CD\u65B0\u751F\u6210\u7AE0\u8282\u9A8C\u8BC1\u3002` : "",
      contractVersionChanged ? `\u7AE0\u8282\u7EE7\u627F\u9A8C\u8BC1\u8BB0\u5F55\u7684\u662F v${persistedContractVersion}\uFF0C\u5F53\u524D\u51BB\u7ED3\u5408\u540C\u4E3A v${approvedVersion}\uFF0C\u9700\u8981\u91CD\u65B0\u9A8C\u8BC1\u3002` : ""
    ].filter(Boolean);
    const publishRisks = baseMissingLabels.length ? [`\u53D1\u5E03\u94FE\u8DEF\u4ECD\u7F3A\u5C11\uFF1A${baseMissingLabels.join("\u3001")}\u3002`] : [];
    const downgradedStatus = currentContractBlocks || contractVersionChanged ? "blocked" : baseMissingLabels.length > 0 && persistedStatus === "ready" ? "warning" : persistedStatus;
    const summary2 = downgradedStatus === "blocked" && (currentContractBlocks || contractVersionChanged) ? "\u7AE0\u8282\u4FDD\u5B58\u7684\u5199\u6CD5\u7EE7\u627F\u9A8C\u8BC1\u5DF2\u8FC7\u671F\uFF0C\u5FC5\u987B\u5148\u91CD\u65B0\u901A\u8FC7\u5F53\u524D\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u4E0E Generation Verification Gate\u3002" : String(persisted.summary || "\u5DF2\u8BFB\u53D6\u7AE0\u8282\u6301\u4E45\u5316\u5199\u6CD5\u7EE7\u627F\u9A8C\u8BC1\u3002");
    return {
      ...persisted,
      status: downgradedStatus,
      summary: summary2,
      chapterNumber: input.chapterNumber,
      contractVersion: approvedVersion || persistedContractVersion || void 0,
      contractApproved,
      approvedAt: String(contract?.approvedAt || contract?.approval?.approvedAt || ""),
      inheritanceStatus,
      chapterInheritanceAdapter: persistedAdapter,
      adapterReady: persistedAdapterStatus === "ready" && !adapterVersionChanged && !adapterMissing,
      freezerVerdict,
      inheritedRuleCount: inheritedRules.length,
      inheritedArtifactCount: inheritedArtifacts.length,
      freezeAssetsReady,
      inheritanceAssetsReady,
      styleFingerprintReady,
      styleFingerprint,
      qualityGateStatus,
      qualityGateReason,
      publishBaseReady: baseMissingLabels.length === 0,
      publishBaseMissing,
      aigc: aigcDetection ? {
        status: aigcStatus || "unknown",
        score: aigcScore,
        threshold: aigcThreshold,
        highRiskCount: aigcHighRiskCount,
        reason: String(aigcDetection.reason || "")
      } : null,
      verificationStatus,
      verificationSummary: String(contract?.verification?.summary || contract?.loop?.verificationSummary || ""),
      evidence: baseMissingLabels.length || contractRisks.length ? persistedEvidence : [...persistedEvidence, "\u5F53\u524D\u7AE0\u8282\u7684\u53D1\u5E03\u94FE\u8DEF\u57FA\u7840\u8D44\u4EA7\u5DF2\u9F50\u3002"],
      risks: [...persistedRisks, ...contractRisks, ...publishRisks]
    };
  }
  const evidence = [];
  const risks = [];
  if (contractApproved) {
    evidence.push(approvedVersion > 0 ? `\u6574\u4E66\u5199\u6CD5\u5408\u540C\u5DF2\u51BB\u7ED3\u4E3A v${approvedVersion}` : "\u6574\u4E66\u5199\u6CD5\u5408\u540C\u5DF2\u5B8C\u6210\u51BB\u7ED3");
  } else {
    risks.push("\u6574\u4E66\u5199\u6CD5\u5408\u540C\u5C1A\u672A\u51BB\u7ED3\uFF0C\u5F53\u524D\u7AE0\u8282\u65E0\u6CD5\u5B8C\u6210\u4E25\u683C\u7EE7\u627F\u9A8C\u8BC1\u3002");
  }
  if (inheritanceStatus === "enforced") {
    evidence.push("\u7AE0\u8282\u7EE7\u627F\u94FE\u5DF2\u6807\u8BB0\u4E3A enforced\u3002");
  } else if (contractApproved) {
    risks.push(inheritanceStatus ? `\u5199\u6CD5\u7EE7\u627F\u72B6\u6001\u4ECD\u4E3A ${inheritanceStatus}\u3002` : "\u5199\u6CD5\u7EE7\u627F\u72B6\u6001\u5C1A\u672A\u8FDB\u5165 enforced\u3002");
  }
  if (freezerVerdict === "ready") {
    evidence.push("Style Contract Freezer \u5DF2 ready\u3002");
  } else if (contractApproved) {
    risks.push(`Style Contract Freezer verdict \u4E3A ${freezerVerdict || "missing"}\u3002`);
  }
  if (persistedAdapterStatus === "ready" && !adapterVersionChanged) {
    evidence.push("Chapter Inheritance Adapter \u5DF2\u7ED1\u5B9A\u5F53\u524D\u51BB\u7ED3\u5408\u540C\u3002");
  } else if (adapterMissing) {
    risks.push("\u7AE0\u8282\u7248\u672C\u6E05\u5355\u7F3A\u5C11 Chapter Inheritance Adapter\u3002");
  } else if (persistedAdapterStatus === "blocked") {
    risks.push("Chapter Inheritance Adapter \u4ECD\u5904\u4E8E blocked\u3002");
  } else if (adapterVersionChanged) {
    risks.push(`\u7AE0\u8282\u7EE7\u627F Adapter \u8BB0\u5F55\u7684\u662F v${persistedAdapterVersion}\uFF0C\u5F53\u524D\u51BB\u7ED3\u5408\u540C\u4E3A v${approvedVersion}\u3002`);
  }
  if (freezeAssetsReady) {
    evidence.push("\u51BB\u7ED3\u8D44\u4EA7\u5305\u5DF2\u5B8C\u6574\u843D\u5730\uFF08approved sample / freeze ledger / loop runtime\uFF09\u3002");
  } else if (contractApproved) {
    risks.push("\u51BB\u7ED3\u8D44\u4EA7\u5305\u8FD8\u4E0D\u5B8C\u6574\uFF0C\u540E\u7EED\u6B63\u6587\u7EE7\u627F\u8BC1\u636E\u4E0D\u591F\u624E\u5B9E\u3002");
  }
  if (inheritanceAssetsReady) {
    evidence.push("\u7AE0\u8282\u7EE7\u627F\u8D44\u4EA7\u5DF2\u540C\u6B65\uFF08rulebook / references / anti-patterns\uFF09\u3002");
  } else if (contractApproved) {
    risks.push("\u7AE0\u8282\u7EE7\u627F\u8D44\u4EA7\u672A\u5B8C\u5168\u540C\u6B65\uFF0C\u6B63\u6587\u53EF\u80FD\u6CA1\u6709\u5403\u5230\u5B8C\u6574\u5199\u6CD5\u5408\u540C\u3002");
  }
  if (styleFingerprintReady) {
    evidence.push("\u9996\u7AE0\u98CE\u683C\u6307\u7EB9\u5DF2\u5C31\u7EEA\uFF0C\u53EF\u4F5C\u4E3A\u7AE0\u8282\u8FDE\u7EED\u6027\u53C2\u7167\u3002");
  } else {
    risks.push("\u9996\u7AE0\u98CE\u683C\u6307\u7EB9\u5C1A\u672A\u7A33\u5B9A\u63D0\u53D6\uFF0C\u6682\u65F6\u7F3A\u5C11\u7AE0\u8282\u5199\u6CD5\u8FDE\u7EED\u6027\u7684\u8F85\u52A9\u53C2\u7167\u3002");
  }
  if (qualityGateStatus === "passed" || qualityGateStatus === "approved" || qualityGateStatus === "pass") {
    evidence.push("\u672C\u7AE0\u8D28\u91CF\u95E8\u5DF2\u901A\u8FC7\u3002");
  } else if (qualityGateStatus === "blocked") {
    risks.push(`\u672C\u7AE0\u8D28\u91CF\u95E8\u963B\u585E\uFF1A${qualityGateReason || "\u4ECD\u672A\u901A\u8FC7\u7AE0\u8282\u8D28\u91CF\u95E8\u3002"}\u3002`);
  } else if (qualityGateStatus) {
    risks.push(`\u672C\u7AE0\u8D28\u91CF\u95E8\u5F53\u524D\u72B6\u6001\u4E3A ${qualityGateStatus}\u3002`);
  } else {
    risks.push("\u672C\u7AE0\u5C1A\u672A\u5F62\u6210\u7A33\u5B9A\u7684\u8D28\u91CF\u95E8\u7ED3\u679C\u3002");
  }
  if (aigcStatus === "passed") {
    evidence.push(`AIGC \u68C0\u6D4B\u901A\u8FC7${typeof aigcScore === "number" ? `\uFF08\u5747\u503C ${aigcScore.toFixed(3)}\uFF09` : ""}\u3002`);
  } else if (aigcStatus === "blocked") {
    risks.push(`AIGC \u68C0\u6D4B\u963B\u585E\uFF1A${aigcHighRiskCount} \u4E2A\u9AD8\u98CE\u9669\u7247\u6BB5${typeof aigcScore === "number" ? `\uFF0C\u5747\u503C ${aigcScore.toFixed(3)}` : ""}${typeof aigcThreshold === "number" ? `\uFF0C\u9608\u503C ${aigcThreshold.toFixed(3)}` : ""}\u3002`);
  } else if (aigcStatus) {
    risks.push(`AIGC \u68C0\u6D4B\u5F53\u524D\u72B6\u6001\u4E3A ${aigcStatus}${aigcDetection?.reason ? `\uFF1A${String(aigcDetection.reason)}` : ""}\u3002`);
  } else {
    risks.push("\u5F53\u524D\u7AE0\u8282\u8FD8\u6CA1\u6709\u53EF\u8FFD\u8E2A\u7684 AIGC \u68C0\u6D4B\u7ED3\u679C\u3002");
  }
  if (baseMissingLabels.length) {
    risks.push(`\u53D1\u5E03\u94FE\u8DEF\u4ECD\u7F3A\u5C11\uFF1A${baseMissingLabels.join("\u3001")}\u3002`);
  } else {
    evidence.push("\u5F53\u524D\u7AE0\u8282\u7684\u53D1\u5E03\u94FE\u8DEF\u57FA\u7840\u8D44\u4EA7\u5DF2\u9F50\u3002");
  }
  let status = "ready";
  if (!manifest) {
    status = "pending";
  } else if (currentContractBlocks || qualityGateStatus === "blocked" || aigcStatus === "blocked") {
    status = "blocked";
  } else if (!freezeAssetsReady || !inheritanceAssetsReady || !styleFingerprintReady || baseMissingLabels.length > 0 || !aigcStatus) {
    status = "warning";
  }
  const summary = status === "blocked" ? !contractApproved ? "\u6574\u4E66\u5199\u6CD5\u5408\u540C\u8FD8\u6CA1\u6709\u51BB\u7ED3\uFF0C\u5F53\u524D\u7AE0\u8282\u4E0D\u80FD\u88AB\u89C6\u4E3A\u5DF2\u5B8C\u6210\u5199\u6CD5\u7EE7\u627F\u9A8C\u8BC1\u3002" : verificationStatus !== "passed" ? "\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u7684 Generation Verification Gate \u5C1A\u672A\u901A\u8FC7\uFF0C\u5F53\u524D\u7AE0\u8282\u4E0D\u80FD\u88AB\u89C6\u4E3A\u7A33\u5B9A\u7EE7\u627F\u5408\u540C\u7684\u6B63\u6587\u3002" : aigcStatus === "blocked" ? "AIGC \u68C0\u6D4B\u4ECD\u5728\u963B\u585E\uFF0C\u5F53\u524D\u7AE0\u8282\u8FD8\u4E0D\u80FD\u88AB\u89C6\u4E3A\u7A33\u5B9A\u7EE7\u627F\u5408\u540C\u7684\u6B63\u6587\u3002" : qualityGateStatus === "blocked" ? "\u672C\u7AE0\u8D28\u91CF\u95E8\u4ECD\u5728\u963B\u585E\uFF0C\u5F53\u524D\u7AE0\u8282\u8FD8\u4E0D\u80FD\u88AB\u89C6\u4E3A\u7A33\u5B9A\u7EE7\u627F\u5408\u540C\u7684\u6B63\u6587\u3002" : "\u5199\u6CD5\u7EE7\u627F\u94FE\u8FD8\u6CA1\u6709\u5B8C\u5168\u8FDB\u5165\u53EF\u653E\u884C\u72B6\u6001\u3002" : status === "warning" ? "\u672C\u7AE0\u5DF2\u7ECF\u63A5\u4E0A\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\uFF0C\u4F46\u7EE7\u627F\u8BC1\u636E\u4ECD\u4E0D\u5B8C\u6574\uFF0C\u5EFA\u8BAE\u7EE7\u7EED\u8865\u9F50\u9A8C\u8BC1\u94FE\u3002" : status === "pending" ? "\u5F53\u524D\u7AE0\u8282\u8FD8\u6CA1\u6709\u5F62\u6210\u8DB3\u591F\u7684\u5199\u6CD5\u7EE7\u627F\u9A8C\u8BC1\u6570\u636E\u3002" : "\u672C\u7AE0\u5DF2\u7ECF\u901A\u8FC7\u51BB\u7ED3\u5408\u540C\u3001\u8D28\u91CF\u95E8\u4E0E AIGC \u7684\u8054\u5408\u9A8C\u8BC1\uFF0C\u66F4\u63A5\u8FD1\u7A33\u5B9A\u53EF\u53D1\u5E03\u6B63\u6587\u3002";
  return {
    status,
    summary,
    chapterNumber: input.chapterNumber,
    contractVersion: approvedVersion,
    contractApproved,
    approvedAt: String(contract?.approvedAt || contract?.approval?.approvedAt || ""),
    inheritanceStatus,
    chapterInheritanceAdapter: persistedAdapter,
    adapterReady: persistedAdapterStatus === "ready" && !adapterVersionChanged && !adapterMissing,
    freezerVerdict,
    inheritedRuleCount: inheritedRules.length,
    inheritedArtifactCount: inheritedArtifacts.length,
    freezeAssetsReady,
    inheritanceAssetsReady,
    styleFingerprintReady,
    styleFingerprint,
    qualityGateStatus,
    qualityGateReason,
    publishBaseReady: baseMissingLabels.length === 0,
    publishBaseMissing: baseMissing.map((check) => ({
      id: check.id,
      label: check.label,
      detail: check.detail
    })),
    aigc: aigcDetection ? {
      status: aigcStatus || "unknown",
      score: aigcScore,
      threshold: aigcThreshold,
      highRiskCount: aigcHighRiskCount,
      reason: String(aigcDetection.reason || "")
    } : null,
    verificationStatus,
    verificationSummary: String(contract?.verification?.summary || contract?.loop?.verificationSummary || ""),
    evidence,
    risks
  };
}
async function buildReaderChapterPublishReadiness(projectRoot, chapterNumber, manifest, options = {}) {
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`;
  const selectedVersion = manifest?.versions?.find((entry) => entry.id === manifest.publishedVersionId);
  const selectedBody = selectedVersion?.path ? await readWorkspaceArtifactText(projectRoot, selectedVersion.path) : "";
  const selectedCleanBody = selectedBody ? cleanReaderChapterText(selectedBody) : "";
  const qualityGate = manifest?.qualityGate && typeof manifest.qualityGate === "object" ? manifest.qualityGate : null;
  const qualityPassed = Boolean(
    qualityGate?.passed === true || qualityGate?.status === "passed" || qualityGate?.status === "pass" || qualityGate?.status === "approved"
  );
  const styleContractVerificationStatus = String(
    options.styleEvolution?.contract?.verification?.status || options.styleEvolution?.contract?.loop?.verificationStatus || ""
  );
  const styleContractVerificationPassed = styleContractVerificationStatus === "passed";
  const memoryPath = String(manifest?.artifacts?.memory || `.ai-novel/memory/${chapterId}-memory.md`);
  const reportPath = String(manifest?.artifacts?.report || `.ai-novel/reports/${chapterId}-quality.md`);
  const memoryText = await readWorkspaceArtifactText(projectRoot, memoryPath);
  const reportText = await readWorkspaceArtifactText(projectRoot, reportPath);
  const relationshipGraphText = await readWorkspaceText(projectRoot, "memory", "characters", "relationships.json");
  const relationshipGraph = tryParseJsonText(relationshipGraphText);
  const hasRelationshipGraph = Boolean(
    relationshipGraphText.trim() && relationshipGraph && typeof relationshipGraph === "object" && (Array.isArray(relationshipGraph.edges) || Array.isArray(relationshipGraph.nodes) || Number(relationshipGraph.edgeCount || 0) > 0)
  );
  const worldSlicePath = `.ai-novel/checkpoints/active-world-slices/${chapterId}-world-slice.md`;
  const activeWorldSlice = await readWorkspaceArtifactText(projectRoot, worldSlicePath);
  const foreshadowingLedger = await readWorkspaceText(projectRoot, "plans", "foreshadowing-ledger.md");
  const checks = [
    {
      id: "version_manifest",
      label: "\u7AE0\u8282\u7248\u672C\u6E05\u5355",
      passed: Boolean(manifest),
      detail: manifest ? `${manifest.versions.length} \u4E2A\u7248\u672C` : "\u7F3A\u5C11 chapter versions manifest"
    },
    {
      id: "selected_version",
      label: "\u5F53\u524D\u9605\u8BFB\u7248\u672C",
      passed: Boolean(selectedVersion && selectedCleanBody),
      detail: selectedVersion ? selectedVersion.path : "\u6CA1\u6709\u9009\u4E2D\u7684\u53EF\u8BFB\u7248\u672C"
    },
    {
      id: "quality_gate",
      label: "\u8D28\u91CF\u95E8\u7981",
      passed: qualityPassed,
      detail: String(qualityGate?.status || qualityGate?.reason || "\u672A\u901A\u8FC7\u6216\u672A\u751F\u6210")
    },
    {
      id: "quality_report",
      label: "\u8D28\u91CF\u62A5\u544A",
      passed: Boolean(reportText?.trim()),
      detail: reportPath
    },
    {
      id: "style_generation_verification",
      label: "\u5199\u6CD5\u751F\u6210\u9A8C\u8BC1",
      passed: styleContractVerificationPassed,
      detail: styleContractVerificationStatus || "\u7F3A\u5C11 Generation Verification Gate \u7ED3\u679C"
    },
    {
      id: "chapter_memory",
      label: "\u7AE0\u8282\u8BB0\u5FC6",
      passed: Boolean(memoryText?.trim()),
      detail: memoryPath
    },
    {
      id: "relationship_graph",
      label: "\u4EBA\u7269\u5173\u7CFB\u56FE",
      passed: hasRelationshipGraph,
      detail: ".ai-novel/memory/characters/relationships.json"
    },
    {
      id: "active_world_slice",
      label: "\u6D3B\u8DC3\u4E16\u754C\u89C2\u5207\u7247",
      passed: Boolean(activeWorldSlice?.trim()),
      detail: worldSlicePath
    },
    {
      id: "foreshadowing_ledger",
      label: "\u4F0F\u7B14\u8D26\u672C",
      passed: Boolean(foreshadowingLedger.trim()),
      detail: ".ai-novel/plans/foreshadowing-ledger.md"
    }
  ];
  const styleInheritanceVerification = buildReaderStyleInheritanceVerification({
    chapterNumber,
    manifest,
    baseChecks: checks,
    styleEvolution: options.styleEvolution,
    styleEvolutionAssets: options.styleEvolutionAssets,
    creativeProfile: options.creativeProfile
  });
  if (manifest && typeof manifest === "object") {
    ;
    manifest.styleInheritanceVerification = styleInheritanceVerification;
  }
  const aigcDetection = manifest?.aigcDetection && typeof manifest.aigcDetection === "object" ? manifest.aigcDetection : null;
  const qualityGateStatus = String(qualityGate?.status || "");
  const styleChecks = [
    {
      id: "style_contract_alignment",
      label: "\u5199\u6CD5\u7EE7\u627F\u9A8C\u8BC1",
      passed: styleInheritanceVerification.status === "ready",
      detail: styleInheritanceVerification.summary
    },
    {
      id: "aigc_gate",
      label: "AIGC \u68C0\u6D4B",
      passed: String(aigcDetection?.status || "") === "passed",
      detail: String(
        aigcDetection?.status ? `${aigcDetection.status}${aigcDetection?.reason ? ` \xB7 ${aigcDetection.reason}` : ""}` : qualityGateStatus === "blocked" && /AIGC/u.test(String(qualityGate?.reason || "")) ? String(qualityGate?.reason || "") : "\u672A\u8BB0\u5F55 AIGC \u68C0\u6D4B\u7ED3\u679C"
      )
    }
  ];
  const mergedChecks = [...checks, ...styleChecks];
  const missing = mergedChecks.filter((check) => !check.passed);
  return {
    ready: missing.length === 0,
    status: missing.length === 0 ? "ready" : "needs_review",
    locked: Boolean(manifest?.locked),
    selectedVersionId: manifest?.publishedVersionId || "",
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    missing: missing.map((check) => ({ id: check.id, label: check.label, detail: check.detail })),
    checks: mergedChecks,
    styleInheritanceVerification
  };
}
async function readReaderChapter(projectRoot, task, styleContext = {}) {
  const chapterNumber = Number(task.chapterNumber);
  const taskRecord = task;
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`;
  const versionManifest = await readReaderChapterVersionManifest(projectRoot, chapterNumber);
  const publishReadiness = await buildReaderChapterPublishReadiness(projectRoot, chapterNumber, versionManifest, styleContext);
  const enrichedVersionManifest = versionManifest ? { ...versionManifest, publishReadiness } : versionManifest;
  const manifestCandidates = versionManifest?.versions?.length ? [
    ...versionManifest.versions.filter((entry) => entry.id === versionManifest.publishedVersionId),
    ...versionManifest.versions.filter((entry) => entry.id !== versionManifest.publishedVersionId)
  ].map((entry) => ({
    source: entry.source || entry.id,
    path: entry.path,
    versionId: entry.id
  })) : [];
  const candidates = [
    ...manifestCandidates,
    { source: "final", path: task.finalPath || `.ai-novel/chapters/${chapterId}.final.md` },
    { source: "reviewed", path: task.reviewedPath || `.ai-novel/chapters/${chapterId}.reviewed.md` },
    { source: "draft", path: task.draftPath || `.ai-novel/chapters/${chapterId}.draft.md` }
  ];
  for (const candidate of candidates) {
    const content = await readWorkspaceArtifactText(projectRoot, candidate.path);
    if (content) {
      const body = cleanReaderChapterText(content);
      if (body) {
        return {
          chapterNumber,
          title: readerChapterTitleFromRaw(content, String(task.title || ""), chapterNumber),
          status: String(task.status || (candidate.source === "final" ? "complete" : "available")),
          source: candidate.source,
          versionId: "versionId" in candidate ? candidate.versionId : candidate.source,
          path: candidate.path,
          targetWords: Number(task.targetWords || taskRecord.wordTarget || 0),
          wordCount: readerWordCount(body),
          summary: String(task.summary || ""),
          qualityGate: versionManifest?.qualityGate || task.qualityGate || null,
          aigcDetection: versionManifest?.aigcDetection || null,
          styleInheritanceVerification: publishReadiness.styleInheritanceVerification || null,
          publishReadiness,
          versionManifest: enrichedVersionManifest,
          body
        };
      }
    }
  }
  return {
    chapterNumber,
    title: String(task.title || `\u7B2C ${chapterNumber} \u7AE0`),
    status: String(task.status || "pending"),
    source: "",
    versionId: "",
    path: "",
    targetWords: Number(task.targetWords || taskRecord.wordTarget || 0),
    wordCount: 0,
    summary: String(task.summary || ""),
    qualityGate: versionManifest?.qualityGate || task.qualityGate || null,
    aigcDetection: versionManifest?.aigcDetection || null,
    styleInheritanceVerification: publishReadiness.styleInheritanceVerification || null,
    publishReadiness,
    versionManifest: enrichedVersionManifest,
    body: ""
  };
}
function compactReaderChapter(chapter) {
  return {
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    status: chapter.status,
    source: chapter.source,
    versionId: chapter.versionId,
    path: chapter.path,
    targetWords: chapter.targetWords,
    wordCount: chapter.wordCount,
    summary: chapter.summary,
    qualityGate: chapter.qualityGate,
    aigcDetection: chapter.aigcDetection,
    styleInheritanceVerification: chapter.styleInheritanceVerification,
    publishReadiness: chapter.publishReadiness,
    versionManifest: chapter.versionManifest,
    hasBody: Boolean(chapter.body)
  };
}
function readerSearchSnippet(text = "", query = "", radius = 72) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  const needle = String(query || "").trim().toLowerCase();
  if (!source || !needle) return "";
  const index = source.toLowerCase().indexOf(needle);
  if (index < 0) return truncateReaderText(source, radius * 2);
  const start = Math.max(0, index - radius);
  const end = Math.min(source.length, index + needle.length + radius);
  return `${start > 0 ? "..." : ""}${source.slice(start, end).trim()}${end < source.length ? "..." : ""}`;
}
function normalizeReaderDiffParagraphs(text = "") {
  return String(text || "").split(/\n{2,}/u).map((paragraph) => paragraph.replace(/\s+/gu, " ").trim()).filter(Boolean);
}
function createReaderVersionComparison(leftBody = "", rightBody = "") {
  const leftParagraphs = normalizeReaderDiffParagraphs(leftBody);
  const rightParagraphs = normalizeReaderDiffParagraphs(rightBody);
  const rightSet = new Set(rightParagraphs);
  const leftSet = new Set(leftParagraphs);
  const unchanged = leftParagraphs.filter((paragraph) => rightSet.has(paragraph)).length;
  const removed = leftParagraphs.filter((paragraph) => !rightSet.has(paragraph));
  const added = rightParagraphs.filter((paragraph) => !leftSet.has(paragraph));
  return {
    unchangedParagraphs: unchanged,
    removedParagraphs: removed.length,
    addedParagraphs: added.length,
    leftParagraphs: leftParagraphs.length,
    rightParagraphs: rightParagraphs.length,
    removedPreview: removed.slice(0, 5),
    addedPreview: added.slice(0, 5)
  };
}
function normalizeReaderGraph(rawGraph) {
  const nodes = Array.isArray(rawGraph?.nodes) ? rawGraph.nodes : [];
  const edges = Array.isArray(rawGraph?.edges) ? rawGraph.edges : [];
  const storyNodeTypes = /* @__PURE__ */ new Set(["character", "location", "faction", "event", "scene", "foreshadowing", "worldrule", "conflict", "relationship", "timelinepoint"]);
  const compactNodes = nodes.filter((node) => storyNodeTypes.has(String(node.type || node.node_type || "").toLowerCase())).slice(0, 80).map((node) => ({
    id: String(node.id || ""),
    type: String(node.type || node.node_type || "Story"),
    label: String(node.label || node.name || node.id || "\u672A\u547D\u540D"),
    summary: truncateReaderText(String(node.content || node.description || node.properties?.description || ""), 360)
  }));
  const nodeIds = new Set(compactNodes.map((node) => node.id));
  const compactEdges = edges.filter((edge) => nodeIds.has(String(edge.source || edge.source_id || edge.from_node_id || "")) && nodeIds.has(String(edge.target || edge.target_id || edge.to_node_id || ""))).slice(0, 120).map((edge, index) => ({
    id: String(edge.id || `reader-edge-${index}`),
    source: String(edge.source || edge.source_id || edge.from_node_id || ""),
    target: String(edge.target || edge.target_id || edge.to_node_id || ""),
    label: String(edge.label || edge.type || edge.relation_type || "\u5173\u8054")
  }));
  return { nodes: compactNodes, edges: compactEdges };
}
function compactReaderProjects(projects = []) {
  return projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    title: project.title,
    totalChapters: project.totalChapters,
    chapterWordTarget: project.chapterWordTarget,
    summary: project.summary ? {
      stage: project.summary.stage,
      progressPercent: project.summary.progressPercent,
      completedChapters: project.summary.completedChapters,
      totalChapters: project.summary.totalChapters,
      updatedAt: project.summary.updatedAt
    } : null
  }));
}
async function buildReaderSnapshot(rootDir, projectId) {
  const context = await resolveProjectContext(rootDir, projectId);
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const dbSnapshot = await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId)).catch(() => null);
  const state = dbSnapshot?.state || await tryLoadState(context.projectRoot);
  const project = context.projects.find((entry) => entry.id === context.projectId);
  const stateTasks = Array.isArray(state?.plan?.chapterTasks) ? state.plan.chapterTasks : [];
  const chapterFacts = Array.isArray(dbSnapshot?.chapterFacts) ? dbSnapshot.chapterFacts : [];
  const styleContext = await loadReaderStyleContext(context.projectRoot, state);
  const taskByNumber = /* @__PURE__ */ new Map();
  for (const task of stateTasks) {
    const chapterNumber = Number(task.chapterNumber);
    if (Number.isFinite(chapterNumber) && chapterNumber > 0) {
      taskByNumber.set(chapterNumber, { ...taskByNumber.get(chapterNumber), ...task });
    }
  }
  for (const fact of chapterFacts) {
    const chapterNumber = Number(fact.chapterNumber || fact.chapter_number);
    if (Number.isFinite(chapterNumber) && chapterNumber > 0) {
      taskByNumber.set(chapterNumber, { ...taskByNumber.get(chapterNumber), ...fact, chapterNumber });
    }
  }
  const projectRoot = context.projectRoot;
  const chapterFiles = await listWorkspaceFiles(projectRoot, "chapters");
  for (const fileName of chapterFiles) {
    const match = fileName.match(/^chapter-(\d+)\.(final|reviewed|draft)\.md$/);
    if (!match) continue;
    const chapterNumber = Number.parseInt(match[1], 10);
    const source = match[2];
    const current = taskByNumber.get(chapterNumber) || { chapterNumber };
    taskByNumber.set(chapterNumber, {
      ...current,
      chapterNumber,
      [`${source}Path`]: `.ai-novel/chapters/${fileName}`
    });
  }
  const chapters = (await Promise.all(
    [...taskByNumber.values()].filter((task) => Number.isFinite(Number(task.chapterNumber)) && Number(task.chapterNumber) > 0).sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber)).map((task) => readReaderChapter(context.projectRoot, task, styleContext))
  )).filter((chapter) => chapter.body || chapter.path);
  const compactChapters = chapters.map((chapter) => compactReaderChapter(chapter));
  const memoryFiles = await listWorkspaceFiles(context.projectRoot, "memory");
  const memories = await Promise.all(memoryFiles.map((fileName) => ({ fileName, match: fileName.match(/^chapter-(\d+)-memory\.md$/) })).filter((entry) => entry.match).sort((a, b) => Number(a.match?.[1] || 0) - Number(b.match?.[1] || 0)).map(async (entry) => {
    const chapterNumber = Number(entry.match?.[1] || 0);
    const content = await readWorkspaceText(context.projectRoot, "memory", entry.fileName);
    return {
      chapterNumber,
      title: `\u7B2C ${chapterNumber} \u7AE0\u8BB0\u5FC6`,
      content: truncateReaderText(content, 1600)
    };
  }));
  const dossiersJsonText = await readWorkspaceText(context.projectRoot, "memory", "characters", "dossiers.json");
  const dossiersMarkdown = await readWorkspaceText(context.projectRoot, "memory", "characters", "dossiers.md");
  const relationshipGraphText = await readWorkspaceText(context.projectRoot, "memory", "characters", "relationships.json");
  const relations = await readWorkspaceText(context.projectRoot, "memory", "characters", "relations.md");
  const evolution = await readWorkspaceText(context.projectRoot, "memory", "characters", "evolution.md");
  const graphText = await readWorkspaceText(context.projectRoot, "graph", "super-graph.json");
  const graph = normalizeReaderGraph(tryParseJsonText(graphText));
  const projectRecord = project;
  const activeWorldSliceFiles = await listWorkspaceFiles(context.projectRoot, "checkpoints", "active-world-slices");
  const latestActiveWorldSliceFile = activeWorldSliceFiles.filter((fileName) => /^chapter-\d+-world-slice\.md$/u.test(fileName)).sort().at(-1);
  const activeWorldSlice = latestActiveWorldSliceFile ? await readWorkspaceText(context.projectRoot, "checkpoints", "active-world-slices", latestActiveWorldSliceFile) : "";
  const storyFoundation = {
    contract: await readWorkspaceJson(context.projectRoot, "plans", "story-foundation-contract.json"),
    worldMatrix: await readWorkspaceJson(context.projectRoot, "plans", "world-matrix.json"),
    plotArchitecture: await readWorkspaceJson(context.projectRoot, "plans", "plot-architecture.json"),
    storyBible: await readWorkspaceJson(context.projectRoot, "plans", "story-bible.json"),
    volumeStrategy: await readWorkspaceJson(context.projectRoot, "plans", "volume-strategy.json"),
    foreshadowingLedger: await readWorkspaceJson(context.projectRoot, "plans", "foreshadowing-ledger.json"),
    characterDynamics: await readWorkspaceJson(context.projectRoot, "plans", "character-dynamics.json"),
    writingPlan: await readWorkspaceJson(context.projectRoot, "plans", "writing-plan.json")
  };
  const lore = {
    activeWorldSlice: truncateReaderText(activeWorldSlice, 4e3),
    activeWorldSlicePath: latestActiveWorldSliceFile ? `.ai-novel/checkpoints/active-world-slices/${latestActiveWorldSliceFile}` : "",
    settingFreeze: truncateReaderText(await readWorkspaceText(context.projectRoot, "plans", "setting-freeze.md"), 5e3),
    masterOutline: truncateReaderText(await readWorkspaceText(context.projectRoot, "plans", "master-outline.md"), 5e3),
    planBrief: truncateReaderText(await readWorkspaceText(context.projectRoot, "plans", "plan-and-solve-brief.md"), 3e3),
    globalConsensus: truncateReaderText(await readWorkspaceText(context.projectRoot, "prompts", "global-consensus.md"), 3e3),
    currentContext: truncateReaderText(await readWorkspaceText(context.projectRoot, "memory", "current-context-packet.md"), 3e3),
    storyFoundation
  };
  const readableChapters = chapters.filter((chapter) => chapter.body);
  const totalWords = readableChapters.reduce((sum, chapter) => sum + Number(chapter.wordCount || 0), 0);
  const currentChapterNumber = readableChapters.at(-1)?.chapterNumber || chapters.find((chapter) => chapter.body)?.chapterNumber || 1;
  return {
    status: 200,
    payload: {
      activeProjectId: context.projectId,
      projects: compactReaderProjects(context.projects),
      project: {
        id: context.projectId,
        title: state?.project?.title || project?.title || "\u672A\u547D\u540D\u5C0F\u8BF4",
        idea: state?.project?.idea || project?.idea || "",
        genre: state?.project?.creativeProfile?.genre || projectRecord?.creativeProfile?.genre || "",
        totalChapters: Number(state?.plan?.totalChapters || project?.totalChapters || chapters.length || 0),
        chapterWordTarget: Number(state?.plan?.chapterWordTarget || project?.chapterWordTarget || 0),
        stage: String(state?.runtime?.stage || project?.summary?.stage || "")
      },
      chapters: compactChapters,
      currentChapterNumber,
      lore,
      characters: {
        dossiers: tryParseJsonText(dossiersJsonText) || [],
        dossiersMarkdown: truncateReaderText(dossiersMarkdown, 5e3),
        relationshipGraph: tryParseJsonText(relationshipGraphText) || null,
        relations: truncateReaderText(relations, 4e3),
        evolution: truncateReaderText(evolution, 4e3)
      },
      memories,
      graph,
      styleEvolution: styleContext.styleEvolution,
      styleEvolutionAssets: styleContext.styleEvolutionAssets,
      stats: {
        totalChapters: chapters.length,
        readableChapters: readableChapters.length,
        completedChapters: chapters.filter((chapter) => chapter.status === "complete" || chapter.source === "final").length,
        totalWords
      },
      envStatus: getPublicProjectEnvStatus2(rootDir)
    }
  };
}
async function buildReaderChapterSnapshot(rootDir, projectId, chapterNumberValue) {
  const chapterNumber = Number(chapterNumberValue);
  if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
    return { status: 400, payload: { error: "chapter_required", envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const context = await resolveProjectContext(rootDir, projectId);
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const dbSnapshot = await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId)).catch(() => null);
  const state = dbSnapshot?.state || await tryLoadState(context.projectRoot);
  const styleContext = await loadReaderStyleContext(context.projectRoot, state);
  const stateTasks = Array.isArray(state?.plan?.chapterTasks) ? state.plan.chapterTasks : [];
  const chapterFacts = Array.isArray(dbSnapshot?.chapterFacts) ? dbSnapshot.chapterFacts : [];
  const task = { chapterNumber };
  for (const sourceTask of stateTasks) {
    if (Number(sourceTask?.chapterNumber) === chapterNumber) {
      Object.assign(task, sourceTask);
      break;
    }
  }
  for (const fact of chapterFacts) {
    if (Number(fact?.chapterNumber || fact?.chapter_number) === chapterNumber) {
      Object.assign(task, fact, { chapterNumber });
      break;
    }
  }
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`;
  const chapterFiles = await listWorkspaceFiles(context.projectRoot, "chapters");
  for (const source of ["final", "reviewed", "draft"]) {
    if (chapterFiles.includes(`${chapterId}.${source}.md`)) {
      task[`${source}Path`] = `.ai-novel/chapters/${chapterId}.${source}.md`;
    }
  }
  const chapter = await readReaderChapter(context.projectRoot, task, styleContext);
  if (!chapter.body && !chapter.path) {
    return {
      status: 404,
      payload: {
        error: "chapter_not_found",
        activeProjectId: context.projectId,
        chapterNumber,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  return {
    status: 200,
    payload: {
      activeProjectId: context.projectId,
      chapter,
      envStatus: getPublicProjectEnvStatus2(rootDir)
    }
  };
}
async function buildReaderChapterVersionCompare(rootDir, projectId, chapterNumberValue, leftVersionValue, rightVersionValue) {
  const chapterNumber = Number(chapterNumberValue);
  if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
    return { status: 400, payload: { error: "chapter_required", envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const context = await resolveProjectContext(rootDir, projectId);
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const manifest = await readReaderChapterVersionManifest(context.projectRoot, chapterNumber);
  if (!manifest) {
    return { status: 404, payload: { error: "version_manifest_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const leftVersionId = String(leftVersionValue || manifest.publishedVersionId || "final").trim();
  const rightVersionId = String(rightVersionValue || "").trim();
  if (!rightVersionId) {
    return { status: 400, payload: { error: "right_version_required", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const leftVersion = manifest.versions.find((entry) => entry.id === leftVersionId);
  const rightVersion = manifest.versions.find((entry) => entry.id === rightVersionId);
  if (!leftVersion || !rightVersion) {
    return { status: 404, payload: { error: "version_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const leftRaw = await readWorkspaceArtifactText(context.projectRoot, leftVersion.path);
  const rightRaw = await readWorkspaceArtifactText(context.projectRoot, rightVersion.path);
  if (!leftRaw || !rightRaw) {
    return { status: 404, payload: { error: "version_file_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const leftBody = cleanReaderChapterText(leftRaw);
  const rightBody = cleanReaderChapterText(rightRaw);
  const comparison = createReaderVersionComparison(leftBody, rightBody);
  return {
    status: 200,
    payload: {
      activeProjectId: context.projectId,
      chapterNumber,
      publishedVersionId: manifest.publishedVersionId,
      left: {
        ...leftVersion,
        title: readerChapterTitleFromRaw(leftRaw, manifest.chapterTitle, chapterNumber),
        wordCount: readerWordCount(leftBody),
        preview: truncateReaderText(leftBody, 2600)
      },
      right: {
        ...rightVersion,
        title: readerChapterTitleFromRaw(rightRaw, manifest.chapterTitle, chapterNumber),
        wordCount: readerWordCount(rightBody),
        preview: truncateReaderText(rightBody, 2600)
      },
      comparison,
      envStatus: getPublicProjectEnvStatus2(rootDir)
    }
  };
}
async function updateReaderChapterVersion(rootDir, body, projectId) {
  const chapterNumber = Number(body.chapterNumber);
  const requestedVersionId = String(body.versionId || "").trim();
  if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
    return { status: 400, payload: { error: "chapter_required", envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const context = await resolveProjectContext(rootDir, projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`;
  const manifestPath = path.join(context.projectRoot, ".ai-novel", "chapters", `${chapterId}.versions.json`);
  const rawManifest = await readWorkspaceArtifactText(context.projectRoot, `.ai-novel/chapters/${chapterId}.versions.json`);
  const manifest = rawManifest ? tryParseJsonText(rawManifest) : null;
  if (!manifest || typeof manifest !== "object") {
    return { status: 404, payload: { error: "version_manifest_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const record = manifest;
  const versionId = requestedVersionId || String(record.publishedVersionId || "").trim();
  if (!versionId) {
    return { status: 400, payload: { error: "version_required", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const versions = Array.isArray(record.versions) ? record.versions : [];
  const selected = versions.find((entry) => entry && typeof entry === "object" && String(entry.id || entry.source || "") === versionId);
  if (!selected) {
    return { status: 404, payload: { error: "version_not_found", activeProjectId: context.projectId, envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const selectedPath = String(selected.path || "");
  const selectedBody = selectedPath ? await readWorkspaceArtifactText(context.projectRoot, selectedPath) : null;
  if (!selectedBody) {
    return { status: 404, payload: { error: "version_file_not_found", activeProjectId: context.projectId, path: selectedPath, envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const requestedLocked = typeof body.locked === "boolean" ? body.locked : versionId === "final";
  const nextManifest = {
    ...record,
    publishedVersionId: versionId,
    locked: requestedLocked,
    status: requestedLocked ? "published" : "selected",
    updatedAt,
    versions: versions.map((entry) => entry && typeof entry === "object" && String(entry.id || entry.source || "") === versionId ? { ...entry, selectedAt: updatedAt } : entry)
  };
  const state = await tryLoadState(context.projectRoot).catch(() => null);
  const styleContext = await loadReaderStyleContext(context.projectRoot, state);
  const publishReadiness = await buildReaderChapterPublishReadiness(context.projectRoot, chapterNumber, nextManifest, styleContext);
  if (requestedLocked && !publishReadiness.ready) {
    return {
      status: 409,
      payload: {
        error: "publish_not_ready",
        activeProjectId: context.projectId,
        publishReadiness,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  nextManifest.publishReadiness = publishReadiness;
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}
`);
  const chapterResponse = await buildReaderChapterSnapshot(rootDir, context.projectId, chapterNumber);
  const snapshotResponse = await buildReaderSnapshot(rootDir, context.projectId);
  return {
    status: 200,
    payload: {
      success: true,
      activeProjectId: context.projectId,
      chapter: chapterResponse.status === 200 ? chapterResponse.payload.chapter : null,
      snapshot: snapshotResponse.status === 200 ? snapshotResponse.payload : null,
      envStatus: getPublicProjectEnvStatus2(rootDir)
    }
  };
}
async function persistBatchRefineManifestUpdate(input) {
  const chapterId = `chapter-${String(input.chapterNumber).padStart(3, "0")}`;
  const manifestPath = path.join(input.projectRoot, ".ai-novel", "chapters", `${chapterId}.versions.json`);
  const rawManifest = await readWorkspaceArtifactText(input.projectRoot, `.ai-novel/chapters/${chapterId}.versions.json`);
  const manifest = rawManifest ? tryParseJsonText(rawManifest) : null;
  const record = manifest && typeof manifest === "object" ? manifest : {
    version: 1,
    chapterNumber: input.chapterNumber,
    publishedVersionId: "final",
    versions: []
  };
  const versions = Array.isArray(record.versions) ? record.versions : [];
  const finalRelativePath = `.ai-novel/chapters/${chapterId}.final.md`;
  const finalVersionExists = versions.some((entry) => entry && typeof entry === "object" && String(entry.id || entry.source || "") === "final");
  const nextVersions = finalVersionExists ? versions.map((entry) => entry && typeof entry === "object" && String(entry.id || entry.source || "") === "final" ? {
    ...entry,
    path: String(entry.path || finalRelativePath),
    wordCount: readerWordCount(cleanReaderChapterText(input.finalDraft)),
    status: input.refined ? "refined" : String(entry.status || "final"),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  } : entry) : [
    ...versions,
    {
      id: "final",
      label: "Final",
      source: "final",
      path: finalRelativePath,
      wordCount: readerWordCount(cleanReaderChapterText(input.finalDraft)),
      status: input.refined ? "refined" : "final",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
  const shouldLock = input.refined && input.finalAigcReport.status === "passed" && input.styleConformanceDrift.status === "conformant" && Boolean(record.locked);
  const nextManifest = {
    ...record,
    version: Number(record.version || 1),
    publishedVersionId: String(record.publishedVersionId || "final"),
    locked: shouldLock,
    status: shouldLock ? "published" : "needs_review",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    versions: nextVersions,
    aigcDetection: input.finalAigcReport,
    styleConformanceDrift: input.styleConformanceDrift,
    batchRefine: {
      refined: input.refined,
      blockedReason: input.blockedReason || "",
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  };
  const state = await tryLoadState(input.projectRoot).catch(() => null);
  const styleContext = await loadReaderStyleContext(input.projectRoot, state);
  nextManifest.publishReadiness = await buildReaderChapterPublishReadiness(
    input.projectRoot,
    input.chapterNumber,
    nextManifest,
    styleContext
  );
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(nextManifest, null, 2)}
`);
  return nextManifest;
}
async function validateWorkflowCompletionReadiness(rootDir, projectRoot, projectId, state) {
  const workspacePayload = await createWorkspacePayload(projectRoot, state, {
    rootDir,
    projectId,
    syncState: false,
    includeTranscript: false,
    compactPayload: true
  });
  const productionReadiness = workspacePayload.productionReadiness;
  if (productionReadiness?.canProceed !== true || productionReadiness?.status !== "passed") {
    return {
      ok: false,
      error: "workflow_completion_readiness_blocked",
      reason: String(productionReadiness?.blockedReason || productionReadiness?.summary || "\u751F\u4EA7\u5C31\u7EEA\u95E8\u7981\u672A\u901A\u8FC7\u3002"),
      productionReadiness
    };
  }
  const readerSnapshot = await buildReaderSnapshot(rootDir, projectId);
  if (readerSnapshot.status !== 200) {
    return {
      ok: false,
      error: "workflow_completion_reader_snapshot_unavailable",
      reason: String(readerSnapshot.payload?.error || "\u9605\u8BFB\u5668\u53D1\u5E03\u5FEB\u7167\u4E0D\u53EF\u7528\u3002"),
      productionReadiness
    };
  }
  const readerPayload = readerSnapshot.payload;
  const chapters = Array.isArray(readerPayload.chapters) ? readerPayload.chapters : [];
  const totalChapters = Number(readerPayload.project?.totalChapters || state.plan?.totalChapters || state.plan?.chapterTasks?.length || 0);
  const readableChapters = Number(readerPayload.stats?.readableChapters || chapters.length || 0);
  const blockedChapters = chapters.filter((chapter) => chapter?.publishReadiness?.ready !== true);
  if (totalChapters > 0 && readableChapters < totalChapters) {
    return {
      ok: false,
      error: "workflow_completion_reader_chapters_incomplete",
      reason: `\u9605\u8BFB\u5668\u53EA\u53D1\u73B0 ${readableChapters}/${totalChapters} \u4E2A\u53EF\u8BFB\u7AE0\u8282\u3002`,
      productionReadiness,
      readerStats: readerPayload.stats || null
    };
  }
  if (blockedChapters.length > 0) {
    return {
      ok: false,
      error: "workflow_completion_publish_readiness_blocked",
      reason: `${blockedChapters.length} \u4E2A\u7AE0\u8282\u53D1\u5E03\u5C31\u7EEA\u9A8C\u8BC1\u672A\u901A\u8FC7\u3002`,
      productionReadiness,
      blockedChapters: blockedChapters.map((chapter) => ({
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        missing: chapter.publishReadiness?.missing || [],
        styleInheritanceVerification: chapter.publishReadiness?.styleInheritanceVerification || chapter.styleInheritanceVerification || null
      }))
    };
  }
  return {
    ok: true,
    productionReadiness,
    readerStats: readerPayload.stats || null
  };
}
async function buildReaderSearchSnapshot(rootDir, projectId, queryValue, limitValue) {
  const query = String(queryValue || "").trim();
  if (!query) {
    return { status: 200, payload: { activeProjectId: projectId || null, query, results: [], envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const context = await resolveProjectContext(rootDir, projectId);
  if (!context.projectRoot || !context.projectId) {
    return { status: 404, payload: { error: "project_required", projects: compactReaderProjects(context.projects), envStatus: getPublicProjectEnvStatus2(rootDir) } };
  }
  const limit = Math.max(1, Math.min(80, Number(limitValue) || 40));
  const projectRoot = context.projectRoot;
  const chapterFiles = await listWorkspaceFiles(projectRoot, "chapters");
  const groupedFiles = /* @__PURE__ */ new Map();
  for (const fileName of chapterFiles) {
    const match = fileName.match(/^chapter-(\d+)\.(final|reviewed|draft)\.md$/);
    if (!match) continue;
    const chapterNumber = Number.parseInt(match[1], 10);
    const source = match[2];
    groupedFiles.set(chapterNumber, {
      ...groupedFiles.get(chapterNumber) || {},
      [source]: `.ai-novel/chapters/${fileName}`
    });
  }
  const lowerQuery = query.toLowerCase();
  const results = [];
  for (const [chapterNumber, paths] of [...groupedFiles.entries()].sort((a, b) => a[0] - b[0])) {
    const source = paths.final ? "final" : paths.reviewed ? "reviewed" : paths.draft ? "draft" : "";
    const path2 = source ? paths[source] : "";
    if (!path2) continue;
    const raw = await readWorkspaceArtifactText(projectRoot, path2);
    if (!raw) continue;
    const body = cleanReaderChapterText(raw);
    if (!body) continue;
    const searchable = `${readerChapterTitleFromRaw(raw, "", chapterNumber)}
${body}`.toLowerCase();
    if (!searchable.includes(lowerQuery)) continue;
    const bodyMatches = body.toLowerCase().split(lowerQuery).length - 1;
    results.push({
      chapterNumber,
      title: readerChapterTitleFromRaw(raw, "", chapterNumber),
      source,
      path: path2,
      wordCount: readerWordCount(body),
      matchCount: Math.max(1, bodyMatches),
      snippet: readerSearchSnippet(body, query, 92)
    });
    if (results.length >= limit) break;
  }
  return {
    status: 200,
    payload: {
      activeProjectId: context.projectId,
      query,
      results,
      envStatus: getPublicProjectEnvStatus2(rootDir)
    }
  };
}
async function ensureDurableAutopilotJob(rootDir, projectId, message, options = {}) {
  if (!projectId) {
    return null;
  }
  return withFactoryDb(rootDir, async (db) => {
    const projectJobs = db.listProjectJobs(projectId, "autopilot");
    const activeJobs = projectJobs.filter((job) => job.status === "running" || job.status === "paused").sort(
      (left, right) => String(right.updated_at || right.created_at || "").localeCompare(String(left.updated_at || left.created_at || ""))
    );
    const recoverableFailedJob = projectJobs.filter((job) => job.status === "failed" && db.jobFailureLooksRecoverable(String(job.id))).sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")))[0];
    const reusableJob = activeJobs[0] ?? recoverableFailedJob;
    for (const duplicate of activeJobs.slice(1)) {
      db.cancelJob(String(duplicate.id));
    }
    if (reusableJob?.id) {
      if (reusableJob.status === "failed") {
        db.resumeJob(String(reusableJob.id), { message, mode: "background" });
      } else {
        db.updateJobPayload(String(reusableJob.id), { message, mode: "background", submittedAt: (/* @__PURE__ */ new Date()).toISOString() });
      }
      db.recordEvent(projectId, typeof reusableJob.run_id === "string" ? reusableJob.run_id : null, "JOB_REUSED", {
        id: reusableJob.id,
        kind: reusableJob.kind,
        status: reusableJob.status,
        requestedMessage: message,
        source: options.source || "autopilot"
      });
      db.recordEvent(projectId, typeof reusableJob.run_id === "string" ? reusableJob.run_id : null, "AUTOPILOT_INSTRUCTION_QUEUED", {
        id: reusableJob.id,
        message,
        status: reusableJob.status,
        source: options.source || "autopilot"
      });
      return String(reusableJob.id);
    }
    const jobId = db.createJob({
      projectId,
      kind: "autopilot",
      status: "running",
      payload: { message, mode: "background", source: options.source || "autopilot" }
    });
    db.recordEvent(projectId, null, "AUTOPILOT_INSTRUCTION_QUEUED", {
      id: jobId,
      message,
      status: "running",
      source: options.source || "autopilot"
    });
    return jobId;
  }).catch(() => null);
}
function createAutopilotKickoffMessage(state) {
  const chapterTasks = Array.isArray(state.plan?.chapterTasks) ? state.plan.chapterTasks : [];
  const nextTask = chapterTasks.find((task) => task.status !== "complete");
  if (state.runtime?.stage === "drafting" || state.runtime?.stage === "reviewing" || state.runtime?.stage === "chapter_task_generation") {
    return [
      `\u7EE7\u7EED\u5C0F\u8BF4\u300A${state.project.title || state.project.idea}\u300B\u7684\u7AE0\u8282\u6B63\u6587\u751F\u4EA7\u6D41\u7A0B\u3002`,
      `\u5F53\u524D\u9636\u6BB5\uFF1A${state.runtime.stage}\u3002\u4E0D\u8981\u91CD\u65B0\u6784\u601D\u4E16\u754C\u89C2\u3001\u4E3B\u89D2\u6838\u5FC3\u6216\u4E3B\u7EBF\u65B9\u5411\u3002`,
      nextTask ? `\u4ECE\u7B2C ${nextTask.chapterNumber} \u7AE0\u300C${nextTask.title || `Chapter ${nextTask.chapterNumber}`}\u300D\u7EE7\u7EED\uFF0C\u6309\u65E2\u6709\u7AE0\u8282\u961F\u5217\u3001\u89D2\u8272\u6863\u6848\u3001\u8BB0\u5FC6\u548C\u8D28\u91CF\u95E8\u7981\u63A8\u8FDB\u3002` : "\u68C0\u67E5\u7AE0\u8282\u961F\u5217\uFF0C\u7EE7\u7EED\u5904\u7406\u4E0B\u4E00\u4E2A pending\u3001blocked \u6216\u53EF\u6062\u590D\u7684\u7AE0\u8282\u4EFB\u52A1\u3002",
      `\u76EE\u6807\u603B\u7AE0\u6570\uFF1A${state.plan.totalChapters}\uFF0C\u5355\u7AE0\u5B57\u6570\uFF1A${state.plan.chapterWordTarget}\u3002`,
      "\u4F18\u5148\u6267\u884C\u6B63\u6587\u5199\u4F5C\u3001\u8D28\u91CF\u4FEE\u8BA2\u3001\u81EA\u7136\u5EA6/AIGC \u68C0\u6D4B\u4E0E\u8BB0\u5FC6\u5199\u56DE\uFF0C\u4E0D\u8981\u56DE\u5230\u9996\u8F6E\u8BBE\u5B9A\u8BA8\u8BBA\u3002"
    ].join("");
  }
  return [
    `\u8BF7\u57FA\u4E8E\u5C0F\u8BF4\u60F3\u6CD5\u201C${state.project.idea}\u201D\u63A5\u7BA1\u521B\u4F5C\u6D41\u7A0B\u3002`,
    "\u5148\u5B8C\u6210\u4E16\u754C\u89C2\u57FA\u7EBF\u3001\u4E3B\u89D2\u6838\u5FC3\u3001\u4E3B\u7EBF\u65B9\u5411\u7684\u9996\u8F6E\u7EDF\u4E00\u8BA8\u8BBA\u3002",
    `\u76EE\u6807\u603B\u7AE0\u6570\uFF1A${state.plan.totalChapters}\uFF0C\u5355\u7AE0\u5B57\u6570\uFF1A${state.plan.chapterWordTarget}\u3002`,
    "\u4E0D\u8981\u5411\u6211\u63D0\u95EE\u9009\u9879\uFF0C\u7F3A\u5931\u4FE1\u606F\u8BF7\u81EA\u884C\u5EFA\u7ACB\u9AD8\u8D28\u91CF\u5DE5\u4F5C\u5047\u8BBE\uFF0C\u5E76\u7ED9\u51FA\u7EDF\u4E00\u7ED3\u8BBA\u3002"
  ].join("");
}
async function enqueueKnowledgeReindexJobs(rootDir, projectId, scope = "all", options = {}) {
  return withFactoryDb(rootDir, async (db) => {
    const snapshot = db.getSnapshot(projectId);
    const queued = [];
    const reason = options.reason || "api_reindex";
    if (scope === "global" || scope === "all") {
      const id = db.createJob({
        projectId,
        kind: "knowledge_global_reindex",
        status: "idle",
        payload: {
          scope: "global",
          reason,
          limit: options.limit
        }
      });
      queued.push({ id, kind: "knowledge_global_reindex" });
    }
    if (scope === "project" || scope === "all") {
      const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
      const artifactPaths = [...new Set(artifacts.map((artifact) => String(artifact.path || "")).filter(
        (artifactPath) => artifactPath.endsWith(".md") && (artifactPath.includes("global-consensus.md") || artifactPath.includes("/consensus/") || artifactPath.includes("current-context.md") || artifactPath.includes("discussion-log.md") || artifactPath.includes("setting-freeze.md") || artifactPath.includes("master-outline.md") || artifactPath.includes("chapter-blueprints/") || artifactPath.includes(".final.md") || artifactPath.includes("-quality.md") || artifactPath.includes("-memory.md") || artifactPath.includes("production-resources/"))
      ))];
      for (const artifactPath of artifactPaths.slice(0, 200)) {
        const id = db.createJob({
          projectId,
          kind: "knowledge_project_artifact",
          status: "idle",
          payload: {
            projectId,
            artifactPath,
            kind: "artifact",
            reason
          }
        });
        queued.push({ id, kind: "knowledge_project_artifact", artifactPath });
      }
    }
    db.recordEvent(projectId, null, "KNOWLEDGE_REINDEX_QUEUED", {
      scope,
      reason,
      jobs: queued
    });
    return queued;
  });
}
async function stopInProcessAutopilotBeforeProjectDelete(projectRoot) {
  const job = getAutopilotJob(projectRoot);
  if (!job) {
    return false;
  }
  stopAutopilotJob(projectRoot);
  await Promise.race([
    job.promise.catch(() => void 0),
    new Promise((resolve) => setTimeout(resolve, 5e3))
  ]);
  return true;
}
async function buildProjectSummary(rootDir, project) {
  let dbSnapshot = null;
  try {
    dbSnapshot = await withFactoryDb(rootDir, async (db) => db.getSnapshot(project.id)).catch(() => null);
  } catch (e) {
  }
  const state = dbSnapshot?.state || await tryLoadState(project.projectRoot).catch(() => null);
  if (!state) {
    const projectRuntime2 = deriveProjectRuntimeState({
      state: null,
      factorySnapshot: dbSnapshot
    });
    return {
      source: "empty",
      stage: projectRuntime2.workflowStage === "empty" ? "worldbuilding_dialogue" : projectRuntime2.workflowStage,
      progressPercent: 0,
      totalChapters: project.totalChapters || 0,
      completedChapters: 0,
      pendingChapters: project.totalChapters || 0,
      inProgressChapters: 0,
      blockedChapters: 0,
      activeJobs: 0,
      runnableJobs: 0,
      latestEventType: "",
      latestEventAt: "",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      projectRuntime: projectRuntime2
    };
  }
  const tasks = Array.isArray(state.plan?.chapterTasks) ? state.plan.chapterTasks : [];
  const chapterFacts = Array.isArray(dbSnapshot?.chapterFacts) ? dbSnapshot.chapterFacts : [];
  const totalChapters = Number(state.plan?.totalChapters || project.totalChapters || tasks.length || 0);
  const passedChapters = chapterFacts.length > 0 ? chapterFacts.filter((fact) => fact.status === "complete").length : tasks.filter((task) => task.status === "complete").length;
  let contiguousCompletedChapters = 0;
  if (chapterFacts.length > 0) {
    const factsByChapter = new Map(chapterFacts.map((fact) => [Number(fact.chapterNumber), fact]));
    for (let ch = 1; ch <= totalChapters; ch += 1) {
      const factRecord = factsByChapter.get(ch);
      if (factRecord?.status !== "complete") break;
      contiguousCompletedChapters += 1;
    }
  } else {
    for (const task of tasks) {
      if (task.status !== "complete") break;
      contiguousCompletedChapters += 1;
    }
  }
  const completedChapters = Math.min(passedChapters, contiguousCompletedChapters);
  const inProgressChapters = chapterFacts.length > 0 ? chapterFacts.filter((fact) => fact.status === "in_progress").length : tasks.filter((task) => task.status === "in_progress").length;
  const blockedChapters = chapterFacts.length > 0 ? chapterFacts.filter((fact) => fact.status === "blocked").length : tasks.filter((task) => task.status === "blocked").length;
  const pendingChapters = Math.max(0, totalChapters - completedChapters - inProgressChapters - blockedChapters);
  const progressPercent = totalChapters > 0 ? Math.max(0, Math.min(100, Math.round(completedChapters / totalChapters * 100))) : 0;
  const activeJobs = Array.isArray(dbSnapshot?.activeJobs) ? dbSnapshot.activeJobs.length : 0;
  const runnableJobs = Array.isArray(dbSnapshot?.runnableJobs) ? dbSnapshot.runnableJobs.length : 0;
  const latestEvent = Array.isArray(dbSnapshot?.latestEvents) ? dbSnapshot.latestEvents[0] : null;
  const projectRuntime = deriveProjectRuntimeState({
    state,
    factorySnapshot: dbSnapshot
  });
  const progress = projectRuntime.chapterProgress;
  return {
    source: dbSnapshot ? "db" : "state",
    stage: projectRuntime.workflowStage,
    progressPercent: progress.progressPercent || progressPercent,
    totalChapters: progress.totalChapters || totalChapters,
    completedChapters: progress.completedChapters,
    pendingChapters: progress.pendingChapters,
    inProgressChapters: progress.inProgressChapters,
    blockedChapters: progress.blockedChapters,
    activeJobs,
    runnableJobs,
    latestEventType: latestEvent?.type || "",
    latestEventAt: latestEvent?.created_at || latestEvent?.updated_at || "",
    updatedAt: state.runtime?.lastUpdatedAt || (/* @__PURE__ */ new Date()).toISOString(),
    projectRuntime,
    coverStatus: state.assets?.cover?.status || "pending",
    coverImagePath: state.assets?.cover?.imagePath || "",
    coverGeneratedAt: state.assets?.cover?.generatedAt || "",
    coverPromptPath: state.assets?.cover?.promptPath || "",
    coverError: state.assets?.cover?.error || ""
  };
}
async function reconcileFactoryProjectsWithRegistry(rootDir) {
  const projects = await listAutonomousProjects(rootDir);
  await withFactoryDb(rootDir, async (db) => {
    const removedProjectIds = db.pruneProjectsExcept(projects.map((project) => project.id));
    for (const projectId of removedProjectIds) {
      db.recordEvent(null, null, "ORPHAN_PROJECT_PRUNED", { projectId });
    }
  }).catch(() => void 0);
  for (const project of projects) {
    project.summary = await buildProjectSummary(rootDir, project);
  }
  return projects;
}
async function resolveProjectContext(rootDir, projectId) {
  const projects = await reconcileFactoryProjectsWithRegistry(rootDir);
  if (projectId) {
    return {
      projects,
      projectId,
      projectRoot: await resolveManagedProjectRoot(rootDir, projectId),
      mode: "managed"
    };
  }
  if (projects.length === 1) {
    return {
      projects,
      projectId: projects[0].id,
      projectRoot: await resolveManagedProjectRoot(rootDir, projects[0].id),
      mode: "managed"
    };
  }
  if (projects.length > 1) {
    return {
      projects,
      projectId: null,
      projectRoot: null,
      mode: "selection_required"
    };
  }
  const legacyState = await tryLoadState(rootDir);
  if (legacyState) {
    return {
      projects: [],
      projectId: "legacy-root-workspace",
      projectRoot: rootDir,
      mode: "legacy"
    };
  }
  return {
    projects,
    projectId: null,
    projectRoot: null,
    mode: "empty"
  };
}
async function handleNovelStudioApi(rootDir, method, pathname, body = {}, options = {}) {
  const requestUrl = new URL(pathname, "http://local");
  const requestPathname = requestUrl.pathname;
  if (method === "POST" && requestPathname === "/api/aigc-detect") {
    const text = typeof body.text === "string" ? body.text : "";
    const mode = body.mode === "text" ? "text" : "segments";
    const detectorConfig = mergeApiAigcDetectorConfig(getAigcDetectorConfig(rootDir), body.config);
    const segments = Array.isArray(body.segments) ? readApiAigcSegments(body.segments) : null;
    if (!text.trim() && (!segments || segments.length === 0)) {
      return { status: 400, payload: { error: "text_required" } };
    }
    const result = mode === "text" && !segments ? await detectAigcText(text, detectorConfig) : await detectAigcSegments(segments ?? text, detectorConfig);
    return {
      status: 200,
      payload: {
        result
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/llm-configs") {
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    const routes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes();
    });
    return {
      status: 200,
      payload: {
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(routes)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/llm-configs") {
    const name = String(body.name || "").trim();
    const baseUrl = String(body.baseUrl || "").trim();
    const apiKey = String(body.apiKey || "").trim();
    const modelName = String(body.modelName || "").trim();
    const apiMode = normalizeLlmApiMode(body.apiMode ?? body.api_mode);
    const temperature = typeof body.temperature === "number" ? body.temperature : 0.1;
    const timeoutMs = typeof body.timeoutMs === "number" ? body.timeoutMs : 12e4;
    const configId = typeof body.id === "string" ? body.id.trim() : null;
    const isConfiguredPlaceholder = apiKey === "[configured]";
    if (!name || !baseUrl || !apiKey && !configId || !modelName) {
      return { status: 400, payload: { error: "missing_fields" } };
    }
    await withFactoryDb(rootDir, async (db) => {
      if (configId) {
        const currentConfig = db.listLlmConfigs().find((config) => config.id === configId);
        if (!currentConfig) {
          throw new Error("llm_config_not_found");
        }
        const nextApiKey = isConfiguredPlaceholder && typeof currentConfig?.api_key === "string" ? currentConfig.api_key : apiKey;
        if (!nextApiKey) {
          throw new Error("missing_api_key");
        }
        db.updateLlmConfig(configId, { name, baseUrl, apiKey: nextApiKey, modelName, apiMode, temperature, timeoutMs });
      } else {
        const existingConfigs = db.listLlmConfigs();
        const hasActiveConfig = existingConfigs.some((config) => Number(config.is_active) === 1);
        db.addLlmConfig({ name, baseUrl, apiKey, modelName, apiMode, temperature, timeoutMs, isActive: !hasActiveConfig });
      }
    });
    await loadActiveLlmConfig(rootDir);
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    const routes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes();
    });
    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(routes)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/llm-configs/activate") {
    const id = typeof body.id === "string" ? body.id.trim() : null;
    if (!id) {
      return { status: 400, payload: { error: "id_required" } };
    }
    await withFactoryDb(rootDir, async (db) => {
      db.activateLlmConfig(id);
    });
    await loadActiveLlmConfig(rootDir);
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    const routes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes();
    });
    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(routes)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/llm-config-routes") {
    const routes = body.routes && typeof body.routes === "object" && !Array.isArray(body.routes) ? body.routes : null;
    if (!routes) {
      return { status: 400, payload: { error: "routes_required" } };
    }
    await withFactoryDb(rootDir, async (db) => {
      for (const [capability, configId] of Object.entries(routes)) {
        if (typeof configId === "string" && configId.trim()) {
          db.setLlmConfigRoute(capability, configId.trim());
        } else {
          db.deleteLlmConfigRoute(capability);
        }
      }
    });
    await loadActiveLlmConfig(rootDir);
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    const nextRoutes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes();
    });
    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(nextRoutes)
      }
    };
  }
  if (method === "DELETE" && requestPathname === "/api/llm-configs") {
    const id = requestUrl.searchParams.get("id");
    if (!id) {
      return { status: 400, payload: { error: "id_required" } };
    }
    await withFactoryDb(rootDir, async (db) => {
      db.deleteLlmConfig(id);
    });
    await loadActiveLlmConfig(rootDir);
    const configs = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigs();
    });
    const routes = await withFactoryDb(rootDir, async (db) => {
      return db.listLlmConfigRoutes();
    });
    return {
      status: 200,
      payload: {
        success: true,
        configs: redactLlmConfigs(configs),
        routes: redactLlmRoutes(routes)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/projects") {
    return {
      status: 200,
      payload: {
        projects: await reconcileFactoryProjectsWithRegistry(rootDir),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "DELETE" && requestPathname.startsWith("/api/projects/")) {
    const projectId = decodeURIComponent(requestPathname.replace(/^\/api\/projects\//, "")).trim();
    if (!projectId) {
      return { status: 400, payload: { error: "project_id_required" } };
    }
    const projectRoot = await resolveManagedProjectRoot(rootDir, projectId).catch(() => null);
    const stoppedInProcess = projectRoot ? await stopInProcessAutopilotBeforeProjectDelete(projectRoot) : false;
    const deleted = await deleteManagedAutonomousProject(rootDir, projectId);
    if (!deleted) {
      return {
        status: 404,
        payload: {
          error: "project_not_found",
          projects: await listAutonomousProjects(rootDir),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    return {
      status: 200,
      payload: {
        deletedProject: deleted.project,
        stoppedInProcess,
        projects: await listAutonomousProjects(rootDir),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/health") {
    return {
      status: 200,
      payload: {
        ok: true,
        service: "ai-novel-server",
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/ready") {
    try {
      await reconcileFactoryProjectsWithRegistry(rootDir);
      const factory = await withFactoryDb(rootDir, async (db) => db.getOperationalStatus());
      return {
        status: 200,
        payload: {
          ok: true,
          service: "ai-novel-server",
          factory,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    } catch (error) {
      return {
        status: 503,
        payload: {
          ok: false,
          service: "ai-novel-server",
          error: error instanceof Error ? error.message : String(error),
          checkedAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    }
  }
  if (method === "POST" && requestPathname === "/api/projects") {
    const idea = String(body.idea || "").trim();
    const totalChapters = Number.parseInt(String(body.chapters || PRODUCTION_DEFAULT_TOTAL_CHAPTERS), 10);
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET), 10);
    if (!idea) {
      return { status: 400, payload: { error: "idea_required" } };
    }
    const created = await createManagedAutonomousProject({
      rootDir,
      idea,
      totalChapters,
      chapterWordTarget,
      title: typeof body.title === "string" ? body.title : void 0,
      creativeProfile: body.creativeProfile && typeof body.creativeProfile === "object" ? body.creativeProfile : void 0
    });
    await recordStatusMessage(rootDir, {
      projectId: created.project.id,
      conversationId: "workflow-control",
      runId: null,
      title: "\u9879\u76EE\u5DF2\u521B\u5EFA",
      content: "\u5DF2\u5EFA\u7ACB\u72EC\u7ACB\u5DE5\u4F5C\u533A\u3002\u81EA\u52A8\u521B\u4F5C\u4E0D\u4F1A\u81EA\u52A8\u542F\u52A8\uFF0C\u8BF7\u8FDB\u5165\u521B\u4F5C\u53F0\u540E\u70B9\u51FB\u201C\u5F00\u59CB\u521B\u4F5C\u201D\u3002",
      metadata: { source: "project_created", kickoffQueued: false }
    });
    const state = await markAutopilot(created.project.projectRoot, {
      running: false,
      stopRequested: false,
      mode: "idle",
      target: null,
      lastStep: "awaiting_user_start",
      statusMessage: "\u9879\u76EE\u5DF2\u521B\u5EFA\uFF0C\u7B49\u5F85\u624B\u52A8\u5F00\u59CB\u81EA\u52A8\u521B\u4F5C\u3002"
    }, { factoryRootDir: rootDir, projectId: created.project.id });
    return {
      status: 201,
      payload: {
        activeProjectId: created.project.id,
        projectId: created.project.id,
        projects: await reconcileFactoryProjectsWithRegistry(rootDir),
        kickoffQueued: false,
        autopilotJobId: null,
        autopilotQueued: false,
        state,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/knowledge-graph") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    let graph = { nodes: [], edges: [] };
    try {
      const dbGraph = await withFactoryDb(rootDir, async (db) => db.getGraph(context.projectId));
      if (dbGraph && Array.isArray(dbGraph.nodes) && dbGraph.nodes.length > 0) {
        const storyNodeTypes = /* @__PURE__ */ new Set([
          "Character",
          "Location",
          "Faction",
          "Event",
          "Scene",
          "Foreshadowing",
          "WorldRule",
          "Conflict",
          "Relationship",
          "TimelinePoint"
        ]);
        const nodes = dbGraph.nodes.map((n) => {
          let properties = {};
          try {
            properties = typeof n.metadata_json === "string" ? JSON.parse(n.metadata_json) : n.metadata_json || {};
          } catch (e) {
          }
          return {
            id: n.id,
            node_type: n.type,
            label: n.label,
            content: properties.description || properties.desc || n.label,
            metadata_json: JSON.stringify({
              importance: properties.importance || 3,
              tags: properties.tags || [],
              ...properties
            })
          };
        });
        const storyNodes = nodes.filter((n) => {
          const lowerType = String(n.node_type || "").toLowerCase();
          return Array.from(storyNodeTypes).some((st) => st.toLowerCase() === lowerType);
        });
        if (storyNodes.length > 0) {
          const storyNodeIds = new Set(storyNodes.map((n) => n.id));
          const edges = dbGraph.edges.filter((e) => storyNodeIds.has(e.from_node_id) && storyNodeIds.has(e.to_node_id)).map((e, index) => ({
            id: e.id || `db-edge-${index}`,
            source_id: e.from_node_id,
            target_id: e.to_node_id,
            relation_type: e.type || "\u5173\u8054",
            metadata_json: e.metadata_json || "{}"
          }));
          graph = { nodes: storyNodes, edges };
        }
      }
    } catch (err) {
      console.error("Failed to query graph from factory db:", err);
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...graph,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/style-evolution") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const styleEvolution = await loadStyleEvolution(context.projectRoot);
    const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        styleEvolution,
        styleEvolutionAssets,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/style-evolution/init") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const state = await loadAutonomousState(context.projectRoot).catch(() => null);
    const styleEvolution = await initializeStyleEvolution(context.projectRoot, {
      projectTitle: typeof body.projectTitle === "string" ? body.projectTitle : state?.project?.title,
      idea: typeof body.idea === "string" ? body.idea : state?.project?.idea,
      seedPrompt: typeof body.seedPrompt === "string" ? body.seedPrompt : void 0,
      userStylePrompt: typeof body.userStylePrompt === "string" ? body.userStylePrompt : void 0,
      referenceText: typeof body.referenceText === "string" ? body.referenceText : void 0,
      referenceWorks: Array.isArray(body.referenceWorks) ? body.referenceWorks.filter((item) => typeof item === "string") : void 0,
      desiredVibes: Array.isArray(body.desiredVibes) ? body.desiredVibes.filter((item) => typeof item === "string") : void 0,
      seedForbiddenPatterns: Array.isArray(body.seedForbiddenPatterns) ? body.seedForbiddenPatterns.filter((item) => typeof item === "string") : void 0,
      overwrite: body.overwrite === true
    });
    const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        styleEvolution,
        styleEvolutionAssets,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/style-evolution/candidate") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const sample = typeof body.sample === "string" ? body.sample.trim() : "";
    const review = typeof body.review === "string" ? body.review : void 0;
    if (!prompt || !sample) {
      return { status: 400, payload: { error: "prompt_and_sample_required" } };
    }
    const currentStyleEvolution = await loadStyleEvolution(context.projectRoot);
    let aigcSignal;
    const aigcConfig = getAigcDetectorConfig(context.projectRoot);
    aigcSignal = await detectStyleAigcSignal(sample, aigcConfig, "manual-style-candidate");
    const evaluation = evaluateStyleEvolutionCandidate({
      prompt,
      sample,
      userStylePrompt: currentStyleEvolution.contract.userStylePrompt,
      aigc: aigcSignal
    });
    const refinement = buildStyleEvolutionRefinement({
      prompt,
      userStylePrompt: currentStyleEvolution.contract.userStylePrompt,
      evaluation
    });
    const verification = buildStyleGenerationVerification({
      evaluation,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const freezer = buildStyleFreezerGateRecord(null, { evaluation, verification });
    const styleEvolution = await appendStyleEvolutionCandidate(context.projectRoot, {
      prompt,
      sample,
      review: review || evaluation.summary,
      evaluation,
      refinement,
      freezer,
      source: "manual"
    });
    const styleEvolutionAssets = await readStyleEvolutionAssetSnapshot(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        styleEvolution,
        styleEvolutionAssets,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/style-evolution/generate-candidate") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const state = await loadAutonomousState(context.projectRoot).catch(() => null);
    let styleEvolution = await loadStyleEvolution(context.projectRoot);
    const userStylePrompt = typeof body.userStylePrompt === "string" ? body.userStylePrompt.trim() : "";
    const referenceText = typeof body.referenceText === "string" ? body.referenceText.trim() : "";
    const referenceWorks = Array.isArray(body.referenceWorks) ? body.referenceWorks.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
    const desiredVibes = Array.isArray(body.desiredVibes) ? body.desiredVibes.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
    const seedForbiddenPatterns = Array.isArray(body.seedForbiddenPatterns) ? body.seedForbiddenPatterns.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
    const iterationFeedback = typeof body.iterationFeedback === "string" ? body.iterationFeedback.trim() : "";
    if (!styleEvolution.contract.seedPrompt?.trim() || userStylePrompt || referenceText || referenceWorks.length || desiredVibes.length || seedForbiddenPatterns.length) {
      styleEvolution = await initializeStyleEvolution(context.projectRoot, {
        projectTitle: state?.project?.title,
        idea: state?.project?.idea,
        userStylePrompt: userStylePrompt || styleEvolution.contract.userStylePrompt,
        referenceText: referenceText || styleEvolution.contract.referenceText,
        referenceWorks: referenceWorks.length ? referenceWorks : styleEvolution.contract.referenceWorks,
        desiredVibes: desiredVibes.length ? desiredVibes : styleEvolution.contract.desiredVibes,
        seedForbiddenPatterns: seedForbiddenPatterns.length ? seedForbiddenPatterns : styleEvolution.contract.seedForbiddenPatterns
      });
    }
    const textConfig = await loadStyleEvolutionLlmConfig(rootDir);
    const apiKey = textConfig?._dbApiKey || "";
    if (!textConfig || !apiKey) {
      return {
        status: 400,
        payload: {
          error: "text_llm_config_required",
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const loopRun = await runStyleEvolutionLoop({
      projectRoot: context.projectRoot,
      rootDir,
      projectTitle: state?.project?.title,
      idea: state?.project?.idea,
      userStylePrompt: userStylePrompt || styleEvolution.contract.userStylePrompt,
      referenceText: referenceText || styleEvolution.contract.referenceText,
      referenceWorks: referenceWorks.length ? referenceWorks : styleEvolution.contract.referenceWorks,
      desiredVibes: desiredVibes.length ? desiredVibes : styleEvolution.contract.desiredVibes,
      seedForbiddenPatterns: seedForbiddenPatterns.length ? seedForbiddenPatterns : styleEvolution.contract.seedForbiddenPatterns,
      iterationFeedback,
      textConfig,
      apiKey,
      maxIterations: resolveStyleLoopIterations(body.loopIterations, 1),
      candidateCount: resolveStyleCandidateCount(body.candidateCount, 1)
    });
    styleEvolution = loopRun.styleEvolution;
    const latestIteration = loopRun.iterations.at(-1);
    if (!latestIteration?.sample?.trim()) {
      const allBlocked = loopRun.stopReason === "style_candidates_all_blocked";
      return {
        status: allBlocked ? 409 : 502,
        payload: {
          error: allBlocked ? "style_candidates_all_blocked" : "style_candidate_empty_response",
          reason: allBlocked ? "\u672C\u8F6E\u6240\u6709\u5019\u9009\u90FD\u672A\u901A\u8FC7 Generation Verification Gate\uFF0C\u7CFB\u7EDF\u6CA1\u6709\u628A\u5931\u8D25\u6837\u6BB5\u5199\u5165\u6B63\u5F0F\u5019\u9009\u5386\u53F2\u3002\u8BF7\u8C03\u6574\u98CE\u683C\u8981\u6C42\u3001\u7981\u5FCC\u6216 AIGC \u914D\u7F6E\u540E\u91CD\u8BD5\u3002" : void 0,
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets: await readStyleEvolutionAssetSnapshot(context.projectRoot),
          loopRun: {
            runId: loopRun.loopRuntime.runId,
            totalIterations: loopRun.iterations.length,
            candidateCount: resolveStyleCandidateCount(body.candidateCount, 1),
            stopReason: loopRun.stopReason,
            status: loopRun.loopRuntime.status,
            startedAt: loopRun.loopRuntime.startedAt,
            completedAt: loopRun.loopRuntime.completedAt,
            iterations: loopRun.loopRuntime.iterations
          },
          modelRouting: {
            capability: textConfig._capability || "style_evolution",
            configId: textConfig._configId,
            modelName: textConfig.provider.modelName,
            apiMode: textConfig.provider.apiMode
          },
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        styleEvolution,
        styleEvolutionAssets: await readStyleEvolutionAssetSnapshot(context.projectRoot),
        generatedCandidate: {
          prompt: latestIteration.prompt,
          sample: latestIteration.sample,
          version: styleEvolution.contract.evolutionHistory?.at(-1)?.version,
          candidateIndex: latestIteration.candidates?.[0]?.candidateIndex ? latestIteration.candidates.find((entry) => entry.sample === latestIteration.sample)?.candidateIndex : 1
        },
        loopIteration: {
          evaluation: latestIteration.evaluation,
          refinement: latestIteration.refinement,
          verification: latestIteration.verification,
          candidates: latestIteration.candidates || [],
          status: styleEvolution.contract.loop || null
        },
        loopRun: {
          runId: loopRun.loopRuntime.runId,
          totalIterations: loopRun.iterations.length,
          candidateCount: resolveStyleCandidateCount(body.candidateCount, 1),
          stopReason: loopRun.stopReason,
          status: loopRun.loopRuntime.status,
          startedAt: loopRun.loopRuntime.startedAt,
          completedAt: loopRun.loopRuntime.completedAt,
          finalLoopStatus: loopRun.loopRuntime.finalLoopStatus,
          finalConvergence: loopRun.loopRuntime.finalConvergence,
          iterations: loopRun.iterations.map((entry) => ({
            version: entry.version,
            candidates: entry.candidates || [],
            evaluation: entry.evaluation,
            refinement: entry.refinement,
            verification: entry.verification,
            freezer: entry.freezer,
            freezerSource: entry.freezer?.source,
            llmFallbackUsed: entry.llmFallbackUsed,
            fallbackReasons: entry.fallbackReasons
          }))
        },
        modelRouting: {
          capability: textConfig._capability || "style_evolution",
          configId: textConfig._configId,
          modelName: textConfig.provider.modelName,
          apiMode: textConfig.provider.apiMode
        },
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/style-evolution/freeze-preview") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const version = typeof body.version === "number" ? body.version : typeof body.version === "string" && body.version.trim() ? Number.parseInt(body.version, 10) : void 0;
    const antiPatterns = Array.isArray(body.antiPatterns) ? body.antiPatterns.filter((item) => typeof item === "string" && item.trim().length > 0) : void 0;
    try {
      const freezePreview = await buildStyleFreezePreview({
        projectRoot: context.projectRoot,
        rootDir,
        version: Number.isFinite(version) ? version : void 0,
        sample: typeof body.sample === "string" ? body.sample : void 0,
        frozenBasePrompt: typeof body.frozenBasePrompt === "string" ? body.frozenBasePrompt : void 0,
        antiPatterns
      });
      const styleEvolution = await loadStyleEvolution(context.projectRoot);
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets: await readStyleEvolutionAssetSnapshot(context.projectRoot),
          freezePreview,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    } catch (error) {
      const styleWorkspace = await buildStyleEvolutionWorkspacePayloadSafe(rootDir, {
        projectRoot: context.projectRoot,
        projectId: context.projectId
      });
      return {
        status: 400,
        payload: {
          error: error instanceof Error ? error.message : String(error),
          activeProjectId: context.projectId,
          projects: context.projects,
          ...styleWorkspace,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
  }
  if (method === "POST" && requestPathname === "/api/style-evolution/approve") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const version = typeof body.version === "number" ? body.version : typeof body.version === "string" && body.version.trim() ? Number.parseInt(body.version, 10) : void 0;
    const sample = typeof body.sample === "string" ? body.sample : void 0;
    let styleContract = body.styleContract && typeof body.styleContract === "object" && !Array.isArray(body.styleContract) ? body.styleContract : void 0;
    const antiPatterns = Array.isArray(body.antiPatterns) ? body.antiPatterns.filter((item) => typeof item === "string" && item.trim().length > 0) : void 0;
    try {
      const approvedAt = typeof body.approvedAt === "string" ? body.approvedAt : void 0;
      let freezePreview = null;
      const approvalFallbackReasons = [];
      try {
        freezePreview = await buildStyleFreezePreview({
          projectRoot: context.projectRoot,
          rootDir,
          version: Number.isFinite(version) ? version : void 0,
          sample,
          frozenBasePrompt: typeof body.frozenBasePrompt === "string" ? body.frozenBasePrompt : void 0,
          antiPatterns
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if ([
          "style_candidate_not_found",
          "style_candidate_rejected",
          "style_generation_verification_blocked",
          "style_candidate_not_verified"
        ].includes(errorMessage)) {
          throw error;
        }
        approvalFallbackReasons.push(`style_freeze_preview_synthesis_failed: ${errorMessage}`.slice(0, 360));
        console.warn("Style approval freeze preview synthesis failed; approval will continue with available contract data.", error);
      }
      if (!freezePreview && !styleContract) {
        approvalFallbackReasons.push("style_approval_contract_will_use_core_local_fallback");
      }
      const styleFreezeApproval = {
        llmFallbackUsed: freezePreview?.llmFallbackUsed === true || approvalFallbackReasons.length > 0,
        fallbackReasons: [...new Set([...freezePreview?.fallbackReasons || [], ...approvalFallbackReasons].filter(Boolean))],
        contractExtractionSource: freezePreview?.contractExtractionSource || (styleContract ? "provided" : "local_fallback"),
        freezeAdviceSource: freezePreview?.freezeAdviceSource || "local_fallback"
      };
      const styleEvolution = await approveStyleEvolutionSample(context.projectRoot, {
        version: Number.isFinite(version) ? version : void 0,
        sample,
        approvedAt,
        styleContract: freezePreview?.styleContract || styleContract,
        antiPatterns: antiPatterns || freezePreview?.antiPatterns,
        frozenBasePrompt: typeof body.frozenBasePrompt === "string" ? body.frozenBasePrompt : freezePreview?.frozenBasePrompt || void 0,
        freezeSummary: freezePreview?.freezeSummary,
        positiveExamples: freezePreview?.positiveExamples,
        inheritedRules: freezePreview?.inheritedRules,
        freezer: freezePreview?.freezer
      });
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets: await readStyleEvolutionAssetSnapshot(context.projectRoot),
          freezePreview,
          styleFreezeApproval,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    } catch (error) {
      return {
        status: 400,
        payload: {
          error: error instanceof Error ? error.message : String(error),
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
  }
  if (method === "POST" && requestPathname === "/api/style-evolution/accept") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const version = typeof body.version === "number" ? body.version : typeof body.version === "string" && body.version.trim() ? Number.parseInt(body.version, 10) : void 0;
    try {
      const styleEvolution = await acceptStyleEvolutionCandidate(context.projectRoot, {
        version: Number.isFinite(version) ? version : void 0,
        acceptedAt: typeof body.acceptedAt === "string" ? body.acceptedAt : void 0
      });
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets: await readStyleEvolutionAssetSnapshot(context.projectRoot),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    } catch (error) {
      return {
        status: 400,
        payload: {
          error: error instanceof Error ? error.message : String(error),
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
  }
  if (method === "POST" && requestPathname === "/api/style-evolution/reject") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const version = typeof body.version === "number" ? body.version : typeof body.version === "string" && body.version.trim() ? Number.parseInt(body.version, 10) : void 0;
    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
    try {
      const styleEvolution = await rejectStyleEvolutionSample(context.projectRoot, {
        version: Number.isFinite(version) ? version : void 0,
        rejectionReason,
        rejectedAt: typeof body.rejectedAt === "string" ? body.rejectedAt : void 0
      });
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          styleEvolution,
          styleEvolutionAssets: await readStyleEvolutionAssetSnapshot(context.projectRoot),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    } catch (error) {
      return {
        status: 400,
        payload: {
          error: error instanceof Error ? error.message : String(error),
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
  }
  if (method === "GET" && requestPathname === "/api/reader-snapshot") {
    return buildReaderSnapshot(rootDir, options.projectId);
  }
  if (method === "GET" && requestPathname === "/api/reader-chapter") {
    return buildReaderChapterSnapshot(rootDir, options.projectId, requestUrl.searchParams.get("chapterNumber"));
  }
  if (method === "GET" && requestPathname === "/api/reader-chapter-versions/compare") {
    return buildReaderChapterVersionCompare(
      rootDir,
      options.projectId,
      requestUrl.searchParams.get("chapterNumber"),
      requestUrl.searchParams.get("leftVersionId"),
      requestUrl.searchParams.get("rightVersionId")
    );
  }
  if (method === "GET" && requestPathname === "/api/reader-search") {
    return buildReaderSearchSnapshot(rootDir, options.projectId, requestUrl.searchParams.get("query"), requestUrl.searchParams.get("limit"));
  }
  if (method === "POST" && requestPathname === "/api/reader-chapter-version") {
    return updateReaderChapterVersion(rootDir, body, options.projectId);
  }
  if (method === "GET" && requestPathname === "/api/status") {
    const includeTranscript = requestUrl.searchParams.get("includeTranscript") === "1";
    const chapterPage = Number.parseInt(String(requestUrl.searchParams.get("chapterPage") || ""), 10);
    const chapterPageSize = Number.parseInt(String(requestUrl.searchParams.get("chapterPageSize") || ""), 10);
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (context.mode === "selection_required") {
      return {
        status: 409,
        payload: {
          error: "project_selection_required",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    if (!context.projectRoot) {
      return {
        status: 404,
        payload: {
          error: "workspace_not_initialized",
          transcript: "",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const snapshotState = context.projectId ? await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId).state).catch(() => null) : null;
    const fileState = await tryLoadState(context.projectRoot);
    const state = snapshotState ?? fileState;
    if (!state) {
      return {
        status: 404,
        payload: {
          error: "workspace_not_initialized",
          transcript: "",
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const workspacePayload = await createWorkspacePayload(context.projectRoot, state, {
      rootDir,
      projectId: context.projectId,
      syncState: true,
      includeTranscript,
      chapterPage: Number.isFinite(chapterPage) ? chapterPage : void 0,
      chapterPageSize: Number.isFinite(chapterPageSize) ? chapterPageSize : void 0
    });
    const knownSnapshotVersion = requestUrl.searchParams.get("knownSnapshotVersion");
    if (!includeTranscript && knownSnapshotVersion && knownSnapshotVersion === workspacePayload.snapshotVersion) {
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          notModified: true,
          snapshotVersion: workspacePayload.snapshotVersion
        }
      };
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...workspacePayload,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/transcript") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const limit = Math.max(1, Math.min(200, Number.parseInt(requestUrl.searchParams.get("limit") || "80", 10)));
    const transcript = await readDiscussionTranscript(context.projectRoot);
    const messageEntries = context.projectId ? await withFactoryDb(rootDir, async (db) => messageRowsToEntries(db.listMessages(context.projectId, { limit }), { limit, transcriptBytes: Buffer.byteLength(transcript) })).catch(() => null) : null;
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...messageEntries ?? parseTranscriptEntries(transcript, { limit }),
        transcript,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/messages") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const limit = Math.max(1, Math.min(500, Number.parseInt(requestUrl.searchParams.get("limit") || "80", 10)));
    const offset = Math.max(0, Number.parseInt(requestUrl.searchParams.get("offset") || "0", 10) || 0);
    const conversationId = requestUrl.searchParams.get("conversationId") || void 0;
    const messagePage = await withFactoryDb(rootDir, async (db) => {
      const totalMessages2 = db.countMessages(context.projectId, { conversationId });
      const messages2 = db.listMessages(context.projectId, { limit, offset, conversationId });
      return { messages: messages2, totalMessages: totalMessages2 };
    }).catch(() => ({ messages: [], totalMessages: 0 }));
    const messages = messagePage.messages;
    const totalMessages = messagePage.totalMessages;
    const nextOffset = offset + messages.length;
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        messages,
        ...messageRowsToEntries(messages, { limit }),
        pagination: {
          limit,
          offset,
          returned: messages.length,
          totalMessages,
          hasMore: nextOffset < totalMessages,
          nextOffset: nextOffset < totalMessages ? nextOffset : null,
          conversationId: conversationId || null
        },
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/chapters/preview") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const chapterNumber = Number.parseInt(String(requestUrl.searchParams.get("chapterNumber") || ""), 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return { status: 400, payload: { error: "chapter_number_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`;
    const relativePath = `.ai-novel/chapters/${chapterId}.final.md`;
    const content = await readWorkspaceText(context.projectRoot, "chapters", `${chapterId}.final.md`);
    if (!content) {
      return {
        status: 404,
        payload: {
          error: "chapter_not_found",
          chapterNumber,
          path: relativePath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const chapterSnapshot = await buildReaderChapterSnapshot(rootDir, context.projectId, chapterNumber).catch(() => null);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        chapterNumber,
        path: relativePath,
        content,
        chapter: chapterSnapshot?.status === 200 ? chapterSnapshot.payload.chapter : null,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/artifacts/preview") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const artifactPath = String(requestUrl.searchParams.get("path") || "").trim();
    if (!artifactPath) {
      return { status: 400, payload: { error: "artifact_path_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const content = await readWorkspaceArtifactText(context.projectRoot, artifactPath);
    if (content === null) {
      return {
        status: 400,
        payload: {
          error: "artifact_path_not_allowed",
          path: artifactPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    if (!content) {
      return {
        status: 404,
        payload: {
          error: "artifact_not_found",
          path: artifactPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        path: artifactPath,
        content,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/assets/image") {
    const context = await resolveProjectContext(rootDir, options.projectId);
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const assetPath = String(requestUrl.searchParams.get("path") || "").trim();
    if (!assetPath) {
      return { status: 400, payload: { error: "asset_path_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const asset = await readWorkspaceAssetDataUrl(context.projectRoot, assetPath);
    if (asset === null) {
      return {
        status: 400,
        payload: {
          error: "asset_path_not_allowed",
          path: assetPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    if (!asset.dataUrl) {
      return {
        status: 404,
        payload: {
          error: "asset_not_found",
          path: assetPath,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...asset,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/init") {
    const idea = String(body.idea || "").trim();
    const totalChapters = Number.parseInt(String(body.chapters || PRODUCTION_DEFAULT_TOTAL_CHAPTERS), 10);
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || PRODUCTION_DEFAULT_CHAPTER_WORD_TARGET), 10);
    if (!idea) {
      return { status: 400, payload: { error: "idea_required" } };
    }
    const state = await initAutonomousProject({
      rootDir,
      idea,
      totalChapters,
      chapterWordTarget,
      title: typeof body.title === "string" ? body.title : void 0
    });
    return { status: 200, payload: await createWorkspacePayload(rootDir, state, { rootDir, projectId: "legacy-root-workspace", syncState: true }) };
  }
  if (method === "POST" && requestPathname === "/api/advance") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const { state } = await executeManualAdvanceCommand(context.projectRoot, {
      factoryRootDir: rootDir,
      projectId: context.projectId,
      source: "api",
      requestedBy: "api:/api/advance"
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/production/story-assets/repair") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const snapshotState = context.projectId ? await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId).state).catch(() => null) : null;
    const fileState = await tryLoadState(context.projectRoot);
    const state = snapshotState ?? fileState;
    if (!state) {
      return { status: 404, payload: { error: "workspace_not_initialized", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const paths = getNovelWorkspacePaths(context.projectRoot);
    const storyContext = {
      consensus: await readWorkspaceText(context.projectRoot, "prompts", "global-consensus.md") || "",
      protagonist: await readWorkspaceText(context.projectRoot, "memory", "characters", "core", "protagonist.md"),
      style: await readWorkspaceText(context.projectRoot, "style", "profile.md")
    };
    const written = await writeProductionStoryBibleAssets(context.projectRoot, paths, state, storyContext, {
      factoryRootDir: rootDir,
      projectId: context.projectId
    });
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "\u6545\u4E8B\u57FA\u5EFA\u5DF2\u8865\u9F50",
      content: "\u4E16\u754C\u77E9\u9635\u3001\u4E3B\u7EBF\u67B6\u6784\u3001\u6545\u4E8B\u5723\u7ECF\u3001\u5206\u5377\u7B56\u7565\u3001\u4F0F\u7B14\u8D26\u672C\u548C\u4EBA\u7269\u5173\u7CFB\u8D44\u4EA7\u5DF2\u91CD\u65B0\u751F\u6210\u3002",
      metadata: {
        source: "api_story_assets_repair",
        written: written.map((item) => path.relative(context.projectRoot, item).replaceAll("\\", "/"))
      }
    });
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "story-assets-repair",
      status: "completed",
      input: { projectId: context.projectId },
      output: { writtenCount: written.length },
      content: `\u5DF2\u751F\u6210 ${written.length} \u4E2A\u751F\u4EA7\u6545\u4E8B\u57FA\u5EFA\u8D44\u4EA7\u3002`,
      metadata: { source: "api_story_assets_repair" }
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        repairedStoryAssets: written.map((item) => `.ai-novel/${path.relative(path.join(context.projectRoot, ".ai-novel"), item).replaceAll("\\", "/")}`),
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/production/story-foundation/approve") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const snapshotState = context.projectId ? await withFactoryDb(rootDir, async (db) => db.getSnapshot(context.projectId).state).catch(() => null) : null;
    const fileState = await tryLoadState(context.projectRoot);
    const state = snapshotState ?? fileState;
    if (!state) {
      return { status: 404, payload: { error: "workspace_not_initialized", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const note = typeof body.note === "string" ? body.note.trim() : void 0;
    const approvedBy = typeof body.approvedBy === "string" ? body.approvedBy.trim() : void 0;
    const consensus = await readWorkspaceArtifactText(context.projectRoot, ".ai-novel/prompts/global-consensus.md") || "";
    const planningAssetDetails = await Promise.all([
      "world-matrix.md",
      "plot-architecture.md",
      "story-bible.md",
      "volume-strategy.md",
      "foreshadowing-ledger.md",
      "character-dynamics.md",
      "story-foundation-contract.json",
      "world-matrix.json",
      "plot-architecture.json",
      "story-bible.json",
      "volume-strategy.json",
      "foreshadowing-ledger.json",
      "character-dynamics.json",
      "writing-plan.json"
    ].map(async (required) => {
      const pathValue = `.ai-novel/plans/${required}`;
      const present = Boolean((await readWorkspaceArtifactText(context.projectRoot, pathValue))?.trim());
      const issue = present && required.endsWith(".json") ? planningAssetStructuralIssue(required, await readWorkspaceArtifactJson(context.projectRoot, pathValue), Number(state?.plan?.totalChapters || 0)) : "";
      return {
        key: required.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
        label: required,
        path: pathValue,
        status: present && !issue ? "passed" : "blocked",
        detail: present ? issue || "\u5DF2\u751F\u6210" : "\u7F3A\u5931"
      };
    }));
    const storyFoundationContract = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/story-foundation-contract.json");
    const worldMatrix = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/world-matrix.json");
    const plotArchitecture = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/plot-architecture.json");
    const storyBible = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/story-bible.json");
    const volumeStrategy = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/volume-strategy.json");
    const foreshadowingLedger = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/foreshadowing-ledger.json");
    const characterDynamics = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/character-dynamics.json");
    const writingPlan = await readWorkspaceArtifactJson(context.projectRoot, ".ai-novel/plans/writing-plan.json");
    const storyFoundationFingerprintInput = buildStoryFoundationFingerprintInput({
      planningAssetDetails,
      storyFoundationContract,
      worldMatrix,
      plotArchitecture,
      storyBible,
      volumeStrategy,
      foreshadowingLedger,
      characterDynamics,
      writingPlan
    });
    const storyFoundationAssetFingerprint = createStoryFoundationFingerprint(storyFoundationFingerprintInput);
    const approval = await writeStoryFoundationApproval(context.projectRoot, { note, approvedBy, assetFingerprint: storyFoundationAssetFingerprint });
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "\u6545\u4E8B\u57FA\u5EFA\u5DF2\u786E\u8BA4",
      content: "\u7528\u6237\u5DF2\u786E\u8BA4\u4E16\u754C\u89C2\u3001\u4E3B\u7EBF\u3001\u4EBA\u7269\u5173\u7CFB\u3001\u4F0F\u7B14\u8D26\u672C\u548C\u5199\u4F5C\u6267\u884C\u8BA1\u5212\uFF0C\u53EF\u4EE5\u4F5C\u4E3A\u6B63\u6587\u751F\u4EA7\u524D\u63D0\u3002",
      metadata: {
        source: "api_story_foundation_approve",
        approvalPath: `.ai-novel/plans/${STORY_FOUNDATION_APPROVAL_FILE}`,
        approvedAt: approval.approvedAt
      }
    });
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "story-foundation-approve",
      status: "completed",
      input: { projectId: context.projectId },
      output: { approvalPath: `.ai-novel/plans/${STORY_FOUNDATION_APPROVAL_FILE}`, approvedAt: approval.approvedAt },
      content: "\u6545\u4E8B\u57FA\u5EFA\u7528\u6237\u786E\u8BA4\u5DF2\u5199\u5165\u751F\u4EA7\u5BA1\u6279\u6587\u4EF6\u3002",
      metadata: { source: "api_story_foundation_approve" }
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        storyFoundationApproval: approval,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/chapters/retry") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const chapterNumber = Number.parseInt(String(body.chapterNumber || ""), 10);
    if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) {
      return { status: 400, payload: { error: "chapter_number_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    try {
      const { state, recoveryLimited } = await executeManualRetryChapterCommand(context.projectRoot, chapterNumber, {
        factoryRootDir: rootDir,
        projectId: context.projectId,
        source: "api",
        requestedBy: "api:/api/chapters/retry",
        runNow: body.runNow !== false
      });
      await recordStatusMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: "workflow-control",
        title: "\u7AE0\u8282\u91CD\u8BD5\u5DF2\u63A5\u6536",
        content: recoveryLimited ? `\u7B2C ${chapterNumber} \u7AE0\u5DF2\u8FBE\u5230\u81EA\u52A8\u6062\u590D\u4E0A\u9650\uFF0C\u9700\u8981\u4EBA\u5DE5\u5BA1\u9605\u540E\u518D\u7EE7\u7EED\u3002` : `\u7B2C ${chapterNumber} \u7AE0\u5DF2\u8FDB\u5165\u8D28\u91CF\u8FD4\u5DE5\u95ED\u73AF\uFF0C\u7CFB\u7EDF\u4F1A\u6309 DB \u72B6\u6001\u7EE7\u7EED\u63A8\u8FDB\u3002`,
        metadata: {
          source: "api_chapter_retry",
          chapterNumber,
          recoveryLimited
        }
      });
      await recordToolMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: "workflow-control",
        toolName: "chapter-retry",
        status: recoveryLimited ? "failed" : "completed",
        input: {
          chapterNumber,
          runNow: body.runNow !== false
        },
        output: {
          recoveryLimited,
          chapterStatus: state.plan.chapterTasks[chapterNumber - 1]?.status || null,
          stage: state.runtime.stage
        },
        content: recoveryLimited ? `\u7B2C ${chapterNumber} \u7AE0\u91CD\u8BD5\u5DF2\u89E6\u8FBE\u6062\u590D\u4E0A\u9650\u3002` : `\u7B2C ${chapterNumber} \u7AE0\u91CD\u8BD5\u547D\u4EE4\u5DF2\u6267\u884C\u5E76\u5199\u56DE\u6570\u636E\u5E93\u72B6\u6001\u3002`,
        metadata: {
          source: "api_chapter_retry",
          chapterNumber,
          recoveryLimited
        }
      });
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          recoveryLimited,
          ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("chapter_not_found:")) {
        return { status: 404, payload: { error: "chapter_not_found", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
      }
      throw error;
    }
  }
  if (method === "POST" && requestPathname === "/api/knowledge/reindex") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const requestedScope = String(body.scope || "all");
    const scope = requestedScope === "global" || requestedScope === "project" || requestedScope === "all" ? requestedScope : "all";
    const limit = Number(body.limit);
    const queuedKnowledgeJobs = await enqueueKnowledgeReindexJobs(rootDir, context.projectId, scope, {
      limit: Number.isFinite(limit) && limit > 0 ? limit : void 0,
      reason: "api_reindex"
    });
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "knowledge-control",
      runId: null,
      toolName: "knowledge-reindex",
      status: "completed",
      input: { scope, limit: Number.isFinite(limit) && limit > 0 ? limit : null },
      output: { queuedJobs: queuedKnowledgeJobs },
      content: `\u77E5\u8BC6\u5E93\u91CD\u5EFA\u4EFB\u52A1\u5DF2\u5199\u5165\u6570\u636E\u5E93\uFF1A${queuedKnowledgeJobs.length} \u4E2A\u540E\u53F0\u4EFB\u52A1\u3002`,
      metadata: { source: "api_knowledge_reindex", scope }
    });
    const state = await tryLoadState(context.projectRoot);
    return {
      status: 202,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        queuedKnowledgeJobs,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/knowledge/search") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const query = String(body.query || "").trim();
    if (!query) {
      return {
        status: 400,
        payload: {
          error: "query_required",
          message: "\u8BF7\u8F93\u5165\u8981\u68C0\u7D22\u7684\u6210\u8BED\u3001\u573A\u666F\u3001\u8BBE\u5B9A\u6216\u7AE0\u8282\u7EA6\u675F\u3002",
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const requestedLimit = Number(body.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(20, Math.floor(requestedLimit)) : 8;
    const scopes = readKnowledgeScopes(body.scopes);
    const sourceTypes = readStringArray(body.sourceTypes);
    const chunkTypes = readStringArray(body.chunkTypes);
    const rows = await retrieveKnowledge({
      rootDir,
      projectId: context.projectId,
      query,
      scopes,
      sourceTypes: sourceTypes.length ? sourceTypes : void 0,
      chunkTypes: chunkTypes.length ? chunkTypes : void 0,
      limit,
      recordCitation: true
    });
    const knowledgeSearch = {
      query,
      filters: {
        scopes: scopes || ["global", "project"],
        sourceTypes,
        chunkTypes,
        limit
      },
      total: rows.length,
      rows: rows.map(normalizeKnowledgeSearchRow),
      searchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "knowledge-control",
      runId: null,
      toolName: "knowledge-search",
      status: "completed",
      input: knowledgeSearch.filters,
      output: {
        query,
        total: knowledgeSearch.total,
        rows: knowledgeSearch.rows.map((row) => ({
          chunkId: row.chunkId,
          score: row.score,
          chunkType: row.chunkType,
          source: row.source
        }))
      },
      content: `\u77E5\u8BC6\u5E93\u624B\u52A8\u68C0\u7D22\u5B8C\u6210\uFF1A${query}\uFF0C\u547D\u4E2D ${knowledgeSearch.total} \u4E2A\u7247\u6BB5\u3002`,
      metadata: { source: "api_knowledge_search", query }
    });
    const state = await tryLoadState(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        knowledgeSearch,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/knowledge/evaluate") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const requestedK = Number(body.k);
    const k = Number.isFinite(requestedK) && requestedK > 0 ? Math.floor(requestedK) : 8;
    const explicitCases = Array.isArray(body.cases) ? body.cases : [];
    const cases = explicitCases.length > 0 ? explicitCases.map((item, index) => {
      const record = item && typeof item === "object" ? item : {};
      const expectedChunkIds = Array.isArray(record.expectedChunkIds) ? record.expectedChunkIds.map((id) => String(id)).filter(Boolean) : [];
      return {
        name: String(record.name || `manual-${index + 1}`),
        query: String(record.query || ""),
        expectedChunkIds,
        projectId: context.projectId,
        scopes: Array.isArray(record.scopes) ? record.scopes.filter((scope) => scope === "global" || scope === "project") : ["global", "project"],
        sourceTypes: Array.isArray(record.sourceTypes) ? record.sourceTypes.map((value) => String(value)).filter(Boolean) : void 0,
        chunkTypes: Array.isArray(record.chunkTypes) ? record.chunkTypes.map((value) => String(value)).filter(Boolean) : void 0,
        k: Number.isFinite(Number(record.k)) && Number(record.k) > 0 ? Math.floor(Number(record.k)) : k
      };
    }).filter((item) => item.query && item.expectedChunkIds.length > 0) : await withFactoryDb(rootDir, async (db) => {
      const snapshot = db.getSnapshot(context.projectId);
      return (Array.isArray(snapshot.knowledge?.citations) ? snapshot.knowledge.citations : []).map((citation, index) => {
        const expectedChunkIds = readJsonArray(citation.used_chunk_ids_json).map((id) => String(id)).filter(Boolean);
        return {
          name: `recent-citation-${index + 1}`,
          query: String(citation.query || ""),
          expectedChunkIds,
          projectId: context.projectId,
          scopes: ["global", "project"],
          k
        };
      }).filter((item) => item.query && item.expectedChunkIds.length > 0).slice(0, 6);
    }).catch(() => []);
    if (!cases.length) {
      return {
        status: 422,
        payload: {
          error: "knowledge_benchmark_cases_required",
          message: "\u9700\u8981\u63D0\u4F9B\u5305\u542B query \u548C expectedChunkIds \u7684 cases\uFF0C\u6216\u5148\u4EA7\u751F\u5E26 used chunk \u7684\u77E5\u8BC6\u5E93\u5F15\u7528\u8BB0\u5F55\u3002",
          activeProjectId: context.projectId,
          projects: context.projects,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const evaluation = await evaluateKnowledgeBenchmark(rootDir, cases);
    const evaluationArtifactPath = await writeKnowledgeEvaluationArtifact(rootDir, context.projectRoot, context.projectId, evaluation);
    await withFactoryDb(rootDir, async (db) => {
      db.recordEvent(context.projectId, null, "KNOWLEDGE_EVALUATION_COMPLETED", {
        artifactPath: evaluationArtifactPath,
        summary: evaluation.summary,
        cases: evaluation.cases.map((item) => ({
          name: item.name,
          query: item.query,
          k: item.k,
          hitAtK: item.hitAtK,
          recallAtK: item.recallAtK,
          precisionAtK: item.precisionAtK,
          matchedChunkIds: item.matchedChunkIds,
          missedChunkIds: item.missedChunkIds
        }))
      });
    }).catch(() => void 0);
    await recordToolMessage(rootDir, {
      projectId: context.projectId,
      conversationId: "knowledge-control",
      runId: null,
      toolName: "knowledge-evaluate",
      status: "completed",
      input: { caseCount: cases.length, k, explicit: explicitCases.length > 0 },
      output: { ...evaluation, artifactPath: evaluationArtifactPath },
      content: `\u77E5\u8BC6\u5E93\u53EC\u56DE\u8BC4\u4F30\u5B8C\u6210\uFF1A${evaluation.summary.totalCases} \u4E2A\u6837\u672C\uFF0CHit@K ${(evaluation.summary.hitRateAtK * 100).toFixed(0)}%\uFF0C\u5E73\u5747 Recall@K ${(evaluation.summary.meanRecallAtK * 100).toFixed(0)}%\u3002`,
      metadata: { source: "api_knowledge_evaluate", artifactPath: evaluationArtifactPath }
    });
    const state = await tryLoadState(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        knowledgeEvaluation: evaluation,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/cover") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const state = await loadAutonomousState(context.projectRoot);
    state.assets = state.assets || {};
    state.assets.cover = state.assets.cover || {};
    state.assets.cover.status = "in_progress";
    delete state.assets.cover.error;
    await saveAutonomousState(context.projectRoot, state);
    void (async () => {
      try {
        await prepareCoverGeneration(context.projectRoot, {
          factoryRootDir: rootDir,
          projectId: context.projectId,
          reason: "api:/api/cover"
        });
      } catch (err) {
        console.error("Async cover generation failed in background:", err);
      }
    })();
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/provider-test") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    const reqBaseUrl = typeof body.LLM_BASE_URL === "string" ? body.LLM_BASE_URL : typeof body.baseUrl === "string" ? body.baseUrl : void 0;
    let reqApiKey = typeof body.LLM_API_KEY === "string" ? body.LLM_API_KEY : typeof body.apiKey === "string" ? body.apiKey : void 0;
    const reqModelName = typeof body.LLM_MODEL_ID === "string" ? body.LLM_MODEL_ID : typeof body.modelName === "string" ? body.modelName : void 0;
    let reqApiMode = typeof body.LLM_API_MODE === "string" ? body.LLM_API_MODE : typeof body.apiMode === "string" ? body.apiMode : void 0;
    const configId = typeof body.id === "string" ? body.id.trim() : null;
    if (configId) {
      await withFactoryDb(rootDir, async (db) => {
        const currentConfig = db.listLlmConfigs().find((config) => config.id === configId);
        if (reqApiKey === "[configured]" && currentConfig && typeof currentConfig.api_key === "string") {
          reqApiKey = currentConfig.api_key;
        }
        if (!reqApiMode && currentConfig && typeof currentConfig.api_mode === "string") {
          reqApiMode = currentConfig.api_mode;
        }
      });
    }
    const result = await testProviderConnectivity(
      {
        baseUrl: reqBaseUrl,
        apiKey: reqApiKey,
        modelName: reqModelName,
        apiMode: reqApiMode ? normalizeLlmApiMode(reqApiMode) : void 0
      },
      rootDir
    );
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: result.ok ? "\u6A21\u578B\u8FDE\u901A\u6027\u6D4B\u8BD5\u901A\u8FC7" : "\u6A21\u578B\u8FDE\u901A\u6027\u6D4B\u8BD5\u5931\u8D25",
      content: result.message || (result.ok ? "Provider reachable." : "Provider unavailable."),
      metadata: {
        source: "api_provider_test",
        ok: result.ok,
        baseUrl: result.baseUrl,
        modelName: result.modelName
      }
    });
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "provider-test",
      status: result.ok ? "completed" : "failed",
      input: {
        baseUrl: result.baseUrl,
        modelName: result.modelName,
        hasApiKey: Boolean(typeof body.LLM_API_KEY === "string" ? body.LLM_API_KEY : void 0)
      },
      output: {
        ok: result.ok,
        message: result.message
      },
      content: result.message || (result.ok ? "Provider reachable." : "Provider unavailable."),
      metadata: {
        source: "api_provider_test",
        ok: result.ok,
        baseUrl: result.baseUrl,
        modelName: result.modelName
      }
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.mode === "managed" ? context.projectId : null,
        projects: context.projects,
        result,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/interrupt") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const message = String(body.message || "").trim();
    if (!message) {
      return { status: 400, payload: { error: "message_required" } };
    }
    const { state } = await executeManualInterruptCommand(context.projectRoot, message, {
      factoryRootDir: rootDir,
      projectId: context.projectId,
      source: "api",
      requestedBy: "api:/api/interrupt"
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/chat") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const message = String(body.message || "").trim();
    if (!message) {
      return { status: 400, payload: { error: "message_required" } };
    }
    const runId = makeRunId("discussion");
    await recordUserMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: runId,
      runId,
      content: message,
      metadata: { source: "api_chat" }
    });
    const discussion = await runMultiAgentDiscussion(context.projectRoot, message, {
      runId,
      envRootDir: rootDir,
      factoryRootDir: context.mode === "managed" ? rootDir : void 0,
      projectId: context.mode === "managed" ? context.projectId ?? void 0 : void 0
    });
    const state = await loadAutonomousState(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        discussion,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/chat-stream") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const message = String(body.message || "").trim();
    if (!message) {
      return { status: 400, payload: { error: "message_required" } };
    }
    const state = await loadAutonomousState(context.projectRoot);
    const route = routeUserMessage(message, state);
    const runId = makeRunId("discussion");
    await recordUserMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: runId,
      runId,
      content: message,
      metadata: { source: "api_chat_stream", route: route.type, reason: route.reason }
    });
    if (route.type === "status_query") {
      const statusText = formatStatus(state);
      await recordStatusMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: runId,
        runId,
        title: "\u5F53\u524D\u9879\u76EE\u72B6\u6001",
        content: statusText,
        metadata: { source: "api_chat_stream_status_query" }
      });
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          events: [],
          discussion: {
            summary: `\u5DF2\u62A5\u544A\u5F53\u524D\u9879\u76EE\u72B6\u6001\uFF1A${state.runtime.statusMessage}`,
            target: "status",
            writebackSkipped: true,
            replies: []
          },
          ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    if (route.type === "workflow_control") {
      const autopilotMessage = createAutopilotKickoffMessage(state);
      const jobId = context.projectId ? await ensureDurableAutopilotJob(rootDir, context.projectId, autopilotMessage, { source: "chat_stream_workflow_control" }) : null;
      const updatedState2 = await markAutopilot(context.projectRoot, {
        running: true,
        stopRequested: false,
        mode: "background",
        target: autopilotMessage,
        statusMessage: "\u5DF2\u6536\u5230\u7EE7\u7EED\u63A8\u8FDB\u6307\u4EE4\uFF0C\u5DF2\u5199\u5165\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u961F\u5217\u3002"
      }, { factoryRootDir: rootDir, projectId: context.projectId });
      await recordStatusMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: runId,
        runId,
        title: "\u7EE7\u7EED\u63A8\u8FDB\u5DF2\u63A5\u6536",
        content: jobId ? `\u5DF2\u5C06\u7EE7\u7EED\u63A8\u8FDB\u6307\u4EE4\u5199\u5165\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u961F\u5217\uFF1A${jobId}\u3002` : "\u5DF2\u6536\u5230\u7EE7\u7EED\u63A8\u8FDB\u6307\u4EE4\u3002",
        metadata: { source: "api_chat_stream_workflow_control", jobId, route: route.type, reason: route.reason }
      });
      await recordToolMessage(rootDir, {
        projectId: context.mode === "managed" ? context.projectId : null,
        conversationId: runId,
        runId,
        toolName: "autopilot-start",
        status: jobId ? "completed" : "failed",
        input: { message, routedMessage: autopilotMessage },
        output: { jobId, queued: Boolean(jobId) },
        content: jobId ? `\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1 ${jobId} \u5DF2\u5199\u5165\u6570\u636E\u5E93\uFF0C\u7B49\u5F85 worker \u9886\u53D6\u6216\u7EED\u8DD1\u3002` : "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5199\u5165\u6570\u636E\u5E93\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u9879\u76EE\u72B6\u6001\u3002",
        metadata: { source: "api_chat_stream_workflow_control", jobId }
      });
      return {
        status: 200,
        payload: {
          activeProjectId: context.projectId,
          projects: context.projects,
          events: [],
          discussion: {
            summary: "\u5DF2\u8F6C\u5165\u65E0\u4EBA\u503C\u5B88\u63A8\u8FDB\uFF0C\u4E0D\u542F\u52A8\u591A Agent \u8BA8\u8BBA\u3002",
            target: "workflow_control",
            writebackSkipped: true,
            replies: []
          },
          ...await createWorkspacePayload(context.projectRoot, updatedState2, { rootDir, projectId: context.projectId, syncState: true }),
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const streamed = [];
    const discussion = await runMultiAgentDiscussion(context.projectRoot, message, {
      runId,
      envRootDir: rootDir,
      factoryRootDir: context.mode === "managed" ? rootDir : void 0,
      projectId: context.mode === "managed" ? context.projectId ?? void 0 : void 0,
      onStreamEvent: async (event) => {
        await options.onAgentStreamEvent?.(event);
      },
      onEvent: async (event) => {
        streamed.push(event);
        await options.onStreamEvent?.(event);
      }
    });
    const updatedState = await loadAutonomousState(context.projectRoot);
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        events: streamed,
        discussion,
        ...await createWorkspacePayload(context.projectRoot, updatedState, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && (requestPathname === "/api/mode" || requestPathname === "/api/autopilot/mode")) {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const autoMode = typeof body.autoMode === "string" ? body.autoMode : "full";
    if (autoMode !== "full" && autoMode !== "semi") {
      return { status: 400, payload: { error: "invalid_auto_mode" } };
    }
    const state = await loadAutonomousState(context.projectRoot);
    state.project.autoMode = autoMode;
    await saveAutonomousState(context.projectRoot, state);
    if (context.projectId) {
      await withFactoryDb(rootDir, async (db) => {
        db.updateProjectState(context.projectId, state);
      }).catch(() => void 0);
    }
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "\u65E0\u4EBA\u503C\u5B88\u521B\u4F5C\u6A21\u5F0F\u5DF2\u5207\u6362",
      content: `\u7CFB\u7EDF\u521B\u4F5C\u6A21\u5F0F\u5DF2\u6210\u529F\u5207\u6362\u4E3A\uFF1A${autoMode === "semi" ? "\u{1F91D} \u534A\u81EA\u52A8\u5171\u521B\u6A21\u5F0F" : "\u{1F916} \u5168\u81EA\u52A8\u6258\u7BA1\u6A21\u5F0F"}\u3002`,
      metadata: {
        source: "api_autopilot_mode",
        autoMode
      }
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && (requestPathname === "/api/stop" || requestPathname === "/api/autopilot/stop")) {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    const stoppedInProcess = stopAutopilotJob(context.projectRoot);
    const stopStatusMessage = stoppedInProcess ? "\u5DF2\u6536\u5230\u6682\u505C\u8BF7\u6C42\uFF0C\u6B63\u5728\u4E2D\u65AD\u5F53\u524D\u6A21\u578B\u8BF7\u6C42\u5E76\u4FDD\u5B58\u8FDB\u5EA6\u3002" : "\u5DF2\u6536\u5230\u6682\u505C\u8BF7\u6C42\uFF0C\u5DF2\u6682\u505C\u6570\u636E\u5E93\u4E2D\u7684\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\uFF0C\u540E\u7EED\u53EF\u7EE7\u7EED\u6062\u590D\u3002";
    const state = await markAutopilot(context.projectRoot, {
      running: isAutopilotRunning(context.projectRoot) && !stoppedInProcess,
      stopRequested: true,
      lastStep: "stop_requested",
      statusMessage: stopStatusMessage
    }, { factoryRootDir: rootDir, projectId: context.projectId });
    if (context.projectId) {
      await withFactoryDb(rootDir, async (db) => {
        const jobs = db.listProjectJobs(context.projectId, "autopilot").filter((job) => job.status === "running" || job.status === "paused");
        for (const job of jobs) {
          db.pauseJob(String(job.id));
        }
        return jobs.length;
      }).catch(() => void 0);
    }
    await recordStatusMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      title: "\u65E0\u4EBA\u503C\u5B88\u6682\u505C\u8BF7\u6C42\u5DF2\u63A5\u6536",
      content: stopStatusMessage,
      metadata: {
        source: "api_autopilot_stop",
        stoppedInProcess
      }
    });
    await recordToolMessage(rootDir, {
      projectId: context.mode === "managed" ? context.projectId : null,
      conversationId: "workflow-control",
      toolName: "autopilot-stop",
      status: "completed",
      input: {
        projectId: context.projectId
      },
      output: {
        stoppedInProcess,
        pausedDurableJobs: Boolean(context.projectId)
      },
      content: stopStatusMessage,
      metadata: {
        source: "api_autopilot_stop",
        stoppedInProcess
      }
    });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "GET" && requestPathname === "/api/settings/writing") {
    const settings = await withFactoryDb(rootDir, async (db) => {
      const bypassVal = db.getSystemSetting("bypassAigcGate");
      const autoVal = db.getSystemSetting("autoAigcRefinement");
      const draftSubcallRolesVal = db.getSystemSetting("draftSubcallRoles");
      return {
        bypassAigcGate: bypassVal === "1",
        autoAigcRefinement: autoVal === "1",
        draftSubcallRoles: parseDraftSubcallRolesSetting(draftSubcallRolesVal),
        aigcDetector: readAigcDetectorSettingsFromDb(db)
      };
    }).catch(() => ({
      bypassAigcGate: false,
      autoAigcRefinement: false,
      draftSubcallRoles: [],
      aigcDetector: {
        provider: "local-heuristic",
        url: "",
        tokenConfigured: false,
        timeoutMs: 3e4,
        threshold: 0.8,
        requestTextField: "",
        headersJson: "",
        segmentMaxChars: 900,
        segmentMinChars: 180,
        gradioFnIndex: "",
        gradioSessionHashConfigured: false,
        gradioJoinUrl: "",
        gradioDataUrl: "",
        gradioSkipJoin: false,
        gradioInputsJson: ""
      }
    }));
    return {
      status: 200,
      payload: {
        settings
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/settings/writing") {
    const settings = body.settings;
    if (settings) {
      await withFactoryDb(rootDir, async (db) => {
        if (typeof settings.bypassAigcGate === "boolean") {
          db.setSystemSetting("bypassAigcGate", settings.bypassAigcGate ? "1" : "0");
        }
        if (typeof settings.autoAigcRefinement === "boolean") {
          db.setSystemSetting("autoAigcRefinement", settings.autoAigcRefinement ? "1" : "0");
        }
        if (Array.isArray(settings.draftSubcallRoles)) {
          db.setSystemSetting("draftSubcallRoles", normalizeDraftSubcallRoles(settings.draftSubcallRoles).join(","));
        }
        writeAigcDetectorSettingsToDb(db, settings);
      }).catch(() => void 0);
    }
    return {
      status: 200,
      payload: {
        success: true
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/aigc/batch-scan") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required" } };
    }
    const state = await loadAutonomousState(context.projectRoot);
    const totalChapters = state.plan?.totalChapters || state.plan?.chapterTasks?.length || 0;
    const results = {};
    const detectorConfig = getAigcDetectorConfig(context.projectRoot);
    const approvedStyleContext = await loadApprovedWritingStyleContext(context.projectRoot);
    for (let i = 1; i <= totalChapters; i++) {
      const chapterId = `chapter-${String(i).padStart(3, "0")}`;
      const finalDraft = await readWorkspaceText(context.projectRoot, "chapters", `${chapterId}.final.md`);
      if (finalDraft.trim()) {
        try {
          const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
          const result = await detectAigcSegments(bodyOnly || finalDraft, detectorConfig);
          const report = normalizeAigcWritingDetectionReport(result);
          const styleConformanceDrift = evaluateChapterStyleConformanceDrift({
            approvedStyleContext,
            chapterText: finalDraft
          });
          const blockedReason = report.status === "passed" && styleConformanceDrift.status === "conformant" ? "" : report.status !== "passed" ? `AIGC \u68C0\u6D4B\u672A\u901A\u8FC7\uFF1A${report.reason || report.status}` : `\u98CE\u683C\u7EE7\u627F\u6F02\u79FB\u672A\u901A\u8FC7\uFF1A${styleConformanceDrift.reason}`;
          const manifestUpdate = await persistBatchRefineManifestUpdate({
            rootDir,
            projectRoot: context.projectRoot,
            projectId: context.projectId,
            chapterNumber: i,
            finalDraft,
            finalAigcReport: report,
            styleConformanceDrift,
            refined: false,
            blockedReason
          });
          results[i] = {
            report,
            styleConformanceDrift,
            publishReadiness: manifestUpdate.publishReadiness || null,
            refined: false,
            blockedReason
          };
          await withFactoryDb(rootDir, async (db) => {
            db.recordEvent(context.projectId, `aigc_batch_scan_ch_${i}`, "AIGC_DETECTION_COMPLETED", {
              chapterNumber: i,
              aigcReport: report,
              publishReadiness: manifestUpdate.publishReadiness || null
            });
          }).catch(() => void 0);
        } catch (e) {
          results[i] = { status: "unavailable", reason: String(e) };
        }
      }
    }
    const styleWorkspace = await buildStyleEvolutionWorkspacePayloadSafe(rootDir, {
      projectRoot: context.projectRoot,
      projectId: context.projectId
    }, await loadAutonomousState(context.projectRoot).catch(() => state));
    return {
      status: 200,
      payload: {
        success: true,
        activeProjectId: context.projectId,
        projects: context.projects,
        results,
        ...styleWorkspace,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/aigc/batch-refine") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required" } };
    }
    const state = await loadAutonomousState(context.projectRoot);
    const approvedStyleContext = await loadApprovedWritingStyleContext(context.projectRoot);
    if (approvedStyleContext.status !== "ready") {
      const styleWorkspace2 = await buildStyleEvolutionWorkspacePayloadSafe(rootDir, {
        projectRoot: context.projectRoot,
        projectId: context.projectId
      }, state);
      return {
        status: 409,
        payload: {
          success: false,
          activeProjectId: context.projectId,
          projects: context.projects,
          error: "style_contract_not_ready",
          reason: "AIGC \u6279\u91CF\u4FEE\u6B63\u6587\u7A3F\u524D\u5FC5\u987B\u5148\u51BB\u7ED3\u5E76\u901A\u8FC7 Generation Verification Gate \u7684\u5199\u6CD5\u5408\u540C\u3002",
          ...styleWorkspace2,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    const targetChapter = typeof body.chapterNumber === "number" ? body.chapterNumber : null;
    const chapterTasks = state.plan?.chapterTasks || [];
    const results = {};
    const detectorConfig = getAigcDetectorConfig(context.projectRoot);
    const resources = await loadProductionWritingResources(context.projectRoot);
    const chaptersToRefine = targetChapter !== null ? chapterTasks.filter((t) => t.chapterNumber === targetChapter) : chapterTasks;
    for (const task of chaptersToRefine) {
      const i = task.chapterNumber;
      const chapterId = `chapter-${String(i).padStart(3, "0")}`;
      let finalDraft = await readWorkspaceText(context.projectRoot, "chapters", `${chapterId}.final.md`);
      if (finalDraft.trim()) {
        try {
          const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
          const result = await detectAigcSegments(bodyOnly || finalDraft, detectorConfig);
          const aigcReport = normalizeAigcWritingDetectionReport(result);
          if (aigcReport.status === "blocked" && aigcReport.highRiskSegments.length > 0) {
            const refinedDraft = await repairAigcHighRiskDraft(
              state,
              task,
              finalDraft,
              aigcReport,
              resources,
              { envRootDir: context.projectRoot },
              createContinuityContract({ state, task }),
              state.memory?.characterDossiers || []
            );
            const finalBodyOnly = refinedDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
            const checkResult = await detectAigcSegments(finalBodyOnly || refinedDraft, detectorConfig);
            const finalAigcReport = normalizeAigcWritingDetectionReport(checkResult);
            const styleConformanceDrift = evaluateChapterStyleConformanceDrift({
              approvedStyleContext,
              chapterText: refinedDraft
            });
            const refinedPassed = finalAigcReport.status === "passed" && styleConformanceDrift.status === "conformant";
            const blockedReason = finalAigcReport.status !== "passed" ? `AIGC \u590D\u68C0\u672A\u901A\u8FC7\uFF1A${finalAigcReport.reason || finalAigcReport.status}` : styleConformanceDrift.status !== "conformant" ? `\u98CE\u683C\u7EE7\u627F\u6F02\u79FB\u672A\u901A\u8FC7\uFF1A${styleConformanceDrift.reason}` : "";
            if (refinedPassed) {
              await writeWorkspaceText(context.projectRoot, refinedDraft, "chapters", `${chapterId}.final.md`);
            }
            let persistedAigcReport = finalAigcReport;
            let persistedStyleConformanceDrift = styleConformanceDrift;
            if (!refinedPassed) {
              const persistedBodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
              const persistedCheckResult = await detectAigcSegments(persistedBodyOnly || finalDraft, detectorConfig);
              persistedAigcReport = normalizeAigcWritingDetectionReport(persistedCheckResult);
              persistedStyleConformanceDrift = evaluateChapterStyleConformanceDrift({
                approvedStyleContext,
                chapterText: finalDraft
              });
            }
            const manifestUpdate = await persistBatchRefineManifestUpdate({
              rootDir,
              projectRoot: context.projectRoot,
              projectId: context.projectId,
              chapterNumber: i,
              finalDraft: refinedPassed ? refinedDraft : finalDraft,
              finalAigcReport: persistedAigcReport,
              styleConformanceDrift: persistedStyleConformanceDrift,
              refined: refinedPassed,
              blockedReason
            });
            results[i] = {
              originalReport: aigcReport,
              finalReport: finalAigcReport,
              persistedReport: persistedAigcReport,
              styleConformanceDrift,
              persistedStyleConformanceDrift,
              publishReadiness: manifestUpdate.publishReadiness || null,
              refined: refinedPassed,
              blockedReason
            };
            await withFactoryDb(rootDir, async (db) => {
              db.recordEvent(context.projectId, `aigc_batch_refine_ch_${i}`, "AIGC_DETECTION_COMPLETED", {
                chapterNumber: i,
                aigcReport: finalAigcReport
              });
            }).catch(() => void 0);
          } else {
            const styleConformanceDrift = evaluateChapterStyleConformanceDrift({
              approvedStyleContext,
              chapterText: finalDraft
            });
            const manifestUpdate = await persistBatchRefineManifestUpdate({
              rootDir,
              projectRoot: context.projectRoot,
              projectId: context.projectId,
              chapterNumber: i,
              finalDraft,
              finalAigcReport: aigcReport,
              styleConformanceDrift,
              refined: false,
              blockedReason: aigcReport.status === "passed" && styleConformanceDrift.status === "conformant" ? "" : "No high risk segments found or detection not blocked, but publish readiness was refreshed."
            });
            results[i] = {
              report: aigcReport,
              styleConformanceDrift,
              publishReadiness: manifestUpdate.publishReadiness || null,
              refined: false,
              reason: "No high risk segments found or detection not blocked."
            };
          }
        } catch (e) {
          results[i] = { error: String(e) };
        }
      }
    }
    const styleWorkspace = await buildStyleEvolutionWorkspacePayloadSafe(rootDir, {
      projectRoot: context.projectRoot,
      projectId: context.projectId
    }, await loadAutonomousState(context.projectRoot).catch(() => state));
    return {
      status: 200,
      payload: {
        success: true,
        activeProjectId: context.projectId,
        projects: context.projects,
        results,
        ...styleWorkspace,
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/aigc/mark-workflow-complete") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot || !context.projectId) {
      return { status: 404, payload: { error: "project_required" } };
    }
    const state = await loadAutonomousState(context.projectRoot);
    const completionReadiness = await validateWorkflowCompletionReadiness(
      rootDir,
      context.projectRoot,
      context.projectId,
      state
    );
    if (!completionReadiness.ok) {
      return {
        status: 409,
        payload: {
          success: false,
          activeProjectId: context.projectId,
          projects: context.projects,
          error: completionReadiness.error,
          reason: completionReadiness.reason,
          productionReadiness: completionReadiness.productionReadiness,
          readerStats: completionReadiness.readerStats,
          blockedChapters: completionReadiness.blockedChapters,
          envStatus: getPublicProjectEnvStatus2(rootDir)
        }
      };
    }
    state.runtime.stage = "complete";
    state.runtime.statusMessage = "All chapter drafts generated and AIGC batch refinement finalized.";
    state.runtime.lastRoute = "workflow";
    state.runtime.lastAction = "workflow_complete";
    await saveAutonomousState(context.projectRoot, state);
    if (context.projectId) {
      await syncManagedProjectState(rootDir, context.projectId, state).catch(() => void 0);
    }
    return {
      status: 200,
      payload: {
        success: true,
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId, syncState: true }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  if (method === "POST" && requestPathname === "/api/autopilot/start") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null));
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) } };
    }
    let message = typeof body.message === "string" ? body.message.trim() : "";
    const latestState = await tryLoadState(context.projectRoot);
    if (!message && latestState) {
      message = createAutopilotKickoffMessage(latestState);
    }
    let jobId = null;
    if (context.projectId) {
      jobId = await ensureDurableAutopilotJob(rootDir, context.projectId, message, { source: "autopilot_start" });
    }
    const submittedAt = await appendAutopilotSubmissionTranscript(context.projectRoot, {
      message,
      jobId,
      stage: latestState?.runtime?.stage
    });
    if (context.projectId && message.trim()) {
      await recordUserMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        content: message,
        time: submittedAt || void 0,
        metadata: { source: "autopilot_start", jobId }
      });
      await recordStatusMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        title: "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5DF2\u63A5\u6536",
        content: `\u5DF2\u63A5\u6536\u65E0\u4EBA\u503C\u5B88\u521B\u4F5C\u6307\u4EE4\uFF0C\u5E76\u5199\u5165\u540E\u53F0\u4EFB\u52A1\u961F\u5217\u3002${jobId ? ` Job: ${jobId}.` : ""}`,
        time: submittedAt || void 0,
        metadata: { source: "autopilot_start", jobId }
      });
      await recordToolMessage(rootDir, {
        projectId: context.projectId,
        conversationId: jobId ? `autopilot:${jobId}` : `autopilot:${context.projectId}`,
        runId: null,
        toolName: "autopilot-start",
        status: jobId ? "completed" : "failed",
        input: {
          message,
          mode: "background"
        },
        output: {
          jobId,
          queued: Boolean(jobId)
        },
        content: jobId ? `\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1 ${jobId} \u5DF2\u5199\u5165\u6570\u636E\u5E93\uFF0C\u7B49\u5F85 worker \u9886\u53D6\u6216\u7EED\u8DD1\u3002` : "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5199\u5165\u6570\u636E\u5E93\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u9879\u76EE\u72B6\u6001\u3002",
        time: submittedAt || void 0,
        metadata: { source: "autopilot_start", jobId }
      });
      await withFactoryDb(rootDir, async (db) => {
        db.recordArtifact({
          projectId: context.projectId,
          kind: "transcript",
          path: ".ai-novel/chat/discussion-log.md",
          status: "completed",
          metadata: { jobId, source: "autopilot_submission", submittedAt }
        });
        db.recordEvent(context.projectId, null, "AUTOPILOT_MESSAGE_SUBMITTED", {
          message,
          jobId,
          submittedAt
        });
      }).catch(() => void 0);
    }
    if (shouldUseEmbeddedWorker(options.embeddedWorker) && process.env.AI_NOVEL_TEST_MODE !== "1") {
      if (jobId && !isAutopilotRunning(context.projectRoot)) {
        await withFactoryDb(rootDir, async (db) => {
          db.releaseJobLease(jobId, "embedded_worker_start_takeover");
        }).catch(() => void 0);
      }
      ensureAutopilotJob({
        rootDir,
        projectRoot: context.projectRoot,
        projectId: context.projectId,
        projects: context.projects,
        initialMessage: message,
        mode: "background",
        jobId,
        createSnapshot: createWorkspacePayload
      });
    }
    const state = await markAutopilot(context.projectRoot, {
      running: true,
      stopRequested: false,
      mode: "background",
      target: message.trim() || null,
      statusMessage: shouldUseEmbeddedWorker(options.embeddedWorker) ? "\u65E0\u4EBA\u503C\u5B88\u81EA\u52A8\u521B\u4F5C\u5DF2\u5728\u540E\u53F0\u542F\u52A8\u3002\u5173\u95ED\u9875\u9762\u540E\uFF0C\u672C\u5730\u670D\u52A1\u4ECD\u4F1A\u7EE7\u7EED\u8FD0\u884C\u3002" : "\u65E0\u4EBA\u503C\u5B88\u81EA\u52A8\u521B\u4F5C\u4EFB\u52A1\u5DF2\u5199\u5165\u6570\u636E\u5E93\uFF0C\u72EC\u7ACB worker \u4F1A\u9886\u53D6\u5E76\u6301\u7EED\u6267\u884C\u3002"
    }, { factoryRootDir: rootDir, projectId: context.projectId });
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId }),
        envStatus: getPublicProjectEnvStatus2(rootDir)
      }
    };
  }
  return { status: 404, payload: { error: "not_found" } };
}
function resolveStaticFile(staticDir, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  return path.join(staticDir, relative);
}
async function serveStatic(staticDir, pathname, response) {
  const filePath = resolveStaticFile(staticDir, pathname);
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === ".html" ? "text/html; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : ext === ".js" || ext === ".mjs" ? "application/javascript; charset=utf-8" : ext === ".json" ? "application/json; charset=utf-8" : "application/octet-stream";
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "pragma": "no-cache",
      "expires": "0"
    });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}
async function startNovelStudioServer(options = {}) {
  const rootDir = options.rootDir ?? process.cwd();
  await loadActiveLlmConfig(rootDir);
  const staticDir = options.staticDir;
  const embeddedWorker = shouldUseEmbeddedWorker(options.embeddedWorker);
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = url.pathname;
      const queryProjectId = url.searchParams.get("projectId");
      if (request.method === "POST" && pathname === "/api/chat-stream") {
        const body = await readJsonBody(request);
        eventStreamHeaders(response);
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/chat-stream", body, {
          projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId,
          onAgentStreamEvent: async (event) => {
            response.write(`event: ${event.type}
`);
            response.write(`data: ${JSON.stringify(event)}

`);
          }
        });
        response.write(`event: complete
`);
        response.write(`data: ${JSON.stringify(result.payload)}

`);
        response.end();
        return;
      }
      if (request.method === "POST" && pathname === "/api/autopilot-stream") {
        const body = await readJsonBody(request);
        const context = await resolveProjectContext(rootDir, typeof body.projectId === "string" ? body.projectId : queryProjectId);
        eventStreamHeaders(response);
        if (!context.projectRoot) {
          writeSse(response, "error", { error: "project_required", projects: context.projects, envStatus: getPublicProjectEnvStatus2(rootDir) });
          response.end();
          return;
        }
        const job = embeddedWorker ? getAutopilotJob(context.projectRoot) : null;
        const listener = job ? (event) => {
          if (response.writableEnded || response.destroyed || !response.writable) return;
          writeSse(response, event.type, event.payload);
          if (event.type === "complete" || event.type === "error") {
            try {
              response.end();
            } catch {
            }
          }
        } : null;
        if (job && listener) {
          job.listeners.add(listener);
        }
        let lastStreamSnapshotVersion = "";
        const writeSnapshot = async (options2 = {}) => {
          if (response.writableEnded || response.destroyed || !response.writable) return;
          const state = await tryLoadState(context.projectRoot);
          const snapshotPayload = {
            activeProjectId: context.projectId,
            projects: context.projects,
            ...await createWorkspacePayload(context.projectRoot, state, { rootDir, projectId: context.projectId }),
            envStatus: getPublicProjectEnvStatus2(rootDir)
          };
          const snapshotVersion = typeof snapshotPayload.snapshotVersion === "string" ? snapshotPayload.snapshotVersion : "";
          if (!options2.force && snapshotVersion && snapshotVersion === lastStreamSnapshotVersion) {
            if (!response.writableEnded && !response.destroyed && response.writable) {
              try {
                response.write(`: snapshot unchanged ${(/* @__PURE__ */ new Date()).toISOString()}

`);
              } catch {
              }
            }
            return;
          }
          lastStreamSnapshotVersion = snapshotVersion;
          writeSse(response, "snapshot", snapshotPayload);
        };
        const snapshotTimer = setInterval(() => {
          void writeSnapshot().catch((error) => {
            if (!response.writableEnded && !response.destroyed && response.writable) {
              writeSse(response, "error", { error: error instanceof Error ? error.message : String(error) });
            }
          });
        }, 2e3);
        request.on("close", () => {
          clearInterval(snapshotTimer);
          if (job && listener) {
            job.listeners.delete(listener);
          }
        });
        writeSse(response, "autopilot_status", {
          message: embeddedWorker ? "\u5DF2\u8FDE\u63A5\u672C\u8FDB\u7A0B\u5185\u5D4C\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u76D1\u542C\u3002" : "\u5DF2\u8FDE\u63A5\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u72B6\u6001\u76D1\u542C\uFF1B\u6267\u884C\u7531\u72EC\u7ACB worker \u6309\u6570\u636E\u5E93\u4EFB\u52A1\u6062\u590D\u3002",
          projectId: context.projectId,
          hasEmbeddedJob: Boolean(job)
        });
        await writeSnapshot({ force: true });
        return;
      }
      if (isJsonApiRequest(request.method, pathname)) {
        await forwardJsonApiRequest(rootDir, request, response, url, { embeddedWorker });
        return;
      }
      if (staticDir && request.method === "GET") {
        const served = await serveStatic(staticDir, pathname, response);
        if (served) {
          return;
        }
      }
      json(response, 404, { error: "not_found" });
    } catch (error) {
      writeServerErrorResponse(response, error);
    }
  });
  await new Promise((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => resolve());
  });
  const restoreTimer = embeddedWorker ? scheduleAutopilotRestore(rootDir, createWorkspacePayload) : null;
  if (embeddedWorker) {
    await restoreAutopilotJobs(rootDir, createWorkspacePayload);
  }
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : options.port ?? 0;
  return {
    server,
    port,
    close: () => new Promise((resolve, reject) => {
      if (restoreTimer) {
        clearInterval(restoreTimer);
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    })
  };
}
async function runNovelStudioServerCli(args = process.argv.slice(2)) {
  const flags = /* @__PURE__ */ new Map();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, "true");
      continue;
    }
    flags.set(key, next);
    index += 1;
  }
  const rootDir = flags.get("root-dir") || process.cwd();
  const staticDir = flags.get("static-dir");
  const port = flags.get("port") ? Number.parseInt(flags.get("port") || "4310", 10) : 4310;
  const embeddedWorker = flags.get("embedded-worker") === "true";
  const { port: actualPort } = await startNovelStudioServer({
    rootDir,
    staticDir,
    port,
    embeddedWorker
  });
  console.log(`AI Novel Studio server listening on http://127.0.0.1:${actualPort}`);
}
export {
  handleNovelStudioApi,
  runNovelStudioServerCli,
  startNovelStudioServer,
  writeServerErrorResponse
};
