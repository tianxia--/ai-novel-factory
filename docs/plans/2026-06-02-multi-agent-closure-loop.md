# Multi-Agent Closure Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the current shared Web/Desktop studio from parallel role-flavored replies into a real multi-agent discussion closure loop with project-level language control, system settings drawer support, persistent history, and direct handoff into setting freeze, planning, and drafting.

**Architecture:** Keep the existing orchestration core in `packages/opencode-ai-novel-factory` as the single source of truth, but refactor discussion execution into a staged roundtable: user input -> showrunner framing -> specialist turns that can read prior turns -> showrunner synthesis -> state/artifact updates. Store system-wide UI/provider/language settings separately from novel-specific project settings, and make the shared frontend consume both the evolving transcript history and the latest project discussion state without dropping prior turns.

**Tech Stack:** TypeScript, Node.js, local HTTP/SSE API, vanilla HTML/CSS/JS frontend in `apps/desktop`, Tauri shell scaffold, Node `--test`

---

### Task 1: Add failing tests for a real roundtable-style discussion loop

**Files:**
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`
- Modify: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Modify: `packages/opencode-ai-novel-factory/src/runtime-llm.ts`

**Step 1: Write the failing test**

Add tests that expect:
- `runMultiAgentDiscussion()` to preserve ordered turns across the whole round
- later agent replies to receive prior turn context, not just the raw user message
- the returned summary to come from a final showrunner synthesis step instead of the first reply slot

Example assertions:
- the second half of the round references prior agent output
- transcript order is `User -> Showrunner -> specialists -> Showrunner summary`
- the final summary differs from the opening showrunner framing

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because current discussion is only parallel role responses with no cross-turn context.

**Step 3: Write minimal implementation**

Refactor discussion flow so it becomes:
1. opening showrunner brief
2. specialist turns in deterministic order, each seeing prior transcript context
3. final showrunner synthesis
4. transcript write + consensus update

Keep the implementation simple:
- one round only
- fixed agent order
- no speculative tool-calling layer yet

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for the new roundtable discussion behavior.

### Task 2: Add project-level discussion language control

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/cli-types.ts`
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Modify: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Modify: `packages/opencode-ai-novel-factory/src/runtime-llm.ts`
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add tests that expect:
- new projects to store a discussion/output language
- discussion replies and transcript metadata to reflect that language
- changing the project language updates future discussion turns

Minimum supported values for now:
- `zh-CN`
- `en`

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because no project language field exists yet.

**Step 3: Write minimal implementation**

Add a project-level language field to `.ai-novel/state.json`, initialize it with a sensible default, and thread it through:
- discussion prompt assembly
- fake/test-mode replies
- transcript metadata
- future planning artifacts where appropriate

Do not add a full translation layer. Only control the response language of generated content.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with deterministic language-aware discussion behavior.

### Task 3: Add a shared system settings drawer for provider and language

**Files:**
- Modify: `apps/desktop/index.html`
- Modify: `apps/desktop/style.css`
- Modify: `apps/desktop/app.js`
- Modify: `apps/desktop/src/view-model.mjs`
- Modify: `packages/opencode-ai-novel-factory/src/server.ts`
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add tests that expect the shared desktop frontend to include:
- a right-side system settings drawer
- provider fields
- UI/discussion language controls
- test and save actions

Also add view-model tests for:
- separate system settings state
- language rendering state
- provider test status persistence

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because current provider config only uses a modal and language is not configurable.

**Step 3: Write minimal implementation**

Implement a settings drawer that only contains system-level settings:
- LLM provider fields
- discussion language
- runtime/service state summary

Keep novel-specific settings out of this drawer.

Expose API support for:
- reading system settings
- saving provider env values
- saving language choice into project state or system state as designed
- testing unsaved provider overrides before save

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with drawer structure and behavior covered.

### Task 4: Preserve full transcript history and fix discussion rendering semantics

**Files:**
- Modify: `apps/desktop/src/view-model.mjs`
- Modify: `apps/desktop/app.js`
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add tests that expect:
- full transcript history to remain visible across multiple rounds
- pending user message to append at the end
- live agent stream to append after the pending user message
- no older messages disappear when a new round starts

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL if any regression reintroduces top-insertion or last-block-only behavior.

**Step 3: Write minimal implementation**

Lock discussion rendering to one simple invariant:
- all persisted messages render in chronological order
- current user input appends after persisted history
- streaming agent replies append after that

Do not implement pagination yet. Just preserve the full in-memory render order for the current transcript.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for stable chronological rendering.

### Task 5: Close the loop from discussion into planning and drafting with explicit checkpoints

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Modify: `packages/opencode-ai-novel-factory/src/server.ts`
- Modify: `apps/desktop/app.js`
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add tests that expect:
- a completed discussion round updates consensus with final showrunner synthesis
- `/advance` consumes that updated consensus and language setting
- generated `setting-freeze.md`, `master-outline.md`, and `chapter-blueprints` reflect the latest discussion conclusions

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because the current discussion engine does not yet provide a true synthesized closure artifact.

**Step 3: Write minimal implementation**

Make the showrunner synthesis the canonical closure output and store it in a stable place for later planning steps to consume. Ensure `advance` always reads the latest discussion closure rather than a fragile first-reply assumption.

Do not add background workers yet. Keep the chain explicit and synchronous.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with a real discussion-to-planning closure loop.

### Task 6: Update docs and operator guidance

**Files:**
- Modify: `packages/opencode-ai-novel-factory/README.md`
- Modify: `apps/desktop/README.md`
- Modify: `docs/plans/2026-06-02-tauri-web-shared-studio.md`

**Step 1: Write the failing doc checklist**

Create a short checklist for required docs updates:
- explain what is real vs simulated in test mode
- explain current multi-agent discussion semantics
- explain language configuration scope
- explain system settings vs novel settings

**Step 2: Verify the checklist fails**

Read the existing docs and confirm they do not yet describe the new closure loop accurately.

**Step 3: Write minimal documentation**

Update docs so a new contributor can understand:
- how the roundtable discussion works
- how language is chosen
- how provider config is tested and saved
- what remains future work vs what is implemented now

**Step 4: Run final verification**

Run: `rtk npm test`
Expected: PASS and docs align with shipped behavior.
