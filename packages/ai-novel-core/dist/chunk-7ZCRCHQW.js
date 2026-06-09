// src/factory-db.ts
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";

// src/chapter-consistency.ts
var GENERIC_NAMES = /* @__PURE__ */ new Set([
  "\u4E3B\u89D2",
  "\u4E3B\u4EBA\u516C",
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
  const wordCount = Number.isFinite(wordCountValue) ? wordCountValue : void 0;
  const targetWords = Number.isFinite(targetWordsValue) ? targetWordsValue : void 0;
  const minimumWords = targetWords ? Math.floor(targetWords * MIN_CHAPTER_PASS_RATIO) : void 0;
  if (qualityGate.status !== "passed") {
    return {
      status: "quarantined",
      reason: qualityGate.reason || "\u8D28\u91CF\u95E8\u7981\u672A\u901A\u8FC7\u3002",
      wordCount,
      targetWords,
      minimumWords
    };
  }
  const reason = qualityGate.reason || "";
  if (/主角一致性硬门槛失败|章节连续性检查失败|故事线漂移|主角.*漂移/u.test(reason)) {
    return {
      status: "quarantined",
      reason,
      wordCount,
      targetWords,
      minimumWords
    };
  }
  if (!wordCount || !targetWords || !minimumWords) {
    return {
      status: "quarantined",
      reason: "\u7F3A\u5C11\u786E\u5B9A\u6027\u5B57\u6570\u95E8\u7981\uFF0C\u4E0D\u80FD\u8BA1\u5165\u6B63\u5F0F\u5B8C\u6210\u3002",
      wordCount,
      targetWords,
      minimumWords
    };
  }
  if (wordCount < minimumWords) {
    return {
      status: "quarantined",
      reason: `\u6B63\u6587\u6709\u6548\u5B57\u6570 ${wordCount}/${targetWords}\uFF0C\u4F4E\u4E8E ${Math.round(MIN_CHAPTER_PASS_RATIO * 100)}% \u95E8\u69DB\u3002`,
      wordCount,
      targetWords,
      minimumWords
    };
  }
  return {
    status: "eligible",
    reason: "\u786E\u5B9A\u6027\u5B57\u6570\u95E8\u7981\u901A\u8FC7\u3002",
    wordCount,
    targetWords,
    minimumWords
  };
}
function isWritingEventActive(payload, now = /* @__PURE__ */ new Date()) {
  const status = String(payload.status || "");
  const step = String(payload.step || "");
  const eventAt = typeof payload.createdAt === "string" ? Date.parse(payload.createdAt) : Number.NaN;
  const eventAgeMs = Number.isFinite(eventAt) ? now.getTime() - eventAt : 0;
  const maxActiveMs = 10 * 60 * 1e3;
  if (eventAgeMs > maxActiveMs) return false;
  if (/_completed$|_failed$|saved$|artifacts_saved|quality_gate_completed|polish_completed|memory_update_completed/.test(step)) {
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
    return fsSync.readFileSync(filePath, "utf8");
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
  return path.join(rootDir, FACTORY_DB_DIR, FACTORY_DB_FILE);
}
var FactoryDb = class _FactoryDb {
  constructor(db) {
    this.db = db;
  }
  db;
  static async open(rootDir) {
    const dbPath = getFactoryDbPath(rootDir);
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
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
    const now = nowIso();
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
      now
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
    const now = nowIso();
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
      now,
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
    const now = nowIso();
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
      now,
      now
    );
    this.recordEvent(input.projectId, input.id, "WORKFLOW_RUN_STARTED", input);
  }
  updateRun(runId, status, patch = {}) {
    const now = nowIso();
    this.db.prepare(`
      UPDATE workflow_runs
      SET status = ?, stage = COALESCE(?, stage), error = COALESCE(?, error),
          updated_at = ?, completed_at = CASE WHEN ? IN ('blocked', 'failed', 'completed') THEN ? ELSE completed_at END
      WHERE id = ?
    `).run(status, patch.stage ?? null, patch.error ?? null, now, status, now, runId);
    const run = this.db.prepare("SELECT project_id FROM workflow_runs WHERE id = ?").get(runId);
    this.recordEvent(typeof run?.project_id === "string" ? run.project_id : null, runId, "WORKFLOW_RUN_UPDATED", {
      status,
      error: patch.error ?? null,
      stage: patch.stage ?? null
    });
  }
  recoverStaleRuns(options = {}) {
    const now = nowIso();
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
    `).all(olderThan, olderThan, now);
    for (const row of rows) {
      this.db.prepare(`
        UPDATE workflow_runs
        SET status = 'failed', error = ?, updated_at = ?, completed_at = ?
        WHERE id = ?
      `).run(error, now, now, String(row.id));
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
    const now = nowIso();
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
      now,
      now,
      input.status === "completed" || input.status === "failed" ? now : null
    );
    this.db.prepare(`
      UPDATE workflow_runs
      SET updated_at = ?
      WHERE id = ?
    `).run(now, input.runId);
    const run = this.db.prepare("SELECT project_id FROM workflow_runs WHERE id = ?").get(input.runId);
    this.recordEvent(typeof run?.project_id === "string" ? run.project_id : null, input.runId, "AGENT_TURN_UPDATED", {
      turnId: input.turnId,
      role: input.role,
      status: input.status,
      discussionStage: input.stage
    });
  }
  recordArtifact(input) {
    const now = nowIso();
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
      now,
      now
    );
    this.recordEvent(input.projectId, null, "ARTIFACT_RECORDED", {
      kind: input.kind,
      path: input.path,
      version,
      status: input.status ?? "completed"
    });
  }
  recordMemory(projectId, input) {
    const now = nowIso();
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
          now,
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
      now,
      now
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
    const now = nowIso();
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
      now,
      now
    );
    if (input.ownerKind === "memory") {
      this.db.prepare(`
        UPDATE memory_items
        SET embedding_status = 'ready', embedding_id = ?, updated_at = ?
        WHERE id = ? AND project_id = ?
      `).run(id, now, input.ownerId, projectId);
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
    const now = nowIso();
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
      now,
      now
    );
    if (changed) {
      this.db.prepare(`
        UPDATE knowledge_chunks
        SET status = 'superseded', embedding_status = 'superseded', updated_at = ?
        WHERE source_id = ?
      `).run(now, id);
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
    const now = nowIso();
    this.db.prepare(`
      UPDATE knowledge_chunks
      SET status = 'superseded', embedding_status = CASE WHEN embedding_status = 'ready' THEN 'superseded' ELSE embedding_status END, updated_at = ?
      WHERE source_id = ?
    `).run(now, sourceId);
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
        now,
        now
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
    const now = nowIso();
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
    `).run(id, chunkId, model, vector.length, jsonString(vector), now, now);
    this.db.prepare(`
      UPDATE knowledge_chunks
      SET embedding_status = 'ready', updated_at = ?
      WHERE id = ?
    `).run(now, chunkId);
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
    const now = nowIso();
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
      now
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
    const now = nowIso();
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
      now
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
    const now = nowIso();
    const updatedAt = message.updatedAt || now;
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
    const now = nowIso();
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
        interruptedAt: now,
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
        now,
        now,
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
    const now = nowIso();
    const id = makeId("job");
    this.db.prepare(`
      INSERT INTO jobs (id, project_id, run_id, kind, status, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.projectId, input.runId ?? null, input.kind, input.status, jsonString(input.payload ?? {}), now, now);
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
  listRunnableJobs(kind, now = /* @__PURE__ */ new Date(), options = {}) {
    const nowValue = now.toISOString();
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
  claimJob(jobId, owner, leaseSeconds = 60, now = /* @__PURE__ */ new Date(), options = {}) {
    const nowValue = now.toISOString();
    const leaseExpiresAt = addSeconds(now, leaseSeconds).toISOString();
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
  heartbeatJob(jobId, owner, leaseSeconds = 60, now = /* @__PURE__ */ new Date()) {
    const leaseExpiresAt = addSeconds(now, leaseSeconds).toISOString();
    this.db.prepare(`
      UPDATE jobs
      SET lease_expires_at = ?, updated_at = ?
      WHERE id = ? AND lease_owner = ? AND status = 'running'
    `).run(leaseExpiresAt, now.toISOString(), jobId, owner);
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
  getChapterFacts(projectId, now = /* @__PURE__ */ new Date()) {
    const facts = /* @__PURE__ */ new Map();
    const projectRow = this.db.prepare("SELECT chapter_word_target, project_root FROM projects WHERE id = ?").get(projectId);
    const projectTargetWords = Number(projectRow?.chapter_word_target);
    const targetWordsForQuality = Number.isFinite(projectTargetWords) ? projectTargetWords : void 0;
    const projectRoot = typeof projectRow?.project_root === "string" ? projectRow.project_root : "";
    const protagonistProfile = projectRoot ? readTextFileSync(path.join(projectRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md")) : "";
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
        const finalText = readTextFileSync(path.isAbsolute(fact.finalPath) ? fact.finalPath : path.join(projectRoot, fact.finalPath));
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
      }, now) && fact.qualityGate?.status !== "blocked") {
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
  getOperationalStatus(now = /* @__PURE__ */ new Date()) {
    const nowValue = now.toISOString();
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
    const now = nowIso();
    const temp = config.temperature ?? 0.1;
    const timeout = config.timeoutMs ?? 12e4;
    this.db.prepare(`
      INSERT INTO llm_configs (id, name, base_url, api_key, model_name, temperature, timeout_ms, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, config.name, config.baseUrl, config.apiKey, config.modelName, temp, timeout, now, now);
  }
  updateLlmConfig(id, config) {
    const now = nowIso();
    const temp = config.temperature ?? 0.1;
    const timeout = config.timeoutMs ?? 12e4;
    this.db.prepare(`
      UPDATE llm_configs
      SET name = ?, base_url = ?, api_key = ?, model_name = ?, temperature = ?, timeout_ms = ?, updated_at = ?
      WHERE id = ?
    `).run(config.name, config.baseUrl, config.apiKey, config.modelName, temp, timeout, now, id);
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

export {
  extractChinesePersonNames,
  inferLockedProtagonistName,
  evaluateChapterConsistency,
  getFactoryDbPath,
  FactoryDb,
  withFactoryDb,
  makeRunId,
  makeAgentTurnId,
  targetToArtifactKind,
  createLocalTextEmbedding,
  backfillPendingMemoryEmbeddings
};
