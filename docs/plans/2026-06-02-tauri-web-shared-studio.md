# Tauri Web Shared Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land a shared Web/Desktop novel studio into the current repository using a local HTTP API over the existing orchestration core, a runnable web UI based on the provided design, and a Tauri desktop scaffold ready to adopt the same frontend.

**Architecture:** Keep the existing `packages/opencode-ai-novel-factory` core as the source of truth. Add a thin local Node HTTP server that exposes status, chat, streamed discussion, advance, provider-test, init, env, and interrupt endpoints; then build a new `apps/desktop` static frontend that consumes that API and mirrors the provided layout. Add a Tauri v2-style scaffold around the same frontend, while documenting that Rust/Tauri toolchain installation is still required to run the desktop shell on this machine.

**Tech Stack:** TypeScript, Node.js HTTP/SSE, vanilla HTML/CSS/JS, Tauri v2 file/config scaffold, Node `--test`

---

### Task 1: Add a failing test for a local orchestration API

**Files:**
- Create: `packages/opencode-ai-novel-factory/src/server.ts`
- Modify: `packages/opencode-ai-novel-factory/package.json`
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add tests that expect a local server helper to:
- return current project status as JSON
- run `advance`
- stream chat discussion events over a callback or SSE-style writer abstraction

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because there is no server module yet.

**Step 3: Write minimal implementation**

Add a small Node HTTP server with endpoints:
- `GET /api/status`
- `POST /api/init`
- `POST /api/advance`
- `POST /api/provider-test`
- `POST /api/chat`
- `GET /api/chat/stream`

Use the existing core modules directly; do not duplicate orchestration logic.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS for API helper coverage.

### Task 2: Build the first runnable shared frontend app

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/style.css`
- Create: `apps/desktop/app.js`
- Create: `apps/desktop/src/view-model.mjs`
- Modify: `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

**Step 1: Write the failing test**

Add file-level or render helper tests that expect:
- the frontend project exists
- the UI bootstrap script can transform status payloads into DOM-friendly view data
- chapter progress, provider status, and workflow stage labels derive from real API state

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL because the frontend app does not exist yet.

**Step 3: Write minimal implementation**

Port the provided HTML/CSS/JS design into a static app and wire it to the local API:
- load status on startup
- send composer messages
- subscribe to streamed agent replies
- trigger `/advance`
- trigger provider test
- render chapter tasks and logs from real state

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with frontend bootstrap coverage.

### Task 3: Make the shared UI runnable today in web mode

**Files:**
- Modify: `apps/desktop/package.json`
- Modify: `packages/opencode-ai-novel-factory/README.md`

**Step 1: Write the failing test**

Add or extend tests to ensure the frontend config references the local API base cleanly and that the app boot sequence tolerates missing workspace state until `init`.

**Step 2: Run test to verify it fails**

Run: `rtk npm test`
Expected: FAIL until the web app boot flow is resilient.

**Step 3: Write minimal implementation**

Add scripts for:
- API server dev mode
- shared static studio mode
- one command to run the shared studio in local development

Keep the implementation simple and repo-local.

**Step 4: Run test to verify it passes**

Run: `rtk npm test`
Expected: PASS with runnable web mode.

### Task 4: Scaffold Tauri desktop wrapper around the same frontend

**Files:**
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Modify: `apps/desktop/README.md`

**Step 1: Verify current constraint**

Check local toolchain:
- `cargo -V`
- `rustc -V`
- `tauri -V`

Expected: currently unavailable on this machine.

**Step 2: Write minimal scaffold**

Add the standard Tauri v2 structure compatible with a Vite frontend. The scaffold should be ready for `tauri dev` once Rust/Tauri are installed.

**Step 3: Document the toolchain gap**

State clearly that:
- web mode is runnable now
- desktop mode is scaffolded but requires Rust/Tauri installation first

**Step 4: Run final verification**

Run:
- `rtk npm test`
- frontend build if dependencies are available

Expected:
- tests PASS
- repo contains a coherent shared Web/Tauri structure
- web path is runnable immediately
