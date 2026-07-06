import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import http from "node:http"
import { createHash } from "node:crypto"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const testFilePath = fileURLToPath(import.meta.url)
const packageRoot = path.resolve(path.dirname(testFilePath), "..")
const coreEntry = path.join(packageRoot, "dist", "index.js")
const studioServerEntry = path.join(packageRoot, "dist", "studio-server.js")
const autopilotWorkerSource = path.join(packageRoot, "src", "autopilot-worker.ts")
const managedProjectsSegment = `${path.sep}.ai-novel-projects${path.sep}`

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

async function loadStudioServer() {
  return import(`${pathToFileURL(studioServerEntry).href}?ts=${Date.now()}`)
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString("utf8")
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

function createVerifiedStyleEvaluation(overrides = {}) {
  return {
    source: "llm_critic",
    verdict: "approve",
    summary: "测试夹具：当前样段可以作为全书基础写法。",
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
    ...overrides,
  }
}

function createStyleRefinementForTest(overrides = {}) {
  return {
    source: "llm_critic",
    summary: "测试夹具：Prompt Refiner 已给出下一轮收紧建议。",
    promptAdjustments: ["继续保持短对白和动作压迫。"],
    contractAdjustments: ["冻结后将短对白、动作先行和禁忌模式写入 style contract。"],
    nextPrompt: "继续保持克制冷感，用动作、物件和短对白推进悬疑压力。",
    ...overrides,
  }
}

function readyFreezerFixture(overrides = {}) {
  return {
    verdict: "ready",
    summary: "测试夹具：Style Contract Freezer 已放行整书写法确认。",
    blockingReasons: [],
    checkedAt: "2026-06-25T00:00:00.000Z",
    ...overrides,
  }
}

function createCompleteStyleContractForTest(overrides = {}) {
  return {
    voice: "克制冷感，动作和物件先于解释。",
    sentenceRhythm: "短动作句与中句承接后果，避免解释性长段。",
    dialogueRules: ["对白短，带压力，不解释背景。"],
    descriptionRules: ["先物件、声音、身体反应，再给判断。"],
    emotionRules: ["情绪通过动作、停顿和物件选择外化。"],
    pacingRules: ["每章都有压力进入、选择推进和余波钩子。"],
    povRules: ["保持稳定视角，不越权泄露未来信息。"],
    openingRules: ["开场优先落在具体场景压力上。"],
    endingHookRules: ["结尾留下可追踪的问题、关系裂缝或线索。"],
    allowedDevices: ["动作推进", "物件压迫", "短对白"],
    forbiddenPatterns: ["解释创作意图", "总结式升华", "同质化对白"],
    positiveExamples: ["沈砚合上账册，只问了一句：谁动过这一页？"],
    negativeExamples: [],
    ...overrides,
  }
}

function readyLoopProtocolFixture(overrides = {}) {
  const requiredStages = [
    "seed_prompt_builder",
    "candidate_generator",
    "evaluator_critic",
    "prompt_refiner",
    "loop_controller",
    "generation_verification",
    "user_approval_gate",
    "style_contract_freezer",
    "chapter_inheritance_adapter",
  ]
  return {
    status: "approved",
    requiredStages,
    completedStages: requiredStages,
    blockedStages: [],
    evidence: requiredStages.map((stage) => ({
      key: stage,
      label: stage,
      status: "passed",
      summary: `${stage} fixture passed`,
      evidence: [`${stage} evidence`],
      requiredForFreeze: true,
    })),
    ...overrides,
  }
}

function createReadyChapterInheritanceAdapterForTest(overrides = {}) {
  return {
    name: "Chapter Inheritance Adapter",
    status: "ready",
    contractVersion: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    freezerVerdict: "ready",
    freezerSummary: "fixture freezer ready",
    verificationStatus: "passed",
    verificationSummary: "fixture verification passed",
    inheritedArtifacts: ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"],
    inheritedRules: ["后续每章必须继承用户冻结后的 base writing prompt。"],
    styleContractFields: [
      "voice",
      "sentenceRhythm",
      "dialogueRules",
      "descriptionRules",
      "emotionRules",
      "pacingRules",
      "povRules",
      "openingRules",
      "endingHookRules",
      "allowedDevices",
      "forbiddenPatterns",
      "positiveExamples",
      "negativeExamples",
    ],
    loopProtocolStatus: "approved",
    loopProtocolStages: {
      required: readyLoopProtocolFixture().requiredStages,
      completed: readyLoopProtocolFixture().requiredStages,
      blocked: [],
    },
    loopProtocolEvidence: ["Seed Prompt Builder: fixture passed"],
    promptSections: [
      "User Approved Writing Style Contract",
      "Style Rulebook",
      "Style References",
      "Style Anti-Patterns",
    ],
    requiredChapterEvidence: [
      "quality gate passed",
      "AIGC detection passed",
      "style conformance drift conformant",
      "styleInheritanceVerification ready",
    ],
    approvedSampleExcerpt: "雨线挂在门槛外。沈砚把缺页账本推到灯下。",
    ...overrides,
  }
}

const AIGC_ENV_KEYS = [
  "AIGC_DETECTOR_PROVIDER",
  "AIGC_DETECTOR_URL",
  "AIGC_DETECTOR_THRESHOLD",
  "AIGC_DETECTOR_SEGMENT_MAX_CHARS",
]

function snapshotAigcEnv() {
  return Object.fromEntries(AIGC_ENV_KEYS.map((key) => [key, process.env[key]]))
}

function clearAigcEnv() {
  for (const key of AIGC_ENV_KEYS) {
    delete process.env[key]
  }
}

function restoreAigcEnv(snapshot) {
  for (const key of AIGC_ENV_KEYS) {
    if (snapshot[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = snapshot[key]
    }
  }
}

async function startPassingAigcDetector(overrides = {}) {
  const server = http.createServer(async (_request, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({
      aiProbability: 0.12,
      label: "human",
      confidence: 0.88,
      ...overrides,
    }))
  })
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve)
    server.once("error", reject)
  })
  const address = server.address()
  assert.ok(address && typeof address === "object")
  return { server, port: address.port }
}

async function writeAigcDetectorSettings(factoryRoot, detectorUrl, options = {}) {
  const { withFactoryDb } = await loadCore()
  await withFactoryDb(inferFactoryRoot(factoryRoot), async (db) => {
    db.setSystemSetting("aigcDetectorProvider", options.provider || "generic-json")
    db.setSystemSetting("aigcDetectorUrl", detectorUrl)
    db.setSystemSetting("aigcDetectorThreshold", options.threshold || "0.8")
    if (options.segmentMaxChars) {
      db.setSystemSetting("aigcDetectorSegmentMaxChars", String(options.segmentMaxChars))
    }
  })
}

function inferFactoryRoot(rootDir) {
  const resolved = path.resolve(rootDir)
  const index = resolved.indexOf(managedProjectsSegment)
  return index >= 0 ? resolved.slice(0, index) || path.parse(resolved).root : resolved
}

async function writePassingAigcSettings(projectRoot, port) {
  await writeAigcDetectorSettings(projectRoot, `http://127.0.0.1:${port}/detect`)
}

async function readStoryFoundationFingerprintInput(rootDir, options = {}) {
  const plansDir = path.join(rootDir, ".ai-novel", "plans")
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
    planningAssetDetails,
    storyFoundationContract: await readJson("story-foundation-contract.json"),
    worldMatrix: await readJson("world-matrix.json"),
    plotArchitecture: await readJson("plot-architecture.json"),
    storyBible: await readJson("story-bible.json"),
    volumeStrategy: await readJson("volume-strategy.json"),
    foreshadowingLedger: await readJson("foreshadowing-ledger.json"),
    characterDynamics: await readJson("character-dynamics.json"),
    writingPlan: await readJson("writing-plan.json"),
  }
}

async function writeStoryFoundationApprovalForTest(rootDir, options = {}) {
  const plansDir = path.join(rootDir, ".ai-novel", "plans")
  await fs.writeFile(path.join(plansDir, "story-foundation-approval.json"), `${JSON.stringify({
    version: 1,
    approved: true,
    approvedAt: options.approvedAt || "2026-06-25T00:00:00.000Z",
    approvedBy: options.approvedBy || "test",
    note: options.note || "测试确认故事基建可进入正文生产。",
    assetPaths: [
      ".ai-novel/prompts/global-consensus.md",
      ".ai-novel/plans/world-matrix.md",
      ".ai-novel/plans/plot-architecture.md",
      ".ai-novel/plans/story-bible.md",
      ".ai-novel/plans/volume-strategy.md",
      ".ai-novel/plans/foreshadowing-ledger.md",
      ".ai-novel/plans/character-dynamics.md",
      ".ai-novel/plans/story-foundation-contract.json",
      ".ai-novel/plans/writing-plan.json",
    ],
    assetFingerprint: createStoryFoundationFingerprint(await readStoryFoundationFingerprintInput(rootDir)),
  }, null, 2)}\n`)
}

async function approveTestWritingStyle(rootDir, options = {}) {
  const {
    appendStyleEvolutionCandidate,
    acceptStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    initializeStyleEvolution,
  } = await loadCore()
  const projectTitle = options.projectTitle || "测试小说"
  const idea = options.idea || "一名审雨官发现降雨记录被篡改"

  await initializeStyleEvolution(rootDir, {
    projectTitle,
    idea,
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  const sample = "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。"
  await appendStyleEvolutionCandidate(rootDir, {
    prompt: "测试冻结样段",
    sample,
    review: "测试夹具：已通过写法验证。",
    evaluation: createVerifiedStyleEvaluation(),
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })
  await acceptStyleEvolutionCandidate(rootDir, {
    version: 1,
    acceptedAt: "2026-06-25T00:00:00.000Z",
  })
  await approveStyleEvolutionSample(rootDir, {
    version: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    styleContract: createCompleteStyleContractForTest({
      voice: "克制冷感、白描推进、以物件和动作压住悬疑。",
    }),
  })
}

async function approveProductionReadinessForTest(rootDir, state, options = {}) {
  await approveTestWritingStyle(rootDir, {
    projectTitle: options.projectTitle || state?.project?.title || "测试小说",
    idea: options.idea || state?.project?.idea || "一名审雨官发现降雨记录被篡改",
  })

  const plansDir = path.join(rootDir, ".ai-novel", "plans")
  const promptsDir = path.join(rootDir, ".ai-novel", "prompts")
  const blueprintDir = path.join(plansDir, "chapter-blueprints")
  const charactersDir = path.join(rootDir, ".ai-novel", "memory", "characters")
  await fs.mkdir(promptsDir, { recursive: true })
  await fs.mkdir(blueprintDir, { recursive: true })
  await fs.mkdir(charactersDir, { recursive: true })

  const title = options.projectTitle || state?.project?.title || "测试小说"
  const idea = options.idea || state?.project?.idea || "一名审雨官发现降雨记录被篡改"
  const totalChapters = Math.max(1, Number(state?.plan?.totalChapters || state?.plan?.chapterTasks?.length || options.totalChapters || 1))
  const chapterWordTarget = Math.max(1000, Number(state?.project?.chapterWordTarget || state?.plan?.chapterWordTarget || options.chapterWordTarget || 2500))
  await fs.writeFile(
    path.join(promptsDir, "global-consensus.md"),
    [
      `# Global Consensus`,
      `Project: ${title}`,
      `Core idea: ${idea}`,
      `Reader promise: scene-first suspense with visible causal pressure.`,
      `World rules, protagonist pressure, relationship dynamics, foreshadowing ledger, and chapter handoffs are confirmed for drafting.`,
      ``,
    ].join("\n"),
  )

  const markdownAssets = {
    "world-matrix.md": `# Frozen World Rules\nProject: ${title}\nCore idea: ${idea}\n`,
    "plot-architecture.md": `# Causal Spine\nProject: ${title}\nEach chapter must advance causality and hand pressure forward.\n`,
    "story-bible.md": `# Non-Negotiable Story Contract\nProject: ${title}\nReader promise, world rules, cast pressure, and ending direction are frozen for drafting.\n`,
    "volume-strategy.md": `# Volume Strategy\nProject: ${title}\nThe first volume escalates from discovery to irreversible cost.\n`,
    "foreshadowing-ledger.md": `# Foreshadowing Ledger\nEach chapter opens, advances, or resolves a tracked clue.\n`,
    "character-dynamics.md": `# Core Relationship Contract\nThe protagonist, pressure force, and ally/rival network must change through visible choices.\n`,
  }
  for (const [filename, content] of Object.entries(markdownAssets)) {
    await fs.writeFile(path.join(plansDir, filename), `${content}\n`)
  }

  await fs.writeFile(path.join(plansDir, "story-foundation-contract.json"), `${JSON.stringify({
    version: 1,
    project: { title, idea },
    gates: { mustPassBeforeDrafting: ["story_foundation_approval", "style_approval", "chapter_blueprints"] },
    plot: {
      chapters: Array.from({ length: totalChapters }, (_, index) => ({
        chapterNumber: index + 1,
        title: `Chapter ${index + 1}`,
        causalObjective: `推进第 ${index + 1} 章因果目标。`,
      })),
    },
    characters: {
      requiredDossierFields: [
        "identity and role function",
        "core desire",
        "fear or wound",
        "behavior habit",
        "speech marker",
        "appearance or body marker",
        "relationship state",
        "current chapter delta",
      ],
    },
  }, null, 2)}\n`)
  await fs.writeFile(path.join(plansDir, "world-matrix.json"), `${JSON.stringify({ version: 1, title, rules: ["世界规则已冻结"] }, null, 2)}\n`)
  await fs.writeFile(path.join(plansDir, "plot-architecture.json"), `${JSON.stringify({
    version: 1,
    chapters: Array.from({ length: totalChapters }, (_, index) => ({
      chapterNumber: index + 1,
      causalObjective: `推进第 ${index + 1} 章因果目标。`,
      irreversibleChange: `第 ${index + 1} 章留下可追踪代价。`,
    })),
  }, null, 2)}\n`)
  await fs.writeFile(path.join(plansDir, "story-bible.json"), `${JSON.stringify({
    version: 1,
    readerPromise: "hook-forward, scene-first",
    nonNegotiableContracts: [
      "章节必须服从世界矩阵、主线架构、人物状态和伏笔账本。",
      "正文不能绕过用户确认的写法合同。",
    ],
  }, null, 2)}\n`)
  await fs.writeFile(path.join(plansDir, "volume-strategy.json"), `${JSON.stringify({ version: 1, volumes: [{ index: 1, chapterRange: [1, totalChapters] }] }, null, 2)}\n`)
  await fs.writeFile(path.join(plansDir, "foreshadowing-ledger.json"), `${JSON.stringify({
    version: 1,
    entries: Array.from({ length: totalChapters }, (_, index) => ({ chapterNumber: index + 1, operation: "seed_or_advance" })),
  }, null, 2)}\n`)
  await fs.writeFile(path.join(plansDir, "character-dynamics.json"), `${JSON.stringify({
    version: 1,
    dossiers: [{ id: "protagonist", role: "protagonist", desire: "查明核心异常", wound: "旧案代价" }],
    relationships: [{ from: "protagonist", to: "pressure-force", state: "conflict" }],
  }, null, 2)}\n`)
  await fs.writeFile(path.join(plansDir, "writing-plan.json"), `${JSON.stringify({
    version: 1,
    novelName: title,
    totalChapters,
    minWordsPerChapter: chapterWordTarget,
    status: "planning",
    writingMode: "serial",
    chapters: Array.from({ length: totalChapters }, (_, index) => ({
      chapterNumber: index + 1,
      title: `Chapter ${index + 1}`,
      filePath: `.ai-novel/chapters/chapter-${String(index + 1).padStart(3, "0")}.final.md`,
      status: "pending",
      wordCount: null,
      qualityPass: null,
      retryCount: 0,
      selectedVersionId: null,
      })),
  }, null, 2)}\n`)
  await fs.writeFile(path.join(charactersDir, "dossiers.json"), `${JSON.stringify([
    {
      id: "protagonist",
      name: "沈砚",
      canonicalName: "沈砚",
      aliases: ["沈砚", "主角"],
      role: "protagonist",
      identity: "审雨官",
      identityAndRole: "审雨官，负责核验异常雨册。",
      coreDesire: "查明核心异常",
      wound: "旧案代价",
      fearOrWound: "旧案代价让他不轻易交出判断。",
      contradiction: "越想保护账册真相，越容易把自己推到权力压力下。",
      behaviorHabits: ["合上账册再开口", "chapter 1 profile signal: pauses before confronting false ledgers"],
      speechMarkers: ["短句追问", "chapter 1 profile signal: clipped audit questions"],
      appearanceAndBody: "雨夜账房里的审雨官，chapter 1 profile signal",
      skills: ["查账", "辨伪", "chapter 1 profile signal: tracks altered rainfall entries"],
      weaknesses: ["不轻易信任他人"],
      limitations: ["不轻易信任他人"],
      relationshipState: "与压力方对峙，chapter 1 profile signal",
      relationshipEdges: [
        { targetId: "pressure-force", label: "对抗压力", pressure: "账册异常会持续压迫他的选择。" },
      ],
      arcTrajectory: "从发现异常走向承担代价。",
      currentChapterDelta: "chapter 1 profile signal: readiness fixture baseline",
      continuityNotes: ["每章必须延续账册异常和旧案代价。"],
      evidence: ["test readiness fixture", "chapter 1 profile signal"],
      relationships: ["pressure-force"],
      updatedAt: "2026-06-25T00:00:00.000Z",
    },
  ], null, 2)}\n`)

  for (let chapterNumber = 1; chapterNumber <= totalChapters; chapterNumber += 1) {
    await fs.writeFile(
      path.join(blueprintDir, `chapter-${String(chapterNumber).padStart(3, "0")}.md`),
      [
        `# Detailed Chapter Blueprint`,
        `Project: ${title}`,
        `Chapter: ${chapterNumber}`,
        `Title: Chapter ${chapterNumber}`,
        `Target words: ${chapterWordTarget}`,
        `## Chapter Execution Contract`,
        `- Previous Input: 承接上一章状态或创作目标。`,
        `- Causal Objective: 推进第 ${chapterNumber} 章因果目标。`,
        `- Protagonist Decision: 主角必须在可见压力下主动选择。`,
        `- Irreversible Change: 留下不可逆后果。`,
        `- Next Handoff: 交棒给下一章压力。`,
        ``,
      ].join("\n"),
    )
  }

  await writeStoryFoundationApprovalForTest(rootDir)
}

async function advanceUntilDraftingForTest(rootDir, initialState, advanceAutonomousProject, options = {}) {
  let state = initialState
  for (let attempt = 0; attempt < 8 && state.runtime.stage !== "drafting"; attempt += 1) {
    state = await advanceAutonomousProject(rootDir, options)
    if (
      state.runtime.stage !== "drafting"
      && /故事基建已被修改|旧确认已失效|story foundation.*stale|production readiness/iu.test(String(state.runtime.statusMessage || ""))
    ) {
      await writeStoryFoundationApprovalForTest(rootDir, {
        note: "测试重新确认自动生成后的故事基建资产。",
      })
    }
  }
  if (state.runtime.stage !== "drafting") {
    throw new Error(`advanceUntilDraftingForTest failed: stage=${state.runtime.stage}, status=${state.runtime.statusMessage || ""}`)
  }
  return state
}

test("core initializes a stateful project with a super graph", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-"))
  const { initAutonomousProject, loadSuperGraph, validateSuperGraph } = await loadCore()

  const state = await initAutonomousProject({
    rootDir: tempDir,
    idea: "A village clerk records the fall of an empire",
    totalChapters: 8,
    chapterWordTarget: 2500,
  })

  assert.equal(state.runtime.stage, "worldbuilding_dialogue")
  assert.equal(state.plan.chapterTasks.length, 8)
  assert.ok(state.plan.chapterTasks.every((task) => task.causalPlan))
  assert.match(state.plan.chapterTasks[1].summary, /承接/)
  assert.match(state.plan.chapterTasks[1].summary, /选择/)
  assert.match(state.plan.chapterTasks[1].summary, /代价/)
  assert.doesNotMatch(state.plan.chapterTasks[1].summary, /Draft chapter/)

  const graph = await loadSuperGraph(tempDir)
  assert.ok(graph.nodes.some((node) => node.id === "mission:original"))
  const chapterNode = graph.nodes.find((node) => node.id === "chapter:002")
  assert.ok(chapterNode?.properties?.causalPlan)
  assert.match(String(chapterNode.properties.summary || ""), /交棒/)
  assert.equal(validateSuperGraph(graph).filter((issue) => issue.severity === "error").length, 0)
})

test("managed project roots resolve to the server workspace even for legacy relative records", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-managed-root-"))
  const { initAutonomousProject, resolveManagedProjectRoot } = await loadCore()
  const projectId = "legacy-root"
  const projectRoot = path.join(tempDir, ".ai-novel-projects", projectId)

  await initAutonomousProject({
    rootDir: projectRoot,
    idea: "A court clerk survives a collapsing dynasty",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })
  await fs.writeFile(
    path.join(tempDir, ".ai-novel-projects", "projects.json"),
    `${JSON.stringify([
      {
        id: projectId,
        slug: projectId,
        title: "Legacy Root",
        idea: "A court clerk survives a collapsing dynasty",
        createdAt: new Date().toISOString(),
        totalChapters: 6,
        chapterWordTarget: 2500,
        projectRoot: "../../.ai-novel-projects/legacy-root",
      },
    ], null, 2)}\n`,
  )

  assert.equal(await resolveManagedProjectRoot(tempDir, projectId), projectRoot)
})

test("discussions append across turns and persist a current context packet", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-continuity-"))
  const { initAutonomousProject, runMultiAgentDiscussion } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    await initAutonomousProject({
      rootDir: tempDir,
      idea: "A minor official witnesses the end of Tang",
      totalChapters: 8,
      chapterWordTarget: 2500,
    })

    const first = await runMultiAgentDiscussion(tempDir, "先讨论主角出身和底层视角")
    const second = await runMultiAgentDiscussion(tempDir, "延续上一轮，补充权力上升路径")

    const transcript = await fs.readFile(path.join(tempDir, ".ai-novel", "chat", "discussion-log.md"), "utf8")
    assert.match(transcript, /先讨论主角出身/)
    assert.match(transcript, /延续上一轮/)
    assert.ok(transcript.match(/^## /gm)?.length >= 2)
    assert.equal(first.transcriptPath, second.transcriptPath)

    const contextPacket = await fs.readFile(path.join(tempDir, ".ai-novel", "context", "current-context.md"), "utf8")
    assert.match(contextPacket, /Current Context Packet/)
    assert.match(contextPacket, /Recent transcript carryover/)
    assert.match(contextPacket, /先讨论主角出身/)

    assert.match(first.consensusArchivePath, /\.ai-novel\/consensus\/discussion-/)
    const firstArchive = await fs.readFile(first.consensusArchivePath, "utf8")
    assert.match(firstArchive, /Discussion Consensus Archive/)
    assert.match(firstArchive, /Showrunner Final Consensus/)
    assert.match(firstArchive, /Agent Discussion Outputs/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("factory database records projects, runs, turns, artifacts, and events", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-factory-db-"))
  const { createManagedAutonomousProject, runMultiAgentDiscussion, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A dock scribe tracks a collapsing empire",
      totalChapters: 8,
      chapterWordTarget: 2500,
    })
    await runMultiAgentDiscussion(created.project.projectRoot, "继续收敛主角和世界规则", {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(snapshot.project.id, created.project.id)
    assert.equal(snapshot.latestRuns.length, 1)
    assert.equal(snapshot.latestRuns[0].status, "completed")
    assert.ok(snapshot.latestEvents.some((event) => event.type === "AGENT_TURN_UPDATED"))
    assert.ok(snapshot.artifacts.some((artifact) => artifact.kind === "transcript"))
    assert.ok(snapshot.artifacts.some((artifact) => artifact.kind === "consensus"))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes(".ai-novel/consensus/discussion-")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes(".ai-novel/chat/discussion-log.md")))
    const discussionMessages = await withFactoryDb(tempDir, async (db) => db.listMessages(created.project.id, { limit: 20 }))
    const agentMessage = discussionMessages.find((message) => message.type === "agent" && message.metadata?.source === "discussion_agent_turn")
    assert.ok(agentMessage)
    assert.ok(agentMessage.parts.some((part) => part.type === "markdown" && part.data.text === agentMessage.data.content))
    assert.ok(agentMessage.parts.some((part) =>
      part.type === "json"
      && part.data.source === "discussion_agent_turn"
      && part.data.currentStage === "worldbuilding_dialogue"
    ))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("factory database persists extensible message records and parts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-messages-"))
  const { createAgentMessage, createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A city cartographer maps forbidden memories",
    title: "Message City",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const message = createAgentMessage({
    messageId: "msg-author-1",
    conversationId: "conversation-1",
    projectId: created.project.id,
    runId: "run-1",
    turnId: "turn-1",
    agentType: "author",
    agentLabel: "Author",
    content: "正文片段",
    status: "completed",
    time: "2026-06-04T10:00:00.123Z",
    metadata: { chapterNumber: 1 },
  })

  const rows = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage(message, [
      {
        id: "msg-author-1:part:0",
        messageId: "msg-author-1",
        index: 0,
        type: "markdown",
        data: { text: "正文片段" },
        createdAt: "2026-06-04T10:00:00.123Z",
      },
      {
        id: "msg-author-1:part:1",
        messageId: "msg-author-1",
        index: 1,
        type: "image",
        data: { path: ".ai-novel/assets/scene.png", mimeType: "image/png" },
        createdAt: "2026-06-04T10:00:00.124Z",
      },
    ])
    return db.listMessages(created.project.id)
  })

  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, "msg-author-1")
  assert.equal(rows[0].type, "agent")
  assert.equal(rows[0].status, "completed")
  assert.equal(rows[0].data.agentType, "author")
  assert.equal(rows[0].data.content, "正文片段")
  assert.equal(rows[0].parts.length, 2)
  assert.equal(rows[0].parts[1].type, "image")
  assert.equal(rows[0].parts[1].data.path, ".ai-novel/assets/scene.png")

  const updatedRows = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage({
      ...message,
      status: "streaming",
      data: { ...message.data, content: "流式片段" },
      updatedAt: "2026-06-04T10:00:01.000Z",
      completedAt: null,
    })
    db.recordMessage({
      ...message,
      status: "completed",
      data: { ...message.data, content: "最终正文片段" },
      updatedAt: "2026-06-04T10:00:02.000Z",
      completedAt: "2026-06-04T10:00:02.000Z",
    })
    return db.listMessages(created.project.id)
  })

  assert.equal(updatedRows.length, 1)
  assert.equal(updatedRows[0].id, "msg-author-1")
  assert.equal(updatedRows[0].status, "completed")
  assert.equal(updatedRows[0].data.content, "最终正文片段")
  assert.equal(updatedRows[0].time, "2026-06-04T10:00:00.123Z")
  assert.equal(updatedRows[0].created_at, "2026-06-04T10:00:00.123Z")
  assert.equal(updatedRows[0].updated_at, "2026-06-04T10:00:02.000Z")
})

test("message factories create durable tool artifact and image messages", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-message-factories-"))
  const {
    createArtifactMessage,
    createImageMessage,
    createManagedAutonomousProject,
    createToolMessage,
    withFactoryDb,
  } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "An archivist assembles a machine for lost seasons",
    title: "Factory Messages",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const toolMessage = createToolMessage({
    messageId: "msg-tool-1",
    conversationId: "conversation-typed",
    projectId: created.project.id,
    runId: "run-typed",
    toolName: "provider-test",
    input: { model: "test-model" },
    output: { ok: true },
    content: "模型连通性检查完成。",
    time: "2026-06-04T10:00:00.000Z",
  })
  const artifactMessage = createArtifactMessage({
    messageId: "msg-artifact-1",
    conversationId: "conversation-typed",
    projectId: created.project.id,
    runId: "run-typed",
    artifactId: "artifact-1",
    label: "第 1 章成稿",
    artifactPath: ".ai-novel/chapters/chapter-001.final.md",
    content: "正文完成。",
    time: "2026-06-04T10:00:01.000Z",
  })
  const imageMessage = createImageMessage({
    messageId: "msg-image-1",
    conversationId: "conversation-typed",
    projectId: created.project.id,
    runId: "run-typed",
    assetId: "cover-1",
    path: ".ai-novel/assets/cover.png",
    alt: "封面草图",
    caption: "第一版封面",
    time: "2026-06-04T10:00:02.000Z",
  })

  const rows = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage(toolMessage)
    db.recordMessage(artifactMessage)
    db.recordMessage(imageMessage)
    return db.listMessages(created.project.id, { conversationId: "conversation-typed", limit: 10 })
  })

  const rowById = new Map(rows.map((row) => [row.id, row]))

  assert.deepEqual(new Set(rows.map((row) => row.type)), new Set(["tool", "artifact", "image"]))
  assert.equal(rowById.get("msg-tool-1").data.toolName, "provider-test")
  assert.equal(rowById.get("msg-tool-1").data.output.ok, true)
  assert.equal(rowById.get("msg-artifact-1").data.artifactPath, ".ai-novel/chapters/chapter-001.final.md")
  assert.equal(rowById.get("msg-artifact-1").data.label, "第 1 章成稿")
  assert.equal(rowById.get("msg-image-1").data.mimeType, "image/png")
  assert.equal(rowById.get("msg-image-1").data.path, ".ai-novel/assets/cover.png")
})

test("factory database lists messages with pagination and conversation filtering", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-message-pagination-"))
  const { createManagedAutonomousProject, withFactoryDb, createAgentMessage } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clockmaker archives impossible days",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const makeMessage = (index, conversationId = "conversation-a") => createAgentMessage({
    messageId: `msg-page-${index}`,
    conversationId,
    projectId: created.project.id,
    agentType: "showrunner",
    agentLabel: "Showrunner",
    content: `message ${index}`,
    status: "completed",
    time: `2026-06-04T10:00:0${index}.000Z`,
  })

  const result = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage(makeMessage(1))
    db.recordMessage(makeMessage(2))
    db.recordMessage(makeMessage(3, "conversation-b"))
    db.recordMessage(makeMessage(4))
    return {
      total: db.countMessages(created.project.id),
      conversationTotal: db.countMessages(created.project.id, { conversationId: "conversation-a" }),
      firstPage: db.listMessages(created.project.id, { limit: 2 }),
      secondPage: db.listMessages(created.project.id, { limit: 2, offset: 2 }),
      conversationPage: db.listMessages(created.project.id, { conversationId: "conversation-a", limit: 10 }),
    }
  })

  assert.equal(result.total, 4)
  assert.equal(result.conversationTotal, 3)
  assert.deepEqual(result.firstPage.map((row) => row.id), ["msg-page-4", "msg-page-3"])
  assert.deepEqual(result.secondPage.map((row) => row.id), ["msg-page-2", "msg-page-1"])
  assert.deepEqual(result.conversationPage.map((row) => row.id), ["msg-page-4", "msg-page-2", "msg-page-1"])
})

test("factory database can mark interrupted streaming messages as failed", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-message-interrupt-"))
  const { createManagedAutonomousProject, withFactoryDb, createAgentMessage } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk survives an interrupted draft",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  const makeMessage = (chapterNumber) => createAgentMessage({
    messageId: `writing-${chapterNumber}-draft`,
    conversationId: `writing:${created.project.id}`,
    projectId: created.project.id,
    agentLabel: "Author",
    status: "streaming",
    content: `Author is drafting chapter ${chapterNumber}.`,
    metadata: { chapterNumber },
  })

  const changed = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage(makeMessage(1), [
      {
        id: "writing-1-draft:part:0",
        messageId: "writing-1-draft",
        index: 0,
        type: "markdown",
        data: {
          text: [
            "### 第 1 章 · draft_generation",
            "Author 正在生成正文。模型正在持续输出。",
            "",
            "状态：LLM 正在持续返回内容。",
            "",
            "返回内容会持续合并到这一条 agent 消息中。",
          ].join("\n"),
        },
        createdAt: "2026-06-04T10:00:00.123Z",
      },
    ])
    db.recordMessage(makeMessage(2))
    return db.markStreamingMessagesFailed(created.project.id, {
      conversationId: `writing:${created.project.id}`,
      chapterNumber: 1,
      reason: "worker aborted",
    })
  })

  assert.equal(changed, 1)

  const rows = await withFactoryDb(tempDir, async (db) =>
    db.listMessages(created.project.id, { conversationId: `writing:${created.project.id}`, limit: 10 }),
  )
  const rowById = new Map(rows.map((row) => [row.id, row]))
  assert.equal(rowById.get("writing-1-draft").status, "failed")
  assert.equal(rowById.get("writing-1-draft").data.statusText, "无人值守任务被中断，等待恢复后重新执行。")
  const failedMarkdown = rowById.get("writing-1-draft").parts.find((part) => part.type === "markdown")?.data?.text || ""
  assert.doesNotMatch(String(failedMarkdown), /LLM 正在持续返回内容|返回内容会持续合并/)
  assert.equal(rowById.get("writing-2-draft").status, "streaming")
})

test("factory snapshot compacts heavy event and memory payloads for UI polling", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-compact-snapshot-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A courier remembers too many futures",
    totalChapters: 1,
    chapterWordTarget: 2500,
  })
  await withFactoryDb(tempDir, async (db) => {
    const longText = "重".repeat(5000)
    db.recordEvent(created.project.id, null, "HEAVY_EVENT", {
      content: longText,
      embedding: Array.from({ length: 256 }, (_, index) => index),
    })
    db.recordMemory(created.project.id, {
      source: ".ai-novel/memory/heavy.md",
      kind: "chapter_summary",
      content: longText,
      importance: 8,
      metadata: { note: longText },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const heavyEvent = snapshot.latestEvents.find((event) => event.type === "HEAVY_EVENT")
  const heavyMemory = snapshot.recentMemory.find((memory) => memory.source === ".ai-novel/memory/heavy.md")

  assert.ok(String(heavyEvent.payload_json).length < 1700)
  assert.ok(String(heavyMemory.content).length < 950)
  assert.ok(String(heavyMemory.metadata_json).length < 1700)
})

test("factory snapshot keeps pinned artifacts even when many recent chapter files exist", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-pinned-artifacts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk protects a city by editing its myths",
    totalChapters: 120,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    for (let index = 1; index <= 120; index += 1) {
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: `.ai-novel/chapters/chapter-${String(index).padStart(3, "0")}.final.md`,
        status: "completed",
      })
    }
    db.recordArtifact({
      projectId: created.project.id,
      kind: "checkpoint",
      path: ".ai-novel/knowledge/evaluation-latest.md",
      status: "completed",
      metadata: { source: "knowledge-evaluate" },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const artifactPaths = snapshot.artifacts.map((artifact) => artifact.path)

  assert.ok(artifactPaths.includes(".ai-novel/prompts/global-consensus.md"))
  assert.ok(artifactPaths.includes(".ai-novel/context/current-context.md"))
  assert.ok(artifactPaths.includes(".ai-novel/knowledge/evaluation-latest.md"))
  assert.ok(artifactPaths.includes(".ai-novel/chapters/chapter-120.final.md"))
})

test("managed projects sync super graph rows into the factory database snapshot", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-factory-graph-"))
  const { createManagedAutonomousProject, withFactoryDb, superGraphFromDbRows, validateSuperGraph } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A railway clerk maps a haunted republic",
    totalChapters: 7,
    chapterWordTarget: 2500,
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.graphNodes.some((node) => node.id === "mission:original"))
  assert.ok(snapshot.graphEdges.some((edge) => edge.type === "HAS_MISSION"))

  const graph = superGraphFromDbRows(created.project.id, snapshot.graphNodes, snapshot.graphEdges)
  assert.equal(validateSuperGraph(graph).filter((issue) => issue.severity === "error").length, 0)
})

test("factory database keeps super graph rows isolated per managed project", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-factory-graph-isolation-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const first = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A registrar catalogs vanished islands",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })
  const second = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A surveyor maps impossible winter roads",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  const firstSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(first.project.id))
  const secondSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(second.project.id))
  const firstMission = firstSnapshot.graphNodes.find((node) => node.id === "mission:original")
  const secondMission = secondSnapshot.graphNodes.find((node) => node.id === "mission:original")

  assert.equal(firstMission.project_id, first.project.id)
  assert.equal(secondMission.project_id, second.project.id)
  assert.notEqual(firstMission.metadata_json, secondMission.metadata_json)
})

test("factory memory recall supports keyword and embedding-backed retrieval", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-memory-rag-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A librarian keeps illegal memories for a city",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  const memoryId = await withFactoryDb(tempDir, async (db) =>
    db.recordMemory(created.project.id, {
      source: "test",
      kind: "worldbuilding",
      content: "The forbidden archive stores rain-scented memories under glass streets.",
      importance: 4,
      embedding: { model: "test-embedding", vector: [1, 0, 0] },
    }),
  )

  const keywordRecall = await withFactoryDb(tempDir, async (db) =>
    db.recallMemory(created.project.id, "archive memories", 3),
  )
  assert.equal(keywordRecall[0].id, memoryId)
  assert.equal(keywordRecall[0].embedding_status, "ready")

  const vectorRecall = await withFactoryDb(tempDir, async (db) =>
    db.recallMemory(created.project.id, "", 3, { embedding: [1, 0, 0] }),
  )
  assert.equal(vectorRecall[0].id, memoryId)
  assert.equal(vectorRecall[0].model, "test-embedding")
})

test("factory memory updates production resource rows instead of duplicating by path", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-memory-upsert-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A record keeper measures a dying empire",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordMemory(created.project.id, {
      source: "production-writing-resources",
      kind: "style_rulebook",
      content: "first",
      metadata: { path: ".ai-novel/style/production-resources/production-writing-assets.md" },
    })
    db.recordMemory(created.project.id, {
      source: "production-writing-resources",
      kind: "style_rulebook",
      content: "second",
      metadata: { path: ".ai-novel/style/production-resources/production-writing-assets.md" },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const rows = snapshot.recentMemory.filter((row) => row.source === "production-writing-resources")
  assert.equal(rows.length, 1)
  assert.equal(rows[0].content, "second")
})

test("pending memory embeddings can be backfilled and recalled by vector", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-memory-backfill-"))
  const { createManagedAutonomousProject, withFactoryDb, backfillPendingMemoryEmbeddings, createLocalTextEmbedding } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A tax archivist learns the empire is a dream",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  const memoryId = await withFactoryDb(tempDir, async (db) =>
    db.recordMemory(created.project.id, {
      source: "seed",
      kind: "canon",
      content: "The imperial tax ledger is actually a dream index.",
      importance: 5,
    }),
  )

  const count = await backfillPendingMemoryEmbeddings(tempDir, { projectId: created.project.id })
  assert.equal(count, 1)

  const recalled = await withFactoryDb(tempDir, async (db) =>
    db.recallMemory(created.project.id, "", 3, {
      embedding: createLocalTextEmbedding("dream ledger index"),
    }),
  )
  assert.equal(recalled[0].id, memoryId)
  assert.equal(recalled[0].embedding_status, "ready")
})

test("writing context recalls character dossier memory from the factory database", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-writing-memory-"))
  const {
    createLocalTextEmbedding,
    createManagedAutonomousProject,
    retrieveFactoryMemoryContext,
    withFactoryDb,
  } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk survives court intrigue by reading forbidden ledgers",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  const task = {
    chapterNumber: 2,
    title: "Ledger Pressure",
    status: "pending",
    summary: "Li Yan enters the archive and must decide whether to trust the steward.",
    targetWords: 2500,
  }
  const continuityContract = {
    status: "ready",
    lockedProtagonistName: "Li Yan",
    knownCast: ["Li Yan", "Steward Song"],
    continuityAnchors: ["broken seal"],
    previousChapterLedger: ["chapter 1: Li Yan hid the forbidden ledger."],
    prompt: "Canon Continuity Contract",
  }
  await withFactoryDb(tempDir, async (db) => {
    db.recordMemory(created.project.id, {
      source: ".ai-novel/memory/characters/dossiers.json",
      kind: "character_dossiers",
      content: "Factory dossier: Li Yan habit=presses the ledger corner before speaking; speech=asks clipped questions; relationship=does not trust Steward Song.",
      importance: 9,
      metadata: { path: ".ai-novel/memory/characters/dossiers.json" },
      embedding: {
        model: "local-hash-v1",
        vector: createLocalTextEmbedding("Li Yan Steward Song character dossier ledger trust"),
      },
    })
  })

  const context = await retrieveFactoryMemoryContext({
    state: created.state,
    task,
    options: { factoryRootDir: tempDir, projectId: created.project.id },
    continuityContract,
  })

  assert.match(context, /Factory Memory Recall/)
  assert.match(context, /character_dossiers/)
  assert.match(context, /Li Yan habit=presses the ledger corner/)

  await withFactoryDb(tempDir, async (db) => {
    db.recordMemory(created.project.id, {
      source: ".ai-novel/memory/characters/dossiers.json",
      kind: "character_dossiers",
      content: "Factory dossier: Li Yan habit=touches the broken seal after every lie.",
      importance: 9,
      metadata: { path: ".ai-novel/memory/characters/dossiers.json" },
      embedding: {
        model: "local-hash-v1",
        vector: createLocalTextEmbedding("Li Yan broken seal updated dossier"),
      },
    })
  })
  const cachedContext = await retrieveFactoryMemoryContext({
    state: created.state,
    task,
    options: { factoryRootDir: tempDir, projectId: created.project.id },
    continuityContract,
  })
  assert.equal(cachedContext, context)
})

test("discussion context packet includes recalled memory from the factory database", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-discussion-rag-"))
  const { createManagedAutonomousProject, runMultiAgentDiscussion, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A courier delivers prophecies that expire at dawn",
      totalChapters: 6,
      chapterWordTarget: 2500,
    })
    await withFactoryDb(tempDir, async (db) =>
      db.recordMemory(created.project.id, {
        source: "seed",
        kind: "worldbuilding",
        content: "Dawn prophecies must be delivered before the city bells ring.",
        importance: 5,
      }),
    )

    await runMultiAgentDiscussion(created.project.projectRoot, "继续讨论 dawn prophecies 的世界规则", {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    const contextPacket = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "context", "current-context.md"), "utf8")
    assert.match(contextPacket, /Memory\/RAG recall/)
    assert.match(contextPacket, /Dawn prophecies must be delivered/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("knowledge RAG indexes global resources and project artifacts without cross-project leakage", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-knowledge-rag-"))
  const {
    createManagedAutonomousProject,
    ingestKnowledgeSource,
    ingestProjectArtifact,
    retrieveKnowledge,
    evaluateKnowledgeRetrieval,
    evaluateKnowledgeBenchmark,
    withFactoryDb,
  } = await loadCore()

  const first = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk survives court politics through forbidden ledgers",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  const second = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A sailor maps winter islands",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  await ingestKnowledgeSource({
    rootDir: tempDir,
    scope: "global",
    sourceType: "vocabulary",
    path: "global/vocabulary/court.md",
    title: "Court vocabulary",
    content: [
      "# 朝堂词汇",
      "",
      "## 宸命",
      "释义：皇帝的委命。适合朝堂政争和诏令场景。",
    ].join("\n"),
  })

  const firstMemoryPath = path.join(first.project.projectRoot, ".ai-novel", "memory", "chapter-001-memory.md")
  await fs.mkdir(path.dirname(firstMemoryPath), { recursive: true })
  await fs.writeFile(firstMemoryPath, "铜牌伏笔只属于第一个项目，藏在户曹旧账夹层。\n")
  await ingestProjectArtifact({
    rootDir: tempDir,
    projectId: first.project.id,
    projectRoot: first.project.projectRoot,
    artifactPath: ".ai-novel/memory/chapter-001-memory.md",
    kind: "memory",
    metadata: { chapterNumber: 1 },
  })

  const globalRecall = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: second.project.id,
    query: "朝堂 宸命 诏令",
    scopes: ["global"],
    limit: 3,
  })
  assert.ok(globalRecall.some((row) => /宸命/.test(String(row.content))))
  const globalHit = globalRecall.find((row) => /宸命/.test(String(row.content)))

  const firstRecall = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: first.project.id,
    query: "铜牌 户曹 夹层",
    scopes: ["project"],
    limit: 3,
  })
  assert.ok(firstRecall.some((row) => /铜牌伏笔/.test(String(row.content))))
  const projectHit = firstRecall.find((row) => /铜牌伏笔/.test(String(row.content)))

  const leakedRecall = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: second.project.id,
    query: "铜牌 户曹 夹层",
    scopes: ["project"],
    limit: 3,
  })
  assert.equal(leakedRecall.some((row) => /铜牌伏笔/.test(String(row.content))), false)

  await withFactoryDb(tempDir, async (db) => {
    db.createJob({
      projectId: first.project.id,
      kind: "knowledge_project_artifact",
      status: "idle",
      payload: { artifactPath: ".ai-novel/context/current-context.md" },
    })
    db.createJob({
      projectId: first.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "not a knowledge job" },
    })
    db.recordEvent(first.project.id, null, "KNOWLEDGE_EVALUATION_COMPLETED", {
      summary: {
        totalCases: 1,
        hitRateAtK: 1,
        meanRecallAtK: 1,
        meanPrecisionAtK: 0.5,
      },
      cases: [{
        name: "snapshot evaluation",
        query: "铜牌 户曹",
        k: 3,
        hitAtK: 1,
        recallAtK: 1,
        precisionAtK: 0.5,
        matchedChunkIds: [String(projectHit?.id)],
        missedChunkIds: [],
      }],
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(first.project.id))
  assert.equal(snapshot.knowledge.summary.globalSources, 1)
  assert.equal(snapshot.knowledge.summary.projectSources, 1)
  assert.ok(snapshot.knowledge.summary.readyChunks >= 2)
  assert.ok(snapshot.knowledge.jobs.some((job) =>
    job.kind === "knowledge_project_artifact"
    && job.status === "idle"
    && job.payload?.artifactPath === ".ai-novel/context/current-context.md",
  ))
  assert.equal(snapshot.knowledge.jobs.some((job) => job.kind === "autopilot"), false)
  assert.equal(snapshot.knowledge.latestEvaluation?.payload?.summary?.totalCases, 1)
  assert.equal(snapshot.knowledge.latestEvaluation?.payload?.summary?.hitRateAtK, 1)

  const pointEvaluation = evaluateKnowledgeRetrieval(
    [{ id: "expected-a" }, { id: "noise-b" }, { id: "expected-c" }],
    ["expected-a", "expected-c", "missing-d"],
    2,
  )
  assert.equal(pointEvaluation.hitAtK, 1)
  assert.equal(pointEvaluation.recallAtK, 1 / 3)
  assert.equal(pointEvaluation.precisionAtK, 1 / 2)
  assert.deepEqual(pointEvaluation.missedChunkIds, ["expected-c", "missing-d"])

  assert.ok(globalHit?.id)
  assert.ok(projectHit?.id)
  const benchmark = await evaluateKnowledgeBenchmark(tempDir, [
    {
      name: "global court vocabulary",
      query: "朝堂 宸命 诏令",
      projectId: second.project.id,
      scopes: ["global"],
      expectedChunkIds: [String(globalHit.id)],
      k: 3,
    },
    {
      name: "project artifact memory",
      query: "铜牌 户曹 夹层",
      projectId: first.project.id,
      scopes: ["project"],
      expectedChunkIds: [String(projectHit.id)],
      k: 3,
    },
  ])
  assert.equal(benchmark.summary.totalCases, 2)
  assert.equal(benchmark.summary.hitRateAtK, 1)
  assert.equal(benchmark.summary.meanRecallAtK, 1)
})

test("knowledge jobs are durable and worker-indexed without blocking project creation", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-knowledge-worker-"))
  const { createManagedAutonomousProject, runNovelAutopilotWorkerOnce, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A tax clerk indexes a collapsing dynasty",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })

    const before = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(before.activeJobs.every((job) => job.kind !== "knowledge_global_bootstrap"))
    assert.ok(before.runnableJobs.every((job) => job.kind !== "knowledge_global_bootstrap"))
    assert.ok(before.knowledge.summary.readyChunks >= 0)

    await runNovelAutopilotWorkerOnce(tempDir)

    const after = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(after.knowledge.summary.globalSources > 0)
    assert.ok(after.knowledge.summary.projectSources > 0)
    assert.ok(after.knowledge.summary.readyChunks > 0)
    assert.ok(after.latestEvents.some((event) => event.type === "JOB_UPDATED" && /knowledge_/.test(String(event.payload_json))))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("knowledge bootstrap backfills legacy projects that have no knowledge index", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-knowledge-legacy-bootstrap-"))
  const { createManagedAutonomousProject, runNovelAutopilotWorkerOnce, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A ledger keeper survives late Tang collapse",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })

    await withFactoryDb(tempDir, async (db) => {
      for (const job of db.listProjectJobs(created.project.id)) {
        if (String(job.kind || "").startsWith("knowledge_")) {
          db.cancelJob(String(job.id))
        }
      }
    })

    const before = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(before.knowledge.summary.globalSources, 0)
    assert.equal(before.knowledge.summary.projectSources, 0)
    assert.ok(before.runnableJobs.every((job) => !String(job.kind || "").startsWith("knowledge_")))

    await runNovelAutopilotWorkerOnce(tempDir)

    const after = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(after.knowledge.summary.globalSources > 0)
    assert.ok(after.knowledge.summary.projectSources > 0)
    assert.ok(after.knowledge.summary.readyChunks > 0)
    assert.ok(after.latestEvents.some((event) => event.type === "KNOWLEDGE_BOOTSTRAP_QUEUED"))
    assert.ok(after.latestEvents.some((event) => event.type === "JOB_UPDATED" && /knowledge_/.test(String(event.payload_json))))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("discussion context packet includes writing knowledge across setup and style targets", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-discussion-knowledge-"))
  const { createManagedAutonomousProject, ingestKnowledgeSource, runMultiAgentDiscussion } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A minor official watches late Tang collapse",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })
    await ingestKnowledgeSource({
      rootDir: tempDir,
      scope: "global",
      sourceType: "vocabulary",
      path: "global/vocabulary/style.md",
      title: "Style vocabulary",
      content: [
        "# 文风词汇",
        "",
        "## 风声鹤唳",
        "释义：紧张疑惧的气氛，适合乱世市井和官府追捕场景。",
      ].join("\n"),
    })

    await runMultiAgentDiscussion(created.project.projectRoot, "讨论文风，乱世紧张感里如何自然使用成语", {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    const contextPacket = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "context", "current-context.md"), "utf8")
    assert.match(contextPacket, /Writing knowledge\/RAG recall/)
    assert.match(contextPacket, /风声鹤唳/)

    await ingestKnowledgeSource({
      rootDir: tempDir,
      scope: "global",
      sourceType: "example",
      path: "global/examples/worldbuilding.md",
      title: "Worldbuilding example",
      content: [
        "# 设定示例",
        "",
        "## 市井压迫感",
        "用坊门、差役、米价和夜禁细节承托乱世秩序，不要先写抽象历史评述。",
      ].join("\n"),
    })

    await runMultiAgentDiscussion(created.project.projectRoot, "继续确认大唐末期底层小人物的世界规则和市井压迫感", {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    const setupContextPacket = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "context", "current-context.md"), "utf8")
    assert.match(setupContextPacket, /Writing knowledge\/RAG recall/)
    assert.match(setupContextPacket, /市井压迫感/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("super graph updates prefer factory database rows over stale graph files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-graph-db-first-"))
  const { createManagedAutonomousProject, upsertDiscussionInSuperGraph, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A cartographer draws borders that become real",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })
  await fs.writeFile(
    path.join(created.project.projectRoot, ".ai-novel", "graph", "super-graph.json"),
    `${JSON.stringify({ schemaVersion: 1, projectId: "stale", generatedAt: new Date().toISOString(), nodes: [], edges: [] })}\n`,
  )

  await upsertDiscussionInSuperGraph(created.project.projectRoot, {
    target: { kind: "worldbuilding", label: "db first graph update", assetPath: ".ai-novel/prompts/global-consensus.md" },
    summary: "Graph update should survive stale file contents.",
    transcriptPath: ".ai-novel/chat/discussion-log.md",
  }, {
    factoryRootDir: tempDir,
    projectId: created.project.id,
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.graphNodes.some((node) => String(node.id).startsWith("discussion:")))
  assert.ok(snapshot.graphNodes.some((node) => node.id === "mission:original"))
})

test("factory database can claim, heartbeat, complete, fail, and re-claim durable jobs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-factory-jobs-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A ledger keeper audits immortal debts",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  const baseNow = new Date("2026-06-03T00:00:00.000Z")
  const jobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "continue", mode: "background" },
    }),
  )

  const claimed = await withFactoryDb(tempDir, async (db) => db.claimJob(jobId, "worker-a", 30, baseNow))
  assert.equal(claimed.id, jobId)
  assert.equal(claimed.lease_owner, "worker-a")
  assert.equal(claimed.payload.message, "continue")

  const blockedClaim = await withFactoryDb(tempDir, async (db) =>
    db.claimJob(jobId, "worker-b", 30, new Date("2026-06-03T00:00:10.000Z")),
  )
  assert.equal(blockedClaim, null)

  const heartbeat = await withFactoryDb(tempDir, async (db) =>
    db.heartbeatJob(jobId, "worker-a", 45, new Date("2026-06-03T00:00:20.000Z")),
  )
  assert.equal(heartbeat, "2026-06-03T00:01:05.000Z")

  const runnableBeforeExpiry = await withFactoryDb(tempDir, async (db) =>
    db.listRunnableJobs("autopilot", new Date("2026-06-03T00:00:45.000Z")),
  )
  assert.equal(runnableBeforeExpiry.length, 0)

  const runnableAfterExpiry = await withFactoryDb(tempDir, async (db) =>
    db.listRunnableJobs("autopilot", new Date("2026-06-03T00:01:06.000Z")),
  )
  assert.equal(runnableAfterExpiry.length, 1)
  assert.equal(runnableAfterExpiry[0].id, jobId)

  const reclaimed = await withFactoryDb(tempDir, async (db) =>
    db.claimJob(jobId, "worker-b", 30, new Date("2026-06-03T00:01:06.000Z")),
  )
  assert.equal(reclaimed.lease_owner, "worker-b")

  await withFactoryDb(tempDir, async (db) => db.completeJob(jobId, "worker-b"))
  const snapshotAfterComplete = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.equal(snapshotAfterComplete.activeJobs.length, 0)
  assert.ok(snapshotAfterComplete.latestEvents.some((event) => event.type === "JOB_UPDATED"))

  const failedJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "fail me" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(failedJobId, "simulated failure"))
  const runnableAfterFailure = await withFactoryDb(tempDir, async (db) => db.listRunnableJobs("autopilot"))
  assert.equal(runnableAfterFailure.some((job) => job.id === failedJobId), false)
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(failedJobId)), false)

  await withFactoryDb(tempDir, async (db) => db.resumeJob(failedJobId, { message: "continue after timeout" }))
  const runnableAfterResume = await withFactoryDb(tempDir, async (db) => db.listRunnableJobs("autopilot"))
  assert.equal(runnableAfterResume.some((job) => job.id === failedJobId), true)
  assert.equal(runnableAfterResume.find((job) => job.id === failedJobId).payload.message, "continue after timeout")

  const transientJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "retry me" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(transientJobId, "LLM request timed out after 1000ms without provider activity."))
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(transientJobId)), true)

  const rateLimitedJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "slow down" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(rateLimitedJobId, "LLM request failed with status 429."))
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(rateLimitedJobId)), true)

  const stoppedJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "stop me" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(stoppedJobId, "Autopilot stopped by user."))
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(stoppedJobId)), false)

  const abortedJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "abort me" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(abortedJobId, "The operation was aborted."))
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(abortedJobId)), false)
})

test("factory operational status reports jobs, memory queues, and events", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-operational-status-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A keeper tracks every oath in a floating city",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordMemory(created.project.id, {
      source: "test",
      kind: "canon",
      content: "The floating city descends one bell tower per oath broken.",
    })
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "continue" },
    })
  })

  const status = await withFactoryDb(tempDir, async (db) => db.getOperationalStatus(new Date("2026-06-03T00:00:00.000Z")))
  assert.equal(status.ok, true)
  assert.equal(status.projects.total, 1)
  assert.equal(status.projects.running, 1)
  assert.equal(status.jobs.active, 1)
  assert.equal(status.jobs.runnable, 1)
  assert.equal(status.memory.pendingEmbeddings, 1)
  assert.ok(status.latestEvents.some((event) => event.type === "JOB_CREATED"))
})

test("factory operational status ignores stale project running flags without active jobs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-operational-stale-running-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A watcher must not mistake stale state for a running worker",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  created.state.runtime.autopilot = {
    running: true,
    stopRequested: false,
    startedAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    lastStep: "network_retry",
    mode: "background",
    target: "continue",
    driftScore: 0,
    driftStatus: "ok",
    driftReason: null,
    checkpointPath: null,
    loopCount: 5,
  }
  await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, created.state))

  const status = await withFactoryDb(tempDir, async (db) => db.getOperationalStatus())
  assert.equal(status.projects.total, 1)
  assert.equal(status.projects.running, 0)
  assert.equal(status.jobs.active, 0)
})

test("factory operational status excludes events for pruned projects", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-operational-pruned-events-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "Deleted project events should not drive the live dashboard",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  await withFactoryDb(tempDir, async (db) => {
    db.recordEvent(created.project.id, null, "OLD_PROJECT_EVENT", { stale: true })
    db.deleteProject(created.project.id)
  })

  const status = await withFactoryDb(tempDir, async (db) => db.getOperationalStatus())
  assert.equal(status.projects.total, 0)
  assert.equal(status.latestEvents.some((event) => event.type === "OLD_PROJECT_EVENT"), false)
})

test("factory project state updates ignore volatile timestamp-only changes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-state-dedupe-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A scribe should not refresh the whole UI for heartbeat-only state writes",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const firstWrite = await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, created.state))
  const duplicateState = {
    ...created.state,
    runtime: {
      ...created.state.runtime,
      lastUpdatedAt: "2026-06-03T00:00:01.000Z",
      autopilot: created.state.runtime.autopilot
        ? {
          ...created.state.runtime.autopilot,
          updatedAt: "2026-06-03T00:00:01.000Z",
        }
        : created.state.runtime.autopilot,
    },
  }
  const duplicateWrite = await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, duplicateState))
  const changedState = {
    ...created.state,
    runtime: {
      ...created.state.runtime,
      statusMessage: "实际状态变化",
    },
  }
  const changedWrite = await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, changedState))
  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const stateUpdatedEvents = snapshot.latestEvents.filter((event) => event.type === "PROJECT_STATE_UPDATED")

  assert.equal(firstWrite, false)
  assert.equal(duplicateWrite, false)
  assert.equal(changedWrite, true)
  assert.equal(stateUpdatedEvents.length, 1)
})

test("factory snapshot separates final chapter files from quality-passed chapter completion", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-chapter-facts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk separates official records from failed drafts",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok", wordCount: 2800, targetWords: 2500 },
      },
    })
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-002.final.md",
      metadata: {
        chapterNumber: 2,
        pass: "final",
        qualityGate: { status: "blocked", score: 5, attempts: 2, reason: "needs rewrite", wordCount: 800, targetWords: 2500 },
      },
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "draft_generation_llm_started",
      role: "Author",
      chapterNumber: 3,
      status: "running",
      message: "Author is drafting chapter 3.",
    })
    db.recordArtifact({
      projectId: created.project.id,
      kind: "checkpoint",
      path: ".ai-novel/reports/chapter-004-quality.md",
      metadata: {
        chapterNumber: 4,
        quality: true,
        qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok", wordCount: 2600, targetWords: 2500 },
      },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.equal(snapshot.artifactSummary.finalChapterFiles, 2)
  assert.equal(snapshot.artifactSummary.finalChapters, 1)
  assert.equal(snapshot.artifactSummary.passedFinalChapters, 1)
  assert.equal(snapshot.artifactSummary.blockedFinalChapters, 1)
  assert.equal(snapshot.artifactSummary.quarantinedFinalChapters, 1)
  assert.equal(snapshot.artifactSummary.untrustedPassedGates, 0)
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).status, "complete")
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2).status, "blocked")
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 3).status, "in_progress")
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 4).status, "pending")
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 4).finalPath, undefined)
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 4).contentQuality.status, "eligible")
})

test("chapter consistency locks the first POV protagonist and rejects later protagonist drift", async () => {
  const { evaluateChapterConsistency, extractChinesePersonNames } = await loadCore()
  const chapterOne = [
    "# 第1章 终稿",
    "",
    "## Polish Pass",
    "",
    "- 宋管事指甲缝的泥黑强化压迫感。",
    "",
    "## Final Body",
    "",
    "李晦是被一巴掌扇醒的。",
    "他想抬手挡一下，胳膊却不听使唤。最后的记忆是凌晨两点在工位上改代码。",
    "宋管事把契书拍在他脸上，冷笑着催租。李晦咬住腮帮子，知道自己不能倒下。",
  ].join("\n")
  const chapterTwo = [
    "## Final Body",
    "",
    "陈默是被冷醒的。",
    "他睁开眼，看见的不是出租屋天花板，而是一片黑黢黢的梁木。",
    "老妇人递给他树皮饼，陈默终于确认自己不是在做梦。",
  ].join("\n")
  const chapterThree = [
    "## Final Body",
    "",
    "天还没有亮，李延就被一阵急促的拍门声惊醒。",
    "他不是这个世界的人。此刻的李延，是万年县户曹的贴书小吏。",
    "张主簿让他进门，李延立刻意识到田册出了问题。",
  ].join("\n")

  const detected = extractChinesePersonNames(chapterOne)
  assert.ok(detected.includes("李晦"))
  assert.equal(detected.includes("宋管事"), false)

  const first = evaluateChapterConsistency({ chapterNumber: 1, text: chapterOne })
  assert.equal(first.status, "eligible")
  assert.equal(first.protagonistName, "李晦")

  const second = evaluateChapterConsistency({
    chapterNumber: 2,
    text: chapterTwo,
    previousProtagonistName: first.protagonistName,
  })
  assert.equal(second.status, "quarantined")
  assert.match(second.reason, /李晦/)
  assert.equal(second.protagonistName, "李晦")

  const third = evaluateChapterConsistency({
    chapterNumber: 3,
    text: chapterThree,
    previousProtagonistName: first.protagonistName,
  })
  assert.equal(third.status, "quarantined")
  assert.match(third.reason, /李晦/)
})

test("factory snapshot does not mark quality-passed chapters complete when protagonist drifts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-protagonist-drift-facts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk must keep one protagonist across a long collapsing-dynasty novel",
    totalChapters: 3,
    chapterWordTarget: 2500,
  })
  const chaptersDir = path.join(created.project.projectRoot, ".ai-novel", "chapters")
  const chapters = [
    {
      chapterNumber: 1,
      path: ".ai-novel/chapters/chapter-001.final.md",
      text: [
        "## Final Body",
        "",
        "李晦是被一巴掌扇醒的。",
        "宋管事把契书拍在他脸上，催他缴租。李晦咬住腮帮子，知道自己不能倒下。",
      ].join("\n"),
    },
    {
      chapterNumber: 2,
      path: ".ai-novel/chapters/chapter-002.final.md",
      text: [
        "## Final Body",
        "",
        "陈默是被冷醒的。",
        "他睁开眼，看见的不是出租屋天花板，而是一片黑黢黢的梁木。",
      ].join("\n"),
    },
    {
      chapterNumber: 3,
      path: ".ai-novel/chapters/chapter-003.final.md",
      text: [
        "## Final Body",
        "",
        "天还没有亮，李延就被一阵急促的拍门声惊醒。",
        "张主簿找他问田册，李延意识到自己被卷进了县衙旧案。",
      ].join("\n"),
    },
  ]
  for (const chapter of chapters) {
    await fs.writeFile(path.join(chaptersDir, path.basename(chapter.path)), `${chapter.text}\n`)
  }

  await withFactoryDb(tempDir, async (db) => {
    for (const chapter of chapters) {
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: chapter.path,
        metadata: {
          chapterNumber: chapter.chapterNumber,
          pass: "final",
          qualityGate: {
            status: "passed",
            score: 8,
            attempts: 1,
            reason: "LLM quality report passed.",
            wordCount: 2800,
            targetWords: 2500,
          },
        },
      })
    }
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const chapterOne = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1)
  const chapterTwo = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2)
  const chapterThree = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 3)

  assert.equal(chapterOne.status, "complete")
  assert.equal(chapterOne.protagonistName, "李晦")
  assert.equal(chapterTwo.qualityGate.status, "passed")
  assert.equal(chapterTwo.status, "pending")
  assert.equal(chapterTwo.contentQuality.status, "quarantined")
  assert.match(chapterTwo.contentQuality.reason, /李晦/)
  assert.equal(chapterThree.status, "pending")
  assert.equal(chapterThree.contentQuality.status, "quarantined")
})

test("chapter facts do not let stale running events override quality gate results", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-stale-running-facts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk audits stale chapter events",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: { status: "blocked", score: 5, attempts: 2, reason: "needs rewrite" },
      },
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "draft_generation_llm_started",
      role: "Author",
      chapterNumber: 1,
      status: "running",
      message: "Old run that should not hide the blocked quality gate.",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.status, "blocked")
  assert.equal(fact.qualityGate.status, "blocked")
})

test("chapter facts keep a trusted final chapter complete even with a later stale failed event", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-stale-failed-complete-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk should not lose a trusted final chapter to stale failure noise",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const chapterPath = path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md")
  await fs.writeFile(chapterPath, [
    "## Final Body",
    "",
    "李晦是被一巴掌扇醒的。",
    "宋管事把契书拍在他脸上。李晦咬住腮帮子，知道自己不能倒下。",
  ].join("\n"))

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: {
          status: "passed",
          score: 8,
          attempts: 1,
          reason: "quality passed",
          wordCount: 2700,
          targetWords: 2500,
          updatedAt: "2026-06-04T14:25:22.127Z",
        },
      },
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "draft_generation_llm_failed",
      role: "Author",
      chapterNumber: 1,
      status: "blocked",
      message: "Late stale failure from an old request.",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.qualityGate.status, "passed")
  assert.equal(fact.contentQuality.status, "eligible")
  assert.equal(fact.consistency.status, "eligible")
  assert.equal(fact.status, "complete")
})

test("chapter facts prefer fresh in-progress writing over stale passed quality gates", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-fresh-running-facts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk rewrites a previously passed chapter",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok", wordCount: 2700, targetWords: 2500 },
      },
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "draft_generation_llm_started",
      role: "Author",
      chapterNumber: 1,
      status: "running",
      message: "Fresh rewrite should surface as in progress.",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.status, "in_progress")
  assert.equal(fact.qualityGate.status, "passed")
})

test("chapter facts prefer completed pipeline events over earlier recovery queue events", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-completed-after-recovery-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk finishes a recovered chapter",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: {
          status: "blocked",
          score: 5,
          attempts: 2,
          reason: "old blocked gate",
          wordCount: 1200,
          targetWords: 2500,
          updatedAt: "2026-06-03T00:00:00.000Z",
        },
      },
    })
    db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_RECOVERY_QUEUED", {
      chapterNumber: 1,
      recoveryAttempts: 1,
    })
    db.recordEvent(created.project.id, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: 1,
      status: "in_progress",
      reason: "chapter_production_started",
    })
    db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_COMPLETED", {
      chapterNumber: 1,
      finalPath: ".ai-novel/chapters/chapter-001.final.md",
      reportPath: ".ai-novel/reports/chapter-001-quality.md",
      qualityGate: {
        status: "passed",
        score: 8,
        attempts: 1,
        reason: "ok",
        wordCount: 2800,
        targetWords: 2500,
      },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.status, "complete")
  assert.equal(fact.qualityGate.status, "passed")
  assert.equal(fact.latestTaskStatus, "in_progress")
})

test("chapter facts do not keep blocked finished chapters in progress", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-blocked-finished-not-inprogress-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk must recover after a failed review",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: {
          status: "blocked",
          score: 8,
          attempts: 2,
          reason: "quality report still requires rewrite",
          wordCount: 3200,
          targetWords: 2500,
          updatedAt: "2026-06-05T22:01:37.034Z",
        },
      },
    })
    db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_RECOVERY_QUEUED", {
      chapterNumber: 1,
      recoveryAttempts: 1,
    })
    db.recordEvent(created.project.id, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: 1,
      status: "in_progress",
      reason: "chapter_production_started",
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "quality_review_llm_failed",
      role: "Editor",
      chapterNumber: 1,
      status: "blocked",
      message: "The final review request failed after producing a blocked report.",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.status, "blocked")
  assert.equal(fact.qualityGate.status, "blocked")
  assert.equal(fact.latestTaskStatus, "in_progress")
  assert.equal(fact.latestEventStatus, "blocked")
})

test("production writing pipeline records detailed plans, final chapters, reports, and memory in the factory database", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-pipeline-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A court strategist rewrites history through forbidden ledgers",
	      totalChapters: 4,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })

    const state = await advanceUntilDraftingForTest(created.project.projectRoot, created.state, advanceAutonomousProject, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(state.runtime.stage, "drafting")
    assert.equal(state.plan.chapterTasks[0].status, "complete")

    for (const filename of [
      "world-matrix.md",
      "plot-architecture.md",
      "story-bible.md",
      "volume-strategy.md",
      "foreshadowing-ledger.md",
      "character-dynamics.md",
    ]) {
      const asset = await fs.readFile(
        path.join(created.project.projectRoot, ".ai-novel", "plans", filename),
        "utf8",
      )
      assert.match(asset, /# /)
    }
    const storyBible = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "plans", "story-bible.md"),
      "utf8",
    )
    assert.match(storyBible, /Non-Negotiable Story Contract/)
    assert.match(storyBible, /Character Spine/)

    const blueprint = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "plans", "chapter-blueprints", "chapter-001.md"),
      "utf8",
    )
    assert.match(blueprint, /Detailed Chapter Blueprint/)
    assert.match(blueprint, /Vocabulary And Idiom Strategy/)

    const finalChapter = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md"),
      "utf8",
    )
    assert.match(finalChapter, /Final Body/)
    assert.match(finalChapter, /Polish Pass/)
    assert.doesNotMatch(state.project.creativeProfile.styleFingerprint, /pending sample|first-chapter extraction/i)
    assert.match(state.project.creativeProfile.styleFingerprint, /paragraph|dialogue|voice|choice/)
    const styleProfile = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "style", "profile.md"),
      "utf8",
    )
    assert.match(styleProfile, /style fingerprint: /)
    assert.doesNotMatch(styleProfile, /pending sample|first-chapter extraction/i)
    const characterDossiers = JSON.parse(await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "memory", "characters", "dossiers.json"),
      "utf8",
    ))
    const characterRelationships = JSON.parse(await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "memory", "characters", "relationships.json"),
      "utf8",
    ))
    const characterRelationsMarkdown = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "memory", "characters", "relations.md"),
      "utf8",
    )
    const protagonistDossier = characterDossiers.find((dossier) => dossier.role === "protagonist")
    assert.ok(protagonistDossier)
    assert.ok(characterRelationships.nodeCount >= characterDossiers.length)
    assert.ok(Array.isArray(characterRelationships.edges))
    assert.match(characterRelationsMarkdown, /Character Relationship Graph/)
    assert.doesNotMatch(protagonistDossier.coreDesire, /pending/i)
    assert.match(protagonistDossier.currentChapterDelta, /chapter 1/)
    assert.ok(protagonistDossier.behaviorHabits.some((entry) => /chapter 1/.test(entry)))
    assert.ok(protagonistDossier.speechMarkers.some((entry) => /chapter 1/.test(entry)))
    assert.match(protagonistDossier.appearanceAndBody, /chapter 1/)
    assert.ok(protagonistDossier.skills.some((entry) => /chapter 1/.test(entry)))
    assert.match(protagonistDossier.relationshipState, /chapter 1/)
    assert.ok(protagonistDossier.evidence.some((entry) => /profile signal/.test(entry)))

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("master-outline.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("story-bible.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("foreshadowing-ledger.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("chapter-blueprints/chapter-001.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("chapter-001.final.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("chapter-001-quality.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.kind) === "style" && String(artifact.path).includes("style/profile.md")))
    assert.equal(snapshot.artifactSummary.blueprints, 4)
    assert.equal(snapshot.artifactSummary.finalChapters, 1)
    assert.equal(snapshot.artifactSummary.qualityReports, 1)
    assert.equal(snapshot.artifactSummary.memoryUpdates, 1)
    assert.match(snapshot.artifactSummary.latestFinalPath, /chapter-001\.final\.md/)
    const qualityArtifact = await withFactoryDb(tempDir, async (db) => db.db.prepare(`
      SELECT metadata_json
      FROM artifacts
      WHERE project_id = ?
        AND path LIKE ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(created.project.id, "%chapter-001-quality.md"))
    assert.equal(JSON.parse(qualityArtifact.metadata_json).qualityGate.status, "passed")
    const qualityReport = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "reports", "chapter-001-quality.md"),
      "utf8",
    )
    assert.match(qualityReport, /## AIGC Detection/)
    assert.match(qualityReport, /Status: skipped/)
    const memoryUpdate = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "memory", "chapter-001-memory.md"),
      "utf8",
    )
    assert.match(memoryUpdate, /### Foreshadowing Ledger Update/)
    assert.match(memoryUpdate, /- Operation:/)
    assert.match(memoryUpdate, /- Status:/)
    assert.match(memoryUpdate, /- Expected payoff \/ next touchpoint:/)
    assert.match(memoryUpdate, /- Carryover rule:/)
    assert.ok(snapshot.recentMemory.some((memory) => String(memory.kind) === "chapter_summary"))
    const recalledDossiers = await withFactoryDb(tempDir, async (db) =>
      db.recallMemory(created.project.id, "character_dossiers profile signal", 4),
    )
    assert.ok(recalledDossiers.some((memory) =>
      String(memory.kind) === "character_dossiers"
      && String(memory.source).includes("memory/characters/dossiers.json")
      && /chapter 1 profile signal/.test(String(memory.content)),
    ))
    assert.ok(snapshot.recentMemory.some((memory) => String(memory.kind) === "style_profile" && /Style fingerprint from chapter 1/.test(String(memory.content))))
    const completedEvent = await withFactoryDb(tempDir, async (db) => db.db.prepare(`
      SELECT payload_json
      FROM events
      WHERE project_id = ?
        AND type = 'CHAPTER_PIPELINE_COMPLETED'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(created.project.id))
    assert.ok(completedEvent)
    assert.equal(JSON.parse(completedEvent.payload_json).qualityGate.status, "passed")
    const artifactMessages = snapshot.recentMessages.filter((message) => message.type === "artifact")
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && message.data.label === "全书主线规划"
      && /master-outline\.md/.test(message.data.artifactPath),
    ))
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && /story-bible\.md/.test(message.data.artifactPath),
    ))
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && message.data.label === "第 1 章蓝图"
      && /chapter-blueprints\/chapter-001\.md/.test(message.data.artifactPath),
    ))
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && message.data.label === "第 1 章正式成稿"
      && /chapter-001\.final\.md/.test(message.data.artifactPath),
    ))
    const finalArtifactMessage = artifactMessages.find((message) => /chapter-001\.final\.md/.test(message.data.artifactPath))
    assert.match(finalArtifactMessage?.id || finalArtifactMessage?.messageId || "", /^artifact-/)
    assert.ok(finalArtifactMessage.parts.some((part) => part.type === "markdown"))
    assert.ok(finalArtifactMessage.parts.some((part) => part.type === "artifact" && /chapter-001\.final\.md/.test(part.data.path)))
    assert.ok(finalArtifactMessage.parts.some((part) => part.type === "json" && part.data.kind === "chapter"))
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && message.data.label === "第 1 章质检报告"
      && /chapter-001-quality\.md/.test(message.data.artifactPath),
    ))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("production writing pipeline emits visible progress events for chapter production", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-writing-progress-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const progressEvents = []
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A quiet clerk rewrites a haunted dynasty ledger",
	      title: "Visible Writing",
	      totalChapters: 3,
	      chapterWordTarget: 2500,
	    })
		    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })

    let state = await advanceUntilDraftingForTest(created.project.projectRoot, created.state, advanceAutonomousProject, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      onProgress(event) {
        progressEvents.push(event)
      },
    })

    state = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      directorCommandId: "cmd_visible_writing_chapter_001",
      onProgress(event) {
        progressEvents.push(event)
      },
    })

    assert.equal(state.plan.chapterTasks[0].status, "complete")
    assert.ok(progressEvents.some((event) => event.step === "master_planning_started" && event.role === "Showrunner"))
    assert.ok(progressEvents.some((event) => event.step === "master_planning_completed" && event.role === "Showrunner"))
    assert.ok(progressEvents.some((event) => event.step === "master_outline_saved" && /master-outline\.md/.test(event.artifactPath || "")))
    assert.ok(progressEvents.some((event) => event.step === "chapter_blueprint_started" && event.role === "Chapter Planner"))
    assert.ok(progressEvents.some((event) => event.step === "blueprint_knowledge_recalled" && event.role === "Chapter Planner"))
    assert.ok(progressEvents.some((event) => event.step === "chapter_blueprint_completed" && event.role === "Chapter Planner"))
    assert.ok(progressEvents.some((event) => event.step === "chapter_blueprint_saved" && /chapter-blueprints\/chapter-001\.md/.test(event.artifactPath || "")))
    assert.ok(progressEvents.some((event) => event.step === "chapter_started"))
    assert.ok(progressEvents.some((event) => event.step === "draft_knowledge_recalled" && event.role === "Author"))
    assert.ok(progressEvents.some((event) => event.step === "draft_completed" && event.role === "Author"))
    assert.ok(progressEvents.some((event) => event.step === "quality_gate_completed" && event.qualityGate))
    assert.ok(progressEvents.some((event) => event.step === "memory_update_started" && event.role === "Memory Keeper"))
    assert.ok(progressEvents.some((event) => event.step === "chapter_artifacts_saved" && /chapter-001\.final\.md/.test(event.artifactPath || "")))

    const productionStepEvents = progressEvents.filter((event) =>
      ["draft_completed", "quality_gate_completed", "chapter_artifacts_saved"].includes(event.step)
        && event.directorCommandId,
    )
    assert.ok(productionStepEvents.length >= 3)
    assert.equal(new Set(productionStepEvents.map((event) => event.messageId)).size, productionStepEvents.length)
    assert.ok(productionStepEvents.every((event) => event.directorCommandId))
    assert.ok(productionStepEvents.every((event) => String(event.messageId || "").includes(event.directorCommandId)))
    const writingMessages = await withFactoryDb(tempDir, async (db) =>
      db.listMessages(created.project.id, { limit: 500 }).filter((message) => message.metadata?.source === "writing_progress"),
    )
    const progressMessagesByStep = new Map(writingMessages.map((message) => [message.metadata?.step, message]))
    for (const step of [
      "chapter_started",
      "blueprint_loaded",
      "continuity_contract_loaded",
      "draft_knowledge_recalled",
      "draft_completed",
      "quality_gate_completed",
      "memory_update_started",
      "chapter_artifacts_saved",
    ]) {
      assert.ok(progressMessagesByStep.get(step), `expected a dedicated writing message for ${step}`)
    }
    const progressMessageIds = writingMessages.map((message) => String(message.id || message.messageId || ""))
    assert.equal(new Set(progressMessageIds).size, progressMessageIds.length)
    assert.ok(progressMessageIds.every((messageId) => !/pipeline-status$/u.test(messageId)))
    const durableProductionMessages = writingMessages.filter((message) =>
      ["draft_completed", "quality_gate_completed", "chapter_artifacts_saved"].includes(String(message.metadata?.step || ""))
        && message.metadata?.directorCommandId
    )
    assert.ok(durableProductionMessages.every(Boolean))
    assert.ok(durableProductionMessages.length >= 3)
    assert.equal(new Set(durableProductionMessages.map((message) => message.id)).size, durableProductionMessages.length)
    assert.ok(durableProductionMessages.every((message) => message.metadata?.directorCommandId))
    assert.ok(durableProductionMessages.every((message) => String(message.id || "").includes(message.metadata.directorCommandId)))
    assert.equal(progressMessagesByStep.get("chapter_started")?.status, "completed")
    assert.equal(progressMessagesByStep.get("memory_update_started")?.status, "completed")
    assert.ok(writingMessages.every((message) =>
      message.status !== "streaming" || /_llm_(started|streaming)$/u.test(String(message.metadata?.step || "")),
    ))
    assert.ok(writingMessages.some((message) => /chapter_artifacts_saved/.test(String(message.data.content || ""))))
    assert.ok(writingMessages.some((message) =>
      message.metadata?.step === "draft_knowledge_recalled"
      && /RAG/.test(String(message.data.content || "")),
    ))
    assert.ok(writingMessages.some((message) => message.data.agentType === "memory_keeper"))
    const completedWritingMessage = writingMessages.find((message) =>
      message.metadata?.step === "chapter_artifacts_saved"
      && message.data.phase === "completed",
    )
    assert.ok(completedWritingMessage)
    assert.equal(completedWritingMessage.data.phase, "completed")
    assert.match(String(completedWritingMessage.data.statusText || ""), /完成|保存/)
    assert.ok(completedWritingMessage.parts.some((part) =>
      part.type === "json" && part.data.phase === "completed" && /完成|保存/.test(String(part.data.statusText || "")),
    ))
    const writingArtifactMessage = writingMessages.find((message) =>
      message.parts?.some((part) => part.type === "artifact" && /chapter-001\.final\.md/.test(part.data.path)),
    )
    assert.ok(writingArtifactMessage)
    assert.ok(writingArtifactMessage.parts.some((part) => part.type === "markdown"))
    assert.ok(writingArtifactMessage.parts.some((part) => part.type === "json" && part.data.step === "chapter_artifacts_saved"))
    assert.ok(writingArtifactMessage.parts.some((part) => part.type === "artifact" && /chapter-001\.final\.md/.test(part.data.path)))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("cover generation failure is saved without blocking retry", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-cover-failure-"))
  const { createManagedAutonomousProject, prepareCoverGeneration, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A border archivist guards the last map of heaven",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })

    const state = await prepareCoverGeneration(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      reason: "test",
    })

    assert.equal(state.assets.cover.status, "failed")
    assert.equal(state.assets.cover.promptPath, ".ai-novel/assets/cover/cover-prompt.md")
    assert.equal(state.assets.cover.imagePath, ".ai-novel/assets/cover/cover.png")
    assert.equal(state.assets.cover.metadataPath, ".ai-novel/assets/cover/cover-metadata.json")
    assert.match(state.assets.cover.error, /image_generation_skipped_in_test_mode/)

    const prompt = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "assets", "cover", "cover-prompt.md"), "utf8")
    assert.match(prompt, /Cover Image Prompt/)
    assert.match(prompt, /## Visual Brief/)
    assert.match(prompt, /## Final Image Prompt/)
    assert.match(prompt, /do not render any letters/i)
    assert.match(prompt, /cheap mobile-game aesthetics/i)
    const brief = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "assets", "cover", "cover-brief.md"), "utf8")
    assert.match(brief, /Cover Visual Brief/)
    assert.match(brief, /Primary cover concept/)
    const metadata = JSON.parse(await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "assets", "cover", "cover-metadata.json"), "utf8"))
    assert.equal(metadata.status, "failed")
    assert.equal(metadata.briefPath, ".ai-novel/assets/cover/cover-brief.md")
    assert.equal(metadata.briefSource, "fallback")
    assert.match(metadata.error, /image_generation_skipped_in_test_mode/)

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(snapshot.latestEvents.some((event) => event.type === "COVER_IMAGE_FAILED"))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("worldbuilding advance attempts cover generation but still reaches setting review", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-cover-nonblocking-"))
  const { createManagedAutonomousProject, advanceAutonomousProject } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A lighthouse keeper bargains with a drowned empire",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(advanced.runtime.stage, "setting_review")
    assert.equal(advanced.assets.cover.status, "failed")
    assert.match(advanced.assets.cover.error, /image_generation_skipped_in_test_mode/)
    await fs.stat(path.join(created.project.projectRoot, ".ai-novel", "plans", "setting-freeze.md"))
    await fs.stat(path.join(created.project.projectRoot, ".ai-novel", "assets", "cover", "cover-metadata.json"))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("advance recovers in-progress chapter tasks without final artifacts before completing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-recover-inprogress-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A clerk repairs a broken dynasty through ledgers",
	      totalChapters: 2,
	      chapterWordTarget: 2500,
	    })
		    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })

    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "complete"
    state.plan.chapterTasks[0].status = "in_progress"
    state.plan.chapterTasks[1].status = "complete"
    state.plan.pendingChapters = 0
    await saveAutonomousState(created.project.projectRoot, state)

    const recovered = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(recovered.plan.chapterTasks[0].status, "complete")
    assert.equal(recovered.runtime.stage, "complete")
    const finalChapter = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md"),
      "utf8",
    )
    assert.match(finalChapter, /Final Body/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("drafting does not start a later chapter while a chapter is still in progress", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-no-skip-inprogress-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk must finish chapter one before chapter two",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })

    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "in_progress"
    state.plan.chapterTasks[1].status = "pending"
    state.plan.pendingChapters = 1
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => {
      db.updateProjectState(created.project.id, state)
      db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
        step: "draft_generation_llm_streaming",
        role: "Author",
        chapterNumber: 1,
        status: "running",
        message: "Chapter one is still streaming.",
      })
    })

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(advanced.runtime.stage, "drafting")
    assert.equal(advanced.plan.chapterTasks[0].status, "in_progress")
    assert.equal(advanced.plan.chapterTasks[1].status, "pending")
    assert.match(advanced.runtime.statusMessage, /Chapter 1 is still in progress/)
    await assert.rejects(
      fs.access(path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-002.final.md")),
    )
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("advance reconciles completed chapter tasks whose quality gate is blocked", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-reconcile-quality-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk audits the last winter of an empire",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const state = created.state
  state.runtime.stage = "drafting"
  state.plan.chapterTasks[0].status = "complete"
  state.plan.chapterTasks[0].qualityGate = {
    passed: false,
    score: 5,
    status: "blocked",
    attempts: 1,
    reason: "word count too low",
    wordCount: 600,
    targetWords: 2500,
  }
  state.plan.pendingChapters = 1
  await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), `${JSON.stringify(state, null, 2)}\n`)

  const reconciled = await advanceAutonomousProject(created.project.projectRoot, {
    factoryRootDir: tempDir,
    projectId: created.project.id,
    preferDeterministicPlanning: true,
  })

  assert.equal(reconciled.plan.chapterTasks[0].status, "blocked")
  assert.equal(reconciled.plan.chapterTasks[0].qualityGate.status, "blocked")
  assert.equal(reconciled.runtime.stage, "reviewing")
  assert.match(reconciled.runtime.statusMessage, /Reconciled 1 chapter task/)
  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.latestEvents.some((event) => event.type === "CHAPTER_STATUS_RECONCILED"))
})

test("drafting advances the oldest blocked chapter before later pending chapters", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-oldest-blocked-first-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A clerk must finish earlier chapters before later ones",
	      totalChapters: 3,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "blocked"
    state.plan.chapterTasks[0].qualityGate = {
      passed: false,
      status: "blocked",
      score: 5,
      attempts: 1,
      reason: "chapter one failed",
    }
    state.plan.chapterTasks[1].status = "pending"
    state.plan.chapterTasks[2].status = "pending"
    state.plan.pendingChapters = 2
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.ok(["complete", "blocked"].includes(advanced.plan.chapterTasks[0].status))
    assert.equal(advanced.plan.chapterTasks[0].recoveryAttempts, 1)
    assert.equal(advanced.plan.chapterTasks[1].status, "pending")
    assert.equal(advanced.plan.chapterTasks[2].status, "pending")
    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const chapterOneFact = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1)
    assert.ok(chapterOneFact?.recoveryQueuedAt)
    assert.equal(chapterOneFact.status, "complete")
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("chapter recovery queued after a blocked quality gate does not reconcile back to blocked", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-recovery-no-loop-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A clerk escapes a recovery loop",
	      totalChapters: 2,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "reviewing"
    state.plan.chapterTasks[0].status = "blocked"
    state.plan.chapterTasks[0].qualityGate = {
      passed: false,
      status: "blocked",
      score: 5,
      attempts: 2,
      reason: "needs another pass",
      wordCount: 1200,
      targetWords: 2500,
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
    }
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => {
      db.updateProjectState(created.project.id, state)
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: ".ai-novel/chapters/chapter-001.final.md",
        status: "completed",
        metadata: {
          chapterNumber: 1,
          pass: "final",
          qualityGate: state.plan.chapterTasks[0].qualityGate,
        },
      })
      db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
        step: "chapter_artifacts_saved",
        role: "Memory Keeper",
        chapterNumber: 1,
        status: "blocked",
        qualityGate: state.plan.chapterTasks[0].qualityGate,
      })
    })

    const queued = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    assert.equal(queued.runtime.stage, "drafting")
    assert.equal(queued.plan.chapterTasks[0].status, "pending")
    assert.ok(queued.plan.chapterTasks[0].recoveryQueuedAt)

    const next = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.notEqual(next.runtime.lastAction, "reconciled_chapter_facts")
    assert.equal(next.runtime.stage, "drafting")
    assert.equal(next.plan.chapterTasks[0].status, "complete")
    assert.equal(next.plan.chapterTasks[1].status, "pending")

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const chapterOneFact = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1)
    assert.equal(chapterOneFact.latestTaskStatus, "in_progress")
    assert.equal(chapterOneFact.status, "complete")
    const reconciledEvents = snapshot.latestEvents.filter((event) => event.type === "CHAPTER_STATUS_RECONCILED")
    assert.equal(reconciledEvents.length, 0)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("chapter queue reset makes old non-complete chapter facts pending for fresh writing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-queue-reset-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk restarts a confused chapter queue",
      totalChapters: 3,
      chapterWordTarget: 2500,
    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "complete"
    state.plan.chapterTasks[0].qualityGate = {
      status: "passed",
      score: 8,
      attempts: 1,
      reason: "ok",
      wordCount: 2800,
      targetWords: 2500,
      updatedAt: new Date(Date.now() - 120_000).toISOString(),
    }
    state.plan.chapterTasks[1].status = "blocked"
    state.plan.chapterTasks[1].recoveryAttempts = 4
    state.plan.chapterTasks[1].recoveryBlocked = true
    state.plan.chapterTasks[1].recoveryQueuedAt = new Date(Date.now() - 90_000).toISOString()
    state.plan.chapterTasks[1].qualityGate = {
      status: "blocked",
      score: 4,
      attempts: 2,
      reason: "old blocker",
      wordCount: 900,
      targetWords: 2500,
      updatedAt: new Date(Date.now() - 90_000).toISOString(),
    }
    state.plan.chapterTasks[1].contentQuality = {
      status: "quarantined",
      reason: "old blocker",
      wordCount: 900,
      targetWords: 2500,
      minimumWords: 2000,
    }
    state.plan.chapterTasks[2].status = "pending"
    state.plan.pendingChapters = 1
    await saveAutonomousState(created.project.projectRoot, state)

    await withFactoryDb(tempDir, async (db) => {
      db.updateProjectState(created.project.id, state)
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: ".ai-novel/chapters/chapter-001.final.md",
        status: "completed",
        metadata: {
          chapterNumber: 1,
          pass: "final",
          qualityGate: state.plan.chapterTasks[0].qualityGate,
        },
      })
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: ".ai-novel/chapters/chapter-002.final.md",
        status: "completed",
        metadata: {
          chapterNumber: 2,
          pass: "final",
          qualityGate: state.plan.chapterTasks[1].qualityGate,
        },
      })
      db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
        step: "chapter_artifacts_saved",
        role: "Memory Keeper",
        chapterNumber: 2,
        status: "blocked",
        qualityGate: state.plan.chapterTasks[1].qualityGate,
      })
      db.recordEvent(created.project.id, null, "CHAPTER_QUEUE_RESET", {
        resetChapters: [2, 3],
        preservedCompleteChapters: [1],
        reason: "operator requested fresh queue",
      })
    })

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).status, "complete")
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2).status, "pending")
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2).qualityGate, undefined)
    assert.ok(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2).resetAt)

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      preferDeterministicPlanning: true,
    })

    assert.equal(advanced.runtime.stage, "drafting")
    assert.equal(advanced.plan.chapterTasks[0].status, "complete")
    assert.equal(advanced.plan.chapterTasks[1].status, "pending")
    assert.equal(advanced.plan.chapterTasks[1].qualityGate, undefined)
    assert.equal(advanced.plan.chapterTasks[1].contentQuality, undefined)
    assert.equal(advanced.plan.chapterTasks[1].recoveryAttempts, 0)
    assert.equal(advanced.plan.chapterTasks[2].status, "pending")
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("automatic recovery requeues low scoring chapters at the recovery limit", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-auto-recovery-limit-reviewing-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk must not loop forever on a failed chapter",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const state = await loadAutonomousState(created.project.projectRoot)
  state.runtime.stage = "reviewing"
  state.plan.chapterTasks[0].status = "blocked"
  state.plan.chapterTasks[0].recoveryAttempts = 3
  state.plan.chapterTasks[0].recoveryBlocked = false
  state.plan.chapterTasks[0].qualityGate = {
    passed: false,
    status: "blocked",
    score: 5,
    attempts: 2,
    reason: "chapter one failed",
  }
  state.plan.chapterTasks[1].status = "pending"
  state.plan.pendingChapters = 1
  await saveAutonomousState(created.project.projectRoot, state)
  await withFactoryDb(tempDir, async (db) => {
    db.updateProjectState(created.project.id, state)
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      status: "completed",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: state.plan.chapterTasks[0].qualityGate,
      },
    })
    db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_BLOCKED", {
      chapterNumber: 1,
      finalPath: ".ai-novel/chapters/chapter-001.final.md",
      reportPath: ".ai-novel/reports/chapter-001-quality.md",
      qualityGate: state.plan.chapterTasks[0].qualityGate,
    })
  })

  const advanced = await advanceAutonomousProject(created.project.projectRoot, {
    factoryRootDir: tempDir,
    projectId: created.project.id,
  })

  assert.equal(advanced.runtime.stage, "drafting")
  assert.equal(advanced.plan.chapterTasks[0].status, "pending")
  assert.equal(advanced.plan.chapterTasks[0].recoveryBlocked, false)
  assert.equal(advanced.plan.chapterTasks[0].recoveryAttempts, 0)
  assert.equal(advanced.plan.chapterTasks[1].status, "pending")
  assert.match(advanced.runtime.statusMessage, /fresh production pass/)
  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED"))
})

test("automatic recovery never auto-approves high scoring chapters at the recovery limit", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-auto-recovery-no-auto-approve-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A clerk must continue unattended after a high scoring review",
	      totalChapters: 2,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "reviewing"
    state.plan.chapterTasks[0].status = "blocked"
    state.plan.chapterTasks[0].recoveryAttempts = 3
    state.plan.chapterTasks[0].recoveryBlocked = false
    state.plan.chapterTasks[0].qualityGate = {
      status: "blocked",
      score: 8,
      attempts: 2,
      reason: "质量报告包含阻塞或返工信号。",
      wordCount: 3200,
      targetWords: 2500,
      updatedAt: "2026-06-04T00:00:00.000Z",
    }
    state.plan.chapterTasks[1].status = "pending"
    state.plan.pendingChapters = 1
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => {
      db.updateProjectState(created.project.id, state)
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: ".ai-novel/chapters/chapter-001.final.md",
        status: "completed",
        metadata: {
          chapterNumber: 1,
          pass: "final",
          qualityGate: state.plan.chapterTasks[0].qualityGate,
        },
      })
      db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_BLOCKED", {
        chapterNumber: 1,
        finalPath: ".ai-novel/chapters/chapter-001.final.md",
        reportPath: ".ai-novel/reports/chapter-001-quality.md",
        qualityGate: state.plan.chapterTasks[0].qualityGate,
      })
    })

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(advanced.plan.chapterTasks[0].status, "pending")
    assert.equal(advanced.plan.chapterTasks[0].recoveryBlocked, false)
    assert.equal(advanced.plan.chapterTasks[0].recoveryAttempts, 0)
    assert.equal(advanced.plan.chapterTasks[0].qualityGate.status, "blocked")
    assert.equal(advanced.runtime.stage, "drafting")
    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(snapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED"))
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).status, "pending")
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).qualityGate.status, "blocked")

    const next = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    assert.notEqual(next.runtime.lastAction, "reconciled_chapter_facts")
    assert.equal(next.plan.chapterTasks[0].status, "complete")
    assert.equal(next.plan.chapterTasks[0].qualityGate.status, "passed")
    assert.equal(next.plan.chapterTasks[1].status, "pending")
    const nextSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(nextSnapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).status, "complete")
    assert.equal(nextSnapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).qualityGate.status, "passed")
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("drafting requeues a recovery-limited blocked chapter before later chapters", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-auto-recovery-limit-drafting-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A clerk cannot start chapter two while chapter one is blocked",
	      totalChapters: 2,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "blocked"
    state.plan.chapterTasks[0].recoveryAttempts = 3
    state.plan.chapterTasks[0].recoveryBlocked = false
    state.plan.chapterTasks[0].qualityGate = {
      passed: false,
      status: "blocked",
      score: 5,
      attempts: 2,
      reason: "chapter one failed",
    }
    state.plan.chapterTasks[1].status = "pending"
    state.plan.pendingChapters = 1
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(advanced.runtime.stage, "drafting")
    assert.equal(advanced.plan.chapterTasks[0].status, "complete")
    assert.equal(advanced.plan.chapterTasks[0].recoveryBlocked, false)
    assert.equal(advanced.plan.chapterTasks[0].recoveryAttempts, 0)
    assert.equal(advanced.plan.chapterTasks[1].status, "pending")
    await assert.rejects(
      fs.access(path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-002.final.md")),
    )
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("production writing pipeline blocks low quality chapters after automatic revisions", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-quality-block-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, retryChapterProduction, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A provincial judge investigates poems that alter verdicts",
	      totalChapters: 4,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })

    let readyState = created.state
    for (let attempt = 0; attempt < 8 && readyState.runtime.stage !== "chapter_task_generation"; attempt += 1) {
      readyState = await advanceAutonomousProject(created.project.projectRoot, {
        factoryRootDir: tempDir,
        projectId: created.project.id,
      })
    }
    assert.equal(readyState.runtime.stage, "chapter_task_generation")
    await writeStoryFoundationApprovalForTest(created.project.projectRoot, {
      note: "测试重新确认自动生成后的故事基建资产。",
    })
    const state = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      forceQualityScoreForTest: 5,
      maxRevisionAttempts: 1,
    })

    assert.equal(state.runtime.stage, "reviewing")
    assert.equal(state.plan.chapterTasks[0].status, "blocked")
    assert.match(state.runtime.statusMessage, /quality gate/)

    const report = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "reports", "chapter-001-quality.md"),
      "utf8",
    )
    assert.match(report, /综合评分 \| 5\/10/)

    const finalChapter = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md"),
      "utf8",
    )
    assert.match(finalChapter, /Status: blocked/)
    assert.match(finalChapter, /Attempts: 1/)

    const blockedEvent = await withFactoryDb(tempDir, async (db) => db.db.prepare(`
      SELECT payload_json
      FROM events
      WHERE project_id = ?
        AND type = 'CHAPTER_PIPELINE_BLOCKED'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(created.project.id))
    assert.ok(blockedEvent)
    const blockedPayload = JSON.parse(blockedEvent.payload_json)
    assert.equal(blockedPayload.qualityGate.status, "blocked")
    assert.equal(blockedPayload.qualityGate.score, 5)

    const recovered = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    assert.equal(recovered.runtime.stage, "drafting")
    assert.equal(recovered.plan.chapterTasks[0].status, "pending")
    assert.equal(recovered.plan.chapterTasks[0].recoveryAttempts, 1)
    assert.equal(recovered.plan.chapterTasks[0].qualityGate.status, "blocked")

    const recoveredSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const recoveryEvent = recoveredSnapshot.latestEvents.find((event) => event.type === "CHAPTER_PIPELINE_RECOVERY_QUEUED")
    assert.ok(recoveryEvent)
    assert.equal(JSON.parse(recoveryEvent.payload_json).recoveryAttempts, 1)

    recovered.plan.chapterTasks[0].status = "blocked"
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, recovered))
    await fs.writeFile(
      path.join(created.project.projectRoot, ".ai-novel", "state.json"),
      `${JSON.stringify(recovered, null, 2)}\n`,
    )
    const explicitlyRetried = await retryChapterProduction(created.project.projectRoot, 1, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      runNow: true,
    })
    assert.equal(explicitlyRetried.plan.chapterTasks[0].status, "blocked")
    assert.equal(explicitlyRetried.plan.chapterTasks[0].recoveryAttempts, 2)
    assert.equal(explicitlyRetried.plan.chapterTasks[0].qualityGate.status, "blocked")

    explicitlyRetried.plan.chapterTasks[0].status = "blocked"
    explicitlyRetried.plan.chapterTasks[0].recoveryAttempts = 3
    await fs.writeFile(
      path.join(created.project.projectRoot, ".ai-novel", "state.json"),
      `${JSON.stringify(explicitlyRetried, null, 2)}\n`,
    )
    const limited = await retryChapterProduction(created.project.projectRoot, 1, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      maxRecoveryAttempts: 3,
    })
    assert.equal(limited.plan.chapterTasks[0].status, "pending")
    assert.equal(limited.plan.chapterTasks[0].recoveryBlocked, false)
    assert.equal(limited.plan.chapterTasks[0].recoveryAttempts, 0)
    assert.match(limited.runtime.statusMessage, /fresh production pass/)
    const limitedSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(limitedSnapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED"))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("production writing pipeline blocks chapters that fail AIGC detection after final naturalness", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-aigc-quality-block-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE

  const server = http.createServer(async (request, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ aiProbability: 0.97, label: "AI", confidence: 0.97 }))
  })
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve)
    server.once("error", reject)
  })
  const address = server.address()
  assert.ok(address && typeof address === "object")

  process.env.AI_NOVEL_TEST_MODE = "1"
  await writeAigcDetectorSettings(tempDir, `http://127.0.0.1:${address.port}/detect`, {
    segmentMaxChars: 600,
  })

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A clerk records unnatural edicts in a collapsing dynasty",
	      totalChapters: 2,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })

    const state = created.state
    state.runtime.stage = "drafting"
    await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), `${JSON.stringify(state, null, 2)}\n`)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      maxRevisionAttempts: 0,
    })

    assert.equal(advanced.runtime.stage, "reviewing")
    assert.equal(advanced.plan.chapterTasks[0].status, "blocked")
    assert.equal(advanced.plan.chapterTasks[0].qualityGate.status, "blocked")
    assert.match(advanced.plan.chapterTasks[0].qualityGate.reason, /AIGC 检测阻塞/)

    const report = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "reports", "chapter-001-quality.md"),
      "utf8",
    )
    assert.match(report, /## AIGC Detection/)
    assert.match(report, /Status: blocked/)
    assert.match(report, /High Risk Segment Previews/)

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const blockedEvent = snapshot.latestEvents.find((event) => event.type === "CHAPTER_PIPELINE_BLOCKED")
    assert.ok(blockedEvent)
    const blockedFact = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1)
    assert.equal(blockedFact?.qualityGate.status, "blocked")
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) delete process.env.AI_NOVEL_TEST_MODE
    else process.env.AI_NOVEL_TEST_MODE = previousTestMode
  }
})

test("production writing pipeline keeps quality LLM roles while defaulting long-form drafting to fast gates", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")

  assert.match(source, /roleName:\s*"Showrunner"/)
  assert.match(source, /roleName:\s*"Chapter Planner"/)
  assert.match(source, /roleName:\s*"Author"/)
  assert.match(source, /roleName:\s*"Editor"/)
  assert.match(source, /roleName:\s*"Prose Stylist"/)
  assert.match(source, /ProductionWritingMode = "fast" \| "quality"/)
  assert.match(source, /AI_NOVEL_WRITING_MODE/)
  assert.match(source, /shouldUseLlmQualityPass/)
  assert.match(source, /shouldUseLlmPolishPass/)
  assert.match(source, /createMasterOutlineContent/)
  assert.match(source, /createChapterBlueprintContent/)
  assert.match(source, /AI_NOVEL_TEST_MODE === "1"/)
})

test("production master planning can fall back when provider is temporarily unavailable", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")

  assert.match(source, /LLM_FALLBACK_USED/)
  assert.match(source, /deterministic_master_outline/)
  assert.match(source, /timed\\s\*out/)
})

test("unattended deterministic mode is limited to planning and cannot bypass production drafting", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")
  const orchestratorSource = await fs.readFile(path.join(packageRoot, "src", "orchestrator.ts"), "utf8")

  assert.match(source, /options\.preferDeterministicPlanning/)
  assert.match(source, /createDetailedChapterBlueprint/)
  assert.doesNotMatch(source, /function createDraftBody[\s\S]*?AI_NOVEL_TEST_MODE === "1" \|\| options\.preferDeterministicPlanning/)
  assert.doesNotMatch(source, /function createProductionQualityReport[\s\S]*?AI_NOVEL_TEST_MODE === "1" \|\| options\.preferDeterministicPlanning/)
  assert.doesNotMatch(source, /function reviseDraftForQualityGate[\s\S]*?AI_NOVEL_TEST_MODE === "1" \|\| options\.preferDeterministicPlanning/)
  assert.doesNotMatch(source, /function createProductionPolishedDraft[\s\S]*?AI_NOVEL_TEST_MODE === "1" \|\| options\.preferDeterministicPlanning/)
  assert.match(source, /WORD_COUNT_CHECK/)
  assert.match(orchestratorSource, /state\.runtime\.stage = "drafting"/)
})

test("quality gate parser ignores non-blocking blocker language when score passes", async () => {
  const { parseQualityGate } = await loadCore()
  const gate = parseQualityGate([
    "# Chapter Quality Report",
    "",
    "| 综合评分 | 8/10 | 可进入润色。 |",
    "",
    "WORD_COUNT_CHECK: 2200/2500",
    "",
    "## Required Fixes",
    "- 暂无阻塞性问题；润色时继续压低 AI 模板句。",
  ].join("\n"), 0, 2)

  assert.equal(gate.status, "passed")
  assert.equal(gate.passed, true)
})

test("autopilot worker status and once modes expose operational state", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-worker-status-"))
  const { createManagedAutonomousProject, getNovelAutopilotWorkerStatus, runNovelAutopilotWorkerOnce, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A scribe restores kingdoms from rain ledgers",
      totalChapters: 5,
      chapterWordTarget: 2500,
    })
    await withFactoryDb(tempDir, async (db) =>
      db.createJob({
        projectId: created.project.id,
        kind: "autopilot",
        status: "running",
        payload: { message: "continue" },
      }),
    )

    const before = await getNovelAutopilotWorkerStatus(tempDir)
    assert.equal(before.service, "ai-novel-worker")
    assert.equal(before.factory.jobs.runnable, 1)

    const after = await runNovelAutopilotWorkerOnce(tempDir)
    assert.equal(after.ok, true)
    assert.ok(after.factory.latestEvents.some((event) => event.type === "JOB_RESTORE_READY"))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("autopilot worker treats provider network failures as resumable retries", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /isTransientNetworkError/)
  assert.match(source, /classifyTransientNetworkError/)
  assert.match(source, /network_retry/)
  assert.match(source, /timed\\s\*out/)
  assert.match(source, /rate_limit/)
  assert.match(source, /provider_unavailable/)
  assert.match(source, /network_retry_paused/)
  assert.match(source, /nextNetworkRetryDelay/)
  assert.match(source, /heartbeatJob\(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS\)/)
  assert.match(source, /模型响应超时，正在自动重试/)
  assert.match(source, /模型服务触发限流/)
})

test("autopilot stop aborts active worker model calls instead of waiting for the current round", async () => {
  const workerSource = await fs.readFile(autopilotWorkerSource, "utf8")
  const serverSource = await fs.readFile(path.join(packageRoot, "src", "studio-server.ts"), "utf8")
  const runtimeSource = await fs.readFile(path.join(packageRoot, "src", "runtime-llm.ts"), "utf8")
  const pipelineSource = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")
  const discussionSource = await fs.readFile(path.join(packageRoot, "src", "discussion.ts"), "utf8")

  assert.match(workerSource, /controller: AbortController/)
  assert.match(workerSource, /stopAutopilotJob/)
  assert.match(workerSource, /job\.controller\.abort\(\)/)
  assert.match(workerSource, /controller\.abort\(\)/)
  assert.match(workerSource, /startJobLeaseHeartbeat[\s\S]*listProjectJobs/)
  assert.match(workerSource, /signal,\s*\n\s*onProgress/)
  assert.match(workerSource, /runMultiAgentDiscussion[\s\S]*signal,/)
  assert.match(workerSource, /latestJob && latestJob\.status !== "running" && latestJob\.status !== "paused"/)
  assert.match(workerSource, /sleep\(delayMs, signal\)/)
  assert.match(serverSource, /stopAutopilotJob\(context\.projectRoot\)/)
  assert.match(serverSource, /正在中断当前模型请求/)
  assert.match(runtimeSource, /signal\?: AbortSignal/)
  assert.match(runtimeSource, /requestLlmTextCompletion[\s\S]*withTimeout\(options\.timeoutMs[\s\S]*options\.signal\)/)
  assert.match(runtimeSource, /generateAgentReply[\s\S]*requestLlmTextCompletion[\s\S]*signal:\s*options\.signal/)
  assert.match(pipelineSource, /signal\?: AbortSignal/)
  assert.match(pipelineSource, /signal: options\.signal/)
  assert.match(pipelineSource, /throwIfPipelineAborted/)
  assert.match(discussionSource, /signal\?: AbortSignal/)
  assert.match(discussionSource, /signal: options\.signal/)
})

test("streaming LLM reads are abortable by the provider inactivity timeout", async () => {
  const runtimeSource = await fs.readFile(path.join(packageRoot, "src", "runtime-llm.ts"), "utf8")

  assert.match(runtimeSource, /streamOpenAiCompatibleResponse\([\s\S]*signal:\s*AbortSignal[\s\S]*markActivity/)
  assert.match(runtimeSource, /options\.signal\.addEventListener\("abort",\s*abortRead,\s*\{\s*once:\s*true\s*\}\)/)
  assert.match(runtimeSource, /reader\.cancel\(\)\.catch\(\(\) => undefined\)/)
  assert.match(runtimeSource, /reader\.releaseLock\(\)/)
  assert.match(runtimeSource, /streamOpenAiCompatibleResponse\(response,[\s\S]*signal,[\s\S]*markActivity,/)
})

test("streaming LLM request times out when provider opens SSE but sends no chunks", async () => {
  const { generateAgentReply, withFactoryDb } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-stream-timeout-"))
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const hangingResponses = new Set()
  const server = http.createServer((request, response) => {
    if (request.url === "/chat/completions") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      })
      hangingResponses.add(response)
      response.on("close", () => hangingResponses.delete(response))
      return
    }

    response.writeHead(404).end()
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    delete process.env.AI_NOVEL_TEST_MODE
    await withFactoryDb(tempDir, async (db) => {
      db.addLlmConfig({
        name: "Timeout Test",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiKey: "test-key",
        modelName: "test-model",
        timeoutMs: 30,
        isActive: true,
      })
    })

    await assert.rejects(
      () => generateAgentReply({
        roleName: "Author",
        basePrompt: "You write fiction.",
        dynamicPrompt: "Write one sentence.",
        consensus: "Test",
        message: "Start",
        envRootDir: tempDir,
        onDelta: () => undefined,
      }),
      /LLM request timed out after 30ms without provider activity/,
    )
  } finally {
    for (const response of hangingResponses) {
      response.destroy()
    }
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("streaming LLM accepts provider delta text from alternate content fields", async () => {
  const { generateAgentReply, withFactoryDb } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-stream-delta-"))
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const server = http.createServer((request, response) => {
    if (request.url === "/chat/completions") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "林尘" } }] })}\n\n`)
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: [{ type: "text", text: "推门而入。" }] } }] })}\n\n`)
      response.write("data: [DONE]\n\n")
      response.end()
      return
    }

    response.writeHead(404).end()
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    delete process.env.AI_NOVEL_TEST_MODE
    await withFactoryDb(tempDir, async (db) => {
      db.addLlmConfig({
        name: "Streaming Test",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiKey: "test-key",
        modelName: "test-model",
        timeoutMs: 1000,
        isActive: true,
      })
    })

    let streamed = ""
    const reply = await generateAgentReply({
      roleName: "Author",
      basePrompt: "You write fiction.",
      dynamicPrompt: "Write one sentence.",
      consensus: "Test",
      message: "Start",
      currentStage: "drafting",
      envRootDir: tempDir,
      onDelta: (delta) => { streamed += delta },
    })

    assert.equal(reply, "林尘推门而入。")
    assert.equal(streamed, "林尘推门而入。")
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("LLM responses mode generates text via /responses", async () => {
  const { generateAgentReply, withFactoryDb } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-llm-responses-"))
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  let receivedBody = null
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        receivedBody = JSON.parse(rawBody)
        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        })
        response.write(`event: response.created\n`)
        response.write(`data: ${JSON.stringify({ type: "response.created" })}\n\n`)
        response.write(`event: response.output_text.delta\n`)
        response.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "中转站模型" })}\n\n`)
        response.write(`event: response.output_text.delta\n`)
        response.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: "连通性测试成功。" })}\n\n`)
        response.write(`event: response.completed\n`)
        response.write(`data: ${JSON.stringify({ type: "response.completed" })}\n\n`)
        response.end()
        return
      }

      response.writeHead(404).end()
    })
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    delete process.env.AI_NOVEL_TEST_MODE
    await withFactoryDb(tempDir, async (db) => {
      db.addLlmConfig({
        name: "Responses Test",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiKey: "test-key",
        modelName: "test-model",
        apiMode: "responses",
        timeoutMs: 1000,
        isActive: true,
      })
    })

    let streamed = ""
    const reply = await generateAgentReply({
      roleName: "Author",
      basePrompt: "You write fiction.",
      dynamicPrompt: "Write one sentence.",
      consensus: "Test",
      message: "Start",
      currentStage: "drafting",
      envRootDir: tempDir,
      onDelta: (delta) => { streamed += delta },
    })

    assert.equal(reply, "中转站模型连通性测试成功。")
    assert.equal(streamed, "中转站模型连通性测试成功。")
    assert.equal(receivedBody.model, "test-model")
    assert.equal(receivedBody.input, "Start")
    assert.equal(receivedBody.stream, true)
    assert.match(receivedBody.instructions, /You write fiction/)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("provider test uses routed responses mode when request omits api mode", async () => {
  const { handleNovelStudioApi } = await loadStudioServer()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-provider-test-route-"))
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  let responsesHit = false
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/models") {
        response.writeHead(404, { "content-type": "text/plain" })
        response.end("Not Found")
        return
      }
      if (request.url === "/responses") {
        responsesHit = true
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ output_text: "pong" }))
        return
      }
      response.writeHead(404).end()
    })
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    delete process.env.AI_NOVEL_TEST_MODE

    const saveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Responses Test",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "test-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(saveResponse.status, 200)

    const testResponse = await handleNovelStudioApi(tempDir, "POST", "/api/provider-test", {})

    assert.equal(testResponse.status, 200)
    assert.equal(testResponse.payload.result.ok, true)
    assert.equal(testResponse.payload.result.apiMode, "responses")
    assert.equal(responsesHit, true)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("provider test keeps generation fallback error when models endpoint is unsupported", async () => {
  const { handleNovelStudioApi } = await loadStudioServer()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-provider-test-fallback-error-"))
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const server = http.createServer((request, response) => {
    request.on("data", () => {})
    request.on("end", () => {
      if (request.url === "/models") {
        response.writeHead(404, { "content-type": "text/plain" })
        response.end("Not Found")
        return
      }
      if (request.url === "/responses") {
        response.writeHead(401, { "content-type": "text/plain" })
        response.end("Invalid API key:test-tail")
        return
      }
      response.writeHead(404).end()
    })
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    delete process.env.AI_NOVEL_TEST_MODE

    const saveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Responses Key Failure",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "test-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(saveResponse.status, 200)

    const testResponse = await handleNovelStudioApi(tempDir, "POST", "/api/provider-test", {})

    assert.equal(testResponse.status, 200)
    assert.equal(testResponse.payload.result.ok, false)
    assert.match(testResponse.payload.result.message, /status 404/)
    assert.match(testResponse.payload.result.message, /generation fallback failed/)
    assert.match(testResponse.payload.result.message, /status 401/)
    assert.match(testResponse.payload.result.message, /Invalid API key/)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("chat stream continue routes to autopilot instead of discussion", async () => {
  const { handleNovelStudioApi } = await loadStudioServer()
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-chat-stream-continue-"))
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A mortal cultivator discovers heaven is a locked system",
    title: "Route Test",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })
  const projectId = created.project.id

  const response = await handleNovelStudioApi(tempDir, "POST", "/api/chat-stream", {
    projectId,
    message: "继续",
  })

  assert.equal(response.status, 200)
  assert.equal(response.payload.discussion.target, "workflow_control")
  assert.equal(response.payload.discussion.writebackSkipped, true)
  assert.match(response.payload.discussion.summary, /无人值守推进/)
  assert.equal(response.payload.state.runtime.autopilot.running, true)

  const jobs = await withFactoryDb(tempDir, async (db) => db.listProjectJobs(projectId, "autopilot"))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].status, "running")
  assert.match(jobs[0].payload.message, /章节正文生产流程|首轮统一讨论/)

  const entries = Array.isArray(response.payload.entries) ? response.payload.entries : []
  const discussionMessages = entries.filter((entry) =>
    entry.conversationId && String(entry.conversationId).startsWith("run_discussion_") && entry.type === "agent"
  )
  assert.equal(discussionMessages.length, 0)
})

test("autopilot abort keeps durable jobs recoverable instead of cancelling them", async () => {
  const workerSource = await fs.readFile(autopilotWorkerSource, "utf8")
  const abortBranch = workerSource.match(/if \(controller\.signal\.aborted \|\| isAutopilotStopError\(error\)\) \{[\s\S]*?return\s*\n\s*\}/)?.[0] || ""

  assert.match(abortBranch, /db\.pauseJob\(options\.jobId as string\)/)
  assert.doesNotMatch(abortBranch, /db\.cancelJob\(options\.jobId as string\)/)
  assert.match(abortBranch, /任务仍可从数据库恢复/)
})

test("autopilot worker treats stage-guarded discussion writeback as recoverable", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")
  const directorSource = await fs.readFile(path.join(packageRoot, "src", "novel-director.ts"), "utf8")

  assert.match(directorSource, /isGenericAutopilotMessage/)
  assert.match(source, /canAdvanceDespiteGuard/)
  assert.match(source, /discussion\.writebackSkipped/)
  assert.match(source, /guard_recoverable/)
  assert.match(source, /无人值守流程继续按状态机推进/)
})

test("embedded studio start can release a stale durable job lease for takeover", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "studio-server.ts"), "utf8")
  const factorySource = await fs.readFile(path.join(packageRoot, "src", "factory-db.ts"), "utf8")

  assert.match(factorySource, /releaseJobLease/)
  assert.match(factorySource, /JOB_LEASE_RELEASED/)
  assert.match(source, /embedded_worker_start_takeover/)
  assert.match(source, /!isAutopilotRunning\(context\.projectRoot\)/)
  assert.match(source, /db\.releaseJobLease/)
  assert.match(source, /right\.updated_at \|\| right\.created_at/)
})

test("autopilot prioritizes production advance over discussion for generic continue messages", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")
  const directorSource = await fs.readFile(path.join(packageRoot, "src", "novel-director.ts"), "utf8")

  assert.match(source, /decideNovelDirectorCommand/)
  assert.match(source, /DIRECTOR_COMMAND_DECIDED/)
  assert.match(directorSource, /shouldAdvanceBeforeDiscussion/)
  assert.match(directorSource, /isGenericAutopilotMessage/)
  assert.match(directorSource, /state\.runtime\.stage === "complete"/)
  assert.match(directorSource, /every\(\(task\) => task\.status === "complete"\)/)
  assert.match(directorSource, /当前阶段已有足够上下文，优先推进生产状态机/)
  assert.match(source, /advanceFirst:\s*directorCommand\.advanceFirst/)
  assert.match(source, /preferDeterministicPlanning:\s*true/)
})

test("autopilot no-progress backoff waits for earlier active chapters before later pending work", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /function hasEarlierActiveTask/)
  assert.match(source, /task\.chapterNumber < chapterNumber && \(task\.status === "in_progress" \|\| task\.status === "blocked"\)/)
  assert.match(source, /latestPendingTask && !hasEarlierActiveTask\(latestState,\s*latestPendingTask\.chapterNumber\)/)
  assert.match(source, /lastStep:\s*staleActiveWritingMessage \? "stale_llm_recovery_pending" : activeWritingMessage \? "waiting_for_llm" : "no_progress_backoff"/)
})

test("autopilot waits for active writing messages before issuing another director command", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /async function backoffIfActiveWritingMessage/)
  assert.match(source, /await backoffIfActiveWritingMessage\(rootDir,\s*projectRoot,\s*projectId,\s*beforeDiscussion,\s*signal\)/)
  assert.match(source, /const directorCommand = decideNovelDirectorCommand/)
  assert.ok(
    source.indexOf("await backoffIfActiveWritingMessage(rootDir, projectRoot, projectId, beforeDiscussion, signal)")
      < source.indexOf("const directorCommand = decideNovelDirectorCommand"),
  )
})

test("autopilot requeues orphaned in-progress chapters before director decisions", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /async function recoverOrphanedInProgressWritingTask/)
  assert.match(source, /const activeWritingMessage = await findActiveWritingMessage\(rootDir,\s*projectId,\s*task\.chapterNumber\)/)
  assert.match(source, /if \(activeWritingMessage\) \{\s*return \{ recovered: false, state \}/)
  assert.match(source, /task\.status = "pending"/)
  assert.match(source, /orphaned_in_progress_recovered/)
  assert.match(source, /CHAPTER_TASK_STATUS_UPDATED/)
  assert.ok(
    source.indexOf("await recoverOrphanedInProgressWritingTask(rootDir, projectRoot, projectId, beforeDiscussion)")
      < source.indexOf("const directorCommand = decideNovelDirectorCommand"),
  )
})

test("autopilot stale LLM recovery requeues blocked chapters that still have an active writing message", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /async function recoverStaleWritingRequest/)
  assert.match(
    source,
    /const task = state\.plan\.chapterTasks\.find\(\(candidate\) =>\s*candidate\.status === "in_progress" \|\| candidate\.status === "blocked"\)/,
  )
  assert.match(source, /stale_llm_request_recovered/)
  assert.match(source, /task\.status = "pending"/)
})

test("novel director is the thin decision layer for unattended flow", async () => {
  const { initAutonomousProject, decideNovelDirectorCommand, createFollowUpAdvanceCommand } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-director-"))

  const state = await initAutonomousProject({
    rootDir: tempDir,
    idea: "A minor Tang clerk documents a collapsing capital",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  assert.equal(decideNovelDirectorCommand(state, { userMessage: "继续" }).type, "discuss")

  state.runtime.stage = "drafting"
  const advanceCommand = decideNovelDirectorCommand(state, { userMessage: "继续" })
  assert.match(advanceCommand.id, /^cmd_/)
  assert.deepEqual(
    { ...advanceCommand, id: "cmd_test" },
    {
      id: "cmd_test",
      type: "advance",
      stage: "drafting",
      reason: "当前阶段已有足够上下文，优先推进生产状态机。",
      advanceFirst: true,
      parentCommandId: null,
    },
  )

  assert.equal(
    decideNovelDirectorCommand(state, { userMessage: "请先检查主角动机" }).type,
    "discuss",
  )
  assert.equal(
    decideNovelDirectorCommand(state, {
      userMessage: "继续小说《Ghost Ledger》的章节正文生产流程。当前阶段：drafting。不要重新构思世界观、主角核心或主线方向。从第 2 章「Chapter 2」继续，按既有章节队列、角色档案、记忆和质量门禁推进。优先执行正文写作、质量修订、自然度/AIGC 检测与记忆写回，不要回到首轮设定讨论。",
    }).type,
    "advance",
  )
  assert.equal(
    decideNovelDirectorCommand(state, { userMessage: "继续", correctionMessage: "上一轮跑偏，请纠偏。" }).type,
    "discuss",
  )

  const discussCommand = decideNovelDirectorCommand(state, { userMessage: "请先检查主角动机" })
  const followUp = createFollowUpAdvanceCommand(state, discussCommand)
  assert.equal(followUp.type, "advance")
  assert.equal(followUp.parentCommandId, discussCommand.id)
  assert.notEqual(followUp.id, discussCommand.id)
})

test("director commands are traceable through worker execution events", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")
  const discussionSource = await fs.readFile(path.join(packageRoot, "src", "discussion.ts"), "utf8")
  const pipelineSource = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")

  assert.match(source, /DIRECTOR_COMMAND_DECIDED/)
  assert.match(source, /DIRECTOR_COMMAND_STARTED/)
  assert.match(source, /DIRECTOR_COMMAND_COMPLETED/)
  assert.match(source, /DIRECTOR_COMMAND_FAILED/)
  assert.match(source, /recordDirectorCommandEvent/)
  assert.doesNotMatch(source, /db\.recordEvent\(projectId,\s*null,\s*"DIRECTOR_COMMAND/)
  assert.match(source, /directorCommandId:\s*directorCommand\.id/)
  assert.match(source, /createFollowUpAdvanceCommand/)
  assert.match(source, /directorCommandId:\s*followUpAdvanceCommand\.id/)
  assert.match(source, /parentDirectorCommandId:\s*directorCommand\.id/)
  assert.match(discussionSource, /directorCommandId:\s*options\.directorCommandId/)
  assert.match(pipelineSource, /directorCommandId:\s*options\.directorCommandId/)
})

test("studio http server forwards ordinary json api routes through one adapter", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "studio-server.ts"), "utf8")
  const serverStartSource = source.slice(source.indexOf("export async function startNovelStudioServer"))
  const postApiWhitelistSource = source.slice(
    source.indexOf('if (method === "POST")'),
    source.indexOf('if (method === "DELETE")'),
  )

  assert.match(source, /function isJsonApiRequest/)
  assert.match(source, /"\/api\/reader-snapshot"/)
  assert.match(source, /"\/api\/reader-chapter"/)
  assert.match(source, /"\/api\/reader-chapter-versions\/compare"/)
  assert.match(source, /"\/api\/reader-search"/)
  assert.match(source, /"\/api\/reader-chapter-version"/)
  assert.match(postApiWhitelistSource, /"\/api\/style-evolution\/init"/)
  assert.match(postApiWhitelistSource, /"\/api\/style-evolution\/candidate"/)
  assert.match(postApiWhitelistSource, /"\/api\/style-evolution\/generate-candidate"/)
  assert.match(postApiWhitelistSource, /"\/api\/style-evolution\/freeze-preview"/)
  assert.match(postApiWhitelistSource, /"\/api\/style-evolution\/accept"/)
  assert.match(postApiWhitelistSource, /"\/api\/style-evolution\/approve"/)
  assert.match(postApiWhitelistSource, /"\/api\/style-evolution\/reject"/)
  assert.match(source, /async function forwardJsonApiRequest/)
  assert.match(serverStartSource, /isJsonApiRequest\(request\.method,\s*pathname\)/)
  assert.match(serverStartSource, /forwardJsonApiRequest\(rootDir,\s*request,\s*response,\s*url,\s*\{\s*embeddedWorker\s*\}\)/)
  assert.equal((serverStartSource.match(/handleNovelStudioApi/g) || []).length, 1)
  assert.match(serverStartSource, /\/api\/chat-stream/)
  assert.match(serverStartSource, /\/api\/autopilot-stream/)
})

test("studio http server routes style evolution freeze preview and reject posts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-http-routes-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { startNovelStudioServer } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  let server = null

  const postJson = async (port, pathname, payload) => {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    return {
      status: response.status,
      payload: await response.json(),
    }
  }

  clearAigcEnv()
  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    const started = await startNovelStudioServer({ rootDir: tempDir })
    server = started.server

    const initResponse = await postJson(started.port, "/api/style-evolution/init", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
    })
    assert.equal(initResponse.status, 200)

    const candidateResponse = await postJson(started.port, "/api/style-evolution/candidate", {
      projectId: created.project.id,
      prompt: "第二版样段",
      sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
      review: "可作为全书基础写法。",
    })
    assert.equal(candidateResponse.status, 200)
    assert.equal(candidateResponse.payload.styleEvolution.contract.verification.status, "blocked")

    const previewResponse = await postJson(started.port, "/api/style-evolution/freeze-preview", {
      projectId: created.project.id,
      version: 1,
    })
	    assert.equal(previewResponse.status, 400)
	    assert.equal(previewResponse.payload.error, "style_generation_verification_blocked")
	    assert.equal(previewResponse.payload.activeProjectId, created.project.id)
	    assert.equal(previewResponse.payload.styleEvolution.contract.verification.status, "blocked")
	    assert.equal(
	      previewResponse.payload.styleEvolutionAssets.freezePackage.loopRuntime.path,
	      ".ai-novel/style/evolution/style-loop-runtime.json",
	    )
	    assert.equal(typeof previewResponse.payload.styleEvolutionAssets.freezePackage.loopRuntime.exists, "boolean")
	    assert.ok(previewResponse.payload.projectRuntime)
	    assert.ok(previewResponse.payload.productionReadiness)

	    const rejectResponse = await postJson(started.port, "/api/style-evolution/reject", {
      projectId: created.project.id,
      version: 1,
      rejectionReason: "还不够像整书基准，继续收紧对白和信息密度。",
    })
    assert.equal(rejectResponse.status, 200)
    assert.equal(rejectResponse.payload.styleEvolution.contract.approval.status, "rejected")
    assert.notEqual(rejectResponse.payload.error, "not_found")
  } finally {
    restoreAigcEnv(previousAigcEnv)
    if (server) {
      await new Promise((resolve) => server.close(resolve))
    }
  }
})

test("reader snapshot returns cleaned readable chapters and story context", async () => {
  const { handleNovelStudioApi } = await loadStudioServer()
  const { createManagedAutonomousProject } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-reader-"))
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A librarian reads forbidden weather",
    title: "Reader Test",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const projectId = created.project.id
  const projectRoot = created.project.projectRoot
  await approveTestWritingStyle(projectRoot, {
    projectTitle: "Reader Test",
    idea: "A librarian reads forbidden weather",
  })

  await fs.mkdir(path.join(projectRoot, ".ai-novel", "chapters"), { recursive: true })
  await fs.mkdir(path.join(projectRoot, ".ai-novel", "memory", "characters"), { recursive: true })
  await fs.mkdir(path.join(projectRoot, ".ai-novel", "plans"), { recursive: true })
  await fs.mkdir(path.join(projectRoot, ".ai-novel", "reports"), { recursive: true })
  await fs.mkdir(path.join(projectRoot, ".ai-novel", "checkpoints", "active-world-slices"), { recursive: true })
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.final.md"), [
    "# 第一章 风从禁书页里吹来",
    "",
    "## Final Body",
    "",
    "正文第一段。",
    "",
    "正文第二段。",
    "",
    "## Naturalness Report",
    "- Status: needs_revision",
    "",
    "## Quality Gate",
    "- Status: passed",
  ].join("\n"))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.draft.md"), [
    "# 第一章 风从禁书页里吹来",
    "",
    "## Draft Body",
    "",
    "草稿段落。",
  ].join("\n"))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"), JSON.stringify({
    version: 1,
    chapterNumber: 1,
    chapterTitle: "第一章 风从禁书页里吹来",
    publishedVersionId: "final",
    locked: true,
    status: "published",
    writingMode: "quality",
    targetWords: 2500,
    wordCount: 10,
	    updatedAt: "2026-06-25T00:00:00.000Z",
	    qualityGate: { passed: true, score: 92, status: "passed", attempts: 0, reason: "fixture" },
	    aigcDetection: { status: "passed", score: 0.12, threshold: 0.8, reason: "fixture" },
	    chapterInheritanceAdapter: createReadyChapterInheritanceAdapterForTest(),
	    styleInheritanceVerification: {
	      status: "ready",
      summary: "fixture persisted style inheritance ready",
      chapterNumber: 1,
      evidence: ["persisted verification wins"],
      risks: [],
    },
    artifacts: {
      report: ".ai-novel/reports/chapter-001-quality.md",
      memory: ".ai-novel/memory/chapter-001-memory.md",
    },
    versions: [
      {
        id: "draft",
        label: "Draft",
        source: "draft",
        path: ".ai-novel/chapters/chapter-001.draft.md",
        wordCount: 5,
        status: "available",
        createdAt: "2026-06-25T00:00:00.000Z",
      },
      {
        id: "final",
        label: "Final",
        source: "final",
        path: ".ai-novel/chapters/chapter-001.final.md",
        wordCount: 10,
        status: "passed",
        createdAt: "2026-06-25T00:00:00.000Z",
      },
    ],
  }, null, 2))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "memory", "characters", "dossiers.json"), JSON.stringify([
    { id: "protagonist", canonicalName: "许岚", role: "protagonist", identityAndRole: "守书人" },
  ]))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "memory", "characters", "relationships.json"), JSON.stringify({
    version: 1,
    nodeCount: 1,
    edgeCount: 1,
    nodes: [{ id: "protagonist", name: "许岚", role: "protagonist" }],
    edges: [{ sourceId: "protagonist", targetId: "archive", label: "guards", pressure: "禁书压力", status: "unresolved" }],
  }))
  await fs.writeFile(
    path.join(projectRoot, ".ai-novel", "checkpoints", "active-world-slices", "chapter-001-world-slice.md"),
    "# Active World Slice\n\n风会记忆文字，许岚只能读取当前章节相关规则。\n",
  )
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "memory", "chapter-001-memory.md"), "许岚读取禁书页，风的规则被推进。\n")
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "reports", "chapter-001-quality.md"), "# Quality Report\n\npassed\n")
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "setting-freeze.md"), "世界设定：风会记忆文字。")
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "foreshadowing-ledger.md"), "# Foreshadowing Ledger\n\n- 第 1 章：禁书页里的风会在第三章回收。\n")
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "story-foundation-contract.json"), JSON.stringify({
    version: 1,
    project: { title: "Reader Test", totalChapters: 2 },
    genre: { readerPromise: "禁书天气谜案" },
    plot: {
      chapters: [
        { chapterNumber: 1, title: "风从禁书页里吹来", sceneObjective: "发现禁书页风声异常", nextHandoff: "风声指向第三章回收" },
      ],
    },
    foreshadowing: {
      entries: [
        { id: "f-1", sourceChapter: 1, operation: "禁书页里的风会在第三章回收", status: "planned" },
      ],
    },
  }, null, 2))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "world-matrix.json"), JSON.stringify({
    version: 1,
    rules: [{ id: "wind-memory", rule: "风会记忆文字", execution: "通过书页和声音显现" }],
    continuityAnchors: ["禁书页", "风声"],
  }, null, 2))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "plot-architecture.json"), JSON.stringify({
    version: 1,
    chapters: [{ chapterNumber: 1, title: "风从禁书页里吹来", sceneObjective: "发现禁书页风声异常" }],
  }, null, 2))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "foreshadowing-ledger.json"), JSON.stringify({
    version: 1,
    entries: [{ id: "f-1", sourceChapter: 1, operation: "禁书页里的风会在第三章回收", status: "planned" }],
  }, null, 2))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "character-dynamics.json"), JSON.stringify({
    version: 1,
    protagonist: "许岚",
    relationshipEntries: [{ id: "protagonist", name: "许岚", role: "protagonist", relationshipPressure: "守书人与禁书互相牵制" }],
    chapterStateDeltas: [{ chapterNumber: 1, delta: "许岚与禁书形成债务关系" }],
  }, null, 2))
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "writing-plan.json"), JSON.stringify({
    version: 1,
    novelName: "Reader Test",
    totalChapters: 2,
    minWordsPerChapter: 2500,
    status: "planning",
    writingMode: "serial",
    chapters: [
      { chapterNumber: 1, title: "风从禁书页里吹来", filePath: ".ai-novel/chapters/chapter-001.final.md", status: "completed", wordCount: 10, qualityPass: true, retryCount: 0, selectedVersionId: "final" },
      { chapterNumber: 2, title: "风声的去向", filePath: ".ai-novel/chapters/chapter-002.final.md", status: "pending", wordCount: null, qualityPass: null, retryCount: 0, selectedVersionId: null },
    ],
  }, null, 2))

  const response = await handleNovelStudioApi(
    tempDir,
    "GET",
    `/api/reader-snapshot?projectId=${encodeURIComponent(projectId)}`,
    {},
    { projectId },
  )

  assert.equal(response.status, 200)
  assert.equal(response.payload.project.title, "Reader Test")
  assert.equal(response.payload.stats.readableChapters, 1)
  assert.equal(response.payload.chapters[0].title, "第一章 风从禁书页里吹来")
  assert.equal(response.payload.chapters[0].hasBody, true)
  assert.equal(Object.prototype.hasOwnProperty.call(response.payload.chapters[0], "body"), false)
  assert.equal(response.payload.chapters[0].versionManifest.publishedVersionId, "final")
  assert.equal(response.payload.chapters[0].versionManifest.locked, true)
  assert.equal(response.payload.chapters[0].versionManifest.publishReadiness.ready, true)
  assert.equal(response.payload.chapters[0].publishReadiness.ready, true)
	  assert.equal(response.payload.chapters[0].publishReadiness.styleInheritanceVerification.summary, "fixture persisted style inheritance ready")
	  assert.equal(response.payload.chapters[0].publishReadiness.styleInheritanceVerification.chapterInheritanceAdapter.status, "ready")
	  assert.equal(response.payload.chapters[0].publishReadiness.styleInheritanceVerification.publishBaseReady, true)
  assert.equal(response.payload.chapters[0].versionManifest.versions.length, 2)
  assert.equal(response.payload.characters.dossiers[0].canonicalName, "许岚")
  assert.equal(response.payload.characters.relationshipGraph.edgeCount, 1)
  assert.equal(response.payload.characters.relationshipGraph.edges[0].pressure, "禁书压力")
  assert.match(response.payload.lore.activeWorldSlice, /Active World Slice/)
  assert.match(response.payload.lore.activeWorldSlice, /许岚只能读取当前章节相关规则/)
  assert.match(response.payload.lore.settingFreeze, /风会记忆文字/)
  assert.equal(response.payload.lore.storyFoundation.contract.genre.readerPromise, "禁书天气谜案")
  assert.equal(response.payload.lore.storyFoundation.worldMatrix.rules[0].rule, "风会记忆文字")
  assert.equal(response.payload.lore.storyFoundation.plotArchitecture.chapters[0].sceneObjective, "发现禁书页风声异常")
  assert.equal(response.payload.lore.storyFoundation.foreshadowingLedger.entries[0].operation, "禁书页里的风会在第三章回收")
  assert.equal(response.payload.lore.storyFoundation.characterDynamics.protagonist, "许岚")
  assert.equal(response.payload.lore.storyFoundation.writingPlan.chapters[0].selectedVersionId, "final")

  const chapterResponse = await handleNovelStudioApi(
    tempDir,
    "GET",
    `/api/reader-chapter?projectId=${encodeURIComponent(projectId)}&chapterNumber=1`,
    {},
    { projectId },
  )
  assert.equal(chapterResponse.status, 200)
  assert.equal(chapterResponse.payload.chapter.title, "第一章 风从禁书页里吹来")
  assert.equal(chapterResponse.payload.chapter.versionId, "final")
  assert.equal(chapterResponse.payload.chapter.versionManifest.status, "published")
  assert.equal(chapterResponse.payload.chapter.publishReadiness.ready, true)
  assert.equal(chapterResponse.payload.chapter.styleInheritanceVerification.summary, "fixture persisted style inheritance ready")
  assert.match(chapterResponse.payload.chapter.body, /正文第一段/)
  assert.doesNotMatch(chapterResponse.payload.chapter.body, /草稿段落/)
  assert.doesNotMatch(chapterResponse.payload.chapter.body, /Naturalness Report/)
  assert.doesNotMatch(chapterResponse.payload.chapter.body, /Quality Gate/)

  const compareResponse = await handleNovelStudioApi(
    tempDir,
    "GET",
    `/api/reader-chapter-versions/compare?projectId=${encodeURIComponent(projectId)}&chapterNumber=1&leftVersionId=final&rightVersionId=draft`,
    {},
    { projectId },
  )
  assert.equal(compareResponse.status, 200)
  assert.equal(compareResponse.payload.left.id, "final")
  assert.equal(compareResponse.payload.right.id, "draft")
  assert.match(compareResponse.payload.left.preview, /正文第一段/)
  assert.match(compareResponse.payload.right.preview, /草稿段落/)
  assert.equal(compareResponse.payload.comparison.addedParagraphs, 1)
  assert.equal(compareResponse.payload.comparison.removedParagraphs, 2)

  const versionResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
    },
    { projectId },
  )
  assert.equal(versionResponse.status, 200)
  assert.equal(versionResponse.payload.chapter.versionId, "draft")
  assert.equal(versionResponse.payload.chapter.versionManifest.publishedVersionId, "draft")
  assert.equal(versionResponse.payload.chapter.versionManifest.locked, false)
  assert.equal(versionResponse.payload.chapter.publishReadiness.ready, true)
  assert.match(versionResponse.payload.chapter.body, /草稿段落/)
  assert.doesNotMatch(versionResponse.payload.chapter.body, /正文第一段/)

  await fs.unlink(path.join(projectRoot, ".ai-novel", "plans", "foreshadowing-ledger.md"))
  const blockedLockResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
      locked: true,
    },
    { projectId },
  )
  assert.equal(blockedLockResponse.status, 409)
  assert.equal(blockedLockResponse.payload.error, "publish_not_ready")
  assert.equal(blockedLockResponse.payload.publishReadiness.ready, false)
  assert.ok(blockedLockResponse.payload.publishReadiness.missing.some((entry) => entry.id === "foreshadowing_ledger"))

  await fs.writeFile(path.join(projectRoot, ".ai-novel", "plans", "foreshadowing-ledger.md"), "# Foreshadowing Ledger\n\n- 第 1 章：禁书页里的风会在第三章回收。\n")
  const manifestWithBlockedVerification = JSON.parse(await fs.readFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    "utf8",
  ))
  manifestWithBlockedVerification.styleInheritanceVerification = {
    status: "blocked",
    summary: "fixture drift verification blocked",
    chapterNumber: 1,
    evidence: [],
    risks: ["写法漂移超过阈值。"],
  }
  await fs.writeFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    `${JSON.stringify(manifestWithBlockedVerification, null, 2)}\n`,
  )
  const styleBlockedLockResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
      locked: true,
    },
    { projectId },
  )
  assert.equal(styleBlockedLockResponse.status, 409)
  assert.equal(styleBlockedLockResponse.payload.error, "publish_not_ready")
  assert.equal(styleBlockedLockResponse.payload.publishReadiness.ready, false)
  assert.ok(styleBlockedLockResponse.payload.publishReadiness.missing.some((entry) => entry.id === "style_contract_alignment"))
  assert.equal(styleBlockedLockResponse.payload.publishReadiness.styleInheritanceVerification.summary, "fixture drift verification blocked")

  manifestWithBlockedVerification.styleInheritanceVerification = {
    status: "ready",
    summary: "fixture persisted style inheritance ready",
    contractVersion: 1,
    chapterNumber: 1,
    evidence: ["旧验证曾经通过"],
    risks: [],
  }
  manifestWithBlockedVerification.styleConformanceDrift = {
    status: "drifted",
    reason: "current contract drifted",
    risks: ["当前正文节奏偏离冻结样段。"],
  }
  manifestWithBlockedVerification.aigcDetection = { status: "passed", score: 0.12, threshold: 0.8, reason: "fixture" }
  await fs.writeFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    `${JSON.stringify(manifestWithBlockedVerification, null, 2)}\n`,
  )
  const currentDriftLockResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
      locked: true,
    },
    { projectId },
  )
  assert.equal(currentDriftLockResponse.status, 409)
  assert.equal(currentDriftLockResponse.payload.error, "publish_not_ready")
  assert.equal(currentDriftLockResponse.payload.publishReadiness.styleInheritanceVerification.status, "blocked")
  assert.equal(currentDriftLockResponse.payload.publishReadiness.styleInheritanceVerification.summary, "current contract drifted")
  assert.ok(currentDriftLockResponse.payload.publishReadiness.missing.some((entry) => entry.id === "style_contract_alignment"))

  delete manifestWithBlockedVerification.styleConformanceDrift
  manifestWithBlockedVerification.styleInheritanceVerification = {
    status: "ready",
    summary: "fixture stale style inheritance ready",
    contractVersion: 1,
    chapterNumber: 1,
    evidence: ["旧合同验证通过"],
    risks: [],
  }
  const contractPath = path.join(projectRoot, ".ai-novel", "style", "evolution", "style-contract.json")
  const styleContract = JSON.parse(await fs.readFile(contractPath, "utf8"))
  styleContract.approval.approvedVersion = 2
  styleContract.loop = { ...(styleContract.loop || {}), approvalVersion: 2 }
  await fs.writeFile(contractPath, `${JSON.stringify(styleContract, null, 2)}\n`)
  await fs.writeFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    `${JSON.stringify(manifestWithBlockedVerification, null, 2)}\n`,
  )
  const staleContractLockResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
      locked: true,
    },
    { projectId },
  )
  assert.equal(staleContractLockResponse.status, 409)
  assert.equal(staleContractLockResponse.payload.error, "publish_not_ready")
	  assert.equal(staleContractLockResponse.payload.publishReadiness.styleInheritanceVerification.status, "blocked")
	  assert.match(staleContractLockResponse.payload.publishReadiness.styleInheritanceVerification.summary, /过期|重新通过/)
	  assert.ok(staleContractLockResponse.payload.publishReadiness.styleInheritanceVerification.risks.some((risk) => /v1.*v2/.test(risk)))

	  styleContract.approval.approvedVersion = 1
	  styleContract.loop = { ...(styleContract.loop || {}), approvalVersion: 1 }
	  await fs.writeFile(contractPath, `${JSON.stringify(styleContract, null, 2)}\n`)
	  manifestWithBlockedVerification.styleInheritanceVerification = {
	    status: "ready",
	    summary: "fixture adapter missing style inheritance ready",
	    contractVersion: 1,
	    chapterNumber: 1,
	    evidence: ["旧合同验证通过"],
	    risks: [],
	  }
	  delete manifestWithBlockedVerification.chapterInheritanceAdapter
	  await fs.writeFile(
	    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
	    `${JSON.stringify(manifestWithBlockedVerification, null, 2)}\n`,
	  )
	  const missingAdapterLockResponse = await handleNovelStudioApi(
	    tempDir,
	    "POST",
	    "/api/reader-chapter-version",
	    {
	      projectId,
	      chapterNumber: 1,
	      versionId: "draft",
	      locked: true,
	    },
	    { projectId },
	  )
	  assert.equal(missingAdapterLockResponse.status, 409)
	  assert.equal(missingAdapterLockResponse.payload.error, "publish_not_ready")
	  assert.equal(missingAdapterLockResponse.payload.publishReadiness.styleInheritanceVerification.status, "blocked")
	  assert.ok(missingAdapterLockResponse.payload.publishReadiness.styleInheritanceVerification.risks.some((risk) =>
	    /Chapter Inheritance Adapter|Adapter/.test(risk)
	  ))

	  styleContract.approval.approvedVersion = 1
	  styleContract.loop = { ...(styleContract.loop || {}), approvalVersion: 1 }
	  await fs.writeFile(contractPath, `${JSON.stringify(styleContract, null, 2)}\n`)
	  manifestWithBlockedVerification.styleInheritanceVerification = {
    status: "warning",
    summary: "fixture style inheritance warning",
    chapterNumber: 1,
	    evidence: ["partial style match"],
	    risks: ["继承证据不完整。"],
	  }
	  manifestWithBlockedVerification.chapterInheritanceAdapter = createReadyChapterInheritanceAdapterForTest()
	  manifestWithBlockedVerification.aigcDetection = { status: "passed", score: 0.12, threshold: 0.8, reason: "fixture" }
  await fs.writeFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    `${JSON.stringify(manifestWithBlockedVerification, null, 2)}\n`,
  )
  const styleWarningLockResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
      locked: true,
    },
    { projectId },
  )
  assert.equal(styleWarningLockResponse.status, 409)
  assert.equal(styleWarningLockResponse.payload.error, "publish_not_ready")
  assert.ok(styleWarningLockResponse.payload.publishReadiness.missing.some((entry) => entry.id === "style_contract_alignment"))

	  manifestWithBlockedVerification.styleInheritanceVerification = {
	    status: "ready",
	    summary: "fixture persisted style inheritance ready",
	    chapterNumber: 1,
	    evidence: ["persisted verification wins"],
	    risks: [],
	  }
	  manifestWithBlockedVerification.chapterInheritanceAdapter = createReadyChapterInheritanceAdapterForTest()
	  manifestWithBlockedVerification.aigcDetection = { status: "skipped", reason: "AIGC detector is not configured." }
  await fs.writeFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    `${JSON.stringify(manifestWithBlockedVerification, null, 2)}\n`,
  )
  const aigcSkippedLockResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
      locked: true,
    },
    { projectId },
  )
  assert.equal(aigcSkippedLockResponse.status, 409)
  assert.equal(aigcSkippedLockResponse.payload.error, "publish_not_ready")
  assert.ok(aigcSkippedLockResponse.payload.publishReadiness.missing.some((entry) => entry.id === "aigc_gate"))

	  manifestWithBlockedVerification.aigcDetection = { status: "unavailable", reason: "detector timeout" }
	  manifestWithBlockedVerification.chapterInheritanceAdapter = createReadyChapterInheritanceAdapterForTest()
  await fs.writeFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    `${JSON.stringify(manifestWithBlockedVerification, null, 2)}\n`,
  )
  const aigcUnavailableLockResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
      locked: true,
    },
    { projectId },
  )
  assert.equal(aigcUnavailableLockResponse.status, 409)
  assert.equal(aigcUnavailableLockResponse.payload.error, "publish_not_ready")
  assert.ok(aigcUnavailableLockResponse.payload.publishReadiness.missing.some((entry) => entry.id === "aigc_gate"))

	  manifestWithBlockedVerification.styleInheritanceVerification = {
	    status: "ready",
	    summary: "fixture persisted style inheritance ready",
	    chapterNumber: 1,
	    evidence: ["persisted verification wins"],
	    risks: [],
	  }
	  manifestWithBlockedVerification.chapterInheritanceAdapter = createReadyChapterInheritanceAdapterForTest()
	  manifestWithBlockedVerification.aigcDetection = { status: "passed", score: 0.12, threshold: 0.8, reason: "fixture" }
  await fs.writeFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    `${JSON.stringify(manifestWithBlockedVerification, null, 2)}\n`,
  )
  const lockResponse = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/reader-chapter-version",
    {
      projectId,
      chapterNumber: 1,
      versionId: "draft",
      locked: true,
    },
    { projectId },
  )
  assert.equal(lockResponse.status, 200)
  assert.equal(lockResponse.payload.chapter.versionManifest.locked, true)
  assert.equal(lockResponse.payload.chapter.versionManifest.status, "published")
  assert.equal(lockResponse.payload.chapter.publishReadiness.ready, true)
  const persistedAfterLock = JSON.parse(await fs.readFile(
    path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"),
    "utf8",
  ))
  assert.equal(persistedAfterLock.styleInheritanceVerification.summary, "fixture persisted style inheritance ready")
  assert.equal(persistedAfterLock.publishReadiness.styleInheritanceVerification.summary, "fixture persisted style inheritance ready")

  const searchResponse = await handleNovelStudioApi(
    tempDir,
    "GET",
    `/api/reader-search?projectId=${encodeURIComponent(projectId)}&query=${encodeURIComponent("正文第二段")}`,
    {},
    { projectId },
  )
  assert.equal(searchResponse.status, 200)
  assert.equal(searchResponse.payload.results.length, 1)
  assert.equal(searchResponse.payload.results[0].chapterNumber, 1)
  assert.match(searchResponse.payload.results[0].snippet, /正文第二段/)

  const reportSearchResponse = await handleNovelStudioApi(
    tempDir,
    "GET",
    `/api/reader-search?projectId=${encodeURIComponent(projectId)}&query=${encodeURIComponent("Quality Gate")}`,
    {},
    { projectId },
  )
  assert.equal(reportSearchResponse.status, 200)
  assert.equal(reportSearchResponse.payload.results.length, 0)
})

test("writing pipeline injects a canon continuity contract before planning and drafting", async () => {
  const {
    createDetailedChapterBlueprint,
    createDraftSegmentPlan,
    createDraftBodyFromBlueprint,
  } = await loadCore()

  const state = {
    project: {
      title: "不小心穿越到大唐末期",
      idea: "穿越到大唐末期，用小人物视角经历王朝终局",
      createdAt: "2026-06-06T00:00:00.000Z",
      workspaceVersion: 1,
    },
    runtime: {
      stage: "drafting",
      statusMessage: "",
      lastUpdatedAt: "2026-06-06T00:00:00.000Z",
      lastInterruption: null,
    },
    reactSetup: { discussionGoals: [], unansweredQuestions: [] },
    plan: {
      totalChapters: 3,
      chapterWordTarget: 2500,
      pendingChapters: 2,
      chapterTasks: [
        {
          chapterNumber: 1,
          title: "Chapter 1",
          status: "complete",
          summary: "李延落入唐末乱世。",
          targetWords: 2500,
          qualityGate: {
            status: "passed",
            score: 8,
            attempts: 0,
            reason: "质量门禁通过。 首章候选主角识别为「李延」，后续章节必须沿用。",
            updatedAt: "2026-06-06T00:01:00.000Z",
          },
        },
        {
          chapterNumber: 2,
          title: "Chapter 2",
          status: "pending",
          summary: "李延进城并发现第一条军镇线索。",
          targetWords: 2500,
        },
      ],
    },
    assets: {
      cover: { status: "pending", briefPath: "" },
      comic: { status: "pending", planPath: "" },
    },
  }
  const task = state.plan.chapterTasks[1]
  const resources = {
    styleGuide: "",
    chapterPlannerGuide: "",
    writerGuide: "",
    editorGuide: "",
    styleControllerGuide: "",
    consistencyGuide: "",
    vocabularyIndex: "",
    vocabularySamples: ["- 场景类型：环境渲染；建议：泥、冷风、城门"],
    examples: [
      [
        "### ✅ 正确示范（自然流畅）",
        "他先把账册按在桌上，听见门外风声压低，才说出自己的判断。",
        "",
        "### ❌ 错误示范（成语泛滥）",
        "他深思熟虑、忠心耿耿、义愤填膺，真是千钧一发。",
      ].join("\n"),
    ],
  }

  const blueprint = createDetailedChapterBlueprint(state, task, {
    consensus: "配角老农仍在城外，密信线索需要承接。",
    protagonist: "",
    style: "",
  }, resources)
  assert.match(blueprint, /Canon Continuity Contract/)
  assert.match(blueprint, /Locked protagonist: 李延/)
  assert.match(blueprint, /配角一致性/)
  assert.match(blueprint, /情节连续性/)
  assert.match(blueprint, /伏笔一致性/)
  assert.match(blueprint, /## Chapter Execution Contract/)
  assert.match(blueprint, /"sceneCards"/)
  assert.match(blueprint, /"forbiddenFacts"/)

  const sceneSegments = createDraftSegmentPlan(state, task, undefined, blueprint)
  assert.ok(sceneSegments.length >= 4)
  assert.ok(sceneSegments.every((segment) => segment.source === "scene_card"))
  assert.match(sceneSegments[0].requiredBeats.join("\n"), /Scene Goal/)

  const fallbackDraft = createDraftBodyFromBlueprint(state, task, blueprint, resources)
  assert.match(fallbackDraft, /李延/)
  assert.doesNotMatch(fallbackDraft, /李晦/)
})

test("draft segment plan splits long chapter generation into timeline-sized LLM calls", async () => {
  const { createDraftSegmentPlan } = await loadCore()
  const state = {
    project: {
      title: "逆天成仙",
      idea: "凡人被卷入修仙宗门风波，靠选择和代价一步步逆天改命",
    },
    runtime: { stage: "drafting" },
    plan: {
      totalChapters: 12,
      chapterWordTarget: 3000,
      chapterTasks: [],
    },
  }
  const task = {
    chapterNumber: 6,
    title: "火脉裂纹",
    targetWords: 3000,
    causalPlan: {
      previousInput: "承接上一章火脉石开裂、外门执事怀疑沈玄藏匿线索。",
      sceneObjective: "沈玄必须在火脉矿洞中找出裂纹来源，并避免被执事当场拿下。",
      protagonistDecision: "沈玄选择公开一半线索，暗中保留石印反应。",
      irreversibleConsequence: "火脉裂纹扩大，宗门禁令提前落下。",
      nextHandoff: "下一章必须处理禁令、石印反噬和执事追查。",
      requiredContinuityAnchors: ["火脉石", "缺角石印", "外门执事", "矿洞裂纹"],
      characterStateDelta: "沈玄从被动隐瞒变成主动交换筹码。",
      foreshadowingOperation: "推进缺角石印与火脉裂纹的关系。",
    },
  }
  state.plan.chapterTasks = [task]
  const continuityContract = {
    lockedProtagonistName: "沈玄",
    continuityAnchors: ["火脉石", "缺角石印", "外门执事", "矿洞裂纹"],
    requiredNames: ["沈玄"],
    knownCast: ["沈玄"],
    previousChapterLedger: [],
    characterLedger: "",
    foreshadowingLedger: "",
    hardRules: [],
    prompt: "",
    status: "ready",
  }

  const segments = createDraftSegmentPlan(state, task, continuityContract)

  assert.equal(segments.length, 5)
  assert.ok(segments.every((segment) => segment.source === "timeline"))
  assert.deepEqual(segments.map((segment) => segment.index), [1, 2, 3, 4, 5])
  assert.ok(segments.every((segment) => segment.total === 5))
  assert.ok(segments.every((segment) => segment.targetWords <= 700))
  assert.match(segments[0].requiredBeats.join("\n"), /Previous Input/)
  assert.match(segments[2].requiredBeats.join("\n"), /Protagonist Decision/)
  assert.match(segments.at(-1).requiredBeats.join("\n"), /Next Chapter Handoff/)
  assert.ok(segments.flatMap((segment) => segment.continuityFocus).includes("缺角石印"))
})

test("draft segment plan uses structured scene cards when a chapter blueprint provides them", async () => {
  const { createDraftSegmentPlan } = await loadCore()
  const state = {
    project: {
      title: "雨账",
      idea: "一名审雨官发现降雨记录被篡改",
    },
    runtime: { stage: "drafting" },
    plan: {
      totalChapters: 8,
      chapterWordTarget: 2400,
      chapterTasks: [],
    },
  }
  const task = {
    chapterNumber: 1,
    title: "缺页账本",
    targetWords: 2400,
    causalPlan: {
      previousInput: "承接审雨官制度与雨册异常。",
      sceneObjective: "沈砚发现账本被人动过。",
      protagonistDecision: "沈砚选择扣下旧印章。",
      irreversibleConsequence: "账房老周被牵入风险。",
      nextHandoff: "下一章必须处理旧印章反应。",
      requiredContinuityAnchors: ["缺页账本", "旧印章", "雨册"],
      characterStateDelta: "沈砚与老周的信任出现裂缝。",
      foreshadowingOperation: "埋设旧印章会遇水显纹。",
    },
  }
  state.plan.chapterTasks = [task]
  const continuityContract = {
    lockedProtagonistName: "沈砚",
    continuityAnchors: ["缺页账本", "旧印章", "雨册"],
    requiredNames: ["沈砚"],
    knownCast: ["沈砚", "账房老周"],
    previousChapterLedger: [],
    characterLedger: "",
    foreshadowingLedger: "",
    hardRules: [],
    prompt: "",
    status: "ready",
  }
  const blueprint = [
    "# Detailed Chapter Blueprint",
    "```json",
    JSON.stringify({
      chapterNumber: 1,
      title: "缺页账本",
      sceneCards: [
        {
          index: 1,
          goal: "沈砚发现账本缺页。",
          conflict: "账房老周否认经手账本。",
          turn: "旧印章在雨水中显出第二层纹路。",
          endHook: "门外传来不该出现的敲门暗号。",
          requiredCharacters: ["沈砚", "账房老周"],
          requiredFacts: ["账本缺页", "旧印章"],
          forbiddenFacts: ["幕后主使身份"],
        },
        {
          index: 2,
          goal: "沈砚扣下旧印章并试探老周。",
          conflict: "老周要求他立刻上报。",
          turn: "雨册编号与缺页边缘对不上。",
          endHook: "沈砚把旧印章藏进袖中。",
          requiredCharacters: ["沈砚", "账房老周"],
          requiredFacts: ["雨册编号", "缺页边缘"],
          forbiddenFacts: ["幕后主使身份"],
        },
      ],
    }, null, 2),
    "```",
  ].join("\n")

  const segments = createDraftSegmentPlan(state, task, continuityContract, blueprint)

  assert.equal(segments.length, 2)
  assert.ok(segments.every((segment) => segment.source === "scene_card"))
  assert.equal(segments[0].sceneCard.goal, "沈砚发现账本缺页。")
  assert.match(segments[0].requiredBeats.join("\n"), /Forbidden Facts/)
  assert.match(segments[0].requiredBeats.join("\n"), /幕后主使身份/)
  assert.ok(segments[0].continuityFocus.includes("旧印章"))
  assert.ok(segments.every((segment) => segment.targetWords >= 240))
})

function completeProductionBlueprintFixture() {
  return {
    chapterNumber: 1,
    title: "雨夜账本",
    chapterRole: "开篇事件",
    chapterPurpose: "用一件无法解释的账本失踪案打破主角日常。",
    macroBeat: "E",
    suspenseLevel: "high",
    foreshadowingOperation: "埋设账本缺页与旧印章的关系。",
    plotTwistLevel: 2,
    emotionTarget: "紧张和疑惑",
    conflictLevel: 4,
    revealLevel: 2,
    targetWordCount: 3000,
    mustAvoid: ["禁止提前揭示幕后主使", "禁止出现未登场角色姓名"],
    allowedCharacters: ["沈砚", "账房老周"],
    forbiddenCharacters: ["幕后主使"],
    allowedNewCharacters: ["账房老周"],
    entranceProtocol: {
      newCharacterStage: "meet",
      requiredIntroElements: ["外貌细节", "身份线索", "主角反应"],
    },
    sceneCards: [
      {
        index: 1,
        goal: "沈砚发现账本缺页。",
        conflict: "账房老周否认经手账本。",
        turn: "旧印章在雨水中显出第二层纹路。",
        endHook: "门外传来不该出现的敲门暗号。",
        requiredCharacters: ["沈砚", "账房老周"],
        requiredFacts: ["账本缺页", "旧印章"],
        forbiddenFacts: ["幕后主使身份"],
      },
    ],
    endingHook: "门外传来不该出现的敲门暗号。",
    nextChapterEntryState: "下一章必须处理敲门者、缺页账本和旧印章反应。",
  }
}

test("production contracts block chapter execution until writing style is approved", async () => {
  const { evaluateChapterExecutionReadiness } = await loadCore()
  const result = evaluateChapterExecutionReadiness({
    blueprint: completeProductionBlueprintFixture(),
    style: {
      seedPrompt: "写得克制、冷感、动作推动，不要解释情绪。",
      approvedSample: "雨压在檐角。沈砚把账本翻到缺页处，指腹停住，没有立刻抬头。",
      styleContract: {
        voice: "克制冷感，动作和物件先于解释。",
      },
      antiPatterns: ["不要总结式结尾"],
    },
  })

  assert.equal(result.canProceed, false)
  assert.equal(result.status, "blocked")
  assert.match(result.blockedReason, /用户确认|确认/)
  assert.ok(result.issues.some((issue) => issue.code === "style_approval_missing"))
})

test("production contracts pass when style approval and chapter blueprint are complete", async () => {
  const { evaluateChapterExecutionReadiness } = await loadCore()
  const result = evaluateChapterExecutionReadiness({
    style: {
      seedPrompt: "写得克制、冷感、动作推动，不要解释情绪。",
      approvedSample: "雨压在檐角。沈砚把账本翻到缺页处，指腹停住，没有立刻抬头。",
      approvedAt: "2026-06-25T00:00:00.000Z",
      approval: {
        status: "approved",
        acceptedAsBookStyle: true,
        approvedAt: "2026-06-25T00:00:00.000Z",
      },
      inheritance: {
        status: "enforced",
        inheritedArtifacts: ["base writing prompt", "style contract"],
        inheritedRules: ["后续每章必须继承用户冻结后的 base writing prompt。"],
      },
      loopProtocol: readyLoopProtocolFixture(),
      styleContract: createCompleteStyleContractForTest({
        sentenceRhythm: "短动作句与中长观察句交替。",
        dialogueRules: ["对白必须有潜台词"],
        forbiddenPatterns: ["不要总结式结尾"],
      }),
      antiPatterns: ["不要总结式结尾", "不要显而易见/总而言之"],
	      verification: {
	        gate: "Generation Verification Gate",
	        status: "passed",
	        summary: "fixture passed",
	        reasons: [],
	      },
	      freezer: readyFreezerFixture(),
	    },
	    blueprint: completeProductionBlueprintFixture(),
	  })

  assert.equal(result.canProceed, true)
	  assert.equal(result.status, "passed")
	  assert.equal(result.issues.length, 0)
	})

test("production contracts block approved style until Freezer verdict is ready", async () => {
  const { evaluateChapterExecutionReadiness } = await loadCore()
  const result = evaluateChapterExecutionReadiness({
    style: {
      seedPrompt: "写得克制、冷感、动作推动，不要解释情绪。",
      approvedSample: "雨压在檐角。沈砚把账本翻到缺页处，指腹停住，没有立刻抬头。",
      approvedAt: "2026-06-25T00:00:00.000Z",
      approval: {
        status: "approved",
        acceptedAsBookStyle: true,
        approvedAt: "2026-06-25T00:00:00.000Z",
      },
      inheritance: {
        status: "enforced",
        inheritedArtifacts: ["base writing prompt", "style contract"],
        inheritedRules: ["后续每章必须继承用户冻结后的 base writing prompt。"],
      },
      verification: {
        gate: "Generation Verification Gate",
        status: "passed",
        summary: "fixture passed",
        reasons: [],
      },
      freezer: {
        verdict: "continue",
        summary: "还需要继续收紧。",
        blockingReasons: ["样段还不能作为整书基础写法。"],
      },
      styleContract: createCompleteStyleContractForTest(),
      antiPatterns: ["不要总结式结尾"],
    },
    blueprint: completeProductionBlueprintFixture(),
  })

  assert.equal(result.canProceed, false)
  assert.equal(result.status, "blocked")
  assert.ok(result.issues.some((issue) => issue.code === "style_freezer_not_ready"))
})

test("production contracts block approved style when generation verification is blocked", async () => {
  const { evaluateChapterExecutionReadiness } = await loadCore()
  const result = evaluateChapterExecutionReadiness({
    style: {
      seedPrompt: "写得克制、冷感、动作推动，不要解释情绪。",
      approvedSample: "这是一段模板化表达，人物反应被概括。",
      approvedAt: "2026-06-25T00:00:00.000Z",
      approval: {
        status: "approved",
        acceptedAsBookStyle: true,
      },
      verification: {
        gate: "Generation Verification Gate",
        status: "blocked",
        summary: "AIGC 风险过高。",
        highRiskCount: 2,
      },
      styleContract: createCompleteStyleContractForTest({
        sentenceRhythm: "短动作句与中长观察句交替。",
        dialogueRules: ["对白必须有潜台词"],
        forbiddenPatterns: ["不要总结式结尾"],
      }),
      antiPatterns: ["不要总结式结尾"],
      inheritance: {
        status: "enforced",
      },
    },
    blueprint: completeProductionBlueprintFixture(),
  })

  assert.equal(result.canProceed, false)
  assert.equal(result.status, "blocked")
  assert.ok(result.issues.some((issue) => issue.code === "style_generation_verification_blocked"))
})

test("production readiness summarizes all pre-writing gates", async () => {
  const { evaluateProductionReadiness, evaluateStyleEvolutionGate } = await loadCore()
  const blocked = evaluateProductionReadiness({
    consensusText: "",
    planningArtifactCount: 0,
    planningRequiredAssetCount: 0,
    blueprintCount: 0,
    totalChapters: 12,
    characterDossierCount: 0,
    styleGate: evaluateStyleEvolutionGate(null),
    memoryRecallRows: 0,
    memoryLag: 3,
    contextBudgetPercent: 96,
    contextOverBudget: true,
  })

  assert.equal(blocked.status, "blocked")
  assert.equal(blocked.canProceed, false)
  assert.ok(blocked.score < 50)
  assert.ok(blocked.items.some((item) => item.key === "core_consensus" && item.status === "blocked"))
  assert.ok(blocked.items.some((item) => item.key === "story_planning" && item.status === "blocked"))
  assert.ok(blocked.items.some((item) => item.key === "story_foundation_approval" && item.status === "blocked"))
  assert.ok(blocked.issues.some((issue) => issue.code === "story_planning_assets_sparse"))
  assert.ok(blocked.issues.some((issue) => issue.code === "story_foundation_approval_missing"))
  assert.ok(blocked.issues.some((issue) => issue.code === "chapter_blueprints_missing"))
  assert.ok(blocked.groups.some((group) => group.key === "story_foundation" && group.status === "blocked"))
  assert.ok(blocked.groups.some((group) =>
    group.key === "story_foundation" && group.assets.some((asset) => asset.key === "core_consensus" && asset.status === "blocked")
  ))

  const missingAssets = evaluateProductionReadiness({
    consensusText: "主角、世界规则和主线压力已确认。",
    planningArtifactCount: 11,
    planningRequiredAssetCount: 11,
    planningRequiredAssets: [
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
    ],
    planningMissingRequiredAssets: ["foreshadowing-ledger.md", "character-dynamics.md"],
    blueprintCount: 12,
    totalChapters: 12,
    characterDossierCount: 3,
    styleGate: { status: "passed", canProceed: true, blockedReason: null, issues: [] },
    memoryRecallRows: 5,
  })
  assert.equal(missingAssets.status, "blocked")
  assert.match(missingAssets.blockedReason, /foreshadowing-ledger\.md/)
  assert.ok(missingAssets.issues.some((issue) => issue.code === "story_planning_assets_incomplete"))
  assert.ok(missingAssets.issues.some((issue) => issue.code === "story_foundation_approval_missing"))
  assert.ok(missingAssets.groups.some((group) =>
    group.key === "story_foundation" && group.assets.some((asset) => asset.label === "foreshadowing-ledger.md" && asset.status === "blocked")
  ))

  const partialBlueprints = evaluateProductionReadiness({
    consensusText: "主角、世界规则和主线压力已确认。",
    planningArtifactCount: 14,
    planningRequiredAssetCount: 14,
    blueprintCount: 3,
    totalChapters: 12,
    characterDossierCount: 3,
    storyFoundationApproved: true,
    styleGate: { status: "passed", canProceed: true, blockedReason: null, issues: [] },
    memoryRecallRows: 5,
  })
  assert.equal(partialBlueprints.status, "blocked")
  assert.equal(partialBlueprints.canProceed, false)
  assert.ok(partialBlueprints.issues.some((issue) => issue.code === "chapter_blueprints_partial" && issue.severity === "critical"))
  assert.ok(partialBlueprints.items.some((item) => item.key === "chapter_blueprints" && item.status === "blocked"))

  const hollowAssets = evaluateProductionReadiness({
    consensusText: "主角、世界规则和主线压力已确认。",
    planningArtifactCount: 14,
    planningRequiredAssetCount: 14,
    planningRequiredAssets: [
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
    ],
    planningMissingRequiredAssets: [],
    planningAssetDetails: [
      { key: "world_matrix", label: "world-matrix.md", path: ".ai-novel/plans/world-matrix.md", status: "passed", detail: "已生成" },
      { key: "plot_architecture", label: "plot-architecture.md", path: ".ai-novel/plans/plot-architecture.md", status: "passed", detail: "已生成" },
      { key: "story_bible", label: "story-bible.md", path: ".ai-novel/plans/story-bible.md", status: "passed", detail: "已生成" },
      { key: "volume_strategy", label: "volume-strategy.md", path: ".ai-novel/plans/volume-strategy.md", status: "passed", detail: "已生成" },
      { key: "foreshadowing_ledger", label: "foreshadowing-ledger.md", path: ".ai-novel/plans/foreshadowing-ledger.md", status: "passed", detail: "已生成" },
      { key: "character_dynamics", label: "character-dynamics.md", path: ".ai-novel/plans/character-dynamics.md", status: "passed", detail: "已生成" },
      { key: "story_foundation_contract_json", label: "story-foundation-contract.json", path: ".ai-novel/plans/story-foundation-contract.json", status: "blocked", detail: "缺少主线章节因果" },
      { key: "world_matrix_json", label: "world-matrix.json", path: ".ai-novel/plans/world-matrix.json", status: "blocked", detail: "缺少世界规则" },
      { key: "plot_architecture_json", label: "plot-architecture.json", path: ".ai-novel/plans/plot-architecture.json", status: "passed", detail: "已生成" },
      { key: "story_bible_json", label: "story-bible.json", path: ".ai-novel/plans/story-bible.json", status: "passed", detail: "已生成" },
      { key: "volume_strategy_json", label: "volume-strategy.json", path: ".ai-novel/plans/volume-strategy.json", status: "passed", detail: "已生成" },
      { key: "foreshadowing_ledger_json", label: "foreshadowing-ledger.json", path: ".ai-novel/plans/foreshadowing-ledger.json", status: "passed", detail: "已生成" },
      { key: "character_dynamics_json", label: "character-dynamics.json", path: ".ai-novel/plans/character-dynamics.json", status: "passed", detail: "已生成" },
      { key: "writing_plan_json", label: "writing-plan.json", path: ".ai-novel/plans/writing-plan.json", status: "passed", detail: "已生成" },
    ],
    blueprintCount: 12,
    totalChapters: 12,
    characterDossierCount: 3,
    storyFoundationApproved: true,
    styleGate: { status: "passed", canProceed: true, blockedReason: null, issues: [] },
    memoryRecallRows: 5,
  })
  assert.equal(hollowAssets.status, "blocked")
  assert.equal(hollowAssets.canProceed, false)
  assert.match(hollowAssets.blockedReason, /story-foundation-contract\.json|world-matrix\.json/)
  assert.ok(hollowAssets.items.some((item) => item.key === "story_planning" && item.status === "blocked"))
  assert.ok(hollowAssets.groups.some((group) =>
    group.key === "story_foundation" && group.assets.some((asset) => asset.label === "world-matrix.json" && asset.status === "blocked")
  ))

  const ready = evaluateProductionReadiness({
    consensusText: "主角、世界规则和主线压力已确认。",
    planningArtifactCount: 16,
    planningRequiredAssetCount: 14,
    blueprintCount: 12,
    totalChapters: 12,
    characterDossierCount: 3,
    characterDossierGaps: [],
    storyFoundationApproved: true,
    styleGate: evaluateStyleEvolutionGate({
      seedPrompt: "克制、白描、动作推动。",
      approvedSample: "雨线挂在门槛外。沈砚把缺页账本推到灯下。",
      approvedAt: "2026-06-25T00:00:00.000Z",
      approval: {
        status: "approved",
        acceptedAsBookStyle: true,
        approvedAt: "2026-06-25T00:00:00.000Z",
      },
      inheritance: {
        status: "enforced",
        inheritedArtifacts: ["base writing prompt", "style contract"],
        inheritedRules: ["后续每章必须继承用户冻结后的 base writing prompt。"],
      },
      loopProtocol: readyLoopProtocolFixture(),
      styleContract: createCompleteStyleContractForTest({ voice: "克制冷感，动作先行。" }),
      antiPatterns: ["不要总结式结尾"],
	      verification: {
	        gate: "Generation Verification Gate",
	        status: "passed",
	        summary: "fixture passed",
	        reasons: [],
	      },
	      freezer: readyFreezerFixture(),
	    }),
    memoryRecallRows: 5,
    memoryLag: 0,
    contextBudgetPercent: 42,
  })

  assert.equal(ready.status, "passed")
  assert.equal(ready.canProceed, true)
  assert.equal(ready.score, 100)
  assert.equal(ready.groups.every((group) => group.status === "passed"), true)
})

test("style evolution assets keep chapter drafting blocked until user approval", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-blocked-"))
  const {
    appendStyleEvolutionCandidate,
    initializeStyleEvolution,
    loadStyleEvolution,
  } = await loadCore()

  const initialized = await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })

  assert.equal(initialized.gate.canProceed, false)
  assert.ok(initialized.gate.issues.some((issue) => issue.code === "approved_sample_missing"))
  assert.equal(initialized.paths.seedPrompt, ".ai-novel/style/evolution/style-seed.md")

  const evolved = await appendStyleEvolutionCandidate(tempDir, {
    prompt: "写一个雨夜查账的 300 字样段。",
    sample: "雨压在檐角。沈砚把账本翻到缺页处，指腹停住，没有立刻抬头。",
    review: "动作清楚，但对白压力还不够。",
  })

  assert.equal(evolved.contract.evolutionHistory.length, 1)
  assert.equal(evolved.contract.evolutionHistory[0].version, 1)
  assert.equal(evolved.gate.canProceed, false)

  const loaded = await loadStyleEvolution(tempDir)
  assert.match(loaded.contract.seedPrompt, /Style Evolution Seed/)
  assert.match(loaded.contract.userStylePrompt, /克制、冷感/)
  assert.match(loaded.contract.seedPrompt, /Prompt Loop Runtime/)
  assert.match(loaded.contract.seedPrompt, /Freeze Target/)
})

test("style evolution approval freezes a reusable writing style contract", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-approved-"))
  const {
    acceptStyleEvolutionCandidate,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    initializeStyleEvolution,
    loadStyleEvolution,
  } = await loadCore()

  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  const styleContractPath = path.join(tempDir, ".ai-novel", "style", "evolution", "style-contract.json")
  const initializedContract = JSON.parse(await fs.readFile(styleContractPath, "utf8"))
  initializedContract.retryPolicy = {
    ...(initializedContract.retryPolicy || {}),
    maxLoopIterations: 4,
    approvalScoreThreshold: 8.9,
    approvalMinRounds: 1,
    stabilityMinRounds: 3,
    stabilityScoreDeltaMax: 0.35,
    maxForbiddenHitCount: 0,
  }
  await fs.writeFile(styleContractPath, `${JSON.stringify(initializedContract, null, 2)}\n`)
  await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第一版样段",
    sample: "沈砚站在廊下，听见雨水沿着瓦缝往账房里滴。账本缺了一页，缺口整齐得像刀裁。",
    review: "太解释。",
    evaluation: createVerifiedStyleEvaluation({
      verdict: "candidate",
      summary: "第一版可作为历史候选，但不进入最终冻结。",
      scores: {
        narrativeVoice: 8.1,
        sentenceRhythm: 8,
        dialogueTexture: 7.4,
        informationDensity: 8,
        emotionalTension: 7.8,
        readability: 8,
        requirementAlignment: 8,
        forbiddenPatternRisk: 0.9,
        overall: 8,
      },
    }),
  })
  await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第二版样段",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    review: "可作为全书基础写法。",
    evaluation: createVerifiedStyleEvaluation(),
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })
  await acceptStyleEvolutionCandidate(tempDir, {
    version: 2,
    acceptedAt: "2026-06-25T00:00:00.000Z",
  })

  const approved = await approveStyleEvolutionSample(tempDir, {
    version: 2,
    approvedAt: "2026-06-25T00:00:00.000Z",
  })

  assert.equal(approved.gate.canProceed, true)
  assert.equal(approved.gate.status, "passed")
  assert.equal(approved.contract.approvedAt, "2026-06-25T00:00:00.000Z")
  assert.match(approved.contract.approvedSample, /老周的手缩进袖口/)
  assert.match(approved.contract.styleContract.voice, /克制|确认样段/)
  assert.ok(approved.contract.antiPatterns.length > 0)
  assert.equal(approved.contract.loop?.status, "approved")
  assert.ok(approved.contract.frozenBasePrompt?.length > 0)
  assert.equal(approved.contract.approval?.status, "approved")
  assert.equal(approved.contract.approval?.approvedVersion, 2)
  assert.equal(approved.contract.approval?.acceptedAsBookStyle, true)
  assert.match(String(approved.contract.approval?.freezeSummary || ""), /全书基础写法|v2/)
  assert.equal(approved.contract.inheritance?.status, "enforced")
  assert.ok((approved.contract.inheritance?.inheritedArtifacts || []).includes("style contract"))
  assert.ok((approved.contract.inheritance?.inheritedRules || []).length >= 3)
  assert.equal(approved.contract.loopProtocol?.status, "approved")
  assert.deepEqual(approved.contract.loopProtocol?.requiredStages, [
    "seed_prompt_builder",
    "candidate_generator",
    "evaluator_critic",
    "prompt_refiner",
    "loop_controller",
    "generation_verification",
    "user_approval_gate",
    "style_contract_freezer",
    "chapter_inheritance_adapter",
  ])
  assert.deepEqual(approved.contract.loopProtocol?.blockedStages, [])
  assert.ok(approved.contract.loopProtocol?.completedStages?.includes("chapter_inheritance_adapter"))
  assert.ok(approved.contract.loopProtocol?.evidence?.some((item) => item.key === "prompt_refiner" && item.status === "passed"))
  assert.equal(approved.contract.retryPolicy?.maxLoopIterations, 4)
  assert.equal(approved.contract.retryPolicy?.approvalScoreThreshold, 8.9)
  assert.equal(approved.contract.retryPolicy?.approvalMinRounds, 1)
  assert.equal(approved.contract.retryPolicy?.stabilityMinRounds, 3)
  assert.equal(approved.contract.retryPolicy?.stabilityScoreDeltaMax, 0.35)
  assert.equal(approved.contract.retryPolicy?.maxForbiddenHitCount, 0)
  assert.equal(approved.contract.evolutionHistory[1].userDecision, "accepted")
  assert.equal(approved.contract.evolutionHistory[0].userDecision, "superseded")
  assert.ok(approved.freezeLedger)
  assert.equal(approved.freezeLedger.approvalStatus, "approved")
  assert.equal(approved.freezeLedger.approvalVersion, 2)
  assert.ok(Array.isArray(approved.freezeLedger.entries))
  assert.equal(approved.freezeLedger.entries.length, 2)

  const sample = await fs.readFile(path.join(tempDir, ".ai-novel", "style", "evolution", "user-approved-sample.md"), "utf8")
  assert.match(sample, /缺页账本/)
  const freezeLedger = JSON.parse(await fs.readFile(
    path.join(tempDir, ".ai-novel", "style", "evolution", "style-freeze-ledger.json"),
    "utf8",
  ))
  assert.equal(freezeLedger.approvalVersion, 2)
  assert.equal(freezeLedger.approvalStatus, "approved")
  assert.ok(Array.isArray(freezeLedger.convergenceEvidence))
  const persisted = await loadStyleEvolution(tempDir)
  assert.equal(persisted.gate.status, "passed")
  assert.equal(persisted.contract.evolutionHistory.length, 2)
  assert.equal(persisted.contract.loop?.status, "approved")
  assert.equal(persisted.contract.approval?.acceptedAsBookStyle, true)
  assert.equal(persisted.contract.loopProtocol?.status, "approved")
})

test("approved style contract is formatted as a reusable drafting constraint", async () => {
  const { formatApprovedWritingStylePrompt } = await loadCore()
  const prompt = formatApprovedWritingStylePrompt({
    approvedAt: "2026-06-25T00:00:00.000Z",
    approvedSample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    runtime: {
      engine: "Style Evolution Engine",
      runtime: "Prompt Loop Runtime",
      gate: "Style Contract Freeze Gate",
      verificationGate: "Generation Verification Gate",
    },
    retryPolicy: {
      approvalScoreThreshold: 8.6,
      approvalMinRounds: 2,
      maxForbiddenHitCount: 1,
    },
    loop: {
      stableVersion: 2,
      stableRounds: 2,
      stabilityReasons: ["最近 2 轮综合评分保持在 8.4-8.5，漂移仅 0.1。"],
    },
    loopProtocol: readyLoopProtocolFixture(),
	    verification: {
	      gate: "Generation Verification Gate",
	      status: "blocked",
	      summary: "Generation Verification Gate 阻塞，当前样段仍存在 AIGC 风险或禁忌命中，不能直接冻结。",
      reasons: ["AIGC 检测识别出 2 个高风险片段。", "AIGC 概率 0.930。"],
      score: 0.93,
      threshold: 0.8,
      highRiskCount: 2,
	      forbiddenHitCount: 1,
	      highRiskPreviews: ["这是一段模板化表达。"],
	    },
	    freezer: readyFreezerFixture(),
	    styleContract: createCompleteStyleContractForTest({
      voice: "模型提炼：克制冷感、白描推进、以物件和动作压住悬疑。",
      sentenceRhythm: "短句为主，少量中句承接动作后果。",
      forbiddenPatterns: ["解释创作意图", "总结式升华"],
    }),
    antiPatterns: ["同质化对白"],
    inheritance: {
      status: "enforced",
      inheritedArtifacts: ["base writing prompt", "style contract", "forbidden patterns", "positive examples", "retry policy"],
      inheritedRules: ["后续每章必须继承用户冻结后的 base writing prompt。"],
    },
  })

  assert.match(prompt, /User Approved Writing Style Contract/)
  assert.match(prompt, /优先级高于通用写作指南/)
  assert.match(prompt, /模型提炼/)
  assert.match(prompt, /Dialogue rule: 对白短/)
  assert.match(prompt, /Forbidden patterns: .*同质化对白/)
  assert.match(prompt, /Style engine:/)
  assert.match(prompt, /Verification gate:/)
  assert.match(prompt, /Verification summary:/)
  assert.match(prompt, /AIGC verification score:/)
  assert.match(prompt, /Retry policy:/)
  assert.match(prompt, /Acceptance scope: this approval applies to the whole book/)
	  assert.match(prompt, /Stable version before freeze:/)
	  assert.match(prompt, /Stability reason:/)
	  assert.match(prompt, /Freezer verdict:/)
	  assert.match(prompt, /Chapter Inheritance Adapter:/)
	  assert.match(prompt, /Loop protocol status:/)
	  assert.match(prompt, /Loop protocol completed stages:/)
	  assert.match(prompt, /Loop protocol evidence:/)
	  assert.match(prompt, /Inherited artifact: style contract/)
	  assert.match(prompt, /Inheritance rule:/)
	  assert.match(prompt, /Approved sample excerpt: 雨线挂在门槛外/)
	})

test("style evolution gate requires complete loop protocol evidence after approval", async () => {
  const { evaluateStyleEvolutionGate } = await loadCore()
  const gate = evaluateStyleEvolutionGate({
    seedPrompt: "克制、白描、动作推动。",
    approvedSample: "雨线挂在门槛外。沈砚把缺页账本推到灯下。",
    approvedAt: "2026-06-25T00:00:00.000Z",
    approval: {
      status: "approved",
      acceptedAsBookStyle: true,
      approvedAt: "2026-06-25T00:00:00.000Z",
    },
    inheritance: {
      status: "enforced",
      inheritedArtifacts: ["base writing prompt", "style contract"],
      inheritedRules: ["后续每章必须继承用户冻结后的 base writing prompt。"],
    },
    styleContract: createCompleteStyleContractForTest({ voice: "克制冷感，动作先行。" }),
    antiPatterns: ["不要总结式结尾"],
    verification: {
      gate: "Generation Verification Gate",
      status: "passed",
      summary: "fixture passed",
      reasons: [],
    },
    freezer: readyFreezerFixture(),
  })

  assert.equal(gate.status, "blocked")
  assert.ok(gate.issues.some((issue) => issue.code === "style_loop_protocol_incomplete"))
})

test("approveStyleEvolutionSample persists freeze-derived examples and inheritance rules", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-approve-freeze-derived-"))
  const {
    acceptStyleEvolutionCandidate,
    initializeStyleEvolution,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
  } = await loadCore()

  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })

  await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第二版样段",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    review: "可作为全书基础写法。",
    evaluation: createVerifiedStyleEvaluation(),
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })

  const accepted = await acceptStyleEvolutionCandidate(tempDir, {
    version: 1,
    acceptedAt: "2026-06-25T00:00:00.000Z",
  })
  assert.equal(accepted.contract.evolutionHistory[0].userDecision, "accepted_for_freeze")
  assert.equal(accepted.contract.approval?.status, "pending")
  assert.equal(accepted.contract.approval?.acceptedAsBookStyle, false)
  assert.equal(accepted.contract.approval?.approvedVersion, undefined)
  assert.equal(accepted.contract.loop?.approvalVersion, undefined)
  assert.notEqual(accepted.gate.status, "passed")
  assert.equal(accepted.contract.approvedAt, undefined)
  assert.equal(accepted.contract.inheritance?.status, undefined)

  const approved = await approveStyleEvolutionSample(tempDir, {
    version: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    freezeSummary: "用户确认当前版本可以作为整本书的冻结写法合同。",
    positiveExamples: ["沈砚没有抬头，只把那页纸往灯下推近半寸。"],
    inheritedRules: ["正文必须延续当前冷感白描与短对白规则。"],
  })

  assert.ok(approved.contract.styleContract?.positiveExamples?.includes("沈砚没有抬头，只把那页纸往灯下推近半寸。"))
  assert.ok(approved.contract.inheritance?.inheritedRules?.includes("正文必须延续当前冷感白描与短对白规则。"))
  assert.match(String(approved.contract.approval?.freezeSummary || ""), /冻结写法合同|整本书/)
  assert.ok(approved.freezeLedger.inheritedRules?.includes("正文必须延续当前冷感白描与短对白规则。"))
  assert.equal(approved.contract.evolutionHistory[0].userDecision, "accepted")
  assert.equal(approved.contract.approval?.acceptedAsBookStyle, true)
})

test("approveStyleEvolutionSample requires explicit user acceptance before freezing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-approve-requires-accept-"))
  const {
    initializeStyleEvolution,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
  } = await loadCore()

  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })

  await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第二版样段",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    review: "可作为全书基础写法。",
    evaluation: createVerifiedStyleEvaluation(),
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })

  await assert.rejects(
    () => approveStyleEvolutionSample(tempDir, {
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }),
    /style_candidate_not_user_accepted/,
  )
})

test("approveStyleEvolutionSample rejects candidates blocked by generation verification", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-approve-verification-blocked-"))
  const {
    initializeStyleEvolution,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
  } = await loadCore()

  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })

  await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第一版样段",
    sample: "这是一段模板化表达，人物反应被概括，场景被抽象词覆盖。",
    review: "AIGC 风险过高。",
    evaluation: {
      source: "llm_critic",
      verdict: "candidate",
      summary: "结构还可用，但 AIGC 风险阻塞。",
      scores: {
        narrativeVoice: 8.2,
        sentenceRhythm: 8.1,
        dialogueTexture: 7.7,
        informationDensity: 8.0,
        emotionalTension: 7.9,
        readability: 8.1,
        requirementAlignment: 8.0,
        forbiddenPatternRisk: 1.1,
        overall: 8.2,
      },
      strengths: ["仍是正文形态。"],
      deviations: ["AI 腔过强。"],
      forbiddenHits: [],
      nextFocus: ["压低模板腔。"],
      aigc: {
        enabled: true,
        status: "blocked",
        score: 0.93,
        threshold: 0.8,
        highRiskCount: 2,
        reason: "fixture blocked",
        highRiskPreviews: ["模板化表达"],
      },
    },
  })

  await assert.rejects(
    () => approveStyleEvolutionSample(tempDir, {
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }),
    /style_generation_verification_blocked/,
  )
})

test("approveStyleEvolutionSample requires a verified candidate version", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-approve-version-required-"))
  const {
    approveStyleEvolutionSample,
    initializeStyleEvolution,
  } = await loadCore()

  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })

  await assert.rejects(
    () => approveStyleEvolutionSample(tempDir, {
      sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下。",
      approvedAt: "2026-06-25T00:00:00.000Z",
    }),
    /style_candidate_version_required/,
  )
})

test("approveStyleEvolutionSample requires Freezer ready before freezing a verified candidate", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-freezer-ready-required-"))
  const {
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    initializeStyleEvolution,
  } = await loadCore()

  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  await appendStyleEvolutionCandidate(tempDir, {
    prompt: "已验证但未冻结放行样段",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    review: "验证通过，但 Freezer 要求继续迭代。",
    source: "loop",
    evaluation: createVerifiedStyleEvaluation(),
    freezer: {
      verdict: "continue",
      summary: "样段可用，但冻结前还需要继续收紧对白规则。",
      blockingReasons: ["对白规则仍需继续收紧。"],
      checkedAt: "2026-06-25T00:00:00.000Z",
    },
  })

  await assert.rejects(
    () => approveStyleEvolutionSample(tempDir, {
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }),
    /style_candidate_not_ready_for_freeze/,
  )
})

test("style evolution rejection removes candidate from ready freeze path", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-reject-ready-"))
  const {
    createManagedAutonomousProject,
    initializeStyleEvolution,
    appendStyleEvolutionCandidate,
    rejectStyleEvolutionSample,
  } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })
  const projectId = created.project.id
  const projectRoot = created.project.projectRoot

  await initializeStyleEvolution(projectRoot, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  const ready = await appendStyleEvolutionCandidate(projectRoot, {
    prompt: "第一版可批准样段",
    sample: "雨水沿着门槛往里爬。沈砚把账册合上，只问一句：谁动过这一页？门外的人没有回答，袖口却先缩了回去。",
    review: "可进入用户确认。",
    source: "loop",
    evaluation: createVerifiedStyleEvaluation(),
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })
  assert.equal(ready.contract.loop?.status, "ready_for_approval")
  assert.equal(ready.contract.loop?.readyVersion, 1)

  const rejected = await rejectStyleEvolutionSample(projectRoot, {
    version: 1,
    rejectionReason: "对白还是太像解释，动作压迫感不够。",
  })
  assert.equal(rejected.contract.evolutionHistory[0].userDecision, "superseded")
  assert.equal(rejected.contract.loop?.status, "awaiting_user")
  assert.notEqual(rejected.contract.loop?.readyVersion, 1)
  assert.equal(rejected.freezeLedger.readyVersion, undefined)
  assert.equal(rejected.freezeLedger.entries[0].stableCandidate, false)

  const previewResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/freeze-preview", {
    projectId,
    version: 1,
  }, { projectId })
  assert.equal(previewResponse.status, 400)
  assert.equal(previewResponse.payload.error, "style_candidate_rejected")

  const approveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
    projectId,
    version: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
  }, { projectId })
  assert.equal(approveResponse.status, 400)
  assert.equal(approveResponse.payload.error, "style_candidate_rejected")
})

test("approved style candidate cannot be rejected or frozen again", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-approved-locked-"))
  const {
    createManagedAutonomousProject,
    acceptStyleEvolutionCandidate,
    initializeStyleEvolution,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    rejectStyleEvolutionSample,
  } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })
  const projectId = created.project.id
  const projectRoot = created.project.projectRoot

  await initializeStyleEvolution(projectRoot, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  await appendStyleEvolutionCandidate(projectRoot, {
    prompt: "可冻结样段",
    sample: "雨水沿着门槛往里爬。沈砚把账册合上，只问一句：谁动过这一页？门外的人没有回答，袖口却先缩了回去。",
    review: "可进入用户确认。",
    source: "loop",
    evaluation: createVerifiedStyleEvaluation(),
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })
  await acceptStyleEvolutionCandidate(projectRoot, {
    version: 1,
    acceptedAt: "2026-06-25T00:00:00.000Z",
  })
  const approved = await approveStyleEvolutionSample(projectRoot, {
    version: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
  })
  assert.equal(approved.contract.evolutionHistory[0].userDecision, "accepted")
  assert.equal(approved.contract.loop?.status, "approved")

  await assert.rejects(
    rejectStyleEvolutionSample(projectRoot, {
      version: 1,
      rejectionReason: "冻结后不应允许退回。",
    }),
    /style_candidate_rejected/,
  )

  const rejectResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/reject", {
    projectId,
    version: 1,
    rejectionReason: "冻结后不应允许退回。",
  }, { projectId })
  assert.equal(rejectResponse.status, 400)
  assert.equal(rejectResponse.payload.error, "style_candidate_rejected")

  const previewResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/freeze-preview", {
    projectId,
    version: 1,
  }, { projectId })
  assert.equal(previewResponse.status, 400)
  assert.equal(previewResponse.payload.error, "style_candidate_rejected")

  const approveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
    projectId,
    version: 1,
    approvedAt: "2026-06-25T00:00:01.000Z",
  }, { projectId })
  assert.equal(approveResponse.status, 400)
  assert.equal(approveResponse.payload.error, "style_candidate_rejected")
})

test("style evolution rejection breaks stable candidate window", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-reject-stable-"))
  const {
    initializeStyleEvolution,
    appendStyleEvolutionCandidate,
    rejectStyleEvolutionSample,
  } = await loadCore()

  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第一轮",
    sample: "雨线钉在门槛外。沈砚把账册推到灯下，只看那道被裁齐的缺口。",
    review: "进入候选区间。",
    source: "loop",
    evaluation: createVerifiedStyleEvaluation({
      verdict: "candidate",
      scores: {
        narrativeVoice: 8.7,
        sentenceRhythm: 8.3,
        dialogueTexture: 8,
        informationDensity: 8.2,
        emotionalTension: 8.3,
        readability: 8.3,
        requirementAlignment: 8.4,
        forbiddenPatternRisk: 0.8,
        overall: 8.4,
      },
    }),
  })
  const stable = await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第二轮",
    sample: "雨水沿着门槛往里爬。沈砚合上账册，只问一句：谁动过这一页？门外那只手先缩回袖口。",
    review: "已形成稳定窗口。",
    source: "loop",
    evaluation: createVerifiedStyleEvaluation({
      verdict: "candidate",
      scores: {
        narrativeVoice: 8.8,
        sentenceRhythm: 8.4,
        dialogueTexture: 8.1,
        informationDensity: 8.3,
        emotionalTension: 8.4,
        readability: 8.4,
        requirementAlignment: 8.5,
        forbiddenPatternRisk: 0.7,
        overall: 8.5,
      },
    }),
  })
  assert.equal(stable.contract.loop?.status, "stable_candidate")
  assert.equal(stable.contract.loop?.stableVersion, 2)

  const rejected = await rejectStyleEvolutionSample(tempDir, {
    version: 2,
    rejectionReason: "稳定但还不够锋利，结尾钩子太软。",
  })
  assert.equal(rejected.contract.loop?.status, "awaiting_user")
  assert.notEqual(rejected.contract.loop?.stableVersion, 2)
  assert.equal(rejected.contract.loop?.stableRounds, 0)
  assert.equal(rejected.freezeLedger.stableVersion, undefined)
  assert.equal(rejected.freezeLedger.entries.find((entry) => entry.version === 2)?.stableCandidate, false)
})

test("style evolution derives a stable candidate state before final approval", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-stable-"))
  const {
    appendStyleEvolutionCandidate,
    initializeStyleEvolution,
    loadStyleEvolution,
  } = await loadCore()

  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })

  await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第一轮",
    sample: "雨线钉在门槛外。沈砚把账册推到灯下，只看那道被裁齐的缺口。",
    review: "进入候选区间。",
    source: "loop",
    evaluation: {
      source: "llm_critic",
      verdict: "candidate",
      summary: "已进入候选区间，可以继续收紧。",
      scores: {
        narrativeVoice: 8.4,
        sentenceRhythm: 8.1,
        dialogueTexture: 7.2,
        informationDensity: 8.0,
        emotionalTension: 8.0,
        readability: 8.2,
        requirementAlignment: 8.3,
        forbiddenPatternRisk: 1.4,
        overall: 8.4,
      },
      strengths: ["声音已进入冷感白描。"],
      deviations: ["对白仍可继续压短。"],
      forbiddenHits: [],
      nextFocus: ["继续压短对白。"],
      aigc: {
        enabled: true,
        status: "passed",
        score: 0.18,
        threshold: 0.8,
        highRiskCount: 0,
        reason: "fixture passed",
        highRiskPreviews: [],
      },
    },
    refinement: {
      source: "llm_critic",
      summary: "继续微调。",
      promptAdjustments: ["对白只保留必要试探。"],
      contractAdjustments: ["对白规则继续强调短句停顿。"],
      nextPrompt: "继续保持冷感白描，压短对白。",
    },
  })

  const stable = await appendStyleEvolutionCandidate(tempDir, {
    prompt: "第二轮",
    sample: "雨水沿着门槛往里爬。沈砚合上账册，只问一句：谁动过这一页？门外那只手先缩回袖口。",
    review: "已形成稳定窗口。",
    source: "loop",
    evaluation: {
      source: "llm_critic",
      verdict: "candidate",
      summary: "声音稳定，可进入稳定候选状态。",
      scores: {
        narrativeVoice: 8.7,
        sentenceRhythm: 8.4,
        dialogueTexture: 8.0,
        informationDensity: 8.2,
        emotionalTension: 8.3,
        readability: 8.2,
        requirementAlignment: 8.5,
        forbiddenPatternRisk: 1.3,
        overall: 8.5,
      },
      strengths: ["对白更短，压迫感更明确。"],
      deviations: ["还可以再收一下结尾钩子。"],
      forbiddenHits: [],
      nextFocus: ["只保留最必要的钩子。"],
      aigc: {
        enabled: true,
        status: "passed",
        score: 0.16,
        threshold: 0.8,
        highRiskCount: 0,
        reason: "fixture passed",
        highRiskPreviews: [],
      },
    },
    refinement: {
      source: "llm_critic",
      summary: "继续轻收。",
      promptAdjustments: ["结尾只留一个钩子。"],
      contractAdjustments: ["结尾钩子强调单点追踪。"],
      nextPrompt: "保持冷感白描，只留单点钩子。",
    },
  })

  assert.equal(stable.contract.loop?.status, "stable_candidate")
  assert.equal(stable.contract.loop?.convergence, "stable")
  assert.equal(stable.contract.loop?.stableVersion, 2)
  assert.equal(stable.contract.loop?.stableRounds, 2)
  assert.ok(Number(stable.contract.loop?.stabilityScore || 0) >= 8.4)
  assert.ok(Array.isArray(stable.contract.loop?.stabilityReasons))
  assert.ok((stable.contract.loop?.stabilityReasons || []).length > 0)
  assert.equal(stable.freezeLedger.stableVersion, 2)
  assert.ok(stable.freezeLedger.entries.some((entry) => entry.version === 2 && entry.stableCandidate))

  const loaded = await loadStyleEvolution(tempDir)
  assert.equal(loaded.contract.loop?.status, "stable_candidate")
  assert.equal(loaded.freezeLedger.stableVersion, 2)
})

test("style evolution persists prompt loop runtime as a first-class asset", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-runtime-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  let aigcServer = null
  let responsesHit = 0
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        responsesHit += 1
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: responsesHit === 1
            ? "雨声压住窗纸。沈砚把账册合上，只问了一句：谁动过这一页？"
            : JSON.stringify({
                evaluation: {
                  verdict: "candidate",
                  summary: "样段进入稳定候选区间。",
                  scores: {
                    narrativeVoice: 8.4,
                    sentenceRhythm: 8.2,
                    dialogueTexture: 7.8,
                    informationDensity: 8.1,
                    emotionalTension: 8.0,
                    readability: 8.1,
                    requirementAlignment: 8.3,
                    forbiddenPatternRisk: 1.5,
                    overall: 8.4,
                  },
                  strengths: ["声音稳定。"],
                  deviations: ["钩子还可再收。"],
                  forbiddenHits: [],
                  nextFocus: ["只保留单点钩子。"],
                },
                refinement: {
                  summary: "继续轻收。",
                  promptAdjustments: ["钩子只保留一个。"],
                  contractAdjustments: ["结尾钩子强调单点追踪。"],
                  nextPrompt: "保持冷感白描，只留一个钩子。",
                },
              }),
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  clearAigcEnv()
  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const aigcDetector = await startPassingAigcDetector()
    aigcServer = aigcDetector.server
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writePassingAigcSettings(created.project.projectRoot, aigcDetector.port)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Runtime Loop Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "runtime-loop-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const generateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      iterationFeedback: "对白再短一点。",
      loopIterations: 1,
    }, { projectId: created.project.id })

    assert.equal(generateResponse.status, 200)
    assert.ok(generateResponse.payload.loopRun.runId)
    assert.equal(generateResponse.payload.loopRun.status, "completed")
    assert.equal(generateResponse.payload.loopRun.totalIterations, 1)
    assert.ok(generateResponse.payload.styleEvolution.loopRuntime)
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.runId, generateResponse.payload.loopRun.runId)
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.completedIterations, 1)
    assert.equal(generateResponse.payload.styleEvolution.contract.runtime.lastRunStatus, "completed")
    assert.equal(generateResponse.payload.styleEvolution.contract.runtime.lastRunId, generateResponse.payload.loopRun.runId)
    assert.ok(["max_iterations_reached", "stable_candidate", "ready_for_approval"].includes(generateResponse.payload.loopRun.stopReason))

    const runtimeFile = JSON.parse(await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "style", "evolution", "style-loop-runtime.json"),
      "utf8",
    ))
    assert.equal(runtimeFile.runId, generateResponse.payload.loopRun.runId)
    assert.equal(runtimeFile.status, "completed")
    assert.equal(runtimeFile.completedIterations, 1)
    assert.ok(Array.isArray(runtimeFile.iterations))
    assert.equal(runtimeFile.iterations.length, 1)
    assert.match(String(runtimeFile.iterations[0].prompt), /雨账/)
  } finally {
    restoreAigcEnv(previousAigcEnv)
    await new Promise((resolve) => server.close(resolve))
    if (aigcServer) {
      await new Promise((resolve) => aigcServer.close(resolve))
    }
  }
})

test("studio API keeps manual style candidates unapproved when AIGC detector is unavailable", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-api-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  clearAigcEnv()
  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })

    const initResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/init", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
    }, { projectId: created.project.id })

    assert.equal(initResponse.status, 200)
    assert.equal(initResponse.payload.styleEvolution.gate.canProceed, false)
    assert.match(initResponse.payload.styleEvolution.contract.seedPrompt, /雨账/)

    const candidateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/candidate", {
      projectId: created.project.id,
      prompt: "第二版样段",
      sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
      review: "可作为全书基础写法。",
    }, { projectId: created.project.id })

    assert.equal(candidateResponse.status, 200)
    assert.equal(candidateResponse.payload.styleEvolution.contract.evolutionHistory.length, 1)
    assert.equal(candidateResponse.payload.styleEvolution.contract.verification.status, "blocked")
    assert.notEqual(candidateResponse.payload.styleEvolution.contract.verification.status, "passed")
    assert.equal(candidateResponse.payload.styleEvolution.contract.evolutionHistory[0].verification.status, "blocked")
    assert.equal(candidateResponse.payload.styleEvolution.gate.canProceed, false)

    const previewResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/freeze-preview", {
      projectId: created.project.id,
      version: 1,
    }, { projectId: created.project.id })
    assert.equal(previewResponse.status, 400)
    assert.equal(previewResponse.payload.error, "style_generation_verification_blocked")

    const approveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
      projectId: created.project.id,
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }, { projectId: created.project.id })

    assert.equal(approveResponse.status, 400)
    assert.equal(approveResponse.payload.error, "style_generation_verification_blocked")

    const getResponse = await handleNovelStudioApi(
      tempDir,
      "GET",
      `/api/style-evolution?projectId=${encodeURIComponent(created.project.id)}`,
      {},
      { projectId: created.project.id },
    )

    assert.equal(getResponse.status, 200)
    assert.notEqual(getResponse.payload.styleEvolution.gate.status, "passed")
    assert.equal(getResponse.payload.styleEvolutionAssets.freezePackage.approvedSample.exists, false)
    assert.equal(getResponse.payload.styleEvolutionAssets.freezePackage.freezeLedger.exists, true)
  } finally {
    restoreAigcEnv(previousAigcEnv)
  }
})

test("studio API exposes freeze preview before final style approval", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-freeze-preview-api-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let aigcServer = null
  const previousAigcEnv = snapshotAigcEnv()
  clearAigcEnv()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.addLlmConfig({
      name: "Freeze Preview Model",
      baseUrl: "http://127.0.0.1:9",
      apiKey: "test-key",
      modelName: "preview-model",
      apiMode: "responses",
      timeoutMs: 50,
      isActive: true,
    })
  })

  try {
    aigcServer = http.createServer(async (request, response) => {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ aiProbability: 0.16, label: "human", confidence: 0.84 }))
    })
    await new Promise((resolve, reject) => {
      aigcServer.listen(0, "127.0.0.1", resolve)
      aigcServer.once("error", reject)
    })
    const aigcAddress = aigcServer.address()
    assert.ok(aigcAddress && typeof aigcAddress === "object")
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)

    await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/init", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
    }, { projectId: created.project.id })

    const candidateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/candidate", {
      projectId: created.project.id,
      prompt: "第二版样段",
      sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
      review: "可作为全书基础写法。",
    }, { projectId: created.project.id })

    assert.equal(candidateResponse.status, 200)
    assert.equal(candidateResponse.payload.styleEvolution.contract.verification.status, "passed")

    const acceptResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/accept", {
      projectId: created.project.id,
      version: 1,
    }, { projectId: created.project.id })
    assert.equal(acceptResponse.status, 200)

    const previewResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/freeze-preview", {
      projectId: created.project.id,
      version: 1,
    }, { projectId: created.project.id })

    assert.equal(previewResponse.status, 200)
    assert.equal(previewResponse.payload.freezePreview.version, 1)
    assert.match(previewResponse.payload.freezePreview.freezeSummary, /冻结|全书基础写法|v1/)
    assert.match(previewResponse.payload.freezePreview.frozenBasePrompt, /克制|冷感|白描|第二版样段/)
    assert.match(previewResponse.payload.freezePreview.styleContract.voice, /样段|写法参照|模型提炼|克制/)
    assert.ok(Array.isArray(previewResponse.payload.freezePreview.inheritedArtifacts))
    assert.ok(previewResponse.payload.freezePreview.inheritedArtifacts.includes("style contract"))
    assert.ok(Array.isArray(previewResponse.payload.freezePreview.inheritedRules))
    assert.ok(previewResponse.payload.freezePreview.inheritedRules.some((rule) => /继承/.test(rule)))
  } finally {
    restoreAigcEnv(previousAigcEnv)
    if (aigcServer) {
      await new Promise((resolve) => aigcServer.close(resolve))
    }
  }
})

test("studio API status exposes production readiness gate", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-readiness-api-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/init", {
    projectId: created.project.id,
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  }, { projectId: created.project.id })

  const statusResponse = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, {
    projectId: created.project.id,
  })

  assert.equal(statusResponse.status, 200)
  assert.equal(statusResponse.payload.productionReadiness.status, "blocked")
  assert.equal(statusResponse.payload.productionReadiness.canProceed, false)
  assert.ok(statusResponse.payload.productionReadiness.items.some((item) => item.key === "style_approval" && item.status === "blocked"))
  assert.ok(statusResponse.payload.productionReadiness.items.some((item) => item.key === "story_planning" && item.status === "blocked"))
  assert.ok(statusResponse.payload.productionReadiness.groups.some((group) =>
    group.key === "story_foundation" && group.assets.some((asset) => asset.label === "world-matrix.md" && asset.status === "blocked")
  ))
  assert.ok(statusResponse.payload.productionReadiness.groups.some((group) =>
    group.key === "chapter_execution" && group.assets.some((asset) => asset.key === "style_contract" && asset.status === "blocked")
  ))
  assert.ok(statusResponse.payload.productionReadiness.issues.some((issue) =>
    issue.code === "story_planning_assets_sparse" || issue.code === "story_planning_assets_incomplete"
  ))
  assert.equal(statusResponse.payload.factorySnapshot.productionReadiness.status, "blocked")
})

test("production readiness does not treat unverified style contract files as frozen", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-unverified-style-contract-readiness-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 3,
    chapterWordTarget: 2500,
  })
  const projectRoot = created.project.projectRoot
  const evolutionDir = path.join(projectRoot, ".ai-novel", "style", "evolution")
  await fs.mkdir(evolutionDir, { recursive: true })
  await fs.writeFile(path.join(evolutionDir, "user-approved-sample.md"), "这是一段旧资产样段，但没有通过生成验证。\n")
  await fs.writeFile(path.join(evolutionDir, "style-contract.json"), `${JSON.stringify({
    approvedAt: "2026-06-25T00:00:00.000Z",
    approvedSample: "这是一段旧资产样段，但没有通过生成验证。",
    approval: {
      status: "approved",
      acceptedAsBookStyle: true,
      approvedAt: "2026-06-25T00:00:00.000Z",
    },
    inheritance: {
      status: "enforced",
      inheritedArtifacts: ["base writing prompt", "style contract"],
      inheritedRules: ["后续每章必须继承旧写法。"],
    },
    styleContract: createCompleteStyleContractForTest({
      voice: "克制冷感，动作先行。",
      sentenceRhythm: "短句推进。",
      dialogueRules: ["对白短，带压力。"],
      descriptionRules: ["先物件后判断。"],
      forbiddenPatterns: ["解释创作意图"],
      positiveExamples: ["沈砚把账册推到灯下。"],
    }),
  }, null, 2)}\n`)

  const statusResponse = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, {
    projectId: created.project.id,
  })

  assert.equal(statusResponse.status, 200)
  assert.equal(statusResponse.payload.productionReadiness.status, "blocked")
  assert.ok(statusResponse.payload.productionReadiness.issues.some((issue) =>
    issue.code === "style_generation_verification_missing"
  ))
  assert.ok(statusResponse.payload.productionReadiness.groups.some((group) =>
    group.key === "chapter_execution"
      && group.assets.some((asset) =>
        asset.key === "style_contract"
          && asset.status === "blocked"
          && /验证门未通过/.test(asset.detail)
      )
  ))
})

test("production readiness treats blocked chapter style inheritance as a hard gate", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-chapter-style-readiness-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const projectRoot = created.project.projectRoot

  await fs.mkdir(path.join(projectRoot, ".ai-novel", "prompts"), { recursive: true })
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "prompts", "global-consensus.md"), "主角、世界规则和主线压力已确认。\n")
  await approveProductionReadinessForTest(projectRoot, created.state, {
    projectTitle: created.project.title,
    idea: created.project.idea,
  })
  await withFactoryDb(tempDir, async (db) => {
    for (let chapterNumber = 1; chapterNumber <= 2; chapterNumber += 1) {
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter_blueprint",
        path: `.ai-novel/plans/chapter-blueprints/chapter-${String(chapterNumber).padStart(3, "0")}.md`,
        metadata: { chapterNumber },
      })
    }
  })
  await fs.mkdir(path.join(projectRoot, ".ai-novel", "chapters"), { recursive: true })
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.versions.json"), `${JSON.stringify({
    version: 1,
    chapterNumber: 1,
    publishedVersionId: "final",
    styleInheritanceVerification: {
      status: "ready",
      summary: "旧的写法继承验证曾经通过。",
      risks: [],
    },
    styleConformanceDrift: {
      status: "drifted",
      reason: "写法漂移验证阻塞：节奏偏离冻结样段。",
      risks: ["节奏偏离冻结样段。"],
    },
    versions: [
      {
        id: "final",
        source: "final",
        path: ".ai-novel/chapters/chapter-001.final.md",
        status: "passed",
      },
    ],
  }, null, 2)}\n`)

  const statusResponse = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, {
    projectId: created.project.id,
  })

  assert.equal(statusResponse.status, 200)
  assert.equal(statusResponse.payload.productionReadiness.status, "blocked")
  assert.equal(statusResponse.payload.productionReadiness.canProceed, false)
  assert.match(statusResponse.payload.productionReadiness.blockedReason, /写法漂移验证阻塞|继承/)
  assert.ok(statusResponse.payload.productionReadiness.issues.some((issue) =>
    issue.code === "chapter_style_inheritance_blocked" && issue.severity === "critical"
  ))
  assert.ok(statusResponse.payload.productionReadiness.groups.some((group) =>
    group.key === "chapter_execution"
      && group.assets.some((asset) =>
        asset.key === "chapter_style_inheritance"
          && asset.status === "blocked"
          && /写法漂移验证阻塞/.test(asset.detail)
      )
  ))
  assert.equal(statusResponse.payload.factorySnapshot.productionReadiness.status, "blocked")
})

test("studio API can repair production story foundation assets", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-story-assets-repair-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  const repairResponse = await handleNovelStudioApi(tempDir, "POST", "/api/production/story-assets/repair", {
    projectId: created.project.id,
  }, { projectId: created.project.id })

  assert.equal(repairResponse.status, 200)
  assert.deepEqual(repairResponse.payload.repairedStoryAssets.sort(), [
    ".ai-novel/plans/character-dynamics.json",
    ".ai-novel/plans/character-dynamics.md",
    ".ai-novel/plans/foreshadowing-ledger.json",
    ".ai-novel/plans/foreshadowing-ledger.md",
    ".ai-novel/plans/plot-architecture.json",
    ".ai-novel/plans/plot-architecture.md",
    ".ai-novel/plans/story-bible.json",
    ".ai-novel/plans/story-bible.md",
    ".ai-novel/plans/story-foundation-contract.json",
    ".ai-novel/plans/volume-strategy.json",
    ".ai-novel/plans/volume-strategy.md",
    ".ai-novel/plans/writing-plan.json",
    ".ai-novel/plans/world-matrix.json",
    ".ai-novel/plans/world-matrix.md",
  ].sort())
  for (const assetPath of repairResponse.payload.repairedStoryAssets) {
    const content = await fs.readFile(path.join(created.project.projectRoot, assetPath), "utf8")
    assert.match(content, /雨账|Chapter|World|Story|Ledger|Strategy|Relationship|version|chapters|entries/u)
  }
  const structuredContract = JSON.parse(await fs.readFile(
    path.join(created.project.projectRoot, ".ai-novel", "plans", "story-foundation-contract.json"),
    "utf8",
  ))
  assert.equal(structuredContract.project.title, "雨账")
  assert.equal(structuredContract.plot.chapters.length, 6)
  assert.ok(structuredContract.gates.mustPassBeforeDrafting.includes("style_approval"))
  const foreshadowingLedger = JSON.parse(await fs.readFile(
    path.join(created.project.projectRoot, ".ai-novel", "plans", "foreshadowing-ledger.json"),
    "utf8",
  ))
  assert.equal(foreshadowingLedger.entries.length, 6)
  const writingPlan = JSON.parse(await fs.readFile(
    path.join(created.project.projectRoot, ".ai-novel", "plans", "writing-plan.json"),
    "utf8",
  ))
  assert.equal(writingPlan.status, "planning")
  assert.equal(writingPlan.chapters.length, 6)
  assert.equal(writingPlan.chapters[0].filePath, ".ai-novel/chapters/chapter-001.final.md")
  assert.ok(repairResponse.payload.productionReadiness.groups.some((group) =>
    group.key === "story_foundation"
      && group.assets.some((asset) => asset.key === "story_foundation_approval" && asset.status === "blocked")
      && group.assets
        .filter((asset) => asset.key !== "story_foundation_approval")
        .every((asset) => asset.status !== "blocked")
  ))

  const approvalResponse = await handleNovelStudioApi(tempDir, "POST", "/api/production/story-foundation/approve", {
    projectId: created.project.id,
    note: "这些故事基建可以进入正文生产。",
  }, { projectId: created.project.id })
  assert.equal(approvalResponse.status, 200)
  assert.equal(approvalResponse.payload.storyFoundationApproval.approved, true)
  assert.equal(approvalResponse.payload.storyFoundationApproval.note, "这些故事基建可以进入正文生产。")
  const approvalFile = JSON.parse(await fs.readFile(
    path.join(created.project.projectRoot, ".ai-novel", "plans", "story-foundation-approval.json"),
    "utf8",
  ))
  assert.equal(approvalFile.approved, true)
  assert.ok(String(approvalFile.assetFingerprint || "").length > 0)
  assert.ok(approvalResponse.payload.productionReadiness.items.some((item) =>
    item.key === "story_foundation_approval" && item.status === "passed"
  ))
  assert.ok(!approvalResponse.payload.productionReadiness.issues.some((issue) =>
    issue.code === "story_foundation_approval_missing"
  ))

  const previewResponse = await handleNovelStudioApi(
    tempDir,
    "GET",
    `/api/artifacts/preview?path=${encodeURIComponent(".ai-novel/plans/story-bible.md")}`,
    {},
    { projectId: created.project.id },
  )
  assert.equal(previewResponse.status, 200)
  assert.match(previewResponse.payload.content, /Non-Negotiable Story Contract/)
})

test("story foundation approval becomes stale after planning assets change", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-story-foundation-stale-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  await handleNovelStudioApi(tempDir, "POST", "/api/production/story-assets/repair", {
    projectId: created.project.id,
  }, { projectId: created.project.id })
  const approvalResponse = await handleNovelStudioApi(tempDir, "POST", "/api/production/story-foundation/approve", {
    projectId: created.project.id,
    note: "这些故事基建可以进入正文生产。",
  }, { projectId: created.project.id })
  assert.equal(approvalResponse.status, 200)

  await fs.writeFile(
    path.join(created.project.projectRoot, ".ai-novel", "plans", "world-matrix.json"),
    `${JSON.stringify({
      version: 1,
      title: "雨账",
      rules: ["世界规则已冻结", "新增一条会改变基建的规则"],
    }, null, 2)}\n`,
  )

  const statusResponse = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: created.project.id })
  assert.equal(statusResponse.status, 200)
  assert.equal(statusResponse.payload.productionReadiness.status, "blocked")
  assert.ok(statusResponse.payload.productionReadiness.items.some((item) =>
    item.key === "story_foundation_approval" && item.status === "blocked"
  ))
  assert.ok(statusResponse.payload.productionReadiness.issues.some((issue) =>
    issue.code === "story_foundation_approval_stale"
  ))
})

test("autonomous workflow blocks drafting until story foundation is user approved", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-drafting-readiness-gate-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"
  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
      projectTitle: created.project.title,
      idea: created.project.idea,
    })
    await fs.rm(path.join(created.project.projectRoot, ".ai-novel", "plans", "story-foundation-approval.json"), { force: true })

    let state = created.state
    while (state.runtime.stage !== "chapter_task_generation") {
      state = await advanceAutonomousProject(created.project.projectRoot, {
        factoryRootDir: tempDir,
        projectId: created.project.id,
      })
    }

    const blocked = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    assert.equal(blocked.runtime.stage, "chapter_task_generation")
    assert.match(blocked.runtime.statusMessage, /story foundation|故事基建|用户确认|readiness/i)
    assert.equal(blocked.plan.chapterTasks.some((task) => task.status === "complete" || task.status === "in_progress"), false)

    const events = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id).latestEvents)
    assert.ok(events.some((event) => event.type === "DRAFTING_START_BLOCKED_BY_READINESS"))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("legacy drafting stage cannot start pending chapters before production readiness passes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-legacy-drafting-readiness-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"
  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "pending"
    state.plan.chapterTasks[1].status = "pending"
    state.plan.pendingChapters = 2
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    const blocked = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(blocked.runtime.stage, "chapter_task_generation")
    assert.match(blocked.runtime.statusMessage, /readiness|故事基建|写法|章节蓝图|确认/i)
    assert.equal(blocked.plan.chapterTasks[0].status, "pending")
    await assert.rejects(
      fs.access(path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md")),
    )
    const events = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id).latestEvents)
    assert.ok(events.some((event) => event.type === "DRAFTING_START_BLOCKED_BY_READINESS"))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("AIGC workflow completion cannot bypass production readiness and style freeze gates", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-aigc-complete-readiness-"))
  const { createManagedAutonomousProject, loadAutonomousState } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  const response = await handleNovelStudioApi(tempDir, "POST", "/api/aigc/mark-workflow-complete", {
    projectId: created.project.id,
  }, { projectId: created.project.id })

  assert.equal(response.status, 409)
  assert.equal(response.payload.error, "workflow_completion_readiness_blocked")
  assert.equal(response.payload.success, false)
  assert.equal(response.payload.productionReadiness.canProceed, false)
  assert.ok(response.payload.productionReadiness.issues.some((issue) =>
    issue.code === "style_approval_missing" || issue.code === "approved_sample_missing" || issue.code === "style_generation_verification_missing"
  ))

  const persistedState = await loadAutonomousState(created.project.projectRoot)
  assert.notEqual(persistedState.runtime.stage, "complete")
})

test("AIGC workflow completion requires readable published chapters", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-aigc-complete-reader-"))
  const { createManagedAutonomousProject, loadAutonomousState, withFactoryDb } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
    projectTitle: created.project.title,
    idea: created.project.idea,
  })
  await withFactoryDb(tempDir, async (db) => {
    for (let chapterNumber = 1; chapterNumber <= 2; chapterNumber += 1) {
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter_blueprint",
        path: `.ai-novel/plans/chapter-blueprints/chapter-${String(chapterNumber).padStart(3, "0")}.md`,
        metadata: { chapterNumber },
      })
    }
  })

  const response = await handleNovelStudioApi(tempDir, "POST", "/api/aigc/mark-workflow-complete", {
    projectId: created.project.id,
  }, { projectId: created.project.id })

  assert.equal(response.status, 409)
  assert.equal(response.payload.error, "workflow_completion_reader_chapters_incomplete")
  assert.match(response.payload.reason, /0\/2/)
  assert.equal(response.payload.productionReadiness.canProceed, true)

  const persistedState = await loadAutonomousState(created.project.projectRoot)
  assert.notEqual(persistedState.runtime.stage, "complete")
})

test("AIGC batch refine cannot rewrite chapters before style contract is frozen", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-aigc-batch-refine-style-gate-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 1,
    chapterWordTarget: 2500,
  })
  const projectRoot = created.project.projectRoot
  const chapterDir = path.join(projectRoot, ".ai-novel", "chapters")
  await fs.mkdir(chapterDir, { recursive: true })
  const originalDraft = [
    "# 第一章 雨账",
    "",
    "这是一段待检测正文。事实上它不仅如此，还带着模板化总结。",
  ].join("\n")
  await fs.writeFile(path.join(chapterDir, "chapter-001.final.md"), originalDraft)

  const response = await handleNovelStudioApi(tempDir, "POST", "/api/aigc/batch-refine", {
    projectId: created.project.id,
    chapterNumber: 1,
  }, { projectId: created.project.id })

  assert.equal(response.status, 409)
  assert.equal(response.payload.success, false)
  assert.equal(response.payload.error, "style_contract_not_ready")
  assert.match(response.payload.reason, /Generation Verification Gate|写法合同/)
  assert.equal(response.payload.activeProjectId, created.project.id)
  assert.equal(response.payload.styleEvolution.gate.status, "blocked")
  assert.equal(response.payload.styleEvolutionAssets.freezePackage.loopRuntime.exists, false)
  assert.ok(response.payload.projectRuntime)
  assert.ok(response.payload.productionReadiness)
  assert.equal(await fs.readFile(path.join(chapterDir, "chapter-001.final.md"), "utf8"), originalDraft)
})

test("AIGC batch scan persists detection and publish readiness into chapter manifest", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-aigc-batch-scan-manifest-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  const aigcServer = http.createServer(async (_request, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ aiProbability: 0.11, label: "human", confidence: 0.89 }))
  })

  try {
    await new Promise((resolve, reject) => {
      aigcServer.listen(0, "127.0.0.1", resolve)
      aigcServer.once("error", reject)
    })
    const aigcAddress = aigcServer.address()
    assert.ok(aigcAddress && typeof aigcAddress === "object")

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 1,
      chapterWordTarget: 2500,
    })
    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
      projectTitle: created.project.title,
      idea: created.project.idea,
    })
    await writePassingAigcSettings(created.project.projectRoot, aigcAddress.port)

    const projectRoot = created.project.projectRoot
    const chapterDir = path.join(projectRoot, ".ai-novel", "chapters")
    await fs.mkdir(chapterDir, { recursive: true })
    const finalDraft = [
      "# 第一章 雨账",
      "",
      "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    ].join("\n")
    await fs.writeFile(path.join(chapterDir, "chapter-001.final.md"), finalDraft)
    await fs.writeFile(path.join(chapterDir, "chapter-001.versions.json"), `${JSON.stringify({
      version: 1,
      chapterNumber: 1,
      chapterTitle: "雨账",
      publishedVersionId: "final",
      locked: false,
      status: "needs_review",
      qualityGate: { status: "passed", score: 8.5, reason: "ok" },
      artifacts: {
        memory: ".ai-novel/memory/chapter-001-memory.md",
        report: ".ai-novel/reports/chapter-001-quality.md",
      },
      versions: [
        {
          id: "final",
          source: "final",
          label: "Final",
          path: ".ai-novel/chapters/chapter-001.final.md",
          status: "passed",
          wordCount: finalDraft.length,
        },
      ],
    }, null, 2)}\n`)
    await fs.mkdir(path.join(projectRoot, ".ai-novel", "reports"), { recursive: true })
    await fs.mkdir(path.join(projectRoot, ".ai-novel", "memory"), { recursive: true })
    await fs.writeFile(path.join(projectRoot, ".ai-novel", "reports", "chapter-001-quality.md"), "质量报告通过。\n")
    await fs.writeFile(path.join(projectRoot, ".ai-novel", "memory", "chapter-001-memory.md"), "章节记忆。\n")

    const response = await handleNovelStudioApi(tempDir, "POST", "/api/aigc/batch-scan", {
      projectId: created.project.id,
    }, { projectId: created.project.id })

    assert.equal(response.status, 200)
    assert.equal(response.payload.success, true)
    assert.equal(response.payload.activeProjectId, created.project.id)
    assert.ok(response.payload.styleEvolution.gate.status)
    assert.equal(response.payload.results[1].report.status, "passed")
    assert.ok(response.payload.results[1].styleConformanceDrift)
    assert.ok(response.payload.results[1].publishReadiness)
    const manifest = JSON.parse(await fs.readFile(path.join(chapterDir, "chapter-001.versions.json"), "utf8"))
    assert.equal(manifest.aigcDetection.status, "passed")
    assert.ok(manifest.styleConformanceDrift)
    assert.equal(manifest.batchRefine.refined, false)
    assert.ok(manifest.publishReadiness)
    assert.ok(manifest.publishReadiness.styleInheritanceVerification)
  } finally {
    restoreAigcEnv(previousAigcEnv)
    await new Promise((resolve) => aigcServer.close(resolve))
  }
})

test("AIGC batch refine keeps original final draft when refined draft fails verification", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-aigc-batch-refine-no-overwrite-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  delete process.env.AI_NOVEL_TEST_MODE
  let llmHits = 0
  const llmServer = http.createServer(async (request, response) => {
    if (request.url === "/responses") {
      llmHits += 1
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.end([
        `data: ${JSON.stringify({
          type: "response.output_text.delta",
          delta: "这是被模型重写后的临时文本，但依然模板化，不能写回最终正文。",
        })}`,
        "",
        "data: [DONE]",
        "",
      ].join("\n"))
      return
    }
    response.writeHead(404).end()
  })
  const aigcServer = http.createServer(async (request, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ aiProbability: 0.94, label: "疑似AI生成" }))
  })

  try {
    await new Promise((resolve, reject) => {
      llmServer.listen(0, "127.0.0.1", resolve)
      llmServer.once("error", reject)
    })
    await new Promise((resolve, reject) => {
      aigcServer.listen(0, "127.0.0.1", resolve)
      aigcServer.once("error", reject)
    })
    const llmAddress = llmServer.address()
    const aigcAddress = aigcServer.address()
    assert.ok(llmAddress && typeof llmAddress === "object")
    assert.ok(aigcAddress && typeof aigcAddress === "object")

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 1,
      chapterWordTarget: 2500,
    })
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)
    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
      projectTitle: created.project.title,
      idea: created.project.idea,
    })
    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Batch Refine Model",
      baseUrl: `http://127.0.0.1:${llmAddress.port}`,
      apiKey: "test-key",
      modelName: "batch-refine-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const projectRoot = created.project.projectRoot
    const chapterDir = path.join(projectRoot, ".ai-novel", "chapters")
    await fs.mkdir(chapterDir, { recursive: true })
    const originalDraft = [
      "# 第一章 雨账",
      "",
      "这是一段模板化表达。事实上它不仅如此，还带着标准生成文本的痕迹。沈砚把账册推到灯下，只问一句：谁动过这一页？",
    ].join("\n")
    await fs.writeFile(path.join(chapterDir, "chapter-001.final.md"), originalDraft)
    await fs.writeFile(path.join(chapterDir, "chapter-001.versions.json"), `${JSON.stringify({
      version: 1,
      chapterNumber: 1,
      chapterTitle: "雨账",
      publishedVersionId: "final",
      locked: true,
      status: "published",
      qualityGate: { status: "passed", score: 8.5, reason: "ok" },
      artifacts: {
        memory: ".ai-novel/memory/chapter-001-memory.md",
        report: ".ai-novel/reports/chapter-001-quality.md",
      },
      versions: [
        {
          id: "final",
          source: "final",
          label: "Final",
          path: ".ai-novel/chapters/chapter-001.final.md",
          status: "passed",
          wordCount: originalDraft.length,
        },
      ],
    }, null, 2)}\n`)
    await fs.mkdir(path.join(projectRoot, ".ai-novel", "reports"), { recursive: true })
    await fs.mkdir(path.join(projectRoot, ".ai-novel", "memory"), { recursive: true })
    await fs.writeFile(path.join(projectRoot, ".ai-novel", "reports", "chapter-001-quality.md"), "质量报告通过。\n")
    await fs.writeFile(path.join(projectRoot, ".ai-novel", "memory", "chapter-001-memory.md"), "章节记忆。\n")

    const response = await handleNovelStudioApi(tempDir, "POST", "/api/aigc/batch-refine", {
      projectId: created.project.id,
      chapterNumber: 1,
    }, { projectId: created.project.id })

    assert.equal(response.status, 200)
    assert.equal(response.payload.success, true)
    assert.equal(response.payload.activeProjectId, created.project.id)
    assert.ok(response.payload.styleEvolution.gate.status)
    assert.equal(response.payload.styleEvolutionAssets.freezePackage.approvedSample.exists, true)
    assert.ok(response.payload.projectRuntime)
    assert.ok(response.payload.productionReadiness)
    assert.equal(response.payload.results[1].refined, false)
    assert.match(response.payload.results[1].blockedReason, /AIGC 复检未通过|风格继承漂移未通过/)
    assert.ok(llmHits >= 1)
    assert.equal(await fs.readFile(path.join(chapterDir, "chapter-001.final.md"), "utf8"), originalDraft)
    const manifest = JSON.parse(await fs.readFile(path.join(chapterDir, "chapter-001.versions.json"), "utf8"))
    assert.equal(manifest.locked, false)
    assert.equal(manifest.status, "needs_review")
    assert.equal(manifest.aigcDetection.status, "blocked")
    assert.equal(manifest.batchRefine.refined, false)
    assert.notEqual(manifest.publishReadiness.ready, true)
  } finally {
    restoreAigcEnv(previousAigcEnv)
    if (previousTestMode === undefined) delete process.env.AI_NOVEL_TEST_MODE
    else process.env.AI_NOVEL_TEST_MODE = previousTestMode
    await new Promise((resolve) => llmServer.close(resolve))
    await new Promise((resolve) => aigcServer.close(resolve))
  }
})

test("studio API generates style evolution candidates through the configured text model", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-generate-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let responsesHit = false
  const receivedBodies = []
  const previousAigcEnv = snapshotAigcEnv()
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        responsesHit = true
        const receivedBody = JSON.parse(rawBody)
        receivedBodies.push(receivedBody)
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text:
            receivedBodies.length === 1
              ? "雨从檐角落下来。沈砚把账册翻到缺页处，指腹停在潮湿的纸边上。门外有人咳了一声，他没有抬头，只把灯芯拨低。"
              : receivedBodies.length === 2
                ? JSON.stringify({
                    evaluation: {
                      verdict: "candidate",
                      summary: "候选一已有基底，但还要继续收紧。",
                      scores: {
                        narrativeVoice: 8.0,
                        sentenceRhythm: 7.8,
                        dialogueTexture: 7.2,
                        informationDensity: 7.9,
                        emotionalTension: 7.8,
                        readability: 8.0,
                        requirementAlignment: 8.1,
                        forbiddenPatternRisk: 1.4,
                        overall: 8.0,
                      },
                      strengths: ["声音已经靠近冷感白描。"],
                      deviations: ["对白还可更短。"],
                      forbiddenHits: [],
                      nextFocus: ["继续压短对白。"],
                    },
                  })
                : receivedBodies.length === 3
                  ? JSON.stringify({
                      refinement: {
                        summary: "继续轻收对白和钩子。",
                        promptAdjustments: ["对白只保留必要试探。"],
                        contractAdjustments: ["对白规则继续强调短句。"],
                        nextPrompt: "保持冷感白描，继续压短对白。",
                      },
                    })
	                  : receivedBodies.length === 4
	                    ? JSON.stringify({
	                        freezeVerdict: "ready",
	                        freezeSummary: "当前版本已形成初步全书基底，但冻结前还可继续轻收。",
	                        blockingReasons: [],
	                        contractAdjustments: ["冻结前继续强调对白短句。"],
	                        forbiddenPatterns: ["解释创作意图"],
	                        positiveExamples: ["沈砚没有抬头，只把灯芯拨低。"],
                        inheritedRules: ["正文必须延续冷感白描和短对白规则。"],
                      })
                    : receivedBodies.length === 5
                      ? "雨声压低了窗纸。沈砚合上账册，只问了一句：谁动过这一页？门外的人没有答，鞋底的泥先退了半步。"
                      : receivedBodies.length === 6
                        ? JSON.stringify({
                            evaluation: {
                              verdict: "candidate",
                              summary: "第二版已经更接近可用写法。",
                              scores: {
                                narrativeVoice: 8.5,
                                sentenceRhythm: 8.2,
                                dialogueTexture: 7.9,
                                informationDensity: 8.1,
                                emotionalTension: 8.0,
                                readability: 8.2,
                                requirementAlignment: 8.4,
                                forbiddenPatternRisk: 1.2,
                                overall: 8.4,
                              },
                              strengths: ["对白更短，压迫感更明确。"],
                              deviations: ["钩子还可再收。"],
                              forbiddenHits: [],
                              nextFocus: ["只留一个钩子。"],
                            },
                          })
                        : receivedBodies.length === 7
                          ? JSON.stringify({
                              refinement: {
                                summary: "保留当前声音，继续轻收。",
                                promptAdjustments: ["结尾只保留一个钩子。"],
                                contractAdjustments: ["对白与钩子继续收紧。"],
                                nextPrompt: "保持冷感白描，只留一个钩子。",
                              },
                            })
	                          : receivedBodies.length === 8
	                            ? JSON.stringify({
	                                freezeVerdict: "ready",
	                                freezeSummary: "第二版可作为更稳定的全书基底。",
	                                blockingReasons: [],
	                                contractAdjustments: ["冻结前继续保持对白短句与停顿。"],
	                                forbiddenPatterns: ["解释创作意图"],
                                positiveExamples: ["沈砚合上账册，只问了一句：谁动过这一页？"],
                                inheritedRules: ["正文必须延续当前冷感白描与短对白规则。"],
                              })
	                            : receivedBodies.length === 10
	                              ? JSON.stringify({
	                                  freezeVerdict: "ready",
	                                  freezeSummary: "第二版已经具备冻结为全书基础写法的稳定度。",
	                                  blockingReasons: [],
	                                  contractAdjustments: ["冻结后继续保持对白短句与动作压迫。"],
	                                  forbiddenPatterns: ["解释创作意图", "总结式升华"],
	                                  positiveExamples: ["沈砚合上账册，只问了一句：谁动过这一页？"],
	                                  inheritedRules: ["正文必须继承冷感白描、短对白和物件推进规则。"],
	                                })
                            : JSON.stringify({
                  voice: "模型提炼：克制冷感、白描推进、以物件和动作压住悬疑。",
                  sentenceRhythm: "短句为主，少量中句承接动作后果，避免解释性长段。",
                  dialogueRules: ["对白短，带压力，不解释背景。"],
                  descriptionRules: ["先物件、声音、身体反应，再给判断。"],
                  emotionRules: ["情绪用停顿、手势和回避呈现。"],
                  pacingRules: ["每段必须推进线索或关系压力。"],
                  povRules: ["稳定贴近主视角，不泄露未来信息。"],
                  openingRules: ["开场落在具体物件和异常上。"],
                  endingHookRules: ["结尾留下可追踪问题或动作余波。"],
                  allowedDevices: ["账册", "雨声", "灯火", "门外脚步"],
                  forbiddenPatterns: ["解释创作意图", "总结式升华", "同质化对白"],
                  positiveExamples: ["沈砚合上账册，只问了一句：谁动过这一页？"],
                  negativeExamples: ["他知道事情很严重，未来会更加危险。"],
                }),
        }))
        return
      }
      response.writeHead(404).end()
    })
  })
  const aigcServer = http.createServer(async (_request, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ aiProbability: 0.12, label: "human", confidence: 0.88 }))
  })

  clearAigcEnv()
  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    await new Promise((resolve, reject) => {
      aigcServer.listen(0, "127.0.0.1", resolve)
      aigcServer.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const aigcAddress = aigcServer.address()
    assert.ok(aigcAddress && typeof aigcAddress === "object")
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writePassingAigcSettings(created.project.projectRoot, aigcAddress.port)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Style Text Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "test-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const generateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      loopIterations: 1,
    }, { projectId: created.project.id })

    assert.equal(generateResponse.status, 200)
    assert.equal(responsesHit, true)
    assert.equal(receivedBodies[0].model, "test-model")
    assert.match(receivedBodies[0].instructions, /Candidate Generator/)
    assert.match(String(receivedBodies[0].input), /雨账/)
    assert.equal(generateResponse.payload.styleEvolution.contract.evolutionHistory.length, 1)
    assert.equal(generateResponse.payload.generatedCandidate.version, 1)
    assert.match(generateResponse.payload.generatedCandidate.sample, /沈砚/)
    assert.equal(generateResponse.payload.styleEvolution.gate.canProceed, false)
    assert.equal(generateResponse.payload.loopIteration.evaluation.verdict, "candidate")
    assert.ok(Array.isArray(generateResponse.payload.loopIteration.refinement.promptAdjustments))
    assert.equal(generateResponse.payload.styleEvolution.contract.loop.status, "awaiting_user")

    const iterateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      iterationFeedback: "对白再短一点，减少解释，多用动作压迫。",
      loopIterations: 1,
    }, { projectId: created.project.id })

    assert.equal(iterateResponse.status, 200)
    const generationRequests = receivedBodies.filter((body) => /Candidate Generator/.test(String(body.instructions || "")))
    assert.equal(generationRequests.length, 2)
    assert.match(String(generationRequests[1].input), /对白再短一点/)
    assert.match(String(generationRequests[1].input), /上一版候选样段/)
    assert.equal(iterateResponse.payload.generatedCandidate.version, 2)
    assert.ok(["candidate", "approve", "retry"].includes(iterateResponse.payload.loopIteration.evaluation.verdict))
    assert.ok(iterateResponse.payload.styleEvolution.contract.evolutionHistory[1].evaluation)
    assert.ok(iterateResponse.payload.styleEvolution.contract.evolutionHistory[1].refinement)
    assert.equal(iterateResponse.payload.loopRun.totalIterations, 1)
    assert.equal(typeof iterateResponse.payload.styleEvolution.contract.evolutionHistory[1].readyForApproval, "boolean")
    assert.ok(Array.isArray(iterateResponse.payload.styleEvolution.contract.evolutionHistory[1].readyReasons))

    const acceptResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/accept", {
      projectId: created.project.id,
      version: 2,
      acceptedAt: "2026-06-25T00:00:00.000Z",
    }, { projectId: created.project.id })

    assert.equal(acceptResponse.status, 200, JSON.stringify(acceptResponse.payload))
    assert.equal(acceptResponse.payload.styleEvolution.contract.evolutionHistory[1].userDecision, "accepted_for_freeze")
    assert.equal(acceptResponse.payload.styleEvolution.contract.approval.status, "pending")
    assert.equal(acceptResponse.payload.styleEvolution.contract.approval.acceptedAsBookStyle, false)
    assert.equal(acceptResponse.payload.styleEvolution.contract.approval.approvedVersion, undefined)
    assert.equal(acceptResponse.payload.styleEvolution.contract.loop.approvalVersion, undefined)
    assert.notEqual(acceptResponse.payload.styleEvolution.gate.status, "passed")

    const approveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
      projectId: created.project.id,
      version: 2,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }, { projectId: created.project.id })

    assert.equal(approveResponse.status, 200, JSON.stringify(approveResponse.payload))
    const extractionRequest = receivedBodies.find((body) => String(body.instructions || "").includes("写法合同提炼器"))
    assert.ok(extractionRequest)
    assert.match(extractionRequest.instructions, /写法合同提炼器/)
    assert.match(String(extractionRequest.input), /用户确认样段/)
    assert.match(approveResponse.payload.styleEvolution.contract.styleContract.voice, /模型提炼/)
    assert.ok(approveResponse.payload.styleEvolution.contract.styleContract.forbiddenPatterns.includes("同质化对白"))
    assert.equal(approveResponse.payload.styleEvolution.gate.status, "passed")
    assert.equal(approveResponse.payload.styleEvolution.contract.loop.status, "approved")
    assert.ok(approveResponse.payload.styleEvolution.contract.frozenBasePrompt?.length > 0)
    assert.equal(approveResponse.payload.styleEvolution.contract.approval.acceptedAsBookStyle, true)
    assert.equal(approveResponse.payload.styleEvolution.contract.approval.approvedVersion, 2)
    assert.equal(approveResponse.payload.styleEvolution.contract.inheritance.status, "enforced")
    assert.ok(Array.isArray(approveResponse.payload.styleEvolution.contract.styleContract.positiveExamples))
    assert.ok(approveResponse.payload.styleEvolution.contract.styleContract.positiveExamples.length >= 1)
    assert.ok(Array.isArray(approveResponse.payload.styleEvolution.contract.inheritance.inheritedRules))
    assert.ok(approveResponse.payload.styleEvolution.contract.inheritance.inheritedRules.some((rule) => /继承|正文/.test(rule)))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await new Promise((resolve) => aigcServer.close(resolve))
    restoreAigcEnv(previousAigcEnv)
  }
})

test("style evolution loop controller can auto-run multiple iterations before returning", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-auto-loop-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  let aigcServer = null
  let responsesHit = 0
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        responsesHit += 1
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: responsesHit === 1
            ? "雨声压着窗纸。沈砚把账册推到灯下，只问一句：谁动过这一页？老周没有接，湿袖往身后缩了半寸。"
            : "雨压在窗纸上。沈砚把账册推回灯影里，只问一句：谁动过这一页？门外的人没有进来。",
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  clearAigcEnv()
  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const aigcDetector = await startPassingAigcDetector()
    aigcServer = aigcDetector.server
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writePassingAigcSettings(created.project.projectRoot, aigcDetector.port)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Loop Text Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "loop-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const loopResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      iterationFeedback: "减少解释，多用动作和物件压迫。",
      loopIterations: 2,
    }, { projectId: created.project.id })

    assert.equal(loopResponse.status, 200)
    assert.ok(loopResponse.payload.loopRun.totalIterations >= 1)
    assert.ok(loopResponse.payload.styleEvolution.contract.evolutionHistory.length >= 1)
    assert.ok(loopResponse.payload.styleEvolution.contract.loop.currentIteration >= 1)
    assert.equal(loopResponse.payload.styleEvolution.contract.evolutionHistory[0].verification.status, "passed")
    assert.ok(Number(loopResponse.payload.styleEvolution.contract.evolutionHistory[0].evaluation.scores.overall || 0) < 8.6)
    assert.match(loopResponse.payload.generatedCandidate.sample, /沈砚/)
  } finally {
    restoreAigcEnv(previousAigcEnv)
    await new Promise((resolve) => server.close(resolve))
    if (aigcServer) {
      await new Promise((resolve) => aigcServer.close(resolve))
    }
  }
})

test("style evolution loop can generate multiple candidates per iteration and persist the winning one", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-multi-candidate-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  const receivedBodies = []
  let aigcServer = null
  let responsesHit = 0
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        responsesHit += 1
        const receivedBody = JSON.parse(rawBody)
        receivedBodies.push(receivedBody)
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text:
            responsesHit === 1
              ? "他知道事情很严重，未来会更加危险。"
              : responsesHit === 2
                ? "雨线垂在门槛外。沈砚把账册推回灯下，只问一句：谁动过这一页？"
                : responsesHit === 3
                  ? JSON.stringify({
                      evaluation: {
                        verdict: "retry",
                        summary: "候选一解释腔太重。",
                        scores: {
                          narrativeVoice: 6.1,
                          sentenceRhythm: 6.0,
                          dialogueTexture: 5.5,
                          informationDensity: 6.2,
                          emotionalTension: 5.9,
                          readability: 6.8,
                          requirementAlignment: 6.2,
                          forbiddenPatternRisk: 7.2,
                          overall: 6.0,
                        },
                        strengths: ["至少还是正文形态。"],
                        deviations: ["解释腔过强。"],
                        forbiddenHits: ["解释创作意图"],
                        nextFocus: ["先清掉解释腔。"],
                      },
                    })
                  : responsesHit === 4
                    ? JSON.stringify({
                        refinement: {
                          summary: "候选一需要重写。",
                          promptAdjustments: ["减少解释。"],
                          contractAdjustments: ["去掉解释性判断。"],
                          nextPrompt: "减少解释，回到动作推进。",
                        },
                      })
                    : responsesHit === 5
                      ? JSON.stringify({
                          freezeSummary: "候选一没有冻结价值。",
                          contractAdjustments: ["冻结前先消掉解释腔。"],
                          forbiddenPatterns: ["解释创作意图"],
                          positiveExamples: [],
                          inheritedRules: ["正文不得使用解释性判断。"],
                        })
                      : responsesHit === 6
                        ? JSON.stringify({
                            evaluation: {
                              verdict: "candidate",
                              summary: "候选二已经进入可用基底。",
                              scores: {
                                narrativeVoice: 8.5,
                                sentenceRhythm: 8.2,
                                dialogueTexture: 7.8,
                                informationDensity: 8.0,
                                emotionalTension: 8.0,
                                readability: 8.1,
                                requirementAlignment: 8.4,
                                forbiddenPatternRisk: 1.3,
                                overall: 8.4,
                              },
                              strengths: ["声音更冷感白描。"],
                              deviations: ["钩子还可再收。"],
                              forbiddenHits: [],
                              nextFocus: ["只留一个钩子。"],
                            },
                          })
                        : responsesHit === 7
                          ? JSON.stringify({
                              refinement: {
                                summary: "候选二保留当前基底，继续轻收。",
                                promptAdjustments: ["结尾只留一个钩子。"],
                                contractAdjustments: ["对白继续保持短句停顿。"],
                                nextPrompt: "保持冷感白描，只留一个钩子。",
                              },
                            })
                          : JSON.stringify({
                              freezeSummary: "候选二形成了更可持续的全书基底。",
                              contractAdjustments: ["冻结前继续强调对白短句与停顿。"],
                              forbiddenPatterns: ["解释创作意图"],
                              positiveExamples: ["沈砚把账册推回灯下，只问一句：谁动过这一页？"],
                              inheritedRules: ["正文必须延续当前冷感白描与短对白规则。"],
                            }),
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  clearAigcEnv()
  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const aigcDetector = await startPassingAigcDetector()
    aigcServer = aigcDetector.server
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writePassingAigcSettings(created.project.projectRoot, aigcDetector.port)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Multi Candidate Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "multi-candidate-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const generateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      loopIterations: 1,
      candidateCount: 2,
    }, { projectId: created.project.id })

    assert.equal(generateResponse.status, 200)
    assert.equal(generateResponse.payload.loopRun.candidateCount, 2)
    assert.equal(generateResponse.payload.loopIteration.candidates.length, 2)
    assert.match(generateResponse.payload.generatedCandidate.sample, /沈砚把账册推回灯下/)
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].candidateCount, 2)
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].candidateIndex, 2)
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].candidateScores.length, 2)
    assert.ok(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].winningReason.includes("候选 2"))
    assert.ok(receivedBodies.some((body) => String(body.input || "").includes("候选编号：1/2")))
    assert.ok(receivedBodies.some((body) => String(body.input || "").includes("候选编号：2/2")))
  } finally {
    restoreAigcEnv(previousAigcEnv)
    await new Promise((resolve) => server.close(resolve))
    if (aigcServer) {
      await new Promise((resolve) => aigcServer.close(resolve))
    }
  }
})

test("style evolution rejection feeds the next loop iteration with explicit user feedback", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-reject-loop-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  const receivedBodies = []
  let aigcServer = null
  let responseIndex = 0
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        responseIndex += 1
        const receivedBody = JSON.parse(rawBody)
        receivedBodies.push(receivedBody)
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: responseIndex === 1
            ? "雨从檐角落下来。沈砚看着缺页账本，停了太久，像是在解释自己的怀疑。"
            : "雨水沿着门槛往里爬。沈砚把账册合上，只问一句：谁动过这一页？门外的人没有回答，袖口却先缩了回去。",
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  clearAigcEnv()
  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const aigcDetector = await startPassingAigcDetector()
    aigcServer = aigcDetector.server
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writePassingAigcSettings(created.project.projectRoot, aigcDetector.port)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Reject Loop Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "reject-loop-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const generateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      loopIterations: 1,
    }, { projectId: created.project.id })
    assert.equal(generateResponse.status, 200)
    assert.equal(generateResponse.payload.generatedCandidate.version, 1)

    const rejectResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/reject", {
      projectId: created.project.id,
      version: 1,
      rejectionReason: "对白还是太像解释，动作压迫感不够。",
    }, { projectId: created.project.id })
    assert.equal(rejectResponse.status, 200)
    assert.equal(rejectResponse.payload.styleEvolution.contract.approval.status, "rejected")
    assert.equal(rejectResponse.payload.styleEvolution.contract.approval.rejectedVersion, 1)
    assert.match(rejectResponse.payload.styleEvolution.contract.approval.rejectionReason, /动作压迫感不够/)
    assert.equal(rejectResponse.payload.styleEvolution.contract.evolutionHistory[0].rejectionReason, "对白还是太像解释，动作压迫感不够。")

    const rerunResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      loopIterations: 1,
    }, { projectId: created.project.id })
    assert.equal(rerunResponse.status, 200)
    assert.equal(rerunResponse.payload.generatedCandidate.version, 2)
    const rerunCandidateRequest = receivedBodies.find((body) => {
      const input = String(body.input || "")
      return input.includes("用户刚刚拒绝上一轮")
    })
    assert.ok(rerunCandidateRequest)
    assert.match(String(rerunCandidateRequest.input), /用户刚刚拒绝上一轮/)
    assert.match(String(rerunCandidateRequest.input), /对白还是太像解释，动作压迫感不够/)
    assert.match(String(rerunCandidateRequest.input), /上一轮被用户退回/)
  } finally {
    restoreAigcEnv(previousAigcEnv)
    await new Promise((resolve) => server.close(resolve))
    if (aigcServer) {
      await new Promise((resolve) => aigcServer.close(resolve))
    }
  }
})

test("style evolution loop prefers structured llm critic output before heuristic fallback", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-critic-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousAigcEnv = snapshotAigcEnv()
  let responsesHit = 0
  let aigcServer = null
  const receivedBodies = []
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        responsesHit += 1
        const receivedBody = JSON.parse(rawBody)
        receivedBodies.push(receivedBody)
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: responsesHit === 1
            ? "雨声贴着窗纸往下滑。沈砚把账册推回灯下，没有多问，只看着那道被裁齐的缺口。"
            : responsesHit === 2
              ? JSON.stringify({
                  evaluation: {
                    verdict: "candidate",
                    summary: "结构化 evaluator 认为当前样段已有可用基底，但还需要继续收紧对白和压迫感。",
                    scores: {
                      narrativeVoice: 8.5,
                      sentenceRhythm: 8.2,
                      dialogueTexture: 6.9,
                      informationDensity: 7.8,
                      emotionalTension: 7.4,
                      readability: 8.1,
                      requirementAlignment: 8.3,
                      forbiddenPatternRisk: 2.2,
                      overall: 8.0,
                    },
                    strengths: ["声音已经偏冷感白描。"],
                    deviations: ["对白质感还可以再短更压迫。"],
                    forbiddenHits: [],
                    nextFocus: ["继续压短对白，让权力试探落在动作停顿上。"],
                  },
                })
              : responsesHit === 3
                ? JSON.stringify({
                    refinement: {
                      summary: "结构化 refiner 建议保留当前冷感白描，同时收紧对白和动作压迫。",
                      promptAdjustments: ["对白只保留必要试探，不解释背景。"],
                      contractAdjustments: ["对白规则里进一步强调短句与停顿。"],
                      nextPrompt: "继续保持冷感白描，但对白必须更短，动作压迫更明确。",
                    },
                  })
                : JSON.stringify({
                    freezeSummary: "freezer 认为当前版本已形成稳定冷感白描基底，但冻结前还需继续收紧对白规则。",
                    contractAdjustments: ["冻结前继续强调对白短句与停顿。"],
                    forbiddenPatterns: ["解释创作意图"],
                    positiveExamples: ["沈砚把账册推回灯下，没有多问。"],
                    inheritedRules: ["正文必须延续当前冷感白描和短对白规则。"],
                  })
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  clearAigcEnv()
  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const aigcDetector = await startPassingAigcDetector()
    aigcServer = aigcDetector.server
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writePassingAigcSettings(created.project.projectRoot, aigcDetector.port)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Critic Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "critic-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const generateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      loopIterations: 1,
    }, { projectId: created.project.id })
    assert.equal(generateResponse.status, 200)
    assert.equal(responsesHit, 4)
    assert.match(receivedBodies[1].instructions, /Evaluator|Critic|Style Evolution Engine/)
    assert.match(receivedBodies[2].instructions, /Prompt Refiner/)
    assert.match(receivedBodies[3].instructions, /Freeze Gate|Freezer/)
    assert.equal(generateResponse.payload.loopIteration.evaluation.source, "llm_critic")
    assert.equal(generateResponse.payload.loopIteration.refinement.source, "llm_critic")
    assert.match(generateResponse.payload.loopIteration.evaluation.summary, /结构化 evaluator|已有可用基底/)
    assert.match(generateResponse.payload.loopIteration.refinement.nextPrompt, /对白必须更短/)
    assert.ok(Array.isArray(generateResponse.payload.styleEvolution.contract.loop.convergenceEvidence))
    assert.ok(Number(generateResponse.payload.styleEvolution.contract.loop.tighteningCount || 0) >= 1)
    assert.ok(Array.isArray(generateResponse.payload.styleEvolution.contract.evolutionHistory[0].contractTightening))
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].freezerSource, "llm_critic")
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].evaluationSource, "llm_critic")
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].refinementSource, "llm_critic")
    assert.ok(
      generateResponse.payload.styleEvolution.loopRuntime.iterations[0].contractAdjustments.includes("冻结前继续强调对白短句与停顿。")
    )
  } finally {
    restoreAigcEnv(previousAigcEnv)
    await new Promise((resolve) => server.close(resolve))
    if (aigcServer) {
      await new Promise((resolve) => aigcServer.close(resolve))
    }
  }
})

test("style evolution keeps AIGC verification attached even when structured evaluator output is used", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-evolution-aigc-loop-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let llmHits = 0
  const llmServer = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        llmHits += 1
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: llmHits === 1
            ? "这是一段模板化表达，人物反应被概括，场景被抽象词覆盖，所有冲突都被命运安排直接说明。"
            : llmHits === 2
              ? JSON.stringify({
                  evaluation: {
                    verdict: "approve",
                    summary: "结构化 evaluator 误判当前样段已经可以确认。",
                    scores: {
                      narrativeVoice: 9.1,
                      sentenceRhythm: 9.0,
                      dialogueTexture: 8.9,
                      informationDensity: 9.0,
                      emotionalTension: 9.1,
                      readability: 9.0,
                      requirementAlignment: 9.2,
                      forbiddenPatternRisk: 0.5,
                      overall: 9.1,
                    },
                    strengths: ["至少仍是正文形态。"],
                    deviations: ["对白质感不足。"],
                    forbiddenHits: [],
                    nextFocus: ["继续收紧对白。"],
                  },
                })
              : llmHits === 3
                ? JSON.stringify({
                    refinement: {
                      summary: "结构化 refiner 建议继续收紧。",
                      promptAdjustments: ["对白更短。"],
                      contractAdjustments: ["对白规则继续压缩。"],
                      nextPrompt: "继续压短对白。",
                    },
                  })
                : JSON.stringify({
                    freezeSummary: "当前版本还不适合冻结。",
                    contractAdjustments: ["冻结前仍需去掉模板腔。"],
                    forbiddenPatterns: ["解释创作意图"],
                    positiveExamples: [],
                    inheritedRules: ["正文不得使用模板化表达。"],
                  }),
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  const aigcServer = http.createServer(async (request, response) => {
    const body = JSON.parse(await readBody(request))
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({
      aiProbability: String(body.text || "").includes("模板化") ? 0.93 : 0.21,
      label: String(body.text || "").includes("模板化") ? "疑似AI生成" : "人类写作",
    }))
  })

  const previousAigcEnv = snapshotAigcEnv()
  clearAigcEnv()

  try {
    await new Promise((resolve, reject) => {
      llmServer.listen(0, "127.0.0.1", resolve)
      llmServer.once("error", reject)
    })
    await new Promise((resolve, reject) => {
      aigcServer.listen(0, "127.0.0.1", resolve)
      aigcServer.once("error", reject)
    })
    const llmAddress = llmServer.address()
    const aigcAddress = aigcServer.address()
    assert.ok(llmAddress && typeof llmAddress === "object")
    assert.ok(aigcAddress && typeof aigcAddress === "object")

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writeAigcDetectorSettings(
      created.project.projectRoot,
      `http://127.0.0.1:${aigcAddress.port}/detect`,
    )

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "AIGC Loop Model",
      baseUrl: `http://127.0.0.1:${llmAddress.port}`,
      apiKey: "test-key",
      modelName: "aigc-loop-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const generateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      loopIterations: 1,
    }, { projectId: created.project.id })

    assert.equal(generateResponse.status, 409)
    assert.equal(generateResponse.payload.error, "style_candidates_all_blocked")
    assert.equal(generateResponse.payload.loopRun.stopReason, "style_candidates_all_blocked")
    assert.equal(generateResponse.payload.loopRun.iterations[0].winningReason, "本轮所有候选都未通过 Generation Verification Gate，未写入正式候选历史。")
    const blockedCandidate = generateResponse.payload.loopRun.iterations[0].candidates[0]
    assert.equal(blockedCandidate.evaluation.source, "llm_critic")
    assert.equal(blockedCandidate.evaluation.aigc.status, "blocked")
    assert.ok(blockedCandidate.evaluation.aigc.highRiskCount >= 1)
    assert.match(blockedCandidate.evaluation.aigc.reason, /segment|AIGC/i)
    assert.equal(blockedCandidate.verification.status, "blocked")
    assert.match(blockedCandidate.verification.summary, /Generation Verification Gate/)
    assert.equal(generateResponse.payload.styleEvolution.contract.evolutionHistory.length, 0)
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.verificationGate, "Generation Verification Gate")
    assert.equal(generateResponse.payload.styleEvolution.freezeLedger.verificationGate, "Generation Verification Gate")
    assert.equal(blockedCandidate.evaluation.verdict, "approve")
    assert.notEqual(generateResponse.payload.styleEvolution.contract.loop.status, "ready_for_approval")
    assert.ok(
      blockedCandidate.refinement.promptAdjustments.some((item) => /AI 腔|模板化|解释性总结/.test(item))
    )
    assert.ok(
      blockedCandidate.refinement.contractAdjustments.some((item) => /AI 腔|模板腔|解释腔/.test(item))
    )

    const approveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
      projectId: created.project.id,
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }, { projectId: created.project.id })
    assert.notEqual(approveResponse.status, 200)
    assert.ok([
      "style_candidate_not_found",
      "style_freeze_preview_requires_sample",
      "approveStyleEvolutionSample requires a sample or an existing history version",
    ].includes(approveResponse.payload.error))
  } finally {
    restoreAigcEnv(previousAigcEnv)
    await new Promise((resolve) => llmServer.close(resolve))
    await new Promise((resolve) => aigcServer.close(resolve))
  }
})

test("manual style candidate is blocked by high risk AIGC verification", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-manual-aigc-block-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let detectorHits = 0
  const aigcServer = http.createServer(async (request, response) => {
    detectorHits += 1
    const body = JSON.parse(await readBody(request))
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({
      aiProbability: String(body.text || "").includes("模板化") ? 0.94 : 0.89,
      label: "AI",
      confidence: 0.94,
    }))
  })
  const previousAigcEnv = snapshotAigcEnv()
  clearAigcEnv()

  try {
    await new Promise((resolve, reject) => {
      aigcServer.listen(0, "127.0.0.1", resolve)
      aigcServer.once("error", reject)
    })
    const aigcAddress = aigcServer.address()
    assert.ok(aigcAddress && typeof aigcAddress === "object")

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)

    await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/init", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
    }, { projectId: created.project.id })

    const candidateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/candidate", {
      projectId: created.project.id,
      prompt: "第二版样段",
      sample: "这是一段模板化表达，人物反应被概括，场景被抽象词覆盖，所有冲突都被命运安排直接说明。",
      review: "表面完整，但 AIGC 风险过高。",
    }, { projectId: created.project.id })

    assert.equal(candidateResponse.status, 200)
    assert.ok(detectorHits >= 1)
    assert.equal(candidateResponse.payload.styleEvolution.contract.verification.status, "blocked")
    assert.equal(candidateResponse.payload.styleEvolution.contract.evolutionHistory[0].verification.status, "blocked")
    assert.equal(candidateResponse.payload.styleEvolution.contract.evolutionHistory[0].readyForApproval, false)
    assert.equal(candidateResponse.payload.styleEvolution.contract.loop.verificationStatus, "blocked")

    const previewResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/freeze-preview", {
      projectId: created.project.id,
      version: 1,
    }, { projectId: created.project.id })
    assert.equal(previewResponse.status, 400)
    assert.equal(previewResponse.payload.error, "style_generation_verification_blocked")

    const approveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
      projectId: created.project.id,
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }, { projectId: created.project.id })
    assert.equal(approveResponse.status, 400)
    assert.equal(approveResponse.payload.error, "style_generation_verification_blocked")

    const unversionedApproveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
      projectId: created.project.id,
      sample: candidateResponse.payload.styleEvolution.contract.evolutionHistory[0].sample,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }, { projectId: created.project.id })
    assert.equal(unversionedApproveResponse.status, 400)
    assert.equal(unversionedApproveResponse.payload.error, "style_generation_verification_blocked")
  } finally {
    restoreAigcEnv(previousAigcEnv)
    await new Promise((resolve) => aigcServer.close(resolve))
  }
})

test("previous segment tail compaction removes repeated paragraphs", async () => {
  const { compactPreviousSegmentTail } = await loadCore()
  const repeated = [
    "雨声压住账房的窗纸，沈砚把缺页账本推到灯下。",
    "",
    "老周站在门槛外，没有进来。",
    "",
    "雨声压住账房的窗纸，沈砚把缺页账本推到灯下。",
    "",
    "老周站在门槛外，没有进来。",
    "",
    "旧印章扣在桌面，门外的人都听见那一声闷响。",
  ].join("\n")

  const compacted = compactPreviousSegmentTail(repeated, 260)

  assert.equal((compacted.match(/雨声压住账房/g) || []).length, 1)
  assert.equal((compacted.match(/老周站在门槛外/g) || []).length, 1)
  assert.match(compacted, /旧印章扣在桌面/)
  assert.ok(compacted.length <= 260)
})

test("chapter production is blocked until the writing style is approved", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-style-gated-production-"))
  const {
    createDetailedChapterBlueprint,
    initAutonomousProject,
    initializeStyleEvolution,
    runChapterProductionPipeline,
  } = await loadCore()
  const state = await initAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  await initializeStyleEvolution(tempDir, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })

  const workspaceDir = path.join(tempDir, ".ai-novel")
  const paths = {
    workspaceDir,
    plansDir: path.join(workspaceDir, "plans"),
    reportsDir: path.join(workspaceDir, "reports"),
    chaptersDir: path.join(workspaceDir, "chapters"),
    memoryDir: path.join(workspaceDir, "memory"),
    styleDir: path.join(workspaceDir, "style"),
    styleProfilePath: path.join(workspaceDir, "style", "profile.md"),
    styleRulebookPath: path.join(workspaceDir, "style", "rulebook.md"),
    styleReferencesPath: path.join(workspaceDir, "style", "references.md"),
    styleAntiPatternsPath: path.join(workspaceDir, "style", "anti-patterns.md"),
    consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
    protagonistPath: path.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
    relationsPath: path.join(workspaceDir, "memory", "characters", "relations.md"),
    characterEvolutionPath: path.join(workspaceDir, "memory", "characters", "evolution.md"),
    characterDossiersPath: path.join(workspaceDir, "memory", "characters", "dossiers.json"),
    masterOutlinePath: path.join(workspaceDir, "plans", "master-outline.md"),
    chapterBlueprintsDir: path.join(workspaceDir, "plans", "chapter-blueprints"),
  }
  await fs.mkdir(paths.chapterBlueprintsDir, { recursive: true })
  const task = {
    ...state.plan.chapterTasks[0],
    title: "第一章 缺页账本",
    targetWords: 120,
  }
  const resources = {
    styleGuide: "",
    chapterPlannerGuide: "",
    writerGuide: "",
    editorGuide: "",
    styleControllerGuide: "",
    consistencyGuide: "",
    vocabularyIndex: "",
    vocabularySamples: [],
    examples: [],
  }
  const blueprint = createDetailedChapterBlueprint(state, task, {
    consensus: "审雨官制度记录每一场雨，缺页账本是关键线索。",
    protagonist: "沈砚是审雨官，习惯先看物件再问人。",
    style: "",
  }, resources)
  await fs.writeFile(path.join(paths.chapterBlueprintsDir, "chapter-001.md"), `${blueprint}\n`)

  const progressEvents = []
  await assert.rejects(
    () => runChapterProductionPipeline(tempDir, paths, state, task, {
      writingMode: "fast",
      bypassAigcGate: true,
      onProgress: (event) => progressEvents.push(event),
    }),
    /写法尚未获得用户确认|style/i,
  )
  assert.ok(progressEvents.some((event) => event.step === "production_readiness_blocked" && event.status === "blocked"))
})

test("chapter drafting sends the approved style contract to the configured text model", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-approved-style-drafting-"))
  const {
    acceptStyleEvolutionCandidate,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    createDetailedChapterBlueprint,
    initAutonomousProject,
    initializeStyleEvolution,
    runChapterProductionPipeline,
    withFactoryDb,
  } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const previousWritingMode = process.env.AI_NOVEL_WRITING_MODE
  const receivedBodies = []
  const progressEvents = []
  const paragraph = [
    "雨声压住账房的窗纸，沈砚把缺页账本推到灯下，指腹停在那道齐整的纸边。",
    "老周站在门槛外，没有进来，只把湿袖往身后藏了半寸。",
    "沈砚没有解释，他选择先合上账册，把旧印章扣在桌面，让门外的人都听见那一声闷响。",
    "这一声之后，账房里的人都知道缺页已经成了代价，下一章必须处理门外脚步、旧印章和那本缺页账本。",
  ].join("")
  const longDraft = Array.from({ length: 8 }, () => paragraph).join("\n\n")
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        const receivedBody = JSON.parse(rawBody)
        receivedBodies.push(receivedBody)
        const outputText = [
          "# 第一章 缺页账本",
          "",
          "## Draft Body",
          "",
          longDraft,
          "",
          "## Drafting Metadata",
          "- Chapter: 1",
        ].join("\n")
        if (receivedBody.stream) {
          response.writeHead(200, { "content-type": "text/event-stream" })
          response.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: outputText })}\n\n`)
          response.write("data: [DONE]\n\n")
          response.end()
        } else {
          response.writeHead(200, { "content-type": "application/json" })
          response.end(JSON.stringify({ output_text: outputText }))
        }
        return
      }
      response.writeHead(404).end()
    })
  })

  delete process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_WRITING_MODE = "fast"

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    await withFactoryDb(tempDir, async (db) => {
      db.addLlmConfig({
        name: "Approved Style Draft Test",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiKey: "test-key",
        modelName: "draft-model",
        apiMode: "responses",
        timeoutMs: 2000,
        isActive: true,
      })
    })

    const state = await initAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    await initializeStyleEvolution(tempDir, {
      projectTitle: "雨账",
      idea: "一名审雨官发现降雨记录被篡改",
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
    })
    await appendStyleEvolutionCandidate(tempDir, {
      prompt: "章节写作测试冻结样段",
      sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
      review: "测试夹具：已通过写法验证。",
      evaluation: createVerifiedStyleEvaluation(),
      refinement: createStyleRefinementForTest(),
      freezer: readyFreezerFixture(),
    })
    await acceptStyleEvolutionCandidate(tempDir, {
      version: 1,
      acceptedAt: "2026-06-25T00:00:00.000Z",
    })
    await approveStyleEvolutionSample(tempDir, {
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
      styleContract: createCompleteStyleContractForTest({
        voice: "模型提炼：克制冷感、白描推进、以物件和动作压住悬疑。",
	        sentenceRhythm: "短句为主，少量中句承接动作后果。",
	        dialogueRules: ["对白短，带压力，不解释背景。"],
	        descriptionRules: ["先物件、声音、身体反应，再给判断。"],
	        emotionRules: ["情绪只能通过手部停顿和物件选择外化。"],
	        pacingRules: ["每个场景先压入现场压力，再释放半个线索。"],
	        povRules: ["只贴住沈砚的感知，不越权解释老周心里。"],
	        openingRules: ["开场必须落在账房现场压力，不写泛化背景。"],
	        endingHookRules: ["结尾把旧印章和门外脚步交给下一章。"],
	        allowedDevices: ["手部停顿", "旧印章声响", "半句对白"],
	        forbiddenPatterns: ["解释创作意图", "总结式升华", "同质化对白"],
	        positiveExamples: ["沈砚合上账册，只问了一句：谁动过这一页？"],
	        negativeExamples: ["他心里非常震惊，于是开始解释来龙去脉。"],
	      }),
	    })

    const workspaceDir = path.join(tempDir, ".ai-novel")
    const paths = {
      workspaceDir,
      plansDir: path.join(workspaceDir, "plans"),
      reportsDir: path.join(workspaceDir, "reports"),
      chaptersDir: path.join(workspaceDir, "chapters"),
      memoryDir: path.join(workspaceDir, "memory"),
      styleDir: path.join(workspaceDir, "style"),
      styleProfilePath: path.join(workspaceDir, "style", "profile.md"),
      styleRulebookPath: path.join(workspaceDir, "style", "rulebook.md"),
      styleReferencesPath: path.join(workspaceDir, "style", "references.md"),
      styleAntiPatternsPath: path.join(workspaceDir, "style", "anti-patterns.md"),
      consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
      protagonistPath: path.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
      relationsPath: path.join(workspaceDir, "memory", "characters", "relations.md"),
      characterEvolutionPath: path.join(workspaceDir, "memory", "characters", "evolution.md"),
      characterDossiersPath: path.join(workspaceDir, "memory", "characters", "dossiers.json"),
      masterOutlinePath: path.join(workspaceDir, "plans", "master-outline.md"),
      chapterBlueprintsDir: path.join(workspaceDir, "plans", "chapter-blueprints"),
    }
    await fs.mkdir(paths.chapterBlueprintsDir, { recursive: true })
    const task = {
      ...state.plan.chapterTasks[0],
      title: "第一章 缺页账本",
      targetWords: 120,
    }
    const resources = {
      styleGuide: "",
      chapterPlannerGuide: "",
      writerGuide: "",
      editorGuide: "",
      styleControllerGuide: "",
      consistencyGuide: "",
      vocabularyIndex: "",
      vocabularySamples: [],
      examples: [],
    }
    const blueprint = createDetailedChapterBlueprint(state, task, {
      consensus: "审雨官制度记录每一场雨，缺页账本是关键线索。",
      protagonist: "沈砚是审雨官，习惯先看物件再问人。",
      style: "",
    }, resources)
    await fs.writeFile(path.join(paths.chapterBlueprintsDir, "chapter-001.md"), `${blueprint}\n`)

    await runChapterProductionPipeline(tempDir, paths, state, task, {
      factoryRootDir: tempDir,
      writingMode: "fast",
      bypassAigcGate: true,
      maxRevisionAttempts: 0,
      onProgress: (event) => progressEvents.push(event),
    })

    const contextPackagePath = path.join(workspaceDir, "checkpoints", "chapter-contexts", "chapter-001-context.md")
    const contextPackage = await fs.readFile(contextPackagePath, "utf8")
    assert.match(contextPackage, /# Chapter Context Package/)
    assert.match(contextPackage, /Segmentation source: scene_card/)
    assert.match(contextPackage, /## Prompt Budget/)
    assert.match(contextPackage, /activeWorldSlice/)
    assert.match(contextPackage, /## Active World Slice/)
    assert.match(contextPackage, /## Segment Plan/)
    assert.match(contextPackage, /## Segment Composition Plans/)
    assert.match(contextPackage, /Current|Scene|Segment 1\/4|Segment 1\/5/)
    const activeWorldSlicePath = path.join(workspaceDir, "checkpoints", "active-world-slices", "chapter-001-world-slice.md")
    const activeWorldSlice = await fs.readFile(activeWorldSlicePath, "utf8")
    assert.match(activeWorldSlice, /# Active World Slice/)
    assert.match(activeWorldSlice, /缺页账本|审雨官|Chapter|Chapter Causality Matrix/)
    assert.ok(progressEvents.some((event) => event.step === "chapter_context_package_saved"))
    const segmentDir = path.join(workspaceDir, "checkpoints", "chapter-segments", "chapter-001", "segment-01")
    const segmentArtifactPath = path.join(segmentDir, "segment-01.md")
    const segmentArtifact = await fs.readFile(segmentArtifactPath, "utf8")
    assert.match(segmentArtifact, /# Chapter 1 Segment 1\/4|# Chapter 1 Segment 1\/5/)
    assert.match(segmentArtifact, /## Composition Plan/)
    assert.match(segmentArtifact, /### Dialogue/)
    assert.match(segmentArtifact, /### Assembly Rules/)
    assert.match(segmentArtifact, /## Generated Body/)
    assert.match(segmentArtifact, /沈砚/)
    const dialogueBrief = await fs.readFile(path.join(segmentDir, "brief-dialogue.md"), "utf8")
    assert.match(dialogueBrief, /# Dialogue Brief/)
    assert.match(dialogueBrief, /Kind: dialogue/)
    assert.match(dialogueBrief, /Suggested prompt budget: 1400 chars/)
    assert.match(dialogueBrief, /## LLM Execution Prompt/)
    assert.match(dialogueBrief, /对白必须短、有压力/)
    assert.match(dialogueBrief, /生成本片段可用的短对白素材/)
    const assemblyBrief = await fs.readFile(path.join(segmentDir, "brief-assembly.md"), "utf8")
    assert.match(assemblyBrief, /# Assembly Brief/)
    assert.match(assemblyBrief, /Kind: assembly/)
    assert.match(assemblyBrief, /Suggested prompt budget: 1800 chars/)
    assert.match(assemblyBrief, /根据情节、旁白、对白、动作和连续性素材组装/)
    assert.match(assemblyBrief, /## Assembled Segment Body/)
    assert.match(assemblyBrief, /沈砚/)
    const dialogueMaterial = await fs.readFile(path.join(segmentDir, "material-dialogue.md"), "utf8")
    assert.match(dialogueMaterial, /# Dialogue Material/)
    assert.match(dialogueMaterial, /Kind: dialogue/)
    assert.match(dialogueMaterial, /Material mode: deterministic-placeholder/)
    assert.match(dialogueMaterial, /future per-part LLM execution/)
    const assemblyMaterial = await fs.readFile(path.join(segmentDir, "material-assembly.md"), "utf8")
    assert.match(assemblyMaterial, /# Assembly Material/)
    assert.match(assemblyMaterial, /当前组装结果直接引用已生成片段正文/)
    assert.match(assemblyMaterial, /沈砚/)
    const segmentManifest = JSON.parse(await fs.readFile(path.join(segmentDir, "segment-manifest.json"), "utf8"))
    assert.equal(segmentManifest.mode, "deterministic-placeholder")
    assert.equal(segmentManifest.segment.index, 1)
    assert.match(segmentManifest.files.body, /chapter-segments\/chapter-001\/segment-01\/segment-01\.md/)
    assert.match(segmentManifest.files.byKind.dialogue.brief, /brief-dialogue\.md/)
    assert.match(segmentManifest.files.byKind.dialogue.material, /material-dialogue\.md/)
    assert.equal(segmentManifest.execution.nextReadyStep, "replace_one_material_role_with_llm_call")
    assert.ok(segmentManifest.execution.recommendedFirstRoles.includes("dialogue"))
    assert.ok(progressEvents.some((event) => event.step === "draft_segment_artifact_saved_1"))
    assert.ok(progressEvents.some((event) => String(event.preview || "").includes("briefs=6")))
    assert.ok(progressEvents.some((event) => String(event.preview || "").includes("materials=6")))

    assert.ok(receivedBodies.length >= 1)
    const firstRequestText = JSON.stringify(receivedBodies[0])
    assert.ok(String(receivedBodies[0].instructions || "").length < 9_500)
    assert.match(firstRequestText, /User Approved Writing Style Contract/)
	    assert.match(firstRequestText, /模型提炼：克制冷感/)
	    assert.match(firstRequestText, /Emotion rule: 情绪只能通过手部停顿/)
	    assert.match(firstRequestText, /Pacing rule: 每个场景先压入现场压力/)
	    assert.match(firstRequestText, /POV rule: 只贴住沈砚的感知/)
	    assert.match(firstRequestText, /Opening rule: 开场必须落在账房现场压力/)
	    assert.match(firstRequestText, /Ending hook rule: 结尾把旧印章和门外脚步/)
	    assert.match(firstRequestText, /Allowed devices: 手部停顿、旧印章声响、半句对白/)
	    assert.match(firstRequestText, /Negative example to avoid: 他心里非常震惊/)
	    assert.match(firstRequestText, /Approved sample excerpt: 雨线挂在门槛外/)
	    assert.match(firstRequestText, /同质化对白/)
	    assert.match(firstRequestText, /沈砚合上账册/)
    const styleRulebook = await fs.readFile(paths.styleRulebookPath, "utf8")
    const styleReferences = await fs.readFile(paths.styleReferencesPath, "utf8")
    const styleAntiPatterns = await fs.readFile(paths.styleAntiPatternsPath, "utf8")
    assert.match(styleRulebook, /# Style Rulebook/)
    assert.match(styleRulebook, /## Dialogue Rules/)
    assert.match(styleRulebook, /## Retry Policy/)
    assert.match(styleReferences, /# Style References/)
    assert.match(styleReferences, /## Positive Examples/)
    assert.match(styleReferences, /沈砚合上账册/)
    assert.match(styleAntiPatterns, /# Style Anti-Patterns/)
    assert.match(styleAntiPatterns, /## Forbidden Patterns/)
    assert.match(styleAntiPatterns, /同质化对白/)
    const qualityReport = await fs.readFile(path.join(paths.reportsDir, "chapter-001-quality.md"), "utf8")
    assert.match(qualityReport, /## Style Conformance Drift/)
    assert.match(qualityReport, /Conformance score: \d+(?:\.\d+)?\/10/)
    assert.match(qualityReport, /Drift score: \d+(?:\.\d+)?\/10/)
    const chapterManifest = JSON.parse(await fs.readFile(path.join(paths.chaptersDir, "chapter-001.versions.json"), "utf8"))
    assert.equal(chapterManifest.aigcDetection.status, "skipped")
    assert.equal(chapterManifest.locked, false)
    assert.equal(chapterManifest.status, "needs_review")
    assert.equal(chapterManifest.versions.find((entry) => entry.id === "final").status, "needs_revision")
	    assert.ok(chapterManifest.styleConformanceDrift)
	    assert.equal(chapterManifest.chapterInheritanceAdapter.name, "Chapter Inheritance Adapter")
	    assert.equal(chapterManifest.chapterInheritanceAdapter.status, "ready")
	    assert.equal(chapterManifest.chapterInheritanceAdapter.freezerVerdict, "ready")
	    assert.ok(chapterManifest.chapterInheritanceAdapter.styleContractFields.includes("emotionRules"))
	    assert.equal(chapterManifest.styleInheritanceVerification.chapterInheritanceAdapter.status, "ready")
	    assert.equal(chapterManifest.styleInheritanceVerification.freezerVerdict, "ready")
	    assert.equal(typeof chapterManifest.styleConformanceDrift.conformanceScore, "number")
    assert.equal(typeof chapterManifest.styleConformanceDrift.driftScore, "number")
    assert.ok(chapterManifest.styleConformanceDrift.evidence.length > 0)
    assert.ok(chapterManifest.styleConformanceDrift.metrics.contractRuleCount > 0)
    assert.equal(chapterManifest.styleConformanceDrift.metrics.narrativeStyleStatus, "eligible")
    assert.ok(progressEvents.some((event) => event.step === "approved_style_assets_synced"))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
    if (previousWritingMode === undefined) {
      delete process.env.AI_NOVEL_WRITING_MODE
    } else {
      process.env.AI_NOVEL_WRITING_MODE = previousWritingMode
    }
  }
})

test("chapter drafting can route selected segment materials through optional LLM subcalls", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-material-subcalls-"))
  const {
    createDetailedChapterBlueprint,
    initAutonomousProject,
    runChapterProductionPipeline,
    withFactoryDb,
  } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const previousWritingMode = process.env.AI_NOVEL_WRITING_MODE
  const receivedBodies = []
  const paragraph = [
    "雨声压住账房的窗纸，沈砚把缺页账本推到灯下，指腹停在那道齐整的纸边。",
    "老周站在门槛外，没有进来，只把湿袖往身后藏了半寸。",
    "沈砚没有解释，他选择先合上账册，把旧印章扣在桌面。",
  ].join("")
  const longDraft = Array.from({ length: 8 }, () => paragraph).join("\n\n")
  const plotOutput = "1. 沈砚发现缺页边缘没有雨痕。\n2. 老周回避账册来源。\n3. 旧印章压出第一枚主线线索。"
  const dialogueOutput = "沈砚：谁动过这一页？\n老周：小人只管收账，不管缺页。"
  const narrationOutput = "雨沿窗棂往下走，账页缺口干净得像被人提前量过。"
  const characterActionOutput = "沈砚把旧印章扣住缺页边缘，老周下意识把湿袖往身后藏。"
  const continuityOutput = "must-hit: 主角唯一身份、核心缺口\nmust-not-write: 幕后主使身份\nhandoff-state: 缺页与旧印章绑定。"
  const assemblyOutput = "沈砚把缺页账本推到灯下，旧印章压住纸边。他问：谁动过这一页？雨声里，老周的湿袖往身后缩。"
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url !== "/responses") {
        response.writeHead(404).end()
        return
      }
      const receivedBody = JSON.parse(rawBody)
      receivedBodies.push(receivedBody)
      const requestText = JSON.stringify(receivedBody)
      const outputText = /请生成当前片段的情节拍点素材/u.test(requestText)
        ? plotOutput
        : /请生成当前片段的对白素材/u.test(requestText)
        ? dialogueOutput
        : /请生成当前片段的旁白素材/u.test(requestText)
          ? narrationOutput
        : /请生成当前片段的人物行动素材/u.test(requestText)
          ? characterActionOutput
        : /请生成当前片段的连续性检查素材/u.test(requestText)
          ? continuityOutput
        : /请根据分项素材组装当前片段候选正文/u.test(requestText)
          ? assemblyOutput
        : [
            "# 第一章 缺页账本",
            "",
            "## Draft Body",
            "",
            longDraft,
            "",
            "## Drafting Metadata",
            "- Chapter: 1",
          ].join("\n")
      if (receivedBody.stream) {
        response.writeHead(200, { "content-type": "text/event-stream" })
        response.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: outputText })}\n\n`)
        response.write("data: [DONE]\n\n")
        response.end()
      } else {
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ output_text: outputText }))
      }
    })
  })

  delete process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_WRITING_MODE = "fast"

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    await withFactoryDb(tempDir, async (db) => {
      db.addLlmConfig({
        name: "Dialogue Subcall Test",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiKey: "test-key",
        modelName: "draft-model",
        apiMode: "responses",
        timeoutMs: 2000,
        isActive: true,
      })
    })

    const state = await initAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    await approveProductionReadinessForTest(tempDir, null, {
      projectTitle: "雨账",
      idea: "一名审雨官发现降雨记录被篡改",
    })

    const workspaceDir = path.join(tempDir, ".ai-novel")
    const paths = {
      workspaceDir,
      plansDir: path.join(workspaceDir, "plans"),
      reportsDir: path.join(workspaceDir, "reports"),
      chaptersDir: path.join(workspaceDir, "chapters"),
      memoryDir: path.join(workspaceDir, "memory"),
      styleDir: path.join(workspaceDir, "style"),
      styleProfilePath: path.join(workspaceDir, "style", "profile.md"),
      styleRulebookPath: path.join(workspaceDir, "style", "rulebook.md"),
      styleReferencesPath: path.join(workspaceDir, "style", "references.md"),
      styleAntiPatternsPath: path.join(workspaceDir, "style", "anti-patterns.md"),
      consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
      protagonistPath: path.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
      relationsPath: path.join(workspaceDir, "memory", "characters", "relations.md"),
      characterEvolutionPath: path.join(workspaceDir, "memory", "characters", "evolution.md"),
      characterDossiersPath: path.join(workspaceDir, "memory", "characters", "dossiers.json"),
      masterOutlinePath: path.join(workspaceDir, "plans", "master-outline.md"),
      chapterBlueprintsDir: path.join(workspaceDir, "plans", "chapter-blueprints"),
    }
    await fs.mkdir(paths.chapterBlueprintsDir, { recursive: true })
    const task = {
      ...state.plan.chapterTasks[0],
      title: "第一章 缺页账本",
      targetWords: 120,
    }
    const resources = {
      styleGuide: "",
      chapterPlannerGuide: "",
      writerGuide: "",
      editorGuide: "",
      styleControllerGuide: "",
      consistencyGuide: "",
      vocabularyIndex: "",
      vocabularySamples: [],
      examples: [],
    }
    const blueprint = createDetailedChapterBlueprint(state, task, {
      consensus: "审雨官制度记录每一场雨，缺页账本是关键线索。",
      protagonist: "沈砚是审雨官，习惯先看物件再问人。",
      style: "",
    }, resources)
    await fs.writeFile(path.join(paths.chapterBlueprintsDir, "chapter-001.md"), `${blueprint}\n`)

    await runChapterProductionPipeline(tempDir, paths, state, task, {
      factoryRootDir: tempDir,
      writingMode: "fast",
      bypassAigcGate: true,
      maxRevisionAttempts: 0,
      draftSubcallRoles: ["plot", "dialogue", "narration", "character_action", "continuity", "assembly"],
    })

    const segmentDir = path.join(workspaceDir, "checkpoints", "chapter-segments", "chapter-001", "segment-01")
    const plotMaterial = await fs.readFile(path.join(segmentDir, "material-plot.md"), "utf8")
    const dialogueMaterial = await fs.readFile(path.join(segmentDir, "material-dialogue.md"), "utf8")
    const narrationMaterial = await fs.readFile(path.join(segmentDir, "material-narration.md"), "utf8")
    const characterActionMaterial = await fs.readFile(path.join(segmentDir, "material-character-action.md"), "utf8")
    const continuityMaterial = await fs.readFile(path.join(segmentDir, "material-continuity.md"), "utf8")
    const assemblyMaterial = await fs.readFile(path.join(segmentDir, "material-assembly.md"), "utf8")
    assert.match(plotMaterial, /Material mode: llm-subcall/)
    assert.match(plotMaterial, /第一枚主线线索/)
    assert.match(dialogueMaterial, /Material mode: llm-subcall/)
    assert.match(dialogueMaterial, /谁动过这一页/)
    assert.match(narrationMaterial, /Material mode: llm-subcall/)
    assert.match(narrationMaterial, /账页缺口干净/)
    assert.match(characterActionMaterial, /Material mode: llm-subcall/)
    assert.match(characterActionMaterial, /湿袖往身后藏/)
    assert.match(continuityMaterial, /Material mode: llm-subcall/)
    assert.match(continuityMaterial, /幕后主使身份/)
    assert.match(assemblyMaterial, /Material mode: llm-subcall/)
    assert.match(assemblyMaterial, /旧印章压住纸边/)
    const segmentArtifact = await fs.readFile(path.join(segmentDir, "segment-01.md"), "utf8")
    const generatedBodySection = segmentArtifact.split("## Generated Body").at(1)?.trim() || ""
    assert.match(segmentArtifact, /## Generated Body/)
    assert.match(generatedBodySection, /旧印章压住纸边/)
    assert.doesNotMatch(generatedBodySection, /雨声压住账房的窗纸/u)
    const chapterDraft = await fs.readFile(path.join(paths.chaptersDir, "chapter-001.draft.md"), "utf8")
    assert.match(chapterDraft, /旧印章压住纸边/)
    const segmentManifest = JSON.parse(await fs.readFile(path.join(segmentDir, "segment-manifest.json"), "utf8"))
    assert.equal(segmentManifest.mode, "mixed")
    assert.equal(segmentManifest.execution.assembly.requested, true)
    assert.equal(segmentManifest.execution.assembly.decision, "used")
    assert.match(segmentManifest.execution.assembly.reason, /passed fiction-body guard/)
    assert.equal(segmentManifest.execution.assembly.finalChars, assemblyOutput.length)
    const plotMaterialEntry = segmentManifest.files.subArtifacts.find((artifact) =>
      artifact.kind === "plot" && artifact.role === "material")
    const dialogueMaterialEntry = segmentManifest.files.subArtifacts.find((artifact) =>
      artifact.kind === "dialogue" && artifact.role === "material")
    const narrationMaterialEntry = segmentManifest.files.subArtifacts.find((artifact) =>
      artifact.kind === "narration" && artifact.role === "material")
    const characterActionMaterialEntry = segmentManifest.files.subArtifacts.find((artifact) =>
      artifact.kind === "character_action" && artifact.role === "material")
    const continuityMaterialEntry = segmentManifest.files.subArtifacts.find((artifact) =>
      artifact.kind === "continuity" && artifact.role === "material")
    const assemblyMaterialEntry = segmentManifest.files.subArtifacts.find((artifact) =>
      artifact.kind === "assembly" && artifact.role === "material")
    assert.equal(plotMaterialEntry.mode, "llm-subcall")
    assert.equal(dialogueMaterialEntry.mode, "llm-subcall")
    assert.equal(narrationMaterialEntry.mode, "llm-subcall")
    assert.equal(characterActionMaterialEntry.mode, "llm-subcall")
    assert.equal(continuityMaterialEntry.mode, "llm-subcall")
    assert.equal(assemblyMaterialEntry.mode, "llm-subcall")
    assert.ok(receivedBodies.some((body) => /Plot Turn|情节拍点素材/u.test(JSON.stringify(body))))
    assert.ok(receivedBodies.some((body) => /Dialogue|对白素材/u.test(JSON.stringify(body))))
    assert.ok(receivedBodies.some((body) => /Narration|旁白素材/u.test(JSON.stringify(body))))
    assert.ok(receivedBodies.some((body) => /Character Action|人物行动素材/u.test(JSON.stringify(body))))
    assert.ok(receivedBodies.some((body) => /Continuity|连续性检查素材/u.test(JSON.stringify(body))))
    assert.ok(receivedBodies.some((body) => /Assembly|组装当前片段候选正文/u.test(JSON.stringify(body))))
    const assemblyRequest = receivedBodies.find((body) => /请根据分项素材组装当前片段候选正文/u.test(JSON.stringify(body)))
    assert.ok(assemblyRequest)
    const assemblyRequestText = JSON.stringify(assemblyRequest)
    assert.equal((assemblyRequestText.match(/雨声压住账房的窗纸/g) || []).length, 1)
    assert.equal((assemblyRequestText.match(/老周站在门槛外/g) || []).length, 1)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
    if (previousWritingMode === undefined) {
      delete process.env.AI_NOVEL_WRITING_MODE
    } else {
      process.env.AI_NOVEL_WRITING_MODE = previousWritingMode
    }
  }
})

test("chapter drafting falls back to author segment when assembly subcall is unusable", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-assembly-fallback-"))
  const {
    createDetailedChapterBlueprint,
    initAutonomousProject,
    runChapterProductionPipeline,
    withFactoryDb,
  } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const previousWritingMode = process.env.AI_NOVEL_WRITING_MODE
  const receivedBodies = []
  const paragraph = [
    "雨声压住账房的窗纸，沈砚把缺页账本推到灯下，指腹停在那道齐整的纸边。",
    "老周站在门槛外，没有进来，只把湿袖往身后藏了半寸。",
    "沈砚没有解释，他选择先合上账册，把旧印章扣在桌面。",
  ].join("")
  const longDraft = Array.from({ length: 8 }, () => paragraph).join("\n\n")
  const unusableAssemblyOutput = "以下是组装候选正文：\n- must-hit: 主角唯一身份\n- must-not-write: 幕后主使身份"
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url !== "/responses") {
        response.writeHead(404).end()
        return
      }
      const receivedBody = JSON.parse(rawBody)
      receivedBodies.push(receivedBody)
      const requestText = JSON.stringify(receivedBody)
      const outputText = /请根据分项素材组装当前片段候选正文/u.test(requestText)
        ? unusableAssemblyOutput
        : [
            "# 第一章 缺页账本",
            "",
            "## Draft Body",
            "",
            longDraft,
            "",
            "## Drafting Metadata",
            "- Chapter: 1",
          ].join("\n")
      if (receivedBody.stream) {
        response.writeHead(200, { "content-type": "text/event-stream" })
        response.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: outputText })}\n\n`)
        response.write("data: [DONE]\n\n")
        response.end()
      } else {
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ output_text: outputText }))
      }
    })
  })

  delete process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_WRITING_MODE = "fast"

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    await withFactoryDb(tempDir, async (db) => {
      db.addLlmConfig({
        name: "Assembly Fallback Test",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiKey: "test-key",
        modelName: "draft-model",
        apiMode: "responses",
        timeoutMs: 2000,
        isActive: true,
      })
    })

    const state = await initAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    await approveProductionReadinessForTest(tempDir, null, {
      projectTitle: "雨账",
      idea: "一名审雨官发现降雨记录被篡改",
    })

    const workspaceDir = path.join(tempDir, ".ai-novel")
    const paths = {
      workspaceDir,
      plansDir: path.join(workspaceDir, "plans"),
      reportsDir: path.join(workspaceDir, "reports"),
      chaptersDir: path.join(workspaceDir, "chapters"),
      memoryDir: path.join(workspaceDir, "memory"),
      styleDir: path.join(workspaceDir, "style"),
      styleProfilePath: path.join(workspaceDir, "style", "profile.md"),
      styleRulebookPath: path.join(workspaceDir, "style", "rulebook.md"),
      styleReferencesPath: path.join(workspaceDir, "style", "references.md"),
      styleAntiPatternsPath: path.join(workspaceDir, "style", "anti-patterns.md"),
      consensusPath: path.join(workspaceDir, "prompts", "global-consensus.md"),
      protagonistPath: path.join(workspaceDir, "memory", "characters", "core", "protagonist.md"),
      relationsPath: path.join(workspaceDir, "memory", "characters", "relations.md"),
      characterEvolutionPath: path.join(workspaceDir, "memory", "characters", "evolution.md"),
      characterDossiersPath: path.join(workspaceDir, "memory", "characters", "dossiers.json"),
      masterOutlinePath: path.join(workspaceDir, "plans", "master-outline.md"),
      chapterBlueprintsDir: path.join(workspaceDir, "plans", "chapter-blueprints"),
    }
    await fs.mkdir(paths.chapterBlueprintsDir, { recursive: true })
    const task = {
      ...state.plan.chapterTasks[0],
      title: "第一章 缺页账本",
      targetWords: 120,
    }
    const resources = {
      styleGuide: "",
      chapterPlannerGuide: "",
      writerGuide: "",
      editorGuide: "",
      styleControllerGuide: "",
      consistencyGuide: "",
      vocabularyIndex: "",
      vocabularySamples: [],
      examples: [],
    }
    const blueprint = createDetailedChapterBlueprint(state, task, {
      consensus: "审雨官制度记录每一场雨，缺页账本是关键线索。",
      protagonist: "沈砚是审雨官，习惯先看物件再问人。",
      style: "",
    }, resources)
    await fs.writeFile(path.join(paths.chapterBlueprintsDir, "chapter-001.md"), `${blueprint}\n`)

    await runChapterProductionPipeline(tempDir, paths, state, task, {
      factoryRootDir: tempDir,
      writingMode: "fast",
      bypassAigcGate: true,
      maxRevisionAttempts: 0,
      draftSubcallRoles: ["assembly"],
    })

    const segmentDir = path.join(workspaceDir, "checkpoints", "chapter-segments", "chapter-001", "segment-01")
    const assemblyMaterial = await fs.readFile(path.join(segmentDir, "material-assembly.md"), "utf8")
    assert.match(assemblyMaterial, /Material mode: llm-subcall/)
    assert.match(assemblyMaterial, /以下是组装候选正文/)
    const segmentArtifact = await fs.readFile(path.join(segmentDir, "segment-01.md"), "utf8")
    const generatedBodySection = segmentArtifact.split("## Generated Body").at(1)?.trim() || ""
    assert.match(generatedBodySection, /雨声压住账房的窗纸/u)
    assert.doesNotMatch(generatedBodySection, /以下是组装候选正文/u)
    assert.doesNotMatch(generatedBodySection, /must-not-write/u)
    const chapterDraft = await fs.readFile(path.join(paths.chaptersDir, "chapter-001.draft.md"), "utf8")
    assert.match(chapterDraft, /雨声压住账房的窗纸/u)
    assert.doesNotMatch(chapterDraft, /以下是组装候选正文/u)
    const segmentManifest = JSON.parse(await fs.readFile(path.join(segmentDir, "segment-manifest.json"), "utf8"))
    assert.equal(segmentManifest.execution.assembly.requested, true)
    assert.equal(segmentManifest.execution.assembly.decision, "fallback_author")
    assert.match(segmentManifest.execution.assembly.reason, /rejected by fiction-body guard/)
    assert.equal(segmentManifest.execution.assembly.materialChars, unusableAssemblyOutput.length)
    assert.ok(segmentManifest.execution.assembly.finalChars >= longDraft.length)
    assert.ok(receivedBodies.some((body) => /Assembly|组装当前片段候选正文/u.test(JSON.stringify(body))))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
    if (previousWritingMode === undefined) {
      delete process.env.AI_NOVEL_WRITING_MODE
    } else {
      process.env.AI_NOVEL_WRITING_MODE = previousWritingMode
    }
  }
})

test("advance uses configured draft subcall roles from writing settings", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-db-subcall-settings-"))
  const {
    advanceAutonomousProject,
    createManagedAutonomousProject,
    saveAutonomousState,
    withFactoryDb,
  } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const previousWritingMode = process.env.AI_NOVEL_WRITING_MODE
  const receivedBodies = []
  const paragraph = [
    "雨声压住账房的窗纸，沈砚把缺页账本推到灯下，指腹停在那道齐整的纸边。",
    "老周站在门槛外，没有进来，只把湿袖往身后藏了半寸。",
    "沈砚没有解释，他选择先合上账册，把旧印章扣在桌面。",
  ].join("")
  const longDraft = Array.from({ length: 8 }, () => paragraph).join("\n\n")
  const dialogueOutput = "沈砚：谁动过这一页？\n老周：小人只管收账，不管缺页。"
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url !== "/responses") {
        response.writeHead(404).end()
        return
      }
      const receivedBody = JSON.parse(rawBody)
      receivedBodies.push(receivedBody)
      const requestText = JSON.stringify(receivedBody)
      const outputText = /请生成当前片段的对白素材/u.test(requestText)
        ? dialogueOutput
        : [
            "# 第一章 缺页账本",
            "",
            "## Draft Body",
            "",
            longDraft,
            "",
            "## Drafting Metadata",
            "- Chapter: 1",
          ].join("\n")
      if (receivedBody.stream) {
        response.writeHead(200, { "content-type": "text/event-stream" })
        response.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: outputText })}\n\n`)
        response.write("data: [DONE]\n\n")
        response.end()
      } else {
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ output_text: outputText }))
      }
    })
  })

  delete process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_WRITING_MODE = "fast"

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
      projectTitle: "雨账",
      idea: "一名审雨官发现降雨记录被篡改",
    })
    const state = created.state
    state.runtime.stage = "drafting"
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => {
      db.addLlmConfig({
        name: "Draft Subcall Setting Test",
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiKey: "test-key",
        modelName: "draft-model",
        apiMode: "responses",
        timeoutMs: 2000,
        isActive: true,
      })
      db.setSystemSetting("draftSubcallRoles", "dialogue")
      db.setSystemSetting("bypassAigcGate", "1")
      db.updateProjectState(created.project.id, state)
    })

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      writingMode: "fast",
      maxRevisionAttempts: 0,
    })

    assert.ok(["complete", "blocked"].includes(advanced.plan.chapterTasks[0].status))
    const segmentRoot = path.join(created.project.projectRoot, ".ai-novel", "checkpoints", "chapter-segments", "chapter-001")
    const segmentDirs = (await fs.readdir(segmentRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^segment-\d+$/u.test(entry.name))
      .map((entry) => path.join(segmentRoot, entry.name))
    let dialogueMaterial = ""
    for (const segmentDir of segmentDirs) {
      try {
        const material = await fs.readFile(path.join(segmentDir, "material-dialogue.md"), "utf8")
        if (/Material mode: llm-subcall/u.test(material)) {
          dialogueMaterial = material
          break
        }
      } catch {
        // Not every segment must produce every optional subcall material.
      }
    }
    assert.match(dialogueMaterial, /Material mode: llm-subcall/)
    assert.match(dialogueMaterial, /谁动过这一页/)
    assert.ok(receivedBodies.some((body) => /Dialogue|对白素材/u.test(JSON.stringify(body))))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
    if (previousWritingMode === undefined) {
      delete process.env.AI_NOVEL_WRITING_MODE
    } else {
      process.env.AI_NOVEL_WRITING_MODE = previousWritingMode
    }
  }
})

test("initial planning artifacts carry chapter-level causality before drafting", async () => {
  const {
    createProductionStoryBibleAssets,
    createDetailedChapterBlueprint,
    createManagedAutonomousProject,
    createProductionMasterOutline,
    loadProductionStoryAssetContext,
    writeProductionStoryBibleAssets,
  } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-causal-planning-"))
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "穿越到大唐末期，用小人物从底层进入权力核心并见证王朝终局",
    title: "唐末因果规划",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })
  const resources = {
    styleGuide: "",
    chapterPlannerGuide: "",
    writerGuide: "",
    editorGuide: "",
    styleControllerGuide: "",
    consistencyGuide: "",
    vocabularyIndex: "",
    vocabularySamples: ["- 场景类型：权谋算计；建议：账册、密信、官印"],
    vocabularyCatalog: {
      totalWords: 4,
      entriesByCategory: {
        court_politics: [
          { word: "筹略", definition: "谋略。", categories: ["court_politics"] },
          { word: "深思熟虑", definition: "深入思考。", categories: ["court_politics", "emotions"] },
          { word: "忠心耿耿", definition: "形容非常忠诚。", categories: ["court_politics", "character_traits"] },
        ],
        emotions: [
          { word: "沉吟", definition: "迟疑不决，低声自语。", categories: ["emotions"] },
        ],
      },
      entriesByWord: new Map([
        ["筹略", { word: "筹略", definition: "谋略。", categories: ["court_politics"] }],
        ["深思熟虑", { word: "深思熟虑", definition: "深入思考。", categories: ["court_politics", "emotions"] }],
        ["忠心耿耿", { word: "忠心耿耿", definition: "形容非常忠诚。", categories: ["court_politics", "character_traits"] }],
        ["沉吟", { word: "沉吟", definition: "迟疑不决，低声自语。", categories: ["emotions"] }],
      ]),
    },
    examples: [
      [
        "### ✅ 正确示范（自然流畅）",
        "他先把账册按在桌上，听见门外风声压低，才说出自己的判断。",
        "",
        "### ❌ 错误示范（成语泛滥）",
        "他深思熟虑、忠心耿耿、义愤填膺，真是千钧一发。",
      ].join("\n"),
    ],
  }
  const context = {
    consensus: "主角必须从底层事务进入军镇与朝堂权力缝隙。",
    protagonist: "主角：李延；身份：底层小吏。",
    style: "少用堆叠短词，场景必须由动作和因果推进。",
  }
  const outline = createProductionMasterOutline(created.state, context, resources)
  const storyAssets = createProductionStoryBibleAssets(created.state, context, resources)

  assert.match(outline, /## Causal Spine/)
  assert.match(outline, /## Chapter Causality Matrix/)
  assert.match(outline, /## Continuity Anchor Plan/)
  assert.match(outline, /## Character State Ledger Plan/)
  assert.match(outline, /## Foreshadowing Payoff Schedule/)
  assert.match(outline, /Previous Input/)
  assert.match(outline, /Irreversible Change/)
  assert.equal(storyAssets.length, 13)
  assert.deepEqual(storyAssets.map((asset) => asset.filename), [
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
  ])
  assert.match(storyAssets.find((asset) => asset.filename === "world-matrix.md").content, /Frozen World Rules/)
  assert.match(storyAssets.find((asset) => asset.filename === "plot-architecture.md").content, /Chapter Causality Matrix/)
  assert.match(storyAssets.find((asset) => asset.filename === "story-bible.md").content, /Non-Negotiable Story Contract/)
  assert.match(storyAssets.find((asset) => asset.filename === "foreshadowing-ledger.md").content, /Initial Schedule/)
  assert.match(storyAssets.find((asset) => asset.filename === "character-dynamics.md").content, /Required Dossier Fields/)
  const structuredContract = JSON.parse(storyAssets.find((asset) => asset.filename === "story-foundation-contract.json").content)
  assert.equal(structuredContract.version, 1)
  assert.equal(structuredContract.project.totalChapters, 5)
  assert.equal(structuredContract.plot.chapters.length, 5)
  assert.ok(structuredContract.gates.structuredAssets.includes("foreshadowing-ledger.json"))
  assert.ok(structuredContract.foreshadowing.entries.some((entry) => entry.operation.includes("伏笔")))

  const chapterTwo = created.state.plan.chapterTasks[1]
  assert.ok(chapterTwo.causalPlan)
  assert.match(chapterTwo.summary, /承接/)
  assert.match(chapterTwo.summary, /交棒/)
  assert.doesNotMatch(chapterTwo.summary, /Draft chapter/)

  const blueprint = createDetailedChapterBlueprint(created.state, chapterTwo, context, resources)
  assert.match(blueprint, /## Previous Inputs/)
  assert.match(blueprint, /## Causal Objective/)
  assert.match(blueprint, /## Protagonist Decision/)
  assert.match(blueprint, /## Irreversible Change/)
  assert.match(blueprint, /## Character State Delta/)
  assert.match(blueprint, /## Required Continuity Anchors/)
  assert.match(blueprint, /## Next Chapter Handoff/)
  assert.match(blueprint, /因果推进/)
  assert.match(blueprint, /词汇使用指南/)
  assert.match(blueprint, /成语关联性检查/)
  assert.match(blueprint, /深思熟虑|忠心耿耿|筹略/)
  assert.match(blueprint, /Migrated Vocabulary Skill Examples/)
  assert.match(blueprint, /Writing Resource Usage Manifest/)
  assert.match(blueprint, /账册按在桌上/)
  assert.match(blueprint, /深思熟虑、忠心耿耿、义愤填膺/)

  const paths = {
    workspaceDir: path.join(created.project.projectRoot, ".ai-novel"),
    plansDir: path.join(created.project.projectRoot, ".ai-novel", "plans"),
    reportsDir: path.join(created.project.projectRoot, ".ai-novel", "reports"),
    chaptersDir: path.join(created.project.projectRoot, ".ai-novel", "chapters"),
    memoryDir: path.join(created.project.projectRoot, ".ai-novel", "memory"),
    styleDir: path.join(created.project.projectRoot, ".ai-novel", "style"),
    styleProfilePath: path.join(created.project.projectRoot, ".ai-novel", "style", "profile.md"),
    styleRulebookPath: path.join(created.project.projectRoot, ".ai-novel", "style", "rulebook.md"),
    styleReferencesPath: path.join(created.project.projectRoot, ".ai-novel", "style", "references.md"),
    styleAntiPatternsPath: path.join(created.project.projectRoot, ".ai-novel", "style", "anti-patterns.md"),
    consensusPath: path.join(created.project.projectRoot, ".ai-novel", "prompts", "global-consensus.md"),
    protagonistPath: path.join(created.project.projectRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md"),
    relationsPath: path.join(created.project.projectRoot, ".ai-novel", "memory", "characters", "relations.md"),
    characterEvolutionPath: path.join(created.project.projectRoot, ".ai-novel", "memory", "characters", "evolution.md"),
    masterOutlinePath: path.join(created.project.projectRoot, ".ai-novel", "plans", "master-outline.md"),
    chapterBlueprintsDir: path.join(created.project.projectRoot, ".ai-novel", "plans", "chapter-blueprints"),
  }
  await writeProductionStoryBibleAssets(created.project.projectRoot, paths, created.state, context, {
    preferDeterministicPlanning: true,
  })
  const writingPlan = JSON.parse(await fs.readFile(
    path.join(created.project.projectRoot, ".ai-novel", "plans", "writing-plan.json"),
    "utf8",
  ))
  assert.equal(writingPlan.version, 1)
  assert.equal(writingPlan.novelName, "唐末因果规划")
  assert.equal(writingPlan.totalChapters, 5)
  assert.equal(writingPlan.chapters.length, 5)
  assert.deepEqual(writingPlan.chapters.map((chapter) => chapter.status), ["pending", "pending", "pending", "pending", "pending"])
  const storyAssetContext = await loadProductionStoryAssetContext(paths, chapterTwo, 1400)
  assert.match(storyAssetContext.prompt, /Production Story Asset Context/)
  assert.match(storyAssetContext.prompt, /story-bible\.md/)
  assert.match(storyAssetContext.prompt, /foreshadowing-ledger\.md/)
  assert.match(storyAssetContext.prompt, /story-foundation-contract\.json/)
  assert.match(storyAssetContext.prompt, /Causal Objective/)
  assert.doesNotMatch(storyAssetContext.prompt, /"title":/)
  assert.ok(storyAssetContext.prompt.length <= 1500)

  const blueprintWithStoryAssets = createDetailedChapterBlueprint(created.state, chapterTwo, context, resources, undefined, storyAssetContext)
  assert.match(blueprintWithStoryAssets, /Production Story Asset Context/)
  assert.match(blueprintWithStoryAssets, /plot-architecture\.md/)
})

test("chapter consistency blocks drift before an editor report can pass it", async () => {
  const {
    evaluateChapterConsistency,
    parseQualityGate,
  } = await loadCore()
  const report = [
    "# Chapter Quality Report",
    "| 综合评分 | 9/10 | 质量很好 |",
    "WORD_COUNT_CHECK: 2600/2500",
    "质量门禁：passed",
  ].join("\n")
  const gate = parseQualityGate(report, 0, 2)
  assert.equal(gate.passed, true)

  const consistency = evaluateChapterConsistency({
    chapterNumber: 2,
    previousProtagonistName: "李延",
    text: "# Chapter 2\n\n## Draft Body\n\n陈远睁开眼，发现自己身在唐末城门外。陈远必须进城寻找粮食。",
  })
  assert.equal(consistency.status, "quarantined")
  assert.match(consistency.reason, /未出现已锁定主角「李延」/)
})

test("writing resource gate blocks idiom stacking and accepts concrete skill-style prose", async () => {
  const {
    evaluateWritingResourceUsage,
  } = await loadCore()

  const stacked = evaluateWritingResourceUsage("他走到门前，听见风声，深思熟虑，忠心耿耿，义愤填膺，千钧一发。")
  assert.equal(stacked.status, "warning")
  assert.match(stacked.reason, /成语|堆/)

  const extremeStacked = evaluateWritingResourceUsage("他深思熟虑，忠心耿耿，义愤填膺，千钧一发。")
  assert.equal(extremeStacked.status, "quarantined")
  assert.match(extremeStacked.reason, /极端反模式|堆叠/)

  const concrete = evaluateWritingResourceUsage([
    "李延把账册按在桌上，指腹蹭到纸边的泥。",
    "门外风声压低，差役的靴底在石阶上停了一下。",
    "他没有急着说话，只把密信往灯下推了半寸，问主簿这枚官印从哪里来。",
  ].join("\n"))
  assert.equal(concrete.status, "eligible")
  assert.match(concrete.reason, /动作|感官|物件|资源/)
})

test("genre profile carries creation style contract into writing strategy", async () => {
  const { inferGenreProfile } = await loadCore()
  const state = {
    project: {
      title: "Blind Stargazer",
      idea: "A blind stargazer hears the future in cosmic noise.",
      createdAt: "2026-06-04T00:00:00.000Z",
      workspaceVersion: 1,
      creativeProfile: {
        genre: "suspense",
        platform: "serialized web novel",
        readerPromise: "mystery",
        pointOfView: "third-person limited",
        tone: "restrained",
        naturalnessTarget: "strict",
        styleFingerprint: "short sensory paragraphs and distinct dialogue voices",
        characterProfileRequirements: [],
      },
    },
    runtime: { stage: "drafting" },
    plan: { totalChapters: 12, chapterWordTarget: 2600, chapterTasks: [] },
  }

  const genre = inferGenreProfile(state)
  assert.equal(genre.genre, "悬疑")
  assert.equal(genre.readerPromise, "mystery")
  assert.equal(genre.naturalnessTarget, "strict")
  assert.match(genre.narration, /生产风格合同/)
  assert.match(genre.narration, /风格指纹：short sensory paragraphs and distinct dialogue voices/)
  assert.match(genre.narration, /自然度=strict/)
})

test("writing pipeline hard gates plot continuity beyond matching protagonist names", async () => {
  const {
    createContinuityContract,
    evaluatePlotContinuityBridge,
    evaluateNarrativeStyleQuality,
  } = await loadCore()
  const task = {
    chapterNumber: 2,
    title: "西市追账",
    status: "pending",
    summary: "李延追查田册与密信。",
    targetWords: 2500,
  }
  const state = {
    project: {
      title: "唐末小吏",
      idea: "穿越到大唐末期，用小人物视角进入权力核心。",
      createdAt: "2026-06-04T00:00:00.000Z",
      workspaceVersion: 1,
    },
    runtime: {
      stage: "drafting",
      statusMessage: "",
      lastUpdatedAt: "2026-06-04T00:00:00.000Z",
      lastInterruption: null,
    },
    reactSetup: { discussionGoals: [], unansweredQuestions: [] },
    plan: {
      totalChapters: 10,
      chapterWordTarget: 2500,
      pendingChapters: 9,
      chapterTasks: [
        {
          chapterNumber: 1,
          title: "田册",
          status: "complete",
          summary: "李延拿到缺页田册，宋管事交出半枚官印，坊正留下一封密信。",
          targetWords: 2500,
          qualityGate: {
            status: "passed",
            score: 8,
            attempts: 0,
            reason: "质量门禁通过。首章候选主角识别为「李延」。",
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        },
        task,
      ],
    },
    assets: {
      cover: { status: "pending", briefPath: "" },
      comic: { status: "pending", planPath: "" },
    },
  }
  const previousMemory = [
    "# Chapter 1 Memory Update",
    "",
    "## Foreshadowing",
    "- Continuity anchor: 缺页田册",
    "- Continuity anchor: 半枚官印",
    "- Continuity anchor: 坊正密信",
    "- 下一章必须承接上述 Continuity anchor 中至少两个。",
    "### Foreshadowing Ledger Update",
    "- Operation:",
    "- Status:",
    "- Expected payoff / next touchpoint:",
    "- Carryover rule:",
  ].join("\n")
  const previousFinalDraft = [
    "## Final Body",
    "李延把缺页田册藏进怀里，宋管事把半枚官印塞给他。",
    "坊正密信没有拆，封口的蜡却已经裂开。",
  ].join("\n")
  const contract = createContinuityContract({
    state,
    task,
    previousMemory,
    previousFinalDraft,
  })

  assert.ok(contract.continuityAnchors.some((anchor) => /田册/.test(anchor)))
  assert.ok(contract.continuityAnchors.some((anchor) => /官印/.test(anchor)))
  assert.match(contract.prompt, /Continuity Anchors/)

  const disconnectedDraft = [
    "## Final Body",
    "李延一早去了西市，看见街边有人吵架。",
    "他买了两个胡饼，决定换一条巷子继续走。",
    "这一天的事和前一日没有什么关系，只是人声更乱。",
  ].join("\n")
  const continuity = evaluatePlotContinuityBridge(disconnectedDraft, task, contract)
  assert.equal(continuity.status, "quarantined")
  assert.match(continuity.reason, /章节连续性硬门槛失败/)

  const connectedDraft = [
    "## Final Body",
    "李延一早去了西市，袖中仍压着那本缺页田册。",
    "半枚官印硌着腕骨，他每走一步都记得宋管事昨夜的眼神。",
    "坊正密信不能再拖，他必须先找出田册缺页去了谁手里。",
  ].join("\n")
  const connectedContinuity = evaluatePlotContinuityBridge(connectedDraft, task, contract)
  assert.equal(connectedContinuity.status, "eligible")

  const fragmented = [
    "## Final Body",
    "冷。",
    "暗。",
    "冷。",
    "静。",
    "冷。",
    "痛。",
    "近。",
    "乱。",
    "急。",
    "沉。",
    "李延站在巷口。",
  ].join("\n")
  const style = evaluateNarrativeStyleQuality(fragmented)
  assert.equal(style.status, "quarantined")
  assert.match(style.reason, /短词|碎片/)
})

test("quality report treats soft narrative style issues as polish advice", async () => {
  const { createQualityReport, evaluateNarrativeStyleQuality } = await loadCore()
  const task = {
    chapterNumber: 7,
    title: "西市夜问",
    targetWords: 120,
    causalPlan: {
      requiredContinuityAnchors: ["西市", "密信", "名册"],
    },
  }
  const state = {
    project: { title: "唐末", idea: "现代人穿越到唐朝末期" },
    runtime: { stage: "drafting" },
    plan: {
      totalChapters: 500,
      chapterTasks: [
        {
          chapterNumber: 1,
          title: "田册",
          status: "complete",
          summary: "李远拿到西市密信和名册。",
          targetWords: 120,
          qualityGate: {
            status: "passed",
            score: 8,
            attempts: 0,
            reason: "质量门禁通过。首章候选主角识别为「李远」。",
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        },
        task,
      ],
    },
  }
  const blueprint = [
    "# Detailed Chapter Blueprint",
    "## Previous Inputs",
    "承接上一章西市密信和名册风险。",
    "## Causal Objective",
    "让主角决定接下夜问。",
    "## Irreversible Change",
    "成兵曹掌握了主角藏名册的线索。",
    "## Character State Delta",
    "主角从旁观变成被问责的人。",
    "## Required Continuity Anchors",
    "- 西市",
    "- 密信",
    "- 名册",
    "## Next Chapter Handoff",
    "成兵曹明日来问话。",
    "Event Sequence",
  ].join("\n")
  const draft = [
    "## Final Body",
    "冷。",
    "暗。",
    "静。",
    "痛。",
    "近。",
    "李远站在西市署棚前，袖中的密信被汗浸软，田册和名册却还压在怀里。",
    "他决定不再把账册交给周掌柜，转身把名册藏进门后的破箱。",
    "这个选择立刻带来后果：成兵曹的人已经看见了箱角露出的纸边。",
    "夜色压下来时，院门外响起脚步声，有人说明日还要来问。",
    "李远把灯吹灭，知道这一次门不能不开，信也不能再藏。",
    "他把西市火后留下的棚号重排一遍，名册上的人名开始对不上。",
    "成兵曹按刀站在门外，只问一句：密信是谁给你的？",
  ].join("\n")

  const style = evaluateNarrativeStyleQuality(draft)
  assert.equal(style.status, "quarantined")

  const report = createQualityReport(state, task, draft, blueprint)
  assert.match(report, /Style Hard Gate: 风格门禁拦截/)
  assert.doesNotMatch(report, /需要返工：风格门禁拦截/)
  assert.match(report, /综合评分 \| 8\/10/)
})

test("character profile gate rejects same-voice multi-character scenes", async () => {
  const { evaluateCharacterProfilePresence } = await loadCore()
  const contract = {
    status: "ready",
    requiredFields: [],
    knownCast: ["李延", "宋管事"],
    missingSignals: [],
    dossierBrief: "",
    profileBrief: "",
    prompt: "",
  }

  const flattened = [
    "## Final Body",
    "李延想要查清田册，他必须继续追问。宋管事想要保住账本，他必须继续解释。",
    "李延说事情很复杂，宋管事也说事情很复杂。两个人都很紧张，也都很沉默。",
    "他们的关系充满怀疑，但这一切说明局势正在变化。",
  ].join("\n")
  const flattenedGate = evaluateCharacterProfilePresence(flattened, contract)
  assert.equal(flattenedGate.status, "quarantined")
  assert.match(flattenedGate.reason, /角色差异化不足/)

  const differentiated = [
    "## Final Body",
    "李延把缺页田册按在桌角，指腹压住纸边的泥。",
    "「宋管事，官印少了半枚，你还要说是风吹的？」他没有抬头，只把灯芯拨低。",
    "宋管事喉结动了一下，袖口在桌沿蹭出细响，低声道：「小李大人，我只敢保账，不敢保命。」",
    "李延必须在天亮前决定是否把密信递进县衙，宋管事却退到门边，先替他拦住了外面的脚步声。",
  ].join("\n")
  const differentiatedGate = evaluateCharacterProfilePresence(differentiated, contract)
  assert.equal(differentiatedGate.status, "eligible")
  assert.match(differentiatedGate.reason, /角色差异化通过/)
})

test("character profile gate does not block cameo characters without forced quirks", async () => {
  const { evaluateCharacterProfilePresence } = await loadCore()
  const contract = {
    status: "ready",
    requiredFields: [],
    knownCast: ["李延", "宋管事", "沈岭"],
    missingSignals: [],
    dossierBrief: "",
    profileBrief: "",
    prompt: "",
  }

  const draft = [
    "## Final Body",
    "李延把缺页田册按在桌角，决定天亮前把密信递进县衙。",
    "「宋管事，官印少了半枚，你还要说是风吹的？」他没有抬头，只把灯芯拨低。",
    "宋管事退到门边，低声道：「小李大人，我只敢保账，不敢保命。」",
    "沈岭在巷口报了一声更鼓，随即没入雨里。",
    "李延必须在更鼓停前选择是否相信宋管事，宋管事却先替他拦住了外面的脚步声。",
  ].join("\n")

  const gate = evaluateCharacterProfilePresence(draft, contract)
  assert.equal(gate.status, "eligible")
  assert.match(gate.reason, /沈岭.*短暂出场|短暂出场.*沈岭/)
})

test("character profile gate ignores abstract ledger terms in known cast", async () => {
  const { evaluateCharacterProfilePresence } = await loadCore()
  const contract = {
    status: "ready",
    requiredFields: [],
    knownCast: ["李远", "周掌柜", "成兵曹", "关系"],
    missingSignals: [],
    dossierBrief: "",
    profileBrief: "",
    prompt: "",
  }

  const draft = [
    "## Final Body",
    "李远把密信压进袖口，指腹在纸角上停了一息。",
    "周掌柜捻着木珠，低声道：「小李大人，册子不能错一户。」",
    "成兵曹站在院门里，拇指扣着刀镡，只说：「奉少尹钧命，来问几句话。」",
    "李远没有退，反而把油灯吹灭，决定先把密信藏在身上再开门。",
  ].join("\n")

  const gate = evaluateCharacterProfilePresence(draft, contract)
  assert.equal(gate.status, "eligible")
  assert.doesNotMatch(gate.reason, /关系\(缺少/)
})

test("quality report accepts causal execution shown through concrete scene evidence", async () => {
  const { createQualityReport } = await loadCore()
  const task = {
    chapterNumber: 23,
    title: "Chapter 23",
    targetWords: 2500,
    causalPlan: {
      requiredContinuityAnchors: ["西市", "密信", "伤口", "流民"],
    },
  }
  const state = {
    project: { title: "唐末", idea: "现代人穿越到唐朝末期" },
    runtime: { stage: "drafting" },
    plan: { totalChapters: 500, chapterTasks: [task] },
  }
  const blueprint = [
    "# Detailed Chapter Blueprint",
    "## Previous Inputs",
    "承接上一章密信和西市火患。",
    "## Causal Objective",
    "让主角卷入西市署名册。",
    "## Irreversible Change",
    "成兵曹夜访。",
    "## Character State Delta",
    "周掌柜把李远推到明面。",
    "## Required Continuity Anchors",
    "- 西市",
    "- 密信",
    "- 伤口",
    "## Next Chapter Handoff",
    "成兵曹来问话。",
    "Event Sequence",
  ].join("\n")
  const draft = [
    "## Final Body",
    "李远站在西市署棚前，右肋的伤口被竹纸压得发疼，怀里的密信硌着掌心。",
    "周掌柜捻着木珠，低声道：「三日内把名册造出来。」",
    "他没有回延寿坊，转身去了流民营，把旧册背面的空白处写满人名。",
    "夜里院门被推开，成兵曹按着刀镡站在月光里，说奉少尹钧命来问几句话。",
    "李远吹灭油灯，把密信按回怀里，知道周掌柜今日把他推到明面上，今晚这道门就不能不开。",
    "西市的火味还在袖口里，流民营那张方块图也在脑子里，他应了一声：来了。",
    "他把名册一页页压平，照着火后留下的棚号重排人名。".repeat(180),
  ].join("\n")

  const report = createQualityReport(state, task, draft, blueprint)
  assert.match(report, /因果合同执行 \| 8\/10/)
  assert.doesNotMatch(report, /正文没有清晰执行承接-选择-代价-交棒/)
})

test("character profile gate requires per-character evidence windows", async () => {
  const { evaluateCharacterProfilePresence } = await loadCore()
  const contract = {
    status: "ready",
    requiredFields: [],
    knownCast: ["李延", "宋管事"],
    missingSignals: [],
    dossierBrief: "",
    profileBrief: "",
    prompt: "",
    characterDossiers: [
      {
        canonicalName: "李延",
        aliases: [],
        behaviorHabits: ["习惯揉搓衣角"],
        speechMarkers: ["的确如此"],
      },
      {
        canonicalName: "宋管事",
        aliases: [],
        behaviorHabits: ["不停拨弄算盘"],
        speechMarkers: ["小人知罪"],
      }
    ]
  }

  const mismatched = [
    "## Final Body",
    "李延必须在天亮前查清田册，他站在案前一言不发，神色冷漠。",
    "宋管事必须保住账本，却习惯揉搓衣角，低头说：小人知罪。",
  ].join("\n")

  const gateResult = evaluateCharacterProfilePresence(mismatched, contract)
  assert.equal(gateResult.status, "quarantined")
  assert.match(gateResult.reason, /角色差异化不足|弱核心角色信号/)
})

test("character voice gate uses dossier speech markers", async () => {
  const { evaluateCharacterProfilePresence } = await loadCore()
  const contract = {
    status: "ready",
    requiredFields: [],
    knownCast: ["李延", "宋管事"],
    missingSignals: [],
    dossierBrief: "",
    profileBrief: "",
    prompt: "",
    characterDossiers: [
      {
        canonicalName: "李延",
        aliases: [],
        behaviorHabits: ["拨弄算盘"],
        speechMarkers: ["的确如此"],
      },
      {
        canonicalName: "宋管事",
        aliases: [],
        behaviorHabits: ["揉搓衣角"],
        speechMarkers: ["老奴知罪"],
      }
    ]
  }

  const genericVoice = [
    "## Final Body",
    "李延拨弄算盘，冷声说道：「的确如此，账目不对。」",
    "宋管事揉搓衣角，小声回答：「这件事情很复杂，他们都说账没问题。」",
  ].join("\n")

  const gateResult = evaluateCharacterProfilePresence(genericVoice, contract)
  assert.equal(gateResult.status, "quarantined")
  assert.match(gateResult.reason, /角色差异化不足|角色鲜明度不足|弱核心角色信号/)
})

test("naturalness report flags flattened dialogue voices", async () => {
  const { createNaturalnessReport } = await loadCore()
  const task = { chapterNumber: 2, title: "Chapter 2", targetWords: 2500 }
  const state = {
    project: { title: "Test", idea: "Test idea" },
    runtime: { stage: "drafting" },
    plan: { chapterTasks: [task] }
  }
  const continuityContract = {
    lockedProtagonistName: "李延",
    requiredNames: ["李延", "宋管事"],
    knownCast: ["李延", "宋管事"],
    continuityAnchors: [],
    previousChapterLedger: []
  }
  const characterProfileContract = {
    status: "ready",
    requiredFields: [],
    knownCast: ["李延", "宋管事"],
    missingSignals: [],
    dossierBrief: "",
    profileBrief: "",
    prompt: "",
    characterDossiers: [
      {
        canonicalName: "李延",
        aliases: [],
        behaviorHabits: ["按住桌角"],
        speechMarkers: ["的确"],
      },
      {
        canonicalName: "宋管事",
        aliases: [],
        behaviorHabits: ["退到门边"],
        speechMarkers: ["知罪"],
      }
    ]
  }

  const flattened = [
    "## Final Body",
    "李延说事情很复杂，宋管事也说事情很复杂。两个人都很紧张，也都很沉默。",
    "他们都觉得局势正在变化。",
  ].join("\n")

  const report = createNaturalnessReport({
    beforeDraft: flattened,
    afterDraft: flattened,
    state,
    task,
    continuityContract,
    characterProfileContract
  })

  assert.equal(report.status, "needs_revision")
  assert.match(report.reason, /同质化|角色差异化不足|角色鲜明度不足/)
})

test("semantic preservation blocks naturalness drift while allowing local prose patches", async () => {
  const { evaluateSemanticPreservation } = await loadCore()
  const continuityContract = {
    lockedProtagonistName: "李延",
    status: "ready",
    requiredNames: ["李延", "宋管事"],
    knownCast: ["李延", "宋管事"],
    continuityAnchors: ["缺页田册", "半枚官印", "坊正密信"],
    previousChapterLedger: ["李延拿到缺页田册，宋管事交出半枚官印，坊正密信不能拆，最多只能等3日。"],
    characterLedger: "",
    foreshadowingLedger: "",
    hardRules: ["坊正密信不能拆"],
    prompt: "",
  }
  const characterProfileContract = {
    status: "ready",
    requiredFields: [],
    knownCast: ["李延", "宋管事"],
    missingSignals: [],
    dossierBrief: "",
    profileBrief: "",
    prompt: "",
  }
  const beforeDraft = [
    "## Draft Body",
    "李延把缺页田册压在袖中，半枚官印硌着腕骨。",
    "宋管事站在门边，提醒他坊正密信不能拆，最多只能等3日。",
  ].join("\n")
  const localPatch = [
    "## Final Body",
    "李延把缺页田册压进袖底，半枚官印一路硌着腕骨。",
    "宋管事守在门边，声音压得很低：坊正密信不能拆，3日之内必须等一个回音。",
  ].join("\n")
  const preserved = evaluateSemanticPreservation({
    beforeDraft,
    afterDraft: localPatch,
    continuityContract,
    characterProfileContract,
  })
  assert.equal(preserved.status, "preserved")
  assert.match(preserved.reason, /语义保真通过/)

  const driftedPatch = [
    "## Final Body",
    "赵衡把账册塞进怀里，完整官印在袖口撞了一下。",
    "门边的人催他立刻拆信，今晚就离开县衙。",
  ].join("\n")
  const drifted = evaluateSemanticPreservation({
    beforeDraft,
    afterDraft: driftedPatch,
    continuityContract,
    characterProfileContract,
  })
  assert.equal(drifted.status, "drifted")
  assert.match(drifted.reason, /语义保真失败/)
  assert.ok(drifted.missingFacts.includes("李延"))
  assert.ok(drifted.changedFacts.some((fact) => /3日/.test(fact)))
  assert.ok(drifted.changedFacts.some((fact) => /否定约束丢失/.test(fact)))
})

test("knowledge retrieval excludes stale chapter artifacts after a chapter queue reset", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-rag-reset-"))
  const {
    createManagedAutonomousProject,
    ingestKnowledgeSource,
    retrieveKnowledge,
    withFactoryDb,
  } = await loadCore()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A minor Tang clerk survives the final years of empire",
    title: "RAG Reset",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  await ingestKnowledgeSource({
    rootDir: tempDir,
    scope: "project",
    projectId: created.project.id,
    sourceType: "chapter",
    path: ".ai-novel/chapters/chapter-002.final.md",
    title: "chapter-002.final.md",
    content: "# Chapter 2\n\n## Final Body\n\n陈远在旧稿里出现，这是重置后不能再召回的污染内容。",
  })
  await ingestKnowledgeSource({
    rootDir: tempDir,
    scope: "global",
    sourceType: "vocabulary",
    path: "packages/ai-novel-core/resources/writing/style/vocabulary/daily_life.md",
    title: "daily_life.md",
    content: "# 日常词汇\n\n泥水、柴门、粗粥、冷风。",
  })
  await withFactoryDb(tempDir, async (db) => {
    db.recordEvent(created.project.id, null, "CHAPTER_QUEUE_RESET", {
      resetChapters: [2],
      startChapterNumber: 2,
      reason: "test_reset",
    })
  })

  const rows = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: created.project.id,
    query: "陈远 粗粥 泥水",
    scopes: ["project", "global"],
    sourceTypes: ["chapter", "vocabulary"],
    limit: 8,
    recordCitation: true,
  })

  assert.equal(rows.some((row) => String(row.source?.path || "").includes("chapter-002.final.md")), false)
  assert.equal(rows.some((row) => String(row.source?.sourceType || "") === "vocabulary"), true)
})

test("production writing pipeline retry limit is 3 attempts and blocks the task", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-quality-block-3-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A judge investigate poems that alter verdicts",
	      totalChapters: 2,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })

    const state = created.state
    state.runtime.stage = "drafting"
    await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), `${JSON.stringify(state, null, 2)}\n`)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      forceQualityScoreForTest: 5,
      maxRevisionAttempts: 3,
    })

    assert.equal(advanced.runtime.stage, "reviewing")
    assert.equal(advanced.plan.chapterTasks[0].status, "blocked")
    assert.equal(advanced.plan.chapterTasks[0].qualityGate.attempts, 3)
    assert.equal(advanced.plan.chapterTasks[0].qualityGate.status, "blocked")
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("production writing pipeline treats transient provider failure as resumable and does not charge recoveryAttempts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-provider-failure-test-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE

  delete process.env.AI_NOVEL_TEST_MODE

  try {
    await withFactoryDb(tempDir, async (db) => {
      db.addLlmConfig({
        name: "Provider Failure Test",
        baseUrl: "http://127.0.0.1:54321",
        apiKey: "test-key",
        modelName: "test-model",
        timeoutMs: 200,
        isActive: true,
      })
    })

	    const created = await createManagedAutonomousProject({
	      rootDir: tempDir,
	      idea: "A scholar audits rainfall history",
	      totalChapters: 2,
	      chapterWordTarget: 2500,
	    })
	    await approveProductionReadinessForTest(created.project.projectRoot, created.state, {
	      projectTitle: created.project.title,
	      idea: created.project.idea,
	    })

    const state = created.state
    state.runtime.stage = "drafting"
    await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), `${JSON.stringify(state, null, 2)}\n`)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    await assert.rejects(
      advanceAutonomousProject(created.project.projectRoot, {
        factoryRootDir: tempDir,
        projectId: created.project.id,
      }),
      (error) => {
        return error instanceof Error && (error.message.includes("Provider") || error.isProviderFailure);
      }
    )

    const stateFile = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), "utf8")
    const stateObj = JSON.parse(stateFile)
    assert.equal(stateObj.plan.chapterTasks[0].status, "pending")
    assert.equal(stateObj.plan.chapterTasks[0].recoveryAttempts || 0, 0)
    assert.match(stateObj.runtime.statusMessage, /Provider error/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("inferGenreProfile matches genre presets dynamically", async () => {
  const { inferGenreProfile } = await loadCore()

  // 1. 测试仙侠/修仙匹配
  const xianxiaState = {
    project: {
      title: "凡人逆天",
      idea: "一个普通的少年机缘巧合踏上修行之路，历经心魔雷劫最终成仙"
    }
  }
  const xianxiaProfile = inferGenreProfile(xianxiaState)
  assert.equal(xianxiaProfile.genre, "修仙/仙侠")
  assert.match(xianxiaProfile.narration, /天道寿元大限|雷劫临头|道心/)
  assert.equal(xianxiaProfile.naturalnessRules.length, 3)
  assert.equal(xianxiaProfile.contextPriority.includes("天道规则与修行代价"), true)

  // 2. 测试悬疑匹配
  const suspenseState = {
    project: {
      title: "深渊凝视",
      idea: "一个侦探在偏远小镇调查连环凶杀案，发现身边的人都在说谎"
    }
  }
  const suspenseProfile = inferGenreProfile(suspenseState)
  assert.equal(suspenseProfile.genre, "悬疑")
  assert.match(suspenseProfile.narration, /追猎者的迫近|信息挤压式/)

  // 3. 测试兜底匹配
  const defaultState = {
    project: {
      title: "日常故事",
      idea: "随笔记录"
    }
  }
  const defaultProfile = inferGenreProfile(defaultState)
  assert.equal(defaultProfile.genre, "通用类型小说")
})

test("loadAndPruneGlobalContext prunes massive context to fit budget limits", async () => {
  const { loadAndPruneGlobalContext } = await loadCore()

  const state = {
    project: {
      title: "长线史诗",
      idea: "这是一个宏大的世界观设定",
      creativeProfile: {
        genre: "修仙/仙侠",
        naturalnessTarget: "balanced",
      }
    },
    plan: {
      chapterTasks: [
        { chapterNumber: 2, title: "第二章", targetWords: 2000 }
      ]
    },
    runtime: { stage: "drafting" }
  }

  const task = state.plan.chapterTasks[0]
  const continuityContract = {
    lockedProtagonistName: "沈玄",
    continuityAnchors: Array(100).fill("伏笔：神秘石碑的裂纹在扩大"),
    hardRules: Array(100).fill("规则：修士在使用灵力时必须忍受神魂灼烧之痛"),
    previousChapterLedger: Array(100).fill("账本：沈玄在荒原上偶然拾得了一枚缺角的青铜古印，内部刻有暗金色符文")
  }

  const resources = {
    writerGuide: "A".repeat(8000),
    chapterPlannerGuide: "B".repeat(2000),
  }

  const options = {
    factoryRootDir: "./",
    signal: null,
  }

  const knowledgeContext = {
    prompt: "C".repeat(5000),
    rows: []
  }

  const result = await loadAndPruneGlobalContext({
    state,
    task,
    blueprint: "沈玄进入了遗迹，神魂灼烧，石碑开裂",
    resources,
    options,
    continuityContract,
    knowledgeContext,
    additionalFixedLength: 5000,
  })

  // 验证 RAG 和 Ledger 在超出预算时已被裁剪
  assert.ok(result.prunedRag.length < 1500)
})

test("loadProductionWritingResources correctly loads distilled anti-hallucination and conflict strategies", async () => {
  const { loadProductionWritingResources } = await loadCore()

  const loaded = await loadProductionWritingResources(process.cwd())

  assert.ok(loaded.antiHallucinationGuide)
  assert.ok(loaded.evidenceConflictStrategy)
  assert.ok(loaded.antiHallucinationGuide.includes("反幻觉"))
  assert.ok(loaded.evidenceConflictStrategy.includes("多源事实冲突"))
})

test("project runtime state continues drafting from the next incomplete chapter", async () => {
  const { deriveProjectRuntimeState } = await loadCore()
  const state = {
    runtime: { stage: "drafting", statusMessage: "", autopilot: { running: false } },
    plan: {
      totalChapters: 500,
      pendingChapters: 485,
      chapterTasks: [],
      chapterTaskSummary: { total: 500, complete: 15, pending: 485, inProgress: 0, blocked: 0 },
    },
  }
  const factorySnapshot = {
    state,
    chapterFacts: Array.from({ length: 15 }, (_, index) => ({
      chapterNumber: index + 1,
      status: "complete",
    })),
    activeJobs: [],
    runnableJobs: [],
  }

  const runtime = deriveProjectRuntimeState({ state, factorySnapshot, now: "2026-06-11T00:00:00.000Z" })

  assert.equal(runtime.workflowStage, "drafting")
  assert.equal(runtime.productionStatus, "drafting")
  assert.equal(runtime.executionStatus, "idle")
  assert.equal(runtime.primaryAction, "continue")
  assert.equal(runtime.primaryActionLabel, "继续创作")
  assert.deepEqual(runtime.nextTarget, { type: "chapter", chapterNumber: 16 })
  assert.equal(runtime.chapterProgress.completedChapters, 15)
  assert.equal(runtime.chapterProgress.pendingChapters, 485)
})

test("project runtime state labels newly created projects as startable", async () => {
  const { deriveProjectRuntimeState } = await loadCore()
  const state = {
    runtime: { stage: "worldbuilding_dialogue", statusMessage: "", autopilot: { running: false } },
    plan: {
      totalChapters: 24,
      pendingChapters: 24,
      chapterTasks: [],
      chapterTaskSummary: { total: 24, complete: 0, pending: 24, inProgress: 0, blocked: 0 },
    },
  }
  const runtime = deriveProjectRuntimeState({
    state,
    factorySnapshot: {
      state,
      chapterFacts: [],
      activeJobs: [],
      runnableJobs: [],
    },
    now: "2026-06-22T00:00:00.000Z",
  })

  assert.equal(runtime.productionStatus, "worldbuilding")
  assert.equal(runtime.executionStatus, "idle")
  assert.equal(runtime.primaryAction, "start")
  assert.equal(runtime.primaryActionLabel, "开始创作")
  assert.deepEqual(runtime.nextTarget, { type: "stage", stage: "worldbuilding_dialogue" })
})

test("project runtime state corrects stale complete stage when chapters remain", async () => {
  const { deriveProjectRuntimeState } = await loadCore()
  const state = {
    runtime: { stage: "complete", statusMessage: "" },
    plan: {
      totalChapters: 3,
      pendingChapters: 1,
      chapterTasks: [
        { chapterNumber: 1, status: "complete" },
        { chapterNumber: 2, status: "blocked" },
        { chapterNumber: 3, status: "pending" },
      ],
    },
  }

  const runtime = deriveProjectRuntimeState({ state, factorySnapshot: { state, activeJobs: [], runnableJobs: [] } })

  assert.equal(runtime.rawWorkflowStage, "complete")
  assert.equal(runtime.workflowStage, "reviewing")
  assert.equal(runtime.productionStatus, "blocked")
  assert.equal(runtime.primaryAction, "retry_blocked")
  assert.deepEqual(runtime.nextTarget, { type: "chapter", chapterNumber: 2 })
})

test("project runtime state maps job execution to primary actions", async () => {
  const { deriveProjectRuntimeState } = await loadCore()
  const state = {
    runtime: { stage: "drafting", statusMessage: "", autopilot: { running: false } },
    plan: {
      totalChapters: 2,
      pendingChapters: 1,
      chapterTasks: [
        { chapterNumber: 1, status: "complete" },
        { chapterNumber: 2, status: "pending" },
      ],
    },
  }

  const running = deriveProjectRuntimeState({
    state,
    factorySnapshot: {
      state,
      activeJobs: [{ id: "job-1", kind: "autopilot", status: "running", lease_owner: "worker-1" }],
      runnableJobs: [],
    },
  })
  assert.equal(running.executionStatus, "running")
  assert.equal(running.primaryAction, "pause")

  const paused = deriveProjectRuntimeState({
    state,
    factorySnapshot: {
      state,
      activeJobs: [{ id: "job-2", kind: "autopilot", status: "paused", lease_owner: null }],
      runnableJobs: [{ id: "job-2", kind: "autopilot", status: "paused", lease_owner: null }],
    },
  })
  assert.equal(paused.executionStatus, "paused")
  assert.equal(paused.primaryAction, "resume")
  assert.equal(paused.primaryActionLabel, "继续创作")
})

test("factory database stores LLM routes per capability", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-llm-routes-"))
  const { withFactoryDb } = await loadCore()

  const result = await withFactoryDb(tempDir, async (db) => {
    const textId = db.addLlmConfig({
      name: "Text Model",
      baseUrl: "https://text.example/v1",
      apiKey: "text-key",
      modelName: "text-model",
      isActive: true,
    })
    const imageId = db.addLlmConfig({
      name: "Image Model",
      baseUrl: "https://image.example/v1",
      apiKey: "image-key",
      modelName: "image-model",
      apiMode: "responses",
    })

    db.setLlmConfigRoute("image", imageId)
    db.setLlmConfigRoute("TEXT", textId)

    return {
      routes: db.listLlmConfigRoutes(),
      imageConfig: db.getLlmConfigForCapability("image"),
      activeConfig: db.getActiveLlmConfig(),
    }
  })

  assert.equal(result.routes.length, 2)
  assert.equal(result.imageConfig.model_name, "image-model")
  assert.equal(result.imageConfig.api_mode, "responses")
  assert.equal(result.activeConfig.model_name, "text-model")
  assert.ok(result.routes.some((route) => route.capability === "text"))
  assert.ok(result.routes.some((route) => route.capability === "image"))
})

test("loadLlmConfigForCapability uses routed model and text fallback", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-llm-route-loader-"))
  const { loadLlmConfigForCapability, withFactoryDb } = await loadCore()

  await withFactoryDb(tempDir, async (db) => {
    db.addLlmConfig({
      name: "Text Model",
      baseUrl: "https://text.example/v1",
      apiKey: "text-key",
      modelName: "text-model",
      isActive: true,
    })
    const imageId = db.addLlmConfig({
      name: "Image Model",
      baseUrl: "https://image.example/v1",
      apiKey: "image-key",
      modelName: "image-model",
      apiMode: "responses",
    })
    db.setLlmConfigRoute("image", imageId)
  })

  const imageConfig = await loadLlmConfigForCapability(tempDir, "image")
  const textConfig = await loadLlmConfigForCapability(tempDir, "text")
  const videoConfig = await loadLlmConfigForCapability(tempDir, "video")

  assert.equal(imageConfig.provider.modelName, "image-model")
  assert.equal(imageConfig.provider.apiMode, "responses")
  assert.equal(imageConfig._dbApiKey, "image-key")
  assert.equal(imageConfig._capability, "image")
  assert.equal(textConfig.provider.modelName, "text-model")
  assert.equal(textConfig.provider.apiMode, "chat")
  assert.equal(videoConfig, null)
})

test("studio API saves and returns LLM capability routes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-llm-route-api-"))
  const { handleNovelStudioApi } = await loadStudioServer()

  const textResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
    name: "Text Model",
    baseUrl: "https://text.example/v1",
    apiKey: "text-key",
    modelName: "text-model",
  })
  assert.equal(textResponse.status, 200)

  const imageResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
    name: "Image Model",
    baseUrl: "https://image.example/v1",
    apiKey: "image-key",
    modelName: "image-model",
    apiMode: "responses",
  })
  assert.equal(imageResponse.status, 200)

  const imageConfig = imageResponse.payload.configs.find((config) => config.name === "Image Model")
  assert.ok(imageConfig)

  const routeResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-config-routes", {
    routes: {
      image: imageConfig.id,
      video: "",
    },
  })
  assert.equal(routeResponse.status, 200)
  assert.ok(routeResponse.payload.routes.some((route) =>
    route.capability === "image" && route.config_id === imageConfig.id
  ))

  const listResponse = await handleNovelStudioApi(tempDir, "GET", "/api/llm-configs")
  assert.equal(listResponse.status, 200)
  assert.ok(listResponse.payload.routes.some((route) =>
    route.capability === "image" && route.model_name === "image-model" && route.api_mode === "responses"
  ))
  assert.ok(listResponse.payload.configs.some((config) =>
    config.name === "Image Model" && config.api_mode === "responses"
  ))
  assert.equal(listResponse.payload.configs.some((config) => config.api_key === "image-key"), false)
})

test("studio API saves and returns draft subcall writing settings", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-writing-settings-"))
  const { handleNovelStudioApi } = await loadStudioServer()

  const initialResponse = await handleNovelStudioApi(tempDir, "GET", "/api/settings/writing")
  assert.equal(initialResponse.status, 200)
  assert.equal(initialResponse.payload.settings.aigcDetector.provider, "local-heuristic")
  assert.equal(initialResponse.payload.settings.aigcDetector.url, "")

  const saveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/settings/writing", {
    settings: {
      bypassAigcGate: true,
      autoAigcRefinement: false,
      draftSubcallRoles: ["dialogue", "narration", "unknown", "dialogue", "assembly"],
      aigcDetector: {
        provider: "generic-json",
        url: "http://127.0.0.1:8765/detect",
        token: "secret-token",
        timeoutMs: "45000",
        threshold: "0.72",
        requestTextField: "content",
        headersJson: "{\"x-detector\":\"yes\"}",
        segmentMaxChars: 640,
        segmentMinChars: 120,
        gradioFnIndex: "3",
        gradioSessionHash: "session-secret",
        gradioJoinUrl: "/queue/join",
        gradioDataUrl: "/queue/data",
        gradioSkipJoin: true,
        gradioInputsJson: "[\"{{text}}\",\"zh\"]",
      },
    },
  })
  assert.equal(saveResponse.status, 200)

  const getResponse = await handleNovelStudioApi(tempDir, "GET", "/api/settings/writing")
  assert.equal(getResponse.status, 200)
  assert.equal(getResponse.payload.settings.bypassAigcGate, true)
  assert.equal(getResponse.payload.settings.autoAigcRefinement, false)
  assert.deepEqual(getResponse.payload.settings.draftSubcallRoles, ["dialogue", "narration", "assembly"])
  assert.deepEqual(getResponse.payload.settings.aigcDetector, {
    provider: "generic-json",
    url: "http://127.0.0.1:8765/detect",
    tokenConfigured: true,
    timeoutMs: 45000,
    threshold: 0.72,
    requestTextField: "content",
    headersJson: "{\"x-detector\":\"yes\"}",
    segmentMaxChars: 640,
    segmentMinChars: 120,
    gradioFnIndex: "3",
    gradioSessionHashConfigured: true,
    gradioJoinUrl: "/queue/join",
    gradioDataUrl: "/queue/data",
    gradioSkipJoin: true,
    gradioInputsJson: "[\"{{text}}\",\"zh\"]",
  })

  const keepSecretResponse = await handleNovelStudioApi(tempDir, "POST", "/api/settings/writing", {
    settings: {
      aigcDetector: {
        provider: "generic-json",
        token: "[configured]",
        gradioSessionHash: "[configured]",
      },
    },
  })
  assert.equal(keepSecretResponse.status, 200)
  const { getAigcDetectorConfig } = await loadCore()
  const detectorConfig = getAigcDetectorConfig(tempDir)
  assert.equal(detectorConfig.token, "secret-token")
  assert.equal(detectorConfig.gradio.sessionHash, "session-secret")
})
