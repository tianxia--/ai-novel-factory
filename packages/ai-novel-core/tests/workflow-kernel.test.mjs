import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { FactoryDb } from "../dist/index.js"
import { FactoryWorkflowTraceRecorder, WorkflowKernel } from "../dist/workflow-kernel.js"

test("WorkflowKernel uses one registered executor for single-node invocation", async () => {
  const calls = []
  const kernel = new WorkflowKernel()
    .register({
      id: "world-foundation",
      name: "世界观生成",
      stage: "worldbuilding_dialogue",
      version: "v1",
      async execute(context) {
        calls.push(context)
        return { accepted: context.title }
      },
    })

  assert.deepEqual(await kernel.executeNode("world-foundation", { title: "问界" }), { accepted: "问界" })
  assert.deepEqual(calls, [{ title: "问界" }])
  assert.deepEqual(kernel.listNodes(), [{
    id: "world-foundation",
    name: "世界观生成",
    stage: "worldbuilding_dialogue",
    version: "v1",
  }])
  assert.throws(() => kernel.getNode("missing"), /workflow_node_not_registered:missing/)
  assert.throws(() => kernel.register({
    id: "world-foundation",
    name: "重复",
    stage: "worldbuilding_dialogue",
    version: "v2",
    async execute() {},
  }), /workflow_node_already_registered:world-foundation/)
})

test("FactoryWorkflowTraceRecorder persists parent links and full attempt evidence", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-kernel-"))
  const projectRoot = path.join(rootDir, "project-1")
  const createdAt = new Date().toISOString()
  const db = await FactoryDb.open(rootDir)
  try {
    db.upsertProject({
      id: "project-1",
      slug: "project-1",
      title: "调试项目",
      idea: "验证共享执行内核",
      createdAt,
      totalChapters: 100,
      chapterWordTarget: 2500,
      projectRoot,
    }, {
      runtime: { stage: "world_building", autopilot: { running: false } },
    })
  } finally {
    db.close()
  }

  const recorder = new FactoryWorkflowTraceRecorder(rootDir)
  const worldNode = {
    id: "world-foundation",
    name: "世界观生成",
    stage: "worldbuilding_dialogue",
    version: "v1",
  }
  const worldTrace = await recorder.initialize({
    projectId: "project-1",
    externalRunId: "world-1",
    node: worldNode,
    input: { title: "问界" },
    executionMode: "debug",
    metadata: { isolated: true },
  })
  const resumedTrace = await recorder.initialize({
    projectId: "project-1",
    externalRunId: "world-1",
    node: worldNode,
    input: { title: "问界" },
    executionMode: "debug",
  })
  assert.equal(resumedTrace.runId, worldTrace.runId)
  assert.equal(resumedTrace.stepId, worldTrace.stepId)
  await recorder.sync(worldTrace, worldNode, {
    status: "running",
    metadata: { phase: "generate" },
  })
  await recorder.recordAttempt(worldTrace, {
    kind: "generate",
    modelName: "model-a",
    promptVersion: "prompt-v1",
    input: { prompt: "create world" },
    output: { response: "world" },
    usage: { promptTokens: 12, completionTokens: 8 },
  })
  await recorder.sync(worldTrace, worldNode, {
    status: "completed",
    output: { world: "完整世界" },
    validation: { valid: true, errors: [], warnings: [] },
  })

  const childNode = {
    id: "character-planning",
    name: "人物规划",
    stage: "setting_review",
    version: "v1",
  }
  const childTrace = await recorder.initialize({
    projectId: "project-1",
    externalRunId: "characters-1",
    node: childNode,
    input: { upstreamRunId: "world-1" },
    executionMode: "manual",
    parentRunId: worldTrace.runId,
    parentStepId: worldTrace.stepId,
  })

  const evidence = await recorder.loadEvidence(worldTrace)
  const childEvidence = await recorder.loadEvidence(childTrace)
  assert.equal(evidence.run.status, "completed")
  assert.equal(evidence.steps[0].node_id, "world-foundation")
  assert.equal(evidence.steps[0].node_version, "v1")
  assert.equal(evidence.steps[0].validation_status, "passed")
  assert.deepEqual(evidence.attempts.map((attempt) => attempt.kind), ["generate", "validate"])
  assert.equal(childEvidence.run.parent_run_id, worldTrace.runId)
  assert.equal(childEvidence.steps[0].parent_step_id, worldTrace.stepId)
  assert.equal(childEvidence.steps[0].execution_mode, "manual")
  assert.equal(childTrace.runId, "manual_characters-1")
})
