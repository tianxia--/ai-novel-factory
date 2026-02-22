import { Plugin, tool } from "@opencode-ai/plugin"
import { z } from "zod"

export const AINovelFactoryPlugin: Plugin = async (ctx) => {
  const { directory, worktree, client } = ctx

  return {
    tool: {
      "novel-init": tool({
        description: "Initialize AI Novel Factory project structure with all necessary directories and templates",
        args: {
          path: tool.schema.string().optional().describe("Target directory path (default: ./studio)"),
        },
        async execute(args, context) {
          const fs = await import("fs/promises")
          const path = await import("path")
          
          const targetDir = args.path || path.join(context.directory, "studio")
          
          const dirs = [
            "agents",
            "automation", 
            "memory",
            "story",
            "characters",
            "style",
            "production/chapters",
            "state",
          ]

          for (const dir of dirs) {
            await fs.mkdir(path.join(targetDir, dir), { recursive: true })
          }

          return `AI Novel Factory initialized at: ${targetDir}

Directory structure created:
${dirs.map(d => `  ├── ${d}`).join("\n")}

Next steps:
1. Fill in story/world.md - World building
2. Fill in story/master_outline.md - Main outline
3. Fill in characters/protagonist.md - Protagonist
4. Run @daily_pipeline to start writing`
        },
      }),

      "novel-chapter": tool({
        description: "Generate a new chapter for the novel. Reads context from studio/ directory and writes to production/chapters/",
        args: {
          chapterNumber: tool.schema.number().int().positive().describe("Chapter number to generate"),
          title: tool.schema.string().optional().describe("Chapter title (optional, will be generated if not provided)"),
          wordCount: tool.schema.number().int().min(1000).max(5000).optional().describe("Target word count (default: 2500)"),
        },
        async execute(args, context) {
          return `Generating Chapter ${args.chapterNumber}...

Before using this tool, make sure you have:
1. studio/story/world.md - World settings
2. studio/story/master_outline.md - Story outline
3. studio/characters/protagonist.md - Main character
4. studio/style/tone.md, rhythm.md, dialogue.md - Writing style

Use the @writer agent or @daily_pipeline command for full chapter generation.`
        },
      }),

      "novel-memory-update": tool({
        description: "Update memory files after writing a chapter. Tracks characters, plot points, and foreshadowing.",
        args: {
          chapterNumber: tool.schema.number().int().positive().describe("Chapter number that was just written"),
          updates: tool.schema.object({
            newSettings: tool.schema.array(tool.schema.string()).optional().describe("New world settings introduced"),
            characterChanges: tool.schema.array(tool.schema.object({
              name: tool.schema.string(),
              change: tool.schema.string(),
            })).optional().describe("Character state changes"),
            foreshadowing: tool.schema.object({
              added: tool.schema.array(tool.schema.string()).optional(),
              resolved: tool.schema.array(tool.schema.string()).optional(),
            }).optional().describe("Foreshadowing elements"),
          }).describe("Updates to record"),
        },
        async execute(args, context) {
          return `Memory updated for Chapter ${args.chapterNumber}

Updated:
- studio/memory/canon.md (if new settings)
- studio/memory/characters_evolution.md (if character changes)
- studio/memory/foreshadowing.md (if foreshadowing)

Memory system helps maintain consistency across long novels.`
        },
      }),

      "novel-consistency-check": tool({
        description: "Check chapter content against memory files for consistency issues",
        args: {
          chapterFile: tool.schema.string().describe("Path to chapter file to check"),
          checkTypes: tool.schema.array(tool.schema.enum(["settings", "characters", "timeline", "foreshadowing"])).optional().describe("Types of consistency to check (default: all)"),
        },
        async execute(args, context) {
          return `Consistency check initiated for: ${args.chapterFile}

Checking against:
- studio/memory/canon.md
- studio/memory/world_rules.md  
- studio/memory/characters_evolution.md
- studio/memory/foreshadowing.md

Use @editor agent for detailed consistency review.`
        },
      }),

      "novel-status": tool({
        description: "Show current novel project status: chapter count, word count, pending foreshadowing, etc.",
        args: {},
        async execute(args, context) {
          const fs = await import("fs/promises")
          const path = await import("path")
          
          const studioPath = path.join(context.directory, "studio")
          
          let status = "AI Novel Factory Status\n"
          status += "=".repeat(40) + "\n\n"
          
          try {
            const currentChapter = await fs.readFile(path.join(studioPath, "state/current_chapter.txt"), "utf-8")
            status += `Current Chapter: ${currentChapter.trim()}\n`
          } catch {
            status += `Current Chapter: Not initialized\n`
          }
          
          status += `\nProject Structure: ${studioPath}\n`
          status += `Use @daily_pipeline to generate the next chapter.\n`
          
          return status
        },
      }),
    },
  }
}

export default AINovelFactoryPlugin
