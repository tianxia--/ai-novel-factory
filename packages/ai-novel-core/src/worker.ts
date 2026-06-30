import path from "node:path"

import type { AutonomousNovelState } from "./cli-types"
import { getPublicProjectEnvStatus } from "./env-manager"
import { loadLlmConfigForCapability } from "./llm-config"
import { restoreAutopilotJobs, startAutopilotWorkerRuntime } from "./autopilot-worker"
import { withFactoryDb } from "./factory-db"

function parseFlags(argv: string[]) {
  const flags = new Map<string, string>()

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) continue

    const key = token.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith("--")) {
      flags.set(key, "true")
      continue
    }
    flags.set(key, next)
    index += 1
  }

  return {
    rootDir: path.resolve(flags.get("root-dir") || process.cwd()),
    pollMs: flags.get("poll-ms") ? Number.parseInt(flags.get("poll-ms") || "60000", 10) : undefined,
    status: flags.get("status") === "true",
    once: flags.get("once") === "true",
  }
}

function serializeState(state: AutonomousNovelState | null) {
  if (!state) return null
  return {
    project: state.project,
    runtime: state.runtime,
    reactSetup: state.reactSetup,
    plan: state.plan,
    assets: state.assets,
  }
}

export async function createWorkerWorkspacePayload(
  projectRoot: string,
  state?: AutonomousNovelState | null,
  options: { rootDir?: string; projectId?: string | null } = {},
) {
  const factorySnapshot = options.rootDir && options.projectId
    ? await withFactoryDb(options.rootDir, async (db) => db.getSnapshot(options.projectId as string)).catch(() => null)
    : null
  const resolvedState = factorySnapshot?.state ?? state ?? null

  return {
    state: serializeState(resolvedState),
    transcript: "",
    consensus: "",
    contextPacket: "",
    graphIndex: null,
    graphViolations: [],
    factorySnapshot,
    projectRoot,
  }
}

export async function startNovelAutopilotWorker(options: { rootDir: string; pollMs?: number }) {
  return startAutopilotWorkerRuntime({
    rootDir: options.rootDir,
    pollMs: options.pollMs,
    createSnapshot: createWorkerWorkspacePayload,
  })
}

export async function getNovelAutopilotWorkerStatus(rootDir: string) {
  const factory = await withFactoryDb(rootDir, async (db) => db.getOperationalStatus())
  const textLlmConfig = await loadLlmConfigForCapability(rootDir, "text").catch(() => null)
  return {
    ok: true,
    service: "ai-novel-worker",
    rootDir,
    factory,
    envStatus: getPublicProjectEnvStatus(rootDir),
    llm: textLlmConfig
      ? {
          capability: textLlmConfig._capability || "text",
          configId: textLlmConfig._configId || null,
          baseUrl: textLlmConfig.provider.baseUrl,
          modelName: textLlmConfig.provider.modelName,
          apiMode: textLlmConfig.provider.apiMode,
          source: "database",
        }
      : {
          capability: "text",
          configId: null,
          baseUrl: "",
          modelName: "",
          apiMode: "chat",
          source: "unconfigured",
        },
  }
}

export async function runNovelAutopilotWorkerOnce(rootDir: string) {
  await restoreAutopilotJobs(rootDir, createWorkerWorkspacePayload)
  return getNovelAutopilotWorkerStatus(rootDir)
}

export async function runNovelAutopilotWorkerCli(args = process.argv.slice(2)) {
  const flags = parseFlags(args)
  if (flags.status) {
    console.log(JSON.stringify(await getNovelAutopilotWorkerStatus(flags.rootDir), null, 2))
    return
  }

  if (flags.once) {
    console.log(JSON.stringify(await runNovelAutopilotWorkerOnce(flags.rootDir), null, 2))
    return
  }

  await startNovelAutopilotWorker({
    rootDir: flags.rootDir,
    pollMs: flags.pollMs,
  })

  console.log(`AI Novel Autopilot worker running for workspace: ${flags.rootDir}`)
  const status = await getNovelAutopilotWorkerStatus(flags.rootDir)
  console.log(`Provider: ${status.llm.modelName || "not configured"} (${status.llm.apiMode}, ${status.llm.source})`)
}
