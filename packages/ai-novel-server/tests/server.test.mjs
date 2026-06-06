import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"

const packageRoot = path.resolve(process.cwd())
const serverEntry = path.join(packageRoot, "dist", "index.js")
const workerEntry = path.join(packageRoot, "dist", "worker.js")
const desktopStaticDir = path.resolve(packageRoot, "..", "..", "apps", "desktop")
const desktopPackageJson = path.resolve(packageRoot, "..", "..", "apps", "desktop", "package.json")

async function waitForServer(port, child) {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`)
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/projects`)
      if (response.ok) return
    } catch {
      // Retry until the process starts listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("Timed out waiting for standalone server.")
}

test("standalone server exposes api and can serve the web client", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-standalone-server-"))
  const port = 47831
  const child = spawn(process.execPath, [
    "--no-warnings",
    serverEntry,
    "--root-dir",
    tempDir,
    "--static-dir",
    desktopStaticDir,
    "--port",
    String(port),
  ], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  })

  let stderr = ""
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk)
  })

  try {
    await waitForServer(port, child)

    const apiResponse = await fetch(`http://127.0.0.1:${port}/api/projects`)
    assert.equal(apiResponse.status, 200)
    const payload = await apiResponse.json()
    assert.deepEqual(payload.projects, [])

    const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`)
    assert.equal(healthResponse.status, 200)
    const healthPayload = await healthResponse.json()
    assert.equal(healthPayload.ok, true)
    assert.equal(healthPayload.service, "ai-novel-server")

    const readyResponse = await fetch(`http://127.0.0.1:${port}/api/ready`)
    assert.equal(readyResponse.status, 200)
    const readyPayload = await readyResponse.json()
    assert.equal(readyPayload.ok, true)
    assert.equal(readyPayload.factory.jobs.active, 0)

    const htmlResponse = await fetch(`http://127.0.0.1:${port}/`)
    assert.equal(htmlResponse.status, 200)
    assert.match(await htmlResponse.text(), /AI Novel Factory/)
  } finally {
    child.kill("SIGTERM")
    await new Promise((resolve) => child.once("exit", resolve))
  }

  assert.equal(stderr, "")
})

test("standalone package exposes a separate autopilot worker entrypoint", async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"))

  assert.equal(packageJson.bin["ai-novel-worker"], "dist/worker.js")
  assert.match(await fs.readFile(workerEntry, "utf8"), /runNovelAutopilotWorkerCli/)
})

test("desktop dev server starts with an embedded worker for local unattended runs", async () => {
  const packageJson = JSON.parse(await fs.readFile(desktopPackageJson, "utf8"))

  assert.match(packageJson.scripts.dev, /--embedded-worker/)
})

test("standalone api returns persisted transcript, consensus, and context packet", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-standalone-continuity-"))
  const port = 47832
  const child = spawn(process.execPath, [
    "--no-warnings",
    serverEntry,
    "--root-dir",
    tempDir,
    "--static-dir",
    desktopStaticDir,
    "--port",
    String(port),
  ], {
    cwd: packageRoot,
    env: { ...process.env, AI_NOVEL_TEST_MODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let stderr = ""
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk)
  })

  try {
    await waitForServer(port, child)

    const createResponse = await fetch(`http://127.0.0.1:${port}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Continuity Demo",
        idea: "A clerk climbs from the lowest office into imperial collapse",
        chapters: 8,
        chapterWords: 2500,
      }),
    })
    assert.equal(createResponse.status, 201)
    const createPayload = await createResponse.json()

    const reindexResponse = await fetch(`http://127.0.0.1:${port}/api/knowledge/reindex`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: createPayload.projectId,
        scope: "global",
        limit: 2,
      }),
    })
    assert.equal(reindexResponse.status, 202)
    const reindexPayload = await reindexResponse.json()
    assert.equal(reindexPayload.activeProjectId, createPayload.projectId)
    assert.ok(reindexPayload.queuedKnowledgeJobs.some((job) => job.kind === "knowledge_global_reindex"))
    assert.ok(reindexPayload.factorySnapshot.latestEvents.some((event) => event.type === "KNOWLEDGE_REINDEX_QUEUED"))

    const searchResponse = await fetch(`http://127.0.0.1:${port}/api/knowledge/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: createPayload.projectId,
        query: "writing resource",
        scopes: ["global"],
        limit: 2,
      }),
    })
    assert.equal(searchResponse.status, 200)
    const searchPayload = await searchResponse.json()
    assert.equal(searchPayload.activeProjectId, createPayload.projectId)
    assert.equal(searchPayload.knowledgeSearch.query, "writing resource")
    assert.equal(searchPayload.knowledgeSearch.filters.scopes[0], "global")
    assert.ok(Array.isArray(searchPayload.knowledgeSearch.rows))
    assert.ok(searchPayload.factorySnapshot.recentMessages.some((message) =>
      message.type === "tool"
      && message.data.toolName === "knowledge-search",
    ))

    const evaluateResponse = await fetch(`http://127.0.0.1:${port}/api/knowledge/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: createPayload.projectId,
        cases: [{
          name: "global resource smoke",
          query: "writing resource",
          expectedChunkIds: ["missing-smoke-id"],
          scopes: ["global"],
          k: 2,
        }],
      }),
    })
    assert.equal(evaluateResponse.status, 200)
    const evaluatePayload = await evaluateResponse.json()
    assert.equal(evaluatePayload.activeProjectId, createPayload.projectId)
    assert.equal(evaluatePayload.knowledgeEvaluation.summary.totalCases, 1)
    assert.ok(evaluatePayload.factorySnapshot.latestEvents.some((event) => event.type === "KNOWLEDGE_EVALUATION_COMPLETED"))

    const lightweightStatusResponse = await fetch(`http://127.0.0.1:${port}/api/status?projectId=${createPayload.projectId}`)
    assert.equal(lightweightStatusResponse.status, 200)
    const lightweightStatusPayload = await lightweightStatusResponse.json()
    assert.equal(Object.prototype.hasOwnProperty.call(lightweightStatusPayload, "transcript"), false)

    const messagesResponse = await fetch(`http://127.0.0.1:${port}/api/messages?projectId=${createPayload.projectId}&limit=8`)
    assert.equal(messagesResponse.status, 200)
    const messagesPayload = await messagesResponse.json()
    assert.equal(messagesPayload.messages.length <= 8, true)
    assert.equal(messagesPayload.meta.source, "messages")
    assert.ok(!messagesPayload.messages.some((message) => message.type === "user" && /直接接管创作流程/.test(message.data.content)))
    assert.ok(messagesPayload.messages.some((message) => message.type === "status" && /开始创作/.test(`${message.data.title}\n${message.data.content}`)))
    assert.ok(messagesPayload.entries.some((entry) => entry.messageId && entry.type === "status" && /项目已创建/.test(entry.content)))
    assert.equal(messagesPayload.pagination.offset, 0)
    assert.equal(messagesPayload.pagination.returned, messagesPayload.messages.length)
    assert.equal(messagesPayload.pagination.totalMessages >= messagesPayload.messages.length, true)

    const secondMessagesResponse = await fetch(`http://127.0.0.1:${port}/api/messages?projectId=${createPayload.projectId}&limit=1&offset=1`)
    assert.equal(secondMessagesResponse.status, 200)
    const secondMessagesPayload = await secondMessagesResponse.json()
    assert.equal(secondMessagesPayload.messages.length, 1)
    assert.equal(secondMessagesPayload.pagination.limit, 1)
    assert.equal(secondMessagesPayload.pagination.offset, 1)
    assert.equal(secondMessagesPayload.pagination.nextOffset, secondMessagesPayload.pagination.hasMore ? 2 : null)

    const transcriptResponse = await fetch(`http://127.0.0.1:${port}/api/transcript?projectId=${createPayload.projectId}&limit=8`)
    assert.equal(transcriptResponse.status, 200)
    const transcriptPayload = await transcriptResponse.json()
    assert.equal(transcriptPayload.entries.length <= 8, true)
    assert.ok(transcriptPayload.meta.totalEntries >= transcriptPayload.entries.length)
    assert.ok(transcriptPayload.entries.some((entry) => entry.type === "status" && /项目已创建/.test(entry.content)))

    const statusResponse = await fetch(`http://127.0.0.1:${port}/api/status?projectId=${createPayload.projectId}&includeTranscript=1`)
    assert.equal(statusResponse.status, 200)
    const statusPayload = await statusResponse.json()

    assert.equal(statusPayload.transcript, "")
    assert.match(statusPayload.consensus, /No consensus has been recorded yet|Global Consensus/i)
    assert.match(statusPayload.contextPacket, /Current Context Packet/)
    assert.equal(statusPayload.factorySnapshot.project.id, createPayload.projectId)
    assert.ok(statusPayload.factorySnapshot.latestEvents.some((event) => event.type === "PROJECT_CREATED"))
    assert.ok(!statusPayload.factorySnapshot.recentMessages.some((message) => message.type === "user" && /直接接管创作流程/.test(message.data.content)))
    assert.ok(statusPayload.factorySnapshot.recentMessages.some((message) => message.type === "status" && /开始创作/.test(`${message.data.title}\n${message.data.content}`)))
    assert.ok(statusPayload.factorySnapshot.graphNodes.some((node) => node.id === "mission:original"))
    assert.ok(statusPayload.graphIndex.counts.nodes >= statusPayload.factorySnapshot.graphNodes.length)
  } finally {
    child.kill("SIGTERM")
    await new Promise((resolve) => child.once("exit", resolve))
  }

  assert.equal(stderr, "")
})

test("standalone api exposes durable autopilot jobs and worker restores them", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-standalone-autopilot-restore-"))
  const firstPort = 47833
  const secondPort = 47834
  const env = { ...process.env, AI_NOVEL_TEST_MODE: "1" }

  const firstChild = spawn(process.execPath, [
    "--no-warnings",
    serverEntry,
    "--root-dir",
    tempDir,
    "--static-dir",
    desktopStaticDir,
    "--port",
    String(firstPort),
  ], {
    cwd: packageRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  let firstStderr = ""
  firstChild.stderr.on("data", (chunk) => {
    firstStderr += String(chunk)
  })

  let projectId = ""
  try {
    await waitForServer(firstPort, firstChild)

    const createResponse = await fetch(`http://127.0.0.1:${firstPort}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Restore Demo",
        idea: "A night auditor restores lost kingdoms from receipts",
        chapters: 6,
        chapterWords: 2500,
      }),
    })
    assert.equal(createResponse.status, 201)
    const createPayload = await createResponse.json()
    projectId = createPayload.projectId

    const startResponse = await fetch(`http://127.0.0.1:${firstPort}/api/autopilot/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        message: "继续无人值守推进",
      }),
    })
    assert.equal(startResponse.status, 200)
    const startPayload = await startResponse.json()
    assert.equal(startPayload.factorySnapshot.activeJobs.length, 1)
    assert.equal(startPayload.factorySnapshot.runnableJobs.length, 1)
  } finally {
    firstChild.kill("SIGTERM")
    await new Promise((resolve) => firstChild.once("exit", resolve))
  }

  assert.equal(firstStderr, "")

  const secondChild = spawn(process.execPath, [
    "--no-warnings",
    serverEntry,
    "--root-dir",
    tempDir,
    "--static-dir",
    desktopStaticDir,
    "--port",
    String(secondPort),
  ], {
    cwd: packageRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  let secondStderr = ""
  secondChild.stderr.on("data", (chunk) => {
    secondStderr += String(chunk)
  })

  try {
    await waitForServer(secondPort, secondChild)

    const statusResponse = await fetch(`http://127.0.0.1:${secondPort}/api/status?projectId=${projectId}`)
    assert.equal(statusResponse.status, 200)
    const statusPayload = await statusResponse.json()

    assert.equal(statusPayload.factorySnapshot.project.id, projectId)
    assert.equal(statusPayload.factorySnapshot.activeJobs.length, 1)
    assert.equal(statusPayload.factorySnapshot.runnableJobs.length, 1)
    assert.equal(statusPayload.factorySnapshot.latestEvents.some((event) => event.type === "JOB_RESTORE_READY"), false)

    const workerChild = spawn(process.execPath, [
      "--no-warnings",
      workerEntry,
      "--root-dir",
      tempDir,
    ], {
      cwd: packageRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let workerStderr = ""
    workerChild.stderr.on("data", (chunk) => {
      workerStderr += String(chunk)
    })
    const workerExitCode = await new Promise((resolve) => workerChild.once("exit", resolve))
    assert.equal(workerExitCode, 0)
    assert.equal(workerStderr, "")

    const restoredResponse = await fetch(`http://127.0.0.1:${secondPort}/api/status?projectId=${projectId}`)
    assert.equal(restoredResponse.status, 200)
    const restoredPayload = await restoredResponse.json()
    assert.ok(restoredPayload.factorySnapshot.latestEvents.some((event) => event.type === "JOB_RESTORE_READY"))
  } finally {
    secondChild.kill("SIGTERM")
    await new Promise((resolve) => secondChild.once("exit", resolve))
  }

  assert.equal(secondStderr, "")
})
