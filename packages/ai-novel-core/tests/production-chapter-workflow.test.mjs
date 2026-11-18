import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  acceptStyleEvolutionCandidate,
  appendStyleEvolutionCandidate,
  approveStyleEvolutionSample,
  createManagedAutonomousProject,
  initializeStyleEvolution,
  loadAutonomousState,
  saveAutonomousState,
} from "../dist/index.js"
import {
  executeProductionChapterNode,
  inspectProductionChapterNode,
} from "../dist/production-chapter-workflow.js"
import {
  executeProductionPlanningNode,
} from "../dist/production-planning-workflow.js"
import { ProductionWorkflowSandboxManager } from "../dist/production-workflow-sandbox.js"
import { FactoryWorkflowTraceRecorder } from "../dist/workflow-kernel.js"

function readyEvaluation() {
  return {
    source: "llm_critic",
    verdict: "approve",
    summary: "测试写法已经满足正文生产要求。",
    scores: {
      narrativeVoice: 9,
      sentenceRhythm: 9,
      dialogueTexture: 9,
      informationDensity: 9,
      emotionalTension: 9,
      readability: 9,
      requirementAlignment: 9,
      forbiddenPatternRisk: 0.2,
      overall: 9,
    },
    strengths: ["动作与物件推进明确。"],
    deviations: [],
    forbiddenHits: [],
    nextFocus: ["保持短对白。"],
    aigc: {
      enabled: true,
      status: "passed",
      score: 0.1,
      threshold: 0.8,
      highRiskCount: 0,
      reason: "test fixture",
      highRiskPreviews: [],
    },
  }
}

async function approveWritingStyle(projectRoot) {
  await initializeStyleEvolution(projectRoot, {
    projectTitle: "雨档",
    idea: "尚未发生的洪水被提前写进税册",
    userStylePrompt: "克制冷感，动作与物件推进。",
  })
  await appendStyleEvolutionCandidate(projectRoot, {
    prompt: "测试冻结样段",
    sample: "雨线挂在门槛外。沈渡把缺页账本推到灯下，纸边齐得发亮。",
    review: "测试夹具已验证。",
    evaluation: readyEvaluation(),
    refinement: {
      source: "llm_critic",
      summary: "保持当前方向。",
      promptAdjustments: ["继续保持短对白。"],
      contractAdjustments: ["冻结动作先行约束。"],
      nextPrompt: "用动作、物件和短对白推进悬疑压力。",
    },
    freezer: {
      verdict: "ready",
      summary: "样段可以冻结为全书写法。",
      blockingReasons: [],
      checkedAt: "2026-07-19T00:00:00.000Z",
    },
  })
  await acceptStyleEvolutionCandidate(projectRoot, {
    version: 1,
    acceptedAt: "2026-07-19T00:00:00.000Z",
  })
  await approveStyleEvolutionSample(projectRoot, {
    version: 1,
    approvedAt: "2026-07-19T00:00:00.000Z",
    styleContract: {
      voice: "克制冷感，动作和物件先于解释。",
      sentenceRhythm: "短动作句与中句承接后果。",
      dialogueRules: ["对白短，不解释背景。"],
      descriptionRules: ["先物件、声音和身体反应。"],
      emotionRules: ["情绪通过选择和动作外化。"],
      pacingRules: ["每段推进线索、关系或代价。"],
      povRules: ["保持第三人称限知视角。"],
      openingRules: ["开场落在具体现场压力。"],
      endingHookRules: ["结尾留下可追踪问题。"],
      allowedDevices: ["动作推进", "物件压迫", "短对白"],
      forbiddenPatterns: ["解释创作意图", "总结式升华", "同质化对白"],
      positiveExamples: ["沈渡合上账册，只问了一句：谁动过这一页？"],
      negativeExamples: [],
    },
  })
}

test("drafting runs context/draft and quality as resumable production nodes", async () => {
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"
  try {
    const factoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "production-chapter-nodes-"))
    const created = await createManagedAutonomousProject({
      rootDir: factoryRoot,
      title: "雨档",
      idea: "档案小吏沈砚发现灾年税册记录了一场尚未发生的洪水",
      totalChapters: 2,
      chapterWordTarget: 3000,
    })
    const projectRoot = created.project.projectRoot
    const initialState = await loadAutonomousState(projectRoot)
    initialState.runtime.stage = "master_planning"
    initialState.runtime.lastAction = "master_outline_generated"
    await saveAutonomousState(projectRoot, initialState)
    await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "master-outline.md"), [
      "# Master Outline",
      "",
      "## Character Spine",
      "",
      "### 沈砚（主角）",
      "Canonical Protagonist: 沈砚",
      "Canonical Cast: 沈砚、孟迁",
      "",
      "- 沈砚要查清尚未发生的洪水记录，却会因此失去档案官身份。",
      "- 孟迁掌握旧税册来源，并以沈砚家人的安全施压。",
    ].join("\n"), "utf8")

    const planningContext = {
      projectRoot,
      factoryRootDir: factoryRoot,
      projectId: created.project.id,
      state: initialState,
      options: { preferDeterministicPlanning: true },
      metadata: { test: true },
    }
    await executeProductionPlanningNode(planningContext, "production.story-foundation", "chapter-test-foundation")
    const foundationState = await loadAutonomousState(projectRoot)
    await executeProductionPlanningNode({ ...planningContext, state: foundationState }, "production.chapter-blueprints", "chapter-test-blueprints")
    await approveWritingStyle(projectRoot)

    const draftingState = await loadAutonomousState(projectRoot)
    draftingState.runtime.stage = "drafting"
    draftingState.runtime.lastAction = "production_readiness_confirmed"
    await saveAutonomousState(projectRoot, draftingState)

    const sandboxManager = new ProductionWorkflowSandboxManager(factoryRoot)
    const sandbox = await sandboxManager.create(created.project.id, "chapter-draft-isolation")
    assert.equal(sandbox.currentNode.id, "production.chapter-draft")
    const sandboxDraft = await sandboxManager.executeNode(sandbox.manifest.sandboxId, "production.chapter-draft")
    assert.equal(sandboxDraft.currentNode.id, "production.chapter-quality")
    await fs.access(path.join(sandbox.manifest.sandboxRoot, ".ai-novel", "checkpoints", "chapter-001", "draft.md"))
    await assert.rejects(fs.access(path.join(projectRoot, ".ai-novel", "checkpoints", "chapter-001", "draft.md")))
    const sourceAfterSandboxDraft = await loadAutonomousState(projectRoot)
    assert.equal(sourceAfterSandboxDraft.runtime.lastAction, "production_readiness_confirmed")

    const firstInspection = await inspectProductionChapterNode(projectRoot, draftingState)
    assert.equal(firstInspection.currentNode.id, "production.chapter-draft")
    assert.equal(firstInspection.chapterNumber, 1)

    const context = {
      projectRoot,
      factoryRootDir: factoryRoot,
      projectId: created.project.id,
      state: draftingState,
      chapterNumber: 1,
      options: { writingMode: "quality" },
      metadata: { test: true },
    }
    const draft = await executeProductionChapterNode(context, "production.chapter-draft", "chapter-draft-1")
    assert.equal(draft.state.runtime.stage, "drafting")
    assert.equal(draft.state.runtime.lastAction, "chapter_draft_generated:1")
    const draftText = await fs.readFile(path.join(projectRoot, ".ai-novel", "checkpoints", "chapter-001", "draft.md"), "utf8")
    assert.ok(draftText.trim().length > 0)

    const restoredDraft = await executeProductionChapterNode(context, "production.chapter-draft", "chapter-draft-1")
    assert.equal(restoredDraft.trace.runId, draft.trace.runId)

    const qualityState = await loadAutonomousState(projectRoot)
    const secondInspection = await inspectProductionChapterNode(projectRoot, qualityState)
    assert.equal(secondInspection.currentNode.id, "production.chapter-quality")
    const quality = await executeProductionChapterNode(
      { ...context, state: qualityState },
      "production.chapter-quality",
      "chapter-quality-1",
    )
    assert.equal(quality.state.runtime.stage, "drafting")
    assert.equal(quality.state.runtime.lastAction, "chapter_quality_completed:1")
    const qualityCheckpoint = JSON.parse(await fs.readFile(
      path.join(projectRoot, ".ai-novel", "checkpoints", "chapter-001", "quality.json"),
      "utf8",
    ))
    assert.equal(qualityCheckpoint.chapterNumber, 1)
    assert.ok(["passed", "warning", "blocked"].includes(qualityCheckpoint.gate.status))

    const naturalnessState = await loadAutonomousState(projectRoot)
    const thirdInspection = await inspectProductionChapterNode(projectRoot, naturalnessState)
    assert.equal(thirdInspection.currentNode.id, "production.chapter-naturalness")
    const naturalness = await executeProductionChapterNode(
      { ...context, state: naturalnessState },
      "production.chapter-naturalness",
      "chapter-naturalness-1",
    )
    assert.equal(naturalness.state.runtime.stage, "drafting")
    assert.equal(naturalness.state.runtime.lastAction, "chapter_naturalness_completed:1")
    const naturalnessCheckpoint = JSON.parse(await fs.readFile(
      path.join(projectRoot, ".ai-novel", "checkpoints", "chapter-001", "naturalness.json"),
      "utf8",
    ))
    assert.ok(naturalnessCheckpoint.finalDraft.trim().length > 0)
    assert.ok(["passed", "warning", "blocked"].includes(naturalnessCheckpoint.finalGate.status))

    const commitState = await loadAutonomousState(projectRoot)
    const fourthInspection = await inspectProductionChapterNode(projectRoot, commitState)
    assert.equal(fourthInspection.currentNode.id, "production.chapter-commit")
    const committed = await executeProductionChapterNode(
      { ...context, state: commitState },
      "production.chapter-commit",
      "chapter-commit-1",
    )
    const expectedBlocked = naturalnessCheckpoint.finalGate.status === "blocked"
    assert.equal(expectedBlocked, false, naturalnessCheckpoint.finalGate.reason)
    assert.equal(committed.state.plan.chapterTasks[0].status, expectedBlocked ? "blocked" : "complete")
    assert.equal(committed.state.runtime.stage, expectedBlocked ? "reviewing" : "drafting")
    await fs.access(path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.final.md"))
    await fs.access(path.join(projectRoot, ".ai-novel", "memory", "chapter-001-memory.md"))
    await fs.access(path.join(projectRoot, ".ai-novel", "checkpoints", "chapter-001", "commit.json"))
    if (!expectedBlocked) {
      const chapterTwoInspection = await inspectProductionChapterNode(projectRoot, committed.state)
      assert.equal(chapterTwoInspection.chapterNumber, 2)
      assert.equal(chapterTwoInspection.currentNode.id, "production.chapter-draft")
      const chapterTwoDraft = await executeProductionChapterNode({
        ...context,
        state: committed.state,
        chapterNumber: 2,
      }, "production.chapter-draft", "chapter-draft-2")
      assert.equal(chapterTwoDraft.state.runtime.lastAction, "chapter_draft_generated:2")
      const chapterTwoText = await fs.readFile(
        path.join(projectRoot, ".ai-novel", "checkpoints", "chapter-002", "draft.md"),
        "utf8",
      )
      assert.ok(chapterTwoText.trim().length > 0)
    }

    const recorder = new FactoryWorkflowTraceRecorder(factoryRoot)
    const draftEvidence = await recorder.loadEvidence(draft.trace)
    const qualityEvidence = await recorder.loadEvidence(quality.trace)
    assert.equal(draftEvidence.steps[0].node_id, "production.chapter-draft")
    assert.equal(qualityEvidence.steps[0].node_id, "production.chapter-quality")
    assert.equal(JSON.parse(draftEvidence.attempts[0].input_json).lastAction, "production_readiness_confirmed")
    assert.equal(JSON.parse(draftEvidence.attempts[0].output_json).lastAction, "chapter_draft_generated:1")
  } finally {
    if (previousTestMode === undefined) delete process.env.AI_NOVEL_TEST_MODE
    else process.env.AI_NOVEL_TEST_MODE = previousTestMode
  }
})
