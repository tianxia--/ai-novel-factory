# 重要说明：项目初始化 vs 插件安装

## ⚠️ 关键区别

### ❌ 错误理解
"每次初始化新项目都需要 npm install"

### ✅ 正确理解
- **插件安装**：一生一次，全局安装：`npm install -g opencode-ai-novel-factory`
- **项目初始化**：每个项目一次，只是创建目录结构，**不需要 npm install**

## 🎯 正确的初始化流程

### 第一步：安装插件（只需一次，全局）
```bash
npm install -g opencode-ai-novel-factory
```

**作用**：安装OpenCode插件到系统全局目录
**执行时机**：一生只需要执行一次
**执行次数**：1次

### 第二步：配置插件（只需一次）
```bash
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash
```

**作用**：配置opencode.json文件
**执行时机**：一生只需要执行一次
**执行次数**：1次

### 第三步：初始化项目（每个项目一次）
```bash
cd /path/to/new-project
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-inline.sh | bash
```

**作用**：创建studio目录和模板文件
**执行时机**：每个新的小说项目
**执行次数**：每个项目一次
**注意**：**不涉及 npm install！**

## 🤔 为什么会误解？

可能的原因：

### 原因1：AI助手的错误引导
某些AI可能会误认为需要本地安装依赖
```
❌ 错误引导："现在需要执行 npm install"
✅ 正确引导："项目初始化完成，可以直接开始创作"
```

### 原因2：与其他项目的混淆
有些项目确实需要npm install（如Node.js后端项目），但AI Novel Factory不需要

### 原因3：脚本输出不清晰
某些脚本可能输出了误导性信息

## 🛠️ 修复方案

### 1. 更新novel-init工具的输出
修改 `packages/opencode-ai-novel-factory/src/index.ts`:

```typescript
return `✅ AI Novel Factory 项目初始化完成！

📁 项目目录: ${targetDir}

📋 创建的目录结构:
${dirs.map(d => `  ├── ${d}`).join("\n")}

🎯 下一步:
1. 填写 studio/story/world.md - 世界观设定
2. 填写 studio/story/master_outline.md - 故事大纲
3. 填写 studio/characters/protagonist.md - 主角设定
4. 使用 @daily_pipeline 开始创作

💡 重要提示:
- ✅ 插件已全局安装，无需再次安装
- ✅ 项目结构已创建，可以直接使用
- ✅ 只需填写设定文件即可开始创作`
```

### 2. 更新README说明
在所有初始化相关的地方添加明确提示：

```markdown
## 项目初始化

⚠️ 重要：项目初始化不需要 npm install！

### 正确的初始化流程
1. 插件已全局安装（如果未安装，执行：npm install -g opencode-ai-novel-factory）
2. 运行项目初始化脚本
3. 填写设定文件
4. 开始创作

### 常见错误
❌ 错误：npm install（不需要）
✅ 正确：直接填写设定文件
```

### 3. 创建初始化检查脚本
```bash
#!/bin/bash
# 项目初始化检查脚本

echo "🔍 检查项目初始化环境..."

# 检查插件是否已全局安装
if npm list -g opencode-ai-novel-factory &> /dev/null; then
    echo "✅ 插件已全局安装"
else
    echo "❌ 插件未安装，需要执行：npm install -g opencode-ai-novel-factory"
    exit 1
fi

# 检查opencode.json是否已配置
if [ -f ~/.opencode/opencode.json ] && grep -q "opencode-ai-novel-factory" ~/.opencode/opencode.json; then
    echo "✅ 插件已配置"
else
    echo "⚠️  插件未配置，建议运行：curl -fsSL .../setup-opencode.sh | bash"
fi

echo ""
echo "🎯 现在可以初始化项目了，无需再次执行 npm install"
echo "运行：curl -fsSL .../install-inline.sh | bash"
```

## 📊 执行频率对比

| 操作 | 频率 | 命令 | 说明 |
|------|------|------|------|
| 安装插件 | 一生一次 | `npm install -g opencode-ai-novel-factory` | 全局安装 |
| 配置插件 | 一生一次 | 配置脚本 | 配置opencode.json |
| 初始化项目 | 每个项目一次 | 项目初始化脚本 | 创建目录结构 |
| **开始创作** | 无限次 | `@daily_pipeline` | **不涉及npm** |

## 🎯 记住这个简单规则

```
📦 插件 = 工具箱，买一次（npm install）到处用
🏭 项目 = 作业本，每个项目一本，初始化即可
```

## 💡 快速检查

如果你在初始化项目时被要求执行 `npm install`，可以：

1. 检查插件是否已全局安装：
   ```bash
   npm list -g opencode-ai-novel-factory
   ```

2. 如果已安装，直接跳过npm install，继续初始化

3. 如果未安装，执行一次全局安装：
   ```bash
   npm install -g opencode-ai-novel-factory
   ```

4. 之后的所有项目都不再需要npm install

## 🔧 修复现有问题

让我们更新相关脚本和文档，确保不会误导用户...