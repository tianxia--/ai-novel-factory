import path from "node:path"
import { fileURLToPath } from "node:url"

import { startNovelStudioServer } from "./server"

interface ServerFlags {
  rootDir: string
  staticDir?: string
  port: number
  embeddedWorker?: boolean
}

function parseFlags(argv: string[]): ServerFlags {
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
    rootDir: flags.get("root-dir") || process.cwd(),
    staticDir: flags.get("static-dir"),
    port: Number.parseInt(flags.get("port") || "4310", 10),
    embeddedWorker: flags.get("embedded-worker") === "true",
  }
}

function resolveMaybeRelative(value: string | undefined, baseDir: string) {
  if (!value) return undefined
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value)
}

export async function startStandaloneNovelServer(options: Partial<ServerFlags> = {}) {
  const rootDir = options.rootDir || process.cwd()
  const staticDir = resolveMaybeRelative(options.staticDir, rootDir)
  return startNovelStudioServer({
    rootDir,
    staticDir,
    port: options.port || 4310,
    embeddedWorker: options.embeddedWorker,
  })
}

async function main() {
  const flags = parseFlags(process.argv.slice(2))
  const rootDir = path.resolve(flags.rootDir)
  const staticDir = resolveMaybeRelative(flags.staticDir, rootDir)
  const { port } = await startNovelStudioServer({
    rootDir,
    staticDir,
    port: flags.port,
    embeddedWorker: flags.embeddedWorker,
  })

  console.log(`AI Novel Server listening on http://127.0.0.1:${port}`)
  console.log(`Workspace root: ${rootDir}`)
  if (staticDir) {
    console.log(`Static client: ${staticDir}`)
  }
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
