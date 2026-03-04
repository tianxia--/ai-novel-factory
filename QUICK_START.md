# 🚀 快速开始指南

## 一句话总结

```bash
npm install -g opencode-ai-novel-factory
```

然后在OpenCode中说：`使用 opencode-ai-novel-factory 的 novel-status 工具`

## 详细步骤

### 步骤1：安装插件（一次搞定）

```bash
npm install -g opencode-ai-novel-factory
```

### 步骤2：配置OpenCode（可选但推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash
```

### 步骤3：验证安装

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/verify-plugin-function.sh | bash
```

看到✅就表示成功！

### 步骤4：开始使用

在OpenCode中说这些话：

```
# 查看项目状态（推荐）
使用 opencode-ai-novel-factory 的 novel-status 工具

# 创建新项目（推荐）
使用 opencode-ai-novel-factory 的 novel-init 工具初始化项目

# 继续写作（推荐）
使用 @daily_pipeline 一键生成章节

# 创建世界观
使用 opencode-ai-novel-factory 创建世界观设定
```

⚠️ **重要提示**：使用明确的插件名称避免AI选择其他项目

## 常用命令

| 功能 | 推荐命令 | 说明 |
|------|---------|------|
| 查看状态 | `使用 opencode-ai-novel-factory 的 novel-status 工具` | 明确指定插件 |
| 创建项目 | `使用 opencode-ai-novel-factory 的 novel-init 工具` | 强制使用官方插件 |
| 继续写作 | `@daily_pipeline` | 直接使用技能 |
| 创建世界观 | `使用 opencode-ai-novel-factory 创建世界观` | 明确插件名称 |
| 质量检查 | `使用 @editor 检查章节质量` | 使用Agent |

## 三个重要概念

### 1. 插件（全局安装一次）
```bash
npm install -g opencode-ai-novel-factory
```
**作用**：安装到系统，所有项目都能用
**频率**：一生一次

### 2. 项目（每个小说一个）
```bash
mkdir ~/novels/新小说
cd ~/novels/新小说
请帮我初始化 AI Novel Factory 项目
```
**作用**：为每个小说创建独立的创作环境
**频率**：每个小说一次

### 3. 写作（无限次）
```bash
请帮我写下一章
```
**作用**：使用AI生成章节内容
**频率**：无限次

## 场景示例

### 场景1：第一次使用
```bash
# 1. 安装插件
npm install -g opencode-ai-novel-factory

# 2. 创建第一个小说
mkdir ~/novels/我的第一部小说
cd ~/novels/我的第一部小说

# 3. 在OpenCode中说：
请帮我初始化 AI Novel Factory 项目
请帮我创建小说的世界观设定
请帮我开始写小说
```

### 场景2：写第二部小说
```bash
# 1. 创建第二个小说
mkdir ~/novels/我的第二部小说
cd ~/novels/我的第二部小说

# 2. 在OpenCode中说：
请帮我初始化 AI Novel Factory 项目
请帮我创建小说的世界观设定
请帮我开始写小说
```

### 场景3：继续之前的项目
```bash
# 1. 切换到已有项目
cd ~/novels/我的第一部小说

# 2. 在OpenCode中说：
请帮我写下一章
```

### 场景4：换新电脑
```bash
# 1. 重新安装插件
npm install -g opencode-ai-novel-factory

# 2. 配置OpenCode
curl -fsSL .../setup-opencode.sh | bash

# 3. 复制或重新创建小说项目
cp -r ~/旧电脑/novels ~/novels

# 4. 开始使用
cd ~/novels/我的第一部小说
请帮我写下一章
```

## 常见问题

### Q: 每次都要执行npm install吗？
A: 不用！一生只需要安装一次插件。

### Q: 每个小说都要重新安装插件吗？
A: 不用！插件是全局的，安装一次到处用。

### Q: 什么时候说"初始化项目"？
A: 只有创建新小说时说。继续写作时直接说"请帮我写下一章"。

### Q: 换电脑需要重新安装吗？
A: 需要，但只需要一次：`npm install -g opencode-ai-novel-factory`

### Q: AI不响应怎么办？
A: 1. 检查插件是否安装：`npm list -g opencode-ai-novel-factory`
   2. 重新配置OpenCode：运行setup-opencode.sh
   3. 重启OpenCode

## 记住这三个字

```
📦 装插件（一次）
🏭 建项目（每个小说）
✍️ 写小说（无限次）
```

## 🎉 现在开始吧！

```bash
npm install -g opencode-ai-novel-factory
```

然后在OpenCode中说：
```
请帮我查看AI Novel Factory项目状态
```

---

**就这么简单！** 🚀