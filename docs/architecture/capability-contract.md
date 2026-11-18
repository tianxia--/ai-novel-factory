# 独立能力的发现、调用与结果契约

日期：2026-10-20。状态：目标接口草案；当前仓库尚未实现这些通用接口。项目边界以[架构决定](README.md)为准。

## 1. 标准与自定义部分

工具发现/执行采用 MCP，技能指南采用 Agent Skills 的 `skills/<name>/SKILL.md`。插件安装优先复用宿主已经支持的 `.claude-plugin/plugin.json` 与 `.mcp.json`，宿主可选扩展不进入小说领域 API。

MCP 提供工具、资源与结果传输；Skills 提供技能材料。本文定义的授权组合、工作绑定、operation 账本和结果去重是我们的应用契约，不能宣称是 MCP 自带的业务保证。工具注解不替代授权。[MCP 服务概念](https://modelcontextprotocol.io/docs/learn/server-concepts)、[工具规范](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)、[Skills 规范](https://agentskills.io/specification)。

传输与领域版本分开：MCP 客户端/服务端协商各自支持的协议；能力契约使用 `contractVersion: "1.0"`。本轮查阅了当前官方规范，不意味着现有 PM Bridge 的 SDK 已通过其全部兼容测试。首个连接插件必须用宿主实际依赖版本做集成验收。

## 2. 通用宿主对象

| 对象 | 关键字段/职责 |
| --- | --- |
| Installation | installationId、插件版本、连接地址、配置引用、健康与兼容状态 |
| Capability | capabilityId、版本、技能、工具集合；组合层目录条目，非新插件格式 |
| ActorGrant | actorId、installationId、可用工具、作用范围、有效期和审批规则 |
| WorkBinding | bindingId、actorId、workId、具体工具选择、外部资源引用、知识选择、凭据引用、grantEpoch |
| Invocation | invocationId、installationId、bindingId、工具、请求指纹、状态和 operationId |
| ExternalResourceRef | 安装实例、外部资源 URI、版本、展示名；IM 不解释内部结构 |
| DeliveryReceipt | invocationId、结果事件/版本、目标会话、交付消息 ID |

Capability 不等于某个 MCP Server。一台服务可以提供多组工具；宿主可以把它们组合成“写作”“审稿”等可选能力，名称和映射来自插件配置，不在 IM 核心里枚举。

WorkBinding 可以在没有正式 Task 的讨论阶段创建；workId 表示这次工作上下文，不表示每条聊天都必须建任务。

## 3. 发现与安装

安装插件后，宿主按其已有机制启动 MCP 进程或建立远程连接，读取 `tools/list` 与输入/输出 Schema，导入技能描述。目录、分页和更新通知按双方协商的 MCP 版本执行。

插件须声明其领域 API 与应用契约兼容范围。第一版小说服务通过 `novel_describe` 返回接口版本、工具能力、支持的资源类型和限制。缺少必需版本/工具时安装保留为“不兼容”，不让模型尝试猜测接口。

安装、人物授权、具体工作选择是三个动作。看到一个工具的描述不授予执行权；读工具也要受小说/文档范围限制，不能因为被标为 readOnly 而开放全部资料。

## 4. 请求内容与可信身份

模型可提交业务参数，如 projectId、chapterId、目标版本、正文和调用用途。角色身份、租户、授权 epoch、凭据、可信 invocationId 由宿主/网关生成，不能取自模型参数。

调用路径：

1. IM 验证当前人物、工作绑定、工具、资源、知识、预算与动作审批，原子登记 Invocation。
2. 网关获取受限的业务访问凭证，将 invocationId 作为稳定幂等键传给连接插件；重试沿用同一 ID。
3. 插件调用小说公开 API，发送明确业务参数、幂等键和资源版本条件。
4. 小说服务验证其自己的访问主体、资源权限、版本和领域规则，再保存 operation 或执行结果。
5. IM 保存响应映射，并按接收者权限呈现工具结果/公开交付。

第一版本地可信插件作为网关的一部分，受控包装每次工具调用；连接凭据保存在宿主密钥库/受保护通道，不进入模型上下文。若宿主暂不支持可信逐调用上下文，则不能启用细粒度多人物写操作；先补网关，不能靠在模型参数里增加 actorId 假装完成。

远程连接使用经过认证的调用凭证；可采用服务签发的短期受限票据。票据绑定资源、动作、调用和有效期，服务根据自己的授权记录验证；签名/认证具体机制在适配器实现时锁定。普通请求头、MCP `_meta` 或任意 URI 本身都不是身份凭证。

## 5. 授权组合与撤销

本次可执行动作 = 有效长期资格与有效临时授权的并集，再与工作选择、组织限制、当前审批、服务端资源 ACL 取交集。临时授权必须来自有权授予者，不能由模型自己生成。

IM 管理谁可以提出什么调用；能力服务管理调用主体对业务资源能做什么。角色名、群成员身份、安装状态、已有工具结果，都不能绕过另一个项目的权限。

撤销增加 grantEpoch，网关拒绝旧 epoch 新调用、停止受影响运行，并向小说服务撤销相关访问票据/operation。小说服务在每个读取/写入及最终提交时复核当前许可；已经提交的版本保留审计，未经确认的外部效果转待核对。原生 Session 带授权来源，撤权后的后续运行重建获准上下文。

同一人的两项工作不能因共享一个插件进程而串用凭据、项目或检索范围。插件进程可以复用连接池，但每次请求的授权上下文显式绑定并校验。

## 6. 参数、结果与错误

工具输入/输出均定义 JSON Schema；插件不悄悄丢弃未知写入参数。模型提交正文和服务自动生成正文采用不同工具，以便预算、执行者和审计清楚。

会产生持久操作的工具在 MCP 的 `structuredContent` 返回[结果 Schema](contracts/operation-result.schema.json)定义的数据；同时附文字说明以兼容只读文本的宿主。普通只读查询使用各自的输出 Schema，不强制创建 operation。此 Schema 属于应用层，外层 MCP 消息由已协商版本的 SDK 序列化。[结构化工具结果](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)

| 字段 | 语义 |
| --- | --- |
| contractVersion | 应用契约版本，首版 1.0 |
| invocationId / operationId | IM 调用标识 / 服务持久操作标识，互不代替 |
| revision | operation 状态递增版本，用于去重和丢弃迟到投影 |
| status | accepted、running、cancel_requested、succeeded、failed、cancelled、reconciliation_required |
| artifacts | 指定资源 URI/不可变版本/类型/展示名/摘要 |
| usage | 服务内部使用量；与人物 Harness 的费用分别记录 |
| error | 稳定错误码、可展示信息、重试说明；不包含密钥或原始堆栈 |

典型错误码：INVALID_INPUT、NOT_FOUND、FORBIDDEN、VERSION_CONFLICT、IDEMPOTENCY_CONFLICT、GRANT_REVOKED、BUDGET_EXCEEDED、DEPENDENCY_UNAVAILABLE、QUALITY_BLOCKED。标准输入错误可不创建 operation；已经受理的工作必须有可查询的 operationId。

IM 原始结果日志不等于公开群消息；模型决定公开说明时使用普通发言工具，系统交付卡以 receipt 去重。相同 operation 完成事件不会自动再生成一条角色发言。

## 7. 长工作、重试和取消

MCP submit 调用短时间内返回 accepted/operationId，不保持整章写作的同步请求。连接插件提供 `operation_get`、`operation_cancel`；初版由 IM 后台监督器有界轮询，退避并受截止时间约束，进度通知只是加速体验，断线后仍查询持久状态。不要求模型反复调用工具轮询。

这是普通工具的应用层模式，首版不依赖特定 MCP 异步 Tasks 扩展。宿主未来支持更合适的异步传输，可以保持领域 operation 语义不变。

小说服务使用调用凭据标识和 invocationId 唯一登记请求，记录参数指纹。同键同参数返回已有 operation；同键不同参数返回冲突。不同 actor/work 的可信调用命名空间不能相互碰撞。

状态：accepted → running → succeeded/failed/cancelled；accepted 或 running 可请求 cancel_requested。效果无法确认时 reconciliation_required，核对后才进入最终结果；取消与提交竞争时，以服务实际提交记录为准，不能显示虚构的回滚成功。

IM 停止人物时停止新的模型/工具调用，分别取消关联领域工作。只停止等待不会自动撤销已被服务受理的任务；UI 保留“停止中”或“待核对”。重启后扫描未结束 Invocation，查询原 operation，不重新 submit 新调用。

服务写 operation 状态与本领域数据库变更放在同一事务边界内；文件产物采用临时文件、版本清单和可恢复提交记录。跨系统没有全局事务。外部发布等未知效果不能盲目重试；需要业务效果键和对账。相同调用去重不等于所有外部动作 exactly-once。

## 8. 知识与披露

通用知识选择是 WorkBinding 的一部分，可引用不同提供方的库、文档和版本。每个提供方执行自己的 ACL，返回时复核，缓存包含授权 epoch 与资料来源。

小说服务拥有其 Canon、人物设定、章节与领域索引；IM 拥有私聊/人物记忆；独立知识插件可以拥有外部资料库。共享方式是获准引用/检索，不通过共享索引目录或全量复制数据库实现。

资料可读取与可向目标群披露分别授权。项目 A 的临时资料不能进入项目 B 的 Session 或人物永久记忆。若领域服务内部执行模型生成，它只接收获准的具体资料片段/引用范围，不接收整个 IM transcript，也不自动获得 IM 私聊读取能力。

## 9. 资源与显示

资源引用由 installationId 与 provider 返回的 URI/版本共同标识。相同 projectId 在不同小说服务上不相同。IM 用通用正文/文件/差异/审阅卡展示，不能在核心硬编码“第几章完成”的领域状态机。

资源读取走已认证网关或服务接口；URI 是定位符，不是访问令牌。不直接打开服务端绝对文件路径。外部卡片如 MCP Apps 是可选展示扩展，纯工具/文本宿主也要能完成业务。

业务服务状态通知由插件转换成通用 operation 投影；IM 重新检查当前绑定和受众权限后生成自己的消息。插件不能持有 IM 所有者凭据或直接写聊天库。

## 10. 版本与兼容性

IM、小说引擎、连接插件分别版本化。应用契约按主版本兼容，新增可选字段可在次版本出现；接收方拒绝未知主版本和未支持状态。新能力通过发现后使用，不依靠名称猜测参数。

IM 对插件跑发现/授权/结果契约测试；插件对小说公开 API 跑版本矩阵；小说项目用普通 HTTP 客户端/CLI 测独立性。契约夹具可共享，任一方构建不得要求另外一个仓库源码。具体 SDK 和运行时版本在首次贯通时锁定并记录，不以“用了 MCP”替代互操作测试。
