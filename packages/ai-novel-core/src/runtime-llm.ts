import { getProjectEnvStatus } from "./env-manager"
import { loadLlmConfigFromEnv, loadActiveLlmConfig } from "./llm-config"
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
}

interface ProviderOverrideOptions {
  baseUrl?: string
  apiKey?: string
  modelName?: string
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

          const payload = JSON.parse(payloadText) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const delta = payload.choices?.[0]?.delta?.content
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

export async function generateAgentReply(options: AgentReplyOptions) {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    const reply = buildFakeReply(options)
    if (options.onDelta) {
      await emitFakeReplyInChunks(reply, options.onDelta)
    }
    return reply
  }

  let config = await loadActiveLlmConfig(options.envRootDir)
  let apiKey = ""
  if (config) {
    apiKey = config._dbApiKey || ""
  } else {
    config = loadLlmConfigFromEnv(options.envRootDir)
    const envStatus = getProjectEnvStatus(options.envRootDir)
    apiKey =
      process.env.LLM_API_KEY ||
      process.env.OPENAI_API_KEY ||
      envStatus.values.LLM_API_KEY ||
      envStatus.values.OPENAI_API_KEY ||
      ""
  }

  if (!apiKey) {
    throw new Error("No LLM API key found. Set LLM_API_KEY or OPENAI_API_KEY, or configure an active LLM in settings.")
  }


  const system = [
    AUTONOMOUS_DISCUSSION_PROTOCOL,
    "",
    `输出语言：${options.preferredLanguage === "en-US" ? "English" : "简体中文"}`,
    `当前工作流阶段：${options.currentStage ?? "worldbuilding_dialogue"}`,
    options.stageInstruction ? `阶段约束：${options.stageInstruction}` : "",
    "",
    options.basePrompt.trim(),
    "",
    options.dynamicPrompt.trim(),
    "",
    options.consensus.trim(),
    "",
    `Discussion stage: ${options.discussionStage ?? "specialist_turn"}`,
    options.discussionTarget
      ? `Discussion target: ${options.discussionTarget.label}\nTarget kind: ${options.discussionTarget.kind}\nTarget asset: ${options.discussionTarget.assetPath}\nTarget instruction: ${options.discussionTarget.instruction}`
      : "",
    "Response contract:",
    "- 必须使用简体中文输出。",
    "- 给出实质性讨论内容，不能只说一句拒绝。",
    "- 可以使用简短 markdown 小节与列表。",
    "- 必须停留在当前 target 内。",
    "- 除非明确进入 drafting 阶段，否则不能产出脱离阶段的章节正文。",
    "- Specialists 必须先给一个明确风险/批评/失败模式，再给建议。",
    "- Final synthesis 必须包含 `Final Consensus`、`Remaining Risk`、`Next Step`。",
    options.priorTranscript?.trim() ? `Prior roundtable transcript:\n${options.priorTranscript.trim()}` : "",
  ].join("\n")

  const startTime = Date.now()
  console.log(`[LLM REQUEST SEND] 准备向 API 发送 chat/completions 请求...`)
  console.log(`- BaseUrl: ${config.provider.baseUrl}`)
  console.log(`- Model: ${config.provider.modelName}`)
  console.log(`- Temperature: ${config.provider.temperature}`)
  console.log(`- Messages Count: ${options.message ? 2 : 1}`)
  console.log(`- System Prompt Length: ${system.length} chars`)
  console.log(`- User Message Length: ${(options.message || "").length} chars`)

  const content = await withTimeout(config.provider.timeoutMs, async (signal, markActivity) => {
    const response = await fetch(`${config.provider.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model: config.provider.modelName,
        temperature: config.provider.temperature,
        stream: Boolean(options.onDelta),
        messages: [
          { role: "system", content: system },
          { role: "user", content: options.message },
        ],
      }),
    })

    const fetchTime = Date.now() - startTime
    console.log(`[LLM REQUEST HEAD] 收到 API Response 头部，状态码: ${response.status}，HTTP建立连接与首包头耗时: ${fetchTime}ms`)

    if (!response.ok) {
      console.error(`[LLM REQUEST ERROR] 请求失败，状态码: ${response.status}`)
      throw new Error(`LLM request failed with status ${response.status}.`)
    }
    markActivity()

    if (options.onDelta) {
      return streamOpenAiCompatibleResponse(response, async (delta) => {
        markActivity()
        await options.onDelta?.(delta)
      }, {
        signal,
        markActivity,
        requestStartTime: startTime,
      })
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const totalTime = Date.now() - startTime
    const resContent = payload.choices?.[0]?.message?.content?.trim() || ""
    console.log(`[LLM REQUEST END] 非流式请求完成。总耗时: ${totalTime}ms，返回内容长度: ${resContent.length}`)

    return resContent
  }, options.signal)
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
  const config = activeConfig || loadLlmConfigFromEnv(rootDir)
  const envStatus = getProjectEnvStatus(rootDir)
  const checkedAt = new Date().toISOString()
  const baseUrl = overrides.baseUrl?.trim() || config.provider.baseUrl
  const modelName = overrides.modelName?.trim() || config.provider.modelName
  const apiKey =
    overrides.apiKey?.trim() ||
    (activeConfig ? activeConfig._dbApiKey : null) ||
    process.env.LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    envStatus.values.LLM_API_KEY ||
    envStatus.values.OPENAI_API_KEY

  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    return {
      ok: true,
      checkedAt,
      baseUrl,
      modelName,
      message: "Provider connectivity check passed in test mode.",
    }
  }

  if (!baseUrl || !modelName || !apiKey) {
    return {
      ok: false,
      checkedAt,
      baseUrl,
      modelName,
      message: "Missing provider config: LLM_BASE_URL, LLM_API_KEY, or LLM_MODEL_ID.",
    }
  }

  try {
    const response = await withTimeout(config.provider.timeoutMs, (signal) =>
      fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${apiKey}`,
        },
        signal,
      }),
    )

    if (!response.ok) {
      return {
        ok: false,
        checkedAt,
        baseUrl,
        modelName,
        message: `Provider test failed with status ${response.status}.`,
      }
    }

    const payload = await response.json() as { data?: Array<unknown> }
    const modelCount = Array.isArray(payload.data) ? payload.data.length : 0

    return {
      ok: true,
      checkedAt,
      baseUrl,
      modelName,
      message: `Provider reachable. ${modelCount} models listed.`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      checkedAt,
      baseUrl,
      modelName,
      message: `Provider test failed: ${message}`,
    }
  }
}
