# Training Workflow Guide

> Complete guide for training and optimizing your novel writing agent

---

## Overview

Before formal writing, use the training workflow to calibrate the AI to your preferred style.

## Training Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    TRAINING WORKFLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Phase 1: STYLE LEARNING                                     │
│  ├─ Collect reference texts (your favorite works)           │
│  ├─ @style_learner to analyze style                         │
│  └─ Generate initial style guide                            │
│                                                              │
│  Phase 2: SAMPLE GENERATION                                  │
│  ├─ Define test scenarios                                   │
│  ├─ @sample_chapter to generate samples                     │
│  └─ Create multiple variants for comparison                 │
│                                                              │
│  Phase 3: ITERATION                                          │
│  ├─ Review and rate samples                                 │
│  ├─ @style_iterator to refine parameters                    │
│  ├─ Generate new samples with adjustments                   │
│  └─ Repeat until satisfied                                  │
│                                                              │
│  Phase 4: VALIDATION                                         │
│  ├─ @quality_evaluator for objective assessment             │
│  ├─ Verify scores meet threshold                            │
│  └─ Final approval                                          │
│                                                              │
│  Phase 5: LOCK & PUBLISH                                     │
│  ├─ Lock final style parameters                             │
│  ├─ Update style/ directory                                 │
│  └─ Ready for @daily_pipeline                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Style Learning

### Collect Reference Materials

Gather texts that represent your target style:
- Favorite author's works
- Genre classics
- Style examples you want to emulate

Recommended: 5,000+ words per style reference

### Run Style Analysis

```
@style_learner my_style ./reference/my_favorite_novel.txt
```

### Review Output

Check `training/learned_style_my_style.md`:
- Verify sentence patterns match expectations
- Check dialogue style
- Review rhetorical preferences
- Adjust manually if needed

---

## Phase 2: Sample Generation

### Define Test Scenarios

Create diverse test cases:

| Scenario | Purpose |
|----------|---------|
| Opening | Test first chapter hook |
| Dialogue | Test character voice |
| Action | Test pacing and tension |
| Emotion | Test psychological depth |
| World | Test setting integration |

### Generate Samples

Single scene:
```
@sample_chapter "Protagonist meets mysterious stranger in tavern"
```

Multiple variants:
```
@sample_chapter --variants=3 "Opening scene: hero wakes up in unknown place"
```

Batch test:
```
@sample_chapter --batch
```

---

## Phase 3: Iteration

### Review Samples

For each sample, rate:
- Narrative fluency: /10
- Style match: /10
- Character voice: /10
- Pacing: /10
- Overall: /10

### Identify Issues

Common patterns:
- "Dialogue feels robotic" → Adjust dialogue_ratio
- "Too slow" → Increase action_ratio
- "Lacks emotion" → Increase emotional_intensity
- "Endings fall flat" → Strengthen chapter_hook

### Iterate

```
@style_iterator analyze
```

Review suggested adjustments, then:

```
@style_iterate
```

### Track Progress

```
@style_iterator history
```

View improvement over iterations.

---

## Phase 4: Validation

### Quality Check

```
@quality_evaluator --detailed training/samples/sample_latest.md
```

### Score Thresholds

| Dimension | Minimum | Target |
|-----------|---------|--------|
| Narrative | 7 | 8+ |
| Character | 7 | 8+ |
| Style | 7 | 8+ |
| Engagement | 7 | 8+ |
| Overall | 7.5 | 8+ |

If below threshold, return to Phase 3.

---

## Phase 5: Lock & Start

### Lock Style

```
@style_iterator lock
```

This updates:
- `style/tone.md`
- `style/rhythm.md`
- `style/dialogue.md`

### Start Writing

```
@daily_pipeline
```

---

## Directory Structure

```
training/
├── learned_style_*.md      # Learned style guides
├── samples/                # Generated samples
│   ├── sample_001_*.md
│   ├── sample_002_*.md
│   └── ...
├── iterations/             # Iteration history
│   ├── iteration_001.md
│   ├── iteration_002.md
│   └── ...
└── reference/              # Your reference texts
    └── (your uploaded files)
```

---

## Tips

1. **Be specific in feedback** - "Make it more exciting" vs "Increase action_ratio and add more short sentences during combat"

2. **Test multiple scenarios** - Don't just test one type of scene

3. **Save good samples** - Keep examples that work well for reference

4. **Trust your judgment** - If it feels right, it probably is

5. **Take breaks** - Review with fresh eyes

---

## Quick Commands

| Command | Purpose |
|---------|---------|
| `@style_learner [text]` | Learn style from reference |
| `@sample_chapter [scene]` | Generate test chapter |
| `@style_iterate` | Refine based on feedback |
| `@style_iterator lock` | Lock style for writing |
| `@quality_evaluator [file]` | Evaluate quality |

---

Ready to start training? Begin with:

```
@style_learner [your reference text]
```
