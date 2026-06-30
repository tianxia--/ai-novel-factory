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

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString("utf8")
}

test("production acceptance flow proves novel factory can run from creation to readable delivery", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-acceptance-"))
  const { handleNovelStudioApi } = await loadStudioServer()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const previousAigcProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousAigcUrl = process.env.AIGC_DETECTOR_URL
  const previousAigcThreshold = process.env.AIGC_DETECTOR_THRESHOLD
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
        const instructions = String(receivedBody.instructions || "")
        const input = typeof receivedBody.input === "string" ? receivedBody.input : JSON.stringify(receivedBody.input || "")
        const secondCandidate = /上一版候选样段|继续压缩对白/.test(input)
        let outputText = [
          "雨声贴着窗纸往下滑。",
          "沈砚把缺页账本推到灯下。纸边齐得过分，像刚从刀口退出来。",
          "老周站在门槛外，袖口压着半枚湿印。",
          "“谁动过？”沈砚问。",
          "老周没答，只把鞋尖往后收了半寸。",
          "灯火一跳，缺页处露出一行浅墨：戊辰，民户减三，官仓添七。",
          "沈砚合上账册。门外的雨忽然轻了，廊下却多了一道脚步。",
        ].join("\n")
        if (/Evaluator|Critic/.test(instructions) && !/Candidate Generator/.test(instructions)) {
          outputText = JSON.stringify({
            evaluation: {
              verdict: "approve",
              summary: "结构化 evaluator 认为当前样段可以进入用户确认。",
              scores: {
                narrativeVoice: 9.0,
                sentenceRhythm: 8.9,
                dialogueTexture: 8.8,
                informationDensity: 8.8,
                emotionalTension: 8.9,
                readability: 8.9,
                requirementAlignment: 9.0,
                forbiddenPatternRisk: 0.3,
                overall: 9.0,
              },
              strengths: ["冷感白描稳定，动作和物件推动清楚。"],
              deviations: [],
              forbiddenHits: [],
              nextFocus: ["保持短对白和动作压迫。"],
            },
          })
        } else if (/Prompt Refiner/.test(instructions)) {
          outputText = JSON.stringify({
            refinement: {
              summary: "保持克制冷感和短对白，把压力交给动作与停顿。",
              promptAdjustments: ["对白继续压短。"],
              contractAdjustments: ["冻结时固化短对白、动作先行和禁忌模式。"],
              nextPrompt: "继续保持克制冷感，用动作、物件和短对白推进悬疑压力。",
            },
          })
        } else if (/Freeze Gate|Freezer/.test(instructions)) {
          outputText = JSON.stringify({
            freezeVerdict: "ready",
            freezeSummary: "当前版本已经足够稳定，可冻结为整本书统一写法合同。",
            blockingReasons: [],
            contractAdjustments: ["继续强调短对白和动作压迫。"],
            forbiddenPatterns: ["解释创作意图", "总结式升华", "同质化对白"],
            positiveExamples: ["沈砚合上账册，只问一句：谁动过这一页？"],
            inheritedRules: ["正文必须延续当前冷感白描与短对白规则。"],
          })
        } else if (/写法合同提炼器/.test(instructions)) {
          outputText = JSON.stringify({
            voice: "模型提炼：克制冷感、白描推进、让物件与动作承压。",
            sentenceRhythm: "短句为主，少量中句承接动作后果，避免解释性长段。",
            dialogueRules: ["对白短，带压力，不解释背景。"],
            descriptionRules: ["先物件、声音、身体反应，再给判断。"],
            emotionRules: ["情绪通过停顿、动作和回避显影。"],
            pacingRules: ["每段必须推进线索、关系或代价。"],
            povRules: ["保持第三人称限知，不泄露未来章节信息。"],
            openingRules: ["开场落在具体异常与现场压力上。"],
            endingHookRules: ["结尾留下可追踪问题、关系裂缝或线索余波。"],
            allowedDevices: ["账册", "雨声", "灯火", "门外脚步"],
            forbiddenPatterns: ["解释创作意图", "总结式升华", "同质化对白"],
            positiveExamples: ["沈砚合上账册，只问一句：谁动过这一页？"],
            negativeExamples: ["他知道事情很严重，未来会更加危险。"],
          })
        } else if (secondCandidate) {
          outputText = "雨声贴着窗纸往下滑。沈砚合上账册，只问一句：谁动过这一页？门外的人没答，鞋底却先退了半步。"
        }
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: outputText,
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    aigcServer = http.createServer(async (request, response) => {
      await readBody(request)
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ aiProbability: 0.12, label: "human", confidence: 0.88 }))
    })
    await new Promise((resolve, reject) => {
      aigcServer.listen(0, "127.0.0.1", resolve)
      aigcServer.once("error", reject)
    })
    const aigcAddress = aigcServer.address()
    assert.ok(aigcAddress && typeof aigcAddress === "object")
    process.env.AIGC_DETECTOR_PROVIDER = "generic-json"
    process.env.AIGC_DETECTOR_URL = `http://127.0.0.1:${aigcAddress.port}/detect`
    process.env.AIGC_DETECTOR_THRESHOLD = "0.8"

    const createResponse = await handleNovelStudioApi(tempDir, "POST", "/api/projects", {
      title: "税册风声",
      idea: "一个长安小吏在诡异税册里追查王朝命数",
      chapters: 3,
      chapterWords: 2500,
      creativeProfile: {
        genre: "historical mystery",
        platform: "serialized web novel",
        readerPromise: "设定清晰、人物承压、情节持续钩住读者",
        pointOfView: "third-person limited",
        tone: "cold, tense, scene-first",
        naturalnessTarget: "strict",
      },
    })
    assert.equal(createResponse.status, 201)
    const projectId = createResponse.payload.projectId
    assert.ok(projectId)
    assert.equal(createResponse.payload.state.runtime.stage, "worldbuilding_dialogue")
    assert.equal(createResponse.payload.state.project.creativeProfile.genre, "historical mystery")
    assert.equal(createResponse.payload.state.project.creativeProfile.readerPromise, "设定清晰、人物承压、情节持续钩住读者")

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Acceptance Text Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "acceptance-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const styleRouteResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Acceptance Style Evolution Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "gpt-5.5",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(styleRouteResponse.status, 200)
    const styleRouteConfig = styleRouteResponse.payload.configs.find((config) => config.model_name === "gpt-5.5")
    assert.ok(styleRouteConfig?.id)
    const routeBindResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-config-routes", {
      routes: {
        style_evolution: styleRouteConfig.id,
      },
    })
    assert.equal(routeBindResponse.status, 200)

    const styleGenerateOne = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId,
      userStylePrompt: "克制、冷感、白描，人物要带隐秘执念，靠动作和物件推动悬疑。",
    }, { projectId })
    assert.equal(styleGenerateOne.status, 200)
    assert.equal(styleGenerateOne.payload.generatedCandidate.version, 1)
    assert.equal(styleGenerateOne.payload.modelRouting.modelName, "gpt-5.5")
    assert.equal(styleGenerateOne.payload.modelRouting.capability, "style_evolution")

    const styleGenerateTwo = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId,
      userStylePrompt: "克制、冷感、白描，人物要带隐秘执念，靠动作和物件推动悬疑。",
      iterationFeedback: "继续压缩对白，增强人物动作中的试探和权力压力。",
    }, { projectId })
    assert.equal(styleGenerateTwo.status, 200)
    assert.equal(styleGenerateTwo.payload.generatedCandidate.version, 2)
    assert.equal(styleGenerateTwo.payload.modelRouting.modelName, "gpt-5.5")
    assert.equal(styleGenerateTwo.payload.modelRouting.capability, "style_evolution")

    const styleAccept = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/accept", {
      projectId,
      version: 2,
      acceptedAt: "2026-06-27T00:00:00.000Z",
    }, { projectId })
    assert.equal(styleAccept.status, 200)

    const styleApprove = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/approve", {
      projectId,
      version: 2,
      approvedAt: "2026-06-27T00:00:00.000Z",
    }, { projectId })
    assert.equal(styleApprove.status, 200)
    assert.equal(styleApprove.payload.styleEvolution.gate.status, "passed")

    const discussionResponse = await handleNovelStudioApi(tempDir, "POST", "/api/chat", {
      projectId,
      message: "继续收敛世界规则、主角欲望、关键人物关系、主线悬念和伏笔账本，不要正式写正文。",
    }, { projectId })
    assert.equal(discussionResponse.status, 200)
    assert.equal(discussionResponse.payload.discussion.writebackSkipped, false)
    assert.ok(["worldbuilding", "character", "plot"].includes(discussionResponse.payload.discussion.target.kind))
    assert.ok(String(discussionResponse.payload.discussion.target.assetPath || "").startsWith(".ai-novel/"))

    let statusResponse = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId })
    assert.equal(statusResponse.status, 200)
    assert.equal(statusResponse.payload.state.runtime.stage, "worldbuilding_dialogue")

    while (statusResponse.payload.state.runtime.stage !== "chapter_task_generation") {
      const advanceResponse = await handleNovelStudioApi(tempDir, "POST", "/api/advance", { projectId }, { projectId })
      assert.equal(advanceResponse.status, 200)
      statusResponse = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId })
      assert.equal(statusResponse.status, 200)
    }

    const storyApproval = await handleNovelStudioApi(tempDir, "POST", "/api/production/story-foundation/approve", {
      projectId,
      note: "世界观、人物关系、情节主线、伏笔账本与执行计划均可进入正文生产。",
    }, { projectId })
    assert.equal(storyApproval.status, 200)
    assert.equal(storyApproval.payload.storyFoundationApproval.approved, true)

    let readinessStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId })
    assert.equal(readinessStatus.status, 200)
    if (readinessStatus.payload.productionReadiness.canProceed !== true) {
      const blockedItems = readinessStatus.payload.productionReadiness.items
        .filter((item) => item.status !== "passed")
        .map((item) => `${item.key}:${item.status}`)
      assert.fail(`production readiness still blocked after style/story approval: issues=${JSON.stringify(
        readinessStatus.payload.productionReadiness.issues.map((issue) => issue.code),
      )}; items=${blockedItems.join(",")}`)
    }
    assert.equal(readinessStatus.payload.productionReadiness.canProceed, true)
    assert.equal(readinessStatus.payload.productionReadiness.status, "passed")

    const maxSteps = 32
    for (let step = 0; step < maxSteps && readinessStatus.payload.state.runtime.stage !== "complete"; step += 1) {
      const advanceResponse = await handleNovelStudioApi(tempDir, "POST", "/api/advance", { projectId }, { projectId })
      assert.equal(advanceResponse.status, 200)
      readinessStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId })
      assert.equal(readinessStatus.status, 200)
    }

    assert.equal(readinessStatus.payload.state.runtime.stage, "complete")
    assert.equal(readinessStatus.payload.state.plan.pendingChapters, 0)
    assert.equal(readinessStatus.payload.state.plan.chapterTasks.filter((task) => task.status === "complete").length, 3)
    assert.equal(readinessStatus.payload.state.plan.chapterTasks.filter((task) => task.status === "blocked").length, 0)

    const projectRoot = path.join(tempDir, ".ai-novel-projects", projectId)
    const finalChapterPath = path.join(projectRoot, ".ai-novel", "chapters", "chapter-001.final.md")
    const finalChapter = await fs.readFile(finalChapterPath, "utf8")
    assert.match(finalChapter, /Final Body/)

    const readerSnapshot = await handleNovelStudioApi(
      tempDir,
      "GET",
      `/api/reader-snapshot?projectId=${encodeURIComponent(projectId)}`,
      {},
      { projectId },
    )
    assert.equal(readerSnapshot.status, 200)
    assert.equal(readerSnapshot.payload.stats.readableChapters, 3)
    assert.equal(readerSnapshot.payload.project.title, "税册风声")
    assert.equal(readerSnapshot.payload.chapters.length, 3)
    assert.ok(readerSnapshot.payload.chapters.every((chapter) => chapter.publishReadiness.ready === true))
    assert.equal(readerSnapshot.payload.lore.storyFoundation.contract.genre.readerPromise, "设定清晰、人物承压、情节持续钩住读者")

    const readerChapter = await handleNovelStudioApi(
      tempDir,
      "GET",
      `/api/reader-chapter?projectId=${encodeURIComponent(projectId)}&chapterNumber=1`,
      {},
      { projectId },
    )
    assert.equal(readerChapter.status, 200)
    assert.ok(readerChapter.payload.chapter.body.trim().length > 0)
    assert.doesNotMatch(readerChapter.payload.chapter.body, /Quality Gate|Naturalness Report|Drafting Metadata/)

    const searchResponse = await handleNovelStudioApi(
      tempDir,
      "GET",
      `/api/reader-search?projectId=${encodeURIComponent(projectId)}&query=${encodeURIComponent("Quality Gate")}`,
      {},
      { projectId },
    )
    assert.equal(searchResponse.status, 200)
    assert.equal(searchResponse.payload.results.length, 0)

    const finalStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId })
    assert.equal(finalStatus.status, 200)
    assert.ok(finalStatus.payload.factorySnapshot.latestEvents.some((event) => event.type === "PROJECT_CREATED"))
    assert.ok(finalStatus.payload.factorySnapshot.latestEvents.some((event) => event.type === "CONSENSUS_UPDATED"))
    assert.ok(finalStatus.payload.factorySnapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_COMPLETED"))
    assert.equal(finalStatus.payload.factorySnapshot.activeJobs.length, 0)
    assert.equal(finalStatus.payload.factorySnapshot.runnableJobs.length, 0)

    assert.ok(responsesHit >= 3)
    assert.equal(receivedBodies[0].model, "gpt-5.5")
    assert.ok(receivedBodies.every((body) => body.model === "gpt-5.5"))
    const finalConfigResponse = await handleNovelStudioApi(tempDir, "GET", "/api/llm-configs", {}, { projectId })
    assert.equal(finalConfigResponse.status, 200)
    assert.ok(finalConfigResponse.payload.configs.some((config) => config.model_name === "acceptance-model"))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    if (aigcServer) {
      await new Promise((resolve) => aigcServer.close(resolve))
    }
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
    if (previousAigcProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousAigcProvider
    if (previousAigcUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousAigcUrl
    if (previousAigcThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousAigcThreshold
  }
})
