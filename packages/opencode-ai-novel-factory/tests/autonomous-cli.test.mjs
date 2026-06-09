import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createServer } from "node:http"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { pathToFileURL } from "node:url"

process.env.AI_NOVEL_TEST_MODE = "1"

const packageRoot = path.resolve(process.cwd())
const cliEntry = path.join(packageRoot, "dist", "cli.mjs")
const envManagerEntry = path.join(packageRoot, "dist", "env-manager.mjs")
const tuiControllerEntry = path.join(packageRoot, "dist", "tui-controller.mjs")
const discussionEntry = path.join(packageRoot, "dist", "discussion.mjs")
const tuiEntry = path.join(packageRoot, "dist", "tui.mjs")
const serverEntry = path.join(packageRoot, "dist", "server.mjs")
const superGraphEntry = path.join(packageRoot, "dist", "super-graph.mjs")
const pluginEntry = path.join(packageRoot, "dist", "index.mjs")
const coreEntry = path.join(process.cwd(), "..", "ai-novel-core", "dist", "index.js")
const viewModelEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "view-model.mjs")
const liveDiscussionEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "live-discussion.mjs")
const messageRendererEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "message-renderer.mjs")
const discussionRendererEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "discussion-renderer.mjs")
const desktopIndexEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "index.html")
const desktopAppEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "app.js")
const desktopStyleEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "style.css")

async function loadEnvManager() {
  return import(`${pathToFileURL(envManagerEntry).href}?ts=${Date.now()}`)
}

async function loadTuiController() {
  return import(`${pathToFileURL(tuiControllerEntry).href}?ts=${Date.now()}`)
}

async function loadDiscussionModule() {
  return import(`${pathToFileURL(discussionEntry).href}?ts=${Date.now()}`)
}

async function loadTuiModule() {
  return import(`${pathToFileURL(tuiEntry).href}?ts=${Date.now()}`)
}

async function loadServerModule() {
  return import(`${pathToFileURL(serverEntry).href}?ts=${Date.now()}`)
}

async function loadSuperGraphModule() {
  return import(`${pathToFileURL(superGraphEntry).href}?ts=${Date.now()}`)
}

async function loadPluginModule() {
  return import(`${pathToFileURL(pluginEntry).href}?ts=${Date.now()}`)
}

async function loadCoreModule() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

async function loadViewModelModule() {
  return import(`${pathToFileURL(viewModelEntry).href}?ts=${Date.now()}`)
}

async function loadLiveDiscussionModule() {
  return import(`${pathToFileURL(liveDiscussionEntry).href}?ts=${Date.now()}`)
}

async function loadMessageRendererModule() {
  return import(`${pathToFileURL(messageRendererEntry).href}?ts=${Date.now()}`)
}

async function loadDiscussionRendererModule() {
  return import(`${pathToFileURL(discussionRendererEntry).href}?ts=${Date.now()}`)
}

function runCli(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliEntry, ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", reject)
    child.on("close", (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

function runCliWithEnv(args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliEntry, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", reject)
    child.on("close", (code) => {
      resolve({ code, stdout, stderr })
    })
  })
}

test("ai-novel init creates autonomous workspace and queued chapter tasks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-init-"))

  const result = await runCli(
    ["init", "--idea", "A fallen sword immortal rebuilds heaven's order", "--chapters", "12"],
    tempDir,
  )

  assert.equal(result.code, 0, result.stderr)

  const statePath = path.join(tempDir, ".ai-novel", "state.json")
  const state = JSON.parse(await fs.readFile(statePath, "utf8"))

  assert.equal(state.project.idea, "A fallen sword immortal rebuilds heaven's order")
  assert.equal(state.plan.totalChapters, 12)
  assert.equal(state.plan.chapterTasks.length, 12)
  assert.equal(state.plan.chapterWordTarget, 2500)
  assert.equal(state.plan.chapterTasks[0].targetWords, 2500)
  assert.equal(state.runtime.stage, "worldbuilding_dialogue")

  const configPath = path.join(tempDir, ".ai-novel", "config.json")
  const config = JSON.parse(await fs.readFile(configPath, "utf8"))
  assert.equal(config.provider.modelName, "gpt-4o")
  assert.equal(config.writing.chapterWordTarget, 2500)

  const coverBriefPath = path.join(tempDir, ".ai-novel", "assets", "cover", "cover-brief.md")
  const comicPlanPath = path.join(tempDir, ".ai-novel", "assets", "comic", "comic-plan.md")
  assert.match(await fs.readFile(coverBriefPath, "utf8"), /cover/i)
  assert.match(await fs.readFile(comicPlanPath, "utf8"), /comic/i)

  const consensusPath = path.join(tempDir, ".ai-novel", "prompts", "global-consensus.md")
  const authorBasePath = path.join(tempDir, ".ai-novel", "prompts", "agents", "author.base.md")
  const authorDynamicPath = path.join(tempDir, ".ai-novel", "prompts", "agents", "author.dynamic.md")
  const styleProfilePath = path.join(tempDir, ".ai-novel", "style", "profile.md")
  const styleRulebookPath = path.join(tempDir, ".ai-novel", "style", "rulebook.md")
  const protagonistPath = path.join(tempDir, ".ai-novel", "memory", "characters", "core", "protagonist.md")

  assert.match(await fs.readFile(consensusPath, "utf8"), /Global Consensus/i)
  assert.match(await fs.readFile(authorBasePath, "utf8"), /Author Base Prompt/i)
  assert.match(await fs.readFile(authorDynamicPath, "utf8"), /Dynamic Prompt/i)
  assert.match(await fs.readFile(styleProfilePath, "utf8"), /Style Profile/i)
  assert.match(await fs.readFile(styleRulebookPath, "utf8"), /Style Rulebook/i)
  assert.match(await fs.readFile(protagonistPath, "utf8"), /Protagonist Seed/i)

  const superGraphPath = path.join(tempDir, ".ai-novel", "graph", "super-graph.json")
  const superGraph = JSON.parse(await fs.readFile(superGraphPath, "utf8"))
  assert.equal(superGraph.schemaVersion, 1)
  assert.ok(superGraph.nodes.some((node) => node.id === "mission:original"))
  assert.ok(superGraph.nodes.some((node) => node.id === "context:rag_recall"))
  assert.ok(superGraph.nodes.some((node) => node.id === "agent:showrunner"))
  assert.ok(superGraph.nodes.some((node) => node.id === "artifact:global-consensus"))
  assert.equal(superGraph.nodes.filter((node) => node.type === "ChapterTask").length, 12)
  assert.ok(superGraph.edges.some((edge) => edge.type === "CURRENT_STAGE" && edge.to === "stage:worldbuilding_dialogue"))
})

test("plugin novel-init and novel-status use the production managed project flow", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-plugin-prod-"))
  const { default: createPlugin } = await loadPluginModule()
  const plugin = await createPlugin({
    directory: tempDir,
    worktree: tempDir,
    client: {},
  })
  const context = { directory: tempDir }

  const initResult = await plugin.tool["novel-init"].execute({
    idea: "A lighthouse keeper audits dreams for a drowned empire",
    title: "Dream Ledger",
    chapters: 8,
    chapterWords: 2600,
  }, context)

  assert.match(initResult, /生产版 AI Novel Factory/)
  assert.match(initResult, /Project ID: dream-ledger/)
  assert.match(initResult, /factory\.sqlite/)

  const registry = JSON.parse(
    await fs.readFile(path.join(tempDir, ".ai-novel-projects", "projects.json"), "utf8"),
  )
  assert.equal(registry.length, 1)
  assert.equal(registry[0].id, "dream-ledger")
  assert.equal(registry[0].title, "Dream Ledger")

  const projectRoot = registry[0].projectRoot
  const state = JSON.parse(await fs.readFile(path.join(projectRoot, ".ai-novel", "state.json"), "utf8"))
  assert.equal(state.project.title, "Dream Ledger")
  assert.equal(state.plan.totalChapters, 8)
  assert.equal(state.plan.chapterWordTarget, 2600)

  await fs.access(path.join(tempDir, ".ai-novel-factory", "factory.sqlite"))
  await fs.access(path.join(projectRoot, ".ai-novel", "graph", "super-graph.json"))

  const statusResult = await plugin.tool["novel-status"].execute({}, context)
  assert.match(statusResult, /生产版项目状态/)
  assert.match(statusResult, /Project ID: dream-ledger/)
  assert.match(statusResult, /Autopilot:/)
  assert.match(statusResult, /factory\.sqlite/)
})

test("autonomous state saves survive concurrent writes with identical timestamps", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-state-atomic-"))
  const { createManagedAutonomousProject, loadAutonomousState, saveAutonomousState } = await loadCoreModule()
  const originalDateNow = Date.now

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A tax clerk investigates impossible city ledgers",
    title: "Atomic Ledger",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  try {
    Date.now = () => 1780518022024
    await Promise.all(Array.from({ length: 40 }, async (_, index) => {
      const state = structuredClone(created.state)
      state.runtime.statusMessage = `concurrent-save-${index}`
      await saveAutonomousState(created.project.projectRoot, state)
    }))
  } finally {
    Date.now = originalDateNow
  }

  const state = await loadAutonomousState(created.project.projectRoot)
  assert.match(state.runtime.statusMessage, /concurrent-save-\d+/)

  const workspaceEntries = await fs.readdir(path.join(created.project.projectRoot, ".ai-novel"))
  assert.equal(workspaceEntries.some((entry) => entry.endsWith(".tmp")), false)
})

test("factory db recovers stale workflow runs without clearing active durable jobs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-stale-runs-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCoreModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A river archivist catalogs storms before they happen",
    title: "Storm Archive",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  const recovered = await withFactoryDb(tempDir, async (db) => {
    db.createRun({
      id: "run-stale-discussion",
      projectId: created.project.id,
      projectRoot: created.project.projectRoot,
      kind: "discussion",
      status: "running",
      goal: "stale discussion",
      stage: created.state.runtime.stage,
    })
    db.createRun({
      id: "run-live-autopilot",
      projectId: created.project.id,
      projectRoot: created.project.projectRoot,
      kind: "autopilot",
      status: "running",
      goal: "live durable worker",
      stage: created.state.runtime.stage,
    })
    db.createJob({
      projectId: created.project.id,
      runId: "run-live-autopilot",
      kind: "autopilot",
      status: "running",
      payload: { message: "continue" },
    })
    return db.recoverStaleRuns({
      olderThan: new Date(Date.now() + 1000),
      error: "test_stale_run_recovered",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const staleRun = snapshot.latestRuns.find((run) => run.id === "run-stale-discussion")
  const liveRun = snapshot.latestRuns.find((run) => run.id === "run-live-autopilot")

  assert.equal(recovered, 1)
  assert.equal(staleRun.status, "failed")
  assert.equal(staleRun.error, "test_stale_run_recovered")
  assert.equal(liveRun.status, "running")
  assert.deepEqual(snapshot.activeRuns.map((run) => run.id), ["run-live-autopilot"])
  assert.ok(snapshot.latestEvents.some((event) => event.type === "WORKFLOW_RUN_RECOVERED"))
})

test("factory db keeps workflow runs active when agent turns are still progressing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-active-turn-run-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCoreModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A night clerk audits imperial omens",
    title: "Omen Ledger",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  const recovered = await withFactoryDb(tempDir, async (db) => {
    db.createRun({
      id: "run-active-discussion",
      projectId: created.project.id,
      projectRoot: created.project.projectRoot,
      kind: "discussion",
      status: "running",
      goal: "active discussion",
      stage: created.state.runtime.stage,
    })
    db.recordAgentTurn({
      runId: "run-active-discussion",
      turnId: "run-active-discussion:showrunner:1",
      role: "Showrunner",
      stage: "opening_brief",
      status: "in_progress",
      input: { message: "active" },
    })
    return db.recoverStaleRuns({
      olderThan: new Date(Date.now() - 1000),
      error: "should_not_recover_active_turn",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const activeRun = snapshot.latestRuns.find((run) => run.id === "run-active-discussion")

  assert.equal(recovered, 0)
  assert.equal(activeRun.status, "running")
  assert.deepEqual(snapshot.activeRuns.map((run) => run.id), ["run-active-discussion"])
})

test("super graph validates required nodes, edges, context layers, and workflow links", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-super-graph-"))
  const { validateSuperGraph, loadSuperGraph } = await loadSuperGraphModule()

  await runCli(["init", "--idea", "A minor clerk witnesses an empire collapse", "--chapters", "5"], tempDir)

  const graph = await loadSuperGraph(tempDir)
  const issues = validateSuperGraph(graph)

  assert.equal(issues.filter((issue) => issue.severity === "error").length, 0)
  assert.equal(graph.nodes.filter((node) => node.type === "ContextLayer").length, 9)
  assert.equal(graph.nodes.filter((node) => node.type === "Agent").length, 6)
  assert.equal(graph.edges.filter((edge) => edge.type === "NEXT_STAGE").length, 5)
  assert.ok(graph.edges.some((edge) => edge.type === "HAS_MISSION" && edge.to === "mission:original"))
})

test("ai-novel status reports current stage and pending chapter count", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-status-"))

  await runCli(["init", "--idea", "A palace intrigue revenge epic"], tempDir)
  const result = await runCli(["status"], tempDir)

  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /worldbuilding_dialogue/)
  assert.match(result.stdout, /pending chapters/i)
  assert.match(result.stdout, /chapter word target: 2500/i)
})

test("ai-novel init loads provider settings from a local .env file", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-dotenv-"))
  await fs.writeFile(
    path.join(tempDir, ".env"),
    [
      "LLM_BASE_URL=https://example.test/v1",
      "LLM_API_KEY=test-secret",
      "LLM_MODEL_ID=test-model",
      "LLM_TEMPERATURE=0.25",
      "NOVEL_CHAPTER_WORD_TARGET=3100",
      "",
    ].join("\n"),
  )

  const env = {
    ...process.env,
    LLM_BASE_URL: "",
    LLM_API_KEY: "",
    LLM_MODEL_ID: "",
    LLM_TEMPERATURE: "",
    NOVEL_CHAPTER_WORD_TARGET: "",
  }

  const result = await runCliWithEnv(
    ["init", "--idea", "A cartographer maps the afterlife"],
    tempDir,
    env,
  )

  assert.equal(result.code, 0, result.stderr)

  const config = JSON.parse(
    await fs.readFile(path.join(tempDir, ".ai-novel", "config.json"), "utf8"),
  )

  assert.equal(config.provider.baseUrl, "https://example.test/v1")
  assert.equal(config.provider.apiKeyEnv, "LLM_API_KEY")
  assert.equal(config.provider.modelName, "test-model")
  assert.equal(config.provider.temperature, 0.25)
  assert.equal(config.writing.chapterWordTarget, 2500)
})

test("env manager reports configuration state and can upsert provider values", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-env-manager-"))
  const { getProjectEnvStatus, upsertProjectEnvValues } = await loadEnvManager()

  let status = getProjectEnvStatus(tempDir)
  assert.equal(status.configured, false)
  assert.deepEqual(status.missing, ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL_ID"])

  upsertProjectEnvValues(tempDir, {
    LLM_BASE_URL: "https://provider.example/v1",
    LLM_MODEL_ID: "novel-model",
  })

  status = getProjectEnvStatus(tempDir)
  assert.equal(status.configured, false)
  assert.deepEqual(status.missing, ["LLM_API_KEY"])

  upsertProjectEnvValues(tempDir, {
    LLM_API_KEY: "super-secret",
  })

  status = getProjectEnvStatus(tempDir)
  assert.equal(status.configured, true)
  assert.equal(status.resolved.baseUrl, "https://provider.example/v1")
  assert.equal(status.resolved.apiKeyPresent, true)
  assert.equal(status.resolved.modelName, "novel-model")
})

test("env manager falls back to package .env for studio web roots", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-env-fallback-"))
  const packageEnvDir = path.join(tempDir, "packages", "opencode-ai-novel-factory")
  const managedProjectDir = path.join(tempDir, ".ai-novel-projects", "demo")
  const { getProjectEnvStatus } = await loadEnvManager()

  await fs.mkdir(packageEnvDir, { recursive: true })
  await fs.mkdir(managedProjectDir, { recursive: true })
  await fs.writeFile(
    path.join(packageEnvDir, ".env"),
    [
      "LLM_BASE_URL=https://package-env.example/v1",
      "LLM_API_KEY=package-secret",
      "LLM_MODEL_ID=package-model",
      "",
    ].join("\n"),
  )

  const rootStatus = getProjectEnvStatus(tempDir)
  assert.equal(rootStatus.configured, true)
  assert.equal(rootStatus.resolved.baseUrl, "https://package-env.example/v1")
  assert.equal(rootStatus.resolved.apiKeyPresent, true)
  assert.equal(rootStatus.resolved.modelName, "package-model")
  assert.equal(rootStatus.envPath, path.join(packageEnvDir, ".env"))

  const managedStatus = getProjectEnvStatus(managedProjectDir)
  assert.equal(managedStatus.configured, true)
  assert.equal(managedStatus.envPath, path.join(packageEnvDir, ".env"))
})

test("env manager upserts into the existing discovered .env file", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-env-write-path-"))
  const packageEnvDir = path.join(tempDir, "packages", "opencode-ai-novel-factory")
  const rootEnvPath = path.join(tempDir, ".env")
  const packageEnvPath = path.join(packageEnvDir, ".env")
  const { upsertProjectEnvValues, getProjectEnvStatus } = await loadEnvManager()

  await fs.mkdir(packageEnvDir, { recursive: true })
  await fs.writeFile(
    packageEnvPath,
    [
      "LLM_BASE_URL=https://package-env.example/v1",
      "LLM_API_KEY=package-secret",
      "LLM_MODEL_ID=package-model",
      "",
    ].join("\n"),
  )

  upsertProjectEnvValues(tempDir, {
    LLM_MODEL_ID: "package-model-updated",
  })

  assert.equal(await fs.readFile(packageEnvPath, "utf8"), [
    "LLM_BASE_URL=https://package-env.example/v1",
    "LLM_API_KEY=package-secret",
    "LLM_MODEL_ID=package-model-updated",
    "",
  ].join("\n"))
  assert.equal(await fs.access(rootEnvPath).then(() => true).catch(() => false), false)

  const status = getProjectEnvStatus(tempDir)
  assert.equal(status.resolved.modelName, "package-model-updated")
})

test("tui controller parses composer input into explicit actions", async () => {
  const { parseComposerInput } = await loadTuiController()

  assert.equal(parseComposerInput("   "), null)
  assert.deepEqual(parseComposerInput("主角应该更冷"), {
    type: "chat",
    message: "主角应该更冷",
  })
  assert.deepEqual(parseComposerInput("/advance"), {
    type: "advance",
  })
  assert.deepEqual(parseComposerInput("/cover"), {
    type: "cover",
  })
  assert.deepEqual(parseComposerInput("/provider-test"), {
    type: "provider-test",
  })
  assert.deepEqual(parseComposerInput("/interrupt 把整个故事改成赛博神话"), {
    type: "interrupt",
    message: "把整个故事改成赛博神话",
  })
  assert.deepEqual(
    parseComposerInput("/env base_url=https://example.test/v1 model=test-model api_key=secret"),
    {
      type: "env-update",
      updates: {
        LLM_BASE_URL: "https://example.test/v1",
        LLM_MODEL_ID: "test-model",
        LLM_API_KEY: "secret",
      },
    },
  )
})

test("tui controller executes composer actions against the autonomous workspace", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-tui-controller-"))
  const { executeComposerAction } = await loadTuiController()

  await fs.writeFile(
    path.join(tempDir, ".env"),
    [
      "LLM_BASE_URL=https://example.test/v1",
      "LLM_API_KEY=test-secret",
      "LLM_MODEL_ID=test-model",
      "",
    ].join("\n"),
  )

  await runCli(["init", "--idea", "A frost saint bargains with a dead sea"], tempDir)

  const advanceResult = await executeComposerAction(tempDir, { type: "advance" })
  assert.equal(advanceResult.state.runtime.stage, "setting_review")
  assert.match(advanceResult.summary, /setting_review/i)

  const providerResult = await executeComposerAction(tempDir, { type: "provider-test" })
  assert.equal(providerResult.state.runtime.lastProviderCheck.ok, true)
  assert.match(providerResult.summary, /provider/i)

  const chatResult = await executeComposerAction(tempDir, {
    type: "chat",
    message: "主角应该更安静，但绝不麻木",
  })
  assert.match(chatResult.summary, /discussion|chat/i)

  const transcript = await fs.readFile(path.join(tempDir, ".ai-novel", "chat", "discussion-log.md"), "utf8")
  assert.match(transcript, /主角应该更安静/)
})

test("cli and tui manual workflow changes go through shared director command executors", async () => {
  const cliSource = await fs.readFile(path.join(packageRoot, "src", "cli.ts"), "utf8")
  const tuiControllerSource = await fs.readFile(path.join(packageRoot, "src", "tui-controller.ts"), "utf8")
  const coreDirectorSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "director-commands.ts"), "utf8")

  assert.match(cliSource, /executeManualAdvanceCommand/)
  assert.match(cliSource, /executeManualInterruptCommand/)
  assert.doesNotMatch(cliSource, /advanceAutonomousProject/)
  assert.doesNotMatch(cliSource, /reviewInterruption/)
  assert.match(tuiControllerSource, /executeManualAdvanceCommand/)
  assert.match(tuiControllerSource, /executeManualInterruptCommand/)
  assert.doesNotMatch(tuiControllerSource, /advanceAutonomousProject/)
  assert.doesNotMatch(tuiControllerSource, /reviewInterruption/)
  assert.match(coreDirectorSource, /DIRECTOR_COMMAND_DECIDED/)
  assert.match(coreDirectorSource, /DIRECTOR_COMMAND_STARTED/)
  assert.match(coreDirectorSource, /DIRECTOR_COMMAND_COMPLETED/)
  assert.match(coreDirectorSource, /DIRECTOR_COMMAND_FAILED/)
})

test("multi-agent discussion runs an opening brief, specialist turns, and a closing synthesis", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-stream-events-"))
  const { runMultiAgentDiscussion } = await loadDiscussionModule()

  await runCli(["init", "--idea", "A frost saint bargains with a dead sea"], tempDir)

  const streamed = []
  const result = await runMultiAgentDiscussion(tempDir, "主角要更冷静克制", {
    onEvent(event) {
      streamed.push(`${event.role}: ${event.content}`)
    },
  })

  assert.ok(streamed.length >= 7)
  assert.match(streamed[0], /Showrunner:/i)
  assert.match(streamed[1], /World Architect:/i)
  assert.match(streamed[2], /Author:/i)
  assert.match(streamed[3], /Editor:/i)
  assert.match(streamed[4], /Reviewer:/i)
  assert.match(streamed[5], /Prose Stylist:/i)
  assert.match(streamed[6], /Showrunner:/i)
  assert.notEqual(streamed[0], streamed[6])
  assert.match(streamed[1], /Showrunner|brief|framing|focus/i)
  assert.match(result.summary, /synthesis|closure|consensus|team agrees/i)
})

test("multi-agent discussion keeps all roles focused on the same chapter planning target", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-discussion-target-"))
  const { runMultiAgentDiscussion } = await loadDiscussionModule()

  await runCli(["init", "--idea", "A frost saint bargains with a dead sea"], tempDir)

  const result = await runMultiAgentDiscussion(tempDir, "请讨论第七章的章节蓝图，不要直接写正文。")

  assert.equal(result.target.kind, "chapter")
  assert.match(result.target.assetPath, /chapter-blueprints/i)
  assert.match(result.summary, /chapter|blueprint|target/i)
  assert.match(result.replies[0].content, /Objective|目标|约束|Constraints/i)
  assert.match(result.replies[1].content, /Risk|风险|Recommendation|建议|Implication|影响/i)
  assert.ok(result.replies.every((reply) => !/###\s*第[一二三四五六七八九十0-9]+章|第四章|第五章|第六章|第七章/.test(reply.content)))
})

test("multi-agent discussion sanitizes stale choice-loop consensus and responds autonomously", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-autonomous-sanitize-"))
  const { runMultiAgentDiscussion } = await loadDiscussionModule()

  await runCli(["init", "--idea", "仙侠小时候"], tempDir)
  const consensusPath = path.join(tempDir, ".ai-novel", "prompts", "global-consensus.md")
  await fs.writeFile(
    consensusPath,
    [
      "# Global Consensus",
      "",
      "Latest discussion summary",
      "- Type Option B.",
      "- I am standing by.",
      "- What is your choice?",
      "",
    ].join("\n"),
  )

  const result = await runMultiAgentDiscussion(tempDir, "现在开始帮我写，从我的想法直接接管创作流程。")
  const sanitizedConsensus = await fs.readFile(consensusPath, "utf8")

  assert.doesNotMatch(result.summary, /Option B|What is your choice|I am standing by/i)
  assert.doesNotMatch(sanitizedConsensus, /Option B|What is your choice|I am standing by/i)
  assert.match(result.summary, /Final Consensus|共识|结论|Next Step/i)
  assert.doesNotMatch(result.summary, /chapter\s*2|prose production|current task/i)
  assert.match(result.summary, /[\u4e00-\u9fff]/u)
})

test("multi-agent discussion blocks pre-drafting chapter draft claims from production writeback", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-stage-guard-"))
  const { runMultiAgentDiscussion } = await loadDiscussionModule()

  await runCli(["init", "--idea", "一个长安小吏在诡异税册里追查王朝命数", "--chapters", "12"], tempDir)
  const statePath = path.join(tempDir, ".ai-novel", "state.json")
  const consensusPath = path.join(tempDir, ".ai-novel", "prompts", "global-consensus.md")
  const originalConsensus = await fs.readFile(consensusPath, "utf8")
  const originalTestMode = process.env.AI_NOVEL_TEST_MODE

  const server = createServer((request, response) => {
    let body = ""
    request.on("data", (chunk) => {
      body += String(chunk)
    })
    request.on("end", () => {
      const payload = JSON.parse(body)
      const content = [
        "Showrunner · 阶段切换确认",
        "设定收敛已完成，进入 drafting 阶段。本轮产出：第12章初稿（3000字）。",
        "",
        "第十二章 · 西市",
        "第十七天。天还没亮透，坊正派人来了。",
      ].join("\n")

      if (payload.stream) {
        response.writeHead(200, { "content-type": "text/event-stream" })
        response.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
        response.end("data: [DONE]\n\n")
        return
      }

      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ choices: [{ message: { content } }] }))
    })
  })

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  assert.equal(typeof address, "object")

  try {
    process.env.AI_NOVEL_TEST_MODE = "0"
    await fs.writeFile(
      path.join(tempDir, ".env"),
      [
        `LLM_BASE_URL=http://127.0.0.1:${address.port}/v1`,
        "LLM_API_KEY=test-secret",
        "LLM_MODEL_ID=test-model",
        "",
      ].join("\n"),
    )

    const result = await runMultiAgentDiscussion(tempDir, "设定这里继续收敛，不要正式写正文。", {
      envRootDir: tempDir,
    })
    const state = JSON.parse(await fs.readFile(statePath, "utf8"))
    const consensus = await fs.readFile(consensusPath, "utf8")
    const transcript = await fs.readFile(path.join(tempDir, ".ai-novel", "chat", "discussion-log.md"), "utf8")
    const chapterDirEntries = await fs.readdir(path.join(tempDir, ".ai-novel", "chapters"))

    assert.equal(result.writebackSkipped, true)
    assert.equal(result.stageGuard.status, "blocked")
    assert.match(result.summary, /阶段守卫拦截/)
    assert.equal(state.runtime.stage, "worldbuilding_dialogue")
    assert.match(state.runtime.lastAction, /discussion_guard_blocked/)
    assert.match(state.runtime.statusMessage, /阶段守卫/)
    assert.equal(consensus, originalConsensus)
    assert.match(transcript, /STAGE_GUARD_CORRECTION/)
    assert.match(transcript, /Stage Guard: blocked/)
    assert.equal(chapterDirEntries.length, 0)
  } finally {
    process.env.AI_NOVEL_TEST_MODE = originalTestMode
    await new Promise((resolve) => server.close(resolve))
  }
})

test("novel studio API handler exposes status, advance, and streamed chat events without sockets", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-server-"))
  const { handleNovelStudioApi } = await loadServerModule()

  await runCli(["init", "--idea", "A frost saint bargains with a dead sea"], tempDir)
  const statusResult = await handleNovelStudioApi(tempDir, "GET", "/api/status")
  assert.equal(statusResult.status, 200)
  assert.equal(statusResult.payload.state.project.idea, "A frost saint bargains with a dead sea")

  const advanceResult = await handleNovelStudioApi(tempDir, "POST", "/api/advance")
  assert.equal(advanceResult.status, 200)
  assert.equal(advanceResult.payload.state.runtime.stage, "setting_review")
  assert.ok(advanceResult.payload.factorySnapshot.latestEvents.some((event) => event.type === "DIRECTOR_COMMAND_DECIDED"))
  assert.ok(advanceResult.payload.factorySnapshot.latestEvents.some((event) => event.type === "DIRECTOR_COMMAND_STARTED"))
  const completedDirectorEvent = advanceResult.payload.factorySnapshot.latestEvents.find((event) => event.type === "DIRECTOR_COMMAND_COMPLETED")
  assert.match(completedDirectorEvent?.payload_json || "", /"commandId":"cmd_/)
  assert.match(completedDirectorEvent?.payload_json || "", /"command":"advance"/)
  assert.match(completedDirectorEvent?.payload_json || "", /"source":"api"/)
  assert.match(completedDirectorEvent?.payload_json || "", /"requestedBy":"api:\/api\/advance"/)
  assert.match(completedDirectorEvent?.payload_json || "", /"resultingStage":"setting_review"/)

  const streamed = []
  const streamResult = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/chat-stream",
    { message: "主角要更冷静克制" },
    {
      onStreamEvent(event) {
        streamed.push(`${event.role}: ${event.content}`)
      },
    },
  )
  assert.equal(streamResult.status, 200)
  assert.ok(streamed.length >= 7)
  assert.match(streamed[0], /Showrunner:/i)
  assert.match(streamed[6], /Showrunner:/i)
  assert.equal(streamResult.payload.events.length, streamed.length)
})

test("novel studio API records autopilot jobs in the factory database", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-server-autopilot-job-"))
  const { handleNovelStudioApi } = await loadServerModule()
  const { createManagedAutonomousProject, withFactoryDb } = await loadCoreModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A city registrar keeps accounts for ghosts",
    title: "Ghost Ledger",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  try {
    const result = await handleNovelStudioApi(
      tempDir,
      "POST",
      "/api/autopilot/start",
      { projectId: created.project.id, message: "继续无人值守推进设定收敛" },
    )

    assert.equal(result.status, 200)
    assert.equal(result.payload.activeProjectId, created.project.id)
    assert.equal(result.payload.factorySnapshot.project.id, created.project.id)
    assert.equal(result.payload.factorySnapshot.activeJobs.length, 1)
    assert.equal(result.payload.factorySnapshot.runnableJobs.length, 1)
    assert.ok(result.payload.factorySnapshot.latestEvents.some((event) => event.type === "JOB_CREATED"))
    assert.ok(result.payload.entries.some((entry) => entry.role === "User" && entry.content === "继续无人值守推进设定收敛"))
    assert.ok(result.payload.entries.some((entry) => entry.role === "System" && /写入后台任务队列/.test(entry.content)))
    assert.ok(result.payload.factorySnapshot.latestEvents.some((event) => event.type === "AUTOPILOT_MESSAGE_SUBMITTED"))
    assert.ok(result.payload.factorySnapshot.recentMessages.some((message) => message.type === "user" && message.data.content === "继续无人值守推进设定收敛"))
    assert.ok(result.payload.factorySnapshot.recentMessages.some((message) => message.type === "status" && /后台任务队列/.test(message.data.content)))
    assert.ok(result.payload.factorySnapshot.recentMessages.some((message) =>
      message.type === "tool"
      && message.data.toolName === "autopilot-start"
      && message.metadata?.source === "autopilot_start",
    ))
    const autopilotUserMessage = result.payload.factorySnapshot.recentMessages.find((message) =>
      message.type === "user"
      && message.metadata?.source === "autopilot_start"
    )
    const autopilotStatusMessage = result.payload.factorySnapshot.recentMessages.find((message) =>
      message.type === "status"
      && message.metadata?.source === "autopilot_start"
    )
    assert.ok(autopilotUserMessage.parts.some((part) => part.type === "text" && part.data.text === "继续无人值守推进设定收敛"))
    assert.ok(autopilotUserMessage.parts.some((part) => part.type === "json" && part.data.source === "autopilot_start"))
    assert.ok(autopilotStatusMessage.parts.some((part) => part.type === "markdown" && /无人值守任务已接收/.test(part.data.text)))
    assert.ok(autopilotStatusMessage.parts.some((part) => part.type === "json" && part.data.source === "autopilot_start"))

    const transcript = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "chat", "discussion-log.md"), "utf8")
    assert.match(transcript, /User: 继续无人值守推进设定收敛/)
    assert.match(transcript, /Status: autopilot_submitted/)

    const duplicateStart = await handleNovelStudioApi(
      tempDir,
      "POST",
      "/api/autopilot/start",
      { projectId: created.project.id, message: "继续无人值守推进设定收敛" },
    )
    assert.equal(duplicateStart.status, 200)
    assert.equal(duplicateStart.payload.factorySnapshot.activeJobs.length, 1)
    assert.ok(duplicateStart.payload.factorySnapshot.latestEvents.some((event) => event.type === "JOB_REUSED"))

    const jobEvents = await withFactoryDb(tempDir, async (db) =>
      db.getSnapshot(created.project.id).latestEvents.filter((event) => {
        if (event.type !== "JOB_CREATED") return false
        return JSON.parse(event.payload_json).kind === "autopilot"
      }),
    )
    assert.equal(jobEvents.length, 1)

    const stopResult = await handleNovelStudioApi(
      tempDir,
      "POST",
      "/api/autopilot/stop",
      { projectId: created.project.id },
    )
    assert.equal(stopResult.status, 200)
    const snapshotAfterStop = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(snapshotAfterStop.activeJobs.length, 1)
    assert.equal(snapshotAfterStop.activeJobs[0].status, "paused")
    assert.equal(snapshotAfterStop.runnableJobs.length, 1)
    assert.equal(snapshotAfterStop.runnableJobs[0].status, "paused")
    assert.ok(snapshotAfterStop.latestEvents.some((event) => {
      if (event.type !== "JOB_UPDATED") return false
      const payload = JSON.parse(event.payload_json)
      return payload.status === "paused"
    }))
    assert.ok(snapshotAfterStop.recentMessages.some((message) =>
      message.type === "status"
      && message.metadata?.source === "api_autopilot_stop"
      && /暂停请求/.test(message.data.content),
    ))
    assert.ok(snapshotAfterStop.recentMessages.some((message) =>
      message.type === "tool"
      && message.data.toolName === "autopilot-stop"
      && message.metadata?.source === "api_autopilot_stop",
    ))
  } finally {
    await handleNovelStudioApi(
      tempDir,
      "POST",
      "/api/autopilot/stop",
      { projectId: created.project.id },
    ).catch(() => undefined)
  }
})

test("novel studio API queues durable knowledge reindex jobs for worker processing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-server-knowledge-reindex-"))
  const { handleNovelStudioApi } = await loadServerModule()
  const {
    createManagedAutonomousProject,
    runNovelAutopilotWorkerOnce,
    withFactoryDb,
  } = await loadCoreModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A customs clerk catalogs idioms during a border rebellion",
    title: "Border Idiom Ledger",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  const result = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/knowledge/reindex",
    { projectId: created.project.id, scope: "all", limit: 2 },
  )

  assert.equal(result.status, 202)
  assert.equal(result.payload.activeProjectId, created.project.id)
  assert.ok(result.payload.queuedKnowledgeJobs.some((job) => job.kind === "knowledge_global_reindex"))
  assert.ok(result.payload.queuedKnowledgeJobs.some((job) => job.kind === "knowledge_project_artifact"))
  assert.ok(result.payload.factorySnapshot.latestEvents.some((event) => event.type === "KNOWLEDGE_REINDEX_QUEUED"))
  assert.ok(result.payload.factorySnapshot.recentMessages.some((message) =>
    message.type === "tool"
    && message.data.toolName === "knowledge-reindex"
    && message.metadata?.source === "api_knowledge_reindex",
  ))

  const jobsBeforeWorker = await withFactoryDb(tempDir, async (db) =>
    db.listRunnableJobs(undefined, new Date(), { includeIdle: true })
      .filter((job) => String(job.kind || "").startsWith("knowledge_")),
  )
  assert.ok(jobsBeforeWorker.some((job) => job.kind === "knowledge_global_reindex" && job.status === "idle"))

  await runNovelAutopilotWorkerOnce(tempDir)

  const snapshotAfterWorker = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshotAfterWorker.knowledge.summary.globalSources > 0)
  assert.ok(snapshotAfterWorker.knowledge.summary.projectSources > 0)
  assert.ok(snapshotAfterWorker.knowledge.summary.readyChunks > 0)
  assert.ok(snapshotAfterWorker.latestEvents.some((event) => {
    if (event.type !== "JOB_UPDATED") return false
    const payload = JSON.parse(event.payload_json)
    return String(payload.kind || "").startsWith("knowledge_") && payload.status === "completed"
  }))
})

test("novel studio API evaluates knowledge retrieval benchmarks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-server-knowledge-evaluate-"))
  const { handleNovelStudioApi } = await loadServerModule()
  const {
    createManagedAutonomousProject,
    ingestKnowledgeSource,
    retrieveKnowledge,
    withFactoryDb,
  } = await loadCoreModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk tracks court idioms during a border famine",
    title: "Court Idiom Ledger",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })
  await ingestKnowledgeSource({
    rootDir: tempDir,
    scope: "global",
    sourceType: "vocabulary",
    path: "resources/idioms.md",
    title: "Court Idioms",
    content: [
      "# Court Idioms",
      "",
      "宸命如山：适合朝堂命令压迫小人物的场景。",
      "",
      "市井风声：适合底层街巷传播消息的场景。",
    ].join("\n"),
  })
  const expectedRows = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: created.project.id,
    query: "宸命 朝堂 命令",
    scopes: ["global"],
    limit: 3,
  })
  assert.ok(expectedRows[0]?.id)

  const result = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/knowledge/evaluate",
    {
      projectId: created.project.id,
      cases: [
        {
          name: "court command vocabulary",
          query: "宸命 朝堂 命令",
          expectedChunkIds: [String(expectedRows[0].id)],
          scopes: ["global"],
          k: 3,
        },
      ],
    },
  )

  assert.equal(result.status, 200)
  assert.equal(result.payload.activeProjectId, created.project.id)
  assert.equal(result.payload.knowledgeEvaluation.summary.totalCases, 1)
  assert.equal(result.payload.knowledgeEvaluation.summary.hitRateAtK, 1)
  assert.ok(result.payload.factorySnapshot.latestEvents.some((event) => event.type === "KNOWLEDGE_EVALUATION_COMPLETED"))
  assert.equal(result.payload.factorySnapshot.knowledge.latestEvaluation.payload.summary.totalCases, 1)
  assert.ok(result.payload.factorySnapshot.artifacts.some((artifact) =>
    artifact.path === ".ai-novel/knowledge/evaluation-latest.md"
    && artifact.kind === "checkpoint",
  ))
  assert.ok(result.payload.factorySnapshot.recentMessages.some((message) =>
    message.type === "tool"
    && message.data.toolName === "knowledge-evaluate"
    && message.metadata?.source === "api_knowledge_evaluate",
  ))

  const report = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "knowledge", "evaluation-latest.md"), "utf8")
  assert.match(report, /Knowledge Retrieval Evaluation/)
  assert.match(report, /Hit@K/)

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.latestEvents.some((event) => event.type === "KNOWLEDGE_EVALUATION_COMPLETED"))
  assert.equal(snapshot.knowledge.latestEvaluation.payload.summary.totalCases, 1)
  assert.ok(snapshot.artifacts.some((artifact) => artifact.path === ".ai-novel/knowledge/evaluation-latest.md"))
})

test("novel studio API searches knowledge resources and records citations", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-server-knowledge-search-"))
  const { handleNovelStudioApi } = await loadServerModule()
  const {
    createManagedAutonomousProject,
    ingestKnowledgeSource,
    withFactoryDb,
  } = await loadCoreModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A small clerk survives late Tang markets with idiom ledgers",
    title: "Market Idiom Ledger",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })
  await ingestKnowledgeSource({
    rootDir: tempDir,
    scope: "global",
    sourceType: "vocabulary",
    path: "resources/idioms.md",
    title: "Market Idioms",
    content: [
      "# Market Idioms",
      "",
      "市井风声：适合底层街巷传播消息的场景。",
      "",
      "宸命如山：适合朝堂命令压迫小人物的场景。",
    ].join("\n"),
  })

  const result = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/knowledge/search",
    {
      projectId: created.project.id,
      query: "市井 风声 街巷 消息",
      scopes: ["global"],
      sourceTypes: ["vocabulary"],
      limit: 5,
    },
  )

  assert.equal(result.status, 200)
  assert.equal(result.payload.activeProjectId, created.project.id)
  assert.equal(result.payload.knowledgeSearch.query, "市井 风声 街巷 消息")
  assert.equal(result.payload.knowledgeSearch.filters.scopes[0], "global")
  assert.ok(result.payload.knowledgeSearch.rows.some((row) =>
    row.source.sourceType === "vocabulary"
    && /市井风声/.test(row.content),
  ))
  assert.ok(result.payload.factorySnapshot.knowledge.citations.some((citation) =>
    citation.query === "市井 风声 街巷 消息",
  ))
  assert.ok(result.payload.factorySnapshot.recentMessages.some((message) =>
    message.type === "tool"
    && message.data.toolName === "knowledge-search"
    && message.metadata?.source === "api_knowledge_search",
  ))

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.knowledge.citations.some((citation) => citation.query === "市井 风声 街巷 消息"))
})

test("novel studio API can explicitly retry a blocked chapter", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-server-chapter-retry-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCoreModule()
  const { handleNovelStudioApi } = await loadServerModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A magistrate edits verdicts with forbidden poems",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  const state = created.state
  state.runtime.stage = "reviewing"
  state.plan.chapterTasks[0].status = "blocked"
  state.plan.chapterTasks[0].qualityGate = {
    status: "blocked",
    score: 5,
    attempts: 2,
    reason: "综合评分 5/10，低于通过阈值。",
    updatedAt: "2026-06-03T00:00:00.000Z",
  }
  await fs.writeFile(
    path.join(created.project.projectRoot, ".ai-novel", "state.json"),
    `${JSON.stringify(state, null, 2)}\n`,
  )
  await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

  const result = await handleNovelStudioApi(tempDir, "POST", "/api/chapters/retry", {
    projectId: created.project.id,
    chapterNumber: 1,
  })

  assert.equal(result.status, 200)
  assert.equal(result.payload.state.plan.chapterTasks[0].status, "complete")
  assert.equal(result.payload.state.plan.chapterTasks[0].recoveryAttempts, 1)
  assert.ok(result.payload.factorySnapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_RECOVERY_QUEUED"))
  assert.ok(result.payload.factorySnapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_COMPLETED"))
  const retryDirectorEvent = result.payload.factorySnapshot.latestEvents.find((event) => event.type === "DIRECTOR_COMMAND_COMPLETED")
  assert.match(retryDirectorEvent?.payload_json || "", /"command":"retry_chapter"/)
  assert.match(retryDirectorEvent?.payload_json || "", /"chapterNumber":1/)
  assert.match(retryDirectorEvent?.payload_json || "", /"requestedBy":"api:\/api\/chapters\/retry"/)
  const retryQueuedEvent = result.payload.factorySnapshot.latestEvents.find((event) => event.type === "CHAPTER_PIPELINE_RECOVERY_QUEUED")
  assert.match(retryQueuedEvent?.payload_json || "", /"directorCommandId":"cmd_/)
  assert.ok(result.payload.factorySnapshot.recentMessages.some((message) =>
    message.type === "status"
    && message.metadata?.source === "api_chapter_retry"
    && message.metadata?.chapterNumber === 1,
  ))
  assert.ok(result.payload.factorySnapshot.recentMessages.some((message) =>
    message.type === "tool"
    && message.data.toolName === "chapter-retry"
    && message.metadata?.source === "api_chapter_retry"
    && message.metadata?.chapterNumber === 1,
  ))

  const previewResult = await handleNovelStudioApi(
    tempDir,
    "GET",
    "/api/chapters/preview?chapterNumber=1",
    {},
    { projectId: created.project.id },
  )
  assert.equal(previewResult.status, 200)
  assert.equal(previewResult.payload.chapterNumber, 1)
  assert.match(previewResult.payload.path, /chapter-001\.final\.md/)
  assert.match(previewResult.payload.content, /Final Body/)

  const artifactPreviewResult = await handleNovelStudioApi(
    tempDir,
    "GET",
    "/api/artifacts/preview?path=.ai-novel/chapters/chapter-001.final.md",
    {},
    { projectId: created.project.id },
  )
  assert.equal(artifactPreviewResult.status, 200)
  assert.match(artifactPreviewResult.payload.path, /chapter-001\.final\.md/)
  assert.match(artifactPreviewResult.payload.content, /Final Body/)

  result.payload.state.plan.chapterTasks[0].status = "blocked"
  result.payload.state.plan.chapterTasks[0].recoveryAttempts = 3
  await fs.writeFile(
    path.join(created.project.projectRoot, ".ai-novel", "state.json"),
    `${JSON.stringify(result.payload.state, null, 2)}\n`,
  )
  const limited = await handleNovelStudioApi(tempDir, "POST", "/api/chapters/retry", {
    projectId: created.project.id,
    chapterNumber: 1,
  })
  assert.equal(limited.status, 200)
  assert.equal(limited.payload.recoveryLimited, false)
  assert.equal(limited.payload.state.plan.chapterTasks[0].recoveryBlocked, false)
  assert.equal(limited.payload.state.plan.chapterTasks[0].status, "complete")
  assert.ok(limited.payload.factorySnapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED"))
})

test("novel studio API records interruption changes through director command events", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-server-interrupt-command-"))
  const { createManagedAutonomousProject } = await loadCoreModule()
  const { handleNovelStudioApi } = await loadServerModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A mountain village alchemist rises",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const result = await handleNovelStudioApi(tempDir, "POST", "/api/interrupt", {
    projectId: created.project.id,
    message: "Change the entire genre to cyberpunk and rewrite the core world rules",
  })

  assert.equal(result.status, 200)
  assert.equal(result.payload.state.runtime.stage, "replanning")
  assert.equal(result.payload.state.runtime.lastInterruption.scope, "global")
  const completedDirectorEvent = result.payload.factorySnapshot.latestEvents.find((event) => event.type === "DIRECTOR_COMMAND_COMPLETED")
  assert.match(completedDirectorEvent?.payload_json || "", /"command":"interrupt"/)
  assert.match(completedDirectorEvent?.payload_json || "", /"requestedBy":"api:\/api\/interrupt"/)
  assert.match(completedDirectorEvent?.payload_json || "", /"resultingStage":"replanning"/)
  assert.match(completedDirectorEvent?.payload_json || "", /"interruptionScope":"global"/)
  const interruptionEvent = result.payload.factorySnapshot.latestEvents.find((event) => event.type === "INTERRUPTION_REVIEWED")
  assert.match(interruptionEvent?.payload_json || "", /"directorCommandId":"cmd_/)
  assert.equal(result.payload.factorySnapshot.state.runtime.stage, "replanning")
})

test("studio project api creates isolated projects and requires selection when multiple exist", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-managed-projects-"))
  const { handleNovelStudioApi } = await loadServerModule()

  const firstCreate = await handleNovelStudioApi(tempDir, "POST", "/api/projects", {
    title: "Blind Stargazer",
    idea: "A blind stargazer hears the future in cosmic noise",
    chapters: 18,
    chapterWords: 2600,
  })
  const secondCreate = await handleNovelStudioApi(tempDir, "POST", "/api/projects", {
    title: "Ash Kingdom",
    idea: "A fallen prince rebuilds an ash kingdom from ruin",
    chapters: 32,
    chapterWords: 2800,
  })

  assert.equal(firstCreate.status, 201)
  assert.equal(secondCreate.status, 201)
  assert.ok(firstCreate.payload.projectId)
  assert.equal(firstCreate.payload.kickoffQueued, false)
  assert.equal(firstCreate.payload.autopilotQueued, false)
  assert.equal(firstCreate.payload.autopilotJobId, null)
  assert.equal(Object.prototype.hasOwnProperty.call(firstCreate.payload, "factorySnapshot"), false)
  assert.equal(Object.prototype.hasOwnProperty.call(firstCreate.payload, "entries"), false)
  assert.equal(firstCreate.payload.state.runtime.autopilot.running, false)
  assert.equal(firstCreate.payload.state.runtime.autopilot.lastStep, "awaiting_user_start")

  const firstCreateStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: firstCreate.payload.projectId })
  assert.equal(firstCreateStatus.status, 200)
  assert.equal(firstCreateStatus.payload.factorySnapshot.activeJobs.length, 0)
  assert.ok(firstCreateStatus.payload.factorySnapshot.recentMessages.some((message) => message.type === "status" && /开始创作/.test(`${message.data.title}\n${message.data.content}`)))

  const managedChat = await handleNovelStudioApi(tempDir, "POST", "/api/chat-stream", {
    projectId: firstCreate.payload.projectId,
    message: "主角要更冷静克制",
  })
  assert.equal(managedChat.status, 200)
  assert.ok(managedChat.payload.entries.some((entry) => entry.type === "user" && entry.content === "主角要更冷静克制"))

  const managedMessages = await handleNovelStudioApi(tempDir, "GET", "/api/messages?limit=30", {}, { projectId: firstCreate.payload.projectId })
  assert.equal(managedMessages.status, 200)
  assert.ok(managedMessages.payload.messages.some((message) => message.type === "user" && message.data.content === "主角要更冷静克制"))
  assert.ok(managedMessages.payload.messages.some((message) => message.type === "agent" && message.data.agentType === "showrunner"))
  assert.equal(managedMessages.payload.pagination.limit, 30)
  assert.equal(managedMessages.payload.pagination.offset, 0)
  assert.equal(managedMessages.payload.pagination.returned, managedMessages.payload.messages.length)

  const pagedManagedMessages = await handleNovelStudioApi(tempDir, "GET", "/api/messages?limit=1&offset=1", {}, { projectId: firstCreate.payload.projectId })
  assert.equal(pagedManagedMessages.status, 200)
  assert.equal(pagedManagedMessages.payload.messages.length, 1)
  assert.equal(pagedManagedMessages.payload.pagination.limit, 1)
  assert.equal(pagedManagedMessages.payload.pagination.offset, 1)

  const listResult = await handleNovelStudioApi(tempDir, "GET", "/api/projects")
  assert.equal(listResult.status, 200)
  assert.equal(listResult.payload.projects.length, 2)

  const ambiguousStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status")
  assert.equal(ambiguousStatus.status, 409)
  assert.equal(ambiguousStatus.payload.error, "project_selection_required")

  const firstLightStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: firstCreate.payload.projectId })
  assert.equal(Object.prototype.hasOwnProperty.call(firstLightStatus.payload, "transcript"), false)
  assert.equal(typeof firstLightStatus.payload.snapshotVersion, "string")
  assert.ok(firstLightStatus.payload.snapshotVersion.length > 0)
  assert.ok(firstLightStatus.payload.state.plan.chapterTaskSummary.total > 0)
  assert.equal(firstLightStatus.payload.state.plan.chapterTaskSummary.page, 1)
  assert.equal(firstLightStatus.payload.state.plan.chapterTaskSummary.pageSize, 20)
  assert.ok(firstLightStatus.payload.factorySnapshot.latestEvents.length <= 24)
  assert.ok(firstLightStatus.payload.factorySnapshot.recentMemory.length <= 6)
  assert.ok(firstLightStatus.payload.factorySnapshot.artifacts.length <= 24)
  assert.ok(firstLightStatus.payload.factorySnapshot.artifacts.some((artifact) => artifact.path === ".ai-novel/prompts/global-consensus.md"))
  assert.ok(firstLightStatus.payload.factorySnapshot.artifacts.some((artifact) => artifact.path === ".ai-novel/context/current-context.md"))

  const pagedStatus = await handleNovelStudioApi(
    tempDir,
    "GET",
    "/api/status?chapterPage=2&chapterPageSize=10",
    {},
    { projectId: secondCreate.payload.projectId },
  )
  assert.equal(pagedStatus.status, 200)
  assert.equal(pagedStatus.payload.state.plan.chapterTaskSummary.page, 2)
  assert.equal(pagedStatus.payload.state.plan.chapterTaskSummary.pageSize, 10)
  assert.equal(pagedStatus.payload.state.plan.chapterTasks[0].chapterNumber, 11)
  assert.equal(pagedStatus.payload.state.plan.chapterTasks.at(-1).chapterNumber, 20)

  const unchangedStatus = await handleNovelStudioApi(
    tempDir,
    `GET`,
    `/api/status?knownSnapshotVersion=${encodeURIComponent(firstLightStatus.payload.snapshotVersion)}`,
    {},
    { projectId: firstCreate.payload.projectId },
  )
  assert.equal(unchangedStatus.status, 200)
  assert.equal(unchangedStatus.payload.notModified, true)
  assert.equal(unchangedStatus.payload.snapshotVersion, firstLightStatus.payload.snapshotVersion)
  assert.equal(Object.prototype.hasOwnProperty.call(unchangedStatus.payload, "state"), false)
  assert.equal(Object.prototype.hasOwnProperty.call(unchangedStatus.payload, "factorySnapshot"), false)

  const changedStatus = await handleNovelStudioApi(
    tempDir,
    `GET`,
    `/api/status?includeTranscript=1&knownSnapshotVersion=${encodeURIComponent(firstLightStatus.payload.snapshotVersion)}`,
    {},
    { projectId: firstCreate.payload.projectId },
  )
  assert.equal(changedStatus.status, 200)
  assert.equal(Object.prototype.hasOwnProperty.call(changedStatus.payload, "transcript"), true)
  assert.equal(Object.prototype.hasOwnProperty.call(changedStatus.payload, "state"), true)

  const advanceFirst = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/advance",
    { projectId: firstCreate.payload.projectId },
  )
  assert.equal(advanceFirst.status, 200)
  const advancedStatus = await handleNovelStudioApi(
    tempDir,
    `GET`,
    `/api/status?knownSnapshotVersion=${encodeURIComponent(firstLightStatus.payload.snapshotVersion)}`,
    {},
    { projectId: firstCreate.payload.projectId },
  )
  assert.equal(advancedStatus.status, 200)
  assert.notEqual(advancedStatus.payload.notModified, true)
  assert.equal(Object.prototype.hasOwnProperty.call(advancedStatus.payload, "state"), true)
  assert.notEqual(advancedStatus.payload.snapshotVersion, firstLightStatus.payload.snapshotVersion)

  const firstTranscriptPayload = await handleNovelStudioApi(tempDir, "GET", "/api/transcript?limit=6", {}, { projectId: firstCreate.payload.projectId })
  assert.equal(firstTranscriptPayload.status, 200)
  assert.equal(firstTranscriptPayload.payload.entries.length <= 6, true)
  assert.ok(firstTranscriptPayload.payload.meta.totalEntries >= firstTranscriptPayload.payload.entries.length)
  assert.ok(firstTranscriptPayload.payload.meta.transcriptBytes > 0)
  assert.ok(firstTranscriptPayload.payload.entries.some((entry) => /Showrunner|User|Author|Editor|Reviewer|World Architect/.test(entry.role)))
  assert.ok(firstTranscriptPayload.payload.entries.every((entry) => typeof entry.timestamp === "string" && entry.timestamp.length > 0))

  const firstStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status?includeTranscript=1", {}, { projectId: firstCreate.payload.projectId })
  const secondStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status?includeTranscript=1", {}, { projectId: secondCreate.payload.projectId })

  assert.equal(firstStatus.status, 200)
  assert.equal(secondStatus.status, 200)
  assert.equal(firstStatus.payload.state.project.idea, "A blind stargazer hears the future in cosmic noise")
  assert.equal(secondStatus.payload.state.project.idea, "A fallen prince rebuilds an ash kingdom from ruin")

  assert.ok(firstStatus.payload.entries.some((entry) => entry.content === "主角要更冷静克制"))
  assert.ok(!secondStatus.payload.entries.some((entry) => entry.content === "主角要更冷静克制"))
})

test("studio project api deletes one managed project and cancels its durable jobs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-delete-project-"))
  const { handleNovelStudioApi } = await loadServerModule()
  const { withFactoryDb } = await loadCoreModule()

  const createResult = await handleNovelStudioApi(tempDir, "POST", "/api/projects", {
    title: "Delete Me",
    idea: "A temporary project should be removable from the manager",
    chapters: 8,
    chapterWords: 2600,
  })

  assert.equal(createResult.status, 201)
  const projectId = createResult.payload.projectId
  const projectRecord = createResult.payload.projects.find((project) => project.id === projectId)
  const projectRoot = path.isAbsolute(projectRecord.projectRoot) ? projectRecord.projectRoot : path.join(tempDir, projectRecord.projectRoot)
  await withFactoryDb(tempDir, async (db) => db.createJob({
    projectId,
    kind: "autopilot",
    status: "running",
    payload: { source: "test" },
  }))

  const deleteResult = await handleNovelStudioApi(tempDir, "DELETE", `/api/projects/${encodeURIComponent(projectId)}`)

  assert.equal(deleteResult.status, 200)
  assert.equal(deleteResult.payload.deletedProject.id, projectId)
  assert.equal(deleteResult.payload.projects.some((project) => project.id === projectId), false)
  await assert.rejects(fs.stat(projectRoot), /ENOENT/)

  const deletedDbState = await withFactoryDb(tempDir, async (db) => ({
    project: db.getProject(projectId),
    jobs: db.listProjectJobs(projectId, "autopilot"),
    operationalStatus: db.getOperationalStatus(),
  }))
  assert.equal(deletedDbState.project, null)
  assert.equal(deletedDbState.jobs.length, 0)
  assert.equal(deletedDbState.operationalStatus.jobs.active, 0)

  const missingDelete = await handleNovelStudioApi(tempDir, "DELETE", `/api/projects/${encodeURIComponent(projectId)}`)
  assert.equal(missingDelete.status, 404)
  assert.equal(missingDelete.payload.error, "project_not_found")
})

test("studio api prunes factory projects that are no longer in the registry", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-orphan-project-prune-"))
  const { handleNovelStudioApi } = await loadServerModule()
  const { createManagedAutonomousProject, withFactoryDb } = await loadCoreModule()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    title: "Registry Only",
    idea: "A project should remain only when registry and factory agree",
    totalChapters: 8,
    chapterWordTarget: 2600,
  })
  await withFactoryDb(tempDir, async (db) => {
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { source: "orphan-test" },
    })
  })
  await fs.writeFile(path.join(tempDir, ".ai-novel-projects", "projects.json"), "[]\n")

  const projectsResult = await handleNovelStudioApi(tempDir, "GET", "/api/projects")
  const readyResult = await handleNovelStudioApi(tempDir, "GET", "/api/ready")
  const dbProject = await withFactoryDb(tempDir, async (db) => db.getProject(created.project.id))

  assert.equal(projectsResult.status, 200)
  assert.equal(projectsResult.payload.projects.length, 0)
  assert.equal(readyResult.status, 200)
  assert.equal(readyResult.payload.factory.projects.total, 0)
  assert.equal(readyResult.payload.factory.jobs.active, 0)
  assert.equal(dbProject, null)
})

test("studio project creation returns without running a blocking kickoff discussion", async () => {
  const source = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "studio-server.ts"), "utf8")
  const createBranch = source.slice(
    source.indexOf('if (method === "POST" && requestPathname === "/api/projects")'),
    source.indexOf('if (method === "GET" && requestPathname === "/api/status")'),
  )

  assert.match(createBranch, /recordStatusMessage/)
  assert.match(createBranch, /kickoffQueued:\s*false/)
  assert.match(createBranch, /autopilotQueued:\s*false/)
  assert.match(createBranch, /awaiting_user_start/)
  assert.doesNotMatch(createBranch, /recordUserMessage/)
  assert.doesNotMatch(createBranch, /ensureDurableAutopilotJob/)
  assert.doesNotMatch(createBranch, /createWorkspacePayload/)
  assert.doesNotMatch(createBranch, /runMultiAgentDiscussion/)
})

test("studio status falls back to factory db when state artifact is corrupted", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-status-db-fallback-"))
  const { handleNovelStudioApi } = await loadServerModule()

  const createResult = await handleNovelStudioApi(tempDir, "POST", "/api/projects", {
    title: "Archive Road",
    idea: "A county clerk keeps accounts through a collapsing road network",
    chapters: 12,
    chapterWords: 2600,
  })

  assert.equal(createResult.status, 201)
  assert.ok(createResult.payload.projectId)

  const projectRootValue = createResult.payload.projects.find((project) => project.id === createResult.payload.projectId).projectRoot
  const projectRoot = path.isAbsolute(projectRootValue) ? projectRootValue : path.join(tempDir, projectRootValue)
  await fs.writeFile(path.join(projectRoot, ".ai-novel", "state.json"), "{\"broken\": true}\n\"tail\"")

  const statusResult = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: createResult.payload.projectId })
  assert.equal(statusResult.status, 200)
  assert.equal(statusResult.payload.state.project.idea, "A county clerk keeps accounts through a collapsing road network")
  assert.equal(statusResult.payload.factorySnapshot.project.id, createResult.payload.projectId)
})

test("studio status reads snapshots without recording duplicate state artifacts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-status-readonly-"))
  const { handleNovelStudioApi } = await loadServerModule()
  const { withFactoryDb } = await loadCoreModule()

  const createResult = await handleNovelStudioApi(tempDir, "POST", "/api/projects", {
    title: "Quiet Ledger",
    idea: "A minor accountant survives court collapse through ledgers",
    chapters: 8,
    chapterWords: 2600,
  })

  assert.equal(createResult.status, 201)
  const before = await withFactoryDb(tempDir, async (db) => db.getSnapshot(createResult.payload.projectId))
  const beforeArtifactEvents = before.latestEvents.filter((event) => event.type === "ARTIFACT_RECORDED").length

  await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: createResult.payload.projectId })
  await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: createResult.payload.projectId })

  const after = await withFactoryDb(tempDir, async (db) => db.getSnapshot(createResult.payload.projectId))
  const afterArtifactEvents = after.latestEvents.filter((event) => event.type === "ARTIFACT_RECORDED").length
  assert.equal(afterArtifactEvents, beforeArtifactEvents)
})

test("studio status refreshes stale context packet workflow state", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-status-context-sync-"))
  const { handleNovelStudioApi } = await loadServerModule()

  const createResult = await handleNovelStudioApi(tempDir, "POST", "/api/projects", {
    title: "Signal Tower",
    idea: "A signal clerk survives by rewriting the empire's last messages",
    chapters: 8,
    chapterWords: 2600,
  })

  assert.equal(createResult.status, 201)
  const projectRootValue = createResult.payload.projects.find((project) => project.id === createResult.payload.projectId).projectRoot
  const projectRoot = path.isAbsolute(projectRootValue) ? projectRootValue : path.join(tempDir, projectRootValue)
  const contextPath = path.join(projectRoot, ".ai-novel", "context", "current-context.md")
  const staleContext = await fs.readFile(contextPath, "utf8")
  await fs.writeFile(
    contextPath,
    staleContext
      .replace(/^- Stage: .*$/m, "- Stage: complete")
      .replace(/^- Last action: .*$/m, "- Last action: stale-context")
      .replace(/^- Last route: .*$/m, "- Last route: stale-route")
      .replace(/^- Autopilot running: .*$/m, "- Autopilot running: false"),
  )

  const statusResult = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: createResult.payload.projectId })
  assert.equal(statusResult.status, 200)

  const syncedContext = await fs.readFile(contextPath, "utf8")
  assert.match(syncedContext, /- Stage: worldbuilding_dialogue/)
  assert.ok(!syncedContext.includes("- Last action: stale-context"))
  assert.ok(!syncedContext.includes("- Last route: stale-route"))
  assert.match(syncedContext, /- Autopilot running: false/)
  assert.match(syncedContext, /- Target: worldbuilding discussion/)
  assert.match(syncedContext, /- Asset: \.ai-novel\/prompts\/global-consensus\.md/)
})

test("studio status normalizes stale autopilot runtime when no durable job is active", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-status-stale-autopilot-"))
  const { handleNovelStudioApi } = await loadServerModule()
  const { loadAutonomousState, withFactoryDb } = await loadCoreModule()

  const createResult = await handleNovelStudioApi(tempDir, "POST", "/api/projects", {
    title: "Silent Job",
    idea: "A silent courier waits for a worker lease",
    chapters: 6,
    chapterWords: 2600,
  })

  assert.equal(createResult.status, 201)
  await withFactoryDb(tempDir, async (db) => db.cancelProjectJobs(createResult.payload.projectId, "autopilot"))
  const projectRootValue = createResult.payload.projects.find((project) => project.id === createResult.payload.projectId).projectRoot
  const projectRoot = path.isAbsolute(projectRootValue) ? projectRootValue : path.join(tempDir, projectRootValue)
  const state = await loadAutonomousState(projectRoot)
  state.runtime.autopilot = {
    running: true,
    stopRequested: false,
    startedAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:02:00.000Z",
    lastStep: "network_retry",
    mode: "background",
    target: "continue",
    driftScore: 0,
    driftStatus: "correcting",
    driftReason: "LLM timeout",
    checkpointPath: null,
    loopCount: 3,
    statusMessage: "旧状态残留。",
  }
  await withFactoryDb(tempDir, async (db) => db.updateProjectState(createResult.payload.projectId, state))

  const statusResult = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: createResult.payload.projectId })
  assert.equal(statusResult.status, 200)
  assert.equal(statusResult.payload.factorySnapshot.activeJobs.length, 0)
  assert.equal(statusResult.payload.state.runtime.autopilot.running, false)
  assert.equal(statusResult.payload.state.runtime.autopilot.lastStep, "stopped")
})

test("provider-test accepts unsaved provider overrides for modal connectivity checks", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-provider-override-"))
  const { handleNovelStudioApi } = await loadServerModule()

  const result = await handleNovelStudioApi(tempDir, "POST", "/api/provider-test", {
    LLM_BASE_URL: "https://override.example/v1",
    LLM_API_KEY: "override-secret",
    LLM_MODEL_ID: "override-model",
  })

  assert.equal(result.status, 200)
  assert.equal(result.payload.result.ok, true)
  assert.equal(result.payload.result.baseUrl, "https://override.example/v1")
  assert.equal(result.payload.result.modelName, "override-model")
  assert.equal("state" in result.payload, false)

  const { createManagedAutonomousProject } = await loadCoreModule()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A signal engineer tunes an empire's lost observatory",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  const managedResult = await handleNovelStudioApi(tempDir, "POST", "/api/provider-test", {
    projectId: created.project.id,
    LLM_BASE_URL: "https://override.example/v1",
    LLM_API_KEY: "override-secret",
    LLM_MODEL_ID: "override-model",
  })

  assert.equal(managedResult.status, 200)
  assert.equal(managedResult.payload.activeProjectId, created.project.id)
  assert.ok(managedResult.payload.projects.some((project) => project.id === created.project.id))
  const messages = await handleNovelStudioApi(tempDir, "GET", "/api/messages?limit=20", {}, { projectId: created.project.id })
  const projectedStatusEntry = messages.payload.entries.find((entry) =>
    entry.type === "status"
    && entry.metadata?.source === "api_provider_test"
  )
  const projectedToolEntry = messages.payload.entries.find((entry) =>
    entry.type === "tool"
    && entry.data.toolName === "provider-test"
    && entry.metadata?.source === "api_provider_test"
  )
  assert.ok(projectedStatusEntry)
  assert.ok(projectedStatusEntry.parts.some((part) => part.type === "markdown" && /模型连通性测试通过/.test(part.data.text)))
  assert.ok(projectedStatusEntry.parts.some((part) => part.type === "json" && part.data.source === "api_provider_test"))
  assert.ok(projectedToolEntry)
  assert.ok(projectedToolEntry.parts.some((part) => part.type === "tool_call" && part.data.toolName === "provider-test"))
  assert.ok(projectedToolEntry.parts.some((part) => part.type === "tool_result" && part.data.status === "completed"))
  assert.ok(messages.payload.messages.some((message) =>
    message.type === "status"
    && message.metadata?.source === "api_provider_test"
    && message.metadata?.modelName === "override-model",
  ))
  assert.ok(messages.payload.messages.some((message) =>
    message.type === "tool"
    && message.data.toolName === "provider-test"
    && message.metadata?.source === "api_provider_test"
    && message.metadata?.modelName === "override-model",
  ))
  const providerToolMessage = messages.payload.messages.find((message) =>
    message.type === "tool"
    && message.data.toolName === "provider-test"
    && message.metadata?.source === "api_provider_test"
  )
  assert.ok(providerToolMessage.parts.some((part) => part.type === "tool_call" && part.data.toolName === "provider-test"))
  assert.ok(providerToolMessage.parts.some((part) => part.type === "tool_result" && part.data.status === "completed"))
})

test("studio api redacts provider secrets from public env status", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-env-redaction-"))
  const { handleNovelStudioApi } = await loadServerModule()

  await fs.writeFile(
    path.join(tempDir, ".env"),
    [
      "LLM_BASE_URL=https://example.test/v1",
      "LLM_API_KEY=super-secret",
      "LLM_MODEL_ID=test-model",
      "",
    ].join("\n"),
  )

  const result = await handleNovelStudioApi(tempDir, "GET", "/api/projects")

  assert.equal(result.status, 200)
  assert.equal(result.payload.envStatus.configured, true)
  assert.equal(result.payload.envStatus.values.LLM_API_KEY, "[configured]")
  assert.equal(JSON.stringify(result.payload).includes("super-secret"), false)
})

test("server error writer does not throw when SSE headers were already sent", async () => {
  const { writeServerErrorResponse } = await loadServerModule()

  const writes = []
  const response = {
    headersSent: true,
    writableEnded: false,
    writeHead() {
      throw new Error("writeHead should not be called after headersSent")
    },
    write(chunk) {
      writes.push(String(chunk))
      return true
    },
    end(chunk) {
      if (chunk) {
        writes.push(String(chunk))
      }
    },
  }

  writeServerErrorResponse(response, new Error("boom"))

  assert.ok(writes.some((chunk) => chunk.includes("event: error")))
  assert.ok(writes.some((chunk) => chunk.includes("\"error\":\"boom\"")))
})

test("desktop view model derives project, workflow, provider, and task data from real state", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-view-model-"))
  const { deriveStudioViewModel } = await loadViewModelModule()

  await fs.writeFile(
    path.join(tempDir, ".env"),
    [
      "LLM_BASE_URL=https://example.test/v1",
      "LLM_API_KEY=test-secret",
      "LLM_MODEL_ID=test-model",
      "",
    ].join("\n"),
  )

  await runCli(["init", "--idea", "A frost saint bargains with a dead sea"], tempDir)
  await runCli(["provider-test"], tempDir)
  await runCli(["chat", "--message", "主角要更冷静克制，但绝不麻木"], tempDir)

  const state = JSON.parse(await fs.readFile(path.join(tempDir, ".ai-novel", "state.json"), "utf8"))
  const transcript = await fs.readFile(path.join(tempDir, ".ai-novel", "chat", "discussion-log.md"), "utf8")
  const consensus = await fs.readFile(path.join(tempDir, ".ai-novel", "prompts", "global-consensus.md"), "utf8")
  const contextPacket = await fs.readFile(path.join(tempDir, ".ai-novel", "context", "current-context.md"), "utf8")
  const viewModel = deriveStudioViewModel({ state, transcript, consensus, contextPacket })

  assert.equal(viewModel.project.idea, "A frost saint bargains with a dead sea")
  assert.equal(viewModel.project.chapterWordTarget, 2500)
  assert.equal(viewModel.provider.configured, true)
  assert.equal(viewModel.provider.testOk, true)
  assert.equal(viewModel.workflow.currentStage.key, "worldbuilding_dialogue")
  assert.ok(viewModel.workflow.steps.some((step) => step.key === "worldbuilding_dialogue"))
  assert.equal(viewModel.workflow.automation.kind, "idle")
  assert.ok(viewModel.chapters.items.length > 0)
  assert.match(viewModel.discussion.recent[0].role, /user/i)
  assert.ok(viewModel.storyMemory.openQuestions.length > 0)
  assert.match(viewModel.storyMemory.consensusSummary, /character design discussion|写回路径|决议/i)
  assert.match(viewModel.storyMemory.contextPacket, /Current Context Packet/)
})

test("desktop workflow shows automation substate separately from canonical stage", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const html = await fs.readFile(desktopIndexEntry, "utf8")
  const js = await fs.readFile(desktopAppEntry, "utf8")
  const css = await fs.readFile(desktopStyleEntry, "utf8")

  const viewModel = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: {
        stage: "setting_review",
        statusMessage: "讨论结论已写回，正在自动推进工作流。",
        autopilot: {
          running: true,
          stopRequested: false,
          lastStep: "advance:setting_review",
          driftStatus: "ok",
          driftScore: 0,
        },
      },
      plan: { totalChapters: 500, chapterWordTarget: 3000, pendingChapters: 500, chapterTasks: [] },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: {
      activeJobs: [{
        id: "job-advance",
        status: "running",
        lease_owner: "worker:test",
        lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
      }],
      runnableJobs: [],
    },
  })

  assert.equal(viewModel.workflow.currentStage.key, "setting_review")
  assert.equal(viewModel.workflow.automation.kind, "processing")
  assert.match(viewModel.workflow.automation.label, /自动推进/)
  assert.match(html, /id="workflow-automation-status"/)
  assert.match(js, /workflow\.automation/)
  assert.match(css, /\.workflow-automation-status\.is-processing/)
})

test("desktop view model keeps structured message parts from factory snapshot", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()

  const viewModel = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: { stage: "drafting", statusMessage: "正在写作正文。" },
      plan: { totalChapters: 1, chapterWordTarget: 3000, pendingChapters: 1, chapterTasks: [] },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: {
      recentMessages: [
        {
          id: "artifact-message",
          type: "agent",
          status: "completed",
          time: "2026-06-04T10:00:00.000Z",
          data: {
            agentType: "author",
            agentLabel: "Author",
            content: "fallback",
          },
          parts: [
            { id: "artifact-message:part:1", message_id: "artifact-message", part_index: 1, type: "artifact", data: { path: ".ai-novel/chapters/chapter-001.final.md", label: "第 1 章正式成稿" } },
            { id: "artifact-message:part:0", message_id: "artifact-message", part_index: 0, type: "markdown", data: { text: "### 第 1 章\n正文完成。" } },
          ],
        },
      ],
    },
  })

  assert.equal(viewModel.discussion.recent.length, 1)
  assert.equal(viewModel.discussion.recent[0].parts[0].type, "markdown")
  assert.equal(viewModel.discussion.recent[0].parts[1].type, "artifact")
  assert.equal(viewModel.discussion.recent[0].artifactPath, ".ai-novel/chapters/chapter-001.final.md")
})

test("desktop workflow distinguishes queued jobs from leased worker execution", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const baseState = {
    project: { title: "Demo", idea: "一个小人物进入权力核心" },
    runtime: {
      stage: "setting_review",
      statusMessage: "无人值守自动创作任务已写入数据库。",
      autopilot: {
        running: true,
        stopRequested: false,
        lastStep: "starting",
        driftStatus: "ok",
        driftScore: 0,
      },
    },
    plan: { totalChapters: 500, chapterWordTarget: 3000, pendingChapters: 500, chapterTasks: [] },
    reactSetup: { unansweredQuestions: [] },
    assets: { cover: { status: "pending" }, comic: { status: "pending" } },
  }

  const queuedModel = deriveStudioViewModel({
    state: baseState,
    factorySnapshot: {
      activeJobs: [{ id: "job-1", status: "running", lease_owner: null, lease_expires_at: null }],
      runnableJobs: [{ id: "job-1", status: "running", lease_owner: null, lease_expires_at: null }],
    },
  })
  assert.equal(queuedModel.workflow.automation.kind, "warning")
  assert.match(queuedModel.workflow.automation.label, /等待 worker 领取/)

  const queuedAdvanceModel = deriveStudioViewModel({
    state: {
      ...baseState,
      runtime: {
        ...baseState.runtime,
        stage: "drafting",
        statusMessage: "看起来正在推进，但 worker 尚未领取任务。",
        autopilot: {
          ...baseState.runtime.autopilot,
          lastStep: "advance:drafting",
        },
      },
    },
    factorySnapshot: {
      activeJobs: [{ id: "job-queued", status: "running", lease_owner: null, lease_expires_at: null }],
      runnableJobs: [{ id: "job-queued", status: "running", lease_owner: null, lease_expires_at: null }],
    },
  })
  assert.equal(queuedAdvanceModel.workflow.automation.kind, "warning")
  assert.match(queuedAdvanceModel.workflow.automation.label, /等待 worker 领取/)

  const leasedModel = deriveStudioViewModel({
    state: baseState,
    factorySnapshot: {
      activeJobs: [{
        id: "job-1",
        status: "running",
        lease_owner: "worker:test",
        lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
      }],
      runnableJobs: [],
    },
  })
  assert.equal(leasedModel.workflow.automation.kind, "processing")
  assert.match(leasedModel.workflow.automation.label, /worker 正在执行/)
})

test("desktop workflow does not report stale autopilot running without a durable job", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const model = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: {
        stage: "setting_review",
        statusMessage: "自动创作守卫检测到目标漂移。",
        autopilot: {
          running: true,
          stopRequested: false,
          lastStep: "discussion:setting_review",
          driftStatus: "blocked",
          driftScore: 75,
          driftReason: "当前阶段尚未进入 drafting，但输出出现章节正文倾向。",
        },
      },
      plan: { totalChapters: 3, chapterWordTarget: 3000, pendingChapters: 3, chapterTasks: [] },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: { activeJobs: [], runnableJobs: [] },
  })

  assert.equal(model.workflow.automation.kind, "error")
  assert.match(model.workflow.automation.label, /目标漂移已阻塞/)
})

test("desktop workflow makes a paused unattended flow explicit when no durable job remains", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const model = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: {
        stage: "drafting",
        statusMessage: "第 4 章等待继续处理。",
        autopilot: {
          running: false,
          stopRequested: false,
          lastStep: "stopped",
          mode: "idle",
          driftStatus: "ok",
          driftScore: 0,
        },
      },
      plan: { totalChapters: 6, chapterWordTarget: 3000, pendingChapters: 5, chapterTasks: [] },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: { activeJobs: [], runnableJobs: [] },
  })

  assert.equal(model.workflow.automation.kind, "warning")
  assert.match(model.workflow.automation.label, /无人值守已暂停/)
  assert.match(model.workflow.automation.detail, /第 4 章/)
})

test("desktop workflow exposes production pipeline artifact counters from the database snapshot", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const html = await fs.readFile(desktopIndexEntry, "utf8")
  const js = await fs.readFile(desktopAppEntry, "utf8")
  const css = await fs.readFile(desktopStyleEntry, "utf8")

  const viewModel = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: { stage: "drafting", statusMessage: "正在正文写作。" },
      plan: {
        totalChapters: 3,
        chapterWordTarget: 3000,
        pendingChapters: 2,
        chapterTasks: [
          {
            chapterNumber: 2,
            title: "Chapter 2",
            status: "blocked",
            summary: "需要返工",
            targetWords: 3000,
            recoveryAttempts: 1,
            recoveryBlocked: true,
            qualityGate: {
              status: "blocked",
              score: 5,
              attempts: 2,
              reason: "综合评分 5/10，低于通过阈值。",
              updatedAt: "2026-06-03T00:00:00.000Z",
            },
          },
        ],
      },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: {
      artifacts: [
        { kind: "plan", path: ".ai-novel/plans/master-outline.md" },
        { kind: "consensus", path: ".ai-novel/consensus/discussion-discussion-20260604.md" },
        { kind: "transcript", path: ".ai-novel/chat/discussion-log.md" },
        { path: ".ai-novel/plans/chapter-blueprints/chapter-001.md" },
        { path: ".ai-novel/chapters/chapter-001.final.md" },
        {
          path: ".ai-novel/reports/chapter-001-quality.md",
          metadata_json: JSON.stringify({
            chapterNumber: 1,
            qualityGate: {
              status: "passed",
              score: 8,
              attempts: 1,
              reason: "质量门禁通过。",
            },
          }),
        },
        { path: ".ai-novel/memory/chapter-001-memory.md" },
      ],
      latestEvents: [
        {
          type: "CHAPTER_PIPELINE_BLOCKED",
          payload_json: JSON.stringify({
            chapterNumber: 2,
            qualityGate: {
              status: "blocked",
              score: 5,
              attempts: 2,
              reason: "综合评分 5/10，低于通过阈值。",
            },
          }),
        },
      ],
    },
  })

  assert.equal(viewModel.productionPipeline.blueprints, 1)
  assert.equal(viewModel.productionPipeline.finalChapters, 1)
  assert.equal(viewModel.productionPipeline.finalChapterFiles, 1)
  assert.equal(viewModel.productionPipeline.qualityReports, 1)
  assert.equal(viewModel.productionPipeline.memoryUpdates, 1)
  assert.equal(viewModel.productionSummary.source, "state")
  assert.equal(viewModel.productionSummary.totalChapters, 3)
  assert.equal(viewModel.productionSummary.finalChapters, 0)
  assert.equal(viewModel.productionSummary.artifactFinalChapters, 1)
  assert.equal(viewModel.productionSummary.pendingChapters, 2)
  assert.equal(viewModel.productionSummary.blockedChapters, 1)
  assert.equal(viewModel.productionSummary.progressPercent, 0)
  assert.match(viewModel.productionSummary.syncWarning, /已有 1 个成稿文件/)
  assert.match(viewModel.productionPipeline.latestFinalPath, /chapter-001\.final\.md/)
  assert.equal(viewModel.productionPipeline.latestQualityGate.status, "blocked")
  assert.equal(viewModel.productionPipeline.latestQualityGate.score, 5)
  assert.equal(viewModel.productionPipeline.latestQualityGate.attempts, 2)
  assert.equal(viewModel.productionPipeline.latestQualityGate.chapterNumber, 2)
  assert.equal(viewModel.chapters.items[0].qualityGate.status, "blocked")
  assert.equal(viewModel.chapters.items[0].recoveryAttempts, 1)
  assert.equal(viewModel.chapters.items[0].recoveryBlocked, true)
  assert.ok(viewModel.storyMemory.artifacts.some((artifact) => artifact.label === "主线大纲"))
  assert.ok(viewModel.storyMemory.artifacts.some((artifact) => artifact.label === "本轮共识归档"))
  assert.ok(viewModel.storyMemory.artifacts.some((artifact) => artifact.label === "完整讨论记录"))
  assert.ok(viewModel.artifacts.some((artifact) => artifact.category === "正文"))
  assert.match(html, /id="workflow-production-status"/)
  assert.match(js, /productionPipeline/)
  assert.match(js, /productionSummary/)
  assert.match(js, /DB 主事实源/)
  assert.match(js, /artifactFinalChapters/)
  assert.match(js, /workflow-sync-warning/)
  assert.match(js, /workflow-quality-gate/)
  assert.match(html, /id="creation-observability-panel"/)
  assert.match(html, /创作过程观察/)
  assert.match(html, /id="chapter-focus-toggle-button"/)
  assert.match(html, /data-panel-module="chapters"/)
  assert.match(html, /data-panel-toggle="chapters"/)
  assert.match(html, /章节总览/)
  assert.match(js, /function renderCreationObservability/)
  assert.match(js, /snapshot\.activeJobs/)
  assert.match(js, /snapshot\.runnableJobs/)
  assert.match(js, /snapshot\.latestEvents/)
  assert.match(js, /snapshot\.recentMessages/)
  assert.match(js, /toolMessageSummary/)
  assert.match(css, /\.creation-observability-panel/)
  assert.match(css, /\.observability-summary-grid/)
  assert.match(html, /等待创作运行日志/)
  assert.match(js, /log-empty/)
  assert.match(css, /\.log-empty/)
  assert.doesNotMatch(html, /Initialize agent ecosystem/)
  assert.doesNotMatch(html, /Discussion session #103/)
  assert.match(js, /chapter-quality-row/)
  assert.match(js, /retryChapter/)
  assert.match(js, /\/api\/chapters\/retry/)
  assert.match(js, /previewChapter/)
  assert.match(js, /\/api\/chapters\/preview/)
  assert.match(js, /previewArtifact/)
  assert.match(js, /\/api\/artifacts\/preview/)
  assert.match(html, /chapter-list-empty/)
  assert.match(html, /等待数据库快照同步章节任务/)
  assert.match(html, /正式章节任务/)
  assert.match(css, /\.chapter-list-empty/)
  assert.match(css, /\.discussion-context-banner/)
  assert.doesNotMatch(html, /id="chap-1"/)
  assert.doesNotMatch(html, /onclick="simulateWrite/)
  assert.doesNotMatch(js, /window\.simulateWrite/)
  assert.match(html, /data-discussion-context-region="true"/)
  assert.match(html, /data-discussion-static-region="true"/)
  assert.match(html, /data-live-region="true"/)
  assert.match(js, /function renderDiscussionContextBanner/)
  assert.match(js, /这里展示的是可追踪讨论记录与实时执行流/)
  assert.match(js, /任务窗口生成后可在这里分页查看全部章节/)
  assert.doesNotMatch(html, /讨论启动于 2026-06-02/)
  assert.doesNotMatch(html, /Showrunner<\/strong> 已就位/)
  assert.doesNotMatch(html, /World Architect<\/strong> 报到/)
  assert.doesNotMatch(html, /联调状态完毕/)
  assert.match(html, /等待选择小说项目/)
  assert.match(html, /等待数据库快照同步创作阶段/)
  assert.match(html, /等待 provider 状态同步/)
  assert.match(html, /创作指挥舱: <span id="current-stage-text">等待快照<\/span>/)
  assert.match(html, /id="progress-percent">0 \/ 0 章/)
  assert.match(html, /placeholder="输入一句小说想法"/)
  assert.match(html, /placeholder="model-name"/)
  assert.match(css, /\.workflow-empty/)
  assert.doesNotMatch(html, /一个盲眼观星师在宇宙背景辐射/)
  assert.doesNotMatch(html, /一个盲眼观星师在星噪中听见未来/)
  assert.doesNotMatch(html, /0 \/ 24 章/)
  assert.doesNotMatch(html, /placeholder="\/model\/gemma-4-31b-it"/)
  assert.doesNotMatch(html, /Model: Gemma-4-31b-it/)
  assert.doesNotMatch(html, /联调成功 @ 10:40:20/)
  assert.doesNotMatch(html, /Pending\)/)
  assert.match(js, /chapterPage/)
  assert.match(js, /chapterPageSize/)
  assert.match(js, /PANEL_LAYOUT_STORAGE_KEY/)
  assert.match(js, /function applySidebarPanelLayout/)
  assert.match(js, /function setChapterFocus/)
  assert.match(js, /overview-panel-summary/)
  assert.match(js, /chapter-panel-summary/)
  assert.match(js, /chapter-pagination/)
  assert.match(js, /progress-total-label/)
  assert.match(js, /runNow:\s*true/)
  assert.match(js, /recoveryBlocked/)
  assert.match(js, /recoveryLimited/)
  assert.match(css, /\.sidebar-right\.is-chapter-focus/)
  assert.match(css, /\.sidebar-module/)
  assert.match(css, /\.sidebar-module-header/)
  assert.match(css, /\.sidebar-focus-button/)
  assert.match(css, /\.workflow-production-status/)
  assert.match(css, /\.workflow-production-summary/)
  assert.match(css, /\.workflow-sync-warning/)
  assert.match(css, /\.workflow-quality-gate/)
  assert.match(css, /\.chapter-quality-row/)
  assert.match(css, /\.chapter-quality-row\.is-limited/)
  assert.match(css, /\.chapter-preview-card/)
  assert.match(css, /\.artifact-preview-card/)
  assert.match(css, /\.chapter-pagination/)
})

test("desktop chapter list keeps completed chapters completed after an earlier block", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()

  const viewModel = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: { stage: "reviewing", statusMessage: "第 2 章需要复核。" },
      plan: {
        totalChapters: 4,
        chapterWordTarget: 3000,
        pendingChapters: 0,
        chapterTasks: [
          { chapterNumber: 1, title: "Chapter 1", status: "complete", summary: "", targetWords: 3000 },
          { chapterNumber: 2, title: "Chapter 2", status: "blocked", summary: "", targetWords: 3000 },
          { chapterNumber: 3, title: "Chapter 3", status: "blocked", summary: "", targetWords: 3000 },
          { chapterNumber: 4, title: "Chapter 4", status: "complete", summary: "", targetWords: 3000 },
        ],
      },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
  })

  assert.equal(viewModel.chapters.items[0].displayStatus || viewModel.chapters.items[0].status, "complete")
  assert.equal(viewModel.chapters.items[1].displayStatus || viewModel.chapters.items[1].status, "blocked")
  assert.equal(viewModel.chapters.items[3].displayStatus || viewModel.chapters.items[3].status, "complete")
  assert.equal(viewModel.chapters.items[3].blockedByPrevious, undefined)
})

test("desktop production summary treats database snapshot as the canonical workflow source", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const completedTasks = Array.from({ length: 500 }, (_, index) => ({
    chapterNumber: index + 1,
    title: `Chapter ${index + 1}`,
    status: "complete",
    summary: "done",
    targetWords: 3000,
  }))
  const artifacts = [
    ...Array.from({ length: 500 }, (_, index) => ({
      path: `.ai-novel/chapters/chapter-${String(index + 1).padStart(3, "0")}.final.md`,
    })),
    ...Array.from({ length: 500 }, (_, index) => ({
      path: `.ai-novel/reports/chapter-${String(index + 1).padStart(3, "0")}-quality.md`,
    })),
  ]

  const model = deriveStudioViewModel({
    state: {
      project: { title: "Stale", idea: "旧缓存" },
      runtime: { stage: "setting_review", statusMessage: "旧 state artifact" },
      plan: { totalChapters: 500, chapterWordTarget: 3000, pendingChapters: 500, chapterTasks: [] },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: {
      state: {
        project: { title: "Canonical", idea: "DB 快照" },
        runtime: { stage: "complete", statusMessage: "自动创作已完成全部章节任务。" },
        plan: {
          totalChapters: 500,
          chapterWordTarget: 3000,
          pendingChapters: 0,
          chapterTaskSummary: {
            total: 500,
            complete: 500,
            pending: 0,
            inProgress: 0,
            blocked: 0,
            windowed: 20,
          },
          chapterTasks: completedTasks.slice(-20),
        },
        reactSetup: { unansweredQuestions: [] },
        assets: { cover: { status: "pending" }, comic: { status: "pending" } },
      },
      artifacts,
      artifactSummary: {
        total: 1000,
        blueprints: 500,
        finalChapters: 500,
        qualityReports: 500,
        memoryUpdates: 500,
        latestFinalPath: ".ai-novel/chapters/chapter-500.final.md",
      },
      latestEvents: [{ type: "JOB_UPDATED", created_at: "2026-06-04T05:50:17.756Z" }],
    },
  })

  assert.equal(model.workflow.currentStage.key, "complete")
  assert.equal(model.workflow.automation.kind, "success")
  assert.equal(model.productionSummary.source, "db")
  assert.equal(model.productionSummary.isComplete, true)
  assert.equal(model.productionSummary.progressPercent, 100)
  assert.equal(model.productionSummary.finalChapters, 500)
  assert.equal(model.productionSummary.artifactFinalChapters, 500)
  assert.equal(model.productionPipeline.finalChapterFiles, 500)
  assert.equal(model.productionSummary.qualityReports, 500)
  assert.equal(model.productionSummary.pendingChapters, 0)
  assert.equal(model.productionSummary.blockedChapters, 0)
  assert.equal(model.chapters.items.length, 20)
  assert.match(model.productionSummary.latestFinalPath, /chapter-500\.final\.md/)
})

test("desktop production summary uses contiguous completion when earlier chapters are blocked", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const chapterTasks = [
    { chapterNumber: 1, title: "Chapter 1", status: "complete", summary: "done", targetWords: 3000 },
    { chapterNumber: 2, title: "Chapter 2", status: "blocked", summary: "blocked", targetWords: 3000 },
    { chapterNumber: 3, title: "Chapter 3", status: "blocked", summary: "blocked", targetWords: 3000 },
    { chapterNumber: 4, title: "Chapter 4", status: "complete", summary: "generated", targetWords: 3000 },
  ]
  const chapterFacts = [
    { chapterNumber: 1, status: "complete", qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok" } },
    { chapterNumber: 2, status: "blocked", qualityGate: { status: "blocked", score: 8, attempts: 2, reason: "needs rewrite" } },
    { chapterNumber: 3, status: "blocked", qualityGate: { status: "blocked", score: 5, attempts: 2, reason: "needs rewrite" } },
    { chapterNumber: 4, status: "complete", qualityGate: { status: "passed", score: 7, attempts: 0, reason: "ok" } },
  ]

  const model = deriveStudioViewModel({
    factorySnapshot: {
      state: {
        project: { title: "Sequential", idea: "必须按顺序完成" },
        runtime: { stage: "reviewing", statusMessage: "第 2 章阻塞" },
        plan: {
          totalChapters: 4,
          chapterWordTarget: 3000,
          pendingChapters: 0,
          chapterTaskSummary: { total: 4, complete: 2, pending: 0, inProgress: 0, blocked: 2, windowed: 4 },
          chapterTasks,
        },
        reactSetup: { unansweredQuestions: [] },
        assets: { cover: { status: "pending" }, comic: { status: "pending" } },
      },
      chapterFacts,
      artifactSummary: {
        total: 8,
        blueprints: 4,
        finalChapters: 2,
        finalChapterFiles: 4,
        passedFinalChapters: 2,
        blockedFinalChapters: 2,
        qualityReports: 4,
        memoryUpdates: 4,
      },
    },
  })

  assert.equal(model.productionSummary.completedChapters, 1)
  assert.equal(model.productionSummary.passedChapters, 2)
  assert.equal(model.productionSummary.artifactFinalChapters, 4)
  assert.match(model.productionSummary.syncWarning, /连续正式进度到第 1 章/)
  assert.equal(model.chapters.items[3].blockedByPrevious, undefined)
  assert.equal(model.chapters.items[3].statusLabel, "已完成")
})

test("desktop workflow ignores stale complete stage when chapter facts are still blocked", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const model = deriveStudioViewModel({
    factorySnapshot: {
      state: {
        project: { title: "Sequential", idea: "状态不能被旧 runtime 污染" },
        runtime: {
          stage: "complete",
          statusMessage: "旧状态误报为完成",
          autopilot: { running: true, lastStep: "network_retry" },
        },
        plan: {
          totalChapters: 4,
          chapterWordTarget: 3000,
          pendingChapters: 0,
          chapterTaskSummary: { total: 4, complete: 3, pending: 0, inProgress: 0, blocked: 1, windowed: 4 },
          chapterTasks: [
            { chapterNumber: 1, title: "Chapter 1", status: "complete", summary: "done", targetWords: 3000 },
            { chapterNumber: 2, title: "Chapter 2", status: "complete", summary: "done", targetWords: 3000 },
            { chapterNumber: 3, title: "Chapter 3", status: "complete", summary: "done", targetWords: 3000 },
            { chapterNumber: 4, title: "Chapter 4", status: "blocked", summary: "rewrite", targetWords: 3000 },
          ],
        },
        reactSetup: { unansweredQuestions: [] },
        assets: { cover: { status: "pending" }, comic: { status: "pending" } },
      },
      chapterFacts: [
        { chapterNumber: 1, status: "complete", qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok" } },
        { chapterNumber: 2, status: "complete", qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok" } },
        { chapterNumber: 3, status: "complete", qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok" } },
        {
          chapterNumber: 4,
          status: "pending",
          finalPath: ".ai-novel/chapters/chapter-004.final.md",
          qualityGate: { status: "passed", score: 7, attempts: 0, reason: "ok" },
          contentQuality: { status: "quarantined", reason: "需要重写" },
        },
      ],
      artifactSummary: {
        total: 8,
        blueprints: 4,
        finalChapters: 4,
        finalChapterFiles: 4,
        passedFinalChapters: 3,
        blockedFinalChapters: 1,
        qualityReports: 4,
        memoryUpdates: 4,
      },
      activeJobs: [{ id: "job-1" }],
      latestEvents: [{
        type: "AUTOPILOT_NETWORK_RETRY",
        payload_json: JSON.stringify({
          autopilot: { lastStep: "network_retry", statusMessage: "模型连接恢复后自动继续。" },
        }),
      }],
    },
  })

  assert.equal(model.productionSummary.rawStage, "complete")
  assert.equal(model.productionSummary.stage, "drafting")
  assert.equal(model.productionSummary.isComplete, false)
  assert.equal(model.workflow.currentStage.key, "drafting")
  assert.equal(model.workflow.automation.kind, "warning")
  assert.match(model.workflow.automation.label, /重试中/)
})

test("desktop chapter list keeps in-progress chapters visibly running even when prior artifacts are quarantined", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const model = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: { stage: "drafting", statusMessage: "第 4 章正在生产。" },
      plan: {
        totalChapters: 500,
        chapterWordTarget: 3000,
        pendingChapters: 496,
        chapterTasks: [
          { chapterNumber: 1, title: "Chapter 1", status: "complete", summary: "done", targetWords: 3000 },
          { chapterNumber: 2, title: "Chapter 2", status: "complete", summary: "done", targetWords: 3000 },
          { chapterNumber: 3, title: "Chapter 3", status: "complete", summary: "done", targetWords: 3000 },
          { chapterNumber: 4, title: "Chapter 4", status: "complete", summary: "rewriting", targetWords: 3000 },
          { chapterNumber: 5, title: "Chapter 5", status: "pending", summary: "queued", targetWords: 3000 },
        ],
      },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: {
      chapterFacts: [
        { chapterNumber: 1, status: "complete" },
        { chapterNumber: 2, status: "complete" },
        { chapterNumber: 3, status: "complete" },
        {
          chapterNumber: 4,
          status: "in_progress",
          finalPath: ".ai-novel/chapters/chapter-004.final.md",
          qualityGate: { status: "passed", score: 7, attempts: 0, reason: "ok" },
          contentQuality: { status: "quarantined", reason: "缺少确定性字数门禁，不能计入正式完成。" },
        },
        { chapterNumber: 5, status: "pending" },
      ],
    },
  })

  assert.equal(model.chapters.items[3].status, "in_progress")
  assert.equal(model.chapters.items[3].statusLabel, "进行中")
})

test("desktop workflow marks transcript-only chapter drafts as not yet production progress", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const model = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: {
        stage: "setting_review",
        statusMessage: "仍在设定冻结。",
        autopilot: { driftStatus: "blocked" },
      },
      plan: { totalChapters: 3, chapterWordTarget: 3000, pendingChapters: 3, chapterTasks: [] },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: {
      state: {
        runtime: { stage: "setting_review", autopilot: { driftStatus: "blocked" } },
      },
      artifacts: [{ kind: "transcript", path: ".ai-novel/chat/discussion-log.md" }],
      latestEvents: [{
        type: "AGENT_TURN_UPDATED",
        payload_json: JSON.stringify({ content: "第十二章初稿通过，但未写入正式章节文件。" }),
      }],
    },
  })

  assert.equal(model.productionPipeline.finalChapters, 0)
  assert.equal(model.productionPipeline.transcriptDraftOnly, true)
})

test("agent stage guardrails prevent discussion text from claiming state transitions", async () => {
  const runtimeSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "runtime-llm.ts"), "utf8")
  const discussionSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "discussion.ts"), "utf8")
  const autopilotSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "autopilot-worker.ts"), "utf8")

  assert.match(runtimeSource, /权威进度只来自系统提供的/)
  assert.match(discussionSource, /不能替状态机宣布阶段跳转/)
  assert.match(autopilotSource, /状态机尚未推进到对应阶段/)
})

test("desktop view model can reflect a fresh provider test result even before workspace init", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()

  const viewModel = deriveStudioViewModel({
    state: null,
    transcript: "",
    envStatus: {
      configured: true,
      missing: [],
      resolved: {
        baseUrl: "https://example.test/v1",
        apiKeyPresent: true,
        modelName: "/model/gemma-4-31b-it",
      },
    },
    providerResult: {
      ok: true,
      checkedAt: "2026-06-02T12:45:00.000Z",
      baseUrl: "https://example.test/v1",
      modelName: "/model/gemma-4-31b-it",
      message: "Provider reachable. 1 models listed.",
    },
  })

  assert.equal(viewModel.provider.configured, true)
  assert.equal(viewModel.provider.testOk, true)
  assert.equal(viewModel.provider.modelName, "/model/gemma-4-31b-it")
  assert.match(viewModel.provider.testMessage, /Provider reachable/i)
})

test("desktop view model preserves full discussion history in chronological order", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()

  const transcript = [
    "## 2026-06-02T10:00:00.000Z",
    "Project: Demo",
    "Idea: Demo idea",
    "User: 第一条消息",
    "Showrunner: 第一轮总结",
    "",
    "## 2026-06-02T10:05:00.000Z",
    "Project: Demo",
    "Idea: Demo idea",
    "User: 第二条消息",
    "Author: 第二轮回应",
    "",
  ].join("\n")

  const viewModel = deriveStudioViewModel({
    state: {
      runtime: { stage: "worldbuilding_dialogue", statusMessage: "", lastUpdatedAt: "" },
      reactSetup: { unansweredQuestions: [] },
      plan: { pendingChapters: 0, chapterTasks: [], totalChapters: 0, chapterWordTarget: 2500 },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
      project: { title: "Demo", idea: "Demo idea" },
    },
    transcript,
  })

  assert.equal(viewModel.discussion.recent.length, 4)
  assert.equal(viewModel.discussion.recent[0].content, "第一条消息")
  assert.equal(viewModel.discussion.recent[1].content, "第一轮总结")
  assert.equal(viewModel.discussion.recent[2].content, "第二条消息")
  assert.equal(viewModel.discussion.recent[3].content, "第二轮回应")
})

test("desktop chapter list exposes generated blueprint artifacts for preview", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()

  const viewModel = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: { stage: "drafting", statusMessage: "正文写作中" },
      plan: {
        totalChapters: 3,
        chapterWordTarget: 3000,
        pendingChapters: 3,
        chapterTasks: [
          { chapterNumber: 1, title: "第一章", status: "pending", summary: "", targetWords: 3000 },
          { chapterNumber: 2, title: "第二章", status: "pending", summary: "", targetWords: 3000 },
          { chapterNumber: 3, title: "第三章", status: "pending", summary: "", targetWords: 3000 },
        ],
      },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: {
      artifacts: [
        { path: ".ai-novel/plans/chapter-blueprints/chapter-002.md", kind: "plan", status: "completed" },
      ],
      chapterFacts: [],
    },
  })

  assert.equal(viewModel.chapters.items[0].blueprintPath, "")
  assert.equal(viewModel.chapters.items[1].blueprintPath, ".ai-novel/plans/chapter-blueprints/chapter-002.md")
  assert.equal(viewModel.chapters.items[2].blueprintPath, "")
})

test("desktop story memory exposes knowledge index and recent RAG citations", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()
  const js = await fs.readFile(desktopAppEntry, "utf8")
  const css = await fs.readFile(desktopStyleEntry, "utf8")

  const viewModel = deriveStudioViewModel({
    state: {
      project: { title: "Demo", idea: "一个小人物进入权力核心" },
      runtime: { stage: "drafting", statusMessage: "正文写作中" },
      plan: { totalChapters: 3, chapterWordTarget: 3000, pendingChapters: 3, chapterTasks: [] },
      reactSetup: { unansweredQuestions: [] },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
    },
    factorySnapshot: {
      knowledge: {
        summary: {
          globalSources: 7,
          projectSources: 3,
          readyChunks: 42,
          pendingChunks: 2,
          failedChunks: 1,
        },
        sources: [
          {
            id: "ksrc-global",
            scope: "global",
            source_type: "vocabulary",
            path: "packages/ai-novel-core/resources/writing/vocabulary/idioms.md",
            title: "Idioms",
            status: "ready",
          },
          {
            id: "ksrc-project",
            scope: "project",
            source_type: "plan",
            path: ".ai-novel/plans/master-outline.md",
            title: "Master outline",
            status: "ready",
          },
        ],
        chunks: [
          {
            id: "chunk-idiom",
            chunk_type: "vocabulary_entry",
            source_path: "packages/ai-novel-core/resources/writing/vocabulary/idioms.md",
            source_title: "Idioms",
            content: "风声鹤唳：适合乱世追捕场景。",
          },
        ],
        citations: [
          {
            id: "kcite-1",
            query: "乱世 市井 成语",
            created_at: "2026-06-04T10:00:00.000Z",
            results_json: JSON.stringify([
              {
                chunkId: "chunk-idiom",
                sourceType: "vocabulary",
                sourcePath: "packages/ai-novel-core/resources/writing/vocabulary/idioms.md",
                score: 91,
              },
            ]),
            used_chunk_ids_json: JSON.stringify(["chunk-idiom"]),
          },
        ],
        latestEvaluation: {
          created_at: "2026-06-04T10:06:00.000Z",
          payload: {
            summary: {
              totalCases: 2,
              hitRateAtK: 0.5,
              meanRecallAtK: 0.75,
              meanPrecisionAtK: 0.6,
            },
            cases: [
              {
                name: "recent-citation-1",
                query: "乱世 市井 成语",
                k: 8,
                hitAtK: 1,
                recallAtK: 1,
                precisionAtK: 0.5,
                matchedChunkIds: ["chunk-idiom"],
                missedChunkIds: [],
              },
            ],
          },
        },
        jobs: [
          {
            id: "job-db-global",
            kind: "knowledge_global_reindex",
            status: "idle",
            updated_at: "2026-06-04T10:05:00.000Z",
            payload: { scope: "global" },
          },
          {
            id: "job-db-artifact-1",
            kind: "knowledge_project_artifact",
            status: "paused",
            updated_at: "2026-06-04T10:04:00.000Z",
            payload: { artifactPath: ".ai-novel/context/current-context.md" },
          },
          {
            id: "job-db-artifact-2",
            kind: "knowledge_project_artifact",
            status: "running",
            lease_expires_at: "2026-06-04T10:00:01.000Z",
            updated_at: "2026-06-04T10:03:00.000Z",
            payload: { artifactPath: ".ai-novel/prompts/global-consensus.md" },
          },
        ],
      },
      artifacts: [
        {
          id: "artifact-knowledge-evaluation",
          kind: "checkpoint",
          path: ".ai-novel/knowledge/evaluation-latest.md",
          status: "completed",
          updated_at: "2026-06-04T10:06:00.000Z",
        },
      ],
      latestEvents: [
        {
          type: "KNOWLEDGE_REINDEX_QUEUED",
          payload_json: JSON.stringify({
            scope: "all",
            jobs: [
              { id: "job-global", kind: "knowledge_global_reindex" },
              { id: "job-artifact", kind: "knowledge_project_artifact" },
            ],
          }),
        },
      ],
    },
  })

  assert.equal(viewModel.storyMemory.knowledge.status, "ready")
  assert.equal(viewModel.storyMemory.knowledge.summary.globalSources, 7)
  assert.equal(viewModel.storyMemory.knowledge.summary.projectSources, 3)
  assert.equal(viewModel.storyMemory.knowledge.summary.readyChunks, 42)
  assert.equal(viewModel.storyMemory.knowledge.recentCitations[0].query, "乱世 市井 成语")
  assert.equal(viewModel.storyMemory.knowledge.recentCitations[0].sources[0].sourceType, "vocabulary")
  assert.match(viewModel.storyMemory.knowledge.topSources[0].path, /idioms\.md/)
  assert.equal(viewModel.storyMemory.knowledge.jobStatus.kind, "queued")
  assert.match(viewModel.storyMemory.knowledge.jobStatus.detail, /3 个知识库后台任务/)
  assert.equal(viewModel.storyMemory.knowledge.latestEvaluation.summary.totalCases, 2)
  assert.equal(viewModel.storyMemory.knowledge.latestEvaluation.summary.hitRateAtK, 0.5)
  assert.ok(viewModel.storyMemory.artifacts.some((artifact) =>
    artifact.path === ".ai-novel/knowledge/evaluation-latest.md"
    && artifact.label === "知识库召回评估"
    && artifact.category === "知识库",
  ))
  assert.match(js, /知识库 \/ RAG/)
  assert.match(js, /data-knowledge-reindex/)
  assert.match(js, /data-knowledge-evaluate/)
  assert.match(js, /data-knowledge-search-form/)
  assert.match(js, /function reindexKnowledge/)
  assert.match(js, /function evaluateKnowledge/)
  assert.match(js, /function searchKnowledge/)
  assert.match(js, /\/api\/knowledge\/reindex/)
  assert.match(js, /\/api\/knowledge\/search/)
  assert.match(js, /\/api\/knowledge\/evaluate/)
  assert.match(js, /queuedKnowledgeJobs/)
  assert.match(js, /knowledgeEvaluation/)
  assert.match(js, /knowledgeSearch/)
  assert.match(js, /knowledge-job-status/)
  assert.match(js, /knowledge-search-results/)
  assert.match(js, /knowledge-evaluation-card/)
  assert.match(js, /knowledge-summary-grid/)
  assert.match(js, /knowledge-citation-list/)
  assert.match(css, /\.knowledge-summary-grid/)
  assert.match(css, /\.knowledge-citation-card/)
  assert.match(css, /\.memory-icon-button/)
  assert.match(css, /\.knowledge-job-status/)
  assert.match(css, /\.knowledge-search-form/)
  assert.match(css, /\.knowledge-search-result/)
  assert.match(css, /\.knowledge-evaluation-card/)
})

test("desktop view model can render server-provided discussion entries without transcript parsing", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()

  const viewModel = deriveStudioViewModel({
    state: {
      runtime: { stage: "worldbuilding_dialogue", statusMessage: "", lastUpdatedAt: "" },
      reactSetup: { unansweredQuestions: [] },
      plan: { pendingChapters: 0, chapterTasks: [], totalChapters: 0, chapterWordTarget: 2500 },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
      project: { title: "Demo", idea: "Demo idea" },
    },
    transcript: "User: 这条不应该被解析",
    discussionEntries: [
      { key: "server-1", role: "User", content: "服务器返回的最近消息" },
      { key: "server-2", role: "Showrunner", content: "服务器返回的总结" },
    ],
  })

  assert.equal(viewModel.discussion.recent.length, 2)
  assert.equal(viewModel.discussion.recent[0].content, "服务器返回的最近消息")
  assert.equal(viewModel.discussion.recent[1].role, "Showrunner")
})

test("desktop view model can render database-backed recent messages without transcript parsing", async () => {
  const { deriveStudioViewModel } = await loadViewModelModule()

  const viewModel = deriveStudioViewModel({
    state: {
      runtime: { stage: "worldbuilding_dialogue", statusMessage: "", lastUpdatedAt: "" },
      reactSetup: { unansweredQuestions: [] },
      plan: { pendingChapters: 0, chapterTasks: [], totalChapters: 0, chapterWordTarget: 2500 },
      assets: { cover: { status: "pending" }, comic: { status: "pending" } },
      project: { title: "Demo", idea: "Demo idea" },
    },
    transcript: "User: 这条旧 transcript 不应该优先显示",
    factorySnapshot: {
      recentMessages: [
        {
          id: "msg-author",
          type: "agent",
          status: "completed",
          time: "2026-06-04T10:00:00.000Z",
          data: { agentType: "author", agentLabel: "Author", content: "数据库消息", format: "markdown" },
        },
      ],
    },
  })

  assert.equal(viewModel.discussion.recent.length, 1)
  assert.equal(viewModel.discussion.recent[0].messageId, "msg-author")
  assert.equal(viewModel.discussion.recent[0].type, "agent")
  assert.equal(viewModel.discussion.recent[0].data.agentType, "author")
  assert.equal(viewModel.discussion.recent[0].content, "数据库消息")
})

test("desktop snapshot merge preserves state and loads messages before transcript fallback", async () => {
  const js = await fs.readFile(desktopAppEntry, "utf8")

  assert.match(js, /hasOwnProperty\.call\(payload,\s*"state"\)/)
  assert.match(js, /hasOwnProperty\.call\(payload,\s*"factorySnapshot"\)/)
  assert.match(js, /hasOwnProperty\.call\(payload,\s*"transcript"\)/)
  assert.match(js, /Array\.isArray\(payload\.messages\)/)
  assert.match(js, /const recentMessages = payload\.appendDiscussionHistory/)
  assert.match(js, /recentMessages,\s*\n\s*}/)
  assert.match(js, /\/api\/messages\?\$\{params\.toString\(\)\}/)
  assert.match(js, /\/api\/transcript\?\$\{params\.toString\(\)\}/)
  assert.match(js, /const DISCUSSION_PAGE_SIZE = 20/)
  assert.match(js, /appendDiscussionHistory/)
  assert.match(js, /data-load-older-messages/)
  assert.match(js, /pagination\.nextOffset/)

  const css = await fs.readFile(desktopStyleEntry, "utf8")
  assert.match(css, /\.discussion-history-bar/)
  assert.match(css, /\.discussion-history-button/)
})

test("discussion transcript entries preserve per-agent turn timestamps", async () => {
  const discussionSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "discussion.ts"), "utf8")
  const serverSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "studio-server.ts"), "utf8")

  assert.match(discussionSource, /const completedAt = new Date\(\)\.toISOString\(\)/)
  assert.match(discussionSource, /\[`## \$\{completedAt\}`,\s*`\$\{agent\.label\}: \$\{reply\}`/)
  assert.match(discussionSource, /timestamp: completedAt/)
  assert.match(serverSource, /parseTranscriptTimestamp/)
  assert.match(serverSource, /\.\.\.\(timestamp \? \{ timestamp \} : \{\}\)/)
})

test("desktop status polling uses snapshot versions to skip unchanged renders", async () => {
  const js = await fs.readFile(desktopAppEntry, "utf8")
  const serverSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "studio-server.ts"), "utf8")

  assert.match(js, /snapshotVersion:\s*""/)
  assert.match(js, /knownSnapshotVersion/)
  assert.match(js, /payload\?\.(?:notModified|notModified)/)
  assert.match(js, /params\.set\("knownSnapshotVersion",\s*dashboardState\.snapshotVersion\)/)
  assert.match(js, /function dashboardStructureSignature/)
  assert.match(js, /const previousStructureSignature = dashboardStructureSignature\(\)/)
  assert.match(js, /const structureChanged = previousStructureSignature !== nextStructureSignature/)
  assert.doesNotMatch(js, /stableRowListSignature\(snapshot\.activeJobs,\s*\[[^\]]*"lease_expires_at"/)
  assert.match(js, /if \(structureChanged\) {\s*renderDashboard\(\)\s*} else {\s*renderDiscussionOnly\(\)/s)
  assert.match(serverSource, /messageCount: Array\.isArray\(factorySnapshot\.recentMessages\)/)
  assert.doesNotMatch(serverSource, /recentMessages:\s*Array\.isArray\(factorySnapshot\.recentMessages\)[\s\S]{0,240}data: row\.data/)
})

test("live discussion reducer applies incremental agent stream events immediately", async () => {
  const { applyLiveDiscussionEvent } = await loadLiveDiscussionModule()

  let liveDiscussion = []
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "agent_start", {
    turnId: "turn-1",
    role: "Showrunner",
    timestamp: "2026-06-04T10:00:00.000Z",
  })
  assert.equal(liveDiscussion.length, 1)
  assert.equal(liveDiscussion[0].content, "")
  assert.equal(liveDiscussion[0].streaming, true)

  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "agent_delta", {
    turnId: "turn-1",
    role: "Showrunner",
    delta: "Hello",
  })
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "agent_delta", {
    turnId: "turn-1",
    role: "Showrunner",
    delta: " world",
  })
  assert.equal(liveDiscussion[0].content, "Hello world")

  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "agent_complete", {
    turnId: "turn-1",
    role: "Showrunner",
    content: "Hello world",
    timestamp: "2026-06-04T10:00:11.000Z",
  })
  assert.equal(liveDiscussion[0].streaming, false)
  assert.equal(liveDiscussion[0].content, "Hello world")
  assert.equal(liveDiscussion[0].timestamp, "2026-06-04T10:00:11.000Z")
  assert.equal(liveDiscussion[0].messageId, "turn-1")
  assert.equal(liveDiscussion[0].type, "agent")
  assert.equal(liveDiscussion[0].status, "completed")
  assert.equal(liveDiscussion[0].data.agentType, "showrunner")
  assert.equal(liveDiscussion[0].data.content, "Hello world")
  assert.equal(liveDiscussion[0].parts.length, 1)
  assert.equal(liveDiscussion[0].parts[0].type, "markdown")
  assert.equal(liveDiscussion[0].parts[0].data.text, "Hello world")
})

test("live discussion reducer marks failed agent stream turns on the same message", async () => {
  const { applyLiveDiscussionEvent } = await loadLiveDiscussionModule()

  let liveDiscussion = []
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "agent_start", {
    messageId: "agent-msg-1",
    turnId: "turn-1",
    role: "Editor",
    timestamp: "2026-06-04T10:00:00.000Z",
  })
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "agent_error", {
    messageId: "agent-msg-1",
    turnId: "turn-1",
    role: "Editor",
    content: "LLM 请求失败：timeout",
    error: "timeout",
    timestamp: "2026-06-04T10:00:03.000Z",
  })

  assert.equal(liveDiscussion.length, 1)
  assert.equal(liveDiscussion[0].messageId, "agent-msg-1")
  assert.equal(liveDiscussion[0].turnId, "turn-1")
  assert.equal(liveDiscussion[0].status, "failed")
  assert.equal(liveDiscussion[0].streaming, false)
  assert.equal(liveDiscussion[0].data.phase, "failed")
  assert.equal(liveDiscussion[0].data.statusText, "LLM 请求失败，已记录错误。")
  assert.equal(liveDiscussion[0].data.statusDetail, "timeout")
  assert.equal(liveDiscussion[0].parts[0].type, "markdown")
  assert.equal(liveDiscussion[0].parts[0].data.text, "LLM 请求失败：timeout")
})

test("live discussion reducer renders writing pipeline progress as chat cards", async () => {
  const { applyLiveDiscussionEvent } = await loadLiveDiscussionModule()
  const liveDiscussion = applyLiveDiscussionEvent([], "writing_progress", {
    step: "draft_completed",
    role: "Author",
    chapterNumber: 1,
    title: "开端",
    status: "completed",
    message: "第 1 章初稿已生成，进入质量门禁。",
    artifactPath: ".ai-novel/chapters/chapter-001.final.md",
    preview: "这里是短预览，不是整章正文。",
    wordCount: 2600,
    qualityGate: { status: "passed", score: 8, reason: "质量门禁通过。" },
    knowledgeReferences: [
      {
        chunkId: "chunk-idiom",
        chunkType: "vocabulary",
        score: 91,
        sourceType: "vocabulary",
        sourcePath: "packages/ai-novel-core/resources/writing/vocabulary/idioms.md",
        sourceTitle: "成语资源",
      },
    ],
  })

  assert.equal(liveDiscussion.length, 1)
  assert.equal(liveDiscussion[0].role, "Author")
  assert.equal(liveDiscussion[0].streaming, false)
  assert.equal(liveDiscussion[0].artifactPath, ".ai-novel/chapters/chapter-001.final.md")
  assert.match(liveDiscussion[0].content, /第 1 章/)
  assert.match(liveDiscussion[0].content, /draft_completed/)
  assert.match(liveDiscussion[0].content, /chapter-001\.final\.md/)
  assert.match(liveDiscussion[0].content, /质量门禁：passed/)
  assert.match(liveDiscussion[0].content, /知识库召回：1 个片段/)
  assert.match(liveDiscussion[0].content, /idioms\.md/)
  assert.ok(liveDiscussion[0].parts.some((part) => part.type === "markdown" && /draft_completed/.test(part.data.text)))
  assert.ok(liveDiscussion[0].parts.some((part) =>
    part.type === "json"
    && part.data.step === "draft_completed"
    && part.data.knowledgeReferences.length === 1,
  ))
  assert.ok(liveDiscussion[0].parts.some((part) =>
    part.type === "artifact"
    && part.data.path === ".ai-novel/chapters/chapter-001.final.md"
    && /第 1 章/.test(part.data.label)
  ))
})

test("live discussion reducer merges streaming writing progress into one message", async () => {
  const { applyLiveDiscussionEvent } = await loadLiveDiscussionModule()
  let liveDiscussion = []

  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "writing_progress", {
    messageId: "llm-request-3-draft",
    step: "draft_generation_llm_started",
    role: "Author",
    chapterNumber: 3,
    status: "running",
    message: "Author 正在根据第 3 章蓝图生成正文初稿。",
    preview: "Role: Author",
    timestamp: "2026-06-04T10:00:00.000Z",
  })
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "writing_progress", {
    messageId: "llm-request-3-draft",
    step: "draft_generation_llm_streaming",
    role: "Author",
    chapterNumber: 3,
    status: "running",
    message: "Author 正在根据第 3 章蓝图生成正文初稿。模型正在持续输出。",
    preview: "# Chapter 3",
    streamText: "# Chapter 3\n\n持续输出第一段。",
    wordCount: 82,
    timestamp: "2026-06-04T10:00:03.000Z",
  })
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "writing_progress", {
    messageId: "llm-request-3-draft",
    step: "draft_generation_llm_completed",
    role: "Author",
    chapterNumber: 3,
    status: "completed",
    message: "Author 已返回第 3 章初稿，准备进入质检。",
    preview: "# Chapter 3\n\n正文完成。",
    streamText: "# Chapter 3\n\n持续输出第一段。\n\n正文完成。",
    wordCount: 3020,
    timestamp: "2026-06-04T10:01:00.000Z",
  })

  assert.equal(liveDiscussion.length, 1)
  assert.equal(liveDiscussion[0].turnId, "llm-request-3-draft")
  assert.equal(liveDiscussion[0].messageId, "llm-request-3-draft")
  assert.equal(liveDiscussion[0].type, "agent")
  assert.equal(liveDiscussion[0].data.agentType, "author")
  assert.equal(liveDiscussion[0].streaming, false)
  assert.match(liveDiscussion[0].content, /draft_generation/)
  assert.match(liveDiscussion[0].content, /估算字数：3020/)
  assert.match(liveDiscussion[0].content, /持续输出第一段/)
  assert.match(liveDiscussion[0].content, /正文完成/)
  assert.equal(liveDiscussion[0].timestamp, "2026-06-04T10:00:00.000Z")
  assert.equal(liveDiscussion[0].parts.filter((part) => part.type === "markdown").length, 1)
  assert.equal(liveDiscussion[0].parts.filter((part) => part.type === "json").length, 1)
  assert.equal(liveDiscussion[0].parts.find((part) => part.type === "json").data.step, "draft_generation_llm_completed")
  assert.match(liveDiscussion[0].parts.find((part) => part.type === "markdown").data.text, /正文完成/)
})

test("live discussion reducer keeps chapter pipeline progress as distinct status cards", async () => {
  const { applyLiveDiscussionEvent } = await loadLiveDiscussionModule()
  let liveDiscussion = []

  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "writing_progress", {
    step: "chapter_started",
    role: "Showrunner",
    chapterNumber: 4,
    status: "started",
    message: "第 4 章开始生产。",
    timestamp: "2026-06-04T10:00:00.000Z",
  })
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "writing_progress", {
    step: "blueprint_loaded",
    role: "Chapter Planner",
    chapterNumber: 4,
    status: "running",
    message: "第 4 章蓝图已载入。",
    timestamp: "2026-06-04T10:00:05.000Z",
  })
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "writing_progress", {
    step: "chapter_artifacts_saved",
    role: "Memory Keeper",
    chapterNumber: 4,
    status: "completed",
    message: "第 4 章产物已写入。",
    artifactPath: ".ai-novel/chapters/chapter-004.final.md",
    timestamp: "2026-06-04T10:00:10.000Z",
  })

  assert.equal(liveDiscussion.length, 3)
  assert.deepEqual(
    liveDiscussion.map((entry) => entry.parts.find((part) => part.type === "json").data.step),
    ["chapter_started", "blueprint_loaded", "chapter_artifacts_saved"],
  )
  assert.equal(new Set(liveDiscussion.map((entry) => entry.messageId)).size, 3)
  assert.ok(liveDiscussion.every((entry) => entry.type === "status"))
  assert.ok(liveDiscussion.every((entry) => entry.streaming === false))
  assert.ok(liveDiscussion.every((entry) => !/pipeline-status$/u.test(entry.messageId)))
  assert.match(liveDiscussion[2].content, /chapter_artifacts_saved/)
  assert.match(liveDiscussion[2].content, /chapter-004\.final\.md/)
  assert.equal(liveDiscussion[2].parts.filter((part) => part.type === "markdown").length, 1)
  assert.equal(liveDiscussion[2].parts.filter((part) => part.type === "json").length, 1)
  assert.ok(liveDiscussion[2].parts.some((part) => part.type === "artifact" && /chapter-004\.final\.md/.test(part.data.path)))
})

test("live discussion reducer renders autopilot status and retry events as chat cards", async () => {
  const { applyLiveDiscussionEvent } = await loadLiveDiscussionModule()
  let liveDiscussion = applyLiveDiscussionEvent([], "autopilot_status", {
    message: "已连接本进程内嵌无人值守任务监听。",
  })
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "network_retry", {
    retryInMs: 5000,
    message: "LLM request timed out after 120000ms.",
  })

  assert.equal(liveDiscussion.length, 2)
  assert.equal(liveDiscussion[0].role, "Showrunner")
  assert.match(liveDiscussion[0].content, /无人值守状态/)
  assert.match(liveDiscussion[1].content, /模型连接重试/)
  assert.match(liveDiscussion[1].content, /5 秒后自动重试/)
})

test("generateAgentReply can emit incremental chunks before returning the final reply", async () => {
  const runtimeModule = await import(`${pathToFileURL(path.join(packageRoot, "dist", "runtime-llm.mjs")).href}?ts=${Date.now()}`)
  const deltas = []

  const reply = await runtimeModule.generateAgentReply({
    roleName: "Showrunner",
    basePrompt: "Showrunner Base Prompt",
    dynamicPrompt: "Dynamic Prompt",
    consensus: "Global Consensus",
    message: "测试流式输出",
    discussionStage: "opening_brief",
    onDelta(delta) {
      deltas.push(delta)
    },
  })

  assert.ok(deltas.length >= 2)
  assert.equal(deltas.join(""), reply)
  assert.match(reply, /[\u4e00-\u9fff]/u)
})

test("generateAgentReply aborts stalled provider requests using LLM_TIMEOUT_MS", async () => {
  const runtimeModule = await import(`${pathToFileURL(path.join(packageRoot, "dist", "runtime-llm.mjs")).href}?ts=${Date.now()}`)
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-llm-timeout-"))
  const originalTestMode = process.env.AI_NOVEL_TEST_MODE

  const server = createServer((request, response) => {
    request.on("data", () => undefined)
    request.on("end", () => {
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.write("data: ")
    })
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  assert.equal(typeof address, "object")

  try {
    process.env.AI_NOVEL_TEST_MODE = "0"
    await fs.writeFile(
      path.join(tempDir, ".env"),
      [
        `LLM_BASE_URL=http://127.0.0.1:${address.port}/v1`,
        "LLM_API_KEY=test-secret",
        "LLM_MODEL_ID=test-model",
        "LLM_TIMEOUT_MS=50",
        "",
      ].join("\n"),
    )

    await assert.rejects(
      runtimeModule.generateAgentReply({
        roleName: "Showrunner",
        basePrompt: "Showrunner Base Prompt",
        dynamicPrompt: "Dynamic Prompt",
        consensus: "Global Consensus",
        message: "测试超时",
        discussionStage: "opening_brief",
        envRootDir: tempDir,
        onDelta() {},
      }),
      /timed out/i,
    )
  } finally {
    process.env.AI_NOVEL_TEST_MODE = originalTestMode
    await new Promise((resolve) => server.close(resolve))
  }
})

test("production writing uses streaming provider activity instead of one-shot chapter waits", async () => {
  const runtimeSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "runtime-llm.ts"), "utf8")
  const pipelineSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "writing-pipeline.ts"), "utf8")

  assert.match(runtimeSource, /markActivity/)
  assert.match(runtimeSource, /LLM request timed out after \$\{timeoutMs\}ms without provider activity/)
  assert.match(runtimeSource, /streamOpenAiCompatibleResponse\(response,\s*async \(delta\)/)
  assert.match(pipelineSource, /onDelta:\s*progress/)
  assert.match(pipelineSource, /_llm_streaming/)
  assert.match(pipelineSource, /createWritingMessageId/)
  assert.match(pipelineSource, /streamText:\s*streamedResult/)
  assert.match(pipelineSource, /模型正在持续输出/)
})

test("message renderer formats markdown for agent bubbles while escaping unsafe html", async () => {
  const { renderMessageMarkdown } = await loadMessageRendererModule()

  const html = renderMessageMarkdown([
    "### 设定冻结",
    "",
    "---",
    "",
    "- **主角**必须更克制",
    "- 保留 `执念` 线索",
    "1. 编号结论",
    "> 引用观察",
    "**未闭合强调",
    "",
    "```html",
    "<script>alert('xss')</script>",
    "```",
  ].join("\n"))

  assert.match(html, /<h3>设定冻结<\/h3>/)
  assert.match(html, /<hr>/)
  assert.match(html, /<strong>主角<\/strong>/)
  assert.match(html, /<ul>/)
  assert.match(html, /<ol>/)
  assert.match(html, /<blockquote>引用观察<\/blockquote>/)
  assert.match(html, /<code>执念<\/code>/)
  assert.match(html, /&lt;script&gt;alert/)
  assert.doesNotMatch(html, /<script>/)
  assert.doesNotMatch(html, /\*\*/)
})

test("desktop message adapter normalizes extensible typed messages", async () => {
  const {
    createArtifactMessage,
    createImageMessage,
    createToolMessage,
    messageContent,
    messageRole,
    toRenderableMessage,
  } = await import(`${pathToFileURL(path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "messages.mjs")).href}?ts=${Date.now()}`)

  const toolMessage = toRenderableMessage(createToolMessage({
    messageId: "tool-typed",
    toolName: "provider-test",
    input: { model: "fast" },
    output: { ok: true },
    content: "模型检查完成。",
    time: "2026-06-04T10:00:00.000Z",
  }))
  const artifactMessage = toRenderableMessage(createArtifactMessage({
    messageId: "artifact-typed",
    label: "章节成稿",
    artifactPath: ".ai-novel/chapters/chapter-001.final.md",
    content: "正文完成。",
  }))
  const imageMessage = toRenderableMessage(createImageMessage({
    messageId: "image-typed",
    path: ".ai-novel/assets/cover.png",
    alt: "封面",
    caption: "封面草图",
  }))

  assert.equal(messageRole(toolMessage), "Tool")
  assert.match(messageContent(toolMessage), /provider-test/)
  assert.equal(artifactMessage.artifactPath, ".ai-novel/chapters/chapter-001.final.md")
  assert.match(messageContent(artifactMessage), /章节成稿/)
  assert.match(messageContent(imageMessage), /封面草图/)
})

test("desktop message adapter preserves parts and derives artifact paths from artifact parts", async () => {
  const { toRenderableMessage } = await import(`${pathToFileURL(path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "messages.mjs")).href}?ts=${Date.now()}`)

  const message = toRenderableMessage({
    messageId: "agent-with-parts",
    type: "agent",
    status: "completed",
    time: "2026-06-04T10:00:00.000Z",
    data: {
      agentType: "author",
      agentLabel: "Author",
      content: "fallback",
      format: "markdown",
    },
    parts: [
      { id: "p2", message_id: "agent-with-parts", part_index: 2, type: "artifact", data: { path: ".ai-novel/chapters/chapter-001.final.md", label: "第 1 章正式成稿" } },
      { id: "p1", message_id: "agent-with-parts", part_index: 1, type: "json", data: { step: "chapter_artifacts_saved" } },
    ],
  })

  assert.equal(message.parts[0].type, "json")
  assert.equal(message.parts[1].type, "artifact")
  assert.equal(message.artifactPath, ".ai-novel/chapters/chapter-001.final.md")
})

test("discussion renderer collapses long completed agent messages and exposes expand controls", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()
  const longContent = `${"这是一段很长的讨论总结。".repeat(40)}全文尾部唯一标记`
  const html = renderDiscussionHtml({
    entries: [
      {
        key: "entry-1",
        role: "Showrunner",
        content: longContent,
        streaming: false,
      },
    ],
  })

  assert.match(html, /message-expand-button/)
  assert.match(html, /展开查看/)
  assert.match(html, /is-collapsed/)
  assert.match(html, /已折叠长内容/)
  assert.doesNotMatch(html, /全文尾部唯一标记/)
})

test("discussion renderer renders full content only after a long entry is expanded", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()
  const html = renderDiscussionHtml({
    entries: [
      {
        key: "entry-1",
        role: "Showrunner",
        content: `${"这是一段很长的讨论总结。".repeat(40)}全文尾部唯一标记`,
        streaming: false,
      },
    ],
    expandedKeys: new Set(["entry-1"]),
  })

  assert.match(html, /收起全文/)
  assert.match(html, /is-expanded/)
  assert.match(html, /全文尾部唯一标记/)
  assert.doesNotMatch(html, /已折叠长内容/)
})

test("discussion renderer streams a bounded preview instead of rendering huge live content", async () => {
  const { renderDiscussionEntryContentHtml } = await loadDiscussionRendererModule()
  const content = [
    "开头唯一标记",
    ...Array.from({ length: 220 }, (_, index) => `第 ${index + 1} 行流式正文 ${"x".repeat(24)}`),
    "尾部唯一标记",
  ].join("\n")

  const rendered = renderDiscussionEntryContentHtml({
    key: "stream-1",
    role: "Showrunner",
    content,
    streaming: true,
  }, {
    entryKey: "stream-1",
    expandedKeys: new Set(),
  })

  assert.equal(rendered.previewed, true)
  assert.match(rendered.html, /仅显示最新片段/)
  assert.match(rendered.html, /尾部唯一标记/)
  assert.doesNotMatch(rendered.html, /开头唯一标记/)
  assert.ok(rendered.html.length < content.length)
})

test("discussion renderer merges transcript, pending input, and live entries in order", async () => {
  const { buildRenderableDiscussionEntries } = await loadDiscussionRendererModule()

  const entries = buildRenderableDiscussionEntries({
    recentEntries: [{ key: "r1", role: "User", content: "历史消息" }],
    pendingUserMessages: [
      { key: "p1", content: "第一条已发送消息" },
      { key: "p2", content: "第二条已发送消息" },
    ],
    liveDiscussion: [{ turnId: "live-1", role: "Showrunner", content: "流式增量", streaming: true }],
  })

  assert.deepEqual(entries.map((entry) => entry.content), ["历史消息", "第一条已发送消息", "第二条已发送消息", "流式增量"])
})

test("discussion renderer orders history, live, and pending messages by timestamp", async () => {
  const { buildRenderableDiscussionEntries } = await loadDiscussionRendererModule()

  const entries = buildRenderableDiscussionEntries({
    recentEntries: [
      { key: "history-newer", role: "World Architect", content: "22:03 历史消息", timestamp: "2026-06-04T14:03:08.000Z" },
      { key: "history-older", role: "Showrunner", content: "21:58 历史消息", timestamp: "2026-06-04T13:58:00.000Z" },
    ],
    pendingUserMessages: [
      { key: "pending", content: "没有时间戳的 pending 消息" },
    ],
    liveDiscussion: [
      { turnId: "live-middle", role: "Author", content: "22:00 live 消息", timestamp: "2026-06-04T14:00:08.000Z" },
    ],
  })

  assert.deepEqual(entries.map((entry) => entry.content), [
    "21:58 历史消息",
    "22:00 live 消息",
    "22:03 历史消息",
    "没有时间戳的 pending 消息",
  ])
})

test("discussion renderer does not invent current timestamps for undated messages", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()

  const html = renderDiscussionHtml({
    entries: [
      { key: "undated", role: "Author", content: "没有真实时间戳的消息" },
    ],
    formatClock() {
      return "SHOULD_NOT_RENDER"
    },
  })

  assert.doesNotMatch(html, /SHOULD_NOT_RENDER/)
})

test("discussion renderer shows millisecond precision for dated chat messages", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()

  const html = renderDiscussionHtml({
    entries: [
      { key: "first", role: "Author", content: "第一条", timestamp: "2026-06-04T10:00:00.012Z" },
      { key: "second", role: "Editor", content: "第二条", timestamp: "2026-06-04T10:00:00.245Z" },
    ],
  })

  assert.match(html, /012/)
  assert.match(html, /245/)
})

test("discussion renderer only auto-scrolls when the viewer is already near the bottom", async () => {
  const { shouldAutoScrollDiscussion } = await loadDiscussionRendererModule()

  assert.equal(
    shouldAutoScrollDiscussion({ scrollTop: 540, clientHeight: 360, scrollHeight: 920 }),
    true,
  )
  assert.equal(
    shouldAutoScrollDiscussion({ scrollTop: 120, clientHeight: 360, scrollHeight: 920 }),
    false,
  )
})

test("discussion renderer shows an explicit final result card when a consensus summary is available", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()

  const html = renderDiscussionHtml({
    result: {
      target: {
        label: "chapter blueprint discussion",
        assetPath: ".ai-novel/plans/chapter-blueprints/",
      },
      summary: "### 最终结论\n- 锁定本章目标\n- 写回章节蓝图",
    },
    entries: [],
  })

  assert.match(html, /discussion-result-card/)
  assert.match(html, /最终结论|Final Consensus/)
  assert.match(html, /chapter blueprint discussion/)
  assert.match(html, /chapter-blueprints/)
  assert.ok(html.indexOf("历史消息") === -1)
})

test("discussion renderer exposes a pluggable message renderer registry", async () => {
  const { MESSAGE_RENDERERS, messageRendererForType } = await loadDiscussionRendererModule()

  assert.equal(typeof MESSAGE_RENDERERS.agent, "function")
  assert.equal(typeof MESSAGE_RENDERERS.user, "function")
  assert.equal(typeof MESSAGE_RENDERERS.status, "function")
  assert.equal(typeof MESSAGE_RENDERERS.tool, "function")
  assert.equal(typeof MESSAGE_RENDERERS.artifact, "function")
  assert.equal(typeof MESSAGE_RENDERERS.image, "function")
  assert.equal(messageRendererForType("tool"), MESSAGE_RENDERERS.tool)
  assert.equal(messageRendererForType("unknown"), MESSAGE_RENDERERS.agent)
})

test("discussion renderer renders image messages with safe captions", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()

  const html = renderDiscussionHtml({
    entries: [
      {
        messageId: "image-1",
        type: "image",
        time: "2026-06-04T10:00:00.000Z",
        data: {
          agentType: "author",
          agentLabel: "Author",
          url: "/assets/cover.png",
          alt: "封面草图",
          caption: "第一版封面 <img src=x onerror=alert(1)>",
        },
      },
    ],
  })

  assert.match(html, /data-message-type="image"/)
  assert.match(html, /class="message-image-preview"/)
  assert.match(html, /src="\/assets\/cover\.png"/)
  assert.match(html, /alt="封面草图"/)
  assert.match(html, /&lt;img src=x onerror=alert/)
  assert.doesNotMatch(html, /<img src=x onerror/)
})

test("discussion renderer renders artifact messages with preview actions", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()

  const html = renderDiscussionHtml({
    entries: [
      {
        messageId: "artifact-1",
        type: "artifact",
        time: "2026-06-04T10:00:00.000Z",
        data: {
          agentType: "author",
          agentLabel: "Author",
          label: "章节成稿",
          artifactPath: ".ai-novel/chapters/chapter-001.final.md",
          content: "### 第 1 章\n正文已经写入产物。",
          format: "markdown",
        },
      },
    ],
  })

  assert.match(html, /data-message-type="artifact"/)
  assert.match(html, /message-artifact-button/)
  assert.match(html, /章节成稿/)
  assert.match(html, /chapter-001\.final\.md/)
  assert.match(html, /<h3>第 1 章<\/h3>/)
})

test("discussion renderer renders tool messages without executing unsafe output", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()

  const html = renderDiscussionHtml({
    entries: [
      {
        messageId: "tool-1",
        type: "tool",
        status: "completed",
        time: "2026-06-04T10:00:00.000Z",
        data: {
          toolName: "provider-test",
          status: "completed",
          content: "模型连通性检查完成。",
          input: { model: "test-model" },
          output: { ok: true, unsafe: "<script>alert(1)</script>" },
        },
      },
    ],
  })

  assert.match(html, /data-message-type="tool"/)
  assert.match(html, /message-tool-bubble/)
  assert.match(html, /provider-test/)
  assert.match(html, /completed/)
  assert.match(html, /&quot;model&quot;: &quot;test-model&quot;/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test("discussion renderer renders structured tool parts as one safe message", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()

  const html = renderDiscussionHtml({
    entries: [
      {
        messageId: "tool-with-parts",
        type: "tool",
        status: "completed",
        time: "2026-06-04T10:00:00.000Z",
        data: {
          toolName: "provider-test",
          status: "completed",
          content: "fallback summary",
        },
        parts: [
          { id: "tool-with-parts:part:0", index: 0, type: "markdown", data: { text: "Provider reachable." } },
          { id: "tool-with-parts:part:1", index: 1, type: "tool_call", data: { toolName: "provider-test", input: { modelName: "override-model" } } },
          { id: "tool-with-parts:part:2", index: 2, type: "tool_result", data: { status: "completed", output: { ok: true, unsafe: "<img src=x onerror=alert(1)>" }, error: null } },
        ],
      },
    ],
  })

  assert.match(html, /data-message-id="tool-with-parts"/)
  assert.match(html, /Provider reachable/)
  assert.match(html, /&quot;modelName&quot;: &quot;override-model&quot;/)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(html, /<img src=x/)
})

test("discussion renderer renders agent parts with structured JSON and artifact preview", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()

  const html = renderDiscussionHtml({
    entries: [
      {
        messageId: "agent-parts",
        type: "agent",
        status: "completed",
        time: "2026-06-04T10:00:00.000Z",
        data: {
          agentType: "author",
          agentLabel: "Author",
          content: "fallback",
          format: "markdown",
        },
        parts: [
          { id: "agent-parts:part:0", index: 0, type: "markdown", data: { text: "### 第 1 章\n正文保存完成。" } },
          { id: "agent-parts:part:1", index: 1, type: "json", data: { step: "chapter_artifacts_saved", unsafe: "<script>alert(1)</script>" } },
          { id: "agent-parts:part:2", index: 2, type: "artifact", data: { path: ".ai-novel/chapters/chapter-001.final.md", label: "第 1 章正式成稿", kind: "chapter", status: "completed" } },
        ],
      },
    ],
  })

  assert.match(html, /<h3>第 1 章<\/h3>/)
  assert.match(html, /message-part-json/)
  assert.match(html, /chapter_artifacts_saved/)
  assert.match(html, /message-part-artifact/)
  assert.match(html, /第 1 章正式成稿/)
  assert.match(html, /message-artifact-button/)
  assert.match(html, /data-artifact-path="\.ai-novel\/chapters\/chapter-001\.final\.md"/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test("desktop studio includes a provider config modal with test and save actions", async () => {
  const html = await fs.readFile(desktopIndexEntry, "utf8")

  assert.match(html, /id="provider-config-modal"/)
  assert.match(html, /id="provider-base-url-input"/)
  assert.match(html, /id="provider-api-key-input"/)
  assert.match(html, /id="provider-model-input"/)
  assert.match(html, /id="provider-test-button"/)
  assert.match(html, /id="provider-save-button"/)
})

test("desktop studio exposes network recovery status and retry hooks", async () => {
  const html = await fs.readFile(desktopIndexEntry, "utf8")
  const js = await fs.readFile(desktopAppEntry, "utf8")

  assert.match(html, /id="network-status-banner"/)
  assert.match(js, /markNetworkOffline/)
  assert.match(js, /probeConnection/)
  assert.match(js, /resumeAfterNetworkRecovery/)
  assert.match(js, /function snapshotJobDisplayState/)
  assert.match(js, /job\?\.status === "paused" \|\| !job\?\.lease_owner/)
  assert.match(js, /job\?\.status === "running"\s*&& job\?\.lease_owner/)
  assert.match(js, /function hasRunningAutopilotJob\(\)/)
  assert.match(js, /const running = Boolean\(runtimeAutopilot\.running \|\| hasRunningAutopilotJob\(\) \|\| dashboardState\.autopilotStreamConnected\)/)
  assert.match(js, /function syncComposerStatusFromAutopilotControl\(\)/)
  assert.match(js, /AUTOPILOT_RESUME_HINT/)
  assert.match(js, /后台 worker 正在运行；如果模型超时，会自动重试并保留进度。/)
  assert.match(js, /control\.running\s*\?\s*"创作进行中"/)
  assert.match(js, /addEventListener\("offline"/)
  assert.match(js, /addEventListener\("online"/)
  assert.match(js, /network_retry/)
  assert.match(js, /isProviderTimeoutMessage/)
  assert.match(js, /模型响应超时/)
})

test("desktop composer shows submitted, processing, and failure feedback", async () => {
  const html = await fs.readFile(desktopIndexEntry, "utf8")
  const js = await fs.readFile(desktopAppEntry, "utf8")
  const css = await fs.readFile(desktopStyleEntry, "utf8")

  assert.match(html, /id="composer-status"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /data-composer-action="advance"/)
  assert.match(html, /data-composer-action="cover"/)
  assert.match(html, /data-composer-action="interrupt"/)
  assert.match(html, /data-composer-action="provider-test"/)
  assert.match(html, /data-composer-action="stop"/)
  assert.match(js, /setComposerStatus/)
  assert.match(js, /renderComposerStatus/)
  assert.match(js, /function runComposerAction/)
  assert.match(js, /\[data-composer-action\]/)
  assert.match(js, /消息已提交，正在创建无人值守任务/)
  assert.match(js, /agent 已开始输出|已接收消息/)
  assert.match(js, /pendingUserMessages/)
  assert.match(js, /acknowledgePendingMessages/)
  assert.match(js, /ensureLiveRegion/)
  assert.match(js, /sendButton\.disabled = busy/)
  assert.match(css, /\.composer-status\.is-processing/)
  assert.match(css, /\.composer-status\.is-warning/)
  assert.match(css, /\.composer-status\.is-error/)
})

test("desktop project creation disables duplicate submits while request is in flight", async () => {
  const html = await fs.readFile(desktopIndexEntry, "utf8")
  const js = await fs.readFile(desktopAppEntry, "utf8")

  assert.match(js, /projectCreateInFlight:\s*false/)
  assert.match(js, /function setProjectCreateBusy/)
  assert.match(js, /projectCreateSubmitButton\.disabled = dashboardState\.projectCreateInFlight/)
  assert.match(js, /if \(dashboardState\.projectCreateInFlight\) return/)
  assert.match(js, /正在创建项目，请不要重复提交/)
  assert.match(js, /项目已创建，已停留在项目列表/)
  assert.match(js, /showManagerView\(\)/)
  assert.doesNotMatch(js, /创建并启动/)
  assert.doesNotMatch(js, /创建后会直接进入该项目/)
  assert.match(html, /建立独立工作区；进入创作台后可手动开始自动创作/)
  assert.match(html, /创建项目/)
  assert.doesNotMatch(html, /创建并启动/)
  assert.doesNotMatch(html, /创建后会直接进入该项目/)
})

test("desktop studio exposes manual unattended controls instead of auto-resuming jobs", async () => {
  const js = await fs.readFile(desktopAppEntry, "utf8")
  const html = await fs.readFile(desktopIndexEntry, "utf8")

  assert.match(html, /id="autopilot-start-button"/)
  assert.match(html, /id="autopilot-stop-button"/)
  assert.match(js, /function startAutopilotFromButton/)
  assert.match(js, /function hasRecoverableAutopilotJob/)
  assert.match(js, /function maybeResumeAutopilotFromSnapshot/)
  assert.match(js, /点击“继续创作”后接着上次进度运行/)
  assert.doesNotMatch(js, /streamAutopilot\("",\s*\{\s*resume:\s*true,\s*skipStart:\s*true\s*\}\)/)
  assert.match(js, /if \(!options\.skipStart && \(message \|\| !dashboardState\.state\?\.runtime\?\.autopilot\?\.running\)\)/)
})

test("desktop studio streams chapter writing progress into the discussion panel", async () => {
  const js = await fs.readFile(desktopAppEntry, "utf8")
  const pipelineSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "writing-pipeline.ts"), "utf8")
  const workerSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "autopilot-worker.ts"), "utf8")

  assert.match(pipelineSource, /WritingProgressEvent/)
  assert.match(pipelineSource, /WRITING_PROGRESS/)
  assert.match(workerSource, /"writing_progress"/)
  assert.match(js, /eventName === "writing_progress"/)
  assert.match(js, /eventName === "autopilot_status"/)
  assert.match(js, /eventName === "network_retry"/)
  assert.match(js, /applyLiveDiscussionEvent\(dashboardState\.liveDiscussion,\s*eventName,\s*data\)/)
  assert.match(js, /message-artifact-button/)
  assert.match(js, /previewArtifact\(artifactButton\.dataset\.artifactPath/)
  assert.match(await fs.readFile(desktopStyleEntry, "utf8"), /\.message-artifact-button/)
})

test("desktop studio includes project manager and create-project modal scaffolding", async () => {
  const html = await fs.readFile(desktopIndexEntry, "utf8")

  assert.match(html, /id="project-manager-view"/)
  assert.match(html, /id="project-list-container"/)
  assert.match(html, /id="open-project-create-button"/)
  assert.match(html, /id="project-create-modal"/)
  assert.match(html, /id="project-create-title-input"/)
  assert.match(html, /id="project-create-idea-input"/)
  assert.match(html, /id="project-create-chapters-input"/)
  assert.match(html, /id="project-create-words-input"/)
  assert.match(html, /id="project-create-submit-button"/)
})

test("desktop project manager supports scrolling and confirmed project deletion", async () => {
  const js = await fs.readFile(desktopAppEntry, "utf8")
  const css = await fs.readFile(desktopStyleEntry, "utf8")
  const serverSource = await fs.readFile(path.join(process.cwd(), "..", "ai-novel-core", "src", "studio-server.ts"), "utf8")

  assert.match(js, /deletingProjectIds:\s*new Set\(\)/)
  assert.match(js, /data-project-delete-id/)
  assert.match(js, /确定删除《/)
  assert.match(js, /操作不可撤销/)
  assert.match(js, /method:\s*"DELETE"/)
  assert.match(js, /encodeURIComponent\(projectId\)/)
  assert.match(css, /\.project-list\s*{[^}]*overflow-y:\s*auto/s)
  assert.match(css, /\.project-card-delete/)
  assert.match(serverSource, /method === "DELETE"/)
  assert.match(serverSource, /deleteManagedAutonomousProject/)
})

test("desktop studio remembers the last active project across reloads", async () => {
  const js = await fs.readFile(desktopAppEntry, "utf8")

  assert.match(js, /ACTIVE_PROJECT_STORAGE_KEY/)
  assert.match(js, /localStorage\.setItem\(ACTIVE_PROJECT_STORAGE_KEY/)
  assert.match(js, /localStorage\.getItem\(ACTIVE_PROJECT_STORAGE_KEY/)
})

test("tui submit key detection handles both named enter keys and raw newline input", async () => {
  const { isComposerSubmitKey } = await import(`${pathToFileURL(path.join(packageRoot, "dist", "tui.mjs")).href}?ts=${Date.now()}`)

  assert.equal(isComposerSubmitKey("\n", {}), true)
  assert.equal(isComposerSubmitKey("\r", {}), true)
  assert.equal(isComposerSubmitKey("主角要更克制\n", {}), true)
  assert.equal(isComposerSubmitKey("", { name: "return" }), true)
  assert.equal(isComposerSubmitKey("", { name: "enter" }), true)
  assert.equal(isComposerSubmitKey("a", { name: "a" }), false)
})

test("ai-novel interrupt escalates to replanning for global story changes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-interrupt-"))

  await runCli(["init", "--idea", "A mountain village alchemist rises"], tempDir)
  const result = await runCli(
    ["interrupt", "--message", "Change the entire genre to cyberpunk and rewrite the core world rules"],
    tempDir,
  )

  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /global/i)
  assert.match(result.stdout, /replanning/i)

  const statePath = path.join(tempDir, ".ai-novel", "state.json")
  const state = JSON.parse(await fs.readFile(statePath, "utf8"))
  assert.equal(state.runtime.stage, "replanning")
  assert.equal(state.runtime.lastInterruption.scope, "global")
})

test("ai-novel init accepts larger chapter word targets and rejects smaller ones", async () => {
  const successDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-words-ok-"))
  const success = await runCli(
    ["init", "--idea", "An assassin nun infiltrates the empire", "--chapter-words", "3200"],
    successDir,
  )
  assert.equal(success.code, 0, success.stderr)

  const successState = JSON.parse(
    await fs.readFile(path.join(successDir, ".ai-novel", "state.json"), "utf8"),
  )
  assert.equal(successState.plan.chapterWordTarget, 3200)
  assert.equal(successState.plan.chapterTasks[0].targetWords, 3200)

  const failureDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-words-fail-"))
  const failure = await runCli(
    ["init", "--idea", "A sea witch bargains with emperors", "--chapter-words", "2000"],
    failureDir,
  )
  assert.equal(failure.code, 1)
  assert.match(failure.stderr, /2500/)
})

test("ai-novel advance executes real workflow steps and writes planning artifacts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-advance-"))
  await runCli(["init", "--idea", "A blind astronomer hears the future in starlight"], tempDir)
  await runCli(["chat", "--message", "主角要更克制，结局要有悲壮但明亮的回响"], tempDir)

  const first = await runCli(["advance"], tempDir)
  assert.equal(first.code, 0, first.stderr)
  assert.match(first.stdout, /setting_review/i)

  const freezeDoc = await fs.readFile(
    path.join(tempDir, ".ai-novel", "plans", "setting-freeze.md"),
    "utf8",
  )
  assert.match(freezeDoc, /Setting Freeze/i)
  assert.match(freezeDoc, /主角要更克制|悲壮但明亮的回响/i)

  const second = await runCli(["advance"], tempDir)
  assert.equal(second.code, 0, second.stderr)
  assert.match(second.stdout, /master_planning/i)

  const outlineDoc = await fs.readFile(
    path.join(tempDir, ".ai-novel", "plans", "master-outline.md"),
    "utf8",
  )
  assert.match(outlineDoc, /Production Master Outline/i)
  assert.match(outlineDoc, /主角|discussion|promise|悲壮|Quality Policy/i)

  const third = await runCli(["advance"], tempDir)
  assert.equal(third.code, 0, third.stderr)
  assert.match(third.stdout, /drafting/i)

  const blueprint = await fs.readFile(
    path.join(tempDir, ".ai-novel", "plans", "chapter-blueprints", "chapter-001.md"),
    "utf8",
  )
  assert.match(blueprint, /Detailed Chapter Blueprint/i)
  assert.match(blueprint, /Event Sequence|Vocabulary And Idiom Strategy|Genre Narration/i)

  const fourth = await runCli(["advance"], tempDir)
  assert.equal(fourth.code, 0, fourth.stderr)
  assert.match(fourth.stdout, /drafting|chapter/i)

  const draft = await fs.readFile(
    path.join(tempDir, ".ai-novel", "chapters", "chapter-001.final.md"),
    "utf8",
  )
  assert.match(draft, /Final Body/i)
  assert.match(draft, /Polish Pass/i)

  const report = await fs.readFile(
    path.join(tempDir, ".ai-novel", "reports", "chapter-001-quality.md"),
    "utf8",
  )
  assert.match(report, /Chapter Quality Report/i)

  const memory = await fs.readFile(
    path.join(tempDir, ".ai-novel", "memory", "chapter-001-memory.md"),
    "utf8",
  )
  assert.match(memory, /Memory Update/i)

  const state = JSON.parse(
    await fs.readFile(path.join(tempDir, ".ai-novel", "state.json"), "utf8"),
  )
  assert.notEqual(state.plan.chapterTasks[0].status, "pending")
  assert.equal(state.plan.pendingChapters, state.plan.totalChapters - 1)
  assert.equal(state.runtime.lastRoute, "drafting")
  assert.match(state.runtime.lastAction, /chapter_(production_started|completed):1/)

  const contextPacket = await fs.readFile(
    path.join(tempDir, ".ai-novel", "context", "current-context.md"),
    "utf8",
  )
  assert.match(contextPacket, /- Stage: drafting/)
  assert.match(contextPacket, /- Target: chapter drafting/)
  assert.match(contextPacket, /- Asset: \.ai-novel\/chapters\//)
})

test("ai-novel cover prepares a concrete cover prompt artifact", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-cover-"))
  await runCli(["init", "--idea", "A sea empress bargains with moonlit storms"], tempDir)

  const result = await runCli(["cover"], tempDir)
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /in_progress/i)

  const state = JSON.parse(await fs.readFile(path.join(tempDir, ".ai-novel", "state.json"), "utf8"))
  assert.equal(state.assets.cover.status, "in_progress")

  const coverPrompt = await fs.readFile(
    path.join(tempDir, ".ai-novel", "assets", "cover", "cover-prompt.md"),
    "utf8",
  )
  assert.match(coverPrompt, /image prompt/i)
})

test("ai-novel provider-test records a successful provider connectivity check in test mode", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-provider-"))
  await fs.writeFile(
    path.join(tempDir, ".env"),
    [
      "LLM_BASE_URL=https://example.test/v1",
      "LLM_API_KEY=test-secret",
      "LLM_MODEL_ID=test-model",
      "",
    ].join("\n"),
  )

  await runCli(["init", "--idea", "A storm oracle rewrites dynasties"], tempDir)
  const result = await runCli(["provider-test"], tempDir)

  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Provider status: ok/i)
  assert.match(result.stdout, /test mode/i)

  const state = JSON.parse(await fs.readFile(path.join(tempDir, ".ai-novel", "state.json"), "utf8"))
  assert.equal(state.runtime.lastProviderCheck.ok, true)
  assert.match(state.runtime.lastProviderCheck.message, /test mode/i)
  assert.equal(state.runtime.lastRoute, "provider_test")
})

test("ai-novel chat runs visible multi-agent discussion and updates consensus", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-chat-"))
  const chatEnv = { ...process.env, AI_NOVEL_TEST_MODE: "1" }

  await runCli(["init", "--idea", "A moon priestess bargains with dead constellations"], tempDir)
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliEntry, "chat", "--message", "主角应该更冷静克制，但仍有隐秘执念"], {
      cwd: tempDir,
      env: chatEnv,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })

  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /showrunner/i)
  assert.match(result.stdout, /world architect/i)
  assert.match(result.stdout, /author/i)
  assert.match(result.stdout, /prose stylist/i)

  const transcriptPath = path.join(tempDir, ".ai-novel", "chat", "discussion-log.md")
  const transcript = await fs.readFile(transcriptPath, "utf8")
  assert.match(transcript, /moon priestess/i)
  assert.match(transcript, /主角应该更冷静克制/i)
  assert.match(transcript, /Showrunner:/g)

  const consensusPath = path.join(tempDir, ".ai-novel", "prompts", "global-consensus.md")
  const consensus = await fs.readFile(consensusPath, "utf8")
  assert.match(consensus, /Latest discussion summary/i)
  assert.match(consensus, /synthesis|closure|consensus/i)

  const protagonistPath = path.join(tempDir, ".ai-novel", "memory", "characters", "core", "protagonist.md")
  const protagonist = await fs.readFile(protagonistPath, "utf8")
  assert.match(protagonist, /冷静克制/i)
})

test("ai-novel chat routes status, workflow, and interruption style messages", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-routes-"))
  await runCli(["init", "--idea", "A scholar bargains with a ruined sun"], tempDir)

  const statusResult = await runCli(["chat", "--message", "现在进行到哪个阶段了？"], tempDir)
  assert.equal(statusResult.code, 0, statusResult.stderr)
  assert.match(statusResult.stdout, /Route: status_query/i)
  assert.match(statusResult.stdout, /worldbuilding_dialogue/i)

  const workflowResult = await runCli(["chat", "--message", "继续推进到下一步"], tempDir)
  assert.equal(workflowResult.code, 0, workflowResult.stderr)
  assert.match(workflowResult.stdout, /Route: workflow_control/i)
  assert.match(workflowResult.stdout, /setting_review/i)

  const interruptionResult = await runCli(["chat", "--message", "把整个故事改成赛博神话风格"], tempDir)
  assert.equal(interruptionResult.code, 0, interruptionResult.stderr)
  assert.match(interruptionResult.stdout, /Route: interruption_change/i)
  assert.match(interruptionResult.stdout, /replanning/i)
})

test("ai-novel tui --once renders a dashboard snapshot", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-cli-tui-"))
  await fs.writeFile(
    path.join(tempDir, ".env"),
    [
      "LLM_BASE_URL=https://example.test/v1",
      "LLM_API_KEY=test-secret",
      "LLM_MODEL_ID=test-model",
      "",
    ].join("\n"),
  )
  await runCli(["init", "--idea", "A cursed archivist deciphers forbidden stars"], tempDir)
  await runCli(["chat", "--message", "文风要更冷，更克制，更少解释"], tempDir)
  await runCli(["provider-test"], tempDir)

  const statePath = path.join(tempDir, ".ai-novel", "state.json")
  const state = JSON.parse(await fs.readFile(statePath, "utf8"))
  state.runtime.lastRoute = "discussion_chat"
  state.runtime.lastAction = "Refine the protagonist voice toward colder restraint."
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)

  const result = await runCli(["tui", "--once"], tempDir)
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /AI Novel Factory TUI/)
  assert.match(result.stdout, /worldbuilding_dialogue/)
  assert.match(result.stdout, /Story Memory/)
  assert.match(result.stdout, /Workflow Control/)
  assert.match(result.stdout, /Pending chapter tasks/)
  assert.match(result.stdout, /Provider env: \[configured\]/i)
  assert.match(result.stdout, /Provider model: test-model/i)
  assert.match(result.stdout, /Provider test: ok/i)
  assert.match(result.stdout, /Provider note: Provider connectivity check passed in test mode/i)
  assert.match(result.stdout, /Last route: discussion_chat/i)
  assert.match(result.stdout, /Last action: Refine the protagonist voice/i)
  assert.match(result.stdout, /Recent discussion/i)
  assert.match(result.stdout, /User: 文风要更冷/i)
  assert.match(result.stdout, /Showrunner/i)
  assert.match(result.stdout, /Editor/i)
  assert.match(result.stdout, /Composer/)
  assert.match(result.stdout, /Type in the live prompt below the dashboard. Enter sends one line./i)
  assert.match(result.stdout, /\/advance/)
  assert.match(result.stdout, /\/provider-test/)
})

test("tui renderer can show live streamed discussion lines before transcript persistence", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-tui-stream-render-"))
  const { renderTuiScreen } = await loadTuiModule()

  await runCli(["init", "--idea", "A star judge loses her shadow"], tempDir)
  const state = JSON.parse(await fs.readFile(path.join(tempDir, ".ai-novel", "state.json"), "utf8"))

  const output = renderTuiScreen(state, {
    recentDiscussion: ["User: 主角要更锋利", "Showrunner: We will harden the protagonist voice."],
    liveDiscussion: ["World Architect: Tighten the world pressure.", "Author: Sharpen internal restraint."],
    systemNote: "Streaming 2 agent replies...",
  })

  assert.match(output, /Live agent stream/i)
  assert.match(output, /World Architect: Tighten the world pressure/i)
  assert.match(output, /Author: Sharpen internal restraint/i)
})
