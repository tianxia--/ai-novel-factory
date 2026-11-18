# OpenCode AI Novel Factory

Production OpenCode/CLI adapter for AI Novel Factory.

This package no longer owns a separate writing workflow. It calls `ai-novel-core`, which persists project state, messages, jobs, memory, artifacts, and Super Graph rows through the factory database.

## Tools

Only production tools are exposed:

| Tool | Purpose |
| --- | --- |
| `novel-init` | Create or report a managed production project. |
| `novel-status` | Report managed project state from the production source of truth. |

Legacy file-first tools and OpenCode skill folders have been removed from the active package. Continue writing through the API/web client, worker autopilot, or CLI commands.

## CLI

```bash
ai-novel init --idea "A fallen sword immortal rebuilds heaven's order" --chapters 48 --chapter-words 3200
ai-novel status
ai-novel chat --message "The protagonist should sound colder, but still carry hidden obsession"
ai-novel advance
ai-novel provider-test
ai-novel tui
```

## State Model

- Source of truth: `.ai-novel-factory/factory.sqlite`
- Managed project registry: `.ai-novel-projects/projects.json`
- Project artifacts/cache: `.ai-novel/`
- Production writing resources: `ai-novel-core/resources/writing`

The plugin must not create a second state source. Web, desktop, API, CLI, and plugin surfaces should all render the same core-backed project state.
