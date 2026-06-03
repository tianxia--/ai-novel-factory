# LLM Live Smoke And Error Surfacing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a direct `llm-test` command for real model smoke testing and surface richer provider/LLM error details in both CLI and TUI.

**Architecture:** Extend the current runtime client with one small "direct prompt smoke test" helper beside provider connectivity checks. Persist the latest LLM smoke-test result in workspace state, expose it through CLI and the TUI composer, and improve failure messages so the user sees endpoint/model/error context instead of generic fetch failures.

**Tech Stack:** TypeScript, Node.js built-ins, `fetch`, readline-based TUI, Node `--test`

---

### Task 1: Add failing tests for direct LLM smoke testing

**Files:**
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`
- Modify: `packages/opencode-ai-novel-factory/package.json`

**Step 1: Write the failing test**

Add tests that expect:
- `ai-novel llm-test --message "请只回复 OK"` succeeds in `AI_NOVEL_TEST_MODE=1`
- the result is persisted in `.ai-novel/state.json`
- the TUI controller parses `/llm-test hello` into a distinct action

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because there is no `llm-test` command or composer action.

**Step 3: Write minimal implementation**

Only after the red test:
- add a new runtime helper for direct prompt smoke tests
- add CLI command wiring
- add composer action parsing

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for the new smoke-test expectations.

### Task 2: Persist richer provider/LLM result metadata

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/cli-types.ts`
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Modify: `packages/opencode-ai-novel-factory/src/runtime-llm.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add assertions that stored provider/LLM results include:
- `ok`
- `checkedAt`
- `baseUrl`
- `modelName`
- `message`
- prompt/response preview for `llm-test`

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because the state does not yet persist LLM smoke-test metadata.

**Step 3: Write minimal implementation**

Add one small `LlmSmokeTestResult` type and persist only the minimum user-useful fields.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with persisted smoke-test state.

### Task 3: Improve CLI and TUI error visibility

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/cli.ts`
- Modify: `packages/opencode-ai-novel-factory/src/tui-controller.ts`
- Modify: `packages/opencode-ai-novel-factory/src/tui.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add snapshot/behavior expectations for:
- TUI showing the last LLM smoke-test status
- TUI showing provider and LLM notes separately
- CLI output for `llm-test` including model, endpoint, and response preview

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because these outputs are not present yet.

**Step 3: Write minimal implementation**

Make failures readable:
- include `baseUrl` and `modelName`
- include a short response preview on success
- include the caught network/error message on failure

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for snapshot and command output.

### Task 4: Document and manually verify real usage

**Files:**
- Modify: `packages/opencode-ai-novel-factory/README.md`

**Step 1: Verify the current limitation**

Run:
- `node dist/cli.mjs provider-test`
- `node dist/cli.mjs llm-test --message "请只回复 OK"`

Expected: before the implementation, the second command does not exist.

**Step 2: Write minimal documentation**

Document:
- direct smoke-test usage
- `/llm-test ...` in the TUI composer
- what success and failure should look like

**Step 3: Run final verification**

Run:
- `rtk npm test`
- `node dist/cli.mjs llm-test --message "请只回复 OK"` in test mode or real mode depending local env

Expected:
- tests PASS
- CLI shows explicit smoke-test result
- TUI can display the latest smoke-test outcome
