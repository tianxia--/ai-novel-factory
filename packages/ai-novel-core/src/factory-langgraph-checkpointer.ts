import { createHash } from "node:crypto"

import {
  BaseCheckpointSaver,
  WRITES_IDX_MAP,
  getCheckpointId,
  type ChannelVersions,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointPendingWrite,
  type CheckpointTuple,
  type PendingWrite,
  type SerializerProtocol,
} from "@langchain/langgraph-checkpoint"
import type { RunnableConfig } from "@langchain/core/runnables"

import { withFactoryDb } from "./factory-db"

interface SerializedValue {
  type: string
  data: string
}

interface StoredPendingWrite {
  taskId: string
  channel: string
  index: number
  value: SerializedValue
}

interface StoredCheckpointDrift {
  kind: "langgraph"
  threadId: string
  checkpointNamespace: string
  checkpointId: string
  parentCheckpointId: string | null
  metadata: SerializedValue
  newVersions: ChannelVersions
  pendingWrites: StoredPendingWrite[]
}

interface StoredCheckpointState {
  checkpoint: SerializedValue | null
}

function checkpointRecordId(projectId: string, threadId: string, checkpointNamespace: string, checkpointId: string) {
  return `lg_${createHash("sha256").update(`${projectId}\u0000${threadId}\u0000${checkpointNamespace}\u0000${checkpointId}`).digest("hex")}`
}

function requiredConfig(config: RunnableConfig, requireCheckpoint = false) {
  const threadId = config.configurable?.thread_id
  const checkpointNamespace = config.configurable?.checkpoint_ns ?? ""
  const checkpointId = getCheckpointId(config)
  if (typeof threadId !== "string" || !threadId.trim()) {
    throw new Error("factory_langgraph_checkpointer_requires_thread_id")
  }
  if (typeof checkpointNamespace !== "string") {
    throw new Error("factory_langgraph_checkpointer_requires_string_checkpoint_ns")
  }
  if (requireCheckpoint && (typeof checkpointId !== "string" || !checkpointId)) {
    throw new Error("factory_langgraph_checkpointer_requires_checkpoint_id")
  }
  return { threadId, checkpointNamespace, checkpointId: typeof checkpointId === "string" ? checkpointId : undefined }
}

function storedParts(row: Record<string, unknown>) {
  return {
    recordId: String(row.id || ""),
    drift: row.drift as StoredCheckpointDrift,
    state: row.state as StoredCheckpointState,
  }
}

/** LangGraph BaseCheckpointSaver backed by the factory's existing SQLite DB. */
export class FactoryLangGraphCheckpointer extends BaseCheckpointSaver {
  constructor(
    private readonly rootDir: string,
    private readonly projectId: string,
    private readonly runId: string | null = null,
    serde?: SerializerProtocol,
  ) {
    super(serde)
  }

  private async serialize(value: unknown): Promise<SerializedValue> {
    const [type, data] = await this.serde.dumpsTyped(value)
    return { type, data: Buffer.from(data).toString("base64") }
  }

  private async deserialize<T>(value: SerializedValue): Promise<T> {
    return this.serde.loadsTyped(value.type, Buffer.from(value.data, "base64")) as Promise<T>
  }

  private async query(config: RunnableConfig, options: CheckpointListOptions = {}) {
    const { threadId, checkpointNamespace, checkpointId } = requiredConfig(config)
    const beforeCheckpointId = options.before ? getCheckpointId(options.before) : undefined
    return withFactoryDb(this.rootDir, async (db) => db.listWorkflowCheckpoints(this.projectId, {
      threadId,
      checkpointNamespace,
      checkpointId,
      beforeCheckpointId: typeof beforeCheckpointId === "string" ? beforeCheckpointId : undefined,
      limit: options.filter ? 1000 : options.limit || 100,
    }))
  }

  private async tupleFromRow(row: Record<string, unknown>): Promise<CheckpointTuple> {
    const { drift, state } = storedParts(row)
    if (!state.checkpoint) throw new Error(`factory_langgraph_checkpoint_not_ready:${drift.checkpointId}`)
    const pendingWrites: CheckpointPendingWrite[] = await Promise.all((drift.pendingWrites || []).map(async (write) => [
      write.taskId,
      write.channel,
      await this.deserialize(write.value),
    ] as CheckpointPendingWrite))
    const tuple: CheckpointTuple = {
      config: { configurable: {
        thread_id: drift.threadId,
        checkpoint_ns: drift.checkpointNamespace,
        checkpoint_id: drift.checkpointId,
      } },
      checkpoint: await this.deserialize<Checkpoint>(state.checkpoint),
      metadata: await this.deserialize<CheckpointMetadata>(drift.metadata),
      pendingWrites,
    }
    if (drift.parentCheckpointId) {
      tuple.parentConfig = { configurable: {
        thread_id: drift.threadId,
        checkpoint_ns: drift.checkpointNamespace,
        checkpoint_id: drift.parentCheckpointId,
      } }
    }
    return tuple
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const rows = await this.query(config, { limit: 1 })
    return rows[0] ? this.tupleFromRow(rows[0]) : undefined
  }

  async *list(config: RunnableConfig, options: CheckpointListOptions = {}): AsyncGenerator<CheckpointTuple> {
    const rows = await this.query(config, options)
    let emitted = 0
    for (const row of rows) {
      const tuple = await this.tupleFromRow(row)
      const metadata = tuple.metadata as Record<string, unknown> | undefined
      if (options.filter && !Object.entries(options.filter).every(([key, value]) => metadata?.[key] === value)) continue
      if (options.limit !== undefined && emitted >= options.limit) break
      emitted += 1
      yield tuple
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions,
  ): Promise<RunnableConfig> {
    const { threadId, checkpointNamespace, checkpointId: parentCheckpointId } = requiredConfig(config)
    const existing = await withFactoryDb(this.rootDir, async (db) => db.listWorkflowCheckpoints(this.projectId, {
      threadId,
      checkpointNamespace,
      checkpointId: checkpoint.id,
      limit: 1,
    }))
    const previous = existing[0] ? storedParts(existing[0]) : null
    const drift: StoredCheckpointDrift = {
      kind: "langgraph",
      threadId,
      checkpointNamespace,
      checkpointId: checkpoint.id,
      parentCheckpointId: parentCheckpointId || null,
      metadata: await this.serialize(metadata),
      newVersions,
      pendingWrites: previous?.drift.pendingWrites || [],
    }
    const state: StoredCheckpointState = { checkpoint: await this.serialize(checkpoint) }
    if (previous) {
      await withFactoryDb(this.rootDir, async (db) => db.updateWorkflowCheckpoint(previous.recordId, { drift, state }))
    } else {
      try {
        await withFactoryDb(this.rootDir, async (db) => db.recordCheckpoint({
          id: checkpointRecordId(this.projectId, threadId, checkpointNamespace, checkpoint.id),
          projectId: this.projectId,
          runId: this.runId,
          label: `langgraph:${checkpointNamespace || "root"}`,
          path: `factory://langgraph/${encodeURIComponent(threadId)}/${encodeURIComponent(checkpointNamespace)}/${checkpoint.id}`,
          drift,
          state,
        }))
      } catch (error) {
        if (!/UNIQUE constraint failed: checkpoints\.id/u.test(error instanceof Error ? error.message : String(error))) throw error
        const collided = await withFactoryDb(this.rootDir, async (db) => db.listWorkflowCheckpoints(this.projectId, {
          threadId,
          checkpointNamespace,
          checkpointId: checkpoint.id,
          limit: 1,
        }))
        if (!collided[0]) throw error
        const stored = storedParts(collided[0])
        await withFactoryDb(this.rootDir, async (db) => db.updateWorkflowCheckpoint(stored.recordId, {
          drift: { ...drift, pendingWrites: stored.drift.pendingWrites || [] },
          state,
        }))
      }
    }
    return { configurable: {
      thread_id: threadId,
      checkpoint_ns: checkpointNamespace,
      checkpoint_id: checkpoint.id,
    } }
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void> {
    const { threadId, checkpointNamespace, checkpointId } = requiredConfig(config, true)
    const rows = await withFactoryDb(this.rootDir, async (db) => db.listWorkflowCheckpoints(this.projectId, {
      threadId,
      checkpointNamespace,
      checkpointId,
      limit: 1,
    }))
    const stored = rows[0] ? storedParts(rows[0]) : null
    const pendingWrites = [...(stored?.drift.pendingWrites || [])]
    for (let index = 0; index < writes.length; index += 1) {
      const [channel, value] = writes[index]
      const writeIndex = WRITES_IDX_MAP[channel] ?? index
      const existingIndex = pendingWrites.findIndex((candidate) => candidate.taskId === taskId && candidate.index === writeIndex)
      if (writeIndex >= 0 && existingIndex >= 0) continue
      const nextWrite: StoredPendingWrite = {
        taskId,
        channel,
        index: writeIndex,
        value: await this.serialize(value),
      }
      if (existingIndex >= 0) pendingWrites[existingIndex] = nextWrite
      else pendingWrites.push(nextWrite)
    }
    if (stored) {
      await withFactoryDb(this.rootDir, async (db) => db.updateWorkflowCheckpoint(stored.recordId, {
        drift: { ...stored.drift, pendingWrites },
      }))
      return
    }
    const drift: StoredCheckpointDrift = {
      kind: "langgraph",
      threadId,
      checkpointNamespace,
      checkpointId: checkpointId as string,
      parentCheckpointId: null,
      metadata: await this.serialize({ source: "loop", step: -1, parents: {} }),
      newVersions: {},
      pendingWrites,
    }
    try {
      await withFactoryDb(this.rootDir, async (db) => db.recordCheckpoint({
        id: checkpointRecordId(this.projectId, threadId, checkpointNamespace, checkpointId as string),
        projectId: this.projectId,
        runId: this.runId,
        label: `langgraph-pending:${checkpointNamespace || "root"}`,
        path: `factory://langgraph/${encodeURIComponent(threadId)}/${encodeURIComponent(checkpointNamespace)}/${checkpointId}`,
        drift,
        state: { checkpoint: null },
      }))
    } catch (error) {
      if (!/UNIQUE constraint failed: checkpoints\.id/u.test(error instanceof Error ? error.message : String(error))) throw error
      const collided = await withFactoryDb(this.rootDir, async (db) => db.listWorkflowCheckpoints(this.projectId, {
        threadId,
        checkpointNamespace,
        checkpointId,
        limit: 1,
      }))
      if (!collided[0]) throw error
      const current = storedParts(collided[0])
      const merged = [...(current.drift.pendingWrites || [])]
      for (const incoming of pendingWrites) {
        const existingIndex = merged.findIndex((candidate) => candidate.taskId === incoming.taskId && candidate.index === incoming.index)
        if (incoming.index >= 0 && existingIndex >= 0) continue
        if (existingIndex >= 0) merged[existingIndex] = incoming
        else merged.push(incoming)
      }
      await withFactoryDb(this.rootDir, async (db) => db.updateWorkflowCheckpoint(current.recordId, {
        drift: { ...current.drift, pendingWrites: merged },
      }))
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    if (!threadId.trim()) throw new Error("factory_langgraph_checkpointer_requires_thread_id")
    await withFactoryDb(this.rootDir, async (db) => db.deleteWorkflowCheckpointThread(this.projectId, threadId))
  }
}
