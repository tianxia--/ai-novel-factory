# OpenCode AI Novel Factory

A complete AI novel writing system plugin for OpenCode.

## Features

- Multi-Agent collaborative writing
- Semi-automated chapter generation
- Automatic memory maintenance
- Long-form serialized writing support
- Commercial-grade writing structure

Can stably support 100+ chapters of creation.

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

然后让 AI 助手自动配置：

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
