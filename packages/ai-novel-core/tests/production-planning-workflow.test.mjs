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
import {
  executeProductionPlanningNode,
  inspectProductionPlanningNode,
} from "../dist/production-planning-workflow.js"
import { FactoryWorkflowTraceRecorder } from "../dist/workflow-kernel.js"

test("master planning runs story foundation and chapter blueprints as two durable production nodes", async () => {
  const factoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "production-planning-nodes-"))
  const created = await createManagedAutonomousProject({
    rootDir: factoryRoot,
    title: "雨档",
    idea: "档案小吏沈渡发现灾年税册记录了一场尚未发生的洪水",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const projectRoot = created.project.projectRoot
  const state = await loadAutonomousState(projectRoot)
  state.runtime.stage = "master_planning"
  state.runtime.lastAction = "master_outline_generated"
  await saveAutonomousState(projectRoot, state)
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "master-outline.md"), [
    "# Master Outline",
    "",
    "## Character Spine",
    "",
    "### 沈渡（主角）",
    "Canonical Protagonist: 沈渡",
    "Canonical Cast: 沈渡、孟迁",
    "",
    "- 沈渡要查清尚未发生的洪水记录，却会因此失去档案官身份。",
    "- 孟迁掌握旧税册来源，并以沈渡家人的安全施压。",
  ].join("\n"), "utf8")

  const firstInspection = await inspectProductionPlanningNode(projectRoot, state)
  assert.equal(firstInspection.currentNode.id, "production.story-foundation")
  assert.ok(firstInspection.missingFoundationArtifacts.length > 0)

  const shared = {
    projectRoot,
    factoryRootDir: factoryRoot,
    projectId: created.project.id,
    state,
    options: { preferDeterministicPlanning: true },
    metadata: { test: true },
  }
  const foundation = await executeProductionPlanningNode(shared, "production.story-foundation", "planning-foundation-1")
  assert.equal(foundation.state.runtime.stage, "master_planning")
  assert.equal(foundation.state.runtime.lastAction, "story_foundation_generated")
  await fs.access(path.join(projectRoot, ".ai-novel", "plans", "story-bible.md"))
  await fs.access(path.join(projectRoot, ".ai-novel", "plans", "story-foundation-contract.json"))

  const restoredFoundation = await executeProductionPlanningNode(shared, "production.story-foundation", "planning-foundation-1")
  assert.equal(restoredFoundation.trace.runId, foundation.trace.runId)

  const secondState = await loadAutonomousState(projectRoot)
  const secondInspection = await inspectProductionPlanningNode(projectRoot, secondState)
  assert.equal(secondInspection.currentNode.id, "production.chapter-blueprints")
  assert.deepEqual(secondInspection.missingBlueprintChapters, [1, 2])

  const blueprints = await executeProductionPlanningNode({ ...shared, state: secondState }, "production.chapter-blueprints", "planning-blueprints-1")
  assert.equal(blueprints.state.runtime.stage, "chapter_task_generation")
  assert.equal(blueprints.state.runtime.lastAction, "chapter_blueprints_generated")
  await fs.access(path.join(projectRoot, ".ai-novel", "plans", "chapter-blueprints", "chapter-001.md"))
  await fs.access(path.join(projectRoot, ".ai-novel", "plans", "chapter-blueprints", "chapter-002.md"))

  const recorder = new FactoryWorkflowTraceRecorder(factoryRoot)
  const foundationEvidence = await recorder.loadEvidence(foundation.trace)
  const blueprintEvidence = await recorder.loadEvidence(blueprints.trace)
  assert.equal(foundationEvidence.steps[0].node_id, "production.story-foundation")
  assert.equal(blueprintEvidence.steps[0].node_id, "production.chapter-blueprints")
  assert.deepEqual(foundationEvidence.attempts.map((attempt) => attempt.kind), ["generate", "validate"])
  assert.deepEqual(blueprintEvidence.attempts.map((attempt) => attempt.kind), ["generate", "validate"])
})
