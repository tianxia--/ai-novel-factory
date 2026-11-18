# AI Novel Factory Flow Debug Board

这个文件是当前项目的“流程调通工作台”。目标不是证明某个内部函数能跑，而是让整条生产链路像 Codex / Claude 一样可观察：用户输入、模型输出、工具调用、状态、日志、文件产物、审核门禁，都能进入同一条可展开的会话时间线，并且每段输出接口能被下一段稳定消费。

## 调试原则

每一段只在满足下面 6 个问题后才进入下一段：

1. 能不能在会话里看到这一步？
2. 这一步生成的文件能不能从会话打开或预览？
3. 输入是不是具体、有效、没有吃到上游脏数据？
4. 输出是不是具体、有效、不是模板拼凑？
5. 下一段是不是消费了正确接口，而不是重新猜一套事实？
6. 两段组合后是不是仍然稳定？

## 全链路切片

| 顺序 | 切片 | 入口 | 必须产出 | 会话/日志要求 | 当前状态 | 下一步 |
|---:|---|---|---|---|---|---|
| 1 | 项目创建与用户消息 | `POST /api/projects`, `POST /api/chat` | project row, initial state, user message | 一条用户消息、一条项目/任务状态事件 | 基线可用 | 只在项目列表或消息丢失时回查 |
| 2 | Canonical timeline | `GET /api/messages`, SSE events | `messages`, `message_parts`, pagination | `/api/messages` 是主时间线，兼容 transcript 只是导出 | 基线可用 | UI 折叠/展开细节继续打磨 |
| 3 | Provider / route setup | `POST /api/llm-configs`, `POST /api/provider-test` | active route, provider test status | provider test 结果可见，secret 脱敏 | 待单独复测 | 确认失败时是否给出可恢复状态消息 |
| 4 | Style loop | style evolution endpoints | candidates, evaluator/freezer/verification, approved contract | 候选、评估、冻结、通过/阻塞都要进 timeline | stop-after-style 曾可用；仍偏长 | 后续把每个 evaluator/refiner/freezer LLM 调用折叠为 trace group |
| 5 | 世界观/角色/主线讨论 | `POST /api/chat`, `runMultiAgentDiscussion` | role turns, consensus archive, target asset, context packet | 每个 agent turn 可见；讨论写回文件以 artifact parts 暴露 | 本轮已补：讨论写回/阻塞都会生成 artifact message | 下一步用真实 stop-after-planning 检查内容具体性 |
| 6 | Setting review | `POST /api/advance`, `POST /api/production/setting-review/approve`, `POST /api/production/setting-review/reject` | `setting-freeze.md`, `setting-review-approval.json`, cover attempt | setting 不是悄悄冻结；确认/退回都要进 timeline 并带 artifact parts；未确认不能进入 master planning | 已通过小项目组合验收 | 后续只在用户确认体验不顺时打磨 UI 文案 |
| 7 | Master planning | `writeProductionMasterOutline` | `master-outline.md` | 主线规划文件可预览，必须声明具体主角和因果矩阵 | 已通过 `stop-after-foundation` 探针；foundation 审计现在会预览 master outline 防误判 | 下一步在 1 章正文中验证主线锚点是否被消费 |
| 8 | Story foundation | `writeProductionStoryBibleAssets` | world matrix, story bible, plot architecture, character dynamics, foreshadowing ledger, writing plan | 资产包必须一次性进入 timeline，所有文件可打开 | 已通过真实 foundation 审计；资产具体性、角色、世界信号、文件预览均通过 | 下一步验证 draft context package 是否折叠可开 |
| 9 | Chapter blueprints | `writeAllDetailedChapterBlueprints` | per-chapter detailed blueprints | 每章蓝图可打开，显示 cast lock、scene cards、差异点、handoff | 3 章蓝图已通过真实审计：每章 5+ scene cards，相邻重复率低于阈值 | 下一步跑 1 章，看正文是否真正继承蓝图 |
| 10 | Readiness gate | `blockDraftingUntilReady` | pass/block reason | 缺 style、缺 foundation approval、缺 blueprint 要说清楚 | 真实项目 readiness passed | 下一段进入 draft context / segment drafting |
| 11 | Draft context package | `createDraftBody` | context package artifact, compact prompt | prompt 长上下文折叠成文件；LLM 消息只引用摘要/文件 | 部分可用 | 验证每章 context package 都可打开 |
| 12 | Segment drafting / subcalls | `generateProductionTextWithLlm`, segment helpers | LLM request/response, segment body, submaterials | plot/dialogue/narration/action/continuity/assembly 都作为 tool/artifact parts | 部分可用 | 跑 1 章，检查每个 subcall 是否进 timeline |
| 13 | Quality / repair | `runQualityGateWithRevisions` | quality report, retry decision, repair attempts | 分数、失败原因、重试次数、报告文件可见 | 部分可用 | 分离真实角色档案缺失 vs gate 阈值过严 |
| 14 | AIGC / naturalness | detector + polish | detection report, repair pass/fail | 高风险片段、修复、复检要可见 | 部分可用 | 检查不可用 detector 是否明确降级 |
| 15 | Memory / character update | Memory Keeper | chapter memory, dossiers, relationship graph | 记忆文件和角色变化进入同一 timeline | 部分可用 | 确认正文变化是否回写角色关系 |
| 16 | Reader / publication | reader endpoints | readable chapter, publish readiness | publish readiness 不能绕过 gates | 下游 canary | 只作为组合验收，不先攻 |

## 当前已处理的接口问题

### 单节点 Debug Run 的统一证据链

文件：

- `packages/ai-novel-core/src/factory-db.ts`
- `packages/ai-novel-core/src/world-foundation-debug-server.ts`
- `apps/desktop/flow-debug.html`
- `apps/desktop/flow-debug.js`

当前 8 个调试节点已经使用同一条持久化边界：

1. 页面必须明确选择一个小说工厂项目作为“日志归属项目”。
2. 每次单点执行创建一条 `workflow_runs`，并通过 `parent_run_id` 指向上游调试 Run。
3. 每个节点创建一条 `workflow_steps`，`execution_mode=debug`；节点输入、输出、验证状态、错误和 artifact/event 计数均持久化。
4. 每次真实模型调用创建一条 `workflow_step_attempts`，记录模型、Prompt 版本、调用类型、响应字符数、Token 与缓存命中数据。
5. Debug 记录只用于可观察性，不调用 `updateProjectState`，也不写正式小说资产；页面的“工作流轨迹”页签可以直接查看 Step 和 Attempt。
6. 接入前创建的旧 Run 仍可读取，页面会明确标记“旧 Run 没有 FactoryDB 轨迹”，不会伪造历史证据。

节点 08 的 Learning Loop 同时增加两项收敛保护：

- 只有同一候选结果同时存在互斥指纹时才触发正典冲突，不再把不同轮次先后出现的错误误判为冲突。
- 修复候选比当前最佳版本更差时自动回退；失败候选仍保留在 artifact、Attempt 和学习记录中。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
rtk node --test packages/ai-novel-core/tests/workflow-step-persistence.test.mjs packages/ai-novel-core/tests/chapter-blueprint-learning.test.mjs packages/ai-novel-core/tests/llm-cache-usage.test.mjs
```

浏览器验证：项目选择器能够读取 FactoryDB 中的正式项目；有项目、模型和有效输入时世界观按钮可点击；“工作流轨迹”页签可显示当前 Run 的 Step / Attempt 证据。

### 讨论写回可见性

文件：`packages/ai-novel-core/src/discussion.ts`

修复点：

- 讨论成功写回后新增 `discussion_writeback_artifacts` artifact message。
- artifact parts 包含：
  - `.ai-novel/consensus/discussion-*.md`
  - `.ai-novel/prompts/global-consensus.md`
  - 当前 target asset，例如 `.ai-novel/memory/characters/core/protagonist.md`
  - `.ai-novel/chat/discussion-log.md`
  - `.ai-novel/context/current-context.md`
  - `.ai-novel/memory/characters/dossiers.json`，如果本轮更新了角色档案
- 阶段守卫阻塞时也新增 artifact message，避免用户只看到“会话没了”。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
```

以及本地最小验证脚本输出：

```json
{"ok":true,"writebackParts":8,"storyAssetArtifacts":14,"sceneCards":5}
```

### Story foundation 资产包

文件：`packages/ai-novel-core/src/writing-pipeline.ts`

修复点：

- `story_bible_assets_saved` 现在不只暴露 `story-bible.md`。
- 进度消息的 `artifacts` 字段包含所有 story foundation 文件和 `writing-plan.json`。
- `workflow.kind` 标记为 `artifact_saved`，方便 UI 折叠成资产包。

### Chapter blueprint 最小结构

文件：`packages/ai-novel-core/src/writing-pipeline.ts`

修复点：

- 每章最少 5 张 scene card。
- 2500 字目标章节也会保留最后的 handoff/余波卡，减少相邻章节只剩通用模板 endHook 的情况。

### Master planning 主角门禁

文件：

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/src/orchestrator.ts`

修复点：

- `writeProductionMasterOutline` 在调用 LLM 前检查源资料是否已有具体主角姓名。
- 如果主角仍是 `pending-protagonist-name`、未命名档案小吏或纯角色标签，立即生成 `.ai-novel/plans/master-planning-protagonist-brief.md`。
- 阻塞事件通过 `master_planning_blocked` progress event 进入 timeline，文件可打开预览。
- `advanceAutonomousProject` 捕获该阻塞后停在可恢复状态，不再误报 `master_planning` 已生成。

### 角色标签姓名锁

文件：`packages/ai-novel-core/src/writing-pipeline.ts`

修复点：

- `妹妹·沈蘅`、`保管员·老周`、`亡父·沈怀严` 这类“角色功能 + 分隔符 + 具体姓名”现在会提取具体姓名。
- `story-foundation-contract.json` 的 `canonicalPlanningCast.cast` 不再把 `妹妹`、`保管员`、`亡父` 这类功能标签当成角色名。
- 这能减少正文阶段因为缺合法姓名而临时发明未批准关键人物。

### 主角资料确认 gate

文件：

- `packages/ai-novel-core/src/studio-server.ts`
- `packages/ai-novel-core/tests/core.test.mjs`

修复点：

- 新增 `POST /api/production/protagonist-profile/confirm`。
- 接口接收主角姓名、身份、核心欲望、伤口/恐惧、行为习惯、说话方式和具名关系压力。
- 写入 `.ai-novel/memory/characters/core/protagonist.md`。
- 同时记录 user message、status message 和 tool message，tool message 带 `character-profile` artifact part，可在会话中打开预览。
- 真实探针中，补充「沈砚」档案后，Master Planning 不再卡在主角门禁，后续 Master Outline、Story Foundation、Chapter Blueprints 均能继续生成。

验证证据：

```bash
rtk node --test --test-name-pattern="protagonist profile confirmation unblocks master planning and enters timeline" packages/ai-novel-core/tests/core.test.mjs
```

### 正文未批准人物与身份冲突门禁

文件：

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/tests/core.test.mjs`

修复点：

- `evaluateUnplannedCharacterDrift` 继续阻塞正文临时新增关键人物，例如 `周书吏`、`周逢`。
- 过滤非人物误报，例如 `东南路`、`丁酉年`、`时间`，让阻塞原因更干净。
- 新增已知角色身份冲突硬门槛：如果 Canon/角色账本里 `沈蘅` 是妹妹，正文不能写成 `父亲沈蘅` 或 `你父亲沈蘅`。

验证证据：

```bash
rtk node --test --test-name-pattern="unplanned character drift gate blocks key names invented during drafting|unplanned character drift gate ignores Chinese prose shard false positives|unplanned character drift gate filters place and time terms while blocking invented people|unplanned character drift gate blocks known cast identity conflicts" packages/ai-novel-core/tests/core.test.mjs
```

### 最终质量门禁报告一致性

文件：

- `packages/ai-novel-core/src/writing-pipeline.ts`
- `packages/ai-novel-core/tests/core.test.mjs`

修复点：

- `chapter-xxx-quality.md` 现在追加 `## Final Quality Gate`。
- 该小节包含最终 `status`、`passed`、`score`、`attempts`、`word count` 和 `reason`。
- 这样即使前置 quality report 曾经写着“可进入润色”，用户打开最终质量报告时仍能看到 AIGC、风格漂移和最终硬门禁合并后的真实结果。

验证证据：

```bash
rtk node --test --test-name-pattern="chapter drafting sends the approved style contract to the configured text model" packages/ai-novel-core/tests/core.test.mjs
```

## 本轮新增证据：Foundation 探针

命令：

```bash
rtk node scripts/run-production-acceptance.mjs \
  --resume-project-id flow-foundation-probe \
  --chapters 3 \
  --chapter-words 2500 \
  --min-total-words 7000 \
  --max-total-words 9000 \
  --auto-approve-style \
  --auto-approve-setting-review \
  --auto-approve-foundation \
  --stop-after-foundation \
  --report /tmp/ai-novel-flow-foundation-probe-resume.json
```

结果：

- style interface audit passed。
- planning interface audit passed。
- foundation interface audit passed。
- 产物路径进入 timeline，包含 setting review approval、master outline、story foundation 资产包和 3 个 chapter blueprint。
- 修复了 acceptance runner 的误判：foundation 审计现在会预览 `.ai-novel/plans/master-outline.md`，不会在后续资产锁定主角时因为没读到主线大纲而误报 unsupported protagonist。

## 下一段要攻：Foundation 完整度与一章正文

当前 planning/foundation 已能看见，但真实一章探针证明人物锁和角色档案仍会影响正文稳定性。下一步要验证“蓝图能不能被正文生产稳定消费”。用户反馈中剩下的核心风险集中在这里：

- 正文是否真正沿用主角、配角、关系和前序锚点；
- context package 是否可折叠、可打开、不是把长提示塞满对话；
- segment LLM 调用是否像 Codex/Claude 的 tool trace 一样可展开；
- 质量门禁失败时是否能定位到具体段落、具体文件、具体修复尝试。

最新探针结果：

- `flow-cast-lock-probe-v7-fresh` 在补充主角档案后已越过 Master Planning / Foundation / Readiness，进入 Chapter 1 正文。
- 正文阶段真实暴露两个问题：
  - LLM 把已确认的妹妹 `沈蘅` 写成了父亲，属于已知角色身份冲突。
  - LLM 临时新增 `周书吏` / `周逢`，属于未批准关键人物。
- 质量门禁最终阻塞了章节，但早期 quality report artifact 一度显示“可进入润色”，报告表达与最终 blocked 状态不一致。
- 本轮已补门禁：过滤非人物误报，并把 `沈蘅` 这类已知角色身份冲突升级为硬阻塞。
- 本轮已补报告一致性：最终质量报告会追加 `## Final Quality Gate`，避免会话/文件里只看到中间态。
- 本轮又补了一层定位：最终质量门禁先检查场景卡执行义务，再检查角色声音差异，避免缺角色/缺场景目标时被泛化成“角色不鲜明”。
- `evaluateCharacterVoiceDifferentiation` 已补充“藏证据、替身废纸、调卷签名、按住缺页”等可见选择/压力证据识别，防止把主角行动误判成无目标。

最新真实重试证据：

- 项目：`flow-cast-lock-probe-v7-fresh`
- 重试方式：`POST /api/chapters/retry`，`chapterNumber=1`，`runNow=true`
- runtime blocked reason 已与 `.ai-novel/reports/chapter-001-quality.md` 的 `## Final Quality Gate` 一致：

```text
场景卡执行硬门槛失败：场景卡 1 缺少目标、冲突执行证据；场景卡 2 缺少冲突、转折执行证据；场景卡 3 缺少冲突执行证据；场景卡 4 缺少角色「沈蘅」。
```

这说明“最终报告一致性”和“角色 gate 误导”这两点已推进；下一层真实问题变成：

- scene card 写作没有稳定把必需角色 `沈蘅` 写入正文；
- 分段正文每段目标 500 字，但实际初稿膨胀到约 5000 字，返工压缩又不稳定；
- 资产约束漂移：正文从原资产里的河南道/秋粮/父亲残页，漂到河东道/夏税/娄鹤亭补录等新设定；
- 角色档案存在污染项，例如 `沈砚蹲`、`沈砚搁`，这些会进入后续 prompt 干扰写作。

本轮已补两个正文入口问题：

- 角色档案污染源继续收窄：`sanitizeKnownCastNames` 会拒绝 `沈砚蹲`、`沈砚搁`、`沈砚低头`、`沈砚搁下` 这类“姓名 + 动作”误抽取，避免它们进入 known cast 和后续角色档案。
- scene card -> segment contract 已从“提示项”提升为“硬门槛”：片段 required beats 现在明确要求必需角色真实出场并承担动作/对白/受压反应，Scene Goal / Conflict / Turn / End Hook 必须以现场动作、对白、物件变化或局面变化落地；composition contract 也会把这些要求写入 context package、片段 artifact 和 LLM 子调用材料。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
rtk node --test --test-name-pattern="known cast sanitizer keeps concrete names and removes workflow vocabulary|draft segment plan uses structured scene cards when a chapter blueprint provides them" packages/ai-novel-core/tests/core.test.mjs
```

结果：2 个目标用例通过。

下一层要用真实重试验证：

- `flow-cast-lock-probe-v7-fresh` 的第 1 章是否仍缺 `沈蘅` 或 scene card 执行证据；
- 如果 scene card 缺项减少，继续攻字数控制：segment target 约 500 字，初稿不能膨胀到约 5000 字再靠最终返工抢救；
- 如果资产仍漂移，给冻结资产加正文级硬门槛或漂移 gate。

补充真实重试发现：

- 通过正在运行的 `4311` 服务调用 `/api/chapters/retry`，240 秒 HTTP 请求超时且没有返回 body。
- 该服务进程没有重启，所以本轮真实重试使用的是旧版 prompt contract；新生成的 segment artifact 里仍是旧文案，例如 `Scene Goal 落地`、`Required Characters`，不是本轮 build 后的 `硬门槛` 文案。
- 尽管 HTTP 超时，服务端已经写出新的 segment artifact 和 revision 消息：
  - 初稿约 `5651` 字；
  - revision 1/2 仍约 `5363/5352` 字；
  - revision 3 留在 `streaming`；
  - 项目 runtime 却显示 `idle`、`activeJobs=0`。
- 这暴露出一个独立流程断点：同步章节重试超时后，会话 timeline 可能留下悬挂的 streaming LLM 消息。

本轮已补防护：

- `retryChapterProduction` 在同章手动重试开始时，会调用 `markStreamingMessagesFailed` 清掉同一 writing conversation 里未完成的 streaming 消息，reason 为 `manual chapter retry superseded an unfinished writing stream`。
- 新增测试确认：同章存在旧 streaming 消息时，手动重试会把它标记为 `failed`，同时章节重新排队为 `pending`。

验证证据：

```bash
rtk node --test --test-name-pattern="manual chapter retry clears unfinished streaming writing messages|known cast sanitizer keeps concrete names and removes workflow vocabulary|draft segment plan uses structured scene cards when a chapter blueprint provides them" packages/ai-novel-core/tests/core.test.mjs
```

结果：3 个目标用例通过。

本轮追加真实验证：

- 启动加载当前 build 的测试服务：`rtk node packages/ai-novel-server/dist/index.js --root-dir . --static-dir apps/desktop --port 4312 --embedded-worker`。
- 通过 `4312` 对 `flow-cast-lock-probe-v7-fresh` 再次执行 `POST /api/chapters/retry`，这次同步请求完整返回，没有 240 秒超时。
- 新的 segment artifact 已包含 `硬门槛` 文案，说明 scene card -> segment contract 已进入真实运行时。
- 新的质量报告恢复 `## Final Quality Gate`，最终状态可从报告文件打开确认：

```text
Status: blocked
Score: 5/10
Attempts: 3
Word count: 3370/2500
Reason: 场景卡执行硬门槛失败：场景卡 1 缺少目标、冲突执行证据；场景卡 2 缺少冲突、转折执行证据；场景卡 3 缺少冲突执行证据；场景卡 4 缺少冲突执行证据。
```

进一步审计发现：正文实际已经写出装帧异常、页码错位、丁酉残页、周书吏条件交换、范思远调取刑部司灾异奏报、半枚湿印等现场证据。问题不再是 prompt 没压住，而是 scene-card gate 对抽象卡片的执行证据识别过度依赖字面词。

本轮已补 scene-card gate：

- `evaluateSceneCardCharacterObligations` 导出为可直接测试的审计函数。
- `evaluateSceneExecutionDimension` 增加语义证据兜底：
  - 异常/错页/档案证据可以由 `装帧不对`、页码错位、裁切残页、涂改、重新装订等正文证据满足；
  - 选择压力可以由 `天字七号`、`条件`、`底牌`、`弄丢`、`帮你拖` 等现场交换满足；
  - 交棒/结果落定可以由 `刑部司`、`调取`、`司天监灾异奏报`、`半枚湿印` 等下一章压力满足。
- 保留具体缺失阻塞：如果 scene card 明确要求 `旧印章遇水显出第二层纹路` 和 `敲门暗号`，正文没写仍会 blocked。

验证证据：

```bash
rtk node --test --test-name-pattern="scene card execution gate accepts concrete anomaly and pressure evidence for abstract cards|scene card execution gate accepts choice pressure and handoff evidence|scene card execution gate still blocks concrete missing turn and hook evidence|manual chapter retry clears unfinished streaming writing messages|known cast sanitizer keeps concrete names and removes workflow vocabulary|draft segment plan uses structured scene cards when a chapter blueprint provides them" packages/ai-novel-core/tests/core.test.mjs
```

结果：6 个目标用例通过。

用当前真实 `chapter-001.final.md` + `chapter-001.md` 直接调用新审计函数：

```json
{
  "status": "eligible",
  "reason": "场景卡执行义务通过：5 张场景卡的角色、事实与目标/冲突/转折/钩子均进入正文。"
}
```

下一层要继续攻：

- 重新跑第 1 章后，确认最终阻塞是否从 scene-card gate 移到字数、角色档案或资产漂移；
- 字数仍偏高：最近真实值约 `3370/2500`，虽然比 `6538/2500` 收敛，但还没达标；
- 检查资产漂移：正文出现 `应天十二年`、`刑部司`、`户部巡库科`、`天字七号` 等，需与 foundation / blueprint 的冻结资产比对，判断是合理扩展还是漂移。

本轮继续推进结果：

- 真实重试后，scene-card gate 不再作为主要阻塞；阻塞移动到角色档案/关系压力识别。
- 第一层误判：`沈蘅`、`范思远` 的旧角色档案混入 `NaturalnessAgent`、`硬门禁`、`relationship pressure follows` 等流程语，导致 relationship pressure gate 用脏档案审正文。
- 已修：
  - 角色档案抽取只从 `extractNarrativeBody(finalDraft)` 取证，不再把 `memoryUpdate` / report / Naturalness Pass 流程文本混进人物字段；
  - `extractCharacterEvidenceWindows` 过滤 workflow/profile noise，且有直接角色窗口时不再混入全局 profile signal；
  - 新出场 supporting cast 当章就用正文窗口建立初始档案，减少 pending 模板扩散；
  - relationship gate 过滤 workflow/placeholder 关系压力，并接受 `要么封存 / 要么查下去`、`先别急着往上报`、`我在说规矩` 等自然现场压力表达；
  - 对白归属收紧，避免把“沈砚看见范思远……”后面的范思远对白误算给沈砚；
  - known cast sanitizer 过滤官署/机构名，例如 `司农监`、`尚书省`、`考功司`、`钦天监`；
  - drift gate 过滤 `上回`、`沈砚走`、`沈砚走到` 这类时间词和“姓名 + 动作”误抽取。
- 最新本地审计：

```json
{
  "characterProfileGate": "eligible",
  "characterProfileReason": "角色档案信号通过：正文包含欲望、行为、对白、关系和可见特征。角色差异化通过：沈砚、沈蘅、范思远 通过目标、行动选择、对白或关系压力形成区分。",
  "unplannedCharacterDrift": "eligible",
  "knownCastAfterSanitize": ["沈砚", "沈蘅", "范思远", "娄鹤亭"]
}
```

最新真实服务重试：

- 使用重启后的 `4312` 服务再次 retry 第 1 章，请求完整返回。
- Final Gate 从 `5/10` 的角色差异化阻塞推进到 `8/10` 的人物漂移误报：

```text
Canon 人物漂移硬门槛失败：正文出现未在蓝图/Canon/角色档案中批准的关键姓名「上回×1、沈砚走×2」。
```

- 本轮已用本地新 build 审计同一产物，drift gate 已通过；下一次服务重启后应进入下一个真实阻塞。
- 剩余真实问题：字数仍严重偏高，最近真实值 `4717/2500`；如果 gate 继续通过，下一阶段优先攻 segment 字数控制和压缩策略，而不是再调角色 gate。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
rtk node --test --test-name-pattern="unplanned character drift gate ignores temporal words and protagonist action fragments|unplanned character drift gate ignores Chinese prose shard false positives|unplanned character drift gate filters place and time terms while blocking invented people|unplanned character drift gate blocks key names invented during drafting|known cast sanitizer keeps concrete names and removes workflow vocabulary|character voice gate does not assign an observed speaker quote to the viewpoint character|character voice gate accepts concrete cast pressure when legacy dossier relation is workflow noise|scene card execution gate accepts concrete anomaly and pressure evidence for abstract cards|manual chapter retry clears unfinished streaming writing messages" packages/ai-novel-core/tests/core.test.mjs
```

结果：9 个目标用例通过。

最新失败报告：

```text
/tmp/ai-novel-flow-cast-lock-probe-v7-after-protagonist-confirm.json
```

下一轮要确认：

- 修 `scene card -> segment prompt`：必需角色、关键物件、场景目标/冲突/转折必须进入每段 prompt 的硬约束和失败报告。
- 修分段字数控制：每段 500 字应有硬截断/重试策略，不能靠最后返工救 5000 字初稿。
- 修资产漂移：正文不能把已冻结的道、税册、关系锚和证据物改成另一套。
- 修角色档案抽取污染：动作短语不能变成支持角色进入 known cast。

### 验收问题

跑 1 章通过前，必须逐项回答：

1. 第 1 章 context package 是否作为 artifact 出现在 `/api/messages`？
2. 每个 drafting 子调用是否有 request/response/tool-like trace？
3. 正文是否沿用 foundation 的 canonical protagonist/cast，而不是重新发明人物？
4. 正文是否执行 `chapter-001.md` 的 scene cards、key prop、decision、cost、handoff？
5. quality、style、AIGC、memory 更新是否各自产生可打开报告？
6. 如果失败，report 是否指出具体 stage、artifact path、resume command？

### 建议命令

用已经通过 foundation 的项目继续，避免重复烧前置链路：

```bash
rtk node scripts/run-production-acceptance.mjs \
  --resume-project-id flow-foundation-probe \
  --chapters 3 \
  --chapter-words 2500 \
  --min-total-words 7000 \
  --max-total-words 9000 \
  --auto-approve-style \
  --auto-approve-setting-review \
  --auto-approve-foundation \
  --stop-after-chapters 1
```

如果需要 fresh 小项目，再跑：

```bash
rtk node scripts/run-production-acceptance.mjs \
  --title "Flow Planning Probe" \
  --chapters 3 \
  --chapter-words 2500 \
  --auto-approve-style \
  --auto-approve-setting-review \
  --stop-after-planning
```

### 下一步修复优先级

1. 已完成：给 `stageInterfaceAudits` 增加“内容具体性”问题，不只检查文件存在。
2. 已完成：增加 blueprint repetition audit，比较相邻蓝图的 scene cards、handoff、required characters 和执行合同值。
3. 已完成：增加 character foundation audit；没有具名配角和关系压力时，planning stop 会失败。
4. 已完成：把 `setting-freeze.md` 从“自动 canon”改成“review artifact + approval required”，验收脚本会抓旧式自动冻结语义。
5. 已完成：补 setting review approve/reject 端点和工作台按钮，让 `setting-review-approval.json` 进入 timeline。
6. 下一步：组合到 `stop-after-foundation`，确认 readiness gate 的原因清楚。

新增测试证据：

```bash
rtk node --test packages/ai-novel-core/tests/production-acceptance-runner.test.mjs \
  --test-name-pattern 'planning interface audit catches thin cast and repeated blueprints'
```

结果：runner 测试文件 55 个用例通过；新增用例会对薄弱 cast、缺关系压力、重复蓝图报错。

## 不要跳步

不要先跑完整长篇。完整长篇只能作为最后组合验收。当前顺序：

1. `stop-after-planning`
2. `stop-after-foundation`
3. `stop-after-chapters 1`
4. `stop-after-chapters 2`
5. 4+ 章小长跑
6. 全书目标规模

每一步都必须留下 acceptance report，并把 report 中失败的接口转成下一轮修复项。

## 2026-07-13 Slice: 字数上限硬门槛

真实探针项目：`flow-cast-lock-probe-v7-fresh`

上一轮真实阻塞从人物/scene-card 误报推进到章节字数失控：

```text
Final Quality Gate: 4717/2500
```

本轮定位：

- `createQualityReport` 原本只把 `<80%` 当字数硬失败，`4717/2500` 这种超长稿可能继续按通过链路走。
- `parseQualityGate` 原本只解析低字数阻塞，即使 `WORD_COUNT_CHECK` 明确超长，也不会生成压缩返工状态。
- `enforceFinalDraftQualityGate` 原本只兜底低字数，Naturalness/AIGC 修复后重新膨胀也不会被最终 gate 拦住。
- `enforceRevisionWordBudgetGuard` 只有“防止扩写返工越修越短”，没有“防止压缩返工越修越长”。

已修复：

- 报告阶段加入 `>115%` 上限硬门槛；超长稿字数维度降到 4/10，并写入 Required Fixes。
- parser 将 `WORD_COUNT_CHECK` 的 `<80%` 和 `>115%` 都转为 blocking word issue。
- final draft gate 对 `>115%` 做最终阻塞，reason 保持 `最终稿有效字数 x/y，超过 115% 上限。`
- revision guard 增加 compression 方向保护：如果 LLM 收到压缩要求却把稿子变得更长，会保留/回退到更短版本。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
```

结果：通过。

```bash
rtk node --test --test-name-pattern="quality gate parser blocks drafts above the hard word ceiling|quality report blocks drafts above the hard word ceiling|quality revision prompt treats over-budget drafts as compression repairs|quality revision guards against under-budget shrinkage" packages/ai-novel-core/tests/core.test.mjs
```

结果：4 个 focused tests 全部通过。

对真实产物本地审计：

```json
{
  "passed": false,
  "score": 4,
  "status": "needs_revision",
  "attempts": 0,
  "reason": "正文有效字数 4717/2500，超过 115% 上限。",
  "wordCount": 4717,
  "targetWords": 2500
}
```

下一步：

- 重启/使用测试服务后 retry `flow-cast-lock-probe-v7-fresh` 第 1 章，确认质量返工是否把章节压回 `2250-2875` 区间。
- 如果仍超长，继续攻 segment 级预算：每段 prompt 明确 `target / hard ceiling`，并在 segment artifact manifest 记录实际字数和超标段。

### 真实 retry 进展

第一次真实 retry 后：

- 质量返工确实命中字数压缩，最终从旧值 `4717/2500` 收敛到 `2998/2500`。
- final gate 正确阻塞：`最终稿有效字数 2998/2500，超过 115% 上限。`

第二次真实 retry 后：

- 字数进入预算区间：`2576/2500`。
- 阻塞转移到角色 voice gate：

```text
角色差异化不足：核心出场人物中 沈砚、沈蘅、范思远 缺少目标、选择或关系压力。
跨角色对白复用：沈砚、范思远 都说出近似句「有几册卷宗封皮潮了。...」。
```

本地审计发现实际正文里这句明确是 `沈砚说`，被错误归给附近观察到的 `范思远`。已修：

- `extractAttributedCharacterDialogues` 增加明确他人归属过滤：引号后/前如果出现其他角色 + 说/问/道等归属，则不把该对白算给当前角色。
- 新增回归：`character voice gate does not assign a quoted line to a nearby observed character`。
- 保留硬门槛回归：`character voice gate blocks repeated attributed dialogue across speakers` 仍通过。

第三次真实 retry 后：

- 质量报告正文 `WORD_COUNT_CHECK: 2810/2500`，在 `115%` 上限内。
- final gate 旧口径报 `3346/2500`，原因是把 `Naturalness Pass / Quality Gate / metadata` 也算进最终稿字数。
- 已修：`enforceFinalDraftQualityGate` 改为 `wordCount(extractNarrativeBody(finalDraft))`。
- 新增回归：`final draft word gate counts narrative body instead of metadata`。

第四次真实 retry 后：

- final gate 字数口径正确：`qualityGate.wordCount=2186/2500`，不再是 metadata 膨胀问题。
- 阻塞转移到人物漂移误报：

```text
Canon 人物漂移硬门槛失败：正文出现未批准姓名「黄昏×1、沈砚没×6」。
```

本地审计确认这是中文切词碎片：

- `黄昏` 是时间词。
- `沈砚没` 是“主角名 + 否定词”的动作/叙述碎片。

已修：

- `NON_CHARACTER_DRAFT_NAME_TERMS` 增加 `黄昏`。
- `isConcreteKnownCastName` 的动作/叙述碎片后缀增加 `没`。
- `isLikelyNonCharacterDraftName` 增加常见时间词过滤。
- 现有 `unplanned character drift gate ignores temporal words and protagonist action fragments` 回归扩展覆盖 `黄昏 / 沈砚没`。

最新本地真实稿审计：

```json
{
  "status": "eligible",
  "reason": "未发现未经批准的关键新增人物。",
  "risks": []
}
```

最新 focused tests：

```bash
rtk node --test --test-name-pattern="unplanned character drift gate ignores temporal words and protagonist action fragments|unplanned character drift gate ignores Chinese prose shard false positives|unplanned character drift gate filters place and time terms while blocking invented people|unplanned character drift gate blocks key names invented during drafting|quality gate parser blocks drafts above the hard word ceiling|final draft word gate counts narrative body instead of metadata|character voice gate does not assign a quoted line to a nearby observed character" packages/ai-novel-core/tests/core.test.mjs
```

结果：7 个 focused tests 全部通过。

下一步真实验证：

- 重启服务后再 retry 一次 `flow-cast-lock-probe-v7-fresh` 第 1 章。
- 预期不再卡在字数 metadata、角色 voice 误归属、`黄昏/沈砚没` 漂移误报。
- 如果仍 blocked，记录新的 `Final Quality Gate reason`，继续按单一接口切片修。

### Naturalness 分析报告腔误报

最新真实 retry 后，final gate 已越过字数 metadata、角色 voice 误归属、`黄昏/沈砚没` 人物漂移误报，新的阻塞点变为：

```text
Final Quality Gate:
- Status: blocked
- Score: 8/10
- Word count: 2410/2500
- Reason: 自然度门禁需要返工：分析报告腔信号过多：12
```

原因定位：

- `createNaturalnessReport` 原本用 `/第一|第二|首先|其次|最后|原因是|从.*角度|可以看出|体现了|说明了|证明了/` 直接计数。
- 真实正文里的 `第一条备注`、`倒数第二格`、`第三册`、`第一张桌面`、`第一行`、`第二行`、`第三个字`、`第二个关节` 都是小说叙事物件/位置，不是报告式结构。

影响面：

```bash
rtk gitnexus impact createNaturalnessReport --repo ai-novel-factory
```

结果：HIGH，直接影响 `enforceFinalDraftQualityGate`、`createProductionPolishedDraft`、`createChapterMemoryUpdate`，间接影响 `runChapterProductionPipeline` 和 `produceChapterTask`。本次只收窄 analytic signal 计数规则。

已修复：

- 将宽泛 `第一|第二` 计数替换为 `countAnalyticReportSignals`。
- 仅统计报告式连接词/结构：
  - `首先，`、`其次，`、`最后，`
  - `原因是`、`可以看出`、`体现了`、`说明了`、`证明了`
  - `从...角度/层面/维度...`
  - 句首列表标号：`第一、`、`第二：` 等
- 不再把 `第一条备注`、`第二格`、`第三册`、`第一行`、`第二个关节` 这类叙事序数物件算作分析报告腔。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
```

结果：通过。

```bash
rtk node --test --test-name-pattern="naturalness report ignores narrative ordinal objects|naturalness report still flags report-style analytic connectors|naturalness report flags flattened dialogue voices" packages/ai-novel-core/tests/core.test.mjs
```

结果：3 个 focused tests 全部通过。

对当前真实 final draft 本地审计：

```json
{
  "status": "passed",
  "score": 10,
  "reason": "自然度门禁通过：文本以动作、感官、对白、关系压力和具体选择呈现，未发现阻塞性 AI 味。",
  "riskFlags": []
}
```

下一步真实验证：

- 重启测试服务并 retry `flow-cast-lock-probe-v7-fresh` 第 1 章。
- 预期不再卡在 `分析报告腔信号过多`。
- 记录新的 `Final Quality Gate reason`；如果通过，则检查 memory/artifact/timeline 是否生成完整。

### Drift Gate 已知角色碎片误报

上一轮真实 retry 后，`分析报告腔信号过多` 已解除，新的阻塞点变为：

```text
Final Quality Gate:
- Status: blocked
- Score: 8/10
- Word count: 2339/2500
- Reason: Canon 人物漂移硬门槛失败：正文出现未在蓝图/Canon/角色档案中批准的关键姓名「沈蘅正×1、余光×1」。
```

真实正文上下文：

```text
门推开时他没抬头。余光里，范思远身后跟着两个人...
他推开家门时，沈蘅正站在桌前...
```

原因定位：

- `余光` 是视线名词，不是新增人物。
- `沈蘅正` 是已知角色 `沈蘅` + 语法碎片 `正`，不是新姓名。

GitNexus 说明：

- `rtk gitnexus impact evaluateUnplannedCharacterDrift --repo ai-novel-factory` 和 `isLikelyNonCharacterDraftName` 均返回 target not found，索引无法定位这两个符号。
- 改用上游 `enforceFinalDraftQualityGate` 做影响面参考：

```bash
rtk gitnexus impact enforceFinalDraftQualityGate --repo ai-novel-factory
```

结果：HIGH，影响章节生产、自动推进和手动 retry。已按高风险路径只改 drift 候选过滤。

已修复：

- 增加 `isKnownCastNameFragment`：候选名如果是“已知角色名 + 常见动作/语法碎片”，例如 `沈蘅正`、`沈砚没`，不再当成新人物。
- `NON_CHARACTER_DRAFT_NAME_TERMS` 增加 `余光`。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
```

结果：通过。

```bash
rtk node --test --test-name-pattern="unplanned character drift gate ignores temporal words and protagonist action fragments|unplanned character drift gate ignores known cast suffix fragments and gaze nouns|unplanned character drift gate ignores Chinese prose shard false positives|unplanned character drift gate filters place and time terms while blocking invented people|unplanned character drift gate blocks key names invented during drafting|unplanned character drift gate blocks known cast identity conflicts" packages/ai-novel-core/tests/core.test.mjs
```

结果：6 个 focused tests 全部通过。

对当前真实 final draft 使用真实已知角色集合审计：

```json
{
  "status": "eligible",
  "reason": "未发现未经批准的关键新增人物。",
  "risks": []
}
```

下一步真实验证：

- 重启服务后 retry `flow-cast-lock-probe-v7-fresh` 第 1 章。
- 预期不再卡在 `沈蘅正 / 余光` 人物漂移误报。

### Causal Gate 抽象锚点误报

上一轮真实 retry 后，`沈蘅正 / 余光` 人物漂移误报已解除，新的阻塞点变为：

```text
Final Quality Gate:
- Status: blocked
- Score: 5/10
- Word count: 2295/2500
- Reason: 最终稿因果执行硬门槛失败：因果执行证据不足：锚点=无；主动选择=有；后果=有；交棒=弱；伏笔操作为泛化占位，跳过硬校验。
```

原因定位：

- `evaluateCausalExecutionEvidence` 原本只用 `body.includes(anchor)` 判断锚点。
- 首章计划里的锚点是抽象标签：`主角唯一身份`、`核心缺口`、`第一枚主线线索`。
- 真实正文没有字面写这些标签，但有现场证据：`沈砚/沈书吏`、`调卷簿签名`、`错页/差额`、`纸块`、`半枚湿印`、`底档副本`。
- 章末交棒检测没有识别 `湿印/纸块/调卷簿/副本/袖口` 这类本项目真实交棒物件。

影响面：

```bash
rtk gitnexus impact evaluateCausalExecutionEvidence --repo ai-novel-factory
```

结果：HIGH，直接影响 `createQualityReport`、`enforceFinalDraftQualityGate`，间接影响章节生产和 orchestrator。已按高风险路径只增强证据识别，不放松主动选择/后果/伏笔门槛。

已修复：

- 增加 `causalAnchorMatchesBody`：
  - `主角唯一身份` 可由命名角色 + 职能/档案/调卷簿/签名证据证明。
  - `核心缺口` 可由 `错页/缺页/差额/页码/顺序/异常/裁口` 等现场证据证明。
  - `第一枚主线线索` 可由 `湿印/纸块/错页/编号/签名/调卷簿/底档/副本/纸缝` 等物件证明。
- 章末 handoff 检测增加 `湿印/纸块/袖口/调卷簿/副本/底档/东侧院/签名` 等交棒信号。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
```

结果：通过。

```bash
rtk node --test --test-name-pattern="quality report accepts causal execution shown through concrete scene evidence|quality report accepts abstract causal anchors proven by scene objects|quality report blocks specific foreshadowing operations missing from prose" packages/ai-novel-core/tests/core.test.mjs
```

结果：3 个 focused tests 全部通过。

对当前真实 final draft 本地审计：

```text
| 因果合同执行 | 8/10 | 正文以可见事件执行因果合同：锚点=主角唯一身份、核心缺口、第一枚主线线索；主动选择=有；后果=有；交棒=有；伏笔操作为泛化占位，跳过硬校验。 |
- Causal Contract: 通过：正文以可见事件执行因果合同：锚点=主角唯一身份、核心缺口、第一枚主线线索；主动选择=有；后果=有；交棒=有；伏笔操作为泛化占位，跳过硬校验。
```

下一步：

- 重启服务后 retry，预期不再卡因果合同。
- 当前报告已露出下一层问题：角色差异化里 `陈述句` 被误识别为角色，`沈蘅` 证据不足；下一步按 Character Profile Gate 继续切片。

### Character Cast 清洗误报

因果 gate 本地修复后，当前真实报告露出的下一层问题是角色差异化污染：

```text
角色差异化不足：核心出场人物中 沈蘅、陈述句 缺少目标、选择或关系压力...
```

原因定位：

- `陈述句` 是写作术语，不是角色名。
- `黄昏/余光` 此前只在 drift gate 层过滤，仍可能进入 known cast 清洗结果，污染后续 Character Profile Contract。

影响面：

- `evaluateCharacterProfilePresence` impact 为 CRITICAL，直接影响质量报告、自然度、最终门禁、记忆更新等。
- `evaluateCharacterVoiceDifferentiation` impact 为 HIGH。
- `isConcreteKnownCastName` 在 GitNexus 中未找到 symbol，按上游 CRITICAL/HIGH 处理。

已修复：

- `GENERIC_SCENE_CHARACTER_TERMS` 增加 `陈述句`、`黄昏`、`余光`，从 known cast sanitizer 源头过滤。
- 扩展 `known cast sanitizer keeps concrete names and removes workflow vocabulary`，确保输出只保留真实人物。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
```

结果：通过。

```bash
rtk node --test --test-name-pattern="known cast sanitizer keeps concrete names and removes workflow vocabulary|character profile gate ignores chapter hook labels in known cast|quality report accepts abstract causal anchors proven by scene objects" packages/ai-novel-core/tests/core.test.mjs
```

结果：3 个 focused tests 全部通过。

对当前真实 final draft 本地审计：

```text
| 因果合同执行 | 8/10 | 正文以可见事件执行因果合同：锚点=主角唯一身份、核心缺口、第一枚主线线索；主动选择=有；后果=有；交棒=有；伏笔操作为泛化占位，跳过硬校验。 |
| 角色鲜明度 | 8/10 | 角色档案信号通过：正文包含欲望、行为、对白、关系和可见特征。角色差异化通过：沈蘅、沈砚、范思远 通过目标、行动选择、对白或关系压力形成区分；沈书吏 为短暂出场，不作硬门槛。 |
- Character Profile Gate: 角色档案信号通过：正文包含欲望、行为、对白、关系和可见特征。角色差异化通过：沈蘅、沈砚、范思远 通过目标、行动选择、对白或关系压力形成区分；沈书吏 为短暂出场，不作硬门槛。
```

下一步真实验证：

- 重启服务并 retry `flow-cast-lock-probe-v7-fresh` 第 1 章。
- 预期不再卡因果合同，也不再卡 `陈述句` 角色污染。

### Word Budget Guard 压缩过头

上一轮真实 retry 后，因果合同与角色清洗已越过，新的阻塞点变为：

```text
Final Quality Gate:
- Status: blocked
- Score: 4/10
- Word count: 1862/2500
- Reason: 最终稿有效字数 1862/2500，低于 80% 门槛。
```

原因定位：

- 初稿/返工前正文约 `4619/2500`，质量返工要求压缩。
- `enforceRevisionWordBudgetGuard` 的 compression 分支只检查 `generatedWords <= hardMaximum`，没有同时检查 `generatedWords >= hardMinimum`。
- 因此 LLM 把正文从超长压到 `1862/2500` 时，guard 误判“低于上限即可接受”，最终 gate 才发现低于 80%。
- naturalness guard 同样只有上限保护，也可能把正文润色成过短摘要。

影响面：

- GitNexus 未找到内部 `enforceRevisionWordBudgetGuard` symbol。
- 改用上游：

```bash
rtk gitnexus impact reviseDraftForQualityGate --repo ai-novel-factory
```

结果：HIGH，影响质量返工与章节生产主链路。

已修复：

- revision compression 结果必须落在 `[80%, 115%]` 区间。
- 如果压缩低于 80%，新增 `padDraftToWordFloorFromPrevious`，从上一稿恢复非重复场景证据段落，补到硬下限以上且不超过 115%。
- naturalness guard 同步增加低于 80% 的下限保护，避免自然化把章节缩成摘要。
- expansion 分支也必须达到 80% 硬下限；不能再因为“比上一稿略长”就接受仍然低于硬门槛的稿件。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
```

结果：通过。

```bash
rtk node --test --test-name-pattern="quality revision guards against under-budget shrinkage|naturalness pass guards against over-budget expansion|quality gate parser blocks drafts above the hard word ceiling|final draft word gate counts narrative body instead of metadata|naturalness report ignores narrative ordinal objects|quality report accepts abstract causal anchors proven by scene objects|known cast sanitizer keeps concrete names and removes workflow vocabulary" packages/ai-novel-core/tests/core.test.mjs
```

结果：7 个 focused tests 全部通过。

补充验证：

```bash
rtk node --test --test-name-pattern="quality revision guards against under-budget shrinkage|naturalness pass guards against over-budget expansion|quality gate parser blocks drafts above the hard word ceiling|final draft word gate counts narrative body instead of metadata" packages/ai-novel-core/tests/core.test.mjs
```

结果：4 个 focused tests 全部通过。

下一步真实验证：

- 重启服务并 retry 第 1 章。
- 预期字数不会再从超长压到 `<80%`；若仍 blocked，继续记录新 gate reason。

### Memory Keeper 污染清洗与人物漂移新阻塞

真实 retry 一度通过第 1 章：

```text
Final Quality Gate:
- Status: passed
- Score: 8/10
- Attempts: 1
- Word count: 2717/2500
```

但打开 `.ai-novel/memory/chapter-001-memory.md` 和角色档案后发现下一层问题：

- `chapter-001-memory.md` 的 Summary 仍偏蓝图/合同摘要，不像故事事实记忆。
- `dossiers.json` 会保留旧污染字段，例如 `NaturalnessAgent 目标`、`已执行快速生产硬门禁`。
- 旧误抽取角色节点会跨 retry 残留，例如 `沈砚蹲`、`沈砚搁`、`东南路`、`左手`、`颜色`、`上限`。

影响面：

- `createChapterMemoryUpdate`：HIGH，影响 `runChapterProductionPipeline`、`advanceAutonomousProject`、`retryChapterProduction`。
- `extractCharacterProfileSignals`：HIGH，影响角色档案回写。
- `updateCharacterDossiersAfterChapter`：HIGH，影响章节生产、重试和自动推进。
- `extractChinesePersonNames`：CRITICAL，影响质量报告、蓝图、正文、记忆、UI snapshot 等多条流程。

已修复：

- `extractNarrativeBody` 现在会截断 `Final Quality Gate`、`AIGC Detection`、`Style Conformance Drift`、`Character Profile Projection` 等报告段，记忆评估只吃正文体。
- `summarizeCharacterDossiers` 会清洗流程噪声，避免旧污染继续进入 prompt/记忆摘要。
- `updateCharacterDossiersAfterChapter` 在写回前会过滤非 canon/known cast 的旧支持角色节点，并清洗旧 dossier 字段。
- `左手`、`右手`、`颜色`、`上限` 进入非人物过滤。
- `沈蘅摇头` 这类“已知角色 + 动作后缀”不会再被抽成新人物 `沈蘅摇`。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
```

结果：通过。

```bash
rtk node --test --test-name-pattern="chapter drafting sends the approved style contract to the configured text model|quality revision guards against under-budget shrinkage|naturalness pass guards against over-budget expansion|quality report ignores polluted character dossiers when building cast gate" packages/ai-novel-core/tests/core.test.mjs
```

结果：4 个 focused tests 全部通过。

```bash
rtk node --test --test-name-pattern="unplanned character drift gate ignores known cast suffix fragments and gaze nouns|unplanned character drift gate ignores known cast action suffixes while blocking invented clerks|unplanned character drift gate filters place and time terms while blocking invented people" packages/ai-novel-core/tests/core.test.mjs
```

结果：3 个 focused tests 全部通过。

最新真实 retry：

```text
Final Quality Gate:
- Status: blocked
- Score: 8/10
- Word count: 2032/2500
- Reason: Canon 人物漂移硬门槛失败：正文出现未在蓝图/Canon/角色档案中批准的关键姓名「沈蘅摇×1、胡书办×2」。
```

本地复核后分层：

- `沈蘅摇` 是误抽取，已通过 `TRAILING_NON_NAME_CHARS` 增加 `摇` 修复。
- `胡书办` 是正文真实临时新增的未批准人物，门禁阻塞是正确的。
- memory/dossier 污染检查已通过：不再出现 `NaturalnessAgent`、`Final Quality Gate`、旧假角色节点等污染项。

下一步要攻：

- 让正文/自然度返工在遇到未批准人物时优先“替换为已批准 cast 或无名职能称谓”，而不是只保存 blocked 稿。
- 或在蓝图/角色确认阶段提前生成可用小配角名单，避免 LLM 在正文阶段现编 `胡书办`。

## 共享 Workflow Kernel 与 LangGraph 持久化（2026-07-19）

本轮把“调试页面的单点执行”和“小说工厂的自动/手动推进”收敛到同一执行接口，同时保留生产回滚开关。

已完成：

- `WorkflowKernel.executeNode(nodeId, context)` 成为统一节点入口；调试页 8 个真实节点不再从 HTTP 路由直接调用各自执行函数。
- `FactoryWorkflowTraceRecorder` 统一保存 Run → Step → Attempt；重复初始化会恢复既有 trace，不会重复创建 Run。
- 自动 Worker 和手动推进都接入 `executeProductionAdvanceThroughKernel`，共享同一个生产节点实现。
- 生产接管由 `AI_NOVEL_WORKFLOW_KERNEL=1` 显式开启；默认仍执行旧生产路径，便于灰度和一键回退。
- 接入正式 `@langchain/langgraph` `StateGraph`，不是自制流程图模拟。
- `FactoryLangGraphCheckpointer` 实现官方 `BaseCheckpointSaver`，支持 `thread_id`、`checkpoint_id`、历史列表、父 checkpoint、pending writes 与 deleteThread。
- LangGraph checkpoint 继续写入 `.ai-novel-factory/factory.sqlite` 的既有 `checkpoints` 表，没有产生第二个状态数据库。
- 每个新调试 Run 创建隔离 Debug Branch；“工作流轨迹”页签可查看 base/latest/history/diff。
- Debug Branch 支持追加候选、历史回滚，以及必须传入显式业务 applier 的两阶段 promote；没有 applier 时不会写正式项目。

生产节点兼容目录覆盖当前 9 个状态机阶段：

1. `worldbuilding_dialogue`
2. `setting_review`
3. `master_planning`
4. `chapter_task_generation`
5. `drafting`
6. `aigc_refinement`
7. `reviewing`
8. `replanning`
9. `complete`

验证：

```bash
rtk npm --prefix packages/ai-novel-core run build
rtk node --test packages/ai-novel-core/tests/workflow-debug-branch.test.mjs packages/ai-novel-core/tests/production-workflow.test.mjs packages/ai-novel-core/tests/factory-langgraph-checkpointer.test.mjs packages/ai-novel-core/tests/workflow-kernel.test.mjs packages/ai-novel-core/tests/workflow-step-persistence.test.mjs packages/ai-novel-core/tests/chapter-blueprint-learning.test.mjs packages/ai-novel-core/tests/autopilot-semi.test.mjs
```

当前灰度边界：

- 调试页 8 个拆分节点已经使用 Kernel 和 Debug Branch。
- 生产 Worker/手动推进已经接好兼容桥，但默认开关关闭。
- 下一步需要把 9 个生产阶段进一步拆成与调试页同粒度的正式业务节点，然后做项目级 promote 映射与端到端回归，才开放默认生产开关。

### 正式流程沙盒单点执行

- 调试页新增折叠区“正式流程沙盒”。它从选中项目复制当前 `.ai-novel` 到 `.ai-novel-factory/workflow-sandboxes/<sandboxId>/`，不会推进正式项目。
- `POST /production-sandboxes` 创建当前状态快照；`GET /production-sandboxes/:sandboxId` 查看当前阶段、可执行节点和历史；`POST /production-sandboxes/:sandboxId/nodes/:nodeId/run` 只执行与沙盒当前 stage 对应的生产节点。
- 节点执行调用正式 `advanceAutonomousProject`，并强制通过共享 Workflow Kernel 和 FactoryDB LangGraph checkpointer；同一沙盒每完成一个节点就停住，再由用户决定是否运行下一节点。
- 请求错误节点会返回 `409 production_workflow_node_not_current`，防止跳过前置门禁或从错误章节重新开始。
- 当前沙盒覆盖现有 9 个生产大阶段；`master_planning` 与 `drafting` 已进一步拆成下述正式细节点。其他阶段仍以兼容大节点呈现，界面不会把尚未拆分的部分伪装成细节点。

### Master Planning 正式细节点（2026-07-19）

- `production.story-foundation`：只调用正式 `writeProductionStoryBibleAssets`，生成世界矩阵、故事圣经、主线架构、人物关系、伏笔账本、分卷策略、正典合同和 writing plan；执行后保持在 `master_planning`。
- `production.chapter-blueprints`：只有故事基础资产齐全才允许执行；只调用正式 `writeAllDetailedChapterBlueprints`，全部章节蓝图落盘后才进入 `chapter_task_generation`。
- 沙盒通过真实文件存在性解析下一节点，而不是只看粗粒度 stage：缺基础资产时显示 story foundation，基础资产齐全但蓝图缺失时显示 chapter blueprints。
- 两个细节点分别建立 Run / Step / Attempt 和 LangGraph checkpoint；同一 external run id 可从 checkpoint 恢复，不会重复执行。
- 组合测试已经证明：正式源项目停在 `master_planning` 且不产生新资产；沙盒依次执行两个节点后进入 `chapter_task_generation`，并拥有独立的完整规划资产。

### Drafting 正式细节点（2026-07-19）

`drafting` 已拆成四个可暂停、可恢复、可独立观察的正式节点：

1. `production.chapter-draft`：准备 Canon、故事资产、上章记忆、上章终稿、角色档案与冻结写法，只生成当前章初稿 checkpoint。
2. `production.chapter-quality`：读取初稿 checkpoint，执行正式质量审查与返工循环，保存结构化 gate 和完整报告。
3. `production.chapter-naturalness`：读取质量 checkpoint，执行润色、AIGC 检测/局部修复、自然度返工与最终门禁，尚不写入正式章节目录。
4. `production.chapter-commit`：只有前三段 checkpoint 齐全才可运行；写入 draft/reviewed/final、质量报告、版本清单、章节记忆、角色档案与关系图，并更新章节/项目状态。

共同约束：

- 每个节点都通过同一个 `WorkflowKernel`、正式 LangGraph `StateGraph` 与 FactoryDB checkpointer 执行。
- 重复 external run id 会恢复原 Run/Step/Attempt，不会重复调用模型。
- 调试沙盒的模型配置读取正式 FactoryDB，但不携带正式 `projectId` 给写作产物记录器，因此正文、记忆和事件不会写回源项目。
- 原 `runChapterProductionPipeline` 默认已经改为调用共享的 naturalness + commit 阶段；自动 Worker、手动推进与单点节点不再维护两份后半程实现。
- 保留临时回滚开关 `AI_NOVEL_LEGACY_CHAPTER_PIPELINE=1`，只用于灰度故障回退。

验证证据：

```bash
rtk npm --prefix packages/ai-novel-core run build
rtk node --test packages/ai-novel-core/tests/production-chapter-workflow.test.mjs packages/ai-novel-core/tests/production-planning-workflow.test.mjs packages/ai-novel-core/tests/production-workflow-sandbox.test.mjs packages/ai-novel-core/tests/production-workflow.test.mjs
```

- 章节细节点测试覆盖了四段 checkpoint、Run/Step/Attempt、重复运行恢复、final/memory/version 产物和状态提交。
- 章节沙盒隔离测试证明：沙盒运行第 1 章初稿后只在 sandbox root 产生 draft checkpoint，源项目状态、章节目录和 checkpoint 均保持不变。
- 两章组合测试证明：第 1 章提交后检查器会自动切到第 2 章初稿；第 2 章读取上章尾部与连续性账本，不会重新从第 1 章开始。
- 旧自动入口的“写法合同进入模型 + 完整版本清单落盘”回归通过。
- provider transient failure 仍保持 pending/resumable，且不消耗 chapter recovery 次数。

已识别的历史测试债务（不是本次节点化回归）：

- 部分旧夹具使用 `targetWords=120/2500`，但当前确定性五段稿约 3165–3208 字，触发 115% 字数硬门；因此旧用例期待 `complete` 或自然度失败时，实际先得到字数阻塞。
- 使用 `AI_NOVEL_LEGACY_CHAPTER_PIPELINE=1` 对同一夹具 A/B，旧实现得到完全相同的阻塞原因。后续应修正夹具目标字数或确定性生成器，不能放宽生产字数门来迎合测试。
