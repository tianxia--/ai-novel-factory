# Live LLM Discussion And Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the current multi-agent novel studio so real LLM-backed discussions can drive stage-aware routing, dynamic prompt refresh, and richer TUI interaction.

**Architecture:** Keep the current `.ai-novel/` workspace and test-mode discussion flow, then add a stage-aware interaction router, dynamic prompt synchronization, and a live runtime path that uses the project's `.env`-configured OpenAI-compatible provider. The TUI will remain the user-facing control surface, but it will gain a dedicated chat action path and better visibility into routed actions and updated consensus.

**Tech Stack:** TypeScript, Node.js built-ins, `fetch`, `tsup`, Node `--test`

---

### Task 1: Add stage-aware interaction routing

**Files:**
- Create: `packages/opencode-ai-novel-factory/src/router.ts`
- Modify: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add tests that send chat messages and expect routing decisions for:
- `worldbuilding`
- `workflow_control`
- `interruption_change`
- `status_query`

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because chat messages currently all go through one shared discussion path.

**Step 3: Write minimal implementation**

Create a router that inspects the message text and current stage, then returns a route type plus handler hint. Update `chat` to print the route result and send the message to the correct handler.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for route classification and route-aware chat output.

### Task 2: Refresh dynamic prompts after each discussion

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a test that expects a discussion to update:
- `prompts/global-consensus.md`
- `prompts/agents/showrunner.dynamic.md`
- `prompts/agents/author.dynamic.md`
- `style/profile.md`

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because only the consensus and protagonist seed are updated today.

**Step 3: Write minimal implementation**

After each discussion:
- summarize the latest project direction
- append a structured "latest focus" note into selected dynamic prompts
- keep updates short and stage-aware

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for dynamic prompt refresh.

### Task 3: Make the TUI chat path first-class

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/tui.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a TUI snapshot test that expects:
- recent discussion entries
- the latest route label
- prompt/consensus update status

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the TUI does not yet expose routed chat metadata.

**Step 3: Write minimal implementation**

Update the TUI so routed chat messages refresh:
- recent discussion block
- right-rail workflow hint
- a short "last route" / "last action" line

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the richer TUI snapshot.

### Task 4: Exercise the real provider path safely

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/runtime-llm.ts`
- Modify: `packages/opencode-ai-novel-factory/README.md`

**Step 1: Write the failing test**

No automated live-provider test is required. Verification is by build and local manual command flow.

**Step 2: Verify the current limitation**

Run: `npm test`
Expected: test mode passes, but docs do not clearly explain how to switch from fake discussion to real provider-backed discussion.

**Step 3: Write minimal implementation**

Document the difference between:
- `AI_NOVEL_TEST_MODE=1`
- real `.env` provider configuration

Also tighten runtime error messages for missing API key or provider failures.

**Step 4: Run final verification**

Run: `npm test`
Expected: PASS with docs and runtime messages aligned.
