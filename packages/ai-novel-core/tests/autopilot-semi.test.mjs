import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import nodePath from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const testFilePath = fileURLToPath(import.meta.url)
const packageRoot = nodePath.resolve(nodePath.dirname(testFilePath), "..")
const coreEntry = nodePath.join(packageRoot, "dist", "index.js")
const studioServerEntry = nodePath.join(packageRoot, "dist", "studio-server.js")
const autopilotWorkerSource = nodePath.join(packageRoot, "src", "autopilot-worker.ts")

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

async function loadStudioServer() {
  return import(`${pathToFileURL(studioServerEntry).href}?ts=${Date.now()}`)
}

test("autopilot worker contains semi-autopilot interception and pause logic", async () => {
  const source = await fs.readFile(autopilotWorkerSource, "utf8")
  
  // 验证在 advance 命令前的半自动拦截逻辑
  assert.match(source, /beforeDiscussion\.project\?\.autoMode === "semi"/)
  assert.match(source, /isGenericAutopilotMessage\(nextMessage \|\| ""\)/)
  assert.match(source, /semi_auto_paused/)
  assert.match(source, /pauseJob\(jobId, leaseOwner\)/)
  
  // 验证讨论共识写回后的半自动拦截逻辑
  assert.match(source, /afterDiscussion\.project\?\.autoMode === "semi"/)
  assert.match(source, /已暂停在 \$\{afterDiscussion\.runtime\.stage\} 阶段，等待用户审阅确认成果/)
})

test("studio server allows changing autoMode between full and semi, persisting to state and database", async () => {
  const tempDir = await fs.mkdtemp(nodePath.join(os.tmpdir(), "ai-novel-core-semi-api-"))
  const { createManagedAutonomousProject, withFactoryDb, loadAutonomousState } = await loadCore()
  const { handleNovelStudioApi } = await loadStudioServer()

  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A scribe writes code in a semi-automatic factory",
    totalChapters: 4,
    chapterWordTarget: 2500,
  })

  // 1. 验证初始状态 autoMode 缺省未设置或默认
  const initialState = await loadAutonomousState(created.project.projectRoot)
  assert.equal(initialState.project.autoMode, undefined)

  // 2. 模拟调用 POST /api/autopilot/mode，切换为 semi 模式
  const requestBody = { projectId: created.project.id, autoMode: "semi" }
  const result = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/autopilot/mode",
    requestBody,
    { projectId: created.project.id }
  )

  assert.equal(result.status, 200)
  assert.equal(result.payload?.activeProjectId, created.project.id)

  // 3. 验证 state 中已成功更新
  const updatedState = await loadAutonomousState(created.project.projectRoot)
  assert.equal(updatedState.project.autoMode, "semi")

  // 4. 验证 factory 数据库中 projectState 已落库更新
  const dbState = await withFactoryDb(tempDir, async (db) => {
    const proj = await db.getSnapshot(created.project.id)
    return proj.state
  })
  assert.equal(dbState.project.autoMode, "semi")

  // 5. 模拟调用 POST /api/autopilot/mode，切换回 full 模式
  const result2 = await handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/autopilot/mode",
    { projectId: created.project.id, autoMode: "full" },
    { projectId: created.project.id }
  )
  assert.equal(result2.status, 200)

  const updatedState2 = await loadAutonomousState(created.project.projectRoot)
  assert.equal(updatedState2.project.autoMode, "full")
})
