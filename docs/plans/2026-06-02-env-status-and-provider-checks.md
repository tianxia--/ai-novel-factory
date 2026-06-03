# Env Status And Provider Checks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show provider configuration status in the TUI, allow in-terminal editing of `.env`, and let the user test whether the configured provider is reachable.

**Architecture:** Reuse the current project-local `.env` loading path, but extract a small helper layer for reading, validating, and writing `.env` values. Surface that metadata in the TUI right rail, and add a lightweight provider connectivity check that uses the configured OpenAI-compatible base URL plus API key.

**Tech Stack:** TypeScript, Node.js built-ins, `fetch`, `tsup`, Node `--test`

---

### Task 1: Add `.env` inspection and update helpers

**Files:**
- Create: `packages/opencode-ai-novel-factory/src/env-manager.ts`
- Modify: `packages/opencode-ai-novel-factory/src/llm-config.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a test that expects the helper to report:
- `configured` when `.env` includes `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL_ID`
- `missing` when one or more fields are absent

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because there is no env helper with status reporting.

**Step 3: Write minimal implementation**

Create small helpers to:
- read project `.env`
- report missing keys
- write updated key/value pairs back to `.env`

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for env status expectations.

### Task 2: Add provider connectivity test

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/runtime-llm.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a test-mode path that expects a `provider-test` command to report success in `AI_NOVEL_TEST_MODE=1`.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because there is no provider test command.

**Step 3: Write minimal implementation**

Add a small connectivity check that:
- uses test-mode fake success when `AI_NOVEL_TEST_MODE=1`
- otherwise performs an authenticated request against `${baseUrl}/models`

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for provider-test behavior.

### Task 3: Surface env status and actions in the TUI

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/tui.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a TUI snapshot expectation for:
- provider status line
- last provider test result line
- key hints for edit and test

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the TUI does not show provider status or actions yet.

**Step 3: Write minimal implementation**

Update the TUI to:
- display whether `.env` is configured
- show missing keys when unconfigured
- show last provider test result
- accept keys for edit and provider-test

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the richer TUI snapshot.

### Task 4: Add inline `.env` editing from TUI

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/tui.ts`
- Modify: `packages/opencode-ai-novel-factory/src/env-manager.ts`

**Step 1: Write the failing test**

No automated TTY interaction test is required; snapshot and helper tests are sufficient.

**Step 2: Verify the current limitation**

Run: `npm test`
Expected: tests pass, but the TUI still cannot change `.env`.

**Step 3: Write minimal implementation**

Add a prompt-based flow in TUI to edit:
- `LLM_BASE_URL`
- `LLM_API_KEY`
- `LLM_MODEL_ID`

and persist them to `.env`.

**Step 4: Run final verification**

Run: `npm test`
Expected: PASS with TUI edit support compiled and documented.
