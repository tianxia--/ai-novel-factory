import {
  restoreAutopilotJobs,
  startAutopilotWorkerRuntime
} from "./chunk-2VTDVDGZ.js";
import {
  getProjectEnvStatus,
  getPublicProjectEnvStatus
} from "./chunk-ABBHC62H.js";
import {
  withFactoryDb
} from "./chunk-CRFEPMYG.js";

// src/worker.ts
import path from "path";
function parseFlags(argv) {
  const flags = /* @__PURE__ */ new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.set(key, "true");
      continue;
    }
    flags.set(key, next);
    index += 1;
  }
  return {
    rootDir: path.resolve(flags.get("root-dir") || process.cwd()),
    pollMs: flags.get("poll-ms") ? Number.parseInt(flags.get("poll-ms") || "60000", 10) : void 0,
    status: flags.get("status") === "true",
    once: flags.get("once") === "true"
  };
}
function serializeState(state) {
  if (!state) return null;
  return {
    project: state.project,
    runtime: state.runtime,
    reactSetup: state.reactSetup,
    plan: state.plan,
    assets: state.assets
  };
}
async function createWorkerWorkspacePayload(projectRoot, state, options = {}) {
  const factorySnapshot = options.rootDir && options.projectId ? await withFactoryDb(options.rootDir, async (db) => db.getSnapshot(options.projectId)).catch(() => null) : null;
  const resolvedState = factorySnapshot?.state ?? state ?? null;
  return {
    state: serializeState(resolvedState),
    transcript: "",
    consensus: "",
    contextPacket: "",
    graphIndex: null,
    graphViolations: [],
    factorySnapshot,
    projectRoot
  };
}
async function startNovelAutopilotWorker(options) {
  return startAutopilotWorkerRuntime({
    rootDir: options.rootDir,
    pollMs: options.pollMs,
    createSnapshot: createWorkerWorkspacePayload
  });
}
async function getNovelAutopilotWorkerStatus(rootDir) {
  const factory = await withFactoryDb(rootDir, async (db) => db.getOperationalStatus());
  return {
    ok: true,
    service: "ai-novel-worker",
    rootDir,
    factory,
    envStatus: getPublicProjectEnvStatus(rootDir)
  };
}
async function runNovelAutopilotWorkerOnce(rootDir) {
  await restoreAutopilotJobs(rootDir, createWorkerWorkspacePayload);
  return getNovelAutopilotWorkerStatus(rootDir);
}
async function runNovelAutopilotWorkerCli(args = process.argv.slice(2)) {
  const flags = parseFlags(args);
  if (flags.status) {
    console.log(JSON.stringify(await getNovelAutopilotWorkerStatus(flags.rootDir), null, 2));
    return;
  }
  if (flags.once) {
    console.log(JSON.stringify(await runNovelAutopilotWorkerOnce(flags.rootDir), null, 2));
    return;
  }
  await startNovelAutopilotWorker({
    rootDir: flags.rootDir,
    pollMs: flags.pollMs
  });
  console.log(`AI Novel Autopilot worker running for workspace: ${flags.rootDir}`);
  console.log(`Provider: ${getProjectEnvStatus(flags.rootDir).resolved.modelName || "not configured"}`);
}

export {
  createWorkerWorkspacePayload,
  startNovelAutopilotWorker,
  getNovelAutopilotWorkerStatus,
  runNovelAutopilotWorkerOnce,
  runNovelAutopilotWorkerCli
};
