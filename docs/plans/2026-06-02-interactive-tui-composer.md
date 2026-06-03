# Interactive TUI Composer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the current ASCII dashboard into a genuinely interactive TUI with a visible input composer, slash-command routing, and clearer multi-panel layout.

**Architecture:** Keep the current Node/readline-based TUI instead of adding a new terminal UI dependency. Extract a small controller layer for parsing composer input and rendering panel sections, then wire `runTui()` to maintain an editable input buffer that sends chat messages or workflow commands on `Enter`.

**Tech Stack:** TypeScript, Node.js readline/key events, ANSI terminal rendering, Node `--test`

---

### Task 1: Add a pure composer/controller layer

**Files:**
- Create: `packages/opencode-ai-novel-factory/src/tui-controller.ts`
- Modify: `packages/opencode-ai-novel-factory/package.json`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add tests for a new controller helper that:
- parses plain text as `chat`
- parses `/advance`, `/cover`, `/provider-test`, `/interrupt ...`, `/env base_url=... model=...` into typed actions
- rejects empty composer input

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because `tui-controller.ts` and parser exports do not exist yet.

**Step 3: Write minimal implementation**

Create a pure parser with a narrow command vocabulary:
- `chat`
- `advance`
- `cover`
- `provider-test`
- `interrupt`
- `env-update`
- `refresh`

Keep it small and explicit; no speculative command system.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for parser expectations.

### Task 2: Redesign the TUI render output around panels and composer

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/tui.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli-types.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Extend the `tui --once` snapshot test to expect:
- a dedicated composer section
- a command hint line
- a more explicit provider panel
- multi-panel labels that imply active workflow usage rather than passive display

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because the current renderer only prints static boxes and key hints.

**Step 3: Write minimal implementation**

Update rendering to show:
- left panel for story memory
- right panel for workflow/provider control
- center/bottom discussion and task sections
- bottom composer with current draft input and slash-command hints

Keep `renderTuiScreen()` pure so it stays testable.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for the new snapshot.

### Task 3: Wire real input editing into `runTui()`

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/tui.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add pure helper tests around a `handleComposerSubmit`-style function that maps parsed actions to stateful operations. This avoids flaky non-TTY integration tests while still verifying behavior.

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because there is no composer submit handler yet.

**Step 3: Write minimal implementation**

In `runTui()`:
- maintain an input buffer
- render typed characters live
- support `Backspace`
- submit on `Enter`
- route slash commands to existing orchestration actions
- route plain text to chat/discussion

Preserve `q` to quit and `Ctrl+C` to exit.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for helper-level behavior.

### Task 4: Verify the interactive loop manually and document usage

**Files:**
- Modify: `packages/opencode-ai-novel-factory/README.md`

**Step 1: Verify the current limitation**

Run: `node dist/cli.mjs tui`
Expected: before implementation, interaction feels static and opaque.

**Step 2: Write minimal documentation**

Document the new interaction model:
- type normally to chat with the system
- `Enter` sends
- supported slash commands
- provider testing and env update pathways

**Step 3: Run final verification**

Run:
- `rtk npm test`
- `node dist/cli.mjs tui` in a TTY and manually send at least one chat message and one slash command

Expected:
- tests PASS
- TUI stays open
- typed input is visible
- submitted commands update the visible state
