# AI Novel Factory - AI 引导式完整安装

## 🤖 对 AI 助手说一句话

```
请帮我安装和配置完整的 AI Novel Factory
```

## 📋 AI 应该引导用户执行的步骤

### 第一步：环境检查
AI 应该检查并引导用户安装必要的环境：
1. 检查 Node.js 是否安装
2. 检查 npm 是否可用
3. 如果没有安装，提供安装指导

### 第二步：完整安装
AI 应该引导用户执行：
```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/ai-guided-complete-install.sh | bash
```

或者分步执行：
```bash
# 安装插件
npm install -g opencode-ai-novel-factory

# 配置 OpenCode
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash

# 初始化项目
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-inline.sh | bash
```

### 第三步：项目设置
AI 应该引导用户：
1. 创建世界观设定
2. 制定故事大纲
3. 设计主角角色

### 第四步：开始创作
AI 应该引导用户：
1. 运行 @daily_pipeline
2. 生成第一章
3. 说明后续维护

## 🔧 完整的AI引导响应模板

### 当用户说 "请帮我安装和配置完整的 AI Novel Factory"

```
我来帮你安装和配置完整的 AI Novel Factory！

📋 安装步骤：
1. 检查环境...
2. 安装 OpenCode 插件...
3. 配置 opencode.json...
4. 验证安装...
5. 初始化项目（可选）...

让我先检查你的环境...

🔍 环境检查：
✅ Node.js: v20.x.x
✅ npm: 9.x.x

📦 安装插件：
正在全局安装 opencode-ai-novel-factory...

⚙️ 配置 OpenCode：
正在配置 opencode.json...

🔍 验证安装：
✅ 插件安装成功
✅ 配置验证通过

🎯 是否现在初始化小说工厂项目？
1) 立即初始化（推荐）
2) 稍后在 OpenCode 中初始化

请选择 1 或 2...
```

### 当用户选择初始化项目

```
🚀 正在初始化小说工厂项目...

📁 创建目录结构...
📋 生成模板文件...

🌍 现在让我们创建你的小说世界观！

请告诉我：
1. 故事类型（玄幻/都市/科幻/言情/悬疑）
2. 预期篇幅（10万字/30万字/100万字）
3. 目标读者（青年/成年/全年龄）

有了这些信息，我就可以为你定制世界观设定了！
```

## 🎯 一句话命令大全

### 安装配置类
- `请帮我安装和配置完整的 AI Novel Factory`
- `请帮我检查 AI Novel Factory 的安装状态`
- `请帮我重新配置 opencode.json`

### 项目管理类
- `请帮我初始化小说工厂项目`
- `请帮我查看项目状态`
- `请帮我重置项目配置`

### 创作流程类
- `请帮我创建小说的世界观设定`
- `请帮我制定完整的故事大纲`
- `请帮我设计主角角色`
- `请帮我开始写小说`

### 质量控制类
- `请帮我检查第X章的质量`
- `请帮我优化文风`
- `请帮我更新记忆系统`

## 🔗 相关脚本链接

- 完整安装脚本：https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/ai-guided-complete-install.sh
- 配置脚本：https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh
- 项目初始化：https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-inline.sh
- 安装验证：https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/verify-install.sh

## 📝 更新说明

### 新增功能
1. **一键完整安装** - 包含环境检查、插件安装、配置、初始化
2. **AI 引导式交互** - 用户只需说一句话，AI引导完成所有步骤
3. **智能错误处理** - 自动检测和解决常见安装问题
4. **灵活配置选项** - 支持项目级和全局级配置

### 用户体验改进
1. **零学习成本** - 用户无需了解技术细节
2. **全程AI陪伴** - 每一步都有AI引导和说明
3. **容错能力强** - 自动处理各种异常情况
4. **快速验证** - 实时检查安装和配置状态