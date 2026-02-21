# AI Novel Factory - 使用指南

这是一个完整的 AI 小说写作系统，可直接在 OpenCode 中使用。

## 安装方式

在 OpenCode 中发送以下指令：

```
请从 GitHub 安装 AI Novel Factory：
https://github.com/你的用户名/ai-novel-factory

将文件下载到 ./studio 目录
```

或使用命令：
```bash
git clone https://github.com/你的用户名/ai-novel-factory.git studio
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
| `@consistency_check` | 一致性检查 |
