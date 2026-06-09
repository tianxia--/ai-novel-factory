import {
  createLocalTextEmbedding,
  withFactoryDb
} from "./chunk-7ZCRCHQW.js";

// src/knowledge.ts
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
var LOCAL_KNOWLEDGE_EMBEDDING_MODEL = "local-hash-v1";
var DEFAULT_CHUNK_CHAR_LIMIT = 1400;
var DEFAULT_GLOBAL_RESOURCE_LIMIT = process.env.AI_NOVEL_TEST_MODE === "1" ? 12 : 5e3;
var DEFAULT_ARTIFACT_CHUNK_LIMIT = process.env.AI_NOVEL_TEST_MODE === "1" ? 40 : 500;
function currentBundleDir() {
  const stack = new Error().stack || "";
  for (const line of stack.split("\n")) {
    const fileUrlMatch = line.match(/\(?file:\/\/([^):]+):\d+:\d+\)?/);
    if (fileUrlMatch) {
      return path.dirname(decodeURIComponent(fileUrlMatch[1]));
    }
    const fileMatch = line.match(/\((\/[^():]+):\d+:\d+\)/) || line.match(/at (\/[^():]+):\d+:\d+/);
    if (fileMatch) {
      return path.dirname(fileMatch[1]);
    }
  }
  return process.cwd();
}
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}
function chapterNumberFromKnowledgePath(value) {
  const match = String(value || "").match(/chapter-(\d+)/u);
  return match ? Number(match[1]) : null;
}
function timestampMs(value) {
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
      title: options.title || path.basename(options.path),
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
    path.join(rootDir, "packages", "ai-novel-core", "resources", "writing"),
    path.resolve(bundleDir, "..", "resources", "writing"),
    path.join(process.cwd(), "packages", "ai-novel-core", "resources", "writing")
  ];
  let resourceRoot = "";
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
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
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
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
    const content = await fs.readFile(filePath, "utf8");
    const relativePath = normalizeRelativePath(path.join("packages", "ai-novel-core", "resources", "writing", path.relative(resourceRoot, filePath)));
    const result = await ingestKnowledgeSource({
      rootDir,
      scope: "global",
      sourceType: sourceTypeForPath(relativePath),
      path: relativePath,
      title: path.basename(filePath),
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
  const absolutePath = path.isAbsolute(options.artifactPath) ? options.artifactPath : path.join(options.projectRoot, options.artifactPath);
  const content = options.content ?? await fs.readFile(absolutePath, "utf8");
  return ingestKnowledgeSource({
    rootDir: options.rootDir,
    scope: "project",
    projectId: options.projectId,
    sourceType: sourceTypeForPath(options.artifactPath) || options.kind,
    path: normalizeRelativePath(options.artifactPath),
    title: path.basename(options.artifactPath),
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
      return timestampMs(rowUpdatedAt) > timestampMs(resetFact.resetAt);
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
    const title = String(source.title || row.source_title || path.basename(pathValue) || "knowledge");
    return [
      `${index + 1}. [${String(row.chunk_type || "chunk")}] ${title}`,
      `Source: ${pathValue}`,
      `Score: ${Number(row.score || 0).toFixed(2)}`,
      String(row.content || "").slice(0, 520)
    ].join("\n");
  }).join("\n\n");
}
function evaluateKnowledgeRetrieval(rows, expectedChunkIds, k = rows.length) {
  const normalizedK = Math.max(1, Number.isFinite(Number(k)) ? Math.floor(Number(k)) : rows.length || 1);
  const expected = [...new Set(expectedChunkIds.map((id) => String(id)).filter(Boolean))];
  const returned = rows.slice(0, normalizedK).map((row) => String(row.id || "")).filter(Boolean);
  const returnedSet = new Set(returned);
  const expectedSet = new Set(expected);
  const matched = expected.filter((id) => returnedSet.has(id));
  const missed = expected.filter((id) => !returnedSet.has(id));
  const unexpected = returned.filter((id) => !expectedSet.has(id));
  const expectedCount = expected.length;
  const returnedCount = returned.length;
  return {
    k: normalizedK,
    expectedChunkIds: expected,
    returnedChunkIds: returned,
    matchedChunkIds: matched,
    missedChunkIds: missed,
    unexpectedChunkIds: unexpected,
    hitAtK: matched.length > 0 ? 1 : 0,
    recallAtK: expectedCount ? matched.length / expectedCount : 1,
    precisionAtK: returnedCount ? matched.length / returnedCount : expectedCount ? 0 : 1
  };
}
async function evaluateKnowledgeBenchmark(rootDir, cases) {
  const caseResults = [];
  for (const item of cases) {
    const k = Math.max(1, Math.floor(Number(item.k || 8)));
    const rows = await retrieveKnowledge({
      rootDir,
      projectId: item.projectId ?? null,
      query: item.query,
      scopes: item.scopes,
      sourceTypes: item.sourceTypes,
      chunkTypes: item.chunkTypes,
      limit: k,
      recordCitation: false
    });
    caseResults.push({
      name: item.name,
      query: item.query,
      ...evaluateKnowledgeRetrieval(rows, item.expectedChunkIds, k)
    });
  }
  const totalCases = caseResults.length;
  const sum = (field) => caseResults.reduce((total, item) => total + item[field], 0);
  return {
    cases: caseResults,
    summary: {
      totalCases,
      hitRateAtK: totalCases ? sum("hitAtK") / totalCases : 0,
      meanRecallAtK: totalCases ? sum("recallAtK") / totalCases : 0,
      meanPrecisionAtK: totalCases ? sum("precisionAtK") / totalCases : 0
    }
  };
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

export {
  chunkKnowledgeContent,
  ingestKnowledgeSource,
  ingestGlobalWritingResources,
  ingestProjectArtifact,
  retrieveKnowledge,
  formatKnowledgeForPrompt,
  evaluateKnowledgeRetrieval,
  evaluateKnowledgeBenchmark,
  backfillPendingKnowledgeEmbeddings
};
