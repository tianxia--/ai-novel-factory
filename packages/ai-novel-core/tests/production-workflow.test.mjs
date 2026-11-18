import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { FactoryDb } from "../dist/index.js"
import {
  ObservableProductionWorkflowRunner,
  executeProductionAdvanceThroughKernel,
  listProductionWorkflowNodes,
  resolveProductionWorkflowNode,
} from "../dist/production-workflow.js"
import { FactoryWorkflowTraceRecorder } from "../dist/workflow-kernel.js"

function initialState() {
  return {
    project: { title: "问界", idea: "世界存在可偿还的裂缝" },
    runtime: {
      stage: "worldbuilding_dialogue",
      lastAction: "created",
      statusMessage: "等待世界构建",
    },
    reactSetup: {},
    plan: {
      pendingChapters: 2,
      chapterTasks: [
        { chapterNumber: 1, title: "裂缝", status: "pending" },
        { chapterNumber: 2, title: "代价", status: "pending" },
      ],
    },
    assets: {},
  }
}

async function prepareProject(rootDir) {
  const projectRoot = path.join(rootDir, "project-1")
  const db = await FactoryDb.open(rootDir)
  try {
    db.upsertProject({
      id: "project-1",
      slug: "project-1",
      title: "问界",
      idea: "验证生产流程兼容桥",
      createdAt: new Date().toISOString(),
      totalChapters: 2,
      chapterWordTarget: 2500,
      projectRoot,
    }, {
      runtime: { stage: "world_building", autopilot: { running: false } },
    })
  } finally {
    db.close()
  }
  return projectRoot
}

test("production catalog covers every current state-machine stage", () => {
  const stages = listProductionWorkflowNodes().map((node) => node.stage)
  assert.deepEqual(stages, [
    "worldbuilding_dialogue",
    "setting_review",
    "master_planning",
    "chapter_task_generation",
    "drafting",
    "aigc_refinement",
    "reviewing",
    "replanning",
    "complete",
  ])
  assert.equal(resolveProductionWorkflowNode("drafting").id, "production.drafting")
})

test("manual and automatic execution invoke the same production node implementation", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "production-workflow-"))
  const projectRoot = await prepareProject(rootDir)
  const calls = []
  const runner = new ObservableProductionWorkflowRunner(rootDir, async (context) => {
    calls.push({ mode: context.executionMode, stage: context.state.runtime.stage })
    return {
      ...context.state,
      runtime: {
        ...context.state.runtime,
        stage: "setting_review",
        lastAction: "worldbuilding_completed",
      },
    }
  })
  const shared = {
    rootDir: projectRoot,
    factoryRootDir: rootDir,
    projectId: "project-1",
    state: initialState(),
  }
  const automatic = await runner.execute({ ...shared, executionMode: "production" }, "auto-1")
  const manual = await runner.execute({ ...shared, state: initialState(), executionMode: "manual" }, "manual-1")

  assert.deepEqual(calls, [
    { mode: "production", stage: "worldbuilding_dialogue" },
    { mode: "manual", stage: "worldbuilding_dialogue" },
  ])
  assert.equal(automatic.state.runtime.stage, "setting_review")
  assert.equal(manual.state.runtime.stage, "setting_review")
  const recorder = new FactoryWorkflowTraceRecorder(rootDir)
  const automaticEvidence = await recorder.loadEvidence(automatic.trace)
  const manualEvidence = await recorder.loadEvidence(manual.trace)
  assert.equal(automaticEvidence.steps[0].node_id, "production.worldbuilding")
  assert.equal(automaticEvidence.steps[0].execution_mode, "production")
  assert.equal(manualEvidence.steps[0].node_id, "production.worldbuilding")
  assert.equal(manualEvidence.steps[0].execution_mode, "manual")
  assert.deepEqual(automaticEvidence.attempts.map((attempt) => attempt.kind), ["generate", "validate"])
})

test("production compatibility bridge records a failed transition before rethrowing", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "production-workflow-failure-"))
  const projectRoot = await prepareProject(rootDir)
  const runner = new ObservableProductionWorkflowRunner(rootDir, async () => {
    throw new Error("transition_failed")
  })
  await assert.rejects(() => runner.execute({
    rootDir: projectRoot,
    factoryRootDir: rootDir,
    projectId: "project-1",
    state: initialState(),
    executionMode: "production",
  }, "failed-1"), /transition_failed/)

  const trace = {
    projectId: "project-1",
    runId: "production_failed-1",
    stepId: "step_failed-1",
    attemptCount: 1,
    lastSyncedStatus: "failed",
  }
  const evidence = await new FactoryWorkflowTraceRecorder(rootDir).loadEvidence(trace)
  assert.equal(evidence.run.status, "failed")
  assert.equal(evidence.steps[0].status, "failed")
  assert.equal(evidence.attempts[0].kind, "validate")
  assert.equal(evidence.attempts[0].status, "failed")
})

test("production rollout seam keeps legacy behavior until explicitly enabled", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "production-workflow-rollout-"))
  const projectRoot = await prepareProject(rootDir)
  let calls = 0
  const executeAdvance = async () => {
    calls += 1
    return { ...initialState(), runtime: { ...initialState().runtime, stage: "setting_review" } }
  }
  const context = {
    rootDir: projectRoot,
    factoryRootDir: rootDir,
    projectId: "project-1",
    state: initialState(),
    executionMode: "production",
  }

  const legacy = await executeProductionAdvanceThroughKernel({ ...context, enabled: false }, executeAdvance)
  assert.equal(legacy.trace, null)
  assert.equal(legacy.state.runtime.stage, "setting_review")

  const observed = await executeProductionAdvanceThroughKernel({
    ...context,
    enabled: true,
    externalRunId: "rollout-1",
  }, executeAdvance)
  const restored = await executeProductionAdvanceThroughKernel({
    ...context,
    enabled: true,
    externalRunId: "rollout-1",
  }, executeAdvance)
  assert.equal(observed.trace.runId, "production_rollout-1")
  assert.equal(restored.trace.runId, observed.trace.runId)
  assert.equal(restored.state.runtime.stage, "setting_review")
  assert.equal(calls, 2)
  const evidence = await new FactoryWorkflowTraceRecorder(rootDir).loadEvidence(observed.trace)
  assert.equal(evidence.run.status, "completed")
  const db = await FactoryDb.open(rootDir)
  try {
    const checkpoints = db.getSnapshot("project-1").checkpoints
    assert.ok(checkpoints.length >= 3)
    assert.ok(checkpoints.every((entry) => String(entry.drift_json).includes('"kind":"langgraph"')))
  } finally {
    db.close()
  }
})
