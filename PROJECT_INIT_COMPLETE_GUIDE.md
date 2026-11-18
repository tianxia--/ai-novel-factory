# 🎯 项目初始化 - 完整指南

## ⚠️ 最重要的一点

**项目初始化不需要 npm install！**

### ❌ 错误理解
"初始化新项目时需要执行 npm install"

### ✅ 正确理解
"项目初始化只是创建目录结构，插件早已全局安装"

---

## 📋 正确的初始化流程

### 步骤0：一次性环境准备（只需一次）

#### 0.1 安装 Node.js（如果未安装）
```bash
# 从 https://nodejs.org/ 下载安装
```

#### 0.2 安装 OpenCode（如果未安装）
```bash
# 从 https://opencode.ai/ 下载安装
```

#### 0.3 安装插件（一生只需一次）
```bash
npm install -g opencode-ai-novel-factory
```

**作用**：全局安装插件到系统
**执行时机**：一生只需执行一次
**执行次数**：1次
**检查是否已安装**：`npm list -g opencode-ai-novel-factory`

#### 0.4 配置插件（一生只需一次）
```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash
```

**作用**：配置 opencode.json 文件
**执行时机**：一生只需执行一次
**执行次数**：1次

---

### 步骤1：初始化第一个小说项目

```bash
# 创建项目目录
mkdir ~/novels/玄幻-修仙之旅
cd ~/novels/玄幻-修仙之旅

# 初始化项目（方式1：使用脚本）
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/project-init.sh | bash

# 或（方式2：在OpenCode中说）
# 请帮我初始化小说工厂项目

# 或（方式3：使用工具）
# 使用 novel-init 工具初始化项目
```

**作用**：创建 studio 目录和模板文件
**执行时机**：每个新的小说项目
**执行次数**：每个项目一次
**注意**：**不涉及 npm install！**

---

### 步骤2：创建第一个小说的设定

```bash
# 在OpenCode中说
请帮我创建小说的世界观设定
```

AI 会引导你填写：
1. 故事类型（玄幻/都市/科幻等）
2. 世界观规则
3. 力量体系
4. 核心冲突

---

### 步骤3：开始创作

```bash
# 在OpenCode中说
请帮我写第一章
```

---

## 🔄 初始化第二个小说项目

```bash
# 创建第二个项目目录
mkdir ~/novels/都市-职场奋斗
cd ~/novels/都市-职场奋斗

# 初始化项目（无需再次安装插件！）
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/project-init.sh | bash

# 创建设定
在OpenCode中说：请帮我创建小说的世界观设定

# 开始创作
在OpenCode中说：请帮我写第一章
```

**关键点**：无需再次安装插件，直接初始化新项目即可！

---

## 🚀 换新电脑的完整流程

```bash
# 1. 安装 Node.js
从 https://nodejs.org/ 下载安装

# 2. 安装 OpenCode
从 https://opencode.ai/ 下载安装

# 3. 安装插件（在新电脑上只需一次）
npm install -g opencode-ai-novel-factory

# 4. 配置插件（在新电脑上只需一次）
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash

# 5. 复制小说项目
# 从旧电脑复制 ~/novels/ 目录到新电脑

# 6. 开始使用
cd ~/novels/玄幻-修仙之旅
在OpenCode中说：请帮我写下一章
```

---

## 📊 执行频率对照表

| 操作 | 频率 | 命令 | 说明 |
|------|------|------|------|
| 安装 Node.js | 一台电脑一次 | 从官网下载 | 系统依赖 |
| 安装 OpenCode | 一台电脑一次 | 从官网下载 | 开发环境 |
| **安装插件** | **一生一次** | **npm install -g opencode-ai-novel-factory** | **全局安装** |
| **配置插件** | **一生一次** | **配置脚本** | **配置opencode.json** |
| **初始化项目** | **每个项目一次** | **项目初始化脚本** | **创建目录结构** |
| **创建世界观** | **每个小说一次** | **在OpenCode中说** | **填写设定文件** |
| **写作** | **无限次** | **@daily_pipeline** | **日常创作** |

---

## 🎯 核心理解

### 类比说明

```
📦 npm插件 = 工具箱
- 买一次工具箱，所有作业都能用
- 安装一次，永久使用

🏭 项目初始化 = 准备作业本
- 每门作业需要一本新本子
- 每个项目需要初始化一次

📝 小说设定 = 写作业内容
- 在作业本上写作业内容
- 在studio目录中填写设定
```

### 实际操作

```
买工具箱（安装插件）→ 一次搞定！
准备第一本作业本（初始化项目1）→ 开始写作业1
准备第二本作业本（初始化项目2）→ 开始写作业2
...
准备第三本作业本（初始化项目3）→ 开始写作业3
换新房子（换新电脑）→ 重新买工具箱（安装插件），其他作业本直接搬过来
```

---

## ⚠️ 常见错误和纠正

### 错误1：每次初始化都执行 npm install

```
❌ 错误：
每次初始化项目时：
npm install -g opencode-ai-novel-factory  # 不需要！
初始化项目...

✅ 正确：
第一次：npm install -g opencode-ai-novel-factory
之后所有项目：直接初始化项目
```

### 错误2：认为项目初始化会自动安装插件

```
❌ 错误理解：
运行项目初始化脚本 = 安装插件 + 初始化项目

✅ 正确理解：
项目初始化脚本 = 只创建目录和模板
安装插件 = 独立的操作，需要单独执行
```

### 错误3：换电脑后忘记安装插件

```
❌ 错误：
复制小说项目 → 直接使用 → 提示找不到插件

✅ 正确：
换电脑 → 安装插件 → 复制小说项目 → 开始使用
```

---

## 🔍 快速检查清单

### 初始化新项目前检查

```bash
# 1. 检查插件是否已安装
npm list -g opencode-ai-novel-factory

# 如果显示版本号（如 opencode-ai-novel-factory@1.1.0）
# → ✅ 插件已安装，可以直接初始化项目

# 如果显示 empty 或 not found
# → ❌ 插件未安装，需要先执行：npm install -g opencode-ai-novel-factory
```

### 初始化项目后检查

```bash
# 1. 检查目录结构
ls studio/
# 应该看到：agents, automation, memory, story, characters, style, production, state

# 2. 检查模板文件
ls studio/story/
# 应该有：world.md, master_outline.md

# 3. 检查状态文件
cat studio/state/current_chapter.txt
# 应该显示：1
```

---

## 🎯 一句话总结

### 插件安装
```
一生只需一次：npm install -g opencode-ai-novel-factory
```

### 项目初始化
```
每个项目一次：项目初始化脚本（不涉及npm）
```

### 开始创作
```
无限次使用：@daily_pipeline
```

---

## 💡 记住这个

```
📦 插件买一次，到处用
🏭 项目建一个，写一本
✍️ 创作无限次，爽翻天
```

**最重要的一点：项目初始化不需要 npm install！**