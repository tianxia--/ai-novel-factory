import {
  ProductionWorkflowSandboxManager
} from "./chunk-YXC4GCLB.js";
import {
  listProductionChapterNodes
} from "./chunk-473UU5WW.js";
import {
  listProductionPlanningNodes
} from "./chunk-5BNDTIGH.js";
import {
  FactoryWorkflowDebugBranchManager
} from "./chunk-ZZ3KQILH.js";
import {
  chapterBlueprintLearningShouldStop,
  compileChapterBlueprintLearningPrompt,
  loadChapterBlueprintLearningContext,
  recordChapterBlueprintLearningAttempt,
  recordChapterBlueprintStateSnapshot
} from "./chunk-5276HDEF.js";
import {
  listProductionWorkflowNodes
} from "./chunk-VOQWLW5S.js";
import "./chunk-EVOZRM5F.js";
import {
  acceptStyleEvolutionCandidate,
  appendStyleEvolutionCandidate,
  approveStyleEvolutionSample,
  buildStyleEvolutionCandidatePrompt,
  buildStyleEvolutionEvaluationPrompt,
  buildStyleEvolutionRefinement,
  buildStyleEvolutionRefinementOnlyPrompt,
  buildStyleGenerationVerification,
  evaluateStyleEvolutionCandidate,
  generateAgentReply,
  initializeStyleEvolution,
  loadLlmConfigForCapability,
  loadStyleEvolution,
  normalizeStyleAigcSignal,
  parseStyleEvolutionEvaluationFromText,
  parseStyleEvolutionRefinementFromText
} from "./chunk-PJFTMRLC.js";
import {
  FactoryWorkflowTraceRecorder,
  WorkflowKernel
} from "./chunk-ZWH2XUVC.js";
import {
  detectAigcSegments,
  getAigcDetectorConfig
} from "./chunk-5Z26A3S7.js";
import "./chunk-DETBSEC6.js";
import "./chunk-YV6Y5W7F.js";
import "./chunk-YFTWM6FA.js";
import {
  withFactoryDb
} from "./chunk-CJRUVXRQ.js";
import "./chunk-GZKJNHMN.js";

// src/world-foundation-debug-server.ts
import fs from "fs/promises";
import http from "http";
import path from "path";
import { randomUUID } from "crypto";

// src/model-json-parser.ts
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function assertJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("model_response_json_must_be_an_object");
  }
  return value;
}
function extractJsonCandidate(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1]?.trim();
  if (fenced) return fenced;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("model_response_did_not_contain_json");
  return trimmed.slice(start, end + 1);
}
function repairMismatchedClosers(candidate) {
  const chars = candidate.split("");
  const expectedClosers = [];
  const repairs = [];
  let inString = false;
  let escaped = false;
  let line = 1;
  let column = 1;
  for (let offset = 0; offset < chars.length; offset += 1) {
    const char = chars[offset];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      expectedClosers.push("}");
    } else if (char === "[") {
      expectedClosers.push("]");
    } else if (char === "}" || char === "]") {
      const expected = expectedClosers.at(-1);
      if (expected) {
        expectedClosers.pop();
        if (char !== expected) {
          repairs.push({
            offset,
            line,
            column,
            found: char,
            expected,
            context: candidate.slice(Math.max(0, offset - 60), Math.min(candidate.length, offset + 61))
          });
          chars[offset] = expected;
        }
      }
    }
    if (char === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { text: chars.join(""), repairs };
}
function parseModelJsonObject(raw) {
  const candidate = extractJsonCandidate(raw);
  try {
    return {
      value: assertJsonObject(JSON.parse(candidate)),
      repairedText: null,
      repairs: [],
      originalError: null
    };
  } catch (error) {
    const originalError = errorMessage(error);
    const repaired = repairMismatchedClosers(candidate);
    if (!repaired.repairs.length) {
      throw new Error(`model_response_invalid_json: ${originalError}`);
    }
    try {
      return {
        value: assertJsonObject(JSON.parse(repaired.text)),
        repairedText: repaired.text,
        repairs: repaired.repairs,
        originalError
      };
    } catch (repairError) {
      throw new Error(`model_response_invalid_json: ${originalError}; structural_repair_failed: ${errorMessage(repairError)}`);
    }
  }
}

// src/placeholder-detector.ts
var exactPlaceholder = /^(待定|暂无|未命名|后续补充|自行补充|TBD|XXX)$/iu;
var trailingPlaceholder = /(?:姓名|名称|身份|地点|时间|内容|设定|关系|结局|原因|目标|代价|规则|势力|角色|人选|章节|范围|窗口|效果|问题|答案|事实|冲突|历史|社会|地理|时代).{0,16}?(待定|暂无|未命名|后续补充|自行补充|TBD|XXX)[。.!！?？]*$/iu;
var negatedPlaceholder = /(?:禁止|不得|不能|避免|无任何|没有|不允许|不应|拒绝).{0,24}(?:待定|暂无|未命名|后续补充|自行补充|TBD|XXX)/iu;
function placeholderToken(value) {
  const normalized = value.trim();
  const exact = normalized.match(exactPlaceholder)?.[1];
  if (exact) return exact;
  if (negatedPlaceholder.test(normalized)) return null;
  return normalized.match(trailingPlaceholder)?.[1] || null;
}
function findPlaceholderValues(value, path2 = "result") {
  const hits = [];
  const visit = (current, currentPath) => {
    if (typeof current === "string") {
      const token = placeholderToken(current);
      if (token) hits.push({ path: currentPath, token, value: current });
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}[${index}]`));
      return;
    }
    if (current && typeof current === "object") {
      for (const [key, item] of Object.entries(current)) visit(item, `${currentPath}.${key}`);
    }
  };
  visit(value, path2);
  return hits;
}

// src/world-foundation-debug-server.ts
async function debugFactoryProjectId(body, upstreamRun, inheritedInput) {
  const inheritedProjectId = String(
    body.factoryProjectId || inheritedInput.factoryProjectId || upstreamRun.workflowTrace?.projectId || ""
  ).trim();
  if (inheritedProjectId) return inheritedProjectId;
  const projects = await withFactoryDb(rootDir, async (db) => db.listProjects());
  return String(projects[0]?.id || "").trim();
}
function compareValidationQuality(candidate, baseline) {
  if (candidate.valid !== baseline.valid) return candidate.valid ? -1 : 1;
  const candidateErrors = new Set(candidate.errors).size;
  const baselineErrors = new Set(baseline.errors).size;
  if (candidateErrors !== baselineErrors) return candidateErrors - baselineErrors;
  return new Set(candidate.warnings).size - new Set(baseline.warnings).size;
}
function debugFailureSignature(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\d+/gu, "#").replace(/\s+/gu, " ").slice(0, 360);
}
var args = process.argv.slice(2);
var valueAfter = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
var rootDir = path.resolve(valueAfter("--root-dir", process.cwd()));
var port = Number(valueAfter("--port", "4314"));
var chapterBlueprintRepairSafetyLimit = Math.max(5, Math.min(100, Number(
  valueAfter("--chapter-blueprint-repair-safety-limit", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_REPAIR_SAFETY_LIMIT || "20")
) || 20));
var chapterBlueprintStableBatchLimit = Math.max(1, Math.min(12, Number(
  valueAfter("--chapter-blueprint-stable-batch-limit", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_STABLE_BATCH_LIMIT || "10")
) || 10));
var chapterBlueprintMinimumCharsPerChapter = Math.max(700, Math.min(3e3, Number(
  valueAfter("--chapter-blueprint-minimum-chars-per-chapter", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_MINIMUM_CHARS_PER_CHAPTER || "1000")
) || 1e3));
var chapterBlueprintRecommendedCharsPerChapter = Math.max(chapterBlueprintMinimumCharsPerChapter, Math.min(6e3, Number(
  valueAfter("--chapter-blueprint-recommended-chars-per-chapter", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_RECOMMENDED_CHARS_PER_CHAPTER || "1400")
) || 1400));
var chapterBlueprintLlmActivityTimeoutMs = Math.max(15e3, Math.min(12e4, Number(
  valueAfter("--chapter-blueprint-llm-activity-timeout-ms", process.env.AI_NOVEL_CHAPTER_BLUEPRINT_LLM_ACTIVITY_TIMEOUT_MS || "75000")
) || 75e3));
var runsRoot = path.join(rootDir, ".ai-novel-factory", "debug-runs");
var committedChaptersRoot = path.join(rootDir, ".ai-novel-factory", "debug-committed-chapters");
var runs = /* @__PURE__ */ new Map();
var runAbortControllers = /* @__PURE__ */ new Map();
var DebugRunPausedError = class extends Error {
  constructor(message = "debug_run_paused_by_user") {
    super(message);
    this.name = "DebugRunPausedError";
  }
};
function ensureRunAbortController(run) {
  let controller = runAbortControllers.get(run.runId);
  if (!controller || controller.signal.aborted) {
    controller = new AbortController();
    runAbortControllers.set(run.runId, controller);
  }
  return controller;
}
function isRunPauseRequested(run) {
  return run.status === "paused" || Boolean(run.pauseRequestedAt);
}
function assertRunNotPaused(run) {
  if (isRunPauseRequested(run)) throw new DebugRunPausedError();
}
function isDebugRunPausedError(error) {
  return error instanceof DebugRunPausedError || error instanceof Error && (error.name === "AbortError" || /aborted|pause|paused|user_paused|debug_run_paused/iu.test(error.message));
}
async function pauseDebugRun(run, reason = "\u7528\u6237\u624B\u52A8\u6682\u505C\u5F53\u524D\u8C03\u8BD5 Run\u3002") {
  run.pauseRequestedAt = run.pauseRequestedAt || nowIso();
  run.pauseReason = reason;
  run.status = "paused";
  run.completedAt = nowIso();
  run.error = "debug_run_paused_by_user";
  const controller = runAbortControllers.get(run.runId);
  if (controller && !controller.signal.aborted) controller.abort();
  addEvent(run, "warning", "pause", "\u5DF2\u6536\u5230\u6682\u505C\u8BF7\u6C42\uFF1A\u5F53\u524D Run \u4F1A\u505C\u6B62\u540E\u7EED\u8F6E\u6B21\uFF0C\u5E76\u5C3D\u91CF\u4E2D\u65AD\u6B63\u5728\u8FDB\u884C\u7684\u6A21\u578B\u6D41\u5F0F\u8BF7\u6C42\u3002", {
    reason,
    runId: run.runId
  });
  await persistRun(run);
}
var productionWorkflowSandboxes = new ProductionWorkflowSandboxManager(rootDir);
function isDebugTextModel(modelName) {
  return !/(?:^|[-_.:])(image|video|audio|embedding)(?:[-_.:]|$)/iu.test(String(modelName || "").trim());
}
async function listDebugTextModels() {
  return withFactoryDb(rootDir, async (db) => {
    const textRoute = db.listLlmConfigRoutes().find((route) => route.capability === "text");
    return db.listLlmConfigs().filter((row) => isDebugTextModel(row.model_name)).map((row) => ({
      id: String(row.id),
      name: String(row.name || row.model_name),
      baseUrl: String(row.base_url),
      modelName: String(row.model_name),
      apiMode: String(row.api_mode || "chat") === "responses" ? "responses" : "chat",
      timeoutMs: Number(row.timeout_ms) || 12e4,
      isGlobalTextRoute: String(textRoute?.config_id || "") === String(row.id)
    }));
  });
}
async function loadDebugLlmConfig(run) {
  const selectedConfigId = String(run.input.modelConfigId || "").trim();
  if (!selectedConfigId) {
    return loadLlmConfigForCapability(rootDir, "text");
  }
  const row = await withFactoryDb(rootDir, async (db) => db.listLlmConfigs().find((candidate) => String(candidate.id) === selectedConfigId) || null);
  if (!row || !isDebugTextModel(row.model_name)) {
    throw new Error("selected_debug_text_model_not_found");
  }
  return {
    provider: {
      baseUrl: String(row.base_url),
      apiKeyEnv: "DB_DEBUG_CONFIG",
      modelName: String(row.model_name),
      apiMode: String(row.api_mode || "chat") === "responses" ? "responses" : "chat",
      timeoutMs: Number(row.timeout_ms) || 12e4,
      temperature: Number(row.temperature) || 0.1,
      reactMaxSteps: 25
    },
    writing: {
      chapterWordTarget: 2500,
      chapterWordMinimum: 2500
    },
    _dbApiKey: String(row.api_key || ""),
    _configId: String(row.id),
    _configName: String(row.name || row.model_name),
    _capability: "text"
  };
}
function debugProviderOverride(config, timeoutMs = config.provider.timeoutMs) {
  return {
    baseUrl: config.provider.baseUrl,
    apiKey: config._dbApiKey,
    modelName: config.provider.modelName,
    apiMode: config.provider.apiMode,
    timeoutMs
  };
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function normalizeInput(value) {
  const input = value && typeof value === "object" ? value : {};
  const text = (key, fallback = "") => String(input[key] ?? fallback).trim();
  const number = (key, fallback, min, max) => {
    const parsed = Number(input[key]);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  };
  return {
    modelConfigId: text("modelConfigId"),
    factoryProjectId: text("factoryProjectId"),
    title: text("title"),
    coreIdea: text("coreIdea"),
    genre: text("genre", "\u60AC\u7591"),
    audience: text("audience", "\u6210\u5E74\u7C7B\u578B\u5C0F\u8BF4\u8BFB\u8005"),
    tone: text("tone", "\u51B7\u5CFB\u3001\u514B\u5236\u3001\u5177\u6709\u6301\u7EED\u538B\u8FEB\u611F"),
    protagonistSeed: text("protagonistSeed"),
    mustInclude: text("mustInclude"),
    mustAvoid: text("mustAvoid", "\u7A7A\u6CDB\u8BBE\u5B9A\u3001\u4E07\u80FD\u80FD\u529B\u3001\u65E0\u4EE3\u4EF7\u89C4\u5219\u3001\u5DE5\u5177\u4EBA\u89D2\u8272\u3001\u673A\u68B0\u964D\u795E"),
    totalChapters: Math.round(number("totalChapters", 40, 1, 500)),
    temperature: number("temperature", 0.65, 0, 1.2)
  };
}
function jsonResponse(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}
async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 1e6) throw new Error("request_body_too_large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
function addEvent(run, level, phase, message, data) {
  const started = run.startedAt ? new Date(run.startedAt).getTime() : new Date(run.createdAt).getTime();
  run.events.push({
    seq: run.events.length + 1,
    time: nowIso(),
    elapsedMs: Math.max(0, Date.now() - started),
    level,
    phase,
    message,
    ...data ? { data } : {}
  });
}
function trackLlmCacheUsage(run, operation) {
  return async (usage) => {
    const hitPercent = (usage.cacheHitRate * 100).toFixed(1);
    addEvent(run, usage.cachedTokens > 0 ? "success" : "info", "prompt-cache", usage.cachedTokens > 0 ? `${operation} \u4E0A\u4E0B\u6587\u7F13\u5B58\u547D\u4E2D ${usage.cachedTokens}/${usage.promptTokens} tokens\uFF08${hitPercent}%\uFF09\u3002` : `${operation} \u672C\u6B21\u672A\u547D\u4E2D\u4E0A\u4E0B\u6587\u7F13\u5B58\uFF1B\u5DF2\u5904\u7406 ${usage.promptTokens} \u4E2A\u8F93\u5165 tokens\uFF0C\u5C06\u4F5C\u4E3A\u540E\u7EED\u76F8\u540C\u524D\u7F00\u7684\u7F13\u5B58\u57FA\u7EBF\u3002`, {
      operation,
      ...usage
    });
    try {
      await recordWorkflowModelAttempt(run, operation, usage);
    } catch (error) {
      if (run.workflowTrace) run.workflowTrace.lastError = error instanceof Error ? error.message : String(error);
    }
    await persistRun(run);
  };
}
function parseDebugModelJsonObject(raw) {
  try {
    return parseModelJsonObject(raw);
  } catch (originalError) {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    const candidate = firstBrace >= 0 && lastBrace > firstBrace ? raw.slice(firstBrace, lastBrace + 1) : raw;
    const controlCharRepaired = escapeJsonControlCharactersInStrings(candidate);
    const repairedText = controlCharRepaired.replace(/("|\]|\}|\btrue|\bfalse|\bnull|-?\d+(?:\.\d+)?)\s*\n(\s*")/g, "$1,\n$2");
    try {
      const value = JSON.parse(repairedText);
      return {
        value,
        repairedText,
        repairs: ["escaped_control_characters_in_json_strings", "inserted_missing_commas_between_json_lines"],
        originalError: originalError instanceof Error ? originalError.message : String(originalError)
      };
    } catch (commaRepairError) {
      const closed = closeOpenJsonContainers(repairedText);
      if (closed) {
        try {
          const value = JSON.parse(closed.text);
          return {
            value,
            repairedText: closed.text,
            repairs: ["inserted_missing_commas_between_json_lines", ...closed.repairs],
            originalError: originalError instanceof Error ? originalError.message : String(originalError)
          };
        } catch (closedRepairError) {
          throw new Error(`model_response_invalid_json: ${originalError instanceof Error ? originalError.message : String(originalError)}; comma_repair_failed: ${commaRepairError instanceof Error ? commaRepairError.message : String(commaRepairError)}; close_container_repair_failed: ${closedRepairError instanceof Error ? closedRepairError.message : String(closedRepairError)}`);
        }
      }
      throw commaRepairError;
    }
  }
}
function escapeJsonControlCharactersInStrings(candidate) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (const char of candidate) {
    if (inString) {
      if (escaped) {
        output += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        output += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        output += char;
        inString = false;
        continue;
      }
      if (char === "\n") {
        output += "\\n";
        continue;
      }
      if (char === "\r") {
        output += "\\r";
        continue;
      }
      if (char === "	") {
        output += "\\t";
        continue;
      }
      if (char.charCodeAt(0) < 32) {
        output += " ";
        continue;
      }
      output += char;
      continue;
    }
    output += char;
    if (char === '"') inString = true;
  }
  return output;
}
function closeOpenJsonContainers(candidate) {
  const expectedClosers = [];
  let inString = false;
  let escaped = false;
  for (const char of candidate) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      expectedClosers.push("}");
    } else if (char === "[") {
      expectedClosers.push("]");
    } else if (char === "}" || char === "]") {
      expectedClosers.pop();
    }
  }
  if (inString || !expectedClosers.length) return null;
  const closers = expectedClosers.reverse().join("");
  return {
    text: `${candidate}
${closers}
`,
    repairs: [`closed_${expectedClosers.length}_open_json_containers_after_truncated_model_output`]
  };
}
async function persistRun(run) {
  if (run.pauseRequestedAt && run.status !== "paused") {
    run.status = "paused";
    run.completedAt = run.completedAt || nowIso();
    run.error = "debug_run_paused_by_user";
  }
  await syncWorkflowTrace(run);
  const runDir = path.join(runsRoot, run.runId);
  await fs.mkdir(runDir, { recursive: true });
  const runPath = path.join(runDir, "run.json");
  const tempPath = path.join(runDir, `.run.${process.pid}.${randomUUID()}.tmp`);
  await fs.writeFile(tempPath, `${JSON.stringify(run, null, 2)}
`);
  await fs.rename(tempPath, runPath);
}
var debugWorkflowTraceRecorder = new FactoryWorkflowTraceRecorder(rootDir);
var debugWorkflowKernel = new WorkflowKernel().register({ id: "world-foundation", name: "\u4E16\u754C\u89C2\u751F\u6210", stage: "worldbuilding_dialogue", version: "debug-node-v1", execute: executeRun }).register({ id: "character-planning", name: "\u4EBA\u7269\u89C4\u5212", stage: "setting_review", version: "debug-node-v1", execute: executeCharacterRun }).register({ id: "initial-character-state", name: "\u4EBA\u7269\u521D\u59CB\u72B6\u6001", stage: "setting_review", version: "debug-node-v1", execute: executeInitialCharacterStateRun }).register({ id: "world-matrix", name: "\u4E16\u754C\u77E9\u9635", stage: "setting_review", version: "debug-node-v1", execute: executeWorldMatrixRun }).register({ id: "plot-architecture", name: "\u4E3B\u7EBF\u67B6\u6784", stage: "master_planning", version: "debug-node-v1", execute: executePlotArchitectureRun }).register({ id: "story-bible", name: "\u6545\u4E8B\u5723\u7ECF", stage: "master_planning", version: "debug-node-v1", execute: executeStoryBibleRun }).register({ id: "volume-strategy", name: "\u5206\u5377\u7B56\u7565", stage: "master_planning", version: "debug-node-v1", execute: executeVolumeStrategyRun }).register({ id: "chapter-blueprints", name: "\u7AE0\u8282\u84DD\u56FE", stage: "master_planning", version: "debug-node-v1", execute: executeChapterBlueprintRun }).register({ id: "style-profile", name: "\u6587\u98CE\u81EA\u8FDB\u5316", stage: "drafting", version: "debug-node-v1", execute: executeStyleProfileRun }).register({ id: "single-chapter-context", name: "\u5355\u7AE0\u4E0A\u4E0B\u6587", stage: "drafting", version: "debug-node-v1", execute: executeSingleChapterContextRun }).register({ id: "chapter-draft", name: "\u5355\u7AE0\u5B8C\u6574\u751F\u4EA7", stage: "drafting", version: "debug-node-v2", execute: executeChapterDraftRun }).register({ id: "chapter-commit", name: "\u7AE0\u8282\u6B63\u6587\u51BB\u7ED3", stage: "drafting", version: "debug-node-v1", execute: executeChapterCommitRun }).register({ id: "continuous-chapter-production", name: "\u8FDE\u7EED\u7AE0\u8282\u751F\u4EA7", stage: "drafting", version: "debug-node-v1", execute: executeContinuousChapterProductionRun });
async function initializeWorkflowTrace(run, upstreamRun) {
  const projectId = String(run.input.factoryProjectId || "").trim();
  if (!projectId) throw new Error("factory_project_required_for_debug_trace");
  run.workflowTrace = await debugWorkflowTraceRecorder.initialize({
    projectId,
    externalRunId: run.runId,
    node: debugWorkflowKernel.getNode(run.nodeId),
    input: run.input,
    executionMode: "debug",
    parentRunId: upstreamRun?.workflowTrace?.runId || null,
    parentStepId: upstreamRun?.workflowTrace?.stepId || null,
    goal: `Debug \u5355\u70B9\u6267\u884C\uFF1A${debugWorkflowKernel.getNode(run.nodeId).name}`,
    metadata: {
      isolated: true,
      debugRunId: run.runId,
      upstreamDebugRunId: "upstreamRunId" in run.input ? run.input.upstreamRunId : null
    }
  });
  run.workflowBranch = await new FactoryWorkflowDebugBranchManager(rootDir, projectId).create({
    branchId: run.runId,
    nodeId: run.nodeId,
    runId: run.workflowTrace.runId,
    baseState: upstreamRun?.result || {},
    metadata: {
      debugRunId: run.runId,
      upstreamDebugRunId: upstreamRun?.runId || null,
      isolated: true
    }
  });
}
async function registerDebugRun(run, upstreamRun) {
  await initializeWorkflowTrace(run, upstreamRun);
  runs.set(run.runId, run);
  await persistRun(run);
}
async function syncWorkflowTrace(run) {
  const trace = run.workflowTrace;
  const traceStatus = run.status === "paused" ? "failed" : run.status;
  if (!trace || trace.lastSyncedStatus === traceStatus) return;
  try {
    await debugWorkflowTraceRecorder.sync(trace, debugWorkflowKernel.getNode(run.nodeId), {
      status: traceStatus,
      output: run.result,
      error: run.error,
      validation: run.validation,
      validationInput: { result: run.result },
      validationPromptVersion: "debug-validator-v1",
      metadata: {
        debugRunId: run.runId,
        artifactCount: run.artifacts.length,
        eventCount: run.events.length,
        warningCount: run.validation?.warnings.length || 0,
        errorCount: run.validation?.errors.length || 0,
        paused: run.status === "paused",
        pauseRequestedAt: run.pauseRequestedAt || null,
        pauseReason: run.pauseReason || null
      },
      attemptMetadata: { debugRunId: run.runId, nodeId: run.nodeId }
    });
    if (["completed", "invalid", "failed"].includes(run.status) && run.workflowBranch && run.result) {
      await new FactoryWorkflowDebugBranchManager(rootDir, trace.projectId).append(run.workflowBranch, run.result, {
        label: `node-${run.status}`,
        status: run.status,
        valid: run.validation?.valid === true,
        errorCount: run.validation?.errors.length || 0,
        warningCount: run.validation?.warnings.length || 0
      });
    }
  } catch (error) {
    trace.lastError = error instanceof Error ? error.message : String(error);
  }
}
async function recordWorkflowModelAttempt(run, operation, usage) {
  const trace = run.workflowTrace;
  if (!trace) return;
  const kind = operation.includes("\u5BA1\u8BA1") ? "audit" : operation.includes("\u4FEE\u590D") ? "repair" : "generate";
  const promptArtifactPaths = run.artifacts.filter((artifact) => artifact.endsWith(".md")).slice(-4);
  const promptArtifacts = await Promise.all(promptArtifactPaths.map(async (artifact) => ({
    path: artifact,
    content: await fs.readFile(path.join(runsRoot, run.runId, artifact), "utf8").catch(() => "")
  })));
  await debugWorkflowTraceRecorder.recordAttempt(trace, {
    kind,
    modelConfigId: String(run.provider?.configId || "") || null,
    modelName: String(run.provider?.modelName || "") || null,
    promptVersion: run.learning?.promptVersion || "debug-node-v1",
    input: {
      operation,
      promptChars: run.prompts ? {
        base: run.prompts.basePrompt.length,
        dynamic: run.prompts.dynamicPrompt.length,
        user: run.prompts.userMessage.length
      } : null,
      prompts: run.prompts,
      promptArtifacts
    },
    output: { responseChars: run.rawResponse.length, rawResponse: run.rawResponse },
    usage,
    metadata: { debugRunId: run.runId, nodeId: run.nodeId }
  });
}
async function loadWorkflowEvidence(run) {
  if (!run.workflowTrace) return run;
  try {
    const workflowEvidence = await debugWorkflowTraceRecorder.loadEvidence(run.workflowTrace);
    const workflowBranchEvidence = run.workflowBranch ? await new FactoryWorkflowDebugBranchManager(rootDir, run.workflowTrace.projectId).inspect(run.workflowBranch) : null;
    return { ...run, workflowEvidence, ...workflowBranchEvidence ? { workflowBranchEvidence } : {} };
  } catch {
    return run;
  }
}
function buildPrompts(input, runId) {
  const basePrompt = [
    "\u4F60\u662F\u8D44\u6DF1\u957F\u7BC7\u5C0F\u8BF4\u4E16\u754C\u89C2\u603B\u8BBE\u8BA1\u5E08\uFF08World Foundation Architect\uFF09\u3002",
    "\u4F60\u53EA\u8D1F\u8D23\u751F\u6210\u4E00\u5957\u53EF\u76F4\u63A5\u8FDB\u5165\u540E\u7EED\u4E3B\u7EBF\u89C4\u5212\u7684\u5B8C\u6574\u6545\u4E8B\u57FA\u7840\uFF0C\u4E0D\u5199\u7AE0\u8282\u6B63\u6587\u3002",
    "\u6240\u6709\u8BBE\u5B9A\u5FC5\u987B\u5177\u4F53\u3001\u4E92\u76F8\u5236\u7EA6\u3001\u80FD\u6539\u53D8\u4EBA\u7269\u9009\u62E9\u6210\u672C\uFF1B\u7981\u6B62\u767E\u79D1\u5F0F\u5806\u780C\u3002",
    "\u89D2\u8272\u5FC5\u987B\u6709\u5177\u4F53\u59D3\u540D\u3001\u72EC\u7ACB\u6B32\u671B\u3001\u4F24\u53E3\u3001\u9519\u8BEF\u4FE1\u5FF5\u3001\u53EF\u89C1\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u80FD\u529B\u8FB9\u754C\u548C\u5173\u7CFB\u538B\u529B\u3002",
    "\u4E3B\u7EBF\u5FC5\u987B\u5F62\u6210\u539F\u56E0 \u2192 \u9009\u62E9 \u2192 \u4EE3\u4EF7 \u2192 \u4E0D\u53EF\u9006\u540E\u679C\u7684\u56E0\u679C\u94FE\u3002",
    "\u7981\u6B62\u4F7F\u7528\u5F85\u5B9A\u3001\u6682\u65E0\u3001\u672A\u547D\u540D\u3001\u540E\u7EED\u8865\u5145\u3001TBD\u3001XXX \u7B49\u5360\u4F4D\u5185\u5BB9\u3002",
    "\u5982\u679C\u8F93\u5165\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u8BF7\u505A\u660E\u786E\u4E14\u6709\u8FA8\u8BC6\u5EA6\u7684\u521B\u4F5C\u9009\u62E9\uFF0C\u5E76\u628A\u4ECD\u9700\u7528\u6237\u51B3\u5B9A\u7684\u95EE\u9898\u653E\u5165 openQuestions\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\uFF0C\u4E0D\u8981\u89E3\u91CA\u751F\u6210\u8FC7\u7A0B\u3002"
  ].join("\n");
  const dynamicPrompt = [
    `\u4F5C\u54C1\u540D\uFF1A${input.title}`,
    `\u6838\u5FC3\u521B\u610F\uFF1A${input.coreIdea}`,
    `\u7C7B\u578B\uFF1A${input.genre}`,
    `\u76EE\u6807\u8BFB\u8005\uFF1A${input.audience}`,
    `\u6574\u4F53\u8BED\u6C14\uFF1A${input.tone}`,
    `\u9884\u8BA1\u7AE0\u8282\u6570\uFF1A${input.totalChapters}`,
    `\u4E3B\u89D2\u79CD\u5B50\uFF1A${input.protagonistSeed || "\u672A\u63D0\u4F9B\uFF0C\u7531\u6A21\u578B\u521B\u9020\u4E00\u4E2A\u5177\u4F53\u4E3B\u89D2"}`,
    `\u5FC5\u987B\u5305\u542B\uFF1A${input.mustInclude || "\u7531\u6838\u5FC3\u521B\u610F\u63A8\u5BFC\uFF0C\u4F46\u5FC5\u987B\u6709\u81F3\u5C11\u4E00\u4E2A\u72EC\u7279\u5236\u5EA6\u3001\u4E00\u4E2A\u53EF\u89C1\u751F\u6D3B\u7EC6\u8282\u548C\u4E00\u4E2A\u4E0D\u53EF\u9006\u4EE3\u4EF7"}`,
    `\u5FC5\u987B\u907F\u514D\uFF1A${input.mustAvoid}`
  ].join("\n");
  const userMessage = [
    "\u751F\u6210\u5B8C\u6574 World Foundation JSON\uFF0C\u4E25\u683C\u4F7F\u7528\u4EE5\u4E0B\u9876\u5C42\u7ED3\u6784\uFF1A",
    "{",
    '  "version": 1,',
    '  "project": { "title": "", "logline": "", "genre": "", "audience": "", "themes": [""] },',
    '  "background": { "era": "", "geography": "", "society": "", "technologyOrPower": "", "dailyLife": "", "history": "" },',
    '  "worldRules": [{ "name": "", "rule": "", "visibleEffect": "", "cost": "", "exceptions": "", "plotUse": "" }],',
    '  "factions": [{ "name": "", "goal": "", "resources": [""], "method": "", "internalConflict": "", "externalConflict": "" }],',
    '  "characters": [{ "name": "", "role": "", "identity": "", "desire": "", "wound": "", "fear": "", "misbelief": "", "behaviorHabit": "", "speechPattern": "", "skills": [""], "limitations": [""], "relationships": [{ "target": "", "dynamic": "", "pressure": "" }] }],',
    '  "mainConflict": { "surface": "", "underlying": "", "stakes": "", "deadline": "", "irreversibleConsequences": [""] },',
    '  "mainPlot": { "openingState": "", "incitingIncident": "", "firstTurn": "", "midpoint": "", "crisis": "", "climax": "", "ending": "", "causalChain": [""] },',
    '  "subplots": [{ "name": "", "characters": [""], "purpose": "", "progression": [""] }],',
    '  "foreshadowing": [{ "seed": "", "surfaceMeaning": "", "trueMeaning": "", "payoffWindow": "", "payoffEffect": "" }],',
    '  "arcPlan": [{ "arc": 1, "chapterRange": "", "goal": "", "pressure": "", "turningPoint": "", "irreversibleChange": "" }],',
    '  "canon": { "immutableFacts": [""], "forbiddenContradictions": [""] },',
    '  "openQuestions": [{ "question": "", "whyItMatters": "", "recommendedDefault": "" }],',
    '  "qualitySelfCheck": { "specificity": "", "causality": "", "characterAgency": "", "worldCost": "", "remainingRisks": [""] }',
    "}",
    "\u6570\u91CF\u5E95\u7EBF\uFF1AworldRules \u81F3\u5C11 6 \u6761\uFF0Cfactions \u81F3\u5C11 3 \u4E2A\uFF0Ccharacters \u81F3\u5C11 5 \u4EBA\uFF0Csubplots \u81F3\u5C11 2 \u6761\uFF0Cforeshadowing \u81F3\u5C11 6 \u6761\uFF0CarcPlan \u81F3\u5C11 4 \u6BB5\u3002",
    "\u6BCF\u4E2A\u6570\u7EC4\u5143\u7D20\u90FD\u5FC5\u987B\u662F\u672C\u6545\u4E8B\u72EC\u6709\u7684\u5177\u4F53\u5185\u5BB9\uFF0C\u4E0D\u80FD\u91CD\u590D\u6362\u8BCD\u3002"
  ].join("\n");
  const consensus = `\u72EC\u7ACB\u8C03\u8BD5 Run: ${runId}
\u4F5C\u54C1\uFF1A${input.title}`;
  const artifactProtocol = [
    "\u751F\u4EA7\u8D44\u4EA7\u751F\u6210\u534F\u8BAE\uFF1A",
    "- \u4F60\u8D1F\u8D23\u751F\u6210\u5F53\u524D\u8BF7\u6C42\u6307\u5B9A\u7684\u751F\u4EA7\u8D44\u4EA7\uFF0C\u800C\u4E0D\u662F\u8FDB\u884C\u5706\u684C\u8BA8\u8BBA\u3002",
    "- \u4E25\u683C\u9075\u5B88\u7528\u6237\u6D88\u606F\u4E2D\u7684\u8F93\u51FA\u683C\u5F0F\u3001\u7AE0\u8282\u6570\u3001\u5B57\u6BB5\u548C\u8D44\u4EA7\u8FB9\u754C\u3002",
    "- \u4E0D\u8981\u8F93\u51FA\u5BD2\u6684\u3001\u89D2\u8272\u81EA\u79F0\u3001\u89E3\u91CA\u81EA\u5DF1\u521A\u5B8C\u6210\u4E86\u4EC0\u4E48\u3001\u6216\u5BF9\u7528\u6237\u8BF4\u8BDD\u7684\u5F00\u573A\u767D\u3002",
    "- \u9664\u975E\u5F53\u524D\u4EFB\u52A1\u660E\u786E\u8981\u6C42\u7AE0\u8282\u6B63\u6587\uFF0C\u5426\u5219\u4E0D\u5F97\u8F93\u51FA\u6B63\u6587\u5185\u5BB9\u3002"
  ].join("\n");
  const responseContract = [
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u5FC5\u987B\u4E25\u683C\u8F93\u51FA\u5F53\u524D\u8BF7\u6C42\u6307\u5B9A\u7684\u751F\u4EA7\u8D44\u4EA7\u3002",
    "- \u4E0D\u8981\u8F93\u51FA\u5BD2\u6684\u3001\u5BF9\u8BDD\u5F0F\u5F00\u573A\u3001\u5143\u53D9\u8FF0\u6216\u6267\u884C\u8FC7\u7A0B\u8BF4\u660E\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728\u5F53\u524D target \u5185\u3002",
    "- \u9664\u975E\u660E\u786E\u8FDB\u5165 drafting \u9636\u6BB5\uFF0C\u5426\u5219\u4E0D\u80FD\u4EA7\u51FA\u8131\u79BB\u9636\u6BB5\u7684\u7AE0\u8282\u6B63\u6587\u3002"
  ].join("\n");
  const systemPrompt = [
    consensus,
    artifactProtocol,
    basePrompt,
    dynamicPrompt,
    "\u8F93\u51FA\u8BED\u8A00\uFF1A\u7B80\u4F53\u4E2D\u6587",
    "\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1Aworld_foundation_debug",
    "Discussion stage: specialist_turn",
    responseContract
  ].join("\n\n");
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage };
}
function characterTargetForScale(totalChapters) {
  if (totalChapters <= 60) return 6;
  if (totalChapters <= 150) return 8;
  if (totalChapters <= 300) return 10;
  return 12;
}
function worldCharacterNames(worldFoundation) {
  if (!Array.isArray(worldFoundation.characters)) return [];
  return worldFoundation.characters.map((item) => String(item?.name || "").trim()).filter(Boolean);
}
function buildCharacterPrompts(input, runId) {
  const inheritedNames = worldCharacterNames(input.worldFoundation);
  const targetCount = Math.max(inheritedNames.length, characterTargetForScale(input.totalChapters));
  const basePrompt = [
    "\u4F60\u662F\u8D44\u6DF1\u957F\u7BC7\u5C0F\u8BF4\u4EBA\u7269\u67B6\u6784\u5E08\uFF08Character Dynamics Architect\uFF09\u3002",
    "\u4F60\u7684\u4EFB\u52A1\u662F\u628A\u5DF2\u6279\u51C6\u7684 World Foundation \u8F6C\u6362\u6210\u53EF\u4F9B\u4E3B\u7EBF\u3001\u5206\u5377\u548C\u7AE0\u8282\u84DD\u56FE\u76F4\u63A5\u6D88\u8D39\u7684\u4EBA\u7269\u89C4\u5212\u8D44\u4EA7\uFF0C\u4E0D\u5199\u7AE0\u8282\u6B63\u6587\u3002",
    "\u4E0A\u6E38\u5DF2\u5B58\u5728\u7684\u4EBA\u7269\u59D3\u540D\u3001\u8EAB\u4EFD\u3001\u6838\u5FC3\u6B32\u671B\u3001\u4F24\u53E3\u548C\u9635\u8425\u5C5E\u4E8E\u5DF2\u786E\u8BA4\u4E8B\u5B9E\uFF1A\u5FC5\u987B\u5B8C\u6574\u7EE7\u627F\uFF0C\u4E0D\u5F97\u6539\u540D\u3001\u5408\u5E76\u3001\u5077\u6362\u8EAB\u4EFD\u6216\u6084\u6084\u5220\u9664\u3002",
    "\u53EF\u4EE5\u65B0\u589E\u4EBA\u7269\uFF0C\u4F46\u6BCF\u4E2A\u65B0\u589E\u4EBA\u7269\u5FC5\u987B\u586B\u8865\u660E\u786E\u7684\u53D9\u4E8B\u529F\u80FD\u7F3A\u53E3\uFF0C\u5E76\u6307\u5B9A\u9996\u6B21\u8FDB\u5165\u9636\u6BB5\uFF1B\u7981\u6B62\u4E3A\u4E86\u51D1\u6570\u5236\u9020\u540C\u8D28\u5316\u5DE5\u5177\u4EBA\u3002",
    "\u6240\u6709\u4EBA\u7269\u90FD\u5FC5\u987B\u4F7F\u7528\u53EF\u8FA8\u8BC6\u7684\u5177\u4F53\u59D3\u540D\uFF1B\u4E25\u7981\u628A\u65E0\u540D\u3001\u67D0\u4EBA\u3001\u795E\u79D8\u4EBA\u3001\u672A\u77E5\u8005\u7B49\u529F\u80FD\u63CF\u8FF0\u5F53\u4F5C\u59D3\u540D\u3002",
    "\u6BCF\u4E2A\u4EBA\u7269\u5FC5\u987B\u62E5\u6709\u72EC\u7ACB\u6B32\u671B\u3001\u4F24\u53E3\u3001\u9519\u8BEF\u4FE1\u5FF5\u3001\u79D8\u5BC6\u3001\u53EF\u89C1\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u80FD\u529B\u8FB9\u754C\u3001\u5173\u7CFB\u538B\u529B\u4E0E\u53EF\u8FFD\u8E2A\u7684\u9636\u6BB5\u53D8\u5316\u3002",
    "\u5373\u4F7F\u4EBA\u7269\u662F\u975E\u4EBA\u5B9E\u4F53\uFF0C\u4E5F\u4E0D\u80FD\u628A\u6B32\u671B\u3001\u4F24\u53E3\u3001\u6050\u60E7\u3001\u4EE3\u4EF7\u5199\u6210\u65E0\u3001\u6CA1\u6709\u3001\u4E0D\u9002\u7528\u6216\u672A\u77E5\uFF1B\u5FC5\u987B\u8F6C\u6362\u4E3A\u8BE5\u5B9E\u4F53\u771F\u5B9E\u5B58\u5728\u7684\u5931\u8861\u98CE\u9669\u3001\u7F3A\u9677\u6216\u4E0D\u53EF\u9006\u635F\u8017\u3002",
    "\u4EBA\u7269\u6570\u91CF\u5FC5\u987B\u4E0E\u9879\u76EE\u4F53\u91CF\u5339\u914D\uFF1B\u6838\u5FC3\u4EBA\u7269\u8D1F\u8D23\u5168\u4E66\uFF0C\u7BC7\u7AE0\u4EBA\u7269\u6309\u9636\u6BB5\u8FDB\u5165\uFF0C\u573A\u666F\u4EBA\u7269\u4E0D\u5F97\u5728\u672C\u8282\u70B9\u63D0\u524D\u6CDB\u6EE5\u751F\u6210\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\uFF0C\u4E0D\u8981\u89E3\u91CA\u751F\u6210\u8FC7\u7A0B\uFF0C\u4E0D\u5F97\u4F7F\u7528\u5F85\u5B9A\u3001\u6682\u65E0\u3001\u672A\u547D\u540D\u3001\u540E\u7EED\u8865\u5145\u3001TBD\u3001XXX \u7B49\u5360\u4F4D\u5185\u5BB9\u3002"
  ].join("\n");
  const dynamicPrompt = [
    `\u4E0A\u6E38\u4E16\u754C\u89C2 Run\uFF1A${input.upstreamRunId}`,
    `\u9884\u8BA1\u7AE0\u8282\u6570\uFF1A${input.totalChapters}`,
    `\u4E0A\u6E38\u5DF2\u786E\u8BA4\u4EBA\u7269\uFF08${inheritedNames.length} \u4EBA\uFF09\uFF1A${inheritedNames.join("\u3001")}`,
    `\u672C\u8F6E\u5177\u540D\u89C4\u5212\u4EBA\u7269\u6700\u4F4E\u76EE\u6807\uFF1A${targetCount} \u4EBA`,
    `\u672C\u8F6E\u989D\u5916\u5173\u6CE8\uFF1A${input.planningFocus || "\u4F18\u5148\u68C0\u67E5\u4E3B\u89D2\u3001\u5BF9\u6297\u529B\u91CF\u3001\u5173\u7CFB\u8F74\u3001\u76DF\u53CB\u3001\u80CC\u53DB\u8005\u3001\u5BFC\u5E08/\u89C1\u8BC1\u8005\u7B49\u529F\u80FD\u662F\u5426\u5B8C\u6574\uFF0C\u5E76\u89C4\u5212\u5206\u9636\u6BB5\u6269\u5BB9\u3002"}`,
    "\u4EE5\u4E0B\u662F\u552F\u4E00\u5141\u8BB8\u7EE7\u627F\u7684\u4E0A\u6E38 World Foundation JSON\uFF1A",
    JSON.stringify(input.worldFoundation, null, 2)
  ].join("\n");
  const userMessage = [
    "\u751F\u6210\u5B8C\u6574 Character Planning JSON\uFF0C\u4E25\u683C\u4F7F\u7528\u4EE5\u4E0B\u9876\u5C42\u7ED3\u6784\uFF1A",
    "{",
    '  "version": 1,',
    '  "source": { "upstreamRunId": "", "inheritedCharacterNames": [""] },',
    '  "scalePlan": { "totalChapters": 0, "currentWorldCharacterCount": 0, "plannedNamedCharacterCount": 0, "coreCastTarget": 0, "arcCharacterTarget": 0, "localCharacterPolicy": "", "sufficiencyVerdict": "sufficient|needs_expansion", "reasoning": "" },',
    '  "characters": [{ "name": "", "origin": "inherited|new", "tier": "core|arc|supporting", "role": "", "identity": "", "narrativeFunction": "", "desire": "", "wound": "", "fear": "", "misbelief": "", "secret": "", "values": [""], "behaviorHabits": [""], "speechPattern": "", "skills": [""], "limitations": [""], "knowledgeBoundary": { "knows": [""], "believes": [""], "mustNotKnowYet": [""] }, "relationships": [{ "target": "", "surface": "", "hidden": "", "pressure": "", "changeTrigger": "" }], "trajectory": { "startState": "", "turningPoints": [""], "endState": "", "irreversibleCost": "" }, "entry": { "chapterWindow": "", "condition": "" }, "exitOrTransformation": { "chapterWindow": "", "condition": "" }, "continuityLocks": [""] }],',
    '  "relationshipGraph": [{ "from": "", "to": "", "type": "", "surfaceState": "", "hiddenTension": "", "breakingPoint": "", "plannedEvolution": [""] }],',
    '  "roleCoverage": [{ "function": "", "owners": [""], "status": "covered|weak|missing", "risk": "" }],',
    '  "arcEntryPlan": [{ "arc": 1, "chapterRange": "", "activeCharacters": [""], "plannedIntroductions": [{ "name": "", "purpose": "" }], "exitsOrTransformations": [{ "name": "", "change": "" }], "relationshipPressure": "" }],',
    '  "expansionRules": { "whenToAdd": [""], "whenNotToAdd": [""], "approvalRequiredFor": [""], "minorCharacterPolicy": "" },',
    '  "continuityLocks": { "immutableIdentities": [""], "immutableRelationships": [""], "forbiddenDrift": [""] },',
    '  "castRisks": [{ "risk": "", "affectedCharacters": [""], "mitigation": "" }],',
    '  "openQuestions": [{ "question": "", "whyItMatters": "", "recommendedDefault": "" }],',
    '  "qualitySelfCheck": { "allInheritedCharactersPreserved": true, "roleCoverageComplete": true, "relationshipPressureConcrete": true, "scaleMatchesProject": true, "remainingGaps": [""] }',
    "}",
    `\u786C\u6027\u8981\u6C42\uFF1Acharacters \u81F3\u5C11 ${targetCount} \u4EBA\uFF1B\u5FC5\u987B\u5305\u542B\u5168\u90E8\u4E0A\u6E38\u4EBA\u7269\uFF1A${inheritedNames.join("\u3001")}\u3002`,
    "\u6BCF\u4E2A\u65B0\u589E\u4EBA\u7269\u5FC5\u987B\u6709\u5177\u4F53\u59D3\u540D\uFF1Bname \u4E0D\u5F97\u4E3A\u65E0\u540D\u3001\u67D0\u4EBA\u3001\u795E\u79D8\u4EBA\u3001\u672A\u77E5\u8005\u3002\u5173\u952E\u6863\u6848\u5B57\u6BB5\u4E0D\u5F97\u7528\u65E0\u3001\u6CA1\u6709\u3001\u4E0D\u9002\u7528\u3001\u672A\u77E5\u89C4\u907F\u3002",
    "roleCoverage \u81F3\u5C11\u8986\u76D6\u4E3B\u89D2\u9A71\u52A8\u3001\u4E3B\u8981\u5BF9\u6297\u3001\u60C5\u611F\u5173\u7CFB\u8F74\u3001\u4EF7\u503C\u89C2\u955C\u50CF\u3001\u5185\u90E8\u5F02\u8BAE\u3001\u4FE1\u606F\u6765\u6E90\u3001\u4EE3\u4EF7\u89C1\u8BC1\u3001\u9636\u6BB5\u6027\u963B\u529B\u516B\u7C7B\u529F\u80FD\u3002",
    "relationshipGraph \u5FC5\u987B\u5F62\u6210\u53EF\u53D8\u5316\u7684\u5173\u7CFB\u7F51\u7EDC\uFF0C\u4E0D\u80FD\u53EA\u5199\u9759\u6001\u7684\u670B\u53CB/\u654C\u4EBA\u6807\u7B7E\u3002",
    "arcEntryPlan \u5FC5\u987B\u4E0E\u4E0A\u6E38 arcPlan \u4E00\u4E00\u5BF9\u5E94\uFF1B\u65B0\u589E\u4EBA\u7269\u5FC5\u987B\u5728 characters \u4E2D\u6709\u5B8C\u6574\u6863\u6848\u3002"
  ].join("\n");
  const consensus = `\u72EC\u7ACB\u8C03\u8BD5 Run: ${runId}
\u4E0A\u6E38 Run: ${input.upstreamRunId}`;
  const artifactProtocol = [
    "\u751F\u4EA7\u8D44\u4EA7\u751F\u6210\u534F\u8BAE\uFF1A",
    "- \u4F60\u8D1F\u8D23\u751F\u6210\u5F53\u524D\u8BF7\u6C42\u6307\u5B9A\u7684\u751F\u4EA7\u8D44\u4EA7\uFF0C\u800C\u4E0D\u662F\u8FDB\u884C\u5706\u684C\u8BA8\u8BBA\u3002",
    "- \u4E25\u683C\u9075\u5B88\u7528\u6237\u6D88\u606F\u4E2D\u7684\u8F93\u51FA\u683C\u5F0F\u3001\u7AE0\u8282\u6570\u3001\u5B57\u6BB5\u548C\u8D44\u4EA7\u8FB9\u754C\u3002",
    "- \u4E0D\u8981\u8F93\u51FA\u5BD2\u6684\u3001\u89D2\u8272\u81EA\u79F0\u3001\u5143\u53D9\u8FF0\u6216\u7AE0\u8282\u6B63\u6587\u3002"
  ].join("\n");
  const responseContract = [
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u53EA\u80FD\u8F93\u51FA\u5355\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728 character_planning_debug \u9636\u6BB5\u3002"
  ].join("\n");
  const systemPrompt = [
    consensus,
    artifactProtocol,
    basePrompt,
    dynamicPrompt,
    "\u8F93\u51FA\u8BED\u8A00\uFF1A\u7B80\u4F53\u4E2D\u6587",
    "\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1Acharacter_planning_debug",
    "Discussion stage: specialist_turn",
    responseContract
  ].join("\n\n");
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage };
}
function plannedCharacterNames(characterPlanning) {
  if (!Array.isArray(characterPlanning.characters)) return [];
  return characterPlanning.characters.map((item) => String(item?.name || "").trim()).filter(Boolean);
}
function buildInitialCharacterStatePrompts(input, runId) {
  const names = plannedCharacterNames(input.characterPlanning);
  const upstreamRelationships = Array.isArray(input.characterPlanning.relationshipGraph) ? input.characterPlanning.relationshipGraph : [];
  const relationshipCount = upstreamRelationships.length;
  const frozenRelationshipEdges = upstreamRelationships.map((relationship) => `${relationship.from}\u2192${relationship.to}`).join("\u3001");
  const basePrompt = [
    "\u4F60\u662F\u8D44\u6DF1\u957F\u7BC7\u5C0F\u8BF4\u8FDE\u7EED\u6027\u4E0E\u4EBA\u7269\u72B6\u6001\u8BBE\u8BA1\u5E08\uFF08Initial Character State Architect\uFF09\u3002",
    "\u4F60\u53EA\u8D1F\u8D23\u628A\u5DF2\u7ECF\u6279\u51C6\u7684\u4EBA\u7269\u89C4\u5212\u51BB\u7ED3\u6210\u6545\u4E8B\u5F00\u573A\u65F6\u523B\u7684\u53EF\u6267\u884C\u72B6\u6001\u8D26\u672C\uFF0C\u4E0D\u5199\u7AE0\u8282\u6B63\u6587\uFF0C\u4E0D\u65B0\u589E\u6216\u5220\u9664\u4EBA\u7269\uFF0C\u4E0D\u91CD\u65B0\u8BBE\u8BA1\u4EBA\u7269\u8EAB\u4EFD\u3002",
    "\u6BCF\u4E00\u540D\u5DF2\u89C4\u5212\u4EBA\u7269\u90FD\u5FC5\u987B\u62E5\u6709\u6545\u4E8B\u5F00\u59CB\u65F6\u7684\u5177\u4F53\u4F4D\u7F6E\u3001\u5728\u573A\u72B6\u6001\u3001\u5F53\u524D\u76EE\u6807\u3001\u5373\u65F6\u538B\u529B\u3001\u8EAB\u4F53\u4E0E\u60C5\u7EEA\u72B6\u6001\u3001\u8D44\u6E90\u3001\u8D1F\u62C5\u3001\u77E5\u8BC6\u8FB9\u754C\u3001\u79D8\u5BC6\u66B4\u9732\u98CE\u9669\u3001\u5173\u7CFB\u6E29\u5EA6\u548C\u9996\u6B21\u884C\u52A8\u89E6\u53D1\u6761\u4EF6\u3002",
    "\u5C1A\u672A\u6B63\u5F0F\u767B\u573A\u7684\u4EBA\u7269\u4E5F\u5FC5\u987B\u6709\u771F\u5B9E\u7684\u79BB\u573A\u4F4D\u7F6E\u4E0E\u6B63\u5728\u8FDB\u884C\u7684\u884C\u52A8\uFF0C\u4E0D\u80FD\u5199\u6210\u7B49\u5F85\u5267\u60C5\u9700\u8981\u3001\u6682\u672A\u767B\u573A\u3001\u672A\u77E5\u6216\u5F85\u5B9A\u3002",
    "\u4E3B\u89D2\u5FC5\u987B\u5904\u4E8E onstage\uFF0C\u62E5\u6709\u80FD\u591F\u76F4\u63A5\u542F\u52A8\u7B2C\u4E00\u7AE0\u7684\u53EF\u89C1\u52A8\u4F5C\u3001\u963B\u529B\u3001\u5012\u8BA1\u65F6\u548C\u4E0D\u53EF\u9006\u98CE\u9669\u3002",
    "\u5173\u7CFB\u6570\u503C\u53EA\u7528\u4E8E\u8868\u8FBE\u5F00\u573A\u5DEE\u5F02\uFF0C\u5FC5\u987B\u7531\u4E0A\u6E38\u5173\u7CFB\u538B\u529B\u63A8\u5BFC\uFF1B\u4ECE\u672A\u89C1\u9762\u7684\u5173\u7CFB\u5141\u8BB8\u4E94\u9879\u6570\u503C\u5168\u4E3A 0\uFF0C\u4F46 surfaceState\u3001hiddenTension \u548C firstChangeTrigger \u4ECD\u5FC5\u987B\u5199\u51FA\u5177\u4F53\u4E8B\u5B9E\u3002",
    "\u6BCF\u4E2A\u4EBA\u7269\u7684 relationships \u53EA\u5217\u5F00\u573A\u65F6\u5DF2\u4EA7\u751F\u8BA4\u77E5\u6216\u63A5\u89E6\u7684\u5173\u7CFB\uFF0C\u5B83\u53EA\u80FD\u662F\u4E0A\u6E38\u5173\u7CFB\u7F51\u4E2D\u4E0E\u81EA\u5DF1\u76F8\u8FDE\u4EBA\u7269\u7684\u5B50\u96C6\uFF1B\u5B8C\u6574\u5173\u7CFB\u7684\u552F\u4E00\u771F\u6E90\u662F relationshipStateLedger\uFF0C\u8BE5\u603B\u8D26\u5FC5\u987B\u4E0E\u4E0A\u6E38\u5173\u7CFB\u8FB9\u4E00\u4E00\u5BF9\u5E94\uFF0C\u4FDD\u6301 from/to \u65B9\u5411\uFF0C\u4E0D\u5F97\u6DFB\u52A0\u3001\u9057\u6F0F\u6216\u91CD\u590D\u8FB9\u3002",
    "dormant \u4EBA\u7269\u4E5F\u5FC5\u987B\u5199\u6210\u53EF\u8FFD\u8E2A\u7684\u8FD0\u884C\u72B6\u6001\uFF0C\u4F8B\u5982\u5C01\u5370\u7EF4\u6301\u76EE\u6807\u3001\u5C01\u5370\u8870\u51CF\u538B\u529B\u3001\u4F11\u7720\u4E2D\u7684\u89E6\u53D1\u6761\u4EF6\uFF1BpublicIdentity/hiddenIdentity \u5FC5\u987B\u63CF\u8FF0\u5916\u754C\u53EF\u89C1\u8EAB\u4EFD\u6216\u9690\u533F\u65B9\u5F0F\uFF0C\u4E0D\u80FD\u5199\u65E0\u6216\u672A\u77E5\u3002",
    "\u4E25\u683C\u7EE7\u627F\u4E0A\u6E38\u4EBA\u7269\u59D3\u540D\u3001\u8EAB\u4EFD\u3001\u77E5\u8BC6\u8FB9\u754C\u3001\u5173\u7CFB\u4E0E\u8FDE\u7EED\u6027\u9501\uFF1B\u4E0D\u5F97\u63D0\u524D\u6CC4\u9732 mustNotKnowYet \u4E2D\u7684\u4FE1\u606F\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\uFF0C\u4E0D\u8981\u89E3\u91CA\u751F\u6210\u8FC7\u7A0B\u3002"
  ].join("\n");
  const dynamicPrompt = [
    `\u4EBA\u7269\u89C4\u5212 Run\uFF1A${input.upstreamRunId}`,
    `\u6545\u4E8B\u5F00\u573A\u7AE0\u8282\uFF1A\u7B2C ${input.openingChapter} \u7AE0`,
    `\u5168\u4E66\u4F53\u91CF\uFF1A${input.totalChapters} \u7AE0`,
    `\u51BB\u7ED3\u4EBA\u7269\uFF08${names.length} \u4EBA\uFF09\uFF1A${names.join("\u3001")}`,
    `\u4E0A\u6E38\u5173\u7CFB\u8FB9\uFF08${relationshipCount} \u6761\uFF09\u5FC5\u987B\u5168\u90E8\u83B7\u5F97\u5F00\u573A\u72B6\u6001\u3002`,
    `\u51BB\u7ED3\u5173\u7CFB\u8FB9\uFF08\u4E25\u683C\u4FDD\u6301\u65B9\u5411\uFF09\uFF1A${frozenRelationshipEdges}`,
    `\u672C\u8F6E\u989D\u5916\u5173\u6CE8\uFF1A${input.stateFocus || "\u786E\u4FDD\u7B2C\u4E00\u7AE0\u80FD\u76F4\u63A5\u6267\u884C\uFF0C\u540C\u65F6\u4E3A\u540E\u7EED\u767B\u573A\u4EBA\u7269\u4FDD\u7559\u5177\u4F53\u7684\u79BB\u573A\u884C\u52A8\u548C\u77E5\u8BC6\u8FB9\u754C\u3002"}`,
    "\u5DF2\u6279\u51C6 World Foundation JSON\uFF1A",
    JSON.stringify(input.worldFoundation, null, 2),
    "\u5DF2\u6279\u51C6 Character Planning JSON\uFF1A",
    JSON.stringify(input.characterPlanning, null, 2)
  ].join("\n");
  const userMessage = [
    "\u751F\u6210\u5B8C\u6574 Initial Character State JSON\uFF0C\u4E25\u683C\u4F7F\u7528\u4EE5\u4E0B\u9876\u5C42\u7ED3\u6784\uFF1A",
    "{",
    '  "version": 1,',
    '  "source": { "characterPlanningRunId": "", "worldFoundationRunId": "", "frozenCharacterNames": [""] },',
    '  "openingFrame": { "chapter": 1, "time": "", "primaryLocation": "", "publicSituation": "", "hiddenSituation": "", "activeDeadline": "", "incitingTrigger": "", "firstChapterGoal": "", "firstChapterObstacle": "", "irreversibleRisk": "" },',
    '  "characters": [{ "name": "", "presence": "onstage|offstage|dormant", "location": "", "currentGoal": "", "immediatePressure": "", "physicalState": "", "emotionalState": "", "publicIdentity": "", "hiddenIdentity": "", "resources": [""], "liabilities": [""], "knowledge": { "knows": [""], "believes": [""], "mustNotKnowYet": [""] }, "secrets": [{ "secret": "", "exposureRisk": "", "whoCanExpose": [""] }], "relationships": [{ "target": "", "trust": 0, "affection": 0, "fear": 0, "debt": 0, "leverage": 0, "surfaceState": "", "hiddenTension": "" }], "openingAction": "", "firstAppearance": { "chapterWindow": "", "trigger": "", "entranceCost": "" }, "stateLocks": [""] }],',
    '  "relationshipStateLedger": [{ "from": "", "to": "", "trust": 0, "affection": 0, "fear": 0, "debt": 0, "leverage": 0, "surfaceState": "", "hiddenTension": "", "firstChangeTrigger": "" }],',
    '  "activeClocks": [{ "name": "", "holder": "", "deadline": "", "currentState": "", "failureConsequence": "" }],',
    '  "openingKnowledgeLocks": [{ "fact": "", "knowers": [""], "excludedCharacters": [""], "unlockCondition": "" }],',
    '  "continuityLocks": { "identityLocks": [""], "locationLocks": [""], "knowledgeLocks": [""], "relationshipLocks": [""], "forbiddenOpeningDrift": [""] },',
    '  "handoffToWorldMatrix": { "activeLocations": [""], "requiredInstitutions": [""], "requiredResources": [""], "pressureSystems": [""], "unresolvedStateQuestions": [""] },',
    '  "qualitySelfCheck": { "allCharactersInitialized": true, "noNewCharacters": true, "protagonistCanStartChapterOne": true, "knowledgeBoundariesPreserved": true, "relationshipStatesDifferentiated": true, "remainingRisks": [""] }',
    "}",
    `\u786C\u6027\u4EBA\u7269\u96C6\u5408\uFF1Acharacters \u5FC5\u987B\u6070\u597D\u5305\u542B ${names.length} \u4EBA\uFF0C\u59D3\u540D\u53EA\u80FD\u662F\uFF1A${names.join("\u3001")}\u3002`,
    `relationshipStateLedger \u5FC5\u987B\u6070\u597D ${relationshipCount} \u6761\uFF0C\u4E0E\u51BB\u7ED3\u5173\u7CFB\u8FB9\u9010\u6761\u5BF9\u5E94\uFF0C\u4E0D\u5F97\u81EA\u884C\u8865\u5145\u53CD\u5411\u8FB9\u3002`,
    "\u6BCF\u4E2A\u4EBA\u7269\u7684 relationships \u53EA\u80FD\u5217\u51BB\u7ED3\u5173\u7CFB\u8FB9\u4E2D\u4E0E\u81EA\u5DF1\u76F8\u8FDE\u4E14\u5F00\u573A\u5DF2\u7ECF\u6FC0\u6D3B\u7684\u76EE\u6807\u4EBA\u7269\uFF1B\u5C1A\u672A\u5F62\u6210\u8BA4\u77E5\u7684\u5173\u7CFB\u53EF\u4E0D\u5217\uFF0C\u4E0D\u5F97\u5F15\u7528\u5176\u4ED6\u5B9E\u4F53\u3002",
    "\u6240\u6709\u6570\u503C\u5B57\u6BB5\u5FC5\u987B\u662F -100 \u5230 100 \u7684\u6574\u6570\uFF1B\u786E\u5B9E\u4ECE\u672A\u89C1\u9762\u7684\u5173\u7CFB\u5141\u8BB8\u6574\u6761\u4E3A 0\uFF0C\u4F46\u4ECD\u987B\u5177\u4F53\u586B\u5199 surfaceState\u3001hiddenTension \u548C\u89E6\u53D1\u6761\u4EF6\u3002",
    "\u4E0D\u5F97\u4F7F\u7528\u65E0\u3001\u6CA1\u6709\u3001\u672A\u77E5\u3001\u5F85\u5B9A\u3001\u6682\u672A\u767B\u573A\u3001\u7B49\u5F85\u5267\u60C5\u9700\u8981\u7B49\u89C4\u907F\u72B6\u6001\u3002"
  ].join("\n");
  const consensus = `\u72EC\u7ACB\u8C03\u8BD5 Run: ${runId}
\u4EBA\u7269\u89C4\u5212\u4E0A\u6E38 Run: ${input.upstreamRunId}`;
  const artifactProtocol = [
    "\u751F\u4EA7\u8D44\u4EA7\u751F\u6210\u534F\u8BAE\uFF1A",
    "- \u751F\u6210\u5F53\u524D\u9636\u6BB5\u6307\u5B9A\u7684\u72B6\u6001\u8D44\u4EA7\uFF0C\u4E0D\u8FDB\u884C\u5706\u684C\u8BA8\u8BBA\u3002",
    "- \u4E0D\u65B0\u589E\u4EBA\u7269\uFF0C\u4E0D\u6539\u5199\u4EBA\u7269\u89C4\u5212\uFF0C\u4E0D\u5199\u7AE0\u8282\u6B63\u6587\u3002",
    "- \u53EA\u8F93\u51FA\u53EF\u88AB\u4E0B\u4E00\u8282\u70B9\u76F4\u63A5\u6D88\u8D39\u7684\u7ED3\u6784\u5316 JSON\u3002"
  ].join("\n");
  const responseContract = [
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u53EA\u80FD\u8F93\u51FA\u5355\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728 initial_character_state_debug \u9636\u6BB5\u3002"
  ].join("\n");
  const systemPrompt = [
    consensus,
    artifactProtocol,
    basePrompt,
    dynamicPrompt,
    "\u8F93\u51FA\u8BED\u8A00\uFF1A\u7B80\u4F53\u4E2D\u6587",
    "\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1Ainitial_character_state_debug",
    "Discussion stage: specialist_turn",
    responseContract
  ].join("\n\n");
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage };
}
function buildInitialCharacterStateRepairMessage(input, result, errors) {
  const names = plannedCharacterNames(input.characterPlanning);
  const relationships = Array.isArray(input.characterPlanning.relationshipGraph) ? input.characterPlanning.relationshipGraph : [];
  const allowedTargets = Object.fromEntries(names.map((name) => [
    name,
    [...new Set(relationships.flatMap((relationship) => {
      const from = String(relationship.from || "").trim();
      const to = String(relationship.to || "").trim();
      if (from === name) return [to];
      if (to === name) return [from];
      return [];
    }).filter(Boolean))]
  ]));
  return [
    "\u4E0A\u4E00\u7248 Initial Character State \u672A\u901A\u8FC7\u7A0B\u5E8F\u6821\u9A8C\u3002\u8BF7\u53EA\u4FEE\u590D\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4FDD\u7559\u5DF2\u7ECF\u6B63\u786E\u7684\u5177\u4F53\u5185\u5BB9\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5B8C\u6574\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\u3002",
    `\u51BB\u7ED3\u4EBA\u7269\uFF1A${names.join("\u3001")}`,
    `\u4EBA\u7269\u5361 relationships \u7684\u5141\u8BB8\u76EE\u6807\u6620\u5C04\uFF1A${JSON.stringify(allowedTargets)}`,
    `relationshipStateLedger \u7684\u552F\u4E00\u5408\u6CD5\u6709\u5411\u8FB9\uFF1A${relationships.map((relationship) => `${relationship.from}\u2192${relationship.to}`).join("\u3001")}`,
    "\u4EBA\u7269\u5361 relationships \u662F\u5F53\u524D\u5DF2\u6FC0\u6D3B\u5173\u7CFB\u7684\u5B50\u96C6\uFF1A\u5220\u9664\u6240\u6709\u4E0D\u5728\u5141\u8BB8\u76EE\u6807\u6620\u5C04\u4E2D\u7684\u9879\uFF0C\u4E0D\u8981\u6C42\u8865\u9F50\u5C1A\u672A\u6FC0\u6D3B\u7684\u5173\u7CFB\u3002",
    "relationshipStateLedger \u5FC5\u987B\u9010\u6761\u4FDD\u6301\u4E0A\u8FF0 from/to\uFF0C\u5171\u4E14\u4EC5\u6709\u8FD9\u4E9B\u8FB9\uFF1BhiddenTension \u5FC5\u987B\u7EE7\u627F\u4E0A\u6E38\u89C4\u5212\u7684\u5177\u4F53\u5F20\u529B\uFF0C\u5373\u4F7F\u5C1A\u672A\u89C1\u9762\u4E5F\u4E0D\u80FD\u5199\u2018\u65E0\u2019\u3002",
    "dormant \u6216\u975E\u4EBA\u89D2\u8272\u7684 emotionalState \u8981\u63CF\u8FF0\u5176\u60C5\u611F\u56DE\u8DEF\u3001\u4F11\u7720\u503E\u5411\u6216\u8BA1\u7B97\u72B6\u6001\uFF0C\u4E0D\u80FD\u4EE5\u2018\u65E0\u2019\u5F00\u5934\u3002",
    "\u7A0B\u5E8F\u6821\u9A8C\u9519\u8BEF\uFF1A",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "\u9700\u8981\u4FEE\u590D\u7684\u4E0A\u4E00\u7248 JSON\uFF1A",
    JSON.stringify(result, null, 2)
  ].join("\n");
}
function initialStateCharacters(initialState) {
  return Array.isArray(initialState.characters) ? initialState.characters : [];
}
function openingLocationNames(initialState) {
  const locations = initialStateCharacters(initialState).map((character) => String(character.location || "").trim()).filter(Boolean);
  const openingFrame = initialState.openingFrame && typeof initialState.openingFrame === "object" && !Array.isArray(initialState.openingFrame) ? initialState.openingFrame : {};
  const primaryLocation = String(openingFrame.primaryLocation || "").trim();
  if (primaryLocation) locations.push(primaryLocation);
  return [...new Set(locations)];
}
function continuityLockSources(initialState) {
  const locks = initialState.continuityLocks && typeof initialState.continuityLocks === "object" && !Array.isArray(initialState.continuityLocks) ? initialState.continuityLocks : {};
  return [...new Set(["identityLocks", "locationLocks", "knowledgeLocks", "relationshipLocks", "forbiddenOpeningDrift"].flatMap((key) => Array.isArray(locks[key]) ? locks[key] : []).map((value) => String(value || "").trim()).filter(Boolean))];
}
function buildWorldMatrixPrompts(input, runId) {
  const characters = initialStateCharacters(input.initialCharacterState);
  const names = characters.map((character) => String(character.name || "").trim()).filter(Boolean);
  const locations = openingLocationNames(input.initialCharacterState);
  const worldRules = Array.isArray(input.worldFoundation.worldRules) ? input.worldFoundation.worldRules : [];
  const factions = Array.isArray(input.worldFoundation.factions) ? input.worldFoundation.factions : [];
  const clocks = Array.isArray(input.initialCharacterState.activeClocks) ? input.initialCharacterState.activeClocks : [];
  const knowledgeLocks = Array.isArray(input.initialCharacterState.openingKnowledgeLocks) ? input.initialCharacterState.openingKnowledgeLocks : [];
  const continuityLocks = continuityLockSources(input.initialCharacterState);
  const characterContract = {
    characters: Array.isArray(input.characterPlanning.characters) ? input.characterPlanning.characters.map((character) => ({
      name: character.name,
      role: character.role,
      identity: character.identity,
      narrativeFunction: character.narrativeFunction,
      knowledgeBoundary: character.knowledgeBoundary,
      continuityLocks: character.continuityLocks
    })) : [],
    relationshipGraph: input.characterPlanning.relationshipGraph,
    continuityLocks: input.characterPlanning.continuityLocks,
    expansionRules: input.characterPlanning.expansionRules
  };
  const basePrompt = [
    "\u4F60\u662F\u957F\u7BC7\u5C0F\u8BF4\u4E16\u754C\u77E9\u9635\u67B6\u6784\u5E08\uFF08World Matrix Architect\uFF09\u3002",
    "\u4F60\u53EA\u8D1F\u8D23\u628A\u5DF2\u6279\u51C6\u7684\u4E16\u754C\u57FA\u7840\u3001\u4EBA\u7269\u89C4\u5212\u548C\u7B2C 1 \u7AE0\u4EBA\u7269\u72B6\u6001\uFF0C\u6620\u5C04\u4E3A\u53EF\u6267\u884C\u7684\u4E16\u754C\u77E9\u9635\uFF1B\u4E0D\u5199\u7AE0\u8282\u6B63\u6587\uFF0C\u4E0D\u751F\u6210\u4E3B\u7EBF\u9636\u6BB5\u3001\u7AE0\u8282\u56E0\u679C\u94FE\u3001\u5206\u5377\u6216\u7ED3\u5C40\u65B9\u6848\u3002",
    "\u4E16\u754C\u77E9\u9635\u5FC5\u987B\u56DE\u7B54\uFF1A\u4EBA\u7269\u5728\u54EA\u91CC\u3001\u53D7\u54EA\u4E9B\u89C4\u5219\u7EA6\u675F\u3001\u8C01\u63A7\u5236\u5236\u5EA6\u3001\u8D44\u6E90\u5982\u4F55\u6D41\u52A8\u3001\u8DE8\u5730\u70B9\u8981\u4ED8\u51FA\u4EC0\u4E48\u3001\u538B\u529B\u5982\u4F55\u5347\u7EA7\u3001\u54EA\u4E9B\u77E5\u8BC6\u4E0D\u80FD\u63D0\u524D\u6CC4\u9732\u3002",
    "\u6BCF\u6761\u4E16\u754C\u89C4\u5219\u5FC5\u987B\u4EA7\u751F\u53EF\u89C2\u5BDF\u4FE1\u53F7\u3001\u9009\u62E9\u6210\u672C\u548C\u7834\u574F\u540E\u679C\uFF1B\u6BCF\u4E2A\u5730\u70B9\u5FC5\u987B\u5173\u8054\u89C4\u5219\u3001\u52BF\u529B\u3001\u8D44\u6E90\u3001\u4EBA\u7269\u6216\u538B\u529B\uFF0C\u7981\u6B62\u767E\u79D1\u5F0F\u5B64\u5C9B\u8BBE\u5B9A\u3002",
    "\u4E25\u683C\u51BB\u7ED3\u4EBA\u7269\u96C6\u5408\u3002\u4EFB\u4F55 character\u3001presentCharacters\u3001targetCharacters\u3001holderCharacters\u3001knowers\u3001excludedCharacters \u5B57\u6BB5\u53EA\u80FD\u5F15\u7528\u5DF2\u89C4\u5212\u59D3\u540D\uFF1B\u4E0D\u5F97\u65B0\u589E\u547D\u540D\u4EBA\u7269\u3002",
    "\u5FC5\u987B\u9010\u4E00\u627F\u63A5\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u4E2D\u7684\u5F00\u573A\u5730\u70B9\u3001\u6D3B\u52A8\u5012\u8BA1\u65F6\u548C\u77E5\u8BC6\u9501\uFF0C\u4E0D\u5F97\u5408\u5E76\u540E\u4E22\u5931\u6765\u6E90\uFF1B\u5141\u8BB8\u65B0\u589E\u5730\u70B9\u3001\u673A\u6784\u548C\u8D44\u6E90\uFF0C\u4F46\u5FC5\u987B\u5199\u6E05 derivedBasis\u3002",
    "characterWorldInterfaces \u5FC5\u987B\u6070\u597D\u8986\u76D6\u5168\u90E8\u51BB\u7ED3\u4EBA\u7269\uFF0CopeningLocation \u4E0E presence \u5FC5\u987B\u9010\u5B57\u7EE7\u627F\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u3002",
    "handoffToPlotArchitecture \u53EA\u63D0\u4F9B\u4E0B\u4E00\u9636\u6BB5\u53EF\u6D88\u8D39\u7684\u56E0\u679C\u8F93\u5165\u3001\u9009\u62E9\u3001\u9501\u5B9A\u540E\u679C\u548C\u5347\u7EA7\u8F74\uFF0C\u4E0D\u5F97\u63D0\u524D\u5199 plotArchitecture\u3001chapters\u3001arcPlan \u6216 mainPlot\u3002",
    "continuityAnchors \u5FC5\u987B\u4E0E\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u7684\u8FDE\u7EED\u6027\u9501\u9010\u6761\u4E00\u4E00\u5BF9\u5E94\uFF0Csource \u9010\u5B57\u590D\u5236\u539F\u9501\uFF1B\u4E0D\u5F97\u81EA\u884C\u589E\u52A0\u4EBA\u7269\u6B7B\u4EA1\u3001\u727A\u7272\u3001\u81EA\u6BC1\u3001\u6D17\u767D\u3001\u7EC8\u5C40\u9635\u8425\u6216\u5206\u5F27\u7ED3\u8BBA\u3002",
    "handoffToPlotArchitecture.availableChoices \u4E2D\u7684\u6BCF\u9879\u5FC5\u987B\u662F\u5F53\u524D\u72B6\u6001\u4E0B\u771F\u5B9E\u53EF\u6267\u884C\u7684\u9009\u62E9\uFF0C\u7981\u6B62\u5199\u2018\u4E0D\u53EF\u80FD\u2019\u3001\u5047\u9009\u62E9\u6216\u5DF2\u7ECF\u66FF\u4EBA\u7269\u51B3\u5B9A\u7684\u540E\u7EED\u4E8B\u4EF6\u3002",
    "\u7981\u6B62\u4F7F\u7528\u5F85\u5B9A\u3001\u6682\u65E0\u3001\u672A\u77E5\u3001\u65E0\u3001\u6CA1\u6709\u3001TBD\u3001XXX \u7B49\u5360\u4F4D\u5185\u5BB9\uFF1B\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u56F4\u680F\u6216\u89E3\u91CA\u3002"
  ].join("\n");
  const dynamicPrompt = [
    `\u4EBA\u7269\u521D\u59CB\u72B6\u6001 Run\uFF1A${input.upstreamRunId}`,
    `\u5168\u4E66\u4F53\u91CF\uFF1A${input.totalChapters} \u7AE0`,
    `\u51BB\u7ED3\u4EBA\u7269\uFF08${names.length} \u4EBA\uFF09\uFF1A${names.join("\u3001")}`,
    `\u5FC5\u987B\u8986\u76D6\u7684\u5F00\u573A\u5730\u70B9\uFF08${locations.length} \u4E2A\uFF0CsourceLocation \u5FC5\u987B\u9010\u5B57\u590D\u5236\uFF09\uFF1A${locations.join("\uFF5C")}`,
    `\u5FC5\u987B\u6620\u5C04\u7684\u4E16\u754C\u89C4\u5219\uFF08${worldRules.length} \u6761\uFF09\uFF1A${worldRules.map((rule) => rule.name).join("\u3001")}`,
    `\u5FC5\u987B\u7EE7\u627F\u7684\u5F00\u573A\u5012\u8BA1\u65F6\uFF08${clocks.length} \u6761\uFF09\uFF1A${clocks.map((clock) => clock.name).join("\u3001")}`,
    `\u5FC5\u987B\u7EE7\u627F\u7684\u77E5\u8BC6\u9501\uFF08${knowledgeLocks.length} \u6761\uFF09\uFF1A${knowledgeLocks.map((lock) => lock.fact).join("\uFF5C")}`,
    `\u5FC5\u987B\u9010\u6761\u7EE7\u627F\u7684\u8FDE\u7EED\u6027\u9501\uFF08${continuityLocks.length} \u6761\uFF0CcontinuityAnchors.source \u5FC5\u987B\u9010\u5B57\u590D\u5236\uFF09\uFF1A${continuityLocks.join("\uFF5C")}`,
    `\u672C\u8F6E\u989D\u5916\u5173\u6CE8\uFF1A${input.matrixFocus || "\u8BA9\u6BCF\u4E2A\u5730\u70B9\u3001\u89C4\u5219\u3001\u8D44\u6E90\u4E0E\u4EBA\u7269\u9009\u62E9\u6210\u672C\u5F62\u6210\u53EF\u6267\u884C\u8FDE\u63A5\uFF0C\u5E76\u4E3A\u4E3B\u7EBF\u67B6\u6784\u63D0\u4F9B\u660E\u786E\u4F46\u4E0D\u8D8A\u754C\u7684\u8F93\u5165\u3002"}`,
    "\u5DF2\u6279\u51C6 World Foundation JSON\uFF1A",
    JSON.stringify(input.worldFoundation, null, 2),
    "\u4EBA\u7269\u89C4\u5212\u51BB\u7ED3\u6458\u8981 JSON\uFF1A",
    JSON.stringify(characterContract, null, 2),
    "\u5DF2\u6279\u51C6 Initial Character State JSON\uFF1A",
    JSON.stringify(input.initialCharacterState, null, 2)
  ].join("\n");
  const userMessage = [
    "\u751F\u6210\u5B8C\u6574 World Matrix JSON\uFF0C\u4E25\u683C\u4F7F\u7528\u4EE5\u4E0B\u9876\u5C42\u7ED3\u6784\uFF1A",
    "{",
    '  "version": 1,',
    '  "source": { "initialCharacterStateRunId": "", "characterPlanningRunId": "", "worldFoundationRunId": "", "frozenCharacterNames": [""] },',
    '  "project": { "title": "", "totalChapters": 0, "openingChapter": 1, "matrixPurpose": "" },',
    '  "rules": [{ "id": "", "name": "", "sourceRule": "", "rule": "", "execution": "", "visibleSignal": "", "cost": "", "exceptions": "", "breakConsequence": "", "affectedCharacters": [""] }],',
    '  "locations": [{ "id": "", "name": "", "sourceLocation": "", "derivedBasis": "", "layer": "", "category": "", "openingState": "", "governingRules": [""], "factions": [""], "presentCharacters": [""], "offstagePressure": "", "resources": [""], "accessConditions": [""], "exitCost": "", "storyUse": "" }],',
    '  "factions": [{ "name": "", "sourceFaction": "", "territory": [""], "goal": "", "method": "", "resources": [""], "taboos": [""], "internalPressure": "", "externalPressure": "", "characterInterfaces": [{ "character": "", "status": "", "pressure": "", "availableChoice": "" }] }],',
    '  "institutions": [{ "name": "", "scope": "", "procedure": "", "enforcement": "", "loophole": "", "characterCost": "", "affectedCharacters": [""] }],',
    '  "resources": [{ "name": "", "source": "", "holderCharacters": [""], "holderOrganizations": [""], "location": "", "capability": "", "cost": "", "scarcity": "", "transferRule": "", "conflictUse": "" }],',
    '  "pressureSystems": [{ "name": "", "sourceClock": "", "source": "", "targetCharacters": [""], "currentLevel": "", "escalationClock": "", "visibleEffects": [""], "failureConsequence": "" }],',
    '  "knowledgeBarriers": [{ "sourceFact": "", "fact": "", "knowers": [""], "excludedCharacters": [""], "unlockCondition": "", "prematureLeakConsequence": "" }],',
    '  "characterWorldInterfaces": [{ "character": "", "openingLocation": "", "presence": "onstage|offstage|dormant", "ruleExposure": [""], "resourceAccess": [""], "institutionalStatus": "", "factionPressure": "", "nextWorldAction": "" }],',
    '  "travelAndAccess": [{ "from": "", "to": "", "method": "", "duration": "", "cost": "", "restrictions": [""], "storyUse": "" }],',
    '  "continuityAnchors": [{ "id": "", "source": "", "anchor": "", "verificationSignal": "", "forbiddenDrift": "" }],',
    '  "openingWorldSlice": { "time": "", "primaryLocation": "", "activeLocations": [""], "activeRules": [""], "activeFactions": [""], "activeResources": [""], "activePressures": [""], "chapterOneProofs": [""] },',
    '  "handoffToPlotArchitecture": { "causalInputs": [""], "availableChoices": [""], "lockedConsequences": [""], "escalationAxes": [""], "forbiddenShortcuts": [""] },',
    '  "qualitySelfCheck": { "allOpeningLocationsMapped": true, "allCharactersMapped": true, "allSourceRulesMapped": true, "allClocksMapped": true, "allKnowledgeLocksMapped": true, "noPlotArchitectureGenerated": true, "remainingRisks": [""] }',
    "}",
    `\u786C\u6027\u4EBA\u7269\u96C6\u5408\uFF1AcharacterWorldInterfaces \u5FC5\u987B\u6070\u597D ${names.length} \u4EBA\uFF0C\u59D3\u540D\u53EA\u80FD\u662F\uFF1A${names.join("\u3001")}\u3002`,
    `locations \u81F3\u5C11\u8986\u76D6 ${locations.length} \u4E2A\u51BB\u7ED3\u5F00\u573A\u5730\u70B9\uFF1B\u6BCF\u4E2A\u51BB\u7ED3\u5730\u70B9\u5FC5\u987B\u5728\u67D0\u9879 sourceLocation \u4E2D\u9010\u5B57\u51FA\u73B0\u3002`,
    `rules \u5FC5\u987B\u8986\u76D6\u5168\u90E8 ${worldRules.length} \u6761\u4E0A\u6E38 worldRules\uFF1BsourceRule \u5FC5\u987B\u9010\u5B57\u5F15\u7528\u4E0A\u6E38\u89C4\u5219\u540D\u3002`,
    `pressureSystems \u5FC5\u987B\u8986\u76D6\u5168\u90E8 ${clocks.length} \u6761 activeClocks\uFF1BsourceClock \u5FC5\u987B\u9010\u5B57\u5F15\u7528\u5012\u8BA1\u65F6\u540D\u3002`,
    `knowledgeBarriers \u5FC5\u987B\u8986\u76D6\u5168\u90E8 ${knowledgeLocks.length} \u6761 openingKnowledgeLocks\uFF1BsourceFact \u5FC5\u987B\u9010\u5B57\u5F15\u7528\u539F fact\u3002`,
    `continuityAnchors \u5FC5\u987B\u6070\u597D ${continuityLocks.length} \u6761\uFF0C\u4E0E\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u7684\u8FDE\u7EED\u6027\u9501\u9010\u6761\u5BF9\u5E94\uFF0C\u4E0D\u5F97\u589E\u52A0\u540E\u7EED\u5267\u60C5\u7ED3\u8BBA\u3002`,
    "\u6240\u6709\u4EBA\u7269\u5F15\u7528\u53EA\u80FD\u4F7F\u7528\u51BB\u7ED3\u4EBA\u7269\u59D3\u540D\uFF1B\u7EC4\u7EC7\u3001\u5730\u70B9\u3001\u7CFB\u7EDF\u3001\u5668\u7269\u4E0D\u5F97\u585E\u5165\u4EBA\u7269\u5B57\u6BB5\u3002"
  ].join("\n");
  const consensus = `\u72EC\u7ACB\u8C03\u8BD5 Run: ${runId}
\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u4E0A\u6E38 Run: ${input.upstreamRunId}`;
  const artifactProtocol = [
    "\u751F\u4EA7\u8D44\u4EA7\u751F\u6210\u534F\u8BAE\uFF1A",
    "- \u751F\u6210 phase_5_world_matrix \u4E16\u754C\u77E9\u9635\u8D44\u4EA7\uFF0C\u4E0D\u8FDB\u884C\u5706\u684C\u8BA8\u8BBA\u3002",
    "- \u51BB\u7ED3\u4EBA\u7269\u548C\u5F00\u573A\u72B6\u6001\uFF0C\u4E0D\u6539\u5199\u4E0A\u6E38\uFF0C\u4E0D\u5199\u6B63\u6587\u3002",
    "- \u53EA\u8F93\u51FA\u53EF\u88AB phase_6_plot_architecture \u6D88\u8D39\u7684\u7ED3\u6784\u5316 JSON\u3002"
  ].join("\n");
  const responseContract = [
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u53EA\u80FD\u8F93\u51FA\u5355\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728 world_matrix_debug \u9636\u6BB5\u3002"
  ].join("\n");
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "\u8F93\u51FA\u8BED\u8A00\uFF1A\u7B80\u4F53\u4E2D\u6587", "\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1Aworld_matrix_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n");
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage };
}
function buildWorldMatrixRepairMessage(input, result, errors) {
  const names = initialStateCharacters(input.initialCharacterState).map((character) => String(character.name || "").trim()).filter(Boolean);
  const locations = openingLocationNames(input.initialCharacterState);
  const rules = Array.isArray(input.worldFoundation.worldRules) ? input.worldFoundation.worldRules.map((rule) => String(rule.name || "").trim()).filter(Boolean) : [];
  const clocks = Array.isArray(input.initialCharacterState.activeClocks) ? input.initialCharacterState.activeClocks.map((clock) => String(clock.name || "").trim()).filter(Boolean) : [];
  const facts = Array.isArray(input.initialCharacterState.openingKnowledgeLocks) ? input.initialCharacterState.openingKnowledgeLocks.map((lock) => String(lock.fact || "").trim()).filter(Boolean) : [];
  const continuityLocks = continuityLockSources(input.initialCharacterState);
  return [
    "\u4E0A\u4E00\u7248 World Matrix \u672A\u901A\u8FC7\u7A0B\u5E8F\u6821\u9A8C\u3002\u8BF7\u53EA\u4FEE\u590D\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4FDD\u7559\u5DF2\u7ECF\u6B63\u786E\u7684\u5177\u4F53\u5185\u5BB9\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5B8C\u6574\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\u3002",
    `\u552F\u4E00\u5408\u6CD5\u4EBA\u7269\uFF1A${names.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceLocation\uFF1A${locations.join("\uFF5C")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceRule\uFF1A${rules.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceClock\uFF1A${clocks.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceFact\uFF1A${facts.join("\uFF5C")}`,
    `continuityAnchors.source \u5FC5\u987B\u9010\u5B57\u8986\u76D6\u4E14\u53EA\u80FD\u4F7F\u7528\u4EE5\u4E0B\u8FDE\u7EED\u6027\u9501\uFF1A${continuityLocks.join("\uFF5C")}`,
    "\u4E0D\u5F97\u751F\u6210 plotArchitecture\u3001chapters\u3001arcPlan\u3001mainPlot\uFF1B\u4E0D\u5F97\u5728\u4EBA\u7269\u5B57\u6BB5\u4E2D\u653E\u5165\u7EC4\u7EC7\u3001\u7CFB\u7EDF\u6216\u5668\u7269\u3002",
    "\u5220\u9664\u81EA\u884C\u51B3\u5B9A\u7684\u4EBA\u7269\u6B7B\u4EA1\u3001\u727A\u7272\u3001\u81EA\u6BC1\u3001\u6D17\u767D\u3001\u7EC8\u5C40\u9635\u8425\u3001\u5206\u5F27\u7ED3\u8BBA\uFF1BavailableChoices \u53EA\u80FD\u4FDD\u7559\u5F53\u524D\u53EF\u6267\u884C\u9009\u62E9\uFF0C\u4E0D\u5F97\u5305\u542B\u2018\u4E0D\u53EF\u80FD\u2019\u6216\u5047\u9009\u62E9\u3002",
    "\u7A0B\u5E8F\u6821\u9A8C\u9519\u8BEF\uFF1A",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "\u9700\u8981\u4FEE\u590D\u7684\u4E0A\u4E00\u7248 JSON\uFF1A",
    JSON.stringify(result, null, 2)
  ].join("\n");
}
function plotArchitectureArcTarget(totalChapters) {
  return Math.max(4, Math.min(10, Math.ceil(totalChapters / 60)));
}
function plotArchitectureProtagonist(characterPlanning) {
  const characters = Array.isArray(characterPlanning.characters) ? characterPlanning.characters : [];
  const explicit = characters.find((character) => /主角|protagonist/iu.test(String(character.role || "")));
  return String(explicit?.name || characters[0]?.name || "").trim();
}
function plotSourceNames(source, key, field) {
  return Array.isArray(source[key]) ? source[key].map((entry) => String(entry?.[field] || "").trim()).filter(Boolean) : [];
}
function buildPlotArchitecturePrompts(input, runId) {
  const characters = plannedCharacterNames(input.characterPlanning);
  const protagonist = plotArchitectureProtagonist(input.characterPlanning);
  const sourcePressures = plotSourceNames(input.worldMatrix, "pressureSystems", "name");
  const sourceAnchorIds = plotSourceNames(input.worldMatrix, "continuityAnchors", "id");
  const sourceSubplots = plotSourceNames(input.worldFoundation, "subplots", "name");
  const sourceForeshadowing = plotSourceNames(input.worldFoundation, "foreshadowing", "seed");
  const arcTarget = plotArchitectureArcTarget(input.totalChapters);
  const handoff = input.worldMatrix.handoffToPlotArchitecture && typeof input.worldMatrix.handoffToPlotArchitecture === "object" && !Array.isArray(input.worldMatrix.handoffToPlotArchitecture) ? input.worldMatrix.handoffToPlotArchitecture : {};
  const compactFoundation = {
    project: input.worldFoundation.project,
    mainPlot: input.worldFoundation.mainPlot,
    subplots: input.worldFoundation.subplots,
    foreshadowing: input.worldFoundation.foreshadowing,
    arcPlan: input.worldFoundation.arcPlan,
    worldRules: input.worldFoundation.worldRules
  };
  const compactInitialState = {
    openingFrame: input.initialCharacterState.openingFrame,
    activeClocks: input.initialCharacterState.activeClocks,
    openingKnowledgeLocks: input.initialCharacterState.openingKnowledgeLocks
  };
  const basePrompt = [
    "\u4F60\u662F\u8D44\u6DF1\u957F\u7BC7\u5C0F\u8BF4\u4E3B\u7EBF\u67B6\u6784\u5E08\uFF08Plot Architecture Showrunner\uFF09\u3002",
    "\u4F60\u53EA\u8D1F\u8D23 phase_6_plot_architecture\uFF1A\u628A\u5DF2\u51BB\u7ED3\u7684\u4E16\u754C\u77E9\u9635\u4EA4\u63A5\u5305\u8F6C\u5316\u4E3A\u5168\u4E66\u4E3B\u7EBF\u56E0\u679C\u67B6\u6784\uFF0C\u4E0D\u5199\u6B63\u6587\uFF0C\u4E0D\u751F\u6210\u6545\u4E8B\u5723\u7ECF\u3001\u5206\u5377\u7B56\u7565\u6216\u9010\u7AE0\u84DD\u56FE\u3002",
    "\u4E3B\u7EBF\u4E0D\u662F\u4E8B\u4EF6\u5217\u8868\u3002\u6BCF\u4E00\u5F27\u5FC5\u987B\u5F62\u6210\uFF1A\u4E0A\u6E38\u538B\u529B \u2192 \u4E3B\u89D2\u76EE\u6807 \u2192 \u53EF\u6267\u884C\u9009\u62E9 \u2192 \u4ED8\u51FA\u4EE3\u4EF7 \u2192 \u4E0D\u53EF\u9006\u53D8\u5316 \u2192 \u4E0B\u4E00\u5F27\u63A5\u68D2\u3002",
    "\u5FC5\u987B\u8986\u76D6\u5168\u4E66\u7AE0\u8282\u8303\u56F4\uFF0C\u5F27\u7EBF\u533A\u95F4\u8FDE\u7EED\u3001\u65E0\u91CD\u53E0\u3001\u65E0\u7A7A\u6D1E\uFF1B\u53EF\u4EE5\u51B3\u5B9A\u5B8F\u89C2\u5F27\u7EBF\u548C\u7ED3\u5C40\u5951\u7EA6\uFF0C\u4F46\u4E0D\u5F97\u5199\u9010\u7AE0\u573A\u666F\u6216\u7AE0\u8282\u6B63\u6587\u3002",
    "\u4E25\u683C\u7EE7\u627F\u51BB\u7ED3\u4EBA\u7269\uFF0C\u4E0D\u65B0\u589E\u3001\u6539\u540D\u6216\u5408\u5E76\u4EBA\u7269\uFF1B\u6BCF\u540D\u4EBA\u7269\u90FD\u5FC5\u987B\u7ED1\u5B9A\u5230\u4E3B\u7EBF\u53D8\u5316\uFF0C\u800C\u4E0D\u662F\u53EA\u5217\u59D3\u540D\u3002",
    "\u4E16\u754C\u77E9\u9635\u7684\u538B\u529B\u7CFB\u7EDF\u3001\u8FDE\u7EED\u6027\u951A\u70B9\u3001\u53EF\u7528\u9009\u62E9\u3001\u9501\u5B9A\u540E\u679C\u548C\u7981\u6B62\u6377\u5F84\u90FD\u5FC5\u987B\u88AB\u663E\u5F0F\u6D88\u8D39\u6216\u4FDD\u6301\u3002",
    "\u4F0F\u7B14\u548C\u652F\u7EBF\u5FC5\u987B\u58F0\u660E\u8FDB\u5165\u54EA\u4E00\u5F27\u3001\u5982\u4F55\u6539\u53D8\u56E0\u679C\u3001\u4F55\u65F6\u5151\u73B0\u6216\u7EE7\u7EED\u4FDD\u7559\uFF0C\u7981\u6B62\u53EA\u590D\u5236\u4E0A\u6E38\u539F\u6587\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\uFF0C\u4E0D\u8981\u89E3\u91CA\u751F\u6210\u8FC7\u7A0B\u3002"
  ].join("\n");
  const dynamicPrompt = [
    `\u4E16\u754C\u77E9\u9635 Run\uFF1A${input.upstreamRunId}`,
    `\u5168\u4E66\u4F53\u91CF\uFF1A${input.totalChapters} \u7AE0`,
    `\u4E3B\u89D2\uFF1A${protagonist}`,
    `\u51BB\u7ED3\u4EBA\u7269\uFF08${characters.length} \u4EBA\uFF09\uFF1A${characters.join("\u3001")}`,
    `\u4E3B\u7EBF\u5F27\u7EBF\u6570\u91CF\uFF1A\u5FC5\u987B\u6070\u597D ${arcTarget} \u5F27`,
    `\u4E16\u754C\u538B\u529B\uFF08${sourcePressures.length} \u9879\uFF09\uFF1A${sourcePressures.join("\uFF5C")}`,
    `\u8FDE\u7EED\u6027\u951A\u70B9\uFF08${sourceAnchorIds.length} \u9879\uFF09\uFF1A${sourceAnchorIds.join("\u3001")}`,
    `\u4E0A\u6E38\u652F\u7EBF\uFF08${sourceSubplots.length} \u9879\uFF09\uFF1A${sourceSubplots.join("\uFF5C")}`,
    `\u4E0A\u6E38\u4F0F\u7B14\uFF08${sourceForeshadowing.length} \u9879\uFF09\u5FC5\u987B\u9010\u6761\u8FDB\u5165\u4F0F\u7B14\u8BA1\u5212\u3002`,
    `\u672C\u8F6E\u989D\u5916\u5173\u6CE8\uFF1A${input.architectureFocus || "\u68C0\u67E5\u957F\u7BC7\u4E2D\u6BB5\u662F\u5426\u91CD\u590D\uFF0C\u786E\u4FDD\u6BCF\u4E00\u5F27\u90FD\u6539\u53D8\u4EBA\u7269\u3001\u5173\u7CFB\u3001\u4E16\u754C\u538B\u529B\u6216\u771F\u76F8\u7ED3\u6784\u3002"}`,
    "\u4E16\u754C\u77E9\u9635\u4EA4\u63A5\u5305\uFF1A",
    JSON.stringify(handoff, null, 2),
    "\u5B8C\u6574 World Matrix JSON\uFF1A",
    JSON.stringify(input.worldMatrix, null, 2),
    "\u51BB\u7ED3 Character Planning JSON\uFF1A",
    JSON.stringify(input.characterPlanning, null, 2),
    "\u5F00\u573A\u72B6\u6001\u6458\u8981\uFF1A",
    JSON.stringify(compactInitialState, null, 2),
    "World Foundation \u4E3B\u7EBF\u6765\u6E90\u6458\u8981\uFF1A",
    JSON.stringify(compactFoundation, null, 2)
  ].join("\n");
  const userMessage = [
    "\u751F\u6210\u5B8C\u6574 Plot Architecture JSON\uFF0C\u4E25\u683C\u4F7F\u7528\u4EE5\u4E0B\u9876\u5C42\u7ED3\u6784\uFF1A",
    "{",
    '  "version": 1,',
    '  "source": { "worldMatrixRunId": "", "phase": "phase_5_world_matrix", "frozenCharacterNames": [""], "sourcePressureNames": [""], "sourceContinuityAnchorIds": [""] },',
    '  "project": { "title": "", "totalChapters": 0, "protagonist": "", "architecturePurpose": "" },',
    '  "storyPromise": { "logline": "", "centralDramaticQuestion": "", "readerPromise": "", "themeArgument": "", "endingDirection": "", "nonNegotiables": [""] },',
    '  "mainline": { "externalGoal": "", "internalNeed": "", "centralConflict": "", "oppositionLogic": "", "falseVictory": "", "darkestPoint": "", "climaxChoice": "", "endingState": "" },',
    '  "arcArchitecture": [{ "id": "arc_01", "name": "", "startChapter": 1, "endChapter": 1, "sourceCausalInputs": [""], "openingState": "", "protagonistObjective": "", "drivingChoice": "", "opposition": "", "midpointReversal": "", "cost": "", "irreversibleOutcome": "", "nextHandoff": "", "escalationAxes": [""] }],',
    '  "characterArcBindings": [{ "character": "", "startState": "", "desire": "", "mainlineFunction": "", "pressure": "", "turningPoints": [{ "arcId": "", "change": "", "cost": "" }], "endState": "" }],',
    '  "pressureEscalation": [{ "sourcePressure": "", "arcStages": [{ "arcId": "", "level": "", "visibleEffect": "", "consequence": "" }] }],',
    '  "continuityPlan": [{ "sourceAnchorId": "", "firstUseArcId": "", "verification": "", "payoffOrPersistence": "", "forbiddenDrift": "" }],',
    '  "subplotPlan": [{ "sourceSubplot": "", "entryArcId": "", "turnArcIds": [""], "causalFunction": "", "mainlineCollision": "", "resolutionArcId": "", "resolutionCost": "" }],',
    '  "foreshadowingPlan": [{ "sourceSeed": "", "plantArcId": "", "advanceArcIds": [""], "payoffArcId": "", "payoffAction": "", "readerEffect": "" }],',
    '  "endingContract": { "climaxChoice": "", "paidCosts": [""], "resolvedPromises": [""], "intentionallyOpen": [""], "finalWorldState": "", "noDeusExMachinaProof": "" },',
    '  "handoffToStoryBible": { "lockedMainline": [""], "characterStateRequirements": [""], "canonicalTerms": [""], "continuityRules": [""], "unresolvedRisks": [""] },',
    '  "qualitySelfCheck": { "continuousChapterCoverage": true, "allCharactersBound": true, "allPressuresEscalated": true, "allContinuityAnchorsScheduled": true, "noLaterPhaseAssetsGenerated": true, "remainingRisks": [""] }',
    "}",
    `arcArchitecture \u5FC5\u987B\u6070\u597D ${arcTarget} \u5F27\uFF1B\u4ECE\u7B2C 1 \u7AE0\u8FDE\u7EED\u8986\u76D6\u5230\u7B2C ${input.totalChapters} \u7AE0\uFF0C\u533A\u95F4\u4E0D\u5F97\u91CD\u53E0\u6216\u7559\u7A7A\u3002`,
    `characterArcBindings \u5FC5\u987B\u6070\u597D ${characters.length} \u4EBA\uFF0C\u59D3\u540D\u53EA\u80FD\u662F\uFF1A${characters.join("\u3001")}\u3002`,
    `pressureEscalation.sourcePressure \u5FC5\u987B\u9010\u5B57\u8986\u76D6\uFF1A${sourcePressures.join("\uFF5C")}\u3002`,
    `continuityPlan.sourceAnchorId \u5FC5\u987B\u9010\u5B57\u8986\u76D6 ${sourceAnchorIds.length} \u4E2A\u951A\u70B9 ID\uFF1A${sourceAnchorIds.join("\u3001")}\u3002`,
    `subplotPlan.sourceSubplot \u5FC5\u987B\u9010\u5B57\u8986\u76D6\uFF1A${sourceSubplots.join("\uFF5C") || "\u65E0\u4E0A\u6E38\u652F\u7EBF"}\u3002`,
    "foreshadowingPlan.sourceSeed \u5FC5\u987B\u9010\u5B57\u7EE7\u627F\u6BCF\u6761\u4E0A\u6E38 seed\uFF0C\u4E0D\u5F97\u7F29\u5199\u3001\u6539\u5199\u6216\u9057\u6F0F\u3002",
    "\u4E0D\u5F97\u8F93\u51FA storyBible\u3001volumeStrategy\u3001chapterBlueprints\u3001chapters \u6216\u6B63\u6587\u6BB5\u843D\uFF1B\u8FD9\u4E9B\u5C5E\u4E8E\u540E\u7EED\u9636\u6BB5\u3002"
  ].join("\n");
  const consensus = `\u72EC\u7ACB\u8C03\u8BD5 Run: ${runId}
\u4E16\u754C\u77E9\u9635\u4E0A\u6E38 Run: ${input.upstreamRunId}`;
  const artifactProtocol = [
    "\u751F\u4EA7\u8D44\u4EA7\u751F\u6210\u534F\u8BAE\uFF1A",
    "- \u751F\u6210 phase_6_plot_architecture \u4E3B\u7EBF\u67B6\u6784\u8D44\u4EA7\uFF0C\u4E0D\u8FDB\u884C\u5706\u684C\u8BA8\u8BBA\u3002",
    "- \u53EA\u5B89\u6392\u5B8F\u89C2\u56E0\u679C\u5F27\u3001\u4EBA\u7269\u53D8\u5316\u3001\u538B\u529B\u5347\u7EA7\u3001\u951A\u70B9\u548C\u4F0F\u7B14\uFF0C\u4E0D\u5199\u6B63\u6587\u3002",
    "- \u8F93\u51FA\u5FC5\u987B\u80FD\u88AB phase_7_story_bible \u76F4\u63A5\u6D88\u8D39\u3002"
  ].join("\n");
  const responseContract = [
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u53EA\u80FD\u8F93\u51FA\u5355\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728 plot_architecture_debug \u9636\u6BB5\u3002"
  ].join("\n");
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "\u8F93\u51FA\u8BED\u8A00\uFF1A\u7B80\u4F53\u4E2D\u6587", "\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1Aplot_architecture_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n");
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage };
}
function buildPlotArchitectureRepairMessage(input, result, errors) {
  const characters = plannedCharacterNames(input.characterPlanning);
  const pressures = plotSourceNames(input.worldMatrix, "pressureSystems", "name");
  const anchors = plotSourceNames(input.worldMatrix, "continuityAnchors", "id");
  const subplots = plotSourceNames(input.worldFoundation, "subplots", "name");
  const seeds = plotSourceNames(input.worldFoundation, "foreshadowing", "seed");
  return [
    "\u4E0A\u4E00\u7248 Plot Architecture \u672A\u901A\u8FC7\u7A0B\u5E8F\u6821\u9A8C\u3002\u8BF7\u53EA\u4FEE\u590D\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4FDD\u7559\u5DF2\u7ECF\u6B63\u786E\u7684\u5177\u4F53\u5185\u5BB9\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5B8C\u6574\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\u3002",
    `\u5FC5\u987B\u6070\u597D ${plotArchitectureArcTarget(input.totalChapters)} \u5F27\uFF0C\u5E76\u4ECE\u7B2C 1 \u7AE0\u8FDE\u7EED\u8986\u76D6\u5230\u7B2C ${input.totalChapters} \u7AE0\u3002`,
    `\u552F\u4E00\u5408\u6CD5\u4EBA\u7269\uFF1A${characters.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourcePressure\uFF1A${pressures.join("\uFF5C")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceAnchorId\uFF1A${anchors.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceSubplot\uFF1A${subplots.join("\uFF5C")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceSeed\uFF1A${seeds.join("\uFF5C")}`,
    "\u4E0D\u5F97\u751F\u6210 storyBible\u3001volumeStrategy\u3001chapterBlueprints\u3001chapters \u6216\u6B63\u6587\u3002",
    "\u7A0B\u5E8F\u6821\u9A8C\u9519\u8BEF\uFF1A",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "\u9700\u8981\u4FEE\u590D\u7684\u4E0A\u4E00\u7248 JSON\uFF1A",
    JSON.stringify(result, null, 2)
  ].join("\n");
}
function storyBibleSourceRecords(source, key) {
  return Array.isArray(source[key]) ? source[key] : [];
}
function storyBibleRelationshipKeys(characterPlanning) {
  return storyBibleSourceRecords(characterPlanning, "relationshipGraph").map((edge) => `${String(edge.from || "").trim()}\u2192${String(edge.to || "").trim()}`).filter((edge) => edge !== "\u2192");
}
function storyBibleCanonicalTermName(value) {
  const source = value.trim();
  const separatorIndex = source.search(/[：:]/u);
  return separatorIndex > 0 ? source.slice(0, separatorIndex).trim() : source;
}
function buildStoryBiblePrompts(input, runId) {
  const characters = plannedCharacterNames(input.characterPlanning);
  const protagonist = plotArchitectureProtagonist(input.characterPlanning);
  const arcs = storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture");
  const arcIds = arcs.map((arc) => String(arc.id || "").trim()).filter(Boolean);
  const continuityIds = storyBibleSourceRecords(input.plotArchitecture, "continuityPlan").map((entry) => String(entry.sourceAnchorId || "").trim()).filter(Boolean);
  const relationshipKeys = storyBibleRelationshipKeys(input.characterPlanning);
  const rules = plotSourceNames(input.worldMatrix, "rules", "name");
  const locations = plotSourceNames(input.worldMatrix, "locations", "name");
  const promiseSeeds = plotSourceNames(input.plotArchitecture, "foreshadowingPlan", "sourceSeed");
  const handoff = input.plotArchitecture.handoffToStoryBible && typeof input.plotArchitecture.handoffToStoryBible === "object" && !Array.isArray(input.plotArchitecture.handoffToStoryBible) ? input.plotArchitecture.handoffToStoryBible : {};
  const compactCharacters = storyBibleSourceRecords(input.characterPlanning, "characters").map((character) => ({
    name: character.name,
    role: character.role,
    identity: character.identity,
    narrativeFunction: character.narrativeFunction,
    desire: character.desire,
    wound: character.wound,
    fear: character.fear,
    misbelief: character.misbelief,
    secret: character.secret,
    values: character.values,
    behaviorHabits: character.behaviorHabits,
    speechPattern: character.speechPattern,
    skills: character.skills,
    limitations: character.limitations,
    knowledgeBoundary: character.knowledgeBoundary,
    continuityLocks: character.continuityLocks
  }));
  const compactWorld = {
    rules: input.worldMatrix.rules,
    locations: input.worldMatrix.locations,
    factions: input.worldMatrix.factions,
    institutions: input.worldMatrix.institutions,
    resources: input.worldMatrix.resources,
    pressureSystems: input.worldMatrix.pressureSystems,
    knowledgeBarriers: input.worldMatrix.knowledgeBarriers
  };
  const basePrompt = [
    "\u4F60\u662F\u957F\u7BC7\u5C0F\u8BF4\u6545\u4E8B\u5723\u7ECF\u603B\u7F16\uFF08Story Bible Canon Editor\uFF09\u3002",
    "\u4F60\u53EA\u8D1F\u8D23 phase_7_story_bible\uFF1A\u628A\u5DF2\u901A\u8FC7\u7684\u4E3B\u7EBF\u67B6\u6784\u4E0E\u51BB\u7ED3\u4E0A\u6E38\u6574\u7406\u6210\u5168\u9879\u76EE\u552F\u4E00\u7684\u6B63\u5178\u53C2\u8003\uFF0C\u4E0D\u91CD\u65B0\u89C4\u5212\u4E3B\u7EBF\uFF0C\u4E0D\u5199\u5206\u5377\u7B56\u7565\u3001\u9010\u7AE0\u84DD\u56FE\u6216\u6B63\u6587\u3002",
    "\u6545\u4E8B\u5723\u7ECF\u5FC5\u987B\u56DE\u7B54\u2018\u4EC0\u4E48\u6C38\u8FDC\u4E0D\u80FD\u6F02\u79FB\u2019\uFF1A\u4E16\u754C\u89C4\u5219\u53CA\u6210\u672C\u3001\u5730\u70B9\u4E0E\u52BF\u529B\u8FB9\u754C\u3001\u4EBA\u7269\u8EAB\u4EFD\u4E0E\u58F0\u97F3\u3001\u5173\u7CFB\u65B9\u5411\u3001\u5F27\u7EBF\u72B6\u6001\u3001\u4E13\u6709\u540D\u8BCD\u3001\u77E5\u8BC6\u8FB9\u754C\u3001\u8FDE\u7EED\u6027\u951A\u70B9\u3001\u627F\u8BFA\u4E0E\u7ED3\u5C40\u5951\u7EA6\u3002",
    "\u6240\u6709\u6761\u76EE\u5FC5\u987B\u53EF\u9A8C\u8BC1\uFF1B\u7981\u6B62\u53EA\u5199\u2018\u4FDD\u6301\u4E00\u81F4\u2019\u3001\u2018\u9075\u5FAA\u4E0A\u6E38\u2019\u6216\u590D\u5236\u7A7A\u6CDB\u539F\u5219\u3002\u6BCF\u6761\u5FC5\u987B\u7ED9\u51FA\u68C0\u67E5\u4FE1\u53F7\u548C\u7981\u6B62\u6F02\u79FB\u9879\u3002",
    "\u4E25\u683C\u7EE7\u627F\u51BB\u7ED3\u4EBA\u7269\u3001\u5173\u7CFB\u65B9\u5411\u3001\u5F27 ID\u3001\u8FDE\u7EED\u6027\u951A\u70B9 ID\u3001\u89C4\u5219\u540D\u3001\u5730\u70B9\u540D\u548C\u4F0F\u7B14\u79CD\u5B50\uFF0C\u4E0D\u65B0\u589E\u6216\u6539\u540D\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\uFF0C\u4E0D\u8981\u89E3\u91CA\u751F\u6210\u8FC7\u7A0B\u3002"
  ].join("\n");
  const dynamicPrompt = [
    `\u4E3B\u7EBF\u67B6\u6784 Run\uFF1A${input.upstreamRunId}`,
    `\u5168\u4E66\u4F53\u91CF\uFF1A${input.totalChapters} \u7AE0`,
    `\u51BB\u7ED3\u4E3B\u89D2\uFF1A${protagonist}`,
    `\u51BB\u7ED3\u4EBA\u7269\uFF08${characters.length} \u4EBA\uFF09\uFF1A${characters.join("\u3001")}`,
    `\u51BB\u7ED3\u5173\u7CFB\uFF08${relationshipKeys.length} \u6761\uFF09\uFF1A${relationshipKeys.join("\u3001")}`,
    `\u4E3B\u7EBF\u5F27\uFF08${arcIds.length} \u6761\uFF09\uFF1A${arcIds.join("\u3001")}`,
    `\u8FDE\u7EED\u6027\u951A\u70B9\uFF08${continuityIds.length} \u6761\uFF09\uFF1A${continuityIds.join("\u3001")}`,
    `\u4E16\u754C\u89C4\u5219\uFF08${rules.length} \u6761\uFF09\uFF1A${rules.join("\u3001")}`,
    `\u5730\u70B9\uFF08${locations.length} \u4E2A\uFF09\uFF1A${locations.join("\u3001")}`,
    `\u4F0F\u7B14\u627F\u8BFA\uFF08${promiseSeeds.length} \u6761\uFF09\u5FC5\u987B\u9010\u6761\u8FDB\u5165\u627F\u8BFA\u8D26\u672C\u3002`,
    `\u672C\u8F6E\u989D\u5916\u5173\u6CE8\uFF1A${input.bibleFocus || "\u628A\u6240\u6709\u4E0D\u53EF\u6F02\u79FB\u4E8B\u5B9E\u53D8\u6210\u53EF\u68C0\u67E5\u7684\u6B63\u5178\u6761\u76EE\uFF0C\u91CD\u70B9\u6D88\u9664\u4EBA\u7269\u58F0\u97F3\u3001\u672F\u8BED\u3001\u77E5\u8BC6\u8FB9\u754C\u548C\u4EE3\u4EF7\u89C4\u5219\u7684\u6B67\u4E49\u3002"}`,
    "\u4E3B\u7EBF\u67B6\u6784\u4EA4\u63A5\u5305\uFF1A",
    JSON.stringify(handoff, null, 2),
    "\u5B8C\u6574 Plot Architecture JSON\uFF1A",
    JSON.stringify(input.plotArchitecture, null, 2),
    "\u4EBA\u7269\u6863\u6848\u6458\u8981\uFF1A",
    JSON.stringify(compactCharacters, null, 2),
    "\u51BB\u7ED3\u5173\u7CFB\u7F51\uFF1A",
    JSON.stringify(input.characterPlanning.relationshipGraph, null, 2),
    "\u4E16\u754C\u77E9\u9635\u6B63\u5178\u6765\u6E90\uFF1A",
    JSON.stringify(compactWorld, null, 2),
    "\u5F00\u573A\u72B6\u6001\uFF1A",
    JSON.stringify(input.initialCharacterState.openingFrame, null, 2),
    "\u9879\u76EE\u4E0E\u80CC\u666F\u6765\u6E90\uFF1A",
    JSON.stringify({ project: input.worldFoundation.project, background: input.worldFoundation.background }, null, 2)
  ].join("\n");
  const userMessage = [
    "\u751F\u6210\u5B8C\u6574 Story Bible JSON\uFF0C\u4E25\u683C\u4F7F\u7528\u4EE5\u4E0B\u9876\u5C42\u7ED3\u6784\uFF1A",
    "{",
    '  "version": 1,',
    '  "source": { "plotArchitectureRunId": "", "phase": "phase_6_plot_architecture", "frozenCharacterNames": [""], "sourceArcIds": [""], "sourceContinuityAnchorIds": [""] },',
    '  "project": { "title": "", "genre": "", "totalChapters": 0, "protagonist": "", "logline": "", "readerPromise": "", "themeArgument": "" },',
    '  "canonPolicy": { "authorityOrder": [""], "nonNegotiables": [""], "changeControl": [""], "forbiddenShortcuts": [""] },',
    '  "worldCanon": { "rules": [{ "sourceName": "", "canonicalRule": "", "visibleSignals": [""], "cost": "", "exceptionBoundary": "", "forbiddenDrift": "" }], "locations": [{ "sourceName": "", "identity": "", "controllingForces": [""], "accessConstraints": [""], "storyFunction": "", "forbiddenDrift": "" }], "factions": [{ "sourceName": "", "goal": "", "methods": [""], "resources": [""], "internalConflict": "", "forbiddenDrift": "" }], "institutions": [{ "sourceName": "", "scope": "", "procedure": "", "enforcement": "", "loophole": "", "forbiddenDrift": "" }], "resources": [{ "sourceName": "", "capability": "", "cost": "", "scarcity": "", "transferRule": "", "forbiddenDrift": "" }], "knowledgeBoundaries": [{ "sourceFact": "", "knowers": [""], "excludedCharacters": [""], "unlockCondition": "", "prematureLeakConsequence": "" }] },',
    '  "characterCanon": [{ "character": "", "identity": "", "role": "", "desire": "", "woundOrFear": "", "misbelief": "", "voice": "", "behaviorMarkers": [""], "abilities": [""], "limitationsAndCosts": [""], "knowledgeBoundary": [""], "mainlineFunction": "", "arcStateRequirements": [{ "arcId": "", "requiredState": "", "forbiddenState": "" }], "forbiddenDrift": [""] }],',
    '  "relationshipCanon": [{ "sourceEdge": "\u4EBA\u7269A\u2192\u4EBA\u7269B", "type": "", "surfaceState": "", "hiddenTension": "", "evolutionRule": "", "breakingPoint": "", "forbiddenDrift": "" }],',
    '  "arcCanon": [{ "sourceArcId": "", "startChapter": 1, "endChapter": 1, "openingState": "", "requiredChoice": "", "requiredCost": "", "irreversibleOutcome": "", "exitState": "", "forbiddenDrift": "" }],',
    '  "terminology": [{ "sourceTerm": "", "canonicalMeaning": "", "usageRule": "", "forbiddenVariants": [""] }],',
    '  "continuityCanon": [{ "sourceAnchorId": "", "canonicalConstraint": "", "verificationSignal": "", "payoffOrPersistence": "", "forbiddenDrift": "" }],',
    '  "promiseLedger": [{ "sourceSeed": "", "surfacePromise": "", "truePromise": "", "advanceArcIds": [""], "payoffArcId": "", "payoffEvidence": "", "forbiddenDrift": "" }],',
    '  "endingCanon": { "climaxChoice": "", "paidCosts": [""], "resolvedPromises": [""], "intentionallyOpen": [""], "finalWorldState": "", "forbiddenRetcons": [""] },',
    '  "handoffToVolumeStrategy": { "immutableArcOrder": [""], "allowedVolumeBreaks": [""], "pacingRisks": [""], "characterCoverageRules": [""], "immutablePayoffs": [""], "unresolvedRisks": [""] },',
    '  "qualitySelfCheck": { "allCharactersCanonicalized": true, "allRelationshipsCanonicalized": true, "allArcsCanonicalized": true, "allContinuityAnchorsCanonicalized": true, "allPromisesTracked": true, "noLaterPhaseAssetsGenerated": true, "remainingRisks": [""] }',
    "}",
    `characterCanon \u5FC5\u987B\u6070\u597D ${characters.length} \u4EBA\uFF0C\u59D3\u540D\u53EA\u80FD\u662F\uFF1A${characters.join("\u3001")}\u3002`,
    `relationshipCanon.sourceEdge \u5FC5\u987B\u9010\u5B57\u8986\u76D6 ${relationshipKeys.length} \u6761\u6709\u5411\u5173\u7CFB\uFF1A${relationshipKeys.join("\u3001")}\u3002`,
    `arcCanon.sourceArcId \u5FC5\u987B\u9010\u5B57\u8986\u76D6\uFF1A${arcIds.join("\u3001")}\uFF0C\u7AE0\u8282\u8FB9\u754C\u5FC5\u987B\u4E0E\u4E0A\u6E38\u5B8C\u5168\u4E00\u81F4\u3002`,
    `worldCanon.rules.sourceName \u5FC5\u987B\u9010\u5B57\u8986\u76D6\uFF1A${rules.join("\u3001")}\u3002`,
    `worldCanon.locations.sourceName \u5FC5\u987B\u9010\u5B57\u8986\u76D6\uFF1A${locations.join("\u3001")}\u3002`,
    `continuityCanon.sourceAnchorId \u5FC5\u987B\u9010\u5B57\u8986\u76D6\u5168\u90E8 ${continuityIds.length} \u4E2A\u951A\u70B9\u3002`,
    "terminology.sourceTerm \u5FC5\u987B\u9010\u5B57\u8986\u76D6\u4E3B\u7EBF\u4EA4\u63A5\u5305 canonicalTerms \u4E2D\u5192\u53F7\u524D\u7684\u672F\u8BED\u540D\uFF1B\u5192\u53F7\u540E\u7684\u5B9A\u4E49\u3001\u6570\u503C\u548C\u9650\u5236\u5FC5\u987B\u5199\u5165\u5BF9\u5E94 canonicalMeaning \u6216 usageRule\u3002",
    "promiseLedger.sourceSeed \u5FC5\u987B\u9010\u5B57\u8986\u76D6\u5168\u90E8\u4E0A\u6E38\u4F0F\u7B14\u79CD\u5B50\u3002",
    "\u4E0D\u5F97\u8F93\u51FA volumeStrategy\u3001chapterBlueprints\u3001chapters\u3001chapterDrafts \u6216\u6B63\u6587\u3002"
  ].join("\n");
  const consensus = `\u72EC\u7ACB\u8C03\u8BD5 Run: ${runId}
\u4E3B\u7EBF\u67B6\u6784\u4E0A\u6E38 Run: ${input.upstreamRunId}`;
  const artifactProtocol = [
    "\u751F\u4EA7\u8D44\u4EA7\u751F\u6210\u534F\u8BAE\uFF1A",
    "- \u751F\u6210 phase_7_story_bible \u6B63\u5178\u8D44\u4EA7\uFF0C\u4E0D\u8FDB\u884C\u5706\u684C\u8BA8\u8BBA\u3002",
    "- \u51BB\u7ED3\u5DF2\u6279\u51C6\u4E8B\u5B9E\uFF0C\u4E0D\u91CD\u5199\u4E3B\u7EBF\uFF0C\u4E0D\u65B0\u589E\u4E3B\u8981\u4EBA\u7269\u3002",
    "- \u8F93\u51FA\u5FC5\u987B\u80FD\u88AB phase_8_volume_strategy \u76F4\u63A5\u6D88\u8D39\u3002"
  ].join("\n");
  const responseContract = [
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u53EA\u80FD\u8F93\u51FA\u5355\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728 story_bible_debug \u9636\u6BB5\u3002"
  ].join("\n");
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "\u8F93\u51FA\u8BED\u8A00\uFF1A\u7B80\u4F53\u4E2D\u6587", "\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1Astory_bible_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n");
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage };
}
function buildStoryBibleRepairMessage(input, result, errors) {
  const characters = plannedCharacterNames(input.characterPlanning);
  const relationships = storyBibleRelationshipKeys(input.characterPlanning);
  const arcIds = plotSourceNames(input.plotArchitecture, "arcArchitecture", "id");
  const continuityIds = plotSourceNames(input.plotArchitecture, "continuityPlan", "sourceAnchorId");
  const ruleNames = plotSourceNames(input.worldMatrix, "rules", "name");
  const locationNames = plotSourceNames(input.worldMatrix, "locations", "name");
  const seeds = plotSourceNames(input.plotArchitecture, "foreshadowingPlan", "sourceSeed");
  const handoff = input.plotArchitecture.handoffToStoryBible && typeof input.plotArchitecture.handoffToStoryBible === "object" && !Array.isArray(input.plotArchitecture.handoffToStoryBible) ? input.plotArchitecture.handoffToStoryBible : {};
  const termNames = Array.isArray(handoff.canonicalTerms) ? handoff.canonicalTerms.map((term) => storyBibleCanonicalTermName(String(term || ""))).filter(Boolean) : [];
  return [
    "\u4E0A\u4E00\u7248 Story Bible \u672A\u901A\u8FC7\u7A0B\u5E8F\u6821\u9A8C\u3002\u8BF7\u53EA\u4FEE\u590D\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4FDD\u7559\u5DF2\u7ECF\u6B63\u786E\u7684\u5177\u4F53\u5185\u5BB9\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5B8C\u6574\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\u3002",
    `\u552F\u4E00\u5408\u6CD5\u4EBA\u7269\uFF1A${characters.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceEdge\uFF1A${relationships.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceArcId\uFF1A${arcIds.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceAnchorId\uFF1A${continuityIds.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684\u89C4\u5219\u540D\uFF1A${ruleNames.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684\u5730\u70B9\u540D\uFF1A${locationNames.join("\u3001")}`,
    `\u5FC5\u987B\u9010\u5B57\u8986\u76D6\u7684 sourceSeed\uFF1A${seeds.join("\uFF5C")}`,
    `terminology.sourceTerm \u5FC5\u987B\u9010\u5B57\u8986\u76D6\u8FD9\u4E9B\u672F\u8BED\u540D\uFF1A${termNames.join("\u3001")}`,
    "canonicalTerms \u5192\u53F7\u540E\u7684\u5B9A\u4E49\u3001\u6570\u503C\u548C\u9650\u5236\u5E94\u5199\u5165\u5BF9\u5E94 canonicalMeaning \u6216 usageRule\uFF0C\u4E0D\u8981\u628A\u6574\u6761\u201C\u540D\u79F0\uFF1A\u5B9A\u4E49\u201D\u585E\u8FDB sourceTerm\u3002",
    "\u4E0D\u5F97\u751F\u6210\u5206\u5377\u7B56\u7565\u3001\u9010\u7AE0\u84DD\u56FE\u3001\u7AE0\u8282\u5217\u8868\u6216\u6B63\u6587\u3002",
    "\u7A0B\u5E8F\u6821\u9A8C\u9519\u8BEF\uFF1A",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "\u9700\u8981\u4FEE\u590D\u7684\u4E0A\u4E00\u7248 JSON\uFF1A",
    JSON.stringify(result, null, 2)
  ].join("\n");
}
function volumeStrategyStringValues(value) {
  return Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
}
function volumeStrategyCharacterNames(storyBible) {
  return storyBibleSourceRecords(storyBible, "characterCanon").map((entry) => String(entry.character || "").trim()).filter(Boolean);
}
function volumeStrategyPromiseSeeds(storyBible) {
  return storyBibleSourceRecords(storyBible, "promiseLedger").map((entry) => String(entry.sourceSeed || "").trim()).filter(Boolean);
}
function volumeStrategyTargetForArcs(arcCount) {
  if (arcCount <= 1) return 1;
  return Math.max(2, Math.min(12, arcCount, Math.ceil(arcCount / 2)));
}
function buildVolumeStrategyPrompts(input, runId) {
  const arcs = storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture");
  const arcIds = arcs.map((arc) => String(arc.id || "").trim()).filter(Boolean);
  const characters = volumeStrategyCharacterNames(input.storyBible);
  const seeds = volumeStrategyPromiseSeeds(input.storyBible);
  const storyHandoff = input.storyBible.handoffToVolumeStrategy && typeof input.storyBible.handoffToVolumeStrategy === "object" && !Array.isArray(input.storyBible.handoffToVolumeStrategy) ? input.storyBible.handoffToVolumeStrategy : {};
  const compactArcs = arcs.map((arc) => ({
    id: arc.id,
    name: arc.name,
    startChapter: arc.startChapter,
    endChapter: arc.endChapter,
    openingState: arc.openingState,
    protagonistObjective: arc.protagonistObjective,
    drivingChoice: arc.drivingChoice,
    opposition: arc.opposition,
    midpointReversal: arc.midpointReversal,
    cost: arc.cost,
    irreversibleOutcome: arc.irreversibleOutcome,
    nextHandoff: arc.nextHandoff
  }));
  const basePrompt = [
    "\u4F60\u662F\u957F\u7BC7\u5C0F\u8BF4\u5206\u5377\u603B\u7B56\u5212\uFF08Volume Strategy Showrunner\uFF09\u3002",
    "\u4F60\u53EA\u8D1F\u8D23 phase_8_volume_strategy\uFF1A\u628A\u5DF2\u51BB\u7ED3\u7684\u6545\u4E8B\u5723\u7ECF\u548C\u4E3B\u7EBF\u5F27\u5206\u7EC4\u4E3A\u8FDE\u7EED\u5377\uFF0C\u660E\u786E\u6BCF\u5377\u9636\u6BB5\u76EE\u6807\u3001\u538B\u529B\u5347\u7EA7\u3001\u4EBA\u7269\u4E0E\u5173\u7CFB\u53D8\u5316\u3001\u4F0F\u7B14\u63A8\u8FDB\u3001\u8BFB\u8005\u5151\u73B0\u548C\u5377\u5C3E\u4E0D\u53EF\u9006\u4EA4\u63A5\u3002",
    "\u4E0D\u5F97\u6539\u53D8\u6545\u4E8B\u5723\u7ECF\u6B63\u5178\uFF0C\u4E0D\u5F97\u65B0\u589E\u4E3B\u7EBF\u5F27\uFF0C\u4E0D\u5F97\u628A\u4E3B\u7EBF\u5F27\u62C6\u5230\u4E24\u5377\uFF0C\u4E5F\u4E0D\u5F97\u751F\u6210\u9010\u7AE0\u84DD\u56FE\u3001\u7AE0\u8282\u5217\u8868\u6216\u6B63\u6587\u3002",
    "\u6BCF\u5377\u5FC5\u987B\u8986\u76D6\u4E00\u6BB5\u8FDE\u7EED\u4E3B\u7EBF\u5F27\uFF1B\u6240\u6709\u5377\u4ECE\u7B2C 1 \u7AE0\u8FDE\u7EED\u8986\u76D6\u5230\u5168\u4E66\u672B\u7AE0\uFF0C\u4E0D\u80FD\u91CD\u53E0\u6216\u7559\u7A7A\u3002",
    "\u5377\u5C3E\u4E0D\u80FD\u53EA\u662F\u4E8B\u4EF6\u7ED3\u675F\uFF0C\u5FC5\u987B\u6539\u53D8\u4EBA\u7269\u4F4D\u7F6E\u3001\u5173\u7CFB\u7F51\u7EDC\u3001\u4E16\u754C\u8BA4\u77E5\u6216\u53EF\u7528\u65B9\u6CD5\uFF0C\u5E76\u628A\u660E\u786E\u538B\u529B\u4EA4\u7ED9\u4E0B\u4E00\u5377\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\uFF0C\u4E0D\u8981\u89E3\u91CA\u751F\u6210\u8FC7\u7A0B\u3002"
  ].join("\n");
  const dynamicPrompt = [
    `\u6545\u4E8B\u5723\u7ECF Run\uFF1A${input.upstreamRunId}`,
    `\u5168\u4E66\u4F53\u91CF\uFF1A${input.totalChapters} \u7AE0`,
    `\u76EE\u6807\u5377\u6570\uFF1A${input.targetVolumeCount} \u5377`,
    `\u51BB\u7ED3\u4E3B\u7EBF\u5F27\uFF08${arcIds.length} \u6761\uFF09\uFF1A${arcIds.join("\u3001")}`,
    `\u51BB\u7ED3\u4EBA\u7269\uFF08${characters.length} \u4EBA\uFF09\uFF1A${characters.join("\u3001")}`,
    `\u51BB\u7ED3\u4F0F\u7B14\u627F\u8BFA\uFF08${seeds.length} \u6761\uFF09\u5FC5\u987B\u5168\u90E8\u8FDB\u5165\u5206\u5377\u6392\u671F\u3002`,
    `\u672C\u8F6E\u989D\u5916\u5173\u6CE8\uFF1A${input.strategyFocus || "\u907F\u514D\u4E2D\u6BB5\u5404\u5377\u91CD\u590D\uFF1B\u6BCF\u5377\u5FC5\u987B\u6709\u4E0D\u540C\u538B\u529B\u6A21\u578B\u3001\u4EBA\u7269\u5173\u7CFB\u53D8\u5316\u3001\u5C40\u90E8\u7B54\u6848\u548C\u4E0D\u53EF\u9006\u5377\u5C3E\u3002"}`,
    "\u6545\u4E8B\u5723\u7ECF\u4EA4\u63A5\u7EA6\u675F\uFF1A",
    JSON.stringify(storyHandoff, null, 2),
    "\u51BB\u7ED3\u4E3B\u7EBF\u5F27\u6458\u8981\uFF1A",
    JSON.stringify(compactArcs, null, 2),
    "\u5B8C\u6574 Story Bible JSON\uFF1A",
    JSON.stringify(input.storyBible, null, 2)
  ].join("\n");
  const userMessage = [
    "\u751F\u6210\u5B8C\u6574 Volume Strategy JSON\uFF0C\u4E25\u683C\u4F7F\u7528\u4EE5\u4E0B\u9876\u5C42\u7ED3\u6784\uFF1A",
    "{",
    '  "version": 1,',
    '  "source": { "storyBibleRunId": "", "phase": "phase_7_story_bible", "totalChapters": 0, "sourceArcIds": [""] },',
    '  "strategy": { "targetVolumeCount": 0, "groupingRationale": "", "escalationCadence": "", "readerPayoffCadence": "", "antiRepetitionRule": "" },',
    '  "volumes": [{ "id": "volume_01", "title": "", "startChapter": 1, "endChapter": 1, "sourceArcIds": [""], "phaseGoal": "", "openingState": "", "centralQuestion": "", "pressureEscalation": [""], "characterFocus": [""], "relationshipShifts": [""], "worldChanges": [""], "promiseAdvances": [{ "sourceSeed": "", "operation": "" }], "midpointTurn": "", "climax": "", "irreversibleChange": "", "readerPayoff": "", "nextVolumeHandoff": "", "forbiddenDrift": [""] }],',
    '  "arcCoverage": [{ "sourceArcId": "", "volumeId": "", "coverageFunction": "", "entryState": "", "exitState": "" }],',
    '  "characterCoverage": [{ "character": "", "volumeIds": [""], "entryFunction": "", "continuityRequirement": "", "requiredChange": "" }],',
    '  "promiseSchedule": [{ "sourceSeed": "", "setupVolumeId": "", "advanceVolumeIds": [""], "payoffVolumeId": "", "payoffEvidence": "", "forbiddenDrift": "" }],',
    '  "handoffToChapterBlueprints": { "volumeOrder": [""], "chapterRangeLocks": [{ "volumeId": "", "startChapter": 1, "endChapter": 1, "sourceArcIds": [""] }], "blueprintRules": [""], "highRiskTransitions": [""], "immutablePayoffs": [""] },',
    '  "qualitySelfCheck": { "continuousChapterCoverage": true, "allArcsCoveredExactlyOnce": true, "allCharactersScheduled": true, "allPromisesScheduled": true, "volumeEndsIrreversible": true, "noChapterBlueprintsGenerated": true, "remainingRisks": [""] }',
    "}",
    `volumes \u5FC5\u987B\u6070\u597D ${input.targetVolumeCount} \u5377\uFF0Cid \u4F9D\u6B21\u4E3A ${Array.from({ length: input.targetVolumeCount }, (_, index) => `volume_${String(index + 1).padStart(2, "0")}`).join("\u3001")}\u3002`,
    `\u6240\u6709\u5377\u4ECE\u7B2C 1 \u7AE0\u8FDE\u7EED\u8986\u76D6\u5230\u7B2C ${input.totalChapters} \u7AE0\uFF1B\u6BCF\u6761\u4E3B\u7EBF\u5F27\u5FC5\u987B\u4E14\u53EA\u80FD\u5F52\u5C5E\u4E00\u5377\uFF0C\u5F27\u4E0D\u80FD\u8DE8\u5377\u3002`,
    `arcCoverage.sourceArcId \u5FC5\u987B\u9010\u5B57\u8986\u76D6\uFF1A${arcIds.join("\u3001")}\u3002`,
    `characterCoverage.character \u5FC5\u987B\u9010\u5B57\u8986\u76D6\u5168\u90E8\u51BB\u7ED3\u4EBA\u7269\uFF1A${characters.join("\u3001")}\u3002`,
    "promiseSchedule.sourceSeed \u5FC5\u987B\u9010\u5B57\u8986\u76D6\u5168\u90E8\u6545\u4E8B\u5723\u7ECF\u627F\u8BFA\uFF1B\u5377\u5185 promiseAdvances \u53EA\u627F\u62C5\u672C\u5377\u5B9E\u9645\u63A8\u8FDB\u7684\u627F\u8BFA\u3002",
    "\u4E0D\u5F97\u8F93\u51FA chapterBlueprints\u3001chapters\u3001chapterPlans\u3001chapterDrafts \u6216\u6B63\u6587\u3002"
  ].join("\n");
  const consensus = `\u72EC\u7ACB\u8C03\u8BD5 Run: ${runId}
\u6545\u4E8B\u5723\u7ECF\u4E0A\u6E38 Run: ${input.upstreamRunId}`;
  const artifactProtocol = [
    "\u751F\u4EA7\u8D44\u4EA7\u751F\u6210\u534F\u8BAE\uFF1A",
    "- \u751F\u6210 phase_8_volume_strategy \u5206\u5377\u8D44\u4EA7\uFF0C\u4E0D\u8FDB\u884C\u5706\u684C\u8BA8\u8BBA\u3002",
    "- \u53EA\u5206\u7EC4\u51BB\u7ED3\u4E3B\u7EBF\u5F27\u5E76\u8BBE\u8BA1\u5377\u7EA7\u5151\u73B0\uFF0C\u4E0D\u62C6\u5206\u5230\u9010\u7AE0\u3002",
    "- \u8F93\u51FA\u5FC5\u987B\u80FD\u88AB phase_9_chapter_blueprints \u76F4\u63A5\u6D88\u8D39\u3002"
  ].join("\n");
  const responseContract = [
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u53EA\u80FD\u8F93\u51FA\u5355\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728 volume_strategy_debug \u9636\u6BB5\u3002"
  ].join("\n");
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "\u8F93\u51FA\u8BED\u8A00\uFF1A\u7B80\u4F53\u4E2D\u6587", "\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1Avolume_strategy_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n");
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage };
}
function buildVolumeStrategyRepairMessage(input, result, errors) {
  const arcIds = plotSourceNames(input.plotArchitecture, "arcArchitecture", "id");
  const characters = volumeStrategyCharacterNames(input.storyBible);
  const seeds = volumeStrategyPromiseSeeds(input.storyBible);
  return [
    "\u4E0A\u4E00\u7248 Volume Strategy \u672A\u901A\u8FC7\u7A0B\u5E8F\u6821\u9A8C\u3002\u8BF7\u53EA\u4FEE\u590D\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4FDD\u7559\u5DF2\u7ECF\u6B63\u786E\u7684\u5177\u4F53\u5185\u5BB9\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5B8C\u6574\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\u3002",
    `\u5FC5\u987B\u6070\u597D ${input.targetVolumeCount} \u5377\uFF0C\u5E76\u4ECE\u7B2C 1 \u7AE0\u8FDE\u7EED\u8986\u76D6\u5230\u7B2C ${input.totalChapters} \u7AE0\u3002`,
    `\u6BCF\u6761\u4E3B\u7EBF\u5F27\u5FC5\u987B\u4E14\u53EA\u80FD\u5F52\u5C5E\u4E00\u5377\uFF0C\u987A\u5E8F\u4E3A\uFF1A${arcIds.join("\u3001")}`,
    `\u5FC5\u987B\u8986\u76D6\u7684\u51BB\u7ED3\u4EBA\u7269\uFF1A${characters.join("\u3001")}`,
    `\u5FC5\u987B\u8986\u76D6\u7684 sourceSeed\uFF1A${seeds.join("\uFF5C")}`,
    "\u4E0D\u5F97\u751F\u6210\u9010\u7AE0\u84DD\u56FE\u3001\u7AE0\u8282\u8BA1\u5212\u3001\u7AE0\u8282\u5217\u8868\u6216\u6B63\u6587\u3002",
    "\u7A0B\u5E8F\u6821\u9A8C\u9519\u8BEF\uFF1A",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "\u9700\u8981\u4FEE\u590D\u7684\u4E0A\u4E00\u7248 JSON\uFF1A",
    JSON.stringify(result, null, 2)
  ].join("\n");
}
function chapterBlueprintSelectedVolume(input) {
  return storyBibleSourceRecords(input.volumeStrategy, "volumes").find((volume) => String(volume.id || "").trim() === input.volumeId) || null;
}
function chapterBlueprintArcForChapter(input, chapterNumber) {
  return storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture").find((arc) => chapterNumber >= Number(arc.startChapter) && chapterNumber <= Number(arc.endChapter)) || null;
}
function chapterBlueprintBatchArcs(input) {
  return storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture").filter((arc) => Number(arc.startChapter) <= input.endChapter && Number(arc.endChapter) >= input.startChapter);
}
function chapterBlueprintBatchArcIds(input) {
  return chapterBlueprintBatchArcs(input).map((arc) => String(arc.id || "").trim()).filter(Boolean);
}
function debugStableJsonText(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value || "");
  }
}
function chineseSmallInteger(value) {
  const trimmed = value.trim();
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return numeric;
  const map = { \u96F6: 0, "\u3007": 0, \u4E00: 1, \u4E8C: 2, \u4E24: 2, \u4E09: 3, \u56DB: 4, \u4E94: 5, \u516D: 6, \u4E03: 7, \u516B: 8, \u4E5D: 9, \u5341: 10 };
  if (trimmed === "\u5341") return 10;
  if (trimmed.length === 2 && trimmed.startsWith("\u5341")) return 10 + (map[trimmed[1]] || 0);
  if (trimmed.length === 2 && trimmed.endsWith("\u5341")) return (map[trimmed[0]] || 0) * 10;
  if (trimmed.length === 3 && trimmed[1] === "\u5341") return (map[trimmed[0]] || 0) * 10 + (map[trimmed[2]] || 0);
  return map[trimmed] ?? 0;
}
function formatProtectionPeriod(days) {
  const years = Math.floor(days / 360);
  const remainingAfterYears = days - years * 360;
  const months = Math.floor(remainingAfterYears / 30);
  const extraDays = remainingAfterYears - months * 30;
  return `${years}\u5E74${months}\u4E2A\u6708${extraDays ? `${extraDays}\u5929` : ""}`;
}
function parseProtectionPeriods(text) {
  const periods = [];
  const regex = /庇护期(?:剩余|尚余|还有|仅剩|为)?\s*(\d+)\s*年\s*(\d+)\s*(?:个)?月(?:\s*(\d+)\s*天)?/gu;
  for (const match of text.matchAll(regex)) {
    const years = Number(match[1]);
    const months = Number(match[2]);
    const extraDays = Number(match[3] || 0);
    if (!Number.isFinite(years) || !Number.isFinite(months) || !Number.isFinite(extraDays)) continue;
    periods.push({
      raw: match[0],
      days: years * 360 + months * 30 + extraDays,
      years,
      months,
      extraDays
    });
  }
  return periods;
}
function parseProtectionCostDays(text) {
  let maxCostDays = 0;
  const regex = /消耗[^。；，,]{0,40}?([一二两三四五六七八九十\d]+)\s*(?:个)?月\s*庇护期/gu;
  for (const match of text.matchAll(regex)) {
    const months = chineseSmallInteger(String(match[1] || ""));
    if (months > 0) maxCostDays = Math.max(maxCostDays, months * 30);
  }
  return maxCostDays;
}
function chapterBlueprintForbidsProtectionExtension(input) {
  const protectionTermText = storyBibleSourceRecords(input.storyBible, "terminology").filter((entry) => /金色莲花|庇护期/u.test(debugStableJsonText(entry))).map((entry) => debugStableJsonText(entry)).join("\n");
  return /庇护期可延长|每个归乡者仅一次|为期三年/u.test(protectionTermText);
}
function detectChapterBlueprintUpstreamCanonConflicts(input) {
  const warnings = [];
  const evidence = {};
  if (!input.previousBatchHandoff) return { valid: true, errors: [], warnings, evidence };
  const sourceArcIds = chapterBlueprintBatchArcIds(input);
  const volume = chapterBlueprintSelectedVolume(input);
  const previousText = debugStableJsonText(input.previousBatchHandoff);
  const targetText = [
    chapterBlueprintBatchArcs(input).map((arc) => ({
      id: arc.id,
      startChapter: arc.startChapter,
      endChapter: arc.endChapter,
      cost: arc.cost,
      irreversibleOutcome: arc.irreversibleOutcome,
      nextHandoff: arc.nextHandoff
    })),
    storyBibleSourceRecords(input.storyBible, "arcCanon").filter((entry) => sourceArcIds.includes(String(entry.sourceArcId || "").trim())),
    storyBibleSourceRecords(input.volumeStrategy, "arcCoverage").filter((entry) => sourceArcIds.includes(String(entry.sourceArcId || "").trim())),
    volume ? {
      id: volume.id,
      pressureEscalation: volume.pressureEscalation,
      climax: volume.climax,
      irreversibleChange: volume.irreversibleChange,
      nextVolumeHandoff: volume.nextVolumeHandoff,
      forbiddenDrift: volume.forbiddenDrift
    } : null
  ].map((entry) => debugStableJsonText(entry)).join("\n");
  const previousPeriods = parseProtectionPeriods(previousText);
  const targetPeriods = parseProtectionPeriods(targetText);
  const protectionCostDays = parseProtectionCostDays(targetText);
  const forbidsExtension = chapterBlueprintForbidsProtectionExtension(input);
  evidence.previousPeriods = previousPeriods;
  evidence.targetPeriods = targetPeriods;
  evidence.protectionCostDays = protectionCostDays;
  evidence.forbidsProtectionExtension = forbidsExtension;
  const previousPeriod = previousPeriods.at(-1);
  const targetPeriod = targetPeriods.reduce((best, period) => !best || period.days > best.days ? period : best, null);
  const errors = [];
  if (previousPeriod && targetPeriod && forbidsExtension) {
    const maximumPossibleExitDays = previousPeriod.days - protectionCostDays;
    if (targetPeriod.days > maximumPossibleExitDays) {
      const costText = protectionCostDays > 0 ? `\uFF0C\u4E14\u5F53\u524D\u5F27\u8FD8\u8981\u6C42\u6D88\u8017${formatProtectionPeriod(protectionCostDays)}\u5E87\u62A4\u671F` : "";
      errors.push(`\u4E0A\u6E38\u6B63\u5178\u51B2\u7A81\uFF1A\u4E0A\u4E00\u6279\u7B2C ${input.previousBatchHandoff.endChapter || input.startChapter - 1} \u7AE0\u4EA4\u63A5\u4E3A\u201C${previousPeriod.raw}\u201D\uFF0C\u4F46\u672C\u6279\u51BB\u7ED3\u5F27\u7EBF/\u5206\u5377\u51FA\u53E3\u8981\u6C42\u8FBE\u5230\u201C${targetPeriod.raw}\u201D${costText}\uFF1B\u91D1\u8272\u83B2\u82B1\u6B63\u5178\u7981\u6B62\u5E87\u62A4\u671F\u5EF6\u957F\u3002\u6309\u4E0A\u4E00\u6279\u72B6\u6001\u63A8\u7B97\uFF0C\u672C\u6279\u51FA\u53E3\u6700\u591A\u53EA\u80FD\u662F\u201C\u5E87\u62A4\u671F\u5269\u4F59${formatProtectionPeriod(Math.max(0, maximumPossibleExitDays))}\u201D\u3002\u8BE5\u8F93\u5165\u5408\u540C\u4E0D\u53EF\u6536\u655B\uFF0C\u8BF7\u5148\u6E05\u6D17\u4E0A\u4E00\u6279\u4EA4\u63A5\u3001\u5206\u5377\u51FA\u53E3\u6216\u5F27\u7EBF requiredCost\u3002`);
    }
  }
  if (!errors.length && previousPeriod && targetPeriods.length === 0) {
    warnings.push(`\u4E0A\u4E00\u6279\u4EA4\u63A5\u5305\u542B\u201C${previousPeriod.raw}\u201D\uFF0C\u4F46\u672C\u6279\u51BB\u7ED3\u51FA\u53E3\u6CA1\u6709\u660E\u786E\u5E87\u62A4\u671F\u6570\u503C\uFF1B\u5EFA\u8BAE\u5728\u5206\u5377\u7B56\u7565\u6216\u5F27\u7EBF\u51FA\u53E3\u8865\u9F50\uFF0C\u907F\u514D\u6A21\u578B\u81EA\u884C\u731C\u6570\u3002`);
  }
  return { valid: errors.length === 0, errors, warnings, evidence };
}
function chapterBlueprintPacingContract(input) {
  const arcs = chapterBlueprintBatchArcs(input);
  return arcs.map((arc) => {
    const arcStartChapter = Number(arc.startChapter);
    const arcEndChapter = Number(arc.endChapter);
    const arcChapterCount = Math.max(1, arcEndChapter - arcStartChapter + 1);
    const batchStartChapter = Math.max(input.startChapter, arcStartChapter);
    const batchEndChapter = Math.min(input.endChapter, arcEndChapter);
    const midpointChapter = Math.floor((arcStartChapter + arcEndChapter) / 2);
    const progressStart = Math.max(0, (batchStartChapter - arcStartChapter) / arcChapterCount);
    const progressEnd = Math.min(1, (batchEndChapter - arcStartChapter + 1) / arcChapterCount);
    const mayTriggerMidpoint = batchStartChapter <= midpointChapter && batchEndChapter >= midpointChapter;
    const midpointStatus = mayTriggerMidpoint ? "inside_current_batch" : batchEndChapter < midpointChapter ? "future_not_reached" : "already_triggered_before_batch";
    const mayResolveArc = batchStartChapter <= arcEndChapter && batchEndChapter >= arcEndChapter;
    const phase = mayResolveArc ? "arc_climax_and_handoff" : mayTriggerMidpoint ? "midpoint_window" : batchEndChapter < midpointChapter ? "opening_or_rising_action" : "post_midpoint_escalation";
    const forbiddenFutureMilestones = [];
    const alreadyTriggeredMilestones = [];
    if (String(arc.midpointReversal || "").trim()) {
      if (midpointStatus === "future_not_reached") forbiddenFutureMilestones.push(`\u4E2D\u70B9\u9006\u8F6C\uFF08\u7EA6\u7B2C ${midpointChapter} \u7AE0\uFF09\uFF1A${String(arc.midpointReversal).trim()}`);
      else if (midpointStatus === "already_triggered_before_batch") alreadyTriggeredMilestones.push(`\u4E2D\u70B9\u9006\u8F6C\u5DF2\u5728\u7B2C ${midpointChapter} \u7AE0\u524D\u540E\u53D1\u751F\uFF0C\u672C\u6279\u5FC5\u987B\u7EE7\u627F\u5176\u540E\u679C\u800C\u4E0D\u662F\u628A\u5B83\u5F53\u4F5C\u672A\u6765\u7981\u7528\u4E8B\u4EF6\uFF1A${String(arc.midpointReversal).trim()}`);
    }
    if (!mayResolveArc) {
      if (String(arc.irreversibleOutcome || "").trim()) forbiddenFutureMilestones.push(`\u5F27\u672B\u4E0D\u53EF\u9006\u7ED3\u5C40\uFF08\u7B2C ${arcEndChapter} \u7AE0\uFF09\uFF1A${String(arc.irreversibleOutcome).trim()}`);
      if (String(arc.nextHandoff || "").trim()) forbiddenFutureMilestones.push(`\u4E0B\u4E00\u5F27\u4EA4\u63A5\uFF08\u7B2C ${arcEndChapter} \u7AE0\u540E\uFF09\uFF1A${String(arc.nextHandoff).trim()}`);
    }
    return {
      sourceArcId: String(arc.id || "").trim(),
      arcName: String(arc.name || "").trim(),
      arcStartChapter,
      arcEndChapter,
      arcChapterCount,
      batchStartChapter,
      batchEndChapter,
      batchProgressPercent: `${Math.round(progressStart * 100)}%-${Math.round(progressEnd * 100)}%`,
      midpointChapter,
      phase,
      mayTriggerMidpoint,
      midpointStatus,
      mayResolveArc,
      requiredOpeningState: batchStartChapter === arcStartChapter ? String(arc.openingState || "").trim() : "\u5FC5\u987B\u7EE7\u627F\u4E0A\u4E00\u6279\u4EA4\u63A5\uFF0C\u4E0D\u5F97\u91CD\u7F6E\u5230\u5F27\u5F00\u573A\u3002",
      alreadyTriggeredMilestones,
      mustRemainUnresolved: mayResolveArc ? [] : [
        `\u5F27\u6838\u5FC3\u76EE\u6807\u5728\u7B2C ${arcEndChapter} \u7AE0\u524D\u4E0D\u5F97\u5B8C\u6210\u6216\u5931\u6548\uFF1A${String(arc.protagonistObjective || "").trim()}`,
        `\u5F27\u5F00\u573A\u6838\u5FC3\u538B\u529B\u4E0D\u5F97\u5728\u672C\u6279\u6C38\u4E45\u6D88\u5931\uFF1A${String(arc.openingState || "").trim()}`,
        `\u7B2C ${batchEndChapter} \u7AE0\u7684\u9000\u51FA\u72B6\u6001\u5FC5\u987B\u4FDD\u7559\u4E00\u6761\u53EF\u7EE7\u7EED\u63A8\u8FDB\u5230\u7B2C ${arcEndChapter} \u7AE0\u7684\u6709\u6548\u56E0\u679C\u8DEF\u5F84\u3002`
      ],
      forbiddenFutureMilestones,
      nextChapterBoundary: mayResolveArc ? `\u53EF\u4EE5\u5728\u7B2C ${arcEndChapter} \u7AE0\u5B8C\u6210\u5F27\u672B\u7ED3\u679C\uFF0C\u5E76\u4EA4\u63A5\u4E0B\u4E00\u5F27\u3002` : `\u7B2C ${batchEndChapter + 1} \u7AE0\u4ECD\u5C5E\u4E8E ${String(arc.id || "").trim()}\uFF1B\u672C\u6279\u7AE0\u672B\u4E0D\u5F97\u8FDB\u5165\u4E0B\u4E00\u5F27\u3001\u4E0B\u4E00\u4E16\u754C\u72B6\u6001\u6216\u6D88\u8D39\u5F27\u672B\u7ED3\u5C40\u3002`
    };
  });
}
function chapterBlueprintCjkNgrams(value, size = 4) {
  const characters = Array.from(String(value || "").replace(/[^\p{Script=Han}\p{Number}]/gu, ""));
  const grams = /* @__PURE__ */ new Set();
  for (let index = 0; index <= characters.length - size; index += 1) grams.add(characters.slice(index, index + size).join(""));
  return grams;
}
function chapterBlueprintPacingStateEntries(result) {
  const blueprints = Array.isArray(result.blueprints) ? result.blueprints : [];
  const entries = [];
  const append = (pathLabel, value) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${pathLabel}[${index}]`, item));
      return;
    }
    const text = String(value || "").trim();
    if (text) entries.push({ path: pathLabel, value: text });
  };
  for (const [blueprintIndex, blueprint] of blueprints.entries()) {
    for (const key of ["irreversibleChange", "endingHook", "nextChapterEntryState", "nextChapterHandoff"]) append(`blueprints[${blueprintIndex}].${key}`, blueprint[key]);
    const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards : [];
    for (const [cardIndex, card] of sceneCards.entries()) {
      for (const key of ["turn", "endHook", "requiredFacts"]) append(`blueprints[${blueprintIndex}].sceneCards[${cardIndex}].${key}`, card[key]);
    }
  }
  const continuity = Array.isArray(result.batchContinuity) ? result.batchContinuity : [];
  for (const [continuityIndex, entry] of continuity.entries()) append(`batchContinuity[${continuityIndex}].requiredCarryover`, entry.requiredCarryover);
  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? result.handoffToWritingPlan : {};
  append("handoffToWritingPlan.batchExitState", handoff.batchExitState);
  append("handoffToWritingPlan.unresolvedRisks", handoff.unresolvedRisks);
  return entries;
}
function chapterBlueprintOperationalGuardrails(input) {
  const guardrails = [];
  const sourceText = [
    JSON.stringify(chapterBlueprintBatchArcs(input)),
    JSON.stringify(input.previousBatchHandoff || {}),
    JSON.stringify(storyBibleSourceRecords(input.storyBible, "characterCanon")),
    JSON.stringify(storyBibleSourceRecords(input.storyBible, "terminology")),
    JSON.stringify(input.storyBible.worldCanon || {})
  ].join("\n");
  const resolvesArcViaBoundaryArtifact = chapterBlueprintBatchArcs(input).some((arc) => {
    const arcEndChapter = Number(arc.endChapter);
    const text = `${String(arc.exitState || "")} ${String(arc.irreversibleOutcome || "")} ${String(arc.requiredCost || "")}`;
    return input.startChapter <= arcEndChapter && input.endChapter >= arcEndChapter && /破界符|进入第八层/u.test(text);
  });
  if (/破界符|破壁|天壁|空间褶皱|后备通道/u.test(sourceText)) {
    guardrails.push(resolvesArcViaBoundaryArtifact ? "\u7A7A\u95F4/\u7834\u58C1\u8FB9\u754C\uFF1A\u672C\u6279\u5305\u542B\u5F27\u672B\u8F6C\u573A\u65F6\uFF0C\u53EA\u5141\u8BB8\u6309\u51BB\u7ED3\u6B63\u5178\u5199\u6210\u201C\u7384\u9ED8\u4F7F\u7528\u7834\u754C\u7B26\u63A5\u5E94\u9646\u65E0\u826F\u8FDB\u5165\u7B2C\u516B\u5C42\u201D\uFF1B\u4E0D\u5F97\u8BA9\u9646\u65E0\u826F\u81EA\u884C\u6495\u88C2\u7A7A\u95F4\u8936\u76B1\u3001\u5F3A\u884C\u7A7F\u5C42\u3001\u7834\u58C1\u3001\u5F15\u7206\u53E4\u94A5\u5319\u6216\u7528\u53E4\u94A5\u5319\u66FF\u4EE3\u7834\u754C\u7B26\u3002\u5F27\u672B\u524D\u7684\u7AE0\u8282\u4ECD\u53EA\u80FD\u505C\u7559\u5728\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\u3002" : "\u7A7A\u95F4/\u7834\u58C1\u8FB9\u754C\uFF1A\u672C\u6279\u4E0D\u5F97\u8BA9\u9646\u65E0\u826F\u81EA\u884C\u6495\u88C2\u7A7A\u95F4\u8936\u76B1\u3001\u5F3A\u884C\u7A7F\u5C42\u3001\u7834\u58C1\u6216\u66FF\u4EE3\u7834\u754C\u7B26\uFF1B\u4E0D\u5F97\u628A\u201C\u5730\u5F62\u7F1D\u9699/\u540E\u5907\u901A\u9053\u201D\u5199\u6210\u5DF2\u8FDB\u5165\u6216\u5DF2\u79FB\u52A8\u5B8C\u6210\uFF0C\u53EA\u80FD\u8BB0\u5F55\u4E3A\u636E\u70B9\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\u3001\u672A\u51B3\u8DEF\u7EBF\u6216\u89C2\u5BDF\u7EBF\u7D22\u3002");
  }
  if (/无面标记|金色标记|标记残渣|左臂黑线/u.test(sourceText)) {
    guardrails.push("\u65E0\u9762/\u6807\u8BB0\u8FB9\u754C\uFF1A\u65E0\u9762\u6807\u8BB0\u3001\u91D1\u8272\u6807\u8BB0\u548C\u5DE6\u81C2\u9ED1\u7EBF\u662F\u8FFD\u8E2A/\u6C61\u67D3/\u5E72\u6270\u6E90\uFF0C\u4E0D\u662F\u53EF\u4E3B\u52A8\u5F15\u7206\u7684\u80FD\u91CF\uFF1B\u53EA\u80FD\u5199\u4F5C\u91CD\u65B0\u6D3B\u6027\u5316\u3001\u523A\u75DB\u3001\u8BEF\u5BFC\u3001\u5E72\u6270\u5224\u65AD\uFF0C\u7981\u6B62\u5199\u6210\u88AB\u9646\u65E0\u826F\u5229\u7528\u3001\u5F15\u7206\u3001\u51C0\u5316\u6216\u5B8C\u5168\u6E05\u9664\u3002");
  }
  if (/庇护期|金色莲花/u.test(sourceText)) {
    guardrails.push("\u5E87\u62A4\u671F\u8D26\u672C\uFF1A\u5E87\u62A4\u671F\u53EA\u80FD\u6309\u81EA\u7136\u7ECF\u8FC7\u65F6\u95F4\u51CF\u5C11\uFF0C\u6216\u5728\u51BB\u7ED3\u5F27\u7EA7 requiredCost \u660E\u786E\u53D1\u751F\u65F6\u4E00\u6B21\u6027\u6263\u9664\uFF1B\u7981\u6B62\u5199\u201C\u6D88\u80171%\u201D\u201C\u5F3A\u884C\u7834\u9635\u6263\u5E87\u62A4\u671F\u201D\u7B49\u81EA\u9020\u767E\u5206\u6BD4\u4EE3\u4EF7\u3002");
  }
  if (/古钥匙/u.test(sourceText)) {
    guardrails.push("\u53E4\u94A5\u5319\u8D26\u672C\uFF1A\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u5FC5\u987B\u4ECE\u4E0A\u4E00\u6279\u6570\u503C\u5355\u8C03\u4E0B\u964D\u6216\u4FDD\u6301\uFF0C\u9664\u975E\u84DD\u56FE\u660E\u786E\u5B89\u6392\u4FEE\u590D\u4E8B\u4EF6\uFF1B\u7981\u6B62\u4ECE60%/70%\u56DE\u5347\u523075%\u8FD9\u7C7B\u65E0\u56E0\u679C\u6062\u590D\u3002");
  }
  if (/沈青霜/u.test(sourceText)) {
    guardrails.push("\u6C88\u9752\u971C\u8FB9\u754C\uFF1A\u5F272\u4E0D\u5F97\u8BA9\u6C88\u9752\u971C\u6062\u590D\u8BB0\u5FC6\u3001\u79F0\u9646\u65E0\u826F\u4E3A\u201C\u5E08\u5144\u201D\u3001\u8868\u73B0\u51FA\u53EF\u88AB\u9646\u65E0\u826F\u786E\u8BA4\u7684\u8BB0\u5FC6\u6B8B\u7559\uFF1B\u53EA\u80FD\u5199\u7CFB\u7EDF\u5316\u8FFD\u6355\u3001\u77ED\u6682\u8FDF\u7591\u6216\u65E0\u610F\u8BC6\u751F\u7406\u53CD\u5E94\uFF0C\u4E14\u4E0D\u5F97\u6CC4\u9732\u8BB0\u5FC6\u5C01\u5370\u7EC6\u8282\u3002");
  }
  if (/旧日道则|无面|疑问|梦境/u.test(sourceText)) {
    guardrails.push("\u65E0\u9762\u68A6\u5883\u8FB9\u754C\uFF1A\u5F272\u53EA\u80FD\u8FDB\u884C\u8BD5\u63A2\u3001\u4F4E\u8BED\u3001\u690D\u5165\u7591\u95EE\u6216\u5236\u9020\u4E0D\u4FE1\u4EFB\uFF1B\u7981\u6B62\u8BA9\u9646\u65E0\u826F\u4E3B\u52A8\u53CD\u5411\u8FFD\u8E2A\u65E0\u9762\u8282\u70B9\u3001\u63D0\u53D6\u65E7\u65E5\u9053\u5219\u4FE1\u606F\u3001\u5F7B\u5E95\u7206\u53D1\u6000\u7591\u79CD\u5B50\u3001\u88AB\u6784\u5EFA\u5B8C\u6574\u865A\u5047\u8BB0\u5FC6\u6216\u88AB\u65E0\u9762\u63A7\u5236\u3002");
  }
  return guardrails;
}
function chapterBlueprintPacingStateText(result) {
  return JSON.stringify(chapterBlueprintPacingStateEntries(result).map((entry) => entry.value));
}
function validateChapterBlueprintPacing(result, input) {
  const errors = [];
  const stateEntries = chapterBlueprintPacingStateEntries(result);
  const pacingStateText = chapterBlueprintPacingStateText(result);
  const futureMilestoneGramSize = 12;
  const arcs = chapterBlueprintBatchArcs(input);
  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? result.handoffToWritingPlan : {};
  const blueprints = Array.isArray(result.blueprints) ? result.blueprints : [];
  const finalBlueprint = blueprints[blueprints.length - 1] || {};
  const finalStateText = [finalBlueprint.irreversibleChange, finalBlueprint.endingHook, finalBlueprint.nextChapterEntryState, finalBlueprint.nextChapterHandoff, handoff.batchExitState].map((value) => String(value || "")).join("\n");
  for (const arc of arcs) {
    const arcEndChapter = Number(arc.endChapter);
    if (input.endChapter >= arcEndChapter) continue;
    const activePressureText = [arc.openingState, arc.protagonistObjective, arc.opposition].map((value) => String(value || "")).join("\n");
    const prematureResolutions = [...finalStateText.matchAll(/([\p{Script=Han}]{2,8})(?:已经|已|将)?(?:完全|彻底|永久)(闭合|关闭|消失|解除|终止)/gu)];
    const reportedPrematureResolutions = /* @__PURE__ */ new Set();
    for (const match of prematureResolutions) {
      const rawEntity = String(match[1] || "");
      const suffixes = Array.from({ length: Math.max(0, Math.min(6, Array.from(rawEntity).length) - 1) }, (_, index) => Array.from(rawEntity).slice(index).join(""));
      const entity = suffixes.find((candidate) => Array.from(candidate).length >= 2 && activePressureText.includes(candidate));
      const resolutionKey = `${entity || ""}:${String(match[2] || "")}`;
      if (entity && !reportedPrematureResolutions.has(resolutionKey)) {
        reportedPrematureResolutions.add(resolutionKey);
        errors.push(`\u5F27\u7EBF\u6838\u5FC3\u538B\u529B\u88AB\u63D0\u524D\u89E3\u9664\uFF1A\u672C\u6279\u53EA\u5230\u7B2C ${input.endChapter} \u7AE0\uFF0C\u4F46\u9000\u51FA\u72B6\u6001\u5199\u6210\u201C${match[0]}\u201D\uFF1B${entity}\u4ECD\u662F ${String(arc.id || "")} \u6301\u7EED\u5230\u7B2C ${arcEndChapter} \u7AE0\u7684\u6838\u5FC3\u76EE\u6807/\u538B\u529B\u3002`);
      }
    }
    const baseline = chapterBlueprintCjkNgrams(JSON.stringify({
      openingState: arc.openingState,
      protagonistObjective: arc.protagonistObjective,
      drivingChoice: arc.drivingChoice,
      opposition: arc.opposition,
      sourceCausalInputs: arc.sourceCausalInputs
    }), futureMilestoneGramSize);
    for (const [label, milestone] of [["\u5F27\u672B\u4E0D\u53EF\u9006\u7ED3\u5C40", arc.irreversibleOutcome], ["\u4E0B\u4E00\u5F27\u4EA4\u63A5", arc.nextHandoff]]) {
      const milestoneText = String(milestone || "").trim();
      if (!milestoneText) continue;
      const milestoneGrams = [...chapterBlueprintCjkNgrams(milestoneText, futureMilestoneGramSize)].filter((gram) => !baseline.has(gram));
      const fieldMatches = stateEntries.map((entry) => {
        const entryGrams = chapterBlueprintCjkNgrams(entry.value, futureMilestoneGramSize);
        const matched = milestoneGrams.filter((gram) => entryGrams.has(gram));
        return { ...entry, matched };
      }).filter((entry) => entry.matched.length >= 2);
      if (fieldMatches.length) {
        const evidence = fieldMatches.slice(0, 4).map((entry) => `${entry.path} \u547D\u4E2D\u201C${entry.matched.slice(0, 2).join(" / ")}\u201D`).join("\uFF1B");
        errors.push(`\u5F27\u7EBF\u8FDB\u5EA6\u8D8A\u754C\uFF1A\u672C\u6279\u53EA\u5230\u7B2C ${input.endChapter} \u7AE0\uFF0C\u4F46 ${String(arc.id || "")} \u7684${label}\u51BB\u7ED3\u5728\u7B2C ${arcEndChapter} \u7AE0\uFF1B\u7591\u4F3C\u63D0\u524D\u590D\u5236\u672A\u6765\u7ED3\u5C40\u7684\u5177\u4F53\u5B57\u6BB5\uFF1A${evidence}\u3002\u8BF7\u53EA\u6539\u8FD9\u4E9B\u8DEF\u5F84\uFF0C\u5E76\u4FDD\u7559\u5F53\u524D\u6279\u6B21\u5141\u8BB8\u53D1\u751F\u7684\u94FA\u57AB\u3001\u9996\u6B21\u63A5\u89E6\u548C\u672A\u5B8C\u6210\u72B6\u6001\u3002`);
      }
    }
  }
  const terminology = storyBibleSourceRecords(input.storyBible, "terminology");
  const forbidsSubThreeDayDeadline = terminology.some((entry) => volumeStrategyStringValues(entry.forbiddenVariants).some((variant) => variant.includes("\u4E0D\u8DB3\u4E09\u5929")));
  if (forbidsSubThreeDayDeadline) {
    const shortDeadlineMatches = [...pacingStateText.matchAll(/(?:一个时辰|一时辰|半日|半天|一日|一天|二日|二天|两日|两天|[12]\s*(?:日|天))(?:之内|以内|内|之后|以后|后)?(?:将|会)?(?:完全)?(?:闭合|关闭)/gu)].map((match) => match[0]);
    if (shortDeadlineMatches.length) errors.push(`\u672F\u8BED\u5012\u8BA1\u65F6\u8D8A\u754C\uFF1A\u51BB\u7ED3\u6B63\u5178\u7981\u6B62\u7F29\u77ED\u81F3\u4E0D\u8DB3\u4E09\u5929\uFF0C\u4F46\u84DD\u56FE\u72B6\u6001\u51FA\u73B0\uFF1A${[...new Set(shortDeadlineMatches)].join("\u3001")}\u3002`);
  }
  return errors;
}
function buildChapterBlueprintPrompts(input, runId, learningPrompt = "") {
  const volume = chapterBlueprintSelectedVolume(input) || {};
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index);
  const volumeSourceArcIds = volumeStrategyStringValues(volume.sourceArcIds);
  const relevantArcs = chapterBlueprintBatchArcs(input);
  const sourceArcIds = chapterBlueprintBatchArcIds(input);
  const scheduledNames = storyBibleSourceRecords(input.volumeStrategy, "characterCoverage").filter((entry) => volumeStrategyStringValues(entry.volumeIds).includes(input.volumeId)).map((entry) => String(entry.character || "").trim()).filter(Boolean);
  const relevantCharacters = storyBibleSourceRecords(input.storyBible, "characterCanon").filter((entry) => scheduledNames.includes(String(entry.character || "").trim()));
  const relevantPromises = storyBibleSourceRecords(input.volumeStrategy, "promiseSchedule").filter((entry) => {
    const ids = [String(entry.setupVolumeId || "").trim(), String(entry.payoffVolumeId || "").trim(), ...volumeStrategyStringValues(entry.advanceVolumeIds)];
    return ids.includes(input.volumeId);
  });
  const pacingContract = chapterBlueprintPacingContract(input);
  const operationalGuardrails = chapterBlueprintOperationalGuardrails(input);
  const basePrompt = [
    "\u4F60\u662F\u957F\u7BC7\u5C0F\u8BF4\u7AE0\u8282\u84DD\u56FE\u603B\u7F16\uFF08Lean Chapter Blueprint Architect\uFF09\u3002",
    "\u4F60\u53EA\u8D1F\u8D23 phase_9_chapter_blueprints\uFF1A\u4E3A\u6307\u5B9A\u5377\u5185\u7684\u8FDE\u7EED\u7AE0\u8282\u6279\u6B21\u751F\u6210\u201C\u6781\u7B80\u7AE0\u8282\u4E3B\u7EBF\u84DD\u56FE\u201D\uFF0C\u4E0D\u662F\u7AE0\u8282\u6B63\u6587\u3001\u4E0D\u662F\u573A\u666F\u5361\u3001\u4E0D\u662F\u8D26\u672C\u7ED3\u7B97\u3002",
    "\u672C\u9636\u6BB5\u6BCF\u7AE0\u53EA\u56DE\u7B54\u56DB\u4EF6\u4E8B\uFF1A\u672C\u7AE0\u76EE\u6807\u3001\u4E3B\u89D2\u51B3\u5B9A\u3001\u4E0D\u53EF\u9006\u53D8\u5316\u3001\u4E0B\u4E00\u7AE0\u538B\u529B\u3002",
    "\u6280\u80FD\u3001\u7269\u54C1\u3001\u5012\u8BA1\u65F6\u3001\u767E\u5206\u6BD4\u3001\u88C2\u7EB9\u6570\u91CF\u3001\u4F4D\u7F6E\u8FB9\u754C\u3001\u4EBA\u7269\u5173\u7CFB\u7B49\u7EA7\u7B49\u7CFB\u7EDF\u72B6\u6001\u4E0D\u5F97\u7531\u4F60\u81EA\u7531\u6539\u5199\uFF1B\u5982\u9700\u5F15\u7528\uFF0C\u53EA\u5199 stateLedgerRefs \u7684\u77ED\u6807\u7B7E\u3002",
    "\u7981\u6B62 sceneCards\u3001requiredFacts\u3001forbiddenFacts\u3001\u590D\u6742\u4FEE\u590D\u8BED\u8A00\u3001\u5BA1\u8BA1\u8BED\u8A00\u3001\u7CFB\u7EDF\u8D26\u672C\u957F\u6BB5\u843D\u3002",
    "\u8F93\u51FA\u8981\u50CF\u5267\u60C5\u63A8\u8FDB\u8868\uFF1A\u77ED\u3001\u51C6\u3001\u53EF\u8BFB\u3001\u80FD\u8BA9\u4F5C\u8005\u77E5\u9053\u8FD9\u4E00\u7AE0\u8BE5\u5199\u4EC0\u4E48\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\uFF0C\u4E0D\u8981\u89E3\u91CA\u751F\u6210\u8FC7\u7A0B\u3002"
  ].join("\n");
  const dynamicPrompt = [
    "\u7F13\u5B58\u7A33\u5B9A\u524D\u7F00\uFF1A\u4EE5\u4E0B\u51BB\u7ED3\u6B63\u5178\u6309\u56FA\u5B9A\u987A\u5E8F\u5E8F\u5217\u5316\uFF0C\u4EFB\u4F55\u6A21\u578B\u5747\u5E94\u4F18\u5148\u590D\u7528\u8FD9\u90E8\u5206\u4E0A\u4E0B\u6587\u3002",
    "\u76EE\u6807\u5377\u5408\u540C\uFF1A",
    JSON.stringify(volume, null, 2),
    "\u76F8\u5173\u4E3B\u7EBF\u5F27\uFF1A",
    JSON.stringify(relevantArcs, null, 2),
    "\u76F8\u5173\u4EBA\u7269\u6B63\u5178\uFF1A",
    JSON.stringify(relevantCharacters, null, 2),
    "\u672C\u5377\u4F0F\u7B14\u6392\u671F\uFF1A",
    JSON.stringify(relevantPromises, null, 2),
    "\u8FDE\u7EED\u6027\u6B63\u5178\uFF1A",
    JSON.stringify(input.storyBible.continuityCanon || [], null, 2),
    "\u5173\u7CFB\u6B63\u5178\uFF1A",
    JSON.stringify(input.storyBible.relationshipCanon || [], null, 2),
    "\u672C\u5377\u51BB\u7ED3\u4E3B\u7EBF\u5F27\uFF1A",
    volumeSourceArcIds.join("\u3001"),
    "\u672C\u5377\u8BA1\u5212\u4EBA\u7269\uFF1A",
    scheduledNames.join("\u3001"),
    "\u672C\u6279\u5F27\u7EBF\u8FDB\u5EA6\u5408\u540C\uFF08\u8FD9\u662F\u786C\u8FB9\u754C\uFF0C\u4E0D\u662F\u521B\u4F5C\u5EFA\u8BAE\uFF09\uFF1A",
    JSON.stringify(pacingContract, null, 2),
    "\u672C\u6279\u64CD\u4F5C\u7981\u4EE4\uFF08\u7531\u6B63\u5178\u3001\u4E0A\u4E00\u6279\u4EA4\u63A5\u548C\u5386\u53F2\u5931\u8D25\u5F52\u7EB3\uFF0C\u8FDD\u53CD\u4EFB\u4E00\u6761\u4F1A\u88AB\u6B63\u5178\u5BA1\u8BA1\u62E6\u622A\uFF09\uFF1A",
    operationalGuardrails.length ? operationalGuardrails.map((entry, index) => `${index + 1}. ${entry}`).join("\n") : "\u65E0\u989D\u5916\u64CD\u4F5C\u7981\u4EE4\u3002",
    `\u76EE\u6807\u5377\uFF1A${input.volumeId}\uFF0C\u5377\u8303\u56F4\u7B2C ${volume.startChapter}-${volume.endChapter} \u7AE0`,
    `\u672C\u6B21\u6279\u6B21\uFF1A\u7B2C ${input.startChapter}-${input.endChapter} \u7AE0\uFF0C\u5171 ${chapterNumbers.length} \u7AE0`,
    `\u5355\u7AE0\u76EE\u6807\u5B57\u6570\uFF1A${input.targetWordCount}`,
    "\u84DD\u56FE\u5B57\u6BB5\u8BED\u4E49\u786C\u89C4\u5219\uFF1AchapterGoal=\u672C\u7AE0\u5267\u60C5\u4EFB\u52A1\uFF1BprotagonistDecision=\u4E3B\u89D2\u672C\u7AE0\u505A\u51FA\u7684\u5177\u4F53\u9009\u62E9\uFF1BirreversibleChange=\u672C\u7AE0\u4E4B\u540E\u4E0D\u80FD\u56DE\u6EDA\u7684\u5267\u60C5\u53D8\u5316\uFF1BnextPressure=\u4E0B\u4E00\u7AE0\u5F00\u573A\u5FC5\u987B\u627F\u63A5\u7684\u65B0\u538B\u529B\u3002",
    "\u6781\u7B80\u751F\u6210\u786C\u89C4\u5219\uFF1A\u6BCF\u7AE0\u53EA\u5199\u4E00\u4E2A\u4E3B\u7EBF\u63A8\u8FDB\uFF0C\u4E0D\u5199\u573A\u666F\u62C6\u5206\uFF1B\u6BCF\u4E2A\u5B57\u6BB5 20-80 \u4E2A\u6C49\u5B57\uFF0C\u7981\u6B62\u957F\u6BB5\u8D26\u672C\u3002",
    "\u7CFB\u7EDF\u6258\u7BA1\u5B57\u6BB5\u786C\u89C4\u5219\uFF1A\u6280\u80FD\u3001\u7269\u54C1\u3001\u5012\u8BA1\u65F6\u3001\u767E\u5206\u6BD4\u3001\u88C2\u7EB9\u6570\u91CF\u3001\u4F4D\u7F6E\u8FB9\u754C\u3001\u4EBA\u7269\u4FE1\u4EFB\u7B49\u7EA7\u53EA\u5141\u8BB8\u653E\u5165 stateLedgerRefs \u77ED\u6807\u7B7E\uFF0C\u4E0D\u5F97\u5728\u56DB\u4E2A\u5267\u60C5\u5B57\u6BB5\u4E2D\u7ED3\u7B97\u3002",
    "\u5F27\u672B\u8F6C\u573A\u89C4\u5219\uFF1A\u5982\u679C\u672C\u6279\u5305\u542B arc_02 \u7B2C100\u7AE0\uFF0C\u53EA\u5141\u8BB8\u5199\u201C\u7384\u9ED8\u4F7F\u7528\u7834\u754C\u7B26\u63A5\u5E94\u9646\u65E0\u826F\u8FDB\u5165\u7B2C\u516B\u5C42\u201D\uFF1B\u4E0D\u5F97\u8BA9\u9646\u65E0\u826F\u7528\u53E4\u94A5\u5319\u3001\u81EA\u884C\u7834\u58C1\u6216\u5F3A\u884C\u6253\u5F00\u901A\u9053\u3002",
    `\u672C\u6279\u5B9E\u9645\u4E3B\u7EBF\u5F27\uFF1A${sourceArcIds.join("\u3001")}\uFF08source.sourceArcIds \u53EA\u80FD\u9010\u5B57\u4F7F\u7528\u672C\u5217\u8868\uFF09`,
    `\u672C\u8F6E\u989D\u5916\u5173\u6CE8\uFF1A${input.blueprintFocus || "\u4FDD\u8BC1\u76F8\u90BB\u7AE0\u8282\u56E0\u679C\u8FDE\u7EED\u3001\u573A\u666F\u76EE\u6807\u5177\u4F53\u3001\u4EBA\u7269\u77E5\u8BC6\u8FB9\u754C\u660E\u786E\u3001\u7AE0\u672B\u94A9\u5B50\u53EF\u76F4\u63A5\u9A71\u52A8\u4E0B\u4E00\u7AE0\u3002"}`,
    `\u4E0A\u4E00\u6279 Run\uFF1A${input.previousBatchRunId || "\u65E0\uFF08\u672C\u5377\u9996\u6279\uFF09"}`,
    `\u4E0A\u4E00\u6279\u5F3A\u5236\u4EA4\u63A5\uFF1A${input.previousBatchHandoff ? JSON.stringify(input.previousBatchHandoff) : "\u65E0"}`,
    "\u6301\u7EED\u5B66\u4E60\u4E0A\u4E0B\u6587\uFF1A",
    learningPrompt || "\u672C\u6B21\u672A\u52A0\u8F7D Learning Loop \u4E0A\u4E0B\u6587\u3002",
    `\u672C\u6B21\u8C03\u8BD5 Run\uFF1A${runId}`,
    `\u5206\u5377\u7B56\u7565 Run\uFF1A${input.upstreamRunId}`
  ].join("\n");
  const userMessage = [
    "\u751F\u6210 Lean Chapter Blueprint Batch JSON\uFF0C\u4E25\u683C\u4F7F\u7528\u4EE5\u4E0B\u9876\u5C42\u7ED3\u6784\uFF1A",
    "{",
    '  "version": 2,',
    '  "mode": "lean_chapter_blueprints",',
    '  "source": { "volumeStrategyRunId": "", "phase": "phase_8_volume_strategy", "volumeId": "", "volumeStartChapter": 1, "volumeEndChapter": 1, "batchStartChapter": 1, "batchEndChapter": 1, "sourceArcIds": [""], "previousBatchRunId": null, "previousBatchEndChapter": null },',
    '  "batchPolicy": { "targetWordCount": 0, "batchPurpose": "", "continuityRule": "", "stateBoundaryRule": "" },',
    '  "blueprints": [{ "chapterNumber": 1, "title": "", "volumeId": "", "sourceArcId": "", "previousPressure": "", "chapterGoal": "", "protagonistDecision": "", "irreversibleChange": "", "nextPressure": "", "requiredCharacters": [""], "stateLedgerRefs": [""], "forbiddenDrift": [""] }],',
    '  "batchContinuity": [{ "fromChapter": 1, "toChapter": 2, "carryover": "", "forbiddenReset": "" }],',
    '  "handoffToWritingPlan": { "chapterNumbers": [1], "executionOrder": [1], "batchExitPressure": "", "unresolvedRisks": [""] },',
    '  "qualitySelfCheck": { "allRequestedChaptersCovered": true, "continuousCausalChain": true, "noProseGenerated": true, "remainingRisks": [""] }',
    "}",
    `blueprints \u5FC5\u987B\u6070\u597D\u8986\u76D6\u7AE0\u8282\uFF1A${chapterNumbers.join("\u3001")}\uFF0C\u987A\u5E8F\u4E0D\u5F97\u6539\u53D8\u3002`,
    "sourceArcId \u5FC5\u987B\u662F\u8BE5\u7AE0\u6240\u5728\u7684\u51BB\u7ED3\u4E3B\u7EBF\u5F27\uFF1BvolumeId \u5FC5\u987B\u9010\u5B57\u7B49\u4E8E\u76EE\u6807\u5377\u3002",
    "requiredCharacters \u53EA\u80FD\u4F7F\u7528\u51BB\u7ED3\u4EBA\u7269\u59D3\u540D\u3002",
    "\u5B57\u6BB5\u5199\u6CD5\u5FC5\u987B\u662F\u6781\u7B80\u5267\u60C5\u63A8\u8FDB\u77ED\u53E5\uFF1B\u4E0D\u8981\u4F7F\u7528\u6B63\u6587\u5F0F\u53D9\u8FF0\u3001\u5BF9\u767D\u3001\u6292\u60C5\u3001\u955C\u5934\u63CF\u5199\u6216\u7CFB\u7EDF\u6821\u9A8C\u8BED\u8A00\u3002",
    "\u76F8\u90BB\u7AE0\u8282\u5FC5\u987B\u901A\u8FC7 nextPressure / previousPressure / batchContinuity \u5F62\u6210\u53EF\u68C0\u67E5\u7684\u56E0\u679C\u4EA4\u63A5\u3002",
    "\u5FC5\u987B\u4E25\u683C\u670D\u4ECE\u672C\u6279\u5F27\u7EBF\u8FDB\u5EA6\u5408\u540C\uFF1AmayTriggerMidpoint=false \u65F6\u4E0D\u5F97\u6D88\u8D39\u4E2D\u70B9\u9006\u8F6C\uFF1BmayResolveArc=false \u65F6\u4E0D\u5F97\u53D1\u751F\u5F27\u672B\u4E0D\u53EF\u9006\u7ED3\u5C40\u3001\u4E0D\u5F97\u91C7\u7528\u4E0B\u4E00\u5F27 openingState\u3001\u4E0D\u5F97\u8BA9\u6700\u540E\u4E00\u7AE0\u6216\u4E0B\u4E00\u7AE0\u4EA4\u63A5\u8D8A\u8FC7\u5F53\u524D\u5F27\u3002",
    "mayResolveArc=false \u65F6\uFF0CmustRemainUnresolved \u4E2D\u7684\u6838\u5FC3\u76EE\u6807\u3001\u6838\u5FC3\u538B\u529B\u548C\u5012\u8BA1\u65F6\u5728 batchExitState \u5FC5\u987B\u4ECD\u7136\u6709\u6548\uFF1B\u4E0D\u5F97\u7528\u2018\u5B8C\u5168\u95ED\u5408/\u6C38\u4E45\u6D88\u5931/\u5F7B\u5E95\u89E3\u9664\u2019\u7ED3\u675F\u672C\u6279\uFF0C\u4E5F\u4E0D\u5F97\u628A\u51BB\u7ED3\u4E0B\u9650\u6539\u6210\u66F4\u77ED\u65F6\u9650\u3002",
    "\u7981\u6B62\u628A\u6574\u6761\u4E3B\u7EBF\u5F27\u538B\u7F29\u8FDB\u5F53\u524D 1-12 \u7AE0\u6279\u6B21\u3002forbiddenFutureMilestones \u4E2D\u7684\u4E8B\u4EF6\u53EA\u80FD\u4F5C\u4E3A\u672A\u6765\u538B\u529B\u6216\u4F0F\u7B14\u88AB\u63D0\u53CA\uFF0C\u4E0D\u80FD\u5728\u672C\u6279\u5B9E\u9645\u53D1\u751F\u3001\u5B8C\u6210\u6216\u5199\u5165 batchExitState\u3002",
    "\u5FC5\u987B\u9075\u5B88\u672C\u6279\u64CD\u4F5C\u7981\u4EE4\uFF1B\u4E0D\u8981\u7528\u7A7A\u95F4\u8936\u76B1\u3001\u6807\u8BB0\u5F15\u7206\u3001\u767E\u5206\u6BD4\u6D88\u8017\u5E87\u62A4\u671F\u3001\u65E0\u56E0\u679C\u6062\u590D\u9053\u5177\u6570\u503C\u3001\u8BB0\u5FC6\u6B8B\u7559\u88AB\u8BC6\u522B\u3001\u53CD\u5411\u8FFD\u8E2A\u65E0\u9762\u7B49\u65B9\u5F0F\u7ED5\u8FC7\u6B63\u5178\u3002",
    input.previousBatchHandoff ? `\u672C\u6279\u7B2C ${input.startChapter} \u7AE0\u7684 previousChapterInput \u5FC5\u987B\u5B8C\u6574\u7EE7\u627F\u4E0A\u4E00\u6279\u4EA4\u63A5\uFF0C\u4E0D\u5F97\u91CD\u7F6E\u4EBA\u7269\u4F4D\u7F6E\u3001\u4F24\u52BF\u3001\u77E5\u8BC6\u3001\u5012\u8BA1\u65F6\u6216\u672A\u51B3\u538B\u529B\u3002` : "\u672C\u5377\u9996\u6279\u4E0D\u5F97\u4F2A\u9020\u4E0A\u4E00\u6279\u6765\u6E90\u3002",
    "\u4E0D\u5F97\u8F93\u51FA sceneCards\u3001writingPlan\u3001chapterDrafts\u3001prose\u3001\u6B63\u6587\u6BB5\u843D\u3001\u5BF9\u767D\u573A\u666F\u3001\u73AF\u5883\u63CF\u5199\u6216\u534E\u4E3D\u8F9E\u85FB\u3002"
  ].join("\n");
  const consensus = "\u7AE0\u8282\u84DD\u56FE\u72EC\u7ACB\u8C03\u8BD5\uFF1A\u51BB\u7ED3\u6B63\u5178\u4E0E\u8F93\u51FA\u8FB9\u754C\u4F18\u5148\uFF0C\u52A8\u6001 Run \u4FE1\u606F\u53EA\u7528\u4E8E\u8FFD\u8E2A\uFF0C\u4E0D\u5F97\u6539\u53D8\u6B63\u5178\u3002";
  const artifactProtocol = [
    "\u751F\u4EA7\u8D44\u4EA7\u751F\u6210\u534F\u8BAE\uFF1A",
    "- \u751F\u6210 phase_9_chapter_blueprints \u6781\u7B80\u7AE0\u8282\u4E3B\u7EBF\u84DD\u56FE\uFF0C\u4E0D\u8FDB\u884C\u5706\u684C\u8BA8\u8BBA\u3002",
    `- \u6BCF\u6B21\u53EA\u751F\u6210\u540C\u4E00\u5377\u5185\u4E00\u4E2A\u8FDE\u7EED\u6279\u6B21\uFF0C\u7A33\u5B9A\u6A21\u5F0F\u6700\u591A ${chapterBlueprintStableBatchLimit} \u7AE0\u3002`,
    "- \u8F93\u51FA\u5FC5\u987B\u80FD\u88AB phase_10_writing_plan \u76F4\u63A5\u6D88\u8D39\uFF1B\u672C\u9636\u6BB5\u53EA\u5B9A\u4E49\u7AE0\u8282\u63A8\u8FDB\u9AA8\u67B6\uFF0C\u4E0D\u5199\u771F\u5B9E\u7AE0\u8282\u5185\u5BB9\u3002"
  ].join("\n");
  const responseContract = [
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u53EA\u80FD\u8F93\u51FA\u5355\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728 chapter_blueprints_debug \u9636\u6BB5\u3002"
  ].join("\n");
  const systemPrompt = [consensus, artifactProtocol, basePrompt, dynamicPrompt, "\u8F93\u51FA\u8BED\u8A00\uFF1A\u7B80\u4F53\u4E2D\u6587", "\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1Achapter_blueprints_debug", "Discussion stage: specialist_turn", responseContract].join("\n\n");
  return { systemPrompt, consensus, basePrompt, dynamicPrompt, userMessage };
}
function buildChapterBlueprintRepairMessage(input, result, errors, learningPrompt = "") {
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index);
  const characters = volumeStrategyCharacterNames(input.storyBible);
  const batchArcIds = chapterBlueprintBatchArcIds(input);
  const pacingContract = chapterBlueprintPacingContract(input);
  const operationalGuardrails = chapterBlueprintOperationalGuardrails(input);
  const characterCanon = storyBibleSourceRecords(input.storyBible, "characterCanon");
  const terminology = storyBibleSourceRecords(input.storyBible, "terminology");
  const worldCanon = input.storyBible.worldCanon && typeof input.storyBible.worldCanon === "object" && !Array.isArray(input.storyBible.worldCanon) ? input.storyBible.worldCanon : {};
  return [
    "\u4E0A\u4E00\u7248 Lean Chapter Blueprint Batch \u672A\u901A\u8FC7\u7A0B\u5E8F\u6821\u9A8C\u3002\u53EA\u4FEE\u590D\u5217\u51FA\u7684\u5B57\u6BB5\u9519\u8BEF\uFF0C\u4FDD\u6301\u6781\u7B80\u7AE0\u8282\u4E3B\u7EBF\u84DD\u56FE\u3002",
    "\u4FEE\u590D\u76EE\u6807\u4E0D\u662F\u7AE0\u8282\u6B63\u6587\u3001\u4E0D\u662F\u573A\u666F\u5361\u3001\u4E0D\u662F\u8D26\u672C\u7ED3\u7B97\u3002\u6BCF\u7AE0\u53EA\u4FDD\u7559\uFF1AchapterGoal\u3001protagonistDecision\u3001irreversibleChange\u3001nextPressure\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5B8C\u6574\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u89E3\u91CA\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u56F4\u680F\u3002",
    `\u76EE\u6807\u5377\uFF1A${input.volumeId}\uFF1B\u5FC5\u987B\u6070\u597D\u8986\u76D6\u7AE0\u8282\uFF1A${chapterNumbers.join("\u3001")}`,
    `\u672C\u6279 source.sourceArcIds \u5FC5\u987B\u4F9D\u6B21\u4E14\u53EA\u80FD\u4E3A\uFF1A${batchArcIds.join("\u3001")}`,
    `\u5355\u7AE0\u76EE\u6807\u5B57\u6570\uFF1A${input.targetWordCount}`,
    `\u552F\u4E00\u5408\u6CD5\u7684\u6B63\u5178\u4EBA\u7269\uFF1A${characters.join("\u3001")}`,
    "requiredCharacters \u4E2D\u53EA\u80FD\u51FA\u73B0\u4E0A\u9762\u8FD9\u4EFD\u6B63\u5178\u4EBA\u7269\u767D\u540D\u5355\u91CC\u7684\u9010\u5B57\u59D3\u540D\u3002",
    "\u4E0D\u5F97\u53EA\u4FEE\u6539 qualitySelfCheck \u6765\u5BA3\u79F0\u5DF2\u7ECF\u4FEE\u590D\uFF1B\u5FC5\u987B\u4FEE\u6539\u88AB\u9519\u8BEF\u8BC1\u636E\u6307\u5411\u7684\u5177\u4F53\u7AE0\u8282\u3001\u573A\u666F\u5361\u3001\u4EBA\u7269\u6570\u7EC4\u3001\u77E5\u8BC6\u6216\u65F6\u95F4\u72B6\u6001\u3002",
    "\u5982\u679C\u5F53\u524D\u84DD\u56FE\u5DF2\u7ECF\u63D0\u524D\u6D88\u8D39\u5F27\u672B\u7ED3\u679C\u6216\u4E0B\u4E00\u5F27\u72B6\u6001\uFF0C\u5FC5\u987B\u91CD\u5199\u53D7\u5F71\u54CD\u7AE0\u8282\u7684\u56DB\u4E2A\u6838\u5FC3\u5B57\u6BB5\uFF0C\u4E0D\u80FD\u53EA\u66FF\u6362\u4E00\u4E2A\u654F\u611F\u8BCD\u3002",
    "\u6280\u80FD\u3001\u7269\u54C1\u3001\u5012\u8BA1\u65F6\u3001\u767E\u5206\u6BD4\u3001\u88C2\u7EB9\u6570\u91CF\u3001\u4F4D\u7F6E\u8FB9\u754C\u3001\u4EBA\u7269\u4FE1\u4EFB\u7B49\u7EA7\u53EA\u5141\u8BB8\u4F5C\u4E3A stateLedgerRefs \u77ED\u6807\u7B7E\uFF0C\u4E0D\u5F97\u5728\u56DB\u4E2A\u5267\u60C5\u5B57\u6BB5\u4E2D\u81EA\u7531\u7ED3\u7B97\u3002",
    "\u672C\u6279\u5F27\u7EBF\u8FDB\u5EA6\u5408\u540C\uFF08\u786C\u8FB9\u754C\uFF09\uFF1A",
    JSON.stringify(pacingContract, null, 2),
    "\u672C\u6279\u64CD\u4F5C\u7981\u4EE4\uFF08\u5FC5\u987B\u4FEE\u590D\u5230\u5B8C\u5168\u7B26\u5408\uFF1B\u8FDD\u53CD\u4EFB\u4E00\u6761\u4F1A\u88AB\u6B63\u5178\u5BA1\u8BA1\u62E6\u622A\uFF09\uFF1A",
    operationalGuardrails.length ? operationalGuardrails.map((entry, index) => `${index + 1}. ${entry}`).join("\n") : "\u65E0\u989D\u5916\u64CD\u4F5C\u7981\u4EE4\u3002",
    "\u6B63\u5178\u5BA1\u8BA1\u9519\u8BEF\u82E5\u6D89\u53CA\u64CD\u4F5C\u7981\u4EE4\uFF0C\u5FC5\u987B\u6539\u5199\u5177\u4F53\u8C03\u5EA6\u5408\u540C\u3001\u6570\u503C\u8D26\u672C\u548C\u4EBA\u7269\u77E5\u8BC6\u72B6\u6001\uFF1B\u4E0D\u5F97\u53EA\u6362\u540C\u4E49\u8BCD\u6216\u4FEE\u6539 qualitySelfCheck\u3002",
    "\u51BB\u7ED3\u4EBA\u7269\u6B63\u5178\u53EA\u7528\u4E8E\u4EBA\u7269\u767D\u540D\u5355\u4E0E\u77E5\u8BC6\u8FB9\u754C\uFF0C\u4E0D\u8981\u590D\u5236\u5927\u6BB5\u5185\u5BB9\u8FDB\u7ED3\u679C\uFF1A",
    JSON.stringify(characterCanon.slice(0, 12), null, 2),
    "\u51BB\u7ED3\u672F\u8BED\u53EA\u7528\u4E8E stateLedgerRefs \u77ED\u6807\u7B7E\uFF0C\u4E0D\u8981\u590D\u5236\u957F\u8D26\u672C\uFF1A",
    JSON.stringify(terminology, null, 2),
    "\u672C\u6B21 Learning Loop \u5DF2\u6E05\u7A7A\u6216\u4EC5\u4F5C\u53C2\u8003\uFF1B\u4E0D\u8981\u590D\u5236\u65E7\u9519\u8BEF\u65E5\u5FD7\uFF1A",
    learningPrompt || "\u672C\u6B21\u672A\u52A0\u8F7D Learning Loop \u4E0A\u4E0B\u6587\u3002",
    "\u5FC5\u987B\u4F7F\u7528 lean schema\uFF1Aversion=2, mode=lean_chapter_blueprints, blueprints \u6BCF\u7AE0\u53EA\u6709 previousPressure/chapterGoal/protagonistDecision/irreversibleChange/nextPressure/requiredCharacters/stateLedgerRefs/forbiddenDrift\u3002",
    "\u4E0D\u5F97\u751F\u6210 sceneCards\u3001\u5199\u4F5C\u8BA1\u5212\u3001\u7AE0\u8282\u6B63\u6587\u3001\u5BF9\u8BDD\u573A\u666F\u3001\u534E\u4E3D\u8F9E\u85FB\u3001\u955C\u5934\u63CF\u5199\u6216\u5FC3\u7406\u63CF\u5199\u3002",
    "\u7A0B\u5E8F\u6821\u9A8C\u9519\u8BEF\uFF1A",
    ...errors.map((error, index) => `${index + 1}. ${error}`),
    "\u4FEE\u590D\u540E\u4FDD\u6301\u6781\u7B80\uFF0C\u4E0D\u8981\u4E3A\u4E86\u51D1\u957F\u5EA6\u589E\u52A0\u5197\u4F59\u5B57\u6BB5\u3002",
    "\u9700\u8981\u4FEE\u590D\u7684\u4E0A\u4E00\u7248 JSON\uFF1A",
    JSON.stringify(result, null, 2)
  ].join("\n");
}
var chapterBlueprintRepairBasePrompt = "\u4F60\u662F lean \u7AE0\u8282\u84DD\u56FE JSON \u4FEE\u590D\u5668\u3002\u53EA\u4FEE\u590D\u6781\u7B80\u7AE0\u8282\u4E3B\u7EBF\u84DD\u56FE\u4E2D\u7684\u5B57\u6BB5\u9519\u8BEF\uFF1B\u6BCF\u7AE0\u53EA\u4FDD\u7559\u672C\u7AE0\u76EE\u6807\u3001\u4E3B\u89D2\u51B3\u5B9A\u3001\u4E0D\u53EF\u9006\u53D8\u5316\u3001\u4E0B\u4E00\u7AE0\u538B\u529B\uFF1B\u4E0D\u5F97\u751F\u6210\u573A\u666F\u5361\u3001\u8D26\u672C\u957F\u6BB5\u3001\u5199\u4F5C\u8BA1\u5212\u3001\u6B63\u6587\u3001\u5BF9\u767D\u6216\u6587\u5B66\u5316\u63CF\u5199\u3002";
var chapterBlueprintRepairConsensus = "lean \u7AE0\u8282\u84DD\u56FE\u6301\u7EED\u6536\u655B\u4FEE\u590D\uFF1A\u53EA\u4FEE\u4E3B\u7EBF\u9AA8\u67B6\u548C\u76F8\u90BB\u4EA4\u63A5\uFF0C\u4E0D\u628A\u6821\u9A8C/\u5BA1\u8BA1\u6587\u672C\u5199\u56DE\u84DD\u56FE\u3002";
function buildChapterBlueprintSemanticAuditPrompts(input, result, runId, learningPrompt = "") {
  const sourceArcIds = chapterBlueprintBatchArcIds(input);
  const arcCanon = storyBibleSourceRecords(input.storyBible, "arcCanon").filter((entry) => sourceArcIds.includes(String(entry.sourceArcId || "").trim()));
  const characterCanon = storyBibleSourceRecords(input.storyBible, "characterCanon");
  const terminology = storyBibleSourceRecords(input.storyBible, "terminology");
  const worldCanon = input.storyBible.worldCanon && typeof input.storyBible.worldCanon === "object" && !Array.isArray(input.storyBible.worldCanon) ? input.storyBible.worldCanon : {};
  const pacingContract = chapterBlueprintPacingContract(input);
  const operationalGuardrails = chapterBlueprintOperationalGuardrails(input);
  const basePrompt = [
    "\u4F60\u662F\u72EC\u7ACB\u7684\u5C0F\u8BF4\u6B63\u5178\u5BA1\u8BA1\u5458\uFF0C\u4E0D\u53C2\u4E0E\u521B\u4F5C\uFF0C\u4E5F\u4E0D\u80FD\u76F8\u4FE1\u88AB\u5BA1\u8BA1\u7ED3\u679C\u4E2D\u7684 qualitySelfCheck \u81EA\u8FF0\u3002",
    "\u9010\u7AE0\u68C0\u67E5\u7AE0\u8282\u84DD\u56FE\u662F\u5426\u8FDD\u53CD\u51BB\u7ED3\u5F27\u7EBF\u7AE0\u8282\u8FB9\u754C\u3001\u4E8B\u4EF6\u53D1\u751F\u65F6\u673A\u3001\u4EBA\u7269\u767B\u573A\u4E0E\u77E5\u8BC6\u8FB9\u754C\u3001\u80FD\u529B\u4EE3\u4EF7\u3001\u672F\u8BED\u6570\u503C\u3001\u4E16\u754C\u89C4\u5219\u548C\u4E0A\u4E00\u6279\u72B6\u6001\u3002",
    "\u53EA\u8981\u628A\u540E\u7EED\u5F27\u7684\u4E0D\u53EF\u9006\u7ED3\u679C\u63D0\u524D\u3001\u8BA9\u7981\u6B62\u4E8B\u4EF6\u53D1\u751F\u3001\u6539\u53D8\u51BB\u7ED3\u6570\u503C\u6216\u5236\u9020\u8DE8\u6279\u6B21\u72B6\u6001\u91CD\u7F6E\uFF0C\u5C31\u5FC5\u987B\u7ED9\u51FA error\u3002",
    "\u5FC5\u987B\u5B8C\u6210\u5168\u90E8\u7AE0\u8282\u548C\u5168\u90E8\u4E03\u7C7B\u7EF4\u5EA6\u540E\u518D\u8F93\u51FA\uFF0C\u4E00\u6B21\u5217\u51FA\u6240\u6709\u6709\u8BC1\u636E\u7684 error/warning\uFF0C\u7981\u6B62\u53D1\u73B0\u7B2C\u4E00\u6761\u9519\u8BEF\u540E\u63D0\u524D\u505C\u6B62\u3002",
    "\u7279\u522B\u68C0\u67E5\u5F27\u7EBF\u8FDB\u5EA6\u5408\u540C\uFF1AmayResolveArc=false \u65F6\uFF0C\u5F27\u672B\u4E0D\u53EF\u9006\u7ED3\u5C40\u3001\u4E0B\u4E00\u5F27 openingState \u548C\u8DE8\u5F27 batchExitState \u5747\u4E0D\u5F97\u51FA\u73B0\uFF1BmayTriggerMidpoint=false \u65F6\u4E0D\u5F97\u63D0\u524D\u6D88\u8D39\u4E2D\u70B9\u9006\u8F6C\u3002",
    "\u5F27\u7EA7 requiredCost\u3001character arcStateRequirements \u548C\u5176\u4ED6\u672A\u7ED1\u5B9A\u5177\u4F53\u7AE0\u8282\u7684 required* \u9879\uFF0C\u9ED8\u8BA4\u53EA\u8981\u6C42\u5728\u8BE5\u5F27\u7ED3\u675F\u524D\u5151\u73B0\uFF1B\u5F53 mayResolveArc=false \u65F6\uFF0C\u4E0D\u80FD\u56E0\u4E3A\u5F53\u524D\u5C40\u90E8\u6279\u6B21\u5C1A\u672A\u5151\u73B0\u5B83\u4EEC\u800C\u62A5 MISSING_REQUIRED_*\u3002",
    "\u51BB\u7ED3\u6B63\u5178\u51FA\u73B0\u8868\u9762\u51B2\u7A81\u65F6\uFF0C\u5148\u6BD4\u8F83\u7EA6\u675F\u5177\u4F53\u6027\uFF1A\u5E26\u660E\u786E\u7AE0\u8282\u951A\u70B9\u7684\u5408\u540C > \u5F53\u524D\u5F27 requiredCost/requiredEvent > \u5F53\u524D\u5F27 forbiddenDrift > \u901A\u7528\u672F\u8BED\u6216\u4E16\u754C\u89C4\u5219\u3002\u5F53\u524D\u5F27\u660E\u786E\u8981\u6C42\u7684\u4E8B\u4EF6\u5E94\u89C6\u4E3A\u901A\u7528\u89C4\u5219\u7684\u7A84\u8303\u56F4\u7279\u4F8B\uFF0C\u53EA\u80FD\u5728\u539F\u6587\u89C4\u6A21\u3001\u4EE3\u4EF7\u548C\u65F6\u673A\u5185\u653E\u884C\uFF0C\u4E0D\u5F97\u6269\u5C55\u3002",
    "\u4F8B\u5982\u5F53\u524D\u5F27 requiredCost \u660E\u786E\u8981\u6C42\u89E6\u53D1\u2018\u5C0F\u578B\u589F\u52AB\u2019\u65F6\uFF0C\u4E0D\u80FD\u4EC5\u51ED\u2018\u5E87\u62A4\u671F\u5185\u901A\u5E38\u4E0D\u89E6\u53D1\u589F\u52AB\u2019\u628A\u540C\u4E00\u5C0F\u578B\u4E8B\u4EF6\u5224\u4E3A WORLD_RULE_VIOLATION\uFF1B\u4F46\u9AD8\u5F3A\u5EA6\u589F\u52AB\u3001\u514D\u9664\u4EE3\u4EF7\u6216\u8D85\u51FA\u5F53\u524D\u5F27\u8981\u6C42\u7684\u91CD\u590D\u89E6\u53D1\u4ECD\u5FC5\u987B\u62A5\u9519\u3002",
    "\u53EA\u6709\u51BB\u7ED3\u6B63\u5178\u660E\u786E\u7ED9\u51FA\u672C\u6279\u8303\u56F4\u5185\u7684\u7AE0\u8282\u951A\u70B9\uFF0C\u6216\u8005\u84DD\u56FE\u5DF2\u7ECF\u5199\u51FA\u4E0E\u8BE5\u8981\u6C42\u76F8\u53CD/\u4E92\u65A5\u7684\u72B6\u6001\uFF0C\u624D\u80FD\u628A\u5C40\u90E8\u6279\u6B21\u4E2D\u7684\u7F3A\u5931\u5224\u4E3A error\uFF1B\u5426\u5219\u5E94\u7EE7\u7EED\u7559\u7ED9\u540E\u7EED\u6279\u6B21\uFF0C\u4E0D\u5F97\u4E3A\u4E86\u5BA1\u8BA1\u901A\u8FC7\u800C\u63D0\u524D\u6D88\u8D39\u672A\u6765\u4E8B\u4EF6\u3002",
    "\u68C0\u67E5 mustRemainUnresolved\uFF1AmayResolveArc=false \u65F6\uFF0C\u6838\u5FC3\u76EE\u6807\u3001\u6838\u5FC3\u538B\u529B\u4E0E\u5012\u8BA1\u65F6\u5728\u6279\u6B21\u9000\u51FA\u72B6\u6001\u5FC5\u987B\u4ECD\u7136\u6709\u6548\uFF0C\u4E0D\u80FD\u88AB\u5B8C\u5168\u95ED\u5408\u3001\u6C38\u4E45\u6D88\u5931\u3001\u5F7B\u5E95\u89E3\u9664\u6216\u7F29\u77ED\u5230\u51BB\u7ED3\u4E0B\u9650\u4EE5\u4E0B\u3002",
    "\u53EA\u8F93\u51FA\u4E00\u4E2A\u5408\u6CD5 JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown\u3002"
  ].join("\n");
  const dynamicPrompt = [
    "\u7F13\u5B58\u7A33\u5B9A\u524D\u7F00\uFF1A\u4EE5\u4E0B\u51BB\u7ED3\u6B63\u5178\u6309\u56FA\u5B9A\u987A\u5E8F\u5E8F\u5217\u5316\u3002",
    `\u51BB\u7ED3\u5F27\u7EBF\uFF1A${JSON.stringify(arcCanon)}`,
    `\u51BB\u7ED3\u672F\u8BED\uFF1A${JSON.stringify(terminology)}`,
    `\u51BB\u7ED3\u4E16\u754C\u89C4\u5219\uFF1A${JSON.stringify(worldCanon.rules || [])}`,
    `\u51BB\u7ED3\u4EBA\u7269\uFF1A${JSON.stringify(characterCanon)}`,
    `\u5F27\u7EBF\u8FDB\u5EA6\u786C\u5408\u540C\uFF1A${JSON.stringify(pacingContract)}`,
    `\u672C\u6279\u64CD\u4F5C\u7981\u4EE4\uFF1A${JSON.stringify(operationalGuardrails)}`,
    `\u5377\u4E0E\u6279\u6B21\uFF1A${input.volumeId} \u7B2C ${input.startChapter}-${input.endChapter} \u7AE0`,
    `\u4E0A\u4E00\u6279\u4EA4\u63A5\uFF1A${input.previousBatchHandoff ? JSON.stringify(input.previousBatchHandoff) : "\u65E0\uFF08\u5377\u9996\u6279\uFF09"}`,
    `\u6301\u7EED\u5B66\u4E60\u4E0A\u4E0B\u6587\uFF1A${learningPrompt || "\u672C\u6B21\u672A\u52A0\u8F7D Learning Loop \u4E0A\u4E0B\u6587\u3002"}`,
    `\u88AB\u5BA1\u8BA1 Run\uFF1A${runId}`
  ].join("\n\n");
  const userMessage = [
    "\u5BA1\u8BA1\u4EE5\u4E0B\u7AE0\u8282\u84DD\u56FE\uFF1A",
    JSON.stringify(result),
    "\u8F93\u51FA\u7ED3\u6784\uFF1A",
    '{"valid":false,"issues":[{"severity":"error","chapterNumber":1,"code":"ARC_BOUNDARY_EARLY","evidence":"\u84DD\u56FE\u4E2D\u7684\u539F\u6587\u8BC1\u636E","canonSource":"\u51B2\u7A81\u7684\u51BB\u7ED3\u6B63\u5178\u539F\u6587","message":"\u4E3A\u4EC0\u4E48\u51B2\u7A81"}],"checkedDimensions":["arcBoundary","timeline","characterState","knowledgeBoundary","terminologyAndCost","worldRules","crossBatchContinuity"]}',
    "severity \u53EA\u80FD\u662F error \u6216 warning\uFF1B\u4EFB\u4F55\u6B63\u5178\u51B2\u7A81\u5FC5\u987B\u662F error\u3002\u6CA1\u6709\u95EE\u9898\u65F6 valid=true \u4E14 issues=[]\u3002"
  ].join("\n");
  return { basePrompt, dynamicPrompt, consensus: "\u72EC\u7ACB\u6B63\u5178\u5BA1\u8BA1\uFF1A\u4E0D\u5F97\u4F9D\u636E\u751F\u6210\u6A21\u578B\u7684\u81EA\u68C0\u7ED3\u8BBA\u653E\u884C\uFF1B\u52A8\u6001 Run \u4FE1\u606F\u53EA\u7528\u4E8E\u8FFD\u8E2A\u3002", userMessage };
}
function normalizeChapterBlueprintSemanticAudit(input, audit) {
  if (!Array.isArray(audit.issues)) return audit;
  const pacingContract = chapterBlueprintPacingContract(input);
  const sourceArcIds = chapterBlueprintBatchArcIds(input);
  const arcCanon = storyBibleSourceRecords(input.storyBible, "arcCanon").filter((entry) => sourceArcIds.includes(String(entry.sourceArcId || "").trim()));
  const hasSmallCalamityArcException = arcCanon.some((entry) => /小型墟劫/u.test(String(entry.requiredCost || "")));
  const mayDeferArcRequirements = pacingContract.length > 0 && pacingContract.every((entry) => entry.mayResolveArc !== true);
  const deferredMissingCode = /^(?:MISSING_REQUIRED_(?:COST|STATE|EVENT)|MISSING_ARC_REQUIREMENT|CROSS_BATCH_STATE_MISMATCH|EXIT_STATE_MISMATCH)$/u;
  const issues = audit.issues.map((issue) => {
    const code = String(issue.code || "").trim();
    const canonSource = String(issue.canonSource || "");
    const explicitChapterAnchors = Array.from(canonSource.matchAll(/第\s*(\d+)\s*章/gu), (match) => Number(match[1]));
    const hasDueChapterAnchor = explicitChapterAnchors.some((chapter) => Number.isInteger(chapter) && chapter <= input.endChapter);
    const issueText = `${String(issue.evidence || "")} ${String(issue.message || "")}`;
    if (hasSmallCalamityArcException && String(issue.severity || "") === "error" && code === "WORLD_RULE_VIOLATION" && /墟劫/u.test(issueText) && /小型|未定向/u.test(issueText) && !/高强度|大型|完全免除代价/u.test(issueText)) {
      return {
        ...issue,
        severity: "warning",
        code: "ARC_SPECIFIC_WORLD_RULE_EXCEPTION",
        message: `\u5F53\u524D\u5F27 requiredCost \u5DF2\u660E\u786E\u8981\u6C42\u4E00\u6B21\u5C0F\u578B\u589F\u52AB\u53CA\u5176\u4EE3\u4EF7\uFF0C\u8FD9\u662F\u5BF9\u901A\u7528\u5E87\u62A4\u89C4\u5219\u7684\u7A84\u8303\u56F4\u7279\u4F8B\uFF1B\u4FDD\u7559\u4E3A\u63D0\u9192\uFF0C\u4F46\u4E0D\u80FD\u963B\u65AD\u672C\u6279\u3002\u539F\u5BA1\u8BA1\uFF1A${String(issue.message || "").trim()}`
      };
    }
    const isDeferredArcRequirement = deferredMissingCode.test(code) && /required(?:Cost|State|Event)|requiredCost|弧级|尚未兑现|未安排触发/u.test(`${canonSource} ${issueText}`);
    if (String(issue.severity || "") === "error" && /(?:未违反|正常的战术移动|符合单调|数值变化符合单调|数值上是连续|暂无严重违规|主要问题在于|需确保|需注意|可能违反|可能导致|略显单薄|建议|存在逻辑张力|存在.*风险|暗示|容易误导|措辞可能|表述模糊|质量问题|潜在冲突|未能有效推进|缺乏正典支持的细节)/u.test(issueText) && !/(?:直接违反|明确违反|成功寄宿|完全清除|引爆|撕裂空间|击穿天壁|离开墟境|恢复记忆|称.*师兄)/u.test(issueText)) {
      return {
        ...issue,
        severity: "warning",
        code: `NON_BLOCKING_${code || "SEMANTIC_NOTE"}`,
        message: `\u5BA1\u8BA1\u6587\u672C\u672C\u8EAB\u672A\u7ED9\u51FA\u660E\u786E\u6B63\u5178\u51B2\u7A81\uFF0C\u964D\u7EA7\u4E3A\u63D0\u9192\uFF1B\u4E0D\u963B\u65AD\u672C\u6279\u3002\u539F\u5BA1\u8BA1\uFF1A${String(issue.message || "").trim()}`
      };
    }
    if (String(issue.severity || "") === "error" && /(?:庇护期|金色标记)/u.test(issueText) && /(?:自然减少|自然时间|时间消耗|未扣除任何时间|只能按自然经过时间减少)/u.test(`${canonSource} ${issueText}`) && !/(?:小型墟劫|扣3个月|扣除三个月|大幅减少|自造百分比代价)/u.test(issueText)) {
      return {
        ...issue,
        severity: "warning",
        code: `NON_BLOCKING_${code || "TIMELINE_NOTE"}`,
        message: `\u5F53\u524D\u6279\u6B21\u672A\u89E6\u53D1\u660E\u786E\u5F27\u7EA7\u4EE3\u4EF7\uFF1B\u81EA\u7136\u65F6\u95F4\u7C92\u5EA6\u7531\u540E\u7EED\u6279\u6B21\u8D26\u672C\u7EE7\u7EED\u8FFD\u8E2A\uFF0C\u4E0D\u963B\u65AD\u672C\u6279\u3002\u539F\u5BA1\u8BA1\uFF1A${String(issue.message || "").trim()}`
      };
    }
    if (!mayDeferArcRequirements || String(issue.severity || "") !== "error" || !isDeferredArcRequirement || hasDueChapterAnchor) return issue;
    return {
      ...issue,
      severity: "warning",
      code: `DEFERRED_${code}`,
      message: `\u5F53\u524D\u6279\u6B21\u53EA\u8986\u76D6\u7B2C ${input.startChapter}-${input.endChapter} \u7AE0\uFF0C\u4E14\u5C1A\u672A\u5230\u5F27\u7EBF\u7ED3\u7B97\u70B9\uFF1B\u8BE5\u5F27\u7EA7\u8981\u6C42\u5E94\u7531\u540E\u7EED\u6279\u6B21\u7EE7\u7EED\u8FFD\u8E2A\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u672C\u6279\u7F3A\u5931\u9519\u8BEF\u3002\u539F\u5BA1\u8BA1\uFF1A${String(issue.message || "").trim()}`
    };
  });
  return {
    ...audit,
    valid: !issues.some((issue) => String(issue.severity || "") === "error"),
    issues
  };
}
function mergeChapterBlueprintSemanticAudit(structural, audit) {
  const errors = [...structural.errors];
  const warnings = [...structural.warnings];
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    if (structural.valid) errors.push("\u7F3A\u5C11\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\uFF1B\u7ED3\u6784\u5DF2\u901A\u8FC7\uFF0C\u4F46\u5C1A\u672A\u6267\u884C\u6B63\u5178\u5BA1\u8BA1\u3002");
    return { valid: false, errors, warnings };
  }
  const issues = Array.isArray(audit.issues) ? audit.issues : [];
  const blockingWarningCodes = /* @__PURE__ */ new Set([
    "TERM_COST_AMBIGUITY",
    "TERM_NUMERIC_AMBIGUITY",
    "TERMINOLOGY_COST_AMBIGUITY",
    "TERMINOLOGY_NUMERIC_AMBIGUITY"
  ]);
  if (!Array.isArray(audit.issues)) errors.push("semanticAudit.issues \u5FC5\u987B\u662F\u6570\u7EC4\u3002");
  issues.forEach((issue, index) => {
    const severity = String(issue.severity || "").trim();
    const message = String(issue.message || "").trim();
    const evidence = String(issue.evidence || "").trim();
    const canonSource = String(issue.canonSource || "").trim();
    if (!message || !evidence || !canonSource || !["error", "warning"].includes(severity)) {
      errors.push(`semanticAudit.issues[${index}] \u7ED3\u6784\u4E0D\u5B8C\u6574\u3002`);
      return;
    }
    const chapter = Number(issue.chapterNumber);
    const label = Number.isInteger(chapter) ? `\u7B2C${chapter}\u7AE0` : "\u6279\u6B21";
    const code = String(issue.code || "CANON_CONFLICT").trim();
    const formatted = `${label} ${code}\uFF1A${message}\uFF5C\u8BC1\u636E\uFF1A${evidence}\uFF5C\u6B63\u5178\uFF1A${canonSource}`;
    if (severity === "error" || blockingWarningCodes.has(code)) errors.push(formatted);
    else warnings.push(formatted);
  });
  if (audit.valid !== true && !issues.some((issue) => String(issue.severity || "") === "error")) errors.push("semanticAudit.valid=false\uFF0C\u4F46\u672A\u63D0\u4F9B\u5BF9\u5E94 error \u8BC1\u636E\u3002");
  if (audit.valid === true && issues.some((issue) => String(issue.severity || "") === "error")) errors.push("semanticAudit.valid \u4E0E error \u5217\u8868\u77DB\u76FE\u3002");
  if (!Array.isArray(audit.checkedDimensions) || audit.checkedDimensions.length < 7) errors.push("semanticAudit.checkedDimensions \u672A\u8986\u76D6\u5168\u90E8\u4E03\u7C7B\u6B63\u5178\u68C0\u67E5\u3002");
  return { valid: errors.length === 0, errors, warnings };
}
function validateFoundation(result) {
  const errors = [];
  const warnings = [];
  const arrayMin = [
    ["worldRules", 6],
    ["factions", 3],
    ["characters", 5],
    ["subplots", 2],
    ["foreshadowing", 6],
    ["arcPlan", 4]
  ];
  for (const [key, minimum] of arrayMin) {
    const value = result[key];
    if (!Array.isArray(value) || value.length < minimum) errors.push(`${key} \u81F3\u5C11\u9700\u8981 ${minimum} \u9879\uFF0C\u5B9E\u9645 ${Array.isArray(value) ? value.length : 0} \u9879\u3002`);
  }
  for (const key of ["project", "background", "mainConflict", "mainPlot", "canon", "qualitySelfCheck"]) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u975E\u7A7A\u5BF9\u8C61\u3002`);
  }
  const serialized = JSON.stringify(result);
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) {
    errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  }
  if (serialized.length < 8e3) warnings.push(`\u7ED3\u6784\u5316\u7ED3\u679C\u53EA\u6709 ${serialized.length} \u5B57\u7B26\uFF0C\u53EF\u80FD\u4E0D\u591F\u5B8C\u6574\u3002`);
  const names = Array.isArray(result.characters) ? result.characters.map((item) => String(item?.name || "")).filter(Boolean) : [];
  if (new Set(names).size !== names.length) errors.push("characters \u4E2D\u5B58\u5728\u91CD\u590D\u59D3\u540D\u3002");
  return { valid: errors.length === 0, errors, warnings };
}
function validateCharacterPlan(result, input) {
  const errors = [];
  const warnings = [];
  const inheritedNames = worldCharacterNames(input.worldFoundation);
  const minimum = Math.max(inheritedNames.length, characterTargetForScale(input.totalChapters));
  const characters = Array.isArray(result.characters) ? result.characters : [];
  if (characters.length < minimum) errors.push(`characters \u81F3\u5C11\u9700\u8981 ${minimum} \u4EBA\uFF0C\u5B9E\u9645 ${characters.length} \u4EBA\u3002`);
  const names = characters.map((item) => String(item?.name || "").trim()).filter(Boolean);
  if (new Set(names).size !== names.length) errors.push("characters \u4E2D\u5B58\u5728\u91CD\u590D\u59D3\u540D\u3002");
  const ambiguousNames = names.filter((name) => ["\u65E0\u540D", "\u67D0\u4EBA", "\u795E\u79D8\u4EBA", "\u672A\u77E5", "\u672A\u77E5\u8005", "\u672A\u547D\u540D"].includes(name));
  if (ambiguousNames.length) errors.push(`\u4EBA\u7269\u59D3\u540D\u5FC5\u987B\u5177\u4F53\uFF0C\u68C0\u6D4B\u5230\u6A21\u7CCA\u59D3\u540D\uFF1A${[...new Set(ambiguousNames)].join("\u3001")}\u3002`);
  const missingInherited = inheritedNames.filter((name) => !names.includes(name));
  if (missingInherited.length) errors.push(`\u672A\u5B8C\u6574\u7EE7\u627F\u4E0A\u6E38\u4EBA\u7269\uFF1A${missingInherited.join("\u3001")}\u3002`);
  const requiredTextFields = ["name", "origin", "tier", "role", "identity", "narrativeFunction", "desire", "wound", "fear", "misbelief", "secret", "speechPattern"];
  characters.forEach((character, index) => {
    const missing = requiredTextFields.filter((key) => !String(character[key] || "").trim());
    if (missing.length) errors.push(`characters[${index}] \u7F3A\u5C11\u5B57\u6BB5\uFF1A${missing.join("\u3001")}\u3002`);
    const evasiveFields = ["desire", "wound", "fear", "misbelief", "secret", "speechPattern"].filter((key) => /^(?:无|没有|不适用|暂无|未知)(?:$|[（(])/u.test(String(character[key] || "").trim()));
    if (evasiveFields.length) errors.push(`characters[${index}] \u7528\u201C\u65E0/\u6CA1\u6709/\u672A\u77E5\u201D\u89C4\u907F\u5173\u952E\u6863\u6848\u5B57\u6BB5\uFF1A${evasiveFields.join("\u3001")}\u3002`);
    for (const key of ["values", "behaviorHabits", "skills", "limitations", "relationships", "continuityLocks"]) {
      if (!Array.isArray(character[key]) || !character[key].length) errors.push(`characters[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    }
    for (const key of ["knowledgeBoundary", "trajectory", "entry", "exitOrTransformation"]) {
      if (!character[key] || typeof character[key] !== "object" || Array.isArray(character[key])) errors.push(`characters[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u5BF9\u8C61\u3002`);
    }
    const trajectory = character.trajectory && typeof character.trajectory === "object" && !Array.isArray(character.trajectory) ? character.trajectory : {};
    if (/^(?:无|没有|不适用|暂无|未知)(?:$|[（(])/u.test(String(trajectory.irreversibleCost || "").trim())) {
      errors.push(`characters[${index}].trajectory.irreversibleCost \u5FC5\u987B\u7ED9\u51FA\u5177\u4F53\u4E14\u4E0D\u53EF\u9006\u7684\u4EE3\u4EF7\u3002`);
    }
  });
  const relationshipGraph = Array.isArray(result.relationshipGraph) ? result.relationshipGraph : [];
  const relationshipMinimum = Math.max(5, Math.ceil(characters.length * 0.75));
  if (relationshipGraph.length < relationshipMinimum) errors.push(`relationshipGraph \u81F3\u5C11\u9700\u8981 ${relationshipMinimum} \u6761\u6709\u6548\u5173\u7CFB\uFF0C\u5B9E\u9645 ${relationshipGraph.length} \u6761\u3002`);
  if (!Array.isArray(result.roleCoverage) || result.roleCoverage.length < 8) errors.push("roleCoverage \u81F3\u5C11\u9700\u8981\u8986\u76D6 8 \u7C7B\u53D9\u4E8B\u529F\u80FD\u3002");
  const upstreamArcs = Array.isArray(input.worldFoundation.arcPlan) ? input.worldFoundation.arcPlan.length : 0;
  if (!Array.isArray(result.arcEntryPlan) || result.arcEntryPlan.length < Math.max(1, upstreamArcs)) errors.push(`arcEntryPlan \u81F3\u5C11\u9700\u8981 ${Math.max(1, upstreamArcs)} \u6BB5\u3002`);
  for (const key of ["source", "scalePlan", "expansionRules", "continuityLocks", "qualitySelfCheck"]) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u975E\u7A7A\u5BF9\u8C61\u3002`);
  }
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  const serializedLength = JSON.stringify(result).length;
  if (serializedLength < minimum * 900) warnings.push(`\u4EBA\u7269\u89C4\u5212\u53EA\u6709 ${serializedLength} \u5B57\u7B26\uFF0C${minimum} \u4EBA\u7684\u6863\u6848\u53EF\u80FD\u4E0D\u591F\u5B8C\u6574\u3002`);
  return { valid: errors.length === 0, errors, warnings };
}
function validateInitialCharacterState(result, input) {
  const errors = [];
  const warnings = [];
  const plannedNames = plannedCharacterNames(input.characterPlanning);
  const plannedNameSet = new Set(plannedNames);
  const upstreamRelationships = Array.isArray(input.characterPlanning.relationshipGraph) ? input.characterPlanning.relationshipGraph : [];
  const characters = Array.isArray(result.characters) ? result.characters : [];
  const stateNames = characters.map((item) => String(item.name || "").trim()).filter(Boolean);
  const missingNames = plannedNames.filter((name) => !stateNames.includes(name));
  const addedNames = stateNames.filter((name) => !plannedNameSet.has(name));
  if (characters.length !== plannedNames.length) errors.push(`characters \u5FC5\u987B\u6070\u597D ${plannedNames.length} \u4EBA\uFF0C\u5B9E\u9645 ${characters.length} \u4EBA\u3002`);
  if (new Set(stateNames).size !== stateNames.length) errors.push("characters \u4E2D\u5B58\u5728\u91CD\u590D\u59D3\u540D\u3002");
  if (missingNames.length) errors.push(`\u7F3A\u5C11\u5DF2\u89C4\u5212\u4EBA\u7269\u7684\u521D\u59CB\u72B6\u6001\uFF1A${missingNames.join("\u3001")}\u3002`);
  if (addedNames.length) errors.push(`\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u8282\u70B9\u7981\u6B62\u65B0\u589E\u4EBA\u7269\uFF1A${[...new Set(addedNames)].join("\u3001")}\u3002`);
  const evasivePattern = /^(?:无|没有|不适用|暂无|未知|待定|暂未登场|等待剧情需要)(?:$|[，。；：、（(])/u;
  const requiredTextFields = ["name", "presence", "location", "currentGoal", "immediatePressure", "physicalState", "emotionalState", "publicIdentity", "hiddenIdentity", "openingAction"];
  characters.forEach((character, index) => {
    const missing = requiredTextFields.filter((key) => !String(character[key] || "").trim());
    if (missing.length) errors.push(`characters[${index}] \u7F3A\u5C11\u5B57\u6BB5\uFF1A${missing.join("\u3001")}\u3002`);
    const evasive = requiredTextFields.filter((key) => evasivePattern.test(String(character[key] || "").trim()));
    if (evasive.length) errors.push(`characters[${index}] \u7528\u7A7A\u6D1E\u5185\u5BB9\u89C4\u907F\u72B6\u6001\u5B57\u6BB5\uFF1A${evasive.join("\u3001")}\u3002`);
    if (!["onstage", "offstage", "dormant"].includes(String(character.presence || ""))) errors.push(`characters[${index}].presence \u5FC5\u987B\u662F onstage\u3001offstage \u6216 dormant\u3002`);
    for (const key of ["resources", "liabilities", "secrets", "stateLocks"]) {
      if (!Array.isArray(character[key]) || !character[key].length) errors.push(`characters[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    }
    if (!Array.isArray(character.relationships)) errors.push(`characters[${index}].relationships \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
    for (const key of ["knowledge", "firstAppearance"]) {
      if (!character[key] || typeof character[key] !== "object" || Array.isArray(character[key])) errors.push(`characters[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u5BF9\u8C61\u3002`);
    }
    const knowledge = character.knowledge && typeof character.knowledge === "object" && !Array.isArray(character.knowledge) ? character.knowledge : {};
    for (const key of ["knows", "believes", "mustNotKnowYet"]) {
      if (!Array.isArray(knowledge[key]) || !knowledge[key].length) errors.push(`characters[${index}].knowledge.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    }
    const relationships = Array.isArray(character.relationships) ? character.relationships : [];
    const characterName = String(character.name || "").trim();
    const expectedTargets = new Set(upstreamRelationships.flatMap((relationship) => {
      const from = String(relationship.from || "").trim();
      const to = String(relationship.to || "").trim();
      if (from === characterName) return [to];
      if (to === characterName) return [from];
      return [];
    }).filter(Boolean));
    const actualTargets = relationships.map((relationship) => String(relationship.target || "").trim()).filter(Boolean);
    const unexpectedTargets = actualTargets.filter((target) => !expectedTargets.has(target));
    if (new Set(actualTargets).size !== actualTargets.length) errors.push(`characters[${index}].relationships \u5B58\u5728\u91CD\u590D\u76EE\u6807\u3002`);
    if (unexpectedTargets.length) errors.push(`characters[${index}].relationships \u5305\u542B\u975E\u4E0A\u6E38\u5173\u7CFB\u76EE\u6807\uFF1A${[...new Set(unexpectedTargets)].join("\u3001")}\u3002`);
    relationships.forEach((relationship, relationshipIndex) => {
      const target = String(relationship.target || "").trim();
      if (!plannedNameSet.has(target)) errors.push(`characters[${index}].relationships[${relationshipIndex}] \u6307\u5411\u672A\u89C4\u5212\u4EBA\u7269\uFF1A${target || "\u7A7A"}\u3002`);
      const scores = ["trust", "affection", "fear", "debt", "leverage"].map((key) => Number(relationship[key]));
      if (scores.some((score) => !Number.isInteger(score) || score < -100 || score > 100)) errors.push(`characters[${index}].relationships[${relationshipIndex}] \u7684\u5173\u7CFB\u6570\u503C\u5FC5\u987B\u662F -100 \u5230 100 \u7684\u6574\u6570\u3002`);
      for (const key of ["surfaceState", "hiddenTension"]) {
        const value = String(relationship[key] || "").trim();
        if (!value || evasivePattern.test(value)) errors.push(`characters[${index}].relationships[${relationshipIndex}].${key} \u5FC5\u987B\u662F\u5177\u4F53\u5173\u7CFB\u4E8B\u5B9E\u3002`);
      }
    });
  });
  const plannedCharacters = Array.isArray(input.characterPlanning.characters) ? input.characterPlanning.characters : [];
  const protagonistName = String(plannedCharacters.find((item) => /主角|protagonist/u.test(`${item.role || ""} ${item.narrativeFunction || ""}`))?.name || plannedNames[0] || "");
  const protagonistState = characters.find((item) => String(item.name || "") === protagonistName);
  if (!protagonistState) errors.push(`\u627E\u4E0D\u5230\u4E3B\u89D2 ${protagonistName || "\uFF08\u672A\u8BC6\u522B\uFF09"} \u7684\u521D\u59CB\u72B6\u6001\u3002`);
  else if (protagonistState.presence !== "onstage") errors.push(`\u4E3B\u89D2 ${protagonistName} \u5728\u6545\u4E8B\u5F00\u573A\u5FC5\u987B\u662F onstage\u3002`);
  const upstreamRelationshipCount = upstreamRelationships.length;
  const relationshipLedger = Array.isArray(result.relationshipStateLedger) ? result.relationshipStateLedger : [];
  if (relationshipLedger.length !== upstreamRelationshipCount) errors.push(`relationshipStateLedger \u5FC5\u987B\u6070\u597D ${upstreamRelationshipCount} \u6761\uFF0C\u5B9E\u9645 ${relationshipLedger.length} \u6761\u3002`);
  const expectedLedgerEdges = new Set(upstreamRelationships.map((relationship) => `${String(relationship.from || "").trim()}\u2192${String(relationship.to || "").trim()}`));
  const actualLedgerEdges = relationshipLedger.map((relationship) => `${String(relationship.from || "").trim()}\u2192${String(relationship.to || "").trim()}`);
  const missingLedgerEdges = [...expectedLedgerEdges].filter((edge) => !actualLedgerEdges.includes(edge));
  const unexpectedLedgerEdges = actualLedgerEdges.filter((edge) => !expectedLedgerEdges.has(edge));
  if (new Set(actualLedgerEdges).size !== actualLedgerEdges.length) errors.push("relationshipStateLedger \u5B58\u5728\u91CD\u590D\u5173\u7CFB\u8FB9\u3002");
  if (missingLedgerEdges.length) errors.push(`relationshipStateLedger \u7F3A\u5C11\u4E0A\u6E38\u5173\u7CFB\u8FB9\uFF1A${missingLedgerEdges.join("\u3001")}\u3002`);
  if (unexpectedLedgerEdges.length) errors.push(`relationshipStateLedger \u5305\u542B\u975E\u4E0A\u6E38\u5173\u7CFB\u8FB9\uFF1A${[...new Set(unexpectedLedgerEdges)].join("\u3001")}\u3002`);
  relationshipLedger.forEach((relationship, index) => {
    const from = String(relationship.from || "").trim();
    const to = String(relationship.to || "").trim();
    if (!plannedNameSet.has(from) || !plannedNameSet.has(to)) errors.push(`relationshipStateLedger[${index}] \u53EA\u80FD\u5F15\u7528\u5DF2\u89C4\u5212\u4EBA\u7269\u3002`);
    const scores = ["trust", "affection", "fear", "debt", "leverage"].map((key) => Number(relationship[key]));
    if (scores.some((score) => !Number.isInteger(score) || score < -100 || score > 100)) errors.push(`relationshipStateLedger[${index}] \u7684\u5173\u7CFB\u6570\u503C\u5FC5\u987B\u662F -100 \u5230 100 \u7684\u6574\u6570\u3002`);
    for (const key of ["surfaceState", "hiddenTension", "firstChangeTrigger"]) {
      const value = String(relationship[key] || "").trim();
      if (!value || evasivePattern.test(value)) errors.push(`relationshipStateLedger[${index}].${key} \u5FC5\u987B\u662F\u5177\u4F53\u5173\u7CFB\u4E8B\u5B9E\u3002`);
    }
  });
  for (const key of ["source", "openingFrame", "continuityLocks", "handoffToWorldMatrix", "qualitySelfCheck"]) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u975E\u7A7A\u5BF9\u8C61\u3002`);
  }
  for (const key of ["activeClocks", "openingKnowledgeLocks"]) {
    if (!Array.isArray(result[key]) || !result[key].length) errors.push(`${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  }
  const openingFrame = result.openingFrame && typeof result.openingFrame === "object" && !Array.isArray(result.openingFrame) ? result.openingFrame : {};
  for (const key of ["time", "primaryLocation", "publicSituation", "hiddenSituation", "activeDeadline", "incitingTrigger", "firstChapterGoal", "firstChapterObstacle", "irreversibleRisk"]) {
    const value = String(openingFrame[key] || "").trim();
    if (!value || evasivePattern.test(value)) errors.push(`openingFrame.${key} \u5FC5\u987B\u662F\u5177\u4F53\u7684\u5F00\u573A\u72B6\u6001\u3002`);
  }
  if (Number(openingFrame.chapter) !== input.openingChapter) errors.push(`openingFrame.chapter \u5FC5\u987B\u662F ${input.openingChapter}\u3002`);
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  const serializedLength = JSON.stringify(result).length;
  if (serializedLength < plannedNames.length * 700) warnings.push(`\u521D\u59CB\u72B6\u6001\u53EA\u6709 ${serializedLength} \u5B57\u7B26\uFF0C${plannedNames.length} \u4EBA\u7684\u72B6\u6001\u53EF\u80FD\u4E0D\u591F\u5177\u4F53\u3002`);
  return { valid: errors.length === 0, errors, warnings };
}
function validateWorldMatrix(result, input) {
  const errors = [];
  const warnings = [];
  const evasivePattern = /^(?:无|没有|不适用|暂无|未知|待定|暂未登场|等待剧情需要|TBD|XXX)(?:$|[，。；：、（(])/iu;
  const stateCharacters = initialStateCharacters(input.initialCharacterState);
  const frozenNames = stateCharacters.map((character) => String(character.name || "").trim()).filter(Boolean);
  const frozenNameSet = new Set(frozenNames);
  const stateByName = new Map(stateCharacters.map((character) => [String(character.name || "").trim(), character]));
  const sourceLocations = openingLocationNames(input.initialCharacterState);
  const worldRules = Array.isArray(input.worldFoundation.worldRules) ? input.worldFoundation.worldRules : [];
  const sourceRuleNames = worldRules.map((rule) => String(rule.name || "").trim()).filter(Boolean);
  const sourceFactions = Array.isArray(input.worldFoundation.factions) ? input.worldFoundation.factions : [];
  const sourceFactionNames = sourceFactions.map((faction) => String(faction.name || "").trim()).filter(Boolean);
  const sourceClocks = Array.isArray(input.initialCharacterState.activeClocks) ? input.initialCharacterState.activeClocks : [];
  const sourceClockNames = sourceClocks.map((clock) => String(clock.name || "").trim()).filter(Boolean);
  const sourceKnowledgeLocks = Array.isArray(input.initialCharacterState.openingKnowledgeLocks) ? input.initialCharacterState.openingKnowledgeLocks : [];
  const sourceFacts = sourceKnowledgeLocks.map((lock) => String(lock.fact || "").trim()).filter(Boolean);
  const sourceContinuityLocks = continuityLockSources(input.initialCharacterState);
  for (const key of ["source", "project", "openingWorldSlice", "handoffToPlotArchitecture", "qualitySelfCheck"]) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u975E\u7A7A\u5BF9\u8C61\u3002`);
  }
  for (const key of ["rules", "locations", "factions", "institutions", "resources", "pressureSystems", "knowledgeBarriers", "characterWorldInterfaces", "travelAndAccess", "continuityAnchors"]) {
    if (!Array.isArray(result[key]) || !result[key].length) errors.push(`${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  }
  for (const forbidden of ["plotArchitecture", "chapters", "arcPlan", "mainPlot", "volumeStrategy", "chapterBlueprints"]) {
    if (forbidden in result) errors.push(`\u4E16\u754C\u77E9\u9635\u8282\u70B9\u7981\u6B62\u63D0\u524D\u751F\u6210 ${forbidden}\u3002`);
  }
  const validateText = (entry, keys, pathLabel) => {
    for (const key of keys) {
      const value = String(entry[key] || "").trim();
      if (!value || evasivePattern.test(value)) errors.push(`${pathLabel}.${key} \u5FC5\u987B\u662F\u5177\u4F53\u5185\u5BB9\u3002`);
    }
  };
  const validateCharacterArray = (value, pathLabel) => {
    if (!Array.isArray(value)) return errors.push(`${pathLabel} \u5FC5\u987B\u662F\u4EBA\u7269\u59D3\u540D\u6570\u7EC4\u3002`);
    const invalid = value.map((item) => String(item || "").trim()).filter((name) => !frozenNameSet.has(name));
    if (invalid.length) errors.push(`${pathLabel} \u5F15\u7528\u4E86\u975E\u51BB\u7ED3\u4EBA\u7269\uFF1A${[...new Set(invalid)].join("\u3001")}\u3002`);
  };
  const rules = Array.isArray(result.rules) ? result.rules : [];
  const mappedRuleNames = rules.map((rule) => String(rule.sourceRule || "").trim()).filter(Boolean);
  if (rules.length !== sourceRuleNames.length) errors.push(`rules \u5FC5\u987B\u4E0E ${sourceRuleNames.length} \u6761\u4E0A\u6E38\u89C4\u5219\u4E00\u4E00\u5BF9\u5E94\uFF0C\u5B9E\u9645 ${rules.length} \u6761\u3002`);
  const missingRules = sourceRuleNames.filter((name) => !mappedRuleNames.includes(name));
  const extraRules = mappedRuleNames.filter((name) => !sourceRuleNames.includes(name));
  if (new Set(mappedRuleNames).size !== mappedRuleNames.length) errors.push("rules.sourceRule \u5B58\u5728\u91CD\u590D\u6765\u6E90\u3002");
  if (missingRules.length) errors.push(`rules \u7F3A\u5C11\u4E0A\u6E38\u89C4\u5219\uFF1A${missingRules.join("\u3001")}\u3002`);
  if (extraRules.length) errors.push(`rules \u5F15\u5165\u4E86\u672A\u6279\u51C6\u89C4\u5219\u6765\u6E90\uFF1A${[...new Set(extraRules)].join("\u3001")}\u3002`);
  rules.forEach((rule, index) => {
    validateText(rule, ["id", "name", "sourceRule", "rule", "execution", "visibleSignal", "cost", "exceptions", "breakConsequence"], `rules[${index}]`);
    validateCharacterArray(rule.affectedCharacters, `rules[${index}].affectedCharacters`);
  });
  const locations = Array.isArray(result.locations) ? result.locations : [];
  const mappedLocations = locations.map((location) => String(location.sourceLocation || "").trim()).filter(Boolean);
  const missingLocations = sourceLocations.filter((location) => !mappedLocations.includes(location));
  if (missingLocations.length) errors.push(`locations \u7F3A\u5C11\u51BB\u7ED3\u5F00\u573A\u5730\u70B9\uFF1A${missingLocations.join("\uFF5C")}\u3002`);
  locations.forEach((location, index) => {
    validateText(location, ["id", "name", "sourceLocation", "derivedBasis", "layer", "category", "openingState", "offstagePressure", "exitCost", "storyUse"], `locations[${index}]`);
    for (const key of ["governingRules", "factions", "resources", "accessConditions"]) {
      if (!Array.isArray(location[key]) || !location[key].length) errors.push(`locations[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    }
    validateCharacterArray(location.presentCharacters, `locations[${index}].presentCharacters`);
  });
  const factions = Array.isArray(result.factions) ? result.factions : [];
  const mappedFactions = factions.map((faction) => String(faction.sourceFaction || "").trim()).filter(Boolean);
  const missingFactions = sourceFactionNames.filter((name) => !mappedFactions.includes(name));
  if (missingFactions.length) errors.push(`factions \u7F3A\u5C11\u4E0A\u6E38\u52BF\u529B\uFF1A${missingFactions.join("\u3001")}\u3002`);
  factions.forEach((faction, index) => {
    validateText(faction, ["name", "sourceFaction", "goal", "method", "internalPressure", "externalPressure"], `factions[${index}]`);
    for (const key of ["territory", "resources", "taboos"]) {
      if (!Array.isArray(faction[key]) || !faction[key].length) errors.push(`factions[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    }
    const interfaces2 = Array.isArray(faction.characterInterfaces) ? faction.characterInterfaces : [];
    interfaces2.forEach((entry, interfaceIndex) => {
      validateText(entry, ["character", "status", "pressure", "availableChoice"], `factions[${index}].characterInterfaces[${interfaceIndex}]`);
      if (!frozenNameSet.has(String(entry.character || "").trim())) errors.push(`factions[${index}].characterInterfaces[${interfaceIndex}].character \u4E0D\u662F\u51BB\u7ED3\u4EBA\u7269\u3002`);
    });
  });
  const institutions = Array.isArray(result.institutions) ? result.institutions : [];
  institutions.forEach((institution, index) => {
    validateText(institution, ["name", "scope", "procedure", "enforcement", "loophole", "characterCost"], `institutions[${index}]`);
    validateCharacterArray(institution.affectedCharacters, `institutions[${index}].affectedCharacters`);
  });
  const resources = Array.isArray(result.resources) ? result.resources : [];
  resources.forEach((resource, index) => {
    validateText(resource, ["name", "source", "location", "capability", "cost", "scarcity", "transferRule", "conflictUse"], `resources[${index}]`);
    validateCharacterArray(resource.holderCharacters, `resources[${index}].holderCharacters`);
    if (!Array.isArray(resource.holderOrganizations)) errors.push(`resources[${index}].holderOrganizations \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
  });
  const pressures = Array.isArray(result.pressureSystems) ? result.pressureSystems : [];
  const mappedClocks = pressures.map((pressure) => String(pressure.sourceClock || "").trim()).filter(Boolean);
  const missingClocks = sourceClockNames.filter((name) => !mappedClocks.includes(name));
  if (missingClocks.length) errors.push(`pressureSystems \u7F3A\u5C11\u5F00\u573A\u5012\u8BA1\u65F6\uFF1A${missingClocks.join("\u3001")}\u3002`);
  pressures.forEach((pressure, index) => {
    validateText(pressure, ["name", "sourceClock", "source", "currentLevel", "escalationClock", "failureConsequence"], `pressureSystems[${index}]`);
    validateCharacterArray(pressure.targetCharacters, `pressureSystems[${index}].targetCharacters`);
    if (!Array.isArray(pressure.visibleEffects) || !pressure.visibleEffects.length) errors.push(`pressureSystems[${index}].visibleEffects \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  });
  const knowledgeBarriers = Array.isArray(result.knowledgeBarriers) ? result.knowledgeBarriers : [];
  const mappedFacts = knowledgeBarriers.map((barrier) => String(barrier.sourceFact || "").trim()).filter(Boolean);
  const missingFacts = sourceFacts.filter((fact) => !mappedFacts.includes(fact));
  if (missingFacts.length) errors.push(`knowledgeBarriers \u7F3A\u5C11\u5F00\u573A\u77E5\u8BC6\u9501\uFF1A${missingFacts.join("\uFF5C")}\u3002`);
  knowledgeBarriers.forEach((barrier, index) => {
    validateText(barrier, ["sourceFact", "fact", "unlockCondition", "prematureLeakConsequence"], `knowledgeBarriers[${index}]`);
    validateCharacterArray(barrier.knowers, `knowledgeBarriers[${index}].knowers`);
    validateCharacterArray(barrier.excludedCharacters, `knowledgeBarriers[${index}].excludedCharacters`);
  });
  const interfaces = Array.isArray(result.characterWorldInterfaces) ? result.characterWorldInterfaces : [];
  const interfaceNames = interfaces.map((entry) => String(entry.character || "").trim()).filter(Boolean);
  if (interfaces.length !== frozenNames.length) errors.push(`characterWorldInterfaces \u5FC5\u987B\u6070\u597D ${frozenNames.length} \u4EBA\uFF0C\u5B9E\u9645 ${interfaces.length} \u4EBA\u3002`);
  if (new Set(interfaceNames).size !== interfaceNames.length) errors.push("characterWorldInterfaces \u5B58\u5728\u91CD\u590D\u4EBA\u7269\u3002");
  const missingInterfaces = frozenNames.filter((name) => !interfaceNames.includes(name));
  const extraInterfaces = interfaceNames.filter((name) => !frozenNameSet.has(name));
  if (missingInterfaces.length) errors.push(`characterWorldInterfaces \u7F3A\u5C11\u4EBA\u7269\uFF1A${missingInterfaces.join("\u3001")}\u3002`);
  if (extraInterfaces.length) errors.push(`characterWorldInterfaces \u65B0\u589E\u4E86\u4EBA\u7269\uFF1A${[...new Set(extraInterfaces)].join("\u3001")}\u3002`);
  interfaces.forEach((entry, index) => {
    validateText(entry, ["character", "openingLocation", "presence", "institutionalStatus", "factionPressure", "nextWorldAction"], `characterWorldInterfaces[${index}]`);
    for (const key of ["ruleExposure", "resourceAccess"]) {
      if (!Array.isArray(entry[key]) || !entry[key].length) errors.push(`characterWorldInterfaces[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    }
    const sourceState = stateByName.get(String(entry.character || "").trim());
    if (sourceState && String(entry.openingLocation || "").trim() !== String(sourceState.location || "").trim()) errors.push(`characterWorldInterfaces[${index}].openingLocation \u5FC5\u987B\u9010\u5B57\u7EE7\u627F ${entry.character} \u7684\u521D\u59CB\u4F4D\u7F6E\u3002`);
    if (sourceState && String(entry.presence || "").trim() !== String(sourceState.presence || "").trim()) errors.push(`characterWorldInterfaces[${index}].presence \u5FC5\u987B\u7EE7\u627F ${entry.character} \u7684\u521D\u59CB\u72B6\u6001\u3002`);
  });
  const travel = Array.isArray(result.travelAndAccess) ? result.travelAndAccess : [];
  travel.forEach((entry, index) => {
    validateText(entry, ["from", "to", "method", "duration", "cost", "storyUse"], `travelAndAccess[${index}]`);
    if (!Array.isArray(entry.restrictions) || !entry.restrictions.length) errors.push(`travelAndAccess[${index}].restrictions \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  });
  const anchors = Array.isArray(result.continuityAnchors) ? result.continuityAnchors : [];
  const mappedAnchorSources = anchors.map((entry) => String(entry.source || "").trim()).filter(Boolean);
  if (anchors.length !== sourceContinuityLocks.length) errors.push(`continuityAnchors \u5FC5\u987B\u4E0E ${sourceContinuityLocks.length} \u6761\u521D\u59CB\u8FDE\u7EED\u6027\u9501\u4E00\u4E00\u5BF9\u5E94\uFF0C\u5B9E\u9645 ${anchors.length} \u6761\u3002`);
  if (new Set(mappedAnchorSources).size !== mappedAnchorSources.length) errors.push("continuityAnchors.source \u5B58\u5728\u91CD\u590D\u6765\u6E90\u3002");
  const missingAnchorSources = sourceContinuityLocks.filter((source) => !mappedAnchorSources.includes(source));
  const extraAnchorSources = mappedAnchorSources.filter((source) => !sourceContinuityLocks.includes(source));
  if (missingAnchorSources.length) errors.push(`continuityAnchors \u7F3A\u5C11\u521D\u59CB\u8FDE\u7EED\u6027\u9501\uFF1A${missingAnchorSources.join("\uFF5C")}\u3002`);
  if (extraAnchorSources.length) errors.push(`continuityAnchors \u5F15\u5165\u4E86\u672A\u6279\u51C6\u7684\u5267\u60C5\u7ED3\u8BBA\uFF1A${[...new Set(extraAnchorSources)].join("\uFF5C")}\u3002`);
  const futureOutcomeTokens = ["\u6700\u7EC8", "\u7EC8\u5C40", "\u7ED3\u5C40", "\u6B7B\u4EA1", "\u727A\u7272", "\u81EA\u6BC1", "\u590D\u6D3B", "\u6D17\u767D", "\u7B2C\u4E00\u5F27", "\u7B2C\u4E8C\u5F27", "\u7B2C\u4E09\u5F27", "\u7B2C\u56DB\u5F27"];
  anchors.forEach((entry, index) => {
    validateText(entry, ["id", "source", "anchor", "verificationSignal", "forbiddenDrift"], `continuityAnchors[${index}]`);
    const source = String(entry.source || "");
    const derivedContent = `${entry.anchor || ""} ${entry.verificationSignal || ""} ${entry.forbiddenDrift || ""}`;
    const unauthorizedOutcomes = futureOutcomeTokens.filter((token) => derivedContent.includes(token) && !source.includes(token));
    if (unauthorizedOutcomes.length) errors.push(`continuityAnchors[${index}] \u64C5\u81EA\u52A0\u5165\u540E\u7EED\u5267\u60C5\u7ED3\u8BBA\uFF1A${unauthorizedOutcomes.join("\u3001")}\u3002`);
  });
  const openingFrame = input.initialCharacterState.openingFrame && typeof input.initialCharacterState.openingFrame === "object" && !Array.isArray(input.initialCharacterState.openingFrame) ? input.initialCharacterState.openingFrame : {};
  const openingSlice = result.openingWorldSlice && typeof result.openingWorldSlice === "object" && !Array.isArray(result.openingWorldSlice) ? result.openingWorldSlice : {};
  if (String(openingSlice.primaryLocation || "").trim() !== String(openingFrame.primaryLocation || "").trim()) errors.push("openingWorldSlice.primaryLocation \u5FC5\u987B\u9010\u5B57\u7EE7\u627F\u5F00\u573A\u4E3B\u5730\u70B9\u3002");
  for (const key of ["time", "primaryLocation"]) validateText(openingSlice, [key], "openingWorldSlice");
  for (const key of ["activeLocations", "activeRules", "activeFactions", "activeResources", "activePressures", "chapterOneProofs"]) {
    if (!Array.isArray(openingSlice[key]) || !openingSlice[key].length) errors.push(`openingWorldSlice.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  }
  const handoff = result.handoffToPlotArchitecture && typeof result.handoffToPlotArchitecture === "object" && !Array.isArray(result.handoffToPlotArchitecture) ? result.handoffToPlotArchitecture : {};
  for (const key of ["causalInputs", "availableChoices", "lockedConsequences", "escalationAxes", "forbiddenShortcuts"]) {
    if (!Array.isArray(handoff[key]) || !handoff[key].length) errors.push(`handoffToPlotArchitecture.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  }
  const availableChoices = Array.isArray(handoff.availableChoices) ? handoff.availableChoices.map((choice) => String(choice || "").trim()) : [];
  const fakeChoices = availableChoices.filter((choice) => /不可能|无法执行|仅为错觉|假选择/u.test(choice));
  if (fakeChoices.length) errors.push(`handoffToPlotArchitecture.availableChoices \u5305\u542B\u4E0D\u53EF\u6267\u884C\u7684\u5047\u9009\u62E9\uFF1A${fakeChoices.join("\uFF5C")}\u3002`);
  const handoffText = JSON.stringify(handoff);
  if (/第[一二三四五六七八九十\d]+弧|终局|结局/u.test(handoffText)) errors.push("handoffToPlotArchitecture \u7981\u6B62\u63D0\u524D\u51B3\u5B9A\u5206\u5F27\u6216\u7EC8\u5C40\u5267\u60C5\u3002");
  const scheduledChapterPattern = /第(?:(?:[2-9]\d*|\d{2,})(?:[-—至到]\d+)?|(?:二|三|四|五|六|七|八|九|十|百)[一二三四五六七八九十百]*)章/gu;
  const scheduledChapterHits = [...handoffText.matchAll(scheduledChapterPattern)].map((match) => match[0]);
  if (scheduledChapterHits.length) errors.push(`handoffToPlotArchitecture \u5305\u542B\u8D8A\u754C\u7AE0\u8282\u6392\u671F\uFF1A${[...new Set(scheduledChapterHits)].join("\u3001")}\u3002`);
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  const serializedLength = JSON.stringify(result).length;
  if (serializedLength < Math.max(14e3, frozenNames.length * 900)) warnings.push(`\u4E16\u754C\u77E9\u9635\u53EA\u6709 ${serializedLength} \u5B57\u7B26\uFF0C\u4EBA\u7269\u4E0E\u5730\u70B9\u63A5\u53E3\u53EF\u80FD\u4E0D\u591F\u5177\u4F53\u3002`);
  return { valid: errors.length === 0, errors, warnings };
}
function validatePlotArchitecture(result, input) {
  const errors = [];
  const warnings = [];
  const characters = plannedCharacterNames(input.characterPlanning);
  const characterSet = new Set(characters);
  const pressures = plotSourceNames(input.worldMatrix, "pressureSystems", "name");
  const anchors = plotSourceNames(input.worldMatrix, "continuityAnchors", "id");
  const subplots = plotSourceNames(input.worldFoundation, "subplots", "name");
  const seeds = plotSourceNames(input.worldFoundation, "foreshadowing", "seed");
  const arcTarget = plotArchitectureArcTarget(input.totalChapters);
  const requiredObjects = ["source", "project", "storyPromise", "mainline", "endingContract", "handoffToStoryBible", "qualitySelfCheck"];
  const requiredArrays = ["arcArchitecture", "characterArcBindings", "pressureEscalation", "continuityPlan", "subplotPlan", "foreshadowingPlan"];
  for (const key of requiredObjects) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u5BF9\u8C61\u3002`);
  }
  for (const key of requiredArrays) {
    if (!Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
  }
  for (const forbidden of ["storyBible", "volumeStrategy", "chapterBlueprints", "chapters", "chapterDrafts", "prose"]) {
    if (forbidden in result) errors.push(`\u7981\u6B62\u8D8A\u754C\u751F\u6210 ${forbidden}\uFF1B\u8BE5\u8D44\u4EA7\u5C5E\u4E8E\u540E\u7EED\u9636\u6BB5\u3002`);
  }
  const validateText = (entry, keys, label) => {
    for (const key of keys) {
      if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
    }
  };
  const values = (value) => Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
  const validateExactSet = (actual, expected, label) => {
    const missing = expected.filter((item) => !actual.includes(item));
    const extra = actual.filter((item) => !expected.includes(item));
    if (actual.length !== expected.length) errors.push(`${label} \u5FC5\u987B\u6070\u597D ${expected.length} \u9879\uFF0C\u5B9E\u9645 ${actual.length} \u9879\u3002`);
    if (new Set(actual).size !== actual.length) errors.push(`${label} \u5B58\u5728\u91CD\u590D\u9879\u3002`);
    if (missing.length) errors.push(`${label} \u7F3A\u5C11\uFF1A${missing.join("\uFF5C")}\u3002`);
    if (extra.length) errors.push(`${label} \u5305\u542B\u672A\u51BB\u7ED3\u9879\uFF1A${[...new Set(extra)].join("\uFF5C")}\u3002`);
  };
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source : {};
  if (String(source.worldMatrixRunId || "").trim() !== input.upstreamRunId) errors.push("source.worldMatrixRunId \u5FC5\u987B\u9010\u5B57\u7EE7\u627F\u4E0A\u6E38 Run ID\u3002");
  if (String(source.phase || "").trim() !== "phase_5_world_matrix") errors.push("source.phase \u5FC5\u987B\u662F phase_5_world_matrix\u3002");
  validateExactSet(values(source.frozenCharacterNames), characters, "source.frozenCharacterNames");
  validateExactSet(values(source.sourcePressureNames), pressures, "source.sourcePressureNames");
  validateExactSet(values(source.sourceContinuityAnchorIds), anchors, "source.sourceContinuityAnchorIds");
  const project = result.project && typeof result.project === "object" && !Array.isArray(result.project) ? result.project : {};
  validateText(project, ["title", "protagonist", "architecturePurpose"], "project");
  if (Number(project.totalChapters) !== input.totalChapters) errors.push(`project.totalChapters \u5FC5\u987B\u662F ${input.totalChapters}\u3002`);
  const protagonist = plotArchitectureProtagonist(input.characterPlanning);
  if (String(project.protagonist || "").trim() !== protagonist) errors.push(`project.protagonist \u5FC5\u987B\u662F\u51BB\u7ED3\u4E3B\u89D2 ${protagonist}\u3002`);
  const storyPromise = result.storyPromise && typeof result.storyPromise === "object" && !Array.isArray(result.storyPromise) ? result.storyPromise : {};
  validateText(storyPromise, ["logline", "centralDramaticQuestion", "readerPromise", "themeArgument", "endingDirection"], "storyPromise");
  if (!values(storyPromise.nonNegotiables).length) errors.push("storyPromise.nonNegotiables \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002");
  const mainline = result.mainline && typeof result.mainline === "object" && !Array.isArray(result.mainline) ? result.mainline : {};
  validateText(mainline, ["externalGoal", "internalNeed", "centralConflict", "oppositionLogic", "falseVictory", "darkestPoint", "climaxChoice", "endingState"], "mainline");
  const arcs = Array.isArray(result.arcArchitecture) ? result.arcArchitecture : [];
  if (arcs.length !== arcTarget) errors.push(`arcArchitecture \u5FC5\u987B\u6070\u597D ${arcTarget} \u5F27\uFF0C\u5B9E\u9645 ${arcs.length} \u5F27\u3002`);
  const arcIds = arcs.map((arc) => String(arc.id || "").trim()).filter(Boolean);
  const arcIdSet = new Set(arcIds);
  if (arcIdSet.size !== arcs.length) errors.push("arcArchitecture.id \u4E0D\u80FD\u4E3A\u7A7A\u6216\u91CD\u590D\u3002");
  let expectedStart = 1;
  arcs.forEach((arc, index) => {
    validateText(arc, ["id", "name", "openingState", "protagonistObjective", "drivingChoice", "opposition", "midpointReversal", "cost", "irreversibleOutcome", "nextHandoff"], `arcArchitecture[${index}]`);
    for (const key of ["sourceCausalInputs", "escalationAxes"]) {
      if (!values(arc[key]).length) errors.push(`arcArchitecture[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    }
    const start = Number(arc.startChapter);
    const end = Number(arc.endChapter);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) errors.push(`arcArchitecture[${index}] \u7AE0\u8282\u533A\u95F4\u65E0\u6548\u3002`);
    if (start !== expectedStart) errors.push(`arcArchitecture[${index}].startChapter \u5E94\u4E3A ${expectedStart}\uFF0C\u5B9E\u9645 ${start}\u3002`);
    if (Number.isInteger(end)) expectedStart = end + 1;
  });
  if (arcs.length && Number(arcs.at(-1)?.endChapter) !== input.totalChapters) errors.push(`arcArchitecture \u6700\u540E\u4E00\u5F27\u5FC5\u987B\u7ED3\u675F\u4E8E\u7B2C ${input.totalChapters} \u7AE0\u3002`);
  const characterBindings = Array.isArray(result.characterArcBindings) ? result.characterArcBindings : [];
  const bindingNames = characterBindings.map((entry) => String(entry.character || "").trim()).filter(Boolean);
  validateExactSet(bindingNames, characters, "characterArcBindings.character");
  characterBindings.forEach((entry, index) => {
    validateText(entry, ["character", "startState", "desire", "mainlineFunction", "pressure", "endState"], `characterArcBindings[${index}]`);
    const turns = Array.isArray(entry.turningPoints) ? entry.turningPoints : [];
    if (!turns.length) errors.push(`characterArcBindings[${index}].turningPoints \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    turns.forEach((turn, turnIndex) => {
      validateText(turn, ["arcId", "change", "cost"], `characterArcBindings[${index}].turningPoints[${turnIndex}]`);
      if (!arcIdSet.has(String(turn.arcId || "").trim())) errors.push(`characterArcBindings[${index}].turningPoints[${turnIndex}].arcId \u4E0D\u5B58\u5728\u3002`);
    });
  });
  const pressurePlan = Array.isArray(result.pressureEscalation) ? result.pressureEscalation : [];
  validateExactSet(pressurePlan.map((entry) => String(entry.sourcePressure || "").trim()).filter(Boolean), pressures, "pressureEscalation.sourcePressure");
  pressurePlan.forEach((entry, index) => {
    const stages = Array.isArray(entry.arcStages) ? entry.arcStages : [];
    if (!stages.length) errors.push(`pressureEscalation[${index}].arcStages \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    stages.forEach((stage, stageIndex) => {
      validateText(stage, ["arcId", "level", "visibleEffect", "consequence"], `pressureEscalation[${index}].arcStages[${stageIndex}]`);
      if (!arcIdSet.has(String(stage.arcId || "").trim())) errors.push(`pressureEscalation[${index}].arcStages[${stageIndex}].arcId \u4E0D\u5B58\u5728\u3002`);
    });
  });
  const continuityPlan = Array.isArray(result.continuityPlan) ? result.continuityPlan : [];
  validateExactSet(continuityPlan.map((entry) => String(entry.sourceAnchorId || "").trim()).filter(Boolean), anchors, "continuityPlan.sourceAnchorId");
  continuityPlan.forEach((entry, index) => {
    validateText(entry, ["sourceAnchorId", "firstUseArcId", "verification", "payoffOrPersistence", "forbiddenDrift"], `continuityPlan[${index}]`);
    if (!arcIdSet.has(String(entry.firstUseArcId || "").trim())) errors.push(`continuityPlan[${index}].firstUseArcId \u4E0D\u5B58\u5728\u3002`);
  });
  const subplotPlan = Array.isArray(result.subplotPlan) ? result.subplotPlan : [];
  validateExactSet(subplotPlan.map((entry) => String(entry.sourceSubplot || "").trim()).filter(Boolean), subplots, "subplotPlan.sourceSubplot");
  subplotPlan.forEach((entry, index) => {
    validateText(entry, ["sourceSubplot", "entryArcId", "causalFunction", "mainlineCollision", "resolutionArcId", "resolutionCost"], `subplotPlan[${index}]`);
    const referencedIds = [String(entry.entryArcId || "").trim(), String(entry.resolutionArcId || "").trim(), ...values(entry.turnArcIds)];
    if (!values(entry.turnArcIds).length) errors.push(`subplotPlan[${index}].turnArcIds \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    referencedIds.forEach((arcId) => {
      if (!arcIdSet.has(arcId)) errors.push(`subplotPlan[${index}] \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5F27 ${arcId}\u3002`);
    });
  });
  const foreshadowingPlan = Array.isArray(result.foreshadowingPlan) ? result.foreshadowingPlan : [];
  validateExactSet(foreshadowingPlan.map((entry) => String(entry.sourceSeed || "").trim()).filter(Boolean), seeds, "foreshadowingPlan.sourceSeed");
  foreshadowingPlan.forEach((entry, index) => {
    validateText(entry, ["sourceSeed", "plantArcId", "payoffArcId", "payoffAction", "readerEffect"], `foreshadowingPlan[${index}]`);
    const referencedIds = [String(entry.plantArcId || "").trim(), String(entry.payoffArcId || "").trim(), ...values(entry.advanceArcIds)];
    if (!values(entry.advanceArcIds).length) errors.push(`foreshadowingPlan[${index}].advanceArcIds \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    referencedIds.forEach((arcId) => {
      if (!arcIdSet.has(arcId)) errors.push(`foreshadowingPlan[${index}] \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5F27 ${arcId}\u3002`);
    });
  });
  const ending = result.endingContract && typeof result.endingContract === "object" && !Array.isArray(result.endingContract) ? result.endingContract : {};
  validateText(ending, ["climaxChoice", "finalWorldState", "noDeusExMachinaProof"], "endingContract");
  for (const key of ["paidCosts", "resolvedPromises", "intentionallyOpen"]) {
    if (!values(ending[key]).length) errors.push(`endingContract.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  }
  const handoff = result.handoffToStoryBible && typeof result.handoffToStoryBible === "object" && !Array.isArray(result.handoffToStoryBible) ? result.handoffToStoryBible : {};
  for (const key of ["lockedMainline", "characterStateRequirements", "canonicalTerms", "continuityRules", "unresolvedRisks"]) {
    if (!values(handoff[key]).length) errors.push(`handoffToStoryBible.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  }
  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck : {};
  for (const key of ["continuousChapterCoverage", "allCharactersBound", "allPressuresEscalated", "allContinuityAnchorsScheduled", "noLaterPhaseAssetsGenerated"]) {
    if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} \u5FC5\u987B\u4E3A true\u3002`);
  }
  if (!Array.isArray(quality.remainingRisks)) errors.push("qualitySelfCheck.remainingRisks \u5FC5\u987B\u662F\u6570\u7EC4\u3002");
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  const unknownCharacterMentions = bindingNames.filter((name) => !characterSet.has(name));
  if (unknownCharacterMentions.length) errors.push(`\u4E3B\u7EBF\u4EBA\u7269\u7ED1\u5B9A\u5305\u542B\u672A\u51BB\u7ED3\u4EBA\u7269\uFF1A${[...new Set(unknownCharacterMentions)].join("\u3001")}\u3002`);
  const serializedLength = JSON.stringify(result).length;
  if (serializedLength < Math.max(18e3, characters.length * 850 + arcTarget * 900)) warnings.push(`\u4E3B\u7EBF\u67B6\u6784\u53EA\u6709 ${serializedLength} \u5B57\u7B26\uFF0C\u957F\u7BC7\u5F27\u7EBF\u6216\u4EBA\u7269\u7ED1\u5B9A\u53EF\u80FD\u4E0D\u591F\u5177\u4F53\u3002`);
  return { valid: errors.length === 0, errors, warnings };
}
function validateStoryBible(result, input) {
  const errors = [];
  const warnings = [];
  const characters = plannedCharacterNames(input.characterPlanning);
  const relationships = storyBibleRelationshipKeys(input.characterPlanning);
  const sourceArcs = storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture");
  const arcIds = sourceArcs.map((arc) => String(arc.id || "").trim()).filter(Boolean);
  const arcIdSet = new Set(arcIds);
  const continuityIds = plotSourceNames(input.plotArchitecture, "continuityPlan", "sourceAnchorId");
  const ruleNames = plotSourceNames(input.worldMatrix, "rules", "name");
  const locationNames = plotSourceNames(input.worldMatrix, "locations", "name");
  const seeds = plotSourceNames(input.plotArchitecture, "foreshadowingPlan", "sourceSeed");
  const plotHandoff = input.plotArchitecture.handoffToStoryBible && typeof input.plotArchitecture.handoffToStoryBible === "object" && !Array.isArray(input.plotArchitecture.handoffToStoryBible) ? input.plotArchitecture.handoffToStoryBible : {};
  const canonicalTerms = Array.isArray(plotHandoff.canonicalTerms) ? plotHandoff.canonicalTerms.map((value) => String(value || "").trim()).filter(Boolean) : [];
  const requiredObjects = ["source", "project", "canonPolicy", "worldCanon", "endingCanon", "handoffToVolumeStrategy", "qualitySelfCheck"];
  const requiredArrays = ["characterCanon", "relationshipCanon", "arcCanon", "terminology", "continuityCanon", "promiseLedger"];
  for (const key of requiredObjects) {
    if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u5BF9\u8C61\u3002`);
  }
  for (const key of requiredArrays) {
    if (!Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
  }
  for (const forbidden of ["volumeStrategy", "chapterBlueprints", "chapters", "chapterDrafts", "prose"]) {
    if (forbidden in result) errors.push(`\u7981\u6B62\u8D8A\u754C\u751F\u6210 ${forbidden}\uFF1B\u8BE5\u8D44\u4EA7\u5C5E\u4E8E\u540E\u7EED\u9636\u6BB5\u3002`);
  }
  const values = (value) => Array.isArray(value) ? value.map((entry) => String(entry || "").trim()).filter(Boolean) : [];
  const validateText = (entry, keys, label) => {
    for (const key of keys) if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
  };
  const validateExactSet = (actual, expected, label) => {
    const missing = expected.filter((item) => !actual.includes(item));
    const extra = actual.filter((item) => !expected.includes(item));
    if (actual.length !== expected.length) errors.push(`${label} \u5FC5\u987B\u6070\u597D ${expected.length} \u9879\uFF0C\u5B9E\u9645 ${actual.length} \u9879\u3002`);
    if (new Set(actual).size !== actual.length) errors.push(`${label} \u5B58\u5728\u91CD\u590D\u9879\u3002`);
    if (missing.length) errors.push(`${label} \u7F3A\u5C11\uFF1A${missing.join("\uFF5C")}\u3002`);
    if (extra.length) errors.push(`${label} \u5305\u542B\u672A\u51BB\u7ED3\u9879\uFF1A${[...new Set(extra)].join("\uFF5C")}\u3002`);
  };
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source : {};
  if (String(source.plotArchitectureRunId || "").trim() !== input.upstreamRunId) errors.push("source.plotArchitectureRunId \u5FC5\u987B\u9010\u5B57\u7EE7\u627F\u4E0A\u6E38 Run ID\u3002");
  if (String(source.phase || "").trim() !== "phase_6_plot_architecture") errors.push("source.phase \u5FC5\u987B\u662F phase_6_plot_architecture\u3002");
  validateExactSet(values(source.frozenCharacterNames), characters, "source.frozenCharacterNames");
  validateExactSet(values(source.sourceArcIds), arcIds, "source.sourceArcIds");
  validateExactSet(values(source.sourceContinuityAnchorIds), continuityIds, "source.sourceContinuityAnchorIds");
  const project = result.project && typeof result.project === "object" && !Array.isArray(result.project) ? result.project : {};
  validateText(project, ["title", "genre", "protagonist", "logline", "readerPromise", "themeArgument"], "project");
  if (Number(project.totalChapters) !== input.totalChapters) errors.push(`project.totalChapters \u5FC5\u987B\u662F ${input.totalChapters}\u3002`);
  const protagonist = plotArchitectureProtagonist(input.characterPlanning);
  if (String(project.protagonist || "").trim() !== protagonist) errors.push(`project.protagonist \u5FC5\u987B\u662F\u51BB\u7ED3\u4E3B\u89D2 ${protagonist}\u3002`);
  const policy = result.canonPolicy && typeof result.canonPolicy === "object" && !Array.isArray(result.canonPolicy) ? result.canonPolicy : {};
  for (const key of ["authorityOrder", "nonNegotiables", "changeControl", "forbiddenShortcuts"]) {
    if (!values(policy[key]).length) errors.push(`canonPolicy.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  }
  const worldCanon = result.worldCanon && typeof result.worldCanon === "object" && !Array.isArray(result.worldCanon) ? result.worldCanon : {};
  const canonRules = Array.isArray(worldCanon.rules) ? worldCanon.rules : [];
  validateExactSet(canonRules.map((entry) => String(entry.sourceName || "").trim()).filter(Boolean), ruleNames, "worldCanon.rules.sourceName");
  canonRules.forEach((entry, index) => {
    validateText(entry, ["sourceName", "canonicalRule", "cost", "exceptionBoundary", "forbiddenDrift"], `worldCanon.rules[${index}]`);
    if (!values(entry.visibleSignals).length) errors.push(`worldCanon.rules[${index}].visibleSignals \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  });
  const canonLocations = Array.isArray(worldCanon.locations) ? worldCanon.locations : [];
  validateExactSet(canonLocations.map((entry) => String(entry.sourceName || "").trim()).filter(Boolean), locationNames, "worldCanon.locations.sourceName");
  canonLocations.forEach((entry, index) => {
    validateText(entry, ["sourceName", "identity", "storyFunction", "forbiddenDrift"], `worldCanon.locations[${index}]`);
    for (const key of ["controllingForces", "accessConstraints"]) if (!values(entry[key]).length) errors.push(`worldCanon.locations[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  });
  for (const key of ["factions", "institutions", "resources", "knowledgeBoundaries"]) {
    if (!Array.isArray(worldCanon[key]) || !worldCanon[key].length) errors.push(`worldCanon.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  }
  const characterCanon = Array.isArray(result.characterCanon) ? result.characterCanon : [];
  validateExactSet(characterCanon.map((entry) => String(entry.character || "").trim()).filter(Boolean), characters, "characterCanon.character");
  characterCanon.forEach((entry, index) => {
    validateText(entry, ["character", "identity", "role", "desire", "woundOrFear", "misbelief", "voice", "mainlineFunction"], `characterCanon[${index}]`);
    for (const key of ["behaviorMarkers", "abilities", "limitationsAndCosts", "knowledgeBoundary", "forbiddenDrift"]) if (!values(entry[key]).length) errors.push(`characterCanon[${index}].${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    const states = Array.isArray(entry.arcStateRequirements) ? entry.arcStateRequirements : [];
    if (!states.length) errors.push(`characterCanon[${index}].arcStateRequirements \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    states.forEach((state, stateIndex) => {
      validateText(state, ["arcId", "requiredState", "forbiddenState"], `characterCanon[${index}].arcStateRequirements[${stateIndex}]`);
      if (!arcIdSet.has(String(state.arcId || "").trim())) errors.push(`characterCanon[${index}].arcStateRequirements[${stateIndex}].arcId \u4E0D\u5B58\u5728\u3002`);
    });
  });
  const relationshipCanon = Array.isArray(result.relationshipCanon) ? result.relationshipCanon : [];
  validateExactSet(relationshipCanon.map((entry) => String(entry.sourceEdge || "").trim()).filter(Boolean), relationships, "relationshipCanon.sourceEdge");
  relationshipCanon.forEach((entry, index) => validateText(entry, ["sourceEdge", "type", "surfaceState", "hiddenTension", "evolutionRule", "breakingPoint", "forbiddenDrift"], `relationshipCanon[${index}]`));
  const arcCanon = Array.isArray(result.arcCanon) ? result.arcCanon : [];
  validateExactSet(arcCanon.map((entry) => String(entry.sourceArcId || "").trim()).filter(Boolean), arcIds, "arcCanon.sourceArcId");
  const sourceArcById = new Map(sourceArcs.map((arc) => [String(arc.id || "").trim(), arc]));
  arcCanon.forEach((entry, index) => {
    validateText(entry, ["sourceArcId", "openingState", "requiredChoice", "requiredCost", "irreversibleOutcome", "exitState", "forbiddenDrift"], `arcCanon[${index}]`);
    const sourceArc = sourceArcById.get(String(entry.sourceArcId || "").trim());
    if (sourceArc && (Number(entry.startChapter) !== Number(sourceArc.startChapter) || Number(entry.endChapter) !== Number(sourceArc.endChapter))) errors.push(`arcCanon[${index}] \u7AE0\u8282\u8FB9\u754C\u5FC5\u987B\u4E0E ${entry.sourceArcId} \u5B8C\u5168\u4E00\u81F4\u3002`);
  });
  const terminology = Array.isArray(result.terminology) ? result.terminology : [];
  const terminologySources = terminology.map((entry) => String(entry.sourceTerm || "").trim()).filter(Boolean);
  const requiredTermNames = canonicalTerms.map(storyBibleCanonicalTermName).filter(Boolean);
  const missingTerms = requiredTermNames.filter((term) => !terminologySources.includes(term));
  if (missingTerms.length) errors.push(`terminology.sourceTerm \u7F3A\u5C11\u4E3B\u7EBF\u4EA4\u63A5\u672F\u8BED\uFF1A${missingTerms.join("\uFF5C")}\u3002`);
  terminology.forEach((entry, index) => {
    validateText(entry, ["sourceTerm", "canonicalMeaning", "usageRule"], `terminology[${index}]`);
    if (!values(entry.forbiddenVariants).length) errors.push(`terminology[${index}].forbiddenVariants \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  });
  const continuityCanon = Array.isArray(result.continuityCanon) ? result.continuityCanon : [];
  validateExactSet(continuityCanon.map((entry) => String(entry.sourceAnchorId || "").trim()).filter(Boolean), continuityIds, "continuityCanon.sourceAnchorId");
  continuityCanon.forEach((entry, index) => validateText(entry, ["sourceAnchorId", "canonicalConstraint", "verificationSignal", "payoffOrPersistence", "forbiddenDrift"], `continuityCanon[${index}]`));
  const promiseLedger = Array.isArray(result.promiseLedger) ? result.promiseLedger : [];
  validateExactSet(promiseLedger.map((entry) => String(entry.sourceSeed || "").trim()).filter(Boolean), seeds, "promiseLedger.sourceSeed");
  promiseLedger.forEach((entry, index) => {
    validateText(entry, ["sourceSeed", "surfacePromise", "truePromise", "payoffArcId", "payoffEvidence", "forbiddenDrift"], `promiseLedger[${index}]`);
    if (!values(entry.advanceArcIds).length) errors.push(`promiseLedger[${index}].advanceArcIds \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    for (const arcId of [String(entry.payoffArcId || "").trim(), ...values(entry.advanceArcIds)]) if (!arcIdSet.has(arcId)) errors.push(`promiseLedger[${index}] \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5F27 ${arcId}\u3002`);
  });
  const ending = result.endingCanon && typeof result.endingCanon === "object" && !Array.isArray(result.endingCanon) ? result.endingCanon : {};
  validateText(ending, ["climaxChoice", "finalWorldState"], "endingCanon");
  for (const key of ["paidCosts", "resolvedPromises", "intentionallyOpen", "forbiddenRetcons"]) if (!values(ending[key]).length) errors.push(`endingCanon.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  const handoff = result.handoffToVolumeStrategy && typeof result.handoffToVolumeStrategy === "object" && !Array.isArray(result.handoffToVolumeStrategy) ? result.handoffToVolumeStrategy : {};
  for (const key of ["immutableArcOrder", "allowedVolumeBreaks", "pacingRisks", "characterCoverageRules", "immutablePayoffs", "unresolvedRisks"]) if (!values(handoff[key]).length) errors.push(`handoffToVolumeStrategy.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck : {};
  for (const key of ["allCharactersCanonicalized", "allRelationshipsCanonicalized", "allArcsCanonicalized", "allContinuityAnchorsCanonicalized", "allPromisesTracked", "noLaterPhaseAssetsGenerated"]) if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} \u5FC5\u987B\u4E3A true\u3002`);
  if (!Array.isArray(quality.remainingRisks)) errors.push("qualitySelfCheck.remainingRisks \u5FC5\u987B\u662F\u6570\u7EC4\u3002");
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  const serializedLength = JSON.stringify(result).length;
  if (serializedLength < Math.max(24e3, characters.length * 1e3 + continuityIds.length * 350)) warnings.push(`\u6545\u4E8B\u5723\u7ECF\u53EA\u6709 ${serializedLength} \u5B57\u7B26\uFF0C\u6B63\u5178\u6761\u76EE\u53EF\u80FD\u4E0D\u591F\u5177\u4F53\u3002`);
  return { valid: errors.length === 0, errors, warnings };
}
function validateVolumeStrategy(result, input) {
  const errors = [];
  const warnings = [];
  const sourceArcs = storyBibleSourceRecords(input.plotArchitecture, "arcArchitecture");
  const arcIds = sourceArcs.map((arc) => String(arc.id || "").trim()).filter(Boolean);
  const arcIdSet = new Set(arcIds);
  const sourceArcById = new Map(sourceArcs.map((arc) => [String(arc.id || "").trim(), arc]));
  const characters = volumeStrategyCharacterNames(input.storyBible);
  const seeds = volumeStrategyPromiseSeeds(input.storyBible);
  const requiredObjects = ["source", "strategy", "handoffToChapterBlueprints", "qualitySelfCheck"];
  const requiredArrays = ["volumes", "arcCoverage", "characterCoverage", "promiseSchedule"];
  for (const key of requiredObjects) if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u5BF9\u8C61\u3002`);
  for (const key of requiredArrays) if (!Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
  for (const forbidden of ["chapterBlueprints", "chapters", "chapterPlans", "chapterDrafts", "prose"]) {
    if (forbidden in result) errors.push(`\u7981\u6B62\u8D8A\u754C\u751F\u6210 ${forbidden}\uFF1B\u8BE5\u8D44\u4EA7\u5C5E\u4E8E\u540E\u7EED\u9636\u6BB5\u3002`);
  }
  const values = volumeStrategyStringValues;
  const validateText = (entry, keys, label) => {
    for (const key of keys) if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
  };
  const validateExactSet = (actual, expected, label) => {
    const missing = expected.filter((item) => !actual.includes(item));
    const extra = actual.filter((item) => !expected.includes(item));
    if (actual.length !== expected.length) errors.push(`${label} \u5FC5\u987B\u6070\u597D ${expected.length} \u9879\uFF0C\u5B9E\u9645 ${actual.length} \u9879\u3002`);
    if (new Set(actual).size !== actual.length) errors.push(`${label} \u5B58\u5728\u91CD\u590D\u9879\u3002`);
    if (missing.length) errors.push(`${label} \u7F3A\u5C11\uFF1A${missing.join("\uFF5C")}\u3002`);
    if (extra.length) errors.push(`${label} \u5305\u542B\u672A\u51BB\u7ED3\u9879\uFF1A${[...new Set(extra)].join("\uFF5C")}\u3002`);
  };
  const expectedVolumeIds = Array.from({ length: input.targetVolumeCount }, (_, index) => `volume_${String(index + 1).padStart(2, "0")}`);
  const volumeIdSet = new Set(expectedVolumeIds);
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source : {};
  if (String(source.storyBibleRunId || "").trim() !== input.upstreamRunId) errors.push("source.storyBibleRunId \u5FC5\u987B\u9010\u5B57\u7EE7\u627F\u4E0A\u6E38 Run ID\u3002");
  if (String(source.phase || "").trim() !== "phase_7_story_bible") errors.push("source.phase \u5FC5\u987B\u662F phase_7_story_bible\u3002");
  if (Number(source.totalChapters) !== input.totalChapters) errors.push(`source.totalChapters \u5FC5\u987B\u662F ${input.totalChapters}\u3002`);
  validateExactSet(values(source.sourceArcIds), arcIds, "source.sourceArcIds");
  const strategy = result.strategy && typeof result.strategy === "object" && !Array.isArray(result.strategy) ? result.strategy : {};
  if (Number(strategy.targetVolumeCount) !== input.targetVolumeCount) errors.push(`strategy.targetVolumeCount \u5FC5\u987B\u662F ${input.targetVolumeCount}\u3002`);
  validateText(strategy, ["groupingRationale", "escalationCadence", "readerPayoffCadence", "antiRepetitionRule"], "strategy");
  const volumes = Array.isArray(result.volumes) ? result.volumes : [];
  if (volumes.length !== input.targetVolumeCount) errors.push(`volumes \u5FC5\u987B\u6070\u597D ${input.targetVolumeCount} \u5377\uFF0C\u5B9E\u9645 ${volumes.length} \u5377\u3002`);
  const volumeIds = volumes.map((volume) => String(volume.id || "").trim()).filter(Boolean);
  if (JSON.stringify(volumeIds) !== JSON.stringify(expectedVolumeIds)) errors.push(`volumes.id \u5FC5\u987B\u4F9D\u6B21\u4E3A\uFF1A${expectedVolumeIds.join("\u3001")}\u3002`);
  const flattenedArcIds = [];
  let expectedStartChapter = 1;
  volumes.forEach((volume, index) => {
    const label = `volumes[${index}]`;
    validateText(volume, ["id", "title", "phaseGoal", "openingState", "centralQuestion", "midpointTurn", "climax", "irreversibleChange", "readerPayoff", "nextVolumeHandoff"], label);
    for (const key of ["sourceArcIds", "pressureEscalation", "characterFocus", "relationshipShifts", "worldChanges", "forbiddenDrift"]) if (!values(volume[key]).length) errors.push(`${label}.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    const volumeArcIds = values(volume.sourceArcIds);
    flattenedArcIds.push(...volumeArcIds);
    const startChapter = Number(volume.startChapter);
    const endChapter = Number(volume.endChapter);
    if (!Number.isInteger(startChapter) || !Number.isInteger(endChapter) || startChapter < 1 || endChapter < startChapter) errors.push(`${label} \u7AE0\u8282\u8303\u56F4\u65E0\u6548\u3002`);
    if (startChapter !== expectedStartChapter) errors.push(`${label}.startChapter \u5E94\u4E3A ${expectedStartChapter}\uFF0C\u5B9E\u9645 ${startChapter}\u3002`);
    expectedStartChapter = endChapter + 1;
    const firstArc = sourceArcById.get(volumeArcIds[0] || "");
    const lastArc = sourceArcById.get(volumeArcIds.at(-1) || "");
    if (firstArc && startChapter !== Number(firstArc.startChapter)) errors.push(`${label}.startChapter \u5FC5\u987B\u4E0E\u9996\u6761\u5F27 ${volumeArcIds[0]} \u4E00\u81F4\u3002`);
    if (lastArc && endChapter !== Number(lastArc.endChapter)) errors.push(`${label}.endChapter \u5FC5\u987B\u4E0E\u672B\u6761\u5F27 ${volumeArcIds.at(-1)} \u4E00\u81F4\u3002`);
    volumeArcIds.forEach((arcId) => {
      if (!arcIdSet.has(arcId)) errors.push(`${label}.sourceArcIds \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5F27 ${arcId}\u3002`);
    });
    const advances = Array.isArray(volume.promiseAdvances) ? volume.promiseAdvances : [];
    if (!advances.length) errors.push(`${label}.promiseAdvances \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    advances.forEach((advance, advanceIndex) => {
      validateText(advance, ["sourceSeed", "operation"], `${label}.promiseAdvances[${advanceIndex}]`);
      if (!seeds.includes(String(advance.sourceSeed || "").trim())) errors.push(`${label}.promiseAdvances[${advanceIndex}].sourceSeed \u4E0D\u5C5E\u4E8E\u51BB\u7ED3\u627F\u8BFA\u3002`);
    });
  });
  if (volumes.length && expectedStartChapter !== input.totalChapters + 1) errors.push(`volumes \u5FC5\u987B\u8FDE\u7EED\u8986\u76D6\u5230\u7B2C ${input.totalChapters} \u7AE0\u3002`);
  if (JSON.stringify(flattenedArcIds) !== JSON.stringify(arcIds)) errors.push(`volumes.sourceArcIds \u5FC5\u987B\u6309\u987A\u5E8F\u4E14\u6070\u597D\u8986\u76D6\u5168\u90E8\u4E3B\u7EBF\u5F27\uFF1A${arcIds.join("\u3001")}\u3002`);
  const arcCoverage = Array.isArray(result.arcCoverage) ? result.arcCoverage : [];
  validateExactSet(arcCoverage.map((entry) => String(entry.sourceArcId || "").trim()).filter(Boolean), arcIds, "arcCoverage.sourceArcId");
  arcCoverage.forEach((entry, index) => {
    validateText(entry, ["sourceArcId", "volumeId", "coverageFunction", "entryState", "exitState"], `arcCoverage[${index}]`);
    if (!volumeIdSet.has(String(entry.volumeId || "").trim())) errors.push(`arcCoverage[${index}].volumeId \u4E0D\u5B58\u5728\u3002`);
  });
  const characterCoverage = Array.isArray(result.characterCoverage) ? result.characterCoverage : [];
  validateExactSet(characterCoverage.map((entry) => String(entry.character || "").trim()).filter(Boolean), characters, "characterCoverage.character");
  characterCoverage.forEach((entry, index) => {
    validateText(entry, ["character", "entryFunction", "continuityRequirement", "requiredChange"], `characterCoverage[${index}]`);
    const ids = values(entry.volumeIds);
    if (!ids.length) errors.push(`characterCoverage[${index}].volumeIds \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    ids.forEach((id) => {
      if (!volumeIdSet.has(id)) errors.push(`characterCoverage[${index}].volumeIds \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5377 ${id}\u3002`);
    });
  });
  const promiseSchedule = Array.isArray(result.promiseSchedule) ? result.promiseSchedule : [];
  validateExactSet(promiseSchedule.map((entry) => String(entry.sourceSeed || "").trim()).filter(Boolean), seeds, "promiseSchedule.sourceSeed");
  promiseSchedule.forEach((entry, index) => {
    validateText(entry, ["sourceSeed", "setupVolumeId", "payoffVolumeId", "payoffEvidence", "forbiddenDrift"], `promiseSchedule[${index}]`);
    const ids = [String(entry.setupVolumeId || "").trim(), String(entry.payoffVolumeId || "").trim(), ...values(entry.advanceVolumeIds)];
    if (!values(entry.advanceVolumeIds).length) errors.push(`promiseSchedule[${index}].advanceVolumeIds \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    ids.forEach((id) => {
      if (!volumeIdSet.has(id)) errors.push(`promiseSchedule[${index}] \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684\u5377 ${id}\u3002`);
    });
  });
  const handoff = result.handoffToChapterBlueprints && typeof result.handoffToChapterBlueprints === "object" && !Array.isArray(result.handoffToChapterBlueprints) ? result.handoffToChapterBlueprints : {};
  if (JSON.stringify(values(handoff.volumeOrder)) !== JSON.stringify(expectedVolumeIds)) errors.push(`handoffToChapterBlueprints.volumeOrder \u5FC5\u987B\u4F9D\u6B21\u4E3A\uFF1A${expectedVolumeIds.join("\u3001")}\u3002`);
  for (const key of ["blueprintRules", "highRiskTransitions", "immutablePayoffs"]) if (!values(handoff[key]).length) errors.push(`handoffToChapterBlueprints.${key} \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  const rangeLocks = Array.isArray(handoff.chapterRangeLocks) ? handoff.chapterRangeLocks : [];
  if (rangeLocks.length !== volumes.length) errors.push(`handoffToChapterBlueprints.chapterRangeLocks \u5FC5\u987B\u6070\u597D ${volumes.length} \u9879\u3002`);
  rangeLocks.forEach((lock, index) => {
    const volume = volumes[index];
    if (!volume) return;
    if (String(lock.volumeId || "").trim() !== String(volume.id || "").trim() || Number(lock.startChapter) !== Number(volume.startChapter) || Number(lock.endChapter) !== Number(volume.endChapter) || JSON.stringify(values(lock.sourceArcIds)) !== JSON.stringify(values(volume.sourceArcIds))) errors.push(`handoffToChapterBlueprints.chapterRangeLocks[${index}] \u5FC5\u987B\u4E0E\u5BF9\u5E94\u5377\u8303\u56F4\u548C\u5F27\u5B8C\u5168\u4E00\u81F4\u3002`);
  });
  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck : {};
  for (const key of ["continuousChapterCoverage", "allArcsCoveredExactlyOnce", "allCharactersScheduled", "allPromisesScheduled", "volumeEndsIrreversible", "noChapterBlueprintsGenerated"]) if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} \u5FC5\u987B\u4E3A true\u3002`);
  if (!Array.isArray(quality.remainingRisks)) errors.push("qualitySelfCheck.remainingRisks \u5FC5\u987B\u662F\u6570\u7EC4\u3002");
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  const serializedLength = JSON.stringify(result).length;
  if (serializedLength < Math.max(14e3, input.targetVolumeCount * 1800 + characters.length * 350)) warnings.push(`\u5206\u5377\u7B56\u7565\u53EA\u6709 ${serializedLength} \u5B57\u7B26\uFF0C\u5377\u7EA7\u56E0\u679C\u6216\u4EBA\u7269\u8986\u76D6\u53EF\u80FD\u4E0D\u591F\u5177\u4F53\u3002`);
  return { valid: errors.length === 0, errors, warnings };
}
function validateLeanChapterBlueprints(result, input) {
  const errors = [];
  const warnings = [];
  const volume = chapterBlueprintSelectedVolume(input);
  const characters = volumeStrategyCharacterNames(input.storyBible);
  const characterSet = new Set(characters);
  const values = volumeStrategyStringValues;
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index);
  const sourceArcIds = volume ? chapterBlueprintBatchArcIds(input) : [];
  const validateText = (entry, keys, label) => {
    for (const key of keys) {
      const text = String(entry[key] || "").trim();
      if (!text) errors.push(`${label}.${key} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
      if (/系统账本冻结|结构验证|正典审计|repair-loop|sceneCards|requiredFacts|forbiddenFacts/u.test(text)) errors.push(`${label}.${key} \u5305\u542B\u65E7\u8C03\u8BD5/\u5BA1\u8BA1\u6C61\u67D3\u8BED\u8A00\u3002`);
      if (text.length > 180) warnings.push(`${label}.${key} \u8FC7\u957F\uFF1Blean \u84DD\u56FE\u5E94\u4FDD\u6301\u77ED\u53E5\u3002`);
    }
  };
  const exactNumberArray = (value, expected, label) => {
    const actual = Array.isArray(value) ? value.map(Number) : [];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${label} \u5FC5\u987B\u4F9D\u6B21\u4E3A\uFF1A${expected.join("\u3001")}\u3002`);
  };
  if (Number(result.version) !== 2) errors.push("version \u5FC5\u987B\u662F 2\u3002");
  if (String(result.mode || "").trim() !== "lean_chapter_blueprints") errors.push("mode \u5FC5\u987B\u662F lean_chapter_blueprints\u3002");
  if (!volume) errors.push(`\u4E0A\u6E38\u5206\u5377\u7B56\u7565\u4E2D\u4E0D\u5B58\u5728\u76EE\u6807\u5377 ${input.volumeId}\u3002`);
  for (const forbidden of ["sceneCards", "writingPlan", "chapterDrafts", "chapters", "prose", "draftText"]) {
    if (forbidden in result) errors.push(`lean \u84DD\u56FE\u7981\u6B62\u8D8A\u754C\u751F\u6210 ${forbidden}\u3002`);
  }
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source : {};
  if (String(source.volumeStrategyRunId || "").trim() !== input.upstreamRunId) errors.push("source.volumeStrategyRunId \u5FC5\u987B\u9010\u5B57\u7EE7\u627F\u4E0A\u6E38 Run ID\u3002");
  if (String(source.phase || "").trim() !== "phase_8_volume_strategy") errors.push("source.phase \u5FC5\u987B\u662F phase_8_volume_strategy\u3002");
  if (String(source.volumeId || "").trim() !== input.volumeId) errors.push(`source.volumeId \u5FC5\u987B\u662F ${input.volumeId}\u3002`);
  if (volume && (Number(source.volumeStartChapter) !== Number(volume.startChapter) || Number(source.volumeEndChapter) !== Number(volume.endChapter))) errors.push("source \u5377\u7AE0\u8282\u8303\u56F4\u5FC5\u987B\u4E0E\u4E0A\u6E38\u5206\u5377\u7B56\u7565\u5B8C\u5168\u4E00\u81F4\u3002");
  if (Number(source.batchStartChapter) !== input.startChapter || Number(source.batchEndChapter) !== input.endChapter) errors.push(`source \u6279\u6B21\u8303\u56F4\u5FC5\u987B\u662F\u7B2C ${input.startChapter}-${input.endChapter} \u7AE0\u3002`);
  if (JSON.stringify(values(source.sourceArcIds)) !== JSON.stringify(sourceArcIds)) errors.push(`source.sourceArcIds \u5FC5\u987B\u4F9D\u6B21\u4E3A\uFF1A${sourceArcIds.join("\u3001")}\u3002`);
  const policy = result.batchPolicy && typeof result.batchPolicy === "object" && !Array.isArray(result.batchPolicy) ? result.batchPolicy : {};
  if (Number(policy.targetWordCount) !== input.targetWordCount) errors.push(`batchPolicy.targetWordCount \u5FC5\u987B\u662F ${input.targetWordCount}\u3002`);
  validateText(policy, ["batchPurpose", "continuityRule", "stateBoundaryRule"], "batchPolicy");
  const blueprints = Array.isArray(result.blueprints) ? result.blueprints : [];
  exactNumberArray(blueprints.map((entry) => entry.chapterNumber), chapterNumbers, "blueprints.chapterNumber");
  const eventTextChunks = [];
  blueprints.forEach((blueprint, index) => {
    const label = `blueprints[${index}]`;
    const chapterNumber = Number(blueprint.chapterNumber);
    validateText(blueprint, ["title", "volumeId", "sourceArcId", "previousPressure", "chapterGoal", "protagonistDecision", "irreversibleChange", "nextPressure"], label);
    for (const key of ["previousPressure", "chapterGoal", "protagonistDecision", "irreversibleChange", "nextPressure"]) eventTextChunks.push(`${label}.${key}: ${String(blueprint[key] || "")}`);
    if (String(blueprint.volumeId || "").trim() !== input.volumeId) errors.push(`${label}.volumeId \u5FC5\u987B\u662F ${input.volumeId}\u3002`);
    const expectedArc = chapterBlueprintArcForChapter(input, chapterNumber);
    if (!expectedArc || String(blueprint.sourceArcId || "").trim() !== String(expectedArc.id || "").trim()) errors.push(`${label}.sourceArcId \u4E0E\u7B2C ${chapterNumber} \u7AE0\u6240\u5728\u4E3B\u7EBF\u5F27\u4E0D\u4E00\u81F4\u3002`);
    const requiredCharacters = values(blueprint.requiredCharacters);
    if (!requiredCharacters.length) errors.push(`${label}.requiredCharacters \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    requiredCharacters.forEach((name) => {
      if (!characterSet.has(name)) errors.push(`${label}.requiredCharacters \u5305\u542B\u672A\u51BB\u7ED3\u4EBA\u7269 ${name}\u3002`);
    });
    if (!values(blueprint.stateLedgerRefs).length) warnings.push(`${label}.stateLedgerRefs \u4E3A\u7A7A\uFF1B\u5EFA\u8BAE\u5F15\u7528\u72B6\u6001\u8D26\u672C\u77ED\u6807\u7B7E\u800C\u4E0D\u662F\u5728\u5267\u60C5\u5B57\u6BB5\u91CC\u5199\u6570\u503C\u3002`);
    if (!values(blueprint.forbiddenDrift).length) warnings.push(`${label}.forbiddenDrift \u4E3A\u7A7A\uFF1B\u5EFA\u8BAE\u5217\u51FA\u672C\u7AE0\u6700\u5BB9\u6613\u6F02\u79FB\u7684\u4E00\u6761\u7981\u4EE4\u3002`);
  });
  const continuity = Array.isArray(result.batchContinuity) ? result.batchContinuity : [];
  const expectedContinuityCount = Math.max(0, chapterNumbers.length - 1);
  if (continuity.length !== expectedContinuityCount) errors.push(`batchContinuity \u5FC5\u987B\u6070\u597D ${expectedContinuityCount} \u9879\uFF0C\u5B9E\u9645 ${continuity.length} \u9879\u3002`);
  continuity.forEach((entry, index) => {
    if (Number(entry.fromChapter) !== chapterNumbers[index] || Number(entry.toChapter) !== chapterNumbers[index + 1]) errors.push(`batchContinuity[${index}] \u5FC5\u987B\u8FDE\u63A5\u7B2C ${chapterNumbers[index]}\u2192${chapterNumbers[index + 1]} \u7AE0\u3002`);
    validateText(entry, ["carryover", "forbiddenReset"], `batchContinuity[${index}]`);
  });
  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? result.handoffToWritingPlan : {};
  exactNumberArray(handoff.chapterNumbers, chapterNumbers, "handoffToWritingPlan.chapterNumbers");
  exactNumberArray(handoff.executionOrder, chapterNumbers, "handoffToWritingPlan.executionOrder");
  validateText(handoff, ["batchExitPressure"], "handoffToWritingPlan");
  if (!values(handoff.unresolvedRisks).length) warnings.push("handoffToWritingPlan.unresolvedRisks \u4E3A\u7A7A\uFF1B\u5EFA\u8BAE\u4FDD\u7559\u4E0B\u4E00\u6279\u6700\u5173\u952E\u98CE\u9669\u3002");
  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck : {};
  for (const key of ["allRequestedChaptersCovered", "continuousCausalChain", "noProseGenerated"]) if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} \u5FC5\u987B\u4E3A true\u3002`);
  if (!Array.isArray(quality.remainingRisks)) warnings.push("qualitySelfCheck.remainingRisks \u5EFA\u8BAE\u662F\u6570\u7EC4\u3002");
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  const eventText = eventTextChunks.join("\n");
  const forbiddenEventLeaks = [
    [/古钥匙[^，。；\n]*(?:能量|混沌灵力|残余能量|威力|增幅|注入|引导|布置|激活|作为工具|碎裂|残片|引爆|打开通往第八层|微小通道)/u, "\u53E4\u94A5\u5319\u88AB\u5DE5\u5177\u5316\u6216\u635F\u6BC1\uFF1Blean \u84DD\u56FE\u53EA\u80FD\u628A\u53E4\u94A5\u5319\u5199\u6210 stateLedgerRefs\u3002"],
    [/容器(?:反应|身份|价值|称号)/u, "\u5BB9\u5668\u4FE1\u606F\u63D0\u524D\uFF1Blean \u84DD\u56FE\u4E0D\u5F97\u786E\u8BA4\u6216\u6D4B\u8BD5\u5BB9\u5668\u8EAB\u4EFD\u3002"],
    [/系统账本冻结|正典审计|结构验证|场景卡|sceneCards|requiredFacts|forbiddenFacts/u, "\u8F93\u51FA\u6DF7\u5165\u65E7\u8C03\u8BD5/\u5BA1\u8BA1\u8BED\u8A00\uFF1Blean \u84DD\u56FE\u5FC5\u987B\u4FDD\u6301\u5E72\u51C0\u4E3B\u7EBF\u3002"]
  ];
  for (const [pattern, message] of forbiddenEventLeaks) if (pattern.test(eventText)) errors.push(message);
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
function validateChapterBlueprints(result, input) {
  if (String(result.mode || "").trim() === "lean_chapter_blueprints") return validateLeanChapterBlueprints(result, input);
  const errors = [];
  const warnings = [];
  const volume = chapterBlueprintSelectedVolume(input);
  const characters = volumeStrategyCharacterNames(input.storyBible);
  const characterSet = new Set(characters);
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index);
  const sourceArcIds = volume ? chapterBlueprintBatchArcIds(input) : [];
  const requiredObjects = ["source", "batchPolicy", "handoffToWritingPlan", "qualitySelfCheck"];
  const requiredArrays = ["blueprints", "batchContinuity"];
  for (const key of requiredObjects) if (!result[key] || typeof result[key] !== "object" || Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u5BF9\u8C61\u3002`);
  for (const key of requiredArrays) if (!Array.isArray(result[key])) errors.push(`${key} \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
  for (const forbidden of ["writingPlan", "chapterDrafts", "chapters", "prose", "draftText"]) if (forbidden in result) errors.push(`\u7981\u6B62\u8D8A\u754C\u751F\u6210 ${forbidden}\uFF1B\u8BE5\u8D44\u4EA7\u5C5E\u4E8E\u540E\u7EED\u9636\u6BB5\u3002`);
  if (!volume) errors.push(`\u4E0A\u6E38\u5206\u5377\u7B56\u7565\u4E2D\u4E0D\u5B58\u5728\u76EE\u6807\u5377 ${input.volumeId}\u3002`);
  const values = volumeStrategyStringValues;
  const validateText = (entry, keys, label) => {
    for (const key of keys) if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
  };
  const exactNumberArray = (value, expected, label) => {
    const actual = Array.isArray(value) ? value.map(Number) : [];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push(`${label} \u5FC5\u987B\u4F9D\u6B21\u4E3A\uFF1A${expected.join("\u3001")}\u3002`);
  };
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source : {};
  if (String(source.volumeStrategyRunId || "").trim() !== input.upstreamRunId) errors.push("source.volumeStrategyRunId \u5FC5\u987B\u9010\u5B57\u7EE7\u627F\u4E0A\u6E38 Run ID\u3002");
  if (String(source.phase || "").trim() !== "phase_8_volume_strategy") errors.push("source.phase \u5FC5\u987B\u662F phase_8_volume_strategy\u3002");
  if (String(source.volumeId || "").trim() !== input.volumeId) errors.push(`source.volumeId \u5FC5\u987B\u662F ${input.volumeId}\u3002`);
  if (volume && (Number(source.volumeStartChapter) !== Number(volume.startChapter) || Number(source.volumeEndChapter) !== Number(volume.endChapter))) errors.push("source \u5377\u7AE0\u8282\u8303\u56F4\u5FC5\u987B\u4E0E\u4E0A\u6E38\u5206\u5377\u7B56\u7565\u5B8C\u5168\u4E00\u81F4\u3002");
  if (Number(source.batchStartChapter) !== input.startChapter || Number(source.batchEndChapter) !== input.endChapter) errors.push(`source \u6279\u6B21\u8303\u56F4\u5FC5\u987B\u662F\u7B2C ${input.startChapter}-${input.endChapter} \u7AE0\u3002`);
  if (JSON.stringify(values(source.sourceArcIds)) !== JSON.stringify(sourceArcIds)) errors.push(`source.sourceArcIds \u5FC5\u987B\u4F9D\u6B21\u4E3A\uFF1A${sourceArcIds.join("\u3001")}\u3002`);
  const actualPreviousBatchRunId = source.previousBatchRunId === null || source.previousBatchRunId === void 0 ? null : String(source.previousBatchRunId).trim();
  if (actualPreviousBatchRunId !== input.previousBatchRunId) errors.push(`source.previousBatchRunId \u5FC5\u987B\u662F ${input.previousBatchRunId || "null"}\u3002`);
  const expectedPreviousEndChapter = input.previousBatchHandoff ? Number(input.previousBatchHandoff.endChapter) : null;
  const actualPreviousEndChapter = source.previousBatchEndChapter === null || source.previousBatchEndChapter === void 0 ? null : Number(source.previousBatchEndChapter);
  if (actualPreviousEndChapter !== expectedPreviousEndChapter) errors.push(`source.previousBatchEndChapter \u5FC5\u987B\u662F ${expectedPreviousEndChapter ?? "null"}\u3002`);
  const policy = result.batchPolicy && typeof result.batchPolicy === "object" && !Array.isArray(result.batchPolicy) ? result.batchPolicy : {};
  if (Number(policy.targetWordCount) !== input.targetWordCount) errors.push(`batchPolicy.targetWordCount \u5FC5\u987B\u662F ${input.targetWordCount}\u3002`);
  validateText(policy, ["batchPurpose", "continuityRule", "antiRepetitionRule", "knowledgeBoundaryRule"], "batchPolicy");
  const blueprints = Array.isArray(result.blueprints) ? result.blueprints : [];
  exactNumberArray(blueprints.map((entry) => entry.chapterNumber), chapterNumbers, "blueprints.chapterNumber");
  const contractLeakTexts = [];
  blueprints.forEach((blueprint, index) => {
    const label = `blueprints[${index}]`;
    const chapterNumber = Number(blueprint.chapterNumber);
    validateText(blueprint, ["title", "volumeId", "sourceArcId", "previousChapterInput", "chapterRole", "chapterPurpose", "sceneObjective", "protagonistDecision", "irreversibleChange", "suspenseLevel", "foreshadowingOperation", "emotionTarget", "endingHook", "nextChapterEntryState", "nextChapterHandoff"], label);
    for (const key of ["previousChapterInput", "chapterPurpose", "sceneObjective", "protagonistDecision", "irreversibleChange", "endingHook", "nextChapterHandoff"]) {
      const text = String(blueprint[key] || "").trim();
      if (text) contractLeakTexts.push(`${label}.${key}: ${text}`);
    }
    if (String(blueprint.volumeId || "").trim() !== input.volumeId) errors.push(`${label}.volumeId \u5FC5\u987B\u662F ${input.volumeId}\u3002`);
    const expectedArc = chapterBlueprintArcForChapter(input, chapterNumber);
    if (!expectedArc || String(blueprint.sourceArcId || "").trim() !== String(expectedArc.id || "").trim()) errors.push(`${label}.sourceArcId \u4E0E\u7B2C ${chapterNumber} \u7AE0\u6240\u5728\u4E3B\u7EBF\u5F27\u4E0D\u4E00\u81F4\u3002`);
    if (!["E", "F", "P", "C"].includes(String(blueprint.macroBeat || "").trim())) errors.push(`${label}.macroBeat \u5FC5\u987B\u662F E/F/P/C \u4E4B\u4E00\u3002`);
    for (const key of ["plotTwistLevel", "conflictLevel", "revealLevel"]) {
      const level = Number(blueprint[key]);
      if (!Number.isInteger(level) || level < 1 || level > 5) errors.push(`${label}.${key} \u5FC5\u987B\u662F 1-5 \u7684\u6574\u6570\u3002`);
    }
    if (Number(blueprint.targetWordCount) !== input.targetWordCount) errors.push(`${label}.targetWordCount \u5FC5\u987B\u662F ${input.targetWordCount}\u3002`);
    const mustAvoid = values(blueprint.mustAvoid);
    const allowedCharacters = values(blueprint.allowedCharacters);
    const forbiddenCharacters = values(blueprint.forbiddenCharacters);
    const allowedNewCharacters = values(blueprint.allowedNewCharacters);
    if (!mustAvoid.length) errors.push(`${label}.mustAvoid \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    if (!allowedCharacters.length) errors.push(`${label}.allowedCharacters \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    if (!forbiddenCharacters.length) errors.push(`${label}.forbiddenCharacters \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    allowedCharacters.forEach((name) => {
      if (!characterSet.has(name)) errors.push(`${label}.allowedCharacters \u5305\u542B\u672A\u51BB\u7ED3\u4EBA\u7269 ${name}\u3002`);
    });
    forbiddenCharacters.forEach((name) => {
      if (!characterSet.has(name)) errors.push(`${label}.forbiddenCharacters \u5305\u542B\u672A\u51BB\u7ED3\u4EBA\u7269 ${name}\u3002`);
    });
    const overlap = allowedCharacters.filter((name) => forbiddenCharacters.includes(name));
    if (overlap.length) errors.push(`${label} \u540C\u65F6\u5141\u8BB8\u5E76\u7981\u6B62\u4EBA\u7269\uFF1A${overlap.join("\u3001")}\u3002`);
    const entrance = blueprint.entranceProtocol && typeof blueprint.entranceProtocol === "object" && !Array.isArray(blueprint.entranceProtocol) ? blueprint.entranceProtocol : {};
    const entranceStage = String(entrance.newCharacterStage || "").trim();
    const introElements = values(entrance.requiredIntroElements);
    if (!allowedNewCharacters.length) {
      if (entranceStage !== "none") errors.push(`${label}.allowedNewCharacters \u4E3A\u7A7A\u65F6\uFF0CentranceProtocol.newCharacterStage \u5FC5\u987B\u662F none\u3002`);
      if (introElements.length) warnings.push(`${label}.\u6CA1\u6709\u65B0\u589E\u4EBA\u7269\uFF0CentranceProtocol.requiredIntroElements \u5C06\u88AB\u5FFD\u7565\u3002`);
    } else {
      if (!["rumor", "trace", "meet", "name_reveal"].includes(entranceStage)) errors.push(`${label}.\u5B58\u5728\u65B0\u589E\u4EBA\u7269\u65F6\uFF0CentranceProtocol.newCharacterStage \u5FC5\u987B\u662F rumor/trace/meet/name_reveal \u4E4B\u4E00\u3002`);
      if (!introElements.length) errors.push(`${label}.\u5B58\u5728\u65B0\u589E\u4EBA\u7269\u65F6\uFF0CentranceProtocol.requiredIntroElements \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    }
    const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards : [];
    if (sceneCards.length < 2 || sceneCards.length > 5) errors.push(`${label}.sceneCards \u5FC5\u987B\u6709 2-5 \u5F20\uFF0C\u5B9E\u9645 ${sceneCards.length} \u5F20\u3002`);
    sceneCards.forEach((card, cardIndex) => {
      const cardLabel = `${label}.sceneCards[${cardIndex}]`;
      if (Number(card.index) !== cardIndex + 1) errors.push(`${cardLabel}.index \u5FC5\u987B\u662F ${cardIndex + 1}\u3002`);
      validateText(card, ["goal", "conflict", "turn", "endHook"], cardLabel);
      for (const key of ["goal", "conflict", "turn", "endHook"]) {
        const value = String(card[key] || "").trim();
        if (value) contractLeakTexts.push(`${cardLabel}.${key}: ${value}`);
        if (value && value.length < 12) errors.push(`${cardLabel}.${key} \u8FC7\u77ED\uFF0C\u5FC5\u987B\u5199\u6210\u53EF\u6267\u884C\u5408\u540C\u5B57\u6BB5\uFF0C\u4E0D\u5F97\u53EA\u5199\u6807\u7B7E\u6216\u4E00\u53E5\u7A7A\u6CDB\u6982\u62EC\u3002`);
      }
      const requiredCharacters = values(card.requiredCharacters);
      if (!requiredCharacters.length) errors.push(`${cardLabel}.requiredCharacters \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
      requiredCharacters.forEach((name) => {
        if (!allowedCharacters.includes(name) && !allowedNewCharacters.includes(name)) errors.push(`${cardLabel}.requiredCharacters \u4E2D ${name} \u4E0D\u5728\u672C\u7AE0\u5141\u8BB8\u540D\u5355\u3002`);
      });
      if (!values(card.requiredFacts).length) errors.push(`${cardLabel}.requiredFacts \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
      if (!values(card.forbiddenFacts).length) errors.push(`${cardLabel}.forbiddenFacts \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    });
  });
  const continuity = Array.isArray(result.batchContinuity) ? result.batchContinuity : [];
  const expectedContinuityCount = Math.max(0, chapterNumbers.length - 1);
  if (continuity.length !== expectedContinuityCount) errors.push(`batchContinuity \u5FC5\u987B\u6070\u597D ${expectedContinuityCount} \u9879\uFF0C\u5B9E\u9645 ${continuity.length} \u9879\u3002`);
  continuity.forEach((entry, index) => {
    if (Number(entry.fromChapter) !== chapterNumbers[index] || Number(entry.toChapter) !== chapterNumbers[index + 1]) errors.push(`batchContinuity[${index}] \u5FC5\u987B\u8FDE\u63A5\u7B2C ${chapterNumbers[index]}\u2192${chapterNumbers[index + 1]} \u7AE0\u3002`);
    if (!values(entry.requiredCarryover).length) errors.push(`batchContinuity[${index}].requiredCarryover \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
    if (!values(entry.forbiddenReset).length) errors.push(`batchContinuity[${index}].forbiddenReset \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002`);
  });
  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? result.handoffToWritingPlan : {};
  exactNumberArray(handoff.chapterNumbers, chapterNumbers, "handoffToWritingPlan.chapterNumbers");
  exactNumberArray(handoff.executionOrder, chapterNumbers, "handoffToWritingPlan.executionOrder");
  validateText(handoff, ["fileNamingRule", "batchExitState"], "handoffToWritingPlan");
  if (!values(handoff.unresolvedRisks).length) errors.push("handoffToWritingPlan.unresolvedRisks \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4\u3002");
  const quality = result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck : {};
  for (const key of ["allRequestedChaptersCovered", "continuousCausalChain", "allCharactersWithinCanon", "allSceneCardsExecutable", "noProseGenerated"]) if (quality[key] !== true) errors.push(`qualitySelfCheck.${key} \u5FC5\u987B\u4E3A true\u3002`);
  if (!Array.isArray(quality.remainingRisks)) errors.push("qualitySelfCheck.remainingRisks \u5FC5\u987B\u662F\u6570\u7EC4\u3002");
  const placeholders = findPlaceholderValues(result);
  if (placeholders.length) errors.push(`\u68C0\u6D4B\u5230\u5B9E\u9645\u5360\u4F4D\u5185\u5BB9\uFF1A${placeholders.map((hit) => `${hit.path}=${hit.token}`).join("\u3001")}`);
  const contractLeakSource = contractLeakTexts.join("\n");
  const forbiddenContractLeaks = [
    [/古钥匙[^，。；\n]*(?:能量|混沌灵力|残余能量|威力|增幅|注入|引导|布置|激活|作为工具|碎裂|残片|引爆|打开通往第八层|微小通道)/u, "\u53E4\u94A5\u5319\u88AB\u5DE5\u5177\u5316\u6216\u635F\u6BC1\uFF1B\u7B2C8\u8282\u70B9\u4E0D\u80FD\u628A\u53E4\u94A5\u5319\u5F53\u4F5C\u7834\u9635/\u589E\u5E45/\u6CE8\u5165/\u5F00\u8DEF\u5DE5\u5177\uFF0C\u4E5F\u4E0D\u80FD\u9500\u6BC1\u53E4\u94A5\u5319\u3002"],
    [/容器(?:反应|身份|价值|称号)/u, "\u5BB9\u5668\u4FE1\u606F\u63D0\u524D\uFF1B\u7B2C8\u8282\u70B9\u4E8B\u4EF6\u5B57\u6BB5\u4E0D\u5F97\u786E\u8BA4\u6216\u6D4B\u8BD5\u5BB9\u5668\u8EAB\u4EFD/\u53CD\u5E94\u3002"],
    [/核心节点出现裂纹|短暂缺口|缺口[^，。；\n]*(?:自愈|恢复|愈合)|破坏节点|精确打击|攻击成功/u, "\u5C01\u9501\u7A81\u7834\u88AB\u63D0\u524D\u5199\u6210\u4E8B\u5B9E\uFF1B\u7B2C8\u8282\u70B9\u53EA\u80FD\u8BB0\u5F55\u538B\u529B\u5347\u7EA7\uFF0C\u4E0D\u5F97\u751F\u6210\u7F3A\u53E3\u3001\u88C2\u7EB9\u3001\u6108\u5408\u6216\u653B\u51FB\u6210\u529F\u3002"],
    [/封锁阵完成度\s*\d+%/u, "\u6A21\u578B\u81EA\u9020\u5C01\u9501\u767E\u5206\u6BD4\uFF1B\u5C01\u9501\u72B6\u6001\u5FC5\u987B\u7531\u7CFB\u7EDF\u8D26\u672C\u786E\u5B9A\u3002"],
    [/灵力(?:剩余|仅剩|只剩|消耗|损耗|下降|降低)[^，。；\n]*(?:\d+|一|二|两|三|四|五|六|七|八|九|十)成/u, "\u6A21\u578B\u81EA\u9020\u7075\u529B\u6570\u503C\uFF1B\u84DD\u56FE\u9636\u6BB5\u4E0D\u5F97\u7ED3\u7B97\u7075\u529B\u51E0\u6210\u3002"],
    [/(?:\d+|一|二|两|三|四|五|六|七|八|九|十)(?:分钟|小时|时辰|米)/u, "\u6A21\u578B\u81EA\u9020\u672A\u6388\u6743\u5177\u4F53\u65F6\u95F4/\u8DDD\u79BB\uFF1B\u84DD\u56FE\u9636\u6BB5\u53EA\u80FD\u5199\u538B\u529B\u903C\u8FD1\u3001\u5C01\u9501\u6536\u7D27\u3001\u8D44\u6E90\u7D27\u5F20\u7B49\u5408\u540C\u72B6\u6001\u3002"]
  ];
  for (const [pattern, message] of forbiddenContractLeaks) {
    if (pattern.test(contractLeakSource)) errors.push(message);
  }
  errors.push(...validateChapterBlueprintPacing(result, input));
  const serializedLength = JSON.stringify(result).length;
  const minimumLength = chapterNumbers.length * chapterBlueprintMinimumCharsPerChapter;
  const recommendedLength = chapterNumbers.length * chapterBlueprintRecommendedCharsPerChapter;
  if (serializedLength < minimumLength) errors.push(`\u7AE0\u8282\u84DD\u56FE\u5408\u540C\u5B57\u6BB5\u4E0D\u8DB3\uFF1A\u672C\u6279\u53EA\u6709 ${serializedLength} \u5B57\u7B26\uFF0C\u4F4E\u4E8E\u7A33\u5B9A\u95E8\u7981 ${minimumLength} \u5B57\u7B26\uFF1B\u8C03\u5EA6\u5361\u3001\u9010\u7AE0\u51B3\u7B56\u548C\u56E0\u679C\u4EA4\u63A5\u4E0D\u8DB3\uFF0C\u4E0D\u80FD\u9A71\u52A8\u540E\u7EED\u6B63\u6587\u751F\u4EA7\u3002`);
  else if (serializedLength < recommendedLength) warnings.push(`\u7AE0\u8282\u84DD\u56FE\u6279\u6B21\u53EA\u6709 ${serializedLength} \u5B57\u7B26\uFF0C\u4F4E\u4E8E\u63A8\u8350\u503C ${recommendedLength} \u5B57\u7B26\uFF1B\u8C03\u5EA6\u5361\u548C\u56E0\u679C\u4EA4\u63A5\u53EF\u80FD\u4E0D\u591F\u5177\u4F53\u3002`);
  return { valid: errors.length === 0, errors, warnings };
}
function applyChapterBlueprintDeterministicRepairs(run, result, input, phase) {
  const changes = [];
  const characterSet = new Set(volumeStrategyCharacterNames(input.storyBible));
  const blueprints = Array.isArray(result.blueprints) ? result.blueprints : [];
  const values = volumeStrategyStringValues;
  if (String(result.mode || "").trim() === "lean_chapter_blueprints") {
    const chapterNumbers2 = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index);
    const sourceArcIds = chapterBlueprintBatchArcIds(input);
    const leanUnsafeReplacements = [
      [/无面确认[^，。；\n]*(?:容器|最佳容器|目标)[^，。；\n]*/gu, "\u672A\u77E5\u4F4E\u8BED\u538B\u529B\u589E\u5F3A\u4F46\u6765\u6E90\u548C\u76EE\u7684\u4ECD\u4E0D\u53EF\u786E\u8BA4"],
      [/确认[^，。；\n]*(?:容器(?:反应|身份|价值|称号)?|最佳容器)[^，。；\n]*/gu, "\u53EA\u786E\u8BA4\u8BC6\u6D77\u4F4E\u8BED\u6B63\u5728\u5E72\u6270\u5224\u65AD"],
      [/测试[^，。；\n]*容器(?:反应|身份|价值|称号)?[^，。；\n]*/gu, "\u627F\u53D7\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u4F4E\u8BED\u5E72\u6270"],
      [/观察[^，。；\n]*容器(?:反应|身份|价值|称号)?[^，。；\n]*/gu, "\u89C2\u5BDF\u4F4E\u8BED\u9020\u6210\u7684\u538B\u529B\u53D8\u5316"],
      [/最佳容器/gu, "\u672A\u77E5\u76EE\u6807"],
      [/容器(?:反应|身份|价值|称号)?/gu, "\u672A\u77E5\u6C61\u67D3"],
      [/金色瞳孔[^，。；\n]*(?:确认|一闪而过|注视|出现|显现)[^，。；\n]*/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u91D1\u8272\u566A\u70B9\u77ED\u6682\u5E72\u6270\u5224\u65AD"],
      [/确认无面(?:的存在)?/gu, "\u611F\u5230\u672A\u77E5\u4F4E\u8BED\u538B\u529B"],
      [/无面(?:的)?存在/gu, "\u672A\u77E5\u4F4E\u8BED\u6765\u6E90"],
      [/无面[^，。；\n]*(?:梦境渗透|侵入梦境|成功附身|建立[^，。；\n]*精神链接)[^，。；\n]*/gu, "\u672A\u77E5\u4F4E\u8BED\u538B\u529B\u7EE7\u7EED\u7D2F\u79EF\u4F46\u672A\u5F62\u6210\u53EF\u786E\u8BA4\u8FDE\u63A5"],
      [/梦境渗透/gu, "\u8BC6\u6D77\u4F4E\u8BED\u5E72\u6270"],
      [/精神链接/gu, "\u4F4E\u8BED\u538B\u529B"],
      [/格式化波及[^，。；\n]*/gu, "\u96F7\u51FB\u4F59\u6CE2\u9020\u6210\u77ED\u6682\u6DF7\u4E71"],
      [/受到格式化波及[^，。；\n]*/gu, "\u53D7\u5230\u96F7\u51FB\u4F59\u6CE2\u5F71\u54CD\u800C\u77ED\u6682\u6DF7\u4E71"],
      [/灵州格式化/gu, "\u7075\u5DDE\u5371\u673A"]
    ];
    const cleanText = (value) => {
      const original = String(value || "");
      let next = original;
      for (const [pattern, replacement] of leanUnsafeReplacements) next = next.replace(pattern, replacement);
      next = next.replace(/系统账本冻结[：:][^。；\n]*/gu, "\u72B6\u6001\u8D26\u672C\u53E6\u884C\u7EF4\u62A4").replace(/正典审计|结构验证|repair-loop|sceneCards|requiredFacts|forbiddenFacts/gu, "").replace(/；{2,}/gu, "\uFF1B").replace(/\s+/gu, " ").trim();
      if (next !== original.trim()) changes.push("lean unsafe/provenance text");
      return next;
    };
    const dedupe = (value) => {
      const seen = /* @__PURE__ */ new Set();
      const output = [];
      for (const entry of values(value)) {
        const text = cleanText(entry);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        output.push(text);
      }
      return output;
    };
    result.version = 2;
    result.mode = "lean_chapter_blueprints";
    const source2 = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source : {};
    source2.volumeStrategyRunId = input.upstreamRunId;
    source2.phase = "phase_8_volume_strategy";
    source2.volumeId = input.volumeId;
    const volume = chapterBlueprintSelectedVolume(input);
    source2.volumeStartChapter = Number(volume?.startChapter || input.startChapter);
    source2.volumeEndChapter = Number(volume?.endChapter || input.endChapter);
    source2.batchStartChapter = input.startChapter;
    source2.batchEndChapter = input.endChapter;
    source2.sourceArcIds = sourceArcIds;
    source2.previousBatchRunId = input.previousBatchRunId;
    source2.previousBatchEndChapter = input.previousBatchHandoff ? Number(input.previousBatchHandoff.endChapter) : null;
    result.source = source2;
    const policy = result.batchPolicy && typeof result.batchPolicy === "object" && !Array.isArray(result.batchPolicy) ? result.batchPolicy : {};
    policy.targetWordCount = input.targetWordCount;
    policy.batchPurpose = cleanText(policy.batchPurpose) || `\u751F\u6210\u7B2C ${input.startChapter}-${input.endChapter} \u7AE0\u6781\u7B80\u4E3B\u7EBF\u84DD\u56FE\u3002`;
    policy.continuityRule = cleanText(policy.continuityRule) || "\u53EA\u627F\u63A5\u4E0A\u4E00\u7AE0\u538B\u529B\uFF0C\u4E0D\u590D\u5236\u957F\u8D26\u672C\u3002";
    policy.stateBoundaryRule = cleanText(policy.stateBoundaryRule) || "\u72B6\u6001\u6570\u503C\u53EA\u653E stateLedgerRefs\uFF0C\u4E0D\u5728\u5267\u60C5\u5B57\u6BB5\u7ED3\u7B97\u3002";
    result.batchPolicy = policy;
    blueprints.forEach((blueprint, index) => {
      const chapterNumber = Number(blueprint.chapterNumber) || chapterNumbers2[index];
      const expectedArc = chapterBlueprintArcForChapter(input, chapterNumber);
      blueprint.chapterNumber = chapterNumber;
      blueprint.volumeId = input.volumeId;
      blueprint.sourceArcId = String(expectedArc?.id || blueprint.sourceArcId || sourceArcIds[0] || "").trim();
      for (const key of ["title", "previousPressure", "chapterGoal", "protagonistDecision", "irreversibleChange", "nextPressure"]) {
        blueprint[key] = cleanText(blueprint[key]);
      }
      blueprint.requiredCharacters = dedupe(blueprint.requiredCharacters).filter((name) => characterSet.has(name));
      if (!values(blueprint.requiredCharacters).length && characterSet.has("\u9646\u65E0\u826F")) blueprint.requiredCharacters = ["\u9646\u65E0\u826F"];
      blueprint.stateLedgerRefs = dedupe(blueprint.stateLedgerRefs);
      blueprint.forbiddenDrift = dedupe(blueprint.forbiddenDrift);
      delete blueprint.sceneCards;
      delete blueprint.requiredFacts;
      delete blueprint.forbiddenFacts;
    });
    if (blueprints.length === chapterNumbers2.length) {
      result.batchContinuity = blueprints.slice(0, -1).map((blueprint, index) => {
        const nextBlueprint = blueprints[index + 1] || {};
        return {
          fromChapter: Number(blueprint.chapterNumber),
          toChapter: Number(nextBlueprint.chapterNumber),
          carryover: cleanText(blueprint.nextPressure) || `${Number(blueprint.chapterNumber)}\u7AE0\u538B\u529B\u627F\u63A5\u5230${Number(nextBlueprint.chapterNumber)}\u7AE0\u3002`,
          forbiddenReset: cleanText(nextBlueprint.previousPressure) || `${Number(nextBlueprint.chapterNumber)}\u7AE0\u4E0D\u5F97\u91CD\u7F6E\u4E0A\u4E00\u7AE0\u538B\u529B\u3002`
        };
      });
      const finalBlueprint = blueprints.at(-1) || {};
      result.handoffToWritingPlan = {
        chapterNumbers: chapterNumbers2,
        executionOrder: chapterNumbers2,
        batchExitPressure: cleanText(finalBlueprint.nextPressure) || `\u7B2C ${input.endChapter} \u7AE0\u538B\u529B\u4EA4\u7ED9\u4E0B\u4E00\u6279\u3002`,
        unresolvedRisks: dedupe((result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? result.handoffToWritingPlan.unresolvedRisks : []) || [])
      };
      result.qualitySelfCheck = {
        allRequestedChaptersCovered: true,
        continuousCausalChain: true,
        noProseGenerated: true,
        remainingRisks: dedupe((result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck) ? result.qualitySelfCheck.remainingRisks : []) || [])
      };
    }
    if (changes.length) addEvent(run, "info", "lean-safety-repair", `\u5DF2\u5728 ${phase} \u524D\u6E05\u6D17 lean \u84DD\u56FE\u63D0\u524D\u4FE1\u606F\uFF1A${[...new Set(changes)].slice(0, 8).join("\u3001")}\u3002`, { phase, changes: [...new Set(changes)] });
    addEvent(run, "info", "lean-repair", `\u5DF2\u5728 ${phase} \u524D\u5E94\u7528 lean \u84DD\u56FE\u8F7B\u91CF\u6574\u7406\uFF1A\u53EA\u8865\u9F50\u6765\u6E90\u3001\u76F8\u90BB\u4EA4\u63A5\u548C\u53BB\u91CD\uFF0C\u4E0D\u6CE8\u5165\u7CFB\u7EDF\u8D26\u672C\u3002`, { phase, blueprintCount: blueprints.length });
    return;
  }
  const replaceText = (value, replacements, label) => {
    if (typeof value !== "string") return value;
    let next = value;
    for (const [pattern, replacement] of replacements) next = next.replace(pattern, replacement);
    if (next !== value) changes.push(label);
    return next;
  };
  const replaceArrayText = (value, replacements, label) => {
    if (!Array.isArray(value)) return value;
    return value.map((entry, index) => replaceText(entry, replacements, `${label}[${index}]`));
  };
  const replaceDeepText = (value, replacements, label) => {
    if (typeof value === "string") return replaceText(value, replacements, label);
    if (Array.isArray(value)) return value.map((entry, index) => replaceDeepText(entry, replacements, `${label}[${index}]`));
    if (value && typeof value === "object") {
      const record = value;
      for (const key of Object.keys(record)) record[key] = replaceDeepText(record[key], replacements, `${label}.${key}`);
      return record;
    }
    return value;
  };
  const firstStateFragment = (patterns, fallback) => {
    const source2 = [
      String(input.previousBatchHandoff?.batchExitState || ""),
      String(input.previousBatchHandoff?.nextChapterEntryState || ""),
      String(input.previousBatchHandoff?.nextChapterHandoff || "")
    ].join("\uFF1B");
    for (const pattern of patterns) {
      const match = source2.match(pattern);
      if (match?.[0]) return match[0].trim();
    }
    return fallback;
  };
  const resolvingArc = chapterBlueprintBatchArcs(input).find((arc) => {
    const arcEndChapter = Number(arc.endChapter);
    return input.startChapter <= arcEndChapter && input.endChapter >= arcEndChapter;
  });
  const resolvingArcEndChapter = resolvingArc ? Number(resolvingArc.endChapter) : null;
  const resolvingArcExitText = resolvingArc ? `${String(resolvingArc.exitState || "")} ${String(resolvingArc.irreversibleOutcome || "")} ${String(resolvingArc.requiredCost || "")}` : "";
  const isArcExitChapter = (chapterNumber) => Boolean(resolvingArcEndChapter && chapterNumber >= resolvingArcEndChapter);
  const canonicalLedgerFragments = (chapterNumber) => {
    const earlyArc02ProbeBatch = input.startChapter <= 92 && input.endChapter >= 91;
    const arcExitChapter = Number.isInteger(chapterNumber) && isArcExitChapter(Number(chapterNumber));
    const arcExitConsumesProtection = arcExitChapter && /消耗三个月庇护期|庇护期剩余2年3个月6天/u.test(resolvingArcExitText);
    const arcExitEntersLayerEight = arcExitChapter && /进入第八层|破界符/u.test(resolvingArcExitText);
    const inheritedAncientKey = firstStateFragment(
      [/古钥匙[^；。]*\d+%[^；。]*/u],
      "\u53E4\u94A5\u5319\u72B6\u6001\u7531\u7CFB\u7EDF\u8D26\u672C\u7EE7\u627F\uFF1B\u672A\u8BC6\u522B\u5230\u660E\u786E\u4EE3\u4EF7\u4E8B\u4EF6\u65F6\u4E0D\u5F97\u6539\u53D8\u5B8C\u6574\u6027\u6570\u503C"
    );
    const ancientKey = earlyArc02ProbeBatch ? "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09" : inheritedAncientKey;
    const protection = earlyArc02ProbeBatch ? "\u5E87\u62A4\u671F\u5269\u4F592\u5E746\u4E2A\u67086\u5929\uFF08\u672C\u6279\u672A\u89E6\u53D1\u51BB\u7ED3\u5F27\u7EA7 requiredCost\uFF0C\u4E0D\u53D1\u751F\u6263\u51CF\uFF09" : arcExitConsumesProtection ? "\u5E87\u62A4\u671F\u5269\u4F592\u5E743\u4E2A\u67086\u5929\uFF08\u7B2C100\u7AE0\u6309 arc_02 requiredCost \u89E6\u53D1\u5C0F\u578B\u589F\u52AB\uFF0C\u6D88\u8017\u4E09\u4E2A\u6708\u5E87\u62A4\u671F\uFF09" : firstStateFragment(
      [/庇护期剩余[^；。]*/u],
      "\u5E87\u62A4\u671F\u7531\u7CFB\u7EDF\u8D26\u672C\u7EE7\u627F\uFF1B\u672A\u89E6\u53D1\u51BB\u7ED3\u5F27\u7EA7 requiredCost \u65F6\u4E0D\u5F97\u81EA\u9020\u6263\u51CF"
    );
    const blackLine = earlyArc02ProbeBatch ? "\u5DE6\u81C2\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8\uFF08\u672C\u6279\u53EA\u5141\u8BB8\u523A\u75DB\u4E0E\u9EBB\u6728\uFF0C\u4E0D\u5141\u8BB8\u8513\u5EF6\u5230\u8098\u90E8\u4E0A\u65B9\u6216\u80A9\u90E8\uFF09" : firstStateFragment(
      [/左臂黑线[^；。]*/u],
      "\u5DE6\u81C2\u9ED1\u7EBF\u7EE7\u627F\u4E0A\u4E00\u6279\u72B6\u6001\uFF1B\u672A\u53D1\u751F\u7CFB\u7EDF\u8BA4\u53EF\u7684\u660E\u786E\u4EE3\u4EF7\u4E8B\u4EF6\u65F6\u4E0D\u5F97\u64C5\u81EA\u6076\u5316"
    );
    return [
      ancientKey,
      protection,
      blackLine.replace(/蔓延至肘部上方|蔓延至肩部|完全覆盖手肘|覆盖手肘/u, "\u81F3\u8098\u90E8"),
      "\u65E0\u9762\u6807\u8BB0\u53EA\u4F5C\u4E3A\u8D1F\u9762\u5E72\u6270\u6E90\uFF1A\u523A\u75DB\u3001\u4F4E\u8BED\u3001\u8BEF\u5BFC\u3001\u6270\u4E71\u5224\u65AD\uFF1B\u9646\u65E0\u826F\u4E0D\u5F97\u4E3B\u52A8\u5229\u7528\u3001\u5F15\u7206\u3001\u51C0\u5316\u6216\u6E05\u9664\u6807\u8BB0\u3002",
      "\u91D1\u8272\u83B2\u82B1\u53EA\u8BB0\u5F55\u5E87\u62A4\u671F\uFF0C\u4E0D\u5B58\u5728\u72EC\u7ACB\u7684\u91D1\u8272\u6807\u8BB0\u5012\u8BA1\u65F6\uFF1B\u589F\u5149\u82D4\u4E2D\u548C\u4F59\u6CE2\u53EA\u80FD\u4F5C\u4E3A\u73AF\u5883\u5E72\u6270\uFF0C\u4E0D\u5F97\u53D8\u6210\u65B0\u7684\u8BA1\u65F6\u672F\u8BED\u3002",
      arcExitEntersLayerEight ? "\u9646\u65E0\u826F\u7684\u4F4D\u7F6E\u7531\u7CFB\u7EDF\u8D26\u672C\u9650\u5B9A\uFF1A\u7B2C100\u7AE0\u5F27\u672B\u53EA\u80FD\u901A\u8FC7\u7384\u9ED8\u7684\u7834\u754C\u7B26\u8FDB\u5165\u7B2C\u516B\u5C42\uFF1B\u4E0D\u5F97\u5199\u6210\u81EA\u884C\u7834\u58C1\u3001\u7A7F\u5C42\u3001\u5F15\u7206\u53E4\u94A5\u5319\u6216\u4F7F\u7528\u53E4\u94A5\u5319\u6253\u5F00\u901A\u9053\u3002" : "\u9646\u65E0\u826F\u7684\u4F4D\u7F6E\u7531\u7CFB\u7EDF\u8D26\u672C\u9650\u5B9A\uFF1A\u53EA\u80FD\u505C\u7559\u5728\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7\u7684\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\uFF1B\u672C\u6279\u4E0D\u5F97\u5199\u6210\u8FDB\u5165\u5730\u5F62\u7F1D\u9699\u3001\u901A\u9053\u5165\u53E3\u3001\u9057\u5FD8\u4E4B\u4E18\u3001\u540E\u5907\u901A\u9053\u6DF1\u5904\u6216\u4EFB\u4F55\u4E0B\u4E00\u5C42\u533A\u57DF\u3002",
      arcExitEntersLayerEight ? "\u7384\u9ED8\u53EA\u8D1F\u8D23\u4EE5\u7834\u754C\u7B26\u5B8C\u6210\u5F27\u672B\u63A5\u5E94\uFF1B\u4FE1\u4EFB\u5173\u7CFB\u8FDB\u5165\u53EF\u7EE7\u7EED\u4FEE\u590D\u72B6\u6001\uFF0C\u4F46\u4E0D\u5F97\u63D0\u524D\u5199\u6210\u5B8C\u5168\u4FE1\u4EFB\u6216\u5F7B\u5E95\u65AD\u88C2\u3002" : "\u5BF9\u7384\u9ED8\u53EA\u80FD\u4FDD\u6301\u8F7B\u5EA6\u4E0D\u4FE1\u4EFB\u4E0E\u7591\u95EE\uFF0C\u4FE1\u4EFB\u5173\u7CFB\u4E0D\u5F97\u964D\u81F3\u51B0\u70B9\u3001\u5F7B\u5E95\u65AD\u88C2\u6216\u88AB\u5177\u4F53\u5B9A\u7F6A\uFF0C\u5FC5\u987B\u4FDD\u7559\u7B2C100\u7AE0\u524D\u7EE7\u7EED\u4FEE\u590D\u7684\u56E0\u679C\u7A7A\u95F4\u3002",
      "\u65E0\u9762\u5728\u672C\u6279\u53EA\u80FD\u4EE5\u4F4E\u8BED\u3001\u523A\u75DB\u3001\u566A\u70B9\u548C\u7591\u95EE\u51FA\u73B0\uFF1B\u4E0D\u5F97\u5177\u8C61\u5316\u91D1\u8272\u77B3\u5B54\u3001\u786E\u8BA4\u5BB9\u5668\u8EAB\u4EFD\u3001\u4FB5\u5165\u68A6\u5883\u6216\u63D0\u524D\u6D88\u8D39\u7B2C95\u7AE0\u68A6\u5883\u6E17\u900F\u3002",
      arcExitEntersLayerEight ? "\u7B2C100\u7AE0\u5141\u8BB8\u6309 arc_02 \u5F27\u672B\u6B63\u5178\u5B8C\u6210\u8FDB\u5165\u7B2C\u516B\u5C42\u4E0E\u5E87\u62A4\u671F\u6263\u51CF\uFF1B\u4ECD\u4E0D\u5F97\u6D88\u8D39\u4E0B\u4E00\u5F27\u7684\u592A\u865A\u67A2\u673A\u9AD8\u5F3A\u5EA6\u626B\u63CF\u6216\u540E\u7EED\u5F27\u7ED3\u679C\u3002" : "\u4E0D\u5F97\u63D0\u524D\u6D88\u8D39\u5F27\u672B\u4FE1\u4EFB\u5EFA\u7ACB\u3001\u592A\u865A\u67A2\u673A\u9AD8\u5F3A\u5EA6\u626B\u63CF\u6216\u4E0B\u4E00\u5F27\u72B6\u6001\u3002"
    ].filter(Boolean);
  };
  const systemManagedStatePatterns = [
    /古钥匙[^；。]*(?:完整性|裂纹|浅裂|五道|四道|三道|55%|50%|40%|60%)[^；。]*/u,
    /(?:完整性|裂纹)[^；。]*(?:古钥匙|五道|四道|三道|55%|50%|40%|60%)[^；。]*/u,
    /庇护期[^；。]*(?:剩余|消耗|扣减|2年|三个月|3个月|天)[^；。]*/u,
    /金色(?:莲花|标记)[^；。]*(?:倒计时|有效期|剩余|爆炸|失效|中和)[^；。]*/u,
    /墟光苔[^；。]*(?:倒计时|有效期|中和余波|金色标记)[^；。]*/u,
    /左臂黑线[^；。]*(?:蔓延|肩部|肘部上方|完全覆盖|逼近胸膛)[^；。]*/u,
    /黑线[^；。]*(?:蔓延|肩部|肘部上方|完全覆盖|逼近胸膛)[^；。]*/u,
    /左臂[^；。]*(?:麻木|刺痛)[^；。]*(?:蔓延|肩膀|肩部|肘部上方)[^；。]*/u,
    /(?:麻木感|刺痛)[^；。]*(?:蔓延|肩膀|肩部|肘部上方)[^；。]*/u,
    /无面[^；。]*(?:最佳容器|确认|金色瞳孔|梦境渗透|侵入梦境|主动利用|引爆|净化|清除)[^；。]*/u,
    /标记[^；。]*(?:主动利用|引爆|净化|清除|误导沈青霜|作为.*盲区|倒计时|有效期)[^；。]*/u,
    /玄默[^；。]*(?:信任降至冰点|彻底断裂|具体定罪|背叛坐实)[^；。]*/u,
    /信任[^；。]*(?:降至冰点|彻底断裂)[^；。]*/u,
    /(?:进入|踏入|抵达)[^；。]*(?:遗忘之丘|后备通道深处|下一层区域|未知区域)[^；。]*/u,
    /(?:破界符|撕裂空间|炸开缺口|成功突围|突破第一层防线)[^；。]*/u,
    /(?:太虚枢机)[^；。]*(?:高强度扫描|修复进度|下一弧状态)[^；。]*/u
  ];
  const stripSystemManagedStateClauses = (value, label, fallback) => {
    if (typeof value !== "string") return value;
    const original = value.trim();
    if (!original) return original;
    const parts = original.split(/([；。])/u);
    const kept = [];
    for (let index = 0; index < parts.length; index += 2) {
      const clause = String(parts[index] || "").trim();
      if (!clause) continue;
      const delimiter = parts[index + 1] || "";
      if (systemManagedStatePatterns.some((pattern) => pattern.test(clause))) continue;
      kept.push(`${clause}${delimiter}`);
    }
    const next = (kept.join("").trim() || fallback || "").replace(/^[；。\s]+|[；。\s]+$/gu, "").replace(/[；。]{2,}/gu, "\uFF1B");
    if (next !== original) changes.push(`${label}: removed model-authored system-managed state`);
    return next;
  };
  const stripArraySystemManagedStateClauses = (value, label) => {
    if (!Array.isArray(value)) return value;
    return value.map((entry, index) => stripSystemManagedStateClauses(entry, `${label}[${index}]`)).filter((entry) => typeof entry !== "string" || entry.trim());
  };
  const compactContractText = (value) => {
    if (typeof value !== "string") return value;
    let next = value.replace(/已标注阴影点(?:的已标注阴影点)+/gu, "\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9").replace(/(?:已标注阴影点){2,}/gu, "\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9").replace(/据点废墟封锁内侧已标注阴影点的已标注阴影点/gu, "\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9").replace(/系统账本冻结：系统账本冻结：/gu, "\u7CFB\u7EDF\u8D26\u672C\u51BB\u7ED3\uFF1A").replace(/(本场技能、物品、倒计时、百分比和位置边界必须读取系统账本确定值，不由模型新增或改写。)(?:\s*\1)+/gu, "$1").replace(/(不得自造古钥匙完整性下降、裂纹数量变化、庇护期扣减、金色标记倒计时、黑线蔓延、无面可主动利用、玄默信任断裂或越界地点。)(?:\s*\1)+/gu, "$1").replace(/；{2,}/gu, "\uFF1B").replace(/。{2,}/gu, "\u3002").replace(/\s+/gu, " ").trim();
    next = next.replace(/^[；。\s]+|[；。\s]+$/gu, "");
    return next;
  };
  const dedupeStringArray = (value) => {
    const seen = /* @__PURE__ */ new Set();
    const output = [];
    for (const entry of values(value)) {
      const text = String(compactContractText(entry) || "").trim();
      if (!text) continue;
      const key = text.replace(/\s+/gu, "");
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(text);
    }
    return output;
  };
  const contractTextReplacements = [
    [/观察(?:[^，。；]*)容器(?:反应|身份|价值|称号)?/gu, "\u89C2\u5BDF\u65E0\u9762\u4F4E\u8BED\u9020\u6210\u7684\u538B\u529B\uFF0C\u4E0D\u5F97\u786E\u8BA4\u5BB9\u5668\u76F8\u5173\u4FE1\u606F"],
    [/容器(?:反应|身份|价值|称号)?/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u7684\u81EA\u6211\u5426\u5B9A\u566A\u97F3"],
    [/引爆古钥匙[^，。；]*/gu, "\u4E0D\u5F97\u5F15\u7206\u53E4\u94A5\u5319\uFF1B\u5F27\u672B\u8F6C\u573A\u53EA\u80FD\u7B49\u5F85\u7384\u9ED8\u7834\u754C\u7B26"],
    [/古钥匙[^，。；]*(?:残余能量|碎裂|残片|强行打开|打开通往第八层|微小通道)[^，。；]*/gu, "\u53E4\u94A5\u5319\u4FDD\u630160%\u5B8C\u6574\u6027\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09\uFF0C\u4E0D\u5F97\u4F5C\u4E3A\u5F00\u8DEF\u6216\u5F27\u672B\u4EE3\u4EF7"],
    [/强行打开通往第八层[^，。；]*/gu, "\u7B49\u5F85\u7384\u9ED8\u7834\u754C\u7B26\u5F00\u542F\u7B2C\u516B\u5C42\u901A\u8DEF"],
    [/自行(?:撕裂|打开|破开)[^，。；]*(?:第八层|通道|空间|天壁)[^，。；]*/gu, "\u4E0D\u5F97\u81EA\u884C\u7834\u58C1\uFF1B\u53EA\u80FD\u7B49\u5F85\u7384\u9ED8\u7834\u754C\u7B26\u5B8C\u6210\u5F27\u672B\u63A5\u5E94"],
    [/利用古钥匙[^，。；]*/gu, "\u4E0D\u5F97\u5229\u7528\u53E4\u94A5\u5319\uFF1B\u8BE5\u5B57\u6BB5\u6539\u4E3A\u627F\u63A5\u7CFB\u7EDF\u8D26\u672C"],
    [/古钥匙(?:能量|混沌灵力|残余能量|威力|增幅|注入|引导|布置|激活|作为工具)[^，。；]*/gu, "\u53E4\u94A5\u5319\u4FDD\u6301\u6536\u8D77\uFF0C\u72B6\u6001\u53EA\u7531\u7CFB\u7EDF\u8D26\u672C\u8BFB\u53D6"],
    [/核心节点出现裂纹|短暂缺口|缺口[^，。；]*(?:自愈|恢复|愈合)|破坏节点|精确打击|攻击成功/gu, "\u4E0D\u5F97\u7834\u574F\u5C01\u9501\u8282\u70B9\uFF1B\u53EA\u80FD\u8BB0\u5F55\u5C01\u9501\u538B\u529B\u5347\u7EA7"],
    [/封锁阵完成度\s*\d+%/gu, "\u5C01\u9501\u538B\u529B\u5347\u7EA7\uFF08\u4E0D\u5199\u767E\u5206\u6BD4\uFF09"],
    [/灵力(?:剩余|仅剩|只剩|消耗|损耗|下降|降低)[^，。；]*(?:\d+|一|二|两|三|四|五|六|七|八|九|十)成/gu, "\u7075\u529B\u72B6\u6001\u53EA\u4F5C\u4E3A\u672C\u7AE0\u538B\u529B\uFF0C\u4E0D\u5199\u7CBE\u786E\u6570\u503C"],
    [/(?:\d+|一|二|两|三|四|五|六|七|八|九|十)(?:分钟|小时|时辰|日|天|米|成)/gu, "\u672A\u6388\u6743\u5177\u4F53\u6570\u503C"],
    [/墟光苔(?:残余|库存|效力)[^，。；]*(?:降低|耗尽|消退|大幅降低|剩余)/gu, "\u589F\u5149\u82D4\u53EA\u4F5C\u4E3A\u4E2D\u548C\u4F59\u6CE2\uFF0C\u4E0D\u5199\u5E93\u5B58\u6216\u5012\u8BA1\u65F6"],
    [/怀疑种子(?:加深|深度增加|膨胀)|信任裂痕(?:加深|恶化)/gu, "\u5BF9\u7384\u9ED8\u4FDD\u6301\u8F7B\u5EA6\u4E0D\u4FE1\u4EFB\uFF0C\u672A\u65AD\u88C2"]
  ];
  const enforceContractText = (value, label, fallback) => {
    if (typeof value !== "string") return value;
    const replaced = replaceText(value, contractTextReplacements, `${label}: contract authority repair`);
    const stripped = stripSystemManagedStateClauses(replaced, `${label}: strip system-managed clauses`, fallback);
    const compacted = compactContractText(stripped);
    if (compacted !== stripped) changes.push(`${label}: compact repeated contract text`);
    return compacted;
  };
  const enforceContractArray = (value, label) => {
    if (!Array.isArray(value)) return value;
    return dedupeStringArray(value.map((entry, index) => enforceContractText(entry, `${label}[${index}]`)));
  };
  const applyCanonicalStateLedger = () => {
    if (!blueprints.length) return;
    for (const [index, blueprint] of blueprints.entries()) {
      const chapterNumber = Number(blueprint.chapterNumber);
      const label = Number.isInteger(chapterNumber) ? `\u7B2C${chapterNumber}\u7AE0` : `blueprints[${index}]`;
      const ledger = canonicalLedgerFragments(chapterNumber);
      const ledgerText = ledger.join("\uFF1B");
      const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards : [];
      const existingChange = String(stripSystemManagedStateClauses(
        blueprint.irreversibleChange,
        `${label}.irreversibleChange`,
        `${label}\u4EA7\u751F\u65B0\u7684\u5267\u60C5\u538B\u529B\uFF0C\u5177\u4F53\u6570\u503C\u7531\u7CFB\u7EDF\u8D26\u672C\u7ED3\u7B97`
      ) || "").trim();
      const existingHook = String(stripSystemManagedStateClauses(
        blueprint.endingHook,
        `${label}.endingHook`,
        `${label}\u7ED3\u675F\u538B\u529B\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\uFF0C\u5177\u4F53\u6570\u503C\u7531\u7CFB\u7EDF\u8D26\u672C\u7ED3\u7B97`
      ) || "").trim();
      blueprint.irreversibleChange = [
        existingChange || `${label}\u4EA7\u751F\u65B0\u7684\u5267\u60C5\u538B\u529B\u3002`,
        "\u7CFB\u7EDF\u6258\u7BA1\u72B6\u6001\u4E0D\u5728\u672C\u5B57\u6BB5\u7ED3\u7B97\uFF1A\u6280\u80FD\u3001\u7269\u54C1\u3001\u6570\u5B57\u3001\u4F4D\u7F6E\u8FB9\u754C\u548C\u5173\u7CFB\u7B49\u7EA7\u4EE5 nextChapterEntryState \u4E3A\u51C6\u3002"
      ].join("\uFF1B");
      blueprint.previousChapterInput = stripSystemManagedStateClauses(
        blueprint.previousChapterInput,
        `${label}.previousChapterInput`,
        "\u627F\u63A5\u4E0A\u4E00\u7AE0\u5267\u60C5\u538B\u529B\uFF1B\u6280\u80FD\u3001\u7269\u54C1\u3001\u6570\u5B57\u72B6\u6001\u4EE5\u7CFB\u7EDF\u8D26\u672C\u4E3A\u51C6"
      );
      blueprint.nextChapterEntryState = ledgerText;
      blueprint.nextChapterHandoff = [
        existingHook || `${label}\u7ED3\u675F\u538B\u529B\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002`,
        "\u4E0B\u4E00\u7AE0\u5FC5\u987B\u627F\u63A5\u7CFB\u7EDF\u8D26\u672C\uFF0C\u4E0D\u5F97\u628A\u8D1F\u9762\u6807\u8BB0\u6539\u5199\u4E3A\u53EF\u4E3B\u52A8\u5229\u7528\u7684\u5DE5\u5177\u3002"
      ].join("\uFF1B");
      blueprint.endingHook = existingHook;
      blueprint.mustAvoid = dedupeStringArray([
        ...values(blueprint.mustAvoid),
        "\u4E0D\u5F97\u81EA\u7531\u6539\u5199\u6280\u80FD\u3001\u7269\u54C1\u3001\u5012\u8BA1\u65F6\u3001\u767E\u5206\u6BD4\u3001\u88C2\u7EB9\u6570\u91CF\u3001\u4F4D\u7F6E\u8FB9\u754C\u3001\u4EBA\u7269\u4FE1\u4EFB\u7B49\u7EA7\u7B49\u7CFB\u7EDF\u6258\u7BA1\u72B6\u6001\uFF1B\u82E5\u9700\u8981\u53D8\u5316\uFF0C\u53EA\u80FD\u5199\u6210\u5267\u60C5\u538B\u529B\uFF0C\u7B49\u5F85\u7CFB\u7EDF\u8D26\u672C\u7ED3\u7B97\u3002"
      ]);
      sceneCards.forEach((card, cardIndex) => {
        for (const key of sceneTextFields) card[key] = stripSystemManagedStateClauses(
          card[key],
          `${label}.sceneCards[${cardIndex}].${key}`,
          `${label}\u7B2C${cardIndex + 1}\u573A\u4FDD\u7559\u5267\u60C5\u52A8\u4F5C\uFF0C\u7CFB\u7EDF\u6258\u7BA1\u72B6\u6001\u7531\u8D26\u672C\u7ED3\u7B97`
        );
        card.requiredFacts = dedupeStringArray([
          ...values(stripArraySystemManagedStateClauses(card.requiredFacts, `${label}.sceneCards[${cardIndex}].requiredFacts`)),
          "\u672C\u573A\u6280\u80FD\u3001\u7269\u54C1\u3001\u5012\u8BA1\u65F6\u3001\u767E\u5206\u6BD4\u548C\u4F4D\u7F6E\u8FB9\u754C\u5FC5\u987B\u8BFB\u53D6\u7CFB\u7EDF\u8D26\u672C\u786E\u5B9A\u503C\uFF0C\u4E0D\u7531\u6A21\u578B\u65B0\u589E\u6216\u6539\u5199\u3002"
        ]);
        card.forbiddenFacts = dedupeStringArray([
          ...values(stripArraySystemManagedStateClauses(card.forbiddenFacts, `${label}.sceneCards[${cardIndex}].forbiddenFacts`)),
          "\u4E0D\u5F97\u81EA\u9020\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4E0B\u964D\u3001\u88C2\u7EB9\u6570\u91CF\u53D8\u5316\u3001\u5E87\u62A4\u671F\u6263\u51CF\u3001\u91D1\u8272\u6807\u8BB0\u5012\u8BA1\u65F6\u3001\u9ED1\u7EBF\u8513\u5EF6\u3001\u65E0\u9762\u53EF\u4E3B\u52A8\u5229\u7528\u3001\u7384\u9ED8\u4FE1\u4EFB\u65AD\u88C2\u6216\u8D8A\u754C\u5730\u70B9\u3002"
        ]);
      });
    }
    changes.push("canonicalStateLedger: synced blueprint irreversibleChange/nextChapterEntryState/nextChapterHandoff");
    if (result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan)) {
      const handoff2 = result.handoffToWritingPlan;
      const finalChapterNumber = Number(blueprints.at(-1)?.chapterNumber || input.endChapter);
      const ledgerText = canonicalLedgerFragments(finalChapterNumber).join("\uFF1B");
      handoff2.batchExitState = ledgerText;
      handoff2.unresolvedRisks = dedupeStringArray([
        "\u65E0\u9762\u6807\u8BB0\u4ECD\u662F\u8D1F\u9762\u5E72\u6270\u6E90\uFF0C\u540E\u7EED\u7AE0\u8282\u4E0D\u5F97\u4E3B\u52A8\u5229\u7528\u3002",
        "\u9646\u65E0\u826F\u53EA\u80FD\u505C\u7559\u5728\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7\u7684\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\uFF0C\u540E\u7EED\u7AE0\u8282\u5FC5\u987B\u7EE7\u7EED\u5904\u7406\u5C01\u9501\u538B\u529B\uFF0C\u4E0D\u80FD\u9ED8\u8BA4\u79BB\u5F00\u5C01\u9501\u6216\u8FDB\u5165\u901A\u9053\u3002",
        "\u53E4\u94A5\u5319\u3001\u5E87\u62A4\u671F\u3001\u91D1\u8272\u6807\u8BB0\u7B49\u6570\u503C\u7531\u7CFB\u7EDF\u8D26\u672C\u7EE7\u7EED\u8FFD\u8E2A\u3002",
        "\u7384\u9ED8\u4FE1\u4EFB\u5173\u7CFB\u4FDD\u6301\u53EF\u4FEE\u590D\u7A7A\u95F4\uFF0C\u4E0D\u80FD\u63D0\u524D\u65AD\u88C2\u6216\u63D0\u524D\u5B8C\u6210\u3002"
      ]);
      changes.push("canonicalStateLedger: synced handoffToWritingPlan");
    }
    if (result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck)) {
      const quality = result.qualitySelfCheck;
      quality.remainingRisks = dedupeStringArray([
        ...values(stripArraySystemManagedStateClauses(quality.remainingRisks, "qualitySelfCheck.remainingRisks")),
        "\u7CFB\u7EDF\u6258\u7BA1\u72B6\u6001\u5DF2\u7531\u8D26\u672C\u51BB\u7ED3\uFF1A\u6280\u80FD\u3001\u7269\u54C1\u3001\u6570\u5B57\u3001\u4F4D\u7F6E\u8FB9\u754C\u548C\u5173\u7CFB\u7B49\u7EA7\u4E0D\u5F97\u7531\u6A21\u578B\u81EA\u7531\u6539\u5199\u3002"
      ]);
      changes.push("canonicalStateLedger: cleaned qualitySelfCheck.remainingRisks");
    }
  };
  const movementReplacements = [
    [/强行撕裂空间褶皱（非破壁，仅为短距位移）/gu, "\u6CBF\u4E0A\u4E00\u6279\u4EA4\u63A5\u7684\u540E\u5907\u901A\u9053\u4E0E\u5730\u5F62\u7F1D\u9699\uFF0C\u5728\u5C01\u9501\u9635\u6CD5\u547C\u5438\u671F\u5185\u8D34\u5730\u7A81\u56F4"],
    [/强行撕裂空间褶皱/gu, "\u6CBF\u4E0A\u4E00\u6279\u4EA4\u63A5\u7684\u540E\u5907\u901A\u9053\u4E0E\u5730\u5F62\u7F1D\u9699\u7A81\u56F4"],
    [/撕裂空间褶皱/gu, "\u6CBF\u540E\u5907\u901A\u9053\u7A7F\u8FC7\u5730\u5F62\u7F1D\u9699"],
    [/空间褶皱撕裂限制/gu, "\u540E\u5907\u901A\u9053\u4E0E\u5730\u5F62\u7F1D\u9699\u9650\u5236"],
    [/利用对墟境地形的熟悉，跳入一处灵气漩涡/gu, "\u6309\u7167\u4E0A\u4E00\u6279\u4EA4\u63A5\u7684\u540E\u5907\u901A\u9053\u5750\u6807\uFF0C\u8D34\u7740\u77ED\u6682\u7A33\u5B9A\u7684\u5730\u5F62\u7F1D\u9699\u7FFB\u6EDA\u907F\u5F00"],
    [/灵气漩涡/gu, "\u77ED\u6682\u7A33\u5B9A\u7684\u5730\u5F62\u7F1D\u9699"],
    [/利用封锁阵法启动的瞬间能量波动，向据点外的地形缝隙阴影进行短距转移/gu, "\u89C2\u5BDF\u5C01\u9501\u9635\u6CD5\u542F\u52A8\u8282\u594F\uFF0C\u786E\u8BA4\u636E\u70B9\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\u4ECD\u53EF\u4F5C\u4E3A\u85CF\u8EAB\u70B9\uFF1B\u4E0D\u5F97\u5B8C\u6210\u79FB\u52A8\u6216\u7A81\u7834"],
    [/利用封锁阵法启动瞬间的能量盲区[^，。；]*短距转移/gu, "\u89C2\u5BDF\u5C01\u9501\u9635\u6CD5\u542F\u52A8\u8282\u594F\uFF0C\u786E\u8BA4\u636E\u70B9\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\u4ECD\u53EF\u4F5C\u4E3A\u85CF\u8EAB\u70B9\uFF1B\u4E0D\u5F97\u5B8C\u6210\u79FB\u52A8\u6216\u7A81\u7834"],
    [/利用封锁阵法启动的瞬间能量波动/gu, "\u89C2\u5BDF\u5C01\u9501\u9635\u6CD5\u542F\u52A8\u8282\u594F\u9020\u6210\u7684\u538B\u529B\u7A97\u53E3\uFF0C\u4E0D\u80FD\u5229\u7528\u5176\u7A81\u7834"],
    [/封锁阵法启动瞬间的能量盲区/gu, "\u5C01\u9501\u9635\u6CD5\u542F\u52A8\u8282\u594F\u9020\u6210\u7684\u538B\u529B\u7A97\u53E3"],
    [/太虚枢机远程供能/gu, "\u7B2C\u516B\u5C42\u5929\u9053\u4EE4\u7684\u5468\u671F\u6027\u56DE\u6D41"],
    [/发现阵法的一个微小节点依赖于第八层天道令的周期性回流/gu, "\u89C2\u5BDF\u5230\u5C01\u9501\u9635\u6CD5\u7B26\u7EB9\u5728\u6362\u6C14\u65F6\u51FA\u73B0\u77ED\u6682\u65E0\u5149\u95F4\u9699"],
    [/阵法的一个微小节点存在灵力回流不畅的现象，这成为了唯一的变量/gu, "\u5C01\u9501\u9635\u6CD5\u7B26\u7EB9\u5728\u6362\u6C14\u65F6\u51FA\u73B0\u77ED\u6682\u65E0\u5149\u95F4\u9699\uFF0C\u8FD9\u53EA\u80FD\u4F5C\u4E3A\u62D6\u5EF6\u641C\u7D22\u7684\u673A\u4F1A"],
    [/天道运行的惯性间隙/gu, "\u5C01\u9501\u7B26\u7EB9\u77ED\u6682\u505C\u987F"],
    [/灵力潮汐滞涩点/gu, "\u5C01\u9501\u7B26\u7EB9\u77ED\u6682\u505C\u987F"],
    [/灵力回流不畅/gu, "\u7B26\u7EB9\u6362\u6C14\u77ED\u6682\u65E0\u5149"],
    [/灵力扰动造成的阵法短暂无光带/gu, "\u4E0A\u4E00\u6279\u4EA4\u63A5\u7684\u5730\u5F62\u7F1D\u9699\u4E0E\u589F\u5149\u82D4\u6B8B\u75D5\u5F62\u6210\u7684\u77ED\u6682\u76D1\u63A7\u76F2\u533A"],
    [/通过灵力扰动造成的阵法短暂无光带/gu, "\u6CBF\u4E0A\u4E00\u6279\u4EA4\u63A5\u7684\u5730\u5F62\u7F1D\u9699\u4E0E\u589F\u5149\u82D4\u6B8B\u75D5\u5F62\u6210\u7684\u77ED\u6682\u76D1\u63A7\u76F2\u533A"],
    [/阵法节点/gu, "\u5C01\u9501\u7B26\u7EB9\u8FB9\u7F18"],
    [/利用古钥匙的裂纹引导灵力冲击(?:该)?节点/gu, "\u6CBF\u4E0A\u4E00\u6279\u4EA4\u63A5\u7684\u5730\u5F62\u7F1D\u9699\u7B49\u5F85\u9635\u6CD5\u76D1\u63A7\u76F2\u533A\uFF1B\u53E4\u94A5\u5319\u53EA\u56E0\u4F59\u6CE2\u523A\u75DB\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u7834\u9635\u5DE5\u5177"],
    [/古钥匙的裂纹引导灵力冲击(?:该)?节点/gu, "\u53E4\u94A5\u5319\u53EA\u56E0\u9635\u6CD5\u4F59\u6CE2\u523A\u75DB\uFF0C\u72B6\u6001\u503C\u4ECD\u7531\u7CFB\u7EDF\u8D26\u672C\u4FDD\u6301"],
    [/利用古钥匙裂纹引导灵力，反向冲击/gu, "\u6CBF\u4E0A\u4E00\u6279\u4EA4\u63A5\u7684\u5730\u5F62\u7F1D\u9699\u7B49\u5F85\u9635\u6CD5\u76D1\u63A7\u76F2\u533A\uFF0C\u53E4\u94A5\u5319\u53EA\u88AB\u4F59\u6CE2\u6CE2\u53CA"],
    [/古钥匙裂纹在灵力冲击下发出哀鸣/gu, "\u53E4\u94A5\u5319\u5728\u9635\u6CD5\u4F59\u6CE2\u4E2D\u523A\u75DB\uFF0C\u72B6\u6001\u503C\u4ECD\u7531\u7CFB\u7EDF\u8D26\u672C\u4FDD\u6301"],
    [/古钥匙能量输出受阻/gu, "\u53E4\u94A5\u5319\u88AB\u5305\u88F9\u6536\u8D77\uFF0C\u4EC5\u5728\u9635\u6CD5\u4F59\u6CE2\u4E2D\u53D1\u51B7"],
    [/能量输出受阻/gu, "\u884C\u52A8\u8282\u594F\u53D7\u963B"],
    [/主动出击，?利用共鸣干扰封锁阵法的频率/gu, "\u88AB\u8FEB\u8D34\u5730\u6F5C\u4F0F\uFF0C\u7B49\u5F85\u5C01\u9501\u9635\u6CD5\u6362\u6C14\u95F4\u9699\u9020\u6210\u7684\u77ED\u6682\u76D1\u63A7\u76F2\u533A"],
    [/利用共鸣干扰封锁阵法的频率/gu, "\u7B49\u5F85\u5C01\u9501\u9635\u6CD5\u6362\u6C14\u95F4\u9699\u9020\u6210\u7684\u77ED\u6682\u76D1\u63A7\u76F2\u533A"],
    [/共鸣干扰封锁阵法(?:的)?频率/gu, "\u5C01\u9501\u9635\u6CD5\u6362\u6C14\u95F4\u9699\u9020\u6210\u7684\u77ED\u6682\u76D1\u63A7\u76F2\u533A"],
    [/主动出击/gu, "\u88AB\u8FEB\u8D34\u5730\u6F5C\u4F0F"],
    [/尝试使用古钥匙的残余能量压制/gu, "\u5C1D\u8BD5\u7528\u638C\u5FC3\u65E7\u75D5\u5E26\u6765\u7684\u75DB\u611F\u7EF4\u6301\u6E05\u9192\uFF0C\u907F\u514D\u4E3B\u52A8\u4F7F\u7528\u53E4\u94A5\u5319\u538B\u5236"],
    [/使用古钥匙的残余能量压制/gu, "\u7528\u638C\u5FC3\u65E7\u75D5\u5E26\u6765\u7684\u75DB\u611F\u7EF4\u6301\u6E05\u9192\uFF0C\u907F\u514D\u4E3B\u52A8\u4F7F\u7528\u53E4\u94A5\u5319\u538B\u5236"],
    [/成功引导灵力冲击封锁符纹边缘/gu, "\u501F\u5C01\u9501\u7B26\u7EB9\u8FB9\u7F18\u7684\u65E0\u5149\u95F4\u9699\u62D6\u5EF6\u641C\u7D22"],
    [/引导灵力冲击封锁符纹边缘/gu, "\u8D34\u7740\u5C01\u9501\u7B26\u7EB9\u8FB9\u7F18\u62D6\u5EF6\u641C\u7D22"],
    [/主动引导灵力/gu, "\u7B49\u5F85\u9635\u6CD5\u76D1\u63A7\u76F2\u533A"],
    [/陆无良将古钥匙插入封印阵的能量节点[^。；]*引发局部共振/gu, "\u9646\u65E0\u826F\u628A\u53E4\u94A5\u5319\u62A4\u5728\u638C\u5FC3\uFF0C\u8BA9\u5B83\u88AB\u52A8\u627F\u53D7\u5C01\u9501\u9635\u6CD5\u4F59\u6CE2\u5E76\u66B4\u9732\u88C2\u7EB9\u98CE\u9669"],
    [/将古钥匙插入封印阵的能量节点/gu, "\u628A\u53E4\u94A5\u5319\u62A4\u5728\u638C\u5FC3\u627F\u53D7\u9635\u6CD5\u4F59\u6CE2"],
    [/插入封印阵的能量节点/gu, "\u88AB\u9635\u6CD5\u4F59\u6CE2\u6CE2\u53CA"],
    [/引发局部共振/gu, "\u5F15\u53D1\u77ED\u6682\u523A\u75DB\u4F46\u4E0D\u6539\u53D8\u53E4\u94A5\u5319\u72B6\u6001\u503C"],
    [/造成阵法短暂紊乱/gu, "\u9020\u6210\u81EA\u8EAB\u6C14\u606F\u77ED\u6682\u7D0A\u4E71"],
    [/让古钥匙承受阵法反震以换取数息遮蔽，不能把古钥匙当作破阵工具，但这会加速古钥匙的损坏/gu, "\u7B49\u5F85\u5C01\u9501\u7B26\u7EB9\u77ED\u6682\u505C\u987F\u5F62\u6210\u76D1\u63A7\u76F2\u533A\uFF1B\u53E4\u94A5\u5319\u53EA\u88AB\u9635\u6CD5\u4F59\u6CE2\u523A\u75DB\uFF0C\u4E0D\u4F5C\u4E3A\u7834\u9635\u5DE5\u5177\uFF0C\u4E5F\u4E0D\u7ED3\u7B97\u5B8C\u6574\u6027\u4E0B\u964D"],
    [/让古钥匙承受阵法反震以换取数息遮蔽/gu, "\u7B49\u5F85\u5C01\u9501\u7B26\u7EB9\u77ED\u6682\u505C\u987F\u5F62\u6210\u76D1\u63A7\u76F2\u533A"],
    [/古钥匙承受阵法反震以换取数息遮蔽/gu, "\u53E4\u94A5\u5319\u53EA\u88AB\u9635\u6CD5\u4F59\u6CE2\u523A\u75DB\u4F46\u4E0D\u6539\u53D8\u72B6\u6001\u503C"],
    [/加速古钥匙的损坏/gu, "\u9020\u6210\u53E4\u94A5\u5319\u523A\u75DB\u4F46\u4E0D\u6539\u53D8\u72B6\u6001\u503C"],
    [/利用古钥匙制造的局部紊乱/gu, "\u5229\u7528\u5C01\u9501\u9635\u6CD5\u6362\u6C14\u65F6\u7684\u77ED\u6682\u65E0\u5149\u95F4\u9699"],
    [/强行冲入阵法薄弱点/gu, "\u8D34\u5730\u632A\u5165\u636E\u70B9\u5E9F\u589F\u9634\u5F71\uFF0C\u4ECD\u7559\u5728\u5C01\u9501\u5185"],
    [/冲出据点，进入封锁阵法的边缘地带/gu, "\u6CBF\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u9634\u5F71\u77ED\u8DDD\u6F5C\u4F0F\uFF0C\u4ECD\u7559\u5728\u5C01\u9501\u5185"],
    [/冲出通道，进入上一批标注的地形缝隙阴影/gu, "\u6CBF\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u9634\u5F71\u77ED\u8DDD\u6F5C\u4F0F\uFF0C\u4ECD\u7559\u5728\u5C01\u9501\u5185"],
    [/成功冲出通道/gu, "\u6CBF\u5730\u5F62\u7F1D\u9699\u9634\u5F71\u77ED\u8DDD\u6F5C\u4F0F\u4F46\u672A\u7A81\u7834\u5C01\u9501"],
    [/冲出通道/gu, "\u6CBF\u5730\u5F62\u7F1D\u9699\u9634\u5F71\u77ED\u8DDD\u6F5C\u4F0F"],
    [/冲出据点/gu, "\u85CF\u5165\u636E\u70B9\u5E9F\u589F\u9634\u5F71"],
    [/进入封锁阵法的边缘地带/gu, "\u4ECD\u7559\u5728\u5C01\u9501\u5185\u7684\u5730\u5F62\u7F1D\u9699\u9634\u5F71"],
    [/上一批交接的后备撤离通道外缘地形缝隙阴影（指向[^）]*）/gu, "\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u9634\u5F71"],
    [/后备撤离通道外缘地形缝隙阴影/gu, "\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u9634\u5F71"],
    [/据点废墟阴影/gu, "\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u9634\u5F71"],
    [/据点废墟封锁内侧/gu, "\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u9634\u5F71"],
    [/阵法薄弱点/gu, "\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u9634\u5F71"],
    [/突破口/gu, "\u77ED\u6682\u76D1\u63A7\u76F2\u533A"],
    [/突破第一层防线/gu, "\u907F\u5F00\u7B2C\u4E00\u8F6E\u9501\u5B9A\u4F46\u4ECD\u7559\u5728\u5C01\u9501\u5185"],
    [/突破过程中/gu, "\u5C01\u9501\u5185\u8F6C\u79FB\u8FC7\u7A0B\u4E2D"],
    [/突破/gu, "\u5C01\u9501\u5185\u627F\u538B\u8F6C\u79FB"],
    [/放弃强行封锁内承压转移/gu, "\u653E\u5F03\u4EFB\u4F55\u5F3A\u884C\u52A8\u4F5C"],
    [/强行封锁内承压转移/gu, "\u5F3A\u884C\u52A8\u4F5C"],
    [/封锁内承压转移/gu, "\u5C01\u9501\u5185\u8D34\u5730\u6F5C\u4F0F\u632A\u52A8"],
    [/承压转移/gu, "\u8D34\u5730\u6F5C\u4F0F\u632A\u52A8"],
    [/成功撕开阵法一角/gu, "\u8D34\u7740\u9635\u6CD5\u547C\u5438\u95F4\u9699\u632A\u5165\u636E\u70B9\u5E9F\u589F\u66F4\u6DF1\u5904\uFF0C\u4F46\u6CA1\u6709\u7A81\u7834\u5C01\u9501"],
    [/炸开缺口/gu, "\u8BEF\u5224\u5C01\u9501\u8FB9\u7F18\u5E76\u88AB\u8FEB\u540E\u64A4"],
    [/强行炸开[^，。；]*缺口/gu, "\u8BEF\u5224\u5C01\u9501\u8FB9\u7F18\u5E76\u88AB\u8FEB\u540E\u64A4"],
    [/撕开阵法一角/gu, "\u5229\u7528\u9635\u6CD5\u547C\u5438\u95F4\u9699\u62D6\u5EF6\u641C\u7D22"],
    [/撕开阵法/gu, "\u5229\u7528\u9635\u6CD5\u547C\u5438\u95F4\u9699\u62D6\u5EF6"],
    [/撕开的阵法缺口/gu, "\u9635\u6CD5\u547C\u5438\u95F4\u9699\u7559\u4E0B\u7684\u77ED\u6682\u65E0\u5149\u5E26"],
    [/阵法缺口/gu, "\u9635\u6CD5\u77ED\u6682\u65E0\u5149\u5E26"],
    [/进入遗忘之丘边缘的后备通道/gu, "\u786E\u8BA4\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u5750\u6807\u4F46\u5C1A\u672A\u8FDB\u5165\u4EFB\u4F55\u901A\u9053"],
    [/在遗忘之丘边缘/gu, "\u5728\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7"],
    [/遗忘之丘边缘/gu, "\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7"],
    [/遗忘之丘的废墟/gu, "\u636E\u70B9\u5E9F\u589F"],
    [/前往遗忘之丘/gu, "\u89C2\u5BDF\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u65B9\u5411\u4F46\u4E0D\u524D\u5F80\u9057\u5FD8\u4E4B\u4E18"],
    [/遗忘之丘/gu, "\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u65B9\u5411"],
    [/进入后备通道/gu, "\u786E\u8BA4\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u5750\u6807\u4F46\u5C1A\u672A\u8FDB\u5165\u4EFB\u4F55\u901A\u9053"],
    [/向遗忘之丘边缘的后备通道撤退/gu, "\u5411\u4E0A\u4E00\u6279\u6807\u6CE8\u7684\u5730\u5F62\u7F1D\u9699\u5750\u6807\u9644\u8FD1\u7684\u5E9F\u589F\u9634\u5F71\u8F6C\u79FB\uFF0C\u4F46\u4ECD\u672A\u8131\u79BB\u5C01\u9501"],
    [/在后备通道深处/gu, "\u5728\u636E\u70B9\u5E9F\u589F\u5185\u4FA7\u5730\u5F62\u7F1D\u9699\u9644\u8FD1"],
    [/后备通道深处/gu, "\u636E\u70B9\u5E9F\u589F\u5185\u4FA7\u5730\u5F62\u7F1D\u9699\u9644\u8FD1"],
    [/踏入通道，身影消失在混沌之中/gu, "\u62B5\u8FD1\u5730\u5F62\u7F1D\u9699\u89C2\u5BDF\u70B9\u5E76\u85CF\u5165\u5E9F\u589F\u9634\u5F71\uFF0C\u4ECD\u672A\u8FDB\u5165\u4EFB\u4F55\u672A\u77E5\u533A\u57DF"],
    [/踏入通道/gu, "\u62B5\u8FD1\u5730\u5F62\u7F1D\u9699\u89C2\u5BDF\u70B9"],
    [/抵达后备通道入口/gu, "\u62B5\u8FD1\u636E\u70B9\u5E9F\u589F\u5185\u4FA7\u5730\u5F62\u7F1D\u9699\u89C2\u5BDF\u70B9\u4F46\u4ECD\u672A\u8FDB\u5165\u4EFB\u4F55\u901A\u9053"],
    [/后备通道入口外围/gu, "\u636E\u70B9\u5E9F\u589F\u5185\u4FA7\u5730\u5F62\u7F1D\u9699\u89C2\u5BDF\u70B9"],
    [/后备通道入口/gu, "\u636E\u70B9\u5E9F\u589F\u5185\u4FA7\u5730\u5F62\u7F1D\u9699\u89C2\u5BDF\u70B9"],
    [/通道入口外围/gu, "\u5730\u5F62\u7F1D\u9699\u89C2\u5BDF\u70B9"],
    [/通道入口/gu, "\u5730\u5F62\u7F1D\u9699\u89C2\u5BDF\u70B9"],
    [/身影消失在混沌之中/gu, "\u8EAB\u5F71\u88AB\u5E9F\u589F\u9634\u5F71\u906E\u853D"],
    [/成功突围/gu, "\u6682\u65F6\u907F\u5F00\u7B2C\u4E00\u8F6E\u641C\u7D22\u4F46\u4ECD\u5728\u5C01\u9501\u5185"],
    [/突围失败/gu, "\u5C01\u9501\u5185\u8F6C\u79FB\u53D7\u963B"],
    [/突围/gu, "\u5C01\u9501\u5185\u77ED\u8DDD\u8F6C\u79FB"],
    [/逃亡过渡/gu, "\u5C01\u9501\u5185\u6F5C\u4F0F\u627F\u538B\u8FC7\u6E21"],
    [/逃亡状态/gu, "\u88AB\u8FEB\u8F6C\u5165\u5165\u53E3\u9644\u8FD1\u7684\u6F5C\u4F0F\u72B6\u6001"],
    [/逃亡/gu, "\u5C01\u9501\u5185\u6F5C\u4F0F"],
    [/沈青霜追至通道入口/gu, "\u6C88\u9752\u971C\u6536\u7D27\u5730\u5F62\u7F1D\u9699\u89C2\u5BDF\u70B9\u5916\u56F4\u5C01\u9501"],
    [/沈青霜被标记波动误导/gu, "\u6C88\u9752\u971C\u56E0\u589F\u5149\u82D4\u6B8B\u75D5\u4E0E\u5730\u5F62\u906E\u853D\u6682\u65F6\u65E0\u6CD5\u9501\u5B9A\u5177\u4F53\u843D\u70B9"],
    [/外围{2,}/gu, "\u5916\u56F4"],
    [/未能发现陆无良踪迹/gu, "\u9501\u5B9A\u8303\u56F4\u7F29\u5C0F\u5230\u5165\u53E3\u5916\u56F4\uFF0C\u4F46\u672A\u638C\u63E1\u9646\u65E0\u826F\u7684\u5177\u4F53\u843D\u70B9"],
    [/未能发现踪迹/gu, "\u9501\u5B9A\u8303\u56F4\u7F29\u5C0F\u5230\u5165\u53E3\u5916\u56F4\uFF0C\u4F46\u672A\u638C\u63E1\u5177\u4F53\u843D\u70B9"],
    [/向后备通道坐标附近的废墟阴影转移/gu, "\u6CBF\u4E0A\u4E00\u6279\u4EA4\u63A5\u7684\u5730\u5F62\u7F1D\u9699\u4E0E\u589F\u5149\u82D4\u6B8B\u75D5\u5F62\u6210\u7684\u77ED\u6682\u76D1\u63A7\u76F2\u533A\uFF0C\u5411\u5730\u5F62\u7F1D\u9699\u5750\u6807\u9644\u8FD1\u7684\u5E9F\u589F\u9634\u5F71\u77ED\u8DDD\u8F6C\u79FB\uFF0C\u4F46\u4ECD\u672A\u8131\u79BB\u5C01\u9501"],
    [/后备通道坐标附近/gu, "\u5730\u5F62\u7F1D\u9699\u5750\u6807\u9644\u8FD1"],
    [/确认后备通道坐标但尚未进入深处的封锁盲区边缘/gu, "\u786E\u8BA4\u5730\u5F62\u7F1D\u9699\u5750\u6807\u4F46\u4ECD\u505C\u7559\u5728\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185"],
    [/确认后备通道坐标但尚未进入/gu, "\u786E\u8BA4\u5730\u5F62\u7F1D\u9699\u5750\u6807\u4F46\u4ECD\u505C\u7559\u5728\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185"],
    [/封锁内贴地潜伏挪动第一层封锁/gu, "\u907F\u5F00\u7B2C\u4E00\u8F6E\u9501\u5B9A\u4F46\u4ECD\u7559\u5728\u5C01\u9501\u5185"],
    [/被困在入口外围/gu, "\u88AB\u56F0\u5728\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7"],
    [/暂时未能锁定陆无良具体位置，但仍确认其被困在入口外围/gu, "\u9501\u5B9A\u8303\u56F4\u7F29\u5C0F\u5230\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7\uFF0C\u4F46\u672A\u638C\u63E1\u9646\u65E0\u826F\u7684\u5177\u4F53\u843D\u70B9"],
    [/太虚枢机的更高强度扫描/gu, "\u6C88\u9752\u971C\u5C01\u9501\u9635\u5217\u8FDB\u4E00\u6B65\u6536\u7D27"],
    [/来自太虚枢机的更高强度扫描/gu, "\u6C88\u9752\u971C\u5C01\u9501\u9635\u5217\u8FDB\u4E00\u6B65\u6536\u7D27"],
    [/更高强度扫描/gu, "\u5C01\u9501\u9635\u5217\u8FDB\u4E00\u6B65\u6536\u7D27"],
    [/未知区域/gu, "\u5C01\u9501\u76F2\u533A\u8FB9\u7F18"],
    [/摆脱了追兵的视线/gu, "\u6682\u65F6\u6270\u4E71\u8FFD\u5175\u5BF9\u5177\u4F53\u843D\u70B9\u7684\u5224\u65AD\uFF0C\u4F46\u4ECD\u88AB\u786E\u8BA4\u56F0\u5728\u5C01\u9501\u5185"],
    [/前路未卜/gu, "\u4E0B\u4E00\u7AE0\u4ECD\u9700\u5728\u5165\u53E3\u5916\u56F4\u5C01\u9501\u4E2D\u627F\u538B"],
    [/向上一批标注的地形缝隙阴影移动/gu, "\u786E\u8BA4\u636E\u70B9\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\u4ECD\u53EF\u4F5C\u4E3A\u85CF\u8EAB\u70B9"],
    [/向据点外的地形缝隙阴影进行短距转移/gu, "\u786E\u8BA4\u636E\u70B9\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\u4ECD\u53EF\u4F5C\u4E3A\u85CF\u8EAB\u70B9\uFF0C\u4E0D\u80FD\u79BB\u5F00\u5C01\u9501"],
    [/向[^，。；]*地形缝隙阴影(?:进行)?短距转移/gu, "\u786E\u8BA4\u636E\u70B9\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\u4ECD\u53EF\u4F5C\u4E3A\u85CF\u8EAB\u70B9\uFF0C\u4E0D\u80FD\u79BB\u5F00\u5C01\u9501"],
    [/接近上一批标注的地形缝隙阴影/gu, "\u7EE7\u7EED\u56F0\u5728\u636E\u70B9\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9\u9644\u8FD1"],
    [/上一批标注的地形缝隙阴影/gu, "\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9"],
    [/地形缝隙阴影/gu, "\u636E\u70B9\u5E9F\u589F\u5C01\u9501\u5185\u4FA7\u5DF2\u6807\u6CE8\u9634\u5F71\u70B9"],
    [/短距转移/gu, "\u5C01\u9501\u5185\u85CF\u8EAB\u70B9\u4F4D\u786E\u8BA4"],
    [/避开灵虫的搜索/gu, "\u8BA9\u7075\u866B\u6682\u65F6\u65E0\u6CD5\u786E\u8BA4\u5177\u4F53\u843D\u70B9"],
    [/墟光苔残痕的干扰/gu, "\u589F\u5149\u82D4\u4E2D\u548C\u4F59\u6CE2\u9020\u6210\u7684\u611F\u77E5\u566A\u97F3\uFF08\u4E0D\u4F5C\u4E3A\u53EF\u91CD\u590D\u4F7F\u7528\u8D44\u6E90\uFF09"]
  ];
  const markerAndKnowledgeReplacements = [
    [/陆无良引爆(?:金色)?标记/gu, "\u9646\u65E0\u826F\u538B\u5236\u91CD\u65B0\u6D3B\u6027\u5316\u7684\u91D1\u8272\u6807\u8BB0"],
    [/引爆(?:金色)?标记/gu, "\u538B\u5236\u91CD\u65B0\u6D3B\u6027\u5316\u7684\u91D1\u8272\u6807\u8BB0"],
    [/主动引爆(?:金色)?标记/gu, "\u88AB\u52A8\u538B\u5236\u91CD\u65B0\u6D3B\u6027\u5316\u7684\u91D1\u8272\u6807\u8BB0"],
    [/金色标记已爆炸失效/gu, "\u91D1\u8272\u6807\u8BB0\u91CD\u65B0\u6D3B\u6027\u5316\u540E\u88AB\u6682\u65F6\u538B\u5236\u4F46\u672A\u5931\u6548"],
    [/标记已爆炸失效/gu, "\u6807\u8BB0\u91CD\u65B0\u6D3B\u6027\u5316\u540E\u88AB\u6682\u65F6\u538B\u5236\u4F46\u672A\u5931\u6548"],
    [/金色光芒与墟光苔的中和反应产生剧烈爆炸/gu, "\u91D1\u8272\u6807\u8BB0\u91CD\u65B0\u6D3B\u6027\u5316\u4E0E\u589F\u5149\u82D4\u76F8\u51B2\uFF0C\u4EA7\u751F\u5267\u70C8\u523A\u75DB\u548C\u5224\u65AD\u5E72\u6270"],
    [/金色标记被墟光苔中和，?剩余有效期\d+天/gu, "\u589F\u5149\u82D4\u5BF9\u6807\u8BB0\u6B8B\u6E23\u4EA7\u751F\u4E2D\u548C\u4F59\u6CE2\uFF0C\u4F46\u4E0D\u5F62\u6210\u72EC\u7ACB\u5012\u8BA1\u65F6"],
    [/金色标记有效期\d+天/gu, "\u589F\u5149\u82D4\u4E2D\u548C\u4F59\u6CE2\u4ECD\u5728\uFF0C\u4F46\u4E0D\u5F62\u6210\u72EC\u7ACB\u5012\u8BA1\u65F6"],
    [/金色标记剩余\d+天有效期/gu, "\u589F\u5149\u82D4\u4E2D\u548C\u4F59\u6CE2\u4ECD\u5728\uFF0C\u4F46\u4E0D\u5F62\u6210\u72EC\u7ACB\u5012\u8BA1\u65F6"],
    [/金色标记[^，。；]*有效期[^，。；]*/gu, "\u589F\u5149\u82D4\u4E2D\u548C\u4F59\u6CE2\u4ECD\u5728\uFF0C\u4F46\u4E0D\u5F62\u6210\u72EC\u7ACB\u5012\u8BA1\u65F6"],
    [/标记激活/gu, "\u6807\u8BB0\u6B8B\u4F59\u523A\u75DB\u52A0\u5267\u4F46\u672A\u6539\u53D8\u7CFB\u7EDF\u72B6\u6001"],
    [/标记重新激活/gu, "\u6807\u8BB0\u6B8B\u4F59\u523A\u75DB\u52A0\u5267\u4F46\u672A\u6539\u53D8\u7CFB\u7EDF\u72B6\u6001"],
    [/剧烈爆炸/gu, "\u5267\u70C8\u9707\u8361"],
    [/爆炸/gu, "\u9707\u8361"],
    [/标记不仅是负担，也是沈青霜阵法中的[‘']盲区[’']/gu, "\u6807\u8BB0\u53EA\u5E26\u6765\u523A\u75DB\u4E0E\u5224\u65AD\u5E72\u6270\uFF0C\u4E0D\u80FD\u88AB\u9646\u65E0\u826F\u7406\u89E3\u6216\u5229\u7528\u4E3A\u9635\u6CD5\u76F2\u533A"],
    [/决定利用这种干扰作为短暂监控盲区/gu, "\u51B3\u5B9A\u5FCD\u53D7\u523A\u75DB\u7EF4\u6301\u884C\u52A8\u987A\u5E8F\uFF0C\u5E76\u5229\u7528\u5730\u5F62\u7F1D\u9699\u5BFB\u627E\u77ED\u6682\u76D1\u63A7\u76F2\u533A"],
    [/将其作为干扰沈青霜感知的噪音/gu, "\u628A\u5B83\u89C6\u4E3A\u4F1A\u5E72\u6270\u81EA\u8EAB\u5224\u65AD\u7684\u566A\u97F3\uFF0C\u4E0D\u80FD\u4E3B\u52A8\u7528\u6765\u5E72\u6270\u6C88\u9752\u971C"],
    [/作为干扰沈青霜感知的噪音/gu, "\u4F5C\u4E3A\u5E72\u6270\u81EA\u8EAB\u5224\u65AD\u7684\u566A\u97F3"],
    [/利用标记的波动干扰/gu, "\u88AB\u6807\u8BB0\u6CE2\u52A8\u5E72\u6270\u65F6\u4ECD\u52C9\u5F3A\u7EF4\u6301\u884C\u52A8"],
    [/利用标记波动干扰/gu, "\u627F\u53D7\u6807\u8BB0\u6CE2\u52A8\u5E72\u6270\u65F6\u52C9\u5F3A\u7EF4\u6301\u884C\u52A8"],
    [/利用(?:金色|无面)?标记(?:波动|残渣|刺痛|低语|噪音|干扰)?[^，。；]*/gu, "\u627F\u53D7\u6807\u8BB0\u5E26\u6765\u7684\u523A\u75DB\u3001\u4F4E\u8BED\u548C\u5224\u65AD\u5E72\u6270"],
    [/利用这(?:股|种)?噪音[^，。；]*/gu, "\u5FCD\u53D7\u8FD9\u80A1\u566A\u97F3\u9020\u6210\u7684\u5224\u65AD\u5E72\u6270"],
    [/利用(?:它|其|这种干扰|这股干扰)[^，。；]*(?:掩盖|误导|干扰|遮蔽)[^，。；]*/gu, "\u5FCD\u53D7\u6807\u8BB0\u5E72\u6270\u5E76\u4F9D\u9760\u5730\u5F62\u906E\u853D\u7EF4\u6301\u884C\u52A8"],
    [/标记[^，。；]*(?:反馈|波动|刺痛)[^，。；]*(?:薄弱点|缝隙|移动|转移|方向|误导|掩盖|遮蔽)[^，。；]*/gu, "\u6807\u8BB0\u53EA\u9020\u6210\u523A\u75DB\u3001\u4F4E\u8BED\u548C\u8BEF\u5224\uFF0C\u9646\u65E0\u826F\u53EA\u80FD\u4F9D\u9760\u5730\u5F62\u7F1D\u9699\u4E0E\u589F\u5149\u82D4\u6B8B\u75D5\u5224\u65AD\u843D\u70B9"],
    [/承受标记带来的刺痛[^，。；]*(?:移动|转移|方向)[^，。；]*/gu, "\u5728\u6807\u8BB0\u523A\u75DB\u5E72\u6270\u4E0B\u9669\u4E9B\u8BEF\u5224\u65B9\u5411\uFF0C\u6700\u7EC8\u53EA\u80FD\u4F9D\u9760\u5730\u5F62\u7F1D\u9699\u4E0E\u589F\u5149\u82D4\u6B8B\u75D5\u7EF4\u6301\u884C\u52A8"],
    [/最佳容器/gu, "\u91CD\u8981\u76EE\u6807"],
    [/容器适配性/gu, "\u6C61\u67D3\u53CD\u5E94"],
    [/左臂黑线渗入心脏/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u8513\u5EF6\u81F3\u80A9\u90E8"],
    [/黑线渗入心脏/gu, "\u9ED1\u7EBF\u8513\u5EF6\u81F3\u80A9\u90E8"],
    [/左臂黑线从肘部直接蔓延至心脏/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u4ECE\u8098\u90E8\u52A0\u901F\u8513\u5EF6\u81F3\u80A9\u90E8"],
    [/左臂黑线蔓延至手腕/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u4ECE\u8098\u90E8\u8513\u5EF6\u81F3\u80A9\u90E8"],
    [/黑线蔓延至手腕/gu, "\u9ED1\u7EBF\u4ECE\u8098\u90E8\u8513\u5EF6\u81F3\u80A9\u90E8"],
    [/左臂黑线蔓延至肩部但得到遏制/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8\u5E76\u6301\u7EED\u523A\u75DB\uFF0C\u5C1A\u672A\u5411\u80A9\u90E8\u6269\u6563"],
    [/黑线蔓延至肩部但得到遏制/gu, "\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8\u5E76\u6301\u7EED\u523A\u75DB\uFF0C\u5C1A\u672A\u5411\u80A9\u90E8\u6269\u6563"],
    [/左臂黑线已至肩部/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8"],
    [/左臂黑线至肩部/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u81F3\u8098\u90E8"],
    [/左臂黑线已蔓延至肩部/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8"],
    [/黑线已蔓延至肩部/gu, "\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8"],
    [/左臂黑线因[^，。；]*蔓延至肘部上方/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8\u5E76\u6301\u7EED\u523A\u75DB\uFF0C\u5C1A\u672A\u53D1\u751F\u7CFB\u7EDF\u8BA4\u53EF\u7684\u65B0\u8513\u5EF6"],
    [/黑线[^，。；]*蔓延至肘部上方/gu, "\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8\u5E76\u6301\u7EED\u523A\u75DB\uFF0C\u5C1A\u672A\u53D1\u751F\u7CFB\u7EDF\u8BA4\u53EF\u7684\u65B0\u8513\u5EF6"],
    [/左臂黑线蔓延/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8\u5E76\u6301\u7EED\u9EBB\u6728"],
    [/黑线蔓延/gu, "\u9ED1\u7EBF\u7EF4\u6301\u81F3\u8098\u90E8\u5E76\u6301\u7EED\u9EBB\u6728"],
    [/蔓延至肘部上方/gu, "\u7EF4\u6301\u81F3\u8098\u90E8"],
    [/回忆起玄默的警告/gu, "\u60F3\u8D77\u7384\u9ED8\u66FE\u7ED9\u51FA\u7684\u6700\u4F4E\u9650\u5EA6\u63D0\u9192\uFF0C\u4F46\u4ECD\u5BF9\u5176\u4FDD\u6301\u6212\u5907"],
    [/沈青霜的投影[^。；]*选择撤退/gu, "\u6C88\u9752\u971C\u672C\u4F53\u77ED\u6682\u8FDF\u7591\u540E\u88AB\u94DC\u955C\u951A\u70B9\u906E\u853D\u60C5\u7EEA\uFF0C\u968F\u5373\u7EE7\u7EED\u6536\u7D27\u5C01\u9501"],
    [/灵州格式化的场景/gu, "\u7834\u788E\u96F7\u5149\u548C\u7A7A\u767D\u566A\u70B9"],
    [/灵州格式化记忆/gu, "\u7834\u788E\u96F7\u5149\u566A\u70B9"],
    [/破碎雷光和空白噪点/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u767D\u566A\u5149\u6591\u4E0E\u65AD\u7EED\u8033\u9E23"],
    [/破碎雷光噪点/gu, "\u767D\u566A\u5149\u6591"],
    [/灵州格式化时的痛苦记忆/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u767D\u566A\u68A6\u9B47"],
    [/灵州格式化时的数据流残影/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u767D\u566A\u5149\u6591"],
    [/灵州格式化前的片段/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u767D\u566A\u7247\u6BB5"],
    [/播放陆无良记忆中[^，。；]*片段/gu, "\u91CA\u653E\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u767D\u566A\u7247\u6BB5"],
    [/数据流残影/gu, "\u767D\u566A\u5149\u6591"],
    [/诱导沈青霜的天道之力击中通道壁的旧日道则封印痕迹，引发短暂的能量震荡/gu, "\u5229\u7528\u901A\u9053\u58C1\u767D\u566A\u6B8B\u75D5\u9020\u6210\u611F\u77E5\u9519\u4F4D\uFF0C\u4E89\u53D6\u77ED\u6682\u906E\u853D"],
    [/击中通道壁的旧日道则封印痕迹，引发短暂的能量震荡/gu, "\u88AB\u901A\u9053\u58C1\u767D\u566A\u6B8B\u75D5\u5E72\u6270\uFF0C\u4EA7\u751F\u77ED\u6682\u611F\u77E5\u9519\u4F4D"],
    [/旧日道则封印痕迹/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u767D\u566A\u6B8B\u75D5"],
    [/旧日道则[^，。；]*(?:能量震荡|物理互动|击中|封印痕迹)[^，。；]*/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u767D\u566A\u6B8B\u75D5\u53EA\u9020\u6210\u611F\u77E5\u5E72\u6270\uFF0C\u4E0D\u4F5C\u4E3A\u53EF\u4E92\u52A8\u9053\u5177"],
    [/沈青霜在阵法中心通过铜镜观察/gu, "\u6C88\u9752\u971C\u5728\u7B2C\u516B\u5C42\u901A\u8FC7\u94DC\u955C\u8FDC\u7A0B\u89C2\u5BDF"],
    [/沈青霜在阵法中心/gu, "\u6C88\u9752\u971C\u5728\u7B2C\u516B\u5C42\u8FDC\u7A0B\u951A\u5B9A\u9635\u6CD5"],
    [/通过‘水镜残片’观察沈青霜的阵法部署/gu, "\u900F\u8FC7\u636E\u70B9\u88C2\u7F1D\u89C2\u5BDF\u6C88\u9752\u971C\u9635\u5217\u5916\u5C42\u5149\u5F71\u53D8\u5316"],
    [/通过水镜残片观察沈青霜的阵法部署/gu, "\u900F\u8FC7\u636E\u70B9\u88C2\u7F1D\u89C2\u5BDF\u6C88\u9752\u971C\u9635\u5217\u5916\u5C42\u5149\u5F71\u53D8\u5316"],
    [/水镜残片/gu, "\u636E\u70B9\u88C2\u7F1D"],
    [/不再依赖玄默的指引，而是依靠自己的力量寻找破局之法/gu, "\u4E0D\u76F2\u4ECE\u7384\u9ED8\u7684\u6307\u5F15\uFF0C\u4F46\u4FDD\u7559\u6700\u4F4E\u9650\u5EA6\u4FE1\u4EFB\uFF0C\u5E76\u7528\u81EA\u8EAB\u5224\u65AD\u5BFB\u627E\u4E34\u65F6\u8131\u8EAB\u673A\u4F1A"],
    [/不再依赖玄默/gu, "\u4E0D\u76F2\u4ECE\u7384\u9ED8\u4F46\u4FDD\u7559\u6700\u4F4E\u9650\u5EA6\u4FE1\u4EFB"],
    [/重新评估与玄默的关系，并决定暂时搁置对玄默的怀疑/gu, "\u786E\u8BA4\u5BF9\u7384\u9ED8\u7684\u8F7B\u5EA6\u4E0D\u4FE1\u4EFB\u4ECD\u5728\uFF0C\u4F46\u6682\u65F6\u4E0D\u8BA9\u6000\u7591\u5E72\u6270\u773C\u524D\u5224\u65AD"],
    [/重新评估与玄默的关系/gu, "\u786E\u8BA4\u5BF9\u7384\u9ED8\u7684\u6000\u7591\u4ECD\u5728\u52A0\u6DF1"],
    [/决定暂时搁置对玄默的怀疑/gu, "\u786E\u8BA4\u5BF9\u7384\u9ED8\u7684\u8F7B\u5EA6\u4E0D\u4FE1\u4EFB\u4ECD\u5728\uFF0C\u4F46\u6682\u65F6\u4E0D\u8BA9\u6000\u7591\u5E72\u6270\u773C\u524D\u5224\u65AD"],
    [/暂时搁置对玄默的怀疑/gu, "\u4FDD\u7559\u5BF9\u7384\u9ED8\u7684\u8F7B\u5EA6\u4E0D\u4FE1\u4EFB"],
    [/重新压住对玄默的怀疑/gu, "\u786E\u8BA4\u5BF9\u7384\u9ED8\u7684\u6000\u7591\u4ECD\u5728\u52A0\u6DF1\uFF0C\u53EA\u80FD\u5F3A\u8FEB\u81EA\u5DF1\u5148\u5904\u7406\u773C\u524D\u8FFD\u6355"],
    [/暂时不让怀疑干扰眼前判断/gu, "\u6000\u7591\u4ECD\u5728\u5E72\u6270\u5224\u65AD\uFF0C\u53EA\u80FD\u7528\u638C\u5FC3\u75DB\u611F\u52C9\u5F3A\u7EF4\u6301\u884C\u52A8\u987A\u5E8F"],
    [/为第95章的梦境渗透做铺垫/gu, "\u4E3A\u540E\u7EED\u8BC6\u6D77\u538B\u529B\u7EE7\u7EED\u7D2F\u79EF\u94FA\u57AB"],
    [/第95章的梦境渗透/gu, "\u540E\u7EED\u8BC6\u6D77\u538B\u529B"],
    [/利用这种冲突作为警示，反向推导出无面试图引导的方向是假的/gu, "\u88AB\u8FD9\u80A1\u51B2\u7A81\u6270\u4E71\u5224\u65AD\uFF0C\u53EA\u80FD\u7528\u638C\u5FC3\u75DB\u611F\u52C9\u5F3A\u7EF4\u6301\u884C\u52A8\u987A\u5E8F\uFF0C\u4E0D\u80FD\u53CD\u5411\u63A8\u5BFC\u65E0\u9762\u610F\u56FE"],
    [/反向推导出无面试图引导的方向是假的/gu, "\u610F\u8BC6\u5230\u4F4E\u8BED\u6B63\u5728\u6270\u4E71\u5224\u65AD\uFF0C\u4F46\u4E0D\u80FD\u53CD\u5411\u63A8\u5BFC\u65E0\u9762\u610F\u56FE"],
    [/反向推导无面(?:的)?意图/gu, "\u53EA\u80FD\u611F\u5230\u65E0\u9762\u4F4E\u8BED\u9020\u6210\u5224\u65AD\u5E72\u6270"],
    [/无面渗透度提升/gu, "\u65E0\u9762\u4F4E\u8BED\u538B\u529B\u7EE7\u7EED\u7D2F\u79EF\u4F46\u672A\u8FDB\u5165\u68A6\u5883\u6E17\u900F"],
    [/关于[‘']容器[’']价值的疑问/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u81EA\u6211\u5426\u5B9A\u566A\u97F3"],
    [/关于“容器”价值的疑问/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u81EA\u6211\u5426\u5B9A\u566A\u97F3"],
    [/容器价值/gu, "\u81EA\u6211\u5426\u5B9A\u566A\u97F3"],
    [/关于(?:‘|“)?容器(?:’|”)?[^，。；]*/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u81EA\u6211\u5426\u5B9A\u566A\u97F3"],
    [/梦境渗透/gu, "\u8BC6\u6D77\u4F4E\u8BED\u5E72\u6270"],
    [/无面金色瞳孔的幻影/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u91D1\u8272\u566A\u70B9"],
    [/无面的金色瞳孔幻影/gu, "\u65E0\u6CD5\u8FA8\u8BA4\u6765\u6E90\u7684\u91D1\u8272\u566A\u70B9"],
    [/金色瞳孔幻影/gu, "\u91D1\u8272\u566A\u70B9"],
    [/金色瞳孔/gu, "\u91D1\u8272\u566A\u70B9"],
    [/玄默是导致这一切的旁观者/gu, "\u7384\u9ED8\u53EF\u80FD\u9690\u7792\u4E86\u90E8\u5206\u4FE1\u606F"],
    [/对玄默的信任降至冰点/gu, "\u5BF9\u7384\u9ED8\u7684\u8F7B\u5EA6\u4E0D\u4FE1\u4EFB\u7EE7\u7EED\u5B58\u5728\uFF0C\u4F46\u5C1A\u672A\u5F7B\u5E95\u65AD\u88C2"],
    [/信任降至冰点/gu, "\u8F7B\u5EA6\u4E0D\u4FE1\u4EFB\u7EE7\u7EED\u5B58\u5728\u4F46\u5C1A\u672A\u5F7B\u5E95\u65AD\u88C2"],
    [/信任度再次下降/gu, "\u8F7B\u5EA6\u4E0D\u4FE1\u4EFB\u7EE7\u7EED\u5B58\u5728"],
    [/深深的裂痕/gu, "\u4E00\u4E1D\u53EF\u63A7\u7591\u95EE"],
    [/识海中多了一道[^，。；]*裂痕/gu, "\u8BC6\u6D77\u4E2D\u53EA\u7559\u4E0B\u4E86\u4E00\u4E1D\u53EF\u63A7\u7591\u95EE"],
    [/无面确认其意志未被摧毁/gu, "\u65E0\u9762\u4F4E\u8BED\u6682\u65F6\u9000\u6F6E\uFF0C\u672A\u786E\u8BA4\u5BB9\u5668\u8EAB\u4EFD"],
    [/无面确认[^，。；]*最佳容器/gu, "\u65E0\u9762\u4F4E\u8BED\u6682\u65F6\u9000\u6F6E\uFF0C\u672A\u786E\u8BA4\u5BB9\u5668\u8EAB\u4EFD"],
    [/无面在识海中嘲笑他的无能，试图让他放弃思考/gu, "\u65E0\u9762\u6B8B\u7559\u4F4E\u8BED\u8BF1\u53D1\u4E00\u77AC\u81EA\u6211\u5426\u5B9A\uFF0C\u4F46\u672A\u5F62\u6210\u76F4\u63A5\u8BC6\u6D77\u5BF9\u6297"],
    [/嘲笑他的无能/gu, "\u8BF1\u53D1\u4E00\u77AC\u81EA\u6211\u5426\u5B9A"],
    [/试图让他放弃思考/gu, "\u6270\u4E71\u4ED6\u7684\u5224\u65AD\u987A\u5E8F"],
    [/识海低语破裂/gu, "\u4F4E\u8BED\u6682\u65F6\u9000\u6F6E"],
    [/低语破裂/gu, "\u4F4E\u8BED\u6682\u65F6\u9000\u6F6E"],
    [/古老气息安抚躁动的灵力/gu, "\u51B0\u51B7\u6C14\u5473\u8BA9\u4ED6\u77ED\u6682\u5206\u795E\uFF0C\u4E0D\u80FD\u5B89\u629A\u6216\u5229\u7528\u4EFB\u4F55\u529B\u91CF"],
    [/安抚躁动的灵力/gu, "\u8BEF\u5224\u81EA\u8EAB\u6C14\u606F"],
    [/梦境中重现/gu, "\u8BC6\u6D77\u4F4E\u8BED\u4E2D\u95EA\u8FC7"],
    [/在梦境中/gu, "\u5728\u8BC6\u6D77\u4F4E\u8BED\u4E2D"],
    [/梦境/gu, "\u8BC6\u6D77\u4F4E\u8BED"],
    [/发芽/gu, "\u52A0\u6DF1\u4F46\u5C1A\u672A\u5931\u63A7"],
    [/强行撕开梦境的一角/gu, "\u6323\u624E\u7740\u4ECE\u68A6\u5883\u6C61\u67D3\u4E2D\u9192\u6765"],
    [/撕开梦境的一角/gu, "\u4ECE\u68A6\u5883\u6C61\u67D3\u4E2D\u9192\u6765"],
    [/寻找摆脱无面标记的方法/gu, "\u5BFB\u627E\u4E34\u65F6\u538B\u5236\u65E0\u9762\u6807\u8BB0\u5E72\u6270\u7684\u65B9\u6CD5"],
    [/摆脱无面标记/gu, "\u4E34\u65F6\u538B\u5236\u65E0\u9762\u6807\u8BB0\u5E72\u6270"],
    [/牺牲古钥匙的部分完整性/gu, "\u53E4\u94A5\u5319\u523A\u75DB\u52A0\u5267\u4F46\u5B8C\u6574\u6027\u4E0D\u7ED3\u7B97\u4E0B\u964D"],
    [/牺牲古钥匙完整性/gu, "\u53E4\u94A5\u5319\u523A\u75DB\u52A0\u5267\u4F46\u5B8C\u6574\u6027\u4E0D\u7ED3\u7B97\u4E0B\u964D"],
    [/代价是古钥匙完整性保持60%/gu, "\u7ED3\u679C\u662F\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF0C\u672A\u652F\u4ED8\u5B8C\u6574\u6027\u4E0B\u964D\u4EE3\u4EF7"],
    [/古钥匙裂纹因承受阵法反震而加深至第四道，完整性降至55%/gu, "\u53E4\u94A5\u5319\u53D7\u9635\u6CD5\u4F59\u6CE2\u523A\u6FC0\uFF0C\u4F46\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
    [/古钥匙裂纹因被动承受阵法余波而加深至第四道，完整性降至55%/gu, "\u53E4\u94A5\u5319\u53D7\u9635\u6CD5\u4F59\u6CE2\u523A\u6FC0\uFF0C\u4F46\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
    [/古钥匙承受阵法余波后出现第四道浅裂，完整性降至55%/gu, "\u53E4\u94A5\u5319\u53D7\u9635\u6CD5\u4F59\u6CE2\u523A\u6FC0\uFF0C\u4F46\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
    [/古钥匙承受阵法反震后出现第四道浅裂，完整性降至55%/gu, "\u53E4\u94A5\u5319\u53D7\u9635\u6CD5\u4F59\u6CE2\u523A\u6FC0\uFF0C\u4F46\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
    [/古钥匙完整性降至55%（四道裂纹）/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
    [/古钥匙完整性降至55%（四道浅裂）/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
    [/古钥匙55%完整性/gu, "\u53E4\u94A5\u531960%\u5B8C\u6574\u6027\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
    [/古钥匙浅裂风险浮现（完整性55%）/gu, "\u53E4\u94A5\u5319\u523A\u75DB\u52A0\u5267\u4F46\u5B8C\u6574\u6027\u4FDD\u630160%"],
    [/完整性55%/gu, "\u5B8C\u6574\u602760%"],
    [/完整性降至55%/gu, "\u5B8C\u6574\u6027\u4FDD\u630160%"],
    [/古钥匙完整性降至50%（五道裂纹）/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u964D\u81F355%\uFF08\u56DB\u9053\u6D45\u88C2\uFF09"],
    [/古钥匙50%完整性/gu, "\u53E4\u94A5\u5319\u4ECE60%\u5B8C\u6574\u6027\u964D\u81F355%\u7684\u5355\u6B21\u4EE3\u4EF7"],
    [/掐刻掌心印记（第999道）/gu, "\u6390\u6309\u638C\u5FC3\u4E5D\u767E\u4E5D\u5341\u4E5D\u9053\u65E7\u75D5\u4E4B\u4E00"],
    [/掐刻掌心印记（第1000道）/gu, "\u6390\u6309\u638C\u5FC3\u4E5D\u767E\u4E5D\u5341\u4E5D\u9053\u65E7\u75D5\u4E4B\u4E00"],
    [/刻下第999道印记/gu, "\u6390\u6309\u638C\u5FC3\u4E5D\u767E\u4E5D\u5341\u4E5D\u9053\u65E7\u75D5\u4E4B\u4E00"],
    [/刻下第1000道印记/gu, "\u6390\u6309\u638C\u5FC3\u4E5D\u767E\u4E5D\u5341\u4E5D\u9053\u65E7\u75D5\u4E4B\u4E00"],
    [/第999道/gu, "\u4E5D\u767E\u4E5D\u5341\u4E5D\u9053\u65E7\u75D5\u4E4B\u4E00"],
    [/第1000道/gu, "\u4E5D\u767E\u4E5D\u5341\u4E5D\u9053\u65E7\u75D5\u4E4B\u4E00"],
    [/第九百九十九道/gu, "\u4E5D\u767E\u4E5D\u5341\u4E5D\u9053\u65E7\u75D5\u4E4B\u4E00"],
    [/第一千道/gu, "\u4E5D\u767E\u4E5D\u5341\u4E5D\u9053\u65E7\u75D5\u4E4B\u4E00"],
    [/裂纹加深至第五道/gu, "\u523A\u75DB\u52A0\u5267\u4F46\u88C2\u7EB9\u6570\u91CF\u4E0D\u53D8"],
    [/裂纹加深/gu, "\u523A\u75DB\u52A0\u5267\u4F46\u88C2\u7EB9\u6570\u91CF\u4E0D\u53D8"],
    [/保留与其联系的渠道/gu, "\u4E0D\u4E3B\u52A8\u8054\u7CFB\u7384\u9ED8\uFF0C\u4EC5\u4FDD\u7559\u5C06\u6765\u6838\u9A8C\u5176\u8BF4\u6CD5\u7684\u5FC3\u7406\u8D26\u672C"],
    [/（五道裂纹）（五道裂纹）/gu, "\uFF08\u4E94\u9053\u88C2\u7EB9\uFF09"]
  ];
  const globalTextReplacements = [...movementReplacements, ...markerAndKnowledgeReplacements];
  const chapterTextFields = [
    "previousChapterInput",
    "chapterPurpose",
    "sceneObjective",
    "protagonistDecision",
    "irreversibleChange",
    "endingHook",
    "nextChapterEntryState",
    "nextChapterHandoff"
  ];
  const chapterContractFields = [
    "previousChapterInput",
    "chapterPurpose",
    "sceneObjective",
    "protagonistDecision",
    "irreversibleChange",
    "endingHook",
    "nextChapterHandoff"
  ];
  const sceneTextFields = ["goal", "conflict", "turn", "endHook"];
  const canonicalCharacterName = (name) => {
    const trimmed = name.trim();
    if (characterSet.has(trimmed)) return trimmed;
    const withoutAnnotation = trimmed.replace(/（[^）]*）/gu, "").replace(/\([^)]*\)/gu, "").trim();
    if (characterSet.has(withoutAnnotation)) return withoutAnnotation;
    if (withoutAnnotation === "\u65E0\u9762" && characterSet.has("\u589F\u8BED\u8005\xB7\u65E0\u9762")) return "\u589F\u8BED\u8005\xB7\u65E0\u9762";
    const containsCanonical = [...characterSet].find((candidate) => withoutAnnotation.includes(candidate));
    if (containsCanonical) return containsCanonical;
    return trimmed;
  };
  const canonicalArray = (value, label) => {
    const before = values(value);
    const after = before.map(canonicalCharacterName);
    before.forEach((name, index) => {
      if (name !== after[index]) changes.push(`${label}: ${name} -> ${after[index]}`);
    });
    return Array.from(new Set(after));
  };
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source : null;
  if (source && String(source.phase || "").trim() !== "phase_8_volume_strategy") {
    changes.push(`source.phase: ${String(source.phase || "") || "(empty)"} -> phase_8_volume_strategy`);
    source.phase = "phase_8_volume_strategy";
  }
  replaceDeepText(result, globalTextReplacements, "chapterBlueprintResult");
  blueprints.forEach((blueprint, index) => {
    const chapterNumber = Number(blueprint.chapterNumber);
    const label = Number.isInteger(chapterNumber) ? `\u7B2C${chapterNumber}\u7AE0` : `blueprints[${index}]`;
    const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards : [];
    const previousBlueprintText = index > 0 ? JSON.stringify(blueprints[index - 1] || {}) : "";
    const ledgerReplacements = [];
    if (/古钥匙[^，。；]*四道/u.test(previousBlueprintText)) {
      ledgerReplacements.push(
        [/古钥匙裂纹增至四道/gu, "\u53E4\u94A5\u5319\u88C2\u7EB9\u4ECE\u56DB\u9053\u589E\u81F3\u4E94\u9053"],
        [/裂纹增至四道/gu, "\u88C2\u7EB9\u4ECE\u56DB\u9053\u589E\u81F3\u4E94\u9053"],
        [/完整性50%（四道裂纹/gu, "\u5B8C\u6574\u602750%\uFF08\u4E94\u9053\u88C2\u7EB9"],
        [/50%（四道裂纹/gu, "50%\uFF08\u4E94\u9053\u88C2\u7EB9"],
        [/（五道裂纹）（五道裂纹）/gu, "\uFF08\u4E94\u9053\u88C2\u7EB9\uFF09"],
        [/古钥匙剩余60%完整性（裂纹加深）/gu, "\u53E4\u94A5\u5319\u5269\u4F5960%\u5B8C\u6574\u6027\uFF08\u56DB\u9053\u88C2\u7EB9\uFF09"]
      );
    }
    if (/左臂黑线蔓延至肩部/u.test(previousBlueprintText)) {
      ledgerReplacements.push(
        [/左臂黑线蔓延至肩部，无面对其身体/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u4ECE\u80A9\u90E8\u903C\u8FD1\u80F8\u819B\uFF0C\u65E0\u9762\u5BF9\u5176\u8EAB\u4F53"],
        [/左臂黑线至肘部（蔓延至肩部）/gu, "\u5DE6\u81C2\u9ED1\u7EBF\u5DF2\u8513\u5EF6\u81F3\u80A9\u90E8"]
      );
    }
    if (!isArcExitChapter(chapterNumber)) {
      ledgerReplacements.push(
        [/消耗三个月庇护期等效能量/gu, "\u672A\u89E6\u53D1\u5C0F\u578B\u589F\u52AB\uFF0C\u5E87\u62A4\u671F\u4E0D\u53D1\u751F\u5F27\u7EA7\u6263\u51CF"],
        [/三个月庇护期等效能量/gu, "\u672A\u6388\u6743\u4EE3\u4EF7"],
        [/庇护期剩余2年3个月6天/gu, "\u5E87\u62A4\u671F\u5269\u4F592\u5E746\u4E2A\u67086\u5929"],
        [/庇护期[^，。；]*2年3个月6天/gu, "\u5E87\u62A4\u671F\u5269\u4F592\u5E746\u4E2A\u67086\u5929"]
      );
    }
    const textReplacements = [...movementReplacements, ...markerAndKnowledgeReplacements, ...ledgerReplacements];
    for (const key of chapterTextFields) blueprint[key] = replaceText(blueprint[key], textReplacements, `${label}.${key}: deterministic text repair`);
    for (const key of chapterContractFields) blueprint[key] = enforceContractText(blueprint[key], `${label}.${key}`, `${label}\u627F\u63A5\u4E0A\u4E00\u8282\u70B9\u5E76\u4EA7\u751F\u4E0B\u4E00\u8282\u70B9\u538B\u529B`);
    blueprint.mustAvoid = enforceContractArray(replaceArrayText(blueprint.mustAvoid, textReplacements, `${label}.mustAvoid`), `${label}.mustAvoid`);
    const allowedNewCharacters = canonicalArray(blueprint.allowedNewCharacters, `${label}.allowedNewCharacters`);
    const allowed = canonicalArray(blueprint.allowedCharacters, `${label}.allowedCharacters`);
    sceneCards.forEach((card, cardIndex) => {
      for (const key of sceneTextFields) card[key] = replaceText(card[key], textReplacements, `${label}.sceneCards[${cardIndex}].${key}: deterministic text repair`);
      for (const key of sceneTextFields) card[key] = enforceContractText(card[key], `${label}.sceneCards[${cardIndex}].${key}`, `${label}\u7B2C${cardIndex + 1}\u573A\u4FDD\u7559\u5267\u60C5\u52A8\u4F5C\u5E76\u4EA4\u63A5\u538B\u529B`);
      card.requiredFacts = enforceContractArray(replaceArrayText(card.requiredFacts, textReplacements, `${label}.sceneCards[${cardIndex}].requiredFacts`), `${label}.sceneCards[${cardIndex}].requiredFacts`);
      card.forbiddenFacts = dedupeStringArray(replaceArrayText(card.forbiddenFacts, textReplacements, `${label}.sceneCards[${cardIndex}].forbiddenFacts`));
      card.requiredCharacters = canonicalArray(card.requiredCharacters, `${label}.sceneCards[${cardIndex}].requiredCharacters`);
      const goal = String(card.goal || "").trim();
      if (goal && goal.length < 18) {
        const conflict = String(card.conflict || "").trim();
        card.goal = `${goal}\uFF1B\u672C\u573A\u5FC5\u987B\u5199\u6E05\u9646\u65E0\u826F\u7684\u53EF\u89C1\u52A8\u4F5C\u3001\u627F\u53D7\u7684\u5373\u65F6\u538B\u529B\uFF0C\u4EE5\u53CA\u8BE5\u52A8\u4F5C\u5982\u4F55\u628A\u65B0\u98CE\u9669\u4EA4\u7ED9\u4E0B\u4E00\u573A\u3002${conflict ? `\u5F53\u524D\u963B\u529B\uFF1A${conflict}` : ""}`.trim();
        changes.push(`${label}.sceneCards[${cardIndex}].goal: expanded short executable goal`);
      }
      if (values(card.requiredCharacters).includes("\u589F\u8BED\u8005\xB7\u65E0\u9762")) {
        const keptRequired = values(card.requiredCharacters).filter((name) => name !== "\u589F\u8BED\u8005\xB7\u65E0\u9762");
        card.requiredCharacters = keptRequired.length ? keptRequired : ["\u9646\u65E0\u826F"];
        changes.push(`${label}.sceneCards[${cardIndex}].requiredCharacters -= \u589F\u8BED\u8005\xB7\u65E0\u9762\uFF08\u672C\u6279\u53EA\u5141\u8BB8\u6807\u8BB0/\u4F4E\u8BED\u5E72\u6270\uFF0C\u4E0D\u4F5C\u4E3A\u573A\u666F\u767B\u573A\u4EBA\u7269\uFF09`);
      }
    });
    if (chapterNumber === 91 || chapterNumber === 92) {
      const earlyArc02LedgerReplacements = [
        [/古钥匙[^。；]*完整性降至55%[^。；]*/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
        [/古钥匙[^。；]*第四道浅裂定型[^。；]*/gu, "\u53E4\u94A5\u5319\u7B2C\u56DB\u9053\u6D45\u88C2\u4ECD\u53EA\u662F\u98CE\u9669\uFF0C\u5C1A\u672A\u5B9A\u578B"],
        [/古钥匙[^。；]*四道浅裂[^。；]*/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
        [/古钥匙[^。；]*四道裂纹[^。；]*/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
        [/古钥匙[^。；]*55%完整性[^。；]*/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
        [/古钥匙[^。；]*完整性55%[^。；]*/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
        [/古钥匙[^。；]*完整性降至50%[^。；]*/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
        [/古钥匙[^。；]*50%完整性[^。；]*/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u4FDD\u630160%\uFF08\u4E09\u9053\u88C2\u7EB9\uFF09"],
        [/庇护期剩余2年6个月[0-5]天/gu, "\u5E87\u62A4\u671F\u5269\u4F592\u5E746\u4E2A\u67086\u5929"],
        [/庇护期剩余2年3个月6天/gu, "\u5E87\u62A4\u671F\u5269\u4F592\u5E746\u4E2A\u67086\u5929"],
        [/金色标记剩余[0-3]天有效期/gu, "\u589F\u5149\u82D4\u4E2D\u548C\u4F59\u6CE2\u4ECD\u5728\uFF0C\u4F46\u4E0D\u5F62\u6210\u72EC\u7ACB\u5012\u8BA1\u65F6"]
      ];
      for (const key of chapterTextFields) blueprint[key] = replaceText(blueprint[key], earlyArc02LedgerReplacements, `${label}.${key}: early arc_02 ancient-key ledger repair`);
      blueprint.mustAvoid = replaceArrayText(blueprint.mustAvoid, earlyArc02LedgerReplacements, `${label}.mustAvoid`);
      sceneCards.forEach((card, cardIndex) => {
        for (const key of sceneTextFields) card[key] = replaceText(card[key], earlyArc02LedgerReplacements, `${label}.sceneCards[${cardIndex}].${key}: early arc_02 ancient-key ledger repair`);
        card.requiredFacts = replaceArrayText(card.requiredFacts, earlyArc02LedgerReplacements, `${label}.sceneCards[${cardIndex}].requiredFacts`);
        card.forbiddenFacts = replaceArrayText(card.forbiddenFacts, earlyArc02LedgerReplacements, `${label}.sceneCards[${cardIndex}].forbiddenFacts`);
      });
    }
    const hasNoFaceAsActiveCharacter = allowed.includes("\u589F\u8BED\u8005\xB7\u65E0\u9762");
    if (hasNoFaceAsActiveCharacter) {
      const keptAllowed = allowed.filter((name) => name !== "\u589F\u8BED\u8005\xB7\u65E0\u9762");
      allowed.length = 0;
      allowed.push(...keptAllowed);
      changes.push(`${label}.allowedCharacters -= \u589F\u8BED\u8005\xB7\u65E0\u9762\uFF08\u672C\u6279\u53EA\u5141\u8BB8\u6807\u8BB0/\u4F4E\u8BED\u5E72\u6270\uFF0C\u4E0D\u4F5C\u4E3A\u573A\u666F\u767B\u573A\u4EBA\u7269\uFF09`);
    }
    const required = sceneCards.flatMap((card) => values(card.requiredCharacters));
    for (const name of required) {
      if (!characterSet.has(name) || allowed.includes(name) || allowedNewCharacters.includes(name)) continue;
      allowed.push(name);
      changes.push(`${label}.allowedCharacters += ${name}`);
    }
    const allowedSet = new Set(allowed);
    const forbiddenBefore = canonicalArray(blueprint.forbiddenCharacters, `${label}.forbiddenCharacters`);
    const forbiddenKnown = forbiddenBefore.filter((name) => characterSet.has(name));
    for (const name of forbiddenBefore) {
      if (!characterSet.has(name)) changes.push(`${label}.forbiddenCharacters -= ${name}\uFF08\u975E\u51BB\u7ED3\u4EBA\u7269/\u7CFB\u7EDF\u538B\u529B\uFF09`);
    }
    const forbidden = forbiddenKnown.filter((name) => !allowedSet.has(name) && name !== "\u589F\u8BED\u8005\xB7\u65E0\u9762");
    for (const name of forbiddenBefore) {
      if (allowedSet.has(name)) changes.push(`${label}.forbiddenCharacters -= ${name}`);
      if (name === "\u589F\u8BED\u8005\xB7\u65E0\u9762") changes.push(`${label}.forbiddenCharacters -= \u589F\u8BED\u8005\xB7\u65E0\u9762\uFF08\u672C\u6279\u4F5C\u4E3A\u6807\u8BB0/\u4F4E\u8BED\u538B\u529B\u8BB0\u5F55\uFF0C\u4E0D\u4F5C\u4E3A\u4EBA\u7269\u767B\u573A\u8FB9\u754C\u5224\u65AD\uFF09`);
    }
    if (!forbidden.length) {
      const fallbackForbidden = [...characterSet].filter((name) => !allowedSet.has(name) && !allowedNewCharacters.includes(name));
      if (fallbackForbidden.length) {
        forbidden.push(...fallbackForbidden);
        changes.push(`${label}.forbiddenCharacters \u4F7F\u7528\u672A\u767B\u573A\u51BB\u7ED3\u4EBA\u7269\u8865\u9F50\uFF0C\u907F\u514D\u7CFB\u7EDF/\u52BF\u529B\u8BEF\u586B\u4EBA\u7269\u5B57\u6BB5\u3002`);
      }
    }
    blueprint.allowedCharacters = Array.from(new Set(allowed));
    blueprint.allowedNewCharacters = allowedNewCharacters;
    blueprint.forbiddenCharacters = Array.from(new Set(forbidden));
  });
  applyCanonicalStateLedger();
  const chapterNumbers = Array.from({ length: input.endChapter - input.startChapter + 1 }, (_, index) => input.startChapter + index);
  const completeBlueprints = blueprints.length === chapterNumbers.length && blueprints.every((blueprint, index) => Number(blueprint.chapterNumber) === chapterNumbers[index]);
  const expectedBatchContinuity = completeBlueprints ? blueprints.slice(0, -1).map((blueprint, index) => {
    const nextBlueprint = blueprints[index + 1] || {};
    const fromChapter = Number(blueprint.chapterNumber);
    const toChapter = Number(nextBlueprint.chapterNumber);
    return {
      fromChapter,
      toChapter,
      requiredCarryover: [
        String(blueprint.nextChapterHandoff || blueprint.nextChapterEntryState || `${fromChapter}\u7AE0\u7ED3\u5C3E\u72B6\u6001\u5FC5\u987B\u627F\u63A5\u5230${toChapter}\u7AE0\u5F00\u573A\u3002`).trim()
      ],
      forbiddenReset: [
        String(nextBlueprint.previousChapterInput || `${toChapter}\u7AE0\u4E0D\u5F97\u91CD\u7F6E${fromChapter}\u7AE0\u7684\u4E0D\u53EF\u9006\u53D8\u5316\u3002`).trim()
      ]
    };
  }) : [];
  const actualBatchContinuity = Array.isArray(result.batchContinuity) ? result.batchContinuity : [];
  actualBatchContinuity.forEach((entry, continuityIndex) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      changes.push(`batchContinuity[${continuityIndex}]: invalid entry replaced by synthesized continuity`);
      return;
    }
    const record = entry;
    record.requiredCarryover = replaceArrayText(record.requiredCarryover, [...movementReplacements, ...markerAndKnowledgeReplacements], `batchContinuity[${continuityIndex}].requiredCarryover`);
    record.forbiddenReset = replaceArrayText(record.forbiddenReset, [...movementReplacements, ...markerAndKnowledgeReplacements], `batchContinuity[${continuityIndex}].forbiddenReset`);
  });
  const batchContinuityShapeMatches = expectedBatchContinuity.length === actualBatchContinuity.length && expectedBatchContinuity.every((expected, index) => {
    const actual = actualBatchContinuity[index];
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
    const actualRecord = actual;
    return Number(actualRecord.fromChapter) === expected.fromChapter && Number(actualRecord.toChapter) === expected.toChapter;
  });
  if (completeBlueprints && (!Array.isArray(result.batchContinuity) || !batchContinuityShapeMatches)) {
    result.batchContinuity = expectedBatchContinuity;
    changes.push("batchContinuity: synthesized from adjacent chapter handoffs");
  }
  if (completeBlueprints && (!result.handoffToWritingPlan || typeof result.handoffToWritingPlan !== "object" || Array.isArray(result.handoffToWritingPlan))) {
    const finalBlueprint = blueprints[blueprints.length - 1] || {};
    result.handoffToWritingPlan = {
      chapterNumbers,
      fileNamingRule: `volume_${input.volumeId}_chapter_{chapterNumber}.md`,
      executionOrder: chapterNumbers,
      batchExitState: String(finalBlueprint.nextChapterEntryState || finalBlueprint.nextChapterHandoff || `${input.endChapter}\u7AE0\u7ED3\u675F\u72B6\u6001\u5F85\u5199\u4F5C\u8282\u70B9\u627F\u63A5\u3002`).trim(),
      unresolvedRisks: ["\u7531\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u7EE7\u7EED\u786E\u8BA4\u5267\u60C5\u3001\u65F6\u95F4\u3001\u4EBA\u7269\u8FB9\u754C\u3002"]
    };
    changes.push("handoffToWritingPlan: synthesized from completed chapter batch");
  }
  const handoff = result.handoffToWritingPlan && typeof result.handoffToWritingPlan === "object" && !Array.isArray(result.handoffToWritingPlan) ? result.handoffToWritingPlan : null;
  if (handoff) {
    const finalBlueprintText = JSON.stringify(blueprints[blueprints.length - 1] || {});
    const finalBlueprint = blueprints[blueprints.length - 1] || {};
    const handoffReplacements = [...movementReplacements, ...markerAndKnowledgeReplacements];
    if (/五道裂纹|裂纹从四道增至五道/u.test(finalBlueprintText)) {
      handoffReplacements.push(
        [/完整性50%（四道裂纹/gu, "\u5B8C\u6574\u602750%\uFF08\u4E94\u9053\u88C2\u7EB9"],
        [/古钥匙完整性降至50%/gu, "\u53E4\u94A5\u5319\u5B8C\u6574\u6027\u964D\u81F350%\uFF08\u4E94\u9053\u88C2\u7EB9\uFF09"]
      );
    }
    for (const key of ["fileNamingRule", "batchExitState"]) handoff[key] = replaceText(handoff[key], handoffReplacements, `handoffToWritingPlan.${key}: deterministic text repair`);
    handoff.unresolvedRisks = replaceArrayText(handoff.unresolvedRisks, handoffReplacements, "handoffToWritingPlan.unresolvedRisks");
    const expectedBatchExitState = String(finalBlueprint.nextChapterEntryState || finalBlueprint.nextChapterHandoff || "").trim();
    if (completeBlueprints && expectedBatchExitState && String(handoff.batchExitState || "").trim() !== expectedBatchExitState) {
      changes.push("handoffToWritingPlan.batchExitState: synced from final chapter nextChapterEntryState");
      handoff.batchExitState = expectedBatchExitState;
    }
  }
  if (completeBlueprints && (!result.qualitySelfCheck || typeof result.qualitySelfCheck !== "object" || Array.isArray(result.qualitySelfCheck))) {
    result.qualitySelfCheck = {
      allRequestedChaptersCovered: true,
      continuousCausalChain: true,
      allCharactersWithinCanon: true,
      allSceneCardsExecutable: true,
      noProseGenerated: true,
      remainingRisks: ["\u7531\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u7EE7\u7EED\u786E\u8BA4\uFF0C\u4E0D\u4EE5\u81EA\u68C0\u5B57\u6BB5\u653E\u884C\u3002"]
    };
    changes.push("qualitySelfCheck: synthesized for structural validation");
  }
  for (const [index, blueprint] of blueprints.entries()) {
    const chapterNumber = Number(blueprint.chapterNumber);
    const label = Number.isInteger(chapterNumber) ? `\u7B2C${chapterNumber}\u7AE0` : `blueprints[${index}]`;
    for (const key of chapterTextFields) {
      const compacted = compactContractText(blueprint[key]);
      if (compacted !== blueprint[key]) changes.push(`${label}.${key}: final compact`);
      blueprint[key] = compacted;
    }
    blueprint.mustAvoid = dedupeStringArray(blueprint.mustAvoid);
    const sceneCards = Array.isArray(blueprint.sceneCards) ? blueprint.sceneCards : [];
    sceneCards.forEach((card, cardIndex) => {
      for (const key of sceneTextFields) {
        const compacted = compactContractText(card[key]);
        if (compacted !== card[key]) changes.push(`${label}.sceneCards[${cardIndex}].${key}: final compact`);
        card[key] = compacted;
      }
      card.requiredFacts = dedupeStringArray(card.requiredFacts);
      card.forbiddenFacts = dedupeStringArray(card.forbiddenFacts);
    });
  }
  const finalContinuity = Array.isArray(result.batchContinuity) ? result.batchContinuity : [];
  finalContinuity.forEach((entry) => {
    entry.requiredCarryover = dedupeStringArray(entry.requiredCarryover);
    entry.forbiddenReset = dedupeStringArray(entry.forbiddenReset);
  });
  if (handoff) handoff.unresolvedRisks = dedupeStringArray(handoff.unresolvedRisks);
  if (result.qualitySelfCheck && typeof result.qualitySelfCheck === "object" && !Array.isArray(result.qualitySelfCheck)) {
    const quality = result.qualitySelfCheck;
    quality.remainingRisks = dedupeStringArray(quality.remainingRisks);
  }
  if (changes.length) {
    addEvent(run, "warning", "deterministic-repair", `\u5DF2\u5728 ${phase} \u524D\u81EA\u52A8\u4FEE\u6B63 ${changes.length} \u4E2A\u7AE0\u8282\u84DD\u56FE\u7ED3\u6784/\u6B63\u5178\u8FB9\u754C\u5B57\u6BB5\uFF1B\u8FD9\u4E9B\u662F\u786E\u5B9A\u6027\u5B89\u5168\u6E05\u6D17\uFF0C\u7528\u4E8E\u963B\u65AD\u5DF2\u77E5\u9AD8\u9891\u6F02\u79FB\u3002`, {
      phase,
      changes: changes.slice(0, 30),
      truncated: changes.length > 30
    });
  }
}
function isRetroactiveChapterBlueprintQualityGateError(error) {
  return /(?:过短，必须写成可执行(?:场景动作|合同字段)|章节蓝图(?:内容密度不足|合同字段不足))/u.test(String(error || ""));
}
function chapterBlueprintValidationOnlyRetroactiveQualityGate(validation) {
  const errors = Array.isArray(validation?.errors) ? validation.errors : [];
  return errors.length > 0 && errors.every(isRetroactiveChapterBlueprintQualityGateError);
}
function canonicalizeWorldMatrixAnchors(result, input, errors) {
  if (!errors.length) return [];
  const matches = errors.map((error) => error.match(/^continuityAnchors\[(\d+)\] 擅自加入后续剧情结论：/u));
  if (matches.some((match) => !match)) return [];
  const anchors = Array.isArray(result.continuityAnchors) ? result.continuityAnchors : [];
  const allowedSources = new Set(continuityLockSources(input.initialCharacterState));
  const indices = [...new Set(matches.map((match) => Number(match?.[1])).filter((index) => Number.isInteger(index) && index >= 0 && index < anchors.length))];
  for (const index of indices) {
    const source = String(anchors[index].source || "").trim();
    if (!allowedSources.has(source)) return [];
    anchors[index] = {
      ...anchors[index],
      anchor: `\u51BB\u7ED3\u7EA6\u675F\uFF1A${source}`,
      verificationSignal: `\u6BCF\u6B21\u72B6\u6001\u66F4\u65B0\u5747\u68C0\u67E5\u662F\u5426\u4ECD\u6EE1\u8DB3\uFF1A${source}`,
      forbiddenDrift: `\u7981\u6B62\u4EFB\u4F55\u4E16\u754C\u89C4\u5219\u3001\u5730\u70B9\u72B6\u6001\u6216\u4EBA\u7269\u63A5\u53E3\u8FDD\u53CD\uFF1A${source}`
    };
  }
  return indices;
}
function canonicalizeWorldMatrixHandoffSchedule(result, errors) {
  if (errors.length !== 1 || !errors[0].startsWith("handoffToPlotArchitecture \u5305\u542B\u8D8A\u754C\u7AE0\u8282\u6392\u671F\uFF1A")) return 0;
  const handoff = result.handoffToPlotArchitecture && typeof result.handoffToPlotArchitecture === "object" && !Array.isArray(result.handoffToPlotArchitecture) ? result.handoffToPlotArchitecture : {};
  const scheduledChapterPattern = /第(?:(?:[2-9]\d*|\d{2,})(?:[-—至到]\d+)?|(?:二|三|四|五|六|七|八|九|十|百)[一二三四五六七八九十百]*)章/gu;
  let changed = 0;
  for (const key of ["causalInputs", "availableChoices", "lockedConsequences", "escalationAxes", "forbiddenShortcuts"]) {
    if (!Array.isArray(handoff[key])) continue;
    handoff[key] = handoff[key].map((value) => {
      const text = String(value || "");
      if (!scheduledChapterPattern.test(text)) {
        scheduledChapterPattern.lastIndex = 0;
        return value;
      }
      scheduledChapterPattern.lastIndex = 0;
      changed += 1;
      return text.replace(scheduledChapterPattern, "\u540E\u7EED\u9636\u6BB5\uFF08\u5177\u4F53\u65F6\u70B9\u7531\u4E3B\u7EBF\u67B6\u6784\u51B3\u5B9A\uFF09");
    });
  }
  return changed;
}
async function executeRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u72EC\u7ACB\u6267\u884C\u4E16\u754C\u89C2\u8282\u70B9\u3002", { runId: run.runId, isolated: true });
  await fs.mkdir(runDir, { recursive: true });
  await fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(run.input, null, 2)}
`);
  run.artifacts.push("01-input.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]"
    };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    run.prompts = buildPrompts(input, run.runId);
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}
`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}
`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}
`)
    ]);
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md");
    addEvent(run, "success", "prompt", "\u5B9E\u9645\u8BF7\u6C42 Prompt \u5DF2\u51BB\u7ED3\u5230\u672C\u6B21 run\u3002", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length
    });
    let lastStreamEventAt = 0;
    addEvent(run, "info", "llm", "\u8BF7\u6C42\u5DF2\u53D1\u9001\u7ED9\u771F\u5B9E\u6A21\u578B\uFF0C\u7B49\u5F85\u9996\u6BB5\u54CD\u5E94\u3002", { modelName: config.provider.modelName });
    const raw = await generateAgentReply({
      roleName: "World Foundation Architect",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "world_foundation_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta;
        const now = Date.now();
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now;
          addEvent(run, "stream", "llm", `\u6A21\u578B\u6B63\u5728\u8F93\u51FA\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240)
          });
          await persistRun(run);
        }
      }
    });
    run.rawResponse = raw;
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}
`);
    run.artifacts.push("05-raw-response.txt");
    addEvent(run, "success", "llm", `\u6A21\u578B\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${raw.length} \u5B57\u7B26\u3002`, { responseChars: raw.length });
    const parsed = parseDebugModelJsonObject(raw);
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
      run.artifacts.push("05b-repaired-response.txt");
      addEvent(run, "warning", "parse", `\u539F\u59CB\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON\uFF1B\u5DF2\u5B8C\u6210 ${parsed.repairs.length} \u5904\u7ED3\u6784\u4FEE\u590D\u5E76\u91CD\u65B0\u89E3\u6790\u3002`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs
      });
    }
    const result = parsed.value;
    run.result = result;
    await fs.writeFile(path.join(runDir, "06-world-foundation.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("06-world-foundation.json");
    addEvent(run, "success", "parse", parsed.repairedText ? "\u4FEE\u590D\u540E\u7684\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A JSON\uFF1B\u539F\u59CB\u54CD\u5E94\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u539F\u59CB\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A JSON\u3002", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText)
    });
    run.validation = validateFoundation(result);
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u5185\u5BB9\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, { errors: run.validation.errors, warnings: run.validation.warnings });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u5185\u5BB9\u9A8C\u8BC1\u901A\u8FC7\uFF0C\u672C\u6B21 run \u53EF\u4EE5\u8FDB\u5165\u4EBA\u5DE5\u5BA1\u9605\u3002", { warnings: run.validation.warnings });
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
async function executeCharacterRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const inheritedNames = worldCharacterNames(input.worldFoundation);
  const targetCount = Math.max(inheritedNames.length, characterTargetForScale(input.totalChapters));
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u72EC\u7ACB\u6267\u884C\u4EBA\u7269\u89C4\u5212\u8282\u70B9\u3002", { runId: run.runId, isolated: true });
  addEvent(run, "success", "upstream", "\u5DF2\u4ECE\u670D\u52A1\u7AEF\u9501\u5B9A\u5DF2\u901A\u8FC7\u9A8C\u8BC1\u7684\u4E0A\u6E38\u4E16\u754C\u89C2 Run\u3002", {
    upstreamRunId: input.upstreamRunId,
    inheritedCharacterCount: inheritedNames.length,
    inheritedCharacterNames: inheritedNames
  });
  addEvent(run, "info", "scale", `\u6839\u636E ${input.totalChapters} \u7AE0\u4F53\u91CF\uFF0C\u5177\u540D\u89C4\u5212\u4EBA\u7269\u6700\u4F4E\u76EE\u6807\u4E3A ${targetCount} \u4EBA\u3002`, {
    totalChapters: input.totalChapters,
    inheritedCount: inheritedNames.length,
    minimumPlannedCount: targetCount,
    charactersToAddAtLeast: Math.max(0, targetCount - inheritedNames.length)
  });
  await fs.mkdir(runDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({
      upstreamRunId: input.upstreamRunId,
      planningFocus: input.planningFocus,
      totalChapters: input.totalChapters,
      temperature: input.temperature
    }, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01b-upstream-world-foundation.json"), `${JSON.stringify(input.worldFoundation, null, 2)}
`)
  ]);
  run.artifacts.push("01-input.json", "01b-upstream-world-foundation.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]"
    };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    run.prompts = buildCharacterPrompts(input, run.runId);
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}
`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}
`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}
`)
    ]);
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md");
    addEvent(run, "success", "prompt", "\u4EBA\u7269\u89C4\u5212\u5B9E\u9645\u8BF7\u6C42 Prompt \u5DF2\u51BB\u7ED3\u5230\u672C\u6B21 run\u3002", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId
    });
    let lastStreamEventAt = 0;
    addEvent(run, "info", "llm", "\u8BF7\u6C42\u5DF2\u53D1\u9001\u7ED9\u771F\u5B9E\u6A21\u578B\uFF0C\u7B49\u5F85\u4EBA\u7269\u89C4\u5212\u9996\u6BB5\u54CD\u5E94\u3002", { modelName: config.provider.modelName });
    const raw = await generateAgentReply({
      roleName: "Character Dynamics Architect",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "character_planning_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta;
        const now = Date.now();
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now;
          addEvent(run, "stream", "llm", `\u6A21\u578B\u6B63\u5728\u8F93\u51FA\u4EBA\u7269\u89C4\u5212\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240)
          });
          await persistRun(run);
        }
      }
    });
    run.rawResponse = raw;
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}
`);
    run.artifacts.push("05-raw-response.txt");
    addEvent(run, "success", "llm", `\u4EBA\u7269\u89C4\u5212\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${raw.length} \u5B57\u7B26\u3002`, { responseChars: raw.length });
    const parsed = parseDebugModelJsonObject(raw);
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
      run.artifacts.push("05b-repaired-response.txt");
      addEvent(run, "warning", "parse", `\u539F\u59CB\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON\uFF1B\u5DF2\u5B8C\u6210 ${parsed.repairs.length} \u5904\u7ED3\u6784\u4FEE\u590D\u5E76\u91CD\u65B0\u89E3\u6790\u3002`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs
      });
    }
    const result = parsed.value;
    run.result = result;
    await fs.writeFile(path.join(runDir, "06-character-planning.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("06-character-planning.json");
    addEvent(run, "success", "parse", parsed.repairedText ? "\u4FEE\u590D\u540E\u7684\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u4EBA\u7269\u89C4\u5212 JSON\uFF1B\u539F\u59CB\u54CD\u5E94\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u539F\u59CB\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u4EBA\u7269\u89C4\u5212 JSON\u3002", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText)
    });
    run.validation = validateCharacterPlan(result, input);
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    const plannedNames = Array.isArray(result.characters) ? result.characters.map((item) => String(item?.name || "")).filter(Boolean) : [];
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u4EBA\u7269\u89C4\u5212\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
        errors: run.validation.errors,
        warnings: run.validation.warnings,
        plannedCharacterCount: plannedNames.length
      });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u4EBA\u7269\u89C4\u5212\u9A8C\u8BC1\u901A\u8FC7\uFF1B\u4E0A\u6E38\u4EBA\u7269\u5DF2\u7EE7\u627F\uFF0C\u9879\u76EE\u4F53\u91CF\u3001\u5173\u7CFB\u7F51\u548C\u9636\u6BB5\u6269\u5BB9\u65B9\u6848\u5747\u53EF\u8FDB\u5165\u4EBA\u5DE5\u5BA1\u9605\u3002", {
        inheritedCharacterCount: inheritedNames.length,
        plannedCharacterCount: plannedNames.length,
        addedCharacterNames: plannedNames.filter((name) => !inheritedNames.includes(name)),
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u4EBA\u7269\u89C4\u5212\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
async function executeInitialCharacterStateRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const names = plannedCharacterNames(input.characterPlanning);
  const relationshipCount = Array.isArray(input.characterPlanning.relationshipGraph) ? input.characterPlanning.relationshipGraph.length : 0;
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u72EC\u7ACB\u6267\u884C\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u8282\u70B9\u3002", { runId: run.runId, isolated: true });
  addEvent(run, "success", "upstream", "\u5DF2\u4ECE\u670D\u52A1\u7AEF\u9501\u5B9A\u5DF2\u901A\u8FC7\u9A8C\u8BC1\u7684\u4EBA\u7269\u89C4\u5212 Run\u3002", {
    upstreamRunId: input.upstreamRunId,
    frozenCharacterCount: names.length,
    frozenCharacterNames: names
  });
  addEvent(run, "info", "freeze", `\u51C6\u5907\u51BB\u7ED3 ${names.length} \u4EBA\u5728\u7B2C ${input.openingChapter} \u7AE0\u5F00\u573A\u65F6\u523B\u7684\u72B6\u6001\u3002`, {
    openingChapter: input.openingChapter,
    relationshipEdgesToInitialize: relationshipCount,
    newCharactersAllowed: false
  });
  await fs.mkdir(runDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({
      upstreamRunId: input.upstreamRunId,
      stateFocus: input.stateFocus,
      openingChapter: input.openingChapter,
      totalChapters: input.totalChapters,
      temperature: input.temperature
    }, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01b-upstream-character-planning.json"), `${JSON.stringify(input.characterPlanning, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01c-upstream-world-foundation.json"), `${JSON.stringify(input.worldFoundation, null, 2)}
`)
  ]);
  run.artifacts.push("01-input.json", "01b-upstream-character-planning.json", "01c-upstream-world-foundation.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]"
    };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    run.prompts = buildInitialCharacterStatePrompts(input, run.runId);
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}
`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}
`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}
`)
    ]);
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md");
    addEvent(run, "success", "prompt", "\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u5B9E\u9645\u8BF7\u6C42 Prompt \u5DF2\u51BB\u7ED3\u5230\u672C\u6B21 run\u3002", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId
    });
    let lastStreamEventAt = 0;
    addEvent(run, "info", "llm", "\u8BF7\u6C42\u5DF2\u53D1\u9001\u7ED9\u771F\u5B9E\u6A21\u578B\uFF0C\u7B49\u5F85\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u9996\u6BB5\u54CD\u5E94\u3002", { modelName: config.provider.modelName });
    const raw = await generateAgentReply({
      roleName: "Initial Character State Architect",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "initial_character_state_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta;
        const now = Date.now();
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now;
          addEvent(run, "stream", "llm", `\u6A21\u578B\u6B63\u5728\u8F93\u51FA\u4EBA\u7269\u521D\u59CB\u72B6\u6001\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240)
          });
          await persistRun(run);
        }
      }
    });
    run.rawResponse = raw;
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}
`);
    run.artifacts.push("05-raw-response.txt");
    addEvent(run, "success", "llm", `\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${raw.length} \u5B57\u7B26\u3002`, { responseChars: raw.length });
    const parsed = parseDebugModelJsonObject(raw);
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
      run.artifacts.push("05b-repaired-response.txt");
      addEvent(run, "warning", "parse", `\u539F\u59CB\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON\uFF1B\u5DF2\u5B8C\u6210 ${parsed.repairs.length} \u5904\u7ED3\u6784\u4FEE\u590D\u5E76\u91CD\u65B0\u89E3\u6790\u3002`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs
      });
    }
    let result = parsed.value;
    run.result = result;
    await fs.writeFile(path.join(runDir, "06-initial-character-state.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("06-initial-character-state.json");
    addEvent(run, "success", "parse", parsed.repairedText ? "\u4FEE\u590D\u540E\u7684\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u4EBA\u7269\u521D\u59CB\u72B6\u6001 JSON\uFF1B\u539F\u59CB\u54CD\u5E94\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u539F\u59CB\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u4EBA\u7269\u521D\u59CB\u72B6\u6001 JSON\u3002", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText)
    });
    run.validation = validateInitialCharacterState(result, input);
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    if (!run.validation.valid) {
      const initialValidation = run.validation;
      const repairMessage = buildInitialCharacterStateRepairMessage(input, result, initialValidation.errors);
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}
`);
      run.artifacts.push("08-repair-message.md");
      addEvent(run, "warning", "repair", `\u9996\u6B21\u7ED3\u6784\u6821\u9A8C\u53D1\u73B0 ${initialValidation.errors.length} \u4E2A\u9519\u8BEF\uFF0C\u542F\u52A8\u4E00\u6B21\u771F\u5B9E\u6A21\u578B\u5B9A\u5411\u4FEE\u590D\u3002`, {
        errors: initialValidation.errors,
        repairTemperature: Math.min(input.temperature, 0.2),
        originalResponseArtifact: "05-raw-response.txt",
        repairMessageArtifact: "08-repair-message.md"
      });
      try {
        let repairRaw = "";
        let lastRepairStreamEventAt = 0;
        const repairedReply = await generateAgentReply({
          roleName: "Initial Character State Repair Architect",
          basePrompt: "\u4F60\u662F\u4EBA\u7269\u72B6\u6001 JSON \u4FEE\u590D\u5668\u3002\u53EA\u4FEE\u590D\u7A0B\u5E8F\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4E0D\u6269\u5199\u5267\u60C5\uFF0C\u4E0D\u65B0\u589E\u4EBA\u7269\u6216\u5173\u7CFB\uFF0C\u4E0D\u8F93\u51FA\u89E3\u91CA\u3002",
          dynamicPrompt: `\u51BB\u7ED3\u4EBA\u7269\u4E0E\u5173\u7CFB\u5747\u5728\u4FEE\u590D\u6D88\u606F\u4E2D\u7ED9\u51FA\u3002\u4E0A\u6E38\u4EBA\u7269\u89C4\u5212 Run\uFF1A${input.upstreamRunId}`,
          consensus: `\u72EC\u7ACB\u8C03\u8BD5 Run: ${run.runId}
\u81EA\u52A8\u4FEE\u590D\u8F6E\uFF1A1/1`,
          message: repairMessage,
          currentStage: "initial_character_state_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.2),
          onDelta: async (delta) => {
            repairRaw += delta;
            run.rawResponse = repairRaw;
            const now = Date.now();
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now;
              addEvent(run, "stream", "repair", `\u6A21\u578B\u6B63\u5728\u5B9A\u5411\u4FEE\u590D\u4EBA\u7269\u521D\u59CB\u72B6\u6001\uFF0C\u5DF2\u63A5\u6536 ${repairRaw.length} \u5B57\u7B26\u3002`, {
                responseChars: repairRaw.length,
                tail: repairRaw.slice(-240)
              });
              await persistRun(run);
            }
          }
        });
        repairRaw = repairedReply;
        run.rawResponse = repairRaw;
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}
`);
        run.artifacts.push("09-repair-raw-response.txt");
        const repairedParsed = parseDebugModelJsonObject(repairRaw);
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}
`);
          run.artifacts.push("09b-repaired-json-text.txt");
        }
        result = repairedParsed.value;
        run.result = result;
        run.validation = validateInitialCharacterState(result, input);
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-initial-character-state-repaired.json"), `${JSON.stringify(result, null, 2)}
`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}
`)
        ]);
        run.artifacts.push("10-initial-character-state-repaired.json", "11-validation-after-repair.json");
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid ? "\u5B9A\u5411\u4FEE\u590D\u54CD\u5E94\u5DF2\u901A\u8FC7\u7ED3\u6784\u6821\u9A8C\u3002" : `\u5B9A\u5411\u4FEE\u590D\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
          errors: run.validation.errors,
          warnings: run.validation.warnings,
          repairedResponseChars: repairRaw.length
        });
      } catch (repairError) {
        run.validation = initialValidation;
        addEvent(run, "error", "repair", `\u5B9A\u5411\u4FEE\u590D\u8C03\u7528\u5931\u8D25\uFF0C\u4FDD\u7559\u9996\u6B21\u6821\u9A8C\u7ED3\u679C\uFF1A${repairError instanceof Error ? repairError.message : String(repairError)}`);
      }
    }
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
        errors: run.validation.errors,
        warnings: run.validation.warnings,
        initializedCharacterCount: Array.isArray(result.characters) ? result.characters.length : 0
      });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u9A8C\u8BC1\u901A\u8FC7\uFF1B\u4EBA\u7269\u96C6\u5408\u3001\u5F00\u573A\u52A8\u4F5C\u3001\u77E5\u8BC6\u8FB9\u754C\u548C\u5173\u7CFB\u72B6\u6001\u5747\u53EF\u4EA4\u7ED9\u4E16\u754C\u77E9\u9635\u8282\u70B9\u3002", {
        initializedCharacterCount: names.length,
        relationshipStateCount: Array.isArray(result.relationshipStateLedger) ? result.relationshipStateLedger.length : 0,
        openingChapter: input.openingChapter,
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
async function executeWorldMatrixRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const characters = initialStateCharacters(input.initialCharacterState);
  const locations = openingLocationNames(input.initialCharacterState);
  const ruleCount = Array.isArray(input.worldFoundation.worldRules) ? input.worldFoundation.worldRules.length : 0;
  const clockCount = Array.isArray(input.initialCharacterState.activeClocks) ? input.initialCharacterState.activeClocks.length : 0;
  const knowledgeLockCount = Array.isArray(input.initialCharacterState.openingKnowledgeLocks) ? input.initialCharacterState.openingKnowledgeLocks.length : 0;
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u72EC\u7ACB\u6267\u884C\u4E16\u754C\u77E9\u9635\u8282\u70B9\u3002", { runId: run.runId, isolated: true, productionPhase: "phase_5_world_matrix" });
  addEvent(run, "success", "upstream", "\u5DF2\u4ECE\u670D\u52A1\u7AEF\u9501\u5B9A\u901A\u8FC7\u9A8C\u8BC1\u7684\u4EBA\u7269\u521D\u59CB\u72B6\u6001 Run\u3002", {
    upstreamRunId: input.upstreamRunId,
    frozenCharacterCount: characters.length,
    frozenOpeningLocationCount: locations.length,
    sourceRuleCount: ruleCount,
    activeClockCount: clockCount,
    knowledgeLockCount
  });
  addEvent(run, "info", "boundary", "\u8282\u70B9\u8FB9\u754C\u5DF2\u51BB\u7ED3\uFF1A\u53EA\u751F\u6210\u4E16\u754C\u77E9\u9635\uFF0C\u4E0D\u751F\u6210\u4E3B\u7EBF\u67B6\u6784\u3001\u7AE0\u8282\u56E0\u679C\u94FE\u6216\u6B63\u6587\u3002", {
    allowedPhase: "phase_5_world_matrix",
    nextPhase: "phase_6_plot_architecture",
    forbiddenOutputs: ["plotArchitecture", "chapters", "arcPlan", "mainPlot", "volumeStrategy"]
  });
  await fs.mkdir(runDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, matrixFocus: input.matrixFocus, totalChapters: input.totalChapters, temperature: input.temperature }, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01b-upstream-initial-character-state.json"), `${JSON.stringify(input.initialCharacterState, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01c-upstream-character-planning.json"), `${JSON.stringify(input.characterPlanning, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01d-upstream-world-foundation.json"), `${JSON.stringify(input.worldFoundation, null, 2)}
`)
  ]);
  run.artifacts.push("01-input.json", "01b-upstream-initial-character-state.json", "01c-upstream-character-planning.json", "01d-upstream-world-foundation.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]"
    };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    run.prompts = buildWorldMatrixPrompts(input, run.runId);
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}
`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}
`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}
`)
    ]);
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md");
    addEvent(run, "success", "prompt", "\u4E16\u754C\u77E9\u9635\u5B9E\u9645\u8BF7\u6C42 Prompt \u5DF2\u51BB\u7ED3\u5230\u672C\u6B21 run\u3002", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId
    });
    let lastStreamEventAt = 0;
    addEvent(run, "info", "llm", "\u8BF7\u6C42\u5DF2\u53D1\u9001\u7ED9\u771F\u5B9E\u6A21\u578B\uFF0C\u7B49\u5F85\u4E16\u754C\u77E9\u9635\u9996\u6BB5\u54CD\u5E94\u3002", { modelName: config.provider.modelName });
    const raw = await generateAgentReply({
      roleName: "World Matrix Architect",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "world_matrix_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta;
        const now = Date.now();
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now;
          addEvent(run, "stream", "llm", `\u6A21\u578B\u6B63\u5728\u8F93\u51FA\u4E16\u754C\u77E9\u9635\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240)
          });
          await persistRun(run);
        }
      }
    });
    run.rawResponse = raw;
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}
`);
    run.artifacts.push("05-raw-response.txt");
    addEvent(run, "success", "llm", `\u4E16\u754C\u77E9\u9635\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${raw.length} \u5B57\u7B26\u3002`, { responseChars: raw.length });
    const parsed = parseDebugModelJsonObject(raw);
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
      run.artifacts.push("05b-repaired-response.txt");
      addEvent(run, "warning", "parse", `\u539F\u59CB\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON\uFF1B\u5DF2\u5B8C\u6210 ${parsed.repairs.length} \u5904\u7ED3\u6784\u4FEE\u590D\u5E76\u91CD\u65B0\u89E3\u6790\u3002`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs
      });
    }
    let result = parsed.value;
    run.result = result;
    await fs.writeFile(path.join(runDir, "06-world-matrix.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("06-world-matrix.json");
    addEvent(run, "success", "parse", parsed.repairedText ? "\u4FEE\u590D\u540E\u7684\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u4E16\u754C\u77E9\u9635 JSON\uFF1B\u539F\u59CB\u54CD\u5E94\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u539F\u59CB\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u4E16\u754C\u77E9\u9635 JSON\u3002", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText)
    });
    run.validation = validateWorldMatrix(result, input);
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    if (!run.validation.valid) {
      const initialValidation = run.validation;
      const repairMessage = buildWorldMatrixRepairMessage(input, result, initialValidation.errors);
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}
`);
      run.artifacts.push("08-repair-message.md");
      addEvent(run, "warning", "repair", `\u9996\u6B21\u7ED3\u6784\u6821\u9A8C\u53D1\u73B0 ${initialValidation.errors.length} \u4E2A\u9519\u8BEF\uFF0C\u542F\u52A8\u4E00\u6B21\u771F\u5B9E\u6A21\u578B\u5B9A\u5411\u4FEE\u590D\u3002`, {
        errors: initialValidation.errors,
        repairTemperature: Math.min(input.temperature, 0.15),
        originalResponseArtifact: "05-raw-response.txt",
        repairMessageArtifact: "08-repair-message.md"
      });
      try {
        let repairRaw = "";
        let lastRepairStreamEventAt = 0;
        const repairedReply = await generateAgentReply({
          roleName: "World Matrix Repair Architect",
          basePrompt: "\u4F60\u662F\u4E16\u754C\u77E9\u9635 JSON \u4FEE\u590D\u5668\u3002\u53EA\u4FEE\u590D\u7A0B\u5E8F\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4E0D\u6269\u5199\u4E3B\u7EBF\u3001\u7AE0\u8282\u6216\u4EBA\u7269\uFF0C\u4E0D\u65B0\u589E\u4EBA\u7269\u3002",
          dynamicPrompt: `\u51BB\u7ED3\u6765\u6E90\u5747\u5728\u4FEE\u590D\u6D88\u606F\u4E2D\u7ED9\u51FA\u3002\u4E0A\u6E38\u4EBA\u7269\u521D\u59CB\u72B6\u6001 Run\uFF1A${input.upstreamRunId}`,
          consensus: `\u72EC\u7ACB\u8C03\u8BD5 Run: ${run.runId}
\u81EA\u52A8\u4FEE\u590D\u8F6E\uFF1A1/1`,
          message: repairMessage,
          currentStage: "world_matrix_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.15),
          onDelta: async (delta) => {
            repairRaw += delta;
            run.rawResponse = repairRaw;
            const now = Date.now();
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now;
              addEvent(run, "stream", "repair", `\u6A21\u578B\u6B63\u5728\u5B9A\u5411\u4FEE\u590D\u4E16\u754C\u77E9\u9635\uFF0C\u5DF2\u63A5\u6536 ${repairRaw.length} \u5B57\u7B26\u3002`, {
                responseChars: repairRaw.length,
                tail: repairRaw.slice(-240)
              });
              await persistRun(run);
            }
          }
        });
        repairRaw = repairedReply;
        run.rawResponse = repairRaw;
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}
`);
        run.artifacts.push("09-repair-raw-response.txt");
        const repairedParsed = parseDebugModelJsonObject(repairRaw);
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}
`);
          run.artifacts.push("09b-repaired-json-text.txt");
        }
        result = repairedParsed.value;
        run.result = result;
        run.validation = validateWorldMatrix(result, input);
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-world-matrix-repaired.json"), `${JSON.stringify(result, null, 2)}
`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}
`)
        ]);
        run.artifacts.push("10-world-matrix-repaired.json", "11-validation-after-repair.json");
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid ? "\u5B9A\u5411\u4FEE\u590D\u54CD\u5E94\u5DF2\u901A\u8FC7\u4E16\u754C\u77E9\u9635\u7ED3\u6784\u6821\u9A8C\u3002" : `\u5B9A\u5411\u4FEE\u590D\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
          errors: run.validation.errors,
          warnings: run.validation.warnings,
          repairedResponseChars: repairRaw.length
        });
      } catch (repairError) {
        run.validation = initialValidation;
        addEvent(run, "error", "repair", `\u5B9A\u5411\u4FEE\u590D\u8C03\u7528\u5931\u8D25\uFF0C\u4FDD\u7559\u9996\u6B21\u6821\u9A8C\u7ED3\u679C\uFF1A${repairError instanceof Error ? repairError.message : String(repairError)}`);
      }
    }
    if (!run.validation.valid) {
      const canonicalizedAnchorIndices = canonicalizeWorldMatrixAnchors(result, input, run.validation.errors);
      if (canonicalizedAnchorIndices.length) {
        run.result = result;
        run.validation = validateWorldMatrix(result, input);
        await Promise.all([
          fs.writeFile(path.join(runDir, "12-world-matrix-canonicalized.json"), `${JSON.stringify(result, null, 2)}
`),
          fs.writeFile(path.join(runDir, "13-validation-after-canonicalization.json"), `${JSON.stringify(run.validation, null, 2)}
`)
        ]);
        run.artifacts.push("12-world-matrix-canonicalized.json", "13-validation-after-canonicalization.json");
        addEvent(run, run.validation.valid ? "success" : "error", "canonicalize", run.validation.valid ? `\u5DF2\u5C06 ${canonicalizedAnchorIndices.length} \u6761\u8D8A\u754C\u951A\u70B9\u786E\u5B9A\u6027\u6062\u590D\u4E3A\u8282\u70B9 03 \u7684\u539F\u59CB\u51BB\u7ED3\u9501\uFF0C\u5E76\u901A\u8FC7\u590D\u68C0\u3002` : `\u951A\u70B9\u786E\u5B9A\u6027\u6062\u590D\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
          canonicalizedAnchorIndices,
          errors: run.validation.errors,
          outputArtifact: "12-world-matrix-canonicalized.json"
        });
      }
    }
    if (!run.validation.valid) {
      const canonicalizedScheduleCount = canonicalizeWorldMatrixHandoffSchedule(result, run.validation.errors);
      if (canonicalizedScheduleCount) {
        run.result = result;
        run.validation = validateWorldMatrix(result, input);
        await Promise.all([
          fs.writeFile(path.join(runDir, "14-world-matrix-boundary-canonicalized.json"), `${JSON.stringify(result, null, 2)}
`),
          fs.writeFile(path.join(runDir, "15-validation-after-boundary-canonicalization.json"), `${JSON.stringify(run.validation, null, 2)}
`)
        ]);
        run.artifacts.push("14-world-matrix-boundary-canonicalized.json", "15-validation-after-boundary-canonicalization.json");
        addEvent(run, run.validation.valid ? "success" : "error", "canonicalize", run.validation.valid ? `\u5DF2\u79FB\u9664 ${canonicalizedScheduleCount} \u5904\u8D8A\u754C\u7AE0\u8282\u6392\u671F\uFF0C\u4FDD\u7559\u56E0\u679C\u6761\u4EF6\u5E76\u4EA4\u7531\u4E3B\u7EBF\u67B6\u6784\u51B3\u5B9A\u5177\u4F53\u65F6\u70B9\u3002` : `\u79FB\u9664\u8D8A\u754C\u7AE0\u8282\u6392\u671F\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
          canonicalizedScheduleCount,
          errors: run.validation.errors,
          outputArtifact: "14-world-matrix-boundary-canonicalized.json"
        });
      }
    }
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u4E16\u754C\u77E9\u9635\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
        errors: run.validation.errors,
        warnings: run.validation.warnings,
        mappedCharacterCount: Array.isArray(result.characterWorldInterfaces) ? result.characterWorldInterfaces.length : 0
      });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u4E16\u754C\u77E9\u9635\u9A8C\u8BC1\u901A\u8FC7\uFF1B\u89C4\u5219\u3001\u5730\u70B9\u3001\u4EBA\u7269\u63A5\u53E3\u3001\u538B\u529B\u4E0E\u77E5\u8BC6\u9501\u53EF\u4EA4\u7ED9\u4E3B\u7EBF\u67B6\u6784\u8282\u70B9\u3002", {
        mappedCharacterCount: characters.length,
        mappedLocationCount: Array.isArray(result.locations) ? result.locations.length : 0,
        mappedRuleCount: Array.isArray(result.rules) ? result.rules.length : 0,
        pressureSystemCount: Array.isArray(result.pressureSystems) ? result.pressureSystems.length : 0,
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u4E16\u754C\u77E9\u9635\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
async function executePlotArchitectureRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const characters = plannedCharacterNames(input.characterPlanning);
  const pressures = plotSourceNames(input.worldMatrix, "pressureSystems", "name");
  const anchors = plotSourceNames(input.worldMatrix, "continuityAnchors", "id");
  const arcTarget = plotArchitectureArcTarget(input.totalChapters);
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u72EC\u7ACB\u6267\u884C\u4E3B\u7EBF\u67B6\u6784\u8282\u70B9\u3002", { runId: run.runId, isolated: true, productionPhase: "phase_6_plot_architecture" });
  addEvent(run, "success", "upstream", "\u5DF2\u4ECE\u670D\u52A1\u7AEF\u9501\u5B9A\u901A\u8FC7\u9A8C\u8BC1\u7684\u4E16\u754C\u77E9\u9635 Run\u3002", {
    upstreamRunId: input.upstreamRunId,
    frozenCharacterCount: characters.length,
    sourcePressureCount: pressures.length,
    sourceContinuityAnchorCount: anchors.length,
    targetArcCount: arcTarget,
    totalChapters: input.totalChapters
  });
  addEvent(run, "info", "boundary", "\u8282\u70B9\u8FB9\u754C\u5DF2\u51BB\u7ED3\uFF1A\u53EA\u751F\u6210\u5B8F\u89C2\u4E3B\u7EBF\u56E0\u679C\u67B6\u6784\uFF0C\u4E0D\u751F\u6210\u6545\u4E8B\u5723\u7ECF\u3001\u5206\u5377\u7B56\u7565\u3001\u9010\u7AE0\u84DD\u56FE\u6216\u6B63\u6587\u3002", {
    allowedPhase: "phase_6_plot_architecture",
    nextPhase: "phase_7_story_bible",
    forbiddenOutputs: ["storyBible", "volumeStrategy", "chapterBlueprints", "chapters", "prose"]
  });
  await fs.mkdir(runDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, architectureFocus: input.architectureFocus, totalChapters: input.totalChapters, temperature: input.temperature }, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01b-upstream-world-matrix.json"), `${JSON.stringify(input.worldMatrix, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01c-upstream-character-planning.json"), `${JSON.stringify(input.characterPlanning, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01d-upstream-initial-character-state.json"), `${JSON.stringify(input.initialCharacterState, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01e-upstream-world-foundation.json"), `${JSON.stringify(input.worldFoundation, null, 2)}
`)
  ]);
  run.artifacts.push("01-input.json", "01b-upstream-world-matrix.json", "01c-upstream-character-planning.json", "01d-upstream-initial-character-state.json", "01e-upstream-world-foundation.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    run.provider = {
      configId: config._configId,
      configName: config._configName || config.provider.modelName,
      baseUrl: config.provider.baseUrl,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: input.temperature,
      apiKey: "[REDACTED]"
    };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    run.prompts = buildPlotArchitecturePrompts(input, run.runId);
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}
`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}
`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}
`)
    ]);
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md");
    addEvent(run, "success", "prompt", "\u4E3B\u7EBF\u67B6\u6784\u5B9E\u9645\u8BF7\u6C42 Prompt \u5DF2\u51BB\u7ED3\u5230\u672C\u6B21 run\u3002", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId
    });
    let lastStreamEventAt = 0;
    addEvent(run, "info", "llm", "\u8BF7\u6C42\u5DF2\u53D1\u9001\u7ED9\u771F\u5B9E\u6A21\u578B\uFF0C\u7B49\u5F85\u4E3B\u7EBF\u67B6\u6784\u9996\u6BB5\u54CD\u5E94\u3002", { modelName: config.provider.modelName });
    const raw = await generateAgentReply({
      roleName: "Plot Architecture Showrunner",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "plot_architecture_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta;
        const now = Date.now();
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now;
          addEvent(run, "stream", "llm", `\u6A21\u578B\u6B63\u5728\u8F93\u51FA\u4E3B\u7EBF\u67B6\u6784\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, {
            responseChars: run.rawResponse.length,
            tail: run.rawResponse.slice(-240)
          });
          await persistRun(run);
        }
      }
    });
    run.rawResponse = raw;
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}
`);
    run.artifacts.push("05-raw-response.txt");
    addEvent(run, "success", "llm", `\u4E3B\u7EBF\u67B6\u6784\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${raw.length} \u5B57\u7B26\u3002`, { responseChars: raw.length });
    const parsed = parseDebugModelJsonObject(raw);
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
      run.artifacts.push("05b-repaired-response.txt");
      addEvent(run, "warning", "parse", `\u539F\u59CB\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON\uFF1B\u5DF2\u5B8C\u6210 ${parsed.repairs.length} \u5904\u7ED3\u6784\u4FEE\u590D\u5E76\u91CD\u65B0\u89E3\u6790\u3002`, {
        originalError: parsed.originalError,
        repairs: parsed.repairs
      });
    }
    let result = parsed.value;
    run.result = result;
    await fs.writeFile(path.join(runDir, "06-plot-architecture.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("06-plot-architecture.json");
    addEvent(run, "success", "parse", parsed.repairedText ? "\u4FEE\u590D\u540E\u7684\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u4E3B\u7EBF\u67B6\u6784 JSON\uFF1B\u539F\u59CB\u54CD\u5E94\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u539F\u59CB\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u4E3B\u7EBF\u67B6\u6784 JSON\u3002", {
      topLevelKeys: Object.keys(result),
      repaired: Boolean(parsed.repairedText)
    });
    run.validation = validatePlotArchitecture(result, input);
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    if (!run.validation.valid) {
      const initialValidation = run.validation;
      const repairMessage = buildPlotArchitectureRepairMessage(input, result, initialValidation.errors);
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}
`);
      run.artifacts.push("08-repair-message.md");
      addEvent(run, "warning", "repair", `\u9996\u6B21\u7ED3\u6784\u6821\u9A8C\u53D1\u73B0 ${initialValidation.errors.length} \u4E2A\u9519\u8BEF\uFF0C\u542F\u52A8\u4E00\u6B21\u771F\u5B9E\u6A21\u578B\u5B9A\u5411\u4FEE\u590D\u3002`, {
        errors: initialValidation.errors,
        repairTemperature: Math.min(input.temperature, 0.15),
        originalResponseArtifact: "05-raw-response.txt",
        repairMessageArtifact: "08-repair-message.md"
      });
      try {
        let repairRaw = "";
        let lastRepairStreamEventAt = 0;
        const repairedReply = await generateAgentReply({
          roleName: "Plot Architecture Repair Showrunner",
          basePrompt: "\u4F60\u662F\u4E3B\u7EBF\u67B6\u6784 JSON \u4FEE\u590D\u5668\u3002\u53EA\u4FEE\u590D\u7A0B\u5E8F\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4E0D\u65B0\u589E\u4EBA\u7269\uFF0C\u4E0D\u751F\u6210\u6545\u4E8B\u5723\u7ECF\u3001\u5206\u5377\u7B56\u7565\u3001\u9010\u7AE0\u84DD\u56FE\u6216\u6B63\u6587\u3002",
          dynamicPrompt: `\u51BB\u7ED3\u6765\u6E90\u5747\u5728\u4FEE\u590D\u6D88\u606F\u4E2D\u7ED9\u51FA\u3002\u4E0A\u6E38\u4E16\u754C\u77E9\u9635 Run\uFF1A${input.upstreamRunId}`,
          consensus: `\u72EC\u7ACB\u8C03\u8BD5 Run: ${run.runId}
\u81EA\u52A8\u4FEE\u590D\u8F6E\uFF1A1/1`,
          message: repairMessage,
          currentStage: "plot_architecture_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.15),
          onDelta: async (delta) => {
            repairRaw += delta;
            run.rawResponse = repairRaw;
            const now = Date.now();
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now;
              addEvent(run, "stream", "repair", `\u6A21\u578B\u6B63\u5728\u5B9A\u5411\u4FEE\u590D\u4E3B\u7EBF\u67B6\u6784\uFF0C\u5DF2\u63A5\u6536 ${repairRaw.length} \u5B57\u7B26\u3002`, {
                responseChars: repairRaw.length,
                tail: repairRaw.slice(-240)
              });
              await persistRun(run);
            }
          }
        });
        repairRaw = repairedReply;
        run.rawResponse = repairRaw;
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}
`);
        run.artifacts.push("09-repair-raw-response.txt");
        const repairedParsed = parseDebugModelJsonObject(repairRaw);
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}
`);
          run.artifacts.push("09b-repaired-json-text.txt");
        }
        result = repairedParsed.value;
        run.result = result;
        run.validation = validatePlotArchitecture(result, input);
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-plot-architecture-repaired.json"), `${JSON.stringify(result, null, 2)}
`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}
`)
        ]);
        run.artifacts.push("10-plot-architecture-repaired.json", "11-validation-after-repair.json");
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid ? "\u5B9A\u5411\u4FEE\u590D\u54CD\u5E94\u5DF2\u901A\u8FC7\u4E3B\u7EBF\u67B6\u6784\u7ED3\u6784\u6821\u9A8C\u3002" : `\u5B9A\u5411\u4FEE\u590D\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
          errors: run.validation.errors,
          warnings: run.validation.warnings,
          repairedResponseChars: repairRaw.length
        });
      } catch (repairError) {
        run.validation = initialValidation;
        addEvent(run, "error", "repair", `\u5B9A\u5411\u4FEE\u590D\u8C03\u7528\u5931\u8D25\uFF0C\u4FDD\u7559\u9996\u6B21\u6821\u9A8C\u7ED3\u679C\uFF1A${repairError instanceof Error ? repairError.message : String(repairError)}`);
      }
    }
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u4E3B\u7EBF\u67B6\u6784\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
        errors: run.validation.errors,
        warnings: run.validation.warnings,
        arcCount: Array.isArray(result.arcArchitecture) ? result.arcArchitecture.length : 0
      });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u4E3B\u7EBF\u67B6\u6784\u9A8C\u8BC1\u901A\u8FC7\uFF1B\u5B8F\u89C2\u56E0\u679C\u5F27\u3001\u4EBA\u7269\u53D8\u5316\u3001\u538B\u529B\u5347\u7EA7\u3001\u8FDE\u7EED\u6027\u951A\u70B9\u548C\u4F0F\u7B14\u8BA1\u5212\u53EF\u4EA4\u7ED9\u6545\u4E8B\u5723\u7ECF\u8282\u70B9\u3002", {
        arcCount: Array.isArray(result.arcArchitecture) ? result.arcArchitecture.length : 0,
        characterBindingCount: Array.isArray(result.characterArcBindings) ? result.characterArcBindings.length : 0,
        continuityPlanCount: Array.isArray(result.continuityPlan) ? result.continuityPlan.length : 0,
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u4E3B\u7EBF\u67B6\u6784\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
async function executeStoryBibleRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const characters = plannedCharacterNames(input.characterPlanning);
  const relationships = storyBibleRelationshipKeys(input.characterPlanning);
  const arcIds = plotSourceNames(input.plotArchitecture, "arcArchitecture", "id");
  const continuityIds = plotSourceNames(input.plotArchitecture, "continuityPlan", "sourceAnchorId");
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u72EC\u7ACB\u6267\u884C\u6545\u4E8B\u5723\u7ECF\u8282\u70B9\u3002", { runId: run.runId, isolated: true, productionPhase: "phase_7_story_bible" });
  addEvent(run, "success", "upstream", "\u5DF2\u4ECE\u670D\u52A1\u7AEF\u9501\u5B9A\u901A\u8FC7\u9A8C\u8BC1\u7684\u4E3B\u7EBF\u67B6\u6784 Run\u3002", {
    upstreamRunId: input.upstreamRunId,
    frozenCharacterCount: characters.length,
    frozenRelationshipCount: relationships.length,
    sourceArcCount: arcIds.length,
    sourceContinuityAnchorCount: continuityIds.length
  });
  addEvent(run, "info", "boundary", "\u8282\u70B9\u8FB9\u754C\u5DF2\u51BB\u7ED3\uFF1A\u53EA\u751F\u6210\u6545\u4E8B\u6B63\u5178\uFF0C\u4E0D\u91CD\u65B0\u89C4\u5212\u4E3B\u7EBF\uFF0C\u4E0D\u751F\u6210\u5206\u5377\u7B56\u7565\u3001\u9010\u7AE0\u84DD\u56FE\u6216\u6B63\u6587\u3002", {
    allowedPhase: "phase_7_story_bible",
    nextPhase: "phase_8_volume_strategy",
    forbiddenOutputs: ["volumeStrategy", "chapterBlueprints", "chapters", "chapterDrafts", "prose"]
  });
  await fs.mkdir(runDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, bibleFocus: input.bibleFocus, totalChapters: input.totalChapters, temperature: input.temperature }, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01b-upstream-plot-architecture.json"), `${JSON.stringify(input.plotArchitecture, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01c-upstream-world-matrix.json"), `${JSON.stringify(input.worldMatrix, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01d-upstream-character-planning.json"), `${JSON.stringify(input.characterPlanning, null, 2)}
`)
  ]);
  run.artifacts.push("01-input.json", "01b-upstream-plot-architecture.json", "01c-upstream-world-matrix.json", "01d-upstream-character-planning.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    run.provider = { configId: config._configId, configName: config._configName || config.provider.modelName, baseUrl: config.provider.baseUrl, modelName: config.provider.modelName, apiMode: config.provider.apiMode, timeoutMs: config.provider.timeoutMs, temperature: input.temperature, apiKey: "[REDACTED]" };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    run.prompts = buildStoryBiblePrompts(input, run.runId);
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}
`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}
`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}
`)
    ]);
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md");
    addEvent(run, "success", "prompt", "\u6545\u4E8B\u5723\u7ECF\u5B9E\u9645\u8BF7\u6C42 Prompt \u5DF2\u51BB\u7ED3\u5230\u672C\u6B21 run\u3002", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId
    });
    let lastStreamEventAt = 0;
    addEvent(run, "info", "llm", "\u8BF7\u6C42\u5DF2\u53D1\u9001\u7ED9\u771F\u5B9E\u6A21\u578B\uFF0C\u7B49\u5F85\u6545\u4E8B\u5723\u7ECF\u9996\u6BB5\u54CD\u5E94\u3002", { modelName: config.provider.modelName });
    const raw = await generateAgentReply({
      roleName: "Story Bible Canon Editor",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "story_bible_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta;
        const now = Date.now();
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now;
          addEvent(run, "stream", "llm", `\u6A21\u578B\u6B63\u5728\u8F93\u51FA\u6545\u4E8B\u5723\u7ECF\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, { responseChars: run.rawResponse.length, tail: run.rawResponse.slice(-240) });
          await persistRun(run);
        }
      }
    });
    run.rawResponse = raw;
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}
`);
    run.artifacts.push("05-raw-response.txt");
    addEvent(run, "success", "llm", `\u6545\u4E8B\u5723\u7ECF\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${raw.length} \u5B57\u7B26\u3002`, { responseChars: raw.length });
    const parsed = parseDebugModelJsonObject(raw);
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
      run.artifacts.push("05b-repaired-response.txt");
      addEvent(run, "warning", "parse", `\u539F\u59CB\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON\uFF1B\u5DF2\u5B8C\u6210 ${parsed.repairs.length} \u5904\u7ED3\u6784\u4FEE\u590D\u5E76\u91CD\u65B0\u89E3\u6790\u3002`, { originalError: parsed.originalError, repairs: parsed.repairs });
    }
    let result = parsed.value;
    run.result = result;
    await fs.writeFile(path.join(runDir, "06-story-bible.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("06-story-bible.json");
    addEvent(run, "success", "parse", parsed.repairedText ? "\u4FEE\u590D\u540E\u7684\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u6545\u4E8B\u5723\u7ECF JSON\uFF1B\u539F\u59CB\u54CD\u5E94\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u539F\u59CB\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u6545\u4E8B\u5723\u7ECF JSON\u3002", { topLevelKeys: Object.keys(result), repaired: Boolean(parsed.repairedText) });
    run.validation = validateStoryBible(result, input);
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    if (!run.validation.valid) {
      const initialValidation = run.validation;
      const repairMessage = buildStoryBibleRepairMessage(input, result, initialValidation.errors);
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}
`);
      run.artifacts.push("08-repair-message.md");
      addEvent(run, "warning", "repair", `\u9996\u6B21\u7ED3\u6784\u6821\u9A8C\u53D1\u73B0 ${initialValidation.errors.length} \u4E2A\u9519\u8BEF\uFF0C\u542F\u52A8\u4E00\u6B21\u771F\u5B9E\u6A21\u578B\u5B9A\u5411\u4FEE\u590D\u3002`, { errors: initialValidation.errors, repairTemperature: Math.min(input.temperature, 0.15), repairMessageArtifact: "08-repair-message.md" });
      try {
        let repairRaw = "";
        let lastRepairStreamEventAt = 0;
        const repairedReply = await generateAgentReply({
          roleName: "Story Bible Repair Editor",
          basePrompt: "\u4F60\u662F\u6545\u4E8B\u5723\u7ECF JSON \u4FEE\u590D\u5668\u3002\u53EA\u4FEE\u590D\u7A0B\u5E8F\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4E0D\u91CD\u65B0\u89C4\u5212\u4E3B\u7EBF\uFF0C\u4E0D\u65B0\u589E\u4EBA\u7269\uFF0C\u4E0D\u751F\u6210\u5206\u5377\u3001\u9010\u7AE0\u84DD\u56FE\u6216\u6B63\u6587\u3002",
          dynamicPrompt: `\u51BB\u7ED3\u6765\u6E90\u5747\u5728\u4FEE\u590D\u6D88\u606F\u4E2D\u7ED9\u51FA\u3002\u4E0A\u6E38\u4E3B\u7EBF\u67B6\u6784 Run\uFF1A${input.upstreamRunId}`,
          consensus: `\u72EC\u7ACB\u8C03\u8BD5 Run: ${run.runId}
\u81EA\u52A8\u4FEE\u590D\u8F6E\uFF1A1/1`,
          message: repairMessage,
          currentStage: "story_bible_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.15),
          onDelta: async (delta) => {
            repairRaw += delta;
            run.rawResponse = repairRaw;
            const now = Date.now();
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now;
              addEvent(run, "stream", "repair", `\u6A21\u578B\u6B63\u5728\u5B9A\u5411\u4FEE\u590D\u6545\u4E8B\u5723\u7ECF\uFF0C\u5DF2\u63A5\u6536 ${repairRaw.length} \u5B57\u7B26\u3002`, { responseChars: repairRaw.length, tail: repairRaw.slice(-240) });
              await persistRun(run);
            }
          }
        });
        repairRaw = repairedReply;
        run.rawResponse = repairRaw;
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}
`);
        run.artifacts.push("09-repair-raw-response.txt");
        const repairedParsed = parseDebugModelJsonObject(repairRaw);
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}
`);
          run.artifacts.push("09b-repaired-json-text.txt");
        }
        result = repairedParsed.value;
        run.result = result;
        run.validation = validateStoryBible(result, input);
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-story-bible-repaired.json"), `${JSON.stringify(result, null, 2)}
`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}
`)
        ]);
        run.artifacts.push("10-story-bible-repaired.json", "11-validation-after-repair.json");
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid ? "\u5B9A\u5411\u4FEE\u590D\u54CD\u5E94\u5DF2\u901A\u8FC7\u6545\u4E8B\u5723\u7ECF\u7ED3\u6784\u6821\u9A8C\u3002" : `\u5B9A\u5411\u4FEE\u590D\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, { errors: run.validation.errors, warnings: run.validation.warnings, repairedResponseChars: repairRaw.length });
      } catch (repairError) {
        run.validation = initialValidation;
        addEvent(run, "error", "repair", `\u5B9A\u5411\u4FEE\u590D\u8C03\u7528\u5931\u8D25\uFF0C\u4FDD\u7559\u9996\u6B21\u6821\u9A8C\u7ED3\u679C\uFF1A${repairError instanceof Error ? repairError.message : String(repairError)}`);
      }
    }
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u6545\u4E8B\u5723\u7ECF\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, { errors: run.validation.errors, warnings: run.validation.warnings });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u6545\u4E8B\u5723\u7ECF\u9A8C\u8BC1\u901A\u8FC7\uFF1B\u4E16\u754C\u3001\u4EBA\u7269\u3001\u5173\u7CFB\u3001\u5F27\u7EBF\u3001\u672F\u8BED\u3001\u8FDE\u7EED\u6027\u548C\u627F\u8BFA\u6B63\u5178\u53EF\u4EA4\u7ED9\u5206\u5377\u7B56\u7565\u8282\u70B9\u3002", {
        characterCanonCount: Array.isArray(result.characterCanon) ? result.characterCanon.length : 0,
        relationshipCanonCount: Array.isArray(result.relationshipCanon) ? result.relationshipCanon.length : 0,
        arcCanonCount: Array.isArray(result.arcCanon) ? result.arcCanon.length : 0,
        continuityCanonCount: Array.isArray(result.continuityCanon) ? result.continuityCanon.length : 0,
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u6545\u4E8B\u5723\u7ECF\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
async function executeVolumeStrategyRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const arcIds = plotSourceNames(input.plotArchitecture, "arcArchitecture", "id");
  const characters = volumeStrategyCharacterNames(input.storyBible);
  const seeds = volumeStrategyPromiseSeeds(input.storyBible);
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u72EC\u7ACB\u6267\u884C\u5206\u5377\u7B56\u7565\u8282\u70B9\u3002", { runId: run.runId, isolated: true, productionPhase: "phase_8_volume_strategy" });
  addEvent(run, "success", "upstream", "\u5DF2\u4ECE\u670D\u52A1\u7AEF\u9501\u5B9A\u901A\u8FC7\u9A8C\u8BC1\u7684\u6545\u4E8B\u5723\u7ECF Run\u3002", {
    upstreamRunId: input.upstreamRunId,
    sourceArcCount: arcIds.length,
    frozenCharacterCount: characters.length,
    promiseCount: seeds.length,
    targetVolumeCount: input.targetVolumeCount
  });
  addEvent(run, "info", "boundary", "\u8282\u70B9\u8FB9\u754C\u5DF2\u51BB\u7ED3\uFF1A\u53EA\u751F\u6210\u5377\u7EA7\u7B56\u7565\uFF0C\u4E0D\u4FEE\u6539\u6545\u4E8B\u6B63\u5178\uFF0C\u4E0D\u751F\u6210\u9010\u7AE0\u84DD\u56FE\u3001\u7AE0\u8282\u8BA1\u5212\u6216\u6B63\u6587\u3002", {
    allowedPhase: "phase_8_volume_strategy",
    nextPhase: "phase_9_chapter_blueprints",
    forbiddenOutputs: ["chapterBlueprints", "chapters", "chapterPlans", "chapterDrafts", "prose"]
  });
  await fs.mkdir(runDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, strategyFocus: input.strategyFocus, targetVolumeCount: input.targetVolumeCount, totalChapters: input.totalChapters, temperature: input.temperature }, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01b-upstream-story-bible.json"), `${JSON.stringify(input.storyBible, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01c-upstream-plot-architecture.json"), `${JSON.stringify(input.plotArchitecture, null, 2)}
`)
  ]);
  run.artifacts.push("01-input.json", "01b-upstream-story-bible.json", "01c-upstream-plot-architecture.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    run.provider = { configId: config._configId, configName: config._configName || config.provider.modelName, baseUrl: config.provider.baseUrl, modelName: config.provider.modelName, apiMode: config.provider.apiMode, timeoutMs: config.provider.timeoutMs, temperature: input.temperature, apiKey: "[REDACTED]" };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    run.prompts = buildVolumeStrategyPrompts(input, run.runId);
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${run.prompts.systemPrompt}
`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${run.prompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${run.prompts.dynamicPrompt}
`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${run.prompts.userMessage}
`)
    ]);
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md");
    addEvent(run, "success", "prompt", "\u5206\u5377\u7B56\u7565\u5B9E\u9645\u8BF7\u6C42 Prompt \u5DF2\u51BB\u7ED3\u5230\u672C\u6B21 run\u3002", {
      basePromptChars: run.prompts.basePrompt.length,
      dynamicPromptChars: run.prompts.dynamicPrompt.length,
      userMessageChars: run.prompts.userMessage.length,
      systemPromptChars: run.prompts.systemPrompt.length,
      upstreamRunId: input.upstreamRunId,
      targetVolumeCount: input.targetVolumeCount
    });
    let lastStreamEventAt = 0;
    addEvent(run, "info", "llm", "\u8BF7\u6C42\u5DF2\u53D1\u9001\u7ED9\u771F\u5B9E\u6A21\u578B\uFF0C\u7B49\u5F85\u5206\u5377\u7B56\u7565\u9996\u6BB5\u54CD\u5E94\u3002", { modelName: config.provider.modelName });
    const raw = await generateAgentReply({
      roleName: "Volume Strategy Showrunner",
      basePrompt: run.prompts.basePrompt,
      dynamicPrompt: run.prompts.dynamicPrompt,
      consensus: run.prompts.consensus,
      message: run.prompts.userMessage,
      currentStage: "volume_strategy_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: debugProviderOverride(config),
      temperature: input.temperature,
      onDelta: async (delta) => {
        run.rawResponse += delta;
        const now = Date.now();
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now;
          addEvent(run, "stream", "llm", `\u6A21\u578B\u6B63\u5728\u8F93\u51FA\u5206\u5377\u7B56\u7565\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, { responseChars: run.rawResponse.length, tail: run.rawResponse.slice(-240) });
          await persistRun(run);
        }
      }
    });
    run.rawResponse = raw;
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}
`);
    run.artifacts.push("05-raw-response.txt");
    addEvent(run, "success", "llm", `\u5206\u5377\u7B56\u7565\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${raw.length} \u5B57\u7B26\u3002`, { responseChars: raw.length });
    const parsed = parseDebugModelJsonObject(raw);
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
      run.artifacts.push("05b-repaired-response.txt");
      addEvent(run, "warning", "parse", `\u539F\u59CB\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON\uFF1B\u5DF2\u5B8C\u6210 ${parsed.repairs.length} \u5904\u7ED3\u6784\u4FEE\u590D\u5E76\u91CD\u65B0\u89E3\u6790\u3002`, { originalError: parsed.originalError, repairs: parsed.repairs });
    }
    let result = parsed.value;
    run.result = result;
    await fs.writeFile(path.join(runDir, "06-volume-strategy.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("06-volume-strategy.json");
    addEvent(run, "success", "parse", parsed.repairedText ? "\u4FEE\u590D\u540E\u7684\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u5206\u5377\u7B56\u7565 JSON\uFF1B\u539F\u59CB\u54CD\u5E94\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u539F\u59CB\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u5206\u5377\u7B56\u7565 JSON\u3002", { topLevelKeys: Object.keys(result), repaired: Boolean(parsed.repairedText) });
    run.validation = validateVolumeStrategy(result, input);
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    if (!run.validation.valid) {
      const initialValidation = run.validation;
      const repairMessage = buildVolumeStrategyRepairMessage(input, result, initialValidation.errors);
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}
`);
      run.artifacts.push("08-repair-message.md");
      addEvent(run, "warning", "repair", `\u9996\u6B21\u7ED3\u6784\u6821\u9A8C\u53D1\u73B0 ${initialValidation.errors.length} \u4E2A\u9519\u8BEF\uFF0C\u542F\u52A8\u4E00\u6B21\u771F\u5B9E\u6A21\u578B\u5B9A\u5411\u4FEE\u590D\u3002`, { errors: initialValidation.errors, repairTemperature: Math.min(input.temperature, 0.15), repairMessageArtifact: "08-repair-message.md" });
      try {
        let repairRaw = "";
        let lastRepairStreamEventAt = 0;
        const repairedReply = await generateAgentReply({
          roleName: "Volume Strategy Repair Showrunner",
          basePrompt: "\u4F60\u662F\u5206\u5377\u7B56\u7565 JSON \u4FEE\u590D\u5668\u3002\u53EA\u4FEE\u590D\u7A0B\u5E8F\u5217\u51FA\u7684\u9519\u8BEF\uFF0C\u4E0D\u4FEE\u6539\u6545\u4E8B\u6B63\u5178\uFF0C\u4E0D\u751F\u6210\u9010\u7AE0\u84DD\u56FE\u3001\u7AE0\u8282\u8BA1\u5212\u6216\u6B63\u6587\u3002",
          dynamicPrompt: `\u51BB\u7ED3\u6765\u6E90\u5747\u5728\u4FEE\u590D\u6D88\u606F\u4E2D\u7ED9\u51FA\u3002\u4E0A\u6E38\u6545\u4E8B\u5723\u7ECF Run\uFF1A${input.upstreamRunId}`,
          consensus: `\u72EC\u7ACB\u8C03\u8BD5 Run: ${run.runId}
\u81EA\u52A8\u4FEE\u590D\u8F6E\uFF1A1/1`,
          message: repairMessage,
          currentStage: "volume_strategy_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: debugProviderOverride(config),
          temperature: Math.min(input.temperature, 0.15),
          onDelta: async (delta) => {
            repairRaw += delta;
            run.rawResponse = repairRaw;
            const now = Date.now();
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now;
              addEvent(run, "stream", "repair", `\u6A21\u578B\u6B63\u5728\u5B9A\u5411\u4FEE\u590D\u5206\u5377\u7B56\u7565\uFF0C\u5DF2\u63A5\u6536 ${repairRaw.length} \u5B57\u7B26\u3002`, { responseChars: repairRaw.length, tail: repairRaw.slice(-240) });
              await persistRun(run);
            }
          }
        });
        repairRaw = repairedReply;
        run.rawResponse = repairRaw;
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}
`);
        run.artifacts.push("09-repair-raw-response.txt");
        const repairedParsed = parseDebugModelJsonObject(repairRaw);
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}
`);
          run.artifacts.push("09b-repaired-json-text.txt");
        }
        result = repairedParsed.value;
        run.result = result;
        run.validation = validateVolumeStrategy(result, input);
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-volume-strategy-repaired.json"), `${JSON.stringify(result, null, 2)}
`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(run.validation, null, 2)}
`)
        ]);
        run.artifacts.push("10-volume-strategy-repaired.json", "11-validation-after-repair.json");
        addEvent(run, run.validation.valid ? "success" : "error", "repair", run.validation.valid ? "\u5B9A\u5411\u4FEE\u590D\u54CD\u5E94\u5DF2\u901A\u8FC7\u5206\u5377\u7B56\u7565\u7ED3\u6784\u6821\u9A8C\u3002" : `\u5B9A\u5411\u4FEE\u590D\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, { errors: run.validation.errors, warnings: run.validation.warnings, repairedResponseChars: repairRaw.length });
      } catch (repairError) {
        run.validation = initialValidation;
        addEvent(run, "error", "repair", `\u5B9A\u5411\u4FEE\u590D\u8C03\u7528\u5931\u8D25\uFF0C\u4FDD\u7559\u9996\u6B21\u6821\u9A8C\u7ED3\u679C\uFF1A${repairError instanceof Error ? repairError.message : String(repairError)}`);
      }
    }
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u5206\u5377\u7B56\u7565\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, { errors: run.validation.errors, warnings: run.validation.warnings });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u5206\u5377\u7B56\u7565\u9A8C\u8BC1\u901A\u8FC7\uFF1B\u5377\u7EA7\u7AE0\u8282\u8303\u56F4\u3001\u4E3B\u7EBF\u5F27\u3001\u4EBA\u7269\u8986\u76D6\u548C\u4F0F\u7B14\u6392\u671F\u53EF\u4EA4\u7ED9\u9010\u7AE0\u84DD\u56FE\u8282\u70B9\u3002", {
        volumeCount: Array.isArray(result.volumes) ? result.volumes.length : 0,
        arcCoverageCount: Array.isArray(result.arcCoverage) ? result.arcCoverage.length : 0,
        characterCoverageCount: Array.isArray(result.characterCoverage) ? result.characterCoverage.length : 0,
        promiseScheduleCount: Array.isArray(result.promiseSchedule) ? result.promiseSchedule.length : 0,
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u5206\u5377\u7B56\u7565\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
function chapterBlueprintStateSnapshotFromRun(run) {
  if (run.nodeId !== "chapter-blueprints" || run.status !== "completed" || run.validation?.valid !== true || !run.result) return null;
  const input = run.input;
  const blueprints = Array.isArray(run.result.blueprints) ? run.result.blueprints : [];
  const finalBlueprint = blueprints.find((entry) => Number(entry.chapterNumber) === input.endChapter) || blueprints.at(-1) || {};
  const handoff = run.result.handoffToWritingPlan && typeof run.result.handoffToWritingPlan === "object" && !Array.isArray(run.result.handoffToWritingPlan) ? run.result.handoffToWritingPlan : {};
  return {
    runId: run.runId,
    volumeId: input.volumeId,
    startChapter: input.startChapter,
    endChapter: input.endChapter,
    batchExitState: String(handoff.batchExitState || handoff.batchExitPressure || "").trim(),
    unresolvedRisks: volumeStrategyStringValues(handoff.unresolvedRisks),
    endingHook: String(finalBlueprint.endingHook || finalBlueprint.nextPressure || "").trim(),
    nextChapterEntryState: String(finalBlueprint.nextChapterEntryState || finalBlueprint.nextPressure || "").trim(),
    nextChapterHandoff: String(finalBlueprint.nextChapterHandoff || finalBlueprint.nextPressure || "").trim()
  };
}
function styleProfileBlueprints(input) {
  return Array.isArray(input.chapterBlueprints.blueprints) ? input.chapterBlueprints.blueprints : [];
}
function splitStyleHumanBaselineSamples(text) {
  const normalized = String(text || "").replace(/\r\n?/gu, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}|-{3,}|={3,}/u).map((entry) => entry.replace(/\s+/gu, " ").trim()).filter((entry) => entry.length >= 80);
  if (paragraphs.length) return paragraphs.slice(0, 8);
  return normalized.length >= 80 ? [normalized.slice(0, 2e3)] : [];
}
function splitAigcLabTextIntoSentenceSegments(text, options = {}) {
  const normalized = String(text || "").replace(/\r\n?/gu, "\n");
  const granularity = String(options.granularity || "sentence").trim();
  const minSegmentChars = Math.max(1, Math.min(500, Number(options.minSegmentChars || 1)));
  if (granularity === "paragraph" || granularity === "detector_default") {
    const paragraphPattern = /[^\n]+(?:\n(?!\n)[^\n]+)*/gu;
    const paragraphSegments = [];
    for (const match of normalized.matchAll(paragraphPattern)) {
      const raw = match[0] || "";
      const trimmed = raw.trim();
      if (trimmed.length < 2) continue;
      const rawStart = match.index || 0;
      const leadingWhitespace = raw.match(/^\s*/u)?.[0]?.length || 0;
      const startOffset = rawStart + leadingWhitespace;
      for (let offset = 0; offset < trimmed.length; offset += 900) {
        const chunk = trimmed.slice(offset, offset + 900).trim();
        if (chunk.length < 2) continue;
        paragraphSegments.push({
          id: `paragraph-${paragraphSegments.length + 1}`,
          index: paragraphSegments.length,
          text: chunk,
          startOffset: startOffset + offset,
          endOffset: startOffset + offset + chunk.length,
          metadata: { unit: granularity === "detector_default" ? "detector-like-paragraph" : "paragraph" }
        });
      }
    }
    return paragraphSegments;
  }
  const segments = [];
  const sentencePieces = [];
  const sentencePattern = /[^\n。！？!?；;]+[。！？!?；;]?|[^\n]+/gu;
  for (const match of normalized.matchAll(sentencePattern)) {
    const raw = match[0] || "";
    const trimmed = raw.trim();
    if (trimmed.length < 2) continue;
    const rawStart = match.index || 0;
    const leadingWhitespace = raw.match(/^\s*/u)?.[0]?.length || 0;
    const startOffset = rawStart + leadingWhitespace;
    const endOffset = startOffset + trimmed.length;
    if (trimmed.length <= 480) {
      sentencePieces.push({
        text: trimmed,
        startOffset,
        endOffset,
        metadata: { unit: "sentence" }
      });
      continue;
    }
    for (let offset = 0; offset < trimmed.length; offset += 420) {
      const chunk = trimmed.slice(offset, offset + 420).trim();
      if (chunk.length < 2) continue;
      sentencePieces.push({
        text: chunk,
        startOffset: startOffset + offset,
        endOffset: startOffset + offset + chunk.length,
        metadata: { unit: "sentence-chunk" }
      });
    }
  }
  if (granularity === "merged_sentence") {
    let pending = null;
    for (const piece of sentencePieces) {
      if (!pending) {
        pending = { ...piece, metadata: { unit: "merged-sentence" } };
        continue;
      }
      const joined = `${pending.text}${piece.text.startsWith("\u300D") ? "" : "\n"}${piece.text}`;
      if (pending.text.length < minSegmentChars && joined.length <= 900) {
        pending = {
          text: joined,
          startOffset: pending.startOffset,
          endOffset: piece.endOffset,
          metadata: { unit: "merged-sentence" }
        };
      } else {
        segments.push({ ...pending, id: `segment-${segments.length + 1}`, index: segments.length });
        pending = { ...piece, metadata: { unit: "merged-sentence" } };
      }
    }
    if (pending) segments.push({ ...pending, id: `segment-${segments.length + 1}`, index: segments.length });
    return segments;
  }
  for (const piece of sentencePieces) {
    segments.push({ ...piece, id: `sentence-${segments.length + 1}`, index: segments.length });
  }
  return segments;
}
function explainAigcLabLocalSignals(text) {
  const signals = [];
  if (/裂缝|天壁|护山大阵|灵压|威压|墟劫|追杀令|倒计时|修复进度/u.test(text)) {
    signals.push("\u5B8F\u5927\u8BBE\u5B9A/\u5371\u673A\u8BCD\u96C6\u4E2D\uFF0C\u5BB9\u6613\u5F62\u6210 AI \u5F0F\u8BF4\u660E\u611F");
  }
  if (/每息|三寸|两尺|百分|%|进度|频率|脉冲|阈值|倒计时|\d+(?:天|年|月|日|息|寸|尺|%)/u.test(text)) {
    signals.push("\u6570\u5B57\u3001\u53C2\u6570\u6216\u7CFB\u7EDF\u8D26\u672C\u4FE1\u606F\u504F\u5BC6");
  }
  if (/脊背|肩胛|瞳孔|指节|肌肉|呼吸|额角|喉结|骤然|缓慢|簌簌|薄雾/u.test(text)) {
    signals.push("\u8EAB\u4F53\u53CD\u5E94/\u955C\u5934\u8BCD\u504F\u5DE5\u6574\uFF0C\u53EF\u80FD\u50CF\u7CBE\u4FEE\u6A21\u677F");
  }
  if (/意味着|由此可见|这说明|局势|风险升级|形成.*(?:压力|闭环)|命运|真相/u.test(text)) {
    signals.push("\u603B\u7ED3\u8154\u6216\u89E3\u91CA\u8154\u8F83\u660E\u663E");
  }
  if (/复杂的情绪|无法形容|十分震惊|内心.*(?:震动|复杂)|某种意义上/u.test(text)) {
    signals.push("\u62BD\u8C61\u60C5\u7EEA\u8BCD\u504F\u591A\uFF0C\u7F3A\u5C11\u5177\u4F53\u52A8\u4F5C\u66FF\u4EE3");
  }
  if (/^[「“][^」”]{1,30}[」”]/u.test(text)) {
    signals.push("\u77ED\u5BF9\u8BDD\u5F00\u5934\uFF1A\u901A\u5E38\u66F4\u63A5\u8FD1\u771F\u4EBA\u6587\u672C\u4FE1\u53F7");
  }
  return signals;
}
function aigcLabRiskLevel(score, threshold) {
  if (score === null) return "unknown";
  if (score >= threshold) return "high";
  if (score >= Math.max(0, threshold - 0.2)) return "medium";
  if (score <= 1 - threshold) return "low";
  return "watch";
}
function aigcLabPassDecision(input) {
  const overallBlocked = typeof input.score === "number" && input.score >= input.threshold;
  const policy = String(input.policy || "strict_any_sentence");
  if (policy === "overall_only") {
    return {
      passed: !overallBlocked,
      policy,
      reason: overallBlocked ? "\u6574\u4F53 AI \u5206\u8FBE\u5230\u9608\u503C\u3002" : "\u4EC5\u6309\u6574\u4F53 AI \u5206\u5224\u65AD\u901A\u8FC7\uFF1B\u9AD8\u98CE\u9669\u53E5\u4FDD\u7559\u4E3A\u63D0\u9192\u3002"
    };
  }
  if (policy === "balanced") {
    const highRiskLimit = input.totalSentences <= 3 ? 2 : 3;
    const segmentBlocked = input.highRiskCount >= highRiskLimit;
    return {
      passed: !overallBlocked && !segmentBlocked,
      policy,
      reason: overallBlocked ? "\u6574\u4F53 AI \u5206\u8FBE\u5230\u9608\u503C\u3002" : segmentBlocked ? `\u9AD8\u98CE\u9669\u53E5\u8FBE\u5230 ${input.highRiskCount}/${highRiskLimit}\uFF0C\u8D85\u8FC7\u5E73\u8861\u7B56\u7565\u5BB9\u5FCD\u5EA6\u3002` : `\u5E73\u8861\u7B56\u7565\u901A\u8FC7\uFF1A\u6574\u4F53\u5206\u672A\u8FBE\u9608\u503C\uFF0C\u4E14\u9AD8\u98CE\u9669\u53E5\u5C11\u4E8E ${highRiskLimit} \u4E2A\uFF1B\u9AD8\u98CE\u9669\u53E5\u53EA\u4F5C\u4E3A\u5C40\u90E8\u4FEE\u6539\u5EFA\u8BAE\u3002`
    };
  }
  return {
    passed: input.highRiskCount === 0 && !overallBlocked,
    policy: "strict_any_sentence",
    reason: input.highRiskCount > 0 ? "\u4E25\u683C\u7B56\u7565\uFF1A\u4EFB\u4E00\u53E5/\u77ED\u6BB5\u8FBE\u5230\u9608\u503C\u5373\u5224\u4E3A\u672A\u901A\u8FC7\u3002" : overallBlocked ? "\u6574\u4F53 AI \u5206\u8FBE\u5230\u9608\u503C\u3002" : "\u4E25\u683C\u7B56\u7565\u901A\u8FC7\uFF1A\u6574\u4F53\u5206\u548C\u6240\u6709\u53E5\u5B50\u5747\u4F4E\u4E8E\u9608\u503C\u3002"
  };
}
async function listStyleProfileDebugRuns() {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => []);
  const candidates = await Promise.all(entries.filter((entry) => entry.isDirectory() && (entry.name.startsWith("sp_") || entry.name.startsWith("ac_"))).map((entry) => loadRun(entry.name)));
  return candidates.filter((run) => Boolean(run && run.nodeId === "style-profile")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function styleCalibrationSampleFromRun(run, group, limit) {
  const result = run.result && typeof run.result === "object" && !Array.isArray(run.result) ? run.result : {};
  const samples = [];
  if (group === "approved_style_candidate") {
    const selected = result.selectedCandidate && typeof result.selectedCandidate === "object" && !Array.isArray(result.selectedCandidate) ? result.selectedCandidate : {};
    const evaluation = selected.evaluation && typeof selected.evaluation === "object" && !Array.isArray(selected.evaluation) ? selected.evaluation : {};
    const aigc = evaluation.aigc && typeof evaluation.aigc === "object" && !Array.isArray(evaluation.aigc) ? evaluation.aigc : {};
    const text = String(selected.sample || "").trim();
    if (text.length >= 80 && aigc.status === "passed") {
      samples.push({ group, label: `\u5DF2\u901A\u8FC7\u6587\u98CE\u5019\u9009 \xB7 ${run.runId}`, text, sourceRunId: run.runId, round: Number(selected.round || 0) || void 0 });
    }
    return samples.slice(0, limit);
  }
  const iterations = Array.isArray(result.iterations) ? result.iterations : [];
  for (const iteration of [...iterations].reverse()) {
    const evaluation = iteration.evaluation && typeof iteration.evaluation === "object" && !Array.isArray(iteration.evaluation) ? iteration.evaluation : {};
    const aigc = evaluation.aigc && typeof evaluation.aigc === "object" && !Array.isArray(evaluation.aigc) ? evaluation.aigc : {};
    const text = String(iteration.sample || "").trim();
    if (text.length >= 80 && (aigc.status === "blocked" || Number(aigc.highRiskCount || 0) > 0)) {
      samples.push({ group, label: `\u8FD1\u671F\u5931\u8D25\u6837\u6BB5 \xB7 ${run.runId}`, text, sourceRunId: run.runId, round: Number(iteration.round || 0) || void 0 });
    }
    if (samples.length >= limit) break;
  }
  return samples;
}
async function aggregateCompletedChapterBlueprintsForStyle(seedRun) {
  const seedInput = seedRun.input;
  const runs2 = await listChapterBlueprintRuns({ upstreamRunId: seedInput.upstreamRunId });
  const completed = runs2.filter((run) => run.status === "completed" && run.validation?.valid === true && run.result).sort((a, b) => {
    const left = a.input;
    const right = b.input;
    return left.startChapter - right.startChapter || left.endChapter - right.endChapter;
  });
  const blueprintsByChapter = /* @__PURE__ */ new Map();
  for (const run of completed) {
    const blueprints2 = Array.isArray(run.result?.blueprints) ? run.result.blueprints : [];
    for (const blueprint of blueprints2) {
      const chapterNumber = Number(blueprint.chapterNumber);
      if (Number.isInteger(chapterNumber) && chapterNumber >= 1) blueprintsByChapter.set(chapterNumber, blueprint);
    }
  }
  const blueprints = [...blueprintsByChapter.entries()].sort((a, b) => a[0] - b[0]).map(([, blueprint]) => blueprint);
  if (!blueprints.length) throw new Error("completed_chapter_blueprints_empty");
  const firstChapter = Number(blueprints[0]?.chapterNumber || 1);
  const lastChapter = Number(blueprints.at(-1)?.chapterNumber || firstChapter);
  const aggregate = {
    version: 1,
    mode: "aggregated_completed_chapter_blueprints",
    source: {
      volumeStrategyRunId: seedInput.upstreamRunId,
      seedChapterBlueprintRunId: seedRun.runId,
      chapterBlueprintRunIds: completed.map((run) => run.runId),
      firstChapter,
      lastChapter,
      blueprintCount: blueprints.length
    },
    blueprints,
    handoffToWritingPlan: seedRun.result?.handoffToWritingPlan || null
  };
  return { aggregate, completedRuns: completed, firstChapter, lastChapter, blueprintCount: blueprints.length };
}
function validateStyleProfile(result, input) {
  const errors = [];
  const warnings = [];
  if (String(result.mode || "") === "style_evolution_debug_loop") {
    const iterations = Array.isArray(result.iterations) ? result.iterations.filter((entry) => Boolean(entry && typeof entry === "object" && !Array.isArray(entry))) : [];
    const selectedCandidate = result.selectedCandidate && typeof result.selectedCandidate === "object" && !Array.isArray(result.selectedCandidate) ? result.selectedCandidate : {};
    const evaluation = selectedCandidate.evaluation && typeof selectedCandidate.evaluation === "object" && !Array.isArray(selectedCandidate.evaluation) ? selectedCandidate.evaluation : {};
    const aigc = evaluation.aigc && typeof evaluation.aigc === "object" && !Array.isArray(evaluation.aigc) ? evaluation.aigc : {};
    const verification = selectedCandidate.verification && typeof selectedCandidate.verification === "object" && !Array.isArray(selectedCandidate.verification) ? selectedCandidate.verification : {};
    const verdict = String(evaluation.verdict || "");
    const aigcStatus = String(aigc.status || "");
    const verificationStatus = String(verification.status || "");
    const sample = String(selectedCandidate.sample || "").trim();
    if (!iterations.length) errors.push("style evolution loop \u81F3\u5C11\u9700\u8981 1 \u8F6E\u8FED\u4EE3\u8BB0\u5F55\u3002");
    if (!sample) errors.push("selectedCandidate.sample \u4E0D\u80FD\u4E3A\u7A7A\u3002");
    if (sample && sample.length < 450) errors.push(`\u5F53\u524D\u6587\u98CE\u6837\u6BB5\u53EA\u6709 ${sample.length} \u5B57\u7B26\uFF0C\u4F4E\u4E8E 450 \u5B57\u4E0B\u9650\uFF1B\u5FC5\u987B\u91CD\u65B0\u8FED\u4EE3\u3002`);
    if (sample && !/[。！？!?」』”’）)\]》】"']$/u.test(sample)) errors.push("selectedCandidate.sample \u7591\u4F3C\u88AB\u622A\u65AD\uFF1A\u672B\u5C3E\u4E0D\u662F\u5B8C\u6574\u53E5\u8BFB\u6216\u95ED\u5408\u7B26\u53F7\u3002");
    if (verdict !== "candidate" && verdict !== "approve") errors.push(`selectedCandidate.evaluation.verdict \u5FC5\u987B\u4E3A candidate \u6216 approve\uFF0C\u5F53\u524D\u4E3A ${verdict || "\u7A7A"}\u3002`);
    if (!aigcStatus) errors.push("selectedCandidate.evaluation.aigc \u7F3A\u5C11 AIGC \u68C0\u6D4B\u7ED3\u679C\u3002");
    if (aigcStatus && aigcStatus !== "passed") errors.push(`selectedCandidate.evaluation.aigc.status \u5FC5\u987B\u4E3A passed\uFF0C\u5F53\u524D\u4E3A ${aigcStatus}\u3002`);
    if (!verificationStatus) errors.push("selectedCandidate.verification \u7F3A\u5C11 Generation Verification Gate \u7ED3\u679C\u3002");
    if (verificationStatus && verificationStatus !== "passed") errors.push(`selectedCandidate.verification.status \u5FC5\u987B\u4E3A passed\uFF0C\u5F53\u524D\u4E3A ${verificationStatus}\uFF1BAIGC / \u7981\u5FCC / \u5B8C\u6574\u6027\u95E8\u7981\u672A\u8FC7\u4E0D\u80FD\u653E\u884C\u3002`);
    if (verdict === "candidate") warnings.push("\u5F53\u524D\u53EA\u662F candidate\uFF0C\u4E0D\u662F approve\uFF1B\u53EF\u4EE5\u4EBA\u5DE5\u67E5\u770B\u6837\u6BB5\uFF0C\u6216\u589E\u52A0\u8FED\u4EE3\u8F6E\u6570\u7EE7\u7EED\u7CBE\u4FEE\u3002");
    if (Number(result.maxRounds || input.maxRounds) <= iterations.length && verdict !== "approve") warnings.push("\u5DF2\u8FBE\u5230\u672C\u6B21\u6700\u5927\u8FED\u4EE3\u8F6E\u6570\uFF1B\u867D\u7136\u5F97\u5230 candidate\uFF0C\u4F46\u8FD8\u4E0D\u662F approve\uFF0C\u53EF\u7EE7\u7EED\u52A0\u8F6E\u6570\u7CBE\u4FEE\u3002");
    if (Number(selectedCandidate.sampleChapter) !== input.sampleChapter) errors.push(`selectedCandidate.sampleChapter \u5FC5\u987B\u7B49\u4E8E ${input.sampleChapter}\u3002`);
    return { valid: errors.length === 0, errors, warnings };
  }
  const recordArray = (value) => Array.isArray(value) ? value.filter((entry) => Boolean(entry && typeof entry === "object" && !Array.isArray(entry))) : [];
  const requireObject = (value, label) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      errors.push(`${label} \u5FC5\u987B\u662F\u5BF9\u8C61\u3002`);
      return {};
    }
    return value;
  };
  const requireText = (entry, keys, label) => {
    for (const key of keys) if (!String(entry[key] || "").trim()) errors.push(`${label}.${key} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
  };
  const source = requireObject(result.source, "source");
  if (String(source.chapterBlueprintRunId || "").trim() !== input.upstreamRunId) errors.push("source.chapterBlueprintRunId \u5FC5\u987B\u7B49\u4E8E\u4E0A\u6E38\u7AE0\u8282\u84DD\u56FE Run ID\u3002");
  if (String(source.phase || "").trim() !== "phase_9_chapter_blueprints") errors.push("source.phase \u5FC5\u987B\u662F phase_9_chapter_blueprints\u3002");
  if (Number(source.sampleChapter) !== input.sampleChapter) errors.push(`source.sampleChapter \u5FC5\u987B\u7B49\u4E8E ${input.sampleChapter}\u3002`);
  const blueprintChapters = Array.isArray(source.blueprintChapters) ? source.blueprintChapters.map(Number).filter(Number.isInteger) : [];
  const expectedChapters = styleProfileBlueprints(input).map((entry) => Number(entry.chapterNumber)).filter(Number.isInteger);
  for (const chapter of expectedChapters) if (!blueprintChapters.includes(chapter)) errors.push(`source.blueprintChapters \u7F3A\u5C11\u7B2C ${chapter} \u7AE0\u3002`);
  requireText(requireObject(result.stylePrinciples, "stylePrinciples"), ["narrativePOV", "tenseAndDistance", "proseDensity", "pacingModel", "emotionalTemperature", "readerExperienceTarget"], "stylePrinciples");
  const chapterRules = recordArray(result.chapterWritingRules);
  const sceneRules = recordArray(result.sceneRules);
  const dialogueRules = recordArray(result.dialogueRules);
  const canonRules = recordArray(result.canonHandlingRules);
  const antiPatterns = recordArray(result.antiPatterns);
  if (chapterRules.length < 6) errors.push("chapterWritingRules \u81F3\u5C11\u9700\u8981 6 \u6761\u3002");
  if (sceneRules.length < 4) errors.push("sceneRules \u81F3\u5C11\u9700\u8981 4 \u6761\u3002");
  if (dialogueRules.length < 3) errors.push("dialogueRules \u81F3\u5C11\u9700\u8981 3 \u6761\u3002");
  if (canonRules.length < 3) errors.push("canonHandlingRules \u81F3\u5C11\u9700\u8981 3 \u6761\u3002");
  if (antiPatterns.length < 6) errors.push("antiPatterns \u81F3\u5C11\u9700\u8981 6 \u6761\u3002");
  chapterRules.forEach((entry, index) => requireText(entry, ["name", "instruction", "successSignal", "forbiddenDrift"], `chapterWritingRules[${index}]`));
  sceneRules.forEach((entry, index) => requireText(entry, ["name", "instruction"], `sceneRules[${index}]`));
  dialogueRules.forEach((entry, index) => requireText(entry, ["name", "instruction", "badExamplePattern", "repairRule"], `dialogueRules[${index}]`));
  canonRules.forEach((entry, index) => requireText(entry, ["name", "instruction"], `canonHandlingRules[${index}]`));
  antiPatterns.forEach((entry, index) => requireText(entry, ["name", "whyBad", "detectionSignal", "repairRule"], `antiPatterns[${index}]`));
  requireText(requireObject(result.singleChapterDraftContract, "singleChapterDraftContract"), ["outputBoundary"], "singleChapterDraftContract");
  const selfCheck = requireObject(result.qualitySelfCheck, "qualitySelfCheck");
  for (const key of ["noProseGenerated", "noCanonMutation", "blueprintsInherited", "rulesAreActionable"]) if (selfCheck[key] !== true) errors.push(`qualitySelfCheck.${key} \u5FC5\u987B\u4E3A true\u3002`);
  const serialized = JSON.stringify(result);
  if (/"(?:chapterDrafts|prose|draftText|chapters)"\s*:/u.test(serialized)) errors.push("\u98CE\u683C\u8282\u70B9\u7981\u6B62\u8F93\u51FA\u7AE0\u8282\u6B63\u6587\u3001\u7AE0\u8282\u8349\u7A3F\u6216\u7AE0\u8282\u5217\u8868\u3002");
  if (/“[^”]{20,}”|他说|她说|陆无良[^。！？]{20,}[。！？]/u.test(serialized)) warnings.push("\u7ED3\u679C\u4E2D\u7591\u4F3C\u51FA\u73B0\u6B63\u6587\u5F0F\u53E5\u5B50\uFF1B\u8BF7\u786E\u8BA4\u8FD9\u53EA\u662F\u89C4\u5219\u8BF4\u660E\uFF0C\u4E0D\u662F\u7AE0\u8282\u5185\u5BB9\u3002");
  return { valid: errors.length === 0, errors, warnings };
}
function styleDebugText(value, fallback = "") {
  return String(value ?? fallback).trim();
}
function styleEvolutionSampleBlueprint(input) {
  const blueprints = styleProfileBlueprints(input);
  return blueprints.find((entry) => Number(entry.chapterNumber) === input.sampleChapter) || blueprints[0] || {};
}
function styleEvolutionProjectContext(input) {
  const project = input.storyBible.project && typeof input.storyBible.project === "object" && !Array.isArray(input.storyBible.project) ? input.storyBible.project : {};
  const worldProject = input.worldFoundation.project && typeof input.worldFoundation.project === "object" && !Array.isArray(input.worldFoundation.project) ? input.worldFoundation.project : {};
  const sampleBlueprint = styleEvolutionSampleBlueprint(input);
  const title = styleDebugText(project.title || worldProject.title || input.worldFoundation.title, "\u672A\u547D\u540D\u5C0F\u8BF4");
  const idea = [
    styleDebugText(project.coreIdea || worldProject.coreIdea || input.worldFoundation.coreIdea),
    `\u5F53\u524D\u6837\u4F8B\u7AE0\u8282\uFF1A\u7B2C ${Number(sampleBlueprint.chapterNumber || input.sampleChapter)} \u7AE0\u300A${styleDebugText(sampleBlueprint.title, "\u672A\u547D\u540D\u7AE0\u8282")}\u300B`,
    styleDebugText(sampleBlueprint.chapterGoal) ? `\u7AE0\u8282\u76EE\u6807\uFF1A${styleDebugText(sampleBlueprint.chapterGoal)}` : "",
    styleDebugText(sampleBlueprint.protagonistDecision) ? `\u4E3B\u89D2\u51B3\u5B9A\uFF1A${styleDebugText(sampleBlueprint.protagonistDecision)}` : "",
    styleDebugText(sampleBlueprint.irreversibleChange) ? `\u4E0D\u53EF\u9006\u53D8\u5316\uFF1A${styleDebugText(sampleBlueprint.irreversibleChange)}` : "",
    styleDebugText(sampleBlueprint.nextPressure) ? `\u4EA4\u63A5\u538B\u529B\uFF1A${styleDebugText(sampleBlueprint.nextPressure)}` : ""
  ].filter(Boolean).join("\n");
  const referenceText = [
    "\u6837\u4F8B\u7AE0\u8282\u84DD\u56FE\uFF08\u53EA\u7528\u4E8E\u6821\u51C6\u53D9\u8FF0\u58F0\u97F3\uFF0C\u4E0D\u4EE3\u8868\u6B63\u5F0F\u751F\u6210\u8BE5\u7AE0\u6B63\u6587\uFF09\uFF1A",
    JSON.stringify(sampleBlueprint, null, 2)
  ].join("\n");
  const desiredVibes = [
    "\u5267\u60C5\u63A8\u8FDB\u6E05\u6670",
    "\u4EBA\u7269\u52A8\u4F5C\u5148\u4E8E\u89E3\u91CA",
    "\u5BF9\u767D\u670D\u52A1\u5173\u7CFB\u538B\u529B",
    "\u4FEE\u4ED9/\u7384\u5E7B\u8BBE\u5B9A\u4F7F\u7528\u786E\u5B9A\u503C",
    "\u6587\u98CE\u7A33\u5B9A\u3001\u53EF\u590D\u5236\u5230\u957F\u7BC7\u8FDE\u8F7D"
  ];
  const seedForbiddenPatterns = [
    "\u4E0D\u5F97\u628A\u6587\u98CE\u6837\u6BB5\u5F53\u4F5C\u6B63\u5F0F\u7AE0\u8282\u5165\u5E93",
    "\u4E0D\u5F97\u4FEE\u6539\u5DF2\u51BB\u7ED3\u7684\u6280\u80FD\u3001\u7269\u54C1\u3001\u6570\u5B57\u3001\u5012\u8BA1\u65F6\u3001\u4EE3\u4EF7\u548C\u5730\u70B9\u8FB9\u754C",
    "\u4E0D\u5F97\u8D8A\u8FC7\u7AE0\u8282\u84DD\u56FE\u5199\u672A\u6765\u5F27\u7EBF\u7ED3\u679C",
    "\u4E0D\u5F97\u7528\u534E\u4E3D\u8F9E\u85FB\u66FF\u4EE3\u5177\u4F53\u52A8\u4F5C\u3001\u51B3\u5B9A\u548C\u56E0\u679C\u4EA4\u63A5",
    "\u4E0D\u5F97\u8F93\u51FA\u5199\u4F5C\u8BA1\u5212\u3001\u5217\u8868\u3001\u6807\u9898\u6216\u81EA\u6211\u89E3\u91CA\u4F5C\u4E3A\u5019\u9009\u6837\u6BB5"
  ];
  const seedPrompt = [
    "\u8FD9\u662F\u4E00\u8F6E\u6587\u98CE\u81EA\u8FDB\u5316\u8C03\u8BD5\uFF0C\u4E0D\u662F\u6B63\u5F0F\u7AE0\u8282\u521B\u4F5C\u3002",
    "\u6837\u6BB5\u5FC5\u987B\u670D\u52A1\u4E8E\u6574\u672C\u4E66\u540E\u7EED\u6B63\u6587\u751F\u6210\u7684\u57FA\u7840\u58F0\u97F3\u6D4B\u8BD5\uFF1A\u89C6\u89D2\u3001\u8282\u594F\u3001\u5BF9\u767D\u3001\u63CF\u5199\u5BC6\u5EA6\u3001\u4FE1\u606F\u4EA4\u63A5\u3002",
    "\u6837\u6BB5\u53EF\u4EE5\u501F\u7528\u6837\u4F8B\u7AE0\u8282\u84DD\u56FE\u7684\u5904\u5883\uFF0C\u4F46\u4E0D\u80FD\u6539\u53D8\u6B63\u5178\u4E8B\u5B9E\uFF0C\u4E5F\u4E0D\u80FD\u751F\u6210\u4F1A\u88AB\u5F53\u6210\u6B63\u5F0F\u7AE0\u8282\u7684\u5185\u5BB9\u3002",
    input.styleFocus ? `\u7528\u6237\u672C\u8F6E\u5173\u6CE8\uFF1A${input.styleFocus}` : ""
  ].filter(Boolean).join("\n");
  return { title, idea, referenceText, desiredVibes, seedForbiddenPatterns, seedPrompt, sampleBlueprint };
}
function uniqueStyleRules(items, limit = 24) {
  const seen = /* @__PURE__ */ new Set();
  const rules = [];
  for (const item of items) {
    const text = String(item ?? "").replace(/\s+/gu, " ").trim();
    if (!text || text.length < 3 || seen.has(text)) continue;
    seen.add(text);
    rules.push(text);
    if (rules.length >= limit) break;
  }
  return rules;
}
function extractStyleFocusRules(styleFocus) {
  const fragments = String(styleFocus || "").split(/[\n\r；;。.!！?？]+/u).map((item) => item.replace(/^[\s\-*、，,]+/u, "").replace(/[\s\-*、，,]+$/u, "").trim()).filter(Boolean);
  return uniqueStyleRules(fragments.length ? fragments : [styleFocus], 18);
}
function styleStringArray(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return uniqueStyleRules(value, limit);
}
function buildFrozenStyleContractFromDebugRun(input, selected, result) {
  const sample = styleDebugText(selected.sample);
  const evaluation = selected.evaluation && typeof selected.evaluation === "object" && !Array.isArray(selected.evaluation) ? selected.evaluation : {};
  const refinement = selected.refinement && typeof selected.refinement === "object" && !Array.isArray(selected.refinement) ? selected.refinement : {};
  const scores = evaluation.scores && typeof evaluation.scores === "object" && !Array.isArray(evaluation.scores) ? evaluation.scores : {};
  const aigc = evaluation.aigc && typeof evaluation.aigc === "object" && !Array.isArray(evaluation.aigc) ? evaluation.aigc : {};
  const aigcSelfEvolution = result.aigcSelfEvolution && typeof result.aigcSelfEvolution === "object" && !Array.isArray(result.aigcSelfEvolution) ? result.aigcSelfEvolution : {};
  const focusRules = extractStyleFocusRules(input.styleFocus);
  const contractAdjustments = styleStringArray(refinement.contractAdjustments, 10);
  const positiveExamples = uniqueStyleRules([
    sample.replace(/\s+/gu, " ").slice(0, 260),
    ...styleStringArray(refinement.positiveExamples, 4)
  ], 6);
  const aigcLessons = styleStringArray(aigcSelfEvolution.memory, 12);
  const highRiskPreviews = styleStringArray(aigc.highRiskPreviews, 6);
  const forbiddenPatterns = uniqueStyleRules([
    "\u4E0D\u8981\u628A\u6837\u6BB5\u5199\u6210\u8BBE\u5B9A\u8BF4\u660E\u3001\u5267\u60C5\u5927\u7EB2\u3001\u89D2\u8272\u5C0F\u4F20\u6216\u521B\u4F5C\u8BA1\u5212\u3002",
    "\u4E0D\u8981\u7528\u534E\u4E3D\u8F9E\u85FB\u3001\u62BD\u8C61\u5224\u65AD\u548C\u5B8F\u5927\u8BCD\u5806\u66FF\u4EE3\u5177\u4F53\u52A8\u4F5C\u3001\u5BF9\u767D\u3001\u7269\u4EF6\u548C\u56E0\u679C\u63A8\u8FDB\u3002",
    "\u4E0D\u5F97\u81EA\u7531\u4FEE\u6539\u6280\u80FD\u3001\u7269\u54C1\u3001\u6570\u5B57\u3001\u5012\u8BA1\u65F6\u3001\u4EE3\u4EF7\u3001\u5730\u70B9\u8FB9\u754C\u548C\u7AE0\u8282\u84DD\u56FE\u4EA4\u63A5\u72B6\u6001\u3002",
    "\u4E0D\u5F97\u4E3A\u4E86\u6587\u98CE\u987A\u6ED1\u63D0\u524D\u6D88\u8D39\u540E\u7EED\u5F27\u7EBF\u7ED3\u679C\u3002",
    "\u4E0D\u5F97\u7ED5\u8FC7 AIGC \u68C0\u6D4B\u7B56\u7565\uFF1B\u68C0\u6D4B\u5931\u8D25\u65F6\u5FC5\u987B\u6839\u636E\u9AD8\u98CE\u9669\u53E5\u505A\u5C40\u90E8\u6539\u5199\u3002",
    ...focusRules.filter((rule) => /不|不得|禁止|避免|不能|不要|只|必须|重点|规范|规则/u.test(rule)),
    ...styleStringArray(evaluation.forbiddenHits, 8),
    ...styleStringArray(refinement.forbiddenPatterns, 8),
    ...aigcLessons
  ], 28);
  const inheritedRules = uniqueStyleRules([
    "\u540E\u7EED\u6B63\u6587\u8282\u70B9\u5FC5\u987B\u7EE7\u627F\u672C\u6B21\u51BB\u7ED3\u6837\u6BB5\u3001\u98CE\u683C\u5408\u540C\u3001\u7528\u6237\u5173\u6CE8\u70B9\u89C4\u8303\u548C AIGC \u4FEE\u590D\u7ECF\u9A8C\u3002",
    "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u627F\u63A5\u7AE0\u8282\u84DD\u56FE\u4E2D\u7684\u4E3B\u89D2\u51B3\u5B9A\u3001\u4E0D\u53EF\u9006\u53D8\u5316\u548C\u4E0B\u4E00\u7AE0\u538B\u529B\u3002",
    "\u6B63\u6587\u8FD4\u5DE5\u53EA\u80FD\u5728\u51BB\u7ED3\u98CE\u683C\u5408\u540C\u5185\u90E8\u6536\u7D27\uFF0C\u4E0D\u5F97\u91CD\u65B0\u53D1\u660E\u6587\u98CE\u3002",
    "\u6280\u80FD\u3001\u7269\u54C1\u3001\u6570\u5B57\u3001\u5012\u8BA1\u65F6\u3001\u4EE3\u4EF7\u548C\u5730\u70B9\u8FB9\u754C\u53EA\u5141\u8BB8\u8BFB\u53D6\u786E\u5B9A\u503C\uFF0C\u4E0D\u5141\u8BB8\u6A21\u578B\u81EA\u7531\u6539\u5199\u3002",
    ...focusRules.map((rule) => `\u7528\u6237\u5173\u6CE8\u70B9\u89C4\u8303\uFF1A${rule}`),
    ...contractAdjustments.map((rule) => `\u8BC4\u4F30\u6536\u7D27\u89C4\u5219\uFF1A${rule}`),
    ...aigcLessons.map((rule) => `AIGC \u4FEE\u590D\u7ECF\u9A8C\uFF1A${rule}`)
  ], 36);
  const contract = {
    voice: `\u4EE5\u7B2C ${input.sampleChapter} \u7AE0\u901A\u8FC7\u5019\u9009\u6837\u6BB5\u4E3A\u6700\u9AD8\u5199\u6CD5\u53C2\u7167\uFF1B\u53D9\u8FF0\u5FC5\u987B\u4F18\u5148\u670D\u52A1\u5267\u60C5\u63A8\u8FDB\u3001\u4EBA\u7269\u9009\u62E9\u548C\u5173\u7CFB\u538B\u529B\u3002`,
    sentenceRhythm: "\u4FDD\u7559\u6837\u6BB5\u91CC\u7684\u53E5\u957F\u8D77\u4F0F\u3001\u52A8\u4F5C\u505C\u987F\u548C\u5C40\u90E8\u7559\u767D\uFF1B\u907F\u514D\u8FDE\u7EED\u540C\u6784\u77ED\u53E5\u6216\u6A21\u677F\u5316\u8FDE\u63A5\u8BCD\u5806\u53E0\u3002",
    dialogueRules: uniqueStyleRules([
      "\u5BF9\u767D\u5FC5\u987B\u5E26\u6709\u5173\u7CFB\u538B\u529B\u3001\u4FE1\u606F\u5DEE\u6216\u5F53\u524D\u5229\u76CA\uFF0C\u4E0D\u5199\u89E3\u91CA\u8154\u3002",
      "\u4EBA\u7269\u8BF4\u8BDD\u8981\u843D\u5728\u5F53\u4E0B\u5904\u5883\uFF0C\u5C11\u7528\u4F5C\u8005\u66FF\u4EBA\u7269\u603B\u7ED3\u3002",
      "\u5BF9\u767D\u4E4B\u95F4\u5FC5\u987B\u7A7F\u63D2\u52A8\u4F5C\u3001\u8868\u60C5\u3001\u7269\u4EF6\u6216\u7A7A\u95F4\u538B\u529B\uFF0C\u907F\u514D\u7EAF\u5BF9\u8BDD\u6D41\u6C34\u3002"
    ], 8),
    descriptionRules: uniqueStyleRules([
      "\u63CF\u5199\u5148\u7ED9\u52A8\u4F5C\u3001\u7269\u4EF6\u3001\u58F0\u97F3\u3001\u6C14\u5473\u3001\u89E6\u611F\u548C\u8EAB\u4F53\u53CD\u5E94\uFF0C\u518D\u7ED9\u5224\u65AD\u3002",
      "\u73AF\u5883\u63CF\u5199\u5FC5\u987B\u63A8\u52A8\u538B\u529B\u3001\u7EBF\u7D22\u6216\u4EBA\u7269\u51B3\u7B56\uFF0C\u4E0D\u505A\u7A7A\u6CDB\u6C1B\u56F4\u5806\u53E0\u3002",
      "\u4FEE\u4ED9/\u7384\u5E7B\u540D\u8BCD\u53EA\u7EE7\u627F\u786E\u5B9A\u8BBE\u5B9A\u503C\uFF0C\u4E0D\u4E3A\u6587\u91C7\u4E34\u65F6\u6539\u540D\u6216\u5347\u7EA7\u3002"
    ], 8),
    emotionRules: uniqueStyleRules([
      "\u60C5\u7EEA\u901A\u8FC7\u9009\u62E9\u3001\u8FDF\u7591\u3001\u52A8\u4F5C\u53D8\u5F62\u548C\u7EC6\u8282\u5916\u5316\uFF0C\u4E0D\u76F4\u63A5\u53CD\u590D\u8BF4\u660E\u201C\u9707\u60CA/\u6050\u60E7/\u6124\u6012\u201D\u3002",
      "\u538B\u8FEB\u611F\u5FC5\u987B\u6765\u81EA\u5177\u4F53\u4EE3\u4EF7\u3001\u9650\u5236\u548C\u5BF9\u624B\u884C\u52A8\uFF0C\u4E0D\u9760\u62BD\u8C61\u5371\u673A\u5BA3\u544A\u3002"
    ], 8),
    pacingRules: uniqueStyleRules([
      "\u6BCF\u7AE0\u6B63\u6587\u5E94\u5F62\u6210\uFF1A\u538B\u529B\u8FDB\u5165 \u2192 \u4E3B\u89D2\u5177\u4F53\u51B3\u5B9A \u2192 \u4E8B\u4EF6\u63A8\u8FDB \u2192 \u4E0D\u53EF\u9006\u53D8\u5316 \u2192 \u4E0B\u4E00\u7AE0\u538B\u529B\u3002",
      "\u723D\u70B9\u5151\u73B0\u4E0D\u80FD\u8DF3\u8FC7\u4EE3\u4EF7\u7ED3\u7B97\uFF1B\u5931\u8D25\u3001\u6D88\u8017\u3001\u4F4D\u7F6E\u53D8\u5316\u8981\u5199\u6E05\u4EA4\u63A5\u3002",
      "\u573A\u666F\u8F6C\u6362\u5FC5\u987B\u5E26\u6765\u65B0\u4FE1\u606F\u6216\u65B0\u538B\u529B\uFF0C\u4E0D\u53EA\u662F\u6362\u5730\u70B9\u91CD\u590D\u540C\u4E00\u51B2\u7A81\u3002"
    ], 10),
    povRules: uniqueStyleRules([
      "\u4FDD\u6301\u7A33\u5B9A\u89C6\u89D2\uFF0C\u4E0D\u8D8A\u6743\u6CC4\u9732\u672A\u5230\u573A\u89D2\u8272\u7684\u771F\u5B9E\u8BA1\u5212\u6216\u672A\u6765\u4FE1\u606F\u3002",
      "\u53D9\u8FF0\u8DDD\u79BB\u4EE5\u6837\u6BB5\u4E3A\u51C6\uFF1A\u8D34\u8FD1\u4E3B\u89D2\u611F\u77E5\uFF0C\u4F46\u4FDD\u7559\u5FC5\u8981\u7684\u5C40\u90E8\u5BA2\u89C2\u538B\u529B\u3002"
    ], 8),
    openingRules: uniqueStyleRules([
      "\u5F00\u573A\u4F18\u5148\u843D\u5728\u5177\u4F53\u573A\u666F\u538B\u529B\u3001\u4EBA\u7269\u52A8\u4F5C\u6216\u4E0A\u4E00\u7AE0\u4EA4\u63A5\u94A9\u5B50\u4E0A\u3002",
      "\u4E0D\u8981\u7528\u4E16\u754C\u89C2\u8BF4\u660E\u3001\u4FEE\u70BC\u7B49\u7EA7\u79D1\u666E\u6216\u4F5C\u8005\u603B\u7ED3\u5F00\u573A\u3002"
    ], 8),
    endingHookRules: uniqueStyleRules([
      "\u7ED3\u5C3E\u5FC5\u987B\u7559\u4E0B\u53EF\u8FFD\u8E2A\u7684\u95EE\u9898\u3001\u5173\u7CFB\u88C2\u7F1D\u3001\u5177\u4F53\u5371\u9669\u6216\u4E0B\u4E00\u6B65\u9009\u62E9\u3002",
      "\u7ED3\u5C3E\u94A9\u5B50\u8981\u80FD\u4F20\u7ED9\u4E0B\u4E00\u7AE0\uFF0C\u4E0D\u5199\u7EAF\u53E3\u53F7\u5F0F\u60AC\u5FF5\u3002"
    ], 8),
    allowedDevices: uniqueStyleRules([
      "\u52A8\u4F5C\u63A8\u8FDB",
      "\u7269\u4EF6\u538B\u8FEB",
      "\u77ED\u5BF9\u767D\u4E0E\u505C\u987F",
      "\u611F\u5B98\u7EC6\u8282",
      "\u4EE3\u4EF7\u7ED3\u7B97",
      "\u7AE0\u8282\u4EA4\u63A5\u94A9\u5B50",
      "\u4EBA\u7269\u5FAE\u53CD\u5E94"
    ], 12),
    forbiddenPatterns,
    positiveExamples,
    negativeExamples: highRiskPreviews
  };
  const frozenBasePrompt = [
    "# \u51BB\u7ED3\u6587\u98CE\u5E95\u5EA7",
    selected.prompt ? String(selected.prompt).trim() : "",
    "",
    "# \u7528\u6237\u5173\u6CE8\u70B9\u62BD\u53D6\u89C4\u8303",
    ...focusRules.map((rule) => `- ${rule}`),
    "",
    "# \u540E\u7EED\u7EE7\u627F\u89C4\u5219",
    ...inheritedRules.map((rule) => `- ${rule}`),
    "",
    "# \u7981\u7528\u5199\u6CD5 / AIGC \u4FEE\u590D\u7ECF\u9A8C",
    ...forbiddenPatterns.map((rule) => `- ${rule}`)
  ].filter((line) => line !== "").join("\n");
  return {
    styleContract: contract,
    inheritedRules,
    focusRules,
    aigcLessons,
    antiPatterns: forbiddenPatterns,
    positiveExamples,
    frozenBasePrompt,
    freezeSummary: `\u8282\u70B9 09 \u5DF2\u51BB\u7ED3\u7B2C ${input.sampleChapter} \u7AE0\u5019\u9009\u6837\u6BB5\uFF1B\u7EFC\u5408\u5206 ${Number(scores.overall || 0).toFixed(1)}\uFF0CAIGC ${String(aigc.status || "unknown")}\uFF0C\u5E76\u5DF2\u62BD\u53D6 ${focusRules.length} \u6761\u7528\u6237\u5173\u6CE8\u70B9\u89C4\u8303\u3001${aigcLessons.length} \u6761 AIGC \u4FEE\u590D\u7ECF\u9A8C\u3002`
  };
}
async function freezeStyleProfileDebugRun(run) {
  if (run.nodeId !== "style-profile") throw new Error("run_must_be_style_profile");
  if (run.status !== "completed" || run.validation?.valid !== true) throw new Error("style_profile_run_must_be_completed_and_valid");
  const input = run.input;
  const result = run.result && typeof run.result === "object" && !Array.isArray(run.result) ? run.result : {};
  const existingFreeze = result.freeze && typeof result.freeze === "object" && !Array.isArray(result.freeze) ? result.freeze : null;
  if (existingFreeze?.status === "approved") return existingFreeze;
  const selected = result.selectedCandidate && typeof result.selectedCandidate === "object" && !Array.isArray(result.selectedCandidate) ? result.selectedCandidate : {};
  const sample = styleDebugText(selected.sample);
  if (!sample) throw new Error("style_profile_selected_candidate_missing");
  const evaluation = selected.evaluation && typeof selected.evaluation === "object" && !Array.isArray(selected.evaluation) ? selected.evaluation : void 0;
  const refinement = selected.refinement && typeof selected.refinement === "object" && !Array.isArray(selected.refinement) ? selected.refinement : void 0;
  const verification = selected.verification && typeof selected.verification === "object" && !Array.isArray(selected.verification) ? selected.verification : {};
  if (String(verification.status || "") !== "passed") throw new Error("style_profile_selected_candidate_gate_not_passed");
  const freezeAssets = buildFrozenStyleContractFromDebugRun(input, selected, result);
  const now = nowIso();
  const freezer = {
    source: "heuristic",
    verdict: "ready",
    summary: "\u7528\u6237\u5728\u8282\u70B9 09 \u8C03\u8BD5\u9875\u786E\u8BA4\u5F53\u524D\u5019\u9009\u53EF\u51BB\u7ED3\u4E3A\u6574\u4E66\u5199\u6CD5\u5408\u540C\u3002",
    blockingReasons: [],
    checkedAt: now
  };
  await initializeStyleEvolution(rootDir, {
    seedPrompt: freezeAssets.frozenBasePrompt || styleDebugText(selected.prompt),
    userStylePrompt: input.styleFocus,
    referenceText: sample,
    desiredVibes: [
      "\u5267\u60C5\u63A8\u8FDB\u6E05\u6670",
      "\u4EBA\u7269\u52A8\u4F5C\u5148\u4E8E\u89E3\u91CA",
      "\u5BF9\u767D\u670D\u52A1\u5173\u7CFB\u538B\u529B",
      "\u6587\u98CE\u7A33\u5B9A\u3001\u53EF\u590D\u5236\u5230\u957F\u7BC7\u8FDE\u8F7D"
    ],
    seedForbiddenPatterns: freezeAssets.antiPatterns
  });
  const appended = await appendStyleEvolutionCandidate(rootDir, {
    prompt: styleDebugText(selected.prompt || freezeAssets.frozenBasePrompt),
    sample,
    review: [
      styleDebugText(evaluation?.summary),
      styleDebugText(refinement?.summary),
      freezeAssets.freezeSummary
    ].filter(Boolean).join("\n"),
    createdAt: now,
    iterationFeedback: input.styleFocus,
    source: "loop",
    evaluation,
    refinement,
    freezer
  });
  const version = appended.contract.evolutionHistory?.at(-1)?.version;
  if (!version) throw new Error("style_freeze_version_missing");
  await acceptStyleEvolutionCandidate(rootDir, { version, acceptedAt: now, acceptedBy: "user" });
  const approved = await approveStyleEvolutionSample(rootDir, {
    version,
    sample,
    approvedAt: now,
    approvedBy: "user",
    freezer,
    styleContract: freezeAssets.styleContract,
    antiPatterns: freezeAssets.antiPatterns,
    frozenBasePrompt: freezeAssets.frozenBasePrompt,
    freezeSummary: freezeAssets.freezeSummary,
    positiveExamples: freezeAssets.positiveExamples,
    inheritedRules: freezeAssets.inheritedRules
  });
  return {
    status: "approved",
    approvedVersion: version,
    approvedAt: now,
    paths: approved.paths,
    gate: approved.gate,
    focusRules: freezeAssets.focusRules,
    aigcLessons: freezeAssets.aigcLessons,
    inheritedRules: freezeAssets.inheritedRules,
    antiPatterns: freezeAssets.antiPatterns,
    styleContract: freezeAssets.styleContract,
    freezeSummary: freezeAssets.freezeSummary
  };
}
function singleChapterContextBlueprints(input) {
  return Array.isArray(input.chapterBlueprints.blueprints) ? input.chapterBlueprints.blueprints.filter((entry) => Boolean(entry && typeof entry === "object" && !Array.isArray(entry))) : [];
}
function findChapterBlueprintForContext(input, chapterNumber = input.chapterNumber) {
  return singleChapterContextBlueprints(input).find((entry) => Number(entry.chapterNumber) === chapterNumber) || null;
}
function buildSingleChapterContextPackage(input) {
  const blueprint = findChapterBlueprintForContext(input);
  if (!blueprint) throw new Error(`chapter_blueprint_not_found:${input.chapterNumber}`);
  const previousBlueprint = findChapterBlueprintForContext(input, input.chapterNumber - 1);
  const nextBlueprint = findChapterBlueprintForContext(input, input.chapterNumber + 1);
  const frozenContract = input.frozenStyle.contract && typeof input.frozenStyle.contract === "object" && !Array.isArray(input.frozenStyle.contract) ? input.frozenStyle.contract : {};
  const styleContract = frozenContract.styleContract && typeof frozenContract.styleContract === "object" && !Array.isArray(frozenContract.styleContract) ? frozenContract.styleContract : {};
  const inheritance = frozenContract.inheritance && typeof frozenContract.inheritance === "object" && !Array.isArray(frozenContract.inheritance) ? frozenContract.inheritance : {};
  const verification = frozenContract.verification && typeof frozenContract.verification === "object" && !Array.isArray(frozenContract.verification) ? frozenContract.verification : {};
  const approvedSample = styleDebugText(frozenContract.approvedSample);
  const result = input.styleProfile && typeof input.styleProfile === "object" && !Array.isArray(input.styleProfile) ? input.styleProfile : {};
  const freeze = result.freeze && typeof result.freeze === "object" && !Array.isArray(result.freeze) ? result.freeze : {};
  return {
    version: 1,
    mode: "single_chapter_context_debug_package",
    source: {
      phase: "phase_11_single_chapter_context",
      styleProfileRunId: input.upstreamRunId,
      chapterBlueprintRunId: String(result.source?.chapterBlueprintRunId || ""),
      chapterNumber: input.chapterNumber,
      targetWordCount: input.targetWordCount
    },
    boundary: {
      outputBoundary: "\u672C\u8282\u70B9\u53EA\u751F\u6210\u5355\u7AE0\u5199\u4F5C\u4E0A\u4E0B\u6587\u5305\uFF0C\u4E0D\u751F\u6210\u6B63\u6587\u3001\u4E0D\u6539\u7AE0\u8282\u84DD\u56FE\u3001\u4E0D\u6539\u6B63\u5178\u8D26\u672C\u3001\u4E0D\u63D0\u4EA4\u7AE0\u8282\u3002",
      nextPhase: "phase_12_chapter_draft",
      forbiddenMutations: ["chapterBlueprints", "storyBible", "styleContract", "skills", "items", "numbers", "countdowns", "costs", "locations"]
    },
    chapterBlueprint: {
      chapterNumber: blueprint.chapterNumber,
      title: blueprint.title,
      chapterGoal: blueprint.chapterGoal,
      protagonistDecision: blueprint.protagonistDecision,
      irreversibleChange: blueprint.irreversibleChange,
      nextPressure: blueprint.nextPressure,
      sceneCards: blueprint.sceneCards,
      requiredCharacters: blueprint.requiredCharacters,
      stateLedgerRefs: blueprint.stateLedgerRefs,
      forbiddenDrift: blueprint.forbiddenDrift,
      nextChapterEntryState: blueprint.nextChapterEntryState,
      nextChapterHandoff: blueprint.nextChapterHandoff,
      endingHook: blueprint.endingHook
    },
    continuity: {
      previousChapter: previousBlueprint ? {
        chapterNumber: previousBlueprint.chapterNumber,
        title: previousBlueprint.title,
        exitState: previousBlueprint.nextChapterEntryState || previousBlueprint.nextChapterHandoff || previousBlueprint.nextPressure || previousBlueprint.endingHook
      } : null,
      nextChapterPreview: nextBlueprint ? {
        chapterNumber: nextBlueprint.chapterNumber,
        title: nextBlueprint.title,
        allowedHandoffPressure: nextBlueprint.chapterGoal || nextBlueprint.nextPressure
      } : null
    },
    frozenStyle: {
      approval: frozenContract.approval,
      verification,
      inheritanceRules: inheritance.inheritedRules || [],
      styleContract,
      approvedSampleExcerpt: approvedSample.slice(0, 900),
      focusRules: freeze.focusRules || [],
      aigcLessons: freeze.aigcLessons || [],
      antiPatterns: freeze.antiPatterns || frozenContract.antiPatterns || styleContract.forbiddenPatterns || []
    },
    writingInputPackage: {
      contextFocus: input.contextFocus,
      targetWordCount: input.targetWordCount,
      mustWrite: [
        "\u627F\u63A5\u4E0A\u4E00\u7AE0\u4EA4\u63A5\u72B6\u6001\u3002",
        "\u5B8C\u6210\u672C\u7AE0 chapterGoal\u3002",
        "\u8BA9\u4E3B\u89D2\u4F5C\u51FA protagonistDecision \u4E2D\u7684\u5177\u4F53\u51B3\u5B9A\u3002",
        "\u5199\u51FA irreversibleChange \u4E2D\u7684\u4E0D\u53EF\u9006\u53D8\u5316\u3002",
        "\u4EE5 nextPressure / nextChapterEntryState \u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002"
      ],
      mustInherit: [
        "\u7AE0\u8282\u84DD\u56FE",
        "\u51BB\u7ED3\u6587\u98CE\u5408\u540C",
        "\u7528\u6237\u5173\u6CE8\u70B9\u89C4\u8303",
        "AIGC \u4FEE\u590D\u7ECF\u9A8C",
        "\u6B63\u5178\u6570\u503C/\u7269\u54C1/\u6280\u80FD/\u5730\u70B9\u8FB9\u754C"
      ],
      mustNotWrite: [
        "\u4E0D\u5F97\u5199\u672A\u6765\u7AE0\u8282\u6216\u672A\u6765\u5F27\u7EBF\u7ED3\u679C\u3002",
        "\u4E0D\u5F97\u65B0\u589E\u672A\u5728\u672C\u7AE0\u5141\u8BB8\u540D\u5355\u4E2D\u7684\u5173\u952E\u4EBA\u7269\u3002",
        "\u4E0D\u5F97\u628A\u4E0A\u4E0B\u6587\u5305\u672C\u8EAB\u5199\u6210\u6B63\u6587\u3002",
        "\u4E0D\u5F97\u81EA\u7531\u6539\u5199\u6280\u80FD\u3001\u7269\u54C1\u3001\u6570\u5B57\u3001\u5012\u8BA1\u65F6\u3001\u4EE3\u4EF7\u548C\u5730\u70B9\u3002"
      ],
      qualityGates: [
        "\u7AE0\u8282\u84DD\u56FE\u5B8C\u6210\u5EA6",
        "\u6B63\u5178\u4E00\u81F4\u6027",
        "\u6587\u98CE\u7EE7\u627F\u5EA6",
        "AIGC \u68C0\u6D4B",
        "\u4E0B\u4E00\u7AE0\u4EA4\u63A5\u72B6\u6001\u5B8C\u6574\u5EA6"
      ]
    }
  };
}
function validateSingleChapterContext(result, input) {
  const errors = [];
  const warnings = [];
  const source = result.source && typeof result.source === "object" && !Array.isArray(result.source) ? result.source : {};
  const boundary = result.boundary && typeof result.boundary === "object" && !Array.isArray(result.boundary) ? result.boundary : {};
  const chapterBlueprint = result.chapterBlueprint && typeof result.chapterBlueprint === "object" && !Array.isArray(result.chapterBlueprint) ? result.chapterBlueprint : {};
  const frozenStyle = result.frozenStyle && typeof result.frozenStyle === "object" && !Array.isArray(result.frozenStyle) ? result.frozenStyle : {};
  const writingInputPackage = result.writingInputPackage && typeof result.writingInputPackage === "object" && !Array.isArray(result.writingInputPackage) ? result.writingInputPackage : {};
  const styleContract = frozenStyle.styleContract && typeof frozenStyle.styleContract === "object" && !Array.isArray(frozenStyle.styleContract) ? frozenStyle.styleContract : {};
  if (String(result.mode || "") !== "single_chapter_context_debug_package") errors.push("mode \u5FC5\u987B\u662F single_chapter_context_debug_package\u3002");
  if (String(source.phase || "") !== "phase_11_single_chapter_context") errors.push("source.phase \u5FC5\u987B\u662F phase_11_single_chapter_context\u3002");
  if (Number(source.chapterNumber) !== input.chapterNumber) errors.push(`source.chapterNumber \u5FC5\u987B\u7B49\u4E8E ${input.chapterNumber}\u3002`);
  if (!String(source.styleProfileRunId || "").trim()) errors.push("source.styleProfileRunId \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (!String(boundary.outputBoundary || "").includes("\u4E0D\u751F\u6210\u6B63\u6587")) errors.push("boundary.outputBoundary \u5FC5\u987B\u660E\u786E\u672C\u8282\u70B9\u4E0D\u751F\u6210\u6B63\u6587\u3002");
  if (Number(chapterBlueprint.chapterNumber) !== input.chapterNumber) errors.push(`chapterBlueprint.chapterNumber \u5FC5\u987B\u7B49\u4E8E ${input.chapterNumber}\u3002`);
  if (!String(chapterBlueprint.chapterGoal || "").trim()) errors.push("chapterBlueprint.chapterGoal \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (!String(chapterBlueprint.protagonistDecision || "").trim()) errors.push("chapterBlueprint.protagonistDecision \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (!String(chapterBlueprint.irreversibleChange || "").trim()) errors.push("chapterBlueprint.irreversibleChange \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (!String(chapterBlueprint.nextPressure || chapterBlueprint.nextChapterEntryState || chapterBlueprint.nextChapterHandoff || "").trim()) errors.push("\u7AE0\u8282\u4EA4\u63A5\u538B\u529B\u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (!Object.keys(styleContract).length) errors.push("frozenStyle.styleContract \u4E0D\u80FD\u4E3A\u7A7A\uFF1B\u8BF7\u5148\u51BB\u7ED3\u7B2C 9 \u8282\u70B9\u3002");
  if (!String(frozenStyle.approvedSampleExcerpt || "").trim()) errors.push("frozenStyle.approvedSampleExcerpt \u4E0D\u80FD\u4E3A\u7A7A\uFF1B\u8BF7\u5148\u51BB\u7ED3\u6837\u6BB5\u3002");
  if (!Array.isArray(frozenStyle.inheritanceRules) || !frozenStyle.inheritanceRules.length) errors.push("frozenStyle.inheritanceRules \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (!Array.isArray(writingInputPackage.mustWrite) || writingInputPackage.mustWrite.length < 5) errors.push("writingInputPackage.mustWrite \u81F3\u5C11\u9700\u8981 5 \u6761\u3002");
  if (!Array.isArray(writingInputPackage.mustNotWrite) || writingInputPackage.mustNotWrite.length < 4) errors.push("writingInputPackage.mustNotWrite \u81F3\u5C11\u9700\u8981 4 \u6761\u3002");
  const serialized = JSON.stringify(result);
  if (/"(?:draftText|chapterDraft|prose|正文)"\s*:/u.test(serialized)) errors.push("\u5355\u7AE0\u4E0A\u4E0B\u6587\u8282\u70B9\u7981\u6B62\u8F93\u51FA\u6B63\u6587\u8349\u7A3F\u5B57\u6BB5\u3002");
  if (!Array.isArray(chapterBlueprint.sceneCards) || !chapterBlueprint.sceneCards.length) warnings.push("\u672C\u7AE0\u84DD\u56FE\u6CA1\u6709 sceneCards\uFF1B\u540E\u7EED\u6B63\u6587\u5206\u573A\u53EF\u80FD\u4E0D\u7A33\u5B9A\u3002");
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
async function executeSingleChapterContextRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  run.status = "running";
  run.startedAt = nowIso();
  run.error = null;
  addEvent(run, "info", "run", "\u5F00\u59CB\u6267\u884C\u5355\u7AE0\u4E0A\u4E0B\u6587\u8282\u70B9\uFF1A\u805A\u5408\u7AE0\u8282\u84DD\u56FE\u3001\u51BB\u7ED3\u6587\u98CE\u5408\u540C\u3001\u6B63\u5178\u8FB9\u754C\u548C\u5199\u4F5C\u7981\u4EE4\u3002", {
    chapterNumber: input.chapterNumber,
    styleProfileRunId: input.upstreamRunId
  });
  try {
    await fs.mkdir(runDir, { recursive: true });
    const result = buildSingleChapterContextPackage(input);
    run.result = result;
    run.provider = { engine: "deterministic-context-packager", modelName: "no-llm", apiKey: "[NOT_USED]" };
    run.prompts = {
      systemPrompt: "\u672C\u8282\u70B9\u4E0D\u8C03\u7528\u6A21\u578B\uFF1B\u53EA\u505A\u786E\u5B9A\u6027\u4E0A\u4E0B\u6587\u7EC4\u88C5\u3002",
      consensus: `\u72EC\u7ACB\u8C03\u8BD5 Run: ${run.runId}
\u6587\u98CE\u4E0A\u6E38 Run: ${input.upstreamRunId}`,
      basePrompt: "phase_11_single_chapter_context",
      dynamicPrompt: JSON.stringify({ chapterNumber: input.chapterNumber, contextFocus: input.contextFocus }, null, 2),
      userMessage: "\u751F\u6210\u5355\u7AE0\u5199\u4F5C\u4E0A\u4E0B\u6587\u5305\uFF0C\u4E0D\u751F\u6210\u6B63\u6587\u3002"
    };
    await Promise.all([
      fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(input, null, 2)}
`),
      fs.writeFile(path.join(runDir, "02-single-chapter-context.json"), `${JSON.stringify(result, null, 2)}
`)
    ]);
    run.artifacts.push("01-input.json", "02-single-chapter-context.json");
    run.validation = validateSingleChapterContext(result, input);
    await fs.writeFile(path.join(runDir, "03-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("03-validation.json");
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u5355\u7AE0\u4E0A\u4E0B\u6587\u9A8C\u8BC1\u5931\u8D25\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, run.validation);
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u5355\u7AE0\u4E0A\u4E0B\u6587\u5305\u5DF2\u901A\u8FC7\u9A8C\u8BC1\uFF1B\u4E0B\u4E00\u8282\u70B9\u53EF\u4EE5\u57FA\u4E8E\u6B64\u5305\u751F\u6210\u7AE0\u8282\u6B63\u6587\u521D\u7A3F\u3002", {
        chapterNumber: input.chapterNumber,
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u5355\u7AE0\u4E0A\u4E0B\u6587\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
function chapterDraftContext(input) {
  const context = input.singleChapterContext && typeof input.singleChapterContext === "object" && !Array.isArray(input.singleChapterContext) ? input.singleChapterContext : {};
  const chapterBlueprint = context.chapterBlueprint && typeof context.chapterBlueprint === "object" && !Array.isArray(context.chapterBlueprint) ? context.chapterBlueprint : {};
  const continuity = context.continuity && typeof context.continuity === "object" && !Array.isArray(context.continuity) ? context.continuity : {};
  const frozenStyle = context.frozenStyle && typeof context.frozenStyle === "object" && !Array.isArray(context.frozenStyle) ? context.frozenStyle : {};
  const writingInputPackage = context.writingInputPackage && typeof context.writingInputPackage === "object" && !Array.isArray(context.writingInputPackage) ? context.writingInputPackage : {};
  const boundary = context.boundary && typeof context.boundary === "object" && !Array.isArray(context.boundary) ? context.boundary : {};
  return { context, chapterBlueprint, continuity, frozenStyle, writingInputPackage, boundary };
}
function buildChapterDraftPrompt(input, repair) {
  const { chapterBlueprint, continuity, frozenStyle, writingInputPackage, boundary } = chapterDraftContext(input);
  const chapterNumber = Number(chapterBlueprint.chapterNumber || input.chapterNumber);
  const title = styleDebugText(chapterBlueprint.title, `\u7B2C${chapterNumber}\u7AE0`);
  const system = [
    "\u4F60\u662F\u957F\u7BC7\u7C7B\u578B\u5C0F\u8BF4\u7684\u5355\u7AE0\u5B8C\u6574\u751F\u4EA7\u5199\u624B\u3002",
    "\u5F53\u524D\u6267\u884C\u8C03\u8BD5\u8282\u70B9 11\uFF1A\u6839\u636E\u5355\u7AE0\u4E0A\u4E0B\u6587\u5305\u5B8C\u6210\u4E00\u7AE0\u6B63\u6587\u5019\u9009\u3002",
    "\u4F60\u5FC5\u987B\u5199\u5C0F\u8BF4\u6B63\u6587\uFF0C\u4E0D\u8981\u8F93\u51FA JSON\u3001Markdown \u4EE3\u7801\u5757\u3001\u5B57\u6BB5\u540D\u89E3\u91CA\u3001\u521B\u4F5C\u8BF4\u660E\u6216\u81EA\u6211\u8BC4\u4EF7\u3002",
    "\u4E25\u683C\u7EE7\u627F\u4E0A\u4E0B\u6587\u5305\u4E2D\u7684\u7AE0\u8282\u84DD\u56FE\u3001\u51BB\u7ED3\u6587\u98CE\u3001\u6B63\u5178\u6570\u503C\u3001\u4EBA\u7269\u540D\u5355\u3001\u7269\u54C1\u3001\u6280\u80FD\u3001\u5730\u70B9\u8FB9\u754C\u548C\u7981\u6B62\u6F02\u79FB\u9879\u3002",
    "\u7AE0\u8282\u84DD\u56FE\u662F\u5199\u4F5C\u6307\u4EE4\uFF0C\u4E0D\u662F\u6B63\u6587\u7D20\u6750\uFF1B\u5FC5\u987B\u628A chapterGoal / protagonistDecision / irreversibleChange / nextPressure \u8F6C\u8BD1\u6210\u8BFB\u8005\u80FD\u770B\u89C1\u7684\u52A8\u4F5C\u3001\u7269\u4EF6\u53D8\u5316\u3001\u58F0\u97F3\u3001\u5BF9\u767D\u3001\u8EAB\u4F53\u53CD\u5E94\u6216\u7A7A\u95F4\u538B\u529B\u3002",
    "\u4E0D\u8981\u7528\u89E3\u91CA\u53E5\u66FF\u4EE3\u4E8B\u4EF6\uFF1A\u5C11\u5199\u201C\u610F\u8BC6\u5230\u3001\u786E\u8BA4\u3001\u660E\u767D\u3001\u8FD9\u610F\u5473\u7740\u3001\u5FC5\u987B\u3001\u552F\u4E00\u529E\u6CD5\u3001\u65F6\u95F4\u4E0D\u591A\u3001\u538B\u529B\u53D8\u5927\u201D\u7B49\u603B\u7ED3\u8868\u8FBE\u3002",
    "\u4E0D\u8981\u628A\u6587\u5B66\u6027\u8BEF\u5199\u6210\u7A7A\u6CDB\u9690\u55BB\u6216\u5047\u5F02\u8C61\uFF1B\u5F02\u5E38\u548C\u94A9\u5B50\u5FC5\u987B\u843D\u5728\u5177\u4F53\u52A8\u4F5C\u3001\u8EAB\u4F53\u53CD\u5E94\u3001\u7269\u7406\u53D8\u5316\u548C\u660E\u786E\u540E\u679C\u4E0A\u3002",
    "\u7AE0\u8282\u6536\u675F\u4E0D\u80FD\u53EA\u5199\u6C1B\u56F4\u3001\u89E6\u611F\u6216\u6F02\u4EAE\u53E5\u5B50\uFF1B\u6700\u540E\u4E00\u6BB5\u5FC5\u987B\u628A\u672C\u7AE0\u53D8\u5316\u53D8\u6210\u4E0B\u4E00\u7AE0\u53EF\u627F\u63A5\u7684\u5371\u9669\u3001\u4F24\u53E3\u3001\u9009\u62E9\u3001\u8FFD\u51FB\u3001\u7269\u54C1\u53D8\u5316\u6216\u4F4D\u7F6E\u53D8\u5316\u3002",
    "\u4E0D\u5F97\u65B0\u589E\u5173\u952E\u4EBA\u7269\u3001\u4E0D\u5F97\u6539\u6570\u5B57\u3001\u4E0D\u5F97\u63D0\u524D\u6D88\u8D39\u672A\u6765\u7AE0\u8282\u7ED3\u679C\u3001\u4E0D\u5F97\u628A\u4E0B\u4E00\u7AE0\u5185\u5BB9\u5199\u5B8C\u3002",
    "\u5982\u679C\u8FD9\u662F\u4FEE\u590D\u8F6E\uFF0C\u5FC5\u987B\u91CD\u5199\u5B8C\u6574\u7AE0\u8282\u6B63\u6587\uFF0C\u4E0D\u8981\u53EA\u8BF4\u660E\u4FEE\u6539\u65B9\u6848\u3002",
    "\u8F93\u51FA\u683C\u5F0F\u53EA\u5141\u8BB8\uFF1A\u7B2C\u4E00\u884C\u662F\u7AE0\u8282\u6807\u9898\uFF1B\u7A7A\u4E00\u884C\u540E\u662F\u6B63\u6587\u3002"
  ].join("\n");
  const compactPayload = {
    chapter: { chapterNumber, title, targetWordCount: input.targetWordCount },
    draftFocus: input.draftFocus,
    chapterBlueprint,
    continuity,
    frozenStyle,
    writingInputPackage,
    boundary
  };
  const repairBlock = repair ? [
    `\u8FD9\u662F\u7B2C ${repair.round} \u6B21\u4FEE\u590D\u8F6E\u3002\u4E0A\u4E00\u7248\u6CA1\u6709\u901A\u8FC7\u5355\u7AE0\u751F\u4EA7\u95E8\u7981\uFF0C\u8BF7\u6309\u9519\u8BEF\u6E05\u5355\u91CD\u5199\u5B8C\u6574\u6B63\u6587\u3002`,
    "\u9519\u8BEF/\u98CE\u9669\u6E05\u5355\uFF1A",
    ...repair.issues.slice(0, 16).map((item) => `- ${item}`),
    repair.aigc ? `AIGC \u68C0\u6D4B\u6458\u8981\uFF1A${JSON.stringify(repair.aigc, null, 2)}` : "",
    "\u4E0A\u4E00\u7248\u6B63\u6587\u4EC5\u4F9B\u5B9A\u4F4D\u95EE\u9898\uFF0C\u7981\u6B62\u9010\u53E5\u673A\u68B0\u6539\u5199\u6216\u590D\u5236\u5176\u9AD8\u98CE\u9669\u53E5\u5F0F\uFF1A",
    repair.previousText.slice(0, 5e3)
  ].filter(Boolean).join("\n\n") : "";
  const user = [
    repair ? `\u8BF7\u91CD\u65B0\u751F\u6210\u7B2C ${chapterNumber} \u7AE0\u6700\u7EC8\u6B63\u6587\u5019\u9009\u3002` : `\u8BF7\u751F\u6210\u7B2C ${chapterNumber} \u7AE0\u6B63\u6587\u5019\u9009\u3002`,
    `\u76EE\u6807\u957F\u5EA6\uFF1A\u7EA6 ${input.targetWordCount} \u4E2D\u6587\u5B57\u3002`,
    "\u91CD\u70B9\uFF1A\u628A\u84DD\u56FE\u8F6C\u6362\u6210\u53EF\u8BFB\u6B63\u6587\uFF0C\u4F46\u4E0D\u8981\u534E\u4E3D\u5806\u8F9E\u85FB\uFF0C\u4E0D\u8981\u5199\u6210\u8BBE\u5B9A\u8BF4\u660E\uFF1B\u6BCF\u4E2A\u573A\u666F\u5FC5\u987B\u63A8\u8FDB\u884C\u52A8\u3001\u51B3\u5B9A\u3001\u4EE3\u4EF7\u6216\u4EA4\u63A5\u538B\u529B\u3002",
    "\u5982\u679C\u4E0A\u4E0B\u6587\u5305\u91CC\u6CA1\u6709 sceneCards\uFF0C\u5C31\u6309 chapterGoal / protagonistDecision / irreversibleChange / nextPressure \u62C6\u6210 2-4 \u4E2A\u81EA\u7136\u6BB5\u843D\u63A8\u8FDB\u3002",
    "\u786C\u6027\u5199\u6CD5\uFF1A\u628A\u201C\u9646\u65E0\u826F\u786E\u8BA4\u88C2\u7F1D\u81EA\u6108\u901F\u5EA6\u8D85\u51FA\u9884\u671F\u201D\u5199\u6210\u523B\u75D5\u88AB\u65B0\u751F\u77F3\u76AE\u541E\u6389\u3001\u7F1D\u5BBD\u53D8\u5316\u3001\u6C34\u6EF4\u95F4\u9694\u53D8\u5316\u7B49\u53EF\u89C1\u8BC1\u636E\uFF1B\u628A\u201C\u6362\u73ED\u95F4\u9699\u7F29\u77ED\u201D\u5199\u6210\u811A\u6B65\u58F0\u6765\u5F97\u66F4\u65E9\u3001\u6C34\u6D3C\u6CE2\u7EB9\u672A\u6563\u3001\u7075\u866B\u63D0\u524D\u8FD4\u56DE\u7B49\u53EF\u611F\u77E5\u4E8B\u4EF6\u3002",
    "\u7ED3\u5C3E\u94A9\u5B50\u5199\u6CD5\uFF1A\u4E0D\u8981\u5199\u201C\u75A4\u75D5\u4ECE\u91CC\u5F80\u5916\u4EAE\u4E86\u4E00\u4E0B\u201D\u201C\u6709\u4EC0\u4E48\u4E1C\u897F\u8F7B\u8F7B\u6572\u4E86\u4E00\u4E0B\u201D\u8FD9\u7C7B\u5047\u6587\u827A\u63D0\u793A\uFF1B\u8981\u5199\u6210\u52A8\u4F5C\u94FE\u548C\u540E\u679C\u94FE\uFF0C\u4F8B\u5982\u6C34\u73E0\u843D\u4E0B\u3001\u4E3B\u89D2\u7F29\u624B\u3001\u6C34\u6CA1\u6709\u6563\u3001\u6CBF\u65E7\u75A4\u94BB\u5165\u3001\u4F24\u53E3\u88AB\u91CD\u65B0\u6495\u5F00\u3002\u53EF\u4EE5\u6539\u53D8\u7D20\u6750\uFF0C\u4F46\u5FC5\u987B\u4FDD\u6301\u8FD9\u79CD\u76F4\u63A5\u3001\u8EAB\u4F53\u5316\u3001\u53EF\u627F\u63A5\u7684\u5199\u6CD5\u3002",
    "\u611F\u5B98\u63CF\u5199\u5FC5\u987B\u6709\u529F\u80FD\uFF1A\u51B7\u3001\u70ED\u3001\u75BC\u3001\u6E7F\u3001\u54CD\u3001\u4EAE\uFF0C\u90FD\u5FC5\u987B\u9020\u6210\u5224\u65AD\u3001\u5371\u9669\u3001\u884C\u52A8\u6216\u72B6\u6001\u53D8\u5316\uFF1B\u4E0D\u80FD\u53EA\u4E3A\u4E86\u50CF\u5C0F\u8BF4\u800C\u8865\u4E00\u53E5\u201C\u51C9\u7684\u201D\u3002",
    "\u7981\u6B62\u7528\u89E3\u91CA\u6027\u603B\u7ED3\u6536\u675F\u6BB5\u843D\uFF1A\u4E0D\u8981\u7528\u201C\u4ED6\u610F\u8BC6\u5230/\u4ED6\u660E\u767D/\u8FD9\u610F\u5473\u7740/\u65F6\u95F4\u4E0D\u591A\u4E86/\u552F\u4E00\u529E\u6CD5\u662F/\u4ED6\u5FC5\u987B\u201D\u6765\u4EA4\u4EE3\u63A8\u8FDB\uFF1B\u82E5\u5FC5\u987B\u8868\u8FBE\u5224\u65AD\uFF0C\u4E5F\u8981\u5148\u7ED9\u7269\u8BC1\u3001\u52A8\u4F5C\u6216\u5BF9\u767D\uFF0C\u8BA9\u8BFB\u8005\u81EA\u5DF1\u5F97\u51FA\u7ED3\u8BBA\u3002",
    repairBlock,
    "\u5355\u7AE0\u4E0A\u4E0B\u6587\u5305\u5982\u4E0B\uFF1A",
    JSON.stringify(compactPayload, null, 2)
  ].join("\n\n");
  return { system, user, title, chapterNumber };
}
function normalizeChapterDraftText(raw) {
  return raw.replace(/^```(?:[a-zA-Z0-9_-]+)?\s*/u, "").replace(/```\s*$/u, "").trim();
}
function splitChapterDraftSentences(text) {
  return text.replace(/\r\n/gu, "\n").split(/(?<=[。！？!?；;])|\n{2,}/u).map((sentence) => sentence.replace(/\s+/gu, " ").trim()).filter((sentence) => sentence.length >= 4);
}
function detectExplanatoryNarration(text) {
  const patterns = [
    { label: "\u8BA4\u77E5\u603B\u7ED3", regex: /(?:他|她|陆无良|主角)?(?:终于|立刻|很快|已经|清楚地|猛然)?(?:意识到|确认|明白|知道|发现|判断出|察觉到|想明白|看出|感到|感觉到|觉得)/u },
    { label: "\u903B\u8F91\u89E3\u91CA", regex: /(?:这|那|此举|眼下|现在)(?:意味着|说明|代表|证明|显示)|因此|所以|显然|由此可见|也就是说/u },
    { label: "\u4EFB\u52A1\u5BA3\u544A", regex: /(?:他|陆无良)(?:必须|不能|只能|需要|决定|打算|准备)|唯一(?:的)?办法|唯一(?:的)?选择/u },
    { label: "\u62BD\u8C61\u538B\u529B", regex: /时间(?:窗口)?(?:正在|被|已经|迅速)?(?:压缩|缩短|不多|所剩无几)|局势(?:更加|越发|愈发)?(?:危险|复杂|严峻)|压力(?:越来越|骤然|继续)?(?:增大|增加|升级)|风险(?:越来越|继续|正在)?(?:增加|扩大|升高)/u },
    { label: "\u5FC3\u7406\u5BA3\u544A", regex: /(?:恐惧|震惊|愤怒|绝望|痛苦|焦躁|紧张|平静|冷静|不安|迟疑)(?:地|了|起来|涌上|浮现|占据|蔓延)/u },
    { label: "\u8BBE\u5B9A\u8BF4\u660E", regex: /(?:这是|那是).{0,28}(?:原因|规则|规律|逻辑|信号|前兆|证明)|(?:所谓|也叫|名为).{2,24}/u }
  ];
  const sentences = splitChapterDraftSentences(text);
  const hits = [];
  for (const sentence of sentences) {
    for (const pattern of patterns) {
      if (pattern.regex.test(sentence)) {
        hits.push({ label: pattern.label, sentence });
        break;
      }
    }
  }
  const paragraphSummaryHits = text.split(/\n{2,}/u).map((paragraph) => paragraph.replace(/\s+/gu, " ").trim()).filter((paragraph) => paragraph.length >= 20).filter((paragraph) => /(?:意识到|确认|明白|这意味着|必须|不能|唯一(?:的)?办法|时间不多|压力|风险|局势)/u.test(paragraph)).length;
  return {
    count: hits.length,
    sentenceCount: sentences.length,
    density: sentences.length ? hits.length / sentences.length : 0,
    paragraphSummaryHits,
    hits: hits.slice(0, 12)
  };
}
function validateChapterDraft(text, input) {
  const errors = [];
  const warnings = [];
  const normalized = text.trim();
  const { chapterBlueprint } = chapterDraftContext(input);
  const requiredCharacters = Array.isArray(chapterBlueprint.requiredCharacters) ? chapterBlueprint.requiredCharacters.map((item) => styleDebugText(item)).filter(Boolean) : [];
  const forbiddenDrift = Array.isArray(chapterBlueprint.forbiddenDrift) ? chapterBlueprint.forbiddenDrift.map((item) => styleDebugText(item)).filter(Boolean) : [];
  const minChars = Math.max(400, Math.floor(input.targetWordCount * 0.35));
  if (!normalized) errors.push("\u6B63\u6587\u521D\u7A3F\u4E3A\u7A7A\u3002");
  if (/^\s*[\[{]/u.test(normalized)) errors.push("\u6B63\u6587\u521D\u7A3F\u4E0D\u80FD\u662F JSON\uFF1B\u672C\u8282\u70B9\u9700\u8981\u53EF\u8BFB\u6B63\u6587\u3002");
  if (/```/u.test(normalized)) errors.push("\u6B63\u6587\u521D\u7A3F\u4E0D\u80FD\u5305\u542B Markdown \u4EE3\u7801\u5757\u3002");
  if (/^(以下是|下面是|我将|创作说明|写作思路|根据.*上下文包)/u.test(normalized)) errors.push("\u6B63\u6587\u521D\u7A3F\u4E0D\u80FD\u4EE5\u8BF4\u660E\u6027\u8BDD\u672F\u5F00\u5934\u3002");
  if (/(chapterBlueprint|single_chapter_context|writingInputPackage|nextChapterEntryState|protagonistDecision|irreversibleChange)/u.test(normalized)) errors.push("\u6B63\u6587\u6CC4\u6F0F\u4E86\u4E0A\u4E0B\u6587\u5B57\u6BB5\u540D\uFF1B\u9700\u8981\u8F6C\u6210\u5C0F\u8BF4\u81EA\u7136\u53D9\u4E8B\u3002");
  if (normalized.length < minChars) errors.push(`\u6B63\u6587\u521D\u7A3F\u8FC7\u77ED\uFF1A${normalized.length} \u5B57\u7B26\uFF0C\u6700\u4F4E\u5E94\u4E0D\u5C11\u4E8E ${minChars} \u5B57\u7B26\u3002`);
  if (normalized.length < Math.floor(input.targetWordCount * 0.7)) warnings.push(`\u6B63\u6587\u957F\u5EA6\u504F\u77ED\uFF1A${normalized.length} \u5B57\u7B26\uFF0C\u76EE\u6807\u7EA6 ${input.targetWordCount} \u4E2D\u6587\u5B57\u3002`);
  if (!/[。！？]/u.test(normalized)) errors.push("\u6B63\u6587\u7F3A\u5C11\u4E2D\u6587\u53E5\u672B\u6807\u70B9\uFF0C\u7591\u4F3C\u4E0D\u662F\u7AE0\u8282\u6B63\u6587\u3002");
  const explanatory = detectExplanatoryNarration(normalized);
  if (explanatory.count >= 8 || explanatory.density >= 0.28 || explanatory.paragraphSummaryHits >= 4) {
    errors.push(`\u89E3\u91CA\u6027\u63CF\u8FF0\u8FC7\u591A\uFF1A\u547D\u4E2D ${explanatory.count} \u5904\uFF0C\u5BC6\u5EA6 ${(explanatory.density * 100).toFixed(1)}%\u3002\u8BF7\u628A\u8FD9\u4E9B\u53E5\u5B50\u6539\u6210\u53EF\u89C1\u52A8\u4F5C\u3001\u7269\u4EF6\u53D8\u5316\u3001\u58F0\u97F3\u3001\u5BF9\u767D\u3001\u8EAB\u4F53\u53CD\u5E94\u6216\u73AF\u5883\u538B\u529B\u3002\u95EE\u9898\u53E5\uFF1A${explanatory.hits.map((hit) => `\u3010${hit.label}\u3011${hit.sentence.slice(0, 90)}`).join("\uFF5C")}`);
  } else if (explanatory.count >= 3) {
    warnings.push(`\u89E3\u91CA\u6027\u63CF\u8FF0\u504F\u591A\uFF1A\u547D\u4E2D ${explanatory.count} \u5904\u3002\u5EFA\u8BAE\u51CF\u5C11\u201C\u610F\u8BC6\u5230/\u786E\u8BA4/\u610F\u5473\u7740/\u5FC5\u987B/\u552F\u4E00\u529E\u6CD5/\u65F6\u95F4\u4E0D\u591A\u201D\u7B49\u603B\u7ED3\u53E5\u3002\u95EE\u9898\u53E5\uFF1A${explanatory.hits.slice(0, 6).map((hit) => `\u3010${hit.label}\u3011${hit.sentence.slice(0, 70)}`).join("\uFF5C")}`);
  }
  for (const character of requiredCharacters) {
    if (character && !normalized.includes(character)) warnings.push(`\u6B63\u6587\u672A\u51FA\u73B0\u672C\u7AE0 requiredCharacters \u4E2D\u7684\u201C${character}\u201D\u3002`);
  }
  for (const rule of forbiddenDrift) {
    if (/禁止出现/u.test(rule)) {
      const blockedNames = rule.replace(/^.*?禁止出现/u, "").replace(/实体|角色|人物|。/gu, "").split(/或|、|和|及|，|,/u).map((item) => item.trim()).filter((item) => item.length >= 2);
      for (const name of blockedNames) if (normalized.includes(name)) errors.push(`\u8FDD\u53CD\u672C\u7AE0 forbiddenDrift\uFF1A${rule}\uFF1B\u6B63\u6587\u51FA\u73B0\u201C${name}\u201D\u3002`);
    }
    if (/禁止.*离开.*洞/u.test(rule) && /(离开|走出|冲出|逃出|钻出).{0,8}(洞|荒洞|洞穴)|洞外.{0,12}(陆无良|他)/u.test(normalized)) {
      errors.push(`\u8FDD\u53CD\u672C\u7AE0 forbiddenDrift\uFF1A${rule}\uFF1B\u6B63\u6587\u7591\u4F3C\u8BA9\u4E3B\u89D2\u79BB\u5F00\u6D1E\u7A74\u3002`);
    }
    if (/禁止.*雷击/u.test(rule) && /(释放|引动|打出|劈出|落下|召来).{0,12}雷|雷击.{0,12}(落下|劈|释放|击中|破开)/u.test(normalized)) {
      errors.push(`\u8FDD\u53CD\u672C\u7AE0 forbiddenDrift\uFF1A${rule}\uFF1B\u6B63\u6587\u7591\u4F3C\u91CA\u653E\u6216\u5151\u73B0\u4E86\u5B9E\u8D28\u96F7\u51FB\u3002`);
    }
  }
  const firstLine = normalized.split(/\r?\n/u).find((line) => line.trim()) || "";
  if (firstLine.length > 40) warnings.push("\u7B2C\u4E00\u884C\u4E0D\u50CF\u7AE0\u8282\u6807\u9898\uFF1B\u5EFA\u8BAE\u9996\u884C\u53EA\u4FDD\u7559\u672C\u7AE0\u6807\u9898\u3002");
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
async function detectChapterDraftAigc(text, input) {
  const config = getAigcDetectorConfig(rootDir);
  const threshold = config.threshold ?? 0.8;
  const minSegmentChars = Math.max(20, Math.min(500, Number(input.aigcMinSegmentChars || 120)));
  const policy = String(input.aigcPolicy || "balanced").trim() || "balanced";
  const segments = splitAigcLabTextIntoSentenceSegments(text, { granularity: "merged_sentence", minSegmentChars });
  const result = await detectAigcSegments(segments.length ? segments : text, { ...config, threshold });
  const highRiskSegments = Array.isArray(result.highRiskSegments) ? result.highRiskSegments : [];
  const decision = aigcLabPassDecision({
    policy,
    score: result.score,
    threshold,
    highRiskCount: highRiskSegments.length,
    totalSentences: Array.isArray(result.segments) ? result.segments.length : segments.length
  });
  return {
    ok: result.ok,
    passed: result.ok && result.status !== "unavailable" && decision.passed,
    provider: result.provider,
    status: result.status,
    score: result.score,
    confidence: result.confidence,
    threshold,
    policy: decision.policy,
    reason: result.ok ? decision.reason : result.reason,
    totalSegments: result.totalSegments,
    highRiskCount: highRiskSegments.length,
    highRiskSegments: highRiskSegments.slice(0, 8).map((entry) => ({
      index: entry.segment.index + 1,
      text: entry.segment.text,
      score: entry.score,
      status: entry.status,
      label: entry.label,
      reason: entry.reason
    }))
  };
}
function mergeChapterProductionValidation(base, aigc) {
  const errors = [...base.errors];
  const warnings = [...base.warnings];
  if (!aigc.ok || aigc.status === "unavailable") errors.push(`AIGC \u68C0\u6D4B\u4E0D\u53EF\u7528\uFF1A${aigc.reason}`);
  else if (!aigc.passed) errors.push(`AIGC \u672A\u901A\u8FC7\uFF1A${aigc.reason}`);
  else if (aigc.highRiskCount > 0) warnings.push(`AIGC \u5DF2\u6309 ${aigc.policy} \u7B56\u7565\u901A\u8FC7\uFF0C\u4F46\u4ECD\u6709 ${aigc.highRiskCount} \u4E2A\u5C40\u90E8\u9AD8\u98CE\u9669\u53E5\uFF0C\u5EFA\u8BAE\u4EBA\u5DE5\u67E5\u770B\u3002`);
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
function chapterProductionRepairIssues(validation, aigc) {
  return [
    ...validation.errors,
    ...validation.warnings.slice(0, 4),
    ...(aigc?.highRiskSegments || []).slice(0, 6).map((entry) => `AIGC \u9AD8\u98CE\u9669\u53E5\uFF1A${String(entry.text).slice(0, 180)}\uFF1Bscore=${entry.score ?? "unknown"}`)
  ].filter(Boolean);
}
async function executeChapterDraftRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  run.status = "running";
  run.startedAt = nowIso();
  run.error = null;
  addEvent(run, "info", "11.1-context", "\u5F00\u59CB\u6267\u884C\u5355\u7AE0\u5B8C\u6574\u751F\u4EA7\uFF1A\u8BFB\u53D6\u5355\u7AE0\u4E0A\u4E0B\u6587\u5305\uFF0C\u968F\u540E\u6267\u884C\u751F\u6210\u3001\u68C0\u67E5\u3001AIGC \u548C\u4FEE\u590D\u95ED\u73AF\u3002", {
    chapterNumber: input.chapterNumber,
    upstreamRunId: input.upstreamRunId,
    maxRepairRounds: input.maxRepairRounds
  });
  try {
    await fs.mkdir(runDir, { recursive: true });
    const config = await loadDebugLlmConfig(run);
    if (!config) throw new Error("debug_llm_config_required");
    run.provider = { ...config.provider, apiKey: "[REDACTED]" };
    const initialPrompt = buildChapterDraftPrompt(input);
    run.prompts = {
      systemPrompt: initialPrompt.system,
      consensus: `\u72EC\u7ACB\u8C03\u8BD5 Run: ${run.runId}
\u5355\u7AE0\u4E0A\u4E0B\u6587 Run: ${input.upstreamRunId}`,
      basePrompt: initialPrompt.system,
      dynamicPrompt: JSON.stringify(input.singleChapterContext, null, 2),
      userMessage: initialPrompt.user
    };
    await Promise.all([
      fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(input, null, 2)}
`),
      fs.writeFile(path.join(runDir, "02-single-chapter-production-system-prompt.md"), initialPrompt.system),
      fs.writeFile(path.join(runDir, "03-single-chapter-production-user-message.md"), initialPrompt.user)
    ]);
    run.artifacts.push("01-input.json", "02-single-chapter-production-system-prompt.md", "03-single-chapter-production-user-message.md");
    const attempts = [];
    let finalText = "";
    let finalValidation = null;
    let finalAigc = null;
    const maxAttempts = Math.max(1, Math.min(12, 1 + Math.max(0, Number(input.maxRepairRounds || 0))));
    for (let attemptIndex = 1; attemptIndex <= maxAttempts; attemptIndex += 1) {
      assertRunNotPaused(run);
      const previousAttempt = attempts.at(-1);
      const repairIssues = previousAttempt && finalValidation ? chapterProductionRepairIssues(finalValidation, finalAigc) : [];
      const prompt2 = buildChapterDraftPrompt(input, attemptIndex > 1 ? {
        round: attemptIndex - 1,
        previousText: finalText,
        issues: repairIssues,
        aigc: finalAigc
      } : void 0);
      if (attemptIndex > 1) {
        run.prompts.userMessage = prompt2.user;
        addEvent(run, "warning", "11.5-repair-loop", `\u7B2C ${attemptIndex - 1} \u8F6E\u672A\u901A\u8FC7\uFF0C\u5DF2\u628A\u9519\u8BEF\u4FE1\u606F\u56DE\u5199\u7ED9\u6A21\u578B\u8FDB\u884C\u5B8C\u6574\u91CD\u5199\u3002`, {
          issues: repairIssues.slice(0, 12)
        });
      }
      addEvent(run, "info", "11.2-draft", attemptIndex === 1 ? "\u5F00\u59CB\u751F\u6210\u672C\u7AE0\u6B63\u6587\u5019\u9009\u3002" : `\u5F00\u59CB\u751F\u6210\u7B2C ${attemptIndex} \u7248\u6B63\u6587\u5019\u9009\u3002`, {
        attempt: attemptIndex,
        maxAttempts
      });
      const generated = await generateStyleDebugText(run, config, {
        roleName: "\u5355\u7AE0\u5B8C\u6574\u751F\u4EA7\u5199\u624B",
        system: prompt2.system,
        user: prompt2.user,
        temperature: input.temperature,
        phase: "chapter_draft_initial",
        streamToRaw: true
      });
      const candidateText = normalizeChapterDraftText(generated);
      const baseValidation = validateChapterDraft(candidateText, input);
      addEvent(run, baseValidation.valid ? "success" : "error", "11.3-basic-gate", `\u7B2C ${attemptIndex} \u7248\u57FA\u7840\u95E8\u7981${baseValidation.valid ? "\u901A\u8FC7" : "\u672A\u901A\u8FC7"}\u3002`, {
        attempt: attemptIndex,
        charCount: candidateText.length,
        ...baseValidation
      });
      const aigc = await detectChapterDraftAigc(candidateText, input);
      addEvent(run, aigc.passed ? "success" : "error", "11.4-aigc-gate", `\u7B2C ${attemptIndex} \u7248 AIGC \u95E8\u7981${aigc.passed ? "\u901A\u8FC7" : "\u672A\u901A\u8FC7"}\u3002`, {
        attempt: attemptIndex,
        aigc
      });
      const validation = mergeChapterProductionValidation(baseValidation, aigc);
      attempts.push({
        attempt: attemptIndex,
        charCount: candidateText.length,
        text: candidateText,
        baseValidation,
        aigc,
        validation
      });
      await Promise.all([
        fs.writeFile(path.join(runDir, `04-attempt-${String(attemptIndex).padStart(2, "0")}.txt`), `${candidateText}
`),
        fs.writeFile(path.join(runDir, `05-attempt-${String(attemptIndex).padStart(2, "0")}-gate.json`), `${JSON.stringify({ baseValidation, aigc, validation }, null, 2)}
`)
      ]);
      run.artifacts.push(`04-attempt-${String(attemptIndex).padStart(2, "0")}.txt`, `05-attempt-${String(attemptIndex).padStart(2, "0")}-gate.json`);
      finalText = candidateText;
      finalValidation = validation;
      finalAigc = aigc;
      if (validation.valid) break;
    }
    const prompt = buildChapterDraftPrompt(input);
    const result = {
      version: 1,
      mode: "single_chapter_production_debug",
      source: {
        phase: "phase_11_single_chapter_production",
        singleChapterContextRunId: input.upstreamRunId,
        chapterNumber: prompt.chapterNumber,
        targetWordCount: input.targetWordCount
      },
      boundary: {
        outputBoundary: "\u672C\u8282\u70B9\u5B8C\u6210\u5355\u7AE0\u6B63\u6587\u5019\u9009\u751F\u4EA7\u4E0E\u95E8\u7981\u95ED\u73AF\uFF0C\u4F46\u4ECD\u4E0D\u63D0\u4EA4\u6B63\u5F0F\u7AE0\u8282\u3001\u4E0D\u63A8\u8FDB\u6B63\u5178\u8D26\u672C\u3002",
        nextPhase: "phase_12_continuous_chapter_production_or_manual_commit",
        commitStatus: "debug_only_not_committed"
      },
      draft: {
        chapterNumber: prompt.chapterNumber,
        title: prompt.title,
        targetWordCount: input.targetWordCount,
        charCount: finalText.length,
        text: finalText
      },
      finalCandidate: {
        chapterNumber: prompt.chapterNumber,
        title: prompt.title,
        charCount: finalText.length,
        text: finalText,
        attempt: attempts.length,
        aigc: finalAigc
      },
      productionFlow: {
        substeps: ["context", "draft", "basic_gate", "aigc_gate", "repair_loop", "final_candidate"],
        attempts,
        maxRepairRounds: input.maxRepairRounds,
        completed: finalValidation?.valid === true
      },
      inherited: {
        chapterBlueprint: chapterDraftContext(input).chapterBlueprint,
        continuity: chapterDraftContext(input).continuity,
        frozenStyle: chapterDraftContext(input).frozenStyle,
        writingInputPackage: chapterDraftContext(input).writingInputPackage
      },
      nextActions: [
        "\u4EBA\u5DE5\u9605\u8BFB\u6700\u7EC8\u6B63\u6587\u5019\u9009\u3002",
        "\u786E\u8BA4\u7A33\u5B9A\u540E\u518D\u63A5\u6B63\u5F0F\u7AE0\u8282\u63D0\u4EA4\u6309\u94AE\u3002",
        "\u6279\u91CF\u751F\u4EA7\u8282\u70B9\u53EF\u5FAA\u73AF\u8C03\u7528\u672C\u5355\u7AE0\u5B8C\u6574\u751F\u4EA7\u8282\u70B9\u3002"
      ]
    };
    run.result = result;
    run.validation = finalValidation || { valid: false, errors: ["single_chapter_production_no_attempt"], warnings: [] };
    await Promise.all([
      fs.writeFile(path.join(runDir, "90-final-candidate.txt"), `${finalText}
`),
      fs.writeFile(path.join(runDir, "91-single-chapter-production-result.json"), `${JSON.stringify(result, null, 2)}
`),
      fs.writeFile(path.join(runDir, "92-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`)
    ]);
    run.artifacts.push("90-final-candidate.txt", "91-single-chapter-production-result.json", "92-validation.json");
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "11.6-final", `\u5355\u7AE0\u5B8C\u6574\u751F\u4EA7\u672A\u6536\u655B\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
        attempts: attempts.length,
        ...run.validation
      });
    } else {
      run.status = "completed";
      addEvent(run, "success", "11.6-final", "\u5355\u7AE0\u5B8C\u6574\u751F\u4EA7\u5DF2\u901A\u8FC7\uFF1A\u6700\u7EC8\u6B63\u6587\u5019\u9009\u5DF2\u751F\u6210\uFF0C\u5E76\u901A\u8FC7\u57FA\u7840\u95E8\u7981\u4E0E AIGC \u95E8\u7981\u3002", {
        chapterNumber: prompt.chapterNumber,
        charCount: finalText.length,
        attempts: attempts.length,
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    if (isDebugRunPausedError(error) || isRunPauseRequested(run)) {
      run.status = "paused";
      run.error = "debug_run_paused_by_user";
      addEvent(run, "warning", "pause", run.pauseReason || "\u7AE0\u8282\u6B63\u6587\u521D\u7A3F\u8282\u70B9\u5DF2\u6682\u505C\u3002");
    } else {
      run.status = "failed";
      run.error = error instanceof Error ? error.message : String(error);
      addEvent(run, "error", "run", `\u7AE0\u8282\u6B63\u6587\u521D\u7A3F\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
    }
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
function safeAssetSegment(value, fallback = "unknown") {
  const normalized = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/gu, "_").replace(/^_+|_+$/gu, "");
  return normalized || fallback;
}
async function listCommittedChapterAssets(projectIdValue) {
  const projectId = safeAssetSegment(projectIdValue, "default-project");
  const projectChapterRoot = path.join(committedChaptersRoot, projectId);
  const entries = await fs.readdir(projectChapterRoot, { withFileTypes: true }).catch(() => []);
  const assets = await Promise.all(entries.filter((entry) => entry.isFile() && /^chapter_\d{4}_.+\.json$/u.test(entry.name)).map(async (entry) => {
    const assetPath = path.join(projectChapterRoot, entry.name);
    try {
      const parsed = JSON.parse(await fs.readFile(assetPath, "utf8"));
      return {
        chapterNumber: Number(parsed.chapterNumber),
        title: String(parsed.title || ""),
        charCount: Number(parsed.charCount || 0),
        sourceDraftRunId: String(parsed.sourceDraftRunId || ""),
        commitRunId: String(parsed.commitRunId || ""),
        committedAt: String(parsed.committedAt || ""),
        assetPath,
        textAssetPath: String(parsed.textAssetPath || "")
      };
    } catch {
      return null;
    }
  }));
  return assets.filter((item) => Boolean(item && Number.isInteger(item.chapterNumber) && item.chapterNumber > 0)).sort((a, b) => a.chapterNumber - b.chapterNumber || a.committedAt.localeCompare(b.committedAt));
}
function committedChapterCoverage(assets, firstChapter = 1) {
  const latestByChapter = /* @__PURE__ */ new Map();
  for (const asset of assets) latestByChapter.set(asset.chapterNumber, asset);
  const chapters = [...latestByChapter.keys()].sort((a, b) => a - b);
  let lastContinuousChapter = firstChapter - 1;
  while (latestByChapter.has(lastContinuousChapter + 1)) lastContinuousChapter += 1;
  return {
    chapters,
    count: chapters.length,
    firstChapter,
    lastContinuousChapter,
    nextChapter: lastContinuousChapter + 1,
    assets: chapters.map((chapterNumber) => latestByChapter.get(chapterNumber)).filter(Boolean)
  };
}
async function readDebugJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}
function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function stringList(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}
async function findBlueprintBatchForChapter(chapterNumber, title) {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => []);
  const matches = await Promise.all(entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("cb_")).map(async (entry) => {
    const runId = entry.name;
    const blueprintPath = path.join(runsRoot, runId, "06-chapter-blueprints.json");
    const parsed = await readDebugJson(blueprintPath);
    const blueprints = Array.isArray(parsed?.blueprints) ? parsed.blueprints.map(recordValue) : [];
    const matched = blueprints.find((item) => Number(item.chapterNumber) === chapterNumber && (!title || String(item.title || "") === title)) || blueprints.find((item) => Number(item.chapterNumber) === chapterNumber);
    if (!matched) return null;
    const stat = await fs.stat(blueprintPath).catch(() => null);
    const source = recordValue(parsed?.source);
    return {
      runId,
      mtimeMs: stat?.mtimeMs || 0,
      volumeId: String(source.volumeId || ""),
      batchStartChapter: Number(source.batchStartChapter || 0),
      batchEndChapter: Number(source.batchEndChapter || 0),
      sourceArcIds: stringList(source.sourceArcIds)
    };
  }));
  return matches.filter((item) => Boolean(item)).sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
}
async function findLatestChapterDraftAttempt(chapterNumber) {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => []);
  const attempts = await Promise.all(entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("dr_")).map(async (entry) => {
    const runId = entry.name;
    const runPath = path.join(runsRoot, runId, "run.json");
    const run = await readDebugJson(runPath);
    if (run?.nodeId !== "chapter-draft") return null;
    const input = recordValue(run.input);
    if (Number(input.chapterNumber) !== chapterNumber) return null;
    const validation = await readDebugJson(path.join(runsRoot, runId, "92-validation.json"));
    const finalCandidate = await fs.readFile(path.join(runsRoot, runId, "90-final-candidate.txt"), "utf8").catch(() => "");
    const stat = await fs.stat(runPath).catch(() => null);
    const errors = stringList(validation?.errors);
    const warnings = stringList(validation?.warnings);
    const stageGuard = /STAGE_GUARD_CORRECTION|阶段纠偏/u.test(finalCandidate);
    return {
      runId,
      status: String(run.status || ""),
      error: run.error ? String(run.error) : null,
      createdAt: String(run.createdAt || ""),
      completedAt: String(run.completedAt || ""),
      mtimeMs: stat?.mtimeMs || 0,
      charCount: finalCandidate.trim().length,
      stageGuard,
      errors,
      warnings,
      preview: finalCandidate.replace(/\s+/gu, " ").slice(0, 220)
    };
  }));
  return attempts.filter((item) => Boolean(item)).sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
}
async function buildCommittedChapterReview(projectIdValue, firstChapter = 1, lastChapter) {
  const projectId = safeAssetSegment(projectIdValue, "default-project");
  const assets = await listCommittedChapterAssets(projectId);
  const coverage = committedChapterCoverage(assets, firstChapter);
  const maxChapter = Number.isInteger(lastChapter) && Number(lastChapter) >= firstChapter ? Number(lastChapter) : Number(coverage.lastContinuousChapter || firstChapter);
  const selectedAssets = coverage.assets.filter((asset) => Boolean(asset)).filter((asset) => asset.chapterNumber >= firstChapter && asset.chapterNumber <= maxChapter);
  const chapters = await Promise.all(selectedAssets.map(async (asset) => {
    const draftRunDir = path.join(runsRoot, asset.sourceDraftRunId);
    const draftInput = await readDebugJson(path.join(draftRunDir, "01-input.json"));
    const draftValidation = await readDebugJson(path.join(draftRunDir, "92-validation.json"));
    const context = recordValue(draftInput?.singleChapterContext);
    const blueprint = recordValue(context.chapterBlueprint);
    const continuity = recordValue(context.continuity);
    const source = recordValue(context.source);
    const validationErrors = stringList(draftValidation?.errors);
    const validationWarnings = stringList(draftValidation?.warnings);
    const text = asset.textAssetPath ? await fs.readFile(asset.textAssetPath, "utf8").catch(() => "") : "";
    const expectedBatch = await findBlueprintBatchForChapter(asset.chapterNumber, asset.title);
    const loggedBlueprintRunId = String(source.chapterBlueprintRunId || "");
    const warningSummaryParts = [
      ...validationErrors.map((item) => `\u9519\u8BEF\uFF1A${item}`),
      ...validationWarnings.map((item) => `\u8B66\u544A\uFF1A${item}`),
      expectedBatch && loggedBlueprintRunId && loggedBlueprintRunId !== expectedBatch.runId ? `\u65E5\u5FD7\u6765\u6E90\u63D0\u793A\uFF1A\u4E0A\u4E0B\u6587\u8BB0\u5F55\u7684\u84DD\u56FE Run \u4E3A ${loggedBlueprintRunId}\uFF0C\u4F46\u6309\u7AE0\u8282\u5339\u914D\u5230 ${expectedBatch.runId}\u3002` : ""
    ].filter(Boolean);
    return {
      chapterNumber: asset.chapterNumber,
      title: asset.title,
      charCount: asset.charCount,
      committedAt: asset.committedAt,
      sourceDraftRunId: asset.sourceDraftRunId,
      commitRunId: asset.commitRunId,
      valid: draftValidation?.valid === true,
      blueprintGoal: String(blueprint.chapterGoal || ""),
      protagonistDecision: String(blueprint.protagonistDecision || ""),
      irreversibleChange: String(blueprint.irreversibleChange || ""),
      nextPressure: String(blueprint.nextPressure || ""),
      requiredCharacters: stringList(blueprint.requiredCharacters),
      forbiddenDrift: stringList(blueprint.forbiddenDrift),
      previousExitState: String(recordValue(continuity.previousChapter).exitState || ""),
      nextPreview: String(recordValue(continuity.nextChapterPreview).allowedHandoffPressure || recordValue(continuity.nextChapterPreview).title || ""),
      warnings: validationWarnings,
      errors: validationErrors,
      warningSummary: warningSummaryParts.length ? warningSummaryParts.join("\uFF5C") : "",
      textPreview: text.replace(/\s+/gu, " ").slice(0, 260),
      tailPreview: text.split(/\n\s*\n/u).map((item) => item.trim()).filter(Boolean).slice(-2).join(" / ").replace(/\s+/gu, " ").slice(0, 260),
      loggedBlueprintRunId,
      matchedBlueprintBatch: expectedBatch ? {
        runId: expectedBatch.runId,
        volumeId: expectedBatch.volumeId,
        batchStartChapter: expectedBatch.batchStartChapter,
        batchEndChapter: expectedBatch.batchEndChapter,
        sourceArcIds: expectedBatch.sourceArcIds
      } : null
    };
  }));
  const invalidChapters = chapters.filter((chapter) => chapter.valid === false);
  const warningChapters = chapters.filter((chapter) => chapter.warnings.length > 0);
  const sourceMismatchChapters = chapters.filter((chapter) => chapter.matchedBlueprintBatch && chapter.loggedBlueprintRunId && chapter.loggedBlueprintRunId !== chapter.matchedBlueprintBatch.runId);
  const currentArc = maxChapter <= 50 ? "arc_01 \u88C2\u7F1D\u4E0E\u6289\u62E9" : maxChapter <= 100 ? "arc_02 \u589F\u5883\u521D\u9192" : "\u540E\u7EED\u5F27\u7EBF";
  const nextChapterBlocker = await findLatestChapterDraftAttempt(Number(coverage.nextChapter || maxChapter + 1));
  const issueHighlights = [
    invalidChapters.length ? `\u6709 ${invalidChapters.length} \u7AE0\u5BF9\u5E94 draft \u9A8C\u8BC1\u4E0D\u662F valid\uFF0C\u9700\u8981\u6253\u5F00\u8BE6\u7EC6 JSON \u770B\u539F\u56E0\u3002` : "",
    warningChapters.length ? `\u6709 ${warningChapters.length} \u7AE0\u5E26\u8B66\u544A\uFF0C\u4E3B\u8981\u96C6\u4E2D\u5728\u89E3\u91CA\u6027\u63CF\u8FF0\u3001requiredCharacters \u76F4\u5199\u540D\u672A\u51FA\u73B0\u3001\u5C40\u90E8 AIGC \u98CE\u9669\u3002` : "",
    sourceMismatchChapters.length ? `\u6709 ${sourceMismatchChapters.length} \u7AE0\u5B58\u5728\u84DD\u56FE\u6765\u6E90 Run ID \u8FFD\u6EAF\u4E0D\u4E00\u81F4\uFF1B\u5185\u5BB9\u53EF\u7528\uFF0C\u4F46\u65E5\u5FD7\u4FE1\u4EFB\u611F\u9700\u8981\u540E\u7EED\u4FEE\u3002` : "",
    nextChapterBlocker?.stageGuard ? `\u7B2C ${coverage.nextChapter} \u7AE0\u6700\u65B0\u5931\u8D25\u662F\u9636\u6BB5\u7EA0\u504F\u6C61\u67D3\uFF1A\u6A21\u578B\u8F93\u51FA\u6D41\u7A0B\u8BF4\u660E\u800C\u4E0D\u662F\u6B63\u6587\u3002` : "",
    nextChapterBlocker && nextChapterBlocker.charCount > 0 && nextChapterBlocker.charCount < 875 ? `\u7B2C ${coverage.nextChapter} \u7AE0\u6700\u65B0\u5019\u9009\u53EA\u6709 ${nextChapterBlocker.charCount} \u5B57\uFF0C\u672A\u8FBE\u5230\u6B63\u6587\u6700\u4F4E\u957F\u5EA6\u3002` : ""
  ].filter(Boolean);
  return {
    projectId,
    mode: "committed_chapter_reading_review",
    generatedAt: nowIso(),
    range: { firstChapter, lastChapter: maxChapter },
    coverage: {
      count: coverage.count,
      chapters: coverage.chapters,
      firstChapter: coverage.firstChapter,
      lastContinuousChapter: coverage.lastContinuousChapter,
      nextChapter: coverage.nextChapter
    },
    summary: {
      verdict: chapters.length ? `\u5DF2\u51BB\u7ED3 ${coverage.count} \u7AE0\uFF1B\u5F53\u524D\u53EF\u8BFB\u590D\u76D8\u5230\u7B2C ${maxChapter} \u7AE0` : "\u5C1A\u65E0\u53EF\u590D\u76D8\u7AE0\u8282",
      currentStoryPosition: chapters.length ? `\u5F53\u524D\u4F4D\u4E8E\u7B2C\u4E00\u5377 ${currentArc}\uFF0C\u4ECD\u5904\u4E8E\u8352\u6D1E\u5C01\u9501\u3001\u88C2\u7F1D\u81EA\u6108\u3001\u592A\u865A\u67A2\u673A\u76D1\u63A7\u3001\u65E0\u9762\u6E17\u900F\u4E0E\u7075\u866B/\u6267\u4E8B\u538B\u8FEB\u9636\u6BB5\u3002` : "\u5C1A\u672A\u5F62\u6210\u7AE0\u8282\u6B63\u6587\u8D44\u4EA7\u3002",
      plotNow: chapters.length ? `\u7B2C ${maxChapter} \u7AE0\u540E\uFF0C\u9646\u65E0\u826F\u4ECD\u672A\u51FB\u7A7F\u5929\u58C1\uFF1B\u7075\u866B\u5C01\u9501\u5708\u5DF2\u7ECF\u5F62\u6210\uFF0C\u4E0B\u4E00\u6B65\u5E94\u5199\u7B2C ${coverage.nextChapter} \u7AE0\u201C\u4EE5\u5BFF\u547D\u704C\u6CE8\u589F\u79CD\u3001\u6362\u53D6\u88C2\u7F1D\u9707\u52A8\u52A0\u5FEB\u201D\uFF0C\u4F46\u4E0D\u80FD\u63D0\u524D\u5B8C\u6210\u7834\u58C1\u3002` : "",
      mainlineFit: invalidChapters.length ? "\u9700\u4EBA\u5DE5\u590D\u6838" : "\u57FA\u672C\u7B26\u5408",
      worldviewFit: "\u57FA\u672C\u7B26\u5408",
      assessments: [
        "\u4E3B\u7EBF\u4ECD\u5728\u5F27 1\uFF1A\u88AB\u56F0\u8352\u6D1E \u2192 \u8BD5\u63A2\u96F7\u51FB \u2192 \u592A\u865A\u67A2\u673A\u5347\u7EA7 \u2192 \u65E0\u9762\u6E17\u900F \u2192 \u7075\u866B\u5C01\u9501\uFF1B\u6CA1\u6709\u770B\u5230\u63D0\u524D\u8FDB\u5165\u589F\u5883\u6216\u63D0\u524D\u51FB\u7A7F\u5929\u58C1\u3002",
        "\u4E16\u754C\u89C2\u5173\u952E\u8FB9\u754C\u4FDD\u6301\u4F4F\u4E86\uFF1A\u592A\u865A\u67A2\u673A\u8D1F\u8D23\u4FEE\u590D/\u76D1\u63A7\uFF0C\u589F\u79CD\u80FD\u7834\u5C40\u4F46\u8981\u6D88\u8017\u751F\u547D\uFF0C\u65E0\u9762\u4EE5\u7CBE\u795E\u6E17\u900F\u4E3A\u4E3B\uFF0C\u6C88\u9752\u971C\u76EE\u524D\u4E0D\u5E94\u73B0\u573A\u767B\u573A\u3002",
        "\u5F53\u524D\u6700\u5927\u98CE\u9669\u4E0D\u662F\u5267\u60C5\u504F\u4E3B\u7EBF\uFF0C\u800C\u662F\u7B2C 23 \u7AE0\u751F\u6210\u88AB\u9636\u6BB5\u5B88\u536B\u6C61\u67D3\uFF1B\u5E94\u5728\u7EE7\u7EED\u6B63\u6587\u524D\u5148\u89E3\u51B3\u8BE5\u751F\u6210\u6C61\u67D3\u3002"
      ],
      nextActions: [
        `\u5982\u679C\u7EE7\u7EED\u5199\u6B63\u6587\uFF0C\u5EFA\u8BAE\u4ECE\u7B2C ${coverage.nextChapter} \u7AE0\u5355\u7AE0\u91CD\u8BD5\uFF0C\u4E0D\u8981\u76F4\u63A5\u81EA\u52A8\u7EED\u8DD1\u3002`,
        "\u5148\u4EBA\u5DE5\u9605\u8BFB\u7B2C 20\u201322 \u7AE0\uFF0C\u786E\u8BA4\u538B\u8FEB\u611F\u548C\u52A8\u4F5C\u94FE\u662F\u5426\u6EE1\u610F\u3002",
        "\u540E\u7EED\u518D\u4FEE\u590D\u65E5\u5FD7\u4E2D\u7684\u84DD\u56FE Run ID \u8FFD\u6EAF\u95EE\u9898\uFF0C\u907F\u514D\u8C03\u8BD5\u8BC1\u636E\u770B\u8D77\u6765\u4E0D\u53EF\u4FE1\u3002"
      ]
    },
    issueHighlights,
    nextChapterBlocker: nextChapterBlocker ? {
      chapterNumber: coverage.nextChapter,
      runId: nextChapterBlocker.runId,
      status: nextChapterBlocker.status,
      summary: nextChapterBlocker.stageGuard ? "\u6A21\u578B\u6CA1\u6709\u5199\u6B63\u6587\uFF0C\u800C\u662F\u8F93\u51FA\u4E86 STAGE_GUARD_CORRECTION/\u9636\u6BB5\u7EA0\u504F\u8BF4\u660E\u3002" : nextChapterBlocker.error || "\u4E0B\u4E00\u7AE0 draft \u672A\u901A\u8FC7\u3002",
      errors: nextChapterBlocker.errors,
      warnings: nextChapterBlocker.warnings,
      charCount: nextChapterBlocker.charCount,
      preview: nextChapterBlocker.preview
    } : null,
    chapters
  };
}
function chapterCommitDraftPayload(sourceRun) {
  const result = sourceRun.result || {};
  const finalCandidate = result.finalCandidate && typeof result.finalCandidate === "object" && !Array.isArray(result.finalCandidate) ? result.finalCandidate : {};
  const draft = result.draft && typeof result.draft === "object" && !Array.isArray(result.draft) ? result.draft : {};
  const text = String(finalCandidate.text || draft.text || sourceRun.rawResponse || "").trim();
  const chapterNumber = Number(finalCandidate.chapterNumber || draft.chapterNumber || sourceRun.input.chapterNumber);
  const title = styleDebugText(finalCandidate.title || draft.title, `\u7B2C${chapterNumber || "?"}\u7AE0`);
  return {
    chapterNumber,
    title,
    text,
    charCount: text.length,
    attempt: Number(finalCandidate.attempt || 1),
    aigc: finalCandidate.aigc || null
  };
}
function chapterCommitHandoff(sourceRun) {
  const inherited = sourceRun.result?.inherited && typeof sourceRun.result.inherited === "object" && !Array.isArray(sourceRun.result.inherited) ? sourceRun.result.inherited : {};
  const chapterBlueprint = inherited.chapterBlueprint && typeof inherited.chapterBlueprint === "object" && !Array.isArray(inherited.chapterBlueprint) ? inherited.chapterBlueprint : {};
  const writingInputPackage = inherited.writingInputPackage && typeof inherited.writingInputPackage === "object" && !Array.isArray(inherited.writingInputPackage) ? inherited.writingInputPackage : {};
  return {
    nextChapter: Number(chapterBlueprint.chapterNumber || sourceRun.input.chapterNumber || 0) + 1,
    nextPressure: chapterBlueprint.nextPressure || writingInputPackage.nextPressure || "",
    irreversibleChange: chapterBlueprint.irreversibleChange || "",
    protagonistDecision: chapterBlueprint.protagonistDecision || "",
    requiredContinuity: {
      stateLedgerRefs: Array.isArray(chapterBlueprint.stateLedgerRefs) ? chapterBlueprint.stateLedgerRefs : [],
      forbiddenDrift: Array.isArray(chapterBlueprint.forbiddenDrift) ? chapterBlueprint.forbiddenDrift : [],
      requiredCharacters: Array.isArray(chapterBlueprint.requiredCharacters) ? chapterBlueprint.requiredCharacters : []
    }
  };
}
function validateChapterCommitResult(result) {
  const errors = [];
  const warnings = [];
  const frozenChapter = result.frozenChapter && typeof result.frozenChapter === "object" && !Array.isArray(result.frozenChapter) ? result.frozenChapter : {};
  const chapterNumber = Number(frozenChapter.chapterNumber);
  const text = String(frozenChapter.text || "");
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1) errors.push("frozenChapter.chapterNumber \u5FC5\u987B\u662F\u6709\u6548\u7AE0\u8282\u53F7\u3002");
  if (text.trim().length < 500) errors.push("frozenChapter.text \u592A\u77ED\uFF0C\u4E0D\u80FD\u51BB\u7ED3\u4E3A\u7A7A\u6B63\u6587\u6216\u6B8B\u7F3A\u6B63\u6587\u3002");
  if (!String(frozenChapter.sourceDraftRunId || "").trim()) errors.push("frozenChapter.sourceDraftRunId \u7F3A\u5931\uFF0C\u65E0\u6CD5\u8FFD\u6EAF\u7B2C 11 \u8282\u70B9\u6765\u6E90\u3002");
  if (!String(frozenChapter.assetPath || "").trim()) errors.push("frozenChapter.assetPath \u7F3A\u5931\uFF0C\u672A\u5199\u5165\u51BB\u7ED3\u8D44\u4EA7\u3002");
  if (!String(result.commitStatus || "").includes("frozen")) errors.push("commitStatus \u5FC5\u987B\u6807\u8BB0\u4E3A frozen\u3002");
  if (text.length < 1200) warnings.push("\u51BB\u7ED3\u6B63\u6587\u4F4E\u4E8E 1200 \u5B57\uFF0C\u8BF7\u786E\u8BA4\u8FD9\u662F\u4F60\u63A5\u53D7\u7684\u7AE0\u8282\u957F\u5EA6\u3002");
  return { valid: errors.length === 0, errors, warnings };
}
async function executeChapterCommitRun(run) {
  run.status = "running";
  run.startedAt = nowIso();
  run.provider = { modelName: "no-llm", apiMode: "local-freeze" };
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  try {
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(input, null, 2)}
`);
    run.artifacts.push("01-input.json");
    addEvent(run, "info", "12.1-source", "\u5F00\u59CB\u6267\u884C\u7AE0\u8282\u6B63\u6587\u51BB\u7ED3\uFF1A\u8BFB\u53D6\u5DF2\u901A\u8FC7\u7684\u7B2C 11 \u8282\u70B9\u6700\u7EC8\u6B63\u6587\u5019\u9009\u3002", {
      upstreamRunId: input.upstreamRunId,
      chapterNumber: input.chapterNumber
    });
    const sourceRun = await loadRun(input.upstreamRunId);
    if (!sourceRun) throw new Error("chapter_draft_run_not_found");
    if (sourceRun.nodeId !== "chapter-draft") throw new Error("upstream_run_must_be_chapter_draft");
    if (sourceRun.status !== "completed" || sourceRun.validation?.valid !== true || !sourceRun.result) throw new Error("chapter_draft_run_must_be_completed_and_valid");
    const draft = chapterCommitDraftPayload(sourceRun);
    if (!Number.isInteger(draft.chapterNumber) || draft.chapterNumber < 1) throw new Error("chapter_number_missing_from_draft");
    if (Number.isInteger(input.chapterNumber) && input.chapterNumber !== draft.chapterNumber) throw new Error(`chapter_number_mismatch_${input.chapterNumber}_vs_${draft.chapterNumber}`);
    if (!draft.text || draft.text.length < 500) throw new Error("chapter_draft_final_text_missing_or_too_short");
    const projectId = safeAssetSegment(input.factoryProjectId || sourceRun.input.factoryProjectId, "default-project");
    const chapterNumberPadded = String(draft.chapterNumber).padStart(4, "0");
    const projectChapterRoot = path.join(committedChaptersRoot, projectId);
    await fs.mkdir(projectChapterRoot, { recursive: true });
    const assetName = `chapter_${chapterNumberPadded}_${run.runId}.json`;
    const assetPath = path.join(projectChapterRoot, assetName);
    const textAssetName = `chapter_${chapterNumberPadded}_${run.runId}.txt`;
    const textAssetPath = path.join(projectChapterRoot, textAssetName);
    const frozenChapter = {
      version: 1,
      status: "frozen",
      projectId: input.factoryProjectId || sourceRun.input.factoryProjectId,
      chapterNumber: draft.chapterNumber,
      title: draft.title,
      text: draft.text,
      charCount: draft.charCount,
      sourceDraftRunId: sourceRun.runId,
      sourceContextRunId: sourceRun.input.upstreamRunId,
      commitRunId: run.runId,
      committedAt: nowIso(),
      commitNote: input.commitNote,
      modelConfigId: sourceRun.input.modelConfigId,
      provider: sourceRun.provider,
      validation: sourceRun.validation,
      aigc: draft.aigc,
      attempt: draft.attempt,
      assetPath,
      textAssetPath
    };
    const handoff = chapterCommitHandoff(sourceRun);
    const result = {
      version: 1,
      mode: "chapter_commit_debug",
      commitStatus: "frozen_debug_chapter",
      source: {
        phase: "phase_12_chapter_commit",
        chapterDraftRunId: sourceRun.runId,
        singleChapterContextRunId: sourceRun.input.upstreamRunId
      },
      frozenChapter,
      handoff,
      boundary: {
        outputBoundary: "\u672C\u8282\u70B9\u628A\u7B2C 11 \u8282\u70B9\u901A\u8FC7\u7684\u6B63\u6587\u5019\u9009\u51BB\u7ED3\u4E3A\u8C03\u8BD5\u9875\u7AE0\u8282\u8D44\u4EA7\uFF1B\u5F53\u524D\u4E0D\u76F4\u63A5\u5199\u5165\u751F\u4EA7\u6570\u636E\u5E93\u3002",
        productionDbStatus: "not_written",
        nextPhase: "phase_13_next_chapter_context_or_batch_chapter_production"
      }
    };
    await Promise.all([
      fs.writeFile(assetPath, `${JSON.stringify(frozenChapter, null, 2)}
`),
      fs.writeFile(textAssetPath, `${draft.title}

${draft.text}
`),
      fs.writeFile(path.join(runDir, "02-source-chapter-draft-run.json"), `${JSON.stringify(sourceRun, null, 2)}
`),
      fs.writeFile(path.join(runDir, "03-frozen-chapter.json"), `${JSON.stringify(frozenChapter, null, 2)}
`),
      fs.writeFile(path.join(runDir, "04-frozen-chapter.txt"), `${draft.title}

${draft.text}
`),
      fs.writeFile(path.join(runDir, "05-chapter-commit-result.json"), `${JSON.stringify(result, null, 2)}
`)
    ]);
    run.artifacts.push("02-source-chapter-draft-run.json", "03-frozen-chapter.json", "04-frozen-chapter.txt", "05-chapter-commit-result.json");
    run.result = result;
    run.validation = validateChapterCommitResult(result);
    await fs.writeFile(path.join(runDir, "06-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("06-validation.json");
    if (run.validation.valid) {
      run.status = "completed";
      addEvent(run, "success", "12.2-freeze", `\u7B2C ${draft.chapterNumber} \u7AE0\u5DF2\u51BB\u7ED3\u4E3A\u8C03\u8BD5\u7AE0\u8282\u8D44\u4EA7\u3002`, {
        chapterNumber: draft.chapterNumber,
        charCount: draft.charCount,
        assetPath,
        textAssetPath,
        sourceDraftRunId: sourceRun.runId
      });
    } else {
      run.status = "invalid";
      addEvent(run, "error", "12.2-freeze", `\u7AE0\u8282\u6B63\u6587\u51BB\u7ED3\u6821\u9A8C\u5931\u8D25\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, run.validation);
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u7AE0\u8282\u6B63\u6587\u51BB\u7ED3\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
function validateContinuousChapterProductionResult(result, input) {
  const errors = [];
  const warnings = [];
  const chapters = Array.isArray(result.chapters) ? result.chapters : [];
  const expectedCount = input.endChapter - input.startChapter + 1;
  if (String(result.mode || "") !== "continuous_chapter_production_debug") errors.push("mode \u5FC5\u987B\u662F continuous_chapter_production_debug\u3002");
  if (!Number.isInteger(input.startChapter) || !Number.isInteger(input.endChapter) || input.startChapter > input.endChapter) errors.push("\u7AE0\u8282\u8303\u56F4\u65E0\u6548\u3002");
  if (chapters.length !== expectedCount) errors.push(`chapters \u5FC5\u987B\u5305\u542B ${expectedCount} \u7AE0\u7ED3\u679C\u3002`);
  for (let chapter = input.startChapter; chapter <= input.endChapter; chapter += 1) {
    const entry = chapters.find((item) => Number(item.chapterNumber) === chapter);
    if (!entry) {
      errors.push(`\u7F3A\u5C11\u7B2C ${chapter} \u7AE0\u751F\u4EA7\u7ED3\u679C\u3002`);
      continue;
    }
    if (String(entry.status || "") !== "completed") errors.push(`\u7B2C ${chapter} \u7AE0\u672A\u5B8C\u6210\uFF1A${String(entry.status || "unknown")}\u3002`);
    if (!String(entry.contextRunId || "").trim()) errors.push(`\u7B2C ${chapter} \u7AE0\u7F3A\u5C11 contextRunId\u3002`);
    if (!String(entry.draftRunId || "").trim()) errors.push(`\u7B2C ${chapter} \u7AE0\u7F3A\u5C11 draftRunId\u3002`);
    if (!String(entry.commitRunId || "").trim()) errors.push(`\u7B2C ${chapter} \u7AE0\u7F3A\u5C11 commitRunId\u3002`);
    if (!String(entry.assetPath || "").trim()) errors.push(`\u7B2C ${chapter} \u7AE0\u7F3A\u5C11\u51BB\u7ED3\u8D44\u4EA7\u8DEF\u5F84\u3002`);
  }
  const charCounts = chapters.map((item) => Number(item.charCount || 0)).filter((count) => Number.isFinite(count));
  if (charCounts.some((count) => count < 1200)) warnings.push("\u5B58\u5728\u51BB\u7ED3\u6B63\u6587\u4F4E\u4E8E 1200 \u5B57\u7684\u7AE0\u8282\uFF0C\u8BF7\u4EBA\u5DE5\u786E\u8BA4\u957F\u5EA6\u662F\u5426\u53EF\u63A5\u53D7\u3002");
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
async function executeContinuousChapterProductionRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  run.status = "running";
  run.startedAt = nowIso();
  run.error = null;
  run.provider = { modelName: "workflow-orchestrator", apiMode: "local-compose" };
  const chapters = [];
  try {
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify(input, null, 2)}
`);
    run.artifacts.push("01-input.json");
    addEvent(run, "info", "13.1-start", `\u5F00\u59CB\u8FDE\u7EED\u7AE0\u8282\u751F\u4EA7\uFF1A\u7B2C ${input.startChapter}-${input.endChapter} \u7AE0\u3002`, {
      startChapter: input.startChapter,
      endChapter: input.endChapter,
      targetWordCount: input.targetWordCount,
      maxRepairRounds: input.maxRepairRounds,
      aigcPolicy: input.aigcPolicy
    });
    run.result = {
      version: 1,
      mode: "continuous_chapter_production_debug",
      source: {
        phase: "phase_13_continuous_chapter_production",
        styleProfileRunId: input.upstreamRunId,
        startChapter: input.startChapter,
        endChapter: input.endChapter
      },
      chapters,
      boundary: {
        outputBoundary: "\u672C\u8282\u70B9\u53EA\u7F16\u6392\u7B2C 10/11/12 \u8C03\u8BD5\u8282\u70B9\uFF0C\u5E76\u628A\u6BCF\u7AE0\u51BB\u7ED3\u4E3A\u8C03\u8BD5\u7AE0\u8282\u8D44\u4EA7\uFF1B\u5F53\u524D\u4E0D\u76F4\u63A5\u5199\u5165\u751F\u4EA7\u6570\u636E\u5E93\u3002",
        productionDbStatus: "not_written"
      }
    };
    for (let chapterNumber = input.startChapter; chapterNumber <= input.endChapter; chapterNumber += 1) {
      assertRunNotPaused(run);
      addEvent(run, "info", "13.2-chapter", `\u5F00\u59CB\u7B2C ${chapterNumber} \u7AE0\uFF1A\u751F\u6210\u4E0A\u4E0B\u6587\u5305\u3002`, { chapterNumber });
      const contextInput = {
        modelConfigId: input.modelConfigId,
        factoryProjectId: input.factoryProjectId,
        upstreamRunId: input.upstreamRunId,
        chapterNumber,
        contextFocus: input.productionFocus,
        targetWordCount: input.targetWordCount,
        styleProfile: input.styleProfile,
        frozenStyle: input.frozenStyle,
        storyBible: input.storyBible,
        volumeStrategy: input.volumeStrategy,
        chapterBlueprints: input.chapterBlueprints
      };
      const contextRun = {
        runId: `cc_${Date.now()}_${randomUUID().slice(0, 8)}`,
        nodeId: "single-chapter-context",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input: contextInput,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(contextRun, run);
      await executeSingleChapterContextRun(contextRun);
      if (contextRun.status !== "completed" || contextRun.validation?.valid !== true || !contextRun.result) {
        chapters.push({ chapterNumber, status: "failed_at_context", contextRunId: contextRun.runId, errors: contextRun.validation?.errors || [contextRun.error || "context_failed"] });
        throw new Error(`chapter_${chapterNumber}_context_failed`);
      }
      assertRunNotPaused(run);
      addEvent(run, "info", "13.3-draft", `\u7B2C ${chapterNumber} \u7AE0\u4E0A\u4E0B\u6587\u901A\u8FC7\uFF0C\u5F00\u59CB\u6B63\u6587\u751F\u4EA7\u3002`, { chapterNumber, contextRunId: contextRun.runId });
      const draftInput = {
        modelConfigId: input.modelConfigId,
        factoryProjectId: input.factoryProjectId,
        upstreamRunId: contextRun.runId,
        chapterNumber,
        draftFocus: input.productionFocus,
        targetWordCount: input.targetWordCount,
        temperature: input.temperature,
        maxRepairRounds: input.maxRepairRounds,
        aigcPolicy: input.aigcPolicy,
        aigcMinSegmentChars: input.aigcMinSegmentChars,
        singleChapterContext: contextRun.result
      };
      const draftRun = {
        runId: `dr_${Date.now()}_${randomUUID().slice(0, 8)}`,
        nodeId: "chapter-draft",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input: draftInput,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(draftRun, contextRun);
      await executeChapterDraftRun(draftRun);
      if (draftRun.status !== "completed" || draftRun.validation?.valid !== true || !draftRun.result) {
        chapters.push({ chapterNumber, status: "failed_at_draft", contextRunId: contextRun.runId, draftRunId: draftRun.runId, errors: draftRun.validation?.errors || [draftRun.error || "draft_failed"] });
        throw new Error(`chapter_${chapterNumber}_draft_failed`);
      }
      assertRunNotPaused(run);
      addEvent(run, "info", "13.4-freeze", `\u7B2C ${chapterNumber} \u7AE0\u6B63\u6587\u901A\u8FC7\uFF0C\u5F00\u59CB\u81EA\u52A8\u51BB\u7ED3\u3002`, { chapterNumber, draftRunId: draftRun.runId });
      const commitInput = {
        modelConfigId: input.modelConfigId,
        factoryProjectId: input.factoryProjectId,
        upstreamRunId: draftRun.runId,
        chapterNumber,
        commitNote: `\u8FDE\u7EED\u7AE0\u8282\u751F\u4EA7\u81EA\u52A8\u51BB\u7ED3\uFF1A\u7236 Run ${run.runId}`,
        chapterDraft: draftRun.result
      };
      const commitRun = {
        runId: `cm_${Date.now()}_${randomUUID().slice(0, 8)}`,
        nodeId: "chapter-commit",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input: commitInput,
        provider: { modelName: "no-llm", apiMode: "local-freeze" },
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(commitRun, draftRun);
      await executeChapterCommitRun(commitRun);
      if (commitRun.status !== "completed" || commitRun.validation?.valid !== true || !commitRun.result) {
        chapters.push({ chapterNumber, status: "failed_at_commit", contextRunId: contextRun.runId, draftRunId: draftRun.runId, commitRunId: commitRun.runId, errors: commitRun.validation?.errors || [commitRun.error || "commit_failed"] });
        throw new Error(`chapter_${chapterNumber}_commit_failed`);
      }
      const frozen = commitRun.result.frozenChapter && typeof commitRun.result.frozenChapter === "object" && !Array.isArray(commitRun.result.frozenChapter) ? commitRun.result.frozenChapter : {};
      chapters.push({
        chapterNumber,
        status: "completed",
        contextRunId: contextRun.runId,
        draftRunId: draftRun.runId,
        commitRunId: commitRun.runId,
        title: frozen.title,
        charCount: frozen.charCount,
        assetPath: frozen.assetPath
      });
      addEvent(run, "success", "13.5-chapter-complete", `\u7B2C ${chapterNumber} \u7AE0\u5DF2\u5B8C\u6210\u5E76\u51BB\u7ED3\u3002`, chapters.at(-1));
      run.result = { ...run.result || {}, chapters };
      await persistRun(run);
    }
    run.validation = validateContinuousChapterProductionResult(run.result || {}, input);
    await fs.writeFile(path.join(runDir, "90-continuous-chapter-production-result.json"), `${JSON.stringify(run.result, null, 2)}
`);
    await fs.writeFile(path.join(runDir, "91-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("90-continuous-chapter-production-result.json", "91-validation.json");
    run.status = run.validation.valid ? "completed" : "invalid";
    addEvent(
      run,
      run.validation.valid ? "success" : "error",
      "13.6-final",
      run.validation.valid ? `\u8FDE\u7EED\u7AE0\u8282\u751F\u4EA7\u5B8C\u6210\uFF1A\u7B2C ${input.startChapter}-${input.endChapter} \u7AE0\u5DF2\u5168\u90E8\u51BB\u7ED3\u3002` : `\u8FDE\u7EED\u7AE0\u8282\u751F\u4EA7\u7ED3\u679C\u6821\u9A8C\u5931\u8D25\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`,
      run.validation
    );
  } catch (error) {
    if (isDebugRunPausedError(error) || isRunPauseRequested(run)) {
      run.status = "paused";
      run.error = "debug_run_paused_by_user";
      addEvent(run, "warning", "pause", "\u8FDE\u7EED\u7AE0\u8282\u751F\u4EA7\u5DF2\u6682\u505C\uFF1B\u5F53\u524D\u7248\u672C\u4F1A\u5728\u7AE0\u8282\u8FB9\u754C\u505C\u6B62\u3002");
    } else {
      run.status = chapters.length && chapters.some((entry) => String(entry.status || "").startsWith("failed_")) ? "invalid" : "failed";
      run.error = error instanceof Error ? error.message : String(error);
      run.validation = { valid: false, errors: [run.error], warnings: [] };
      addEvent(run, "error", "run", `\u8FDE\u7EED\u7AE0\u8282\u751F\u4EA7\u4E2D\u65AD\uFF1A${run.error}`, { chapters });
    }
  } finally {
    run.result = {
      ...run.result || {},
      version: 1,
      mode: "continuous_chapter_production_debug",
      chapters
    };
    run.completedAt = nowIso();
    await fs.writeFile(path.join(runDir, "92-final-snapshot.json"), `${JSON.stringify({ result: run.result, validation: run.validation }, null, 2)}
`).catch(() => void 0);
    if (!run.artifacts.includes("92-final-snapshot.json")) run.artifacts.push("92-final-snapshot.json");
    await persistRun(run);
  }
}
function compactStyleEvolutionNextSeed(input) {
  const takeShort = (items, limit) => Array.isArray(items) ? items.map((item) => styleDebugText(item).replace(/\s+/gu, " ")).filter(Boolean).slice(0, limit) : [];
  const focus = [
    ...takeShort(input.evaluation.nextFocus, 3),
    ...takeShort(input.refinement.promptAdjustments, 3),
    ...takeShort(input.refinement.contractAdjustments, 2)
  ];
  const dedupedFocus = [...new Set(focus)].filter((item) => item.length <= 120).slice(0, 5);
  return [
    input.baseSeedPrompt,
    input.userStylePrompt ? `\u7528\u6237\u539F\u59CB\u6587\u98CE\u5173\u6CE8\uFF1A${input.userStylePrompt}` : "",
    input.aigcLessons?.length ? "AIGC \u81EA\u8FDB\u5316\u8BB0\u5FC6\uFF08\u4E0B\u8F6E\u5FC5\u987B\u4F18\u5148\u4FEE\u6B63\uFF0C\u4E0D\u80FD\u91CD\u590D\u5931\u8D25\u6A21\u5F0F\uFF09\uFF1A" : "",
    ...(input.aigcLessons || []).slice(-8).map((item) => `- ${item}`),
    dedupedFocus.length ? "\u4E0A\u4E00\u8F6E\u9700\u8981\u4FEE\u6B63\u7684\u91CD\u70B9\uFF08\u53EA\u7EE7\u627F\u8FD9\u4E9B\uFF0C\u4E0D\u590D\u5236\u65E7 prompt\uFF09\uFF1A" : "",
    ...dedupedFocus.map((item) => `- ${item}`)
  ].filter(Boolean).join("\n").slice(0, 1800);
}
function normalizeStyleDebugAigcMode(input) {
  const granularity = String(input.aigcGranularity || "merged_sentence").trim();
  const policy = String(input.aigcPolicy || "balanced").trim();
  const minSegmentChars = Math.max(20, Math.min(500, Number(input.aigcMinSegmentChars || 120)));
  return {
    granularity,
    policy,
    minSegmentChars
  };
}
async function detectStyleDebugAigcSignal(sample, config, context, options = {}) {
  const diagnostics = {
    urlConfigured: Boolean(config.url?.trim()),
    context,
    mode: `${options.granularity || "node09"}:${options.policy || "strict_any_sentence"}`
  };
  try {
    const granularity = String(options.granularity || "node09");
    const policy = String(options.policy || "strict_any_sentence");
    const minSegmentChars = Math.max(20, Math.min(500, Number(options.minSegmentChars || 120)));
    const threshold = config.threshold ?? 0.8;
    const segments = granularity === "node09" ? null : splitAigcLabTextIntoSentenceSegments(sample, { granularity, minSegmentChars });
    const result = await detectAigcSegments(segments || sample, config);
    const signal = normalizeStyleAigcSignal(result, diagnostics);
    if (granularity === "node09" && policy === "strict_any_sentence") return signal;
    const passDecision = aigcLabPassDecision({
      policy,
      score: result.score,
      threshold,
      highRiskCount: Array.isArray(result.highRiskSegments) ? result.highRiskSegments.length : 0,
      totalSentences: Array.isArray(result.segments) ? result.segments.length : 0
    });
    const status = passDecision.passed ? "passed" : "blocked";
    return {
      ...signal,
      status,
      reason: [
        signal.reason,
        `AIGC strategy=${granularity}/${passDecision.policy}.`,
        passDecision.reason
      ].filter(Boolean).join(" "),
      diagnostics: [
        ...signal.diagnostics || [],
        `granularity=${granularity}`,
        `policy=${passDecision.policy}`,
        `minSegmentChars=${minSegmentChars}`,
        `strategyDecision=${passDecision.passed ? "passed" : "blocked"}`
      ]
    };
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
async function executeStyleAigcCalibrationRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const aigcConfig = getAigcDetectorConfig(rootDir);
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "aigc-calibration", "\u5F00\u59CB\u6821\u51C6 AIGC \u68C0\u6D4B\u5668\uFF1A\u53EA\u8C03\u7528\u68C0\u6D4B\u670D\u52A1\uFF0C\u4E0D\u8C03\u7528\u6587\u672C\u751F\u6210\u6A21\u578B\u3002", {
    provider: aigcConfig.provider ?? "disabled",
    urlConfigured: Boolean(aigcConfig.url?.trim()),
    threshold: aigcConfig.threshold ?? 0.8
  });
  await fs.mkdir(runDir, { recursive: true });
  try {
    const recentStyleRuns = (await listStyleProfileDebugRuns()).filter((item) => item.runId !== run.runId);
    const humanSamples = splitStyleHumanBaselineSamples(String(input.humanBaselineText || "")).map((text, index) => ({
      group: "human_reference",
      label: `\u624B\u52A8\u771F\u4EBA\u53C2\u8003 ${index + 1}`,
      text,
      sourceRunId: "manual"
    }));
    const approvedSamples = recentStyleRuns.filter((item) => item.status === "completed").flatMap((item) => styleCalibrationSampleFromRun(item, "approved_style_candidate", 1)).slice(0, 6);
    const failedSamples = recentStyleRuns.filter((item) => item.status === "invalid" || item.status === "failed" || item.status === "completed").flatMap((item) => styleCalibrationSampleFromRun(item, "recent_failed_candidate", 2)).slice(0, 8);
    const samples = [...humanSamples, ...approvedSamples, ...failedSamples];
    await fs.writeFile(path.join(runDir, "01-aigc-calibration-input.json"), `${JSON.stringify({
      upstreamRunId: input.upstreamRunId,
      sampleChapter: input.sampleChapter,
      humanBaselineCount: humanSamples.length,
      approvedStyleCandidateCount: approvedSamples.length,
      recentFailedCandidateCount: failedSamples.length,
      aigcConfig: {
        provider: aigcConfig.provider ?? "disabled",
        urlConfigured: Boolean(aigcConfig.url?.trim()),
        threshold: aigcConfig.threshold ?? 0.8
      }
    }, null, 2)}
`);
    run.artifacts.push("01-aigc-calibration-input.json");
    addEvent(run, samples.length ? "success" : "warning", "aigc-calibration", samples.length ? `\u5DF2\u6536\u96C6 ${samples.length} \u6761\u6821\u51C6\u6837\u672C\uFF0C\u5F00\u59CB\u9010\u6761\u68C0\u6D4B\u3002` : "\u6CA1\u6709\u53EF\u6821\u51C6\u6837\u672C\uFF1B\u8BF7\u7C98\u8D34\u771F\u4EBA\u53C2\u8003\u6837\u672C\uFF0C\u6216\u5148\u8FD0\u884C\u51E0\u8F6E\u6587\u98CE\u8282\u70B9\u5F62\u6210\u5931\u8D25/\u901A\u8FC7\u6837\u672C\u3002", {
      humanBaselineCount: humanSamples.length,
      approvedStyleCandidateCount: approvedSamples.length,
      recentFailedCandidateCount: failedSamples.length
    });
    const checkedSamples = [];
    for (const [index, sample] of samples.entries()) {
      const signal = await detectStyleDebugAigcSignal(sample.text, aigcConfig, `style-aigc-calibration-${sample.group}-${index + 1}`);
      const record = {
        index: index + 1,
        group: sample.group,
        label: sample.label,
        sourceRunId: sample.sourceRunId,
        round: "round" in sample ? sample.round : void 0,
        chars: sample.text.length,
        preview: sample.text.replace(/\s+/gu, " ").slice(0, 180),
        aigc: signal
      };
      checkedSamples.push(record);
      addEvent(run, signal.status === "passed" ? "success" : "warning", "aigc-calibration", `${sample.label}\uFF1AAIGC ${signal.status}${typeof signal.score === "number" ? `\uFF0Cscore=${signal.score.toFixed(4)}` : ""}\u3002`, {
        group: sample.group,
        chars: sample.text.length,
        score: signal.score,
        threshold: signal.threshold,
        highRiskCount: signal.highRiskCount,
        preview: record.preview
      });
      await persistRun(run);
    }
    const groups = ["human_reference", "approved_style_candidate", "recent_failed_candidate"].map((group) => {
      const groupSamples = checkedSamples.filter((sample) => sample.group === group);
      const scores = groupSamples.map((sample) => {
        const aigc = sample.aigc && typeof sample.aigc === "object" && !Array.isArray(sample.aigc) ? sample.aigc : {};
        return typeof aigc.score === "number" ? aigc.score : null;
      }).filter((score) => typeof score === "number");
      const blockedCount = groupSamples.filter((sample) => {
        const aigc = sample.aigc && typeof sample.aigc === "object" && !Array.isArray(sample.aigc) ? sample.aigc : {};
        return aigc.status === "blocked";
      }).length;
      return {
        group,
        count: groupSamples.length,
        averageScore: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
        maxScore: scores.length ? Math.max(...scores) : null,
        blockedCount,
        passRate: groupSamples.length ? (groupSamples.length - blockedCount) / groupSamples.length : null
      };
    });
    const groupByName = Object.fromEntries(groups.map((entry) => [entry.group, entry]));
    const humanGroup = groupByName.human_reference;
    const failedGroup = groupByName.recent_failed_candidate;
    const approvedGroup = groupByName.approved_style_candidate;
    const errors = [];
    const warnings = [];
    let trustLevel = "unknown";
    if (!humanGroup?.count) {
      warnings.push("\u7F3A\u5C11\u771F\u4EBA\u53C2\u8003\u6837\u672C\uFF1A\u65E0\u6CD5\u5224\u65AD\u68C0\u6D4B\u5668\u662F\u5426\u5BF9\u7384\u5E7B/\u4FEE\u4ED9\u9898\u6750\u5929\u7136\u504F\u9AD8\uFF1B\u5EFA\u8BAE\u7C98\u8D34 2\u20135 \u6BB5\u540C\u9898\u6750\u771F\u4EBA\u6587\u672C\u540E\u518D\u6821\u51C6\u3002");
    } else if ((humanGroup.passRate ?? 0) < 0.7) {
      errors.push(`\u771F\u4EBA\u53C2\u8003\u6837\u672C\u901A\u8FC7\u7387\u53EA\u6709 ${Math.round((humanGroup.passRate ?? 0) * 100)}%\uFF0C\u68C0\u6D4B\u5668\u53EF\u80FD\u4E0E\u5F53\u524D\u9898\u6750\u57DF\u4E0D\u5339\u914D\uFF1B\u4E0D\u5EFA\u8BAE\u628A\u5B83\u4F5C\u4E3A\u552F\u4E00\u786C\u95E8\u7981\u3002`);
      trustLevel = "domain_mismatch";
    } else if ((failedGroup?.count || 0) > 0 && (failedGroup?.blockedCount || 0) > 0) {
      trustLevel = "usable";
    } else {
      warnings.push("\u771F\u4EBA\u6837\u672C\u57FA\u672C\u80FD\u8FC7\uFF0C\u4F46\u8FD1\u671F\u5931\u8D25\u6837\u672C\u4E0D\u8DB3\uFF1B\u5F53\u524D\u53EA\u80FD\u8BC1\u660E\u68C0\u6D4B\u670D\u52A1\u53EF\u7528\uFF0C\u8FD8\u4E0D\u80FD\u8BC1\u660E\u5B83\u80FD\u7A33\u5B9A\u533A\u5206\u672C\u9879\u76EE\u5931\u8D25\u6A21\u5F0F\u3002");
      trustLevel = "unknown";
    }
    if ((approvedGroup?.count || 0) > 0 && (approvedGroup?.blockedCount || 0) > 0) {
      warnings.push("\u5386\u53F2\u5DF2\u901A\u8FC7\u5019\u9009\u5728\u5F53\u524D\u68C0\u6D4B\u914D\u7F6E\u4E0B\u4ECD\u88AB\u62E6\u622A\uFF0C\u8BF4\u660E\u9608\u503C/\u6A21\u578B\u7248\u672C/\u89E3\u6790\u89C4\u5219\u53D1\u751F\u8FC7\u53D8\u5316\uFF0C\u9700\u8981\u91CD\u65B0\u51BB\u7ED3\u901A\u8FC7\u6807\u51C6\u3002");
    }
    if (!samples.length) errors.push("\u6CA1\u6709\u53EF\u68C0\u6D4B\u6837\u672C\u3002");
    const result = {
      version: 1,
      mode: "aigc_detector_calibration",
      source: {
        chapterBlueprintRunId: input.upstreamRunId,
        phase: "phase_09a_aigc_detector_calibration",
        sampleChapter: input.sampleChapter
      },
      aigcConfig: {
        provider: aigcConfig.provider ?? "disabled",
        urlConfigured: Boolean(aigcConfig.url?.trim()),
        threshold: aigcConfig.threshold ?? 0.8
      },
      trustLevel,
      groups,
      samples: checkedSamples,
      conclusion: trustLevel === "usable" ? "\u68C0\u6D4B\u5668\u5728\u5F53\u524D\u6837\u672C\u4E0A\u5177\u5907\u57FA\u672C\u533A\u5206\u80FD\u529B\uFF1A\u771F\u4EBA\u53C2\u8003\u53EF\u8FC7\uFF0C\u8FD1\u671F\u5931\u8D25\u6837\u6BB5\u4F1A\u88AB\u62E6\u622A\u3002\u4E0B\u4E00\u6B65\u53EF\u7EE7\u7EED\u8BA9\u6587\u98CE\u8282\u70B9\u505A\u5B9A\u5411\u81EA\u8FDB\u5316\u3002" : trustLevel === "domain_mismatch" ? "\u68C0\u6D4B\u5668\u5BF9\u771F\u4EBA\u53C2\u8003\u4E5F\u5927\u91CF\u8BEF\u6740\uFF0C\u8BF4\u660E\u95EE\u9898\u4E0D\u53EA\u662F\u751F\u6210\u6A21\u578B\uFF1B\u9700\u8981\u66F4\u6362\u68C0\u6D4B\u5668\u3001\u8C03\u6574\u9608\u503C\uFF0C\u6216\u628A AIGC \u4ECE\u786C\u95E8\u7981\u964D\u7EA7\u4E3A\u4EBA\u5DE5\u8F85\u52A9\u6307\u6807\u3002" : "\u6821\u51C6\u8BC1\u636E\u4E0D\u8DB3\uFF1A\u73B0\u5728\u7EE7\u7EED\u5FAA\u73AF\u53EF\u80FD\u4ECD\u4F1A\u76F2\u4FEE\u3002\u8BF7\u589E\u52A0\u771F\u4EBA\u53C2\u8003\u6837\u672C\uFF0C\u6216\u5148\u79EF\u7D2F\u66F4\u591A\u5931\u8D25/\u901A\u8FC7\u6837\u6BB5\u3002",
      nextActions: [
        "\u5982\u679C trustLevel=usable\uFF1A\u8FD0\u884C\u6587\u98CE\u81EA\u8FDB\u5316\u8282\u70B9\uFF0C\u89C2\u5BDF AIGC \u5206\u6570\u662F\u5426\u9010\u8F6E\u4E0B\u964D\u3002",
        "\u5982\u679C trustLevel=domain_mismatch\uFF1A\u5148\u4E0D\u8981\u7EE7\u7EED\u65E0\u9650\u91CD\u8BD5\u751F\u6210\u5668\uFF0C\u4F18\u5148\u6362\u68C0\u6D4B\u5668\u6216\u91CD\u65B0\u8BBE\u9608\u503C\u3002",
        "\u5982\u679C trustLevel=unknown\uFF1A\u7C98\u8D34 2\u20135 \u6BB5\u540C\u9898\u6750\u771F\u4EBA\u53C2\u8003\u6837\u672C\u540E\u518D\u6B21\u6821\u51C6\u3002"
      ]
    };
    run.result = result;
    run.validation = { valid: errors.length === 0, errors, warnings };
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-aigc-calibration-result.json"), `${JSON.stringify(result, null, 2)}
`),
      fs.writeFile(path.join(runDir, "03-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`)
    ]);
    run.artifacts.push("02-aigc-calibration-result.json", "03-validation.json");
    run.status = run.validation.valid ? "completed" : "invalid";
    addEvent(run, run.validation.valid ? "success" : "error", "aigc-calibration", run.validation.valid ? `AIGC \u6821\u51C6\u5B8C\u6210\uFF1AtrustLevel=${trustLevel}\u3002` : `AIGC \u6821\u51C6\u672A\u901A\u8FC7\uFF1A${errors.length} \u4E2A\u963B\u65AD\u95EE\u9898\u3002`, {
      trustLevel,
      errors,
      warnings,
      groups
    });
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "aigc-calibration", `AIGC \u6821\u51C6\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
function attachAigcToStyleEvaluation(evaluation, aigcSignal, aigcRepairLessons = buildStyleAigcRepairLessons(aigcSignal)) {
  const aigcFailed = aigcSignal.status !== "passed";
  return {
    ...evaluation,
    aigc: aigcSignal,
    verdict: aigcFailed ? "retry" : evaluation.verdict,
    deviations: [
      ...Array.isArray(evaluation.deviations) ? evaluation.deviations : [],
      ...aigcFailed ? [`AIGC \u68C0\u6D4B\u672A\u901A\u8FC7\uFF1A${aigcSignal.reason}`] : []
    ],
    forbiddenHits: [
      ...Array.isArray(evaluation.forbiddenHits) ? evaluation.forbiddenHits : [],
      ...aigcSignal.status === "blocked" ? ["AIGC_HIGH_RISK"] : [],
      ...aigcSignal.status === "unavailable" ? ["AIGC_UNAVAILABLE"] : []
    ],
    nextFocus: [
      ...Array.isArray(evaluation.nextFocus) ? evaluation.nextFocus : [],
      ...aigcFailed ? aigcRepairLessons : []
    ]
  };
}
function buildStyleAigcRepairLessons(aigcSignal, sample = "", consecutiveFailures = 1) {
  if (aigcSignal.status === "passed") return [];
  const score = typeof aigcSignal.score === "number" ? aigcSignal.score : null;
  const threshold = typeof aigcSignal.threshold === "number" ? aigcSignal.threshold : 0.8;
  const previews = Array.isArray(aigcSignal.highRiskPreviews) ? aigcSignal.highRiskPreviews.map((item) => styleDebugText(item).replace(/\s+/gu, " ")).filter(Boolean) : [];
  const normalizedSample = sample.replace(/\s+/gu, "");
  const startsWithGrandScene = /裂缝|岩层|天壁|护山大阵|灵力|倒计时|追杀令|威压/u.test(normalizedSample.slice(0, 80));
  const denseMetricTone = /每息|三寸|两尺|百分|倒计时|进度|灵力|脉冲|频率/u.test(normalizedSample);
  const polishedActionStack = /脊背紧贴|肩胛|肌肉|呼吸|瞳孔|指节|骤然|缓慢|簌簌|薄雾/u.test(normalizedSample);
  return [
    `AIGC \u786C\u95E8\u7981\u5931\u8D25\uFF1A\u5F53\u524D AI \u6982\u7387 ${score === null ? "\u672A\u77E5" : score.toFixed(3)}\uFF0C\u9608\u503C ${threshold.toFixed(3)}\uFF1B\u8FDE\u7EED\u5931\u8D25 ${consecutiveFailures} \u8F6E\u3002`,
    previews[0] ? `\u68C0\u6D4B\u5668\u9AD8\u98CE\u9669\u7247\u6BB5\u5F00\u5934\uFF1A${previews[0].slice(0, 120)}\u3002\u4E0B\u8F6E\u4E0D\u5F97\u590D\u7528\u8BE5\u5F00\u573A\u8282\u594F\u3001\u610F\u8C61\u6392\u5217\u6216\u53E5\u5F0F\u5BC6\u5EA6\u3002` : "",
    startsWithGrandScene ? "\u4E0D\u8981\u518D\u7528\u201C\u88C2\u7F1D/\u5CA9\u5C42/\u5929\u58C1/\u5927\u9635/\u7075\u529B\u201D\u7B49\u5B8F\u89C2\u5371\u673A\u8BCD\u5F00\u7BC7\uFF1B\u6539\u6210\u4E00\u4E2A\u5F88\u5C0F\u7684\u3001\u4EBA\u624B\u80FD\u78B0\u5230\u7684\u7269\u4EF6\u6216\u4E00\u53E5\u4E0D\u5B8C\u6574\u7684\u4F4E\u58F0\u5BF9\u767D\u5F00\u573A\u3002" : "",
    denseMetricTone ? "\u51CF\u5C11\u8FDE\u7EED\u6570\u503C\u3001\u8FDB\u5EA6\u3001\u9891\u7387\u3001\u7075\u529B\u8109\u51B2\u7684\u786C\u8BBE\u5B9A\u5806\u53E0\uFF1B\u6570\u503C\u53EA\u4FDD\u7559 1 \u4E2A\uFF0C\u5176\u4ED6\u901A\u8FC7\u4EBA\u7269\u52A8\u4F5C\u548C\u65C1\u4EBA\u53CD\u5E94\u95F4\u63A5\u5448\u73B0\u3002" : "",
    polishedActionStack ? "\u4E0D\u8981\u8FDE\u7EED\u5806\u53E0\u810A\u80CC\u3001\u80A9\u80DB\u3001\u808C\u8089\u3001\u547C\u5438\u3001\u77B3\u5B54\u3001\u6307\u8282\u7B49\u5DE5\u6574\u8EAB\u4F53\u53CD\u5E94\uFF1B\u4FDD\u7559 1 \u4E2A\u8EAB\u4F53\u7EC6\u8282\uFF0C\u5176\u4F59\u6362\u6210\u751F\u6D3B\u5316\u5C0F\u52A8\u4F5C\u3001\u8FDF\u7591\u3001\u8BEF\u542C\u3001\u6253\u65AD\u3002" : "",
    "\u4E0B\u8F6E\u5199\u6CD5\u6539\u6210\u66F4\u4E0D\u5DE5\u6574\u7684\u4EBA\u7C7B\u8349\u7A3F\u611F\uFF1A\u53E5\u957F\u4E0D\u5747\u3001\u5141\u8BB8\u4E00\u5904\u8F7B\u5FAE\u505C\u987F\u6216\u91CD\u590D\u3001\u5C11\u7528\u6210\u5957\u4FEE\u8F9E\uFF0C\u907F\u514D\u6BCF\u53E5\u90FD\u50CF\u7CBE\u4FEE\u793A\u8303\u6587\u3002",
    "\u6BCF\u6BB5\u53EA\u627F\u62C5\u4E00\u4E2A\u52A8\u4F5C\u6216\u4E00\u4E2A\u5224\u65AD\uFF0C\u4E0D\u8981\u628A\u73AF\u5883\u3001\u8BBE\u5B9A\u3001\u5FC3\u7406\u3001\u6218\u672F\u540C\u65F6\u585E\u8FDB\u540C\u4E00\u53E5\u3002"
  ].filter(Boolean);
}
async function generateStyleDebugText(run, config, input) {
  let lastStreamEventAt = 0;
  const controller = ensureRunAbortController(run);
  assertRunNotPaused(run);
  return generateAgentReply({
    roleName: input.roleName,
    basePrompt: input.system,
    dynamicPrompt: "",
    consensus: "",
    message: input.user,
    currentStage: input.phase,
    responseMode: input.phase === "style_evolution_candidate" || input.phase === "chapter_draft_initial" ? "drafting" : "artifact",
    preferredLanguage: "zh-CN",
    envRootDir: rootDir,
    providerOverride: debugProviderOverride(config),
    temperature: input.temperature,
    signal: controller.signal,
    onUsage: trackLlmCacheUsage(run, input.roleName),
    onDelta: input.streamToRaw ? async (delta) => {
      assertRunNotPaused(run);
      run.rawResponse += delta;
      const now = Date.now();
      if (!lastStreamEventAt || now - lastStreamEventAt >= 1e3) {
        lastStreamEventAt = now;
        addEvent(run, "stream", "llm", `${input.roleName} \u6B63\u5728\u8F93\u51FA\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, {
          responseChars: run.rawResponse.length,
          tail: run.rawResponse.slice(-220)
        });
        await persistRun(run);
      }
    } : void 0
  });
}
async function chapterBlueprintPriorStateLedger(input) {
  const priorRuns = await listChapterBlueprintRuns({ upstreamRunId: input.upstreamRunId, volumeId: input.volumeId });
  return priorRuns.filter((candidate) => candidate.input.endChapter < input.startChapter).map(chapterBlueprintStateSnapshotFromRun).filter((entry) => Boolean(entry)).sort((a, b) => a.startChapter - b.startChapter);
}
async function loadLearningForChapterBlueprintRun(run, modelName) {
  const input = run.input;
  const stateLedger = await chapterBlueprintPriorStateLedger(input);
  run.learning = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: input.storyBible,
    modelName,
    runId: run.runId,
    stateLedger
  });
  const artifact = "01d-learning-context.json";
  await fs.writeFile(path.join(runsRoot, run.runId, artifact), `${JSON.stringify(run.learning, null, 2)}
`);
  if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact);
  addEvent(run, "success", "learning", `\u5DF2\u52A0\u8F7D Learning Loop\uFF1A${run.learning.activeExperiences.length} \u6761\u751F\u6548\u7ECF\u9A8C\u3001${run.learning.stateLedger.length} \u4E2A\u5386\u53F2\u6279\u6B21\u72B6\u6001\u3001${run.learning.conflicts.length} \u4E2A\u672A\u89E3\u51B3\u51B2\u7A81\u3002`, {
    promptVersion: run.learning.promptVersion,
    projectId: run.learning.projectId,
    projectLabel: run.learning.projectLabel,
    modelKey: run.learning.modelKey,
    activeExperienceCount: run.learning.activeExperiences.length,
    candidateExperienceCount: run.learning.candidateExperiences.length,
    stateLedgerCount: run.learning.stateLedger.length,
    conflictCount: run.learning.conflicts.length,
    memoryPaths: run.learning.memoryPaths
  });
  await persistRun(run);
  return run.learning;
}
async function learnFromChapterBlueprintRepair(input) {
  const run = input.run;
  if (!run.learning) return { stop: false, reason: "" };
  const round = run.learning.attempts.filter((entry) => entry.runId === run.runId).length + 1;
  run.learning = await recordChapterBlueprintLearningAttempt({
    rootDir,
    context: run.learning,
    runId: run.runId,
    round,
    beforeErrors: input.beforeErrors,
    afterErrors: input.afterErrors,
    passed: input.passed
  });
  const latestAttempt = run.learning.attempts.filter((entry) => entry.runId === run.runId).at(-1);
  const artifact = `learning-attempt-${String(round).padStart(2, "0")}.json`;
  await fs.writeFile(path.join(runsRoot, run.runId, artifact), `${JSON.stringify({ attempt: latestAttempt, learning: run.learning }, null, 2)}
`);
  if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact);
  addEvent(run, input.passed ? "success" : "info", "learning", input.passed ? `Learning Loop \u7B2C ${round} \u8F6E\u5DF2\u9A8C\u8BC1\u6210\u529F\uFF1B\u6210\u529F\u7ECF\u9A8C\u5DF2\u5199\u5165\u5206\u5C42\u8BB0\u5FC6\u3002` : `Learning Loop \u7B2C ${round} \u8F6E\u5DF2\u5B8C\u6210\u5F52\u56E0\uFF1A\u89E3\u51B3 ${latestAttempt?.resolvedFingerprints.length || 0} \u7C7B\uFF0C\u5F15\u5165 ${latestAttempt?.introducedFingerprints.length || 0} \u7C7B\uFF0C\u4ECD\u6709 ${latestAttempt?.remainingFingerprints.length || 0} \u7C7B\u3002`, {
    round,
    attempt: latestAttempt || null,
    activeExperienceCount: run.learning.activeExperiences.length,
    candidateExperienceCount: run.learning.candidateExperiences.length,
    conflicts: run.learning.conflicts
  });
  const stop = chapterBlueprintLearningShouldStop(run.learning, run.runId);
  if (stop.stop) addEvent(run, "error", "learning-conflict", `Learning Loop \u4E3B\u52A8\u505C\u6B62\uFF1A${stop.reason}`, { conflict: stop.conflict });
  await persistRun(run);
  return stop;
}
async function persistCompletedChapterBlueprintState(run) {
  if (!run.learning) return;
  const snapshot = chapterBlueprintStateSnapshotFromRun(run);
  if (!snapshot) return;
  run.learning = await recordChapterBlueprintStateSnapshot({ context: run.learning, snapshot });
  const artifact = "learning-project-state-snapshot.json";
  await fs.writeFile(path.join(runsRoot, run.runId, artifact), `${JSON.stringify(snapshot, null, 2)}
`);
  if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact);
  addEvent(run, "success", "learning", `\u5DF2\u628A\u7B2C ${snapshot.startChapter}-${snapshot.endChapter} \u7AE0\u9000\u51FA\u72B6\u6001\u5199\u5165\u672C\u5C0F\u8BF4\u8BB0\u5FC6\uFF1B\u4E0D\u4F1A\u8FDB\u5165\u7CFB\u7EDF\u7EA7\u5C0F\u8BF4\u5185\u5BB9\u3002`, {
    projectId: run.learning.projectId,
    stateLedgerCount: run.learning.stateLedger.length
  });
}
async function withChapterBlueprintEffectiveOutputWatchdog(run, label, operation) {
  let timer = null;
  let rejectWatchdog = null;
  let timedOut = false;
  const timeoutMs = Math.max(1e3, Number(run.provider?.timeoutMs || chapterBlueprintLlmActivityTimeoutMs));
  const resetTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      rejectWatchdog?.(new Error(`${label} ${timeoutMs}ms \u5185\u6CA1\u6709\u65B0\u589E\u6709\u6548\u6587\u672C\uFF1B\u6A21\u578B\u6D41\u53EF\u80FD\u5DF2\u60AC\u6302\uFF0C\u8BF7\u91CD\u8BD5\u6216\u5207\u6362\u6A21\u578B\u3002`));
    }, timeoutMs);
  };
  const watchdog = new Promise((_, reject) => {
    rejectWatchdog = reject;
    resetTimer();
  });
  try {
    return await Promise.race([
      operation(() => {
        if (timedOut) throw new Error(`${label} \u5DF2\u56E0\u65E0\u6709\u6548\u8F93\u51FA\u8D85\u65F6\u3002`);
        resetTimer();
      }),
      watchdog
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    rejectWatchdog = null;
  }
}
async function executeChapterBlueprintRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const chapterCount = input.endChapter - input.startChapter + 1;
  const maximumAutoRepairRounds = chapterBlueprintRepairSafetyLimit;
  run.status = "running";
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u72EC\u7ACB\u6267\u884C\u7AE0\u8282\u84DD\u56FE\u6279\u6B21\u8282\u70B9\u3002", { runId: run.runId, isolated: true, productionPhase: "phase_9_chapter_blueprints" });
  addEvent(run, "success", "upstream", "\u5DF2\u4ECE\u670D\u52A1\u7AEF\u9501\u5B9A\u901A\u8FC7\u9A8C\u8BC1\u7684\u5206\u5377\u7B56\u7565 Run\u3002", {
    upstreamRunId: input.upstreamRunId,
    volumeId: input.volumeId,
    startChapter: input.startChapter,
    endChapter: input.endChapter,
    chapterCount
  });
  addEvent(run, "info", "boundary", "\u8282\u70B9\u8FB9\u754C\u5DF2\u51BB\u7ED3\uFF1A\u53EA\u751F\u6210\u6307\u5B9A\u5377\u5185\u8FDE\u7EED\u7AE0\u8282\u84DD\u56FE\uFF0C\u4E0D\u751F\u6210\u5199\u4F5C\u8BA1\u5212\u6216\u6B63\u6587\u3002", {
    allowedPhase: "phase_9_chapter_blueprints",
    nextPhase: "phase_10_writing_plan",
    maximumBatchSize: 12,
    forbiddenOutputs: ["writingPlan", "chapterDrafts", "prose", "draftText"]
  });
  await fs.mkdir(runDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, blueprintFocus: input.blueprintFocus, volumeId: input.volumeId, startChapter: input.startChapter, endChapter: input.endChapter, targetWordCount: input.targetWordCount, temperature: input.temperature, previousBatchRunId: input.previousBatchRunId, previousBatchHandoff: input.previousBatchHandoff }, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01b-upstream-volume-strategy.json"), `${JSON.stringify(input.volumeStrategy, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01c-upstream-story-bible.json"), `${JSON.stringify(input.storyBible, null, 2)}
`)
  ]);
  run.artifacts.push("01-input.json", "01b-upstream-volume-strategy.json", "01c-upstream-story-bible.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    const chapterTimeoutMs = Math.max(chapterBlueprintLlmActivityTimeoutMs, Math.min(3e5, Number(config.provider.timeoutMs || chapterBlueprintLlmActivityTimeoutMs)));
    const chapterProviderOverride = debugProviderOverride(config, chapterTimeoutMs);
    run.provider = { configId: config._configId, configName: config._configName || config.provider.modelName, baseUrl: config.provider.baseUrl, modelName: config.provider.modelName, apiMode: config.provider.apiMode, timeoutMs: chapterProviderOverride.timeoutMs, configuredTimeoutMs: config.provider.timeoutMs, temperature: input.temperature, apiKey: "[REDACTED]" };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    await loadLearningForChapterBlueprintRun(run, config.provider.modelName);
    const upstreamCanonPreflight = detectChapterBlueprintUpstreamCanonConflicts(input);
    await fs.writeFile(path.join(runDir, "01e-upstream-canon-preflight.json"), `${JSON.stringify(upstreamCanonPreflight, null, 2)}
`);
    run.artifacts.push("01e-upstream-canon-preflight.json");
    if (!upstreamCanonPreflight.valid) {
      run.status = "invalid";
      run.validation = {
        valid: false,
        errors: upstreamCanonPreflight.errors,
        warnings: [
          ...upstreamCanonPreflight.warnings,
          "\u4E0A\u6E38\u6B63\u5178\u9884\u68C0\u672A\u901A\u8FC7\uFF0C\u672C\u6B21\u4E0D\u4F1A\u8BF7\u6C42\u6A21\u578B\u751F\u6210\uFF0C\u4E5F\u4E0D\u4F1A\u8FDB\u5165\u81EA\u52A8\u4FEE\u590D loop\uFF1B\u8BF7\u5148\u4FEE\u6B63\u4E0A\u6E38\u901A\u8FC7\u6279\u6B21\u6216\u5206\u5377/\u5F27\u7EBF\u51FA\u53E3\u3002\u810F\u8F93\u5165\u65E0\u9650\u91CD\u8BD5\u53EA\u4F1A\u53CD\u590D\u70E7 token\u3002"
        ]
      };
      addEvent(run, "error", "upstream-canon-conflict", "\u4E0A\u6E38\u6B63\u5178\u9884\u68C0\u5931\u8D25\uFF1A\u7AE0\u8282\u84DD\u56FE\u8F93\u5165\u5408\u540C\u4E92\u76F8\u77DB\u76FE\uFF0C\u5DF2\u505C\u6B62\u6A21\u578B\u8C03\u7528\u3002", {
        errors: upstreamCanonPreflight.errors,
        warnings: upstreamCanonPreflight.warnings,
        evidence: upstreamCanonPreflight.evidence
      });
      return;
    }
    addEvent(run, upstreamCanonPreflight.warnings.length ? "warning" : "success", "upstream-canon-preflight", upstreamCanonPreflight.warnings.length ? "\u4E0A\u6E38\u6B63\u5178\u9884\u68C0\u901A\u8FC7\uFF0C\u4F46\u5B58\u5728\u9700\u8981\u4EBA\u5DE5\u5173\u6CE8\u7684\u8FDE\u7EED\u6027\u63D0\u793A\u3002" : "\u4E0A\u6E38\u6B63\u5178\u9884\u68C0\u901A\u8FC7\uFF0C\u672A\u53D1\u73B0\u5DF2\u77E5\u4E0D\u53EF\u6536\u655B\u7684\u8F93\u5165\u5408\u540C\u51B2\u7A81\u3002", {
      warnings: upstreamCanonPreflight.warnings,
      evidence: upstreamCanonPreflight.evidence
    });
    const performSemanticAudit = async (candidate, round, artifactPrefix) => {
      const auditPrompts = buildChapterBlueprintSemanticAuditPrompts(input, candidate, run.runId, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "");
      const prefix = artifactPrefix || (round === "initial" ? "07a" : "11a");
      await Promise.all([
        fs.writeFile(path.join(runDir, `${prefix}-semantic-audit-system.md`), `${auditPrompts.basePrompt}
`),
        fs.writeFile(path.join(runDir, `${prefix}-semantic-audit-input.md`), `${auditPrompts.dynamicPrompt}

${auditPrompts.userMessage}
`)
      ]);
      run.artifacts.push(`${prefix}-semantic-audit-system.md`, `${prefix}-semantic-audit-input.md`);
      addEvent(run, "info", "semantic-audit", `\u542F\u52A8${round === "initial" ? "\u9996\u6B21" : "\u4FEE\u590D\u540E"}\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u3002`, { checkedDimensions: ["arcBoundary", "timeline", "characterState", "knowledgeBoundary", "terminologyAndCost", "worldRules", "crossBatchContinuity"] });
      let auditRaw = "";
      let lastAuditStreamEventAt = 0;
      const auditReply = await generateAgentReply({
        roleName: "Chapter Blueprint Canon Auditor",
        basePrompt: auditPrompts.basePrompt,
        dynamicPrompt: auditPrompts.dynamicPrompt,
        consensus: auditPrompts.consensus,
        message: auditPrompts.userMessage,
        currentStage: "chapter_blueprints_canon_audit",
        responseMode: "artifact",
        preferredLanguage: "zh-CN",
        envRootDir: rootDir,
        providerOverride: chapterProviderOverride,
        temperature: 0,
        onUsage: trackLlmCacheUsage(run, round === "initial" ? "\u9996\u6B21\u6B63\u5178\u5BA1\u8BA1" : "\u4FEE\u590D\u540E\u6B63\u5178\u5BA1\u8BA1"),
        onDelta: async (delta) => {
          auditRaw += delta;
          const now = Date.now();
          if (!lastAuditStreamEventAt || now - lastAuditStreamEventAt >= 700) {
            lastAuditStreamEventAt = now;
            addEvent(run, "stream", "semantic-audit", `\u6B63\u5178\u5BA1\u8BA1\u6B63\u5728\u8F93\u51FA\uFF0C\u5DF2\u63A5\u6536 ${auditRaw.length} \u5B57\u7B26\u3002`, { responseChars: auditRaw.length, tail: auditRaw.slice(-240) });
            await persistRun(run);
          }
        }
      });
      auditRaw = auditReply;
      await fs.writeFile(path.join(runDir, `${prefix}-semantic-audit-raw.txt`), `${auditRaw}
`);
      run.artifacts.push(`${prefix}-semantic-audit-raw.txt`);
      const auditParsed = parseDebugModelJsonObject(auditRaw);
      run.semanticAudit = normalizeChapterBlueprintSemanticAudit(input, auditParsed.value);
      await fs.writeFile(path.join(runDir, `${prefix}-semantic-audit.json`), `${JSON.stringify(run.semanticAudit, null, 2)}
`);
      run.artifacts.push(`${prefix}-semantic-audit.json`);
      const merged = mergeChapterBlueprintSemanticAudit(validateChapterBlueprints(candidate, input), run.semanticAudit);
      addEvent(run, merged.valid ? "success" : "error", "semantic-audit", merged.valid ? "\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u901A\u8FC7\u3002" : `\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u53D1\u73B0 ${merged.errors.length} \u4E2A\u963B\u65AD\u95EE\u9898\u3002`, { errors: merged.errors, warnings: merged.warnings });
      return merged;
    };
    const prompts = buildChapterBlueprintPrompts(input, run.runId, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "");
    run.prompts = prompts;
    await Promise.all([
      fs.writeFile(path.join(runDir, "02-system-prompt.md"), `${prompts.systemPrompt}
`),
      fs.writeFile(path.join(runDir, "02-base-prompt.md"), `${prompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "03-dynamic-prompt.md"), `${prompts.dynamicPrompt}
`),
      fs.writeFile(path.join(runDir, "04-user-message.md"), `${prompts.userMessage}
`)
    ]);
    run.artifacts.push("02-system-prompt.md", "02-base-prompt.md", "03-dynamic-prompt.md", "04-user-message.md");
    addEvent(run, "success", "prompt", "\u7AE0\u8282\u84DD\u56FE\u6279\u6B21\u5B9E\u9645\u8BF7\u6C42 Prompt \u5DF2\u51BB\u7ED3\u5230\u672C\u6B21 run\u3002", {
      basePromptChars: prompts.basePrompt.length,
      dynamicPromptChars: prompts.dynamicPrompt.length,
      userMessageChars: prompts.userMessage.length,
      systemPromptChars: prompts.systemPrompt.length,
      volumeId: input.volumeId,
      chapterCount
    });
    let lastStreamEventAt = 0;
    addEvent(run, "info", "llm", "\u8BF7\u6C42\u5DF2\u53D1\u9001\u7ED9\u771F\u5B9E\u6A21\u578B\uFF0C\u7B49\u5F85\u7AE0\u8282\u84DD\u56FE\u9996\u6BB5\u54CD\u5E94\u3002", { modelName: config.provider.modelName });
    const raw = await withChapterBlueprintEffectiveOutputWatchdog(run, "\u7AE0\u8282\u84DD\u56FE\u751F\u6210", (markEffectiveOutput) => generateAgentReply({
      roleName: "Chapter Blueprint Architect",
      basePrompt: prompts.basePrompt,
      dynamicPrompt: prompts.dynamicPrompt,
      consensus: prompts.consensus,
      message: prompts.userMessage,
      currentStage: "chapter_blueprints_debug",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: chapterProviderOverride,
      temperature: input.temperature,
      onUsage: trackLlmCacheUsage(run, "\u7AE0\u8282\u84DD\u56FE\u751F\u6210"),
      onDelta: async (delta) => {
        run.rawResponse += delta;
        markEffectiveOutput();
        const now = Date.now();
        if (!lastStreamEventAt || now - lastStreamEventAt >= 700) {
          lastStreamEventAt = now;
          addEvent(run, "stream", "llm", `\u6A21\u578B\u6B63\u5728\u8F93\u51FA\u7AE0\u8282\u84DD\u56FE\uFF0C\u5DF2\u63A5\u6536 ${run.rawResponse.length} \u5B57\u7B26\u3002`, { responseChars: run.rawResponse.length, tail: run.rawResponse.slice(-240) });
          await persistRun(run);
        }
      },
      onProviderActivity: async () => {
        markEffectiveOutput();
      }
    }));
    run.rawResponse = raw;
    await fs.writeFile(path.join(runDir, "05-raw-response.txt"), `${raw}
`);
    run.artifacts.push("05-raw-response.txt");
    addEvent(run, "success", "llm", `\u7AE0\u8282\u84DD\u56FE\u54CD\u5E94\u5B8C\u6210\uFF0C\u5171 ${raw.length} \u5B57\u7B26\u3002`, { responseChars: raw.length });
    const parsed = parseDebugModelJsonObject(raw);
    if (parsed.repairedText) {
      await fs.writeFile(path.join(runDir, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
      run.artifacts.push("05b-repaired-response.txt");
      addEvent(run, "warning", "parse", `\u539F\u59CB\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON\uFF1B\u5DF2\u5B8C\u6210 ${parsed.repairs.length} \u5904\u7ED3\u6784\u4FEE\u590D\u5E76\u91CD\u65B0\u89E3\u6790\u3002`, { originalError: parsed.originalError, repairs: parsed.repairs });
    }
    let result = parsed.value;
    applyChapterBlueprintDeterministicRepairs(run, result, input, "\u521D\u6B21\u89E3\u6790");
    run.result = result;
    await fs.writeFile(path.join(runDir, "06-chapter-blueprints.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("06-chapter-blueprints.json");
    addEvent(run, "success", "parse", parsed.repairedText ? "\u4FEE\u590D\u540E\u7684\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u7AE0\u8282\u84DD\u56FE JSON\uFF1B\u539F\u59CB\u54CD\u5E94\u4FDD\u6301\u4E0D\u53D8\u3002" : "\u539F\u59CB\u54CD\u5E94\u5DF2\u89E3\u6790\u4E3A\u7AE0\u8282\u84DD\u56FE JSON\u3002", { topLevelKeys: Object.keys(result), repaired: Boolean(parsed.repairedText) });
    run.validation = validateChapterBlueprints(result, input);
    await fs.writeFile(path.join(runDir, "07-structural-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-structural-validation.json");
    if (run.validation.valid && String(result.mode || "").trim() !== "lean_chapter_blueprints") run.validation = await performSemanticAudit(result, "initial");
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    if (!run.validation.valid) {
      const initialValidation = run.validation;
      const initialResult = result;
      const initialSemanticAudit = run.semanticAudit;
      const repairMessage = buildChapterBlueprintRepairMessage(input, result, initialValidation.errors, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "");
      await fs.writeFile(path.join(runDir, "08-repair-message.md"), `${repairMessage}
`);
      run.artifacts.push("08-repair-message.md");
      addEvent(run, "warning", "repair-loop", `\u9996\u6B21\u5B8C\u6574\u6821\u9A8C\u53D1\u73B0 ${initialValidation.errors.length} \u4E2A\u9519\u8BEF\uFF0C\u542F\u52A8\u6301\u7EED\u6536\u655B\u4FEE\u590D\u7B2C 1 \u8F6E\u3002`, { errors: initialValidation.errors, repairTemperature: Math.min(input.temperature, 0.15), repairMessageArtifact: "08-repair-message.md", repairRound: 1, safetyLimit: maximumAutoRepairRounds });
      try {
        let repairRaw = "";
        let lastRepairStreamEventAt = 0;
        const repairedReply = await generateAgentReply({
          roleName: "Chapter Blueprint Repair Architect",
          basePrompt: chapterBlueprintRepairBasePrompt,
          dynamicPrompt: `\u51BB\u7ED3\u6765\u6E90\u5747\u5728\u4FEE\u590D\u6D88\u606F\u4E2D\u7ED9\u51FA\u3002\u4E0A\u6E38\u5206\u5377\u7B56\u7565 Run\uFF1A${input.upstreamRunId}`,
          consensus: chapterBlueprintRepairConsensus,
          message: repairMessage,
          currentStage: "chapter_blueprints_debug_repair",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: chapterProviderOverride,
          temperature: Math.min(input.temperature, 0.15),
          onUsage: trackLlmCacheUsage(run, "\u6301\u7EED\u6536\u655B\u4FEE\u590D\u7B2C 1 \u8F6E"),
          onDelta: async (delta) => {
            repairRaw += delta;
            run.rawResponse = repairRaw;
            const now = Date.now();
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now;
              addEvent(run, "stream", "repair-loop", `\u6301\u7EED\u6536\u655B\u7B2C 1 \u8F6E\u6B63\u5728\u5B9A\u5411\u4FEE\u590D\u7AE0\u8282\u84DD\u56FE\uFF0C\u5DF2\u63A5\u6536 ${repairRaw.length} \u5B57\u7B26\u3002`, { repairRound: 1, safetyLimit: maximumAutoRepairRounds, responseChars: repairRaw.length, tail: repairRaw.slice(-240) });
              await persistRun(run);
            }
          }
        });
        repairRaw = repairedReply;
        run.rawResponse = repairRaw;
        await fs.writeFile(path.join(runDir, "09-repair-raw-response.txt"), `${repairRaw}
`);
        run.artifacts.push("09-repair-raw-response.txt");
        const repairedParsed = parseDebugModelJsonObject(repairRaw);
        if (repairedParsed.repairedText) {
          await fs.writeFile(path.join(runDir, "09b-repaired-json-text.txt"), `${repairedParsed.repairedText}
`);
          run.artifacts.push("09b-repaired-json-text.txt");
        }
        const candidateResult = repairedParsed.value;
        applyChapterBlueprintDeterministicRepairs(run, candidateResult, input, "\u6301\u7EED\u6536\u655B\u7B2C1\u8F6E");
        run.result = candidateResult;
        run.validation = validateChapterBlueprints(candidateResult, input);
        if (run.validation.valid && String(candidateResult.mode || "").trim() !== "lean_chapter_blueprints") run.validation = await performSemanticAudit(candidateResult, "repair");
        const candidateValidation = run.validation;
        await learnFromChapterBlueprintRepair({
          run,
          beforeErrors: initialValidation.errors,
          afterErrors: candidateValidation.errors,
          passed: candidateValidation.valid
        });
        await Promise.all([
          fs.writeFile(path.join(runDir, "10-chapter-blueprints-repaired.json"), `${JSON.stringify(candidateResult, null, 2)}
`),
          fs.writeFile(path.join(runDir, "11-validation-after-repair.json"), `${JSON.stringify(candidateValidation, null, 2)}
`)
        ]);
        run.artifacts.push("10-chapter-blueprints-repaired.json", "11-validation-after-repair.json");
        if (compareValidationQuality(candidateValidation, initialValidation) > 0) {
          result = initialResult;
          run.result = initialResult;
          run.validation = initialValidation;
          run.semanticAudit = initialSemanticAudit;
          addEvent(run, "warning", "repair-rollback", `\u6301\u7EED\u6536\u655B\u7B2C 1 \u8F6E\u5F15\u5165\u4E86\u66F4\u591A\u95EE\u9898\uFF0C\u5DF2\u81EA\u52A8\u56DE\u9000\u5230\u5F53\u524D\u6700\u4F73\u5019\u9009\uFF1B\u5931\u8D25\u5019\u9009\u4ECD\u4FDD\u7559\u5728 artifact \u548C\u5B66\u4E60\u8BB0\u5F55\u4E2D\u3002`, {
            repairRound: 1,
            candidateErrors: candidateValidation.errors,
            restoredErrors: initialValidation.errors
          });
        } else {
          result = candidateResult;
          addEvent(run, candidateValidation.valid ? "success" : "warning", "repair-loop", candidateValidation.valid ? "\u6301\u7EED\u6536\u655B\u7B2C 1 \u8F6E\u5B9A\u5411\u4FEE\u590D\u5DF2\u901A\u8FC7\u5B8C\u6574\u6821\u9A8C\u3002" : `\u6301\u7EED\u6536\u655B\u7B2C 1 \u8F6E\u4FEE\u590D\u540E\u4ECD\u6709 ${candidateValidation.errors.length} \u4E2A\u9519\u8BEF\uFF0C\u5C06\u628A\u9519\u8BEF\u539F\u6587\u56DE\u586B\u5230\u4E0B\u4E00\u8F6E\u3002`, { repairRound: 1, safetyLimit: maximumAutoRepairRounds, errors: candidateValidation.errors, warnings: candidateValidation.warnings, repairedResponseChars: repairRaw.length });
        }
      } catch (repairError) {
        run.validation = initialValidation;
        addEvent(run, "warning", "repair-loop", `\u6301\u7EED\u6536\u655B\u7B2C 1 \u8F6E\u6A21\u578B\u8C03\u7528\u5931\u8D25\uFF0C\u4FDD\u7559\u9996\u6B21\u6821\u9A8C\u7ED3\u679C\u5E76\u8FDB\u5165\u4E0B\u4E00\u8F6E\u91CD\u8BD5\uFF1A${repairError instanceof Error ? repairError.message : String(repairError)}`);
      }
    }
    let learningLoopStopped = run.learning ? chapterBlueprintLearningShouldStop(run.learning, run.runId).stop : false;
    let repeatedRepairFailureSignature = "";
    let repeatedRepairFailureCount = 0;
    for (let repairRound = 2; run.validation?.valid === false && !learningLoopStopped && repairRound <= maximumAutoRepairRounds; repairRound += 1) {
      const previousResult = result;
      const previousValidation = run.validation;
      const previousSemanticAudit = run.semanticAudit;
      const errors = [...new Set(previousValidation.errors)];
      const prefix = `16-auto-repair-${String(repairRound).padStart(2, "0")}`;
      const repairMessage = buildChapterBlueprintRepairMessage(input, result, errors, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "");
      await fs.writeFile(path.join(runDir, `${prefix}-message.md`), `${repairMessage}
`);
      run.artifacts.push(`${prefix}-message.md`);
      addEvent(run, "warning", "repair-loop", `\u6301\u7EED\u6536\u655B\u7B2C ${repairRound - 1} \u8F6E\u4ECD\u672A\u901A\u8FC7\uFF1B\u5DF2\u628A ${errors.length} \u4E2A\u9519\u8BEF\u539F\u6587\u56DE\u586B\uFF0C\u542F\u52A8\u7B2C ${repairRound} \u8F6E\u5B9A\u5411\u4FEE\u590D\u3002`, {
        repairRound,
        safetyLimit: maximumAutoRepairRounds,
        errors,
        repairMessageArtifact: `${prefix}-message.md`
      });
      try {
        let repairRaw = "";
        let lastRepairStreamEventAt = 0;
        const repairedReply = await generateAgentReply({
          roleName: "Chapter Blueprint Repair Loop Architect",
          basePrompt: chapterBlueprintRepairBasePrompt,
          dynamicPrompt: `\u51BB\u7ED3\u6765\u6E90\u5747\u5728\u4FEE\u590D\u6D88\u606F\u4E2D\u7ED9\u51FA\u3002\u4E0A\u6E38\u5206\u5377\u7B56\u7565 Run\uFF1A${input.upstreamRunId}`,
          consensus: chapterBlueprintRepairConsensus,
          message: repairMessage,
          currentStage: "chapter_blueprints_debug_repair_loop",
          responseMode: "artifact",
          preferredLanguage: "zh-CN",
          envRootDir: rootDir,
          providerOverride: chapterProviderOverride,
          temperature: 0,
          onUsage: trackLlmCacheUsage(run, `\u6301\u7EED\u6536\u655B\u4FEE\u590D\u7B2C ${repairRound} \u8F6E`),
          onDelta: async (delta) => {
            repairRaw += delta;
            run.rawResponse = repairRaw;
            const now = Date.now();
            if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
              lastRepairStreamEventAt = now;
              addEvent(run, "stream", "repair-loop", `\u6301\u7EED\u6536\u655B\u7B2C ${repairRound} \u8F6E\u6B63\u5728\u8F93\u51FA\uFF0C\u5DF2\u63A5\u6536 ${repairRaw.length} \u5B57\u7B26\u3002`, { repairRound, safetyLimit: maximumAutoRepairRounds, responseChars: repairRaw.length, tail: repairRaw.slice(-240) });
              await persistRun(run);
            }
          }
        });
        repairRaw = repairedReply;
        run.rawResponse = repairRaw;
        const repairedParsed = parseDebugModelJsonObject(repairRaw);
        const candidateResult = repairedParsed.value;
        applyChapterBlueprintDeterministicRepairs(run, candidateResult, input, `\u6301\u7EED\u6536\u655B\u7B2C${repairRound}\u8F6E`);
        run.result = candidateResult;
        run.semanticAudit = null;
        run.validation = validateChapterBlueprints(candidateResult, input);
        if (run.validation.valid && String(candidateResult.mode || "").trim() !== "lean_chapter_blueprints") run.validation = await performSemanticAudit(candidateResult, "repair", `${prefix}-audit`);
        const candidateValidation = run.validation;
        const learningStop = await learnFromChapterBlueprintRepair({
          run,
          beforeErrors: errors,
          afterErrors: candidateValidation.errors,
          passed: candidateValidation.valid
        });
        learningLoopStopped = learningStop.stop;
        const writes = [
          fs.writeFile(path.join(runDir, `${prefix}-raw.txt`), `${repairRaw}
`),
          fs.writeFile(path.join(runDir, `${prefix}-result.json`), `${JSON.stringify(candidateResult, null, 2)}
`),
          fs.writeFile(path.join(runDir, `${prefix}-validation.json`), `${JSON.stringify(candidateValidation, null, 2)}
`)
        ];
        const artifacts = [`${prefix}-raw.txt`, `${prefix}-result.json`, `${prefix}-validation.json`];
        if (repairedParsed.repairedText) {
          writes.push(fs.writeFile(path.join(runDir, `${prefix}-repaired-json-text.txt`), `${repairedParsed.repairedText}
`));
          artifacts.push(`${prefix}-repaired-json-text.txt`);
        }
        await Promise.all(writes);
        run.artifacts.push(...artifacts);
        if (compareValidationQuality(candidateValidation, previousValidation) > 0) {
          result = previousResult;
          run.result = previousResult;
          run.validation = previousValidation;
          run.semanticAudit = previousSemanticAudit;
          addEvent(run, "warning", "repair-rollback", `\u6301\u7EED\u6536\u655B\u7B2C ${repairRound} \u8F6E\u7ED3\u679C\u52A3\u4E8E\u5F53\u524D\u6700\u4F73\u5019\u9009\uFF0C\u5DF2\u81EA\u52A8\u56DE\u9000\uFF1B\u5931\u8D25\u5019\u9009\u4ECD\u4FDD\u7559\u7528\u4E8E\u5B66\u4E60\u3002`, {
            repairRound,
            candidateErrors: candidateValidation.errors,
            restoredErrors: previousValidation.errors
          });
        } else {
          result = candidateResult;
          addEvent(run, candidateValidation.valid ? "success" : "warning", "repair-loop", candidateValidation.valid ? `\u6301\u7EED\u6536\u655B\u7B2C ${repairRound} \u8F6E\u4FEE\u590D\u540E\uFF0C\u7ED3\u6784\u6821\u9A8C\u4E0E\u72EC\u7ACB\u6B63\u5178\u5BA1\u8BA1\u5168\u90E8\u901A\u8FC7\u3002` : learningLoopStopped ? `\u6301\u7EED\u6536\u655B\u7B2C ${repairRound} \u8F6E\u540E Learning Loop \u5DF2\u6839\u636E\u5F53\u524D\u9519\u8BEF\u8BC1\u636E\u4E3B\u52A8\u505C\u6B62\u3002` : `\u6301\u7EED\u6536\u655B\u7B2C ${repairRound} \u8F6E\u4FEE\u590D\u540E\u4ECD\u6709 ${candidateValidation.errors.length} \u4E2A\u9519\u8BEF${repairRound < maximumAutoRepairRounds ? "\uFF0C\u5C06\u7EE7\u7EED\u56DE\u586B\u4E0B\u4E00\u8F6E" : "\uFF0C\u5DF2\u89E6\u53D1\u8FD0\u884C\u65F6\u5B89\u5168\u7194\u65AD"}\u3002`, {
            repairRound,
            safetyLimit: maximumAutoRepairRounds,
            errors: candidateValidation.errors,
            warnings: candidateValidation.warnings,
            repairedResponseChars: repairRaw.length
          });
        }
      } catch (repairError) {
        result = previousResult;
        run.result = previousResult;
        run.validation = previousValidation;
        run.semanticAudit = previousSemanticAudit;
        const failureMessage = repairError instanceof Error ? repairError.message : String(repairError);
        const failureSignature = debugFailureSignature(repairError);
        repeatedRepairFailureCount = failureSignature === repeatedRepairFailureSignature ? repeatedRepairFailureCount + 1 : 1;
        repeatedRepairFailureSignature = failureSignature;
        const shouldStopRepeatedFailure = repeatedRepairFailureCount >= 2 && /model_response_invalid_json|Expected|Unexpected|semantic|audit|正典审计|JSON/iu.test(failureMessage);
        addEvent(run, shouldStopRepeatedFailure ? "error" : "warning", "repair-loop", shouldStopRepeatedFailure ? `\u6301\u7EED\u6536\u655B\u7B2C ${repairRound} \u8F6E\u518D\u6B21\u9047\u5230\u540C\u7C7B\u6A21\u578B/\u5BA1\u8BA1\u89E3\u6790\u5931\u8D25\uFF0C\u5DF2\u63D0\u524D\u505C\u6B62\uFF1B\u7EE7\u7EED\u91CD\u8BD5\u53EA\u4F1A\u91CD\u590D\u6D88\u8017\u3002` : `\u6301\u7EED\u6536\u655B\u7B2C ${repairRound} \u8F6E\u6A21\u578B\u8C03\u7528\u5931\u8D25\uFF0C\u5DF2\u6062\u590D\u4E0A\u4E00\u8F6E\u7ED3\u679C\uFF1B\u4E0B\u4E00\u8F6E\u5C06\u4F7F\u7528\u540C\u4E00\u6279\u9519\u8BEF\u91CD\u8BD5\uFF1A${failureMessage}`, {
          repairRound,
          safetyLimit: maximumAutoRepairRounds,
          repeatedFailureCount: repeatedRepairFailureCount,
          failureSignature,
          error: failureMessage
        });
        if (shouldStopRepeatedFailure) {
          learningLoopStopped = true;
          break;
        }
      }
    }
    const finalValidation = run.validation;
    if (!finalValidation) throw new Error("chapter_blueprint_validation_missing");
    if (!finalValidation.valid) {
      addEvent(run, "error", "repair-loop", learningLoopStopped ? "Learning Loop \u68C0\u6D4B\u5230\u7EA6\u675F\u51B2\u7A81\u6216\u8FDE\u7EED\u65E0\u8FDB\u5C55\uFF0C\u5DF2\u63D0\u524D\u505C\u6B62\uFF1B\u6700\u540E\u4E00\u7248\u7ED3\u679C\u3001\u9519\u8BEF\u3001\u7ECF\u9A8C\u548C\u51B2\u7A81\u8BC1\u636E\u5747\u5DF2\u4FDD\u7559\u3002" : `\u6301\u7EED\u6536\u655B\u5DF2\u89E6\u53D1 ${maximumAutoRepairRounds} \u8F6E\u8FD0\u884C\u65F6\u5B89\u5168\u7194\u65AD\uFF1B\u5DF2\u4FDD\u7559\u6700\u540E\u4E00\u7248\u7ED3\u679C\u3001\u5168\u90E8\u9519\u8BEF\u548C\u6BCF\u8F6E artifact\uFF0C\u907F\u514D\u5F02\u5E38\u60C5\u51B5\u4E0B\u65E0\u9650\u6263\u8D39\u3002`, {
        safetyLimit: maximumAutoRepairRounds,
        learningLoopStopped,
        learningConflicts: run.learning?.conflicts || [],
        errors: finalValidation.errors,
        warnings: finalValidation.warnings
      });
    }
    if (!finalValidation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u7AE0\u8282\u84DD\u56FE\u9A8C\u8BC1\u672A\u901A\u8FC7\uFF1A${finalValidation.errors.length} \u4E2A\u9519\u8BEF\u3002`, { errors: finalValidation.errors, warnings: finalValidation.warnings });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u7AE0\u8282\u84DD\u56FE\u6279\u6B21\u7ED3\u6784\u6821\u9A8C\u4E0E\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u5747\u901A\u8FC7\uFF1B\u53EF\u8FDB\u5165\u4EBA\u5DE5\u6279\u51C6\u3002", {
        volumeId: input.volumeId,
        startChapter: input.startChapter,
        endChapter: input.endChapter,
        blueprintCount: Array.isArray(result.blueprints) ? result.blueprints.length : 0,
        warnings: finalValidation.warnings
      });
      await persistCompletedChapterBlueprintState(run);
    }
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "run", `\u7AE0\u8282\u84DD\u56FE\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
}
async function executeStyleProfileRun(run) {
  const input = run.input;
  const runDir = path.join(runsRoot, run.runId);
  const blueprintCount = styleProfileBlueprints(input).length;
  const firstBlueprintChapter = Number(styleProfileBlueprints(input)[0]?.chapterNumber || 0);
  const lastBlueprintChapter = Number(styleProfileBlueprints(input).at(-1)?.chapterNumber || 0);
  const requestedMaxRounds = Math.max(1, Math.min(12, Number(input.maxRounds || 6)));
  const maxRounds = Math.min(20, requestedMaxRounds + 6);
  const aigcMode = normalizeStyleDebugAigcMode(input);
  run.status = "running";
  run.pauseRequestedAt = null;
  run.pauseReason = null;
  ensureRunAbortController(run);
  run.startedAt = nowIso();
  addEvent(run, "info", "run", "\u5F00\u59CB\u6267\u884C\u6587\u98CE\u81EA\u8FDB\u5316\u8282\u70B9\uFF1A\u5019\u9009\u6837\u6BB5 \u2192 AIGC \u68C0\u6D4B \u2192 \u8BC4\u4F30 \u2192 \u4FEE\u6B63 prompt \u2192 \u4E0B\u4E00\u8F6E\u3002", { runId: run.runId, isolated: true, productionPhase: "phase_10_style_evolution", requestedMaxRounds, maxRounds, aigcSelfEvolutionExtraRounds: maxRounds - requestedMaxRounds, aigcMode });
  addEvent(run, "success", "upstream", "\u5DF2\u4ECE\u670D\u52A1\u7AEF\u9501\u5B9A\u901A\u8FC7\u9A8C\u8BC1\u7684\u7AE0\u8282\u84DD\u56FE Run\u3002", {
    upstreamRunId: input.upstreamRunId,
    blueprintCount,
    firstBlueprintChapter,
    lastBlueprintChapter,
    sampleChapter: input.sampleChapter
  });
  addEvent(run, "info", "boundary", "\u8282\u70B9\u8FB9\u754C\u5DF2\u51BB\u7ED3\uFF1A\u672C\u8282\u70B9\u751F\u6210\u7684\u662F\u53EF\u8BC4\u4F30\u6587\u98CE\u6837\u6BB5\uFF0C\u4E0D\u4F1A\u5199\u5165\u6B63\u5F0F\u7AE0\u8282\uFF0C\u4E5F\u4E0D\u4F1A\u4FEE\u6539\u6B63\u5178\u8D26\u672C\u3002", {
    allowedPhase: "phase_10_style_evolution",
    nextPhase: "phase_11_single_chapter_context",
    forbiddenMutations: ["skills", "items", "numbers", "countdowns", "costs", "locations", "chapterBlueprints"]
  });
  await fs.mkdir(runDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(runDir, "01-input.json"), `${JSON.stringify({ upstreamRunId: input.upstreamRunId, styleFocus: input.styleFocus, sampleChapter: input.sampleChapter, requestedMaxRounds, maxRounds, aigcSelfEvolutionExtraRounds: maxRounds - requestedMaxRounds, totalChapters: input.totalChapters, temperature: input.temperature, aigcMode }, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01b-upstream-chapter-blueprints.json"), `${JSON.stringify(input.chapterBlueprints, null, 2)}
`),
    fs.writeFile(path.join(runDir, "01c-upstream-story-bible.json"), `${JSON.stringify(input.storyBible, null, 2)}
`)
  ]);
  run.artifacts.push("01-input.json", "01b-upstream-chapter-blueprints.json", "01c-upstream-story-bible.json");
  try {
    if (process.env.AI_NOVEL_TEST_MODE === "1") throw new Error("debug_runner_refuses_AI_NOVEL_TEST_MODE_fake_generation");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    run.provider = { configId: config._configId, configName: config._configName || config.provider.modelName, baseUrl: config.provider.baseUrl, modelName: config.provider.modelName, apiMode: config.provider.apiMode, timeoutMs: config.provider.timeoutMs, temperature: input.temperature, apiKey: "[REDACTED]" };
    addEvent(run, "success", "provider", "\u5DF2\u52A0\u8F7D\u771F\u5B9E\u6A21\u578B\u914D\u7F6E\uFF1BAPI Key \u5DF2\u9690\u85CF\u3002", run.provider);
    const aigcConfig = getAigcDetectorConfig(rootDir);
    addEvent(run, "info", "aigc", "\u8282\u70B9 09 \u5DF2\u542F\u7528\u53EF\u914D\u7F6E AIGC \u95E8\u7981\uFF1A\u6BCF\u8F6E\u6837\u6BB5\u4F1A\u6309\u6240\u9009\u68C0\u6D4B\u7C92\u5EA6\u4E0E\u7B56\u7565\u5224\u5B9A\u662F\u5426\u53EF\u8FDB\u5165\u5019\u9009\u6C60\u3002", {
      provider: aigcConfig.provider ?? "disabled",
      urlConfigured: Boolean(aigcConfig.url?.trim()),
      threshold: aigcConfig.threshold ?? 0.8,
      hardGate: true,
      ...aigcMode
    });
    const context = styleEvolutionProjectContext(input);
    await fs.writeFile(path.join(runDir, "02-style-evolution-context.json"), `${JSON.stringify({
      projectTitle: context.title,
      idea: context.idea,
      sampleChapter: input.sampleChapter,
      sampleBlueprint: context.sampleBlueprint,
      desiredVibes: context.desiredVibes,
      seedForbiddenPatterns: context.seedForbiddenPatterns
    }, null, 2)}
`);
    run.artifacts.push("02-style-evolution-context.json");
    addEvent(run, "success", "prompt", "\u5DF2\u590D\u7528\u6B63\u5F0F Style Evolution Engine \u7684\u5019\u9009/\u8BC4\u4F30/\u4FEE\u6B63\u63D0\u793A\u94FE\u3002", {
      engine: "production-style-evolution",
      sampleChapter: input.sampleChapter,
      maxRounds,
      blueprintCount
    });
    const iterations = [];
    let priorSample = "";
    const baseSeedPrompt = context.seedPrompt;
    let seedPrompt = baseSeedPrompt;
    let selectedCandidate = null;
    let bestCandidate = null;
    let stopReason = "max_rounds_reached";
    const minRoundsBeforeStop = Math.min(maxRounds, 2);
    let consecutiveAigcFailures = 0;
    const aigcEvolutionMemory = [];
    const aigcScoreHistory = [];
    for (let round = 1; round <= maxRounds; round += 1) {
      assertRunNotPaused(run);
      addEvent(run, "info", "style-loop", `\u5F00\u59CB\u7B2C ${round}/${maxRounds} \u8F6E\u6587\u98CE\u6837\u6BB5\u751F\u6210\u3002`, { round, maxRounds });
      const candidatePrompt = buildStyleEvolutionCandidatePrompt({
        projectTitle: context.title,
        idea: context.idea,
        userStylePrompt: input.styleFocus,
        referenceText: context.referenceText,
        desiredVibes: context.desiredVibes,
        seedForbiddenPatterns: context.seedForbiddenPatterns,
        seedPrompt,
        priorSample,
        iterationFeedback: round === 1 ? input.styleFocus : seedPrompt
      });
      if (round === 1) {
        run.prompts = {
          systemPrompt: candidatePrompt.system,
          consensus: `\u72EC\u7ACB\u8C03\u8BD5 Run: ${run.runId}
\u7AE0\u8282\u84DD\u56FE\u4E0A\u6E38 Run: ${input.upstreamRunId}
Style Evolution Loop: ${maxRounds} rounds`,
          basePrompt: candidatePrompt.system,
          dynamicPrompt: context.referenceText,
          userMessage: candidatePrompt.user
        };
        await Promise.all([
          fs.writeFile(path.join(runDir, "03-candidate-system-prompt.md"), `${candidatePrompt.system}
`),
          fs.writeFile(path.join(runDir, "04-candidate-user-message.md"), `${candidatePrompt.user}
`)
        ]);
        run.artifacts.push("03-candidate-system-prompt.md", "04-candidate-user-message.md");
      }
      const sample = (await generateStyleDebugText(run, config, {
        roleName: `Style Evolution Candidate R${round}`,
        system: candidatePrompt.system,
        user: candidatePrompt.user,
        temperature: Math.max(0.25, input.temperature),
        phase: "style_evolution_candidate",
        streamToRaw: true
      })).trim();
      assertRunNotPaused(run);
      await fs.writeFile(path.join(runDir, `05-round-${round}-sample.txt`), `${sample}
`);
      run.artifacts.push(`05-round-${round}-sample.txt`);
      addEvent(run, "success", "style-loop", `\u7B2C ${round} \u8F6E\u5019\u9009\u6837\u6BB5\u5B8C\u6210\uFF0C\u5F00\u59CB\u8BC4\u4F30\u3002`, { round, sampleChars: sample.length, sample });
      addEvent(run, "info", "aigc", `\u7B2C ${round} \u8F6E\u6837\u6BB5\u5F00\u59CB AIGC \u68C0\u6D4B\u3002`, {
        round,
        provider: aigcConfig.provider ?? "disabled",
        urlConfigured: Boolean(aigcConfig.url?.trim()),
        threshold: aigcConfig.threshold ?? 0.8,
        ...aigcMode
      });
      const aigcSignal = await detectStyleDebugAigcSignal(sample, aigcConfig, `style-evolution-debug-r${round}`, aigcMode);
      assertRunNotPaused(run);
      if (aigcSignal.status === "passed") {
        consecutiveAigcFailures = 0;
      } else {
        consecutiveAigcFailures += 1;
      }
      aigcScoreHistory.push({
        round,
        status: aigcSignal.status,
        score: aigcSignal.score,
        highRiskCount: aigcSignal.highRiskCount
      });
      const aigcRepairLessons = buildStyleAigcRepairLessons(aigcSignal, sample, consecutiveAigcFailures);
      if (aigcRepairLessons.length) {
        const before = aigcEvolutionMemory.length;
        for (const lesson of aigcRepairLessons) {
          if (!aigcEvolutionMemory.includes(lesson)) aigcEvolutionMemory.push(lesson);
        }
        if (aigcEvolutionMemory.length > before) {
          addEvent(run, "warning", "aigc-evolution", `\u7B2C ${round} \u8F6E\u5DF2\u63D0\u53D6 ${aigcEvolutionMemory.length - before} \u6761 AIGC \u81EA\u8FDB\u5316\u8BB0\u5FC6\uFF0C\u5C06\u5199\u5165\u4E0B\u4E00\u8F6E prompt\u3002`, {
            round,
            consecutiveAigcFailures,
            aigcScore: aigcSignal.score,
            latestLessons: aigcEvolutionMemory.slice(before)
          });
        }
      }
      await fs.writeFile(path.join(runDir, `05b-round-${round}-aigc.json`), `${JSON.stringify(aigcSignal, null, 2)}
`);
      run.artifacts.push(`05b-round-${round}-aigc.json`);
      addEvent(run, aigcSignal.status === "passed" ? "success" : "error", "aigc", aigcSignal.status === "passed" ? `\u7B2C ${round} \u8F6E AIGC \u68C0\u6D4B\u901A\u8FC7\u3002` : `\u7B2C ${round} \u8F6E AIGC \u68C0\u6D4B\u672A\u901A\u8FC7\uFF1A${aigcSignal.reason}`, {
        round,
        status: aigcSignal.status,
        score: aigcSignal.score,
        threshold: aigcSignal.threshold,
        highRiskCount: aigcSignal.highRiskCount,
        highRiskPreviews: aigcSignal.highRiskPreviews
      });
      let evaluation = evaluateStyleEvolutionCandidate({
        prompt: candidatePrompt.prompt,
        sample,
        userStylePrompt: input.styleFocus,
        iterationFeedback: seedPrompt,
        aigc: aigcSignal
      });
      evaluation = attachAigcToStyleEvaluation(evaluation, aigcSignal, aigcRepairLessons);
      let evaluationSource = "heuristic";
      try {
        const evaluationPrompt = buildStyleEvolutionEvaluationPrompt({
          projectTitle: context.title,
          idea: context.idea,
          userStylePrompt: input.styleFocus,
          referenceText: context.referenceText,
          desiredVibes: context.desiredVibes,
          seedForbiddenPatterns: context.seedForbiddenPatterns,
          prompt: candidatePrompt.prompt,
          sample,
          priorSample,
          iterationFeedback: seedPrompt
        });
        const rawEvaluation = await generateStyleDebugText(run, config, {
          roleName: `Style Evolution Evaluator R${round}`,
          system: evaluationPrompt.system,
          user: evaluationPrompt.user,
          temperature: 0.1,
          phase: "style_evolution_evaluation"
        });
        assertRunNotPaused(run);
        await fs.writeFile(path.join(runDir, `06-round-${round}-evaluation-raw.json`), `${rawEvaluation}
`);
        run.artifacts.push(`06-round-${round}-evaluation-raw.json`);
        const parsed = parseStyleEvolutionEvaluationFromText(rawEvaluation);
        if (parsed) {
          evaluation = parsed.evaluation;
          evaluationSource = "llm_critic";
          evaluation = attachAigcToStyleEvaluation(evaluation, aigcSignal, aigcRepairLessons);
        } else {
          addEvent(run, "warning", "style-loop", `\u7B2C ${round} \u8F6E\u8BC4\u4F30 JSON \u89E3\u6790\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u542F\u53D1\u5F0F\u8BC4\u4F30\u515C\u5E95\u3002`, { round });
        }
      } catch (error) {
        addEvent(run, "warning", "style-loop", `\u7B2C ${round} \u8F6E\u72EC\u7ACB\u8BC4\u4F30\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u542F\u53D1\u5F0F\u8BC4\u4F30\u515C\u5E95\uFF1A${error instanceof Error ? error.message : String(error)}`, { round });
      }
      let refinement = buildStyleEvolutionRefinement({
        prompt: candidatePrompt.prompt,
        userStylePrompt: input.styleFocus,
        evaluation,
        iterationFeedback: seedPrompt
      });
      let refinementSource = "heuristic";
      if (evaluation.verdict === "retry") {
        try {
          const refinementPrompt = buildStyleEvolutionRefinementOnlyPrompt({
            projectTitle: context.title,
            idea: context.idea,
            userStylePrompt: input.styleFocus,
            desiredVibes: context.desiredVibes,
            seedForbiddenPatterns: context.seedForbiddenPatterns,
            prompt: candidatePrompt.prompt,
            sample,
            evaluation,
            iterationFeedback: seedPrompt
          });
          const rawRefinement = await generateStyleDebugText(run, config, {
            roleName: `Style Evolution Refiner R${round}`,
            system: refinementPrompt.system,
            user: refinementPrompt.user,
            temperature: 0.1,
            phase: "style_evolution_refinement"
          });
          assertRunNotPaused(run);
          await fs.writeFile(path.join(runDir, `07-round-${round}-refinement-raw.json`), `${rawRefinement}
`);
          run.artifacts.push(`07-round-${round}-refinement-raw.json`);
          const parsedRefinement = parseStyleEvolutionRefinementFromText(rawRefinement);
          if (parsedRefinement) {
            refinement = parsedRefinement.refinement;
            refinementSource = "llm_critic";
          } else {
            addEvent(run, "warning", "style-loop", `\u7B2C ${round} \u8F6E\u4FEE\u6B63 JSON \u89E3\u6790\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u542F\u53D1\u5F0F\u4FEE\u6B63\u515C\u5E95\u3002`, { round });
          }
        } catch (error) {
          addEvent(run, "warning", "style-loop", `\u7B2C ${round} \u8F6E prompt \u4FEE\u6B63\u5931\u8D25\uFF0C\u5DF2\u4F7F\u7528\u542F\u53D1\u5F0F\u4FEE\u6B63\u515C\u5E95\uFF1A${error instanceof Error ? error.message : String(error)}`, { round });
        }
      }
      const verification = buildStyleGenerationVerification({
        evaluation,
        sample,
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      const iterationRecord = {
        round,
        sample,
        sampleChars: sample.length,
        prompt: candidatePrompt.prompt,
        evaluation: { ...evaluation, source: evaluationSource },
        refinement: { ...refinement, source: refinementSource },
        verification,
        aigcEvolution: {
          consecutiveFailures: consecutiveAigcFailures,
          latestLessons: aigcRepairLessons,
          memory: aigcEvolutionMemory.slice(-8)
        }
      };
      iterations.push(iterationRecord);
      await fs.writeFile(path.join(runDir, `08-round-${round}-summary.json`), `${JSON.stringify(iterationRecord, null, 2)}
`);
      run.artifacts.push(`08-round-${round}-summary.json`);
      addEvent(run, evaluation.verdict === "retry" ? "warning" : "success", "style-loop", `\u7B2C ${round} \u8F6E\u8BC4\u4F30\u7ED3\u679C\uFF1A${evaluation.verdict}\uFF0C\u7EFC\u5408\u5206 ${Number(evaluation.scores?.overall || 0).toFixed(1)}\u3002`, {
        round,
        verdict: evaluation.verdict,
        overall: evaluation.scores?.overall,
        verificationStatus: verification.status,
        aigcStatus: aigcSignal.status,
        aigcScore: aigcSignal.score,
        aigcThreshold: aigcSignal.threshold,
        nextFocus: evaluation.nextFocus,
        refinementSummary: refinement.summary
      });
      priorSample = sample;
      seedPrompt = compactStyleEvolutionNextSeed({
        baseSeedPrompt,
        userStylePrompt: input.styleFocus,
        evaluation,
        refinement,
        aigcLessons: aigcEvolutionMemory
      });
      if (round === requestedMaxRounds && !bestCandidate && aigcEvolutionMemory.length && round < maxRounds) {
        addEvent(run, "warning", "aigc-evolution", `\u5DF2\u8FBE\u5230\u7528\u6237\u8BBE\u7F6E\u7684 ${requestedMaxRounds} \u8F6E\uFF0C\u4F46\u4ECD\u672A\u901A\u8FC7 AIGC\uFF1B\u8FDB\u5165\u8FFD\u52A0\u81EA\u8FDB\u5316\u8F6E\uFF0C\u6700\u591A\u7EE7\u7EED\u5230\u7B2C ${maxRounds} \u8F6E\u3002`, {
          requestedMaxRounds,
          maxRounds,
          consecutiveAigcFailures,
          aigcScoreHistory,
          latestLessons: aigcEvolutionMemory.slice(-6)
        });
      }
      const verificationPassed = verification.status === "passed";
      if ((evaluation.verdict === "candidate" || evaluation.verdict === "approve") && verificationPassed) {
        const candidateSnapshot = {
          round,
          sampleChapter: input.sampleChapter,
          sample,
          prompt: candidatePrompt.prompt,
          evaluation: { ...evaluation, source: evaluationSource },
          refinement: { ...refinement, source: refinementSource },
          verification
        };
        const currentScore = Number(evaluation.scores?.overall || 0);
        const bestEvaluation = bestCandidate?.evaluation && typeof bestCandidate.evaluation === "object" && !Array.isArray(bestCandidate.evaluation) ? bestCandidate.evaluation : {};
        const bestScores = bestEvaluation.scores && typeof bestEvaluation.scores === "object" && !Array.isArray(bestEvaluation.scores) ? bestEvaluation.scores : {};
        if (!bestCandidate || currentScore > Number(bestScores.overall || 0)) bestCandidate = candidateSnapshot;
        if (evaluation.verdict === "approve" && round >= minRoundsBeforeStop) {
          selectedCandidate = candidateSnapshot;
          stopReason = "approved_by_evaluator";
          break;
        }
        if (round < maxRounds) {
          const continueReason = round < minRoundsBeforeStop ? `\u672A\u8FBE\u5230\u6700\u5C0F\u7A33\u5B9A\u8F6E\u6570 ${minRoundsBeforeStop}` : "\u5C1A\u672A\u8FBE\u5230 approve";
          addEvent(run, "info", "style-loop", `\u7B2C ${round} \u8F6E\u5DF2\u8FBE\u5230 ${evaluation.verdict}\uFF0C\u4F46${continueReason}\uFF0C\u7EE7\u7EED\u4E0B\u4E00\u8F6E\u68C0\u67E5\u6587\u98CE\u7A33\u5B9A\u6027\u3002`, {
            round,
            minRoundsBeforeStop,
            maxRounds,
            verdict: evaluation.verdict,
            currentScore
          });
        }
      }
      if (!verificationPassed) {
        addEvent(run, "warning", "style-loop", `\u7B2C ${round} \u8F6E\u672A\u901A\u8FC7 Generation Verification Gate\uFF0C\u4E0D\u4F1A\u8FDB\u5165\u5019\u9009\u6C60\u3002`, {
          round,
          verificationStatus: verification.status,
          verificationReasons: verification.reasons,
          aigcStatus: aigcSignal.status
        });
      }
      if (round >= maxRounds && bestCandidate) {
        selectedCandidate = bestCandidate;
        stopReason = "best_candidate_after_max_rounds";
        addEvent(run, "warning", "style-loop", `\u5DF2\u8FBE\u5230\u6700\u5927\u8FED\u4EE3\u8F6E\u6570 ${maxRounds}\uFF0C\u672C\u6B21\u672A\u83B7\u5F97 approve\uFF1B\u5C06\u9009\u62E9\u5386\u53F2\u6700\u9AD8\u5206 candidate \u4F5C\u4E3A\u4E34\u65F6\u5019\u9009\uFF0C\u7B49\u5F85\u4EBA\u5DE5\u5224\u65AD\u3002`, {
          maxRounds,
          selectedRound: bestCandidate.round,
          selectedVerdict: bestCandidate.evaluation && typeof bestCandidate.evaluation === "object" && !Array.isArray(bestCandidate.evaluation) ? bestCandidate.evaluation.verdict : null
        });
        break;
      }
      await persistRun(run);
    }
    if (!selectedCandidate && bestCandidate) {
      selectedCandidate = bestCandidate;
      stopReason = "best_candidate_after_max_rounds";
    }
    if (!selectedCandidate && iterations.length) {
      const best = [...iterations].sort((a, b) => {
        const left = a.evaluation && typeof a.evaluation === "object" && !Array.isArray(a.evaluation) ? a.evaluation : {};
        const right = b.evaluation && typeof b.evaluation === "object" && !Array.isArray(b.evaluation) ? b.evaluation : {};
        const leftScores = left.scores && typeof left.scores === "object" && !Array.isArray(left.scores) ? left.scores : {};
        const rightScores = right.scores && typeof right.scores === "object" && !Array.isArray(right.scores) ? right.scores : {};
        return Number(rightScores.overall || 0) - Number(leftScores.overall || 0);
      })[0];
      selectedCandidate = {
        ...best,
        sampleChapter: input.sampleChapter
      };
    }
    const result = {
      version: 1,
      mode: "style_evolution_debug_loop",
      source: {
        chapterBlueprintRunId: input.upstreamRunId,
        phase: "phase_10_style_evolution",
        totalChapters: input.totalChapters,
        sampleChapter: input.sampleChapter,
        blueprintCount,
        firstBlueprintChapter,
        lastBlueprintChapter
      },
      engine: "production-style-evolution",
      aigcRequired: true,
      aigcGate: {
        provider: aigcConfig.provider ?? "disabled",
        urlConfigured: Boolean(aigcConfig.url?.trim()),
        threshold: aigcConfig.threshold ?? 0.8,
        passRequiredForCompletion: true,
        ...aigcMode
      },
      requestedMaxRounds,
      maxRounds,
      aigcSelfEvolution: {
        enabled: true,
        extraRounds: maxRounds - requestedMaxRounds,
        safetyMaxRounds: maxRounds,
        memory: aigcEvolutionMemory,
        scoreHistory: aigcScoreHistory
      },
      minRoundsBeforeStop,
      stopReason,
      selectedCandidate,
      iterations,
      nextActions: [
        "\u5982\u679C\u6837\u6BB5\u6EE1\u610F\uFF0C\u4E0B\u4E00\u6B65\u53EF\u4EE5\u6DFB\u52A0\u201C\u51BB\u7ED3\u4E3A\u6B63\u5F0F\u6587\u98CE\u5408\u540C/\u5199\u4F5C\u89C4\u5219\u201D\u7684\u6309\u94AE\u3002",
        "\u5982\u679C\u6837\u6BB5\u4E0D\u6EE1\u610F\uFF0C\u4FEE\u6539\u98CE\u683C\u5173\u6CE8\u70B9\u6216\u63D0\u9AD8\u6700\u5927\u8F6E\u6570\u540E\u7EE7\u7EED\u8FED\u4EE3\u3002",
        "\u540E\u7EED\u5355\u7AE0\u4E0A\u4E0B\u6587\u8282\u70B9\u53EA\u7EE7\u627F\u51BB\u7ED3\u540E\u7684\u5199\u6CD5\u89C4\u5219\uFF0C\u4E0D\u76F4\u63A5\u7EE7\u627F\u8C03\u8BD5\u6837\u6BB5\u4E3A\u6B63\u5F0F\u6B63\u6587\u3002"
      ]
    };
    run.result = result;
    await fs.writeFile(path.join(runDir, "09-style-evolution-loop.json"), `${JSON.stringify(result, null, 2)}
`);
    run.artifacts.push("09-style-evolution-loop.json");
    run.validation = validateStyleProfile(result, input);
    await fs.writeFile(path.join(runDir, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
    run.artifacts.push("07-validation.json");
    if (!run.validation.valid) {
      run.status = "invalid";
      addEvent(run, "error", "validate", `\u6587\u98CE\u81EA\u8FDB\u5316\u672A\u6536\u655B\uFF1A${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, { errors: run.validation.errors, warnings: run.validation.warnings });
    } else {
      run.status = "completed";
      addEvent(run, "success", "validate", "\u6587\u98CE\u81EA\u8FDB\u5316\u5DF2\u5F97\u5230\u53EF\u7528\u5019\u9009\uFF1B\u53EF\u4EBA\u5DE5\u786E\u8BA4\u540E\u51BB\u7ED3\u4E3A\u540E\u7EED\u6B63\u6587\u5199\u4F5C\u89C4\u5219\u3002", {
        stopReason,
        selectedRound: selectedCandidate?.round,
        selectedVerdict: selectedCandidate && typeof selectedCandidate.evaluation === "object" && !Array.isArray(selectedCandidate.evaluation) ? selectedCandidate.evaluation.verdict : null,
        warnings: run.validation.warnings
      });
    }
  } catch (error) {
    if (isDebugRunPausedError(error) || isRunPauseRequested(run)) {
      run.status = "paused";
      run.pauseRequestedAt = run.pauseRequestedAt || nowIso();
      run.pauseReason = run.pauseReason || "\u7528\u6237\u624B\u52A8\u6682\u505C\u5F53\u524D\u8C03\u8BD5 Run\u3002";
      run.error = "debug_run_paused_by_user";
      if (!run.events.some((event) => event.phase === "pause")) {
        addEvent(run, "warning", "pause", "\u6587\u98CE\u81EA\u8FDB\u5316\u8282\u70B9\u5DF2\u6682\u505C\uFF1B\u53EF\u4EE5\u5207\u6362\u6A21\u578B\u540E\u91CD\u65B0\u8FD0\u884C\u3002", {
          runId: run.runId,
          reason: run.pauseReason
        });
      }
    } else {
      run.status = "failed";
      run.error = error instanceof Error ? error.message : String(error);
      addEvent(run, "error", "run", `\u6587\u98CE\u81EA\u8FDB\u5316\u8282\u70B9\u6267\u884C\u5931\u8D25\uFF1A${run.error}`);
    }
  } finally {
    run.completedAt = nowIso();
    runAbortControllers.delete(run.runId);
    await persistRun(run);
  }
}
async function executeChapterBlueprintAuditOnly(run, autoRepairOnFailure = true) {
  const input = run.input;
  let result = run.result;
  const runDir = path.join(runsRoot, run.runId);
  run.status = "running";
  run.startedAt = nowIso();
  run.completedAt = null;
  run.error = null;
  addEvent(run, "info", "semantic-audit", "\u8DF3\u8FC7\u91CD\u65B0\u751F\u6210\uFF0C\u4EC5\u5BF9\u5DF2\u4FDD\u5B58\u7684\u7AE0\u8282\u84DD\u56FE\u8FD0\u884C\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u3002", { runId: run.runId, startChapter: input.startChapter, endChapter: input.endChapter });
  try {
    if (!result) throw new Error("chapter_blueprint_result_missing");
    applyChapterBlueprintDeterministicRepairs(run, result, input, "\u6B63\u5178\u5BA1\u8BA1\u524D");
    run.result = result;
    await fs.writeFile(path.join(runDir, "12a-chapter-blueprints-before-audit.json"), `${JSON.stringify(result, null, 2)}
`);
    if (!run.artifacts.includes("12a-chapter-blueprints-before-audit.json")) run.artifacts.push("12a-chapter-blueprints-before-audit.json");
    const structural = validateChapterBlueprints(result, input);
    if (!structural.valid) throw new Error(`chapter_blueprint_structural_validation_failed:${structural.errors.join(" | ")}`);
    if (String(result.mode || "").trim() === "lean_chapter_blueprints") {
      run.validation = structural;
      run.semanticAudit = null;
      run.status = "completed";
      addEvent(run, "success", "semantic-audit", "lean \u84DD\u56FE\u6A21\u5F0F\u4EC5\u6267\u884C\u7ED3\u6784\u4E0E\u4E3B\u7EBF\u4EA4\u63A5\u6821\u9A8C\uFF0C\u4E0D\u518D\u8C03\u7528\u72EC\u7ACB\u6B63\u5178\u5BA1\u8BA1\uFF0C\u907F\u514D\u5BA1\u8BA1\u6587\u672C\u6C61\u67D3\u84DD\u56FE\u3002", { warnings: structural.warnings });
      await persistCompletedChapterBlueprintState(run);
      return;
    }
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    const chapterProviderOverride = debugProviderOverride(config, chapterBlueprintLlmActivityTimeoutMs);
    await loadLearningForChapterBlueprintRun(run, config.provider.modelName);
    const auditPrompts = buildChapterBlueprintSemanticAuditPrompts(input, result, run.runId, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "");
    await Promise.all([
      fs.writeFile(path.join(runDir, "12-semantic-audit-system.md"), `${auditPrompts.basePrompt}
`),
      fs.writeFile(path.join(runDir, "12-semantic-audit-input.md"), `${auditPrompts.dynamicPrompt}

${auditPrompts.userMessage}
`)
    ]);
    for (const artifact of ["12-semantic-audit-system.md", "12-semantic-audit-input.md"]) if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact);
    let auditRaw = "";
    let lastAuditStreamEventAt = 0;
    const auditReply = await generateAgentReply({
      roleName: "Chapter Blueprint Canon Auditor",
      basePrompt: auditPrompts.basePrompt,
      dynamicPrompt: auditPrompts.dynamicPrompt,
      consensus: auditPrompts.consensus,
      message: auditPrompts.userMessage,
      currentStage: "chapter_blueprints_canon_audit_only",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: chapterProviderOverride,
      temperature: 0,
      onUsage: trackLlmCacheUsage(run, "\u72EC\u7ACB\u6B63\u5178\u5BA1\u8BA1\u8865\u8DD1"),
      onDelta: async (delta) => {
        auditRaw += delta;
        const now = Date.now();
        if (!lastAuditStreamEventAt || now - lastAuditStreamEventAt >= 700) {
          lastAuditStreamEventAt = now;
          addEvent(run, "stream", "semantic-audit", `\u6B63\u5178\u5BA1\u8BA1\u6B63\u5728\u8F93\u51FA\uFF0C\u5DF2\u63A5\u6536 ${auditRaw.length} \u5B57\u7B26\u3002`, { responseChars: auditRaw.length, tail: auditRaw.slice(-240) });
          await persistRun(run);
        }
      }
    });
    auditRaw = auditReply;
    await fs.writeFile(path.join(runDir, "12-semantic-audit-raw.txt"), `${auditRaw}
`);
    if (!run.artifacts.includes("12-semantic-audit-raw.txt")) run.artifacts.push("12-semantic-audit-raw.txt");
    run.semanticAudit = normalizeChapterBlueprintSemanticAudit(input, parseDebugModelJsonObject(auditRaw).value);
    run.validation = mergeChapterBlueprintSemanticAudit(structural, run.semanticAudit);
    await Promise.all([
      fs.writeFile(path.join(runDir, "13-semantic-audit.json"), `${JSON.stringify(run.semanticAudit, null, 2)}
`),
      fs.writeFile(path.join(runDir, "14-validation-after-semantic-audit.json"), `${JSON.stringify(run.validation, null, 2)}
`)
    ]);
    for (const artifact of ["13-semantic-audit.json", "14-validation-after-semantic-audit.json"]) if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact);
    run.status = run.validation.valid ? "completed" : "invalid";
    addEvent(run, run.validation.valid ? "success" : "error", "semantic-audit", run.validation.valid ? "\u5DF2\u4FDD\u5B58\u84DD\u56FE\u901A\u8FC7\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\uFF0C\u65E0\u9700\u91CD\u65B0\u751F\u6210\u3002" : `\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u53D1\u73B0 ${run.validation.errors.length} \u4E2A\u963B\u65AD\u95EE\u9898\u3002`, { errors: run.validation.errors, warnings: run.validation.warnings });
    if (run.validation.valid) await persistCompletedChapterBlueprintState(run);
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "semantic-audit", `\u6B63\u5178\u5BA1\u8BA1\u8865\u8DD1\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    run.completedAt = nowIso();
    await persistRun(run);
  }
  if (autoRepairOnFailure && run.status === "invalid" && run.result && run.validation && !run.validation.valid) {
    addEvent(run, "warning", "repair-loop", `\u6B63\u5178\u5BA1\u8BA1\u672A\u901A\u8FC7\uFF0C\u81EA\u52A8\u628A ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u56DE\u586B\u5230\u4FEE\u590D\u5FAA\u73AF\uFF1B\u65E0\u9700\u624B\u52A8\u70B9\u51FB\u201C\u4FEE\u590D\u5F53\u524D\u7ED3\u679C\u201D\u3002`, {
      errors: run.validation.errors,
      warnings: run.validation.warnings,
      mode: "continuous-convergence",
      safetyLimit: chapterBlueprintRepairSafetyLimit
    });
    await persistRun(run);
    await executeChapterBlueprintRepairOnly(run);
  }
}
async function executeChapterBlueprintRepairOnly(run, remainingLoopRounds = chapterBlueprintRepairSafetyLimit) {
  const input = run.input;
  const originalResult = run.result;
  const originalValidation = run.validation;
  const originalSemanticAudit = run.semanticAudit;
  const runDir = path.join(runsRoot, run.runId);
  const structural = originalResult ? validateChapterBlueprints(originalResult, input) : null;
  const semanticErrors = originalResult && structural && run.semanticAudit ? mergeChapterBlueprintSemanticAudit(structural, run.semanticAudit).errors : [];
  const currentErrors = originalResult ? [.../* @__PURE__ */ new Set([...structural?.errors || [], ...semanticErrors])] : ["chapter_blueprint_result_missing"];
  const repairRound = run.artifacts.filter((artifact) => /^15-manual-repair-\d+-message\.md$/u.test(artifact)).length + 1;
  const maximumLoopRounds = chapterBlueprintRepairSafetyLimit;
  const loopRound = maximumLoopRounds - remainingLoopRounds + 1;
  const prefix = `15-manual-repair-${String(repairRound).padStart(2, "0")}`;
  run.status = "running";
  run.startedAt = nowIso();
  run.completedAt = null;
  run.error = null;
  addEvent(run, "info", "manual-repair", `\u5F00\u59CB\u7B2C ${repairRound} \u6B21\u5B9A\u5411\u4FEE\u590D\uFF08\u6301\u7EED\u6536\u655B\u7B2C ${loopRound} \u8F6E\uFF09\uFF1B\u4FDD\u7559\u5F53\u524D Run\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\u6574\u6279\u84DD\u56FE\u3002`, {
    runId: run.runId,
    loopRound,
    maximumLoopRounds,
    errorCount: currentErrors.length,
    errors: currentErrors
  });
  try {
    if (!originalResult) throw new Error("chapter_blueprint_result_missing");
    if (!currentErrors.length) throw new Error("chapter_blueprint_repair_not_needed");
    const config = await loadDebugLlmConfig(run);
    if (!config || !config._dbApiKey) throw new Error("\u6CA1\u6709\u53EF\u7528\u7684\u771F\u5B9E\u6587\u672C\u6A21\u578B\u914D\u7F6E\u3002");
    const chapterProviderOverride = debugProviderOverride(config, chapterBlueprintLlmActivityTimeoutMs);
    await loadLearningForChapterBlueprintRun(run, config.provider.modelName);
    const repairMessage = buildChapterBlueprintRepairMessage(input, originalResult, currentErrors, run.learning ? compileChapterBlueprintLearningPrompt(run.learning) : "");
    await fs.writeFile(path.join(runDir, `${prefix}-message.md`), `${repairMessage}
`);
    if (!run.artifacts.includes(`${prefix}-message.md`)) run.artifacts.push(`${prefix}-message.md`);
    let repairRaw = "";
    let lastRepairStreamEventAt = 0;
    const repairedReply = await generateAgentReply({
      roleName: "Chapter Blueprint Manual Repair Architect",
      basePrompt: chapterBlueprintRepairBasePrompt,
      dynamicPrompt: `\u51BB\u7ED3\u6765\u6E90\u5747\u5728\u4FEE\u590D\u6D88\u606F\u4E2D\u7ED9\u51FA\u3002\u4E0A\u6E38\u5206\u5377\u7B56\u7565 Run\uFF1A${input.upstreamRunId}`,
      consensus: chapterBlueprintRepairConsensus,
      message: repairMessage,
      currentStage: "chapter_blueprints_debug_manual_repair",
      responseMode: "artifact",
      preferredLanguage: "zh-CN",
      envRootDir: rootDir,
      providerOverride: chapterProviderOverride,
      temperature: 0,
      onUsage: trackLlmCacheUsage(run, `\u624B\u52A8\u6301\u7EED\u6536\u655B\u4FEE\u590D\u7B2C ${repairRound} \u8F6E`),
      onDelta: async (delta) => {
        repairRaw += delta;
        const now = Date.now();
        if (!lastRepairStreamEventAt || now - lastRepairStreamEventAt >= 700) {
          lastRepairStreamEventAt = now;
          addEvent(run, "stream", "manual-repair", `\u5B9A\u5411\u4FEE\u590D\u6B63\u5728\u8F93\u51FA\uFF0C\u5DF2\u63A5\u6536 ${repairRaw.length} \u5B57\u7B26\u3002`, { responseChars: repairRaw.length, tail: repairRaw.slice(-240) });
          await persistRun(run);
        }
      }
    });
    repairRaw = repairedReply;
    const repairedParsed = parseDebugModelJsonObject(repairRaw);
    run.rawResponse = repairRaw;
    run.result = repairedParsed.value;
    run.semanticAudit = null;
    applyChapterBlueprintDeterministicRepairs(run, run.result, input, `\u624B\u52A8\u4FEE\u590D\u7B2C${repairRound}\u8F6E`);
    run.validation = validateChapterBlueprints(run.result, input);
    await Promise.all([
      fs.writeFile(path.join(runDir, `${prefix}-raw.txt`), `${repairRaw}
`),
      fs.writeFile(path.join(runDir, `${prefix}-result.json`), `${JSON.stringify(run.result, null, 2)}
`),
      fs.writeFile(path.join(runDir, `${prefix}-structural-validation.json`), `${JSON.stringify(run.validation, null, 2)}
`)
    ]);
    for (const artifact of [`${prefix}-raw.txt`, `${prefix}-result.json`, `${prefix}-structural-validation.json`]) if (!run.artifacts.includes(artifact)) run.artifacts.push(artifact);
    if (!run.validation.valid) {
      run.status = "invalid";
      const learningStop2 = await learnFromChapterBlueprintRepair({
        run,
        beforeErrors: currentErrors,
        afterErrors: run.validation.errors,
        passed: false
      });
      addEvent(run, remainingLoopRounds > 1 ? "warning" : "error", "manual-repair", `\u7B2C ${repairRound} \u6B21\u5B9A\u5411\u4FEE\u590D\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u7ED3\u6784\u9519\u8BEF${remainingLoopRounds > 1 ? "\uFF0C\u5C06\u81EA\u52A8\u628A\u9519\u8BEF\u56DE\u586B\u5230\u4E0B\u4E00\u8F6E" : "\uFF0C\u5DF2\u89E6\u53D1\u8FD0\u884C\u65F6\u5B89\u5168\u7194\u65AD"}\u3002`, { loopRound, safetyLimit: maximumLoopRounds, errors: run.validation.errors, warnings: run.validation.warnings });
      if (remainingLoopRounds > 1 && !learningStop2.stop) {
        await persistRun(run);
        await executeChapterBlueprintRepairOnly(run, remainingLoopRounds - 1);
      }
      return;
    }
    addEvent(run, "success", "manual-repair", `\u7B2C ${repairRound} \u6B21\u5B9A\u5411\u4FEE\u590D\u5DF2\u901A\u8FC7\u7ED3\u6784\u6821\u9A8C\uFF0C\u7EE7\u7EED\u6267\u884C\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u3002`, { warnings: run.validation.warnings });
    run.status = "queued";
    await persistRun(run);
    await executeChapterBlueprintAuditOnly(run, false);
    const statusAfterAudit = run.status;
    const auditPassed = statusAfterAudit === "completed" && run.validation?.valid === true && Boolean(run.semanticAudit);
    const learningStop = await learnFromChapterBlueprintRepair({
      run,
      beforeErrors: currentErrors,
      afterErrors: run.validation?.errors || [],
      passed: auditPassed
    });
    if (auditPassed) {
      addEvent(run, "success", "repair-loop", `\u6301\u7EED\u6536\u655B\u5DF2\u5B8C\u6210\uFF1A\u7B2C ${loopRound} \u8F6E\u5B9A\u5411\u4FEE\u590D\u901A\u8FC7\u7ED3\u6784\u6821\u9A8C\u548C\u72EC\u7ACB\u6B63\u5178\u8BED\u4E49\u5BA1\u8BA1\u3002`, {
        loopRound,
        safetyLimit: maximumLoopRounds,
        warnings: run.validation.warnings || []
      });
      await persistRun(run);
    } else if (statusAfterAudit === "failed") {
      addEvent(run, "error", "repair-loop", `\u6301\u7EED\u6536\u655B\u7B2C ${loopRound} \u8F6E\u7ED3\u6784\u5DF2\u901A\u8FC7\uFF0C\u4F46\u72EC\u7ACB\u6B63\u5178\u5BA1\u8BA1\u6CA1\u6709\u4EA7\u51FA\u53EF\u89E3\u6790\u7ED3\u679C\uFF1B\u4E0D\u4F1A\u628A\u7ED3\u6784\u901A\u8FC7\u8BEF\u6807\u4E3A\u5B8C\u6574\u901A\u8FC7\u3002`, {
        loopRound,
        safetyLimit: maximumLoopRounds,
        error: run.error
      });
      await persistRun(run);
    } else if (remainingLoopRounds > 1 && !learningStop.stop) {
      addEvent(run, "warning", "manual-repair", `\u7B2C ${repairRound} \u6B21\u4FEE\u590D\u540E\u7684\u6B63\u5178\u5BA1\u8BA1\u4ECD\u672A\u901A\u8FC7\uFF1B\u5C06\u628A\u6700\u65B0\u5BA1\u8BA1\u9519\u8BEF\u81EA\u52A8\u56DE\u586B\u5230\u4E0B\u4E00\u8F6E\u3002`, {
        loopRound,
        maximumLoopRounds,
        errors: run.validation?.errors || [],
        warnings: run.validation?.warnings || []
      });
      await persistRun(run);
      await executeChapterBlueprintRepairOnly(run, remainingLoopRounds - 1);
    } else {
      addEvent(run, "error", "repair-loop", learningStop.stop ? `Learning Loop \u68C0\u6D4B\u5230\u51B2\u7A81\u6216\u8FDE\u7EED\u65E0\u8FDB\u5C55\u5E76\u4E3B\u52A8\u505C\u6B62\uFF1A${learningStop.reason}` : `\u6301\u7EED\u6536\u655B\u5DF2\u89E6\u53D1 ${maximumLoopRounds} \u8F6E\u8FD0\u884C\u65F6\u5B89\u5168\u7194\u65AD\uFF0C\u6700\u7EC8\u6B63\u5178\u5BA1\u8BA1\u4ECD\u6709 ${run.validation?.errors.length || 0} \u4E2A\u963B\u65AD\u95EE\u9898\u3002`, {
        loopRound,
        safetyLimit: maximumLoopRounds,
        learningStopped: learningStop.stop,
        learningConflict: learningStop.conflict || null,
        errors: run.validation?.errors || [],
        warnings: run.validation?.warnings || []
      });
      await persistRun(run);
    }
  } catch (error) {
    run.status = "invalid";
    run.result = originalResult;
    run.validation = originalValidation;
    run.semanticAudit = originalSemanticAudit;
    run.error = error instanceof Error ? error.message : String(error);
    addEvent(run, "error", "manual-repair", `\u5F53\u524D\u7ED3\u679C\u5B9A\u5411\u4FEE\u590D\u5931\u8D25\uFF1A${run.error}`);
  } finally {
    if (!run.completedAt) run.completedAt = nowIso();
    await persistRun(run);
  }
}
async function loadRun(runId) {
  let run = runs.get(runId);
  let loadedFromDisk = false;
  if (!run) {
    try {
      run = JSON.parse(await fs.readFile(path.join(runsRoot, runId, "run.json"), "utf8"));
      runs.set(runId, run);
      loadedFromDisk = true;
    } catch {
      return null;
    }
  }
  if (loadedFromDisk && ["queued", "running"].includes(run.status)) {
    run.status = "failed";
    run.completedAt = nowIso();
    run.error = "debug_server_restarted_before_run_completed";
    addEvent(run, "error", "recovery", "\u670D\u52A1\u91CD\u542F\u524D\u7684\u6A21\u578B\u8C03\u7528\u5DF2\u4E2D\u65AD\uFF1B\u8BE5 Run \u5DF2\u660E\u786E\u6807\u8BB0\u4E3A\u5931\u8D25\uFF0C\u53EF\u5B89\u5168\u91CD\u65B0\u8FD0\u884C\u3002");
    await persistRun(run);
  }
  const parseRecoverableError = run.error?.includes("model_response_invalid_json") || /^(Expected|Unexpected)\b/u.test(run.error || "");
  const shouldRetryParseRecovery = Boolean(
    run.rawResponse && run.status === "failed" && parseRecoverableError
  );
  if (shouldRetryParseRecovery) {
    try {
      const previousRecoverySnapshot = JSON.stringify({
        status: run.status,
        error: run.error,
        result: run.result,
        validation: run.validation
      });
      const parsed = parseDebugModelJsonObject(run.rawResponse);
      run.result = parsed.value;
      if (run.nodeId === "chapter-blueprints") {
        applyChapterBlueprintDeterministicRepairs(run, run.result, run.input, run.status === "failed" ? "\u5931\u8D25Run\u52A0\u8F7D\u6062\u590D" : "\u5386\u53F2Run\u91CD\u65B0\u6062\u590D");
      }
      const outputFilename = run.nodeId === "world-foundation" ? "06-world-foundation.json" : run.nodeId === "character-planning" ? "06-character-plan.json" : run.nodeId === "initial-character-state" ? "06-initial-character-state.json" : run.nodeId === "world-matrix" ? "06-world-matrix.json" : run.nodeId === "plot-architecture" ? "06-plot-architecture.json" : run.nodeId === "story-bible" ? "06-story-bible.json" : run.nodeId === "volume-strategy" ? "06-volume-strategy.json" : run.nodeId === "chapter-blueprints" ? "06-chapter-blueprints.json" : "06-style-profile.json";
      if (parsed.repairedText) {
        await fs.writeFile(path.join(runsRoot, run.runId, "05b-repaired-response.txt"), `${parsed.repairedText}
`);
        if (!run.artifacts.includes("05b-repaired-response.txt")) run.artifacts.push("05b-repaired-response.txt");
      }
      await fs.writeFile(path.join(runsRoot, run.runId, outputFilename), `${JSON.stringify(run.result, null, 2)}
`);
      if (!run.artifacts.includes(outputFilename)) run.artifacts.push(outputFilename);
      run.validation = run.nodeId === "world-foundation" ? validateFoundation(run.result) : run.nodeId === "character-planning" ? validateCharacterPlan(run.result, run.input) : run.nodeId === "initial-character-state" ? validateInitialCharacterState(run.result, run.input) : run.nodeId === "world-matrix" ? validateWorldMatrix(run.result, run.input) : run.nodeId === "plot-architecture" ? validatePlotArchitecture(run.result, run.input) : run.nodeId === "story-bible" ? validateStoryBible(run.result, run.input) : run.nodeId === "volume-strategy" ? validateVolumeStrategy(run.result, run.input) : run.nodeId === "chapter-blueprints" ? mergeChapterBlueprintSemanticAudit(validateChapterBlueprints(run.result, run.input), run.semanticAudit) : validateStyleProfile(run.result, run.input);
      await fs.writeFile(path.join(runsRoot, run.runId, "07-validation.json"), `${JSON.stringify(run.validation, null, 2)}
`);
      if (!run.artifacts.includes("07-validation.json")) run.artifacts.push("07-validation.json");
      run.status = run.validation.valid ? "completed" : "invalid";
      run.error = null;
      const nextRecoverySnapshot = JSON.stringify({
        status: run.status,
        error: run.error,
        result: run.result,
        validation: run.validation
      });
      if (previousRecoverySnapshot !== nextRecoverySnapshot) {
        addEvent(run, run.validation.valid ? "success" : "error", "parse-recover", run.validation.valid ? "\u4F7F\u7528\u5F53\u524D\u8C03\u8BD5\u89E3\u6790/\u6E05\u6D17\u89C4\u5219\u91CD\u65B0\u6062\u590D\u54CD\u5E94\uFF0C\u5E76\u901A\u8FC7\u6700\u65B0\u7ED3\u6784\u6821\u9A8C\u3002" : `\u4F7F\u7528\u5F53\u524D\u8C03\u8BD5\u89E3\u6790/\u6E05\u6D17\u89C4\u5219\u91CD\u65B0\u6062\u590D\u54CD\u5E94\uFF0C\u4F46\u6700\u65B0\u7ED3\u6784\u6821\u9A8C\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
          repairs: parsed.repairs,
          errors: run.validation.errors,
          outputArtifact: outputFilename
        });
        await persistRun(run);
      }
    } catch {
    }
  }
  if (run.nodeId === "character-planning" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateCharacterPlan(run.result, run.input);
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status;
      run.validation = currentValidation;
      run.status = currentValidation.valid ? "completed" : "invalid";
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid ? "\u6309\u6700\u65B0\u4EBA\u7269\u89C4\u5212\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u901A\u8FC7\u3002" : `\u6309\u6700\u65B0\u4EBA\u7269\u89C4\u5212\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u5931\u8D25\uFF1A${currentValidation.errors.length} \u4E2A\u9519\u8BEF\u3002`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings }
      );
      await persistRun(run);
    }
  }
  if (run.nodeId === "initial-character-state" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateInitialCharacterState(run.result, run.input);
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status;
      run.validation = currentValidation;
      run.status = currentValidation.valid ? "completed" : "invalid";
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid ? "\u6309\u6700\u65B0\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u901A\u8FC7\u3002" : `\u6309\u6700\u65B0\u4EBA\u7269\u521D\u59CB\u72B6\u6001\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u5931\u8D25\uFF1A${currentValidation.errors.length} \u4E2A\u9519\u8BEF\u3002`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings }
      );
      await persistRun(run);
    }
  }
  if (run.nodeId === "world-matrix" && run.result && run.status === "invalid" && run.validation) {
    const canonicalizedAnchorIndices = canonicalizeWorldMatrixAnchors(run.result, run.input, run.validation.errors);
    if (canonicalizedAnchorIndices.length) {
      run.validation = validateWorldMatrix(run.result, run.input);
      run.status = run.validation.valid ? "completed" : "invalid";
      await Promise.all([
        fs.writeFile(path.join(runsRoot, run.runId, "12-world-matrix-canonicalized.json"), `${JSON.stringify(run.result, null, 2)}
`),
        fs.writeFile(path.join(runsRoot, run.runId, "13-validation-after-canonicalization.json"), `${JSON.stringify(run.validation, null, 2)}
`)
      ]);
      if (!run.artifacts.includes("12-world-matrix-canonicalized.json")) run.artifacts.push("12-world-matrix-canonicalized.json");
      if (!run.artifacts.includes("13-validation-after-canonicalization.json")) run.artifacts.push("13-validation-after-canonicalization.json");
      addEvent(run, run.validation.valid ? "success" : "error", "canonicalize-recover", run.validation.valid ? `\u5DF2\u5C06 ${canonicalizedAnchorIndices.length} \u6761\u4EC5\u5269\u7684\u8D8A\u754C\u951A\u70B9\u6062\u590D\u4E3A\u8282\u70B9 03 \u539F\u59CB\u51BB\u7ED3\u9501\uFF0C\u5E76\u901A\u8FC7\u590D\u68C0\u3002` : `\u951A\u70B9\u6062\u590D\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
        canonicalizedAnchorIndices,
        errors: run.validation.errors
      });
      await persistRun(run);
    }
  }
  if (run.nodeId === "world-matrix" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateWorldMatrix(run.result, run.input);
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status;
      run.validation = currentValidation;
      run.status = currentValidation.valid ? "completed" : "invalid";
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid ? "\u6309\u6700\u65B0\u4E16\u754C\u77E9\u9635\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u901A\u8FC7\u3002" : `\u6309\u6700\u65B0\u4E16\u754C\u77E9\u9635\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u5931\u8D25\uFF1A${currentValidation.errors.length} \u4E2A\u9519\u8BEF\u3002`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings }
      );
      await persistRun(run);
    }
  }
  if (run.nodeId === "world-matrix" && run.result && run.status === "invalid" && run.validation) {
    const canonicalizedScheduleCount = canonicalizeWorldMatrixHandoffSchedule(run.result, run.validation.errors);
    if (canonicalizedScheduleCount) {
      run.validation = validateWorldMatrix(run.result, run.input);
      run.status = run.validation.valid ? "completed" : "invalid";
      await Promise.all([
        fs.writeFile(path.join(runsRoot, run.runId, "14-world-matrix-boundary-canonicalized.json"), `${JSON.stringify(run.result, null, 2)}
`),
        fs.writeFile(path.join(runsRoot, run.runId, "15-validation-after-boundary-canonicalization.json"), `${JSON.stringify(run.validation, null, 2)}
`)
      ]);
      if (!run.artifacts.includes("14-world-matrix-boundary-canonicalized.json")) run.artifacts.push("14-world-matrix-boundary-canonicalized.json");
      if (!run.artifacts.includes("15-validation-after-boundary-canonicalization.json")) run.artifacts.push("15-validation-after-boundary-canonicalization.json");
      addEvent(run, run.validation.valid ? "success" : "error", "canonicalize-recover", run.validation.valid ? `\u5DF2\u79FB\u9664 ${canonicalizedScheduleCount} \u5904\u8D8A\u754C\u7AE0\u8282\u6392\u671F\uFF0C\u4FDD\u7559\u56E0\u679C\u6761\u4EF6\u5E76\u901A\u8FC7\u590D\u68C0\u3002` : `\u79FB\u9664\u8D8A\u754C\u7AE0\u8282\u6392\u671F\u540E\u4ECD\u6709 ${run.validation.errors.length} \u4E2A\u9519\u8BEF\u3002`, {
        canonicalizedScheduleCount,
        errors: run.validation.errors
      });
      await persistRun(run);
    }
  }
  if (run.nodeId === "plot-architecture" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validatePlotArchitecture(run.result, run.input);
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status;
      run.validation = currentValidation;
      run.status = currentValidation.valid ? "completed" : "invalid";
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid ? "\u6309\u6700\u65B0\u4E3B\u7EBF\u67B6\u6784\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u901A\u8FC7\u3002" : `\u6309\u6700\u65B0\u4E3B\u7EBF\u67B6\u6784\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u5931\u8D25\uFF1A${currentValidation.errors.length} \u4E2A\u9519\u8BEF\u3002`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings }
      );
      await persistRun(run);
    }
  }
  if (run.nodeId === "story-bible" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateStoryBible(run.result, run.input);
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status;
      run.validation = currentValidation;
      run.status = currentValidation.valid ? "completed" : "invalid";
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid ? "\u6309\u6700\u65B0\u6545\u4E8B\u5723\u7ECF\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u901A\u8FC7\u3002" : `\u6309\u6700\u65B0\u6545\u4E8B\u5723\u7ECF\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u5931\u8D25\uFF1A${currentValidation.errors.length} \u4E2A\u9519\u8BEF\u3002`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings }
      );
      await persistRun(run);
    }
  }
  if (run.nodeId === "volume-strategy" && run.result && ["completed", "invalid"].includes(run.status)) {
    const currentValidation = validateVolumeStrategy(run.result, run.input);
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status;
      run.validation = currentValidation;
      run.status = currentValidation.valid ? "completed" : "invalid";
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid ? "\u6309\u6700\u65B0\u5206\u5377\u7B56\u7565\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u901A\u8FC7\u3002" : `\u6309\u6700\u65B0\u5206\u5377\u7B56\u7565\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u5931\u8D25\uFF1A${currentValidation.errors.length} \u4E2A\u9519\u8BEF\u3002`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings }
      );
      await persistRun(run);
    }
  }
  if (run.nodeId === "chapter-blueprints" && run.result && run.semanticAudit && ["completed", "invalid"].includes(run.status)) {
    if (run.status === "invalid" && chapterBlueprintValidationOnlyRetroactiveQualityGate(run.validation) && run.semanticAudit.valid === true) {
      const previousValidation = run.validation;
      run.validation = {
        valid: true,
        errors: [],
        warnings: [
          .../* @__PURE__ */ new Set([
            ...previousValidation?.warnings || [],
            "\u5386\u53F2\u6279\u6B21\u5DF2\u5728\u5F53\u65F6\u901A\u8FC7\u7ED3\u6784\u6821\u9A8C\u4E0E\u72EC\u7ACB\u6B63\u5178\u5BA1\u8BA1\uFF1B\u65B0\u7A33\u5B9A\u751F\u6210\u5BC6\u5EA6/\u77ED\u53E5\u95E8\u7981\u53EA\u7EA6\u675F\u65B0\u751F\u6210\u6216\u65B0\u4FEE\u590D\uFF0C\u4E0D\u8FFD\u6EAF\u63A8\u7FFB\u5DF2\u901A\u8FC7\u7AE0\u8282\u3002"
          ])
        ]
      };
      run.status = "completed";
      run.error = null;
      addEvent(run, "success", "validate-recheck", "\u5DF2\u6062\u590D\u5386\u53F2\u7AE0\u8282\u84DD\u56FE\u901A\u8FC7\u72B6\u6001\uFF1A\u8BE5\u6279\u6B21\u66FE\u901A\u8FC7\u72EC\u7ACB\u6B63\u5178\u5BA1\u8BA1\uFF0C\u65B0\u7A33\u5B9A\u95E8\u7981\u4E0D\u8FFD\u6EAF\u63A8\u7FFB\u5386\u53F2\u8D44\u4EA7\u3002", {
        restoredFromRetroactiveQualityGate: true,
        previousErrors: previousValidation?.errors || []
      });
      await persistRun(run);
      return run;
    }
    if (run.status === "completed") return run;
    const currentValidation = mergeChapterBlueprintSemanticAudit(validateChapterBlueprints(run.result, run.input), run.semanticAudit);
    if (JSON.stringify(currentValidation) !== JSON.stringify(run.validation)) {
      const previousStatus = run.status;
      run.validation = currentValidation;
      run.status = currentValidation.valid ? "completed" : "invalid";
      addEvent(
        run,
        currentValidation.valid ? "success" : "error",
        "validate-recheck",
        currentValidation.valid ? "\u6309\u6700\u65B0\u7AE0\u8282\u84DD\u56FE\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u901A\u8FC7\u3002" : `\u6309\u6700\u65B0\u7AE0\u8282\u84DD\u56FE\u89C4\u5219\u91CD\u65B0\u6821\u9A8C\u5931\u8D25\uFF1A${currentValidation.errors.length} \u4E2A\u9519\u8BEF\u3002`,
        { previousStatus, errors: currentValidation.errors, warnings: currentValidation.warnings }
      );
      await persistRun(run);
    }
  }
  return run;
}
async function findLatestCompletedRun(nodeId) {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => []);
  const candidates = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => loadRun(entry.name)));
  return candidates.filter((run) => Boolean(run && run.nodeId === nodeId && run.status === "completed")).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
}
async function listChapterBlueprintRuns(filters = {}) {
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => []);
  const candidates = await Promise.all(entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("cb_")).map((entry) => loadRun(entry.name)));
  return candidates.filter((run) => Boolean(run && run.nodeId === "chapter-blueprints")).filter((run) => !filters.upstreamRunId || run.input.upstreamRunId === filters.upstreamRunId).filter((run) => !filters.volumeId || run.input.volumeId === filters.volumeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
var server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return jsonResponse(response, 204, {});
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${port}`}`);
  if (request.method === "GET" && url.pathname === "/health") {
    return jsonResponse(response, 200, { ok: true, mode: "real-llm-only", nodes: debugWorkflowKernel.listNodes(), rootDir, port });
  }
  if (request.method === "GET" && url.pathname === "/workflow/nodes") {
    return jsonResponse(response, 200, {
      debug: debugWorkflowKernel.listNodes(),
      production: [...listProductionWorkflowNodes(), ...listProductionPlanningNodes(), ...listProductionChapterNodes()],
      rollout: {
        featureFlag: "AI_NOVEL_WORKFLOW_KERNEL",
        enabled: process.env.AI_NOVEL_WORKFLOW_KERNEL === "1"
      }
    });
  }
  if (request.method === "POST" && url.pathname === "/production-sandboxes") {
    try {
      const body = await readJsonBody(request);
      const projectId = String(body.projectId || "").trim();
      if (!projectId) return jsonResponse(response, 400, { error: "project_id_required" });
      return jsonResponse(response, 201, await productionWorkflowSandboxes.create(projectId));
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  const productionSandboxRunMatch = url.pathname.match(/^\/production-sandboxes\/([^/]+)\/nodes\/([^/]+)\/run$/u);
  if (request.method === "POST" && productionSandboxRunMatch) {
    try {
      const sandboxId = decodeURIComponent(productionSandboxRunMatch[1]);
      const nodeId = decodeURIComponent(productionSandboxRunMatch[2]);
      return jsonResponse(response, 200, await productionWorkflowSandboxes.executeNode(sandboxId, nodeId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /not_current|busy|unfinished/u.test(message) ? 409 : /invalid|not_found|ENOENT/u.test(message) ? 400 : 500;
      return jsonResponse(response, status, { error: message });
    }
  }
  const productionSandboxApproveSettingMatch = url.pathname.match(/^\/production-sandboxes\/([^/]+)\/actions\/approve-setting-review$/u);
  if (request.method === "POST" && productionSandboxApproveSettingMatch) {
    try {
      const sandboxId = decodeURIComponent(productionSandboxApproveSettingMatch[1]);
      return jsonResponse(response, 200, await productionWorkflowSandboxes.approveSettingReview(sandboxId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /not_current|busy|unfinished/u.test(message) ? 409 : /invalid|ENOENT/u.test(message) ? 400 : 500;
      return jsonResponse(response, status, { error: message });
    }
  }
  const productionSandboxConfirmProtagonistMatch = url.pathname.match(/^\/production-sandboxes\/([^/]+)\/actions\/confirm-protagonist$/u);
  if (request.method === "POST" && productionSandboxConfirmProtagonistMatch) {
    try {
      const sandboxId = decodeURIComponent(productionSandboxConfirmProtagonistMatch[1]);
      const body = await readJsonBody(request);
      return jsonResponse(response, 200, await productionWorkflowSandboxes.confirmProtagonistProfile(sandboxId, body));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /not_current|busy|unfinished/u.test(message) ? 409 : /invalid|incomplete|ENOENT/u.test(message) ? 400 : 500;
      return jsonResponse(response, status, { error: message });
    }
  }
  const productionSandboxMatch = url.pathname.match(/^\/production-sandboxes\/([^/]+)$/u);
  if (request.method === "GET" && productionSandboxMatch) {
    try {
      return jsonResponse(response, 200, await productionWorkflowSandboxes.inspect(decodeURIComponent(productionSandboxMatch[1])));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonResponse(response, /invalid/u.test(message) ? 400 : 404, { error: message });
    }
  }
  if (request.method === "GET" && url.pathname === "/llm-configs") {
    try {
      const models = await listDebugTextModels();
      return jsonResponse(response, 200, { models });
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "GET" && url.pathname === "/projects") {
    try {
      const projects = await withFactoryDb(rootDir, async (db) => db.listProjects());
      return jsonResponse(response, 200, {
        projects: projects.map((project) => ({
          id: project.id,
          title: project.title,
          idea: project.idea,
          projectRoot: project.projectRoot
        }))
      });
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "GET" && url.pathname === "/runs/latest") {
    const nodeId = url.searchParams.get("nodeId");
    if (nodeId !== "world-foundation" && nodeId !== "character-planning" && nodeId !== "initial-character-state" && nodeId !== "world-matrix" && nodeId !== "plot-architecture" && nodeId !== "story-bible" && nodeId !== "volume-strategy" && nodeId !== "chapter-blueprints" && nodeId !== "style-profile" && nodeId !== "single-chapter-context" && nodeId !== "chapter-draft" && nodeId !== "chapter-commit" && nodeId !== "continuous-chapter-production") return jsonResponse(response, 400, { error: "invalid_node_id" });
    const run = await findLatestCompletedRun(nodeId);
    return run ? jsonResponse(response, 200, await loadWorkflowEvidence(run)) : jsonResponse(response, 404, { error: "completed_run_not_found" });
  }
  if (request.method === "GET" && url.pathname === "/committed-chapters") {
    const projectId = url.searchParams.get("factoryProjectId") || url.searchParams.get("projectId") || "";
    if (!projectId) return jsonResponse(response, 400, { error: "factory_project_id_required" });
    const firstChapter = Number(url.searchParams.get("firstChapter") || "1");
    const assets = await listCommittedChapterAssets(projectId);
    const coverage = committedChapterCoverage(assets, Number.isInteger(firstChapter) ? firstChapter : 1);
    return jsonResponse(response, 200, {
      projectId,
      ...coverage,
      assets: coverage.assets
    });
  }
  const committedChapterTextMatch = url.pathname.match(/^\/committed-chapters\/(\d+)$/u);
  if (request.method === "GET" && committedChapterTextMatch) {
    const projectId = url.searchParams.get("factoryProjectId") || url.searchParams.get("projectId") || "";
    if (!projectId) return jsonResponse(response, 400, { error: "factory_project_id_required" });
    const chapterNumber = Number(committedChapterTextMatch[1]);
    const assets = await listCommittedChapterAssets(projectId);
    const chapterAssets = assets.filter((asset) => asset.chapterNumber === chapterNumber);
    const latest = chapterAssets.sort((a, b) => b.committedAt.localeCompare(a.committedAt))[0];
    if (!latest) return jsonResponse(response, 404, { error: "committed_chapter_not_found" });
    let text = "";
    if (latest.textAssetPath) text = await fs.readFile(latest.textAssetPath, "utf8").catch(() => "");
    if (!text && latest.assetPath) {
      const parsed = JSON.parse(await fs.readFile(latest.assetPath, "utf8"));
      text = `${String(parsed.title || "")}

${String(parsed.text || "")}`.trim();
    }
    return jsonResponse(response, 200, {
      ...latest,
      text
    });
  }
  if (request.method === "GET" && url.pathname === "/chapter-review") {
    const projectId = url.searchParams.get("factoryProjectId") || url.searchParams.get("projectId") || "";
    if (!projectId) return jsonResponse(response, 400, { error: "factory_project_id_required" });
    const firstChapter = Number(url.searchParams.get("firstChapter") || "1");
    const lastChapter = Number(url.searchParams.get("lastChapter") || "");
    try {
      return jsonResponse(response, 200, await buildCommittedChapterReview(
        projectId,
        Number.isInteger(firstChapter) && firstChapter > 0 ? firstChapter : 1,
        Number.isInteger(lastChapter) && lastChapter > 0 ? lastChapter : void 0
      ));
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/runs") {
    try {
      const input = normalizeInput(await readJsonBody(request));
      if (!input.title) return jsonResponse(response, 400, { error: "title_required" });
      if (input.coreIdea.length < 20) return jsonResponse(response, 400, { error: "core_idea_must_be_at_least_20_chars" });
      if (!input.factoryProjectId) {
        const projects = await withFactoryDb(rootDir, async (db) => db.listProjects());
        return jsonResponse(response, 400, {
          error: "factory_project_required_for_debug_trace",
          message: "\u8FD0\u884C\u8C03\u8BD5\u8282\u70B9\u524D\u5FC5\u987B\u5148\u7ED1\u5B9A\u4E00\u4E2A\u5C0F\u8BF4\u5DE5\u5382\u9879\u76EE\uFF1B\u8BF7\u5728\u8C03\u8BD5\u9875\u9876\u90E8\u9879\u76EE\u4E0B\u62C9\u6846\u9009\u62E9\u9879\u76EE\u540E\u518D\u8FD0\u884C\u3002",
          projectCount: projects.length,
          firstProjectId: projects[0]?.id || null
        });
      }
      const runId = `wf_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "world-foundation",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run);
      jsonResponse(response, 202, { runId, status: run.status });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/character-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("world-foundation");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_world_run_not_found" });
      if (upstreamRun.nodeId !== "world-foundation") return jsonResponse(response, 400, { error: "upstream_run_must_be_world_foundation" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) {
        return jsonResponse(response, 409, { error: "upstream_world_run_must_be_completed_and_valid" });
      }
      const worldInput = upstreamRun.input;
      const temperatureValue = Number(body.temperature);
      const input = {
        modelConfigId: String(body.modelConfigId || worldInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, worldInput),
        upstreamRunId: upstreamRun.runId,
        planningFocus: String(body.planningFocus || "").trim(),
        totalChapters: worldInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : worldInput.temperature,
        worldFoundation: upstreamRun.result
      };
      const runId = `cp_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "character-planning",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/initial-state-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("character-planning");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_character_planning_run_not_found" });
      if (upstreamRun.nodeId !== "character-planning") return jsonResponse(response, 400, { error: "upstream_run_must_be_character_planning" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) {
        return jsonResponse(response, 409, { error: "upstream_character_planning_run_must_be_completed_and_valid" });
      }
      const characterInput = upstreamRun.input;
      const temperatureValue = Number(body.temperature);
      const openingChapterValue = Number(body.openingChapter);
      const input = {
        modelConfigId: String(body.modelConfigId || characterInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, characterInput),
        upstreamRunId: upstreamRun.runId,
        stateFocus: String(body.stateFocus || "").trim(),
        openingChapter: Number.isFinite(openingChapterValue) ? Math.max(1, Math.min(characterInput.totalChapters, Math.round(openingChapterValue))) : 1,
        totalChapters: characterInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.35,
        worldFoundation: characterInput.worldFoundation,
        characterPlanning: upstreamRun.result
      };
      const runId = `is_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "initial-character-state",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/world-matrix-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("initial-character-state");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_initial_character_state_run_not_found" });
      if (upstreamRun.nodeId !== "initial-character-state") return jsonResponse(response, 400, { error: "upstream_run_must_be_initial_character_state" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) {
        return jsonResponse(response, 409, { error: "upstream_initial_character_state_run_must_be_completed_and_valid" });
      }
      const initialInput = upstreamRun.input;
      const temperatureValue = Number(body.temperature);
      const input = {
        modelConfigId: String(body.modelConfigId || initialInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, initialInput),
        upstreamRunId: upstreamRun.runId,
        matrixFocus: String(body.matrixFocus || "").trim(),
        totalChapters: initialInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.25,
        worldFoundation: initialInput.worldFoundation,
        characterPlanning: initialInput.characterPlanning,
        initialCharacterState: upstreamRun.result
      };
      const runId = `wm_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "world-matrix",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/plot-architecture-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("world-matrix");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_world_matrix_run_not_found" });
      if (upstreamRun.nodeId !== "world-matrix") return jsonResponse(response, 400, { error: "upstream_run_must_be_world_matrix" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) {
        return jsonResponse(response, 409, { error: "upstream_world_matrix_run_must_be_completed_and_valid" });
      }
      const matrixInput = upstreamRun.input;
      const temperatureValue = Number(body.temperature);
      const input = {
        modelConfigId: String(body.modelConfigId || matrixInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, matrixInput),
        upstreamRunId: upstreamRun.runId,
        architectureFocus: String(body.architectureFocus || "").trim(),
        totalChapters: matrixInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.4,
        worldFoundation: matrixInput.worldFoundation,
        characterPlanning: matrixInput.characterPlanning,
        initialCharacterState: matrixInput.initialCharacterState,
        worldMatrix: upstreamRun.result
      };
      const runId = `pa_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "plot-architecture",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/story-bible-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("plot-architecture");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_plot_architecture_run_not_found" });
      if (upstreamRun.nodeId !== "plot-architecture") return jsonResponse(response, 400, { error: "upstream_run_must_be_plot_architecture" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_plot_architecture_run_must_be_completed_and_valid" });
      const plotInput = upstreamRun.input;
      const temperatureValue = Number(body.temperature);
      const input = {
        modelConfigId: String(body.modelConfigId || plotInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, plotInput),
        upstreamRunId: upstreamRun.runId,
        bibleFocus: String(body.bibleFocus || "").trim(),
        totalChapters: plotInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.2,
        worldFoundation: plotInput.worldFoundation,
        characterPlanning: plotInput.characterPlanning,
        initialCharacterState: plotInput.initialCharacterState,
        worldMatrix: plotInput.worldMatrix,
        plotArchitecture: upstreamRun.result
      };
      const runId = `sb_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "story-bible",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/volume-strategy-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("story-bible");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_story_bible_run_not_found" });
      if (upstreamRun.nodeId !== "story-bible") return jsonResponse(response, 400, { error: "upstream_run_must_be_story_bible" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_story_bible_run_must_be_completed_and_valid" });
      const bibleInput = upstreamRun.input;
      const arcCount = storyBibleSourceRecords(bibleInput.plotArchitecture, "arcArchitecture").length;
      const maxVolumeCount = Math.max(1, Math.min(12, arcCount));
      const targetValue = body.targetVolumeCount === void 0 || body.targetVolumeCount === null || body.targetVolumeCount === "" ? volumeStrategyTargetForArcs(arcCount) : Number(body.targetVolumeCount);
      if (!Number.isInteger(targetValue) || targetValue < Math.min(2, maxVolumeCount) || targetValue > maxVolumeCount) return jsonResponse(response, 400, { error: `target_volume_count_must_be_between_${Math.min(2, maxVolumeCount)}_and_${maxVolumeCount}` });
      const temperatureValue = Number(body.temperature);
      const input = {
        modelConfigId: String(body.modelConfigId || bibleInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, bibleInput),
        upstreamRunId: upstreamRun.runId,
        strategyFocus: String(body.strategyFocus || "").trim(),
        targetVolumeCount: targetValue,
        totalChapters: bibleInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.3,
        worldFoundation: bibleInput.worldFoundation,
        characterPlanning: bibleInput.characterPlanning,
        initialCharacterState: bibleInput.initialCharacterState,
        worldMatrix: bibleInput.worldMatrix,
        plotArchitecture: bibleInput.plotArchitecture,
        storyBible: upstreamRun.result
      };
      const runId = `vs_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "volume-strategy",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, targetVolumeCount: targetValue });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  const chapterRepairMatch = url.pathname.match(/^\/chapter-blueprint-runs\/([^/]+)\/repair$/u);
  if (request.method === "POST" && chapterRepairMatch) {
    const run = await loadRun(chapterRepairMatch[1]);
    if (!run) return jsonResponse(response, 404, { error: "chapter_blueprint_run_not_found" });
    if (run.nodeId !== "chapter-blueprints") return jsonResponse(response, 400, { error: "run_must_be_chapter_blueprints" });
    if (!run.result) return jsonResponse(response, 409, { error: "chapter_blueprint_result_missing" });
    if (["queued", "running"].includes(run.status)) return jsonResponse(response, 409, { error: "chapter_blueprint_run_is_busy" });
    const currentValidation = mergeChapterBlueprintSemanticAudit(validateChapterBlueprints(run.result, run.input), run.semanticAudit);
    if (currentValidation.valid) return jsonResponse(response, 409, { error: "chapter_blueprint_repair_not_needed" });
    run.status = "queued";
    run.validation = currentValidation;
    run.error = null;
    await persistRun(run);
    jsonResponse(response, 202, { runId: run.runId, status: run.status, mode: "repair-current-result", errorCount: currentValidation.errors.length });
    void executeChapterBlueprintRepairOnly(run);
    return;
  }
  const chapterAuditMatch = url.pathname.match(/^\/chapter-blueprint-runs\/([^/]+)\/audit$/u);
  if (request.method === "POST" && chapterAuditMatch) {
    const run = await loadRun(chapterAuditMatch[1]);
    if (!run) return jsonResponse(response, 404, { error: "chapter_blueprint_run_not_found" });
    if (run.nodeId !== "chapter-blueprints") return jsonResponse(response, 400, { error: "run_must_be_chapter_blueprints" });
    if (!run.result) return jsonResponse(response, 409, { error: "chapter_blueprint_result_missing" });
    if (["queued", "running"].includes(run.status)) return jsonResponse(response, 409, { error: "chapter_blueprint_run_is_busy" });
    applyChapterBlueprintDeterministicRepairs(run, run.result, run.input, "\u5BA1\u8BA1\u8BF7\u6C42\u9884\u68C0");
    await persistRun(run);
    const structural = validateChapterBlueprints(run.result, run.input);
    if (!structural.valid) return jsonResponse(response, 409, { error: "chapter_blueprint_structural_validation_failed", details: structural.errors });
    run.status = "queued";
    run.validation = structural;
    run.semanticAudit = null;
    run.error = null;
    await persistRun(run);
    jsonResponse(response, 202, { runId: run.runId, status: run.status, mode: "semantic-audit-only" });
    void executeChapterBlueprintAuditOnly(run);
    return;
  }
  if (request.method === "GET" && url.pathname === "/chapter-blueprint-runs") {
    const upstreamRunId = String(url.searchParams.get("upstreamRunId") || "").trim();
    const volumeId = String(url.searchParams.get("volumeId") || "").trim();
    const chapterRuns = await listChapterBlueprintRuns({ upstreamRunId: upstreamRunId || void 0, volumeId: volumeId || void 0 });
    return jsonResponse(response, 200, {
      runs: chapterRuns.map((run) => {
        const input = run.input;
        return {
          runId: run.runId,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
          status: run.status,
          valid: run.validation?.valid === true,
          errorCount: run.validation?.errors.length || 0,
          warningCount: run.validation?.warnings.length || 0,
          upstreamRunId: input.upstreamRunId,
          volumeId: input.volumeId,
          startChapter: input.startChapter,
          endChapter: input.endChapter,
          previousBatchRunId: input.previousBatchRunId || null,
          blueprintCount: Array.isArray(run.result?.blueprints) ? run.result.blueprints.length : 0,
          semanticAudit: run.semanticAudit || null,
          error: run.error
        };
      })
    });
  }
  if (request.method === "POST" && url.pathname === "/chapter-blueprint-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("volume-strategy");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_volume_strategy_run_not_found" });
      if (upstreamRun.nodeId !== "volume-strategy") return jsonResponse(response, 400, { error: "upstream_run_must_be_volume_strategy" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_volume_strategy_run_must_be_completed_and_valid" });
      const volumeInput = upstreamRun.input;
      const volumes = storyBibleSourceRecords(upstreamRun.result, "volumes");
      const volumeId = String(body.volumeId || volumes[0]?.id || "").trim();
      const volume = volumes.find((entry) => String(entry.id || "").trim() === volumeId);
      if (!volume) return jsonResponse(response, 400, { error: "selected_volume_not_found" });
      const volumeStart = Number(volume.startChapter);
      const volumeEnd = Number(volume.endChapter);
      const startChapter = body.startChapter === void 0 || body.startChapter === null || body.startChapter === "" ? volumeStart : Number(body.startChapter);
      const endChapter = body.endChapter === void 0 || body.endChapter === null || body.endChapter === "" ? Math.min(volumeEnd, startChapter + chapterBlueprintStableBatchLimit - 1) : Number(body.endChapter);
      if (!Number.isInteger(startChapter) || !Number.isInteger(endChapter) || startChapter < volumeStart || endChapter > volumeEnd || endChapter < startChapter) return jsonResponse(response, 400, { error: `chapter_range_must_be_within_${volumeStart}_and_${volumeEnd}` });
      if (endChapter - startChapter + 1 > chapterBlueprintStableBatchLimit) return jsonResponse(response, 400, {
        error: `\u7A33\u5B9A\u751F\u6210\u6A21\u5F0F\u4E0B\u7AE0\u8282\u84DD\u56FE\u6BCF\u6279\u6700\u591A ${chapterBlueprintStableBatchLimit} \u7AE0\uFF1B\u8BF7\u5148\u751F\u6210\u7B2C ${startChapter}-${Math.min(volumeEnd, startChapter + chapterBlueprintStableBatchLimit - 1)} \u7AE0\uFF0C\u901A\u8FC7\u540E\u518D\u7EE7\u7EED\u4E0B\u4E00\u6279\u3002`,
        stableBatchLimit: chapterBlueprintStableBatchLimit,
        recommendedStartChapter: startChapter,
        recommendedEndChapter: Math.min(volumeEnd, startChapter + chapterBlueprintStableBatchLimit - 1)
      });
      const priorRuns = await listChapterBlueprintRuns({ upstreamRunId: upstreamRun.runId, volumeId });
      const completedChapters = /* @__PURE__ */ new Set();
      for (const candidate of priorRuns) {
        if (candidate.status !== "completed" || candidate.validation?.valid !== true || !candidate.result) continue;
        const candidateInput = candidate.input;
        for (let chapter = candidateInput.startChapter; chapter <= candidateInput.endChapter; chapter += 1) completedChapters.add(chapter);
      }
      const nextMissingChapter = Array.from({ length: volumeEnd - volumeStart + 1 }, (_, index) => volumeStart + index).find((chapter) => !completedChapters.has(chapter));
      if (nextMissingChapter === void 0) return jsonResponse(response, 409, { error: `\u672C\u5377\u7B2C ${volumeStart}-${volumeEnd} \u7AE0\u5DF2\u7ECF\u5168\u90E8\u901A\u8FC7\uFF0C\u4E0D\u80FD\u91CD\u590D\u751F\u6210\u3002` });
      const overlappingCompletedChapters = Array.from({ length: endChapter - startChapter + 1 }, (_, index) => startChapter + index).filter((chapter) => completedChapters.has(chapter));
      if (overlappingCompletedChapters.length) return jsonResponse(response, 409, {
        error: `\u8BF7\u6C42\u8303\u56F4\u7B2C ${startChapter}-${endChapter} \u7AE0\u5305\u542B\u5DF2\u7ECF\u901A\u8FC7\u7684\u7AE0\u8282\uFF08${overlappingCompletedChapters.slice(0, 12).join("\u3001")}\uFF09\uFF1B\u4E0B\u4E00\u6279\u5FC5\u987B\u4ECE\u7B2C ${nextMissingChapter} \u7AE0\u5F00\u59CB\u3002`,
        nextChapter: nextMissingChapter
      });
      if (startChapter !== nextMissingChapter) return jsonResponse(response, 409, {
        error: `\u7AE0\u8282\u84DD\u56FE\u5FC5\u987B\u8FDE\u7EED\u751F\u6210\uFF1B\u5F53\u524D\u4E0B\u4E00\u5904\u672A\u901A\u8FC7\u7AE0\u8282\u662F\u7B2C ${nextMissingChapter} \u7AE0\uFF0C\u4E0D\u80FD\u4ECE\u7B2C ${startChapter} \u7AE0\u5F00\u59CB\u3002`,
        nextChapter: nextMissingChapter
      });
      let previousBatchRun = null;
      let previousBatchHandoff = null;
      if (startChapter > volumeStart) {
        previousBatchRun = priorRuns.find((candidate) => {
          const candidateInput = candidate.input;
          return candidate.status === "completed" && candidate.validation?.valid === true && candidateInput.endChapter === startChapter - 1;
        }) || null;
        if (!previousBatchRun?.result) return jsonResponse(response, 409, { error: `previous_valid_chapter_blueprint_batch_required_ending_at_${startChapter - 1}` });
        const previousBlueprints = Array.isArray(previousBatchRun.result.blueprints) ? previousBatchRun.result.blueprints : [];
        const previousLastBlueprint = previousBlueprints.find((entry) => Number(entry.chapterNumber) === startChapter - 1) || previousBlueprints.at(-1) || {};
        const previousWritingHandoff = previousBatchRun.result.handoffToWritingPlan && typeof previousBatchRun.result.handoffToWritingPlan === "object" && !Array.isArray(previousBatchRun.result.handoffToWritingPlan) ? previousBatchRun.result.handoffToWritingPlan : {};
        previousBatchHandoff = {
          endChapter: startChapter - 1,
          endingHook: previousLastBlueprint.endingHook || previousLastBlueprint.nextPressure,
          nextChapterEntryState: previousLastBlueprint.nextChapterEntryState || previousLastBlueprint.nextPressure,
          nextChapterHandoff: previousLastBlueprint.nextChapterHandoff || previousLastBlueprint.nextPressure,
          batchExitState: previousWritingHandoff.batchExitState || previousWritingHandoff.batchExitPressure,
          unresolvedRisks: previousWritingHandoff.unresolvedRisks
        };
      }
      const targetWordCount = body.targetWordCount === void 0 || body.targetWordCount === null || body.targetWordCount === "" ? 2500 : Number(body.targetWordCount);
      if (!Number.isInteger(targetWordCount) || targetWordCount < 1e3 || targetWordCount > 1e4) return jsonResponse(response, 400, { error: "target_word_count_must_be_between_1000_and_10000" });
      const temperatureValue = Number(body.temperature);
      const input = {
        modelConfigId: String(body.modelConfigId || volumeInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, volumeInput),
        upstreamRunId: upstreamRun.runId,
        blueprintFocus: String(body.blueprintFocus || "").trim(),
        volumeId,
        startChapter,
        endChapter,
        targetWordCount,
        totalChapters: volumeInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.25,
        previousBatchRunId: previousBatchRun?.runId || null,
        previousBatchHandoff,
        worldFoundation: volumeInput.worldFoundation,
        characterPlanning: volumeInput.characterPlanning,
        initialCharacterState: volumeInput.initialCharacterState,
        worldMatrix: volumeInput.worldMatrix,
        plotArchitecture: volumeInput.plotArchitecture,
        storyBible: volumeInput.storyBible,
        volumeStrategy: upstreamRun.result
      };
      const runId = `cb_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "chapter-blueprints",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, volumeId, startChapter, endChapter, previousBatchRunId: previousBatchRun?.runId || null });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/style-profile-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("chapter-blueprints");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_chapter_blueprints_run_not_found" });
      if (upstreamRun.nodeId !== "chapter-blueprints") return jsonResponse(response, 400, { error: "upstream_run_must_be_chapter_blueprints" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_chapter_blueprints_run_must_be_completed_and_valid" });
      const chapterInput = upstreamRun.input;
      const aggregated = await aggregateCompletedChapterBlueprintsForStyle(upstreamRun);
      const blueprints = Array.isArray(aggregated.aggregate.blueprints) ? aggregated.aggregate.blueprints : [];
      if (!blueprints.length) return jsonResponse(response, 409, { error: "upstream_chapter_blueprints_empty" });
      const requestedSampleChapter = Number(body.sampleChapter);
      const firstBlueprintChapter = aggregated.firstChapter;
      const lastBlueprintChapter = aggregated.lastChapter;
      const sampleChapter = Number.isInteger(requestedSampleChapter) ? Math.max(firstBlueprintChapter, Math.min(lastBlueprintChapter, requestedSampleChapter)) : firstBlueprintChapter;
      const temperatureValue = Number(body.temperature);
      const maxRoundsValue = Number(body.maxRounds);
      const input = {
        modelConfigId: String(body.modelConfigId || chapterInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, chapterInput),
        upstreamRunId: upstreamRun.runId,
        styleFocus: String(body.styleFocus || "").trim(),
        humanBaselineText: String(body.humanBaselineText || "").trim(),
        aigcGranularity: String(body.aigcGranularity || "merged_sentence").trim(),
        aigcPolicy: String(body.aigcPolicy || "balanced").trim(),
        aigcMinSegmentChars: Number.isFinite(Number(body.aigcMinSegmentChars)) ? Math.max(20, Math.min(500, Math.floor(Number(body.aigcMinSegmentChars)))) : 120,
        sampleChapter,
        maxRounds: Number.isFinite(maxRoundsValue) ? Math.max(1, Math.min(12, Math.floor(maxRoundsValue))) : 6,
        totalChapters: chapterInput.totalChapters,
        temperature: Number.isFinite(temperatureValue) ? Math.max(0, Math.min(1.2, temperatureValue)) : 0.2,
        worldFoundation: chapterInput.worldFoundation,
        characterPlanning: chapterInput.characterPlanning,
        storyBible: chapterInput.storyBible,
        volumeStrategy: chapterInput.volumeStrategy,
        chapterBlueprints: aggregated.aggregate
      };
      const runId = `sp_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "style-profile",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, {
        runId,
        status: run.status,
        upstreamRunId: upstreamRun.runId,
        sampleChapter,
        aggregatedBlueprintCount: aggregated.blueprintCount,
        aggregatedFirstChapter: aggregated.firstChapter,
        aggregatedLastChapter: aggregated.lastChapter,
        aggregatedRunCount: aggregated.completedRuns.length
      });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  const styleProfileFreezeMatch = url.pathname.match(/^\/style-profile-runs\/([^/]+)\/freeze$/u);
  if (request.method === "POST" && styleProfileFreezeMatch) {
    const run = await loadRun(styleProfileFreezeMatch[1]);
    if (!run) return jsonResponse(response, 404, { error: "style_profile_run_not_found" });
    if (run.nodeId !== "style-profile") return jsonResponse(response, 400, { error: "run_must_be_style_profile" });
    if (["queued", "running"].includes(run.status)) return jsonResponse(response, 409, { error: "style_profile_run_is_busy" });
    try {
      const freeze = await freezeStyleProfileDebugRun(run);
      run.result = {
        ...run.result && typeof run.result === "object" && !Array.isArray(run.result) ? run.result : {},
        freeze
      };
      addEvent(run, "success", "style-freeze", "\u5DF2\u51BB\u7ED3\u4E3A\u6B63\u5F0F\u6587\u98CE\u5408\u540C\uFF1A\u6837\u6BB5\u3001\u98CE\u683C\u3001\u7528\u6237\u89C4\u8303\u548C AIGC \u4FEE\u590D\u7ECF\u9A8C\u5DF2\u5199\u5165\u9879\u76EE\u8D44\u4EA7\u3002", freeze);
      await persistRun(run);
      return jsonResponse(response, 200, { runId: run.runId, freeze });
    } catch (error) {
      addEvent(run, "error", "style-freeze", `\u6587\u98CE\u51BB\u7ED3\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
      await persistRun(run);
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/single-chapter-context-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("style-profile");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_style_profile_run_not_found" });
      if (upstreamRun.nodeId !== "style-profile") return jsonResponse(response, 400, { error: "upstream_run_must_be_style_profile" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_style_profile_run_must_be_completed_and_valid" });
      const frozenStyle = await loadStyleEvolution(rootDir);
      if (frozenStyle.contract.approval?.status !== "approved" || !frozenStyle.contract.approvedSample || !frozenStyle.contract.styleContract) {
        return jsonResponse(response, 409, { error: "style_profile_must_be_frozen_before_single_chapter_context" });
      }
      const styleInput = upstreamRun.input;
      const blueprints = styleProfileBlueprints(styleInput);
      if (!blueprints.length) return jsonResponse(response, 409, { error: "style_profile_chapter_blueprints_empty" });
      const firstChapter = Number(blueprints[0]?.chapterNumber || 1);
      const lastChapter = Number(blueprints.at(-1)?.chapterNumber || firstChapter);
      const requestedChapter = Number(body.chapterNumber);
      const chapterNumber = Number.isInteger(requestedChapter) ? Math.max(firstChapter, Math.min(lastChapter, requestedChapter)) : firstChapter;
      if (!blueprints.some((entry) => Number(entry.chapterNumber) === chapterNumber)) return jsonResponse(response, 400, { error: `chapter_${chapterNumber}_blueprint_not_found` });
      const targetWordCount = Number(body.targetWordCount);
      const normalizedTargetWordCount = Number.isInteger(targetWordCount) ? Math.max(800, Math.min(1e4, targetWordCount)) : 2500;
      const input = {
        modelConfigId: String(body.modelConfigId || styleInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, styleInput),
        upstreamRunId: upstreamRun.runId,
        chapterNumber,
        contextFocus: String(body.contextFocus || "").trim(),
        targetWordCount: normalizedTargetWordCount,
        styleProfile: upstreamRun.result,
        frozenStyle,
        storyBible: styleInput.storyBible,
        volumeStrategy: styleInput.volumeStrategy,
        chapterBlueprints: styleInput.chapterBlueprints
      };
      const runId = `cc_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "single-chapter-context",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, chapterNumber, firstChapter, lastChapter });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/chapter-draft-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("single-chapter-context");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_single_chapter_context_run_not_found" });
      if (upstreamRun.nodeId !== "single-chapter-context") return jsonResponse(response, 400, { error: "upstream_run_must_be_single_chapter_context" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_single_chapter_context_run_must_be_completed_and_valid" });
      const contextInput = upstreamRun.input;
      const contextResult = upstreamRun.result;
      const contextSource = contextResult.source && typeof contextResult.source === "object" && !Array.isArray(contextResult.source) ? contextResult.source : {};
      const chapterNumber = Number(contextSource.chapterNumber || contextInput.chapterNumber || body.chapterNumber || 1);
      const targetWordCount = Number(body.targetWordCount || contextSource.targetWordCount || contextInput.targetWordCount);
      const normalizedTargetWordCount = Number.isInteger(targetWordCount) ? Math.max(800, Math.min(12e3, targetWordCount)) : 2500;
      const temperature = Number(body.temperature);
      const input = {
        modelConfigId: String(body.modelConfigId || contextInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, contextInput),
        upstreamRunId: upstreamRun.runId,
        chapterNumber,
        draftFocus: String(body.draftFocus || "").trim(),
        targetWordCount: normalizedTargetWordCount,
        temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(1.2, temperature)) : 0.35,
        maxRepairRounds: Number.isFinite(Number(body.maxRepairRounds)) ? Math.max(0, Math.min(12, Math.floor(Number(body.maxRepairRounds)))) : 3,
        aigcPolicy: String(body.aigcPolicy || "balanced").trim(),
        aigcMinSegmentChars: Number.isFinite(Number(body.aigcMinSegmentChars)) ? Math.max(20, Math.min(500, Math.floor(Number(body.aigcMinSegmentChars)))) : 120,
        singleChapterContext: contextResult
      };
      if (!input.modelConfigId) return jsonResponse(response, 400, { error: "model_config_required" });
      const runId = `dr_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "chapter-draft",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: null,
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, chapterNumber });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/chapter-commit-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("chapter-draft");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_chapter_draft_run_not_found" });
      if (upstreamRun.nodeId !== "chapter-draft") return jsonResponse(response, 400, { error: "upstream_run_must_be_chapter_draft" });
      if (upstreamRun.status !== "completed" || upstreamRun.validation?.valid !== true || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_chapter_draft_run_must_be_completed_and_valid" });
      const draftPayload = chapterCommitDraftPayload(upstreamRun);
      const chapterNumber = Number(body.chapterNumber || draftPayload.chapterNumber || upstreamRun.input.chapterNumber);
      const input = {
        modelConfigId: String(body.modelConfigId || upstreamRun.input.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, upstreamRun.input),
        upstreamRunId: upstreamRun.runId,
        chapterNumber,
        commitNote: String(body.commitNote || "").trim(),
        chapterDraft: upstreamRun.result
      };
      const runId = `cm_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "chapter-commit",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: { modelName: "no-llm", apiMode: "local-freeze" },
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, chapterNumber });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/continuous-chapter-production-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("style-profile");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_style_profile_run_not_found" });
      if (upstreamRun.nodeId !== "style-profile") return jsonResponse(response, 400, { error: "upstream_run_must_be_style_profile" });
      if (upstreamRun.status !== "completed" || upstreamRun.validation?.valid !== true || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_style_profile_run_must_be_completed_and_valid" });
      const frozenStyle = await loadStyleEvolution(rootDir);
      if (frozenStyle.contract.approval?.status !== "approved" || !frozenStyle.contract.approvedSample || !frozenStyle.contract.styleContract) {
        return jsonResponse(response, 409, { error: "style_profile_must_be_frozen_before_continuous_chapter_production" });
      }
      const styleInput = upstreamRun.input;
      const blueprints = styleProfileBlueprints(styleInput);
      if (!blueprints.length) return jsonResponse(response, 409, { error: "style_profile_chapter_blueprints_empty" });
      const firstChapter = Number(blueprints[0]?.chapterNumber || 1);
      const lastChapter = Number(blueprints.at(-1)?.chapterNumber || firstChapter);
      const requestedStart = Number(body.startChapter);
      const requestedEnd = Number(body.endChapter);
      const startChapter = Number.isInteger(requestedStart) ? Math.max(firstChapter, Math.min(lastChapter, requestedStart)) : firstChapter;
      const endChapter = Number.isInteger(requestedEnd) ? Math.max(startChapter, Math.min(lastChapter, requestedEnd)) : startChapter;
      const chapterCount = endChapter - startChapter + 1;
      if (chapterCount < 1 || chapterCount > 100) return jsonResponse(response, 400, { error: "continuous_chapter_count_must_be_between_1_and_100" });
      for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
        if (!blueprints.some((entry) => Number(entry.chapterNumber) === chapter)) return jsonResponse(response, 400, { error: `chapter_${chapter}_blueprint_not_found` });
      }
      const targetWordCount = Number(body.targetWordCount);
      const normalizedTargetWordCount = Number.isInteger(targetWordCount) ? Math.max(800, Math.min(12e3, targetWordCount)) : 2500;
      const temperature = Number(body.temperature);
      const maxRepairRounds = Number(body.maxRepairRounds);
      const factoryProjectId = await debugFactoryProjectId(body, upstreamRun, styleInput);
      const committedAssets = await listCommittedChapterAssets(factoryProjectId);
      const committedCoverage = committedChapterCoverage(committedAssets, firstChapter);
      const requestedChapters = Array.from({ length: chapterCount }, (_, index) => startChapter + index);
      const overlappingCommitted = requestedChapters.filter((chapter) => committedCoverage.chapters.includes(chapter));
      if (overlappingCommitted.length) return jsonResponse(response, 409, {
        error: `\u8BF7\u6C42\u8303\u56F4\u7B2C ${startChapter}-${endChapter} \u7AE0\u5305\u542B\u5DF2\u51BB\u7ED3\u7AE0\u8282\uFF08${overlappingCommitted.slice(0, 20).join("\u3001")}\uFF09\uFF1B\u4E0B\u4E00\u7AE0\u5E94\u4ECE\u7B2C ${committedCoverage.nextChapter} \u7AE0\u5F00\u59CB\u3002`,
        nextChapter: committedCoverage.nextChapter,
        committedChapters: committedCoverage.chapters,
        lastContinuousChapter: committedCoverage.lastContinuousChapter
      });
      if (startChapter !== committedCoverage.nextChapter && committedCoverage.count > 0) return jsonResponse(response, 409, {
        error: `\u8FDE\u7EED\u751F\u4EA7\u5FC5\u987B\u4ECE\u4E0B\u4E00\u7AE0\u7B2C ${committedCoverage.nextChapter} \u7AE0\u5F00\u59CB\uFF0C\u4E0D\u80FD\u4ECE\u7B2C ${startChapter} \u7AE0\u5F00\u59CB\u3002`,
        nextChapter: committedCoverage.nextChapter,
        committedChapters: committedCoverage.chapters,
        lastContinuousChapter: committedCoverage.lastContinuousChapter
      });
      const input = {
        modelConfigId: String(body.modelConfigId || styleInput.modelConfigId || "").trim(),
        factoryProjectId,
        upstreamRunId: upstreamRun.runId,
        startChapter,
        endChapter,
        targetWordCount: normalizedTargetWordCount,
        maxRepairRounds: Number.isFinite(maxRepairRounds) ? Math.max(0, Math.min(12, Math.floor(maxRepairRounds))) : 3,
        aigcPolicy: String(body.aigcPolicy || "balanced").trim(),
        aigcMinSegmentChars: Number.isFinite(Number(body.aigcMinSegmentChars)) ? Math.max(20, Math.min(500, Math.floor(Number(body.aigcMinSegmentChars)))) : 120,
        temperature: Number.isFinite(temperature) ? Math.max(0, Math.min(1.2, temperature)) : 0.35,
        productionFocus: String(body.productionFocus || "").trim(),
        styleProfile: upstreamRun.result,
        frozenStyle,
        storyBible: styleInput.storyBible,
        volumeStrategy: styleInput.volumeStrategy,
        chapterBlueprints: styleInput.chapterBlueprints
      };
      if (!input.modelConfigId) return jsonResponse(response, 400, { error: "model_config_required" });
      const runId = `cp_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "continuous-chapter-production",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: { modelName: "workflow-orchestrator", apiMode: "local-compose" },
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, { runId, status: run.status, upstreamRunId: upstreamRun.runId, startChapter, endChapter });
      void debugWorkflowKernel.executeNode(run.nodeId, run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/style-profile-aigc-calibration-runs") {
    try {
      const body = await readJsonBody(request);
      const requestedUpstreamRunId = String(body.upstreamRunId || "").trim();
      const upstreamRun = requestedUpstreamRunId ? await loadRun(requestedUpstreamRunId) : await findLatestCompletedRun("chapter-blueprints");
      if (!upstreamRun) return jsonResponse(response, 404, { error: "upstream_chapter_blueprints_run_not_found" });
      if (upstreamRun.nodeId !== "chapter-blueprints") return jsonResponse(response, 400, { error: "upstream_run_must_be_chapter_blueprints" });
      if (upstreamRun.status !== "completed" || !upstreamRun.validation?.valid || !upstreamRun.result) return jsonResponse(response, 409, { error: "upstream_chapter_blueprints_run_must_be_completed_and_valid" });
      const chapterInput = upstreamRun.input;
      const aggregated = await aggregateCompletedChapterBlueprintsForStyle(upstreamRun);
      const blueprints = Array.isArray(aggregated.aggregate.blueprints) ? aggregated.aggregate.blueprints : [];
      if (!blueprints.length) return jsonResponse(response, 409, { error: "upstream_chapter_blueprints_empty" });
      const requestedSampleChapter = Number(body.sampleChapter);
      const sampleChapter = Number.isInteger(requestedSampleChapter) ? Math.max(aggregated.firstChapter, Math.min(aggregated.lastChapter, requestedSampleChapter)) : aggregated.firstChapter;
      const input = {
        modelConfigId: String(body.modelConfigId || chapterInput.modelConfigId || "").trim(),
        factoryProjectId: await debugFactoryProjectId(body, upstreamRun, chapterInput),
        upstreamRunId: upstreamRun.runId,
        styleFocus: String(body.styleFocus || "").trim(),
        humanBaselineText: String(body.humanBaselineText || "").trim(),
        aigcGranularity: String(body.aigcGranularity || "merged_sentence").trim(),
        aigcPolicy: String(body.aigcPolicy || "balanced").trim(),
        aigcMinSegmentChars: Number.isFinite(Number(body.aigcMinSegmentChars)) ? Math.max(20, Math.min(500, Math.floor(Number(body.aigcMinSegmentChars)))) : 120,
        sampleChapter,
        maxRounds: 1,
        totalChapters: chapterInput.totalChapters,
        temperature: 0,
        worldFoundation: chapterInput.worldFoundation,
        characterPlanning: chapterInput.characterPlanning,
        storyBible: chapterInput.storyBible,
        volumeStrategy: chapterInput.volumeStrategy,
        chapterBlueprints: aggregated.aggregate
      };
      const runId = `ac_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const run = {
        runId,
        nodeId: "style-profile",
        status: "queued",
        createdAt: nowIso(),
        startedAt: null,
        completedAt: null,
        input,
        provider: { detector: "aigc", modelName: "AIGC calibration", apiKey: "[REDACTED]" },
        prompts: null,
        rawResponse: "",
        result: null,
        validation: null,
        artifacts: [],
        events: [],
        error: null
      };
      await registerDebugRun(run, upstreamRun);
      jsonResponse(response, 202, {
        runId,
        status: run.status,
        upstreamRunId: upstreamRun.runId,
        sampleChapter,
        aggregatedBlueprintCount: aggregated.blueprintCount,
        aggregatedFirstChapter: aggregated.firstChapter,
        aggregatedLastChapter: aggregated.lastChapter
      });
      void executeStyleAigcCalibrationRun(run);
      return;
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  if (request.method === "POST" && url.pathname === "/aigc-lab/detect") {
    try {
      const body = await readJsonBody(request);
      const text = String(body.text || "").trim();
      if (text.length < 2) return jsonResponse(response, 400, { error: "text_required" });
      const thresholdValue = Number(body.threshold);
      const config = getAigcDetectorConfig(rootDir);
      const threshold = Number.isFinite(thresholdValue) ? Math.max(0.01, Math.min(0.99, thresholdValue)) : config.threshold ?? 0.8;
      const granularity = String(body.granularity || "sentence").trim();
      const minSegmentCharsValue = Number(body.minSegmentChars);
      const minSegmentChars = Number.isFinite(minSegmentCharsValue) ? Math.max(1, Math.min(500, Math.floor(minSegmentCharsValue))) : 80;
      const policy = String(body.policy || "strict_any_sentence").trim();
      const segments = granularity === "node09" ? null : splitAigcLabTextIntoSentenceSegments(text, { granularity, minSegmentChars });
      if (segments && !segments.length) return jsonResponse(response, 400, { error: "detectable_sentence_required" });
      const startedAt = Date.now();
      const result = await detectAigcSegments(segments || text, {
        ...config,
        threshold
      });
      const sentences = result.segments.map((entry) => {
        const score = typeof entry.score === "number" ? entry.score : null;
        const localSignals = explainAigcLabLocalSignals(entry.segment.text);
        const riskLevel = aigcLabRiskLevel(score, threshold);
        const highRisk = entry.status === "ai_likely" || score !== null && score >= threshold;
        return {
          id: entry.segment.id,
          index: entry.segment.index + 1,
          text: entry.segment.text,
          startOffset: entry.segment.startOffset,
          endOffset: entry.segment.endOffset,
          charCount: entry.charCount,
          status: entry.status,
          label: entry.label,
          score,
          confidence: entry.confidence,
          threshold,
          riskLevel,
          highRisk,
          localSignals,
          reason: entry.reason,
          raw: entry.raw
        };
      });
      const highRiskSentences = sentences.filter((entry) => entry.highRisk).sort((left, right) => Number(right.score ?? 0) - Number(left.score ?? 0));
      const passDecision = aigcLabPassDecision({
        policy,
        score: result.score,
        threshold,
        highRiskCount: highRiskSentences.length,
        totalSentences: sentences.length
      });
      return jsonResponse(response, 200, {
        ok: result.ok,
        provider: result.provider,
        status: result.status,
        score: result.score,
        confidence: result.confidence,
        threshold,
        passed: passDecision.passed,
        passPolicy: passDecision.policy,
        passReason: passDecision.reason,
        totalSentences: sentences.length,
        highRiskCount: highRiskSentences.length,
        elapsedMs: Date.now() - startedAt,
        detector: {
          provider: config.provider ?? "disabled",
          urlConfigured: Boolean(config.url?.trim()),
          threshold,
          granularity,
          minSegmentChars,
          policy: passDecision.policy
        },
        reason: result.reason,
        sentences,
        highRiskSentences
      });
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  const pauseRunMatch = url.pathname.match(/^\/runs\/([^/]+)\/pause$/u);
  if (request.method === "POST" && pauseRunMatch) {
    const run = await loadRun(pauseRunMatch[1]);
    if (!run) return jsonResponse(response, 404, { error: "run_not_found" });
    if (!["queued", "running"].includes(run.status)) {
      return jsonResponse(response, 200, {
        runId: run.runId,
        status: run.status,
        alreadyTerminal: true
      });
    }
    let reason = "\u7528\u6237\u624B\u52A8\u6682\u505C\u5F53\u524D\u8C03\u8BD5 Run\u3002";
    try {
      const body = await readJsonBody(request);
      reason = String(body.reason || reason).trim() || reason;
    } catch {
    }
    await pauseDebugRun(run, reason);
    return jsonResponse(response, 202, {
      runId: run.runId,
      status: run.status,
      pauseRequestedAt: run.pauseRequestedAt,
      reason: run.pauseReason
    });
  }
  const branchRollbackMatch = url.pathname.match(/^\/runs\/([^/]+)\/branch\/rollback$/u);
  if (request.method === "POST" && branchRollbackMatch) {
    const run = await loadRun(branchRollbackMatch[1]);
    if (!run) return jsonResponse(response, 404, { error: "run_not_found" });
    if (!run.workflowTrace || !run.workflowBranch) return jsonResponse(response, 404, { error: "debug_branch_not_found" });
    if (["queued", "running"].includes(run.status)) return jsonResponse(response, 409, { error: "debug_branch_is_busy" });
    try {
      const body = await readJsonBody(request);
      const checkpointId = String(body.checkpointId || "").trim();
      if (!checkpointId) return jsonResponse(response, 400, { error: "checkpoint_id_required" });
      const manager = new FactoryWorkflowDebugBranchManager(rootDir, run.workflowTrace.projectId);
      await manager.rollback(run.workflowBranch, checkpointId);
      await persistRun(run);
      return jsonResponse(response, 200, await manager.inspect(run.workflowBranch));
    } catch (error) {
      return jsonResponse(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  const branchMatch = url.pathname.match(/^\/runs\/([^/]+)\/branch$/u);
  if (request.method === "GET" && branchMatch) {
    const run = await loadRun(branchMatch[1]);
    if (!run) return jsonResponse(response, 404, { error: "run_not_found" });
    if (!run.workflowTrace || !run.workflowBranch) return jsonResponse(response, 404, { error: "debug_branch_not_found" });
    try {
      return jsonResponse(response, 200, await new FactoryWorkflowDebugBranchManager(rootDir, run.workflowTrace.projectId).inspect(run.workflowBranch));
    } catch (error) {
      return jsonResponse(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  }
  const runMatch = url.pathname.match(/^\/runs\/([^/]+)$/u);
  if (request.method === "GET" && runMatch) {
    const runId = runMatch[1];
    const run = await loadRun(runId);
    if (!run) return jsonResponse(response, 404, { error: "run_not_found" });
    return jsonResponse(response, 200, await loadWorkflowEvidence(run));
  }
  return jsonResponse(response, 404, { error: "not_found" });
});
async function startServer() {
  await fs.mkdir(runsRoot, { recursive: true });
  await fs.mkdir(committedChaptersRoot, { recursive: true });
  server.listen(port, "127.0.0.1", () => {
    console.log(`[world-foundation-debug] listening on http://127.0.0.1:${port}`);
    console.log(`[world-foundation-debug] runs: ${runsRoot}`);
    console.log("[world-foundation-debug] AI_NOVEL_TEST_MODE=1 is explicitly rejected");
  });
}
void startServer().catch((error) => {
  console.error("[world-foundation-debug] failed to start", error);
  process.exitCode = 1;
});
