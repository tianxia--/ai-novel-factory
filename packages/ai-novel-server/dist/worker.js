// src/worker.ts
import path from "path";
import { fileURLToPath } from "url";
import { runNovelAutopilotWorkerCli } from "ai-novel-core";
var currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runNovelAutopilotWorkerCli(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
