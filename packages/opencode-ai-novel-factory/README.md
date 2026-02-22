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

### Method 1: npm (Recommended)

```bash
npm install -g opencode-ai-novel-factory
```

Or add to your project:

```bash
npm install opencode-ai-novel-factory
```

Then add to your `opencode.json`:

```json
{
  "plugin": ["opencode-ai-novel-factory"]
}
```

### Method 2: Local Installation

Clone the repository:

```bash
git clone https://github.com/tianxia--/ai-novel-factory.git
```

Add to your `opencode.json`:

```json
{
  "plugin": ["./path/to/ai-novel-factory/packages/opencode-ai-novel-factory"]
}
```

## Quick Start

### 1. Initialize Project

In OpenCode, run:

```
@novel-init
```

Or manually create the directory structure:

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

Fill in the following files in order:

1. `studio/story/world.md` - World settings
2. `studio/story/master_outline.md` - Main story outline
3. `studio/characters/protagonist.md` - Protagonist settings
4. `studio/style/*.md` - Style guides (optional)

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
