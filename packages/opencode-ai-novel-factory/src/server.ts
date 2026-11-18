export {
  handleNovelStudioApi,
  startNovelStudioServer,
  writeServerErrorResponse,
} from "ai-novel-core/studio-server"

async function runCliServer() {
  const { runNovelStudioServerCli } = await import("ai-novel-core/studio-server")
  await runNovelStudioServerCli(process.argv.slice(2))
}

if (process.argv[1] && process.argv[1].endsWith("server.mjs")) {
  runCliServer().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
