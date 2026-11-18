import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import { Annotation, END, START, StateGraph } from "@langchain/langgraph"

import type { AutonomousNovelState } from "./cli-types"
import { FactoryLangGraphCheckpointer } from "./factory-langgraph-checkpointer"
import { loadAutonomousState, saveAutonomousState } from "./orchestrator"
import {
  commitChapterProductionStage,
  createDraftBody,
  prepareChapterProductionInputs,
  runChapterNaturalnessStage,
  runQualityGateWithRevisions,
  type ChapterNaturalnessStageResult,
  type NovelWorkspacePaths,
  type ProductionPipelineOptions,
  type QualityGateResult,
} from "./writing-pipeline"
import {
  FactoryWorkflowTraceRecorder,
  WorkflowKernel,
  type WorkflowNodeMetadata,
  type WorkflowTraceReference,
} from "./workflow-kernel"

export type ProductionChapterNodeId =
  | "production.chapter-draft"
  | "production.chapter-quality"
  | "production.chapter-naturalness"
  | "production.chapter-commit"

export interface ProductionChapterNodeContext {
  projectRoot: string
  factoryRootDir: string
  projectId: string
  state: AutonomousNovelState
  chapterNumber: number
  options?: ProductionPipelineOptions
  metadata?: Record<string, unknown>
}

export interface ProductionChapterNodeInspection {
  currentNode: (WorkflowNodeMetadata & { id: ProductionChapterNodeId }) | null
  chapterNumber: number | null
  draftCheckpointPath: string | null
  qualityCheckpointPath: string | null
  naturalnessCheckpointPath: string | null
  commitCheckpointPath: string | null
}

interface ChapterQualityCheckpoint {
  chapterNumber: number
  createdAt: string
  draft: string
  report: string
  gate: QualityGateResult
}

const chapterNodes: Array<WorkflowNodeMetadata & { id: ProductionChapterNodeId }> = [
  { id: "production.chapter-draft", name: "章节生产：上下文与初稿", stage: "drafting", version: "chapter-node-v1" },
  { id: "production.chapter-quality", name: "章节生产：质量审查与修订", stage: "drafting", version: "chapter-node-v1" },
  { id: "production.chapter-naturalness", name: "章节生产：自然化、AIGC 与最终门禁", stage: "drafting", version: "chapter-node-v1" },
  { id: "production.chapter-commit", name: "章节生产：产物、记忆与状态提交", stage: "drafting", version: "chapter-node-v1" },
]

const ChapterGraphState = Annotation.Root({
  context: Annotation<ProductionChapterNodeContext>(),
  externalRunId: Annotation<string>(),
  resultState: Annotation<AutonomousNovelState | null>(),
  trace: Annotation<WorkflowTraceReference | null>(),
})

function nowIso() {
  return new Date().toISOString()
}

function workspacePaths(projectRoot: string): NovelWorkspacePaths {
  const workspaceDir = path.join(projectRoot, ".ai-novel")
  const plansDir = path.join(workspaceDir, "plans")
  const memoryDir = path.join(workspaceDir, "memory")
  const charactersDir = path.join(memoryDir, "characters")
  return {
    workspaceDir,
    plansDir,
    reportsDir: path.join(workspaceDir, "reports"),
    chaptersDir: path.join(workspaceDir, "chapters"),
    memoryDir,
    styleDir: path.join(workspaceDir, "style"),
    styleProfilePath: path.join(workspaceDir, "style", "profile.md"),
    styleRulebookPath: path.join(workspaceDir, "style", "rulebook.md"),
    styleReferencesPath: path.join(workspaceDir, "style", "references.md"),
    styleAntiPatternsPath: path.join(workspaceDir, "style", "anti-patterns.md"),
    consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
    characterDossiersPath: path.join(charactersDir, "dossiers.json"),
    characterDossiersMarkdownPath: path.join(charactersDir, "dossiers.md"),
    protagonistPath: path.join(charactersDir, "core", "protagonist.md"),
    relationsPath: path.join(charactersDir, "relations.md"),
    characterEvolutionPath: path.join(charactersDir, "evolution.md"),
    masterOutlinePath: path.join(plansDir, "master-outline.md"),
    chapterBlueprintsDir: path.join(plansDir, "chapter-blueprints"),
  }
}

function checkpointPaths(projectRoot: string, chapterNumber: number) {
  const chapterId = `chapter-${String(chapterNumber).padStart(3, "0")}`
  const checkpointDir = path.join(projectRoot, ".ai-novel", "checkpoints", chapterId)
  return {
    checkpointDir,
    draftPath: path.join(checkpointDir, "draft.md"),
    qualityPath: path.join(checkpointDir, "quality.json"),
    qualityReportPath: path.join(checkpointDir, "quality.md"),
    naturalnessPath: path.join(checkpointDir, "naturalness.json"),
    naturalnessDraftPath: path.join(checkpointDir, "naturalness.md"),
    commitPath: path.join(checkpointDir, "commit.json"),
  }
}

async function existsWithContent(filePath: string) {
  return Boolean((await fs.readFile(filePath, "utf8").catch(() => "")).trim())
}

function findTask(state: AutonomousNovelState, chapterNumber: number) {
  const task = state.plan.chapterTasks.find((candidate) => candidate.chapterNumber === chapterNumber)
  if (!task) throw new Error(`production_chapter_task_not_found:${chapterNumber}`)
  return task
}

function stateEvidence(state: AutonomousNovelState, chapterNumber: number) {
  const task = state.plan.chapterTasks.find((candidate) => candidate.chapterNumber === chapterNumber)
  return {
    stage: state.runtime.stage,
    lastAction: state.runtime.lastAction || null,
    statusMessage: state.runtime.statusMessage || null,
    chapterNumber,
    chapterStatus: task?.status || null,
  }
}

async function executeDraftNode(context: ProductionChapterNodeContext) {
  if (context.state.runtime.stage !== "drafting") throw new Error(`production_chapter_stage_mismatch:${context.state.runtime.stage}`)
  const task = findTask(context.state, context.chapterNumber)
  const paths = workspacePaths(context.projectRoot)
  const pipelineOptions = { factoryRootDir: context.factoryRootDir, ...(context.options || {}) }
  const prepared = await prepareChapterProductionInputs(context.projectRoot, paths, context.state, task, pipelineOptions)
  const draft = await createDraftBody(
    context.state,
    task,
    prepared.blueprint,
    prepared.resources,
    pipelineOptions,
    prepared.continuityContract,
    paths,
    context.projectRoot,
    prepared.characterDossiers,
    prepared.approvedStyleContext,
  )
  const checkpoints = checkpointPaths(context.projectRoot, context.chapterNumber)
  await fs.mkdir(checkpoints.checkpointDir, { recursive: true })
  await fs.writeFile(checkpoints.draftPath, `${draft}\n`, "utf8")
  context.state.runtime.lastRoute = "workflow"
  context.state.runtime.lastAction = `chapter_draft_generated:${context.chapterNumber}`
  context.state.runtime.statusMessage = `Chapter ${context.chapterNumber} draft checkpoint generated. Quality review has not run yet.`
  await saveAutonomousState(context.projectRoot, context.state)
  return context.state
}

async function executeQualityNode(context: ProductionChapterNodeContext) {
  if (context.state.runtime.stage !== "drafting") throw new Error(`production_chapter_stage_mismatch:${context.state.runtime.stage}`)
  const task = findTask(context.state, context.chapterNumber)
  const checkpoints = checkpointPaths(context.projectRoot, context.chapterNumber)
  const initialDraft = await fs.readFile(checkpoints.draftPath, "utf8").catch(() => "")
  if (!initialDraft.trim()) throw new Error(`production_chapter_draft_checkpoint_required:${context.chapterNumber}`)
  const paths = workspacePaths(context.projectRoot)
  const pipelineOptions = { factoryRootDir: context.factoryRootDir, ...(context.options || {}) }
  const prepared = await prepareChapterProductionInputs(context.projectRoot, paths, context.state, task, pipelineOptions)
  const quality = await runQualityGateWithRevisions(
    context.state,
    task,
    initialDraft,
    prepared.blueprint,
    prepared.resources,
    pipelineOptions,
    prepared.continuityContract,
    paths,
    context.projectRoot,
    prepared.characterDossiers,
    prepared.approvedStyleContext,
  )
  const checkpoint: ChapterQualityCheckpoint = {
    chapterNumber: context.chapterNumber,
    createdAt: nowIso(),
    draft: quality.draft,
    report: quality.report,
    gate: quality.gate,
  }
  await fs.mkdir(checkpoints.checkpointDir, { recursive: true })
  await fs.writeFile(checkpoints.qualityPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8")
  await fs.writeFile(checkpoints.qualityReportPath, `${quality.report}\n`, "utf8")
  context.state.runtime.lastRoute = "workflow"
  context.state.runtime.lastAction = `chapter_quality_completed:${context.chapterNumber}`
  context.state.runtime.statusMessage = quality.gate.status === "blocked"
    ? `Chapter ${context.chapterNumber} quality checkpoint is blocked: ${quality.gate.reason}`
    : `Chapter ${context.chapterNumber} quality checkpoint passed. Naturalness and AIGC have not run yet.`
  await saveAutonomousState(context.projectRoot, context.state)
  return context.state
}

async function executeNaturalnessNode(context: ProductionChapterNodeContext) {
  if (context.state.runtime.stage !== "drafting") throw new Error(`production_chapter_stage_mismatch:${context.state.runtime.stage}`)
  const task = findTask(context.state, context.chapterNumber)
  const checkpoints = checkpointPaths(context.projectRoot, context.chapterNumber)
  const rawQuality = await fs.readFile(checkpoints.qualityPath, "utf8").catch(() => "")
  if (!rawQuality.trim()) throw new Error(`production_chapter_quality_checkpoint_required:${context.chapterNumber}`)
  const quality = JSON.parse(rawQuality) as ChapterQualityCheckpoint
  const paths = workspacePaths(context.projectRoot)
  const pipelineOptions = { factoryRootDir: context.factoryRootDir, ...(context.options || {}) }
  const prepared = await prepareChapterProductionInputs(context.projectRoot, paths, context.state, task, pipelineOptions)
  const result = await runChapterNaturalnessStage(context.state, task, quality, prepared, pipelineOptions)
  await fs.mkdir(checkpoints.checkpointDir, { recursive: true })
  await fs.writeFile(checkpoints.naturalnessPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
  await fs.writeFile(checkpoints.naturalnessDraftPath, `${result.finalDraft}\n`, "utf8")
  context.state.runtime.lastRoute = "workflow"
  context.state.runtime.lastAction = `chapter_naturalness_completed:${context.chapterNumber}`
  context.state.runtime.statusMessage = result.finalGate.status === "blocked"
    ? `Chapter ${context.chapterNumber} final gate is blocked: ${result.finalGate.reason}`
    : `Chapter ${context.chapterNumber} naturalness and AIGC gates passed. Memory commit has not run yet.`
  await saveAutonomousState(context.projectRoot, context.state)
  return context.state
}

async function executeCommitNode(context: ProductionChapterNodeContext) {
  if (context.state.runtime.stage !== "drafting") throw new Error(`production_chapter_stage_mismatch:${context.state.runtime.stage}`)
  const task = findTask(context.state, context.chapterNumber)
  const checkpoints = checkpointPaths(context.projectRoot, context.chapterNumber)
  const rawNaturalness = await fs.readFile(checkpoints.naturalnessPath, "utf8").catch(() => "")
  if (!rawNaturalness.trim()) throw new Error(`production_chapter_naturalness_checkpoint_required:${context.chapterNumber}`)
  const naturalness = JSON.parse(rawNaturalness) as ChapterNaturalnessStageResult
  const paths = workspacePaths(context.projectRoot)
  const pipelineOptions = { factoryRootDir: context.factoryRootDir, ...(context.options || {}) }
  const prepared = await prepareChapterProductionInputs(context.projectRoot, paths, context.state, task, pipelineOptions)
  const committed = await commitChapterProductionStage(
    context.projectRoot,
    paths,
    context.state,
    task,
    prepared,
    naturalness,
    pipelineOptions,
  )
  task.status = committed.qualityGate.status === "blocked" ? "blocked" : "complete"
  task.qualityGate = { ...committed.qualityGate, updatedAt: nowIso() }
  task.aigcStatus = pipelineOptions.bypassAigcGate
    ? "pending"
    : committed.qualityGate.status === "blocked" ? "blocked" : "passed"
  context.state.plan.pendingChapters = context.state.plan.chapterTasks.filter((candidate) => candidate.status === "pending").length
  context.state.runtime.stage = task.status === "blocked"
    ? "reviewing"
    : context.state.plan.pendingChapters > 0 ? "drafting" : "complete"
  context.state.runtime.lastRoute = "workflow"
  context.state.runtime.lastAction = task.status === "blocked"
    ? `chapter_blocked:${context.chapterNumber}`
    : context.state.runtime.stage === "complete" ? "workflow_complete" : `chapter_completed:${context.chapterNumber}`
  context.state.runtime.statusMessage = task.status === "blocked"
    ? `Chapter ${context.chapterNumber} was committed as blocked: ${committed.qualityGate.reason}`
    : `Chapter ${context.chapterNumber} artifacts and memory were committed.`
  await fs.mkdir(checkpoints.checkpointDir, { recursive: true })
  await fs.writeFile(
    checkpoints.commitPath,
    `${JSON.stringify({ chapterNumber: context.chapterNumber, committedAt: nowIso(), ...committed }, null, 2)}\n`,
    "utf8",
  )
  await saveAutonomousState(context.projectRoot, context.state)
  return context.state
}

const chapterKernel = new WorkflowKernel<ProductionChapterNodeContext>()
  .register({ ...chapterNodes[0], execute: executeDraftNode })
  .register({ ...chapterNodes[1], execute: executeQualityNode })
  .register({ ...chapterNodes[2], execute: executeNaturalnessNode })
  .register({ ...chapterNodes[3], execute: executeCommitNode })

export function listProductionChapterNodes() {
  return chapterNodes.map((node) => ({ ...node }))
}

export async function inspectProductionChapterNode(
  projectRoot: string,
  suppliedState?: AutonomousNovelState,
): Promise<ProductionChapterNodeInspection> {
  const state = suppliedState || await loadAutonomousState(projectRoot)
  if (state.runtime.stage !== "drafting") {
    return { currentNode: null, chapterNumber: null, draftCheckpointPath: null, qualityCheckpointPath: null, naturalnessCheckpointPath: null, commitCheckpointPath: null }
  }
  const task = state.plan.chapterTasks.find((candidate) => candidate.status === "pending")
  if (!task) return { currentNode: null, chapterNumber: null, draftCheckpointPath: null, qualityCheckpointPath: null, naturalnessCheckpointPath: null, commitCheckpointPath: null }
  const checkpoints = checkpointPaths(projectRoot, task.chapterNumber)
  const hasDraft = await existsWithContent(checkpoints.draftPath)
  const hasQuality = await existsWithContent(checkpoints.qualityPath)
  const hasNaturalness = await existsWithContent(checkpoints.naturalnessPath)
  const hasCommit = await existsWithContent(checkpoints.commitPath)
  return {
    currentNode: !hasDraft
      ? { ...chapterNodes[0] }
      : !hasQuality
        ? { ...chapterNodes[1] }
        : !hasNaturalness
          ? { ...chapterNodes[2] }
          : !hasCommit
            ? { ...chapterNodes[3] }
            : null,
    chapterNumber: task.chapterNumber,
    draftCheckpointPath: checkpoints.draftPath,
    qualityCheckpointPath: checkpoints.qualityPath,
    naturalnessCheckpointPath: checkpoints.naturalnessPath,
    commitCheckpointPath: checkpoints.commitPath,
  }
}

async function executeWithTrace(context: ProductionChapterNodeContext, nodeId: ProductionChapterNodeId, externalRunId: string) {
  const node = chapterKernel.getNode(nodeId)
  const recorder = new FactoryWorkflowTraceRecorder(context.factoryRootDir)
  const inputEvidence = stateEvidence(context.state, context.chapterNumber)
  const trace = await recorder.initialize({
    projectId: context.projectId,
    externalRunId,
    node,
    input: inputEvidence,
    executionMode: "manual",
    goal: `生产沙盒单点执行：${node.name}`,
    metadata: { isolatedProductionSandbox: true, fineGrainedChapterNode: true, chapterNumber: context.chapterNumber, ...context.metadata },
  })
  await recorder.sync(trace, node, { status: "running", metadata: context.metadata })
  try {
    const state = await chapterKernel.executeNode<AutonomousNovelState>(nodeId, context)
    await recorder.recordAttempt(trace, {
      kind: nodeId === "production.chapter-quality" || nodeId === "production.chapter-naturalness" ? "audit" : "generate",
      promptVersion: node.version,
      input: inputEvidence,
      output: stateEvidence(state, context.chapterNumber),
      metadata: { nodeId, chapterNumber: context.chapterNumber },
    })
    await recorder.sync(trace, node, {
      status: "completed",
      output: stateEvidence(state, context.chapterNumber),
      validation: { valid: true, errors: [], warnings: [] },
      validationPromptVersion: "production-chapter-transition-v1",
      attemptMetadata: { nodeId, chapterNumber: context.chapterNumber },
    })
    return { state, trace }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recorder.sync(trace, node, {
      status: "failed",
      error: message,
      validation: { valid: false, errors: [message], warnings: [] },
      validationPromptVersion: "production-chapter-transition-v1",
      attemptMetadata: { nodeId, chapterNumber: context.chapterNumber },
    })
    throw error
  }
}

export async function executeProductionChapterNode(
  context: ProductionChapterNodeContext,
  nodeId: ProductionChapterNodeId,
  externalRunId = `production_chapter_${Date.now()}_${randomUUID().slice(0, 8)}`,
) {
  const checkpointer = new FactoryLangGraphCheckpointer(context.factoryRootDir, context.projectId, `manual_${externalRunId}`)
  const graphConfig = {
    configurable: { thread_id: `workflow:${context.projectId}:${externalRunId}`, checkpoint_ns: "" },
    durability: "sync" as const,
  }
  for await (const restored of checkpointer.list(graphConfig, { limit: 12 })) {
    const restoredState = restored.checkpoint.channel_values.resultState as AutonomousNovelState | null | undefined
    const restoredTrace = restored.checkpoint.channel_values.trace as WorkflowTraceReference | null | undefined
    if (restoredState && restoredTrace) return { state: restoredState, trace: restoredTrace }
  }
  const inspection = await inspectProductionChapterNode(context.projectRoot, context.state)
  if (!inspection.currentNode || inspection.chapterNumber !== context.chapterNumber) throw new Error("production_chapter_node_not_available")
  if (inspection.currentNode.id !== nodeId) {
    throw new Error(`production_chapter_node_not_current:requested=${nodeId}:current=${inspection.currentNode.id}`)
  }
  const graph = new StateGraph(ChapterGraphState)
    .addNode(nodeId, async (graphState) => {
      const result = await executeWithTrace(graphState.context, nodeId, graphState.externalRunId)
      return { resultState: result.state, trace: result.trace }
    })
    .addEdge(START, nodeId)
    .addEdge(nodeId, END)
    .compile({ checkpointer })
  const output = await graph.invoke({ context, externalRunId, resultState: null, trace: null }, graphConfig)
  if (!output.resultState || !output.trace) throw new Error("production_chapter_langgraph_completed_without_result")
  return { state: output.resultState, trace: output.trace }
}
