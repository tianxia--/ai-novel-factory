# Next AI Development Handoff

This document is for the next AI/model that will continue development on `ai-novel-factory`.

Current date of handoff: 2026-06-10.
Workspace: `/Users/pengfei.chen/Desktop/github/ai-novel-factory`.
Branch: `develop`.

## Project Goal

Build a stable production AI novel factory that can run long-form novel creation reliably.

The system should:

- Create a managed novel project from an idea and creative profile.
- Support genre/style presets and different novel types.
- Maintain durable workflow state in `.ai-novel-factory/factory.sqlite`.
- Use per-project `.ai-novel/` files only as artifacts/cache, not as independent workflow state.
- Generate chapter plans, drafts, quality reports, final chapters, memory updates, style profiles, character dossiers, and context packets.
- Keep characters distinctive across long runs.
- Make AI-generated prose feel natural and non-template-like.
- Control context size and avoid context explosion.
- Run unattended/worker production stably.
- Expose enough observability for the user to understand why the system is blocked or healthy.

## Non-Negotiable Repo Rules

Read `AGENTS.md` first. Important rules:

- Use `rtk` commands where existing scripts use them.
- Before editing a function/class/method, run GitNexus impact analysis.
- Before commit, run GitNexus `detect_changes`.
- If GitNexus returns HIGH/CRITICAL risk, warn the user before proceeding.
- After commit, run `rtk gitnexus analyze`.
- Do not revert unrelated dirty files.
- Current unrelated dirty files/directories at handoff:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.kunsdd/`
  - `.preview/`
  - `packages/ai-novel-core/scratch/`
- Git commit may warn about `.git/gc.log` and loose objects. Do not prune or clean unless the user explicitly asks.

Useful GitNexus eval-server pattern:

```bash
rtk gitnexus eval-server --port 4867 --idle-timeout 300
rtk proxy curl -s -X POST http://127.0.0.1:4867/tool/impact \
  -H 'content-type: application/json' \
  -d '{"repo":"ai-novel-factory","target":"SYMBOL_NAME","direction":"upstream"}'
rtk proxy curl -s -X POST http://127.0.0.1:4867/tool/detect_changes \
  -H 'content-type: application/json' \
  -d '{"repo":"ai-novel-factory","scope":"staged"}'
```

## Recent Completed Work

Latest commits / developments:

- `[NEW] Multi-Model Config Manager & Robust Database Path Resolution`
- `0c6e0af Expose production observability in studio`
- `0a3733a Add naturalness semantic preservation checks`
- `be0955c Cache factory memory context recall`
- `ed92305 Recall character memory during writing context`
- `902a0f1 Record character dossier memory for recall`
- `227fd43 Enrich character dossiers from chapter evidence`
- `deeaef5 Record extracted style fingerprint artifacts`
- `a35469b Extract first chapter style fingerprint`

### Completed: Multi-Model Config Manager & Robust Database Path Resolution

Implemented:
- Added `llm_configs` SQLite table with full CRUD and one-click activation state.
- Exposed studio server endpoints under `/api/llm-configs` and `/api/llm-configs/activate` with automatic caching.
- Rewrote `resolveFactoryRootDir` in `packages/ai-novel-core/src/llm-config.ts` to locate workspace root directory by verifying root `package.json` package name (`ai-novel-factory-workspace`). This prevents mock databases generated inside individual novel folders or subpackages from hijacking config state.
- Integrated dynamic `loadActiveLlmConfig` inside `generateAgentReply` and `testProviderConnectivity` to read active LLM config, falling back to `.env` if none active.
- Refactored settings UI panel in `apps/desktop` to present the list of LLM configs, supporting CRUD operations, connectivity test, and activation.

### Completed: Factory Memory Recall Cache

Commit: `be0955c`.

Files:

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/tests/core.test.mjs`
- `packages/ai-novel-core/dist/*`

Implemented:

- Short TTL read-through cache for `retrieveFactoryMemoryContext`.
- Cache key includes factory root, project id, chapter number, chapter title, locked protagonist, recall limit, and query.
- Purpose: reduce repeated DB/vector recall during same writing context pass.

Constants:

- `FACTORY_MEMORY_CONTEXT_CACHE_TTL_MS = 5_000`
- `FACTORY_MEMORY_CONTEXT_CACHE_LIMIT = 80`

Test coverage:

- `writing context recalls character dossier memory from the factory database`
- Verifies immediate second retrieval uses cached context after DB memory changes.

### Completed: Semantic Preservation In NaturalnessAgent

Commit: `0a3733a`.

Files:

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/tests/core.test.mjs`
- `packages/ai-novel-core/tests/longrun-stability.test.mjs`
- `packages/ai-novel-core/dist/*`

Implemented:

- Exported `SemanticPreservationReport`.
- Exported `evaluateSemanticPreservation`.
- `NaturalnessReport` now includes `semanticPreservation`.
- Naturalness output can be blocked if local prose patch drifts facts.

Checks:

- Locked protagonist and known character names.
- Continuity anchors present in the before draft.
- Arabic-number facts such as `3日`.
- Negated constraints such as `不能拆`, using a conservative echo check so normal sentence-level polishing is allowed.

Important design detail:

- Do not require every continuity hard rule to appear in the final text unless it was present in the before draft. This avoids false blocking during same-draft self-checks.

Test coverage:

- `semantic preservation blocks naturalness drift while allowing local prose patches`.
- Full core test suite passed after fixing an early false-positive issue.

### Completed: Longrun Stability Test

Commit: `0a3733a`.

File:

- `packages/ai-novel-core/tests/longrun-stability.test.mjs`

Implemented:

- Default 4-chapter production stability test.
- `LONGRUN_CHAPTERS` can expand manual runs.
- CI caps configured chapter count at 20.
- Uses real managed project + `advanceAutonomousProject` + factory DB snapshot.

Validates:

- Completed chapter count never regresses.
- Runtime reaches `complete`.
- No blocked/in-progress chapters remain.
- Final files exist.
- Protagonist consistency remains eligible.
- `chapterFacts` are sequential, gapless, duplicate-free.
- Artifact summary counts are coherent.
- No active/runnable jobs remain.
- Memory/message rows grow.

Manual examples:

```bash
rtk node --test tests/longrun-stability.test.mjs
LONGRUN_CHAPTERS=2 rtk node --test tests/longrun-stability.test.mjs
LONGRUN_CHAPTERS=20 rtk node --test tests/longrun-stability.test.mjs
```

### Completed: Production Observability In Studio

Commit: `0c6e0af`.

Files:

- `packages/ai-novel-core/src/studio-server.ts`
- `apps/desktop/src/view-model.mjs`
- `apps/desktop/app.js`
- `apps/desktop/style.css`
- `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`
- `packages/ai-novel-core/dist/studio-server.*`

Implemented:

- `factorySnapshot.productionObservability`.
- Story Memory panel section: `生产记忆健康`.
- Health cards for:
  - Style contract
  - Character dossiers
  - Memory recall
  - Context budget
- View-model fallback if older payloads do not include `productionObservability`.
- Lightweight status payload keeps trackable artifact paths for:
  - `.ai-novel/style/profile.md`
  - `.ai-novel/memory/characters/dossiers.json`

GitNexus risk:

- HIGH, expected.
- Main high-risk touched paths:
  - `createWorkspacePayload`
  - `compactFactorySnapshotForPayload`
  - `semanticFactorySnapshotForVersion`
  - `renderStoryMemory`
- Full tests passed after change.

## Verified Test Commands

These passed after the latest commit:

```bash
rtk npm --prefix packages/ai-novel-core test
rtk npm run test:server
rtk npm run test:plugin
```

Observed results:

- Core: `81/81`
- Server: `7/7`
- Plugin/Desktop/CLI: `105/105`

Note:

- Do not run server and plugin tests in parallel if both build core with `tsup --clean`; this can race on `packages/ai-novel-core/dist`.

## Key Architecture Map

Core package:

- `packages/ai-novel-core/src/orchestrator.ts`
  - Project initialization.
  - Creative profile.
  - Character dossier seed.
  - Style/profile artifacts.
- `packages/ai-novel-core/src/writing-pipeline.ts`
  - Production chapter pipeline.
  - Continuity contract.
  - Character profile gates.
  - Naturalness report.
  - Semantic preservation.
  - Factory memory recall.
- `packages/ai-novel-core/src/factory-db.ts`
  - Durable DB, snapshots, jobs, memory, artifacts.
- `packages/ai-novel-core/src/studio-server.ts`
  - HTTP API adapter.
  - Snapshot payload.
  - Compact polling payload.
  - Production observability payload.
- `packages/ai-novel-core/src/discussion.ts`
  - Multi-agent discussion.
  - Context packet.
  - Discussion-driven dossier sync.
- `packages/ai-novel-core/src/context-packet.ts`
  - Context packet assembly.
- `packages/ai-novel-core/src/autopilot-worker.ts`
  - Worker/unattended flow.

Desktop:

- `apps/desktop/src/view-model.mjs`
  - Converts server state/snapshot into UI model.
- `apps/desktop/app.js`
  - Browser UI rendering and actions.
- `apps/desktop/style.css`
  - Desktop UI styles.

Plugin/tests:

- `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`
  - Covers server API, desktop view-model, desktop static JS/CSS, CLI/TUI.

## Remaining Work, Recommended Order

### 1. Character Voice Gate Strengthening

Priority: P0/P1.

Why:

- User specifically cares that protagonists, supporting characters, antagonists, and other roles have vivid, non-stereotyped personalities.
- Current dossiers exist, and context packets expose them, but the gate still needs stronger per-character evidence.

Goal:

- Use dossier fields:
  - `behaviorHabits`
  - `speechMarkers`
  - `relationshipState`
  - `appearanceAndBody`
  - `skills`
  - `limitations`
- Require per-character evidence windows, not only whole-text signals.
- Detect if multiple named characters speak/act with the same template.

Likely files:

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/tests/core.test.mjs`

Likely symbols:

- `evaluateCharacterProfilePresence`
- `evaluateCharacterVoiceDifferentiation`
- `createNaturalnessReport`
- Possibly helper near `extractCharacterEvidenceWindows`.

Required GitNexus impact first:

```bash
target=evaluateCharacterProfilePresence
target=evaluateCharacterVoiceDifferentiation
target=createNaturalnessReport
```

Suggested tests:

- `character profile gate requires per-character evidence windows`
- `character voice gate uses dossier speech markers`
- `naturalness report flags flattened dialogue voices`

Acceptance:

- If dossier says character has clipped questions and ledger-corner habit, text should need evidence near that character name.
- If two characters only have generic `他说事情很复杂 / 她也很复杂` voice, gate should quarantine.
- If each character has distinct action/speech/relationship pressure, gate should pass.

### 2. NaturalnessAgent Anti-Template Expansion

Priority: P1.

Completed:

- Semantic preservation exists.

Still needed:

- Stronger checks for:
  - AI template prose.
  - Universal uplift endings.
  - Explanation-heavy dialogue.
  - Abstract emotion labels replacing action.
  - Same rhythm across all paragraphs.

Likely files:

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/tests/core.test.mjs`

Likely symbols:

- `createNaturalnessReport`
- `evaluateNarrativeStyleQuality`
- `formatNaturalnessReport`

Suggested tests:

- `naturalness report flags AI-template prose`
- `naturalness report flags universal uplift endings`
- `naturalness report flags explanatory dialogue`
- `naturalness report allows concrete action and sensory prose`

Acceptance:

- Do not block normal literary prose too aggressively.
- Should block obvious template/meta/report-style text.

### 3. Genre And Style Preset Library

Priority: P1.

Current state:

- `creativeProfile` exists.
- Style fingerprint exists.
- Project creation can accept genre/platform/readerPromise/pointOfView/tone/naturalnessTarget/styleFingerprint.

Still needed:

- A maintainable preset library inspired by reference projects.
- Presets for common web novel categories:
  - suspense
  - xuanhuan/fantasy
  - urban
  - romance
  - historical
  - infinite flow
  - sci-fi
  - mystery
  - cultivation
- Each preset should define:
  - reader promise
  - pacing
  - hook type
  - character archetype pressures
  - common chapter beat structure
  - naturalness rules
  - forbidden cliches
  - context priorities

Likely files:

- `packages/ai-novel-core/src/orchestrator.ts`
- `packages/ai-novel-core/resources/writing/*`
- Potential new resource file:
  - `packages/ai-novel-core/resources/writing/genre-presets.json`
  - or `packages/ai-novel-core/resources/writing/genre-presets/*.md`

Important:

- Avoid context explosion. Preset should be compact and selected by genre, not all injected every time.
- Use stable schema and only include relevant preset in writing prompts.

### 4. Context Budget Strategy

Priority: P1/P2.

Completed:

- Memory recall cache.
- UI context budget observability.

Still needed:

- Real per-section budget enforcement.
- Budget priorities:
  - current chapter blueprint
  - continuity contract
  - character dossier windows
  - previous chapter tail
  - memory recall
  - RAG citations
  - style/genre contract
- Warnings or blocking when budget exceeds thresholds.

Likely files:

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/src/discussion.ts`
- `packages/ai-novel-core/src/context-packet.ts`
- `apps/desktop/src/view-model.mjs`

Likely symbols:

- `loadAndPruneGlobalContext`
- `retrieveFactoryMemoryContext`
- context packet assembly functions.

Acceptance:

- Long projects should not inject full history.
- Each context part should have measured character/token-ish size.
- Tests should prove large memory does not explode prompt size.

### 5. DB/Memory Layer Refinement

Priority: P2.

Completed:

- Short TTL in-process cache for factory memory context recall.

Still needed:

- More systematic cache invalidation:
  - by project
  - by memory kind
  - by chapter
  - after writes to relevant memory
- Worker multi-process consistency strategy.
- Observability for recall cache hits/misses.

Likely files:

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/src/factory-db.ts`
- possibly a new cache helper module if complexity grows.

Warning:

- Keep DB as source of truth.
- Cache must never become workflow state.

### 6. Worker Longrun/Restart Stability

Priority: P2.

Completed:

- In-process longrun stability test using `advanceAutonomousProject`.

Still needed:

- Worker-process longrun test or script.
- Restart/recovery test:
  - start worker
  - begin production
  - interrupt/stop
  - restart worker
  - verify no duplicate chapters/jobs
- Manual 50/100 chapter pressure script.

Likely files:

- `packages/ai-novel-core/tests/longrun-stability.test.mjs`
- `packages/ai-novel-core/src/autopilot-worker.ts`
- `packages/ai-novel-core/src/worker.ts`
- Possible new script:
  - `packages/ai-novel-core/scripts/longrun-worker-stability.mjs`

### 7. Diagnostics Panel

Priority: P2.

Completed:

- Story Memory production health panel.

Still needed:

- Dedicated diagnostics panel for:
  - blocked chapters
  - latest gate reason
  - context budget overages
  - RAG recall quality
  - character dossier gaps
  - stale jobs / worker lease issues
  - memory embedding backlog

Likely files:

- `packages/ai-novel-core/src/studio-server.ts`
- `apps/desktop/src/view-model.mjs`
- `apps/desktop/app.js`
- `apps/desktop/style.css`
- `packages/opencode-ai-novel-factory/tests/autonomous-cli.test.mjs`

Risk:

- HIGH, because it touches snapshot/UI rendering paths.

### 8. Reference Project Capability Distillation

Priority: P2/P3.

Context:

- User cloned reference AI novel projects adjacent to this repo:
  - `inkos`
  - `MuMuAINovel`
  - `novelwriter`
  - `tianming-novel-ai-writer`
  - `webnovel-writer`
  - `WenShape`
- GitNexus has indexed them.

Still needed:

- Convert analysis into durable config/resources, not just prose.
- Extract reusable patterns:
  - style selection
  - genre choices
  - chapter workflow
  - context handling
  - naturalness strategies
  - role/character profile systems

Useful GitNexus query direction:

```bash
rtk proxy curl -s -X POST http://127.0.0.1:4867/tool/query \
  -H 'content-type: application/json' \
  -d '{"repo":"WenShape","query":"genre style selection novel creation"}'
```

Repeat for the indexed reference repos.

Acceptance:

- Reference ideas become project resources, presets, tests, or implementation.
- Do not inject all reference text into prompts.
- Avoid context explosion by selecting one preset/strategy at runtime.

## Known Risks And Lessons

### Naturalness Semantic Preservation False Positive

A previous version blocked same-draft self-checks because it treated hard rules as mandatory even if they were not present in the before draft.

Correct behavior:

- If `beforeDraft === afterDraft`, semantic preservation should normally pass unless actual text facts are inconsistent.
- Only require preservation of facts present in the before draft.

### `tsup --clean` Race

Running server and plugin tests in parallel can fail with ENOENT on core dist chunks because both clean/build `packages/ai-novel-core/dist`.

Run sequentially:

```bash
rtk npm --prefix packages/ai-novel-core test
rtk npm run test:server
rtk npm run test:plugin
```

### Snapshot/UI HIGH Risk

Any work touching these is HIGH risk:

- `createWorkspacePayload`
- `compactFactorySnapshotForPayload`
- `semanticFactorySnapshotForVersion`
- `renderStoryMemory`
- broad desktop rendering functions in `apps/desktop/app.js`

Proceed only with narrow additive changes and full tests.

## Suggested Next Implementation Prompt

Use this prompt for the next model:

> 请继续开发这个项目：/Users/pengfei.chen/Desktop/github/ai-novel-factory
>
> 先阅读：
> 1. AGENTS.md
> 2. docs/NEXT_AI_DEVELOPMENT_HANDOFF.md
>
> 必须遵守：
> - 不要回滚或改动无关脏文件：AGENTS.md、CLAUDE.md、.kunsdd/、.preview/、packages/ai-novel-core/scratch/
> - 修改函数/类/方法前必须用 GitNexus impact
> - 提交前必须用 GitNexus detect_changes
> - 提交后必须运行 rtk gitnexus analyze
> - 测试要顺序跑，不要并行跑 server 和 plugin，因为它们都会 clean/build core dist
>
> 当前已经完成：
> - Factory memory recall cache
> - NaturalnessAgent semantic preservation
> - Longrun stability test
> - Studio production observability panel
> - Multi-Model Config Manager & Robust Database Path Resolution
>
> 下一步优先做：
> 角色声音门禁强化。
>
> 目标：
> 让角色档案里的 behaviorHabits、speechMarkers、relationshipState、appearanceAndBody、skills、limitations 真正参与逐角色检测，防止多角色说话/行动同质化。需要基于每个角色附近的证据窗口判断，而不是只做全文宽松匹配。
>
> 建议涉及文件：
> - packages/ai-novel-core/src/writing-pipeline.ts
> - packages/ai-novel-core/tests/core.test.mjs
>
> 开始前先运行 GitNexus impact：
> - evaluateCharacterProfilePresence
> - evaluateCharacterVoiceDifferentiation
> - createNaturalnessReport
>
> 建议新增测试：
> - character profile gate requires per-character evidence windows
> - character voice gate uses dossier speech markers
> - naturalness report flags flattened dialogue voices
>
> 验收标准：
> - 如果两个角色只有模板化对白/动作，要 quarantine
> - 如果每个角色都有符合档案的语言习惯、行为习惯、关系压力、能力边界证据，要 pass
> - 不能造成正常章节生产误杀
> - 顺序运行并通过：
>   rtk npm --prefix packages/ai-novel-core test
>   rtk npm run test:server
>   rtk npm run test:plugin

## Current Clean/Dirty State At Handoff

Expected after this handoff document is created:

- New/modified handoff doc: `docs/NEXT_AI_DEVELOPMENT_HANDOFF.md`.
- Existing unrelated dirty files remain:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.kunsdd/`
  - `.preview/`
  - `packages/ai-novel-core/scratch/`

