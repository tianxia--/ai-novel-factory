import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
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
const viewModelEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "view-model.mjs")
const liveDiscussionEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "live-discussion.mjs")
const messageRendererEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "message-renderer.mjs")
const discussionRendererEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "src", "discussion-renderer.mjs")
const desktopIndexEntry = path.join(process.cwd(), "..", "..", "apps", "desktop", "index.html")

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

  assert.equal(firstCreate.status, 200)
  assert.equal(secondCreate.status, 200)
  assert.ok(firstCreate.payload.projectId)
  assert.ok(firstCreate.payload.discussion)
  assert.match(firstCreate.payload.transcript, /Showrunner:/)

  const listResult = await handleNovelStudioApi(tempDir, "GET", "/api/projects")
  assert.equal(listResult.status, 200)
  assert.equal(listResult.payload.projects.length, 2)

  const ambiguousStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status")
  assert.equal(ambiguousStatus.status, 409)
  assert.equal(ambiguousStatus.payload.error, "project_selection_required")

  const firstStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: firstCreate.payload.projectId })
  const secondStatus = await handleNovelStudioApi(tempDir, "GET", "/api/status", {}, { projectId: secondCreate.payload.projectId })

  assert.equal(firstStatus.status, 200)
  assert.equal(secondStatus.status, 200)
  assert.equal(firstStatus.payload.state.project.idea, "A blind stargazer hears the future in cosmic noise")
  assert.equal(secondStatus.payload.state.project.idea, "A fallen prince rebuilds an ash kingdom from ruin")

  const firstTranscript = firstStatus.payload.transcript
  const secondTranscript = secondStatus.payload.transcript
  assert.match(firstTranscript, /Blind|stargazer|future/i)
  assert.match(secondTranscript, /ash kingdom|fallen prince/i)
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
  const viewModel = deriveStudioViewModel({ state, transcript })

  assert.equal(viewModel.project.idea, "A frost saint bargains with a dead sea")
  assert.equal(viewModel.project.chapterWordTarget, 2500)
  assert.equal(viewModel.provider.configured, true)
  assert.equal(viewModel.provider.testOk, true)
  assert.equal(viewModel.workflow.currentStage.key, "worldbuilding_dialogue")
  assert.ok(viewModel.workflow.steps.some((step) => step.key === "worldbuilding_dialogue"))
  assert.ok(viewModel.chapters.items.length > 0)
  assert.match(viewModel.discussion.recent[0].role, /user/i)
  assert.ok(viewModel.storyMemory.openQuestions.length > 0)
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

test("live discussion reducer applies incremental agent stream events immediately", async () => {
  const { applyLiveDiscussionEvent } = await loadLiveDiscussionModule()

  let liveDiscussion = []
  liveDiscussion = applyLiveDiscussionEvent(liveDiscussion, "agent_start", {
    turnId: "turn-1",
    role: "Showrunner",
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
  })
  assert.equal(liveDiscussion[0].streaming, false)
  assert.equal(liveDiscussion[0].content, "Hello world")
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

test("message renderer formats markdown for agent bubbles while escaping unsafe html", async () => {
  const { renderMessageMarkdown } = await loadMessageRendererModule()

  const html = renderMessageMarkdown([
    "### 设定冻结",
    "",
    "- **主角**必须更克制",
    "- 保留 `执念` 线索",
    "",
    "```html",
    "<script>alert('xss')</script>",
    "```",
  ].join("\n"))

  assert.match(html, /<h3>设定冻结<\/h3>/)
  assert.match(html, /<strong>主角<\/strong>/)
  assert.match(html, /<ul>/)
  assert.match(html, /<code>执念<\/code>/)
  assert.match(html, /&lt;script&gt;alert/)
  assert.doesNotMatch(html, /<script>/)
})

test("discussion renderer collapses long completed agent messages and exposes expand controls", async () => {
  const { renderDiscussionHtml } = await loadDiscussionRendererModule()
  const html = renderDiscussionHtml({
    entries: [
      {
        key: "entry-1",
        role: "Showrunner",
        content: `${"这是一段很长的讨论总结。".repeat(40)}`,
        streaming: false,
      },
    ],
  })

  assert.match(html, /message-expand-button/)
  assert.match(html, /展开查看/)
  assert.match(html, /is-collapsed/)
})

test("discussion renderer merges transcript, pending input, and live entries in order", async () => {
  const { buildRenderableDiscussionEntries } = await loadDiscussionRendererModule()

  const entries = buildRenderableDiscussionEntries({
    recentEntries: [{ key: "r1", role: "User", content: "历史消息" }],
    pendingUserMessage: "正在输入的消息",
    liveDiscussion: [{ turnId: "live-1", role: "Showrunner", content: "流式增量", streaming: true }],
  })

  assert.deepEqual(entries.map((entry) => entry.content), ["历史消息", "正在输入的消息", "流式增量"])
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

test("desktop studio includes a provider config modal with test and save actions", async () => {
  const html = await fs.readFile(desktopIndexEntry, "utf8")

  assert.match(html, /id="provider-config-modal"/)
  assert.match(html, /id="provider-base-url-input"/)
  assert.match(html, /id="provider-api-key-input"/)
  assert.match(html, /id="provider-model-input"/)
  assert.match(html, /id="provider-test-button"/)
  assert.match(html, /id="provider-save-button"/)
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
  assert.match(outlineDoc, /Master Outline/i)
  assert.match(outlineDoc, /主角|discussion|promise|悲壮/i)

  const third = await runCli(["advance"], tempDir)
  assert.equal(third.code, 0, third.stderr)
  assert.match(third.stdout, /chapter_task_generation/i)

  const blueprint = await fs.readFile(
    path.join(tempDir, ".ai-novel", "plans", "chapter-blueprints", "chapter-001.md"),
    "utf8",
  )
  assert.match(blueprint, /Chapter Blueprint/i)
  assert.match(blueprint, /主角|world rule|relationship|hook/i)

  const fourth = await runCli(["advance"], tempDir)
  assert.equal(fourth.code, 0, fourth.stderr)
  assert.match(fourth.stdout, /drafting|chapter/i)

  const draft = await fs.readFile(
    path.join(tempDir, ".ai-novel", "chapters", "chapter-001.md"),
    "utf8",
  )
  assert.match(draft, /Chapter Draft/i)

  const state = JSON.parse(
    await fs.readFile(path.join(tempDir, ".ai-novel", "state.json"), "utf8"),
  )
  assert.notEqual(state.plan.chapterTasks[0].status, "pending")
  assert.equal(state.plan.pendingChapters, state.plan.totalChapters - 1)
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
