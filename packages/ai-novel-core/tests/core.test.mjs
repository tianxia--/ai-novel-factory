import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import http from "node:http"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const packageRoot = path.resolve(process.cwd())
const coreEntry = path.join(packageRoot, "dist", "index.js")
const autopilotWorkerSource = path.join(packageRoot, "src", "autopilot-worker.ts")

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

test("core initializes a stateful project with a super graph", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-"))
  const { initAutonomousProject, loadSuperGraph, validateSuperGraph } = await loadCore()

  const state = await initAutonomousProject({
    rootDir: tempDir,
    idea: "A village clerk records the fall of an empire",
    totalChapters: 8,
    chapterWordTarget: 2500,
  })

  assert.equal(state.runtime.stage, "worldbuilding_dialogue")
  assert.equal(state.plan.chapterTasks.length, 8)
  assert.ok(state.plan.chapterTasks.every((task) => task.causalPlan))
  assert.match(state.plan.chapterTasks[1].summary, /承接/)
  assert.match(state.plan.chapterTasks[1].summary, /选择/)
  assert.match(state.plan.chapterTasks[1].summary, /代价/)
  assert.doesNotMatch(state.plan.chapterTasks[1].summary, /Draft chapter/)

  const graph = await loadSuperGraph(tempDir)
  assert.ok(graph.nodes.some((node) => node.id === "mission:original"))
  const chapterNode = graph.nodes.find((node) => node.id === "chapter:002")
  assert.ok(chapterNode?.properties?.causalPlan)
  assert.match(String(chapterNode.properties.summary || ""), /交棒/)
  assert.equal(validateSuperGraph(graph).filter((issue) => issue.severity === "error").length, 0)
})

test("managed project roots resolve to the server workspace even for legacy relative records", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-managed-root-"))
  const { initAutonomousProject, resolveManagedProjectRoot } = await loadCore()
  const projectId = "legacy-root"
  const projectRoot = path.join(tempDir, ".ai-novel-projects", projectId)

  await initAutonomousProject({
    rootDir: projectRoot,
    idea: "A court clerk survives a collapsing dynasty",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })
  await fs.writeFile(
    path.join(tempDir, ".ai-novel-projects", "projects.json"),
    `${JSON.stringify([
      {
        id: projectId,
        slug: projectId,
        title: "Legacy Root",
        idea: "A court clerk survives a collapsing dynasty",
        createdAt: new Date().toISOString(),
        totalChapters: 6,
        chapterWordTarget: 2500,
        projectRoot: "../../.ai-novel-projects/legacy-root",
      },
    ], null, 2)}\n`,
  )

  assert.equal(await resolveManagedProjectRoot(tempDir, projectId), projectRoot)
})

test("discussions append across turns and persist a current context packet", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-continuity-"))
  const { initAutonomousProject, runMultiAgentDiscussion } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    await initAutonomousProject({
      rootDir: tempDir,
      idea: "A minor official witnesses the end of Tang",
      totalChapters: 8,
      chapterWordTarget: 2500,
    })

    const first = await runMultiAgentDiscussion(tempDir, "先讨论主角出身和底层视角")
    const second = await runMultiAgentDiscussion(tempDir, "延续上一轮，补充权力上升路径")

    const transcript = await fs.readFile(path.join(tempDir, ".ai-novel", "chat", "discussion-log.md"), "utf8")
    assert.match(transcript, /先讨论主角出身/)
    assert.match(transcript, /延续上一轮/)
    assert.ok(transcript.match(/^## /gm)?.length >= 2)
    assert.equal(first.transcriptPath, second.transcriptPath)

    const contextPacket = await fs.readFile(path.join(tempDir, ".ai-novel", "context", "current-context.md"), "utf8")
    assert.match(contextPacket, /Current Context Packet/)
    assert.match(contextPacket, /Recent transcript carryover/)
    assert.match(contextPacket, /先讨论主角出身/)

    assert.match(first.consensusArchivePath, /\.ai-novel\/consensus\/discussion-/)
    const firstArchive = await fs.readFile(first.consensusArchivePath, "utf8")
    assert.match(firstArchive, /Discussion Consensus Archive/)
    assert.match(firstArchive, /Showrunner Final Consensus/)
    assert.match(firstArchive, /Agent Discussion Outputs/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("factory database records projects, runs, turns, artifacts, and events", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-factory-db-"))
  const { createManagedAutonomousProject, runMultiAgentDiscussion, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A dock scribe tracks a collapsing empire",
      totalChapters: 8,
      chapterWordTarget: 2500,
    })
    await runMultiAgentDiscussion(created.project.projectRoot, "继续收敛主角和世界规则", {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(snapshot.project.id, created.project.id)
    assert.equal(snapshot.latestRuns.length, 1)
    assert.equal(snapshot.latestRuns[0].status, "completed")
    assert.ok(snapshot.latestEvents.some((event) => event.type === "AGENT_TURN_UPDATED"))
    assert.ok(snapshot.artifacts.some((artifact) => artifact.kind === "transcript"))
    assert.ok(snapshot.artifacts.some((artifact) => artifact.kind === "consensus"))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes(".ai-novel/consensus/discussion-")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes(".ai-novel/chat/discussion-log.md")))
    const discussionMessages = await withFactoryDb(tempDir, async (db) => db.listMessages(created.project.id, { limit: 20 }))
    const agentMessage = discussionMessages.find((message) => message.type === "agent" && message.metadata?.source === "discussion_agent_turn")
    assert.ok(agentMessage)
    assert.ok(agentMessage.parts.some((part) => part.type === "markdown" && part.data.text === agentMessage.data.content))
    assert.ok(agentMessage.parts.some((part) =>
      part.type === "json"
      && part.data.source === "discussion_agent_turn"
      && part.data.currentStage === "worldbuilding_dialogue"
    ))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("factory database persists extensible message records and parts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-messages-"))
  const { createAgentMessage, createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A city cartographer maps forbidden memories",
    title: "Message City",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const message = createAgentMessage({
    messageId: "msg-author-1",
    conversationId: "conversation-1",
    projectId: created.project.id,
    runId: "run-1",
    turnId: "turn-1",
    agentType: "author",
    agentLabel: "Author",
    content: "正文片段",
    status: "completed",
    time: "2026-06-04T10:00:00.123Z",
    metadata: { chapterNumber: 1 },
  })

  const rows = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage(message, [
      {
        id: "msg-author-1:part:0",
        messageId: "msg-author-1",
        index: 0,
        type: "markdown",
        data: { text: "正文片段" },
        createdAt: "2026-06-04T10:00:00.123Z",
      },
      {
        id: "msg-author-1:part:1",
        messageId: "msg-author-1",
        index: 1,
        type: "image",
        data: { path: ".ai-novel/assets/scene.png", mimeType: "image/png" },
        createdAt: "2026-06-04T10:00:00.124Z",
      },
    ])
    return db.listMessages(created.project.id)
  })

  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, "msg-author-1")
  assert.equal(rows[0].type, "agent")
  assert.equal(rows[0].status, "completed")
  assert.equal(rows[0].data.agentType, "author")
  assert.equal(rows[0].data.content, "正文片段")
  assert.equal(rows[0].parts.length, 2)
  assert.equal(rows[0].parts[1].type, "image")
  assert.equal(rows[0].parts[1].data.path, ".ai-novel/assets/scene.png")

  const updatedRows = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage({
      ...message,
      status: "streaming",
      data: { ...message.data, content: "流式片段" },
      updatedAt: "2026-06-04T10:00:01.000Z",
      completedAt: null,
    })
    db.recordMessage({
      ...message,
      status: "completed",
      data: { ...message.data, content: "最终正文片段" },
      updatedAt: "2026-06-04T10:00:02.000Z",
      completedAt: "2026-06-04T10:00:02.000Z",
    })
    return db.listMessages(created.project.id)
  })

  assert.equal(updatedRows.length, 1)
  assert.equal(updatedRows[0].id, "msg-author-1")
  assert.equal(updatedRows[0].status, "completed")
  assert.equal(updatedRows[0].data.content, "最终正文片段")
  assert.equal(updatedRows[0].time, "2026-06-04T10:00:00.123Z")
  assert.equal(updatedRows[0].created_at, "2026-06-04T10:00:00.123Z")
  assert.equal(updatedRows[0].updated_at, "2026-06-04T10:00:02.000Z")
})

test("message factories create durable tool artifact and image messages", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-message-factories-"))
  const {
    createArtifactMessage,
    createImageMessage,
    createManagedAutonomousProject,
    createToolMessage,
    withFactoryDb,
  } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "An archivist assembles a machine for lost seasons",
    title: "Factory Messages",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const toolMessage = createToolMessage({
    messageId: "msg-tool-1",
    conversationId: "conversation-typed",
    projectId: created.project.id,
    runId: "run-typed",
    toolName: "provider-test",
    input: { model: "test-model" },
    output: { ok: true },
    content: "模型连通性检查完成。",
    time: "2026-06-04T10:00:00.000Z",
  })
  const artifactMessage = createArtifactMessage({
    messageId: "msg-artifact-1",
    conversationId: "conversation-typed",
    projectId: created.project.id,
    runId: "run-typed",
    artifactId: "artifact-1",
    label: "第 1 章成稿",
    artifactPath: ".ai-novel/chapters/chapter-001.final.md",
    content: "正文完成。",
    time: "2026-06-04T10:00:01.000Z",
  })
  const imageMessage = createImageMessage({
    messageId: "msg-image-1",
    conversationId: "conversation-typed",
    projectId: created.project.id,
    runId: "run-typed",
    assetId: "cover-1",
    path: ".ai-novel/assets/cover.png",
    alt: "封面草图",
    caption: "第一版封面",
    time: "2026-06-04T10:00:02.000Z",
  })

  const rows = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage(toolMessage)
    db.recordMessage(artifactMessage)
    db.recordMessage(imageMessage)
    return db.listMessages(created.project.id, { conversationId: "conversation-typed", limit: 10 })
  })

  const rowById = new Map(rows.map((row) => [row.id, row]))

  assert.deepEqual(new Set(rows.map((row) => row.type)), new Set(["tool", "artifact", "image"]))
  assert.equal(rowById.get("msg-tool-1").data.toolName, "provider-test")
  assert.equal(rowById.get("msg-tool-1").data.output.ok, true)
  assert.equal(rowById.get("msg-artifact-1").data.artifactPath, ".ai-novel/chapters/chapter-001.final.md")
  assert.equal(rowById.get("msg-artifact-1").data.label, "第 1 章成稿")
  assert.equal(rowById.get("msg-image-1").data.mimeType, "image/png")
  assert.equal(rowById.get("msg-image-1").data.path, ".ai-novel/assets/cover.png")
})

test("factory database lists messages with pagination and conversation filtering", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-message-pagination-"))
  const { createManagedAutonomousProject, withFactoryDb, createAgentMessage } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clockmaker archives impossible days",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const makeMessage = (index, conversationId = "conversation-a") => createAgentMessage({
    messageId: `msg-page-${index}`,
    conversationId,
    projectId: created.project.id,
    agentType: "showrunner",
    agentLabel: "Showrunner",
    content: `message ${index}`,
    status: "completed",
    time: `2026-06-04T10:00:0${index}.000Z`,
  })

  const result = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage(makeMessage(1))
    db.recordMessage(makeMessage(2))
    db.recordMessage(makeMessage(3, "conversation-b"))
    db.recordMessage(makeMessage(4))
    return {
      total: db.countMessages(created.project.id),
      conversationTotal: db.countMessages(created.project.id, { conversationId: "conversation-a" }),
      firstPage: db.listMessages(created.project.id, { limit: 2 }),
      secondPage: db.listMessages(created.project.id, { limit: 2, offset: 2 }),
      conversationPage: db.listMessages(created.project.id, { conversationId: "conversation-a", limit: 10 }),
    }
  })

  assert.equal(result.total, 4)
  assert.equal(result.conversationTotal, 3)
  assert.deepEqual(result.firstPage.map((row) => row.id), ["msg-page-4", "msg-page-3"])
  assert.deepEqual(result.secondPage.map((row) => row.id), ["msg-page-2", "msg-page-1"])
  assert.deepEqual(result.conversationPage.map((row) => row.id), ["msg-page-4", "msg-page-2", "msg-page-1"])
})

test("factory database can mark interrupted streaming messages as failed", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-message-interrupt-"))
  const { createManagedAutonomousProject, withFactoryDb, createAgentMessage } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk survives an interrupted draft",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  const makeMessage = (chapterNumber) => createAgentMessage({
    messageId: `writing-${chapterNumber}-draft`,
    conversationId: `writing:${created.project.id}`,
    projectId: created.project.id,
    agentLabel: "Author",
    status: "streaming",
    content: `Author is drafting chapter ${chapterNumber}.`,
    metadata: { chapterNumber },
  })

  const changed = await withFactoryDb(tempDir, async (db) => {
    db.recordMessage(makeMessage(1), [
      {
        id: "writing-1-draft:part:0",
        messageId: "writing-1-draft",
        index: 0,
        type: "markdown",
        data: {
          text: [
            "### 第 1 章 · draft_generation",
            "Author 正在生成正文。模型正在持续输出。",
            "",
            "状态：LLM 正在持续返回内容。",
            "",
            "返回内容会持续合并到这一条 agent 消息中。",
          ].join("\n"),
        },
        createdAt: "2026-06-04T10:00:00.123Z",
      },
    ])
    db.recordMessage(makeMessage(2))
    return db.markStreamingMessagesFailed(created.project.id, {
      conversationId: `writing:${created.project.id}`,
      chapterNumber: 1,
      reason: "worker aborted",
    })
  })

  assert.equal(changed, 1)

  const rows = await withFactoryDb(tempDir, async (db) =>
    db.listMessages(created.project.id, { conversationId: `writing:${created.project.id}`, limit: 10 }),
  )
  const rowById = new Map(rows.map((row) => [row.id, row]))
  assert.equal(rowById.get("writing-1-draft").status, "failed")
  assert.equal(rowById.get("writing-1-draft").data.statusText, "无人值守任务被中断，等待恢复后重新执行。")
  const failedMarkdown = rowById.get("writing-1-draft").parts.find((part) => part.type === "markdown")?.data?.text || ""
  assert.doesNotMatch(String(failedMarkdown), /LLM 正在持续返回内容|返回内容会持续合并/)
  assert.equal(rowById.get("writing-2-draft").status, "streaming")
})

test("factory snapshot compacts heavy event and memory payloads for UI polling", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-compact-snapshot-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A courier remembers too many futures",
    totalChapters: 1,
    chapterWordTarget: 2500,
  })
  await withFactoryDb(tempDir, async (db) => {
    const longText = "重".repeat(5000)
    db.recordEvent(created.project.id, null, "HEAVY_EVENT", {
      content: longText,
      embedding: Array.from({ length: 256 }, (_, index) => index),
    })
    db.recordMemory(created.project.id, {
      source: ".ai-novel/memory/heavy.md",
      kind: "chapter_summary",
      content: longText,
      importance: 8,
      metadata: { note: longText },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const heavyEvent = snapshot.latestEvents.find((event) => event.type === "HEAVY_EVENT")
  const heavyMemory = snapshot.recentMemory.find((memory) => memory.source === ".ai-novel/memory/heavy.md")

  assert.ok(String(heavyEvent.payload_json).length < 1700)
  assert.ok(String(heavyMemory.content).length < 950)
  assert.ok(String(heavyMemory.metadata_json).length < 1700)
})

test("factory snapshot keeps pinned artifacts even when many recent chapter files exist", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-pinned-artifacts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk protects a city by editing its myths",
    totalChapters: 120,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    for (let index = 1; index <= 120; index += 1) {
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: `.ai-novel/chapters/chapter-${String(index).padStart(3, "0")}.final.md`,
        status: "completed",
      })
    }
    db.recordArtifact({
      projectId: created.project.id,
      kind: "checkpoint",
      path: ".ai-novel/knowledge/evaluation-latest.md",
      status: "completed",
      metadata: { source: "knowledge-evaluate" },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const artifactPaths = snapshot.artifacts.map((artifact) => artifact.path)

  assert.ok(artifactPaths.includes(".ai-novel/prompts/global-consensus.md"))
  assert.ok(artifactPaths.includes(".ai-novel/context/current-context.md"))
  assert.ok(artifactPaths.includes(".ai-novel/knowledge/evaluation-latest.md"))
  assert.ok(artifactPaths.includes(".ai-novel/chapters/chapter-120.final.md"))
})

test("managed projects sync super graph rows into the factory database snapshot", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-factory-graph-"))
  const { createManagedAutonomousProject, withFactoryDb, superGraphFromDbRows, validateSuperGraph } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A railway clerk maps a haunted republic",
    totalChapters: 7,
    chapterWordTarget: 2500,
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.graphNodes.some((node) => node.id === "mission:original"))
  assert.ok(snapshot.graphEdges.some((edge) => edge.type === "HAS_MISSION"))

  const graph = superGraphFromDbRows(created.project.id, snapshot.graphNodes, snapshot.graphEdges)
  assert.equal(validateSuperGraph(graph).filter((issue) => issue.severity === "error").length, 0)
})

test("factory database keeps super graph rows isolated per managed project", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-factory-graph-isolation-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const first = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A registrar catalogs vanished islands",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })
  const second = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A surveyor maps impossible winter roads",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  const firstSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(first.project.id))
  const secondSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(second.project.id))
  const firstMission = firstSnapshot.graphNodes.find((node) => node.id === "mission:original")
  const secondMission = secondSnapshot.graphNodes.find((node) => node.id === "mission:original")

  assert.equal(firstMission.project_id, first.project.id)
  assert.equal(secondMission.project_id, second.project.id)
  assert.notEqual(firstMission.metadata_json, secondMission.metadata_json)
})

test("factory memory recall supports keyword and embedding-backed retrieval", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-memory-rag-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A librarian keeps illegal memories for a city",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  const memoryId = await withFactoryDb(tempDir, async (db) =>
    db.recordMemory(created.project.id, {
      source: "test",
      kind: "worldbuilding",
      content: "The forbidden archive stores rain-scented memories under glass streets.",
      importance: 4,
      embedding: { model: "test-embedding", vector: [1, 0, 0] },
    }),
  )

  const keywordRecall = await withFactoryDb(tempDir, async (db) =>
    db.recallMemory(created.project.id, "archive memories", 3),
  )
  assert.equal(keywordRecall[0].id, memoryId)
  assert.equal(keywordRecall[0].embedding_status, "ready")

  const vectorRecall = await withFactoryDb(tempDir, async (db) =>
    db.recallMemory(created.project.id, "", 3, { embedding: [1, 0, 0] }),
  )
  assert.equal(vectorRecall[0].id, memoryId)
  assert.equal(vectorRecall[0].model, "test-embedding")
})

test("factory memory updates production resource rows instead of duplicating by path", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-memory-upsert-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A record keeper measures a dying empire",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordMemory(created.project.id, {
      source: "production-writing-resources",
      kind: "style_rulebook",
      content: "first",
      metadata: { path: ".ai-novel/style/production-resources/production-writing-assets.md" },
    })
    db.recordMemory(created.project.id, {
      source: "production-writing-resources",
      kind: "style_rulebook",
      content: "second",
      metadata: { path: ".ai-novel/style/production-resources/production-writing-assets.md" },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const rows = snapshot.recentMemory.filter((row) => row.source === "production-writing-resources")
  assert.equal(rows.length, 1)
  assert.equal(rows[0].content, "second")
})

test("pending memory embeddings can be backfilled and recalled by vector", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-memory-backfill-"))
  const { createManagedAutonomousProject, withFactoryDb, backfillPendingMemoryEmbeddings, createLocalTextEmbedding } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A tax archivist learns the empire is a dream",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  const memoryId = await withFactoryDb(tempDir, async (db) =>
    db.recordMemory(created.project.id, {
      source: "seed",
      kind: "canon",
      content: "The imperial tax ledger is actually a dream index.",
      importance: 5,
    }),
  )

  const count = await backfillPendingMemoryEmbeddings(tempDir, { projectId: created.project.id })
  assert.equal(count, 1)

  const recalled = await withFactoryDb(tempDir, async (db) =>
    db.recallMemory(created.project.id, "", 3, {
      embedding: createLocalTextEmbedding("dream ledger index"),
    }),
  )
  assert.equal(recalled[0].id, memoryId)
  assert.equal(recalled[0].embedding_status, "ready")
})

test("discussion context packet includes recalled memory from the factory database", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-discussion-rag-"))
  const { createManagedAutonomousProject, runMultiAgentDiscussion, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A courier delivers prophecies that expire at dawn",
      totalChapters: 6,
      chapterWordTarget: 2500,
    })
    await withFactoryDb(tempDir, async (db) =>
      db.recordMemory(created.project.id, {
        source: "seed",
        kind: "worldbuilding",
        content: "Dawn prophecies must be delivered before the city bells ring.",
        importance: 5,
      }),
    )

    await runMultiAgentDiscussion(created.project.projectRoot, "继续讨论 dawn prophecies 的世界规则", {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    const contextPacket = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "context", "current-context.md"), "utf8")
    assert.match(contextPacket, /Memory\/RAG recall/)
    assert.match(contextPacket, /Dawn prophecies must be delivered/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("knowledge RAG indexes global resources and project artifacts without cross-project leakage", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-knowledge-rag-"))
  const {
    createManagedAutonomousProject,
    ingestKnowledgeSource,
    ingestProjectArtifact,
    retrieveKnowledge,
    evaluateKnowledgeRetrieval,
    evaluateKnowledgeBenchmark,
    withFactoryDb,
  } = await loadCore()

  const first = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk survives court politics through forbidden ledgers",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  const second = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A sailor maps winter islands",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  await ingestKnowledgeSource({
    rootDir: tempDir,
    scope: "global",
    sourceType: "vocabulary",
    path: "global/vocabulary/court.md",
    title: "Court vocabulary",
    content: [
      "# 朝堂词汇",
      "",
      "## 宸命",
      "释义：皇帝的委命。适合朝堂政争和诏令场景。",
    ].join("\n"),
  })

  const firstMemoryPath = path.join(first.project.projectRoot, ".ai-novel", "memory", "chapter-001-memory.md")
  await fs.mkdir(path.dirname(firstMemoryPath), { recursive: true })
  await fs.writeFile(firstMemoryPath, "铜牌伏笔只属于第一个项目，藏在户曹旧账夹层。\n")
  await ingestProjectArtifact({
    rootDir: tempDir,
    projectId: first.project.id,
    projectRoot: first.project.projectRoot,
    artifactPath: ".ai-novel/memory/chapter-001-memory.md",
    kind: "memory",
    metadata: { chapterNumber: 1 },
  })

  const globalRecall = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: second.project.id,
    query: "朝堂 宸命 诏令",
    scopes: ["global"],
    limit: 3,
  })
  assert.ok(globalRecall.some((row) => /宸命/.test(String(row.content))))
  const globalHit = globalRecall.find((row) => /宸命/.test(String(row.content)))

  const firstRecall = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: first.project.id,
    query: "铜牌 户曹 夹层",
    scopes: ["project"],
    limit: 3,
  })
  assert.ok(firstRecall.some((row) => /铜牌伏笔/.test(String(row.content))))
  const projectHit = firstRecall.find((row) => /铜牌伏笔/.test(String(row.content)))

  const leakedRecall = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: second.project.id,
    query: "铜牌 户曹 夹层",
    scopes: ["project"],
    limit: 3,
  })
  assert.equal(leakedRecall.some((row) => /铜牌伏笔/.test(String(row.content))), false)

  await withFactoryDb(tempDir, async (db) => {
    db.createJob({
      projectId: first.project.id,
      kind: "knowledge_project_artifact",
      status: "idle",
      payload: { artifactPath: ".ai-novel/context/current-context.md" },
    })
    db.createJob({
      projectId: first.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "not a knowledge job" },
    })
    db.recordEvent(first.project.id, null, "KNOWLEDGE_EVALUATION_COMPLETED", {
      summary: {
        totalCases: 1,
        hitRateAtK: 1,
        meanRecallAtK: 1,
        meanPrecisionAtK: 0.5,
      },
      cases: [{
        name: "snapshot evaluation",
        query: "铜牌 户曹",
        k: 3,
        hitAtK: 1,
        recallAtK: 1,
        precisionAtK: 0.5,
        matchedChunkIds: [String(projectHit?.id)],
        missedChunkIds: [],
      }],
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(first.project.id))
  assert.equal(snapshot.knowledge.summary.globalSources, 1)
  assert.equal(snapshot.knowledge.summary.projectSources, 1)
  assert.ok(snapshot.knowledge.summary.readyChunks >= 2)
  assert.ok(snapshot.knowledge.jobs.some((job) =>
    job.kind === "knowledge_project_artifact"
    && job.status === "idle"
    && job.payload?.artifactPath === ".ai-novel/context/current-context.md",
  ))
  assert.equal(snapshot.knowledge.jobs.some((job) => job.kind === "autopilot"), false)
  assert.equal(snapshot.knowledge.latestEvaluation?.payload?.summary?.totalCases, 1)
  assert.equal(snapshot.knowledge.latestEvaluation?.payload?.summary?.hitRateAtK, 1)

  const pointEvaluation = evaluateKnowledgeRetrieval(
    [{ id: "expected-a" }, { id: "noise-b" }, { id: "expected-c" }],
    ["expected-a", "expected-c", "missing-d"],
    2,
  )
  assert.equal(pointEvaluation.hitAtK, 1)
  assert.equal(pointEvaluation.recallAtK, 1 / 3)
  assert.equal(pointEvaluation.precisionAtK, 1 / 2)
  assert.deepEqual(pointEvaluation.missedChunkIds, ["expected-c", "missing-d"])

  assert.ok(globalHit?.id)
  assert.ok(projectHit?.id)
  const benchmark = await evaluateKnowledgeBenchmark(tempDir, [
    {
      name: "global court vocabulary",
      query: "朝堂 宸命 诏令",
      projectId: second.project.id,
      scopes: ["global"],
      expectedChunkIds: [String(globalHit.id)],
      k: 3,
    },
    {
      name: "project artifact memory",
      query: "铜牌 户曹 夹层",
      projectId: first.project.id,
      scopes: ["project"],
      expectedChunkIds: [String(projectHit.id)],
      k: 3,
    },
  ])
  assert.equal(benchmark.summary.totalCases, 2)
  assert.equal(benchmark.summary.hitRateAtK, 1)
  assert.equal(benchmark.summary.meanRecallAtK, 1)
})

test("knowledge jobs are durable and worker-indexed without blocking project creation", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-knowledge-worker-"))
  const { createManagedAutonomousProject, runNovelAutopilotWorkerOnce, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A tax clerk indexes a collapsing dynasty",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })

    const before = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(before.activeJobs.every((job) => job.kind !== "knowledge_global_bootstrap"))
    assert.ok(before.runnableJobs.every((job) => job.kind !== "knowledge_global_bootstrap"))
    assert.ok(before.knowledge.summary.readyChunks >= 0)

    await runNovelAutopilotWorkerOnce(tempDir)

    const after = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(after.knowledge.summary.globalSources > 0)
    assert.ok(after.knowledge.summary.projectSources > 0)
    assert.ok(after.knowledge.summary.readyChunks > 0)
    assert.ok(after.latestEvents.some((event) => event.type === "JOB_UPDATED" && /knowledge_/.test(String(event.payload_json))))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("knowledge bootstrap backfills legacy projects that have no knowledge index", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-knowledge-legacy-bootstrap-"))
  const { createManagedAutonomousProject, runNovelAutopilotWorkerOnce, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A ledger keeper survives late Tang collapse",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })

    await withFactoryDb(tempDir, async (db) => {
      for (const job of db.listProjectJobs(created.project.id)) {
        if (String(job.kind || "").startsWith("knowledge_")) {
          db.cancelJob(String(job.id))
        }
      }
    })

    const before = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(before.knowledge.summary.globalSources, 0)
    assert.equal(before.knowledge.summary.projectSources, 0)
    assert.ok(before.runnableJobs.every((job) => !String(job.kind || "").startsWith("knowledge_")))

    await runNovelAutopilotWorkerOnce(tempDir)

    const after = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(after.knowledge.summary.globalSources > 0)
    assert.ok(after.knowledge.summary.projectSources > 0)
    assert.ok(after.knowledge.summary.readyChunks > 0)
    assert.ok(after.latestEvents.some((event) => event.type === "KNOWLEDGE_BOOTSTRAP_QUEUED"))
    assert.ok(after.latestEvents.some((event) => event.type === "JOB_UPDATED" && /knowledge_/.test(String(event.payload_json))))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("discussion context packet includes writing knowledge across setup and style targets", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-discussion-knowledge-"))
  const { createManagedAutonomousProject, ingestKnowledgeSource, runMultiAgentDiscussion } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A minor official watches late Tang collapse",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })
    await ingestKnowledgeSource({
      rootDir: tempDir,
      scope: "global",
      sourceType: "vocabulary",
      path: "global/vocabulary/style.md",
      title: "Style vocabulary",
      content: [
        "# 文风词汇",
        "",
        "## 风声鹤唳",
        "释义：紧张疑惧的气氛，适合乱世市井和官府追捕场景。",
      ].join("\n"),
    })

    await runMultiAgentDiscussion(created.project.projectRoot, "讨论文风，乱世紧张感里如何自然使用成语", {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    const contextPacket = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "context", "current-context.md"), "utf8")
    assert.match(contextPacket, /Writing knowledge\/RAG recall/)
    assert.match(contextPacket, /风声鹤唳/)

    await ingestKnowledgeSource({
      rootDir: tempDir,
      scope: "global",
      sourceType: "example",
      path: "global/examples/worldbuilding.md",
      title: "Worldbuilding example",
      content: [
        "# 设定示例",
        "",
        "## 市井压迫感",
        "用坊门、差役、米价和夜禁细节承托乱世秩序，不要先写抽象历史评述。",
      ].join("\n"),
    })

    await runMultiAgentDiscussion(created.project.projectRoot, "继续确认大唐末期底层小人物的世界规则和市井压迫感", {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    const setupContextPacket = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "context", "current-context.md"), "utf8")
    assert.match(setupContextPacket, /Writing knowledge\/RAG recall/)
    assert.match(setupContextPacket, /市井压迫感/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("super graph updates prefer factory database rows over stale graph files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-graph-db-first-"))
  const { createManagedAutonomousProject, upsertDiscussionInSuperGraph, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A cartographer draws borders that become real",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })
  await fs.writeFile(
    path.join(created.project.projectRoot, ".ai-novel", "graph", "super-graph.json"),
    `${JSON.stringify({ schemaVersion: 1, projectId: "stale", generatedAt: new Date().toISOString(), nodes: [], edges: [] })}\n`,
  )

  await upsertDiscussionInSuperGraph(created.project.projectRoot, {
    target: { kind: "worldbuilding", label: "db first graph update", assetPath: ".ai-novel/prompts/global-consensus.md" },
    summary: "Graph update should survive stale file contents.",
    transcriptPath: ".ai-novel/chat/discussion-log.md",
  }, {
    factoryRootDir: tempDir,
    projectId: created.project.id,
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.graphNodes.some((node) => String(node.id).startsWith("discussion:")))
  assert.ok(snapshot.graphNodes.some((node) => node.id === "mission:original"))
})

test("factory database can claim, heartbeat, complete, fail, and re-claim durable jobs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-factory-jobs-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A ledger keeper audits immortal debts",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  const baseNow = new Date("2026-06-03T00:00:00.000Z")
  const jobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "continue", mode: "background" },
    }),
  )

  const claimed = await withFactoryDb(tempDir, async (db) => db.claimJob(jobId, "worker-a", 30, baseNow))
  assert.equal(claimed.id, jobId)
  assert.equal(claimed.lease_owner, "worker-a")
  assert.equal(claimed.payload.message, "continue")

  const blockedClaim = await withFactoryDb(tempDir, async (db) =>
    db.claimJob(jobId, "worker-b", 30, new Date("2026-06-03T00:00:10.000Z")),
  )
  assert.equal(blockedClaim, null)

  const heartbeat = await withFactoryDb(tempDir, async (db) =>
    db.heartbeatJob(jobId, "worker-a", 45, new Date("2026-06-03T00:00:20.000Z")),
  )
  assert.equal(heartbeat, "2026-06-03T00:01:05.000Z")

  const runnableBeforeExpiry = await withFactoryDb(tempDir, async (db) =>
    db.listRunnableJobs("autopilot", new Date("2026-06-03T00:00:45.000Z")),
  )
  assert.equal(runnableBeforeExpiry.length, 0)

  const runnableAfterExpiry = await withFactoryDb(tempDir, async (db) =>
    db.listRunnableJobs("autopilot", new Date("2026-06-03T00:01:06.000Z")),
  )
  assert.equal(runnableAfterExpiry.length, 1)
  assert.equal(runnableAfterExpiry[0].id, jobId)

  const reclaimed = await withFactoryDb(tempDir, async (db) =>
    db.claimJob(jobId, "worker-b", 30, new Date("2026-06-03T00:01:06.000Z")),
  )
  assert.equal(reclaimed.lease_owner, "worker-b")

  await withFactoryDb(tempDir, async (db) => db.completeJob(jobId, "worker-b"))
  const snapshotAfterComplete = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.equal(snapshotAfterComplete.activeJobs.length, 0)
  assert.ok(snapshotAfterComplete.latestEvents.some((event) => event.type === "JOB_UPDATED"))

  const failedJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "fail me" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(failedJobId, "simulated failure"))
  const runnableAfterFailure = await withFactoryDb(tempDir, async (db) => db.listRunnableJobs("autopilot"))
  assert.equal(runnableAfterFailure.some((job) => job.id === failedJobId), false)
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(failedJobId)), false)

  await withFactoryDb(tempDir, async (db) => db.resumeJob(failedJobId, { message: "continue after timeout" }))
  const runnableAfterResume = await withFactoryDb(tempDir, async (db) => db.listRunnableJobs("autopilot"))
  assert.equal(runnableAfterResume.some((job) => job.id === failedJobId), true)
  assert.equal(runnableAfterResume.find((job) => job.id === failedJobId).payload.message, "continue after timeout")

  const transientJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "retry me" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(transientJobId, "LLM request timed out after 1000ms without provider activity."))
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(transientJobId)), true)

  const rateLimitedJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "slow down" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(rateLimitedJobId, "LLM request failed with status 429."))
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(rateLimitedJobId)), true)

  const stoppedJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "stop me" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(stoppedJobId, "Autopilot stopped by user."))
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(stoppedJobId)), false)

  const abortedJobId = await withFactoryDb(tempDir, async (db) =>
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "abort me" },
    }),
  )
  await withFactoryDb(tempDir, async (db) => db.failJob(abortedJobId, "The operation was aborted."))
  assert.equal(await withFactoryDb(tempDir, async (db) => db.jobFailureLooksRecoverable(abortedJobId)), false)
})

test("factory operational status reports jobs, memory queues, and events", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-operational-status-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A keeper tracks every oath in a floating city",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordMemory(created.project.id, {
      source: "test",
      kind: "canon",
      content: "The floating city descends one bell tower per oath broken.",
    })
    db.createJob({
      projectId: created.project.id,
      kind: "autopilot",
      status: "running",
      payload: { message: "continue" },
    })
  })

  const status = await withFactoryDb(tempDir, async (db) => db.getOperationalStatus(new Date("2026-06-03T00:00:00.000Z")))
  assert.equal(status.ok, true)
  assert.equal(status.projects.total, 1)
  assert.equal(status.projects.running, 1)
  assert.equal(status.jobs.active, 1)
  assert.equal(status.jobs.runnable, 1)
  assert.equal(status.memory.pendingEmbeddings, 1)
  assert.ok(status.latestEvents.some((event) => event.type === "JOB_CREATED"))
})

test("factory operational status ignores stale project running flags without active jobs", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-operational-stale-running-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A watcher must not mistake stale state for a running worker",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  created.state.runtime.autopilot = {
    running: true,
    stopRequested: false,
    startedAt: "2026-06-03T00:00:00.000Z",
    updatedAt: "2026-06-03T00:00:00.000Z",
    lastStep: "network_retry",
    mode: "background",
    target: "continue",
    driftScore: 0,
    driftStatus: "ok",
    driftReason: null,
    checkpointPath: null,
    loopCount: 5,
  }
  await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, created.state))

  const status = await withFactoryDb(tempDir, async (db) => db.getOperationalStatus())
  assert.equal(status.projects.total, 1)
  assert.equal(status.projects.running, 0)
  assert.equal(status.jobs.active, 0)
})

test("factory operational status excludes events for pruned projects", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-operational-pruned-events-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "Deleted project events should not drive the live dashboard",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })
  await withFactoryDb(tempDir, async (db) => {
    db.recordEvent(created.project.id, null, "OLD_PROJECT_EVENT", { stale: true })
    db.deleteProject(created.project.id)
  })

  const status = await withFactoryDb(tempDir, async (db) => db.getOperationalStatus())
  assert.equal(status.projects.total, 0)
  assert.equal(status.latestEvents.some((event) => event.type === "OLD_PROJECT_EVENT"), false)
})

test("factory project state updates ignore volatile timestamp-only changes", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-state-dedupe-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A scribe should not refresh the whole UI for heartbeat-only state writes",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  const firstWrite = await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, created.state))
  const duplicateState = {
    ...created.state,
    runtime: {
      ...created.state.runtime,
      lastUpdatedAt: "2026-06-03T00:00:01.000Z",
      autopilot: created.state.runtime.autopilot
        ? {
          ...created.state.runtime.autopilot,
          updatedAt: "2026-06-03T00:00:01.000Z",
        }
        : created.state.runtime.autopilot,
    },
  }
  const duplicateWrite = await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, duplicateState))
  const changedState = {
    ...created.state,
    runtime: {
      ...created.state.runtime,
      statusMessage: "实际状态变化",
    },
  }
  const changedWrite = await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, changedState))
  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const stateUpdatedEvents = snapshot.latestEvents.filter((event) => event.type === "PROJECT_STATE_UPDATED")

  assert.equal(firstWrite, false)
  assert.equal(duplicateWrite, false)
  assert.equal(changedWrite, true)
  assert.equal(stateUpdatedEvents.length, 1)
})

test("factory snapshot separates final chapter files from quality-passed chapter completion", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-chapter-facts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk separates official records from failed drafts",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok", wordCount: 2800, targetWords: 2500 },
      },
    })
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-002.final.md",
      metadata: {
        chapterNumber: 2,
        pass: "final",
        qualityGate: { status: "blocked", score: 5, attempts: 2, reason: "needs rewrite", wordCount: 800, targetWords: 2500 },
      },
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "draft_generation_llm_started",
      role: "Author",
      chapterNumber: 3,
      status: "running",
      message: "Author is drafting chapter 3.",
    })
    db.recordArtifact({
      projectId: created.project.id,
      kind: "checkpoint",
      path: ".ai-novel/reports/chapter-004-quality.md",
      metadata: {
        chapterNumber: 4,
        quality: true,
        qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok", wordCount: 2600, targetWords: 2500 },
      },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.equal(snapshot.artifactSummary.finalChapterFiles, 2)
  assert.equal(snapshot.artifactSummary.finalChapters, 1)
  assert.equal(snapshot.artifactSummary.passedFinalChapters, 1)
  assert.equal(snapshot.artifactSummary.blockedFinalChapters, 1)
  assert.equal(snapshot.artifactSummary.quarantinedFinalChapters, 1)
  assert.equal(snapshot.artifactSummary.untrustedPassedGates, 0)
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).status, "complete")
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2).status, "blocked")
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 3).status, "in_progress")
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 4).status, "pending")
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 4).finalPath, undefined)
  assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 4).contentQuality.status, "eligible")
})

test("chapter consistency locks the first POV protagonist and rejects later protagonist drift", async () => {
  const { evaluateChapterConsistency, extractChinesePersonNames } = await loadCore()
  const chapterOne = [
    "# 第1章 终稿",
    "",
    "## Polish Pass",
    "",
    "- 宋管事指甲缝的泥黑强化压迫感。",
    "",
    "## Final Body",
    "",
    "李晦是被一巴掌扇醒的。",
    "他想抬手挡一下，胳膊却不听使唤。最后的记忆是凌晨两点在工位上改代码。",
    "宋管事把契书拍在他脸上，冷笑着催租。李晦咬住腮帮子，知道自己不能倒下。",
  ].join("\n")
  const chapterTwo = [
    "## Final Body",
    "",
    "陈默是被冷醒的。",
    "他睁开眼，看见的不是出租屋天花板，而是一片黑黢黢的梁木。",
    "老妇人递给他树皮饼，陈默终于确认自己不是在做梦。",
  ].join("\n")
  const chapterThree = [
    "## Final Body",
    "",
    "天还没有亮，李延就被一阵急促的拍门声惊醒。",
    "他不是这个世界的人。此刻的李延，是万年县户曹的贴书小吏。",
    "张主簿让他进门，李延立刻意识到田册出了问题。",
  ].join("\n")

  const detected = extractChinesePersonNames(chapterOne)
  assert.ok(detected.includes("李晦"))
  assert.equal(detected.includes("宋管事"), false)

  const first = evaluateChapterConsistency({ chapterNumber: 1, text: chapterOne })
  assert.equal(first.status, "eligible")
  assert.equal(first.protagonistName, "李晦")

  const second = evaluateChapterConsistency({
    chapterNumber: 2,
    text: chapterTwo,
    previousProtagonistName: first.protagonistName,
  })
  assert.equal(second.status, "quarantined")
  assert.match(second.reason, /李晦/)
  assert.equal(second.protagonistName, "李晦")

  const third = evaluateChapterConsistency({
    chapterNumber: 3,
    text: chapterThree,
    previousProtagonistName: first.protagonistName,
  })
  assert.equal(third.status, "quarantined")
  assert.match(third.reason, /李晦/)
})

test("factory snapshot does not mark quality-passed chapters complete when protagonist drifts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-protagonist-drift-facts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk must keep one protagonist across a long collapsing-dynasty novel",
    totalChapters: 3,
    chapterWordTarget: 2500,
  })
  const chaptersDir = path.join(created.project.projectRoot, ".ai-novel", "chapters")
  const chapters = [
    {
      chapterNumber: 1,
      path: ".ai-novel/chapters/chapter-001.final.md",
      text: [
        "## Final Body",
        "",
        "李晦是被一巴掌扇醒的。",
        "宋管事把契书拍在他脸上，催他缴租。李晦咬住腮帮子，知道自己不能倒下。",
      ].join("\n"),
    },
    {
      chapterNumber: 2,
      path: ".ai-novel/chapters/chapter-002.final.md",
      text: [
        "## Final Body",
        "",
        "陈默是被冷醒的。",
        "他睁开眼，看见的不是出租屋天花板，而是一片黑黢黢的梁木。",
      ].join("\n"),
    },
    {
      chapterNumber: 3,
      path: ".ai-novel/chapters/chapter-003.final.md",
      text: [
        "## Final Body",
        "",
        "天还没有亮，李延就被一阵急促的拍门声惊醒。",
        "张主簿找他问田册，李延意识到自己被卷进了县衙旧案。",
      ].join("\n"),
    },
  ]
  for (const chapter of chapters) {
    await fs.writeFile(path.join(chaptersDir, path.basename(chapter.path)), `${chapter.text}\n`)
  }

  await withFactoryDb(tempDir, async (db) => {
    for (const chapter of chapters) {
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: chapter.path,
        metadata: {
          chapterNumber: chapter.chapterNumber,
          pass: "final",
          qualityGate: {
            status: "passed",
            score: 8,
            attempts: 1,
            reason: "LLM quality report passed.",
            wordCount: 2800,
            targetWords: 2500,
          },
        },
      })
    }
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const chapterOne = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1)
  const chapterTwo = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2)
  const chapterThree = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 3)

  assert.equal(chapterOne.status, "complete")
  assert.equal(chapterOne.protagonistName, "李晦")
  assert.equal(chapterTwo.qualityGate.status, "passed")
  assert.equal(chapterTwo.status, "pending")
  assert.equal(chapterTwo.contentQuality.status, "quarantined")
  assert.match(chapterTwo.contentQuality.reason, /李晦/)
  assert.equal(chapterThree.status, "pending")
  assert.equal(chapterThree.contentQuality.status, "quarantined")
})

test("chapter facts do not let stale running events override quality gate results", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-stale-running-facts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk audits stale chapter events",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: { status: "blocked", score: 5, attempts: 2, reason: "needs rewrite" },
      },
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "draft_generation_llm_started",
      role: "Author",
      chapterNumber: 1,
      status: "running",
      message: "Old run that should not hide the blocked quality gate.",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.status, "blocked")
  assert.equal(fact.qualityGate.status, "blocked")
})

test("chapter facts keep a trusted final chapter complete even with a later stale failed event", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-stale-failed-complete-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk should not lose a trusted final chapter to stale failure noise",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const chapterPath = path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md")
  await fs.writeFile(chapterPath, [
    "## Final Body",
    "",
    "李晦是被一巴掌扇醒的。",
    "宋管事把契书拍在他脸上。李晦咬住腮帮子，知道自己不能倒下。",
  ].join("\n"))

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: {
          status: "passed",
          score: 8,
          attempts: 1,
          reason: "quality passed",
          wordCount: 2700,
          targetWords: 2500,
          updatedAt: "2026-06-04T14:25:22.127Z",
        },
      },
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "draft_generation_llm_failed",
      role: "Author",
      chapterNumber: 1,
      status: "blocked",
      message: "Late stale failure from an old request.",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.qualityGate.status, "passed")
  assert.equal(fact.contentQuality.status, "eligible")
  assert.equal(fact.consistency.status, "eligible")
  assert.equal(fact.status, "complete")
})

test("chapter facts prefer fresh in-progress writing over stale passed quality gates", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-fresh-running-facts-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk rewrites a previously passed chapter",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: { status: "passed", score: 8, attempts: 1, reason: "ok", wordCount: 2700, targetWords: 2500 },
      },
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "draft_generation_llm_started",
      role: "Author",
      chapterNumber: 1,
      status: "running",
      message: "Fresh rewrite should surface as in progress.",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.status, "in_progress")
  assert.equal(fact.qualityGate.status, "passed")
})

test("chapter facts prefer completed pipeline events over earlier recovery queue events", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-completed-after-recovery-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk finishes a recovered chapter",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: {
          status: "blocked",
          score: 5,
          attempts: 2,
          reason: "old blocked gate",
          wordCount: 1200,
          targetWords: 2500,
          updatedAt: "2026-06-03T00:00:00.000Z",
        },
      },
    })
    db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_RECOVERY_QUEUED", {
      chapterNumber: 1,
      recoveryAttempts: 1,
    })
    db.recordEvent(created.project.id, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: 1,
      status: "in_progress",
      reason: "chapter_production_started",
    })
    db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_COMPLETED", {
      chapterNumber: 1,
      finalPath: ".ai-novel/chapters/chapter-001.final.md",
      reportPath: ".ai-novel/reports/chapter-001-quality.md",
      qualityGate: {
        status: "passed",
        score: 8,
        attempts: 1,
        reason: "ok",
        wordCount: 2800,
        targetWords: 2500,
      },
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.status, "complete")
  assert.equal(fact.qualityGate.status, "passed")
  assert.equal(fact.latestTaskStatus, "in_progress")
})

test("chapter facts do not keep blocked finished chapters in progress", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-blocked-finished-not-inprogress-"))
  const { createManagedAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk must recover after a failed review",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })

  await withFactoryDb(tempDir, async (db) => {
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: {
          status: "blocked",
          score: 8,
          attempts: 2,
          reason: "quality report still requires rewrite",
          wordCount: 3200,
          targetWords: 2500,
          updatedAt: "2026-06-05T22:01:37.034Z",
        },
      },
    })
    db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_RECOVERY_QUEUED", {
      chapterNumber: 1,
      recoveryAttempts: 1,
    })
    db.recordEvent(created.project.id, null, "CHAPTER_TASK_STATUS_UPDATED", {
      chapterNumber: 1,
      status: "in_progress",
      reason: "chapter_production_started",
    })
    db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
      step: "quality_review_llm_failed",
      role: "Editor",
      chapterNumber: 1,
      status: "blocked",
      message: "The final review request failed after producing a blocked report.",
    })
  })

  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  const fact = snapshot.chapterFacts.find((entry) => entry.chapterNumber === 1)
  assert.equal(fact.status, "blocked")
  assert.equal(fact.qualityGate.status, "blocked")
  assert.equal(fact.latestTaskStatus, "in_progress")
  assert.equal(fact.latestEventStatus, "blocked")
})

test("production writing pipeline records detailed plans, final chapters, reports, and memory in the factory database", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-pipeline-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A court strategist rewrites history through forbidden ledgers",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })

    await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    const state = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(state.runtime.stage, "drafting")
    assert.equal(state.plan.chapterTasks[0].status, "complete")

    const blueprint = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "plans", "chapter-blueprints", "chapter-001.md"),
      "utf8",
    )
    assert.match(blueprint, /Detailed Chapter Blueprint/)
    assert.match(blueprint, /Vocabulary And Idiom Strategy/)

    const finalChapter = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md"),
      "utf8",
    )
    assert.match(finalChapter, /Final Body/)
    assert.match(finalChapter, /Polish Pass/)
    assert.doesNotMatch(state.project.creativeProfile.styleFingerprint, /pending sample|first-chapter extraction/i)
    assert.match(state.project.creativeProfile.styleFingerprint, /paragraph|dialogue|voice|choice/)
    const styleProfile = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "style", "profile.md"),
      "utf8",
    )
    assert.match(styleProfile, /style fingerprint: /)
    assert.doesNotMatch(styleProfile, /pending sample|first-chapter extraction/i)

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("master-outline.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("chapter-blueprints/chapter-001.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("chapter-001.final.md")))
    assert.ok(snapshot.artifacts.some((artifact) => String(artifact.path).includes("chapter-001-quality.md")))
    assert.equal(snapshot.artifactSummary.blueprints, 4)
    assert.equal(snapshot.artifactSummary.finalChapters, 1)
    assert.equal(snapshot.artifactSummary.qualityReports, 1)
    assert.equal(snapshot.artifactSummary.memoryUpdates, 1)
    assert.match(snapshot.artifactSummary.latestFinalPath, /chapter-001\.final\.md/)
    const qualityArtifact = snapshot.artifacts.find((artifact) => String(artifact.path).includes("chapter-001-quality.md"))
    assert.equal(JSON.parse(qualityArtifact.metadata_json).qualityGate.status, "passed")
    assert.ok(snapshot.recentMemory.some((memory) => String(memory.kind) === "chapter_summary"))
    const completedEvent = snapshot.latestEvents.find((event) => event.type === "CHAPTER_PIPELINE_COMPLETED")
    assert.ok(completedEvent)
    assert.equal(JSON.parse(completedEvent.payload_json).qualityGate.status, "passed")
    const artifactMessages = snapshot.recentMessages.filter((message) => message.type === "artifact")
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && message.data.label === "全书主线规划"
      && /master-outline\.md/.test(message.data.artifactPath),
    ))
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && message.data.label === "第 1 章蓝图"
      && /chapter-blueprints\/chapter-001\.md/.test(message.data.artifactPath),
    ))
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && message.data.label === "第 1 章正式成稿"
      && /chapter-001\.final\.md/.test(message.data.artifactPath),
    ))
    const finalArtifactMessage = artifactMessages.find((message) => /chapter-001\.final\.md/.test(message.data.artifactPath))
    assert.match(finalArtifactMessage?.id || finalArtifactMessage?.messageId || "", /^artifact-/)
    assert.ok(finalArtifactMessage.parts.some((part) => part.type === "markdown"))
    assert.ok(finalArtifactMessage.parts.some((part) => part.type === "artifact" && /chapter-001\.final\.md/.test(part.data.path)))
    assert.ok(finalArtifactMessage.parts.some((part) => part.type === "json" && part.data.kind === "chapter"))
    assert.ok(artifactMessages.some((message) =>
      message.metadata?.source === "production_artifact"
      && message.data.label === "第 1 章质检报告"
      && /chapter-001-quality\.md/.test(message.data.artifactPath),
    ))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("production writing pipeline emits visible progress events for chapter production", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-writing-progress-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const progressEvents = []
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A quiet clerk rewrites a haunted dynasty ledger",
      title: "Visible Writing",
      totalChapters: 3,
      chapterWordTarget: 2500,
    })

    let state = created.state
    while (state.runtime.stage !== "drafting") {
      state = await advanceAutonomousProject(created.project.projectRoot, {
        factoryRootDir: tempDir,
        projectId: created.project.id,
        onProgress(event) {
          progressEvents.push(event)
        },
      })
    }

    state = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      directorCommandId: "cmd_visible_writing_chapter_001",
      onProgress(event) {
        progressEvents.push(event)
      },
    })

    assert.equal(state.plan.chapterTasks[0].status, "complete")
    assert.ok(progressEvents.some((event) => event.step === "master_planning_started" && event.role === "Showrunner"))
    assert.ok(progressEvents.some((event) => event.step === "master_planning_completed" && event.role === "Showrunner"))
    assert.ok(progressEvents.some((event) => event.step === "master_outline_saved" && /master-outline\.md/.test(event.artifactPath || "")))
    assert.ok(progressEvents.some((event) => event.step === "chapter_blueprint_started" && event.role === "Chapter Planner"))
    assert.ok(progressEvents.some((event) => event.step === "blueprint_knowledge_recalled" && event.role === "Chapter Planner"))
    assert.ok(progressEvents.some((event) => event.step === "chapter_blueprint_completed" && event.role === "Chapter Planner"))
    assert.ok(progressEvents.some((event) => event.step === "chapter_blueprint_saved" && /chapter-blueprints\/chapter-001\.md/.test(event.artifactPath || "")))
    assert.ok(progressEvents.some((event) => event.step === "chapter_started"))
    assert.ok(progressEvents.some((event) => event.step === "draft_knowledge_recalled" && event.role === "Author"))
    assert.ok(progressEvents.some((event) => event.step === "draft_completed" && event.role === "Author"))
    assert.ok(progressEvents.some((event) => event.step === "quality_gate_completed" && event.qualityGate))
    assert.ok(progressEvents.some((event) => event.step === "memory_update_started" && event.role === "Memory Keeper"))
    assert.ok(progressEvents.some((event) => event.step === "chapter_artifacts_saved" && /chapter-001\.final\.md/.test(event.artifactPath || "")))

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const progressRows = snapshot.latestEvents.filter((event) => event.type === "WRITING_PROGRESS")
    assert.ok(progressRows.some((event) => /"step":"master_outline_saved"/.test(event.payload_json || "")))
    assert.ok(progressRows.some((event) => /"step":"draft_knowledge_recalled"/.test(event.payload_json || "")))
    assert.ok(progressRows.some((event) => /"step":"draft_completed"/.test(event.payload_json || "")))
    const productionStepEvents = progressEvents.filter((event) =>
      ["draft_completed", "quality_gate_completed", "chapter_artifacts_saved"].includes(event.step),
    )
    assert.equal(productionStepEvents.length, 3)
    assert.equal(new Set(productionStepEvents.map((event) => event.messageId)).size, 3)
    assert.ok(productionStepEvents.every((event) => event.directorCommandId))
    assert.ok(productionStepEvents.every((event) => String(event.messageId || "").includes(event.directorCommandId)))
    const writingMessages = await withFactoryDb(tempDir, async (db) =>
      db.listMessages(created.project.id, { limit: 500 }).filter((message) => message.metadata?.source === "writing_progress"),
    )
    const progressMessagesByStep = new Map(writingMessages.map((message) => [message.metadata?.step, message]))
    for (const step of [
      "chapter_started",
      "blueprint_loaded",
      "continuity_contract_loaded",
      "draft_knowledge_recalled",
      "draft_completed",
      "quality_gate_completed",
      "memory_update_started",
      "chapter_artifacts_saved",
    ]) {
      assert.ok(progressMessagesByStep.get(step), `expected a dedicated writing message for ${step}`)
    }
    const progressMessageIds = writingMessages.map((message) => String(message.id || message.messageId || ""))
    assert.equal(new Set(progressMessageIds).size, progressMessageIds.length)
    assert.ok(progressMessageIds.every((messageId) => !/pipeline-status$/u.test(messageId)))
    const durableProductionMessages = ["draft_completed", "quality_gate_completed", "chapter_artifacts_saved"]
      .map((step) => progressMessagesByStep.get(step))
    assert.ok(durableProductionMessages.every(Boolean))
    assert.equal(new Set(durableProductionMessages.map((message) => message.id)).size, durableProductionMessages.length)
    assert.ok(durableProductionMessages.every((message) => message.metadata?.directorCommandId))
    assert.ok(durableProductionMessages.every((message) => String(message.id || "").includes(message.metadata.directorCommandId)))
    assert.ok(writingMessages.some((message) => /chapter_artifacts_saved/.test(String(message.data.content || ""))))
    assert.ok(writingMessages.some((message) =>
      message.metadata?.step === "draft_knowledge_recalled"
      && /RAG/.test(String(message.data.content || "")),
    ))
    assert.ok(writingMessages.some((message) => message.data.agentType === "memory_keeper"))
    const completedWritingMessage = writingMessages.find((message) => message.metadata?.step === "chapter_artifacts_saved")
    assert.ok(completedWritingMessage)
    assert.equal(completedWritingMessage.data.phase, "completed")
    assert.match(String(completedWritingMessage.data.statusText || ""), /完成|保存/)
    assert.ok(completedWritingMessage.parts.some((part) =>
      part.type === "json" && part.data.phase === "completed" && /完成|保存/.test(String(part.data.statusText || "")),
    ))
    const writingArtifactMessage = writingMessages.find((message) =>
      message.parts?.some((part) => part.type === "artifact" && /chapter-001\.final\.md/.test(part.data.path)),
    )
    assert.ok(writingArtifactMessage)
    assert.ok(writingArtifactMessage.parts.some((part) => part.type === "markdown"))
    assert.ok(writingArtifactMessage.parts.some((part) => part.type === "json" && part.data.step === "chapter_artifacts_saved"))
    assert.ok(writingArtifactMessage.parts.some((part) => part.type === "artifact" && /chapter-001\.final\.md/.test(part.data.path)))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("advance recovers in-progress chapter tasks without final artifacts before completing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-recover-inprogress-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk repairs a broken dynasty through ledgers",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })

    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "complete"
    state.plan.chapterTasks[0].status = "in_progress"
    state.plan.chapterTasks[1].status = "complete"
    state.plan.pendingChapters = 0
    await saveAutonomousState(created.project.projectRoot, state)

    const recovered = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(recovered.plan.chapterTasks[0].status, "complete")
    assert.equal(recovered.runtime.stage, "complete")
    const finalChapter = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md"),
      "utf8",
    )
    assert.match(finalChapter, /Final Body/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("drafting does not start a later chapter while a chapter is still in progress", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-no-skip-inprogress-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk must finish chapter one before chapter two",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })

    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "in_progress"
    state.plan.chapterTasks[1].status = "pending"
    state.plan.pendingChapters = 1
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => {
      db.updateProjectState(created.project.id, state)
      db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
        step: "draft_generation_llm_streaming",
        role: "Author",
        chapterNumber: 1,
        status: "running",
        message: "Chapter one is still streaming.",
      })
    })

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(advanced.runtime.stage, "drafting")
    assert.equal(advanced.plan.chapterTasks[0].status, "in_progress")
    assert.equal(advanced.plan.chapterTasks[1].status, "pending")
    assert.match(advanced.runtime.statusMessage, /Chapter 1 is still in progress/)
    await assert.rejects(
      fs.access(path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-002.final.md")),
    )
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("advance reconciles completed chapter tasks whose quality gate is blocked", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-reconcile-quality-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk audits the last winter of an empire",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const state = created.state
  state.runtime.stage = "drafting"
  state.plan.chapterTasks[0].status = "complete"
  state.plan.chapterTasks[0].qualityGate = {
    passed: false,
    score: 5,
    status: "blocked",
    attempts: 1,
    reason: "word count too low",
    wordCount: 600,
    targetWords: 2500,
  }
  state.plan.pendingChapters = 1
  await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), `${JSON.stringify(state, null, 2)}\n`)

  const reconciled = await advanceAutonomousProject(created.project.projectRoot, {
    factoryRootDir: tempDir,
    projectId: created.project.id,
    preferDeterministicPlanning: true,
  })

  assert.equal(reconciled.plan.chapterTasks[0].status, "blocked")
  assert.equal(reconciled.plan.chapterTasks[0].qualityGate.status, "blocked")
  assert.equal(reconciled.runtime.stage, "reviewing")
  assert.match(reconciled.runtime.statusMessage, /Reconciled 1 chapter task/)
  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.latestEvents.some((event) => event.type === "CHAPTER_STATUS_RECONCILED"))
})

test("drafting advances the oldest blocked chapter before later pending chapters", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-oldest-blocked-first-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk must finish earlier chapters before later ones",
      totalChapters: 3,
      chapterWordTarget: 2500,
    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "blocked"
    state.plan.chapterTasks[0].qualityGate = {
      passed: false,
      status: "blocked",
      score: 5,
      attempts: 1,
      reason: "chapter one failed",
    }
    state.plan.chapterTasks[1].status = "pending"
    state.plan.chapterTasks[2].status = "pending"
    state.plan.pendingChapters = 2
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(advanced.plan.chapterTasks[0].status, "complete")
    assert.equal(advanced.plan.chapterTasks[0].recoveryAttempts, 1)
    assert.equal(advanced.plan.chapterTasks[1].status, "pending")
    assert.equal(advanced.plan.chapterTasks[2].status, "pending")
    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const recoveryEvent = snapshot.latestEvents.find((event) => event.type === "CHAPTER_PIPELINE_RECOVERY_QUEUED")
    assert.ok(recoveryEvent)
    assert.equal(JSON.parse(recoveryEvent.payload_json).chapterNumber, 1)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("chapter recovery queued after a blocked quality gate does not reconcile back to blocked", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-recovery-no-loop-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk escapes a recovery loop",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "reviewing"
    state.plan.chapterTasks[0].status = "blocked"
    state.plan.chapterTasks[0].qualityGate = {
      passed: false,
      status: "blocked",
      score: 5,
      attempts: 2,
      reason: "needs another pass",
      wordCount: 1200,
      targetWords: 2500,
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
    }
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => {
      db.updateProjectState(created.project.id, state)
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: ".ai-novel/chapters/chapter-001.final.md",
        status: "completed",
        metadata: {
          chapterNumber: 1,
          pass: "final",
          qualityGate: state.plan.chapterTasks[0].qualityGate,
        },
      })
      db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
        step: "chapter_artifacts_saved",
        role: "Memory Keeper",
        chapterNumber: 1,
        status: "blocked",
        qualityGate: state.plan.chapterTasks[0].qualityGate,
      })
    })

    const queued = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    assert.equal(queued.runtime.stage, "drafting")
    assert.equal(queued.plan.chapterTasks[0].status, "pending")
    assert.ok(queued.plan.chapterTasks[0].recoveryQueuedAt)

    const next = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.notEqual(next.runtime.lastAction, "reconciled_chapter_facts")
    assert.equal(next.runtime.stage, "drafting")
    assert.equal(next.plan.chapterTasks[0].status, "complete")
    assert.equal(next.plan.chapterTasks[1].status, "pending")

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const chapterOneFact = snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1)
    assert.equal(chapterOneFact.latestTaskStatus, "in_progress")
    assert.equal(chapterOneFact.status, "complete")
    const reconciledEvents = snapshot.latestEvents.filter((event) => event.type === "CHAPTER_STATUS_RECONCILED")
    assert.equal(reconciledEvents.length, 0)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("chapter queue reset makes old non-complete chapter facts pending for fresh writing", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-queue-reset-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk restarts a confused chapter queue",
      totalChapters: 3,
      chapterWordTarget: 2500,
    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "complete"
    state.plan.chapterTasks[0].qualityGate = {
      status: "passed",
      score: 8,
      attempts: 1,
      reason: "ok",
      wordCount: 2800,
      targetWords: 2500,
      updatedAt: new Date(Date.now() - 120_000).toISOString(),
    }
    state.plan.chapterTasks[1].status = "blocked"
    state.plan.chapterTasks[1].recoveryAttempts = 4
    state.plan.chapterTasks[1].recoveryBlocked = true
    state.plan.chapterTasks[1].recoveryQueuedAt = new Date(Date.now() - 90_000).toISOString()
    state.plan.chapterTasks[1].qualityGate = {
      status: "blocked",
      score: 4,
      attempts: 2,
      reason: "old blocker",
      wordCount: 900,
      targetWords: 2500,
      updatedAt: new Date(Date.now() - 90_000).toISOString(),
    }
    state.plan.chapterTasks[1].contentQuality = {
      status: "quarantined",
      reason: "old blocker",
      wordCount: 900,
      targetWords: 2500,
      minimumWords: 2000,
    }
    state.plan.chapterTasks[2].status = "pending"
    state.plan.pendingChapters = 1
    await saveAutonomousState(created.project.projectRoot, state)

    await withFactoryDb(tempDir, async (db) => {
      db.updateProjectState(created.project.id, state)
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: ".ai-novel/chapters/chapter-001.final.md",
        status: "completed",
        metadata: {
          chapterNumber: 1,
          pass: "final",
          qualityGate: state.plan.chapterTasks[0].qualityGate,
        },
      })
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: ".ai-novel/chapters/chapter-002.final.md",
        status: "completed",
        metadata: {
          chapterNumber: 2,
          pass: "final",
          qualityGate: state.plan.chapterTasks[1].qualityGate,
        },
      })
      db.recordEvent(created.project.id, null, "WRITING_PROGRESS", {
        step: "chapter_artifacts_saved",
        role: "Memory Keeper",
        chapterNumber: 2,
        status: "blocked",
        qualityGate: state.plan.chapterTasks[1].qualityGate,
      })
      db.recordEvent(created.project.id, null, "CHAPTER_QUEUE_RESET", {
        resetChapters: [2, 3],
        preservedCompleteChapters: [1],
        reason: "operator requested fresh queue",
      })
    })

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).status, "complete")
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2).status, "pending")
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2).qualityGate, undefined)
    assert.ok(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 2).resetAt)

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      preferDeterministicPlanning: true,
    })

    assert.equal(advanced.runtime.stage, "drafting")
    assert.equal(advanced.plan.chapterTasks[0].status, "complete")
    assert.equal(advanced.plan.chapterTasks[1].status, "pending")
    assert.equal(advanced.plan.chapterTasks[1].qualityGate, undefined)
    assert.equal(advanced.plan.chapterTasks[1].contentQuality, undefined)
    assert.equal(advanced.plan.chapterTasks[1].recoveryAttempts, 0)
    assert.equal(advanced.plan.chapterTasks[2].status, "pending")
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("automatic recovery requeues low scoring chapters at the recovery limit", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-auto-recovery-limit-reviewing-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A clerk must not loop forever on a failed chapter",
    totalChapters: 2,
    chapterWordTarget: 2500,
  })
  const state = await loadAutonomousState(created.project.projectRoot)
  state.runtime.stage = "reviewing"
  state.plan.chapterTasks[0].status = "blocked"
  state.plan.chapterTasks[0].recoveryAttempts = 3
  state.plan.chapterTasks[0].recoveryBlocked = false
  state.plan.chapterTasks[0].qualityGate = {
    passed: false,
    status: "blocked",
    score: 5,
    attempts: 2,
    reason: "chapter one failed",
  }
  state.plan.chapterTasks[1].status = "pending"
  state.plan.pendingChapters = 1
  await saveAutonomousState(created.project.projectRoot, state)
  await withFactoryDb(tempDir, async (db) => {
    db.updateProjectState(created.project.id, state)
    db.recordArtifact({
      projectId: created.project.id,
      kind: "chapter",
      path: ".ai-novel/chapters/chapter-001.final.md",
      status: "completed",
      metadata: {
        chapterNumber: 1,
        pass: "final",
        qualityGate: state.plan.chapterTasks[0].qualityGate,
      },
    })
    db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_BLOCKED", {
      chapterNumber: 1,
      finalPath: ".ai-novel/chapters/chapter-001.final.md",
      reportPath: ".ai-novel/reports/chapter-001-quality.md",
      qualityGate: state.plan.chapterTasks[0].qualityGate,
    })
  })

  const advanced = await advanceAutonomousProject(created.project.projectRoot, {
    factoryRootDir: tempDir,
    projectId: created.project.id,
  })

  assert.equal(advanced.runtime.stage, "drafting")
  assert.equal(advanced.plan.chapterTasks[0].status, "pending")
  assert.equal(advanced.plan.chapterTasks[0].recoveryBlocked, false)
  assert.equal(advanced.plan.chapterTasks[0].recoveryAttempts, 0)
  assert.equal(advanced.plan.chapterTasks[1].status, "pending")
  assert.match(advanced.runtime.statusMessage, /fresh production pass/)
  const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
  assert.ok(snapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED"))
})

test("automatic recovery never auto-approves high scoring chapters at the recovery limit", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-auto-recovery-no-auto-approve-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk must continue unattended after a high scoring review",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "reviewing"
    state.plan.chapterTasks[0].status = "blocked"
    state.plan.chapterTasks[0].recoveryAttempts = 3
    state.plan.chapterTasks[0].recoveryBlocked = false
    state.plan.chapterTasks[0].qualityGate = {
      status: "blocked",
      score: 8,
      attempts: 2,
      reason: "质量报告包含阻塞或返工信号。",
      wordCount: 3200,
      targetWords: 2500,
      updatedAt: "2026-06-04T00:00:00.000Z",
    }
    state.plan.chapterTasks[1].status = "pending"
    state.plan.pendingChapters = 1
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => {
      db.updateProjectState(created.project.id, state)
      db.recordArtifact({
        projectId: created.project.id,
        kind: "chapter",
        path: ".ai-novel/chapters/chapter-001.final.md",
        status: "completed",
        metadata: {
          chapterNumber: 1,
          pass: "final",
          qualityGate: state.plan.chapterTasks[0].qualityGate,
        },
      })
      db.recordEvent(created.project.id, null, "CHAPTER_PIPELINE_BLOCKED", {
        chapterNumber: 1,
        finalPath: ".ai-novel/chapters/chapter-001.final.md",
        reportPath: ".ai-novel/reports/chapter-001-quality.md",
        qualityGate: state.plan.chapterTasks[0].qualityGate,
      })
    })

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(advanced.plan.chapterTasks[0].status, "pending")
    assert.equal(advanced.plan.chapterTasks[0].recoveryBlocked, false)
    assert.equal(advanced.plan.chapterTasks[0].recoveryAttempts, 0)
    assert.equal(advanced.plan.chapterTasks[0].qualityGate.status, "blocked")
    assert.equal(advanced.runtime.stage, "drafting")
    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(snapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED"))
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).status, "pending")
    assert.equal(snapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).qualityGate.status, "blocked")

    const next = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    assert.notEqual(next.runtime.lastAction, "reconciled_chapter_facts")
    assert.equal(next.plan.chapterTasks[0].status, "complete")
    assert.equal(next.plan.chapterTasks[0].qualityGate.status, "passed")
    assert.equal(next.plan.chapterTasks[1].status, "pending")
    const nextSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.equal(nextSnapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).status, "complete")
    assert.equal(nextSnapshot.chapterFacts.find((fact) => fact.chapterNumber === 1).qualityGate.status, "passed")
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("drafting requeues a recovery-limited blocked chapter before later chapters", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-auto-recovery-limit-drafting-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, loadAutonomousState, saveAutonomousState, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A clerk cannot start chapter two while chapter one is blocked",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })
    const state = await loadAutonomousState(created.project.projectRoot)
    state.runtime.stage = "drafting"
    state.plan.chapterTasks[0].status = "blocked"
    state.plan.chapterTasks[0].recoveryAttempts = 3
    state.plan.chapterTasks[0].recoveryBlocked = false
    state.plan.chapterTasks[0].qualityGate = {
      passed: false,
      status: "blocked",
      score: 5,
      attempts: 2,
      reason: "chapter one failed",
    }
    state.plan.chapterTasks[1].status = "pending"
    state.plan.pendingChapters = 1
    await saveAutonomousState(created.project.projectRoot, state)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })

    assert.equal(advanced.runtime.stage, "drafting")
    assert.equal(advanced.plan.chapterTasks[0].status, "complete")
    assert.equal(advanced.plan.chapterTasks[0].recoveryBlocked, false)
    assert.equal(advanced.plan.chapterTasks[0].recoveryAttempts, 0)
    assert.equal(advanced.plan.chapterTasks[1].status, "pending")
    await assert.rejects(
      fs.access(path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-002.final.md")),
    )
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("production writing pipeline blocks low quality chapters after automatic revisions", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-quality-block-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, retryChapterProduction, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A provincial judge investigates poems that alter verdicts",
      totalChapters: 4,
      chapterWordTarget: 2500,
    })

    await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    const state = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      forceQualityScoreForTest: 5,
      maxRevisionAttempts: 1,
    })

    assert.equal(state.runtime.stage, "reviewing")
    assert.equal(state.plan.chapterTasks[0].status, "blocked")
    assert.match(state.runtime.statusMessage, /quality gate/)

    const report = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "reports", "chapter-001-quality.md"),
      "utf8",
    )
    assert.match(report, /综合评分 \| 5\/10/)

    const finalChapter = await fs.readFile(
      path.join(created.project.projectRoot, ".ai-novel", "chapters", "chapter-001.final.md"),
      "utf8",
    )
    assert.match(finalChapter, /Status: blocked/)
    assert.match(finalChapter, /Attempts: 1/)

    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const blockedEvent = snapshot.latestEvents.find((event) => event.type === "CHAPTER_PIPELINE_BLOCKED")
    assert.ok(blockedEvent)
    const blockedPayload = JSON.parse(blockedEvent.payload_json)
    assert.equal(blockedPayload.qualityGate.status, "blocked")
    assert.equal(blockedPayload.qualityGate.score, 5)

    const recovered = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
    })
    assert.equal(recovered.runtime.stage, "drafting")
    assert.equal(recovered.plan.chapterTasks[0].status, "pending")
    assert.equal(recovered.plan.chapterTasks[0].recoveryAttempts, 1)
    assert.equal(recovered.plan.chapterTasks[0].qualityGate.status, "blocked")

    const recoveredSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    const recoveryEvent = recoveredSnapshot.latestEvents.find((event) => event.type === "CHAPTER_PIPELINE_RECOVERY_QUEUED")
    assert.ok(recoveryEvent)
    assert.equal(JSON.parse(recoveryEvent.payload_json).recoveryAttempts, 1)

    recovered.plan.chapterTasks[0].status = "blocked"
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, recovered))
    await fs.writeFile(
      path.join(created.project.projectRoot, ".ai-novel", "state.json"),
      `${JSON.stringify(recovered, null, 2)}\n`,
    )
    const explicitlyRetried = await retryChapterProduction(created.project.projectRoot, 1, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      runNow: true,
    })
    assert.equal(explicitlyRetried.plan.chapterTasks[0].status, "complete")
    assert.equal(explicitlyRetried.plan.chapterTasks[0].recoveryAttempts, 2)

    explicitlyRetried.plan.chapterTasks[0].status = "blocked"
    explicitlyRetried.plan.chapterTasks[0].recoveryAttempts = 3
    await fs.writeFile(
      path.join(created.project.projectRoot, ".ai-novel", "state.json"),
      `${JSON.stringify(explicitlyRetried, null, 2)}\n`,
    )
    const limited = await retryChapterProduction(created.project.projectRoot, 1, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      maxRecoveryAttempts: 3,
    })
    assert.equal(limited.plan.chapterTasks[0].status, "pending")
    assert.equal(limited.plan.chapterTasks[0].recoveryBlocked, false)
    assert.equal(limited.plan.chapterTasks[0].recoveryAttempts, 0)
    assert.match(limited.runtime.statusMessage, /fresh production pass/)
    const limitedSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(created.project.id))
    assert.ok(limitedSnapshot.latestEvents.some((event) => event.type === "CHAPTER_PIPELINE_AUTO_REWRITE_QUEUED"))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("production writing pipeline keeps quality LLM roles while defaulting long-form drafting to fast gates", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")

  assert.match(source, /roleName:\s*"Showrunner"/)
  assert.match(source, /roleName:\s*"Chapter Planner"/)
  assert.match(source, /roleName:\s*"Author"/)
  assert.match(source, /roleName:\s*"Editor"/)
  assert.match(source, /roleName:\s*"Prose Stylist"/)
  assert.match(source, /ProductionWritingMode = "fast" \| "quality"/)
  assert.match(source, /AI_NOVEL_WRITING_MODE/)
  assert.match(source, /shouldUseLlmQualityPass/)
  assert.match(source, /shouldUseLlmPolishPass/)
  assert.match(source, /createMasterOutlineContent/)
  assert.match(source, /createChapterBlueprintContent/)
  assert.match(source, /AI_NOVEL_TEST_MODE === "1"/)
})

test("production master planning can fall back when provider is temporarily unavailable", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")

  assert.match(source, /LLM_FALLBACK_USED/)
  assert.match(source, /deterministic_master_outline/)
  assert.match(source, /timed\\s\*out/)
})

test("unattended deterministic mode is limited to planning and cannot bypass production drafting", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")
  const orchestratorSource = await fs.readFile(path.join(packageRoot, "src", "orchestrator.ts"), "utf8")

  assert.match(source, /options\.preferDeterministicPlanning/)
  assert.match(source, /createDetailedChapterBlueprint/)
  assert.doesNotMatch(source, /function createDraftBody[\s\S]*?AI_NOVEL_TEST_MODE === "1" \|\| options\.preferDeterministicPlanning/)
  assert.doesNotMatch(source, /function createProductionQualityReport[\s\S]*?AI_NOVEL_TEST_MODE === "1" \|\| options\.preferDeterministicPlanning/)
  assert.doesNotMatch(source, /function reviseDraftForQualityGate[\s\S]*?AI_NOVEL_TEST_MODE === "1" \|\| options\.preferDeterministicPlanning/)
  assert.doesNotMatch(source, /function createProductionPolishedDraft[\s\S]*?AI_NOVEL_TEST_MODE === "1" \|\| options\.preferDeterministicPlanning/)
  assert.match(source, /WORD_COUNT_CHECK/)
  assert.match(orchestratorSource, /state\.runtime\.stage = "drafting"/)
})

test("quality gate parser ignores non-blocking blocker language when score passes", async () => {
  const { parseQualityGate } = await loadCore()
  const gate = parseQualityGate([
    "# Chapter Quality Report",
    "",
    "| 综合评分 | 8/10 | 可进入润色。 |",
    "",
    "WORD_COUNT_CHECK: 2200/2500",
    "",
    "## Required Fixes",
    "- 暂无阻塞性问题；润色时继续压低 AI 模板句。",
  ].join("\n"), 0, 2)

  assert.equal(gate.status, "passed")
  assert.equal(gate.passed, true)
})

test("autopilot worker status and once modes expose operational state", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-worker-status-"))
  const { createManagedAutonomousProject, getNovelAutopilotWorkerStatus, runNovelAutopilotWorkerOnce, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A scribe restores kingdoms from rain ledgers",
      totalChapters: 5,
      chapterWordTarget: 2500,
    })
    await withFactoryDb(tempDir, async (db) =>
      db.createJob({
        projectId: created.project.id,
        kind: "autopilot",
        status: "running",
        payload: { message: "continue" },
      }),
    )

    const before = await getNovelAutopilotWorkerStatus(tempDir)
    assert.equal(before.service, "ai-novel-worker")
    assert.equal(before.factory.jobs.runnable, 1)

    const after = await runNovelAutopilotWorkerOnce(tempDir)
    assert.equal(after.ok, true)
    assert.ok(after.factory.latestEvents.some((event) => event.type === "JOB_RESTORE_READY"))
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("autopilot worker treats provider network failures as resumable retries", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /isTransientNetworkError/)
  assert.match(source, /classifyTransientNetworkError/)
  assert.match(source, /network_retry/)
  assert.match(source, /timed\\s\*out/)
  assert.match(source, /rate_limit/)
  assert.match(source, /provider_unavailable/)
  assert.match(source, /network_retry_paused/)
  assert.match(source, /nextNetworkRetryDelay/)
  assert.match(source, /heartbeatJob\(jobId, leaseOwner, AUTOPILOT_LEASE_SECONDS\)/)
  assert.match(source, /模型响应超时，正在自动重试/)
  assert.match(source, /模型服务触发限流/)
})

test("autopilot stop aborts active worker model calls instead of waiting for the current round", async () => {
  const workerSource = await fs.readFile(autopilotWorkerSource, "utf8")
  const serverSource = await fs.readFile(path.join(packageRoot, "src", "studio-server.ts"), "utf8")
  const runtimeSource = await fs.readFile(path.join(packageRoot, "src", "runtime-llm.ts"), "utf8")
  const pipelineSource = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")
  const discussionSource = await fs.readFile(path.join(packageRoot, "src", "discussion.ts"), "utf8")

  assert.match(workerSource, /controller: AbortController/)
  assert.match(workerSource, /stopAutopilotJob/)
  assert.match(workerSource, /job\.controller\.abort\(\)/)
  assert.match(workerSource, /controller\.abort\(\)/)
  assert.match(workerSource, /startJobLeaseHeartbeat[\s\S]*listProjectJobs/)
  assert.match(workerSource, /signal,\s*\n\s*onProgress/)
  assert.match(workerSource, /runMultiAgentDiscussion[\s\S]*signal,/)
  assert.match(workerSource, /latestJob && latestJob\.status !== "running" && latestJob\.status !== "paused"/)
  assert.match(workerSource, /sleep\(delayMs, signal\)/)
  assert.match(serverSource, /stopAutopilotJob\(context\.projectRoot\)/)
  assert.match(serverSource, /正在中断当前模型请求/)
  assert.match(runtimeSource, /signal\?: AbortSignal/)
  assert.match(runtimeSource, /withTimeout\(config\.provider\.timeoutMs[\s\S]*options\.signal\)/)
  assert.match(pipelineSource, /signal\?: AbortSignal/)
  assert.match(pipelineSource, /signal: options\.signal/)
  assert.match(pipelineSource, /throwIfPipelineAborted/)
  assert.match(discussionSource, /signal\?: AbortSignal/)
  assert.match(discussionSource, /signal: options\.signal/)
})

test("streaming LLM reads are abortable by the provider inactivity timeout", async () => {
  const runtimeSource = await fs.readFile(path.join(packageRoot, "src", "runtime-llm.ts"), "utf8")

  assert.match(runtimeSource, /streamOpenAiCompatibleResponse\([\s\S]*signal:\s*AbortSignal[\s\S]*markActivity/)
  assert.match(runtimeSource, /options\.signal\.addEventListener\("abort",\s*abortRead,\s*\{\s*once:\s*true\s*\}\)/)
  assert.match(runtimeSource, /reader\.cancel\(\)\.catch\(\(\) => undefined\)/)
  assert.match(runtimeSource, /reader\.releaseLock\(\)/)
  assert.match(runtimeSource, /streamOpenAiCompatibleResponse\(response,[\s\S]*\{\s*signal,\s*markActivity,\s*\}/)
})

test("streaming LLM request times out when provider opens SSE but sends no chunks", async () => {
  const { generateAgentReply } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const previousBaseUrl = process.env.LLM_BASE_URL
  const previousApiKey = process.env.LLM_API_KEY
  const previousModelId = process.env.LLM_MODEL_ID
  const previousTimeout = process.env.LLM_TIMEOUT_MS
  const hangingResponses = new Set()
  const server = http.createServer((request, response) => {
    if (request.url === "/chat/completions") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      })
      hangingResponses.add(response)
      response.on("close", () => hangingResponses.delete(response))
      return
    }

    response.writeHead(404).end()
  })

  try {
    await new Promise((resolve, reject) => {
      server.listen(0, "127.0.0.1", resolve)
      server.once("error", reject)
    })
    const address = server.address()
    assert.ok(address && typeof address === "object")
    delete process.env.AI_NOVEL_TEST_MODE
    process.env.LLM_BASE_URL = `http://127.0.0.1:${address.port}`
    process.env.LLM_API_KEY = "test-key"
    process.env.LLM_MODEL_ID = "test-model"
    process.env.LLM_TIMEOUT_MS = "30"

    await assert.rejects(
      () => generateAgentReply({
        roleName: "Author",
        basePrompt: "You write fiction.",
        dynamicPrompt: "Write one sentence.",
        consensus: "Test",
        message: "Start",
        onDelta: () => undefined,
      }),
      /LLM request timed out after 30ms without provider activity/,
    )
  } finally {
    for (const response of hangingResponses) {
      response.destroy()
    }
    await new Promise((resolve) => server.close(resolve))
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
    if (previousBaseUrl === undefined) {
      delete process.env.LLM_BASE_URL
    } else {
      process.env.LLM_BASE_URL = previousBaseUrl
    }
    if (previousApiKey === undefined) {
      delete process.env.LLM_API_KEY
    } else {
      process.env.LLM_API_KEY = previousApiKey
    }
    if (previousModelId === undefined) {
      delete process.env.LLM_MODEL_ID
    } else {
      process.env.LLM_MODEL_ID = previousModelId
    }
    if (previousTimeout === undefined) {
      delete process.env.LLM_TIMEOUT_MS
    } else {
      process.env.LLM_TIMEOUT_MS = previousTimeout
    }
  }
})

test("autopilot abort keeps durable jobs recoverable instead of cancelling them", async () => {
  const workerSource = await fs.readFile(autopilotWorkerSource, "utf8")
  const abortBranch = workerSource.match(/if \(controller\.signal\.aborted \|\| isAutopilotStopError\(error\)\) \{[\s\S]*?return\s*\n\s*\}/)?.[0] || ""

  assert.match(abortBranch, /db\.pauseJob\(options\.jobId as string\)/)
  assert.doesNotMatch(abortBranch, /db\.cancelJob\(options\.jobId as string\)/)
  assert.match(abortBranch, /任务仍可从数据库恢复/)
})

test("autopilot worker treats stage-guarded discussion writeback as recoverable", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")
  const directorSource = await fs.readFile(path.join(packageRoot, "src", "novel-director.ts"), "utf8")

  assert.match(directorSource, /isGenericAutopilotMessage/)
  assert.match(source, /canAdvanceDespiteGuard/)
  assert.match(source, /discussion\.writebackSkipped/)
  assert.match(source, /guard_recoverable/)
  assert.match(source, /无人值守流程继续按状态机推进/)
})

test("embedded studio start can release a stale durable job lease for takeover", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "studio-server.ts"), "utf8")
  const factorySource = await fs.readFile(path.join(packageRoot, "src", "factory-db.ts"), "utf8")

  assert.match(factorySource, /releaseJobLease/)
  assert.match(factorySource, /JOB_LEASE_RELEASED/)
  assert.match(source, /embedded_worker_start_takeover/)
  assert.match(source, /!isAutopilotRunning\(context\.projectRoot\)/)
  assert.match(source, /db\.releaseJobLease/)
  assert.match(source, /right\.updated_at \|\| right\.created_at/)
})

test("autopilot prioritizes production advance over discussion for generic continue messages", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")
  const directorSource = await fs.readFile(path.join(packageRoot, "src", "novel-director.ts"), "utf8")

  assert.match(source, /decideNovelDirectorCommand/)
  assert.match(source, /DIRECTOR_COMMAND_DECIDED/)
  assert.match(directorSource, /shouldAdvanceBeforeDiscussion/)
  assert.match(directorSource, /isGenericAutopilotMessage/)
  assert.match(directorSource, /state\.runtime\.stage === "complete"/)
  assert.match(directorSource, /every\(\(task\) => task\.status === "complete"\)/)
  assert.match(directorSource, /当前阶段已有足够上下文，优先推进生产状态机/)
  assert.match(source, /advanceFirst:\s*directorCommand\.advanceFirst/)
  assert.match(source, /preferDeterministicPlanning:\s*true/)
})

test("autopilot no-progress backoff waits for earlier active chapters before later pending work", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /function hasEarlierActiveTask/)
  assert.match(source, /task\.chapterNumber < chapterNumber && \(task\.status === "in_progress" \|\| task\.status === "blocked"\)/)
  assert.match(source, /latestPendingTask && !hasEarlierActiveTask\(latestState,\s*latestPendingTask\.chapterNumber\)/)
  assert.match(source, /lastStep:\s*staleActiveWritingMessage \? "stale_llm_recovery_pending" : activeWritingMessage \? "waiting_for_llm" : "no_progress_backoff"/)
})

test("autopilot waits for active writing messages before issuing another director command", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /async function backoffIfActiveWritingMessage/)
  assert.match(source, /await backoffIfActiveWritingMessage\(rootDir,\s*projectRoot,\s*projectId,\s*beforeDiscussion,\s*signal\)/)
  assert.match(source, /const directorCommand = decideNovelDirectorCommand/)
  assert.ok(
    source.indexOf("await backoffIfActiveWritingMessage(rootDir, projectRoot, projectId, beforeDiscussion, signal)")
      < source.indexOf("const directorCommand = decideNovelDirectorCommand"),
  )
})

test("autopilot requeues orphaned in-progress chapters before director decisions", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /async function recoverOrphanedInProgressWritingTask/)
  assert.match(source, /const activeWritingMessage = await findActiveWritingMessage\(rootDir,\s*projectId,\s*task\.chapterNumber\)/)
  assert.match(source, /if \(activeWritingMessage\) \{\s*return \{ recovered: false, state \}/)
  assert.match(source, /task\.status = "pending"/)
  assert.match(source, /orphaned_in_progress_recovered/)
  assert.match(source, /CHAPTER_TASK_STATUS_UPDATED/)
  assert.ok(
    source.indexOf("await recoverOrphanedInProgressWritingTask(rootDir, projectRoot, projectId, beforeDiscussion)")
      < source.indexOf("const directorCommand = decideNovelDirectorCommand"),
  )
})

test("autopilot stale LLM recovery requeues blocked chapters that still have an active writing message", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")

  assert.match(source, /async function recoverStaleWritingRequest/)
  assert.match(
    source,
    /const task = state\.plan\.chapterTasks\.find\(\(candidate\) =>\s*candidate\.status === "in_progress" \|\| candidate\.status === "blocked"\)/,
  )
  assert.match(source, /stale_llm_request_recovered/)
  assert.match(source, /task\.status = "pending"/)
})

test("novel director is the thin decision layer for unattended flow", async () => {
  const { initAutonomousProject, decideNovelDirectorCommand, createFollowUpAdvanceCommand } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-director-"))

  const state = await initAutonomousProject({
    rootDir: tempDir,
    idea: "A minor Tang clerk documents a collapsing capital",
    totalChapters: 6,
    chapterWordTarget: 2500,
  })

  assert.equal(decideNovelDirectorCommand(state, { userMessage: "继续" }).type, "discuss")

  state.runtime.stage = "drafting"
  const advanceCommand = decideNovelDirectorCommand(state, { userMessage: "继续" })
  assert.match(advanceCommand.id, /^cmd_/)
  assert.deepEqual(
    { ...advanceCommand, id: "cmd_test" },
    {
      id: "cmd_test",
      type: "advance",
      stage: "drafting",
      reason: "当前阶段已有足够上下文，优先推进生产状态机。",
      advanceFirst: true,
      parentCommandId: null,
    },
  )

  assert.equal(
    decideNovelDirectorCommand(state, { userMessage: "请先检查主角动机" }).type,
    "discuss",
  )
  assert.equal(
    decideNovelDirectorCommand(state, { userMessage: "继续", correctionMessage: "上一轮跑偏，请纠偏。" }).type,
    "discuss",
  )

  const discussCommand = decideNovelDirectorCommand(state, { userMessage: "请先检查主角动机" })
  const followUp = createFollowUpAdvanceCommand(state, discussCommand)
  assert.equal(followUp.type, "advance")
  assert.equal(followUp.parentCommandId, discussCommand.id)
  assert.notEqual(followUp.id, discussCommand.id)
})

test("director commands are traceable through worker execution events", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")
  const discussionSource = await fs.readFile(path.join(packageRoot, "src", "discussion.ts"), "utf8")
  const pipelineSource = await fs.readFile(path.join(packageRoot, "src", "writing-pipeline.ts"), "utf8")

  assert.match(source, /DIRECTOR_COMMAND_DECIDED/)
  assert.match(source, /DIRECTOR_COMMAND_STARTED/)
  assert.match(source, /DIRECTOR_COMMAND_COMPLETED/)
  assert.match(source, /DIRECTOR_COMMAND_FAILED/)
  assert.match(source, /recordDirectorCommandEvent/)
  assert.doesNotMatch(source, /db\.recordEvent\(projectId,\s*null,\s*"DIRECTOR_COMMAND/)
  assert.match(source, /directorCommandId:\s*directorCommand\.id/)
  assert.match(source, /createFollowUpAdvanceCommand/)
  assert.match(source, /directorCommandId:\s*followUpAdvanceCommand\.id/)
  assert.match(source, /parentDirectorCommandId:\s*directorCommand\.id/)
  assert.match(discussionSource, /directorCommandId:\s*options\.directorCommandId/)
  assert.match(pipelineSource, /directorCommandId:\s*options\.directorCommandId/)
})

test("studio http server forwards ordinary json api routes through one adapter", async () => {
  const source = await fs.readFile(path.join(packageRoot, "src", "studio-server.ts"), "utf8")
  const serverStartSource = source.slice(source.indexOf("export async function startNovelStudioServer"))

  assert.match(source, /function isJsonApiRequest/)
  assert.match(source, /async function forwardJsonApiRequest/)
  assert.match(serverStartSource, /isJsonApiRequest\(request\.method,\s*pathname\)/)
  assert.match(serverStartSource, /forwardJsonApiRequest\(rootDir,\s*request,\s*response,\s*url,\s*\{\s*embeddedWorker\s*\}\)/)
  assert.equal((serverStartSource.match(/handleNovelStudioApi/g) || []).length, 1)
  assert.match(serverStartSource, /\/api\/chat-stream/)
  assert.match(serverStartSource, /\/api\/autopilot-stream/)
})

test("writing pipeline injects a canon continuity contract before planning and drafting", async () => {
  const {
    createDetailedChapterBlueprint,
    createDraftBodyFromBlueprint,
  } = await loadCore()

  const state = {
    project: {
      title: "不小心穿越到大唐末期",
      idea: "穿越到大唐末期，用小人物视角经历王朝终局",
      createdAt: "2026-06-06T00:00:00.000Z",
      workspaceVersion: 1,
    },
    runtime: {
      stage: "drafting",
      statusMessage: "",
      lastUpdatedAt: "2026-06-06T00:00:00.000Z",
      lastInterruption: null,
    },
    reactSetup: { discussionGoals: [], unansweredQuestions: [] },
    plan: {
      totalChapters: 3,
      chapterWordTarget: 2500,
      pendingChapters: 2,
      chapterTasks: [
        {
          chapterNumber: 1,
          title: "Chapter 1",
          status: "complete",
          summary: "李延落入唐末乱世。",
          targetWords: 2500,
          qualityGate: {
            status: "passed",
            score: 8,
            attempts: 0,
            reason: "质量门禁通过。 首章候选主角识别为「李延」，后续章节必须沿用。",
            updatedAt: "2026-06-06T00:01:00.000Z",
          },
        },
        {
          chapterNumber: 2,
          title: "Chapter 2",
          status: "pending",
          summary: "李延进城并发现第一条军镇线索。",
          targetWords: 2500,
        },
      ],
    },
    assets: {
      cover: { status: "pending", briefPath: "" },
      comic: { status: "pending", planPath: "" },
    },
  }
  const task = state.plan.chapterTasks[1]
  const resources = {
    styleGuide: "",
    chapterPlannerGuide: "",
    writerGuide: "",
    editorGuide: "",
    styleControllerGuide: "",
    consistencyGuide: "",
    vocabularyIndex: "",
    vocabularySamples: ["- 场景类型：环境渲染；建议：泥、冷风、城门"],
    examples: [
      [
        "### ✅ 正确示范（自然流畅）",
        "他先把账册按在桌上，听见门外风声压低，才说出自己的判断。",
        "",
        "### ❌ 错误示范（成语泛滥）",
        "他深思熟虑、忠心耿耿、义愤填膺，真是千钧一发。",
      ].join("\n"),
    ],
  }

  const blueprint = createDetailedChapterBlueprint(state, task, {
    consensus: "配角老农仍在城外，密信线索需要承接。",
    protagonist: "",
    style: "",
  }, resources)
  assert.match(blueprint, /Canon Continuity Contract/)
  assert.match(blueprint, /Locked protagonist: 李延/)
  assert.match(blueprint, /配角一致性/)
  assert.match(blueprint, /情节连续性/)
  assert.match(blueprint, /伏笔一致性/)

  const fallbackDraft = createDraftBodyFromBlueprint(state, task, blueprint, resources)
  assert.match(fallbackDraft, /李延/)
  assert.doesNotMatch(fallbackDraft, /李晦/)
})

test("initial planning artifacts carry chapter-level causality before drafting", async () => {
  const {
    createDetailedChapterBlueprint,
    createManagedAutonomousProject,
    createProductionMasterOutline,
  } = await loadCore()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-causal-planning-"))
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "穿越到大唐末期，用小人物从底层进入权力核心并见证王朝终局",
    title: "唐末因果规划",
    totalChapters: 5,
    chapterWordTarget: 2500,
  })
  const resources = {
    styleGuide: "",
    chapterPlannerGuide: "",
    writerGuide: "",
    editorGuide: "",
    styleControllerGuide: "",
    consistencyGuide: "",
    vocabularyIndex: "",
    vocabularySamples: ["- 场景类型：权谋算计；建议：账册、密信、官印"],
    vocabularyCatalog: {
      totalWords: 4,
      entriesByCategory: {
        court_politics: [
          { word: "筹略", definition: "谋略。", categories: ["court_politics"] },
          { word: "深思熟虑", definition: "深入思考。", categories: ["court_politics", "emotions"] },
          { word: "忠心耿耿", definition: "形容非常忠诚。", categories: ["court_politics", "character_traits"] },
        ],
        emotions: [
          { word: "沉吟", definition: "迟疑不决，低声自语。", categories: ["emotions"] },
        ],
      },
      entriesByWord: new Map([
        ["筹略", { word: "筹略", definition: "谋略。", categories: ["court_politics"] }],
        ["深思熟虑", { word: "深思熟虑", definition: "深入思考。", categories: ["court_politics", "emotions"] }],
        ["忠心耿耿", { word: "忠心耿耿", definition: "形容非常忠诚。", categories: ["court_politics", "character_traits"] }],
        ["沉吟", { word: "沉吟", definition: "迟疑不决，低声自语。", categories: ["emotions"] }],
      ]),
    },
    examples: [
      [
        "### ✅ 正确示范（自然流畅）",
        "他先把账册按在桌上，听见门外风声压低，才说出自己的判断。",
        "",
        "### ❌ 错误示范（成语泛滥）",
        "他深思熟虑、忠心耿耿、义愤填膺，真是千钧一发。",
      ].join("\n"),
    ],
  }
  const context = {
    consensus: "主角必须从底层事务进入军镇与朝堂权力缝隙。",
    protagonist: "主角：李延；身份：底层小吏。",
    style: "少用堆叠短词，场景必须由动作和因果推进。",
  }
  const outline = createProductionMasterOutline(created.state, context, resources)

  assert.match(outline, /## Causal Spine/)
  assert.match(outline, /## Chapter Causality Matrix/)
  assert.match(outline, /## Continuity Anchor Plan/)
  assert.match(outline, /## Character State Ledger Plan/)
  assert.match(outline, /## Foreshadowing Payoff Schedule/)
  assert.match(outline, /Previous Input/)
  assert.match(outline, /Irreversible Change/)

  const chapterTwo = created.state.plan.chapterTasks[1]
  assert.ok(chapterTwo.causalPlan)
  assert.match(chapterTwo.summary, /承接/)
  assert.match(chapterTwo.summary, /交棒/)
  assert.doesNotMatch(chapterTwo.summary, /Draft chapter/)

  const blueprint = createDetailedChapterBlueprint(created.state, chapterTwo, context, resources)
  assert.match(blueprint, /## Previous Inputs/)
  assert.match(blueprint, /## Causal Objective/)
  assert.match(blueprint, /## Protagonist Decision/)
  assert.match(blueprint, /## Irreversible Change/)
  assert.match(blueprint, /## Character State Delta/)
  assert.match(blueprint, /## Required Continuity Anchors/)
  assert.match(blueprint, /## Next Chapter Handoff/)
  assert.match(blueprint, /因果推进/)
  assert.match(blueprint, /词汇使用指南/)
  assert.match(blueprint, /成语关联性检查/)
  assert.match(blueprint, /深思熟虑|忠心耿耿|筹略/)
  assert.match(blueprint, /Migrated Vocabulary Skill Examples/)
  assert.match(blueprint, /Writing Resource Usage Manifest/)
  assert.match(blueprint, /账册按在桌上/)
  assert.match(blueprint, /深思熟虑、忠心耿耿、义愤填膺/)
})

test("chapter consistency blocks drift before an editor report can pass it", async () => {
  const {
    evaluateChapterConsistency,
    parseQualityGate,
  } = await loadCore()
  const report = [
    "# Chapter Quality Report",
    "| 综合评分 | 9/10 | 质量很好 |",
    "WORD_COUNT_CHECK: 2600/2500",
    "质量门禁：passed",
  ].join("\n")
  const gate = parseQualityGate(report, 0, 2)
  assert.equal(gate.passed, true)

  const consistency = evaluateChapterConsistency({
    chapterNumber: 2,
    previousProtagonistName: "李延",
    text: "# Chapter 2\n\n## Draft Body\n\n陈远睁开眼，发现自己身在唐末城门外。陈远必须进城寻找粮食。",
  })
  assert.equal(consistency.status, "quarantined")
  assert.match(consistency.reason, /未出现已锁定主角「李延」/)
})

test("writing resource gate blocks idiom stacking and accepts concrete skill-style prose", async () => {
  const {
    evaluateWritingResourceUsage,
  } = await loadCore()

  const stacked = evaluateWritingResourceUsage("他深思熟虑，忠心耿耿，义愤填膺，千钧一发。")
  assert.equal(stacked.status, "quarantined")
  assert.match(stacked.reason, /成语|堆/)

  const concrete = evaluateWritingResourceUsage([
    "李延把账册按在桌上，指腹蹭到纸边的泥。",
    "门外风声压低，差役的靴底在石阶上停了一下。",
    "他没有急着说话，只把密信往灯下推了半寸，问主簿这枚官印从哪里来。",
  ].join("\n"))
  assert.equal(concrete.status, "eligible")
  assert.match(concrete.reason, /动作|感官|物件|资源/)
})

test("genre profile carries creation style contract into writing strategy", async () => {
  const { inferGenreProfile } = await loadCore()
  const state = {
    project: {
      title: "Blind Stargazer",
      idea: "A blind stargazer hears the future in cosmic noise.",
      createdAt: "2026-06-04T00:00:00.000Z",
      workspaceVersion: 1,
      creativeProfile: {
        genre: "suspense",
        platform: "serialized web novel",
        readerPromise: "mystery",
        pointOfView: "third-person limited",
        tone: "restrained",
        naturalnessTarget: "strict",
        styleFingerprint: "short sensory paragraphs and distinct dialogue voices",
        characterProfileRequirements: [],
      },
    },
    runtime: { stage: "drafting" },
    plan: { totalChapters: 12, chapterWordTarget: 2600, chapterTasks: [] },
  }

  const genre = inferGenreProfile(state)
  assert.equal(genre.genre, "悬疑")
  assert.equal(genre.readerPromise, "mystery")
  assert.equal(genre.naturalnessTarget, "strict")
  assert.match(genre.narration, /生产风格合同/)
  assert.match(genre.narration, /风格指纹：short sensory paragraphs and distinct dialogue voices/)
  assert.match(genre.narration, /自然度=strict/)
})

test("writing pipeline hard gates plot continuity beyond matching protagonist names", async () => {
  const {
    createContinuityContract,
    evaluatePlotContinuityBridge,
    evaluateNarrativeStyleQuality,
  } = await loadCore()
  const task = {
    chapterNumber: 2,
    title: "西市追账",
    status: "pending",
    summary: "李延追查田册与密信。",
    targetWords: 2500,
  }
  const state = {
    project: {
      title: "唐末小吏",
      idea: "穿越到大唐末期，用小人物视角进入权力核心。",
      createdAt: "2026-06-04T00:00:00.000Z",
      workspaceVersion: 1,
    },
    runtime: {
      stage: "drafting",
      statusMessage: "",
      lastUpdatedAt: "2026-06-04T00:00:00.000Z",
      lastInterruption: null,
    },
    reactSetup: { discussionGoals: [], unansweredQuestions: [] },
    plan: {
      totalChapters: 10,
      chapterWordTarget: 2500,
      pendingChapters: 9,
      chapterTasks: [
        {
          chapterNumber: 1,
          title: "田册",
          status: "complete",
          summary: "李延拿到缺页田册，宋管事交出半枚官印，坊正留下一封密信。",
          targetWords: 2500,
          qualityGate: {
            status: "passed",
            score: 8,
            attempts: 0,
            reason: "质量门禁通过。首章候选主角识别为「李延」。",
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        },
        task,
      ],
    },
    assets: {
      cover: { status: "pending", briefPath: "" },
      comic: { status: "pending", planPath: "" },
    },
  }
  const previousMemory = [
    "# Chapter 1 Memory Update",
    "",
    "## Foreshadowing",
    "- Continuity anchor: 缺页田册",
    "- Continuity anchor: 半枚官印",
    "- Continuity anchor: 坊正密信",
    "- 下一章必须承接上述 Continuity anchor 中至少两个。",
  ].join("\n")
  const previousFinalDraft = [
    "## Final Body",
    "李延把缺页田册藏进怀里，宋管事把半枚官印塞给他。",
    "坊正密信没有拆，封口的蜡却已经裂开。",
  ].join("\n")
  const contract = createContinuityContract({
    state,
    task,
    previousMemory,
    previousFinalDraft,
  })

  assert.ok(contract.continuityAnchors.some((anchor) => /田册/.test(anchor)))
  assert.ok(contract.continuityAnchors.some((anchor) => /官印/.test(anchor)))
  assert.match(contract.prompt, /Continuity Anchors/)

  const disconnectedDraft = [
    "## Final Body",
    "李延一早去了西市，看见街边有人吵架。",
    "他买了两个胡饼，决定换一条巷子继续走。",
    "这一天的事和前一日没有什么关系，只是人声更乱。",
  ].join("\n")
  const continuity = evaluatePlotContinuityBridge(disconnectedDraft, task, contract)
  assert.equal(continuity.status, "quarantined")
  assert.match(continuity.reason, /章节连续性硬门槛失败/)

  const connectedDraft = [
    "## Final Body",
    "李延一早去了西市，袖中仍压着那本缺页田册。",
    "半枚官印硌着腕骨，他每走一步都记得宋管事昨夜的眼神。",
    "坊正密信不能再拖，他必须先找出田册缺页去了谁手里。",
  ].join("\n")
  const connectedContinuity = evaluatePlotContinuityBridge(connectedDraft, task, contract)
  assert.equal(connectedContinuity.status, "eligible")

  const fragmented = [
    "## Final Body",
    "冷。",
    "暗。",
    "冷。",
    "静。",
    "冷。",
    "李延站在巷口。",
  ].join("\n")
  const style = evaluateNarrativeStyleQuality(fragmented)
  assert.equal(style.status, "quarantined")
  assert.match(style.reason, /短词|碎片/)
})

test("character profile gate rejects same-voice multi-character scenes", async () => {
  const { evaluateCharacterProfilePresence } = await loadCore()
  const contract = {
    status: "ready",
    requiredFields: [],
    knownCast: ["李延", "宋管事"],
    missingSignals: [],
    dossierBrief: "",
    profileBrief: "",
    prompt: "",
  }

  const flattened = [
    "## Final Body",
    "李延想要查清田册，他必须继续追问。宋管事想要保住账本，他必须继续解释。",
    "李延说事情很复杂，宋管事也说事情很复杂。两个人都很紧张，也都很沉默。",
    "他们的关系充满怀疑，但这一切说明局势正在变化。",
  ].join("\n")
  const flattenedGate = evaluateCharacterProfilePresence(flattened, contract)
  assert.equal(flattenedGate.status, "quarantined")
  assert.match(flattenedGate.reason, /角色差异化不足/)

  const differentiated = [
    "## Final Body",
    "李延把缺页田册按在桌角，指腹压住纸边的泥。",
    "「宋管事，官印少了半枚，你还要说是风吹的？」他没有抬头，只把灯芯拨低。",
    "宋管事喉结动了一下，袖口在桌沿蹭出细响，低声道：「小李大人，我只敢保账，不敢保命。」",
    "李延必须在天亮前决定是否把密信递进县衙，宋管事却退到门边，先替他拦住了外面的脚步声。",
  ].join("\n")
  const differentiatedGate = evaluateCharacterProfilePresence(differentiated, contract)
  assert.equal(differentiatedGate.status, "eligible")
  assert.match(differentiatedGate.reason, /角色差异化通过/)
})

test("knowledge retrieval excludes stale chapter artifacts after a chapter queue reset", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-rag-reset-"))
  const {
    createManagedAutonomousProject,
    ingestKnowledgeSource,
    retrieveKnowledge,
    withFactoryDb,
  } = await loadCore()
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A minor Tang clerk survives the final years of empire",
    title: "RAG Reset",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  await ingestKnowledgeSource({
    rootDir: tempDir,
    scope: "project",
    projectId: created.project.id,
    sourceType: "chapter",
    path: ".ai-novel/chapters/chapter-002.final.md",
    title: "chapter-002.final.md",
    content: "# Chapter 2\n\n## Final Body\n\n陈远在旧稿里出现，这是重置后不能再召回的污染内容。",
  })
  await ingestKnowledgeSource({
    rootDir: tempDir,
    scope: "global",
    sourceType: "vocabulary",
    path: "packages/ai-novel-core/resources/writing/style/vocabulary/daily_life.md",
    title: "daily_life.md",
    content: "# 日常词汇\n\n泥水、柴门、粗粥、冷风。",
  })
  await withFactoryDb(tempDir, async (db) => {
    db.recordEvent(created.project.id, null, "CHAPTER_QUEUE_RESET", {
      resetChapters: [2],
      startChapterNumber: 2,
      reason: "test_reset",
    })
  })

  const rows = await retrieveKnowledge({
    rootDir: tempDir,
    projectId: created.project.id,
    query: "陈远 粗粥 泥水",
    scopes: ["project", "global"],
    sourceTypes: ["chapter", "vocabulary"],
    limit: 8,
    recordCitation: true,
  })

  assert.equal(rows.some((row) => String(row.source?.path || "").includes("chapter-002.final.md")), false)
  assert.equal(rows.some((row) => String(row.source?.sourceType || "") === "vocabulary"), true)
})

test("production writing pipeline retry limit is 3 attempts and blocks the task", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-production-quality-block-3-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  process.env.AI_NOVEL_TEST_MODE = "1"

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A judge investigate poems that alter verdicts",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })

    const state = created.state
    state.runtime.stage = "drafting"
    await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), `${JSON.stringify(state, null, 2)}\n`)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    const advanced = await advanceAutonomousProject(created.project.projectRoot, {
      factoryRootDir: tempDir,
      projectId: created.project.id,
      forceQualityScoreForTest: 5,
      maxRevisionAttempts: 3,
    })

    assert.equal(advanced.runtime.stage, "reviewing")
    assert.equal(advanced.plan.chapterTasks[0].status, "blocked")
    assert.equal(advanced.plan.chapterTasks[0].qualityGate.attempts, 3)
    assert.equal(advanced.plan.chapterTasks[0].qualityGate.status, "blocked")
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
  }
})

test("production writing pipeline treats transient provider failure as resumable and does not charge recoveryAttempts", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-provider-failure-test-"))
  const { createManagedAutonomousProject, advanceAutonomousProject, withFactoryDb } = await loadCore()
  const previousTestMode = process.env.AI_NOVEL_TEST_MODE
  const previousBaseUrl = process.env.LLM_BASE_URL
  const previousApiKey = process.env.LLM_API_KEY

  process.env.LLM_BASE_URL = "http://127.0.0.1:54321"
  process.env.LLM_API_KEY = "test-key"
  delete process.env.AI_NOVEL_TEST_MODE

  try {
    const created = await createManagedAutonomousProject({
      rootDir: tempDir,
      idea: "A scholar audits rainfall history",
      totalChapters: 2,
      chapterWordTarget: 2500,
    })

    const state = created.state
    state.runtime.stage = "drafting"
    await fs.writeFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), `${JSON.stringify(state, null, 2)}\n`)
    await withFactoryDb(tempDir, async (db) => db.updateProjectState(created.project.id, state))

    await assert.rejects(
      advanceAutonomousProject(created.project.projectRoot, {
        factoryRootDir: tempDir,
        projectId: created.project.id,
      }),
      (error) => {
        return error instanceof Error && (error.message.includes("Provider") || error.isProviderFailure);
      }
    )

    const stateFile = await fs.readFile(path.join(created.project.projectRoot, ".ai-novel", "state.json"), "utf8")
    const stateObj = JSON.parse(stateFile)
    assert.equal(stateObj.plan.chapterTasks[0].status, "pending")
    assert.equal(stateObj.plan.chapterTasks[0].recoveryAttempts || 0, 0)
    assert.match(stateObj.runtime.statusMessage, /Provider error/)
  } finally {
    if (previousTestMode === undefined) {
      delete process.env.AI_NOVEL_TEST_MODE
    } else {
      process.env.AI_NOVEL_TEST_MODE = previousTestMode
    }
    if (previousBaseUrl === undefined) {
      delete process.env.LLM_BASE_URL
    } else {
      process.env.LLM_BASE_URL = previousBaseUrl
    }
    if (previousApiKey === undefined) {
      delete process.env.LLM_API_KEY
    } else {
      process.env.LLM_API_KEY = previousApiKey
    }
  }
})
