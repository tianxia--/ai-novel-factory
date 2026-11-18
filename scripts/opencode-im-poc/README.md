# OpenCode IM Harness PoC

An isolated contract test, not the production IM implementation. It launches real
OpenCode 1.14.33 services with deterministic local model and MCP fixtures. No real
model credentials, provider charges, novel engine imports or factory DB writes.

## Run

Prerequisites: Node 24, OpenCode 1.14.33 on PATH, macOS/Linux, permission to bind
loopback ports. Dependencies are already provided by Node and the OpenCode binary;
the test does not install packages. A different runtime version fails deliberately.

```sh
rtk proxy node --test scripts/opencode-im-poc/acceptance.test.mjs
```

`OPENCODE_POC_BIN` can select a different executable path for the same pinned
version. This test is intentionally not added to `npm test`: it requires an
external OpenCode installation and loopback listeners.

## Boundaries

- CLI: `opencode serve` starts/stops a headless service, never a TUI session.
- Control: direct authenticated HTTP calls in this PoC. No SDK is installed here.
  The production adapter is planned to use a version-matched `@opencode-ai/sdk`.
- Three actors each have a distinct process, HOME/XDG configuration and data root.
  These are configuration boundaries, NOT OS sandbox guarantees.
- The deterministic model returns scripted decisions. Its prompts contain an
  explicit test action; this is not autonomous reasoning or fiction evaluation.
- A test-only IM gateway owns group/DM membership and derives sender identity from
  per-actor MCP credentials. Models cannot supply the author. Only the writer is
  granted the draft tool. All built-in OpenCode tools are denied.
- Each actor/conversation uses a native Session. Public messages come from the
  explicit messaging tool, not from also publishing the final assistant response.
- The IM fixture lives in memory and has no durable inbox, deduplication or leases.
  Only OpenCode's native Session persistence is tested across a graceful restart.
- Model request cancellation is tested; cancellation of a running external tool,
  crash reconciliation, hostile code, dynamic task grants and KB retrieval are not.
- Test data and processes are cleaned up after each run. No production server or
  database is started. Force-killing the test runner can prevent cleanup.

See the [verification report](../../docs/plans/2026-10-15-opencode-im-poc.md) and
[task capability / knowledge design](../../docs/plans/2026-10-14-person-world-detailed-design.md#21-按工作挂载能力与知识库).
