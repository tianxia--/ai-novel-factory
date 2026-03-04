# AI Novel Factory - 使用指南

这是一个完整的 AI 小说写作系统，可直接在 OpenCode 中使用。

## 安装方式

### 🤖 AI 引导式完整安装（强烈推荐）

在 OpenCode 中说一句话：
```
请帮我安装和配置完整的 AI Novel Factory
```

AI 将引导完成：
1. ✅ 环境检查（Node.js/npm）
2. ✅ 插件安装（npm）
3. ✅ OpenCode 配置（opencode.json）
4. ✅ 项目初始化（可选）
5. ✅ 世界观创建（可选）

### 🚀 完整安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/ai-guided-complete-install.sh | bash
```

### 📦 标准 npm 安装

```bash
npm install -g opencode-ai-novel-factory
```

然后让 AI 助手自动配置：
```
请帮我配置 opencode.json 添加 opencode-ai-novel-factory 插件
```

### 🔧 单独配置脚本

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash
```

### 📁 克隆仓库

```bash
git clone https://github.com/tianxia--/ai-novel-factory.git studio
```

## 快速开始

### 🎯 AI 引导流程（推荐）

1. **安装配置**：`请帮我安装和配置 AI Novel Factory`
2. **项目初始化**：`请帮我初始化小说工厂项目`
3. **创建设定**：`请帮我创建小说世界观设定`
4. **开始写作**：`请帮我开始写小说`

### 📝 手动操作

安装完成后，按顺序填写：

1. **世界观** - `studio/story/world.md`
2. **主线大纲** - `studio/story/master_outline.md`
3. **主角设定** - `studio/characters/protagonist.md`

然后开始创作：
```
@daily_pipeline
```

## 可用命令

| 命令 | 功能 |
|------|------|
| `@daily_pipeline` | 一键生成下一章 |
| `@story_architect` | 创建世界观 |
| `@volume_planner` | 生成分卷大纲 |
| `@writer [章节]` | 写作指定章节 |
| `@editor [章节]` | 质量检查 |
| `@memory_keeper` | 更新记忆系统 |

## 可用工具

| 工具 | 功能 |
|------|------|
| `novel-init` | 初始化项目结构 |
| `novel-chapter` | 生成新章节 |
| `novel-status` | 查看项目状态 |

## 🤖 AI 常用引导语

### 安装配置
- `请帮我安装和配置 AI Novel Factory`
- `请帮我配置 opencode.json 添加插件`

### 项目管理
- `请帮我初始化小说工厂项目`
- `请帮我检查项目状态`
- `请帮我查看当前写到第几章了`

### 创作流程
- `请帮我创建小说世界观设定`
- `请帮我制定故事大纲`
- `请帮我设计主角角色`
- `请帮我开始写小说`

### 章节操作
- `请帮我写下一章`
- `请帮我检查第X章的质量`
- `请帮我修改第X章的文风`
- `请帮我更新记忆系统`
