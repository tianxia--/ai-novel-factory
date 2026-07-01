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
const managedProjectsSegment = `${path.sep}.ai-novel-projects${path.sep}`

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

async function loadStudioServer() {
  return import(`${pathToFileURL(studioServerEntry).href}?ts=${Date.now()}`)
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve))
}

async function readBody(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString("utf8")
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

function inferFactoryRoot(rootDir) {
  const resolved = path.resolve(rootDir)
  const index = resolved.indexOf(managedProjectsSegment)
  return index >= 0 ? resolved.slice(0, index) || path.parse(resolved).root : resolved
}

test("style freeze advice parser repairs trailing unclosed array string", async () => {
  const { parseStyleFreezeAdviceFromText } = await loadCore()
  const parsed = parseStyleFreezeAdviceFromText(`{
    "freezeVerdict": "continue",
    "freezeSummary": "样段已接近冻结，场景压力和人物语气稳定，但仍需压低判题说明。",
    "blockingReasons": ["仍有“本该有报字”替读污损内容。"],
    "contractAdjustments": ["污损只写残笔、格位、停顿、改口。"],
    "forbiddenPatterns": ["“本该有某字”式替读污损。"],
    "positiveExamples": ["“停笔。”", "“照例留格。”", "“抄手的笔悬在空白上方。],
    "inheritedRules": ["压力必须由报读、废页、留格推进。"]
  }`)
  assert.ok(parsed)
  assert.equal(parsed.freezeVerdict, "continue")
  assert.match(parsed.freezeSummary, /判题说明/)
  assert.ok(parsed.positiveExamples.some((item) => /抄手的笔悬/.test(item)))
})

async function writeAigcDetectorSettings(rootDir, detectorUrl, options = {}) {
  const { withFactoryDb } = await loadCore()
  await withFactoryDb(inferFactoryRoot(rootDir), async (db) => {
    db.setSystemSetting("aigcDetectorProvider", options.provider || "generic-json")
    if (detectorUrl !== undefined) {
      db.setSystemSetting("aigcDetectorUrl", detectorUrl)
    }
    db.setSystemSetting("aigcDetectorThreshold", options.threshold || "0.8")
  })
}

test("style evolution loop prefers structured llm critic output before heuristic fallback", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-loop-critic-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let responsesHit = 0
  const receivedBodies = []
  let aigcServer = null
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        responsesHit += 1
        const body = JSON.parse(rawBody)
        receivedBodies.push(body)
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: responsesHit === 1
            ? "雨丝压在门槛外。沈砚把缺页账本推到灯下，没有立刻发问，只先看纸边被谁裁得过于整齐。"
            : responsesHit === 2
              ? JSON.stringify({
                  evaluation: {
                    verdict: "candidate",
                    summary: "结构化 evaluator 认为当前样段已有可用基底。",
                    scores: {
                      narrativeVoice: 8.3,
                      sentenceRhythm: 8.1,
                      dialogueTexture: 7.4,
                      informationDensity: 8.0,
                      emotionalTension: 7.8,
                      readability: 8.2,
                      requirementAlignment: 8.1,
                      forbiddenPatternRisk: 1.1,
                      overall: 8.2,
                    },
                    strengths: ["声音稳定，物件压力足够。"],
                    deviations: ["对白仍可继续收短。"],
                    forbiddenHits: [],
                    nextFocus: ["继续压缩对白。"],
                  },
                })
              : responsesHit === 3
                ? JSON.stringify({
                    refinement: {
                      summary: "结构化 refiner 建议继续收紧对白和停顿。",
                      promptAdjustments: ["对白必须更短，留出停顿。"],
                      contractAdjustments: ["冻结前继续强调对白短句与停顿。"],
                      nextPrompt: "继续压缩对白，让停顿承担权力压力。",
                    },
                  })
                : JSON.stringify({
                    freezeSummary: "当前样段已有冻结潜力，但还需最后一轮收紧。",
                    contractAdjustments: ["冻结前继续强调对白短句与停顿。"],
                    forbiddenPatterns: ["解释创作意图"],
                    positiveExamples: ["沈砚合上账册，只问一句：谁动过这一页？"],
                    inheritedRules: ["章节正文保持短对白和动作推进。"],
                  }),
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  const previousProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousUrl = process.env.AIGC_DETECTOR_URL
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD

  try {
    const address = await listen(server)
    aigcServer = http.createServer(async (request, response) => {
      await readBody(request)
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
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)

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
    assert.match(generateResponse.payload.loopIteration.refinement.nextPrompt, /对白必须更短|继续压缩对白/)
    assert.ok(Array.isArray(generateResponse.payload.styleEvolution.contract.loop.convergenceEvidence))
    assert.ok(Number(generateResponse.payload.styleEvolution.contract.loop.tighteningCount || 0) >= 1)
    assert.ok(Array.isArray(generateResponse.payload.styleEvolution.contract.evolutionHistory[0].contractTightening))
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].freezerSource, "llm_critic")
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].evaluationSource, "llm_critic")
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].refinementSource, "llm_critic")
    assert.equal(generateResponse.payload.loopIteration.candidates[0].llmFallbackUsed, false)
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].llmFallbackUsed, false)
    assert.equal(generateResponse.payload.styleEvolution.contract.evolutionHistory[0].llmFallbackUsed, false)
  } finally {
    await close(server)
    if (aigcServer) {
      await close(aigcServer)
    }
    if (previousProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousProvider
    if (previousUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousUrl
    if (previousThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
  }
})

test("style evolution loop marks llm fallback when refiner and combined critic fail", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-loop-fallback-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let responsesHit = 0
  let aigcServer = null
  const server = http.createServer(async (request, response) => {
    const rawBody = await readBody(request)
    if (request.url === "/responses") {
      responsesHit += 1
      JSON.parse(rawBody)
      if (responsesHit === 1) {
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
        }))
        return
      }
      if (responsesHit === 2) {
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: JSON.stringify({
            evaluation: {
              verdict: "approve",
              summary: "结构化 evaluator 认为当前样段可以进入确认。",
              scores: {
                narrativeVoice: 9,
                sentenceRhythm: 9,
                dialogueTexture: 9,
                informationDensity: 9,
                emotionalTension: 9,
                readability: 9,
                requirementAlignment: 9,
                forbiddenPatternRisk: 0.4,
                overall: 9,
              },
              strengths: ["动作和物件推进稳定。"],
              deviations: [],
              forbiddenHits: [],
              nextFocus: ["保持短对白。"],
            },
          }),
        }))
        return
      }
      response.writeHead(504, { "content-type": "text/plain" })
      response.end("Gateway Timeout")
      return
    }
    response.writeHead(404).end()
  })

  const previousProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousUrl = process.env.AIGC_DETECTOR_URL
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD

  try {
    const address = await listen(server)
    aigcServer = http.createServer(async (request, response) => {
      await readBody(request)
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
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Fallback Loop Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "fallback-loop-model",
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
    assert.ok(responsesHit >= 3)
    assert.equal(generateResponse.payload.loopIteration.candidates[0].llmFallbackUsed, true)
    assert.equal(generateResponse.payload.loopIteration.candidates[0].freezer.source, "heuristic")
    assert.ok(generateResponse.payload.loopIteration.candidates[0].fallbackReasons.some((reason) => /split_chain_failed/.test(reason)))
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].llmFallbackUsed, true)
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].freezerSource, "heuristic")
    assert.equal(generateResponse.payload.styleEvolution.contract.evolutionHistory[0].llmFallbackUsed, true)
  } finally {
    await close(server)
    if (aigcServer) {
      await close(aigcServer)
    }
    if (previousProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousProvider
    if (previousUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousUrl
    if (previousThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
  }
})

test("style evolution keeps AIGC verification attached when structured evaluator output replaces heuristic evaluation", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-loop-aigc-"))
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

  const previousProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousUrl = process.env.AIGC_DETECTOR_URL
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD

  try {
    const llmAddress = await listen(llmServer)
    const aigcAddress = await listen(aigcServer)

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)

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
    const blockedCandidate = generateResponse.payload.loopRun.iterations[0].candidates[0]
    assert.equal(blockedCandidate.evaluation.source, "llm_critic")
    assert.equal(blockedCandidate.evaluation.aigc.status, "blocked")
    assert.ok(blockedCandidate.evaluation.aigc.highRiskCount >= 1)
    assert.match(blockedCandidate.evaluation.aigc.reason, /segment|AIGC/i)
    assert.equal(blockedCandidate.verification.status, "blocked")
    assert.match(blockedCandidate.verification.summary, /Generation Verification Gate/)
    assert.ok(Array.isArray(blockedCandidate.verification.reasons))
    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.verificationGate, "Generation Verification Gate")
    assert.equal(generateResponse.payload.styleEvolution.freezeLedger.verificationGate, "Generation Verification Gate")
    assert.equal(blockedCandidate.evaluation.verdict, "approve")
    assert.equal(generateResponse.payload.styleEvolution.contract.evolutionHistory.length, 0)
    assert.equal(generateResponse.payload.loopRun.stopReason, "style_candidates_all_blocked")
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
    assert.equal(approveResponse.status, 400)
    assert.equal(approveResponse.payload.error, "style_candidate_not_found")
  } finally {
    await close(llmServer)
    await close(aigcServer)
    if (previousProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousProvider
    if (previousUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousUrl
    if (previousThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
  }
})

test("style evolution loop reads AIGC detector config from the managed project root", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-loop-project-env-aigc-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let llmHits = 0
  let aigcHits = 0
  const llmServer = http.createServer((request, response) => {
    request.on("data", () => {})
    request.on("end", () => {
      if (request.url === "/responses") {
        llmHits += 1
        const outputs = [
          "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
          JSON.stringify({
            evaluation: {
              verdict: "candidate",
              summary: "项目级 AIGC 配置已参与评估。",
              scores: {
                narrativeVoice: 8.2,
                sentenceRhythm: 8.1,
                dialogueTexture: 7.8,
                informationDensity: 8.0,
                emotionalTension: 8.0,
                readability: 8.2,
                requirementAlignment: 8.1,
                forbiddenPatternRisk: 0.8,
                overall: 8.2,
              },
              strengths: ["动作和物件推进明确。"],
              deviations: ["可以继续收紧对白。"],
              forbiddenHits: [],
              nextFocus: ["对白更短。"],
            },
          }),
          JSON.stringify({
            refinement: {
              summary: "继续收紧对白。",
              promptAdjustments: ["对白更短。"],
              contractAdjustments: ["短对白继续强化。"],
              nextPrompt: "继续使用短对白和物件推进。",
            },
          }),
          JSON.stringify({
            freezeSummary: "当前候选可继续靠近冻结。",
            contractAdjustments: ["保持短对白。"],
            forbiddenPatterns: ["解释创作意图"],
            positiveExamples: ["老周的手缩进袖口，没有接。"],
            inheritedRules: ["正文保持短对白和动作推进。"],
          }),
        ]
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ output_text: outputs[llmHits - 1] || outputs.at(-1) }))
        return
      }
      response.writeHead(404).end()
    })
  })
  const aigcServer = http.createServer(async (_request, response) => {
    aigcHits += 1
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ aiProbability: 0.16, label: "human", confidence: 0.84 }))
  })
  const previousProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousUrl = process.env.AIGC_DETECTOR_URL
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD

  try {
    delete process.env.AIGC_DETECTOR_PROVIDER
    delete process.env.AIGC_DETECTOR_URL
    delete process.env.AIGC_DETECTOR_THRESHOLD
    const llmAddress = await listen(llmServer)
    const aigcAddress = await listen(aigcServer)

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Project Env AIGC Model",
      baseUrl: `http://127.0.0.1:${llmAddress.port}`,
      apiKey: "test-key",
      modelName: "project-env-aigc-model",
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
    assert.ok(aigcHits >= 1)
    assert.equal(generateResponse.payload.loopIteration.evaluation.aigc.status, "passed")
    assert.equal(generateResponse.payload.loopIteration.verification.status, "passed")
    assert.equal(generateResponse.payload.styleEvolution.contract.verification.status, "passed")
  } finally {
    await close(llmServer)
    await close(aigcServer)
    if (previousProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousProvider
    if (previousUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousUrl
    if (previousThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
  }
})

test("style evolution loop surfaces AIGC detector diagnostics when URL is missing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-loop-aigc-diagnostics-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let llmHits = 0
  const llmServer = http.createServer((request, response) => {
    request.on("data", () => {})
    request.on("end", () => {
      if (request.url === "/responses") {
        llmHits += 1
        const outputs = [
          "雨线挂在门槛外。沈砚把缺页账本推到灯下，纸边齐得发亮。老周的手缩进袖口，没有接。",
          JSON.stringify({
            evaluation: {
              verdict: "approve",
              summary: "结构化 evaluator 认为当前样段可以确认。",
              scores: {
                narrativeVoice: 9.0,
                sentenceRhythm: 9.0,
                dialogueTexture: 9.0,
                informationDensity: 9.0,
                emotionalTension: 9.0,
                readability: 9.0,
                requirementAlignment: 9.0,
                forbiddenPatternRisk: 0.3,
                overall: 9.0,
              },
              strengths: ["声音稳定。"],
              deviations: [],
              forbiddenHits: [],
              nextFocus: ["保持动作推进。"],
            },
          }),
          JSON.stringify({
            refinement: {
              summary: "保持当前写法。",
              promptAdjustments: ["继续保持短对白。"],
              contractAdjustments: ["短对白和动作推进可固化。"],
              nextPrompt: "继续保持短对白和动作推进。",
            },
          }),
          JSON.stringify({
            freezeVerdict: "ready",
            freezeSummary: "当前版本可进入冻结确认。",
            blockingReasons: [],
            contractAdjustments: ["保持短对白。"],
            forbiddenPatterns: ["解释创作意图"],
            positiveExamples: ["老周的手缩进袖口，没有接。"],
            inheritedRules: ["正文保持短对白和动作推进。"],
          }),
        ]
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ output_text: outputs[llmHits - 1] || outputs.at(-1) }))
        return
      }
      response.writeHead(404).end()
    })
  })
  const previousProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousUrl = process.env.AIGC_DETECTOR_URL
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD

  try {
    const llmAddress = await listen(llmServer)

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writeAigcDetectorSettings(created.project.projectRoot, undefined)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Missing AIGC URL Model",
      baseUrl: `http://127.0.0.1:${llmAddress.port}`,
      apiKey: "test-key",
      modelName: "missing-aigc-url-model",
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
    const candidate = generateResponse.payload.loopRun.iterations[0].candidates[0]
    assert.equal(candidate.evaluation.aigc.status, "unavailable")
    assert.equal(candidate.evaluation.aigc.provider, "generic-json")
    assert.equal(candidate.evaluation.aigc.urlConfigured, false)
    assert.equal(candidate.verification.status, "blocked")
    assert.match(candidate.verification.reasons.join("\n"), /AIGC detector URL is not configured/)
    assert.match(candidate.verification.reasons.join("\n"), /provider=generic-json/)
    assert.match(candidate.verification.reasons.join("\n"), /urlConfigured=no/)
    assert.equal(generateResponse.payload.styleEvolution.contract.evolutionHistory.length, 0)
  } finally {
    await close(llmServer)
    if (previousProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousProvider
    if (previousUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousUrl
    if (previousThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
  }
})

test("style evolution loop selects verified candidate before higher scoring blocked candidate", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-loop-verified-winner-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let llmHits = 0
  const llmServer = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        llmHits += 1
        const outputs = [
          "模板化的高分样段。所有人物反应都被命运安排直接说明，场景像一段标准生成文本。",
          "雨线挂在门槛外。沈砚把账册推到灯下，只问一句：谁动过这一页？门外那只手先缩回袖口。",
          JSON.stringify({
            evaluation: {
              verdict: "approve",
              summary: "高分但 AIGC 风险阻塞，不应成为 winner。",
              scores: {
                narrativeVoice: 9.5,
                sentenceRhythm: 9.4,
                dialogueTexture: 9.3,
                informationDensity: 9.4,
                emotionalTension: 9.4,
                readability: 9.4,
                requirementAlignment: 9.5,
                forbiddenPatternRisk: 0.3,
                overall: 9.4,
              },
              strengths: ["表面完整。"],
              deviations: ["模板腔明显。"],
              forbiddenHits: [],
              nextFocus: ["去掉模板腔。"],
            },
          }),
          JSON.stringify({
            refinement: {
              summary: "必须降低模板化表达。",
              promptAdjustments: ["去掉命运安排式说明。"],
              contractAdjustments: ["禁止模板腔和解释腔。"],
              nextPrompt: "把冲突落回动作与物件。",
            },
          }),
          JSON.stringify({
            freezeSummary: "高分候选仍需继续修复。",
            contractAdjustments: ["压低模板腔。"],
            forbiddenPatterns: ["模板腔"],
            positiveExamples: [],
            inheritedRules: ["正文不得使用模板化表达。"],
          }),
          JSON.stringify({
            evaluation: {
              verdict: "candidate",
              summary: "分数略低但验证通过，应成为 winner。",
              scores: {
                narrativeVoice: 8.5,
                sentenceRhythm: 8.3,
                dialogueTexture: 8.1,
                informationDensity: 8.2,
                emotionalTension: 8.3,
                readability: 8.4,
                requirementAlignment: 8.5,
                forbiddenPatternRisk: 0.8,
                overall: 8.4,
              },
              strengths: ["动作与对白更自然。"],
              deviations: ["可以继续收紧钩子。"],
              forbiddenHits: [],
              nextFocus: ["结尾钩子再短。"],
            },
          }),
          JSON.stringify({
            refinement: {
              summary: "保留自然动作和短对白。",
              promptAdjustments: ["继续用动作推进。"],
              contractAdjustments: ["对白短，动作先行。"],
              nextPrompt: "保持冷感白描，用动作推进冲突。",
            },
          }),
          JSON.stringify({
            freezeSummary: "验证通过候选可继续靠近冻结。",
            contractAdjustments: ["保持短对白。"],
            forbiddenPatterns: ["解释创作意图"],
            positiveExamples: ["沈砚把账册推到灯下，只问一句：谁动过这一页？"],
            inheritedRules: ["正文保持短对白和动作推进。"],
          }),
        ]
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ output_text: outputs[llmHits - 1] || outputs.at(-1) }))
        return
      }
      response.writeHead(404).end()
    })
  })
  const aigcServer = http.createServer(async (request, response) => {
    const body = JSON.parse(await readBody(request))
    const text = String(body.text || "")
    const blocked = text.includes("模板化") || text.includes("标准生成")
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({
      aiProbability: blocked ? 0.94 : 0.18,
      label: blocked ? "疑似AI生成" : "human",
    }))
  })

  const previousProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousUrl = process.env.AIGC_DETECTOR_URL
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD

  try {
    const llmAddress = await listen(llmServer)
    const aigcAddress = await listen(aigcServer)

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Verified Winner Model",
      baseUrl: `http://127.0.0.1:${llmAddress.port}`,
      apiKey: "test-key",
      modelName: "verified-winner-model",
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
	    assert.equal(generateResponse.payload.generatedCandidate.candidateIndex, 2)
	    assert.match(generateResponse.payload.generatedCandidate.sample, /雨线挂在门槛外/)
	    assert.equal(generateResponse.payload.loopIteration.verification.status, "passed")
	    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].candidateIndex, 2)
	    assert.equal(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].candidates[0].persistedVersion, 1)
	    assert.equal(generateResponse.payload.loopIteration.candidates[0].persistedVersion, 1)
	    assert.match(generateResponse.payload.styleEvolution.loopRuntime.iterations[0].winningReason, /通过 Generation Verification Gate/)
    assert.deepEqual(
      generateResponse.payload.styleEvolution.loopRuntime.iterations[0].candidateScores.map((entry) => ({
        candidateIndex: entry.candidateIndex,
        verificationStatus: entry.verificationStatus,
      })),
      [
        { candidateIndex: 2, verificationStatus: "passed" },
        { candidateIndex: 1, verificationStatus: "blocked" },
      ],
    )
  } finally {
    await close(llmServer)
    await close(aigcServer)
    if (previousProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousProvider
    if (previousUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousUrl
    if (previousThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
  }
})

test("style evolution loop does not persist a winner when every candidate is blocked", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-loop-all-blocked-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let llmHits = 0
  const llmServer = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        llmHits += 1
        const outputs = [
          "模板化的一号候选。人物反应被命运安排直接说明，所有冲突都像标准生成文本。",
          "模板化的二号候选。人物反应继续被概括，场景仍然像标准生成文本。",
          JSON.stringify({
            evaluation: {
              verdict: "approve",
              summary: "高分但 AIGC 风险阻塞。",
              scores: {
                narrativeVoice: 9.1,
                sentenceRhythm: 9.1,
                dialogueTexture: 9.1,
                informationDensity: 9.1,
                emotionalTension: 9.1,
                readability: 9.1,
                requirementAlignment: 9.1,
                forbiddenPatternRisk: 0.2,
                overall: 9.1,
              },
              strengths: ["表面完整。"],
              deviations: ["模板化明显。"],
              forbiddenHits: [],
              nextFocus: ["去掉模板化表达。"],
            },
          }),
          JSON.stringify({
            refinement: {
              summary: "继续压制模板腔。",
              promptAdjustments: ["减少概括。"],
              contractAdjustments: ["禁止模板腔。"],
              nextPrompt: "把冲突落回具体动作。",
            },
          }),
          JSON.stringify({
            freezeSummary: "不能冻结。",
            contractAdjustments: ["继续去模板化。"],
            forbiddenPatterns: ["模板腔"],
            positiveExamples: [],
            inheritedRules: ["正文不得使用模板化表达。"],
          }),
          JSON.stringify({
            evaluation: {
              verdict: "candidate",
              summary: "稍低分但仍被 AIGC 阻塞。",
              scores: {
                narrativeVoice: 8.5,
                sentenceRhythm: 8.5,
                dialogueTexture: 8.5,
                informationDensity: 8.5,
                emotionalTension: 8.5,
                readability: 8.5,
                requirementAlignment: 8.5,
                forbiddenPatternRisk: 0.6,
                overall: 8.5,
              },
              strengths: ["略有动作。"],
              deviations: ["仍像标准生成文本。"],
              forbiddenHits: [],
              nextFocus: ["继续具体化动作。"],
            },
          }),
          JSON.stringify({
            refinement: {
              summary: "继续重写。",
              promptAdjustments: ["减少抽象词。"],
              contractAdjustments: ["动作先行。"],
              nextPrompt: "动作先行，减少概括。",
            },
          }),
          JSON.stringify({
            freezeSummary: "不能冻结。",
            contractAdjustments: ["去掉标准生成腔。"],
            forbiddenPatterns: ["标准生成文本"],
            positiveExamples: [],
            inheritedRules: ["正文必须有具体动作。"],
          }),
        ]
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({ output_text: outputs[llmHits - 1] || outputs.at(-1) }))
        return
      }
      response.writeHead(404).end()
    })
  })
  const aigcServer = http.createServer(async (request, response) => {
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ aiProbability: 0.94, label: "疑似AI生成" }))
  })
  const previousProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousUrl = process.env.AIGC_DETECTOR_URL
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD

  try {
    const llmAddress = await listen(llmServer)
    const aigcAddress = await listen(aigcServer)

    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "一名审雨官发现降雨记录被篡改",
      title: "雨账",
      totalChapters: 12,
      chapterWordTarget: 2500,
    })
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)
    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Blocked Winner Model",
      baseUrl: `http://127.0.0.1:${llmAddress.port}`,
      apiKey: "test-key",
      modelName: "blocked-winner-model",
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

    assert.equal(generateResponse.status, 409)
    assert.equal(generateResponse.payload.error, "style_candidates_all_blocked")
	    assert.equal(generateResponse.payload.loopRun.stopReason, "style_candidates_all_blocked")
	    assert.equal(generateResponse.payload.styleEvolution.contract.evolutionHistory.length, 0)
    assert.equal(generateResponse.payload.loopRun.iterations[0].candidateScores.length, 2)
    assert.equal(generateResponse.payload.loopRun.iterations[0].candidates.some((entry) => entry.persistedVersion), false)
    assert.ok(generateResponse.payload.loopRun.iterations[0].candidateScores.every((entry) => entry.verificationStatus === "blocked"))
    const loopRunsLedger = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "style", "evolution", "style-loop-runs.jsonl"),
      "utf8",
    )
    const ledgerRows = loopRunsLedger.trim().split("\n").map((line) => JSON.parse(line))
    assert.equal(ledgerRows.length, 1)
    assert.equal(ledgerRows[0].stopReason, "style_candidates_all_blocked")
    assert.equal(ledgerRows[0].iterations[0].candidates.length, 2)
    assert.ok(ledgerRows[0].iterations[0].candidates.every((entry) => entry.verification.status === "blocked"))
  } finally {
    await close(llmServer)
    await close(aigcServer)
    if (previousProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousProvider
    if (previousUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousUrl
    if (previousThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
  }
})

test("style evolution carries structured seed protocol into contract persistence and live llm prompts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-style-loop-seed-protocol-"))
  const { createManagedAutonomousProject } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()
  let responsesHit = 0
  const receivedBodies = []
  let aigcServer = null
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      if (request.url === "/responses") {
        responsesHit += 1
        const body = JSON.parse(rawBody)
        receivedBodies.push(body)
        response.writeHead(200, { "content-type": "application/json" })
        response.end(JSON.stringify({
          output_text: responsesHit === 1
            ? "冷雨沿着排水沟往回涌。沈砚没看门口的人，只先把账本翻到被裁短的那一页，指腹在毛边上停了一瞬。"
            : responsesHit === 2
              ? JSON.stringify({
                  evaluation: {
                    verdict: "candidate",
                    summary: "当前样段已经抓到冷感、克制和压迫式对白的方向。",
                    scores: {
                      narrativeVoice: 8.5,
                      sentenceRhythm: 8.2,
                      dialogueTexture: 7.6,
                      informationDensity: 8.0,
                      emotionalTension: 8.1,
                      readability: 8.0,
                      requirementAlignment: 8.4,
                      forbiddenPatternRisk: 1.0,
                      overall: 8.3,
                    },
                    strengths: ["物件压力和动作顺序都比较清楚。"],
                    deviations: ["对白还可以再短。"],
                    forbiddenHits: [],
                    nextFocus: ["继续缩短对白。"],
                  },
                })
              : responsesHit === 3
                ? JSON.stringify({
                    refinement: {
                      summary: "下一轮继续压缩对白，把压力更多交给停顿和动作。",
                      promptAdjustments: ["对白每次只保留必要信息。"],
                      contractAdjustments: ["冻结前继续强调短对白与压迫停顿。"],
                      nextPrompt: "对白更短，动作更硬，停顿承担威压。",
                    },
                  })
                : JSON.stringify({
                    freezeSummary: "当前版本已接近整书写法合同，可以再收一轮后冻结。",
                    contractAdjustments: ["继续收紧对白长度。"],
                    forbiddenPatterns: ["解释创作意图"],
                    positiveExamples: ["沈砚没有抬头，只把那页纸往灯下推近半寸。"],
                    inheritedRules: ["正文优先用动作和物件推进张力。"],
                  }),
        }))
        return
      }
      response.writeHead(404).end()
    })
  })

  const previousProvider = process.env.AIGC_DETECTOR_PROVIDER
  const previousUrl = process.env.AIGC_DETECTOR_URL
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD

  try {
    const address = await listen(server)
    aigcServer = http.createServer(async (request, response) => {
      await readBody(request)
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
    await writeAigcDetectorSettings(created.project.projectRoot, `http://127.0.0.1:${aigcAddress.port}/detect`)

    const configResponse = await handleNovelStudioApi(tempDir, "POST", "/api/llm-configs", {
      name: "Seed Protocol Model",
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "seed-protocol-model",
      apiMode: "responses",
      timeoutMs: 1000,
    })
    assert.equal(configResponse.status, 200)

    const initResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/init", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      referenceText: "参考文本强调潮湿、迟疑和物件压迫，不直接解释人物心理。",
      referenceWorks: ["漫长的季节", "白夜行"],
      desiredVibes: ["冷感", "潮湿感", "压迫感"],
      seedForbiddenPatterns: ["不要解释创作意图", "不要鸡汤总结", "不要同质化对白"],
    }, { projectId: created.project.id })

    assert.equal(initResponse.status, 200)
    assert.deepEqual(initResponse.payload.styleEvolution.contract.referenceWorks, ["漫长的季节", "白夜行"])
    assert.deepEqual(initResponse.payload.styleEvolution.contract.desiredVibes, ["冷感", "潮湿感", "压迫感"])
    assert.deepEqual(initResponse.payload.styleEvolution.contract.seedForbiddenPatterns, ["不要解释创作意图", "不要鸡汤总结", "不要同质化对白"])

    const generateResponse = await handleNovelStudioApi(tempDir, "POST", "/api/style-evolution/generate-candidate", {
      projectId: created.project.id,
      userStylePrompt: "克制、冷感、白描，动作和物件推动悬疑。",
      referenceText: "参考文本强调潮湿、迟疑和物件压迫，不直接解释人物心理。",
      referenceWorks: ["漫长的季节", "白夜行"],
      desiredVibes: ["冷感", "潮湿感", "压迫感"],
      seedForbiddenPatterns: ["不要解释创作意图", "不要鸡汤总结", "不要同质化对白"],
      loopIterations: 1,
    }, { projectId: created.project.id })

    assert.equal(generateResponse.status, 200)
    assert.equal(responsesHit, 4)
    assert.deepEqual(generateResponse.payload.styleEvolution.contract.referenceWorks, ["漫长的季节", "白夜行"])
    assert.deepEqual(generateResponse.payload.styleEvolution.contract.desiredVibes, ["冷感", "潮湿感", "压迫感"])
    assert.deepEqual(generateResponse.payload.styleEvolution.contract.seedForbiddenPatterns, ["不要解释创作意图", "不要鸡汤总结", "不要同质化对白"])
    assert.deepEqual(generateResponse.payload.styleEvolution.loopRuntime.referenceWorks, ["漫长的季节", "白夜行"])
    assert.deepEqual(generateResponse.payload.styleEvolution.loopRuntime.desiredVibes, ["冷感", "潮湿感", "压迫感"])
    assert.deepEqual(generateResponse.payload.styleEvolution.loopRuntime.seedForbiddenPatterns, ["不要解释创作意图", "不要鸡汤总结", "不要同质化对白"])

    const firstRequestText = JSON.stringify(receivedBodies[0])
    const criticRequestText = JSON.stringify(receivedBodies[1])
    const refinerRequestText = JSON.stringify(receivedBodies[2])
    const freezerRequestText = JSON.stringify(receivedBodies[3])
    assert.match(firstRequestText, /漫长的季节/)
    assert.match(firstRequestText, /白夜行/)
    assert.match(firstRequestText, /潮湿感/)
    assert.match(firstRequestText, /不要同质化对白/)
    assert.match(firstRequestText, /参考文本强调潮湿、迟疑和物件压迫/)
    assert.match(criticRequestText, /漫长的季节/)
    assert.match(criticRequestText, /潮湿感/)
    assert.match(criticRequestText, /不要鸡汤总结/)
    assert.match(refinerRequestText, /白夜行/)
    assert.match(refinerRequestText, /不要解释创作意图/)
    assert.match(freezerRequestText, /漫长的季节/)
    assert.match(freezerRequestText, /压迫感/)
  } finally {
    await close(server)
    if (aigcServer) {
      await close(aigcServer)
    }
    if (previousProvider === undefined) delete process.env.AIGC_DETECTOR_PROVIDER
    else process.env.AIGC_DETECTOR_PROVIDER = previousProvider
    if (previousUrl === undefined) delete process.env.AIGC_DETECTOR_URL
    else process.env.AIGC_DETECTOR_URL = previousUrl
    if (previousThreshold === undefined) delete process.env.AIGC_DETECTOR_THRESHOLD
    else process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
  }
})

test("approved writing style carryover includes generation verification gate results for chapter drafting", async () => {
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
    approval: {
      acceptedAsBookStyle: true,
      approvedVersion: 2,
      freezeSummary: "用户确认当前版本可作为全书基础写法。",
    },
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
    loop: {
      stableVersion: 2,
      stableRounds: 2,
      stabilityReasons: ["最近 2 轮综合评分保持在 8.4-8.5，漂移仅 0.1。"],
    },
    retryPolicy: {
      approvalScoreThreshold: 8.6,
      approvalMinRounds: 2,
      maxForbiddenHitCount: 1,
    },
    styleContract: {
      voice: "模型提炼：克制冷感、白描推进、以物件和动作压住悬疑。",
      sentenceRhythm: "短句为主，少量中句承接动作后果。",
      dialogueRules: ["对白短，带压力，不解释背景。"],
      forbiddenPatterns: ["解释创作意图", "总结式升华", "同质化对白"],
      positiveExamples: ["沈砚合上账册，只问了一句：谁动过这一页？"],
    },
    antiPatterns: ["模板腔", "解释腔"],
    inheritance: {
      inheritedArtifacts: ["base writing prompt", "style contract", "forbidden patterns"],
      inheritedRules: ["后续每章必须继承用户冻结后的 base writing prompt。"],
    },
  })

  assert.match(prompt, /Verification gate: Generation Verification Gate/)
  assert.match(prompt, /Verification summary:/)
  assert.match(prompt, /Verification status: blocked/)
  assert.match(prompt, /AIGC verification score: 0\.930/)
  assert.match(prompt, /High risk segments before freeze: 2/)
})
