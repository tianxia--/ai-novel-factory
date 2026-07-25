import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { FactoryDb } from "../dist/index.js"
import { FactoryWorkflowDebugBranchManager, diffWorkflowState } from "../dist/workflow-debug-branch.js"
import { FactoryWorkflowTraceRecorder } from "../dist/workflow-kernel.js"

async function prepareProject() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-debug-branch-"))
  const db = await FactoryDb.open(rootDir)
  try {
    db.upsertProject({
      id: "project-1",
      slug: "project-1",
      title: "问界",
      idea: "验证调试分支",
      createdAt: new Date().toISOString(),
      totalChapters: 100,
      chapterWordTarget: 2500,
      projectRoot: path.join(rootDir, "project-1"),
    }, {
      runtime: { stage: "world_building", autopilot: { running: false } },
    })
  } finally {
    db.close()
  }
  return rootDir
}

test("diffWorkflowState reports nested add, remove and replace operations", () => {
  assert.deepEqual(diffWorkflowState({ a: 1, nested: { keep: true, remove: 2 }, list: [1] }, {
    a: 2,
    nested: { keep: true, add: 3 },
    list: [1, 2],
  }), [
    { operation: "replace", path: "/a", before: 1, after: 2 },
    { operation: "add", path: "/list/1", after: 2 },
    { operation: "add", path: "/nested/add", after: 3 },
    { operation: "remove", path: "/nested/remove", before: 2 },
  ])
})

test("debug branch persists isolated history, diff and rollback checkpoints", async () => {
  const rootDir = await prepareProject()
  const manager = new FactoryWorkflowDebugBranchManager(rootDir, "project-1")
  const reference = await manager.create({
    branchId: "debug-run-1",
    nodeId: "world-foundation",
    runId: null,
    baseState: { world: "base", revision: 0 },
  })
  await manager.append(reference, { world: "candidate-a", revision: 1 }, { label: "generated" })
  const firstCandidateCheckpoint = reference.lastCheckpointId
  await manager.append(reference, { world: "candidate-b", revision: 2 }, { label: "repaired" })

  const beforeRollback = await manager.inspect(reference)
  assert.equal(beforeRollback.history.length, 3)
  assert.equal(beforeRollback.latest.state.world, "candidate-b")
  assert.deepEqual(beforeRollback.diff, [
    { operation: "replace", path: "/revision", before: 0, after: 2 },
    { operation: "replace", path: "/world", before: "base", after: "candidate-b" },
  ])

  await manager.rollback(reference, firstCandidateCheckpoint)
  const restoredManager = new FactoryWorkflowDebugBranchManager(rootDir, "project-1")
  const afterRollback = await restoredManager.inspect(reference)
  assert.equal(afterRollback.history.length, 4)
  assert.deepEqual(afterRollback.latest.state, { world: "candidate-a", revision: 1 })
  assert.equal(afterRollback.latest.metadata.label, "rollback")
  assert.equal(afterRollback.latest.metadata.rolledBackTo, firstCandidateCheckpoint)
})

test("debug branch promotion uses an explicit applier and records a promote attempt", async () => {
  const rootDir = await prepareProject()
  const recorder = new FactoryWorkflowTraceRecorder(rootDir)
  const trace = await recorder.initialize({
    projectId: "project-1",
    externalRunId: "promotion-1",
    node: { id: "world-foundation", name: "世界观生成", stage: "worldbuilding_dialogue", version: "v1" },
    input: { title: "问界" },
    executionMode: "debug",
  })
  const manager = new FactoryWorkflowDebugBranchManager(rootDir, "project-1")
  const reference = await manager.create({
    branchId: "promotion-1",
    nodeId: "world-foundation",
    runId: trace.runId,
    baseState: { revision: 0 },
  })
  await manager.append(reference, { revision: 1, world: "candidate" }, { label: "validated" })
  let applied = null
  const promoted = await manager.promote(reference, trace, async (state, diff) => {
    applied = { state, diff }
    return { artifact: "world-foundation.json", version: 1 }
  })

  assert.deepEqual(applied.state, { revision: 1, world: "candidate" })
  assert.equal(promoted.result.version, 1)
  const evidence = await recorder.loadEvidence(trace)
  assert.deepEqual(evidence.attempts.map((attempt) => attempt.kind), ["promote"])
  const branch = await manager.inspect(reference)
  assert.equal(branch.latest.metadata.label, "promoted")
})
