import { getProjectEnvStatus } from "./env-manager"

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
