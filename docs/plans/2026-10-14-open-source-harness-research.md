# 开源 Harness 调研：独立人物 IM 的底层执行选型

- 调研日期：2026-10-14。
- 目标：支持长期独立人物、AI-AI 私聊、多群参与、个人视角、独立 Session、后台执行与可靠恢复。
- 方法：查阅官方文档、GitHub 官方仓库、固定源码版本的接口/安全声明与存储结构；同时核对本项目现有插件入口。
- 边界：原调研以文档和源码为依据；后续已用本机 OpenCode 1.14.33 完成确定性接入 PoC，未安装新依赖、调用付费模型或完成真实模型/崩溃/负载测试。用户的 Pi 经验来自其他项目，不等于本仓库集成。更新见[验证报告](2026-10-15-opencode-im-poc.md)。
- 产品方案：[数字成员协作系统 V2](2026-10-14-person-world-and-harness-v2.md)。

## 1. 先确定不由 Harness 负责的内容

Harness 负责模型工具循环、上下文管理、底层 Session、运行事件以及一定程度的取消/审批。它通常不直接提供我们需要的完整人物世界：对等身份、联系人、双向私聊、群组成员关系、个人收件箱、承诺、共享边界和观察者权限。

因此固定分层：自有业务层管理人物与协作；底座适配器管理模型执行。选用任何候选都不能把“切换 prompt/Agent preset”当作切换独立人物，不能把一个主管的临时 subagent 当作长期同事。

## 2. 当前方向与原候选比较

**最新状态：首版采用 OpenCode 服务式 Harness。** 用户已同意继续，独立 HTTP/MCP 接入验证通过；正式适配器计划使用版本匹配的 SDK。Pi 暂不并行实现。DeepSeek-Bot 提供 IM 产品参考，不要求使用与其快照相同的 DSH 底座。该决定不等于生产准入全部完成。

### 2.1 OpenCode 能否实现目标

结论是架构上可以作为底层执行器，不能理解为装上 OpenCode 就已得到 IM 产品。本轮重新核对官方文档：

| 需求 | 可复用能力 | 本应用仍负责 |
| --- | --- | --- |
| 自己的 IM 界面 | headless HTTP Server 与 JS/TS SDK | 消息、联系人、群成员关系与个人视角 |
| 每人自己的模型 | Provider 配置、模型目录、Agent 模型覆盖 | 人物模型绑定、配置页面、凭据作用域 |
| 每人不同能力 | 自定义工具、MCP、Agent 级权限 | 能力库、人物授权及资料级权限复核 |
| 独立工作上下文 | 创建/查询 Session，按 Session 输入 | Actor 与逻辑 Session 的映射、跨会话连续性 |
| 停止与状态反馈 | 异步输入、SSE、指定 Session abort | 持久收件、去重、子工具收束与崩溃恢复核对 |

依据：[Server](https://opencode.ai/docs/server/)、[SDK](https://opencode.ai/docs/sdk/)、[Providers](https://opencode.ai/docs/providers/)、[Agents](https://opencode.ai/docs/agents/)、[Custom Tools](https://opencode.ai/docs/custom-tools/)、[MCP](https://opencode.ai/docs/mcp-servers/)。这些是接口事实，未构成本产品实测报告。

建议的 OpenCode 接法：长期 Actor 存在于我们的 IM；每个人在群或私聊中的逻辑上下文映射到独立原生 Session，按需调用。群消息先进入 IM，再给应回应成员投递允许输入；同事私聊通过 IM 消息工具路由到对方，而非把对方创建成某个主 Agent 的临时 subagent。这是本项目设计推导，不是 OpenCode 自带的完整群聊机制。

有两项不能简化：自定义人格与工具不代表已经形成稳定的人物行为，需要非编码场景测试；不同 Session 或目录也不构成隔离。官方明确权限系统不是沙箱，需要容器/VM 等执行边界。[安全说明](https://github.com/anomalyco/opencode/blob/dev/SECURITY.md)

选择差异主要是控制面：OpenCode SDK 控制独立 HTTP 服务，Pi SDK 可直接嵌入 Node/Bun 并控制 Session、模型、工具和资源。两者都需要本产品自己的 IM 与人物层；Pi 也可通过子进程集成，不能把嵌入理解为必须与 API 共用进程。没有本产品对照测试，不宣称谁更快或更便宜。[OpenCode SDK](https://opencode.ai/docs/sdk/)、[Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)

### 2.2 历史候选比较

下列次序是此前缺少这段试验背景时的候选判断，作为比较依据保留，不再代表当前执行优先级：

1. **OpenCode：首个服务化验证候选。** 官方提供 headless server、JS/TS SDK、Session 与运行控制接口，适合当前 TypeScript + API/worker 架构。人物身份、个人资料隔离、业务投递与结果幂等仍由本项目负责。
2. **Pi：最重要的嵌入式对照候选。** TypeScript Session API 可直接嵌入受控 worker，便于精细管理工具与消息。产品层需自行补齐服务化、审批、隔离及调度。
3. **DeepSeek Harness：针对参考项目的重点专项候选。** 内部 Agent/inbox/Session 机制贴近需求，但仍是开发者预览；当前进程外 SDK 的取消和交互限制会影响产品。只有明确选择插件接入或补齐适配能力后才能与前两者公平比较。
4. **Deep Agents JS：工作流与持久执行备选。** 当复杂中断、持久图执行成为主要难点时值得采用；不是直接提供成员通讯录的产品框架。
5. **OpenHands SDK：专业执行器备选。** 对隔离环境内的软件工程工作有价值，作为小说/通用人物首个统一底座需要额外 Python/REST 运维和领域适配，首轮优先级较低。

以上是历史适配成本判断，不是已跑出的性能排名。当前已选 OpenCode 接法，继续验证本产品生产契约；首版不同时维护五套生产实现。

## 3. 调研快照

固定版本用于本次证据定位，不代表这些开发分支提交已被验证可直接投产。上线应选择经试验的发行版本，锁定 runtime、SDK、插件和数据库格式。

| 候选 | 官方仓库与快照 | 本次核对 |
| --- | --- | --- |
| OpenCode | `anomalyco/opencode`，`e9def88a7790efc6abace15b67f3625ff4d66237` | Server/SDK/Agents/Permissions 文档、SECURITY、Session SQL、根 LICENSE |
| Pi | `earendil-works/pi`，`3daa20280f6a7c7cbe0935680c9a38fdc3863005` | SDK、Session 格式、安全说明、根 LICENSE |
| DeepSeek Harness | `deepseek-ai/deepseek-harness`，`d743267388641bc76f17c45ce8b4c231aed1d32c` | 官方 core/session/persistence 文档、固定版 SDK client README、SAFETY、根 README |
| Deep Agents JS | `langchain-ai/deepagentsjs`，`5f42f2df3c814bebbac445c759a34f96c10bc036` | 官方 JS 概览、backends、人工审批、记忆、根 LICENSE |
| OpenHands SDK | `OpenHands/software-agent-sdk`，`27308a4b3f23a40177c9f444f9e35136c8a0d3fb` | 官方 SDK/持久化/安全文档、根 LICENSE |

本次核对的仓库根许可均标示 MIT；这不是对所有依赖、托管服务、模型账号或商业发行包的许可结论。上线前仍需生成依赖清单并保留对应 notices。DeepSeek-Bot 是第三方产品插件，不与 DeepSeek Harness 核心仓库混为一谈。

Pi 的旧 `badlogic/pi-mono` 地址目前重定向至 `earendil-works/pi`，当前 SDK 文档使用 `@earendil-works/pi-coding-agent`，不照搬旧包名或旧文章示例。

## 4. OpenCode

### 已确认能力

官方 Server 文档提供 `opencode serve`、HTTP API、事件流、Session 创建/查询、消息、异步投递、终止、分叉和压缩等接口；SDK 是与该服务通信的 JS/TS 客户端。接入应走正式 API，不解析终端界面输出。[Server](https://opencode.ai/docs/server/)；[SDK](https://opencode.ai/docs/sdk/)

Agent 可配置 prompt、模型与工具权限，包含 primary/subagent 的执行形式。它们是执行配置，不能直接推导出本产品的人物所有权和独立社交历史。[Agents](https://opencode.ai/docs/agents/)

固定源码的 `session_v2` 保存 project、directory、agent、model 等字段，消息与 inbox 按 session 关联；这是底座自己的状态。业务层应维护 Actor/LogicalSession 到原生 Session 的映射，不能直接依赖其私有 SQL 表写入。[Session 存储结构](https://github.com/anomalyco/opencode/blob/e9def88a7790efc6abace15b67f3625ff4d66237/packages/core/src/session/sql.ts)

### 关键限制

- 安全声明明确：权限确认不构成沙箱；真正隔离需外部容器或 VM。默认权限较宽，不能直接用于无人值守的多人物资源隔离。[安全说明](https://github.com/anomalyco/opencode/blob/e9def88a7790efc6abace15b67f3625ff4d66237/SECURITY.md)；[权限默认值](https://opencode.ai/docs/permissions/)
- 不把所有人物放在同一个任意可写 home/project 中后仅依赖 prompt 分隔。共享进程的配置、凭据、原生查询 API 和工具扩展均需隔离审计。
- 外部 API 支持不等于业务任务 exactly-once。异步投递确认与最终交付必须用自身 invocation/effect ID 对账。
- 固定开发快照已使用重组后的 `packages/core` 与 `session_v2`。公开文档、SDK 示例与未来采用的发行版本必须对齐；以该发行版 `/doc` 和生成类型做契约测试，不盲猜接口签名。

### 建议接入

本项目 worker 使用 SDK 连接私有 sidecar；UI 只访问业务 API。初期以成员级执行配置和隔离的数据目录启动受控实例，任务环境再限制挂载与网络；实例启动/休眠按需，不让每个 Session 永久占一个进程。

成员之间通过本项目的 `send_message` 和 `request_work` 工具沟通，不调用 OpenCode subagent 就把对方当作“被创建出来”。小说功能通过自定义工具或受控 MCP 接入。[Custom Tools](https://opencode.ai/docs/custom-tools/)

待试验：同成员不同会话的恢复、多个独立配置能否安全复用服务、会话中止对子工具的实际影响、权限事件路由、跨重启投递去重、固定版压缩后的人格与来源保留。

## 5. Pi

### 已确认能力

当前 SDK 可在 Node/Bun 中创建 `AgentSession`，提供 prompt、steer、follow-up、abort 与事件订阅；可显式提供模型、工具和资源加载器。文档区分低层 run 结束与自动重试/排队之后的 settled 状态，适配器不能在第一个 `agent_end` 就认定完整业务交付结束。[SDK](https://github.com/earendil-works/pi/blob/3daa20280f6a7c7cbe0935680c9a38fdc3863005/packages/coding-agent/docs/sdk.md)

原生 Session 采用可分支 JSONL 记录，包含消息、上下文调整、压缩等；持久 SessionManager 管理恢复，不应只覆盖内存消息数组来导入历史。[Session 格式](https://github.com/earendil-works/pi/blob/3daa20280f6a7c7cbe0935680c9a38fdc3863005/packages/coding-agent/docs/session-format.md)

### 关键限制与建议

Pi 按启动账户的系统权限运行，工作目录不是安全边界，项目 trust 也不是工具沙箱。嵌入时不能继承开发者的全部默认资源、凭据和扩展；明确提供 ResourceLoader、工具列表、存储和执行环境。[安全说明](https://github.com/earendil-works/pi/blob/3daa20280f6a7c7cbe0935680c9a38fdc3863005/packages/coding-agent/docs/security.md)

SDK 会话与 CLI 的扩展装配不应假定完全相同，尤其 MCP 等能力要按固定版 SDK 指引显式加载。服务 API、业务审批卡、Agent 收件箱和关系模型仍需自己实现。

建议放在可隔离的 worker/subprocess 中，而不是直接放进持有全部业务密钥的 HTTP 服务进程。每个逻辑 Session 显式创建或恢复原生 manager，给模型的工具调用经过业务网关。

待试验：中断后的工具收束、session 文件锁与异常尾部、worker 被杀后的恢复、长会话切换对人格一致性的影响、审批挂起的宿主实现成本。

## 6. DeepSeek Harness / DSH

### 为什么必须认真比较

参考项目 DeepSeek-Bot 基于 DSH。官方 core 文档提供 Agent registry、创建/恢复、独立 inbox、状态和内部取消接口；Session 用事件日志表达模型工作记录。其组合式插件机制允许替换运行与存储能力，产品形态与本需求有关联。[Core](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/core)；[Sessions](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/session)

官方持久化契约区分 append 与 flush，后者才保证崩溃后的持久性；只读日志观察不应占用写所有权。因此在做“观察成员 Session”时，不能把读日志做成恢复并写入原生会话。[Persistence](https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/persistence)

### 接入方式必须区分

| 接入方式 | 能力与代价 |
| --- | --- |
| DSH 内部插件 | 可接触内部 Agent/inbox/取消/权限服务；需学习 Cordis 生命周期、明确插件权限并承担升级耦合 |
| 进程外 TypeScript SDK | JSON-RPC 驱动 runtime，方便服务编排；不能假定全部内部能力均已暴露 |
| 直接基于 DeepSeek-Bot 二次开发 | 部分 IM/长期 Bot 交互已有参考；要检查对等私聊/成员视角是否匹配，并承担原插件存储与小说 DB 的整合成本 |

固定版本 SDK client README 明确列出：没有中途 prompt-cancel；放弃运行需要关闭 runtime；高层 run 的最终响应是一个 receipt-to-idle 区间的最后文本，不保证只对应某条输入；用于未来审批的双向通知/请求尚未实现。其会话树订阅过滤也是客户端行为，不能作为授权边界。[SDK 限制](https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/packages/sdk/client/README.md)

这不意味着 DSH 内部不能取消，而是现成进程外接入不能直接满足“单独停下陈墨、周宁继续运行”和完整审批交互。可以试验插件桥接，但其成本必须计入选型，不能算作已经原生打通。

### 稳定性与安全

官方仍标为 developer preview，提示兼容性破坏；安全声明说明未经安全审计，不应视为生产安全，不能只依赖其自身权限/沙箱来承载不可信执行。[状态](https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/README.md)；[安全声明](https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/SAFETY.md)

建议保留为专项候选。若愿意深度采用 Cordis/DSH，先证明取消、审批、只读观察、原生日志备份和版本升级，再考虑以它作为主底座。不要仅凭参考项目界面接近就忽略这些边界。

## 7. Deep Agents JS / LangGraph

官方将 Deep Agents 定位为 harness，提供规划、文件后端、上下文管理、子任务等能力，基于 LangChain/LangGraph。JS 实现可以进入现有 TypeScript 技术栈。[概览](https://docs.langchain.com/oss/javascript/deepagents/overview)

人工审批依赖 checkpointer，以 thread 身份恢复；文档示例中的内存存储不代表已经具备进程重启恢复。生产选择持久 checkpoint 实现并验证事务/工具重放，不能仅换个 `thread_id` 就宣称独立人物。[人工审批](https://docs.langchain.com/oss/javascript/deepagents/human-in-the-loop)

文件后端有多种范围与持久性。仅设置 rootDir 不等于安全隔离；开放本地 shell 后路径级限制也不足以限制任意命令。[Backends](https://docs.langchain.com/oss/javascript/deepagents/backends)

适合需要复杂等待、恢复和持久工作图的场景。若采用，需决定 LangGraph 与现有 worker 谁负责一次运行的恢复，避免两边各自重试同一个副作用。不要让框架临时 subagent 自动成为拥有独立 inbox 的人物。

跨会话 memory store 只是存储能力，Actor 命名空间、授权与共享规则仍由产品实现。[Memory](https://docs.langchain.com/oss/javascript/deepagents/memory)

本次不推荐作为第一个默认实现，原因是现有项目已有持久 worker，需要先证明引入图运行时比适配现有执行结构更有收益。这是适配成本判断，不是认为其只能做固定流程。

## 8. OpenHands Software Agent SDK

官方 SDK 提供 Python 与 REST 接口、Agent Server、自定义工具和远程执行，重点是软件工程。原生 Conversation 可使用稳定 ID 与持久化目录恢复消息和工作状态。[SDK](https://docs.openhands.dev/sdk)；[持久化](https://docs.openhands.dev/sdk/guides/convo-persistence)

安全分析与动作确认提供审批机制，但实际隔离仍取决于工作环境、挂载与凭据配置。[Security](https://docs.openhands.dev/sdk/guides/security)

适合作为未来“程序员成员”的专业执行器，或当隔离计算环境成为主要需求时再提高优先级。对当前小说/资料/协作产品，额外 Python 服务和偏软件工程的默认行为需要适配。公开 Conversation API 同样不自带产品级联系人、私聊所有权或观察权限。

## 9. 能力对照

“可接入”只表示文档或接口具备相应机制，不代表通过本项目测试。

| 维度 | OpenCode | Pi | DSH | Deep Agents JS | OpenHands SDK |
| --- | --- | --- | --- | --- | --- |
| 主接入方式 | HTTP + TS SDK | TS SDK / 子进程 | Cordis 插件 / JSON-RPC | TS 库 + LangGraph | Python / REST |
| 原生 Session 持久化 | 有 | 有 | 有 | 需持久 checkpointer | 有 |
| 个体身份、联系人、双向 IM | 自建 | 自建 | Bot 插件可参考，仍需核对改造 | 自建 | 自建 |
| 自定义业务工具 | 有 | 有 | 插件能力 | 有 | 有 |
| 取消/插话 | 接口存在，需实测 | SDK 方法存在，需实测 | 内部有；所查外部 SDK 有缺口 | 需验证图/工具取消语义 | 需验证远程运行控制 |
| 审批桥接 | 有权限接口 | 需宿主实现 | 外部 SDK 尚不完整 | interrupt + checkpoint | 有动作确认机制 |
| 内置权限等于安全隔离 | 否 | 否 | 否 | 否 | 否 |
| 对现有 worker 的影响 | sidecar 生命周期 | 嵌入/子进程宿主 | 插件/协议与版本耦合 | 恢复所有权需重划 | 额外服务栈 |
| 当前策略 | 保留候选并核对适配 | 保留候选，参考其他项目经验 | 缺口触发时比较 | 后续备选 | 专业执行器备选 |

## 10. 统一适配器契约

此处定义本项目的抽象能力，不声称各底座有同名方法，也不以伪造成功掩盖不支持。

- 发现能力：支持何种中断、恢复、工具、事件、审批与原生持久化格式。
- 创建/恢复绑定：传入 Actor、logical session、purpose、人格版本、模型、cwd、授权和输入基线。
- 提交输入：返回原生输入回执，保留业务 invocationId；区分入队和执行结束。
- 读取事件：映射消息片段、工具开始/结束、等待、失败与终态，维护去重水位。
- 取消指定运行：区分已请求停止、工具已收束、停止失败和副作用待核对。
- 审批：绑定具体工具、参数 hash、运行和有效期；不支持则 fail closed 或不开放该工具。
- 只读检查：读取日志/状态不恢复执行、不改变成员已处理记录。
- 关闭/休眠：持久化完成后释放进程，不改变人物身份。

业务回调中的 Actor 身份由宿主注入，不由模型填写。工具只能凭当前 session/run 的受限凭证调用业务网关，禁止读取 factory.sqlite 或直接连管理员 API 绕过授权。

同事请求采用异步消息：提交后得到 request ID 并结束当前调用；回复作为 inbox 事件恢复工作。禁止阻塞一个成员的工具等待另一个成员，而后者又等待前者。

## 11. 业务事实与原生日志

V1 的“全部底层状态必须写入同一个 SQLite”不适合作为选择开源底座的先验要求。合理边界是：factory.sqlite 维护业务事实；底座用自己的原生 Session 存储；映射、回执和工具效果账本用于核对。

公开消息只通过业务层提交，不把整个 Session transcript 当作群聊。一个原生工具日志中的完成事件不等于成果已验收；一个底座 idle 状态也不等于某个指定用户请求成功。

备份包括业务 DB、原生日志和产物清单。升级前停止写入、记录检查点、做恢复演练。换底座时保留原日志，导入经过授权的事实/摘要到新 Session，记录重建；不承诺供应商私有状态、缓存和推理记录无损迁移。

## 12. 首轮技术试验

以下作为所选底座的准入检查表，可参考用户在其他项目的 Pi 经验。此前约 5 个工作日的粗估不作为确定排期，工作量以实际接入缺口为准。使用隔离测试目录、合成资料、受限测试模型预算，不使用真实项目秘密和外部发布工具。

| 用例 | 要验证的事实 |
| --- | --- |
| 三人物初始化 | 各自人格/工具/模型/目录/Session 存储独立，稳定 Actor 不随进程变化 |
| 对等私聊 | A 主动找 B；双方各自 Session，共同公共消息，C 不知情 |
| 一个群两项并行工作 | A 分工，B/C 实际生成不同文件，结果回原会话 |
| 同人多会话 | 私聊/群/任务分别恢复；切换后没有共享 assistant 历史冒名 |
| 观察无副作用 | 读取 inbox/Session 不唤醒、不消费待办、不标记成员已处理 |
| 停止指定成员 | B 停止时 C 继续；确认 B 子进程/工具确已收束 |
| 审批拒绝 | 禁止的外发/文件动作不执行，拒绝理由回到正确运行 |
| 崩溃与重连 | 分别在投递前后、工具执行前后、消息提交前后终止 worker；不重复公开效果 |
| 长上下文 | 压缩后身份、未履约承诺、资料权限和出处可追溯 |
| 文件与日志隔离 | 跨成员路径、符号链接、shell、原生 API 与日志导出均不能越权 |
| 底座升级/恢复 | 锁定版本启动，备份可恢复；不兼容数据明确失败而非默默重建 |

先用确定性模型/工具替身验证协议，再对所选底座跑真实模型场景。需要比较时使用同一模型与相同预算做对照。另验证不同人物选择不同 Provider/模型、Provider 不可用与换模型恢复；可用 Provider 集合以实际版本和配置为准。没有配置模型时只报告契约检查，不能声称真实执行已通过。

记录：完成率、消息与副作用重复数、取消收束时间、恢复结果、每实例常驻内存、冷启动、token/工具用量与适配代码规模。阈值由试验基线确定，不在调研阶段编造数值。

淘汰条件：无法隔离资料、无法可靠停止单成员、无法辨认执行完成、无法恢复或对账、必须大规模 fork 底座才能满足基本 IM 语义。满足门槛后，优先选择实际适配维护成本更小的候选。

## 13. 本仓库的实际起点

`packages/opencode-ai-novel-factory/src/index.ts` 当前向 OpenCode 暴露 `novel-init` 和 `novel-status`，即 OpenCode 调用小说服务。它没有证明本项目已经能够反向创建并调度多位 OpenCode 成员的 Session。

新接入需要新增 HarnessAdapter、逻辑 Session 映射、受限工具网关与 sidecar/worker 生命周期管理；不能仅把已有插件换成多个名字。

后续已确定 OpenCode 并新增独立验证脚本，未修改生产运行代码、依赖或生产数据库。当前 PoC 直接调用 HTTP，正式 SDK 适配器与工作级能力/知识授权尚待实现；精确版本和准入限制见[验证报告](2026-10-15-opencode-im-poc.md)。
