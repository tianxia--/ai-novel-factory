import { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import type { AutonomousNovelState } from "./cli-types"
import {
  advanceAutonomousProject,
  loadAutonomousState,
  resolveManagedProjectRoot,
} from "./orchestrator"
import {
  executeProductionPlanningNode,
  inspectProductionPlanningNode,
  listProductionPlanningNodes,
  type ProductionPlanningNodeId,
} from "./production-planning-workflow"
import {
  executeProductionChapterNode,
  inspectProductionChapterNode,
  listProductionChapterNodes,
  type ProductionChapterNodeId,
} from "./production-chapter-workflow"
import {
  executeProductionAdvanceThroughKernel,
  listProductionWorkflowNodes,
  resolveProductionWorkflowNode,
} from "./production-workflow"
import {
  FactoryWorkflowTraceRecorder,
  type WorkflowNodeMetadata,
  type WorkflowTraceEvidence,
  type WorkflowTraceReference,
} from "./workflow-kernel"

export type ProductionWorkflowSandboxStatus = "ready" | "running" | "failed"

export interface ProductionWorkflowSandboxRun {
  runId: string
  nodeId: string
  nodeName: string
  startedAt: string
  completedAt: string | null
  status: "running" | "completed" | "failed"
  beforeStage: string
  afterStage: string | null
  beforeState: Record<string, unknown>
  afterState: Record<string, unknown> | null
  trace: WorkflowTraceReference | null
  error: string | null
}

export interface ProductionWorkflowSandboxManifest {
  sandboxId: string
  projectId: string
  sourceProjectRoot: string
  sandboxRoot: string
  createdAt: string
  updatedAt: string
  status: ProductionWorkflowSandboxStatus
  activeRunId: string | null
  runs: ProductionWorkflowSandboxRun[]
}

export interface ProductionWorkflowSandboxInspection {
  manifest: ProductionWorkflowSandboxManifest
  state: AutonomousNovelState
  currentNode: WorkflowNodeMetadata
  nodes: WorkflowNodeMetadata[]
  canExecuteCurrentNode: boolean
  workflowEvidence: WorkflowTraceEvidence | null
  humanGate: {
    id: "setting-review" | "protagonist-profile"
    status: "required" | "approved" | "rejected"
    reviewPath?: string
    approvalPath: string
  } | null
}

const activeProductionWorkflowSandboxes = new Set<string>()

function assertSafeSandboxId(sandboxId: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/u.test(sandboxId)) {
    throw new Error("invalid_production_workflow_sandbox_id")
  }
  return sandboxId
}

function nowIso() {
  return new Date().toISOString()
}

function stateEvidence(state: AutonomousNovelState) {
  const tasks = state.plan.chapterTasks || []
  return {
    stage: state.runtime.stage,
    statusMessage: state.runtime.statusMessage || null,
    lastAction: state.runtime.lastAction || null,
    chapterCounts: {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === "pending").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      complete: tasks.filter((task) => task.status === "complete").length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
    },
  }
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
  await fs.rename(temporaryPath, filePath)
}

/**
 * Runs the real production state-machine node against an isolated copy of a
 * managed project. Factory workflow traces stay durable, while project state
 * and generated artifacts remain inside the sandbox until an explicit promote
 * operation is implemented by the business layer.
 */
export class ProductionWorkflowSandboxManager {
  private readonly sandboxesRoot: string
  private readonly traceRecorder: FactoryWorkflowTraceRecorder

  constructor(private readonly factoryRootDir: string) {
    this.sandboxesRoot = path.join(factoryRootDir, ".ai-novel-factory", "workflow-sandboxes")
    this.traceRecorder = new FactoryWorkflowTraceRecorder(factoryRootDir)
  }

  private sandboxRoot(sandboxId: string) {
    return path.join(this.sandboxesRoot, assertSafeSandboxId(sandboxId))
  }

  private manifestPath(sandboxId: string) {
    return path.join(this.sandboxRoot(sandboxId), "sandbox.json")
  }

  async create(projectId: string, sandboxId = `production_debug_${Date.now()}_${randomUUID().slice(0, 8)}`) {
    const sourceProjectRoot = await resolveManagedProjectRoot(this.factoryRootDir, projectId)
    const sandboxRoot = this.sandboxRoot(sandboxId)
    const sourceNovelRoot = path.join(sourceProjectRoot, ".ai-novel")
    const sandboxNovelRoot = path.join(sandboxRoot, ".ai-novel")
    await fs.access(sourceNovelRoot)
    await fs.mkdir(sandboxRoot, { recursive: true })
    await fs.cp(sourceNovelRoot, sandboxNovelRoot, { recursive: true, force: false, errorOnExist: true })
    const createdAt = nowIso()
    const manifest: ProductionWorkflowSandboxManifest = {
      sandboxId,
      projectId,
      sourceProjectRoot,
      sandboxRoot,
      createdAt,
      updatedAt: createdAt,
      status: "ready",
      activeRunId: null,
      runs: [],
    }
    await writeJsonAtomic(this.manifestPath(sandboxId), manifest)
    return this.inspect(sandboxId)
  }

  async loadManifest(sandboxId: string) {
    const raw = await fs.readFile(this.manifestPath(sandboxId), "utf8")
    return JSON.parse(raw) as ProductionWorkflowSandboxManifest
  }

  async inspect(sandboxId: string): Promise<ProductionWorkflowSandboxInspection> {
    const manifest = await this.loadManifest(sandboxId)
    const state = await loadAutonomousState(manifest.sandboxRoot)
    const planning = await inspectProductionPlanningNode(manifest.sandboxRoot, state)
    const chapter = await inspectProductionChapterNode(manifest.sandboxRoot, state)
    const currentNode = planning.currentNode || chapter.currentNode || resolveProductionWorkflowNode(state.runtime.stage)
    const latestRun = manifest.runs.at(-1) || null
    let workflowEvidence: WorkflowTraceEvidence | null = null
    if (latestRun) {
      const trace = latestRun.trace || {
        projectId: manifest.projectId,
        runId: `manual_${latestRun.runId}`,
        stepId: `step_${latestRun.runId}`,
        attemptCount: 0,
        lastSyncedStatus: "running" as const,
      }
      try {
        const evidence = await this.traceRecorder.loadEvidence(trace)
        if (evidence.run) workflowEvidence = evidence
      } catch {
        // The manifest is written before the durable workflow row. A short
        // evidence gap is expected while the production node is starting.
      }
    }
    let humanGate: ProductionWorkflowSandboxInspection["humanGate"] = null
    if (state.runtime.stage === "setting_review") {
      const approvalPath = path.join(manifest.sandboxRoot, ".ai-novel", "plans", "setting-review-approval.json")
      let approval: Record<string, unknown> | null = null
      try {
        approval = JSON.parse(await fs.readFile(approvalPath, "utf8")) as Record<string, unknown>
      } catch {
        approval = null
      }
      if (approval?.approved !== true) {
        humanGate = {
          id: "setting-review",
          status: approval?.approved === false ? "rejected" : "required",
          reviewPath: ".ai-novel/plans/setting-freeze.md",
          approvalPath: ".ai-novel/plans/setting-review-approval.json",
        }
      } else {
        const protagonistPath = path.join(manifest.sandboxRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md")
        let protagonistProfile = ""
        try {
          protagonistProfile = await fs.readFile(protagonistPath, "utf8")
        } catch {
          protagonistProfile = ""
        }
        humanGate = {
          id: "protagonist-profile",
          status: /Status:\s*confirmed|Canonical Protagonist:\s*[^\s-]/iu.test(protagonistProfile) ? "approved" : "required",
          approvalPath: ".ai-novel/memory/characters/core/protagonist.md",
        }
      }
    }
    return {
      manifest,
      state,
      currentNode,
      nodes: [...listProductionWorkflowNodes(), ...listProductionPlanningNodes(), ...listProductionChapterNodes()],
      canExecuteCurrentNode: manifest.status !== "running"
        && !activeProductionWorkflowSandboxes.has(sandboxId)
        && humanGate?.status !== "required"
        && humanGate?.status !== "rejected",
      workflowEvidence,
      humanGate,
    }
  }

  async approveSettingReview(sandboxId: string) {
    if (activeProductionWorkflowSandboxes.has(sandboxId)) throw new Error("production_workflow_sandbox_busy")
    const manifest = await this.loadManifest(sandboxId)
    if (manifest.status === "running") throw new Error("production_workflow_sandbox_has_unfinished_run")
    const state = await loadAutonomousState(manifest.sandboxRoot)
    if (state.runtime.stage !== "setting_review") {
      throw new Error(`production_workflow_setting_review_not_current:${state.runtime.stage}`)
    }
    const reviewPath = path.join(manifest.sandboxRoot, ".ai-novel", "plans", "setting-freeze.md")
    await fs.access(reviewPath)
    await writeJsonAtomic(path.join(manifest.sandboxRoot, ".ai-novel", "plans", "setting-review-approval.json"), {
      version: 1,
      status: "approved",
      approved: true,
      reviewedAt: nowIso(),
      reviewedBy: "flow-debug-user",
      note: "用户在正式流程沙盒中确认当前 setting review packet，可继续验证后续生产节点。",
      rejectionReason: "",
      settingReviewPath: ".ai-novel/plans/setting-freeze.md",
      approvalScope: "setting_review",
    })
    return this.inspect(sandboxId)
  }

  async confirmProtagonistProfile(sandboxId: string, input: Record<string, unknown>) {
    if (activeProductionWorkflowSandboxes.has(sandboxId)) throw new Error("production_workflow_sandbox_busy")
    const manifest = await this.loadManifest(sandboxId)
    if (manifest.status === "running") throw new Error("production_workflow_sandbox_has_unfinished_run")
    const state = await loadAutonomousState(manifest.sandboxRoot)
    if (state.runtime.stage !== "setting_review") {
      throw new Error(`production_workflow_protagonist_profile_not_current:${state.runtime.stage}`)
    }
    const fields = {
      name: String(input.name || "").trim(),
      identity: String(input.identity || "").trim(),
      coreDesire: String(input.coreDesire || "").trim(),
      fearOrWound: String(input.fearOrWound || "").trim(),
      behaviorHabit: String(input.behaviorHabit || "").trim(),
      speechMarker: String(input.speechMarker || "").trim(),
      relationshipName: String(input.relationshipName || "").trim(),
      relationshipPressure: String(input.relationshipPressure || "").trim(),
    }
    const missing = Object.entries(fields).filter(([, value]) => !value).map(([key]) => key)
    if (missing.length) throw new Error(`production_workflow_protagonist_profile_incomplete:${missing.join(",")}`)
    const confirmedAt = nowIso()
    const markdown = [
      "# Confirmed Protagonist Profile",
      "",
      "Status: confirmed",
      `Confirmed At: ${confirmedAt}`,
      "Confirmed By: flow-debug-user",
      "",
      `Canonical Protagonist: ${fields.name}`,
      `核心主角: ${fields.name}`,
      `主角姓名: ${fields.name}`,
      "",
      `#### ${fields.name}（主角 / protagonist）`,
      "",
      "- id: protagonist",
      "- role: protagonist",
      `- aliases: ${fields.name}、主角`,
      `- identity and role: ${fields.identity}`,
      `- core desire: ${fields.coreDesire}`,
      `- fear or wound: ${fields.fearOrWound}`,
      `- contradiction: ${fields.name} 必须在「${fields.coreDesire}」和「${fields.fearOrWound}」之间持续做选择。`,
      `- behavior habits: ${fields.behaviorHabit}`,
      `- speech markers: ${fields.speechMarker}`,
      `- named relationship pressure: ${fields.relationshipName} - ${fields.relationshipPressure}`,
      "",
      "## Production Contract",
      "",
      "- Master planning must use this concrete protagonist and must not replace the name with a role label.",
      "- Story foundation and chapter blueprints must preserve the named relationship pressure above.",
    ].join("\n")
    const profilePath = path.join(manifest.sandboxRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md")
    await fs.mkdir(path.dirname(profilePath), { recursive: true })
    await fs.writeFile(profilePath, `${markdown}\n`, "utf8")
    return this.inspect(sandboxId)
  }

  async executeNode(sandboxId: string, requestedNodeId: string) {
    if (activeProductionWorkflowSandboxes.has(sandboxId)) throw new Error("production_workflow_sandbox_busy")
    const manifest = await this.loadManifest(sandboxId)
    if (manifest.status === "running") throw new Error("production_workflow_sandbox_has_unfinished_run")
    const beforeState = await loadAutonomousState(manifest.sandboxRoot)
    const planning = await inspectProductionPlanningNode(manifest.sandboxRoot, beforeState)
    const chapter = await inspectProductionChapterNode(manifest.sandboxRoot, beforeState)
    const currentNode = planning.currentNode || chapter.currentNode || resolveProductionWorkflowNode(beforeState.runtime.stage)
    if (requestedNodeId !== currentNode.id) {
      throw new Error(`production_workflow_node_not_current:requested=${requestedNodeId}:current=${currentNode.id}`)
    }

    const runId = `production_node_${Date.now()}_${randomUUID().slice(0, 8)}`
    const run: ProductionWorkflowSandboxRun = {
      runId,
      nodeId: currentNode.id,
      nodeName: currentNode.name,
      startedAt: nowIso(),
      completedAt: null,
      status: "running",
      beforeStage: beforeState.runtime.stage,
      afterStage: null,
      beforeState: stateEvidence(beforeState),
      afterState: null,
      trace: null,
      error: null,
    }
    manifest.status = "running"
    manifest.activeRunId = runId
    manifest.updatedAt = nowIso()
    manifest.runs.push(run)
    await writeJsonAtomic(this.manifestPath(sandboxId), manifest)
    activeProductionWorkflowSandboxes.add(sandboxId)

    try {
      const metadata = {
        isolatedProductionSandbox: true,
        sandboxId,
        sourceProjectRoot: manifest.sourceProjectRoot,
      }
      const result = currentNode.id === "production.story-foundation" || currentNode.id === "production.chapter-blueprints"
        ? await executeProductionPlanningNode({
          projectRoot: manifest.sandboxRoot,
          factoryRootDir: this.factoryRootDir,
          projectId: manifest.projectId,
          state: beforeState,
          options: { envRootDir: manifest.sourceProjectRoot, preferDeterministicPlanning: process.env.AI_NOVEL_TEST_MODE === "1" },
          metadata,
        }, currentNode.id as ProductionPlanningNodeId, runId)
        : currentNode.id === "production.chapter-draft"
            || currentNode.id === "production.chapter-quality"
            || currentNode.id === "production.chapter-naturalness"
            || currentNode.id === "production.chapter-commit"
          ? await executeProductionChapterNode({
            projectRoot: manifest.sandboxRoot,
            factoryRootDir: this.factoryRootDir,
            projectId: manifest.projectId,
            state: beforeState,
            chapterNumber: chapter.chapterNumber as number,
            options: { envRootDir: manifest.sourceProjectRoot, writingMode: "quality" },
            metadata,
          }, currentNode.id as ProductionChapterNodeId, runId)
          : await executeProductionAdvanceThroughKernel({
          rootDir: manifest.sandboxRoot,
          factoryRootDir: this.factoryRootDir,
          projectId: manifest.projectId,
          state: beforeState,
          executionMode: "manual",
          externalRunId: runId,
          enabled: true,
          metadata,
          }, () => advanceAutonomousProject(manifest.sandboxRoot, {
            factoryRootDir: this.factoryRootDir,
            envRootDir: manifest.sourceProjectRoot,
          }))
      run.status = "completed"
      run.completedAt = nowIso()
      run.afterStage = result.state.runtime.stage
      run.afterState = stateEvidence(result.state)
      run.trace = result.trace
      manifest.status = "ready"
      manifest.activeRunId = null
      manifest.updatedAt = run.completedAt
      await writeJsonAtomic(this.manifestPath(sandboxId), manifest)
      return this.inspect(sandboxId)
    } catch (error) {
      run.status = "failed"
      run.completedAt = nowIso()
      run.error = error instanceof Error ? error.message : String(error)
      manifest.status = "failed"
      manifest.activeRunId = null
      manifest.updatedAt = run.completedAt
      await writeJsonAtomic(this.manifestPath(sandboxId), manifest)
      throw error
    } finally {
      activeProductionWorkflowSandboxes.delete(sandboxId)
    }
  }
}
