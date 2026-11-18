# AI Novel Factory - 插件安装与项目切换说明

## 🎯 核心概念：插件 vs 项目

AI Novel Factory 分为两个独立的部分：

### 1. 📦 OpenCode 插件（全局安装）
- **安装方式**：`npm install -g opencode-ai-novel-factory`
- **安装位置**：全局系统目录
- **重复安装**：❌ 不需要，一次安装永久使用
- **配置方式**：在 `opencode.json` 中声明

### 2. 🏭 小说项目（每个项目独立）
- **初始化方式**：`请帮我初始化小说工厂项目`
- **项目位置**：任意工作目录
- **重复创建**：✅ 每个新的小说项目都需要初始化
- **包含内容**：studio目录结构、模板文件、设定文档

## 🔄 目录切换行为

### 场景1：同一电脑，不同目录

#### 情况A：切换到已有小说项目的目录
```bash
cd /path/to/novel-project-1  # 包含 studio/ 目录
```
- ✅ 插件自动可用（全局安装）
- ✅ 项目设定直接加载（studio/ 目录已存在）
- ✅ 可以直接开始写作：`@daily_pipeline`

#### 情况B：切换到新目录，开始新小说项目
```bash
cd /path/to/new-novel  # 空目录
```
- ✅ 插件自动可用（全局安装）
- ❌ 需要初始化新项目
- 🎯 执行：`请帮我初始化小说工厂项目`

### 场景2：换新电脑

#### 必须重新安装的内容：
1. ✅ **Node.js** - 重新安装 https://nodejs.org/
2. ✅ **OpenCode** - 重新安装 https://opencode.ai/
3. ✅ **npm插件** - `npm install -g opencode-ai-novel-factory`
4. ✅ **opencode.json** - 配置插件（可复制旧的配置文件）
5. ✅ **小说项目** - 复制studio目录或重新初始化

## ⚙️ 配置文件详解

### opencode.json 的两种配置方式

#### 方式1：全局配置（推荐）
```bash
~/.opencode/opencode.json  # 所有项目都能使用插件
```
```json
{
  "plugin": ["opencode-ai-novel-factory"]
}
```
✅ **优点**：配置一次，所有项目都能用
✅ **适用**：个人开发者，只有一个小说项目

#### 方式2：项目级配置
```bash
./opencode.json  # 仅当前项目能使用插件
```
```json
{
  "plugin": ["opencode-ai-novel-factory"]
}
```
✅ **优点**：不同项目可以使用不同插件组合
✅ **适用**：团队开发，或需要灵活配置

## 📋 实际使用流程

### 在已有项目中
```bash
cd /path/to/existing-novel  # 已有 studio/ 目录
```

在OpenCode中直接使用：
```
请帮我写下一章
```

### 开始新项目
```bash
cd /path/to/new-workspace  # 新的工作目录
```

在OpenCode中说：
```
请帮我初始化小说工厂项目
```

AI会自动：
1. 创建 studio/ 目录结构
2. 生成所有模板文件
3. 引导你填写世界观设定

### 换新电脑的完整流程
```bash
# 1. 安装环境
sudo apt install nodejs npm  # 或从官网下载

# 2. 安装插件
npm install -g opencode-ai-novel-factory

# 3. 配置 OpenCode
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash

# 4. 复制小说项目（可选）
git clone your-novel-repo  # 或重新初始化新项目

# 5. 开始使用
# 在OpenCode中直接说：请帮我写下一章
```

## 🎯 常见问题

### Q: 切换目录后还需要安装插件吗？
A: 不需要。npm插件是全局安装的，一次安装永久使用。

### Q: 切换到新目录后可以使用插件吗？
A: 可以，只要插件已全局安装且opencode.json已配置。

### Q: 每个新的小说项目都需要初始化吗？
A: 是的。每个小说项目需要自己的studio目录和设定文件。

### Q: 可以多个小说项目共用一个插件吗？
A: 可以。一个npm插件可以服务无限个小说项目。

### Q: 换电脑后需要重新购买吗？
A: 不需要。npm插件是开源免费的，任何人都可以安装使用。

### Q: 小说项目的数据存储在哪里？
A: 存储在studio/目录中，可以轻松备份和迁移。

## 🚀 最佳实践建议

### 个人开发者
1. 使用全局配置 `~/.opencode/opencode.json`
2. 每个小说项目独立创建 studio/ 目录
3. 使用Git备份小说项目

### 团队协作
1. 使用项目级配置 `./opencode.json`
2. 将studio/目录纳入版本控制
3. 团队成员各自安装插件，共享项目配置

### 多项目管理
1. 为每个小说项目创建独立目录
2. 使用有意义的目录命名，如：
   - `~/novels/玄幻-修仙之旅/`
   - `~/novels/都市-职场奋斗/`
   - `~/novels/科幻-星际探索/`
3. 使用 `请帮我查看项目状态` 了解进度

## 💡 快速切换命令

```bash
# 查看所有小说项目
cd ~/novels
ls -la

# 切换到项目1
cd ~/novels/玄幻-修仙之旅

# 在OpenCode中：@daily_pipeline

# 切换到项目2
cd ~/novels/都市-职场奋斗

# 在OpenCode中：@daily_pipeline
```