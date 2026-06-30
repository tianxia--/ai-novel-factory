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

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve)
    server.once("error", reject)
  })
  const address = server.address()
  assert.ok(address && typeof address === "object")
  return `http://127.0.0.1:${address.port}`
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

test("aigc detector stays unavailable when disabled", async () => {
  const { detectAigcText } = await loadCore()
  const result = await detectAigcText("这是一段用于检测的正文。", { provider: "disabled" })

  assert.equal(result.ok, false)
  assert.equal(result.status, "unavailable")
  assert.equal(result.provider, "disabled")
})

test("aigc detector reads project .env configuration with process overrides", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-aigc-env-"))
  await fs.writeFile(path.join(tempDir, ".env"), [
    "AIGC_DETECTOR_PROVIDER=generic-json",
    "AIGC_DETECTOR_URL=http://127.0.0.1:8765/detect",
    "AIGC_DETECTOR_THRESHOLD=0.7",
    "AIGC_DETECTOR_SEGMENT_MAX_CHARS=700",
    "",
  ].join("\n"))
  const previousThreshold = process.env.AIGC_DETECTOR_THRESHOLD
  process.env.AIGC_DETECTOR_THRESHOLD = "0.9"

  try {
    const { getAigcDetectorConfig } = await loadCore()
    const config = getAigcDetectorConfig(tempDir)

    assert.equal(config.provider, "generic-json")
    assert.equal(config.url, "http://127.0.0.1:8765/detect")
    assert.equal(config.threshold, 0.9)
    assert.equal(config.segment.maxChars, 700)
  } finally {
    if (previousThreshold === undefined) {
      delete process.env.AIGC_DETECTOR_THRESHOLD
    } else {
      process.env.AIGC_DETECTOR_THRESHOLD = previousThreshold
    }
  }
})


test("aigc detector normalizes a generic json detector response", async () => {
  let receivedBody = ""
  const server = http.createServer(async (request, response) => {
    receivedBody = await readBody(request)
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({ aiProbability: 0.92, label: "AI generated", confidence: 0.88 }))
  })
  const baseUrl = await listen(server)

  try {
    const { detectAigcText } = await loadCore()
    const result = await detectAigcText("他推开门，看见雨水沿着瓦檐往下落。", {
      provider: "generic-json",
      url: `${baseUrl}/detect`,
      threshold: 0.8,
    })

    assert.equal(JSON.parse(receivedBody).text, "他推开门，看见雨水沿着瓦檐往下落。")
    assert.equal(result.ok, true)
    assert.equal(result.status, "ai_likely")
    assert.equal(result.score, 0.92)
    assert.equal(result.confidence, 0.88)
  } finally {
    await close(server)
  }
})

test("aigc detector splits long fiction text and reports risky segments", async () => {
  const requestedTexts = []
  const server = http.createServer(async (request, response) => {
    const body = JSON.parse(await readBody(request))
    requestedTexts.push(body.text)
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({
      aiProbability: body.text.includes("模板化") ? 0.91 : 0.18,
      label: body.text.includes("模板化") ? "疑似AI生成" : "人类写作",
    }))
  })
  const baseUrl = await listen(server)

  try {
    const { detectAigcSegments } = await loadCore()
    const result = await detectAigcSegments(
      [
        "她在巷口停了很久，直到卖糖人的老人收起最后一盏灯。她没有立刻回头，只把手指抵在袖口，摸到那枚被汗水浸热的铜钱。风从河面卷过来，带着湿木头和旧纸灰的气味。",
        "这是一段模板化表达，角色缺少具体动作，情绪被概括性词汇直接说明。所有冲突都被总结为命运的安排，所有人物都在宏大叙事里重复相同的判断，没有细节，没有停顿，也没有真实的身体反应。",
        "雨停以后，青石板缝里浮出一点泥腥气，她才想起袖口还藏着那枚铜钱。远处更夫敲了两下，她忽然明白自己已经错过了约定的时辰。",
      ].join("\n\n"),
      {
        provider: "generic-json",
        url: `${baseUrl}/detect`,
        threshold: 0.8,
        segment: { maxChars: 120, minChars: 40 },
      },
    )

    assert.ok(requestedTexts.length > 1)
    assert.equal(result.ok, true)
    assert.equal(result.totalSegments, requestedTexts.length)
    assert.equal(result.highRiskSegments.length, 1)
    assert.match(result.highRiskSegments[0].segment.text, /模板化/)
  } finally {
    await close(server)
  }
})

test("aigc detector reads gradio queue server sent events", async () => {
  let joinPayload = null
  const server = http.createServer(async (request, response) => {
    if (request.url?.startsWith("/gradio_api/queue/join")) {
      joinPayload = JSON.parse(await readBody(request))
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ event_id: "event-1" }))
      return
    }
    if (request.url?.startsWith("/gradio_api/queue/data")) {
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.end([
        "event: generating",
        "data: {\"msg\":\"process_starts\"}",
        "",
        "event: complete",
        "data: {\"msg\":\"process_completed\",\"output\":{\"data\":[{\"aiProbability\":0.87,\"label\":\"疑似AI生成\"}]}}",
        "",
      ].join("\n"))
      return
    }
    response.writeHead(404)
    response.end()
  })
  const baseUrl = await listen(server)

  try {
    const { detectAigcText } = await loadCore()
    const result = await detectAigcText("这段文字需要通过 Gradio 队列检测。", {
      provider: "gradio-queue",
      url: baseUrl,
      threshold: 0.8,
      gradio: {
        fnIndex: 2,
        sessionHash: "test-session",
      },
    })

    assert.equal(joinPayload.fn_index, 2)
    assert.equal(joinPayload.session_hash, "test-session")
    assert.deepEqual(joinPayload.data, ["这段文字需要通过 Gradio 队列检测。"])
    assert.equal(result.ok, true)
    assert.equal(result.status, "ai_likely")
    assert.equal(result.score, 0.87)
  } finally {
    await close(server)
  }
})

test("studio api exposes low-coupling segmented aigc detection", async () => {
  const requestedTexts = []
  const server = http.createServer(async (request, response) => {
    const body = JSON.parse(await readBody(request))
    requestedTexts.push(body.text)
    response.writeHead(200, { "content-type": "application/json" })
    response.end(JSON.stringify({
      aiProbability: body.text.includes("模板化") ? 0.89 : 0.22,
      label: body.text.includes("模板化") ? "疑似AI生成" : "人类写作",
    }))
  })
  const baseUrl = await listen(server)

  try {
    const { handleNovelStudioApi } = await import(`${pathToFileURL(path.join(packageRoot, "dist", "studio-server.js")).href}?ts=${Date.now()}`)
    const response = await handleNovelStudioApi(process.cwd(), "POST", "/api/aigc-detect", {
      segments: [
        { text: "她把账册夹在胳膊下，沿着后门出去，鞋底沾了一线青苔。", startOffset: 0, endOffset: 29 },
        { text: "这是一段模板化表达，人物反应被概括，场景被抽象词覆盖。", startOffset: 31, endOffset: 61 },
      ],
      config: {
        provider: "generic-json",
        url: `${baseUrl}/detect`,
        threshold: 0.8,
        segment: { maxChars: 120, minChars: 20 },
      },
    })

    assert.equal(response.status, 200)
    assert.ok(requestedTexts.length > 1)
    assert.equal(response.payload.result.totalSegments, requestedTexts.length)
    assert.equal(response.payload.result.highRiskSegments.length, 1)
    assert.match(response.payload.result.highRiskSegments[0].segment.text, /模板化/)
  } finally {
    await close(server)
  }
})
