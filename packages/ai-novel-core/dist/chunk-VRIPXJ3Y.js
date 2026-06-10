import {
  formatKnowledgeForPrompt,
  ingestProjectArtifact,
  retrieveKnowledge
} from "./chunk-HL3WMSH6.js";
import {
  createLocalTextEmbedding,
  evaluateChapterConsistency,
  extractChinesePersonNames,
  inferLockedProtagonistName,
  withFactoryDb
} from "./chunk-CRFEPMYG.js";
import {
  agentTypeFromLabel,
  createAgentMessage,
  createArtifactMessage
} from "./chunk-GZKJNHMN.js";

// src/writing-pipeline.ts
import fs2 from "fs/promises";
import path3 from "path";

// src/env-manager.ts
import fs from "fs";
import path from "path";
var PRIMARY_ENV_KEYS = {
  baseUrl: "LLM_BASE_URL",
  apiKey: "LLM_API_KEY",
  modelName: "LLM_MODEL_ID"
};
var FALLBACK_ENV_KEYS = {
  baseUrl: "OPENAI_BASE_URL",
  apiKey: "OPENAI_API_KEY",
  modelName: "OPENAI_MODEL_NAME"
};
var PACKAGE_ENV_PARTS = ["packages", "opencode-ai-novel-factory", ".env"];
var MANAGED_PROJECTS_SEGMENT = `${path.sep}.ai-novel-projects${path.sep}`;
function uniquePaths(paths) {
  return [...new Set(paths.map((candidate) => path.resolve(candidate)))];
}
function inferWorkspaceRootFromManagedProject(rootDir) {
  const index = rootDir.indexOf(MANAGED_PROJECTS_SEGMENT);
  if (index < 0) {
    return null;
  }
  return rootDir.slice(0, index) || path.parse(rootDir).root;
}
function parseProjectEnv(raw) {
  const values = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    values[key] = value;
  }
  return values;
}
function pickResolvedValue(primaryKey, fallbackKey, values) {
  const processValue = process.env[primaryKey]?.trim() || process.env[fallbackKey]?.trim();
  if (processValue) {
    return processValue;
  }
  const fileValue = values[primaryKey]?.trim() || values[fallbackKey]?.trim();
  return fileValue || null;
}
function getProjectEnvPath(rootDir = process.cwd()) {
  return path.resolve(rootDir, ".env");
}
function getProjectEnvCandidatePaths(rootDir = process.cwd()) {
  const resolvedRootDir = path.resolve(rootDir);
  const candidates = [
    getProjectEnvPath(resolvedRootDir),
    path.join(resolvedRootDir, ...PACKAGE_ENV_PARTS)
  ];
  const workspaceRoot = inferWorkspaceRootFromManagedProject(resolvedRootDir);
  if (workspaceRoot) {
    candidates.push(
      getProjectEnvPath(workspaceRoot),
      path.join(workspaceRoot, ...PACKAGE_ENV_PARTS)
    );
  }
  return uniquePaths(candidates);
}
function readProjectEnv(rootDir = process.cwd()) {
  for (const envPath of getProjectEnvCandidatePaths(rootDir)) {
    if (fs.existsSync(envPath)) {
      const raw = fs.readFileSync(envPath, "utf8");
      return {
        envPath,
        exists: true,
        values: parseProjectEnv(raw)
      };
    }
  }
  return {
    envPath: getProjectEnvPath(rootDir),
    exists: false,
    values: {}
  };
}
function resolveProjectEnvWritePath(rootDir = process.cwd()) {
  for (const envPath of getProjectEnvCandidatePaths(rootDir)) {
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }
  return getProjectEnvPath(rootDir);
}
function getProjectEnvStatus(rootDir = process.cwd()) {
  const { envPath, exists, values } = readProjectEnv(rootDir);
  const resolved = {
    baseUrl: pickResolvedValue(PRIMARY_ENV_KEYS.baseUrl, FALLBACK_ENV_KEYS.baseUrl, values),
    apiKeyPresent: Boolean(pickResolvedValue(PRIMARY_ENV_KEYS.apiKey, FALLBACK_ENV_KEYS.apiKey, values)),
    modelName: pickResolvedValue(PRIMARY_ENV_KEYS.modelName, FALLBACK_ENV_KEYS.modelName, values)
  };
  const missing = [
    resolved.baseUrl ? null : PRIMARY_ENV_KEYS.baseUrl,
    resolved.apiKeyPresent ? null : PRIMARY_ENV_KEYS.apiKey,
    resolved.modelName ? null : PRIMARY_ENV_KEYS.modelName
  ].filter(Boolean);
  return {
    envPath,
    exists,
    configured: missing.length === 0,
    missing,
    values,
    resolved
  };
}
function redactEnvValues(values) {
  const redacted = {};
  for (const [key, value] of Object.entries(values)) {
    if (/api[_-]?key|token|secret|password/i.test(key)) {
      redacted[key] = value ? "[configured]" : "";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
function getPublicProjectEnvStatus(rootDir = process.cwd()) {
  const status = getProjectEnvStatus(rootDir);
  return {
    ...status,
    values: redactEnvValues(status.values)
  };
}
function upsertProjectEnvValues(rootDir, updates) {
  const envPath = resolveProjectEnvWritePath(rootDir);
  const original = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const lines = original ? original.split("\n") : [];
  const nextKeys = new Set(Object.keys(updates));
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      return line;
    }
    const key = line.slice(0, separator).trim();
    const replacement = updates[key];
    if (replacement === void 0) {
      return line;
    }
    nextKeys.delete(key);
    return `${key}=${replacement}`;
  });
  for (const key of nextKeys) {
    rewritten.push(`${key}=${updates[key]}`);
  }
  const finalContent = `${rewritten.filter((line, index, array) => !(index === array.length - 1 && line === "")).join("\n")}
`;
  fs.writeFileSync(envPath, finalContent, "utf8");
}

// src/llm-config.ts
import fsSync from "fs";
import path2 from "path";
function readNumber(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function loadLlmConfigFromEnv(rootDir = process.cwd()) {
  const envStatus = getProjectEnvStatus(rootDir);
  const dotEnv = envStatus.values;
  const baseUrl = process.env.LLM_BASE_URL || dotEnv.LLM_BASE_URL || process.env.OPENAI_BASE_URL || dotEnv.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const apiKeyEnv = process.env.LLM_API_KEY || dotEnv.LLM_API_KEY ? "LLM_API_KEY" : process.env.OPENAI_API_KEY || dotEnv.OPENAI_API_KEY ? "OPENAI_API_KEY" : "unset";
  const modelName = process.env.LLM_MODEL_ID || dotEnv.LLM_MODEL_ID || process.env.OPENAI_MODEL_NAME || dotEnv.OPENAI_MODEL_NAME || "gpt-4o";
  return {
    provider: {
      baseUrl,
      apiKeyEnv,
      modelName,
      timeoutMs: readNumber(process.env.LLM_TIMEOUT_MS || dotEnv.LLM_TIMEOUT_MS, 12e4),
      temperature: readNumber(process.env.LLM_TEMPERATURE || dotEnv.LLM_TEMPERATURE, 0.1),
      reactMaxSteps: readNumber(process.env.MAX_STEPS || dotEnv.MAX_STEPS, 25)
    },
    writing: {
      chapterWordTarget: readNumber(process.env.NOVEL_CHAPTER_WORD_TARGET || dotEnv.NOVEL_CHAPTER_WORD_TARGET, 2500),
      chapterWordMinimum: 2500
    }
  };
}
var cachedActiveLlmConfig = null;
function getCachedActiveLlmConfig() {
  return cachedActiveLlmConfig;
}
function setCachedActiveLlmConfig(config) {
  cachedActiveLlmConfig = config;
}
function isWorkspaceRoot(dir) {
  try {
    const pkgPath = path2.join(dir, "package.json");
    if (!fsSync.existsSync(pkgPath)) {
      return false;
    }
    const content = fsSync.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(content);
    return pkg.name === "ai-novel-factory-workspace";
  } catch {
    return false;
  }
}
function resolveFactoryRootDir(dir = process.cwd()) {
  let current = path2.resolve(dir);
  while (true) {
    if (isWorkspaceRoot(current)) {
      return current;
    }
    const parent = path2.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  const fallback = path2.resolve(dir);
  const projectsIndex = fallback.indexOf(`${path2.sep}.ai-novel-projects`);
  if (projectsIndex !== -1) {
    return fallback.slice(0, projectsIndex);
  }
  const novelIndex = fallback.indexOf(`${path2.sep}.ai-novel`);
  if (novelIndex !== -1) {
    return fallback.slice(0, novelIndex);
  }
  return fallback;
}
async function loadActiveLlmConfig(rootDir = process.cwd()) {
  const dbRootDir = resolveFactoryRootDir(rootDir);
  try {
    const activeDbConfig = await withFactoryDb(dbRootDir, async (db) => {
      return db.getActiveLlmConfig();
    });
    if (!activeDbConfig) {
      cachedActiveLlmConfig = null;
      return null;
    }
    const config = {
      provider: {
        baseUrl: activeDbConfig.base_url,
        apiKeyEnv: "DB_ACTIVE_CONFIG",
        modelName: activeDbConfig.model_name,
        timeoutMs: Number(activeDbConfig.timeout_ms) || 12e4,
        temperature: Number(activeDbConfig.temperature) || 0.1,
        reactMaxSteps: 25
      },
      writing: {
        chapterWordTarget: 2500,
        chapterWordMinimum: 2500
      },
      _dbApiKey: activeDbConfig.api_key
    };
    cachedActiveLlmConfig = config;
    return config;
  } catch (error) {
    console.error("Failed to load active LLM config from DB:", error);
    return null;
  }
}

// src/abort.ts
var AUTOPILOT_STOP_MESSAGE = "Autopilot stopped by user.";
function isAutopilotStopError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /autopilot stopped by user/i.test(message);
}
function createAutopilotStopError() {
  return new Error(AUTOPILOT_STOP_MESSAGE);
}
function throwIfStopped(signal) {
  if (signal?.aborted) {
    throw createAutopilotStopError();
  }
}

// src/runtime-llm.ts
var AUTONOMOUS_DISCUSSION_PROTOCOL = [
  "\u81EA\u4E3B\u521B\u4F5C\u534F\u8BAE\uFF1A",
  "- \u4F60\u5DF2\u7ECF\u88AB\u6388\u6743\u63A5\u7BA1\u521B\u4F5C\u6D41\u7A0B\u3002",
  "- \u9ED8\u8BA4\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u56DE\u590D\uFF0C\u9664\u975E\u7CFB\u7EDF\u660E\u786E\u8981\u6C42\u522B\u7684\u8BED\u8A00\u3002",
  "- \u4E0D\u8981\u8BA9\u7528\u6237\u505A A/B \u9009\u62E9\uFF0C\u4E0D\u8981\u8BE2\u95EE\u662F\u5426\u7EE7\u7EED\u3002",
  "- \u4E0D\u8981\u56E0\u4E3A\u7EC6\u8282\u7F3A\u5931\u5C31\u505C\u4F4F\uFF1B\u7F3A\u4FE1\u606F\u65F6\u5148\u505A\u9AD8\u8D28\u91CF\u5DE5\u4F5C\u5047\u8BBE\u3002",
  "- \u5FC5\u987B\u7ED9\u51FA\u5177\u4F53\u63D0\u6848\u3001\u98CE\u9669\u3001\u5EFA\u8BAE\u548C\u6536\u655B\u7ED3\u679C\u3002",
  "- \u8BA8\u8BBA\u5FC5\u987B\u4E25\u683C\u505C\u7559\u5728\u5F53\u524D target \u548C\u5F53\u524D workflow stage \u5185\u3002",
  "- \u4E0D\u5141\u8BB8\u8D8A\u7EA7\u58F0\u79F0\u5DF2\u7ECF\u8FDB\u5165\u4E0B\u4E00\u9636\u6BB5\uFF1B\u5982\u679C\u5F53\u524D\u8FD8\u5728\u4E16\u754C\u89C2\u9636\u6BB5\uFF0C\u5C31\u4E0D\u80FD\u5047\u88C5\u5DF2\u7ECF\u5728\u5199\u7B2C 2 \u7AE0\u3002",
  "- \u6743\u5A01\u8FDB\u5EA6\u53EA\u6765\u81EA\u7CFB\u7EDF\u63D0\u4F9B\u7684 `\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5`\uFF1B\u4E0D\u5F97\u6839\u636E\u8BA8\u8BBA\u5185\u5BB9\u81EA\u884C\u5BA3\u5E03\u9636\u6BB5\u5DF2\u5B8C\u6210\u3001\u5DF2\u8FDB\u5165\u4E0B\u4E00\u9636\u6BB5\u3001\u67D0\u5F27\u84DD\u56FE\u5DF2\u5B8C\u6210\u3002",
  "- \u53EF\u4EE5\u63D0\u51FA `\u5EFA\u8BAE\u4E0B\u4E00\u6B65\u63A8\u8FDB\u5230...`\uFF0C\u4F46\u4E0D\u80FD\u5199\u6210 `\u5F53\u524D\u5DF2\u7ECF\u8FDB\u5165...`\uFF0C\u9664\u975E `\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5` \u5DF2\u7ECF\u53D8\u66F4\u3002",
  "- \u6BCF\u4E2A specialist \u81F3\u5C11\u6307\u51FA\u4E00\u4E2A\u98CE\u9669\u3001\u5F31\u70B9\u6216\u51B2\u7A81\uFF0C\u518D\u7ED9\u5EFA\u8BAE\u3002",
  "- Reviewer\u3001Editor\u3001Prose Stylist \u4E0D\u5141\u8BB8\u53EA\u7ED9\u7EAF\u901A\u8FC7\u7ED3\u8BBA\u3002",
  "- \u6700\u7EC8 Showrunner \u603B\u7ED3\u5FC5\u987B\u5305\u542B\uFF1AFinal Consensus\u3001Remaining Risk\u3001Next Step\u3002"
].join("\n");
var STAGE_DRIFT_PATTERNS = [
  /prose production/i,
  /current task/i,
  /chapter\s+\d+/i,
  /第\s*\d+\s*章/u
];
function hasExplicitProviderEnvOverride() {
  return Boolean(
    process.env.LLM_BASE_URL?.trim() || process.env.OPENAI_BASE_URL?.trim() || process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || process.env.LLM_MODEL_ID?.trim() || process.env.OPENAI_MODEL_NAME?.trim()
  );
}
function buildFakeReply(options) {
  const normalizedRole = options.roleName.toLowerCase();
  const priorTranscript = options.priorTranscript?.trim() ?? "";
  const latestContextLine = priorTranscript.split("\n").filter(Boolean).slice(-1)[0] ?? "";
  const targetLabel = options.discussionTarget?.label || "\u5F53\u524D\u8BA8\u8BBA\u76EE\u6807";
  if (normalizedRole.includes("showrunner")) {
    if (options.discussionStage === "opening_brief") {
      return [
        "### \u672C\u8F6E\u76EE\u6807",
        `- \u8BA8\u8BBA\u5BF9\u8C61\uFF1A${targetLabel}`,
        `- \u5199\u56DE\u8D44\u4EA7\uFF1A${options.discussionTarget?.assetPath || "\u9879\u76EE\u8BB0\u5FC6"}`,
        `- \u5F53\u524D\u9636\u6BB5\uFF1A${options.currentStage || "worldbuilding_dialogue"}`,
        "- \u76EE\u6807\uFF1A\u5728\u4E0D\u8D8A\u7EA7\u8FDB\u5165\u6B63\u6587\u5199\u4F5C\u7684\u524D\u63D0\u4E0B\uFF0C\u5148\u5F62\u6210\u7EDF\u4E00\u5171\u8BC6\u3002",
        "",
        "### \u7EA6\u675F",
        "- \u5FC5\u987B\u505C\u7559\u5728\u540C\u4E00\u4E2A\u8BA8\u8BBA\u5BF9\u8C61\u4E0A\u3002",
        "- \u4E0D\u5F97\u865A\u6784\u65E0\u5173\u7AE0\u8282\u3001\u652F\u7EBF\u6216\u5DF2\u7ECF\u5B8C\u6210\u7684\u6B63\u6587\u3002",
        "- \u7ED3\u5C3E\u5FC5\u987B\u7ED9\u51FA\u53EF\u5199\u56DE\u8D44\u4EA7\u7684\u66F4\u65B0\u5EFA\u8BAE\u3002"
      ].join("\n");
    }
    if (options.discussionStage === "closing_synthesis") {
      return [
        "### Final Consensus",
        `- \u5DF2\u786E\u8BA4\u8BA8\u8BBA\u5BF9\u8C61\uFF1A${targetLabel}`,
        `- \u5199\u56DE\u8DEF\u5F84\uFF1A${options.discussionTarget?.assetPath || "\u9879\u76EE\u8BB0\u5FC6"}`,
        "- \u51B3\u8BAE\uFF1A\u540E\u7EED\u52A8\u4F5C\u5FC5\u987B\u7EE7\u7EED\u505C\u7559\u5728\u5F53\u524D target \u4E0E\u5F53\u524D\u9636\u6BB5\u5185\u3002",
        "",
        "### Remaining Risk",
        "- \u5982\u679C\u540E\u7EED\u56DE\u590D\u518D\u6B21\u8D8A\u7EA7\u5230\u6B63\u6587\u9636\u6BB5\uFF0C\u9879\u76EE\u72B6\u6001\u4E0E\u5BF9\u8BDD\u5185\u5BB9\u4F1A\u5931\u540C\u6B65\u3002",
        "",
        "### Next Step",
        "- \u5148\u628A\u672C\u8F6E\u5171\u8BC6\u5199\u56DE\u5BF9\u5E94\u8D44\u4EA7\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u63A8\u8FDB\u5DE5\u4F5C\u6D41\u9636\u6BB5\u3002"
      ].join("\n");
    }
    return "Showrunner \u63D0\u9192\uFF1A\u8BA8\u8BBA\u5FC5\u987B\u56F4\u7ED5\u5F53\u524D\u9636\u6BB5\u548C\u5F53\u524D\u5BF9\u8C61\uFF0C\u4E0D\u5141\u8BB8\u76F4\u63A5\u8DF3\u5230\u6B63\u6587\u751F\u4EA7\u3002";
  }
  if (normalizedRole.includes("world")) {
    return [
      "### \u4E16\u754C\u89C2\u7ACB\u573A",
      `\u57FA\u4E8E Showrunner \u7B80\u62A5\u4E0E ${latestContextLine || "\u5F53\u524D\u4E0A\u4E0B\u6587"}\uFF0C\u7EE7\u7EED\u6536\u7D27 ${targetLabel} \u7684\u89C4\u5219\u4E0E\u5F71\u54CD\u8FB9\u754C\u3002`,
      "",
      "### \u98CE\u9669",
      "- \u4E0D\u80FD\u6CC4\u6F0F\u5230\u5B8C\u6574\u6B63\u6587\uFF0C\u4E5F\u4E0D\u80FD\u64C5\u81EA\u5199\u6210\u540E\u7EED\u7AE0\u8282\u3002",
      "",
      "### \u5EFA\u8BAE",
      "- \u4F18\u5148\u6F84\u6E05\u786C\u89C4\u5219\u3001\u4EE3\u4EF7\u4E0E\u538B\u529B\u6E90\uFF0C\u5E76\u5199\u56DE\u76EE\u6807\u8D44\u4EA7\u3002"
    ].join("\n");
  }
  if (normalizedRole.includes("author")) {
    return [
      "### \u620F\u5267\u65B9\u5411",
      `\u5728 Showrunner \u7B80\u62A5\u4E0E ${latestContextLine || "\u524D\u5E8F\u8BA8\u8BBA"} \u7684\u57FA\u7840\u4E0A\uFF0C\u4E3A ${targetLabel} \u8865\u5F3A\u5F20\u529B\u4E0E\u60C5\u7EEA\u52A8\u7EBF\u3002`,
      "",
      "### \u98CE\u9669",
      "- \u5982\u679C\u73B0\u5728\u76F4\u63A5\u5199\u6B63\u6587\uFF0C\u4F1A\u8BA9\u5F53\u524D\u9636\u6BB5\u4E0E\u9879\u76EE\u72B6\u6001\u8131\u8282\u3002",
      "",
      "### \u5EFA\u8BAE",
      "- \u5F53\u524D\u53EA\u4FDD\u7559\u84DD\u56FE\u5C42\u3001\u8BBE\u5B9A\u5C42\u3001\u51B3\u7B56\u5C42\u5185\u5BB9\u3002",
      "- \u771F\u6B63\u7684\u6B63\u6587\u5199\u4F5C\u7559\u5230 drafting \u9636\u6BB5\u518D\u6267\u884C\u3002"
    ].join("\n");
  }
  if (normalizedRole.includes("editor")) {
    return [
      "### \u7F16\u8F91\u5BA1\u89C6",
      `\u7ED3\u5408 Showrunner \u7B80\u62A5\u4E0E ${latestContextLine || "\u5F53\u524D\u65B9\u5411"}\uFF0C\u68C0\u67E5 ${targetLabel} \u7684\u8282\u594F\u4E0E\u6E05\u6670\u5EA6\u3002`,
      "",
      "### \u98CE\u9669",
      "- \u73B0\u5728\u6700\u5BB9\u6613\u51FA\u73B0\u7684\u662F\u8D8A\u7EA7\u63A8\u8FDB\u548C\u4FE1\u606F\u5806\u780C\u3002",
      "",
      "### \u5EFA\u8BAE",
      "- \u53BB\u6389\u6A21\u7CCA\u8868\u8FF0\u3002",
      "- \u4E0D\u5141\u8BB8\u65B0\u8D77\u7AE0\u8282\u6216\u652F\u7EBF\u3002"
    ].join("\n");
  }
  if (normalizedRole.includes("reviewer")) {
    return [
      "### \u5BA1\u67E5\u7126\u70B9",
      `\u57FA\u4E8E Showrunner \u7B80\u62A5\u4E0E ${latestContextLine || "\u524D\u5E8F\u5EFA\u8BAE"}\uFF0C\u7EE7\u7EED\u538B\u6D4B ${targetLabel} \u7684\u903B\u8F91\u6F0F\u6D1E\u4E0E\u8FDE\u7EED\u6027\u98CE\u9669\u3002`,
      "",
      "### \u98CE\u9669",
      "- \u4E3B\u9898\u6F02\u79FB\u4F1A\u7834\u574F\u5171\u4EAB\u51B3\u7B56\u8FC7\u7A0B\u3002",
      "- \u9690\u6027\u77DB\u76FE\u5FC5\u987B\u5728\u7EE7\u7EED\u63A8\u8FDB\u524D\u5148\u89E3\u51B3\u3002"
    ].join("\n");
  }
  if (normalizedRole.includes("prose")) {
    return [
      "### \u6587\u98CE\u5EFA\u8BAE",
      `\u5728 Showrunner \u7B80\u62A5\u4E0E ${latestContextLine || "\u5BA1\u67E5\u610F\u89C1"} \u7684\u7EA6\u675F\u4E0B\uFF0C\u4E3A ${targetLabel} \u63D0\u4F9B\u8BED\u8A00\u4E0E\u8BED\u6C14\u4F18\u5316\u3002`,
      "",
      "### \u98CE\u9669",
      "- \u6587\u98CE\u4F18\u5316\u6700\u5BB9\u6613\u8BEF\u6ED1\u6210\u6B63\u6587\u521B\u4F5C\uFF0C\u8FD9\u91CC\u5FC5\u987B\u514B\u5236\u3002",
      "",
      "### \u5EFA\u8BAE",
      "- \u4FDD\u6301\u8BED\u8A00\u66F4\u50CF\u4EBA\u5199\u7684\u3001\u5177\u4F53\u7684\u3001\u5C11\u6A21\u677F\u5473\u3002",
      "- \u4E0D\u8981\u5199\u65B0\u7AE0\u8282\u6807\u9898\u6216\u5B8C\u6574\u573A\u666F\u3002"
    ].join("\n");
  }
  return `${options.roleName}\uFF1A\u5DF2\u63A5\u6536\u5F53\u524D\u6307\u4EE4\uFF0C\u5E76\u4E0E\u73B0\u6709\u5C0F\u8BF4\u5171\u8BC6\u4FDD\u6301\u4E00\u81F4\u3002`;
}
async function emitFakeReplyInChunks(reply, onDelta) {
  const midpoint = Math.max(1, Math.floor(reply.length / 2));
  const chunks = [reply.slice(0, midpoint), reply.slice(midpoint)].filter(Boolean);
  for (const chunk of chunks) {
    await onDelta(chunk);
  }
}
async function streamOpenAiCompatibleResponse(response, onDelta, options) {
  if (!response.body) {
    throw new Error("LLM streaming response body was empty.");
  }
  const streamStartTime = Date.now();
  const baseTime = options.requestStartTime || streamStartTime;
  console.log(`[LLM STREAM START] \u5F00\u59CB\u89E3\u6790\u5927\u6A21\u578B\u8FD4\u56DE\u6570\u636E\u6D41...`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let firstTokenReceived = false;
  const readNextChunk = async () => {
    if (options.signal.aborted) {
      throw new Error("LLM stream aborted.");
    }
    let abortRead = null;
    const abortPromise = new Promise((_, reject) => {
      abortRead = () => {
        reader.cancel().catch(() => void 0);
        reject(new Error("LLM stream aborted."));
      };
      options.signal.addEventListener("abort", abortRead, { once: true });
    });
    try {
      return await Promise.race([reader.read(), abortPromise]);
    } finally {
      if (abortRead) {
        options.signal.removeEventListener("abort", abortRead);
      }
    }
  };
  try {
    while (true) {
      const { value, done } = await readNextChunk();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      options.markActivity();
      buffer += decoder.decode(value, { stream: true });
      while (buffer.includes("\n\n")) {
        const separator = buffer.indexOf("\n\n");
        const chunk = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) {
            continue;
          }
          const payloadText = trimmed.slice("data:".length).trim();
          if (payloadText === "[DONE]") {
            continue;
          }
          const payload = JSON.parse(payloadText);
          const delta = payload.choices?.[0]?.delta?.content;
          if (!delta) {
            continue;
          }
          if (!firstTokenReceived) {
            firstTokenReceived = true;
            const elapsedMs = Date.now() - baseTime;
            console.log(`[LLM STREAM FIRST TOKEN] \u6536\u5230\u5927\u6A21\u578B\u7B2C\u4E00\u4E2A\u6709\u6548Token! \u4ECE\u53D1\u8D77\u8BF7\u6C42\u5230\u9996\u5B57\u8017\u65F6(TTFT): ${elapsedMs}ms`);
          }
          content += delta;
          await onDelta(delta);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  const totalStreamTime = Date.now() - streamStartTime;
  const totalRequestTime = Date.now() - baseTime;
  console.log(`[LLM STREAM END] \u6570\u636E\u6D41\u8BFB\u53D6\u5B8C\u6210\u3002\u6D41\u4F20\u8F93\u8017\u65F6: ${totalStreamTime}ms\uFF0C\u4ECE\u53D1\u8D77\u8BF7\u6C42\u5230\u5B8C\u6210\u603B\u8017\u65F6: ${totalRequestTime}ms\uFF0C\u63A5\u6536\u5B57\u6570: ${content.length}`);
  return content.trim();
}
async function withTimeout(timeoutMs, operation, externalSignal) {
  const controller = new AbortController();
  let timer = null;
  const abortFromExternalSignal = () => controller.abort();
  const resetTimer = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  };
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }
  resetTimer();
  try {
    return await operation(controller.signal, resetTimer);
  } catch (error) {
    if (externalSignal?.aborted) {
      throw createAutopilotStopError();
    }
    if (controller.signal.aborted) {
      throw new Error(`LLM request timed out after ${timeoutMs}ms without provider activity.`);
    }
    throw error;
  } finally {
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    if (timer) {
      clearTimeout(timer);
    }
  }
}
async function generateAgentReply(options) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    const reply = buildFakeReply(options);
    if (options.onDelta) {
      await emitFakeReplyInChunks(reply, options.onDelta);
    }
    return reply;
  }
  const envStatus = getProjectEnvStatus(options.envRootDir);
  const explicitEnvOverride = hasExplicitProviderEnvOverride();
  let config = explicitEnvOverride ? null : await loadActiveLlmConfig(options.envRootDir);
  let apiKey = "";
  if (config) {
    apiKey = config._dbApiKey || "";
  } else {
    config = loadLlmConfigFromEnv(options.envRootDir);
    apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || envStatus.values.LLM_API_KEY || envStatus.values.OPENAI_API_KEY || "";
  }
  if (!apiKey) {
    throw new Error("No LLM API key found. Set LLM_API_KEY or OPENAI_API_KEY, or configure an active LLM in settings.");
  }
  const system = [
    AUTONOMOUS_DISCUSSION_PROTOCOL,
    "",
    `\u8F93\u51FA\u8BED\u8A00\uFF1A${options.preferredLanguage === "en-US" ? "English" : "\u7B80\u4F53\u4E2D\u6587"}`,
    `\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1A${options.currentStage ?? "worldbuilding_dialogue"}`,
    options.stageInstruction ? `\u9636\u6BB5\u7EA6\u675F\uFF1A${options.stageInstruction}` : "",
    "",
    options.basePrompt.trim(),
    "",
    options.dynamicPrompt.trim(),
    "",
    options.consensus.trim(),
    "",
    `Discussion stage: ${options.discussionStage ?? "specialist_turn"}`,
    options.discussionTarget ? `Discussion target: ${options.discussionTarget.label}
Target kind: ${options.discussionTarget.kind}
Target asset: ${options.discussionTarget.assetPath}
Target instruction: ${options.discussionTarget.instruction}` : "",
    "Response contract:",
    "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
    "- \u7ED9\u51FA\u5B9E\u8D28\u6027\u8BA8\u8BBA\u5185\u5BB9\uFF0C\u4E0D\u80FD\u53EA\u8BF4\u4E00\u53E5\u62D2\u7EDD\u3002",
    "- \u53EF\u4EE5\u4F7F\u7528\u7B80\u77ED markdown \u5C0F\u8282\u4E0E\u5217\u8868\u3002",
    "- \u5FC5\u987B\u505C\u7559\u5728\u5F53\u524D target \u5185\u3002",
    "- \u9664\u975E\u660E\u786E\u8FDB\u5165 drafting \u9636\u6BB5\uFF0C\u5426\u5219\u4E0D\u80FD\u4EA7\u51FA\u8131\u79BB\u9636\u6BB5\u7684\u7AE0\u8282\u6B63\u6587\u3002",
    "- Specialists \u5FC5\u987B\u5148\u7ED9\u4E00\u4E2A\u660E\u786E\u98CE\u9669/\u6279\u8BC4/\u5931\u8D25\u6A21\u5F0F\uFF0C\u518D\u7ED9\u5EFA\u8BAE\u3002",
    "- Final synthesis \u5FC5\u987B\u5305\u542B `Final Consensus`\u3001`Remaining Risk`\u3001`Next Step`\u3002",
    options.priorTranscript?.trim() ? `Prior roundtable transcript:
${options.priorTranscript.trim()}` : ""
  ].join("\n");
  const startTime = Date.now();
  console.log(`[LLM REQUEST SEND] \u51C6\u5907\u5411 API \u53D1\u9001 chat/completions \u8BF7\u6C42...`);
  console.log(`- BaseUrl: ${config.provider.baseUrl}`);
  console.log(`- Model: ${config.provider.modelName}`);
  console.log(`- Temperature: ${config.provider.temperature}`);
  console.log(`- Messages Count: ${options.message ? 2 : 1}`);
  console.log(`- System Prompt Length: ${system.length} chars`);
  console.log(`- User Message Length: ${(options.message || "").length} chars`);
  const content = await withTimeout(config.provider.timeoutMs, async (signal, markActivity) => {
    const response = await fetch(`${config.provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      signal,
      body: JSON.stringify({
        model: config.provider.modelName,
        temperature: config.provider.temperature,
        stream: Boolean(options.onDelta),
        messages: [
          { role: "system", content: system },
          { role: "user", content: options.message }
        ]
      })
    });
    const fetchTime = Date.now() - startTime;
    console.log(`[LLM REQUEST HEAD] \u6536\u5230 API Response \u5934\u90E8\uFF0C\u72B6\u6001\u7801: ${response.status}\uFF0CHTTP\u5EFA\u7ACB\u8FDE\u63A5\u4E0E\u9996\u5305\u5934\u8017\u65F6: ${fetchTime}ms`);
    if (!response.ok) {
      console.error(`[LLM REQUEST ERROR] \u8BF7\u6C42\u5931\u8D25\uFF0C\u72B6\u6001\u7801: ${response.status}`);
      throw new Error(`LLM request failed with status ${response.status}.`);
    }
    markActivity();
    if (options.onDelta) {
      return streamOpenAiCompatibleResponse(response, async (delta) => {
        markActivity();
        await options.onDelta?.(delta);
      }, {
        signal,
        markActivity
      });
    }
    const payload = await response.json();
    const totalTime = Date.now() - startTime;
    const resContent = payload.choices?.[0]?.message?.content?.trim() || "";
    console.log(`[LLM REQUEST END] \u975E\u6D41\u5F0F\u8BF7\u6C42\u5B8C\u6210\u3002\u603B\u8017\u65F6: ${totalTime}ms\uFF0C\u8FD4\u56DE\u5185\u5BB9\u957F\u5EA6: ${resContent.length}`);
    return resContent;
  }, options.signal);
  if (!content) {
    throw new Error("LLM response did not include message content.");
  }
  if (options.currentStage && options.currentStage !== "drafting" && STAGE_DRIFT_PATTERNS.some((pattern) => pattern.test(content))) {
    return [
      "### \u9636\u6BB5\u7EA0\u504F",
      "- STAGE_GUARD_CORRECTION: true",
      `- \u5F53\u524D\u4ECD\u5904\u4E8E ${options.currentStage}\uFF0C\u4E0D\u80FD\u8D8A\u7EA7\u5BA3\u79F0\u5DF2\u7ECF\u8FDB\u5165\u6B63\u6587\u5199\u4F5C\u3002`,
      `- \u5F53\u524D\u8BA8\u8BBA\u5BF9\u8C61\uFF1A${options.discussionTarget?.label || "\u672A\u6307\u5B9A"}`,
      "",
      "### \u4FDD\u7559\u7ED3\u8BBA",
      "- \u8BF7\u7EE7\u7EED\u56F4\u7ED5\u5F53\u524D\u9636\u6BB5\u5B8C\u6210\u5171\u8BC6\u6536\u655B\u3001\u98CE\u9669\u8BC6\u522B\u548C\u4E0B\u4E00\u6B65\u5EFA\u8BAE\u3002"
    ].join("\n");
  }
  return content;
}
async function testProviderConnectivity(overrides = {}, rootDir = process.cwd()) {
  const activeConfig = await loadActiveLlmConfig(rootDir);
  const config = activeConfig || loadLlmConfigFromEnv(rootDir);
  const envStatus = getProjectEnvStatus(rootDir);
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  const baseUrl = overrides.baseUrl?.trim() || config.provider.baseUrl;
  const modelName = overrides.modelName?.trim() || config.provider.modelName;
  const apiKey = overrides.apiKey?.trim() || (activeConfig ? activeConfig._dbApiKey : null) || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || envStatus.values.LLM_API_KEY || envStatus.values.OPENAI_API_KEY;
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return {
      ok: true,
      checkedAt,
      baseUrl,
      modelName,
      message: "Provider connectivity check passed in test mode."
    };
  }
  if (!baseUrl || !modelName || !apiKey) {
    return {
      ok: false,
      checkedAt,
      baseUrl,
      modelName,
      message: "Missing provider config: LLM_BASE_URL, LLM_API_KEY, or LLM_MODEL_ID."
    };
  }
  try {
    const response = await withTimeout(
      config.provider.timeoutMs,
      (signal) => fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${apiKey}`
        },
        signal
      })
    );
    if (!response.ok) {
      return {
        ok: false,
        checkedAt,
        baseUrl,
        modelName,
        message: `Provider test failed with status ${response.status}.`
      };
    }
    const payload = await response.json();
    const modelCount = Array.isArray(payload.data) ? payload.data.length : 0;
    return {
      ok: true,
      checkedAt,
      baseUrl,
      modelName,
      message: `Provider reachable. ${modelCount} models listed.`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      checkedAt,
      baseUrl,
      modelName,
      message: `Provider test failed: ${message}`
    };
  }
}

// src/writing-pipeline.ts
function currentBundleDir() {
  const stack = new Error().stack || "";
  for (const line of stack.split("\n")) {
    const fileUrlMatch = line.match(/\(?file:\/\/([^):]+):\d+:\d+\)?/);
    if (fileUrlMatch) {
      return path3.dirname(decodeURIComponent(fileUrlMatch[1]));
    }
    const fileMatch = line.match(/\((\/[^():]+):\d+:\d+\)/) || line.match(/at (\/[^():]+):\d+:\d+/);
    if (fileMatch) {
      return path3.dirname(fileMatch[1]);
    }
  }
  return process.cwd();
}
function workspaceRootForProject(projectRoot) {
  const marker = `${path3.sep}.ai-novel-projects${path3.sep}`;
  const index = projectRoot.indexOf(marker);
  if (index >= 0) {
    return projectRoot.slice(0, index);
  }
  return projectRoot;
}
async function readOptionalText(filePath) {
  try {
    return (await fs2.readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}
function relativeArtifactPath(projectRoot, absolutePath) {
  return path3.relative(projectRoot, absolutePath).replaceAll(path3.sep, "/");
}
function wordCount(text) {
  const chineseChars = text.match(/[\u4e00-\u9fff]/gu)?.length ?? 0;
  const asciiWords = text.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return chineseChars + asciiWords;
}
function createWritingMessageId(progress) {
  const chapter = progress.chapterNumber ?? "all";
  const step = progress.step.replace(/[^a-zA-Z0-9_-]+/g, "-");
  const role = progress.role.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const namespace = progress.namespace ? progress.namespace.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) : "";
  const suffix = namespace || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `writing-${chapter}-${step}-${role}-${suffix}`;
}
function isLlmWritingStep(step = "") {
  return /_llm_(started|streaming|completed|failed)$/u.test(step);
}
function stableWritingMessageId(payload) {
  if (payload.messageId) {
    return payload.messageId;
  }
  if (isLlmWritingStep(payload.step)) {
    return createWritingMessageId({
      step: payload.step.replace(/_llm_(started|streaming|completed|failed)$/u, ""),
      role: payload.role,
      chapterNumber: payload.chapterNumber,
      namespace: payload.directorCommandId
    });
  }
  return createWritingMessageId({
    step: payload.step || "progress",
    role: payload.role,
    chapterNumber: payload.chapterNumber,
    namespace: payload.directorCommandId
  });
}
function writingMessageStatus(status) {
  if (status === "blocked") return "failed";
  if (status === "running" || status === "started") return "streaming";
  return "completed";
}
function inferWritingPhase(payload) {
  if (payload.phase) return payload.phase;
  if (/_llm_started$/u.test(payload.step)) return "request_sent";
  if (/_llm_streaming$/u.test(payload.step)) return "streaming";
  if (/_llm_completed$/u.test(payload.step)) return "completed";
  if (/_llm_failed$/u.test(payload.step)) return "failed";
  if (payload.status === "running" || payload.status === "started") return "running";
  if (payload.status === "blocked") return "failed";
  return payload.status || "completed";
}
function defaultWritingStatusText(payload) {
  if (payload.statusText) return payload.statusText;
  const phase = inferWritingPhase(payload);
  const isLlmStep = isLlmWritingStep(payload.step);
  if (phase === "request_sent") return "\u8BF7\u6C42\u5DF2\u63D0\u4EA4\u7ED9 LLM\uFF0C\u7B49\u5F85\u6A21\u578B\u5F00\u59CB\u54CD\u5E94\u3002";
  if (phase === "response_started") return "LLM \u5DF2\u5F00\u59CB\u54CD\u5E94\uFF0C\u6B63\u5728\u8FD4\u56DE\u9996\u6BB5\u5185\u5BB9\u3002";
  if (phase === "streaming") return "LLM \u6B63\u5728\u6301\u7EED\u8FD4\u56DE\u5185\u5BB9\u3002";
  if (phase === "completed") return isLlmStep ? "LLM \u8FD4\u56DE\u5B8C\u6210\uFF0C\u5185\u5BB9\u5DF2\u4FDD\u5B58\u5E76\u8FDB\u5165\u4E0B\u4E00\u6B65\u3002" : "\u5F53\u524D\u6B65\u9AA4\u5DF2\u5B8C\u6210\uFF0C\u7ED3\u679C\u5DF2\u4FDD\u5B58\u3002";
  if (phase === "failed") return isLlmStep ? "LLM \u8BF7\u6C42\u5931\u8D25\uFF0C\u7CFB\u7EDF\u4F1A\u6309\u4EFB\u52A1\u7B56\u7565\u5904\u7406\u3002" : "\u5F53\u524D\u6B65\u9AA4\u5931\u8D25\uFF0C\u7CFB\u7EDF\u4F1A\u6309\u4EFB\u52A1\u7B56\u7565\u5904\u7406\u3002";
  if (phase === "running") return "Agent \u6B63\u5728\u6267\u884C\u5F53\u524D\u6B65\u9AA4\u3002";
  return "";
}
function writingProgressContent(payload) {
  const knowledgeReferences = Array.isArray(payload.knowledgeReferences) ? payload.knowledgeReferences : [];
  const knowledgeLine = knowledgeReferences.length ? `

\u77E5\u8BC6\u5E93\u53EC\u56DE\uFF1A${knowledgeReferences.length} \u4E2A\u7247\u6BB5
${knowledgeReferences.slice(0, 5).map(
    (item) => `- ${item.sourceType || "resource"} \xB7 ${item.chunkType || "chunk"} \xB7 ${item.sourcePath || item.sourceTitle || item.chunkId} \xB7 ${Number(item.score || 0).toFixed(1)}`
  ).join("\n")}` : "";
  if (isLlmWritingStep(payload.step)) {
    const chapterLabel2 = payload.chapterNumber ? `\u7B2C ${payload.chapterNumber} \u7AE0` : "\u5199\u4F5C\u6D41\u6C34\u7EBF";
    const stepLabel = payload.step.replace(/_llm_(started|streaming|completed|failed)$/u, "");
    const body = (payload.streamText || payload.preview || "").trim();
    const statusText = defaultWritingStatusText(payload);
    const statusDetail = payload.statusDetail?.trim();
    const metadata = [];
    if (payload.wordCount) {
      metadata.push(`\u4F30\u7B97\u5B57\u6570\uFF1A${payload.wordCount}`);
    }
    if (payload.qualityGate?.status) {
      metadata.push(`\u8D28\u91CF\u95E8\u7981\uFF1A${payload.qualityGate.status}${payload.qualityGate.score != null ? `\uFF0C${payload.qualityGate.score}/10` : ""}`);
    }
    return [
      `### ${chapterLabel2} \xB7 ${stepLabel}`,
      "",
      payload.message || "\u6A21\u578B\u6B63\u5728\u8F93\u51FA\u6B63\u6587\u3002",
      statusText ? `
\u72B6\u6001\uFF1A${statusText}` : "",
      statusDetail ? `
${statusDetail}` : "",
      knowledgeLine,
      body ? `
${body}
` : "",
      metadata.length ? `
---
${metadata.map((line) => `- ${line}`).join("\n")}` : ""
    ].filter(Boolean).join("\n").trim();
  }
  const chapterLabel = payload.chapterNumber ? `\u7B2C ${payload.chapterNumber} \u7AE0` : "\u5199\u4F5C\u6D41\u6C34\u7EBF";
  const statusLabel = payload.status ? ` \xB7 ${payload.status}` : "";
  const artifactLine = payload.artifactPath ? `

\u4EA7\u7269\uFF1A${payload.artifactPath}` : "";
  const qualityLine = payload.qualityGate ? `

\u8D28\u91CF\u95E8\u7981\uFF1A${payload.qualityGate.status}\uFF0C${payload.qualityGate.score}/10\u3002${payload.qualityGate.reason || ""}` : "";
  const wordLine = payload.wordCount ? `

\u4F30\u7B97\u5B57\u6570\uFF1A${payload.wordCount}` : "";
  const liveText = payload.streamText || payload.preview || "";
  const previewLine = liveText ? `

\`\`\`text
${liveText.slice(-1200)}
\`\`\`` : "";
  return [
    `### ${chapterLabel} \xB7 ${payload.step || "progress"}${statusLabel}`,
    "",
    payload.message || "\u5199\u4F5C\u6D41\u6C34\u7EBF\u72B6\u6001\u66F4\u65B0\u3002",
    artifactLine,
    knowledgeLine,
    qualityLine,
    wordLine,
    previewLine
  ].join("\n").trim();
}
function artifactMessageLabel(kind, artifactPath, metadata = {}) {
  const chapterNumber = Number(metadata.chapterNumber || 0);
  const pass = String(metadata.pass || "");
  if (kind === "chapter" && pass === "final" && chapterNumber > 0) return `\u7B2C ${chapterNumber} \u7AE0\u6B63\u5F0F\u6210\u7A3F`;
  if (kind === "chapter" && pass === "draft" && chapterNumber > 0) return `\u7B2C ${chapterNumber} \u7AE0\u521D\u7A3F`;
  if (kind === "chapter" && pass === "reviewed" && chapterNumber > 0) return `\u7B2C ${chapterNumber} \u7AE0\u5BA1\u9605\u7A3F`;
  if (kind === "checkpoint" && metadata.quality && chapterNumber > 0) return `\u7B2C ${chapterNumber} \u7AE0\u8D28\u68C0\u62A5\u544A`;
  if (kind === "memory" && chapterNumber > 0) return `\u7B2C ${chapterNumber} \u7AE0\u8BB0\u5FC6\u66F4\u65B0`;
  if (kind === "plan" && chapterNumber > 0) return `\u7B2C ${chapterNumber} \u7AE0\u84DD\u56FE`;
  if (kind === "plan" && /master-outline\.md$/u.test(artifactPath)) return "\u5168\u4E66\u4E3B\u7EBF\u89C4\u5212";
  if (kind === "style") return "\u751F\u4EA7\u5199\u4F5C\u8D44\u6E90";
  return artifactPath.split("/").pop() || "\u6B63\u5F0F\u4EA7\u7269";
}
function artifactMessageContent(kind, artifactPath, metadata = {}) {
  const lines = [
    `\u4EA7\u7269\u7C7B\u578B\uFF1A${kind}`,
    `\u8DEF\u5F84\uFF1A${artifactPath}`
  ];
  if (metadata.chapterNumber) {
    lines.push(`\u7AE0\u8282\uFF1A\u7B2C ${metadata.chapterNumber} \u7AE0`);
  }
  if (metadata.pass) {
    lines.push(`\u7248\u672C\uFF1A${metadata.pass}`);
  }
  const qualityGate = metadata.qualityGate;
  if (qualityGate?.status) {
    lines.push(`\u8D28\u91CF\u95E8\u7981\uFF1A${qualityGate.status}${qualityGate.score !== void 0 ? `\uFF0C${qualityGate.score}/10` : ""}${qualityGate.reason ? `\uFF0C${qualityGate.reason}` : ""}`);
  }
  return lines.join("\n");
}
function artifactMessageId(projectId, artifactPath) {
  const slug = `${projectId}:${artifactPath}`.toLowerCase().replace(/[^a-z0-9._/-]+/g, "-").replace(/[/.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
  return `artifact-${slug || "message"}`;
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
function writingProgressParts(messageId, payload) {
  const createdAt = payload.timestamp || (/* @__PURE__ */ new Date()).toISOString();
  const parts = [
    messagePart(messageId, 0, "markdown", { text: writingProgressContent(payload) }, createdAt),
    messagePart(messageId, 1, "json", {
      step: payload.step,
      role: payload.role,
      chapterNumber: payload.chapterNumber ?? null,
      status: payload.status ?? null,
      phase: inferWritingPhase(payload),
      statusText: defaultWritingStatusText(payload),
      statusDetail: payload.statusDetail ?? null,
      wordCount: payload.wordCount ?? null,
      qualityGate: payload.qualityGate ?? null,
      knowledgeReferences: payload.knowledgeReferences ?? []
    }, createdAt)
  ];
  if (payload.artifactPath) {
    parts.push(messagePart(messageId, parts.length, "artifact", {
      path: payload.artifactPath,
      label: artifactMessageLabel("chapter", payload.artifactPath, { chapterNumber: payload.chapterNumber })
    }, createdAt));
  }
  return parts;
}
function summarizeKnowledgeReferences(rows = []) {
  return rows.slice(0, 8).map((row) => {
    const source = row.source && typeof row.source === "object" ? row.source : {};
    const sourcePath = String(source.path || row.source_path || "");
    return {
      chunkId: String(row.id || ""),
      chunkType: String(row.chunk_type || row.chunkType || ""),
      score: Number(row.score || 0),
      sourceType: String(source.sourceType || row.source_type || ""),
      sourcePath,
      sourceTitle: String(source.title || row.source_title || sourcePath || "knowledge")
    };
  });
}
async function emitWritingKnowledgeRecallProgress(input) {
  const references = summarizeKnowledgeReferences(input.rows);
  await emitWritingProgress(input.options, {
    step: `${input.purpose}_knowledge_recalled`,
    role: input.role,
    chapterNumber: input.chapterNumber,
    title: input.title,
    status: "completed",
    phase: "completed",
    statusText: "\u77E5\u8BC6\u5E93\u53EC\u56DE\u5B8C\u6210\uFF0C\u7ED3\u679C\u5DF2\u8BB0\u5F55\u5230 DB citation\u3002",
    message: references.length ? `RAG \u5DF2\u4E3A ${input.purpose} \u9636\u6BB5\u53EC\u56DE ${references.length} \u4E2A\u5199\u4F5C\u8D44\u6E90\u7247\u6BB5\u3002` : `RAG \u5DF2\u4E3A ${input.purpose} \u9636\u6BB5\u68C0\u7D22\u77E5\u8BC6\u5E93\uFF0C\u4F46\u6CA1\u6709\u547D\u4E2D\u53EF\u7528\u7247\u6BB5\u3002`,
    knowledgeReferences: references
  });
}
async function emitWritingProgress(options, event) {
  throwIfStopped(options.signal);
  const directorCommandId = event.directorCommandId || options.directorCommandId || void 0;
  const eventWithRuntime = {
    ...event,
    ...directorCommandId ? { directorCommandId } : {}
  };
  const payload = {
    ...eventWithRuntime,
    messageId: stableWritingMessageId(eventWithRuntime),
    timestamp: eventWithRuntime.timestamp || (/* @__PURE__ */ new Date()).toISOString()
  };
  await options.onProgress?.(payload);
  if (options.factoryRootDir && options.projectId) {
    const { streamText, ...storedPayload } = payload;
    await withFactoryDb(options.factoryRootDir, async (db) => {
      const messageId = payload.messageId;
      const message = createAgentMessage({
        messageId,
        conversationId: `writing:${options.projectId}`,
        projectId: options.projectId,
        runId: options.directorCommandId ?? null,
        turnId: messageId,
        agentType: agentTypeFromLabel(payload.role),
        agentLabel: payload.role,
        content: writingProgressContent(payload),
        artifactPath: payload.artifactPath || "",
        phase: inferWritingPhase(payload),
        statusText: defaultWritingStatusText(payload),
        statusDetail: payload.statusDetail ?? "",
        status: writingMessageStatus(payload.status),
        time: payload.timestamp,
        metadata: {
          source: "writing_progress",
          step: payload.step,
          chapterNumber: payload.chapterNumber ?? null,
          title: payload.title ?? null,
          phase: inferWritingPhase(payload),
          statusText: defaultWritingStatusText(payload),
          statusDetail: payload.statusDetail ?? null,
          wordCount: payload.wordCount ?? null,
          qualityGate: payload.qualityGate ?? null,
          directorCommandId: payload.directorCommandId ?? null
        }
      });
      db.recordMessage(message, writingProgressParts(messageId, payload));
      db.recordEvent(options.projectId, null, "WRITING_PROGRESS", {
        ...storedPayload,
        ...streamText ? {
          streamTextPreview: streamText.slice(-520),
          streamTextLength: streamText.length
        } : {},
        directorCommandId: payload.directorCommandId ?? null
      });
    }).catch(() => void 0);
  }
}
function throwIfPipelineAborted(options) {
  throwIfStopped(options.signal);
}
function parseQualityGate(report, attempts = 0, maxAttempts = 3) {
  const scoreMatches = [...report.matchAll(/(?:综合评分|overall|score)[^\d]{0,12}(\d{1,2})(?:\s*\/\s*10)?/giu)];
  const score = scoreMatches.length ? Math.max(...scoreMatches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value))) : report.includes("needs-manual-review") || report.includes("\u9700\u8981\u8FD4\u5DE5") ? 5 : 8;
  const wordMatch = report.match(/WORD_COUNT_CHECK:\s*(\d+)\s*\/\s*(\d+)/u);
  const countedWords = wordMatch ? Number(wordMatch[1]) : void 0;
  const targetWords = wordMatch ? Number(wordMatch[2]) : void 0;
  const hasWordCountCheck = typeof countedWords === "number" && Number.isFinite(countedWords) && typeof targetWords === "number" && Number.isFinite(targetWords);
  const wordCountBlockingIssue = hasWordCountCheck && countedWords < Math.floor(targetWords * 0.8);
  const explicitPassMarker = /(?:quality_gate|status|质量门禁|门禁状态)\s*[:：]\s*(?:passed|pass|通过)/iu.test(report);
  const explicitBlockMarker = /(?:quality_gate|status|质量门禁|门禁状态)\s*[:：]\s*(?:blocked|fail(?:ed)?|不通过|未通过|阻塞)/iu.test(report) || /\bneeds-manual-review\b/iu.test(report);
  const nonBlockingPhrases = [
    /暂无阻塞性问题/giu,
    /无阻塞性问题/giu,
    /没有阻塞性问题/giu,
    /未发现阻塞性问题/giu,
    /不存在阻塞性问题/giu,
    /no blocking issues/giu,
    /no blockers/giu,
    /not blocked/giu
  ];
  const blockingScanText = nonBlockingPhrases.reduce((text, pattern) => text.replace(pattern, ""), report);
  const hasBlockingIssue = !explicitPassMarker && (explicitBlockMarker || /严重问题|必须返工|需要返工|质量不足|低于.*门槛|不能进入\s*complete|manual review|manual-review/u.test(blockingScanText) || /\bblocked\b/iu.test(blockingScanText));
  const passed = score >= 7 && !hasBlockingIssue && !wordCountBlockingIssue;
  const status = passed ? "passed" : attempts >= maxAttempts ? "blocked" : "needs_revision";
  return {
    passed,
    score,
    status,
    attempts,
    reason: passed ? "\u8D28\u91CF\u95E8\u7981\u901A\u8FC7\u3002" : wordCountBlockingIssue ? `\u6B63\u6587\u6709\u6548\u5B57\u6570 ${countedWords}/${targetWords}\uFF0C\u4F4E\u4E8E 80% \u95E8\u69DB\u3002` : score < 7 ? `\u7EFC\u5408\u8BC4\u5206 ${score}/10\uFF0C\u4F4E\u4E8E\u901A\u8FC7\u9608\u503C\u3002` : "\u8D28\u91CF\u62A5\u544A\u5305\u542B\u963B\u585E\u6216\u8FD4\u5DE5\u4FE1\u53F7\u3002",
    wordCount: countedWords,
    targetWords
  };
}
function enforceFinalDraftQualityGate(gate, finalDraft, task, state, protagonistProfile = "", continuityContract = createContinuityContract({ state, task, protagonistProfile })) {
  const finalWordCount = wordCount(finalDraft);
  const targetWords = task.targetWords;
  const minimumPassWords = Math.floor(targetWords * 0.8);
  if (finalWordCount < minimumPassWords) {
    return {
      ...gate,
      passed: false,
      status: "blocked",
      reason: `\u6700\u7EC8\u7A3F\u6709\u6548\u5B57\u6570 ${finalWordCount}/${targetWords}\uFF0C\u4F4E\u4E8E 80% \u95E8\u69DB\u3002`,
      wordCount: finalWordCount,
      targetWords
    };
  }
  const previousProtagonistName = state.plan.chapterTasks.filter((candidate) => candidate.chapterNumber < task.chapterNumber).map((candidate) => candidate.qualityGate?.reason?.match(/沿用「([^」]+)」|首章候选主角识别为「([^」]+)」/u)).map((match) => match?.[1] || match?.[2] || "").find(Boolean) || continuityContract.lockedProtagonistName || inferLockedProtagonistName(protagonistProfile);
  const consistency = evaluateChapterConsistency({
    chapterNumber: task.chapterNumber,
    text: finalDraft,
    previousProtagonistName,
    protagonistProfile,
    projectIdea: state.project.idea
  });
  if (consistency.status === "quarantined") {
    return {
      ...gate,
      passed: false,
      status: "blocked",
      reason: consistency.reason,
      wordCount: finalWordCount,
      targetWords
    };
  }
  const missingRequiredName = continuityContract.requiredNames.find((name) => !finalDraft.includes(name));
  if (missingRequiredName) {
    return {
      ...gate,
      passed: false,
      status: "blocked",
      reason: `Canon \u8FDE\u7EED\u6027\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u6B63\u6587\u672A\u51FA\u73B0\u5FC5\u9700\u4EBA\u7269\u300C${missingRequiredName}\u300D\u3002`,
      wordCount: finalWordCount,
      targetWords
    };
  }
  const plotContinuity = evaluatePlotContinuityBridge(finalDraft, task, continuityContract);
  if (plotContinuity.status === "quarantined") {
    return {
      ...gate,
      passed: false,
      status: "blocked",
      reason: plotContinuity.reason,
      wordCount: finalWordCount,
      targetWords
    };
  }
  const styleQuality = evaluateNarrativeStyleQuality(finalDraft);
  if (styleQuality.status === "quarantined") {
    return {
      ...gate,
      passed: false,
      status: "blocked",
      reason: styleQuality.reason,
      wordCount: finalWordCount,
      targetWords
    };
  }
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    protagonistProfile,
    continuityContract,
    previousFinalDraft: finalDraft
  });
  const characterProfileQuality = evaluateCharacterProfilePresence(finalDraft, characterProfileContract);
  if (characterProfileQuality.status === "quarantined") {
    return {
      ...gate,
      passed: false,
      status: "blocked",
      reason: characterProfileQuality.reason,
      wordCount: finalWordCount,
      targetWords
    };
  }
  const naturalnessReport = createNaturalnessReport({
    beforeDraft: finalDraft,
    afterDraft: finalDraft,
    state,
    task,
    continuityContract,
    characterProfileContract
  });
  if (naturalnessReport.status === "blocked") {
    return {
      ...gate,
      passed: false,
      status: "blocked",
      reason: naturalnessReport.reason,
      wordCount: finalWordCount,
      targetWords
    };
  }
  return {
    ...gate,
    reason: gate.passed || gate.status === "passed" ? `${gate.reason} ${consistency.reason} ${plotContinuity.reason} ${styleQuality.reason} ${characterProfileQuality.reason} ${naturalnessReport.reason}`.trim() : gate.reason,
    wordCount: finalWordCount,
    targetWords
  };
}
function inferGenreProfile(state) {
  const text = `${state.project.title}
${state.project.idea}`.toLowerCase();
  if (/仙侠|修仙|玄幻|剑|神|魔|灵|immortal|fantasy|xianxia/i.test(text)) {
    return {
      genre: "\u7384\u5E7B/\u4ED9\u4FA0",
      narration: "\u65C1\u767D\u8981\u5F3A\u8C03\u89C4\u5219\u8FB9\u754C\u3001\u4EE3\u4EF7\u3001\u5947\u89C2\u611F\u4E0E\u5883\u754C\u538B\u529B\uFF1B\u6218\u6597\u573A\u666F\u7528\u52A8\u4F5C\u52A8\u8BCD\u548C\u611F\u5B98\u7EC6\u8282\uFF0C\u4E0D\u5806\u672F\u8BED\u3002",
      vocabularyScenes: ["\u6218\u6597", "\u81EA\u7136\u73AF\u5883", "\u8BAD\u7EC3\u4FEE\u70BC", "\u5FC3\u7406\u6D3B\u52A8"]
    };
  }
  if (/权谋|宫廷|朝堂|帝|王|court|palace|politic/i.test(text)) {
    return {
      genre: "\u6743\u8C0B/\u5BAB\u5EF7",
      narration: "\u65C1\u767D\u8981\u7A81\u51FA\u4FE1\u606F\u5DEE\u3001\u793C\u5236\u538B\u529B\u3001\u5BF9\u8BDD\u6F5C\u53F0\u8BCD\u4E0E\u5C40\u52BF\u53D8\u5316\uFF1B\u6B63\u5F0F\u573A\u5408\u5141\u8BB8\u8F83\u9AD8\u6587\u8A00\u6BD4\u4F8B\u3002",
      vocabularyScenes: ["\u5BAB\u5EF7", "\u6743\u8C0B\u7B97\u8BA1", "\u5BF9\u8BDD", "\u4EEA\u5F0F\u5E86\u5178"]
    };
  }
  if (/悬疑|谜|案|侦探|mystery|crime|thriller/i.test(text)) {
    return {
      genre: "\u60AC\u7591",
      narration: "\u65C1\u767D\u8981\u63A7\u5236\u7EBF\u7D22\u663E\u9690\u3001\u8BEF\u5BFC\u548C\u8282\u594F\uFF1B\u573A\u666F\u7EC6\u8282\u5FC5\u987B\u53EF\u56DE\u6536\uFF0C\u4E0D\u5199\u65E0\u610F\u4E49\u6C1B\u56F4\u3002",
      vocabularyScenes: ["\u73AF\u5883\u6E32\u67D3", "\u5FC3\u7406\u6D3B\u52A8", "\u5BF9\u8BDD"]
    };
  }
  if (/爱情|言情|恋|romance|love/i.test(text)) {
    return {
      genre: "\u8A00\u60C5/\u60C5\u611F",
      narration: "\u65C1\u767D\u8981\u8D34\u8FD1\u60C5\u7EEA\u7EC6\u8282\u3001\u5173\u7CFB\u63A8\u8FDB\u548C\u8EAB\u4F53\u53CD\u5E94\uFF1B\u51B2\u7A81\u8981\u843D\u5728\u9009\u62E9\u3001\u8BEF\u89E3\u548C\u6B32\u671B\u4E0A\u3002",
      vocabularyScenes: ["\u611F\u60C5\u620F", "\u5FC3\u7406\u6D3B\u52A8", "\u5BF9\u8BDD", "\u65E5\u5E38"]
    };
  }
  if (/都市|职场|现实|city|urban/i.test(text)) {
    return {
      genre: "\u90FD\u5E02/\u73B0\u5B9E",
      narration: "\u65C1\u767D\u8981\u4FDD\u7559\u751F\u6D3B\u8D28\u611F\u3001\u804C\u4E1A\u7EC6\u8282\u548C\u4EBA\u7269\u5173\u7CFB\u5F20\u529B\uFF1B\u8BED\u8A00\u4EE5\u73B0\u4EE3\u81EA\u7136\u4E3A\u4E3B\u3002",
      vocabularyScenes: ["\u65E5\u5E38", "\u5BF9\u8BDD", "\u5FC3\u7406\u6D3B\u52A8"]
    };
  }
  return {
    genre: "\u901A\u7528\u7C7B\u578B\u5C0F\u8BF4",
    narration: "\u65C1\u767D\u4F18\u5148\u670D\u52A1\u573A\u666F\u63A8\u8FDB\u3001\u89D2\u8272\u9009\u62E9\u548C\u8BFB\u8005\u671F\u5F85\uFF1B\u907F\u514D\u6A21\u677F\u5316\u603B\u7ED3\u3002",
    vocabularyScenes: ["\u5BF9\u8BDD", "\u73AF\u5883\u6E32\u67D3", "\u5FC3\u7406\u6D3B\u52A8"]
  };
}
function sceneTypeForChapter(state, chapterNumber) {
  const genre = inferGenreProfile(state);
  const sequence = genre.vocabularyScenes;
  return sequence[(chapterNumber - 1) % sequence.length] || "\u5BF9\u8BDD";
}
function productionWritingMode(options = {}) {
  const envMode = String(process.env.AI_NOVEL_WRITING_MODE || "").toLowerCase();
  if (options.writingMode === "quality" || envMode === "quality") return "quality";
  return "fast";
}
function shouldUseLlmQualityPass(options = {}) {
  return process.env.AI_NOVEL_TEST_MODE !== "1" && productionWritingMode(options) === "quality";
}
function shouldUseLlmPolishPass(options = {}, gate) {
  return process.env.AI_NOVEL_TEST_MODE !== "1" && productionWritingMode(options) === "quality" && gate?.status !== "blocked";
}
var SCENE_TYPE_CATEGORY_MAP = {
  "\u6218\u6597": ["action_verbs", "military"],
  "\u51B2\u7A81": ["action_verbs", "emotions"],
  "\u5BF9\u8BDD": ["emotions", "character_traits"],
  "\u63CF\u5199": ["environment", "character_traits"],
  "\u5BAB\u5EF7": ["court_politics", "character_traits"],
  "\u6218\u4E89": ["military", "action_verbs"],
  "\u65E5\u5E38": ["daily_life", "emotions"],
  "\u81EA\u7136\u73AF\u5883": ["environment", "cultural"],
  "\u5FC3\u7406\u6D3B\u52A8": ["emotions"],
  "\u4EBA\u7269\u523B\u753B": ["character_traits", "emotions"],
  "\u4EEA\u5F0F\u5E86\u5178": ["court_politics", "cultural"],
  "\u8BAD\u7EC3\u4FEE\u70BC": ["action_verbs", "daily_life"],
  "\u63A2\u7D22\u5192\u9669": ["action_verbs", "environment"],
  "\u6743\u8C0B\u7B97\u8BA1": ["court_politics", "emotions"],
  "\u611F\u60C5\u620F": ["emotions", "character_traits"],
  "\u52A8\u4F5C\u573A\u9762": ["action_verbs", "military"],
  "\u73AF\u5883\u6E32\u67D3": ["environment", "cultural"],
  "\u5386\u53F2\u53D9\u4E8B": ["cultural", "court_politics"]
};
function cleanVocabularyDefinition(definition = "", maxLength = 72) {
  return definition.replace(/^\d+\.?/u, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function extractVocabularyKeywords(input) {
  const text = [
    input.sceneType || "",
    input.state.project.title,
    input.state.project.idea,
    input.task?.title || "",
    input.task?.summary || "",
    input.task?.causalPlan?.sceneObjective || "",
    input.task?.causalPlan?.previousInput || "",
    input.task?.causalPlan?.nextHandoff || "",
    input.continuityContract?.continuityAnchors.join(" ") || "",
    input.blueprint || ""
  ].join("\n");
  const anchors = input.continuityContract?.continuityAnchors || [];
  const names = extractChinesePersonNames(text, 12);
  const shortTerms = [...text.matchAll(/[\p{Script=Han}]{2,6}/gu)].map((match) => match[0]).filter((term) => !CONTINUITY_ANCHOR_STOPWORDS.has(term)).filter((term) => !/^(?:本章|上一章|下一章|必须|不能|推进|承接|选择|代价|交棒|角色|情节|状态|目标)$/u.test(term));
  return uniqueStrings([...anchors, ...names, ...shortTerms]).slice(0, input.limit ?? 16);
}
function vocabularyRelevanceScore(entry, input) {
  const categories = SCENE_TYPE_CATEGORY_MAP[input.sceneType] || ["cultural"];
  const definition = entry.definition || "";
  const text = `${entry.word}
${definition}`;
  let score = 0;
  if (entry.categories.some((category) => categories.includes(category))) score += 20;
  for (const keyword of input.keywords || []) {
    if (keyword && (entry.word.includes(keyword) || definition.includes(keyword))) score += 8;
  }
  if (/^[\p{Script=Han}]{4}$/u.test(entry.word)) score += 2;
  if (entry.word.length >= 2 && entry.word.length <= 4) score += 3;
  if (definition.length > 0 && definition.length < 90) score += 2;
  if (/成语|典故|比喻|形容|谓/u.test(definition)) score += 1;
  if (input.contextText) {
    for (const token of uniqueStrings(input.contextText.match(/[\p{Script=Han}]{1,2}/gu) || []).slice(0, 24)) {
      if (text.includes(token)) score += 0.5;
    }
  }
  return score;
}
function recommendVocabularyEntries(input) {
  const catalog = input.resources.vocabularyCatalog;
  if (!catalog) return [];
  const categories = SCENE_TYPE_CATEGORY_MAP[input.sceneType] || ["cultural"];
  const candidates = uniqueStrings(categories).flatMap((category) => catalog.entriesByCategory[category] || []);
  const keywordMatches = (input.keywords || []).flatMap((keyword) => catalog.entriesByWord.get(keyword) ? [catalog.entriesByWord.get(keyword)] : []);
  return uniqueStrings([...keywordMatches, ...candidates].map((entry) => entry.word)).map((word) => catalog.entriesByWord.get(word)).filter((entry) => Boolean(entry)).map((entry) => ({
    entry,
    score: vocabularyRelevanceScore(entry, {
      sceneType: input.sceneType,
      keywords: input.keywords,
      contextText: input.contextText
    })
  })).sort((left, right) => right.score - left.score || left.entry.word.length - right.entry.word.length).map((item) => item.entry).slice(0, input.limit ?? 24);
}
function recommendRelevantIdioms(input) {
  return recommendVocabularyEntries({
    ...input,
    limit: Math.max(30, input.limit ?? 5)
  }).filter((entry) => /^[\p{Script=Han}]{4,8}$/u.test(entry.word)).filter((entry) => /成语|典故|比喻|形容|谓|喻/u.test(entry.definition) || /^[\p{Script=Han}]{4}$/u.test(entry.word)).slice(0, input.limit ?? 5);
}
function isActionableVocabularyEntry(entry) {
  const definition = cleanVocabularyDefinition(entry.definition, 120);
  if (!/^[\p{Script=Han}]{1,8}$/u.test(entry.word)) return false;
  if (/词典|学科|术语|中国社会科学院|现代汉语|诗体名|灯谜|谜格|日本|天皇|公元|语法|音高|商务印书馆/u.test(definition)) return false;
  if (/^(?:成语|词汇|语言|文字|说什么|哪里是)$/u.test(entry.word)) return false;
  return true;
}
function createDraftVocabularyHints(input) {
  const keywords = extractVocabularyKeywords({
    state: input.state,
    task: input.task,
    blueprint: input.blueprint,
    continuityContract: input.continuityContract,
    sceneType: input.sceneType,
    limit: 12
  });
  const contextText = [
    input.state.project.idea,
    input.task.summary,
    input.task.causalPlan?.sceneObjective || "",
    input.continuityContract?.continuityAnchors.join(" ") || ""
  ].join("\n");
  return recommendVocabularyEntries({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText,
    limit: Math.max(24, input.limit ?? 10)
  }).filter(isActionableVocabularyEntry).slice(0, input.limit ?? 10).map((entry) => `${entry.word}: ${cleanVocabularyDefinition(entry.definition, 48)}`);
}
function createVocabularyUsagePrompt(input) {
  const keywords = extractVocabularyKeywords({
    state: input.state,
    task: input.task,
    blueprint: input.blueprint,
    continuityContract: input.continuityContract,
    sceneType: input.sceneType,
    limit: 16
  });
  const contextText = [
    input.state.project.idea,
    input.task?.summary || "",
    input.task?.causalPlan?.sceneObjective || "",
    input.continuityContract?.continuityAnchors.join(" ") || "",
    input.blueprint || ""
  ].join("\n");
  const entries = recommendVocabularyEntries({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText,
    limit: input.limit ?? 20
  });
  const idioms = recommendRelevantIdioms({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText,
    limit: 5
  });
  if (entries.length === 0) {
    return [
      "## Vocabulary Skill Guidance",
      "",
      "- \u8BCD\u6C47\u7D22\u5F15\u6682\u672A\u547D\u4E2D\uFF1B\u4F18\u5148\u4F7F\u7528\u5177\u4F53\u52A8\u4F5C\u3001\u7269\u4EF6\u3001\u611F\u5B98\u548C\u4EBA\u7269\u5173\u7CFB\u63A8\u52A8\u573A\u666F\u3002",
      "- \u6210\u8BED\u53EA\u80FD\u5728\u603B\u7ED3\u3001\u5BF9\u6BD4\u3001\u5F3A\u8C03\u5904\u70B9\u5230\u4E3A\u6B62\uFF0C\u6BCF\u7AE0\u4E0D\u8D85\u8FC7 3-5 \u4E2A\u3002"
    ].join("\n");
  }
  const base = entries.slice(0, 10);
  const advanced = entries.slice(10, 16);
  const rare = entries.slice(16, 20);
  return [
    `## ${input.sceneType}\u573A\u666F - \u8BCD\u6C47\u4F7F\u7528\u6307\u5357`,
    "",
    "### \u6838\u5FC3\u539F\u5219\uFF1A\u6210\u8BED\u5FC5\u987B\u4E0E\u6587\u672C\u5173\u8054",
    "- \u8981\u6709\u524D\u6587\u94FA\u57AB\uFF0C\u8981\u6709\u903B\u8F91\u5173\u8054\uFF0C\u8981\u7B26\u5408\u573A\u666F\u6C1B\u56F4\u3002",
    "- \u4E0D\u8981\u5B64\u96F6\u96F6\u5730\u4F7F\u7528\uFF0C\u4E0D\u8981\u5806\u780C\u53E0\u52A0\uFF0C\u4E0D\u8981\u5F3A\u884C\u690D\u5165\u3002",
    "- \u8BCD\u6C47\u91D1\u5B57\u5854\uFF1A\u57FA\u7840\u8BCD\u6C47\u7EA6 50%\uFF0C\u8FDB\u9636\u8BCD\u6C47\u7EA6 30%\uFF0C\u9AD8\u7EA7\u8BCD\u6C47\u7EA6 15%\uFF0C\u7A00\u6709/\u6210\u8BED\u7EA6 5%\u3002",
    "- \u6BCF\u6BB5\u6700\u591A 1 \u4E2A\u6210\u8BED\uFF0C\u6BCF\u7AE0\u901A\u5E38\u4E0D\u8D85\u8FC7 3-5 \u4E2A\uFF1B\u66F4\u91CD\u8981\u7684\u662F\u52A8\u4F5C\u3001\u611F\u5B98\u548C\u56E0\u679C\u53E5\u3002",
    "",
    "### \u5173\u952E\u8BCD\u6765\u6E90",
    keywords.length ? `- ${keywords.slice(0, 12).join("\u3001")}` : "- \u6682\u65E0\u660E\u786E\u5173\u952E\u8BCD\uFF0C\u6309\u573A\u666F\u7C7B\u578B\u63A8\u8350\u3002",
    "",
    "### \u6210\u8BED\u5173\u8054\u6027\u68C0\u67E5",
    ...idioms.length ? idioms.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}\uFF1B\u4EC5\u5728\u5DF2\u6709\u94FA\u57AB\u540E\u7528\u4E8E\u603B\u7ED3/\u5BF9\u6BD4/\u5F3A\u8C03\u3002`) : ["- \u672A\u627E\u5230\u9AD8\u5EA6\u76F8\u5173\u6210\u8BED\uFF0C\u5EFA\u8BAE\u4F7F\u7528\u57FA\u7840\u8BCD\u6C47\u8868\u8FBE\uFF0C\u4E0D\u5F3A\u884C\u690D\u5165\u3002"],
    "",
    "### \u57FA\u7840\u8BCD\u6C47 - \u4F18\u5148\u4F7F\u7528",
    ...base.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}`),
    "",
    "### \u8FDB\u9636\u8BCD\u6C47 - \u9002\u5F53\u4F7F\u7528",
    ...advanced.length ? advanced.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}`) : ["- \u65E0\u3002"],
    "",
    "### \u9AD8\u7EA7/\u7A00\u6709\u8BCD\u6C47 - \u8C28\u614E\u4F7F\u7528",
    ...rare.length ? rare.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}`) : ["- \u65E0\u3002"]
  ].join("\n");
}
function trimExampleBlock(block = "", maxLength = 760) {
  return block.replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}
function extractSkillExampleBlocks(examples, label, limit = 2) {
  const joined = examples.join("\n\n");
  const pattern = new RegExp(`###\\s+[^\\n]*${label}[^\\n]*\\n([\\s\\S]*?)(?=\\n###\\s|\\n---|\\n##\\s|$)`, "gu");
  const blocks = [];
  for (const match of joined.matchAll(pattern)) {
    const block = trimExampleBlock(match[1] || "");
    if (block) {
      blocks.push(block);
    }
    if (blocks.length >= limit) {
      break;
    }
  }
  return blocks;
}
function createVocabularySkillExamplePrompt(resources, sceneType) {
  const positiveBlocks = extractSkillExampleBlocks(resources.examples, "\u6B63\u786E\u793A\u8303", 2);
  const negativeBlocks = extractSkillExampleBlocks(resources.examples, "\u9519\u8BEF\u793A\u8303", 1);
  if (positiveBlocks.length === 0 && negativeBlocks.length === 0) {
    return [
      "## Migrated Vocabulary Skill Examples",
      "",
      "- \u65E7\u8BCD\u6C47 skill \u793A\u4F8B\u672A\u547D\u4E2D\uFF1B\u4ECD\u5FC5\u987B\u9075\u5FAA\u65B9\u6CD5\uFF1A\u5148\u5199\u5177\u4F53\u5185\u5BB9\uFF0C\u518D\u5C11\u91CF\u70B9\u7F00\u6210\u8BED\u3002",
      "- \u7981\u6B62\u628A\u63A8\u8350\u8BCD\u5806\u6210\u573A\u666F\uFF0C\u7981\u6B62\u628A\u5355\u5B57/\u77ED\u8BCD\u72EC\u7ACB\u6210\u884C\u6A21\u62DF\u6C1B\u56F4\u3002"
    ].join("\n");
  }
  return [
    "## Migrated Vocabulary Skill Examples",
    "",
    `Scene type: ${sceneType}`,
    "- \u8FD9\u4E9B\u793A\u4F8B\u6765\u81EA\u65E7\u5199\u4F5C skill/\u8D44\u6E90\uFF0C\u53EA\u5B66\u4E60\u65B9\u6CD5\uFF0C\u4E0D\u590D\u7528\u539F\u6587\u60C5\u8282\u3002",
    "- \u5173\u952E\u65B9\u6CD5\uFF1A\u5148\u7528\u57FA\u7840\u8BCD\u6C47\u5199\u52A8\u4F5C\u3001\u7269\u4EF6\u3001\u611F\u5B98\u3001\u5BF9\u8BDD\u548C\u56E0\u679C\uFF0C\u518D\u628A\u5C11\u91CF\u6210\u8BED\u653E\u5728\u603B\u7ED3\u3001\u5BF9\u6BD4\u6216\u5F3A\u8C03\u5904\u3002",
    "",
    "### Positive Patterns To Imitate",
    ...positiveBlocks.length ? positiveBlocks.map((block, index) => [`#### Positive ${index + 1}`, block].join("\n")) : ["- \u6682\u65E0\u3002"],
    "",
    "### Anti Patterns To Avoid",
    ...negativeBlocks.length ? negativeBlocks.map((block, index) => [`#### Anti Pattern ${index + 1}`, block].join("\n")) : ["- \u6682\u65E0\u3002"],
    "",
    "### Execution Checklist",
    "- \u5148\u5199\u5185\u5BB9\uFF0C\u518D\u8003\u8651\u8BCD\u6C47\u66FF\u6362\u3002",
    "- \u6BCF\u4E2A\u6210\u8BED\u524D\u5FC5\u987B\u6709\u5177\u4F53\u94FA\u57AB\uFF0C\u540E\u9762\u5FC5\u987B\u670D\u52A1\u60C5\u7EEA\u3001\u5C40\u52BF\u6216\u4EBA\u7269\u5224\u65AD\u3002",
    "- \u5BF9\u8BDD\u4F18\u5148\u7B26\u5408\u4EBA\u7269\u8EAB\u4EFD\u548C\u5173\u7CFB\uFF0C\u4E0D\u7528\u6210\u8BED\u5C55\u793A\u6587\u91C7\u3002",
    "- \u573A\u666F\u53E5\u5FC5\u987B\u80FD\u770B\u89C1\u52A8\u4F5C\u3001\u542C\u89C1\u58F0\u97F3\u3001\u6478\u5230\u7269\u4EF6\u6216\u611F\u5230\u538B\u529B\u3002"
  ].join("\n");
}
function createVocabularyResourceManifest(input) {
  const keywords = extractVocabularyKeywords({
    state: input.state,
    task: input.task,
    blueprint: input.blueprint,
    continuityContract: input.continuityContract,
    sceneType: input.sceneType,
    limit: 12
  });
  const entries = recommendVocabularyEntries({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText: [
      input.state.project.idea,
      input.task.summary,
      input.task.causalPlan?.sceneObjective || "",
      input.continuityContract?.continuityAnchors.join(" ") || "",
      input.blueprint || ""
    ].join("\n"),
    limit: input.limit ?? 12
  });
  const idioms = recommendRelevantIdioms({
    resources: input.resources,
    sceneType: input.sceneType,
    keywords,
    contextText: input.blueprint || input.task.summary,
    limit: 4
  });
  const categories = SCENE_TYPE_CATEGORY_MAP[input.sceneType] || ["cultural"];
  return [
    "## Writing Resource Usage Manifest",
    "",
    `- Scene type: ${input.sceneType}`,
    `- Vocabulary categories: ${categories.join(", ")}`,
    `- Vocabulary catalog: ${input.resources.vocabularyCatalog ? `${input.resources.vocabularyCatalog.totalWords} entries loaded` : "not loaded"}`,
    `- Skill examples loaded: ${input.resources.examples.length}`,
    keywords.length ? `- Context keywords: ${keywords.join("\u3001")}` : "- Context keywords: none",
    "",
    "### Recommended Idiom Candidates",
    ...idioms.length ? idioms.map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}.`) : ["- No high-confidence idiom candidate; prefer plain concrete wording."],
    "",
    "### Recommended Scene Vocabulary",
    ...entries.length ? entries.slice(0, 12).map((entry) => `- ${entry.word}: ${cleanVocabularyDefinition(entry.definition)}.`) : ["- No vocabulary hit; use concrete actions, objects, sensory details, and causality."]
  ].join("\n");
}
var CONTINUITY_ANCHOR_STOPWORDS = /* @__PURE__ */ new Set([
  "\u672C\u7AE0",
  "\u4E0A\u4E00\u7AE0",
  "\u4E0B\u4E00\u7AE0",
  "\u4E3B\u89D2",
  "\u6B63\u6587",
  "\u7EC8\u7A3F",
  "\u521D\u7A3F",
  "\u7AE0\u8282",
  "\u5267\u60C5",
  "\u63A8\u8FDB",
  "\u7EBF\u7D22",
  "\u4F0F\u7B14",
  "\u5173\u7CFB",
  "\u72B6\u6001",
  "\u9009\u62E9",
  "\u4EE3\u4EF7",
  "\u95EE\u9898",
  "\u76EE\u6807",
  "\u8BB0\u5FC6",
  "\u89D2\u8272",
  "\u4EBA\u7269",
  "\u573A\u666F",
  "\u538B\u529B",
  "\u5C40\u52BF",
  "\u5C40\u90E8",
  "\u7ED3\u679C",
  "\u540E\u7EED",
  "\u627F\u63A5",
  "\u8BB0\u5F55",
  "\u66F4\u65B0",
  "\u901A\u8FC7",
  "\u5B8C\u6210",
  "\u4FDD\u6301",
  "\u4E0D\u80FD",
  "\u5FC5\u987B",
  "\u9700\u8981",
  "\u4E0D\u5F97",
  "\u5DF2\u8BB0\u5F55",
  "\u5DF2\u5B8C\u6210",
  "\u6682\u65E0",
  "\u53EF\u7528",
  "Project",
  "Chapter",
  "Summary"
]);
var CONTINUITY_KEYWORD_PATTERN = /契书|田册|账册|账簿|簿册|名册|密信|书信|官印|印信|钥匙|玉佩|粮袋|米粮|银钱|欠债|债契|文书|案卷|税粮|军令|告示|药包|伤口|血迹|脚印|马车|坊门|县衙|市集|西市|城门|渡口|驿站|仓房|牢房|祠堂|寺庙|河堤|粮仓|官道|名单|人名|暗号|口供|证据|账目|粮价|租税|逃户|流民|差役|主簿|县令|坊正|管事/u;
function normalizeAnchorTerm(value = "") {
  return value.replace(/[^\p{Script=Han}A-Za-z0-9_-]+/gu, "").trim();
}
function isUsefulContinuityAnchor(value, lockedProtagonistName = "") {
  const anchor = normalizeAnchorTerm(value);
  if (anchor.length < 2 || anchor.length > 12) return false;
  if (lockedProtagonistName && anchor === lockedProtagonistName) return false;
  if (CONTINUITY_ANCHOR_STOPWORDS.has(anchor)) return false;
  if (/^(?:第?\d+章|chapter\d*)$/iu.test(anchor)) return false;
  if (/^[一二三四五六七八九十百千万]+$/u.test(anchor)) return false;
  return true;
}
function scoreContinuityAnchor(text, anchor, lockedProtagonistName = "") {
  let score = 0;
  if (extractChinesePersonNames(text, 40).includes(anchor)) score += 8;
  if (CONTINUITY_KEYWORD_PATTERN.test(anchor)) score += 7;
  if (new RegExp(`[\u300C\u300A\u201C"]${anchor}[\u300D\u300B\u201D"]`, "u").test(text)) score += 5;
  if (/契|册|簿|信|印|粮|税|债|案|令|药|伤|血|门|市|衙|仓|牢|堤|价|租|流民|差役|主簿|县令|坊正|管事/u.test(anchor)) score += 3;
  if (lockedProtagonistName && text.includes(lockedProtagonistName) && text.includes(anchor)) score += 1;
  return score;
}
function extractContinuityAnchors(input) {
  const text = input.text || "";
  const lockedProtagonistName = input.lockedProtagonistName || "";
  const rawAnchors = [];
  rawAnchors.push(...extractChinesePersonNames(text, 30).filter((name) => name !== lockedProtagonistName));
  for (const match of text.matchAll(/[「《“"]([^」》”"\n]{2,12})[」》”"]/gu)) {
    rawAnchors.push(String(match[1] || ""));
  }
  for (const match of text.matchAll(new RegExp(`([\\p{Script=Han}]{0,4}(?:${CONTINUITY_KEYWORD_PATTERN.source})[\\p{Script=Han}]{0,4})`, "gu"))) {
    rawAnchors.push(String(match[1] || ""));
  }
  for (const line of text.split("\n")) {
    if (!/(上一章|本章|下一章|Foreshadowing|Character|Summary|伏笔|线索|物品|代价|关系|状态|未解决|承接|回收|延后)/iu.test(line)) {
      continue;
    }
    for (const match of line.matchAll(/[\p{Script=Han}]{2,8}/gu)) {
      rawAnchors.push(String(match[0] || ""));
    }
  }
  const uniqueAnchors = uniqueStrings(rawAnchors.map(normalizeAnchorTerm)).filter((anchor) => isUsefulContinuityAnchor(anchor, lockedProtagonistName)).map((anchor) => ({
    anchor,
    score: scoreContinuityAnchor(text, anchor, lockedProtagonistName)
  })).sort((left, right) => right.score - left.score || left.anchor.length - right.anchor.length).map((item) => item.anchor);
  return uniqueStrings(uniqueAnchors).slice(0, input.limit ?? 10);
}
function evaluateNarrativeStyleQuality(text = "") {
  const body = text.replace(/```[\s\S]*?```/g, "").split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|章节元数据|章节元信息)/u)[0];
  const lines = body.split("\n").map((line) => line.trim()).filter((line) => line && !/^#{1,6}\s/u.test(line) && !/^[-*]\s/u.test(line));
  const fragments = lines.map((line) => line.replace(/[，。！？；：、,.!?;:\s"'“”‘’（）()《》「」]/gu, "")).filter((line) => /^[\p{Script=Han}]{1,4}$/u.test(line));
  const fragmentCounts = /* @__PURE__ */ new Map();
  for (const fragment of fragments) {
    fragmentCounts.set(fragment, (fragmentCounts.get(fragment) || 0) + 1);
  }
  const repeatedFragment = [...fragmentCounts.entries()].filter(([fragment, count]) => fragment.length <= 3 && count >= 3).sort((left, right) => right[1] - left[1])[0];
  let maxConsecutiveFragments = 0;
  let currentConsecutiveFragments = 0;
  for (const line of lines) {
    const compact = line.replace(/[，。！？；：、,.!?;:\s"'“”‘’（）()《》「」]/gu, "");
    if (/^[\p{Script=Han}]{1,4}$/u.test(compact)) {
      currentConsecutiveFragments += 1;
      maxConsecutiveFragments = Math.max(maxConsecutiveFragments, currentConsecutiveFragments);
    } else {
      currentConsecutiveFragments = 0;
    }
  }
  const sentenceFragments = body.split(/[。！？!?；;\n]+/u).map((sentence) => sentence.replace(/[，、：:,.…\s"'“”‘’（）()《》「」]/gu, "")).filter((sentence) => /^[\p{Script=Han}]{1,4}$/u.test(sentence));
  if (repeatedFragment) {
    return {
      status: "quarantined",
      reason: `\u98CE\u683C\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u77ED\u8BCD/\u5355\u5B57\u788E\u7247\u300C${repeatedFragment[0]}\u300D\u91CD\u590D ${repeatedFragment[1]} \u6B21\uFF0CAI \u5316\u75D5\u8FF9\u8FC7\u91CD\u3002`,
      fragments
    };
  }
  if (maxConsecutiveFragments >= 3) {
    return {
      status: "quarantined",
      reason: `\u98CE\u683C\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u8FDE\u7EED ${maxConsecutiveFragments} \u884C\u77ED\u8BCD/\u5355\u5B57\u788E\u7247\u5316\u63CF\u5199\uFF0C\u5FC5\u987B\u6539\u6210\u5B8C\u6574\u52A8\u4F5C\u3001\u611F\u5B98\u548C\u56E0\u679C\u53E5\u3002`,
      fragments
    };
  }
  if (sentenceFragments.length >= 10) {
    return {
      status: "quarantined",
      reason: `\u98CE\u683C\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u5168\u6587\u51FA\u73B0 ${sentenceFragments.length} \u4E2A\u5B64\u7ACB\u77ED\u53E5\u788E\u7247\uFF0CAI \u5316\u8282\u594F\u8FC7\u91CD\u3002`,
      fragments: sentenceFragments
    };
  }
  return {
    status: "eligible",
    reason: "\u98CE\u683C\u786C\u95E8\u69DB\u901A\u8FC7\uFF1A\u672A\u53D1\u73B0\u9AD8\u9891\u77ED\u8BCD/\u5355\u5B57\u788E\u7247\u5316\u91CD\u590D\u3002",
    fragments
  };
}
function evaluateWritingResourceUsage(text = "", state, task, blueprint = "", continuityContract) {
  const body = text.replace(/```[\s\S]*?```/g, "").split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|章节元数据|章节元信息)/u)[0];
  const resourceTerms = uniqueStrings([
    ...[...blueprint.matchAll(/^- ([\p{Script=Han}]{2,8}):/gmu)].map((match) => match[1] || ""),
    ...task?.causalPlan?.requiredContinuityAnchors || [],
    ...continuityContract?.continuityAnchors || []
  ]).filter((term) => isUsefulContinuityAnchor(term, continuityContract?.lockedProtagonistName || ""));
  const matchedTerms = resourceTerms.filter((term) => body.includes(term)).slice(0, 8);
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|写|划|敲|拦|避|追|停|跪|坐|起/gu) || []).length;
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软/gu) || []).length;
  const objectSignals = (body.match(/账册|密信|官印|钥匙|玉佩|粮袋|银钱|文书|案卷|药包|伤口|马车|城门|坊门|县衙|市集|粮仓|名单|证据|刀|剑|灯|门|桌|碗|纸/gu) || []).length;
  const idiomLikeSentences = body.split(/[。！？!?；;\n]+/u).map((sentence) => sentence.trim()).filter((sentence) => /^[\p{Script=Han}]{4,8}$/u.test(sentence));
  const stackedIdiomRun = body.split(/[。！？!?；;\n]+/u).some((sentence) => {
    const shortSegments = sentence.split(/[，、,]/u).map((segment) => segment.replace(/[^\p{Script=Han}]/gu, "")).filter((segment) => segment.length >= 4 && segment.length <= 8);
    const idiomishSegments = shortSegments.filter(
      (segment) => /^[\p{Script=Han}]{4}$/u.test(segment) && /心|意|义|忠|耿|筹|略|深|虑|愤|慨|危|乱|转|惊|骇|悲|喜|忧|患|难|易|得|失|荣|辱|进|退/u.test(segment) && !/有人|对方|场景|关系|章节|上章|章末|词汇|高级|基础|展开|自然|选择|代价|线索|资源|身份|风险/u.test(segment)
    );
    return shortSegments.length >= 3 && idiomishSegments.length >= 2;
  });
  const projectIdea = state?.project?.idea || "";
  const causalObjective = task?.causalPlan?.sceneObjective || "";
  const projectSignal = [projectIdea, causalObjective].flatMap((value) => value.match(/[\p{Script=Han}]{2,6}/gu) || []).filter((term) => !CONTINUITY_ANCHOR_STOPWORDS.has(term)).slice(0, 12).some((term) => body.includes(term));
  if (stackedIdiomRun || idiomLikeSentences.length >= 8) {
    return {
      status: "quarantined",
      reason: "\u5199\u4F5C\u8D44\u6E90\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u7591\u4F3C\u628A\u6210\u8BED/\u77ED\u8BCD\u5806\u6210\u573A\u666F\uFF0C\u672A\u81EA\u7136\u5D4C\u5165\u52A8\u4F5C\u3001\u611F\u5B98\u6216\u56E0\u679C\u53E5\u3002",
      matchedTerms
    };
  }
  const concreteSignals = actionSignals + sensorySignals + objectSignals;
  if (concreteSignals < 4 && matchedTerms.length < 1 && !projectSignal) {
    return {
      status: "quarantined",
      reason: "\u5199\u4F5C\u8D44\u6E90\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u6B63\u6587\u7F3A\u5C11\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u7269\u4EF6\u6216\u9879\u76EE\u5173\u952E\u8BCD\uFF0C\u8D44\u6E90\u6CA1\u6709\u843D\u5230\u5177\u4F53\u573A\u666F\u3002",
      matchedTerms
    };
  }
  return {
    status: "eligible",
    reason: matchedTerms.length ? `\u5199\u4F5C\u8D44\u6E90\u5438\u6536\u901A\u8FC7\uFF1A\u6B63\u6587\u81EA\u7136\u547D\u4E2D ${matchedTerms.slice(0, 5).join("\u3001")} \u7B49\u8D44\u6E90/\u951A\u70B9\u3002` : "\u5199\u4F5C\u8D44\u6E90\u5438\u6536\u901A\u8FC7\uFF1A\u6B63\u6587\u4EE5\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u7269\u4EF6\u548C\u56E0\u679C\u63A8\u8FDB\u4E3A\u4E3B\uFF0C\u672A\u53D1\u73B0\u5806\u8BCD\u53CD\u6A21\u5F0F\u3002",
    matchedTerms
  };
}
function extractNarrativeBody(text = "") {
  return text.replace(/```[\s\S]*?```/g, "").split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
}
function createNaturalnessReport(input) {
  const body = extractNarrativeBody(input.afterDraft);
  const sentences = body.split(/[。！？!?；;\n]+/u).map((part) => part.trim()).filter(Boolean);
  const wordTotal = Math.max(1, wordCount(body));
  const dialogueCount = (body.match(/[「“][^」”]{2,120}[」”]/gu) || []).length;
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|跪|坐|起|握|松|咬|皱眉|沉默/gu) || []).length;
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软|烫|凉/gu) || []).length;
  const aiSummarySignals = (body.match(/由此可见|不难看出|事实上|显然|总而言之|综上|这意味着|他终于明白|命运的齿轮|这一刻.*命运|内心深处|复杂的情绪|无法言喻|说不出的感觉|某种意义上/gu) || []).length;
  const analyticSignals = (body.match(/第一|第二|首先|其次|最后|原因是|从.*角度|可以看出|体现了|说明了|证明了/gu) || []).length;
  const emotionLabelSignals = (body.match(/愤怒|悲伤|恐惧|绝望|震惊|激动|开心|难过|复杂|崩溃|释然/gu) || []).length;
  const characterPresence = evaluateCharacterProfilePresence(input.afterDraft, input.characterProfileContract);
  const styleQuality = evaluateNarrativeStyleQuality(input.afterDraft);
  const plotContinuity = evaluatePlotContinuityBridge(input.afterDraft, input.task, input.continuityContract);
  const preservedFacts = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.requiredNames,
    ...input.continuityContract.continuityAnchors.filter((anchor) => input.afterDraft.includes(anchor))
  ].filter(Boolean)).slice(0, 12);
  const riskFlags = [
    ...styleQuality.status === "quarantined" ? [styleQuality.reason] : [],
    ...plotContinuity.status === "quarantined" ? [plotContinuity.reason] : [],
    ...characterPresence.status === "quarantined" ? [characterPresence.reason] : [],
    ...aiSummarySignals >= 3 ? [`\u603B\u7ED3\u8154/AI \u65C1\u767D\u4FE1\u53F7\u8FC7\u591A\uFF1A${aiSummarySignals}`] : [],
    ...analyticSignals >= 5 ? [`\u5206\u6790\u62A5\u544A\u8154\u4FE1\u53F7\u8FC7\u591A\uFF1A${analyticSignals}`] : [],
    ...emotionLabelSignals > Math.max(8, Math.floor(wordTotal / 450)) && actionSignals < emotionLabelSignals ? [`\u60C5\u7EEA\u6807\u7B7E\u591A\u4E8E\u52A8\u4F5C\u5916\u5316\uFF1Aemotion=${emotionLabelSignals}, action=${actionSignals}`] : [],
    ...dialogueCount === 0 && wordTotal > 900 ? ["\u957F\u7AE0\u8282\u7F3A\u5C11\u5BF9\u767D\uFF0C\u89D2\u8272\u58F0\u97F3\u4E0D\u591F\u81EA\u7136\u3002"] : [],
    ...actionSignals + sensorySignals < Math.max(6, Math.floor(wordTotal / 350)) ? ["\u52A8\u4F5C/\u611F\u5B98\u4FE1\u53F7\u4E0D\u8DB3\uFF0C\u6587\u672C\u53EF\u80FD\u504F\u6458\u8981\u3002"] : []
  ];
  const changedBlocks = input.beforeDraft === input.afterDraft ? 0 : Math.abs(input.afterDraft.split(/\n{2,}/u).length - input.beforeDraft.split(/\n{2,}/u).length) + (input.afterDraft.length === input.beforeDraft.length ? 1 : Math.max(1, Math.round(Math.abs(input.afterDraft.length - input.beforeDraft.length) / 500)));
  const score = Math.max(0, Math.min(10, 10 - riskFlags.length * 2 - Math.max(0, aiSummarySignals - 1) - Math.max(0, analyticSignals - 3)));
  const status = riskFlags.some((flag) => /硬门槛失败|连续性|角色档案硬门槛|阻塞/u.test(flag)) ? "blocked" : score >= 7 ? "passed" : "needs_revision";
  return {
    status,
    score,
    reason: status === "passed" ? "\u81EA\u7136\u5EA6\u95E8\u7981\u901A\u8FC7\uFF1A\u6587\u672C\u4EE5\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u5BF9\u767D\u3001\u5173\u7CFB\u538B\u529B\u548C\u5177\u4F53\u9009\u62E9\u5448\u73B0\uFF0C\u672A\u53D1\u73B0\u963B\u585E\u6027 AI \u5473\u3002" : `\u81EA\u7136\u5EA6\u95E8\u7981${status === "blocked" ? "\u963B\u585E" : "\u9700\u8981\u8FD4\u5DE5"}\uFF1A${riskFlags.slice(0, 4).join("\uFF1B") || "\u81EA\u7136\u8868\u8FBE\u4FE1\u53F7\u4E0D\u8DB3\u3002"}`,
    changedBlocks,
    riskFlags,
    preservedFacts,
    patchSummary: [
      changedBlocks > 0 ? `\u6587\u672C\u53D1\u751F\u7EA6 ${changedBlocks} \u4E2A\u5757\u7EA7\u53D8\u5316\u3002` : "\u672A\u53D1\u751F\u5757\u7EA7\u53D8\u5316\u6216\u4F7F\u7528\u786E\u5B9A\u6027\u6574\u7406\u7A3F\u3002",
      `\u5BF9\u767D\u6570\uFF1A${dialogueCount}\uFF1B\u52A8\u4F5C\u4FE1\u53F7\uFF1A${actionSignals}\uFF1B\u611F\u5B98\u4FE1\u53F7\uFF1A${sensorySignals}\u3002`,
      characterPresence.reason
    ]
  };
}
function formatNaturalnessReport(report) {
  return [
    "## Naturalness Report",
    `- Status: ${report.status}`,
    `- Score: ${report.score}/10`,
    `- Reason: ${report.reason}`,
    `- Changed blocks: ${report.changedBlocks}`,
    `- Preserved facts: ${report.preservedFacts.length ? report.preservedFacts.join("\u3001") : "none"}`,
    "",
    "### Risk Flags",
    ...report.riskFlags.length ? report.riskFlags.map((flag) => `- ${flag}`) : ["- none"],
    "",
    "### Patch Summary",
    ...report.patchSummary.map((line) => `- ${line}`)
  ].join("\n");
}
function evaluatePlotContinuityBridge(finalDraft, task, continuityContract) {
  if (task.chapterNumber <= 1) {
    return {
      status: "eligible",
      reason: "\u9996\u7AE0\u4E0D\u9700\u8981\u627F\u63A5\u4E0A\u4E00\u7AE0\u951A\u70B9\u3002",
      matchedAnchors: [],
      requiredAnchors: []
    };
  }
  const anchors = continuityContract.continuityAnchors.filter((anchor) => isUsefulContinuityAnchor(anchor, continuityContract.lockedProtagonistName));
  if (anchors.length === 0) {
    return {
      status: "eligible",
      reason: "\u6682\u65E0\u53EF\u7528\u4E0A\u4E00\u7AE0\u8FDE\u7EED\u6027\u951A\u70B9\uFF1B\u672C\u7AE0\u6309\u4E3B\u7EBF\u548C\u84DD\u56FE\u627F\u63A5\u3002",
      matchedAnchors: [],
      requiredAnchors: []
    };
  }
  const requiredCount = Math.min(2, anchors.length);
  const matchedAnchors = anchors.filter((anchor) => finalDraft.includes(anchor));
  if (matchedAnchors.length < requiredCount) {
    return {
      status: "quarantined",
      reason: `\u7AE0\u8282\u8FDE\u7EED\u6027\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u6B63\u6587\u53EA\u627F\u63A5 ${matchedAnchors.length}/${requiredCount} \u4E2A\u4E0A\u4E00\u7AE0\u951A\u70B9\u3002\u7F3A\u5C11\uFF1A${anchors.filter((anchor) => !matchedAnchors.includes(anchor)).slice(0, requiredCount).join("\u3001")}\u3002`,
      matchedAnchors,
      requiredAnchors: anchors.slice(0, Math.max(requiredCount, 4))
    };
  }
  return {
    status: "eligible",
    reason: `\u7AE0\u8282\u8FDE\u7EED\u6027\u901A\u8FC7\uFF1A\u5DF2\u627F\u63A5\u4E0A\u4E00\u7AE0\u951A\u70B9 ${matchedAnchors.slice(0, 4).join("\u3001")}\u3002`,
    matchedAnchors,
    requiredAnchors: anchors.slice(0, Math.max(requiredCount, 4))
  };
}
async function retrieveWritingKnowledgeContext(input) {
  if (!input.options.factoryRootDir || !input.options.projectId) {
    return {
      rows: [],
      prompt: "No knowledge database is attached to this run."
    };
  }
  const rows = await retrieveKnowledge({
    rootDir: input.options.factoryRootDir,
    projectId: input.options.projectId,
    query: [
      input.state.project.title,
      input.state.project.idea,
      input.task ? `Chapter ${input.task.chapterNumber}: ${input.task.title}` : "",
      input.task?.summary || "",
      input.query
    ].filter(Boolean).join("\n"),
    scopes: ["project", "global"],
    sourceTypes: input.sourceTypes,
    limit: input.limit ?? 8,
    runId: input.options.directorCommandId ?? null,
    recordCitation: true
  }).catch(() => []);
  return {
    rows,
    prompt: formatKnowledgeForPrompt(rows, input.limit ?? 8)
  };
}
function getArcLabel(state, chapterNumber) {
  const arcSize = Math.max(3, Math.ceil(state.plan.totalChapters / 4));
  const arcNumber = Math.ceil(chapterNumber / arcSize);
  const start = (arcNumber - 1) * arcSize + 1;
  const end = Math.min(state.plan.totalChapters, start + arcSize - 1);
  return `\u7B2C ${arcNumber} \u5F27\uFF08\u7B2C ${start}-${end} \u7AE0\uFF09`;
}
function defaultCausalPlan(state, task) {
  const arcLabel = getArcLabel(state, task.chapterNumber);
  return {
    previousInput: task.chapterNumber <= 1 ? "\u627F\u63A5\u539F\u59CB\u521B\u4F5C\u76EE\u6807\u548C\u8BBE\u5B9A\u51BB\u7ED3\u7ED3\u8BBA\uFF0C\u5EFA\u7ACB\u552F\u4E00\u4E3B\u89D2\u3001\u6838\u5FC3\u7F3A\u53E3\u548C\u7B2C\u4E00\u6761\u4E3B\u7EBF\u7EBF\u7D22\u3002" : `\u627F\u63A5\u7B2C ${task.chapterNumber - 1} \u7AE0\u7559\u4E0B\u7684\u72B6\u6001\u3001\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u4EE3\u4EF7\u548C\u672A\u89E3\u51B3\u95EE\u9898\u3002`,
    sceneObjective: `\u56F4\u7ED5\u300C${state.project.idea}\u300D\u5728${arcLabel}\u5B8C\u6210\u4E00\u6B21\u5177\u4F53\u60C5\u8282\u63A8\u8FDB\uFF0C\u4E0D\u80FD\u53EA\u505A\u8BBE\u5B9A\u8BF4\u660E\u3002`,
    protagonistDecision: "\u4E3B\u89D2\u5FC5\u987B\u5728\u53EF\u89C1\u538B\u529B\u4E0B\u4E3B\u52A8\u505A\u51FA\u9009\u62E9\uFF0C\u9009\u62E9\u8981\u6539\u53D8\u5C40\u52BF\u6216\u5173\u7CFB\u3002",
    irreversibleConsequence: "\u672C\u7AE0\u7ED3\u5C3E\u5FC5\u987B\u7559\u4E0B\u8EAB\u4EFD\u98CE\u9669\u3001\u5173\u7CFB\u88C2\u7F1D\u3001\u7EBF\u7D22\u66B4\u9732\u3001\u8D44\u6E90\u635F\u5931\u6216\u4E16\u754C\u89C4\u5219\u540E\u679C\u81F3\u5C11\u4E00\u9879\u3002",
    nextHandoff: task.chapterNumber >= state.plan.totalChapters ? "\u628A\u5168\u4E66\u6838\u5FC3\u627F\u8BFA\u5151\u73B0\u4E3A\u7ED3\u5C40\u4F59\u5473\u3002" : `\u628A\u672C\u7AE0\u4E0D\u53EF\u9006\u53D8\u5316\u4EA4\u7ED9\u7B2C ${task.chapterNumber + 1} \u7AE0\u7EE7\u7EED\u5904\u7406\u3002`,
    requiredContinuityAnchors: task.chapterNumber <= 1 ? ["\u4E3B\u89D2\u552F\u4E00\u8EAB\u4EFD", "\u6838\u5FC3\u7F3A\u53E3", "\u7B2C\u4E00\u679A\u4E3B\u7EBF\u7EBF\u7D22"] : ["\u4E0A\u4E00\u7AE0\u5173\u952E\u7269\u4EF6", "\u4E0A\u4E00\u7AE0\u5173\u7CFB\u53D8\u5316", "\u4E0A\u4E00\u7AE0\u672A\u89E3\u51B3\u95EE\u9898", "\u4E0A\u4E00\u7AE0\u4EE3\u4EF7"],
    characterStateDelta: "\u89D2\u8272\u72B6\u6001\u5FC5\u987B\u53D1\u751F\u53EF\u8FFD\u8E2A\u53D8\u5316\uFF0C\u5E76\u8FDB\u5165\u8BB0\u5FC6\u8D26\u672C\u3002",
    foreshadowingOperation: "\u65B0\u589E\u3001\u63A8\u8FDB\u6216\u56DE\u6536\u4E00\u4E2A\u53EF\u8FFD\u8E2A\u4F0F\u7B14\uFF0C\u5E76\u660E\u786E\u5B83\u4E0E\u4E3B\u7EBF\u6216\u89D2\u8272\u4F24\u53E3\u7684\u5173\u7CFB\u3002"
  };
}
function getTaskCausalPlan(state, task) {
  return {
    ...defaultCausalPlan(state, task),
    ...task.causalPlan || {},
    requiredContinuityAnchors: task.causalPlan?.requiredContinuityAnchors?.length ? task.causalPlan.requiredContinuityAnchors : defaultCausalPlan(state, task).requiredContinuityAnchors
  };
}
function formatCausalPlanBullets(state, task) {
  const causalPlan = getTaskCausalPlan(state, task);
  return [
    `- Previous Input: ${causalPlan.previousInput}`,
    `- Causal Objective: ${causalPlan.sceneObjective}`,
    `- Protagonist Decision: ${causalPlan.protagonistDecision}`,
    `- Irreversible Change: ${causalPlan.irreversibleConsequence}`,
    `- Character State Delta: ${causalPlan.characterStateDelta}`,
    `- Required Continuity Anchors: ${causalPlan.requiredContinuityAnchors.join("\u3001")}`,
    `- Foreshadowing Operation: ${causalPlan.foreshadowingOperation}`,
    `- Next Chapter Handoff: ${causalPlan.nextHandoff}`
  ];
}
function formatChapterCausalityMatrix(state, limit = Number.POSITIVE_INFINITY) {
  const tasks = state.plan.chapterTasks.slice(0, limit);
  return [
    "| Chapter | Previous Input | Causal Objective | Protagonist Decision | Irreversible Change | Next Handoff | Required Anchors |",
    "|---:|---|---|---|---|---|---|",
    ...tasks.map((task) => {
      const plan = getTaskCausalPlan(state, task);
      return `| ${task.chapterNumber} | ${plan.previousInput} | ${plan.sceneObjective} | ${plan.protagonistDecision} | ${plan.irreversibleConsequence} | ${plan.nextHandoff} | ${plan.requiredContinuityAnchors.join("\u3001")} |`;
    }),
    state.plan.chapterTasks.length > limit ? `| ... | \u5176\u4F59\u7AE0\u8282\u9075\u5FAA\u540C\u4E00\u627F\u63A5-\u9009\u62E9-\u4EE3\u4EF7-\u4EA4\u68D2\u5408\u540C\uFF0C\u5B8C\u6574\u4EFB\u52A1\u5728 state.chapterTasks \u4E2D\u3002 |  |  |  |  |  |` : ""
  ].filter(Boolean);
}
function formatContinuityAnchorPlan(state, limit = Number.POSITIVE_INFINITY) {
  return state.plan.chapterTasks.slice(0, limit).map((task) => {
    const plan = getTaskCausalPlan(state, task);
    return `- \u7B2C ${task.chapterNumber} \u7AE0\uFF1A\u5FC5\u987B\u4F7F\u7528/\u5EFA\u7ACB ${plan.requiredContinuityAnchors.join("\u3001")}\uFF1B\u5199\u5B8C\u540E Memory Keeper \u8F93\u51FA\u4E0B\u4E00\u7AE0\u53EF\u8FFD\u8E2A\u951A\u70B9\u3002`;
  });
}
function formatCharacterStateLedgerPlan(state, limit = Number.POSITIVE_INFINITY) {
  return state.plan.chapterTasks.slice(0, limit).map((task) => {
    const plan = getTaskCausalPlan(state, task);
    return `- \u7B2C ${task.chapterNumber} \u7AE0\uFF1A${plan.characterStateDelta}`;
  });
}
function formatForeshadowingPayoffSchedule(state, limit = Number.POSITIVE_INFINITY) {
  return state.plan.chapterTasks.slice(0, limit).map((task) => {
    const plan = getTaskCausalPlan(state, task);
    return `- \u7B2C ${task.chapterNumber} \u7AE0\uFF1A${plan.foreshadowingOperation}`;
  });
}
function hasCausalBlueprint(blueprint = "") {
  return blueprint.includes("# Detailed Chapter Blueprint") && blueprint.includes("## Previous Inputs") && blueprint.includes("## Causal Objective") && blueprint.includes("## Irreversible Change") && blueprint.includes("## Character State Delta") && blueprint.includes("## Required Continuity Anchors") && blueprint.includes("## Next Chapter Handoff");
}
function uniqueStrings(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function lockedProtagonistFromState(state, protagonistProfile = "") {
  return state.plan.chapterTasks.map((candidate) => candidate.qualityGate?.reason?.match(/沿用「([^」]+)」|首章候选主角识别为「([^」]+)」/u)).map((match) => match?.[1] || match?.[2] || "").find(Boolean) || inferLockedProtagonistName(protagonistProfile);
}
var CHARACTER_PROFILE_REQUIRED_FIELDS = [
  "\u8EAB\u4EFD/\u89D2\u8272\u529F\u80FD",
  "\u6838\u5FC3\u6B32\u671B",
  "\u6050\u60E7/\u4F24\u53E3",
  "\u884C\u4E3A\u4E60\u60EF",
  "\u8BF4\u8BDD\u65B9\u5F0F",
  "\u5916\u8C8C\u4F53\u6001",
  "\u7279\u957F/\u77ED\u677F",
  "\u5173\u7CFB\u7F51\u7EDC",
  "\u7AE0\u8282\u72B6\u6001\u53D8\u5316"
];
function buildCharacterProfileContract(input) {
  const source = [
    input.protagonistProfile || "",
    input.previousMemory || "",
    input.previousFinalDraft || "",
    input.blueprint || "",
    input.continuityContract.characterLedger
  ].join("\n\n");
  const knownCast = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.knownCast,
    ...extractChinesePersonNames(source, 40)
  ].filter(Boolean)).slice(0, 24);
  const fieldPatterns = [
    ["\u8EAB\u4EFD/\u89D2\u8272\u529F\u80FD", /身份|职业|地位|立场|角色功能|阵营|出身/u],
    ["\u6838\u5FC3\u6B32\u671B", /欲望|目标|想要|渴望|执念|野心|追求/u],
    ["\u6050\u60E7/\u4F24\u53E3", /恐惧|害怕|伤口|创伤|弱点|阴影|亏欠|羞耻/u],
    ["\u884C\u4E3A\u4E60\u60EF", /习惯|动作|小动作|姿态|惯常|总会|下意识/u],
    ["\u8BF4\u8BDD\u65B9\u5F0F", /说话|口头禅|语气|措辞|对白|声线|称呼/u],
    ["\u5916\u8C8C\u4F53\u6001", /外貌|体型|身形|样貌|五官|衣着|气味|疤|眼神/u],
    ["\u7279\u957F/\u77ED\u677F", /特长|能力|擅长|短板|缺陷|边界|代价|不能/u],
    ["\u5173\u7CFB\u7F51\u7EDC", /关系|亲属|朋友|敌人|同盟|债务|信任|背叛/u],
    ["\u7AE0\u8282\u72B6\u6001\u53D8\u5316", /变化|成长|状态|本章|上一章|代价|选择|转变/u]
  ];
  const missingSignals = fieldPatterns.filter(([, pattern]) => !pattern.test(source)).map(([field]) => field);
  const hasLockedProtagonist = input.task.chapterNumber === 1 || Boolean(input.continuityContract.lockedProtagonistName);
  const hasAnyCast = knownCast.length > 0;
  const status = !hasLockedProtagonist ? "blocked" : missingSignals.length > 4 || !hasAnyCast ? "needs_enrichment" : "ready";
  const profileBrief = [
    `Locked protagonist: ${input.continuityContract.lockedProtagonistName || "(first chapter pending)"}`,
    knownCast.length ? `Known cast: ${knownCast.slice(0, 12).join("\u3001")}` : "Known cast: none",
    `Missing profile signals: ${missingSignals.length ? missingSignals.join("\u3001") : "none"}`,
    source.split("\n").map((line) => line.trim()).filter((line) => line && /主角|配角|人物|角色|关系|性格|习惯|外貌|体型|欲望|伤口|特长|短板|状态/u.test(line)).slice(0, 14).join("\n")
  ].filter(Boolean).join("\n");
  const prompt = [
    "## Character Profile Contract",
    "",
    `Status: ${status}`,
    "",
    "### Required Character Fields",
    ...CHARACTER_PROFILE_REQUIRED_FIELDS.map((field) => `- ${field}`),
    "",
    "### Production Rules",
    "- \u6BCF\u4E2A\u91CD\u8981\u89D2\u8272\u90FD\u5FC5\u987B\u6709\u6B32\u671B\u3001\u6050\u60E7/\u4F24\u53E3\u3001\u884C\u4E3A\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u5916\u8C8C\u4F53\u6001\u3001\u7279\u957F\u77ED\u677F\u548C\u5173\u7CFB\u72B6\u6001\u3002",
    "- \u65B0\u589E\u914D\u89D2\u5FC5\u987B\u8BF4\u660E\u8EAB\u4EFD\u3001\u7ACB\u573A\u3001\u4E0E\u4E3B\u89D2\u5173\u7CFB\u3001\u53EF\u8BB0\u5FC6\u7279\u5F81\u548C\u672C\u7AE0\u72B6\u6001\u53D8\u5316\u3002",
    "- \u89D2\u8272\u4E0D\u80FD\u53EA\u7528\u6807\u7B7E\u533A\u5206\uFF0C\u4F8B\u5982\u51B7\u9177\u3001\u5584\u826F\u3001\u806A\u660E\uFF1B\u5FC5\u987B\u901A\u8FC7\u52A8\u4F5C\u3001\u9009\u62E9\u3001\u8BDD\u8BED\u4E60\u60EF\u548C\u5173\u7CFB\u538B\u529B\u5448\u73B0\u3002",
    "- \u5BF9\u767D\u5FC5\u987B\u4F53\u73B0\u4EBA\u7269\u8EAB\u4EFD\u3001\u5173\u7CFB\u548C\u5F53\u524D\u5229\u76CA\uFF0C\u4E0D\u5F97\u6240\u6709\u89D2\u8272\u4F7F\u7528\u540C\u4E00\u79CD\u89E3\u91CA\u8154\u3002",
    "- Memory Keeper \u5FC5\u987B\u628A\u672C\u7AE0\u65B0\u589E/\u53D8\u5316\u7684\u89D2\u8272\u6863\u6848\u5B57\u6BB5\u5199\u5165\u8BB0\u5FC6\u66F4\u65B0\u3002",
    "",
    "### Known Cast",
    ...knownCast.length ? knownCast.map((name) => `- ${name}`) : ["- \u9996\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u552F\u4E00\u4E3B\u89D2\u548C\u81F3\u5C11\u4E00\u4E2A\u53EF\u8FFD\u8E2A\u5173\u7CFB\u5BF9\u8C61\u3002"],
    "",
    "### Missing Signals",
    ...missingSignals.length ? missingSignals.map((field) => `- ${field}`) : ["- none"],
    "",
    "### Profile Brief",
    profileBrief || "- \u6682\u65E0\u89D2\u8272\u6863\u6848\u6B63\u6587\uFF1B\u672C\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u53EF\u8FFD\u8E2A\u89D2\u8272\u6863\u6848\u3002"
  ].join("\n");
  return {
    status,
    requiredFields: CHARACTER_PROFILE_REQUIRED_FIELDS,
    knownCast,
    missingSignals,
    profileBrief,
    prompt
  };
}
function evaluateCharacterProfilePresence(draft, contract) {
  const checks = [
    ["\u6B32\u671B/\u76EE\u6807", /想要|必须|不能|目标|渴望|执念|为了|打算|决定/u],
    ["\u884C\u4E3A\u4E60\u60EF/\u52A8\u4F5C", /抬手|低头|停顿|皱眉|握住|松开|避开|看向|转身|下意识/u],
    ["\u8BF4\u8BDD\u65B9\u5F0F/\u5173\u7CFB\u79F0\u547C", /「|“|说|问|道|喊|低声|冷笑|称呼|先生|大人|姑娘|兄|姐|叔|娘/u],
    ["\u5916\u8C8C\u4F53\u6001/\u53EF\u89C1\u7279\u5F81", /身形|背影|眼神|眉|手指|衣|袖|肩|疤|脸色|脚步|声音/u],
    ["\u7279\u957F\u77ED\u677F/\u80FD\u529B\u8FB9\u754C", /擅长|不会|不能|只好|代价|短板|弱点|本事|能力|失手/u],
    ["\u5173\u7CFB\u72B6\u6001", /信任|怀疑|欠|救|骗|敌|同伴|关系|站在|背叛|帮|拦/u]
  ];
  const missing = checks.filter(([, pattern]) => !pattern.test(draft)).map(([label]) => label);
  const knownNameHits = contract.knownCast.filter((name) => name && draft.includes(name)).slice(0, 12);
  if (contract.status === "blocked") {
    return {
      status: "quarantined",
      reason: "\u89D2\u8272\u6863\u6848\u5408\u540C\u963B\u585E\uFF1A\u540E\u7EED\u7AE0\u8282\u7F3A\u5C11\u9501\u5B9A\u4E3B\u89D2\uFF0C\u65E0\u6CD5\u4FDD\u8BC1\u4EBA\u7269\u8FDE\u7EED\u6027\u3002",
      missing,
      knownNameHits
    };
  }
  if (knownNameHits.length === 0 && contract.knownCast.length > 0) {
    return {
      status: "quarantined",
      reason: `\u89D2\u8272\u6863\u6848\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u6B63\u6587\u672A\u547D\u4E2D\u5DF2\u77E5\u89D2\u8272 ${contract.knownCast.slice(0, 6).join("\u3001")}\u3002`,
      missing,
      knownNameHits
    };
  }
  if (missing.length >= 4) {
    return {
      status: "quarantined",
      reason: `\u89D2\u8272\u9C9C\u660E\u5EA6\u4E0D\u8DB3\uFF1A\u7F3A\u5C11 ${missing.join("\u3001")} \u7B49\u53EF\u89C1\u4FE1\u53F7\uFF0C\u4EBA\u7269\u5BB9\u6613\u523B\u677F\u3002`,
      missing,
      knownNameHits
    };
  }
  return {
    status: "eligible",
    reason: missing.length ? `\u89D2\u8272\u6863\u6848\u57FA\u672C\u53EF\u7528\uFF0C\u4F46\u8FD8\u5E94\u8865\u5F3A\uFF1A${missing.join("\u3001")}\u3002` : "\u89D2\u8272\u6863\u6848\u4FE1\u53F7\u901A\u8FC7\uFF1A\u6B63\u6587\u5305\u542B\u6B32\u671B\u3001\u884C\u4E3A\u3001\u5BF9\u767D\u3001\u5173\u7CFB\u548C\u53EF\u89C1\u7279\u5F81\u3002",
    missing,
    knownNameHits
  };
}
function extractLedgerLines(text = "", limit = 10) {
  return text.split("\n").map((line) => line.trim()).filter((line) => /^[-*]\s+/u.test(line) || /^#{2,}\s+/u.test(line)).filter((line) => /主角|配角|人物|角色|关系|伏笔|线索|回收|状态|选择|代价|目标|冲突|Chapter|Summary|Foreshadowing|Character/iu.test(line)).slice(0, limit);
}
function createContinuityContract(input) {
  const state = input.state;
  const task = input.task;
  const protagonistProfile = input.protagonistProfile || input.context?.protagonist || "";
  const lockedProtagonistName = lockedProtagonistFromState(state, protagonistProfile);
  const priorCompletedTasks = state.plan.chapterTasks.filter(
    (candidate) => candidate.chapterNumber < task.chapterNumber && candidate.status === "complete"
  );
  const previousChapterLedger = priorCompletedTasks.slice(-5).map((candidate) => [
    `\u7B2C ${candidate.chapterNumber} \u7AE0\u300C${candidate.title}\u300D`,
    candidate.summary ? `summary=${candidate.summary}` : "",
    candidate.qualityGate?.reason ? `gate=${candidate.qualityGate.reason}` : ""
  ].filter(Boolean).join("\uFF1B"));
  const contractSource = [
    state.project.title,
    state.project.idea,
    input.context?.consensus || "",
    protagonistProfile,
    input.blueprint || "",
    input.previousMemory || "",
    input.previousFinalDraft || "",
    ...previousChapterLedger
  ].join("\n");
  const knownCast = uniqueStrings(extractChinesePersonNames(contractSource, 40));
  const requiredNames = lockedProtagonistName ? [lockedProtagonistName] : [];
  const continuityAnchors = extractContinuityAnchors({
    text: [
      input.previousMemory || "",
      input.previousFinalDraft || "",
      ...previousChapterLedger
    ].join("\n\n"),
    lockedProtagonistName,
    limit: 10
  });
  const characterLedgerLines = [
    protagonistProfile.trim(),
    input.previousMemory || "",
    input.previousFinalDraft ? `\u4E0A\u4E00\u7AE0\u6B63\u6587\u7247\u6BB5\uFF1A${input.previousFinalDraft.slice(0, 900)}` : ""
  ].filter(Boolean).join("\n\n");
  const characterLedger = extractLedgerLines(characterLedgerLines, 14).join("\n") || characterLedgerLines.slice(0, 1600) || "\u6682\u65E0\u53EF\u7528\u89D2\u8272\u8D26\u672C\uFF1B\u672C\u7AE0\u5FC5\u987B\u5148\u4ECE\u9996\u7AE0\u5EFA\u7ACB\u552F\u4E00\u4E3B\u89D2\uFF0C\u5E76\u5728\u540E\u7EED\u7AE0\u8282\u6CBF\u7528\u3002";
  const foreshadowingLedger = extractLedgerLines([
    input.context?.consensus || "",
    input.blueprint || "",
    input.previousMemory || ""
  ].join("\n"), 12).join("\n") || "\u6682\u65E0\u53EF\u7528\u4F0F\u7B14\u8D26\u672C\uFF1B\u672C\u7AE0\u53EA\u80FD\u65B0\u589E\u660E\u786E\u53EF\u8FFD\u8E2A\u4F0F\u7B14\uFF0C\u4E0D\u80FD\u9057\u5FD8\u524D\u5E8F\u5DF2\u8BB0\u5F55\u627F\u8BFA\u3002";
  const status = task.chapterNumber > 1 && !lockedProtagonistName ? "blocked" : task.chapterNumber === 1 && !lockedProtagonistName ? "needs_first_chapter_lock" : "ready";
  const hardRules = [
    lockedProtagonistName ? `\u9501\u5B9A\u4E3B\u89D2\uFF1A\u672C\u7AE0\u4E3B\u89C6\u89D2\u548C\u4E3B\u7EBF\u884C\u52A8\u5FC5\u987B\u7EE7\u7EED\u4F7F\u7528\u300C${lockedProtagonistName}\u300D\uFF0C\u4E0D\u5F97\u6539\u540D\u3001\u6362\u8EAB\u4EFD\u3001\u6362\u6210\u5176\u4ED6\u4E3B\u89D2\u3002` : "\u9996\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u552F\u4E00\u53EF\u8FFD\u8E2A\u4E3B\u89D2\u59D3\u540D\uFF1B\u540E\u7EED\u7AE0\u8282\u5C06\u628A\u8BE5\u59D3\u540D\u4F5C\u4E3A\u786C\u95E8\u69DB\u3002",
    "\u914D\u89D2\u4E00\u81F4\u6027\uFF1A\u5DF2\u51FA\u73B0\u89D2\u8272\u4E0D\u5F97\u88AB\u540C\u540D\u5F02\u8BBE\u3001\u5F02\u540D\u540C\u804C\u66FF\u6362\uFF1B\u65B0\u589E\u914D\u89D2\u5FC5\u987B\u670D\u52A1\u672C\u7AE0\u84DD\u56FE\uFF0C\u5E76\u5728\u8BB0\u5FC6\u66F4\u65B0\u4E2D\u767B\u8BB0\u8EAB\u4EFD\u3001\u5173\u7CFB\u548C\u72B6\u6001\u3002",
    "\u60C5\u8282\u4E00\u81F4\u6027\uFF1A\u672C\u7AE0\u5FC5\u987B\u627F\u63A5\u4E0A\u4E00\u7AE0\u72B6\u6001\u3001\u4EE3\u4EF7\u3001\u7269\u54C1\u3001\u7EBF\u7D22\u548C\u672A\u89E3\u51B3\u95EE\u9898\uFF1B\u4E0D\u5F97\u8DF3\u8FC7\u5173\u952E\u56E0\u679C\u3002",
    "\u7AE0\u8282\u6865\u63A5\uFF1A\u7B2C 2 \u7AE0\u4EE5\u540E\u5FC5\u987B\u5728\u6B63\u6587\u4E2D\u81EA\u7136\u627F\u63A5 Continuity Anchors\uFF1B\u4E0D\u80FD\u53EA\u590D\u7528\u4E3B\u89D2\u59D3\u540D\u53E6\u8D77\u4E00\u6761\u4E0D\u76F8\u5173\u5267\u60C5\u3002",
    "\u4F0F\u7B14\u4E00\u81F4\u6027\uFF1A\u5DF2\u57CB\u4F0F\u7B14\u53EA\u80FD\u63A8\u8FDB\u3001\u5EF6\u540E\u6216\u56DE\u6536\uFF0C\u4E0D\u5F97\u65E0\u89E3\u91CA\u6D88\u5931\uFF1B\u65B0\u589E\u4F0F\u7B14\u5FC5\u987B\u53EF\u8FFD\u8E2A\u3002",
    "\u4E16\u754C\u89C4\u5219\u4E00\u81F4\u6027\uFF1A\u4E0D\u5F97\u66F4\u6539\u65F6\u4EE3\u3001\u5730\u70B9\u3001\u80FD\u529B\u8FB9\u754C\u3001\u8D44\u6E90\u6761\u4EF6\u548C\u4EBA\u7269\u5DF2\u77E5\u80FD\u529B\u3002",
    "\u5BA1\u9605\u6807\u51C6\uFF1A\u4EFB\u4F55\u4E3B\u89D2\u3001\u914D\u89D2\u3001\u60C5\u8282\u3001\u4F0F\u7B14\u6216\u4E16\u754C\u89C4\u5219\u6F02\u79FB\u90FD\u5FC5\u987B\u5224\u4E3A blocked\uFF0C\u4E0D\u80FD\u56E0\u6587\u7B14\u597D\u800C\u901A\u8FC7\u3002"
  ];
  const prompt = [
    "## Canon Continuity Contract",
    "",
    `Contract status: ${status}`,
    `Locked protagonist: ${lockedProtagonistName || "(\u9996\u7AE0\u5F85\u9501\u5B9A)"}`,
    "",
    "### Hard Rules",
    ...hardRules.map((rule) => `- ${rule}`),
    "",
    "### Required Names",
    ...requiredNames.length ? requiredNames.map((name) => `- ${name}`) : ["- \u9996\u7AE0\u5FC5\u987B\u660E\u786E\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\u3002"],
    "",
    "### Known Cast Candidates",
    ...knownCast.length ? knownCast.slice(0, 24).map((name) => `- ${name}`) : ["- \u6682\u65E0\u3002"],
    "",
    "### Continuity Anchors",
    ...continuityAnchors.length ? continuityAnchors.map((anchor) => `- ${anchor}`) : ["- \u6682\u65E0\u4E0A\u4E00\u7AE0\u951A\u70B9\uFF1B\u672C\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u6216\u7EE7\u7EED\u660E\u786E\u53EF\u8FFD\u8E2A\u60C5\u8282\u7269\u4EF6/\u5173\u7CFB/\u7EBF\u7D22\u3002"],
    "",
    "### Previous Chapter Ledger",
    ...previousChapterLedger.length ? previousChapterLedger.map((line) => `- ${line}`) : ["- \u6682\u65E0\u5DF2\u5B8C\u6210\u524D\u5E8F\u7AE0\u8282\u3002"],
    "",
    "### Character Ledger",
    characterLedger,
    "",
    "### Foreshadowing And Plot Ledger",
    foreshadowingLedger
  ].join("\n");
  return {
    lockedProtagonistName,
    status,
    requiredNames,
    knownCast,
    continuityAnchors,
    previousChapterLedger,
    characterLedger,
    foreshadowingLedger,
    hardRules,
    prompt
  };
}
function ensureMarkdownSection(title, body) {
  const lines = Array.isArray(body) ? body : body.split("\n");
  return [`## ${title}`, "", ...lines.filter((line) => line !== void 0), ""].join("\n");
}
var productionWritingResourcesCache = /* @__PURE__ */ new Map();
function parseVocabularyCatalog(indexText = "") {
  if (!indexText.trim()) return void 0;
  try {
    const parsed = JSON.parse(indexText);
    const entriesByCategory = {};
    const entriesByWord = /* @__PURE__ */ new Map();
    for (const [word, rawEntry] of Object.entries(parsed.word_index || {})) {
      const categories = Array.isArray(rawEntry.categories) ? rawEntry.categories.filter(Boolean) : [];
      const entry = {
        word,
        definition: rawEntry.definition || "",
        categories
      };
      entriesByWord.set(word, entry);
      for (const category of categories) {
        if (!entriesByCategory[category]) {
          entriesByCategory[category] = [];
        }
        if (entriesByCategory[category].length < 5e3) {
          entriesByCategory[category].push(entry);
        }
      }
    }
    return {
      totalWords: Number(parsed.metadata?.total_words || entriesByWord.size),
      entriesByCategory,
      entriesByWord
    };
  } catch {
    return void 0;
  }
}
async function loadProductionWritingResources(rootDir) {
  const workspaceRoot = workspaceRootForProject(rootDir);
  const bundleDir = currentBundleDir();
  const candidates = [
    path3.resolve(bundleDir, "..", "resources", "writing"),
    path3.join(workspaceRoot, "packages", "ai-novel-core", "resources", "writing"),
    path3.join(process.cwd(), "packages", "ai-novel-core", "resources", "writing")
  ];
  const cacheKey = candidates.join("|");
  const cached = productionWritingResourcesCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const loadPromise = (async () => {
    const find = async (relativePath) => {
      for (const candidate of candidates) {
        const text = await readOptionalText(path3.join(candidate, relativePath));
        if (text) return text;
      }
      return "";
    };
    const vocabularyIndex = await find("style/vocabulary/vocabulary_index.json");
    const vocabularyCatalog = parseVocabularyCatalog(vocabularyIndex);
    return {
      styleGuide: await find("style/writing-style-guide.md"),
      chapterPlannerGuide: await find("agents/chapter_planner.md"),
      writerGuide: await find("agents/writer_enhanced.md") || await find("agents/writer.md"),
      editorGuide: await find("agents/editor.md"),
      styleControllerGuide: await find("agents/style_controller.md"),
      consistencyGuide: await find("automation/consistency-check.md"),
      vocabularyIndex: vocabularyCatalog ? `Vocabulary index loaded: ${vocabularyCatalog.totalWords} entries.` : "",
      vocabularySamples: [
        "action_verbs",
        "emotions",
        "environment",
        "court_politics",
        "character_traits"
      ].filter(Boolean),
      vocabularyCatalog,
      examples: [
        await find("examples/chapter-plan-1.md"),
        await find("examples/vocabulary-examples.md"),
        await find("examples/vocabulary-usage-demo.md"),
        await find("examples/classical-chinese-guide.md")
      ].filter(Boolean)
    };
  })();
  productionWritingResourcesCache.set(cacheKey, loadPromise);
  return loadPromise;
}
async function writeProductionWritingResourceArtifacts(projectRoot, paths, state, options = {}) {
  const resources = await loadProductionWritingResources(projectRoot);
  const resourceDir = path3.join(paths.styleDir, "production-resources");
  await fs2.mkdir(resourceDir, { recursive: true });
  const guidePath = path3.join(resourceDir, "production-writing-assets.md");
  const genre = inferGenreProfile(state);
  const content = [
    "# Production Writing Resources",
    "",
    `Project: ${state.project.title}`,
    `Genre profile: ${genre.genre}`,
    "",
    ensureMarkdownSection("Genre Narration Strategy", genre.narration),
    ensureMarkdownSection("Style Guide", resources.styleGuide || "Production style guide not found."),
    ensureMarkdownSection("Chapter Planner Guide", resources.chapterPlannerGuide || "Production chapter planner guide not found."),
    ensureMarkdownSection("Writer Guide", resources.writerGuide || "Production writer guide not found."),
    ensureMarkdownSection("Editor Guide", resources.editorGuide || "Production editor guide not found."),
    ensureMarkdownSection("Style Controller Guide", resources.styleControllerGuide || "Production style controller guide not found."),
    ensureMarkdownSection("Consistency Guide", resources.consistencyGuide || "Production consistency guide not found.")
  ].join("\n");
  await fs2.writeFile(guidePath, content);
  if (options.factoryRootDir && options.projectId) {
    await withFactoryDb(options.factoryRootDir, async (db) => {
      db.recordArtifact({
        projectId: options.projectId,
        kind: "style",
        path: relativeArtifactPath(projectRoot, guidePath),
        status: "completed",
        metadata: { source: "production-resources", genre: genre.genre }
      });
      db.recordMemory(options.projectId, {
        source: "production-writing-resources",
        kind: "style_rulebook",
        content: `Genre: ${genre.genre}
${genre.narration}

${resources.styleGuide.slice(0, 4e3)}`,
        importance: 8,
        metadata: { path: relativeArtifactPath(projectRoot, guidePath) },
        embedding: {
          model: "local-hash-v1",
          vector: createLocalTextEmbedding(`${genre.genre}
${genre.narration}
${resources.styleGuide}`)
        }
      });
      db.createJob({
        projectId: options.projectId,
        kind: "knowledge_global_bootstrap",
        status: "idle",
        payload: {
          scope: "global",
          reason: "production_resources_written",
          limit: process.env.AI_NOVEL_TEST_MODE === "1" ? 4 : void 0
        }
      });
    }).catch(() => void 0);
    await ingestProjectArtifact({
      rootDir: options.factoryRootDir,
      projectId: options.projectId,
      projectRoot,
      artifactPath: relativeArtifactPath(projectRoot, guidePath),
      kind: "style",
      metadata: { source: "production-resources", genre: genre.genre },
      content
    }).catch(() => void 0);
  }
  return { resources, guidePath };
}
function createProductionMasterOutline(state, context, resources) {
  const genre = inferGenreProfile(state);
  const arcSize = Math.max(3, Math.ceil(state.plan.totalChapters / 4));
  const arcs = Array.from({ length: Math.ceil(state.plan.totalChapters / arcSize) }, (_, index) => {
    const start = index * arcSize + 1;
    const end = Math.min(state.plan.totalChapters, start + arcSize - 1);
    return [
      `### \u7B2C ${index + 1} \u5F27\uFF1A\u7B2C ${start}-${end} \u7AE0`,
      `- \u5F27\u7EBF\u76EE\u6807\uFF1A\u628A\u300C${state.project.idea}\u300D\u63A8\u8FDB\u5230\u4E00\u6B21\u660E\u786E\u7684\u538B\u529B\u5347\u7EA7\u3002`,
      "- \u60C5\u7EEA\u529F\u80FD\uFF1A\u5148\u5236\u9020\u7F3A\u53E3\uFF0C\u518D\u7ED9\u51FA\u5C40\u90E8\u5151\u73B0\uFF0C\u6700\u540E\u7559\u4E0B\u66F4\u5927\u95EE\u9898\u3002",
      "- \u4F0F\u7B14\u7B56\u7565\uFF1A\u6BCF\u5F27\u81F3\u5C11\u57CB\u8BBE 2 \u4E2A\u53EF\u56DE\u6536\u7EBF\u7D22\uFF0C\u5E76\u56DE\u6536\u4E0A\u4E00\u5F27\u81F3\u5C11 1 \u4E2A\u627F\u8BFA\u3002",
      "- \u98CE\u683C\u7B56\u7565\uFF1A\u65C1\u767D\u3001\u5BF9\u767D\u548C\u573A\u666F\u5BC6\u5EA6\u5FC5\u987B\u7B26\u5408\u7C7B\u578B\u7B56\u7565\u3002"
    ].join("\n");
  });
  return [
    "# Production Master Outline",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Genre profile: ${genre.genre}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    "",
    "## Story Promise",
    "- \u5168\u4E66\u5FC5\u987B\u6301\u7EED\u5151\u73B0\u539F\u59CB\u521B\u4F5C\u76EE\u6807\uFF0C\u4E0D\u5141\u8BB8\u5728\u65E0\u4EBA\u503C\u5B88\u8FC7\u7A0B\u4E2D\u6F02\u79FB\u5230\u5176\u5B83\u9898\u6750\u3002",
    `- \u7C7B\u578B\u65C1\u767D\u7B56\u7565\uFF1A${genre.narration}`,
    "",
    "## Source Consensus",
    context.consensus || "- \u6682\u65E0\u8BA8\u8BBA\u5171\u8BC6\uFF0C\u4F7F\u7528\u9879\u76EE\u521D\u59CB\u76EE\u6807\u4F5C\u4E3A\u6700\u9AD8\u7EA6\u675F\u3002",
    "",
    "## Character Spine",
    context.protagonist || "- \u4E3B\u89D2\u6863\u6848\u4ECD\u5F85\u7EC6\u5316\uFF1B\u540E\u7EED\u7AE0\u8282\u5FC5\u987B\u6301\u7EED\u8865\u5168\u52A8\u673A\u3001\u4F24\u53E3\u3001\u6B32\u671B\u548C\u53D8\u5316\u3002",
    "",
    "## Causal Spine",
    "- \u5168\u4E66\u4E0D\u662F\u7AE0\u8282\u4E8B\u4EF6\u6E05\u5355\uFF0C\u800C\u662F\u4E00\u6761\u627F\u63A5-\u9009\u62E9-\u4EE3\u4EF7-\u4EA4\u68D2\u94FE\u3002",
    "- \u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F\u4E0A\u4E00\u7AE0\u81F3\u5C11\u4E00\u4E2A\u72B6\u6001/\u7269\u4EF6/\u5173\u7CFB/\u4EE3\u4EF7\uFF0C\u5E76\u628A\u672C\u7AE0\u4E0D\u53EF\u9006\u53D8\u5316\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002",
    "- \u7B2C 2 \u7AE0\u4EE5\u540E\uFF0C\u5982\u679C\u53EA\u6CBF\u7528\u4E3B\u89D2\u59D3\u540D\u4F46\u6CA1\u6709\u627F\u63A5\u524D\u5E8F\u951A\u70B9\uFF0C\u89C6\u4E3A\u4E3B\u7EBF\u65AD\u88C2\u3002",
    "- \u7AE0\u8282\u84DD\u56FE\u5FC5\u987B\u5148\u56DE\u7B54\uFF1A\u4E0A\u4E00\u7AE0\u7ED9\u4E86\u4EC0\u4E48\u538B\u529B\uFF0C\u672C\u7AE0\u63A8\u8FDB\u4EC0\u4E48\uFF0C\u4E3B\u89D2\u505A\u4E86\u4EC0\u4E48\u9009\u62E9\uFF0C\u4EE3\u4EF7\u662F\u4EC0\u4E48\uFF0C\u4E0B\u4E00\u7AE0\u63A5\u4EC0\u4E48\u3002",
    "",
    "## Chapter Causality Matrix",
    ...formatChapterCausalityMatrix(state),
    "",
    "## Continuity Anchor Plan",
    ...formatContinuityAnchorPlan(state),
    "",
    "## Character State Ledger Plan",
    ...formatCharacterStateLedgerPlan(state),
    "",
    "## Foreshadowing Payoff Schedule",
    ...formatForeshadowingPayoffSchedule(state),
    "",
    "## Arc Structure",
    ...arcs,
    "",
    "## Foreshadowing Ledger Policy",
    "- \u6BCF\u7AE0 plan \u5FC5\u987B\u58F0\u660E\u57CB\u8BBE/\u56DE\u6536/\u5EF6\u540E\u4F0F\u7B14\u3002",
    "- \u6BCF\u7AE0\u5199\u5B8C\u540E Memory Keeper \u5FC5\u987B\u66F4\u65B0\u4F0F\u7B14\u72B6\u6001\u3002",
    "",
    "## Quality Policy",
    "- \u6BCF\u7AE0\u5FC5\u987B\u7ECF\u8FC7 Editor\u3001Consistency Checker\u3001Style Controller\u3001Prose Stylist\u3002",
    "- \u4E0D\u8FBE\u6807\u7AE0\u8282\u4E0D\u80FD\u76F4\u63A5\u8FDB\u5165 complete\uFF0C\u53EA\u80FD\u8FDB\u5165\u8FD4\u5DE5\u6216\u963B\u585E\u3002",
    "",
    "## Migrated Writing Assets",
    `- Style guide loaded: ${resources.styleGuide ? "yes" : "no"}`,
    `- Vocabulary resources loaded: ${resources.vocabularySamples.length}`,
    `- Few-shot examples loaded: ${resources.examples.length}`
  ].join("\n");
}
async function createMasterOutlineContent(state, context, resources, options) {
  throwIfPipelineAborted(options);
  const fallback = createProductionMasterOutline(state, context, resources);
  await emitWritingProgress(options, {
    step: "master_planning_started",
    role: "Showrunner",
    status: "started",
    message: "Showrunner \u5F00\u59CB\u628A\u8BA8\u8BBA\u5171\u8BC6\u6574\u7406\u4E3A\u5168\u4E66\u4E3B\u7EBF\u89C4\u5212\u3002",
    preview: [
      `Project: ${state.project.title}`,
      `Target chapters: ${state.plan.totalChapters}`,
      context.consensus ? context.consensus.slice(0, 360) : "\u5C1A\u65E0\u989D\u5916\u5171\u8BC6\u6587\u672C\u3002"
    ].join("\n")
  });
  if (process.env.AI_NOVEL_TEST_MODE === "1" || options.preferDeterministicPlanning) {
    if (options.preferDeterministicPlanning && options.factoryRootDir && options.projectId) {
      await withFactoryDb(options.factoryRootDir, async (db) => {
        db.recordEvent(options.projectId, null, "LLM_FALLBACK_USED", {
          stage: "master_planning",
          reason: "prefer_deterministic_planning",
          fallback: "deterministic_master_outline"
        });
      }).catch(() => void 0);
    }
    await emitWritingProgress(options, {
      step: "master_planning_completed",
      role: "Showrunner",
      status: "completed",
      message: "Showrunner \u5DF2\u751F\u6210\u751F\u4EA7\u7EA7\u5168\u4E66\u4E3B\u7EBF\u89C4\u5212\uFF0C\u540E\u7EED\u5C06\u8FDB\u5165\u7AE0\u8282\u84DD\u56FE\u62C6\u89E3\u3002",
      preview: fallback.slice(0, 520),
      wordCount: wordCount(fallback)
    });
    return fallback;
  }
  const genre = inferGenreProfile(state);
  let generated = "";
  try {
    generated = await generateProductionTextWithLlm({
      roleName: "Showrunner",
      state,
      options,
      basePrompt: [
        "\u4F60\u662F\u751F\u4EA7\u7EA7\u5C0F\u8BF4 Showrunner\uFF0C\u8D1F\u8D23\u628A\u8BA8\u8BBA\u5171\u8BC6\u5347\u7EA7\u4E3A\u53EF\u6267\u884C\u5168\u4E66\u89C4\u5212\u3002",
        "\u5FC5\u987B\u4FDD\u62A4\u539F\u59CB\u521B\u4F5C\u76EE\u6807\uFF0C\u4E0D\u5141\u8BB8\u6F02\u79FB\u9898\u6750\uFF0C\u4E0D\u5141\u8BB8\u76F4\u63A5\u5199\u7AE0\u8282\u6B63\u6587\u3002",
        resources.chapterPlannerGuide || "",
        resources.writerGuide || ""
      ].join("\n\n"),
      dynamicPrompt: [
        `\u76EE\u6807\u7AE0\u8282\u6570\uFF1A${state.plan.totalChapters}`,
        `\u5355\u7AE0\u76EE\u6807\u5B57\u6570\uFF1A${state.plan.chapterWordTarget}`,
        `\u7C7B\u578B\uFF1A${genre.genre}`,
        `\u7C7B\u578B\u65C1\u767D\u7B56\u7565\uFF1A${genre.narration}`,
        "",
        "\u5FC5\u987B\u5305\u542B\u4EE5\u4E0B Markdown \u5C0F\u8282\uFF1A",
        "- # Production Master Outline",
        "- ## Story Promise",
        "- ## Arc Structure",
        "- ## Causal Spine",
        "- ## Chapter Causality Matrix",
        "- ## Continuity Anchor Plan",
        "- ## Character State Ledger Plan",
        "- ## Foreshadowing Payoff Schedule",
        "- ## Character Spine",
        "- ## Foreshadowing Ledger Policy",
        "- ## Quality Policy",
        "- ## Chapter Blueprint Contract",
        "",
        "\u7AE0\u8282\u56E0\u679C\u8981\u6C42\uFF1A",
        "- Chapter Causality Matrix \u5FC5\u987B\u9010\u7AE0\u5217\u51FA Previous Input\u3001Causal Objective\u3001Protagonist Decision\u3001Irreversible Change\u3001Next Handoff\u3002",
        "- \u7B2C 2 \u7AE0\u4EE5\u540E\u5FC5\u987B\u660E\u786E\u627F\u63A5\u4E0A\u4E00\u7AE0\u7684\u72B6\u6001\u3001\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u4EE3\u4EF7\u6216\u672A\u89E3\u51B3\u95EE\u9898\u3002",
        "- \u4E0D\u5141\u8BB8\u628A\u7AE0\u8282\u89C4\u5212\u5199\u6210\u4E92\u4E0D\u76F8\u5E72\u7684\u4E8B\u4EF6\u6E05\u5355\uFF1B\u6BCF\u7AE0\u90FD\u8981\u628A\u672C\u7AE0\u540E\u679C\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002"
      ].join("\n"),
      message: [
        "\u8BF7\u6839\u636E\u9879\u76EE\u76EE\u6807\u3001\u5DF2\u6709\u5171\u8BC6\u3001\u4E3B\u89D2\u8D44\u6599\u548C\u98CE\u683C\u8D44\u6599\uFF0C\u751F\u6210\u751F\u4EA7\u7EA7\u5168\u4E66\u89C4\u5212\u3002",
        "\u4E0D\u8981\u8F93\u51FA\u6CDB\u6CDB\u5EFA\u8BAE\uFF0C\u5FC5\u987B\u7ED9\u51FA\u53EF\u6267\u884C\u5F27\u7EBF\u3001\u9010\u7AE0\u56E0\u679C\u63A8\u8FDB\u3001\u4F0F\u7B14\u3001\u89D2\u8272\u6210\u957F\u548C\u7AE0\u8282\u84DD\u56FE\u7EA6\u675F\u3002",
        "",
        "## Project Goal",
        state.project.idea,
        "",
        "## Consensus",
        context.consensus || "(empty)",
        "",
        "## Protagonist",
        context.protagonist || "(empty)",
        "",
        "## Style",
        context.style || "(empty)",
        "",
        "## Initial Chapter Causality Contract",
        ...formatChapterCausalityMatrix(state)
      ].join("\n"),
      progress: {
        step: "master_planning",
        role: "Showrunner",
        startMessage: "Showrunner \u6B63\u5728\u8C03\u7528\u6A21\u578B\u6269\u5C55\u5168\u4E66\u4E3B\u7EBF\u89C4\u5212\u3002",
        completeMessage: "Showrunner \u5DF2\u8FD4\u56DE\u5168\u4E66\u4E3B\u7EBF\u89C4\u5212\u8349\u6848\u3002"
      }
    });
  } catch (error) {
    if (!/network|fetch|failed|econn|enotfound|etimedout|socket|undici|timeout|timed\s*out|timed-out/i.test(error instanceof Error ? error.message : String(error))) {
      throw error;
    }
    if (options.factoryRootDir && options.projectId) {
      await withFactoryDb(options.factoryRootDir, async (db) => {
        db.recordEvent(options.projectId, null, "LLM_FALLBACK_USED", {
          stage: "master_planning",
          reason: error instanceof Error ? error.message : String(error),
          fallback: "deterministic_master_outline"
        });
      }).catch(() => void 0);
    }
    const fallbackWithNote = `${fallback}

---

## LLM Fallback Note
- Showrunner expansion was deferred because the provider was temporarily unavailable. The deterministic production outline is authoritative for continuing the workflow and can be enriched later.`;
    await emitWritingProgress(options, {
      step: "master_planning_completed",
      role: "Showrunner",
      status: "completed",
      message: "Showrunner \u4F7F\u7528\u53EF\u6062\u590D\u7684\u786E\u5B9A\u6027\u89C4\u5212\u7EE7\u7EED\u63A8\u8FDB\uFF1B\u6A21\u578B\u6062\u590D\u540E\u53EF\u518D\u6269\u5C55\u3002",
      preview: fallbackWithNote.slice(0, 520),
      wordCount: wordCount(fallbackWithNote)
    });
    return fallbackWithNote;
  }
  const result = generated.includes("# Production Master Outline") ? generated : `${fallback}

---

## LLM Showrunner Expansion
${generated}`;
  await emitWritingProgress(options, {
    step: "master_planning_completed",
    role: "Showrunner",
    status: "completed",
    message: "Showrunner \u5DF2\u5B8C\u6210\u5168\u4E66\u4E3B\u7EBF\u89C4\u5212\uFF0C\u540E\u7EED\u5C06\u8FDB\u5165\u7AE0\u8282\u84DD\u56FE\u62C6\u89E3\u3002",
    preview: result.slice(0, 520),
    wordCount: wordCount(result)
  });
  return result;
}
function createDetailedChapterBlueprint(state, task, context, resources, continuityContract = createContinuityContract({ state, task, context })) {
  const genre = inferGenreProfile(state);
  const sceneType = sceneTypeForChapter(state, task.chapterNumber);
  const arcLabel = getArcLabel(state, task.chapterNumber);
  const causalPlan = getTaskCausalPlan(state, task);
  const effectiveAnchors = uniqueStrings([
    ...causalPlan.requiredContinuityAnchors,
    ...continuityContract.continuityAnchors
  ]).slice(0, 10);
  const vocabularyPrompt = createVocabularyUsagePrompt({
    resources,
    state,
    task,
    sceneType,
    continuityContract,
    limit: 20
  });
  const vocabularySkillExamples = createVocabularySkillExamplePrompt(resources, sceneType);
  const resourceManifest = createVocabularyResourceManifest({
    resources,
    state,
    task,
    sceneType,
    continuityContract,
    limit: 12
  });
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    protagonistProfile: context.protagonist,
    continuityContract,
    blueprint: context.consensus
  });
  return [
    "# Detailed Chapter Blueprint",
    "",
    `Project: ${state.project.title}`,
    `Chapter: ${task.chapterNumber}`,
    `Title: ${task.title}`,
    `Arc: ${arcLabel}`,
    `Target words: ${task.targetWords}`,
    `Primary scene type: ${sceneType}`,
    "",
    continuityContract.prompt,
    "",
    characterProfileContract.prompt,
    "",
    "## Chapter Position",
    `- \u672C\u7AE0\u670D\u52A1\u4E8E\uFF1A${state.project.idea}`,
    `- \u5F53\u524D\u5F27\u7EBF\uFF1A${arcLabel}`,
    "- \u672C\u7AE0\u5FC5\u987B\u5B8C\u6210\u4E00\u4E2A\u53EF\u611F\u77E5\u7684\u5267\u60C5\u63A8\u8FDB\uFF0C\u800C\u4E0D\u662F\u53EA\u505A\u8BBE\u5B9A\u8BF4\u660E\u3002",
    "",
    "## Previous Inputs",
    `- ${causalPlan.previousInput}`,
    continuityContract.previousChapterLedger.length ? `- \u524D\u5E8F\u7AE0\u8282\u8D26\u672C\uFF1A${continuityContract.previousChapterLedger.slice(-3).join(" / ")}` : "- \u524D\u5E8F\u7AE0\u8282\u8D26\u672C\uFF1A\u6682\u65E0\u5DF2\u5B8C\u6210\u524D\u5E8F\u7AE0\u8282\uFF0C\u9996\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u540E\u7EED\u53EF\u8FFD\u8E2A\u4E3B\u7EBF\u951A\u70B9\u3002",
    "",
    "## Causal Objective",
    `- ${causalPlan.sceneObjective}`,
    "- \u672C\u7AE0\u4E8B\u4EF6\u5FC5\u987B\u662F\u4E0A\u4E00\u7AE0\u72B6\u6001\u63A8\u52A8\u51FA\u6765\u7684\u7ED3\u679C\uFF0C\u800C\u4E0D\u662F\u6362\u5730\u70B9\u91CD\u65B0\u5F00\u5C40\u3002",
    "",
    "## Protagonist Decision",
    `- ${causalPlan.protagonistDecision}`,
    "",
    "## Irreversible Change",
    `- ${causalPlan.irreversibleConsequence}`,
    "- \u8FD9\u4E2A\u53D8\u5316\u5FC5\u987B\u8FDB\u5165\u7AE0\u672B\u753B\u9762\u6216 Memory Keeper \u8D26\u672C\uFF0C\u4E0B\u4E00\u7AE0\u5FC5\u987B\u80FD\u63A5\u4F4F\u3002",
    "",
    "## Character State Delta",
    `- ${causalPlan.characterStateDelta}`,
    "- \u914D\u89D2\u7684\u4FE1\u4EFB\u3001\u503A\u52A1\u3001\u6050\u60E7\u3001\u9635\u8425\u6216\u5229\u76CA\u53D8\u5316\u4E5F\u5FC5\u987B\u767B\u8BB0\uFF1B\u4E0D\u80FD\u53EA\u8BA9\u4E3B\u89D2\u4E00\u4E2A\u4EBA\u6F02\u6D6E\u63A8\u8FDB\u3002",
    "",
    "## Required Continuity Anchors",
    ...effectiveAnchors.length ? effectiveAnchors.map((anchor) => `- ${anchor}`) : ["- \u6682\u65E0\u4E0A\u4E00\u7AE0\u951A\u70B9\uFF1B\u672C\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u53EF\u8FFD\u8E2A\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u7EBF\u7D22\u6216\u4EE3\u4EF7\u3002"],
    "",
    "## Next Chapter Handoff",
    `- ${causalPlan.nextHandoff}`,
    "- \u7AE0\u672B\u94A9\u5B50\u5FC5\u987B\u662F\u672C\u7AE0\u9009\u62E9\u548C\u4EE3\u4EF7\u81EA\u7136\u4EA7\u751F\u7684\u540E\u679C\uFF0C\u4E0D\u5141\u8BB8\u53EA\u9760\u964C\u751F\u4EBA/\u65B0\u4E8B\u4EF6\u5F3A\u884C\u5F00\u542F\u4E0B\u4E00\u7AE0\u3002",
    "",
    "## Opening Hook",
    "- \u7528\u4E00\u4E2A\u5177\u4F53\u52A8\u4F5C\u3001\u5F02\u5E38\u53D1\u73B0\u3001\u538B\u8FEB\u6027\u9009\u62E9\u6216\u5173\u7CFB\u53D8\u5316\u6253\u5F00\u3002",
    "- \u524D 300 \u5B57\u5185\u8BA9\u8BFB\u8005\u77E5\u9053\u672C\u7AE0\u95EE\u9898\u662F\u4EC0\u4E48\u3002",
    "",
    "## Event Sequence",
    "1. \u5F00\u573A\u538B\u529B\uFF1A\u4E3B\u89D2\u9047\u5230\u65E0\u6CD5\u56DE\u907F\u7684\u5C40\u9762\u3002",
    effectiveAnchors.length ? `2. \u4E0A\u7AE0\u627F\u63A5\uFF1A\u5FC5\u987B\u81EA\u7136\u5E26\u51FA\u8FDE\u7EED\u6027\u951A\u70B9\u300C${effectiveAnchors.slice(0, 4).join("\u3001")}\u300D\u4E2D\u7684\u81F3\u5C11\u4E24\u4E2A\uFF0C\u8BA9\u8BFB\u8005\u770B\u89C1\u56E0\u679C\u5EF6\u7EED\u3002` : "2. \u4E0A\u7AE0\u627F\u63A5\uFF1A\u5982\u679C\u6682\u65E0\u951A\u70B9\uFF0C\u672C\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u53EF\u8FFD\u8E2A\u7269\u4EF6\u3001\u5173\u7CFB\u6216\u7EBF\u7D22\u4F9B\u4E0B\u4E00\u7AE0\u627F\u63A5\u3002",
    "3. \u4FE1\u606F\u53D8\u5316\uFF1A\u4E16\u754C\u89C4\u5219\u3001\u4EBA\u7269\u5173\u7CFB\u6216\u5C40\u52BF\u51FA\u73B0\u65B0\u8BC1\u636E\u3002",
    "4. \u51B2\u7A81\u5347\u7EA7\uFF1A\u4E3B\u89D2\u505A\u51FA\u9009\u62E9\u5E76\u4ED8\u51FA\u4EE3\u4EF7\u3002",
    "5. \u5C40\u90E8\u5151\u73B0\uFF1A\u7ED9\u8BFB\u8005\u4E00\u4E2A\u723D\u70B9\u3001\u53CD\u8F6C\u6216\u60C5\u7EEA\u843D\u70B9\u3002",
    "6. \u7AE0\u672B\u94A9\u5B50\uFF1A\u628A\u95EE\u9898\u63A8\u5411\u4E0B\u4E00\u7AE0\u3002",
    "",
    "## Character Actions",
    "- \u4E3B\u89D2\uFF1A\u5FC5\u987B\u4E3B\u52A8\u9009\u62E9\uFF0C\u4E0D\u80FD\u53EA\u88AB\u5267\u60C5\u63A8\u7740\u8D70\u3002",
    continuityContract.lockedProtagonistName ? `- \u4E3B\u89D2\uFF1A\u672C\u7AE0\u5FC5\u987B\u6CBF\u7528\u300C${continuityContract.lockedProtagonistName}\u300D\u7684\u59D3\u540D\u3001\u8EAB\u4EFD\u3001\u6B32\u671B\u548C\u884C\u4E3A\u903B\u8F91\u3002` : "- \u4E3B\u89D2\uFF1A\u9996\u7AE0\u5FC5\u987B\u660E\u786E\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\uFF0C\u4E14\u5168\u6587\u4E3B\u89C6\u89D2\u53EA\u670D\u52A1\u8FD9\u4E2A\u4E3B\u89D2\u3002",
    "- \u914D\u89D2\uFF1A\u6CBF\u7528 Canon Contract \u4E2D\u5DF2\u767B\u8BB0\u7684\u89D2\u8272\u5173\u7CFB\uFF1B\u65B0\u589E\u914D\u89D2\u5FC5\u987B\u8BF4\u660E\u8EAB\u4EFD\u3001\u7ACB\u573A\u548C\u540E\u7EED\u72B6\u6001\u3002",
    "- \u89D2\u8272\u6863\u6848\uFF1A\u91CD\u8981\u89D2\u8272\u5FC5\u987B\u5177\u5907\u6838\u5FC3\u6B32\u671B\u3001\u6050\u60E7/\u4F24\u53E3\u3001\u884C\u4E3A\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u5916\u8C8C\u4F53\u6001\u3001\u7279\u957F\u77ED\u677F\u548C\u5173\u7CFB\u7F51\u7EDC\u3002",
    "- \u89D2\u8272\u5448\u73B0\uFF1A\u4E0D\u80FD\u53EA\u5199\u201C\u51B7\u9759\u3001\u5584\u826F\u3001\u806A\u660E\u201D\u7B49\u6807\u7B7E\uFF0C\u5FC5\u987B\u901A\u8FC7\u52A8\u4F5C\u3001\u9009\u62E9\u3001\u505C\u987F\u3001\u79F0\u547C\u3001\u89C6\u7EBF\u548C\u5173\u7CFB\u538B\u529B\u4F53\u73B0\u4EBA\u683C\u3002",
    "- \u5BF9\u624B/\u963B\u529B\uFF1A\u5FC5\u987B\u6709\u5408\u7406\u76EE\u6807\uFF0C\u4E0D\u80FD\u53EA\u662F\u5DE5\u5177\u4EBA\u3002",
    "- \u914D\u89D2\uFF1A\u81F3\u5C11\u4E00\u4EBA\u901A\u8FC7\u884C\u52A8\u66B4\u9732\u7ACB\u573A\u6216\u5173\u7CFB\u53D8\u5316\u3002",
    "",
    "## Emotion Curve",
    "- \u5F00\u5934\uFF1A\u7D27\u5F20/\u7591\u95EE\u3002",
    "- \u4E2D\u6BB5\uFF1A\u538B\u529B\u52A0\u6DF1\uFF0C\u4FE1\u606F\u4E0D\u5B8C\u6574\u3002",
    "- \u9AD8\u6F6E\uFF1A\u9009\u62E9\u3001\u4EE3\u4EF7\u3001\u723D\u70B9\u6216\u53CD\u8F6C\u3002",
    "- \u7ED3\u5C3E\uFF1A\u77ED\u6682\u843D\u70B9\u540E\u7559\u4E0B\u66F4\u5F3A\u671F\u5F85\u3002",
    "",
    "## Foreshadowing Operations",
    effectiveAnchors.length ? `- \u627F\u63A5\u951A\u70B9\uFF1A${effectiveAnchors.slice(0, 6).join("\u3001")}\u3002\u6B63\u6587\u5FC5\u987B\u81EA\u7136\u547D\u4E2D\u81F3\u5C11\u4E24\u4E2A\uFF0C\u4E0D\u5F97\u53EA\u5199\u5728\u8BF4\u660E\u91CC\u3002` : "- \u627F\u63A5\u951A\u70B9\uFF1A\u6682\u65E0\u4E0A\u4E00\u7AE0\u951A\u70B9\uFF1B\u672C\u7AE0\u5FC5\u987B\u65B0\u589E\u660E\u786E\u53EF\u8FFD\u8E2A\u7684\u7269\u4EF6/\u7EBF\u7D22/\u5173\u7CFB\u3002",
    `- \u56E0\u679C\u64CD\u4F5C\uFF1A${causalPlan.foreshadowingOperation}`,
    "- \u57CB\u8BBE\uFF1A\u4E00\u4E2A\u4E0E\u4E3B\u7EBF\u6216\u89D2\u8272\u4F24\u53E3\u76F8\u5173\u7684\u7EC6\u8282\u3002",
    "- \u56DE\u6536\uFF1A\u5C3D\u91CF\u56DE\u6536\u524D\u6587\u4E00\u4E2A\u5C0F\u627F\u8BFA\u3002",
    "- \u5EF6\u540E\uFF1A\u6807\u8BB0\u4E00\u4E2A\u6682\u4E0D\u89E3\u91CA\u7684\u98CE\u9669\u70B9\u3002",
    "",
    "## Genre Narration",
    `- \u7C7B\u578B\uFF1A${genre.genre}`,
    `- \u65C1\u767D\u7B56\u7565\uFF1A${genre.narration}`,
    "",
    "## Vocabulary And Idiom Strategy",
    vocabularyPrompt,
    "",
    vocabularySkillExamples,
    "",
    resourceManifest,
    "- \u6587\u8A00\u6BD4\u4F8B\u6309\u573A\u666F\u63A7\u5236\uFF0C\u4FDD\u6301\u53EF\u8BFB\u6027\u3002",
    "- \u7981\u6B62\u5355\u5B57/\u77ED\u8BCD\u72EC\u7ACB\u6210\u884C\u53CD\u590D\u51FA\u73B0\uFF1B\u4E0D\u8981\u7528\u300C\u51B7\u3002\u9759\u3002\u6697\u3002\u75BC\u3002\u300D\u8FD9\u7C7B\u788E\u7247\u6A21\u62DF\u6C1B\u56F4\u3002",
    "- \u6BCF\u4E2A\u573A\u666F\u63CF\u5199\u5FC5\u987B\u662F\u5B8C\u6574\u52A8\u4F5C\u3001\u611F\u5B98\u548C\u56E0\u679C\u53E5\uFF1B\u77ED\u53E5\u53EA\u80FD\u5076\u5C14\u7528\u4E8E\u771F\u6B63\u7684\u8282\u594F\u65AD\u70B9\u3002",
    "",
    "## Resource Usage Plan",
    "- \u5217\u51FA\u672C\u7AE0\u5C06\u81EA\u7136\u5438\u6536\u7684\u573A\u666F\u3001\u60C5\u8282\u3001\u8BCD\u6C47/\u6210\u8BED\u548C\u65C1\u767D\u8D44\u6E90\u3002",
    "- \u81F3\u5C11 3 \u4E2A\u8D44\u6E90\u70B9\u5FC5\u987B\u843D\u5230\u5177\u4F53\u573A\u666F\u6216\u5BF9\u767D\u91CC\uFF0C\u4E0D\u80FD\u53EA\u5199\u5728\u8BF4\u660E\u4E2D\u3002",
    "",
    "## Quality Gates",
    continuityContract.lockedProtagonistName ? `- \u4E3B\u89D2\u4E00\u81F4\u6027\uFF1A\u6B63\u6587\u5FC5\u987B\u51FA\u73B0\u5E76\u6301\u7EED\u56F4\u7ED5\u300C${continuityContract.lockedProtagonistName}\u300D\uFF0C\u4E0D\u5F97\u628A\u7AE0\u8282\u5199\u6210\u53E6\u4E00\u6761\u6545\u4E8B\u7EBF\u3002` : "- \u4E3B\u89D2\u4E00\u81F4\u6027\uFF1A\u9996\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u552F\u4E00\u53EF\u8FFD\u8E2A\u4E3B\u89D2\u59D3\u540D\u3002",
    "- \u914D\u89D2\u4E00\u81F4\u6027\uFF1A\u4E0D\u5F97\u628A\u65E2\u6709\u914D\u89D2\u6539\u540D\u3001\u6539\u8EAB\u4EFD\u6216\u65E0\u56E0\u679C\u66FF\u6362\u3002",
    "- \u89D2\u8272\u9C9C\u660E\u5EA6\uFF1A\u6B63\u6587\u5FC5\u987B\u5448\u73B0\u89D2\u8272\u6B32\u671B\u3001\u884C\u4E3A\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u5916\u8C8C\u4F53\u6001\u3001\u7279\u957F\u77ED\u677F\u548C\u5173\u7CFB\u72B6\u6001\u4E2D\u7684\u591A\u6570\u4FE1\u53F7\u3002",
    "- \u60C5\u8282\u8FDE\u7EED\u6027\uFF1A\u5FC5\u987B\u627F\u63A5 Canon Contract \u4E2D\u7684\u524D\u5E8F\u7AE0\u8282\u8D26\u672C\u548C\u4F0F\u7B14\u8D26\u672C\u3002",
    "- \u56E0\u679C\u63A8\u8FDB\uFF1A\u5FC5\u987B\u6267\u884C Previous Inputs / Causal Objective / Irreversible Change / Next Chapter Handoff\uFF0C\u7F3A\u4E00\u9879\u5373\u89C6\u4E3A\u6D41\u6C34\u8D26\u3002",
    "- \u8FDE\u7EED\u6027\u951A\u70B9\uFF1A\u7B2C 2 \u7AE0\u4EE5\u540E\u6B63\u6587\u5FC5\u987B\u547D\u4E2D\u81F3\u5C11\u4E24\u4E2A Continuity Anchors\uFF0C\u5426\u5219\u89C6\u4E3A\u53E6\u8D77\u5267\u60C5\u3002",
    "- \u7AE0\u8282\u8FDE\u7EED\u6027\uFF1A\u4E0D\u5F97\u8DF3\u7AE0\uFF0C\u4E0D\u5F97\u4E0E\u524D\u5E8F\u7AE0\u8282\u51B2\u7A81\u3002",
    "- \u5199\u4F5C\u8D44\u6E90\uFF1A\u5FC5\u987B\u80FD\u770B\u51FA\u672C\u7AE0\u5438\u6536\u4E86\u573A\u666F\u3001\u60C5\u8282\u3001\u6210\u8BED/\u8BCD\u6C47\u548C\u98CE\u683C\u8D44\u6E90\u3002",
    "- \u53BB AI \u5473\u786C\u95E8\u69DB\uFF1A\u4E0D\u5F97\u51FA\u73B0\u9AD8\u9891\u5355\u5B57/\u77ED\u8BCD\u788E\u7247\u5316\u63CF\u5199\uFF0C\u4E0D\u5F97\u628A\u63A8\u8350\u8BCD\u5B64\u96F6\u96F6\u5806\u6210\u573A\u666F\u3002",
    "- \u6B63\u6587\u6BD4\u4F8B\uFF1A\u5FC5\u987B\u662F\u53EF\u9605\u8BFB\u6B63\u6587\uFF0C\u4E0D\u5F97\u7528\u8BA1\u5212\u3001\u6458\u8981\u3001\u4FEE\u6539\u8BF4\u660E\u5145\u5F53\u6B63\u6587\u3002",
    "",
    "## Drafting Risks",
    "- \u4E0D\u5F97\u5199\u6210\u5267\u60C5\u6458\u8981\u3002",
    "- \u4E0D\u5F97\u8DF3\u5230\u5176\u5B83\u7AE0\u8282\u3002",
    "- \u4E0D\u5F97\u6539\u53D8\u5DF2\u51BB\u7ED3\u8BBE\u5B9A\u3002",
    "- \u4E0D\u5F97\u7528\u6A21\u677F\u5316 AI \u53E5\u5F0F\u53CD\u590D\u89E3\u91CA\u60C5\u7EEA\u3002",
    "",
    `Current task summary: ${task.summary}`,
    context.consensus ? `
## Consensus Carryover
${context.consensus.slice(0, 1200)}` : "",
    context.protagonist ? `
## Protagonist Carryover
${context.protagonist.slice(0, 900)}` : "",
    context.style ? `
## Style Carryover
${context.style.slice(0, 900)}` : ""
  ].filter(Boolean).join("\n");
}
async function createChapterBlueprintContent(state, task, context, resources, options) {
  throwIfPipelineAborted(options);
  const continuityContract = createContinuityContract({ state, task, context });
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    protagonistProfile: context.protagonist,
    continuityContract
  });
  const fallback = createDetailedChapterBlueprint(state, task, context, resources, continuityContract);
  await emitWritingProgress(options, {
    step: "chapter_blueprint_started",
    role: "Chapter Planner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "started",
    message: `Chapter Planner \u5F00\u59CB\u62C6\u89E3\u7B2C ${task.chapterNumber} \u7AE0\u84DD\u56FE\u3002`,
    preview: task.summary
  });
  const genre = inferGenreProfile(state);
  const sceneType = sceneTypeForChapter(state, task.chapterNumber);
  const causalPlan = getTaskCausalPlan(state, task);
  const knowledgeContext = await retrieveWritingKnowledgeContext({
    state,
    task,
    options,
    purpose: "blueprint",
    query: `\u7AE0\u8282\u84DD\u56FE ${sceneType} \u8BCD\u6C47 \u6210\u8BED \u573A\u666F \u60C5\u8282 \u4F0F\u7B14 \u4E3B\u89D2\u4E00\u81F4\u6027`,
    sourceTypes: ["vocabulary", "example", "style_guide", "plan", "memory", "consensus"],
    limit: 8
  });
  const vocabularyPrompt = createVocabularyUsagePrompt({
    resources,
    state,
    task,
    sceneType,
    continuityContract,
    limit: 20
  });
  await emitWritingKnowledgeRecallProgress({
    options,
    purpose: "blueprint",
    role: "Chapter Planner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    rows: knowledgeContext.rows
  });
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    await emitWritingProgress(options, {
      step: "chapter_blueprint_completed",
      role: "Chapter Planner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: `Chapter Planner \u5DF2\u751F\u6210\u7B2C ${task.chapterNumber} \u7AE0\u53EF\u6267\u884C\u84DD\u56FE\u3002`,
      preview: fallback.slice(0, 520),
      wordCount: wordCount(fallback)
    });
    return fallback;
  }
  const generated = await generateProductionTextWithLlm({
    roleName: "Chapter Planner",
    state,
    options,
    basePrompt: [
      resources.chapterPlannerGuide || "\u4F60\u662F\u7AE0\u8282\u7ED3\u6784\u8BBE\u8BA1\u5E08\u3002",
      "\u4F60\u53EA\u751F\u6210\u7AE0\u8282\u84DD\u56FE\uFF0C\u4E0D\u5199\u5B8C\u6574\u6B63\u6587\u3002",
      "\u6BCF\u7AE0\u5FC5\u987B\u53EF\u6267\u884C\u3001\u53EF\u68C0\u67E5\u3001\u53EF\u4EA4\u7ED9 Author \u5199\u4F5C\u3002"
    ].join("\n\n"),
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${task.title}`,
      `\u76EE\u6807\u5B57\u6570\uFF1A${task.targetWords}`,
      `\u5F27\u7EBF\uFF1A${getArcLabel(state, task.chapterNumber)}`,
      `\u7C7B\u578B\uFF1A${genre.genre}`,
      `\u4E3B\u573A\u666F\u7C7B\u578B\uFF1A${sceneType}`,
      `\u65C1\u767D\u7B56\u7565\uFF1A${genre.narration}`,
      "",
      "\u5FC5\u987B\u5305\u542B\u4EE5\u4E0B Markdown \u5C0F\u8282\uFF1A",
      "- ## Canon Continuity Contract",
      "- # Detailed Chapter Blueprint",
      "- ## Chapter Position",
      "- ## Previous Inputs",
      "- ## Causal Objective",
      "- ## Protagonist Decision",
      "- ## Irreversible Change",
      "- ## Character State Delta",
      "- ## Required Continuity Anchors",
      "- ## Next Chapter Handoff",
      "- ## Opening Hook",
      "- ## Event Sequence",
      "- ## Character Actions",
      "- ## Emotion Curve",
      "- ## Foreshadowing Operations",
      "- ## Genre Narration",
      "- ## Vocabulary And Idiom Strategy",
      "- ## Resource Usage Plan",
      "- ## Quality Gates",
      "",
      vocabularyPrompt,
      "",
      "Knowledge/RAG References:",
      knowledgeContext.prompt,
      "",
      continuityContract.prompt,
      "",
      characterProfileContract.prompt,
      "",
      "\u786C\u6027\u8981\u6C42\uFF1A",
      continuityContract.lockedProtagonistName ? `- \u84DD\u56FE\u5FC5\u987B\u58F0\u660E\u672C\u7AE0\u5982\u4F55\u6CBF\u7528\u300C${continuityContract.lockedProtagonistName}\u300D\uFF0C\u7981\u6B62\u66F4\u6362\u4E3B\u89D2\u59D3\u540D\u6216\u8EAB\u4EFD\u3002` : "- \u9996\u7AE0\u84DD\u56FE\u5FC5\u987B\u58F0\u660E\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\uFF0C\u7981\u6B62\u591A\u4E2A\u5019\u9009\u4E3B\u89D2\u5E76\u884C\u3002",
      "- \u84DD\u56FE\u5FC5\u987B\u58F0\u660E\u5DF2\u77E5\u914D\u89D2\u5982\u4F55\u6CBF\u7528\u3001\u65B0\u589E\u914D\u89D2\u662F\u5426\u5141\u8BB8\u4EE5\u53CA\u5176\u5173\u7CFB\u72B6\u6001\u3002",
      "- \u84DD\u56FE\u5FC5\u987B\u8865\u8DB3\u91CD\u8981\u89D2\u8272\u7684\u6B32\u671B\u3001\u6050\u60E7/\u4F24\u53E3\u3001\u884C\u4E3A\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u5916\u8C8C\u4F53\u6001\u3001\u7279\u957F\u77ED\u677F\u548C\u5173\u7CFB\u538B\u529B\u3002",
      "- \u84DD\u56FE\u5FC5\u987B\u58F0\u660E\u524D\u5E8F\u60C5\u8282\u3001\u7269\u54C1\u3001\u7EBF\u7D22\u3001\u4F0F\u7B14\u7684\u627F\u63A5/\u63A8\u8FDB/\u56DE\u6536\u3002",
      "- \u84DD\u56FE\u5FC5\u987B\u9010\u9879\u843D\u5B9E Previous Inputs\u3001Causal Objective\u3001Protagonist Decision\u3001Irreversible Change\u3001Character State Delta\u3001Next Chapter Handoff\u3002",
      "- \u7B2C 2 \u7AE0\u4EE5\u540E\uFF0C\u5982\u679C\u672C\u7AE0\u53EA\u6CBF\u7528\u4E3B\u89D2\u59D3\u540D\u4F46\u6CA1\u6709\u8BA9\u524D\u5E8F\u951A\u70B9\u8FDB\u5165\u4E8B\u4EF6\u56E0\u679C\uFF0C\u84DD\u56FE\u65E0\u6548\u3002",
      "- \u84DD\u56FE\u5FC5\u987B\u5217\u51FA 3-5 \u4E2A\u6765\u81EA\u5199\u4F5C\u8D44\u6E90/\u8BCD\u6C47\u8D44\u6E90\u7684\u5177\u4F53\u4F7F\u7528\u70B9\u3002",
      "- \u84DD\u56FE\u5FC5\u987B\u7ED9 Author \u53EF\u6267\u884C\u7684\u573A\u666F\u7EC6\u8282\u3001\u60C5\u8282\u63A8\u8FDB\u548C\u68C0\u67E5\u6807\u51C6\u3002"
    ].join("\n"),
    message: [
      "\u8BF7\u4E3A\u8FD9\u4E00\u7AE0\u751F\u6210\u8BE6\u7EC6\u5199\u4F5C\u84DD\u56FE\u3002\u4E0D\u8981\u5199\u6B63\u6587\uFF0C\u4E0D\u8981\u8DF3\u5230\u5176\u4ED6\u7AE0\u8282\u3002",
      "\u84DD\u56FE\u8981\u8DB3\u591F\u7EC6\uFF0C\u540E\u7EED Author \u80FD\u76F4\u63A5\u6309\u5B83\u5199\u51FA\u6B63\u6587\u3002",
      "",
      "## Master/Consensus Context",
      context.consensus || "(empty)",
      "",
      "## Character Context",
      context.protagonist || "(empty)",
      "",
      continuityContract.prompt,
      "",
      characterProfileContract.prompt,
      "",
      "## Style Context",
      context.style || "(empty)",
      "",
      "## Current Task",
      task.summary,
      "",
      "## Causal Chapter Plan",
      ...formatCausalPlanBullets(state, task),
      "",
      "## Required Causal Contract",
      `- Previous Input: ${causalPlan.previousInput}`,
      `- Causal Objective: ${causalPlan.sceneObjective}`,
      `- Irreversible Change: ${causalPlan.irreversibleConsequence}`,
      `- Next Chapter Handoff: ${causalPlan.nextHandoff}`
    ].join("\n"),
    progress: {
      step: "chapter_blueprint",
      role: "Chapter Planner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `Chapter Planner \u6B63\u5728\u8C03\u7528\u6A21\u578B\u751F\u6210\u7B2C ${task.chapterNumber} \u7AE0\u8BE6\u7EC6\u84DD\u56FE\u3002`,
      completeMessage: `Chapter Planner \u5DF2\u8FD4\u56DE\u7B2C ${task.chapterNumber} \u7AE0\u8BE6\u7EC6\u84DD\u56FE\u3002`
    }
  });
  const result = generated.includes("# Detailed Chapter Blueprint") ? generated : `${fallback}

---

## LLM Chapter Planner Expansion
${generated}`;
  await emitWritingProgress(options, {
    step: "chapter_blueprint_completed",
    role: "Chapter Planner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "completed",
    message: `Chapter Planner \u5DF2\u5B8C\u6210\u7B2C ${task.chapterNumber} \u7AE0\u84DD\u56FE\uFF0C\u540E\u7EED\u53EF\u4EA4\u7ED9 Author \u5199\u4F5C\u3002`,
    preview: result.slice(0, 520),
    wordCount: wordCount(result)
  });
  return result;
}
function createDraftBodyFromBlueprint(state, task, blueprint, resources, continuityContract = createContinuityContract({ state, task, blueprint })) {
  const genre = inferGenreProfile(state);
  const sceneType = sceneTypeForChapter(state, task.chapterNumber);
  const vocabularyHints = createDraftVocabularyHints({
    resources,
    state,
    task,
    sceneType,
    blueprint,
    continuityContract,
    limit: 12
  });
  const title = task.title || `\u7B2C ${task.chapterNumber} \u7AE0`;
  const protagonistName = continuityContract.lockedProtagonistName || "\u9996\u7AE0\u4E3B\u89D2";
  const causalPlan = getTaskCausalPlan(state, task);
  const anchorLine = continuityContract.continuityAnchors.length ? `\u524D\u6587\u7559\u4E0B\u7684${continuityContract.continuityAnchors.slice(0, 3).join("\u3001")}\u6CA1\u6709\u6D88\u5931\uFF0C\u5B83\u4EEC\u5148\u540E\u8FDB\u5165\u573A\u666F\uFF0C\u903C\u51FA\u65B0\u7684\u5224\u65AD\u3002` : `\u672C\u7AE0\u5148\u5EFA\u7ACB${causalPlan.requiredContinuityAnchors.slice(0, 3).join("\u3001")}\uFF0C\u8BA9\u540E\u7EED\u7AE0\u8282\u6709\u660E\u786E\u53EF\u8FFD\u8E2A\u7684\u7EBF\u7D22\u3002`;
  const paragraphs = [
    `${title}\u5F00\u573A\u65F6\uFF0C\u538B\u529B\u6CA1\u6709\u5148\u843D\u5728\u65C1\u767D\u91CC\uFF0C\u800C\u662F\u4ECE\u300C${causalPlan.previousInput}\u300D\u843D\u5230${protagonistName}\u5FC5\u987B\u7ACB\u523B\u5904\u7406\u7684\u4E00\u4EF6\u4E8B\u4E0A\u3002\u56DB\u5468\u7684\u7EC6\u8282\u5148\u7ED9\u51FA\u89E6\u611F\u3001\u58F0\u97F3\u548C\u4EBA\u7684\u53CD\u5E94\uFF0C\u8BA9\u8BFB\u8005\u770B\u89C1\u5C40\u9762\u6B63\u5728\u6536\u7D27\u3002`,
    `${protagonistName}\u6CA1\u6709\u505C\u5728\u72B9\u8C6B\u91CC\u3002${anchorLine}\u5BF9\u65B9\u63D0\u51FA\u7684\u8981\u6C42\u3001\u573A\u666F\u91CC\u66B4\u9732\u7684\u5F02\u5E38\u3001\u4EE5\u53CA\u524D\u6587\u7559\u4E0B\u7684\u4E00\u4E2A\u7EC6\u8282\u540C\u65F6\u538B\u8FC7\u6765\uFF0C\u903C\u7740\u4ED6\u505A\u51FA\u9009\u62E9\uFF1A${causalPlan.protagonistDecision}\u8FD9\u4E2A\u9009\u62E9\u4E0D\u5B8C\u7F8E\uFF0C\u5374\u80FD\u770B\u51FA\u4ED6\u548C\u522B\u4EBA\u4E0D\u540C\u3002`,
    `\u4E2D\u6BB5\u7684\u51B2\u7A81\u4E0D\u9760\u89E3\u91CA\u5806\u9AD8\uFF0C\u800C\u9760\u884C\u52A8\u63A8\u8FDB\u3002\u6709\u4EBA\u8BD5\u63A2\uFF0C\u6709\u4EBA\u56DE\u907F\uFF0C\u6709\u4EBA\u628A\u8BDD\u8BF4\u5F97\u5F88\u8F7B\uFF0C\u5374\u628A\u771F\u6B63\u7684\u7ACB\u573A\u85CF\u5728\u505C\u987F\u91CC\u3002\u65C1\u767D\u4FDD\u6301${genre.genre}\u7684\u8D28\u611F\uFF1A${genre.narration}`,
    `\u5F53\u5C40\u52BF\u63A8\u8FDB\u5230\u9AD8\u6F6E\uFF0C${protagonistName}\u7EC8\u4E8E\u6293\u4F4F\u4E00\u4E2A\u88AB\u5FFD\u7565\u7684\u7EBF\u7D22\u3002\u8FD9\u4E2A\u7EBF\u7D22\u4E0E\u672C\u7AE0\u76EE\u6807\u300C${causalPlan.sceneObjective}\u300D\u76F8\u8FDE\uFF0C\u4E5F\u8BA9\u524D\u9762\u770B\u4F3C\u666E\u901A\u7684\u7EC6\u8282\u4EA7\u751F\u610F\u4E49\u3002\u723D\u70B9\u6765\u81EA\u5224\u65AD\u6210\u7ACB\u540E\u7684\u53CD\u51FB\u3001\u5173\u7CFB\u53D8\u5316\u6216\u89C4\u5219\u5151\u73B0\u3002`,
    `\u7AE0\u672B\u4E0D\u628A\u6240\u6709\u7B54\u6848\u8BF4\u5B8C\u3002${causalPlan.irreversibleConsequence}${protagonistName}\u5F97\u5230\u4E00\u4E2A\u5C40\u90E8\u7ED3\u679C\uFF0C\u540C\u65F6\u53D1\u73B0\u66F4\u5927\u7684\u95EE\u9898\u5DF2\u7ECF\u51FA\u73B0\u3002\u6700\u540E\u4E00\u4E2A\u753B\u9762\u8981\u5177\u4F53\uFF0C\u5E76\u628A\u540E\u679C\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\uFF1A${causalPlan.nextHandoff}`
  ];
  const expansion = [];
  let sceneIndex = 0;
  while (wordCount([...paragraphs, ...expansion].join("\n")) < Math.floor(task.targetWords * 0.82)) {
    const hint = vocabularyHints[sceneIndex % Math.max(1, vocabularyHints.length)] || "\u4F7F\u7528\u5177\u4F53\u52A8\u4F5C\u548C\u611F\u5B98\u7EC6\u8282";
    expansion.push(
      `\u8865\u5145\u573A\u666F ${sceneIndex + 1}\uFF1A\u56F4\u7ED5\u300C${hint.replace(/^[-#]\s*/, "").slice(0, 48)}\u300D\u5C55\u5F00\uFF0C\u4F46\u53EA\u81EA\u7136\u5438\u6536\u8868\u8FBE\uFF0C\u4E0D\u673A\u68B0\u5806\u8BCD\u3002\u8BA9\u52A8\u4F5C\u3001\u5BF9\u8BDD\u3001\u5FC3\u7406\u548C\u73AF\u5883\u5F7C\u6B64\u63A8\u52A8\uFF0C\u4FDD\u6301\u7AE0\u8282\u76EE\u6807\u6E05\u6670\u3002${protagonistName}\u5FC5\u987B\u5728\u8FD9\u4E2A\u573A\u666F\u91CC\u505A\u51FA\u4E00\u4E2A\u53EF\u89C1\u9009\u62E9\uFF0C\u9009\u62E9\u5E26\u6765\u65B0\u7684\u5173\u7CFB\u53D8\u5316\u3001\u5C40\u52BF\u538B\u529B\u6216\u540E\u7EED\u94A9\u5B50\u3002`
    );
    sceneIndex += 1;
  }
  return [
    `# ${title}`,
    "",
    "## Draft Body",
    "",
    ...paragraphs,
    "",
    ...expansion,
    "",
    "## Drafting Metadata",
    `- Chapter: ${task.chapterNumber}`,
    `- Target words: ${task.targetWords}`,
    `- Estimated production words: ${wordCount([...paragraphs, ...expansion].join("\n"))}`,
    `- Scene type: ${sceneType}`,
    `- Continuity status: ${continuityContract.status}`,
    `- Locked protagonist: ${continuityContract.lockedProtagonistName || "(first chapter pending)"}`,
    `- Causal objective: ${causalPlan.sceneObjective}`,
    `- Next handoff: ${causalPlan.nextHandoff}`,
    `- Blueprint basis: ${blueprint.includes("Detailed Chapter Blueprint") ? "detailed-blueprint" : "fallback"}`
  ].join("\n\n");
}
async function generateProductionTextWithLlm({
  roleName,
  message,
  basePrompt,
  dynamicPrompt,
  state,
  options,
  progress
}) {
  throwIfPipelineAborted(options);
  let streamedResult = "";
  let lastStreamProgressAt = 0;
  let firstDeltaSeen = false;
  const messageId = progress ? createWritingMessageId(progress) : void 0;
  if (progress) {
    await emitWritingProgress(options, {
      messageId,
      step: `${progress.step}_llm_started`,
      role: progress.role,
      chapterNumber: progress.chapterNumber,
      title: progress.title,
      status: "running",
      phase: "request_sent",
      statusText: "\u8BF7\u6C42\u5DF2\u63D0\u4EA4\u7ED9 LLM\uFF0C\u7B49\u5F85\u6A21\u578B\u5F00\u59CB\u54CD\u5E94\u3002",
      statusDetail: "\u5982\u679C\u6A21\u578B\u6216\u7F51\u7EDC\u6682\u65F6\u6CA1\u6709\u9996\u6BB5\u8FD4\u56DE\uFF0C\u8FD9\u6761\u6D88\u606F\u4F1A\u4FDD\u6301\u52A8\u6001\u7B49\u5F85\u72B6\u6001\u3002",
      message: progress.startMessage,
      preview: [
        `Role: ${roleName}`,
        "",
        dynamicPrompt
      ].join("\n").slice(0, 520)
    });
  }
  try {
    let result = "";
    const maxLlmAttempts = 3;
    let backoffDelay = process.env.AI_NOVEL_TEST_MODE === "1" ? 10 : 2e3;
    for (let i = 1; i <= maxLlmAttempts; i++) {
      try {
        result = await generateAgentReply({
          roleName,
          basePrompt,
          dynamicPrompt,
          consensus: `Project: ${state.project.title}
Core idea: ${state.project.idea}
Current stage: ${state.runtime.stage}`,
          message,
          discussionStage: "specialist_turn",
          currentStage: "drafting",
          preferredLanguage: "zh-CN",
          envRootDir: options.envRootDir || options.factoryRootDir || process.cwd(),
          signal: options.signal,
          onDelta: progress ? async (delta) => {
            streamedResult += delta;
            const now = Date.now();
            const isFirstDelta = !firstDeltaSeen;
            firstDeltaSeen = true;
            if (!isFirstDelta && now - lastStreamProgressAt < 2500) {
              return;
            }
            lastStreamProgressAt = now;
            await emitWritingProgress(options, {
              messageId,
              step: `${progress.step}_llm_streaming`,
              role: progress.role,
              chapterNumber: progress.chapterNumber,
              title: progress.title,
              status: "running",
              phase: isFirstDelta ? "response_started" : "streaming",
              statusText: isFirstDelta ? "LLM \u5DF2\u5F00\u59CB\u54CD\u5E94\uFF0C\u6B63\u5728\u8FD4\u56DE\u9996\u6BB5\u5185\u5BB9\u3002" : "LLM \u6B63\u5728\u6301\u7EED\u8FD4\u56DE\u5185\u5BB9\u3002",
              statusDetail: "\u8FD4\u56DE\u5185\u5BB9\u4F1A\u6301\u7EED\u5408\u5E76\u5230\u8FD9\u4E00\u6761 agent \u6D88\u606F\u4E2D\u3002",
              message: `${progress.startMessage}\u6A21\u578B\u6B63\u5728\u6301\u7EED\u8F93\u51FA\u3002`,
              preview: streamedResult.slice(-520),
              streamText: streamedResult,
              wordCount: wordCount(streamedResult)
            });
          } : void 0
        });
        break;
      } catch (error) {
        if (i === maxLlmAttempts) {
          const providerError = new Error(`Provider API \u8C03\u7528\u5931\u8D25\uFF0C\u5DF2\u91CD\u8BD5 ${maxLlmAttempts} \u6B21\u3002\u8BE6\u7EC6\u9519\u8BEF: ${error instanceof Error ? error.message : String(error)}`);
          providerError.isProviderFailure = true;
          throw providerError;
        }
        if (progress) {
          await emitWritingProgress(options, {
            messageId,
            step: `${progress.step}_llm_retry`,
            role: progress.role,
            chapterNumber: progress.chapterNumber,
            title: progress.title,
            status: "running",
            message: `\u7F51\u7EDC\u6216 API \u8BF7\u6C42\u5F02\u5E38\uFF0C\u6B63\u5728\u8FDB\u884C\u7B2C ${i} \u6B21\u91CD\u8BD5\uFF08\u7B49\u5F85 ${backoffDelay / 1e3} \u79D2\uFF09... \u9519\u8BEF: ${error instanceof Error ? error.message : String(error)}`
          });
        }
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        backoffDelay *= 2;
      }
    }
    if (progress) {
      throwIfPipelineAborted(options);
      await emitWritingProgress(options, {
        messageId,
        step: `${progress.step}_llm_completed`,
        role: progress.role,
        chapterNumber: progress.chapterNumber,
        title: progress.title,
        status: "completed",
        phase: "completed",
        statusText: "LLM \u8FD4\u56DE\u5B8C\u6210\uFF0C\u5185\u5BB9\u5DF2\u4FDD\u5B58\u5E76\u8FDB\u5165\u4E0B\u4E00\u6B65\u3002",
        message: progress.completeMessage,
        preview: result.slice(0, 520),
        streamText: result,
        wordCount: wordCount(result)
      });
    }
    return result;
  } catch (error) {
    if (progress) {
      await emitWritingProgress(options, {
        messageId,
        step: `${progress.step}_llm_failed`,
        role: progress.role,
        chapterNumber: progress.chapterNumber,
        title: progress.title,
        status: "blocked",
        phase: "failed",
        statusText: "LLM \u8BF7\u6C42\u5931\u8D25\uFF0C\u7CFB\u7EDF\u4F1A\u6309\u4EFB\u52A1\u7B56\u7565\u5904\u7406\u3002",
        message: `${progress.startMessage}\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`
      });
    }
    throw error;
  }
}
async function loadAndPruneGlobalContext(params) {
  const { state, task, blueprint, resources, continuityContract, paths } = params;
  let previousDraftFragment = "";
  const previousChapterId = task.chapterNumber > 1 ? `chapter-${String(task.chapterNumber - 1).padStart(3, "0")}` : "";
  if (paths && previousChapterId) {
    const previousFinalDraft = await readOptionalText(path3.join(paths.chaptersDir, `${previousChapterId}.final.md`));
    if (previousFinalDraft) {
      previousDraftFragment = previousFinalDraft.slice(-1200);
    }
  }
  let rawOutline = "";
  if (paths) {
    rawOutline = await readOptionalText(paths.masterOutlinePath);
  }
  let rawConsensus = "";
  if (paths) {
    rawConsensus = await readOptionalText(paths.consensusPath);
  }
  let rawMemory = "";
  if (paths && previousChapterId) {
    rawMemory = await readOptionalText(path3.join(paths.memoryDir, `${previousChapterId}-memory.md`));
  }
  let rawRag = params.knowledgeContext?.prompt || "";
  let ledgerList = [...continuityContract.previousChapterLedger];
  const MAX_TOTAL_CHARS = 12e3;
  const fixedLength = params.additionalFixedLength ?? 10500;
  const protagonistName = continuityContract.lockedProtagonistName || "";
  const protectedLength = fixedLength + previousDraftFragment.length + protagonistName.length;
  let prunedRag = rawRag;
  let prunedMemory = rawMemory;
  let prunedLedgerList = [...ledgerList];
  let prunedConsensus = rawConsensus;
  let prunedOutline = rawOutline;
  const getDynamicLength = () => {
    const ledgerText = prunedLedgerList.join("\n");
    return prunedRag.length + prunedMemory.length + ledgerText.length + prunedConsensus.length + prunedOutline.length;
  };
  if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
    if (prunedRag.length > 1e3) {
      prunedRag = prunedRag.slice(0, 1e3) + "\n...[RAG \u77E5\u8BC6\u5E93\u56E0 Token \u9650\u5236\u88AB\u88C1\u526A]";
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      if (prunedMemory.length > 800) {
        prunedMemory = prunedMemory.slice(0, 800) + "\n...[\u89D2\u8272\u8BB0\u5FC6\u56E0 Token \u9650\u5236\u88AB\u88C1\u526A]";
      }
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedRag = "";
      prunedMemory = "";
    }
  }
  if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
    while (prunedLedgerList.length > 2 && protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedLedgerList.shift();
    }
    if (prunedLedgerList.length > 1 && protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedLedgerList = [prunedLedgerList[prunedLedgerList.length - 1]];
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedLedgerList = [];
    }
  }
  if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS && prunedConsensus) {
    const keywordSet = /* @__PURE__ */ new Set();
    if (protagonistName) keywordSet.add(protagonistName);
    const matches = blueprint.match(/[\u4e00-\u9fff]{2,5}/g) || [];
    for (const match of matches) {
      if (match.length >= 2 && !/^(章节|章节|标题|字数|类型|旁白|必须|不能|主角|配角|情节|伏笔|如果|这是|需要|进行|已经|这个|但是|因为|所以|或者|没有|可以|我们|他们|你们)$/.test(match)) {
        keywordSet.add(match);
      }
    }
    const blocks = prunedConsensus.split(/\n(?=(?:#+|\d+\.))/g);
    const matchedBlocks = [];
    for (const block of blocks) {
      let isHit = false;
      for (const kw of keywordSet) {
        if (block.includes(kw)) {
          isHit = true;
          break;
        }
      }
      if (isHit) {
        matchedBlocks.push(block);
      }
    }
    if (matchedBlocks.length > 0) {
      prunedConsensus = matchedBlocks.join("\n");
    } else {
      prunedConsensus = prunedConsensus.slice(0, 1500) + "\n...[\u5168\u5C40\u5171\u8BC6\u56E0 Token \u9650\u5236\u88AB\u7F29\u51CF]";
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedConsensus = prunedConsensus.slice(0, 500);
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedConsensus = "";
    }
  }
  if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS && prunedOutline) {
    const currentChapterLabel = `\u7B2C${task.chapterNumber}\u7AE0`;
    const currentChapterLabelAlt = `\u7B2C ${task.chapterNumber} \u7AE0`;
    const lines = prunedOutline.split("\n");
    let targetIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(currentChapterLabel) || lines[i].includes(currentChapterLabelAlt)) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex >= 0) {
      const startLine = Math.max(0, targetIndex - 20);
      const endLine = Math.min(lines.length, targetIndex + 20);
      prunedOutline = [
        "...[\u4E3B\u7EBF\u5927\u7EB2\u524D\u671F\u5DF2\u7701\u7565]",
        ...lines.slice(startLine, endLine),
        "...[\u4E3B\u7EBF\u5927\u7EB2\u540E\u671F\u5DF2\u7701\u7565]"
      ].join("\n");
    } else {
      prunedOutline = prunedOutline.slice(0, 1500) + "\n...[\u4E3B\u7EBF\u5927\u7EB2\u56E0 Token \u9650\u5236\u88AB\u7F29\u51CF]";
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedOutline = prunedOutline.slice(0, 500);
    }
    if (protectedLength + getDynamicLength() > MAX_TOTAL_CHARS) {
      prunedOutline = "";
    }
  }
  return {
    prunedConsensus,
    prunedOutline,
    prunedRag,
    prunedMemory,
    prunedLedger: prunedLedgerList.join("\n"),
    previousDraftFragment
  };
}
function trimBlueprintForDrafting(blueprint) {
  let trimmed = blueprint;
  const carryoverIndex = trimmed.indexOf("## Consensus Carryover");
  if (carryoverIndex > 0) {
    trimmed = trimmed.slice(0, carryoverIndex).trim();
  }
  const vocabIndex = trimmed.indexOf("## Vocabulary And Idiom Strategy");
  if (vocabIndex > 0) {
    trimmed = trimmed.slice(0, vocabIndex).trim();
  }
  return trimmed;
}
async function createDraftBody(state, task, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot) {
  throwIfPipelineAborted(options);
  if (continuityContract.status === "blocked") {
    throw new Error(`Continuity contract is blocked before drafting: chapter ${task.chapterNumber} has no locked protagonist.`);
  }
  const fallback = createDraftBodyFromBlueprint(state, task, blueprint, resources, continuityContract);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    continuityContract,
    previousFinalDraft: blueprint,
    blueprint
  });
  const genre = inferGenreProfile(state);
  const sceneType = sceneTypeForChapter(state, task.chapterNumber);
  const causalPlan = getTaskCausalPlan(state, task);
  const knowledgeContext = await retrieveWritingKnowledgeContext({
    state,
    task,
    options,
    purpose: "draft",
    query: `\u6B63\u6587\u5199\u4F5C ${sceneType} \u6210\u8BED \u8BCD\u6C47 \u573A\u666F\u63CF\u5199 \u524D\u6587\u8BB0\u5FC6 \u4E3B\u89D2\u4E00\u81F4\u6027`,
    sourceTypes: ["vocabulary", "example", "style_guide", "chapter", "plan", "memory", "consensus"],
    limit: 10
  });
  const vocabularyPrompt = createVocabularyUsagePrompt({
    resources,
    state,
    task,
    sceneType,
    blueprint,
    continuityContract,
    limit: 24
  });
  const vocabularySkillExamples = createVocabularySkillExamplePrompt(resources, sceneType);
  const resourceManifest = createVocabularyResourceManifest({
    resources,
    state,
    task,
    sceneType,
    blueprint,
    continuityContract,
    limit: 14
  });
  await emitWritingKnowledgeRecallProgress({
    options,
    purpose: "draft",
    role: "Author",
    chapterNumber: task.chapterNumber,
    title: task.title,
    rows: knowledgeContext.rows
  });
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return fallback;
  }
  const cappedVocabularyPrompt = vocabularyPrompt.slice(0, 1e3);
  const cappedVocabularySkillExamples = vocabularySkillExamples.slice(0, 800);
  const cappedResourceManifest = resourceManifest.slice(0, 500);
  const cappedWriterGuide = (resources.writerGuide || "").slice(0, 2e3);
  const basePromptLines = [
    cappedWriterGuide || "\u4F60\u662F\u5C0F\u8BF4\u6B63\u6587\u521B\u4F5C\u6267\u884C\u8005\u3002",
    "",
    "\u5FC5\u987B\u5199\u6B63\u6587\uFF0C\u4E0D\u8981\u53EA\u5199\u8BA1\u5212\u3001\u6458\u8981\u6216\u5EFA\u8BAE\u3002",
    "\u5FC5\u987B\u4E25\u683C\u9075\u5FAA\u7AE0\u8282\u84DD\u56FE\u3001\u7C7B\u578B\u65C1\u767D\u7B56\u7565\u3001\u6210\u8BED\u5BC6\u5EA6\u4E0E\u89D2\u8272\u5DEE\u5F02\u3002",
    "\u5FC5\u987B\u4E25\u683C\u6267\u884C\u7AE0\u8282\u56E0\u679C\u5408\u540C\uFF1A\u627F\u63A5\u4E0A\u4E00\u7AE0\u8F93\u5165\u3001\u5B8C\u6210\u672C\u7AE0\u76EE\u6807\u3001\u8BA9\u4E3B\u89D2\u505A\u9009\u62E9\u3001\u7559\u4E0B\u4E0D\u53EF\u9006\u53D8\u5316\u3001\u628A\u540E\u679C\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002",
    continuityContract.lockedProtagonistName ? `\u4E3B\u89D2\u4E00\u81F4\u6027\u662F\u786C\u95E8\u69DB\uFF1A\u672C\u7AE0\u5FC5\u987B\u7EE7\u7EED\u4F7F\u7528\u300C${continuityContract.lockedProtagonistName}\u300D\uFF0C\u4E0D\u5F97\u6539\u540D\u3001\u6362\u8EAB\u4EFD\u6216\u5199\u6210\u53E6\u4E00\u6761\u6545\u4E8B\u7EBF\u3002` : "\u4E3B\u89D2\u4E00\u81F4\u6027\u662F\u786C\u95E8\u69DB\uFF1A\u9996\u7AE0\u5FC5\u987B\u660E\u786E\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\uFF0C\u540E\u7EED\u7AE0\u8282\u4F1A\u9501\u5B9A\u8BE5\u59D3\u540D\u3002",
    "\u914D\u89D2\u3001\u60C5\u8282\u3001\u4F0F\u7B14\u548C\u4E16\u754C\u89C4\u5219\u5FC5\u987B\u9075\u5FAA Canon Continuity Contract\u3002",
    "\u89D2\u8272\u6863\u6848\u662F\u751F\u4EA7\u786C\u7EA6\u675F\uFF1A\u91CD\u8981\u89D2\u8272\u5FC5\u987B\u6709\u6B32\u671B\u3001\u4F24\u53E3\u3001\u884C\u4E3A\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u5916\u8C8C\u4F53\u6001\u3001\u7279\u957F\u77ED\u677F\u548C\u5173\u7CFB\u72B6\u6001\u3002",
    "\u7B2C 2 \u7AE0\u4EE5\u540E\u4E0D\u80FD\u53EA\u6CBF\u7528\u4E3B\u89D2\u59D3\u540D\uFF1B\u5FC5\u987B\u8BA9\u4E0A\u4E00\u7AE0\u951A\u70B9\u5728\u6B63\u6587\u4E8B\u4EF6\u4E2D\u53D1\u751F\u4F5C\u7528\u3002",
    "\u7981\u6B62 AI \u5316\u788E\u7247\u5199\u6CD5\uFF1A\u4E0D\u5F97\u8BA9\u5355\u4E2A\u5B57\u6216 1-4 \u5B57\u77ED\u8BCD\u53CD\u590D\u72EC\u7ACB\u6210\u53E5/\u6210\u884C\u5806\u573A\u666F\u3002"
  ];
  const fixedDynamicPromptLines = [
    `\u7AE0\u8282\uFF1A\u7B2C ${task.chapterNumber} \u7AE0`,
    `\u6807\u9898\uFF1A${task.title}`,
    `\u76EE\u6807\u5B57\u6570\uFF1A${task.targetWords}`,
    `\u7C7B\u578B\uFF1A${genre.genre}`,
    `\u573A\u666F\u7C7B\u578B\uFF1A${sceneType}`,
    `\u65C1\u767D\u7B56\u7565\uFF1A${genre.narration}`,
    "",
    cappedVocabularyPrompt,
    "",
    cappedVocabularySkillExamples,
    "",
    cappedResourceManifest,
    "",
    continuityContract.prompt,
    "",
    characterProfileContract.prompt.slice(0, 1800),
    "",
    "\u8D44\u6E90\u4F7F\u7528\u786C\u8981\u6C42\uFF1A",
    "- \u81F3\u5C11\u81EA\u7136\u5438\u6536 3 \u4E2A\u8BCD\u6C47/\u573A\u666F\u8D44\u6E90\u63D0\u793A\uFF0C\u4F46\u4E0D\u80FD\u5806\u780C\u6210\u8BED\u3002",
    "- \u5FC5\u987B\u5B66\u4E60 Migrated Vocabulary Skill Examples \u7684\u6B63\u786E\u793A\u8303\u65B9\u6CD5\uFF1A\u57FA\u7840\u8BCD\u6C47\u5199\u6E05\u5185\u5BB9\uFF0C\u5C11\u91CF\u6210\u8BED\u53EA\u505A\u70B9\u775B\u3002",
    "- \u5FC5\u987B\u907F\u5F00 Anti Patterns\uFF1A\u8FDE\u7EED\u6210\u8BED\u3001\u5B64\u7ACB\u6210\u8BED\u3001\u5355\u5B57\u77ED\u8BCD\u8FDE\u53D1\u3001\u53EA\u6709\u6C1B\u56F4\u6CA1\u6709\u52A8\u4F5C\u3002",
    "- \u573A\u666F\u5FC5\u987B\u6709\u5177\u4F53\u52A8\u4F5C\u3001\u7269\u4EF6\u3001\u6C14\u5473/\u58F0\u97F3/\u89E6\u611F\u4E2D\u7684\u81F3\u5C11\u4E24\u7C7B\u7EC6\u8282\u3002",
    "- \u7AE0\u8282\u5FC5\u987B\u56F4\u7ED5\u84DD\u56FE\u63A8\u8FDB\uFF0C\u4E0D\u5F97\u8F93\u51FA\u4FEE\u6539\u8BF4\u660E\u6216\u6CDB\u5316\u6A21\u677F\u6BB5\u843D\u3002",
    `- Previous Input \u5FC5\u987B\u8FDB\u5165\u5F00\u573A\u6216\u7B2C\u4E00\u573A\u51B2\u7A81\uFF1A${causalPlan.previousInput}`,
    `- Causal Objective \u5FC5\u987B\u5728\u6B63\u6587\u4E2D\u88AB\u4E8B\u4EF6\u63A8\u8FDB\uFF1A${causalPlan.sceneObjective}`,
    `- Protagonist Decision \u5FC5\u987B\u5199\u6210\u53EF\u89C1\u884C\u52A8\uFF1A${causalPlan.protagonistDecision}`,
    `- Irreversible Change \u5FC5\u987B\u6210\u4E3A\u7AE0\u672B\u4E8B\u5B9E\uFF1A${causalPlan.irreversibleConsequence}`,
    `- Next Chapter Handoff \u5FC5\u987B\u4ECE\u672C\u7AE0\u540E\u679C\u81EA\u7136\u4EA7\u751F\uFF1A${causalPlan.nextHandoff}`,
    continuityContract.lockedProtagonistName ? `- \u6B63\u6587\u5FC5\u987B\u591A\u6B21\u56F4\u7ED5\u300C${continuityContract.lockedProtagonistName}\u300D\u7684\u884C\u52A8\u3001\u611F\u77E5 and \u9009\u62E9\u63A8\u8FDB\u3002` : "- \u6B63\u6587\u5FC5\u987B\u660E\u786E\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\uFF0C\u5E76\u4FDD\u6301\u4E3B\u89C6\u89D2\u805A\u7126\u3002",
    "- \u4E0D\u5F97\u51ED\u7A7A\u66FF\u6362\u5DF2\u77E5\u914D\u89D2\uFF1B\u65B0\u589E\u914D\u89D2\u5FC5\u987B\u4EA4\u4EE3\u8EAB\u4EFD\u3001\u7ACB\u573A\u548C\u4E0E\u4E3B\u89D2\u5173\u7CFB\u3002",
    "- \u65B0\u589E\u6216\u6CBF\u7528\u7684\u91CD\u8981\u89D2\u8272\u5FC5\u987B\u901A\u8FC7\u52A8\u4F5C\u3001\u79F0\u547C\u3001\u505C\u987F\u3001\u5916\u8C8C\u4F53\u6001\u3001\u4E60\u60EF\u548C\u5229\u76CA\u9009\u62E9\u5448\u73B0\u4EBA\u683C\uFF0C\u4E0D\u80FD\u53EA\u8D34\u6027\u683C\u6807\u7B7E\u3002",
    "- \u6B63\u6587\u5FC5\u987B\u4F53\u73B0\u81F3\u5C11\u4E00\u4E2A\u89D2\u8272\u7684\u7279\u957F/\u77ED\u677F\u6216\u80FD\u529B\u8FB9\u754C\uFF0C\u4EE5\u53CA\u81F3\u5C11\u4E00\u4E2A\u5173\u7CFB\u72B6\u6001\u53D8\u5316\u3002",
    "- \u5FC5\u987B\u627F\u63A5\u524D\u5E8F\u7AE0\u8282\u8D26\u672C\u4E2D\u7684\u72B6\u6001\u3001\u4EE3\u4EF7\u3001\u7269\u54C1\u3001\u7EBF\u7D22\u6216\u4F0F\u7B14\u3002",
    continuityContract.continuityAnchors.length ? `- \u6B63\u6587\u5FC5\u987B\u81EA\u7136\u547D\u4E2D\u81F3\u5C11\u4E24\u4E2A\u4E0A\u4E00\u7AE0\u8FDE\u7EED\u6027\u951A\u70B9\uFF1A${continuityContract.continuityAnchors.slice(0, 8).join("\u3001")}\u3002` : "- \u6B63\u6587\u5FC5\u987B\u5EFA\u7ACB\u53EF\u4F9B\u4E0B\u4E00\u7AE0\u8FFD\u8E2A\u7684\u5177\u4F53\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u7EBF\u7D22\u6216\u4EE3\u4EF7\u3002",
    "- \u4E0D\u8981\u628A\u63A8\u8350\u8BCD\u3001\u6210\u8BED\u6216\u6C1B\u56F4\u8BCD\u5B64\u7ACB\u6210\u884C\uFF1B\u6240\u6709\u8BCD\u90FD\u5FC5\u987B\u5D4C\u5165\u5B8C\u6574\u52A8\u4F5C\u3001\u5BF9\u8BDD\u3001\u611F\u5B98\u6216\u56E0\u679C\u53E5\u3002"
  ];
  const basePromptText = basePromptLines.join("\n");
  const fixedDynamicPromptText = fixedDynamicPromptLines.join("\n");
  const additionalFixedLength = basePromptText.length + fixedDynamicPromptText.length + 1e3;
  const prunedContext = await loadAndPruneGlobalContext({
    state,
    task,
    blueprint,
    resources,
    options,
    continuityContract,
    paths,
    projectRoot,
    knowledgeContext,
    additionalFixedLength
  });
  console.log(
    `[WRITING CTX] Chapter ${task.chapterNumber} Author Draft \u4E0A\u4E0B\u6587\u5206\u5E03: writerGuide=${(resources.writerGuide || "").length}\u5B57 vocabPrompt=${cappedVocabularyPrompt.length}\u5B57 skillExamples=${cappedVocabularySkillExamples.length}\u5B57 manifest=${cappedResourceManifest.length}\u5B57 consensus=${prunedContext.prunedConsensus.length}\u5B57 outline=${prunedContext.prunedOutline.length}\u5B57 memory=${prunedContext.prunedMemory.length}\u5B57 ledger=${prunedContext.prunedLedger.length}\u5B57 prevFragment=${prunedContext.previousDraftFragment.length}\u5B57 rag=${prunedContext.prunedRag.length}\u5B57`
  );
  const generated = await generateProductionTextWithLlm({
    roleName: "Author",
    state,
    options,
    progress: {
      step: "draft_generation",
      role: "Author",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `Author \u6B63\u5728\u6839\u636E\u7B2C ${task.chapterNumber} \u7AE0\u84DD\u56FE\u751F\u6210\u6B63\u6587\u521D\u7A3F\u3002`,
      completeMessage: `Author \u5DF2\u8FD4\u56DE\u7B2C ${task.chapterNumber} \u7AE0\u521D\u7A3F\uFF0C\u51C6\u5907\u8FDB\u5165\u8D28\u68C0\u3002`
    },
    basePrompt: basePromptText,
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${task.title}`,
      `\u76EE\u6807\u5B57\u6570\uFF1A${task.targetWords}`,
      `\u7C7B\u578B\uFF1A${genre.genre}`,
      `\u573A\u666F\u7C7B\u578B\uFF1A${sceneType}`,
      `\u65C1\u767D\u7B56\u7565\uFF1A${genre.narration}`,
      "",
      cappedVocabularyPrompt,
      "",
      cappedVocabularySkillExamples,
      "",
      cappedResourceManifest,
      "",
      prunedContext.prunedConsensus ? `Consensus & Setting Freeze:
${prunedContext.prunedConsensus}` : "",
      "",
      prunedContext.prunedOutline ? `Master Outline:
${prunedContext.prunedOutline}` : "",
      "",
      prunedContext.prunedMemory ? `Character Memory:
${prunedContext.prunedMemory}` : "",
      "",
      prunedContext.prunedLedger ? `Previous Chapter Ledger:
${prunedContext.prunedLedger}` : "",
      "",
      prunedContext.previousDraftFragment ? `Previous Chapter Draft Fragment (\u672B\u5C3E\u627F\u63A5\u6BB5):
${prunedContext.previousDraftFragment}` : "",
      "",
      "Knowledge/RAG References:",
      prunedContext.prunedRag,
      "",
      continuityContract.prompt,
      "",
      characterProfileContract.prompt.slice(0, 1800),
      "",
      "\u8D44\u6E90\u4F7F\u7528\u786C\u8981\u6C42\uFF1A",
      "- \u81F3\u5C11\u81EA\u7136\u5438\u6536 3 \u4E2A\u8BCD\u6C47/\u573A\u666F\u8D44\u6E90\u63D0\u793A\uFF0C\u4F46\u4E0D\u80FD\u5806\u780C\u6210\u8BED\u3002",
      "- \u5FC5\u987B\u5B66\u4E60 Migrated Vocabulary Skill Examples \u7684\u6B63\u786E\u793A\u8303\u65B9\u6CD5\uFF1A\u57FA\u7840\u8BCD\u6C47\u5199\u6E05\u5185\u5BB9\uFF0C\u5C11\u91CF\u6210\u8BED\u53EA\u505A\u70B9\u775B\u3002",
      "- \u5FC5\u987B\u907F\u5F00 Anti Patterns\uFF1A\u8FDE\u7EED\u6210\u8BED\u3001\u5B64\u7ACB\u6210\u8BED\u3001\u5355\u5B57\u77ED\u8BCD\u8FDE\u53D1\u3001\u53EA\u6709\u6C1B\u56F4\u6CA1\u6709\u52A8\u4F5C\u3002",
      "- \u573A\u666F\u5FC5\u987B\u6709\u5177\u4F53\u52A8\u4F5C\u3001\u7269\u4EF6\u3001\u6C14\u5473/\u58F0\u97F3/\u89E6\u611F\u4E2D\u7684\u81F3\u5C11\u4E24\u7C7B\u7EC6\u8282\u3002",
      "- \u7AE0\u8282\u5FC5\u987B\u56F4\u7ED5\u84DD\u56FE\u63A8\u8FDB\uFF0C\u4E0D\u5F97\u8F93\u51FA\u4FEE\u6539\u8BF4\u660E\u6216\u6CDB\u5316\u6A21\u677F\u6BB5\u843D\u3002",
      `- Previous Input \u5FC5\u987B\u8FDB\u5165\u5F00\u573A\u6216\u7B2C\u4E00\u573A\u51B2\u7A81\uFF1A${causalPlan.previousInput}`,
      `- Causal Objective \u5FC5\u987B\u5728\u6B63\u6587\u4E2D\u88AB\u4E8B\u4EF6\u63A8\u8FDB\uFF1A${causalPlan.sceneObjective}`,
      `- Protagonist Decision \u5FC5\u987B\u5199\u6210\u53EF\u89C1\u884C\u52A8\uFF1A${causalPlan.protagonistDecision}`,
      `- Irreversible Change \u5FC5\u987B\u6210\u4E3A\u7AE0\u672B\u4E8B\u5B9E\uFF1A${causalPlan.irreversibleConsequence}`,
      `- Next Chapter Handoff \u5FC5\u987B\u4ECE\u672C\u7AE0\u540E\u679C\u81EA\u7136\u4EA7\u751F\uFF1A${causalPlan.nextHandoff}`,
      continuityContract.lockedProtagonistName ? `- \u6B63\u6587\u5FC5\u987B\u591A\u6B21\u56F4\u7ED5\u300C${continuityContract.lockedProtagonistName}\u300D\u7684\u884C\u52A8\u3001\u611F\u77E5 and \u9009\u62E9\u63A8\u8FDB\u3002` : "- \u6B63\u6587\u5FC5\u987B\u660E\u786E\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\uFF0C\u5E76\u4FDD\u6301\u4E3B\u89C6\u89D2\u805A\u7126\u3002",
      "- \u4E0D\u5F97\u51ED\u7A7A\u66FF\u6362\u5DF2\u77E5\u914D\u89D2\uFF1B\u65B0\u589E\u914D\u89D2\u5FC5\u987B\u4EA4\u4EE3\u8EAB\u4EFD\u3001\u7ACB\u573A\u548C\u4E0E\u4E3B\u89D2\u5173\u7CFB\u3002",
      "- \u65B0\u589E\u6216\u6CBF\u7528\u7684\u91CD\u8981\u89D2\u8272\u5FC5\u987B\u901A\u8FC7\u52A8\u4F5C\u3001\u79F0\u547C\u3001\u505C\u987F\u3001\u5916\u8C8C\u4F53\u6001\u3001\u4E60\u60EF\u548C\u5229\u76CA\u9009\u62E9\u5448\u73B0\u4EBA\u683C\uFF0C\u4E0D\u80FD\u53EA\u8D34\u6027\u683C\u6807\u7B7E\u3002",
      "- \u6B63\u6587\u5FC5\u987B\u4F53\u73B0\u81F3\u5C11\u4E00\u4E2A\u89D2\u8272\u7684\u7279\u957F/\u77ED\u677F\u6216\u80FD\u529B\u8FB9\u754C\uFF0C\u4EE5\u53CA\u81F3\u5C11\u4E00\u4E2A\u5173\u7CFB\u72B6\u6001\u53D8\u5316\u3002",
      "- \u5FC5\u987B\u627F\u63A5\u524D\u5E8F\u7AE0\u8282\u8D26\u672C\u4E2D\u7684\u72B6\u6001\u3001\u4EE3\u4EF7\u3001\u7269\u54C1\u3001\u7EBF\u7D22\u6216\u4F0F\u7B14\u3002",
      continuityContract.continuityAnchors.length ? `- \u6B63\u6587\u5FC5\u987B\u81EA\u7136\u547D\u4E2D\u81F3\u5C11\u4E24\u4E2A\u4E0A\u4E00\u7AE0\u8FDE\u7EED\u6027\u951A\u70B9\uFF1A${continuityContract.continuityAnchors.slice(0, 8).join("\u3001")}\u3002` : "- \u6B63\u6587\u5FC5\u987B\u5EFA\u7ACB\u53EF\u4F9B\u4E0B\u4E00\u7AE0\u8FFD\u8E2A\u7684\u5177\u4F53\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u7EBF\u7D22\u6216\u4EE3\u4EF7\u3002",
      "- \u4E0D\u8981\u628A\u63A8\u8350\u8BCD\u3001\u6210\u8BED\u6216\u6C1B\u56F4\u8BCD\u5B64\u7ACB\u6210\u884C\uFF1B\u6240\u6709\u8BCD\u90FD\u5FC5\u987B\u5D4C\u5165\u5B8C\u6574\u52A8\u4F5C\u3001\u5BF9\u8BDD\u3001\u611F\u5B98\u6216\u56E0\u679C\u53E5\u3002"
    ].join("\n"),
    message: [
      "\u8BF7\u6309\u4EE5\u4E0B\u8BE6\u7EC6\u7AE0\u8282\u84DD\u56FE\u751F\u6210\u672C\u7AE0\u6B63\u6587\u8349\u7A3F\u3002",
      "\u8F93\u51FA Markdown\uFF0C\u5FC5\u987B\u5305\u542B `# \u7AE0\u8282\u6807\u9898` \u548C `## Draft Body`\u3002",
      "\u4E0D\u8981\u5199\u89E3\u91CA\uFF0C\u4E0D\u8981\u8BA9\u7528\u6237\u9009\u62E9\uFF0C\u4E0D\u8981\u8DF3\u7AE0\u3002",
      "",
      "## Causal Chapter Plan",
      ...formatCausalPlanBullets(state, task),
      "",
      trimBlueprintForDrafting(blueprint)
    ].join("\n")
  });
  return generated.includes("## Draft Body") ? generated : [`# ${task.title}`, "", "## Draft Body", "", generated, "", "## Drafting Metadata", `- Chapter: ${task.chapterNumber}`].join("\n");
}
function createQualityReport(state, task, draft, blueprint, continuityContract = createContinuityContract({ state, task, blueprint })) {
  const count = wordCount(draft);
  const target = task.targetWords;
  const minimumPassWords = Math.floor(target * 0.8);
  const wordCountBlockingIssue = count < minimumPassWords;
  const plotContinuity = evaluatePlotContinuityBridge(draft, task, continuityContract);
  const styleQuality = evaluateNarrativeStyleQuality(draft);
  const resourceUsage = evaluateWritingResourceUsage(draft, state, task, blueprint, continuityContract);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    continuityContract,
    previousFinalDraft: draft,
    blueprint
  });
  const characterProfileQuality = evaluateCharacterProfilePresence(draft, characterProfileContract);
  const wordScore = wordCountBlockingIssue ? 4 : 8;
  const hasHook = /钩子|问题|章末|最后|门|信|名字|表情/u.test(draft);
  const hasConflict = /冲突|压力|选择|代价|反击|局势/u.test(draft);
  const hasBlueprint = blueprint.includes("Event Sequence");
  const hasCausalContract = hasCausalBlueprint(blueprint);
  const hasCausalSignals = /承接|上一章|前文|选择|代价|不可逆|交给|下一章|后果/u.test(draft);
  const hasCausalExecution = hasCausalContract && (hasCausalSignals || hasBlueprint && hasConflict && hasHook);
  const hardBlocked = wordCountBlockingIssue || plotContinuity.status === "quarantined" || styleQuality.status === "quarantined" || resourceUsage.status === "quarantined" || characterProfileQuality.status === "quarantined" || !hasCausalContract || !hasCausalExecution;
  const score = hardBlocked ? Math.min(5, wordScore) : Math.min(10, Math.round((wordScore + (hasHook ? 8 : 5) + (hasConflict ? 8 : 5) + (hasBlueprint ? 8 : 5)) / 4));
  return [
    "# Chapter Quality Report",
    "",
    `Project: ${state.project.title}`,
    `Chapter: ${task.chapterNumber}`,
    `Title: ${task.title}`,
    "",
    "## Scores",
    "",
    "| Dimension | Score | Notes |",
    "|---|---:|---|",
    `| \u5B57\u6570\u5B8C\u6210\u5EA6 | ${wordScore}/10 | \u5F53\u524D\u4F30\u7B97 ${count}\uFF0C\u76EE\u6807 ${target}\u3002 |`,
    `| \u60C5\u8282\u63A8\u8FDB | ${hasConflict ? 8 : 5}/10 | ${hasConflict ? "\u5305\u542B\u51B2\u7A81\u3001\u538B\u529B\u6216\u9009\u62E9\u3002" : "\u51B2\u7A81\u4FE1\u53F7\u4E0D\u8DB3\uFF0C\u9700\u8981\u8FD4\u5DE5\u3002"} |`,
    `| \u7AE0\u672B\u94A9\u5B50 | ${hasHook ? 8 : 5}/10 | ${hasHook ? "\u5305\u542B\u94A9\u5B50\u6216\u540E\u7EED\u671F\u5F85\u3002" : "\u7AE0\u672B\u671F\u5F85\u4E0D\u8DB3\u3002"} |`,
    `| \u84DD\u56FE\u6267\u884C | ${hasBlueprint ? 8 : 5}/10 | ${hasBlueprint ? "\u57FA\u4E8E\u8BE6\u7EC6\u7AE0\u8282\u84DD\u56FE\u6267\u884C\u3002" : "\u7F3A\u5C11\u8BE6\u7EC6\u84DD\u56FE\u4F9D\u636E\u3002"} |`,
    `| \u56E0\u679C\u5408\u540C\u6267\u884C | ${hasCausalContract && hasCausalExecution ? 8 : 4}/10 | ${hasCausalContract && hasCausalExecution ? "\u84DD\u56FE\u5305\u542B\u56E0\u679C\u5408\u540C\uFF0C\u6B63\u6587\u4F53\u73B0\u627F\u63A5\u3001\u9009\u62E9\u3001\u4EE3\u4EF7\u6216\u4EA4\u68D2\u3002" : "\u7F3A\u5C11\u6E05\u6670\u56E0\u679C\u5408\u540C\u6216\u6B63\u6587\u672A\u6267\u884C\u627F\u63A5-\u9009\u62E9-\u4EE3\u4EF7-\u4EA4\u68D2\u3002"} |`,
    `| \u5199\u4F5C\u8D44\u6E90\u5438\u6536 | ${resourceUsage.status === "eligible" ? 8 : 4}/10 | ${resourceUsage.reason} |`,
    `| \u89D2\u8272\u9C9C\u660E\u5EA6 | ${characterProfileQuality.status === "eligible" ? 8 : 4}/10 | ${characterProfileQuality.reason} |`,
    `| \u7EFC\u5408\u8BC4\u5206 | ${score}/10 | ${score >= 7 ? "\u53EF\u8FDB\u5165\u6DA6\u8272\u3002" : "\u9700\u8981\u8FD4\u5DE5\u3002"} |`,
    "",
    `WORD_COUNT_CHECK: ${count}/${target}`,
    "",
    "## Checks",
    "- Editor: \u68C0\u67E5\u53D9\u4E8B\u63A8\u8FDB\u3001\u4EBA\u7269\u884C\u52A8\u3001\u723D\u70B9\u5BC6\u5EA6\u3002",
    "- Consistency Checker: \u68C0\u67E5\u8BBE\u5B9A\u3001\u65F6\u95F4\u7EBF\u3001\u4F0F\u7B14\u548C\u4EBA\u7269\u5173\u7CFB\u3002",
    "- Style Controller: \u68C0\u67E5\u6587\u98CE\u3001\u6210\u8BED\u5BC6\u5EA6\u3001\u6587\u8A00\u6BD4\u4F8B\u3001\u5BF9\u767D\u5DEE\u5F02\u3002",
    "- Prose Stylist: \u53BB\u9664\u6A21\u677F\u611F\uFF0C\u589E\u5F3A\u5177\u4F53\u573A\u666F\u548C\u81EA\u7136\u8868\u8FBE\u3002",
    `- Causal Contract: ${hasCausalContract && hasCausalExecution ? "\u901A\u8FC7\uFF1A\u7AE0\u8282\u4E0D\u662F\u5B64\u7ACB\u4E8B\u4EF6\uFF0C\u5DF2\u6709\u627F\u63A5\u3001\u9009\u62E9\u3001\u4EE3\u4EF7\u6216\u4EA4\u68D2\u3002" : "\u5931\u8D25\uFF1A\u7AE0\u8282\u53EF\u80FD\u53D8\u6210\u6D41\u6C34\u8D26\u6216\u5B64\u7ACB\u4E8B\u4EF6\u3002"}`,
    `- Plot Continuity: ${plotContinuity.reason}`,
    `- Style Hard Gate: ${styleQuality.reason}`,
    `- Resource Usage Gate: ${resourceUsage.reason}`,
    `- Character Profile Gate: ${characterProfileQuality.reason}`,
    "",
    "## Required Fixes",
    ...score >= 7 && !hardBlocked ? ["- \u6682\u65E0\u963B\u585E\u6027\u95EE\u9898\uFF1B\u6DA6\u8272\u65F6\u7EE7\u7EED\u538B\u4F4E AI \u6A21\u677F\u53E5\u3002"] : [
      ...wordCountBlockingIssue ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A\u6B63\u6587\u6709\u6548\u5B57\u6570 ${count}/${target}\uFF0C\u4F4E\u4E8E 80% \u95E8\u69DB\uFF0C\u4E0D\u80FD\u8FDB\u5165 complete\u3002`] : [],
      ...plotContinuity.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${plotContinuity.reason}`] : [],
      ...styleQuality.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${styleQuality.reason}`] : [],
      ...resourceUsage.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${resourceUsage.reason}`] : [],
      ...characterProfileQuality.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${characterProfileQuality.reason}`] : [],
      ...!hasCausalContract ? ["- \u9700\u8981\u8FD4\u5DE5\uFF1A\u84DD\u56FE\u7F3A\u5C11 Causal Objective / Irreversible Change / Next Chapter Handoff\uFF0C\u4E0D\u80FD\u652F\u6491\u8FDE\u7EED\u5199\u4F5C\u3002"] : [],
      ...!hasCausalExecution ? ["- \u9700\u8981\u8FD4\u5DE5\uFF1A\u6B63\u6587\u6CA1\u6709\u6E05\u6670\u6267\u884C\u627F\u63A5-\u9009\u62E9-\u4EE3\u4EF7-\u4EA4\u68D2\uFF0C\u5BB9\u6613\u53D8\u6210\u6D41\u6C34\u8D26\u3002"] : [],
      "- \u6269\u5199\u6B63\u6587\u573A\u666F\u3002",
      "- \u589E\u5F3A\u51B2\u7A81\u52A8\u4F5C\u3002",
      "- \u8865\u8DB3\u7AE0\u672B\u94A9\u5B50\u3002"
    ]
  ].join("\n");
}
function appendQualityHardChecks(report, task, draft, continuityContract, state) {
  const count = wordCount(draft);
  const target = task.targetWords;
  const continuityFixes = continuityContract ? continuityContract.requiredNames.filter((name) => !draft.includes(name)).map((name) => `- \u9700\u8981\u8FD4\u5DE5\uFF1ACanon \u8FDE\u7EED\u6027\u5931\u8D25\uFF0C\u6B63\u6587\u672A\u51FA\u73B0\u5FC5\u9700\u4EBA\u7269\u300C${name}\u300D\uFF0C\u4E0D\u80FD\u8FDB\u5165 complete\u3002`) : [];
  const plotContinuity = continuityContract ? evaluatePlotContinuityBridge(draft, task, continuityContract) : null;
  const styleQuality = evaluateNarrativeStyleQuality(draft);
  const characterProfileContract = continuityContract && state ? buildCharacterProfileContract({
    state,
    task,
    continuityContract,
    previousFinalDraft: draft
  }) : null;
  const characterProfileQuality = characterProfileContract ? evaluateCharacterProfilePresence(draft, characterProfileContract) : null;
  const narrativeFixes = [
    ...plotContinuity?.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${plotContinuity.reason}`] : [],
    ...styleQuality.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${styleQuality.reason}`] : [],
    ...characterProfileQuality?.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${characterProfileQuality.reason}`] : []
  ];
  const resourceUsage = continuityContract ? evaluateWritingResourceUsage(draft, void 0, task, "", continuityContract) : evaluateWritingResourceUsage(draft);
  const resourceFixes = resourceUsage.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${resourceUsage.reason}`] : [];
  if (report.includes("WORD_COUNT_CHECK:") && continuityFixes.length === 0 && narrativeFixes.length === 0 && resourceFixes.length === 0) {
    return report;
  }
  const minimumPassWords = Math.floor(target * 0.8);
  const hardFixes = count < minimumPassWords ? [
    "",
    "## Deterministic Hard Gate",
    `WORD_COUNT_CHECK: ${count}/${target}`,
    `- \u9700\u8981\u8FD4\u5DE5\uFF1A\u6B63\u6587\u6709\u6548\u5B57\u6570 ${count}/${target}\uFF0C\u4F4E\u4E8E 80% \u95E8\u69DB\uFF0C\u4E0D\u80FD\u8FDB\u5165 complete\u3002`,
    ...continuityFixes,
    ...narrativeFixes,
    ...resourceFixes
  ] : [
    "",
    "## Deterministic Hard Gate",
    `WORD_COUNT_CHECK: ${count}/${target}`,
    "- \u5B57\u6570\u786C\u95E8\u69DB\u901A\u8FC7\u3002",
    ...continuityFixes,
    ...narrativeFixes,
    ...resourceFixes
  ];
  return [report.trimEnd(), ...hardFixes].join("\n");
}
async function createProductionQualityReport(state, task, draft, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint })) {
  throwIfPipelineAborted(options);
  const fallback = createQualityReport(state, task, draft, blueprint);
  if (process.env.AI_NOVEL_TEST_MODE === "1" || !shouldUseLlmQualityPass(options)) {
    return fallback;
  }
  const generated = await generateProductionTextWithLlm({
    roleName: "Editor",
    state,
    options,
    progress: {
      step: "quality_review",
      role: "Editor",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `Editor \u6B63\u5728\u5BA1\u9605\u7B2C ${task.chapterNumber} \u7AE0\u521D\u7A3F\uFF0C\u68C0\u67E5\u60C5\u8282\u3001\u8BBE\u5B9A\u3001\u6587\u98CE\u548C\u5B57\u6570\u95E8\u7981\u3002`,
      completeMessage: `Editor \u5DF2\u8FD4\u56DE\u7B2C ${task.chapterNumber} \u7AE0\u8D28\u68C0\u62A5\u544A\u3002`
    },
    basePrompt: [
      resources.editorGuide || "\u4F60\u662F\u6587\u5B66\u8D28\u91CF\u628A\u63A7\u5E08\u3002",
      resources.consistencyGuide || "",
      resources.styleControllerGuide || ""
    ].join("\n\n"),
    dynamicPrompt: [
      "\u68C0\u67E5\u7EF4\u5EA6\uFF1A\u53D9\u4E8B\u8D28\u91CF\u3001\u4EBA\u7269\u4E00\u81F4\u6027\u3001\u8BBE\u5B9A\u4E00\u81F4\u6027\u3001\u6587\u98CE\u7EDF\u4E00\u3001\u723D\u70B9\u5BC6\u5EA6\u3001\u6210\u8BED\u4F7F\u7528\u3001AI \u5473\u3002",
      "\u5FC5\u987B\u8F93\u51FA\u8BC4\u5206\u8868\u3001\u4E25\u91CD\u95EE\u9898\u3001\u4E00\u822C\u95EE\u9898\u3001\u8BB0\u5FC6\u66F4\u65B0\u63D0\u9192\u3002",
      "\u5982\u679C\u8D28\u91CF\u4E0D\u8DB3\uFF0C\u660E\u786E\u6307\u51FA\u9700\u8981\u8FD4\u5DE5\u7684\u4F4D\u7F6E\u3002",
      "\u56E0\u679C\u5408\u540C\u662F\u786C\u95E8\u69DB\uFF1A\u6B63\u6587\u5FC5\u987B\u6267\u884C Previous Inputs\u3001Causal Objective\u3001Protagonist Decision\u3001Irreversible Change\u3001Next Chapter Handoff\u3002",
      continuityContract.lockedProtagonistName ? `\u4E3B\u89D2\u59D3\u540D\u3001\u8EAB\u4EFD\u6216\u6545\u4E8B\u7EBF\u6F02\u79FB\u662F\u4E25\u91CD\u95EE\u9898\uFF1B\u5982\u679C\u6B63\u6587\u4E0D\u662F\u56F4\u7ED5\u300C${continuityContract.lockedProtagonistName}\u300D\u63A8\u8FDB\uFF0C\u5FC5\u987B\u5224\u4E3A\u4E0D\u901A\u8FC7\u3002` : "\u9996\u7AE0\u5982\u679C\u6CA1\u6709\u5EFA\u7ACB\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\uFF0C\u5FC5\u987B\u5224\u4E3A\u4E0D\u901A\u8FC7\u3002",
      "\u914D\u89D2\u8EAB\u4EFD/\u5173\u7CFB\u6F02\u79FB\u3001\u524D\u5E8F\u60C5\u8282\u65AD\u88C2\u3001\u4F0F\u7B14\u4E22\u5931\u6216\u4E16\u754C\u89C4\u5219\u53D8\u5316\uFF0C\u90FD\u5FC5\u987B\u5224\u4E3A\u4E0D\u901A\u8FC7\u3002",
      "\u7B2C 2 \u7AE0\u4EE5\u540E\u5982\u679C\u53EA\u590D\u7528\u4E3B\u89D2\u59D3\u540D\uFF0C\u5374\u6CA1\u6709\u627F\u63A5\u4E0A\u4E00\u7AE0\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u7EBF\u7D22\u3001\u4EE3\u4EF7\u6216\u672A\u89E3\u51B3\u95EE\u9898\uFF0C\u5FC5\u987B\u5224\u4E3A\u4E0D\u901A\u8FC7\u3002",
      "\u5982\u679C\u7AE0\u8282\u53EA\u662F\u6309\u65F6\u95F4\u7F57\u5217\u4E8B\u4EF6\uFF0C\u6CA1\u6709\u8BA9\u4E0A\u4E00\u7AE0\u8F93\u5165\u5BFC\u81F4\u672C\u7AE0\u9009\u62E9\u3001\u4EE3\u4EF7\u548C\u4E0B\u4E00\u7AE0\u4EA4\u68D2\uFF0C\u5FC5\u987B\u5224\u4E3A\u4E0D\u901A\u8FC7\u3002",
      "\u5982\u679C\u6B63\u6587\u50CF\u84DD\u56FE\u3001\u8BA1\u5212\u3001\u4FEE\u6539\u8BF4\u660E\u6216\u6A21\u677F\u6BB5\u843D\uFF0C\u800C\u4E0D\u662F\u5C0F\u8BF4\u6B63\u6587\uFF0C\u5FC5\u987B\u5224\u4E3A\u4E0D\u901A\u8FC7\u3002",
      "\u5982\u679C\u770B\u4E0D\u51FA\u5199\u4F5C\u8D44\u6E90\u3001\u8BCD\u6C47/\u6210\u8BED\u7B56\u7565\u548C\u573A\u666F\u8D44\u6E90\u7684\u81EA\u7136\u5438\u6536\uFF0C\u5FC5\u987B\u8981\u6C42\u8FD4\u5DE5\u3002",
      "\u5982\u679C\u51FA\u73B0\u5355\u5B57/\u77ED\u8BCD\u9891\u7E41\u72EC\u7ACB\u6210\u53E5\u6216\u6210\u884C\u3001\u63A8\u8350\u8BCD\u5B64\u7ACB\u5806\u780C\u3001\u6C1B\u56F4\u8BCD\u8FDE\u53D1\uFF0C\u5FC5\u987B\u5224\u4E3A\u4E0D\u901A\u8FC7\u3002"
    ].join("\n"),
    message: [
      "\u8BF7\u5BA1\u6838\u4EE5\u4E0B\u7AE0\u8282\u8349\u7A3F\uFF0C\u5E76\u751F\u6210 `# Chapter Quality Report`\u3002",
      "",
      "## Blueprint",
      blueprint,
      "",
      continuityContract.prompt,
      "",
      "## Draft",
      draft
    ].join("\n")
  });
  const report = generated.includes("Chapter Quality Report") ? generated : `${fallback}

---

## LLM Editor Notes
${generated}`;
  return appendQualityHardChecks(report, task, draft, continuityContract, state);
}
async function reviseDraftForQualityGate(state, task, draft, report, blueprint, resources, options, attempt, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot) {
  throwIfPipelineAborted(options);
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return [
      draft,
      "",
      "---",
      "",
      `## Revision Attempt ${attempt}`,
      "- \u5DF2\u6839\u636E\u8D28\u91CF\u95E8\u7981\u8865\u5F3A\u51B2\u7A81\u3001\u7AE0\u672B\u94A9\u5B50\u3001\u573A\u666F\u7EC6\u8282\u548C\u89D2\u8272\u4E3B\u52A8\u9009\u62E9\u3002",
      "- \u672C\u8F6E\u8FD4\u5DE5\u4FDD\u6301\u7AE0\u8282\u76EE\u6807\u4E0D\u53D8\uFF0C\u5E76\u7EE7\u7EED\u4EA4\u7ED9\u8D28\u91CF\u95E8\u7981\u590D\u67E5\u3002"
    ].join("\n");
  }
  const cappedWriterGuide = (resources.writerGuide || "").slice(0, 2e3);
  const basePromptLines = [
    cappedWriterGuide || "\u4F60\u662F\u5C0F\u8BF4\u6B63\u6587\u521B\u4F5C\u6267\u884C\u8005\u3002",
    "\u4F60\u6B63\u5728\u6267\u884C\u8D28\u91CF\u95E8\u7981\u8FD4\u5DE5\u3002\u5FC5\u987B\u4FDD\u7559\u7AE0\u8282\u76EE\u6807\uFF0C\u4E0D\u5F97\u8DF3\u7AE0\uFF0C\u4E0D\u5F97\u6539\u53D8\u5DF2\u51BB\u7ED3\u8BBE\u5B9A\u3002",
    "\u987A\u5E94\u5E76\u4FEE\u590D\u7AE0\u8282\u56E0\u679C\u5408\u540C\uFF1A\u4E0A\u4E00\u7AE0\u8F93\u5165\u8981\u63A8\u52A8\u672C\u7AE0\u9009\u62E9\uFF0C\u672C\u7AE0\u9009\u62E9\u8981\u4EA7\u751F\u4E0D\u53EF\u9006\u4EE3\u4EF7\uFF0C\u5E76\u81EA\u7136\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002",
    continuityContract.lockedProtagonistName ? `\u5FC5\u987B\u628A\u4E3B\u89D2\u4E00\u81F4\u6027\u4FEE\u56DE\u300C${continuityContract.lockedProtagonistName}\u300D\uFF0C\u4E0D\u5F97\u7EE7\u7EED\u4F7F\u7528\u6F02\u79FB\u4E3B\u89D2\u3002` : "\u5FC5\u987B\u5728\u9996\u7AE0\u5EFA\u7ACB\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\u3002",
    "\u5FC5\u987B\u4FEE\u590D\u914D\u89D2\u5173\u7CFB\u3001\u524D\u5E8F\u60C5\u8282\u627F\u63A5\u3001\u4F0F\u7B14\u72B6\u6001\u3001\u8D44\u6E90\u4F7F\u7528\u3001\u60C5\u8282\u63A8\u8FDB\u548C\u6B63\u6587\u6BD4\u4F8B\u95EE\u9898\u3002",
    "\u5FC5\u987B\u4FEE\u590D\u7AE0\u8282\u65AD\u88C2\uFF1A\u4E0A\u4E00\u7AE0\u951A\u70B9\u8981\u8FDB\u5165\u672C\u7AE0\u4E8B\u4EF6\u56E0\u679C\uFF0C\u4E0D\u5F97\u53EA\u6362\u573A\u666F\u91CD\u5F00\u3002",
    "\u5FC5\u987B\u4FEE\u590D\u6D41\u6C34\u8D26\u95EE\u9898\uFF1A\u4E0D\u8981\u53EA\u6309\u65F6\u95F4\u7F57\u5217\uFF0C\u6240\u6709\u573A\u666F\u90FD\u8981\u56E0\u9009\u62E9\u3001\u4EE3\u4EF7\u3001\u4FE1\u606F\u53D8\u5316\u6216\u5173\u7CFB\u53D8\u5316\u800C\u53D1\u751F\u3002",
    "\u5FC5\u987B\u4FEE\u590D AI \u5316\u788E\u7247\uFF1A\u628A\u5B64\u7ACB\u77ED\u8BCD\u6539\u6210\u5B8C\u6574\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u5BF9\u8BDD\u6216\u56E0\u679C\u53E5\u3002"
  ];
  const fixedDynamicPromptLines = [
    `\u7AE0\u8282\uFF1A\u7B2C ${task.chapterNumber} \u7AE0`,
    `\u6807\u9898\uFF1A${task.title}`,
    `\u8FD4\u5DE5\u8F6E\u6B21\uFF1A${attempt}`,
    "\u5FC5\u987B\u9488\u5BF9\u8D28\u91CF\u62A5\u544A\u4E2D\u7684\u95EE\u9898\u91CD\u5199/\u6269\u5199\u6B63\u6587\u3002",
    "\u5FC5\u987B\u8F93\u51FA Markdown\uFF0C\u4FDD\u7559 `## Draft Body`\u3002",
    "",
    `[Correction Observation (\u7EA0\u504F\u89C2\u5BDF)]
\u4E0A\u4E00\u8F6E\u5199\u4F5C\u5B58\u5728\u4EE5\u4E0B\u7F3A\u9677\uFF1A
${report.slice(0, 1500)}
\u8BF7\u5728\u672C\u6B21\u91CD\u5199\u4E2D\u7279\u522B\u6CE8\u610F\u5E76\u4FEE\u590D\u8FD9\u4E9B\u95EE\u9898\u3002`,
    "",
    continuityContract.prompt
  ];
  const basePromptText = basePromptLines.join("\n\n");
  const fixedDynamicPromptText = fixedDynamicPromptLines.join("\n");
  const additionalFixedLength = basePromptText.length + fixedDynamicPromptText.length + 1e3;
  const prunedContext = await loadAndPruneGlobalContext({
    state,
    task,
    blueprint,
    resources,
    options,
    continuityContract,
    paths,
    projectRoot,
    additionalFixedLength
  });
  const generated = await generateProductionTextWithLlm({
    roleName: "Author",
    state,
    options,
    progress: {
      step: `revision_${attempt}`,
      role: "Author",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `Author \u6B63\u5728\u6839\u636E\u8D28\u68C0\u62A5\u544A\u8FD4\u5DE5\u7B2C ${task.chapterNumber} \u7AE0\uFF0C\u7B2C ${attempt} \u8F6E\u3002`,
      completeMessage: `Author \u5DF2\u8FD4\u56DE\u7B2C ${task.chapterNumber} \u7AE0\u7B2C ${attempt} \u8F6E\u8FD4\u5DE5\u7A3F\u3002`
    },
    basePrompt: basePromptText,
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${task.title}`,
      `\u8FD4\u5DE5\u8F6E\u6B21\uFF1A${attempt}`,
      "\u5FC5\u987B\u9488\u5BF9\u8D28\u91CF\u62A5\u544A\u4E2D\u7684\u95EE\u9898\u91CD\u5199/\u6269\u5199\u6B63\u6587\u3002",
      "\u5FC5\u987B\u8F93\u51FA Markdown\uFF0C\u4FDD\u7559 `## Draft Body`\u3002",
      "",
      `[Correction Observation (\u7EA0\u504F\u89C2\u5BDF)]
\u4E0A\u4E00\u8F6E\u5199\u4F5C\u5B58\u5728\u4EE5\u4E0B\u7F3A\u9677\uFF1A
${report.slice(0, 1500)}
\u8BF7\u5728\u672C\u6B21\u91CD\u5199\u4E2D\u7279\u522B\u6CE8\u610F\u5E76\u4FEE\u590D\u8FD9\u4E9B\u95EE\u9898\u3002`,
      "",
      prunedContext.prunedConsensus ? `Consensus & Setting Freeze:
${prunedContext.prunedConsensus}` : "",
      "",
      prunedContext.prunedOutline ? `Master Outline:
${prunedContext.prunedOutline}` : "",
      "",
      prunedContext.prunedMemory ? `Character Memory:
${prunedContext.prunedMemory}` : "",
      "",
      prunedContext.prunedLedger ? `Previous Chapter Ledger:
${prunedContext.prunedLedger}` : "",
      "",
      prunedContext.previousDraftFragment ? `Previous Chapter Draft Fragment (\u672B\u5C3E\u627F\u63A5\u6BB5):
${prunedContext.previousDraftFragment}` : "",
      "",
      continuityContract.prompt
    ].join("\n"),
    message: [
      "\u8BF7\u6839\u636E\u8D28\u91CF\u62A5\u544A\u8FD4\u5DE5\u4EE5\u4E0B\u7AE0\u8282\u8349\u7A3F\u3002",
      "",
      "## Blueprint",
      trimBlueprintForDrafting(blueprint),
      "",
      "## Quality Report",
      report,
      "",
      "## Draft",
      draft
    ].join("\n")
  });
  return generated.includes("## Draft Body") ? generated : [`# ${task.title}`, "", "## Draft Body", "", generated, "", `## Revision Attempt ${attempt}`].join("\n");
}
async function runQualityGateWithRevisions(state, task, initialDraft, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot) {
  const maxAttempts = options.maxRevisionAttempts !== void 0 ? options.maxRevisionAttempts : 3;
  let draft = initialDraft;
  let report = "";
  let gate = {
    passed: false,
    score: 0,
    status: "needs_revision",
    attempts: 0,
    reason: "\u8D28\u91CF\u95E8\u7981\u5C1A\u672A\u6267\u884C\u3002"
  };
  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    throwIfPipelineAborted(options);
    report = await createProductionQualityReport(state, task, draft, blueprint, resources, options, continuityContract);
    if (process.env.AI_NOVEL_TEST_MODE === "1" && typeof options.forceQualityScoreForTest === "number") {
      report = report.replace(/综合评分 \| \d+\/10/u, `\u7EFC\u5408\u8BC4\u5206 | ${options.forceQualityScoreForTest}/10`);
      if (options.forceQualityScoreForTest < 7 && !report.includes("\u9700\u8981\u8FD4\u5DE5")) {
        report = `${report}
- \u9700\u8981\u8FD4\u5DE5\uFF1A\u6D4B\u8BD5\u5F3A\u5236\u8D28\u91CF\u5206\u4F4E\u4E8E\u9608\u503C\u3002`;
      }
    }
    gate = parseQualityGate(report, attempt, maxAttempts);
    if (gate.passed || attempt >= maxAttempts) {
      return { draft, report, gate };
    }
    draft = await reviseDraftForQualityGate(
      state,
      task,
      draft,
      report,
      blueprint,
      resources,
      options,
      attempt + 1,
      continuityContract,
      paths,
      projectRoot
    );
  }
  return { draft, report, gate };
}
function createPolishedDraft(state, task, draft, report, gate = parseQualityGate(report), mode = "fast", naturalnessReport) {
  return [
    draft.replace("## Draft Body", "## Final Body"),
    "",
    "---",
    "",
    "## Naturalness Pass",
    `- Production writing mode: ${mode}.`,
    mode === "quality" ? "- \u5DF2\u6267\u884C Editor / Consistency Checker / Style Controller / NaturalnessAgent \u8D28\u91CF\u94FE\u8DEF\u3002" : "- \u5DF2\u6267\u884C\u5FEB\u901F\u751F\u4EA7\u786C\u95E8\u7981\uFF1A\u5B57\u6570\u3001\u4E3B\u89D2\u3001\u89D2\u8272\u6863\u6848\u3001\u8FDE\u7EED\u6027\u3001\u56E0\u679C\u5408\u540C\u3001\u8D44\u6E90\u5438\u6536\u548C\u81EA\u7136\u5EA6\u89C4\u5219\u3002",
    "- NaturalnessAgent \u76EE\u6807\uFF1A\u51CF\u5C11\u89E3\u91CA\u6027\u6A21\u677F\u53E5\uFF0C\u589E\u5F3A\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u5BF9\u767D\u3001\u89D2\u8272\u4E60\u60EF\u3001\u5173\u7CFB\u538B\u529B\u548C\u5177\u4F53\u9009\u62E9\u3002",
    "- \u53BB AI \u5473\u7B56\u7565\uFF1A\u907F\u514D\u8FDE\u7EED\u62BD\u8C61\u603B\u7ED3\u3001\u5206\u6790\u8154\u3001\u60C5\u7EEA\u6807\u7B7E\u5806\u53E0\u548C\u6574\u9F50\u6392\u6BD4\uFF0C\u4FDD\u7559\u6709\u4F53\u611F\u7684\u7EC6\u8282\u548C\u89D2\u8272\u5DEE\u5F02\u3002",
    "- Polish Pass compatibility: this Naturalness Pass replaces the legacy polish stage while preserving its artifact marker.",
    "",
    naturalnessReport ? formatNaturalnessReport(naturalnessReport) : "- Naturalness report: deterministic fallback not attached.",
    "",
    "## Quality Gate",
    `- Status: ${gate.status}`,
    `- Score: ${gate.score}/10`,
    `- Attempts: ${gate.attempts}`,
    `- Reason: ${gate.reason}`,
    `- Project: ${state.project.title}`,
    `- Chapter: ${task.chapterNumber}`
  ].join("\n");
}
async function createProductionPolishedDraft(state, task, draft, report, gate, resources, options, continuityContract = createContinuityContract({ state, task })) {
  throwIfPipelineAborted(options);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    continuityContract,
    previousFinalDraft: draft
  });
  const fallbackNaturalnessReport = createNaturalnessReport({
    beforeDraft: draft,
    afterDraft: draft,
    state,
    task,
    continuityContract,
    characterProfileContract
  });
  const fallback = createPolishedDraft(state, task, draft, report, gate, productionWritingMode(options), fallbackNaturalnessReport);
  if (process.env.AI_NOVEL_TEST_MODE === "1" || !shouldUseLlmPolishPass(options, gate)) {
    return fallback;
  }
  const generated = await generateProductionTextWithLlm({
    roleName: "Prose Stylist",
    state,
    options,
    progress: {
      step: "naturalness_generation",
      role: "Prose Stylist",
      chapterNumber: task.chapterNumber,
      title: task.title,
      startMessage: `NaturalnessAgent \u6B63\u5728\u5904\u7406\u7B2C ${task.chapterNumber} \u7AE0\uFF0C\u6267\u884C\u81EA\u7136\u5316\u3001\u89D2\u8272\u58F0\u97F3\u548C\u8BED\u4E49\u4FDD\u6301\u68C0\u67E5\u3002`,
      completeMessage: `NaturalnessAgent \u5DF2\u8FD4\u56DE\u7B2C ${task.chapterNumber} \u7AE0\u81EA\u7136\u5316\u7EC8\u7A3F\u3002`
    },
    basePrompt: [
      "\u4F60\u662F NaturalnessAgent\uFF0C\u662F\u751F\u4EA7\u6D41\u6C34\u7EBF\u4E2D\u7684\u6B63\u5F0F\u81EA\u7136\u5316 Agent\uFF0C\u4E0D\u662F\u4E34\u65F6\u6DA6\u8272\u5668\u3002",
      "\u4F60\u7684\u804C\u8D23\u662F\u8BA9\u6587\u672C\u66F4\u50CF\u81EA\u7136\u5C0F\u8BF4\uFF0C\u800C\u4E0D\u662F\u6539\u5199\u5267\u60C5\u3002\u4F18\u5148\u505A\u5C40\u90E8 patch \u5F0F\u6539\u5199\uFF0C\u4FDD\u7559\u4E8B\u5B9E\u3001\u4EBA\u7269\u3001\u5173\u7CFB\u3001\u7269\u4EF6\u3001\u4F0F\u7B14\u548C\u7AE0\u672B\u540E\u679C\u3002",
      resources.styleGuide || "",
      resources.styleControllerGuide || "",
      resources.consistencyGuide || ""
    ].join("\n\n"),
    dynamicPrompt: [
      "\u53EA\u5141\u8BB8\u5728\u4E0D\u6539\u53D8\u6838\u5FC3\u5267\u60C5\u3001\u4E0D\u6539\u53D8\u8BBE\u5B9A\u3001\u4E0D\u8DF3\u7AE0\u7684\u524D\u63D0\u4E0B\u6DA6\u8272\u3002",
      "\u5FC5\u987B\u4FDD\u7559\u7AE0\u8282\u6B63\u6587\u7ED3\u6784\uFF0C\u589E\u5F3A\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u5BF9\u767D\u5DEE\u5F02\u548C\u5177\u4F53\u7EC6\u8282\u3002",
      "\u63A7\u5236\u6210\u8BED\u5BC6\u5EA6\uFF0C\u907F\u514D\u5806\u780C\u548C\u6A21\u677F\u5316\u60C5\u7EEA\u89E3\u91CA\u3002",
      "\u5FC5\u987B\u6D88\u9664\u5355\u5B57/\u77ED\u8BCD\u72EC\u7ACB\u6210\u884C\u7684 AI \u5316\u788E\u7247\u611F\uFF1B\u63A8\u8350\u8BCD\u53EA\u80FD\u81EA\u7136\u5D4C\u5165\u53E5\u5B50\u3002",
      "\u5FC5\u987B\u79FB\u9664\u62A5\u544A\u8154\u3001\u603B\u7ED3\u8154\u3001\u8FC7\u5EA6\u89E3\u91CA\u3001\u6574\u9F50\u6392\u6BD4\u3001\u60C5\u7EEA\u6807\u7B7E\u5806\u53E0\u548C\u4E07\u80FD\u5347\u534E\u7ED3\u5C3E\u3002",
      "\u5FC5\u987B\u8BA9\u89D2\u8272\u901A\u8FC7\u4E60\u60EF\u52A8\u4F5C\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u5916\u8C8C\u4F53\u6001\u3001\u80FD\u529B\u8FB9\u754C\u548C\u5173\u7CFB\u538B\u529B\u5448\u73B0\u4EBA\u683C\u3002",
      continuityContract.lockedProtagonistName ? `\u4E0D\u5F97\u5728\u6DA6\u8272\u4E2D\u66F4\u6539\u4E3B\u89D2\u59D3\u540D\u3001\u8EAB\u4EFD\u6216\u7AE0\u8282\u6838\u5FC3\u4E8B\u4EF6\uFF1B\u9501\u5B9A\u4E3B\u89D2\u662F\u300C${continuityContract.lockedProtagonistName}\u300D\u3002` : "\u9996\u7AE0\u6DA6\u8272\u4E0D\u5F97\u79FB\u9664\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\u3002",
      "\u4E0D\u5F97\u66F4\u6539\u914D\u89D2\u8EAB\u4EFD\u3001\u5173\u7CFB\u3001\u4F0F\u7B14\u72B6\u6001\u6216\u524D\u5E8F\u60C5\u8282\u627F\u63A5\u3002",
      continuityContract.continuityAnchors.length ? `\u6DA6\u8272\u540E\u4ECD\u5FC5\u987B\u4FDD\u7559\u5E76\u81EA\u7136\u4F7F\u7528\u4E0A\u4E00\u7AE0\u8FDE\u7EED\u6027\u951A\u70B9\uFF1A${continuityContract.continuityAnchors.slice(0, 8).join("\u3001")}\u3002` : "\u6DA6\u8272\u540E\u5FC5\u987B\u4FDD\u7559\u672C\u7AE0\u5EFA\u7ACB\u7684\u53EF\u8FFD\u8E2A\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u7EBF\u7D22\u6216\u4EE3\u4EF7\u3002",
      "",
      continuityContract.prompt,
      "",
      characterProfileContract.prompt
    ].join("\n"),
    message: [
      "\u8BF7\u6839\u636E\u8D28\u91CF\u62A5\u544A\u81EA\u7136\u5316\u4EE5\u4E0B\u7AE0\u8282\uFF0C\u8F93\u51FA\u6700\u7EC8\u7A3F\u3002",
      "\u8F93\u51FA Markdown\uFF0C\u5FC5\u987B\u5305\u542B `## Final Body` \u4E0E `## Naturalness Pass`\u3002",
      "\u4E0D\u8981\u65B0\u589E\u4E8B\u5B9E\uFF0C\u4E0D\u8981\u6539\u53D8\u4EBA\u7269\u8EAB\u4EFD\uFF0C\u4E0D\u8981\u6539\u53D8\u5173\u7CFB\u7ED3\u8BBA\uFF0C\u4E0D\u8981\u8DF3\u7AE0\u3002",
      "",
      "## Quality Report",
      report,
      "",
      continuityContract.prompt,
      "",
      characterProfileContract.prompt,
      "",
      "## Draft",
      draft
    ].join("\n")
  });
  const normalized = generated.includes("## Final Body") ? generated : `${generated}

---

## Naturalness Pass
- \u5DF2\u6309\u8D28\u91CF\u62A5\u544A\u8FDB\u884C\u81EA\u7136\u5316\u548C\u53BB AI \u5473\u3002`;
  const naturalnessReport = createNaturalnessReport({
    beforeDraft: draft,
    afterDraft: normalized,
    state,
    task,
    continuityContract,
    characterProfileContract
  });
  return normalized.includes("## Naturalness Report") ? normalized : `${normalized.trimEnd()}

${formatNaturalnessReport(naturalnessReport)}`;
}
function createChapterMemoryUpdate(state, task, finalDraft, continuityContract = createContinuityContract({ state, task })) {
  const nextAnchors = extractContinuityAnchors({
    text: finalDraft,
    lockedProtagonistName: continuityContract.lockedProtagonistName,
    limit: 10
  });
  const causalPlan = getTaskCausalPlan(state, task);
  const plotContinuity = evaluatePlotContinuityBridge(finalDraft, task, continuityContract);
  const styleQuality = evaluateNarrativeStyleQuality(finalDraft);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    continuityContract,
    previousFinalDraft: finalDraft
  });
  const characterProfileQuality = evaluateCharacterProfilePresence(finalDraft, characterProfileContract);
  const naturalnessReport = createNaturalnessReport({
    beforeDraft: finalDraft,
    afterDraft: finalDraft,
    state,
    task,
    continuityContract,
    characterProfileContract
  });
  return [
    `# Chapter ${task.chapterNumber} Memory Update`,
    "",
    `Project: ${state.project.title}`,
    `Chapter title: ${task.title}`,
    "",
    "## Summary",
    `- \u672C\u7AE0\u56F4\u7ED5\u300C${task.summary}\u300D\u5B8C\u6210\u4E00\u6B21\u5267\u60C5\u63A8\u8FDB\uFF0C\u5E76\u4FDD\u7559\u540E\u7EED\u94A9\u5B50\u3002`,
    `- Plot bridge: ${plotContinuity.reason}`,
    `- Previous input: ${causalPlan.previousInput}`,
    `- Causal objective: ${causalPlan.sceneObjective}`,
    `- Irreversible change: ${causalPlan.irreversibleConsequence}`,
    `- Next handoff: ${causalPlan.nextHandoff}`,
    "",
    "## Character Changes",
    continuityContract.lockedProtagonistName ? `- Locked protagonist: ${continuityContract.lockedProtagonistName}` : "- Locked protagonist: pending first-chapter extraction",
    continuityContract.knownCast.length ? `- Known cast this run: ${continuityContract.knownCast.slice(0, 12).join("\u3001")}` : "- Known cast this run: none recorded yet",
    "- \u4E3B\u89D2\u901A\u8FC7\u4E00\u4E2A\u4E3B\u52A8\u9009\u62E9\u66B4\u9732\u5F53\u524D\u9636\u6BB5\u7684\u6B32\u671B\u3001\u5F31\u70B9\u6216\u80FD\u529B\u8FB9\u754C\u3002",
    `- Character state delta required by blueprint: ${causalPlan.characterStateDelta}`,
    "- \u65B0\u589E\u6216\u53D8\u5316\u7684\u914D\u89D2\u5FC5\u987B\u5728\u4E0B\u4E00\u8F6E Canon Contract \u4E2D\u7EE7\u7EED\u8FFD\u8E2A\uFF0C\u4E0D\u80FD\u65E0\u89E3\u91CA\u6D88\u5931\u3002",
    "",
    "## Character Profile Projection",
    `- Gate: ${characterProfileQuality.reason}`,
    `- Missing profile signals: ${characterProfileContract.missingSignals.length ? characterProfileContract.missingSignals.join("\u3001") : "none"}`,
    "- Required fields for each important character: identity, desire, fear/wound, habit, speech style, appearance/body marker, skill/limit, relationship state, chapter delta.",
    "- Next chapter must preserve these profile signals and add missing fields through action/dialogue rather than exposition.",
    "",
    "## Foreshadowing",
    ...nextAnchors.length ? nextAnchors.slice(0, 8).map((anchor) => `- Continuity anchor: ${anchor}`) : ["- Continuity anchor: \u672C\u7AE0\u672A\u62BD\u53D6\u5230\u660E\u786E\u951A\u70B9\uFF0C\u4E0B\u4E00\u8F6E\u5FC5\u987B\u4EBA\u5DE5/\u6A21\u578B\u8865\u8DB3\u7269\u54C1\u3001\u7EBF\u7D22\u3001\u5173\u7CFB\u6216\u4EE3\u4EF7\u3002"],
    "- \u4E0B\u4E00\u7AE0\u5FC5\u987B\u627F\u63A5\u4E0A\u8FF0 Continuity anchor \u4E2D\u81F3\u5C11\u4E24\u4E2A\uFF0C\u8BA9\u5B83\u4EEC\u8FDB\u5165\u6B63\u6587\u4E8B\u4EF6\u56E0\u679C\u3002",
    "",
    "## Style Notes",
    `- ${styleQuality.reason}`,
    "- \u4FDD\u6301\u7C7B\u578B\u65C1\u767D\u7B56\u7565\uFF0C\u907F\u514D\u6A21\u677F\u5316\u60C5\u7EEA\u89E3\u91CA\u3001\u77ED\u8BCD\u788E\u7247\u5806\u780C\u548C\u5B64\u7ACB\u6210\u8BED\u5C55\u793A\u3002",
    "",
    "## Naturalness Notes",
    `- ${naturalnessReport.reason}`,
    ...naturalnessReport.riskFlags.length ? naturalnessReport.riskFlags.slice(0, 6).map((flag) => `- Risk: ${flag}`) : ["- Risk: none"],
    "",
    "## Draft Excerpt",
    finalDraft.split("\n").filter(Boolean).slice(0, 8).join("\n")
  ].join("\n");
}
async function recordPipelineArtifact(projectRoot, absolutePath, kind, options, metadata = {}) {
  if (!options.factoryRootDir || !options.projectId) {
    return;
  }
  await withFactoryDb(options.factoryRootDir, async (db) => {
    const artifactPath = relativeArtifactPath(projectRoot, absolutePath);
    const messageId = artifactMessageId(options.projectId, artifactPath);
    db.recordArtifact({
      projectId: options.projectId,
      kind,
      path: artifactPath,
      status: "completed",
      metadata
    });
    db.createJob({
      projectId: options.projectId,
      kind: "knowledge_project_artifact",
      status: "idle",
      payload: {
        projectId: options.projectId,
        artifactPath,
        kind,
        metadata,
        reason: "artifact_recorded"
      }
    });
    const message = createArtifactMessage({
      messageId,
      conversationId: `artifacts:${options.projectId}`,
      projectId: options.projectId,
      runId: options.directorCommandId ?? null,
      artifactPath,
      label: artifactMessageLabel(kind, artifactPath, metadata),
      content: artifactMessageContent(kind, artifactPath, metadata),
      metadata: {
        source: "production_artifact",
        kind,
        path: artifactPath,
        ...metadata,
        directorCommandId: options.directorCommandId ?? null
      }
    });
    db.recordMessage(message, [
      messagePart(messageId, 0, "markdown", { text: message.data.content }, message.createdAt),
      messagePart(messageId, 1, "artifact", {
        path: artifactPath,
        label: message.data.label,
        kind,
        status: message.status
      }, message.createdAt),
      messagePart(messageId, 2, "json", {
        kind,
        path: artifactPath,
        metadata
      }, message.createdAt)
    ]);
  }).catch(() => void 0);
}
async function writeProductionMasterOutline(projectRoot, paths, state, context, options = {}) {
  const { resources } = await writeProductionWritingResourceArtifacts(projectRoot, paths, state, options);
  const content = await createMasterOutlineContent(state, context, resources, options);
  await fs2.mkdir(paths.plansDir, { recursive: true });
  await fs2.writeFile(paths.masterOutlinePath, `${content}
`);
  await recordPipelineArtifact(projectRoot, paths.masterOutlinePath, "plan", options, {
    stage: "master_planning",
    production: true
  });
  await emitWritingProgress(options, {
    step: "master_outline_saved",
    role: "Showrunner",
    status: "completed",
    message: "\u5168\u4E66\u4E3B\u7EBF\u89C4\u5212\u5DF2\u4FDD\u5B58\u4E3A\u6B63\u5F0F\u4EA7\u7269\u3002",
    artifactPath: relativeArtifactPath(projectRoot, paths.masterOutlinePath),
    preview: content.slice(0, 420),
    wordCount: wordCount(content)
  });
  return content;
}
async function writeAllDetailedChapterBlueprints(projectRoot, paths, state, context, options = {}) {
  const resources = await loadProductionWritingResources(projectRoot);
  await fs2.mkdir(paths.chapterBlueprintsDir, { recursive: true });
  const written = [];
  for (const task of state.plan.chapterTasks) {
    const deterministicBlueprint = createDetailedChapterBlueprint(state, task, context, resources);
    const shouldUseLlmPlanner = process.env.AI_NOVEL_TEST_MODE !== "1" && !options.preferDeterministicPlanning && task.chapterNumber <= 3;
    let content = deterministicBlueprint;
    if (shouldUseLlmPlanner) {
      content = await createChapterBlueprintContent(state, task, context, resources, options);
    } else {
      await emitWritingProgress(options, {
        step: "chapter_blueprint_started",
        role: "Chapter Planner",
        chapterNumber: task.chapterNumber,
        title: task.title,
        status: "started",
        message: `Chapter Planner \u5F00\u59CB\u751F\u6210\u7B2C ${task.chapterNumber} \u7AE0\u56E0\u679C\u84DD\u56FE\u9AA8\u67B6\u3002`,
        preview: task.summary
      });
      await emitWritingKnowledgeRecallProgress({
        options,
        purpose: "blueprint",
        role: "Chapter Planner",
        chapterNumber: task.chapterNumber,
        title: task.title,
        rows: []
      });
      await emitWritingProgress(options, {
        step: "chapter_blueprint_completed",
        role: "Chapter Planner",
        chapterNumber: task.chapterNumber,
        title: task.title,
        status: "completed",
        message: `Chapter Planner \u5DF2\u751F\u6210\u7B2C ${task.chapterNumber} \u7AE0\u56E0\u679C\u84DD\u56FE\u9AA8\u67B6\u3002`,
        preview: content.slice(0, 520),
        wordCount: wordCount(content)
      });
    }
    const blueprintPath = path3.join(paths.chapterBlueprintsDir, `chapter-${String(task.chapterNumber).padStart(3, "0")}.md`);
    await fs2.writeFile(blueprintPath, `${content}
`);
    await recordPipelineArtifact(projectRoot, blueprintPath, "plan", options, {
      chapterNumber: task.chapterNumber,
      stage: "chapter_task_generation",
      detailed: true,
      plannerMode: shouldUseLlmPlanner ? "llm-detailed" : "deterministic-causal"
    });
    await emitWritingProgress(options, {
      step: "chapter_blueprint_saved",
      role: "Chapter Planner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: shouldUseLlmPlanner ? `\u7B2C ${task.chapterNumber} \u7AE0 LLM \u8BE6\u7EC6\u84DD\u56FE\u5DF2\u4FDD\u5B58\u4E3A\u6B63\u5F0F\u4EA7\u7269\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0\u56E0\u679C\u84DD\u56FE\u9AA8\u67B6\u5DF2\u4FDD\u5B58\u4E3A\u6B63\u5F0F\u4EA7\u7269\uFF0C\u5199\u5230\u672C\u7AE0\u65F6\u53EF\u6309\u9700\u8865\u5F3A\u3002`,
      artifactPath: relativeArtifactPath(projectRoot, blueprintPath),
      preview: content.slice(0, 360),
      wordCount: wordCount(content)
    });
    written.push(blueprintPath);
  }
  return written;
}
async function runChapterProductionPipeline(projectRoot, paths, state, task, options = {}) {
  throwIfPipelineAborted(options);
  const writingMode = productionWritingMode(options);
  const resources = await loadProductionWritingResources(projectRoot);
  const protagonistProfile = await readOptionalText(paths.protagonistPath);
  const chapterId = `chapter-${String(task.chapterNumber).padStart(3, "0")}`;
  const previousChapterId = task.chapterNumber > 1 ? `chapter-${String(task.chapterNumber - 1).padStart(3, "0")}` : "";
  const previousMemory = previousChapterId ? await readOptionalText(path3.join(paths.memoryDir, `${previousChapterId}-memory.md`)) : "";
  const previousFinalDraft = previousChapterId ? await readOptionalText(path3.join(paths.chaptersDir, `${previousChapterId}.final.md`)) : "";
  const blueprintPath = path3.join(paths.chapterBlueprintsDir, `${chapterId}.md`);
  const context = {
    consensus: await readOptionalText(paths.consensusPath),
    protagonist: protagonistProfile,
    style: await readOptionalText(paths.styleProfilePath)
  };
  await emitWritingProgress(options, {
    step: "chapter_started",
    role: "Showrunner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "started",
    message: writingMode === "quality" ? `\u7B2C ${task.chapterNumber} \u7AE0\u5F00\u59CB\u751F\u4EA7\uFF1A\u5B8C\u6574\u8D28\u91CF\u6A21\u5F0F\u4F1A\u6267\u884C\u84DD\u56FE\u3001\u521D\u7A3F\u3001LLM \u8D28\u68C0\u3001\u6DA6\u8272\u548C\u8BB0\u5FC6\u66F4\u65B0\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0\u5F00\u59CB\u751F\u4EA7\uFF1A\u5FEB\u901F\u65E0\u4EBA\u503C\u5B88\u6A21\u5F0F\u4F1A\u4F18\u5148\u751F\u6210\u6B63\u6587\uFF0C\u5E76\u7528\u786E\u5B9A\u6027\u786C\u95E8\u7981\u68C0\u67E5\u8FDE\u7EED\u6027\u3001\u6210\u8BED\u8D44\u6E90\u548C\u53BB AI \u5473\u3002`
  });
  let blueprint = await readOptionalText(blueprintPath);
  if (!hasCausalBlueprint(blueprint)) {
    const planningContract = createContinuityContract({
      state,
      task,
      context,
      protagonistProfile,
      previousMemory,
      previousFinalDraft
    });
    blueprint = createDetailedChapterBlueprint(state, task, context, resources, planningContract);
    await fs2.mkdir(paths.chapterBlueprintsDir, { recursive: true });
    await fs2.writeFile(blueprintPath, `${blueprint}
`);
    await recordPipelineArtifact(projectRoot, blueprintPath, "plan", options, {
      chapterNumber: task.chapterNumber,
      stage: "drafting",
      detailed: true,
      generatedDuringProduction: true,
      reason: "missing_or_non_causal_blueprint"
    });
    await emitWritingProgress(options, {
      step: "chapter_blueprint_repaired",
      role: "Chapter Planner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: `\u7B2C ${task.chapterNumber} \u7AE0\u7F3A\u5C11\u53EF\u6267\u884C\u56E0\u679C\u84DD\u56FE\uFF0C\u5DF2\u5728\u751F\u4EA7\u524D\u81EA\u52A8\u8865\u9F50\u3002`,
      artifactPath: relativeArtifactPath(projectRoot, blueprintPath),
      preview: blueprint.slice(0, 420),
      wordCount: wordCount(blueprint)
    });
  }
  const continuityContract = createContinuityContract({
    state,
    task,
    protagonistProfile,
    blueprint,
    previousMemory,
    previousFinalDraft
  });
  if (continuityContract.status === "blocked") {
    throw new Error(`Continuity contract blocked chapter ${task.chapterNumber}: no locked protagonist from previous chapters.`);
  }
  await emitWritingProgress(options, {
    step: "blueprint_loaded",
    role: "Chapter Planner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "completed",
    message: `\u7B2C ${task.chapterNumber} \u7AE0\u84DD\u56FE\u5DF2\u8F7D\u5165\uFF0C\u5F00\u59CB\u751F\u6210\u6B63\u6587\u521D\u7A3F\u3002`,
    artifactPath: relativeArtifactPath(projectRoot, blueprintPath),
    preview: blueprint.slice(0, 360)
  });
  await emitWritingProgress(options, {
    step: "continuity_contract_loaded",
    role: "Showrunner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "completed",
    message: continuityContract.lockedProtagonistName ? `Canon \u8FDE\u7EED\u6027\u5408\u540C\u5DF2\u8F7D\u5165\uFF1A\u672C\u7AE0\u9501\u5B9A\u4E3B\u89D2\u300C${continuityContract.lockedProtagonistName}\u300D\uFF0C\u5E76\u8FFD\u8E2A\u914D\u89D2\u3001\u60C5\u8282\u548C\u4F0F\u7B14\u3002` : "Canon \u8FDE\u7EED\u6027\u5408\u540C\u5DF2\u8F7D\u5165\uFF1A\u9996\u7AE0\u5C06\u9501\u5B9A\u552F\u4E00\u4E3B\u89D2\uFF0C\u5E76\u5EFA\u7ACB\u540E\u7EED\u89D2\u8272/\u60C5\u8282\u8D26\u672C\u3002",
    preview: continuityContract.prompt.slice(0, 720)
  });
  const initialDraft = await createDraftBody(state, task, blueprint, resources, options, continuityContract, paths, projectRoot);
  throwIfPipelineAborted(options);
  await emitWritingProgress(options, {
    step: "draft_completed",
    role: "Author",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "completed",
    message: writingMode === "quality" ? `\u7B2C ${task.chapterNumber} \u7AE0\u521D\u7A3F\u5DF2\u751F\u6210\uFF0C\u8FDB\u5165 LLM \u8D28\u91CF\u95E8\u7981\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0\u521D\u7A3F\u5DF2\u751F\u6210\uFF0C\u8FDB\u5165\u5FEB\u901F\u786C\u95E8\u7981\u68C0\u67E5\u3002`,
    preview: initialDraft.slice(0, 420),
    wordCount: wordCount(initialDraft)
  });
  const { draft, report, gate } = await runQualityGateWithRevisions(state, task, initialDraft, blueprint, resources, options, continuityContract, paths, projectRoot);
  throwIfPipelineAborted(options);
  await emitWritingProgress(options, {
    step: "quality_gate_completed",
    role: "Editor",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: gate.status === "blocked" ? "blocked" : "completed",
    message: gate.status === "blocked" ? `\u7B2C ${task.chapterNumber} \u7AE0\u8D28\u68C0\u672A\u901A\u8FC7\uFF1A${gate.reason}` : writingMode === "quality" ? `\u7B2C ${task.chapterNumber} \u7AE0\u8D28\u68C0\u901A\u8FC7\uFF0C\u8BC4\u5206 ${gate.score}/10\uFF0C\u8FDB\u5165\u6DA6\u8272\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0\u5FEB\u901F\u786C\u95E8\u7981\u901A\u8FC7\uFF0C\u8BC4\u5206 ${gate.score}/10\uFF0C\u5199\u5165\u6B63\u5F0F\u4EA7\u7269\u3002`,
    preview: report.slice(0, 420),
    qualityGate: gate
  });
  const finalDraft = gate.status === "blocked" ? createPolishedDraft(state, task, draft, report, gate, writingMode) : await createProductionPolishedDraft(state, task, draft, report, gate, resources, options, continuityContract);
  const finalGate = enforceFinalDraftQualityGate(gate, finalDraft, task, state, protagonistProfile, continuityContract);
  throwIfPipelineAborted(options);
  await emitWritingProgress(options, {
    step: "naturalness_completed",
    role: "Prose Stylist",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: finalGate.status === "blocked" ? "blocked" : "completed",
    message: finalGate.status === "blocked" ? `\u7B2C ${task.chapterNumber} \u7AE0\u5DF2\u751F\u6210\u963B\u585E\u7248\u81EA\u7136\u5316\u7A3F\uFF0C\u7B49\u5F85\u4EBA\u5DE5\u5BA1\u9605\u6216\u91CD\u8BD5\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0 NaturalnessAgent \u81EA\u7136\u5316\u5B8C\u6210\uFF0C\u6B63\u5728\u5199\u5165\u6B63\u5F0F\u4EA7\u7269\u3002`,
    preview: finalDraft.slice(0, 420),
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate
  });
  await emitWritingProgress(options, {
    step: "memory_update_started",
    role: "Memory Keeper",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "started",
    message: `Memory Keeper \u6B63\u5728\u63D0\u53D6\u7B2C ${task.chapterNumber} \u7AE0\u8BB0\u5FC6\u3001\u89D2\u8272\u53D8\u5316\u548C\u4F0F\u7B14\u8BB0\u5F55\u3002`,
    preview: finalDraft.slice(0, 360),
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate
  });
  const memoryUpdate = createChapterMemoryUpdate(state, task, finalDraft, continuityContract);
  throwIfPipelineAborted(options);
  const draftPath = path3.join(paths.chaptersDir, `${chapterId}.draft.md`);
  const reviewedPath = path3.join(paths.chaptersDir, `${chapterId}.reviewed.md`);
  const finalPath = path3.join(paths.chaptersDir, `${chapterId}.final.md`);
  const reportPath = path3.join(paths.reportsDir, `${chapterId}-quality.md`);
  const memoryPath = path3.join(paths.memoryDir, `${chapterId}-memory.md`);
  await fs2.mkdir(paths.chaptersDir, { recursive: true });
  await fs2.mkdir(paths.reportsDir, { recursive: true });
  await fs2.mkdir(paths.memoryDir, { recursive: true });
  await fs2.writeFile(draftPath, `${draft}
`);
  await fs2.writeFile(reportPath, `${report}
`);
  await fs2.writeFile(reviewedPath, `${draft}

---

${report}
`);
  await fs2.writeFile(finalPath, `${finalDraft}
`);
  await fs2.writeFile(memoryPath, `${memoryUpdate}
`);
  await recordPipelineArtifact(projectRoot, draftPath, "chapter", options, { chapterNumber: task.chapterNumber, pass: "draft" });
  await recordPipelineArtifact(projectRoot, reviewedPath, "chapter", options, { chapterNumber: task.chapterNumber, pass: "reviewed", qualityGate: finalGate });
  await recordPipelineArtifact(projectRoot, finalPath, "chapter", options, {
    chapterNumber: task.chapterNumber,
    pass: "final",
    qualityGate: finalGate,
    wordCount: wordCount(finalDraft),
    targetWords: task.targetWords
  });
  await recordPipelineArtifact(projectRoot, reportPath, "checkpoint", options, { chapterNumber: task.chapterNumber, quality: true, qualityGate: finalGate });
  await recordPipelineArtifact(projectRoot, memoryPath, "memory", options, { chapterNumber: task.chapterNumber, qualityGate: finalGate });
  await emitWritingProgress(options, {
    step: "chapter_artifacts_saved",
    role: "Memory Keeper",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: finalGate.status === "blocked" ? "blocked" : "completed",
    message: finalGate.status === "blocked" ? `\u7B2C ${task.chapterNumber} \u7AE0\u4EA7\u7269\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u8D28\u91CF\u95E8\u7981\u4ECD\u963B\u585E\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0\u6B63\u5F0F\u6B63\u6587\u3001\u8D28\u68C0\u62A5\u544A\u548C\u8BB0\u5FC6\u66F4\u65B0\u5DF2\u4FDD\u5B58\u3002`,
    artifactPath: relativeArtifactPath(projectRoot, finalPath),
    preview: memoryUpdate.slice(0, 360),
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate
  });
  if (options.factoryRootDir && options.projectId) {
    await withFactoryDb(options.factoryRootDir, async (db) => {
      db.recordMemory(options.projectId, {
        source: relativeArtifactPath(projectRoot, memoryPath),
        kind: "chapter_summary",
        content: memoryUpdate,
        importance: 7,
        metadata: { chapterNumber: task.chapterNumber, title: task.title },
        embedding: {
          model: "local-hash-v1",
          vector: createLocalTextEmbedding(memoryUpdate)
        }
      });
      db.recordEvent(options.projectId, null, finalGate.status === "blocked" ? "CHAPTER_PIPELINE_BLOCKED" : "CHAPTER_PIPELINE_COMPLETED", {
        chapterNumber: task.chapterNumber,
        draftPath: relativeArtifactPath(projectRoot, draftPath),
        finalPath: relativeArtifactPath(projectRoot, finalPath),
        reportPath: relativeArtifactPath(projectRoot, reportPath),
        qualityGate: finalGate,
        writingMode,
        directorCommandId: options.directorCommandId ?? null
      });
    }).catch(() => void 0);
  }
  return {
    draftPath,
    reviewedPath,
    finalPath,
    reportPath,
    memoryPath,
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate,
    writingMode
  };
}

export {
  getProjectEnvPath,
  getProjectEnvCandidatePaths,
  readProjectEnv,
  resolveProjectEnvWritePath,
  getProjectEnvStatus,
  getPublicProjectEnvStatus,
  upsertProjectEnvValues,
  loadLlmConfigFromEnv,
  getCachedActiveLlmConfig,
  setCachedActiveLlmConfig,
  resolveFactoryRootDir,
  loadActiveLlmConfig,
  isAutopilotStopError,
  createAutopilotStopError,
  throwIfStopped,
  generateAgentReply,
  testProviderConnectivity,
  parseQualityGate,
  evaluateNarrativeStyleQuality,
  evaluateWritingResourceUsage,
  evaluatePlotContinuityBridge,
  createContinuityContract,
  loadProductionWritingResources,
  writeProductionWritingResourceArtifacts,
  createProductionMasterOutline,
  createDetailedChapterBlueprint,
  createDraftBodyFromBlueprint,
  writeProductionMasterOutline,
  writeAllDetailedChapterBlueprints,
  runChapterProductionPipeline
};
