import fs from "node:fs/promises"
import path from "node:path"

import type { AutonomousNovelState, ChapterTask } from "./cli-types"
import { withFactoryDb } from "./factory-db"

export type SuperGraphNodeType =
  | "Project"
  | "Mission"
  | "WorkflowStage"
  | "Agent"
  | "Artifact"
  | "ChapterTask"
  | "Character"
  | "Location"
  | "Faction"
  | "Event"
  | "Scene"
  | "Foreshadowing"
  | "WorldRule"
  | "Decision"
  | "Conflict"
  | "Relationship"
  | "TimelinePoint"
  | "ContextLayer"
  | "Memory"
  | "KnowledgeChunk"
  | "ToolResult"
  | "Checkpoint"
  | "DriftGuard"
  | "DiscussionTurn"

export type SuperGraphEdgeType =
  | "HAS_MISSION"
  | "HAS_STAGE"
  | "HAS_AGENT"
  | "HAS_ARTIFACT"
  | "HAS_CHAPTER_TASK"
  | "CURRENT_STAGE"
  | "NEXT_STAGE"
  | "WRITES"
  | "READS"
  | "UPDATES"
  | "DERIVES_FROM"
  | "DECIDED_BY"
  | "CHECKS"
  | "VIOLATES"
  | "SUPPORTS"
  | "APPEARS_IN"
  | "BELONGS_TO"
  | "KNOWS"
  | "CAUSES"
  | "CONFLICTS_WITH"
  | "FORESHADOWS"
  | "PAYS_OFF"
  | "HAPPENS_BEFORE"
  | "HAPPENS_AFTER"
  | "RECALLS"
  | "USES_CONTEXT_LAYER"
  | "PRODUCED_TOOL_RESULT"
  | "SNAPSHOTTED"

export interface SuperGraphNode {
  id: string
  type: SuperGraphNodeType
  label: string
  properties: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SuperGraphEdge {
  id: string
  type: SuperGraphEdgeType
  from: string
  to: string
  properties: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SuperGraph {
  schemaVersion: number
  projectId: string
  generatedAt: string
  nodes: SuperGraphNode[]
  edges: SuperGraphEdge[]
}

export interface SuperGraphValidationIssue {
  severity: "warning" | "error"
  code: string
  message: string
  nodeId?: string
  edgeId?: string
}

const GRAPH_SCHEMA_VERSION = 1
const WORKSPACE_DIR = ".ai-novel"
const STAGES = [
  "worldbuilding_dialogue",
  "setting_review",
  "master_planning",
  "chapter_task_generation",
  "drafting",
  "complete",
]
const AGENTS = ["showrunner", "world-architect", "author", "editor", "reviewer", "prose-stylist"]
const CONTEXT_LAYERS = [
  "system",
  "project_mission",
  "workflow_state",
  "canon_memory",
  "rag_recall",
  "recent_history",
  "tool_results",
  "current_task",
  "output_contract",
]

function now() {
  return new Date().toISOString()
}

function readJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function workspacePath(rootDir: string, ...parts: string[]) {
  return path.join(rootDir, WORKSPACE_DIR, ...parts)
}

function graphPaths(rootDir: string) {
  const graphDir = workspacePath(rootDir, "graph")
  return {
    graphDir,
    graphPath: path.join(graphDir, "super-graph.json"),
    indexPath: path.join(graphDir, "index.json"),
    violationsPath: path.join(graphDir, "violations.json"),
  }
}

function makeNode(type: SuperGraphNodeType, id: string, label: string, properties: Record<string, unknown> = {}): SuperGraphNode {
  const timestamp = now()
  return { id, type, label, properties, createdAt: timestamp, updatedAt: timestamp }
}

function makeEdge(
  type: SuperGraphEdgeType,
  from: string,
  to: string,
  properties: Record<string, unknown> = {},
): SuperGraphEdge {
  const timestamp = now()
  return {
    id: `edge:${type.toLowerCase()}:${from}->${to}`,
    type,
    from,
    to,
    properties,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function upsertNode(graph: SuperGraph, node: SuperGraphNode) {
  const index = graph.nodes.findIndex((candidate) => candidate.id === node.id)
  if (index >= 0) {
    graph.nodes[index] = {
      ...graph.nodes[index],
      ...node,
      createdAt: graph.nodes[index].createdAt,
      updatedAt: now(),
    }
    return
  }

  graph.nodes.push(node)
}

function upsertEdge(graph: SuperGraph, edge: SuperGraphEdge) {
  const index = graph.edges.findIndex((candidate) => candidate.id === edge.id)
  if (index >= 0) {
    graph.edges[index] = {
      ...graph.edges[index],
      ...edge,
      createdAt: graph.edges[index].createdAt,
      updatedAt: now(),
    }
    return
  }

  graph.edges.push(edge)
}

function taskNode(task: ChapterTask) {
  return makeNode("ChapterTask", `chapter:${String(task.chapterNumber).padStart(3, "0")}`, task.title, {
    chapterNumber: task.chapterNumber,
    status: task.status,
    summary: task.summary,
    targetWords: task.targetWords,
    causalPlan: task.causalPlan || null,
  })
}

export function buildInitialSuperGraph(state: AutonomousNovelState): SuperGraph {
  const graph: SuperGraph = {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    projectId: "project:current",
    generatedAt: now(),
    nodes: [],
    edges: [],
  }

  upsertNode(graph, makeNode("Project", "project:current", state.project.title, {
    idea: state.project.idea,
    createdAt: state.project.createdAt,
    workspaceVersion: state.project.workspaceVersion,
  }))
  upsertNode(graph, makeNode("Mission", "mission:original", "Original Project Mission", {
    idea: state.project.idea,
    totalChapters: state.plan.totalChapters,
    chapterWordTarget: state.plan.chapterWordTarget,
    promise: "Preserve the user's original story goal across all autonomous runs.",
  }))
  upsertEdge(graph, makeEdge("HAS_MISSION", "project:current", "mission:original"))

  for (const [index, stage] of STAGES.entries()) {
    const stageId = `stage:${stage}`
    upsertNode(graph, makeNode("WorkflowStage", stageId, stage, {
      order: index + 1,
      active: state.runtime.stage === stage,
    }))
    upsertEdge(graph, makeEdge("HAS_STAGE", "project:current", stageId))
    if (state.runtime.stage === stage) {
      upsertEdge(graph, makeEdge("CURRENT_STAGE", "project:current", stageId))
    }
    const nextStage = STAGES[index + 1]
    if (nextStage) {
      upsertEdge(graph, makeEdge("NEXT_STAGE", stageId, `stage:${nextStage}`))
    }
  }

  for (const agent of AGENTS) {
    const agentId = `agent:${agent}`
    upsertNode(graph, makeNode("Agent", agentId, agent, {
      basePrompt: `.ai-novel/prompts/agents/${agent}.base.md`,
      dynamicPrompt: `.ai-novel/prompts/agents/${agent}.dynamic.md`,
    }))
    upsertEdge(graph, makeEdge("HAS_AGENT", "project:current", agentId))
    upsertEdge(graph, makeEdge("READS", agentId, "artifact:global-consensus"))
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
    ["artifact:context-packet", "Current Context Packet", ".ai-novel/context/current-context-packet.json"],
  ]
  for (const [id, label, assetPath] of artifacts) {
    upsertNode(graph, makeNode("Artifact", id, label, { path: assetPath }))
    upsertEdge(graph, makeEdge("HAS_ARTIFACT", "project:current", id))
  }

  for (const layer of CONTEXT_LAYERS) {
    const layerId = `context:${layer}`
    upsertNode(graph, makeNode("ContextLayer", layerId, layer, {
      priority: CONTEXT_LAYERS.indexOf(layer) + 1,
    }))
    upsertEdge(graph, makeEdge("USES_CONTEXT_LAYER", "project:current", layerId))
  }

  for (const task of state.plan.chapterTasks) {
    const node = taskNode(task)
    upsertNode(graph, node)
    upsertEdge(graph, makeEdge("HAS_CHAPTER_TASK", "project:current", node.id))
  }

  return graph
}

export async function loadSuperGraph(rootDir: string) {
  const { graphPath } = graphPaths(rootDir)
  const raw = await fs.readFile(graphPath, "utf8")
  return JSON.parse(raw) as SuperGraph
}

export async function loadSuperGraphForUpdate(
  rootDir: string,
  options: { factoryRootDir?: string; projectId?: string | null } = {},
) {
  const projectId = normalizeProjectId(options.projectId)
  if (options.factoryRootDir && projectId) {
    const dbGraph = await withFactoryDb(options.factoryRootDir, async (db) => db.getGraph(projectId)).catch(() => null)
    if (dbGraph && dbGraph.nodes.length > 0) {
      return superGraphFromDbRows(projectId, dbGraph.nodes, dbGraph.edges)
    }
  }

  return loadSuperGraph(rootDir)
}

export function superGraphFromDbRows(
  projectId: string,
  nodes: Array<Record<string, unknown>>,
  edges: Array<Record<string, unknown>>,
): SuperGraph {
  return {
    schemaVersion: GRAPH_SCHEMA_VERSION,
    projectId,
    generatedAt: now(),
    nodes: nodes.map((row) => ({
      id: String(row.id),
      type: String(row.type) as SuperGraphNodeType,
      label: String(row.label),
      properties: readJson<Record<string, unknown>>(row.metadata_json, {}),
      createdAt: String(row.updated_at || now()),
      updatedAt: String(row.updated_at || now()),
    })),
    edges: edges.map((row) => ({
      id: String(row.id),
      type: String(row.type) as SuperGraphEdgeType,
      from: String(row.from_node_id),
      to: String(row.to_node_id),
      properties: readJson<Record<string, unknown>>(row.metadata_json, {}),
      createdAt: String(row.updated_at || now()),
      updatedAt: String(row.updated_at || now()),
    })),
  }
}

function normalizeProjectId(projectId?: string | null) {
  if (!projectId || projectId === "project:current") {
    return null
  }
  return projectId
}

export async function saveSuperGraph(rootDir: string, graph: SuperGraph, options: { factoryRootDir?: string; projectId?: string | null } = {}) {
  const paths = graphPaths(rootDir)
  await fs.mkdir(paths.graphDir, { recursive: true })
  graph.generatedAt = now()
  await fs.writeFile(paths.graphPath, `${JSON.stringify(graph, null, 2)}\n`)
  await fs.writeFile(paths.indexPath, `${JSON.stringify(buildSuperGraphIndex(graph), null, 2)}\n`)
  await fs.writeFile(paths.violationsPath, `${JSON.stringify(validateSuperGraph(graph), null, 2)}\n`)
  const projectId = normalizeProjectId(options.projectId)
  if (options.factoryRootDir && projectId) {
    await withFactoryDb(options.factoryRootDir, async (db) => db.upsertGraph(projectId, graph.nodes, graph.edges)).catch(() => undefined)
  }
}

export async function initializeSuperGraph(rootDir: string, state: AutonomousNovelState, options: { factoryRootDir?: string; projectId?: string | null } = {}) {
  const graph = buildInitialSuperGraph(state)
  await saveSuperGraph(rootDir, graph, options)
  return graph
}

export async function upsertDiscussionInSuperGraph(
  rootDir: string,
  discussion: {
    target?: { kind: string; label: string; assetPath: string }
    summary?: string
    transcriptPath?: string
  },
  options: { factoryRootDir?: string; projectId?: string | null } = {},
) {
  const graph = await loadSuperGraphForUpdate(rootDir, options)
  const turnId = `discussion:${Date.now()}`
  upsertNode(graph, makeNode("DiscussionTurn", turnId, discussion.target?.label || "Discussion Turn", {
    targetKind: discussion.target?.kind,
    targetAssetPath: discussion.target?.assetPath,
    summary: discussion.summary,
    transcriptPath: discussion.transcriptPath,
  }))
  upsertEdge(graph, makeEdge("DECIDED_BY", turnId, "agent:showrunner"))
  upsertEdge(graph, makeEdge("UPDATES", turnId, "artifact:global-consensus"))
  if (discussion.target?.assetPath?.includes("protagonist")) {
    upsertEdge(graph, makeEdge("UPDATES", turnId, "artifact:protagonist"))
  }
  if (discussion.target?.assetPath?.includes("style")) {
    upsertEdge(graph, makeEdge("UPDATES", turnId, "artifact:style-profile"))
  }
  if (discussion.transcriptPath) {
    upsertEdge(graph, makeEdge("WRITES", turnId, "artifact:discussion-log"))
  }
  await saveSuperGraph(rootDir, graph, options)
  return graph
}

export async function upsertCheckpointInSuperGraph(
  rootDir: string,
  checkpoint: {
    path: string
    label: string
    drift?: { score?: number; status?: string; reason?: string }
  },
  options: { factoryRootDir?: string; projectId?: string | null } = {},
) {
  const graph = await loadSuperGraphForUpdate(rootDir, options)
  const checkpointId = `checkpoint:${path.basename(checkpoint.path).replace(/\.json$/i, "")}`
  upsertNode(graph, makeNode("Checkpoint", checkpointId, checkpoint.label, {
    path: checkpoint.path,
    drift: checkpoint.drift,
  }))
  upsertEdge(graph, makeEdge("SNAPSHOTTED", checkpointId, "project:current"))
  upsertEdge(graph, makeEdge("WRITES", checkpointId, "artifact:checkpoints"))
  if (checkpoint.drift) {
    const guardId = `guard:${checkpointId}`
    upsertNode(graph, makeNode("DriftGuard", guardId, `Drift Guard ${checkpoint.drift.status || "ok"}`, checkpoint.drift))
    upsertEdge(graph, makeEdge("CHECKS", guardId, checkpointId))
    if (checkpoint.drift.status === "blocked" || checkpoint.drift.status === "correcting") {
      upsertEdge(graph, makeEdge("VIOLATES", guardId, "mission:original"))
    } else {
      upsertEdge(graph, makeEdge("SUPPORTS", guardId, "mission:original"))
    }
  }
  await saveSuperGraph(rootDir, graph, options)
  return graph
}

export function buildSuperGraphIndex(graph: SuperGraph) {
  return {
    schemaVersion: graph.schemaVersion,
    generatedAt: now(),
    counts: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
    },
    nodeTypes: Object.fromEntries(
      Array.from(new Set(graph.nodes.map((node) => node.type))).map((type) => [
        type,
        graph.nodes.filter((node) => node.type === type).length,
      ]),
    ),
    edgeTypes: Object.fromEntries(
      Array.from(new Set(graph.edges.map((edge) => edge.type))).map((type) => [
        type,
        graph.edges.filter((edge) => edge.type === type).length,
      ]),
    ),
  }
}

export function validateSuperGraph(graph: SuperGraph): SuperGraphValidationIssue[] {
  const issues: SuperGraphValidationIssue[] = []
  const nodeIds = new Set(graph.nodes.map((node) => node.id))

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      issues.push({
        severity: "error",
        code: "missing_edge_from",
        message: `Edge '${edge.id}' references missing from-node '${edge.from}'.`,
        edgeId: edge.id,
      })
    }
    if (!nodeIds.has(edge.to)) {
      issues.push({
        severity: "error",
        code: "missing_edge_to",
        message: `Edge '${edge.id}' references missing to-node '${edge.to}'.`,
        edgeId: edge.id,
      })
    }
  }

  for (const required of ["project:current", "mission:original", "artifact:global-consensus"]) {
    if (!nodeIds.has(required)) {
      issues.push({
        severity: "error",
        code: "missing_required_node",
        message: `Required graph node '${required}' is missing.`,
        nodeId: required,
      })
    }
  }

  const currentStages = graph.edges.filter((edge) => edge.type === "CURRENT_STAGE")
  if (currentStages.length !== 1) {
    issues.push({
      severity: "warning",
      code: "invalid_current_stage_count",
      message: `Expected exactly one CURRENT_STAGE edge, found ${currentStages.length}.`,
    })
  }

  return issues
}
