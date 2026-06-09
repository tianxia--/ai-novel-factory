import {
  generateAgentReply,
  loadLlmConfigFromEnv,
  runChapterProductionPipeline,
  throwIfStopped,
  writeAllDetailedChapterBlueprints,
  writeProductionMasterOutline,
  writeProductionWritingResourceArtifacts
} from "./chunk-YPZ72LHB.js";
import {
  retrieveKnowledge
} from "./chunk-AXLXISKJ.js";
import {
  FactoryDb,
  createLocalTextEmbedding,
  makeAgentTurnId,
  makeRunId,
  targetToArtifactKind,
  withFactoryDb
} from "./chunk-7ZCRCHQW.js";
import {
  createAgentMessage
} from "./chunk-GZKJNHMN.js";

// src/super-graph.ts
import fs from "fs/promises";
import path from "path";
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
  return path.join(rootDir, WORKSPACE_DIR, ...parts);
}
function graphPaths(rootDir) {
  const graphDir = workspacePath(rootDir, "graph");
  return {
    graphDir,
    graphPath: path.join(graphDir, "super-graph.json"),
    indexPath: path.join(graphDir, "index.json"),
    violationsPath: path.join(graphDir, "violations.json")
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
  const raw = await fs.readFile(graphPath, "utf8");
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
  await fs.mkdir(paths.graphDir, { recursive: true });
  graph.generatedAt = now();
  await fs.writeFile(paths.graphPath, `${JSON.stringify(graph, null, 2)}
`);
  await fs.writeFile(paths.indexPath, `${JSON.stringify(buildSuperGraphIndex(graph), null, 2)}
`);
  await fs.writeFile(paths.violationsPath, `${JSON.stringify(validateSuperGraph(graph), null, 2)}
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
  const checkpointId = `checkpoint:${path.basename(checkpoint.path).replace(/\.json$/i, "")}`;
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
import fs2 from "fs/promises";
import path2 from "path";
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
  return current.replace(/^- Stage: .*$/m, `- Stage: ${state.runtime.stage}`).replace(/^- Last action: .*$/m, `- Last action: ${state.runtime.lastAction}`).replace(/^- Last route: .*$/m, `- Last route: ${state.runtime.lastRoute}`).replace(/^- Autopilot running: .*$/m, `- Autopilot running: ${Boolean(state.runtime.autopilot?.running)}`).replace(/^- Target: .*$/m, `- Target: ${focus.target}`).replace(/^- Asset: .*$/m, `- Asset: ${focus.asset}`);
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
    "Memory/RAG recall:",
    "- No database memory recall matched this turn yet."
  ].join("\n");
}
async function syncCurrentContextPacketFile(projectRoot, state) {
  const contextPath = path2.join(projectRoot, ".ai-novel", "context", "current-context.md");
  const current = await fs2.readFile(contextPath, "utf8").catch(() => "");
  if (!current) {
    await fs2.mkdir(path2.dirname(contextPath), { recursive: true });
    await fs2.writeFile(contextPath, `${createCurrentContextPacketText(state)}
`);
    return;
  }
  const next = syncContextPacketStateText(current, state);
  if (next === current) {
    return;
  }
  await fs2.writeFile(contextPath, next.endsWith("\n") ? next : `${next}
`);
}

// src/orchestrator.ts
import fs3 from "fs/promises";
import { randomUUID } from "crypto";
import path3 from "path";
var WORKSPACE_DIR2 = ".ai-novel";
var PROJECTS_DIR = ".ai-novel-projects";
var PROJECTS_REGISTRY_FILE = "projects.json";
var WORKSPACE_VERSION = 1;
var MIN_CHAPTER_WORD_TARGET = 2500;
var DEFAULT_CHAPTER_RECOVERY_LIMIT = 3;
var AGENT_ROLES = [
  "showrunner",
  "world-architect",
  "author",
  "editor",
  "reviewer",
  "prose-stylist"
];
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
  const projectsRoot = path3.join(rootDir, PROJECTS_DIR);
  return {
    projectsRoot,
    registryPath: path3.join(projectsRoot, PROJECTS_REGISTRY_FILE)
  };
}
async function readProjectRegistry(rootDir) {
  const { registryPath } = getProjectsPaths(rootDir);
  try {
    const raw = await fs3.readFile(registryPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
async function writeProjectRegistry(rootDir, projects) {
  const { projectsRoot, registryPath } = getProjectsPaths(rootDir);
  await fs3.mkdir(projectsRoot, { recursive: true });
  await fs3.writeFile(registryPath, `${JSON.stringify(projects, null, 2)}
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
  return path3.join(rootDir, PROJECTS_DIR, projectId);
}
function resolveStoredProjectRoot(rootDir, projectRoot, projectId) {
  if (path3.isAbsolute(projectRoot)) {
    return projectRoot;
  }
  const rootRelative = path3.resolve(rootDir, projectRoot);
  const managedRoot = resolveProjectRoot(rootDir, projectId);
  if (path3.normalize(projectRoot).includes(`${PROJECTS_DIR}${path3.sep}`)) {
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
function buildInitialState(options) {
  const now2 = (/* @__PURE__ */ new Date()).toISOString();
  const title = options.title?.trim() || inferTitleFromIdea(options.idea);
  const projectIdea = options.idea.trim();
  const chapterTasks = buildChapterTasks(options.totalChapters, options.chapterWordTarget, projectIdea);
  return {
    project: {
      title,
      idea: projectIdea,
      createdAt: now2,
      workspaceVersion: WORKSPACE_VERSION
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
    assets: {
      cover: {
        status: "pending",
        briefPath: ".ai-novel/assets/cover/cover-brief.md"
      },
      comic: {
        status: "pending",
        planPath: ".ai-novel/assets/comic/comic-plan.md"
      }
    }
  };
}
function getWorkspacePaths(rootDir) {
  const workspaceDir = path3.join(rootDir, WORKSPACE_DIR2);
  return {
    workspaceDir,
    statePath: path3.join(workspaceDir, "state.json"),
    promptsDir: path3.join(workspaceDir, "prompts"),
    agentPromptsDir: path3.join(workspaceDir, "prompts", "agents"),
    consensusPath: path3.join(workspaceDir, "prompts", "global-consensus.md"),
    plansDir: path3.join(workspaceDir, "plans"),
    reportsDir: path3.join(workspaceDir, "reports"),
    styleDir: path3.join(workspaceDir, "style"),
    styleProfilePath: path3.join(workspaceDir, "style", "profile.md"),
    styleRulebookPath: path3.join(workspaceDir, "style", "rulebook.md"),
    styleReferencesPath: path3.join(workspaceDir, "style", "references.md"),
    styleAntiPatternsPath: path3.join(workspaceDir, "style", "anti-patterns.md"),
    chaptersDir: path3.join(workspaceDir, "chapters"),
    assetsDir: path3.join(workspaceDir, "assets"),
    coverDir: path3.join(workspaceDir, "assets", "cover"),
    comicDir: path3.join(workspaceDir, "assets", "comic"),
    memoryDir: path3.join(workspaceDir, "memory"),
    charactersDir: path3.join(workspaceDir, "memory", "characters"),
    characterCoreDir: path3.join(workspaceDir, "memory", "characters", "core"),
    protagonistPath: path3.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
    relationsPath: path3.join(workspaceDir, "memory", "characters", "relations.md"),
    characterEvolutionPath: path3.join(workspaceDir, "memory", "characters", "evolution.md"),
    configPath: path3.join(workspaceDir, "config.json"),
    settingFreezePath: path3.join(workspaceDir, "plans", "setting-freeze.md"),
    masterOutlinePath: path3.join(workspaceDir, "plans", "master-outline.md"),
    chapterBlueprintsDir: path3.join(workspaceDir, "plans", "chapter-blueprints"),
    coverPromptPath: path3.join(workspaceDir, "assets", "cover", "cover-prompt.md")
  };
}
async function writeWorkspaceArtifacts(rootDir, state) {
  const paths = getWorkspacePaths(rootDir);
  const llmConfig = loadLlmConfigFromEnv(rootDir);
  await fs3.mkdir(paths.promptsDir, { recursive: true });
  await fs3.mkdir(paths.agentPromptsDir, { recursive: true });
  await fs3.mkdir(paths.plansDir, { recursive: true });
  await fs3.mkdir(paths.reportsDir, { recursive: true });
  await fs3.mkdir(paths.styleDir, { recursive: true });
  await fs3.mkdir(paths.chaptersDir, { recursive: true });
  await fs3.mkdir(paths.coverDir, { recursive: true });
  await fs3.mkdir(paths.comicDir, { recursive: true });
  await fs3.mkdir(paths.characterCoreDir, { recursive: true });
  await writeJsonFileAtomic(paths.statePath, state);
  llmConfig.writing.chapterWordTarget = state.plan.chapterWordTarget;
  llmConfig.writing.chapterWordMinimum = MIN_CHAPTER_WORD_TARGET;
  await writeJsonFileAtomic(paths.configPath, llmConfig);
  const reactPrompt = [
    "# ReAct Worldbuilding Session",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
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
    "Open slots:",
    "- identity",
    "- wound",
    "- desire",
    "- contradiction",
    "- unique tie to the central conflict"
  ].join("\n");
  const relations = [
    "# Character Relations",
    "",
    "- protagonist: pending",
    "- ally axis: pending",
    "- rival axis: pending",
    "- intimate/conflicted axis: pending"
  ].join("\n");
  const evolution = [
    "# Character Evolution Log",
    "",
    "No chapter-driven character changes recorded yet."
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
      "# Prose Stylist Base Prompt\n\nYou humanize language, deepen scene texture, and reduce AI-sounding phrasing without changing core plot decisions."
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
  await fs3.writeFile(path3.join(paths.promptsDir, "react-worldbuilding.md"), `${reactPrompt}
`);
  await fs3.writeFile(path3.join(paths.plansDir, "plan-and-solve-brief.md"), `${planBrief}
`);
  await fs3.writeFile(paths.consensusPath, `${globalConsensus}
`);
  await fs3.writeFile(paths.styleProfilePath, `${styleProfile}
`);
  await fs3.writeFile(paths.styleRulebookPath, `${styleRulebook}
`);
  await fs3.writeFile(paths.styleReferencesPath, `${styleReferences}
`);
  await fs3.writeFile(paths.styleAntiPatternsPath, `${styleAntiPatterns}
`);
  await fs3.writeFile(paths.protagonistPath, `${protagonistSeed}
`);
  await fs3.writeFile(paths.relationsPath, `${relations}
`);
  await fs3.writeFile(paths.characterEvolutionPath, `${evolution}
`);
  await fs3.writeFile(path3.join(paths.coverDir, "cover-brief.md"), `${coverBrief}
`);
  await fs3.writeFile(path3.join(paths.comicDir, "comic-plan.md"), `${comicPlan}
`);
  await Promise.all(
    AGENT_ROLES.flatMap((role) => {
      const base = path3.join(paths.agentPromptsDir, `${role}.base.md`);
      const dynamic = path3.join(paths.agentPromptsDir, `${role}.dynamic.md`);
      return [
        fs3.writeFile(base, `${basePrompts.get(role) ?? ""}
`),
        fs3.writeFile(dynamic, `${dynamicPrompts.get(role) ?? ""}
`)
      ];
    })
  );
}
async function readOptionalText(filePath) {
  try {
    return (await fs3.readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}
async function writeJsonFileAtomic(filePath, value) {
  const data = `${JSON.stringify(value, null, 2)}
`;
  await fs3.mkdir(path3.dirname(filePath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const tempPath = path3.join(path3.dirname(filePath), `.${path3.basename(filePath)}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`);
    try {
      const handle = await fs3.open(tempPath, "wx");
      try {
        await handle.writeFile(data, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs3.rename(tempPath, filePath);
      return;
    } catch (error) {
      await fs3.unlink(tempPath).catch(() => void 0);
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
async function initAutonomousProject(options) {
  const paths = getWorkspacePaths(options.rootDir);
  if (options.chapterWordTarget < MIN_CHAPTER_WORD_TARGET) {
    throw new Error(`Chapter word target must be at least ${MIN_CHAPTER_WORD_TARGET}.`);
  }
  await fs3.mkdir(paths.workspaceDir, { recursive: true });
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
  const expectedProjectRoot = path3.resolve(resolveProjectRoot(rootDir, project.id));
  if (path3.resolve(projectRoot) !== expectedProjectRoot) {
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
  await fs3.rm(projectRoot, { recursive: true, force: true });
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
      projectRoot: record.projectRoot
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
  const raw = await fs3.readFile(statePath, "utf8");
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
    const finalPath = path3.join(paths.chaptersDir, `${chapterId}.final.md`);
    try {
      await fs3.access(finalPath);
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
    consensus: await readOptionalText(paths.consensusPath),
    protagonist: await readOptionalText(paths.protagonistPath),
    style: await readOptionalText(paths.styleProfilePath)
  };
  if (state.runtime.stage === "worldbuilding_dialogue") {
    throwIfStopped(pipelineOptions.signal);
    await writeProductionWritingResourceArtifacts(rootDir, paths, state, pipelineOptions);
    await fs3.writeFile(paths.settingFreezePath, `${createSettingFreeze(state, context)}
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
async function prepareCoverGeneration(rootDir) {
  const state = await loadAutonomousState(rootDir);
  const paths = getWorkspacePaths(rootDir);
  const prompt = [
    "# Cover Image Prompt",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    "",
    "Art direction:",
    "- foreground one memorable protagonist silhouette or emblem",
    "- signal genre promise immediately",
    "- leave clean title space",
    "- avoid generic stock-poster composition",
    "",
    "Image prompt seed:",
    `"Create a novel cover for '${state.project.title}' inspired by: ${state.project.idea}"`
  ].join("\n");
  await fs3.writeFile(paths.coverPromptPath, `${prompt}
`);
  state.assets.cover.status = "in_progress";
  state.runtime.statusMessage = "Cover prompt prepared. Ready for an image-generation step.";
  stampRuntimeProgress(state, "cover_prompt_prepared", "cover");
  await saveAutonomousState(rootDir, state);
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
  await fs3.mkdir(reportsDir, { recursive: true });
  const logPath = path3.join(reportsDir, "interruptions.log.md");
  const header = `## ${review.timestamp}
- Scope: ${review.scope}
- Message: ${review.message}
- Action: ${review.recommendedAction}

`;
  await fs3.appendFile(logPath, header);
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
    slug: slugifyTitle(path3.basename(rootDir))
  };
}

// src/discussion.ts
import fs4 from "fs/promises";
import path4 from "path";

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
  return path4.join(rootDir, ".ai-novel", ...parts);
}
async function readText(filePath) {
  return fs4.readFile(filePath, "utf8");
}
async function readOptionalText2(filePath) {
  try {
    return await readText(filePath);
  } catch {
    return "";
  }
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
  const archivePath = path4.join(consensusDir, fileName);
  await fs4.mkdir(consensusDir, { recursive: true });
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
  await fs4.writeFile(archivePath, `${content.trim()}
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
  return [
    "# Autonomous Creation Mode",
    "",
    `Project title: ${state.project.title}`,
    `Core idea seed: ${state.project.idea}`,
    `Current workflow stage: ${state.runtime.stage}`,
    `Scoped target: ${target.label}`,
    `Write-back asset: ${target.assetPath}`,
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
function clipText(value, maxLength) {
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
  const recalledMemory = options.recalledMemory?.length ? options.recalledMemory.map((item) => `- [${String(item.kind || "memory")}] ${clipText(String(item.content || ""), 360)} (score: ${Number(item.score || 0)})`) : ["- No database memory recall matched this turn yet."];
  const recalledKnowledge = options.recalledKnowledge?.length ? options.recalledKnowledge.map((item) => {
    const source = item.source && typeof item.source === "object" ? item.source : {};
    return `- [${String(item.chunk_type || "knowledge")}] ${clipText(String(item.content || ""), 360)} (source: ${String(source.path || "")}, score: ${Number(item.score || 0).toFixed(2)})`;
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
  const contextPath = path4.join(contextDir, "current-context.md");
  await fs4.mkdir(contextDir, { recursive: true });
  await fs4.writeFile(contextPath, `${content.trim()}
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
  const styleProfilePath = workspacePath2(rootDir, "style", "profile.md");
  const discussionDir = workspacePath2(rootDir, "chat");
  const discussionLogPath = path4.join(discussionDir, "discussion-log.md");
  await fs4.mkdir(discussionDir, { recursive: true });
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
  await fs4.appendFile(
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
        priorTranscript: clipText(priorTranscript, 8e3),
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
      const storyCoreCtx = buildStoryCoreContext(state, sanitizedConsensus, discussionTarget, message);
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
    await fs4.appendFile(
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
    await fs4.appendFile(discussionLogPath, "Status: complete\n\n");
    factoryDb?.updateRun(runId, "completed");
  } catch (error) {
    const message2 = error instanceof Error ? error.message : String(error);
    await fs4.appendFile(discussionLogPath, `Status: error
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
    await fs4.appendFile(discussionLogPath, `Stage Guard: blocked
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
  await fs4.writeFile(consensusPath, updatedConsensus);
  await fs4.writeFile(protagonistPath, updatedProtagonist);
  await fs4.writeFile(styleProfilePath, updatedStyle);
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
