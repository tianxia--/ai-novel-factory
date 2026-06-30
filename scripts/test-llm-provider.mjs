#!/usr/bin/env node

/**
 * Standalone OpenAI-compatible provider smoke test.
 *
 * Fill the CONFIG block below, or leave values blank and pass them via env:
 *
 *   LLM_BASE_URL="https://your-relay.example/v1" \
 *   LLM_API_KEY="sk-..." \
 *   LLM_MODEL_ID="your-model" \
 *   rtk node scripts/test-llm-provider.mjs
 *
 * Optional env:
 *   LLM_TIMEOUT_MS=60000
 *   LLM_TEST_STREAM=1
 *   LLM_TEST_SKIP_MODELS=1
 *   LLM_TEST_API=auto        # auto, chat, or responses
 */

const CONFIG = {
  baseUrl: "https://gptsdd.com/codex", // Example: "https://your-relay.example/v1"
  apiKey: "", // Example: "sk-..."
  model: "gpt-5.5", // Example: "gpt-4o-mini" or the relay model name
  timeoutMs: 60000,
  testStream: false,
  skipModels: false,
  api: "auto", // auto, chat, or responses
}

const TEST_PROMPT = "用一句简体中文回答：中转站模型连通性测试成功。"

function valueFromEnvOrConfig(envName, configValue) {
  return (process.env[envName] || configValue || "").trim()
}

function readBoolean(envName, configValue) {
  const raw = process.env[envName]
  if (raw === undefined) {
    return Boolean(configValue)
  }
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase())
}

function redactSecret(secret) {
  if (!secret) {
    return "[missing]"
  }
  if (secret.length <= 10) {
    return `${secret.slice(0, 2)}...${secret.slice(-2)}`
  }
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "")
}

function normalizeApiMode(value) {
  const normalized = String(value || "auto").trim().toLowerCase()
  if (["auto", "chat", "responses"].includes(normalized)) {
    return normalized
  }
  return "auto"
}

function makeTimeoutSignal(timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs))
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

async function readResponseBody(response) {
  const text = await response.text()
  if (!text) {
    return ""
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

async function fetchWithDiagnostics(url, options, timeoutMs) {
  const timeout = makeTimeoutSignal(timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(url, {
      ...options,
      signal: timeout.signal,
    })
    const elapsedMs = Date.now() - startedAt
    const body = await readResponseBody(response)

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      elapsedMs,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }
  } finally {
    timeout.clear()
  }
}

function printSection(title) {
  console.log(`\n=== ${title} ===`)
}

function printResult(result) {
  console.log(`Status: ${result.status} ${result.statusText}`)
  console.log(`Elapsed: ${result.elapsedMs}ms`)
  if (result.headers["content-type"]) {
    console.log(`Content-Type: ${result.headers["content-type"]}`)
  }
  if (result.body) {
    console.log("Body:")
    console.log(result.body.length > 4000 ? `${result.body.slice(0, 4000)}\n...[truncated]` : result.body)
  }
}

async function testModelsEndpoint({ baseUrl, apiKey, timeoutMs }) {
  printSection("GET /models")
  const result = await fetchWithDiagnostics(`${baseUrl}/models`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  }, timeoutMs)

  printResult(result)
  return result
}

function parseChatContent(body) {
  if (!body) {
    return ""
  }

  try {
    const payload = JSON.parse(body)
    return payload?.choices?.[0]?.message?.content?.trim() || ""
  } catch {
    return ""
  }
}

async function testChatCompletion({ baseUrl, apiKey, model, timeoutMs }) {
  printSection("POST /chat/completions")
  const payload = {
    model,
    temperature: 0.1,
    max_tokens: 128,
    stream: false,
    messages: [
      {
        role: "system",
        content: "You are a connectivity test assistant. Answer briefly.",
      },
      {
        role: "user",
        content: TEST_PROMPT,
      },
    ],
  }

  const result = await fetchWithDiagnostics(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  }, timeoutMs)

  printResult(result)

  const content = parseChatContent(result.body)
  if (content) {
    console.log("\nGenerated content:")
    console.log(content)
  }

  return result
}

function parseResponsesContent(body) {
  if (!body) {
    return ""
  }

  try {
    const payload = JSON.parse(body)
    if (typeof payload?.output_text === "string") {
      return payload.output_text.trim()
    }

    const output = Array.isArray(payload?.output) ? payload.output : []
    const parts = []
    for (const item of output) {
      const content = Array.isArray(item?.content) ? item.content : []
      for (const part of content) {
        if (typeof part?.text === "string") {
          parts.push(part.text)
        }
      }
    }
    return parts.join("").trim()
  } catch {
    return ""
  }
}

async function testResponses({ baseUrl, apiKey, model, timeoutMs }) {
  printSection("POST /responses")
  const payload = {
    model,
    input: TEST_PROMPT,
    max_output_tokens: 128,
  }

  const result = await fetchWithDiagnostics(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  }, timeoutMs)

  printResult(result)

  const content = parseResponsesContent(result.body)
  if (content) {
    console.log("\nGenerated content:")
    console.log(content)
  }

  return result
}

async function testStreamingChatCompletion({ baseUrl, apiKey, model, timeoutMs }) {
  printSection("POST /chat/completions stream=true")
  const timeout = makeTimeoutSignal(timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 128,
        stream: true,
        messages: [{ role: "user", content: TEST_PROMPT }],
      }),
    })

    console.log(`Status: ${response.status} ${response.statusText}`)
    console.log(`TTFB: ${Date.now() - startedAt}ms`)

    if (!response.ok) {
      console.log("Body:")
      console.log(await readResponseBody(response))
      return { ok: false, content: "" }
    }

    if (!response.body) {
      throw new Error("Streaming response body is empty.")
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let content = ""
    let firstTokenAt = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
        break
      }

      buffer += decoder.decode(value, { stream: true })

      while (buffer.includes("\n\n")) {
        const index = buffer.indexOf("\n\n")
        const chunk = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)

        for (const line of chunk.split("\n")) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data:")) {
            continue
          }

          const data = trimmed.slice("data:".length).trim()
          if (!data || data === "[DONE]") {
            continue
          }

          const payload = JSON.parse(data)
          const delta = payload?.choices?.[0]?.delta?.content || ""
          if (!delta) {
            continue
          }

          if (firstTokenAt === null) {
            firstTokenAt = Date.now()
            console.log(`First token: ${firstTokenAt - startedAt}ms`)
          }
          content += delta
          process.stdout.write(delta)
        }
      }
    }

    console.log("")
    console.log(`Total: ${Date.now() - startedAt}ms`)
    return { ok: true, content }
  } finally {
    timeout.clear()
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(valueFromEnvOrConfig("LLM_BASE_URL", CONFIG.baseUrl) || valueFromEnvOrConfig("OPENAI_BASE_URL", ""))
  const apiKey = valueFromEnvOrConfig("LLM_API_KEY", CONFIG.apiKey) || valueFromEnvOrConfig("OPENAI_API_KEY", "")
  const model = valueFromEnvOrConfig("LLM_MODEL_ID", CONFIG.model) || valueFromEnvOrConfig("OPENAI_MODEL_NAME", "")
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || CONFIG.timeoutMs) || 60000
  const testStream = readBoolean("LLM_TEST_STREAM", CONFIG.testStream)
  const skipModels = readBoolean("LLM_TEST_SKIP_MODELS", CONFIG.skipModels)
  const apiMode = normalizeApiMode(process.env.LLM_TEST_API || CONFIG.api)

  printSection("Config")
  console.log(`Base URL: ${baseUrl || "[missing]"}`)
  console.log(`Model: ${model || "[missing]"}`)
  console.log(`API key: ${redactSecret(apiKey)}`)
  console.log(`Timeout: ${timeoutMs}ms`)
  console.log(`Stream test: ${testStream ? "enabled" : "disabled"}`)
  console.log(`API mode: ${apiMode}`)

  const missing = []
  if (!baseUrl) missing.push("LLM_BASE_URL")
  if (!apiKey) missing.push("LLM_API_KEY")
  if (!model) missing.push("LLM_MODEL_ID")

  if (missing.length > 0) {
    console.error(`\nMissing config: ${missing.join(", ")}`)
    console.error("Fill CONFIG at the top of this file, or pass env variables when running it.")
    process.exitCode = 2
    return
  }

  if (!skipModels) {
    const modelsResult = await testModelsEndpoint({ baseUrl, apiKey, timeoutMs })
    if (!modelsResult.ok) {
      console.log("\nNote: Some relays do not support /models. Continuing with chat completion test.")
    }
  }

  let generationResult = null
  if (apiMode === "chat") {
    generationResult = await testChatCompletion({ baseUrl, apiKey, model, timeoutMs })
  } else if (apiMode === "responses") {
    generationResult = await testResponses({ baseUrl, apiKey, model, timeoutMs })
  } else {
    const chatResult = await testChatCompletion({ baseUrl, apiKey, model, timeoutMs })
    generationResult = chatResult
    if (!chatResult.ok && chatResult.status === 404) {
      console.log("\nNote: /chat/completions returned 404. Trying /responses because Codex-compatible relays often expose that endpoint.")
      generationResult = await testResponses({ baseUrl, apiKey, model, timeoutMs })
    }
  }

  if (!generationResult.ok) {
    process.exitCode = 1
    return
  }

  if (testStream && apiMode !== "responses") {
    const streamResult = await testStreamingChatCompletion({ baseUrl, apiKey, model, timeoutMs })
    if (!streamResult.ok) {
      process.exitCode = 1
    }
  } else if (testStream && apiMode === "responses") {
    console.log("\nNote: Stream test is only implemented for chat/completions in this script.")
  }

  printSection("Summary")
  console.log("Provider chat completion test passed.")
}

main().catch((error) => {
  printSection("Fatal Error")
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
