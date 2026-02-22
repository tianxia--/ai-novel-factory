# AI Novel Factory - 使用指南

这是一个完整的 AI 小说写作系统，可直接在 OpenCode 中使用。

## 安装方式

### 方式一：npm 插件（推荐）

```bash
npm install -g opencode-ai-novel-factory
```

然后在 `opencode.json` 中添加：

```json
{
  "plugin": ["opencode-ai-novel-factory"]
}
```

### 方式二：克隆仓库

```bash
git clone https://github.com/tianxia--/ai-novel-factory.git studio
```

### 方式三：一键安装脚本

```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-inline.sh | bash
```

## 快速开始

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
