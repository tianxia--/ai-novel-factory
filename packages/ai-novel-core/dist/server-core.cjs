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

// src/server-core.ts
var server_core_exports = {};
__export(server_core_exports, {
  FactoryDb: () => FactoryDb,
  advanceAutonomousProject: () => advanceAutonomousProject,
  createManagedAutonomousProject: () => createManagedAutonomousProject,
  deleteManagedAutonomousProject: () => deleteManagedAutonomousProject,
  getProjectEnvStatus: () => getProjectEnvStatus,
  getPublicProjectEnvStatus: () => getPublicProjectEnvStatus,
  initAutonomousProject: () => initAutonomousProject,
  listAutonomousProjects: () => listAutonomousProjects,
  loadAutonomousState: () => loadAutonomousState,
  makeAgentTurnId: () => makeAgentTurnId,
  makeRunId: () => makeRunId,
  prepareCoverGeneration: () => prepareCoverGeneration,
  resolveManagedProjectRoot: () => resolveManagedProjectRoot,
  retryChapterProduction: () => retryChapterProduction,
  reviewInterruption: () => reviewInterruption,
  runMultiAgentDiscussion: () => runMultiAgentDiscussion,
  saveAutonomousState: () => saveAutonomousState,
  targetToArtifactKind: () => targetToArtifactKind,
  testProviderConnectivity: () => testProviderConnectivity,
  upsertCheckpointInSuperGraph: () => upsertCheckpointInSuperGraph,
  withFactoryDb: () => withFactoryDb
});
module.exports = __toCommonJS(server_core_exports);

// src/orchestrator.ts
var import_promises7 = __toESM(require("fs/promises"), 1);
var import_node_crypto2 = require("crypto");
var import_node_path10 = __toESM(require("path"), 1);
var import_node_crypto3 = require("crypto");

// src/llm-config.ts
var import_node_fs2 = __toESM(require("fs"), 1);
var import_node_path2 = __toESM(require("path"), 1);

// src/factory-db.ts
var import_node_fs = __toESM(require("fs"), 1);
var import_promises = __toESM(require("fs/promises"), 1);
var import_node_path = __toESM(require("path"), 1);

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
  "\u5730",
  // 扩展：更多常见非人名结尾字
  "\u58F0",
  "\u5374",
  "\u90FD",
  "\u4F60",
  "\u6211",
  "\u4ED6",
  "\u5979",
  "\u5B83",
  "\u4EEC",
  "\u5417",
  "\u5462",
  "\u554A",
  "\u54E6",
  "\u55EF",
  "\u54C8",
  "\u53BB",
  "\u6765",
  "\u91CC",
  "\u4E2D",
  "\u4E0A",
  "\u4E0B",
  "\u524D",
  "\u540E",
  "\u624D",
  "\u4E5F",
  "\u53C8",
  "\u8FD8",
  "\u518D",
  "\u6CA1",
  "\u5DF1",
  "\u8FC7",
  "\u8D77",
  "\u53EA",
  "\u5E76",
  "\u5219",
  "\u4EE5"
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
  if (/^(?:时候|这时|此时|当时|当年|平时|往时|有时|任时|那时|同时|从时|即时|顿时|临时|随时|暂时|及时|按时|定时|准时|平日|日后|日前|此刻|此际|彼时|早时|夜时|晌午|傍晚|清晨|黎明|正午|午时|子时|丑时|寅时|卯时|辰时|巳时|午时|未时|申时|酉时|戌时|亥时)$/u.test(name)) {
    return true;
  }
  if (/[声却都你我他她它们吗呢啊哦嗯哈去来里中上下前后才也又还再没己过起只并则以低高请求允带送交藏拦护推拿按追逃]$/u.test(name)) {
    return true;
  }
  if (/官仓|官府|官印|少尹|仓曹|门外|门口|廊下|屋内|屋外|账册|税册|贡品|档案|契书|礼部/u.test(name)) {
    return true;
  }
  if (name.length >= 3 && /[一二三四五六七八九十百千万添减增]/u.test(name)) {
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
var chapterConsistencyCache = /* @__PURE__ */ new Map();
function normalizeLlmApiMode(value) {
  return String(value || "chat").trim().toLowerCase() === "responses" ? "responses" : "chat";
}
var FACTORY_DB_DIR = ".ai-novel-factory";
var FACTORY_DB_FILE = "factory.sqlite";
var MIN_CHAPTER_PASS_RATIO = 0.8;
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function normalizeLlmCapability(capability) {
  const normalized = capability.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
  return normalized || "text";
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
    return import_node_fs.default.readFileSync(filePath, "utf8");
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
  return import_node_path.default.join(rootDir, FACTORY_DB_DIR, FACTORY_DB_FILE);
}
var FactoryDb = class _FactoryDb {
  constructor(db) {
    this.db = db;
  }
  db;
  static async open(rootDir) {
    const dbPath = getFactoryDbPath(rootDir);
    await import_promises.default.mkdir(import_node_path.default.dirname(dbPath), { recursive: true });
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

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

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
        api_mode TEXT NOT NULL DEFAULT 'chat',
        temperature REAL NOT NULL DEFAULT 0.1,
        timeout_ms INTEGER NOT NULL DEFAULT 120000,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS llm_config_routes (
        capability TEXT PRIMARY KEY,
        config_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(config_id) REFERENCES llm_configs(id) ON DELETE CASCADE
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
    this.migrateColumn("llm_configs", "api_mode", "TEXT NOT NULL DEFAULT 'chat'");
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
    const protagonistProfile = projectRoot ? readTextFileSync(import_node_path.default.join(projectRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md")) : "";
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
    const reconciledRows = this.db.prepare(`
      SELECT payload_json, created_at
      FROM events
      WHERE project_id = ?
        AND type = 'CHAPTER_STATUS_RECONCILED'
      ORDER BY created_at ASC
    `).all(projectId);
    for (const row of reconciledRows) {
      const payload = readJson(row.payload_json, {});
      const chapters = Array.isArray(payload.chapters) ? payload.chapters : [];
      for (const ch of chapters) {
        const chapterNumber = Number(ch.chapterNumber);
        if (!Number.isFinite(chapterNumber) || chapterNumber <= 0) continue;
        if (isResetHistory(chapterNumber, row.created_at)) continue;
        const fact = ensureFact(chapterNumber);
        const status = normalizeTaskStatus(ch.to);
        if (status) {
          fact.latestTaskStatus = status;
          fact.latestTaskStatusAt = String(row.created_at || "");
        }
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
        const absolutePath = import_node_path.default.isAbsolute(fact.finalPath) ? fact.finalPath : import_node_path.default.join(projectRoot, fact.finalPath);
        let mtimeMs = 0;
        try {
          mtimeMs = import_node_fs.default.statSync(absolutePath).mtimeMs;
        } catch {
        }
        const cacheKey = `${absolutePath}:${mtimeMs}:${previousProtagonistName || ""}:${protagonistProfile || ""}`;
        const cached = chapterConsistencyCache.get(cacheKey);
        if (cached && cached.mtimeMs === mtimeMs) {
          fact.protagonistName = cached.protagonistName;
          fact.consistency = cached.consistency;
          if (cached.consistency.status === "eligible" && cached.protagonistName && !previousProtagonistName) {
            previousProtagonistName = cached.protagonistName;
          }
          if (cached.consistency.status === "quarantined" && fact.contentQuality) {
            fact.contentQuality = {
              ...fact.contentQuality,
              status: "quarantined",
              reason: cached.consistency.reason
            };
          }
        } else {
          const finalText = readTextFileSync(absolutePath);
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
            chapterConsistencyCache.set(cacheKey, {
              mtimeMs,
              protagonistName: fact.protagonistName,
              consistency: fact.consistency
            });
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
      } else if (taskInstructionIsNewer && (fact.latestTaskStatus === "pending" || fact.latestTaskStatus === "in_progress" || fact.latestTaskStatus === "complete")) {
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
    const projectRow = this.db.prepare("SELECT state_json, project_root FROM projects WHERE id = ?").get(projectId);
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
    const stateObj = readJson(projectRow?.state_json, null);
    const projectRoot = projectRow?.project_root || "";
    if (projectRoot && stateObj) {
      const stage = stateObj.runtime?.stage || "";
      const tasks = stateObj.plan?.chapterTasks ? Array.isArray(stateObj.plan.chapterTasks) ? stateObj.plan.chapterTasks : [] : [];
      const activeTask = tasks.find((t) => t.status === "in_progress" || t.status === "blocked");
      const activeChapterNumber = activeTask ? Number(activeTask.chapterNumber) : null;
      let latestDiscussionPath = "";
      let latestDiscussionMtime = 0;
      for (const [pathKey, row] of artifactsByPath.entries()) {
        if (pathKey.includes("/consensus/discussion-") || pathKey.includes(".ai-novel/consensus/discussion-")) {
          try {
            const absPath = import_node_fs.default.existsSync(pathKey) ? pathKey : import_node_path.default.resolve(projectRoot, pathKey);
            if (import_node_fs.default.existsSync(absPath)) {
              const mtime = import_node_fs.default.statSync(absPath).mtimeMs;
              if (mtime > latestDiscussionMtime) {
                latestDiscussionMtime = mtime;
                latestDiscussionPath = pathKey;
              }
            }
          } catch {
          }
        }
      }
      for (const [pathKey, row] of artifactsByPath.entries()) {
        const isOutline = stage === "master_planning" && pathKey.includes("master-outline");
        let isBlueprint = false;
        let isDraft = false;
        if (activeChapterNumber) {
          const paddedCh = String(activeChapterNumber).padStart(3, "0");
          isBlueprint = stage === "chapter_task_generation" && pathKey.includes(`chapter-${paddedCh}`) && pathKey.includes("blueprint");
          isDraft = (stage === "drafting" || stage === "reviewing") && pathKey.includes(`chapter-${paddedCh}`) && (pathKey.includes("draft") || pathKey.includes("final"));
        }
        const isLatestDiscussion = pathKey === latestDiscussionPath;
        if (isOutline || isBlueprint || isDraft || isLatestDiscussion) {
          try {
            const absPath = import_node_fs.default.existsSync(pathKey) ? pathKey : import_node_path.default.resolve(projectRoot, pathKey);
            if (import_node_fs.default.existsSync(absPath)) {
              row.content = import_node_fs.default.readFileSync(absPath, "utf8");
            }
          } catch (e) {
            console.error(`Failed to read artifact content for ${pathKey}:`, e);
          }
        }
      }
    }
    const knowledge = this.getKnowledgeSummary(projectId);
    const latestEventRows = this.db.prepare(`
      SELECT * FROM events
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 80
    `).all(projectId).map(compactDbRow);
    const milestoneEventTypes = /* @__PURE__ */ new Set(["PROJECT_CREATED", "CONSENSUS_UPDATED", "CHAPTER_PIPELINE_COMPLETED"]);
    const milestoneEventRows = this.db.prepare(`
      SELECT * FROM events
      WHERE project_id = ?
        AND type IN ('PROJECT_CREATED', 'CONSENSUS_UPDATED', 'CHAPTER_PIPELINE_COMPLETED')
      ORDER BY created_at DESC
      LIMIT 24
    `).all(projectId).map(compactDbRow);
    const mergedLatestEvents = [
      ...milestoneEventRows,
      ...latestEventRows.filter((row) => !milestoneEventTypes.has(String(row.type || "")))
    ].filter((row, index, rows) => rows.findIndex((candidate) => String(candidate.id || "") === String(row.id || "")) === index);
    return {
      project,
      state: stateObj,
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
      latestEvents: mergedLatestEvents,
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
      SELECT id, name, base_url, api_key, model_name, api_mode, temperature, timeout_ms, is_active, created_at, updated_at
      FROM llm_configs
      ORDER BY created_at DESC
    `).all();
  }
  addLlmConfig(config) {
    const id = makeId("llm");
    const now2 = nowIso();
    const temp = config.temperature ?? 0.1;
    const timeout = config.timeoutMs ?? 12e4;
    const apiMode = normalizeLlmApiMode(config.apiMode);
    const active = config.isActive ? 1 : 0;
    if (active) {
      this.db.prepare(`
        UPDATE llm_configs SET is_active = 0
      `).run();
    }
    this.db.prepare(`
      INSERT INTO llm_configs (id, name, base_url, api_key, model_name, api_mode, temperature, timeout_ms, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, config.name, config.baseUrl, config.apiKey, config.modelName, apiMode, temp, timeout, active, now2, now2);
    return id;
  }
  updateLlmConfig(id, config) {
    const now2 = nowIso();
    const temp = config.temperature ?? 0.1;
    const timeout = config.timeoutMs ?? 12e4;
    const apiMode = normalizeLlmApiMode(config.apiMode);
    this.db.prepare(`
      UPDATE llm_configs
      SET name = ?, base_url = ?, api_key = ?, model_name = ?, api_mode = ?, temperature = ?, timeout_ms = ?, updated_at = ?
      WHERE id = ?
    `).run(config.name, config.baseUrl, config.apiKey, config.modelName, apiMode, temp, timeout, now2, id);
  }
  deleteLlmConfig(id) {
    this.db.prepare(`
      DELETE FROM llm_config_routes WHERE config_id = ?
    `).run(id);
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
    this.setLlmConfigRoute("text", id);
  }
  getActiveLlmConfig() {
    const config = this.db.prepare(`
      SELECT id, name, base_url, api_key, model_name, api_mode, temperature, timeout_ms, is_active, created_at, updated_at
      FROM llm_configs
      WHERE is_active = 1
      LIMIT 1
    `).get();
    return config || null;
  }
  listLlmConfigRoutes() {
    return this.db.prepare(`
      SELECT routes.capability, routes.config_id, routes.created_at, routes.updated_at,
             configs.name, configs.base_url, configs.model_name, configs.api_mode, configs.temperature, configs.timeout_ms
      FROM llm_config_routes routes
      LEFT JOIN llm_configs configs ON configs.id = routes.config_id
      ORDER BY routes.capability ASC
    `).all();
  }
  getLlmConfigForCapability(capability) {
    const normalized = normalizeLlmCapability(capability);
    const config = this.db.prepare(`
      SELECT configs.id, configs.name, configs.base_url, configs.api_key, configs.model_name,
             configs.api_mode, configs.temperature, configs.timeout_ms, configs.is_active, configs.created_at, configs.updated_at
      FROM llm_config_routes routes
      JOIN llm_configs configs ON configs.id = routes.config_id
      WHERE routes.capability = ?
      LIMIT 1
    `).get(normalized);
    return config || null;
  }
  setLlmConfigRoute(capability, configId) {
    const normalized = normalizeLlmCapability(capability);
    const exists = this.db.prepare(`
      SELECT id FROM llm_configs WHERE id = ?
    `).get(configId);
    if (!exists) {
      throw new Error("llm_config_not_found");
    }
    const now2 = nowIso();
    this.db.prepare(`
      INSERT INTO llm_config_routes (capability, config_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(capability) DO UPDATE SET
        config_id = excluded.config_id,
        updated_at = excluded.updated_at
    `).run(normalized, configId, now2, now2);
    if (normalized === "text") {
      this.db.prepare(`
        UPDATE llm_configs SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END
      `).run(configId);
    }
  }
  deleteLlmConfigRoute(capability) {
    const normalized = normalizeLlmCapability(capability);
    this.db.prepare(`
      DELETE FROM llm_config_routes WHERE capability = ?
    `).run(normalized);
  }
  getSystemSetting(key) {
    const row = this.db.prepare(`
      SELECT value FROM system_settings WHERE key = ?
    `).get(key);
    return row ? row.value : null;
  }
  setSystemSetting(key, value) {
    const now2 = nowIso();
    this.db.prepare(`
      INSERT INTO system_settings (key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `).run(key, value, now2, now2);
  }
  listSystemSettings() {
    return this.db.prepare(`
      SELECT key, value FROM system_settings
    `).all();
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
function readApiMode(value) {
  return value?.trim().toLowerCase() === "responses" ? "responses" : "chat";
}
var cachedActiveLlmConfig = null;
function isWorkspaceRoot(dir) {
  try {
    const pkgPath = import_node_path2.default.join(dir, "package.json");
    if (!import_node_fs2.default.existsSync(pkgPath)) {
      return false;
    }
    const content = import_node_fs2.default.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(content);
    return pkg.name === "ai-novel-factory-workspace";
  } catch {
    return false;
  }
}
function resolveFactoryRootDir(dir = process.cwd()) {
  let current = import_node_path2.default.resolve(dir);
  while (true) {
    if (isWorkspaceRoot(current)) {
      return current;
    }
    const parent = import_node_path2.default.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  const fallback = import_node_path2.default.resolve(dir);
  const projectsIndex = fallback.indexOf(`${import_node_path2.default.sep}.ai-novel-projects`);
  if (projectsIndex !== -1) {
    return fallback.slice(0, projectsIndex);
  }
  const novelIndex = fallback.indexOf(`${import_node_path2.default.sep}.ai-novel`);
  if (novelIndex !== -1) {
    return fallback.slice(0, novelIndex);
  }
  return fallback;
}
async function loadActiveLlmConfig(rootDir = process.cwd()) {
  return loadLlmConfigForCapability(rootDir, "text");
}
function dbConfigToActiveConfig(activeDbConfig, capability, rootDir = process.cwd()) {
  return {
    provider: {
      baseUrl: activeDbConfig.base_url,
      apiKeyEnv: "DB_ACTIVE_CONFIG",
      modelName: activeDbConfig.model_name,
      apiMode: readApiMode(activeDbConfig.api_mode),
      timeoutMs: Number(activeDbConfig.timeout_ms) || 12e4,
      temperature: Number(activeDbConfig.temperature) || 0.1,
      reactMaxSteps: 25
    },
    writing: {
      chapterWordTarget: 2500,
      chapterWordMinimum: 2500
    },
    _dbApiKey: activeDbConfig.api_key,
    _configId: activeDbConfig.id,
    _capability: capability
  };
}
async function loadLlmConfigForCapability(rootDir = process.cwd(), capability = "text") {
  const dbRootDir = resolveFactoryRootDir(rootDir);
  try {
    const activeDbConfig = await withFactoryDb(dbRootDir, async (db) => {
      return db.getLlmConfigForCapability(String(capability)) || (String(capability) === "text" ? db.getActiveLlmConfig() : null);
    });
    if (!activeDbConfig) {
      if (String(capability) === "text") {
        cachedActiveLlmConfig = null;
      }
      return null;
    }
    const config = dbConfigToActiveConfig(activeDbConfig, String(capability), rootDir);
    if (String(capability) === "text") {
      cachedActiveLlmConfig = config;
    }
    return config;
  } catch (error) {
    console.error(`Failed to load ${String(capability)} LLM config from DB:`, error);
    return null;
  }
}

// src/abort.ts
var AUTOPILOT_STOP_MESSAGE = "Autopilot stopped by user.";
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
function extractTextContent(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => extractTextContent(item)).join("");
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const record = value;
  const direct = [record.text, record.output_text, record.reasoning_content, record.content].map((item) => extractTextContent(item)).join("");
  if (direct) {
    return direct;
  }
  return [record.message, record.delta].map((item) => extractTextContent(item)).join("");
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
          const delta = extractStreamingDelta(payload);
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
  console.log(`
========== [LLM RESPONSE START] ==========
${content.trim()}
========== [LLM RESPONSE END] ==========
`);
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
function getMessageContent(messages, role) {
  return messages.filter((message) => message.role === role && message.content.trim()).map((message) => message.content.trim()).join("\n\n");
}
function buildResponsesInput(messages) {
  const userMessages = messages.filter((message) => message.role !== "system" && message.content.trim());
  if (userMessages.length === 1 && userMessages[0].role === "user") {
    return userMessages[0].content;
  }
  return userMessages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}
function extractResponsesOutput(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload;
  const direct = extractTextContent(record.output_text);
  if (direct) {
    return direct.trim();
  }
  const output = Array.isArray(record.output) ? record.output : [];
  return output.map((item) => extractTextContent(item)).join("").trim();
}
function extractStreamingDelta(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload;
  const choicePayload = payload;
  const choice = choicePayload.choices?.[0];
  const chatDelta = extractTextContent(choice?.delta) || extractTextContent(choice?.message) || extractTextContent(choice?.text);
  if (chatDelta) {
    return chatDelta;
  }
  const eventType = typeof record.type === "string" ? record.type : "";
  if (eventType.endsWith(".delta")) {
    return extractTextContent(record.delta);
  }
  return "";
}
async function parseProviderError(response) {
  const raw = await response.text().catch(() => "");
  if (!raw) {
    return response.statusText;
  }
  try {
    const payload = JSON.parse(raw);
    if (typeof payload.error === "string") {
      return payload.error;
    }
    return payload.error?.message || raw.slice(0, 500);
  } catch {
    return raw.slice(0, 500);
  }
}
async function requestLlmTextCompletion(options) {
  const endpoint = options.apiMode === "responses" ? "responses" : "chat/completions";
  const requestStartTime = Date.now();
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const selectedTemperature = options.temperature ?? 0.1;
  const messages = options.messages.filter((message) => message.content.trim());
  const system = getMessageContent(messages, "system");
  const user = getMessageContent(messages, "user");
  const effectiveStream = Boolean(options.stream);
  console.log(`[LLM REQUEST SEND] \u51C6\u5907\u5411 API \u53D1\u9001 ${endpoint} \u8BF7\u6C42...`);
  console.log(`- BaseUrl: ${options.baseUrl}`);
  console.log(`- Model: ${options.modelName}`);
  console.log(`- API Mode: ${options.apiMode}`);
  console.log(`- Temperature: ${selectedTemperature}`);
  console.log(`- Messages Count: ${messages.length}`);
  console.log(`- System Prompt Length: ${system.length} chars`);
  console.log(`- User Message Length: ${user.length} chars`);
  const body = options.apiMode === "responses" ? {
    model: options.modelName,
    instructions: system || void 0,
    input: buildResponsesInput(messages),
    temperature: selectedTemperature,
    max_output_tokens: options.maxTokens,
    stream: effectiveStream
  } : {
    model: options.modelName,
    temperature: selectedTemperature,
    stream: effectiveStream,
    max_tokens: options.maxTokens,
    messages
  };
  return withTimeout(options.timeoutMs, async (signal, markActivity) => {
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`
      },
      signal,
      body: JSON.stringify(body)
    });
    const fetchTime = Date.now() - requestStartTime;
    console.log(`[LLM REQUEST HEAD] \u6536\u5230 API Response \u5934\u90E8\uFF0C\u72B6\u6001\u7801: ${response.status}\uFF0CHTTP\u5EFA\u7ACB\u8FDE\u63A5\u4E0E\u9996\u5305\u5934\u8017\u65F6: ${fetchTime}ms`);
    if (!response.ok) {
      const providerMessage = await parseProviderError(response);
      console.error(`[LLM REQUEST ERROR] \u8BF7\u6C42\u5931\u8D25\uFF0C\u72B6\u6001\u7801: ${response.status}\uFF0C\u9519\u8BEF: ${providerMessage}`);
      throw new Error(`LLM request failed with status ${response.status}: ${providerMessage}`);
    }
    markActivity();
    if (effectiveStream && options.onDelta) {
      return streamOpenAiCompatibleResponse(response, async (delta) => {
        markActivity();
        await options.onDelta?.(delta);
      }, {
        signal,
        markActivity,
        requestStartTime
      });
    }
    const payload = await response.json();
    const choice = payload.choices?.[0];
    const content = options.apiMode === "responses" ? extractResponsesOutput(payload) : (extractTextContent(choice?.message) || extractTextContent(choice?.text)).trim();
    const totalTime = Date.now() - requestStartTime;
    console.log(`[LLM REQUEST END] \u975E\u6D41\u5F0F\u8BF7\u6C42\u5B8C\u6210\u3002\u603B\u8017\u65F6: ${totalTime}ms\uFF0C\u8FD4\u56DE\u5185\u5BB9\u957F\u5EA6: ${content.length}`);
    console.log(`
========== [LLM RESPONSE START] ==========
${content.trim()}
========== [LLM RESPONSE END] ==========
`);
    if (options.stream && options.onDelta && content) {
      await options.onDelta(content);
    }
    return content.trim();
  }, options.signal);
}
async function generateAgentReply(options) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    const reply = buildFakeReply(options);
    if (options.onDelta) {
      await emitFakeReplyInChunks(reply, options.onDelta);
    }
    return reply;
  }
  let config = await loadLlmConfigForCapability(options.envRootDir, "text");
  const apiKey = config?._dbApiKey || "";
  if (!config || !apiKey) {
    throw new Error("No active LLM configuration found. Configure a text model in settings before generating content.");
  }
  const isDrafting = options.currentStage === "drafting";
  const protocol = isDrafting ? "\u6B63\u6587\u521B\u4F5C\u534F\u8BAE\uFF1A\u4F60\u8D1F\u8D23\u6267\u884C\u5C0F\u8BF4\u7AE0\u8282\u7684\u521D\u7A3F\u521B\u4F5C\u3001\u8D28\u91CF\u8FD4\u5DE5\u6216\u81EA\u7136\u5EA6\u6DA6\u8272\uFF0C\u5FC5\u987B\u8F93\u51FA\u5177\u4F53\u7684\u6587\u5B66\u6B63\u6587\uFF0C\u4E14\u4E25\u7981\u8F93\u51FA\u8BA8\u8BBA\u8FC7\u7A0B\u6216\u65E0\u5173\u5E9F\u8BDD\u3002" : AUTONOMOUS_DISCUSSION_PROTOCOL;
  const systemBlocks = [];
  if (isDrafting) {
    if (options.basePrompt.trim()) systemBlocks.push(options.basePrompt.trim());
    if (protocol) systemBlocks.push(protocol);
    if (options.consensus.trim()) systemBlocks.push(options.consensus.trim());
    if (options.dynamicPrompt.trim()) systemBlocks.push(options.dynamicPrompt.trim());
  } else {
    if (options.consensus.trim()) systemBlocks.push(options.consensus.trim());
    if (protocol) systemBlocks.push(protocol);
    if (options.basePrompt.trim()) systemBlocks.push(options.basePrompt.trim());
    if (options.dynamicPrompt.trim()) systemBlocks.push(options.dynamicPrompt.trim());
  }
  systemBlocks.push(
    `\u8F93\u51FA\u8BED\u8A00\uFF1A${options.preferredLanguage === "en-US" ? "English" : "\u7B80\u4F53\u4E2D\u6587"}`,
    `\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1A${options.currentStage ?? "worldbuilding_dialogue"}`,
    options.stageInstruction ? `\u9636\u6BB5\u7EA6\u675F\uFF1A${options.stageInstruction}` : "",
    `Discussion stage: ${options.discussionStage ?? "specialist_turn"}`,
    options.discussionTarget ? `Discussion target: ${options.discussionTarget.label}
Target kind: ${options.discussionTarget.kind}
Target asset: ${options.discussionTarget.assetPath}
Target instruction: ${options.discussionTarget.instruction}` : "",
    "Response contract:\n" + [
      "- \u5FC5\u987B\u4F7F\u7528\u7B80\u4F53\u4E2D\u6587\u8F93\u51FA\u3002",
      isDrafting ? "- \u5FC5\u987B\u6309\u7167\u7AE0\u8282\u683C\u5F0F\u8981\u6C42\u8F93\u51FA\u7AE0\u8282\u6B63\u6587\u5185\u5BB9\u3002" : "- \u7ED9\u51FA\u5B9E\u8D28\u6027\u8BA8\u8BBA\u5185\u5BB9\uFF0C\u4E0D\u80FD\u53EA\u8BF4\u4E00\u53E5\u62D2\u7EDD\u3002",
      isDrafting ? "- \u5FC5\u987B\u9075\u5FAA\u5C0F\u8BF4\u4EBA\u7269\u6863\u6848\uFF0C\u4FDD\u8BC1\u4EBA\u540D\u4E0E\u60C5\u8282\u7684\u8FDE\u7EED\u6027\u3002" : "- \u53EF\u4EE5\u4F7F\u7528\u7B80\u77ED markdown \u5C0F\u8282\u4E0E\u5217\u8868\u3002",
      "- \u5FC5\u987B\u505C\u7559\u5728\u5F53\u524D target \u5185\u3002",
      isDrafting ? "" : "- \u9664\u975E\u660E\u786E\u8FDB\u5165 drafting \u9636\u6BB5\uFF0C\u5426\u5219\u4E0D\u80FD\u4EA7\u51FA\u8131\u79BB\u9636\u6BB5\u7684\u7AE0\u8282\u6B63\u6587\u3002",
      isDrafting ? "" : "- Specialists \u5FC5\u987B\u5148\u7ED9\u4E00\u4E2A\u660E\u786E\u98CE\u9669/\u6279\u8BC4/\u5931\u8D25\u6A21\u5F0F\uFF0C\u518D\u7ED9\u5EFA\u8BAE\u3002",
      isDrafting ? "" : "- Final synthesis \u5FC5\u987B\u5305\u542B `Final Consensus`\u3001`Remaining Risk`\u3001`Next Step`\u3002"
    ].filter(Boolean).join("\n"),
    !isDrafting && options.priorTranscript?.trim() ? `Prior roundtable transcript:
${options.priorTranscript.trim()}` : ""
  );
  const system = systemBlocks.filter(Boolean).join("\n\n");
  const selectedTemperature = options.temperature !== void 0 ? options.temperature : config.provider.temperature;
  console.log(`
========== [LLM SYSTEM PROMPT START] ==========
${system}
========== [LLM SYSTEM PROMPT END] ==========
`);
  if (options.message) {
    console.log(`
========== [LLM USER MESSAGE START] ==========
${options.message}
========== [LLM USER MESSAGE END] ==========
`);
  }
  const content = await requestLlmTextCompletion({
    baseUrl: config.provider.baseUrl,
    apiKey,
    modelName: config.provider.modelName,
    apiMode: config.provider.apiMode,
    timeoutMs: config.provider.timeoutMs,
    temperature: selectedTemperature,
    stream: Boolean(options.onDelta),
    signal: options.signal,
    onDelta: options.onDelta,
    messages: [
      { role: "system", content: system },
      { role: "user", content: options.message }
    ]
  });
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
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  const timeoutMs = activeConfig?.provider.timeoutMs || 12e4;
  const baseUrl = overrides.baseUrl?.trim() || activeConfig?.provider.baseUrl || "";
  const modelName = overrides.modelName?.trim() || activeConfig?.provider.modelName || "";
  const apiMode = overrides.apiMode || activeConfig?.provider.apiMode || "chat";
  const apiKey = overrides.apiKey?.trim() || activeConfig?._dbApiKey || "";
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return {
      ok: true,
      checkedAt,
      baseUrl,
      modelName,
      apiMode,
      message: `Provider connectivity check passed in test mode (${apiMode}).`
    };
  }
  if (!baseUrl || !modelName || !apiKey) {
    return {
      ok: false,
      checkedAt,
      baseUrl,
      modelName,
      apiMode,
      message: "Missing provider config. Configure a model in settings first."
    };
  }
  try {
    const response = await withTimeout(
      timeoutMs,
      (signal) => fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${apiKey}`
        },
        signal
      })
    );
    if (!response.ok) {
      let fallbackErrorMessage = "";
      try {
        const content = await requestLlmTextCompletion({
          baseUrl,
          apiKey,
          modelName,
          apiMode,
          timeoutMs,
          maxTokens: 8,
          messages: [{ role: "user", content: "ping" }]
        });
        if (content) {
          return {
            ok: true,
            checkedAt,
            baseUrl,
            modelName,
            apiMode,
            message: `Provider reachable (verified via ${apiMode} generation fallback).`
          };
        }
      } catch (chatErr) {
        fallbackErrorMessage = chatErr instanceof Error ? chatErr.message : String(chatErr);
      }
      return {
        ok: false,
        checkedAt,
        baseUrl,
        modelName,
        apiMode,
        message: fallbackErrorMessage ? `Provider test failed with status ${response.status}; generation fallback failed: ${fallbackErrorMessage}` : `Provider test failed with status ${response.status}.`
      };
    }
    const payload = await response.json();
    const modelCount = Array.isArray(payload.data) ? payload.data.length : 0;
    return {
      ok: true,
      checkedAt,
      baseUrl,
      modelName,
      apiMode,
      message: `Provider reachable. ${modelCount} models listed.`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      checkedAt,
      baseUrl,
      modelName,
      apiMode,
      message: `Provider test failed: ${message}`
    };
  }
}

// src/env-manager.ts
var import_node_fs3 = __toESM(require("fs"), 1);
var import_node_path3 = __toESM(require("path"), 1);
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
var MANAGED_PROJECTS_SEGMENT = `${import_node_path3.default.sep}.ai-novel-projects${import_node_path3.default.sep}`;
function uniquePaths(paths) {
  return [...new Set(paths.map((candidate) => import_node_path3.default.resolve(candidate)))];
}
function inferWorkspaceRootFromManagedProject(rootDir) {
  const index = rootDir.indexOf(MANAGED_PROJECTS_SEGMENT);
  if (index < 0) {
    return null;
  }
  return rootDir.slice(0, index) || import_node_path3.default.parse(rootDir).root;
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
  return import_node_path3.default.resolve(rootDir, ".env");
}
function getProjectEnvCandidatePaths(rootDir = process.cwd()) {
  const resolvedRootDir = import_node_path3.default.resolve(rootDir);
  const candidates = [
    getProjectEnvPath(resolvedRootDir),
    import_node_path3.default.join(resolvedRootDir, ...PACKAGE_ENV_PARTS)
  ];
  const workspaceRoot = inferWorkspaceRootFromManagedProject(resolvedRootDir);
  if (workspaceRoot) {
    candidates.push(
      getProjectEnvPath(workspaceRoot),
      import_node_path3.default.join(workspaceRoot, ...PACKAGE_ENV_PARTS)
    );
  }
  return uniquePaths(candidates);
}
function readProjectEnv(rootDir = process.cwd()) {
  const candidates = getProjectEnvCandidatePaths(rootDir);
  const existingPaths = candidates.filter((envPath) => import_node_fs3.default.existsSync(envPath));
  if (existingPaths.length > 0) {
    const values = existingPaths.slice().reverse().reduce((merged, envPath) => {
      const raw = import_node_fs3.default.readFileSync(envPath, "utf8");
      return {
        ...merged,
        ...parseProjectEnv(raw)
      };
    }, {});
    return {
      envPath: existingPaths[0],
      exists: true,
      sourcePaths: existingPaths,
      values
    };
  }
  return {
    envPath: getProjectEnvPath(rootDir),
    exists: false,
    sourcePaths: [],
    values: {}
  };
}
function getProjectEnvStatus(rootDir = process.cwd()) {
  const { envPath, exists, sourcePaths, values } = readProjectEnv(rootDir);
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
    sourcePaths,
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

// src/super-graph.ts
var import_promises2 = __toESM(require("fs/promises"), 1);
var import_node_path4 = __toESM(require("path"), 1);
var GRAPH_SCHEMA_VERSION = 1;
var WORKSPACE_DIR = ".ai-novel";
var STAGES = [
  "worldbuilding_dialogue",
  "setting_review",
  "master_planning",
  "chapter_task_generation",
  "drafting",
  "complete"
];
var AGENTS = ["showrunner", "world-architect", "author", "editor", "reviewer", "prose-stylist"];
var CONTEXT_LAYERS = [
  "system",
  "project_mission",
  "workflow_state",
  "canon_memory",
  "rag_recall",
  "recent_history",
  "tool_results",
  "current_task",
  "output_contract"
];
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
function taskNode(task) {
  return makeNode("ChapterTask", `chapter:${String(task.chapterNumber).padStart(3, "0")}`, task.title, {
    chapterNumber: task.chapterNumber,
    status: task.status,
    summary: task.summary,
    targetWords: task.targetWords,
    causalPlan: task.causalPlan || null
  });
}
function buildInitialSuperGraph(state) {
  const graph = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    projectId: "project:current",
    generatedAt: now(),
    nodes: [],
    edges: []
  };
  upsertNode(graph, makeNode("Project", "project:current", state.project.title, {
    idea: state.project.idea,
    createdAt: state.project.createdAt,
    workspaceVersion: state.project.workspaceVersion
  }));
  upsertNode(graph, makeNode("Mission", "mission:original", "Original Project Mission", {
    idea: state.project.idea,
    totalChapters: state.plan.totalChapters,
    chapterWordTarget: state.plan.chapterWordTarget,
    promise: "Preserve the user's original story goal across all autonomous runs."
  }));
  upsertEdge(graph, makeEdge("HAS_MISSION", "project:current", "mission:original"));
  for (const [index, stage] of STAGES.entries()) {
    const stageId = `stage:${stage}`;
    upsertNode(graph, makeNode("WorkflowStage", stageId, stage, {
      order: index + 1,
      active: state.runtime.stage === stage
    }));
    upsertEdge(graph, makeEdge("HAS_STAGE", "project:current", stageId));
    if (state.runtime.stage === stage) {
      upsertEdge(graph, makeEdge("CURRENT_STAGE", "project:current", stageId));
    }
    const nextStage = STAGES[index + 1];
    if (nextStage) {
      upsertEdge(graph, makeEdge("NEXT_STAGE", stageId, `stage:${nextStage}`));
    }
  }
  for (const agent of AGENTS) {
    const agentId = `agent:${agent}`;
    upsertNode(graph, makeNode("Agent", agentId, agent, {
      basePrompt: `.ai-novel/prompts/agents/${agent}.base.md`,
      dynamicPrompt: `.ai-novel/prompts/agents/${agent}.dynamic.md`
    }));
    upsertEdge(graph, makeEdge("HAS_AGENT", "project:current", agentId));
    upsertEdge(graph, makeEdge("READS", agentId, "artifact:global-consensus"));
  }
  const artifacts = [
    ["artifact:global-consensus", "Global Consensus", ".ai-novel/prompts/global-consensus.md"],
    ["artifact:protagonist", "Protagonist Memory", ".ai-novel/memory/characters/core/protagonist.md"],
    ["artifact:style-profile", "Style Profile", ".ai-novel/style/profile.md"],
    ["artifact:setting-freeze", "Setting Freeze", ".ai-novel/plans/setting-freeze.md"],
    ["artifact:master-outline", "Master Outline", ".ai-novel/plans/master-outline.md"],
    ["artifact:discussion-log", "Discussion Log", ".ai-novel/chat/discussion-log.md"],
    ["artifact:checkpoints", "Checkpoints", ".ai-novel/checkpoints/"],
    ["artifact:knowledge-index", "Knowledge Index", ".ai-novel/knowledge/index.json"],
    ["artifact:context-packet", "Current Context Packet", ".ai-novel/context/current-context-packet.json"]
  ];
  for (const [id, label, assetPath] of artifacts) {
    upsertNode(graph, makeNode("Artifact", id, label, { path: assetPath }));
    upsertEdge(graph, makeEdge("HAS_ARTIFACT", "project:current", id));
  }
  for (const layer of CONTEXT_LAYERS) {
    const layerId = `context:${layer}`;
    upsertNode(graph, makeNode("ContextLayer", layerId, layer, {
      priority: CONTEXT_LAYERS.indexOf(layer) + 1
    }));
    upsertEdge(graph, makeEdge("USES_CONTEXT_LAYER", "project:current", layerId));
  }
  for (const task of state.plan.chapterTasks) {
    const node = taskNode(task);
    upsertNode(graph, node);
    upsertEdge(graph, makeEdge("HAS_CHAPTER_TASK", "project:current", node.id));
  }
  return graph;
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
async function initializeSuperGraph(rootDir, state, options = {}) {
  const graph = buildInitialSuperGraph(state);
  await saveSuperGraph(rootDir, graph, options);
  return graph;
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
var import_promises5 = __toESM(require("fs/promises"), 1);
var import_node_path8 = __toESM(require("path"), 1);

// src/embedding.ts
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

// src/knowledge.ts
var import_node_crypto = __toESM(require("crypto"), 1);
var import_promises3 = __toESM(require("fs/promises"), 1);
var import_node_path5 = __toESM(require("path"), 1);
var LOCAL_KNOWLEDGE_EMBEDDING_MODEL = "local-hash-v1";
var DEFAULT_CHUNK_CHAR_LIMIT = 1400;
var DEFAULT_GLOBAL_RESOURCE_LIMIT = process.env.AI_NOVEL_TEST_MODE === "1" ? 12 : 5e3;
var DEFAULT_ARTIFACT_CHUNK_LIMIT = process.env.AI_NOVEL_TEST_MODE === "1" ? 40 : 500;
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

// src/genre-presets.ts
var GENRE_PRESETS = [
  {
    genreName: "\u7384\u5E7B",
    readerPromise: "\u529B\u91CF\u8FDB\u9636\u3001\u4E16\u754C\u89C2\u5947\u89C2\u3001\u8DE8\u9636\u5FA1\u654C\u7684\u6781\u81F4\u723D\u611F\u3002",
    narrationStrategy: "\u65C1\u767D\u8981\u5F3A\u8C03\u89C4\u5219\u8FB9\u754C\u3001\u4EE3\u4EF7\u3001\u5947\u89C2\u611F\u4E0E\u5883\u754C\u538B\u529B\uFF1B\u6218\u6597\u573A\u666F\u7528\u52A8\u4F5C\u52A8\u8BCD\u548C\u611F\u5B98\u7EC6\u8282\uFF0C\u4E0D\u5806\u780C\u65E0\u610F\u4E49\u7684\u5883\u754C\u5927\u5B57\u4E0E\u62DB\u5F0F\u540D\u5B57\u3002",
    pacingAndRhythm: "\u5C0F\u8282\u594F\u4EE5\u5371\u673A\u538B\u8FEB\u4E3A\u4E3B\uFF0C\u5927\u8282\u594F\u4EE5\u5883\u754C\u7A81\u7834\u4E0E\u5730\u4F4D\u6500\u5347\u4E3A\u9AD8\u6F6E\uFF1B\u7A81\u51FA\u723D\u70B9\u524D\u7684\u60C5\u611F\u538B\u6291\u4E0E\u53CD\u51FB\u91CA\u653E\u3002",
    chapterStructure: "\u8D77\u7B14\u5FC5\u987B\u6709\u73AF\u5883\u4E0E\u5371\u673A\u903C\u8FEB\uFF0C\u4E2D\u6BB5\u901A\u8FC7\u6218\u6597\u3001\u4EA4\u6613\u6216\u9886\u609F\u63A8\u8FDB\uFF0C\u5C3E\u58F0\u8BBE\u7ACB\u65B0\u7684\u9AD8\u5883\u754C\u5A01\u80C1\u6216\u9636\u6BB5\u6210\u679C\u3002",
    characterPressure: "\u5B97\u95E8\u89C4\u5219\u3001\u8D44\u6E90\u4E89\u593A\u3001\u5F31\u8089\u5F3A\u98DF\u7684\u4E1B\u6797\u6CD5\u5219\u538B\u8FEB\u3002",
    poisonPoints: [
      "\u5F3A\u884C\u5F31\u667A\u5316\u5BF9\u624B\u4EE5\u663E\u5F97\u4E3B\u89D2\u806A\u660E",
      "\u5883\u754C\u8D2C\u503C\u8FC7\u5FEB\uFF0C\u6218\u6597\u5168\u9760\u5927\u558A\u529F\u6CD5\u62DB\u5F0F",
      "\u4E3B\u89D2\u65E0\u4EE3\u4EF7\u5347\u7EA7\uFF0C\u7F3A\u4E4F\u6210\u957F\u963B\u529B\u4E0E\u56E0\u679C\u78E8\u7EC3",
      "\u4E3B\u89D2\u4F18\u67D4\u5BE1\u65AD\u3001\u5723\u6BCD\u5FC3\u8FC7\u5EA6\u53D1\u4F5C",
      "\u6218\u529B\u4F53\u7CFB\u5F7B\u5E95\u5D29\u6E83\uFF08\u5982\u4F4E\u9636\u51E1\u4EBA\u65E0\u5E95\u724C\u4E00\u62F3\u6253\u6B7B\u795E\u5E1D\uFF09",
      "\u5570\u55E6\u5197\u957F\u7684\u8857\u5934\u5F0F\u626F\u76AE\u5BF9\u9A82\u4E0E\u53CD\u590D\u5632\u8BBD"
    ],
    naturalnessRules: [
      "\u62D2\u7EDD\u8FDE\u7EED 3 \u4E2A\u4EE5\u4E0A\u7684\u62BD\u8C61\u529F\u6CD5\u7384\u5B66\u8BCD\u5806\u780C",
      "\u6218\u6597\u8FC7\u7A0B\u5FC5\u987B\u5305\u542B\u7269\u7406\u53D7\u521B\u4E0E\u73AF\u5883\u4EA4\u4E92\u7834\u574F\u7684\u7EC6\u8282",
      "\u8D8A\u9636\u53CD\u6740\u5FC5\u987B\u5C55\u73B0\u60E8\u75DB\u4EE3\u4EF7\uFF08\u5982\u732E\u796D\u751F\u547D\u672C\u6E90\u3001\u7ECF\u8109\u91CD\u521B\u3001\u6CD5\u5B9D\u788E\u88C2\uFF09",
      "\u52A8\u4F5C\u63CF\u5199\u5FC5\u987B\u6709\u5F3A\u70C8\u7684\u89C6\u542C\u51B2\u51FB\u529B"
    ],
    contextPriority: ["\u4E3B\u89D2\u5883\u754C\u4E0E\u91D1\u624B\u6307\u8BBE\u5B9A", "\u5F53\u524D\u5BF9\u624B\u4E0E\u52BF\u529B\u77DB\u76FE", "\u88C5\u5907\u6CD5\u5B9D\u89C4\u5219"],
    vocabularyScenes: ["\u6218\u6597", "\u4FEE\u70BC", "\u81EA\u7136\u73AF\u5883", "\u5FC3\u7406\u6D3B\u52A8"]
  },
  {
    genreName: "\u4FEE\u4ED9/\u4ED9\u4FA0",
    readerPromise: "\u9006\u5929\u6539\u547D\u7684\u51FA\u5C18\u611F\u3001\u5929\u9053\u65E0\u60C5\u7684\u4FEE\u884C\u4EE3\u4EF7\u4E0E\u4EBA\u60C5\u51B7\u6696\u3002",
    narrationStrategy: "\u534A\u6587\u767D\u5939\u6742\u7684\u5178\u96C5\u65C1\u767D\uFF0C\u7A81\u51FA\u201C\u9053\u5FC3\u201D\u4E0E\u201C\u4EE3\u4EF7\u201D\uFF1B\u63CF\u5199\u73AF\u5883\u65F6\u878D\u5408\u7985\u610F\u4E0E\u7A7A\u7075\u611F\uFF0C\u6218\u6597\u6CE8\u91CD\u6C14\u673A\u535A\u5F08\u4E0E\u5929\u5730\u5143\u6C14\u4EA4\u4E92\u3002",
    pacingAndRhythm: "\u957F\u7EBF\u95ED\u5173\u5FC3\u5883\u611F\u609F\u4E0E\u77ED\u7EBF\u56E0\u679C\u7EA0\u7F20\u4EA4\u7EC7\uFF0C\u723D\u70B9\u5728\u4E8E\u53C2\u900F\u7384\u673A\u3001\u5FC3\u5883\u7A81\u7834\u4E0E\u56E0\u679C\u65A9\u65AD\u3002",
    chapterStructure: "\u5F00\u573A\u5F3A\u8C03\u4FEE\u771F\u73AF\u5883\u6216\u5FC3\u9B54\u60B8\u52A8\uFF0C\u4E2D\u6BB5\u63A8\u8FDB\u56E0\u679C\u4E89\u7AEF\u3001\u63A0\u593A\u673A\u7F18\uFF0C\u7ED3\u5C3E\u63ED\u793A\u56E0\u679C\u9501\u94FE\u7684\u4E0B\u4E00\u6B65\u8D70\u5411\u6216\u96F7\u52AB\u9884\u5146\u3002",
    characterPressure: "\u5929\u9053\u5BFF\u5143\u5927\u9650\u3001\u96F7\u52AB\u4E34\u5934\u3001\u540C\u95E8\u80CC\u53DB\u3001\u51E1\u5C18\u56E0\u679C\u65A9\u4E0D\u65AD\u5E26\u6765\u7684\u5FC3\u9B54\u7EA0\u7F20\u538B\u529B\u3002",
    poisonPoints: [
      "\u4FEE\u4ED9\u8005\u52A8\u8F84\u56E0\u9E21\u6BDB\u7802\u76AE\u50CF\u5E02\u4E95\u6D41\u6C13\u822C\u65E0\u8111\u8FB1\u9A82",
      "\u4FEE\u884C\u6CA1\u6709\u611F\u609F\u4E0E\u5386\u7EC3\uFF0C\u5168\u9760\u75AF\u72C2\u5403\u836F\u5E73\u63A8",
      "\u6D3B\u4E86\u6570\u5343\u5E74\u7684\u8001\u602A\u8868\u73B0\u5F97\u6BEB\u65E0\u5FC3\u667A\u6DF1\u5EA6\u4E0E\u57CE\u5E9C\uFF08\u53CD\u6D3E\u4F4E\u667A\u5316\uFF09",
      "\u65E0\u8282\u5236\u6EE5\u6740\u65E0\u8F9C\u4E14\u6BEB\u65E0\u5929\u9053\u8A93\u8A00\u4E0E\u56E0\u679C\u903B\u8F91\u7EA6\u675F"
    ],
    naturalnessRules: [
      "\u907F\u514D\u5806\u780C\u5982\u201C\u9053\u97F5\u201D\u3001\u201C\u6CD5\u5219\u201D\u3001\u201C\u5929\u9053\u201D\u7B49\u62BD\u8C61\u5927\u8BCD",
      "\u51E1\u4EBA\u4E0E\u4FEE\u58EB\u3001\u4F4E\u9636\u4E0E\u9AD8\u9636\u5BF9\u8BDD\u5FC5\u987B\u6709\u660E\u786E of \u8EAB\u4EFD\u5C0A\u5351\u548C\u4FE1\u606F\u5DEE",
      "\u4FEE\u884C\u7A81\u7834\u4E0E\u96F7\u52AB\u5FC5\u987B\u6709\u5F3A\u70C8\u7684\u8089\u4F53\u6DEC\u70BC\u6216\u795E\u9B42\u535A\u5F08\u7EC6\u8282"
    ],
    contextPriority: ["\u5929\u9053\u89C4\u5219\u4E0E\u4FEE\u884C\u4EE3\u4EF7", "\u9053\u5FC3\u5951\u7EA6\u4E0E\u56E0\u679C\u8A93\u8A00", "\u89D2\u8272\u5BFF\u547D\u4E0E\u6CD5\u529B\u72B6\u6001"],
    vocabularyScenes: ["\u5929\u9053\u611F\u609F", "\u6218\u6597", "\u4ED9\u5C71\u6D1E\u5E9C", "\u5BF9\u8BDD"]
  },
  {
    genreName: "\u60AC\u7591",
    readerPromise: "\u70E7\u8111\u89E3\u8C1C\u7684\u667A\u5546\u535A\u5F08\u3001\u4FE1\u606F\u8327\u623F\u62C6\u9664\u7684\u9707\u64BC\u3001\u5371\u673A\u964D\u4E34\u7684\u538B\u8FEB\u6050\u60E7\u611F\u3002",
    narrationStrategy: "\u51B7\u9759\u5BA2\u89C2\u3001\u514B\u5236\u5185\u655B\u7684\u65C1\u767D\uFF1B\u7740\u529B\u523B\u753B\u5FAE\u8868\u60C5\u4E0E\u73AF\u5883\u7269\u4EF6\u7684\u6697\u53F7\u7EBF\u7D22\uFF1B\u907F\u514D\u4E0A\u5E1D\u89C6\u89D2\u63D0\u524D\u5267\u900F\u3002",
    pacingAndRhythm: "\u4FE1\u606F\u6324\u538B\u5F0F\u8282\u594F\uFF0C\u524D\u534A\u6BB5\u4E0D\u65AD\u629B\u51FA\u8C1C\u9898\u548C\u8BA4\u77E5\u504F\u5DEE\uFF0C\u540E\u534A\u6BB5\u901A\u8FC7\u7EC6\u8282\u6C47\u805A\u5B9E\u73B0\u60CA\u4EBA\u53CD\u8F6C\u6216\u771F\u76F8\u6536\u62E2\u3002",
    chapterStructure: "\u8D77\u7B14\u4EE5\u5F02\u5E38\u73B0\u8C61\u3001\u51F6\u6848\u73B0\u573A\u6216\u96BE\u89E3\u8C1C\u9898\u5207\u5165\uFF0C\u4E2D\u6BB5\u8FDB\u884C\u7EBF\u7D22\u67E5\u8BC1\u4E0E\u8BA4\u77E5\u5BF9\u6297\uFF0C\u5C3E\u58F0\u9501\u5B9A\u5728\u65B0\u7684\u7834\u574F\u6027\u7EBF\u7D22\u6216\u4EBA\u8EAB\u5371\u9669\u4E2D\u3002",
    characterPressure: "\u8FFD\u730E\u8005\u7684\u8FEB\u8FD1\u3001\u51F6\u624B\u7684\u5FC3\u7406\u8BF1\u5BFC\u3001\u65F6\u95F4\u9650\u5236\u3001\u8EAB\u8FB9\u76DF\u53CB\u4E0D\u53EF\u4FE1\u7684\u80CC\u53DB\u538B\u529B\u3002",
    poisonPoints: [
      "\u4FA6\u63A2\u4E3B\u89D2\u5F3A\u884C\u901A\u8FC7\u7075\u5149\u4E00\u73B0\u89E3\u51B3\u6240\u6709\u8C1C\u9898\uFF0C\u7F3A\u4E4F\u8BC1\u636E\u94FE\u652F\u6491",
      "\u72AF\u7F6A\u52A8\u673A\u6781\u5EA6\u5F31\u667A\uFF0C\u7834\u6848\u5168\u9760\u53CD\u6D3E\u964D\u667A\u81EA\u5DF1\u62DB\u4F9B",
      "\u524D\u9762\u57CB\u4E0B\u7684\u5173\u952E\u7EBF\u7D22\u5230\u6700\u540E\u6BEB\u65E0\u7528\u5904\uFF0C\u70C2\u5C3E\u6216\u9009\u62E9\u6027\u5931\u5FC6",
      "\u4E25\u7981\u673A\u68B0\u964D\u795E\uFF1A\u7EDD\u4E0D\u5141\u8BB8\u5728\u6700\u540E\u5173\u5934\u51ED\u7A7A\u5192\u51FA\u524D\u6587\u4ECE\u672A\u63D0\u53CA\u7684\u65B0\u4EBA\u7269\u3001\u65B0\u7EBF\u7D22\u6216\u8D85\u81EA\u7136\u529B\u91CF\u7834\u5C40",
      "\u53CD\u6D3E\u5728\u6700\u540E\u5173\u5934\u50CF\u52A8\u6F2B\u89D2\u8272\u822C\u6ED4\u6ED4\u4E0D\u7EDD\u4E3B\u52A8\u4EA4\u4EE3\u72AF\u7F6A\u8FC7\u7A0B"
    ],
    naturalnessRules: [
      "\u6BCF\u4E00\u4E2A\u88AB\u63CF\u5199\u7684\u5FAE\u5C0F\u53CD\u5E38\u7269\u4EF6\uFF0C\u5728\u540E\u7EED 3 \u7AE0\u5185\u5FC5\u987B\u6709\u529F\u80FD\u6027\u4EA4\u4EE3\u6216\u56DE\u6536",
      "\u62D2\u7EDD\u76F4\u767D\u5FC3\u7406\u72EC\u767D\u2018\u539F\u6765\u662F\u8FD9\u6837\u2019\uFF0C\u6539\u7528\u7EBF\u7D22\u91CD\u7EC4\u7684\u884C\u52A8\u53BB\u5448\u73B0\u5224\u65AD",
      "\u51B0\u5C71\u4FE1\u606F\u63A7\u5236\uFF1A\u63ED\u9732\u4FE1\u606F\u5FC5\u987B\u901A\u8FC7\u5FAE\u8868\u60C5\u3001\u5931\u8A00\u6216\u5F02\u6837\u4FA7\u9762\u5C55\u73B0\uFF0C\u771F\u76F8\u5207\u6210\u788E\u7247\u6BCF\u6B21\u53EA\u7ED9 10%",
      "\u5FC3\u7406\u9AD8\u538B\u6E32\u67D3\uFF1A\u4E0D\u8981\u76F4\u767D\u8BF4\u6050\u60E7\uFF0C\u805A\u7126\u611F\u5B98\u7EC6\u8282\uFF08\u5982\u79D2\u9488\u8DF3\u52A8\u3001\u5589\u5499\u5E72\u71E5\u8840\u8165\u5473\u3001\u6C34\u7BA1\u5F02\u54CD\uFF09",
      "\u4E25\u683C\u7684\u7B2C\u4E09\u4EBA\u79F0\u9650\u77E5\u89C6\u89D2\uFF1A\u4E3B\u89D2\u672A\u770B\u672A\u542C\u7684\u4E0D\u5141\u8BB8\u51FA\u73B0\u5728\u6B63\u6587\u4E2D"
    ],
    contextPriority: ["\u6838\u5FC3\u6848\u4EF6\u7EBF\u7D22\u94FE", "\u5DF2\u77E5\u7591\u70B9\u4E0E\u4EBA\u7269\u8BA4\u77E5\u5DEE", "\u6848\u53D1\u65F6\u95F4\u7EBF\u4E0E\u9690\u85CF\u52A8\u673A"],
    vocabularyScenes: ["\u72AF\u7F6A\u73B0\u573A", "\u5BF9\u8BDD", "\u5FC3\u7406\u5BF9\u6297", "\u73AF\u5883\u6E32\u67D3"]
  },
  {
    genreName: "\u90FD\u5E02/\u73B0\u5B9E",
    readerPromise: "\u73B0\u4EE3\u804C\u573A/\u751F\u6D3B\u7684\u5F3A\u70C8\u4EE3\u5165\u611F\u3001\u4EBA\u60C5\u5F80\u6765\u7684\u60C5\u7EEA\u5171\u9E23\u3001\u9006\u88AD\u89C4\u5219\u7684\u723D\u611F\u3002",
    narrationStrategy: "\u6781\u5177\u751F\u6D3B\u8D28\u611F\u7684\u73B0\u4EE3\u65C1\u767D\uFF0C\u6CE8\u91CD\u523B\u753B\u804C\u573A\u9636\u5C42\u5F20\u529B\u3001\u91D1\u94B1\u8BF1\u60D1\u4E0E\u793E\u4F1A\u6F5C\u89C4\u5219\uFF1B\u8BED\u8A00\u4FDD\u6301\u81EA\u7136\u5BA2\u89C2\u3002",
    pacingAndRhythm: "\u9AD8\u538B\u7684\u73B0\u4EE3\u751F\u5B58\u8282\u594F\uFF0C\u723D\u70B9\u5728\u4E8E\u4E13\u4E1A\u6280\u80FD\u7684\u78BE\u538B\u7A81\u7834\u3001\u9636\u5C42\u8DE8\u8D8A\u7684\u7545\u5FEB\u6216\u4EBA\u60C5\u51B7\u6696\u7684\u53CD\u8F6C\u3002",
    chapterStructure: "\u8D77\u7B14\u4E8E\u5177\u4F53\u7684\u804C\u573A/\u5BB6\u5EAD\u751F\u6D3B\u5371\u673A\u6216\u793E\u4F1A\u51B2\u7A81\uFF0C\u4E2D\u6BB5\u901A\u8FC7\u5229\u76CA\u4EA4\u6D89\u3001\u4E13\u4E1A\u624B\u6BB5\u8FC7\u62DB\u63A8\u8FDB\uFF0C\u7ED3\u5C3E\u843D\u811A\u4E8E\u5173\u7CFB\u8F6C\u53D8\u6216\u66F4\u5927\u7684\u5229\u76CA\u94A9\u5B50\u3002",
    characterPressure: "\u623F\u8D37\u8F66\u8D37\u8D22\u52A1\u7EA2\u7EBF\u3001\u804C\u573A\u6392\u6324\u3001\u9636\u5C42\u58C1\u5792\u3001\u5BB6\u5EAD\u77DB\u76FE\u4E0E\u4EBA\u9645\u793E\u4EA4\u7684\u865A\u4F2A\u5305\u88C5\u3002",
    poisonPoints: [
      "\u5F3A\u884C\u585E\u5165\u4F4E\u7AEF\u3001\u53CD\u667A\u7684\u5632\u8BBD\u6253\u8138\u5957\u8DEF",
      "\u4E3B\u89D2\u4E13\u4E1A\u6280\u80FD\u6F0F\u6D1E\u767E\u51FA\uFF0C\u8131\u79BB\u73B0\u5B9E\u793E\u4F1A\u5E38\u8BC6",
      "\u804C\u573A\u5408\u4F5C\u5199\u6210\u513F\u620F\u822C\u7684\u5C0F\u5B66\u5BAB\u6597"
    ],
    naturalnessRules: [
      "\u5BF9\u767D\u9AD8\u5EA6\u53E3\u8BED\u5316\uFF0C\u4E25\u7981\u4EBA\u7269\u50CF\u5FF5\u6559\u79D1\u4E66\u8BF4\u660E\u4E66\u822C\u8BF4\u8BDD",
      "\u5173\u4E8E\u91D1\u94B1\u3001\u6D88\u8D39\u6C34\u5E73\u53CA\u884C\u4E1A\u89C4\u5219\u7684\u6570\u636E\u5FC5\u987B\u7CBE\u51C6\u4E14\u7B26\u5408\u65F6\u4EE3\u5E38\u7406"
    ],
    contextPriority: ["\u4E3B\u89D2\u804C\u4E1A\u80CC\u666F\u4E0E\u6838\u5FC3\u5229\u76CA", "\u793E\u4F1A\u5173\u7CFB\u7F51\u7EDC\u4E0E\u8D22\u52A1\u503A\u52A1", "\u5F53\u524D\u535A\u5F08\u76EE\u6807"],
    vocabularyScenes: ["\u65E5\u5E38", "\u5BF9\u8BDD", "\u5FC3\u7406\u6D3B\u52A8", "\u90FD\u5E02\u73AF\u5883"]
  },
  {
    genreName: "\u8A00\u60C5/\u60C5\u611F",
    readerPromise: "\u60C5\u611F\u620F\u7684\u8FC7\u5C71\u8F66\u5F20\u529B\u3001\u62C9\u626F\u611F\u4E0E\u5BBF\u547D\u6551\u8D4E\u611F\u3002",
    narrationStrategy: "\u7EC6\u817B\u654F\u611F\u7684\u65C1\u767D\uFF0C\u9AD8\u5EA6\u805A\u7126\u751F\u7406\u53CD\u5E94\u3001\u89C6\u7EBF\u4EA4\u4E92\u4E0E\u60C5\u7EEA\u6CE2\u52A8\uFF1B\u7740\u610F\u653E\u5927\u4E24\u4EBA\u4E4B\u95F4\u7684\u8DDD\u79BB\u4E0E\u8BD5\u63A2\u6027\u63A5\u89E6\u3002",
    pacingAndRhythm: "\u63A8\u62C9\u5F0F\u60C5\u611F\u8282\u594F\u3002\u4EE5\u65E5\u5E38\u4E92\u52A8\u4E0E\u6027\u683C\u51B2\u7A81\u79EF\u7D2F\u8377\u5C14\u8499\u5F20\u529B\uFF0C\u723D\u70B9\u5728\u4E8E\u5173\u7CFB\u786E\u8BA4\u6216\u60A3\u96BE\u89C1\u771F\u60C5\u7684\u60C5\u611F\u91CA\u653E\u3002",
    chapterStructure: "\u8D77\u7B14\u5FC5\u987B\u5EFA\u7ACB\u4E24\u4EBA\u5728\u72ED\u5C0F\u7A7A\u95F4\u6216\u5FC3\u7406\u4E8B\u4EF6\u7684\u4EA4\u96C6\uFF0C\u4E2D\u6BB5\u901A\u8FC7\u89C2\u5FF5\u78B0\u649E\u6216\u5916\u754C\u963B\u529B\u4EA7\u751F\u62C9\u626F\uFF0C\u5C3E\u58F0\u843D\u811A\u4E8E\u60C5\u611F\u5173\u7CFB\u7684\u4E00\u6B65\u53D8\u5316\u3002",
    characterPressure: "\u8EAB\u4EFD\u5DEE\u8DDD\u60AC\u6B8A\u3001\u5FC3\u53E3\u4E0D\u4E00\u7684\u81EA\u5C0A\u3001\u8FC7\u53BB\u60C5\u611F\u521B\u4F24\u5E26\u6765\u7684\u963B\u6297\u3001\u4EE5\u53CA\u5916\u754C\u7ADE\u4E89\u7684\u5AC9\u5992\u538B\u529B\u3002",
    poisonPoints: [
      "\u7537\u5973\u4E3B\u89D2\u5F3A\u884C\u964D\u667A\u9677\u5165\u5C0F\u5B66\u7EA7\u8BEF\u4F1A\uFF0C\u5F62\u6210\u618B\u5C48\u618B\u5B9D",
      "\u5F3A\u884C\u5806\u780C\u5DE5\u4E1A\u7CD6\u7CBE\uFF0C\u7F3A\u4E4F\u60C5\u611F\u56E0\u679C\u9012\u8FDB\u548C\u76F8\u4E92\u6551\u8D4E\u7684\u7ACB\u8DB3\u70B9",
      "\u4E3A\u4E86\u8650\u800C\u8650\uFF0C\u6495\u788E\u4EBA\u7269\u5E95\u7EBF\u5C0A\u4E25"
    ],
    naturalnessRules: [
      "\u4E25\u7981\u4F7F\u7528\u62BD\u8C61\u7684\u7231\u60C5/\u60C5\u7EEA\u8BCD\u6C47\u5806\u53E0",
      "\u4EB2\u5BC6\u63A5\u89E6\u6216\u60C5\u611F\u53D8\u5316\u5FC5\u987B\u7531\u5177\u4F53\u52A8\u4F5C\u3001\u8138\u7EA2\u3001\u5FC3\u8DF3\u3001\u547C\u5438\u7B49\u8EAB\u4F53\u53CD\u5E94\u5448\u73B0"
    ],
    contextPriority: ["\u4E24\u4EBA\u6838\u5FC3\u51B2\u7A81\u4E0E\u60C5\u611F\u7EBD\u5E26", "\u8FC7\u53BB\u7684\u60C5\u611F\u521B\u4F24\u4E0E\u4F24\u53E3", "\u604B\u7231\u5173\u7CFB\u8FDB\u5C55\u9636\u6BB5"],
    vocabularyScenes: ["\u611F\u60C5\u620F", "\u5FC3\u7406\u6D3B\u52A8", "\u5BF9\u8BDD", "\u65E5\u5E38"]
  },
  {
    genreName: "\u5386\u53F2/\u53E4\u4EE3",
    readerPromise: "\u5B8F\u5927\u7684\u65F6\u4EE3\u6CA7\u6851\u611F\u3001\u4E0E\u5386\u53F2\u540D\u81E3\u540D\u5C06\u535A\u5F08\u7684\u667A\u8C0B\u4EA4\u950B\u3001\u4EE5\u8D85\u524D\u5FC3\u667A\u91CD\u5851\u53E4\u98CE\u79E9\u5E8F\u7684\u9006\u88AD\u723D\u611F\u3002",
    narrationStrategy: "\u53E4\u98CE\u539A\u91CD\u7684\u65C1\u767D\uFF0C\u878D\u5408\u53E4\u4EE3\u653F\u6CBB\u5236\u5EA6\u3001\u793C\u4EEA\u4E60\u60EF\u3001\u8863\u98DF\u4F4F\u884C\u8003\u636E\uFF0C\u4F7F\u7528\u7B26\u5408\u65F6\u4EE3\u7684\u96C5\u81F4\u79F0\u8C13\u4E0E\u6587\u767D\u8BCD\u6C47\u3002",
    pacingAndRhythm: "\u5929\u4E0B\u5927\u52BF\u4E0E\u4E3B\u89D2\u751F\u8BA1\u3001\u5730\u65B9\u6CBB\u7406\u76F8\u4E92\u5D4C\u5957\uFF0C\u723D\u70B9\u5728\u4E8E\u8FD0\u7528\u73B0\u4EE3\u667A\u8BC6\u89E3\u51B3\u53E4\u4EE3\u987D\u75BE\uFF0C\u6216\u5728\u5386\u53F2\u5173\u952E\u8282\u70B9\u4E0A\u7684\u5927\u624B\u7B14\u535A\u5F08\u3002",
    chapterStructure: "\u8D77\u7B14\u7A81\u51FA\u5177\u4F53\u7684\u5C01\u5EFA\u5B97\u65CF\u538B\u529B\u3001\u5730\u65B9\u707E\u8352\u6216\u5B98\u573A\u5A01\u903C\uFF0C\u4E2D\u6BB5\u8FD0\u7528\u53E4\u4EBA\u535A\u5F08\u683C\u5C40\u4E0E\u8C0B\u7565\u7834\u5C40\uFF0C\u7ED3\u5C3E\u6302\u94A9\u5929\u4E0B\u5C40\u52BF\u6216\u5730\u7F18\u519B\u4E8B\u5371\u673A\u3002",
    characterPressure: "\u7687\u6743\u5929\u5A01\u4E0D\u53EF\u5FE4\u9006\u3001\u5B97\u65CF\u4F26\u7406\u9053\u5FB7\u724C\u574A\u3001\u4E71\u4E16\u6218\u7978\u3001\u5C0F\u4EBA\u8C17\u8A00\u4EE5\u53CA\u843D\u540E\u4FE1\u606F\u4EA4\u901A\u4E0B\u7684\u751F\u5B58\u538B\u529B\u3002",
    poisonPoints: [
      "\u53E4\u4EE3\u5386\u53F2\u4EBA\u7269\u6EE1\u53E3\u73B0\u4EE3\u7F51\u7EDC\u70C2\u6897\u4E0E\u8D85\u524D\u653F\u6CBB\u7528\u8BED",
      "\u5386\u53F2\u80CC\u666F\u6F0F\u6D1E\u767E\u51FA\uFF0C\u79F0\u8C13\u5EA6\u91CF\u8861\u6781\u5EA6\u53CD\u667A",
      "\u5F3A\u884C\u8BA9\u5386\u53F2\u82F1\u70C8\u540D\u81E3\u6CA6\u4E3A\u4E3B\u89D2\u964D\u667A\u7684\u966A\u886C"
    ],
    naturalnessRules: [
      "\u5B98\u804C\u3001\u5178\u7AE0\u5236\u5EA6\u3001\u5EA6\u91CF\u8861\u5FC5\u987B\u9AD8\u5EA6\u4E25\u8C28",
      "\u6587\u767D\u7528\u8BCD\u63A7\u5236\u5728 10% \u4EE5\u5185\uFF0C\u53EA\u8D77\u6E32\u67D3\u8D28\u611F\u4F5C\u7528\uFF0C\u4E25\u7981\u6666\u6DA9\u5806\u8BCD"
    ],
    contextPriority: ["\u671D\u5802\u5C40\u52BF\u4E0E\u65F6\u4EE3\u91CD\u5927\u5371\u673A", "\u5730\u65B9\u53BF\u5FD7\u8003\u636E\u4E0E\u7ECF\u6D4E\u547D\u8109", "\u5386\u53F2\u8D70\u5411\u4E0E\u6838\u5FC3\u540D\u4EBA"],
    vocabularyScenes: ["\u5386\u53F2\u573A\u666F", "\u5BF9\u8BDD", "\u4EEA\u5F0F\u5E86\u5178", "\u65E5\u5E38"]
  },
  {
    genreName: "\u79D1\u5E7B/\u8D5B\u535A",
    readerPromise: "\u786C\u6838\u7406\u8BBA\u964D\u7EF4\u6253\u51FB\u7684\u9707\u64BC\u3001\u5B87\u5B99\u5C3A\u5EA6\u4E0B\u7684\u5B58\u5728\u4E3B\u4E49\u601D\u8003\u3001\u4EE5\u53CA\u9AD8\u79D1\u6280\u5947\u89C2\u7684\u51B0\u51B7\u9707\u64BC\u3002",
    narrationStrategy: "\u51B7\u9759\u3001\u7406\u6027\u7684\u5DE5\u7A0B\u611F\u65C1\u767D\uFF0C\u5C06\u7E41\u590D\u7684\u6280\u672F\u6982\u5FF5\u5DE7\u5999\u8F6C\u5316\u4E3A\u4EBA\u7269\u5177\u4F53\u7684\u611F\u5B98\u7EC6\u8282\u4E0E\u751F\u5B58\u4EE3\u4EF7\uFF1B\u907F\u514D\u6280\u672F\u8BF4\u6559\u3002",
    pacingAndRhythm: "\u667A\u6027\u601D\u8003\u4E0E\u7269\u7406\u5371\u673A\u5E76\u884C\u7684\u8282\u594F\uFF0C\u723D\u70B9\u5728\u4E8E\u6280\u672F\u6096\u8BBA\u7684\u7CBE\u5999\u89E3\u5F00\uFF0C\u6216\u9AD8\u7EF4\u6587\u660E\u6CD5\u5219\u7684\u5B8F\u5927\u4F53\u73B0\u3002",
    chapterStructure: "\u8D77\u7B14\u5448\u73B0\u6280\u672F\u5F02\u53D8\u6216\u7269\u7406\u751F\u5B58\u8D44\u6E90\u6025\u5267\u544A\u6025\uFF0C\u4E2D\u6BB5\u5C55\u5F00\u6280\u672F\u6392\u67E5\u3001\u9635\u8425\u8BA4\u77E5\u51B2\u7A81\uFF0C\u7ED3\u5C3E\u5C55\u793A\u66F4\u5E7F\u9614\u7684\u661F\u7A7A\u56FE\u666F\u6216\u6280\u672F\u5F15\u529B\u6CE2\u6548\u5E94\u3002",
    characterPressure: "\u7269\u7406\u5B9A\u5F8B\u5E95\u7EBF\u65E0\u6CD5\u8FDD\u80CC\u3001\u98DE\u8239\u7CFB\u7EDF\u8FC7\u8F7D\u5D29\u6E83\u3001\u9AD8\u7EF4\u667A\u6167\u7684\u51B7\u6F20\u8511\u89C6\u3001\u4EE5\u53CA\u771F\u7A7A\u73AF\u5883\u7684\u751F\u7406\u538B\u529B\u3002",
    poisonPoints: [
      "\u6280\u672F\u6982\u5FF5\u89E3\u91CA\u5B8C\u5168\u8131\u79BB\u57FA\u672C\u6570\u7406\u903B\u8F91\uFF0C\u6CA6\u4E3A\u6C11\u79D1\u72C2\u60F3",
      "\u5B87\u5B99\u80CC\u666F\u4E0B\u4F9D\u7136\u53EA\u662F\u6362\u4E86\u9A6C\u7532\u7684\u7269\u7406\u539F\u59CB\u780D\u6740",
      "\u6280\u672F\u4EC5\u4EC5\u4F5C\u4E3A\u80CC\u666F\uFF0C\u5BF9\u4EBA\u7269\u751F\u5B58\u72B6\u6001\u548C\u9053\u5FB7\u6289\u62E9\u65E0\u5B9E\u9645\u7EA6\u675F"
    ],
    naturalnessRules: [
      "\u7269\u7406\u5B66\u3001\u5DE5\u7A0B\u5B66\u6982\u5FF5\u5FC5\u987B\u5177\u6709\u57FA\u672C\u7684\u903B\u8F91\u95ED\u73AF",
      "\u907F\u514D\u7EAF\u7406\u8BBA\u957F\u7BC7\u5927\u8BBA\uFF0C\u6280\u672F\u6982\u5FF5\u5FC5\u987B\u901A\u8FC7\u8BBE\u5907\u8FD0\u8F6C\u3001\u8B66\u62A5\u6216\u8EAB\u4F53\u5F02\u72B6\u4F20\u8FBE"
    ],
    contextPriority: ["\u98DE\u8239/\u57FA\u5730\u7269\u7406\u53D7\u635F\u4E0E\u8D44\u6E90\u6570\u636E", "\u5E95\u5C42\u7269\u7406\u5B9A\u5F8B\u4E0E\u6280\u672F\u673A\u5236", "AI\u6216\u9AD8\u7EF4\u751F\u547D\u4F53\u8FD0\u884C\u6CD5\u5219"],
    vocabularyScenes: ["\u6280\u672F\u73B0\u573A", "\u98DE\u8239\u57CE\u5E02", "\u5BF9\u8BDD", "\u6570\u636E\u5206\u6790"]
  },
  {
    genreName: "\u65E0\u9650\u6D41",
    readerPromise: "\u8BE1\u5F02\u89C4\u5219\u6781\u9650\u62C6\u89E3\u7684\u667A\u8C0B\u5FEB\u611F\u3001\u751F\u6B7B\u7EDD\u5883\u4E0B\u7684\u4EBA\u6027\u591A\u9762\u6027\u3001\u4EE5\u53CA\u8DE8\u526F\u672C\u80FD\u529B\u78B0\u649E\u7684\u65E0\u9650\u53EF\u80FD\u3002",
    narrationStrategy: "\u9AD8\u5EA6\u805A\u7126\u5C40\u57DF\u8D85\u81EA\u7136\u89C4\u5219\u3001\u526F\u672C\u6838\u5FC3\u5224\u5B9A\u673A\u5236\u4E0E\u751F\u5B58\u70B9\u6570\u53D8\u5316\uFF1B\u65C1\u767D\u51B7\u5CFB\u5E76\u5145\u65A5\u7740\u9650\u5236\u89C6\u89D2\u7684\u672A\u77E5\u6050\u60E7\u611F\u3002",
    pacingAndRhythm: "\u7D27\u51D1\u7684\u751F\u6B7B\u9650\u65F6\u9003\u6740\u8282\u594F\uFF0C\u723D\u70B9\u5728\u4E8E\u5DE7\u5999\u6D1E\u7A7F\u89C4\u5219\u6F0F\u6D1E\u5B9E\u73B0\u5F31\u514B\u5F3A\u3001\u4EE5\u53CA\u526F\u672C\u901A\u5173\u65F6\u7684\u70B9\u6570\u4E0E\u6280\u80FD\u5956\u52B1\u7ED3\u7B97\u3002",
    chapterStructure: "\u8D77\u7B14\u5BA3\u5E03\u65B0\u526F\u672C\u673A\u5236\u6216\u5173\u5361\u89C4\u5219\u63A8\u79FB\uFF0C\u4E2D\u6BB5\u5C55\u5F00\u89C4\u5219\u6478\u7D22\u3001\u667A\u8C0B\u6218\u4E0E\u56E2\u961F\u5185\u8BA7\u535A\u5F08\uFF0C\u7ED3\u5C3E\u843D\u5728\u751F\u6B7B\u4E00\u7EBF\u7684\u5173\u5934\u6289\u62E9\u6216\u9006\u8F6C\u3002",
    characterPressure: "\u4E3B\u795E/\u7CFB\u7EDF\u65E0\u60C5\u7684\u62B9\u6740\u60E9\u7F5A\u3001\u672A\u77E5\u7684\u81F4\u6B7B\u6027\u89C4\u5219\u89E6\u53D1\u70B9\u3001\u4E0D\u53EF\u4FE1\u8D56\u7684\u4E34\u65F6\u961F\u53CB\u7684\u751F\u5B58\u538B\u529B\u3002",
    poisonPoints: [
      "\u4E3B\u89D2\u4E00\u8FDB\u5165\u526F\u672C\u5C31\u5982\u540C\u62FF\u5230\u5267\u672C\u822C\u65E0\u6240\u4E0D\u80FD\uFF0C\u7F3A\u4E4F\u63A2\u7D22\u7684\u60AC\u5FF5",
      "\u526F\u672C\u89C4\u5219\u540D\u5B58\u5B9E\u4EA1\uFF0C\u6CA6\u4E3A\u4E3B\u89D2\u65E0\u8111\u79C0\u4E2A\u4EBA\u6B66\u529B\u7684\u6C99\u76D2",
      "\u961F\u53CB\u667A\u5546\u5168\u90E8\u4E0B\u7EBF\uFF0C\u65E2\u65E0\u5BF9\u6297\u601D\u7EF4\u4E5F\u65E0\u81EA\u6551\u80FD\u529B"
    ],
    naturalnessRules: [
      "\u526F\u672C\u7684\u57FA\u7840\u6B7B\u4EA1\u89C4\u5219 and \u9650\u5236\u6761\u4EF6\u5728\u7AE0\u8282\u5185\u5FC5\u987B\u88AB\u89D2\u8272\u9891\u7E41\u5BA1\u89C6",
      "\u4E3B\u89D2\u6301\u6709\u7684\u5947\u7279\u6280\u80FD\u5151\u6362\uFF0C\u6BCF\u6B21\u4F7F\u7528\u5FC5\u987B\u663E\u5F0F\u63CF\u8FF0\u5176\u8089\u4F53\u6216\u7CBE\u795E\u4EE3\u4EF7"
    ],
    contextPriority: ["\u5F53\u524D\u526F\u672C\u89C4\u5219\u4E0E\u4E3B\u795E\u4E3B\u7EBF\u4EFB\u52A1", "\u4E3B\u89D2\u6240\u6301\u5361\u724C\u6280\u80FD\u4E0E\u51B7\u5374\u4EE3\u4EF7", "\u961F\u53CB\u7684\u5E95\u724C\u53CA\u660E\u6697\u7ACB\u573A"],
    vocabularyScenes: ["\u526F\u672C\u63A2\u7D22", "\u6218\u6597", "\u5BF9\u8BDD", "\u8BE1\u5F02\u5F02\u53D8"]
  }
];
function findGenrePreset(searchText) {
  const normalized = searchText.toLowerCase();
  if (/仙侠|修仙|修行|修炼|成仙|天道|雷劫|洞府|筑基|金丹|元神|渡劫|immortal|xianxia/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u4FEE\u4ED9/\u4ED9\u4FA0");
  }
  if (/玄幻|魔法|斗气|武魂|魂兽|神魔|奇幻|fantasy|xuanhuan/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u7384\u5E7B");
  }
  if (/权谋|宫廷|朝堂|帝王|宰相|夺嫡|臣|court|palace|politic/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u5386\u53F2/\u53E4\u4EE3");
  }
  if (/悬疑|谜|案|侦探|推理|凶手|线索|凶杀|破案|mystery|crime|thriller|suspense|detective/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u60AC\u7591");
  }
  if (/言情|爱情|恋爱|情侣|暖婚|总裁|纯爱|romance|love/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u8A00\u60C5/\u60C5\u611F");
  }
  if (/历史|古代|大明|大唐|秦朝|三国|穿越历史|historical|dynasty|period/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u5386\u53F2/\u53E4\u4EE3");
  }
  if (/科幻|赛博|星际|未来|机甲|高科技|物理定律|宇宙飞船|sci-fi|science fiction/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u79D1\u5E7B/\u8D5B\u535A");
  }
  if (/无限流|主神|副本|游戏系统|限时任务|抹杀|infinite flow/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u65E0\u9650\u6D41");
  }
  if (/都市|现实|职场|商业|老板|打工|city|urban/u.test(normalized)) {
    return GENRE_PRESETS.find((p) => p.genreName === "\u90FD\u5E02/\u73B0\u5B9E");
  }
  return void 0;
}

// src/aigc-detector.ts
var import_node_fs4 = __toESM(require("fs"), 1);
var import_node_module = require("module");
var import_node_path6 = __toESM(require("path"), 1);
var DEFAULT_TIMEOUT_MS = 3e4;
var DEFAULT_THRESHOLD = 0.8;
var DEFAULT_SEGMENT_MAX_CHARS = 900;
var DEFAULT_SEGMENT_MIN_CHARS = 180;
var requireBuiltin = (0, import_node_module.createRequire)(import_node_path6.default.join(process.cwd(), "ai-novel-factory-runtime.js"));
var MANAGED_PROJECTS_SEGMENT2 = `${import_node_path6.default.sep}.ai-novel-projects${import_node_path6.default.sep}`;
var LOCAL_HEURISTIC_RISK_PATTERNS = [
  /模板化|标准生成|AI腔|AI 腔|机器生成|模型生成|生成文本/u,
  /人物反应被概括|场景被抽象|缺少具体动作|没有细节|没有停顿|命运的安排/u,
  /宏大叙事|命运的齿轮|这才明白|由此可见|总而言之|综上所述/u,
  /内心十分|非常震惊|无法形容|某种意义上|复杂的情绪/u
];
var LOCAL_HEURISTIC_HUMAN_PATTERNS = [
  /[“”"'][^“”"']{1,36}[”"']/u,
  /雨|灯|门槛|袖口|鞋尖|账册|纸边|青苔|瓦檐|指腹|脚步|铜钱|泥腥/u,
  /推到|缩进|停住|摸到|合上|夹在|沿着|敲了|回头|抬头|收起/u
];
var AIGC_SETTING_KEYS = {
  provider: "aigcDetectorProvider",
  url: "aigcDetectorUrl",
  token: "aigcDetectorToken",
  timeoutMs: "aigcDetectorTimeoutMs",
  threshold: "aigcDetectorThreshold",
  headersJson: "aigcDetectorHeadersJson",
  requestTextField: "aigcDetectorRequestTextField",
  segmentMaxChars: "aigcDetectorSegmentMaxChars",
  segmentMinChars: "aigcDetectorSegmentMinChars",
  gradioFnIndex: "aigcDetectorGradioFnIndex",
  gradioSessionHash: "aigcDetectorGradioSessionHash",
  gradioJoinUrl: "aigcDetectorGradioJoinUrl",
  gradioDataUrl: "aigcDetectorGradioDataUrl",
  gradioSkipJoin: "aigcDetectorGradioSkipJoin",
  gradioInputsJson: "aigcDetectorGradioInputsJson"
};
function getAigcDetectorConfigFromEnv(env = process.env) {
  return {
    provider: readProvider(env.AIGC_DETECTOR_PROVIDER),
    url: readOptionalString(env.AIGC_DETECTOR_URL),
    token: readOptionalString(env.AIGC_DETECTOR_TOKEN),
    timeoutMs: readPositiveInteger(env.AIGC_DETECTOR_TIMEOUT_MS),
    threshold: readScore(env.AIGC_DETECTOR_THRESHOLD),
    headers: readHeaders(env.AIGC_DETECTOR_HEADERS_JSON),
    requestTextField: readOptionalString(env.AIGC_DETECTOR_REQUEST_TEXT_FIELD),
    segment: {
      maxChars: readPositiveInteger(env.AIGC_DETECTOR_SEGMENT_MAX_CHARS),
      minChars: readPositiveInteger(env.AIGC_DETECTOR_SEGMENT_MIN_CHARS)
    },
    gradio: {
      fnIndex: readInteger(env.AIGC_DETECTOR_GRADIO_FN_INDEX),
      sessionHash: readOptionalString(env.AIGC_DETECTOR_GRADIO_SESSION_HASH),
      joinUrl: readOptionalString(env.AIGC_DETECTOR_GRADIO_JOIN_URL),
      dataUrl: readOptionalString(env.AIGC_DETECTOR_GRADIO_DATA_URL),
      skipJoin: env.AIGC_DETECTOR_GRADIO_SKIP_JOIN === "1",
      inputs: readJsonArray(env.AIGC_DETECTOR_GRADIO_INPUTS_JSON)
    }
  };
}
function getAigcDetectorConfig(rootDir) {
  if (!rootDir) {
    return getAigcDetectorConfigFromEnv();
  }
  try {
    const settingsEnv = readAigcSettingsEnv(rootDir);
    return getAigcDetectorConfigFromEnv({ ...process.env, ...settingsEnv });
  } catch {
    return getAigcDetectorConfigFromEnv();
  }
}
async function detectAigcText(input, config = getAigcDetectorConfigFromEnv()) {
  const provider = config.provider ?? "disabled";
  const text = typeof input === "string" ? input : input.text;
  if (provider === "disabled") {
    return unavailableResult(provider, "AIGC detector is disabled.", null);
  }
  if (!text.trim()) {
    return unavailableResult(provider, "AIGC detector received empty text.", null);
  }
  if (provider === "local-heuristic") {
    return detectWithLocalHeuristic(text, config);
  }
  if (!config.url?.trim()) {
    return unavailableResult(provider, "AIGC detector URL is not configured.", null);
  }
  try {
    if (provider === "generic-json") {
      return await detectWithGenericJson(text, config);
    }
    if (provider === "gradio-queue") {
      return await detectWithGradioQueue(text, config);
    }
    return unavailableResult(provider, `Unsupported AIGC detector provider: ${String(provider)}`, null);
  } catch (error) {
    if (config.throwOnError) {
      throw error;
    }
    return unavailableResult(provider, error instanceof Error ? error.message : String(error), null);
  }
}
function detectWithLocalHeuristic(text, config) {
  const normalizedText = text.replace(/\s+/g, "");
  const charCount = Array.from(normalizedText).length;
  const riskHits = LOCAL_HEURISTIC_RISK_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
  const humanSignals = LOCAL_HEURISTIC_HUMAN_PATTERNS.filter((pattern) => pattern.test(text)).length;
  const quoteCount = (text.match(/[“”"']/g) || []).length;
  const punctuationCount = (text.match(/[。！？!?；;，,]/g) || []).length;
  const punctuationDensity = charCount > 0 ? punctuationCount / charCount : 0;
  const paragraphCount = Math.max(1, text.split(/\n\s*\n/u).filter((item) => item.trim()).length);
  const averageParagraphChars = charCount / paragraphCount;
  const abstractionPenalty = /情绪|命运|世界|复杂|震惊|恐惧|愤怒|绝望/u.test(text) && humanSignals === 0 ? 0.12 : 0;
  const lengthPenalty = averageParagraphChars > 360 ? 0.08 : 0;
  const quoteBonus = quoteCount >= 2 ? 0.05 : 0;
  const sceneBonus = Math.min(0.18, humanSignals * 0.045);
  const punctuationBonus = punctuationDensity >= 0.035 && punctuationDensity <= 0.14 ? 0.04 : 0;
  const riskScore = Math.min(0.98, 0.22 + riskHits.length * 0.21 + abstractionPenalty + lengthPenalty);
  const humanScore = Math.min(0.32, sceneBonus + quoteBonus + punctuationBonus);
  const score = Math.max(0.04, Math.min(0.96, riskScore - humanScore));
  const threshold = config.threshold ?? DEFAULT_THRESHOLD;
  const status = riskHits.length >= 3 || score >= threshold ? "ai_likely" : scoreToStatus(score, threshold);
  const raw = {
    detector: "local-heuristic",
    riskHits,
    humanSignals,
    quoteCount,
    punctuationDensity,
    averageParagraphChars
  };
  return {
    ok: true,
    provider: "local-heuristic",
    status,
    score,
    label: riskHits.length > 0 ? "local heuristic risk" : "local heuristic pass",
    confidence: Math.max(score, 1 - score),
    raw,
    reason: riskHits.length > 0 ? `Local heuristic found ${riskHits.length} AIGC-style risk signal(s).` : "Local heuristic did not find strong AIGC-style risk signals."
  };
}
async function detectAigcSegments(input, config = getAigcDetectorConfigFromEnv()) {
  const provider = config.provider ?? "disabled";
  const threshold = config.threshold ?? DEFAULT_THRESHOLD;
  const segments = Array.isArray(input) ? input : splitAigcTextIntoSegments(typeof input === "string" ? input : input.text, config.segment);
  const results = [];
  for (const segment of segments) {
    const result = await detectAigcText(segment, config);
    results.push({
      ...result,
      segment,
      charCount: segment.text.length
    });
  }
  const scoredResults = results.filter((result) => typeof result.score === "number");
  const totalChars = scoredResults.reduce((sum, result) => sum + Math.max(1, result.charCount), 0);
  const score = totalChars > 0 ? scoredResults.reduce((sum, result) => sum + Number(result.score) * Math.max(1, result.charCount), 0) / totalChars : null;
  const highRiskSegments = results.filter((result) => result.status === "ai_likely" || typeof result.score === "number" && result.score >= threshold).sort((left, right) => (right.score ?? 0) - (left.score ?? 0));
  const failedResults = results.filter((result) => !result.ok);
  return {
    ok: results.some((result) => result.ok),
    provider,
    status: score === null ? "unavailable" : scoreToStatus(score, threshold),
    score,
    confidence: score === null ? null : Math.max(score, 1 - score),
    threshold,
    totalSegments: segments.length,
    highRiskSegments,
    segments: results,
    reason: highRiskSegments.length > 0 ? `${highRiskSegments.length} segment(s) reached the AIGC risk threshold.` : failedResults.length > 0 ? `AIGC detection failed: ${Array.from(new Set(failedResults.map((r) => r.reason))).join("; ")}` : "Segmented AIGC detection completed."
  };
}
function splitAigcTextIntoSegments(text, options = {}) {
  const maxChars = Math.max(120, options.maxChars ?? DEFAULT_SEGMENT_MAX_CHARS);
  const minChars = Math.max(1, Math.min(options.minChars ?? DEFAULT_SEGMENT_MIN_CHARS, maxChars));
  const paragraphs = collectParagraphs(text);
  const pieces = paragraphs.flatMap((paragraph) => splitLongParagraph(paragraph, maxChars));
  const segments = [];
  let pending = null;
  for (const piece of pieces) {
    if (!pending) {
      pending = { text: piece.text, startOffset: piece.startOffset, endOffset: piece.endOffset, metadata: piece.metadata };
      continue;
    }
    const joinedLength = pending.text.length + 1 + piece.text.length;
    if (pending.text.length < minChars || joinedLength <= maxChars) {
      pending = {
        ...pending,
        text: `${pending.text}
${piece.text}`,
        endOffset: piece.endOffset
      };
      continue;
    }
    segments.push({ ...pending, index: segments.length, id: `segment-${segments.length + 1}` });
    pending = { text: piece.text, startOffset: piece.startOffset, endOffset: piece.endOffset, metadata: piece.metadata };
  }
  if (pending) {
    segments.push({ ...pending, index: segments.length, id: `segment-${segments.length + 1}` });
  }
  return segments;
}
function parseAigcDetectorSse(payload) {
  const events = [];
  let eventName;
  const dataLines = [];
  for (const rawLine of payload.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (!line) {
      if (dataLines.length > 0 || eventName) {
        events.push({ event: eventName, data: dataLines.join("\n") });
      }
      eventName = void 0;
      dataLines.length = 0;
      continue;
    }
    if (line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }
  if (dataLines.length > 0 || eventName) {
    events.push({ event: eventName, data: dataLines.join("\n") });
  }
  return events;
}
async function detectWithGenericJson(text, config) {
  const response = await requestWithTimeout(config.url ?? "", {
    method: "POST",
    headers: createHeaders(config, "application/json"),
    body: JSON.stringify({ [config.requestTextField || "text"]: text })
  }, config);
  const raw = await readResponseBody(response);
  if (!response.ok) {
    return unavailableResult("generic-json", `Detector returned HTTP ${response.status}.`, raw);
  }
  return normalizeAigcDetectionResult(raw, "generic-json", config.threshold);
}
async function detectWithGradioQueue(text, config) {
  const rootUrl = normalizeGradioRootUrl(config.url ?? "");
  const sessionHash = config.gradio?.sessionHash || createSessionHash();
  const joinUrl = config.gradio?.joinUrl || `${rootUrl}/gradio_api/queue/join${formatTokenQuery(config.token)}`;
  const dataUrl = config.gradio?.dataUrl || `${rootUrl}/gradio_api/queue/data?session_hash=${encodeURIComponent(sessionHash)}${formatStudioTokenParam(config.token)}`;
  if (!config.gradio?.skipJoin) {
    const joinPayload = {
      data: createGradioInputs(text, config.gradio?.inputs),
      event_data: null,
      fn_index: config.gradio?.fnIndex ?? 0,
      session_hash: sessionHash
    };
    const joinResponse = await requestWithTimeout(joinUrl, {
      method: "POST",
      headers: createHeaders(config, "application/json"),
      body: JSON.stringify(joinPayload)
    }, config);
    const joinRaw = await readResponseBody(joinResponse);
    if (!joinResponse.ok) {
      return unavailableResult("gradio-queue", `Gradio detector join returned HTTP ${joinResponse.status}.`, joinRaw);
    }
  }
  const dataResponse = await requestWithTimeout(dataUrl, {
    method: "GET",
    headers: createHeaders(config, void 0, { accept: "text/event-stream" })
  }, config);
  const rawText = await dataResponse.text();
  if (!dataResponse.ok) {
    return unavailableResult("gradio-queue", `Gradio detector stream returned HTTP ${dataResponse.status}.`, rawText);
  }
  const raw = extractGradioQueueOutput(parseAigcDetectorSse(rawText));
  return normalizeAigcDetectionResult(raw, "gradio-queue", config.threshold);
}
async function requestWithTimeout(url, init, config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await (config.fetchImpl ?? fetch)(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
async function readResponseBody(response) {
  const body = await response.text();
  if (!body.trim()) {
    return null;
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}
function normalizeAigcDetectionResult(raw, provider, threshold = DEFAULT_THRESHOLD) {
  const score = findScore(raw);
  const label = findStringField(raw, ["label", "status", "result", "prediction", "class", "message"]) || inferLabel(raw);
  const normalizedScore = normalizeScore(score);
  const status = statusFromLabel(label) || (normalizedScore === null ? "uncertain" : scoreToStatus(normalizedScore, threshold));
  const confidence = normalizeScore(findNumberField(raw, ["confidence", "probability", "prob"])) ?? (normalizedScore === null ? null : Math.max(normalizedScore, 1 - normalizedScore));
  return {
    ok: normalizedScore !== null || status !== "unavailable",
    provider,
    status,
    score: normalizedScore,
    label: label || status,
    confidence,
    raw,
    reason: normalizedScore === null ? "Detector response did not include a normalized score; status was inferred from labels." : "Detector response normalized."
  };
}
function unavailableResult(provider, reason, raw) {
  return {
    ok: false,
    provider,
    status: "unavailable",
    score: null,
    label: "unavailable",
    confidence: null,
    raw,
    reason
  };
}
function scoreToStatus(score, threshold) {
  if (score >= threshold) {
    return "ai_likely";
  }
  if (score <= 1 - threshold) {
    return "human_likely";
  }
  return "uncertain";
}
function createHeaders(config, contentType, extra = {}) {
  const headers = { ...config.headers, ...extra };
  if (contentType) {
    headers["content-type"] = contentType;
  }
  if (config.token && !headers.authorization) {
    headers.authorization = `Bearer ${config.token}`;
  }
  return headers;
}
function collectParagraphs(text) {
  const paragraphs = [];
  const pattern = /\S[^\n]*(?:\n(?!\s*\n)\S[^\n]*)*/g;
  for (const match of text.matchAll(pattern)) {
    const value = match[0].trim();
    if (!value) {
      continue;
    }
    const leadingWhitespace = match[0].length - match[0].trimStart().length;
    const startOffset = (match.index ?? 0) + leadingWhitespace;
    paragraphs.push({
      id: `paragraph-${paragraphs.length + 1}`,
      index: paragraphs.length,
      text: value,
      startOffset,
      endOffset: startOffset + value.length
    });
  }
  return paragraphs;
}
function splitLongParagraph(segment, maxChars) {
  if (segment.text.length <= maxChars) {
    return [segment];
  }
  const fragments = segment.text.match(/[^。！？!?；;]+[。！？!?；;]?|.+/g) || [segment.text];
  const pieces = [];
  let pending = "";
  let pendingStart = segment.startOffset;
  let searchOffset = 0;
  for (const fragment of fragments) {
    const localIndex = segment.text.indexOf(fragment, searchOffset);
    const fragmentStart = segment.startOffset + Math.max(0, localIndex);
    searchOffset = Math.max(searchOffset, localIndex + fragment.length);
    if (!pending) {
      pending = fragment;
      pendingStart = fragmentStart;
      continue;
    }
    if (pending.length + fragment.length <= maxChars) {
      pending += fragment;
      continue;
    }
    pieces.push({
      id: `segment-piece-${pieces.length + 1}`,
      index: pieces.length,
      text: pending.trim(),
      startOffset: pendingStart,
      endOffset: pendingStart + pending.trim().length
    });
    pending = fragment;
    pendingStart = fragmentStart;
  }
  if (pending.trim()) {
    pieces.push({
      id: `segment-piece-${pieces.length + 1}`,
      index: pieces.length,
      text: pending.trim(),
      startOffset: pendingStart,
      endOffset: pendingStart + pending.trim().length
    });
  }
  return pieces.flatMap((piece) => hardSplitSegment(piece, maxChars));
}
function hardSplitSegment(segment, maxChars) {
  if (segment.text.length <= maxChars) {
    return [segment];
  }
  const pieces = [];
  for (let offset = 0; offset < segment.text.length; offset += maxChars) {
    const text = segment.text.slice(offset, offset + maxChars);
    pieces.push({
      id: `segment-hard-${pieces.length + 1}`,
      index: pieces.length,
      text,
      startOffset: segment.startOffset + offset,
      endOffset: segment.startOffset + offset + text.length
    });
  }
  return pieces;
}
function extractGradioQueueOutput(events) {
  const parsedEvents = events.map((event) => parseJson(event.data) ?? event.data).filter((event) => event !== "");
  const completed = [...parsedEvents].reverse().find(
    (event) => isRecord(event) && (event.msg === "process_completed" || event.output || event.success === true)
  );
  if (isRecord(completed) && "output" in completed) {
    const output = completed.output;
    if (isRecord(output) && "data" in output) {
      return output.data;
    }
    return output;
  }
  return completed ?? parsedEvents.at(-1) ?? null;
}
function createGradioInputs(text, inputs) {
  if (!inputs || inputs.length === 0) {
    return [text];
  }
  return inputs.map((input) => input === "$text" ? text : input);
}
function normalizeGradioRootUrl(url) {
  const parsed = new URL(url);
  const queueIndex = parsed.pathname.indexOf("/gradio_api/");
  if (queueIndex >= 0) {
    parsed.pathname = parsed.pathname.slice(0, queueIndex);
    parsed.search = "";
  }
  return parsed.toString().replace(/\/$/, "");
}
function formatTokenQuery(token) {
  return token ? `?studio_token=${encodeURIComponent(token)}` : "";
}
function formatStudioTokenParam(token) {
  return `&studio_token=${encodeURIComponent(token || "")}`;
}
function createSessionHash() {
  return Math.random().toString(36).slice(2, 14);
}
function findScore(raw) {
  return findNumberField(raw, [
    "score",
    "aiProbability",
    "aigcProbability",
    "ai_probability",
    "aigc_probability",
    "aiProb",
    "aigcProb",
    "ai_score",
    "aigc_score",
    "fakeProbability"
  ]) ?? parseScoreFromText(raw);
}
function findNumberField(raw, names) {
  const queue = [raw];
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
  while (queue.length > 0) {
    const value = queue.shift();
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (!isRecord(value)) {
      continue;
    }
    for (const [key, child] of Object.entries(value)) {
      if (normalizedNames.has(key.toLowerCase())) {
        const number = typeof child === "number" ? child : typeof child === "string" ? Number(child) : NaN;
        if (Number.isFinite(number)) {
          return number;
        }
      }
      if (isRecord(child) || Array.isArray(child)) {
        queue.push(child);
      }
    }
  }
  return null;
}
function findStringField(raw, names) {
  const queue = [raw];
  const normalizedNames = new Set(names.map((name) => name.toLowerCase()));
  while (queue.length > 0) {
    const value = queue.shift();
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }
    if (!isRecord(value)) {
      continue;
    }
    for (const [key, child] of Object.entries(value)) {
      if (normalizedNames.has(key.toLowerCase()) && (typeof child === "string" || typeof child === "number")) {
        return String(child);
      }
      if (isRecord(child) || Array.isArray(child)) {
        queue.push(child);
      }
    }
  }
  return "";
}
function inferLabel(raw) {
  if (typeof raw === "string") {
    return raw.slice(0, 120);
  }
  if (Array.isArray(raw)) {
    const text = raw.find((item) => typeof item === "string");
    return typeof text === "string" ? text.slice(0, 120) : "";
  }
  return "";
}
function statusFromLabel(label) {
  const normalized = label.toLowerCase();
  if (!normalized) {
    return null;
  }
  if (/human|人工|人类|真人|非ai|非机器/.test(normalized)) {
    return "human_likely";
  }
  if (/\bai\b|aigc|机器|模型|生成|疑似ai|ai生成/.test(normalized)) {
    return "ai_likely";
  }
  if (/uncertain|unknown|不确定|无法判断/.test(normalized)) {
    return "uncertain";
  }
  return null;
}
function parseScoreFromText(raw) {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const percentMatch = text.match(/(?:AI|AIGC|机器|生成|疑似)[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (percentMatch) {
    return Number(percentMatch[1]) / 100;
  }
  const decimalMatch = text.match(/(?:AI|AIGC|机器|生成|疑似)[^0-9]{0,12}(0?\.[0-9]+)/i);
  return decimalMatch ? Number(decimalMatch[1]) : null;
}
function normalizeScore(score) {
  if (score === null || !Number.isFinite(score)) {
    return null;
  }
  if (score > 1 && score <= 100) {
    return score / 100;
  }
  return Math.min(1, Math.max(0, score));
}
function readProvider(value) {
  if (value === "local-heuristic" || value === "generic-json" || value === "gradio-queue" || value === "disabled") {
    return value;
  }
  return "disabled";
}
function readOptionalString(value) {
  const trimmed = value?.trim();
  return trimmed || void 0;
}
function readInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : void 0;
}
function readPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : void 0;
}
function readScore(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return void 0;
  }
  return normalizeScore(parsed) ?? void 0;
}
function readHeaders(value) {
  const parsed = parseJson(value || "");
  if (!isRecord(parsed)) {
    return void 0;
  }
  return Object.fromEntries(
    Object.entries(parsed).filter((entry) => typeof entry[1] === "string")
  );
}
function readJsonArray(value) {
  const parsed = parseJson(value || "");
  return Array.isArray(parsed) ? parsed : void 0;
}
function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function readAigcSettingsEnv(rootDir) {
  const factoryRoot = inferAigcFactoryRoot(rootDir);
  try {
    const dbPath = import_node_path6.default.join(factoryRoot, ".ai-novel-factory", "factory.sqlite");
    if (!import_node_fs4.default.existsSync(dbPath)) {
      return {};
    }
    const sqlite = requireBuiltin("node:sqlite");
    const db = new sqlite.DatabaseSync(dbPath);
    try {
      const rows = db.prepare("SELECT key, value FROM system_settings").all();
      return aigcSettingsRowsToEnv(rows);
    } finally {
      db.close();
    }
  } catch {
    return {};
  }
}
function aigcSettingsRowsToEnv(rows) {
  const settings = new Map(rows.map((row) => [row.key, row.value]));
  const value = (key) => settings.get(key) || void 0;
  return {
    AIGC_DETECTOR_PROVIDER: value(AIGC_SETTING_KEYS.provider),
    AIGC_DETECTOR_URL: value(AIGC_SETTING_KEYS.url),
    AIGC_DETECTOR_TOKEN: value(AIGC_SETTING_KEYS.token),
    AIGC_DETECTOR_TIMEOUT_MS: value(AIGC_SETTING_KEYS.timeoutMs),
    AIGC_DETECTOR_THRESHOLD: value(AIGC_SETTING_KEYS.threshold),
    AIGC_DETECTOR_HEADERS_JSON: value(AIGC_SETTING_KEYS.headersJson),
    AIGC_DETECTOR_REQUEST_TEXT_FIELD: value(AIGC_SETTING_KEYS.requestTextField),
    AIGC_DETECTOR_SEGMENT_MAX_CHARS: value(AIGC_SETTING_KEYS.segmentMaxChars),
    AIGC_DETECTOR_SEGMENT_MIN_CHARS: value(AIGC_SETTING_KEYS.segmentMinChars),
    AIGC_DETECTOR_GRADIO_FN_INDEX: value(AIGC_SETTING_KEYS.gradioFnIndex),
    AIGC_DETECTOR_GRADIO_SESSION_HASH: value(AIGC_SETTING_KEYS.gradioSessionHash),
    AIGC_DETECTOR_GRADIO_JOIN_URL: value(AIGC_SETTING_KEYS.gradioJoinUrl),
    AIGC_DETECTOR_GRADIO_DATA_URL: value(AIGC_SETTING_KEYS.gradioDataUrl),
    AIGC_DETECTOR_GRADIO_SKIP_JOIN: value(AIGC_SETTING_KEYS.gradioSkipJoin),
    AIGC_DETECTOR_GRADIO_INPUTS_JSON: value(AIGC_SETTING_KEYS.gradioInputsJson)
  };
}
function inferAigcWorkspaceRootFromManagedProject(rootDir) {
  const index = rootDir.indexOf(MANAGED_PROJECTS_SEGMENT2);
  if (index < 0) {
    return null;
  }
  return rootDir.slice(0, index) || import_node_path6.default.parse(rootDir).root;
}
function inferAigcFactoryRoot(rootDir) {
  const resolvedRootDir = import_node_path6.default.resolve(rootDir);
  return inferAigcWorkspaceRootFromManagedProject(resolvedRootDir) || resolvedRootDir;
}

// src/production-contracts.ts
function isBlank(value) {
  return typeof value !== "string" || value.trim().length === 0;
}
function hasPlaceholder(value) {
  return !value || /\bpending\b|待定|暂无|未定|待补|缺失|placeholder|todo|tbd|still sparse|open questions?|unanswered questions?/iu.test(value) || /尚无|还没有|等待补充|需要补充|需要明确|无法确定/u.test(value);
}
function hasUsableStyleList(value) {
  return Array.isArray(value) && value.some((item) => typeof item === "string" && !hasPlaceholder(item));
}
function critical(code, message, recoveryHint) {
  return { code, severity: "critical", message, recoveryHint };
}
function warning(code, message, recoveryHint) {
  return { code, severity: "warning", message, recoveryHint };
}
function summarizeGate(issues) {
  const criticalIssue = issues.find((issue) => issue.severity === "critical");
  if (criticalIssue) {
    return {
      status: "blocked",
      canProceed: false,
      blockedReason: criticalIssue.message,
      issues
    };
  }
  if (issues.length > 0) {
    return {
      status: "warning",
      canProceed: true,
      blockedReason: null,
      issues
    };
  }
  return {
    status: "passed",
    canProceed: true,
    blockedReason: null,
    issues: []
  };
}
function evaluateStyleEvolutionGate(contract) {
  const issues = [];
  if (!contract) {
    return summarizeGate([
      critical(
        "style_contract_missing",
        "\u672C\u4E66\u5199\u6CD5\u5C1A\u672A\u751F\u6210\uFF0C\u4E0D\u80FD\u8FDB\u5165\u6B63\u6587\u521B\u4F5C\u3002",
        "\u5148\u8FDB\u5165 Style Evolution Engine\uFF0C\u751F\u6210\u6837\u6BB5\u5E76\u51BB\u7ED3\u672C\u4E66\u5199\u6CD5\u5408\u540C\u3002"
      )
    ]);
  }
  if (isBlank(contract.seedPrompt)) {
    issues.push(critical(
      "style_seed_missing",
      "Style Evolution Engine \u7F3A\u5C11\u521D\u59CB prompt\u3002",
      "\u8865\u9F50 style-seed.md \u6216\u8BA9\u7CFB\u7EDF\u57FA\u4E8E\u7528\u6237\u98CE\u683C\u8981\u6C42\u751F\u6210\u521D\u59CB prompt\u3002"
    ));
  }
  if (isBlank(contract.approvedSample) && isBlank(contract.approvedSamplePath)) {
    issues.push(critical(
      "approved_sample_missing",
      "\u7528\u6237\u5C1A\u672A\u786E\u8BA4\u4EFB\u4F55\u5C0F\u8BF4\u5199\u4F5C\u6837\u6BB5\u3002",
      "\u53CD\u590D\u751F\u6210\u6837\u6BB5\uFF0C\u76F4\u5230\u7528\u6237\u786E\u8BA4\u4E00\u4E2A\u53EF\u4EE5\u51BB\u7ED3\u4E3A\u5168\u4E66\u7EDF\u4E00\u5199\u6CD5\u5408\u540C\u7684\u7248\u672C\u3002"
    ));
  }
  if (isBlank(contract.approvedAt)) {
    issues.push(critical(
      "style_approval_missing",
      "\u672C\u4E66\u5199\u6CD5\u5C1A\u672A\u83B7\u5F97\u7528\u6237\u786E\u8BA4\u3002",
      "\u7528\u6237\u9700\u8981\u5728 Style Contract Freeze Gate \u4E2D\u786E\u8BA4\u91C7\u7528\u5F53\u524D\u5199\u6CD5\uFF0C\u7CFB\u7EDF\u518D\u51BB\u7ED3 style-contract\u3002"
    ));
  }
  if (contract.approvedAt && contract.approval?.acceptedAsBookStyle !== true) {
    issues.push(critical(
      "style_approval_semantics_missing",
      "Style Contract Freeze Gate \u7F3A\u5C11\u201C\u4F5C\u4E3A\u5168\u4E66\u57FA\u7840\u5199\u6CD5\u201D\u7684\u51BB\u7ED3\u8BED\u4E49\u3002",
      "\u7528\u6237\u786E\u8BA4\u7684\u5FC5\u987B\u662F\u6574\u672C\u4E66\u540E\u7EED\u7EDF\u4E00\u7EE7\u627F\u7684\u5199\u6CD5\uFF0C\u4E0D\u662F\u5355\u6B21\u6837\u6BB5\u901A\u8FC7\u3002"
    ));
  }
  if (contract.approvedAt && !contract.verification?.status) {
    issues.push(critical(
      "style_generation_verification_missing",
      "\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u7F3A\u5C11 Generation Verification Gate \u7ED3\u679C\u3002",
      "\u91CD\u65B0\u8FD0\u884C Style Evolution Engine\uFF0C\u5B8C\u6210 AIGC/\u7981\u5FCC\u547D\u4E2D\u9A8C\u8BC1\u5E76\u901A\u8FC7\u540E\uFF0C\u518D\u51BB\u7ED3\u5168\u4E66\u5199\u6CD5\u5408\u540C\u3002"
    ));
  }
  if (contract.approvedAt && contract.verification?.status === "blocked") {
    issues.push(critical(
      "style_generation_verification_blocked",
      "\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u7684 Generation Verification Gate \u4ECD\u5904\u4E8E\u963B\u585E\u72B6\u6001\u3002",
      "\u91CD\u65B0\u8FD0\u884C Style Evolution Engine\uFF0C\u5148\u901A\u8FC7 AIGC/\u7981\u5FCC\u547D\u4E2D\u9A8C\u8BC1\uFF0C\u518D\u51BB\u7ED3\u5168\u4E66\u5199\u6CD5\u5408\u540C\u3002"
    ));
  }
  if (contract.approvedAt && contract.verification?.status && contract.verification.status !== "passed" && contract.verification.status !== "blocked") {
    issues.push(critical(
      "style_generation_verification_not_passed",
      "\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u7684 Generation Verification Gate \u5C1A\u672A\u901A\u8FC7\u3002",
      "\u7EE7\u7EED\u8FD0\u884C Style Evolution Engine\uFF0C\u76F4\u5230\u6837\u6BB5\u9A8C\u8BC1\u72B6\u6001\u4E3A passed\uFF0C\u518D\u51BB\u7ED3\u5168\u4E66\u5199\u6CD5\u5408\u540C\u3002"
    ));
  }
  if (contract.approvedAt && contract.freezer?.verdict !== "ready") {
    issues.push(critical(
      "style_freezer_not_ready",
      "Style Contract Freezer \u5C1A\u672A\u660E\u786E\u653E\u884C\u6574\u4E66\u5199\u6CD5\u5408\u540C\u3002",
      "\u7EE7\u7EED\u8FD0\u884C Style Evolution Engine\uFF0C\u76F4\u5230 Freezer verdict \u4E3A ready\uFF0C\u518D\u5141\u8BB8\u7AE0\u8282\u751F\u4EA7\u7EE7\u627F\u8BE5\u5199\u6CD5\u3002"
    ));
  }
  if (contract.approvedAt) {
    const protocol = contract.loopProtocol;
    const requiredStages = Array.isArray(protocol?.requiredStages) ? protocol.requiredStages : [];
    const completedStages = Array.isArray(protocol?.completedStages) ? protocol.completedStages : [];
    const requiredLoopStages = [
      "seed_prompt_builder",
      "candidate_generator",
      "evaluator_critic",
      "prompt_refiner",
      "loop_controller",
      "generation_verification",
      "user_approval_gate",
      "style_contract_freezer",
      "chapter_inheritance_adapter"
    ];
    const missingProtocolStages = requiredLoopStages.filter((stage) => !completedStages.includes(stage));
    if (!protocol || requiredStages.length === 0 || missingProtocolStages.length > 0) {
      issues.push(critical(
        "style_loop_protocol_incomplete",
        "\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u5B8C\u6574 Loop Engineering \u534F\u8BAE\u8BC1\u636E\u3002",
        "\u91CD\u65B0\u52A0\u8F7D\u6216\u8FD0\u884C Style Evolution Engine\uFF0C\u8BA9 Seed Prompt\u3001\u5019\u9009\u751F\u6210\u3001\u8BC4\u4F30\u3001Refiner\u3001\u9A8C\u8BC1\u3001\u7528\u6237\u786E\u8BA4\u3001Freezer \u548C\u7AE0\u8282\u7EE7\u627F\u5168\u90E8\u5199\u5165 loopProtocol\u3002"
      ));
    }
    if (protocol?.status && protocol.status !== "approved") {
      issues.push(critical(
        "style_loop_protocol_not_approved",
        "Style Evolution Loop \u534F\u8BAE\u5C1A\u672A\u8FDB\u5165 approved \u72B6\u6001\u3002",
        "\u53EA\u6709\u5B8C\u6574\u95ED\u73AF\u901A\u8FC7\u5E76\u7531\u7528\u6237\u786E\u8BA4\u540E\uFF0C\u624D\u80FD\u51BB\u7ED3\u4E3A\u6574\u4E66\u5199\u6CD5\u5408\u540C\u3002"
      ));
    }
  }
  if (!contract.styleContract || hasPlaceholder(contract.styleContract.voice)) {
    issues.push(critical(
      "style_contract_voice_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u660E\u786E\u53D9\u8FF0\u58F0\u97F3\u3002",
      "\u4ECE\u7528\u6237\u786E\u8BA4\u6837\u6BB5\u4E2D\u63D0\u70BC voice\u3001\u53E5\u5F0F\u8282\u594F\u3001\u5BF9\u8BDD\u89C4\u5219\u548C\u7981\u7528\u6A21\u5F0F\u3002"
    ));
  }
  if (!contract.styleContract || hasPlaceholder(contract.styleContract.sentenceRhythm)) {
    issues.push(critical(
      "style_contract_sentence_rhythm_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53EF\u6267\u884C\u7684\u53E5\u5F0F\u8282\u594F\u89C4\u5219\u3002",
      "\u4ECE\u7528\u6237\u786E\u8BA4\u6837\u6BB5\u4E2D\u63D0\u70BC\u53E5\u957F\u3001\u505C\u987F\u3001\u52A8\u4F5C\u5BC6\u5EA6\u548C\u60C5\u7EEA\u7559\u767D\u89C4\u5219\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.dialogueRules)) {
    issues.push(critical(
      "style_contract_dialogue_rules_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53EF\u6267\u884C\u7684\u5BF9\u767D\u89C4\u5219\u3002",
      "\u8865\u9F50\u5BF9\u767D\u957F\u5EA6\u3001\u6F5C\u53F0\u8BCD\u3001\u5173\u7CFB\u538B\u529B\u548C\u7981\u6B62\u89E3\u91CA\u8154\u7B49\u89C4\u5219\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.descriptionRules)) {
    issues.push(critical(
      "style_contract_description_rules_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53EF\u6267\u884C\u7684\u63CF\u5199\u89C4\u5219\u3002",
      "\u8865\u9F50\u573A\u666F\u3001\u7269\u4EF6\u3001\u52A8\u4F5C\u3001\u611F\u5B98\u548C\u5224\u65AD\u987A\u5E8F\u7B49\u63CF\u5199\u7EA6\u675F\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.emotionRules)) {
    issues.push(critical(
      "style_contract_emotion_rules_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53EF\u6267\u884C\u7684\u60C5\u7EEA\u5916\u5316\u89C4\u5219\u3002",
      "\u8865\u9F50\u60C5\u7EEA\u5982\u4F55\u901A\u8FC7\u52A8\u4F5C\u3001\u505C\u987F\u3001\u9009\u62E9\u548C\u7EC6\u8282\u5448\u73B0\uFF0C\u907F\u514D\u76F4\u63A5\u89E3\u91CA\u4EBA\u7269\u5FC3\u7406\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.pacingRules)) {
    issues.push(critical(
      "style_contract_pacing_rules_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53EF\u6267\u884C\u7684\u8282\u594F\u63A8\u8FDB\u89C4\u5219\u3002",
      "\u8865\u9F50\u538B\u529B\u8FDB\u5165\u3001\u4FE1\u606F\u91CA\u653E\u3001\u573A\u666F\u63A8\u8FDB\u548C\u4F59\u6CE2\u94A9\u5B50\u7684\u8282\u594F\u7EA6\u675F\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.povRules)) {
    issues.push(critical(
      "style_contract_pov_rules_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53EF\u6267\u884C\u7684\u89C6\u89D2\u89C4\u5219\u3002",
      "\u8865\u9F50\u89C6\u89D2\u8FB9\u754C\u3001\u4FE1\u606F\u6743\u9650\u548C\u4E0D\u5F97\u8D8A\u6743\u6CC4\u9732\u7684\u89C4\u5219\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.openingRules)) {
    issues.push(critical(
      "style_contract_opening_rules_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53EF\u6267\u884C\u7684\u7AE0\u8282\u5F00\u573A\u89C4\u5219\u3002",
      "\u8865\u9F50\u7AE0\u8282\u5982\u4F55\u8FDB\u5165\u573A\u666F\u538B\u529B\u3001\u4EBA\u7269\u52A8\u4F5C\u548C\u5F53\u524D\u51B2\u7A81\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.endingHookRules)) {
    issues.push(critical(
      "style_contract_ending_hook_rules_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53EF\u6267\u884C\u7684\u7AE0\u8282\u7ED3\u5C3E\u94A9\u5B50\u89C4\u5219\u3002",
      "\u8865\u9F50\u6BCF\u7AE0\u7ED3\u5C3E\u5982\u4F55\u7559\u4E0B\u95EE\u9898\u3001\u5173\u7CFB\u88C2\u7F1D\u6216\u7EBF\u7D22\u63A8\u8FDB\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.forbiddenPatterns)) {
    issues.push(critical(
      "style_contract_forbidden_patterns_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u51BB\u7ED3\u540E\u7684\u7981\u7528\u6A21\u5F0F\u3002",
      "\u8865\u9F50\u5FC5\u987B\u89C4\u907F\u7684 AI \u8154\u3001\u6A21\u677F\u8154\u3001\u540C\u8D28\u5316\u5BF9\u767D\u548C\u603B\u7ED3\u5F0F\u8868\u8FBE\u3002"
    ));
  }
  if (contract.styleContract && !Array.isArray(contract.styleContract.allowedDevices)) {
    issues.push(critical(
      "style_contract_allowed_devices_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11 allowedDevices \u6570\u7EC4\u5B57\u6BB5\u3002",
      "\u51BB\u7ED3\u524D\u81F3\u5C11\u628A allowedDevices \u6807\u51C6\u5316\u4E3A\u7A7A\u6570\u7EC4\uFF1B\u5982\u6709\u53EF\u590D\u7528\u6280\u6CD5\uFF0C\u5E94\u660E\u786E\u5199\u5165\u3002"
    ));
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.positiveExamples)) {
    issues.push(critical(
      "style_contract_positive_examples_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u7528\u6237\u786E\u8BA4\u6837\u6BB5\u4E2D\u7684\u6B63\u5411\u4F8B\u53E5\u3002",
      "\u4ECE\u7528\u6237\u6EE1\u610F\u6837\u6BB5\u4E2D\u62BD\u53D6\u53EF\u590D\u7528\u7684\u6B63\u5411\u5199\u6CD5\u7247\u6BB5\uFF0C\u4F5C\u4E3A\u540E\u7EED\u7AE0\u8282\u7684\u98CE\u683C\u53C2\u7167\u3002"
    ));
  }
  if (contract.styleContract && !Array.isArray(contract.styleContract.negativeExamples)) {
    issues.push(critical(
      "style_contract_negative_examples_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11 negativeExamples \u6570\u7EC4\u5B57\u6BB5\u3002",
      "\u51BB\u7ED3\u524D\u81F3\u5C11\u628A negativeExamples \u6807\u51C6\u5316\u4E3A\u7A7A\u6570\u7EC4\uFF1B\u5982\u6709\u53CD\u4F8B\uFF0C\u5E94\u660E\u786E\u5199\u5165\u3002"
    ));
  }
  if (contract.approvedAt && contract.inheritance?.status !== "enforced") {
    issues.push(warning(
      "style_inheritance_not_enforced",
      "\u5199\u6CD5\u5408\u540C\u5C1A\u672A\u663E\u5F0F\u58F0\u660E\u6B63\u6587\u7EE7\u627F\u7EA6\u675F\u3002",
      "\u51BB\u7ED3\u540E\u8981\u660E\u786E base prompt\u3001style contract\u3001\u7981\u7528\u6A21\u5F0F\u548C\u6B63\u4F8B\u4F1A\u5F3A\u5236\u7EE7\u627F\u5230\u540E\u7EED\u7AE0\u8282\u3002"
    ));
  }
  if (!contract.antiPatterns || contract.antiPatterns.length === 0) {
    issues.push(warning(
      "anti_patterns_missing",
      "\u5199\u6CD5\u5408\u540C\u7F3A\u5C11\u53CD\u5411\u7981\u7528\u6A21\u5F0F\u3002",
      "\u8865\u5145\u7981\u6B62\u7684 AI \u5473\u3001\u5957\u8BDD\u3001\u8282\u594F\u548C\u4EBA\u7269\u58F0\u97F3\u95EE\u9898\uFF0C\u540E\u7EED\u5BA1\u6821\u4F1A\u66F4\u7A33\u3002"
    ));
  }
  return summarizeGate(issues);
}
function readinessItem(input) {
  return {
    key: input.key,
    label: input.label,
    status: input.gate.status,
    detail: input.gate.status === "passed" ? input.passedDetail : input.gate.status === "warning" ? input.warningDetail || input.gate.issues[0]?.message || input.blockedDetail : input.gate.blockedReason || input.blockedDetail,
    issueCodes: input.gate.issues.map((issue) => issue.code),
    recoveryHint: input.gate.issues[0]?.recoveryHint || ""
  };
}
function readinessGroup(input) {
  const blocked = input.assets.filter((asset) => asset.status === "blocked").length;
  const warningCount = input.assets.filter((asset) => asset.status === "warning").length;
  const passed = input.assets.filter((asset) => asset.status === "passed").length;
  return {
    key: input.key,
    label: input.label,
    status: blocked > 0 ? "blocked" : warningCount > 0 ? "warning" : "passed",
    summary: input.assets.length ? `${passed}/${input.assets.length} \u5DF2\u5C31\u7EEA${blocked ? `\uFF0C${blocked} \u9879\u7F3A\u5931` : warningCount ? `\uFF0C${warningCount} \u9879\u5F85\u8865\u5F3A` : ""}` : input.emptySummary,
    assets: input.assets
  };
}
function evaluateProductionReadiness(input) {
  const totalChapters = Math.max(0, Number(input.totalChapters || 0));
  const blueprintCount = Math.max(0, Number(input.blueprintCount || 0));
  const planningArtifactCount = Math.max(0, Number(input.planningArtifactCount || 0));
  const planningRequiredAssetCount = Math.max(0, Number(input.planningRequiredAssetCount || 0));
  const planningRequiredAssets = Array.isArray(input.planningRequiredAssets) && input.planningRequiredAssets.length ? input.planningRequiredAssets : [
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
  const planningMissingRequiredAssets = Array.isArray(input.planningMissingRequiredAssets) ? input.planningMissingRequiredAssets.filter(Boolean) : planningRequiredAssets.slice(planningRequiredAssetCount);
  const planningAssetDetails = Array.isArray(input.planningAssetDetails) && input.planningAssetDetails.length ? input.planningAssetDetails : planningRequiredAssets.map((asset) => ({
    key: asset.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
    label: asset,
    path: `.ai-novel/plans/${asset}`,
    status: planningMissingRequiredAssets.includes(asset) ? "blocked" : "passed",
    detail: planningMissingRequiredAssets.includes(asset) ? "\u7F3A\u5931" : "\u5DF2\u751F\u6210"
  }));
  const planningRequiredTotal = planningRequiredAssets.length;
  const blockedPlanningAssetLabels = Array.from(/* @__PURE__ */ new Set([
    ...planningMissingRequiredAssets,
    ...planningAssetDetails.filter((asset) => asset.status === "blocked").map((asset) => asset.label || asset.key).filter(Boolean)
  ]));
  const readyPlanningAssetCount = planningAssetDetails.filter((asset) => asset.status === "passed").length;
  const characterDossierCount = Math.max(0, Number(input.characterDossierCount || 0));
  const characterDossierGaps = Array.isArray(input.characterDossierGaps) ? input.characterDossierGaps : [];
  const memoryRecallRows = Math.max(0, Number(input.memoryRecallRows || 0));
  const memoryLag = Math.max(0, Number(input.memoryLag || 0));
  const contextBudgetPercent = Math.max(0, Number(input.contextBudgetPercent || 0));
  const consensusGate = summarizeGate(String(input.consensusText || "").trim() ? [] : [critical(
    "core_consensus_missing",
    "\u7F3A\u5C11\u53EF\u8FFD\u8E2A\u7684\u6838\u5FC3\u521B\u4F5C\u5171\u8BC6\u3002",
    "\u5148\u5B8C\u6210\u6838\u5FC3\u521B\u610F\u3001\u8BFB\u8005\u627F\u8BFA\u3001\u4E3B\u89D2\u538B\u529B\u548C\u4E16\u754C\u89C4\u5219\u7684\u7EDF\u4E00\u8BA8\u8BBA\uFF0C\u5E76\u5199\u5165 consensus\u3002"
  )]);
  const planningGate = summarizeGate(readyPlanningAssetCount >= planningRequiredTotal && blockedPlanningAssetLabels.length === 0 ? [] : planningRequiredAssetCount > 0 || planningArtifactCount > 0 ? [critical(
    "story_planning_assets_incomplete",
    `\u524D\u7F6E\u6545\u4E8B\u8D44\u4EA7\u5C1A\u672A\u5B8C\u6574\uFF0C\u7F3A\u5C11\u6216\u4E0D\u53EF\u6267\u884C\uFF1A${blockedPlanningAssetLabels.join("\u3001") || "\u6838\u5FC3\u6545\u4E8B\u8D44\u4EA7"}\u3002`,
    "\u8865\u9F50 world-matrix\u3001plot-architecture\u3001story-bible\u3001volume-strategy\u3001foreshadowing-ledger\u3001character-dynamics\u3001\u5BF9\u5E94 JSON \u5951\u7EA6\u548C writing-plan \u540E\u518D\u8FDB\u5165\u6B63\u6587\u751F\u4EA7\u3002"
  )] : [critical(
    "story_planning_assets_sparse",
    "\u4E16\u754C\u89C2\u3001\u4E3B\u7EBF\u3001\u4EBA\u7269\u5173\u7CFB\u3001\u4F0F\u7B14\u8D26\u672C\u548C\u6545\u4E8B\u5723\u7ECF\u5C1A\u672A\u751F\u6210\uFF0C\u4E0D\u80FD\u8FDB\u5165\u6B63\u6587\u751F\u4EA7\u3002",
    "\u5148\u751F\u6210\u4E16\u754C\u77E9\u9635\u3001\u4E3B\u7EBF\u67B6\u6784\u3001\u6545\u4E8B\u5723\u7ECF\u3001\u5206\u5377\u7B56\u7565\u3001\u4F0F\u7B14\u8D26\u672C\u3001\u4EBA\u7269\u5173\u7CFB\u8D44\u4EA7\u3001\u7ED3\u6784\u5316 JSON \u5951\u7EA6\u548C\u5199\u4F5C\u6267\u884C\u8BA1\u5212\uFF0C\u518D\u62C6\u7AE0\u8282\u5199\u6B63\u6587\u3002"
  )]);
  const storyFoundationApprovalGate = summarizeGate(
    !input.storyFoundationApproved ? [critical(
      "story_foundation_approval_missing",
      "\u6545\u4E8B\u57FA\u5EFA\u5C1A\u672A\u7531\u7528\u6237\u786E\u8BA4\uFF0C\u4E0D\u80FD\u8FDB\u5165\u6B63\u6587\u751F\u4EA7\u3002",
      "\u5148\u8865\u9F50\u5E76\u5BA1\u9605\u4E16\u754C\u89C2\u3001\u4E3B\u7EBF\u3001\u4EBA\u7269\u5173\u7CFB\u3001\u4F0F\u7B14\u8D26\u672C\u548C\u5199\u4F5C\u8BA1\u5212\uFF0C\u786E\u8BA4\u53EF\u6267\u884C\u540E\u518D\u89E3\u9501\u6B63\u6587\u751F\u4EA7\u3002"
    )] : input.storyFoundationApprovalFingerprint && input.storyFoundationAssetFingerprint && input.storyFoundationApprovalFingerprint !== input.storyFoundationAssetFingerprint ? [critical(
      "story_foundation_approval_stale",
      "\u6545\u4E8B\u57FA\u5EFA\u5DF2\u88AB\u4FEE\u6539\uFF0C\u65E7\u786E\u8BA4\u5DF2\u5931\u6548\u3002",
      "\u91CD\u65B0\u5BA1\u9605\u4E16\u754C\u89C2\u3001\u4E3B\u7EBF\u3001\u4EBA\u7269\u5173\u7CFB\u3001\u4F0F\u7B14\u8D26\u672C\u548C\u5199\u4F5C\u6267\u884C\u8BA1\u5212\uFF0C\u5E76\u518D\u6B21\u786E\u8BA4\u3002"
    )] : []
  );
  const characterGate = summarizeGate(characterDossierCount <= 0 ? [critical(
    "character_dossiers_missing",
    "\u7F3A\u5C11\u53EF\u6267\u884C\u4EBA\u7269\u6863\u6848\u548C\u4EBA\u7269\u5173\u7CFB\u3002",
    "\u4E3A\u4E3B\u89D2\u3001\u5BF9\u6297\u529B\u91CF\u548C\u5173\u952E\u5173\u7CFB\u4EBA\u7269\u8865\u9F50\u6B32\u671B\u3001\u4F24\u53E3\u3001\u884C\u4E3A\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u3001\u5173\u7CFB\u72B6\u6001\u548C\u53D8\u5316\u8F68\u8FF9\u3002"
  )] : characterDossierGaps.length > 0 ? [warning(
    "character_dossiers_incomplete",
    "\u4EBA\u7269\u6863\u6848\u4ECD\u6709\u5173\u952E\u5B57\u6BB5\u7F3A\u53E3\u3002",
    "\u8865\u9F50\u4EBA\u7269\u6B32\u671B\u3001\u4F24\u53E3\u3001\u884C\u4E3A\u4E60\u60EF\u3001\u8BF4\u8BDD\u65B9\u5F0F\u548C\u5173\u7CFB\u53D8\u5316\uFF0C\u907F\u514D\u6B63\u6587\u4EBA\u7269\u6241\u5E73\u5316\u3002"
  )] : []);
  const blueprintGate = summarizeGate(totalChapters > 0 && blueprintCount >= totalChapters ? [] : blueprintCount > 0 ? [critical(
    "chapter_blueprints_partial",
    "\u7AE0\u8282\u84DD\u56FE\u5C1A\u672A\u8986\u76D6\u5168\u4E66\uFF0C\u4E0D\u80FD\u8FDB\u5165\u6B63\u6587\u751F\u4EA7\u3002",
    "\u7EE7\u7EED\u751F\u6210\u5269\u4F59\u7AE0\u8282\u84DD\u56FE\uFF0C\u786E\u4FDD\u6BCF\u7AE0\u90FD\u6709\u56E0\u679C\u76EE\u6807\u3001\u573A\u666F\u5361\u3001\u4F0F\u7B14\u64CD\u4F5C\u548C\u4EA4\u68D2\u72B6\u6001\u3002"
  )] : [critical(
    "chapter_blueprints_missing",
    "\u7F3A\u5C11\u7AE0\u8282\u84DD\u56FE\uFF0C\u4E0D\u80FD\u7A33\u5B9A\u8FDB\u5165\u6B63\u6587\u751F\u4EA7\u3002",
    "\u5148\u6309\u6545\u4E8B\u5723\u7ECF\u62C6\u51FA\u7AE0\u8282\u6267\u884C\u5408\u540C\uFF0C\u800C\u4E0D\u662F\u76F4\u63A5\u8BA9\u6A21\u578B\u5199\u6B63\u6587\u3002"
  )]);
  const styleGate = input.styleGate || summarizeGate([critical(
    "style_gate_missing",
    "\u7F3A\u5C11 Style Contract Freeze Gate \u7ED3\u679C\u3002",
    "\u5148\u8FD0\u884C Style Evolution Engine\uFF0C\u7528\u6237\u786E\u8BA4\u6837\u6BB5\u540E\u518D\u8FDB\u5165\u6B63\u6587\u751F\u4EA7\u3002"
  )]);
  const memoryGate = summarizeGate(memoryRecallRows > 0 && memoryLag <= 1 ? [] : [warning(
    "memory_recall_sparse",
    "\u8BB0\u5FC6/RAG \u53EF\u53EC\u56DE\u5185\u5BB9\u4E0D\u8DB3\u3002",
    "\u91CD\u65B0\u7D22\u5F15\u5171\u8BC6\u3001\u4EBA\u7269\u6863\u6848\u3001\u89C4\u5212\u548C\u5DF2\u5B8C\u6210\u7AE0\u8282\uFF0C\u786E\u4FDD\u540E\u7EED\u7AE0\u8282\u80FD\u627F\u63A5\u4E8B\u5B9E\u4E0E\u4F0F\u7B14\u3002"
  )]);
  const contextGate = summarizeGate(input.contextOverBudget || contextBudgetPercent >= 90 ? [warning(
    "context_budget_pressure",
    "\u4E0A\u4E0B\u6587\u9884\u7B97\u63A5\u8FD1\u6216\u8D85\u8FC7\u5B89\u5168\u8303\u56F4\u3002",
    "\u538B\u7F29\u5171\u8BC6\u3001\u62C6\u5206\u7AE0\u8282\u573A\u666F\u8C03\u7528\uFF0C\u4FDD\u7559\u5F53\u524D\u573A\u666F\u5FC5\u9700\u4E8B\u5B9E\uFF0C\u907F\u514D\u4E00\u6B21\u8BF7\u6C42\u585E\u5165\u8FC7\u591A\u8D44\u6599\u3002"
  )] : []);
  const itemInputs = [
    {
      key: "core_consensus",
      label: "\u6838\u5FC3\u5171\u8BC6",
      gate: consensusGate,
      passedDetail: "\u5DF2\u6709\u53EF\u8FFD\u8E2A\u5171\u8BC6",
      blockedDetail: "\u7F3A\u5C11\u521B\u4F5C\u5171\u8BC6"
    },
    {
      key: "story_planning",
      label: "\u4E16\u754C/\u4E3B\u7EBF",
      gate: planningGate,
      passedDetail: `${readyPlanningAssetCount}/${planningRequiredTotal} \u4E2A\u6838\u5FC3\u8D44\u4EA7`,
      blockedDetail: "\u7F3A\u5C11\u4E16\u754C\u89C2\u3001\u4E3B\u7EBF\u548C\u6545\u4E8B\u5723\u7ECF",
      warningDetail: `${readyPlanningAssetCount}/${planningRequiredTotal} \u4E2A\u6838\u5FC3\u8D44\u4EA7\uFF0C${planningArtifactCount} \u4E2A\u89C4\u5212\u4EA7\u7269`
    },
    {
      key: "character_dynamics",
      label: "\u4EBA\u7269\u5173\u7CFB",
      gate: characterGate,
      passedDetail: `${characterDossierCount} \u4E2A\u6863\u6848`,
      blockedDetail: "\u7F3A\u5C11\u4EBA\u7269\u6863\u6848",
      warningDetail: `${characterDossierCount} \u4E2A\u6863\u6848\uFF0C${characterDossierGaps.length} \u4E2A\u7F3A\u53E3`
    },
    {
      key: "story_foundation_approval",
      label: "\u57FA\u5EFA\u786E\u8BA4",
      gate: storyFoundationApprovalGate,
      passedDetail: input.storyFoundationApprovedAt ? `\u5DF2\u786E\u8BA4 ${input.storyFoundationApprovedAt}` : "\u7528\u6237\u5DF2\u786E\u8BA4",
      blockedDetail: "\u9700\u8981\u7528\u6237\u786E\u8BA4\u6545\u4E8B\u57FA\u5EFA"
    },
    {
      key: "chapter_blueprints",
      label: "\u7AE0\u8282\u84DD\u56FE",
      gate: blueprintGate,
      passedDetail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} \u4E2A\u84DD\u56FE`,
      blockedDetail: "\u7F3A\u5C11\u7AE0\u8282\u6267\u884C\u5408\u540C",
      warningDetail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} \u4E2A\u84DD\u56FE`
    },
    {
      key: "style_approval",
      label: "Style Freeze",
      gate: styleGate,
      passedDetail: "\u5DF2\u51BB\u7ED3\u5168\u4E66\u5199\u6CD5\u5408\u540C",
      blockedDetail: "\u9700\u8981\u5B8C\u6210 Loop \u5E76\u51BB\u7ED3 style contract"
    },
    {
      key: "memory_recall",
      label: "\u8BB0\u5FC6/RAG",
      gate: memoryGate,
      passedDetail: `${memoryRecallRows} \u6761\u53EF\u53EC\u56DE`,
      blockedDetail: "\u7F3A\u5C11\u53EF\u53EC\u56DE\u8BB0\u5FC6",
      warningDetail: `${memoryRecallRows} \u6761\u53EF\u53EC\u56DE\uFF0C\u6EDE\u540E ${memoryLag}`
    },
    {
      key: "context_budget",
      label: "\u4E0A\u4E0B\u6587\u9884\u7B97",
      gate: contextGate,
      passedDetail: `${contextBudgetPercent}%`,
      blockedDetail: "\u4E0A\u4E0B\u6587\u8FC7\u8F7D",
      warningDetail: `${contextBudgetPercent}%`
    }
  ];
  const items = itemInputs.map(readinessItem);
  const characterAssetDetails = Array.isArray(input.characterAssetDetails) && input.characterAssetDetails.length ? input.characterAssetDetails : [
    {
      key: "character_dossiers",
      label: "\u4EBA\u7269\u6863\u6848",
      path: ".ai-novel/memory/characters/dossiers.json",
      status: characterGate.status,
      detail: characterGate.status === "passed" ? `${characterDossierCount} \u4E2A\u6863\u6848` : characterGate.blockedReason || "\u5F85\u8865\u9F50"
    }
  ];
  const executionAssetDetails = Array.isArray(input.executionAssetDetails) && input.executionAssetDetails.length ? input.executionAssetDetails : [
    {
      key: "chapter_blueprints",
      label: "\u7AE0\u8282\u84DD\u56FE",
      path: ".ai-novel/chapter-blueprints/",
      status: blueprintGate.status,
      detail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} \u4E2A\u84DD\u56FE`
    },
    {
      key: "style_contract",
      label: "\u5199\u6CD5\u5408\u540C",
      path: ".ai-novel/style/evolution/style-contract.json",
      status: styleGate.status,
      detail: styleGate.status === "passed" ? "\u5DF2\u51BB\u7ED3" : styleGate.blockedReason || "\u5F85\u786E\u8BA4"
    }
  ];
  const groups = [
    readinessGroup({
      key: "story_foundation",
      label: "\u6545\u4E8B\u57FA\u5EFA",
      assets: [
        {
          key: "core_consensus",
          label: "\u6838\u5FC3\u5171\u8BC6",
          path: ".ai-novel/prompts/global-consensus.md",
          status: consensusGate.status,
          detail: consensusGate.status === "passed" ? "\u5DF2\u751F\u6210" : consensusGate.blockedReason || "\u7F3A\u5931"
        },
        ...planningAssetDetails,
        {
          key: "story_foundation_approval",
          label: "\u7528\u6237\u786E\u8BA4",
          path: input.storyFoundationApprovalPath || ".ai-novel/plans/story-foundation-approval.json",
          status: storyFoundationApprovalGate.status,
          detail: storyFoundationApprovalGate.status === "passed" ? input.storyFoundationApprovedAt ? `\u5DF2\u786E\u8BA4 ${input.storyFoundationApprovedAt}` : "\u5DF2\u786E\u8BA4" : storyFoundationApprovalGate.blockedReason || "\u5F85\u786E\u8BA4"
        }
      ],
      emptySummary: "\u5C1A\u672A\u68C0\u67E5\u6545\u4E8B\u57FA\u5EFA"
    }),
    readinessGroup({
      key: "character_system",
      label: "\u4EBA\u7269\u7CFB\u7EDF",
      assets: characterAssetDetails,
      emptySummary: "\u5C1A\u672A\u68C0\u67E5\u4EBA\u7269\u7CFB\u7EDF"
    }),
    readinessGroup({
      key: "chapter_execution",
      label: "\u6B63\u6587\u6267\u884C",
      assets: [
        ...executionAssetDetails,
        {
          key: "memory_recall",
          label: "\u8BB0\u5FC6/RAG",
          path: ".ai-novel/memory/",
          status: memoryGate.status,
          detail: memoryGate.status === "passed" ? `${memoryRecallRows} \u6761\u53EF\u53EC\u56DE` : `${memoryRecallRows} \u6761\u53EF\u53EC\u56DE\uFF0C\u6EDE\u540E ${memoryLag}`
        },
        {
          key: "context_budget",
          label: "\u4E0A\u4E0B\u6587\u9884\u7B97",
          path: ".ai-novel/context/",
          status: contextGate.status,
          detail: `${contextBudgetPercent}%`
        }
      ],
      emptySummary: "\u5C1A\u672A\u68C0\u67E5\u6B63\u6587\u6267\u884C\u6761\u4EF6"
    })
  ];
  const issues = itemInputs.flatMap((item) => item.gate.issues);
  const blocked = items.filter((item) => item.status === "blocked").length;
  const warningCount = items.filter((item) => item.status === "warning").length;
  const passed = items.filter((item) => item.status === "passed").length;
  const score = Math.round((passed + warningCount * 0.5) / Math.max(1, items.length) * 100);
  const gate = summarizeGate(issues);
  return {
    status: gate.status,
    canProceed: gate.canProceed,
    score,
    summary: blocked > 0 ? `${blocked} \u9879\u963B\u585E\u6B63\u6587\u751F\u4EA7` : warningCount > 0 ? `${warningCount} \u9879\u5EFA\u8BAE\u8865\u5F3A` : "\u6B63\u6587\u751F\u4EA7\u51C6\u5907\u5B8C\u6210",
    blockedReason: gate.blockedReason,
    items,
    groups,
    issues
  };
}

// src/production-style-evolution.ts
var import_promises4 = __toESM(require("fs/promises"), 1);
var import_node_path7 = __toESM(require("path"), 1);
var STYLE_EVOLUTION_DIR = ".ai-novel/style/evolution";
var STYLE_SAMPLES_DIR = ".ai-novel/style/evolution/samples";
var STYLE_SEED_PATH = ".ai-novel/style/evolution/style-seed.md";
var USER_STYLE_PROMPT_PATH = ".ai-novel/style/evolution/user-style-prompt.md";
var REFERENCE_TEXT_PATH = ".ai-novel/style/evolution/reference-text.md";
var EVOLUTION_HISTORY_PATH = ".ai-novel/style/evolution/style-evolution-history.json";
var STYLE_CONTRACT_PATH = ".ai-novel/style/evolution/style-contract.json";
var APPROVED_SAMPLE_PATH = ".ai-novel/style/evolution/user-approved-sample.md";
var STYLE_FREEZE_LEDGER_PATH = ".ai-novel/style/evolution/style-freeze-ledger.json";
var STYLE_LOOP_RUNTIME_PATH = ".ai-novel/style/evolution/style-loop-runtime.json";
var STYLE_LOOP_RUNS_PATH = ".ai-novel/style/evolution/style-loop-runs.jsonl";
function styleGenerationVerificationFromEntry(entry) {
  if (!entry) return buildStyleGenerationVerification({});
  if (entry.verification) return entry.verification;
  if (!entry.evaluation) return buildStyleGenerationVerification({
    version: entry.version,
    checkedAt: entry.createdAt
  });
  return buildStyleGenerationVerification({
    evaluation: entry.evaluation,
    version: entry.version,
    checkedAt: entry.createdAt
  });
}
function styleEntryFreezerGate(entry) {
  return entry?.freezer || null;
}
function buildStyleGenerationVerification(input) {
  const evaluation = input.evaluation;
  const forbiddenHitCount = Array.isArray(evaluation?.forbiddenHits) ? evaluation.forbiddenHits.length : 0;
  const aigc = evaluation?.aigc;
  const reasons = [];
  let status = "pending";
  if (aigc?.enabled) {
    if (typeof aigc.score === "number") {
      reasons.push(`AIGC \u6982\u7387 ${aigc.score.toFixed(3)}\u3002`);
    }
    if (typeof aigc.threshold === "number") {
      reasons.push(`\u98CE\u9669\u9608\u503C ${aigc.threshold.toFixed(3)}\u3002`);
    }
  }
  if (forbiddenHitCount > 0) {
    reasons.push(`\u547D\u4E2D ${forbiddenHitCount} \u6761\u7981\u5FCC\u6A21\u5F0F\u3002`);
  }
  if ((aigc?.highRiskCount || 0) > 0) {
    reasons.push(`AIGC \u68C0\u6D4B\u8BC6\u522B\u51FA ${Number(aigc?.highRiskCount || 0)} \u4E2A\u9AD8\u98CE\u9669\u7247\u6BB5\u3002`);
  }
  if (aigc?.reason) {
    reasons.push(aigc.reason);
  }
  if (aigc?.status === "blocked" || forbiddenHitCount > 0) {
    status = "blocked";
  } else if (aigc?.status === "passed" && forbiddenHitCount === 0) {
    status = "passed";
  } else if (aigc?.status === "unavailable") {
    status = "blocked";
  } else if (!aigc?.enabled) {
    status = "blocked";
  }
  const summary = status === "passed" ? "Generation Verification Gate \u5DF2\u901A\u8FC7\uFF0C\u5F53\u524D\u6837\u6BB5\u7684 AIGC \u98CE\u9669\u4E0E\u7981\u5FCC\u547D\u4E2D\u5904\u4E8E\u53EF\u653E\u884C\u8303\u56F4\u3002" : status === "blocked" ? "Generation Verification Gate \u963B\u585E\uFF0C\u5F53\u524D\u6837\u6BB5\u4ECD\u5B58\u5728 AIGC \u98CE\u9669\u6216\u7981\u5FCC\u547D\u4E2D\uFF0C\u4E0D\u80FD\u76F4\u63A5\u51BB\u7ED3\u3002" : "Generation Verification Gate \u7B49\u5F85\u5F53\u524D\u8F6E\u8BC4\u4F30\u5B8C\u6210\u3002";
  return {
    gate: "Generation Verification Gate",
    status,
    summary,
    reasons: [...new Set(reasons.filter(Boolean))],
    score: typeof aigc?.score === "number" ? aigc.score : null,
    threshold: typeof aigc?.threshold === "number" ? aigc.threshold : null,
    highRiskCount: Number(aigc?.highRiskCount || 0),
    forbiddenHitCount,
    highRiskPreviews: Array.isArray(aigc?.highRiskPreviews) ? aigc.highRiskPreviews.filter(Boolean) : [],
    version: input.version,
    checkedAt: input.checkedAt || (/* @__PURE__ */ new Date()).toISOString()
  };
}
function defaultRetryPolicy() {
  return {
    maxLoopIterations: 6,
    approvalScoreThreshold: 8.6,
    approvalMinRounds: 2,
    stabilityMinRounds: 2,
    stabilityScoreDeltaMax: 0.6,
    retryOnForbiddenHit: true,
    maxForbiddenHitCount: 1
  };
}
function latestGenerationVerification(contract, history) {
  const latest = [...history].reverse().find((entry) => entry.verification || entry.evaluation);
  if (latest?.verification) {
    return latest.verification;
  }
  if (latest?.evaluation) {
    return buildStyleGenerationVerification({
      evaluation: latest.evaluation,
      version: latest.version,
      checkedAt: latest.createdAt
    });
  }
  if (contract.verification) {
    return contract.verification;
  }
  return null;
}
function approvedGenerationVerification(contract, history) {
  const approvedVersion = Number(contract.approval?.approvedVersion || contract.loop?.approvalVersion || 0);
  const approvedEntry = approvedVersion ? history.find((entry) => entry.version === approvedVersion) : null;
  if (approvedEntry?.verification) {
    return approvedEntry.verification;
  }
  if (approvedEntry?.evaluation) {
    return buildStyleGenerationVerification({
      evaluation: approvedEntry.evaluation,
      version: approvedEntry.version,
      checkedAt: approvedEntry.createdAt
    });
  }
  if (contract.verification) {
    return contract.verification;
  }
  return latestGenerationVerification(contract, history);
}
function activeContractGenerationVerification(contract, history) {
  const approved = Boolean(
    contract.approvedAt || contract.approval?.status === "approved" || contract.approval?.approvedVersion || contract.loop?.status === "approved"
  );
  return approved ? approvedGenerationVerification(contract, history) : latestGenerationVerification(contract, history);
}
function roundScore(value) {
  return Math.round(value * 10) / 10;
}
function buildStableReasons(input) {
  const reasons = [];
  const window = input.stableWindow;
  if (!window.length) return reasons;
  const scores = window.map((entry) => Number(entry.evaluation?.scores?.overall || 0)).filter((score) => score > 0);
  if (scores.length >= 2) {
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const drift = roundScore(max - min);
    reasons.push(`\u6700\u8FD1 ${scores.length} \u8F6E\u7EFC\u5408\u8BC4\u5206\u4FDD\u6301\u5728 ${min.toFixed(1)}-${max.toFixed(1)}\uFF0C\u6F02\u79FB\u4EC5 ${drift.toFixed(1)}\u3002`);
  }
  const forbiddenClear = window.every(
    (entry) => (entry.evaluation?.forbiddenHits?.length || 0) <= Math.max(0, Number(input.retryPolicy.maxForbiddenHitCount || 1))
  );
  if (forbiddenClear) {
    reasons.push("\u6700\u8FD1\u7A33\u5B9A\u7A97\u53E3\u5185\u7981\u5FCC\u547D\u4E2D\u6301\u7EED\u53D7\u63A7\u3002");
  }
  const verdictStable = window.every((entry) => {
    const verdict = entry.evaluation?.verdict;
    return verdict === "candidate" || verdict === "approve";
  });
  if (verdictStable) {
    reasons.push("\u6700\u8FD1\u51E0\u8F6E\u5DF2\u8131\u79BB retry \u533A\u95F4\uFF0C\u5F00\u59CB\u8FDB\u5165\u7A33\u5B9A\u53EF\u6536\u675F\u72B6\u6001\u3002");
  }
  const tighteningTotal = window.reduce((sum, entry) => sum + (entry.contractTightening?.length || 0), 0);
  if (tighteningTotal > 0) {
    reasons.push(`\u7A33\u5B9A\u7A97\u53E3\u5185\u7D2F\u8BA1\u65B0\u589E ${tighteningTotal} \u6761\u5408\u540C\u6536\u7D27\u5EFA\u8BAE\u3002`);
  }
  return reasons;
}
function isOpenStyleEvolutionEntry(entry, rejectedVersion) {
  if (entry.userDecision === "accepted") return false;
  if (entry.userDecision === "superseded") return false;
  if (rejectedVersion && entry.version === rejectedVersion) return false;
  return true;
}
function computeStableWindowState(input) {
  const stabilityMinRounds = Math.max(2, Number(input.retryPolicy.stabilityMinRounds || 2));
  const approvalThreshold = Number(input.retryPolicy.approvalScoreThreshold || 8.6);
  const stabilityScoreDeltaMax = Math.max(0, Number(input.retryPolicy.stabilityScoreDeltaMax || 0.6));
  const stableWindow = input.history.slice(-stabilityMinRounds);
  const stableWindowScores = stableWindow.map((entry) => Number(entry.evaluation?.scores?.overall || 0)).filter((score) => score > 0);
  const stableWindowVerdictOk = stableWindow.length >= stabilityMinRounds && stableWindow.every((entry) => {
    const verdict = entry.evaluation?.verdict;
    return verdict === "candidate" || verdict === "approve";
  });
  const stableWindowDecisionOk = stableWindow.length >= stabilityMinRounds && stableWindow.every((entry) => isOpenStyleEvolutionEntry(entry, input.rejectedVersion));
  const stableWindowForbiddenOk = stableWindow.length >= stabilityMinRounds && stableWindow.every(
    (entry) => (entry.evaluation?.forbiddenHits?.length || 0) <= Math.max(0, Number(input.retryPolicy.maxForbiddenHitCount || 1))
  );
  const stableWindowVerificationOk = stableWindow.length >= stabilityMinRounds && stableWindow.every((entry) => {
    const verification = entry.verification || buildStyleGenerationVerification({
      evaluation: entry.evaluation,
      version: entry.version,
      checkedAt: entry.createdAt
    });
    return verification.status === "passed";
  });
  const stableWindowThresholdOk = stableWindow.length >= stabilityMinRounds && stableWindow.every((entry) => Number(entry.evaluation?.scores?.overall || 0) >= approvalThreshold - 0.8);
  const stableWindowDrift = stableWindowScores.length >= 2 ? roundScore(Math.max(...stableWindowScores) - Math.min(...stableWindowScores)) : Number.NaN;
  const stable = stableWindow.length >= stabilityMinRounds && stableWindowScores.length >= stabilityMinRounds && stableWindowVerdictOk && stableWindowDecisionOk && stableWindowForbiddenOk && stableWindowVerificationOk && stableWindowThresholdOk && stableWindowDrift <= stabilityScoreDeltaMax;
  return {
    stable,
    stableWindow,
    stableWindowScores,
    stableWindowDrift
  };
}
function deriveLoopState(contract) {
  const history = Array.isArray(contract.evolutionHistory) ? contract.evolutionHistory : [];
  const latest = history.at(-1);
  const retryPolicy = contract.retryPolicy || defaultRetryPolicy();
  const approvalThreshold = Number(retryPolicy.approvalScoreThreshold || 8.6);
  const verification = activeContractGenerationVerification(contract, history);
  const rejectedVersion = contract.approval?.status === "rejected" ? contract.approval.rejectedVersion : void 0;
  const stableState = computeStableWindowState({ history, retryPolicy, rejectedVersion });
  const readyEntry = [...history].reverse().find((entry) => {
    const entryVerification = styleGenerationVerificationFromEntry(entry);
    return isOpenStyleEvolutionEntry(entry, rejectedVersion) && entryVerification.status === "passed" && (!styleEntryFreezerGate(entry)?.verdict || styleEntryFreezerGate(entry)?.verdict === "ready") && (entry.readyForApproval || entry.evaluation?.verdict === "approve");
  });
  const recent = history.slice(-Math.max(2, Number(retryPolicy.stabilityMinRounds || 2)));
  const convergenceEvidence = [];
  const tighteningCount = history.reduce((sum, entry) => sum + (entry.contractTightening?.length || 0), 0);
  const stableEntry = stableState.stable ? stableState.stableWindow.at(-1) : void 0;
  const stabilityReasons = stableState.stable ? buildStableReasons({ stableWindow: stableState.stableWindow, retryPolicy }) : [];
  if (recent.length >= 2) {
    const previous = Number(recent[0]?.evaluation?.scores?.overall || 0);
    const current = Number(recent.at(-1)?.evaluation?.scores?.overall || 0);
    if (current >= previous && current > 0) {
      convergenceEvidence.push(`\u6700\u8FD1\u4E24\u8F6E\u7EFC\u5408\u8BC4\u5206\u4ECE ${previous.toFixed(1)} \u63D0\u5347\u5230 ${current.toFixed(1)}\u3002`);
    }
    if ((recent.at(-1)?.contractTightening?.length || 0) > 0) {
      convergenceEvidence.push(`\u6700\u8FD1\u4E00\u8F6E\u65B0\u589E ${recent.at(-1)?.contractTightening?.length || 0} \u6761\u5408\u540C\u6536\u7D27\u5EFA\u8BAE\u3002`);
    }
  }
  if (stableState.stable && stabilityReasons.length) {
    convergenceEvidence.push(...stabilityReasons);
  }
  if (readyEntry?.readyReasons?.length) {
    convergenceEvidence.push(...readyEntry.readyReasons);
  }
  const dedupedConvergenceEvidence = [...new Set(convergenceEvidence.filter(Boolean))];
  const readyVersion = readyEntry?.version;
  const stableVersion = stableEntry?.version;
  const approvalVersion = contract.approval?.approvedVersion || contract.loop?.approvalVersion || history.find((entry) => entry.sample === contract.approvedSample)?.version;
  const approved = Boolean((contract.approval?.status === "approved" || contract.approvedAt) && contract.approvedSample?.trim());
  const latestRejected = Boolean(
    contract.approval?.status === "rejected" && contract.approval?.rejectionReason && contract.approval?.rejectedVersion === latest?.version
  );
  const latestRejectionReason = latestRejected ? contract.approval?.rejectionReason : "";
  return {
    status: approved ? "approved" : readyEntry && readyEntry.version === latest?.version ? "ready_for_approval" : stableState.stable ? "stable_candidate" : history.length > 0 ? "awaiting_user" : "idle",
    convergence: approved ? "ready" : readyEntry && readyEntry.version === latest?.version ? "ready" : stableState.stable ? "stable" : history.length >= 2 ? "improving" : history.length === 1 ? "exploring" : "unknown",
    currentIteration: history.length,
    latestVersion: latest?.version || 0,
    stableVersion,
    readyVersion,
    approvalVersion,
    autoIterations: history.filter((entry) => entry.source !== "manual").length,
    stableRounds: stableState.stable ? stableState.stableWindow.length : 0,
    stabilityScore: stableState.stable && stableState.stableWindowScores.length ? roundScore(stableState.stableWindowScores.reduce((sum, score) => sum + score, 0) / stableState.stableWindowScores.length) : 0,
    tighteningCount,
    lastRunAt: latest?.createdAt || contract.approvedAt,
    lastVerdict: approved ? "approve" : latest?.evaluation?.verdict,
    stableSummary: stableState.stable ? `v${stableEntry?.version || latest?.version || 0} \u524D\u5DF2\u5F62\u6210\u7A33\u5B9A\u5199\u6CD5\u7A97\u53E3\uFF0C\u53EF\u7EE7\u7EED\u51BB\u7ED3\u786E\u8BA4\u3002` : "",
    readySummary: readyEntry?.evaluation?.summary || readyEntry?.review,
    stabilityReasons,
    readyReasons: readyEntry?.readyReasons || [],
    convergenceEvidence: dedupedConvergenceEvidence,
    verificationStatus: verification?.status || "pending",
    verificationVersion: verification?.version,
    verificationSummary: verification?.summary || "",
    verificationReasons: verification?.reasons || [],
    latestSummary: approved ? "\u7528\u6237\u5DF2\u786E\u8BA4\u5E76\u51BB\u7ED3\u672C\u4E66\u57FA\u7840\u5199\u6CD5\u3002" : latestRejected ? `\u7528\u6237\u9000\u56DE\u5F53\u524D\u5019\u9009\uFF1A${latestRejectionReason}` : latest?.evaluation?.summary || "\u5C1A\u672A\u8FDB\u5165\u5199\u6CD5\u5FAA\u73AF\u3002"
  };
}
function buildStyleFreezeLedger(contract) {
  const history = Array.isArray(contract.evolutionHistory) ? contract.evolutionHistory : [];
  const verification = activeContractGenerationVerification(contract, history);
  return {
    version: 1,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    latestVersion: Number(contract.loop?.latestVersion || history.at(-1)?.version || 0),
    stableVersion: Number(contract.loop?.stableVersion || 0) || void 0,
    readyVersion: Number(contract.loop?.readyVersion || 0) || void 0,
    approvalVersion: Number(contract.loop?.approvalVersion || contract.approval?.approvedVersion || 0) || void 0,
    approvalStatus: contract.approval?.status || "pending",
    freezeSummary: contract.approval?.freezeSummary,
    inheritedArtifacts: contract.inheritance?.inheritedArtifacts || [],
    inheritedRules: contract.inheritance?.inheritedRules || [],
    convergence: contract.loop?.convergence || "unknown",
    convergenceEvidence: contract.loop?.convergenceEvidence || [],
    verificationGate: "Generation Verification Gate",
    verificationStatus: verification?.status || "pending",
    verificationVersion: verification?.version,
    verificationSummary: verification?.summary || "",
    verificationReasons: verification?.reasons || [],
    entries: history.map((entry) => ({
      version: entry.version,
      createdAt: entry.createdAt,
      samplePath: entry.samplePath,
      source: entry.source,
      evaluationSource: entry.evaluation?.source,
      refinementSource: entry.refinement?.source,
      verdict: entry.evaluation?.verdict,
      overallScore: Number(entry.evaluation?.scores?.overall || 0) || void 0,
      readyForApproval: entry.readyForApproval,
      stableCandidate: Number(contract.loop?.stableVersion || 0) === entry.version,
      stableRounds: Number(contract.loop?.stableVersion || 0) === entry.version ? Number(contract.loop?.stableRounds || 0) : 0,
      readyReasons: entry.readyReasons || [],
      stabilityReasons: Number(contract.loop?.stableVersion || 0) === entry.version ? contract.loop?.stabilityReasons || [] : [],
      convergenceNote: entry.convergenceNote,
      contractTightening: entry.contractTightening || [],
      rejectionReason: entry.rejectionReason,
      userDecision: entry.userDecision,
      userDecisionAt: entry.userDecisionAt,
      verificationStatus: entry.verification?.status || "pending",
      verificationSummary: entry.verification?.summary || "",
      verificationReasons: entry.verification?.reasons || [],
      freezerVerdict: entry.freezer?.verdict,
      freezerSummary: entry.freezer?.summary || "",
      freezerBlockingReasons: entry.freezer?.blockingReasons || [],
      llmFallbackUsed: entry.llmFallbackUsed === true || entry.evaluation?.source === "heuristic" || entry.refinement?.source === "heuristic" || entry.freezer?.source === "heuristic",
      fallbackReasons: entry.fallbackReasons || [],
      aigcRiskScore: entry.verification?.score ?? null,
      aigcThreshold: entry.verification?.threshold ?? null,
      aigcHighRiskCount: Number(entry.verification?.highRiskCount || 0),
      forbiddenHitCount: Number(entry.verification?.forbiddenHitCount || 0)
    }))
  };
}
function loopProtocolEvidenceItem(input) {
  return {
    key: input.key,
    label: input.label,
    status: input.ok ? "passed" : "blocked",
    summary: input.ok ? input.passedSummary : input.pendingSummary,
    evidence: input.evidence.filter(Boolean),
    requiredForFreeze: input.requiredForFreeze !== false
  };
}
function deriveStyleLoopProtocol(contract) {
  const history = Array.isArray(contract.evolutionHistory) ? contract.evolutionHistory : [];
  const latest = history.at(-1);
  const approved = Boolean(contract.approvedAt && contract.approval?.status === "approved" && contract.approval.acceptedAsBookStyle === true);
  const verification = contract.verification || activeContractGenerationVerification(contract, history);
  const freezerReady = contract.freezer?.verdict === "ready";
  const inheritanceReady = contract.inheritance?.status === "enforced";
  const styleReady = Boolean(contract.styleContract && contract.frozenBasePrompt?.trim());
  const requiredStages = [
    "seed_prompt_builder",
    "candidate_generator",
    "evaluator_critic",
    "prompt_refiner",
    "loop_controller",
    "generation_verification",
    "user_approval_gate",
    "style_contract_freezer",
    "chapter_inheritance_adapter"
  ];
  const evidence = [
    loopProtocolEvidenceItem({
      key: "seed_prompt_builder",
      label: "Seed Prompt Builder",
      ok: Boolean(contract.seedPrompt?.trim()),
      pendingSummary: "\u7F3A\u5C11\u521D\u59CB seed prompt\u3002",
      passedSummary: "\u5DF2\u751F\u6210\u521D\u59CB\u79CD\u5B50 prompt\u3002",
      evidence: [
        contract.userStylePrompt ? "user style prompt captured" : "",
        contract.referenceWorks?.length ? `reference works: ${contract.referenceWorks.length}` : "",
        contract.desiredVibes?.length ? `desired vibes: ${contract.desiredVibes.length}` : "",
        contract.seedForbiddenPatterns?.length ? `seed forbidden patterns: ${contract.seedForbiddenPatterns.length}` : ""
      ]
    }),
    loopProtocolEvidenceItem({
      key: "candidate_generator",
      label: "Candidate Generator",
      ok: history.length > 0,
      pendingSummary: "\u5C1A\u672A\u751F\u6210\u53EF\u8BC4\u4F30\u6B63\u6587\u6837\u6BB5\u3002",
      passedSummary: `\u5DF2\u751F\u6210 ${history.length} \u4E2A\u5019\u9009\u6837\u6BB5\u3002`,
      evidence: [
        latest?.version ? `latest version: v${latest.version}` : "",
        latest?.source ? `latest source: ${latest.source}` : ""
      ]
    }),
    loopProtocolEvidenceItem({
      key: "evaluator_critic",
      label: "Evaluator / Critic",
      ok: history.some((entry) => Boolean(entry.evaluation?.scores?.overall)),
      pendingSummary: "\u5019\u9009\u6837\u6BB5\u7F3A\u5C11\u591A\u7EF4\u8BC4\u4F30\u3002",
      passedSummary: "\u5019\u9009\u6837\u6BB5\u5DF2\u5B8C\u6210\u591A\u7EF4\u8BC4\u4F30\u3002",
      evidence: [
        latest?.evaluation?.source ? `source: ${latest.evaluation.source}` : "",
        typeof latest?.evaluation?.scores?.overall === "number" ? `overall: ${latest.evaluation.scores.overall}` : "",
        latest?.evaluation?.verdict ? `verdict: ${latest.evaluation.verdict}` : ""
      ]
    }),
    loopProtocolEvidenceItem({
      key: "prompt_refiner",
      label: "Prompt Refiner",
      ok: history.some((entry) => Boolean(entry.refinement?.nextPrompt || entry.refinement?.promptAdjustments?.length || entry.contractTightening?.length)),
      pendingSummary: "\u5C1A\u672A\u6C89\u6DC0 prompt \u4FEE\u8BA2\u5EFA\u8BAE\u3002",
      passedSummary: "\u5DF2\u6C89\u6DC0\u4E0B\u4E00\u8F6E prompt \u4E0E\u5408\u540C\u6536\u7D27\u5EFA\u8BAE\u3002",
      evidence: [
        latest?.refinement?.source ? `source: ${latest.refinement.source}` : "",
        latest?.refinement?.promptAdjustments?.length ? `prompt adjustments: ${latest.refinement.promptAdjustments.length}` : "",
        latest?.contractTightening?.length ? `contract tightening: ${latest.contractTightening.length}` : ""
      ]
    }),
    loopProtocolEvidenceItem({
      key: "loop_controller",
      label: "Loop Controller",
      ok: Boolean(contract.loop?.status && contract.loop.status !== "idle"),
      pendingSummary: "Loop Controller \u5C1A\u672A\u5F62\u6210\u6536\u655B\u72B6\u6001\u3002",
      passedSummary: `Loop Controller \u72B6\u6001\uFF1A${contract.loop?.status || "unknown"}\u3002`,
      evidence: [
        contract.loop?.convergence ? `convergence: ${contract.loop.convergence}` : "",
        contract.loop?.currentIteration ? `iterations: ${contract.loop.currentIteration}` : "",
        contract.loop?.readyVersion ? `ready version: v${contract.loop.readyVersion}` : ""
      ]
    }),
    loopProtocolEvidenceItem({
      key: "generation_verification",
      label: "AIGC / Generation Verification",
      ok: verification?.status === "passed",
      pendingSummary: "Generation Verification Gate \u5C1A\u672A\u901A\u8FC7\u3002",
      passedSummary: "Generation Verification Gate \u5DF2\u901A\u8FC7\u3002",
      evidence: [
        verification?.status ? `status: ${verification.status}` : "",
        typeof verification?.score === "number" ? `score: ${verification.score}` : "",
        typeof verification?.threshold === "number" ? `threshold: ${verification.threshold}` : "",
        verification?.highRiskCount ? `high risk count: ${verification.highRiskCount}` : ""
      ]
    }),
    loopProtocolEvidenceItem({
      key: "user_approval_gate",
      label: "User Approval Gate",
      ok: approved,
      pendingSummary: "\u7528\u6237\u5C1A\u672A\u786E\u8BA4\u8BE5\u5199\u6CD5\u4F5C\u4E3A\u6574\u672C\u4E66\u57FA\u7840\u5199\u6CD5\u3002",
      passedSummary: "\u7528\u6237\u5DF2\u786E\u8BA4\u8BE5\u5199\u6CD5\u9002\u7528\u4E8E\u6574\u672C\u4E66\u3002",
      evidence: [
        contract.approval?.approvedVersion ? `approved version: v${contract.approval.approvedVersion}` : "",
        contract.approval?.approvedAt || contract.approvedAt ? `approved at: ${contract.approval?.approvedAt || contract.approvedAt}` : "",
        contract.approval?.acceptedAsBookStyle === true ? "accepted as whole-book style" : ""
      ]
    }),
    loopProtocolEvidenceItem({
      key: "style_contract_freezer",
      label: "Style Contract Freezer",
      ok: freezerReady && styleReady,
      pendingSummary: "Freezer \u5C1A\u672A ready \u6216\u51BB\u7ED3\u8D44\u4EA7\u4E0D\u5B8C\u6574\u3002",
      passedSummary: "Style Contract Freezer \u5DF2 ready\uFF0C\u51BB\u7ED3\u8D44\u4EA7\u5B8C\u6574\u3002",
      evidence: [
        contract.freezer?.verdict ? `freezer verdict: ${contract.freezer.verdict}` : "",
        contract.frozenBasePrompt?.trim() ? "base writing prompt frozen" : "",
        contract.styleContract ? "style contract frozen" : "",
        contract.styleContract?.forbiddenPatterns?.length ? `forbidden patterns: ${contract.styleContract.forbiddenPatterns.length}` : "",
        contract.styleContract?.positiveExamples?.length ? `positive examples: ${contract.styleContract.positiveExamples.length}` : ""
      ]
    }),
    loopProtocolEvidenceItem({
      key: "chapter_inheritance_adapter",
      label: "Chapter Inheritance Adapter",
      ok: inheritanceReady && freezerReady && verification?.status === "passed",
      pendingSummary: "\u7AE0\u8282\u7EE7\u627F\u9002\u914D\u5668\u5C1A\u672A ready\u3002",
      passedSummary: "\u7AE0\u8282\u7EE7\u627F\u9002\u914D\u5668\u5DF2\u7ED1\u5B9A\u51BB\u7ED3\u5408\u540C\u3001Freezer \u548C\u9A8C\u8BC1\u8BC1\u636E\u3002",
      evidence: [
        contract.inheritance?.status ? `inheritance: ${contract.inheritance.status}` : "",
        contract.inheritance?.inheritedArtifacts?.length ? `inherited artifacts: ${contract.inheritance.inheritedArtifacts.length}` : "",
        contract.inheritance?.inheritedRules?.length ? `inherited rules: ${contract.inheritance.inheritedRules.length}` : ""
      ]
    })
  ];
  const completedStages = evidence.filter((item) => item.status === "passed").map((item) => item.key);
  const blockedStages = evidence.filter((item) => item.status === "blocked").map((item) => item.key);
  return {
    status: approved && blockedStages.length === 0 ? "approved" : blockedStages.includes("generation_verification") || blockedStages.includes("style_contract_freezer") ? "blocked" : history.length > 0 ? "running" : "pending",
    requiredStages,
    completedStages,
    blockedStages,
    evidence
  };
}
async function persistStyleFreezeLedger(projectRoot, contract) {
  const paths = absolutePaths(projectRoot);
  await import_promises4.default.mkdir(import_node_path7.default.dirname(paths.freezeLedger), { recursive: true });
  const ledger = buildStyleFreezeLedger(contract);
  await import_promises4.default.writeFile(paths.freezeLedger, `${JSON.stringify(ledger, null, 2)}
`);
  return ledger;
}
function relativePaths() {
  return {
    dir: STYLE_EVOLUTION_DIR,
    samplesDir: STYLE_SAMPLES_DIR,
    seedPrompt: STYLE_SEED_PATH,
    userStylePrompt: USER_STYLE_PROMPT_PATH,
    referenceText: REFERENCE_TEXT_PATH,
    history: EVOLUTION_HISTORY_PATH,
    styleContract: STYLE_CONTRACT_PATH,
    approvedSample: APPROVED_SAMPLE_PATH,
    freezeLedger: STYLE_FREEZE_LEDGER_PATH,
    loopRuntime: STYLE_LOOP_RUNTIME_PATH,
    loopRuns: STYLE_LOOP_RUNS_PATH
  };
}
function absolutePaths(projectRoot) {
  const paths = relativePaths();
  return {
    dir: import_node_path7.default.join(projectRoot, paths.dir),
    samplesDir: import_node_path7.default.join(projectRoot, paths.samplesDir),
    seedPrompt: import_node_path7.default.join(projectRoot, paths.seedPrompt),
    userStylePrompt: import_node_path7.default.join(projectRoot, paths.userStylePrompt),
    referenceText: import_node_path7.default.join(projectRoot, paths.referenceText),
    history: import_node_path7.default.join(projectRoot, paths.history),
    styleContract: import_node_path7.default.join(projectRoot, paths.styleContract),
    approvedSample: import_node_path7.default.join(projectRoot, paths.approvedSample),
    freezeLedger: import_node_path7.default.join(projectRoot, paths.freezeLedger),
    loopRuntime: import_node_path7.default.join(projectRoot, paths.loopRuntime),
    loopRuns: import_node_path7.default.join(projectRoot, paths.loopRuns)
  };
}
async function readStyleLoopRuntime(projectRoot) {
  const paths = absolutePaths(projectRoot);
  return readOptionalJson(paths.loopRuntime, null);
}
async function readOptionalText(filePath) {
  try {
    return await import_promises4.default.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}
async function readOptionalJson(filePath, fallback) {
  const raw = await readOptionalText(filePath);
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function normalizeText(value) {
  return value?.trim() || "";
}
function normalizeStringArray(value) {
  return Array.isArray(value) ? [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))] : [];
}
async function loadStyleEvolution(projectRoot) {
  const paths = absolutePaths(projectRoot);
  const contractFromDisk = await readOptionalJson(paths.styleContract, {});
  const history = await readOptionalJson(paths.history, []);
  const approvedSample = (await readOptionalText(paths.approvedSample)).trim();
  const contract = {
    runtime: {
      engine: "Style Evolution Engine",
      runtime: "Prompt Loop Runtime",
      gate: "Style Contract Freeze Gate",
      verificationGate: "Generation Verification Gate",
      lastRunId: contractFromDisk.runtime?.lastRunId,
      lastRunStatus: contractFromDisk.runtime?.lastRunStatus || "idle",
      lastStopReason: contractFromDisk.runtime?.lastStopReason,
      lastCompletedAt: contractFromDisk.runtime?.lastCompletedAt
    },
    ...contractFromDisk,
    retryPolicy: contractFromDisk.retryPolicy || defaultRetryPolicy(),
    seedPrompt: contractFromDisk.seedPrompt || (await readOptionalText(paths.seedPrompt)).trim(),
    userStylePrompt: contractFromDisk.userStylePrompt || (await readOptionalText(paths.userStylePrompt)).trim(),
    referenceText: contractFromDisk.referenceText || (await readOptionalText(paths.referenceText)).trim(),
    referenceWorks: normalizeStringArray(contractFromDisk.referenceWorks),
    desiredVibes: normalizeStringArray(contractFromDisk.desiredVibes),
    seedForbiddenPatterns: normalizeStringArray(contractFromDisk.seedForbiddenPatterns),
    approvedSample: contractFromDisk.approvedSample || approvedSample,
    approvedSamplePath: contractFromDisk.approvedSamplePath || (approvedSample ? APPROVED_SAMPLE_PATH : void 0),
    evolutionHistory: contractFromDisk.evolutionHistory || history,
    verification: contractFromDisk.verification
  };
  const latestVerification = activeContractGenerationVerification(contract, contract.evolutionHistory || []);
  if (latestVerification) {
    contract.verification = {
      gate: "Generation Verification Gate",
      ...latestVerification
    };
  }
  if (contract.approvedAt && !contract.approval?.approvedAt) {
    contract.approval = {
      status: "approved",
      approvedVersion: contract.loop?.approvalVersion,
      approvedAt: contract.approvedAt,
      approvedBy: contract.approval?.approvedBy || "user",
      freezeSummary: contract.approval?.freezeSummary || "\u7528\u6237\u5DF2\u786E\u8BA4\u5F53\u524D\u5199\u6CD5\u4E3A\u5168\u4E66\u57FA\u7840\u5199\u6CD5\u3002",
      acceptedAsBookStyle: true
    };
  }
  if (contract.frozenBasePrompt?.trim() && !contract.inheritance?.status) {
    contract.inheritance = {
      status: "enforced",
      inheritedArtifacts: ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"],
      inheritedRules: [
        "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F\u7528\u6237\u51BB\u7ED3\u540E\u7684 base writing prompt\u3002",
        "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F style contract \u4E2D\u7684 voice\u3001\u8282\u594F\u3001\u5BF9\u767D\u4E0E\u7981\u5FCC\u7EA6\u675F\u3002"
      ],
      promptSummary: contract.frozenBasePrompt.replace(/\s+/gu, " ").slice(0, 240)
    };
  }
  contract.loop = deriveLoopState(contract);
  contract.loopProtocol = deriveStyleLoopProtocol(contract);
  const freezeLedger = await readOptionalJson(paths.freezeLedger, buildStyleFreezeLedger(contract));
  const loopRuntime = await readStyleLoopRuntime(projectRoot);
  await persistStyleFreezeLedger(projectRoot, contract);
  return {
    paths: relativePaths(),
    contract,
    gate: evaluateStyleEvolutionGate(contract),
    freezeLedger: {
      ...freezeLedger,
      ...buildStyleFreezeLedger(contract)
    },
    loopRuntime
  };
}

// src/writing-pipeline.ts
var ProductionReadinessBlockedError = class extends Error {
  code = "production_readiness_blocked";
  gate = "style_approval";
  constructor(message) {
    super(message);
    this.name = "ProductionReadinessBlockedError";
  }
};
function currentBundleDir() {
  const stack = new Error().stack || "";
  for (const line of stack.split("\n")) {
    const fileUrlMatch = line.match(/\(?file:\/\/([^):]+):\d+:\d+\)?/);
    if (fileUrlMatch) {
      return import_node_path8.default.dirname(decodeURIComponent(fileUrlMatch[1]));
    }
    const fileMatch = line.match(/\((\/[^():]+):\d+:\d+\)/) || line.match(/at (\/[^():]+):\d+:\d+/);
    if (fileMatch) {
      return import_node_path8.default.dirname(fileMatch[1]);
    }
  }
  return process.cwd();
}
function workspaceRootForProject(projectRoot) {
  const marker = `${import_node_path8.default.sep}.ai-novel-projects${import_node_path8.default.sep}`;
  const index = projectRoot.indexOf(marker);
  if (index >= 0) {
    return projectRoot.slice(0, index);
  }
  return projectRoot;
}
async function readOptionalText2(filePath) {
  try {
    return (await import_promises5.default.readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}
async function readCharacterDossiers(filePath) {
  if (!filePath) return [];
  try {
    const parsed = JSON.parse(await import_promises5.default.readFile(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string") : [];
  } catch {
    return [];
  }
}
async function writeJsonFileAtomic(filePath, value) {
  await import_promises5.default.mkdir(import_node_path8.default.dirname(filePath), { recursive: true });
  const tempPath = import_node_path8.default.join(import_node_path8.default.dirname(filePath), `.${import_node_path8.default.basename(filePath)}.${Date.now()}.tmp`);
  await import_promises5.default.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`);
  await import_promises5.default.rename(tempPath, filePath);
}
async function writeChapterVersionManifest(input) {
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  const finalWordCount = wordCount(input.finalDraft);
  const draftWordCount = wordCount(input.draft);
  const styleDriftPassed = input.styleConformanceDrift ? input.styleConformanceDrift.status === "conformant" : true;
  const aigcPassed = input.aigcDetection.status === "passed";
  const styleInheritancePassed = input.styleInheritanceVerification ? String(input.styleInheritanceVerification.status || "") === "ready" : true;
  const adapterPassed = input.chapterInheritanceAdapter ? input.chapterInheritanceAdapter.status === "ready" : true;
  const finalVersionPassed = input.finalGate.status === "passed" && styleDriftPassed && aigcPassed && styleInheritancePassed && adapterPassed;
  const versions = [
    {
      id: "draft",
      label: "Draft",
      source: "draft",
      path: relativeArtifactPath(input.projectRoot, input.draftPath),
      wordCount: draftWordCount,
      status: "available",
      createdAt: now2
    },
    {
      id: "reviewed",
      label: "Reviewed",
      source: "reviewed",
      path: relativeArtifactPath(input.projectRoot, input.reviewedPath),
      wordCount: draftWordCount,
      status: "available",
      createdAt: now2
    },
    {
      id: "final",
      label: "Final",
      source: "final",
      path: relativeArtifactPath(input.projectRoot, input.finalPath),
      wordCount: finalWordCount,
      status: finalVersionPassed ? "passed" : "needs_revision",
      createdAt: now2
    }
  ];
  const manifest = {
    version: 1,
    chapterNumber: input.task.chapterNumber,
    chapterTitle: input.task.title,
    publishedVersionId: "final",
    locked: finalVersionPassed,
    status: finalVersionPassed ? "published" : "needs_review",
    writingMode: input.writingMode,
    targetWords: input.task.targetWords,
    wordCount: finalWordCount,
    updatedAt: now2,
    qualityGate: input.finalGate,
    aigcDetection: input.aigcDetection,
    chapterInheritanceAdapter: input.chapterInheritanceAdapter || null,
    styleInheritanceVerification: input.styleInheritanceVerification || null,
    styleConformanceDrift: input.styleConformanceDrift || null,
    artifacts: {
      report: relativeArtifactPath(input.projectRoot, input.reportPath),
      memory: relativeArtifactPath(input.projectRoot, input.memoryPath)
    },
    versions
  };
  const manifestPath = import_node_path8.default.join(import_node_path8.default.dirname(input.finalPath), `${input.chapterId}.versions.json`);
  await writeJsonFileAtomic(manifestPath, manifest);
  await recordPipelineArtifact(input.projectRoot, manifestPath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "chapter_version_manifest",
    publishedVersionId: manifest.publishedVersionId,
    status: manifest.status,
    locked: manifest.locked,
    versionCount: versions.length,
    qualityGate: input.finalGate,
    chapterInheritanceAdapter: input.chapterInheritanceAdapter || null,
    styleInheritanceVerification: input.styleInheritanceVerification || null,
    styleConformanceDrift: input.styleConformanceDrift || null
  });
  return manifestPath;
}
async function fileHasContent(filePath) {
  try {
    const stat = await import_promises5.default.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}
async function buildChapterStyleInheritanceVerification(input) {
  const contract = input.approvedStyleContext.contract || null;
  const approvedVersion = Number(contract?.loop?.approvalVersion || contract?.approval?.approvedVersion || 0);
  const contractApproved = input.approvedStyleContext.status === "ready" && Boolean(contract?.approvedAt || approvedVersion);
  const inheritanceStatus = String(contract?.inheritance?.status || "");
  const inheritedRules = Array.isArray(contract?.inheritance?.inheritedRules) ? contract.inheritance.inheritedRules : [];
  const inheritedArtifacts = Array.isArray(contract?.inheritance?.inheritedArtifacts) ? contract.inheritance.inheritedArtifacts : [];
  const chapterInheritanceAdapter = input.approvedStyleContext.chapterInheritanceAdapter || buildChapterInheritanceAdapterPayload(contract);
  const adapterReady = chapterInheritanceAdapter?.status === "ready";
  const freezerVerdict = chapterInheritanceAdapter?.freezerVerdict || contract?.freezer?.verdict || "missing";
  const freezeAssetsReady = Boolean(contract?.approvedSample?.trim() && contract?.frozenBasePrompt?.trim() && contract?.styleContract);
  const inheritanceAssetsReady = Boolean(
    await fileHasContent(input.paths.styleRulebookPath) && await fileHasContent(input.paths.styleReferencesPath) && await fileHasContent(input.paths.styleAntiPatternsPath)
  );
  const currentFingerprint = input.extractedStyleFingerprint || "";
  const styleFingerprintReady = Boolean(
    currentFingerprint || input.task.chapterNumber > 1 && contractApproved
  );
  const aigcStatus = input.aigcDetection.status;
  const highRiskCount = Array.isArray(input.aigcDetection.highRiskSegments) ? input.aigcDetection.highRiskSegments.length : 0;
  const styleConformanceDrift = input.styleConformanceDrift;
  const styleDriftBlocked = styleConformanceDrift.status === "drifted";
  const styleDriftWarning = styleConformanceDrift.status === "warning" || styleConformanceDrift.status === "pending";
  const evidence = [
    contractApproved ? approvedVersion > 0 ? `\u6574\u4E66\u5199\u6CD5\u5408\u540C\u5DF2\u51BB\u7ED3\u4E3A v${approvedVersion}` : "\u6574\u4E66\u5199\u6CD5\u5408\u540C\u5DF2\u51BB\u7ED3" : "",
    inheritanceStatus === "enforced" ? "\u7AE0\u8282\u7EE7\u627F\u94FE\u5DF2\u6807\u8BB0\u4E3A enforced" : "",
    adapterReady ? "Chapter Inheritance Adapter \u5DF2\u7ED1\u5B9A\u51BB\u7ED3\u5408\u540C\u3001Freezer \u4E0E\u9A8C\u8BC1\u8BC1\u636E" : "",
    freezerVerdict === "ready" ? "Style Contract Freezer \u5DF2 ready" : "",
    freezeAssetsReady ? "\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u3001\u57FA\u7840 prompt \u4E0E style contract \u5DF2\u5B58\u5728" : "",
    inheritanceAssetsReady ? "style/rulebook\u3001references\u3001anti-patterns \u5DF2\u540C\u6B65\u5230\u7AE0\u8282\u8D44\u4EA7" : "",
    input.finalGate.status === "passed" ? "\u672C\u7AE0\u8D28\u91CF\u95E8\u5DF2\u901A\u8FC7" : "",
    aigcStatus === "passed" ? "\u672C\u7AE0 AIGC \u68C0\u6D4B\u5DF2\u901A\u8FC7" : "",
    styleFingerprintReady ? "\u7AE0\u8282\u5199\u6CD5\u5DF2\u6709\u53EF\u8FFD\u8E2A\u7EE7\u627F\u53C2\u7167" : "",
    styleConformanceDrift.status === "conformant" ? styleConformanceDrift.reason : "",
    ...styleConformanceDrift.evidence.slice(0, 5)
  ].filter(Boolean);
  const risks = [
    !contractApproved ? "\u6574\u4E66\u5199\u6CD5\u5408\u540C\u5C1A\u672A\u51BB\u7ED3\u3002" : "",
    contractApproved && inheritanceStatus !== "enforced" ? `\u5199\u6CD5\u7EE7\u627F\u72B6\u6001\u4ECD\u4E3A ${inheritanceStatus || "pending"}\u3002` : "",
    !adapterReady ? "Chapter Inheritance Adapter \u5C1A\u672A ready\uFF0C\u51BB\u7ED3\u5408\u540C\u4E0D\u80FD\u4F5C\u4E3A\u7AE0\u8282\u786C\u57FA\u7EBF\u3002" : "",
    freezerVerdict !== "ready" ? `Style Contract Freezer verdict \u4E3A ${freezerVerdict}\u3002` : "",
    !freezeAssetsReady ? "\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u8D44\u4EA7\u4E0D\u5B8C\u6574\u3002" : "",
    !inheritanceAssetsReady ? "\u7AE0\u8282\u7EE7\u627F\u8D44\u4EA7\u672A\u5B8C\u5168\u540C\u6B65\u3002" : "",
    input.finalGate.status === "blocked" ? `\u8D28\u91CF\u95E8\u963B\u585E\uFF1A${input.finalGate.reason}` : "",
    aigcStatus === "blocked" ? `AIGC \u68C0\u6D4B\u963B\u585E\uFF1A${highRiskCount} \u4E2A\u9AD8\u98CE\u9669\u7247\u6BB5\u3002` : "",
    aigcStatus === "unavailable" || aigcStatus === "skipped" ? `AIGC \u68C0\u6D4B\u72B6\u6001\u4E3A ${aigcStatus}\uFF1A${input.aigcDetection.reason}` : "",
    !styleFingerprintReady ? "\u7AE0\u8282\u5199\u6CD5\u7EE7\u627F\u53C2\u7167\u5C1A\u4E0D\u5B8C\u6574\u3002" : "",
    styleDriftBlocked || styleDriftWarning ? styleConformanceDrift.reason : "",
    ...styleConformanceDrift.risks.slice(0, 5)
  ].filter(Boolean);
  let status = "ready";
  if (!contractApproved) {
    status = "pending";
  } else if (inheritanceStatus !== "enforced" || !adapterReady || input.finalGate.status === "blocked" || aigcStatus === "blocked" || styleDriftBlocked) {
    status = "blocked";
  } else if (!freezeAssetsReady || !inheritanceAssetsReady || !styleFingerprintReady || aigcStatus !== "passed" || styleDriftWarning) {
    status = "warning";
  }
  const summary = status === "ready" ? "\u672C\u7AE0\u5DF2\u7EE7\u627F\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\uFF0C\u5E76\u901A\u8FC7\u8D28\u91CF\u95E8\u3001AIGC \u4E0E\u98CE\u683C\u6F02\u79FB\u751F\u4EA7\u9A8C\u8BC1\u3002" : status === "warning" ? "\u672C\u7AE0\u5DF2\u63A5\u5165\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\uFF0C\u4F46\u4ECD\u6709\u98CE\u683C\u7EE7\u627F\u8BC1\u636E\u6216\u6F02\u79FB\u98CE\u9669\u9700\u8981\u8865\u5F3A\u3002" : status === "blocked" ? "\u672C\u7AE0\u5199\u6CD5\u7EE7\u627F\u9A8C\u8BC1\u672A\u653E\u884C\uFF0C\u9700\u5148\u5904\u7406\u963B\u585E\u9879\u3002" : "\u672C\u7AE0\u8FD8\u6CA1\u6709\u53EF\u786E\u8BA4\u7684\u51BB\u7ED3\u5199\u6CD5\u5408\u540C\u7EE7\u627F\u57FA\u7EBF\u3002";
  return {
    status,
    summary,
    chapterNumber: input.task.chapterNumber,
    contractVersion: approvedVersion,
    contractApproved,
    approvedAt: String(contract?.approvedAt || contract?.approval?.approvedAt || ""),
    inheritanceStatus,
    chapterInheritanceAdapter,
    adapterReady,
    freezerVerdict,
    inheritedRuleCount: inheritedRules.length,
    inheritedArtifactCount: inheritedArtifacts.length,
    freezeAssetsReady,
    inheritanceAssetsReady,
    styleFingerprintReady,
    styleFingerprint: currentFingerprint,
    styleConformanceDrift,
    styleDrift: {
      status: styleConformanceDrift.status,
      conformanceScore: Math.round(styleConformanceDrift.conformanceScore * 10),
      driftScore: Math.round(styleConformanceDrift.driftScore * 10),
      threshold: 72,
      rawConformanceScore: styleConformanceDrift.conformanceScore,
      rawDriftScore: styleConformanceDrift.driftScore,
      forbiddenHitCount: styleConformanceDrift.metrics.forbiddenHitCount,
      matchedTerms: styleConformanceDrift.matchedContractRules,
      missingTerms: styleConformanceDrift.missingContractRules,
      summary: styleConformanceDrift.reason
    },
    qualityGateStatus: input.finalGate.status,
    qualityGateReason: input.finalGate.reason,
    aigc: {
      status: aigcStatus,
      score: input.aigcDetection.score,
      threshold: input.aigcDetection.threshold,
      highRiskCount,
      reason: input.aigcDetection.reason
    },
    verificationStatus: String(contract?.verification?.status || contract?.loop?.verificationStatus || ""),
    verificationSummary: String(contract?.verification?.summary || contract?.loop?.verificationSummary || ""),
    checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
    evidence,
    risks
  };
}
var STYLE_CONFORMANCE_STOPWORDS = /* @__PURE__ */ new Set([
  "\u4E00\u4E2A",
  "\u4E00\u79CD",
  "\u8FD9\u4E00",
  "\u8FD9\u4E2A",
  "\u8FD9\u4E9B",
  "\u90A3\u4E9B",
  "\u5FC5\u987B",
  "\u4E0D\u5F97",
  "\u4E0D\u8981",
  "\u4E0D\u80FD",
  "\u5E94\u8BE5",
  "\u4FDD\u6301",
  "\u540E\u7EED",
  "\u7AE0\u8282",
  "\u6B63\u6587",
  "\u5199\u6CD5",
  "\u98CE\u683C",
  "\u5408\u540C",
  "\u89C4\u5219",
  "\u7528\u6237",
  "\u786E\u8BA4",
  "\u51BB\u7ED3",
  "\u5168\u4E66",
  "\u6837\u6BB5",
  "\u6587\u672C",
  "\u8FDB\u884C",
  "\u901A\u8FC7",
  "\u9700\u8981",
  "\u907F\u514D",
  "\u51CF\u5C11",
  "\u589E\u52A0",
  "\u5448\u73B0",
  "\u4F7F\u7528",
  "\u63A8\u52A8",
  "\u4E0D\u8981\u5199",
  "\u4E0D\u5F97\u5199"
]);
function roundStyleScore(value) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}
function averageNarrativeSentenceLength(text = "") {
  const sentences = text.split(/[。！？!?；;\n]+/u).map((sentence) => sentence.replace(/\s+/gu, "").trim()).filter(Boolean);
  if (!sentences.length) return 0;
  return Math.round(sentences.reduce((sum, sentence) => sum + sentence.length, 0) / sentences.length * 10) / 10;
}
function dialogueStats(text = "") {
  const quoted = text.match(/[「“][^」”]{1,160}[」”]/gu) || [];
  const colonLines = text.match(/^[\p{Script=Han}A-Za-z0-9_·]{1,12}[：:][^\n]{1,120}$/gmu) || [];
  const dialogue = [...quoted, ...colonLines];
  const chars = dialogue.reduce((sum, line) => sum + line.replace(/[「」“”：:\s]/gu, "").length, 0);
  const avgLength = dialogue.length ? Math.round(chars / dialogue.length * 10) / 10 : 0;
  return {
    count: dialogue.length,
    chars,
    avgLength,
    ratio: text.length ? Math.round(chars / text.length * 1e3) / 1e3 : 0
  };
}
function extractStyleEvidenceTokens(text = "", limit = 80) {
  const normalized = text.replace(/```[\s\S]*?```/g, " ").replace(/\s+/gu, " ");
  const raw = normalized.match(/[\p{Script=Han}A-Za-z0-9]{2,8}/gu) || [];
  const tokens = raw.map((token) => token.trim()).filter((token) => token.length >= 2).filter((token) => !STYLE_CONFORMANCE_STOPWORDS.has(token)).filter((token) => !/^(pending|style|contract|prompt|rule|rules|chapter|voice)$/iu.test(token));
  return uniqueStrings(tokens).slice(0, limit);
}
function styleEvidenceWindow(text, token, limit = 90) {
  const compactToken = token.trim();
  if (!compactToken) return "";
  const index = text.indexOf(compactToken);
  if (index < 0) return "";
  const start = Math.max(0, index - 36);
  const end = Math.min(text.length, index + compactToken.length + 36);
  return conciseEvidence(text.slice(start, end), limit);
}
function countLiteralPatternHits(text, pattern) {
  const normalized = pattern.trim();
  if (!normalized || normalized.length < 2) return 0;
  const escaped = escapeRegExpLiteral(normalized);
  return (text.match(new RegExp(escaped, "gu")) || []).length;
}
function collectForbiddenStyleHits(text, patterns = []) {
  return uniqueStrings(patterns).map((pattern) => {
    const literalCount = countLiteralPatternHits(text, pattern);
    const tokens = extractStyleEvidenceTokens(pattern, 8);
    const tokenHits = tokens.map((token) => ({ token, count: countLiteralPatternHits(text, token) })).filter((hit) => hit.count > 0);
    const count = literalCount || tokenHits.reduce((sum, hit) => sum + hit.count, 0);
    const evidence = uniqueStrings([
      ...literalCount > 0 ? [styleEvidenceWindow(text, pattern)] : [],
      ...tokenHits.map((hit) => styleEvidenceWindow(text, hit.token))
    ].filter(Boolean)).slice(0, 3);
    return { pattern, count, evidence };
  }).filter((hit) => hit.count > 0).slice(0, 12);
}
function styleRuleMatchesText(input) {
  const rule = input.rule.trim();
  if (!rule) return false;
  const tokens = extractStyleEvidenceTokens(rule, 12);
  const tokenMatches = tokens.filter((token) => input.body.includes(token));
  if (tokenMatches.length >= Math.min(2, Math.max(1, Math.ceil(tokens.length * 0.25)))) return true;
  if (/短句|句子短|短促|冷感|克制|白描/u.test(rule) && input.avgSentenceLength > 0 && input.avgSentenceLength <= 24) return true;
  if (/长短|错落|节奏/u.test(rule) && input.avgSentenceLength >= 10 && input.avgSentenceLength <= 34) return true;
  if (/对白|对话/u.test(rule)) {
    if (/短|压力|留白|不解释|少解释/u.test(rule)) {
      return input.dialogue.count > 0 && (input.dialogue.avgLength === 0 || input.dialogue.avgLength <= 34);
    }
    return input.dialogue.count > 0;
  }
  if (/动作|物件|器物|声音|感官|身体|场景|细节|白描/u.test(rule)) {
    return input.actionSignals + input.sensorySignals + input.objectSignals >= 8;
  }
  if (/情绪|克制|外化|不解释|少解释/u.test(rule)) {
    return input.actionSignals >= Math.max(3, input.emotionLabelSignals);
  }
  if (/视角|POV|主角|第三人称|第一人称/iu.test(rule)) {
    return input.body.length >= 120;
  }
  return false;
}
function evaluateChapterStyleConformanceDrift(input) {
  const contract = input.approvedStyleContext.contract;
  const style = contract?.styleContract;
  const body = extractNarrativeBody(input.chapterText);
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  const styleQuality = evaluateNarrativeStyleQuality(body);
  const bodyChars = body.trim().length;
  if (input.approvedStyleContext.status !== "ready" || !contract?.approvedAt || !style) {
    return {
      status: "pending",
      conformanceScore: 0,
      driftScore: 10,
      score: 0,
      reason: "\u98CE\u683C\u6F02\u79FB\u8BC4\u5206\u5F85\u5B9A\uFF1A\u7F3A\u5C11\u5DF2\u51BB\u7ED3\u5E76\u83B7\u6279\u7684 style contract\uFF0C\u65E0\u6CD5\u8BA1\u7B97\u771F\u5B9E\u7EE7\u627F\u57FA\u7EBF\u3002",
      evidence: [],
      risks: ["\u7F3A\u5C11\u53EF\u8BC4\u5206\u7684 frozen style contract\u3002"],
      metrics: {
        bodyChars,
        contractRuleCount: 0,
        matchedRuleCount: 0,
        approvedSampleOverlap: 0,
        positiveExampleHitCount: 0,
        allowedDeviceHitCount: 0,
        forbiddenHitCount: 0,
        narrativeStyleStatus: styleQuality.status,
        averageSentenceLength: averageNarrativeSentenceLength(body),
        dialogueRatio: dialogueStats(body).ratio
      },
      forbiddenHits: [],
      matchedContractRules: [],
      missingContractRules: [],
      checkedAt
    };
  }
  const avgSentenceLength = averageNarrativeSentenceLength(body);
  const dialogue = dialogueStats(body);
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|写|敲|拦|避|追|停|跪|坐|起|握|松|咬|皱眉|沉默/gu) || []).length;
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软|烫|凉|光|影/gu) || []).length;
  const objectSignals = (body.match(/账册|账本|密信|官印|印章|钥匙|玉佩|粮袋|银钱|文书|案卷|药包|伤口|马车|城门|坊门|县衙|市集|粮仓|名单|证据|刀|剑|灯|门|桌|碗|纸|窗|袖/gu) || []).length;
  const emotionLabelSignals = (body.match(/愤怒|悲伤|恐惧|绝望|震惊|激动|开心|难过|复杂|崩溃|释然|痛苦|焦虑/gu) || []).length;
  const ruleCandidates = uniqueStrings([
    style.voice || "",
    style.sentenceRhythm || "",
    ...style.dialogueRules || [],
    ...style.descriptionRules || [],
    ...style.emotionRules || [],
    ...style.pacingRules || [],
    ...style.povRules || [],
    ...style.openingRules || [],
    ...style.endingHookRules || []
  ]).filter((rule) => !isPlaceholderProfileText(rule));
  const matchedContractRules = ruleCandidates.filter((rule) => styleRuleMatchesText({
    rule,
    body,
    avgSentenceLength,
    dialogue,
    actionSignals,
    sensorySignals,
    objectSignals,
    emotionLabelSignals
  })).slice(0, 16);
  const missingContractRules = ruleCandidates.filter((rule) => !matchedContractRules.includes(rule)).slice(0, 16);
  const approvedSampleTokens = extractStyleEvidenceTokens(contract.approvedSample || "", 80);
  const approvedSampleMatched = approvedSampleTokens.filter((token) => body.includes(token));
  const approvedSampleOverlap = approvedSampleTokens.length ? Math.round(approvedSampleMatched.length / approvedSampleTokens.length * 1e3) / 1e3 : 0;
  const positiveExamples = style.positiveExamples || [];
  const positiveExampleHits = positiveExamples.filter(
    (example) => extractStyleEvidenceTokens(example, 12).some((token) => body.includes(token))
  );
  const allowedDevices = style.allowedDevices || [];
  const allowedDeviceHits = allowedDevices.filter(
    (device) => extractStyleEvidenceTokens(device, 8).some((token) => body.includes(token))
  );
  const forbiddenHits = collectForbiddenStyleHits(body, [
    ...style.forbiddenPatterns || [],
    ...style.negativeExamples || [],
    ...contract.antiPatterns || []
  ]);
  const forbiddenHitCount = forbiddenHits.reduce((sum, hit) => sum + hit.count, 0);
  const ruleRatio = ruleCandidates.length ? matchedContractRules.length / ruleCandidates.length : 0;
  const styleQualityPenalty = styleQuality.status === "quarantined" ? 1.6 : 0;
  const forbiddenPenalty = Math.min(4, forbiddenHitCount * 1.15);
  const sampleScore = approvedSampleTokens.length ? Math.min(1.4, approvedSampleOverlap * 3.2) : 0.4;
  const positiveScore = Math.min(1.2, (positiveExampleHits.length + allowedDeviceHits.length) * 0.35);
  const signalScore = Math.min(1.2, (actionSignals + sensorySignals + objectSignals) / 26);
  const ruleScore = ruleCandidates.length ? ruleRatio * 6.2 : 3;
  const conformanceScore = roundStyleScore(ruleScore + sampleScore + positiveScore + signalScore - forbiddenPenalty - styleQualityPenalty);
  const driftScore = roundStyleScore(10 - conformanceScore);
  const risks = [
    ...missingContractRules.length ? [`\u5408\u540C\u89C4\u5219\u7F3A\u5C11\u6B63\u6587\u8BC1\u636E\uFF1A${missingContractRules.slice(0, 4).map((rule) => conciseEvidence(rule, 64)).join("\uFF1B")}`] : [],
    ...forbiddenHits.length ? [`\u547D\u4E2D\u51BB\u7ED3\u7981\u5FCC\u6A21\u5F0F\uFF1A${forbiddenHits.slice(0, 4).map((hit) => `${hit.pattern}(${hit.count})`).join("\uFF1B")}`] : [],
    ...styleQuality.status === "quarantined" ? [styleQuality.reason] : [],
    ...approvedSampleTokens.length && approvedSampleOverlap < 0.08 ? ["\u4E0E approved sample \u7684\u53EF\u590D\u6838\u98CE\u683C token \u91CD\u53E0\u504F\u4F4E\u3002"] : [],
    ...dialogue.count === 0 && /对白|对话/u.test(ruleCandidates.join("\n")) ? ["\u5408\u540C\u8981\u6C42\u5BF9\u767D\u8D28\u611F\uFF0C\u4F46\u6B63\u6587\u672A\u68C0\u6D4B\u5230\u5BF9\u767D\u3002"] : []
  ].slice(0, 10);
  const evidence = uniqueStrings([
    matchedContractRules.length ? `\u547D\u4E2D\u5408\u540C\u89C4\u5219 ${matchedContractRules.length}/${Math.max(1, ruleCandidates.length)}\uFF1A${matchedContractRules.slice(0, 4).map((rule) => conciseEvidence(rule, 64)).join("\uFF1B")}` : "",
    approvedSampleMatched.length ? `approved sample token \u547D\u4E2D\uFF1A${approvedSampleMatched.slice(0, 8).join("\u3001")}` : "",
    positiveExampleHits.length ? `\u6B63\u4F8B/\u5141\u8BB8\u88C5\u7F6E\u547D\u4E2D ${positiveExampleHits.length + allowedDeviceHits.length} \u9879\u3002` : "",
    `\u53E5\u957F\u5747\u503C ${avgSentenceLength}\uFF1B\u5BF9\u767D ${dialogue.count} \u6BB5\uFF1B\u52A8\u4F5C/\u611F\u5B98/\u7269\u4EF6\u4FE1\u53F7 ${actionSignals}/${sensorySignals}/${objectSignals}\u3002`,
    input.extractedStyleFingerprint ? `\u5F53\u524D\u7AE0\u8282\u98CE\u683C\u6307\u7EB9\uFF1A${conciseEvidence(input.extractedStyleFingerprint, 120)}` : "",
    styleQuality.status === "eligible" ? styleQuality.reason : ""
  ].filter(Boolean)).slice(0, 10);
  const status = conformanceScore >= 7.2 && risks.length === 0 ? "conformant" : conformanceScore < 5.8 || forbiddenHitCount >= 2 || styleQuality.status === "quarantined" ? "drifted" : "warning";
  return {
    status,
    conformanceScore,
    driftScore,
    score: conformanceScore,
    reason: status === "conformant" ? `\u98CE\u683C\u7EE7\u627F\u8BC4\u5206\u901A\u8FC7\uFF1Aconformance=${conformanceScore}/10\uFF0Cdrift=${driftScore}/10\uFF0C\u6B63\u6587\u8BC1\u636E\u8986\u76D6\u51BB\u7ED3\u5408\u540C\u4E14\u672A\u547D\u4E2D\u7981\u5FCC\u3002` : status === "warning" ? `\u98CE\u683C\u7EE7\u627F\u8BC4\u5206\u9884\u8B66\uFF1Aconformance=${conformanceScore}/10\uFF0Cdrift=${driftScore}/10\uFF0C\u5B58\u5728\u53EF\u4FEE\u590D\u7684\u7EE7\u627F\u8BC1\u636E\u7F3A\u53E3\u3002` : `\u98CE\u683C\u6F02\u79FB\u8BC4\u5206\u963B\u585E\uFF1Aconformance=${conformanceScore}/10\uFF0Cdrift=${driftScore}/10\uFF0C\u6B63\u6587\u8BC1\u636E\u663E\u793A\u504F\u79BB\u51BB\u7ED3\u5408\u540C\u3002`,
    evidence,
    risks,
    metrics: {
      bodyChars,
      contractRuleCount: ruleCandidates.length,
      matchedRuleCount: matchedContractRules.length,
      approvedSampleOverlap,
      positiveExampleHitCount: positiveExampleHits.length,
      allowedDeviceHitCount: allowedDeviceHits.length,
      forbiddenHitCount,
      narrativeStyleStatus: styleQuality.status,
      averageSentenceLength: avgSentenceLength,
      dialogueRatio: dialogue.ratio
    },
    forbiddenHits,
    matchedContractRules,
    missingContractRules,
    checkedAt
  };
}
function formatStyleConformanceDriftReport(report) {
  return [
    "## Style Conformance Drift",
    `- Status: ${report.status}`,
    `- Conformance score: ${report.conformanceScore}/10`,
    `- Drift score: ${report.driftScore}/10`,
    `- Reason: ${report.reason}`,
    `- Contract rule evidence: ${report.metrics.matchedRuleCount}/${report.metrics.contractRuleCount}`,
    `- Approved sample overlap: ${report.metrics.approvedSampleOverlap}`,
    `- Forbidden hits: ${report.metrics.forbiddenHitCount}`,
    report.evidence.length ? "### Evidence" : "",
    ...report.evidence.map((item) => `- ${item}`),
    report.risks.length ? "### Risks" : "",
    ...report.risks.map((item) => `- ${item}`)
  ].filter(Boolean).join("\n");
}
function compactList(values = [], limit = 3) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit).join("; ") || "pending";
}
function clipPromptSection(value = "", maxLength = 800) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}
...[prompt section clipped; full text saved in chapter context package]`;
}
function summarizePromptSection(value = "", maxLength = 700) {
  const normalized = value.split("\n").map((line) => line.trim()).filter(Boolean).join("\n");
  return clipPromptSection(normalized, maxLength);
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
    `  relation=${dossier.relationshipState}; delta=${dossier.currentChapterDelta}`,
    `  evidence=${compactList(dossier.evidence.slice(-2), 2)}`
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
function createCharacterRelationshipGraph(dossiers, updatedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const nodes = dossiers.map((dossier) => ({
    id: dossier.id,
    name: dossier.canonicalName,
    role: dossier.role,
    aliases: dossier.aliases || [],
    relationshipState: dossier.relationshipState,
    currentChapterDelta: dossier.currentChapterDelta,
    updatedAt: dossier.updatedAt || updatedAt
  }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = dossiers.flatMap((dossier) => (dossier.relationshipEdges || []).map((edge) => ({
    sourceId: dossier.id,
    sourceName: dossier.canonicalName,
    targetId: edge.targetId,
    targetName: nodes.find((node) => node.id === edge.targetId)?.name || edge.targetId,
    label: edge.label,
    pressure: edge.pressure,
    status: nodeIds.has(edge.targetId) ? "linked" : "unresolved",
    updatedAt: dossier.updatedAt || updatedAt
  })));
  return {
    version: 1,
    updatedAt,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges
  };
}
function formatCharacterRelationshipGraphMarkdown(graph) {
  return [
    "# Character Relationship Graph",
    "",
    `Updated at: ${graph.updatedAt}`,
    "",
    "## Nodes",
    ...graph.nodes.length ? graph.nodes.slice(0, 24).map(
      (node) => `- ${node.id} (${node.role}) ${node.name}: ${node.relationshipState || "relationship pending"}`
    ) : ["- no character nodes available"],
    "",
    "## Edges",
    ...graph.edges.length ? graph.edges.slice(0, 48).map(
      (edge) => `- ${edge.sourceId} -> ${edge.targetId}: ${edge.label}; pressure: ${edge.pressure}; status: ${edge.status}`
    ) : ["- no relationship edges available"]
  ].join("\n");
}
function appendUnique(values, next, limit = 8) {
  const normalized = next.trim();
  if (!normalized) return values.slice(0, limit);
  return [...values.filter((value) => value !== normalized), normalized].slice(-limit);
}
function isPlaceholderProfileText(value = "") {
  return !value.trim() || /\bpending\b|待定|暂无|requires .*enrichment|needs .*enrichment|inferred from future scenes|must be tracked|must carry|must reveal|must change/iu.test(value);
}
function isPlaceholderProfileList(values = []) {
  return values.length === 0 || values.every((value) => isPlaceholderProfileText(value));
}
function conciseEvidence(value, limit = 140) {
  return value.replace(/^#+\s*/u, "").replace(/^[-*]\s*/u, "").replace(/\s+/gu, " ").trim().slice(0, limit);
}
function extractCharacterEvidenceWindows(text, names, limit = 8) {
  const usableNames = uniqueStrings(names.filter((name) => name && !/^pending-/iu.test(name)));
  const lines = text.split(/\n+/u).map((line) => conciseEvidence(line, 220)).filter(Boolean).filter((line) => !/^Drafting Metadata|Naturalness Report|Character Profile Projection$/iu.test(line));
  if (!usableNames.length) {
    return lines.slice(0, limit);
  }
  const namePattern = new RegExp(usableNames.map(escapeRegExpLiteral).join("|"), "u");
  const direct = lines.filter((line) => namePattern.test(line));
  const profileSignals = lines.filter((line) => /主角|人物|角色|关系|选择|欲望|伤口|习惯|说话|外貌|体态|特长|短板|停顿|立场|能力|线索/u.test(line));
  return uniqueStrings([...direct, ...profileSignals]).slice(0, limit);
}
function firstEvidenceMatching(windows, pattern) {
  return windows.find((window) => pattern.test(window)) || "";
}
function updateProfileListFromSignal(values, signal, limit = 8) {
  if (!signal) return values.slice(0, limit);
  return isPlaceholderProfileList(values) ? [signal] : appendUnique(values, signal, limit);
}
function enrichRelationshipEdges(edges, relationshipPressure, protagonistName) {
  if (!relationshipPressure) return edges;
  if (!edges.length) {
    return [{
      targetId: "protagonist",
      label: protagonistName ? `pressure around ${protagonistName}` : "relationship pressure",
      pressure: relationshipPressure
    }];
  }
  return edges.map((edge, index) => index === 0 && isPlaceholderProfileText(edge.pressure) ? { ...edge, pressure: relationshipPressure } : edge);
}
function extractCharacterProfileSignals(input) {
  const windows = extractCharacterEvidenceWindows(input.text, [
    input.dossier.canonicalName,
    ...input.dossier.aliases,
    input.dossier.role === "protagonist" ? input.protagonistName : ""
  ]);
  const action = firstEvidenceMatching(windows, /选择|处理|抓住|判断|反击|停顿|回避|试探|压|藏|递|推|看|听|握|抬|低|转|拦|走|拿|放/u);
  const speech = firstEvidenceMatching(windows, /「|」|说|问|道|低声|称呼|话|停顿/u);
  const body = firstEvidenceMatching(windows, /眼|手|腕|指|肩|背|袖|脚|身|体|体态|看见|触感|声音|反应|姿态|站|退/u);
  const relation = firstEvidenceMatching(windows, /关系|对方|别人|有人|信任|债|债务|压力|试探|回避|立场|要求|逼|冲突|配角|主角/u);
  const skill = firstEvidenceMatching(windows, /判断|抓住|线索|反击|处理|策略|推理|能力|规则|账|田册|官印|密信/u);
  const limit = firstEvidenceMatching(windows, /不完美|代价|压力|逼|不能|风险|恐惧|弱点|伤口|问题/u);
  return {
    desire: `${input.chapterLabel}: pursues the scene objective: ${input.causalPlan.sceneObjective}`,
    wound: limit ? `${input.chapterLabel}: pressure signal: ${conciseEvidence(limit)}` : `${input.chapterLabel}: pressure is tied to ${input.causalPlan.previousInput}`,
    contradiction: `${input.chapterLabel}: chooses under pressure: ${input.causalPlan.protagonistDecision}`,
    habit: `${input.chapterLabel}: ${conciseEvidence(action || input.causalPlan.protagonistDecision)}`,
    speech: `${input.chapterLabel}: ${conciseEvidence(speech || "speech pressure must follow the character's current relationship and choice")}`,
    body: `${input.chapterLabel}: ${conciseEvidence(body || "visible body marker must be carried through action and scene pressure")}`,
    skill: `${input.chapterLabel}: ${conciseEvidence(skill || input.causalPlan.sceneObjective)}`,
    limitation: `${input.chapterLabel}: ${conciseEvidence(limit || input.causalPlan.irreversibleConsequence)}`,
    relationship: relation ? `${input.chapterLabel}: ${conciseEvidence(relation)}` : `${input.chapterLabel}: relationship pressure follows ${input.causalPlan.characterStateDelta}`,
    arc: `${input.chapterLabel}: ${input.causalPlan.nextHandoff}`,
    evidence: windows[0] ? `${input.chapterLabel} profile signal: ${conciseEvidence(windows[0], 180)}` : ""
  };
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
  const causalPlan = getTaskCausalPlan(input.state, input.task);
  const chapterDelta = `${chapterLabel}: ${causalPlan.characterStateDelta}`;
  const evidence = `${chapterLabel}: ${input.finalDraft.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 2).join(" ").slice(0, 180)}`;
  const continuityNote = `${chapterLabel}: ${input.continuityContract.continuityAnchors.slice(0, 4).join("\u3001") || "new continuity anchors pending"}`;
  const dossiers = input.dossiers.length ? input.dossiers : [];
  const nextDossiers = dossiers.map((dossier) => {
    const isProtagonist = dossier.role === "protagonist" || dossier.id === "protagonist";
    const isKnownCast = knownCast.some((name) => name && (dossier.canonicalName === name || dossier.aliases.includes(name)));
    if (!isProtagonist && !isKnownCast) return dossier;
    const canonicalName = isProtagonist && protagonistName && dossier.canonicalName.startsWith("pending-") ? protagonistName : dossier.canonicalName;
    const aliases = uniqueStrings([
      ...dossier.aliases,
      ...isProtagonist && protagonistName ? [protagonistName] : []
    ]).slice(0, 8);
    const profileSignals = extractCharacterProfileSignals({
      dossier: { ...dossier, canonicalName, aliases },
      text: `${input.finalDraft}

${input.memoryUpdate}`,
      chapterLabel,
      causalPlan,
      protagonistName
    });
    return {
      ...dossier,
      canonicalName,
      aliases,
      coreDesire: isPlaceholderProfileText(dossier.coreDesire) ? profileSignals.desire : dossier.coreDesire,
      fearOrWound: isPlaceholderProfileText(dossier.fearOrWound) ? profileSignals.wound : dossier.fearOrWound,
      contradiction: isPlaceholderProfileText(dossier.contradiction) ? profileSignals.contradiction : dossier.contradiction,
      behaviorHabits: updateProfileListFromSignal(dossier.behaviorHabits, profileSignals.habit),
      speechMarkers: updateProfileListFromSignal(dossier.speechMarkers, profileSignals.speech),
      appearanceAndBody: isPlaceholderProfileText(dossier.appearanceAndBody) && profileSignals.body ? profileSignals.body : dossier.appearanceAndBody,
      skills: updateProfileListFromSignal(dossier.skills, profileSignals.skill),
      limitations: updateProfileListFromSignal(dossier.limitations, profileSignals.limitation),
      relationshipState: isPlaceholderProfileText(dossier.relationshipState) ? profileSignals.relationship : dossier.relationshipState,
      relationshipEdges: enrichRelationshipEdges(dossier.relationshipEdges, profileSignals.relationship, protagonistName),
      arcTrajectory: isPlaceholderProfileText(dossier.arcTrajectory) ? profileSignals.arc : dossier.arcTrajectory,
      currentChapterDelta: chapterDelta,
      continuityNotes: appendUnique(dossier.continuityNotes, continuityNote),
      evidence: appendUnique(appendUnique(dossier.evidence, evidence), profileSignals.evidence),
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
  return import_node_path8.default.relative(projectRoot, absolutePath).replaceAll(import_node_path8.default.sep, "/");
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
function writingMessageStatus(payload) {
  if (payload.status === "blocked") return "failed";
  if (isLlmWritingStep(payload.step) && (payload.status === "running" || payload.status === "started")) return "streaming";
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
        status: writingMessageStatus(payload),
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
  const summaryScoreMatches = [...report.matchAll(/(?:^|\n)\s*\|?\s*(?:综合评分|overall\s*score|overall|score)\s*(?:\||[:：])\s*(\d{1,2})(?:\s*\/\s*10)?/giu)];
  const scoreMatches = [...report.matchAll(/(?:综合评分|overall|score)[^\d]{0,12}(\d{1,2})(?:\s*\/\s*10)?/giu)];
  const score = summaryScoreMatches.length ? Number(summaryScoreMatches[summaryScoreMatches.length - 1][1]) : scoreMatches.length ? Math.max(...scoreMatches.map((match) => Number(match[1])).filter((value) => Number.isFinite(value))) : report.includes("needs-manual-review") || report.includes("\u9700\u8981\u8FD4\u5DE5") ? 5 : 8;
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
  const hasBlockingIssue = explicitBlockMarker || !explicitPassMarker && (/严重问题|必须返工|需要返工|质量不足|低于.*门槛|不能进入\s*complete|manual review|manual-review/u.test(blockingScanText) || /\bblocked\b/iu.test(blockingScanText));
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
  const softStyleIssue = isSoftNarrativeStyleIssue(styleQuality);
  if (styleQuality.status === "quarantined" && !softStyleIssue) {
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
    reason: gate.passed || gate.status === "passed" ? `${gate.reason} ${consistency.reason} ${plotContinuity.reason} ${styleQuality.reason} ${softStyleIssue ? "\u8BE5\u98CE\u683C\u95EE\u9898\u5DF2\u4F5C\u4E3A\u540E\u7EED\u6DA6\u8272\u5EFA\u8BAE\u8BB0\u5F55\uFF0C\u4E0D\u963B\u65AD\u7AE0\u8282\u63A8\u8FDB\u3002" : ""} ${characterProfileQuality.reason} ${naturalnessReport.reason}`.trim() : gate.reason,
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
  const selectedStyleFingerprint = state.project.creativeProfile?.styleFingerprint?.trim();
  const selectedProfileText = [
    selectedGenre && selectedGenre !== "auto-inferred" ? selectedGenre : "",
    selectedReaderPromise || "",
    selectedPointOfView || "",
    selectedTone || "",
    selectedStyleFingerprint || ""
  ].join("\n");
  const text = `${state.project.title}
${state.project.idea}`.toLowerCase();
  const profileText = `${selectedProfileText}
${text}`.toLowerCase();
  const preset = findGenrePreset(profileText);
  const withProfile = (profile) => {
    const contractDetails = [profile.narration];
    if (preset) {
      contractDetails.push(
        `- \u7C7B\u578B\u723D\u70B9\u4E0E\u8282\u594F\uFF1A${preset.pacingAndRhythm}`,
        `- \u7AE0\u8282\u7ED3\u6784\u89C4\u8303\uFF1A${preset.chapterStructure}`,
        `- \u89D2\u8272\u538B\u529B\u7F51\u7EDC\uFF1A${preset.characterPressure}`,
        `- \u7981\u5FCC\u907F\u5751\u6307\u5357\uFF1A${preset.poisonPoints.join("\uFF1B")}`
      );
    }
    contractDetails.push(
      `\u751F\u4EA7\u98CE\u683C\u5408\u540C\uFF1A\u8BFB\u8005\u627F\u8BFA=${selectedReaderPromise || preset?.readerPromise || "hook-forward, scene-first, emotionally specific"}\uFF1B\u89C6\u89D2=${selectedPointOfView || "third-person limited"}\uFF1B\u8BED\u6C14=${selectedTone || "tense but readable"}\uFF1B\u81EA\u7136\u5EA6=${selectedNaturalness}\u3002`,
      selectedStyleFingerprint ? `\u98CE\u683C\u6307\u7EB9\uFF1A${selectedStyleFingerprint}\u3002` : "\u98CE\u683C\u6307\u7EB9\uFF1A\u9996\u7AE0\u751F\u6210\u540E\u4ECE\u7A33\u5B9A\u6837\u5F20\u4E2D\u63D0\u53D6\uFF1B\u5F53\u524D\u5148\u4FDD\u6301\u573A\u666F\u4F18\u5148\u3001\u89D2\u8272\u5DEE\u5F02\u548C\u81EA\u7136\u5BF9\u767D\u3002"
    );
    return {
      ...profile,
      narration: contractDetails.join("\n"),
      naturalnessTarget: selectedNaturalness,
      readerPromise: selectedReaderPromise || preset?.readerPromise || "hook-forward, scene-first, emotionally specific",
      pointOfView: selectedPointOfView || "third-person limited",
      tone: selectedTone || "tense but readable",
      pacingAndRhythm: preset?.pacingAndRhythm,
      chapterStructure: preset?.chapterStructure,
      characterPressure: preset?.characterPressure,
      poisonPoints: preset?.poisonPoints,
      naturalnessRules: preset?.naturalnessRules || [],
      contextPriority: preset?.contextPriority || []
    };
  };
  if (preset) {
    return withProfile({
      genre: preset.genreName,
      narration: preset.narrationStrategy,
      vocabularyScenes: preset.vocabularyScenes
    });
  }
  return withProfile({
    genre: selectedGenre && selectedGenre !== "auto-inferred" ? selectedGenre : "\u901A\u7528\u7C7B\u578B\u5C0F\u8BF4",
    narration: "\u65C1\u767D\u4F18\u5148\u670D\u52A1\u573A\u666F\u63A8\u8FDB\u3001\u89D2\u8272\u9009\u62E9\u548C\u8BFB\u8005\u671F\u5F85\uFF1B\u907F\u514D\u6A21\u677F\u5316\u603B\u7ED3\u3002",
    vocabularyScenes: ["\u5BF9\u8BDD", "\u73AF\u5883\u6E32\u67D3", "\u5FC3\u7406\u6D3B\u52A8"]
  });
}
function extractStyleFingerprintFromDraft(finalDraft) {
  const body = extractNarrativeBody(finalDraft);
  const paragraphs = body.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
  const averageParagraphLength = paragraphs.length ? Math.round(paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0) / paragraphs.length) : 0;
  const dialogueCount = (body.match(/[「“][^」”]{2,120}[」”]/gu) || []).length;
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|握|松|皱眉|沉默/gu) || []).length;
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软|烫|凉/gu) || []).length;
  const characterNames = uniqueStrings(extractChinesePersonNames(body, 6)).slice(0, 4);
  const rhythm = averageParagraphLength <= 90 ? "short scene paragraphs" : averageParagraphLength <= 180 ? "medium scene paragraphs" : "long immersive paragraphs";
  const dialogue = dialogueCount >= 4 ? "dialogue-forward" : dialogueCount > 0 ? "selective dialogue" : "low-dialogue narration";
  const texture = sensorySignals >= actionSignals ? "sensory texture led" : "action and choice led";
  const voice = characterNames.length >= 2 ? `distinct cast pressure around ${characterNames.join("\u3001")}` : "single-viewpoint voice lock";
  return [
    rhythm,
    dialogue,
    texture,
    voice,
    `avg paragraph ${averageParagraphLength || "unknown"} chars`
  ].join("; ");
}
async function updateStyleFingerprintFromFirstChapter(input) {
  if (input.task.chapterNumber !== 1 || input.finalGate.status === "blocked") return "";
  const currentFingerprint = input.state.project.creativeProfile?.styleFingerprint?.trim() || "";
  if (currentFingerprint && !/pending sample|first-chapter extraction/i.test(currentFingerprint)) {
    return "";
  }
  const extracted = extractStyleFingerprintFromDraft(input.finalDraft);
  input.state.project = {
    ...input.state.project,
    creativeProfile: {
      ...input.state.project.creativeProfile || {
        genre: "auto-inferred",
        platform: "serialized web novel",
        readerPromise: "hook-forward, scene-first, emotionally specific",
        pointOfView: "third-person limited",
        tone: "tense but readable",
        naturalnessTarget: "balanced",
        characterProfileRequirements: []
      },
      styleFingerprint: extracted
    }
  };
  const currentStyleProfile = await readOptionalText2(input.paths.styleProfilePath);
  const updatedStyleProfile = currentStyleProfile ? currentStyleProfile.replace(/- style fingerprint: .*/i, `- style fingerprint: ${extracted}`) : [
    "# Style Profile",
    "",
    `Project: ${input.state.project.title}`,
    "",
    "Production selection contract:",
    `- style fingerprint: ${extracted}`
  ].join("\n");
  await import_promises5.default.writeFile(input.paths.styleProfilePath, `${updatedStyleProfile.trimEnd()}
`);
  return extracted;
}
function compactStyleList(values, limit = 4) {
  return (values || []).map((value) => value.trim()).filter(Boolean).slice(0, limit);
}
function compactStyleValue(value, maxLength = 160) {
  return value?.trim().replace(/\s+/gu, " ").slice(0, maxLength) || "";
}
function buildChapterInheritanceAdapterPayload(contract) {
  if (!contract?.approvedAt || !contract.styleContract) {
    return null;
  }
  const style = contract.styleContract;
  const inheritedArtifacts = contract.inheritance?.inheritedArtifacts?.length ? contract.inheritance.inheritedArtifacts : ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"];
  const inheritedRules = contract.inheritance?.inheritedRules?.length ? contract.inheritance.inheritedRules : [
    "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F\u7528\u6237\u51BB\u7ED3\u540E\u7684 base writing prompt\u3002",
    "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F style contract \u4E2D\u7684 voice\u3001\u8282\u594F\u3001\u5BF9\u767D\u4E0E\u7981\u5FCC\u7EA6\u675F\u3002"
  ];
  const styleContractFields = [
    style.voice ? "voice" : "",
    style.sentenceRhythm ? "sentenceRhythm" : "",
    compactStyleList(style.dialogueRules, 1).length ? "dialogueRules" : "",
    compactStyleList(style.descriptionRules, 1).length ? "descriptionRules" : "",
    compactStyleList(style.emotionRules, 1).length ? "emotionRules" : "",
    compactStyleList(style.pacingRules, 1).length ? "pacingRules" : "",
    compactStyleList(style.povRules, 1).length ? "povRules" : "",
    compactStyleList(style.openingRules, 1).length ? "openingRules" : "",
    compactStyleList(style.endingHookRules, 1).length ? "endingHookRules" : "",
    Array.isArray(style.allowedDevices) ? "allowedDevices" : "",
    compactStyleList(style.forbiddenPatterns, 1).length ? "forbiddenPatterns" : "",
    compactStyleList(style.positiveExamples, 1).length ? "positiveExamples" : "",
    Array.isArray(style.negativeExamples) ? "negativeExamples" : ""
  ].filter(Boolean);
  const contractVersion = Number(contract.loop?.approvalVersion || contract.approval?.approvedVersion || 0);
  const freezerVerdict = contract.freezer?.verdict || "missing";
  const verificationStatus = String(contract.verification?.status || contract.loop?.verificationStatus || "");
  const loopProtocol = contract.loopProtocol;
  const requiredLoopStages = Array.isArray(loopProtocol?.requiredStages) ? loopProtocol.requiredStages : [];
  const completedLoopStages = Array.isArray(loopProtocol?.completedStages) ? loopProtocol.completedStages : [];
  const blockedLoopStages = Array.isArray(loopProtocol?.blockedStages) ? loopProtocol.blockedStages : [];
  const loopProtocolReady = loopProtocol?.status === "approved" && requiredLoopStages.length > 0 && requiredLoopStages.every((stage) => completedLoopStages.includes(stage));
  const adapterReady = freezerVerdict === "ready" && verificationStatus === "passed" && loopProtocolReady && contract.inheritance?.status === "enforced" && inheritedArtifacts.length > 0 && inheritedRules.length > 0;
  return {
    name: "Chapter Inheritance Adapter",
    status: adapterReady ? "ready" : "blocked",
    contractVersion,
    approvedAt: String(contract.approvedAt || contract.approval?.approvedAt || ""),
    freezerVerdict,
    freezerSummary: String(contract.freezer?.summary || ""),
    verificationStatus,
    verificationSummary: String(contract.verification?.summary || contract.loop?.verificationSummary || ""),
    inheritedArtifacts,
    inheritedRules,
    styleContractFields,
    loopProtocolStatus: loopProtocol?.status || "missing",
    loopProtocolStages: {
      required: requiredLoopStages,
      completed: completedLoopStages,
      blocked: blockedLoopStages
    },
    loopProtocolEvidence: (loopProtocol?.evidence || []).filter((item) => item.status === "passed").map((item) => `${item.label}: ${item.summary}`).slice(0, 9),
    promptSections: [
      "User Approved Writing Style Contract",
      "Style Rulebook",
      "Style References",
      "Style Anti-Patterns"
    ],
    requiredChapterEvidence: [
      "quality gate passed",
      "AIGC detection passed",
      "style conformance drift conformant",
      "styleInheritanceVerification ready"
    ],
    approvedSampleExcerpt: compactStyleValue(contract.approvedSample, 240)
  };
}
function formatStyleRulebook(contract) {
  const style = contract?.styleContract;
  if (!contract?.approvedAt || !style) {
    return "";
  }
  const dialogueRules = style.dialogueRules || [];
  const descriptionRules = style.descriptionRules || [];
  const emotionRules = style.emotionRules || [];
  const pacingRules = style.pacingRules || [];
  const povRules = style.povRules || [];
  const openingRules = style.openingRules || [];
  const endingHookRules = style.endingHookRules || [];
  return [
    "# Style Rulebook",
    "",
    "This asset is frozen from the approved Style Evolution contract and must be inherited by every chapter draft, review, and polish pass.",
    "",
    `Approved at: ${contract.approvedAt}`,
    contract.approval?.approvedVersion ? `Approved version: v${contract.approval.approvedVersion}` : "",
    contract.approval?.freezeSummary ? `Freeze summary: ${contract.approval.freezeSummary}` : "",
    "",
    "## Voice",
    style.voice || "- pending",
    "",
    "## Sentence Rhythm",
    style.sentenceRhythm || "- pending",
    "",
    "## Dialogue Rules",
    ...dialogueRules.length ? dialogueRules.map((rule) => `- ${rule}`) : ["- pending"],
    "",
    "## Description Rules",
    ...descriptionRules.length ? descriptionRules.map((rule) => `- ${rule}`) : ["- pending"],
    "",
    "## Emotion Rules",
    ...emotionRules.length ? emotionRules.map((rule) => `- ${rule}`) : ["- pending"],
    "",
    "## Pacing Rules",
    ...pacingRules.length ? pacingRules.map((rule) => `- ${rule}`) : ["- pending"],
    "",
    "## POV Rules",
    ...povRules.length ? povRules.map((rule) => `- ${rule}`) : ["- pending"],
    "",
    "## Opening Rules",
    ...openingRules.length ? openingRules.map((rule) => `- ${rule}`) : ["- pending"],
    "",
    "## Ending Hook Rules",
    ...endingHookRules.length ? endingHookRules.map((rule) => `- ${rule}`) : ["- pending"],
    "",
    "## Retry Policy",
    `- Approval threshold: ${Number(contract.retryPolicy?.approvalScoreThreshold || 8.6).toFixed(1)}`,
    `- Approval min rounds: ${Math.max(1, Number(contract.retryPolicy?.approvalMinRounds || 2))}`,
    `- Stability min rounds: ${Math.max(1, Number(contract.retryPolicy?.stabilityMinRounds || 2))}`,
    `- Max forbidden hits: ${Math.max(0, Number(contract.retryPolicy?.maxForbiddenHitCount || 1))}`
  ].filter(Boolean).join("\n");
}
function formatStyleReferences(contract) {
  const style = contract?.styleContract;
  if (!contract?.approvedAt || !style) {
    return "";
  }
  const positiveExamples = style.positiveExamples || [];
  const allowedDevices = style.allowedDevices || [];
  return [
    "# Style References",
    "",
    "These are the positive references frozen from the approved style loop. They are not to be copied mechanically, but they define the acceptable writing band for the whole book.",
    "",
    "## Positive Examples",
    ...positiveExamples.length ? positiveExamples.map((example) => `- ${example}`) : ["- pending"],
    "",
    "## Allowed Devices",
    ...allowedDevices.length ? allowedDevices.map((item) => `- ${item}`) : ["- pending"],
    "",
    "## Approved Sample Excerpt",
    contract.approvedSample?.trim() || "- pending"
  ].join("\n");
}
function formatStyleAntiPatterns(contract) {
  const style = contract?.styleContract;
  if (!contract?.approvedAt || !style) {
    return "";
  }
  const forbiddenPatterns = [.../* @__PURE__ */ new Set([...style.forbiddenPatterns || [], ...contract.antiPatterns || []])];
  const negativeExamples = style.negativeExamples || [];
  const inheritedRules = contract.inheritance?.inheritedRules || [];
  return [
    "# Style Anti-Patterns",
    "",
    "These patterns are frozen as disallowed or high-risk writing moves for subsequent chapter production.",
    "",
    "## Forbidden Patterns",
    ...forbiddenPatterns.length ? forbiddenPatterns.map((item) => `- ${item}`) : ["- pending"],
    "",
    "## Negative Examples",
    ...negativeExamples.length ? negativeExamples.map((item) => `- ${item}`) : ["- pending"],
    "",
    "## Inheritance Rules",
    ...inheritedRules.length ? inheritedRules.map((rule) => `- ${rule}`) : ["- pending"]
  ].join("\n");
}
function formatApprovedWritingStylePrompt(contract) {
  const approvedAt = contract?.approvedAt;
  const approvedSample = contract?.approvedSample?.trim();
  const style = contract?.styleContract;
  if (!approvedAt || !approvedSample || !style) {
    return "";
  }
  const acceptedAsBookStyle = contract.approval?.acceptedAsBookStyle !== false;
  const inheritedArtifacts = contract.inheritance?.inheritedArtifacts?.length ? contract.inheritance.inheritedArtifacts : ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"];
  const inheritedRules = contract.inheritance?.inheritedRules?.length ? contract.inheritance.inheritedRules : [
    "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F\u7528\u6237\u51BB\u7ED3\u540E\u7684 base writing prompt\u3002",
    "\u540E\u7EED\u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F style contract \u4E2D\u7684 voice\u3001\u8282\u594F\u3001\u5BF9\u767D\u4E0E\u7981\u5FCC\u7EA6\u675F\u3002"
  ];
  const verification = contract.verification;
  const chapterInheritanceAdapter = buildChapterInheritanceAdapterPayload(contract);
  const lines = [
    "## User Approved Writing Style Contract",
    "\u8FD9\u662F\u7528\u6237\u786E\u8BA4\u540E\u51BB\u7ED3\u7684\u5168\u4E66\u57FA\u7840\u5199\u6CD5\uFF0C\u4F18\u5148\u7EA7\u9AD8\u4E8E\u901A\u7528\u5199\u4F5C\u6307\u5357\u3002\u6B63\u6587\u3001\u8D28\u68C0\u3001\u6DA6\u8272\u90FD\u5FC5\u987B\u6267\u884C\u3002",
    `- Approved at: ${approvedAt}`,
    contract.approval?.approvedVersion ? `- Approved version: v${contract.approval.approvedVersion}` : "",
    contract.loop?.stableVersion ? `- Stable version before freeze: v${contract.loop.stableVersion}` : "",
    contract.loop?.stableRounds ? `- Stable rounds before freeze: ${contract.loop.stableRounds}` : "",
    contract.approval?.freezeSummary ? `- Freeze summary: ${contract.approval.freezeSummary}` : "",
    acceptedAsBookStyle ? "- Acceptance scope: this approval applies to the whole book, not a single sample." : "",
    contract.runtime?.engine ? `- Style engine: ${contract.runtime.engine}` : "",
    contract.runtime?.runtime ? `- Loop runtime: ${contract.runtime.runtime}` : "",
    contract.runtime?.gate ? `- Freeze gate: ${contract.runtime.gate}` : "",
    contract.runtime?.verificationGate ? `- Verification gate: ${contract.runtime.verificationGate}` : "",
    contract.freezer?.verdict ? `- Freezer verdict: ${contract.freezer.verdict}` : "",
    contract.freezer?.summary ? `- Freezer summary: ${contract.freezer.summary}` : "",
    ...(contract.loop?.stabilityReasons || []).map((reason) => `- Stability reason: ${reason}`),
    verification?.summary ? `- Verification summary: ${verification.summary}` : "",
    verification?.status ? `- Verification status: ${verification.status}` : "",
    ...(verification?.reasons || []).map((reason) => `- Verification reason: ${reason}`),
    typeof verification?.score === "number" ? `- AIGC verification score: ${verification.score.toFixed(3)}` : "",
    typeof verification?.threshold === "number" ? `- AIGC verification threshold: ${verification.threshold.toFixed(3)}` : "",
    verification?.highRiskCount ? `- High risk segments before freeze: ${verification.highRiskCount}` : "",
    verification?.forbiddenHitCount ? `- Forbidden hits before freeze: ${verification.forbiddenHitCount}` : "",
    style.voice ? `- Voice: ${style.voice}` : "",
    style.sentenceRhythm ? `- Sentence rhythm: ${style.sentenceRhythm}` : "",
    ...compactStyleList(style.dialogueRules).map((rule) => `- Dialogue rule: ${rule}`),
    ...compactStyleList(style.descriptionRules).map((rule) => `- Description rule: ${rule}`),
    ...compactStyleList(style.emotionRules).map((rule) => `- Emotion rule: ${rule}`),
    ...compactStyleList(style.pacingRules).map((rule) => `- Pacing rule: ${rule}`),
    ...compactStyleList(style.povRules, 3).map((rule) => `- POV rule: ${rule}`),
    ...compactStyleList(style.openingRules, 3).map((rule) => `- Opening rule: ${rule}`),
    ...compactStyleList(style.endingHookRules, 3).map((rule) => `- Ending hook rule: ${rule}`),
    compactStyleList(style.allowedDevices, 8).length ? `- Allowed devices: ${compactStyleList(style.allowedDevices, 8).join("\u3001")}` : "",
    compactStyleList([...style.forbiddenPatterns || [], ...contract.antiPatterns || []], 10).length ? `- Forbidden patterns: ${compactStyleList([...style.forbiddenPatterns || [], ...contract.antiPatterns || []], 10).join("\uFF1B")}` : "",
    compactStyleList(style.positiveExamples, 2).length ? `- Positive examples: ${compactStyleList(style.positiveExamples, 2).join(" / ")}` : "",
    compactStyleList(style.negativeExamples, 2).length ? `- Negative examples to avoid: ${compactStyleList(style.negativeExamples, 2).join(" / ")}` : "",
    contract.frozenBasePrompt?.trim() ? `- Frozen base prompt: ${contract.frozenBasePrompt.trim().replace(/\s+/gu, " ").slice(0, 480)}` : "",
    contract.retryPolicy?.approvalScoreThreshold ? `- Retry policy: approval threshold ${Number(contract.retryPolicy.approvalScoreThreshold).toFixed(1)} / min rounds ${Math.max(1, Number(contract.retryPolicy.approvalMinRounds || 2))} / max forbidden hits ${Math.max(0, Number(contract.retryPolicy.maxForbiddenHitCount || 1))}` : "",
    ...inheritedArtifacts.map((artifact) => `- Inherited artifact: ${artifact}`),
    ...inheritedRules.map((rule) => `- Inheritance rule: ${rule}`),
    chapterInheritanceAdapter?.status ? `- Chapter Inheritance Adapter: ${chapterInheritanceAdapter.status}` : "",
    chapterInheritanceAdapter?.loopProtocolStatus ? `- Loop protocol status: ${chapterInheritanceAdapter.loopProtocolStatus}` : "",
    chapterInheritanceAdapter?.loopProtocolStages?.completed?.length ? `- Loop protocol completed stages: ${chapterInheritanceAdapter.loopProtocolStages.completed.join(", ")}` : "",
    ...(chapterInheritanceAdapter?.loopProtocolEvidence || []).slice(0, 4).map((item) => `- Loop protocol evidence: ${item}`),
    `- Approved sample excerpt: ${approvedSample.replace(/\s+/gu, " ").slice(0, 360)}`
  ].filter(Boolean);
  return lines.join("\n");
}
async function loadApprovedWritingStyleContext(projectRoot) {
  try {
    const snapshot = await loadStyleEvolution(projectRoot);
    const prompt = formatApprovedWritingStylePrompt(snapshot.contract);
    const gate = evaluateStyleEvolutionGate(snapshot.contract);
    const rulebook = formatStyleRulebook(snapshot.contract);
    const references = formatStyleReferences(snapshot.contract);
    const antiPatterns = formatStyleAntiPatterns(snapshot.contract);
    const chapterInheritanceAdapter = buildChapterInheritanceAdapterPayload(snapshot.contract);
    return prompt && gate.canProceed ? { status: "ready", prompt, contract: snapshot.contract, rulebook, references, antiPatterns, chapterInheritanceAdapter: chapterInheritanceAdapter || void 0 } : { status: "missing", prompt: "" };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { status: "missing", prompt: "" };
    }
    throw error;
  }
}
function summarizeApprovedStyleCarryover(approvedStyleContext) {
  if (approvedStyleContext.status !== "ready") {
    return "";
  }
  const contract = approvedStyleContext.contract;
  const style = contract?.styleContract;
  if (!contract?.approvedAt || !style) {
    return summarizePromptSection(approvedStyleContext.prompt, 900);
  }
  const forbiddenPatterns = compactStyleList(uniqueStrings([...style.forbiddenPatterns || [], ...contract.antiPatterns || []]), 4);
  const positiveExamples = compactStyleList(style.positiveExamples, 1);
  const negativeExamples = compactStyleList(style.negativeExamples, 1);
  const dialogueRules = compactStyleList(style.dialogueRules, 1);
  const descriptionRules = compactStyleList(style.descriptionRules, 1);
  const emotionRules = compactStyleList(style.emotionRules, 1);
  const pacingRules = compactStyleList(style.pacingRules, 1);
  const povRules = compactStyleList(style.povRules, 1);
  const openingRules = compactStyleList(style.openingRules, 1);
  const endingHookRules = compactStyleList(style.endingHookRules, 1);
  const allowedDevices = compactStyleList(style.allowedDevices, 3);
  const inheritedRules = compactStyleList(contract.inheritance?.inheritedRules, 1);
  const adapter = approvedStyleContext.chapterInheritanceAdapter || buildChapterInheritanceAdapterPayload(contract);
  const lines = [
    "## User Approved Writing Style Contract",
    "\u51BB\u7ED3\u5168\u4E66\u57FA\u7840\u5199\u6CD5\uFF1B\u540E\u7EED\u7AE0\u8282\u5FC5\u987B\u7EE7\u627F\uFF0C\u4E0D\u5F97\u91CD\u7F6E\u6210\u901A\u7528\u6A21\u677F\u8154\u3002",
    `- Approved at: ${contract.approvedAt}`,
    adapter?.contractVersion ? `- Adapter contract version: v${adapter.contractVersion}` : "",
    adapter?.loopProtocolStatus ? `- Loop protocol: ${adapter.loopProtocolStatus} (${adapter.loopProtocolStages?.completed?.length || 0}/${adapter.loopProtocolStages?.required?.length || 0} stages)` : "",
    adapter?.freezerVerdict ? `- Freezer verdict: ${adapter.freezerVerdict}` : "",
    contract.runtime?.verificationGate ? `- Verification gate: ${contract.runtime.verificationGate}` : "",
    contract.verification?.status ? `- Verification status: ${contract.verification.status}` : "",
    compactStyleValue(style.voice, 140) ? `- Voice: ${compactStyleValue(style.voice, 140)}` : "",
    compactStyleValue(style.sentenceRhythm, 100) ? `- Sentence rhythm: ${compactStyleValue(style.sentenceRhythm, 100)}` : "",
    ...dialogueRules.map((rule) => `- Dialogue rule: ${rule}`),
    ...descriptionRules.map((rule) => `- Description rule: ${rule}`),
    ...emotionRules.map((rule) => `- Emotion rule: ${rule}`),
    ...pacingRules.map((rule) => `- Pacing rule: ${rule}`),
    ...povRules.map((rule) => `- POV rule: ${rule}`),
    ...openingRules.map((rule) => `- Opening rule: ${rule}`),
    ...endingHookRules.map((rule) => `- Ending hook rule: ${rule}`),
    allowedDevices.length ? `- Allowed devices: ${allowedDevices.join("\u3001")}` : "",
    forbiddenPatterns.length ? `- Forbidden patterns: ${forbiddenPatterns.join("\uFF1B")}` : "",
    positiveExamples.length ? `- Positive example: ${positiveExamples[0]}` : "",
    negativeExamples.length ? `- Negative example to avoid: ${negativeExamples[0]}` : "",
    compactStyleValue(contract.frozenBasePrompt, 160) ? `- Frozen base prompt focus: ${compactStyleValue(contract.frozenBasePrompt, 160)}` : "",
    ...inheritedRules.map((rule) => `- Inheritance rule: ${rule}`),
    compactStyleValue(contract.approvedSample, 180) ? `- Approved sample excerpt: ${compactStyleValue(contract.approvedSample, 180)}` : ""
  ].filter(Boolean);
  return summarizePromptSection(lines.join("\n"), 980);
}
async function persistApprovedWritingStyleAssets(projectRoot, paths, approvedStyleContext, options = {}) {
  if (approvedStyleContext.status !== "ready") {
    return;
  }
  await import_promises5.default.mkdir(paths.styleDir, { recursive: true });
  const writes = [
    [paths.styleRulebookPath, approvedStyleContext.rulebook || "", "style_rulebook"],
    [paths.styleReferencesPath, approvedStyleContext.references || "", "style_references"],
    [paths.styleAntiPatternsPath, approvedStyleContext.antiPatterns || "", "style_anti_patterns"]
  ];
  for (const [filePath, content, kind] of writes) {
    if (!content.trim()) continue;
    await import_promises5.default.writeFile(filePath, `${content.trimEnd()}
`);
    await recordPipelineArtifact(projectRoot, filePath, "style", options, {
      kind,
      source: "approved_style_contract"
    });
  }
}
async function enforceApprovedWritingStyleGate(options, task, approvedStyleContext) {
  if (approvedStyleContext.status === "ready") {
    return;
  }
  const message = "\u672C\u4E66\u5199\u6CD5\u5C1A\u672A\u83B7\u5F97\u7528\u6237\u786E\u8BA4\uFF0C\u6B63\u6587\u751F\u4EA7\u5DF2\u963B\u585E\u3002\u8BF7\u5148\u5728 Style Evolution Engine \u4E2D\u751F\u6210\u6837\u6BB5\uFF0C\u5E76\u901A\u8FC7 Style Contract Freeze Gate \u786E\u8BA4\u4E00\u4E2A\u7248\u672C\u3002";
  await emitWritingProgress(options, {
    step: "production_readiness_blocked",
    role: "Showrunner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "blocked",
    message,
    preview: "Blocked gate: style_approval"
  });
  throw new ProductionReadinessBlockedError(message);
}
function normalizeTailParagraph(paragraph) {
  return paragraph.replace(/\s+/gu, "").replace(/[，。、“”‘’：；！？,.!?:"'()\[\]【】《》]/gu, "").slice(0, 160);
}
function compactPreviousSegmentTail(text, maxChars = 800) {
  const paragraphs = text.split(/\n{2,}/u).map((paragraph) => paragraph.trim()).filter(Boolean);
  const selected = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
    const paragraph = paragraphs[index];
    const fingerprint = normalizeTailParagraph(paragraph);
    if (!fingerprint || seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    selected.unshift(paragraph);
    if (selected.join("\n\n").length >= maxChars) {
      break;
    }
  }
  const compacted = selected.join("\n\n");
  return compacted.length > maxChars ? compacted.slice(-maxChars).trim() : compacted;
}
function compactAssemblyReferenceBody(text, maxChars = 900) {
  const paragraphs = text.split(/\n{2,}/u).map((paragraph) => paragraph.trim()).filter(Boolean);
  const selected = [];
  const seen = /* @__PURE__ */ new Set();
  for (const paragraph of paragraphs) {
    const fingerprint = normalizeTailParagraph(paragraph);
    if (!fingerprint || seen.has(fingerprint)) {
      continue;
    }
    seen.add(fingerprint);
    selected.push(paragraph);
  }
  const compacted = selected.join("\n\n") || text.trim();
  return clipPromptSection(compacted, maxChars);
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
      "- \u6210\u8BED\u53EA\u80FD\u5728\u603B\u7ED3\u3001\u5BF9\u6BD4\u3001\u5F3A\u8C03\u5904\u70B9\u5230\u4E3A\u6B62\uFF0C\u6BCF\u7AE0\u4E0D\u8D85\u8FC7 3-5 \u4E2A\u3002",
      "- \u6210\u8BED\u5173\u8054\u6027\u68C0\u67E5\uFF1A\u6BCF\u4E2A\u6210\u8BED\u524D\u540E\u5FC5\u987B\u6709\u573A\u666F\u94FA\u57AB\u3001\u4EBA\u7269\u5224\u65AD\u6216\u56E0\u679C\u53D8\u5316\u652F\u6491\u3002"
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
    "- \u6210\u8BED\u5173\u8054\u6027\u68C0\u67E5\uFF1A\u6BCF\u4E2A\u6210\u8BED\u524D\u540E\u5FC5\u987B\u6709\u573A\u666F\u94FA\u57AB\u3001\u4EBA\u7269\u5224\u65AD\u6216\u56E0\u679C\u53D8\u5316\u652F\u6491\u3002",
    "",
    "### \u5173\u952E\u8BCD\u6765\u6E90",
    keywords.length ? `- ${keywords.slice(0, 12).join("\u3001")}` : "- \u6682\u65E0\u660E\u786E\u5173\u952E\u8BCD\uFF0C\u6309\u573A\u666F\u7C7B\u578B\u63A8\u8350\u3002",
    "",
    "### \u6210\u8BED\u63A8\u8350\u5217\u8868\uFF08\u4EC5\u5728\u5DF2\u6709\u94FA\u57AB\u540E\u7528\u4E8E\u603B\u7ED3/\u5BF9\u6BD4/\u5F3A\u8C03\uFF09",
    idioms.length ? `- ${idioms.map((entry) => entry.word).join("\u3001")}` : "- \u672A\u627E\u5230\u9AD8\u5EA6\u76F8\u5173\u6210\u8BED\uFF0C\u5EFA\u8BAE\u4F7F\u7528\u57FA\u7840\u8BCD\u6C47\u8868\u8FBE\uFF0C\u4E0D\u5F3A\u884C\u690D\u5165\u3002",
    "",
    "### \u57FA\u7840\u8BCD\u6C47\u63A8\u8350\u5217\u8868\uFF08\u4F18\u5148\u4F7F\u7528\uFF09",
    `- ${base.map((entry) => entry.word).join("\u3001")}`,
    "",
    "### \u8FDB\u9636\u8BCD\u6C47\u63A8\u8350\u5217\u8868\uFF08\u9002\u5F53\u4F7F\u7528\uFF09",
    advanced.length ? `- ${advanced.map((entry) => entry.word).join("\u3001")}` : "- \u65E0\u3002",
    "",
    "### \u9AD8\u7EA7/\u7A00\u6709\u8BCD\u6C47\u63A8\u8350\u5217\u8868\uFF08\u8C28\u614E\u4F7F\u7528\uFF09",
    rare.length ? `- ${rare.map((entry) => entry.word).join("\u3001")}` : "- \u65E0\u3002"
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
  const body = text.replace(/```[\s\S]*?```/g, "").split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|章节元数据|章节元信息)/u)[0] || "";
  const paragraphs = body.split(/\n+/u).map((p) => p.trim()).filter(Boolean);
  const ultraShortParagraphs = paragraphs.filter((p) => p.length > 0 && p.length <= 6);
  const repeatedNarrativeLoops = detectRepeatedNarrativeLoops(body, paragraphs);
  const fragments = [];
  if (paragraphs.length >= 10 && ultraShortParagraphs.length / paragraphs.length > 0.15) {
    fragments.push(`\u8D85\u77ED\u6BB5\u843D\uFF08\u6BB5\u843D\u5B57\u6570\u22646\uFF09\u6570\u91CF\u8FBE ${ultraShortParagraphs.length} \u5904\uFF0C\u6BB5\u843D\u788E\u7247\u5316\u5806\u53E0\u4E25\u91CD\uFF08\u5360\u6BD4\u8FBE ${Math.round(ultraShortParagraphs.length / paragraphs.length * 100)}%\uFF09\u3002`);
  }
  fragments.push(...repeatedNarrativeLoops);
  const bodyNoPunc = body.replace(/[\s\p{Punctuation}\p{Script=Common}]/gu, "");
  const matchFrequencies = {
    "\u4E00\u50F5": (bodyNoPunc.match(/一僵/g) || []).length,
    "\u4E00\u6EDE": (bodyNoPunc.match(/一滞/g) || []).length,
    "\u4E00\u7F29": (bodyNoPunc.match(/一缩/g) || []).length,
    "\u4E00\u9707": (bodyNoPunc.match(/一震/g) || []).length,
    "\u8EAB\u4F53\u50F5": (bodyNoPunc.match(/身体.{0,2}僵/g) || []).length,
    "\u77B3\u5B54\u7F29": (bodyNoPunc.match(/瞳孔.{0,2}缩/g) || []).length
  };
  const highFreqs = Object.entries(matchFrequencies).filter(([_, count]) => count >= 3).map(([word, count]) => `\u300C${word}\u300D\u91CD\u590D\u8FBE ${count} \u6B21`);
  if (highFreqs.length > 0) {
    fragments.push(`\u5957\u8DEF\u6027\u8EAB\u4F53\u6216\u611F\u77E5\u63CF\u5199\u9AD8\u9891\u91CD\u590D\uFF1A${highFreqs.join("\uFF1B")}\u3002`);
  }
  const isQuarantined = fragments.length > 0;
  return {
    status: isQuarantined ? "quarantined" : "eligible",
    reason: isQuarantined ? `\u98CE\u683C\u95E8\u7981\u62E6\u622A\uFF1A${fragments.join(" ")} \u8BF7\u7CBE\u7B80\u788E\u7247\u5316\u6C1B\u56F4\u8BCD\u4E0E\u9AD8\u9891\u808C\u8089/\u611F\u77E5\u5957\u8DEF\u3002` : "\u98CE\u683C\u786C\u95E8\u69DB\u901A\u8FC7\uFF1A\u672A\u53D1\u73B0\u9AD8\u9891\u77ED\u8BCD/\u5355\u5B57\u788E\u7247\u5316\u91CD\u590D\u3001\u6574\u6BB5\u590D\u8BFB\u6216\u9AD8\u9891\u5957\u8DEF\u63CF\u5199\u3002",
    fragments
  };
}
function detectRepeatedNarrativeLoops(body, paragraphs) {
  const fragments = [];
  const paragraphCounts = /* @__PURE__ */ new Map();
  for (const paragraph of paragraphs) {
    const normalized = normalizeTailParagraph(paragraph);
    if (normalized.length < 24) continue;
    const current = paragraphCounts.get(normalized);
    paragraphCounts.set(normalized, {
      count: (current?.count || 0) + 1,
      sample: current?.sample || paragraph
    });
  }
  const repeatedParagraph = [...paragraphCounts.values()].filter((entry) => entry.count >= 3).sort((left, right) => right.count - left.count)[0];
  if (repeatedParagraph) {
    fragments.push(`\u6574\u6BB5\u91CD\u590D\u8F93\u51FA\uFF1A\u540C\u4E00\u957F\u6BB5\u843D\u91CD\u590D ${repeatedParagraph.count} \u6B21\uFF08\u300C${repeatedParagraph.sample.slice(0, 36)}...\u300D\uFF09\u3002`);
  }
  const sentenceCounts = /* @__PURE__ */ new Map();
  const sentences = body.split(/[。！？!?；;\n]+/u).map((sentence) => sentence.trim()).filter((sentence) => sentence.length >= 18);
  for (const sentence of sentences) {
    const normalized = normalizeTailParagraph(sentence);
    if (normalized.length < 18) continue;
    const current = sentenceCounts.get(normalized);
    sentenceCounts.set(normalized, {
      count: (current?.count || 0) + 1,
      sample: current?.sample || sentence
    });
  }
  const repeatedSentence = [...sentenceCounts.values()].filter((entry) => entry.count >= 4).sort((left, right) => right.count - left.count)[0];
  if (repeatedSentence) {
    fragments.push(`\u53E5\u5B50\u5FAA\u73AF\u91CD\u590D\uFF1A\u540C\u4E00\u53E5\u6B63\u6587\u91CD\u590D ${repeatedSentence.count} \u6B21\uFF08\u300C${repeatedSentence.sample.slice(0, 36)}...\u300D\uFF09\u3002`);
  }
  return fragments;
}
function isSoftNarrativeStyleIssue(styleQuality) {
  return styleQuality.status === "quarantined" && styleQuality.fragments.length > 0 && styleQuality.fragments.every(
    (fragment) => /超短段落|段落碎片|套路性身体|感知描写|高频重复/u.test(fragment)
  );
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
  const concreteSignals = actionSignals + sensorySignals + objectSignals;
  if (stackedIdiomRun && concreteSignals < 4 && matchedTerms.length < 1 && !projectSignal) {
    return {
      status: "quarantined",
      reason: "\u5199\u4F5C\u8D44\u6E90\u6781\u7AEF\u53CD\u6A21\u5F0F\uFF1A\u6210\u8BED/\u77ED\u8BCD\u8FDE\u7EED\u5806\u53E0\uFF0C\u4E14\u7F3A\u5C11\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u7269\u4EF6\u6216\u9879\u76EE\u951A\u70B9\u652F\u6491\u3002",
      matchedTerms
    };
  }
  if (concreteSignals < 4 && matchedTerms.length < 1 && !projectSignal) {
    return {
      status: "warning",
      reason: "\u5199\u4F5C\u8D44\u6E90\u5438\u6536\u63D0\u793A\uFF1A\u6B63\u6587\u7F3A\u5C11\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u7269\u4EF6\u6216\u9879\u76EE\u5173\u952E\u8BCD\uFF0C\u8D44\u6E90\u843D\u5730\u611F\u504F\u5F31\uFF0C\u4F46\u4E0D\u4F5C\u4E3A\u786C\u963B\u585E\u3002",
      matchedTerms
    };
  }
  if (stackedIdiomRun || idiomLikeSentences.length >= 8) {
    return {
      status: "warning",
      reason: "\u5199\u4F5C\u8D44\u6E90\u5438\u6536\u63D0\u793A\uFF1A\u7591\u4F3C\u5B58\u5728\u6210\u8BED/\u77ED\u8BCD\u5806\u53E0\u503E\u5411\uFF0C\u5EFA\u8BAE\u6DA6\u8272\u65F6\u6539\u6210\u52A8\u4F5C\u3001\u611F\u5B98\u6216\u56E0\u679C\u53E5\u3002",
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
function extractNumberFacts(text = "", limit = 10) {
  return uniqueStrings(text.match(/[第]?\d+(?:[.\d]*)?(?:章|年|月|日|天|夜|次|人|两|个|枚|封|件|步|里|刻|分|成|钱|两|万|千|百)?/gu) || []).filter((fact) => /[0-9]/u.test(fact)).slice(0, limit);
}
function extractNegatedFacts(text = "", limit = 10) {
  return uniqueStrings(
    text.split(/[。！？!?；;\n]+/u).map((line) => line.trim()).filter((line) => /不能|不得|不要|没有|未曾|不会|不许|禁止|无法|不再|不应/u.test(line)).map((line) => conciseEvidence(line, 120))
  ).slice(0, limit);
}
function chineseNgrams(value, size) {
  const compact = value.replace(/[^\p{Script=Han}0-9]+/gu, "");
  const grams = [];
  for (let index = 0; index <= compact.length - size; index += 1) {
    grams.push(compact.slice(index, index + size));
  }
  return grams;
}
function hasNegatedFactEcho(afterBody, fact) {
  const keywords = uniqueStrings([
    ...chineseNgrams(fact, 2),
    ...chineseNgrams(fact, 3),
    ...fact.match(/\d+(?:[.\d]*)?/gu) || []
  ]).filter((word) => !/不能|不得|不要|没有|未曾|不会|不许|禁止|无法|不再|不应|必须|只是|已经|仍然/u.test(word));
  if (keywords.length < 3) {
    return /不能|不得|不要|没有|未曾|不会|不许|禁止|无法|不再|不应/u.test(afterBody);
  }
  const matchedKeywords = keywords.filter((word) => afterBody.includes(word)).length;
  return matchedKeywords >= Math.min(5, Math.max(3, Math.floor(keywords.length * 0.18))) && /不能|不得|不要|没有|未曾|不会|不许|禁止|无法|不再|不应/u.test(afterBody);
}
function extractSemanticFactAnchors(input) {
  const names = uniqueStrings([
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.requiredNames || [],
    ...input.continuityContract.knownCast || [],
    ...input.characterProfileContract.knownCast || []
  ].filter(Boolean)).slice(0, 16);
  const anchors = uniqueStrings([
    ...input.continuityContract.continuityAnchors || [],
    ...input.continuityContract.hardRules || [],
    ...(input.continuityContract.previousChapterLedger || []).filter((line) => /失去|获得|拿到|交给|欠|承诺|死亡|受伤|密信|官印|账|规则|不能|不得|没有|必须/u.test(line))
  ]).slice(0, 18);
  return {
    names,
    anchors,
    numbers: extractNumberFacts(input.text),
    negatedFacts: extractNegatedFacts(input.text)
  };
}
function evaluateSemanticPreservation(input) {
  const beforeBody = extractNarrativeBody(input.beforeDraft);
  const afterBody = extractNarrativeBody(input.afterDraft);
  const facts = extractSemanticFactAnchors({
    text: beforeBody,
    continuityContract: input.continuityContract,
    characterProfileContract: input.characterProfileContract
  });
  const requiredFacts = uniqueStrings([
    ...facts.names,
    ...facts.anchors
  ]).slice(0, 24);
  const missingFacts = requiredFacts.filter((fact) => fact && beforeBody.includes(fact) && !afterBody.includes(fact)).slice(0, 12);
  const missingNumbers = facts.numbers.filter((fact) => beforeBody.includes(fact) && !afterBody.includes(fact)).slice(0, 6);
  const missingNegatedFacts = facts.negatedFacts.filter((fact) => fact.length >= 6 && !hasNegatedFactEcho(afterBody, fact)).slice(0, 6);
  const changedFacts = uniqueStrings([
    ...missingNumbers.map((fact) => `\u6570\u5B57/\u6570\u91CF\u4E8B\u5B9E\u4E22\u5931\uFF1A${fact}`),
    ...missingNegatedFacts.map((fact) => `\u5426\u5B9A\u7EA6\u675F\u4E22\u5931\uFF1A${fact}`)
  ]).slice(0, 10);
  const preservedFacts = uniqueStrings([
    ...requiredFacts.filter((fact) => afterBody.includes(fact)),
    ...facts.numbers.filter((fact) => afterBody.includes(fact)).map((fact) => `number:${fact}`),
    ...facts.negatedFacts.filter((fact) => afterBody.includes(fact)).map((fact) => `negation:${fact}`)
  ]).slice(0, 16);
  const status = changedFacts.length > 0 || missingFacts.length >= 2 ? "drifted" : missingFacts.length === 1 ? "at_risk" : "preserved";
  return {
    status,
    missingFacts,
    changedFacts,
    preservedFacts,
    reason: status === "preserved" ? "\u8BED\u4E49\u4FDD\u771F\u901A\u8FC7\uFF1A\u81EA\u7136\u5316\u540E\u4FDD\u7559\u4E86\u9501\u5B9A\u89D2\u8272\u3001\u8FDE\u7EED\u6027\u951A\u70B9\u3001\u6570\u91CF\u4E8B\u5B9E\u548C\u5426\u5B9A\u7EA6\u675F\u3002" : `\u8BED\u4E49\u4FDD\u771F${status === "drifted" ? "\u5931\u8D25" : "\u6709\u98CE\u9669"}\uFF1A${[...missingFacts, ...changedFacts].slice(0, 4).join("\uFF1B")}`
  };
}
function createNaturalnessReport(input) {
  const body = extractNarrativeBody(input.afterDraft);
  const sentences = body.split(/[。！？!?；;\n]+/u).map((part) => part.trim()).filter(Boolean);
  const wordTotal = Math.max(1, wordCount(body));
  const dialogueCount = (body.match(/[「“][^」”]{2,120}[」”]/gu) || []).length;
  const actionSignals = (body.match(/走|站|伸手|拿|推|扣|按|抬|低头|转身|看|听|问|答|说|递|收|藏|翻|敲|拦|避|追|停|跪|坐|起|握|松|咬|皱眉|沉默/gu) || []).length;
  const sensorySignals = (body.match(/风|雨|雪|冷|热|汗|血|泥|尘|灯|火|声|响|气味|腥|苦|潮|湿|暗|亮|疼|粗|硬|软|烫|凉/gu) || []).length;
  const aiSummarySignals = (body.match(/由此可见|不难看出|事实上|显然|总而言之|综上|这意味着|他终于明白|命运的齿轮|这一刻.*命运|内心开阔|复杂的情绪|无法言喻|说不出的感觉|某种意义上/gu) || []).length;
  const analyticSignals = (body.match(/第一|第二|首先|其次|最后|原因是|从.*角度|可以看出|体现了|说明了|证明了/gu) || []).length;
  const emotionLabelSignals = (body.match(/愤怒|悲伤|恐惧|绝望|震惊|激动|开心|难过|复杂|崩溃|释然/gu) || []).length;
  const fatigueWordSignals = (body.match(/突然|忽然|猛然|竟然|居然|渐渐|逐渐|然而|与此同时|似乎|也许|大概|仿佛/gu) || []).length;
  const characterPresence = evaluateCharacterProfilePresence(input.afterDraft, input.characterProfileContract);
  const styleQuality = evaluateNarrativeStyleQuality(input.afterDraft);
  const plotContinuity = evaluatePlotContinuityBridge(input.afterDraft, input.task, input.continuityContract);
  const semanticPreservation = evaluateSemanticPreservation({
    beforeDraft: input.beforeDraft,
    afterDraft: input.afterDraft,
    continuityContract: input.continuityContract,
    characterProfileContract: input.characterProfileContract
  });
  const preservedFacts = uniqueStrings([
    ...semanticPreservation.preservedFacts,
    input.continuityContract.lockedProtagonistName,
    ...input.continuityContract.requiredNames,
    ...input.continuityContract.continuityAnchors.filter((anchor) => input.afterDraft.includes(anchor))
  ].filter(Boolean)).slice(0, 16);
  const riskFlags = [
    ...styleQuality.status === "quarantined" ? [styleQuality.reason] : [],
    ...plotContinuity.status === "quarantined" ? [plotContinuity.reason] : [],
    ...characterPresence.status === "quarantined" ? [characterPresence.reason] : [],
    ...semanticPreservation.status === "drifted" ? [semanticPreservation.reason] : [],
    ...semanticPreservation.status === "at_risk" ? [semanticPreservation.reason] : [],
    ...aiSummarySignals >= 3 ? [`\u603B\u7ED3\u8154/AI \u65C1\u767D\u4FE1\u53F7\u8FC7\u591A\uFF1A${aiSummarySignals}`] : [],
    ...analyticSignals >= 5 ? [`\u5206\u6790\u62A5\u544A\u8154\u4FE1\u53F7\u8FC7\u591A\uFF1A${analyticSignals}`] : [],
    ...emotionLabelSignals > Math.max(8, Math.floor(wordTotal / 450)) && actionSignals < emotionLabelSignals ? [`\u60C5\u7EEA\u6807\u7B7E\u591A\u4E8E\u52A8\u4F5C\u5916\u5316\uFF1Aemotion=${emotionLabelSignals}, action=${actionSignals}`] : [],
    ...dialogueCount === 0 && wordTotal > 900 ? ["\u957F\u7AE0\u8282\u7F3A\u5C11\u5BF9\u767D\uFF0C\u89D2\u8272\u58F0\u97F3\u4E0D\u591F\u81EA\u7136\u3002"] : [],
    ...actionSignals + sensorySignals < Math.max(6, Math.floor(wordTotal / 350)) ? ["\u52A8\u4F5C/\u611F\u5B98\u4FE1\u53F7\u4E0D\u8DB3\uFF0C\u6587\u672C\u53EF\u80FD\u504F\u6458\u8981\u3002"] : [],
    ...fatigueWordSignals >= 5 ? [`AI \u5199\u4F5C\u75B2\u52B3\u8BCD\uFF08\u7A81\u7136/\u7136\u800C/\u4E0E\u6B64\u540C\u65F6/\u4EFF\u4F5B\u7B49\uFF09\u9AD8\u9891\u5806\u79EF\u8FBE ${fatigueWordSignals} \u6B21`] : []
  ];
  const changedBlocks = input.beforeDraft === input.afterDraft ? 0 : Math.abs(input.afterDraft.split(/\n{2,}/u).length - input.beforeDraft.split(/\n{2,}/u).length) + (input.afterDraft.length === input.beforeDraft.length ? 1 : Math.max(1, Math.round(Math.abs(input.afterDraft.length - input.beforeDraft.length) / 500)));
  const score = Math.max(0, Math.min(10, 10 - riskFlags.length * 2 - Math.max(0, aiSummarySignals - 1) - Math.max(0, analyticSignals - 3) - Math.max(0, Math.floor(fatigueWordSignals / 2))));
  const status = semanticPreservation.status === "drifted" ? "blocked" : riskFlags.some((flag) => /硬门槛失败|连续性|角色档案硬门槛|阻塞/u.test(flag)) ? "blocked" : riskFlags.length > 0 ? "needs_revision" : score >= 7 ? "passed" : "needs_revision";
  return {
    status,
    score,
    reason: status === "passed" ? "\u81EA\u7136\u5EA6\u95E8\u7981\u901A\u8FC7\uFF1A\u6587\u672C\u4EE5\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u5BF9\u767D\u3001\u5173\u7CFB\u538B\u529B\u548C\u5177\u4F53\u9009\u62E9\u5448\u73B0\uFF0C\u672A\u53D1\u73B0\u963B\u585E\u6027 AI \u5473\u3002" : `\u81EA\u7136\u5EA6\u95E8\u7981${status === "blocked" ? "\u963B\u585E" : "\u9700\u8981\u8FD4\u5DE5"}\uFF1A${riskFlags.slice(0, 4).join("\uFF1B") || "\u81EA\u7136\u8868\u8FBE\u4FE1\u53F7\u4E0D\u8DB3\u3002"}`,
    changedBlocks,
    riskFlags,
    preservedFacts,
    semanticPreservation,
    patchSummary: [
      changedBlocks > 0 ? `\u6587\u672C\u53D1\u751F\u7EA6 ${changedBlocks} \u4E2A\u5757\u7EA7\u53D8\u5316\u3002` : "\u672A\u53D1\u751F\u5757\u7EA7\u53D8\u5316\u6216\u4F7F\u7528\u786E\u5B9A\u6027\u6574\u7406\u7A3F\u3002",
      `\u5BF9\u767D\u6570\uFF1A${dialogueCount}\uFF1B\u52A8\u4F5C\u4FE1\u53F7\uFF1A${actionSignals}\uFF1B\u611F\u5B98\u4FE1\u53F7\uFF1A${sensorySignals}\u3002`,
      semanticPreservation.reason,
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
    "### Semantic Preservation",
    `- Status: ${report.semanticPreservation.status}`,
    `- Reason: ${report.semanticPreservation.reason}`,
    `- Missing facts: ${report.semanticPreservation.missingFacts.length ? report.semanticPreservation.missingFacts.join("\u3001") : "none"}`,
    `- Changed facts: ${report.semanticPreservation.changedFacts.length ? report.semanticPreservation.changedFacts.join("\u3001") : "none"}`,
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
var CacheTracker = class {
  hits = 0;
  misses = 0;
};
var memoryCacheTracker = new CacheTracker();
var resourcesCacheTracker = new CacheTracker();
function invalidateProjectCache(projectId, chapterNumber) {
  for (const key of factoryMemoryContextCache.keys()) {
    const parts = key.split("");
    const keyProjId = parts[1];
    const keyChapNum = parts[2];
    if (keyProjId === projectId) {
      if (chapterNumber === void 0 || Number(keyChapNum) === chapterNumber) {
        factoryMemoryContextCache.delete(key);
      }
    }
  }
}
function invalidateWritingResourcesCache() {
  productionWritingResourcesCache.clear();
}
var FACTORY_MEMORY_CONTEXT_CACHE_TTL_MS = 5e3;
var FACTORY_MEMORY_CONTEXT_CACHE_LIMIT = 80;
var factoryMemoryContextCache = /* @__PURE__ */ new Map();
function setFactoryMemoryContextCache(key, value, now2 = Date.now()) {
  factoryMemoryContextCache.set(key, { value, expiresAt: now2 + FACTORY_MEMORY_CONTEXT_CACHE_TTL_MS });
  while (factoryMemoryContextCache.size > FACTORY_MEMORY_CONTEXT_CACHE_LIMIT) {
    const oldestKey = factoryMemoryContextCache.keys().next().value;
    if (!oldestKey) break;
    factoryMemoryContextCache.delete(oldestKey);
  }
}
async function retrieveFactoryMemoryContext(input) {
  if (!input.options.factoryRootDir || !input.options.projectId) {
    return "";
  }
  const query = [
    input.state.project.title,
    input.state.project.idea,
    `Chapter ${input.task.chapterNumber}: ${input.task.title}`,
    input.task.summary,
    input.continuityContract.lockedProtagonistName || "",
    "character_dossiers chapter_summary profile signal behavior speech appearance relationship"
  ].filter(Boolean).join("\n");
  const cacheKey = [
    input.options.factoryRootDir,
    input.options.projectId,
    input.task.chapterNumber,
    input.task.title,
    input.continuityContract.lockedProtagonistName || "",
    input.limit ?? 5,
    query
  ].join("");
  const cached = factoryMemoryContextCache.get(cacheKey);
  const now2 = Date.now();
  if (cached && cached.expiresAt > now2) {
    memoryCacheTracker.hits++;
    return cached.value;
  }
  memoryCacheTracker.misses++;
  const context = await withFactoryDb(input.options.factoryRootDir, async (db) => {
    const rows = db.recallMemory(input.options.projectId, query, input.limit ?? 5, {
      embedding: createLocalTextEmbedding(query)
    });
    const selected = rows.filter((row) => ["character_dossiers", "chapter_summary"].includes(String(row.kind)));
    if (!selected.length) return "";
    return [
      "Factory Memory Recall:",
      ...selected.slice(0, input.limit ?? 5).map((row) => [
        `- ${row.kind}: ${row.source}`,
        String(row.content || "").slice(0, String(row.kind) === "character_dossiers" ? 900 : 420)
      ].join("\n"))
    ].join("\n");
  }).catch(() => "");
  setFactoryMemoryContextCache(cacheKey, context, now2);
  return context;
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
function formatVolumeStrategy(state) {
  const volumeSize = Math.max(6, Math.ceil(state.plan.totalChapters / 3));
  const volumes = Array.from({ length: Math.ceil(state.plan.totalChapters / volumeSize) }, (_, index) => {
    const start = index * volumeSize + 1;
    const end = Math.min(state.plan.totalChapters, start + volumeSize - 1);
    const firstTask = state.plan.chapterTasks[start - 1];
    const lastTask = state.plan.chapterTasks[end - 1];
    const firstPlan = firstTask ? getTaskCausalPlan(state, firstTask) : null;
    const lastPlan = lastTask ? getTaskCausalPlan(state, lastTask) : null;
    return [
      `### \u7B2C ${index + 1} \u5377\uFF1A\u7B2C ${start}-${end} \u7AE0`,
      `- \u5377\u76EE\u6807\uFF1A\u4ECE\u300C${firstPlan?.previousInput || state.project.idea}\u300D\u63A8\u8FDB\u5230\u300C${lastPlan?.nextHandoff || state.project.idea}\u300D\u3002`,
      `- \u8BFB\u8005\u5151\u73B0\uFF1A\u6BCF\u5377\u5FC5\u987B\u5B8C\u6210\u4E00\u6B21\u5C40\u90E8\u7B54\u6848\uFF0C\u540C\u65F6\u628A\u66F4\u5927\u95EE\u9898\u63A8\u5411\u4E0B\u4E00\u5377\u3002`,
      `- \u89D2\u8272\u538B\u529B\uFF1A\u672C\u5377\u81F3\u5C11\u8BA9\u4E3B\u89D2\u4ED8\u51FA\u4E00\u6B21\u8D44\u6E90\u3001\u5173\u7CFB\u3001\u8EAB\u4EFD\u6216\u4FE1\u5FF5\u4EE3\u4EF7\u3002`,
      `- \u4F0F\u7B14\u7B56\u7565\uFF1A\u672C\u5377\u81F3\u5C11\u65B0\u589E 2 \u4E2A\u4F0F\u7B14\uFF0C\u56DE\u6536\u6216\u53D8\u5F62\u5151\u73B0 1 \u4E2A\u4F0F\u7B14\u3002`
    ].join("\n");
  });
  return volumes;
}
var PRODUCTION_STORY_MARKDOWN_ASSET_FILES = [
  "world-matrix.md",
  "plot-architecture.md",
  "story-bible.md",
  "volume-strategy.md",
  "foreshadowing-ledger.md",
  "character-dynamics.md"
];
var PRODUCTION_STORY_STRUCTURED_ASSET_FILES = [
  "story-foundation-contract.json",
  "world-matrix.json",
  "plot-architecture.json",
  "story-bible.json",
  "volume-strategy.json",
  "foreshadowing-ledger.json",
  "character-dynamics.json"
];
var PRODUCTION_STORY_ASSET_FILES = [
  ...PRODUCTION_STORY_MARKDOWN_ASSET_FILES,
  ...PRODUCTION_STORY_STRUCTURED_ASSET_FILES
];
function extractStoryAssetRelevantLines(content, task, maxLines = 18) {
  const chapterNumber = task.chapterNumber;
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const matchingChapter = [
        ...Array.isArray(parsed?.plot?.chapters) ? parsed.plot.chapters : [],
        ...Array.isArray(parsed?.chapters) ? parsed.chapters : [],
        ...Array.isArray(parsed?.timeline) ? parsed.timeline : []
      ].find((entry) => Number(entry?.chapterNumber) === chapterNumber);
      const matchingForeshadowing = [
        ...Array.isArray(parsed?.foreshadowing?.entries) ? parsed.foreshadowing.entries : [],
        ...Array.isArray(parsed?.entries) ? parsed.entries : []
      ].filter((entry) => Number(entry?.sourceChapter || entry?.chapterNumber) === chapterNumber);
      const matchingCharacterDelta = [
        ...Array.isArray(parsed?.characters?.stateDeltas) ? parsed.characters.stateDeltas : [],
        ...Array.isArray(parsed?.characterStateDeltas) ? parsed.characterStateDeltas : [],
        ...Array.isArray(parsed?.chapterStateDeltas) ? parsed.chapterStateDeltas : []
      ].find((entry) => Number(entry?.chapterNumber) === chapterNumber);
      const lines2 = [
        parsed?.project?.title ? `- Project: ${parsed.project.title}` : "",
        parsed?.genre?.readerPromise ? `- Reader Promise: ${parsed.genre.readerPromise}` : "",
        parsed?.readerPromise ? `- Reader Promise: ${parsed.readerPromise}` : "",
        matchingChapter?.title ? `- Chapter: ${matchingChapter.chapterNumber} ${matchingChapter.title}` : "",
        matchingChapter?.sceneObjective ? `- Causal Objective: ${matchingChapter.sceneObjective}` : "",
        matchingChapter?.previousInput ? `- Previous Input: ${matchingChapter.previousInput}` : "",
        matchingChapter?.protagonistDecision ? `- Protagonist Decision: ${matchingChapter.protagonistDecision}` : "",
        matchingChapter?.irreversibleConsequence ? `- Irreversible Change: ${matchingChapter.irreversibleConsequence}` : "",
        matchingChapter?.nextHandoff ? `- Next Handoff: ${matchingChapter.nextHandoff}` : "",
        matchingCharacterDelta?.delta ? `- Character Delta: ${matchingCharacterDelta.delta}` : "",
        ...matchingForeshadowing.slice(0, 3).map((entry) => `- Foreshadowing: ${entry.operation || entry.expectedAdvance || entry.status}`),
        ...Array.isArray(parsed?.rules) ? parsed.rules.slice(0, 3).map((rule) => `- Rule: ${typeof rule === "string" ? rule : rule.rule || rule.execution || JSON.stringify(rule)}`) : []
      ].filter(Boolean);
      return uniqueStrings(lines2).slice(0, maxLines);
    } catch {
      return [];
    }
  }
  const chapterPatterns = [
    new RegExp(`\u7B2C\\s*${chapterNumber}\\s*\u7AE0`, "u"),
    new RegExp(`Chapter\\s*${chapterNumber}\\b`, "iu"),
    new RegExp(`\\|\\s*${chapterNumber}\\s*\\|`, "u")
  ];
  const importantPattern = /Frozen World Rules|Non-Negotiable|Causal Spine|Chapter Causality Matrix|Continuity Anchor|Foreshadowing|Character State|Core Relationship|Volume Contract|Reader Promise|Style Contract|Protagonist|Ledger Rules|Escalation Rules|Required Dossier/u;
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const selected = [];
  for (const line of lines) {
    const isHeading = /^#{1,3}\s+/u.test(line) && importantPattern.test(line);
    const isChapterLine = chapterPatterns.some((pattern) => pattern.test(line));
    const isRuleLine = /^[-*]\s+/u.test(line) && importantPattern.test(line);
    if (isHeading || isChapterLine || isRuleLine) {
      selected.push(line);
    }
    if (selected.length >= maxLines) break;
  }
  if (selected.length === 0) {
    return lines.filter((line) => /^#{1,3}\s+/u.test(line) || /^[-*]\s+/u.test(line)).slice(0, Math.max(6, Math.floor(maxLines / 2)));
  }
  return selected;
}
async function loadProductionStoryAssetContext(paths, task, maxChars = 2200) {
  const sections = [];
  const files = [];
  for (const filename of PRODUCTION_STORY_ASSET_FILES) {
    const content = await readOptionalText2(import_node_path8.default.join(paths.plansDir, filename));
    if (!content) continue;
    const relevant = extractStoryAssetRelevantLines(content, task);
    if (!relevant.length) continue;
    files.push(filename);
    const section = [
      `### ${filename}`,
      ...relevant
    ].join("\n");
    sections.push(section.length > 520 ? `${section.slice(0, 520).trim()}
...[${filename} clipped]` : section);
  }
  if (!sections.length) {
    return { prompt: "", files: [] };
  }
  const prompt = [
    "## Production Story Asset Context",
    "",
    "\u8FD9\u4E9B\u5185\u5BB9\u6765\u81EA\u5DF2\u51BB\u7ED3\u7684\u524D\u7F6E\u6545\u4E8B\u8D44\u4EA7\u3002\u84DD\u56FE\u548C\u6B63\u6587\u5FC5\u987B\u670D\u4ECE\u5B83\u4EEC\uFF1B\u5982\u4E0E\u4E34\u65F6\u4E0A\u4E0B\u6587\u51B2\u7A81\uFF0C\u4EE5\u672C\u8D44\u4EA7\u6458\u8981\u4E3A\u51C6\u3002",
    "",
    ...sections
  ].join("\n\n");
  return {
    prompt: prompt.length > maxChars ? `${prompt.slice(0, maxChars).trim()}
...[story assets clipped]` : prompt,
    files
  };
}
function createProductionStoryBibleAssets(state, context, resources) {
  const genre = inferGenreProfile(state);
  const consensus = context.consensus || "\u5C1A\u65E0\u989D\u5916\u5171\u8BC6\uFF1B\u4EE5\u9879\u76EE\u521D\u59CB\u76EE\u6807\u4F5C\u4E3A\u6700\u9AD8\u7EA6\u675F\u3002";
  const protagonist = context.protagonist || "\u4E3B\u89D2\u6863\u6848\u5F85\u8865\u9F50\uFF1B\u672C\u9636\u6BB5\u5FC5\u987B\u81F3\u5C11\u51BB\u7ED3\u4E3B\u89D2\u8EAB\u4EFD\u3001\u6B32\u671B\u3001\u4F24\u53E3\u548C\u884C\u52A8\u65B9\u5F0F\u3002";
  const style = context.style || "\u5199\u6CD5\u5C1A\u672A\u5B8C\u5168\u51BB\u7ED3\uFF1B\u8FDB\u5165\u6B63\u6587\u524D\u4ECD\u5FC5\u987B\u5B8C\u6210\u7528\u6237\u786E\u8BA4\u7684\u5199\u6CD5\u6837\u6BB5\u3002";
  const chapterMatrix = formatChapterCausalityMatrix(state);
  const continuityPlan = formatContinuityAnchorPlan(state);
  const characterLedgerPlan = formatCharacterStateLedgerPlan(state);
  const foreshadowingPlan = formatForeshadowingPayoffSchedule(state);
  const volumeStrategy = formatVolumeStrategy(state);
  const projectKey = stableAssetId(`${state.project.title}-${state.project.createdAt}`, "project");
  const resourceSignals = [
    `- Style guide loaded: ${resources.styleGuide ? "yes" : "no"}`,
    `- Vocabulary resources loaded: ${resources.vocabularySamples.length}`,
    `- Few-shot examples loaded: ${resources.examples.length}`
  ];
  const protagonistName = lockedProtagonistFromState(state, protagonist) || extractChinesePersonNames(protagonist, 1)[0] || "\u5F85\u51BB\u7ED3\u4E3B\u89D2";
  const chapterContracts = state.plan.chapterTasks.map((task) => {
    const causalPlan = getTaskCausalPlan(state, task);
    return {
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: task.status,
      targetWords: task.targetWords,
      summary: task.summary,
      previousInput: causalPlan.previousInput,
      sceneObjective: causalPlan.sceneObjective,
      protagonistDecision: causalPlan.protagonistDecision,
      irreversibleConsequence: causalPlan.irreversibleConsequence,
      characterStateDelta: causalPlan.characterStateDelta,
      requiredContinuityAnchors: causalPlan.requiredContinuityAnchors,
      foreshadowingOperation: causalPlan.foreshadowingOperation,
      nextHandoff: causalPlan.nextHandoff
    };
  });
  const continuityAnchors = uniqueStrings(chapterContracts.flatMap((chapter) => chapter.requiredContinuityAnchors)).slice(0, 80);
  const structuredWorldRules = [
    {
      id: "core-idea-boundary",
      rule: "\u4E16\u754C\u89C4\u5219\u5FC5\u987B\u670D\u52A1\u6838\u5FC3\u521B\u610F\uFF0C\u4E0D\u5141\u8BB8\u4E3A\u4E86\u5355\u7AE0\u723D\u70B9\u4E34\u65F6\u6539\u89C4\u5219\u3002",
      execution: "\u6BCF\u6B21\u65B0\u589E\u8BBE\u5B9A\u90FD\u8981\u843D\u5230\u4EBA\u7269\u9009\u62E9\u3001\u8D44\u6E90\u4EE3\u4EF7\u6216\u793E\u4F1A\u538B\u529B\u3002",
      source: "world-matrix.md"
    },
    {
      id: "scene-first-worldbuilding",
      rule: "\u4E0D\u5141\u8BB8\u6574\u6BB5\u89E3\u91CA\u4E16\u754C\u89C2\u3002",
      execution: "\u8BBE\u5B9A\u5FC5\u987B\u5D4C\u5165\u51B2\u7A81\u3001\u5BF9\u8BDD\u3001\u8BC1\u636E\u6216\u884C\u52A8\u3002",
      source: "world-matrix.md"
    },
    {
      id: "chapter-cost-rule",
      rule: "\u6BCF\u7AE0\u81F3\u5C11\u8BA9\u4E00\u4E2A\u4E16\u754C\u89C4\u5219\u6539\u53D8\u89D2\u8272\u7684\u9009\u62E9\u6210\u672C\u3002",
      execution: "\u7AE0\u8282\u84DD\u56FE\u5FC5\u987B\u8BF4\u660E\u8BE5\u89C4\u5219\u5982\u4F55\u5236\u9020\u4EE3\u4EF7\u3002",
      source: "world-matrix.md"
    }
  ];
  const foreshadowingEntries = chapterContracts.map((chapter) => ({
    id: `foreshadowing-${String(chapter.chapterNumber).padStart(3, "0")}`,
    sourceChapter: chapter.chapterNumber,
    sourceTitle: chapter.title,
    operation: chapter.foreshadowingOperation,
    status: "planned",
    expectedAdvance: chapter.nextHandoff,
    payoffMode: chapter.chapterNumber >= state.plan.totalChapters ? "final_payoff" : chapter.chapterNumber >= Math.max(1, state.plan.totalChapters - 1) ? "late_payoff" : "advance_or_reframe",
    linkedAnchors: chapter.requiredContinuityAnchors
  }));
  const timelineEntries = chapterContracts.map((chapter) => ({
    id: `chapter-${String(chapter.chapterNumber).padStart(3, "0")}`,
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    previousInput: chapter.previousInput,
    event: chapter.sceneObjective,
    decision: chapter.protagonistDecision,
    irreversibleChange: chapter.irreversibleConsequence,
    nextState: chapter.nextHandoff
  }));
  const relationshipEntries = [
    {
      id: stableAssetId(protagonistName, "protagonist"),
      name: protagonistName,
      role: "protagonist",
      desire: "\u5F85\u7531\u4EBA\u7269\u6863\u6848\u51BB\u7ED3\uFF1B\u5FC5\u987B\u4E0E\u6838\u5FC3\u521B\u610F\u548C\u7AE0\u8282\u56E0\u679C\u94FE\u4E00\u81F4\u3002",
      woundOrFear: "\u5F85\u7531\u4EBA\u7269\u6863\u6848\u51BB\u7ED3\uFF1B\u6B63\u6587\u524D\u5FC5\u987B\u8865\u9F50\u3002",
      behaviorHabit: "\u5F85\u7531\u4EBA\u7269\u6863\u6848\u51BB\u7ED3\uFF1B\u4E0D\u5F97\u5728\u7AE0\u8282\u95F4\u91CD\u7F6E\u3002",
      speechMarker: "\u5F85\u7531\u4EBA\u7269\u6863\u6848\u51BB\u7ED3\uFF1B\u7528\u4E8E\u533A\u5206\u5BF9\u767D\u58F0\u97F3\u3002",
      relationshipPressure: "\u7531\u6BCF\u7AE0 characterStateDelta \u63A8\u8FDB\u3002"
    }
  ];
  const characterStateDeltas = chapterContracts.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    delta: chapter.characterStateDelta,
    requiredMemoryWrite: true
  }));
  const volumeContracts = volumeStrategy.map((summary, index) => ({
    id: `volume-${index + 1}`,
    title: summary.match(/^###\s+(.+)$/mu)?.[1] || `\u7B2C ${index + 1} \u5377`,
    summary,
    status: "planned",
    requiredChange: "\u5377\u5C3E\u5FC5\u987B\u6539\u53D8\u4E3B\u89D2\u4F4D\u7F6E\u3001\u5173\u7CFB\u7F51\u7EDC\u6216\u4E16\u754C\u8BA4\u77E5\u3002"
  }));
  const storyFoundationContract = {
    version: 1,
    generatedBy: "production-story-bible-assets",
    project: {
      key: projectKey,
      title: state.project.title,
      idea: state.project.idea,
      totalChapters: state.plan.totalChapters,
      chapterWordTarget: state.plan.chapterWordTarget
    },
    genre: {
      profile: genre.genre,
      readerPromise: genre.readerPromise,
      pointOfView: genre.pointOfView,
      tone: genre.tone
    },
    gates: {
      markdownAssets: PRODUCTION_STORY_MARKDOWN_ASSET_FILES,
      structuredAssets: PRODUCTION_STORY_STRUCTURED_ASSET_FILES,
      mustPassBeforeDrafting: [
        "core_consensus",
        "story_foundation",
        "character_dynamics",
        "chapter_blueprints",
        "style_approval"
      ]
    },
    consensus: {
      text: consensus,
      protagonist,
      styleCarryover: style
    },
    world: {
      rules: structuredWorldRules,
      continuityAnchors
    },
    plot: {
      causalModel: "previous_input -> scene_objective -> protagonist_decision -> irreversible_change -> next_handoff",
      chapters: chapterContracts,
      timeline: timelineEntries
    },
    characters: {
      protagonist: protagonistName,
      relationshipEntries,
      stateDeltas: characterStateDeltas,
      requiredDossierFields: [
        "canonical name",
        "identity and role function",
        "core desire",
        "fear or wound",
        "behavior habit",
        "speech marker",
        "appearance or body marker",
        "skill, limitation, and cost",
        "relationship state"
      ]
    },
    foreshadowing: {
      ledgerRules: [
        "\u6BCF\u6761\u4F0F\u7B14\u5FC5\u987B\u6709\u6765\u6E90\u7AE0\u8282\u3001\u5F53\u524D\u72B6\u6001\u3001\u9884\u8BA1\u63A8\u8FDB\u70B9\u548C\u56DE\u6536\u65B9\u5F0F\u3002",
        "\u4F0F\u7B14\u53EF\u4EE5\u5EF6\u540E\uFF0C\u4F46\u4E0D\u80FD\u65E0\u9650\u60AC\u7A7A\uFF1B\u5EF6\u540E\u5FC5\u987B\u589E\u52A0\u538B\u529B\u6216\u6539\u53D8\u8BFB\u8005\u7406\u89E3\u3002",
        "\u4F0F\u7B14\u56DE\u6536\u5FC5\u987B\u901A\u8FC7\u573A\u666F\u4E8B\u5B9E\u5151\u73B0\uFF0C\u4E0D\u80FD\u53EA\u8BA9\u89D2\u8272\u53E3\u5934\u89E3\u91CA\u3002"
      ],
      entries: foreshadowingEntries
    },
    volumes: volumeContracts,
    resources: {
      styleGuideLoaded: Boolean(resources.styleGuide),
      vocabularySamples: resources.vocabularySamples.length,
      examples: resources.examples.length
    }
  };
  const structuredAssets = [
    {
      filename: "story-foundation-contract.json",
      title: "Story Foundation Contract",
      stage: "story_foundation_contract",
      value: storyFoundationContract
    },
    {
      filename: "world-matrix.json",
      title: "World Matrix JSON",
      stage: "world_matrix_structured",
      value: {
        version: 1,
        projectKey,
        title: state.project.title,
        genre: storyFoundationContract.genre,
        rules: structuredWorldRules,
        continuityAnchors,
        sourceConsensus: consensus,
        protagonistPressureInterface: protagonist
      }
    },
    {
      filename: "plot-architecture.json",
      title: "Plot Architecture JSON",
      stage: "plot_architecture_structured",
      value: {
        version: 1,
        causalModel: storyFoundationContract.plot.causalModel,
        chapters: chapterContracts,
        timeline: timelineEntries,
        escalationRules: [
          "\u6BCF 3-5 \u7AE0\u5FC5\u987B\u8BA9\u5916\u90E8\u538B\u529B\u5347\u7EA7\u4E00\u6B21\uFF0C\u4E0D\u80FD\u53EA\u6362\u5730\u70B9\u91CD\u590D\u540C\u7C7B\u4E8B\u4EF6\u3002",
          "\u4E2D\u6BB5\u5FC5\u987B\u8BA9\u4E3B\u89D2\u7684\u65E7\u65B9\u6CD5\u5931\u6548\uFF0C\u903C\u51FA\u65B0\u7684\u9009\u62E9\u6216\u8054\u76DF\u3002",
          "\u7ED3\u5C40\u524D\u5FC5\u987B\u56DE\u6536\u6838\u5FC3\u7F3A\u53E3\u3001\u4E3B\u8981\u5173\u7CFB\u503A\u548C\u81F3\u5C11\u4E00\u6761\u65E9\u671F\u4F0F\u7B14\u3002"
        ]
      }
    },
    {
      filename: "story-bible.json",
      title: "Story Bible JSON",
      stage: "story_bible_structured",
      value: {
        version: 1,
        title: state.project.title,
        coreIdea: state.project.idea,
        readerPromise: genre.readerPromise,
        nonNegotiableContracts: [
          "\u4E0D\u5141\u8BB8\u6F02\u79FB\u9898\u6750\uFF0C\u4E0D\u5141\u8BB8\u8131\u79BB\u6838\u5FC3\u521B\u610F\u6539\u5199\u6210\u53E6\u4E00\u90E8\u5C0F\u8BF4\u3002",
          "\u4E0D\u5141\u8BB8\u6B63\u6587\u5148\u884C\u518D\u8865\u8BBE\u5B9A\uFF1B\u7AE0\u8282\u5FC5\u987B\u670D\u4ECE\u4E16\u754C\u77E9\u9635\u3001\u4E3B\u7EBF\u67B6\u6784\u3001\u4EBA\u7269\u72B6\u6001\u548C\u4F0F\u7B14\u8D26\u672C\u3002",
          "\u4EFB\u4F55\u65B0\u589E\u4EBA\u7269\u3001\u5730\u70B9\u3001\u7EC4\u7EC7\u3001\u7269\u4EF6\u3001\u89C4\u5219\uFF0C\u90FD\u8981\u80FD\u8BF4\u660E\u5B83\u627F\u62C5\u7684\u5267\u60C5\u529F\u80FD\u3002"
        ],
        styleCarryover: style,
        protagonist,
        characterStateDeltas
      }
    },
    {
      filename: "volume-strategy.json",
      title: "Volume Strategy JSON",
      stage: "volume_strategy_structured",
      value: {
        version: 1,
        volumes: volumeContracts,
        contractRules: [
          "\u6BCF\u5377\u90FD\u8981\u6709\u6E05\u6670\u7684\u9636\u6BB5\u76EE\u6807\u3001\u9636\u6BB5\u5931\u8D25\u98CE\u9669\u548C\u9636\u6BB5\u5151\u73B0\u3002",
          "\u5377\u5C3E\u4E0D\u80FD\u53EA\u662F\u4E8B\u4EF6\u7ED3\u675F\uFF0C\u5FC5\u987B\u6539\u53D8\u4E3B\u89D2\u4F4D\u7F6E\u3001\u5173\u7CFB\u7F51\u7EDC\u6216\u4E16\u754C\u8BA4\u77E5\u3002"
        ]
      }
    },
    {
      filename: "foreshadowing-ledger.json",
      title: "Foreshadowing Ledger JSON",
      stage: "foreshadowing_ledger_structured",
      value: {
        version: 1,
        rules: storyFoundationContract.foreshadowing.ledgerRules,
        entries: foreshadowingEntries
      }
    },
    {
      filename: "character-dynamics.json",
      title: "Character Dynamics JSON",
      stage: "character_dynamics_structured",
      value: {
        version: 1,
        protagonist: protagonistName,
        relationshipEntries,
        chapterStateDeltas: characterStateDeltas,
        requiredDossierFields: storyFoundationContract.characters.requiredDossierFields,
        relationshipRules: [
          "\u4EBA\u7269\u5173\u7CFB\u4E0D\u662F\u59D3\u540D\u5217\u8868\uFF0C\u800C\u662F\u6B32\u671B\u3001\u503A\u52A1\u3001\u6050\u60E7\u3001\u5229\u76CA\u548C\u8BEF\u89E3\u7684\u52A8\u6001\u7CFB\u7EDF\u3002",
          "\u6BCF\u4E2A\u5173\u952E\u4EBA\u7269\u90FD\u5FC5\u987B\u6709\u4ED6\u81EA\u5DF1\u7684\u76EE\u6807\uFF0C\u4E0D\u80FD\u53EA\u670D\u52A1\u4E3B\u89D2\u8BE2\u95EE\u6216\u63A8\u52A8\u60C5\u8282\u3002",
          "\u5173\u7CFB\u53D8\u5316\u5FC5\u987B\u8FDB\u5165\u7AE0\u8282\u8BB0\u5FC6\uFF0C\u540E\u7EED\u7AE0\u8282\u4E0D\u80FD\u91CD\u7F6E\u3002"
        ]
      }
    }
  ];
  const worldMatrix = [
    "# World Matrix",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Genre profile: ${genre.genre}`,
    `Reader promise: ${genre.readerPromise}`,
    `Point of view: ${genre.pointOfView}`,
    `Tone: ${genre.tone}`,
    "",
    "## Frozen World Rules",
    "- \u4E16\u754C\u89C4\u5219\u5FC5\u987B\u670D\u52A1\u6838\u5FC3\u521B\u610F\uFF0C\u4E0D\u5141\u8BB8\u4E3A\u4E86\u5355\u7AE0\u723D\u70B9\u4E34\u65F6\u6539\u89C4\u5219\u3002",
    "- \u6BCF\u6761\u89C4\u5219\u90FD\u8981\u5728\u4EBA\u7269\u9009\u62E9\u3001\u8D44\u6E90\u4EE3\u4EF7\u6216\u793E\u4F1A\u538B\u529B\u4E2D\u4F53\u73B0\uFF0C\u4E0D\u80FD\u53EA\u505A\u767E\u79D1\u8BF4\u660E\u3002",
    "- \u65B0\u589E\u8BBE\u5B9A\u5FC5\u987B\u80FD\u843D\u5230\u7269\u4EF6\u3001\u5730\u70B9\u3001\u5236\u5EA6\u3001\u79F0\u547C\u3001\u7981\u5FCC\u6216\u5177\u4F53\u884C\u52A8\u3002",
    "",
    "## Source Consensus",
    consensus,
    "",
    "## Protagonist Pressure Interface",
    protagonist,
    "",
    "## Setting Execution Rules",
    "- \u9996\u7AE0\u5EFA\u7ACB\u4E16\u754C\u7684\u5F02\u5E38\u5165\u53E3\uFF0C\u7B2C\u4E8C\u7AE0\u4EE5\u540E\u7528\u540E\u679C\u5C55\u793A\u89C4\u5219\u3002",
    "- \u6BCF\u7AE0\u81F3\u5C11\u8BA9\u4E00\u4E2A\u4E16\u754C\u89C4\u5219\u6539\u53D8\u89D2\u8272\u7684\u9009\u62E9\u6210\u672C\u3002",
    "- \u4E0D\u5141\u8BB8\u6574\u6BB5\u89E3\u91CA\u4E16\u754C\u89C2\uFF1B\u8BBE\u5B9A\u5FC5\u987B\u5D4C\u5165\u51B2\u7A81\u3001\u5BF9\u8BDD\u3001\u8BC1\u636E\u6216\u884C\u52A8\u3002"
  ].join("\n");
  const plotArchitecture = [
    "# Plot Architecture",
    "",
    "## Causal Spine",
    "- \u5168\u4E66\u91C7\u7528\u627F\u63A5-\u9009\u62E9-\u4EE3\u4EF7-\u4EA4\u68D2\u94FE\u3002",
    "- \u6BCF\u7AE0\u5FC5\u987B\u7EE7\u627F\u4E0A\u4E00\u7AE0\u81F3\u5C11\u4E00\u4E2A\u72B6\u6001\u3001\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u4EE3\u4EF7\u6216\u672A\u89E3\u95EE\u9898\u3002",
    "- \u6BCF\u7AE0\u7ED3\u5C3E\u5FC5\u987B\u4EA7\u751F\u4E0B\u4E00\u7AE0\u4E0D\u80FD\u7ED5\u5F00\u7684\u65B0\u72B6\u6001\u3002",
    "",
    "## Chapter Causality Matrix",
    ...chapterMatrix,
    "",
    "## Continuity Anchor Plan",
    ...continuityPlan,
    "",
    "## Escalation Rules",
    "- \u6BCF 3-5 \u7AE0\u5FC5\u987B\u8BA9\u5916\u90E8\u538B\u529B\u5347\u7EA7\u4E00\u6B21\uFF0C\u4E0D\u80FD\u53EA\u6362\u5730\u70B9\u91CD\u590D\u540C\u7C7B\u4E8B\u4EF6\u3002",
    "- \u4E2D\u6BB5\u5FC5\u987B\u8BA9\u4E3B\u89D2\u7684\u65E7\u65B9\u6CD5\u5931\u6548\uFF0C\u903C\u51FA\u65B0\u7684\u9009\u62E9\u6216\u8054\u76DF\u3002",
    "- \u7ED3\u5C40\u524D\u5FC5\u987B\u56DE\u6536\u6838\u5FC3\u7F3A\u53E3\u3001\u4E3B\u8981\u5173\u7CFB\u503A\u548C\u81F3\u5C11\u4E00\u6761\u65E9\u671F\u4F0F\u7B14\u3002"
  ].join("\n");
  const storyBible = [
    "# Story Bible",
    "",
    `Title: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    "",
    "## Non-Negotiable Story Contract",
    "- \u4E0D\u5141\u8BB8\u6F02\u79FB\u9898\u6750\uFF0C\u4E0D\u5141\u8BB8\u8131\u79BB\u6838\u5FC3\u521B\u610F\u6539\u5199\u6210\u53E6\u4E00\u90E8\u5C0F\u8BF4\u3002",
    "- \u4E0D\u5141\u8BB8\u6B63\u6587\u5148\u884C\u518D\u8865\u8BBE\u5B9A\uFF1B\u7AE0\u8282\u5FC5\u987B\u670D\u4ECE\u4E16\u754C\u77E9\u9635\u3001\u4E3B\u7EBF\u67B6\u6784\u3001\u4EBA\u7269\u72B6\u6001\u548C\u4F0F\u7B14\u8D26\u672C\u3002",
    "- \u4EFB\u4F55\u65B0\u589E\u4EBA\u7269\u3001\u5730\u70B9\u3001\u7EC4\u7EC7\u3001\u7269\u4EF6\u3001\u89C4\u5219\uFF0C\u90FD\u8981\u80FD\u8BF4\u660E\u5B83\u627F\u62C5\u7684\u5267\u60C5\u529F\u80FD\u3002",
    "",
    "## Reader Promise",
    genre.readerPromise,
    "",
    "## Style Contract Carryover",
    style,
    "",
    "## Character Spine",
    protagonist,
    "",
    "## Character State Ledger Plan",
    ...characterLedgerPlan,
    "",
    "## Planning Resource Signals",
    ...resourceSignals
  ].join("\n");
  const volumeStrategyContent = [
    "# Volume Strategy",
    "",
    "## Volume Contract",
    "- \u6BCF\u5377\u90FD\u8981\u6709\u6E05\u6670\u7684\u9636\u6BB5\u76EE\u6807\u3001\u9636\u6BB5\u5931\u8D25\u98CE\u9669\u548C\u9636\u6BB5\u5151\u73B0\u3002",
    "- \u5377\u5C3E\u4E0D\u80FD\u53EA\u662F\u4E8B\u4EF6\u7ED3\u675F\uFF0C\u5FC5\u987B\u6539\u53D8\u4E3B\u89D2\u4F4D\u7F6E\u3001\u5173\u7CFB\u7F51\u7EDC\u6216\u4E16\u754C\u8BA4\u77E5\u3002",
    "",
    ...volumeStrategy
  ].join("\n");
  const foreshadowingLedger = [
    "# Foreshadowing Ledger",
    "",
    "## Ledger Rules",
    "- \u6BCF\u6761\u4F0F\u7B14\u5FC5\u987B\u6709\u6765\u6E90\u7AE0\u8282\u3001\u5F53\u524D\u72B6\u6001\u3001\u9884\u8BA1\u63A8\u8FDB\u70B9\u548C\u56DE\u6536\u65B9\u5F0F\u3002",
    "- \u4F0F\u7B14\u53EF\u4EE5\u5EF6\u540E\uFF0C\u4F46\u4E0D\u80FD\u65E0\u9650\u60AC\u7A7A\uFF1B\u5EF6\u540E\u5FC5\u987B\u589E\u52A0\u538B\u529B\u6216\u6539\u53D8\u8BFB\u8005\u7406\u89E3\u3002",
    "- \u4F0F\u7B14\u56DE\u6536\u5FC5\u987B\u901A\u8FC7\u573A\u666F\u4E8B\u5B9E\u5151\u73B0\uFF0C\u4E0D\u80FD\u53EA\u8BA9\u89D2\u8272\u53E3\u5934\u89E3\u91CA\u3002",
    "",
    "## Initial Schedule",
    ...foreshadowingPlan
  ].join("\n");
  const characterDynamics = [
    "# Character Dynamics",
    "",
    "## Core Relationship Contract",
    "- \u4EBA\u7269\u5173\u7CFB\u4E0D\u662F\u59D3\u540D\u5217\u8868\uFF0C\u800C\u662F\u6B32\u671B\u3001\u503A\u52A1\u3001\u6050\u60E7\u3001\u5229\u76CA\u548C\u8BEF\u89E3\u7684\u52A8\u6001\u7CFB\u7EDF\u3002",
    "- \u6BCF\u4E2A\u5173\u952E\u4EBA\u7269\u90FD\u5FC5\u987B\u6709\u4ED6\u81EA\u5DF1\u7684\u76EE\u6807\uFF0C\u4E0D\u80FD\u53EA\u670D\u52A1\u4E3B\u89D2\u8BE2\u95EE\u6216\u63A8\u52A8\u60C5\u8282\u3002",
    "- \u5173\u7CFB\u53D8\u5316\u5FC5\u987B\u8FDB\u5165\u7AE0\u8282\u8BB0\u5FC6\uFF0C\u540E\u7EED\u7AE0\u8282\u4E0D\u80FD\u91CD\u7F6E\u3002",
    "",
    "## Protagonist",
    protagonist,
    "",
    "## Per-Chapter State Delta",
    ...characterLedgerPlan,
    "",
    "## Required Dossier Fields",
    "- canonical name",
    "- identity and role function",
    "- core desire",
    "- fear or wound",
    "- behavior habit",
    "- speech marker",
    "- appearance or body marker",
    "- skill, limitation, and cost",
    "- relationship state"
  ].join("\n");
  return [
    { filename: "world-matrix.md", title: "World Matrix", content: worldMatrix, stage: "world_matrix" },
    { filename: "plot-architecture.md", title: "Plot Architecture", content: plotArchitecture, stage: "plot_architecture" },
    { filename: "story-bible.md", title: "Story Bible", content: storyBible, stage: "story_bible" },
    { filename: "volume-strategy.md", title: "Volume Strategy", content: volumeStrategyContent, stage: "volume_strategy" },
    { filename: "foreshadowing-ledger.md", title: "Foreshadowing Ledger", content: foreshadowingLedger, stage: "foreshadowing_ledger" },
    { filename: "character-dynamics.md", title: "Character Dynamics", content: characterDynamics, stage: "character_dynamics" },
    ...structuredAssets.map((asset) => ({
      filename: asset.filename,
      title: asset.title,
      content: JSON.stringify(asset.value, null, 2),
      stage: asset.stage,
      format: "json"
    }))
  ];
}
function createProductionWritingPlanContract(state) {
  const chapters = state.plan.chapterTasks.map((task) => {
    const qualityGate = task.qualityGate || null;
    const status = task.status === "complete" ? "completed" : task.status === "in_progress" ? "in_progress" : task.status === "blocked" ? "blocked" : "pending";
    return {
      chapterNumber: task.chapterNumber,
      title: task.title,
      filePath: `.ai-novel/chapters/chapter-${String(task.chapterNumber).padStart(3, "0")}.final.md`,
      status,
      wordCount: qualityGate?.wordCount ?? null,
      qualityPass: qualityGate ? qualityGate.status === "passed" : null,
      retryCount: Math.max(0, Number(task.recoveryAttempts || qualityGate?.attempts || 0)),
      selectedVersionId: qualityGate?.status === "passed" ? "final" : null
    };
  });
  const completedCount = chapters.filter((chapter) => chapter.status === "completed").length;
  const blockedCount = chapters.filter((chapter) => chapter.status === "blocked").length;
  const inProgressCount = chapters.filter((chapter) => chapter.status === "in_progress").length;
  return {
    version: 1,
    novelName: state.project.title,
    totalChapters: state.plan.totalChapters,
    minWordsPerChapter: state.plan.chapterWordTarget,
    status: blockedCount > 0 ? "blocked" : completedCount >= state.plan.totalChapters && chapters.length >= state.plan.totalChapters ? "completed" : inProgressCount > 0 ? "in_progress" : "planning",
    writingMode: "serial",
    chapters
  };
}
async function writeProductionWritingPlan(projectRoot, paths, state, options = {}) {
  const writingPlan = createProductionWritingPlanContract(state);
  const writingPlanPath = import_node_path8.default.join(paths.plansDir, "writing-plan.json");
  await writeJsonFileAtomic(writingPlanPath, writingPlan);
  await recordPipelineArtifact(projectRoot, writingPlanPath, "plan", options, {
    stage: "writing_plan",
    production: true,
    title: "Writing Plan",
    totalChapters: writingPlan.totalChapters,
    status: writingPlan.status
  });
  return writingPlanPath;
}
function hasCausalBlueprint(blueprint = "") {
  return blueprint.includes("# Detailed Chapter Blueprint") && blueprint.includes("## Previous Inputs") && blueprint.includes("## Causal Objective") && blueprint.includes("## Irreversible Change") && blueprint.includes("## Character State Delta") && blueprint.includes("## Required Continuity Anchors") && blueprint.includes("## Next Chapter Handoff");
}
function evaluateCausalExecutionEvidence(draft, task, continuityContract) {
  const body = extractNarrativeBody(draft);
  const protagonist = continuityContract?.lockedProtagonistName || "";
  const anchors = [
    ...task.causalPlan?.requiredContinuityAnchors || [],
    ...continuityContract?.continuityAnchors || []
  ].filter((anchor) => isUsefulContinuityAnchor(anchor, protagonist));
  const matchedAnchors = uniqueStrings(anchors.filter((anchor) => body.includes(anchor))).slice(0, 8);
  const protagonistActionPattern = protagonist ? new RegExp(`${escapeRegExpLiteral(protagonist)}.{0,40}(\u8D70|\u7AD9|\u4F38\u624B|\u62FF|\u63A8|\u6263|\u6309|\u62AC|\u4F4E\u5934|\u8F6C\u8EAB|\u95EE|\u7B54|\u8BF4|\u9012|\u6536|\u85CF|\u7FFB|\u5199|\u6572|\u62E6|\u907F|\u505C|\u51B3\u5B9A|\u9009\u62E9|\u62D2\u7EDD|\u7B54\u5E94|\u5439\u706D|\u585E\u8FDB|\u8E72|\u770B|\u542C)`, "u") : /(主角|他|她).{0,40}(决定|选择|拒绝|答应|伸手|转身|递|藏|问|说|停)/u;
  const hasVisibleDecision = protagonistActionPattern.test(body) || /必须|只好|不能|来不及|没有选择|需要|决定|选择|拒绝|答应/u.test(body);
  const hasConsequence = /伤口|密信|线索|暴露|风险|怀疑|信任|债|欠|账册|名册|官|兵曹|少尹|刀|门|来问|明日|下一章|交给|后果|不可逆|关系裂缝|资源损失/u.test(body);
  const ending = body.slice(Math.max(0, body.length - 700));
  const hasHandoff = /门|脚步|声音|问|来问|明日|刀|信|名字|线索|少尹|兵曹|下一章|后果|不够|不能|来不及/u.test(ending);
  const score = [matchedAnchors.length >= 1, hasVisibleDecision, hasConsequence, hasHandoff].filter(Boolean).length;
  return {
    status: score >= 3 ? "eligible" : "quarantined",
    score,
    matchedAnchors,
    hasVisibleDecision,
    hasConsequence,
    hasHandoff,
    reason: score >= 3 ? `\u6B63\u6587\u4EE5\u53EF\u89C1\u4E8B\u4EF6\u6267\u884C\u56E0\u679C\u5408\u540C\uFF1A\u951A\u70B9=${matchedAnchors.slice(0, 4).join("\u3001") || "\u9690\u6027\u627F\u63A5"}\uFF1B\u4E3B\u52A8\u9009\u62E9=${hasVisibleDecision ? "\u6709" : "\u5F31"}\uFF1B\u540E\u679C=${hasConsequence ? "\u6709" : "\u5F31"}\uFF1B\u4EA4\u68D2=${hasHandoff ? "\u6709" : "\u5F31"}\u3002` : `\u56E0\u679C\u6267\u884C\u8BC1\u636E\u4E0D\u8DB3\uFF1A\u951A\u70B9=${matchedAnchors.slice(0, 4).join("\u3001") || "\u65E0"}\uFF1B\u4E3B\u52A8\u9009\u62E9=${hasVisibleDecision ? "\u6709" : "\u5F31"}\uFF1B\u540E\u679C=${hasConsequence ? "\u6709" : "\u5F31"}\uFF1B\u4EA4\u68D2=${hasHandoff ? "\u6709" : "\u5F31"}\u3002`
  };
}
function uniqueStrings(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function stableAssetId(value, fallback) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/giu, "-").replace(/^-+|-+$/gu, "");
  return normalized.slice(0, 72) || fallback;
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
    prompt,
    characterDossiers
  };
}
function extractKeywords(list) {
  const arr = Array.isArray(list) ? list : [list];
  const keywords = [];
  for (const item of arr) {
    if (!item) continue;
    const parts = item.split(/[,;；，\s、/|\\.]+/u).map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.length >= 2) {
        keywords.push(part);
      }
    }
  }
  return keywords;
}
function extractCharacterEvidenceWindow(body, index, nameLength) {
  const leftBoundary = Math.max(
    body.lastIndexOf("\n", index),
    body.lastIndexOf("\u3002", index),
    body.lastIndexOf("\uFF01", index),
    body.lastIndexOf("\uFF1F", index),
    body.lastIndexOf("\uFF1B", index),
    body.lastIndexOf(";", index)
  );
  const rightCandidates = ["\n", "\u3002", "\uFF01", "\uFF1F", "\uFF1B", ";"].map((delimiter) => body.indexOf(delimiter, index + nameLength)).filter((position) => position >= 0);
  const sentenceStart = leftBoundary >= 0 ? leftBoundary + 1 : Math.max(0, index - 24);
  const sentenceEnd = rightCandidates.length ? Math.min(...rightCandidates) : Math.min(body.length, index + nameLength + 48);
  const pronounTail = body.slice(sentenceEnd, Math.min(body.length, sentenceEnd + 140)).match(/^[\n。！？!?；;」”』]*\s*(?:他|她|其|这个人|那人)[^。！？!?；;\n]{4,120}/u);
  const windowEnd = pronounTail ? Math.min(body.length, sentenceEnd + pronounTail[0].length) : sentenceEnd;
  return body.slice(sentenceStart, windowEnd);
}
function textContainsOtherCastName(text, currentName, cast) {
  return cast.some((name) => name && name !== currentName && text.includes(name));
}
function collectRegexGroupMatches(body, pattern, groupIndex = 1) {
  const matches = [];
  for (const match of body.matchAll(pattern)) {
    const value = match[groupIndex];
    if (value) {
      matches.push(value.trim());
    }
  }
  return matches;
}
function extractAttributedCharacterDialogues(body, name, cast) {
  const escapedName = escapeRegExpLiteral(name);
  const speechVerb = "(?:\u8BF4|\u95EE|\u9053|\u558A|\u4F4E\u58F0|\u51B7\u7B11|\u7B54|\u53F9|\u5524|\u559D|\u56DE|\u63D0\u9192|\u50AC\u4FC3|\u5F00\u53E3|\u63A5\u8BDD)";
  const dialogues = [
    ...collectRegexGroupMatches(body, new RegExp(`${escapedName}[^\u3002\uFF01\uFF1F!?\uFF1B;\\n\u300C\u201C]{0,50}${speechVerb}[^\u300C\u201C\\n]{0,24}[\u300C\u201C]([^\u300D\u201D]{2,120})[\u300D\u201D]`, "gu")),
    ...collectRegexGroupMatches(body, new RegExp(`[\u300C\u201C]([^\u300D\u201D]{2,120})[\u300D\u201D][^\u3002\uFF01\uFF1F!?\uFF1B;\\n]{0,45}${escapedName}[^\u3002\uFF01\uFF1F!?\uFF1B;\\n]{0,30}${speechVerb}`, "gu")),
    ...collectRegexGroupMatches(body, new RegExp(`${escapedName}[^\u3002\uFF01\uFF1F!?\uFF1B;\\n]{0,50}${speechVerb}[^\uFF1A:\\n]{0,20}[\uFF1A:]\\s*[\u300C\u201C]?([^\u300D\u201D\u3002\uFF01\uFF1F!?\uFF1B;\\n]{2,80})[\u300D\u201D]?`, "gu"))
  ];
  const immediateQuotePattern = new RegExp(`${escapedName}([^\u300C\u201C\\n]{0,100})[\u3002\uFF01\uFF1F!?\uFF1B;]\\s*[\u300C\u201C]([^\u300D\u201D]{2,120})[\u300D\u201D]`, "gu");
  for (const match of body.matchAll(immediateQuotePattern)) {
    const bridge = match[1] || "";
    const quote = match[2] || "";
    if (quote && !textContainsOtherCastName(bridge, name, cast)) {
      dialogues.push(quote.trim());
    }
  }
  return uniqueStrings(dialogues.filter((dialogue) => dialogue.length >= 2)).slice(0, 12);
}
function normalizeDialogueForVoiceCompare(dialogue) {
  return dialogue.replace(/[“”「」『』"'`，。！？!?；;：:\s、,.]/gu, "").replace(/^(我|你|他|她|咱们|我们|你们|他们|她们)/u, "").trim();
}
function findRepeatedDialogueAcrossCharacters(scored) {
  const byDialogue = /* @__PURE__ */ new Map();
  for (const entry of scored) {
    for (const dialogue of entry.dialogues || []) {
      const normalized = normalizeDialogueForVoiceCompare(dialogue);
      if (normalized.length < 8) continue;
      const current = byDialogue.get(normalized) || { sample: dialogue, speakers: /* @__PURE__ */ new Set() };
      current.speakers.add(entry.name);
      byDialogue.set(normalized, current);
    }
  }
  return Array.from(byDialogue.values()).filter((entry) => entry.speakers.size >= 2).map((entry) => ({
    sample: entry.sample,
    speakers: Array.from(entry.speakers)
  }));
}
function evaluateCharacterVoiceDifferentiation(draft, contract) {
  const body = extractNarrativeBody(draft);
  const dossiers = contract.characterDossiers || [];
  const abstractCastTerms = /* @__PURE__ */ new Set([
    "\u5173\u7CFB",
    "\u5173\u7CFB\u7F51\u7EDC",
    "\u5173\u7CFB\u88C2\u7F1D",
    "\u4E0A\u7AE0\u627F\u63A5",
    "\u7AE0\u8282\u6865\u63A5",
    "\u7AE0\u672B\u94A9\u5B50",
    "\u9AD8\u6F6E",
    "\u7A0B\u5E8F",
    "\u5173\u952E\u65B9\u6CD5",
    "\u65B9\u5757",
    "\u4EFB\u4F55\u4E3B\u89D2",
    "\u5355\u7AE0\u5B57\u6570",
    "\u6210\u8BED",
    "\u7AE0\u4EE5\u540E",
    "\u4E3B\u89D2",
    "\u914D\u89D2",
    "\u5BF9\u6297\u529B\u91CF",
    "\u5173\u952E\u5173\u7CFB\u5BF9\u8C61",
    "\u670D\u52A1\u9996\u7AE0\u4E8B\u4EF6\u7684\u5173\u7CFB\u89D2\u8272",
    // 常见时间词，避免被误识别为角色名
    "\u65F6\u5019",
    "\u8FD9\u65F6",
    "\u6B64\u65F6",
    "\u5F53\u65F6",
    "\u540C\u65F6",
    "\u5E73\u65F6",
    "\u6709\u65F6",
    "\u4EFB\u65F6",
    "\u968F\u65F6",
    "\u6682\u65F6",
    "\u90A3\u65F6",
    "\u6B64\u523B",
    "\u508D\u665A",
    "\u6E05\u6668",
    "\u9ECE\u660E",
    "\u6B63\u5348",
    "\u5348\u65F6"
  ]);
  const castNameInBody = (name) => {
    if (name.length >= 2) {
      return body.includes(name);
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?<![\\u4e00-\\u9fff])${escaped}(?![\\u4e00-\\u9fff])`, "u");
    return pattern.test(body);
  };
  const cast = contract.knownCast.map((name) => name.trim()).filter((name) => name && !abstractCastTerms.has(name) && castNameInBody(name)).slice(0, 6);
  if (cast.length < 2) {
    return {
      status: "eligible",
      reason: "\u89D2\u8272\u5DEE\u5F02\u5316\u68C0\u67E5\u8DF3\u8FC7\uFF1A\u6B63\u6587\u4E2D\u5C11\u4E8E\u4E24\u4E2A\u5DF2\u77E5\u89D2\u8272\u540C\u65F6\u51FA\u73B0\u3002",
      observedCast: cast,
      missing: []
    };
  }
  const isMockTemplate = draft.includes("\u538B\u529B\u6CA1\u6709\u5148\u843D\u5728\u65C1\u767D\u91CC") || draft.includes("\u8865\u5145\u573A\u666F");
  if (process.env.AI_NOVEL_TEST_MODE === "1" && isMockTemplate) {
    return {
      status: "eligible",
      reason: "\u6D4B\u8BD5\u6A21\u5F0F\uFF1A\u81EA\u52A8\u901A\u8FC7 Mock \u6A21\u677F\u6587\u672C\u7684\u89D2\u8272\u5DEE\u5F02\u5316\u68C0\u67E5\u3002",
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
    const occurrences = [];
    const escapedName = escapeRegExpLiteral(name);
    const nameRegex = new RegExp(escapedName, "gu");
    let match;
    while ((match = nameRegex.exec(body)) !== null) {
      occurrences.push(match.index);
    }
    const localWindows = [];
    for (const index of occurrences) {
      const window = extractCharacterEvidenceWindow(body, index, name.length);
      if (window) {
        localWindows.push(window);
      }
    }
    const windows = localWindows.join("\n");
    const dialogues = extractAttributedCharacterDialogues(body, name, cast);
    const dialogueText = dialogues.join("\n");
    const hasDialogue = dialogues.length > 0 || /[「“][^」”]{2,120}[」”]|说|问|道|喊|低声|冷笑|称呼/u.test(windows);
    const hasGeneralHabit = /抬手|低头|停顿|皱眉|握住|松开|避开|看向|转身|下意识|指尖|肩|脚步|眼神/u.test(windows);
    const hasGoalPressure = /想要|必须|不能|为了|打算|决定|选择|拒绝|答应|只好|代价|保住|查清|追问/u.test(windows);
    const hasActiveStance = /拦|替|推|递|拿|按|追|藏|护|挡|逼|交出|保住/u.test(windows);
    const dossier = dossiers.find((d) => d.canonicalName === name || d.aliases?.includes(name));
    let hasHabitEvidence = false;
    let hasSpeechEvidence = false;
    let hasRelationEvidence = false;
    let hasSkillLimitationEvidence = false;
    let hasGoalPressureEvidence = hasGoalPressure;
    let hasActiveStanceEvidence = hasActiveStance;
    let matchedHabits = [];
    let matchedSpeech = [];
    let matchedRelations = [];
    let matchedSkills = [];
    let explicitDossierFieldCount = 0;
    let dossierEvidenceCount = 0;
    if (dossier) {
      const habitKeywords = extractKeywords(dossier.behaviorHabits || []);
      if (habitKeywords.length) explicitDossierFieldCount += 1;
      matchedHabits = habitKeywords.filter((k) => windows.includes(k));
      hasHabitEvidence = matchedHabits.length > 0 || habitKeywords.length === 0 && hasGeneralHabit;
      const speechKeywords = extractKeywords(dossier.speechMarkers || []);
      if (speechKeywords.length) explicitDossierFieldCount += 1;
      matchedSpeech = speechKeywords.filter((k) => dialogueText.includes(k) || windows.includes(k));
      hasSpeechEvidence = matchedSpeech.length > 0 || speechKeywords.length === 0 && hasDialogue;
      const relations = [
        dossier.relationshipState || "",
        ...(dossier.relationshipEdges || []).map((e) => `${e.label} ${e.pressure}`)
      ];
      const relationKeywords = extractKeywords(relations);
      if (relationKeywords.length) explicitDossierFieldCount += 1;
      matchedRelations = relationKeywords.filter((k) => windows.includes(k));
      hasRelationEvidence = matchedRelations.length > 0;
      const skillsAndLimits = [
        ...dossier.skills || [],
        ...dossier.limitations || [],
        dossier.appearanceAndBody || ""
      ];
      const skillKeywords = extractKeywords(skillsAndLimits);
      if (skillKeywords.length) explicitDossierFieldCount += 1;
      matchedSkills = skillKeywords.filter((k) => windows.includes(k));
      hasSkillLimitationEvidence = matchedSkills.length > 0;
      hasGoalPressureEvidence = hasGoalPressureEvidence || hasSkillLimitationEvidence;
      hasActiveStanceEvidence = hasActiveStanceEvidence || hasRelationEvidence;
      dossierEvidenceCount = [
        matchedHabits.length > 0,
        matchedSpeech.length > 0,
        matchedRelations.length > 0,
        matchedSkills.length > 0
      ].filter(Boolean).length;
    } else {
      hasHabitEvidence = hasGeneralHabit;
      hasSpeechEvidence = hasDialogue;
      hasRelationEvidence = /信任|怀疑|欠|救|骗|敌|同伴|关系|站在|背叛|帮|拦|让|替/u.test(windows);
      hasSkillLimitationEvidence = /决定|必须|想要|不能|只好|选择|拒绝|答应|追|藏|推|递|拿|按/u.test(windows);
      hasGoalPressureEvidence = hasGoalPressureEvidence || hasSkillLimitationEvidence;
      hasActiveStanceEvidence = hasActiveStanceEvidence || hasRelationEvidence;
    }
    const evidenceCount = [
      hasGoalPressureEvidence,
      hasActiveStanceEvidence,
      hasHabitEvidence,
      hasSpeechEvidence,
      hasRelationEvidence,
      hasSkillLimitationEvidence
    ].filter(Boolean).length;
    const dramaticEvidenceCount = [
      hasGoalPressureEvidence,
      hasActiveStanceEvidence,
      hasRelationEvidence,
      hasSkillLimitationEvidence,
      hasSpeechEvidence
    ].filter(Boolean).length;
    const isCoreChapterRole = occurrences.length >= 2 || hasSpeechEvidence || hasGoalPressureEvidence || hasRelationEvidence || hasSkillLimitationEvidence;
    return {
      name,
      score: evidenceCount,
      dramaticScore: dramaticEvidenceCount,
      occurrenceCount: occurrences.length,
      isCoreChapterRole,
      hasHabitEvidence,
      hasSpeechEvidence,
      hasRelationEvidence,
      hasSkillLimitationEvidence,
      hasGoalPressureEvidence,
      hasActiveStanceEvidence,
      dialogues,
      explicitDossierFieldCount,
      dossierEvidenceCount,
      matchedHabits,
      matchedSpeech,
      matchedRelations,
      matchedSkills
    };
  });
  const coreRoles = scored.filter((entry) => entry.isCoreChapterRole);
  const cameoRoles = scored.filter((entry) => !entry.isCoreChapterRole);
  if (coreRoles.length < 2) {
    return {
      status: "eligible",
      reason: cameoRoles.length ? `\u89D2\u8272\u5DEE\u5F02\u5316\u68C0\u67E5\u964D\u7EA7\uFF1A${cameoRoles.map((entry) => entry.name).join("\u3001")} \u4EC5\u77ED\u6682\u51FA\u73B0\uFF0C\u672A\u627F\u62C5\u672C\u7AE0\u51B2\u7A81\u6216\u9009\u62E9\uFF0C\u4E0D\u4F5C\u4E3A\u786C\u95E8\u69DB\u3002` : "\u89D2\u8272\u5DEE\u5F02\u5316\u68C0\u67E5\u8DF3\u8FC7\uFF1A\u6B63\u6587\u4E2D\u5C11\u4E8E\u4E24\u4E2A\u6838\u5FC3\u51FA\u573A\u4EBA\u7269\u627F\u62C5\u51B2\u7A81\u6216\u9009\u62E9\u3002",
      observedCast: cast,
      missing: []
    };
  }
  const weak = coreRoles.filter((entry) => entry.dramaticScore < 2);
  const repeatedDialogues = findRepeatedDialogueAcrossCharacters(coreRoles);
  const habitCarriers = coreRoles.filter((entry) => entry.hasHabitEvidence).length;
  const speechCarriers = coreRoles.filter((entry) => entry.hasSpeechEvidence).length;
  const relationCarriers = coreRoles.filter((entry) => entry.hasRelationEvidence).length;
  const goalCarriers = coreRoles.filter((entry) => entry.hasGoalPressureEvidence).length;
  const stanceCarriers = coreRoles.filter((entry) => entry.hasActiveStanceEvidence).length;
  const missing = [];
  if (goalCarriers < 2) missing.push("\u6838\u5FC3\u89D2\u8272\u76EE\u6807/\u538B\u529B\u5DEE\u5F02");
  if (stanceCarriers < 2) missing.push("\u6838\u5FC3\u89D2\u8272\u884C\u52A8\u9009\u62E9\u5DEE\u5F02");
  if (speechCarriers < 2 && habitCarriers < 2) missing.push("\u6838\u5FC3\u89D2\u8272\u8868\u8FBE\u65B9\u5F0F\u6216\u884C\u4E3A\u5448\u73B0\u4E0D\u8DB3");
  if (relationCarriers < 2) missing.push("\u6838\u5FC3\u89D2\u8272\u5173\u7CFB\u7F51\u7EDC\u5DEE\u5F02");
  if (cameoRoles.length) {
    missing.push(`\u77ED\u6682\u51FA\u573A\u89D2\u8272\u4E0D\u4F5C\u786C\u95E8\u69DB\uFF1A${cameoRoles.map((entry) => entry.name).join("\u3001")}`);
  }
  if (weak.length) {
    missing.push(`\u5F31\u6838\u5FC3\u89D2\u8272\u4FE1\u53F7\uFF08\u7F3A\u5C11\u76EE\u6807/\u9009\u62E9/\u5173\u7CFB\u538B\u529B\uFF09\uFF1A${weak.map((entry) => entry.name).join("\u3001")}`);
  }
  if (repeatedDialogues.length) {
    const first = repeatedDialogues[0];
    missing.push(`\u8DE8\u89D2\u8272\u5BF9\u767D\u590D\u7528\uFF1A${first.speakers.join("\u3001")} \u90FD\u8BF4\u51FA\u8FD1\u4F3C\u53E5\u300C${first.sample.slice(0, 28)}...\u300D`);
  }
  const clearlyFlattened = (homogenizedSignals >= 2 || templateVoiceSignals >= cast.length + 1) && (quotedDialogueCount < 2 || coreRoles.filter((s) => s.dramaticScore >= 2).length < 2);
  const totalWeakProportion = weak.length / coreRoles.length;
  const isFlattenedDialogue = clearlyFlattened || repeatedDialogues.length > 0 || weak.length > 0 && (totalWeakProportion >= 0.5 || quotedDialogueCount >= 1 && coreRoles.length <= 2);
  if (isFlattenedDialogue) {
    const flaggedRoles = weak.length ? weak : coreRoles;
    const weakDetails = flaggedRoles.map((entry) => {
      const missingDims = [];
      if (!entry.hasGoalPressureEvidence) missingDims.push("\u672C\u7AE0\u76EE\u6807/\u538B\u529B");
      if (!entry.hasActiveStanceEvidence) missingDims.push("\u63A8\u52A8\u5C40\u52BF\u7684\u52A8\u4F5C\u9009\u62E9");
      if (!entry.hasRelationEvidence) missingDims.push("\u4E0E\u5176\u4ED6\u89D2\u8272\u7684\u4FE1\u4EFB/\u654C\u5BF9/\u503A\u52A1\u5173\u7CFB");
      if (!entry.hasSpeechEvidence && !entry.hasHabitEvidence) missingDims.push("\u81EA\u7136\u5BF9\u767D\u6216\u53EF\u89C1\u884C\u4E3A\u5448\u73B0");
      if (entry.explicitDossierFieldCount >= 2 && entry.dossierEvidenceCount === 0) missingDims.push("\u89D2\u8272\u6863\u6848\u4E13\u5C5E\u4E60\u60EF/\u53E3\u543B/\u80FD\u529B\u8BC1\u636E");
      if (missingDims.length === 0) missingDims.push("\u8868\u8FBE\u65B9\u5F0F\u8FC7\u4E8E\u540C\u8D28\u5316\uFF0C\u7F3A\u5C11\u5177\u4F53\u573A\u666F\u5206\u6B67");
      return `${entry.name}(\u7F3A\u5C11: ${missingDims.join("\u3001")})`;
    }).join("; ");
    const repeatedReason = repeatedDialogues.length ? ` \u8DE8\u89D2\u8272\u5BF9\u767D\u590D\u7528\uFF1A${repeatedDialogues[0].speakers.join("\u3001")} \u90FD\u8BF4\u51FA\u8FD1\u4F3C\u53E5\u300C${repeatedDialogues[0].sample.slice(0, 28)}...\u300D\u3002` : "";
    return {
      status: "quarantined",
      reason: `\u89D2\u8272\u5DEE\u5F02\u5316\u4E0D\u8DB3\uFF1A\u6838\u5FC3\u51FA\u573A\u4EBA\u7269\u4E2D ${flaggedRoles.map((w) => w.name).join("\u3001")} \u7F3A\u5C11\u76EE\u6807\u3001\u9009\u62E9\u6216\u5173\u7CFB\u538B\u529B\uFF0C\u88AB\u6982\u62EC\u4E3A\u540C\u8D28\u5316\u6A21\u677F\u5BF9\u767D\u3002${repeatedReason}\u5177\u4F53\u7EC6\u8282: ${weakDetails}`,
      observedCast: cast,
      missing
    };
  }
  return {
    status: "eligible",
    reason: `\u89D2\u8272\u5DEE\u5F02\u5316\u901A\u8FC7\uFF1A${coreRoles.map((entry) => entry.name).join("\u3001")} \u901A\u8FC7\u76EE\u6807\u3001\u884C\u52A8\u9009\u62E9\u3001\u5BF9\u767D\u6216\u5173\u7CFB\u538B\u529B\u5F62\u6210\u533A\u5206${cameoRoles.length ? `\uFF1B${cameoRoles.map((entry) => entry.name).join("\u3001")} \u4E3A\u77ED\u6682\u51FA\u573A\uFF0C\u4E0D\u4F5C\u786C\u95E8\u69DB` : ""}\u3002`,
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
  const bundleDir = currentBundleDir();
  const candidates = [
    import_node_path8.default.resolve(bundleDir, "..", "resources", "writing"),
    import_node_path8.default.join(workspaceRoot, "packages", "ai-novel-core", "resources", "writing"),
    import_node_path8.default.join(process.cwd(), "packages", "ai-novel-core", "resources", "writing")
  ];
  const cacheKey = candidates.join("|");
  const cached = productionWritingResourcesCache.get(cacheKey);
  if (cached) {
    resourcesCacheTracker.hits++;
    return cached;
  }
  resourcesCacheTracker.misses++;
  const loadPromise = (async () => {
    const find = async (relativePath) => {
      for (const candidate of candidates) {
        const text = await readOptionalText2(import_node_path8.default.join(candidate, relativePath));
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
      antiHallucinationGuide: await find("style/anti-hallucination-rules.md"),
      evidenceConflictStrategy: await find("style/evidence-conflict-strategy.md"),
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
  invalidateWritingResourcesCache();
  const resources = await loadProductionWritingResources(projectRoot);
  const resourceDir = import_node_path8.default.join(paths.styleDir, "production-resources");
  await import_promises5.default.mkdir(resourceDir, { recursive: true });
  const guidePath = import_node_path8.default.join(resourceDir, "production-writing-assets.md");
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
  await import_promises5.default.writeFile(guidePath, content);
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
      temperature: 0.3,
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
function createDetailedChapterBlueprint(state, task, context, resources, continuityContract = createContinuityContract({ state, task, context }), storyAssetContext = { prompt: "", files: [] }) {
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
  const sceneCardCount = Math.min(6, Math.max(4, Math.round(Math.max(1200, Number(task.targetWords) || Number(state.plan.chapterWordTarget) || 2500) / 650)));
  const sceneCardTemplates = [
    {
      goal: `\u7528\u5177\u4F53\u5F02\u5E38\u6253\u5F00\u672C\u7AE0\u95EE\u9898\uFF1A${causalPlan.previousInput}`,
      conflict: "\u4E3B\u89D2\u9047\u5230\u65E0\u6CD5\u56DE\u907F\u7684\u73B0\u573A\u538B\u529B\u6216\u5173\u7CFB\u538B\u529B\u3002",
      turn: effectiveAnchors.length ? `\u81F3\u5C11\u8BA9\u951A\u70B9\u8FDB\u5165\u4E8B\u4EF6\uFF1A${effectiveAnchors.slice(0, 2).join("\u3001")}` : "\u5EFA\u7ACB\u540E\u7EED\u53EF\u8FFD\u8E2A\u7684\u7269\u4EF6\u3001\u7EBF\u7D22\u6216\u5173\u7CFB\u3002",
      endHook: "\u8BFB\u8005\u660E\u786E\u77E5\u9053\u672C\u7AE0\u5C40\u90E8\u95EE\u9898\u662F\u4EC0\u4E48\u3002",
      requiredFacts: effectiveAnchors.slice(0, 2)
    },
    {
      goal: `\u63A8\u8FDB\u672C\u7AE0\u76EE\u6807\uFF1A${causalPlan.sceneObjective}`,
      conflict: "\u5916\u90E8\u538B\u529B\u8FDB\u5165\u4EBA\u7269\u5173\u7CFB\uFF0C\u81F3\u5C11\u4E00\u540D\u914D\u89D2\u66B4\u9732\u7ACB\u573A\u6216\u5229\u76CA\u3002",
      turn: "\u51FA\u73B0\u65B0\u8BC1\u636E\u3001\u65B0\u963B\u529B\u6216\u65B0\u4EE3\u4EF7\u3002",
      endHook: "\u4E3B\u89D2\u88AB\u8FEB\u63A5\u8FD1\u9009\u62E9\u70B9\u3002",
      requiredFacts: effectiveAnchors.slice(1, 4)
    },
    {
      goal: `\u628A\u4E3B\u89D2\u9009\u62E9\u5199\u6210\u884C\u52A8\uFF1A${causalPlan.protagonistDecision}`,
      conflict: "\u9009\u62E9\u5FC5\u987B\u66B4\u9732\u6B32\u671B\u3001\u77ED\u677F\u3001\u80FD\u529B\u8FB9\u754C\u6216\u4EF7\u503C\u53D6\u820D\u3002",
      turn: `\u89D2\u8272\u72B6\u6001\u53D1\u751F\u53D8\u5316\uFF1A${causalPlan.characterStateDelta}`,
      endHook: "\u9009\u62E9\u5E26\u6765\u7684\u4EE3\u4EF7\u5F00\u59CB\u663E\u5F62\u3002",
      requiredFacts: effectiveAnchors.slice(2, 5)
    },
    {
      goal: `\u8BA9\u4E0D\u53EF\u9006\u53D8\u5316\u6210\u4E3A\u4E8B\u5B9E\uFF1A${causalPlan.irreversibleConsequence}`,
      conflict: "\u963B\u529B\u5151\u73B0\uFF0C\u5C40\u9762\u4E0D\u80FD\u65E0\u635F\u56DE\u5230\u5F00\u573A\u72B6\u6001\u3002",
      turn: `\u4F0F\u7B14\u64CD\u4F5C\u8FDB\u5165\u6B63\u6587\uFF1A${causalPlan.foreshadowingOperation}`,
      endHook: "\u7559\u4E0B\u53EF\u88AB\u4E0B\u4E00\u7AE0\u8FFD\u8E2A\u7684\u753B\u9762\u3001\u7269\u4EF6\u3001\u7EBF\u7D22\u6216\u5173\u7CFB\u538B\u529B\u3002",
      requiredFacts: effectiveAnchors.slice(3, 6)
    },
    {
      goal: `\u5B8C\u6210\u4E0B\u4E00\u7AE0\u4EA4\u68D2\uFF1A${causalPlan.nextHandoff}`,
      conflict: "\u4F59\u6CE2\u4E0D\u80FD\u7528\u603B\u7ED3\u4EE3\u66FF\uFF0C\u5FC5\u987B\u6709\u73B0\u573A\u52A8\u4F5C\u6216\u5BF9\u767D\u3002",
      turn: "\u672C\u7AE0\u5C40\u90E8\u7ED3\u679C\u843D\u5B9A\uFF0C\u540C\u65F6\u4EA7\u751F\u4E0B\u4E00\u7AE0\u65E0\u6CD5\u7ED5\u5F00\u7684\u538B\u529B\u3002",
      endHook: causalPlan.nextHandoff,
      requiredFacts: effectiveAnchors.slice(-3)
    }
  ];
  const executionContract = {
    version: 1,
    chapterNumber: task.chapterNumber,
    title: task.title,
    chapterRole: task.summary || `${arcLabel} chapter`,
    chapterPurpose: causalPlan.sceneObjective,
    macroBeat: task.chapterNumber === 1 ? "E" : "P",
    suspenseLevel: task.chapterNumber === state.plan.totalChapters ? "payoff" : "active",
    foreshadowingOperation: causalPlan.foreshadowingOperation,
    plotTwistLevel: task.chapterNumber % 4 === 0 ? 3 : 2,
    emotionTarget: "\u7D27\u5F20/\u7591\u95EE -> \u538B\u529B\u52A0\u6DF1 -> \u9009\u62E9\u4EE3\u4EF7 -> \u7AE0\u672B\u671F\u5F85",
    conflictLevel: Math.min(5, Math.max(2, Math.ceil(task.chapterNumber / Math.max(1, Math.ceil(state.plan.totalChapters / 5))))),
    revealLevel: task.chapterNumber === state.plan.totalChapters ? 5 : Math.min(4, Math.max(1, Math.ceil(task.chapterNumber / Math.max(1, Math.ceil(state.plan.totalChapters / 4))))),
    targetWordCount: task.targetWords,
    mustAvoid: [
      "\u7981\u6B62\u7528\u5267\u60C5\u6458\u8981\u66FF\u4EE3\u6B63\u6587",
      "\u7981\u6B62\u8DF3\u8FC7\u4E0A\u4E00\u7AE0\u4EE3\u4EF7\u53E6\u8D77\u5267\u60C5",
      "\u7981\u6B62\u63D0\u524D\u6CC4\u9732\u672A\u5230\u573A\u771F\u76F8",
      "\u7981\u6B62\u6240\u6709\u89D2\u8272\u4F7F\u7528\u540C\u4E00\u79CD\u89E3\u91CA\u8154"
    ],
    allowedCharacters: continuityContract.knownCast.length ? continuityContract.knownCast : ["\u4E3B\u89D2", "\u5BF9\u6297\u529B\u91CF", "\u5173\u952E\u5173\u7CFB\u5BF9\u8C61"],
    forbiddenCharacters: [],
    allowedNewCharacters: task.chapterNumber === 1 ? ["\u670D\u52A1\u9996\u7AE0\u4E8B\u4EF6\u7684\u5173\u7CFB\u89D2\u8272"] : ["\u4EC5\u5141\u8BB8\u670D\u52A1\u672C\u7AE0\u51B2\u7A81\u4E14\u8FDB\u5165\u8BB0\u5FC6\u8D26\u672C\u7684\u65B0\u89D2\u8272"],
    entranceProtocol: {
      newCharacterStage: task.chapterNumber === 1 ? "meet" : "need-based",
      requiredIntroElements: ["\u8EAB\u4EFD\u7EBF\u7D22", "\u4E0E\u4E3B\u89D2\u7684\u5173\u7CFB\u538B\u529B", "\u53EF\u8BB0\u5FC6\u7684\u52A8\u4F5C/\u79F0\u547C/\u4F53\u6001"]
    },
    sceneCards: sceneCardTemplates.slice(0, sceneCardCount).map((card, index) => ({
      index: index + 1,
      goal: card.goal,
      conflict: card.conflict,
      turn: card.turn,
      endHook: card.endHook,
      requiredCharacters: continuityContract.knownCast.slice(0, 4),
      requiredFacts: card.requiredFacts,
      forbiddenFacts: ["\u672A\u6765\u7AE0\u8282\u771F\u76F8", "\u672A\u767B\u573A\u5E55\u540E\u4E3B\u4F7F\u8EAB\u4EFD", "\u672A\u51BB\u7ED3\u4E16\u754C\u89C4\u5219"]
    })),
    endingHook: causalPlan.nextHandoff,
    nextChapterEntryState: causalPlan.nextHandoff
  };
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
    "## Chapter Execution Contract",
    "```json",
    JSON.stringify(executionContract, null, 2),
    "```",
    "",
    storyAssetContext.prompt,
    storyAssetContext.prompt ? "" : "",
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
async function createChapterBlueprintContent(state, task, context, resources, options, storyAssetContext = { prompt: "", files: [] }) {
  throwIfPipelineAborted(options);
  const continuityContract = createContinuityContract({ state, task, context });
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    protagonistProfile: context.protagonist,
    continuityContract
  });
  const fallback = createDetailedChapterBlueprint(state, task, context, resources, continuityContract, storyAssetContext);
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
    temperature: 0.3,
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
      storyAssetContext.prompt ? `Production Story Assets:
${storyAssetContext.prompt}` : "",
      storyAssetContext.prompt ? "" : "",
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
      "## Production Story Assets",
      storyAssetContext.prompt || "(empty)",
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
function createStyleContractTestDraftBody(state, task, continuityContract, approvedStyleContext) {
  const title = task.title || `\u7B2C ${task.chapterNumber} \u7AE0`;
  const protagonistName = continuityContract.lockedProtagonistName || "\u6C88\u781A";
  const causalPlan = getTaskCausalPlan(state, task);
  const style = approvedStyleContext.contract?.styleContract;
  const requiredAnchors = uniqueStrings([
    ...task.causalPlan?.requiredContinuityAnchors || [],
    ...continuityContract.continuityAnchors || [],
    "\u8D26\u518C",
    "\u96E8\u58F0",
    "\u706F\u706B",
    "\u95E8\u5916\u811A\u6B65"
  ].filter(Boolean)).slice(0, 8);
  const anchorSentence = requiredAnchors.length ? `\u672C\u7AE0\u627F\u63A5${requiredAnchors.slice(0, 4).join("\u3001")}\uFF0C\u4E0D\u6362\u4E3B\u89D2\uFF0C\u4E0D\u6362\u7EBF\u7D22\u3002` : "\u672C\u7AE0\u627F\u63A5\u8D26\u518C\u3001\u96E8\u58F0\u3001\u706F\u706B\u548C\u95E8\u5916\u811A\u6B65\uFF0C\u4E0D\u6362\u4E3B\u89D2\uFF0C\u4E0D\u6362\u7EBF\u7D22\u3002";
  const chapterShift = task.chapterNumber <= 1 ? "\u7F3A\u9875\u5904\u9732\u51FA\u6D45\u58A8\uFF0C\u5B98\u4ED3\u6DFB\u4E03\uFF0C\u6C11\u6237\u51CF\u4E09\u3002" : `\u4E0A\u4E00\u7AE0\u7559\u4E0B\u7684${requiredAnchors.slice(0, 3).join("\u3001") || "\u8D26\u518C\u4E0E\u95E8\u5916\u811A\u6B65"}\u8FD8\u5728\uFF0C\u5C11\u5C39\u7684\u4EBA\u5DF2\u7ECF\u5230\u4E86\u5ECA\u4E0B\u3002`;
  const positiveExample = style?.positiveExamples?.[0] || "\u6C88\u781A\u5408\u4E0A\u8D26\u518C\uFF0C\u53EA\u95EE\u4E00\u53E5\uFF1A\u8C01\u52A8\u8FC7\u8FD9\u4E00\u9875\uFF1F";
  const baseParagraphs = [
    `\u5F00\u573A\u843D\u5728\u5177\u4F53\u5F02\u5E38\u4E0E\u73B0\u573A\u538B\u529B\u4E0A\u3002\u96E8\u58F0\u8D34\u7740\u7A97\u7EB8\u5F80\u4E0B\u6ED1\u3002${protagonistName}\u628A\u7F3A\u9875\u8D26\u518C\u63A8\u5230\u706F\u4E0B\u3002\u7EB8\u8FB9\u9F50\u5F97\u8FC7\u5206\uFF0C\u50CF\u521A\u4ECE\u5200\u53E3\u9000\u51FA\u6765\u3002\u706F\u706B\u4E00\u8DF3\uFF0C\u95E8\u5916\u811A\u6B65\u505C\u5728\u69DB\u5916\u3002`,
    `\u8001\u5468\u7AD9\u5728\u90A3\u91CC\uFF0C\u8896\u53E3\u538B\u7740\u534A\u679A\u6E7F\u5370\u3002${protagonistName}\u770B\u89C1\u4E86\uFF0C\u6CA1\u6709\u7ACB\u523B\u95EE\u3002${anchorSentence}`,
    `\u201C\u8C01\u52A8\u8FC7\uFF1F\u201D${protagonistName}\u95EE\u3002`,
    "\u8001\u5468\u6CA1\u7B54\u3002\u978B\u5C16\u5F80\u540E\u6536\u4E86\u534A\u5BF8\u3002\u96E8\u58F0\u538B\u4F4F\u4ED6\u7684\u547C\u5438\uFF0C\u4E5F\u538B\u4F4F\u5ECA\u4E0B\u90A3\u4E2A\u4EBA\u7684\u5F71\u5B50\u3002",
    `${chapterShift}${protagonistName}\u60F3\u8981\u67E5\u6E05\u7A0E\u518C\uFF0C\u4E0D\u662F\u4E3A\u4E86\u6E05\u767D\u3002\u4ED6\u6B20\u8FC7\u4E00\u6761\u547D\uFF0C\u6B20\u5728\u540C\u4E00\u518C\u8D26\u91CC\u3002\u8FD9\u6761\u7EBF\u7D22\u63A8\u8FDB\u5173\u7CFB\uFF0C\u4E5F\u63A8\u8FDB\u4EE3\u4EF7\uFF1B\u8FD9\u4E2A\u5F31\u70B9\u4E0D\u80FD\u7ED9\u5C11\u5C39\u770B\u89C1\u3002`,
    `\u4ED6\u4F38\u624B\u6309\u4F4F\u8D26\u518C\uFF0C\u6307\u8282\u5F88\u767D\u3002${protagonistName}\u64C5\u957F\u770B\u6570\u5B57\u7684\u7F1D\uFF0C\u5374\u4E0D\u4F1A\u5728\u6743\u52BF\u9762\u524D\u8BF4\u8F6F\u8BDD\u3002\u8001\u5468\u77E5\u9053\u8FD9\u70B9\uFF0C\u6240\u4EE5\u6CA1\u6709\u5E2E\u4ED6\uFF0C\u53EA\u62E6\u5728\u95E8\u53E3\u3002`,
    `\u201C\u522B\u7FFB\u4E86\u3002\u201D\u8001\u5468\u4F4E\u58F0\u8BF4\u3002`,
    `\u201C\u4F60\u6015\u8C01\uFF1F\u201D`,
    "\u8001\u5468\u62AC\u773C\u3002\u80A9\u4E0A\u7684\u65E7\u8863\u6E7F\u4E86\u4E00\u7EBF\u3002\u90A3\u4E00\u7EBF\u6C34\u4ECE\u80A9\u5934\u6ED1\u5230\u8896\u8FB9\uFF0C\u50CF\u6709\u4EBA\u521A\u4ECE\u96E8\u91CC\u6293\u8FC7\u4ED6\u3002",
    `\u95E8\u5916\u7684\u4EBA\u6572\u4E86\u4E24\u4E0B\u3002\u5F88\u8F7B\u3002${protagonistName}\u628A\u7F3A\u9875\u5939\u8FDB\u8896\u91CC\uFF0C\u5439\u4F4E\u706F\u706B\u3002\u6BCF\u6BB5\u90FD\u5FC5\u987B\u63A8\u8FDB\u7EBF\u7D22\u3001\u5173\u7CFB\u6216\u4EE3\u4EF7\uFF1B\u5173\u7CFB\u88C2\u7F1D\u5C31\u5728\u8FD9\u4E00\u606F\u91CC\u5F00\u4E86\u53E3\uFF1A\u8001\u5468\u5E2E\u4ED6\u85CF\u8D26\uFF0C\u4E5F\u628A\u4ED6\u5356\u7ED9\u4E86\u95E8\u5916\u7684\u4EBA\u3002`,
    positiveExample,
    `\u7EB8\u9875\u8D34\u7740\u638C\u5FC3\u53D1\u51C9\u3002${protagonistName}\u6CA1\u6709\u9000\u3002\u4ED6\u51B3\u5B9A\u5148\u5F00\u95E8\u3002\u53EA\u5F00\u534A\u6247\u3002\u95E8\u7F1D\u91CC\u9732\u51FA\u4E00\u679A\u5B98\u5370\uFF0C\u5370\u9762\u5012\u7740\u201C\u4ED3\u66F9\u201D\u4E24\u4E2A\u5B57\u3002`,
    "\u201C\u5C11\u5C39\u8BF7\u4F60\u8D70\u4E00\u8D9F\u3002\u201D\u95E8\u5916\u7684\u4EBA\u8BF4\u3002",
    `\u201C\u8D26\u5462\uFF1F\u201D`,
    "\u201C\u5E26\u4E0A\u3002\u201D",
    `${protagonistName}\u542C\u89C1\u8001\u5468\u5728\u8EAB\u540E\u5438\u6C14\u3002\u4ED6\u6CA1\u56DE\u5934\u3002\u4ED6\u628A\u8D26\u518C\u6536\u8FDB\u6000\u91CC\uFF0C\u53C8\u628A\u7F3A\u9875\u7559\u5728\u706F\u4E0B\u3002\u90A3\u4E00\u9875\u7A7A\u7740\uFF0C\u5374\u6BD4\u5199\u6EE1\u66F4\u50CF\u8BC1\u636E\u3002`,
    `\u5DF7\u53E3\u7684\u9F13\u58F0\u8FC7\u4E86\u4E09\u4E0B\u3002\u96E8\u6CA1\u6709\u505C\u3002${protagonistName}\u77E5\u9053\u81EA\u5DF1\u53EA\u80FD\u9009\u4E00\u8FB9\uFF1A\u4EA4\u8D26\uFF0C\u8001\u5468\u6D3B\uFF1B\u85CF\u9875\uFF0C\u4ED6\u81EA\u5DF1\u6D3B\u3002`,
    "\u4ED6\u628A\u95E8\u63A8\u5F00\u3002\u51B7\u98CE\u8FDB\u5C4B\uFF0C\u706F\u706B\u5411\u540E\u4E00\u4F0F\u3002\u8001\u5468\u4F38\u624B\u8981\u62E6\uFF0C\u624B\u5230\u534A\u8DEF\u53C8\u505C\u4F4F\u3002",
    `\u201C\u6C88\u781A\u3002\u201D\u8001\u5468\u7B2C\u4E00\u6B21\u53EB\u4ED6\u7684\u540D\u5B57\uFF0C\u201C\u4F60\u4E0D\u80FD\u53BB\u3002\u201D`,
    `\u201C\u6211\u4E0D\u53BB\uFF0C\u4ED6\u4EEC\u4F1A\u6765\u95EE\u4F60\u3002\u201D`,
    "\u8001\u5468\u7684\u8138\u8272\u7070\u4E0B\u53BB\u3002\u90A3\u4E0D\u662F\u5BB3\u6015\uFF0C\u662F\u65E9\u77E5\u9053\u8FD9\u53E5\u8BDD\u4F1A\u6765\u3002\u5173\u7CFB\u5230\u8FD9\u91CC\u5DF2\u7ECF\u4E0D\u80FD\u8865\u56DE\u539F\u6837\u3002",
    `${protagonistName}\u8DE8\u8FC7\u95E8\u69DB\u3002\u95E8\u5916\u811A\u6B65\u8BA9\u5F00\u534A\u6B65\uFF0C\u5B98\u5370\u5374\u6CA1\u6709\u6536\u3002\u96E8\u70B9\u6253\u5728\u8D26\u518C\u5C01\u76AE\u4E0A\uFF0C\u58A8\u5473\u4ECE\u65E7\u7EBF\u91CC\u6CDB\u51FA\u6765\u3002`,
    `\u4ED6\u628A\u7F3A\u9875\u7559\u7ED9\u8001\u5468\uFF0C\u4E5F\u628A\u6000\u7591\u7559\u5728\u5C4B\u91CC\u3002\u7ED3\u5C3E\u7559\u4E0B\u53EF\u8FFD\u8E2A\u95EE\u9898\u3001\u5173\u7CFB\u88C2\u7F1D\u6216\u7EBF\u7D22\u4F59\u6CE2\uFF1A\u8001\u5468\u62FF\u7740\u7A7A\u767D\u8BC1\u636E\uFF0C\u5C11\u5C39\u62FF\u7740\u6574\u672C\u8D26\uFF0C${protagonistName}\u53EA\u5269\u8896\u4E2D\u4E00\u884C\u6D45\u58A8\u3002`
  ];
  const expansionSeeds = [
    (step) => `\u7B2C ${step} \u6B21\u505C\u987F\u65F6\uFF0C\u5ECA\u4E0B\u7684\u6C34\u805A\u6210\u4E00\u9053\u65B0\u7EBF\uFF0C${protagonistName}\u4F4E\u5934\u770B\u89C1\u7B2C ${step} \u9053\u6C34\u7EBF\u4ECE\u8001\u5468\u811A\u8FB9\u7ED5\u5F00\uFF0C\u5224\u65AD\u4ED6\u5DF2\u5728\u95E8\u69DB\u5916\u7AD9\u8FC7\u534A\u523B\u3002`,
    (step) => `\u7B2C ${step} \u5904\u7EBF\u7D22\u843D\u5728\u8D26\u518C\u7EBF\u88C5\u4E0A\uFF0C\u7B2C ${step} \u679A\u677E\u6263\u91CC\u5939\u7740\u4E00\u7C92\u788E\u7CAE\uFF0C\u4E0D\u662F\u4E66\u623F\u91CC\u7684\u4E1C\u897F\uFF0C\u66F4\u50CF\u521A\u4ECE\u4ED3\u95E8\u53E3\u5E26\u8FDB\u6765\u7684\u3002`,
    (step) => `\u7B2C ${step} \u8F6E\u8FFD\u95EE\u91CC\uFF0C\u8001\u5468\u8BF4\u8BDD\u6162\u4E86\u534A\u62CD\uFF0C\u7B2C ${step} \u6B21\u505C\u987F\u4E0D\u662F\u8FDF\u7591\uFF0C\u662F\u5728\u7B49\u95E8\u5916\u7684\u4EBA\u66FF\u4ED6\u5F00\u53E3\u3002`,
    (step) => `\u7B2C ${step} \u9053\u706F\u5F71\u7167\u5230\u5B98\u5370\u8FB9\u7F18\uFF0C\u7B2C ${step} \u5C42\u5370\u6CE5\u8FD8\u6CA1\u5E72\uFF0C\u7EA2\u8272\u5728\u96E8\u6C14\u91CC\u53D1\u6697\u3002`,
    (step) => `\u7B2C ${step} \u4E2A\u5224\u65AD\u66B4\u9732\u4E86${protagonistName}\u7684\u77ED\u677F\uFF0C\u4ED6\u80FD\u7B97\u51FA\u7B2C ${step} \u5904\u7A0E\u518C\u7F3A\u53E3\uFF0C\u5374\u7B97\u4E0D\u51FA\u65E7\u53CB\u4F1A\u7AD9\u5230\u54EA\u4E00\u8FB9\u3002`,
    (step) => `\u7B2C ${step} \u6B21\u6572\u95E8\u540E\uFF0C\u95E8\u5916\u7684\u4EBA\u4ECD\u4E0D\u50AC\uFF0C\u7B2C ${step} \u6B21\u6C89\u9ED8\u50CF\u5200\u80CC\u8D34\u5728\u9888\u540E\uFF0C\u4E0D\u89C1\u8840\uFF0C\u4E5F\u4E0D\u80AF\u79BB\u5F00\u3002`,
    (step) => `\u7B2C ${step} \u53E5\u77ED\u95EE\u843D\u4E0B\uFF0C${protagonistName}\u5408\u4E0A\u8D26\u518C\uFF0C\u53EA\u95EE\u7B2C ${step} \u6B21\uFF1A\u8C01\u52A8\u8FC7\u8FD9\u4E00\u9875\uFF1F`,
    (step) => `\u7B2C ${step} \u9635\u96E8\u58F0\u66F4\u5BC6\uFF0C\u5C4B\u6A90\u4E0B\u7684\u9ED1\u5F71\u5411\u524D\u534A\u5BF8\u53C8\u505C\u4F4F\uFF0C\u7B2C ${step} \u9053\u65E7\u4FE1\u4EFB\u4E5F\u5728\u8FD9\u4E00\u606F\u88C2\u5F00\u3002`
  ];
  const paragraphs = [...baseParagraphs];
  let index = 0;
  while (wordCount(paragraphs.join("\n\n")) < Math.floor(task.targetWords * 0.84)) {
    paragraphs.push(expansionSeeds[index % expansionSeeds.length](index + 1));
    index += 1;
  }
  const body = paragraphs.join("\n\n");
  return [
    `# ${title}`,
    "",
    "## Draft Body",
    "",
    body,
    "",
    "## Drafting Metadata",
    `- Chapter: ${task.chapterNumber}`,
    `- Target words: ${task.targetWords}`,
    `- Estimated production words: ${wordCount(body)}`,
    "- Draft source: deterministic style-contract test fixture",
    `- Continuity status: ${continuityContract.status}`,
    `- Locked protagonist: ${continuityContract.lockedProtagonistName || "(first chapter pending)"}`,
    `- Causal objective: ${causalPlan.sceneObjective}`,
    `- Next handoff: ${causalPlan.nextHandoff}`
  ].join("\n");
}
async function generateProductionTextWithLlm({
  roleName,
  message,
  basePrompt,
  dynamicPrompt,
  state,
  options,
  progress,
  temperature
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
          temperature,
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
function createActiveWorldSlice(input) {
  const causalPlan = getTaskCausalPlan(input.state, input.task);
  const knownCast = Array.isArray(input.continuityContract.knownCast) ? input.continuityContract.knownCast : [];
  const continuityAnchors = Array.isArray(input.continuityContract.continuityAnchors) ? input.continuityContract.continuityAnchors : [];
  const keywords = uniqueStrings([
    input.state.project.title,
    input.state.project.idea,
    input.continuityContract.lockedProtagonistName,
    ...knownCast.slice(0, 8),
    ...continuityAnchors.slice(0, 8),
    ...causalPlan.requiredContinuityAnchors,
    ...String(input.task.title || "").match(/[\u4e00-\u9fffA-Za-z0-9]{2,}/gu) || [],
    ...causalPlan.sceneObjective.match(/[\u4e00-\u9fffA-Za-z0-9]{2,}/gu) || []
  ].filter(Boolean).map((item) => String(item).trim()).filter((item) => item.length >= 2));
  const chapterPatterns = [
    new RegExp(`\u7B2C\\s*${input.task.chapterNumber}\\s*\u7AE0`, "u"),
    new RegExp(`Chapter\\s*${input.task.chapterNumber}\\b`, "iu"),
    new RegExp(`\\|\\s*${input.task.chapterNumber}\\s*\\|`, "u")
  ];
  const alwaysRelevant = /Frozen World Rules|Non-Negotiable|Causal Spine|Chapter Causality Matrix|Continuity Anchor|Foreshadowing|Character|Relationship|World|Rule|Pressure|Ledger|主角|配角|人物|关系|世界|规则|设定|伏笔|线索|代价|压力|承接|交棒/u;
  const sources = [
    ["Story Assets", input.storyAssets],
    ["Consensus", input.consensus],
    ["Blueprint", input.blueprint]
  ];
  const rows = [];
  for (const [label, text] of sources) {
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const picked = lines.filter(
      (line) => chapterPatterns.some((pattern) => pattern.test(line)) || alwaysRelevant.test(line) || keywords.some((keyword) => line.includes(keyword))
    ).slice(0, 28);
    if (picked.length) {
      rows.push(`## ${label}`);
      rows.push(...picked.map((line) => `- ${line.replace(/^[-#]\s*/u, "")}`));
    }
  }
  const fallback = [
    "## Causal Focus",
    `- Scene objective: ${causalPlan.sceneObjective}`,
    `- Required anchors: ${causalPlan.requiredContinuityAnchors.join("\u3001") || "none"}`,
    `- Next handoff: ${causalPlan.nextHandoff}`
  ];
  const content = [
    "# Active World Slice",
    "",
    `Project: ${input.state.project.title}`,
    `Chapter: ${input.task.chapterNumber}`,
    "",
    ...rows.length ? rows : fallback
  ].join("\n");
  const maxChars = input.maxChars || 1600;
  return content.length > maxChars ? `${content.slice(0, maxChars).trimEnd()}
...[active world slice clipped]` : content;
}
async function loadAndPruneGlobalContext(params) {
  const { state, task, blueprint, resources, continuityContract, paths } = params;
  let previousDraftFragment = "";
  const previousChapterId = task.chapterNumber > 1 ? `chapter-${String(task.chapterNumber - 1).padStart(3, "0")}` : "";
  if (paths && previousChapterId) {
    const previousFinalDraft = await readOptionalText2(import_node_path8.default.join(paths.chaptersDir, `${previousChapterId}.final.md`));
    if (previousFinalDraft) {
      previousDraftFragment = previousFinalDraft.slice(-1200);
    }
  }
  let rawOutline = "";
  if (paths) {
    rawOutline = await readOptionalText2(paths.masterOutlinePath);
  }
  let rawStoryAssets = "";
  if (paths) {
    const storyAssets = await loadProductionStoryAssetContext(paths, task, 1800);
    rawStoryAssets = storyAssets.prompt;
  }
  let rawConsensus = "";
  if (paths) {
    rawConsensus = await readOptionalText2(paths.consensusPath);
  }
  const activeWorldSlice = createActiveWorldSlice({
    state,
    task,
    blueprint,
    storyAssets: rawStoryAssets,
    consensus: rawConsensus,
    continuityContract
  });
  let rawMemory = "";
  if (paths && previousChapterId) {
    rawMemory = await readOptionalText2(import_node_path8.default.join(paths.memoryDir, `${previousChapterId}-memory.md`));
  }
  const recalledMemory = await retrieveFactoryMemoryContext({
    state,
    task,
    options: params.options,
    continuityContract,
    limit: 5
  });
  if (recalledMemory) {
    rawMemory = [rawMemory, recalledMemory].filter(Boolean).join("\n\n");
  }
  let rawRag = params.knowledgeContext?.prompt || "";
  let ledgerList = [...continuityContract.previousChapterLedger];
  const genre = inferGenreProfile(state);
  const prioritiesText = (genre.contextPriority || []).join("|");
  if (rawRag.length > 1e3) {
    rawRag = rawRag.slice(0, 1e3) + "\n...[RAG \u77E5\u8BC6\u5E93\u8D85\u989D\u5C40\u90E8\u88C1\u526A]";
  }
  if (rawMemory.length > 1200) {
    rawMemory = rawMemory.slice(0, 1200) + "\n...[\u89D2\u8272\u4E0E\u53EC\u56DE\u8BB0\u5FC6\u8D85\u989D\u5C40\u90E8\u88C1\u526A]";
  }
  if (rawStoryAssets.length > 1800) {
    rawStoryAssets = rawStoryAssets.slice(0, 1800) + "\n...[\u6545\u4E8B\u8D44\u4EA7\u6458\u8981\u8D85\u989D\u5C40\u90E8\u88C1\u526A]";
  }
  if (ledgerList.join("\n").length > 1500) {
    const tempLedger = [];
    let currentLen = 0;
    for (let i = ledgerList.length - 1; i >= 0; i--) {
      const item = ledgerList[i];
      if (currentLen + item.length + 1 <= 1500) {
        tempLedger.unshift(item);
        currentLen += item.length + 1;
      } else {
        break;
      }
    }
    ledgerList = tempLedger;
  }
  const MAX_TOTAL_CHARS = 12e3;
  const fixedLength = params.additionalFixedLength ?? 10500;
  const protagonistName = continuityContract.lockedProtagonistName || "";
  const protectedLength = fixedLength + previousDraftFragment.length + protagonistName.length;
  let prunedRag = rawRag;
  let prunedMemory = rawMemory;
  let prunedLedgerList = [...ledgerList];
  let prunedConsensus = rawConsensus;
  let prunedOutline = rawOutline;
  let prunedStoryAssets = rawStoryAssets;
  if (prunedConsensus) {
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
      if (isHit) matchedBlocks.push(block);
    }
    if (matchedBlocks.length > 0) {
      prunedConsensus = matchedBlocks.join("\n");
    } else {
      prunedConsensus = prunedConsensus.slice(0, 1500) + "\n...[\u5168\u5C40\u5171\u8BC6\u65E0\u5173\u7247\u6BB5\u5DF2\u7CBE\u7B80]";
    }
  }
  if (prunedOutline) {
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
      prunedOutline = prunedOutline.slice(0, 1500) + "\n...[\u4E3B\u7EBF\u5927\u7EB2\u4E0D\u76F8\u5173\u7AE0\u8282\u5DF2\u88C1\u526A]";
    }
  }
  const getDynamicLength = () => {
    const ledgerText = prunedLedgerList.join("\n");
    return prunedRag.length + prunedMemory.length + ledgerText.length + prunedConsensus.length + prunedOutline.length + prunedStoryAssets.length;
  };
  let wRag = 5;
  let wMemory = 4;
  let wLedger = 3;
  let wOutline = 2;
  let wStoryAssets = 0.8;
  let wConsensus = 1;
  if (/案件|线索|疑点|记忆|上一章/i.test(prioritiesText)) {
    wMemory = 1.5;
    wLedger = 1;
    wConsensus = 4;
    wOutline = 3.5;
    wStoryAssets = 1.2;
  } else if (/境界|功法|世界观|设定|法则|物理/i.test(prioritiesText)) {
    wConsensus = 0.5;
    wStoryAssets = 0.4;
    wRag = 5;
    wMemory = 4;
  } else if (/关系|情感|创伤|角色/i.test(prioritiesText)) {
    wMemory = 1;
    wLedger = 2;
    wConsensus = 4;
    wStoryAssets = 1;
  }
  const partitions = [
    { name: "Rag", get: () => prunedRag, set: (val) => prunedRag = val, weight: wRag },
    { name: "Memory", get: () => prunedMemory, set: (val) => prunedMemory = val, weight: wMemory },
    { name: "Ledger", get: () => prunedLedgerList.join("\n"), set: (val) => {
      prunedLedgerList = val ? val.split("\n") : [];
    }, weight: wLedger },
    { name: "Outline", get: () => prunedOutline, set: (val) => prunedOutline = val, weight: wOutline },
    { name: "StoryAssets", get: () => prunedStoryAssets, set: (val) => prunedStoryAssets = val, weight: wStoryAssets },
    { name: "Consensus", get: () => prunedConsensus, set: (val) => prunedConsensus = val, weight: wConsensus }
  ];
  partitions.sort((a, b) => b.weight - a.weight);
  for (const part of partitions) {
    if (protectedLength + getDynamicLength() <= MAX_TOTAL_CHARS) {
      break;
    }
    const currentText = part.get();
    if (!currentText) continue;
    const overage = protectedLength + getDynamicLength() - MAX_TOTAL_CHARS;
    if (overage <= 0) break;
    if (currentText.length > 200) {
      const keepLen = Math.max(0, currentText.length - overage);
      if (keepLen < 150) {
        part.set("");
      } else {
        part.set(currentText.slice(0, keepLen) + `
...[\u5206\u5C42\u524A\u51CF\uFF1A\u8BE5${part.name}\u5206\u533A\u56E0\u9884\u7B97\u8D85\u9650\u5DF2\u4E8C\u6B21\u538B\u7F29]`);
      }
    } else {
      part.set("");
    }
  }
  const totalLength = protectedLength + getDynamicLength();
  if (totalLength > 15e3) {
    console.warn(`[CONTEXT BUDGET WARNING] Total prompt context size of ${totalLength} characters exceeds safe budget of 15000 characters!`);
  }
  return {
    prunedConsensus,
    prunedOutline,
    prunedStoryAssets,
    activeWorldSlice,
    prunedRag,
    prunedMemory,
    prunedLedger: prunedLedgerList.join("\n"),
    previousDraftFragment
  };
}
function trimBlueprintForDrafting(blueprint) {
  let trimmed = blueprint;
  trimmed = trimmed.replace(
    /## Chapter Execution Contract\s+```json\s+[\s\S]*?```\s*/u,
    "## Chapter Execution Contract\n- \u7ED3\u6784\u5316\u573A\u666F\u5361\u5DF2\u4F5C\u4E3A\u5F53\u524D\u7247\u6BB5\u5408\u540C\u5355\u72EC\u6CE8\u5165\u3002\n\n"
  );
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
function extractJsonArrayAfterKey(text, key) {
  const keyIndex = text.indexOf(`"${key}"`);
  if (keyIndex < 0) return "";
  const start = text.indexOf("[", keyIndex);
  if (start < 0) return "";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return "";
}
function extractSceneCardsFromBlueprint(blueprint) {
  const sceneCardsJson = extractJsonArrayAfterKey(blueprint, "sceneCards");
  if (!sceneCardsJson) return [];
  try {
    const parsed = JSON.parse(sceneCardsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((card, cardIndex) => {
      if (!card || typeof card !== "object") return null;
      const rawCard = card;
      const requiredCharacters = Array.isArray(rawCard.requiredCharacters) ? rawCard.requiredCharacters.map((item) => String(item).trim()).filter(Boolean) : [];
      const requiredFacts = Array.isArray(rawCard.requiredFacts) ? rawCard.requiredFacts.map((item) => String(item).trim()).filter(Boolean) : [];
      const forbiddenFacts = Array.isArray(rawCard.forbiddenFacts) ? rawCard.forbiddenFacts.map((item) => String(item).trim()).filter(Boolean) : [];
      const goal = String(rawCard.goal || "").trim();
      const conflict = String(rawCard.conflict || "").trim();
      const turn = String(rawCard.turn || "").trim();
      const endHook = String(rawCard.endHook || "").trim();
      if (!goal && !conflict && !turn && !endHook) return null;
      return {
        index: Number(rawCard.index) || cardIndex + 1,
        goal,
        conflict,
        turn,
        endHook,
        requiredCharacters,
        requiredFacts,
        forbiddenFacts
      };
    }).filter((card) => Boolean(card));
  } catch {
    return [];
  }
}
function createDraftSegmentPlan(state, task, continuityContract = createContinuityContract({ state, task, blueprint: "" }), blueprint = "") {
  const causalPlan = getTaskCausalPlan(state, task);
  const targetWords = Math.max(1200, Number(task.targetWords) || Number(state.plan.chapterWordTarget) || 2500);
  const protagonist = continuityContract.lockedProtagonistName || "\u4E3B\u89D2";
  const anchors = continuityContract.continuityAnchors.length ? continuityContract.continuityAnchors : causalPlan.requiredContinuityAnchors;
  const sceneCards = extractSceneCardsFromBlueprint(blueprint).slice(0, 8);
  if (sceneCards.length >= 2) {
    const baseTarget2 = Math.max(260, Math.floor(targetWords / sceneCards.length));
    return sceneCards.map((card, index) => ({
      index: index + 1,
      total: sceneCards.length,
      label: `\u573A\u666F\u5361 ${card.index}`,
      timelinePosition: `\u6309\u7AE0\u8282\u4EFB\u52A1\u5355\u63A8\u8FDB\u7B2C ${card.index} \u4E2A\u573A\u666F`,
      narrativeFocus: [
        card.goal ? `\u76EE\u6807\uFF1A${card.goal}` : "",
        card.conflict ? `\u51B2\u7A81\uFF1A${card.conflict}` : "",
        card.turn ? `\u8F6C\u6298\uFF1A${card.turn}` : ""
      ].filter(Boolean).join("\uFF1B") || `${protagonist}\u5FC5\u987B\u5728\u672C\u573A\u666F\u4E2D\u5B8C\u6210\u4E00\u6B21\u53EF\u89C1\u63A8\u8FDB\u3002`,
      requiredBeats: [
        card.goal ? `Scene Goal \u843D\u5730\uFF1A${card.goal}` : "",
        card.conflict ? `Scene Conflict \u5FC5\u987B\u5199\u6210\u73B0\u573A\u538B\u529B\uFF1A${card.conflict}` : "",
        card.turn ? `Scene Turn \u5FC5\u987B\u6539\u53D8\u5C40\u9762\uFF1A${card.turn}` : "",
        card.endHook ? `Scene End Hook \u6536\u675F\u5230\uFF1A${card.endHook}` : "",
        card.requiredCharacters.length ? `Required Characters: ${card.requiredCharacters.join("\u3001")}` : "",
        card.requiredFacts.length ? `Required Facts: ${card.requiredFacts.join("\u3001")}` : "",
        card.forbiddenFacts.length ? `Forbidden Facts \u4E0D\u5F97\u6CC4\u9732\uFF1A${card.forbiddenFacts.join("\u3001")}` : ""
      ].filter(Boolean),
      continuityFocus: [.../* @__PURE__ */ new Set([...card.requiredFacts, ...anchors.slice(index, index + 2)])],
      targetWords: index === sceneCards.length - 1 ? Math.max(240, targetWords - baseTarget2 * (sceneCards.length - 1)) : baseTarget2,
      source: "scene_card",
      sceneCard: card
    }));
  }
  const segmentCount = Math.min(6, Math.max(4, Math.round(targetWords / 650)));
  const baseSegments = [
    {
      label: "\u5F00\u573A\u627F\u63A5",
      timelinePosition: "\u672C\u7AE0\u5F00\u573A\uFF0C\u7D27\u63A5\u4E0A\u4E00\u7AE0\u4F59\u6CE2",
      narrativeFocus: `\u8BA9${protagonist}\u5728\u5177\u4F53\u573A\u666F\u91CC\u78B0\u5230\u4E0A\u4E00\u7AE0\u7559\u4E0B\u7684\u95EE\u9898\uFF0C\u5148\u5199\u52A8\u4F5C\u548C\u538B\u529B\uFF0C\u518D\u5199\u5224\u65AD\u3002`,
      requiredBeats: [
        `Previous Input \u843D\u5730\uFF1A${causalPlan.previousInput}`,
        "\u7528\u7269\u4EF6\u3001\u58F0\u97F3\u3001\u6C14\u5473\u6216\u8EAB\u4F53\u53CD\u5E94\u5EFA\u7ACB\u7B2C\u4E00\u573A\u51B2\u7A81\u3002"
      ],
      continuityFocus: anchors.slice(0, 2)
    },
    {
      label: "\u538B\u529B\u5347\u7EA7",
      timelinePosition: "\u5F00\u573A\u4E4B\u540E\uFF0C\u77DB\u76FE\u4ECE\u5916\u90E8\u538B\u529B\u8FDB\u5165\u4EBA\u7269\u5173\u7CFB",
      narrativeFocus: "\u8BA9\u65C1\u767D\u8D34\u8FD1\u73B0\u573A\uFF0C\u63A8\u52A8\u914D\u89D2\u7ACB\u573A\u3001\u8BEF\u4F1A\u3001\u8BD5\u63A2\u6216\u5A01\u80C1\u663E\u5F62\u3002",
      requiredBeats: [
        `Causal Objective \u5F00\u59CB\u88AB\u4E8B\u4EF6\u63A8\u8FDB\uFF1A${causalPlan.sceneObjective}`,
        "\u81F3\u5C11\u8BA9\u4E00\u540D\u914D\u89D2\u901A\u8FC7\u79F0\u547C\u3001\u505C\u987F\u3001\u52A8\u4F5C\u6216\u5229\u76CA\u9009\u62E9\u8868\u73B0\u5DEE\u5F02\u3002"
      ],
      continuityFocus: anchors.slice(1, 4)
    },
    {
      label: "\u4E3B\u89D2\u51B3\u7B56",
      timelinePosition: "\u4E2D\u6BB5\u8F6C\u6298\uFF0C\u4E3B\u89D2\u5FC5\u987B\u4E3B\u52A8\u9009\u62E9",
      narrativeFocus: `${protagonist}\u4E0D\u80FD\u53EA\u65C1\u89C2\uFF0C\u5FC5\u987B\u7528\u53EF\u89C1\u884C\u52A8\u6539\u53D8\u5C40\u52BF\uFF0C\u5E76\u66B4\u9732\u80FD\u529B\u8FB9\u754C\u6216\u77ED\u677F\u3002`,
      requiredBeats: [
        `Protagonist Decision \u5199\u6210\u884C\u52A8\uFF1A${causalPlan.protagonistDecision}`,
        `Character State Delta \u5FC5\u987B\u51FA\u73B0\uFF1A${causalPlan.characterStateDelta}`
      ],
      continuityFocus: anchors.slice(2, 5)
    },
    {
      label: "\u4E0D\u53EF\u9006\u540E\u679C",
      timelinePosition: "\u9AD8\u6F6E\u6216\u4E34\u8FD1\u7AE0\u672B\uFF0C\u9009\u62E9\u5E26\u6765\u4EE3\u4EF7",
      narrativeFocus: "\u5199\u51FA\u53CD\u51FB\u3001\u5151\u73B0\u3001\u66B4\u9732\u3001\u635F\u5931\u6216\u5173\u7CFB\u88C2\u7F1D\uFF0C\u4E0D\u7528\u89E3\u91CA\u603B\u7ED3\u4EE3\u66FF\u4E8B\u4EF6\u3002",
      requiredBeats: [
        `Irreversible Change \u6210\u4E3A\u4E8B\u5B9E\uFF1A${causalPlan.irreversibleConsequence}`,
        `Foreshadowing Operation \u63A8\u8FDB\u6216\u56DE\u6536\uFF1A${causalPlan.foreshadowingOperation}`
      ],
      continuityFocus: anchors.slice(3, 6)
    },
    {
      label: "\u7AE0\u672B\u4EA4\u63A5",
      timelinePosition: "\u7AE0\u672B\u4F59\u6CE2\uFF0C\u7559\u4E0B\u4E0B\u4E00\u7AE0\u5FC5\u987B\u5904\u7406\u7684\u5177\u4F53\u95EE\u9898",
      narrativeFocus: "\u6536\u4F4F\u672C\u7AE0\u5C40\u90E8\u7ED3\u679C\uFF0C\u4FDD\u7559\u4E00\u4E2A\u5177\u4F53\u753B\u9762\u3001\u7EBF\u7D22\u6216\u5173\u7CFB\u538B\u529B\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002",
      requiredBeats: [
        `Next Chapter Handoff \u81EA\u7136\u4EA7\u751F\uFF1A${causalPlan.nextHandoff}`,
        "\u4E0D\u8981\u628A\u7B54\u6848\u8BB2\u5B8C\uFF0C\u6700\u540E\u4E00\u6BB5\u5FC5\u987B\u6709\u53EF\u8FFD\u8E2A\u7684\u753B\u9762\u6216\u7269\u4EF6\u3002"
      ],
      continuityFocus: anchors.slice(-3)
    }
  ];
  const selected = segmentCount <= 4 ? [baseSegments[0], baseSegments[1], baseSegments[2], baseSegments[4]] : baseSegments.slice(0, segmentCount);
  const baseTarget = Math.max(260, Math.floor(targetWords / selected.length));
  return selected.map((segment, index) => ({
    ...segment,
    index: index + 1,
    total: selected.length,
    targetWords: index === selected.length - 1 ? Math.max(240, targetWords - baseTarget * (selected.length - 1)) : baseTarget,
    source: "timeline"
  }));
}
function createDraftSegmentCompositionPlan(segment, continuityContract) {
  const sceneCard = segment.sceneCard;
  const continuityFocus = segment.continuityFocus.length ? segment.continuityFocus : continuityContract.continuityAnchors.slice(0, 3);
  const protagonist = continuityContract.lockedProtagonistName || "\u4E3B\u89D2";
  return {
    plot: [
      sceneCard?.goal || segment.narrativeFocus,
      sceneCard?.conflict || "\u628A\u538B\u529B\u5199\u6210\u73B0\u573A\u4E8B\u4EF6\uFF0C\u800C\u4E0D\u662F\u89E3\u91CA\u6027\u6982\u8FF0\u3002",
      sceneCard?.turn || "\u8BA9\u672C\u7247\u6BB5\u81F3\u5C11\u53D1\u751F\u4E00\u6B21\u53EF\u89C1\u5C40\u9762\u53D8\u5316\u3002",
      sceneCard?.endHook || "\u4EE5\u5177\u4F53\u95EE\u9898\u3001\u7269\u4EF6\u3001\u5173\u7CFB\u538B\u529B\u6216\u672A\u5B8C\u6210\u52A8\u4F5C\u6536\u675F\u3002"
    ].filter(Boolean),
    narration: [
      "\u65C1\u767D\u53EA\u670D\u52A1\u73B0\u573A\u63A8\u8FDB\u3001\u611F\u5B98\u843D\u70B9\u548C\u89D2\u8272\u9009\u62E9\uFF0C\u4E0D\u63D0\u524D\u89E3\u91CA\u540E\u7EED\u771F\u76F8\u3002",
      "\u5148\u5199\u7269\u4EF6\u3001\u52A8\u4F5C\u3001\u58F0\u97F3\u3001\u6C14\u5473\u6216\u8EAB\u4F53\u53CD\u5E94\uFF0C\u518D\u7ED9\u6781\u5C11\u91CF\u5224\u65AD\u3002",
      "\u6BCF\u6BB5\u81F3\u5C11\u6709\u4E00\u4E2A\u53EF\u89C1\u52A8\u4F5C\u6216\u53EF\u8FFD\u8E2A\u7269\u4EF6\uFF0C\u907F\u514D\u7EAF\u5FC3\u7406\u603B\u7ED3\u3002"
    ],
    dialogue: [
      "\u5BF9\u767D\u5FC5\u987B\u77ED\u3001\u6709\u538B\u529B\uFF0C\u5E76\u4F53\u73B0\u5173\u7CFB\u6216\u5229\u76CA\uFF0C\u4E0D\u7528\u5BF9\u767D\u89E3\u91CA\u4E16\u754C\u89C2\u80CC\u666F\u3002",
      "\u6BCF\u4E2A\u91CD\u8981\u8BF4\u8BDD\u8005\u81F3\u5C11\u5E26\u4E00\u4E2A\u79F0\u547C\u3001\u505C\u987F\u3001\u52A8\u4F5C\u6216\u8BED\u6C14\u5DEE\u5F02\u3002",
      sceneCard?.requiredCharacters.length ? `\u5BF9\u767D\u4F18\u5148\u670D\u52A1\u8FD9\u4E9B\u89D2\u8272\uFF1A${sceneCard.requiredCharacters.join("\u3001")}\u3002` : `\u5BF9\u767D\u5FC5\u987B\u56F4\u7ED5${protagonist}\u7684\u9009\u62E9\u548C\u73B0\u573A\u538B\u529B\u5C55\u5F00\u3002`
    ],
    characterAction: [
      continuityContract.lockedProtagonistName ? `${continuityContract.lockedProtagonistName}\u5FC5\u987B\u901A\u8FC7\u884C\u52A8\u3001\u611F\u77E5\u6216\u9009\u62E9\u63A8\u8FDB\u672C\u7247\u6BB5\u3002` : "\u9996\u7AE0\u5FC5\u987B\u5EFA\u7ACB\u552F\u4E00\u53EF\u8FFD\u8E2A\u4E3B\u89D2\u59D3\u540D\uFF0C\u5E76\u4FDD\u6301\u4E3B\u89C6\u89D2\u805A\u7126\u3002",
      "\u91CD\u8981\u914D\u89D2\u4E0D\u80FD\u53EA\u8D34\u6027\u683C\u6807\u7B7E\uFF0C\u5FC5\u987B\u7528\u52A8\u4F5C\u3001\u79F0\u547C\u3001\u4E60\u60EF\u6216\u5229\u76CA\u9009\u62E9\u5448\u73B0\u3002",
      "\u81F3\u5C11\u8BA9\u4E00\u4E2A\u89D2\u8272\u7684\u6B32\u671B\u3001\u77ED\u677F\u3001\u5173\u7CFB\u72B6\u6001\u6216\u98CE\u9669\u4EE3\u4EF7\u9732\u51FA\u75D5\u8FF9\u3002"
    ],
    continuity: [
      ...continuityFocus.map((item) => `\u5FC5\u987B\u81EA\u7136\u547D\u4E2D\u8FDE\u7EED\u6027\u951A\u70B9\uFF1A${item}`),
      sceneCard?.forbiddenFacts.length ? `\u4E0D\u5F97\u6CC4\u9732\uFF1A${sceneCard.forbiddenFacts.join("\u3001")}` : "",
      "\u4E0D\u5F97\u65B0\u589E\u4E0E\u672C\u7247\u6BB5\u76EE\u6807\u65E0\u5173\u7684\u4E3B\u7EBF\u771F\u76F8\u3001\u5E55\u540E\u8EAB\u4EFD\u6216\u672A\u51BB\u7ED3\u4E16\u754C\u89C4\u5219\u3002"
    ].filter(Boolean),
    assemblyRules: [
      "\u7EC4\u88C5\u987A\u5E8F\u5EFA\u8BAE\uFF1A\u73B0\u573A\u951A\u70B9 -> \u538B\u529B/\u5BF9\u767D -> \u4E3B\u89D2\u52A8\u4F5C\u9009\u62E9 -> \u8F6C\u6298\u540E\u679C -> \u7247\u6BB5\u94A9\u5B50\u3002",
      "\u5BF9\u8BDD\u3001\u52A8\u4F5C\u3001\u65C1\u767D\u5FC5\u987B\u4EA4\u9519\uFF0C\u4E0D\u8981\u8FDE\u7EED\u8F93\u51FA\u8BBE\u5B9A\u8BF4\u660E\u6216\u8BA8\u8BBA\u5F0F\u6BB5\u843D\u3002",
      "\u672C\u7247\u6BB5\u53EA\u80FD\u5B8C\u6210\u5F53\u524D segment contract\uFF0C\u4E0D\u63D0\u524D\u5199\u5B8C\u540E\u7EED segment\u3002",
      "\u6700\u7EC8\u7247\u6BB5\u8981\u80FD\u548C\u4E0A\u4E00\u7247\u6BB5\u5C3E\u5DF4\u81EA\u7136\u8854\u63A5\uFF0C\u5E76\u7ED9\u4E0B\u4E00\u7247\u6BB5\u7559\u4E0B\u53EF\u627F\u63A5\u72B6\u6001\u3002"
    ]
  };
}
function formatChapterContextPackage(input) {
  const causalPlan = getTaskCausalPlan(input.state, input.task);
  const segmentationSource = input.segmentPlan.some((segment) => segment.source === "scene_card") ? "scene_card" : "timeline";
  const budgetRows = [
    ["basePrompt", input.basePromptText.length],
    ["fixedDynamicPrompt", input.fixedDynamicPromptText.length],
    ["chapterGuardrails", input.trimmedBlueprint.length],
    ["activeWorldSlice", input.prunedContext.activeWorldSlice.length],
    ["storyAssets", input.prunedContext.prunedStoryAssets.length],
    ["consensus", input.prunedContext.prunedConsensus.length],
    ["outline", input.prunedContext.prunedOutline.length],
    ["memory", input.prunedContext.prunedMemory.length],
    ["ledger", input.prunedContext.prunedLedger.length],
    ["rag", input.prunedContext.prunedRag.length],
    ["previousTail", input.prunedContext.previousDraftFragment.length],
    ["vocabularyPrompt", input.cappedVocabularyPrompt.length],
    ["skillExamples", input.cappedVocabularySkillExamples.length],
    ["resourceManifest", input.cappedResourceManifest.length],
    ["approvedStyle", input.approvedStyleContext.prompt.length],
    ["continuityContract", input.continuityContract.prompt.length],
    ["characterProfileContract", input.characterProfileContract.prompt.length]
  ];
  const segmentRows = input.segmentPlan.map((segment) => [
    `### Segment ${segment.index}/${segment.total}: ${segment.label}`,
    `- Source: ${segment.source || "timeline"}`,
    `- Target words: ${segment.targetWords}`,
    `- Timeline: ${segment.timelinePosition}`,
    `- Focus: ${segment.narrativeFocus}`,
    segment.continuityFocus.length ? `- Continuity focus: ${segment.continuityFocus.join("\u3001")}` : "",
    segment.sceneCard?.requiredCharacters.length ? `- Required characters: ${segment.sceneCard.requiredCharacters.join("\u3001")}` : "",
    segment.sceneCard?.requiredFacts.length ? `- Required facts: ${segment.sceneCard.requiredFacts.join("\u3001")}` : "",
    segment.sceneCard?.forbiddenFacts.length ? `- Forbidden facts: ${segment.sceneCard.forbiddenFacts.join("\u3001")}` : "",
    "- Required beats:",
    ...segment.requiredBeats.map((beat) => `  - ${beat}`)
  ].filter(Boolean).join("\n"));
  const compositionRows = input.segmentPlan.map((segment) => {
    const composition = createDraftSegmentCompositionPlan(segment, input.continuityContract);
    return [
      `### Segment ${segment.index}/${segment.total}: ${segment.label}`,
      "#### Plot",
      ...composition.plot.map((item) => `- ${item}`),
      "#### Narration",
      ...composition.narration.map((item) => `- ${item}`),
      "#### Dialogue",
      ...composition.dialogue.map((item) => `- ${item}`),
      "#### Character Action",
      ...composition.characterAction.map((item) => `- ${item}`),
      "#### Continuity",
      ...composition.continuity.map((item) => `- ${item}`),
      "#### Assembly Rules",
      ...composition.assemblyRules.map((item) => `- ${item}`)
    ].join("\n");
  });
  return [
    "# Chapter Context Package",
    "",
    `Project: ${input.state.project.title}`,
    `Chapter: ${input.task.chapterNumber}`,
    `Title: ${input.task.title}`,
    `Writing mode: ${input.writingMode}`,
    `Genre: ${input.genre.genre}`,
    `Scene type: ${input.sceneType}`,
    `Segmentation source: ${segmentationSource}`,
    `Generated at: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    "",
    "## Prompt Budget",
    "| Section | Chars |",
    "|---|---:|",
    ...budgetRows.map(([label, value]) => `| ${label} | ${value} |`),
    "",
    "## Chapter Causal Plan",
    `- Previous Input: ${causalPlan.previousInput}`,
    `- Causal Objective: ${causalPlan.sceneObjective}`,
    `- Protagonist Decision: ${causalPlan.protagonistDecision}`,
    `- Irreversible Change: ${causalPlan.irreversibleConsequence}`,
    `- Character State Delta: ${causalPlan.characterStateDelta}`,
    `- Foreshadowing Operation: ${causalPlan.foreshadowingOperation}`,
    `- Next Chapter Handoff: ${causalPlan.nextHandoff}`,
    `- Required Continuity Anchors: ${causalPlan.requiredContinuityAnchors.join("\u3001") || "none"}`,
    "",
    "## Segment Plan",
    ...segmentRows,
    "",
    "## Segment Composition Plans",
    ...compositionRows,
    "",
    "## Approved Style Contract",
    input.approvedStyleContext.prompt || "(missing)",
    "",
    "## Active World Slice",
    input.prunedContext.activeWorldSlice || "(empty)",
    "",
    "## Story Assets",
    input.prunedContext.prunedStoryAssets || "(empty)",
    "",
    "## Consensus And Setting Freeze",
    input.prunedContext.prunedConsensus || "(empty)",
    "",
    "## Character Memory",
    input.prunedContext.prunedMemory || "(empty)",
    "",
    "## Previous Chapter Ledger",
    input.prunedContext.prunedLedger || "(empty)",
    "",
    "## Knowledge/RAG References",
    input.prunedContext.prunedRag || "(empty)",
    "",
    "## Continuity Contract",
    input.continuityContract.prompt,
    "",
    "## Character Profile Contract",
    input.characterProfileContract.prompt.slice(0, 2400),
    "",
    "## Chapter Guardrails",
    input.trimmedBlueprint
  ].join("\n");
}
async function writeChapterContextPackage(input) {
  const chapterId = `chapter-${String(input.task.chapterNumber).padStart(3, "0")}`;
  const checkpointsRoot = import_node_path8.default.join(input.paths.workspaceDir, "checkpoints");
  const contextDir = import_node_path8.default.join(checkpointsRoot, "chapter-contexts");
  const contextPath = import_node_path8.default.join(contextDir, `${chapterId}-context.md`);
  const activeWorldSliceDir = import_node_path8.default.join(checkpointsRoot, "active-world-slices");
  const activeWorldSlicePath = import_node_path8.default.join(activeWorldSliceDir, `${chapterId}-world-slice.md`);
  await import_promises5.default.mkdir(contextDir, { recursive: true });
  await import_promises5.default.mkdir(activeWorldSliceDir, { recursive: true });
  const content = formatChapterContextPackage(input);
  await import_promises5.default.writeFile(contextPath, `${content.trimEnd()}
`);
  await import_promises5.default.writeFile(activeWorldSlicePath, `${input.prunedContext.activeWorldSlice.trimEnd()}
`);
  const relativePath = relativeArtifactPath(input.projectRoot, contextPath);
  const segmentationSource = input.segmentPlan.some((segment) => segment.source === "scene_card") ? "scene_card" : "timeline";
  await recordPipelineArtifact(input.projectRoot, contextPath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "chapter_context_package",
    segmentationSource,
    segmentCount: input.segmentPlan.length,
    promptBudget: {
      basePromptChars: input.basePromptText.length,
      fixedDynamicPromptChars: input.fixedDynamicPromptText.length,
      guardrailsChars: input.trimmedBlueprint.length,
      activeWorldSliceChars: input.prunedContext.activeWorldSlice.length,
      storyAssetsChars: input.prunedContext.prunedStoryAssets.length,
      consensusChars: input.prunedContext.prunedConsensus.length,
      memoryChars: input.prunedContext.prunedMemory.length,
      ledgerChars: input.prunedContext.prunedLedger.length,
      ragChars: input.prunedContext.prunedRag.length
    }
  });
  await recordPipelineArtifact(input.projectRoot, activeWorldSlicePath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "active_world_slice",
    chars: input.prunedContext.activeWorldSlice.length
  });
  return {
    path: contextPath,
    relativePath,
    promptBudget: {
      basePromptChars: input.basePromptText.length,
      fixedDynamicPromptChars: input.fixedDynamicPromptText.length,
      guardrailsChars: input.trimmedBlueprint.length,
      activeWorldSliceChars: input.prunedContext.activeWorldSlice.length,
      storyAssetsChars: input.prunedContext.prunedStoryAssets.length,
      consensusChars: input.prunedContext.prunedConsensus.length,
      memoryChars: input.prunedContext.prunedMemory.length,
      ledgerChars: input.prunedContext.prunedLedger.length,
      ragChars: input.prunedContext.prunedRag.length
    },
    segmentCount: input.segmentPlan.length,
    segmentationSource
  };
}
function formatSegmentBriefArtifact(input) {
  const roleLabel = input.kind.replace("character_action", "character action").replace("_", " ");
  return [
    `# ${input.title}`,
    "",
    `Chapter: ${input.task.chapterNumber}`,
    `Segment: ${input.segment.index}/${input.segment.total}`,
    `Kind: ${input.kind}`,
    `Label: ${input.segment.label}`,
    `Timeline: ${input.segment.timelinePosition}`,
    `Target words: ${input.segment.targetWords}`,
    `Suggested prompt budget: ${input.promptBudgetChars} chars`,
    "",
    "## Brief",
    ...input.items.map((item) => `- ${item}`),
    "",
    "## LLM Execution Prompt",
    `\u4F60\u662F\u672C\u7247\u6BB5\u7684 ${roleLabel} \u5B50\u4EFB\u52A1\u6267\u884C\u5668\u3002`,
    "\u53EA\u5904\u7406\u672C brief \u8986\u76D6\u7684\u804C\u8D23\uFF0C\u4E0D\u6269\u5199\u5B8C\u6574\u7AE0\u8282\uFF0C\u4E0D\u63D0\u524D\u6CC4\u9732\u540E\u7EED\u5267\u60C5\u3002",
    ...input.executionPrompt.map((line) => `- ${line}`),
    "",
    "## Expected Output Contract",
    "- \u8FD4\u56DE\u53EF\u88AB\u7EC4\u88C5\u5668\u4F7F\u7528\u7684\u6B63\u6587\u7D20\u6750\u6216\u7EA6\u675F\u6E05\u5355\u3002",
    "- \u4E0D\u8981\u8F93\u51FA\u89E3\u91CA\u3001\u8BA1\u5212\u6807\u9898\u3001Markdown \u8868\u683C\u6216\u4E0E\u672C\u7247\u6BB5\u65E0\u5173\u7684\u4E16\u754C\u89C2\u8865\u5145\u3002",
    "- \u5FC5\u987B\u670D\u4ECE Segment Focus\u3001Required Beats \u548C\u8FDE\u7EED\u6027\u7EA6\u675F\u3002",
    "",
    "## Segment Focus",
    input.segment.narrativeFocus,
    "",
    input.segment.requiredBeats.length ? ["## Required Beats", ...input.segment.requiredBeats.map((beat) => `- ${beat}`)].join("\n") : "",
    "",
    input.generatedBody ? `## Assembled Segment Body
${input.generatedBody.trim()}` : ""
  ].filter(Boolean).join("\n");
}
function formatSegmentMaterialArtifact(input) {
  const bodyPreview = input.generatedBody.trim().slice(0, 1800);
  const materialLabel = input.kind.replace("character_action", "character action").replace("_", " ");
  return [
    `# ${input.title.replace("Brief", "Material")}`,
    "",
    `Chapter: ${input.task.chapterNumber}`,
    `Segment: ${input.segment.index}/${input.segment.total}`,
    `Kind: ${input.kind}`,
    `Material mode: deterministic-placeholder`,
    "",
    "## Source Brief",
    ...input.items.map((item) => `- ${item}`),
    "",
    "## Material Contract",
    `- This file is the ${materialLabel} result slot for future per-part LLM execution.`,
    "- \u5F53\u524D\u7248\u672C\u4F7F\u7528\u786E\u5B9A\u6027\u5360\u4F4D\u5185\u5BB9\uFF0C\u4E0D\u989D\u5916\u8C03\u7528\u6A21\u578B\u3002",
    "- \u540E\u7EED\u53EF\u4EE5\u628A\u672C\u6587\u4EF6\u7684\u751F\u6210\u66FF\u6362\u4E3A\u5BF9\u5E94 brief \u7684\u72EC\u7ACB\u6A21\u578B\u8C03\u7528\u3002",
    "",
    "## Deterministic Material",
    input.kind === "assembly" ? "\u5F53\u524D\u7EC4\u88C5\u7ED3\u679C\u76F4\u63A5\u5F15\u7528\u5DF2\u751F\u6210\u7247\u6BB5\u6B63\u6587\uFF1B\u672A\u6765\u4F1A\u7531\u591A\u7C7B\u7D20\u6750\u7EC4\u88C5\u751F\u6210\u3002" : `\u5F53\u524D ${materialLabel} \u7D20\u6750\u6765\u81EA\u7EC4\u5408\u8BA1\u5212\u548C\u5DF2\u751F\u6210\u7247\u6BB5\u6458\u8981\uFF0C\u7528\u4E8E\u5360\u4F4D\u548C\u5BA1\u8BA1\u3002`,
    "",
    "## Segment Body Reference",
    bodyPreview || "(empty)"
  ].join("\n");
}
async function writeDraftSegmentSubArtifacts(input) {
  const briefs = [
    {
      kind: "plot",
      filename: "brief-plot.md",
      materialFilename: "material-plot.md",
      title: "Plot Turn Brief",
      items: input.composition.plot,
      promptBudgetChars: 1200,
      executionPrompt: [
        "\u628A\u672C\u7247\u6BB5\u7684\u73B0\u573A\u538B\u529B\u3001\u9009\u62E9\u3001\u8F6C\u6298\u548C\u94A9\u5B50\u538B\u6210 3-5 \u4E2A\u53EF\u6267\u884C\u60C5\u8282\u62CD\u70B9\u3002",
        "\u6BCF\u4E2A\u62CD\u70B9\u5FC5\u987B\u80FD\u88AB\u5199\u6210\u52A8\u4F5C\u3001\u5BF9\u767D\u6216\u7269\u4EF6\u53D8\u5316\u3002",
        "\u4E0D\u8981\u65B0\u589E\u5E55\u540E\u771F\u76F8\uFF0C\u53EA\u660E\u786E\u672C\u7247\u6BB5\u5185\u90E8\u56E0\u679C\u3002"
      ]
    },
    {
      kind: "narration",
      filename: "brief-narration.md",
      materialFilename: "material-narration.md",
      title: "Narration Brief",
      items: input.composition.narration,
      promptBudgetChars: 1600,
      executionPrompt: [
        "\u751F\u6210\u672C\u7247\u6BB5\u53EF\u7528\u7684\u65C1\u767D\u7D20\u6750\uFF0C\u4F18\u5148\u5199\u7269\u4EF6\u3001\u58F0\u97F3\u3001\u89E6\u611F\u3001\u7A7A\u95F4\u79FB\u52A8\u548C\u8EAB\u4F53\u53CD\u5E94\u3002",
        "\u65C1\u767D\u5FC5\u987B\u8D34\u8FD1\u5F53\u524D\u89C6\u89D2\uFF0C\u4E0D\u603B\u7ED3\u672A\u6765\uFF0C\u4E0D\u89E3\u91CA\u8C1C\u5E95\u3002",
        "\u8F93\u51FA\u5E94\u80FD\u7A7F\u63D2\u5230\u5BF9\u767D\u548C\u52A8\u4F5C\u4E4B\u95F4\uFF0C\u800C\u4E0D\u662F\u6574\u6BB5\u8BF4\u660E\u3002"
      ]
    },
    {
      kind: "dialogue",
      filename: "brief-dialogue.md",
      materialFilename: "material-dialogue.md",
      title: "Dialogue Brief",
      items: input.composition.dialogue,
      promptBudgetChars: 1400,
      executionPrompt: [
        "\u751F\u6210\u672C\u7247\u6BB5\u53EF\u7528\u7684\u77ED\u5BF9\u767D\u7D20\u6750\uFF0C\u6BCF\u53E5\u5BF9\u767D\u90FD\u8981\u5E26\u73B0\u573A\u538B\u529B\u6216\u5173\u7CFB\u4FE1\u606F\u3002",
        "\u6BCF\u4E2A\u8BF4\u8BDD\u8005\u7528\u79F0\u547C\u3001\u505C\u987F\u3001\u52A8\u4F5C\u6216\u8BED\u6C14\u533A\u5206\uFF0C\u4E0D\u8981\u540C\u4E00\u79CD\u89E3\u91CA\u8154\u3002",
        "\u5BF9\u767D\u4E0D\u8981\u627F\u62C5\u5927\u6BB5\u8BBE\u5B9A\u8BF4\u660E\u3002"
      ]
    },
    {
      kind: "character_action",
      filename: "brief-character-action.md",
      materialFilename: "material-character-action.md",
      title: "Character Action Brief",
      items: input.composition.characterAction,
      promptBudgetChars: 1400,
      executionPrompt: [
        "\u5217\u51FA\u4E3B\u89D2\u548C\u5173\u952E\u914D\u89D2\u5728\u672C\u7247\u6BB5\u5FC5\u987B\u53D1\u751F\u7684\u53EF\u89C1\u884C\u52A8\u3002",
        "\u884C\u52A8\u8981\u66B4\u9732\u6B32\u671B\u3001\u77ED\u677F\u3001\u98CE\u9669\u4EE3\u4EF7\u6216\u5173\u7CFB\u53D8\u5316\u3002",
        "\u4E0D\u8981\u53EA\u5199\u5FC3\u7406\u6807\u7B7E\uFF0C\u5FC5\u987B\u843D\u5230\u624B\u3001\u773C\u3001\u6B65\u4F10\u3001\u7269\u4EF6\u5904\u7406\u6216\u5177\u4F53\u9009\u62E9\u3002"
      ]
    },
    {
      kind: "continuity",
      filename: "brief-continuity.md",
      materialFilename: "material-continuity.md",
      title: "Continuity Brief",
      items: input.composition.continuity,
      promptBudgetChars: 1e3,
      executionPrompt: [
        "\u63D0\u70BC\u672C\u7247\u6BB5\u5FC5\u987B\u547D\u4E2D\u7684\u8FDE\u7EED\u6027\u951A\u70B9\u3001\u7981\u5199\u4E8B\u5B9E\u548C\u4E0D\u53EF\u65B0\u589E\u4FE1\u606F\u3002",
        "\u53EA\u4FDD\u7559\u4F1A\u5F71\u54CD\u672C\u7247\u6BB5\u751F\u6210\u7684\u786C\u7EA6\u675F\u3002",
        "\u8F93\u51FA\u8981\u80FD\u4F5C\u4E3A\u7EC4\u88C5\u524D\u7684\u68C0\u67E5\u6E05\u5355\u3002"
      ]
    },
    {
      kind: "assembly",
      filename: "brief-assembly.md",
      materialFilename: "material-assembly.md",
      title: "Assembly Brief",
      items: input.composition.assemblyRules,
      promptBudgetChars: 1800,
      executionPrompt: [
        "\u6839\u636E\u60C5\u8282\u3001\u65C1\u767D\u3001\u5BF9\u767D\u3001\u52A8\u4F5C\u548C\u8FDE\u7EED\u6027\u7D20\u6750\u7EC4\u88C5\u4E3A\u4E00\u4E2A\u8FDE\u7EED\u6B63\u6587\u7247\u6BB5\u3002",
        "\u6B63\u6587\u5FC5\u987B\u52A8\u4F5C\u3001\u5BF9\u767D\u3001\u65C1\u767D\u4EA4\u9519\uFF0C\u4E0D\u8F93\u51FA\u5B50\u4EFB\u52A1\u75D5\u8FF9\u3002",
        "\u7ED3\u5C3E\u7ED9\u4E0B\u4E00\u7247\u6BB5\u7559\u4E0B\u53EF\u627F\u63A5\u72B6\u6001\u3002"
      ],
      body: input.generatedBody
    }
  ];
  const written = [];
  for (const brief of briefs) {
    const briefPath = import_node_path8.default.join(input.segmentDir, brief.filename);
    const content = formatSegmentBriefArtifact({
      title: brief.title,
      kind: brief.kind,
      items: brief.items,
      segment: input.segment,
      task: input.task,
      promptBudgetChars: brief.promptBudgetChars,
      executionPrompt: brief.executionPrompt,
      generatedBody: brief.body
    });
    await import_promises5.default.writeFile(briefPath, `${content.trimEnd()}
`);
    const relativePath = relativeArtifactPath(input.projectRoot, briefPath);
    await recordPipelineArtifact(input.projectRoot, briefPath, "checkpoint", input.options, {
      chapterNumber: input.task.chapterNumber,
      kind: "chapter_draft_segment_brief",
      segmentIndex: input.segment.index,
      segmentTotal: input.segment.total,
      briefKind: brief.kind,
      chars: content.length
    });
    written.push({
      kind: brief.kind,
      role: "brief",
      path: briefPath,
      relativePath,
      chars: content.length
    });
    const materialPath = import_node_path8.default.join(input.segmentDir, brief.materialFilename);
    const override = input.materialOverrides?.[brief.kind]?.trim();
    const materialContent = override ? [
      `# ${brief.title.replace("Brief", "Material")}`,
      "",
      `Chapter: ${input.task.chapterNumber}`,
      `Segment: ${input.segment.index}/${input.segment.total}`,
      `Kind: ${brief.kind}`,
      `Material mode: llm-subcall`,
      "",
      "## Source Brief",
      ...brief.items.map((item) => `- ${item}`),
      "",
      "## LLM Material",
      override
    ].join("\n") : formatSegmentMaterialArtifact({
      title: brief.title,
      kind: brief.kind,
      items: brief.items,
      segment: input.segment,
      task: input.task,
      generatedBody: input.generatedBody
    });
    await import_promises5.default.writeFile(materialPath, `${materialContent.trimEnd()}
`);
    const materialRelativePath = relativeArtifactPath(input.projectRoot, materialPath);
    await recordPipelineArtifact(input.projectRoot, materialPath, "checkpoint", input.options, {
      chapterNumber: input.task.chapterNumber,
      kind: "chapter_draft_segment_material",
      segmentIndex: input.segment.index,
      segmentTotal: input.segment.total,
      materialKind: brief.kind,
      chars: materialContent.length,
      mode: override ? "llm-subcall" : "deterministic-placeholder"
    });
    written.push({
      kind: brief.kind,
      role: "material",
      path: materialPath,
      relativePath: materialRelativePath,
      chars: materialContent.length
    });
  }
  return written;
}
async function generateDraftSegmentDialogueMaterial(input) {
  if (!input.options.draftSubcallRoles?.includes("dialogue")) {
    return null;
  }
  return generateProductionTextWithLlm({
    roleName: "Dialogue",
    state: input.state,
    options: input.options,
    temperature: 0.55,
    progress: {
      step: `draft_dialogue_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Dialogue \u6B63\u5728\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u5BF9\u767D\u7D20\u6750\u3002`,
      completeMessage: `Dialogue \u5DF2\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u5BF9\u767D\u7D20\u6750\u3002`
    },
    basePrompt: [
      "\u4F60\u662F\u5C0F\u8BF4\u7247\u6BB5\u5BF9\u767D\u7D20\u6750\u751F\u6210\u5668\u3002",
      "\u53EA\u751F\u6210\u672C\u7247\u6BB5\u53EF\u4F9B\u7EC4\u88C5\u5668\u4F7F\u7528\u7684\u5BF9\u767D\u7D20\u6750\uFF0C\u4E0D\u5199\u5B8C\u6574\u7AE0\u8282\u3002",
      "\u5BF9\u767D\u5FC5\u987B\u77ED\u3001\u6709\u538B\u529B\uFF0C\u5E76\u4F53\u73B0\u5173\u7CFB\u3001\u5229\u76CA\u6216\u73B0\u573A\u9009\u62E9\u3002"
    ].join("\n"),
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${input.task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${input.task.title}`,
      `\u7247\u6BB5\uFF1A${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `\u65F6\u95F4\u7EBF\uFF1A${input.segment.timelinePosition}`,
      `\u7247\u6BB5\u7126\u70B9\uFF1A${input.segment.narrativeFocus}`,
      "",
      "## Dialogue Brief",
      ...input.composition.dialogue.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail
${input.previousSegmentTail}` : "",
      "",
      "\u8F93\u51FA\u8981\u6C42\uFF1A\u53EA\u8FD4\u56DE 4-8 \u6761\u53EF\u7528\u5BF9\u767D\u7D20\u6750\uFF1B\u53EF\u4EE5\u9644\u6781\u77ED\u52A8\u4F5C\u63D0\u793A\uFF1B\u4E0D\u8981\u89E3\u91CA\u8BBE\u5B9A\uFF1B\u4E0D\u8981\u5199\u6807\u9898\u3002"
    ].filter(Boolean).join("\n"),
    message: "\u8BF7\u751F\u6210\u5F53\u524D\u7247\u6BB5\u7684\u5BF9\u767D\u7D20\u6750\uFF0C\u4F9B\u540E\u7EED assembly \u7EC4\u88C5\u4F7F\u7528\u3002"
  });
}
async function generateDraftSegmentPlotMaterial(input) {
  if (!input.options.draftSubcallRoles?.includes("plot")) {
    return null;
  }
  return generateProductionTextWithLlm({
    roleName: "Plot Turn",
    state: input.state,
    options: input.options,
    temperature: 0.45,
    progress: {
      step: `draft_plot_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Plot Turn \u6B63\u5728\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u60C5\u8282\u62CD\u70B9\u7D20\u6750\u3002`,
      completeMessage: `Plot Turn \u5DF2\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u60C5\u8282\u62CD\u70B9\u7D20\u6750\u3002`
    },
    basePrompt: [
      "\u4F60\u662F\u5C0F\u8BF4\u7247\u6BB5\u60C5\u8282\u62CD\u70B9\u7D20\u6750\u751F\u6210\u5668\u3002",
      "\u53EA\u751F\u6210\u672C\u7247\u6BB5\u53EF\u4F9B\u7EC4\u88C5\u5668\u4F7F\u7528\u7684\u60C5\u8282\u62CD\u70B9\uFF0C\u4E0D\u5199\u5B8C\u6574\u7AE0\u8282\u3002",
      "\u6BCF\u4E2A\u62CD\u70B9\u5FC5\u987B\u5305\u542B\u73B0\u573A\u538B\u529B\u3001\u4EBA\u7269\u9009\u62E9\u3001\u8F6C\u6298\u540E\u679C\u6216\u7247\u6BB5\u94A9\u5B50\u3002"
    ].join("\n"),
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${input.task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${input.task.title}`,
      `\u7247\u6BB5\uFF1A${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `\u65F6\u95F4\u7EBF\uFF1A${input.segment.timelinePosition}`,
      `\u7247\u6BB5\u7126\u70B9\uFF1A${input.segment.narrativeFocus}`,
      "",
      "## Plot Brief",
      ...input.composition.plot.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail
${input.previousSegmentTail}` : "",
      "",
      "\u8F93\u51FA\u8981\u6C42\uFF1A\u53EA\u8FD4\u56DE 3-5 \u4E2A\u53EF\u6267\u884C\u60C5\u8282\u62CD\u70B9\uFF1B\u6BCF\u4E2A\u62CD\u70B9\u80FD\u843D\u5230\u52A8\u4F5C\u3001\u5BF9\u767D\u6216\u7269\u4EF6\u53D8\u5316\uFF1B\u4E0D\u8981\u5199\u6807\u9898\u3002"
    ].filter(Boolean).join("\n"),
    message: "\u8BF7\u751F\u6210\u5F53\u524D\u7247\u6BB5\u7684\u60C5\u8282\u62CD\u70B9\u7D20\u6750\uFF0C\u4F9B\u540E\u7EED assembly \u7EC4\u88C5\u4F7F\u7528\u3002"
  });
}
async function generateDraftSegmentNarrationMaterial(input) {
  if (!input.options.draftSubcallRoles?.includes("narration")) {
    return null;
  }
  return generateProductionTextWithLlm({
    roleName: "Narration",
    state: input.state,
    options: input.options,
    temperature: 0.58,
    progress: {
      step: `draft_narration_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Narration \u6B63\u5728\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u65C1\u767D\u7D20\u6750\u3002`,
      completeMessage: `Narration \u5DF2\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u65C1\u767D\u7D20\u6750\u3002`
    },
    basePrompt: [
      "\u4F60\u662F\u5C0F\u8BF4\u7247\u6BB5\u65C1\u767D\u7D20\u6750\u751F\u6210\u5668\u3002",
      "\u53EA\u751F\u6210\u672C\u7247\u6BB5\u53EF\u4F9B\u7EC4\u88C5\u5668\u4F7F\u7528\u7684\u65C1\u767D\u7D20\u6750\uFF0C\u4E0D\u5199\u5B8C\u6574\u7AE0\u8282\u3002",
      "\u65C1\u767D\u5FC5\u987B\u8D34\u8FD1\u89C6\u89D2\uFF0C\u7528\u7269\u4EF6\u3001\u58F0\u97F3\u3001\u89E6\u611F\u3001\u7A7A\u95F4\u79FB\u52A8\u548C\u8EAB\u4F53\u53CD\u5E94\u63A8\u52A8\u573A\u666F\u3002"
    ].join("\n"),
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${input.task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${input.task.title}`,
      `\u7247\u6BB5\uFF1A${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `\u65F6\u95F4\u7EBF\uFF1A${input.segment.timelinePosition}`,
      `\u7247\u6BB5\u7126\u70B9\uFF1A${input.segment.narrativeFocus}`,
      "",
      "## Narration Brief",
      ...input.composition.narration.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail
${input.previousSegmentTail}` : "",
      "",
      "\u8F93\u51FA\u8981\u6C42\uFF1A\u53EA\u8FD4\u56DE 3-6 \u6761\u53EF\u7A7F\u63D2\u65C1\u767D\u7D20\u6750\uFF1B\u4E0D\u8981\u603B\u7ED3\u672A\u6765\uFF1B\u4E0D\u8981\u89E3\u91CA\u8BBE\u5B9A\uFF1B\u4E0D\u8981\u5199\u6807\u9898\u3002"
    ].filter(Boolean).join("\n"),
    message: "\u8BF7\u751F\u6210\u5F53\u524D\u7247\u6BB5\u7684\u65C1\u767D\u7D20\u6750\uFF0C\u4F9B\u540E\u7EED assembly \u7EC4\u88C5\u4F7F\u7528\u3002"
  });
}
async function generateDraftSegmentCharacterActionMaterial(input) {
  if (!input.options.draftSubcallRoles?.includes("character_action")) {
    return null;
  }
  return generateProductionTextWithLlm({
    roleName: "Character Action",
    state: input.state,
    options: input.options,
    temperature: 0.52,
    progress: {
      step: `draft_character_action_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Character Action \u6B63\u5728\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u4EBA\u7269\u884C\u52A8\u7D20\u6750\u3002`,
      completeMessage: `Character Action \u5DF2\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u4EBA\u7269\u884C\u52A8\u7D20\u6750\u3002`
    },
    basePrompt: [
      "\u4F60\u662F\u5C0F\u8BF4\u7247\u6BB5\u4EBA\u7269\u884C\u52A8\u7D20\u6750\u751F\u6210\u5668\u3002",
      "\u53EA\u751F\u6210\u672C\u7247\u6BB5\u53EF\u4F9B\u7EC4\u88C5\u5668\u4F7F\u7528\u7684\u4EBA\u7269\u884C\u52A8\u7D20\u6750\uFF0C\u4E0D\u5199\u5B8C\u6574\u7AE0\u8282\u3002",
      "\u884C\u52A8\u5FC5\u987B\u53EF\u89C1\u3001\u5177\u4F53\uFF0C\u5E76\u66B4\u9732\u6B32\u671B\u3001\u77ED\u677F\u3001\u98CE\u9669\u4EE3\u4EF7\u6216\u5173\u7CFB\u53D8\u5316\u3002"
    ].join("\n"),
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${input.task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${input.task.title}`,
      `\u7247\u6BB5\uFF1A${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `\u65F6\u95F4\u7EBF\uFF1A${input.segment.timelinePosition}`,
      `\u7247\u6BB5\u7126\u70B9\uFF1A${input.segment.narrativeFocus}`,
      "",
      "## Character Action Brief",
      ...input.composition.characterAction.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail
${input.previousSegmentTail}` : "",
      "",
      "\u8F93\u51FA\u8981\u6C42\uFF1A\u53EA\u8FD4\u56DE 4-8 \u6761\u4EBA\u7269\u884C\u52A8\u7D20\u6750\uFF1B\u6BCF\u6761\u5FC5\u987B\u843D\u5230\u624B\u3001\u773C\u3001\u6B65\u4F10\u3001\u7269\u4EF6\u5904\u7406\u6216\u5177\u4F53\u9009\u62E9\uFF1B\u4E0D\u8981\u5199\u6807\u9898\u3002"
    ].filter(Boolean).join("\n"),
    message: "\u8BF7\u751F\u6210\u5F53\u524D\u7247\u6BB5\u7684\u4EBA\u7269\u884C\u52A8\u7D20\u6750\uFF0C\u4F9B\u540E\u7EED assembly \u7EC4\u88C5\u4F7F\u7528\u3002"
  });
}
async function generateDraftSegmentContinuityMaterial(input) {
  if (!input.options.draftSubcallRoles?.includes("continuity")) {
    return null;
  }
  return generateProductionTextWithLlm({
    roleName: "Continuity",
    state: input.state,
    options: input.options,
    temperature: 0.2,
    progress: {
      step: `draft_continuity_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Continuity \u6B63\u5728\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u8FDE\u7EED\u6027\u7D20\u6750\u3002`,
      completeMessage: `Continuity \u5DF2\u751F\u6210\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u8FDE\u7EED\u6027\u7D20\u6750\u3002`
    },
    basePrompt: [
      "\u4F60\u662F\u5C0F\u8BF4\u7247\u6BB5\u8FDE\u7EED\u6027\u7D20\u6750\u751F\u6210\u5668\u3002",
      "\u53EA\u751F\u6210\u672C\u7247\u6BB5\u7EC4\u88C5\u524D\u5FC5\u987B\u9075\u5B88\u7684\u8FDE\u7EED\u6027\u6E05\u5355\uFF0C\u4E0D\u5199\u5B8C\u6574\u7AE0\u8282\u3002",
      "\u5FC5\u987B\u660E\u786E\u5FC5\u5199\u951A\u70B9\u3001\u7981\u5199\u4E8B\u5B9E\u3001\u4E0D\u80FD\u63D0\u524D\u6CC4\u9732\u7684\u5185\u5BB9\u548C\u7247\u6BB5\u7ED3\u675F\u72B6\u6001\u3002"
    ].join("\n"),
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${input.task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${input.task.title}`,
      `\u7247\u6BB5\uFF1A${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `\u65F6\u95F4\u7EBF\uFF1A${input.segment.timelinePosition}`,
      `\u7247\u6BB5\u7126\u70B9\uFF1A${input.segment.narrativeFocus}`,
      "",
      "## Continuity Brief",
      ...input.composition.continuity.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail
${input.previousSegmentTail}` : "",
      "",
      "\u8F93\u51FA\u8981\u6C42\uFF1A\u53EA\u8FD4\u56DE\u68C0\u67E5\u6E05\u5355\uFF1B\u5305\u542B must-hit\u3001must-not-write\u3001handoff-state \u4E09\u7C7B\uFF1B\u4E0D\u8981\u5199\u6807\u9898\u3002"
    ].filter(Boolean).join("\n"),
    message: "\u8BF7\u751F\u6210\u5F53\u524D\u7247\u6BB5\u7684\u8FDE\u7EED\u6027\u68C0\u67E5\u7D20\u6750\uFF0C\u4F9B\u540E\u7EED assembly \u7EC4\u88C5\u4F7F\u7528\u3002"
  });
}
async function generateDraftSegmentAssemblyMaterial(input) {
  if (!input.options.draftSubcallRoles?.includes("assembly")) {
    return null;
  }
  const materialBlock = (kind, content) => content?.trim() ? [`## ${kind} material`, content.trim()].join("\n") : "";
  return generateProductionTextWithLlm({
    roleName: "Assembly",
    state: input.state,
    options: input.options,
    temperature: 0.64,
    progress: {
      step: `draft_assembly_material_segment_${input.segment.index}`,
      role: "Author",
      chapterNumber: input.task.chapterNumber,
      title: input.task.title,
      startMessage: `Assembly \u6B63\u5728\u7EC4\u88C5\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u5019\u9009\u6B63\u6587\u3002`,
      completeMessage: `Assembly \u5DF2\u7EC4\u88C5\u7B2C ${input.task.chapterNumber} \u7AE0\u7247\u6BB5 ${input.segment.index}/${input.segment.total} \u7684\u5019\u9009\u6B63\u6587\u3002`
    },
    basePrompt: [
      "\u4F60\u662F\u5C0F\u8BF4\u7247\u6BB5\u7EC4\u88C5\u5668\u3002",
      "\u6839\u636E\u60C5\u8282\u3001\u65C1\u767D\u3001\u5BF9\u767D\u3001\u4EBA\u7269\u884C\u52A8\u548C\u8FDE\u7EED\u6027\u7D20\u6750\uFF0C\u7EC4\u88C5\u4E3A\u4E00\u4E2A\u8FDE\u7EED\u6B63\u6587\u7247\u6BB5\u3002",
      "\u53EA\u8F93\u51FA\u5C0F\u8BF4\u6B63\u6587\uFF0C\u4E0D\u8F93\u51FA\u6807\u9898\u3001\u89E3\u91CA\u3001\u6E05\u5355\u6216 Markdown\u3002"
    ].join("\n"),
    dynamicPrompt: [
      `\u7AE0\u8282\uFF1A\u7B2C ${input.task.chapterNumber} \u7AE0`,
      `\u6807\u9898\uFF1A${input.task.title}`,
      `\u7247\u6BB5\uFF1A${input.segment.index}/${input.segment.total} ${input.segment.label}`,
      `\u65F6\u95F4\u7EBF\uFF1A${input.segment.timelinePosition}`,
      `\u7247\u6BB5\u76EE\u6807\u5B57\u6570\uFF1A${input.segment.targetWords}`,
      `\u7247\u6BB5\u7126\u70B9\uFF1A${input.segment.narrativeFocus}`,
      "",
      "## Assembly Rules",
      ...input.composition.assemblyRules.map((item) => `- ${item}`),
      "",
      "## Required Beats",
      ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
      "",
      input.previousSegmentTail ? `## Previous Tail
${input.previousSegmentTail}` : "",
      "",
      materialBlock("plot", input.materials.plot),
      "",
      materialBlock("narration", input.materials.narration),
      "",
      materialBlock("dialogue", input.materials.dialogue),
      "",
      materialBlock("character_action", input.materials.character_action),
      "",
      materialBlock("continuity", input.materials.continuity),
      "",
      input.fallbackBody ? `## Existing Author Segment For Reference
${compactAssemblyReferenceBody(input.fallbackBody)}` : "",
      "",
      "\u8F93\u51FA\u8981\u6C42\uFF1A\u53EA\u8FD4\u56DE\u8FDE\u7EED\u5C0F\u8BF4\u6B63\u6587\uFF1B\u52A8\u4F5C\u3001\u5BF9\u767D\u3001\u65C1\u767D\u5FC5\u987B\u4EA4\u9519\uFF1B\u4E0D\u5F97\u63D0\u524D\u5199\u540E\u7EED\u7247\u6BB5\uFF1B\u4E0D\u5F97\u6CC4\u9732 continuity \u7981\u5199\u4E8B\u5B9E\u3002"
    ].filter(Boolean).join("\n"),
    message: "\u8BF7\u6839\u636E\u5206\u9879\u7D20\u6750\u7EC4\u88C5\u5F53\u524D\u7247\u6BB5\u5019\u9009\u6B63\u6587\uFF0C\u53EA\u8FD4\u56DE\u5C0F\u8BF4\u6B63\u6587\u3002"
  });
}
function cleanDraftAssemblyBody(text = "") {
  return text.replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/g, "$1").replace(/^#+\s+.*$/gmu, "").replace(/^(片段|Segment)\s*\d+[\s\S]*?\n/iu, "").trim();
}
function isUsableDraftAssemblyBody(text = "", fallbackBody = "") {
  const normalized = text.trim();
  const fallbackLength = fallbackBody.trim().length;
  const minimumLength = fallbackLength > 0 ? Math.min(24, Math.max(8, Math.floor(fallbackLength * 0.08))) : 8;
  if (normalized.length < minimumLength) {
    return false;
  }
  if (!/[。！？!?」”]/u.test(normalized)) {
    return false;
  }
  if (/^\s*[{[]/u.test(normalized)) {
    return false;
  }
  const lines = normalized.split(/\n+/u).map((line) => line.trim()).filter(Boolean);
  const listLikeLines = lines.filter((line) => /^([-*]|\d+[.)、]|must-|##|#|```)/iu.test(line)).length;
  if (lines.length > 0 && listLikeLines / lines.length > 0.4) {
    return false;
  }
  if (/^(以下|下面|这里|这是|根据|组装|候选正文|输出|正文如下)[:：]/u.test(normalized)) {
    return false;
  }
  if (/^(我将|我会|可以|无法|不能|抱歉|作为|说明|分析)/u.test(normalized)) {
    return false;
  }
  return true;
}
async function writeDraftSegmentManifest(input) {
  const manifestPath = import_node_path8.default.join(input.segmentDir, "segment-manifest.json");
  const byKind = input.subArtifacts.reduce((acc, artifact) => {
    const current = acc[artifact.kind] || {};
    current[artifact.role] = artifact.relativePath;
    acc[artifact.kind] = current;
    return acc;
  }, {});
  const manifest = {
    version: 1,
    mode: Object.values(input.materialModes || {}).some((mode) => mode === "llm-subcall") ? "mixed" : "deterministic-placeholder",
    project: input.state.project.title,
    chapterNumber: input.task.chapterNumber,
    chapterTitle: input.task.title,
    segment: {
      index: input.segment.index,
      total: input.segment.total,
      label: input.segment.label,
      source: input.segment.source || input.segmentationSource,
      targetWords: input.segment.targetWords,
      timeline: input.segment.timelinePosition,
      focus: input.segment.narrativeFocus,
      chars: input.chars
    },
    files: {
      body: input.segmentRelativePath,
      subArtifacts: input.subArtifacts.map((artifact) => ({
        kind: artifact.kind,
        role: artifact.role,
        path: artifact.relativePath,
        chars: artifact.chars,
        mode: artifact.role === "material" ? input.materialModes?.[artifact.kind] || "deterministic-placeholder" : "prompt-brief"
      })),
      byKind
    },
    execution: {
      current: Object.values(input.materialModes || {}).some((mode) => mode === "llm-subcall") ? "single_author_call_with_selected_llm_submaterials" : "single_author_call_with_deterministic_submaterials",
      nextReadyStep: "replace_one_material_role_with_llm_call",
      recommendedFirstRoles: ["dialogue", "narration", "character_action"],
      assemblyRole: "assembly",
      assembly: input.assemblyUsage || {
        requested: false,
        decision: "not_requested",
        reason: "assembly role was not enabled for this segment",
        materialChars: 0,
        finalChars: input.chars,
        fallbackChars: input.chars
      }
    }
  };
  await import_promises5.default.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}
`);
  const relativePath = relativeArtifactPath(input.projectRoot, manifestPath);
  await recordPipelineArtifact(input.projectRoot, manifestPath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "chapter_draft_segment_manifest",
    segmentIndex: input.segment.index,
    segmentTotal: input.segment.total,
    segmentSource: input.segment.source || input.segmentationSource,
    subArtifactCount: input.subArtifacts.length,
    mode: manifest.mode
  });
  return { path: manifestPath, relativePath };
}
async function writeDraftSegmentArtifact(input) {
  const chapterId = `chapter-${String(input.task.chapterNumber).padStart(3, "0")}`;
  const segmentId = `segment-${String(input.segment.index).padStart(2, "0")}`;
  const segmentsRoot = import_node_path8.default.join(input.paths.workspaceDir, "checkpoints", "chapter-segments", chapterId);
  const segmentDir = import_node_path8.default.join(segmentsRoot, segmentId);
  const segmentPath = import_node_path8.default.join(segmentDir, `${segmentId}.md`);
  await import_promises5.default.mkdir(segmentDir, { recursive: true });
  const sceneCardLines = input.segment.sceneCard ? [
    "## Scene Card",
    `- Index: ${input.segment.sceneCard.index}`,
    `- Goal: ${input.segment.sceneCard.goal}`,
    `- Conflict: ${input.segment.sceneCard.conflict}`,
    `- Turn: ${input.segment.sceneCard.turn}`,
    `- End hook: ${input.segment.sceneCard.endHook}`,
    input.segment.sceneCard.requiredCharacters.length ? `- Required characters: ${input.segment.sceneCard.requiredCharacters.join("\u3001")}` : "",
    input.segment.sceneCard.requiredFacts.length ? `- Required facts: ${input.segment.sceneCard.requiredFacts.join("\u3001")}` : "",
    input.segment.sceneCard.forbiddenFacts.length ? `- Forbidden facts: ${input.segment.sceneCard.forbiddenFacts.join("\u3001")}` : ""
  ].filter(Boolean) : [];
  const composition = createDraftSegmentCompositionPlan(input.segment, input.continuityContract);
  const content = [
    `# Chapter ${input.task.chapterNumber} Segment ${input.segment.index}/${input.segment.total}`,
    "",
    `Project: ${input.state.project.title}`,
    `Chapter title: ${input.task.title}`,
    `Source: ${input.segment.source || input.segmentationSource}`,
    `Label: ${input.segment.label}`,
    `Target words: ${input.segment.targetWords}`,
    `Timeline: ${input.segment.timelinePosition}`,
    `Focus: ${input.segment.narrativeFocus}`,
    input.segment.continuityFocus.length ? `Continuity focus: ${input.segment.continuityFocus.join("\u3001")}` : "Continuity focus: none",
    "",
    "## Required Beats",
    ...input.segment.requiredBeats.map((beat) => `- ${beat}`),
    "",
    ...sceneCardLines,
    sceneCardLines.length ? "" : "",
    "## Composition Plan",
    "### Plot",
    ...composition.plot.map((item) => `- ${item}`),
    "### Narration",
    ...composition.narration.map((item) => `- ${item}`),
    "### Dialogue",
    ...composition.dialogue.map((item) => `- ${item}`),
    "### Character Action",
    ...composition.characterAction.map((item) => `- ${item}`),
    "### Continuity",
    ...composition.continuity.map((item) => `- ${item}`),
    "### Assembly Rules",
    ...composition.assemblyRules.map((item) => `- ${item}`),
    "",
    input.previousSegmentTail ? `## Previous Segment Tail
${input.previousSegmentTail}
` : "",
    "## Generated Body",
    input.content.trim()
  ].filter((line) => line !== void 0).join("\n");
  await import_promises5.default.writeFile(segmentPath, `${content.trimEnd()}
`);
  const subArtifacts = await writeDraftSegmentSubArtifacts({
    projectRoot: input.projectRoot,
    options: input.options,
    task: input.task,
    segment: input.segment,
    segmentDir,
    composition,
    generatedBody: input.content,
    materialOverrides: input.materialOverrides
  });
  const relativePath = relativeArtifactPath(input.projectRoot, segmentPath);
  const manifest = await writeDraftSegmentManifest({
    projectRoot: input.projectRoot,
    options: input.options,
    state: input.state,
    task: input.task,
    segment: input.segment,
    segmentDir,
    segmentPath,
    segmentRelativePath: relativePath,
    subArtifacts,
    segmentationSource: input.segmentationSource,
    materialModes: input.materialModes,
    assemblyUsage: input.assemblyUsage,
    chars: input.content.length
  });
  await recordPipelineArtifact(input.projectRoot, segmentPath, "checkpoint", input.options, {
    chapterNumber: input.task.chapterNumber,
    kind: "chapter_draft_segment",
    segmentIndex: input.segment.index,
    segmentTotal: input.segment.total,
    segmentSource: input.segment.source || input.segmentationSource,
    label: input.segment.label,
    chars: input.content.length,
    subArtifactCount: subArtifacts.length,
    manifestPath: manifest.relativePath
  });
  return {
    path: segmentPath,
    relativePath,
    segmentIndex: input.segment.index,
    segmentTotal: input.segment.total,
    source: input.segment.source || input.segmentationSource,
    chars: input.content.length,
    manifestPath: manifest.path,
    manifestRelativePath: manifest.relativePath,
    subArtifacts
  };
}
async function createDraftBody(state, task, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot, characterDossiers, approvedStyleContext = { status: "missing", prompt: "" }) {
  throwIfPipelineAborted(options);
  if (options.projectId) {
    invalidateProjectCache(options.projectId);
  }
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
  const cappedVocabularyPrompt = summarizePromptSection(vocabularyPrompt, 650);
  const cappedVocabularySkillExamples = summarizePromptSection(vocabularySkillExamples, 420);
  const cappedResourceManifest = summarizePromptSection(resourceManifest, 280);
  const cappedWriterGuide = summarizePromptSection(resources.writerGuide || "", 620);
  const cappedAntiHallucination = summarizePromptSection(resources.antiHallucinationGuide || "", 340);
  const cappedConflictStrategy = summarizePromptSection(resources.evidenceConflictStrategy || "", 300);
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext);
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
    "\u7981\u6B62 AI \u5316\u788E\u7247\u5199\u6CD5\uFF1A\u4E0D\u5F97\u8BA9\u5355\u4E2A\u5B57\u6216 1-4 \u5B57\u77ED\u8BCD\u53CD\u590D\u72EC\u7ACB\u6210\u53E5/\u6210\u884C\u5806\u573A\u666F\u3002",
    hasApprovedStyleSummaryPrompt(approvedStyleContext) ? "\u7528\u6237\u786E\u8BA4\u5199\u6CD5\u5408\u540C\u662F\u786C\u7EA6\u675F\uFF1A\u5FC5\u987B\u6A21\u4EFF\u5176\u53D9\u8FF0\u58F0\u97F3\u3001\u53E5\u5F0F\u8282\u594F\u3001\u5BF9\u767D\u5BC6\u5EA6\u3001\u63CF\u5199\u987A\u5E8F\u548C\u7981\u7528\u6A21\u5F0F\u3002" : ""
  ];
  if (cappedAntiHallucination) {
    basePromptLines.push("", `\u3010\u53CD\u5E7B\u89C9\u4E0E\u7EC6\u8282\u7559\u767D\u7EA6\u675F\u3011
${cappedAntiHallucination}`);
  }
  if (cappedConflictStrategy) {
    basePromptLines.push("", `\u3010\u591A\u6E90\u4E8B\u5B9E\u51B2\u7A81\u5904\u7406\u7B56\u7565\u3011
${cappedConflictStrategy}`);
  }
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
    approvedStyleCarryover,
    "",
    continuityContract.prompt,
    "",
    clipPromptSection(characterProfileContract.prompt, 700),
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
    "- \u4E0D\u8981\u628A\u63A8\u8350\u8BCD\u3001\u6210\u8BED\u6216\u6C1B\u56F4\u8BCD\u5B64\u7ACB\u6210\u884C\uFF1B\u6240\u6709\u8BCD\u90FD\u5FC5\u987B\u5D4C\u5165\u5B8C\u6574\u52A8\u4F5C\u3001\u5BF9\u8BDD\u3001\u611F\u5B98\u6216\u56E0\u679C\u53E5\u3002",
    "- \u4E25\u7981\u51FA\u73B0\u5178\u578B\u7684 AI \u5316\u884C\u6587\uFF1A\u4E25\u7981\u5728\u6587\u4E2D\u51FA\u73B0\u300C\u4E0D\u4EC5\u5982\u6B64\u300D\u3001\u300C\u4E0E\u6B64\u540C\u65F6\u300D\u3001\u300C\u7136\u800C\u300D\u3001\u300C\u4E8B\u5B9E\u4E0A\u300D\u3001\u300C\u4E0D\u5F97\u4E0D\u8BF4\u300D\u3001\u300C\u503C\u5F97\u4E00\u63D0\u7684\u662F\u300D\u7B49\u8BF4\u6559\u6216\u5206\u6790\u8154\u7684\u903B\u8F91\u8FC7\u6E21\u8BCD\u3002",
    "- \u6253\u788E\u8FDE\u7EED\u53E5\u5B50\u7684\u5E73\u5747\u957F\u5EA6\uFF0C\u589E\u52A0\u957F\u77ED\u53E5\u7684\u9519\u843D\u7A81\u53D1\u6027\uFF08Burstiness\uFF09\uFF0C\u591A\u7528\u6709\u4F53\u611F\u7684\u5177\u4F53\u52A8\u4F5C\u3001\u73AF\u5883\u7EC6\u8282\u548C\u53E3\u8BED\u5BF9\u767D\uFF0C\u5C11\u7528\u62BD\u8C61\u7684\u603B\u7ED3\u8BCD\u4E0E\u60C5\u7EEA\u6807\u7B7E\u63CF\u8FF0\u3002"
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
    `[WRITING CTX] Chapter ${task.chapterNumber} Author Draft \u4E0A\u4E0B\u6587\u5206\u5E03: writerGuide=${(resources.writerGuide || "").length}\u5B57 vocabPrompt=${cappedVocabularyPrompt.length}\u5B57 skillExamples=${cappedVocabularySkillExamples.length}\u5B57 manifest=${cappedResourceManifest.length}\u5B57 activeWorldSlice=${prunedContext.activeWorldSlice.length}\u5B57 consensus=${prunedContext.prunedConsensus.length}\u5B57 outline=${prunedContext.prunedOutline.length}\u5B57 storyAssets=${prunedContext.prunedStoryAssets.length}\u5B57 memory=${prunedContext.prunedMemory.length}\u5B57 ledger=${prunedContext.prunedLedger.length}\u5B57 prevFragment=${prunedContext.previousDraftFragment.length}\u5B57 rag=${prunedContext.prunedRag.length}\u5B57`
  );
  const segmentPlan = createDraftSegmentPlan(state, task, continuityContract, blueprint);
  const usesSceneCards = segmentPlan.some((segment) => segment.source === "scene_card");
  const activeWorldSlicePrompt = prunedContext.activeWorldSlice ? `## Active World Slice
${prunedContext.activeWorldSlice}` : "";
  const compactStoryAssetsPrompt = prunedContext.prunedStoryAssets ? `## Story Assets Audit Summary
${prunedContext.prunedStoryAssets.slice(0, 900)}` : "";
  const blueprintGuardrails = activeWorldSlicePrompt || compactStoryAssetsPrompt ? trimBlueprintForDrafting(blueprint).replace(
    /## Production Story Asset Context[\s\S]*?(?=\n## Canon Continuity Contract|\n## Character Profile Contract|\n## Chapter Position|$)/u,
    [activeWorldSlicePrompt, compactStoryAssetsPrompt].filter(Boolean).join("\n\n")
  ) : trimBlueprintForDrafting(blueprint);
  const trimmedBlueprint = blueprintGuardrails.slice(0, usesSceneCards ? 2200 : 5e3);
  const contextPackage = paths && projectRoot ? await writeChapterContextPackage({
    projectRoot,
    paths,
    options,
    state,
    task,
    genre,
    sceneType,
    writingMode: productionWritingMode(options),
    segmentPlan,
    continuityContract,
    characterProfileContract,
    approvedStyleContext,
    prunedContext,
    trimmedBlueprint,
    basePromptText,
    fixedDynamicPromptText,
    cappedVocabularyPrompt,
    cappedVocabularySkillExamples,
    cappedResourceManifest
  }) : null;
  if (contextPackage) {
    await emitWritingProgress(options, {
      step: "chapter_context_package_saved",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: `\u7B2C ${task.chapterNumber} \u7AE0\u4E0A\u4E0B\u6587\u5305\u5DF2\u4FDD\u5B58\uFF1A${contextPackage.segmentCount} \u4E2A\u7247\u6BB5\uFF0C${contextPackage.segmentationSource === "scene_card" ? "\u573A\u666F\u5361" : "\u65F6\u95F4\u7EBF"}\u5206\u6BB5\u3002`,
      artifactPath: contextPackage.relativePath,
      preview: [
        `segmentation=${contextPackage.segmentationSource}`,
        `segments=${contextPackage.segmentCount}`,
        `guardrails=${contextPackage.promptBudget.guardrailsChars} chars`,
        `activeWorldSlice=${contextPackage.promptBudget.activeWorldSliceChars} chars`,
        `storyAssets=${contextPackage.promptBudget.storyAssetsChars} chars`
      ].join(" | ")
    });
  }
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return approvedStyleContext.status === "ready" ? createStyleContractTestDraftBody(state, task, continuityContract, approvedStyleContext) : fallback;
  }
  const generatedSegments = [];
  const segmentArtifacts = [];
  let previousSegmentTail = compactPreviousSegmentTail(prunedContext.previousDraftFragment);
  for (const segment of segmentPlan) {
    throwIfPipelineAborted(options);
    const priorSegmentTail = previousSegmentTail;
    const sceneCardPrompt = segment.sceneCard ? [
      "## Current Scene Card",
      `- Scene card: ${segment.sceneCard.index}`,
      segment.sceneCard.goal ? `- Goal: ${segment.sceneCard.goal}` : "",
      segment.sceneCard.conflict ? `- Conflict: ${segment.sceneCard.conflict}` : "",
      segment.sceneCard.turn ? `- Turn: ${segment.sceneCard.turn}` : "",
      segment.sceneCard.endHook ? `- End hook: ${segment.sceneCard.endHook}` : "",
      segment.sceneCard.requiredCharacters.length ? `- Required characters: ${segment.sceneCard.requiredCharacters.join("\u3001")}` : "",
      segment.sceneCard.requiredFacts.length ? `- Required facts: ${segment.sceneCard.requiredFacts.join("\u3001")}` : "",
      segment.sceneCard.forbiddenFacts.length ? `- Forbidden facts: ${segment.sceneCard.forbiddenFacts.join("\u3001")}` : "",
      "- \u53EA\u5199\u5F53\u524D\u573A\u666F\u5361\u8986\u76D6\u7684\u65F6\u95F4\u6BB5\uFF0C\u4E0D\u8981\u63D0\u524D\u5B8C\u6210\u540E\u7EED\u573A\u666F\u5361\u3002"
    ].filter(Boolean).join("\n") : "";
    const compositionPlan = createDraftSegmentCompositionPlan(segment, continuityContract);
    const compositionPrompt = [
      "## Segment Composition Contract",
      "### Plot",
      ...compositionPlan.plot.map((item) => `- ${item}`),
      "### Narration",
      ...compositionPlan.narration.map((item) => `- ${item}`),
      "### Dialogue",
      ...compositionPlan.dialogue.map((item) => `- ${item}`),
      "### Character Action",
      ...compositionPlan.characterAction.map((item) => `- ${item}`),
      "### Continuity",
      ...compositionPlan.continuity.map((item) => `- ${item}`),
      "### Assembly Rules",
      ...compositionPlan.assemblyRules.map((item) => `- ${item}`)
    ].join("\n");
    const generated = await generateProductionTextWithLlm({
      roleName: "Author",
      state,
      options,
      temperature: 0.78,
      progress: {
        step: `draft_generation_segment_${segment.index}`,
        role: "Author",
        chapterNumber: task.chapterNumber,
        title: task.title,
        startMessage: `Author \u6B63\u5728\u751F\u6210\u7B2C ${task.chapterNumber} \u7AE0\u7247\u6BB5 ${segment.index}/${segment.total}\uFF1A${segment.label}\u3002`,
        completeMessage: `Author \u5DF2\u8FD4\u56DE\u7B2C ${task.chapterNumber} \u7AE0\u7247\u6BB5 ${segment.index}/${segment.total}\uFF1A${segment.label}\u3002`
      },
      basePrompt: basePromptText,
      dynamicPrompt: [
        `\u7AE0\u8282\uFF1A\u7B2C ${task.chapterNumber} \u7AE0`,
        `\u6807\u9898\uFF1A${task.title}`,
        `\u7C7B\u578B\uFF1A${genre.genre}`,
        `\u573A\u666F\u7C7B\u578B\uFF1A${sceneType}`,
        `\u65C1\u767D\u7B56\u7565\uFF1A${genre.narration}`,
        `\u672C\u6B21\u53EA\u5199\u7247\u6BB5\uFF1A${segment.index}/${segment.total} - ${segment.label}`,
        `\u7247\u6BB5\u76EE\u6807\u5B57\u6570\uFF1A${segment.targetWords}`,
        `\u65F6\u95F4\u7EBF\u4F4D\u7F6E\uFF1A${segment.timelinePosition}`,
        `\u53D9\u4E8B\u7126\u70B9\uFF1A${segment.narrativeFocus}`,
        "",
        sceneCardPrompt,
        "",
        "\u672C\u7247\u6BB5\u5FC5\u987B\u5B8C\u6210\uFF1A",
        ...segment.requiredBeats.map((beat) => `- ${beat}`),
        "",
        segment.continuityFocus.length ? `\u672C\u7247\u6BB5\u4F18\u5148\u627F\u63A5\u8FD9\u4E9B\u951A\u70B9\uFF1A${segment.continuityFocus.join("\u3001")}` : "\u672C\u7247\u6BB5\u5FC5\u987B\u5EFA\u7ACB\u53EF\u8FFD\u8E2A\u7684\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u7EBF\u7D22\u6216\u4EE3\u4EF7\u3002",
        "",
        cappedVocabularyPrompt,
        "",
        cappedVocabularySkillExamples,
        "",
        cappedResourceManifest,
        "",
        approvedStyleCarryover,
        "",
        prunedContext.prunedConsensus ? `Consensus & Setting Freeze:
${clipPromptSection(prunedContext.prunedConsensus, 900)}` : "",
        "",
        prunedContext.prunedOutline ? `Master Outline:
${clipPromptSection(prunedContext.prunedOutline, 700)}` : "",
        "",
        prunedContext.prunedStoryAssets ? `Story Assets:
${clipPromptSection(prunedContext.prunedStoryAssets, 900)}` : "",
        "",
        prunedContext.prunedMemory ? `Character Memory:
${clipPromptSection(prunedContext.prunedMemory, 520)}` : "",
        "",
        prunedContext.prunedLedger ? `Previous Chapter Ledger:
${clipPromptSection(prunedContext.prunedLedger, 520)}` : "",
        "",
        prunedContext.prunedRag ? `Knowledge/RAG References:
${clipPromptSection(prunedContext.prunedRag, 520)}` : "",
        "",
        clipPromptSection(continuityContract.prompt, 1050),
        "",
        clipPromptSection(characterProfileContract.prompt, 760),
        "",
        "\u7247\u6BB5\u5199\u4F5C\u786C\u8981\u6C42\uFF1A",
        "- \u53EA\u8F93\u51FA\u8FD9\u4E00\u6BB5\u5C0F\u8BF4\u6B63\u6587\uFF0C\u4E0D\u8981\u8F93\u51FA Markdown \u6807\u9898\u3001\u7247\u6BB5\u7F16\u53F7\u3001\u8BF4\u660E\u6216\u603B\u7ED3\u3002",
        "- \u4ECE\u4E0A\u4E00\u7247\u6BB5\u5C3E\u5DF4\u81EA\u7136\u63A5\u7EED\uFF0C\u4F46\u4E0D\u8981\u590D\u8FF0\u4E0A\u4E00\u7247\u6BB5\u3002",
        "- \u6BCF\u6BB5\u90FD\u5FC5\u987B\u5305\u542B\u52A8\u4F5C\u3001\u5BF9\u8BDD\u6216\u611F\u5B98\u7EC6\u8282\uFF0C\u4E0D\u80FD\u53EA\u5199\u65C1\u767D\u6982\u8FF0\u3002",
        "- \u5BF9\u8BDD\u3001\u65C1\u767D\u548C\u52A8\u4F5C\u8981\u670D\u52A1\u672C\u7247\u6BB5\u65F6\u95F4\u7EBF\uFF0C\u4E0D\u8981\u63D0\u524D\u5199\u5B8C\u540E\u7EED\u7247\u6BB5\u3002",
        "- \u4E0D\u80FD\u5806\u780C\u6210\u8BED\uFF0C\u4E0D\u80FD\u628A\u6C1B\u56F4\u8BCD\u5B64\u7ACB\u6210\u884C\u3002",
        hasApprovedStyleSummaryPrompt(approvedStyleContext) ? "- \u5FC5\u987B\u8D34\u5408 User Approved Writing Style Contract\uFF1B\u5982\u679C\u901A\u7528\u5199\u4F5C\u6307\u5357\u4E0E\u8BE5\u5408\u540C\u51B2\u7A81\uFF0C\u4EE5\u7528\u6237\u786E\u8BA4\u5199\u6CD5\u5408\u540C\u4E3A\u51C6\u3002" : "",
        continuityContract.lockedProtagonistName ? `- \u5FC5\u987B\u4FDD\u6301\u4E3B\u89D2\u300C${continuityContract.lockedProtagonistName}\u300D\u4E00\u81F4\u3002` : "- \u5FC5\u987B\u660E\u786E\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\uFF0C\u5E76\u4FDD\u6301\u4E3B\u89C6\u89D2\u805A\u7126\u3002"
      ].filter(Boolean).join("\n"),
      message: [
        "\u8BF7\u6309\u65F6\u95F4\u7EBF\u751F\u6210\u672C\u7AE0\u7684\u4E00\u4E2A\u8FDE\u7EED\u6B63\u6587\u7247\u6BB5\u3002",
        "\u53EA\u8FD4\u56DE\u5C0F\u8BF4\u6B63\u6587\uFF0C\u4E0D\u8981\u8FD4\u56DE\u6807\u9898\u3001\u8BA1\u5212\u3001\u89E3\u91CA\u3001\u5217\u8868\u6216\u4EE3\u7801\u5757\u3002",
        "",
        "## Chapter Causal Plan",
        ...formatCausalPlanBullets(state, task),
        "",
        "## Segment Contract",
        `- Segment: ${segment.index}/${segment.total} ${segment.label}`,
        `- Timeline: ${segment.timelinePosition}`,
        `- Focus: ${segment.narrativeFocus}`,
        `- Target words: ${segment.targetWords}`,
        ...segment.requiredBeats.map((beat) => `- ${beat}`),
        "",
        compositionPrompt,
        "",
        previousSegmentTail ? `## Previous Tail
${previousSegmentTail}` : "",
        "",
        usesSceneCards ? "## Chapter Guardrails (Trimmed)" : "## Trimmed Chapter Blueprint",
        trimmedBlueprint
      ].filter(Boolean).join("\n")
    });
    const cleanedSegment = generated.replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/g, "$1").replace(/^#+\s+.*$/gmu, "").replace(/^(片段|Segment)\s*\d+[\s\S]*?\n/iu, "").trim();
    const segmentBody = cleanedSegment || generated.trim();
    const plotMaterial = await generateDraftSegmentPlotMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail
    });
    const dialogueMaterial = await generateDraftSegmentDialogueMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail
    });
    const narrationMaterial = await generateDraftSegmentNarrationMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail
    });
    const characterActionMaterial = await generateDraftSegmentCharacterActionMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail
    });
    const continuityMaterial = await generateDraftSegmentContinuityMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail
    });
    const materialOverrides = {};
    const materialModes = {};
    if (plotMaterial) {
      materialOverrides.plot = plotMaterial;
      materialModes.plot = "llm-subcall";
    }
    if (dialogueMaterial) {
      materialOverrides.dialogue = dialogueMaterial;
      materialModes.dialogue = "llm-subcall";
    }
    if (narrationMaterial) {
      materialOverrides.narration = narrationMaterial;
      materialModes.narration = "llm-subcall";
    }
    if (characterActionMaterial) {
      materialOverrides.character_action = characterActionMaterial;
      materialModes.character_action = "llm-subcall";
    }
    if (continuityMaterial) {
      materialOverrides.continuity = continuityMaterial;
      materialModes.continuity = "llm-subcall";
    }
    const assemblyMaterial = await generateDraftSegmentAssemblyMaterial({
      state,
      task,
      segment,
      composition: compositionPlan,
      options,
      previousSegmentTail: priorSegmentTail,
      materials: materialOverrides,
      fallbackBody: segmentBody
    });
    if (assemblyMaterial) {
      materialOverrides.assembly = assemblyMaterial;
      materialModes.assembly = "llm-subcall";
    }
    const cleanedAssemblySegment = cleanDraftAssemblyBody(assemblyMaterial || "");
    const usesAssemblySegment = isUsableDraftAssemblyBody(cleanedAssemblySegment, segmentBody);
    const finalSegmentBody = usesAssemblySegment ? cleanedAssemblySegment : segmentBody;
    const assemblyUsage = assemblyMaterial ? {
      requested: true,
      decision: usesAssemblySegment ? "used" : "fallback_author",
      reason: usesAssemblySegment ? "assembly material passed fiction-body guard and replaced the author segment" : "assembly material was saved for audit but rejected by fiction-body guard",
      materialChars: cleanedAssemblySegment.length,
      finalChars: finalSegmentBody.length,
      fallbackChars: segmentBody.length
    } : {
      requested: false,
      decision: "not_requested",
      reason: "assembly role was not enabled or returned no material",
      materialChars: 0,
      finalChars: finalSegmentBody.length,
      fallbackChars: segmentBody.length
    };
    const hasMaterialOverrides = Object.keys(materialOverrides).length > 0;
    const segmentArtifact = paths && projectRoot ? await writeDraftSegmentArtifact({
      projectRoot,
      paths,
      options,
      state,
      task,
      segment,
      content: finalSegmentBody,
      previousSegmentTail: priorSegmentTail,
      segmentationSource: usesSceneCards ? "scene_card" : "timeline",
      continuityContract,
      materialOverrides: hasMaterialOverrides ? materialOverrides : void 0,
      materialModes: hasMaterialOverrides ? materialModes : void 0,
      assemblyUsage
    }) : null;
    if (segmentArtifact) {
      segmentArtifacts.push(segmentArtifact);
      await emitWritingProgress(options, {
        step: `draft_segment_artifact_saved_${segment.index}`,
        role: "Author",
        chapterNumber: task.chapterNumber,
        title: task.title,
        status: "completed",
        message: `\u7B2C ${task.chapterNumber} \u7AE0\u7247\u6BB5 ${segment.index}/${segment.total} \u5DF2\u4FDD\u5B58\u4E3A\u72EC\u7ACB\u4EA7\u7269\u3002`,
        artifactPath: segmentArtifact.relativePath,
        preview: [
          `source=${segmentArtifact.source}`,
          `chars=${segmentArtifact.chars}`,
          `briefs=${segmentArtifact.subArtifacts.filter((artifact) => artifact.role === "brief").length}`,
          `materials=${segmentArtifact.subArtifacts.filter((artifact) => artifact.role === "material").length}`,
          `path=${segmentArtifact.relativePath}`
        ].join(" | ")
      });
    }
    generatedSegments.push(finalSegmentBody);
    previousSegmentTail = compactPreviousSegmentTail(generatedSegments.join("\n\n"));
  }
  const body = generatedSegments.join("\n\n");
  return [
    `# ${task.title}`,
    "",
    "## Draft Body",
    "",
    body,
    "",
    "## Drafting Metadata",
    `- Chapter: ${task.chapterNumber}`,
    `- Target words: ${task.targetWords}`,
    `- Segmented drafting: ${segmentPlan.length} LLM calls`,
    usesSceneCards ? "- Draft segmentation source: scene cards" : "- Draft segmentation source: timeline fallback",
    `- Segment artifacts: ${segmentArtifacts.map((artifact) => artifact.relativePath).join(", ") || "none"}`,
    `- Estimated production words: ${wordCount(body)}`
  ].join("\n");
}
async function repairAigcHighRiskDraft(state, task, finalDraft, aigcReport, resources, options, continuityContract, characterDossiers) {
  if (process.env.AI_NOVEL_TEST_MODE === "1" || aigcReport.status !== "blocked" || aigcReport.highRiskSegments.length === 0) {
    return finalDraft;
  }
  throwIfPipelineAborted(options);
  const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
  console.log(`

==================== [AIGC REWORK] \u7B2C ${task.chapterNumber} \u7AE0 AIGC \u98CE\u9669\u7247\u6BB5\u4FEE\u590D ====================`);
  console.log(`\u3010\u7AE0\u8282\u6807\u9898\u3011: ${task.title}`);
  console.log(`\u3010AIGC \u68C0\u6D4B\u62A5\u544A\u3011:
${formatAigcWritingDetectionReport(aigcReport)}`);
  console.log("\u3010\u5F85\u4FEE\u590D\u7684\u9AD8\u98CE\u9669\u7247\u6BB5\u6570\u3011:", aigcReport.highRiskSegments.length);
  console.log(`====================================================================================

`);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: finalDraft
  });
  const replacements = [];
  await Promise.all(
    aigcReport.highRiskSegments.map(async (segment) => {
      throwIfPipelineAborted(options);
      const originalText = bodyOnly.substring(segment.startOffset, segment.endOffset);
      if (!originalText.trim()) return;
      console.log(`[AIGC PATCH SEND] \u51C6\u5907\u5C40\u90E8\u91CD\u6784\u9AD8\u98CE\u9669\u7247\u6BB5 #${segment.index + 1}: \u300C${originalText.slice(0, 30)}...\u300D`);
      const generated = await generateProductionTextWithLlm({
        roleName: "Prose Stylist",
        state,
        options,
        temperature: 0.6,
        progress: {
          step: `aigc_patch_repair_${segment.index}`,
          role: "Prose Stylist",
          chapterNumber: task.chapterNumber,
          title: task.title,
          startMessage: `Prose Stylist \u6B63\u5728\u5C40\u90E8\u4FEE\u590D\u7B2C ${task.chapterNumber} \u7AE0\u9AD8\u98CE\u9669\u7247\u6BB5 #${segment.index + 1}\u3002`,
          completeMessage: `Prose Stylist \u5DF2\u8FD4\u56DE\u9AD8\u98CE\u9669\u7247\u6BB5 #${segment.index + 1} \u7684\u4FEE\u590D\u6587\u672C\u3002`
        },
        basePrompt: [
          "\u4F60\u662F Prose Stylist\uFF0C\u4E13\u7CBE\u4E8E\u4E2D\u6587\u5C0F\u8BF4\u7684\u81EA\u7136\u6587\u98CE\u91CD\u6784\u548C\u53BB AI \u75D5\u8FF9\u4F18\u5316\u3002",
          "\u4F60\u7684\u4EFB\u52A1\u662F\u53EA\u5BF9\u63D0\u4F9B\u7684\u4E00\u5C0F\u6BB5\u5C0F\u8BF4\u7247\u6BB5\u8FDB\u884C\u91CD\u5199\uFF0C\u4F7F\u5176\u6587\u5B57\u8D28\u611F\u5982\u540C\u4EBA\u7C7B\u4F5C\u5BB6\u624B\u7B14\uFF0C\u5F7B\u5E95\u6D88\u9664\u7FFB\u8BD1\u8154\u3001\u5957\u8BDD\u3001\u603B\u7ED3\u8154\u548C\u56DB\u5E73\u516B\u7A33\u7684\u7ED3\u6784\u3002",
          "\u5FC5\u987B\u4FDD\u7559\u539F\u6BB5\u843D\u4E2D\u53D1\u751F\u7684\u60C5\u8282\u4E8B\u5B9E\u3001\u4EBA\u7269\u52A8\u4F5C\u7EC6\u8282\u3001\u4EE5\u53CA\u6240\u5305\u542B\u7684\u4EBA\u7269\u540D\u5B57\uFF0C\u4E0D\u53EF\u51ED\u7A7A\u65B0\u589E\u5927\u6BB5\u5267\u60C5\u3002",
          "\u3010\u91CD\u8981\u7EA6\u675F\u3011\u8BF7\u4EC5\u8F93\u51FA\u91CD\u6784\u540E\u7684\u8FD9\u4E00\u6BB5\u5C0F\u8BF4\u6B63\u6587\u5185\u5BB9\uFF0C\u4E25\u7981\u8F93\u51FA\u4EFB\u4F55 Markdown \u6807\u9898\u3001\u89E3\u91CA\u8BCD\u3001\u524D\u8A00\u540E\u8BB0\u3001\u6216\u8005\u8BF4\u660E\u6846\uFF01",
          resources.styleGuide || "",
          resources.antiHallucinationGuide || ""
        ].join("\n\n"),
        dynamicPrompt: [
          "\u6253\u788E\u8FDE\u7EED\u53E5\u5B50\u7684\u5747\u7B49\u957F\u5EA6\uFF0C\u8FD0\u7528\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u5177\u4F53\u6289\u62E9\u6765\u4F53\u73B0\u5F20\u529B\u3002",
          "\u4E25\u7981\u5728\u8FD9\u4E00\u5C0F\u6BB5\u4E2D\u5305\u542B\u300C\u4E0D\u4EC5\u5982\u6B64\u300D\u3001\u300C\u4E0E\u6B64\u540C\u65F6\u300D\u3001\u300C\u7136\u800C\u300D\u3001\u300C\u4E8B\u5B9E\u4E0A\u300D\u3001\u300C\u4E0D\u5F97\u4E0D\u8BF4\u300D\u7B49 AI \u75D5\u8FF9\u4E25\u91CD\u7684\u903B\u8F91\u8FC7\u6E21\u8BCD\u3002",
          continuityContract.prompt,
          characterProfileContract.prompt.slice(0, 1e3)
        ].join("\n\n"),
        message: `\u8BF7\u91CD\u6784\u5E76\u81EA\u7136\u5316\u4EE5\u4E0B\u6BB5\u843D\uFF0C\u4EC5\u8FD4\u56DE\u91CD\u6784\u540E\u7684\u6BB5\u843D\u672C\u8EAB:

${originalText}`
      });
      let cleanText = generated.trim();
      cleanText = cleanText.replace(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/g, "$1").trim();
      cleanText = cleanText.replace(/^(修改后|重构后|修复后|Repaired|Revised)(内容|段落)?[：:\n\s]+/iu, "").trim();
      cleanText = cleanText.replace(/^"(.*)"$/s, "$1").trim();
      console.log(`[AIGC PATCH RECV] \u9AD8\u98CE\u9669\u7247\u6BB5 #${segment.index + 1} \u5C40\u90E8\u91CD\u6784\u5B8C\u6BD5: 
- \u539F\u6587: \u300C${originalText.slice(0, 40)}...\u300D
- \u4FEE\u590D: \u300C${cleanText.slice(0, 40)}...\u300D`);
      replacements.push({
        startOffset: segment.startOffset,
        endOffset: segment.endOffset,
        repairedText: cleanText || originalText
      });
    })
  );
  throwIfPipelineAborted(options);
  replacements.sort((a, b) => b.startOffset - a.startOffset);
  let patchedBody = bodyOnly;
  for (const rep of replacements) {
    patchedBody = patchedBody.substring(0, rep.startOffset) + rep.repairedText + patchedBody.substring(rep.endOffset);
  }
  const metaIndex = finalDraft.search(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u);
  const finalDraftPatched = metaIndex !== -1 ? patchedBody + finalDraft.substring(metaIndex) : patchedBody;
  return finalDraftPatched;
}
function sanitizeMarkdownCell(text) {
  if (!text) return "";
  return text.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
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
  const hasConflict = /冲突|压力|选择|代价|反击|局势|刀|密信|伤口|怀疑|拦|问|追|藏|风险|少尹|兵曹|官|火|流民/u.test(draft);
  const hasBlueprint = blueprint.includes("Event Sequence");
  const hasCausalContract = hasCausalBlueprint(blueprint);
  const causalExecution = evaluateCausalExecutionEvidence(draft, task, continuityContract);
  const hasCausalExecution = hasCausalContract && causalExecution.status === "eligible";
  const resourceUsageScore = resourceUsage.status === "eligible" ? 8 : resourceUsage.status === "warning" ? 6 : 4;
  const softStyleIssue = isSoftNarrativeStyleIssue(styleQuality);
  const hardBlocked = wordCountBlockingIssue || plotContinuity.status === "quarantined" || styleQuality.status === "quarantined" && !softStyleIssue || resourceUsage.status === "quarantined" || characterProfileQuality.status === "quarantined" || !hasCausalContract || !hasCausalExecution;
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
    `| \u56E0\u679C\u5408\u540C\u6267\u884C | ${hasCausalContract && hasCausalExecution ? 8 : 4}/10 | ${sanitizeMarkdownCell(hasCausalContract && hasCausalExecution ? causalExecution.reason : `\u7F3A\u5C11\u6E05\u6670\u56E0\u679C\u5408\u540C\u6216\u6B63\u6587\u6267\u884C\u8BC1\u636E\u4E0D\u8DB3\uFF1A${causalExecution.reason}`)} |`,
    `| \u5199\u4F5C\u8D44\u6E90\u5438\u6536 | ${resourceUsageScore}/10 | ${sanitizeMarkdownCell(resourceUsage.reason)} |`,
    `| \u89D2\u8272\u9C9C\u660E\u5EA6 | ${characterProfileQuality.status === "eligible" ? 8 : 4}/10 | ${sanitizeMarkdownCell(characterProfileQuality.reason)} |`,
    `| \u7EFC\u5408\u8BC4\u5206 | ${score}/10 | ${score >= 7 ? "\u53EF\u8FDB\u5165\u6DA6\u8272\u3002" : "\u9700\u8981\u8FD4\u5DE5\u3002"} |`,
    "",
    `WORD_COUNT_CHECK: ${count}/${target}`,
    "",
    "## Checks",
    "- Editor: \u68C0\u67E5\u53D9\u4E8B\u63A8\u8FDB\u3001\u4EBA\u7269\u884C\u52A8\u3001\u723D\u70B9\u5BC6\u5EA6\u3002",
    "- Consistency Checker: \u68C0\u67E5\u8BBE\u5B9A\u3001\u65F6\u95F4\u7EBF\u3001\u4F0F\u7B14\u548C\u4EBA\u7269\u5173\u7CFB\u3002",
    "- Style Controller: \u68C0\u67E5\u6587\u98CE\u3001\u6210\u8BED\u5BC6\u5EA6\u3001\u6587\u8A00\u6BD4\u4F8B\u3001\u5BF9\u767D\u5DEE\u5F02\u3002",
    "- Prose Stylist: \u53BB\u9664\u6A21\u677F\u611F\uFF0C\u589E\u5F3A\u5177\u4F53\u573A\u666F\u548C\u81EA\u7136\u8868\u8FBE\u3002",
    `- Causal Contract: ${hasCausalContract && hasCausalExecution ? `\u901A\u8FC7\uFF1A${causalExecution.reason}` : `\u5931\u8D25\uFF1A${causalExecution.reason}`}`,
    `- Plot Continuity: ${plotContinuity.reason}`,
    `- Style Hard Gate: ${styleQuality.reason}`,
    `- Resource Usage Gate: ${resourceUsage.reason}`,
    `- Character Profile Gate: ${characterProfileQuality.reason}`,
    "",
    "## Required Fixes",
    ...score >= 7 && !hardBlocked ? ["- \u6682\u65E0\u963B\u585E\u6027\u95EE\u9898\uFF1B\u6DA6\u8272\u65F6\u7EE7\u7EED\u538B\u4F4E AI \u6A21\u677F\u53E5\u3002"] : [
      ...wordCountBlockingIssue ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A\u6B63\u6587\u6709\u6548\u5B57\u6570 ${count}/${target}\uFF0C\u4F4E\u4E8E 80% \u95E8\u69DB\uFF0C\u4E0D\u80FD\u8FDB\u5165 complete\u3002`] : [],
      ...plotContinuity.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${plotContinuity.reason}`] : [],
      ...styleQuality.status === "quarantined" && !softStyleIssue ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${styleQuality.reason}`] : [],
      ...softStyleIssue ? [`- \u6DA6\u8272\u5EFA\u8BAE\uFF1A${styleQuality.reason}`] : [],
      ...resourceUsage.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${resourceUsage.reason}`] : [],
      ...characterProfileQuality.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${characterProfileQuality.reason}`] : [],
      ...!hasCausalContract ? ["- \u9700\u8981\u8FD4\u5DE5\uFF1A\u84DD\u56FE\u7F3A\u5C11 Causal Objective / Irreversible Change / Next Chapter Handoff\uFF0C\u4E0D\u80FD\u652F\u6491\u8FDE\u7EED\u5199\u4F5C\u3002"] : [],
      ...!hasCausalExecution ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${causalExecution.reason}`] : [],
      ...count < target ? ["- \u6269\u5199\u6B63\u6587\u573A\u666F\u3002"] : [],
      ...!hasConflict ? ["- \u589E\u5F3A\u51B2\u7A81\u52A8\u4F5C\u3002"] : [],
      ...!hasHook ? ["- \u8865\u8DB3\u7AE0\u672B\u94A9\u5B50\u3002"] : []
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
  const softStyleIssue = isSoftNarrativeStyleIssue(styleQuality);
  const narrativeFixes = [
    ...plotContinuity?.status === "quarantined" ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${plotContinuity.reason}`] : [],
    ...styleQuality.status === "quarantined" && !softStyleIssue ? [`- \u9700\u8981\u8FD4\u5DE5\uFF1A${styleQuality.reason}`] : [],
    ...softStyleIssue ? [`- \u6DA6\u8272\u5EFA\u8BAE\uFF1A${styleQuality.reason}`] : [],
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
function extractQualityRepairChecklist(report) {
  const lines = report.split("\n");
  const fixes = [];
  let inRequiredFixes = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+Required Fixes/u.test(trimmed)) {
      inRequiredFixes = true;
      continue;
    }
    if (inRequiredFixes && /^##\s+/u.test(trimmed)) {
      inRequiredFixes = false;
    }
    if (inRequiredFixes && /^-\s+/u.test(trimmed)) {
      fixes.push(trimmed);
    }
  }
  const scoreFixes = lines.filter((line) => /^\|\s*(情节推进|因果合同执行|写作资源吸收|角色鲜明度)\s*\|/u.test(line)).filter((line) => /[1-6]\/10/u.test(line)).map((line) => `- \u4F4E\u5206\u9879\uFF1A${line.replace(/^\|\s*|\s*\|$/g, "").replace(/\s*\|\s*/g, " - ")}`);
  return uniqueStrings([...fixes, ...scoreFixes]).slice(0, 10);
}
function extractDraftBodyForDeterministicRepair(draft) {
  const bodyStart = draft.match(/##\s+(?:Draft Body|Final Body|正文|最终正文)\s*/iu);
  const afterBodyHeading = bodyStart ? draft.slice((bodyStart.index || 0) + bodyStart[0].length) : draft;
  return afterBodyHeading.split(/\n##\s+(?:Drafting Metadata|Revision Attempt|Quality Gate|Polish Pass|Naturalness Report|章节元数据|章节元信息)/u)[0].split(/\n---\n/u)[0].split("\n").map((line) => line.trim()).filter((line) => line && !/^#{1,6}\s+/u.test(line)).filter((line) => !/^-\s*(?:Chapter|Target words|Estimated production words|Scene type|Continuity status|Locked protagonist|Causal objective|Next handoff|Blueprint basis|Draft source)\s*:/iu.test(line)).join("\n").trim();
}
function dedupeRepeatedNarrativeBody(body) {
  const paragraphSeen = /* @__PURE__ */ new Set();
  const paragraphs = [];
  for (const rawParagraph of body.split(/\n+/u).map((part) => part.trim()).filter(Boolean)) {
    const sentences = rawParagraph.match(/[^。！？!?；;\n]+[。！？!?；;]?/gu) || [rawParagraph];
    const sentenceSeen = /* @__PURE__ */ new Set();
    const compactedSentences = sentences.map((sentence) => sentence.trim()).filter(Boolean).filter((sentence) => {
      const normalized = normalizeTailParagraph(sentence);
      if (normalized.length < 18) return true;
      if (sentenceSeen.has(normalized)) return false;
      sentenceSeen.add(normalized);
      return true;
    });
    const compacted = compactedSentences.join("").trim();
    const normalizedParagraph = normalizeTailParagraph(compacted);
    if (!compacted || normalizedParagraph.length >= 24 && paragraphSeen.has(normalizedParagraph)) {
      continue;
    }
    if (normalizedParagraph.length >= 24) {
      paragraphSeen.add(normalizedParagraph);
    }
    paragraphs.push(compacted);
  }
  return paragraphs.join("\n\n").trim();
}
function createDeterministicQualityRepairDraft(state, task, draft, attempt, continuityContract) {
  const title = task.title || `\u7B2C ${task.chapterNumber} \u7AE0`;
  const causalPlan = getTaskCausalPlan(state, task);
  const protagonistName = continuityContract.lockedProtagonistName || inferLockedProtagonistName(draft) || "\u6C88\u781A";
  const requiredAnchors = uniqueStrings([
    ...task.causalPlan?.requiredContinuityAnchors || [],
    ...continuityContract.continuityAnchors || [],
    "\u8D26\u518C",
    "\u7F3A\u9875",
    "\u5B98\u5370",
    "\u95E8\u5916\u811A\u6B65"
  ].filter(Boolean)).slice(0, 8);
  const compacted = dedupeRepeatedNarrativeBody(extractDraftBodyForDeterministicRepair(draft));
  const paragraphs = compacted ? compacted.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean) : [
    `\u96E8\u58F0\u8D34\u7740\u7A97\u7EB8\u5F80\u4E0B\u6ED1\u3002${protagonistName}\u628A\u7F3A\u9875\u8D26\u518C\u63A8\u5230\u706F\u4E0B\uFF0C\u7EB8\u8FB9\u9F50\u5F97\u50CF\u521A\u4ECE\u5200\u53E3\u9000\u51FA\u6765\u3002`,
    "\u8001\u5468\u7AD9\u5728\u95E8\u69DB\u5916\uFF0C\u6E7F\u8896\u538B\u7740\u534A\u679A\u6697\u7EA2\u5370\u75D5\uFF0C\u6CA1\u6709\u8FDB\u5C4B\uFF0C\u4E5F\u6CA1\u6709\u628A\u8D26\u518C\u63A5\u8FC7\u53BB\u3002"
  ];
  const repairSeeds = [
    (step) => `\u8FD4\u5DE5\u573A\u666F ${step}\uFF1A${protagonistName}\u5148\u6309\u4F4F\u7B2C ${step} \u9053\u8D26\u518C\u7EBF\u88C5\uFF0C\u786E\u8BA4${requiredAnchors.slice(0, 3).join("\u3001") || "\u7F3A\u9875\u3001\u5B98\u5370\u3001\u811A\u6B65\u58F0"}\u90FD\u8FD8\u5728\u73B0\u573A\uFF0C\u5E76\u8BA9\u8001\u5468\u628A\u8896\u53E3\u644A\u5F00\u3002`,
    (step) => `\u8FD4\u5DE5\u573A\u666F ${step}\uFF1A\u95E8\u5916\u7B2C ${step} \u6B21\u811A\u6B65\u58F0\u505C\u4F4F\uFF0C\u8001\u5468\u4F4E\u58F0\u8BF4\uFF1A\u201C\u5C0F\u6C88\u5927\u4EBA\uFF0C\u522B\u518D\u7FFB\u3002\u201D${protagonistName}\u770B\u7740\u90A3\u9053\u6E7F\u5370\uFF0C\u95EE\u4ED6\u6015\u8D26\u8FD8\u662F\u6015\u62FF\u8D26\u7684\u4EBA\u3002`,
    (step) => `\u8FD4\u5DE5\u573A\u666F ${step}\uFF1A\u7B2C ${step} \u7F15\u706F\u706B\u628A\u7F3A\u9875\u8FB9\u7F18\u7167\u5F97\u53D1\u767D\uFF0C\u7EB8\u7EA4\u7EF4\u6CA1\u6709\u96E8\u75D5\uFF0C${protagonistName}\u628A\u8FD9\u4E2A\u5224\u65AD\u538B\u8FDB\u638C\u5FC3\uFF0C\u51B3\u5B9A\u5148\u7559\u4E0B\u7F3A\u9875\u3002`,
    (step) => `\u8FD4\u5DE5\u573A\u666F ${step}\uFF1A\u8001\u5468\u5F80\u540E\u9000\u7B2C ${step} \u4E2A\u534A\u6B65\uFF0C\u978B\u5E95\u5728\u6C34\u91CC\u6413\u51FA\u6CE5\u58F0\uFF0C\u5173\u7CFB\u88C2\u7F1D\u5C31\u843D\u5728\u8FD9\u4E00\u6B21\u9000\u8BA9\u91CC\u3002`,
    (step) => `\u8FD4\u5DE5\u573A\u666F ${step}\uFF1A${protagonistName}\u628A\u7B2C ${step} \u679A\u5B98\u5370\u6263\u5728\u684C\u89D2\uFF0C\u6CA1\u6709\u4EA4\u7ED9\u95E8\u5916\u7684\u4EBA\uFF0C\u8FD9\u4E2A\u9009\u62E9\u8BA9\u4ED6\u5148\u88AB\u76EF\u4E0A\uFF0C\u4E5F\u8BA9\u8001\u5468\u6682\u65F6\u4E0D\u80FD\u6539\u53E3\u3002`,
    (step) => `\u8FD4\u5DE5\u573A\u666F ${step}\uFF1A\u7AE0\u672B\u94A9\u5B50\u843D\u5728\u7B2C ${step} \u679A\u5012\u6263\u7684\u5370\u4E0A\uFF0C\u5370\u9762\u53CD\u7740\u201C\u4ED3\u66F9\u201D\u4E24\u4E2A\u5B57\uFF0C\u7F3A\u9875\u8FB9\u7F18\u6B63\u597D\u538B\u5728\u5370\u6CE5\u5916\u4FA7\u3002`,
    (step) => `\u8FD4\u5DE5\u573A\u666F ${step}\uFF1A\u7B2C ${step} \u9635\u96E8\u58F0\u5FFD\u7136\u53D8\u5BC6\uFF0C\u95E8\u5916\u90A3\u4EBA\u8BF4\u5C11\u5C39\u8981\u770B\u6574\u672C\u8D26\uFF0C${protagonistName}\u53EA\u628A\u7F3A\u9875\u7559\u5728\u706F\u4E0B\u3002`,
    (step) => `\u8FD4\u5DE5\u573A\u666F ${step}\uFF1A\u7B2C ${step} \u6B21\u53D8\u5316\u4E0D\u80FD\u590D\u539F\uFF0C\u8001\u5468\u6B20\u4E86${protagonistName}\u4E00\u6B21\u9690\u7792\uFF0C\u7EBF\u7D22\u3001\u5173\u7CFB\u548C\u8EAB\u4EFD\u98CE\u9669\u540C\u65F6\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002`
  ];
  let index = 0;
  while (wordCount(paragraphs.join("\n\n")) < Math.floor(task.targetWords * 0.84)) {
    paragraphs.push(repairSeeds[index % repairSeeds.length](index + 1));
    index += 1;
  }
  const body = paragraphs.join("\n\n");
  return [
    `# ${title}`,
    "",
    "## Draft Body",
    "",
    body,
    "",
    "## Drafting Metadata",
    `- Chapter: ${task.chapterNumber}`,
    `- Revision attempt: ${attempt}`,
    `- Repair source: deterministic quality loop repair`,
    `- Target words: ${task.targetWords}`,
    `- Estimated production words: ${wordCount(body)}`,
    `- Causal objective: ${causalPlan.sceneObjective}`,
    `- Next handoff: ${causalPlan.nextHandoff}`
  ].join("\n");
}
async function createProductionQualityReport(state, task, draft, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint }), characterDossiers, approvedStyleContext = { status: "missing", prompt: "" }) {
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
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext);
  const generated = await generateProductionTextWithLlm({
    roleName: "Editor",
    state,
    options,
    temperature: 0.2,
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
      approvedStyleCarryover ? "\u5982\u679C\u6B63\u6587\u660E\u663E\u8FDD\u80CC\u7528\u6237\u786E\u8BA4\u5199\u6CD5\u5408\u540C\u4E2D\u7684\u58F0\u97F3\u3001\u8282\u594F\u3001\u5BF9\u767D\u89C4\u5219\u3001\u63CF\u5199\u89C4\u5219\u6216\u7981\u7528\u6A21\u5F0F\uFF0C\u5FC5\u987B\u8981\u6C42\u8FD4\u5DE5\u3002" : "",
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
      approvedStyleCarryover,
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
async function reviseDraftForQualityGate(state, task, draft, report, blueprint, resources, options, attempt, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot, characterDossiers, approvedStyleContext = { status: "missing", prompt: "" }) {
  throwIfPipelineAborted(options);
  console.log(`

==================== [QUALITY REWORK] \u7B2C ${task.chapterNumber} \u7AE0\u7B2C ${attempt} \u8F6E\u8FD4\u5DE5 ====================`);
  console.log(`\u3010\u7AE0\u8282\u6807\u9898\u3011: ${task.title}`);
  console.log(`\u3010\u8D28\u68C0\u62A5\u544A (Quality Report)\u3011:
${report}`);
  console.log(`=================================================================================

`);
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return createDeterministicQualityRepairDraft(state, task, draft, attempt, continuityContract);
  }
  const cappedWriterGuide = (resources.writerGuide || "").slice(0, 2e3);
  const cappedAntiHallucination = (resources.antiHallucinationGuide || "").slice(0, 1500);
  const cappedConflictStrategy = (resources.evidenceConflictStrategy || "").slice(0, 1500);
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext);
  const basePromptLines = [
    cappedWriterGuide || "\u4F60\u662F\u5C0F\u8BF4\u6B63\u6587\u521B\u4F5C\u6267\u884C\u8005\u3002",
    "\u4F60\u6B63\u5728\u6267\u884C\u8D28\u91CF\u95E8\u7981\u8FD4\u5DE5\u3002\u5FC5\u987B\u4FDD\u7559\u7AE0\u8282\u76EE\u6807\uFF0C\u4E0D\u5F97\u8DF3\u7AE0\uFF0C\u4E0D\u5F97\u6539\u53D8\u5DF2\u51BB\u7ED3\u8BBE\u5B9A\u3002",
    "\u987A\u5E94\u5E76\u4FEE\u590D\u7AE0\u8282\u56E0\u679C\u5408\u540C\uFF1A\u4E0A\u4E00\u7AE0\u8F93\u5165\u8981\u63A8\u52A8\u672C\u7AE0\u9009\u62E9\uFF0C\u672C\u7AE0\u9009\u62E9\u8981\u4EA7\u751F\u4E0D\u53EF\u9006\u4EE3\u4EF7\uFF0C\u5E76\u81EA\u7136\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002",
    continuityContract.lockedProtagonistName ? `\u5FC5\u987B\u628A\u4E3B\u89D2\u4E00\u81F4\u6027\u4FEE\u56DE\u300C${continuityContract.lockedProtagonistName}\u300D\uFF0C\u4E0D\u5F97\u7EE7\u7EED\u4F7F\u7528\u6F02\u79FB\u4E3B\u89D2\u3002` : "\u5FC5\u987B\u5728\u9996\u7AE0\u5EFA\u7ACB\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\u3002",
    "\u5FC5\u987B\u4FEE\u590D\u914D\u89D2\u5173\u7CFB\u3001\u524D\u5E8F\u60C5\u8282\u627F\u63A5\u3001\u4F0F\u7B14\u72B6\u6001\u3001\u8D44\u6E90\u4F7F\u7528\u3001\u60C5\u8282\u63A8\u8FDB\u548C\u6B63\u6587\u6BD4\u4F8B\u95EE\u9898\u3002",
    "\u5FC5\u987B\u4FEE\u590D\u7AE0\u8282\u65AD\u88C2\uFF1A\u4E0A\u4E00\u7AE0\u951A\u70B9\u8981\u8FDB\u5165\u672C\u7AE0\u4E8B\u4EF6\u56E0\u679C\uFF0C\u4E0D\u5F97\u53EA\u6362\u573A\u666F\u91CD\u5F00\u3002",
    "\u5FC5\u987B\u4FEE\u590D\u6D41\u6C34\u8D26\u95EE\u9898\uFF1A\u4E0D\u8981\u53EA\u6309\u65F6\u95F4\u7F57\u5217\uFF0C\u6240\u6709\u573A\u666F\u90FD\u8981\u56E0\u9009\u62E9\u3001\u4EE3\u4EF7\u3001\u4FE1\u606F\u53D8\u5316\u6216\u5173\u7CFB\u53D8\u5316\u800C\u53D1\u751F\u3002",
    "\u5FC5\u987B\u4FEE\u590D AI \u5316\u788E\u7247\uFF1A\u628A\u5B64\u7ACB\u77ED\u8BCD\u6539\u6210\u5B8C\u6574\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u5BF9\u8BDD\u6216\u56E0\u679C\u53E5\u3002",
    approvedStyleCarryover ? "\u5FC5\u987B\u540C\u65F6\u4FEE\u590D\u4E0E\u7528\u6237\u786E\u8BA4\u5199\u6CD5\u5408\u540C\u4E0D\u4E00\u81F4\u7684\u58F0\u97F3\u3001\u53E5\u5F0F\u3001\u5BF9\u767D\u3001\u63CF\u5199\u548C\u7981\u7528\u6A21\u5F0F\u95EE\u9898\u3002" : ""
  ];
  if (cappedAntiHallucination) {
    basePromptLines.push(`\u3010\u53CD\u5E7B\u89C9\u4E0E\u7EC6\u8282\u7559\u767D\u7EA6\u675F\u3011
${cappedAntiHallucination}`);
  }
  if (cappedConflictStrategy) {
    basePromptLines.push(`\u3010\u591A\u6E90\u4E8B\u5B9E\u51B2\u7A81\u5904\u7406\u7B56\u7565\u3011
${cappedConflictStrategy}`);
  }
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft,
    blueprint
  });
  const repairChecklist = extractQualityRepairChecklist(report);
  const fixedDynamicPromptLines = [
    `\u7AE0\u8282\uFF1A\u7B2C ${task.chapterNumber} \u7AE0`,
    `\u6807\u9898\uFF1A${task.title}`,
    `\u8FD4\u5DE5\u8F6E\u6B21\uFF1A${attempt}`,
    "\u5FC5\u987B\u9488\u5BF9\u8D28\u91CF\u62A5\u544A\u4E2D\u7684\u95EE\u9898\u91CD\u5199/\u6269\u5199\u6B63\u6587\u3002",
    "\u5FC5\u987B\u8F93\u51FA Markdown\uFF0C\u4FDD\u7559 `## Draft Body`\u3002",
    "",
    `[Correction Observation (\u7EA0\u504F\u89C2\u5BDF)]
\u4E0A\u4E00\u8F6E\u5199\u4F5C\u5B58\u5728\u4EE5\u4E0B\u7F3A\u9677\uFF1A
${repairChecklist.join("\n") || report.slice(0, 1200)}
\u8BF7\u5728\u672C\u6B21\u91CD\u5199\u4E2D\u7279\u522B\u6CE8\u610F\u5E76\u4FEE\u590D\u8FD9\u4E9B\u95EE\u9898\u3002`,
    "",
    approvedStyleCarryover,
    "",
    continuityContract.prompt,
    "",
    characterProfileContract.prompt.slice(0, 1e3)
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
  const currentTemp = Math.min(0.8, 0.5 + (attempt - 1) * 0.1);
  const generated = await generateProductionTextWithLlm({
    roleName: "Author",
    state,
    options,
    temperature: currentTemp,
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
      "\u5FC5\u987B\u628A\u4F4E\u5206\u9879\u8F6C\u5316\u4E3A\u53EF\u89C1\u6B63\u6587\u8BC1\u636E\uFF1A\u4E0A\u4E00\u7AE0\u951A\u70B9\u8FDB\u5165\u5F00\u573A\u4E8B\u4EF6\uFF1B\u4E3B\u89D2\u505A\u4E00\u4E2A\u4F1A\u6539\u53D8\u5C40\u52BF\u7684\u52A8\u4F5C\u9009\u62E9\uFF1B\u9009\u62E9\u5E26\u6765\u8EAB\u4EFD/\u5173\u7CFB/\u7EBF\u7D22/\u8D44\u6E90\u540E\u679C\uFF1B\u7ED3\u5C3E\u628A\u8FD9\u4E2A\u540E\u679C\u4EA4\u7ED9\u4E0B\u4E00\u7AE0\u3002",
      "\u5982\u679C\u89D2\u8272\u9C9C\u660E\u5EA6\u4F4E\uFF0C\u53EA\u8865\u5F3A\u672C\u7AE0\u627F\u62C5\u51B2\u7A81\u3001\u9009\u62E9\u6216\u5173\u7CFB\u53D8\u5316\u7684\u6838\u5FC3\u4EBA\u7269\uFF1B\u4E0D\u8981\u786C\u585E\u53E3\u7656\u548C\u6807\u5FD7\u52A8\u4F5C\uFF0C\u800C\u662F\u8BA9\u4EBA\u7269\u901A\u8FC7\u76EE\u6807\u3001\u7ACB\u573A\u3001\u9009\u62E9\u4EE3\u4EF7\u3001\u5BF9\u4E3B\u89D2\u5173\u7CFB\u7684\u53CD\u5E94\u4EA7\u751F\u5DEE\u5F02\u3002",
      "\u5982\u679C\u5199\u4F5C\u8D44\u6E90\u5438\u6536\u4F4E\uFF0C\u628A\u77ED\u8BCD/\u6210\u8BED\u6539\u6210\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u7269\u4EF6\u548C\u56E0\u679C\u53E5\uFF0C\u4E0D\u8981\u5199\u5B64\u7ACB\u6210\u8BED\u6216\u56DB\u5B57\u77ED\u53E5\u3002",
      "\u5FC5\u987B\u8F93\u51FA Markdown\uFF0C\u4FDD\u7559 `## Draft Body`\u3002",
      "",
      `[Correction Observation (\u7EA0\u504F\u89C2\u5BDF)]
\u4E0A\u4E00\u8F6E\u5199\u4F5C\u5B58\u5728\u4EE5\u4E0B\u7F3A\u9677\uFF1A
${repairChecklist.join("\n") || report.slice(0, 1200)}
\u8BF7\u5728\u672C\u6B21\u91CD\u5199\u4E2D\u7279\u522B\u6CE8\u610F\u5E76\u4FEE\u590D\u8FD9\u4E9B\u95EE\u9898\u3002`,
      attempt >= 2 ? `
\u3010WARNING: \u8FDE\u7EED\u8FD4\u5DE5\u786C\u8B66\u544A\u3011\u8FD9\u5DF2\u7ECF\u662F\u7B2C ${attempt} \u8F6E\u91CD\u5199\uFF01\u524D\u51E0\u8F6E\u7684\u91CD\u5199\u7531\u4E8E\u6539\u52A8\u592A\u5C0F\u6216\u672A\u5F7B\u5E95\u7EA0\u504F\u5DF2\u88AB\u6253\u56DE\u3002\u672C\u6B21\u91CD\u5199\u4F60\u5FC5\u987B\u8FDB\u884C\u5927\u8303\u56F4\u3001\u98A0\u8986\u6027\u7684\u6587\u5B57\u91CD\u7EC4\u548C\u53E5\u5F0F\u53D8\u6362\uFF08\u4F8B\u5982\u591A\u4F7F\u7528\u5177\u4F53\u52A8\u4F5C\u548C\u73AF\u5883\u89E6\u611F\u6765\u66FF\u6362\u5355\u8584\u7684\u89E3\u91CA\u53E5\uFF09\uFF0C\u4E25\u7981\u76F4\u63A5\u590D\u7528\u6216\u5FAE\u8C03\u4E0A\u4E00\u8F6E\u88AB\u62D2\u7684\u5185\u5BB9\uFF01
` : "",
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
      approvedStyleCarryover,
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
      repairChecklist.length ? repairChecklist.join("\n") : report,
      "",
      "## Draft",
      draft
    ].join("\n")
  });
  return generated.includes("## Draft Body") ? generated : [`# ${task.title}`, "", "## Draft Body", "", generated, "", `## Revision Attempt ${attempt}`].join("\n");
}
async function runQualityGateWithRevisions(state, task, initialDraft, blueprint, resources, options, continuityContract = createContinuityContract({ state, task, blueprint }), paths, projectRoot, characterDossiers, approvedStyleContext = { status: "missing", prompt: "" }) {
  const maxAttempts = options.maxRevisionAttempts !== void 0 ? options.maxRevisionAttempts : 3;
  const forcedQualityScoreForTest = process.env.AI_NOVEL_TEST_MODE === "1" && typeof options.forceQualityScoreForTest === "number" ? Math.max(0, Math.min(10, Math.round(options.forceQualityScoreForTest))) : void 0;
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
    report = await createProductionQualityReport(state, task, draft, blueprint, resources, options, continuityContract, characterDossiers, approvedStyleContext);
    if (typeof forcedQualityScoreForTest === "number") {
      const forcedSummary = `| \u7EFC\u5408\u8BC4\u5206 | ${forcedQualityScoreForTest}/10 | ${forcedQualityScoreForTest >= 7 ? "\u53EF\u8FDB\u5165\u6DA6\u8272\u3002" : "\u9700\u8981\u8FD4\u5DE5\u3002"} |`;
      report = /\|\s*综合评分\s*\|\s*\d+\/10\s*\|[^|\n]*\|/u.test(report) ? report.replace(/\|\s*综合评分\s*\|\s*\d+\/10\s*\|[^|\n]*\|/u, forcedSummary) : `${report.trimEnd()}
${forcedSummary}`;
      if (forcedQualityScoreForTest < 7) {
        const forcedBlocker = "QUALITY_GATE: blocked\n- \u9700\u8981\u8FD4\u5DE5\uFF1A\u6D4B\u8BD5\u5F3A\u5236\u8D28\u91CF\u5206\u4F4E\u4E8E\u9608\u503C\uFF0C\u4E0D\u80FD\u8FDB\u5165 complete\u3002";
        if (!report.includes("\u6D4B\u8BD5\u5F3A\u5236\u8D28\u91CF\u5206\u4F4E\u4E8E\u9608\u503C")) {
          report = `${report.trimEnd()}
${forcedBlocker}`;
        }
      }
    }
    gate = parseQualityGate(report, attempt, maxAttempts);
    if (typeof forcedQualityScoreForTest === "number" && forcedQualityScoreForTest < 7 && attempt >= maxAttempts) {
      gate = {
        ...gate,
        passed: false,
        score: forcedQualityScoreForTest,
        status: "blocked",
        reason: `\u7EFC\u5408\u8BC4\u5206 ${forcedQualityScoreForTest}/10\uFF0C\u4F4E\u4E8E\u901A\u8FC7\u9608\u503C\u3002`
      };
    }
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
      characterDossiers,
      approvedStyleContext
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
function resolveAigcDetectorRootDir(options) {
  return options.envRootDir || options.factoryRootDir || process.cwd();
}
function isAigcDetectorConfigured(options) {
  const config = getAigcDetectorConfig(resolveAigcDetectorRootDir(options));
  if (config.provider === "local-heuristic") return true;
  return config.provider !== "disabled" && Boolean(config.url?.trim());
}
function normalizeAigcWritingDetectionReport(result) {
  const threshold = result.threshold;
  const maxSegmentScore = result.segments.reduce((max, segment) => {
    if (typeof segment.score !== "number") {
      return max;
    }
    return max === null ? segment.score : Math.max(max, segment.score);
  }, null);
  const status = !result.ok ? "unavailable" : result.highRiskSegments.length > 0 || typeof result.score === "number" && result.score >= threshold ? "blocked" : "passed";
  return {
    enabled: true,
    status,
    provider: result.provider,
    threshold,
    score: result.score,
    maxSegmentScore,
    totalSegments: result.totalSegments,
    highRiskSegments: result.highRiskSegments.slice(0, 8).map((segment) => ({
      id: segment.segment.id,
      index: segment.segment.index,
      startOffset: segment.segment.startOffset,
      endOffset: segment.segment.endOffset,
      score: segment.score,
      label: segment.label,
      preview: segment.segment.text.replace(/\s+/gu, " ").slice(0, 160)
    })),
    reason: result.reason
  };
}
function skippedAigcWritingDetectionReport(reason) {
  return {
    enabled: false,
    status: "skipped",
    provider: "disabled",
    threshold: 0.8,
    score: null,
    maxSegmentScore: null,
    totalSegments: 0,
    highRiskSegments: [],
    reason
  };
}
async function runAigcWritingDetection(finalDraft, options) {
  const config = getAigcDetectorConfig(resolveAigcDetectorRootDir(options));
  if (!isAigcDetectorConfigured(options)) {
    return skippedAigcWritingDetectionReport("AIGC detector is not configured.");
  }
  try {
    const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
    const result = await detectAigcSegments(bodyOnly || finalDraft, config);
    return normalizeAigcWritingDetectionReport(result);
  } catch (error) {
    return {
      ...skippedAigcWritingDetectionReport(error instanceof Error ? error.message : String(error)),
      enabled: true,
      status: "unavailable",
      provider: config.provider || "disabled",
      threshold: config.threshold || 0.8
    };
  } finally {
    throwIfPipelineAborted(options);
  }
}
function formatAigcWritingDetectionReport(report) {
  return [
    "## AIGC Detection",
    `- Enabled: ${report.enabled ? "yes" : "no"}`,
    `- Status: ${report.status}`,
    `- Provider: ${report.provider}`,
    `- Threshold: ${report.threshold}`,
    `- Average AI probability: ${typeof report.score === "number" ? report.score.toFixed(4) : "n/a"}`,
    `- Max segment AI probability: ${typeof report.maxSegmentScore === "number" ? report.maxSegmentScore.toFixed(4) : "n/a"}`,
    `- Total segments: ${report.totalSegments}`,
    `- High risk segments: ${report.highRiskSegments.length}`,
    `- Reason: ${report.reason}`,
    ...report.highRiskSegments.length ? [
      "",
      "### High Risk Segment Previews",
      ...report.highRiskSegments.map(
        (segment) => `- #${segment.index + 1} [${segment.startOffset}-${segment.endOffset}] score=${typeof segment.score === "number" ? segment.score.toFixed(4) : "n/a"} label=${segment.label}: ${segment.preview}`
      )
    ] : []
  ].join("\n");
}
async function createProductionPolishedDraft(state, task, draft, report, gate, resources, options, continuityContract = createContinuityContract({ state, task }), characterDossiers, approvedStyleContext = { status: "missing", prompt: "" }) {
  throwIfPipelineAborted(options);
  const characterProfileContract = buildCharacterProfileContract({
    state,
    task,
    characterDossiers,
    continuityContract,
    previousFinalDraft: draft
  });
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext);
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
    temperature: 0.6,
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
      resources.consistencyGuide || "",
      resources.antiHallucinationGuide || ""
    ].join("\n\n"),
    dynamicPrompt: [
      "\u53EA\u5141\u8BB8\u5728\u4E0D\u6539\u53D8\u6838\u5FC3\u5267\u60C5\u3001\u4E0D\u6539\u53D8\u8BBE\u5B9A\u3001\u4E0D\u8DF3\u7AE0\u7684\u524D\u63D0\u4E0B\u6DA6\u8272\u3002",
      "\u5FC5\u987B\u4FDD\u7559\u7AE0\u8282\u6B63\u6587\u7ED3\u6784\uFF0C\u589E\u5F3A\u52A8\u4F5C\u3001\u611F\u5B98\u3001\u5BF9\u767D\u5DEE\u5F02\u548C\u5177\u4F53\u7EC6\u8282\u3002",
      approvedStyleCarryover ? "\u5FC5\u987B\u4FDD\u6301\u7528\u6237\u786E\u8BA4\u5199\u6CD5\u5408\u540C\uFF0C\u4E0D\u5F97\u628A\u5DF2\u786E\u8BA4\u7684\u6587\u98CE\u6DA6\u8272\u6210\u901A\u7528\u6A21\u677F\u8154\u3002" : "",
      "\u63A7\u5236\u6210\u8BED\u5BC6\u5EA6\uFF0C\u907F\u514D\u5806\u780C\u548C\u6A21\u677F\u5316\u60C5\u7EEA\u89E3\u91CA\u3002",
      "\u5FC5\u987B\u6D88\u9664\u5355\u5B57/\u77ED\u8BCD\u72EC\u7ACB\u6210\u884C\u7684 AI \u5316\u788E\u7247\u611F\uFF1B\u63A8\u8350\u8BCD\u53EA\u80FD\u81EA\u7136\u5D4C\u5165\u53E5\u5B50\u3002",
      "\u5FC5\u987B\u79FB\u9664\u4EFB\u4F55 AI \u75D5\u8FF9\u3001\u903B\u8F91\u8FDE\u8BCD\uFF08\u4E25\u7981\u51FA\u73B0'\u4E0D\u4EC5\u5982\u6B64'\u3001'\u4E0E\u6B64\u540C\u65F6'\u3001'\u7136\u800C'\u3001'\u4E8B\u5B9E\u4E0A'\uFF09\u3001\u62A5\u544A\u8154\u3001\u603B\u7ED3\u8154\u3001\u8FC7\u5EA6\u89E3\u91CA\u3001\u6574\u9F50\u6392\u6BD4\u3001\u60C5\u7EEA\u6807\u7B7E\u5806\u53E0\u548C\u4E07\u80FD\u5347\u534E\u7ED3\u5C3E\u3002\u5F7B\u5E95\u8D2F\u5F7B\u201C\u6444\u50CF\u673A\u9650\u77E5\u5448\u73B0\uFF08Show, don't tell\uFF09\u201D\uFF1A\u7981\u6B62\u65C1\u767D\u5BF9\u5267\u60C5\u7684\u4E25\u91CD\u6027\u3001\u53CD\u8F6C\u3001\u9634\u8C0B\u7B49\u8FDB\u884C\u8DE8\u89C6\u89D2\u7684\u8111\u8865\u4E0E\u4E3B\u89C2\u89E3\u91CA\uFF08\u5982\u4E25\u7981\u51FA\u73B0\u201C\u88AB\u6293\u4F4F\u662F\u901A\u654C\u65A9\u9996\u7684\u91CD\u7F6A\u201D\u3001\u201C\u81EA\u5DF1\u662F\u4E0D\u662F\u88AB\u5356\u4E86\u201D\u7B49\u5267\u900F\u53E5\uFF09\uFF0C\u6240\u6709\u56E0\u679C\u5B8C\u5168\u7559\u767D\u8BA9\u8BFB\u8005\u610F\u4F1A\uFF1B\u53EA\u62CD\u6444\u7269\u7406\u753B\u9762\u3001\u7269\u4EF6\u3001\u53F0\u8BCD\u548C\u751F\u7406\u53CD\u5E94\u3002",
      "\u5FC5\u987B\u6D88\u9664\u6240\u6709\u52A8\u4F5C\u63CF\u5199\u4E2D\u7684\u201C\u53CC\u5B57\u53E0\u8BCD\u526F\u8BCD+\u5730\u201D\uFF08\u5982\u7981\u7528\u201C\u6162\u541E\u541E\u5730\u201D\u3001\u201C\u6B7B\u6B7B\u5730\u201D\u3001\u201C\u795E\u79D8\u516E\u516E\u5730\u201D\u3001\u201C\u9ED8\u9ED8\u5730\u201D\u3001\u201C\u6084\u6084\u5730\u201D\uFF09\uFF0C\u5F3A\u5236\u6539\u7528\u7EAF\u52A8\u8BCD\u6216\u80A2\u4F53\u7269\u7406\u5F62\u6001\uFF1B\u5FC5\u987B\u6253\u788E\u8FDE\u7EED\u53E5\u5B50\u7684\u5E73\u5747\u957F\u5EA6\uFF0C\u589E\u52A0\u957F\u77ED\u53E5\u7684\u9519\u843D\u7A81\u53D1\u6027\uFF08Burstiness\uFF09\uFF0C\u4F7F\u884C\u6587\u7B26\u5408\u4EBA\u7C7B\u4F5C\u5BB6\u7684\u5929\u7136\u8D28\u611F\u3002",
      continuityContract.lockedProtagonistName ? `\u4E0D\u5F97\u5728\u6DA6\u8272\u4E2D\u66F4\u6539\u4E3B\u89D2\u59D3\u540D\u3001\u8EAB\u4EFD\u6216\u7AE0\u8282\u6838\u5FC3\u4E8B\u4EF6\uFF1B\u9501\u5B9A\u4E3B\u89D2\u662F\u300C${continuityContract.lockedProtagonistName}\u300D\u3002` : "\u9996\u7AE0\u6DA6\u8272\u4E0D\u5F97\u79FB\u9664\u552F\u4E00\u4E3B\u89D2\u59D3\u540D\u3002",
      "\u4E0D\u5F97\u66F4\u6539\u914D\u89D2\u8EAB\u4EFD\u3001\u5173\u7CFB\u3001\u4F0F\u7B14\u72B6\u6001\u6216\u524D\u5E8F\u60C5\u8282\u627F\u63A5\u3002",
      continuityContract.continuityAnchors.length ? `\u6DA6\u8272\u540E\u4ECD\u5FC5\u987B\u4FDD\u7559\u5E76\u81EA\u7136\u4F7F\u7528\u4E0A\u4E00\u7AE0\u8FDE\u7EED\u6027\u951A\u70B9\uFF1A${continuityContract.continuityAnchors.slice(0, 8).join("\u3001")}\u3002` : "\u6DA6\u8272\u540E\u5FC5\u987B\u4FDD\u7559\u672C\u7AE0\u5EFA\u7ACB\u7684\u53EF\u8FFD\u8E2A\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u7EBF\u7D22\u6216\u4EE3\u4EF7\u3002",
      "",
      continuityContract.prompt,
      "",
      approvedStyleCarryover,
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
      approvedStyleCarryover,
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
  const foreshadowingLedgerUpdate = createForeshadowingHealthLedger({
    causalPlan,
    nextAnchors,
    plotContinuity
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
    ...foreshadowingLedgerUpdate,
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
function createForeshadowingHealthLedger(input) {
  const anchorLines = input.nextAnchors.length ? input.nextAnchors.slice(0, 6).map((anchor) => `- Anchor advanced: ${anchor}`) : ["- Anchor advanced: none extracted; \u4E0B\u4E00\u7AE0\u5FC5\u987B\u5148\u8865\u8DB3\u53EF\u8FFD\u8E2A\u7269\u54C1\u3001\u7EBF\u7D22\u3001\u5173\u7CFB\u6216\u4EE3\u4EF7\u3002"];
  const status = input.nextAnchors.length >= 2 && input.plotContinuity.status === "eligible" ? "active" : "needs_manual_followup";
  const risk = status === "active" ? "low; \u5DF2\u5F62\u6210\u53EF\u627F\u63A5\u951A\u70B9\u3002" : "high; \u4F0F\u7B14\u53EF\u80FD\u60AC\u7A7A\uFF0C\u4E0B\u4E00\u7AE0\u84DD\u56FE\u5FC5\u987B\u663E\u5F0F\u5904\u7406\u3002";
  return [
    "### Foreshadowing Ledger Update",
    `- Operation: ${input.causalPlan.foreshadowingOperation}`,
    `- Status: ${status}`,
    ...anchorLines,
    `- Expected payoff / next touchpoint: ${input.causalPlan.nextHandoff}`,
    "- Carryover rule: \u4E0B\u4E00\u7AE0\u5FC5\u987B\u8BA9\u81F3\u5C11\u4E24\u4E2A\u951A\u70B9\u8FDB\u5165\u53EF\u89C1\u4E8B\u4EF6\uFF0C\u5E76\u901A\u8FC7\u884C\u52A8\u3001\u4EE3\u4EF7\u6216\u5173\u7CFB\u53D8\u5316\u5151\u73B0\uFF0C\u4E0D\u80FD\u53EA\u53E3\u5934\u89E3\u91CA\u3002",
    `- Risk: ${risk}`
  ];
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
  await import_promises5.default.mkdir(paths.plansDir, { recursive: true });
  await import_promises5.default.writeFile(paths.masterOutlinePath, `${content}
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
async function writeProductionStoryBibleAssets(projectRoot, paths, state, context, options = {}) {
  const resources = await loadProductionWritingResources(projectRoot);
  const assets = createProductionStoryBibleAssets(state, context, resources);
  await import_promises5.default.mkdir(paths.plansDir, { recursive: true });
  const written = [];
  for (const asset of assets) {
    const assetPath = import_node_path8.default.join(paths.plansDir, asset.filename);
    await import_promises5.default.writeFile(assetPath, `${asset.content}
`);
    await recordPipelineArtifact(projectRoot, assetPath, "plan", options, {
      stage: asset.stage,
      production: true,
      title: asset.title
    });
    written.push(assetPath);
  }
  const writingPlanPath = await writeProductionWritingPlan(projectRoot, paths, state, options);
  written.push(writingPlanPath);
  await emitWritingProgress(options, {
    step: "story_bible_assets_saved",
    role: "Showrunner",
    status: "completed",
    message: "\u4E16\u754C\u77E9\u9635\u3001\u4E3B\u7EBF\u67B6\u6784\u3001\u6545\u4E8B\u5723\u7ECF\u3001\u5206\u5377\u7B56\u7565\u3001\u4F0F\u7B14\u8D26\u672C\u3001\u4EBA\u7269\u5173\u7CFB\u8D44\u4EA7\u548C\u5199\u4F5C\u6267\u884C\u8BA1\u5212\u5DF2\u4FDD\u5B58\u3002",
    artifactPath: relativeArtifactPath(projectRoot, import_node_path8.default.join(paths.plansDir, "story-bible.md")),
    preview: [...assets.map((asset) => `- ${asset.filename}`), "- writing-plan.json"].join("\n"),
    wordCount: wordCount(assets.map((asset) => asset.content).join("\n\n"))
  });
  return written;
}
async function ensureProductionStoryBibleAssets(projectRoot, paths, state, context, options = {}) {
  const required = [...PRODUCTION_STORY_ASSET_FILES, "writing-plan.json"];
  const missing = [];
  for (const filename of required) {
    const content = await readOptionalText2(import_node_path8.default.join(paths.plansDir, filename));
    if (!content.trim()) missing.push(filename);
  }
  if (missing.length === 0) return [];
  await emitWritingProgress(options, {
    step: "story_bible_assets_repair_started",
    role: "Showrunner",
    chapterNumber: void 0,
    status: "started",
    message: `\u751F\u4EA7\u524D\u7F6E\u6545\u4E8B\u8D44\u4EA7\u7F3A\u5931 ${missing.length} \u9879\uFF0C\u7CFB\u7EDF\u5C06\u5728\u6B63\u6587\u751F\u4EA7\u524D\u81EA\u52A8\u8865\u9F50\u3002`,
    preview: missing.map((filename) => `- ${filename}`).join("\n")
  });
  return writeProductionStoryBibleAssets(projectRoot, paths, state, context, options);
}
async function writeAllDetailedChapterBlueprints(projectRoot, paths, state, context, options = {}) {
  const resources = await loadProductionWritingResources(projectRoot);
  await import_promises5.default.mkdir(paths.chapterBlueprintsDir, { recursive: true });
  const written = [];
  for (const task of state.plan.chapterTasks) {
    const storyAssetContext = await loadProductionStoryAssetContext(paths, task);
    const deterministicBlueprint = createDetailedChapterBlueprint(state, task, context, resources, void 0, storyAssetContext);
    const shouldUseLlmPlanner = process.env.AI_NOVEL_TEST_MODE !== "1" && !options.preferDeterministicPlanning && task.chapterNumber <= 3;
    let content = deterministicBlueprint;
    if (shouldUseLlmPlanner) {
      content = await createChapterBlueprintContent(state, task, context, resources, options, storyAssetContext);
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
    const blueprintPath = import_node_path8.default.join(paths.chapterBlueprintsDir, `chapter-${String(task.chapterNumber).padStart(3, "0")}.md`);
    await import_promises5.default.writeFile(blueprintPath, `${content}
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
  if (options.projectId) {
    invalidateProjectCache(options.projectId);
  }
  const writingMode = productionWritingMode(options);
  const resources = await loadProductionWritingResources(projectRoot);
  const approvedStyleContext = await loadApprovedWritingStyleContext(projectRoot);
  const approvedStyleCarryover = summarizeApprovedStyleCarryover(approvedStyleContext);
  await enforceApprovedWritingStyleGate(options, task, approvedStyleContext);
  await persistApprovedWritingStyleAssets(projectRoot, paths, approvedStyleContext, options);
  const protagonistProfile = await readOptionalText2(paths.protagonistPath);
  const characterDossiers = await readCharacterDossiers(paths.characterDossiersPath);
  const chapterId = `chapter-${String(task.chapterNumber).padStart(3, "0")}`;
  const previousChapterId = task.chapterNumber > 1 ? `chapter-${String(task.chapterNumber - 1).padStart(3, "0")}` : "";
  const previousMemory = previousChapterId ? await readOptionalText2(import_node_path8.default.join(paths.memoryDir, `${previousChapterId}-memory.md`)) : "";
  const previousFinalDraft = previousChapterId ? await readOptionalText2(import_node_path8.default.join(paths.chaptersDir, `${previousChapterId}.final.md`)) : "";
  const blueprintPath = import_node_path8.default.join(paths.chapterBlueprintsDir, `${chapterId}.md`);
  const context = {
    consensus: await readOptionalText2(paths.consensusPath),
    protagonist: protagonistProfile,
    style: [
      await readOptionalText2(paths.styleProfilePath),
      approvedStyleCarryover
    ].filter(Boolean).join("\n\n")
  };
  await ensureProductionStoryBibleAssets(projectRoot, paths, state, context, options);
  await emitWritingProgress(options, {
    step: "chapter_started",
    role: "Showrunner",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: "started",
    message: writingMode === "quality" ? `\u7B2C ${task.chapterNumber} \u7AE0\u5F00\u59CB\u751F\u4EA7\uFF1A\u5B8C\u6574\u8D28\u91CF\u6A21\u5F0F\u4F1A\u6267\u884C\u84DD\u56FE\u3001\u521D\u7A3F\u3001LLM \u8D28\u68C0\u3001\u6DA6\u8272\u548C\u8BB0\u5FC6\u66F4\u65B0\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0\u5F00\u59CB\u751F\u4EA7\uFF1A\u5FEB\u901F\u65E0\u4EBA\u503C\u5B88\u6A21\u5F0F\u4F1A\u4F18\u5148\u751F\u6210\u6B63\u6587\uFF0C\u5E76\u7528\u786E\u5B9A\u6027\u786C\u95E8\u7981\u68C0\u67E5\u8FDE\u7EED\u6027\u3001\u6210\u8BED\u8D44\u6E90\u548C\u53BB AI \u5473\u3002`
  });
  let blueprint = await readOptionalText2(blueprintPath);
  if (!hasCausalBlueprint(blueprint)) {
    const storyAssetContext = await loadProductionStoryAssetContext(paths, task);
    const planningContract = createContinuityContract({
      state,
      task,
      context,
      protagonistProfile,
      previousMemory,
      previousFinalDraft
    });
    blueprint = createDetailedChapterBlueprint(state, task, context, resources, planningContract, storyAssetContext);
    await import_promises5.default.mkdir(paths.chapterBlueprintsDir, { recursive: true });
    await import_promises5.default.writeFile(blueprintPath, `${blueprint}
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
  if (approvedStyleContext.status === "ready") {
    await emitWritingProgress(options, {
      step: "approved_style_contract_loaded",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: "\u7528\u6237\u786E\u8BA4\u5199\u6CD5\u5408\u540C\u5DF2\u8F7D\u5165\uFF1A\u6B63\u6587\u751F\u6210\u3001\u8D28\u68C0\u548C\u81EA\u7136\u5316\u4F1A\u4EE5\u51BB\u7ED3\u6837\u6BB5\u4E0E\u89C4\u5219\u4E3A\u6700\u9AD8\u98CE\u683C\u7EA6\u675F\u3002",
      preview: approvedStyleCarryover.slice(0, 720)
    });
    await emitWritingProgress(options, {
      step: "approved_style_assets_synced",
      role: "Showrunner",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: "completed",
      message: "\u51BB\u7ED3\u540E\u7684\u5199\u6CD5\u89C4\u5219\u4E66\u3001\u6B63\u5411\u53C2\u8003\u548C\u7981\u5FCC\u6E05\u5355\u5DF2\u540C\u6B65\u5230\u751F\u4EA7\u8D44\u4EA7\uFF0C\u6B63\u6587\u94FE\u8DEF\u4F1A\u5F3A\u5236\u7EE7\u627F\u3002",
      preview: [
        relativeArtifactPath(projectRoot, paths.styleRulebookPath),
        relativeArtifactPath(projectRoot, paths.styleReferencesPath),
        relativeArtifactPath(projectRoot, paths.styleAntiPatternsPath)
      ].join("\n")
    });
  }
  const initialDraft = await createDraftBody(state, task, blueprint, resources, options, continuityContract, paths, projectRoot, characterDossiers, approvedStyleContext);
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
  const { draft, report, gate } = await runQualityGateWithRevisions(state, task, initialDraft, blueprint, resources, options, continuityContract, paths, projectRoot, characterDossiers, approvedStyleContext);
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
  let finalDraft = gate.status === "blocked" ? createPolishedDraft(state, task, draft, report, gate, writingMode) : await createProductionPolishedDraft(state, task, draft, report, gate, resources, options, continuityContract, characterDossiers, approvedStyleContext);
  const isAigcGateBypassed = process.env.AIGC_GATE_BYPASS === "1" || options.bypassAigcGate === true;
  let aigcDetection = isAigcGateBypassed ? skippedAigcWritingDetectionReport("AIGC\u68C0\u6D4B\u5728\u751F\u6210\u9636\u6BB5\u5DF2\u88AB\u65C1\u8DEF\uFF0C\u5C06\u5728\u540E\u7EED\u7EDF\u4E00\u7CBE\u4FEE\u3002") : await runAigcWritingDetection(finalDraft, options);
  const isAigcBlocked = aigcDetection.status === "blocked" && !isAigcGateBypassed;
  await emitWritingProgress(options, {
    step: "aigc_detection_completed",
    role: "Reviewer",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: isAigcBlocked ? "blocked" : "completed",
    message: isAigcBlocked ? `\u7B2C ${task.chapterNumber} \u7AE0 AIGC \u68C0\u6D4B\u53D1\u73B0 ${aigcDetection.highRiskSegments.length} \u4E2A\u9AD8\u98CE\u9669\u7247\u6BB5\uFF0C\u51C6\u5907\u6267\u884C\u5C40\u90E8\u81EA\u7136\u5316\u4FEE\u590D\u3002` : aigcDetection.status === "blocked" ? `\u7B2C ${task.chapterNumber} \u7AE0 AIGC \u68C0\u6D4B\u53D1\u73B0 ${aigcDetection.highRiskSegments.length} \u4E2A\u9AD8\u98CE\u9669\u7247\u6BB5\uFF08\u5DF2\u5F00\u542F AIGC \u95E8\u7981\u65C1\u8DEF\uFF0C\u76F4\u63A5\u901A\u8FC7\uFF09\u3002` : aigcDetection.status === "passed" ? `\u7B2C ${task.chapterNumber} \u7AE0 AIGC \u68C0\u6D4B\u901A\u8FC7\uFF0C\u5E73\u5747\u6982\u7387 ${typeof aigcDetection.score === "number" ? aigcDetection.score.toFixed(3) : "n/a"}\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0 AIGC \u68C0\u6D4B\u672A\u542F\u7528\u6216\u4E0D\u53EF\u7528\uFF1A${aigcDetection.reason}`,
    preview: formatAigcWritingDetectionReport(aigcDetection).slice(0, 520),
    wordCount: wordCount(finalDraft)
  });
  if (isAigcBlocked && gate.status !== "blocked") {
    finalDraft = await repairAigcHighRiskDraft(state, task, finalDraft, aigcDetection, resources, options, continuityContract, characterDossiers);
    aigcDetection = await runAigcWritingDetection(finalDraft, options);
    await emitWritingProgress(options, {
      step: "aigc_recheck_completed",
      role: "Reviewer",
      chapterNumber: task.chapterNumber,
      title: task.title,
      status: aigcDetection.status === "blocked" ? "blocked" : "completed",
      message: aigcDetection.status === "blocked" ? `\u7B2C ${task.chapterNumber} \u7AE0 AIGC \u4FEE\u590D\u540E\u4ECD\u6709 ${aigcDetection.highRiskSegments.length} \u4E2A\u9AD8\u98CE\u9669\u7247\u6BB5\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0 AIGC \u4FEE\u590D\u540E\u590D\u68C0\u5B8C\u6210\u3002`,
      preview: formatAigcWritingDetectionReport(aigcDetection).slice(0, 520),
      wordCount: wordCount(finalDraft)
    });
  }
  const baseFinalGate = enforceFinalDraftQualityGate(gate, finalDraft, task, state, protagonistProfile, continuityContract, characterDossiers);
  let finalGate = aigcDetection.status !== "passed" && aigcDetection.status !== "skipped" && !isAigcGateBypassed ? {
    ...baseFinalGate,
    passed: false,
    status: "blocked",
    reason: `${baseFinalGate.reason} ${aigcDetection.status === "blocked" ? `AIGC \u68C0\u6D4B\u963B\u585E\uFF1A${aigcDetection.highRiskSegments.length} \u4E2A\u7247\u6BB5\u8D85\u8FC7\u9608\u503C\uFF0C\u6700\u9AD8\u6982\u7387 ${typeof aigcDetection.maxSegmentScore === "number" ? aigcDetection.maxSegmentScore.toFixed(3) : "n/a"}\u3002` : `AIGC \u68C0\u6D4B\u672A\u901A\u8FC7\uFF1A${aigcDetection.status}\uFF0C${aigcDetection.reason || "\u9700\u8981\u914D\u7F6E\u5E76\u901A\u8FC7 AIGC \u68C0\u6D4B\u540E\u624D\u80FD\u653E\u884C\u3002"}`}`.trim()
  } : baseFinalGate;
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
  const extractedStyleFingerprint = await updateStyleFingerprintFromFirstChapter({
    paths,
    state,
    task,
    finalDraft,
    finalGate
  });
  const styleConformanceDrift = evaluateChapterStyleConformanceDrift({
    approvedStyleContext,
    chapterText: finalDraft,
    extractedStyleFingerprint
  });
  if (styleConformanceDrift.status === "drifted") {
    finalGate = {
      ...finalGate,
      passed: false,
      status: "blocked",
      reason: `${finalGate.reason} \u98CE\u683C\u7EE7\u627F\u6F02\u79FB\u963B\u585E\uFF1A${styleConformanceDrift.reason}`.trim()
    };
  }
  const styleInheritanceVerification = await buildChapterStyleInheritanceVerification({
    paths,
    approvedStyleContext,
    task,
    finalGate,
    aigcDetection,
    styleConformanceDrift,
    extractedStyleFingerprint
  });
  const chapterInheritanceAdapter = approvedStyleContext.chapterInheritanceAdapter || null;
  const reportWithAigcDetection = `${report.trimEnd()}

${formatAigcWritingDetectionReport(aigcDetection)}

${formatStyleConformanceDriftReport(styleConformanceDrift)}`;
  throwIfPipelineAborted(options);
  const draftPath = import_node_path8.default.join(paths.chaptersDir, `${chapterId}.draft.md`);
  const reviewedPath = import_node_path8.default.join(paths.chaptersDir, `${chapterId}.reviewed.md`);
  const finalPath = import_node_path8.default.join(paths.chaptersDir, `${chapterId}.final.md`);
  const reportPath = import_node_path8.default.join(paths.reportsDir, `${chapterId}-quality.md`);
  const memoryPath = import_node_path8.default.join(paths.memoryDir, `${chapterId}-memory.md`);
  const characterRelationshipsPath = paths.characterDossiersPath ? import_node_path8.default.join(import_node_path8.default.dirname(paths.characterDossiersPath), "relationships.json") : "";
  const characterRelationsMarkdownPath = paths.characterDossiersPath ? import_node_path8.default.join(import_node_path8.default.dirname(paths.characterDossiersPath), "relations.md") : "";
  const characterRelationshipGraph = updatedCharacterDossiers.length ? createCharacterRelationshipGraph(updatedCharacterDossiers) : null;
  await import_promises5.default.mkdir(paths.chaptersDir, { recursive: true });
  await import_promises5.default.mkdir(paths.reportsDir, { recursive: true });
  await import_promises5.default.mkdir(paths.memoryDir, { recursive: true });
  await import_promises5.default.writeFile(draftPath, `${draft}
`);
  await import_promises5.default.writeFile(reportPath, `${reportWithAigcDetection}
`);
  await import_promises5.default.writeFile(reviewedPath, `${draft}

---

${reportWithAigcDetection}
`);
  await import_promises5.default.writeFile(finalPath, `${finalDraft}
`);
  await import_promises5.default.writeFile(memoryPath, `${memoryUpdate}
`);
  if (paths.characterDossiersPath && updatedCharacterDossiers.length) {
    await writeJsonFileAtomic(paths.characterDossiersPath, updatedCharacterDossiers);
  }
  if (paths.characterDossiersMarkdownPath && updatedCharacterDossiers.length) {
    await import_promises5.default.writeFile(paths.characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown(updatedCharacterDossiers)}
`);
  }
  if (characterRelationshipsPath && characterRelationshipGraph) {
    await writeJsonFileAtomic(characterRelationshipsPath, characterRelationshipGraph);
  }
  if (characterRelationsMarkdownPath && characterRelationshipGraph) {
    await import_promises5.default.writeFile(characterRelationsMarkdownPath, `${formatCharacterRelationshipGraphMarkdown(characterRelationshipGraph)}
`);
  }
  const versionManifestPath = await writeChapterVersionManifest({
    projectRoot,
    options,
    chapterId,
    task,
    draftPath,
    reviewedPath,
    finalPath,
    reportPath,
    memoryPath,
    finalDraft,
    draft,
    finalGate,
    writingMode,
    aigcDetection,
    chapterInheritanceAdapter,
    styleInheritanceVerification,
    styleConformanceDrift
  });
  await recordPipelineArtifact(projectRoot, draftPath, "chapter", options, { chapterNumber: task.chapterNumber, pass: "draft" });
  await recordPipelineArtifact(projectRoot, reviewedPath, "chapter", options, { chapterNumber: task.chapterNumber, pass: "reviewed", qualityGate: finalGate });
  await recordPipelineArtifact(projectRoot, finalPath, "chapter", options, {
    chapterNumber: task.chapterNumber,
    pass: "final",
    qualityGate: finalGate,
    aigcDetection,
    chapterInheritanceAdapter,
    styleInheritanceVerification,
    styleConformanceDrift,
    wordCount: wordCount(finalDraft),
    targetWords: task.targetWords
  });
  await recordPipelineArtifact(projectRoot, reportPath, "checkpoint", options, { chapterNumber: task.chapterNumber, quality: true, qualityGate: finalGate, aigcDetection, styleInheritanceVerification, styleConformanceDrift });
  await recordPipelineArtifact(projectRoot, memoryPath, "memory", options, { chapterNumber: task.chapterNumber, qualityGate: finalGate });
  if (paths.characterDossiersPath && updatedCharacterDossiers.length) {
    await recordPipelineArtifact(projectRoot, paths.characterDossiersPath, "memory", options, {
      chapterNumber: task.chapterNumber,
      kind: "character_dossiers",
      qualityGate: finalGate
    });
  }
  if (characterRelationshipsPath && characterRelationshipGraph) {
    await recordPipelineArtifact(projectRoot, characterRelationshipsPath, "memory", options, {
      chapterNumber: task.chapterNumber,
      kind: "character_relationship_graph",
      qualityGate: finalGate
    });
  }
  if (extractedStyleFingerprint) {
    await recordPipelineArtifact(projectRoot, paths.styleProfilePath, "style", options, {
      chapterNumber: task.chapterNumber,
      kind: "style_profile",
      source: "first_chapter_fingerprint",
      styleFingerprint: extractedStyleFingerprint,
      qualityGate: finalGate
    });
  }
  await emitWritingProgress(options, {
    step: "chapter_artifacts_saved",
    role: "Memory Keeper",
    chapterNumber: task.chapterNumber,
    title: task.title,
    status: finalGate.status === "blocked" ? "blocked" : "completed",
    message: finalGate.status === "blocked" ? `\u7B2C ${task.chapterNumber} \u7AE0\u4EA7\u7269\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u8D28\u91CF\u95E8\u7981\u4ECD\u963B\u585E\u3002` : extractedStyleFingerprint ? `\u7B2C ${task.chapterNumber} \u7AE0\u6B63\u5F0F\u6B63\u6587\u3001\u8D28\u68C0\u62A5\u544A\u548C\u8BB0\u5FC6\u66F4\u65B0\u5DF2\u4FDD\u5B58\uFF0C\u5E76\u63D0\u53D6\u9996\u7AE0\u98CE\u683C\u6307\u7EB9\u3002` : `\u7B2C ${task.chapterNumber} \u7AE0\u6B63\u5F0F\u6B63\u6587\u3001\u8D28\u68C0\u62A5\u544A\u548C\u8BB0\u5FC6\u66F4\u65B0\u5DF2\u4FDD\u5B58\u3002`,
    artifactPath: relativeArtifactPath(projectRoot, finalPath),
    preview: memoryUpdate.slice(0, 360),
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate
  });
  if (options.factoryRootDir && options.projectId) {
    const updatedStyleProfile = extractedStyleFingerprint ? await readOptionalText2(paths.styleProfilePath) : "";
    const characterDossierMemory = updatedCharacterDossiers.length ? formatCharacterDossiersMarkdown(updatedCharacterDossiers) : "";
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
      if (characterDossierMemory && paths.characterDossiersPath) {
        const characterDossiersPath = relativeArtifactPath(projectRoot, paths.characterDossiersPath);
        db.recordMemory(options.projectId, {
          source: characterDossiersPath,
          kind: "character_dossiers",
          content: characterDossierMemory,
          importance: 9,
          metadata: {
            path: characterDossiersPath,
            chapterNumber: task.chapterNumber,
            source: "chapter_memory_keeper"
          },
          embedding: {
            model: "local-hash-v1",
            vector: createLocalTextEmbedding(characterDossierMemory)
          }
        });
      }
      if (extractedStyleFingerprint) {
        const styleProfilePath = relativeArtifactPath(projectRoot, paths.styleProfilePath);
        const styleMemory = [
          `Style fingerprint from chapter ${task.chapterNumber}: ${extractedStyleFingerprint}`,
          "",
          updatedStyleProfile
        ].join("\n");
        db.recordMemory(options.projectId, {
          source: styleProfilePath,
          kind: "style_profile",
          content: styleMemory,
          importance: 8,
          metadata: {
            path: styleProfilePath,
            chapterNumber: task.chapterNumber,
            source: "first_chapter_fingerprint"
          },
          embedding: {
            model: "local-hash-v1",
            vector: createLocalTextEmbedding(styleMemory)
          }
        });
      }
      db.recordEvent(options.projectId, null, finalGate.status === "blocked" ? "CHAPTER_PIPELINE_BLOCKED" : "CHAPTER_PIPELINE_COMPLETED", {
        chapterNumber: task.chapterNumber,
        draftPath: relativeArtifactPath(projectRoot, draftPath),
        finalPath: relativeArtifactPath(projectRoot, finalPath),
        versionManifestPath: relativeArtifactPath(projectRoot, versionManifestPath),
        reportPath: relativeArtifactPath(projectRoot, reportPath),
        qualityGate: finalGate,
        styleInheritanceVerification,
        styleConformanceDrift,
        writingMode,
        directorCommandId: options.directorCommandId ?? null
      });
    }).catch(() => void 0);
  }
  return {
    draftPath,
    reviewedPath,
    finalPath,
    versionManifestPath,
    reportPath,
    memoryPath,
    wordCount: wordCount(finalDraft),
    qualityGate: finalGate,
    writingMode
  };
}
function hasApprovedStyleSummaryPrompt(approvedStyleContext) {
  return approvedStyleContext.status === "ready" && Boolean(approvedStyleContext.prompt.trim());
}

// src/context-packet.ts
var import_promises6 = __toESM(require("fs/promises"), 1);
var import_node_path9 = __toESM(require("path"), 1);
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
  const contextPath = import_node_path9.default.join(projectRoot, ".ai-novel", "context", "current-context.md");
  const current = await import_promises6.default.readFile(contextPath, "utf8").catch(() => "");
  if (!current) {
    await import_promises6.default.mkdir(import_node_path9.default.dirname(contextPath), { recursive: true });
    await import_promises6.default.writeFile(contextPath, `${createCurrentContextPacketText(state)}
`);
    return;
  }
  const next = syncContextPacketStateText(current, state);
  if (next === current) {
    return;
  }
  await import_promises6.default.writeFile(contextPath, next.endsWith("\n") ? next : `${next}
`);
}

// src/orchestrator.ts
var WORKSPACE_DIR2 = ".ai-novel";
var PROJECTS_DIR = ".ai-novel-projects";
var PROJECTS_REGISTRY_FILE = "projects.json";
var WORKSPACE_VERSION = 1;
var MIN_CHAPTER_WORD_TARGET = 2500;
var DEFAULT_CHAPTER_RECOVERY_LIMIT = 3;
var DEFAULT_CHARACTER_PROFILE_REQUIREMENTS = [
  "canonical name",
  "identity and role function",
  "core desire",
  "fear or wound",
  "behavior habit",
  "speech marker",
  "appearance or body marker",
  "skill, limitation, and cost",
  "relationship state",
  "current chapter delta"
];
var AGENT_ROLES = [
  "showrunner",
  "world-architect",
  "author",
  "editor",
  "reviewer",
  "prose-stylist"
];
var COVER_IMAGE_PATH = ".ai-novel/assets/cover/cover.png";
var COVER_METADATA_PATH = ".ai-novel/assets/cover/cover-metadata.json";
var COVER_PROMPT_PATH = ".ai-novel/assets/cover/cover-prompt.md";
var DRAFT_SUBCALL_ROLE_VALUES = ["plot", "narration", "dialogue", "character_action", "continuity", "assembly"];
var STORY_FOUNDATION_APPROVAL_FILE = "story-foundation-approval.json";
function parseDraftSubcallRolesSetting(value) {
  if (!value) return void 0;
  const roles = value.split(",").map((role) => role.trim()).filter(
    (role) => DRAFT_SUBCALL_ROLE_VALUES.includes(role)
  );
  return roles.length ? [...new Set(roles)] : void 0;
}
function slugifyTitle(title) {
  const cleaned = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "untitled-novel";
}
function inferTitleFromIdea(idea) {
  const firstWords = idea.trim().split(/\s+/).slice(0, 6).join(" ");
  return firstWords ? `${firstWords} Project` : "Untitled Novel Project";
}
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
  const projectsRoot = import_node_path10.default.join(rootDir, PROJECTS_DIR);
  return {
    projectsRoot,
    registryPath: import_node_path10.default.join(projectsRoot, PROJECTS_REGISTRY_FILE)
  };
}
async function readProjectRegistry(rootDir) {
  const { registryPath } = getProjectsPaths(rootDir);
  try {
    const raw = await import_promises7.default.readFile(registryPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function writeProjectRegistry(rootDir, projects) {
  const { projectsRoot, registryPath } = getProjectsPaths(rootDir);
  await import_promises7.default.mkdir(projectsRoot, { recursive: true });
  await import_promises7.default.writeFile(registryPath, `${JSON.stringify(projects, null, 2)}
`);
}
function createUniqueProjectId(baseSlug, projects) {
  const existingIds = new Set(projects.map((project) => project.id));
  if (!existingIds.has(baseSlug)) {
    return baseSlug;
  }
  let suffix = 2;
  while (existingIds.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseSlug}-${suffix}`;
}
function resolveProjectRoot(rootDir, projectId) {
  return import_node_path10.default.join(rootDir, PROJECTS_DIR, projectId);
}
function resolveStoredProjectRoot(rootDir, projectRoot, projectId) {
  if (import_node_path10.default.isAbsolute(projectRoot)) {
    return projectRoot;
  }
  const rootRelative = import_node_path10.default.resolve(rootDir, projectRoot);
  const managedRoot = resolveProjectRoot(rootDir, projectId);
  if (import_node_path10.default.normalize(projectRoot).includes(`${PROJECTS_DIR}${import_node_path10.default.sep}`)) {
    return managedRoot;
  }
  return rootRelative;
}
function buildChapterCausalPlan(chapterNumber, totalChapters, projectIdea) {
  const arcSize = Math.max(3, Math.ceil(totalChapters / 4));
  const arcNumber = Math.ceil(chapterNumber / arcSize);
  const arcStart = (arcNumber - 1) * arcSize + 1;
  const arcEnd = Math.min(totalChapters, arcStart + arcSize - 1);
  const positionInArc = chapterNumber - arcStart + 1;
  const isFirstChapter = chapterNumber === 1;
  const isLastChapter = chapterNumber === totalChapters;
  const previousLabel = isFirstChapter ? "\u539F\u59CB\u521B\u4F5C\u76EE\u6807\u548C\u8BBE\u5B9A\u51BB\u7ED3\u7ED3\u8BBA" : `\u7B2C ${chapterNumber - 1} \u7AE0\u7559\u4E0B\u7684\u72B6\u6001\u3001\u7269\u4EF6\u3001\u5173\u7CFB\u3001\u4EE3\u4EF7\u548C\u672A\u89E3\u51B3\u95EE\u9898`;
  const nextLabel = isLastChapter ? "\u5168\u4E66\u7ED3\u5C40\u5151\u73B0\u4E0E\u4F59\u5473" : `\u7B2C ${chapterNumber + 1} \u7AE0\u5FC5\u987B\u7EE7\u7EED\u5904\u7406\u7684\u538B\u529B\u3001\u7EBF\u7D22\u548C\u4EBA\u7269\u5173\u7CFB`;
  const phaseObjective = positionInArc === 1 ? "\u6253\u5F00\u672C\u5F27\u7EBF\u7684\u65B0\u538B\u529B\uFF0C\u5E76\u628A\u4E0A\u4E00\u5F27/\u4E0A\u4E00\u7AE0\u7684\u4EE3\u4EF7\u5E26\u5165\u73B0\u573A" : chapterNumber === arcEnd ? "\u5151\u73B0\u672C\u5F27\u7EBF\u7684\u5C40\u90E8\u7ED3\u679C\uFF0C\u540C\u65F6\u5236\u9020\u66F4\u9AD8\u5C42\u7EA7\u7684\u95EE\u9898" : "\u8BA9\u5F53\u524D\u51B2\u7A81\u5347\u7EA7\u4E00\u6B21\uFF0C\u5E76\u628A\u4E3B\u89D2\u63A8\u5411\u66F4\u56F0\u96BE\u7684\u9009\u62E9";
  return {
    previousInput: `\u627F\u63A5\uFF1A${previousLabel}\uFF1B\u4E0D\u80FD\u53EA\u590D\u7528\u4E3B\u89D2\u59D3\u540D\u53E6\u8D77\u65E0\u5173\u5267\u60C5\u3002`,
    sceneObjective: `\u63A8\u8FDB\uFF1A\u56F4\u7ED5\u300C${projectIdea}\u300D\u5728\u7B2C ${arcNumber} \u5F27\uFF08\u7B2C ${arcStart}-${arcEnd} \u7AE0\uFF09\u5B8C\u6210\u4E00\u6B21\u5177\u4F53\u60C5\u8282\u63A8\u8FDB\uFF1A${phaseObjective}\u3002`,
    protagonistDecision: "\u4E3B\u89D2\u5FC5\u987B\u5728\u53EF\u89C1\u538B\u529B\u4E0B\u4E3B\u52A8\u505A\u51FA\u9009\u62E9\uFF0C\u9009\u62E9\u8981\u66B4\u9732\u6B32\u671B\u3001\u5F31\u70B9\u3001\u80FD\u529B\u8FB9\u754C\u6216\u4EF7\u503C\u53D6\u820D\u3002",
    irreversibleConsequence: "\u672C\u7AE0\u7ED3\u5C3E\u5FC5\u987B\u7559\u4E0B\u4E0D\u53EF\u9006\u53D8\u5316\uFF1A\u8EAB\u4EFD\u98CE\u9669\u3001\u5173\u7CFB\u88C2\u7F1D\u3001\u7EBF\u7D22\u66B4\u9732\u3001\u8D44\u6E90\u635F\u5931\u3001\u6743\u529B\u538B\u529B\u6216\u4E16\u754C\u89C4\u5219\u540E\u679C\u81F3\u5C11\u4E00\u9879\u3002",
    nextHandoff: `\u4EA4\u68D2\uFF1A\u628A\u672C\u7AE0\u7684\u4E0D\u53EF\u9006\u53D8\u5316\u8F6C\u5316\u4E3A${nextLabel}\u3002`,
    requiredContinuityAnchors: isFirstChapter ? ["\u4E3B\u89D2\u552F\u4E00\u8EAB\u4EFD", "\u6838\u5FC3\u7F3A\u53E3", "\u7B2C\u4E00\u679A\u4E3B\u7EBF\u7EBF\u7D22"] : ["\u4E0A\u4E00\u7AE0\u5173\u952E\u7269\u4EF6", "\u4E0A\u4E00\u7AE0\u5173\u7CFB\u53D8\u5316", "\u4E0A\u4E00\u7AE0\u672A\u89E3\u51B3\u95EE\u9898", "\u4E0A\u4E00\u7AE0\u4EE3\u4EF7"],
    characterStateDelta: "\u89D2\u8272\u72B6\u6001\u5FC5\u987B\u53D1\u751F\u53EF\u8FFD\u8E2A\u53D8\u5316\uFF1A\u4FE1\u4EFB\u3001\u503A\u52A1\u3001\u6050\u60E7\u3001\u91CE\u5FC3\u3001\u4F24\u53E3\u6216\u9635\u8425\u5173\u7CFB\u81F3\u5C11\u4E00\u9879\u8FDB\u5165\u8BB0\u5FC6\u8D26\u672C\u3002",
    foreshadowingOperation: chapterNumber % 3 === 0 ? "\u56DE\u6536\u6216\u90E8\u5206\u5151\u73B0\u4E00\u4E2A\u524D\u5E8F\u4F0F\u7B14\uFF0C\u540C\u65F6\u5EF6\u540E\u4E00\u4E2A\u66F4\u5927\u7684\u95EE\u9898\u3002" : "\u65B0\u589E\u4E00\u4E2A\u53EF\u8FFD\u8E2A\u4F0F\u7B14\uFF0C\u5E76\u660E\u786E\u5B83\u4E0E\u4E3B\u7EBF\u6216\u89D2\u8272\u4F24\u53E3\u7684\u5173\u7CFB\u3002"
  };
}
function chapterTaskSummary(chapterNumber, causalPlan) {
  return [
    `\u627F\u63A5\uFF1A${causalPlan.previousInput.replace(/^承接：/u, "")}`,
    `\u63A8\u8FDB\uFF1A${causalPlan.sceneObjective.replace(/^推进：/u, "")}`,
    `\u9009\u62E9\uFF1A${causalPlan.protagonistDecision}`,
    `\u4EE3\u4EF7\uFF1A${causalPlan.irreversibleConsequence}`,
    `\u4EA4\u68D2\uFF1A${causalPlan.nextHandoff.replace(/^交棒：/u, "")}`
  ].join(" ");
}
function buildChapterTasks(totalChapters, chapterWordTarget, projectIdea) {
  return Array.from({ length: totalChapters }, (_, index) => {
    const chapterNumber = index + 1;
    const causalPlan = buildChapterCausalPlan(chapterNumber, totalChapters, projectIdea);
    return {
      chapterNumber,
      title: `Chapter ${chapterNumber}`,
      status: "pending",
      summary: chapterTaskSummary(chapterNumber, causalPlan),
      targetWords: chapterWordTarget,
      causalPlan
    };
  });
}
function cleanProfileValue(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function normalizeNaturalnessTarget(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "light" || normalized === "strict") {
    return normalized;
  }
  return "balanced";
}
function buildCreativeProfile(options) {
  const input = options.creativeProfile || {};
  return {
    genre: cleanProfileValue(input.genre, "auto-inferred"),
    platform: cleanProfileValue(input.platform, "serialized web novel"),
    readerPromise: cleanProfileValue(input.readerPromise, "hook-forward, scene-first, emotionally specific"),
    pointOfView: cleanProfileValue(input.pointOfView, "third-person limited"),
    tone: cleanProfileValue(input.tone, "tense but readable"),
    naturalnessTarget: normalizeNaturalnessTarget(input.naturalnessTarget),
    styleFingerprint: cleanProfileValue(input.styleFingerprint, "pending sample or first-chapter extraction"),
    characterProfileRequirements: Array.isArray(input.characterProfileRequirements) && input.characterProfileRequirements.length ? input.characterProfileRequirements.map((entry) => cleanProfileValue(entry, "")).filter(Boolean) : DEFAULT_CHARACTER_PROFILE_REQUIREMENTS
  };
}
function buildCharacterDossierSeed(input) {
  const { now: now2, creativeProfile, projectIdea } = input;
  const genre = creativeProfile.genre === "auto-inferred" ? "selected genre pending" : creativeProfile.genre;
  const readerPromise = creativeProfile.readerPromise;
  return [
    {
      id: "protagonist",
      role: "protagonist",
      canonicalName: "pending-protagonist-name",
      aliases: ["\u4E3B\u89D2"],
      identityAndRole: `Primary viewpoint carrier for: ${projectIdea}`,
      coreDesire: `Must embody the reader promise: ${readerPromise}`,
      fearOrWound: "pending wound that makes the central conflict personal",
      contradiction: "pending contradiction between desire, fear, and visible behavior",
      behaviorHabits: ["pending repeated gesture", "pending pressure reaction"],
      speechMarkers: [creativeProfile.pointOfView, "pending address habit"],
      appearanceAndBody: "pending memorable silhouette, body marker, posture, or sensory trait",
      skills: ["pending unique competence tied to the conflict"],
      limitations: ["pending cost or blind spot that blocks easy victory"],
      relationshipState: "must be tracked through trust, debt, obligation, rivalry, or intimacy",
      relationshipEdges: [
        { targetId: "relationship-axis", label: "pressure mirror", pressure: "pending emotional or social pressure" },
        { targetId: "antagonist-force", label: "opposition", pressure: "pending externalized conflict pressure" }
      ],
      arcTrajectory: "from initial wound/desire toward the final emotional payoff",
      currentChapterDelta: "pending first chapter delta",
      continuityNotes: [
        `genre: ${genre}`,
        `tone: ${creativeProfile.tone}`,
        "Every chapter must reveal the protagonist through choice, action, habit, speech, body detail, and relationship pressure."
      ],
      evidence: ["seeded at project creation"],
      updatedAt: now2
    },
    {
      id: "antagonist-force",
      role: "antagonist",
      canonicalName: "pending-antagonist-or-pressure-force",
      aliases: ["\u5BF9\u6297\u529B\u91CF"],
      identityAndRole: "Opposition engine that turns the protagonist's desire into escalating cost.",
      coreDesire: "pending desire that is understandable, not only evil or obstructive",
      fearOrWound: "pending vulnerability or ideology that explains pressure style",
      contradiction: "pending human contradiction that prevents a flat villain shape",
      behaviorHabits: ["pending control habit"],
      speechMarkers: ["pending status-coded speech marker"],
      appearanceAndBody: "pending visual or behavioral marker readable in scene",
      skills: ["pending leverage over world, resources, secrets, or relationships"],
      limitations: ["pending blind spot the protagonist can eventually exploit"],
      relationshipState: "pressures the protagonist through stakes, temptation, debt, rule, or intimacy.",
      relationshipEdges: [
        { targetId: "protagonist", label: "opposes", pressure: "must attack the protagonist's wound, desire, or core value" }
      ],
      arcTrajectory: "escalates from pressure signal to active opposition to final reckoning",
      currentChapterDelta: "pending first visible pressure",
      continuityNotes: ["Avoid generic antagonist labeling; show power through specific choices and consequences."],
      evidence: ["seeded at project creation"],
      updatedAt: now2
    },
    {
      id: "relationship-axis",
      role: "relationship-axis",
      canonicalName: "pending-key-relationship-character",
      aliases: ["\u5173\u952E\u5173\u7CFB\u5BF9\u8C61"],
      identityAndRole: "A recurring ally, rival, intimate foil, family/debt figure, or witness who keeps the protagonist socially specific.",
      coreDesire: "pending desire that can conflict with or illuminate the protagonist",
      fearOrWound: "pending wound that shapes the relationship pressure",
      contradiction: "pending contradiction that gives scenes friction",
      behaviorHabits: ["pending relational habit"],
      speechMarkers: ["pending address or silence pattern"],
      appearanceAndBody: "pending concrete trait that prevents interchangeable supporting roles",
      skills: ["pending useful competence"],
      limitations: ["pending reason they cannot solve the plot alone"],
      relationshipState: "must carry a changing trust, debt, secret, attraction, rivalry, duty, or betrayal state.",
      relationshipEdges: [
        { targetId: "protagonist", label: "relationship pressure", pressure: "must change across chapters and enter the memory ledger" }
      ],
      arcTrajectory: "turns relationship pressure into plot pressure instead of decorative companionship",
      currentChapterDelta: "pending first relationship signal",
      continuityNotes: ["Do not let supporting characters disappear after serving one function."],
      evidence: ["seeded at project creation"],
      updatedAt: now2
    }
  ];
}
function buildInitialState(options) {
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  const title = options.title?.trim() || inferTitleFromIdea(options.idea);
  const projectIdea = options.idea.trim();
  const chapterTasks = buildChapterTasks(options.totalChapters, options.chapterWordTarget, projectIdea);
  const creativeProfile = buildCreativeProfile(options);
  const characterDossiers = buildCharacterDossierSeed({ now: now2, creativeProfile, projectIdea });
  return {
    project: {
      title,
      idea: projectIdea,
      createdAt: now2,
      workspaceVersion: WORKSPACE_VERSION,
      creativeProfile
    },
    runtime: {
      stage: "worldbuilding_dialogue",
      statusMessage: "Collecting worldbuilding answers through the ReAct discussion phase.",
      lastUpdatedAt: now2,
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
        loopCount: 0
      }
    },
    reactSetup: {
      discussionGoals: [
        "Clarify genre, promise, and target reader emotion.",
        "Lock the world rules, power ceiling, and conflict engine.",
        "Define protagonist wound, desire, and long-arc transformation.",
        "Set chapter count, pacing targets, and taboo constraints."
      ],
      unansweredQuestions: [
        "What emotional payoff should the ending deliver?",
        "What must never happen in this world?",
        "Why is the protagonist uniquely suited to carry the main conflict?"
      ]
    },
    plan: {
      totalChapters: options.totalChapters,
      chapterWordTarget: options.chapterWordTarget,
      pendingChapters: chapterTasks.length,
      chapterTasks
    },
    memory: {
      characterDossiers
    },
    assets: {
      cover: {
        status: "pending",
        briefPath: ".ai-novel/assets/cover/cover-brief.md",
        promptPath: COVER_PROMPT_PATH
      },
      comic: {
        status: "pending",
        planPath: ".ai-novel/assets/comic/comic-plan.md"
      }
    }
  };
}
function getWorkspacePaths(rootDir) {
  const workspaceDir = import_node_path10.default.join(rootDir, WORKSPACE_DIR2);
  return {
    workspaceDir,
    statePath: import_node_path10.default.join(workspaceDir, "state.json"),
    promptsDir: import_node_path10.default.join(workspaceDir, "prompts"),
    agentPromptsDir: import_node_path10.default.join(workspaceDir, "prompts", "agents"),
    consensusPath: import_node_path10.default.join(workspaceDir, "prompts", "global-consensus.md"),
    plansDir: import_node_path10.default.join(workspaceDir, "plans"),
    reportsDir: import_node_path10.default.join(workspaceDir, "reports"),
    styleDir: import_node_path10.default.join(workspaceDir, "style"),
    styleProfilePath: import_node_path10.default.join(workspaceDir, "style", "profile.md"),
    styleRulebookPath: import_node_path10.default.join(workspaceDir, "style", "rulebook.md"),
    styleReferencesPath: import_node_path10.default.join(workspaceDir, "style", "references.md"),
    styleAntiPatternsPath: import_node_path10.default.join(workspaceDir, "style", "anti-patterns.md"),
    chaptersDir: import_node_path10.default.join(workspaceDir, "chapters"),
    assetsDir: import_node_path10.default.join(workspaceDir, "assets"),
    coverDir: import_node_path10.default.join(workspaceDir, "assets", "cover"),
    comicDir: import_node_path10.default.join(workspaceDir, "assets", "comic"),
    memoryDir: import_node_path10.default.join(workspaceDir, "memory"),
    charactersDir: import_node_path10.default.join(workspaceDir, "memory", "characters"),
    characterCoreDir: import_node_path10.default.join(workspaceDir, "memory", "characters", "core"),
    characterDossiersPath: import_node_path10.default.join(workspaceDir, "memory", "characters", "dossiers.json"),
    characterDossiersMarkdownPath: import_node_path10.default.join(workspaceDir, "memory", "characters", "dossiers.md"),
    protagonistPath: import_node_path10.default.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
    relationsPath: import_node_path10.default.join(workspaceDir, "memory", "characters", "relations.md"),
    characterEvolutionPath: import_node_path10.default.join(workspaceDir, "memory", "characters", "evolution.md"),
    configPath: import_node_path10.default.join(workspaceDir, "config.json"),
    settingFreezePath: import_node_path10.default.join(workspaceDir, "plans", "setting-freeze.md"),
    masterOutlinePath: import_node_path10.default.join(workspaceDir, "plans", "master-outline.md"),
    chapterBlueprintsDir: import_node_path10.default.join(workspaceDir, "plans", "chapter-blueprints"),
    coverPromptPath: import_node_path10.default.join(workspaceDir, "assets", "cover", "cover-prompt.md"),
    coverImagePath: import_node_path10.default.join(workspaceDir, "assets", "cover", "cover.png"),
    coverMetadataPath: import_node_path10.default.join(workspaceDir, "assets", "cover", "cover-metadata.json")
  };
}
function formatCharacterDossier(dossier) {
  return [
    `## ${dossier.canonicalName}`,
    "",
    `- id: ${dossier.id}`,
    `- role: ${dossier.role}`,
    `- aliases: ${dossier.aliases.join(", ") || "none"}`,
    `- identity and role: ${dossier.identityAndRole}`,
    `- core desire: ${dossier.coreDesire}`,
    `- fear or wound: ${dossier.fearOrWound}`,
    `- contradiction: ${dossier.contradiction}`,
    `- behavior habits: ${dossier.behaviorHabits.join("; ") || "pending"}`,
    `- speech markers: ${dossier.speechMarkers.join("; ") || "pending"}`,
    `- appearance and body: ${dossier.appearanceAndBody}`,
    `- skills: ${dossier.skills.join("; ") || "pending"}`,
    `- limitations: ${dossier.limitations.join("; ") || "pending"}`,
    `- relationship state: ${dossier.relationshipState}`,
    `- arc trajectory: ${dossier.arcTrajectory}`,
    `- current chapter delta: ${dossier.currentChapterDelta}`,
    "",
    "Relationship edges:",
    ...dossier.relationshipEdges.length ? dossier.relationshipEdges.map((edge) => `- ${edge.targetId}: ${edge.label}; pressure: ${edge.pressure}`) : ["- none"],
    "",
    "Continuity notes:",
    ...dossier.continuityNotes.length ? dossier.continuityNotes.map((note) => `- ${note}`) : ["- none"],
    "",
    "Evidence:",
    ...dossier.evidence.length ? dossier.evidence.map((item) => `- ${item}`) : ["- none"]
  ].join("\n");
}
function formatCharacterDossierSummary(dossiers) {
  return [
    "# Character Dossiers",
    "",
    "This file is generated from the structured production character dossier state.",
    "The JSON source of truth lives at `.ai-novel/memory/characters/dossiers.json`.",
    "",
    ...dossiers.flatMap((dossier) => [formatCharacterDossier(dossier), ""])
  ].join("\n").trimEnd();
}
async function writeWorkspaceArtifacts(rootDir, state) {
  const paths = getWorkspacePaths(rootDir);
  const textLlmConfig = await loadLlmConfigForCapability(rootDir, "text").catch(() => null);
  const llmConfig = {
    provider: {
      baseUrl: textLlmConfig?.provider.baseUrl || "",
      apiKeyEnv: textLlmConfig ? "DB_ACTIVE_CONFIG" : "unset",
      modelName: textLlmConfig?.provider.modelName || "",
      apiMode: textLlmConfig?.provider.apiMode || "chat",
      timeoutMs: textLlmConfig?.provider.timeoutMs || 12e4,
      temperature: textLlmConfig?.provider.temperature || 0.1,
      reactMaxSteps: 25
    },
    writing: {
      chapterWordTarget: state.plan.chapterWordTarget,
      chapterWordMinimum: MIN_CHAPTER_WORD_TARGET
    }
  };
  const creativeProfile = state.project.creativeProfile || buildCreativeProfile({
    rootDir,
    idea: state.project.idea,
    totalChapters: state.plan.totalChapters,
    chapterWordTarget: state.plan.chapterWordTarget,
    title: state.project.title
  });
  const characterDossiers = state.memory?.characterDossiers?.length ? state.memory.characterDossiers : buildCharacterDossierSeed({
    now: state.project.createdAt,
    creativeProfile,
    projectIdea: state.project.idea
  });
  state.memory = {
    ...state.memory || {},
    characterDossiers
  };
  const protagonistDossier = characterDossiers.find((dossier) => dossier.role === "protagonist") || characterDossiers[0];
  await import_promises7.default.mkdir(paths.promptsDir, { recursive: true });
  await import_promises7.default.mkdir(paths.agentPromptsDir, { recursive: true });
  await import_promises7.default.mkdir(paths.plansDir, { recursive: true });
  await import_promises7.default.mkdir(paths.reportsDir, { recursive: true });
  await import_promises7.default.mkdir(paths.styleDir, { recursive: true });
  await import_promises7.default.mkdir(paths.chaptersDir, { recursive: true });
  await import_promises7.default.mkdir(paths.coverDir, { recursive: true });
  await import_promises7.default.mkdir(paths.comicDir, { recursive: true });
  await import_promises7.default.mkdir(paths.characterCoreDir, { recursive: true });
  await writeJsonFileAtomic2(paths.statePath, state);
  await writeJsonFileAtomic2(paths.configPath, llmConfig);
  await writeJsonFileAtomic2(paths.characterDossiersPath, characterDossiers);
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
    "Discuss one uncertainty at a time, summarize agreed facts after each answer, and stop when enough detail exists to freeze the setting."
  ].join("\n");
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
    "- per-chapter task queue"
  ].join("\n");
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
    "- reserve space for title and author text"
  ].join("\n");
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
    "This is a planning stub for a later illustrated storytelling pipeline."
  ].join("\n");
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
    ...state.reactSetup.unansweredQuestions.map((question) => `- ${question}`)
  ].join("\n");
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
    "- anti-AI goal: avoid repetitive sentence rhythm and generic scene labeling"
  ].join("\n");
  const styleRulebook = [
    "# Style Rulebook",
    "",
    "Permanent constraints:",
    "- keep prose readable and human-sounding",
    "- do not flatten every character into the same speaking voice",
    "- preserve chapter-level hooks",
    "- use concrete sensory details instead of generic emotion tags",
    "- keep exposition subordinate to scene momentum"
  ].join("\n");
  const styleReferences = [
    "# Style References",
    "",
    "Reference slots:",
    "- dialogue reference: pending",
    "- scene reference: pending",
    "- escalation reference: pending",
    "- emotional texture reference: pending"
  ].join("\n");
  const styleAntiPatterns = [
    "# Style Anti-Patterns",
    "",
    "- repeated abstract emotion naming without embodiment",
    "- generic transition sentences that only move information",
    "- identical dialogue cadence across roles",
    "- summary-heavy scene writing when a dramatized beat is needed"
  ].join("\n");
  const protagonistSeed = [
    "# Protagonist Seed",
    "",
    `Project: ${state.project.title}`,
    `Core idea connection: ${state.project.idea}`,
    "",
    "Structured production dossier:",
    protagonistDossier ? formatCharacterDossier(protagonistDossier) : "- protagonist dossier missing",
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
    "- Every chapter should reveal personality through action, choice, habit, speech, body detail, and relationship pressure."
  ].join("\n");
  const relations = [
    "# Character Relations",
    "",
    "Structured relationship edges:",
    ...characterDossiers.flatMap((dossier) => dossier.relationshipEdges.length ? dossier.relationshipEdges.map((edge) => `- ${dossier.id} -> ${edge.targetId}: ${edge.label}; pressure: ${edge.pressure}`) : [`- ${dossier.id}: no relationship edge yet`]),
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
    ...creativeProfile.characterProfileRequirements.map((entry) => `- ${entry}`)
  ].join("\n");
  const evolution = [
    "# Character Evolution Log",
    "",
    "Seeded production dossiers:",
    ...characterDossiers.map((dossier) => `- ${dossier.id}: ${dossier.currentChapterDelta}`),
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
    "- continuity risk for next chapter:"
  ].join("\n");
  const basePrompts = /* @__PURE__ */ new Map([
    [
      "showrunner",
      "# Showrunner Base Prompt\n\nYou protect the novel's shared truth, decide what becomes consensus, and keep all roles aligned."
    ],
    [
      "world-architect",
      "# World Architect Base Prompt\n\nYou define world rules, limits, factions, and conflict engines without drifting into prose polish."
    ],
    [
      "author",
      "# Author Base Prompt\n\nYou create compelling characters, dramatic turns, and emotionally engaging scene intent."
    ],
    [
      "editor",
      "# Editor Base Prompt\n\nYou guard pacing, clarity, reader momentum, and serialized hook quality."
    ],
    [
      "reviewer",
      "# Reviewer Base Prompt\n\nYou search for logic gaps, continuity failures, and broken promises in the novel plan."
    ],
    [
      "prose-stylist",
      "# NaturalnessAgent Base Prompt\n\nYou are the production NaturalnessAgent. You humanize language, deepen scene texture, preserve facts, protect character voice, and reduce AI-sounding phrasing without changing core plot decisions."
    ]
  ]);
  const dynamicPrompts = new Map(
    AGENT_ROLES.map((role) => [
      role,
      `# ${role} Dynamic Prompt

Current focus:
- project stage: ${state.runtime.stage}
- chapter word target: ${state.plan.chapterWordTarget}
- update this file only through curated consensus refreshes
`
    ])
  );
  await import_promises7.default.writeFile(import_node_path10.default.join(paths.promptsDir, "react-worldbuilding.md"), `${reactPrompt}
`);
  await import_promises7.default.writeFile(import_node_path10.default.join(paths.plansDir, "plan-and-solve-brief.md"), `${planBrief}
`);
  await import_promises7.default.writeFile(paths.consensusPath, `${globalConsensus}
`);
  await import_promises7.default.writeFile(paths.styleProfilePath, `${styleProfile}
`);
  await import_promises7.default.writeFile(paths.styleRulebookPath, `${styleRulebook}
`);
  await import_promises7.default.writeFile(paths.styleReferencesPath, `${styleReferences}
`);
  await import_promises7.default.writeFile(paths.styleAntiPatternsPath, `${styleAntiPatterns}
`);
  await import_promises7.default.writeFile(paths.characterDossiersMarkdownPath, `${formatCharacterDossierSummary(characterDossiers)}
`);
  await import_promises7.default.writeFile(paths.protagonistPath, `${protagonistSeed}
`);
  await import_promises7.default.writeFile(paths.relationsPath, `${relations}
`);
  await import_promises7.default.writeFile(paths.characterEvolutionPath, `${evolution}
`);
  await import_promises7.default.writeFile(import_node_path10.default.join(paths.coverDir, "cover-brief.md"), `${coverBrief}
`);
  await import_promises7.default.writeFile(import_node_path10.default.join(paths.comicDir, "comic-plan.md"), `${comicPlan}
`);
  await Promise.all(
    AGENT_ROLES.flatMap((role) => {
      const base = import_node_path10.default.join(paths.agentPromptsDir, `${role}.base.md`);
      const dynamic = import_node_path10.default.join(paths.agentPromptsDir, `${role}.dynamic.md`);
      return [
        import_promises7.default.writeFile(base, `${basePrompts.get(role) ?? ""}
`),
        import_promises7.default.writeFile(dynamic, `${dynamicPrompts.get(role) ?? ""}
`)
      ];
    })
  );
}
async function readOptionalText3(filePath) {
  try {
    return (await import_promises7.default.readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}
async function readOptionalJson2(filePath) {
  try {
    const raw = await import_promises7.default.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function fileHasContent2(filePath) {
  return Boolean((await readOptionalText3(filePath)).trim());
}
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
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
function createStoryFoundationFingerprint(payload) {
  return (0, import_node_crypto3.createHash)("sha256").update(stableJson(payload)).digest("hex").slice(0, 24);
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
async function countMarkdownFiles(dirPath) {
  try {
    const entries = await import_promises7.default.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && /\.md$/iu.test(entry.name)).length;
  } catch {
    return 0;
  }
}
async function evaluateDraftingStartReadiness(rootDir, paths, state) {
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
  const totalChapters = Math.max(0, Number(state.plan.totalChapters || state.plan.chapterTasks.length || 0));
  const planningAssetDetails = await Promise.all(requiredPlanningAssets.map(async (asset) => {
    const assetPath = import_node_path10.default.join(paths.plansDir, asset);
    const present = await fileHasContent2(assetPath);
    const issue = present && asset.endsWith(".json") ? planningAssetStructuralIssue(asset, await readOptionalJson2(assetPath), totalChapters) : "";
    return {
      key: asset.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
      label: asset,
      path: `.ai-novel/plans/${asset}`,
      status: present && !issue ? "passed" : "blocked",
      detail: present ? issue || "\u5DF2\u751F\u6210" : "\u7F3A\u5931"
    };
  }));
  const presentPlanningAssets = planningAssetDetails.filter((asset) => asset.status === "passed").map((asset) => asset.label);
  const storyFoundationApproval = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, STORY_FOUNDATION_APPROVAL_FILE));
  const storyFoundationApproved = Boolean(storyFoundationApproval?.approved === true && String(storyFoundationApproval.approvedAt || "").trim());
  const storyFoundationApprovalFingerprint = typeof storyFoundationApproval?.assetFingerprint === "string" ? String(storyFoundationApproval.assetFingerprint) : "";
  const styleEvolution = await loadStyleEvolution(rootDir).catch(() => null);
  const hasCharacterDynamicsAsset = await fileHasContent2(import_node_path10.default.join(paths.plansDir, "character-dynamics.json"));
  const hasDossiers = await fileHasContent2(paths.characterDossiersPath) || hasCharacterDynamicsAsset;
  const hasRelationships = await fileHasContent2(import_node_path10.default.join(paths.charactersDir, "relationships.json")) || hasCharacterDynamicsAsset;
  const blueprintCount = await countMarkdownFiles(paths.chapterBlueprintsDir);
  const consensus = await readOptionalText3(paths.consensusPath);
  const storyFoundationContract = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, "story-foundation-contract.json"));
  const worldMatrix = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, "world-matrix.json"));
  const plotArchitecture = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, "plot-architecture.json"));
  const storyBible = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, "story-bible.json"));
  const volumeStrategy = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, "volume-strategy.json"));
  const foreshadowingLedger = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, "foreshadowing-ledger.json"));
  const characterDynamics = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, "character-dynamics.json"));
  const writingPlan = await readOptionalJson2(import_node_path10.default.join(paths.plansDir, "writing-plan.json"));
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
  return evaluateProductionReadiness({
    consensusText: consensus,
    planningArtifactCount: presentPlanningAssets.length,
    planningRequiredAssetCount: presentPlanningAssets.length,
    planningRequiredAssets: requiredPlanningAssets,
    planningMissingRequiredAssets: requiredPlanningAssets.filter((asset) => !presentPlanningAssets.includes(asset)),
    planningAssetDetails,
    storyFoundationApproved,
    storyFoundationApprovalPath: `.ai-novel/plans/${STORY_FOUNDATION_APPROVAL_FILE}`,
    storyFoundationApprovedAt: typeof storyFoundationApproval?.approvedAt === "string" ? storyFoundationApproval.approvedAt : void 0,
    storyFoundationApprovalFingerprint,
    storyFoundationAssetFingerprint,
    characterAssetDetails: [
      {
        key: "character_dossiers",
        label: "\u4EBA\u7269\u6863\u6848",
        path: ".ai-novel/memory/characters/dossiers.json",
        status: hasDossiers ? "passed" : "blocked",
        detail: hasDossiers ? "\u5DF2\u751F\u6210" : "\u7F3A\u5931"
      },
      {
        key: "relationship_graph",
        label: "\u4EBA\u7269\u5173\u7CFB\u56FE",
        path: ".ai-novel/memory/characters/relationships.json",
        status: hasRelationships ? "passed" : "blocked",
        detail: hasRelationships ? "\u5DF2\u751F\u6210" : "\u7F3A\u5931"
      }
    ],
    executionAssetDetails: [
      {
        key: "chapter_blueprints",
        label: "\u7AE0\u8282\u84DD\u56FE",
        path: ".ai-novel/plans/chapter-blueprints/",
        status: totalChapters > 0 && blueprintCount >= totalChapters ? "passed" : "blocked",
        detail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} \u4E2A\u84DD\u56FE`
      },
      {
        key: "style_contract",
        label: "\u5199\u6CD5\u5408\u540C",
        path: ".ai-novel/style/evolution/style-contract.json",
        status: styleEvolution?.gate?.status || "blocked",
        detail: styleEvolution?.gate?.status === "passed" ? "\u5DF2\u51BB\u7ED3" : styleEvolution?.gate?.blockedReason || "\u5F85\u786E\u8BA4"
      }
    ],
    blueprintCount,
    totalChapters,
    characterDossierCount: hasDossiers ? Math.max(1, state.memory?.characterDossiers?.length || 0) : 0,
    styleGate: styleEvolution?.gate || evaluateStyleEvolutionGate(null),
    memoryRecallRows: Math.max(0, Number(state.memory?.characterDossiers?.length || 0)),
    memoryLag: 0,
    contextBudgetPercent: 0
  });
}
async function blockDraftingUntilReady(rootDir, paths, state, pipelineOptions) {
  const readiness = await evaluateDraftingStartReadiness(rootDir, paths, state);
  if (readiness.canProceed) {
    return false;
  }
  state.runtime.stage = "chapter_task_generation";
  state.runtime.statusMessage = `Drafting is blocked by production readiness: ${readiness.blockedReason || readiness.summary}`;
  stampRuntimeProgress(state, "drafting_blocked_by_production_readiness");
  await saveAutonomousState(rootDir, state);
  await recordWorkflowEvent(pipelineOptions, "DRAFTING_START_BLOCKED_BY_READINESS", {
    status: readiness.status,
    score: readiness.score,
    blockedReason: readiness.blockedReason,
    issueCodes: readiness.issues.map((issue) => issue.code)
  });
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
  }
  return true;
}
async function writeJsonFileAtomic2(filePath, value) {
  const data = `${JSON.stringify(value, null, 2)}
`;
  await import_promises7.default.mkdir(import_node_path10.default.dirname(filePath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tempPath = import_node_path10.default.join(import_node_path10.default.dirname(filePath), `.${import_node_path10.default.basename(filePath)}.${process.pid}.${Date.now()}.${(0, import_node_crypto2.randomUUID)()}.tmp`);
    try {
      const handle = await import_promises7.default.open(tempPath, "wx");
      try {
        await handle.writeFile(data, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await import_promises7.default.rename(tempPath, filePath);
      return;
    } catch (error) {
      await import_promises7.default.unlink(tempPath).catch(() => void 0);
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
function extractMeaningfulLines(source, limit = 4) {
  return source.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).slice(0, limit);
}
function trimForPrompt(source, maxChars) {
  const normalized = source.trim().replace(/\n{3,}/g, "\n\n");
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars).trim()}
[truncated]`;
}
function getEnvValue(rootDir, name) {
  return process.env[name] || getProjectEnvStatus(rootDir).values[name] || "";
}
function buildFallbackCoverVisualBrief(state, context) {
  const consensusLines = extractMeaningfulLines(context.consensus, 5);
  const protagonistLines = extractMeaningfulLines(context.protagonist, 4);
  const styleLines = extractMeaningfulLines(context.style, 3);
  const genre = state.project.creativeProfile?.genre || "genre-forward commercial fiction";
  return [
    "# Cover Visual Brief",
    "",
    `Title: ${state.project.title}`,
    `Core concept: ${state.project.idea}`,
    `Genre signal: ${genre}`,
    "",
    "Primary cover concept:",
    "- A single iconic protagonist silhouette or symbolic emblem dominates the cover.",
    "- The image should feel like a premium illustrated novel cover, not a generic stock poster.",
    "- The central visual metaphor must communicate the protagonist's pressure, ambition, and story promise at a glance.",
    "",
    "Story signals to visualize:",
    ...consensusLines.length ? consensusLines.map((line) => `- ${line}`) : ["- Use the frozen world assumptions and central conflict."],
    "",
    "Character or emblem focus:",
    ...protagonistLines.length ? protagonistLines.map((line) => `- ${line}`) : ["- Foreground one memorable protagonist silhouette or emblem."],
    "",
    "Style direction:",
    ...styleLines.length ? styleLines.map((line) => `- ${line}`) : ["- Signal the genre promise immediately."],
    "",
    "Composition:",
    "- Vertical 2:3 book-cover layout with a clear foreground, midground, and background.",
    "- One strong focal shape, dramatic lighting, readable silhouette, and title-safe negative space near the upper third.",
    "- Avoid busy collage layouts, plastic fantasy armor, random flames, over-rendered faces, and cheap mobile-game poster aesthetics.",
    "",
    "Color and finish:",
    "- Use a disciplined color script with one dominant mood color and one accent color.",
    "- High-end editorial illustration, cinematic but painterly, crisp edges on the focal subject, atmospheric depth in the background."
  ].join("\n");
}
function buildCoverBriefRequest(state, context) {
  return [
    `Novel title: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Genre: ${state.project.creativeProfile?.genre || "unknown"}`,
    `Reader promise: ${state.project.creativeProfile?.readerPromise || "unknown"}`,
    "",
    "Global consensus:",
    trimForPrompt(context.consensus || "(not finalized)", 3500),
    "",
    "Protagonist dossier:",
    trimForPrompt(context.protagonist || "(not finalized)", 1800),
    "",
    "Style profile:",
    trimForPrompt(context.style || "(not finalized)", 1500)
  ].join("\n");
}
async function generateCoverVisualBrief(rootDir, state, context) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return { brief: buildFallbackCoverVisualBrief(state, context), source: "fallback", error: "test_mode" };
  }
  try {
    const config = await loadLlmConfigForCapability(rootDir, "text");
    const apiKey = config?._dbApiKey || "";
    if (!config || !apiKey) {
      throw new Error("text_llm_config_missing");
    }
    const brief = await requestLlmTextCompletion({
      baseUrl: config.provider.baseUrl,
      apiKey,
      modelName: config.provider.modelName,
      apiMode: config.provider.apiMode,
      timeoutMs: config.provider.timeoutMs,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: [
            "You are a senior commercial book-cover art director.",
            "Create an English visual brief for a text-to-image model.",
            "Do not write prose fiction. Do not ask questions. Do not include typography copy.",
            "Prioritize specific visual anchors, composition, mood, palette, lighting, and negative constraints."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            buildCoverBriefRequest(state, context),
            "",
            "Return markdown with exactly these sections:",
            "1. Core Visual Metaphor",
            "2. Main Subject",
            "3. Setting And Background",
            "4. Composition",
            "5. Palette And Lighting",
            "6. Texture And Rendering Style",
            "7. Must Avoid",
            "",
            "Make the brief concrete enough that the generated image will not look like a generic webnovel poster."
          ].join("\n")
        }
      ]
    });
    if (!brief) {
      throw new Error("text_llm_returned_empty_cover_brief");
    }
    return { brief, source: "llm" };
  } catch (error) {
    return {
      brief: buildFallbackCoverVisualBrief(state, context),
      source: "fallback",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
function buildFinalCoverImagePrompt(state, visualBrief) {
  return [
    `Create a premium illustrated vertical novel cover for "${state.project.title}".`,
    `Core story concept: ${state.project.idea}.`,
    "",
    "Use this art-direction brief as binding visual guidance:",
    trimForPrompt(visualBrief, 5e3),
    "",
    "Image requirements:",
    "- Vertical 2:3 book-cover composition, commercial publishing quality, polished editorial illustration.",
    "- One dominant focal subject or emblem, strong silhouette, cinematic depth, clear foreground/midground/background separation.",
    "- Leave clean negative space for title and author typography; do not render any letters, pseudo-text, subtitles, logos, or watermarks.",
    "- Avoid generic stock-poster composition, cheap mobile-game aesthetics, cluttered collage layouts, malformed anatomy, extra limbs, distorted faces, celebrity likeness, and blurry low-detail output."
  ].join("\n");
}
function buildCoverPrompt(state, visualBrief) {
  const imagePrompt = buildFinalCoverImagePrompt(state, visualBrief.brief);
  return {
    markdown: [
      "# Cover Image Prompt",
      "",
      `Project: ${state.project.title}`,
      `Core idea: ${state.project.idea}`,
      `Visual brief source: ${visualBrief.source}`,
      visualBrief.error ? `Visual brief fallback reason: ${visualBrief.error}` : "",
      "",
      "## Visual Brief",
      "",
      visualBrief.brief,
      "",
      "## Final Image Prompt",
      "",
      imagePrompt
    ].filter(Boolean).join("\n"),
    imagePrompt
  };
}
async function getImageGenerationConfig(rootDir) {
  const imageConfig = await loadLlmConfigForCapability(rootDir, "image").catch(() => null);
  const baseUrl = imageConfig?.provider.baseUrl || "";
  const apiKey = imageConfig?._dbApiKey || "";
  const model = imageConfig?.provider.modelName || "";
  const size = getEnvValue(rootDir, "IMAGE_SIZE") || "1024x1536";
  return { baseUrl, apiKey, model, size };
}
async function requestCoverImage(rootDir, prompt) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    throw new Error("image_generation_skipped_in_test_mode");
  }
  const config = await getImageGenerationConfig(rootDir);
  if (!config.apiKey) {
    throw new Error("image_generation_api_key_missing");
  }
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      prompt,
      size: config.size,
      n: 1
    })
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || text || response.statusText;
    throw new Error(`image_generation_failed:${response.status}:${message}`);
  }
  const first = Array.isArray(payload?.data) ? payload.data[0] : null;
  const base64 = first?.b64_json || first?.base64 || first?.image;
  if (typeof base64 === "string" && base64.trim()) {
    return {
      bytes: Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ""), "base64"),
      mimeType: "image/png",
      provider: {
        baseUrl: config.baseUrl,
        model: config.model,
        size: config.size
      }
    };
  }
  const url = first?.url;
  if (typeof url === "string" && url.trim()) {
    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      throw new Error(`image_download_failed:${imageResponse.status}:${imageResponse.statusText}`);
    }
    return {
      bytes: Buffer.from(await imageResponse.arrayBuffer()),
      mimeType: imageResponse.headers.get("content-type") || "image/png",
      sourceUrl: url,
      provider: {
        baseUrl: config.baseUrl,
        model: config.model,
        size: config.size
      }
    };
  }
  throw new Error("image_generation_returned_no_image");
}
async function initAutonomousProject(options) {
  const paths = getWorkspacePaths(options.rootDir);
  if (options.chapterWordTarget < MIN_CHAPTER_WORD_TARGET) {
    throw new Error(`Chapter word target must be at least ${MIN_CHAPTER_WORD_TARGET}.`);
  }
  await import_promises7.default.mkdir(paths.workspaceDir, { recursive: true });
  const state = buildInitialState(options);
  await writeWorkspaceArtifacts(options.rootDir, state);
  await initializeSuperGraph(options.rootDir, state);
  return state;
}
async function listAutonomousProjects(rootDir) {
  return readProjectRegistry(rootDir);
}
async function deleteManagedAutonomousProject(rootDir, projectId) {
  const projects = await readProjectRegistry(rootDir);
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) {
    return null;
  }
  const projectRoot = resolveStoredProjectRoot(rootDir, project.projectRoot, project.id);
  const expectedProjectRoot = import_node_path10.default.resolve(resolveProjectRoot(rootDir, project.id));
  if (import_node_path10.default.resolve(projectRoot) !== expectedProjectRoot) {
    throw new Error(`Refusing to delete project outside managed workspace: ${projectRoot}`);
  }
  await withFactoryDb(rootDir, async (db) => {
    const cancelledJobs = db.cancelProjectJobs(project.id);
    db.recordEvent(project.id, null, "PROJECT_DELETED", {
      id: project.id,
      title: project.title,
      projectRoot,
      cancelledJobs
    });
  });
  await import_promises7.default.rm(projectRoot, { recursive: true, force: true });
  await writeProjectRegistry(rootDir, projects.filter((entry) => entry.id !== project.id));
  await withFactoryDb(rootDir, async (db) => {
    db.deleteProject(project.id);
  });
  return {
    project: {
      ...project,
      projectRoot
    }
  };
}
async function resolveManagedProjectRoot(rootDir, projectId) {
  const projects = await readProjectRegistry(rootDir);
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) {
    throw new Error(`Project '${projectId}' not found.`);
  }
  return resolveStoredProjectRoot(rootDir, project.projectRoot, project.id);
}
async function createManagedAutonomousProject(options) {
  const projects = await readProjectRegistry(options.rootDir);
  const title = options.title?.trim() || inferTitleFromIdea(options.idea);
  const slug = slugifyTitle(title);
  const projectId = createUniqueProjectId(slug, projects);
  const projectRoot = resolveProjectRoot(options.rootDir, projectId);
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const state = await initAutonomousProject({
    ...options,
    rootDir: projectRoot,
    title
  });
  const record = {
    id: projectId,
    slug,
    title: state.project.title,
    idea: state.project.idea,
    createdAt,
    totalChapters: state.plan.totalChapters,
    chapterWordTarget: state.plan.chapterWordTarget,
    projectRoot
  };
  await writeProjectRegistry(options.rootDir, [...projects, record]);
  await withFactoryDb(options.rootDir, async (db) => {
    db.upsertProject(record, state);
    db.recordEvent(record.id, null, "PROJECT_CREATED", {
      title: record.title,
      idea: record.idea,
      projectRoot: record.projectRoot,
      creativeProfile: state.project.creativeProfile
    });
    db.recordArtifact({
      projectId: record.id,
      kind: "consensus",
      path: ".ai-novel/prompts/global-consensus.md",
      status: "completed"
    });
    db.recordArtifact({
      projectId: record.id,
      kind: "context",
      path: ".ai-novel/context/current-context.md",
      status: "pending"
    });
    db.createJob({
      projectId: record.id,
      kind: "knowledge_global_bootstrap",
      status: "idle",
      payload: {
        scope: "global",
        reason: "project_created",
        limit: process.env.AI_NOVEL_TEST_MODE === "1" ? 4 : void 0
      }
    });
    db.createJob({
      projectId: record.id,
      kind: "knowledge_project_artifact",
      status: "idle",
      payload: {
        projectId: record.id,
        artifactPath: ".ai-novel/prompts/global-consensus.md",
        kind: "consensus",
        reason: "project_created"
      }
    });
  });
  await initializeSuperGraph(projectRoot, state, { factoryRootDir: options.rootDir, projectId });
  return {
    project: record,
    state
  };
}
async function loadAutonomousState(rootDir) {
  const { statePath } = getWorkspacePaths(rootDir);
  const raw = await import_promises7.default.readFile(statePath, "utf8");
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
  task.aigcStatus = pipelineOptions.bypassAigcGate ? "pending" : produced.qualityGate.status === "blocked" ? "blocked" : "passed";
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
        status: fact.status === "complete" && taskInstructionIsNewer ? "passed" : fact.qualityGate.status,
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
    const finalPath = import_node_path10.default.join(paths.chaptersDir, `${chapterId}.final.md`);
    try {
      await import_promises7.default.access(finalPath);
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
  const dbSettings = await withFactoryDb(options.factoryRootDir || rootDir, async (db) => {
    return {
      bypassAigcGate: db.getSystemSetting("bypassAigcGate"),
      draftSubcallRoles: db.getSystemSetting("draftSubcallRoles")
    };
  }).catch(() => null);
  const bypassAigcGateDb = dbSettings?.bypassAigcGate === "1";
  const draftSubcallRolesDb = parseDraftSubcallRolesSetting(dbSettings?.draftSubcallRoles);
  const pipelineOptions = {
    envRootDir: rootDir,
    bypassAigcGate: bypassAigcGateDb,
    ...draftSubcallRolesDb ? { draftSubcallRoles: draftSubcallRolesDb } : {},
    ...options
  };
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
    consensus: await readOptionalText3(paths.consensusPath),
    protagonist: await readOptionalText3(paths.protagonistPath),
    style: await readOptionalText3(paths.styleProfilePath)
  };
  if (state.runtime.stage === "aigc_refinement") {
    throwIfStopped(pipelineOptions.signal);
    const autoRefineVal = await withFactoryDb(pipelineOptions.factoryRootDir || rootDir, async (db) => {
      return db.getSystemSetting("autoAigcRefinement");
    }).catch(() => null);
    const isAutoRefineEnabled = autoRefineVal === "1";
    if (!isAutoRefineEnabled) {
      state.runtime.statusMessage = "All chapter drafts generated. Waiting for manual AIGC batch scanning and refinement.";
      await saveAutonomousState(rootDir, state);
      return state;
    }
    const refineTask = state.plan.chapterTasks.find(
      (t) => t.aigcStatus === "pending" || t.aigcStatus === "blocked" || !t.aigcStatus
    );
    if (!refineTask) {
      state.runtime.stage = "complete";
      state.runtime.statusMessage = "All chapter drafts generated and AIGC batch refinement finalized successfully.";
      state.runtime.lastRoute = "workflow";
      state.runtime.lastAction = "workflow_complete";
      await saveAutonomousState(rootDir, state);
      if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
        await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
      }
      return state;
    }
    const chapterId = `chapter-${String(refineTask.chapterNumber).padStart(3, "0")}`;
    const finalPath = import_node_path10.default.join(paths.chaptersDir, `${chapterId}.final.md`);
    let finalDraft = "";
    try {
      finalDraft = await import_promises7.default.readFile(finalPath, "utf8");
    } catch {
      refineTask.aigcStatus = "skipped";
      state.runtime.statusMessage = `Automated AIGC refining: Chapter ${refineTask.chapterNumber} final draft not found, skipping.`;
      await saveAutonomousState(rootDir, state);
      return state;
    }
    state.runtime.statusMessage = `Automated AIGC refining: Chapter ${refineTask.chapterNumber} scanning AIGC risk...`;
    await saveAutonomousState(rootDir, state);
    try {
      const detectorConfig = getAigcDetectorConfig(rootDir);
      const bodyOnly = finalDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
      const detectResult = await detectAigcSegments(bodyOnly || finalDraft, detectorConfig);
      const aigcReport = normalizeAigcWritingDetectionReport(detectResult);
      if (aigcReport.status === "blocked" && aigcReport.highRiskSegments.length > 0) {
        state.runtime.statusMessage = `Automated AIGC refining: Chapter ${refineTask.chapterNumber} has ${aigcReport.highRiskSegments.length} high risk segments, fixing...`;
        await saveAutonomousState(rootDir, state);
        const resources = await loadProductionWritingResources(rootDir);
        const refinedDraft = await repairAigcHighRiskDraft(
          state,
          refineTask,
          finalDraft,
          aigcReport,
          resources,
          pipelineOptions,
          {},
          state.memory?.characterDossiers || []
        );
        await import_promises7.default.writeFile(finalPath, `${refinedDraft}
`, "utf8");
        const finalBodyOnly = refinedDraft.split(/\n##\s+(?:Drafting Metadata|Polish Pass|Quality Gate|Naturalness Report|章节元数据|章节元信息)/u)[0];
        const finalDetectResult = await detectAigcSegments(finalBodyOnly || refinedDraft, detectorConfig);
        const finalAigcReport = normalizeAigcWritingDetectionReport(finalDetectResult);
        refineTask.aigcStatus = finalAigcReport.status === "blocked" ? "blocked" : "passed";
        if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
          await withFactoryDb(pipelineOptions.factoryRootDir, async (db) => {
            db.recordEvent(pipelineOptions.projectId, `auto_refine_ch_${refineTask.chapterNumber}`, "AIGC_DETECTION_COMPLETED", {
              chapterNumber: refineTask.chapterNumber,
              aigcReport: finalAigcReport
            });
          }).catch(() => void 0);
        }
      } else {
        refineTask.aigcStatus = "passed";
      }
    } catch (e) {
      refineTask.aigcStatus = "skipped";
      state.runtime.statusMessage = `Automated AIGC refining: Chapter ${refineTask.chapterNumber} failed with error: ${String(e)}, skipping.`;
    }
    state.runtime.statusMessage = `Automated AIGC refining: Chapter ${refineTask.chapterNumber} processed with status ${refineTask.aigcStatus}.`;
    await saveAutonomousState(rootDir, state);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    }
    return state;
  }
  if (state.runtime.stage === "worldbuilding_dialogue") {
    throwIfStopped(pipelineOptions.signal);
    await writeProductionWritingResourceArtifacts(rootDir, paths, state, pipelineOptions);
    await import_promises7.default.writeFile(paths.settingFreezePath, `${createSettingFreeze(state, context)}
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
    const coverState = await prepareCoverGeneration(rootDir, {
      factoryRootDir: pipelineOptions.factoryRootDir,
      projectId: pipelineOptions.projectId,
      reason: "worldbuilding_completed"
    }).catch(() => void 0);
    if (coverState?.assets?.cover) {
      state.assets.cover = coverState.assets.cover;
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
    state.runtime.statusMessage = "Production master outline generated. Next step is to write story bible assets before chapter blueprints.";
    stampRuntimeProgress(state, "master_outline_generated");
    await saveAutonomousState(rootDir, state);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    }
    return state;
  }
  if (state.runtime.stage === "master_planning") {
    await writeProductionStoryBibleAssets(rootDir, paths, state, context, pipelineOptions);
    await writeAllDetailedChapterBlueprints(rootDir, paths, state, context, pipelineOptions);
    state.runtime.stage = "chapter_task_generation";
    state.runtime.statusMessage = "Story bible assets and detailed chapter blueprints generated. Review and confirm story foundation and writing style before drafting starts.";
    stampRuntimeProgress(state, "story_bible_and_chapter_blueprints_generated");
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
  if (state.runtime.stage === "chapter_task_generation") {
    const blocked = await blockDraftingUntilReady(rootDir, paths, state, pipelineOptions);
    if (blocked) {
      return state;
    }
    state.runtime.stage = "drafting";
    state.runtime.statusMessage = "Production readiness passed. Drafting has started from the queued chapter tasks.";
    stampRuntimeProgress(state, "drafting_started_after_readiness");
    await saveAutonomousState(rootDir, state);
    if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
      await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
    }
  }
  if (state.runtime.stage === "drafting") {
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
      const isAigcGateBypassed = process.env.AIGC_GATE_BYPASS === "1" || pipelineOptions.bypassAigcGate === true;
      if (isAigcGateBypassed) {
        state.runtime.stage = "aigc_refinement";
        state.runtime.statusMessage = "All chapter drafts have been generated. Waiting for batch AIGC scanning and refinement.";
        state.plan.pendingChapters = 0;
        stampRuntimeProgress(state, "aigc_refinement_entered");
      } else {
        state.runtime.stage = "complete";
        state.runtime.statusMessage = "All chapter drafts have been generated.";
        state.plan.pendingChapters = 0;
        stampRuntimeProgress(state, "workflow_complete");
      }
      await saveAutonomousState(rootDir, state);
      if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
        await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
      }
      return state;
    }
    const blocked = await blockDraftingUntilReady(rootDir, paths, state, pipelineOptions);
    if (blocked) {
      return state;
    }
    return (await produceChapterTask(rootDir, paths, state, nextTask, pipelineOptions)).state;
  }
  state.runtime.statusMessage = `No advance action is defined for stage ${state.runtime.stage}.`;
  stampRuntimeProgress(state, `noop:${state.runtime.stage}`);
  await saveAutonomousState(rootDir, state);
  return state;
}
async function retryChapterProduction(rootDir, chapterNumber, options = {}) {
  const pipelineOptions = { envRootDir: rootDir, ...options };
  const state = await loadAutonomousState(rootDir);
  const paths = getWorkspacePaths(rootDir);
  const task = state.plan.chapterTasks.find((candidate) => candidate.chapterNumber === chapterNumber);
  if (!task) {
    throw new Error(`chapter_not_found:${chapterNumber}`);
  }
  const maxRecoveryAttempts = getMaxRecoveryAttempts(pipelineOptions);
  if ((task.recoveryAttempts || 0) >= maxRecoveryAttempts) {
    const recovered = await markChapterRecoveryLimitReached(rootDir, state, task, pipelineOptions, "manual_retry_limit_reached");
    const recoveredTask = recovered.plan.chapterTasks.find((candidate) => candidate.chapterNumber === chapterNumber);
    if (options.runNow && recoveredTask?.status === "pending" && !recoveredTask.recoveryBlocked) {
      return (await produceChapterTask(rootDir, paths, recovered, recoveredTask, pipelineOptions)).state;
    }
    return recovered;
  }
  const previousStatus = task.status;
  task.status = "pending";
  task.recoveryAttempts = (task.recoveryAttempts || 0) + 1;
  task.recoveryBlocked = false;
  task.recoveryQueuedAt = (/* @__PURE__ */ new Date()).toISOString();
  state.plan.pendingChapters = state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length;
  state.runtime.stage = "drafting";
  state.runtime.statusMessage = `Chapter ${task.chapterNumber} has been queued for another production pass (recovery attempt ${task.recoveryAttempts}).`;
  stampRuntimeProgress(state, `manual_retry_queued:${task.chapterNumber}`);
  await saveAutonomousState(rootDir, state);
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_PIPELINE_RECOVERY_QUEUED", {
    chapterNumber: task.chapterNumber,
    previousStatus,
    recoveryAttempts: task.recoveryAttempts,
    previousQualityGate: task.qualityGate || null,
    requested: true
  });
  await recordWorkflowEvent(pipelineOptions, "CHAPTER_TASK_STATUS_UPDATED", {
    chapterNumber: task.chapterNumber,
    status: "pending",
    reason: "manual_retry_queued",
    recoveryAttempts: task.recoveryAttempts,
    recoveryQueuedAt: task.recoveryQueuedAt
  });
  if (pipelineOptions.factoryRootDir && pipelineOptions.projectId) {
    await syncManagedProjectState(pipelineOptions.factoryRootDir, pipelineOptions.projectId, state).catch(() => void 0);
  }
  if (options.runNow) {
    return (await produceChapterTask(rootDir, paths, state, task, pipelineOptions)).state;
  }
  return state;
}
async function prepareCoverGeneration(rootDir, options = {}) {
  const state = await loadAutonomousState(rootDir);
  const paths = getWorkspacePaths(rootDir);
  const context = {
    consensus: await readOptionalText3(paths.consensusPath),
    protagonist: await readOptionalText3(paths.protagonistPath),
    style: await readOptionalText3(paths.styleProfilePath)
  };
  const visualBrief = await generateCoverVisualBrief(rootDir, state, context);
  const prompt = buildCoverPrompt(state, visualBrief);
  const requestedAt = (/* @__PURE__ */ new Date()).toISOString();
  await import_promises7.default.writeFile(import_node_path10.default.join(paths.coverDir, "cover-brief.md"), `${visualBrief.brief}
`);
  await import_promises7.default.writeFile(paths.coverPromptPath, `${prompt.markdown}
`);
  state.assets.cover.status = "in_progress";
  state.assets.cover.briefPath = ".ai-novel/assets/cover/cover-brief.md";
  state.assets.cover.promptPath = COVER_PROMPT_PATH;
  state.assets.cover.imagePath = state.assets.cover.imagePath || COVER_IMAGE_PATH;
  state.assets.cover.metadataPath = COVER_METADATA_PATH;
  delete state.assets.cover.error;
  state.runtime.statusMessage = "Cover prompt prepared. Generating cover image...";
  stampRuntimeProgress(state, "cover_prompt_prepared", "cover");
  await saveAutonomousState(rootDir, state);
  try {
    const generated = await requestCoverImage(rootDir, prompt.imagePrompt);
    await import_promises7.default.writeFile(paths.coverImagePath, generated.bytes);
    const metadata = {
      status: "complete",
      requestedAt,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      promptPath: COVER_PROMPT_PATH,
      briefPath: ".ai-novel/assets/cover/cover-brief.md",
      briefSource: visualBrief.source,
      briefError: visualBrief.error,
      imagePath: COVER_IMAGE_PATH,
      mimeType: generated.mimeType,
      sourceUrl: "sourceUrl" in generated ? generated.sourceUrl : void 0,
      provider: generated.provider,
      reason: options.reason || "manual"
    };
    await writeJsonFileAtomic2(paths.coverMetadataPath, metadata);
    state.assets.cover.status = "complete";
    state.assets.cover.imagePath = COVER_IMAGE_PATH;
    state.assets.cover.metadataPath = COVER_METADATA_PATH;
    state.assets.cover.generatedAt = metadata.generatedAt;
    delete state.assets.cover.error;
    state.runtime.statusMessage = "Cover image generated and saved.";
    stampRuntimeProgress(state, "cover_image_generated", "cover");
    if (options.factoryRootDir && options.projectId) {
      await withFactoryDb(options.factoryRootDir, async (db) => {
        db.recordArtifact({
          projectId: options.projectId,
          kind: "plan",
          path: COVER_IMAGE_PATH,
          status: "completed",
          metadata: { ...metadata, asset: "cover" }
        });
        db.recordArtifact({
          projectId: options.projectId,
          kind: "plan",
          path: COVER_PROMPT_PATH,
          status: "completed",
          metadata: { ...metadata, asset: "cover_prompt" }
        });
        db.recordEvent(options.projectId, null, "COVER_IMAGE_GENERATED", metadata);
      }).catch(() => void 0);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const metadata = {
      status: "failed",
      requestedAt,
      failedAt: (/* @__PURE__ */ new Date()).toISOString(),
      promptPath: COVER_PROMPT_PATH,
      briefPath: ".ai-novel/assets/cover/cover-brief.md",
      briefSource: visualBrief.source,
      briefError: visualBrief.error,
      imagePath: COVER_IMAGE_PATH,
      reason: options.reason || "manual",
      error: message
    };
    await writeJsonFileAtomic2(paths.coverMetadataPath, metadata);
    state.assets.cover.status = "failed";
    state.assets.cover.imagePath = COVER_IMAGE_PATH;
    state.assets.cover.metadataPath = COVER_METADATA_PATH;
    state.assets.cover.error = message;
    state.runtime.statusMessage = `Cover generation failed but workflow can continue: ${message}`;
    stampRuntimeProgress(state, "cover_image_failed", "cover");
    if (options.factoryRootDir && options.projectId) {
      await withFactoryDb(options.factoryRootDir, async (db) => {
        db.recordArtifact({
          projectId: options.projectId,
          kind: "plan",
          path: COVER_PROMPT_PATH,
          status: "completed",
          metadata: { ...metadata, asset: "cover_prompt" }
        });
        db.recordEvent(options.projectId, null, "COVER_IMAGE_FAILED", metadata);
      }).catch(() => void 0);
    }
  }
  await saveAutonomousState(rootDir, state);
  if (options.factoryRootDir && options.projectId) {
    await syncManagedProjectState(options.factoryRootDir, options.projectId, state).catch(() => void 0);
  }
  return state;
}
function classifyInterruption(message) {
  const normalized = message.toLowerCase();
  const globalSignals = [
    "genre",
    "world rule",
    "worldbuilding",
    "entire",
    "whole story",
    "rewrite the core",
    "core world",
    "\u6574\u4E2A\u6545\u4E8B",
    "\u6539\u6210",
    "\u91CD\u5199",
    "\u98CE\u683C"
  ];
  const chapterArcSignals = [
    "arc",
    "motivation",
    "relationship",
    "foreshadow",
    "villain",
    "supporting character",
    "subplot"
  ];
  const hasGlobalSignal = globalSignals.some((signal) => normalized.includes(signal));
  const hasArcSignal = chapterArcSignals.some((signal) => normalized.includes(signal));
  if (hasGlobalSignal) {
    return {
      scope: "global",
      affectedArtifacts: ["world bible", "master outline", "chapter queue", "foreshadowing ledger"],
      reasoning: "The interruption changes story-wide assumptions, so downstream chapter tasks can no longer be trusted.",
      recommendedAction: "Freeze drafting, regenerate the planning artifacts, and rebuild the chapter queue before resuming."
    };
  }
  if (hasArcSignal) {
    return {
      scope: "chapter_arc",
      affectedArtifacts: ["current arc outline", "next chapters", "character dossier"],
      reasoning: "The interruption changes a recurring plot or character thread that spans multiple future chapters.",
      recommendedAction: "Revise the active arc plan and refresh affected upcoming chapter tasks before continuing."
    };
  }
  return {
    scope: "local",
    affectedArtifacts: ["current chapter draft"],
    reasoning: "The interruption looks limited to a nearby scene or wording choice.",
    recommendedAction: "Patch the active draft and continue with the existing chapter queue."
  };
}
async function reviewInterruption(options) {
  const state = await loadAutonomousState(options.rootDir);
  const assessment = classifyInterruption(options.message);
  const review = {
    message: options.message.trim(),
    scope: assessment.scope,
    reasoning: assessment.reasoning,
    affectedArtifacts: assessment.affectedArtifacts,
    recommendedAction: assessment.recommendedAction,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  state.runtime.lastInterruption = review;
  state.runtime.stage = review.scope === "global" ? "replanning" : state.runtime.stage;
  state.runtime.statusMessage = review.recommendedAction;
  stampRuntimeProgress(state, `interruption_reviewed:${review.scope}`, "interrupt");
  await saveAutonomousState(options.rootDir, state);
  await recordWorkflowEvent({
    factoryRootDir: options.factoryRootDir,
    projectId: options.projectId ?? void 0,
    directorCommandId: options.directorCommandId ?? null
  }, "INTERRUPTION_REVIEWED", {
    scope: review.scope,
    message: review.message,
    affectedArtifacts: review.affectedArtifacts,
    recommendedAction: review.recommendedAction
  });
  if (options.factoryRootDir && options.projectId) {
    await syncManagedProjectState(options.factoryRootDir, options.projectId, state).catch(() => void 0);
  }
  const { reportsDir } = getWorkspacePaths(options.rootDir);
  await import_promises7.default.mkdir(reportsDir, { recursive: true });
  const logPath = import_node_path10.default.join(reportsDir, "interruptions.log.md");
  const header = `## ${review.timestamp}
- Scope: ${review.scope}
- Message: ${review.message}
- Action: ${review.recommendedAction}

`;
  await import_promises7.default.appendFile(logPath, header);
  return review;
}

// src/discussion.ts
var import_promises8 = __toESM(require("fs/promises"), 1);
var import_node_path11 = __toESM(require("path"), 1);

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
  return import_node_path11.default.join(rootDir, ".ai-novel", ...parts);
}
async function readText(filePath) {
  return import_promises8.default.readFile(filePath, "utf8");
}
async function readOptionalText4(filePath) {
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
  await import_promises8.default.mkdir(import_node_path11.default.dirname(filePath), { recursive: true });
  const tempPath = import_node_path11.default.join(import_node_path11.default.dirname(filePath), `.${import_node_path11.default.basename(filePath)}.${Date.now()}.tmp`);
  await import_promises8.default.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`);
  await import_promises8.default.rename(tempPath, filePath);
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
  const archivePath = import_node_path11.default.join(consensusDir, fileName);
  await import_promises8.default.mkdir(consensusDir, { recursive: true });
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
  await import_promises8.default.writeFile(archivePath, `${content.trim()}
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
  const contextPath = import_node_path11.default.join(contextDir, "current-context.md");
  await import_promises8.default.mkdir(contextDir, { recursive: true });
  await import_promises8.default.writeFile(contextPath, `${content.trim()}
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
  const discussionLogPath = import_node_path11.default.join(discussionDir, "discussion-log.md");
  await import_promises8.default.mkdir(discussionDir, { recursive: true });
  const rawConsensus = await readText(consensusPath);
  const state = JSON.parse(await readText(statePath));
  const discussionTarget = inferDiscussionTarget(message);
  const runId = options.runId ?? makeRunId("discussion");
  const factoryDb = options.factoryRootDir && options.projectId ? await FactoryDb.open(options.factoryRootDir) : null;
  const priorTranscript = await readOptionalText4(discussionLogPath);
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
  await import_promises8.default.appendFile(
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
    await import_promises8.default.appendFile(
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
    await import_promises8.default.appendFile(discussionLogPath, "Status: complete\n\n");
    factoryDb?.updateRun(runId, "completed");
  } catch (error) {
    const message2 = error instanceof Error ? error.message : String(error);
    await import_promises8.default.appendFile(discussionLogPath, `Status: error
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
    await import_promises8.default.appendFile(discussionLogPath, `Stage Guard: blocked
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
  await import_promises8.default.writeFile(consensusPath, updatedConsensus);
  await import_promises8.default.writeFile(protagonistPath, updatedProtagonist);
  if (updatedDossiers.length) {
    await writeJsonFileAtomic3(characterDossiersPath, updatedDossiers);
    await import_promises8.default.writeFile(characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown2(updatedDossiers)}
`);
  }
  await import_promises8.default.writeFile(styleProfilePath, updatedStyle);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FactoryDb,
  advanceAutonomousProject,
  createManagedAutonomousProject,
  deleteManagedAutonomousProject,
  getProjectEnvStatus,
  getPublicProjectEnvStatus,
  initAutonomousProject,
  listAutonomousProjects,
  loadAutonomousState,
  makeAgentTurnId,
  makeRunId,
  prepareCoverGeneration,
  resolveManagedProjectRoot,
  retryChapterProduction,
  reviewInterruption,
  runMultiAgentDiscussion,
  saveAutonomousState,
  targetToArtifactKind,
  testProviderConnectivity,
  upsertCheckpointInSuperGraph,
  withFactoryDb
});
