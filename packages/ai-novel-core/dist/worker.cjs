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

// src/worker.ts
var worker_exports = {};
__export(worker_exports, {
  createWorkerWorkspacePayload: () => createWorkerWorkspacePayload,
  getNovelAutopilotWorkerStatus: () => getNovelAutopilotWorkerStatus,
  runNovelAutopilotWorkerCli: () => runNovelAutopilotWorkerCli,
  runNovelAutopilotWorkerOnce: () => runNovelAutopilotWorkerOnce,
  startNovelAutopilotWorker: () => startNovelAutopilotWorker
});
module.exports = __toCommonJS(worker_exports);
var import_node_path11 = __toESM(require("path"), 1);

// src/env-manager.ts
var import_node_fs = __toESM(require("fs"), 1);
var import_node_path = __toESM(require("path"), 1);
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
var MANAGED_PROJECTS_SEGMENT = `${import_node_path.default.sep}.ai-novel-projects${import_node_path.default.sep}`;
function uniquePaths(paths) {
  return [...new Set(paths.map((candidate) => import_node_path.default.resolve(candidate)))];
}
function inferWorkspaceRootFromManagedProject(rootDir) {
  const index = rootDir.indexOf(MANAGED_PROJECTS_SEGMENT);
  if (index < 0) {
    return null;
  }
  return rootDir.slice(0, index) || import_node_path.default.parse(rootDir).root;
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
  return import_node_path.default.resolve(rootDir, ".env");
}
function getProjectEnvCandidatePaths(rootDir = process.cwd()) {
  const resolvedRootDir = import_node_path.default.resolve(rootDir);
  const candidates = [
    getProjectEnvPath(resolvedRootDir),
    import_node_path.default.join(resolvedRootDir, ...PACKAGE_ENV_PARTS)
  ];
  const workspaceRoot = inferWorkspaceRootFromManagedProject(resolvedRootDir);
  if (workspaceRoot) {
    candidates.push(
      getProjectEnvPath(workspaceRoot),
      import_node_path.default.join(workspaceRoot, ...PACKAGE_ENV_PARTS)
    );
  }
  return uniquePaths(candidates);
}
function readProjectEnv(rootDir = process.cwd()) {
  for (const envPath of getProjectEnvCandidatePaths(rootDir)) {
    if (import_node_fs.default.existsSync(envPath)) {
      const raw = import_node_fs.default.readFileSync(envPath, "utf8");
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

// src/autopilot-worker.ts
var import_promises8 = __toESM(require("fs/promises"), 1);
var import_node_path10 = __toESM(require("path"), 1);

// src/orchestrator.ts
var import_promises6 = __toESM(require("fs/promises"), 1);
var import_node_crypto2 = require("crypto");
var import_node_path8 = __toESM(require("path"), 1);

// src/llm-config.ts
var import_node_fs3 = __toESM(require("fs"), 1);
var import_node_path3 = __toESM(require("path"), 1);

// src/factory-db.ts
var import_node_fs2 = __toESM(require("fs"), 1);
var import_promises = __toESM(require("fs/promises"), 1);
var import_node_path2 = __toESM(require("path"), 1);

// src/chapter-consistency.ts
var GENERIC_NAMES = /* @__PURE__ */ new Set([
  "\u4E3B\u89D2",
  "\u4E3B\u4EBA\u516C",
  "\u9996\u7AE0\u4E3B\u89D2",
  "\u5F85\u5B9A",
  "\u5F85\u547D\u540D",
  "\u672A\u547D\u540D",
  "pending",
  "\u5927\u5510",
  "\u5510\u672B",
  "\u540C\u5DDE",
  "\u957F\u5B89",
  "\u53BF\u8859",
  "\u5B8B\u5BB6",
  "\u738B\u5BB6"
]);
var ROLE_TITLE_SUFFIXES = [
  "\u7BA1\u4E8B",
  "\u4E3B\u7C3F",
  "\u91CC\u6B63",
  "\u574A\u6B63",
  "\u53BF\u4EE4",
  "\u53BF\u4E1E",
  "\u53BF\u5C09",
  "\u53BF\u8859",
  "\u8859\u5F79",
  "\u5DEE\u5F79",
  "\u5E08\u5085",
  "\u5927\u5A18",
  "\u5927\u90CE",
  "\u4E8C\u90CE",
  "\u4E09\u90CE",
  "\u8001\u6C49",
  "\u8001\u5987",
  "\u90CE\u541B",
  "\u5A18\u5B50",
  "\u963F\u90CE",
  "\u5A46\u5B50"
];
var VIEWPOINT_VERBS = [
  "\u9192",
  "\u60CA\u9192",
  "\u7741\u5F00",
  "\u770B\u89C1",
  "\u542C\u89C1",
  "\u77E5\u9053",
  "\u610F\u8BC6\u5230",
  "\u60F3",
  "\u8BB0\u5F97",
  "\u89C9\u5F97",
  "\u4E0D\u6562",
  "\u4E0D\u80FD",
  "\u5FC5\u987B",
  "\u54AC\u4F4F",
  "\u6491\u7740",
  "\u7AD9",
  "\u8D70",
  "\u95EE",
  "\u8BF4"
];
var TRAILING_NON_NAME_CHARS = /* @__PURE__ */ new Set([
  "\u662F",
  "\u5C31",
  "\u80FD",
  "\u4F1A",
  "\u8981",
  "\u628A",
  "\u5C06",
  "\u7ED9",
  "\u5411",
  "\u4ECE",
  "\u5728",
  "\u8DDF",
  "\u8FFD",
  "\u7AD9",
  "\u8D70",
  "\u8BF4",
  "\u95EE",
  "\u60F3",
  "\u770B",
  "\u542C",
  "\u9192",
  "\u88AB",
  "\u4E0D",
  "\u4E86",
  "\u7740",
  "\u7684",
  "\u5F97",
  "\u5730"
]);
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function normalizeChapterBody(text = "") {
  const finalBodyMatch = text.match(/(?:^|\n)##\s*Final Body\s*\n([\s\S]*)/iu);
  if (finalBodyMatch?.[1]) {
    return finalBodyMatch[1].trim();
  }
  const chineseFinalBodyMatch = text.match(/(?:^|\n)##\s*(?:正文|终稿正文|最终正文)\s*\n([\s\S]*)/u);
  if (chineseFinalBodyMatch?.[1]) {
    return chineseFinalBodyMatch[1].trim();
  }
  return text.trim();
}
function isRoleOrGenericName(name) {
  if (!name || GENERIC_NAMES.has(name)) {
    return true;
  }
  if (/[的得地着]/u.test(name)) {
    return true;
  }
  if (/阳光|月光|火光|金手指|黄河|马蹄|树皮|石板|案卷|田册|东西|温吞|官道/u.test(name)) {
    return true;
  }
  if (/(?:家庄|河边|蹄声|木门|土墙|陶碗|草鞋|地铺|县衙|公文|契书)$/u.test(name)) {
    return true;
  }
  return ROLE_TITLE_SUFFIXES.some((suffix) => name.endsWith(suffix));
}
function normalizeCandidateName(raw = "") {
  let name = raw.trim();
  while (name.length > 2 && TRAILING_NON_NAME_CHARS.has(name.at(-1) || "")) {
    name = name.slice(0, -1);
  }
  return name;
}
function extractChinesePersonNames(text = "", limit = 12) {
  const names = [];
  const patterns = [
    /(?:^|[“"'\n。！？；：，、\s])([李王张刘陈杨赵黄周吴郑孙马朱胡林郭何高罗宋谢唐韩冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳司马上官诸葛东方尉迟公孙慕容长孙][\u4e00-\u9fff]{1,2})(?=(?:是被|就被|被|睁开|翻身|坐起|抬头|撑着|咬住|开口|问|说|想|知道|意识到|没有|必须|终于|觉得|看见|听见|不敢|不能|需要|站|走|把|将|给|向|从|在))/gu,
    /[“"'\n。！？；：，、\s]([李王张刘陈杨赵黄周吴郑孙马朱胡林郭何高罗宋谢唐韩冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳司马上官诸葛东方尉迟公孙慕容长孙][\u4e00-\u9fff]{1,3})(?=[，。！？；：、\s“”"'\n])/gu,
    /(?:叫|名叫|唤作|自称|他叫|她叫)([李王张刘陈杨赵黄周吴郑孙马朱胡林郭何高罗宋谢唐韩冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳司马上官诸葛东方尉迟公孙慕容长孙][\u4e00-\u9fff]{1,3})/gu,
    /([李王张刘陈杨赵黄周吴郑孙马朱胡林郭何高罗宋谢唐韩冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳司马上官诸葛东方尉迟公孙慕容长孙][\u4e00-\u9fff]{1,2})(?=(?:没有|必须|终于|觉得|看见|听见|知道|意识到|不敢|不能|需要|站|走|醒|说|问|想|把|将|给|向|从|在))/gu
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = normalizeCandidateName(String(match[1] || ""));
      if (name.length < 2 || name.length > 4 || isRoleOrGenericName(name)) {
        continue;
      }
      names.push(name);
      if (names.length >= limit * 2) {
        break;
      }
    }
  }
  return unique(names).slice(0, limit);
}
function sentenceWindow(text, index, radius = 38) {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius));
}
function viewpointScore(text, name) {
  if (!name || isRoleOrGenericName(name)) {
    return Number.NEGATIVE_INFINITY;
  }
  let score = 0;
  const firstIndex = text.indexOf(name);
  if (firstIndex >= 0) {
    score += Math.max(0, 80 - Math.floor(firstIndex / 12));
  }
  const count = countName(text, name);
  score += Math.min(count, 12) * 4;
  const opening = text.slice(0, 520);
  const openingMatches = [
    new RegExp(`${name}.{0,8}(?:\u662F)?\u88AB.{0,10}(?:\u9192|\u60CA\u9192)`, "u"),
    new RegExp(`${name}.{0,12}(?:\u7741\u5F00|\u7FFB\u8EAB|\u5750\u8D77|\u62AC\u5934|\u6491\u7740|\u54AC\u4F4F|\u5F00\u53E3|\u95EE|\u8BF4|\u60F3|\u77E5\u9053|\u610F\u8BC6\u5230)`, "u"),
    new RegExp(`(?:\u9192\u6765|\u60CA\u9192|\u7741\u5F00\u773C|\u56DE\u8FC7\u795E|\u4E0D\u662F\u8FD9\u4E2A\u4E16\u754C\u7684\u4EBA|\u7A7F\u8D8A).{0,24}${name}`, "u")
  ];
  for (const pattern of openingMatches) {
    if (pattern.test(opening)) {
      score += 90;
    }
  }
  for (let index = text.indexOf(name); index >= 0; index = text.indexOf(name, index + name.length)) {
    const window = sentenceWindow(text, index);
    if (VIEWPOINT_VERBS.some((verb) => window.includes(verb))) {
      score += 8;
    }
    if (/他不是这个世界的人|穿越|最后的记忆|不属于他的记忆|脑子里多了些不属于他的记忆/u.test(window)) {
      score += 35;
    }
  }
  return score;
}
function inferDominantProtagonistName(text = "") {
  const body = normalizeChapterBody(text);
  const detectedNames = extractChinesePersonNames(body);
  return detectedNames.map((name) => ({ name, score: viewpointScore(body, name), count: countName(body, name) })).sort((left, right) => right.score - left.score || right.count - left.count)[0]?.name || "";
}
function inferLockedProtagonistName(profile = "") {
  const explicit = profile.match(/(?:主角名|主人公名|姓名|名字|本名|canonicalName|protagonistName|name)\s*[:：]\s*([^\n，。；、\s]{2,4})/iu);
  if (explicit?.[1] && !isRoleOrGenericName(explicit[1])) {
    return explicit[1];
  }
  return "";
}
function countName(text, name) {
  if (!name) return 0;
  return text.split(name).length - 1;
}
function evaluateChapterConsistency(input) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    const isFirst = input.chapterNumber === 1 || !input.previousProtagonistName;
    const name = input.previousProtagonistName || "\u9996\u7AE0\u4E3B\u89D2";
    return {
      status: "eligible",
      reason: isFirst ? `\u9996\u7AE0\u5019\u9009\u4E3B\u89D2\u8BC6\u522B\u4E3A\u300C${name}\u300D\uFF0C\u6D4B\u8BD5\u6A21\u5F0F\u8DF3\u8FC7\u771F\u5B9E\u95E8\u7981\u3002` : `\u6CBF\u7528\u300C${name}\u300D\uFF0C\u6D4B\u8BD5\u6A21\u5F0F\u8DF3\u8FC7\u771F\u5B9E\u95E8\u7981\u3002`,
      protagonistName: name,
      detectedNames: [name]
    };
  }
  const text = normalizeChapterBody(input.text || "");
  const detectedNames = extractChinesePersonNames(text);
  const profileName = inferLockedProtagonistName(input.protagonistProfile || "");
  const expectedName = (input.previousProtagonistName || profileName || "").trim();
  const dominantName = inferDominantProtagonistName(text);
  if (expectedName) {
    if (!text.includes(expectedName)) {
      return {
        status: "quarantined",
        reason: `\u4E3B\u89D2\u4E00\u81F4\u6027\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u672C\u7AE0\u672A\u51FA\u73B0\u5DF2\u9501\u5B9A\u4E3B\u89D2\u300C${expectedName}\u300D\u3002`,
        protagonistName: expectedName,
        detectedNames
      };
    }
    const expectedScore = viewpointScore(text, expectedName);
    const conflicting = detectedNames.filter((name) => name !== expectedName && countName(text, name) >= 2).map((name) => ({ name, score: viewpointScore(text, name), count: countName(text, name) })).sort((left, right) => right.score - left.score || right.count - left.count);
    if (conflicting.length > 0 && conflicting[0].score >= expectedScore + 24) {
      return {
        status: "quarantined",
        reason: `\u4E3B\u89D2\u4E00\u81F4\u6027\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u7591\u4F3C\u4ECE\u300C${expectedName}\u300D\u6F02\u79FB\u5230\u300C${conflicting[0].name}\u300D\u3002`,
        protagonistName: expectedName,
        detectedNames
      };
    }
    return {
      status: "eligible",
      reason: `\u4E3B\u89D2\u4E00\u81F4\u6027\u901A\u8FC7\uFF1A\u6CBF\u7528\u300C${expectedName}\u300D\u3002`,
      protagonistName: expectedName,
      detectedNames
    };
  }
  if (input.chapterNumber > 1 && dominantName) {
    return {
      status: "quarantined",
      reason: `\u4E3B\u89D2\u4E00\u81F4\u6027\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u524D\u5E8F\u7AE0\u8282\u672A\u9501\u5B9A\u4E3B\u89D2\uFF0C\u4E0D\u80FD\u8BA9\u7B2C ${input.chapterNumber} \u7AE0\u81EA\u884C\u6539\u7528\u300C${dominantName}\u300D\u3002`,
      protagonistName: dominantName,
      detectedNames
    };
  }
  return {
    status: dominantName ? "eligible" : "quarantined",
    reason: dominantName ? `\u9996\u7AE0\u5019\u9009\u4E3B\u89D2\u8BC6\u522B\u4E3A\u300C${dominantName}\u300D\uFF0C\u540E\u7EED\u7AE0\u8282\u5FC5\u987B\u6CBF\u7528\u3002` : "\u4E3B\u89D2\u4E00\u81F4\u6027\u786C\u95E8\u69DB\u5931\u8D25\uFF1A\u6B63\u6587\u4E2D\u672A\u8BC6\u522B\u51FA\u53EF\u8FFD\u8E2A\u4E3B\u89D2\u59D3\u540D\u3002",
    protagonistName: dominantName || void 0,
    detectedNames
  };
}

// src/factory-db.ts
var FACTORY_DB_DIR = ".ai-novel-factory";
var FACTORY_DB_FILE = "factory.sqlite";
var MIN_CHAPTER_PASS_RATIO = 0.8;
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function jsonString(value) {
  return JSON.stringify(value ?? null);
}
function stableJsonString(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonString(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJsonString(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
function stateChangeFingerprint(state) {
  if (!state) {
    return "";
  }
  const cloned = JSON.parse(JSON.stringify(state));
  delete cloned.runtime.lastUpdatedAt;
  if (cloned.runtime.autopilot) {
    delete cloned.runtime.autopilot.updatedAt;
  }
  return stableJsonString(cloned);
}
function readJson(value, fallback) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function compactJsonString(value, maxLength = 1600) {
  const text = typeof value === "string" ? value : jsonString(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}
function compactDbRow(row) {
  const compacted = { ...row };
  if (typeof compacted.payload_json === "string") {
    compacted.payload_json = compactJsonString(compacted.payload_json);
  }
  if (typeof compacted.metadata_json === "string") {
    compacted.metadata_json = compactJsonString(compacted.metadata_json);
  }
  if (typeof compacted.content === "string" && compacted.content.length > 900) {
    compacted.content = `${compacted.content.slice(0, 900)}...`;
  }
  if (typeof compacted.input_json === "string") {
    compacted.input_json = compactJsonString(compacted.input_json, 900);
  }
  if (typeof compacted.output_text === "string" && compacted.output_text.length > 1200) {
    compacted.output_text = `${compacted.output_text.slice(0, 1200)}...`;
  }
  return compacted;
}
function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function makeStableId(prefix, value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(36)}`;
}
function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1e3);
}
function cosineSimilarity(left, right) {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
function mapJobRow(row) {
  return {
    ...row,
    payload: readJson(row.payload_json, {})
  };
}
function chapterNumberFromPath(value) {
  const match = String(value || "").match(/chapter-(\d+)/);
  return match ? Number(match[1]) : null;
}
function normalizeQualityGate(value, updatedAt = "") {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value;
  const status = String(record.status || "");
  if (status !== "passed" && status !== "needs_revision" && status !== "blocked") {
    return null;
  }
  return {
    status,
    score: Number.isFinite(Number(record.score)) ? Number(record.score) : void 0,
    attempts: Number.isFinite(Number(record.attempts)) ? Number(record.attempts) : void 0,
    reason: typeof record.reason === "string" ? record.reason : "",
    wordCount: Number.isFinite(Number(record.wordCount)) ? Number(record.wordCount) : void 0,
    targetWords: Number.isFinite(Number(record.targetWords)) ? Number(record.targetWords) : void 0,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : updatedAt
  };
}
function evaluateChapterContentQuality(qualityGate, projectTargetWords) {
  if (!qualityGate) {
    return null;
  }
  const wordCountValue = Number(qualityGate.wordCount);
  const targetWordsValue = Number(qualityGate.targetWords ?? projectTargetWords);
  const wordCount2 = Number.isFinite(wordCountValue) ? wordCountValue : void 0;
  const targetWords = Number.isFinite(targetWordsValue) ? targetWordsValue : void 0;
  const minimumWords = targetWords ? Math.floor(targetWords * MIN_CHAPTER_PASS_RATIO) : void 0;
  if (qualityGate.status !== "passed") {
    return {
      status: "quarantined",
      reason: qualityGate.reason || "\u8D28\u91CF\u95E8\u7981\u672A\u901A\u8FC7\u3002",
      wordCount: wordCount2,
      targetWords,
      minimumWords
    };
  }
  const reason = qualityGate.reason || "";
  if (/主角一致性硬门槛失败|章节连续性检查失败|故事线漂移|主角.*漂移/u.test(reason)) {
    return {
      status: "quarantined",
      reason,
      wordCount: wordCount2,
      targetWords,
      minimumWords
    };
  }
  if (!wordCount2 || !targetWords || !minimumWords) {
    return {
      status: "quarantined",
      reason: "\u7F3A\u5C11\u786E\u5B9A\u6027\u5B57\u6570\u95E8\u7981\uFF0C\u4E0D\u80FD\u8BA1\u5165\u6B63\u5F0F\u5B8C\u6210\u3002",
      wordCount: wordCount2,
      targetWords,
      minimumWords
    };
  }
  if (wordCount2 < minimumWords) {
    return {
      status: "quarantined",
      reason: `\u6B63\u6587\u6709\u6548\u5B57\u6570 ${wordCount2}/${targetWords}\uFF0C\u4F4E\u4E8E ${Math.round(MIN_CHAPTER_PASS_RATIO * 100)}% \u95E8\u69DB\u3002`,
      wordCount: wordCount2,
      targetWords,
      minimumWords
    };
  }
  return {
    status: "eligible",
    reason: "\u786E\u5B9A\u6027\u5B57\u6570\u95E8\u7981\u901A\u8FC7\u3002",
    wordCount: wordCount2,
    targetWords,
    minimumWords
  };
}
function isWritingEventActive(payload, now2 = /* @__PURE__ */ new Date()) {
  const status = String(payload.status || "");
  const step = String(payload.step || "");
  const eventAt = typeof payload.createdAt === "string" ? Date.parse(payload.createdAt) : Number.NaN;
  const eventAgeMs = Number.isFinite(eventAt) ? now2.getTime() - eventAt : 0;
  const maxActiveMs = 10 * 60 * 1e3;
  if (eventAgeMs > maxActiveMs) return false;
  if (/_completed$|_failed$|saved$|artifacts_saved|quality_gate_completed|polish_completed|naturalness_completed|memory_update_completed/.test(step)) {
    return false;
  }
  if (status === "running") return true;
  if (status === "started") return true;
  return false;
}
function isWritingEventFailed(payload) {
  const status = String(payload.status || "");
  const step = String(payload.step || "");
  return status === "blocked" || status === "failed" || /_failed$/u.test(step);
}
function timestampMs(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function normalizeTaskStatus(value) {
  if (value === "pending" || value === "in_progress" || value === "complete" || value === "blocked") {
    return value;
  }
  return void 0;
}
function normalizeChapterNumberList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    if (typeof entry === "number") {
      return entry;
    }
    if (entry && typeof entry === "object" && "chapterNumber" in entry) {
      return Number(entry.chapterNumber);
    }
    return Number(entry);
  }).filter((entry) => Number.isFinite(entry) && entry > 0);
}
function applyQualityGateFact(fact, qualityGate, projectTargetWords) {
  if (!qualityGate) {
    return;
  }
  const incomingAt = timestampMs(qualityGate.updatedAt);
  const existingAt = timestampMs(fact.qualityGate?.updatedAt || fact.updatedAt);
  if (existingAt > 0 && incomingAt > 0 && incomingAt < existingAt) {
    return;
  }
  fact.qualityGate = qualityGate;
  fact.contentQuality = evaluateChapterContentQuality(qualityGate, projectTargetWords);
  fact.updatedAt = qualityGate.updatedAt || fact.updatedAt;
}
function readTextFileSync(filePath) {
  try {
    return import_node_fs2.default.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
async function loadDatabaseSync() {
  const dynamicImport = new Function("specifier", "return import(specifier)");
  const sqlite = await dynamicImport("node:sqlite");
  return sqlite.DatabaseSync;
}
function getFactoryDbPath(rootDir) {
  return import_node_path2.default.join(rootDir, FACTORY_DB_DIR, FACTORY_DB_FILE);
}
var FactoryDb = class _FactoryDb {
  constructor(db) {
    this.db = db;
  }
  db;
  static async open(rootDir) {
    const dbPath = getFactoryDbPath(rootDir);
    await import_promises.default.mkdir(import_node_path2.default.dirname(dbPath), { recursive: true });
    const DatabaseSync = await loadDatabaseSync();
    const db = new DatabaseSync(dbPath);
    const store = new _FactoryDb(db);
    store.migrate();
    return store;
  }
  close() {
    this.db.close();
  }
  migrate() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        idea TEXT NOT NULL,
        project_root TEXT NOT NULL,
        total_chapters INTEGER NOT NULL,
        chapter_word_target INTEGER NOT NULL,
        current_stage TEXT NOT NULL,
        run_status TEXT NOT NULL DEFAULT 'idle',
        state_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        project_root TEXT NOT NULL,
        parent_run_id TEXT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        goal TEXT NOT NULL,
        stage TEXT NOT NULL,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        error TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workflow_steps (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        stage TEXT NOT NULL,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        input_json TEXT,
        output_json TEXT,
        error TEXT,
        FOREIGN KEY(run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS agent_turns (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        turn_id TEXT NOT NULL,
        role TEXT NOT NULL,
        discussion_stage TEXT NOT NULL,
        status TEXT NOT NULL,
        model TEXT,
        input_json TEXT NOT NULL,
        output_text TEXT,
        error TEXT,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY(run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        version INTEGER NOT NULL,
        status TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, path, version),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS memory_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source TEXT NOT NULL,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER NOT NULL DEFAULT 1,
        embedding_status TEXT NOT NULL DEFAULT 'pending',
        embedding_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        owner_kind TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        project_id TEXT,
        source_type TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1',
        status TEXT NOT NULL DEFAULT 'ready',
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(scope, project_id, path, version),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        scope TEXT NOT NULL,
        project_id TEXT,
        chunk_index INTEGER NOT NULL,
        chunk_type TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        embedding_status TEXT NOT NULL DEFAULT 'pending',
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source_id, chunk_index),
        FOREIGN KEY(source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS knowledge_embeddings (
        id TEXT PRIMARY KEY,
        chunk_id TEXT NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(chunk_id, model),
        FOREIGN KEY(chunk_id) REFERENCES knowledge_chunks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS knowledge_citations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        run_id TEXT,
        message_id TEXT,
        query TEXT NOT NULL,
        filters_json TEXT,
        results_json TEXT NOT NULL,
        used_chunk_ids_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        metadata_json TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, id),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS graph_edges (
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        from_node_id TEXT NOT NULL,
        to_node_id TEXT NOT NULL,
        metadata_json TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, id),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        run_id TEXT,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        drift_json TEXT,
        state_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        run_id TEXT,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        run_id TEXT,
        turn_id TEXT,
        parent_message_id TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        time TEXT NOT NULL,
        data_json TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS message_parts (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        part_index INTEGER NOT NULL,
        type TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        run_id TEXT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        lease_owner TEXT,
        lease_expires_at TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS llm_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        api_key TEXT NOT NULL,
        model_name TEXT NOT NULL,
        temperature REAL NOT NULL DEFAULT 0.1,
        timeout_ms INTEGER NOT NULL DEFAULT 120000,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );


      CREATE INDEX IF NOT EXISTS idx_events_project_created ON events(project_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_runs_project_updated ON workflow_runs(project_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_turns_run_started ON agent_turns(run_id, started_at);
      CREATE INDEX IF NOT EXISTS idx_artifacts_project_updated ON artifacts(project_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_project_status ON jobs(project_id, status);
      CREATE INDEX IF NOT EXISTS idx_embeddings_project_owner ON embeddings(project_id, owner_kind, owner_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_sources_scope ON knowledge_sources(scope, project_id, source_type, status);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_scope ON knowledge_chunks(scope, project_id, chunk_type, status, embedding_status);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON knowledge_chunks(source_id, chunk_index);
      CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_chunk ON knowledge_embeddings(chunk_id);
      CREATE INDEX IF NOT EXISTS idx_knowledge_citations_project ON knowledge_citations(project_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_messages_project_time ON messages(project_id, time);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON messages(conversation_id, time);
      CREATE INDEX IF NOT EXISTS idx_message_parts_message_index ON message_parts(message_id, part_index);
    `);
    this.migrateColumn("memory_items", "embedding_id", "TEXT");
    this.migrateGraphTablePrimaryKey("graph_nodes", `
      CREATE TABLE graph_nodes (
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        metadata_json TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, id),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `, "id, project_id, type, label, metadata_json, updated_at");
    this.migrateGraphTablePrimaryKey("graph_edges", `
      CREATE TABLE graph_edges (
        id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        type TEXT NOT NULL,
        from_node_id TEXT NOT NULL,
        to_node_id TEXT NOT NULL,
        metadata_json TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, id),
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `, "id, project_id, type, from_node_id, to_node_id, metadata_json, updated_at");
  }
  migrateColumn(table, column, definition) {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all();
    if (columns.some((row) => row.name === column)) {
      return;
    }
    this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  migrateGraphTablePrimaryKey(table, createSql, columns) {
    const info = this.db.prepare(`PRAGMA table_info(${table})`).all();
    const idPk = info.find((row) => row.name === "id")?.pk;
    const projectPk = info.find((row) => row.name === "project_id")?.pk;
    if (idPk && projectPk) {
      return;
    }
    const legacyTable = `${table}_legacy_pk_migration`;
    this.db.exec(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS ${legacyTable};
      ALTER TABLE ${table} RENAME TO ${legacyTable};
      ${createSql};
      INSERT OR REPLACE INTO ${table} (${columns})
      SELECT ${columns}
      FROM ${legacyTable};
      DROP TABLE ${legacyTable};
      PRAGMA foreign_keys = ON;
    `);
  }
  upsertProject(record, state) {
    const now2 = nowIso();
    this.db.prepare(`
      INSERT INTO projects (
        id, slug, title, idea, project_root, total_chapters, chapter_word_target,
        current_stage, run_status, state_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        title = excluded.title,
        idea = excluded.idea,
        project_root = excluded.project_root,
        total_chapters = excluded.total_chapters,
        chapter_word_target = excluded.chapter_word_target,
        current_stage = excluded.current_stage,
        state_json = excluded.state_json,
        updated_at = excluded.updated_at
    `).run(
      record.id,
      record.slug,
      record.title,
      record.idea,
      record.projectRoot,
      record.totalChapters,
      record.chapterWordTarget,
      state.runtime.stage,
      state.runtime.autopilot?.running ? "running" : "idle",
      jsonString(state),
      record.createdAt,
      now2
    );
    this.recordArtifact({
      projectId: record.id,
      kind: "state",
      path: ".ai-novel/state.json",
      status: "completed",
      metadata: { stage: state.runtime.stage }
    });
  }
  updateProjectState(projectId, state) {
    const now2 = nowIso();
    const existing = this.db.prepare("SELECT state_json FROM projects WHERE id = ?").get(projectId);
    if (!existing) {
      return false;
    }
    const existingState = readJson(existing.state_json, null);
    if (stateChangeFingerprint(existingState) === stateChangeFingerprint(state)) {
      return false;
    }
    this.db.prepare(`
      UPDATE projects
      SET current_stage = ?, run_status = ?, state_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      state.runtime.stage,
      state.runtime.autopilot?.running ? "running" : "idle",
      jsonString(state),
      now2,
      projectId
    );
    this.recordEvent(projectId, null, "PROJECT_STATE_UPDATED", {
      stage: state.runtime.stage,
      statusMessage: state.runtime.statusMessage,
      autopilot: state.runtime.autopilot ?? null
    });
    return true;
  }
  deleteProject(projectId) {
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    return true;
  }
  listProjects() {
    return this.db.prepare(`
      SELECT id, slug, title, idea, created_at, total_chapters, chapter_word_target, project_root
      FROM projects
      ORDER BY created_at DESC
    `).all().map((row) => ({
      id: String(row.id),
      slug: String(row.slug),
      title: String(row.title),
      idea: String(row.idea),
      createdAt: String(row.created_at),
      totalChapters: Number(row.total_chapters),
      chapterWordTarget: Number(row.chapter_word_target),
      projectRoot: String(row.project_root)
    }));
  }
  pruneProjectsExcept(projectIds) {
    const keep = new Set(projectIds);
    const existing = this.listProjects();
    const removed = [];
    for (const project of existing) {
      if (keep.has(project.id)) {
        continue;
      }
      this.db.prepare("DELETE FROM projects WHERE id = ?").run(project.id);
      removed.push(project.id);
    }
    return removed;
  }
  getProject(projectId) {
    return this.listProjects().find((project) => project.id === projectId) ?? null;
  }
  createRun(input) {
    const now2 = nowIso();
    this.db.prepare(`
      INSERT INTO workflow_runs (
        id, project_id, project_root, parent_run_id, kind, status, goal, stage,
        started_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.projectId,
      input.projectRoot,
      input.parentRunId ?? null,
      input.kind,
      input.status,
      input.goal,
      input.stage,
      now2,
      now2
    );
    this.recordEvent(input.projectId, input.id, "WORKFLOW_RUN_STARTED", input);
  }
  updateRun(runId, status, patch = {}) {
    const now2 = nowIso();
    this.db.prepare(`
      UPDATE workflow_runs
      SET status = ?, stage = COALESCE(?, stage), error = COALESCE(?, error),
          updated_at = ?, completed_at = CASE WHEN ? IN ('blocked', 'failed', 'completed') THEN ? ELSE completed_at END
      WHERE id = ?
    `).run(status, patch.stage ?? null, patch.error ?? null, now2, status, now2, runId);
    const run = this.db.prepare("SELECT project_id FROM workflow_runs WHERE id = ?").get(runId);
    this.recordEvent(typeof run?.project_id === "string" ? run.project_id : null, runId, "WORKFLOW_RUN_UPDATED", {
      status,
      error: patch.error ?? null,
      stage: patch.stage ?? null
    });
  }
  recoverStaleRuns(options = {}) {
    const now2 = nowIso();
    const olderThan = (options.olderThan ?? new Date(Date.now() - 20 * 60 * 1e3)).toISOString();
    const error = options.error ?? "stale_run_recovered";
    const rows = this.db.prepare(`
      SELECT run.*
      FROM workflow_runs run
      WHERE run.status IN ('running', 'paused')
        AND run.updated_at <= ?
        AND NOT EXISTS (
          SELECT 1
          FROM agent_turns turn
          WHERE turn.run_id = run.id
            AND turn.updated_at > ?
        )
        AND NOT EXISTS (
          SELECT 1
          FROM jobs job
          WHERE job.run_id = run.id
            AND job.status IN ('running', 'paused')
            AND (job.lease_expires_at IS NULL OR job.lease_expires_at > ?)
        )
      ORDER BY run.updated_at ASC
    `).all(olderThan, olderThan, now2);
    for (const row of rows) {
      this.db.prepare(`
        UPDATE workflow_runs
        SET status = 'failed', error = ?, updated_at = ?, completed_at = ?
        WHERE id = ?
      `).run(error, now2, now2, String(row.id));
      this.recordEvent(
        typeof row.project_id === "string" ? row.project_id : null,
        typeof row.id === "string" ? row.id : null,
        "WORKFLOW_RUN_RECOVERED",
        {
          id: row.id,
          previousStatus: row.status,
          kind: row.kind,
          stage: row.stage,
          reason: error
        }
      );
    }
    return rows.length;
  }
  recordAgentTurn(input) {
    const now2 = nowIso();
    this.db.prepare(`
      INSERT INTO agent_turns (
        id, run_id, turn_id, role, discussion_stage, status, model, input_json,
        output_text, error, started_at, updated_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        model = excluded.model,
        input_json = excluded.input_json,
        output_text = excluded.output_text,
        error = excluded.error,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `).run(
      input.turnId,
      input.runId,
      input.turnId,
      input.role,
      input.stage,
      input.status,
      input.model ?? null,
      jsonString(input.input),
      input.output ?? null,
      input.error ?? null,
      now2,
      now2,
      input.status === "completed" || input.status === "failed" ? now2 : null
    );
    this.db.prepare(`
      UPDATE workflow_runs
      SET updated_at = ?
      WHERE id = ?
    `).run(now2, input.runId);
    const run = this.db.prepare("SELECT project_id FROM workflow_runs WHERE id = ?").get(input.runId);
    this.recordEvent(typeof run?.project_id === "string" ? run.project_id : null, input.runId, "AGENT_TURN_UPDATED", {
      turnId: input.turnId,
      role: input.role,
      status: input.status,
      discussionStage: input.stage
    });
  }
  recordArtifact(input) {
    const now2 = nowIso();
    const version = input.version ?? 1;
    const artifactId = `${input.projectId}:${input.path}:${version}`;
    this.db.prepare(`
      INSERT INTO artifacts (id, project_id, kind, path, version, status, metadata_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, path, version) DO UPDATE SET
        kind = excluded.kind,
        status = excluded.status,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).run(
      artifactId,
      input.projectId,
      input.kind,
      input.path,
      version,
      input.status ?? "completed",
      jsonString(input.metadata ?? {}),
      now2,
      now2
    );
    this.recordEvent(input.projectId, null, "ARTIFACT_RECORDED", {
      kind: input.kind,
      path: input.path,
      version,
      status: input.status ?? "completed"
    });
  }
  recordMemory(projectId, input) {
    const now2 = nowIso();
    const metadata = input.metadata ?? {};
    const metadataPath = typeof metadata === "object" && metadata && "path" in metadata ? String(metadata.path) : "";
    if (metadataPath) {
      const existing = this.db.prepare(`
        SELECT id, embedding_id
        FROM memory_items
        WHERE project_id = ?
          AND source = ?
          AND kind = ?
          AND json_extract(metadata_json, '$.path') = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `).get(projectId, input.source, input.kind, metadataPath);
      if (existing?.id) {
        const embeddingId2 = typeof existing.embedding_id === "string" ? existing.embedding_id : input.embedding ? makeId("emb") : null;
        this.db.prepare(`
          UPDATE memory_items
          SET content = ?, importance = ?, embedding_status = ?, embedding_id = ?, metadata_json = ?, updated_at = ?
          WHERE id = ? AND project_id = ?
        `).run(
          input.content,
          input.importance ?? 1,
          input.embedding ? "ready" : "pending",
          embeddingId2,
          jsonString(metadata),
          now2,
          String(existing.id),
          projectId
        );
        if (input.embedding && embeddingId2) {
          this.upsertEmbedding(projectId, {
            id: embeddingId2,
            ownerKind: "memory",
            ownerId: String(existing.id),
            model: input.embedding.model,
            vector: input.embedding.vector
          });
        }
        this.recordEvent(projectId, null, "MEMORY_ITEM_UPDATED", input);
        return String(existing.id);
      }
    }
    const id = makeId("mem");
    const embeddingId = input.embedding ? makeId("emb") : null;
    this.db.prepare(`
      INSERT INTO memory_items (
        id, project_id, source, kind, content, importance, embedding_status,
        embedding_id, metadata_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      projectId,
      input.source,
      input.kind,
      input.content,
      input.importance ?? 1,
      input.embedding ? "ready" : "pending",
      embeddingId,
      jsonString(metadata),
      now2,
      now2
    );
    if (input.embedding && embeddingId) {
      this.upsertEmbedding(projectId, {
        id: embeddingId,
        ownerKind: "memory",
        ownerId: id,
        model: input.embedding.model,
        vector: input.embedding.vector
      });
    }
    this.recordEvent(projectId, null, "MEMORY_ITEM_RECORDED", input);
    return id;
  }
  upsertEmbedding(projectId, input) {
    const now2 = nowIso();
    const id = input.id ?? makeId("emb");
    this.db.prepare(`
      INSERT INTO embeddings (
        id, project_id, owner_kind, owner_id, model, dimensions, vector_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        model = excluded.model,
        dimensions = excluded.dimensions,
        vector_json = excluded.vector_json,
        updated_at = excluded.updated_at
    `).run(
      id,
      projectId,
      input.ownerKind,
      input.ownerId,
      input.model,
      input.vector.length,
      jsonString(input.vector),
      now2,
      now2
    );
    if (input.ownerKind === "memory") {
      this.db.prepare(`
        UPDATE memory_items
        SET embedding_status = 'ready', embedding_id = ?, updated_at = ?
        WHERE id = ? AND project_id = ?
      `).run(id, now2, input.ownerId, projectId);
    }
    this.recordEvent(projectId, null, "EMBEDDING_UPSERTED", {
      id,
      ownerKind: input.ownerKind,
      ownerId: input.ownerId,
      model: input.model,
      dimensions: input.vector.length
    });
    return id;
  }
  markMemoryEmbeddingFailed(projectId, memoryId, error) {
    this.db.prepare(`
      UPDATE memory_items
      SET embedding_status = 'failed', updated_at = ?
      WHERE id = ? AND project_id = ?
    `).run(nowIso(), memoryId, projectId);
    this.recordEvent(projectId, null, "MEMORY_EMBEDDING_FAILED", { memoryId, error });
  }
  listPendingMemoryForEmbedding(projectId, limit = 50) {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    if (projectId) {
      return this.db.prepare(`
        SELECT *
        FROM memory_items
        WHERE project_id = ?
          AND embedding_status IN ('pending', 'failed')
        ORDER BY importance DESC, updated_at ASC
        LIMIT ${safeLimit}
      `).all(projectId);
    }
    return this.db.prepare(`
      SELECT *
      FROM memory_items
      WHERE embedding_status IN ('pending', 'failed')
      ORDER BY importance DESC, updated_at ASC
      LIMIT ${safeLimit}
    `).all();
  }
  queryMemoryByEmbedding(projectId, queryVector, limit = 8) {
    const rows = this.db.prepare(`
      SELECT memory_items.*, embeddings.vector_json, embeddings.model
      FROM memory_items
      JOIN embeddings ON embeddings.id = memory_items.embedding_id
      WHERE memory_items.project_id = ?
        AND memory_items.embedding_status = 'ready'
      ORDER BY memory_items.updated_at DESC
      LIMIT 200
    `).all(projectId);
    return rows.map((row) => {
      const vector = readJson(row.vector_json, []);
      return {
        ...row,
        metadata: readJson(row.metadata_json, {}),
        score: cosineSimilarity(queryVector, vector) * 100 + Number(row.importance || 1)
      };
    }).sort((a, b) => Number(b.score) - Number(a.score) || String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, limit);
  }
  recallMemory(projectId, query = "", limit = 8, options = {}) {
    if (options.embedding?.length) {
      const embedded = this.queryMemoryByEmbedding(projectId, options.embedding, limit);
      if (embedded.length > 0) {
        return embedded;
      }
    }
    const tokens = query.toLowerCase().split(/[\s,，。！？!?.、:：；;]+/).filter((token) => token.length >= 2).slice(0, 8);
    const rows = this.db.prepare(`
      SELECT *
      FROM memory_items
      WHERE project_id = ?
      ORDER BY importance DESC, updated_at DESC
      LIMIT 80
    `).all(projectId);
    return rows.map((row) => {
      const content = String(row.content || "").toLowerCase();
      const kind = String(row.kind || "").toLowerCase();
      const score = Number(row.importance || 1) * 10 + tokens.filter((token) => content.includes(token) || kind.includes(token)).length * 20;
      return {
        ...row,
        metadata: readJson(row.metadata_json, {}),
        score
      };
    }).sort((a, b) => Number(b.score) - Number(a.score) || String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, limit);
  }
  upsertKnowledgeSource(input) {
    const now2 = nowIso();
    const version = input.version || "1";
    const projectId = input.scope === "project" ? input.projectId ?? null : null;
    const id = makeStableId("ks", `${input.scope}:${projectId || "global"}:${input.path}:${version}`);
    const existing = this.db.prepare("SELECT content_hash FROM knowledge_sources WHERE id = ?").get(id);
    const changed = Boolean(existing && existing.content_hash !== input.contentHash);
    this.db.prepare(`
      INSERT INTO knowledge_sources (
        id, scope, project_id, source_type, path, title, content_hash, version,
        status, metadata_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        scope = excluded.scope,
        project_id = excluded.project_id,
        source_type = excluded.source_type,
        path = excluded.path,
        title = excluded.title,
        content_hash = excluded.content_hash,
        version = excluded.version,
        status = excluded.status,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `).run(
      id,
      input.scope,
      projectId,
      input.sourceType,
      input.path,
      input.title,
      input.contentHash,
      version,
      input.status ?? "ready",
      jsonString(input.metadata ?? {}),
      now2,
      now2
    );
    if (changed) {
      this.db.prepare(`
        UPDATE knowledge_chunks
        SET status = 'superseded', embedding_status = 'superseded', updated_at = ?
        WHERE source_id = ?
      `).run(now2, id);
    }
    this.recordEvent(projectId, null, changed ? "KNOWLEDGE_SOURCE_UPDATED" : "KNOWLEDGE_SOURCE_UPSERTED", {
      id,
      scope: input.scope,
      projectId,
      sourceType: input.sourceType,
      path: input.path,
      changed
    });
    return { id, changed };
  }
  replaceKnowledgeChunks(sourceId, chunks) {
    const now2 = nowIso();
    this.db.prepare(`
      UPDATE knowledge_chunks
      SET status = 'superseded', embedding_status = CASE WHEN embedding_status = 'ready' THEN 'superseded' ELSE embedding_status END, updated_at = ?
      WHERE source_id = ?
    `).run(now2, sourceId);
    const source = this.db.prepare("SELECT project_id FROM knowledge_sources WHERE id = ?").get(sourceId);
    const activeIds = [];
    chunks.forEach((chunk, index) => {
      const chunkId = chunk.id || makeStableId("kc", `${sourceId}:${index}`);
      const projectId = chunk.scope === "project" ? chunk.projectId ?? null : null;
      this.db.prepare(`
        INSERT INTO knowledge_chunks (
          id, source_id, scope, project_id, chunk_index, chunk_type, content,
          content_hash, status, embedding_status, metadata_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_id, chunk_index) DO UPDATE SET
          scope = excluded.scope,
          project_id = excluded.project_id,
          chunk_type = excluded.chunk_type,
          content = excluded.content,
          content_hash = excluded.content_hash,
          status = excluded.status,
          embedding_status = excluded.embedding_status,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `).run(
        chunkId,
        sourceId,
        chunk.scope,
        projectId,
        index,
        chunk.chunkType,
        chunk.content,
        chunk.contentHash,
        chunk.status ?? "ready",
        chunk.embedding ? "ready" : "pending",
        jsonString(chunk.metadata ?? {}),
        now2,
        now2
      );
      if (chunk.embedding) {
        this.upsertKnowledgeEmbedding(chunkId, chunk.embedding.model, chunk.embedding.vector);
      }
      activeIds.push(chunkId);
    });
    this.recordEvent(typeof source?.project_id === "string" ? source.project_id : null, null, "KNOWLEDGE_CHUNKS_REPLACED", {
      sourceId,
      chunks: chunks.length
    });
    return activeIds;
  }
  upsertKnowledgeEmbedding(chunkId, model, vector) {
    const now2 = nowIso();
    const id = makeStableId("kemb", `${chunkId}:${model}`);
    this.db.prepare(`
      INSERT INTO knowledge_embeddings (
        id, chunk_id, model, dimensions, vector_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chunk_id, model) DO UPDATE SET
        dimensions = excluded.dimensions,
        vector_json = excluded.vector_json,
        updated_at = excluded.updated_at
    `).run(id, chunkId, model, vector.length, jsonString(vector), now2, now2);
    this.db.prepare(`
      UPDATE knowledge_chunks
      SET embedding_status = 'ready', updated_at = ?
      WHERE id = ?
    `).run(now2, chunkId);
    return id;
  }
  markKnowledgeEmbeddingFailed(chunkId, error) {
    this.db.prepare(`
      UPDATE knowledge_chunks
      SET embedding_status = 'failed', updated_at = ?
      WHERE id = ?
    `).run(nowIso(), chunkId);
    const row = this.db.prepare("SELECT project_id, source_id FROM knowledge_chunks WHERE id = ?").get(chunkId);
    this.recordEvent(typeof row?.project_id === "string" ? row.project_id : null, null, "KNOWLEDGE_EMBEDDING_FAILED", {
      chunkId,
      sourceId: typeof row?.source_id === "string" ? row.source_id : null,
      error
    });
  }
  listPendingKnowledgeChunks(options = {}) {
    const safeLimit = Math.max(1, Math.min(1e3, Math.floor(options.limit ?? 100)));
    const conditions = ["embedding_status IN ('pending', 'failed')", "status = 'ready'"];
    const values = [];
    if (options.scope) {
      conditions.push("scope = ?");
      values.push(options.scope);
    }
    if (typeof options.projectId === "string") {
      conditions.push("project_id = ?");
      values.push(options.projectId);
    }
    const rows = this.db.prepare(`
      SELECT *
      FROM knowledge_chunks
      WHERE ${conditions.join(" AND ")}
      ORDER BY updated_at ASC
      LIMIT ${safeLimit}
    `).all(...values);
    return rows.map((row) => ({
      ...row,
      metadata: readJson(row.metadata_json, {})
    }));
  }
  queryKnowledgeByEmbedding(queryVector, options = {}) {
    const rows = this.listKnowledgeCandidateRows(options, true);
    return rows.map((row) => {
      const vector = readJson(row.vector_json, []);
      return this.mapKnowledgeRecallRow(row, cosineSimilarity(queryVector, vector) * 100);
    }).sort((left, right) => Number(right.score) - Number(left.score) || String(right.updated_at).localeCompare(String(left.updated_at))).slice(0, Math.max(1, Math.min(50, Math.floor(options.limit ?? 8))));
  }
  recallKnowledge(query = "", options = {}) {
    const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 8)));
    if (options.embedding?.length) {
      const embedded = this.queryKnowledgeByEmbedding(options.embedding, { ...options, limit });
      if (embedded.length > 0) {
        return embedded;
      }
    }
    const tokens = query.toLowerCase().split(/[\s,，。！？!?.、:：；;]+/).filter((token) => token.length >= 2).slice(0, 12);
    const rows = this.listKnowledgeCandidateRows(options, false);
    return rows.map((row) => {
      const content = String(row.content || "").toLowerCase();
      const sourceType = String(row.source_type || "").toLowerCase();
      const chunkType = String(row.chunk_type || "").toLowerCase();
      const tokenHits = tokens.filter((token) => content.includes(token) || sourceType.includes(token) || chunkType.includes(token));
      const score = tokenHits.length * 25 + (row.scope === "project" ? 8 : 4);
      return this.mapKnowledgeRecallRow(row, score);
    }).sort((left, right) => Number(right.score) - Number(left.score) || String(right.updated_at).localeCompare(String(left.updated_at))).slice(0, limit);
  }
  recordKnowledgeCitation(input) {
    const now2 = nowIso();
    this.db.prepare(`
      INSERT INTO knowledge_citations (
        id, project_id, run_id, message_id, query, filters_json,
        results_json, used_chunk_ids_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId("kcite"),
      input.projectId,
      input.runId ?? null,
      input.messageId ?? null,
      input.query,
      jsonString(input.filters ?? {}),
      jsonString(input.results ?? []),
      jsonString(input.usedChunkIds ?? []),
      now2
    );
    this.recordEvent(input.projectId, input.runId ?? null, "KNOWLEDGE_CITATION_RECORDED", {
      messageId: input.messageId ?? null,
      resultCount: Array.isArray(input.results) ? input.results.length : 0,
      usedChunkIds: input.usedChunkIds ?? []
    });
  }
  getKnowledgeSummary(projectId) {
    const scalar = (sql, ...values) => Number(this.db.prepare(sql).get(...values)?.count || 0);
    const latestEvaluationRow = this.db.prepare(`
      SELECT *
      FROM events
      WHERE project_id = ? AND type = 'KNOWLEDGE_EVALUATION_COMPLETED'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(projectId);
    const latestEvaluation = latestEvaluationRow ? {
      ...compactDbRow(latestEvaluationRow),
      payload: readJson(latestEvaluationRow.payload_json, {})
    } : null;
    return {
      sources: this.db.prepare(`
        SELECT *
        FROM knowledge_sources
        WHERE scope = 'global' OR project_id = ?
        ORDER BY updated_at DESC
        LIMIT 24
      `).all(projectId).map(compactDbRow),
      chunks: this.db.prepare(`
        SELECT knowledge_chunks.*, knowledge_sources.source_type, knowledge_sources.path AS source_path, knowledge_sources.title AS source_title
        FROM knowledge_chunks
        JOIN knowledge_sources ON knowledge_sources.id = knowledge_chunks.source_id
        WHERE knowledge_chunks.status = 'ready'
          AND (knowledge_chunks.scope = 'global' OR knowledge_chunks.project_id = ?)
        ORDER BY knowledge_chunks.updated_at DESC
        LIMIT 24
      `).all(projectId).map(compactDbRow),
      citations: this.db.prepare(`
        SELECT *
        FROM knowledge_citations
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT 12
      `).all(projectId).map(compactDbRow),
      jobs: this.db.prepare(`
        SELECT *
        FROM jobs
        WHERE project_id = ?
          AND kind LIKE 'knowledge_%'
          AND status IN ('idle', 'running', 'paused', 'failed', 'completed')
        ORDER BY updated_at DESC
        LIMIT 12
      `).all(projectId).map(mapJobRow),
      latestEvaluation,
      summary: {
        globalSources: scalar("SELECT COUNT(*) AS count FROM knowledge_sources WHERE scope = 'global' AND status = 'ready'"),
        projectSources: scalar("SELECT COUNT(*) AS count FROM knowledge_sources WHERE scope = 'project' AND project_id = ? AND status = 'ready'", projectId),
        readyChunks: scalar(`
          SELECT COUNT(*) AS count
          FROM knowledge_chunks
          WHERE status = 'ready'
            AND embedding_status = 'ready'
            AND (scope = 'global' OR project_id = ?)
        `, projectId),
        pendingChunks: scalar(`
          SELECT COUNT(*) AS count
          FROM knowledge_chunks
          WHERE status = 'ready'
            AND embedding_status = 'pending'
            AND (scope = 'global' OR project_id = ?)
        `, projectId),
        failedChunks: scalar(`
          SELECT COUNT(*) AS count
          FROM knowledge_chunks
          WHERE status = 'ready'
            AND embedding_status = 'failed'
            AND (scope = 'global' OR project_id = ?)
        `, projectId)
      }
    };
  }
  listKnowledgeCandidateRows(options = {}, requireEmbedding = false) {
    const scopes = options.scopes?.length ? options.scopes : ["project", "global"];
    const values = [];
    const visibility = [];
    if (scopes.includes("global")) {
      visibility.push("(knowledge_chunks.scope = 'global' AND knowledge_chunks.project_id IS NULL)");
    }
    if (scopes.includes("project") && options.projectId) {
      visibility.push("(knowledge_chunks.scope = 'project' AND knowledge_chunks.project_id = ?)");
      values.push(options.projectId);
    }
    if (visibility.length === 0) {
      return [];
    }
    const conditions = [
      "knowledge_chunks.status = 'ready'",
      `(${visibility.join(" OR ")})`
    ];
    if (requireEmbedding) {
      conditions.push("knowledge_chunks.embedding_status = 'ready'");
    }
    if (options.sourceTypes?.length) {
      conditions.push(`knowledge_sources.source_type IN (${options.sourceTypes.map(() => "?").join(", ")})`);
      values.push(...options.sourceTypes);
    }
    if (options.chunkTypes?.length) {
      conditions.push(`knowledge_chunks.chunk_type IN (${options.chunkTypes.map(() => "?").join(", ")})`);
      values.push(...options.chunkTypes);
    }
    const safeLimit = Math.max(10, Math.min(1e3, Math.floor((options.limit ?? 8) * 80)));
    return this.db.prepare(`
      SELECT
        knowledge_chunks.*,
        knowledge_sources.source_type,
        knowledge_sources.path AS source_path,
        knowledge_sources.title AS source_title,
        knowledge_sources.metadata_json AS source_metadata_json,
        knowledge_embeddings.vector_json,
        knowledge_embeddings.model
      FROM knowledge_chunks
      JOIN knowledge_sources ON knowledge_sources.id = knowledge_chunks.source_id
      ${requireEmbedding ? "JOIN knowledge_embeddings ON knowledge_embeddings.chunk_id = knowledge_chunks.id" : "LEFT JOIN knowledge_embeddings ON knowledge_embeddings.chunk_id = knowledge_chunks.id"}
      WHERE ${conditions.join(" AND ")}
      ORDER BY knowledge_chunks.updated_at DESC
      LIMIT ${safeLimit}
    `).all(...values);
  }
  mapKnowledgeRecallRow(row, score) {
    return {
      ...compactDbRow(row),
      metadata: readJson(row.metadata_json, {}),
      sourceMetadata: readJson(row.source_metadata_json, {}),
      source: {
        id: row.source_id,
        sourceType: row.source_type,
        path: row.source_path,
        title: row.source_title
      },
      score
    };
  }
  upsertGraph(projectId, nodes, edges) {
    for (const node of nodes) {
      this.db.prepare(`
        INSERT INTO graph_nodes (id, project_id, type, label, metadata_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, id) DO UPDATE SET
          type = excluded.type,
          label = excluded.label,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `).run(node.id, projectId, node.type, node.label, jsonString(node.properties ?? {}), node.updatedAt || nowIso());
    }
    for (const edge of edges) {
      this.db.prepare(`
        INSERT INTO graph_edges (id, project_id, type, from_node_id, to_node_id, metadata_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, id) DO UPDATE SET
          type = excluded.type,
          from_node_id = excluded.from_node_id,
          to_node_id = excluded.to_node_id,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
      `).run(edge.id, projectId, edge.type, edge.from, edge.to, jsonString(edge.properties ?? {}), edge.updatedAt || nowIso());
    }
    this.recordEvent(projectId, null, "GRAPH_SYNCED", {
      nodes: nodes.length,
      edges: edges.length
    });
  }
  getGraph(projectId) {
    return {
      nodes: this.db.prepare(`
        SELECT *
        FROM graph_nodes
        WHERE project_id = ?
        ORDER BY updated_at DESC
      `).all(projectId),
      edges: this.db.prepare(`
        SELECT *
        FROM graph_edges
        WHERE project_id = ?
        ORDER BY updated_at DESC
      `).all(projectId)
    };
  }
  recordCheckpoint(input) {
    const now2 = nowIso();
    this.db.prepare(`
      INSERT INTO checkpoints (id, project_id, run_id, label, path, drift_json, state_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      makeId("chk"),
      input.projectId,
      input.runId ?? null,
      input.label,
      input.path,
      jsonString(input.drift ?? null),
      jsonString(input.state ?? null),
      now2
    );
    this.recordArtifact({
      projectId: input.projectId,
      kind: "checkpoint",
      path: input.path,
      status: "completed",
      metadata: { label: input.label, drift: input.drift ?? null }
    });
  }
  recordEvent(projectId, runId, type, payload) {
    this.db.prepare(`
      INSERT INTO events (id, project_id, run_id, type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(makeId("evt"), projectId, runId, type, jsonString(payload), nowIso());
  }
  recordMessage(message, parts = []) {
    const now2 = nowIso();
    const updatedAt = message.updatedAt || now2;
    this.db.prepare(`
      INSERT INTO messages (
        id, project_id, conversation_id, run_id, turn_id, parent_message_id,
        type, status, time, data_json, metadata_json, created_at, updated_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        conversation_id = excluded.conversation_id,
        run_id = excluded.run_id,
        turn_id = excluded.turn_id,
        parent_message_id = excluded.parent_message_id,
        type = excluded.type,
        status = excluded.status,
        time = messages.time,
        data_json = excluded.data_json,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `).run(
      message.messageId,
      message.projectId || "",
      message.conversationId,
      message.runId ?? null,
      message.turnId ?? null,
      message.parentMessageId ?? null,
      message.type,
      message.status,
      message.time,
      jsonString(message.data),
      jsonString(message.metadata ?? {}),
      message.createdAt || message.time,
      updatedAt,
      message.completedAt ?? null
    );
    if (parts.length > 0) {
      this.db.prepare("DELETE FROM message_parts WHERE message_id = ?").run(message.messageId);
      const insertPart = this.db.prepare(`
        INSERT INTO message_parts (id, message_id, part_index, type, data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      parts.forEach((part, index) => {
        insertPart.run(
          part.id || `${message.messageId}:part:${index}`,
          message.messageId,
          Number.isFinite(part.index) ? part.index : index,
          part.type,
          jsonString(part.data),
          part.createdAt || updatedAt
        );
      });
    }
    this.recordEvent(message.projectId || null, message.runId ?? null, "MESSAGE_RECORDED", {
      messageId: message.messageId,
      conversationId: message.conversationId,
      turnId: message.turnId ?? null,
      type: message.type,
      status: message.status
    });
  }
  countMessages(projectId, options = {}) {
    const row = options.conversationId ? this.db.prepare(`
          SELECT count(*) AS count
          FROM messages
          WHERE project_id = ? AND conversation_id = ?
        `).get(projectId, options.conversationId) : this.db.prepare(`
          SELECT count(*) AS count
          FROM messages
          WHERE project_id = ?
        `).get(projectId);
    return Number(row?.count || 0);
  }
  listMessages(projectId, options = {}) {
    const limit = Math.max(1, Math.min(500, Math.floor(options.limit ?? 80)));
    const offset = Math.max(0, Math.floor(options.offset ?? 0));
    const rows = options.conversationId ? this.db.prepare(`
          SELECT *
          FROM messages
          WHERE project_id = ? AND conversation_id = ?
          ORDER BY time DESC, created_at DESC
          LIMIT ? OFFSET ?
        `).all(projectId, options.conversationId, limit, offset) : this.db.prepare(`
          SELECT *
          FROM messages
          WHERE project_id = ?
          ORDER BY time DESC, created_at DESC
          LIMIT ? OFFSET ?
        `).all(projectId, limit, offset);
    return rows.map((row) => ({
      ...compactDbRow(row),
      data: readJson(row.data_json, {}),
      metadata: readJson(row.metadata_json, {}),
      parts: this.db.prepare(`
        SELECT *
        FROM message_parts
        WHERE message_id = ?
        ORDER BY part_index ASC
      `).all(String(row.id)).map((part) => ({
        ...part,
        data: readJson(part.data_json, {})
      }))
    }));
  }
  markStreamingMessagesFailed(projectId, options = {}) {
    const now2 = nowIso();
    const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 8)));
    const rows = options.conversationId ? this.db.prepare(`
          SELECT id, data_json, metadata_json
          FROM messages
          WHERE project_id = ?
            AND conversation_id = ?
            AND status = 'streaming'
          ORDER BY created_at DESC
          LIMIT ?
        `).all(projectId, options.conversationId, limit) : this.db.prepare(`
          SELECT id, data_json, metadata_json
          FROM messages
          WHERE project_id = ?
            AND status = 'streaming'
          ORDER BY created_at DESC
          LIMIT ?
        `).all(projectId, limit);
    let changed = 0;
    for (const row of rows) {
      const metadata = readJson(row.metadata_json, {});
      if (typeof options.chapterNumber === "number" && Number(metadata.chapterNumber) !== options.chapterNumber) {
        continue;
      }
      const data = readJson(row.data_json, {});
      const statusText = "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u88AB\u4E2D\u65AD\uFF0C\u7B49\u5F85\u6062\u590D\u540E\u91CD\u65B0\u6267\u884C\u3002";
      const statusDetail = options.reason || "";
      const nextData = {
        ...data,
        phase: "failed",
        statusText,
        statusDetail
      };
      const nextMetadata = {
        ...metadata,
        phase: "failed",
        statusText,
        statusDetail,
        interruptedAt: now2,
        interruptedReason: statusDetail
      };
      this.db.prepare(`
        UPDATE messages
        SET status = 'failed',
            data_json = ?,
            metadata_json = ?,
            updated_at = ?,
            completed_at = ?
        WHERE id = ?
      `).run(
        jsonString(nextData),
        jsonString(nextMetadata),
        now2,
        now2,
        String(row.id)
      );
      const parts = this.db.prepare(`
        SELECT id, type, data_json, part_index
        FROM message_parts
        WHERE message_id = ?
        ORDER BY part_index ASC
      `).all(String(row.id));
      for (const part of parts) {
        const partType = String(part.type || "");
        const partData = readJson(part.data_json, {});
        if (partType === "json") {
          this.db.prepare(`
            UPDATE message_parts
            SET data_json = ?
            WHERE id = ?
          `).run(jsonString({
            ...partData,
            status: "failed",
            phase: "failed",
            statusText,
            statusDetail
          }), String(part.id));
        }
        if (partType === "markdown") {
          const text = typeof partData.text === "string" ? partData.text : "";
          if (text) {
            const patchedText = text.replace(/状态：请求已提交给 LLM，等待模型开始响应。/g, `\u72B6\u6001\uFF1A${statusText}`).replace(/状态：LLM 已开始响应，正在返回首段内容。/g, `\u72B6\u6001\uFF1A${statusText}`).replace(/状态：LLM 正在持续返回内容。/g, `\u72B6\u6001\uFF1A${statusText}`).replace(/如果模型或网络暂时没有首段返回，这条消息会保持动态等待状态。/g, statusDetail || "\u7CFB\u7EDF\u4F1A\u4ECE\u6570\u636E\u5E93\u4EFB\u52A1\u6062\u590D\u540E\u91CD\u65B0\u6267\u884C\u3002").replace(/返回内容会持续合并到这一条 agent 消息中。/g, statusDetail || "\u7CFB\u7EDF\u4F1A\u4ECE\u6570\u636E\u5E93\u4EFB\u52A1\u6062\u590D\u540E\u91CD\u65B0\u6267\u884C\u3002");
            this.db.prepare(`
            UPDATE message_parts
            SET data_json = ?
            WHERE id = ?
          `).run(jsonString({
              ...partData,
              text: patchedText
            }), String(part.id));
          }
        }
      }
      changed += 1;
    }
    if (changed > 0) {
      this.recordEvent(projectId, null, "STREAMING_MESSAGES_MARKED_FAILED", {
        conversationId: options.conversationId || null,
        chapterNumber: options.chapterNumber ?? null,
        count: changed,
        reason: options.reason || ""
      });
    }
    return changed;
  }
  createJob(input) {
    const now2 = nowIso();
    const id = makeId("job");
    this.db.prepare(`
      INSERT INTO jobs (id, project_id, run_id, kind, status, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.projectId, input.runId ?? null, input.kind, input.status, jsonString(input.payload ?? {}), now2, now2);
    this.recordEvent(input.projectId, input.runId ?? null, "JOB_CREATED", { id, kind: input.kind, status: input.status });
    return id;
  }
  updateJobPayload(jobId, payload) {
    this.db.prepare(`
      UPDATE jobs
      SET payload_json = ?, updated_at = ?
      WHERE id = ?
    `).run(jsonString(payload ?? {}), nowIso(), jobId);
    const row = this.db.prepare("SELECT project_id, run_id, kind FROM jobs WHERE id = ?").get(jobId);
    this.recordEvent(typeof row?.project_id === "string" ? row.project_id : null, typeof row?.run_id === "string" ? row.run_id : null, "JOB_PAYLOAD_UPDATED", {
      id: jobId,
      kind: typeof row?.kind === "string" ? row.kind : null,
      payload: payload ?? {}
    });
  }
  updateJob(jobId, status, patch = {}) {
    this.db.prepare(`
      UPDATE jobs
      SET status = ?, lease_owner = COALESCE(?, lease_owner), lease_expires_at = COALESCE(?, lease_expires_at), updated_at = ?
      WHERE id = ?
    `).run(status, patch.leaseOwner ?? null, patch.leaseExpiresAt ?? null, nowIso(), jobId);
    const job = this.db.prepare("SELECT project_id, run_id, kind FROM jobs WHERE id = ?").get(jobId);
    this.recordEvent(typeof job?.project_id === "string" ? job.project_id : null, typeof job?.run_id === "string" ? job.run_id : null, "JOB_UPDATED", {
      id: jobId,
      kind: typeof job?.kind === "string" ? job.kind : null,
      status,
      leaseOwner: patch.leaseOwner ?? null,
      leaseExpiresAt: patch.leaseExpiresAt ?? null
    });
  }
  listRunnableJobs(kind, now2 = /* @__PURE__ */ new Date(), options = {}) {
    const nowValue = now2.toISOString();
    const statuses = options.includeIdle ? "'idle', 'running', 'paused'" : "'running', 'paused'";
    const rows = kind ? this.db.prepare(`
          SELECT * FROM jobs
          WHERE kind = ?
            AND status IN (${statuses})
            AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
          ORDER BY updated_at ASC
        `).all(kind, nowValue) : this.db.prepare(`
          SELECT * FROM jobs
          WHERE status IN (${statuses})
            AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
          ORDER BY updated_at ASC
        `).all(nowValue);
    return rows.map(mapJobRow);
  }
  claimJob(jobId, owner, leaseSeconds = 60, now2 = /* @__PURE__ */ new Date(), options = {}) {
    const nowValue = now2.toISOString();
    const leaseExpiresAt = addSeconds(now2, leaseSeconds).toISOString();
    const statuses = options.includeIdle ? "'idle', 'running', 'paused'" : "'running', 'paused'";
    this.db.prepare(`
      UPDATE jobs
      SET status = 'running', lease_owner = ?, lease_expires_at = ?, updated_at = ?
      WHERE id = ?
        AND status IN (${statuses})
        AND (lease_expires_at IS NULL OR lease_expires_at <= ? OR lease_owner = ?)
    `).run(owner, leaseExpiresAt, nowValue, jobId, nowValue, owner);
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ? AND lease_owner = ?").get(jobId, owner);
    if (!row) {
      return null;
    }
    this.recordEvent(String(row.project_id), typeof row.run_id === "string" ? row.run_id : null, "JOB_CLAIMED", {
      id: jobId,
      kind: row.kind,
      owner,
      leaseExpiresAt
    });
    return {
      ...mapJobRow(row)
    };
  }
  heartbeatJob(jobId, owner, leaseSeconds = 60, now2 = /* @__PURE__ */ new Date()) {
    const leaseExpiresAt = addSeconds(now2, leaseSeconds).toISOString();
    this.db.prepare(`
      UPDATE jobs
      SET lease_expires_at = ?, updated_at = ?
      WHERE id = ? AND lease_owner = ? AND status = 'running'
    `).run(leaseExpiresAt, now2.toISOString(), jobId, owner);
    const row = this.db.prepare("SELECT project_id, run_id, kind FROM jobs WHERE id = ? AND lease_owner = ?").get(jobId, owner);
    if (!row) {
      return null;
    }
    this.recordEvent(String(row.project_id), typeof row.run_id === "string" ? row.run_id : null, "JOB_HEARTBEAT", {
      id: jobId,
      kind: row.kind,
      owner,
      leaseExpiresAt
    });
    return leaseExpiresAt;
  }
  releaseJobLease(jobId, reason = "lease_released") {
    this.db.prepare(`
      UPDATE jobs
      SET lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE id = ? AND status IN ('running', 'paused')
    `).run(nowIso(), jobId);
    const row = this.db.prepare("SELECT project_id, run_id, kind FROM jobs WHERE id = ?").get(jobId);
    this.recordEvent(typeof row?.project_id === "string" ? row.project_id : null, typeof row?.run_id === "string" ? row.run_id : null, "JOB_LEASE_RELEASED", {
      id: jobId,
      kind: typeof row?.kind === "string" ? row.kind : null,
      reason
    });
  }
  completeJob(jobId, owner) {
    this.finishJob(jobId, "completed", owner);
  }
  failJob(jobId, error, owner) {
    this.finishJob(jobId, "failed", owner, { error });
  }
  pauseJob(jobId, owner) {
    this.finishJob(jobId, "paused", owner);
  }
  resumeJob(jobId, payload) {
    const updates = typeof payload === "undefined" ? "status = 'running', lease_owner = NULL, lease_expires_at = NULL, updated_at = ?" : "status = 'running', payload_json = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?";
    const values = typeof payload === "undefined" ? [nowIso(), jobId] : [jsonString(payload), nowIso(), jobId];
    this.db.prepare(`
      UPDATE jobs
      SET ${updates}
      WHERE id = ?
    `).run(...values);
    const row = this.db.prepare("SELECT project_id, run_id, kind FROM jobs WHERE id = ?").get(jobId);
    this.recordEvent(typeof row?.project_id === "string" ? row.project_id : null, typeof row?.run_id === "string" ? row.run_id : null, "JOB_RESUMED", {
      id: jobId,
      kind: typeof row?.kind === "string" ? row.kind : null
    });
  }
  jobFailureLooksRecoverable(jobId) {
    const row = this.db.prepare(`
      SELECT payload_json
      FROM events
      WHERE type = 'JOB_UPDATED'
        AND payload_json LIKE ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(`%"id":"${jobId}"%`);
    const payload = readJson(row?.payload_json, null);
    const error = typeof payload?.error === "string" ? payload.error : "";
    return !/autopilot stopped by user|abort/i.test(error) && /network|fetch|failed|econn|enotfound|etimedout|socket|undici|timeout|timed\s*out|timed-out|429|rate limit|too many requests|quota|503|502|504|temporar|unavailable|overloaded|bad gateway|gateway timeout/i.test(error);
  }
  cancelJob(jobId, owner) {
    this.finishJob(jobId, "cancelled", owner);
  }
  listProjectJobs(projectId, kind) {
    const rows = kind ? this.db.prepare(`
          SELECT * FROM jobs
          WHERE project_id = ? AND kind = ?
          ORDER BY updated_at DESC
        `).all(projectId, kind) : this.db.prepare(`
          SELECT * FROM jobs
          WHERE project_id = ?
          ORDER BY updated_at DESC
        `).all(projectId);
    return rows.map(mapJobRow);
  }
  cancelProjectJobs(projectId, kind) {
    const jobs = this.listProjectJobs(projectId, kind).filter((job) => job.status === "running" || job.status === "paused").map((job) => String(job.id));
    for (const jobId of jobs) {
      this.cancelJob(jobId);
    }
    return jobs.length;
  }
  finishJob(jobId, status, owner, metadata = {}) {
    const ownerClause = owner ? "AND (lease_owner = ? OR lease_owner IS NULL)" : "";
    const values = owner ? [status, nowIso(), jobId, owner] : [status, nowIso(), jobId];
    this.db.prepare(`
      UPDATE jobs
      SET status = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE id = ? ${ownerClause}
    `).run(...values);
    const row = this.db.prepare("SELECT project_id, run_id, kind FROM jobs WHERE id = ?").get(jobId);
    this.recordEvent(typeof row?.project_id === "string" ? row.project_id : null, typeof row?.run_id === "string" ? row.run_id : null, "JOB_UPDATED", {
      id: jobId,
      kind: typeof row?.kind === "string" ? row.kind : null,
      status,
      ...metadata
    });
  }
  getChapterFacts(projectId, now2 = /* @__PURE__ */ new Date()) {
    const facts = /* @__PURE__ */ new Map();
    const projectRow = this.db.prepare("SELECT chapter_word_target, project_root FROM projects WHERE id = ?").get(projectId);
    const projectTargetWords = Number(projectRow?.chapter_word_target);
    const targetWordsForQuality = Number.isFinite(projectTargetWords) ? projectTargetWords : void 0;
    const projectRoot = typeof projectRow?.project_root === "string" ? projectRow.project_root : "";
    const protagonistProfile = projectRoot ? readTextFileSync(import_node_path2.default.join(projectRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md")) : "";
    const ensureFact = (chapterNumber) => {
      const existing = facts.get(chapterNumber);
      if (existing) return existing;
      const created = { chapterNumber, status: "pending" };
      facts.set(chapterNumber, created);
      return created;
    };
    const resetAtByChapter = /* @__PURE__ */ new Map();
    const resetRows = this.db.prepare(`
      SELECT payload_json, created_at
      FROM events
      WHERE project_id = ?
        AND type = 'CHAPTER_QUEUE_RESET'
      ORDER BY created_at ASC
    `).all(projectId);
    for (const row of resetRows) {
      const payload = readJson(row.payload_json, {});
      const createdAt = String(row.created_at || "");
      const chapters = [
        ...normalizeChapterNumberList(payload.resetChapters),
        ...normalizeChapterNumberList(payload.chapters)
      ];
      for (const chapterNumber of new Set(chapters)) {
        const previous = resetAtByChapter.get(chapterNumber);
        if (!previous || timestampMs(createdAt) >= timestampMs(previous)) {
          resetAtByChapter.set(chapterNumber, createdAt);
        }
      }
    }
    const isResetHistory = (chapterNumber, value) => {
      const resetAt = resetAtByChapter.get(chapterNumber);
      return Boolean(resetAt) && timestampMs(value) <= timestampMs(resetAt);
    };
    const artifactRows = this.db.prepare(`
      SELECT path, metadata_json, updated_at, created_at
      FROM artifacts
      WHERE project_id = ?
        AND (path LIKE '%.final.md' OR path LIKE '%-quality.md')
      ORDER BY updated_at ASC
    `).all(projectId);
    for (const row of artifactRows) {
      const chapterNumber = chapterNumberFromPath(row.path);
      if (!chapterNumber) continue;
      if (isResetHistory(chapterNumber, row.updated_at || row.created_at)) continue;
      const fact = ensureFact(chapterNumber);
      const pathValue = String(row.path || "");
      const metadata = readJson(row.metadata_json, {});
      const qualityGate = normalizeQualityGate(metadata.qualityGate, String(row.updated_at || row.created_at || ""));
      if (pathValue.includes(".final.md")) {
        fact.finalPath = pathValue;
      }
      if (pathValue.includes("-quality.md")) {
        fact.reportPath = pathValue;
      }
      applyQualityGateFact(fact, qualityGate, targetWordsForQuality);
    }
    const progressRows = this.db.prepare(`
      SELECT payload_json, created_at
      FROM events
      WHERE project_id = ?
        AND type = 'WRITING_PROGRESS'
      ORDER BY created_at ASC
    `).all(projectId);
    for (const row of progressRows) {
      const payload = readJson(row.payload_json, {});
      const chapterNumber = Number(payload.chapterNumber);
      if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) continue;
      if (isResetHistory(chapterNumber, row.created_at)) continue;
      const fact = ensureFact(chapterNumber);
      fact.latestStep = typeof payload.step === "string" ? payload.step : fact.latestStep;
      fact.latestEventStatus = typeof payload.status === "string" ? payload.status : fact.latestEventStatus;
      fact.latestEventAt = String(row.created_at || "");
      const qualityGate = normalizeQualityGate(payload.qualityGate, String(row.created_at || ""));
      applyQualityGateFact(fact, qualityGate, targetWordsForQuality);
    }
    const pipelineRows = this.db.prepare(`
      SELECT type, payload_json, created_at
      FROM events
      WHERE project_id = ?
        AND type IN ('CHAPTER_PIPELINE_COMPLETED', 'CHAPTER_PIPELINE_BLOCKED')
      ORDER BY created_at ASC
    `).all(projectId);
    for (const row of pipelineRows) {
      const payload = readJson(row.payload_json, {});
      const chapterNumber = Number(payload.chapterNumber);
      if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) continue;
      if (isResetHistory(chapterNumber, row.created_at)) continue;
      const fact = ensureFact(chapterNumber);
      if (typeof payload.finalPath === "string") {
        fact.finalPath = payload.finalPath;
      }
      if (typeof payload.reportPath === "string") {
        fact.reportPath = payload.reportPath;
      }
      const qualityGate = normalizeQualityGate(payload.qualityGate, String(row.created_at || ""));
      applyQualityGateFact(fact, qualityGate, targetWordsForQuality);
    }
    const taskRows = this.db.prepare(`
      SELECT type, payload_json, created_at
      FROM events
      WHERE project_id = ?
        AND type IN ('CHAPTER_PIPELINE_RECOVERY_QUEUED', 'CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED', 'CHAPTER_TASK_STATUS_UPDATED')
      ORDER BY created_at ASC
    `).all(projectId);
    for (const row of taskRows) {
      const payload = readJson(row.payload_json, {});
      const chapterNumber = Number(payload.chapterNumber);
      if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) continue;
      if (isResetHistory(chapterNumber, row.created_at)) continue;
      const fact = ensureFact(chapterNumber);
      const createdAt = String(row.created_at || "");
      if (row.type === "CHAPTER_PIPELINE_RECOVERY_QUEUED" || row.type === "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED") {
        fact.recoveryQueuedAt = createdAt;
        fact.latestTaskStatus = "pending";
        fact.latestTaskStatusAt = createdAt;
        continue;
      }
      const status = normalizeTaskStatus(payload.status);
      if (status) {
        fact.latestTaskStatus = status;
        fact.latestTaskStatusAt = createdAt;
      }
    }
    for (const [chapterNumber, resetAt] of resetAtByChapter) {
      const fact = ensureFact(chapterNumber);
      const existingTaskAt = timestampMs(fact.latestTaskStatusAt);
      if (timestampMs(resetAt) >= existingTaskAt) {
        fact.resetAt = resetAt;
        fact.latestTaskStatus = "pending";
        fact.latestTaskStatusAt = resetAt;
        fact.updatedAt = resetAt;
      }
    }
    let previousProtagonistName = inferLockedProtagonistName(protagonistProfile);
    for (const fact of [...facts.values()].sort((left, right) => left.chapterNumber - right.chapterNumber)) {
      if (fact.finalPath) {
        const finalText = readTextFileSync(import_node_path2.default.isAbsolute(fact.finalPath) ? fact.finalPath : import_node_path2.default.join(projectRoot, fact.finalPath));
        if (finalText) {
          const consistency = evaluateChapterConsistency({
            chapterNumber: fact.chapterNumber,
            text: finalText,
            previousProtagonistName,
            protagonistProfile
          });
          fact.protagonistName = consistency.protagonistName;
          fact.consistency = {
            status: consistency.status,
            reason: consistency.reason,
            detectedNames: consistency.detectedNames
          };
          if (consistency.status === "eligible" && consistency.protagonistName && !previousProtagonistName) {
            previousProtagonistName = consistency.protagonistName;
          }
          if (consistency.status === "quarantined" && fact.contentQuality) {
            fact.contentQuality = {
              ...fact.contentQuality,
              status: "quarantined",
              reason: consistency.reason
            };
          }
        }
      }
      const latestTaskStatusAt = timestampMs(fact.latestTaskStatusAt);
      const qualityGateUpdatedAt = timestampMs(fact.qualityGate?.updatedAt || fact.updatedAt);
      const latestEventAt = timestampMs(fact.latestEventAt);
      const taskInstructionIsNewer = latestTaskStatusAt > 0 && latestTaskStatusAt > qualityGateUpdatedAt;
      const latestEventFailed = isWritingEventFailed({
        status: fact.latestEventStatus || "",
        step: fact.latestStep || ""
      });
      const failedEventIsNewer = latestEventFailed && latestEventAt > 0 && latestEventAt >= Math.max(latestTaskStatusAt, qualityGateUpdatedAt);
      if (isWritingEventActive({
        status: fact.latestEventStatus || "",
        step: fact.latestStep || "",
        createdAt: fact.latestEventAt || ""
      }, now2) && fact.qualityGate?.status !== "blocked") {
        fact.status = "in_progress";
      } else if (fact.qualityGate?.status === "passed" && fact.finalPath && fact.contentQuality?.status === "eligible") {
        fact.status = "complete";
      } else if (failedEventIsNewer || fact.qualityGate?.status === "blocked" && !taskInstructionIsNewer) {
        fact.status = "blocked";
      } else if (taskInstructionIsNewer && (fact.latestTaskStatus === "pending" || fact.latestTaskStatus === "in_progress")) {
        fact.status = fact.latestTaskStatus;
      } else if (fact.qualityGate?.status === "passed" && fact.finalPath) {
        fact.status = "pending";
      } else if (fact.qualityGate?.status === "passed") {
        fact.status = "pending";
      } else if (fact.qualityGate?.status === "blocked") {
        fact.status = "blocked";
      } else if (fact.finalPath || fact.reportPath || fact.qualityGate) {
        fact.status = "blocked";
      } else {
        fact.status = "pending";
      }
    }
    return [...facts.values()].sort((left, right) => left.chapterNumber - right.chapterNumber);
  }
  getSnapshot(projectId) {
    const project = this.getProject(projectId);
    const projectRow = this.db.prepare("SELECT state_json FROM projects WHERE id = ?").get(projectId);
    const chapterFacts = this.getChapterFacts(projectId);
    const completedChapterFacts = chapterFacts.filter((fact) => fact.status === "complete");
    const blockedChapterFacts = chapterFacts.filter((fact) => fact.status === "blocked");
    const quarantinedFinalFacts = chapterFacts.filter((fact) => Boolean(fact.finalPath) && fact.contentQuality?.status === "quarantined");
    const untrustedPassedGateFacts = quarantinedFinalFacts.filter((fact) => fact.qualityGate?.status === "passed");
    const latestTrustedFinal = completedChapterFacts.slice().sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))[0];
    const artifactCounts = this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN path LIKE '%.ai-novel/plans/chapter-blueprints/%' OR path LIKE '%plans/chapter-blueprints/%' THEN 1 ELSE 0 END) AS blueprints,
        SUM(CASE WHEN path LIKE '%.final.md' THEN 1 ELSE 0 END) AS finalChapters,
        SUM(CASE WHEN path LIKE '%-quality.md' THEN 1 ELSE 0 END) AS qualityReports,
        SUM(CASE WHEN path LIKE '%-memory.md' THEN 1 ELSE 0 END) AS memoryUpdates
      FROM artifacts
      WHERE project_id = ?
    `).get(projectId);
    const latestFinal = this.db.prepare(`
      SELECT path
      FROM artifacts
      WHERE project_id = ? AND path LIKE '%.final.md'
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(projectId);
    const pinnedArtifacts = this.db.prepare(`
      SELECT * FROM artifacts
      WHERE project_id = ?
        AND (
          path LIKE '%global-consensus.md'
          OR path LIKE '%.ai-novel/consensus/%'
          OR path LIKE '%/consensus/%'
          OR path LIKE '%current-context.md'
          OR path LIKE '%discussion-log.md'
          OR path LIKE '%setting-freeze.md'
          OR path LIKE '%master-outline.md'
          OR path LIKE '%production-resources/%'
          OR path LIKE '%.ai-novel/knowledge/%'
          OR path LIKE '%/knowledge/%'
        )
      ORDER BY updated_at DESC
      LIMIT 24
    `).all(projectId);
    const recentArtifacts = this.db.prepare(`
      SELECT * FROM artifacts
      WHERE project_id = ?
      ORDER BY updated_at DESC
      LIMIT 80
    `).all(projectId);
    const artifactsByPath = /* @__PURE__ */ new Map();
    for (const row of [...pinnedArtifacts, ...recentArtifacts]) {
      const key = String(row.path || row.id || "");
      if (key && !artifactsByPath.has(key)) {
        artifactsByPath.set(key, compactDbRow(row));
      }
    }
    const knowledge = this.getKnowledgeSummary(projectId);
    return {
      project,
      state: readJson(projectRow?.state_json, null),
      activeRuns: this.db.prepare(`
        SELECT * FROM workflow_runs
        WHERE project_id = ? AND status IN ('running', 'paused')
        ORDER BY updated_at DESC
      `).all(projectId),
      latestRuns: this.db.prepare(`
        SELECT * FROM workflow_runs
        WHERE project_id = ?
        ORDER BY updated_at DESC
        LIMIT 12
      `).all(projectId),
      latestEvents: this.db.prepare(`
        SELECT * FROM events
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT 80
      `).all(projectId).map(compactDbRow),
      artifacts: [...artifactsByPath.values()],
      artifactSummary: {
        total: Number(artifactCounts?.total || 0),
        blueprints: Number(artifactCounts?.blueprints || 0),
        finalChapters: completedChapterFacts.length,
        finalChapterFiles: Number(artifactCounts?.finalChapters || 0),
        passedFinalChapters: completedChapterFacts.length,
        blockedFinalChapters: blockedChapterFacts.length,
        quarantinedFinalChapters: quarantinedFinalFacts.length,
        untrustedPassedGates: untrustedPassedGateFacts.length,
        qualityReports: Number(artifactCounts?.qualityReports || 0),
        memoryUpdates: Number(artifactCounts?.memoryUpdates || 0),
        latestFinalPath: latestTrustedFinal?.finalPath || (typeof latestFinal?.path === "string" ? latestFinal.path : "")
      },
      chapterFacts,
      checkpoints: this.db.prepare(`
        SELECT * FROM checkpoints
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `).all(projectId),
      graphNodes: this.db.prepare(`
        SELECT *
        FROM graph_nodes
        WHERE project_id = ?
        ORDER BY updated_at DESC
        LIMIT 120
      `).all(projectId),
      graphEdges: this.db.prepare(`
        SELECT *
        FROM graph_edges
        WHERE project_id = ?
        ORDER BY updated_at DESC
        LIMIT 160
      `).all(projectId),
      recentMemory: this.db.prepare(`
        SELECT id, project_id, source, kind, substr(content, 1, 900) AS content, importance, embedding_status, metadata_json, created_at, updated_at, embedding_id
        FROM memory_items
        WHERE project_id = ?
        ORDER BY importance DESC, updated_at DESC
        LIMIT 24
      `).all(projectId).map(compactDbRow),
      recentMessages: this.listMessages(projectId, { limit: 80 }),
      knowledge,
      activeJobs: this.db.prepare(`
        SELECT * FROM jobs
        WHERE project_id = ? AND status IN ('running', 'paused')
        ORDER BY updated_at DESC
      `).all(projectId),
      runnableJobs: this.db.prepare(`
        SELECT * FROM jobs
        WHERE project_id = ?
          AND status IN ('running', 'paused')
          AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
        ORDER BY updated_at ASC
      `).all(projectId, nowIso())
    };
  }
  getOperationalStatus(now2 = /* @__PURE__ */ new Date()) {
    const nowValue = now2.toISOString();
    const scalar = (sql, ...values) => Number(this.db.prepare(sql).get(...values)?.count || 0);
    const latestJobs = this.db.prepare(`
      SELECT *
      FROM jobs
      ORDER BY updated_at DESC
      LIMIT 20
    `).all().map(mapJobRow);
    return {
      ok: true,
      checkedAt: nowValue,
      projects: {
        total: scalar("SELECT COUNT(*) AS count FROM projects"),
        running: scalar(`
          SELECT COUNT(*) AS count
          FROM projects
          WHERE EXISTS (
            SELECT 1
            FROM workflow_runs
            WHERE workflow_runs.project_id = projects.id
              AND workflow_runs.status IN ('running', 'paused')
          )
          OR EXISTS (
            SELECT 1
            FROM jobs
            WHERE jobs.project_id = projects.id
              AND jobs.status IN ('running', 'paused')
          )
        `)
      },
      runs: {
        active: scalar("SELECT COUNT(*) AS count FROM workflow_runs WHERE status IN ('running', 'paused')")
      },
      jobs: {
        active: scalar("SELECT COUNT(*) AS count FROM jobs WHERE status IN ('running', 'paused')"),
        runnable: scalar(`
          SELECT COUNT(*) AS count
          FROM jobs
          WHERE status IN ('running', 'paused')
            AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
        `, nowValue),
        leased: scalar(`
          SELECT COUNT(*) AS count
          FROM jobs
          WHERE status = 'running'
            AND lease_owner IS NOT NULL
            AND lease_expires_at > ?
        `, nowValue),
        latest: latestJobs
      },
      memory: {
        pendingEmbeddings: scalar("SELECT COUNT(*) AS count FROM memory_items WHERE embedding_status = 'pending'"),
        failedEmbeddings: scalar("SELECT COUNT(*) AS count FROM memory_items WHERE embedding_status = 'failed'")
      },
      knowledge: {
        globalSources: scalar("SELECT COUNT(*) AS count FROM knowledge_sources WHERE scope = 'global' AND status = 'ready'"),
        projectSources: scalar("SELECT COUNT(*) AS count FROM knowledge_sources WHERE scope = 'project' AND status = 'ready'"),
        readyChunks: scalar("SELECT COUNT(*) AS count FROM knowledge_chunks WHERE status = 'ready' AND embedding_status = 'ready'"),
        pendingEmbeddings: scalar("SELECT COUNT(*) AS count FROM knowledge_chunks WHERE status = 'ready' AND embedding_status = 'pending'"),
        failedEmbeddings: scalar("SELECT COUNT(*) AS count FROM knowledge_chunks WHERE status = 'ready' AND embedding_status = 'failed'")
      },
      messages: {
        total: scalar("SELECT COUNT(*) AS count FROM messages")
      },
      latestEvents: this.db.prepare(`
        SELECT events.*
        FROM events
        LEFT JOIN projects ON projects.id = events.project_id
        WHERE events.project_id IS NULL OR projects.id IS NOT NULL
        ORDER BY events.created_at DESC
        LIMIT 20
      `).all()
    };
  }
  listLlmConfigs() {
    return this.db.prepare(`
      SELECT id, name, base_url, api_key, model_name, temperature, timeout_ms, is_active, created_at, updated_at
      FROM llm_configs
      ORDER BY created_at DESC
    `).all();
  }
  addLlmConfig(config) {
    const id = makeId("llm");
    const now2 = nowIso();
    const temp = config.temperature ?? 0.1;
    const timeout = config.timeoutMs ?? 12e4;
    this.db.prepare(`
      INSERT INTO llm_configs (id, name, base_url, api_key, model_name, temperature, timeout_ms, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, config.name, config.baseUrl, config.apiKey, config.modelName, temp, timeout, now2, now2);
  }
  updateLlmConfig(id, config) {
    const now2 = nowIso();
    const temp = config.temperature ?? 0.1;
    const timeout = config.timeoutMs ?? 12e4;
    this.db.prepare(`
      UPDATE llm_configs
      SET name = ?, base_url = ?, api_key = ?, model_name = ?, temperature = ?, timeout_ms = ?, updated_at = ?
      WHERE id = ?
    `).run(config.name, config.baseUrl, config.apiKey, config.modelName, temp, timeout, now2, id);
  }
  deleteLlmConfig(id) {
    this.db.prepare(`
      DELETE FROM llm_configs WHERE id = ?
    `).run(id);
  }
  activateLlmConfig(id) {
    this.db.prepare(`
      UPDATE llm_configs SET is_active = 0
    `).run();
    this.db.prepare(`
      UPDATE llm_configs SET is_active = 1 WHERE id = ?
    `).run(id);
  }
  getActiveLlmConfig() {
    const config = this.db.prepare(`
      SELECT id, name, base_url, api_key, model_name, temperature, timeout_ms, is_active, created_at, updated_at
      FROM llm_configs
      WHERE is_active = 1
      LIMIT 1
    `).get();
    return config || null;
  }
};
var activeDbInstance = null;
var activeDbRootDir = null;
var activeRefCount = 0;
async function withFactoryDb(rootDir, callback) {
  if (activeDbInstance && activeDbRootDir === rootDir) {
    activeRefCount++;
    try {
      return await callback(activeDbInstance);
    } finally {
      activeRefCount--;
      if (activeRefCount === 0) {
        try {
          activeDbInstance.close();
        } catch (e) {
        }
        activeDbInstance = null;
        activeDbRootDir = null;
      }
    }
  }
  const db = await FactoryDb.open(rootDir);
  activeDbInstance = db;
  activeDbRootDir = rootDir;
  activeRefCount = 1;
  try {
    return await callback(db);
  } finally {
    activeRefCount--;
    if (activeRefCount === 0) {
      try {
        db.close();
      } catch (e) {
      }
      activeDbInstance = null;
      activeDbRootDir = null;
    }
  }
}
function makeRunId(kind) {
  return makeId(`run_${kind}`);
}
function makeAgentTurnId(runId, agentId, index) {
  return `${runId}:${agentId}:${index}`;
}
function targetToArtifactKind(target) {
  if (target.kind === "character") return "memory";
  if (target.kind === "style") return "style";
  if (target.kind === "chapter" || target.kind === "plot") return "plan";
  return "consensus";
}

// src/llm-config.ts
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
function isWorkspaceRoot(dir) {
  try {
    const pkgPath = import_node_path3.default.join(dir, "package.json");
    if (!import_node_fs3.default.existsSync(pkgPath)) {
      return false;
    }
    const content = import_node_fs3.default.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(content);
    return pkg.name === "ai-novel-factory-workspace";
  } catch {
    return false;
  }
}
function resolveFactoryRootDir(dir = process.cwd()) {
  let current = import_node_path3.default.resolve(dir);
  while (true) {
    if (isWorkspaceRoot(current)) {
      return current;
    }
    const parent = import_node_path3.default.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  const fallback = import_node_path3.default.resolve(dir);
  const projectsIndex = fallback.indexOf(`${import_node_path3.default.sep}.ai-novel-projects`);
  if (projectsIndex !== -1) {
    return fallback.slice(0, projectsIndex);
  }
  const novelIndex = fallback.indexOf(`${import_node_path3.default.sep}.ai-novel`);
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

// src/super-graph.ts
var import_promises2 = __toESM(require("fs/promises"), 1);
var import_node_path4 = __toESM(require("path"), 1);
var GRAPH_SCHEMA_VERSION = 1;
var WORKSPACE_DIR = ".ai-novel";
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function readJson2(value, fallback) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function workspacePath(rootDir, ...parts) {
  return import_node_path4.default.join(rootDir, WORKSPACE_DIR, ...parts);
}
function graphPaths(rootDir) {
  const graphDir = workspacePath(rootDir, "graph");
  return {
    graphDir,
    graphPath: import_node_path4.default.join(graphDir, "super-graph.json"),
    indexPath: import_node_path4.default.join(graphDir, "index.json"),
    violationsPath: import_node_path4.default.join(graphDir, "violations.json")
  };
}
function makeNode(type, id, label, properties = {}) {
  const timestamp = now();
  return { id, type, label, properties, createdAt: timestamp, updatedAt: timestamp };
}
function makeEdge(type, from, to, properties = {}) {
  const timestamp = now();
  return {
    id: `edge:${type.toLowerCase()}:${from}->${to}`,
    type,
    from,
    to,
    properties,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
function upsertNode(graph, node) {
  const index = graph.nodes.findIndex((candidate) => candidate.id === node.id);
  if (index >= 0) {
    graph.nodes[index] = {
      ...graph.nodes[index],
      ...node,
      createdAt: graph.nodes[index].createdAt,
      updatedAt: now()
    };
    return;
  }
  graph.nodes.push(node);
}
function upsertEdge(graph, edge) {
  const index = graph.edges.findIndex((candidate) => candidate.id === edge.id);
  if (index >= 0) {
    graph.edges[index] = {
      ...graph.edges[index],
      ...edge,
      createdAt: graph.edges[index].createdAt,
      updatedAt: now()
    };
    return;
  }
  graph.edges.push(edge);
}
async function loadSuperGraph(rootDir) {
  const { graphPath } = graphPaths(rootDir);
  const raw = await import_promises2.default.readFile(graphPath, "utf8");
  return JSON.parse(raw);
}
async function loadSuperGraphForUpdate(rootDir, options = {}) {
  const projectId = normalizeProjectId(options.projectId);
  if (options.factoryRootDir && projectId) {
    const dbGraph = await withFactoryDb(options.factoryRootDir, async (db) => db.getGraph(projectId)).catch(() => null);
    if (dbGraph && dbGraph.nodes.length > 0) {
      return superGraphFromDbRows(projectId, dbGraph.nodes, dbGraph.edges);
    }
  }
  return loadSuperGraph(rootDir);
}
function superGraphFromDbRows(projectId, nodes, edges) {
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    projectId,
    generatedAt: now(),
    nodes: nodes.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      label: String(row.label),
      properties: readJson2(row.metadata_json, {}),
      createdAt: String(row.updated_at || now()),
      updatedAt: String(row.updated_at || now())
    })),
    edges: edges.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      from: String(row.from_node_id),
      to: String(row.to_node_id),
      properties: readJson2(row.metadata_json, {}),
      createdAt: String(row.updated_at || now()),
      updatedAt: String(row.updated_at || now())
    }))
  };
}
function normalizeProjectId(projectId) {
  if (!projectId || projectId === "project:current") {
    return null;
  }
  return projectId;
}
async function saveSuperGraph(rootDir, graph, options = {}) {
  const paths = graphPaths(rootDir);
  await import_promises2.default.mkdir(paths.graphDir, { recursive: true });
  graph.generatedAt = now();
  await import_promises2.default.writeFile(paths.graphPath, `${JSON.stringify(graph, null, 2)}
`);
  await import_promises2.default.writeFile(paths.indexPath, `${JSON.stringify(buildSuperGraphIndex(graph), null, 2)}
`);
  await import_promises2.default.writeFile(paths.violationsPath, `${JSON.stringify(validateSuperGraph(graph), null, 2)}
`);
  const projectId = normalizeProjectId(options.projectId);
  if (options.factoryRootDir && projectId) {
    await withFactoryDb(options.factoryRootDir, async (db) => db.upsertGraph(projectId, graph.nodes, graph.edges)).catch(() => void 0);
  }
}
async function upsertDiscussionInSuperGraph(rootDir, discussion, options = {}) {
  const graph = await loadSuperGraphForUpdate(rootDir, options);
  const turnId = `discussion:${Date.now()}`;
  upsertNode(graph, makeNode("DiscussionTurn", turnId, discussion.target?.label || "Discussion Turn", {
    targetKind: discussion.target?.kind,
    targetAssetPath: discussion.target?.assetPath,
    summary: discussion.summary,
    transcriptPath: discussion.transcriptPath
  }));
  upsertEdge(graph, makeEdge("DECIDED_BY", turnId, "agent:showrunner"));
  upsertEdge(graph, makeEdge("UPDATES", turnId, "artifact:global-consensus"));
  if (discussion.target?.assetPath?.includes("protagonist")) {
    upsertEdge(graph, makeEdge("UPDATES", turnId, "artifact:protagonist"));
  }
  if (discussion.target?.assetPath?.includes("style")) {
    upsertEdge(graph, makeEdge("UPDATES", turnId, "artifact:style-profile"));
  }
  if (discussion.transcriptPath) {
    upsertEdge(graph, makeEdge("WRITES", turnId, "artifact:discussion-log"));
  }
  await saveSuperGraph(rootDir, graph, options);
  return graph;
}
async function upsertCheckpointInSuperGraph(rootDir, checkpoint, options = {}) {
  const graph = await loadSuperGraphForUpdate(rootDir, options);
  const checkpointId = `checkpoint:${import_node_path4.default.basename(checkpoint.path).replace(/\.json$/i, "")}`;
  upsertNode(graph, makeNode("Checkpoint", checkpointId, checkpoint.label, {
    path: checkpoint.path,
    drift: checkpoint.drift
  }));
  upsertEdge(graph, makeEdge("SNAPSHOTTED", checkpointId, "project:current"));
  upsertEdge(graph, makeEdge("WRITES", checkpointId, "artifact:checkpoints"));
  if (checkpoint.drift) {
    const guardId = `guard:${checkpointId}`;
    upsertNode(graph, makeNode("DriftGuard", guardId, `Drift Guard ${checkpoint.drift.status || "ok"}`, checkpoint.drift));
    upsertEdge(graph, makeEdge("CHECKS", guardId, checkpointId));
    if (checkpoint.drift.status === "blocked" || checkpoint.drift.status === "correcting") {
      upsertEdge(graph, makeEdge("VIOLATES", guardId, "mission:original"));
    } else {
      upsertEdge(graph, makeEdge("SUPPORTS", guardId, "mission:original"));
    }
  }
  await saveSuperGraph(rootDir, graph, options);
  return graph;
}
function buildSuperGraphIndex(graph) {
  return {
    schemaVersion: graph.schemaVersion,
    generatedAt: now(),
    counts: {
      nodes: graph.nodes.length,
      edges: graph.edges.length
    },
    nodeTypes: Object.fromEntries(
      Array.from(new Set(graph.nodes.map((node) => node.type))).map((type) => [
        type,
        graph.nodes.filter((node) => node.type === type).length
      ])
    ),
    edgeTypes: Object.fromEntries(
      Array.from(new Set(graph.edges.map((edge) => edge.type))).map((type) => [
        type,
        graph.edges.filter((edge) => edge.type === type).length
      ])
    )
  };
}
function validateSuperGraph(graph) {
  const issues = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      issues.push({
        severity: "error",
        code: "missing_edge_from",
        message: `Edge '${edge.id}' references missing from-node '${edge.from}'.`,
        edgeId: edge.id
      });
    }
    if (!nodeIds.has(edge.to)) {
      issues.push({
        severity: "error",
        code: "missing_edge_to",
        message: `Edge '${edge.id}' references missing to-node '${edge.to}'.`,
        edgeId: edge.id
      });
    }
  }
  for (const required of ["project:current", "mission:original", "artifact:global-consensus"]) {
    if (!nodeIds.has(required)) {
      issues.push({
        severity: "error",
        code: "missing_required_node",
        message: `Required graph node '${required}' is missing.`,
        nodeId: required
      });
    }
  }
  const currentStages = graph.edges.filter((edge) => edge.type === "CURRENT_STAGE");
  if (currentStages.length !== 1) {
    issues.push({
      severity: "warning",
      code: "invalid_current_stage_count",
      message: `Expected exactly one CURRENT_STAGE edge, found ${currentStages.length}.`
    });
  }
  return issues;
}

// src/writing-pipeline.ts
var import_promises4 = __toESM(require("fs/promises"), 1);
var import_node_path6 = __toESM(require("path"), 1);

// src/embedding.ts
var LOCAL_EMBEDDING_MODEL = "local-hash-v1";
var LOCAL_EMBEDDING_DIMENSIONS = 64;
function normalizeTokens(text) {
  return text.toLowerCase().split(/[\s,，。！？!?.、:：；;'"“”‘’()\[\]{}<>《》]+/).map((token) => token.trim()).filter((token) => token.length > 0);
}
function hashToken(token) {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function createLocalTextEmbedding(text, dimensions = LOCAL_EMBEDDING_DIMENSIONS) {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = normalizeTokens(text);
  if (tokens.length === 0) {
    return vector;
  }
  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % dimensions;
    const sign = hash & 1 ? 1 : -1;
    vector[index] += sign;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}
async function backfillPendingMemoryEmbeddings(rootDir, options = {}) {
  return withFactoryDb(rootDir, async (db) => {
    const rows = db.listPendingMemoryForEmbedding(options.projectId ?? null, options.limit ?? 50);
    for (const row of rows) {
      const projectId = String(row.project_id);
      const memoryId = String(row.id);
      try {
        db.upsertEmbedding(projectId, {
          ownerKind: "memory",
          ownerId: memoryId,
          model: LOCAL_EMBEDDING_MODEL,
          vector: createLocalTextEmbedding(String(row.content || ""))
        });
      } catch (error) {
        db.markMemoryEmbeddingFailed(projectId, memoryId, error instanceof Error ? error.message : String(error));
      }
    }
    return rows.length;
  });
}

// src/messages.ts
var AGENT_TYPE_BY_LABEL = {
  Showrunner: "showrunner",
  "World Architect": "world_architect",
  Author: "author",
  Editor: "editor",
  Reviewer: "reviewer",
  "Prose Stylist": "prose_stylist"
};
var AGENT_LABEL_BY_TYPE = {
  showrunner: "Showrunner",
  world_architect: "World Architect",
  author: "Author",
  editor: "Editor",
  reviewer: "Reviewer",
  prose_stylist: "Prose Stylist",
  director: "Director",
  memory_keeper: "Memory Keeper",
  tool_agent: "Tool Agent"
};
function nowIso2() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function createMessageId(prefix = "msg") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function agentTypeFromLabel(label = "Author") {
  return AGENT_TYPE_BY_LABEL[label] || label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "custom";
}
function agentLabelFromType(agentType = "custom") {
  return AGENT_LABEL_BY_TYPE[agentType] || agentType.split("_").filter(Boolean).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ") || "Agent";
}
function createBaseMessage(input) {
  const time = input.time || input.createdAt || nowIso2();
  const status = input.status || "completed";
  return {
    messageId: input.messageId || createMessageId(input.type),
    conversationId: input.conversationId || input.runId || "default",
    projectId: input.projectId,
    runId: input.runId ?? null,
    turnId: input.turnId ?? null,
    parentMessageId: input.parentMessageId ?? null,
    type: input.type,
    status,
    time,
    createdAt: input.createdAt || time,
    updatedAt: input.updatedAt || time,
    completedAt: input.completedAt ?? (status === "completed" || status === "failed" || status === "cancelled" ? time : null),
    data: input.data,
    metadata: input.metadata || {}
  };
}
function createAgentMessage(input) {
  const agentType = input.agentType || agentTypeFromLabel(input.agentLabel || "Author");
  return createBaseMessage({
    ...input,
    messageId: input.messageId || input.turnId || createMessageId("agent"),
    type: "agent",
    data: {
      agentType,
      agentLabel: input.agentLabel || agentLabelFromType(agentType),
      content: input.content || "",
      format: input.format || "markdown",
      artifactPath: input.artifactPath || "",
      phase: input.phase || "",
      statusText: input.statusText || "",
      statusDetail: input.statusDetail || ""
    }
  });
}
function createArtifactMessage(input) {
  return createBaseMessage({
    ...input,
    type: "artifact",
    data: {
      artifactId: input.artifactId,
      artifactPath: input.artifactPath,
      label: input.label,
      content: input.content || "",
      format: input.format || "markdown"
    }
  });
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

// src/knowledge.ts
var import_node_crypto = __toESM(require("crypto"), 1);
var import_promises3 = __toESM(require("fs/promises"), 1);
var import_node_path5 = __toESM(require("path"), 1);
var LOCAL_KNOWLEDGE_EMBEDDING_MODEL = "local-hash-v1";
var DEFAULT_CHUNK_CHAR_LIMIT = 1400;
var DEFAULT_GLOBAL_RESOURCE_LIMIT = process.env.AI_NOVEL_TEST_MODE === "1" ? 12 : 5e3;
var DEFAULT_ARTIFACT_CHUNK_LIMIT = process.env.AI_NOVEL_TEST_MODE === "1" ? 40 : 500;
function currentBundleDir() {
  const stack = new Error().stack || "";
  for (const line of stack.split("\n")) {
    const fileUrlMatch = line.match(/\(?file:\/\/([^):]+):\d+:\d+\)?/);
    if (fileUrlMatch) {
      return import_node_path5.default.dirname(decodeURIComponent(fileUrlMatch[1]));
    }
    const fileMatch = line.match(/\((\/[^():]+):\d+:\d+\)/) || line.match(/at (\/[^():]+):\d+:\d+/);
    if (fileMatch) {
      return import_node_path5.default.dirname(fileMatch[1]);
    }
  }
  return process.cwd();
}
function sha256(value) {
  return import_node_crypto.default.createHash("sha256").update(value).digest("hex");
}
function normalizeRelativePath(value) {
  return value.split(import_node_path5.default.sep).join("/");
}
function chapterNumberFromKnowledgePath(value) {
  const match = String(value || "").match(/chapter-(\d+)/u);
  return match ? Number(match[1]) : null;
}
function timestampMs2(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function sourceTypeForPath(filePath) {
  const normalized = normalizeRelativePath(filePath).toLowerCase();
  if (normalized.includes("/vocabulary/") || normalized.includes("vocabulary")) return "vocabulary";
  if (normalized.includes("/examples/")) return "example";
  if (normalized.includes("/agents/")) return "agent_guide";
  if (normalized.includes("/automation/")) return "quality_rule";
  if (normalized.includes("/style/")) return "style_guide";
  if (normalized.includes("/chapters/")) return "chapter";
  if (normalized.includes("/plans/")) return "plan";
  if (normalized.includes("/memory/")) return "memory";
  if (normalized.includes("/consensus/")) return "consensus";
  return "resource";
}
function chunkTypeForHeading(heading, sourceType) {
  const text = heading.toLowerCase();
  if (/成语|词汇|vocabulary|idiom/u.test(text) || sourceType === "vocabulary") return "vocabulary";
  if (/示例|example|demo/u.test(text) || sourceType === "example") return "example";
  if (/质量|检查|review|gate|consistency/u.test(text)) return "quality_rule";
  if (/正文|final body|draft body|chapter/u.test(text)) return "chapter_text";
  if (/记忆|memory|伏笔|foreshadow/u.test(text)) return "memory";
  if (/风格|style|tone|rhythm|dialogue/u.test(text)) return "style_rule";
  return sourceType;
}
function inferSceneTypes(text) {
  const scenes = [];
  const pairs = [
    [/朝堂|宫廷|官场|政争|权力/u, "court_politics"],
    [/战斗|军事|战争|军营|兵/u, "military"],
    [/环境|山|雨|雪|风|夜|街|城/u, "environment"],
    [/情感|心理|愤怒|恐惧|悲伤|欲望/u, "emotions"],
    [/动作|奔|走|推|打|斩|握/u, "action"],
    [/日常|饮食|市井|街坊|家宅/u, "daily_life"],
    [/文化|典故|经史|佛|道|诗/u, "cultural"],
    [/人物|性格|神态|外貌/u, "character_traits"]
  ];
  for (const [pattern, scene] of pairs) {
    if (pattern.test(text)) scenes.push(scene);
  }
  return [...new Set(scenes)];
}
function splitLongText(text, maxChars = DEFAULT_CHUNK_CHAR_LIMIT) {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [text.trim()]) {
    if (!current) {
      current = paragraph;
      continue;
    }
    if (current.length + paragraph.length + 2 <= maxChars) {
      current = `${current}

${paragraph}`;
      continue;
    }
    chunks.push(current);
    current = paragraph;
  }
  if (current) {
    chunks.push(current);
  }
  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxChars * 1.4) return [chunk];
    const pieces = [];
    for (let index = 0; index < chunk.length; index += maxChars) {
      pieces.push(chunk.slice(index, index + maxChars).trim());
    }
    return pieces.filter(Boolean);
  });
}
function chunkMarkdown(content, sourceType, maxChars) {
  const lines = content.split("\n");
  const sections = [];
  let current = { heading: "Document", body: [] };
  for (const line of lines) {
    if (/^#{1,4}\s+/.test(line) && current.body.some((entry) => entry.trim())) {
      sections.push(current);
      current = { heading: line.replace(/^#{1,4}\s+/, "").trim(), body: [line] };
      continue;
    }
    if (/^#{1,4}\s+/.test(line)) {
      current.heading = line.replace(/^#{1,4}\s+/, "").trim();
    }
    current.body.push(line);
  }
  if (current.body.some((entry) => entry.trim())) {
    sections.push(current);
  }
  return sections.flatMap((section) => {
    const sectionText = section.body.join("\n").trim();
    return splitLongText(sectionText, maxChars).map((text, index) => ({
      chunkType: chunkTypeForHeading(section.heading, sourceType),
      content: text,
      metadata: {
        heading: section.heading,
        part: index + 1,
        sceneTypes: inferSceneTypes(`${section.heading}
${text}`)
      }
    }));
  });
}
function chunkVocabularyJson(content, maxEntries = DEFAULT_GLOBAL_RESOURCE_LIMIT) {
  try {
    const parsed = JSON.parse(content);
    const categoryChunks = Object.entries(parsed.categories || {}).map(([key, value]) => ({
      chunkType: "vocabulary_category",
      content: `${value.title || key}
\u5206\u7C7B\uFF1A${key}
\u8BCD\u6761\u6570\u91CF\uFF1A${value.count ?? "unknown"}`,
      metadata: {
        category: key,
        title: value.title || key,
        count: value.count ?? null,
        sceneTypes: [key]
      }
    }));
    const wordChunks = Object.entries(parsed.word_index || {}).slice(0, maxEntries).map(([word, value]) => {
      const categories = Array.isArray(value.categories) ? value.categories : [];
      return {
        chunkType: "vocabulary_entry",
        content: `${word}
\u91CA\u4E49\uFF1A${value.definition || ""}
\u5206\u7C7B\uFF1A${categories.join(", ")}`,
        metadata: {
          word,
          categories,
          sceneTypes: categories
        }
      };
    });
    return [...categoryChunks, ...wordChunks];
  } catch {
    return splitLongText(content).map((chunk, index) => ({
      chunkType: "json_resource",
      content: chunk,
      metadata: { part: index + 1 }
    }));
  }
}
function chunkKnowledgeContent(input) {
  const normalizedPath = normalizeRelativePath(input.path || "");
  const maxChars = input.chunkCharLimit || DEFAULT_CHUNK_CHAR_LIMIT;
  const limit = Math.max(1, input.chunkLimit ?? DEFAULT_GLOBAL_RESOURCE_LIMIT);
  const chunks = normalizedPath.endsWith(".json") ? chunkVocabularyJson(input.content, limit) : chunkMarkdown(input.content, input.sourceType, maxChars);
  return chunks.filter((chunk) => chunk.content.trim().length > 0).slice(0, limit);
}
async function ingestKnowledgeSource(options) {
  return withFactoryDb(options.rootDir, async (db) => {
    const contentHash = sha256(options.content);
    const source = db.upsertKnowledgeSource({
      scope: options.scope,
      projectId: options.projectId ?? null,
      sourceType: options.sourceType,
      path: options.path,
      title: options.title || import_node_path5.default.basename(options.path),
      contentHash,
      version: options.version || "1",
      status: "ready",
      metadata: options.metadata ?? {}
    });
    const chunkDrafts = chunkKnowledgeContent({
      content: options.content,
      sourceType: options.sourceType,
      path: options.path,
      chunkLimit: options.chunkLimit,
      chunkCharLimit: options.chunkCharLimit
    });
    const chunkIds = db.replaceKnowledgeChunks(source.id, chunkDrafts.map((chunk) => ({
      sourceId: source.id,
      scope: options.scope,
      projectId: options.projectId ?? null,
      chunkType: chunk.chunkType,
      content: chunk.content,
      contentHash: sha256(chunk.content),
      status: "ready",
      metadata: {
        ...chunk.metadata,
        sourcePath: options.path,
        sourceType: options.sourceType
      },
      embedding: {
        model: LOCAL_KNOWLEDGE_EMBEDDING_MODEL,
        vector: createLocalTextEmbedding(chunk.content)
      }
    })));
    return {
      sourceId: source.id,
      chunks: chunkIds.length,
      changed: source.changed
    };
  });
}
async function ingestGlobalWritingResources(rootDir, options = {}) {
  const bundleDir = currentBundleDir();
  const candidates = [
    import_node_path5.default.join(rootDir, "packages", "ai-novel-core", "resources", "writing"),
    import_node_path5.default.resolve(bundleDir, "..", "resources", "writing"),
    import_node_path5.default.join(process.cwd(), "packages", "ai-novel-core", "resources", "writing")
  ];
  let resourceRoot = "";
  for (const candidate of candidates) {
    try {
      await import_promises3.default.access(candidate);
      resourceRoot = candidate;
      break;
    } catch {
    }
  }
  if (!resourceRoot) {
    return { sources: 0, chunks: 0 };
  }
  const files = [];
  async function walk(dir) {
    const entries = await import_promises3.default.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = import_node_path5.default.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (/\.(md|json)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  await walk(resourceRoot);
  const limit = Math.max(1, options.limit ?? files.length);
  let sources = 0;
  let chunks = 0;
  for (const filePath of files.slice(0, limit)) {
    const content = await import_promises3.default.readFile(filePath, "utf8");
    const relativePath = normalizeRelativePath(import_node_path5.default.join("packages", "ai-novel-core", "resources", "writing", import_node_path5.default.relative(resourceRoot, filePath)));
    const result = await ingestKnowledgeSource({
      rootDir,
      scope: "global",
      sourceType: sourceTypeForPath(relativePath),
      path: relativePath,
      title: import_node_path5.default.basename(filePath),
      content,
      metadata: {
        resourceRoot: "packages/ai-novel-core/resources/writing"
      },
      chunkLimit: filePath.endsWith("vocabulary_index.json") ? DEFAULT_GLOBAL_RESOURCE_LIMIT : void 0
    });
    sources += 1;
    chunks += result.chunks;
  }
  return { sources, chunks };
}
async function ingestProjectArtifact(options) {
  const absolutePath = import_node_path5.default.isAbsolute(options.artifactPath) ? options.artifactPath : import_node_path5.default.join(options.projectRoot, options.artifactPath);
  const content = options.content ?? await import_promises3.default.readFile(absolutePath, "utf8");
  return ingestKnowledgeSource({
    rootDir: options.rootDir,
    scope: "project",
    projectId: options.projectId,
    sourceType: sourceTypeForPath(options.artifactPath) || options.kind,
    path: normalizeRelativePath(options.artifactPath),
    title: import_node_path5.default.basename(options.artifactPath),
    content,
    metadata: {
      kind: options.kind,
      ...options.metadata || {}
    },
    chunkLimit: options.chunkLimit ?? DEFAULT_ARTIFACT_CHUNK_LIMIT
  });
}
async function retrieveKnowledge(options) {
  const results = await withFactoryDb(options.rootDir, async (db) => {
    const rows = db.recallKnowledge(options.query, {
      projectId: options.projectId ?? null,
      scopes: options.scopes,
      sourceTypes: options.sourceTypes,
      chunkTypes: options.chunkTypes,
      limit: options.limit ?? 8,
      embedding: createLocalTextEmbedding(options.query)
    });
    const resetFacts = options.projectId ? db.getChapterFacts(options.projectId).filter((fact) => fact.resetAt).map((fact) => ({ chapterNumber: fact.chapterNumber, resetAt: fact.resetAt || "" })) : [];
    const filteredRows = rows.filter((row) => {
      const source = row.source || {};
      const sourcePath = String(source.path || row.source_path || "");
      const sourceType = String(source.sourceType || row.source_type || "");
      const chapterNumber = chapterNumberFromKnowledgePath(sourcePath);
      const resetFact = chapterNumber ? resetFacts.find((fact) => fact.chapterNumber === chapterNumber) : null;
      if (!resetFact) {
        return true;
      }
      if (!["chapter", "memory", "checkpoint"].includes(sourceType)) {
        return true;
      }
      const rowUpdatedAt = String(row.updated_at || row.created_at || "");
      return timestampMs2(rowUpdatedAt) > timestampMs2(resetFact.resetAt);
    });
    if (options.recordCitation && options.projectId) {
      db.recordKnowledgeCitation({
        projectId: options.projectId,
        runId: options.runId ?? null,
        messageId: options.messageId ?? null,
        query: options.query,
        filters: {
          scopes: options.scopes,
          sourceTypes: options.sourceTypes,
          chunkTypes: options.chunkTypes,
          limit: options.limit ?? 8
        },
        results: filteredRows.map((row) => ({
          chunkId: row.id,
          sourceId: row.source_id,
          sourceType: row.source?.sourceType,
          sourcePath: row.source?.path,
          score: row.score
        })),
        usedChunkIds: filteredRows.map((row) => String(row.id))
      });
    }
    return filteredRows;
  });
  return results;
}
function formatKnowledgeForPrompt(rows, limit = 8) {
  if (!rows.length) {
    return "No writing knowledge resources matched this turn.";
  }
  return rows.slice(0, limit).map((row, index) => {
    const source = row.source || {};
    const pathValue = String(source.path || row.source_path || "");
    const title = String(source.title || row.source_title || import_node_path5.default.basename(pathValue) || "knowledge");
    return [
      `${index + 1}. [${String(row.chunk_type || "chunk")}] ${title}`,
      `Source: ${pathValue}`,
      `Score: ${Number(row.score || 0).toFixed(2)}`,
      String(row.content || "").slice(0, 520)
    ].join("\n");
  }).join("\n\n");
}
async function backfillPendingKnowledgeEmbeddings(rootDir, options = {}) {
  return withFactoryDb(rootDir, async (db) => {
    const rows = db.listPendingKnowledgeChunks({ projectId: options.projectId ?? null, limit: options.limit ?? 100 });
    for (const row of rows) {
      const chunkId = String(row.id);
      try {
        db.upsertKnowledgeEmbedding(chunkId, LOCAL_KNOWLEDGE_EMBEDDING_MODEL, createLocalTextEmbedding(String(row.content || "")));
      } catch (error) {
        db.markKnowledgeEmbeddingFailed(chunkId, error instanceof Error ? error.message : String(error));
      }
    }
    return rows.length;
  });
}

// src/writing-pipeline.ts
function currentBundleDir2() {
  const stack = new Error().stack || "";
  for (const line of stack.split("\n")) {
    const fileUrlMatch = line.match(/\(?file:\/\/([^):]+):\d+:\d+\)?/);
    if (fileUrlMatch) {
      return import_node_path6.default.dirname(decodeURIComponent(fileUrlMatch[1]));
    }
    const fileMatch = line.match(/\((\/[^():]+):\d+:\d+\)/) || line.match(/at (\/[^():]+):\d+:\d+/);
    if (fileMatch) {
      return import_node_path6.default.dirname(fileMatch[1]);
    }
  }
  return process.cwd();
}
function workspaceRootForProject(projectRoot) {
  const marker = `${import_node_path6.default.sep}.ai-novel-projects${import_node_path6.default.sep}`;
  const index = projectRoot.indexOf(marker);
  if (index >= 0) {
    return projectRoot.slice(0, index);
  }
  return projectRoot;
}
async function readOptionalText(filePath) {
  try {
    return (await import_promises4.default.readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}
async function readCharacterDossiers(filePath) {
  if (!filePath) return [];
  try {
    const parsed = JSON.parse(await import_promises4.default.readFile(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string") : [];
  } catch {
    return [];
  }
}
async function writeJsonFileAtomic(filePath, value) {
  await import_promises4.default.mkdir(import_node_path6.default.dirname(filePath), { recursive: true });
  const tempPath = import_node_path6.default.join(import_node_path6.default.dirname(filePath), `.${import_node_path6.default.basename(filePath)}.${Date.now()}.tmp`);
  await import_promises4.default.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`);
  await import_promises4.default.rename(tempPath, filePath);
}
function compactList(values = [], limit = 3) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit).join("; ") || "pending";
}
function escapeRegExpLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function summarizeCharacterDossiers(dossiers = [], limit = 6) {
  return dossiers.slice(0, limit).map((dossier) => [
    `- ${dossier.id} (${dossier.role}) name=${dossier.canonicalName}`,
    `  identity=${dossier.identityAndRole}`,
    `  desire=${dossier.coreDesire}; wound=${dossier.fearOrWound}`,
    `  habits=${compactList(dossier.behaviorHabits)}; speech=${compactList(dossier.speechMarkers)}`,
    `  body=${dossier.appearanceAndBody}`,
    `  skills=${compactList(dossier.skills)}; limits=${compactList(dossier.limitations)}`,
    `  relation=${dossier.relationshipState}; delta=${dossier.currentChapterDelta}`
  ].join("\n")).join("\n");
}
function formatCharacterDossiersMarkdown(dossiers) {
  return [
    "# Character Dossiers",
    "",
    "This file is generated from the structured production character dossier state.",
    "",
    summarizeCharacterDossiers(dossiers, 12) || "- no structured dossiers available"
  ].join("\n");
}
function appendUnique(values, next, limit = 8) {
  const normalized = next.trim();
  if (!normalized) return values.slice(0, limit);
  return [...values.filter((value) => value !== normalized), normalized].slice(-limit);
}
function updateCharacterDossiersAfterChapter(input) {
  const updatedAt = input.updatedAt || (/* @__PURE__ */ new Date()).toISOString();
  const knownCast = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.knownCast,
    ...extractChinesePersonNames(input.finalDraft, 12)
  ].filter(Boolean));
  const protagonistName = input.continuityContract.lockedProtagonistName || knownCast[0] || "";
  const chapterLabel = `chapter ${input.task.chapterNumber}`;
  const chapterDelta = `${chapterLabel}: ${getTaskCausalPlan(input.state, input.task).characterStateDelta}`;
  const evidence = `${chapterLabel}: ${input.finalDraft.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join(" ").slice(0, 180)}`;
  const continuityNote = `${chapterLabel}: ${input.continuityContract.continuityAnchors.slice(0, 4).join("\u3001") || "new continuity anchors pending"}`;
  const dossiers = input.dossiers.length ? input.dossiers : [];
  const nextDossiers = dossiers.map((dossier) => {
    const isProtagonist = dossier.role === "protagonist" || dossier.id === "protagonist";
    const isKnownCast = knownCast.some((name) => name && (dossier.canonicalName === name || dossier.aliases.includes(name)));
    if (!isProtagonist && !isKnownCast) return dossier;
    return {
      ...dossier,
      canonicalName: isProtagonist && protagonistName && dossier.canonicalName.startsWith("pending-") ? protagonistName : dossier.canonicalName,
      aliases: uniqueStrings([
        ...dossier.aliases,
        ...isProtagonist && protagonistName ? [protagonistName] : []
      ]).slice(0, 8),
      currentChapterDelta: chapterDelta,
      continuityNotes: appendUnique(dossier.continuityNotes, continuityNote),
      evidence: appendUnique(dossier.evidence, evidence),
      updatedAt
    };
  });
  const existingIds = new Set(nextDossiers.map((dossier) => dossier.id));
  for (const name of knownCast.slice(0, 8)) {
    if (!name || nextDossiers.some((dossier) => dossier.canonicalName === name || dossier.aliases.includes(name))) continue;
    const id = `supporting-${name.replace(/[^\p{Script=Han}A-Za-z0-9_-]+/gu, "-").replace(/^-+|-+$/g, "") || nextDossiers.length + 1}`;
    if (existingIds.has(id)) continue;
    existingIds.add(id);
    nextDossiers.push({
      id,
      role: "supporting",
      canonicalName: name,
      aliases: [name],
      identityAndRole: `Supporting cast member observed in ${chapterLabel}; role function requires Memory Keeper enrichment.`,
      coreDesire: "pending desire inferred from future scenes",
      fearOrWound: "pending wound inferred from future scenes",
      contradiction: "pending contradiction inferred from future scenes",
      behaviorHabits: ["pending observed habit"],
      speechMarkers: ["pending speech marker"],
      appearanceAndBody: "pending visible marker",
      skills: ["pending competence"],
      limitations: ["pending limitation"],
      relationshipState: `Observed around ${input.continuityContract.lockedProtagonistName || "the protagonist"} in ${chapterLabel}; relationship pressure pending.`,
      relationshipEdges: [{ targetId: "protagonist", label: "observed with", pressure: "needs relationship pressure enrichment" }],
      arcTrajectory: "pending recurring function",
      currentChapterDelta: chapterDelta,
      continuityNotes: [continuityNote],
      evidence: [evidence],
      updatedAt
    });
  }
  return nextDossiers;
}
function relativeArtifactPath(projectRoot, absolutePath) {
  return import_node_path6.default.relative(projectRoot, absolutePath).replaceAll(import_node_path6.default.sep, "/");
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
function enforceFinalDraftQualityGate(gate, finalDraft, task, state, protagonistProfile = "", continuityContract = createContinuityContract({ state, task, protagonistProfile }), characterDossiers) {
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
    characterDossiers,
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
  const selectedGenre = state.project.creativeProfile?.genre?.trim();
  const selectedNaturalness = state.project.creativeProfile?.naturalnessTarget || "balanced";
  const selectedReaderPromise = state.project.creativeProfile?.readerPromise?.trim();
  const selectedPointOfView = state.project.creativeProfile?.pointOfView?.trim();
  const selectedTone = state.project.creativeProfile?.tone?.trim();
  const selectedProfileText = [
    selectedGenre && selectedGenre !== "auto-inferred" ? selectedGenre : "",
    selectedReaderPromise || "",
    selectedPointOfView || "",
    selectedTone || ""
  ].join("\n");
  const text = `${state.project.title}
${state.project.idea}`.toLowerCase();
  const profileText = `${selectedProfileText}
${text}`.toLowerCase();
  const withProfile = (profile) => ({
    ...profile,
    naturalnessTarget: selectedNaturalness,
    readerPromise: selectedReaderPromise || "hook-forward, scene-first, emotionally specific",
    pointOfView: selectedPointOfView || "third-person limited",
    tone: selectedTone || "tense but readable"
  });
  if (/仙侠|修仙|玄幻|剑|神|魔|灵|immortal|fantasy|xianxia/i.test(profileText)) {
    return withProfile({
      genre: "\u7384\u5E7B/\u4ED9\u4FA0",
      narration: "\u65C1\u767D\u8981\u5F3A\u8C03\u89C4\u5219\u8FB9\u754C\u3001\u4EE3\u4EF7\u3001\u5947\u89C2\u611F\u4E0E\u5883\u754C\u538B\u529B\uFF1B\u6218\u6597\u573A\u666F\u7528\u52A8\u4F5C\u52A8\u8BCD\u548C\u611F\u5B98\u7EC6\u8282\uFF0C\u4E0D\u5806\u672F\u8BED\u3002",
      vocabularyScenes: ["\u6218\u6597", "\u81EA\u7136\u73AF\u5883", "\u8BAD\u7EC3\u4FEE\u70BC", "\u5FC3\u7406\u6D3B\u52A8"]
    });
  }
  if (/权谋|宫廷|朝堂|帝|王|court|palace|politic/i.test(profileText)) {
    return withProfile({
      genre: "\u6743\u8C0B/\u5BAB\u5EF7",
      narration: "\u65C1\u767D\u8981\u7A81\u51FA\u4FE1\u606F\u5DEE\u3001\u793C\u5236\u538B\u529B\u3001\u5BF9\u8BDD\u6F5C\u53F0\u8BCD\u4E0E\u5C40\u52BF\u53D8\u5316\uFF1B\u6B63\u5F0F\u573A\u5408\u5141\u8BB8\u8F83\u9AD8\u6587\u8A00\u6BD4\u4F8B\u3002",
      vocabularyScenes: ["\u5BAB\u5EF7", "\u6743\u8C0B\u7B97\u8BA1", "\u5BF9\u8BDD", "\u4EEA\u5F0F\u5E86\u5178"]
    });
  }
  if (/悬疑|谜|案|侦探|mystery|crime|thriller/i.test(profileText)) {
    return withProfile({
      genre: "\u60AC\u7591",
      narration: "\u65C1\u767D\u8981\u63A7\u5236\u7EBF\u7D22\u663E\u9690\u3001\u8BEF\u5BFC\u548C\u8282\u594F\uFF1B\u573A\u666F\u7EC6\u8282\u5FC5\u987B\u53EF\u56DE\u6536\uFF0C\u4E0D\u5199\u65E0\u610F\u4E49\u6C1B\u56F4\u3002",
      vocabularyScenes: ["\u73AF\u5883\u6E32\u67D3", "\u5FC3\u7406\u6D3B\u52A8", "\u5BF9\u8BDD"]
    });
  }
  if (/爱情|言情|恋|romance|love/i.test(profileText)) {
    return withProfile({
      genre: "\u8A00\u60C5/\u60C5\u611F",
      narration: "\u65C1\u767D\u8981\u8D34\u8FD1\u60C5\u7EEA\u7EC6\u8282\u3001\u5173\u7CFB\u63A8\u8FDB\u548C\u8EAB\u4F53\u53CD\u5E94\uFF1B\u51B2\u7A81\u8981\u843D\u5728\u9009\u62E9\u3001\u8BEF\u89E3\u548C\u6B32\u671B\u4E0A\u3002",
      vocabularyScenes: ["\u611F\u60C5\u620F", "\u5FC3\u7406\u6D3B\u52A8", "\u5BF9\u8BDD", "\u65E5\u5E38"]
    });
  }
  if (/都市|职场|现实|city|urban/i.test(profileText)) {
    return withProfile({
      genre: "\u90FD\u5E02/\u73B0\u5B9E",
      narration: "\u65C1\u767D\u8981\u4FDD\u7559\u751F\u6D3B\u8D28\u611F\u3001\u804C\u4E1A\u7EC6\u8282\u548C\u4EBA\u7269\u5173\u7CFB\u5F20\u529B\uFF1B\u8BED\u8A00\u4EE5\u73B0\u4EE3\u81EA\u7136\u4E3A\u4E3B\u3002",
      vocabularyScenes: ["\u65E5\u5E38", "\u5BF9\u8BDD", "\u5FC3\u7406\u6D3B\u52A8"]
    });
  }
  return withProfile({
    genre: selectedGenre && selectedGenre !== "auto-inferred" ? selectedGenre : "\u901A\u7528\u7C7B\u578B\u5C0F\u8BF4",
    narration: "\u65C1\u767D\u4F18\u5148\u670D\u52A1\u573A\u666F\u63A8\u8FDB\u3001\u89D2\u8272\u9009\u62E9\u548C\u8BFB\u8005\u671F\u5F85\uFF1B\u907F\u514D\u6A21\u677F\u5316\u603B\u7ED3\u3002",
    vocabularyScenes: ["\u5BF9\u8BDD", "\u73AF\u5883\u6E32\u67D3", "\u5FC3\u7406\u6D3B\u52A8"]
  });
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
  const characterDossiers = input.characterDossiers?.length ? input.characterDossiers : input.state.memory?.characterDossiers || [];
  const dossierBrief = summarizeCharacterDossiers(characterDossiers);
  const source = [
    dossierBrief,
    input.protagonistProfile || "",
    input.previousMemory || "",
    input.previousFinalDraft || "",
    input.blueprint || "",
    input.continuityContract.characterLedger
  ].join("\n\n");
  const knownCast = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.knownCast,
    ...characterDossiers.flatMap((dossier) => [dossier.canonicalName, ...dossier.aliases]),
    ...extractChinesePersonNames(source, 40)
  ].filter((name) => Boolean(name) && !/^pending-/u.test(String(name)))).slice(0, 24);
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
    "### Structured Dossier Brief",
    dossierBrief || "- no structured dossiers available",
    "",
    "### Profile Brief",
    profileBrief || "- \u6682\u65E0\u89D2\u8272\u6863\u6848\u6B63\u6587\uFF1B\u672C\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u53EF\u8FFD\u8E2A\u89D2\u8272\u6863\u6848\u3002"
  ].join("\n");
  return {
    status,
    requiredFields: CHARACTER_PROFILE_REQUIRED_FIELDS,
    knownCast,
    missingSignals,
    dossierBrief,
    profileBrief,
    prompt
  };
}
function evaluateCharacterVoiceDifferentiation(draft, contract) {
  const body = extractNarrativeBody(draft);
  const cast = contract.knownCast.map((name) => name.trim()).filter((name) => name && body.includes(name)).slice(0, 6);
  if (cast.length < 2) {
    return {
      status: "eligible",
      reason: "\u89D2\u8272\u5DEE\u5F02\u5316\u68C0\u67E5\u8DF3\u8FC7\uFF1A\u6B63\u6587\u4E2D\u5C11\u4E8E\u4E24\u4E2A\u5DF2\u77E5\u89D2\u8272\u540C\u65F6\u51FA\u73B0\u3002",
      observedCast: cast,
      missing: []
    };
  }
  const quotedDialogueCount = (body.match(/[「“][^」”]{2,120}[」”]/gu) || []).length;
  const homogenizedSignals = (body.match(/两个人都|二人都|他们都|也都|都很|都说|都觉得|都认为|同样|一样|事情很复杂|关系充满|局势正在变化/gu) || []).length;
  const templateVoiceSignals = cast.reduce((count, name) => {
    const namePattern = escapeRegExpLiteral(name);
    const matches = body.match(new RegExp(`${namePattern}.{0,18}(\u60F3\u8981|\u5FC5\u987B|\u89C9\u5F97|\u8BA4\u4E3A|\u8BF4|\u89E3\u91CA|\u6C89\u9ED8|\u7D27\u5F20)`, "gu")) || [];
    return count + matches.length;
  }, 0);
  const scored = cast.map((name) => {
    const pattern = new RegExp(`${escapeRegExpLiteral(name)}[\\s\\S]{0,90}|[\\s\\S]{0,70}${escapeRegExpLiteral(name)}`, "gu");
    const windows = [...body.matchAll(pattern)].map((match) => match[0]).join("\n");
    const dialogue = /[「“][^」”]{2,120}[」”]|说|问|道|喊|低声|冷笑|称呼/u.test(windows);
    const habit = /抬手|低头|停顿|皱眉|握住|松开|避开|看向|转身|下意识|指尖|肩|脚步|眼神/u.test(windows);
    const relation = /信任|怀疑|欠|救|骗|敌|同伴|关系|站在|背叛|帮|拦|让|替/u.test(windows);
    const agency = /决定|必须|想要|不能|只好|选择|拒绝|答应|追|藏|推|递|拿|按/u.test(windows);
    const score = [dialogue, habit, relation, agency].filter(Boolean).length;
    return { name, score, dialogue, habit, relation, agency };
  });
  const weak = scored.filter((entry) => entry.score < 2);
  const dialogueCarriers = scored.filter((entry) => entry.dialogue).length;
  const habitCarriers = scored.filter((entry) => entry.habit).length;
  const agencyCarriers = scored.filter((entry) => entry.agency).length;
  const concreteCarriers = scored.filter((entry) => entry.dialogue || entry.habit || entry.relation || entry.agency).length;
  const missing = [
    ...dialogueCarriers < 2 ? ["\u591A\u89D2\u8272\u5BF9\u767D/\u79F0\u547C\u5DEE\u5F02"] : [],
    ...habitCarriers < 2 ? ["\u591A\u89D2\u8272\u884C\u4E3A\u4E60\u60EF\u5DEE\u5F02"] : [],
    ...agencyCarriers < 2 ? ["\u591A\u89D2\u8272\u4E3B\u52A8\u9009\u62E9\u5DEE\u5F02"] : [],
    ...weak.length ? [`\u5F31\u89D2\u8272\u4FE1\u53F7\uFF1A${weak.map((entry) => entry.name).join("\u3001")}`] : []
  ];
  const clearlyFlattened = (homogenizedSignals >= 2 || templateVoiceSignals >= cast.length + 1) && (quotedDialogueCount < 2 || concreteCarriers < 2);
  if (clearlyFlattened) {
    return {
      status: "quarantined",
      reason: `\u89D2\u8272\u5DEE\u5F02\u5316\u4E0D\u8DB3\uFF1A${missing.join("\uFF1B") || "\u591A\u89D2\u8272\u88AB\u540C\u8D28\u5316\u6A21\u677F\u6982\u62EC"}\uFF0C\u68C0\u6D4B\u5230 ${homogenizedSignals} \u4E2A\u540C\u8D28\u5316\u6982\u62EC\u4FE1\u53F7\u548C ${templateVoiceSignals} \u4E2A\u6A21\u677F\u58F0\u97F3\u4FE1\u53F7\u3002`,
      observedCast: cast,
      missing
    };
  }
  return {
    status: "eligible",
    reason: `\u89D2\u8272\u5DEE\u5F02\u5316\u901A\u8FC7\uFF1A${cast.join("\u3001")} \u81F3\u5C11\u901A\u8FC7\u5BF9\u767D\u3001\u4E60\u60EF\u52A8\u4F5C\u6216\u4E3B\u52A8\u9009\u62E9\u5F62\u6210\u533A\u5206\u3002`,
    observedCast: cast,
    missing
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
  const differentiation = evaluateCharacterVoiceDifferentiation(draft, contract);
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
  if (differentiation.status === "quarantined") {
    return {
      status: "quarantined",
      reason: differentiation.reason,
      missing: [...missing, ...differentiation.missing],
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
    reason: missing.length ? `\u89D2\u8272\u6863\u6848\u57FA\u672C\u53EF\u7528\uFF0C\u4F46\u8FD8\u5E94\u8865\u5F3A\uFF1A${missing.join("\u3001")}\u3002${differentiation.reason}` : `\u89D2\u8272\u6863\u6848\u4FE1\u53F7\u901A\u8FC7\uFF1A\u6B63\u6587\u5305\u542B\u6B32\u671B\u3001\u884C\u4E3A\u3001\u5BF9\u767D\u3001\u5173\u7CFB\u548C\u53EF\u89C1\u7279\u5F81\u3002${differentiation.reason}`,
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
  const bundleDir = currentBundleDir2();
  const candidates = [
    import_node_path6.default.resolve(bundleDir, "..", "resources", "writing"),
    import_node_path6.default.join(workspaceRoot, "packages", "ai-novel-core", "resources", "writing"),
    import_node_path6.default.join(process.cwd(), "packages", "ai-novel-core", "resources", "writing")
  ];
  const cacheKey = candidates.join("|");
  const cached = productionWritingResourcesCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const loadPromise = (async () => {
    const find = async (relativePath) => {
      for (const candidate of candidates) {
        const text = await readOptionalText(import_node_path6.default.join(candidate, relativePath));
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
  const resourceDir = import_node_path6.default.join(paths.styleDir, "production-resources");
  await import_promises4.default.mkdir(resourceDir, { recursive: true });
  const guidePath = import_node_path6.default.join(resourceDir, "production-writing-assets.md");
  const genre = inferGenreProfile(state);
  const content = [
    "# Production Writing Resources",
    "",
    `Project: ${state.project.title}`,
    `Genre profile: ${genre.genre}`,
    `Reader promise: ${genre.readerPromise}`,
    `Point of view: ${genre.pointOfView}`,
    `Tone: ${genre.tone}`,
    `Naturalness target: ${genre.naturalnessTarget}`,
    "",
    ensureMarkdownSection("Genre Narration Strategy", genre.narration),
    ensureMarkdownSection("Creation-Time Creative Profile", [
      `- reader promise: ${genre.readerPromise}`,
      `- point of view: ${genre.pointOfView}`,
      `- tone: ${genre.tone}`,
      `- naturalness target: ${genre.naturalnessTarget}`
    ].join("\n")),
    ensureMarkdownSection("Style Guide", resources.styleGuide || "Production style guide not found."),
    ensureMarkdownSection("Chapter Planner Guide", resources.chapterPlannerGuide || "Production chapter planner guide not found."),
    ensureMarkdownSection("Writer Guide", resources.writerGuide || "Production writer guide not found."),
    ensureMarkdownSection("Editor Guide", resources.editorGuide || "Production editor guide not found."),
    ensureMarkdownSection("Style Controller Guide", resources.styleControllerGuide || "Production style controller guide not found."),
    ensureMarkdownSection("Consistency Guide", resources.consistencyGuide || "Production consistency guide not found.")
  ].join("\n");
  await import_promises4.default.writeFile(guidePath, content);
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
    `Reader promise: ${genre.readerPromise}`,
    `Point of view: ${genre.pointOfView}`,
    `Tone: ${genre.tone}`,
    `Naturalness target: ${genre.naturalnessTarget}`,
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
        `\u8BFB\u8005\u627F\u8BFA\uFF1A${genre.readerPromise}`,
        `\u89C6\u89D2\uFF1A${genre.pointOfView}`,
        `\u8BED\u6C14\uFF1A${genre.tone}`,
        `\u81EA\u7136\u5EA6\u76EE\u6807\uFF1A${genre.naturalnessTarget}`,
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
    `Genre profile: ${genre.genre}`,
    `Reader promise: ${genre.readerPromise}`,
    `Point of view: ${genre.pointOfView}`,
    `Tone: ${genre.tone}`,
    `Naturalness target: ${genre.naturalnessTarget}`,
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
    `- \u8BFB\u8005\u627F\u8BFA\uFF1A${genre.readerPromise}`,
    `- \u89C6\u89D2\uFF1A${genre.pointOfView}`,
    `- \u8BED\u6C14\uFF1A${genre.tone}`,
    `- \u81EA\u7136\u5EA6\u76EE\u6807\uFF1A${genre.naturalnessTarget}`,
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
      `\u8BFB\u8005\u627F\u8BFA\uFF1A${genre.readerPromise}`,
      `\u89C6\u89D2\uFF1A${genre.pointOfView}`,
      `\u8BED\u6C14\uFF1A${genre.tone}`,
      `\u81EA\u7136\u5EA6\u76EE\u6807\uFF1A${genre.naturalnessTarget}`,
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
            const now2 = Date.now();
            const isFirstDelta = !firstDeltaSeen;
            firstDeltaSeen = true;
            if (!isFirstDelta && now2 - lastStreamProgressAt < 2500) {
              return;
            }
            lastStreamProgressAt = now2;
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
    const previousFinalDraft = await readOptionalText(import_node_path6.default.join(paths.chaptersDir, `${previousChapterId}.final.md`));
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
    rawMemory = await readOptionalText(import_node_path6.default.join(paths.memoryDir, `${previousChapterId}-memory.md`));
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
async function createDraftBody(state, task, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot, characterDossiers) {
  throwIfPipelineAborted(options);
  if (continuityContract.status === "blocked") {
    throw new Error(`Continuity contract is blocked before drafting: chapter ${task.chapterNumber} has no locked protagonist.`);
  }
  const fallback = createDraftBodyFromBlueprint(state, task, blueprint, resources, continuityContract);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
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
    `\u7C7B\u578B\uFF1A${genre.genre}`,
    `\u8BFB\u8005\u627F\u8BFA\uFF1A${genre.readerPromise}`,
    `\u89C6\u89D2\uFF1A${genre.pointOfView}`,
    `\u8BED\u6C14\uFF1A${genre.tone}`,
    `\u81EA\u7136\u5EA6\u76EE\u6807\uFF1A${genre.naturalnessTarget}`,
    `\u76EE\u6807\u5B57\u6570\uFF1A${task.targetWords}`,
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
function createQualityReport(state, task, draft, blueprint, continuityContract = createContinuityContract({ state, task, blueprint }), characterDossiers) {
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
    characterDossiers,
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
function appendQualityHardChecks(report, task, draft, continuityContract, state, characterDossiers) {
  const count = wordCount(draft);
  const target = task.targetWords;
  const continuityFixes = continuityContract ? continuityContract.requiredNames.filter((name) => !draft.includes(name)).map((name) => `- \u9700\u8981\u8FD4\u5DE5\uFF1ACanon \u8FDE\u7EED\u6027\u5931\u8D25\uFF0C\u6B63\u6587\u672A\u51FA\u73B0\u5FC5\u9700\u4EBA\u7269\u300C${name}\u300D\uFF0C\u4E0D\u80FD\u8FDB\u5165 complete\u3002`) : [];
  const plotContinuity = continuityContract ? evaluatePlotContinuityBridge(draft, task, continuityContract) : null;
  const styleQuality = evaluateNarrativeStyleQuality(draft);
  const characterProfileContract = continuityContract && state ? buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
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
async function createProductionQualityReport(state, task, draft, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint }), characterDossiers) {
  throwIfPipelineAborted(options);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft,
    blueprint
  });
  const fallback = createQualityReport(state, task, draft, blueprint, continuityContract, characterDossiers);
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
      characterProfileContract.prompt,
      "",
      "## Draft",
      draft
    ].join("\n")
  });
  const report = generated.includes("Chapter Quality Report") ? generated : `${fallback}

---

## LLM Editor Notes
${generated}`;
  return appendQualityHardChecks(report, task, draft, continuityContract, state, characterDossiers);
}
async function reviseDraftForQualityGate(state, task, draft, report, blueprint, resources, options, attempt, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot, characterDossiers) {
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
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft,
    blueprint
  });
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
    continuityContract.prompt,
    "",
    characterProfileContract.prompt
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
async function runQualityGateWithRevisions(state, task, initialDraft, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot, characterDossiers) {
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
    report = await createProductionQualityReport(state, task, draft, blueprint, resources, options, continuityContract, characterDossiers);
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
      projectRoot,
      characterDossiers
    );
  }
  return { draft, report, gate };
}
function createPolishedDraft(state, task, draft, report, gate = parseQualityGate(report), mode = "fast", naturalnessReport) {
  const genre = inferGenreProfile(state);
  return [
    draft.replace("## Draft Body", "## Final Body"),
    "",
    "---",
    "",
    "## Naturalness Pass",
    `- Production writing mode: ${mode}.`,
    `- Naturalness target: ${genre.naturalnessTarget}.`,
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
async function createProductionPolishedDraft(state, task, draft, report, gate, resources, options, continuityContract = createContinuityContract({ state, task }), characterDossiers) {
  throwIfPipelineAborted(options);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
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
function createChapterMemoryUpdate(state, task, finalDraft, continuityContract = createContinuityContract({ state, task }), characterDossiers) {
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
    characterDossiers,
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
    "## Structured Character Dossier Carryover",
    characterProfileContract.dossierBrief || "- no structured dossier carryover available",
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
  await import_promises4.default.mkdir(paths.plansDir, { recursive: true });
  await import_promises4.default.writeFile(paths.masterOutlinePath, `${content}
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
  await import_promises4.default.mkdir(paths.chapterBlueprintsDir, { recursive: true });
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
    const blueprintPath = import_node_path6.default.join(paths.chapterBlueprintsDir, `chapter-${String(task.chapterNumber).padStart(3, "0")}.md`);
    await import_promises4.default.writeFile(blueprintPath, `${content}
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
  const characterDossiers = await readCharacterDossiers(paths.characterDossiersPath);
  const chapterId = `chapter-${String(task.chapterNumber).padStart(3, "0")}`;
  const previousChapterId = task.chapterNumber > 1 ? `chapter-${String(task.chapterNumber - 1).padStart(3, "0")}` : "";
  const previousMemory = previousChapterId ? await readOptionalText(import_node_path6.default.join(paths.memoryDir, `${previousChapterId}-memory.md`)) : "";
  const previousFinalDraft = previousChapterId ? await readOptionalText(import_node_path6.default.join(paths.chaptersDir, `${previousChapterId}.final.md`)) : "";
  const blueprintPath = import_node_path6.default.join(paths.chapterBlueprintsDir, `${chapterId}.md`);
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
    await import_promises4.default.mkdir(paths.chapterBlueprintsDir, { recursive: true });
    await import_promises4.default.writeFile(blueprintPath, `${blueprint}
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
  const initialDraft = await createDraftBody(state, task, blueprint, resources, options, continuityContract, paths, projectRoot, characterDossiers);
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
  const { draft, report, gate } = await runQualityGateWithRevisions(state, task, initialDraft, blueprint, resources, options, continuityContract, paths, projectRoot, characterDossiers);
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
  const finalDraft = gate.status === "blocked" ? createPolishedDraft(state, task, draft, report, gate, writingMode) : await createProductionPolishedDraft(state, task, draft, report, gate, resources, options, continuityContract, characterDossiers);
  const finalGate = enforceFinalDraftQualityGate(gate, finalDraft, task, state, protagonistProfile, continuityContract, characterDossiers);
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
  const memoryUpdate = createChapterMemoryUpdate(state, task, finalDraft, continuityContract, characterDossiers);
  const updatedCharacterDossiers = updateCharacterDossiersAfterChapter({
    dossiers: characterDossiers,
    state,
    task,
    finalDraft,
    memoryUpdate,
    continuityContract
  });
  if (updatedCharacterDossiers.length) {
    state.memory = {
      ...state.memory || {},
      characterDossiers: updatedCharacterDossiers
    };
  }
  throwIfPipelineAborted(options);
  const draftPath = import_node_path6.default.join(paths.chaptersDir, `${chapterId}.draft.md`);
  const reviewedPath = import_node_path6.default.join(paths.chaptersDir, `${chapterId}.reviewed.md`);
  const finalPath = import_node_path6.default.join(paths.chaptersDir, `${chapterId}.final.md`);
  const reportPath = import_node_path6.default.join(paths.reportsDir, `${chapterId}-quality.md`);
  const memoryPath = import_node_path6.default.join(paths.memoryDir, `${chapterId}-memory.md`);
  await import_promises4.default.mkdir(paths.chaptersDir, { recursive: true });
  await import_promises4.default.mkdir(paths.reportsDir, { recursive: true });
  await import_promises4.default.mkdir(paths.memoryDir, { recursive: true });
  await import_promises4.default.writeFile(draftPath, `${draft}
`);
  await import_promises4.default.writeFile(reportPath, `${report}
`);
  await import_promises4.default.writeFile(reviewedPath, `${draft}

---

${report}
`);
  await import_promises4.default.writeFile(finalPath, `${finalDraft}
`);
  await import_promises4.default.writeFile(memoryPath, `${memoryUpdate}
`);
  if (paths.characterDossiersPath && updatedCharacterDossiers.length) {
    await writeJsonFileAtomic(paths.characterDossiersPath, updatedCharacterDossiers);
  }
  if (paths.characterDossiersMarkdownPath && updatedCharacterDossiers.length) {
    await import_promises4.default.writeFile(paths.characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown(updatedCharacterDossiers)}
`);
  }
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
  if (paths.characterDossiersPath && updatedCharacterDossiers.length) {
    await recordPipelineArtifact(projectRoot, paths.characterDossiersPath, "memory", options, {
      chapterNumber: task.chapterNumber,
      kind: "character_dossiers",
      qualityGate: finalGate
    });
  }
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

// src/context-packet.ts
var import_promises5 = __toESM(require("fs/promises"), 1);
var import_node_path7 = __toESM(require("path"), 1);
function compactList2(values = [], limit = 2) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit).join("; ") || "pending";
}
function clipText(value = "", maxLength = 100) {
  const normalized = value.trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}
function summarizeCharacterDossiers2(state, limit = 3) {
  const dossiers = state.memory?.characterDossiers || [];
  const selected = [
    ...dossiers.filter((dossier) => dossier.role === "protagonist"),
    ...dossiers.filter((dossier) => dossier.role !== "protagonist")
  ].slice(0, limit);
  return selected.length ? selected.map((dossier) => `- ${dossier.id} (${dossier.role}) name=${dossier.canonicalName}; desire=${clipText(dossier.coreDesire)}; habit=${compactList2(dossier.behaviorHabits)}; delta=${clipText(dossier.currentChapterDelta)}`) : ["- No structured character dossiers have been recorded yet."];
}
function getContextFocusForStage(stage) {
  switch (stage) {
    case "worldbuilding_dialogue":
      return {
        target: "worldbuilding discussion",
        asset: ".ai-novel/prompts/global-consensus.md"
      };
    case "setting_review":
      return {
        target: "setting review",
        asset: ".ai-novel/plans/setting-freeze.md"
      };
    case "master_planning":
      return {
        target: "master planning",
        asset: ".ai-novel/plans/master-outline.md"
      };
    case "chapter_task_generation":
      return {
        target: "chapter blueprint planning",
        asset: ".ai-novel/plans/chapter-blueprints/"
      };
    case "drafting":
      return {
        target: "chapter drafting",
        asset: ".ai-novel/chapters/"
      };
    case "reviewing":
      return {
        target: "chapter quality review",
        asset: ".ai-novel/reports/"
      };
    case "replanning":
      return {
        target: "replanning",
        asset: ".ai-novel/reports/interruptions.log.md"
      };
    case "complete":
      return {
        target: "completed production review",
        asset: ".ai-novel/chapters/"
      };
    default:
      return {
        target: "workflow",
        asset: ".ai-novel/"
      };
  }
}
function syncContextPacketStateText(current, state) {
  if (!current.includes("Workflow state:")) {
    return current;
  }
  const focus = getContextFocusForStage(state.runtime.stage);
  const withWorkflow = current.replace(/^- Stage: .*$/m, `- Stage: ${state.runtime.stage}`).replace(/^- Last action: .*$/m, `- Last action: ${state.runtime.lastAction}`).replace(/^- Last route: .*$/m, `- Last route: ${state.runtime.lastRoute}`).replace(/^- Autopilot running: .*$/m, `- Autopilot running: ${Boolean(state.runtime.autopilot?.running)}`).replace(/^- Target: .*$/m, `- Target: ${focus.target}`).replace(/^- Asset: .*$/m, `- Asset: ${focus.asset}`);
  const characterSection = [
    "Structured character dossier carryover:",
    ...summarizeCharacterDossiers2(state)
  ].join("\n");
  if (/Structured character dossier carryover:\n(?:- .*\n?)*/m.test(withWorkflow)) {
    return withWorkflow.replace(/Structured character dossier carryover:\n(?:- .*\n?)*/m, `${characterSection}
`);
  }
  return withWorkflow.replace(/Consensus carryover:\n/m, `${characterSection}

Consensus carryover:
`);
}
function createCurrentContextPacketText(state) {
  const focus = getContextFocusForStage(state.runtime.stage);
  return [
    "# Current Context Packet",
    "",
    "Context hierarchy:",
    "1. System/developer protocol and role prompts.",
    "2. Original project mission and workflow stage.",
    "3. Global consensus and committed facts.",
    "4. Recent discussion transcript and user interventions.",
    "5. Super Graph checkpoints, assets, and drift constraints.",
    "6. Current user message or background worker instruction.",
    "",
    "Original mission:",
    `- Project: ${state.project.title}`,
    `- Idea: ${state.project.idea}`,
    `- Target chapters: ${state.plan.totalChapters}`,
    `- Chapter word target: ${state.plan.chapterWordTarget}`,
    "",
    "Workflow state:",
    `- Stage: ${state.runtime.stage}`,
    `- Last action: ${state.runtime.lastAction}`,
    `- Last route: ${state.runtime.lastRoute}`,
    `- Autopilot running: ${Boolean(state.runtime.autopilot?.running)}`,
    `- Target: ${focus.target}`,
    `- Asset: ${focus.asset}`,
    "",
    "Consensus carryover:",
    "- No compact consensus has been recorded yet.",
    "",
    "Structured character dossier carryover:",
    ...summarizeCharacterDossiers2(state),
    "",
    "Memory/RAG recall:",
    "- No database memory recall matched this turn yet."
  ].join("\n");
}
async function syncCurrentContextPacketFile(projectRoot, state) {
  const contextPath = import_node_path7.default.join(projectRoot, ".ai-novel", "context", "current-context.md");
  const current = await import_promises5.default.readFile(contextPath, "utf8").catch(() => "");
  if (!current) {
    await import_promises5.default.mkdir(import_node_path7.default.dirname(contextPath), { recursive: true });
    await import_promises5.default.writeFile(contextPath, `${createCurrentContextPacketText(state)}
`);
    return;
  }
  const next = syncContextPacketStateText(current, state);
  if (next === current) {
    return;
  }
  await import_promises5.default.writeFile(contextPath, next.endsWith("\n") ? next : `${next}
`);
}

// src/orchestrator.ts
var WORKSPACE_DIR2 = ".ai-novel";
var PROJECTS_DIR = ".ai-novel-projects";
var PROJECTS_REGISTRY_FILE = "projects.json";
var DEFAULT_CHAPTER_RECOVERY_LIMIT = 3;
function stageRoute(stage) {
  switch (stage) {
    case "worldbuilding_dialogue":
      return "worldbuilding";
    case "setting_review":
      return "setting_review";
    case "master_planning":
      return "master_planning";
    case "chapter_task_generation":
      return "chapter_task_generation";
    case "drafting":
      return "drafting";
    case "reviewing":
      return "reviewing";
    case "replanning":
      return "replanning";
    case "complete":
      return "complete";
    default:
      return "workflow";
  }
}
function stampRuntimeProgress(state, action, route = stageRoute(state.runtime.stage)) {
  state.runtime.lastRoute = route;
  state.runtime.lastAction = action;
}
function getProjectsPaths(rootDir) {
  const projectsRoot = import_node_path8.default.join(rootDir, PROJECTS_DIR);
  return {
    projectsRoot,
    registryPath: import_node_path8.default.join(projectsRoot, PROJECTS_REGISTRY_FILE)
  };
}
async function readProjectRegistry(rootDir) {
  const { registryPath } = getProjectsPaths(rootDir);
  try {
    const raw = await import_promises6.default.readFile(registryPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function resolveProjectRoot(rootDir, projectId) {
  return import_node_path8.default.join(rootDir, PROJECTS_DIR, projectId);
}
function resolveStoredProjectRoot(rootDir, projectRoot, projectId) {
  if (import_node_path8.default.isAbsolute(projectRoot)) {
    return projectRoot;
  }
  const rootRelative = import_node_path8.default.resolve(rootDir, projectRoot);
  const managedRoot = resolveProjectRoot(rootDir, projectId);
  if (import_node_path8.default.normalize(projectRoot).includes(`${PROJECTS_DIR}${import_node_path8.default.sep}`)) {
    return managedRoot;
  }
  return rootRelative;
}
function getWorkspacePaths(rootDir) {
  const workspaceDir = import_node_path8.default.join(rootDir, WORKSPACE_DIR2);
  return {
    workspaceDir,
    statePath: import_node_path8.default.join(workspaceDir, "state.json"),
    promptsDir: import_node_path8.default.join(workspaceDir, "prompts"),
    agentPromptsDir: import_node_path8.default.join(workspaceDir, "prompts", "agents"),
    consensusPath: import_node_path8.default.join(workspaceDir, "prompts", "global-consensus.md"),
    plansDir: import_node_path8.default.join(workspaceDir, "plans"),
    reportsDir: import_node_path8.default.join(workspaceDir, "reports"),
    styleDir: import_node_path8.default.join(workspaceDir, "style"),
    styleProfilePath: import_node_path8.default.join(workspaceDir, "style", "profile.md"),
    styleRulebookPath: import_node_path8.default.join(workspaceDir, "style", "rulebook.md"),
    styleReferencesPath: import_node_path8.default.join(workspaceDir, "style", "references.md"),
    styleAntiPatternsPath: import_node_path8.default.join(workspaceDir, "style", "anti-patterns.md"),
    chaptersDir: import_node_path8.default.join(workspaceDir, "chapters"),
    assetsDir: import_node_path8.default.join(workspaceDir, "assets"),
    coverDir: import_node_path8.default.join(workspaceDir, "assets", "cover"),
    comicDir: import_node_path8.default.join(workspaceDir, "assets", "comic"),
    memoryDir: import_node_path8.default.join(workspaceDir, "memory"),
    charactersDir: import_node_path8.default.join(workspaceDir, "memory", "characters"),
    characterCoreDir: import_node_path8.default.join(workspaceDir, "memory", "characters", "core"),
    characterDossiersPath: import_node_path8.default.join(workspaceDir, "memory", "characters", "dossiers.json"),
    characterDossiersMarkdownPath: import_node_path8.default.join(workspaceDir, "memory", "characters", "dossiers.md"),
    protagonistPath: import_node_path8.default.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
    relationsPath: import_node_path8.default.join(workspaceDir, "memory", "characters", "relations.md"),
    characterEvolutionPath: import_node_path8.default.join(workspaceDir, "memory", "characters", "evolution.md"),
    configPath: import_node_path8.default.join(workspaceDir, "config.json"),
    settingFreezePath: import_node_path8.default.join(workspaceDir, "plans", "setting-freeze.md"),
    masterOutlinePath: import_node_path8.default.join(workspaceDir, "plans", "master-outline.md"),
    chapterBlueprintsDir: import_node_path8.default.join(workspaceDir, "plans", "chapter-blueprints"),
    coverPromptPath: import_node_path8.default.join(workspaceDir, "assets", "cover", "cover-prompt.md")
  };
}
async function readOptionalText2(filePath) {
  try {
    return (await import_promises6.default.readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}
async function writeJsonFileAtomic2(filePath, value) {
  const data = `${JSON.stringify(value, null, 2)}
`;
  await import_promises6.default.mkdir(import_node_path8.default.dirname(filePath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tempPath = import_node_path8.default.join(import_node_path8.default.dirname(filePath), `.${import_node_path8.default.basename(filePath)}.${process.pid}.${Date.now()}.${(0, import_node_crypto2.randomUUID)()}.tmp`);
    try {
      const handle = await import_promises6.default.open(tempPath, "wx");
      try {
        await handle.writeFile(data, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await import_promises6.default.rename(tempPath, filePath);
      return;
    } catch (error) {
      await import_promises6.default.unlink(tempPath).catch(() => void 0);
      if (attempt === 0 && error instanceof Error && "code" in error && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}
function extractSectionBullets(source, heading, limit = 4) {
  const lines = source.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex < 0) {
    return [];
  }
  const collected = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      if (collected.length > 0) {
        break;
      }
      continue;
    }
    if (line.startsWith("#")) {
      break;
    }
    if (line.startsWith("- ")) {
      collected.push(line);
      if (collected.length >= limit) {
        break;
      }
    }
  }
  return collected;
}
async function listAutonomousProjects(rootDir) {
  return readProjectRegistry(rootDir);
}
async function resolveManagedProjectRoot(rootDir, projectId) {
  const projects = await readProjectRegistry(rootDir);
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) {
    throw new Error(`Project '${projectId}' not found.`);
  }
  return resolveStoredProjectRoot(rootDir, project.projectRoot, project.id);
}
async function loadAutonomousState(rootDir) {
  const { statePath } = getWorkspacePaths(rootDir);
  const raw = await import_promises6.default.readFile(statePath, "utf8");
  return JSON.parse(raw);
}
async function saveAutonomousState(rootDir, state) {
  const { statePath } = getWorkspacePaths(rootDir);
  state.runtime.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await writeJsonFileAtomic2(statePath, state);
  await syncCurrentContextPacketFile(rootDir, state).catch(() => void 0);
}
async function syncManagedProjectState(rootDir, projectId, state) {
  await withFactoryDb(rootDir, async (db) => {
    db.updateProjectState(projectId, state);
  });
}
async function recordWorkflowEvent(options, type, payload) {
  if (!options.factoryRootDir || !options.projectId) {
    return;
  }
  await withFactoryDb(options.factoryRootDir, async (db) => {
    const eventPayload = payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload, directorCommandId: options.directorCommandId ?? null } : { value: payload, directorCommandId: options.directorCommandId ?? null };
    db.recordEvent(options.projectId, null, type, eventPayload);
  }).catch(() => void 0);
}
function getMaxRecoveryAttempts(options) {
  return Math.max(1, options.maxRecoveryAttempts ?? DEFAULT_CHAPTER_RECOVERY_LIMIT);
}
async function autoRequeueChapterAfterRecoveryLimit(rootDir, state, task, pipelineOptions, reason) {
  const maxRecoveryAttempts = getMaxRecoveryAttempts(pipelineOptions);
  const previousQualityGate = task.qualityGate || null;
  task.status = "pending";
  task.recoveryAttempts = 0;
  task.recoveryBlocked = false;
  task.recoveryQueuedAt = (/* @__PURE__ */ new Date()).toISOString();
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = `Chapter ${task.chapterNumber} reached the recovery limit and was automatically queued for a fresh production pass.`;
  stampRuntimeProgress(state, `auto_requeue_chapter:${task.chapterNumber}`);
  await saveAutonomousState(rootDir, state);
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED", {
    chapterNumber: task.chapterNumber,
    maxRecoveryAttempts,
    previousQualityGate,
    reason
  });
  await recordWorkflowEvent(pipelineOptions, "WRITING_PROGRESS", {
    step: "chapter_auto_rewrite_queued",
    role: "Editor",
    chapterNumber: task.chapterNumber,
    status: "pending",
    message: `Chapter ${task.chapterNumber} reached the unattended recovery limit and was queued for a fresh rewrite.`,
    qualityGate: previousQualityGate
  });
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
    chapterNumber: task.chapterNumber,
    status: "pending",
    reason: "chapter_auto_rewrite_queued",
    recoveryAttempts: task.recoveryAttempts,
    recoveryQueuedAt: task.recoveryQueuedAt
  });
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
  }
  return state;
}
async function markChapterRecoveryLimitReached(rootDir, state, task, pipelineOptions, reason) {
  return autoRequeueChapterAfterRecoveryLimit(rootDir, state, task, pipelineOptions, reason);
}
async function queueChapterRecovery(rootDir, state, task, pipelineOptions, eventPayload = {}) {
  const maxRecoveryAttempts = getMaxRecoveryAttempts(pipelineOptions);
  if ((task.recoveryAttempts || 0) >= maxRecoveryAttempts) {
    return markChapterRecoveryLimitReached(
      rootDir,
      state,
      task,
      pipelineOptions,
      String(eventPayload.reason || "automatic_recovery_limit_reached")
    );
  }
  task.status = "pending";
  task.recoveryAttempts = (task.recoveryAttempts || 0) + 1;
  task.recoveryBlocked = false;
  task.recoveryQueuedAt = (/* @__PURE__ */ new Date()).toISOString();
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = `Recovered blocked chapter ${task.chapterNumber} for another production pass (recovery attempt ${task.recoveryAttempts}/${maxRecoveryAttempts}).`;
  stampRuntimeProgress(state, `chapter_recovery_queued:${task.chapterNumber}`);
  await saveAutonomousState(rootDir, state);
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_PIPELINE_RECOVERY_QUEUED", {
    chapterNumber: task.chapterNumber,
    recoveryAttempts: task.recoveryAttempts,
    maxRecoveryAttempts,
    previousQualityGate: task.qualityGate || null,
    ...eventPayload
  });
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
    chapterNumber: task.chapterNumber,
    status: "pending",
    reason: "chapter_recovery_queued",
    recoveryAttempts: task.recoveryAttempts,
    recoveryQueuedAt: task.recoveryQueuedAt
  });
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
  }
  return state;
}
async function produceChapterTask(rootDir, paths, state, task, pipelineOptions) {
  throwIfStopped(pipelineOptions.signal);
  const writingMode = pipelineOptions.writingMode === "quality" || process.env.AI_NOVEL_WRITING_MODE === "quality" ? "quality" : "fast";
  task.status = "in_progress";
  task.recoveryQueuedAt = void 0;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = writingMode === "quality" ? `Chapter ${task.chapterNumber} is in quality production: blueprint, draft, LLM review, polish, and memory update are running.` : `Chapter ${task.chapterNumber} is in fast unattended production: draft generation and deterministic continuity/resource gates are running.`;
  stampRuntimeProgress(state, `chapter_production_started:${task.chapterNumber}`);
  await saveAutonomousState(rootDir, state);
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: task.chapterNumber,
      status: "in_progress",
      reason: "chapter_production_started"
    });
  }
  let produced;
  try {
    produced = await runChapterProductionPipeline(rootDir, paths, state, task, pipelineOptions);
  } catch (error) {
    if (error.isProviderFailure) {
      task.status = "pending";
      state.runtime.statusMessage = `Provider error: ${error.message}`;
      stampRuntimeProgress(state, `provider_failure:${task.chapterNumber}`);
      await saveAutonomousState(rootDir, state);
      if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
        await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
        await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
          chapterNumber: task.chapterNumber,
          status: "pending",
          reason: `provider_failure: ${error.message}`
        });
      }
    }
    throw error;
  }
  throwIfStopped(pipelineOptions.signal);
  task.status = produced.qualityGate.status === "blocked" ? "blocked" : "complete";
  task.qualityGate = {
    ...produced.qualityGate,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (task.status === "complete") {
    task.recoveryBlocked = false;
  }
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length;
  state.runtime.stage = task.status === "blocked" ? "reviewing" : state.plan.pendingChapters > 0 ? "drafting" : "complete";
  state.runtime.statusMessage = task.status === "blocked" ? `Chapter ${task.chapterNumber} is blocked by the quality gate after ${produced.qualityGate.attempts} revision attempt(s): ${produced.qualityGate.reason}` : state.runtime.stage === "complete" ? "All chapter drafts have been generated." : writingMode === "quality" ? `Generated, reviewed, polished, and memorized chapter ${task.chapterNumber} (${produced.wordCount} estimated words). Continue to the next queued chapter.` : `Generated chapter ${task.chapterNumber} in fast unattended mode and recorded quality gates/memory (${produced.wordCount} estimated words). Continue to the next queued chapter.`;
  stampRuntimeProgress(
    state,
    task.status === "blocked" ? `chapter_blocked:${task.chapterNumber}` : state.runtime.stage === "complete" ? "workflow_complete" : `chapter_completed:${task.chapterNumber}`
  );
  await saveAutonomousState(rootDir, state);
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
  }
  return { state, produced };
}
function applyChapterFactsToState(state, facts) {
  const changed = [];
  const factsByChapter = new Map(facts.map((fact) => [fact.chapterNumber, fact]));
  for (const task of state.plan.chapterTasks) {
    const fact = factsByChapter.get(task.chapterNumber);
    if (!fact) continue;
    const previousStatus = task.status;
    let nextStatus = task.status;
    let reason = "";
    const latestTaskStatusAt = Date.parse(fact.latestTaskStatusAt || "");
    const qualityGateUpdatedAt = Date.parse(fact.qualityGate?.updatedAt || fact.updatedAt || "");
    const taskInstructionIsNewer = Number.isFinite(latestTaskStatusAt) && (!Number.isFinite(qualityGateUpdatedAt) || latestTaskStatusAt > qualityGateUpdatedAt);
    const factHasQueuedRecovery = taskInstructionIsNewer && (fact.latestTaskStatus === "pending" || fact.latestTaskStatus === "in_progress");
    if (fact.resetAt && fact.status === "pending" && fact.latestTaskStatus === "pending") {
      nextStatus = "pending";
      reason = "chapter queue was reset for a fresh production pass";
      task.recoveryAttempts = 0;
      delete task.recoveryBlocked;
      delete task.recoveryQueuedAt;
      delete task.qualityGate;
      delete task.contentQuality;
    } else if (fact.status === "in_progress" && !fact.qualityGate) {
      nextStatus = "in_progress";
      reason = fact.latestStep || "latest writing event is running";
    } else if (fact.status === "complete") {
      nextStatus = "complete";
      reason = "quality gate passed";
    } else if (fact.qualityGate?.status === "passed" && fact.contentQuality?.status === "quarantined") {
      nextStatus = "pending";
      reason = fact.contentQuality.reason || "final artifact is quarantined by deterministic checks";
    } else if (factHasQueuedRecovery) {
      nextStatus = fact.status === "in_progress" ? "in_progress" : "pending";
      reason = fact.recoveryQueuedAt ? "chapter recovery has been queued after the last blocked quality gate" : "chapter task status is newer than the last quality gate";
    } else if (fact.qualityGate?.status === "blocked") {
      nextStatus = "blocked";
      reason = fact.qualityGate.reason || "quality gate blocked; queued for recovery";
    } else if (fact.status === "blocked") {
      nextStatus = "blocked";
      reason = "chapter artifact exists without a passing quality gate";
    }
    if (fact.qualityGate) {
      task.qualityGate = {
        status: fact.qualityGate.status,
        score: Number(fact.qualityGate.score || 0),
        attempts: Number(fact.qualityGate.attempts || 0),
        reason: fact.qualityGate.reason || "",
        wordCount: fact.qualityGate.wordCount,
        targetWords: fact.qualityGate.targetWords,
        updatedAt: fact.qualityGate.updatedAt || fact.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    if (fact.recoveryQueuedAt && taskInstructionIsNewer) {
      task.recoveryQueuedAt = fact.recoveryQueuedAt;
    }
    if (fact.contentQuality) {
      task.contentQuality = {
        status: fact.contentQuality.status,
        reason: fact.contentQuality.reason,
        wordCount: fact.contentQuality.wordCount,
        targetWords: fact.contentQuality.targetWords,
        minimumWords: fact.contentQuality.minimumWords
      };
    }
    if (fact.status === "pending" && fact.finalPath && fact.contentQuality?.status === "quarantined" && previousStatus === "complete") {
      nextStatus = "pending";
      reason = fact.contentQuality.reason || "final artifact is quarantined by deterministic checks";
    }
    if (previousStatus !== nextStatus) {
      task.status = nextStatus;
      changed.push({
        chapterNumber: task.chapterNumber,
        from: previousStatus,
        to: nextStatus,
        reason
      });
    }
  }
  if (changed.length > 0) {
    state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length;
    const hasInProgress = state.plan.chapterTasks.some((task) => task.status === "in_progress");
    const hasPending = state.plan.chapterTasks.some((task) => task.status === "pending");
    const hasBlocked = state.plan.chapterTasks.some((task) => task.status === "blocked");
    state.runtime.stage = hasBlocked ? "reviewing" : hasInProgress || hasPending ? "drafting" : "complete";
    state.runtime.statusMessage = hasInProgress ? "Chapter production is currently running; state has been synchronized from database facts." : `Synchronized ${changed.length} chapter task(s) from database facts.`;
    stampRuntimeProgress(
      state,
      hasInProgress ? "synced_chapter_facts_in_progress" : "synced_chapter_facts"
    );
  }
  return changed;
}
async function resetChapterQueueFrom(state, startChapterNumber, reason, pipelineOptions) {
  const resetChapters = [];
  for (const task of state.plan.chapterTasks) {
    if (task.chapterNumber < startChapterNumber) {
      continue;
    }
    if (task.status === "pending" && !task.qualityGate && !task.contentQuality) {
      continue;
    }
    task.status = "pending";
    task.recoveryAttempts = 0;
    task.recoveryBlocked = false;
    task.recoveryQueuedAt = (/* @__PURE__ */ new Date()).toISOString();
    delete task.qualityGate;
    delete task.contentQuality;
    resetChapters.push(task.chapterNumber);
  }
  if (resetChapters.length === 0) {
    return [];
  }
  state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = `\u7AE0\u8282\u8FDE\u7EED\u6027\u68C0\u67E5\u5931\u8D25\uFF1A\u7B2C ${startChapterNumber} \u7AE0\u8D77\u5DF2\u91CD\u7F6E\u4E3A\u5F85\u91CD\u5199\u3002${reason}`;
  stampRuntimeProgress(state, `chapter_queue_reset_from:${startChapterNumber}`);
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_QUEUE_RESET", {
    resetChapters,
    reason,
    startChapterNumber
  });
  return resetChapters;
}
async function enforceSequentialChapterIntegrity(state, pipelineOptions) {
  for (const task of state.plan.chapterTasks) {
    if (task.status !== "complete") {
      return [];
    }
    if (task.qualityGate?.status !== "passed" || task.contentQuality?.status === "quarantined") {
      const reason = task.contentQuality?.reason || task.qualityGate?.reason || "\u7AE0\u8282\u7F3A\u5C11\u53EF\u4FE1\u901A\u8FC7\u95E8\u7981\u3002";
      return resetChapterQueueFrom(state, task.chapterNumber, reason, pipelineOptions);
    }
  }
  return [];
}
async function recoverIncompleteInProgressChapterTasks(paths, state, pipelineOptions) {
  const recovered = [];
  const facts = pipelineOptions.factoryRootDir && pipelineOptions.projectId ? await withFactoryDb(pipelineOptions.factoryRootDir, async (db) => db.getChapterFacts(pipelineOptions.projectId)).catch(() => []) : [];
  const factsByChapter = new Map(facts.map((fact) => [fact.chapterNumber, fact]));
  for (const task of state.plan.chapterTasks) {
    if (task.status !== "in_progress") {
      continue;
    }
    const fact = factsByChapter.get(task.chapterNumber);
    if (fact?.status === "in_progress") {
      continue;
    }
    const chapterId = `chapter-${String(task.chapterNumber).padStart(3, "0")}`;
    const finalPath = import_node_path8.default.join(paths.chaptersDir, `${chapterId}.final.md`);
    try {
      await import_promises6.default.access(finalPath);
      if (fact?.status === "complete") {
        task.status = "complete";
        task.recoveryBlocked = false;
      } else {
        task.status = "blocked";
        task.recoveryAttempts = (task.recoveryAttempts || 0) + 1;
        recovered.push(task.chapterNumber);
      }
    } catch {
      task.status = "pending";
      task.recoveryAttempts = (task.recoveryAttempts || 0) + 1;
      recovered.push(task.chapterNumber);
    }
  }
  if (recovered.length > 0) {
    state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length;
    stampRuntimeProgress(state, "recovered_in_progress_tasks");
    await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASKS_RECOVERED", {
      chapters: recovered,
      reason: "in_progress_without_final_artifact"
    });
  }
  return recovered;
}
async function reconcileChapterTaskStatuses(state, pipelineOptions) {
  const reconciled = [];
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    const dbReconciled = await withFactoryDb(
      pipelineOptions.factoryRootDir,
      async (db) => applyChapterFactsToState(state, db.getChapterFacts(pipelineOptions.projectId))
    ).catch(() => []);
    reconciled.push(...dbReconciled);
  }
  for (const task of state.plan.chapterTasks) {
    const qualityGate = task.qualityGate;
    if (task.status === "complete" && qualityGate && qualityGate.status === "blocked") {
      reconciled.push({
        chapterNumber: task.chapterNumber,
        from: "complete",
        to: "blocked",
        reason: qualityGate.reason || "quality gate did not pass"
      });
      task.status = "blocked";
    }
  }
  if (reconciled.length > 0) {
    state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length;
    stampRuntimeProgress(state, "reconciled_blocked_quality_gates");
    await recordWorkflowEvent(pipelineOptions, "CHAPTER_STATUS_RECONCILED", { chapters: reconciled });
  }
  const resetChapters = await enforceSequentialChapterIntegrity(state, pipelineOptions);
  if (resetChapters.length > 0) {
    reconciled.push(...resetChapters.map((chapterNumber) => ({
      chapterNumber,
      from: "complete",
      to: "pending",
      reason: "sequential_integrity_reset"
    })));
  }
  return reconciled;
}
function createSettingFreeze(state, context) {
  const consensusHighlights = extractSectionBullets(context.consensus, "Latest discussion summary", 4);
  const protagonistHighlights = extractSectionBullets(context.protagonist, "Discussion updates", 4);
  const styleHighlights = extractSectionBullets(context.style, "Discussion-driven adjustments", 3);
  return [
    "# Setting Freeze",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    "",
    "Discussion-backed consensus:",
    ...consensusHighlights.length > 0 ? consensusHighlights : ["- No discussion summary captured yet."],
    "",
    "Protagonist commitments:",
    ...protagonistHighlights.length > 0 ? protagonistHighlights : ["- Protagonist notes are still sparse."],
    "",
    "Style commitments:",
    ...styleHighlights.length > 0 ? styleHighlights : ["- Style adjustments are still sparse."],
    "",
    "Locked discussion goals:",
    ...state.reactSetup.discussionGoals.map((goal) => `- ${goal}`),
    "",
    "Open questions to resolve with the user before full drafting:",
    ...state.reactSetup.unansweredQuestions.map((question) => `- ${question}`)
  ].join("\n");
}
async function advanceAutonomousProject(rootDir, options = {}) {
  const pipelineOptions = { envRootDir: rootDir, ...options };
  throwIfStopped(pipelineOptions.signal);
  const state = await loadAutonomousState(rootDir);
  const paths = getWorkspacePaths(rootDir);
  const recoveredChapters = await recoverIncompleteInProgressChapterTasks(paths, state, pipelineOptions);
  const reconciledChapters = await reconcileChapterTaskStatuses(state, pipelineOptions);
  if (recoveredChapters.length > 0 && state.runtime.stage === "complete") {
    state.runtime.stage = "drafting";
    state.runtime.statusMessage = `Recovered incomplete chapter task(s): ${recoveredChapters.join(", ")}. Drafting will resume.`;
    stampRuntimeProgress(state, "recovered_incomplete_chapters");
  }
  if (reconciledChapters.length > 0) {
    const hasBlocked = state.plan.chapterTasks.some((task) => task.status === "blocked");
    const hasPending = state.plan.chapterTasks.some((task) => task.status === "pending");
    state.runtime.stage = hasBlocked ? "reviewing" : hasPending ? "drafting" : state.runtime.stage;
    state.runtime.statusMessage = hasBlocked ? `Reconciled ${reconciledChapters.length} chapter task(s) whose quality gate had not passed. Review blocked chapters before drafting can continue.` : `Reconciled ${reconciledChapters.length} chapter task(s) whose quality gate had not passed. Drafting will resume from the first pending chapter.`;
    stampRuntimeProgress(state, "reconciled_chapter_facts");
    await saveAutonomousState(rootDir, state);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    }
    return state;
  }
  const context = {
    consensus: await readOptionalText2(paths.consensusPath),
    protagonist: await readOptionalText2(paths.protagonistPath),
    style: await readOptionalText2(paths.styleProfilePath)
  };
  if (state.runtime.stage === "worldbuilding_dialogue") {
    throwIfStopped(pipelineOptions.signal);
    await writeProductionWritingResourceArtifacts(rootDir, paths, state, pipelineOptions);
    await import_promises6.default.writeFile(paths.settingFreezePath, `${createSettingFreeze(state, context)}
`);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await withFactoryDb(pipelineOptions.factoryRootDir, async (db) => {
        db.recordArtifact({
          projectId: pipelineOptions.projectId,
          kind: "plan",
          path: ".ai-novel/plans/setting-freeze.md",
          status: "completed",
          metadata: { production: true, stage: state.runtime.stage }
        });
      }).catch(() => void 0);
    }
    state.runtime.stage = "setting_review";
    state.runtime.statusMessage = "Setting freeze drafted. Review the frozen world assumptions before outlining.";
    stampRuntimeProgress(state, "setting_freeze_generated");
    await saveAutonomousState(rootDir, state);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    }
    return state;
  }
  if (state.runtime.stage === "setting_review") {
    throwIfStopped(pipelineOptions.signal);
    await writeProductionMasterOutline(rootDir, paths, state, context, pipelineOptions);
    state.runtime.stage = "master_planning";
    state.runtime.statusMessage = "Production master outline generated. Next step is to expand detailed chapter blueprints.";
    stampRuntimeProgress(state, "master_outline_generated");
    await saveAutonomousState(rootDir, state);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    }
    return state;
  }
  if (state.runtime.stage === "master_planning") {
    await writeAllDetailedChapterBlueprints(rootDir, paths, state, context, pipelineOptions);
    state.runtime.stage = "drafting";
    state.runtime.statusMessage = "Detailed chapter blueprints generated for the full book. Drafting has started from the queued chapter tasks.";
    stampRuntimeProgress(state, "chapter_blueprints_generated");
    await saveAutonomousState(rootDir, state);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    }
    return state;
  }
  if (state.runtime.stage === "reviewing") {
    const blockedTask = state.plan.chapterTasks.find((task) => task.status === "blocked");
    if (blockedTask) {
      return queueChapterRecovery(rootDir, state, blockedTask, pipelineOptions, {
        reason: "reviewing_blocked_chapter"
      });
    }
    state.runtime.stage = state.plan.pendingChapters > 0 ? "drafting" : "complete";
    state.runtime.statusMessage = state.runtime.stage === "complete" ? "All chapter drafts have been generated." : "Reviewing stage cleared; returning to queued drafting tasks.";
    stampRuntimeProgress(
      state,
      state.runtime.stage === "complete" ? "workflow_complete" : "reviewing_cleared"
    );
    await saveAutonomousState(rootDir, state);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    }
    return state;
  }
  if (state.runtime.stage === "chapter_task_generation" || state.runtime.stage === "drafting") {
    const inProgressTask = state.plan.chapterTasks.find((task) => task.status === "in_progress");
    if (inProgressTask) {
      state.runtime.stage = "drafting";
      state.runtime.statusMessage = `Chapter ${inProgressTask.chapterNumber} is still in progress. Waiting for its final artifact and quality gate before starting another chapter.`;
      stampRuntimeProgress(state, `chapter_waiting:${inProgressTask.chapterNumber}`);
      await saveAutonomousState(rootDir, state);
      if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
        await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
      }
      return state;
    }
    const recoverableBlockedTask = state.plan.chapterTasks.find((task) => task.status === "blocked" && !task.recoveryBlocked);
    if (recoverableBlockedTask) {
      const recovered = await queueChapterRecovery(rootDir, state, recoverableBlockedTask, pipelineOptions, {
        reason: "oldest_blocked_chapter_takes_priority"
      });
      if (recovered.runtime.stage === "reviewing" || recovered.plan.chapterTasks.some((task) => task.status === "blocked" && task.recoveryBlocked)) {
        return recovered;
      }
    }
    const nextTask = state.plan.chapterTasks.find((task) => task.status === "pending");
    if (!nextTask) {
      state.runtime.stage = "complete";
      state.runtime.statusMessage = "All chapter drafts have been generated.";
      state.plan.pendingChapters = 0;
      stampRuntimeProgress(state, "workflow_complete");
      await saveAutonomousState(rootDir, state);
      return state;
    }
    return (await produceChapterTask(rootDir, paths, state, nextTask, pipelineOptions)).state;
  }
  state.runtime.statusMessage = `No advance action is defined for stage ${state.runtime.stage}.`;
  stampRuntimeProgress(state, `noop:${state.runtime.stage}`);
  await saveAutonomousState(rootDir, state);
  return state;
}

// src/discussion.ts
var import_promises7 = __toESM(require("fs/promises"), 1);
var import_node_path9 = __toESM(require("path"), 1);

// src/context-budget.ts
var CONTEXT_BUDGET = {
  // 各类 Agent 的总上下文上限
  independent_total: 8e3,
  // World Architect / Author / Prose Stylist（独立视角，不累积他人发言）
  reviewer_total: 1e4,
  // Editor / Reviewer（需要看前面专家的核心意见）
  synthesis_total: 16e3,
  // Showrunner closing_synthesis（需要综合所有专家输出）
  opening_total: 8e3,
  // Showrunner opening_brief（需要看上一次讨论结论）
  // 各层独立上限
  story_core: 2e3,
  // Layer 1：小说核心（标题/主角/阶段/讨论目标）
  role_specific: 4e3,
  // Layer 3：角色专属内容（暂留给调用方控制）
  history: {
    independent: 0,
    // 独立视角专家：不传历史（避免锚定效应）
    reviewer: 1e3,
    // Editor/Reviewer：只看 World Architect + Author 的核心发言
    synthesis: 3e3,
    // Showrunner 综合：所有专家发言的精华摘要
    opening: 500
    // Showrunner 开场：上一轮最终结论摘要
  }
};
var NOISE_PATTERNS = [
  /\[LLM\s+REQUEST/i,
  /\[LLM\s+STREAM/i,
  /请求已送达\s*LLM/,
  /正在持续返回内容/,
  /LLM\s+已开始响应/,
  /LLM\s+返回完成/,
  /Status:\s*(in_progress|running|completed|error)/i,
  /step_\w+_(started|completed|streaming)/,
  /知识库召回/,
  /score:\s*[\d.]+/,
  /phase:\s*\w+/,
  /statusText:/,
  /statusDetail:/,
  /Agent.*消息会在模型返回/,
  /请求已提交给\s*LLM/,
  /等待模型开始响应/,
  /返回内容会持续合并/
];
function filterCreativeHistory(transcript, maxChars) {
  if (!transcript.trim() || maxChars <= 0) return "";
  const filtered = transcript.split("\n").filter((line) => !NOISE_PATTERNS.some((p) => p.test(line))).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!filtered) return "";
  if (filtered.length <= maxChars) return filtered;
  return "\u2026[\u5386\u53F2\u5DF2\u622A\u65AD\uFF0C\u4FDD\u7559\u6700\u65B0\u5185\u5BB9]\n" + filtered.slice(filtered.length - maxChars);
}
function classifyAgent(agentId, discussionStage) {
  if (agentId === "showrunner") {
    return discussionStage === "closing_synthesis" ? "synthesis" : "opening";
  }
  if (agentId === "editor" || agentId === "reviewer") return "reviewer";
  return "independent";
}
function buildHistoryForAgent(agentId, discussionStage, currentReplies, priorTranscript) {
  const cls = classifyAgent(agentId, discussionStage);
  const limit = CONTEXT_BUDGET.history[cls];
  if (limit <= 0) return "";
  if (cls === "opening") {
    return filterCreativeHistory(priorTranscript, limit);
  }
  if (cls === "reviewer") {
    const relevant = currentReplies.filter((r) => r.role === "World Architect" || r.role === "Author").map((r) => `### ${r.role}
${r.content.slice(0, 450)}`).join("\n\n");
    return relevant.slice(0, limit);
  }
  if (cls === "synthesis") {
    const all = currentReplies.filter((r) => r.role !== "Showrunner").map((r) => `### ${r.role}
${r.content.slice(0, 500)}`).join("\n\n");
    return all.slice(0, limit);
  }
  return "";
}
function buildStoryCoreContext(state, sanitizedConsensus, target, userMessage) {
  const bullets = sanitizedConsensus.split("\n").filter((line) => line.trim().startsWith("-")).slice(0, 8).join("\n");
  const parts = [
    `\u9879\u76EE\uFF1A${state.project.title}`,
    `\u6838\u5FC3\u521B\u610F\uFF1A${state.project.idea}`,
    `\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1A${state.runtime.stage}`,
    `\u8BA1\u5212\u7AE0\u8282\u6570\uFF1A${state.plan.totalChapters}\uFF0C\u6BCF\u7AE0\u76EE\u6807\u5B57\u6570\uFF1A${state.plan.chapterWordTarget}`,
    "",
    `\u672C\u8F6E\u8BA8\u8BBA\u76EE\u6807\uFF1A${target.label}`,
    `\u5199\u56DE\u8D44\u4EA7\u8DEF\u5F84\uFF1A${target.assetPath}`,
    target.instruction ? `\u76EE\u6807\u6307\u4EE4\uFF1A${target.instruction}` : "",
    "",
    `\u7528\u6237\u5F53\u524D\u6D88\u606F\uFF1A${userMessage}`,
    "",
    bullets ? `\u6838\u5FC3\u5171\u8BC6\u8981\u70B9\uFF08\u6700\u591A 8 \u6761\uFF09\uFF1A
${bullets}` : ""
  ];
  const text = parts.filter(Boolean).join("\n").trim();
  if (text.length <= CONTEXT_BUDGET.story_core) return text;
  return text.slice(0, CONTEXT_BUDGET.story_core) + "\n\u2026[\u6838\u5FC3\u5C42\u5DF2\u622A\u65AD]";
}

// src/discussion.ts
var AGENT_FLOW = [
  { id: "showrunner", label: "Showrunner" },
  { id: "world-architect", label: "World Architect" },
  { id: "author", label: "Author" },
  { id: "editor", label: "Editor" },
  { id: "reviewer", label: "Reviewer" },
  { id: "prose-stylist", label: "Prose Stylist" }
];
var SPECIALIST_FLOW = AGENT_FLOW.filter((agent) => agent.id !== "showrunner");
function workspacePath2(rootDir, ...parts) {
  return import_node_path9.default.join(rootDir, ".ai-novel", ...parts);
}
async function readText(filePath) {
  return import_promises7.default.readFile(filePath, "utf8");
}
async function readOptionalText3(filePath) {
  try {
    return await readText(filePath);
  } catch {
    return "";
  }
}
async function readCharacterDossiers2(filePath) {
  try {
    const parsed = JSON.parse(await readText(filePath));
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string") : [];
  } catch {
    return [];
  }
}
async function writeJsonFileAtomic3(filePath, value) {
  await import_promises7.default.mkdir(import_node_path9.default.dirname(filePath), { recursive: true });
  const tempPath = import_node_path9.default.join(import_node_path9.default.dirname(filePath), `.${import_node_path9.default.basename(filePath)}.${Date.now()}.tmp`);
  await import_promises7.default.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`);
  await import_promises7.default.rename(tempPath, filePath);
}
function appendSection(current, heading, bullet) {
  if (current.includes(heading)) {
    return `${current.trimEnd()}
- ${bullet}
`;
  }
  return `${current.trimEnd()}

${heading}
- ${bullet}
`;
}
function appendUnique2(values = [], next, limit = 10) {
  const normalized = next.trim();
  if (!normalized) return values.slice(0, limit);
  return [...values.filter((value) => value !== normalized), normalized].slice(-limit);
}
function compactList3(values = [], limit = 3) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit).join("; ") || "pending";
}
function formatCharacterDossiersMarkdown2(dossiers) {
  return [
    "# Character Dossiers",
    "",
    "This file is generated from the structured production character dossier state.",
    "",
    ...dossiers.slice(0, 12).map((dossier) => [
      `## ${dossier.canonicalName}`,
      `- id: ${dossier.id}`,
      `- role: ${dossier.role}`,
      `- aliases: ${dossier.aliases.join(", ") || "none"}`,
      `- identity and role: ${dossier.identityAndRole}`,
      `- core desire: ${dossier.coreDesire}`,
      `- fear or wound: ${dossier.fearOrWound}`,
      `- habits: ${compactList3(dossier.behaviorHabits)}`,
      `- speech: ${compactList3(dossier.speechMarkers)}`,
      `- relationship state: ${dossier.relationshipState}`,
      `- current chapter delta: ${dossier.currentChapterDelta}`,
      `- latest evidence: ${dossier.evidence.slice(-2).join(" | ") || "none"}`
    ].join("\n"))
  ].join("\n\n");
}
function summarizeDossiersForContext(dossiers = [], limit = 3) {
  const selected = [
    ...dossiers.filter((dossier) => dossier.role === "protagonist"),
    ...dossiers.filter((dossier) => dossier.role !== "protagonist")
  ].slice(0, limit);
  return selected.map((dossier) => [
    `- ${dossier.id} (${dossier.role}) name=${dossier.canonicalName}`,
    `  desire=${clipText2(dossier.coreDesire, 90)}; wound=${clipText2(dossier.fearOrWound, 90)}`,
    `  habit=${compactList3(dossier.behaviorHabits, 2)}; speech=${compactList3(dossier.speechMarkers, 2)}`,
    `  relation=${clipText2(dossier.relationshipState, 120)}`,
    `  delta=${clipText2(dossier.currentChapterDelta, 120)}`
  ].join("\n")).join("\n");
}
function updateCharacterDossiersFromDiscussion(input) {
  if (input.targetKind !== "character" && !/主角|角色|人物|性格|character|protagonist/i.test(input.message)) {
    return [];
  }
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const evidence = `discussion ${input.runId}: ${input.message}`.slice(0, 240);
  const continuityNote = `discussion ${input.runId}: ${input.summary.replace(/\s+/g, " ").slice(0, 220)}`;
  return input.dossiers.map((dossier) => {
    const isProtagonist = dossier.role === "protagonist" || dossier.id === "protagonist";
    if (!isProtagonist) return dossier;
    return {
      ...dossier,
      currentChapterDelta: `discussion: ${input.message}`,
      continuityNotes: appendUnique2(dossier.continuityNotes, continuityNote),
      evidence: appendUnique2(dossier.evidence, evidence),
      updatedAt
    };
  });
}
function sanitizeConsensusForDiscussion(consensus) {
  const blockedPatterns = [
    /option b/i,
    /what is your choice/i,
    /i am standing by/i,
    /type your ideas/i,
    /type "option b"/i,
    /the fast track/i,
    /the custom path/i,
    /cannot move to/i,
    /reply with/i,
    /system status/i,
    /current task/i,
    /word count/i,
    /plot progress/i,
    /character update/i,
    /draft chapter/i,
    /the creative process is now fully autonomous/i,
    /chapter\s+\d+/i,
    /第\s*\d+\s*章/u
  ];
  const sanitizedLines = consensus.split("\n").filter((line) => !blockedPatterns.some((pattern) => pattern.test(line)));
  return sanitizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function extractSummaryBullets(summary, limit = 8) {
  const bullets = summary.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("-")).slice(0, limit);
  if (bullets.length > 0) {
    return bullets;
  }
  const meaningful = summary.split("\n").map((line) => line.trim()).filter(Boolean).filter((line) => !line.startsWith("###")).slice(0, 4);
  return meaningful.map((line) => `- ${line}`);
}
function buildCompactConsensus(state, latestSummary) {
  return [
    "# Global Consensus",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    `Current workflow stage: ${state.runtime.stage}`,
    "",
    "Confirmed truths:",
    "- \u9ED8\u8BA4\u8F93\u51FA\u8BED\u8A00\u4E3A\u7B80\u4F53\u4E2D\u6587\u3002",
    "- \u6240\u6709\u8BA8\u8BBA\u5FC5\u987B\u4E0E\u5F53\u524D workflow stage \u4FDD\u6301\u540C\u6B65\u3002",
    "- \u5728\u672A\u8FDB\u5165 drafting \u524D\uFF0C\u4E0D\u5141\u8BB8\u4F2A\u88C5\u6210\u5DF2\u7ECF\u5728\u5199\u5177\u4F53\u7AE0\u8282\u6B63\u6587\u3002",
    "",
    "Latest discussion summary:",
    ...extractSummaryBullets(latestSummary),
    "",
    "Current open areas:",
    ...state.reactSetup.unansweredQuestions.map((question) => `- ${question}`)
  ].join("\n");
}
function safeArtifactName(value) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "discussion";
}
function messagePart2(messageId, index, type, data, createdAt) {
  return {
    id: `${messageId}:part:${index}`,
    messageId,
    index,
    type,
    data,
    createdAt
  };
}
function discussionMessageParts(messageId, input) {
  return [
    messagePart2(messageId, 0, "markdown", { text: input.content }, input.createdAt),
    messagePart2(messageId, 1, "json", {
      role: input.role,
      discussionStage: input.discussionStage,
      target: input.target,
      currentStage: input.currentStage,
      source: "discussion_agent_turn"
    }, input.createdAt)
  ];
}
async function writeDiscussionConsensusArchive(rootDir, input) {
  const consensusDir = workspacePath2(rootDir, "consensus");
  const fileName = `discussion-${safeArtifactName(input.runId)}.md`;
  const archivePath = import_node_path9.default.join(consensusDir, fileName);
  await import_promises7.default.mkdir(consensusDir, { recursive: true });
  const content = [
    "# Discussion Consensus Archive",
    "",
    `Run: ${input.runId}`,
    `Created at: ${input.startedAt}`,
    `Project: ${input.state.project.title}`,
    `Workflow stage: ${input.state.runtime.stage}`,
    `Target: ${input.target.label}`,
    `Asset: ${input.target.assetPath}`,
    `Transcript: ${input.transcriptRelativePath}`,
    `Context packet: ${input.contextPacketRelativePath}`,
    "",
    "## User Intent",
    "",
    input.message.trim(),
    "",
    "## Showrunner Final Consensus",
    "",
    input.summary.trim(),
    "",
    "## Agent Discussion Outputs",
    "",
    ...input.replies.flatMap((reply, index) => [
      `### ${index + 1}. ${reply.role}`,
      "",
      reply.content.trim(),
      ""
    ])
  ].join("\n").replace(/\n{4,}/g, "\n\n\n");
  await import_promises7.default.writeFile(archivePath, `${content.trim()}
`);
  return {
    absolutePath: archivePath,
    relativePath: `.ai-novel/consensus/${fileName}`
  };
}
function stageInstructionFor(state, target) {
  if (state.runtime.stage === "worldbuilding_dialogue") {
    return `\u5F53\u524D\u4ECD\u5728\u4E16\u754C\u89C2/\u8BBE\u5B9A\u8BA8\u8BBA\u9636\u6BB5\u3002\u5141\u8BB8\u8BA8\u8BBA ${target.label}\uFF0C\u4F46\u4E0D\u5141\u8BB8\u58F0\u79F0\u5DF2\u7ECF\u8FDB\u5165\u7AE0\u8282\u6B63\u6587\u5199\u4F5C\u3001\u5177\u4F53\u7AE0\u6B21\u751F\u4EA7\u3001\u540E\u7EED\u5F27\u7EBF\u84DD\u56FE\u6216\u5168\u81EA\u52A8\u8FDE\u7EED\u6210\u7A3F\u3002\u53EA\u80FD\u8BF4\u201C\u5EFA\u8BAE\u4E0B\u4E00\u6B65\u63A8\u8FDB\u201D\uFF0C\u4E0D\u80FD\u8BF4\u201C\u5DF2\u8FDB\u5165\u4E0B\u4E00\u9636\u6BB5\u201D\u3002`;
  }
  if (state.runtime.stage === "setting_review") {
    return "\u5F53\u524D\u5728\u8BBE\u5B9A\u51BB\u7ED3\u9636\u6BB5\u3002\u5141\u8BB8\u6574\u7406\u548C\u6536\u655B\u8BBE\u5B9A\uFF0C\u4E0D\u5141\u8BB8\u76F4\u63A5\u5199\u6B63\u6587\uFF0C\u4E5F\u4E0D\u5141\u8BB8\u5BA3\u79F0\u5DF2\u8FDB\u5165\u4E3B\u7EBF\u89C4\u5212\u3001\u7AE0\u8282\u84DD\u56FE\u6216\u67D0\u5F27\u603B\u4F53\u89C4\u5212\u3002\u53EA\u80FD\u63D0\u51FA\u4E0B\u4E00\u6B65\u5EFA\u8BAE\uFF0C\u4E0D\u80FD\u66FF\u72B6\u6001\u673A\u5BA3\u5E03\u9636\u6BB5\u8DF3\u8F6C\u3002";
  }
  if (state.runtime.stage === "master_planning" || state.runtime.stage === "chapter_task_generation") {
    return "\u5F53\u524D\u5728\u89C4\u5212\u9636\u6BB5\u3002\u5141\u8BB8\u8BA8\u8BBA\u4E3B\u7EBF\u3001\u5377\u7EB2\u3001\u7AE0\u8282\u84DD\u56FE\uFF0C\u4E0D\u5141\u8BB8\u4F2A\u88C5\u6210\u5DF2\u7ECF\u5B8C\u6210\u6B63\u6587\u5199\u4F5C\uFF1B\u4E5F\u4E0D\u80FD\u5BA3\u79F0\u67D0\u9636\u6BB5\u6216\u67D0\u5F27\u5DF2\u7ECF\u5B8C\u6210\uFF0C\u9664\u975E\u7CFB\u7EDF\u72B6\u6001\u548C\u771F\u5B9E\u4EA7\u7269\u5DF2\u7ECF\u5199\u56DE\u3002";
  }
  if (state.runtime.stage === "drafting") {
    return "\u5F53\u524D\u5DF2\u8FDB\u5165 drafting\u3002\u53EF\u4EE5\u8BA8\u8BBA\u6B63\u6587\u63A8\u8FDB\u3001\u6DA6\u8272\u4E0E\u5BA1\u7A3F\uFF0C\u4F46\u4ECD\u9700\u548C\u771F\u5B9E\u7AE0\u8282\u4EFB\u52A1\u4FDD\u6301\u4E00\u81F4\u3002";
  }
  return "\u6240\u6709\u8F93\u51FA\u90FD\u5FC5\u987B\u4E0E\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\u4E25\u683C\u4FDD\u6301\u4E00\u81F4\u3002";
}
function detectDiscussionStageViolation(state, target, text) {
  const reasons = [];
  const currentStage = state.runtime.stage;
  const combined = text.trim();
  const positiveClaimText = combined.split("\n").map((line) => line.trim()).filter(Boolean).filter((line) => !/(不允许|不能|不得|不要|不可|如果|风险|留到|等待|必须等待|只能|建议下一步|准备进入|可进入|避免|防止|除非|guardrail|risk)/i.test(line)).join("\n");
  if (!combined || currentStage === "drafting") {
    return { blocked: false, reason: "" };
  }
  const claimsCurrentDrafting = [
    /(当前阶段|当前状态)\s*[:：]?\s*(drafting|正文写作|writing|写作阶段)/i,
    /(当前已|已进入|已经进入|正式进入|现在进入)\s*[:：]?\s*(drafting|正文写作|writing|写作阶段)/i,
    /(阶段切换确认|设定收敛已完成|设定冻结已完成|规划已完成).{0,40}(进入|切换到|转入)\s*(drafting|正文写作|writing)\s*阶段?/i
  ].some((pattern) => pattern.test(positiveClaimText));
  const claimsProducedDraft = /(本轮产出|已产出|产出|完成|生成)\s*[:：]?\s*第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,20}(初稿|草稿|正文)|第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,12}(初稿|草稿|正文).{0,20}(已完成|完成|生成|产出)/u.test(positiveClaimText);
  const hasChapterBodyHeading = /(^|\n)\s*(#{1,6}\s*)?第\s*[一二三四五六七八九十百千万\d]+\s*章\s*[·:：-]\s*\S{1,40}(\n|$)/u.test(positiveClaimText);
  const hasDraftBodyLabel = /(^|\n)\s*(正文|草稿正文|draft body)\s*[:：]\s*\S+/iu.test(positiveClaimText);
  const hasRuntimeStageCorrection = /STAGE_GUARD_CORRECTION:\s*true/i.test(combined);
  if (hasRuntimeStageCorrection) {
    reasons.push("\u6A21\u578B\u539F\u59CB\u8F93\u51FA\u89E6\u53D1\u8FD0\u884C\u65F6\u9636\u6BB5\u7EA0\u504F\uFF0C\u672C\u8F6E\u4E0D\u80FD\u5199\u5165\u751F\u4EA7\u5171\u8BC6\u3002");
  }
  if (claimsCurrentDrafting) {
    reasons.push(`\u5F53\u524D\u7CFB\u7EDF\u9636\u6BB5\u662F ${currentStage}\uFF0C\u4F46\u8BA8\u8BBA\u8F93\u51FA\u5BA3\u79F0\u5DF2\u7ECF\u8FDB\u5165 drafting/\u6B63\u6587\u5199\u4F5C\u3002`);
  }
  if (claimsProducedDraft) {
    reasons.push("\u8BA8\u8BBA\u8F93\u51FA\u5BA3\u79F0\u5DF2\u7ECF\u4EA7\u51FA\u5177\u4F53\u7AE0\u8282\u521D\u7A3F\uFF0C\u4F46\u751F\u4EA7\u7AE0\u8282\u53EA\u80FD\u7531 drafting \u9636\u6BB5\u7684\u7AE0\u8282\u6D41\u6C34\u7EBF\u5199\u5165\u3002");
  }
  if (hasChapterBodyHeading || hasDraftBodyLabel) {
    reasons.push("\u8BA8\u8BBA\u8F93\u51FA\u51FA\u73B0\u7AE0\u8282\u6B63\u6587\u6807\u9898\u6216\u6B63\u6587\u5757\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u8BBE\u5B9A/\u89C4\u5212\u9636\u6BB5\u7684\u6B63\u5F0F\u4EA7\u7269\u5199\u56DE\u3002");
  }
  if (currentStage === "setting_review" && /(当前已|已进入|进入|已经完成).{0,20}(master_planning|主线规划|章节蓝图|chapter_task_generation|总体规划|弧线蓝图)/i.test(positiveClaimText)) {
    reasons.push("\u5F53\u524D\u4ECD\u662F\u8BBE\u5B9A\u51BB\u7ED3\u9636\u6BB5\uFF0C\u4F46\u8BA8\u8BBA\u8F93\u51FA\u628A\u4E3B\u7EBF\u89C4\u5212\u6216\u7AE0\u8282\u84DD\u56FE\u63CF\u8FF0\u6210\u65E2\u6210\u72B6\u6001\u3002");
  }
  if (target.kind !== "chapter" && /第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,20}(目标|冲突|场景|开篇|结尾|钩子)/u.test(positiveClaimText)) {
    reasons.push("\u5F53\u524D\u8BA8\u8BBA\u76EE\u6807\u4E0D\u662F\u7AE0\u8282\u84DD\u56FE\uFF0C\u5374\u8F93\u51FA\u4E86\u5177\u4F53\u7AE0\u6B21\u6267\u884C\u5185\u5BB9\u3002");
  }
  return {
    blocked: reasons.length > 0,
    reason: reasons.join("\uFF1B")
  };
}
function buildStageGuardSummary(state, target, reason) {
  return [
    "### \u9636\u6BB5\u5B88\u536B\u62E6\u622A",
    `- \u5F53\u524D\u7CFB\u7EDF\u9636\u6BB5\uFF1A${state.runtime.stage}`,
    `- \u5F53\u524D\u8BA8\u8BBA\u76EE\u6807\uFF1A${target.label}`,
    `- \u5199\u56DE\u8D44\u4EA7\uFF1A${target.assetPath}`,
    `- \u62E6\u622A\u539F\u56E0\uFF1A${reason}`,
    "",
    "### \u5904\u7406\u7ED3\u679C",
    "- \u672C\u8F6E\u8BA8\u8BBA\u539F\u6587\u53EA\u4FDD\u7559\u5728 transcript\uFF0C\u4F5C\u4E3A\u53EF\u5BA1\u8BA1\u8BB0\u5F55\u3002",
    "- \u672C\u8F6E\u5185\u5BB9\u4E0D\u4F1A\u5199\u5165 global consensus\u3001memory \u6216\u751F\u4EA7\u7AE0\u8282\u4EA7\u7269\u3002",
    "- \u6B63\u5F0F\u7AE0\u8282\u5FC5\u987B\u7B49\u5F85\u72B6\u6001\u673A\u8FDB\u5165 drafting\uFF0C\u5E76\u7531\u7AE0\u8282\u6D41\u6C34\u7EBF\u5199\u5165 `.ai-novel/chapters/` \u4E0E DB artifact\u3002",
    "",
    "### Next Step",
    "- \u56DE\u5230\u5F53\u524D\u9636\u6BB5\u7EE7\u7EED\u6536\u655B\u8BBE\u5B9A/\u89C4\u5212\uFF0C\u6216\u901A\u8FC7\u5DE5\u4F5C\u6D41\u63A8\u8FDB\u751F\u6210\u4E3B\u7EBF\u89C4\u5212\u548C\u7AE0\u8282\u84DD\u56FE\u3002"
  ].join("\n");
}
function buildAutonomousContext(state, target) {
  const dossierBrief = summarizeDossiersForContext(state.memory?.characterDossiers || []);
  return [
    "# Autonomous Creation Mode",
    "",
    `Project title: ${state.project.title}`,
    `Core idea seed: ${state.project.idea}`,
    `Current workflow stage: ${state.runtime.stage}`,
    `Scoped target: ${target.label}`,
    `Write-back asset: ${target.assetPath}`,
    "",
    "Structured character dossier snapshot:",
    dossierBrief || "- no structured character dossiers available yet",
    "",
    "Autonomy rules:",
    "- Do not wait for the user to choose paths or options.",
    "- If details are missing, infer strong working assumptions from the title, genre cues, and current target.",
    "- Present assumptions, recommendations, and a converged decision directly.",
    "- The system is expected to take over the creative process and keep moving.",
    "- The canonical workflow state is the runtime stage above. Do not announce a different current stage unless the system snapshot has changed.",
    "- When proposing stage movement, phrase it as a recommendation for the next advance step, not as completed progress.",
    `- Stage guardrail: ${stageInstructionFor(state, target)}`
  ].join("\n");
}
function clipText2(value, maxLength) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(normalized.length - maxLength).trim();
}
function extractRecentTranscript(transcript, blockLimit = 3) {
  const blocks = transcript.split(/^##\s+/m).map((block) => block.trim()).filter(Boolean);
  const userBlockIndexes = [];
  blocks.forEach((block, index) => {
    if (/^User:/m.test(block)) {
      userBlockIndexes.push(index);
    }
  });
  const selected = new Set(userBlockIndexes.slice(-3));
  blocks.forEach((_, index) => {
    if (index >= blocks.length - blockLimit) {
      selected.add(index);
    }
  });
  return [...selected].sort((left, right) => left - right).map((index) => `## ${blocks[index]}`).join("\n\n");
}
function buildContextPacketText(options) {
  const recentTranscript = extractRecentTranscript(options.priorTranscript);
  const consensusBullets = extractSummaryBullets(options.consensus, 8);
  const dossierBrief = summarizeDossiersForContext(options.state.memory?.characterDossiers || []);
  const recalledMemory = options.recalledMemory?.length ? options.recalledMemory.map((item) => `- [${String(item.kind || "memory")}] ${clipText2(String(item.content || ""), 360)} (score: ${Number(item.score || 0)})`) : ["- No database memory recall matched this turn yet."];
  const recalledKnowledge = options.recalledKnowledge?.length ? options.recalledKnowledge.map((item) => {
    const source = item.source && typeof item.source === "object" ? item.source : {};
    return `- [${String(item.chunk_type || "knowledge")}] ${clipText2(String(item.content || ""), 360)} (source: ${String(source.path || "")}, score: ${Number(item.score || 0).toFixed(2)})`;
  }) : ["- No writing knowledge resources matched this turn yet."];
  return [
    "# Current Context Packet",
    "",
    "Context hierarchy:",
    "1. System/developer protocol and role prompts.",
    "2. Original project mission and workflow stage.",
    "3. Global consensus and committed facts.",
    "4. Recent discussion transcript and user interventions.",
    "5. Super Graph checkpoints, assets, and drift constraints.",
    "6. Current user message for this turn.",
    "",
    "Original mission:",
    `- Project: ${options.state.project.title}`,
    `- Idea: ${options.state.project.idea}`,
    `- Target chapters: ${options.state.plan.totalChapters}`,
    `- Chapter word target: ${options.state.plan.chapterWordTarget}`,
    "",
    "Workflow state:",
    `- Stage: ${options.state.runtime.stage}`,
    `- Last action: ${options.state.runtime.lastAction}`,
    `- Last route: ${options.state.runtime.lastRoute}`,
    `- Autopilot running: ${Boolean(options.state.runtime.autopilot?.running)}`,
    "",
    "Current discussion:",
    `- Target: ${options.target.label}`,
    `- Asset: ${options.target.assetPath}`,
    `- User message: ${options.message}`,
    "",
    "Consensus carryover:",
    ...consensusBullets.length > 0 ? consensusBullets : ["- No compact consensus has been recorded yet."],
    "",
    "Structured character dossier carryover:",
    dossierBrief || "- No structured character dossiers have been recorded yet.",
    "",
    "Memory/RAG recall:",
    ...recalledMemory,
    "",
    "Writing knowledge/RAG recall:",
    ...recalledKnowledge,
    "",
    "Recent transcript carryover:",
    recentTranscript || "No previous discussion transcript has been recorded yet."
  ].join("\n");
}
async function writeCurrentContextPacket(rootDir, content) {
  const contextDir = workspacePath2(rootDir, "context");
  const contextPath = import_node_path9.default.join(contextDir, "current-context.md");
  await import_promises7.default.mkdir(contextDir, { recursive: true });
  await import_promises7.default.writeFile(contextPath, `${content.trim()}
`);
  return contextPath;
}
function inferDiscussionTarget(message) {
  const normalized = message.toLowerCase();
  if (normalized.includes("\u7B2C") && normalized.includes("\u7AE0") || normalized.includes("chapter")) {
    return {
      kind: "chapter",
      label: "chapter blueprint discussion",
      assetPath: ".ai-novel/plans/chapter-blueprints/",
      instruction: "Discuss one chapter blueprint only. Do not draft full prose or invent unrelated chapter titles."
    };
  }
  if (normalized.includes("\u4E3B\u89D2") || normalized.includes("\u89D2\u8272") || normalized.includes("character")) {
    return {
      kind: "character",
      label: "character design discussion",
      assetPath: ".ai-novel/memory/characters/core/protagonist.md",
      instruction: "Refine character setup, motivations, or relations only. Do not branch into unrelated world or chapter drafts."
    };
  }
  if (normalized.includes("\u6587\u98CE") || normalized.includes("\u8BED\u8A00") || normalized.includes("\u6DA6\u8272") || normalized.includes("style")) {
    return {
      kind: "style",
      label: "style guide discussion",
      assetPath: ".ai-novel/style/profile.md",
      instruction: "Refine style and voice only. Do not create new plot or chapter content."
    };
  }
  if (normalized.includes("\u60C5\u8282") || normalized.includes("\u5267\u60C5") || normalized.includes("\u4E3B\u7EBF") || normalized.includes("\u4F0F\u7B14") || normalized.includes("\u5927\u7EB2") || normalized.includes("plot")) {
    return {
      kind: "plot",
      label: "plot and outline discussion",
      assetPath: ".ai-novel/plans/master-outline.md",
      instruction: "Refine plot structure, outline beats, or foreshadowing only. Do not draft detached scenes."
    };
  }
  return {
    kind: "worldbuilding",
    label: "worldbuilding discussion",
    assetPath: ".ai-novel/prompts/global-consensus.md",
    instruction: "Refine world rules, factions, and setting truths only. Stay on the same topic until consensus is reached."
  };
}
function knowledgeSourceTypesForDiscussionTarget(target) {
  if (target.kind === "style") {
    return ["vocabulary", "style_guide", "example", "quality_rule"];
  }
  if (target.kind === "chapter") {
    return ["vocabulary", "example", "style_guide", "chapter", "plan", "memory", "consensus", "quality_rule"];
  }
  if (target.kind === "plot") {
    return ["vocabulary", "example", "style_guide", "plan", "memory", "consensus", "quality_rule"];
  }
  if (target.kind === "character") {
    return ["vocabulary", "example", "style_guide", "memory", "consensus", "agent_guide"];
  }
  return ["vocabulary", "example", "style_guide", "quality_rule", "consensus", "agent_guide"];
}
async function runMultiAgentDiscussion(rootDir, message, options = {}) {
  throwIfStopped(options.signal);
  const statePath = workspacePath2(rootDir, "state.json");
  const consensusPath = workspacePath2(rootDir, "prompts", "global-consensus.md");
  const protagonistPath = workspacePath2(rootDir, "memory", "characters", "core", "protagonist.md");
  const characterDossiersPath = workspacePath2(rootDir, "memory", "characters", "dossiers.json");
  const characterDossiersMarkdownPath = workspacePath2(rootDir, "memory", "characters", "dossiers.md");
  const styleProfilePath = workspacePath2(rootDir, "style", "profile.md");
  const discussionDir = workspacePath2(rootDir, "chat");
  const discussionLogPath = import_node_path9.default.join(discussionDir, "discussion-log.md");
  await import_promises7.default.mkdir(discussionDir, { recursive: true });
  const rawConsensus = await readText(consensusPath);
  const state = JSON.parse(await readText(statePath));
  const discussionTarget = inferDiscussionTarget(message);
  const runId = options.runId ?? makeRunId("discussion");
  const factoryDb = options.factoryRootDir && options.projectId ? await FactoryDb.open(options.factoryRootDir) : null;
  const priorTranscript = await readOptionalText3(discussionLogPath);
  const sanitizedConsensus = sanitizeConsensusForDiscussion(rawConsensus);
  const autonomousContext = buildAutonomousContext(state, discussionTarget);
  const recalledMemory = factoryDb && options.projectId ? factoryDb.recallMemory(options.projectId, `${message}
${discussionTarget.label}`, 6, {
    embedding: createLocalTextEmbedding(`${message}
${discussionTarget.label}`)
  }) : [];
  const recalledKnowledge = options.factoryRootDir && options.projectId ? await retrieveKnowledge({
    rootDir: options.factoryRootDir,
    projectId: options.projectId,
    query: `${message}
${discussionTarget.label}
${state.project.idea}`,
    scopes: ["project", "global"],
    sourceTypes: knowledgeSourceTypesForDiscussionTarget(discussionTarget),
    limit: 6,
    runId,
    recordCitation: true
  }).catch(() => []) : [];
  const currentContextPacket = buildContextPacketText({
    state,
    target: discussionTarget,
    message,
    consensus: sanitizedConsensus,
    priorTranscript,
    recalledMemory,
    recalledKnowledge
  });
  const contextPacketPath = await writeCurrentContextPacket(rootDir, currentContextPacket);
  const replies = [];
  const transcriptContext = [
    currentContextPacket,
    `Project: ${state.project.title}`,
    `Idea: ${state.project.idea}`,
    `Target: ${discussionTarget.label} -> ${discussionTarget.assetPath}`,
    `User: ${message}`
  ];
  const storyCoreDossierBrief = summarizeDossiersForContext(state.memory?.characterDossiers || []);
  const transcriptStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (factoryDb && options.projectId) {
    factoryDb.createRun({
      id: runId,
      projectId: options.projectId,
      projectRoot: rootDir,
      parentRunId: options.parentRunId ?? null,
      kind: "discussion",
      status: "running",
      goal: message,
      stage: state.runtime.stage
    });
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "context",
      path: ".ai-novel/context/current-context.md",
      status: "completed",
      metadata: { runId, target: discussionTarget, directorCommandId: options.directorCommandId ?? null }
    });
    factoryDb.recordEvent(options.projectId, runId, "DISCUSSION_STARTED", {
      message,
      target: discussionTarget,
      stage: state.runtime.stage,
      contextPacketPath,
      recalledMemoryCount: recalledMemory.length,
      recalledKnowledgeCount: recalledKnowledge.length,
      directorCommandId: options.directorCommandId ?? null
    });
  }
  await import_promises7.default.appendFile(
    discussionLogPath,
    [
      `## ${transcriptStartedAt}`,
      ...transcriptContext,
      "Status: in_progress",
      ""
    ].join("\n")
  );
  async function runAgentTurn(agent, discussionStage) {
    throwIfStopped(options.signal);
    const turnIndex = replies.length + 1;
    const turnId = `${agent.id}-${turnIndex}`;
    const dbTurnId = makeAgentTurnId(runId, agent.id, turnIndex);
    const messageId = `${dbTurnId}:message`;
    const basePrompt = await readText(workspacePath2(rootDir, "prompts", "agents", `${agent.id}.base.md`));
    const dynamicPrompt = await readText(workspacePath2(rootDir, "prompts", "agents", `${agent.id}.dynamic.md`));
    factoryDb?.recordAgentTurn({
      runId,
      turnId: dbTurnId,
      role: agent.label,
      stage: discussionStage,
      status: "in_progress",
      input: {
        message,
        discussionTarget,
        currentStage: state.runtime.stage,
        priorTranscript: clipText2(priorTranscript, 8e3),
        contextPacketPath
      }
    });
    await options.onStreamEvent?.({
      type: "agent_start",
      messageId,
      turnId,
      role: agent.label,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      phase: "request_sent",
      statusText: "\u8BF7\u6C42\u5DF2\u9001\u8FBE LLM\uFF0C\u7B49\u5F85\u6A21\u578B\u5F00\u59CB\u54CD\u5E94\u3002",
      statusDetail: "\u8FD9\u6761 agent \u6D88\u606F\u4F1A\u5728\u6A21\u578B\u8FD4\u56DE\u5185\u5BB9\u65F6\u7EE7\u7EED\u66F4\u65B0\u3002"
    });
    let reply = "";
    try {
      const storyCoreBase = buildStoryCoreContext(state, sanitizedConsensus, discussionTarget, message);
      const dossierSection = storyCoreDossierBrief ? `

\u7ED3\u6784\u5316\u89D2\u8272\u6863\u6848\u6458\u8981\uFF1A
${storyCoreDossierBrief}` : "";
      const dossierBudget = Math.min(500, Math.floor(CONTEXT_BUDGET.story_core * 0.25));
      const baseBudget = CONTEXT_BUDGET.story_core - dossierBudget;
      const compactStoryCoreBase = storyCoreBase.length > baseBudget ? `${storyCoreBase.slice(0, baseBudget)}
\u2026[\u6838\u5FC3\u5C42\u5DF2\u622A\u65AD]` : storyCoreBase;
      const storyCoreCtx = dossierSection ? `${compactStoryCoreBase}${dossierSection.slice(0, dossierBudget)}`.slice(0, CONTEXT_BUDGET.story_core) : storyCoreBase;
      const historyCtx = buildHistoryForAgent(agent.id, discussionStage, replies, priorTranscript);
      console.log(
        `[CTX BUDGET] Agent: ${agent.label} | Stage: ${discussionStage} | StoryCore: ${storyCoreCtx.length}\u5B57 | History: ${historyCtx.length}\u5B57 | Base: ${basePrompt.length}\u5B57 | Dynamic: ${dynamicPrompt.length}\u5B57`
      );
      reply = await generateAgentReply({
        roleName: agent.label,
        basePrompt,
        dynamicPrompt,
        consensus: storyCoreCtx,
        message,
        discussionStage,
        priorTranscript: historyCtx,
        discussionTarget,
        preferredLanguage: "zh-CN",
        currentStage: state.runtime.stage,
        stageInstruction: stageInstructionFor(state, discussionTarget),
        envRootDir: options.envRootDir ?? rootDir,
        signal: options.signal,
        onDelta: async (delta) => {
          await options.onStreamEvent?.({
            type: "agent_delta",
            messageId,
            turnId,
            role: agent.label,
            delta,
            phase: "streaming",
            statusText: "LLM \u6B63\u5728\u6301\u7EED\u8FD4\u56DE\u5185\u5BB9\u3002",
            statusDetail: "\u8FD4\u56DE\u5185\u5BB9\u4F1A\u6301\u7EED\u5408\u5E76\u5230\u8FD9\u4E00\u6761 agent \u6D88\u606F\u4E2D\u3002"
          });
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const failedAt = (/* @__PURE__ */ new Date()).toISOString();
      factoryDb?.recordAgentTurn({
        runId,
        turnId: dbTurnId,
        role: agent.label,
        stage: discussionStage,
        status: "failed",
        input: { message, discussionTarget, currentStage: state.runtime.stage },
        error: errorMessage
      });
      if (factoryDb && options.projectId) {
        factoryDb.recordMessage(
          createAgentMessage({
            messageId,
            conversationId: runId,
            projectId: options.projectId,
            runId,
            turnId: dbTurnId,
            agentLabel: agent.label,
            content: `LLM \u8BF7\u6C42\u5931\u8D25\uFF1A${errorMessage}`,
            status: "failed",
            phase: "failed",
            statusText: "LLM \u8BF7\u6C42\u5931\u8D25\uFF0C\u5DF2\u8BB0\u5F55\u9519\u8BEF\u3002",
            statusDetail: errorMessage,
            time: failedAt,
            metadata: {
              discussionStage,
              target: discussionTarget,
              source: "discussion_agent_turn",
              error: errorMessage
            }
          }),
          discussionMessageParts(messageId, {
            role: agent.label,
            content: `LLM \u8BF7\u6C42\u5931\u8D25\uFF1A${errorMessage}`,
            discussionStage,
            target: discussionTarget,
            currentStage: state.runtime.stage,
            createdAt: failedAt
          })
        );
      }
      await options.onStreamEvent?.({
        type: "agent_error",
        messageId,
        turnId,
        role: agent.label,
        content: `LLM \u8BF7\u6C42\u5931\u8D25\uFF1A${errorMessage}`,
        error: errorMessage,
        timestamp: failedAt,
        phase: "failed",
        statusText: "LLM \u8BF7\u6C42\u5931\u8D25\uFF0C\u5DF2\u8BB0\u5F55\u9519\u8BEF\u3002",
        statusDetail: errorMessage
      });
      throw error;
    }
    replies.push({ role: agent.label, content: reply });
    const completedAt = (/* @__PURE__ */ new Date()).toISOString();
    transcriptContext.push(`${agent.label}: ${reply}`);
    await import_promises7.default.appendFile(
      discussionLogPath,
      [`## ${completedAt}`, `${agent.label}: ${reply}`, ""].join("\n")
    );
    factoryDb?.recordAgentTurn({
      runId,
      turnId: dbTurnId,
      role: agent.label,
      stage: discussionStage,
      status: "completed",
      input: { message, discussionTarget, currentStage: state.runtime.stage },
      output: reply
    });
    if (factoryDb && options.projectId) {
      factoryDb.recordMessage(
        createAgentMessage({
          messageId,
          conversationId: runId,
          projectId: options.projectId,
          runId,
          turnId: dbTurnId,
          agentLabel: agent.label,
          content: reply,
          status: "completed",
          time: completedAt,
          metadata: {
            discussionStage,
            target: discussionTarget,
            source: "discussion_agent_turn"
          }
        }),
        discussionMessageParts(messageId, {
          role: agent.label,
          content: reply,
          discussionStage,
          target: discussionTarget,
          currentStage: state.runtime.stage,
          createdAt: completedAt
        })
      );
    }
    await options.onStreamEvent?.({
      type: "agent_complete",
      messageId,
      turnId,
      role: agent.label,
      content: reply,
      timestamp: completedAt,
      phase: "completed",
      statusText: "LLM \u8FD4\u56DE\u5B8C\u6210\uFF0C\u5185\u5BB9\u5DF2\u4FDD\u5B58\u3002"
    });
    await options.onEvent?.({ role: agent.label, content: reply });
    return reply;
  }
  const showrunner = AGENT_FLOW[0];
  let synthesisReply = "";
  try {
    await runAgentTurn(showrunner, "opening_brief");
    for (const agent of SPECIALIST_FLOW) {
      await runAgentTurn(agent, "specialist_turn");
    }
    synthesisReply = await runAgentTurn(showrunner, "closing_synthesis");
    await import_promises7.default.appendFile(discussionLogPath, "Status: complete\n\n");
    factoryDb?.updateRun(runId, "completed");
  } catch (error) {
    const message2 = error instanceof Error ? error.message : String(error);
    await import_promises7.default.appendFile(discussionLogPath, `Status: error
Error: ${message2}

`);
    factoryDb?.updateRun(runId, "failed", { error: message2 });
    throw error;
  }
  const showrunnerReply = synthesisReply;
  const stageGuard = detectDiscussionStageViolation(
    state,
    discussionTarget,
    [
      message,
      ...replies.map((reply) => `${reply.role}: ${reply.content}`),
      showrunnerReply
    ].join("\n\n")
  );
  const guardedSummary = stageGuard.blocked ? buildStageGuardSummary(state, discussionTarget, stageGuard.reason) : showrunnerReply;
  const protagonistUpdate = message.includes("\u4E3B\u89D2") ? message : `Protagonist note: ${message}`;
  if (stageGuard.blocked) {
    state.runtime.lastRoute = discussionTarget.kind;
    state.runtime.lastAction = `discussion_guard_blocked:${discussionTarget.kind}`;
    state.runtime.statusMessage = `\u8BA8\u8BBA\u8F93\u51FA\u88AB\u9636\u6BB5\u5B88\u536B\u62E6\u622A\uFF0C\u672A\u5199\u5165\u751F\u4EA7\u5171\u8BC6\uFF1A${stageGuard.reason}`;
    await import_promises7.default.appendFile(discussionLogPath, `Stage Guard: blocked
Reason: ${stageGuard.reason}

`);
    await saveAutonomousState(rootDir, state);
    if (factoryDb && options.projectId) {
      factoryDb.updateProjectState(options.projectId, state);
      factoryDb.recordArtifact({
        projectId: options.projectId,
        kind: "transcript",
        path: ".ai-novel/chat/discussion-log.md",
        status: "completed",
        metadata: { runId, target: discussionTarget, stageGuard: "blocked", directorCommandId: options.directorCommandId ?? null }
      });
      factoryDb.recordEvent(options.projectId, runId, "DISCUSSION_STAGE_GUARD_BLOCKED", {
        target: discussionTarget,
        stage: state.runtime.stage,
        reason: stageGuard.reason,
        transcriptPath: discussionLogPath,
        contextPacketPath,
        directorCommandId: options.directorCommandId ?? null
      });
      factoryDb.updateRun(runId, "blocked", { error: stageGuard.reason });
    }
    try {
      return {
        runId,
        target: discussionTarget,
        replies,
        transcriptPath: discussionLogPath,
        contextPacketPath,
        summary: guardedSummary,
        stageGuard: {
          status: "blocked",
          reason: stageGuard.reason,
          rawSummary: showrunnerReply
        },
        writebackSkipped: true
      };
    } finally {
      factoryDb?.close();
    }
  }
  const updatedConsensus = buildCompactConsensus(state, guardedSummary);
  const currentProtagonist = await readText(protagonistPath);
  const updatedProtagonist = appendSection(currentProtagonist, "Discussion updates", protagonistUpdate);
  const currentDossiers = state.memory?.characterDossiers?.length ? state.memory.characterDossiers : await readCharacterDossiers2(characterDossiersPath);
  const updatedDossiers = updateCharacterDossiersFromDiscussion({
    dossiers: currentDossiers,
    targetKind: discussionTarget.kind,
    message,
    summary: guardedSummary,
    runId
  });
  if (updatedDossiers.length) {
    state.memory = {
      ...state.memory || {},
      characterDossiers: updatedDossiers
    };
  }
  const currentStyle = await readText(styleProfilePath);
  const updatedStyle = appendSection(
    currentStyle,
    "Discussion-driven adjustments",
    "\u5F53\u524D\u8BA8\u8BBA\u5F3A\u8C03\u66F4\u50CF\u4EBA\u5199\u7684\u4E2D\u6587\u8868\u8FBE\uFF0C\u4EE5\u53CA\u4E25\u683C\u9075\u5B88\u5F53\u524D workflow \u9636\u6BB5\u3002"
  );
  const consensusArchive = await writeDiscussionConsensusArchive(rootDir, {
    runId,
    startedAt: transcriptStartedAt,
    state,
    target: discussionTarget,
    message,
    summary: guardedSummary,
    replies,
    transcriptRelativePath: ".ai-novel/chat/discussion-log.md",
    contextPacketRelativePath: ".ai-novel/context/current-context.md"
  });
  state.runtime.lastRoute = discussionTarget.kind;
  state.runtime.lastAction = `discussion:${discussionTarget.kind}`;
  state.runtime.statusMessage = `\u5DF2\u5B8C\u6210${discussionTarget.label}\uFF0C\u5171\u8BC6\u5DF2\u5199\u56DE ${discussionTarget.assetPath}\u3002`;
  await import_promises7.default.writeFile(consensusPath, updatedConsensus);
  await import_promises7.default.writeFile(protagonistPath, updatedProtagonist);
  if (updatedDossiers.length) {
    await writeJsonFileAtomic3(characterDossiersPath, updatedDossiers);
    await import_promises7.default.writeFile(characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown2(updatedDossiers)}
`);
  }
  await import_promises7.default.writeFile(styleProfilePath, updatedStyle);
  await saveAutonomousState(rootDir, state);
  if (factoryDb && options.projectId) {
    factoryDb.updateProjectState(options.projectId, state);
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "transcript",
      path: ".ai-novel/chat/discussion-log.md",
      status: "completed",
      metadata: { runId, target: discussionTarget, consensusArchivePath: consensusArchive.relativePath, directorCommandId: options.directorCommandId ?? null }
    });
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: targetToArtifactKind(discussionTarget),
      path: discussionTarget.assetPath,
      status: "completed",
      metadata: { runId, summary: guardedSummary, directorCommandId: options.directorCommandId ?? null }
    });
    if (updatedDossiers.length) {
      factoryDb.recordArtifact({
        projectId: options.projectId,
        kind: "memory",
        path: ".ai-novel/memory/characters/dossiers.json",
        status: "completed",
        metadata: { runId, target: discussionTarget, source: "discussion_writeback", directorCommandId: options.directorCommandId ?? null }
      });
    }
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "consensus",
      path: ".ai-novel/prompts/global-consensus.md",
      status: "completed",
      metadata: { runId, latestArchivePath: consensusArchive.relativePath, directorCommandId: options.directorCommandId ?? null }
    });
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "consensus",
      path: consensusArchive.relativePath,
      status: "completed",
      metadata: {
        runId,
        target: discussionTarget,
        source: "discussion_archive",
        transcriptPath: ".ai-novel/chat/discussion-log.md",
        contextPacketPath: ".ai-novel/context/current-context.md",
        directorCommandId: options.directorCommandId ?? null
      }
    });
    const memoryId = factoryDb.recordMemory(options.projectId, {
      source: `discussion:${runId}`,
      kind: discussionTarget.kind,
      content: guardedSummary,
      importance: 3,
      metadata: { target: discussionTarget }
    });
    factoryDb.upsertEmbedding(options.projectId, {
      ownerKind: "memory",
      ownerId: memoryId,
      model: "local-hash-v1",
      vector: createLocalTextEmbedding(guardedSummary)
    });
    factoryDb.recordEvent(options.projectId, runId, "CONSENSUS_UPDATED", {
      target: discussionTarget,
      transcriptPath: discussionLogPath,
      contextPacketPath,
      consensusArchivePath: consensusArchive.relativePath,
      directorCommandId: options.directorCommandId ?? null
    });
  }
  try {
    await upsertDiscussionInSuperGraph(rootDir, {
      target: discussionTarget,
      summary: guardedSummary,
      transcriptPath: discussionLogPath
    }, {
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId
    });
  } catch {
  }
  try {
    return {
      runId,
      target: discussionTarget,
      replies,
      transcriptPath: discussionLogPath,
      contextPacketPath,
      consensusArchivePath: consensusArchive.absolutePath,
      summary: guardedSummary,
      stageGuard: {
        status: "ok",
        reason: ""
      },
      writebackSkipped: false
    };
  } finally {
    factoryDb?.close();
  }
}

// src/novel-director.ts
function makeDirectorCommandId() {
  return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function isGenericAutopilotMessage(message) {
  return /^(开始|继续|go|start|continue|run|resume)$/i.test(message.trim());
}
function shouldAdvanceBeforeDiscussion(state, initialMessage, correctionMessage) {
  if (correctionMessage.trim()) {
    return false;
  }
  const trimmedInitialMessage = initialMessage.trim();
  if (trimmedInitialMessage && !isGenericAutopilotMessage(trimmedInitialMessage)) {
    return false;
  }
  if (state.runtime.stage === "complete" && !state.plan.chapterTasks.every((task) => task.status === "complete")) {
    return true;
  }
  if (state.runtime.stage === "worldbuilding_dialogue" && isGenericAutopilotMessage(trimmedInitialMessage)) {
    if (state.runtime.autopilot && (state.runtime.autopilot.loopCount || 0) > 0) {
      return true;
    }
  }
  return [
    "setting_review",
    "master_planning",
    "chapter_task_generation",
    "drafting",
    "reviewing"
  ].includes(state.runtime.stage);
}
function buildDirectorDiscussionMessage(state, initialMessage) {
  const trimmedInitialMessage = initialMessage.trim();
  if (trimmedInitialMessage && !isGenericAutopilotMessage(trimmedInitialMessage)) {
    return trimmedInitialMessage;
  }
  if (state.runtime.stage === "worldbuilding_dialogue") {
    return "\u8BF7\u7EE7\u7EED\u81EA\u4E3B\u6536\u655B\u4E16\u754C\u89C2\u3001\u4E3B\u89D2\u6838\u5FC3\u3001\u51B2\u7A81\u5F15\u64CE\u548C\u4E0D\u53EF\u8FDD\u80CC\u89C4\u5219\uFF0C\u5F62\u6210\u53EF\u5199\u56DE\u7684\u7EDF\u4E00\u7ED3\u8BBA\u3002";
  }
  if (state.runtime.stage === "setting_review") {
    return "\u8BF7\u5BA1\u9605\u5DF2\u51BB\u7ED3\u8BBE\u5B9A\uFF0C\u6307\u51FA\u8BBE\u5B9A\u6F0F\u6D1E\u3001\u89D2\u8272\u52A8\u673A\u98CE\u9669\u548C\u8FDB\u5165\u4E3B\u7EBF\u89C4\u5212\u524D\u5FC5\u987B\u9501\u5B9A\u7684\u5185\u5BB9\u3002";
  }
  if (state.runtime.stage === "master_planning") {
    return "\u8BF7\u56F4\u7ED5\u4E3B\u7EBF\u89C4\u5212\u7EE7\u7EED\u8BA8\u8BBA\uFF0C\u6536\u655B\u957F\u7EBF\u7ED3\u6784\u3001\u5173\u952E\u4F0F\u7B14\u3001\u5206\u5377\u538B\u529B\u548C\u7ED3\u5C40\u60C5\u611F\u627F\u8BFA\u3002";
  }
  if (state.runtime.stage === "chapter_task_generation") {
    return "\u8BF7\u68C0\u67E5\u7AE0\u8282\u84DD\u56FE\u662F\u5426\u80FD\u652F\u6491\u8FDE\u7EED\u5199\u4F5C\uFF0C\u660E\u786E\u4E0B\u4E00\u6B65\u8FDB\u5165\u6B63\u6587\u5199\u4F5C\u65F6\u7684\u6267\u884C\u91CD\u70B9\u3002";
  }
  if (state.runtime.stage === "drafting") {
    const nextTask = state.plan.chapterTasks.find((task) => task.status === "pending");
    return nextTask ? `\u8BF7\u56F4\u7ED5\u7B2C ${nextTask.chapterNumber} \u7AE0\u7EE7\u7EED\u521B\u4F5C\u524D\u8BA8\u8BBA\uFF0C\u660E\u786E\u672C\u7AE0\u76EE\u6807\u3001\u51B2\u7A81\u3001\u60C5\u7EEA\u63A8\u8FDB\u548C\u5BA1\u6821\u98CE\u9669\u3002` : "\u8BF7\u68C0\u67E5\u5168\u4E66\u7AE0\u8282\u4EFB\u52A1\u662F\u5426\u5DF2\u7ECF\u5B8C\u6210\uFF0C\u5E76\u6536\u675F\u6700\u7EC8\u72B6\u6001\u3002";
  }
  if (state.runtime.stage === "reviewing") {
    const blockedTask = state.plan.chapterTasks.find((task) => task.status === "blocked");
    return blockedTask ? `\u7B2C ${blockedTask.chapterNumber} \u7AE0\u8D28\u91CF\u95E8\u7981\u672A\u901A\u8FC7\uFF0C\u8BF7\u57FA\u4E8E\u6700\u8FD1\u8D28\u68C0\u539F\u56E0\u5236\u5B9A\u8FD4\u5DE5\u91CD\u70B9\uFF0C\u7136\u540E\u81EA\u52A8\u6062\u590D\u8BE5\u7AE0\u751F\u4EA7\u3002` : "\u8BF7\u68C0\u67E5\u5BA1\u6821\u9636\u6BB5\u662F\u5426\u4ECD\u6709\u963B\u585E\u7AE0\u8282\uFF1B\u5982\u679C\u6CA1\u6709\uFF0C\u8BF7\u6062\u590D\u5230\u540E\u7EED\u6B63\u6587\u5199\u4F5C\u3002";
  }
  if (state.runtime.stage === "replanning") {
    return "\u8BF7\u6839\u636E\u6700\u8FD1\u7684\u7528\u6237\u4E2D\u65AD\u91CD\u65B0\u89C4\u5212\u53D7\u5F71\u54CD\u8D44\u4EA7\uFF0C\u5E76\u7ED9\u51FA\u6062\u590D\u8FDE\u7EED\u5199\u4F5C\u7684\u7EDF\u4E00\u8DEF\u5F84\u3002";
  }
  return "\u8BF7\u6839\u636E\u5F53\u524D\u9879\u76EE\u72B6\u6001\u7EE7\u7EED\u81EA\u4E3B\u63A8\u8FDB\u5C0F\u8BF4\u521B\u4F5C\u6D41\u7A0B\u3002";
}
function decideNovelDirectorCommand(state, input = {}) {
  const userMessage = input.userMessage ?? "";
  const correctionMessage = input.correctionMessage ?? "";
  if (shouldAdvanceBeforeDiscussion(state, userMessage, correctionMessage)) {
    return {
      id: makeDirectorCommandId(),
      type: "advance",
      stage: state.runtime.stage,
      reason: "\u5F53\u524D\u9636\u6BB5\u5DF2\u6709\u8DB3\u591F\u4E0A\u4E0B\u6587\uFF0C\u4F18\u5148\u63A8\u8FDB\u751F\u4EA7\u72B6\u6001\u673A\u3002",
      advanceFirst: true,
      parentCommandId: null
    };
  }
  const message = correctionMessage || buildDirectorDiscussionMessage(state, userMessage);
  return {
    id: makeDirectorCommandId(),
    type: "discuss",
    stage: state.runtime.stage,
    message,
    reason: correctionMessage.trim() ? "\u9636\u6BB5\u5B88\u536B\u8981\u6C42\u5148\u7EA0\u504F\u8BA8\u8BBA\u3002" : "\u5F53\u524D\u9636\u6BB5\u9700\u8981\u5148\u5F62\u6210\u6216\u4FEE\u6B63 agent \u5171\u8BC6\u3002"
  };
}
function createFollowUpAdvanceCommand(state, parentCommand, reason = "\u8BA8\u8BBA\u7ED3\u8BBA\u5DF2\u5199\u56DE\uFF0C\u81EA\u52A8\u63A8\u8FDB\u5DE5\u4F5C\u6D41\u3002") {
  return {
    id: makeDirectorCommandId(),
    type: "advance",
    stage: state.runtime.stage,
    reason,
    advanceFirst: true,
    parentCommandId: parentCommand.id
  };
}

// src/director-commands.ts
async function recordDirectorCommandEvent(options, type, command, payload = {}) {
  if (!options.factoryRootDir || !options.projectId) {
    return;
  }
  await withFactoryDb(options.factoryRootDir, async (db) => db.recordEvent(options.projectId, null, type, {
    commandId: command.id,
    command: command.type,
    stage: command.stage,
    chapterNumber: "chapterNumber" in command ? command.chapterNumber : void 0,
    reason: command.reason,
    source: options.source || "manual",
    ...payload
  })).catch(() => void 0);
}

// src/autopilot-worker.ts
var autopilotJobs = /* @__PURE__ */ new Map();
var AUTOPILOT_LEASE_SECONDS = 60;
var AUTOPILOT_RESTORE_POLL_MS = Math.max(1, AUTOPILOT_LEASE_SECONDS) * 1e3;
var AUTOPILOT_HEARTBEAT_MS = Math.max(5e3, Math.floor(AUTOPILOT_LEASE_SECONDS * 1e3 / 3));
var AUTOPILOT_NETWORK_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 10 : 5e3;
var AUTOPILOT_NETWORK_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 20 : 6e4;
var AUTOPILOT_PROVIDER_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 12 : 1e4;
var AUTOPILOT_PROVIDER_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 24 : 9e4;
var AUTOPILOT_RATE_LIMIT_RETRY_BASE_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 15 : 15e3;
var AUTOPILOT_RATE_LIMIT_RETRY_MAX_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 30 : 12e4;
var AUTOPILOT_NO_PROGRESS_BACKOFF_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 10 : 15e3;
var AUTOPILOT_STALE_LLM_REQUEST_MS = process.env.AI_NOVEL_TEST_MODE === "1" ? 25 : Math.max(18e4, Number(process.env.LLM_TIMEOUT_MS || 12e4) + 6e4);
var KNOWLEDGE_JOB_LEASE_SECONDS = 120;
var ACTIVE_WRITING_MESSAGE_STATUSES = ["queued", "streaming"];
function makeWorkerOwner() {
  return `worker:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}
async function ensureKnowledgeBootstrapJobs(rootDir, projects) {
  await withFactoryDb(rootDir, async (db) => {
    for (const project of projects) {
      const snapshot = db.getSnapshot(project.id);
      const summary = snapshot.knowledge?.summary || {};
      const knowledgeJobs = db.listProjectJobs(project.id).filter((job) => String(job.kind || "").startsWith("knowledge_"));
      const hasRunnableKnowledgeJob = knowledgeJobs.some((job) => job.status === "idle" || job.status === "running" || job.status === "paused");
      if (hasRunnableKnowledgeJob) {
        continue;
      }
      const queuedJobs = [];
      if (Number(summary.globalSources || 0) === 0) {
        const id = db.createJob({
          projectId: project.id,
          kind: "knowledge_global_bootstrap",
          status: "idle",
          payload: {
            scope: "global",
            reason: "worker_bootstrap_missing_global_index",
            limit: process.env.AI_NOVEL_TEST_MODE === "1" ? 4 : void 0
          }
        });
        queuedJobs.push({ id, kind: "knowledge_global_bootstrap" });
      }
      if (Number(summary.projectSources || 0) === 0) {
        const artifacts = Array.isArray(snapshot.artifacts) ? snapshot.artifacts : [];
        const artifactPaths = [...new Set(artifacts.map((artifact) => String(artifact.path || "")).filter(
          (artifactPath) => artifactPath.endsWith(".md") && (artifactPath.includes("global-consensus.md") || artifactPath.includes("current-context.md") || artifactPath.includes("discussion-log.md") || artifactPath.includes("setting-freeze.md") || artifactPath.includes("master-outline.md") || artifactPath.includes("chapter-blueprints/") || artifactPath.includes(".final.md") || artifactPath.includes("-quality.md") || artifactPath.includes("-memory.md") || artifactPath.includes("production-resources/"))
        ))];
        for (const artifactPath of artifactPaths.slice(0, 80)) {
          const id = db.createJob({
            projectId: project.id,
            kind: "knowledge_project_artifact",
            status: "idle",
            payload: {
              projectId: project.id,
              artifactPath,
              kind: "artifact",
              reason: "worker_bootstrap_missing_project_index"
            }
          });
          queuedJobs.push({ id, kind: "knowledge_project_artifact", artifactPath });
        }
      }
      if (queuedJobs.length > 0) {
        db.recordEvent(project.id, null, "KNOWLEDGE_BOOTSTRAP_QUEUED", {
          reason: "worker_bootstrap_missing_index",
          jobs: queuedJobs
        });
      }
    }
  }).catch(() => void 0);
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAutopilotStopError());
      return;
    }
    let timer;
    const abortSleep = () => {
      clearTimeout(timer);
      reject(createAutopilotStopError());
    };
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", abortSleep);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abortSleep, { once: true });
  });
}
function readJsonObject(value) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function isTransientNetworkError(error) {
  return classifyTransientNetworkError(error) !== null;
}
function classifyTransientNetworkError(error) {
  if (isAutopilotStopError(error)) {
    return null;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/429|rate limit|too many requests|quota/i.test(message)) {
    return "rate_limit";
  }
  if (/503|502|504|temporar|unavailable|overloaded|bad gateway|gateway timeout/i.test(message)) {
    return "provider_unavailable";
  }
  if (/timeout|timed\s*out|timed-out/i.test(message)) {
    return "timeout";
  }
  if (/network|fetch|failed|econn|enotfound|etimedout|socket|undici|dns|connect|connection reset/i.test(message)) {
    return "connection";
  }
  return null;
}
function nextNetworkRetryDelay(attempt, kind = "connection") {
  const exponent = 2 ** Math.max(0, attempt - 1);
  if (kind === "rate_limit") {
    return Math.min(AUTOPILOT_RATE_LIMIT_RETRY_BASE_MS * exponent, AUTOPILOT_RATE_LIMIT_RETRY_MAX_MS);
  }
  if (kind === "provider_unavailable") {
    return Math.min(AUTOPILOT_PROVIDER_RETRY_BASE_MS * exponent, AUTOPILOT_PROVIDER_RETRY_MAX_MS);
  }
  return Math.min(AUTOPILOT_NETWORK_RETRY_BASE_MS * exponent, AUTOPILOT_NETWORK_RETRY_MAX_MS);
}
function describeTransientNetworkError(kind) {
  if (kind === "rate_limit") {
    return {
      statusPrefix: "\u6A21\u578B\u670D\u52A1\u89E6\u53D1\u9650\u6D41\uFF0C\u6B63\u5728\u6309\u9000\u907F\u7B56\u7565\u81EA\u52A8\u91CD\u8BD5",
      eventMessage: "\u6A21\u578B\u670D\u52A1\u89E6\u53D1\u9650\u6D41\uFF0C\u7CFB\u7EDF\u5C06\u653E\u6162\u8282\u594F\u540E\u7EE7\u7EED\u65E0\u4EBA\u503C\u5B88\u6D41\u7A0B\u3002"
    };
  }
  if (kind === "provider_unavailable") {
    return {
      statusPrefix: "\u6A21\u578B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u6B63\u5728\u7B49\u5F85\u670D\u52A1\u6062\u590D\u540E\u81EA\u52A8\u91CD\u8BD5",
      eventMessage: "\u6A21\u578B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u7CFB\u7EDF\u6B63\u5728\u7B49\u5F85\u670D\u52A1\u6062\u590D\u540E\u7EE7\u7EED\u65E0\u4EBA\u503C\u5B88\u6D41\u7A0B\u3002"
    };
  }
  if (kind === "timeout") {
    return {
      statusPrefix: "\u6A21\u578B\u54CD\u5E94\u8D85\u65F6\uFF0C\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5",
      eventMessage: "\u6A21\u578B\u54CD\u5E94\u8D85\u65F6\uFF0C\u7CFB\u7EDF\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5\u5E76\u4FDD\u7559\u5F53\u524D\u65E0\u4EBA\u503C\u5B88\u8FDB\u5EA6\u3002"
    };
  }
  return {
    statusPrefix: "\u7F51\u7EDC\u8FDE\u63A5\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u6B63\u5728\u81EA\u52A8\u91CD\u8BD5",
    eventMessage: "\u7F51\u7EDC\u8FDE\u63A5\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u7CFB\u7EDF\u6B63\u5728\u7B49\u5F85\u6062\u590D\u540E\u7EE7\u7EED\u65E0\u4EBA\u503C\u5B88\u6D41\u7A0B\u3002"
  };
}
function workflowProgressSignature(state) {
  const tasks = state.plan.chapterTasks || [];
  const counts = {
    complete: tasks.filter((task) => task.status === "complete").length,
    pending: tasks.filter((task) => task.status === "pending").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length
  };
  const firstActive = tasks.find((task) => task.status !== "complete");
  return [
    state.runtime.stage,
    state.runtime.lastAction || "",
    state.plan.pendingChapters,
    counts.complete,
    counts.pending,
    counts.inProgress,
    counts.blocked,
    firstActive ? `${firstActive.chapterNumber}:${firstActive.status}:${firstActive.recoveryAttempts || 0}` : "none"
  ].join("|");
}
function hasEarlierActiveTask(state, chapterNumber) {
  return state.plan.chapterTasks.some((task) => task.chapterNumber < chapterNumber && (task.status === "in_progress" || task.status === "blocked"));
}
async function findActiveWritingMessage(rootDir, projectId, chapterNumber) {
  if (!projectId || !chapterNumber) {
    return null;
  }
  return withFactoryDb(rootDir, async (db) => {
    const messages = db.listMessages(projectId, {
      conversationId: `writing:${projectId}`,
      limit: 12
    });
    return messages.find((message) => {
      if (!ACTIVE_WRITING_MESSAGE_STATUSES.includes(message.status)) {
        return false;
      }
      const metadata = message.metadata && typeof message.metadata === "object" ? message.metadata : {};
      return Number(metadata.chapterNumber) === chapterNumber;
    }) || null;
  }).catch(() => null);
}
async function recoverOrphanedInProgressWritingTask(rootDir, projectRoot, projectId, state) {
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "in_progress");
  if (!projectId || !task) {
    return { recovered: false, state };
  }
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, task.chapterNumber);
  if (activeWritingMessage) {
    return { recovered: false, state };
  }
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  task.status = "pending";
  task.recoveryBlocked = false;
  task.recoveryQueuedAt = now2;
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = `\u7B2C ${task.chapterNumber} \u7AE0\u7684\u6267\u884C\u8BF7\u6C42\u5DF2\u4E22\u5931\uFF0C\u5DF2\u81EA\u52A8\u6062\u590D\u4E3A\u5F85\u5199\u4F5C\u5E76\u51C6\u5907\u91CD\u65B0\u6267\u884C\u3002`;
  await saveAutonomousState(projectRoot, state);
  await withFactoryDb(rootDir, async (db) => {
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId: `writing-${task.chapterNumber}-orphaned-task-recovered`,
      step: "orphaned_in_progress_recovered",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      phase: "completed",
      statusText: "\u7AE0\u8282\u6267\u884C\u8BF7\u6C42\u5DF2\u6062\u590D\uFF0C\u7B49\u5F85\u91CD\u65B0\u5199\u4F5C\u3002",
      message: `\u7B2C ${task.chapterNumber} \u7AE0\u5904\u4E8E in_progress\uFF0C\u4F46\u6CA1\u6709\u6D3B\u52A8\u4E2D\u7684 LLM \u6D88\u606F\uFF0C\u7CFB\u7EDF\u5DF2\u91CD\u65B0\u6392\u961F\u3002`,
      timestamp: now2
    });
    db.recordEvent(projectId, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: task.chapterNumber,
      status: "pending",
      reason: "orphaned_in_progress_recovered",
      recoveryAttempts: task.recoveryAttempts || 0,
      recoveryQueuedAt: task.recoveryQueuedAt
    });
    db.updateProjectState(projectId, state);
  }).catch(() => void 0);
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message: state.runtime.statusMessage,
    dedupeKey: `orphaned-in-progress-recovered:${task.chapterNumber}:${task.recoveryQueuedAt}`
  });
  return { recovered: true, state };
}
function messageUpdatedMs(message) {
  if (!message) {
    return 0;
  }
  const candidates = [
    message.updated_at,
    message.updatedAt,
    message.time,
    message.created_at,
    message.createdAt
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) {
      continue;
    }
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}
function activeWritingMessageAgeMs(message, now2 = Date.now()) {
  const updatedAt = messageUpdatedMs(message);
  return updatedAt > 0 ? Math.max(0, now2 - updatedAt) : 0;
}
async function recoverStaleWritingRequest(rootDir, projectRoot, projectId, state) {
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "in_progress" || candidate.status === "blocked");
  if (!projectId || !task) {
    return { recovered: false, state };
  }
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, task.chapterNumber);
  if (!activeWritingMessage) {
    return { recovered: false, state };
  }
  const ageMs = activeWritingMessageAgeMs(activeWritingMessage);
  if (ageMs < AUTOPILOT_STALE_LLM_REQUEST_MS) {
    return { recovered: false, state };
  }
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  const reason = `stale LLM writing message ${String(activeWritingMessage.id || "")} exceeded ${Math.round(AUTOPILOT_STALE_LLM_REQUEST_MS / 1e3)}s without progress`;
  task.status = "pending";
  task.recoveryAttempts = (task.recoveryAttempts || 0) + 1;
  task.recoveryBlocked = false;
  task.recoveryQueuedAt = now2;
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = `\u7B2C ${task.chapterNumber} \u7AE0\u7684\u4E0A\u4E00\u6B21 LLM \u8BF7\u6C42\u5DF2\u5931\u8054\uFF0C\u5DF2\u81EA\u52A8\u56DE\u6536\u5E76\u91CD\u65B0\u6392\u961F\u3002`;
  await saveAutonomousState(projectRoot, state);
  await withFactoryDb(rootDir, async (db) => {
    db.markStreamingMessagesFailed(projectId, {
      conversationId: `writing:${projectId}`,
      chapterNumber: task.chapterNumber,
      reason
    });
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId: `writing-${task.chapterNumber}-llm-request-stale-recovered`,
      step: "llm_request_stale_recovered",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      phase: "completed",
      statusText: "\u4E0A\u4E00\u6B21 LLM \u8BF7\u6C42\u5931\u8054\uFF0C\u7CFB\u7EDF\u5DF2\u81EA\u52A8\u56DE\u6536\u5E76\u51C6\u5907\u91CD\u8BD5\u3002",
      message: `\u7B2C ${task.chapterNumber} \u7AE0\u7684\u4E0A\u4E00\u6B21\u6A21\u578B\u8BF7\u6C42\u957F\u65F6\u95F4\u6CA1\u6709\u8FDB\u5C55\uFF0C\u5DF2\u6807\u8BB0\u5931\u8D25\u5E76\u91CD\u65B0\u6392\u961F\u3002`,
      staleMessageId: activeWritingMessage.id || null,
      staleAgeMs: ageMs,
      reason,
      timestamp: now2
    });
    db.recordEvent(projectId, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: task.chapterNumber,
      status: "pending",
      reason: "stale_llm_request_recovered",
      recoveryAttempts: task.recoveryAttempts,
      recoveryQueuedAt: task.recoveryQueuedAt
    });
    db.updateProjectState(projectId, state);
  }).catch(() => void 0);
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message: state.runtime.statusMessage,
    dedupeKey: `stale-llm-recovered:${task.chapterNumber}:${String(activeWritingMessage.id || "")}`
  });
  return { recovered: true, state };
}
async function backoffIfActiveWritingMessage(rootDir, projectRoot, projectId, state, signal) {
  const waitingTask = state.plan.chapterTasks.find((task) => task.status === "in_progress" || task.status === "blocked");
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, waitingTask?.chapterNumber ?? null);
  if (!waitingTask || !activeWritingMessage) {
    return false;
  }
  const activeMessageAgeMs = activeWritingMessageAgeMs(activeWritingMessage);
  const staleActiveWritingMessage = activeMessageAgeMs >= AUTOPILOT_STALE_LLM_REQUEST_MS;
  const activeMetadata = activeWritingMessage.metadata && typeof activeWritingMessage.metadata === "object" ? activeWritingMessage.metadata : {};
  const activeStep = typeof activeMetadata.step === "string" ? activeMetadata.step : "";
  const activeStatusText = activeWritingMessage.data && typeof activeWritingMessage.data === "object" ? String(activeWritingMessage.data.statusText || "") : "";
  const message = staleActiveWritingMessage ? `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6A21\u578B\u8BF7\u6C42\u5DF2\u8D85\u8FC7\u6062\u590D\u9608\u503C\uFF0C\u4E0B\u4E00\u8F6E\u5C06\u81EA\u52A8\u56DE\u6536\u5E76\u91CD\u8BD5\u3002` : `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6A21\u578B\u8BF7\u6C42\u4ECD\u5728\u6267\u884C\uFF1A${activeStatusText || activeStep || "\u7B49\u5F85\u6A21\u578B\u54CD\u5E94\u6216\u6301\u7EED\u8F93\u51FA\u4E2D\u3002"}`;
  await markAutopilot(projectRoot, {
    lastStep: staleActiveWritingMessage ? "stale_llm_recovery_pending" : "waiting_for_llm",
    statusMessage: message
  }, autopilotStateStore(rootDir, projectId));
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message,
    dedupeKey: `waiting-for-llm:${state.runtime.stage}:${waitingTask.chapterNumber}:${activeStep}`
  });
  await sleep(AUTOPILOT_NO_PROGRESS_BACKOFF_MS, signal);
  return true;
}
async function backoffIfNoWorkflowProgress(rootDir, projectRoot, projectId, before, after, signal) {
  if (workflowProgressSignature(before) !== workflowProgressSignature(after)) {
    return false;
  }
  const latestState = await loadAutonomousState(projectRoot).catch(() => after);
  const latestPendingTask = latestState.plan.chapterTasks.find((task) => task.status === "pending");
  if (latestPendingTask && !hasEarlierActiveTask(latestState, latestPendingTask.chapterNumber)) {
    await markAutopilot(projectRoot, {
      lastStep: "pending_work_detected",
      statusMessage: `\u7B2C ${latestPendingTask.chapterNumber} \u7AE0\u5DF2\u91CD\u65B0\u6392\u961F\uFF0C\u7EE7\u7EED\u63A8\u8FDB\u751F\u4EA7\u72B6\u6001\u673A\u3002`
    }, autopilotStateStore(rootDir, projectId));
    emitAutopilotEvent(projectRoot, "autopilot_status", {
      stage: latestState.runtime.stage,
      message: `\u7B2C ${latestPendingTask.chapterNumber} \u7AE0\u5DF2\u91CD\u65B0\u6392\u961F\uFF0C\u7EE7\u7EED\u63A8\u8FDB\u751F\u4EA7\u72B6\u6001\u673A\u3002`,
      dedupeKey: `pending-work:${latestPendingTask.chapterNumber}:${latestPendingTask.recoveryQueuedAt || ""}`
    });
    return false;
  }
  const waitingTask = after.plan.chapterTasks.find((task) => task.status === "in_progress" || task.status === "blocked");
  const activeWritingMessage = await findActiveWritingMessage(rootDir, projectId, waitingTask?.chapterNumber ?? null);
  const activeMessageAgeMs = activeWritingMessageAgeMs(activeWritingMessage);
  const staleActiveWritingMessage = Boolean(activeWritingMessage && activeMessageAgeMs >= AUTOPILOT_STALE_LLM_REQUEST_MS);
  const activeMetadata = activeWritingMessage?.metadata && typeof activeWritingMessage.metadata === "object" ? activeWritingMessage.metadata : {};
  const activeStep = typeof activeMetadata.step === "string" ? activeMetadata.step : "";
  const activeStatusText = activeWritingMessage?.data && typeof activeWritingMessage.data === "object" ? String(activeWritingMessage.data.statusText || "") : "";
  const activeMessage = waitingTask && activeWritingMessage ? staleActiveWritingMessage ? `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6A21\u578B\u8BF7\u6C42\u5DF2\u8D85\u8FC7\u6062\u590D\u9608\u503C\uFF0C\u4E0B\u4E00\u8F6E\u5C06\u81EA\u52A8\u56DE\u6536\u5E76\u91CD\u8BD5\u3002` : `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6A21\u578B\u8BF7\u6C42\u4ECD\u5728\u6267\u884C\uFF1A${activeStatusText || activeStep || "\u7B49\u5F85\u6A21\u578B\u54CD\u5E94\u6216\u6301\u7EED\u8F93\u51FA\u4E2D\u3002"}` : "";
  const message = activeMessage || (waitingTask ? `\u7B2C ${waitingTask.chapterNumber} \u7AE0\u6682\u65E0\u65B0\u8FDB\u5C55\uFF0C\u7CFB\u7EDF\u8FDB\u5165\u77ED\u6682\u9000\u907F\u7B49\u5F85\uFF0C\u907F\u514D\u7A7A\u8F6C\u5237\u5C4F\u3002` : "\u5DE5\u4F5C\u6D41\u6682\u65E0\u65B0\u8FDB\u5C55\uFF0C\u7CFB\u7EDF\u8FDB\u5165\u77ED\u6682\u9000\u907F\u7B49\u5F85\uFF0C\u907F\u514D\u7A7A\u8F6C\u5237\u5C4F\u3002");
  await markAutopilot(projectRoot, {
    lastStep: staleActiveWritingMessage ? "stale_llm_recovery_pending" : activeWritingMessage ? "waiting_for_llm" : "no_progress_backoff",
    statusMessage: message
  }, autopilotStateStore(rootDir, projectId));
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: after.runtime.stage,
    message,
    dedupeKey: activeWritingMessage ? `waiting-for-llm:${after.runtime.stage}:${waitingTask?.chapterNumber || "none"}:${activeStep}` : `no-progress:${after.runtime.stage}:${waitingTask?.chapterNumber || "none"}`
  });
  await sleep(AUTOPILOT_NO_PROGRESS_BACKOFF_MS, signal);
  return true;
}
function emitAutopilotEvent(projectRoot, type, payload) {
  const job = autopilotJobs.get(projectRoot);
  if (!job) return;
  for (const listener of job.listeners) {
    listener({ type, payload });
  }
}
function throwIfAutopilotStopped(signal) {
  throwIfStopped(signal);
}
function startJobLeaseHeartbeat(rootDir, projectId, jobId, leaseOwner, controller) {
  if (!jobId || process.env.AI_NOVEL_TEST_MODE === "1") {
    return () => void 0;
  }
  const timer = setInterval(() => {
    void withFactoryDb(rootDir, async (db) => {
      const lease = db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS);
      const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : [];
      const currentJob = jobs.find((entry) => entry.id === jobId);
      if (!lease || currentJob && currentJob.status !== "running" && currentJob.status !== "paused") {
        controller.abort();
      }
    }).catch(() => void 0);
  }, AUTOPILOT_HEARTBEAT_MS);
  return () => clearInterval(timer);
}
async function markAutopilot(projectRoot, patch, options = {}) {
  const state = await loadAutonomousState(projectRoot);
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  const current = state.runtime.autopilot || {
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
    loopCount: 0
  };
  state.runtime.autopilot = {
    ...current,
    ...patch,
    startedAt: patch.running && !current.startedAt ? now2 : current.startedAt,
    updatedAt: now2
  };
  if (patch.statusMessage) {
    state.runtime.statusMessage = patch.statusMessage;
  }
  await saveAutonomousState(projectRoot, state);
  if (options.factoryRootDir && options.projectId) {
    await withFactoryDb(options.factoryRootDir, async (db) => db.updateProjectState(options.projectId, state)).catch(() => void 0);
  }
  return state;
}
function autopilotStateStore(rootDir, projectId) {
  return { factoryRootDir: rootDir, projectId };
}
async function recordAutopilotDirectorCommandEvent(rootDir, projectId, type, command, payload = {}) {
  await recordDirectorCommandEvent({
    factoryRootDir: rootDir,
    projectId,
    source: "autopilot"
  }, type, command, payload);
}
async function writeAutopilotCheckpoint(projectRoot, state, label, details = {}) {
  const checkpointDir = import_node_path10.default.join(projectRoot, ".ai-novel", "checkpoints");
  await import_promises8.default.mkdir(checkpointDir, { recursive: true });
  const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "checkpoint";
  const fileName = `${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}-${safeLabel}.json`;
  const relativePath = `.ai-novel/checkpoints/${fileName}`;
  await import_promises8.default.writeFile(
    import_node_path10.default.join(checkpointDir, fileName),
    `${JSON.stringify({ state, details, createdAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2)}
`
  );
  return relativePath;
}
function evaluateAutopilotDrift({
  before,
  after,
  discussionSummary = "",
  intendedMessage = ""
}) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return {
      status: "ok",
      score: 0,
      reasons: []
    };
  }
  const text = `${discussionSummary}
${after.runtime.statusMessage || ""}`.toLowerCase();
  let score = 0;
  const reasons = [];
  const claimsCurrentDrafting = /(当前阶段|当前状态|当前已|已进入|进入)\s*[:：]?\s*(drafting|正文写作|writing)|进入\s*(drafting|正文写作|writing)\s*阶段/i.test(text);
  const hasDraftBodySignal = /(^|\n)\s*(#\s*)?第\s*[一二三四五六七八九十百\d]+\s*章\s*[·:：]|(^|\n)\s*chapter\s+\d+\s*[·:：-]/i.test(text);
  const hasNextStepDrafting = /(下一步|next step|阶段转换指令|首轮产出|准备进入|建议进入|可进入).*?(drafting|正文写作|第\s*\d+\s*章|chapter\s+\d+)/i.test(text);
  if (before.runtime.stage !== "drafting" && (claimsCurrentDrafting || hasDraftBodySignal)) {
    score += 45;
    reasons.push("\u5F53\u524D\u9636\u6BB5\u5C1A\u672A\u8FDB\u5165 drafting\uFF0C\u4F46\u8F93\u51FA\u51FA\u73B0\u7AE0\u8282\u6B63\u6587\u503E\u5411\u3002");
  }
  if (before.runtime.stage !== "master_planning" && before.runtime.stage !== "chapter_task_generation" && /已进入.*(规划|蓝图|第[一二三四五六七八九十\d]+弧)|进入第[一二三四五六七八九十\d]+弧|第[一二三四五六七八九十\d]+弧.*(已完成|总体规划|蓝图设计)/i.test(text)) {
    score += 40;
    reasons.push("\u8BA8\u8BBA\u6587\u672C\u5BA3\u79F0\u8FDB\u5165\u6216\u5B8C\u6210\u540E\u7EED\u89C4\u5212/\u5F27\u7EBF\u84DD\u56FE\uFF0C\u4F46\u72B6\u6001\u673A\u5C1A\u672A\u63A8\u8FDB\u5230\u5BF9\u5E94\u9636\u6BB5\u3002");
  }
  if (before.runtime.stage === "setting_review" && /(当前位置|当前阶段|当前已).*?(master_planning|主线规划|总体规划|章节蓝图|chapter_task_generation)/i.test(text)) {
    score += 35;
    reasons.push("\u5F53\u524D\u4ECD\u662F\u8BBE\u5B9A\u51BB\u7ED3\u9636\u6BB5\uFF0C\u4F46\u8F93\u51FA\u628A\u4E3B\u7EBF\u89C4\u5212\u6216\u7AE0\u8282\u84DD\u56FE\u63CF\u8FF0\u6210\u65E2\u6210\u72B6\u6001\u3002");
  }
  if (before.runtime.stage === "setting_review" && hasNextStepDrafting && !claimsCurrentDrafting && !hasDraftBodySignal) {
    score = Math.max(0, score - 30);
  }
  const ideaTokens = before.project.idea.toLowerCase().split(/[\s,，。！？!?.、]+/).filter((token) => token.length >= 2).slice(0, 6);
  const matchedIdeaToken = ideaTokens.length === 0 || ideaTokens.some((token) => text.includes(token));
  if (!matchedIdeaToken) {
    score += 20;
    reasons.push("\u672C\u8F6E\u6458\u8981\u6CA1\u6709\u660E\u663E\u56DE\u6263\u6700\u521D\u5C0F\u8BF4\u8BBE\u5B9A\u3002");
  }
  const intendedTokens = intendedMessage.toLowerCase().split(/[\s,，。！？!?.、]+/).filter((token) => token.length >= 2).slice(0, 5);
  const matchedIntendedToken = intendedTokens.length === 0 || intendedTokens.some((token) => text.includes(token));
  if (!matchedIntendedToken) {
    score += 15;
    reasons.push("\u672C\u8F6E\u8F93\u51FA\u4E0E\u5F53\u524D\u6267\u884C\u76EE\u6807\u5173\u8054\u504F\u5F31\u3002");
  }
  if (before.runtime.stage === after.runtime.stage && before.plan.pendingChapters === after.plan.pendingChapters) {
    const loopCount = after.runtime.autopilot?.loopCount || 0;
    if (loopCount > 1) {
      score += 10;
      reasons.push("\u8FDE\u7EED\u5FAA\u73AF\u6CA1\u6709\u4EA7\u751F\u9636\u6BB5\u6216\u7AE0\u8282\u8FDB\u5EA6\u53D8\u5316\u3002");
    }
  }
  if (/请选择|等待用户|需要你决定|无法继续|不能继续/i.test(text)) {
    score += 35;
    reasons.push("\u8F93\u51FA\u51FA\u73B0\u7B49\u5F85\u7528\u6237\u9009\u62E9\u6216\u505C\u6B62\u63A8\u8FDB\u7684\u503E\u5411\u3002");
  }
  const status = score >= 70 ? "blocked" : score >= 35 ? "correcting" : "ok";
  return {
    score,
    status,
    reason: reasons.join("\uFF1B") || "\u76EE\u6807\u4E00\u81F4\uFF0C\u672A\u53D1\u73B0\u660E\u663E\u6F02\u79FB\u3002"
  };
}
async function shouldStopAutopilot(projectRoot, rootDir, projectId) {
  const state = await loadAutonomousState(projectRoot);
  if (state.runtime.autopilot?.stopRequested) {
    return true;
  }
  if (state.plan.chapterTasks.some((task) => task.status === "blocked" && task.recoveryBlocked)) {
    return true;
  }
  if (state.runtime.stage !== "complete") {
    return false;
  }
  return isBookFullyComplete(rootDir, projectId, state);
}
function findRecoveryBlockedTask(state) {
  return state.plan.chapterTasks.find((task) => task.status === "blocked" && task.recoveryBlocked) ?? null;
}
function stateTasksAreFullyComplete(state) {
  const tasks = state.plan.chapterTasks;
  return tasks.length > 0 && tasks.every((task) => task.status === "complete");
}
async function isBookFullyComplete(rootDir, projectId, state) {
  if (projectId) {
    const facts = await withFactoryDb(rootDir, async (db) => db.getChapterFacts(projectId)).catch(() => []);
    if (facts.length > 0) {
      const totalChapters = Number(state.plan.totalChapters || state.plan.chapterTasks.length || facts.length);
      const completedFacts = facts.filter((fact) => fact.status === "complete").length;
      return totalChapters > 0 && completedFacts >= totalChapters;
    }
  }
  return stateTasksAreFullyComplete(state);
}
async function reconcileCompleteRuntimeBeforeWorkerDecision(projectRoot, rootDir, projectId, state) {
  if (state.runtime.stage !== "complete") {
    return state;
  }
  if (await isBookFullyComplete(rootDir, projectId, state)) {
    return state;
  }
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = "\u6570\u636E\u5E93\u7AE0\u8282\u8FDB\u5EA6\u663E\u793A\u4ECD\u6709\u5F85\u5904\u7406\u7AE0\u8282\uFF0C\u5DF2\u4ECE\u5B8C\u6210\u6001\u6062\u590D\u5230\u6B63\u6587\u5199\u4F5C\u3002";
  state.plan.pendingChapters = state.plan.chapterTasks.filter((task) => task.status === "pending").length;
  await saveAutonomousState(projectRoot, state);
  if (projectId) {
    await withFactoryDb(rootDir, async (db) => db.updateProjectState(projectId, state)).catch(() => void 0);
  }
  return state;
}
async function markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, state) {
  const task = findRecoveryBlockedTask(state);
  if (!task) {
    return false;
  }
  const message = `\u7B2C ${task.chapterNumber} \u7AE0\u5DF2\u8FBE\u5230\u81EA\u52A8\u6062\u590D\u4E0A\u9650\uFF0C\u9700\u8981\u4EBA\u5DE5\u5BA1\u9605\u540E\u624D\u80FD\u7EE7\u7EED\u3002`;
  await markAutopilot(projectRoot, {
    running: false,
    stopRequested: false,
    mode: "idle",
    lastStep: "recovery_blocked",
    driftStatus: "blocked",
    driftReason: message,
    statusMessage: message
  }, autopilotStateStore(rootDir, projectId));
  if (jobId) {
    await withFactoryDb(rootDir, async (db) => db.failJob(jobId, message, leaseOwner)).catch(() => void 0);
  }
  emitAutopilotEvent(projectRoot, "autopilot_status", {
    stage: state.runtime.stage,
    message
  });
  return true;
}
async function runAutopilotBackground(options, controller, leaseOwner = makeWorkerOwner()) {
  const { signal } = controller;
  const {
    rootDir,
    projectRoot,
    projectId,
    projects,
    initialMessage,
    mode = "background",
    jobId,
    createSnapshot
  } = options;
  if (jobId) {
    const claimed = await withFactoryDb(rootDir, async (db) => db.claimJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null);
    if (!claimed) {
      return;
    }
  }
  await markAutopilot(projectRoot, {
    running: true,
    stopRequested: false,
    lastStep: "starting",
    mode,
    target: initialMessage.trim() || null,
    driftScore: 0,
    driftStatus: "ok",
    driftReason: null,
    statusMessage: "\u81EA\u52A8\u521B\u4F5C\u8FD0\u884C\u4E2D\uFF1A\u7CFB\u7EDF\u5C06\u6301\u7EED\u8BA8\u8BBA\u3001\u63A8\u8FDB\u3001\u5199\u4F5C\uFF0C\u76F4\u5230\u4F60\u4E3B\u52A8\u505C\u6B62\u3002"
  }, autopilotStateStore(rootDir, projectId));
  let nextMessage = initialMessage;
  let lastConsumedJobMessage = initialMessage.trim();
  let correctionMessage = "";
  let networkRetryAttempt = 0;
  const stopLeaseHeartbeat = startJobLeaseHeartbeat(rootDir, projectId, jobId, leaseOwner, controller);
  try {
    while (!await shouldStopAutopilot(projectRoot, rootDir, projectId)) {
      throwIfAutopilotStopped(signal);
      if (jobId) {
        await withFactoryDb(rootDir, async (db) => db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null);
        const latestJob = await withFactoryDb(rootDir, async (db) => {
          const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : [];
          return jobs.find((job) => job.id === jobId) ?? null;
        }).catch(() => null);
        if (latestJob && latestJob.status !== "running" && latestJob.status !== "paused") {
          throw createAutopilotStopError();
        }
        const latestPayload = readJsonObject(latestJob?.payload_json);
        const latestMessage = typeof latestPayload.message === "string" ? latestPayload.message.trim() : "";
        if (latestMessage && latestMessage !== lastConsumedJobMessage) {
          lastConsumedJobMessage = latestMessage;
          nextMessage = latestMessage;
          correctionMessage = "";
          await withFactoryDb(rootDir, async (db) => db.recordEvent(projectId, null, "AUTOPILOT_INSTRUCTION_RECEIVED", {
            jobId,
            message: latestMessage,
            leaseOwner
          })).catch(() => void 0);
          emitAutopilotEvent(projectRoot, "autopilot_status", {
            stage: (await loadAutonomousState(projectRoot)).runtime.stage,
            message: `\u5DF2\u63A5\u6536\u65B0\u7684\u7528\u6237\u6307\u4EE4\uFF1A${latestMessage}`
          });
        }
      }
      let activeDirectorCommand = null;
      try {
        throwIfAutopilotStopped(signal);
        let beforeDiscussion = await reconcileCompleteRuntimeBeforeWorkerDecision(
          projectRoot,
          rootDir,
          projectId,
          await loadAutonomousState(projectRoot)
        );
        const staleRecovery = await recoverStaleWritingRequest(rootDir, projectRoot, projectId, beforeDiscussion);
        if (staleRecovery.recovered) {
          beforeDiscussion = staleRecovery.state;
          networkRetryAttempt = 0;
        }
        const orphanedRecovery = await recoverOrphanedInProgressWritingTask(rootDir, projectRoot, projectId, beforeDiscussion);
        if (orphanedRecovery.recovered) {
          beforeDiscussion = orphanedRecovery.state;
          networkRetryAttempt = 0;
        }
        const currentLoopCount = beforeDiscussion.runtime.autopilot?.loopCount || 0;
        if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, beforeDiscussion)) {
          break;
        }
        if (await backoffIfActiveWritingMessage(rootDir, projectRoot, projectId, beforeDiscussion, signal)) {
          continue;
        }
        const directorCommand = decideNovelDirectorCommand(beforeDiscussion, {
          userMessage: nextMessage,
          correctionMessage
        });
        activeDirectorCommand = directorCommand;
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_DECIDED", directorCommand, {
          userMessage: nextMessage || null,
          correctionActive: Boolean(correctionMessage.trim())
        });
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_STARTED", directorCommand);
        if (directorCommand.type === "advance") {
          const isSemi2 = beforeDiscussion.project?.autoMode === "semi";
          const userConfirmed = isGenericAutopilotMessage(nextMessage || "");
          if (isSemi2 && !userConfirmed) {
            const pauseMessage = `\u5F53\u524D\u5DE5\u4F5C\u6D41\u5DF2\u5B8C\u6210\u8BA8\u8BBA\u4E0E\u5171\u8BC6\uFF0C\u5DF2\u6682\u505C\u4EE5\u7B49\u5F85\u7528\u6237\u786E\u8BA4\u3002`;
            await markAutopilot(projectRoot, {
              running: false,
              stopRequested: false,
              mode: "idle",
              lastStep: "semi_auto_paused",
              statusMessage: pauseMessage
            }, autopilotStateStore(rootDir, projectId));
            if (jobId) {
              await withFactoryDb(rootDir, async (db) => db.pauseJob(jobId, leaseOwner)).catch(() => void 0);
            }
            emitAutopilotEvent(projectRoot, "autopilot_status", {
              stage: beforeDiscussion.runtime.stage,
              message: pauseMessage
            });
            break;
          }
          nextMessage = "";
          emitAutopilotEvent(projectRoot, "autopilot_status", {
            stage: beforeDiscussion.runtime.stage,
            message: directorCommand.reason
          });
          await markAutopilot(projectRoot, {
            lastStep: `advance:${beforeDiscussion.runtime.stage}`,
            loopCount: currentLoopCount + 1,
            driftStatus: "ok",
            driftReason: null,
            statusMessage: "\u5F53\u524D\u9636\u6BB5\u5DF2\u6709\u8DB3\u591F\u4E0A\u4E0B\u6587\uFF0C\u6B63\u5728\u4F18\u5148\u63A8\u8FDB\u751F\u4EA7\u72B6\u6001\u673A\u3002"
          }, autopilotStateStore(rootDir, projectId));
          const advanced2 = await advanceAutonomousProject(projectRoot, {
            factoryRootDir: rootDir,
            projectId,
            directorCommandId: directorCommand.id,
            preferDeterministicPlanning: true,
            signal,
            onProgress: async (event) => {
              emitAutopilotEvent(projectRoot, "writing_progress", event);
            }
          });
          const advanceCheckpoint2 = await writeAutopilotCheckpoint(projectRoot, advanced2, `advance-${advanced2.runtime.stage}`, {
            previousStage: beforeDiscussion.runtime.stage,
            advanceFirst: directorCommand.advanceFirst,
            directorCommandId: directorCommand.id
          });
          try {
            await upsertCheckpointInSuperGraph(projectRoot, {
              path: advanceCheckpoint2,
              label: `advance-${advanced2.runtime.stage}`
            }, {
              factoryRootDir: rootDir,
              projectId
            });
          } catch {
          }
          await markAutopilot(projectRoot, {
            checkpointPath: advanceCheckpoint2
          }, autopilotStateStore(rootDir, projectId));
          emitAutopilotEvent(projectRoot, "snapshot", {
            activeProjectId: projectId,
            projects,
            ...await createSnapshot(projectRoot, advanced2, { rootDir, projectId }),
            envStatus: getPublicProjectEnvStatus(rootDir)
          });
          const advancedFullyComplete2 = advanced2.runtime.stage === "complete" ? await isBookFullyComplete(rootDir, projectId, advanced2) : false;
          if (advancedFullyComplete2) {
            if (jobId) {
              await withFactoryDb(rootDir, async (db) => db.completeJob(jobId, leaseOwner)).catch(() => void 0);
            }
            await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
              resultingStage: advanced2.runtime.stage
            });
            break;
          }
          if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, advanced2)) {
            break;
          }
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
            resultingStage: advanced2.runtime.stage
          });
          networkRetryAttempt = 0;
          await backoffIfNoWorkflowProgress(rootDir, projectRoot, projectId, beforeDiscussion, advanced2, signal);
          continue;
        }
        const discussionMessage = directorCommand.message;
        nextMessage = "";
        correctionMessage = "";
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: beforeDiscussion.runtime.stage,
          message: `\u5F00\u59CB\u81EA\u52A8\u8BA8\u8BBA\uFF1A${discussionMessage}`
        });
        await markAutopilot(projectRoot, {
          lastStep: `discussion:${beforeDiscussion.runtime.stage}`,
          loopCount: currentLoopCount + 1,
          statusMessage: `\u81EA\u52A8\u8BA8\u8BBA\u4E2D\uFF1A${discussionMessage}`
        }, autopilotStateStore(rootDir, projectId));
        const discussion = await runMultiAgentDiscussion(projectRoot, discussionMessage, {
          envRootDir: rootDir,
          factoryRootDir: rootDir,
          projectId: projectId ?? void 0,
          directorCommandId: directorCommand.id,
          signal,
          onStreamEvent: async (event) => {
            emitAutopilotEvent(projectRoot, event.type, event);
          }
        });
        const afterDiscussion = await loadAutonomousState(projectRoot);
        const drift = evaluateAutopilotDrift({
          before: beforeDiscussion,
          after: afterDiscussion,
          discussionSummary: discussion.summary,
          intendedMessage: discussionMessage
        });
        const checkpointPath = await writeAutopilotCheckpoint(projectRoot, afterDiscussion, `loop-${currentLoopCount + 1}-${afterDiscussion.runtime.stage}`, {
          discussionTarget: discussion.target,
          drift,
          directorCommandId: directorCommand.id
        });
        try {
          await upsertCheckpointInSuperGraph(projectRoot, {
            path: checkpointPath,
            label: `loop-${currentLoopCount + 1}-${afterDiscussion.runtime.stage}`,
            drift
          }, {
            factoryRootDir: rootDir,
            projectId
          });
        } catch {
        }
        await markAutopilot(projectRoot, {
          driftScore: drift.score,
          driftStatus: drift.status,
          driftReason: drift.reason,
          checkpointPath,
          lastStep: `guard:${afterDiscussion.runtime.stage}`,
          statusMessage: drift.status === "ok" ? afterDiscussion.runtime.statusMessage : `\u81EA\u52A8\u521B\u4F5C\u5B88\u536B\u68C0\u6D4B\u5230\u76EE\u6807\u6F02\u79FB\uFF1A${drift.reason}`
        }, autopilotStateStore(rootDir, projectId));
        emitAutopilotEvent(projectRoot, "guard", {
          stage: afterDiscussion.runtime.stage,
          drift,
          checkpointPath
        });
        emitAutopilotEvent(projectRoot, "snapshot", {
          activeProjectId: projectId,
          projects,
          discussion,
          ...await createSnapshot(projectRoot, void 0, { rootDir, projectId }),
          envStatus: getPublicProjectEnvStatus(rootDir)
        });
        if (drift.status === "blocked") {
          const canAdvanceDespiteGuard = discussion.writebackSkipped && afterDiscussion.runtime.stage !== "complete";
          if (!canAdvanceDespiteGuard) {
            await markAutopilot(projectRoot, {
              running: false,
              stopRequested: true,
              mode: "idle",
              lastStep: "guard_blocked",
              statusMessage: `\u81EA\u52A8\u521B\u4F5C\u5DF2\u56E0\u4E25\u91CD\u76EE\u6807\u6F02\u79FB\u6682\u505C\uFF1A${drift.reason}`
            }, autopilotStateStore(rootDir, projectId));
            if (jobId) {
              await withFactoryDb(rootDir, async (db) => db.failJob(jobId, drift.reason, leaseOwner)).catch(() => void 0);
            }
            break;
          }
          await markAutopilot(projectRoot, {
            driftStatus: "correcting",
            lastStep: `guard_recoverable:${afterDiscussion.runtime.stage}`,
            statusMessage: `\u8BA8\u8BBA\u8F93\u51FA\u88AB\u9636\u6BB5\u5B88\u536B\u9694\u79BB\uFF0C\u672A\u5199\u5165\u751F\u4EA7\u5171\u8BC6\uFF1B\u65E0\u4EBA\u503C\u5B88\u6D41\u7A0B\u7EE7\u7EED\u6309\u72B6\u6001\u673A\u63A8\u8FDB\uFF1A${drift.reason}`
          }, autopilotStateStore(rootDir, projectId));
        }
        if (drift.status === "correcting") {
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
            resultingStage: afterDiscussion.runtime.stage,
            driftStatus: drift.status
          });
          correctionMessage = [
            "\u4E0A\u4E00\u8F6E\u51FA\u73B0\u76EE\u6807\u6F02\u79FB\uFF0C\u8BF7\u7ACB\u5373\u7EA0\u504F\u3002",
            `\u6F02\u79FB\u539F\u56E0\uFF1A${drift.reason}`,
            `\u539F\u59CB\u5C0F\u8BF4\u76EE\u6807\uFF1A${afterDiscussion.project.idea}`,
            `\u5F53\u524D\u9636\u6BB5\uFF1A${afterDiscussion.runtime.stage}`,
            "\u53EA\u5141\u8BB8\u56F4\u7ED5\u5F53\u524D\u9636\u6BB5\u548C\u5F53\u524D\u8D44\u4EA7\u7EE7\u7EED\uFF0C\u4E0D\u8981\u7B49\u5F85\u7528\u6237\u9009\u62E9\uFF0C\u4E0D\u8981\u8DF3\u5230\u65E0\u5173\u7AE0\u8282\u3002"
          ].join("\n");
          continue;
        }
        if (await shouldStopAutopilot(projectRoot, rootDir, projectId)) {
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
            resultingStage: afterDiscussion.runtime.stage,
            driftStatus: drift.status
          });
          break;
        }
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", directorCommand, {
          resultingStage: afterDiscussion.runtime.stage,
          driftStatus: drift.status
        });
        const followUpAdvanceCommand = createFollowUpAdvanceCommand(afterDiscussion, directorCommand);
        activeDirectorCommand = followUpAdvanceCommand;
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_DECIDED", followUpAdvanceCommand, {
          parentCommandId: directorCommand.id,
          driftStatus: drift.status
        });
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_STARTED", followUpAdvanceCommand, {
          parentCommandId: directorCommand.id
        });
        const isSemi = afterDiscussion.project?.autoMode === "semi";
        if (isSemi) {
          const pauseMessage = `\u8BA8\u8BBA\u5171\u8BC6\u5DF2\u5199\u56DE\uFF0C\u5DF2\u6682\u505C\u5728 ${afterDiscussion.runtime.stage} \u9636\u6BB5\uFF0C\u7B49\u5F85\u7528\u6237\u5BA1\u9605\u786E\u8BA4\u6210\u679C\u3002`;
          await markAutopilot(projectRoot, {
            running: false,
            stopRequested: false,
            mode: "idle",
            lastStep: "semi_auto_paused",
            statusMessage: pauseMessage
          }, autopilotStateStore(rootDir, projectId));
          if (jobId) {
            await withFactoryDb(rootDir, async (db) => db.pauseJob(jobId, leaseOwner)).catch(() => void 0);
          }
          emitAutopilotEvent(projectRoot, "autopilot_status", {
            stage: afterDiscussion.runtime.stage,
            message: pauseMessage
          });
          break;
        }
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: afterDiscussion.runtime.stage,
          message: followUpAdvanceCommand.reason
        });
        await markAutopilot(projectRoot, {
          lastStep: `advance:${afterDiscussion.runtime.stage}`,
          statusMessage: "\u8BA8\u8BBA\u7ED3\u8BBA\u5DF2\u5199\u56DE\uFF0C\u6B63\u5728\u81EA\u52A8\u63A8\u8FDB\u5DE5\u4F5C\u6D41\u3002"
        }, autopilotStateStore(rootDir, projectId));
        const advanced = await advanceAutonomousProject(projectRoot, {
          factoryRootDir: rootDir,
          projectId,
          directorCommandId: followUpAdvanceCommand.id,
          preferDeterministicPlanning: true,
          signal,
          onProgress: async (event) => {
            emitAutopilotEvent(projectRoot, "writing_progress", event);
          }
        });
        const advanceCheckpoint = await writeAutopilotCheckpoint(projectRoot, advanced, `advance-${advanced.runtime.stage}`, {
          previousStage: afterDiscussion.runtime.stage,
          directorCommandId: followUpAdvanceCommand.id,
          parentDirectorCommandId: directorCommand.id
        });
        try {
          await upsertCheckpointInSuperGraph(projectRoot, {
            path: advanceCheckpoint,
            label: `advance-${advanced.runtime.stage}`
          }, {
            factoryRootDir: rootDir,
            projectId
          });
        } catch {
        }
        await markAutopilot(projectRoot, {
          checkpointPath: advanceCheckpoint
        }, autopilotStateStore(rootDir, projectId));
        emitAutopilotEvent(projectRoot, "snapshot", {
          activeProjectId: projectId,
          projects,
          ...await createSnapshot(projectRoot, advanced, { rootDir, projectId }),
          envStatus: getPublicProjectEnvStatus(rootDir)
        });
        const advancedFullyComplete = advanced.runtime.stage === "complete" ? await isBookFullyComplete(rootDir, projectId, advanced) : false;
        if (advancedFullyComplete) {
          if (jobId) {
            await withFactoryDb(rootDir, async (db) => db.completeJob(jobId, leaseOwner)).catch(() => void 0);
          }
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", followUpAdvanceCommand, {
            resultingStage: advanced.runtime.stage,
            driftStatus: drift.status,
            parentCommandId: directorCommand.id
          });
          break;
        }
        if (await markAutopilotRecoveryBlocked(rootDir, projectRoot, projectId, jobId, leaseOwner, advanced)) {
          break;
        }
        await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_COMPLETED", followUpAdvanceCommand, {
          resultingStage: advanced.runtime.stage,
          driftStatus: drift.status,
          parentCommandId: directorCommand.id
        });
        networkRetryAttempt = 0;
        await backoffIfNoWorkflowProgress(rootDir, projectRoot, projectId, afterDiscussion, advanced, signal);
      } catch (error) {
        if (isAutopilotStopError(error) || signal.aborted) {
          throw error;
        }
        const transientKind = classifyTransientNetworkError(error);
        if (!transientKind) {
          throw error;
        }
        networkRetryAttempt += 1;
        const delayMs = nextNetworkRetryDelay(networkRetryAttempt, transientKind);
        const message = error instanceof Error ? error.message : String(error);
        const retryDescription = describeTransientNetworkError(transientKind);
        if (activeDirectorCommand) {
          await recordAutopilotDirectorCommandEvent(rootDir, projectId, "DIRECTOR_COMMAND_FAILED", activeDirectorCommand, {
            error: message,
            recoverable: true,
            retryAttempt: networkRetryAttempt,
            transientKind
          });
        }
        if (jobId) {
          await withFactoryDb(rootDir, async (db) => db.heartbeatJob(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS)).catch(() => null);
        }
        await markAutopilot(projectRoot, {
          running: true,
          stopRequested: false,
          mode,
          lastStep: "network_retry",
          driftStatus: "correcting",
          driftReason: message,
          statusMessage: `${retryDescription.statusPrefix}\uFF0C${Math.round(delayMs / 1e3)} \u79D2\u540E\u81EA\u52A8\u91CD\u8BD5\uFF1A${message}`
        }, autopilotStateStore(rootDir, projectId));
        emitAutopilotEvent(projectRoot, "network_retry", {
          attempt: networkRetryAttempt,
          retryInMs: delayMs,
          message,
          transientKind
        });
        emitAutopilotEvent(projectRoot, "autopilot_status", {
          stage: (await loadAutonomousState(projectRoot)).runtime.stage,
          message: `${retryDescription.eventMessage} \u7B2C ${networkRetryAttempt} \u6B21\u91CD\u8BD5\u3002`
        });
        await sleep(delayMs, signal);
        continue;
      }
    }
  } finally {
    stopLeaseHeartbeat();
    const latestState = await loadAutonomousState(projectRoot);
    const recoveryBlocked = findRecoveryBlockedTask(latestState);
    const fullyComplete = await isBookFullyComplete(rootDir, projectId, latestState);
    if (jobId && !fullyComplete && !recoveryBlocked) {
      await withFactoryDb(rootDir, async (db) => {
        const jobs = projectId ? db.listProjectJobs(projectId, "autopilot") : [];
        const currentJob = jobs.find((job) => job.id === jobId);
        if (currentJob?.status === "running") {
          db.pauseJob(jobId, leaseOwner);
        }
      }).catch(() => void 0);
    }
    const previousAutopilot = latestState.runtime.autopilot || {};
    const isSemiPaused = previousAutopilot.lastStep === "semi_auto_paused";
    const isGuardBlocked = previousAutopilot.lastStep === "guard_blocked";
    const isNetworkRetryPaused = previousAutopilot.lastStep === "network_retry_paused";
    const finalLastStep = isSemiPaused ? "semi_auto_paused" : isGuardBlocked ? "guard_blocked" : isNetworkRetryPaused ? "network_retry_paused" : recoveryBlocked ? "recovery_blocked" : "stopped";
    const finalStatusMessage = fullyComplete ? "\u81EA\u52A8\u521B\u4F5C\u5DF2\u5B8C\u6210\u5168\u90E8\u7AE0\u8282\u4EFB\u52A1\u3002" : recoveryBlocked ? `\u81EA\u52A8\u521B\u4F5C\u5DF2\u6682\u505C\uFF1A\u7B2C ${recoveryBlocked.chapterNumber} \u7AE0\u8FBE\u5230\u81EA\u52A8\u6062\u590D\u4E0A\u9650\uFF0C\u9700\u8981\u4EBA\u5DE5\u5BA1\u9605\u3002` : isSemiPaused || isGuardBlocked || isNetworkRetryPaused ? latestState.runtime.statusMessage || previousAutopilot.statusMessage || "\u81EA\u52A8\u521B\u4F5C\u5DF2\u505C\u6B62\uFF0C\u8FDB\u5EA6\u548C\u8BA8\u8BBA\u8BB0\u5F55\u5DF2\u4FDD\u5B58\u3002" : "\u81EA\u52A8\u521B\u4F5C\u5DF2\u505C\u6B62\uFF0C\u8FDB\u5EA6\u548C\u8BA8\u8BBA\u8BB0\u5F55\u5DF2\u4FDD\u5B58\u3002";
    const finalState = await markAutopilot(projectRoot, {
      running: false,
      stopRequested: false,
      lastStep: finalLastStep,
      mode: "idle",
      driftStatus: recoveryBlocked ? "blocked" : latestState.runtime.autopilot?.driftStatus,
      driftReason: recoveryBlocked ? `\u7B2C ${recoveryBlocked.chapterNumber} \u7AE0\u8FBE\u5230\u81EA\u52A8\u6062\u590D\u4E0A\u9650\u3002` : latestState.runtime.autopilot?.driftReason,
      statusMessage: finalStatusMessage
    }, autopilotStateStore(rootDir, projectId));
    emitAutopilotEvent(projectRoot, "complete", {
      activeProjectId: projectId,
      projects,
      ...await createSnapshot(projectRoot, finalState, { rootDir, projectId }),
      envStatus: getPublicProjectEnvStatus(rootDir)
    });
  }
}
async function markInterruptedWritingProgress(rootDir, projectId, state, reason) {
  if (!projectId) {
    return;
  }
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "in_progress");
  if (!task) {
    return;
  }
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  const messageId = `writing-${task.chapterNumber}-autopilot-aborted`;
  await withFactoryDb(rootDir, async (db) => {
    db.recordEvent(projectId, null, "WRITING_PROGRESS", {
      messageId,
      step: "autopilot_aborted",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "failed",
      phase: "failed",
      statusText: "\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u88AB\u4E2D\u65AD\uFF0C\u7B49\u5F85\u6062\u590D\u540E\u91CD\u65B0\u6267\u884C\u3002",
      message: `\u7B2C ${task.chapterNumber} \u7AE0\u7684\u5F53\u524D\u6A21\u578B\u8BF7\u6C42\u5DF2\u4E2D\u65AD\uFF1A${reason}`,
      timestamp: now2
    });
    db.markStreamingMessagesFailed(projectId, {
      conversationId: `writing:${projectId}`,
      chapterNumber: task.chapterNumber,
      reason
    });
  }).catch(() => void 0);
}
function ensureAutopilotJob(options) {
  const existing = autopilotJobs.get(options.projectRoot);
  if (existing) {
    if (!options.jobId || existing.jobId === options.jobId) {
      return existing;
    }
    if (!existing.jobId) {
      autopilotJobs.delete(options.projectRoot);
    } else {
      return existing;
    }
  }
  const controller = new AbortController();
  const job = {
    projectRoot: options.projectRoot,
    jobId: options.jobId,
    controller,
    listeners: /* @__PURE__ */ new Set(),
    promise: Promise.resolve()
  };
  job.promise = runAutopilotBackground(options, controller).catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (controller.signal.aborted || isAutopilotStopError(error)) {
      const latestState = await loadAutonomousState(options.projectRoot).catch(() => null);
      if (latestState) {
        await markInterruptedWritingProgress(options.rootDir, options.projectId, latestState, message);
      }
      if (options.jobId) {
        await withFactoryDb(options.rootDir, async (db) => {
          const jobs = options.projectId ? db.listProjectJobs(options.projectId, "autopilot") : [];
          const currentJob = jobs.find((entry) => entry.id === options.jobId);
          if (currentJob?.status === "running" || currentJob?.status === "paused") {
            db.pauseJob(options.jobId);
          }
        }).catch(() => void 0);
      }
      await markAutopilot(options.projectRoot, {
        running: false,
        stopRequested: false,
        mode: "idle",
        lastStep: "stopped",
        statusMessage: "\u81EA\u52A8\u521B\u4F5C\u5DF2\u6682\u505C\uFF0C\u5F53\u524D\u6A21\u578B\u8BF7\u6C42\u5DF2\u4E2D\u65AD\uFF1B\u4EFB\u52A1\u4ECD\u53EF\u4ECE\u6570\u636E\u5E93\u6062\u590D\u3002"
      }, autopilotStateStore(options.rootDir, options.projectId));
      emitAutopilotEvent(options.projectRoot, "complete", { stopped: true });
      return;
    }
    if (isTransientNetworkError(error)) {
      const transientKind = classifyTransientNetworkError(error) || "connection";
      const retryDescription = describeTransientNetworkError(transientKind);
      if (options.jobId) {
        await withFactoryDb(options.rootDir, async (db) => db.pauseJob(options.jobId)).catch(() => void 0);
      }
      await markAutopilot(options.projectRoot, {
        running: false,
        stopRequested: false,
        mode: "idle",
        lastStep: "network_retry_paused",
        driftStatus: "correcting",
        driftReason: message,
        statusMessage: `${retryDescription.statusPrefix}\uFF0C\u65E0\u4EBA\u503C\u5B88\u4EFB\u52A1\u5DF2\u4FDD\u7559\u4E3A\u53EF\u6062\u590D\u72B6\u6001\uFF1A${message}`
      }, autopilotStateStore(options.rootDir, options.projectId));
      emitAutopilotEvent(options.projectRoot, "network_retry_paused", { error: message, transientKind });
      return;
    }
    if (options.jobId) {
      await withFactoryDb(options.rootDir, async (db) => db.failJob(options.jobId, message)).catch(() => void 0);
    }
    await markAutopilot(options.projectRoot, {
      running: false,
      stopRequested: false,
      mode: "idle",
      lastStep: "error",
      driftStatus: "blocked",
      driftReason: message,
      statusMessage: `\u81EA\u52A8\u521B\u4F5C\u8FD0\u884C\u5931\u8D25\uFF1A${message}`
    }, autopilotStateStore(options.rootDir, options.projectId));
    emitAutopilotEvent(options.projectRoot, "error", { error: message });
  }).finally(() => {
    autopilotJobs.delete(options.projectRoot);
  });
  autopilotJobs.set(options.projectRoot, job);
  return job;
}
async function runKnowledgeJobs(rootDir) {
  await backfillPendingKnowledgeEmbeddings(rootDir, { limit: 100 }).catch(() => void 0);
  const projects = await listAutonomousProjects(rootDir).catch(() => []);
  await ensureKnowledgeBootstrapJobs(rootDir, projects);
  const jobs = await withFactoryDb(
    rootDir,
    async (db) => db.listRunnableJobs(void 0, /* @__PURE__ */ new Date(), { includeIdle: true }).filter((job) => String(job.kind || "").startsWith("knowledge_"))
  ).catch(() => []);
  const owner = makeWorkerOwner();
  for (const job of jobs) {
    if (typeof job.id !== "string") {
      continue;
    }
    const claimed = await withFactoryDb(
      rootDir,
      async (db) => db.claimJob(job.id, owner, KNOWLEDGE_JOB_LEASE_SECONDS, /* @__PURE__ */ new Date(), { includeIdle: true })
    ).catch(() => null);
    if (!claimed) {
      continue;
    }
    const payload = typeof claimed.payload === "object" && claimed.payload ? claimed.payload : {};
    try {
      if (claimed.kind === "knowledge_global_bootstrap" || claimed.kind === "knowledge_global_reindex") {
        const limit = Number(payload.limit);
        await ingestGlobalWritingResources(rootDir, {
          limit: Number.isFinite(limit) && limit > 0 ? limit : void 0
        });
      } else if (claimed.kind === "knowledge_project_artifact") {
        const projectId = typeof claimed.project_id === "string" ? claimed.project_id : typeof payload.projectId === "string" ? payload.projectId : "";
        const project = projects.find((entry) => entry.id === projectId);
        const artifactPath = typeof payload.artifactPath === "string" ? payload.artifactPath : "";
        if (!project || !artifactPath) {
          throw new Error("knowledge_project_artifact job is missing project or artifactPath");
        }
        const projectRoot = await resolveManagedProjectRoot(rootDir, project.id);
        await ingestProjectArtifact({
          rootDir,
          projectId: project.id,
          projectRoot,
          artifactPath,
          kind: typeof payload.kind === "string" ? payload.kind : "artifact",
          metadata: typeof payload.metadata === "object" && payload.metadata ? payload.metadata : {}
        });
      }
      await withFactoryDb(rootDir, async (db) => db.completeJob(claimed.id, owner)).catch(() => void 0);
    } catch (error) {
      await withFactoryDb(
        rootDir,
        async (db) => db.failJob(claimed.id, error instanceof Error ? error.message : String(error), owner)
      ).catch(() => void 0);
    }
  }
}
async function restoreAutopilotJobs(rootDir, createSnapshot) {
  await backfillPendingMemoryEmbeddings(rootDir, { limit: 50 }).catch(() => void 0);
  await runKnowledgeJobs(rootDir).catch(() => void 0);
  const projects = await listAutonomousProjects(rootDir);
  const jobs = await withFactoryDb(rootDir, async (db) => {
    db.pruneProjectsExcept(projects.map((project) => project.id));
    db.recoverStaleRuns();
    return db.listRunnableJobs("autopilot");
  }).catch(() => []);
  if (!jobs.length) {
    return;
  }
  const seenProjectIds = /* @__PURE__ */ new Set();
  for (const job of jobs) {
    const projectId = typeof job.project_id === "string" ? job.project_id : null;
    const project = projectId ? projects.find((entry) => entry.id === projectId) : null;
    if (!project || typeof job.id !== "string") {
      continue;
    }
    if (seenProjectIds.has(project.id)) {
      await withFactoryDb(rootDir, async (db) => {
        db.cancelJob(job.id);
        db.recordEvent(project.id, typeof job.run_id === "string" ? job.run_id : null, "JOB_DEDUPED", {
          id: job.id,
          kind: job.kind,
          reason: "Another autopilot job is already scheduled for restore."
        });
      }).catch(() => void 0);
      continue;
    }
    seenProjectIds.add(project.id);
    if (process.env.AI_NOVEL_TEST_MODE === "1" && process.env.AI_NOVEL_TEST_FORCE_WORKER !== "1") {
      await withFactoryDb(rootDir, async (db) => {
        db.recordEvent(project.id, typeof job.run_id === "string" ? job.run_id : null, "JOB_RESTORE_READY", {
          id: job.id,
          kind: job.kind,
          status: job.status,
          leaseExpiresAt: job.lease_expires_at ?? null
        });
      }).catch(() => void 0);
      continue;
    }
    const projectRoot = await resolveManagedProjectRoot(rootDir, project.id).catch(() => null);
    if (!projectRoot || autopilotJobs.has(projectRoot)) {
      continue;
    }
    const state = await loadAutonomousState(projectRoot).catch(() => null);
    const autopilot = state?.runtime?.autopilot || null;
    const payload = typeof job.payload === "object" && job.payload ? job.payload : {};
    const message = typeof payload.message === "string" ? payload.message : "";
    const hasWakeupSignal = isGenericAutopilotMessage(message);
    const manuallyPaused = Boolean(
      autopilot && !autopilot.running && (autopilot.stopRequested || autopilot.lastStep === "stopped" || autopilot.lastStep === "semi_auto_paused" && !hasWakeupSignal)
    );
    if (manuallyPaused) {
      continue;
    }
    ensureAutopilotJob({
      rootDir,
      projectRoot,
      projectId: project.id,
      projects,
      initialMessage: message,
      mode: "background",
      jobId: job.id,
      createSnapshot
    });
  }
}
async function startAutopilotWorkerRuntime(options) {
  await restoreAutopilotJobs(options.rootDir, options.createSnapshot);
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return {
      close: () => void 0
    };
  }
  const timer = setInterval(() => {
    void restoreAutopilotJobs(options.rootDir, options.createSnapshot);
  }, options.pollMs ?? AUTOPILOT_RESTORE_POLL_MS);
  return {
    close: () => clearInterval(timer)
  };
}

// src/worker.ts
function parseFlags(argv) {
  const flags = /* @__PURE__ */ new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, "true");
      continue;
    }
    flags.set(key, next);
    index += 1;
  }
  return {
    rootDir: import_node_path11.default.resolve(flags.get("root-dir") || process.cwd()),
    pollMs: flags.get("poll-ms") ? Number.parseInt(flags.get("poll-ms") || "60000", 10) : void 0,
    status: flags.get("status") === "true",
    once: flags.get("once") === "true"
  };
}
function serializeState(state) {
  if (!state) return null;
  return {
    project: state.project,
    runtime: state.runtime,
    reactSetup: state.reactSetup,
    plan: state.plan,
    assets: state.assets
  };
}
async function createWorkerWorkspacePayload(projectRoot, state, options = {}) {
  const factorySnapshot = options.rootDir && options.projectId ? await withFactoryDb(options.rootDir, async (db) => db.getSnapshot(options.projectId)).catch(() => null) : null;
  const resolvedState = factorySnapshot?.state ?? state ?? null;
  return {
    state: serializeState(resolvedState),
    transcript: "",
    consensus: "",
    contextPacket: "",
    graphIndex: null,
    graphViolations: [],
    factorySnapshot,
    projectRoot
  };
}
async function startNovelAutopilotWorker(options) {
  return startAutopilotWorkerRuntime({
    rootDir: options.rootDir,
    pollMs: options.pollMs,
    createSnapshot: createWorkerWorkspacePayload
  });
}
async function getNovelAutopilotWorkerStatus(rootDir) {
  const factory = await withFactoryDb(rootDir, async (db) => db.getOperationalStatus());
  return {
    ok: true,
    service: "ai-novel-worker",
    rootDir,
    factory,
    envStatus: getPublicProjectEnvStatus(rootDir)
  };
}
async function runNovelAutopilotWorkerOnce(rootDir) {
  await restoreAutopilotJobs(rootDir, createWorkerWorkspacePayload);
  return getNovelAutopilotWorkerStatus(rootDir);
}
async function runNovelAutopilotWorkerCli(args = process.argv.slice(2)) {
  const flags = parseFlags(args);
  if (flags.status) {
    console.log(JSON.stringify(await getNovelAutopilotWorkerStatus(flags.rootDir), null, 2));
    return;
  }
  if (flags.once) {
    console.log(JSON.stringify(await runNovelAutopilotWorkerOnce(flags.rootDir), null, 2));
    return;
  }
  await startNovelAutopilotWorker({
    rootDir: flags.rootDir,
    pollMs: flags.pollMs
  });
  console.log(`AI Novel Autopilot worker running for workspace: ${flags.rootDir}`);
  console.log(`Provider: ${getProjectEnvStatus(flags.rootDir).resolved.modelName || "not configured"}`);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createWorkerWorkspacePayload,
  getNovelAutopilotWorkerStatus,
  runNovelAutopilotWorkerCli,
  runNovelAutopilotWorkerOnce,
  startNovelAutopilotWorker
});
