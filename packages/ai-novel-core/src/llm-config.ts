import fsSync from "node:fs"
import path from "node:path"
import { withFactoryDb } from "./factory-db"



export interface LlmProviderConfig {
  provider: {
    baseUrl: string
    apiKeyEnv: string
    modelName: string
    apiMode: LlmApiMode
    timeoutMs: number
    temperature: number
    reactMaxSteps: number
  }
  writing: {
    chapterWordTarget: number
    chapterWordMinimum: number
  }
}

export type LlmApiMode = "chat" | "responses"

function readNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readApiMode(value: string | undefined): LlmApiMode {
  return value?.trim().toLowerCase() === "responses" ? "responses" : "chat"
}

export function loadLlmConfigFromEnv(rootDir = process.cwd()): LlmProviderConfig {
  void rootDir
  return {
    provider: {
      baseUrl: "",
      apiKeyEnv: "unset",
      modelName: "",
      apiMode: "chat",
      timeoutMs: 120000,
      temperature: 0.1,
      reactMaxSteps: 25,
    },
    writing: {
      chapterWordTarget: 2500,
      chapterWordMinimum: 2500,
    },
  }
}

export interface ActiveLlmConfig extends LlmProviderConfig {
  _dbApiKey?: string
  _configId?: string
  _capability?: string
}

let cachedActiveLlmConfig: ActiveLlmConfig | null = null

export function getCachedActiveLlmConfig(): ActiveLlmConfig | null {
  return cachedActiveLlmConfig
}

export function setCachedActiveLlmConfig(config: ActiveLlmConfig | null): void {
  cachedActiveLlmConfig = config
}

export type LlmCapability = "text" | "image" | "video" | "audio" | "embedding" | string

export async function ensureEnvLlmConfigImported(rootDir = process.cwd()): Promise<void> {
  void rootDir
}

function isWorkspaceRoot(dir: string): boolean {
  try {
    const pkgPath = path.join(dir, "package.json")
    if (!fsSync.existsSync(pkgPath)) {
      return false
    }
    const content = fsSync.readFileSync(pkgPath, "utf8")
    const pkg = JSON.parse(content)
    return pkg.name === "ai-novel-factory-workspace"
  } catch {
    return false
  }
}

export function resolveFactoryRootDir(dir = process.cwd()): string {
  let current = path.resolve(dir)
  while (true) {
    if (isWorkspaceRoot(current)) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  const fallback = path.resolve(dir)
  const projectsIndex = fallback.indexOf(`${path.sep}.ai-novel-projects`)
  if (projectsIndex !== -1) {
    return fallback.slice(0, projectsIndex)
  }
  const novelIndex = fallback.indexOf(`${path.sep}.ai-novel`)
  if (novelIndex !== -1) {
    return fallback.slice(0, novelIndex)
  }
  return fallback
}

export async function loadActiveLlmConfig(rootDir = process.cwd()): Promise<ActiveLlmConfig | null> {
  return loadLlmConfigForCapability(rootDir, "text")
}

function dbConfigToActiveConfig(activeDbConfig: Record<string, unknown>, capability: string, rootDir = process.cwd()): ActiveLlmConfig {
  return {
    provider: {
      baseUrl: activeDbConfig.base_url as string,
      apiKeyEnv: "DB_ACTIVE_CONFIG",
      modelName: activeDbConfig.model_name as string,
      apiMode: readApiMode(activeDbConfig.api_mode as string | undefined),
      timeoutMs: Number(activeDbConfig.timeout_ms) || 120000,
      temperature: Number(activeDbConfig.temperature) || 0.1,
      reactMaxSteps: 25,
    },
    writing: {
      chapterWordTarget: 2500,
      chapterWordMinimum: 2500,
    },
    _dbApiKey: activeDbConfig.api_key as string,
    _configId: activeDbConfig.id as string,
    _capability: capability,
  }
}

export async function loadLlmConfigForCapability(rootDir = process.cwd(), capability: LlmCapability = "text"): Promise<ActiveLlmConfig | null> {
  const dbRootDir = resolveFactoryRootDir(rootDir)
  try {
    const activeDbConfig = await withFactoryDb(dbRootDir, async (db) => {
      return db.getLlmConfigForCapability(String(capability)) || (String(capability) === "text" ? db.getActiveLlmConfig() : null)
    })
    if (!activeDbConfig) {
      if (String(capability) === "text") {
        cachedActiveLlmConfig = null
      }
      return null
    }
    const config = dbConfigToActiveConfig(activeDbConfig, String(capability), rootDir)
    if (String(capability) === "text") {
      cachedActiveLlmConfig = config
    }
    return config
  } catch (error) {
    console.error(`Failed to load ${String(capability)} LLM config from DB:`, error)
    return null
  }
}
