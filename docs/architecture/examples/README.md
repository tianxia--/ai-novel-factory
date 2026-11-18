# 组合契约示例

这些是设计夹具，不是现有产品的配置格式或已安装插件。字段属于[能力契约](../capability-contract.md)，身份与资源都是虚构样例，不含有效凭据。

| 文件 | 用途 |
| --- | --- |
| [composition.json](composition.json) | 两个独立服务经连接插件组合，只有连接地址和凭据引用 |
| [work-binding.json](work-binding.json) | 一个作者在一项工作中选择工具、资源、知识和受众 |
| [operation-accepted.json](operation-accepted.json) | 小说服务已持久受理，但未交付成果 |
| [operation-succeeded.json](operation-succeeded.json) | 同一操作完成并返回明确草稿版本；无服务模型调用 |
| [operation-reconciliation-required.json](operation-reconciliation-required.json) | 已提交请求的效果不确定，必须查询核对，不能自动重做 |

后三份文件须通过[operation 结果 Schema](../contracts/operation-result.schema.json)。已完成示例和待核对示例是同一受理请求的两种分支夹具，不表示状态会从 succeeded 倒退为待核对。

work-binding 中的 actor、会话和 work ID 保存在 IM；小说服务看到的是网关认证的资源权限和外部调用标识。模型不能通过修改此 JSON 取得新权限。资源 URI 和凭据引用都不是 bearer token。

composition 只说明部署关系，正式启动命令与插件清单在 S2 实现后提供。当前文件不能直接传给 PM Bridge 配置加载器。
