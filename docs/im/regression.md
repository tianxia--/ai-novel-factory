# D1 回归核对记录

核对日期：2026-10-20。适用范围：独立人物 IM 存储基础，不是整个产品发布验收。

## 1. 新增模块

核心构建完成，ESM/CJS/TypeScript 声明均通过。`packages/ai-novel-core/tests/collab.test.mjs` 的 16 项测试全部通过，0 失败、0 跳过。覆盖内容见[开发记录](delivery.md#3-已通过的-16-项)。

```sh
rtk proxy npm --prefix packages/ai-novel-core run build
rtk proxy node --test --test-timeout=30000 packages/ai-novel-core/tests/collab.test.mjs
```

仅操作临时 root 的 factory.sqlite，不访问生产数据库，不调用模型、不产生模型费用。Node 的 SQLite experimental warning 不影响本次通过结果。

追加执行原有 `factory-langgraph-checkpointer.test.mjs` 的 2 项和 `workflow-step-persistence.test.mjs` 的 1 项测试，与 16 项 IM 测试一起运行，合计 19/19 通过。该结果只证明这些数据库持久化路径通过，不扩大为全部旧流程通过。

文档检查覆盖本目录 6 份文件、16 个本地链接及其引用锚点，全部通过；`git diff --check` 通过。GitNexus 变更检测报告 high、14 条受影响流程，主要来自共享 FactoryDb 入口；仍须按高影响范围回归。

## 2. 原始 HEAD 对照

基线提交：`7685c37a8e804eaa5dcd7274ebc88a7294a610c7`。

方法：使用 `git archive` 将 HEAD 的核心源码、资源、测试、package.json 和 tsconfig 提取到独立临时目录；复用本机现有依赖，从源码重新构建。没有 checkout/reset 当前工作区，也没有沿用 HEAD 中可能过期的 dist。比较前确认两个测试源文件与当前工作区逐字节相同。基线和当前构建使用同一 Node 24.10.0、依赖及环境。

以下四个用例通过精确名称筛选执行，基线/当前均退出 1；比较错误正文 SHA-256，四项均一致。每次测试运行限定 60 秒墙钟时间，单项上限 15 秒；正常结束后删除临时副本。

| 测试文件与用例 | HEAD 与当前结果 | 错误正文摘要 SHA-256 前 12 位 |
| --- | --- | --- |
| chapter-blueprint-learning.test.mjs: `learning loop stops when one candidate simultaneously violates incompatible canon constraints` | false，预期 true | b6424a0d6406 |
| core.test.mjs: `core initializes a stateful project with a super graph` | 12，预期 8 | 38a76dbbadc49 |
| core.test.mjs: `quality report treats soft narrative style issues as polish advice` | 评分 4/10，预期 8/10 | 46a327b1e3c5 |
| core.test.mjs: `quality report blocks repeated narrative loops as hard failures` | 评分 4/10，预期 5/10 | 5a72e688999e |

结论限定为：这四个失败在基线提交已存在，不能归因于本次新增 IM 模块。没有因此修改小说质量门禁或放宽测试断言，也不据此宣称其他失败都是历史问题。

## 3. 尚未通过的范围

| 范围 | 已观察到的情况 | 后续核对 |
| --- | --- | --- |
| 受限环境网络测试 | HTTP 替身 listen EPERM；允许回环端口后 AIGC 相关测试通过 | 网络用例须在同条件运行，不能算成业务断言失败 |
| 完整 core 回归 | 部分生产流程停在 setting_review；恢复状态与夹具预期不一致；存在超时和未退出进程 | 对剩余失败建立精确用例与 HEAD 对照 |
| 插件回归 | 构建成功，测试退出 1；恢复、产物统计、页面标签断言失败，输出出现 Node 原生断言 | 单独复现原生错误；区分测试环境、夹具和实现问题 |
| server 回归 | 本轮未完成整套验证 | D2 增加可信 API 契约、HTTP 安全与原有服务冒烟 |
| 真实并发/运行 | 未验证多进程压力、SDK、真实模型、沙箱、外部副作用与浏览器 | 按 D2–D6 门槛执行，不以存储测试代替 |

两组未退出的完整核心回归任务及其已确认子进程已停止。后续完整测试必须同时具有单项超时、整体墙钟上限和子进程清理，不能无限等待一个已失败的运行。

## 4. 本批结论

可以交付文档和存储模块供后续集成，但不能标记全量测试通过或直接启用模型。D2 从可信认证/API 开始；默认关闭新入口，仍使用同一个工厂数据库，未接执行时 UI 不显示虚构回复或在线状态。
