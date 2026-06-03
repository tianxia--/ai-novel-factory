# OpenCode AI Novel Factory

A complete AI novel writing system plugin for OpenCode.

## Features

- Multi-Agent collaborative writing
- Semi-automated chapter generation
- Automatic memory maintenance
- Long-form serialized writing support
- Commercial-grade writing structure
- Autonomous CLI workspace for long-running novel orchestration

Can stably support 100+ chapters of creation.

## Autonomous CLI MVP

The package now includes a first-pass `ai-novel` CLI for stateful novel orchestration outside the OpenCode skill flow.

### What it does now

- Initializes a `.ai-novel/` workspace from a single story idea
- Persists project state, ReAct setup notes, and chapter task queue
- Stores reusable OpenAI-compatible LLM provider settings for the workspace
- Reports runtime status with pending chapter counts
- Reviews user interruptions and decides whether the change is local or requires replanning
- Prepares asset planning files for cover generation and future comic adaptation
- Seeds global consensus, style assets, and per-agent prompt layers
- Runs a visible multi-agent discussion loop through a chat command
- Shows provider configuration state in the TUI and can test provider reachability

### What it does not do yet

- It does not run a background autonomous worker yet
- It does not draft all chapters end-to-end yet
- It does not generate final cover images or comic pages yet

### CLI commands

```bash
ai-novel init --idea "A fallen sword immortal rebuilds heaven's order" --chapters 48 --chapter-words 3200
ai-novel status
ai-novel chat --message "The protagonist should sound colder, but still carry hidden obsession"
ai-novel advance
ai-novel cover
ai-novel provider-test
ai-novel tui
ai-novel interrupt --message "Change the entire genre to cyberpunk and rewrite the core world rules"
```

Chapter length is configurable, but the minimum is locked at `2500` words. If you omit `--chapter-words`, the CLI defaults to `2500`.

### Workspace layout

```text
.ai-novel/
├── config.json
├── chat/
│   └── discussion-log.md
├── state.json
├── assets/
│   ├── comic/
│   │   └── comic-plan.md
│   └── cover/
│       └── cover-brief.md
│       └── cover-prompt.md
├── chapters/
├── memory/
│   └── characters/
│       ├── core/
│       │   └── protagonist.md
│       ├── evolution.md
│       └── relations.md
├── plans/
│   ├── chapter-blueprints/
│   └── plan-and-solve-brief.md
│   └── setting-freeze.md
├── prompts/
│   ├── agents/
│   │   ├── author.base.md
│   │   ├── author.dynamic.md
│   │   └── ...
│   └── global-consensus.md
└── style/
    ├── anti-patterns.md
    ├── profile.md
    ├── references.md
    └── rulebook.md
├── reports/
    └── interruptions.log.md
└── prompts/
    └── react-worldbuilding.md
```

This is the execution backbone for the next stage, where ReAct discussion, Plan-and-Solve outlining, and full chapter generation can be wired into the same persistent workflow.

### TUI mode

Run `ai-novel tui` to open a terminal dashboard for the active project. The current MVP supports:

- live status view for stage, chapter count, word target, cover, and comic state
- story memory and workflow control panels
- recent multi-agent discussion transcript
- live streamed agent replies while a discussion is in progress
- a pending chapter task list
- a bottom composer that accepts direct chat input
- `Enter` to send the current composer content
- slash commands such as `/advance`, `/cover`, `/provider-test`, `/interrupt ...`
- `/env base_url=... model=... api_key=...` to update provider settings inline
- `Ctrl+C` or `Esc` to quit

### Multi-agent prompt layering

Each role has two prompt layers:

- `*.base.md`: short identity and responsibility prompt that should stay stable
- `*.dynamic.md`: evolving role memory that gets refreshed as the project changes

All agents also read `prompts/global-consensus.md`, which acts as the shared novel truth source. This is the backbone for keeping the author, editor, reviewer, world architect, prose stylist, and showrunner aligned over longer runs.

### `.env` configuration

The CLI reads provider settings from the current working directory's `.env` file. Start from the included template:

```bash
cp packages/opencode-ai-novel-factory/.env.example .env
```

Supported keys:

- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL_ID`
- `LLM_TIMEOUT_MS`
- `LLM_TEMPERATURE`
- `MAX_STEPS`
- `NOVEL_CHAPTER_WORD_TARGET`

After `.env` is present, you can validate it either from the CLI:

```bash
ai-novel provider-test
```

or from the TUI with the `t` key. The right rail will show whether provider config is complete, which model is active, and the latest connectivity result.
or from the TUI composer with:

```text
/provider-test
```

The workflow panel shows whether provider config is complete, which model is active, and the latest connectivity result.

### Shared Web/Desktop studio

The repo now also includes a shared frontend shell under [apps/desktop](/Users/pengfei.chen/Desktop/gitlabWork/ai-novel-factory/apps/desktop) that uses the same orchestration core as the CLI and TUI.

Run the web studio from the package directory:

```bash
npm run build
npm run studio:web
```

Then open:

```text
http://127.0.0.1:4310
```

What works now:

- starts from a project manager view instead of assuming a single active novel
- creates isolated novel projects under `.ai-novel-projects/<project-id>/`
- opens a creation modal for title, core idea, chapter count, and chapter word target
- automatically runs the first autonomous kickoff discussion after project creation
- loads real project workspace state through the local API
- streams multi-agent discussion replies into the center chat area
- keeps one transcript/history per novel project
- triggers real `/advance`, `/cover`, `/provider-test`, `/interrupt`, and provider env update flows
- renders chapter tasks, workflow stage, and story memory from the same persisted state used by the CLI
- defaults discussion output to Simplified Chinese and keeps the discussion constrained to the active workflow stage

Desktop status:

- `apps/desktop/src-tauri/` now contains a Tauri v2 scaffold
- this machine does **not** have `rustc`, `cargo`, or the Tauri CLI installed yet
- the desktop shell is scaffolded, but local `tauri dev` is not runnable until the Rust/Tauri toolchain is installed

### Planning chain

Once you have at least one meaningful discussion turn, repeated `/advance` calls now move the project through a real chain:

1. `worldbuilding_dialogue -> setting_review`
   Generates `setting-freeze.md` using persisted discussion consensus, protagonist notes, and style updates.
2. `setting_review -> master_planning`
   Generates `master-outline.md` using the same discussion-backed direction.
3. `master_planning -> chapter_task_generation`
   Generates chapter blueprints under `.ai-novel/plans/chapter-blueprints/`.
4. `chapter_task_generation -> drafting`
   Generates rolling chapter drafts under `.ai-novel/chapters/`, one chapter per advance.

This means the TUI and CLI no longer stop at generic placeholder planning; discussion artifacts now feed directly into the planning and drafting pipeline.

### Multi-project layout

The web/desktop studio now treats each novel as its own managed project:

```text
.ai-novel-projects/
├── my-first-novel/
│   └── .ai-novel/
├── palace-revenge/
│   └── .ai-novel/
└── projects.json
```

`projects.json` acts as the registry for the Studio manager page. Each project gets:

- its own state machine
- its own discussion transcript
- its own consensus and memory files
- its own chapter queue and draft outputs

This avoids mixing history, settings, and generated artifacts across different books.

## Installation

### 🤖 AI 引导式完整安装（强烈推荐）

在 OpenCode 中说一句话：

```
请帮我安装和配置完整的 AI Novel Factory
```

AI 将引导你完成：
1. ✅ 环境检查（Node.js/npm）
2. ✅ 插件安装（npm）
3. ✅ OpenCode 配置（opencode.json）
4. ✅ 项目初始化（可选）
5. ✅ 世界观创建（可选）

或者直接运行完整安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/ai-guided-complete-install.sh | bash
```

### 🚀 一键项目安装

在 OpenCode 中运行：

```
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-inline.sh | bash
```

安装完成后，插件会自动配置 `opencode.json` 文件，无需手动操作。

### 📦 标准 npm 安装

```bash
npm install -g opencode-ai-novel-factory
```

然后在你的小说项目目录里基于 `.env.example` 创建 `.env`，填写自己的模型配置：

```bash
cp /path/to/opencode-ai-novel-factory/packages/opencode-ai-novel-factory/.env.example .env
```

再让 AI 助手自动配置：

```
请帮我配置 opencode.json 添加 opencode-ai-novel-factory 插件
```

### 🛠️ 手动配置

如果需要手动配置，在 `opencode.json` 中添加：

```json
{
  "plugin": ["opencode-ai-novel-factory"]
}
```

### 🔧 单独配置脚本

运行专门的配置脚本（AI 可引导用户执行）：

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash
```

### 📁 本地开发安装

克隆仓库：

```bash
git clone https://github.com/tianxia--/ai-novel-factory.git
```

在 `opencode.json` 中配置本地路径：

```json
{
  "plugin": ["./path/to/ai-novel-factory/packages/opencode-ai-novel-factory"]
}
```

## Quick Start

### 1. Initialize Project

🤖 **让 AI 助手引导你完成初始化**：

在 OpenCode 中输入：

```
请帮我初始化 AI 小说工厂项目
```

AI 助手将自动：
1. 创建完整的目录结构
2. 生成所有必要的模板文件
3. 引导你填写核心设定

或者手动运行：

```
@novel-init
```

手动创建目录结构：

```
studio/
├── agents/
├── automation/
├── memory/
├── story/
├── characters/
├── style/
├── production/chapters/
└── state/
```

### 2. Fill in Basic Settings

🤖 **让 AI 助手引导你填写设定**：

在 OpenCode 中输入：

```
请帮我创建小说的世界观设定
```

AI 助手将引导你逐步填写：

1. `studio/story/world.md` - 世界观设定
2. `studio/story/master_outline.md` - 主线大纲
3. `studio/characters/protagonist.md` - 主角设定
4. `studio/style/*.md` - 文风指南（可选）

或者按顺序手动填写上述文件。

### 3. Start Writing

```
@daily_pipeline
```

## Available Agents

| Agent | Purpose |
|-------|---------|
| `@story_architect` | Create world-building |
| `@volume_planner` | Generate volume outline |
| `@writer` | Write chapter content |
| `@editor` | Quality review |
| `@memory_keeper` | Maintain memory system |

## Available Skills

| Skill | Purpose |
|-------|---------|
| `@daily-pipeline` | One-click chapter generation |

## Available Tools

| Tool | Purpose |
|------|---------|
| `novel-init` | Initialize project structure |
| `novel-chapter` | Generate new chapter |
| `novel-memory-update` | Update memory files |
| `novel-consistency-check` | Check consistency |
| `novel-status` | Show project status |

## Directory Structure

```
studio/
├── agents/              # Agent definitions
├── automation/          # Automation configs
├── memory/              # Memory system (core)
│   ├── canon.md              # Core settings (unbreakable)
│   ├── world_rules.md        # World rules
│   ├── characters_evolution.md # Character growth log
│   └── foreshadowing.md      # Foreshadowing tracking
├── story/               # Story outlines
│   ├── world.md             # World settings
│   └── master_outline.md    # Main outline
├── characters/          # Character settings
│   ├── protagonist.md       # Protagonist
│   └── character_template.md # Character template
├── style/               # Style control
│   ├── tone.md              # Overall tone
│   ├── rhythm.md            # Sentence rhythm
│   └── dialogue.md          # Dialogue style
├── production/          # Output directory
│   └── chapters/            # Chapter content
└── state/               # State management
    ├── current_chapter.txt   # Current chapter number
    └── pipeline_config.txt   # Pipeline configuration
```

## Memory System

The memory system is the core stabilizer for long-form writing:

- **canon.md**: Unchangeable core settings
- **world_rules.md**: Expandable but bounded rules
- **characters_evolution.md**: Character growth tracking
- **foreshadowing.md**: Foreshadowing management

## Anti-Collapse Strategies

To ensure long-form stability:

- **Power Control**: Cannot break world_rules upper limit
- **Character Protection**: Behavior must match growth trajectory
- **Timeline Validation**: Update logical timeline each chapter
- **Foreshadowing Tracking**: All unresolved foreshadowing must be recorded

## Workflow

### Daily Creation

```
@daily_pipeline
```

This automatically:
1. Analyzes recent chapters
2. Generates next chapter plan
3. Writes chapter content
4. Checks style consistency
5. Updates memory system

### Quality Control

Every 5 chapters, run:

```
@editor [chapter range]
```

## Configuration

Edit `studio/state/pipeline_config.txt`:

```
target_word_count=2500
auto_skip_check=false
auto_memory_update=true
max_continuous_chapters=5
quality_threshold=7
style_check=true
consistency_check=true
```

## License

MIT

## Author

tianxia--

## Links

- [GitHub](https://github.com/tianxia--/ai-novel-factory)
- [OpenCode](https://opencode.ai)
