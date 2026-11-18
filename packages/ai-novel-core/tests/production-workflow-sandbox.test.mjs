import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  createManagedAutonomousProject,
  loadAutonomousState,
  saveAutonomousState,
} from "../dist/index.js"
import { ProductionWorkflowSandboxManager } from "../dist/production-workflow-sandbox.js"
import { FactoryWorkflowTraceRecorder } from "../dist/workflow-kernel.js"

test("production workflow sandbox executes only the current real node without mutating the source project", async () => {
  const factoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "production-workflow-sandbox-"))
  const created = await createManagedAutonomousProject({
    rootDir: factoryRoot,
    title: "沙盒问界",
    idea: "验证单节点调试不会修改正式项目状态",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const sourceState = await loadAutonomousState(created.project.projectRoot)
  sourceState.runtime.stage = "complete"
  sourceState.runtime.statusMessage = "正式项目保持不动"
  sourceState.runtime.lastAction = "source_marker"
  await saveAutonomousState(created.project.projectRoot, sourceState)

  const manager = new ProductionWorkflowSandboxManager(factoryRoot)
  const createdSandbox = await manager.create(created.project.id, "sandbox-complete-node")
  assert.equal(createdSandbox.currentNode.id, "production.complete")
  assert.equal(createdSandbox.manifest.runs.length, 0)

  await assert.rejects(
    () => manager.executeNode("sandbox-complete-node", "production.drafting"),
    /production_workflow_node_not_current/,
  )

  const executed = await manager.executeNode("sandbox-complete-node", "production.complete")
  assert.equal(executed.manifest.status, "ready")
  assert.equal(executed.manifest.runs.length, 1)
  assert.equal(executed.manifest.runs[0].status, "completed")
  assert.equal(executed.manifest.runs[0].beforeStage, "complete")
  assert.equal(executed.manifest.runs[0].afterStage, "complete")
  assert.equal(executed.currentNode.id, "production.complete")
  assert.match(executed.state.runtime.statusMessage, /No advance action is defined/)

  const unchangedSource = await loadAutonomousState(created.project.projectRoot)
  assert.equal(unchangedSource.runtime.statusMessage, "正式项目保持不动")
  assert.equal(unchangedSource.runtime.lastAction, "source_marker")

  const trace = executed.manifest.runs[0].trace
  assert.ok(trace)
  const evidence = await new FactoryWorkflowTraceRecorder(factoryRoot).loadEvidence(trace)
  assert.equal(evidence.run.status, "completed")
  assert.equal(evidence.steps[0].node_id, "production.complete")
  assert.equal(evidence.steps[0].execution_mode, "manual")
})

test("production workflow sandbox exposes setting review and protagonist confirmation gates", async () => {
  const factoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "production-workflow-gates-"))
  const created = await createManagedAutonomousProject({
    rootDir: factoryRoot,
    title: "问界门禁",
    idea: "验证人工设定审批和主角档案只能写入生产沙盒",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const sourceState = await loadAutonomousState(created.project.projectRoot)
  sourceState.runtime.stage = "setting_review"
  await saveAutonomousState(created.project.projectRoot, sourceState)
  await fs.mkdir(path.join(created.project.projectRoot, ".ai-novel", "plans"), { recursive: true })
  await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "plans", "setting-freeze.md"), "# Setting Review\n", "utf8")
  const sourceProtagonistPath = path.join(created.project.projectRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md")
  const sourceProtagonistBefore = await fs.readFile(sourceProtagonistPath, "utf8")

  const manager = new ProductionWorkflowSandboxManager(factoryRoot)
  const sandbox = await manager.create(created.project.id, "sandbox-human-gates")
  assert.equal(sandbox.humanGate.id, "setting-review")
  assert.equal(sandbox.humanGate.status, "required")
  assert.equal(sandbox.canExecuteCurrentNode, false)

  const approved = await manager.approveSettingReview(sandbox.manifest.sandboxId)
  assert.equal(approved.humanGate.id, "protagonist-profile")
  assert.equal(approved.humanGate.status, "required")
  assert.equal(approved.canExecuteCurrentNode, false)

  const confirmed = await manager.confirmProtagonistProfile(sandbox.manifest.sandboxId, {
    name: "陆无良",
    identity: "被太虚枢机标记的破壁者",
    coreDesire: "让九重问界中的生灵获得真实自由",
    fearOrWound: "亲眼看见宗门被格式化却无力阻止",
    behaviorHabit: "行动前在掌心刻下一道印记",
    speechMarker: "紧张时只说名词，愤怒时冷笑后说反话",
    relationshipName: "玄默",
    relationshipPressure: "玄默坚持自由必须以牺牲部分人作为代价",
  })
  assert.equal(confirmed.humanGate.id, "protagonist-profile")
  assert.equal(confirmed.humanGate.status, "approved")
  assert.equal(confirmed.canExecuteCurrentNode, true)

  await assert.rejects(
    fs.access(path.join(created.project.projectRoot, ".ai-novel", "plans", "setting-review-approval.json")),
  )
  assert.equal(await fs.readFile(sourceProtagonistPath, "utf8"), sourceProtagonistBefore)
})

test("production workflow sandbox pauses between story foundation and chapter blueprint nodes", async () => {
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"
  try {
    const factoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "production-planning-sandbox-"))
    const created = await createManagedAutonomousProject({
      rootDir: factoryRoot,
      title: "雨档沙盒",
      idea: "沈渡发现税册记载了一场尚未发生的洪水",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    const sourceState = await loadAutonomousState(created.project.projectRoot)
    sourceState.runtime.stage = "master_planning"
    sourceState.runtime.lastAction = "master_outline_generated"
    await saveAutonomousState(created.project.projectRoot, sourceState)
    await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "plans", "master-outline.md"), [
      "# Master Outline",
      "",
      "## Character Spine",
      "",
      "### 沈渡（主角）",
      "Canonical Protagonist: 沈渡",
      "Canonical Cast: 沈渡、孟迁",
      "",
      "- 沈渡查税册中的未来洪水记录。",
      "- 孟迁用沈渡家人的安全迫使他交出旧档。",
    ].join("\n"), "utf8")

    const manager = new ProductionWorkflowSandboxManager(factoryRoot)
    const sandbox = await manager.create(created.project.id, "planning-two-step-sandbox")
    assert.equal(sandbox.currentNode.id, "production.story-foundation")

    const afterFoundation = await manager.executeNode(sandbox.manifest.sandboxId, "production.story-foundation")
    assert.equal(afterFoundation.state.runtime.stage, "master_planning")
    assert.equal(afterFoundation.currentNode.id, "production.chapter-blueprints")
    assert.equal(afterFoundation.manifest.runs.length, 1)

    const afterBlueprints = await manager.executeNode(sandbox.manifest.sandboxId, "production.chapter-blueprints")
    assert.equal(afterBlueprints.state.runtime.stage, "chapter_task_generation")
    assert.equal(afterBlueprints.currentNode.id, "production.chapter-task-generation")
    assert.equal(afterBlueprints.manifest.runs.length, 2)
    assert.deepEqual(afterBlueprints.manifest.runs.map((run) => run.nodeId), [
      "production.story-foundation",
      "production.chapter-blueprints",
    ])

    const unchangedSource = await loadAutonomousState(created.project.projectRoot)
    assert.equal(unchangedSource.runtime.stage, "master_planning")
    await assert.rejects(
      fs.access(path.join(created.project.projectRoot, ".ai-novel", "plans", "story-bible.md")),
    )
  } finally {
    if (previousTestMode === undefined) delete process.env.AI_NOVEL_TEST_MODE
    else process.env.AI_NOVEL_TEST_MODE = previousTestMode
  }
})
