import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  chapterBlueprintLearningShouldStop,
  classifyChapterBlueprintError,
  compileChapterBlueprintLearningPrompt,
  deriveChapterBlueprintProjectIdentity,
  loadChapterBlueprintLearningContext,
  recordChapterBlueprintLearningAttempt,
} from "../dist/chapter-blueprint-learning.js"

function storyBible(title, protagonist) {
  return {
    project: {
      title,
      genre: "玄幻",
      protagonist,
      logline: `${protagonist}必须支付能力代价并保持跨批次状态连续。`,
    },
  }
}

test("chapter blueprint learning keeps stable, isolated novel identities", () => {
  const first = deriveChapterBlueprintProjectIdentity(storyBible("问界", "陆无良"))
  const repeated = deriveChapterBlueprintProjectIdentity(storyBible("问界", "陆无良"))
  const another = deriveChapterBlueprintProjectIdentity(storyBible("星海", "林舟"))
  assert.equal(first.projectId, repeated.projectId)
  assert.notEqual(first.projectId, another.projectId)
  assert.match(first.projectLabel, /问界/)
})

test("chapter blueprint errors are abstracted into reusable fingerprints", () => {
  const cost = classifyChapterBlueprintError("第93章 TERMINOLOGY_AND_COST_VIOLATION：墟种被激活但未扣除三年寿命。")
  const state = classifyChapterBlueprintError("第91章 CROSS_BATCH_STATE_RESET：庇护期凭空增加。")
  assert.equal(cost.fingerprint, "ability_cost_not_applied")
  assert.equal(state.fingerprint, "cross_batch_state_reset")
  assert.doesNotMatch(cost.instruction, /陆无良|墟种/)
})

test("learning memory separates project content while sharing abstract system experience", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "chapter-blueprint-learning-"))
  const firstBible = storyBible("问界", "陆无良")
  let first = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: firstBible,
    modelName: "model-a",
    runId: "run-a",
    stateLedger: [{
      runId: "batch-a",
      volumeId: "volume_01",
      startChapter: 1,
      endChapter: 10,
      batchExitState: "陆无良位于墟境，庇护期继续减少。",
      unresolvedRisks: ["倒计时"],
      endingHook: "继续前进",
      nextChapterEntryState: "保持当前位置",
      nextChapterHandoff: "进入第11章",
    }],
  })
  first = await recordChapterBlueprintLearningAttempt({
    rootDir,
    context: first,
    runId: "run-a",
    round: 1,
    beforeErrors: ["第11章 CROSS_BATCH_STATE_RESET：庇护期凭空增加。"],
    afterErrors: [],
    passed: true,
  })
  assert.equal(first.attempts.at(-1).resolvedFingerprints[0], "cross_batch_state_reset")
  assert.equal(new Set(first.activeExperiences.map((entry) => entry.fingerprint)).size, first.activeExperiences.length)
  const systemText = await fs.readFile(first.memoryPaths.system, "utf8")
  assert.doesNotMatch(systemText, /陆无良|墟境|庇护期继续减少/)

  const second = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: storyBible("星海", "林舟"),
    modelName: "model-a",
    runId: "run-b",
  })
  assert.equal(second.stateLedger.length, 0)
  assert.ok(second.activeExperiences.some((entry) => entry.fingerprint === "cross_batch_state_reset"))
  assert.match(compileChapterBlueprintLearningPrompt(first), /小说记忆空间/)
})

test("learning loop does not confuse sequentially resolved constraints with a simultaneous canon conflict", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "chapter-blueprint-conflict-"))
  let context = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: storyBible("问界", "陆无良"),
    modelName: "model-a",
    runId: "run-conflict",
  })
  context = await recordChapterBlueprintLearningAttempt({
    rootDir,
    context,
    runId: "run-conflict",
    round: 1,
    beforeErrors: ["第100章 FORBIDDEN_DRIFT_VIOLATION：庇护期内禁止离开墟境。"],
    afterErrors: ["第100章 ARC_BOUNDARY_EARLY：弧末必须进入第八层。"],
    passed: false,
  })
  const decision = chapterBlueprintLearningShouldStop(context, "run-conflict")
  assert.equal(decision.stop, false)
})

test("learning loop stops when one candidate simultaneously violates incompatible canon constraints", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "chapter-blueprint-conflict-simultaneous-"))
  let context = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: storyBible("问界", "陆无良"),
    modelName: "model-a",
    runId: "run-conflict",
  })
  context = await recordChapterBlueprintLearningAttempt({
    rootDir,
    context,
    runId: "run-conflict",
    round: 1,
    beforeErrors: [],
    afterErrors: [
      "第100章 FORBIDDEN_DRIFT_VIOLATION：庇护期内禁止离开墟境。",
      "第100章 ARC_BOUNDARY_EARLY：弧末必须进入第八层。",
    ],
    passed: false,
  })
  const decision = chapterBlueprintLearningShouldStop(context, "run-conflict")
  assert.equal(decision.stop, true)
  assert.match(decision.reason, /正典冲突/)
})

test("learning prompt version changes only when effective prompt experience changes", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "chapter-blueprint-prompt-version-"))
  const first = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: storyBible("问界", "陆无良"),
    modelName: "model-a",
    runId: "run-a",
  })
  const repeated = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: storyBible("问界", "陆无良"),
    modelName: "model-a",
    runId: "run-b",
  })
  assert.equal(first.promptVersion, repeated.promptVersion)
})

test("learning loop keeps repairing beyond three rounds and stops after sustained no progress", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "chapter-blueprint-no-progress-"))
  let context = await loadChapterBlueprintLearningContext({
    rootDir,
    storyBible: storyBible("问界", "陆无良"),
    modelName: "model-a",
    runId: "run-no-progress",
  })
  for (let round = 1; round <= 4; round += 1) {
    context = await recordChapterBlueprintLearningAttempt({
      rootDir,
      context,
      runId: "run-no-progress",
      round,
      beforeErrors: ["第11章 CROSS_BATCH_STATE_RESET：上一批退出状态被重置。"],
      afterErrors: ["第11章 CROSS_BATCH_STATE_RESET：上一批退出状态被重置。"],
      passed: false,
    })
    assert.equal(chapterBlueprintLearningShouldStop(context, "run-no-progress").stop, false)
  }
  context = await recordChapterBlueprintLearningAttempt({
    rootDir,
    context,
    runId: "run-no-progress",
    round: 5,
    beforeErrors: ["第11章 CROSS_BATCH_STATE_RESET：上一批退出状态被重置。"],
    afterErrors: ["第11章 CROSS_BATCH_STATE_RESET：上一批退出状态被重置。"],
    passed: false,
  })
  const decision = chapterBlueprintLearningShouldStop(context, "run-no-progress")
  assert.equal(decision.stop, true)
  assert.match(decision.reason, /连续 5 轮/)
})
