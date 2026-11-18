# 小说能力接入与迁移

日期：2026-10-20。状态：架构和实施路线，尚未执行代码迁移。上位决定见[项目边界](README.md)，通用行为见[能力契约](capability-contract.md)。

本页只约束小说能力路线。平台各版本按[通用产品 PRD](../product/README.md)推进，首个小说适配器按[n0.1 PRD](../product/capabilities/novel/n0.1/prd.md)实施；平台无需等待小说接口完成。

## 1. 复用范围

小说仓库继续拥有 factory.sqlite、现有 server/worker、质量规则、写作资源、连续性检查、领域记忆、Canon 和版本门禁。CLI、现有界面及 OpenCode 插件继续作为小说的独立客户端。

IM 仓库拥有人员和协作。能力服务中已有“Author”“Editor”等领域流程标签，不自动创建或映射为 IM 的真实人物；调用工具的作者身份由外部调用主体审计，批处理里的角色标签只是领域执行步骤。

现有 OpenCode 插件只暴露 `novel-init` / `novel-status`，它是旧客户端适配器，并非本文拟新增的 MCP 能力插件。两者分别发布，不能把未实现的工具写成现有工具。

## 2. 第一版能力拆分

以下是目标公开工具，不是当前已上线接口。外层插件命名空间由宿主决定，例如 `novel__chapter_draft_submit`；领域局部工具名保持稳定。

| 能力 | 目标工具 | 输入/结果 | 常见授权 |
| --- | --- | --- | --- |
| 项目 | project_list、project_get、project_create | 获准项目、简介、opaque projectId | 读取/创建分开 |
| 故事设计 | story_constraints_get、story_proposal_submit | 读取约束，保存指定版本的设定候选 | 编剧可提案，不自动改 Canon |
| 章纲 | outline_get、outline_proposal_submit | 读取/提交章纲候选版本 | 编剧、作者按工作获准 |
| 正文 | chapter_context_get、chapter_draft_submit | 返回获准写作上下文；提交人物写出的正文候选 | 作者 |
| 修改 | chapter_revision_submit | 父版本、修改正文、修改说明 | 指定章节作者 |
| 审稿 | chapter_review_submit、chapter_checks_run | 编辑评审意见；运行确定性规则检查 | 编辑/检查工具权限分别配置 |
| 正式版本 | artifact_get、chapter_promote | 指定成果；把通过门禁的候选提升为正式版本 | 提升单独授权 |
| 服务自动化 | legacy_batch_submit | 明确范围、模型策略、预算与终止条件 | 可选高级能力，默认不挂载 |
| 操作管理 | operation_get、operation_cancel | 持久操作状态、指定工作取消 | 仅获准操作范围 |

IM 中的能力组合由这些动作和技能指南构成。不会为了挂一个“小说创作”能力，把所有项目、模型生成、审批和发布工具全部授予每个人。

初次贯通仅做 project_get、chapter_context_get、chapter_draft_submit、artifact_get、operation_get/cancel。人物模型在 IM 内生成正文，小说服务保存候选版本并运行必要校验；先证明边界，再扩充规划、审稿和发布。

## 3. 现有实现与适配难点

以下函数是调研入口，不是可原样对外暴露的安全 API：

| 当前入口 | 可复用部分 | 接入前必须拆清 |
| --- | --- | --- |
| createDetailedChapterBlueprint | 因果章纲生成/资源组织 | 候选存储与正式 Canon 更新分开 |
| createDraftBody / runChapterProductionPipeline | 原有生成和整章自动化 | 前者仍可能调用模型；完整流程只能作为显式批处理 |
| prepareChapterProductionInputs | 风格、前章、人物、连续性材料 | 实际会生成/写入缺失章纲及资料，不能直接标为只读 context_get |
| createQualityReport / 连续性与风格评估 | 确定性评估与领域门禁 | 评审绑定目标版本，禁止把旧报告用于新正文 |
| commitChapterProductionStage | 正式章、记忆、人物关系等领域写回 | 当前写多个文件并更新状态，不能当作“仅保存草稿”接口 |
| FactoryDb / worker | 持久化和领域工作执行 | 公开调用必须限定项目与动作，不能开放任意 root/path/SQL |

出处：[输入准备](../../packages/ai-novel-core/src/writing-pipeline.ts)、[章节工作流](../../packages/ai-novel-core/src/production-chapter-workflow.ts)、[现有导出](../../packages/ai-novel-core/src/index.ts)。具体拆分前逐个执行 GitNexus context/impact，按影响范围补测试。

只读上下文接口采用独立查询路径；缺失资料返回明确 prerequisites，不隐式调用模型、创建章纲或推进生产状态。草稿提交仅保存候选，不调用正式章节 commit。正式提升由小说服务校验 Canon/章纲/风格版本和指定评审，不让群内一句“通过”直接改正式状态。

## 4. 小说公开 API 草案

能力插件只访问一个版本化的窄入口 `/api/capabilities/v1`，不复用可管理所有项目的旧 owner API。路径为计划接口；均需认证和资源授权。

| 方法/路径 | 语义 |
| --- | --- |
| GET /descriptor | 服务/契约版本、支持动作与限制 |
| GET /projects | 当前访问主体获准的项目，游标分页 |
| GET /projects/:id | 项目概要和资源版本 |
| GET /projects/:id/chapters/:chapter/context | 显式版本的只读获准上下文 |
| POST /projects/:id/chapters/:chapter/drafts | 正文候选 + baseVersion；Idempotency-Key |
| POST /projects/:id/chapters/:chapter/reviews | 指定 artifact/version 的评审 |
| POST /projects/:id/chapters/:chapter/promotions | 指定候选/评审/预期当前版本；单独写权限 |
| GET /operations/:id | 获准操作状态与结果引用 |
| POST /operations/:id/cancel | 幂等取消请求 |
| GET /artifacts/:id/versions/:version | 指定版本正文/元数据，非本机路径 |

新增候选、operation、调用幂等、版本清单等领域记录由小说项目自己迁移。既有领域 worker 可负责后台执行，IM 不直接 claim 它的 jobs。提交候选与请求正式提升均必须携带版本条件，冲突返回 VERSION_CONFLICT，不覆盖别人刚提交的版本。

## 5. 结果如何回到群

IM 保存 workId、bindingId、invocationId 与外部 operation/resource 引用；小说服务只处理自己的 operation，知道可审计的外部主体和调用键。

后台监督器取得完成结果后，IM 先核对目标会话当前可见性和资料披露授权，再生成带作者、来源、版本的成果卡。消息写入与 delivery receipt 在 IM 自己的事务内完成，唯一键包含安装实例、invocationId、结果版本和目标会话。

若调用后 IM 崩溃，重启查询同一 operation；若完成卡已写入，receipt 阻止重复交付。群被归档/人物离群时，成果继续留在小说服务和获准工作详情，是否向群交付遵循当前权限。不会丢失业务结果，也不会自动换群公开。

## 6. 旧 IM 存储代码的处理

当前 `src/collab` 与 FactoryDb.getCollaborationStore 使用小说数据库，是上一批实现事实，已不符合新的目标边界。它尚未接入生产 HTTP/UI，按以下顺序处理：

1. 暂停在小说仓库扩充人物、群聊和 Harness 实现。现有代码与测试保留作参考，不能再作为目标 IM 后端入口。
2. 已按用户授权把参考代码复制到独立 `projects/persona-im`；只在副本验收可复用范围，迁入有价值的权限/幂等/历史测试，不再修改原参考工程，也不保留第二套生产人物模型。
3. 若选择自建 IM，将 collab 模块放入独立 IM 项目，接 IM 自有存储；移除其对 FactoryDb 的运行依赖。
4. 在独立宿主通过对应验收后，单独变更移除小说 FactoryDb 的 collab 导入/缓存/入口，补旧客户端与 worker 回归。既有 collab 表保留，不在升级中静默删除。
5. 若发现真实使用的 collab 数据，再设计显式导出/导入：保持 actor/conversation/message ID、成员 epoch、幂等与收件关系，原库保留备份。没有生产数据证据时不自动迁移。

以上为迁移计划。本轮只更新架构与文档，没有移走源码、修改外部 IM 仓库或改写数据库。

## 7. 实施顺序

下表为小说接入批次，不是整个通用平台的版本顺序。小说独立接口可单独开发；IM 组合等待平台相应能力契约就绪，不能把小说置为平台启动前提。

| 批次 | 交付 | 通过门槛 |
| --- | --- | --- |
| S0 架构 | 两项目边界、能力/operation 契约、迁移与样例 | 本目录；示例解析/契约验证；本轮完成文档 |
| S1 独立接口 | 小说只读项目/上下文与候选提交、自己的认证和 operation | 不启动 IM，用 API 客户端可创建并读取候选；只读零副作用 |
| S2 连接插件 | MCP 工具 + Skills、版本发现、公开 API 转换 | 不读取两个项目源码/数据库；可在独立 MCP 客户端工作 |
| S3 IM 组合 | 安装、人物能力、任务/知识选择、可信调用、结果监督 | 两群两项目不串资料；只给作者草稿权也能完成调用 |
| S4 完整协作 | 编剧/作者/编辑、评审与正式提升、恢复/取消 | 交付明确版本；重试不重复；旧评审不能批准新稿 |
| S5 解耦清理 | 旧 collab 接口退出小说仓库、独立发布与组合矩阵 | 移除小说插件不影响 IM；停止 IM 不影响小说；兼容版本可独立升级 |

S1 前必须分类现有小说回归失败，避免新接口把不稳定流程当作成功能力。先前 19 项通过只覆盖存储相关路径，不能替代此次能力接入验收。

## 8. 解耦验收矩阵

| ID | 场景 | 应有结果 |
| --- | --- | --- |
| SEP-01 | IM 无小说插件，小说进程停止 | 创建人物、私聊、建群和普通讨论正常 |
| SEP-02 | 小说独立构建并启动，IM 停止 | API/CLI 可读项目、提交候选，领域状态正常 |
| SEP-03 | 只拿已发布 IM 与插件产物，不检出小说源码 | 经公开 API 使用能力 |
| SEP-04 | 安装第二种业务能力 | 不修改 IM 核心/小说核心，无小说专用必填字段 |
| SEP-05 | 一个作者在两群参与两本书 | 凭据、资料、工具选择、Session 不串用 |
| SEP-06 | 挂技能但未授予对应工具/资料 | 不执行或读取；显示缺少授权 |
| SEP-07 | 编辑只有审稿权，作者只有草稿权 | 不能互借正式提升权限；审阅绑定版本 |
| SEP-08 | 提交请求成功但客户端超时，随后重试/重启 | 同 invocation 返回同 operation，群交付一次 |
| SEP-09 | 工作中撤销知识/写权限或停止人物 | 后续读取/提交受阻；已有副作用按真实状态核对 |
| SEP-10 | 插件或小说服务不可用、卸载插件 | IM 聊天可用；历史保留；恢复后可查询原工作 |
| SEP-11 | IM/插件/小说分别升级、回退 | 支持版本继续工作，不支持版本显式拒绝 |
| SEP-12 | 数据库或私有文件访问探测 | IM 不打开 factory.sqlite，小说不打开 IM 库，无源码路径跨依赖 |
| SEP-13 | context_get 遇到缺章纲/风格文件 | 返回前置条件；文件、数据库和模型调用次数不变 |
| SEP-14 | 两个作者同时提交/提升同章版本 | 候选各自保存，冲突显式返回，正式版本不被静默覆盖 |

这些是待执行的产品/集成验收。只有接口 Schema 与示例通过检查，不表示 SEP 用例已经通过。
