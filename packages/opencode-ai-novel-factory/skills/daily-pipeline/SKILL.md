---
name: daily-pipeline
description: One-click novel chapter generation pipeline - reads context, plans chapter, writes content, checks quality, updates memory
license: MIT
compatibility: opencode
metadata:
  category: writing
  workflow: automated
---

# Daily Pipeline

Complete automated chapter generation workflow.

## What I Do

1. **Read Current State**
   - Load `studio/state/current_chapter.txt`
   - Determine next chapter number

2. **Load Context**
   - `studio/story/world.md` - World settings
   - `studio/story/master_outline.md` - Story outline
   - `studio/memory/canon.md` - Core settings
   - Recent 2-3 chapters from `studio/production/chapters/`
   - `studio/characters/protagonist.md` - Main character
   - `studio/style/*.md` - Style guides

3. **Plan Chapter**
   - Generate chapter structure
   - Define core events
   - Plan emotional arc
   - Design hooks

4. **Write Chapter**
   - Execute chapter plan
   - Target 2000-3000 words
   - Maintain style consistency
   - End with hook

5. **Quality Check**
   - Style consistency
   - Setting consistency
   - Character consistency

6. **Update Memory**
   - Record new settings
   - Track character changes
   - Update foreshadowing

7. **Save Output**
   - Write to `studio/production/chapters/Chapter_X_[Title].md`
   - Update `studio/state/current_chapter.txt`

## Usage

```
@daily_pipeline
```

Or ask:
```
Generate the next chapter for my novel
```

## Prerequisites

Before using, ensure these files exist and are filled in:
- `studio/story/world.md`
- `studio/story/master_outline.md`
- `studio/characters/protagonist.md`

## Configuration

Edit `studio/state/pipeline_config.txt` to customize:

```
target_word_count=2500
auto_skip_check=false
auto_memory_update=true
max_continuous_chapters=5
quality_threshold=7
style_check=true
consistency_check=true
```

## Output

Returns:
- Generated chapter file path
- Chapter summary
- Any warnings or suggestions
- Memory updates made
