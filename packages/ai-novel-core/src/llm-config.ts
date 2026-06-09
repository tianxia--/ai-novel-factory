import fsSync from "node:fs"
import path from "node:path"
import { getProjectEnvStatus } from "./env-manager"
import { withFactoryDb } from "./factory-db"



export interface LlmProviderConfig {
  provider: {
    baseUrl: string
    apiKeyEnv: string
    modelName: string
    timeoutMs: number
    temperature: number
    reactMaxSteps: number
  }
  writing: {
    chapterWordTarget: number
    chapterWordMinimum: number
  }
}

function readNumber(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function loadLlmConfigFromEnv(rootDir = process.cwd()): LlmProviderConfig {
  const envStatus = getProjectEnvStatus(rootDir)
  const dotEnv = envStatus.values
  const baseUrl =
    process.env.LLM_BASE_URL ||
    dotEnv.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    dotEnv.OPENAI_BASE_URL ||
    "https://api.openai.com/v1"

  const apiKeyEnv = process.env.LLM_API_KEY || dotEnv.LLM_API_KEY
    ? "LLM_API_KEY"
    : process.env.OPENAI_API_KEY || dotEnv.OPENAI_API_KEY
      ? "OPENAI_API_KEY"
      : "unset"

  const modelName =
    process.env.LLM_MODEL_ID ||
    dotEnv.LLM_MODEL_ID ||
    process.env.OPENAI_MODEL_NAME ||
    dotEnv.OPENAI_MODEL_NAME ||
    "gpt-4o"

  return {
    provider: {
      baseUrl,
      apiKeyEnv,
      modelName,
      timeoutMs: readNumber(process.env.LLM_TIMEOUT_MS || dotEnv.LLM_TIMEOUT_MS, 120000),
      temperature: readNumber(process.env.LLM_TEMPERATURE || dotEnv.LLM_TEMPERATURE, 0.1),
      reactMaxSteps: readNumber(process.env.MAX_STEPS || dotEnv.MAX_STEPS, 25),
    },
    writing: {
      chapterWordTarget: readNumber(process.env.NOVEL_CHAPTER_WORD_TARGET || dotEnv.NOVEL_CHAPTER_WORD_TARGET, 2500),
      chapterWordMinimum: 2500,
    },
  }
}

export interface ActiveLlmConfig extends LlmProviderConfig {
  _dbApiKey?: string
}

let cachedActiveLlmConfig: ActiveLlmConfig | null = null

export function getCachedActiveLlmConfig(): ActiveLlmConfig | null {
  return cachedActiveLlmConfig
}

export function setCachedActiveLlmConfig(config: ActiveLlmConfig | null): void {
  cachedActiveLlmConfig = config
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
  const dbRootDir = resolveFactoryRootDir(rootDir)
  try {
    const activeDbConfig = await withFactoryDb(dbRootDir, async (db) => {
      return db.getActiveLlmConfig()
    })
    if (!activeDbConfig) {
      cachedActiveLlmConfig = null
      return null
    }
    const config: ActiveLlmConfig = {
      provider: {
        baseUrl: activeDbConfig.base_url as string,
        apiKeyEnv: "DB_ACTIVE_CONFIG",
        modelName: activeDbConfig.model_name as string,
        timeoutMs: Number(activeDbConfig.timeout_ms) || 120000,
        temperature: Number(activeDbConfig.temperature) || 0.1,
        reactMaxSteps: 25,
      },
      writing: {
        chapterWordTarget: 2500,
        chapterWordMinimum: 2500,
      },
      _dbApiKey: activeDbConfig.api_key as string,
    }
    cachedActiveLlmConfig = config
    return config
  } catch (error) {
    console.error("Failed to load active LLM config from DB:", error)
    return null
  }
}

