# Streaming TUI And Planning Chain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the TUI into a live multi-agent discussion workspace and connect discussion outputs into the actual planning chain: setting freeze, master outline, chapter blueprints, and rolling chapter drafting.

**Architecture:** Add a small streaming callback layer to the discussion runner so agent replies can be emitted incrementally to the TUI while still being persisted to disk. Then replace the placeholder planning artifact generators with functions that derive their content from persisted discussion consensus, protagonist notes, and style updates, and extend the workflow chain so advancing past blueprints begins producing draft chapter files from the queued tasks.

**Tech Stack:** TypeScript, Node.js readline-based TUI, local markdown artifacts, Node `--test`

---

### Task 1: Add failing tests for streamed discussion events

**Files:**
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`
- Modify: `packages/opencode-ai-novel-factory/package.json`

**Step 1: Write the failing test**

Add tests that expect:
- `runMultiAgentDiscussion()` can emit agent replies incrementally through a callback
- the streamed sequence includes at least `Showrunner`, `World Architect`, and `Author`
- the TUI render helper can show a live discussion section from in-memory stream lines

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because the discussion runner does not expose stream callbacks yet.

**Step 3: Write minimal implementation**

Add a callback argument and emit one event per agent reply. Do not introduce a generic event bus.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for streaming expectations.

### Task 2: Feed discussion outputs into real planning artifacts

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add tests that expect:
- `advance` after at least one discussion uses persisted consensus/protagonist/style notes in `setting-freeze.md`
- `master-outline.md` references current discussion-driven project direction
- `chapter-blueprints/chapter-001.md` reflects the same planning spine

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because current artifacts are generic placeholders.

**Step 3: Write minimal implementation**

Read from:
- `.ai-novel/prompts/global-consensus.md`
- `.ai-novel/memory/characters/core/protagonist.md`
- `.ai-novel/style/profile.md`

Use only small extracted summaries; do not build a heavy parser.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with discussion-aware artifacts.

### Task 3: Extend the chain into rolling chapter drafting

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli-types.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a test that expects:
- advancing after `chapter_task_generation` creates a real chapter draft file
- the first task status changes away from `pending`
- `pendingChapters` decreases

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because the chain currently stops at chapter blueprints.

**Step 3: Write minimal implementation**

Generate one concrete chapter draft per advance while in drafting-related stages. Use the chapter blueprint, consensus, and protagonist notes to seed the text.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with rolling drafting behavior.

### Task 4: Wire the TUI to show streaming discussion in real time

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/tui-controller.ts`
- Modify: `packages/opencode-ai-novel-factory/src/tui.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add render/controller tests that expect:
- live stream lines can be passed into the TUI renderer
- composer-triggered chat actions can surface streaming lines before the final summary

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because the TUI only shows persisted discussion after completion.

**Step 3: Write minimal implementation**

Pass an `onStream` callback from the TUI composer submission path into `runMultiAgentDiscussion()`, store the latest live agent lines in memory, and rerender after each streamed message.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with stream-aware rendering.

### Task 5: Verify manually and document the new flow

**Files:**
- Modify: `packages/opencode-ai-novel-factory/README.md`

**Step 1: Verify the current limitation**

Run `node dist/cli.mjs tui` and note that discussion updates appear only after completion, not incrementally.

**Step 2: Write minimal documentation**

Document:
- real-time streamed discussion behavior
- how repeated `/advance` moves through setting freeze, outline, blueprints, and drafting

**Step 3: Run final verification**

Run:
- `rtk npm test`
- `node dist/cli.mjs tui`
- submit one chat message and then `/advance` repeatedly

Expected:
- live streamed agent replies appear
- planning artifacts change based on discussion
- chapter draft files begin appearing under `.ai-novel/chapters/`
