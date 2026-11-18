import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin/tool"
import {
  createManagedAutonomousProject,
  formatStatus,
  listAutonomousProjects,
  loadAutonomousState,
  resolveManagedProjectRoot,
} from "ai-novel-core"

export const AINovelFactoryPlugin: Plugin = async () => {
  return {
    tool: {
      "novel-init": tool({
        description: "Official AI Novel Factory production initializer. Creates or reports a managed workspace backed by the factory DB, .ai-novel artifacts, durable jobs, messages, memory, and Super Graph.",
        args: {
          idea: tool.schema.string().optional().describe("Novel seed idea. If omitted, a default autonomous project seed is used."),
          title: tool.schema.string().optional().describe("Novel title."),
          chapters: tool.schema.number().int().positive().optional().describe("Total chapter count (default: 24)."),
          chapterWords: tool.schema.number().int().min(2500).optional().describe("Target words per chapter (default: 2500)."),
        },
        async execute(args, context) {
          const path = await import("node:path")
          const rootDir = context.directory
          const totalChapters = args.chapters ?? 24
          const chapterWordTarget = args.chapterWords ?? 2500
          const idea = args.idea?.trim() || "一个需要在自主创作流程中逐步收敛设定、规划并完成长篇小说的项目。"

          const existingProjects = await listAutonomousProjects(rootDir)
          if (existingProjects.length > 0) {
            const active = existingProjects[0]
            const projectRoot = await resolveManagedProjectRoot(rootDir, active.id)
            const state = await loadAutonomousState(projectRoot)
            return `✅ 检测到已有生产版 AI Novel Factory 项目

📌 项目: ${active.title}
🆔 Project ID: ${active.id}
📁 项目目录: ${projectRoot}
🗄️ 数据库: ${path.join(rootDir, ".ai-novel-factory", "factory.sqlite")}

${formatStatus(state)}

🎯 下一步:
- 使用 novel-status 查看连续进度
- 通过 Web/Desktop/API 继续讨论、推进和自动写作
- 所有状态以 factory DB 为准；.ai-novel/state.json 仅作为 artifact/cache`
          }

          const { project, state } = await createManagedAutonomousProject({
            rootDir,
            idea,
            title: args.title,
            totalChapters,
            chapterWordTarget,
          })

          return `✅ 已创建生产版 AI Novel Factory 托管项目

📌 项目: ${project.title}
🆔 Project ID: ${project.id}
📁 项目目录: ${project.projectRoot}
🗄️ 数据库: ${path.join(rootDir, ".ai-novel-factory", "factory.sqlite")}
🧩 Super Graph: factory DB graph_nodes/graph_edges 优先；文件图作为 artifact/cache 保留

${formatStatus(state)}

🎯 现在的流程:
1. 讨论写入 messages、agent_turns、transcript、consensus、context packet、memory 和 factory DB。
2. 工作流状态从 API/DB 快照读取，UI 和插件只渲染投影。
3. 后续推进请使用 Web/Desktop/API 或 ai-novel CLI 的 chat/advance/tui/autopilot。`
        },
      }),

      "novel-status": tool({
        description: "Official AI Novel Factory production status checker. Reports managed project state from the factory DB and .ai-novel artifacts.",
        args: {
          projectId: tool.schema.string().optional().describe("Managed project id. Defaults to the first registered project."),
        },
        async execute(args, context) {
          const path = await import("node:path")
          const rootDir = context.directory
          const projects = await listAutonomousProjects(rootDir)

          if (projects.length === 0) {
            return `❌ 尚未初始化 AI Novel Factory 生产版项目。

请先运行 novel-init，并传入 idea/title/chapters 等参数。

当前生产架构只支持托管项目:
- .ai-novel-projects/ 项目注册表
- .ai-novel-factory/factory.sqlite 主事实源
- 每个项目内的 .ai-novel/ artifacts/cache`
          }

          const project = args.projectId
            ? projects.find((entry) => entry.id === args.projectId)
            : projects[0]

          if (!project) {
            return `❌ 未找到生产版 AI Novel Factory 项目: ${args.projectId}

可用项目:
${projects.map((entry) => `- ${entry.id}: ${entry.title}`).join("\n")}`
          }

          const projectRoot = await resolveManagedProjectRoot(rootDir, project.id)
          const state = await loadAutonomousState(projectRoot)
          const checkpointPath = state.runtime.autopilot?.checkpointPath || "none"
          const autopilot = state.runtime.autopilot

          return `✅ AI Novel Factory 生产版项目状态
==================================================

📌 项目: ${project.title}
🆔 Project ID: ${project.id}
📁 项目目录: ${projectRoot}
🗄️ 数据库: ${path.join(rootDir, ".ai-novel-factory", "factory.sqlite")}
🧩 Super Graph: factory DB graph_nodes/graph_edges 优先；文件图作为 artifact/cache 保留

${formatStatus(state)}

🤖 Autopilot:
- running: ${Boolean(autopilot?.running)}
- mode: ${autopilot?.mode || "idle"}
- target: ${autopilot?.target || "none"}
- drift: ${autopilot?.driftStatus || "ok"} / ${autopilot?.driftScore ?? 0}
- checkpoint: ${checkpointPath}

🎯 下一步:
- 继续讨论: 使用 Web/Desktop/API 或 ai-novel chat
- 推进流程: 使用 ai-novel advance 或 Web/Desktop 的工作流控制
- 无人值守: 使用 API autopilot 入口持续运行，状态会写入 DB 与 .ai-novel artifacts`
        },
      }),
    },
  }
}

export default AINovelFactoryPlugin
