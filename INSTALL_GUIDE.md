# AI Novel Factory - 安装指南

## 方式一：OpenCode 内联安装（推荐）

在 OpenCode 中直接发送以下内容：

```
请执行以下命令安装 AI Novel Factory：

curl -fsSL https://raw.githubusercontent.com/你的用户名/ai-novel-factory/main/install-inline.sh | bash
```

或者直接粘贴 `install-inline.sh` 的内容让 OpenCode 执行。

---

## 方式二：从 GitHub 克隆

```
git clone https://github.com/你的用户名/ai-novel-factory.git studio
```

---

## 方式三：直接请求安装

在 OpenCode 对话中发送：

```
请帮我安装 AI Novel Factory 小说写作系统到 ./studio 目录，包含完整的 Agent 定义、记忆系统和模板文件。
```

---

## 安装后

1. 填写 `studio/story/world.md` - 世界观设定
2. 填写 `studio/story/master_outline.md` - 主线大纲
3. 填写 `studio/characters/protagonist.md` - 主角设定
4. 执行 `@daily_pipeline` 开始创作

---

## 发布到 GitHub

```bash
# 初始化仓库
git init
git add .
git commit -m "初始化 AI Novel Factory"
git branch -M main
git remote add origin https://github.com/你的用户名/ai-novel-factory.git
git push -u origin main
```

---

## 分享给他人

发送以下内容给其他用户：

```
AI Novel Factory 安装命令：

curl -fsSL https://raw.githubusercontent.com/你的用户名/ai-novel-factory/main/install-inline.sh | bash

安装后填写 story/world.md、story/master_outline.md、characters/protagonist.md
然后执行 @daily_pipeline 开始创作
```
