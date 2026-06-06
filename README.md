# AI Novel Factory

AI Novel Factory is now a production-style, server-first AI novel workflow system. Web, desktop, CLI, and OpenCode plugin surfaces all connect to the same core engine and the same durable factory database.

## Current Architecture

- `packages/ai-novel-core`: state machine, factory DB schema, Director, agent orchestration, LLM runtime, memory/RAG, Super Graph, writing pipeline, worker logic.
- `packages/ai-novel-server`: standalone HTTP/SSE API service and static web hosting.
- `apps/desktop`: web/desktop client shell. It renders API snapshots and sends commands; it does not own workflow state.
- `packages/opencode-ai-novel-factory`: OpenCode plugin and CLI adapter. It exposes production tools only.
- `packages/ai-novel-core/resources/writing`: production writing guides, quality rules, and vocabulary resources used by the writing pipeline.

The primary source of truth is `.ai-novel-factory/factory.sqlite`. Per-project `.ai-novel/` markdown and JSON files are artifacts/cache for preview, export, and recovery, not independent workflow state.

## Quick Start

Install dependencies and build:

```bash
rtk npm install
rtk npm test
```

Run the local API/web service:

```bash
rtk node packages/ai-novel-server/dist/index.js --root-dir . --static-dir apps/desktop --port 4311
```

Run the standalone worker in another process:

```bash
rtk node packages/ai-novel-core/dist/worker.js --root-dir .
```

For local testing only, the server can embed the worker:

```bash
rtk node packages/ai-novel-server/dist/index.js --root-dir . --static-dir apps/desktop --port 4311 --embedded-worker
```

Then open:

```text
http://127.0.0.1:4311/
```

## OpenCode Tools

The plugin intentionally exposes only production tools:

| Tool | Purpose |
| --- | --- |
| `novel-init` | Create or report a managed production project. |
| `novel-status` | Read production project status from the managed project registry, DB, and artifacts. |

Removed legacy tools no longer create or read alternate workflow state. Continue discussion and writing through the API/web client, worker autopilot, or CLI commands such as `ai-novel chat`, `ai-novel advance`, and `ai-novel tui`.

## Workflow

The production chain is:

1. Create a managed project under `.ai-novel-projects/<project-id>/`.
2. Persist project metadata, current stage, messages, agent turns, jobs, events, artifacts, memory, and graph rows in `.ai-novel-factory/factory.sqlite`.
3. Discuss and converge settings through durable messages and agent turns.
4. Advance through `worldbuilding_dialogue`, `setting_review`, `master_planning`, `chapter_task_generation`, `drafting`, `reviewing`, `replanning`, and `complete`.
5. Let the worker claim durable autopilot jobs, heartbeat leases, retry transient failures, and resume after process restarts.
6. Render all UI state from API snapshots and SSE events.

## Documentation

- [Production Architecture](docs/PRODUCTION_ARCHITECTURE.md)
- [Autonomous CLI design](docs/plans/2026-06-02-autonomous-cli-mvp-design.md)
- [Multi-project studio plan](docs/plans/2026-06-02-multi-project-studio-and-autonomous-loop.md)

## Legacy Cleanup

The old file-first workflow has been removed from the active project. There is no root `studio/` workflow, no `@daily_pipeline` skill, and no legacy OpenCode agent directory in the production package. Useful writing quality assets were migrated into `packages/ai-novel-core/resources/writing`.
