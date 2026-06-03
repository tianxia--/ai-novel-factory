# Multi-Project Studio And Autonomous Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current single-workspace demo into a multi-project novel studio with a project manager entry, project creation modal, automatic autonomous kickoff, stricter multi-agent discussion, and stable incremental chat rendering.

**Architecture:** Move from one hardcoded `.ai-novel` workspace under the repo root to a project registry plus per-project workspaces under a dedicated novel-project root. Expose project-aware APIs from the local studio server, then split the web UI into a project manager shell and a per-project studio view that can auto-enter a selected project and auto-start the first discussion round after initialization. Tighten discussion contracts so agents debate one scoped target, surface disagreement, produce a visible consensus artifact, and keep expandable full detail instead of hiding everything behind a summary.

**Tech Stack:** Node.js local HTTP server, filesystem-backed project registry/workspaces, vanilla JS frontend, SSE streaming, existing autonomous orchestrator/runtime-llm discussion pipeline, repo test suite in `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

---

### Task 1: Add project registry and per-project workspace helpers

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/orchestrator.ts`
- Modify: `packages/opencode-ai-novel-factory/src/cli-types.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing tests**

Add tests that prove:
- creating two projects produces two distinct workspaces
- project list API can return both projects
- loading state for one project does not read the other project's transcript/state

**Step 2: Run test to verify it fails**

Run: `rtk npm test -- --grep "multi-project registry"`
Expected: FAIL because only one hardcoded `.ai-novel` workspace exists today.

**Step 3: Write minimal implementation**

Implement:
- a project root such as `.ai-novel-projects/`
- a registry file such as `.ai-novel-projects/projects.json`
- helper functions to:
  - create/load/list projects
  - resolve workspace paths by `projectId`
  - keep backward-compatible single-project loading only as a fallback

**Step 4: Run test to verify it passes**

Run: `rtk npm test -- --grep "multi-project registry"`
Expected: PASS

### Task 2: Make studio API project-aware

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/server.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing tests**

Add tests for:
- `GET /api/projects` returns registry entries
- `POST /api/projects` creates a project with idea/chapters/chapterWords/title
- `GET /api/status?projectId=...` returns only that project
- missing `projectId` in project-scoped routes returns a clear error when multiple projects exist

**Step 2: Run test to verify it fails**

Run: `rtk npm test -- --grep "studio project api"`
Expected: FAIL because API only supports a single root-bound workspace.

**Step 3: Write minimal implementation**

Add endpoints:
- `GET /api/projects`
- `POST /api/projects`
- `POST /api/projects/select`

Update existing endpoints to accept `projectId`:
- `/api/status`
- `/api/chat`
- `/api/chat-stream`
- `/api/advance`
- `/api/cover`
- `/api/interrupt`
- `/api/provider-test` can stay global/system scoped

**Step 4: Run test to verify it passes**

Run: `rtk npm test -- --grep "studio project api"`
Expected: PASS

### Task 3: Auto-kickoff autonomous discussion after project creation

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/server.ts`
- Modify: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing tests**

Add tests that prove:
- creating a project triggers an immediate autonomous kickoff discussion
- kickoff writes transcript and consensus updates without requiring a manual first chat
- kickoff result is returned in the create-project response

**Step 2: Run test to verify it fails**

Run: `rtk npm test -- --grep "autonomous kickoff"`
Expected: FAIL because init currently just creates state and waits.

**Step 3: Write minimal implementation**

On project creation:
- initialize workspace
- synthesize an automatic kickoff prompt from the idea/title/chapter targets
- run one `runMultiAgentDiscussion(...)`
- return created project + kickoff discussion + updated payload

**Step 4: Run test to verify it passes**

Run: `rtk npm test -- --grep "autonomous kickoff"`
Expected: PASS

### Task 4: Add stricter discussion contracts and visible disagreement

**Files:**
- Modify: `packages/opencode-ai-novel-factory/src/runtime-llm.ts`
- Modify: `packages/opencode-ai-novel-factory/src/discussion.ts`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing tests**

Add tests that verify:
- each specialist reply includes a concern/risk, not only agreement
- final showrunner synthesis includes decision, unresolved risks, and next write-back target
- responses stay on the same discussion target

**Step 2: Run test to verify it fails**

Run: `rtk npm test -- --grep "discussion rigor"`
Expected: FAIL because current contract allows easy pass-through summaries.

**Step 3: Write minimal implementation**

Tighten system contract:
- specialists must challenge at least one assumption
- reviewer/editor/prose stylist cannot silently approve without one critique
- showrunner synthesis must explicitly resolve or record disagreement

**Step 4: Run test to verify it passes**

Run: `rtk npm test -- --grep "discussion rigor"`
Expected: PASS

### Task 5: Split frontend into project manager and studio views

**Files:**
- Modify: `apps/desktop/index.html`
- Modify: `apps/desktop/style.css`
- Modify: `apps/desktop/app.js`
- Modify: `apps/desktop/src/view-model.mjs`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing tests**

Add tests for view-model / rendering helpers that prove:
- project list can render independently of studio state
- create-project modal state exists
- selecting a project enters studio view
- no selected project shows manager view instead of old inline init panel

**Step 2: Run test to verify it fails**

Run: `rtk npm test -- --grep "project manager ui"`
Expected: FAIL because current page only knows one inline init panel.

**Step 3: Write minimal implementation**

Create:
- manager shell with project cards/list
- “new project” modal with title/idea/chapters/chapterWords
- selected-project studio mode
- automatic transition into created project after successful init

**Step 4: Run test to verify it passes**

Run: `rtk npm test -- --grep "project manager ui"`
Expected: PASS

### Task 6: Make streaming chat truly incremental inside the chat list

**Files:**
- Modify: `apps/desktop/app.js`
- Modify: `apps/desktop/src/discussion-renderer.mjs`
- Possibly create: `apps/desktop/src/chat-dom-patcher.mjs`
- Test: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing tests**

Add tests that prove:
- `agent_delta` updates only the active bubble content model
- completed entries remain in full history
- collapsed summaries preserve access to full content

**Step 2: Run test to verify it fails**

Run: `rtk npm test -- --grep "incremental chat render"`
Expected: FAIL because discussion HTML is still regenerated for the whole list.

**Step 3: Write minimal implementation**

Change rendering strategy:
- initial history render once
- stream events patch the active bubble node or a narrow live container
- completed messages keep full content plus summary/expand affordance
- result card stays visible without replacing detailed entries

**Step 4: Run test to verify it passes**

Run: `rtk npm test -- --grep "incremental chat render"`
Expected: PASS

### Task 7: Verify full flow locally

**Files:**
- Verify existing server launch path
- Verify web UI manually

**Step 1: Run full test suite**

Run: `rtk npm test`
Expected: PASS

**Step 2: Rebuild and launch studio**

Run: `rtk npm run build`
Run: `node dist/server.mjs --root-dir ../.. --static-dir ../../apps/desktop --port 4310`
Expected: local studio serves manager page at `http://127.0.0.1:4310`

**Step 3: Manual verification**

Verify:
- manager page shows zero or more projects
- create modal accepts idea/chapters/chapterWords
- creating a project auto-enters studio and starts first autonomous discussion
- chat stream grows without whole-list flashing
- long agent replies can expand to full text
- final consensus remains visible and points to write-back asset

