import type { AutonomousNovelState } from "./cli-types"
import { withFactoryDb } from "./factory-db"
import {
  advanceAutonomousProject,
  loadAutonomousState,
  retryChapterProduction,
  reviewInterruption,
} from "./orchestrator"
import {
  createManualAdvanceCommand,
  createManualInterruptCommand,
  createManualRetryChapterCommand,
  type NovelDirectorCommand,
} from "./novel-director"
import { executeProductionAdvanceThroughKernel } from "./production-workflow"

export type DirectorCommandEventType =
  | "DIRECTOR_COMMAND_DECIDED"
  | "DIRECTOR_COMMAND_STARTED"
  | "DIRECTOR_COMMAND_COMPLETED"
  | "DIRECTOR_COMMAND_FAILED"

export interface ManualDirectorCommandOptions {
  factoryRootDir?: string
  projectId?: string | null
  requestedBy?: string
  source?: string
}

export interface ManualAdvanceOptions extends ManualDirectorCommandOptions {
  reason?: string
}

export interface ManualRetryChapterOptions extends ManualDirectorCommandOptions {
  runNow?: boolean
  maxRecoveryAttempts?: number
  reason?: string
}

export interface ManualInterruptOptions extends ManualDirectorCommandOptions {
  reason?: string
}

export async function recordDirectorCommandEvent(
  options: ManualDirectorCommandOptions,
  type: DirectorCommandEventType,
  command: NovelDirectorCommand,
  payload: Record<string, unknown> = {},
) {
  if (!options.factoryRootDir || !options.projectId) {
    return
  }

  await withFactoryDb(options.factoryRootDir, async (db) => db.recordEvent(options.projectId as string, null, type, {
    commandId: command.id,
    command: command.type,
    stage: command.stage,
    chapterNumber: "chapterNumber" in command ? command.chapterNumber : undefined,
    reason: command.reason,
    source: options.source || "manual",
    ...payload,
  })).catch(() => undefined)
}

function baseEventPayload(options: ManualDirectorCommandOptions) {
  return options.requestedBy ? { requestedBy: options.requestedBy } : {}
}

export async function executeManualAdvanceCommand(
  rootDir: string,
  options: ManualAdvanceOptions = {},
): Promise<{ state: AutonomousNovelState; command: NovelDirectorCommand }> {
  const beforeState = await loadAutonomousState(rootDir)
  const command = createManualAdvanceCommand(beforeState, options.reason)
  const basePayload = baseEventPayload(options)

  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_DECIDED", command, basePayload)
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_STARTED", command, basePayload)
  try {
    const { state } = await executeProductionAdvanceThroughKernel({
      rootDir,
      factoryRootDir: options.factoryRootDir || rootDir,
      projectId: options.projectId as string,
      state: beforeState,
      executionMode: "manual",
      externalRunId: command.id,
      metadata: { directorCommandId: command.id, source: options.source || "manual" },
    }, () => advanceAutonomousProject(rootDir, {
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId,
      directorCommandId: command.id,
    }))
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_COMPLETED", command, {
      ...basePayload,
      resultingStage: state.runtime.stage,
    })
    return { state, command }
  } catch (error) {
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_FAILED", command, {
      ...basePayload,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function executeManualRetryChapterCommand(
  rootDir: string,
  chapterNumber: number,
  options: ManualRetryChapterOptions = {},
): Promise<{ state: AutonomousNovelState; command: NovelDirectorCommand; recoveryLimited: boolean }> {
  const beforeState = await loadAutonomousState(rootDir)
  const command = createManualRetryChapterCommand(beforeState, chapterNumber, options.reason)
  const basePayload = baseEventPayload(options)

  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_DECIDED", command, basePayload)
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_STARTED", command, basePayload)
  try {
    const state = await retryChapterProduction(rootDir, chapterNumber, {
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId,
      directorCommandId: command.id,
      runNow: options.runNow,
      maxRecoveryAttempts: options.maxRecoveryAttempts,
    })
    const recoveryLimited = Boolean(state.plan.chapterTasks.find((task) => task.chapterNumber === chapterNumber)?.recoveryBlocked)
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_COMPLETED", command, {
      ...basePayload,
      resultingStage: state.runtime.stage,
      recoveryLimited,
    })
    return { state, command, recoveryLimited }
  } catch (error) {
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_FAILED", command, {
      ...basePayload,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function executeManualInterruptCommand(
  rootDir: string,
  message: string,
  options: ManualInterruptOptions = {},
): Promise<{ state: AutonomousNovelState; command: NovelDirectorCommand }> {
  const beforeState = await loadAutonomousState(rootDir)
  const command = createManualInterruptCommand(beforeState, message, options.reason)
  const basePayload = baseEventPayload(options)

  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_DECIDED", command, basePayload)
  await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_STARTED", command, basePayload)
  try {
    const review = await reviewInterruption({
      rootDir,
      message,
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId,
      directorCommandId: command.id,
    })
    const state = await loadAutonomousState(rootDir)
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_COMPLETED", command, {
      ...basePayload,
      resultingStage: state.runtime.stage,
      interruptionScope: review.scope,
    })
    return { state, command }
  } catch (error) {
    await recordDirectorCommandEvent(options, "DIRECTOR_COMMAND_FAILED", command, {
      ...basePayload,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
