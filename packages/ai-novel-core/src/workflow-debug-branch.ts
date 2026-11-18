import { uuid6, type Checkpoint, type CheckpointMetadata } from "@langchain/langgraph-checkpoint"

import { FactoryLangGraphCheckpointer } from "./factory-langgraph-checkpointer"
import {
  FactoryWorkflowTraceRecorder,
  type WorkflowTraceReference,
} from "./workflow-kernel"

export interface WorkflowDebugBranchReference {
  branchId: string
  threadId: string
  checkpointNamespace: string
  runId: string | null
  baseCheckpointId: string
  lastCheckpointId: string
}

export interface WorkflowStateDiffEntry {
  operation: "add" | "remove" | "replace"
  path: string
  before?: unknown
  after?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function jsonPointer(path: string, key: string | number) {
  const escaped = String(key).replace(/~/gu, "~0").replace(/\//gu, "~1")
  return `${path}/${escaped}`
}

export function diffWorkflowState(before: unknown, after: unknown, path = ""): WorkflowStateDiffEntry[] {
  if (Object.is(before, after)) return []
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes: WorkflowStateDiffEntry[] = []
    const length = Math.max(before.length, after.length)
    for (let index = 0; index < length; index += 1) {
      const nextPath = jsonPointer(path, index)
      if (index >= before.length) changes.push({ operation: "add", path: nextPath, after: after[index] })
      else if (index >= after.length) changes.push({ operation: "remove", path: nextPath, before: before[index] })
      else changes.push(...diffWorkflowState(before[index], after[index], nextPath))
    }
    return changes
  }
  if (isRecord(before) && isRecord(after)) {
    const changes: WorkflowStateDiffEntry[] = []
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of Array.from(keys).sort()) {
      const nextPath = jsonPointer(path, key)
      if (!(key in before)) changes.push({ operation: "add", path: nextPath, after: after[key] })
      else if (!(key in after)) changes.push({ operation: "remove", path: nextPath, before: before[key] })
      else changes.push(...diffWorkflowState(before[key], after[key], nextPath))
    }
    return changes
  }
  return [{ operation: "replace", path: path || "/", before, after }]
}

function branchCheckpoint(id: string, state: unknown, version: number): Checkpoint {
  return {
    v: 4,
    id,
    ts: new Date().toISOString(),
    channel_values: { debugState: state },
    channel_versions: { debugState: version },
    versions_seen: { debugBranch: { debugState: Math.max(0, version - 1) } },
  }
}

function nextCheckpointId() {
  return uuid6(Math.floor(Math.random() * 0x4000))
}

export class FactoryWorkflowDebugBranchManager {
  constructor(private readonly rootDir: string, private readonly projectId: string) {}

  private saver(reference: Pick<WorkflowDebugBranchReference, "runId">) {
    return new FactoryLangGraphCheckpointer(this.rootDir, this.projectId, reference.runId)
  }

  private config(reference: Pick<WorkflowDebugBranchReference, "threadId" | "checkpointNamespace">, checkpointId?: string) {
    return { configurable: {
      thread_id: reference.threadId,
      checkpoint_ns: reference.checkpointNamespace,
      ...(checkpointId ? { checkpoint_id: checkpointId } : {}),
    } }
  }

  async create(input: {
    branchId: string
    nodeId: string
    runId?: string | null
    baseState: unknown
    metadata?: Record<string, unknown>
  }): Promise<WorkflowDebugBranchReference> {
    const threadId = `debug-branch:${this.projectId}:${input.branchId}`
    const checkpointNamespace = input.nodeId
    const baseCheckpointId = nextCheckpointId()
    const reference: WorkflowDebugBranchReference = {
      branchId: input.branchId,
      threadId,
      checkpointNamespace,
      runId: input.runId || null,
      baseCheckpointId,
      lastCheckpointId: baseCheckpointId,
    }
    await this.saver(reference).put(this.config(reference), branchCheckpoint(baseCheckpointId, input.baseState, 1), {
      source: "input",
      step: -1,
      parents: {},
      branchId: input.branchId,
      nodeId: input.nodeId,
      label: "branch-base",
      ...input.metadata,
    } as CheckpointMetadata, { debugState: 1 })
    return reference
  }

  async append(
    reference: WorkflowDebugBranchReference,
    state: unknown,
    metadata: Record<string, unknown> = {},
  ): Promise<WorkflowDebugBranchReference> {
    const saver = this.saver(reference)
    const current = await saver.getTuple(this.config(reference, reference.lastCheckpointId))
    if (!current) throw new Error(`debug_branch_checkpoint_not_found:${reference.lastCheckpointId}`)
    const version = Number(current.checkpoint.channel_versions.debugState || 0) + 1
    const checkpointId = nextCheckpointId()
    await saver.put(this.config(reference, reference.lastCheckpointId), branchCheckpoint(checkpointId, state, version), {
      source: metadata.source === "fork" ? "fork" : "update",
      step: version - 1,
      parents: { [reference.checkpointNamespace]: reference.lastCheckpointId },
      branchId: reference.branchId,
      nodeId: reference.checkpointNamespace,
      ...metadata,
    } as CheckpointMetadata, { debugState: version })
    reference.lastCheckpointId = checkpointId
    return reference
  }

  async inspect(reference: WorkflowDebugBranchReference) {
    const saver = this.saver(reference)
    const history = []
    for await (const tuple of saver.list(this.config(reference))) {
      history.push({
        checkpointId: tuple.checkpoint.id,
        createdAt: tuple.checkpoint.ts,
        state: tuple.checkpoint.channel_values.debugState,
        metadata: tuple.metadata || {},
        parentCheckpointId: tuple.parentConfig?.configurable?.checkpoint_id || null,
      })
    }
    const chronological = history.reverse()
    const base = chronological[0] || null
    const latest = chronological.at(-1) || null
    return {
      reference,
      base,
      latest,
      history: chronological,
      diff: diffWorkflowState(base?.state, latest?.state),
    }
  }

  async rollback(reference: WorkflowDebugBranchReference, checkpointId: string) {
    const saver = this.saver(reference)
    const target = await saver.getTuple(this.config(reference, checkpointId))
    if (!target) throw new Error(`debug_branch_rollback_checkpoint_not_found:${checkpointId}`)
    return this.append(reference, target.checkpoint.channel_values.debugState, {
      source: "fork",
      label: "rollback",
      rolledBackTo: checkpointId,
    })
  }

  async promote<TResult>(
    reference: WorkflowDebugBranchReference,
    trace: WorkflowTraceReference,
    apply: (state: unknown, diff: WorkflowStateDiffEntry[]) => Promise<TResult>,
  ) {
    const inspection = await this.inspect(reference)
    if (!inspection.latest) throw new Error("debug_branch_has_no_promotable_state")
    const recorder = new FactoryWorkflowTraceRecorder(this.rootDir)
    let result: TResult
    try {
      result = await apply(inspection.latest.state, inspection.diff)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await recorder.recordAttempt(trace, {
        kind: "promote",
        status: "failed",
        promptVersion: "debug-branch-promotion-v1",
        input: { reference, diff: inspection.diff },
        error: message,
        metadata: { branchId: reference.branchId, checkpointId: inspection.latest.checkpointId },
      })
      throw error
    }
    await recorder.recordAttempt(trace, {
      kind: "promote",
      status: "completed",
      promptVersion: "debug-branch-promotion-v1",
      input: { reference, diff: inspection.diff },
      output: result,
      metadata: { branchId: reference.branchId, checkpointId: inspection.latest.checkpointId },
    })
    await this.append(reference, inspection.latest.state, {
      source: "fork",
      label: "promoted",
      promotedCheckpointId: inspection.latest.checkpointId,
    })
    return { result, reference, diff: inspection.diff }
  }
}
