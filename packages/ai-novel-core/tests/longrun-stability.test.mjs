import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const packageRoot = path.resolve(process.cwd())
const coreEntry = path.join(packageRoot, "dist", "index.js")
const DEFAULT_LONGRUN_CHAPTERS = 4
const CI_LONGRUN_CHAPTER_LIMIT = 20
const MAX_ADVANCE_STEPS_PER_CHAPTER = 2

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

function parseLongrunChapterCount() {
  const configured = Number.parseInt(process.env.LONGRUN_CHAPTERS || "", 10)
  const chapterCount = Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_LONGRUN_CHAPTERS
  if (process.env.CI && chapterCount > CI_LONGRUN_CHAPTER_LIMIT) {
    return CI_LONGRUN_CHAPTER_LIMIT
  }
  return chapterCount
}

async function withTestMode(fn) {
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"
  try {
    return await fn()
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
}

function assertSequentialChapterFacts(snapshot, chapterCount) {
  const facts = snapshot.chapterFacts
  assert.equal(facts.length, chapterCount)
  assert.deepEqual(
    facts.map((fact) => fact.chapterNumber),
    Array.from({ length: chapterCount }, (_, index) => index + 1),
  )
  assert.equal(new Set(facts.map((fact) => fact.chapterNumber)).size, chapterCount)

  for (const fact of facts) {
    assert.equal(fact.status, "complete", `chapter ${fact.chapterNumber} should be complete`)
    assert.equal(fact.qualityGate?.status, "passed", `chapter ${fact.chapterNumber} should pass quality gate`)
    assert.equal(fact.contentQuality?.status, "eligible", `chapter ${fact.chapterNumber} should remain eligible`)
    assert.match(String(fact.finalPath || ""), new RegExp(`chapter-${String(fact.chapterNumber).padStart(3, "0")}\\.final\\.md$`))
    assert.match(String(fact.reportPath || ""), new RegExp(`chapter-${String(fact.chapterNumber).padStart(3, "0")}-quality\\.md$`))
  }
}

function assertRowGrowth(snapshot, operationalStatus, chapterCount) {
  assert.equal(snapshot.artifactSummary.blueprints, chapterCount)
  assert.equal(snapshot.artifactSummary.finalChapters, chapterCount)
  assert.equal(snapshot.artifactSummary.passedFinalChapters, chapterCount)
  assert.equal(snapshot.artifactSummary.blockedFinalChapters, 0)
  assert.equal(snapshot.artifactSummary.quarantinedFinalChapters, 0)
  assert.equal(snapshot.artifactSummary.untrustedPassedGates, 0)
  assert.ok(snapshot.artifactSummary.qualityReports >= chapterCount)
  assert.ok(snapshot.artifactSummary.memoryUpdates >= chapterCount)
  assert.ok(snapshot.artifactSummary.total >= chapterCount * 3)
  assert.ok(snapshot.recentMemory.filter((memory) => memory.kind === "chapter_summary").length > 0)
  assert.ok(snapshot.recentMessages.length > 0)
  assert.ok(operationalStatus.messages.total >= chapterCount * 3)
}

test("longrun production workflow completes sequential chapters without stale jobs or protagonist drift", async () => {
  await withTestMode(async () => {
    const chapterCount = parseLongrunChapterCount()
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-longrun-stability-"))
    const {
      advanceAutonomousProject,
      createManagedAutonomousProject,
      evaluateChapterConsistency,
      withFactoryDb,
    } = await loadCore()

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A forensic archivist rebuilds a collapsing empire from disputed memory ledgers",
      title: "Longrun Stability Ledger",
      totalChapters: chapterCount,
      chapterWordTarget: 2500,
    })

    let state = created.state
    let lastCompleted = 0
    const maxSteps = chapterCount * MAX_ADVANCE_STEPS_PER_CHAPTER + 8

    for (let step = 0; step < maxSteps && state.runtime.stage !== "complete"; step += 1) {
      state = await advanceAutonomousProject(created.project.projectRoot, {
        factoryRootDir: tempDir,
        projectId: created.project.id,
        directorCommandId: `longrun_step_${String(step + 1).padStart(3, "0")}`,
      })

      const completed = state.plan.chapterTasks.filter((task) => task.status === "complete").length
      assert.ok(
        completed >= lastCompleted,
        `completed chapter count regressed from ${lastCompleted} to ${completed} at step ${step + 1}`,
      )
      lastCompleted = completed
    }

    assert.equal(state.runtime.stage, "complete")
    assert.equal(state.plan.pendingChapters, 0)
    assert.equal(state.plan.chapterTasks.filter((task) => task.status === "complete").length, chapterCount)
    assert.equal(state.plan.chapterTasks.filter((task) => task.status === "blocked").length, 0)
    assert.equal(state.plan.chapterTasks.filter((task) => task.status === "in_progress").length, 0)

    const finalTexts = []
    for (let chapterNumber = 1; chapterNumber <= chapterCount; chapterNumber += 1) {
      const finalPath = path.join(
        created.project.projectRoot,
        ".ai-novel",
        "chapters",
        `chapter-${String(chapterNumber).padStart(3, "0")}.final.md`,
      )
      const finalText = await fs.readFile(finalPath, "utf8")
      assert.match(finalText, /Final Body/)
      finalTexts.push(finalText)
    }

    let lockedProtagonist
    for (let index = 0; index < finalTexts.length; index += 1) {
      const consistency = evaluateChapterConsistency({
        chapterNumber: index + 1,
        text: finalTexts[index],
        previousProtagonistName: lockedProtagonist,
      })
      assert.equal(consistency.status, "eligible", `chapter ${index + 1} protagonist consistency should remain eligible`)
      lockedProtagonist = lockedProtagonist || consistency.protagonistName
    }
    assert.ok(lockedProtagonist)

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assertSequentialChapterFacts(snapshot, chapterCount)
    assert.equal(snapshot.activeJobs.length, 0)
    assert.equal(snapshot.runnableJobs.length, 0)
    assert.ok(snapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_COMPLETED"))

    const operationalStatus = await withFactoryDb(tempDir, async (db) => db.getOperationalStatus())
    assert.equal(operationalStatus.jobs.active, 0)
    assert.equal(operationalStatus.jobs.runnable, 0)
    assert.equal(operationalStatus.runs.active, 0)
    assertRowGrowth(snapshot, operationalStatus, chapterCount)
  })
})
