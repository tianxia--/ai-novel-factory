import fs from "node:fs"
import path from "node:path"

const PRIMARY_ENV_KEYS = {
  baseUrl: "LLM_BASE_URL",
  apiKey: "LLM_API_KEY",
  modelName: "LLM_MODEL_ID",
} as const

const FALLBACK_ENV_KEYS = {
  baseUrl: "OPENAI_BASE_URL",
  apiKey: "OPENAI_API_KEY",
  modelName: "OPENAI_MODEL_NAME",
} as const

export interface ProjectEnvValues {
  LLM_BASE_URL?: string
  LLM_API_KEY?: string
  LLM_MODEL_ID?: string
  OPENAI_BASE_URL?: string
  OPENAI_API_KEY?: string
  OPENAI_MODEL_NAME?: string
  LLM_TIMEOUT_MS?: string
  LLM_TEMPERATURE?: string
  MAX_STEPS?: string
  NOVEL_CHAPTER_WORD_TARGET?: string
  [key: string]: string | undefined
}

export interface ProjectEnvStatus {
  envPath: string
  exists: boolean
  configured: boolean
  missing: string[]
  values: ProjectEnvValues
  resolved: {
    baseUrl: string | null
    apiKeyPresent: boolean
    modelName: string | null
  }
}

function parseProjectEnv(raw: string) {
  const values: ProjectEnvValues = {}

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separator = trimmed.indexOf("=")
    if (separator <= 0) {
      continue
    }

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")
    values[key] = value
  }

  return values
}

function pickResolvedValue(primaryKey: string, fallbackKey: string, values: ProjectEnvValues) {
  const processValue = process.env[primaryKey]?.trim() || process.env[fallbackKey]?.trim()
  if (processValue) {
    return processValue
  }

  const fileValue = values[primaryKey]?.trim() || values[fallbackKey]?.trim()
  return fileValue || null
}

export function getProjectEnvPath(rootDir = process.cwd()) {
  return path.join(rootDir, ".env")
}

export function readProjectEnv(rootDir = process.cwd()) {
  const envPath = getProjectEnvPath(rootDir)
  if (!fs.existsSync(envPath)) {
    return {
      envPath,
      exists: false,
      values: {} as ProjectEnvValues,
    }
  }

  const raw = fs.readFileSync(envPath, "utf8")
  return {
    envPath,
    exists: true,
    values: parseProjectEnv(raw),
  }
}

export function getProjectEnvStatus(rootDir = process.cwd()): ProjectEnvStatus {
  const { envPath, exists, values } = readProjectEnv(rootDir)
  const resolved = {
    baseUrl: pickResolvedValue(PRIMARY_ENV_KEYS.baseUrl, FALLBACK_ENV_KEYS.baseUrl, values),
    apiKeyPresent: Boolean(pickResolvedValue(PRIMARY_ENV_KEYS.apiKey, FALLBACK_ENV_KEYS.apiKey, values)),
    modelName: pickResolvedValue(PRIMARY_ENV_KEYS.modelName, FALLBACK_ENV_KEYS.modelName, values),
  }

  const missing = [
    resolved.baseUrl ? null : PRIMARY_ENV_KEYS.baseUrl,
    resolved.apiKeyPresent ? null : PRIMARY_ENV_KEYS.apiKey,
    resolved.modelName ? null : PRIMARY_ENV_KEYS.modelName,
  ].filter(Boolean) as string[]

  return {
    envPath,
    exists,
    configured: missing.length === 0,
    missing,
    values,
    resolved,
  }
}

export function upsertProjectEnvValues(rootDir: string, updates: Record<string, string>) {
  const envPath = getProjectEnvPath(rootDir)
  const original = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : ""
  const lines = original ? original.split("\n") : []
  const nextKeys = new Set(Object.keys(updates))

  const rewritten = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      return line
    }

    const separator = line.indexOf("=")
    if (separator <= 0) {
      return line
    }

    const key = line.slice(0, separator).trim()
    const replacement = updates[key]
    if (replacement === undefined) {
      return line
    }

    nextKeys.delete(key)
    return `${key}=${replacement}`
  })

  for (const key of nextKeys) {
    rewritten.push(`${key}=${updates[key]}`)
  }

  const finalContent = `${rewritten.filter((line, index, array) => !(index === array.length - 1 && line === "")).join("\n")}\n`
  fs.writeFileSync(envPath, finalContent, "utf8")
}
