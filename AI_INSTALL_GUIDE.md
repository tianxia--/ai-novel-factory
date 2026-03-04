# AI 安装引导脚本

## 🤖 对 AI 助手说的话

### 完整安装引导
```
请帮我安装和配置 AI Novel Factory 插件，从安装到配置完成
```

### 仅配置插件
```
请帮我配置 opencode.json 添加 opencode-ai-novel-factory 插件
```

### 项目初始化
```
请帮我初始化 AI 小说工厂项目
```

### 创建世界观
```
请帮我创建小说的世界观设定
```

### 开始写作
```
请帮我开始写小说，使用 @daily_pipeline
```

## 📋 AI 引导流程

### 第一步：安装确认
AI 应该检查用户环境：
1. 检查 Node.js 和 npm 是否安装
2. 检查插件是否已安装
3. 提供安装选项

### 第二步：插件配置
AI 应该自动配置：
1. 查找或创建 opencode.json 文件
2. 添加插件配置
3. 验证配置成功

### 第三步：项目初始化
AI 应该引导用户：
1. 创建项目目录结构
2. 生成模板文件
3. 说明填写顺序

### 第四步：核心设定
AI 应该逐步引导：
1. 创建世界观设定
2. 制定故事大纲
3. 设计主角角色

### 第五步：开始创作
AI 应该启动流程：
1. 解释 @daily_pipeline 用法
2. 执行第一次章节生成
3. 说明后续维护

## 🔧 AI 执行脚本

### 安装脚本
```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-inline.sh | bash
```

### 配置脚本
```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash
```

### 验证命令
```bash
npm list -g opencode-ai-novel-factory
cat ~/.opencode/opencode.json | grep opencode-ai-novel-factory
```

## 💡 AI 响应模板

### 安装引导响应
```
我来帮你安装和配置 AI Novel Factory！

📋 安装步骤：
1. 检查环境...
2. 安装插件...
3. 配置 opencode.json...
4. 初始化项目...
5. 创建核心设定...

让我开始检查你的环境...
```

### 配置引导响应
```
我来帮你配置 opencode.json！

🔍 正在查找配置文件...
📝 正在添加插件配置...
✅ 配置完成！

你现在可以使用这些命令：
- @daily_pipeline - 一键生成章节
- @story_architect - 创建世界观
- @writer [章节] - 写作章节
```

### 初始化引导响应
```
我来帮你初始化小说工厂项目！

📁 创建项目结构...
📋 生成模板文件...
📖 说明填写步骤...

接下来你需要填写：
1. 世界观设定
2. 故事大纲  
3. 主角设定

要开始创建世界观吗？
```