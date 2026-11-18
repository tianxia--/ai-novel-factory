import path from "node:path"
import { fileURLToPath } from "node:url"

import { runNovelAutopilotWorkerCli } from "ai-novel-core"

const currentFile = fileURLToPath(import.meta.url)

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runNovelAutopilotWorkerCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
