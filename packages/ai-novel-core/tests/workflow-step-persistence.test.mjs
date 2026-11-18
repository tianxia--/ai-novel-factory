import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { FactoryDb } from "../dist/index.js"

test("workflow step and attempt records persist without changing legacy run behavior", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-step-persistence-"))
  const db = await FactoryDb.open(rootDir)
  const createdAt = new Date().toISOString()
  try {
    db.upsertProject({
      id: "project-1",
      slug: "project-1",
      title: "调试项目",
      idea: "验证节点证据链",
      createdAt,
      totalChapters: 100,
      chapterWordTarget: 2500,
      projectRoot: path.join(rootDir, "project-1"),
    }, {
      runtime: { stage: "world_building", autopilot: { running: false } },
    })
    db.createRun({
      id: "run-1",
      projectId: "project-1",
      projectRoot: path.join(rootDir, "project-1"),
      kind: "workflow_advance",
      status: "running",
      goal: "单点验证世界观节点",
      stage: "world_building",
    })
    db.createWorkflowStep({
      id: "step-1",
      runId: "run-1",
      projectId: "project-1",
      name: "世界观生成",
      nodeId: "world-foundation",
      nodeVersion: "v1",
      stage: "world_building",
      status: "in_progress",
      executionMode: "debug",
      input: { title: "问界" },
      metadata: { isolated: true },
    })
    db.createWorkflowStepAttempt({
      id: "attempt-1",
      stepId: "step-1",
      runId: "run-1",
      projectId: "project-1",
      attempt: 1,
      kind: "generate",
      status: "in_progress",
      modelName: "model-a",
      promptVersion: "prompt-v1",
      input: { promptChars: 1200 },
    })
    db.updateWorkflowStepAttempt("attempt-1", "completed", {
      output: { responseChars: 5000 },
      usage: { inputTokens: 800, outputTokens: 1200 },
    })
    db.updateWorkflowStep("step-1", "completed", {
      output: { artifact: "world-foundation.json" },
      validationStatus: "passed",
    })

    const steps = db.listWorkflowSteps("run-1")
    const attempts = db.listWorkflowStepAttempts("step-1")
    const workflowRun = db.getWorkflowRun("run-1")
    assert.equal(workflowRun.id, "run-1")
    assert.equal(steps.length, 1)
    assert.equal(steps[0].node_id, "world-foundation")
    assert.equal(steps[0].execution_mode, "debug")
    assert.equal(steps[0].validation_status, "passed")
    assert.equal(attempts.length, 1)
    assert.equal(attempts[0].kind, "generate")
    assert.equal(attempts[0].status, "completed")
    assert.match(String(attempts[0].usage_json), /inputTokens/)
  } finally {
    db.close()
  }
})
