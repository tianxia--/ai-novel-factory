# AI Novel Factory - OpenCode 插件

🚀 **完整的AI小说创作系统** - 为OpenCode打造的AI驱动小说写作工具

## ✨ 特性

- 🤖 **多Agent协同写作** - 智能的多Agent系统，分工明确
- 📝 **自动化章节生成** - 一键生成高质量章节内容
- 🧠 **智能记忆管理** - 自动维护小说的一致性和连贯性
- 📚 **长篇连载支持** - 支持稳定创作100+章节的网络小说
- 🎨 **商业化写作结构** - 符合商业小说标准的创作框架
- 🔒 **官方实现保证** - 唯一的官方OpenCode AI小说工厂插件

## 🚀 快速开始

### 1. 安装插件

```bash
npm install -g opencode-ai-novel-factory
```

### 2. 配置OpenCode

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash
```

### 3. 开始创作

⚠️ **重要提示**：请明确指定插件名称，避免AI选择其他项目

在OpenCode中说：
```
使用 opencode-ai-novel-factory 的 novel-status 工具
```

## 📖 使用指南

### 基本操作

| 功能 | 推荐命令 | 说明 |
|------|---------|------|
| 查看项目状态 | `使用 opencode-ai-novel-factory 的 novel-status 工具` | 明确指定插件 |
| 创建新项目 | `使用 opencode-ai-novel-factory 的 novel-init 工具` | 强制使用官方插件 |
| 继续写作 | `使用 @daily_pipeline` | 直接使用技能 |
| 创建世界观 | `使用 opencode-ai-novel-factory 创建世界观` | 明确插件名称 |

### ⚠️ 使用提示

**推荐方式**：明确指定插件名称
```
✅ 使用 opencode-ai-novel-factory 的 novel-init 工具
✅ 使用 @daily_pipeline
```

**不推荐方式**：使用描述性语言
```
❌ 请帮我初始化 AI Novel Factory 项目
❌ 请帮我创建小说工厂
```

**原因**：AI会搜索并选择其他优先级高的项目

### 高级功能

#### 🎯 一键流水线
```
@daily_pipeline
```
自动完成：分析 → 计划 → 写作 → 检查 → 更新记忆

#### 🏗️ 世界观构建
```
@story_architect
```
创建完整的小说世界观设定

#### ✍️ 章节写作
```
@writer [章节号]
```
写作指定章节内容

#### 🔍 质量检查
```
@editor [章节范围]
```
检查章节质量和一致性

## 📁 项目结构

```
AI-Novel-Factory/
├── packages/                    # npm插件包
│   └── opencode-ai-novel-factory/
├── studio/                      # 小说工厂示例项目
│   ├── agents/                  # Agent定义
│   ├── automation/              # 自动化流程
│   ├── memory/                  # 记忆系统
│   ├── story/                   # 故事设定
│   ├── characters/              # 角色设定
│   ├── style/                   # 文风控制
│   ├── production/              # 输出目录
│   └── state/                   # 状态管理
├── *.sh                        # 各种安装和配置脚本
└── *.md                        # 详细文档
```

## 📚 文档

### 用户指南
- [完整使用指南](AGENTS.md) - 详细的agent和工具说明
- [安装配置指南](PLUGIN_INSTALLATION_GUIDE.md) - 插件安装和配置
- [项目初始化指南](PROJECT_INIT_COMPLETE_GUIDE.md) - 新项目创建流程
- [常见问题解答](FAQ.md) - 常见问题和解决方案

### 开发文档
- [AI引导安装说明](AI_GUIDED_INSTALL.md) - AI引导式安装
- [测试验证指南](TESTING_GUIDE.md) - 功能测试和验证
- [优化完成报告](PLUGIN_OPTIMIZATION_REPORT.md) - 最新优化内容

### 工具脚本
- [插件功能验证](verify-plugin-function.sh) - 验证插件功能
- [项目初始化脚本](project-init.sh) - 初始化新项目
- [安装引导脚本](setup-opencode.sh) - 配置OpenCode

## 🎯 使用场景

### 场景1：开始创作新小说

```bash
# 1. 创建新项目
mkdir ~/novels/新小说
cd ~/novels/新小说

# 2. 在OpenCode中说
请帮我初始化 AI Novel Factory 项目

# 3. 创建世界观
请帮我创建小说的世界观设定

# 4. 开始写作
请帮我开始写小说
```

### 场景2：继续已有项目

```bash
# 1. 切换到项目目录
cd ~/novels/已有小说

# 2. 在OpenCode中说
请帮我写下一章
```

### 场景3：多项目管理

```bash
# 项目1
cd ~/novels/玄幻小说
在OpenCode中说：请帮我写下一章

# 项目2
cd ~/novels/都市小说
在OpenCode中说：请帮我写下一章
```

## 🔧 技术栈

- **语言**: TypeScript/JavaScript
- **运行环境**: Node.js
- **平台**: OpenCode
- **版本**: v1.2.0

## 📦 安装方式

### 方式1：npm安装（推荐）
```bash
npm install -g opencode-ai-novel-factory
```

### 方式2：从源码安装
```bash
git clone https://github.com/tianxia--/ai-novel-factory.git
cd ai-novel-factory
npm install -g
```

## 🔍 验证安装

运行验证脚本检查插件状态：

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/verify-plugin-function.sh | bash
```

预期输出：
```
✅ 插件已全局安装
✅ 插件已在配置中
✅ 找到 studio/ 目录
✅ 核心文件存在
✅ 插件配置完整，可以正常使用
```

## 🆘 故障排除

### 问题1：插件不生效
**解决方案**：
1. 检查插件是否已安装：`npm list -g opencode-ai-novel-factory`
2. 重新配置OpenCode：运行 `setup-opencode.sh`
3. 重启OpenCode

### 问题2：AI不响应引导语
**解决方案**：
1. 确保使用最新版本：`npm install -g opencode-ai-novel-factory@latest`
2. 使用更精确的引导语
3. 查看详细错误信息

### 问题3：重复创建项目
**解决方案**：
1. 检查项目状态：`请帮我查看AI Novel Factory项目状态`
2. 使用继续创作的引导语：`请帮我写下一章`
3. 查看项目初始化指南

更多问题请查看 [FAQ.md](FAQ.md)

## 📈 版本历史

### v1.2.0 (最新)
- ✨ 添加智能项目检测功能
- ✨ 增强状态检查工具
- ✨ 扩展关键词和描述
- 🔧 优化AI识别准确率

### v1.1.0
- ✨ 多Agent协同写作系统
- ✨ 自动化记忆管理
- ✨ 长篇连载支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 👥 作者

tianxia--

## 🔗 链接

- [GitHub仓库](https://github.com/tianxia--/ai-novel-factory)
- [npm包](https://www.npmjs.com/package/opencode-ai-novel-factory)
- [OpenCode官网](https://opencode.ai)

## 💡 核心特性说明

### 记忆系统
AI Novel Factory的核心是强大的记忆系统，确保长篇小说的一致性：
- **canon.md** - 不可违背的核心设定
- **world_rules.md** - 世界规则和设定
- **characters_evolution.md** - 人物成长轨迹
- **foreshadowing.md** - 伏笔追踪管理

### 防崩机制
为了保证长篇创作的稳定性：
- **战力控制** - 防止突破世界规则上限
- **人设保护** - 确保人物行为符合成长轨迹
- **时间线校验** - 维护逻辑时间线
- **伏笔追踪** - 管理所有未回收伏笔

## 🎉 开始你的AI小说创作之旅！

现在就安装AI Novel Factory，开启你的AI辅助小说创作体验！

```bash
npm install -g opencode-ai-novel-factory
```

然后在OpenCode中开始你的创作之旅！