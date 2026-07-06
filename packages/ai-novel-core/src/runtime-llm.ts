import { loadLlmConfigForCapability, loadActiveLlmConfig, type LlmApiMode } from "./llm-config"
import { createAutopilotStopError } from "./abort"
import type { ProviderTestResult } from "./cli-types"

interface AgentReplyOptions {
  roleName: string
  basePrompt: string
  dynamicPrompt: string
  consensus: string
  message: string
  signal?: AbortSignal
  discussionStage?: "opening_brief" | "specialist_turn" | "closing_synthesis"
  priorTranscript?: string
  onDelta?: (delta: string) => void | Promise<void>
  discussionTarget?: {
    kind: string
    label: string
    assetPath: string
    instruction: string
  }
  preferredLanguage?: "zh-CN" | "en-US"
  currentStage?: string
  stageInstruction?: string
  envRootDir?: string
  temperature?: number
}

interface ProviderOverrideOptions {
  baseUrl?: string
  apiKey?: string
  modelName?: string
  apiMode?: LlmApiMode
}

interface LlmTextMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface LlmTextCompletionOptions {
  baseUrl: string
  apiKey: string
  modelName: string
  apiMode: LlmApiMode
  timeoutMs: number
  temperature?: number
  messages: LlmTextMessage[]
  stream?: boolean
  maxTokens?: number
  signal?: AbortSignal
  onDelta?: (delta: string) => void | Promise<void>
}

const AUTONOMOUS_DISCUSSION_PROTOCOL = [
  "自主创作协议：",
  "- 你已经被授权接管创作流程。",
  "- 默认使用简体中文回复，除非系统明确要求别的语言。",
  "- 不要让用户做 A/B 选择，不要询问是否继续。",
  "- 不要因为细节缺失就停住；缺信息时先做高质量工作假设。",
  "- 必须给出具体提案、风险、建议和收敛结果。",
  "- 讨论必须严格停留在当前 target 和当前 workflow stage 内。",
  "- 不允许越级声称已经进入下一阶段；如果当前还在世界观阶段，就不能假装已经在写第 2 章。",
  "- 权威进度只来自系统提供的 `当前工作流阶段`；不得根据讨论内容自行宣布阶段已完成、已进入下一阶段、某弧蓝图已完成。",
  "- 可以提出 `建议下一步推进到...`，但不能写成 `当前已经进入...`，除非 `当前工作流阶段` 已经变更。",
  "- 每个 specialist 至少指出一个风险、弱点或冲突，再给建议。",
  "- Reviewer、Editor、Prose Stylist 不允许只给纯通过结论。",
  "- 最终 Showrunner 总结必须包含：Final Consensus、Remaining Risk、Next Step。",
].join("\n")

const STAGE_DRIFT_PATTERNS = [
  /prose production/i,
  /current task/i,
  /chapter\s+\d+/i,
  /第\s*\d+\s*章/u,
]

function extractTextContent(value: unknown): string {
  if (typeof value === "string") {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => extractTextContent(item)).join("")
  }
  if (!value || typeof value !== "object") {
    return ""
  }
  const record = value as Record<string, unknown>
  const direct = [record.text, record.output_text, record.reasoning_content, record.content]
    .map((item) => extractTextContent(item))
    .join("")
  if (direct) {
    return direct
  }
  return [record.message, record.delta]
    .map((item) => extractTextContent(item))
    .join("")
}

function buildFakeReply(options: AgentReplyOptions) {
  const normalizedRole = options.roleName.toLowerCase()
  const priorTranscript = options.priorTranscript?.trim() ?? ""
  const latestContextLine = priorTranscript.split("\n").filter(Boolean).slice(-1)[0] ?? ""
  const targetLabel = options.discussionTarget?.label || "当前讨论目标"

  if (normalizedRole.includes("showrunner")) {
    if (options.discussionStage === "opening_brief") {
      return [
        "### 本轮目标",
        `- 讨论对象：${targetLabel}`,
        `- 写回资产：${options.discussionTarget?.assetPath || "项目记忆"}`,
        `- 当前阶段：${options.currentStage || "worldbuilding_dialogue"}`,
        "- 目标：在不越级进入正文写作的前提下，先形成统一共识。",
        "",
        "### 约束",
        "- 必须停留在同一个讨论对象上。",
        "- 不得虚构无关章节、支线或已经完成的正文。",
        "- 结尾必须给出可写回资产的更新建议。",
      ].join("\n")
    }

    if (options.discussionStage === "closing_synthesis") {
      return [
        "### Final Consensus",
        `- 已确认讨论对象：${targetLabel}`,
        `- 写回路径：${options.discussionTarget?.assetPath || "项目记忆"}`,
        "- 决议：后续动作必须继续停留在当前 target 与当前阶段内。",
        "",
        "### Remaining Risk",
        "- 如果后续回复再次越级到正文阶段，项目状态与对话内容会失同步。",
        "",
        "### Next Step",
        "- 先把本轮共识写回对应资产，再决定是否推进工作流阶段。",
      ].join("\n")
    }

    return "Showrunner 提醒：讨论必须围绕当前阶段和当前对象，不允许直接跳到正文生产。"
  }

  if (normalizedRole.includes("world")) {
    return [
      "### 世界观立场",
      `基于 Showrunner 简报与 ${latestContextLine || "当前上下文"}，继续收紧 ${targetLabel} 的规则与影响边界。`,
      "",
      "### 风险",
      "- 不能泄漏到完整正文，也不能擅自写成后续章节。",
      "",
      "### 建议",
      "- 优先澄清硬规则、代价与压力源，并写回目标资产。",
    ].join("\n")
  }

  if (normalizedRole.includes("author")) {
    return [
      "### 戏剧方向",
      `在 Showrunner 简报与 ${latestContextLine || "前序讨论"} 的基础上，为 ${targetLabel} 补强张力与情绪动线。`,
      "",
      "### 风险",
      "- 如果现在直接写正文，会让当前阶段与项目状态脱节。",
      "",
      "### 建议",
      "- 当前只保留蓝图层、设定层、决策层内容。",
      "- 真正的正文写作留到 drafting 阶段再执行。",
    ].join("\n")
  }

  if (normalizedRole.includes("editor")) {
    return [
      "### 编辑审视",
      `结合 Showrunner 简报与 ${latestContextLine || "当前方向"}，检查 ${targetLabel} 的节奏与清晰度。`,
      "",
      "### 风险",
      "- 现在最容易出现的是越级推进和信息堆砌。",
      "",
      "### 建议",
      "- 去掉模糊表述。",
      "- 不允许新起章节或支线。",
    ].join("\n")
  }

  if (normalizedRole.includes("reviewer")) {
    return [
      "### 审查焦点",
      `基于 Showrunner 简报与 ${latestContextLine || "前序建议"}，继续压测 ${targetLabel} 的逻辑漏洞与连续性风险。`,
      "",
      "### 风险",
      "- 主题漂移会破坏共享决策过程。",
      "- 隐性矛盾必须在继续推进前先解决。",
    ].join("\n")
  }

  if (normalizedRole.includes("prose")) {
    return [
      "### 文风建议",
      `在 Showrunner 简报与 ${latestContextLine || "审查意见"} 的约束下，为 ${targetLabel} 提供语言与语气优化。`,
      "",
      "### 风险",
      "- 文风优化最容易误滑成正文创作，这里必须克制。",
      "",
      "### 建议",
      "- 保持语言更像人写的、具体的、少模板味。",
      "- 不要写新章节标题或完整场景。",
    ].join("\n")
  }

  return `${options.roleName}：已接收当前指令，并与现有小说共识保持一致。`
}

async function emitFakeReplyInChunks(reply: string, onDelta: NonNullable<AgentReplyOptions["onDelta"]>) {
  const midpoint = Math.max(1, Math.floor(reply.length / 2))
  const chunks = [reply.slice(0, midpoint), reply.slice(midpoint)].filter(Boolean)

  for (const chunk of chunks) {
    await onDelta(chunk)
  }
}

async function streamOpenAiCompatibleResponse(
  response: Response,
  onDelta: NonNullable<AgentReplyOptions["onDelta"]>,
  options: {
    signal: AbortSignal
    markActivity: () => void
    requestStartTime?: number
  },
) {
  if (!response.body) {
    throw new Error("LLM streaming response body was empty.")
  }

  const streamStartTime = Date.now()
  const baseTime = options.requestStartTime || streamStartTime
  console.log(`[LLM STREAM START] 开始解析大模型返回数据流...`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let content = ""
  let firstTokenReceived = false

  const readNextChunk = async () => {
    if (options.signal.aborted) {
      throw new Error("LLM stream aborted.")
    }

    let abortRead: (() => void) | null = null
    const abortPromise = new Promise<never>((_, reject) => {
      abortRead = () => {
        reader.cancel().catch(() => undefined)
        reject(new Error("LLM stream aborted."))
      }
      options.signal.addEventListener("abort", abortRead, { once: true })
    })

    try {
      return await Promise.race([reader.read(), abortPromise])
    } finally {
      if (abortRead) {
        options.signal.removeEventListener("abort", abortRead)
      }
    }
  }

  try {
    while (true) {
      const { value, done } = await readNextChunk()
      if (done) {
        buffer += decoder.decode()
        break
      }

      options.markActivity()
      buffer += decoder.decode(value, { stream: true })

      while (buffer.includes("\n\n")) {
        const separator = buffer.indexOf("\n\n")
        const chunk = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)

        for (const line of chunk.split("\n")) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data:")) {
            continue
          }

          const payloadText = trimmed.slice("data:".length).trim()
          if (payloadText === "[DONE]") {
            continue
          }

          const payload = JSON.parse(payloadText)
          const delta = extractStreamingDelta(payload)
          if (!delta) {
            continue
          }

          if (!firstTokenReceived) {
            firstTokenReceived = true
            const elapsedMs = Date.now() - baseTime
            console.log(`[LLM STREAM FIRST TOKEN] 收到大模型第一个有效Token! 从发起请求到首字耗时(TTFT): ${elapsedMs}ms`)
          }

          content += delta
          await onDelta(delta)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  const totalStreamTime = Date.now() - streamStartTime
  const totalRequestTime = Date.now() - baseTime
  console.log(`[LLM STREAM END] 数据流读取完成。流传输耗时: ${totalStreamTime}ms，从发起请求到完成总耗时: ${totalRequestTime}ms，接收字数: ${content.length}`)
  console.log(`\n========== [LLM RESPONSE START] ==========\n${content.trim()}\n========== [LLM RESPONSE END] ==========\n`)

  return content.trim()
}

async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal, markActivity: () => void) => Promise<T>,
  externalSignal?: AbortSignal,
) {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | null = null
  const abortFromExternalSignal = () => controller.abort()
  const resetTimer = () => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs))
  }
  if (externalSignal?.aborted) {
    controller.abort()
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true })
  }
  resetTimer()

  try {
    return await operation(controller.signal, resetTimer)
  } catch (error) {
    if (externalSignal?.aborted) {
      throw createAutopilotStopError()
    }
    if (controller.signal.aborted) {
      throw new Error(`LLM request timed out after ${timeoutMs}ms without provider activity.`)
    }
    throw error
  } finally {
    externalSignal?.removeEventListener("abort", abortFromExternalSignal)
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function getMessageContent(messages: LlmTextMessage[], role: LlmTextMessage["role"]) {
  return messages
    .filter((message) => message.role === role && message.content.trim())
    .map((message) => message.content.trim())
    .join("\n\n")
}

function buildResponsesInput(messages: LlmTextMessage[]) {
  const userMessages = messages.filter((message) => message.role !== "system" && message.content.trim())
  if (userMessages.length === 1 && userMessages[0].role === "user") {
    return userMessages[0].content
  }
  return userMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

function extractResponsesOutput(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return ""
  }
  const record = payload as Record<string, unknown>
  const direct = extractTextContent(record.output_text)
  if (direct) {
    return direct.trim()
  }

  const output = Array.isArray(record.output) ? record.output : []
  return output.map((item) => extractTextContent(item)).join("").trim()
}

function extractStreamingDelta(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return ""
  }

  const record = payload as Record<string, unknown>
  const choicePayload = payload as {
    choices?: Array<{ delta?: unknown; message?: unknown; text?: unknown }>
  }
  const choice = choicePayload.choices?.[0]
  const chatDelta = extractTextContent(choice?.delta) || extractTextContent(choice?.message) || extractTextContent(choice?.text)
  if (chatDelta) {
    return chatDelta
  }

  const eventType = typeof record.type === "string" ? record.type : ""
  if (eventType.endsWith(".delta")) {
    return extractTextContent(record.delta)
  }

  return ""
}

async function parseProviderError(response: Response) {
  const raw = await response.text().catch(() => "")
  if (!raw) {
    return response.statusText
  }
  try {
    const payload = JSON.parse(raw) as { error?: { message?: string } | string }
    if (typeof payload.error === "string") {
      return payload.error
    }
    return payload.error?.message || raw.slice(0, 500)
  } catch {
    return raw.slice(0, 500)
  }
}

export async function requestLlmTextCompletion(options: LlmTextCompletionOptions) {
  const endpoint = options.apiMode === "responses" ? "responses" : "chat/completions"
  const requestStartTime = Date.now()
  const baseUrl = options.baseUrl.replace(/\/$/, "")
  const selectedTemperature = options.temperature ?? 0.1
  const messages = options.messages.filter((message) => message.content.trim())
  const system = getMessageContent(messages, "system")
  const user = getMessageContent(messages, "user")
  const effectiveStream = Boolean(options.stream)

  console.log(`[LLM REQUEST SEND] 准备向 API 发送 ${endpoint} 请求...`)
  console.log(`- BaseUrl: ${options.baseUrl}`)
  console.log(`- Model: ${options.modelName}`)
  console.log(`- API Mode: ${options.apiMode}`)
  console.log(`- Temperature: ${selectedTemperature}`)
  console.log(`- Messages Count: ${messages.length}`)
  console.log(`- System Prompt Length: ${system.length} chars`)
  console.log(`- User Message Length: ${user.length} chars`)

  const body = options.apiMode === "responses"
    ? {
        model: options.modelName,
        instructions: system || undefined,
        input: buildResponsesInput(messages),
        temperature: selectedTemperature,
        max_output_tokens: options.maxTokens,
        stream: effectiveStream,
      }
    : {
        model: options.modelName,
        temperature: selectedTemperature,
        stream: effectiveStream,
        max_tokens: options.maxTokens,
        messages,
      }

  return withTimeout(options.timeoutMs, async (signal, markActivity) => {
    const response = await fetch(`${baseUrl}/${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`,
      },
      signal,
      body: JSON.stringify(body),
    })

    const fetchTime = Date.now() - requestStartTime
    console.log(`[LLM REQUEST HEAD] 收到 API Response 头部，状态码: ${response.status}，HTTP建立连接与首包头耗时: ${fetchTime}ms`)

    if (!response.ok) {
      const providerMessage = await parseProviderError(response)
      console.error(`[LLM REQUEST ERROR] 请求失败，状态码: ${response.status}，错误: ${providerMessage}`)
      throw new Error(`LLM request failed with status ${response.status}: ${providerMessage}`)
    }
    markActivity()

    if (effectiveStream && options.onDelta) {
      return streamOpenAiCompatibleResponse(response, async (delta) => {
        markActivity()
        await options.onDelta?.(delta)
      }, {
        signal,
        markActivity,
        requestStartTime,
      })
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: unknown; text?: unknown }>
    }
    const choice = payload.choices?.[0]
    const content = options.apiMode === "responses"
      ? extractResponsesOutput(payload)
      : (extractTextContent(choice?.message) || extractTextContent(choice?.text)).trim()

    const totalTime = Date.now() - requestStartTime
    console.log(`[LLM REQUEST END] 非流式请求完成。总耗时: ${totalTime}ms，返回内容长度: ${content.length}`)
    console.log(`\n========== [LLM RESPONSE START] ==========\n${content.trim()}\n========== [LLM RESPONSE END] ==========\n`)

    if (options.stream && options.onDelta && content) {
      await options.onDelta(content)
    }

    return content.trim()
  }, options.signal)
}

export async function generateAgentReply(options: AgentReplyOptions) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    const reply = buildFakeReply(options)
    if (options.onDelta) {
      await emitFakeReplyInChunks(reply, options.onDelta)
    }
    return reply
  }

  let config = await loadLlmConfigForCapability(options.envRootDir, "text")
  const apiKey = config?._dbApiKey || ""

  if (!config || !apiKey) {
    throw new Error("No active LLM configuration found. Configure a text model in settings before generating content.")
  }


  const isDrafting = options.currentStage === "drafting"
  const protocol = isDrafting
    ? "正文创作协议：你负责执行小说章节的初稿创作、质量返工或自然度润色，必须输出具体的文学正文，且严禁输出讨论过程或无关废话。"
    : AUTONOMOUS_DISCUSSION_PROTOCOL

  const systemBlocks: string[] = []
  if (isDrafting) {
    // 写作模式下：最庞大且最固定的是写作规范 (basePrompt)，而 dynamicPrompt 是本章细节（频繁变动，必须置后）
    if (options.basePrompt.trim()) systemBlocks.push(options.basePrompt.trim())
    if (protocol) systemBlocks.push(protocol)
    if (options.consensus.trim()) systemBlocks.push(options.consensus.trim())
    if (options.dynamicPrompt.trim()) systemBlocks.push(options.dynamicPrompt.trim())
  } else {
    // 讨论模式下：最庞大且对所有 Agent 共享（基本不随专家角色而变）的是小说核心设定/世界观 (consensus)
    // 随后是通用的全局讨论协议
    // 而 basePrompt/dynamicPrompt 是各个 Agent 专属的角色设定与职责（每次调用均不同，必须置后）
    if (options.consensus.trim()) systemBlocks.push(options.consensus.trim())
    if (protocol) systemBlocks.push(protocol)
    if (options.basePrompt.trim()) systemBlocks.push(options.basePrompt.trim())
    if (options.dynamicPrompt.trim()) systemBlocks.push(options.dynamicPrompt.trim())
  }

  systemBlocks.push(
    `输出语言：${options.preferredLanguage === "en-US" ? "English" : "简体中文"}`,
    `当前工作流阶段：${options.currentStage ?? "worldbuilding_dialogue"}`,
    options.stageInstruction ? `阶段约束：${options.stageInstruction}` : "",
    `Discussion stage: ${options.discussionStage ?? "specialist_turn"}`,
    options.discussionTarget
      ? `Discussion target: ${options.discussionTarget.label}\nTarget kind: ${options.discussionTarget.kind}\nTarget asset: ${options.discussionTarget.assetPath}\nTarget instruction: ${options.discussionTarget.instruction}`
      : "",
    "Response contract:\n" + [
      "- 必须使用简体中文输出。",
      isDrafting ? "- 必须按照章节格式要求输出章节正文内容。" : "- 给出实质性讨论内容，不能只说一句拒绝。",
      isDrafting ? "- 必须遵循小说人物档案，保证人名与情节的连续性。" : "- 可以使用简短 markdown 小节与列表。",
      "- 必须停留在当前 target 内。",
      isDrafting ? "" : "- 除非明确进入 drafting 阶段，否则不能产出脱离阶段的章节正文。",
      isDrafting ? "" : "- Specialists 必须先给一个明确风险/批评/失败模式，再给建议。",
      isDrafting ? "" : "- Final synthesis 必须包含 `Final Consensus`、`Remaining Risk`、`Next Step`。",
    ].filter(Boolean).join("\n"),
    (!isDrafting && options.priorTranscript?.trim()) ? `Prior roundtable transcript:\n${options.priorTranscript.trim()}` : "",
  )

  const system = systemBlocks.filter(Boolean).join("\n\n")

  const selectedTemperature = options.temperature !== undefined ? options.temperature : config.provider.temperature
  console.log(`\n========== [LLM SYSTEM PROMPT START] ==========\n${system}\n========== [LLM SYSTEM PROMPT END] ==========\n`)
  if (options.message) {
    console.log(`\n========== [LLM USER MESSAGE START] ==========\n${options.message}\n========== [LLM USER MESSAGE END] ==========\n`)
  }

  const content = await requestLlmTextCompletion({
    baseUrl: config.provider.baseUrl,
    apiKey,
    modelName: config.provider.modelName,
    apiMode: config.provider.apiMode,
    timeoutMs: config.provider.timeoutMs,
    temperature: selectedTemperature,
    stream: Boolean(options.onDelta),
    signal: options.signal,
    onDelta: options.onDelta,
    messages: [
      { role: "system", content: system },
      { role: "user", content: options.message },
    ],
  })
  if (!content) {
    throw new Error("LLM response did not include message content.")
  }

  if (
    options.currentStage &&
    options.currentStage !== "drafting" &&
    STAGE_DRIFT_PATTERNS.some((pattern) => pattern.test(content))
  ) {
    return [
      "### 阶段纠偏",
      "- STAGE_GUARD_CORRECTION: true",
      `- 当前仍处于 ${options.currentStage}，不能越级宣称已经进入正文写作。`,
      `- 当前讨论对象：${options.discussionTarget?.label || "未指定"}`,
      "",
      "### 保留结论",
      "- 请继续围绕当前阶段完成共识收敛、风险识别和下一步建议。",
    ].join("\n")
  }

  return content
}

export async function testProviderConnectivity(
  overrides: ProviderOverrideOptions = {},
  rootDir = process.cwd(),
): Promise<ProviderTestResult> {
  const activeConfig = await loadActiveLlmConfig(rootDir)
  const checkedAt = new Date().toISOString()
  const timeoutMs = activeConfig?.provider.timeoutMs || 120000
  const baseUrl = overrides.baseUrl?.trim() || activeConfig?.provider.baseUrl || ""
  const modelName = overrides.modelName?.trim() || activeConfig?.provider.modelName || ""
  const apiMode = overrides.apiMode || activeConfig?.provider.apiMode || "chat"
  const apiKey =
    overrides.apiKey?.trim() ||
    activeConfig?._dbApiKey ||
    ""

  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return {
      ok: true,
      checkedAt,
      baseUrl,
      modelName,
      apiMode,
      message: `Provider connectivity check passed in test mode (${apiMode}).`,
    }
  }

  if (!baseUrl || !modelName || !apiKey) {
    return {
      ok: false,
      checkedAt,
      baseUrl,
      modelName,
      apiMode,
      message: "Missing provider config. Configure a model in settings first.",
    }
  }

  try {
    const response = await withTimeout(timeoutMs, (signal) =>
      fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        signal,
      }),
    )

    if (!response.ok) {
      let fallbackErrorMessage = ""
      // If /models fails (e.g. 404/405/403), fallback to a lightweight generation call.
      try {
        const content = await requestLlmTextCompletion({
          baseUrl,
          apiKey,
          modelName,
          apiMode,
          timeoutMs,
          maxTokens: 8,
          messages: [{ role: "user", content: "ping" }],
        })
        if (content) {
          return {
            ok: true,
            checkedAt,
            baseUrl,
            modelName,
            apiMode,
            message: `Provider reachable (verified via ${apiMode} generation fallback).`,
          }
        }
      } catch (chatErr) {
        fallbackErrorMessage = chatErr instanceof Error ? chatErr.message : String(chatErr)
      }

      return {
        ok: false,
        checkedAt,
        baseUrl,
        modelName,
        apiMode,
        message: fallbackErrorMessage
          ? `Provider test failed with status ${response.status}; generation fallback failed: ${fallbackErrorMessage}`
          : `Provider test failed with status ${response.status}.`,
      }
    }

    const payload = await response.json() as { data?: Array<unknown> }
    const modelCount = Array.isArray(payload.data) ? payload.data.length : 0

    return {
      ok: true,
      checkedAt,
      baseUrl,
      modelName,
      apiMode,
      message: `Provider reachable. ${modelCount} models listed.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      checkedAt,
      baseUrl,
      modelName,
      apiMode,
      message: `Provider test failed: ${message}`,
    }
  }
}
