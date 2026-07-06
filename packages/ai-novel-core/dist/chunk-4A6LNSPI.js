import {
  withFactoryDb
} from "./chunk-JD3MNOTZ.js";

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
  createLocalTextEmbedding,
  backfillPendingMemoryEmbeddings
};
