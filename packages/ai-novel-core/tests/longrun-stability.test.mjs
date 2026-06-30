import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createHash } from "node:crypto"
import { fileURLToPath, pathToFileURL } from "node:url"

const testFilePath = fileURLToPath(import.meta.url)
const packageRoot = path.resolve(path.dirname(testFilePath), "..")
const coreEntry = path.join(packageRoot, "dist", "index.js")
const studioServerEntry = path.join(packageRoot, "dist", "studio-server.js")
const DEFAULT_LONGRUN_CHAPTERS = 4
const CI_LONGRUN_CHAPTER_LIMIT = 20
const MAX_ADVANCE_STEPS_PER_CHAPTER = 2

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

async function loadStudioServer() {
  return import(`${pathToFileURL(studioServerEntry).href}?ts=${Date.now()}`)
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`
  }
  if (value && typeof value === "object") {
    const record = value
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function createStoryFoundationFingerprint(payload) {
  return createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 24)
}

async function readStoryFoundationFingerprintInput(rootDir, options = {}) {
  const plansDir = path.join(rootDir, ".ai-novel", "plans")
  const consensus = await fs.readFile(path.join(rootDir, ".ai-novel", "prompts", "global-consensus.md"), "utf8").catch(() => "")
  const readJson = async (filename) => {
    try {
      return JSON.parse(await fs.readFile(path.join(plansDir, filename), "utf8"))
    } catch {
      return null
    }
  }
  const requiredPlanningAssets = [
    "world-matrix.md",
    "plot-architecture.md",
    "story-bible.md",
    "volume-strategy.md",
    "foreshadowing-ledger.md",
    "character-dynamics.md",
    "story-foundation-contract.json",
    "world-matrix.json",
    "plot-architecture.json",
    "story-bible.json",
    "volume-strategy.json",
    "foreshadowing-ledger.json",
    "character-dynamics.json",
    "writing-plan.json",
  ]
  const planningAssetDetails = []
  for (const required of requiredPlanningAssets) {
    const text = await fs.readFile(path.join(plansDir, required), "utf8").catch(() => "")
    planningAssetDetails.push({
      key: required.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
      label: required,
      path: `.ai-novel/plans/${required}`,
      status: text.trim() ? "passed" : "blocked",
      detail: text.trim() ? "已生成" : "缺失",
    })
  }
  return {
    consensus,
    planningAssetDetails,
    storyFoundationContract: await readJson("story-foundation-contract.json"),
    worldMatrix: await readJson("world-matrix.json"),
    plotArchitecture: await readJson("plot-architecture.json"),
    storyBible: await readJson("story-bible.json"),
    volumeStrategy: await readJson("volume-strategy.json"),
    foreshadowingLedger: await readJson("foreshadowing-ledger.json"),
    characterDynamics: await readJson("character-dynamics.json"),
    writingPlan: await readJson("writing-plan.json"),
    storyFoundationApproved: true,
  }
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

async function approveLongrunWritingStyle(rootDir, options = {}) {
  const {
    appendStyleEvolutionCandidate,
    acceptStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    initializeStyleEvolution,
  } = await loadCore()
  const title = options.projectTitle || "Longrun Stability Ledger"
  const idea = options.idea || "A forensic archivist rebuilds a collapsing empire from disputed memory ledgers"

  await initializeStyleEvolution(rootDir, {
    projectTitle: title,
    idea,
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  await appendStyleEvolutionCandidate(rootDir, {
    prompt: "Longrun fixture style sample",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    review: "Longrun fixture: verified style candidate.",
    evaluation: {
      source: "llm_critic",
      verdict: "approve",
      summary: "Longrun fixture style candidate is verified for drafting.",
      scores: {
        narrativeVoice: 9,
        sentenceRhythm: 8.8,
        dialogueTexture: 8.7,
        informationDensity: 8.8,
        emotionalTension: 8.8,
        readability: 8.9,
        requirementAlignment: 9,
        forbiddenPatternRisk: 0.4,
        overall: 9,
      },
      strengths: ["克制冷感，动作和物件推进清楚。"],
      deviations: [],
      forbiddenHits: [],
      nextFocus: ["保持短对白与动作压迫。"],
      aigc: {
        enabled: true,
        status: "passed",
        score: 0.12,
        threshold: 0.8,
        highRiskCount: 0,
        reason: "fixture passed",
        highRiskPreviews: [],
      },
    },
    freezer: {
      verdict: "ready",
      summary: "Longrun fixture freezer ready.",
      blockingReasons: [],
      checkedAt: "2026-06-25T00:00:00.000Z",
    },
  })
  await acceptStyleEvolutionCandidate(rootDir, {
    version: 1,
    acceptedAt: "2026-06-25T00:00:00.000Z",
  })
  await approveStyleEvolutionSample(rootDir, {
    version: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    styleContract: {
      voice: "克制冷感、白描推进、以物件和动作压住悬疑。",
      sentenceRhythm: "短动作句与中句承接后果，避免解释性长段。",
      dialogueRules: ["对白短，带压力，不解释背景。"],
      descriptionRules: ["先物件、声音、身体反应，再给判断。"],
      forbiddenPatterns: ["解释创作意图", "总结式升华", "同质化对白"],
      positiveExamples: ["沈砚合上账册，只问了一句：谁动过这一页？"],
    },
  })

  const plansDir = path.join(rootDir, ".ai-novel", "plans")
  const blueprintDir = path.join(plansDir, "chapter-blueprints")
  const charactersDir = path.join(rootDir, ".ai-novel", "memory", "characters")
  await fs.mkdir(blueprintDir, { recursive: true })
  await fs.mkdir(charactersDir, { recursive: true })

  const totalChapters = Math.max(1, Number(options.totalChapters || DEFAULT_LONGRUN_CHAPTERS))
  const chapterWordTarget = Math.max(1000, Number(options.chapterWordTarget || 2500))

  await fs.writeFile(path.join(charactersDir, "dossiers.json"), `${JSON.stringify([
    {
      id: "protagonist",
      name: "Mira Vale",
      canonicalName: "Mira Vale",
      aliases: ["Mira"],
      role: "protagonist",
      identity: "forensic archivist",
      identityAndRole: "Forensic archivist tasked with reconstructing contested imperial ledgers.",
      coreDesire: "Reconstruct the truth",
      wound: "Compromised archives",
      fearOrWound: "Past record tampering makes her distrust official narratives.",
      contradiction: "She needs institutional access but distrusts institutions.",
      behaviorHabits: ["Touches damaged ledger spines before speaking", "chapter 1 profile signal: pauses before trusting official summaries"],
      speechMarkers: ["Short factual questions under pressure", "chapter 1 profile signal: clipped verification questions"],
      appearanceAndBody: "Ink-stained hands, rigid posture after long archive shifts, chapter 1 profile signal",
      skills: ["ledger reconstruction", "source verification", "chapter 1 profile signal: reconstructs altered source trails"],
      weaknesses: ["trust deficit"],
      limitations: ["limited political cover"],
      relationshipState: "In conflict with the pressure force controlling the record trail, chapter 1 profile signal",
      relationshipEdges: [
        { targetId: "pressure-force", label: "institutional pressure", pressure: "The record trail is actively contested." },
      ],
      arcTrajectory: "Moves from reconstruction to open confrontation with the system.",
      currentChapterDelta: "chapter 1 profile signal: readiness fixture baseline",
      continuityNotes: ["Each chapter extends the record-truth conflict."],
      evidence: ["longrun readiness fixture", "chapter 1 profile signal"],
      relationships: ["pressure-force"],
      updatedAt: "2026-06-25T00:00:00.000Z",
    },
  ], null, 2)}\n`)
  await fs.writeFile(path.join(charactersDir, "relationships.json"), `${JSON.stringify({
    nodeCount: 2,
    edgeCount: 1,
    nodes: [
      { id: "protagonist", label: "Mira Vale" },
      { id: "pressure-force", label: "Imperial Record Office" },
    ],
    edges: [
      { from: "protagonist", to: "pressure-force", label: "conflict" },
    ],
  }, null, 2)}\n`)

  for (let chapterNumber = 1; chapterNumber <= totalChapters; chapterNumber += 1) {
    await fs.writeFile(
      path.join(blueprintDir, `chapter-${String(chapterNumber).padStart(3, "0")}.md`),
      [
        "# Detailed Chapter Blueprint",
        `Project: ${title}`,
        `Chapter: ${chapterNumber}`,
        `Title: Chapter ${chapterNumber}`,
        `Target words: ${chapterWordTarget}`,
        "## Chapter Execution Contract",
        "- Previous Input: Continue pressure from the prior archival contradiction.",
        `- Causal Objective: Advance causal objective for chapter ${chapterNumber}.`,
        "- Protagonist Decision: The protagonist must choose under visible pressure.",
        "- Irreversible Change: Leave behind a non-reversible cost.",
        "- Next Handoff: Pass pressure into the next chapter.",
        "",
      ].join("\n"),
    )
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
    const { handleNovelStudioApi } = await loadStudioServer()

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A forensic archivist rebuilds a collapsing empire from disputed memory ledgers",
      title: "Longrun Stability Ledger",
      totalChapters: chapterCount,
      chapterWordTarget: 2500,
    })
    let state = created.state
    while (state.runtime.stage !== "chapter_task_generation") {
      state = await advanceAutonomousProject(created.project.projectRoot, {
        factoryRootDir: tempDir,
        projectId: created.project.id,
      })
    }

    await approveLongrunWritingStyle(created.project.projectRoot, {
      projectTitle: created.state.project.title,
      idea: created.state.project.idea,
    })
    const approvalResponse = await handleNovelStudioApi(tempDir, "POST", "/api/production/story-foundation/approve", {
      projectId: created.project.id,
      note: "长稳测试确认故事基建可进入正文生产。",
    }, { projectId: created.project.id })
    assert.equal(approvalResponse.status, 200)

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

    if (state.runtime.stage !== "complete") {
      const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
      const readinessEvent = snapshot.latestEvents.find((event) => event.type === "DRAFTING_START_BLOCKED_BY_READINESS")
      assert.fail(
        `longrun stalled at stage=${state.runtime.stage}; status=${state.runtime.statusMessage}; readinessEvent=${readinessEvent?.payload_json || "missing"}`,
      )
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
