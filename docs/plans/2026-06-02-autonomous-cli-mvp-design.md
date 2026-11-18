# Autonomous CLI MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a first-pass `ai-novel` CLI that can initialize an autonomous novel project, persist orchestration state, show progress, and process user interruptions with replan guidance.

**Architecture:** Keep the existing OpenCode plugin intact and add a small CLI-oriented orchestration layer inside the same package. The CLI will manage a `.ai-novel/` workspace with a state file, generated artifacts, and a chapter task queue. The first version will not auto-call an LLM; it will create the deterministic state machine and reusable prompt artifacts that later execution engines can consume.

**Tech Stack:** TypeScript, Node.js built-ins, `tsup`, `zod`, Node `--test`

---

### Task 1: Define the autonomous CLI scope in code

**Files:**
- Create: `packages/opencode-ai-novel-factory/src/cli-types.ts`
- Create: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Modify: `packages/opencode-ai-novel-factory/src/index.ts`

**Step 1: Write the failing test**

Create a test that expects a project init call to create `.ai-novel/state.json` and a non-empty chapter queue.

**Step 2: Run test to verify it fails**

Run: `npm test -- autonomous-cli`
Expected: fail because the CLI files and state model do not exist.

**Step 3: Write minimal implementation**

Add shared types for stages, task queue items, interruption assessment, and workspace layout. Add a small orchestration helper that can create the initial state from an idea and a target chapter count.

**Step 4: Run test to verify it passes**

Run: `npm test -- autonomous-cli`
Expected: pass for init state expectations.

### Task 2: Add CLI commands for init, status, and interrupt

**Files:**
- Create: `packages/opencode-ai-novel-factory/src/cli.ts`
- Modify: `packages/opencode-ai-novel-factory/package.json`

**Step 1: Write the failing test**

Create tests that invoke the CLI for:
- `init --idea ...`
- `status`
- `interrupt --message ...`

**Step 2: Run test to verify it fails**

Run: `npm test -- autonomous-cli`
Expected: fail because the CLI binary and command handlers are missing.

**Step 3: Write minimal implementation**

Parse `process.argv`, create the project if needed, print status summaries, and write interruption review results back into state.

**Step 4: Run test to verify it passes**

Run: `npm test -- autonomous-cli`
Expected: pass for the CLI command flow.

### Task 3: Add interruption review and replan hints

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli-types.ts`

**Step 1: Write the failing test**

Add a test that submits a major interruption and expects the project stage to change to `replanning`, while a local interruption keeps the plan in progress.

**Step 2: Run test to verify it fails**

Run: `npm test -- autonomous-cli`
Expected: fail because interruption impact classification is incomplete.

**Step 3: Write minimal implementation**

Implement a simple deterministic reviewer using keyword heuristics and affected artifact categories. Record whether the interruption is `local`, `chapter-arc`, or `global`.

**Step 4: Run test to verify it passes**

Run: `npm test -- autonomous-cli`
Expected: pass for interruption assessment and stage transitions.

### Task 4: Package and document the MVP

**Files:**
- Create: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`
- Modify: `packages/opencode-ai-novel-factory/README.md`
- Modify: `packages/opencode-ai-novel-factory/package.json`

**Step 1: Write the failing test**

Add the final test harness and `npm test` script before implementation is complete.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: fail until the build output and CLI wiring are complete.

**Step 3: Write minimal implementation**

Add `bin`, build entries for plugin and CLI, the test script, and a short README section showing how to use the autonomous CLI.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: build succeeds and the CLI workflow test passes.
