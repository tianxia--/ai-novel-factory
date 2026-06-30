# Production Novel Factory Redesign

Date: 2026-06-25

## Goal

Upgrade new-novel creation from a loose discussion-to-draft flow into a production-grade long-form novel factory.

The target is not to promise perfect prose from one model call. The target is to make weak setup, thin characters, unclear plot, broken foreshadowing, context overflow, and unapproved writing style unable to pass the workflow gates.

## Source-Level References

This plan is based on source-level review of these projects:

- `YILING0013/AI_NovelGenerator`
- `PenglongHuang/chinese-novelist-skill`
- `ExplosiveCoderflome/AI-Novel-Writing-Assistant`
- `t59688/arboris-novel`

### Mechanisms To Adopt

#### AI_NovelGenerator

Adopt these concrete mechanisms:

- Recoverable architecture generation:
  - `core_seed`
  - `character_dynamics`
  - initial `character_state`
  - `world_building`
  - `plot_architecture`
  - persisted partial state similar to `partial_architecture.json`
- Structured chapter directory fields:
  - chapter role
  - chapter purpose
  - suspense density
  - foreshadowing operation
  - plot twist or cognitive subversion level
  - chapter summary
- Chapter context assembly:
  - global summary
  - character state
  - last three chapters
  - previous chapter ending excerpt
  - current and next chapter directory entries
  - vector retrieval
  - knowledge filtering
  - near-chapter reuse rules
- Finalization closure:
  - update global summary
  - update character state
  - update vector store
  - write artifacts atomically

#### chinese-novelist-skill

Adopt these concrete mechanisms:

- Phase state machine:
  - initialization and resume detection
  - layered concept questions
  - planning and second confirmation
  - writing mode selection
  - serial or batched writing
  - automatic validation and repair
- File protocol:
  - character dossier
  - outline
  - writing plan JSON
- Writing plan coordination:
  - per-chapter status
  - retry count
  - word count
  - writing mode
  - interruption resume
- Chapter execution discipline:
  - read outline before every chapter
  - read relevant character profiles before every chapter
  - mark chapter `in_progress`
  - opening hook
  - immediate conflict
  - at least two tension peaks
  - dialogue target
  - unexpected turn
  - ending hook
  - word-count check
  - anti-AI polishing
  - append chapter summary
  - mark completed only after checks

#### AI-Novel-Writing-Assistant

Adopt these concrete mechanisms:

- Agent/tool registry for production actions:
  - generate world
  - generate characters
  - generate story bible
  - generate structured outline
  - sync chapters
  - start full pipeline
  - get production status
  - each tool carries risk level, approval policy, and resource scopes
- Production status projection:
  - workspace
  - world
  - story macro
  - book contract
  - characters
  - story bible
  - volume strategy
  - structured outline
  - chapter task sheets
  - chapter drafts
  - quality repair
  - state commit
  - background task
- Chapter execution contract:
  - target word count
  - conflict level
  - reveal level
  - must-avoid list
  - task sheet
  - scene cards
  - style contract
  - shape gate plus semantic gate
- World management boundary:
  - world stores full possibility space
  - a book activates only a slice
  - chapter generation receives active world slice, not full world encyclopedia
- Runtime safety:
  - director task snapshots
  - workspace analyzer
  - recovery hints
  - stale artifact detection
  - approval gates

#### Arboris Novel

Adopt these concrete mechanisms:

- Database shape:
  - novel blueprint
  - blueprint characters
  - blueprint relationships
  - chapter outlines
  - chapters
  - chapter versions
  - chapter evaluations
  - selected version
- Prompt assets:
  - checklist-driven concept dialogue
  - 12341234 narrative cycle
  - ChapterMission
  - strict limited POV
  - character entrance protocol
  - novel constitution
  - six-dimension review
  - foreshadowing health
  - faction context
  - character DNA
- Writer context builder:
  - remove future chapter details from prompt
  - hide forbidden character names
  - include only introduced or allowed characters
  - output forbidden character list
- Multi-version chapter workflow:
  - generate candidate versions
  - evaluate versions
  - select final version
  - summarize selected content
  - ingest selected content into vector memory

## Target Workflow

```text
phase_0_init
phase_1_concept_dialogue
phase_2_core_seed
phase_3_character_dynamics
phase_4_initial_character_state
phase_5_world_matrix
phase_6_plot_architecture
phase_7_story_bible
phase_8_volume_strategy
phase_9_chapter_blueprints
phase_10_writing_plan
phase_11_style_evolution
phase_12_style_approval
phase_13_chapter_execution
phase_14_quality_repair
phase_15_finalize_complete
```

Every phase must have:

- status
- required artifacts
- gate result
- recovery hint
- stale artifact handling
- resumable checkpoint

## Core Production Assets

### Bible

```text
.ai-novel/bible/core-seed.json
.ai-novel/bible/character-dynamics.json
.ai-novel/bible/world-matrix.json
.ai-novel/bible/plot-architecture.json
.ai-novel/bible/story-bible.json
.ai-novel/bible/story-bible.md
.ai-novel/bible/book-contract.json
.ai-novel/bible/novel-constitution.json
```

### World

```text
.ai-novel/world/world-profile.json
.ai-novel/world/world-rules.json
.ai-novel/world/world-assets.json
.ai-novel/world/world-relationships.json
.ai-novel/world/story-binding-support.json
.ai-novel/world/active-world-slices/
```

### Characters

```text
.ai-novel/memory/characters/characters.json
.ai-novel/memory/characters/character-dna.json
.ai-novel/memory/characters/character-state.json
.ai-novel/memory/characters/relationships.json
.ai-novel/memory/characters/character-knowledge.json
.ai-novel/memory/characters/character-timeline.json
```

### Plot

```text
.ai-novel/plans/plot-arcs.json
.ai-novel/plans/subplots.json
.ai-novel/plans/foreshadowing-ledger.json
.ai-novel/plans/timeline.json
.ai-novel/plans/emotion-curve.json
.ai-novel/plans/reader-payoff-plan.json
```

### Chapters

```text
.ai-novel/plans/chapter-blueprints/
.ai-novel/plans/writing-plan.json
.ai-novel/chapters/versions/
.ai-novel/reports/chapter-evaluations/
.ai-novel/checkpoints/chapter-snapshots/
```

### Style Evolution

```text
.ai-novel/style/style-seed.md
.ai-novel/style/style-evolution-history.json
.ai-novel/style/style-samples/
.ai-novel/style/style-contract.json
.ai-novel/style/style-contract.md
.ai-novel/style/anti-patterns.json
.ai-novel/style/user-approved-sample.md
```

## Writing Style Evolution Gate

The style evolution gate is mandatory before chapter execution.

### Inputs

- user style description
- optional reference text
- forbidden style patterns
- target genre/platform
- test scene target

### Loop

```text
seed style prompt
generate sample
review sample
revise style prompt
generate next sample
user approves or requests another evolution
freeze writing style contract
```

### Gate

Chapter execution is blocked unless:

- at least one style sample exists
- user-approved sample exists
- style contract exists
- anti-patterns exist
- approval timestamp exists

Blocked status:

```text
waiting_for_style_approval
```

## Chapter Blueprint Contract

Every chapter must have a machine-readable blueprint:

```json
{
  "chapterNumber": 1,
  "title": "",
  "chapterRole": "",
  "chapterPurpose": "",
  "macroBeat": "E",
  "suspenseLevel": "",
  "foreshadowingOperation": "",
  "plotTwistLevel": 1,
  "emotionTarget": "",
  "conflictLevel": 1,
  "revealLevel": 1,
  "targetWordCount": 3000,
  "mustAvoid": [],
  "allowedCharacters": [],
  "forbiddenCharacters": [],
  "allowedNewCharacters": [],
  "entranceProtocol": {
    "newCharacterStage": "rumor",
    "requiredIntroElements": []
  },
  "sceneCards": [
    {
      "index": 1,
      "goal": "",
      "conflict": "",
      "turn": "",
      "endHook": "",
      "requiredCharacters": [],
      "requiredFacts": [],
      "forbiddenFacts": []
    }
  ],
  "endingHook": "",
  "nextChapterEntryState": ""
}
```

## Writing Plan Contract

```json
{
  "version": 1,
  "novelName": "",
  "totalChapters": 0,
  "minWordsPerChapter": 3000,
  "status": "planning",
  "writingMode": "serial",
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "",
      "filePath": "",
      "status": "pending",
      "wordCount": null,
      "qualityPass": null,
      "retryCount": 0,
      "selectedVersionId": null
    }
  ]
}
```

## Chapter Context Package

Each chapter run must build and persist a context package:

- chapter blueprint
- scene cards
- writing plan row
- previous chapter summary
- previous chapter ending excerpt
- recent chapter summaries
- global summary
- character state
- allowed character roster
- forbidden character names
- active world slice
- foreshadowing reminders
- timeline constraints
- filtered RAG context
- style contract
- anti-AI rules

Rules:

- do not include full world encyclopedia
- do not include future chapter truths
- do not include forbidden character details
- do not use outline summary as real chapter summary after a chapter is finalized

## Chapter Execution Pipeline

```text
ensure chapter execution contract
build context package
generate opening hook
generate scene 1
generate scene 2
generate scene N
stitch scenes
style rewrite
anti-AI rewrite
quality review
repair loop
version selection
finalize chapter
```

## Quality Gates

### Structural Gate

- chapter title exists
- chapter objective exists
- task sheet exists
- scene cards exist
- character roster exists
- active world slice exists
- approved style contract exists

### Semantic Gate

- chapter mission executed
- macro beat respected
- conflict present
- turn present
- ending hook present
- no forbidden character leakage
- no future knowledge leakage
- character behavior matches state

### Literary Gate

- word count
- dialogue quality
- tension peaks
- pacing
- style contract compliance
- anti-AI patterns
- foreshadowing operation
- reader payoff progress

## Finalize Chapter

Finalization is mandatory before a chapter can become completed.

Updates:

- global summary
- character state
- character knowledge
- relationships
- plot arcs
- foreshadowing ledger
- timeline
- world state delta
- chapter snapshot
- vector store
- writing plan
- production status

## Production Status Projection

The UI and API should expose:

- asset stages
- assets ready
- pipeline ready
- current stage
- blocked reason
- recovery hint
- fact progress
- runtime status

Asset stages:

- novel workspace
- book world
- story macro
- book contract
- core characters
- story bible
- volume strategy
- structured outline
- chapter task sheets
- writing style approval
- chapter drafts
- quality repair
- state commit
- background task

## UI Workbench

Required pages:

- auto director
- story bible
- world management
- active world slice
- character library
- relationship graph
- foreshadowing ledger
- timeline
- volume strategy
- chapter blueprints
- writing plan
- style evolution
- chapter execution
- version comparison
- quality reports
- reader

## Model Routing

Capabilities:

- planning
- worldbuilding
- character design
- style evolution
- chapter drafting
- review
- repair
- summary
- embedding
- image

All configuration must come from UI/database provider settings, not `.env`.

## Test Plan

Core tests:

- a new novel cannot enter chapter execution without story bible
- a new novel cannot enter chapter execution without approved style contract
- incomplete character dossiers block plot planning
- incomplete chapter blueprint blocks drafting
- writing plan supports resume from `in_progress`
- finalize chapter is required before chapter completion
- forbidden characters are excluded from context package
- future chapter facts are excluded from context package
- overdue foreshadowing produces warning or blocked gate
- production status explains blocked stage and recovery hint
- multiple chapter versions do not overwrite selected final content

Evaluation runs:

- create 3 fixture novels: urban, fantasy, suspense
- generate first 10 chapters
- inspect consistency, plot progress, character arcs, foreshadowing, style drift, and AI flavor

## Implementation Phases

### Phase A: Contracts And Status Foundation

- Define production phases.
- Define asset contracts.
- Define chapter blueprint contract.
- Define writing plan contract.
- Define style evolution contract.
- Define readiness result shape.
- Add unit tests for contracts and gates.

### Phase B: Planning Asset Generation

- Implement recoverable core seed generation.
- Implement character dynamics generation.
- Implement world matrix generation.
- Implement plot architecture generation.
- Implement story bible generation.
- Implement writing plan generation.

### Phase C: Style Evolution

- Implement style sample generation.
- Implement style review.
- Implement prompt evolution loop.
- Implement user approval and freeze.
- Block chapter execution until approval.

### Phase D: Chapter Execution Contract

- Generate chapter task sheet and scene cards.
- Validate shape gate.
- Add semantic quality gate.
- Persist context package.

### Phase E: Multi-Scene Drafting

- Generate by scene.
- Stitch scenes.
- Apply style contract.
- Run anti-AI rewrite.
- Save chapter versions.

### Phase F: Quality And Finalization

- Add six-dimension review.
- Add novel constitution check.
- Add foreshadowing health check.
- Add timeline check.
- Add finalize chapter closure.

### Phase G: UI Workbench

- Add production status panel.
- Add style evolution page.
- Add asset editors.
- Add version comparison.
- Add blocked-stage repair actions.

## First Development Slice

The first code slice should be intentionally narrow:

- Add production workflow contracts in core.
- Add style evolution contract types.
- Add chapter blueprint contract shape.
- Add pure readiness evaluators.
- Add tests proving an unapproved style contract blocks chapter execution readiness.

This gives later stages a stable contract without changing the current pipeline behavior immediately.
