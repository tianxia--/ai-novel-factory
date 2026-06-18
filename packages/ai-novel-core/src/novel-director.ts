import type { AutonomousNovelState } from "./cli-types"

export type NovelDirectorCommand =
  | {
      id: string
      type: "advance"
      stage: string
      reason: string
      advanceFirst: true
      parentCommandId?: string | null
    }
  | {
      id: string
      type: "discuss"
      stage: string
      message: string
      reason: string
    }
  | {
      id: string
      type: "retry_chapter"
      stage: string
      chapterNumber: number
      reason: string
    }
  | {
      id: string
      type: "interrupt"
      stage: string
      message: string
      reason: string
    }

export interface NovelDirectorInput {
  userMessage?: string
  correctionMessage?: string
}

function makeDirectorCommandId() {
  return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function isGenericAutopilotMessage(message: string) {
  return /^(开始|继续|go|start|continue|run|resume)$/i.test(message.trim())
}

function isProductionStage(stage: string) {
  return stage === "chapter_task_generation"
    || stage === "drafting"
    || stage === "reviewing"
}

function isAutopilotProductionResumeMessage(message: string) {
  const normalized = message.trim()
  if (!normalized) return false
  return /章节正文生产流程|正文写作|质量修订|AIGC\s*检测|自然度|记忆写回|从第\s*\d+\s*章|chapter\s*\d+/i.test(normalized)
    && /继续|恢复|resume|continue|不要重新构思|不要回到|既有章节队列/i.test(normalized)
}

export function shouldAdvanceBeforeDiscussion(
  state: AutonomousNovelState,
  initialMessage: string,
  correctionMessage: string,
) {
  if (correctionMessage.trim()) {
    return false
  }
  const trimmedInitialMessage = initialMessage.trim()
  const productionResumeMessage = isProductionStage(state.runtime.stage)
    && isAutopilotProductionResumeMessage(trimmedInitialMessage)
  if (trimmedInitialMessage && !isGenericAutopilotMessage(trimmedInitialMessage) && !productionResumeMessage) {
    return false
  }
  if (state.runtime.stage === "complete" && !state.plan.chapterTasks.every((task) => task.status === "complete")) {
    return true
  }
  if (state.runtime.stage === "worldbuilding_dialogue" && isGenericAutopilotMessage(trimmedInitialMessage)) {
    if (state.runtime.autopilot && (state.runtime.autopilot.loopCount || 0) > 0) {
      return true
    }
  }
  return [
    "setting_review",
    "master_planning",
    "chapter_task_generation",
    "drafting",
    "reviewing",
  ].includes(state.runtime.stage)
}

export function buildDirectorDiscussionMessage(state: AutonomousNovelState, initialMessage: string) {
  const trimmedInitialMessage = initialMessage.trim()
  if (trimmedInitialMessage && !isGenericAutopilotMessage(trimmedInitialMessage)) {
    return trimmedInitialMessage
  }

  if (state.runtime.stage === "worldbuilding_dialogue") {
    return "请继续自主收敛世界观、主角核心、冲突引擎和不可违背规则，形成可写回的统一结论。"
  }

  if (state.runtime.stage === "setting_review") {
    return "请审阅已冻结设定，指出设定漏洞、角色动机风险和进入主线规划前必须锁定的内容。"
  }

  if (state.runtime.stage === "master_planning") {
    return "请围绕主线规划继续讨论，收敛长线结构、关键伏笔、分卷压力和结局情感承诺。"
  }

  if (state.runtime.stage === "chapter_task_generation") {
    return "请检查章节蓝图是否能支撑连续写作，明确下一步进入正文写作时的执行重点。"
  }

  if (state.runtime.stage === "drafting") {
    const nextTask = state.plan.chapterTasks.find((task) => task.status === "pending")
    return nextTask
      ? `请围绕第 ${nextTask.chapterNumber} 章继续创作前讨论，明确本章目标、冲突、情绪推进和审校风险。`
      : "请检查全书章节任务是否已经完成，并收束最终状态。"
  }

  if (state.runtime.stage === "reviewing") {
    const blockedTask = state.plan.chapterTasks.find((task) => task.status === "blocked")
    return blockedTask
      ? `第 ${blockedTask.chapterNumber} 章质量门禁未通过，请基于最近质检原因制定返工重点，然后自动恢复该章生产。`
      : "请检查审校阶段是否仍有阻塞章节；如果没有，请恢复到后续正文写作。"
  }

  if (state.runtime.stage === "replanning") {
    return "请根据最近的用户中断重新规划受影响资产，并给出恢复连续写作的统一路径。"
  }

  return "请根据当前项目状态继续自主推进小说创作流程。"
}

export function decideNovelDirectorCommand(
  state: AutonomousNovelState,
  input: NovelDirectorInput = {},
): NovelDirectorCommand {
  const userMessage = input.userMessage ?? ""
  const correctionMessage = input.correctionMessage ?? ""

  if (shouldAdvanceBeforeDiscussion(state, userMessage, correctionMessage)) {
    return {
      id: makeDirectorCommandId(),
      type: "advance",
      stage: state.runtime.stage,
      reason: "当前阶段已有足够上下文，优先推进生产状态机。",
      advanceFirst: true,
      parentCommandId: null,
    }
  }

  const message = correctionMessage || buildDirectorDiscussionMessage(state, userMessage)
  return {
    id: makeDirectorCommandId(),
    type: "discuss",
    stage: state.runtime.stage,
    message,
    reason: correctionMessage.trim()
      ? "阶段守卫要求先纠偏讨论。"
      : "当前阶段需要先形成或修正 agent 共识。",
  }
}

export function createFollowUpAdvanceCommand(
  state: AutonomousNovelState,
  parentCommand: NovelDirectorCommand,
  reason = "讨论结论已写回，自动推进工作流。",
): NovelDirectorCommand {
  return {
    id: makeDirectorCommandId(),
    type: "advance",
    stage: state.runtime.stage,
    reason,
    advanceFirst: true,
    parentCommandId: parentCommand.id,
  }
}

export function createManualAdvanceCommand(
  state: AutonomousNovelState,
  reason = "用户手动请求推进工作流。",
): NovelDirectorCommand {
  return {
    id: makeDirectorCommandId(),
    type: "advance",
    stage: state.runtime.stage,
    reason,
    advanceFirst: true,
    parentCommandId: null,
  }
}

export function createManualRetryChapterCommand(
  state: AutonomousNovelState,
  chapterNumber: number,
  reason = "用户手动请求重试阻塞章节。",
): NovelDirectorCommand {
  return {
    id: makeDirectorCommandId(),
    type: "retry_chapter",
    stage: state.runtime.stage,
    chapterNumber,
    reason,
  }
}

export function createManualInterruptCommand(
  state: AutonomousNovelState,
  message: string,
  reason = "用户手动提交中断变更，进入影响范围评估。",
): NovelDirectorCommand {
  return {
    id: makeDirectorCommandId(),
    type: "interrupt",
    stage: state.runtime.stage,
    message,
    reason,
  }
}
