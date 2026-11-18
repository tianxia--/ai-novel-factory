# Multi-Agent TUI Novel Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current `ai-novel` CLI/TUI prototype into a chat-driven multi-agent novel studio that can discuss a user's idea, maintain evolving prompts and consensus, and visibly advance the novel pipeline from inside the TUI.

**Architecture:** Keep the existing `.ai-novel/` workspace as the durable source of truth, then add a small runtime stack on top of it: an OpenAI-compatible LLM client, a multi-agent discussion orchestrator, and a message router that updates state and artifacts after each interaction. The TUI remains the operator surface, but it becomes functional by sending user messages into the router, showing the live discussion transcript, and triggering workflow actions like advance, cover prep, and interruption review.

**Tech Stack:** TypeScript, Node.js built-ins, `fetch`, `tsup`, Node `--test`

---

### Task 1: Add durable prompt and style assets

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/cli-types.ts`
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a test that expects project init to create:
- `prompts/global-consensus.md`
- `prompts/agents/*.base.md`
- `prompts/agents/*.dynamic.md`
- `style/profile.md`
- `style/rulebook.md`
- `memory/characters/core/protagonist.md`

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the new prompt and style assets are not created yet.

**Step 3: Write minimal implementation**

Extend workspace initialization to create the new directories and seed files. Keep the base prompts short and stable. Keep the dynamic prompts structured and explicitly marked as evolving.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the new workspace asset expectations.

### Task 2: Add an OpenAI-compatible runtime LLM client

**Files:**
- Create: `packages/opencode-ai-novel-factory/src/runtime-llm.ts`
- Modify: `packages/opencode-ai-novel-factory/src/llm-config.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a test path using `AI_NOVEL_TEST_MODE=1` that expects the runtime client to return deterministic fake agent replies without external API calls.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the runtime client does not exist.

**Step 3: Write minimal implementation**

Create a small `generateAgentReply` helper that:
- reads provider config
- calls an OpenAI-compatible `/chat/completions` endpoint when configured
- returns deterministic fake output in test mode

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for runtime reply generation in test mode.

### Task 3: Add multi-agent discussion orchestration and routing

**Files:**
- Create: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a test for:
`ai-novel chat --message "..."` that expects:
- a discussion transcript file
- visible multi-agent role output
- updated global consensus
- updated protagonist or style summary

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because chat routing and discussion orchestration are missing.

**Step 3: Write minimal implementation**

Add a router that classifies user messages into:
- `worldbuilding`
- `workflow_control`
- `interruption_change`
- `status_query`

For `worldbuilding`, run a visible sequential discussion between a few core roles:
- showrunner
- world architect
- story author
- editor
- reviewer

Append the transcript to disk and write a short consensus summary back into project assets.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for chat-driven discussion and artifact updates.

### Task 4: Make the TUI actually interactive

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/tui.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add a test for `ai-novel tui --once` that expects the snapshot to include:
- left-side world/style/character summary
- right-side workflow controls
- recent discussion transcript
- actionable key hints for chat and workflow

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the TUI does not yet display live discussion context.

**Step 3: Write minimal implementation**

Update the TUI so it can:
- show left/right rails in the intended order
- display latest discussion messages
- prompt for a free-form chat message from inside the TUI
- call `advance`, `cover`, or `interrupt` from key handlers

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the richer TUI snapshot and interaction wiring.

### Task 5: Document the studio workflow

**Files:**
- Modify: `packages/opencode-ai-novel-factory/README.md`
- Modify: `docs/plans/2026-06-02-multi-agent-tui-novel-studio.md`

**Step 1: Write the failing test**

No automated test required. Verification is by build and command output.

**Step 2: Run verification to show docs are outdated**

Run: `npm test`
Expected: code passes, but README still lacks the multi-agent TUI workflow.

**Step 3: Write minimal implementation**

Document:
- prompt layering
- multi-agent roles
- `chat`, `advance`, `cover`, `tui`
- current MVP boundaries

**Step 4: Run final verification**

Run: `npm test`
Expected: PASS with docs aligned to the current implementation.
