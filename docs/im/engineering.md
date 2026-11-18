# 工程设计与边界

2026-10-20 更新：项目划分、存储归属、宿主与能力接入以[组合架构](../architecture/README.md)为准。本文保留 IM 领域设计与上一批实现记录；尚未开发的接口均属于独立 IM 项目。

## 1. 分层与责任

IM 自有存储负责人物、聊天、协作、授权和人物运行；小说的 `.ai-novel-factory/factory.sqlite` 负责小说业务。两边通过插件和公开 API 协作，不能访问对方私有表。Harness 原生日志通过 IM 内部映射关联。

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| IM UI | 会话、人物视角、命令表单、事件投影 | 自行生成业务状态、直接持有模型管理凭据 |
| 协作 API | 认证 Principal、命令校验、授权、投影与订阅 | 信任请求体里的 author/principal/observer 身份 |
| CollaborationStore | 人物/会话/成员关系、原子消息与收件、幂等和数据边界 | 模型调用、自动接受邀请、自动标记已处理 |
| 调度器 | inbox/outbox、租约、预算、输入回执、等待/唤醒 | 固定小说角色流水线 |
| 工具/知识网关 | 运行身份、授权版本、用途、受众、资源与副作用核验 | 因为 Harness 同意执行就跳过业务权限 |
| OpenCode 适配器 | SDK 调用、原生 Session、事件、停止、恢复 | 人物身份、联系人、业务任务和群成员权限 |
| 独立小说服务与连接插件 | 通过公开契约提供故事/章纲/写作/审稿、领域质量与正式写回 | 管理整个 IM 的生命周期、读取 IM 数据库 |

两个项目是独立部署单元，首版本地进程组合即可。小说现有 API/worker 继续作为领域服务，IM 宿主优先评估 PM Bridge 的复用范围。成员执行采用受限凭据；各自项目内部是否继续拆模块不影响外部契约。

## 2. 当前落地模块

以下是上一批同库实现的代码事实，不是新的项目边界。这些代码尚未接入生产 IM；迁移与退出顺序见[小说接入与迁移](../architecture/novel-integration.md)。

- `packages/ai-novel-core/src/collab/contracts.ts`：存储连接、可信访问上下文、人物/会话/消息、错误码。
- `packages/ai-novel-core/src/collab/schema.ts`：新增表，全部以 collab_ 命名。
- `packages/ai-novel-core/src/collab/store.ts`：同步事务与领域命令，复用 FactoryDb 已打开的同一连接。
- `FactoryDb.getCollaborationStore()`：按需初始化并缓存；不调用时不创建 collab 表。
- `packages/ai-novel-core/tests/collab.test.mjs`：真实临时 SQLite 验证，不使用生产数据。

本批没有新增 HTTP 路由、前端页面、模型调度或账号凭据接口。Store 接收的是已经被可信调用方认证过的上下文；它不是一个拿 actorId 就能完成认证的 API。

## 3. 数据契约

表结构描述当前原型。目标表迁入独立 IM 存储；小说工作、operation、成果版本由小说服务自己的迁移管理。

| 当前表 | 关键约束 |
| --- | --- |
| collab_schema_versions | 独立版本号；不覆盖旧工厂迁移版本；未知新版本拒绝打开 |
| collab_workspaces | owner_principal_id；当前 root 可映射一个工作空间 |
| collab_actors | 独立 UUID；principal 绑定、human/ai、档案版本；AI 初始 paused |
| collab_conversations | dm/group；DM 双方 ID 规范化为唯一键；无 project_id 前置要求 |
| collab_memberships | 每次邀请/加入独立 epoch；活动关系唯一；保存 joined_seq/left_seq |
| collab_messages | 会话内 seq 唯一，作者从可信访问上下文派生 |
| collab_deliveries | message + recipient 唯一，记录接收者当时的 membership epoch |
| collab_commands | workspace + principal + requestId 唯一；操作/作者/参数指纹与结果一起保存 |

ID 为标识而不是秘密。AI 的 `agent:<actorId>` principal 是内部映射，不是 API token；知道它不应取得执行能力。公开响应不包含 principal、凭据或模型私有系统指令。

后续按批次新增 WorkContext、CapabilityVersion/Grant、KnowledgeBinding、LogicalSession/HarnessBinding、Invocation/Lease、Outbox、Wait、Effect、Artifact/Review、MemorySource 等实体，字段语义遵循[运行契约](../plans/2026-10-14-person-world-runtime-contracts.md)。不提前建一套没有实际使用者的空表。

## 4. 认证、授权与观察

业务代码使用 `{workspaceId, principalId, actorId, mode}`。普通执行要求 actor 的 principal 与认证 principal 匹配；观察要求认证者是该工作空间所有者，mode=observe，所有写命令拒绝。拥有观察权限不等于以那个人身份执行。成员只能管理自己的收件与关系；管理人物需要所有者权限，邀请需要群管理员权限。

HTTP 适配必须从可信会话/短期运行凭证构建上下文，拒绝客户端提供 principalId 或任意 actorId；只读 subject 参数另行核验。模型端得到受限网关凭证，不得到 owner token、OpenCode 管理密码或旧小说管理 API 的网络访问权。

首版先限定本地单所有者。上线前仍须实现 owner 认证、Origin/Host/CSRF、防 DNS rebinding、速率和正文限制，且隔离旧管理入口。现有 localhost 监听不是完整认证；本批存储级负向测试不等于网络安全已完成。

AI 初始 paused 是运行许可状态：运行适配器只有在模型、授权、预算、沙箱和租约通过后才能产生执行上下文。存储层测试可以使用明确的测试 principal 模拟成员命令，但不会启用人物或调用模型；禁止将这些夹具当作生产认证实现。

## 5. 事务与消息语义

写命令使用 BEGIN IMMEDIATE，在同一事务内完成当前权限核验、幂等记录检查、业务写入和结果凭证。发消息同时递增 seq、保存一条消息、为当前已加入的其他成员保存 pending 收件。任何步骤失败全部回滚，包括 seq 和幂等凭证。

相同 requestId/参数返回原结果；相同 ID 不同命令/作者/参数返回 idempotency_conflict。读取历史结果前仍检查当前权限；重新入群不能借旧发送凭证获取当前历史边界之前的消息。SQLite busy 等可重试错误必须保留同一 requestId，不能伪报提交成功。

DM 双方共享同一时间线，不各复制一份聊天。群邀请只授予看邀请的能力，不授予旧消息正文。接受时取当前 last_seq + 1 为历史起点；退群后不再读取，重入新 epoch 不恢复旧历史，显式分享另走消息/资料授权。

观察与历史读取不更新收件、处理水位或运行记录。pending 表示业务消息尚未被处理，不等于用户没有打开窗口。处理确认由后续调度器以具体消息 ID/租约提交，不能仅用最大 seq 推断前面都已处理。

当前事务保证仅针对本地 SQLite 中这一个命令。未来网络发送、文件发布或其他外部副作用仍需要 Effect 账本，不能将本地去重扩展宣称为全系统 exactly-once。

## 6. API 计划

以下为待实现的 `/api/collab` 命名空间，不是已经上线的接口。所有列表分页；时间线使用稳定 seq 游标，错误 JSON 不泄漏无权对象存在性。

| 方法/路径 | 输入与约束 |
| --- | --- |
| GET /bootstrap | 已认证所有者的工作空间、本人、可用功能；不是匿名自动注册 |
| GET /actors | 获准名录，公开字段；私人档案另行授权 |
| POST /actors | name/specialty/instructions + clientRequestId；保存 paused |
| PATCH /actors/:id | 显式字段 + expectedVersion + clientRequestId |
| POST /conversations/direct | peerId + clientRequestId；双方唯一 |
| POST /conversations/groups | title/inviteeIds + clientRequestId；成员先 invited |
| POST /conversations/:id/invitations | actorId + clientRequestId；管理员 |
| POST /conversations/:id/invitations/respond | epoch/accept + clientRequestId；本人，旧邀请不能接受新一轮 |
| POST /conversations/:id/leave | clientRequestId；不能留下无管理员群 |
| GET /conversations/:id/messages | beforeSeq/limit，当前成员历史边界过滤 |
| POST /conversations/:id/messages | text/replyTo/attachments/mentions + clientRequestId；作者服务器派生 |
| GET /perspectives/:subjectId | 明确观察授权，返回只读投影 |
| GET /events | 与授权快照绑定的游标，断线重放/去重，失效后重新取快照 |

能力、知识、工作和运行接口沿用[详细设计](../plans/2026-10-14-person-world-detailed-design.md)的后续契约。R0 存储仅支持纯文本；不因为 API 计划列出附件字段就接受并丢弃未实现内容。

错误映射：invalid_input 400；未认证 401；forbidden/read_only 403；无权/不存在对象统一 not_found 404；版本/幂等冲突 409；限流 429；依赖不可用 503。未知错误返回脱敏 errorId，服务端保留诊断。

## 7. Harness 与人物运行

若采用先前 OpenCode 路线，IM worker 通过版本匹配 SDK 访问 `opencode serve`，现有 1.14.33 HTTP PoC 不能替代正式适配器验收。若复用 PM Bridge，则优先验证它现有的 Pi 路线。宿主选型与小说能力协议独立；本次架构更新不代表已经完成运行时切换。

每个人拥有自己的逻辑上下文。原生绑定至少含 actor、conversation/workContext、模型/人格/工具版本、知识授权与 epoch。多人群不是一个混合系统提示词 Session，同事不是 parent/subagent。资源隔离以执行环境为边界，不以 Session ID 为沙箱。

流程为持久收件、选择获准输入、预留预算/租约、构建运行快照、调用 Harness、受限工具访问业务、保存结果/输入回执。明确发言工具只提交一次公开消息，最终 assistant 文本不再次广播。普通讨论不必有 Task。

暂停收件仍持久化但不产生新收费执行；停止先请求收束再确认状态。已发生而未知的外部效果转为待核对。崩溃后用 invocationId、租约 fencing、输入回执和 Effect 对账，不只看“服务已启动”。

## 8. 能力、知识与连续性

本次能力 = 有效长期授权与合法临时授权，再受工作选择、组织限制、用途和实时授权状态约束。技能指南不自动授予工具，工具可执行不等于能读所有知识或用所有账号。

知识网关负责库/文档/版本/片段 ACL，检索前约束候选范围，返回前复核原文与引用权限。缓存、摘要、记忆和原生 Session 都绑定来源与授权 epoch。读取与向某群披露是两项许可；临时资料不会自动进入永久记忆。

授权撤销立即拦截新检索/效果、停止受影响运行，旧 Session 不再恢复；新上下文只带仍获准且可追溯的摘要。模型已收到的内容不能承诺通过删除 UI 消息而“遗忘”。细则与六个专项用例见[详细设计第 21 节](../plans/2026-10-14-person-world-detailed-design.md#21-按工作挂载能力与知识库)。

## 9. 迁移、备份与可观测性

新增表按需创建，无旧表删除/重命名，无生产数据库自动演练。本批测试只打开临时 root。正式启用前停止写入，使用 SQLite backup/checkpoint 一致性备份，并把原生日志、映射与资料版本纳入同一恢复方案；不可单独复制活跃 WAL 数据库主文件。

小说现有入口保留；新增窄能力 API 与连接插件，IM 在独立项目启用。旧 collab 代码经迁移验收后退出小说运行依赖，已有表不自动删除。小说执行权按项目互斥；回退关闭连接插件，聊天数据和领域成果分别保留。

日志关联 workspace/actor/conversation/work/run/cause/effect ID；正文与密钥默认不进诊断，观察事件不代表已处理。指标包括排队时长、失败/重试/重复拒绝、模型用量、预算、停止收束、待核对数量。上报与外部监控需要独立授权。
