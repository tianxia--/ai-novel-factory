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

// src/aigc-detector.ts
var aigc_detector_exports = {};
__export(aigc_detector_exports, {
  createAigcDetectorClient: () => createAigcDetectorClient,
  detectAigcSegments: () => detectAigcSegments,
  detectAigcText: () => detectAigcText,
  getAigcDetectorConfig: () => getAigcDetectorConfig,
  getAigcDetectorConfigFromEnv: () => getAigcDetectorConfigFromEnv,
  parseAigcDetectorSse: () => parseAigcDetectorSse,
  splitAigcTextIntoSegments: () => splitAigcTextIntoSegments
});
module.exports = __toCommonJS(aigc_detector_exports);
var import_node_fs = __toESM(require("fs"), 1);
var import_node_path = __toESM(require("path"), 1);
var DEFAULT_TIMEOUT_MS = 3e4;
var DEFAULT_THRESHOLD = 0.8;
var DEFAULT_SEGMENT_MAX_CHARS = 900;
var DEFAULT_SEGMENT_MIN_CHARS = 180;
var PACKAGE_ENV_PARTS = ["packages", "opencode-ai-novel-factory", ".env"];
var MANAGED_PROJECTS_SEGMENT = `${import_node_path.default.sep}.ai-novel-projects${import_node_path.default.sep}`;
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
    const projectEnv = readAigcProjectEnv(rootDir);
    return getAigcDetectorConfigFromEnv({ ...projectEnv, ...process.env });
  } catch {
    return getAigcDetectorConfigFromEnv();
  }
}
function createAigcDetectorClient(config = getAigcDetectorConfigFromEnv()) {
  return {
    config,
    detectText(input, override) {
      return detectAigcText(input, mergeAigcDetectorConfig(config, override));
    },
    detectSegments(input, override) {
      return detectAigcSegments(input, mergeAigcDetectorConfig(config, override));
    },
    splitText(text, options) {
      return splitAigcTextIntoSegments(text, options ?? config.segment);
    }
  };
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
    reason: highRiskSegments.length > 0 ? `${highRiskSegments.length} segment(s) reached the AIGC risk threshold.` : "Segmented AIGC detection completed."
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
function mergeAigcDetectorConfig(base, override = {}) {
  return {
    ...base,
    ...override,
    headers: { ...base.headers, ...override.headers },
    segment: { ...base.segment, ...override.segment },
    gradio: { ...base.gradio, ...override.gradio }
  };
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
  const completed = parsedEvents.findLast(
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
  if (value === "generic-json" || value === "gradio-queue" || value === "disabled") {
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
function readAigcProjectEnv(rootDir) {
  const envPath = getAigcProjectEnvCandidatePaths(rootDir).find((candidate) => import_node_fs.default.existsSync(candidate));
  if (!envPath) {
    return {};
  }
  const values = {};
  for (const line of import_node_fs.default.readFileSync(envPath, "utf8").split("\n")) {
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
function getAigcProjectEnvCandidatePaths(rootDir) {
  const resolvedRootDir = import_node_path.default.resolve(rootDir);
  const candidates = [
    import_node_path.default.join(resolvedRootDir, ".env"),
    import_node_path.default.join(resolvedRootDir, ...PACKAGE_ENV_PARTS)
  ];
  const workspaceRoot = inferAigcWorkspaceRootFromManagedProject(resolvedRootDir);
  if (workspaceRoot) {
    candidates.push(
      import_node_path.default.join(workspaceRoot, ".env"),
      import_node_path.default.join(workspaceRoot, ...PACKAGE_ENV_PARTS)
    );
  }
  return [...new Set(candidates.map((candidate) => import_node_path.default.resolve(candidate)))];
}
function inferAigcWorkspaceRootFromManagedProject(rootDir) {
  const index = rootDir.indexOf(MANAGED_PROJECTS_SEGMENT);
  if (index < 0) {
    return null;
  }
  return rootDir.slice(0, index) || import_node_path.default.parse(rootDir).root;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createAigcDetectorClient,
  detectAigcSegments,
  detectAigcText,
  getAigcDetectorConfig,
  getAigcDetectorConfigFromEnv,
  parseAigcDetectorSse,
  splitAigcTextIntoSegments
});
