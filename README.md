# AI Novel Factory - OpenCode 插件

🚀 **完整的AI小说创作系统** - 为OpenCode打造的AI驱动小说写作工具

## ✨ 特性

- 🤖 **多Agent协同写作** - 智能的多Agent系统，分工明确
- 📝 **自动化章节生成** - 一键生成高质量章节内容
- 🧠 **智能记忆管理** - 自动维护小说的一致性和连贯性
- 📚 **长篇连载支持** - 支持稳定创作100+章节的网络小说
- 🎨 **商业化写作结构** - 符合商业小说标准的创作框架
- 🔒 **官方实现保证** - 唯一的官方OpenCode AI小说工厂插件

## 📸 截图

<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125243.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125307.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125327.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125345.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125401.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125419.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125438.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125505.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125529.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125554.jpg" width="400">
<br>
<br>
<img src="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/sc_20260304125609.jpg" width="400">

## 🚀 快速开始

### 一句话总结

```bash
npm install -g opencode-ai-novel-factory
```

然后在OpenCode中说：`使用 opencode-ai-novel-factory 的 novel-status 工具`

### 详细步骤

#### 1. 安装插件（一生一次）

```bash
npm install -g opencode-ai-novel-factory
```

#### 2. 配置OpenCode（一次）

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash
```

#### 3. 验证安装

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/verify-plugin-function.sh | bash
```

看到✅就表示成功！

#### 4. 开始创作

⚠️ **重要提示**：请明确指定插件名称，避免AI选择其他项目

在OpenCode中说：
```bash
# 查看项目状态
使用 opencode-ai-novel-factory 的 novel-status 工具

# 创建新项目
使用 opencode-ai-novel-factory 的 novel-init 工具初始化项目

# 继续写作
使用 @daily_pipeline 一键生成章节

# 创建世界观
使用 opencode-ai-novel-factory 创建世界观设定
```

## 📖 使用指南

### 基本操作

| 功能 | 推荐命令 | 说明 |
|------|---------|------|
| 查看项目状态 | `使用 opencode-ai-novel-factory 的 novel-status 工具` | 明确指定插件 |
| 创建新项目 | `使用 opencode-ai-novel-factory 的 novel-init 工具` | 强制使用官方插件 |
| 继续写作 | `使用 @daily_pipeline` | 直接使用技能 |
| 创建世界观 | `使用 opencode-ai-novel-factory 创建世界观` | 明确插件名称 |
| 质量检查 | `使用 @editor 检查章节质量` | 使用Agent |

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
```bash
@daily_pipeline
```
自动完成：分析 → 计划 → 写作 → 检查 → 更新记忆

#### 🏗️ 世界观构建
```bash
@story_architect
```
创建完整的小说世界观设定

#### ✍️ 章节写作
```bash
@writer [章节号]
```
写作指定章节内容

#### 🔍 质量检查
```bash
@editor [章节范围]
```
检查章节质量和一致性

## 🎯 使用场景

### 场景1：第一次使用

```bash
# 1. 安装插件
npm install -g opencode-ai-novel-factory

# 2. 创建第一个小说
mkdir ~/novels/我的第一部小说
cd ~/novels/我的第一部小说

# 3. 在OpenCode中说
使用 opencode-ai-novel-factory 的 novel-init 工具初始化项目

# 4. 创建世界观
使用 opencode-ai-novel-factory 创建世界观设定

# 5. 开始写作
使用 @daily_pipeline 一键生成章节
```

### 场景2：继续已有项目

```bash
# 1. 切换到已有项目
cd ~/novels/已有小说

# 2. 在OpenCode中说
使用 opencode-ai-novel-factory 的 novel-status 工具查看状态

# 3. 继续写作
使用 @daily_pipeline 生成下一章
```

### 场景3：多项目管理

```bash
# 项目1
cd ~/novels/玄幻小说
在OpenCode中说：使用 @daily_pipeline 生成章节

# 项目2
cd ~/novels/都市小说
在OpenCode中说：使用 @daily_pipeline 生成章节
```

### 场景4：换新电脑

```bash
# 1. 重新安装插件
npm install -g opencode-ai-novel-factory

# 2. 配置OpenCode
curl -fsSL .../setup-opencode.sh | bash

# 3. 复制小说项目
cp -r ~/旧电脑/novels ~/novels

# 4. 继续使用
cd ~/novels/我的第一部小说
使用 @daily_pipeline 生成章节
```

## 📁 项目结构

```
AI-Novel-Factory/
├── packages/                    # npm插件包
│   └── opencode-ai-novel-factory/
│       ├── src/                # 源代码
│       ├── dist/               # 构建产物
│       ├── agents/             # Agent定义
│       ├── skills/             # Skill定义
│       └── templates/          # 模板文件
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

## 📚 完整文档

### 用户指南
- **[QUICK_START.md](QUICK_START.md)** - 快速开始指南（从这里开始）
- **[AGENTS.md](AGENTS.md)** - Agent和工具详细说明
- **[PLUGIN_INSTALLATION_GUIDE.md](PLUGIN_INSTALLATION_GUIDE.md)** - 插件安装和配置
- **[PROJECT_INIT_COMPLETE_GUIDE.md](PROJECT_INIT_COMPLETE_GUIDE.md)** - 新项目创建流程
- **[FAQ.md](FAQ.md)** - 常见问题解答

### 优先级问题解决方案
- **[PLUGIN_PRIORITY_SOLUTION.md](PLUGIN_PRIORITY_SOLUTION.md)** - AI优先级问题完整解决方案
- **[PRIORITY_FIX_COMPLETE.md](PRIORITY_FIX_COMPLETE.md)** - 优先级问题修复报告

### 开发文档
- **[AI_GUIDED_INSTALL.md](AI_GUIDED_INSTALL.md)** - AI引导式安装
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - 功能测试和验证
- **[PLUGIN_OPTIMIZATION_REPORT.md](PLUGIN_OPTIMIZATION_REPORT.md)** - 最新优化内容

### 工具脚本
- **[verify-plugin-function.sh](verify-plugin-function.sh)** - 验证插件功能
- **[project-init.sh](project-init.sh)** - 初始化新项目
- **[setup-opencode.sh](setup-opencode.sh)** - 配置OpenCode
- **[ai-guided-complete-install.sh](ai-guided-complete-install.sh)** - 完整安装引导

## 🔧 技术栈

- **语言**: TypeScript/JavaScript
- **运行环境**: Node.js
- **平台**: OpenCode
- **版本**: v1.3.0

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
2. **使用更精确的引导语**：`使用 opencode-ai-novel-factory 的 novel-init 工具`
3. 查看详细错误信息

### 问题3：AI总是创建新项目/选择错误项目

**解决方案**：
1. **明确指定插件名称**：`使用 opencode-ai-novel-factory 的 novel-init 工具`
2. 检查项目状态：`使用 opencode-ai-novel-factory 的 novel-status 工具`
3. 查看优先级问题解决方案：[PLUGIN_PRIORITY_SOLUTION.md](PLUGIN_PRIORITY_SOLUTION.md)

### 问题4：重复创建项目

**解决方案**：
1. 检查项目状态：`使用 opencode-ai-novel-factory 的 novel-status 工具`
2. 使用继续创作的引导语：`使用 @daily_pipeline 生成章节`
3. 查看项目初始化指南：[PROJECT_INIT_COMPLETE_GUIDE.md](PROJECT_INIT_COMPLETE_GUIDE.md)

更多问题请查看 [FAQ.md](FAQ.md)

## 📈 版本历史

### v1.3.0 (最新)
- ✨ **强化工具描述** - 明确标识官方实现
- ✨ **添加唯一标识关键词** - `opencode-ai-novel-factory`, `official-novel-factory`
- ✨ **更新用户引导方式** - 推荐强制指定插件名称
- ✨ **创建优先级问题解决方案** - 完整的AI优先级问题解决指南
- 🔧 **优化AI识别准确率** - 避免AI选择错误项目

### v1.2.0
- ✨ 添加智能项目检测功能
- ✨ 增强状态检查工具
- ✨ 扩展关键词和描述
- 🔧 优化AI识别准确率

### v1.1.0
- ✨ 多Agent协同写作系统
- ✨ 自动化记忆管理
- ✨ 长篇连载支持

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

## 🎯 关键要点

### 三个重要概念

1. **插件（全局安装）**
   ```bash
   npm install -g opencode-ai-novel-factory
   ```
   - 安装到系统，所有项目都能用
   - 频率：一生只需一次

2. **项目（每个小说一个）**
   ```bash
   mkdir ~/novels/新小说
   使用 opencode-ai-novel-factory 的 novel-init 工具初始化项目
   ```
   - 为每个小说创建独立的创作环境
   - 频率：每个小说一次

3. **写作（无限次）**
   ```bash
   使用 @daily_pipeline 生成章节
   ```
   - 使用AI生成章节内容
   - 频率：无限次

### 最佳实践

1. **明确指定插件名称**
   ```
   ✅ 使用 opencode-ai-novel-factory 的 novel-init 工具
   ❌ 请帮我初始化 AI Novel Factory 项目
   ```

2. **使用@符号直接引用**
   ```
   ✅ @daily_pipeline
   ❌ 使用日常流水线
   ```

3. **避免模糊描述**
   ```
   ❌ 请帮我创建小说工厂
   ❌ 帮我写个小说
   ```

## 🎉 开始你的AI小说创作之旅！

### 第一步：查看快速开始指南
从 [QUICK_START.md](QUICK_START.md) 开始你的创作之旅

### 第二步：安装插件
```bash
npm install -g opencode-ai-novel-factory
```

### 第三步：验证安装
```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/verify-plugin-function.sh | bash
```

### 第四步：开始创作
在OpenCode中说：
```
使用 opencode-ai-novel-factory 的 novel-status 工具
```

---

**记住**：明确指定插件名称是避免AI选择错误项目的最有效方法！

使用 `使用 opencode-ai-novel-factory 的 novel-init 工具` 而不是 `请帮我初始化 AI Novel Factory 项目`