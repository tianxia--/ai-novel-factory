import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const testFilePath = fileURLToPath(import.meta.url)
const packageRoot = path.resolve(path.dirname(testFilePath), "..")
const coreEntry = path.join(packageRoot, "dist", "index.js")
const studioServerEntry = path.join(packageRoot, "dist", "studio-server.js")

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

async function loadStudioServer() {
  return import(`${pathToFileURL(studioServerEntry).href}?ts=${Date.now()}`)
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve))
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve)
    server.once("error", reject)
  })
  const address = server.address()
  assert.ok(address && typeof address === "object")
  return address
}

function completeStyleContract(overrides = {}) {
  return {
    voice: "克制冷感、白描推进、以物件和动作压住悬疑。",
    sentenceRhythm: "短句为主，少量中句承接动作后果。",
    dialogueRules: ["对白短，带压力，不解释背景。"],
    descriptionRules: ["描写优先落在物件、动作和潮湿环境。"],
    emotionRules: ["情绪通过停顿、动作和选择显露。"],
    pacingRules: ["每段保留压力推进和可追踪钩子。"],
    povRules: ["保持贴身近距视角，不越权泄露。"],
    openingRules: ["开场直接进入具体压力场景。"],
    endingHookRules: ["结尾留一个可追踪问题或关系裂缝。"],
    allowedDevices: ["白描", "动作推进", "物件压迫", "短对白"],
    forbiddenPatterns: ["解释创作意图", "总结式升华"],
    positiveExamples: ["沈砚把缺页账本推到灯下。"],
    negativeExamples: ["他这才明白命运的齿轮已经开始转动。"],
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

test("freeze preview assets are persisted into approved style contract and chapter drafting context", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-freeze-approval-"))
  const { createManagedAutonomousProject, loadApprovedWritingStyleContext } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()

  let llmHits = 0
  let aigcServer = null
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        llmHits += 1
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: llmHits === 1
            ? JSON.stringify({
                voice: "模型提炼：克制冷感、白描推进、以物件和动作压住悬疑。",
                sentenceRhythm: "短句为主，少量中句承接动作后果。",
                dialogueRules: ["对白短，带压力，不解释背景。"],
                descriptionRules: ["描写优先落在物件、动作和潮湿环境。"],
                emotionRules: ["情绪通过停顿和动作显露。"],
                pacingRules: ["每段都保留压力推进和钩子。"],
                povRules: ["保持贴身近距视角。"],
                openingRules: ["开场直接进入具体压力场景。"],
                endingHookRules: ["结尾留一个可追踪问题。"],
                allowedDevices: ["白描", "动作推进", "物件压迫"],
                forbiddenPatterns: ["解释创作意图", "总结式升华"],
                positiveExamples: ["沈砚把缺页账本推到灯下，纸边齐得发亮。"],
                negativeExamples: ["他这才明白命运的齿轮已经开始转动。"],
              })
            : JSON.stringify({
                freezeVerdict: "ready",
                freezeSummary: "当前版本已经足够稳定，可冻结为整本书统一写法合同。",
                blockingReasons: [],
                contractAdjustments: ["继续强调短对白和动作压迫。"],
                forbiddenPatterns: ["不要同质化对白"],
                positiveExamples: ["老周的手缩进袖口，没有接。"],
                inheritedRules: ["正文必须延续当前冷感白描与短对白规则。"],
              }),
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  try {
    const address = await listen(server)
    aigcServer = http.createServer(async (request, response) => {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ aiProbability: 0.12, label: "human", confidence: 0.88 }))
    })
    const aigcAddress = await listen(aigcServer)
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await fs.writeFile(path.join(created.project.projectRoot, ".env"), [
      "AIGC_DETECTOR_PROVIDER=generic-json",
      `AIGC_DETECTOR_URL=http://127.0.0.1:${aigcAddress.port}/detect`,
      "AIGC_DETECTOR_THRESHOLD=0.8",
      "",
    ].join("\n"))

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Freeze Approval Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "freeze-approval-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const initResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/init", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      referenceWorks: ["漫长的季节"],
      desiredVibes: ["冷感", "潮湿感", "压迫感"],
      seedForbiddenPatterns: ["不要解释创作意图"],
    }, { projectId: created.project.id })
    assert.equal(initResponse.status, 200)

    const candidateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/candidate", {
      projectId: created.project.id,
      prompt: "第二版样段",
      sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
      review: "可作为全书基础写法。",
    }, { projectId: created.project.id })
    assert.equal(candidateResponse.status, 200)
    assert.equal(candidateResponse.payload.styleEvolution.contract.verification.status, "passed")

    const previewResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/freeze-preview", {
      projectId: created.project.id,
      version: 1,
    }, { projectId: created.project.id })
    assert.equal(previewResponse.status, 400)
    assert.equal(previewResponse.payload.error, "style_candidate_not_user_accepted")

    const acceptResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/accept", {
      projectId: created.project.id,
      version: 1,
      acceptedAt: "2026-06-25T00:00:00.000Z",
    }, { projectId: created.project.id })
    assert.equal(acceptResponse.status, 200)

    const acceptedPreviewResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/freeze-preview", {
      projectId: created.project.id,
      version: 1,
    }, { projectId: created.project.id })
    assert.equal(acceptedPreviewResponse.status, 200)
    assert.ok(acceptedPreviewResponse.payload.freezePreview.positiveExamples.includes("老周的手缩进袖口，没有接。"))
    assert.ok(acceptedPreviewResponse.payload.freezePreview.inheritedRules.includes("正文必须延续当前冷感白描与短对白规则。"))

    const approveResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
      projectId: created.project.id,
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
    }, { projectId: created.project.id })
    assert.equal(approveResponse.status, 200)

    const contract = approveResponse.payload.styleEvolution.contract
    assert.match(String(contract.approval?.freezeSummary || ""), /稳定|冻结|整本书/)
    assert.ok(contract.styleContract?.positiveExamples?.includes("老周的手缩进袖口，没有接。"))
    assert.ok(Array.isArray(contract.styleContract?.positiveExamples))
    assert.ok(contract.styleContract.positiveExamples.length >= 2)
    assert.ok(contract.inheritance?.inheritedRules?.includes("正文必须延续当前冷感白描与短对白规则。"))
    assert.ok(contract.antiPatterns?.includes("不要同质化对白"))

    const approvedStyleContext = await loadApprovedWritingStyleContext(created.project.projectRoot)
    assert.equal(approvedStyleContext.status, "ready")
    assert.match(approvedStyleContext.prompt, /Verification summary:/)
    assert.match(approvedStyleContext.prompt, /Positive examples:/)
    assert.match(approvedStyleContext.prompt, /Inheritance rule: 正文必须延续当前冷感白描与短对白规则。/)
    assert.match(approvedStyleContext.rulebook, /# Style Rulebook/)
    assert.match(approvedStyleContext.references, /Positive Examples/)
    assert.match(approvedStyleContext.references, /老周的手缩进袖口，没有接。/)
    assert.match(approvedStyleContext.antiPatterns, /Inheritance Rules/)

    const rulebookPath = path.join(created.project.projectRoot, ".ai-novel", "style", "rulebook.md")
    const referencesPath = path.join(created.project.projectRoot, ".ai-novel", "style", "references.md")
    const antiPatternsPath = path.join(created.project.projectRoot, ".ai-novel", "style", "anti-patterns.md")
    const [rulebookText, referencesText, antiPatternsText] = await Promise.all([
      fs.readFile(rulebookPath, "utf8"),
      fs.readFile(referencesPath, "utf8"),
      fs.readFile(antiPatternsPath, "utf8"),
    ])
    assert.match(rulebookText, /Verification summary:/)
    assert.match(rulebookText, /Verification status: passed/)
    assert.match(referencesText, /老周的手缩进袖口，没有接。/)
    assert.match(antiPatternsText, /正文必须延续当前冷感白描与短对白规则。/)
    assert.match(antiPatternsText, /不要同质化对白/)
  } finally {
    await close(server)
    if (aigcServer) {
      await close(aigcServer)
    }
  }
})

test("approved style context is not ready when generation verification is blocked", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-context-blocked-"))
  const { createManagedAutonomousProject, initializeStyleEvolution, loadApprovedWritingStyleContext } = await loadCore()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })

  await initializeStyleEvolution(created.project.projectRoot, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  const contractPath = path.join(created.project.projectRoot, ".ai-novel", "style", "evolution", "style-contract.json")
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"))
  contract.approvedAt = "2026-06-25T00:00:00.000Z"
  contract.approval = {
    status: "approved",
    approvedVersion: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    acceptedAsBookStyle: true,
  }
  contract.approvedSample = "雨线挂在门槛外。沈砚把缺页账本推到灯下。"
  contract.styleContract = completeStyleContract({
    voice: "克制冷感，动作先行。",
    sentenceRhythm: "短句为主。",
  })
  contract.verification = {
    gate: "Generation Verification Gate",
    status: "blocked",
    summary: "fixture blocked",
    reasons: ["AIGC 检测未通过。"],
  }
  await fs.writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`)

  const approvedStyleContext = await loadApprovedWritingStyleContext(created.project.projectRoot)
  assert.equal(approvedStyleContext.status, "missing")
  assert.equal(approvedStyleContext.prompt, "")
})

test("approved style context keeps approved verification when later candidate is blocked", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-approved-verification-stable-"))
  const {
    acceptStyleEvolutionCandidate,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    createManagedAutonomousProject,
    initializeStyleEvolution,
    loadApprovedWritingStyleContext,
    loadStyleEvolution,
  } = await loadCore()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })

  await initializeStyleEvolution(created.project.projectRoot, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  await appendStyleEvolutionCandidate(created.project.projectRoot, {
    prompt: "第一版样段",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    review: "第一版可以冻结。",
    evaluation: {
      source: "llm_critic",
      verdict: "approve",
      summary: "v1 通过生成验证。",
      scores: {
        narrativeVoice: 9,
        sentenceRhythm: 8.8,
        dialogueTexture: 8.8,
        informationDensity: 8.9,
        emotionalTension: 8.8,
        readability: 8.9,
        requirementAlignment: 9,
        forbiddenPatternRisk: 0.2,
        overall: 9,
      },
      strengths: ["克制冷感。"],
      deviations: [],
      forbiddenHits: [],
      nextFocus: ["保持动作压迫。"],
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
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })
  await acceptStyleEvolutionCandidate(created.project.projectRoot, {
    version: 1,
    acceptedAt: "2026-06-25T00:00:00.000Z",
  })
  await approveStyleEvolutionSample(created.project.projectRoot, {
    version: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    styleContract: completeStyleContract({
      voice: "克制冷感、白描推进、以物件和动作压住悬疑。",
      sentenceRhythm: "短动作句与中句承接后果。",
      dialogueRules: ["对白短，带压力。"],
      descriptionRules: ["先物件、声音、身体反应，再给判断。"],
      forbiddenPatterns: ["解释创作意图", "总结式升华"],
      positiveExamples: ["沈砚合上账册，只问了一句：谁动过这一页？"],
    }),
  })
  await appendStyleEvolutionCandidate(created.project.projectRoot, {
    prompt: "第二版样段",
    sample: "这是一段模板化表达，事实上它不仅如此，还要总结式升华。",
    review: "第二版不应污染已冻结合同。",
    evaluation: {
      source: "llm_critic",
      verdict: "retry",
      summary: "v2 被生成验证阻塞。",
      scores: {
        narrativeVoice: 6,
        sentenceRhythm: 5.8,
        dialogueTexture: 5.4,
        informationDensity: 5.6,
        emotionalTension: 5.5,
        readability: 6,
        requirementAlignment: 5.5,
        forbiddenPatternRisk: 8.8,
        overall: 5.8,
      },
      strengths: [],
      deviations: ["模板化表达。"],
      forbiddenHits: ["总结式升华"],
      nextFocus: ["重写。"],
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
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })

  const snapshot = await loadStyleEvolution(created.project.projectRoot)
  assert.equal(snapshot.contract.approval.approvedVersion, 1)
  assert.equal(snapshot.contract.verification.status, "passed")
  assert.equal(snapshot.contract.verification.version, 1)
  assert.equal(snapshot.contract.loop.status, "approved")
  assert.equal(snapshot.contract.loop.verificationStatus, "passed")
  assert.equal(snapshot.contract.evolutionHistory.at(-1).verification.status, "blocked")

  const approvedStyleContext = await loadApprovedWritingStyleContext(created.project.projectRoot)
  assert.equal(approvedStyleContext.status, "ready")
  assert.match(approvedStyleContext.prompt, /Verification status: passed/)
  assert.doesNotMatch(approvedStyleContext.prompt, /Verification status: blocked/)
})

test("approved style context is not ready when generation verification is missing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-context-missing-verification-"))
  const {
    createManagedAutonomousProject,
    initializeStyleEvolution,
    loadApprovedWritingStyleContext,
  } = await loadCore()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })

  await initializeStyleEvolution(created.project.projectRoot, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  const contractPath = path.join(created.project.projectRoot, ".ai-novel", "style", "evolution", "style-contract.json")
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"))
  contract.approvedAt = "2026-06-25T00:00:00.000Z"
  contract.approval = {
    status: "approved",
    approvedVersion: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    acceptedAsBookStyle: true,
  }
  contract.approvedSample = "雨线挂在门槛外。沈砚把缺页账本推到灯下。"
  contract.styleContract = completeStyleContract({
    voice: "克制冷感，动作先行。",
    sentenceRhythm: "短句为主。",
    dialogueRules: ["对白短，带压力。"],
    descriptionRules: ["先写物件和动作。"],
    forbiddenPatterns: ["解释创作意图"],
    positiveExamples: ["沈砚把缺页账本推到灯下。"],
  })
  contract.evolutionHistory = []
  delete contract.verification
  await fs.writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`)

  const approvedStyleContext = await loadApprovedWritingStyleContext(created.project.projectRoot)
  assert.equal(approvedStyleContext.status, "missing")
  assert.equal(approvedStyleContext.prompt, "")
})

test("style freeze accepts complete executable style contract fields", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-freeze-incomplete-contract-"))
  const {
    acceptStyleEvolutionCandidate,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    createManagedAutonomousProject,
    initializeStyleEvolution,
  } = await loadCore()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })

  await initializeStyleEvolution(created.project.projectRoot, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  await appendStyleEvolutionCandidate(created.project.projectRoot, {
    prompt: "可冻结样段",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    review: "测试夹具：已通过写法验证。",
    evaluation: {
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
    },
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })

  await acceptStyleEvolutionCandidate(created.project.projectRoot, {
    version: 1,
    acceptedAt: "2026-06-25T00:00:00.000Z",
  })
  const approved = await approveStyleEvolutionSample(created.project.projectRoot, {
    version: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    styleContract: completeStyleContract({
      voice: "克制冷感，动作先行。",
      sentenceRhythm: "短句为主。",
      positiveExamples: ["沈砚把缺页账本推到灯下。"],
    }),
  })

  assert.equal(approved.contract.verification.status, "passed")
  assert.ok(approved.contract.styleContract.dialogueRules.length > 0)
  assert.ok(approved.contract.styleContract.descriptionRules.length > 0)
  assert.ok(approved.contract.styleContract.emotionRules.length > 0)
  assert.ok(approved.contract.styleContract.pacingRules.length > 0)
  assert.ok(approved.contract.styleContract.povRules.length > 0)
  assert.ok(approved.contract.styleContract.openingRules.length > 0)
  assert.ok(approved.contract.styleContract.endingHookRules.length > 0)
  assert.ok(approved.contract.styleContract.allowedDevices.length > 0)
  assert.ok(approved.contract.styleContract.forbiddenPatterns.length > 0)
  assert.ok(approved.contract.styleContract.positiveExamples.length > 0)
  assert.ok(Array.isArray(approved.contract.styleContract.negativeExamples))
})

test("style freeze normalizes sparse extracted contracts into executable inheritance rules", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-freeze-sparse-contract-"))
  const {
    acceptStyleEvolutionCandidate,
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    createManagedAutonomousProject,
    initializeStyleEvolution,
  } = await loadCore()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })

  await initializeStyleEvolution(created.project.projectRoot, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  await appendStyleEvolutionCandidate(created.project.projectRoot, {
    prompt: "可冻结样段",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
    review: "测试夹具：已通过写法验证。",
    evaluation: {
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
    },
    refinement: createStyleRefinementForTest(),
    freezer: readyFreezerFixture(),
  })

  await acceptStyleEvolutionCandidate(created.project.projectRoot, {
    version: 1,
    acceptedAt: "2026-06-25T00:00:00.000Z",
  })
  const approved = await approveStyleEvolutionSample(created.project.projectRoot, {
    version: 1,
    approvedAt: "2026-06-25T00:00:00.000Z",
    styleContract: {
      voice: "克制冷感，动作先行。",
      sentenceRhythm: "短句为主。",
      dialogueRules: [],
      descriptionRules: [],
      emotionRules: [],
      pacingRules: [],
      povRules: [],
      openingRules: [],
      endingHookRules: [],
      allowedDevices: [],
      forbiddenPatterns: [],
      positiveExamples: [],
      negativeExamples: [],
    },
  })

  assert.equal(approved.gate.status, "passed")
  assert.ok(approved.contract.styleContract.allowedDevices.length > 0)
  assert.ok(approved.contract.styleContract.dialogueRules.length > 0)
  assert.ok(approved.contract.styleContract.descriptionRules.length > 0)
  assert.ok(approved.contract.styleContract.positiveExamples.length > 0)
  assert.ok(approved.contract.inheritance.inheritedArtifacts.includes("retry policy"))
})

test("style freeze rejects candidates without generation verification", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-freeze-unverified-candidate-"))
  const {
    appendStyleEvolutionCandidate,
    approveStyleEvolutionSample,
    createManagedAutonomousProject,
    initializeStyleEvolution,
  } = await loadCore()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "一名审雨官发现降雨记录被篡改",
    title: "雨账",
    totalChapters: 12,
    chapterWordTarget: 2500,
  })

  await initializeStyleEvolution(created.project.projectRoot, {
    projectTitle: "雨账",
    idea: "一名审雨官发现降雨记录被篡改",
    userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
  })
  await appendStyleEvolutionCandidate(created.project.projectRoot, {
    prompt: "未验证样段",
    sample: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。",
    review: "测试夹具：缺少结构化评估与 AIGC 验证。",
  })

  await assert.rejects(
    () => approveStyleEvolutionSample(created.project.projectRoot, {
      version: 1,
      approvedAt: "2026-06-25T00:00:00.000Z",
      styleContract: completeStyleContract({
        voice: "克制冷感，动作先行。",
        sentenceRhythm: "短句为主。",
        dialogueRules: ["对白短，带压力。"],
        descriptionRules: ["先写物件和动作。"],
        forbiddenPatterns: ["解释创作意图"],
        positiveExamples: ["沈砚把缺页账本推到灯下。"],
      }),
    }),
    /style_generation_verification_blocked/,
  )
})
