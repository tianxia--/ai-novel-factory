import type { AutonomousNovelState } from "./cli-types"

// DiscussionTarget 内联定义（避免与 discussion.ts 循环引用）
interface DiscussionTargetLike {
  label: string
  assetPath: string
  instruction: string
}


// ─── 预算常量（字符数）────────────────────────────────────────────────────────
export const CONTEXT_BUDGET = {
  // 各类 Agent 的总上下文上限
  independent_total: 8_000,   // World Architect / Author / Prose Stylist（独立视角，不累积他人发言）
  reviewer_total: 10_000,     // Editor / Reviewer（需要看前面专家的核心意见）
  synthesis_total: 16_000,    // Showrunner closing_synthesis（需要综合所有专家输出）
  opening_total: 8_000,       // Showrunner opening_brief（需要看上一次讨论结论）

  // 各层独立上限
  story_core: 2_000,          // Layer 1：小说核心（标题/主角/阶段/讨论目标）
  role_specific: 4_000,       // Layer 3：角色专属内容（暂留给调用方控制）
  history: {
    independent: 0,           // 独立视角专家：不传历史（避免锚定效应）
    reviewer: 1_000,          // Editor/Reviewer：只看 World Architect + Author 的核心发言
    synthesis: 3_000,         // Showrunner 综合：所有专家发言的精华摘要
    opening: 500,             // Showrunner 开场：上一轮最终结论摘要
  },
} as const

// ─── 需要从历史记录中剔除的运行时噪声模式 ──────────────────────────────────────
const NOISE_PATTERNS: RegExp[] = [
  /\[LLM\s+REQUEST/i,
  /\[LLM\s+STREAM/i,
  /请求已送达\s*LLM/,
  /正在持续返回内容/,
  /LLM\s+已开始响应/,
  /LLM\s+返回完成/,
  /Status:\s*(in_progress|running|completed|error)/i,
  /step_\w+_(started|completed|streaming)/,
  /知识库召回/,
  /score:\s*[\d.]+/,
  /phase:\s*\w+/,
  /statusText:/,
  /statusDetail:/,
  /Agent.*消息会在模型返回/,
  /请求已提交给\s*LLM/,
  /等待模型开始响应/,
  /返回内容会持续合并/,
]

/**
 * 过滤运行时噪声，只保留创作相关内容。
 * 从末尾截断（保留最新内容），最多返回 `maxChars` 字符。
 */
export function filterCreativeHistory(transcript: string, maxChars: number): string {
  if (!transcript.trim() || maxChars <= 0) return ""

  const filtered = transcript
    .split("\n")
    .filter(line => !NOISE_PATTERNS.some(p => p.test(line)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (!filtered) return ""
  if (filtered.length <= maxChars) return filtered

  // 保留末尾（最新）内容
  return "…[历史已截断，保留最新内容]\n" + filtered.slice(filtered.length - maxChars)
}

// ─── Agent 分类 ───────────────────────────────────────────────────────────────
type AgentClass = "independent" | "reviewer" | "synthesis" | "opening"

function classifyAgent(agentId: string, discussionStage: string): AgentClass {
  if (agentId === "showrunner") {
    return discussionStage === "closing_synthesis" ? "synthesis" : "opening"
  }
  if (agentId === "editor" || agentId === "reviewer") return "reviewer"
  // world-architect / author / prose-stylist → independent
  return "independent"
}

/**
 * 根据 Agent 角色和当前阶段，为其构建合适的历史上下文。
 *
 * - 独立视角专家（World Architect / Author / Prose Stylist）：不传历史，避免锚定
 * - Editor / Reviewer：只看 World Architect 和 Author 的核心发言（最多 1,000 字）
 * - Showrunner closing_synthesis：所有专家发言精华（最多 3,000 字）
 * - Showrunner opening_brief：上一次讨论的最终结论摘要（最多 500 字）
 */
export function buildHistoryForAgent(
  agentId: string,
  discussionStage: string,
  currentReplies: Array<{ role: string; content: string }>,
  priorTranscript: string,
): string {
  const cls = classifyAgent(agentId, discussionStage)
  const limit = CONTEXT_BUDGET.history[cls]

  if (limit <= 0) return ""

  if (cls === "opening") {
    return filterCreativeHistory(priorTranscript, limit)
  }

  if (cls === "reviewer") {
    // Editor / Reviewer：参考 World Architect 和 Author 的核心意见
    const relevant = currentReplies
      .filter(r => r.role === "World Architect" || r.role === "Author")
      .map(r => `### ${r.role}\n${r.content.slice(0, 450)}`)
      .join("\n\n")
    return relevant.slice(0, limit)
  }

  if (cls === "synthesis") {
    // Showrunner 综合：汇总所有专家发言（各截取前 500 字防止单人占满）
    const all = currentReplies
      .filter(r => r.role !== "Showrunner")
      .map(r => `### ${r.role}\n${r.content.slice(0, 500)}`)
      .join("\n\n")
    return all.slice(0, limit)
  }

  return ""
}

/**
 * 构建 Layer 1（小说核心层）：所有 Agent 共享，但精简到 2,000 字以内。
 * 只包含最关键的项目信息、阶段状态、讨论目标和共识要点。
 * 不包含 RAG 召回、完整历史、流水线状态等无关内容。
 */
export function buildStoryCoreContext(
  state: Pick<AutonomousNovelState, "project" | "plan" | "runtime">,
  sanitizedConsensus: string,
  target: DiscussionTargetLike,
  userMessage: string,
): string {
  // 从共识文件中只提取前 8 条 bullet（核心设定事实）
  const bullets = sanitizedConsensus
    .split("\n")
    .filter(line => line.trim().startsWith("-"))
    .slice(0, 8)
    .join("\n")

  const parts = [
    `项目：${state.project.title}`,
    `核心创意：${state.project.idea}`,
    `工作流阶段：${state.runtime.stage}`,
    `计划章节数：${state.plan.totalChapters}，每章目标字数：${state.plan.chapterWordTarget}`,
    "",
    `本轮讨论目标：${target.label}`,
    `写回资产路径：${target.assetPath}`,
    target.instruction ? `目标指令：${target.instruction}` : "",
    "",
    `用户当前消息：${userMessage}`,
    "",
    bullets ? `核心共识要点（最多 8 条）：\n${bullets}` : "",
  ]

  const text = parts.filter(Boolean).join("\n").trim()
  if (text.length <= CONTEXT_BUDGET.story_core) return text

  // 超出则截断，保留开头的项目信息部分（比末尾更重要）
  return text.slice(0, CONTEXT_BUDGET.story_core) + "\n…[核心层已截断]"
}
