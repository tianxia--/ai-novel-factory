import assert from "node:assert/strict"
import http from "node:http"
import test from "node:test"

import {
  extractLlmUsageMetrics,
  generateAgentReply,
  requestLlmTextCompletion,
} from "../dist/index.js"

test("LLM cache usage normalizes GLM, DeepSeek, and Responses fields", () => {
  assert.deepEqual(extractLlmUsageMetrics({
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 80,
      total_tokens: 1080,
      prompt_tokens_details: { cached_tokens: 750 },
      completion_tokens_details: { reasoning_tokens: 30 },
    },
  }), {
    promptTokens: 1000,
    completionTokens: 80,
    totalTokens: 1080,
    cachedTokens: 750,
    cacheMissTokens: 250,
    reasoningTokens: 30,
    cacheHitRate: 0.75,
  })

  const deepSeek = extractLlmUsageMetrics({
    usage: {
      prompt_tokens: 900,
      completion_tokens: 100,
      prompt_cache_hit_tokens: 640,
      prompt_cache_miss_tokens: 260,
    },
  })
  assert.equal(deepSeek.cachedTokens, 640)
  assert.equal(deepSeek.cacheMissTokens, 260)

  const responses = extractLlmUsageMetrics({
    response: {
      usage: {
        input_tokens: 500,
        output_tokens: 40,
        input_tokens_details: { cached_tokens: 320 },
        output_tokens_details: { reasoning_tokens: 12 },
      },
    },
  })
  assert.equal(responses.cachedTokens, 320)
  assert.equal(responses.reasoningTokens, 12)
})

test("streaming chat requests cache usage and reports the final metrics", async () => {
  let receivedBody = null
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      receivedBody = JSON.parse(rawBody)
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "缓存验证成功" } }], usage: null })}\n\n`)
      response.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 1200, completion_tokens: 20, total_tokens: 1220, prompt_tokens_details: { cached_tokens: 960 } } })}\n\n`)
      response.write("data: [DONE]\n\n")
      response.end()
    })
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    let streamed = ""
    let reportedUsage = null
    const content = await requestLlmTextCompletion({
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "test-model",
      apiMode: "chat",
      timeoutMs: 1000,
      stream: true,
      messages: [{ role: "user", content: "验证缓存 usage" }],
      onDelta: (delta) => { streamed += delta },
      onUsage: (usage) => { reportedUsage = usage },
    })
    assert.equal(content, "缓存验证成功")
    assert.equal(streamed, content)
    assert.equal(receivedBody.stream_options.include_usage, true)
    assert.equal(reportedUsage.cachedTokens, 960)
    assert.equal(reportedUsage.cacheHitRate, 0.8)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test("streaming chat responses are parsed even when no delta callback is provided", async () => {
  const server = http.createServer((request, response) => {
    request.resume()
    request.on("end", () => {
      response.writeHead(200, {
        "content-type": "application/json",
      })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "RUNTIME_OK" } }] })}\n\n`)
      response.write("data: [DONE]\n\n")
      response.end()
    })
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    const content = await requestLlmTextCompletion({
      baseUrl: `http://127.0.0.1:${address.port}`,
      apiKey: "test-key",
      modelName: "test-model",
      apiMode: "chat",
      timeoutMs: 1000,
      stream: true,
      messages: [{ role: "user", content: "验证无回调流式解析" }],
    })
    assert.equal(content, "RUNTIME_OK")
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test("agent replies can use an isolated provider override without changing the global route", async () => {
  let receivedBody = null
  const server = http.createServer((request, response) => {
    let rawBody = ""
    request.on("data", (chunk) => { rawBody += chunk })
    request.on("end", () => {
      receivedBody = JSON.parse(rawBody)
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "OVERRIDE_OK" } }] })}\n\n`)
      response.write("data: [DONE]\n\n")
      response.end()
    })
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    let streamed = ""
    const content = await generateAgentReply({
      roleName: "Debug Model Probe",
      basePrompt: "输出测试。",
      dynamicPrompt: "",
      consensus: "",
      message: "只回复 OVERRIDE_OK",
      responseMode: "artifact",
      providerOverride: {
        baseUrl: `http://127.0.0.1:${address.port}`,
        apiKey: "isolated-key",
        modelName: "isolated-model",
        apiMode: "chat",
        timeoutMs: 1000,
      },
      onDelta: (delta) => { streamed += delta },
    })
    assert.equal(content, "OVERRIDE_OK")
    assert.equal(streamed, content)
    assert.equal(receivedBody.model, "isolated-model")
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
