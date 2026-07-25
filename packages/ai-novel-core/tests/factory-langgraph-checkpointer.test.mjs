import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { FactoryDb } from "../dist/index.js"
import { FactoryLangGraphCheckpointer } from "../dist/factory-langgraph-checkpointer.js"

async function prepareProject() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "factory-langgraph-checkpointer-"))
  const db = await FactoryDb.open(rootDir)
  try {
    db.upsertProject({
      id: "project-1",
      slug: "project-1",
      title: "问界",
      idea: "验证 LangGraph 持久化适配",
      createdAt: new Date().toISOString(),
      totalChapters: 100,
      chapterWordTarget: 2500,
      projectRoot: path.join(rootDir, "project-1"),
    }, {
      runtime: { stage: "world_building", autopilot: { running: false } },
    })
  } finally {
    db.close()
  }
  return rootDir
}

function checkpoint(id, value, version) {
  return {
    v: 4,
    id,
    ts: new Date().toISOString(),
    channel_values: { workflow: value },
    channel_versions: { workflow: version },
    versions_seen: { node: { workflow: version - 1 } },
  }
}

test("FactoryLangGraphCheckpointer persists history, parent links and pending writes", async () => {
  const rootDir = await prepareProject()
  const firstSaver = new FactoryLangGraphCheckpointer(rootDir, "project-1", "run-1")
  const thread = { configurable: { thread_id: "novel-project-1", checkpoint_ns: "production" } }
  const firstConfig = await firstSaver.put(thread, checkpoint("0001", { stage: "worldbuilding_dialogue" }, 1), {
    source: "input",
    step: -1,
    parents: {},
    nodeId: "production.worldbuilding",
  }, { workflow: 1 })
  await firstSaver.putWrites(firstConfig, [
    ["workflow", { stage: "setting_review" }],
    ["audit", { valid: true }],
  ], "task-1")
  const secondConfig = await firstSaver.put(firstConfig, checkpoint("0002", { stage: "setting_review" }, 2), {
    source: "loop",
    step: 0,
    parents: { production: "0001" },
    nodeId: "production.setting-review",
  }, { workflow: 2 })

  const restoredSaver = new FactoryLangGraphCheckpointer(rootDir, "project-1", "run-1")
  const latest = await restoredSaver.getTuple(thread)
  assert.equal(latest.checkpoint.id, "0002")
  assert.equal(latest.checkpoint.channel_values.workflow.stage, "setting_review")
  assert.equal(latest.parentConfig.configurable.checkpoint_id, "0001")

  const first = await restoredSaver.getTuple(firstConfig)
  assert.deepEqual(first.pendingWrites, [
    ["task-1", "workflow", { stage: "setting_review" }],
    ["task-1", "audit", { valid: true }],
  ])

  const history = []
  for await (const entry of restoredSaver.list(thread)) history.push(entry)
  assert.deepEqual(history.map((entry) => entry.checkpoint.id), ["0002", "0001"])
  const filtered = []
  for await (const entry of restoredSaver.list(thread, { filter: { nodeId: "production.worldbuilding" } })) filtered.push(entry)
  assert.deepEqual(filtered.map((entry) => entry.checkpoint.id), ["0001"])

  const before = []
  for await (const entry of restoredSaver.list(thread, { before: secondConfig })) before.push(entry)
  assert.deepEqual(before.map((entry) => entry.checkpoint.id), ["0001"])

  await restoredSaver.deleteThread("novel-project-1")
  assert.equal(await restoredSaver.getTuple(thread), undefined)
})

test("FactoryLangGraphCheckpointer rejects writes without durable thread identity", async () => {
  const rootDir = await prepareProject()
  const saver = new FactoryLangGraphCheckpointer(rootDir, "project-1")
  await assert.rejects(() => saver.put({ configurable: {} }, checkpoint("0001", {}, 1), {
    source: "input",
    step: -1,
    parents: {},
  }, {}), /requires_thread_id/)
  await assert.rejects(() => saver.putWrites({ configurable: { thread_id: "t" } }, [], "task"), /requires_checkpoint_id/)
})
