import {
  evaluateProductionReadiness,
  evaluateStyleEvolutionGate,
  generateAgentReply,
  loadLlmConfigForCapability,
  loadProductionWritingResources,
  loadStyleEvolution,
  normalizeAigcWritingDetectionReport,
  repairAigcHighRiskDraft,
  requestLlmTextCompletion,
  runChapterProductionPipeline,
  throwIfStopped,
  writeAllDetailedChapterBlueprints,
  writeProductionMasterOutline,
  writeProductionStoryBibleAssets,
  writeProductionWritingResourceArtifacts
} from "./chunk-BF7UOCI6.js";
import {
  detectAigcSegments,
  getAigcDetectorConfig
} from "./chunk-VL6XPQ5B.js";
import {
  retrieveKnowledge
} from "./chunk-E4OGC67J.js";
import {
  createLocalTextEmbedding
} from "./chunk-4A6LNSPI.js";
import {
  FactoryDb,
  makeAgentTurnId,
  makeRunId,
  targetToArtifactKind,
  withFactoryDb
} from "./chunk-JD3MNOTZ.js";
import {
  createAgentMessage
} from "./chunk-GZKJNHMN.js";

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
  const candidates = getProjectEnvCandidatePaths(rootDir);
  const existingPaths = candidates.filter((envPath) => fs.existsSync(envPath));
  if (existingPaths.length > 0) {
    const values = existingPaths.slice().reverse().reduce((merged, envPath) => {
      const raw = fs.readFileSync(envPath, "utf8");
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
function resolveProjectEnvWritePath(rootDir = process.cwd()) {
  for (const envPath of getProjectEnvCandidatePaths(rootDir)) {
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }
  return getProjectEnvPath(rootDir);
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

// src/super-graph.ts
import fs2 from "fs/promises";
import path2 from "path";
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
function readJson(value, fallback) {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function workspacePath(rootDir, ...parts) {
  return path2.join(rootDir, WORKSPACE_DIR, ...parts);
}
function graphPaths(rootDir) {
  const graphDir = workspacePath(rootDir, "graph");
  return {
    graphDir,
    graphPath: path2.join(graphDir, "super-graph.json"),
    indexPath: path2.join(graphDir, "index.json"),
    violationsPath: path2.join(graphDir, "violations.json")
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
  const raw = await fs2.readFile(graphPath, "utf8");
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
      properties: readJson(row.metadata_json, {}),
      createdAt: String(row.updated_at || now()),
      updatedAt: String(row.updated_at || now())
    })),
    edges: edges.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      from: String(row.from_node_id),
      to: String(row.to_node_id),
      properties: readJson(row.metadata_json, {}),
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
  await fs2.mkdir(paths.graphDir, { recursive: true });
  graph.generatedAt = now();
  await fs2.writeFile(paths.graphPath, `${JSON.stringify(graph, null, 2)}
`);
  await fs2.writeFile(paths.indexPath, `${JSON.stringify(buildSuperGraphIndex(graph), null, 2)}
`);
  await fs2.writeFile(paths.violationsPath, `${JSON.stringify(validateSuperGraph(graph), null, 2)}
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
  const checkpointId = `checkpoint:${path2.basename(checkpoint.path).replace(/\.json$/i, "")}`;
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

// src/context-packet.ts
import fs3 from "fs/promises";
import path3 from "path";
function compactList(values = [], limit = 2) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit).join("; ") || "pending";
}
function clipText(value = "", maxLength = 100) {
  const normalized = value.trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}
function summarizeCharacterDossiers(state, limit = 3) {
  const dossiers = state.memory?.characterDossiers || [];
  const selected = [
    ...dossiers.filter((dossier) => dossier.role === "protagonist"),
    ...dossiers.filter((dossier) => dossier.role !== "protagonist")
  ].slice(0, limit);
  return selected.length ? selected.map((dossier) => `- ${dossier.id} (${dossier.role}) name=${dossier.canonicalName}; desire=${clipText(dossier.coreDesire)}; habit=${compactList(dossier.behaviorHabits)}; delta=${clipText(dossier.currentChapterDelta)}`) : ["- No structured character dossiers have been recorded yet."];
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
    ...summarizeCharacterDossiers(state)
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
    ...summarizeCharacterDossiers(state),
    "",
    "Memory/RAG recall:",
    "- No database memory recall matched this turn yet."
  ].join("\n");
}
async function syncCurrentContextPacketFile(projectRoot, state) {
  const contextPath = path3.join(projectRoot, ".ai-novel", "context", "current-context.md");
  const current = await fs3.readFile(contextPath, "utf8").catch(() => "");
  if (!current) {
    await fs3.mkdir(path3.dirname(contextPath), { recursive: true });
    await fs3.writeFile(contextPath, `${createCurrentContextPacketText(state)}
`);
    return;
  }
  const next = syncContextPacketStateText(current, state);
  if (next === current) {
    return;
  }
  await fs3.writeFile(contextPath, next.endsWith("\n") ? next : `${next}
`);
}

// src/orchestrator.ts
import fs4 from "fs/promises";
import { randomUUID } from "crypto";
import path4 from "path";
import { createHash } from "crypto";
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
  const projectsRoot = path4.join(rootDir, PROJECTS_DIR);
  return {
    projectsRoot,
    registryPath: path4.join(projectsRoot, PROJECTS_REGISTRY_FILE)
  };
}
async function readProjectRegistry(rootDir) {
  const { registryPath } = getProjectsPaths(rootDir);
  try {
    const raw = await fs4.readFile(registryPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function writeProjectRegistry(rootDir, projects) {
  const { projectsRoot, registryPath } = getProjectsPaths(rootDir);
  await fs4.mkdir(projectsRoot, { recursive: true });
  await fs4.writeFile(registryPath, `${JSON.stringify(projects, null, 2)}
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
  return path4.join(rootDir, PROJECTS_DIR, projectId);
}
function resolveStoredProjectRoot(rootDir, projectRoot, projectId) {
  if (path4.isAbsolute(projectRoot)) {
    return projectRoot;
  }
  const rootRelative = path4.resolve(rootDir, projectRoot);
  const managedRoot = resolveProjectRoot(rootDir, projectId);
  if (path4.normalize(projectRoot).includes(`${PROJECTS_DIR}${path4.sep}`)) {
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
  const workspaceDir = path4.join(rootDir, WORKSPACE_DIR2);
  return {
    workspaceDir,
    statePath: path4.join(workspaceDir, "state.json"),
    promptsDir: path4.join(workspaceDir, "prompts"),
    agentPromptsDir: path4.join(workspaceDir, "prompts", "agents"),
    consensusPath: path4.join(workspaceDir, "prompts", "global-consensus.md"),
    plansDir: path4.join(workspaceDir, "plans"),
    reportsDir: path4.join(workspaceDir, "reports"),
    styleDir: path4.join(workspaceDir, "style"),
    styleProfilePath: path4.join(workspaceDir, "style", "profile.md"),
    styleRulebookPath: path4.join(workspaceDir, "style", "rulebook.md"),
    styleReferencesPath: path4.join(workspaceDir, "style", "references.md"),
    styleAntiPatternsPath: path4.join(workspaceDir, "style", "anti-patterns.md"),
    chaptersDir: path4.join(workspaceDir, "chapters"),
    assetsDir: path4.join(workspaceDir, "assets"),
    coverDir: path4.join(workspaceDir, "assets", "cover"),
    comicDir: path4.join(workspaceDir, "assets", "comic"),
    memoryDir: path4.join(workspaceDir, "memory"),
    charactersDir: path4.join(workspaceDir, "memory", "characters"),
    characterCoreDir: path4.join(workspaceDir, "memory", "characters", "core"),
    characterDossiersPath: path4.join(workspaceDir, "memory", "characters", "dossiers.json"),
    characterDossiersMarkdownPath: path4.join(workspaceDir, "memory", "characters", "dossiers.md"),
    protagonistPath: path4.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
    relationsPath: path4.join(workspaceDir, "memory", "characters", "relations.md"),
    characterEvolutionPath: path4.join(workspaceDir, "memory", "characters", "evolution.md"),
    configPath: path4.join(workspaceDir, "config.json"),
    settingFreezePath: path4.join(workspaceDir, "plans", "setting-freeze.md"),
    masterOutlinePath: path4.join(workspaceDir, "plans", "master-outline.md"),
    chapterBlueprintsDir: path4.join(workspaceDir, "plans", "chapter-blueprints"),
    coverPromptPath: path4.join(workspaceDir, "assets", "cover", "cover-prompt.md"),
    coverImagePath: path4.join(workspaceDir, "assets", "cover", "cover.png"),
    coverMetadataPath: path4.join(workspaceDir, "assets", "cover", "cover-metadata.json")
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
  await fs4.mkdir(paths.promptsDir, { recursive: true });
  await fs4.mkdir(paths.agentPromptsDir, { recursive: true });
  await fs4.mkdir(paths.plansDir, { recursive: true });
  await fs4.mkdir(paths.reportsDir, { recursive: true });
  await fs4.mkdir(paths.styleDir, { recursive: true });
  await fs4.mkdir(paths.chaptersDir, { recursive: true });
  await fs4.mkdir(paths.coverDir, { recursive: true });
  await fs4.mkdir(paths.comicDir, { recursive: true });
  await fs4.mkdir(paths.characterCoreDir, { recursive: true });
  await writeJsonFileAtomic(paths.statePath, state);
  await writeJsonFileAtomic(paths.configPath, llmConfig);
  await writeJsonFileAtomic(paths.characterDossiersPath, characterDossiers);
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
  await fs4.writeFile(path4.join(paths.promptsDir, "react-worldbuilding.md"), `${reactPrompt}
`);
  await fs4.writeFile(path4.join(paths.plansDir, "plan-and-solve-brief.md"), `${planBrief}
`);
  await fs4.writeFile(paths.consensusPath, `${globalConsensus}
`);
  await fs4.writeFile(paths.styleProfilePath, `${styleProfile}
`);
  await fs4.writeFile(paths.styleRulebookPath, `${styleRulebook}
`);
  await fs4.writeFile(paths.styleReferencesPath, `${styleReferences}
`);
  await fs4.writeFile(paths.styleAntiPatternsPath, `${styleAntiPatterns}
`);
  await fs4.writeFile(paths.characterDossiersMarkdownPath, `${formatCharacterDossierSummary(characterDossiers)}
`);
  await fs4.writeFile(paths.protagonistPath, `${protagonistSeed}
`);
  await fs4.writeFile(paths.relationsPath, `${relations}
`);
  await fs4.writeFile(paths.characterEvolutionPath, `${evolution}
`);
  await fs4.writeFile(path4.join(paths.coverDir, "cover-brief.md"), `${coverBrief}
`);
  await fs4.writeFile(path4.join(paths.comicDir, "comic-plan.md"), `${comicPlan}
`);
  await Promise.all(
    AGENT_ROLES.flatMap((role) => {
      const base = path4.join(paths.agentPromptsDir, `${role}.base.md`);
      const dynamic = path4.join(paths.agentPromptsDir, `${role}.dynamic.md`);
      return [
        fs4.writeFile(base, `${basePrompts.get(role) ?? ""}
`),
        fs4.writeFile(dynamic, `${dynamicPrompts.get(role) ?? ""}
`)
      ];
    })
  );
}
async function readOptionalText(filePath) {
  try {
    return (await fs4.readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}
async function readOptionalJson(filePath) {
  try {
    const raw = await fs4.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function fileHasContent(filePath) {
  return Boolean((await readOptionalText(filePath)).trim());
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
    const entries = await fs4.readdir(dirPath, { withFileTypes: true });
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
    const assetPath = path4.join(paths.plansDir, asset);
    const present = await fileHasContent(assetPath);
    const issue = present && asset.endsWith(".json") ? planningAssetStructuralIssue(asset, await readOptionalJson(assetPath), totalChapters) : "";
    return {
      key: asset.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
      label: asset,
      path: `.ai-novel/plans/${asset}`,
      status: present && !issue ? "passed" : "blocked",
      detail: present ? issue || "\u5DF2\u751F\u6210" : "\u7F3A\u5931"
    };
  }));
  const presentPlanningAssets = planningAssetDetails.filter((asset) => asset.status === "passed").map((asset) => asset.label);
  const storyFoundationApproval = await readOptionalJson(path4.join(paths.plansDir, STORY_FOUNDATION_APPROVAL_FILE));
  const storyFoundationApproved = Boolean(storyFoundationApproval?.approved === true && String(storyFoundationApproval.approvedAt || "").trim());
  const storyFoundationApprovalFingerprint = typeof storyFoundationApproval?.assetFingerprint === "string" ? String(storyFoundationApproval.assetFingerprint) : "";
  const styleEvolution = await loadStyleEvolution(rootDir).catch(() => null);
  const hasCharacterDynamicsAsset = await fileHasContent(path4.join(paths.plansDir, "character-dynamics.json"));
  const hasDossiers = await fileHasContent(paths.characterDossiersPath) || hasCharacterDynamicsAsset;
  const hasRelationships = await fileHasContent(path4.join(paths.charactersDir, "relationships.json")) || hasCharacterDynamicsAsset;
  const blueprintCount = await countMarkdownFiles(paths.chapterBlueprintsDir);
  const consensus = await readOptionalText(paths.consensusPath);
  const storyFoundationContract = await readOptionalJson(path4.join(paths.plansDir, "story-foundation-contract.json"));
  const worldMatrix = await readOptionalJson(path4.join(paths.plansDir, "world-matrix.json"));
  const plotArchitecture = await readOptionalJson(path4.join(paths.plansDir, "plot-architecture.json"));
  const storyBible = await readOptionalJson(path4.join(paths.plansDir, "story-bible.json"));
  const volumeStrategy = await readOptionalJson(path4.join(paths.plansDir, "volume-strategy.json"));
  const foreshadowingLedger = await readOptionalJson(path4.join(paths.plansDir, "foreshadowing-ledger.json"));
  const characterDynamics = await readOptionalJson(path4.join(paths.plansDir, "character-dynamics.json"));
  const writingPlan = await readOptionalJson(path4.join(paths.plansDir, "writing-plan.json"));
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
async function writeJsonFileAtomic(filePath, value) {
  const data = `${JSON.stringify(value, null, 2)}
`;
  await fs4.mkdir(path4.dirname(filePath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tempPath = path4.join(path4.dirname(filePath), `.${path4.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
    try {
      const handle = await fs4.open(tempPath, "wx");
      try {
        await handle.writeFile(data, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs4.rename(tempPath, filePath);
      return;
    } catch (error) {
      await fs4.unlink(tempPath).catch(() => void 0);
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
  await fs4.mkdir(paths.workspaceDir, { recursive: true });
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
  const expectedProjectRoot = path4.resolve(resolveProjectRoot(rootDir, project.id));
  if (path4.resolve(projectRoot) !== expectedProjectRoot) {
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
  await fs4.rm(projectRoot, { recursive: true, force: true });
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
  const raw = await fs4.readFile(statePath, "utf8");
  return JSON.parse(raw);
}
async function saveAutonomousState(rootDir, state) {
  const { statePath } = getWorkspacePaths(rootDir);
  state.runtime.lastUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
  await writeJsonFileAtomic(statePath, state);
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
    const finalPath = path4.join(paths.chaptersDir, `${chapterId}.final.md`);
    try {
      await fs4.access(finalPath);
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
    consensus: await readOptionalText(paths.consensusPath),
    protagonist: await readOptionalText(paths.protagonistPath),
    style: await readOptionalText(paths.styleProfilePath)
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
    const finalPath = path4.join(paths.chaptersDir, `${chapterId}.final.md`);
    let finalDraft = "";
    try {
      finalDraft = await fs4.readFile(finalPath, "utf8");
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
        await fs4.writeFile(finalPath, `${refinedDraft}
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
    await fs4.writeFile(paths.settingFreezePath, `${createSettingFreeze(state, context)}
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
    consensus: await readOptionalText(paths.consensusPath),
    protagonist: await readOptionalText(paths.protagonistPath),
    style: await readOptionalText(paths.styleProfilePath)
  };
  const visualBrief = await generateCoverVisualBrief(rootDir, state, context);
  const prompt = buildCoverPrompt(state, visualBrief);
  const requestedAt = (/* @__PURE__ */ new Date()).toISOString();
  await fs4.writeFile(path4.join(paths.coverDir, "cover-brief.md"), `${visualBrief.brief}
`);
  await fs4.writeFile(paths.coverPromptPath, `${prompt.markdown}
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
    await fs4.writeFile(paths.coverImagePath, generated.bytes);
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
    await writeJsonFileAtomic(paths.coverMetadataPath, metadata);
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
    await writeJsonFileAtomic(paths.coverMetadataPath, metadata);
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
  await fs4.mkdir(reportsDir, { recursive: true });
  const logPath = path4.join(reportsDir, "interruptions.log.md");
  const header = `## ${review.timestamp}
- Scope: ${review.scope}
- Message: ${review.message}
- Action: ${review.recommendedAction}

`;
  await fs4.appendFile(logPath, header);
  return review;
}
function formatStatus(state) {
  const pending = state.plan.chapterTasks.filter((task) => task.status === "pending").length;
  const completed = state.plan.chapterTasks.filter((task) => task.status === "complete").length;
  return [
    `Project: ${state.project.title}`,
    `Stage: ${state.runtime.stage}`,
    `Status: ${state.runtime.statusMessage}`,
    `Pending chapters: ${pending}`,
    `Completed chapters: ${completed}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    `Cover status: ${state.assets.cover.status}`,
    `Comic status: ${state.assets.comic.status}`,
    state.runtime.lastInterruption ? `Last interruption: ${state.runtime.lastInterruption.scope} at ${state.runtime.lastInterruption.timestamp}` : "Last interruption: none"
  ].join("\n");
}
function getWorkspaceSummary(rootDir) {
  const paths = getWorkspacePaths(rootDir);
  return {
    rootDir,
    workspaceDir: paths.workspaceDir,
    slug: slugifyTitle(path4.basename(rootDir))
  };
}

// src/discussion.ts
import fs5 from "fs/promises";
import path5 from "path";

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
  return path5.join(rootDir, ".ai-novel", ...parts);
}
async function readText(filePath) {
  return fs5.readFile(filePath, "utf8");
}
async function readOptionalText2(filePath) {
  try {
    return await readText(filePath);
  } catch {
    return "";
  }
}
async function readCharacterDossiers(filePath) {
  try {
    const parsed = JSON.parse(await readText(filePath));
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string") : [];
  } catch {
    return [];
  }
}
async function writeJsonFileAtomic2(filePath, value) {
  await fs5.mkdir(path5.dirname(filePath), { recursive: true });
  const tempPath = path5.join(path5.dirname(filePath), `.${path5.basename(filePath)}.${Date.now()}.tmp`);
  await fs5.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`);
  await fs5.rename(tempPath, filePath);
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
function appendUnique(values = [], next, limit = 10) {
  const normalized = next.trim();
  if (!normalized) return values.slice(0, limit);
  return [...values.filter((value) => value !== normalized), normalized].slice(-limit);
}
function compactList2(values = [], limit = 3) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit).join("; ") || "pending";
}
function formatCharacterDossiersMarkdown(dossiers) {
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
      `- habits: ${compactList2(dossier.behaviorHabits)}`,
      `- speech: ${compactList2(dossier.speechMarkers)}`,
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
    `  habit=${compactList2(dossier.behaviorHabits, 2)}; speech=${compactList2(dossier.speechMarkers, 2)}`,
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
      continuityNotes: appendUnique(dossier.continuityNotes, continuityNote),
      evidence: appendUnique(dossier.evidence, evidence),
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
function discussionMessageParts(messageId, input) {
  return [
    messagePart(messageId, 0, "markdown", { text: input.content }, input.createdAt),
    messagePart(messageId, 1, "json", {
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
  const archivePath = path5.join(consensusDir, fileName);
  await fs5.mkdir(consensusDir, { recursive: true });
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
  await fs5.writeFile(archivePath, `${content.trim()}
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
  const contextPath = path5.join(contextDir, "current-context.md");
  await fs5.mkdir(contextDir, { recursive: true });
  await fs5.writeFile(contextPath, `${content.trim()}
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
  const discussionLogPath = path5.join(discussionDir, "discussion-log.md");
  await fs5.mkdir(discussionDir, { recursive: true });
  const rawConsensus = await readText(consensusPath);
  const state = JSON.parse(await readText(statePath));
  const discussionTarget = inferDiscussionTarget(message);
  const runId = options.runId ?? makeRunId("discussion");
  const factoryDb = options.factoryRootDir && options.projectId ? await FactoryDb.open(options.factoryRootDir) : null;
  const priorTranscript = await readOptionalText2(discussionLogPath);
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
  await fs5.appendFile(
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
    await fs5.appendFile(
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
    await fs5.appendFile(discussionLogPath, "Status: complete\n\n");
    factoryDb?.updateRun(runId, "completed");
  } catch (error) {
    const message2 = error instanceof Error ? error.message : String(error);
    await fs5.appendFile(discussionLogPath, `Status: error
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
    await fs5.appendFile(discussionLogPath, `Stage Guard: blocked
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
  const currentDossiers = state.memory?.characterDossiers?.length ? state.memory.characterDossiers : await readCharacterDossiers(characterDossiersPath);
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
  await fs5.writeFile(consensusPath, updatedConsensus);
  await fs5.writeFile(protagonistPath, updatedProtagonist);
  if (updatedDossiers.length) {
    await writeJsonFileAtomic2(characterDossiersPath, updatedDossiers);
    await fs5.writeFile(characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown(updatedDossiers)}
`);
  }
  await fs5.writeFile(styleProfilePath, updatedStyle);
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

export {
  getProjectEnvPath,
  getProjectEnvCandidatePaths,
  readProjectEnv,
  resolveProjectEnvWritePath,
  getProjectEnvStatus,
  getPublicProjectEnvStatus,
  upsertProjectEnvValues,
  buildInitialSuperGraph,
  loadSuperGraph,
  loadSuperGraphForUpdate,
  superGraphFromDbRows,
  saveSuperGraph,
  initializeSuperGraph,
  upsertDiscussionInSuperGraph,
  upsertCheckpointInSuperGraph,
  buildSuperGraphIndex,
  validateSuperGraph,
  syncCurrentContextPacketFile,
  initAutonomousProject,
  listAutonomousProjects,
  deleteManagedAutonomousProject,
  resolveManagedProjectRoot,
  createManagedAutonomousProject,
  loadAutonomousState,
  saveAutonomousState,
  syncManagedProjectState,
  advanceAutonomousProject,
  retryChapterProduction,
  prepareCoverGeneration,
  reviewInterruption,
  formatStatus,
  getWorkspaceSummary,
  runMultiAgentDiscussion
};
