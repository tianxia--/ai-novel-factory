import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fork } from "node:child_process"
import { pathToFileURL, fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageRoot = path.resolve(__dirname, "..")
const coreEntry = path.join(packageRoot, "dist", "index.js")
const workerEntry = path.join(packageRoot, "tests", "worker-runner.mjs")

const DEFAULT_CHAPTERS = 4

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}?ts=${Date.now()}`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getCompletedChapters(projectRoot) {
  try {
    const stateText = await fs.readFile(path.join(projectRoot, ".ai-novel", "state.json"), "utf8")
    const state = JSON.parse(stateText)
    return state.plan.chapterTasks.filter((task) => task.status === "complete").length
  } catch {
    return 0
  }
}

async function run() {
  console.log("=== Starting Worker Longrun & Restart Stability Test ===")

  // 1. 创建临时 factory 根目录
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-core-worker-stability-"))
  console.log(`Temp Factory Root: ${tempDir}`)

  const {
    createManagedAutonomousProject,
    withFactoryDb,
  } = await loadCore()

  // 2. 初始化一个 4 章的自主小说项目
  const chapterCount = DEFAULT_CHAPTERS
  const created = await createManagedAutonomousProject({
    rootDir: tempDir,
    idea: "A time-travelling detective solves locked-room murders in dynastic China using future forensics",
    title: "Dynasty Forensics Stability Test",
    totalChapters: chapterCount,
    chapterWordTarget: 2500,
  })
  const projectRoot = created.project.projectRoot
  const projectId = created.project.id
  console.log(`Created Project: ${projectId} at ${projectRoot}`)

  // 3. 向 factory DB 注入一条 autopilot 启动任务
  await withFactoryDb(tempDir, async (db) => {
    db.createJob({
      projectId,
      kind: "autopilot",
      status: "idle",
      payload: {
        message: "开始无人值守创作",
      },
    })
  })
  console.log("Autopilot bootstrap job created in database.")

  // 4. 启动第一个 worker 进程
  console.log("Launching Worker Process 1...")
  let workerProcess = fork(workerEntry, ["--root-dir", tempDir, "--poll-ms", "50"], {
    env: {
      ...process.env,
      AI_NOVEL_TEST_MODE: "1",
      AI_NOVEL_TEST_FORCE_WORKER: "1",
    },
    stdio: "inherit",
  })

  // 5. 等待它推进一到两章，然后强杀
  let completed = 0
  const startTime = Date.now()
  const timeoutMs = 60000 // 60s max wait for the first stage

  while (Date.now() - startTime < timeoutMs) {
    completed = await getCompletedChapters(projectRoot)
    console.log(`[Worker Process 1] Completed chapters: ${completed}/${chapterCount}`)
    if (completed >= 1) {
      console.log(`Worker 1 advanced to ${completed} completed chapters. Killing Process...`)
      break
    }
    await sleep(500)
  }

  // 强杀 worker 1
  workerProcess.kill("SIGKILL")
  // 等待进程完全退出
  await new Promise((resolve) => {
    workerProcess.on("exit", resolve)
    setTimeout(resolve, 1000)
  })
  console.log("Worker Process 1 has been terminated (killed).")

  // 6. 清理在数据库里的租约，使得新 worker 能立即接管，并验证没有 duplicate
  await withFactoryDb(tempDir, async (db) => {
    // 将该 autopilot job 的 lease 重置，状态改回 'paused'，以使得新 worker 可拉起
    db.db.prepare(`
      UPDATE jobs
      SET lease_expires_at = NULL, lease_owner = NULL, status = 'paused'
      WHERE project_id = ? AND kind = 'autopilot'
    `).run(projectId)

    // 重置可能卡在 running/paused 的 job 租约
    db.db.prepare(`
      UPDATE jobs
      SET lease_expires_at = NULL, lease_owner = NULL, status = 'idle'
      WHERE project_id = ? AND status = 'running'
    `).run(projectId)
  })
  console.log("Database leases cleaned up. Ready for restoration.")

  // 7. 启动第二个 worker 进程（模拟重启）
  console.log("Launching Worker Process 2 (Recovery Mode)...")
  workerProcess = fork(workerEntry, ["--root-dir", tempDir, "--poll-ms", "50"], {
    env: {
      ...process.env,
      AI_NOVEL_TEST_MODE: "1",
      AI_NOVEL_TEST_FORCE_WORKER: "1",
    },
    stdio: "inherit",
  })

  // 8. 等待它完全推进到全部完成
  const recoveryStartTime = Date.now()
  const recoveryTimeoutMs = 120000 // 2 minutes max
  let success = false

  while (Date.now() - recoveryStartTime < recoveryTimeoutMs) {
    completed = await getCompletedChapters(projectRoot)
    console.log(`[Worker Process 2] Completed chapters: ${completed}/${chapterCount}`)

    // 检查项目是否已经到了 complete 阶段
    const snapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(projectId))
    if (snapshot.state?.runtime?.stage === "complete" && completed === chapterCount) {
      console.log("Production stage reached 'complete' successfully!")
      success = true
      break
    }

    // 校验有没有 duplicate jobs 或者是 multiple active jobs
    const activeAutopilotJobs = snapshot.activeJobs.filter(j => j.kind === "autopilot")
    assert.ok(activeAutopilotJobs.length <= 1, "Should never have more than 1 active autopilot job running concurrently!")

    await sleep(1000)
  }

  // 结束 worker 2
  workerProcess.kill("SIGINT")
  await new Promise((resolve) => {
    workerProcess.on("exit", resolve)
    setTimeout(resolve, 1000)
  })
  console.log("Worker Process 2 terminated.")

  // 9. 校验事实的一致性、顺序性，无重复章节 facts
  assert.ok(success, "Worker failed to recover and complete all chapters within the time limit.")
  
  const finalSnapshot = await withFactoryDb(tempDir, async (db) => db.getSnapshot(projectId))
  
  // 检查 chapterFacts
  const facts = finalSnapshot.chapterFacts
  console.log(`Final chapter facts count: ${facts.length}`)
  assert.equal(facts.length, chapterCount, `Should have exactly ${chapterCount} chapter facts`)
  
  const factNums = facts.map(f => f.chapterNumber)
  console.log(`Chapter fact numbers: ${JSON.stringify(factNums)}`)
  assert.deepEqual(
    factNums,
    Array.from({ length: chapterCount }, (_, i) => i + 1),
    "Chapter facts must be sequential and gapless, with no duplicates!"
  )

  // 确保所有任务都完结了
  assert.equal(finalSnapshot.activeJobs.length, 0, "No active jobs should remain")
  assert.equal(finalSnapshot.runnableJobs.length, 0, "No runnable jobs should remain")

  console.log("=== Worker Longrun & Restart Stability Test Passed Successfully! ===")
}

run().catch((err) => {
  console.error("Test failed with error:", err)
  process.exit(1)
})
