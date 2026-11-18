"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/chapter-blueprint-learning.ts
var chapter_blueprint_learning_exports = {};
__export(chapter_blueprint_learning_exports, {
  chapterBlueprintBuiltinLearningRules: () => chapterBlueprintBuiltinLearningRules,
  chapterBlueprintLearningShouldStop: () => chapterBlueprintLearningShouldStop,
  classifyChapterBlueprintError: () => classifyChapterBlueprintError,
  compileChapterBlueprintLearningPrompt: () => compileChapterBlueprintLearningPrompt,
  deriveChapterBlueprintProjectIdentity: () => deriveChapterBlueprintProjectIdentity,
  loadChapterBlueprintLearningContext: () => loadChapterBlueprintLearningContext,
  recordChapterBlueprintLearningAttempt: () => recordChapterBlueprintLearningAttempt,
  recordChapterBlueprintStateSnapshot: () => recordChapterBlueprintStateSnapshot
});
module.exports = __toCommonJS(chapter_blueprint_learning_exports);
var import_node_crypto = require("crypto");
var import_promises = __toESM(require("fs/promises"), 1);
var import_node_path = __toESM(require("path"), 1);
var BUILTIN_SYSTEM_EXPERIENCES = [
  {
    fingerprint: "cross_batch_state_reset",
    errorCode: "CROSS_BATCH_STATE_RESET",
    title: "\u8DE8\u6279\u6B21\u72B6\u6001\u5FC5\u987B\u5355\u8C03\u7EE7\u627F",
    instruction: "\u6240\u6709\u5012\u8BA1\u65F6\u3001\u8D44\u6E90\u3001\u5BFF\u547D\u3001\u4F24\u52BF\u548C\u4EBA\u7269\u4F4D\u7F6E\u5FC5\u987B\u4ECE\u4E0A\u4E00\u6279\u9000\u51FA\u72B6\u6001\u9010\u5B57\u7EE7\u627F\uFF1B\u6CA1\u6709\u660E\u786E\u6062\u590D\u4E8B\u4EF6\u65F6\uFF0C\u6570\u503C\u53EA\u80FD\u4FDD\u6301\u6216\u6309\u4E8B\u4EF6\u4EE3\u4EF7\u51CF\u5C11\u3002"
  },
  {
    fingerprint: "ability_cost_not_applied",
    errorCode: "TERMINOLOGY_AND_COST_VIOLATION",
    title: "\u80FD\u529B\u6FC0\u6D3B\u4E0E\u4EE3\u4EF7\u5FC5\u987B\u539F\u5B50\u66F4\u65B0",
    instruction: "\u4EFB\u4F55\u80FD\u529B\u3001\u9053\u5177\u6216\u672F\u8BED\u4E00\u65E6\u5728\u884C\u52A8\u4E2D\u88AB\u6FC0\u6D3B\uFF0C\u5FC5\u987B\u5728\u540C\u4E00\u7AE0\u573A\u666F\u5361\u3001\u4E0D\u53EF\u9006\u53D8\u5316\u548C\u4EA4\u63A5\u72B6\u6001\u4E2D\u540C\u6B65\u767B\u8BB0\u51BB\u7ED3\u4EE3\u4EF7\uFF1B\u4E0D\u613F\u652F\u4ED8\u4EE3\u4EF7\u65F6\u5E94\u5220\u9664\u6FC0\u6D3B\u52A8\u4F5C\u3002"
  },
  {
    fingerprint: "chapter_character_scope",
    errorCode: "CHARACTER_SCOPE_VIOLATION",
    title: "\u573A\u666F\u4EBA\u7269\u5FC5\u987B\u5C5E\u4E8E\u672C\u7AE0\u540D\u5355",
    instruction: "\u6BCF\u5F20\u573A\u666F\u5361\u7684 requiredCharacters \u5FC5\u987B\u5C5E\u4E8E\u8BE5\u7AE0 allowedCharacters \u6216 allowedNewCharacters\uFF0C\u8FDC\u7A0B\u6295\u5F71\u3001\u4F20\u97F3\u3001\u89C2\u5BDF\u548C\u4E0B\u4EE4\u540C\u6837\u89C6\u4E3A\u53C2\u4E0E\u573A\u666F\u3002"
  },
  {
    fingerprint: "arc_cumulative_requirement",
    errorCode: "REQUIRED_COST_NOT_MET",
    title: "\u5F27\u7EA7\u8981\u6C42\u5FC5\u987B\u8BFB\u53D6\u7D2F\u8BA1\u8D26\u672C",
    instruction: "\u5224\u65AD\u5F27\u7EA7 requiredCost\u3001requiredEvent \u6216 requiredState \u524D\uFF0C\u5FC5\u987B\u5148\u68C0\u67E5\u5F53\u524D\u5F27\u6B64\u524D\u6240\u6709\u5DF2\u901A\u8FC7\u6279\u6B21\uFF1B\u4E0D\u5F97\u628A\u5DF2\u5151\u73B0\u7684\u4EE3\u4EF7\u91CD\u590D\u5B89\u6392\u5230\u6700\u540E\u4E00\u6279\u3002"
  },
  {
    fingerprint: "canon_constraint_conflict",
    errorCode: "CANON_CONSTRAINT_CONFLICT",
    title: "\u51B2\u7A81\u6B63\u5178\u5FC5\u987B\u5347\u7EA7\u5904\u7406",
    instruction: "\u5F53\u51FA\u53E3\u72B6\u6001\u3001\u7981\u6B62\u6F02\u79FB\u3001\u4E0A\u4E00\u6279\u51BB\u7ED3\u72B6\u6001\u6216\u6570\u503C\u76EE\u6807\u4E92\u76F8\u6392\u65A5\u65F6\uFF0C\u505C\u6B62\u673A\u68B0\u91CD\u5199\u5E76\u62A5\u544A\u6B63\u5178\u51B2\u7A81\uFF1B\u4E0D\u5F97\u5728\u4E92\u65A5\u7B54\u6848\u4E4B\u95F4\u6765\u56DE\u5207\u6362\u3002"
  }
];
var ERROR_PATTERNS = [
  {
    match: /CROSS_BATCH_STATE_RESET|状态重置|时间回退|凭空增加/u,
    knowledge: BUILTIN_SYSTEM_EXPERIENCES[0]
  },
  {
    match: /TERMINOLOGY_AND_COST_VIOLATION|能力代价|未扣除.{0,12}寿命|激活.{0,16}未/u,
    knowledge: BUILTIN_SYSTEM_EXPERIENCES[1]
  },
  {
    match: /requiredCharacters.*不在本章允许名单|allowedCharacters 包含未冻结人物|未冻结人物/u,
    knowledge: BUILTIN_SYSTEM_EXPERIENCES[2]
  },
  {
    match: /REQUIRED_COST_NOT_MET|MISSING_REQUIRED_COST|requiredCost/u,
    knowledge: BUILTIN_SYSTEM_EXPERIENCES[3]
  },
  {
    match: /ARC_BOUNDARY_EARLY|弧线进度越界|提前消费|提前进入下一弧/u,
    knowledge: {
      fingerprint: "arc_boundary_early",
      errorCode: "ARC_BOUNDARY_EARLY",
      title: "\u5F27\u7EBF\u91CC\u7A0B\u7891\u4E0D\u5F97\u63D0\u524D\u6D88\u8D39",
      instruction: "\u53EA\u5141\u8BB8\u4F7F\u7528\u5F53\u524D\u6279\u6B21\u8FDB\u5EA6\u5408\u540C\u660E\u786E\u5F00\u653E\u7684\u91CC\u7A0B\u7891\uFF1B\u672A\u6765\u5F27\u51FA\u53E3\u53EA\u80FD\u4F5C\u4E3A\u538B\u529B\u6216\u4F0F\u7B14\uFF0C\u4E0D\u5F97\u5199\u6210\u5DF2\u7ECF\u53D1\u751F\u7684\u72B6\u6001\u3002"
    }
  },
  {
    match: /FORBIDDEN_DRIFT_VIOLATION|forbiddenDrift|禁止漂移/u,
    knowledge: {
      fingerprint: "forbidden_drift_violation",
      errorCode: "FORBIDDEN_DRIFT_VIOLATION",
      title: "\u7981\u6B62\u6F02\u79FB\u5FC5\u987B\u4FDD\u6301\u6709\u6548",
      instruction: "\u9010\u7AE0\u68C0\u67E5\u51BB\u7ED3 forbiddenDrift\uFF1B\u82E5\u5F27\u672B\u51FA\u53E3\u8981\u6C42\u5F62\u6210\u660E\u786E\u7279\u4F8B\uFF0C\u5FC5\u987B\u5148\u7531\u7EA6\u675F\u4F18\u5148\u7EA7\u6216\u6B63\u5178\u4FEE\u8BA2\u663E\u5F0F\u653E\u884C\uFF0C\u4E0D\u80FD\u7531\u751F\u6210\u6A21\u578B\u81EA\u884C\u731C\u6D4B\u3002"
    }
  },
  {
    match: /WORLD_RULE_VIOLATION|世界规则/u,
    knowledge: {
      fingerprint: "world_rule_violation",
      errorCode: "WORLD_RULE_VIOLATION",
      title: "\u4E16\u754C\u89C4\u5219\u548C\u7279\u4F8B\u5FC5\u987B\u6309\u4F18\u5148\u7EA7\u6267\u884C",
      instruction: "\u5148\u6BD4\u8F83\u7AE0\u8282\u951A\u70B9\u3001\u5F27\u7EA7\u7279\u4F8B\u3001\u7981\u6B62\u6F02\u79FB\u548C\u901A\u7528\u4E16\u754C\u89C4\u5219\u7684\u4F18\u5148\u7EA7\uFF1B\u7279\u4F8B\u53EA\u80FD\u6309\u51BB\u7ED3\u89C4\u6A21\u3001\u4EE3\u4EF7\u548C\u65F6\u673A\u751F\u6548\u3002"
    }
  },
  {
    match: /sourceArcIds 必须|sourceArcId 与/u,
    knowledge: {
      fingerprint: "source_arc_mapping",
      errorCode: "SOURCE_ARC_MAPPING",
      title: "\u7AE0\u8282\u4E0E\u4E3B\u7EBF\u5F27\u6620\u5C04\u5FC5\u987B\u786E\u5B9A\u5316",
      instruction: "source.sourceArcIds \u5FC5\u987B\u4F7F\u7528\u672C\u6279\u5B9E\u9645\u5F27\u5217\u8868\uFF0C\u9010\u7AE0 sourceArcId \u5FC5\u987B\u7531\u7AE0\u8282\u53F7\u786E\u5B9A\uFF0C\u7981\u6B62\u6A21\u578B\u81EA\u884C\u6539\u5199\u6216\u91CD\u6392\u3002"
    }
  }
];
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function stableKey(value, prefix) {
  return `${prefix}_${(0, import_node_crypto.createHash)("sha256").update(value).digest("hex").slice(0, 16)}`;
}
function text(value) {
  return String(value || "").trim();
}
function defaultMemory(scope) {
  return {
    schemaVersion: 1,
    scope,
    experiences: [],
    attempts: [],
    conflicts: [],
    stateLedger: [],
    updatedAt: nowIso()
  };
}
async function readMemory(filename, scope) {
  try {
    const parsed = JSON.parse(await import_promises.default.readFile(filename, "utf8"));
    return {
      ...defaultMemory(scope),
      ...parsed,
      scope,
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      stateLedger: Array.isArray(parsed.stateLedger) ? parsed.stateLedger : []
    };
  } catch {
    return defaultMemory(scope);
  }
}
async function writeMemory(filename, memory) {
  await import_promises.default.mkdir(import_node_path.default.dirname(filename), { recursive: true });
  const next = { ...memory, updatedAt: nowIso() };
  const temporary = `${filename}.${process.pid}.tmp`;
  await import_promises.default.writeFile(temporary, `${JSON.stringify(next, null, 2)}
`);
  await import_promises.default.rename(temporary, filename);
}
function createExperience(scope, knowledge, projectId, modelKey, runId, builtin = false) {
  const createdAt = nowIso();
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
    updatedAt: createdAt
  };
}
function seedSystemMemory(memory) {
  for (const builtin of BUILTIN_SYSTEM_EXPERIENCES) {
    if (memory.experiences.some((entry) => entry.fingerprint === builtin.fingerprint)) continue;
    memory.experiences.push(createExperience("system", builtin, "", "", "builtin", true));
  }
  return memory;
}
function deriveChapterBlueprintProjectIdentity(storyBible) {
  const project = storyBible.project && typeof storyBible.project === "object" && !Array.isArray(storyBible.project) ? storyBible.project : {};
  const title = text(project.title) || "untitled";
  const genre = text(project.genre);
  const protagonist = text(project.protagonist);
  const logline = text(project.logline);
  const signature = JSON.stringify({ title, genre, protagonist, logline });
  return {
    projectId: stableKey(signature, "novel"),
    projectLabel: [title, protagonist].filter(Boolean).join(" \xB7 ")
  };
}
function classifyChapterBlueprintError(error) {
  const normalized = text(error);
  const matched = ERROR_PATTERNS.find((entry) => entry.match.test(normalized));
  if (matched) return { ...matched.knowledge };
  const explicitCode = normalized.match(/(?:第\s*\d+\s*章\s*)?([A-Z][A-Z0-9_]{3,})\s*[:：]/u)?.[1];
  const structuralPrefix = normalized.match(/^([\w.[\]-]+)\s/u)?.[1];
  const fingerprintSeed = explicitCode || structuralPrefix || normalized.slice(0, 80) || "unknown";
  const fingerprint = `learned_${(0, import_node_crypto.createHash)("sha256").update(fingerprintSeed).digest("hex").slice(0, 12)}`;
  return {
    fingerprint,
    errorCode: explicitCode || "UNCLASSIFIED_VALIDATION_ERROR",
    title: explicitCode ? `\u5B66\u4E60\u9519\u8BEF ${explicitCode}` : "\u672A\u5206\u7C7B\u6821\u9A8C\u9519\u8BEF",
    instruction: "\u6839\u636E\u9519\u8BEF\u8BC1\u636E\u5B9A\u4F4D\u6700\u5C0F\u5B57\u6BB5\u96C6\u5408\uFF0C\u53EA\u4FEE\u590D\u76F8\u5173\u5B57\u6BB5\u53CA\u76F4\u63A5\u8FDE\u7EED\u6027\u4F9D\u8D56\uFF1B\u4FEE\u590D\u540E\u91CD\u65B0\u6267\u884C\u7ED3\u6784\u4E0E\u6B63\u5178\u5BA1\u8BA1\u3002"
  };
}
function memoryPaths(rootDir, projectId, modelKey) {
  const learningRoot = import_node_path.default.join(rootDir, ".ai-novel-factory", "learning", "chapter-blueprints");
  return {
    project: import_node_path.default.join(learningRoot, "projects", `${projectId}.json`),
    system: import_node_path.default.join(learningRoot, "system-experiences.json"),
    model: import_node_path.default.join(learningRoot, "models", `${modelKey}.json`)
  };
}
function activeExperience(entry) {
  if (entry.status === "deprecated") return false;
  if (entry.status === "promoted") return true;
  return entry.successfulRepairs > 0 && entry.confidence >= 0.55;
}
function mergeExperiences(...groups) {
  const merged = /* @__PURE__ */ new Map();
  for (const group of groups) {
    for (const entry of group) {
      const key = `${entry.scope}:${entry.fingerprint}`;
      if (!merged.has(key) || (merged.get(key)?.updatedAt || "") < entry.updatedAt) merged.set(key, entry);
    }
  }
  return [...merged.values()].sort((a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title, "zh-CN"));
}
function selectActiveExperiences(experiences) {
  const scopePriority = { project: 3, model: 2, system: 1 };
  const selected = /* @__PURE__ */ new Map();
  for (const entry of experiences.filter(activeExperience)) {
    const current = selected.get(entry.fingerprint);
    if (!current || scopePriority[entry.scope] > scopePriority[current.scope] || scopePriority[entry.scope] === scopePriority[current.scope] && entry.confidence > current.confidence) {
      selected.set(entry.fingerprint, entry);
    }
  }
  return [...selected.values()].sort((a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title, "zh-CN"));
}
async function loadChapterBlueprintLearningContext(input) {
  const { projectId, projectLabel } = deriveChapterBlueprintProjectIdentity(input.storyBible);
  const modelKey = stableKey(input.modelName || "unknown-model", "model");
  const paths = memoryPaths(input.rootDir, projectId, modelKey);
  const [projectMemory, rawSystemMemory, modelMemory] = await Promise.all([
    readMemory(paths.project, "project"),
    readMemory(paths.system, "system"),
    readMemory(paths.model, "model")
  ]);
  const systemMemory = seedSystemMemory(rawSystemMemory);
  projectMemory.projectId = projectId;
  projectMemory.projectLabel = projectLabel;
  modelMemory.modelKey = modelKey;
  if (input.stateLedger?.length) {
    const snapshots = new Map(projectMemory.stateLedger.map((entry) => [entry.runId, entry]));
    for (const entry of input.stateLedger) snapshots.set(entry.runId, entry);
    projectMemory.stateLedger = [...snapshots.values()].sort((a, b) => a.startChapter - b.startChapter);
  }
  await Promise.all([
    writeMemory(paths.project, projectMemory),
    writeMemory(paths.system, systemMemory),
    writeMemory(paths.model, modelMemory)
  ]);
  const allExperiences = mergeExperiences(projectMemory.experiences, systemMemory.experiences, modelMemory.experiences);
  const activeExperiences = selectActiveExperiences(allExperiences);
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
    memoryPaths: paths
  };
}
function learningPromptVersion(experiences) {
  const promptInputs = experiences.map((entry) => ({
    fingerprint: entry.fingerprint,
    status: entry.status,
    instruction: entry.instruction,
    confidence: entry.confidence
  }));
  return `chapter-blueprints-learning-v1@${stableKey(JSON.stringify(promptInputs), "prompt")}`;
}
function confidence(successfulRepairs, failedRepairs) {
  return Number(((successfulRepairs + 1) / (successfulRepairs + failedRepairs + 2)).toFixed(3));
}
function upsertExperience(input) {
  let entry = input.memory.experiences.find((candidate) => candidate.fingerprint === input.knowledge.fingerprint);
  if (!entry) {
    entry = createExperience(input.scope, input.knowledge, input.projectId, input.modelKey, input.runId);
    input.memory.experiences.push(entry);
  }
  entry.seenCount += 1;
  if (input.resolved) entry.successfulRepairs += 1;
  else entry.failedRepairs += 1;
  if (!entry.projectIds.includes(input.projectId)) entry.projectIds.push(input.projectId);
  if (!entry.modelKeys.includes(input.modelKey)) entry.modelKeys.push(input.modelKey);
  if (!entry.sourceRunIds.includes(input.runId)) entry.sourceRunIds.push(input.runId);
  entry.sourceRunIds = entry.sourceRunIds.slice(-30);
  entry.confidence = confidence(entry.successfulRepairs, entry.failedRepairs);
  const promotionReady = input.scope === "project" ? entry.successfulRepairs >= 2 && entry.confidence >= 0.6 : input.scope === "model" ? entry.successfulRepairs >= 2 && entry.confidence >= 0.6 : entry.successfulRepairs >= 3 && entry.projectIds.length >= 2 && entry.confidence >= 0.65;
  entry.status = promotionReady || entry.status === "promoted" ? "promoted" : entry.status === "deprecated" ? "deprecated" : "candidate";
  entry.updatedAt = nowIso();
}
function detectConflict(attempts, runId) {
  const runAttempts = attempts.filter((entry) => entry.runId === runId);
  const latestAttempt = runAttempts.at(-1);
  const simultaneousFingerprints = new Set(latestAttempt?.afterFingerprints || []);
  if (simultaneousFingerprints.has("forbidden_drift_violation") && simultaneousFingerprints.has("arc_boundary_early")) {
    return {
      id: stableKey(`${runId}:arc-exit-vs-forbidden-drift`, "conflict"),
      kind: "canon_conflict",
      status: "open",
      fingerprints: ["forbidden_drift_violation", "arc_boundary_early"],
      message: "\u540C\u4E00 Run \u540C\u65F6\u88AB\u8981\u6C42\u4FDD\u7559 forbiddenDrift \u53C8\u88AB\u8981\u6C42\u5151\u73B0\u4E92\u65A5\u7684\u5F27\u672B exitState\uFF1B\u8FD9\u5C5E\u4E8E\u4E0A\u6E38\u6B63\u5178\u51B2\u7A81\uFF0C\u5FC5\u987B\u5148\u7EDF\u4E00\u7EA6\u675F\uFF0C\u4E0D\u80FD\u7EE7\u7EED\u673A\u68B0\u91CD\u5199\u3002",
      sourceRunIds: [runId],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }
  const noProgressWindow = 5;
  const recentAttempts = runAttempts.slice(-noProgressWindow);
  if (recentAttempts.length === noProgressWindow && recentAttempts.every((entry) => entry.resolvedFingerprints.length === 0 && !entry.passed)) {
    return {
      id: stableKey(`${runId}:no-progress:${recentAttempts.flatMap((entry) => entry.remainingFingerprints).sort().join(",")}`, "conflict"),
      kind: "no_progress",
      status: "open",
      fingerprints: [...new Set(recentAttempts.flatMap((entry) => entry.remainingFingerprints))],
      message: `\u8FDE\u7EED ${noProgressWindow} \u8F6E\u6CA1\u6709\u6D88\u9664\u4EFB\u4F55\u9519\u8BEF\u6307\u7EB9\uFF1BLearning Loop \u5DF2\u505C\u6B62\uFF0C\u907F\u514D\u5728\u4E0D\u53EF\u6536\u655B\u7ED3\u679C\u4E0A\u65E0\u9650\u6D88\u8017\u6A21\u578B\u8C03\u7528\u3002`,
      sourceRunIds: [runId],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
  }
  return null;
}
async function recordChapterBlueprintLearningAttempt(input) {
  const beforeKnowledge = input.beforeErrors.map(classifyChapterBlueprintError);
  const afterKnowledge = input.afterErrors.map(classifyChapterBlueprintError);
  const beforeFingerprints = [...new Set(beforeKnowledge.map((entry) => entry.fingerprint))];
  const afterFingerprints = [...new Set(afterKnowledge.map((entry) => entry.fingerprint))];
  const resolvedFingerprints = beforeFingerprints.filter((entry) => !afterFingerprints.includes(entry));
  const introducedFingerprints = afterFingerprints.filter((entry) => !beforeFingerprints.includes(entry));
  const remainingFingerprints = beforeFingerprints.filter((entry) => afterFingerprints.includes(entry));
  const attempt = {
    runId: input.runId,
    round: input.round,
    createdAt: nowIso(),
    beforeFingerprints,
    afterFingerprints,
    resolvedFingerprints,
    introducedFingerprints,
    remainingFingerprints,
    passed: input.passed
  };
  const [projectMemory, systemMemory, modelMemory] = await Promise.all([
    readMemory(input.context.memoryPaths.project, "project"),
    readMemory(input.context.memoryPaths.system, "system").then(seedSystemMemory),
    readMemory(input.context.memoryPaths.model, "model")
  ]);
  projectMemory.projectId = input.context.projectId;
  projectMemory.projectLabel = input.context.projectLabel;
  modelMemory.modelKey = input.context.modelKey;
  for (const knowledge of beforeKnowledge) {
    const resolved = resolvedFingerprints.includes(knowledge.fingerprint);
    upsertExperience({ memory: projectMemory, scope: "project", knowledge, projectId: input.context.projectId, modelKey: input.context.modelKey, runId: input.runId, resolved });
    upsertExperience({ memory: systemMemory, scope: "system", knowledge, projectId: input.context.projectId, modelKey: input.context.modelKey, runId: input.runId, resolved });
    upsertExperience({ memory: modelMemory, scope: "model", knowledge, projectId: input.context.projectId, modelKey: input.context.modelKey, runId: input.runId, resolved });
  }
  projectMemory.attempts.push(attempt);
  projectMemory.attempts = projectMemory.attempts.slice(-200);
  if (input.passed) {
    for (const existing of projectMemory.conflicts) {
      if (existing.status === "open" && existing.fingerprints.some((fingerprint) => beforeFingerprints.includes(fingerprint))) {
        existing.status = "resolved";
        existing.updatedAt = nowIso();
      }
    }
  }
  const conflict = input.passed ? null : detectConflict(projectMemory.attempts, input.runId);
  if (conflict) {
    const existing = projectMemory.conflicts.find((entry) => entry.id === conflict.id);
    if (existing) existing.updatedAt = nowIso();
    else projectMemory.conflicts.push(conflict);
  }
  await Promise.all([
    writeMemory(input.context.memoryPaths.project, projectMemory),
    writeMemory(input.context.memoryPaths.system, systemMemory),
    writeMemory(input.context.memoryPaths.model, modelMemory)
  ]);
  const allExperiences = mergeExperiences(projectMemory.experiences, systemMemory.experiences, modelMemory.experiences);
  const activeExperiences = selectActiveExperiences(allExperiences);
  return {
    ...input.context,
    promptVersion: learningPromptVersion(activeExperiences),
    activeExperiences,
    candidateExperiences: allExperiences.filter((entry) => entry.status === "candidate"),
    attempts: projectMemory.attempts.slice(-40),
    conflicts: projectMemory.conflicts.filter((entry) => entry.status === "open")
  };
}
async function recordChapterBlueprintStateSnapshot(input) {
  const memory = await readMemory(input.context.memoryPaths.project, "project");
  const snapshots = new Map(memory.stateLedger.map((entry) => [entry.runId, entry]));
  snapshots.set(input.snapshot.runId, input.snapshot);
  memory.stateLedger = [...snapshots.values()].sort((a, b) => a.startChapter - b.startChapter);
  await writeMemory(input.context.memoryPaths.project, memory);
  return {
    ...input.context,
    stateLedger: memory.stateLedger
  };
}
function compileChapterBlueprintLearningPrompt(context) {
  const scopeLabel = {
    system: "\u7CFB\u7EDF\u7EA7\u53EF\u590D\u7528\u7ECF\u9A8C",
    model: "\u5F53\u524D\u6A21\u578B\u9002\u914D\u7ECF\u9A8C",
    project: "\u672C\u5C0F\u8BF4\u5DF2\u9A8C\u8BC1\u7ECF\u9A8C"
  };
  const experiences = context.activeExperiences.length ? context.activeExperiences.map((entry, index) => `${index + 1}. [${scopeLabel[entry.scope]}\uFF5C${entry.status}\uFF5C\u7F6E\u4FE1\u5EA6 ${entry.confidence.toFixed(2)}] ${entry.title}\uFF1A${entry.instruction}`) : ["1. \u6682\u65E0\u5DF2\u9A8C\u8BC1\u5B66\u4E60\u7ECF\u9A8C\uFF1B\u672C\u6B21\u7ED3\u679C\u5C06\u4F5C\u4E3A\u9996\u6279\u5B66\u4E60\u8BC1\u636E\u3002"];
  const ledger = context.stateLedger.length ? context.stateLedger.map((entry) => ({
    runId: entry.runId,
    chapters: `${entry.startChapter}-${entry.endChapter}`,
    batchExitState: entry.batchExitState,
    unresolvedRisks: entry.unresolvedRisks,
    nextChapterEntryState: entry.nextChapterEntryState,
    nextChapterHandoff: entry.nextChapterHandoff
  })) : [];
  return [
    `Learning Loop Prompt \u7248\u672C\uFF1A${context.promptVersion}`,
    `\u5C0F\u8BF4\u8BB0\u5FC6\u7A7A\u95F4\uFF1A${context.projectLabel}\uFF08${context.projectId}\uFF09`,
    `\u6A21\u578B\u9002\u914D\u7A7A\u95F4\uFF1A${context.modelKey}`,
    "\u4EE5\u4E0B\u7ECF\u9A8C\u6765\u81EA\u6301\u4E45\u5316\u5B66\u4E60\u5E93\uFF1B\u7CFB\u7EDF\u89C4\u5219\u4E0D\u5F97\u5199\u5165\u5C0F\u8BF4\u4E13\u6709\u540D\u79F0\u6216\u60C5\u8282\uFF1A",
    ...experiences,
    "\u5F53\u524D\u5C0F\u8BF4\u8DE8\u6279\u6B21\u72B6\u6001\u8D26\u672C\uFF08\u4EC5\u5C5E\u4E8E\u672C\u5C0F\u8BF4\uFF0C\u4E0D\u5F97\u664B\u5347\u4E3A\u7CFB\u7EDF\u5185\u5BB9\uFF09\uFF1A",
    ledger.length ? JSON.stringify(ledger, null, 2) : "\u65E0\u5386\u53F2\u6279\u6B21\u72B6\u6001\u3002",
    context.conflicts.length ? `\u5F53\u524D\u5B58\u5728\u672A\u89E3\u51B3\u5B66\u4E60\u51B2\u7A81\uFF1A${context.conflicts.map((entry) => entry.message).join("\uFF5C")}` : "\u5F53\u524D\u65E0\u672A\u89E3\u51B3\u5B66\u4E60\u51B2\u7A81\u3002"
  ].join("\n");
}
function chapterBlueprintLearningShouldStop(context, runId) {
  const conflict = context.conflicts.find((entry) => entry.status === "open" && entry.sourceRunIds.includes(runId) && entry.kind === "no_progress");
  return conflict ? { stop: true, reason: conflict.message, conflict } : { stop: false, reason: "" };
}
var chapterBlueprintBuiltinLearningRules = BUILTIN_SYSTEM_EXPERIENCES.map((entry) => ({ ...entry }));
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  chapterBlueprintBuiltinLearningRules,
  chapterBlueprintLearningShouldStop,
  classifyChapterBlueprintError,
  compileChapterBlueprintLearningPrompt,
  deriveChapterBlueprintProjectIdentity,
  loadChapterBlueprintLearningContext,
  recordChapterBlueprintLearningAttempt,
  recordChapterBlueprintStateSnapshot
});
