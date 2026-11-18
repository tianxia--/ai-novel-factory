# Production Architecture

This project is a server-first AI novel workflow system. Web and desktop clients are API clients; they must not own workflow state.

## Deployment Shape

- `packages/ai-novel-core`: domain engine, state machine, database schema, agent orchestration, LLM runtime, memory, Super Graph.
- `packages/ai-novel-server`: standalone HTTP/SSE API service and static web hosting.
- `ai-novel-worker`: standalone autopilot worker process. It claims durable jobs from the database, heartbeats leases, retries transient provider/network failures, and resumes paused/running work after process restarts.
- `apps/desktop`: packaged client shell that connects to the same API.
- `packages/opencode-ai-novel-factory`: compatibility plugin/CLI adapter.

Production should run API and worker as separate processes:

1. `ai-novel-server --root-dir <workspace> --static-dir <web-build> --port <port>`
2. `ai-novel-worker --root-dir <workspace>`

The API service may embed the worker only for local compatibility by setting `AI_NOVEL_EMBEDDED_WORKER=1` or passing `--embedded-worker`. Embedded mode is not the production default.

Operational probes:

- `GET /api/health`: process liveness.
- `GET /api/ready`: database readiness plus job, run, memory, and event counters.
- `ai-novel-worker --status --root-dir <workspace>`: prints worker/database status as JSON and exits.
- `ai-novel-worker --once --root-dir <workspace>`: performs one restore scan/backfill pass, prints status, and exits.

## Source Of Truth

The source of truth is the factory database under `.ai-novel-factory/factory.sqlite` for local/dev. Production should use the same schema concepts with Postgres.

Markdown and JSON files under project workspaces remain artifacts, not the primary state authority. Every important artifact must be indexed by the database.

Core tables:

- `projects`: current project metadata, current stage, run status, state snapshot.
- `workflow_runs`: discussion, autopilot, workflow advance, interruption, cover runs.
- `workflow_steps`: durable step-level workflow records.
- `agent_turns`: every role turn, input context, output text, status, error, model.
- `messages`: canonical chat/control-room messages with `messageId`, `conversationId`, `type`, `status`, `time`, `data_json`, and metadata.
- `message_parts`: extensible message body parts for markdown, images, artifacts, tool calls, tool results, and structured JSON.
- `artifacts`: all generated or updated files.
- `memory_items`: retrievable long-term memory and future embedding queue.
- `graph_nodes` / `graph_edges`: database mirror for Super Graph nodes and edges.
- `checkpoints`: drift guard and recovery checkpoints.
- `events`: append-only event log for UI, audit, replay, and recovery.
- `jobs`: durable background job records. Redis may coordinate workers, but must not replace this table.

`FactoryDb.getOperationalStatus()` is the shared status view for API readiness probes and worker status commands.

## Redis Role

Redis is optional for local development and recommended for production.

Use Redis for:

- distributed job locks,
- worker leases,
- SSE/pubsub fanout,
- agent heartbeat,
- hot runtime status.

Do not use Redis as the source of truth. All durable status changes must be persisted in the database.

## State Machine

Project stages:

1. `worldbuilding_dialogue`
2. `setting_review`
3. `master_planning`
4. `chapter_task_generation`
5. `drafting`
6. `reviewing`
7. `replanning`
8. `complete`

Run statuses:

- `idle`
- `running`
- `paused`
- `blocked`
- `failed`
- `completed`

Step/turn statuses:

- `pending`
- `in_progress`
- `completed`
- `failed`
- `cancelled`

Only server/core may persist these states. Within core, workflow decisions should flow through the Director layer described below instead of being scattered across API handlers, UI code, agent prompts, or worker loops.

## Director Model

The production workflow uses a thin Director model, similar to a game moderator:

1. The API receives user commands and writes durable jobs or events.
2. The worker claims jobs and heartbeats leases, but does not own workflow policy.
3. `NovelDirector` reads the current database-backed state, the latest user/autopilot instruction, and guardrail signals.
4. `NovelDirector` decides the next command:
   - run discussion,
   - advance the production state machine,
   - retry/recover a blocked chapter,
   - pause/fail because guardrails require intervention.
5. Executor modules perform the command:
   - discussion runner calls role agents,
   - orchestrator advances stages,
   - writing pipeline creates chapter artifacts and reports,
   - memory/RAG layer recalls and records context.
6. Results are persisted as events, artifacts, state snapshots, graph updates, and memory rows.
7. UI renders projections only.

The Director must stay thin. It should decide *what happens next* and record why. It should not become a giant prompt, a hidden agent transcript, or an ad hoc state store.

Authority rules:

- UI cannot advance workflow state.
- API handlers cannot invent workflow progress; they create commands/jobs and return projections.
- Worker owns leases/retries, not story policy.
- Agents can propose, draft, review, and critique, but cannot directly change canonical stage or chapter status.
- Orchestrator and writing pipeline may mutate state only while executing a Director command.
- Every Director decision should be auditable through events such as `DIRECTOR_COMMAND_DECIDED`.

## Agent Execution

A discussion run is a durable `workflow_run`.

The current roundtable order is:

1. `Showrunner` as `opening_brief`
2. `World Architect` as `specialist_turn`
3. `Author` as `specialist_turn`
4. `Editor` as `specialist_turn`
5. `Reviewer` as `specialist_turn`
6. `Prose Stylist` as `specialist_turn`
7. `Showrunner` as `closing_synthesis`

Each role call is a durable `agent_turn`.

Each turn must record:

- run id,
- role,
- discussion stage,
- input context,
- output text,
- status,
- error if failed,
- timestamps.

## Message System

Messages are first-class domain objects, not UI-only chat rows.

All clients, workers, API handlers, and plugins must use the shared `BaseMessage` contract from `ai-novel-core`:

- `messageId`: globally stable message identity.
- `conversationId`: discussion, writing, autopilot, or tool conversation scope.
- `runId` / `turnId`: optional workflow and agent-turn links.
- `type`: high-level message family.
- `status`: `queued`, `streaming`, `completed`, `failed`, or `cancelled`.
- `time`, `createdAt`, `updatedAt`, `completedAt`: durable lifecycle timestamps.
- `data`: the real typed message body.
- `metadata`: non-rendering operational details.

Message types are intentionally extensible:

- `user`: user instruction or intervention.
- `agent`: agent output. Specific role is stored in `data.agentType`, for example `showrunner`, `author`, `editor`, or `prose_stylist`.
- `status`: durable system or workflow status card.
- `tool`: tool call or result.
- `artifact`: generated file, chapter, report, plan, or memory output.
- `image`: generated or referenced image asset.
- `error`: recoverable or terminal failure visible to the user.

The preferred structure is:

```ts
BaseMessage<TType, TData> {
  messageId
  conversationId
  type
  status
  time
  data
}
```

`AgentMessage` is a specialization with `type = "agent"`:

```ts
AgentMessage.data = {
  agentType: "showrunner" | "author" | "editor" | string,
  agentLabel: string,
  content: string,
  format: "plain" | "markdown",
  artifactPath?: string
}
```

Streaming must update the same `messageId`; it must not create a new message per delta. A complete LLM interaction by one agent is one message unless the agent explicitly emits multiple semantic outputs.

`message_parts` is the expansion point for multimodal and tool-heavy messages. A future image agent should add an `image` part or emit an `image` message without changing the conversation timeline model.

API contract:

- `GET /api/messages`: canonical conversation endpoint for web, desktop, API consumers, and plugin adapters. It returns raw `messages` plus compatibility `entries` for older renderers. It supports `projectId`, `limit`, `offset`, and optional `conversationId`; the response includes `pagination.totalMessages`, `hasMore`, and `nextOffset`.
- `GET /api/transcript`: compatibility/export endpoint. It may read `discussion-log.md`, but when database messages exist it should project entries from `messages` first.
- `factorySnapshot.recentMessages`: compact status projection used by `/api/status` so clients can render the latest control-room history without requesting the full transcript.

Legacy transcript files may be imported or displayed as artifacts, but they must not be treated as the primary conversation source after the message tables are available. New UI work should call `/api/messages` for history and keep `/api/transcript` only as a fallback.

## Context Contract

Context must be assembled in this order:

1. system/developer protocol,
2. role base prompt,
3. role dynamic prompt,
4. original project mission,
5. current workflow state,
6. Super Graph constraints,
7. global consensus,
8. current context packet,
9. recent transcript,
10. memory/RAG recalls,
11. current user or autopilot instruction,
12. tool and artifact results.

The current context packet is persisted at `.ai-novel/context/current-context.md` and indexed as an artifact.

## Memory And RAG

Long-term memory lives in `memory_items`; embeddings live in `embeddings`.

Current local/dev behavior:

- discussion conclusions and durable memory are recorded in the database,
- pending memory embeddings are backfilled by the worker,
- memory recall uses embedding similarity when vectors are available,
- file artifacts remain readable history, not the retrieval authority.

Production can replace the local embedding implementation with an external embedding provider or vector database, but the ownership contract remains the same: memory rows and embedding metadata are represented in the primary database, and vector search augments retrieval instead of replacing durable memory.

## API Snapshot Contract

All clients use the same workspace payload shape:

- `state`: serialized project state from the database when available.
- `transcript`: persisted discussion transcript artifact.
- `consensus`: persisted global consensus artifact.
- `contextPacket`: current context packet artifact.
- `graphIndex` / `graphViolations`: Super Graph projection, preferring database rows over files.
- `factorySnapshot`: database snapshot, including projects, runs, events, artifacts, checkpoints, graph rows, memory rows, `activeJobs`, and `runnableJobs`.

`/api/autopilot/start` creates durable job state. `/api/autopilot-stream` is a status subscription and must not become a second job runner.

## Event Contract

All important actions should produce events:

- `PROJECT_CREATED`
- `PROJECT_STATE_UPDATED`
- `WORKFLOW_RUN_STARTED`
- `WORKFLOW_RUN_UPDATED`
- `AGENT_TURN_UPDATED`
- `DISCUSSION_STARTED`
- `CONSENSUS_UPDATED`
- `ARTIFACT_RECORDED`
- `MEMORY_ITEM_RECORDED`
- `EMBEDDING_UPSERTED`
- `JOB_CREATED`
- `JOB_CLAIMED`
- `JOB_HEARTBEAT`
- `JOB_UPDATED`
- `JOB_RESTORE_READY`
- `DRIFT_DETECTED`
- `CHECKPOINT_CREATED`

UI must prefer database-backed snapshots and event streams over reconstructing state from raw files.

## No More Split State

Do not add new workflow state only in UI local state, server memory maps, markdown files, or ad hoc JSON files.

If it affects continuity, recovery, progress, consensus, memory, graph, jobs, or LLM trace, it must be represented in the database and exposed through the API snapshot.

## Plugin Boundary

`apps/desktop` and the hosted web client are thin clients. They render API snapshots and subscribe to SSE status; they do not create workflow state.

`packages/opencode-ai-novel-factory` is a production adapter, not an independent workflow engine.

Production plugin entry points must call `ai-novel-core` or `ai-novel-core/server-core` for:

- project creation and lookup,
- workflow status,
- discussions,
- workflow advancement,
- provider/runtime configuration,
- Super Graph access,
- memory and artifact recording.

Legacy file-first tools have been removed from the active package. Do not reintroduce a root `studio/` workflow, `@daily_pipeline` skill, or any plugin tool that creates/reads alternate workflow state. Historical writing-quality assets that were useful for production have been migrated into `packages/ai-novel-core/resources/writing`.

The canonical production initialization path is:

1. `novel-init`, API project creation, or CLI `ai-novel init/create` calls core.
2. Core creates `.ai-novel-projects/<project-id>/.ai-novel`.
3. Core records project state in `.ai-novel-factory/factory.sqlite`.
4. UI/API snapshots read from core-backed project state, artifacts, and DB records.
