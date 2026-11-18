import fs from "node:fs/promises"
import os from "node:os"
import nodePath from "node:path"
import { pathToFileURL } from "node:url"

// 启用测试模式以模拟大模型响应，并强制在测试环境下拉起 worker 线程
process.env.AI_NOVEL_TEST_MODE = "1"
process.env.AI_NOVEL_TEST_FORCE_WORKER = "1"

const packageRoot = nodePath.resolve(process.cwd())
const coreEntry = nodePath.join(packageRoot, "dist", "index.js")
const studioServerEntry = nodePath.join(packageRoot, "dist", "studio-server.js")
const workerEntry = nodePath.join(packageRoot, "dist", "worker.js")

async function loadCore() {
  return import(`${pathToFileURL(coreEntry).href}`)
}

async function loadStudioServer() {
  return import(`${pathToFileURL(studioServerEntry).href}`)
}

async function loadWorker() {
  return import(`${pathToFileURL(workerEntry).href}`)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log("=== 启动高级防抖版工坊全流程创作评估 ===")
  const core = await loadCore()
  const studio = await loadStudioServer()
  const worker = await loadWorker()

  // 1. 创建临时的创作空间
  const tempDir = await fs.mkdtemp(nodePath.join(packageRoot, "scratch", "creation-eval-"))
  console.log(`[准备] 临时沙盒已创建：${tempDir}`)

  // 2. 选择题材并初始化项目
  const title = "纳米金属丝刺绣"
  const idea = "刺绣"
  const totalChapters = 3

  const created = await core.createManagedAutonomousProject({
    rootDir: tempDir,
    title,
    idea,
    totalChapters,
    chapterWordTarget: 2500,
  })

  const projectId = created.project.id
  console.log(`[初始化] 成功建立 Managed 项目。Project ID: ${projectId}`)

  // 3. 将创作模式初始设置为 "semi" (半自动共创)
  console.log("[配置] 设置模式为：🤝 半自动共创模式")
  await studio.handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/autopilot/mode",
    { projectId, autoMode: "semi" },
    { projectId }
  )

  // 4. 模拟触发 Autopilot 开始创作任务
  console.log("[启动] 触发 Autopilot 开始创作任务...")
  const startRes = await studio.handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/autopilot/start",
    { projectId },
    { projectId }
  )
  
  let currentSnapshot = startRes.payload
  console.log(`[启动] 任务已登记。初始阶段：${currentSnapshot?.state?.runtime?.stage || "未知"}`)

  // 5. 开启评估大循环
  let loopCount = 0
  const maxLoops = 80 
  let finished = false
  
  // 防重复审批哨兵
  let approvedStages = new Set() 

  while (loopCount < maxLoops && !finished) {
    loopCount++
    console.log(`\n--- 轮询步数 #${loopCount} ---`)

    // 唤醒一次后台工坊任务 (非阻塞式)
    await worker.runNovelAutopilotWorkerOnce(tempDir)

    // 获取当前最新快照
    const statusRes = await studio.handleNovelStudioApi(
      tempDir,
      "GET",
      `/api/status?projectId=${projectId}`,
      {},
      { projectId }
    )
    currentSnapshot = statusRes.payload

    const state = currentSnapshot?.state
    const runtime = state?.runtime || {}
    const autopilot = runtime.autopilot || {}
    const stage = runtime.stage
    const running = autopilot.running
    const lastStep = autopilot.lastStep
    const statusMessage = autopilot.statusMessage || ""

    console.log(`[状态] 阶段: ${stage} | Autopilot 运行: ${running} | 步骤: ${lastStep}`)
    if (statusMessage) {
      console.log(`[消息] ${statusMessage}`)
    }

    // 检查是否已完成
    if (stage === "complete") {
      console.log("\n==============================================")
      console.log("🏆【创作成功】全书所有章节已成功写作并质检通过，全流程跑通！")
      console.log("==============================================")
      finished = true
      break
    }

    // 检验双模共创下的半自动拦截暂停
    if (!running && lastStep === "semi_auto_paused") {
      // 只有当我们没有为此阶段发送过 "继续" 指令时，才去发送
      const approvalKey = `${stage}:${lastStep}`
      if (!approvedStages.has(approvalKey)) {
        console.log(`⚠️【审阅拦截】工作流已暂停在阶段: [${stage}]，等待人工确认。`)
        
        // 读取当前的讨论共识
        const consensusText = currentSnapshot.consensus || "（无）"
        console.log("[共识内容预览]:")
        console.log("----------------------------------------------")
        console.log(consensusText.slice(0, 150).trim() + (consensusText.length > 150 ? "\n...(后略)" : ""))
        console.log("----------------------------------------------")

        // 模拟用户确认：发送 "继续" 唤醒
        console.log(`[用户决策] 模拟审批推进阶段 [${stage}]...`)
        approvedStages.add(approvalKey)
        await studio.handleNovelStudioApi(
          tempDir,
          "POST",
          "/api/autopilot/start",
          { message: "继续", projectId },
          { projectId }
        )
        console.log("[用户决策] '继续' 指令已发出，等待后台 worker 线程处理中。")
      } else {
        console.log(`[等待] 已发送过该阶段的 [继续] 指令，正在等待后台 worker 消化与状态更新...`)
      }
    }

    // 每次轮询至少留足后台线程计算与写数据库的物理时间 (1.5秒)
    await delay(1500)
  }

  // 停止后台任务并清理
  console.log("\n[停止] 正在安全关停后台 worker 守护任务...")
  await studio.handleNovelStudioApi(
    tempDir,
    "POST",
    "/api/autopilot/stop",
    { projectId },
    { projectId }
  )

  // 清除临时目录
  try {
    // await fs.rm(tempDir, { recursive: true, force: true })
    console.log(`[清理] 保留临时沙盒以供排查。`)
  } catch (e) {
    // 若占用可以温和忽略
  }

  console.log("=== 流程评估结束 ===")
  process.exit(0)
}

run().catch((err) => {
  console.error("评估中发生异常错误:", err)
  process.exit(1)
})
