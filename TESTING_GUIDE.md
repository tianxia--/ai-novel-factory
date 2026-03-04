# 🎯 AI Novel Factory v1.2.0 - 测试和验证指南

## 📋 版本更新说明

### v1.2.0 新功能
1. **智能项目检测** - novel-init工具现在会自动识别现有项目
2. **增强的状态检查** - novel-status工具提供更详细的项目信息
3. **改进的关键词** - 添加更多相关关键词便于AI识别
4. **优化的描述信息** - 工具描述更清晰，便于AI理解
5. **中文关键词支持** - 添加"小说工厂"、"小说创作"等中文关键词

## 🚀 在新电脑上的安装和测试流程

### 步骤1：环境准备

```bash
# 1. 检查Node.js和npm
node --version
npm --version

# 2. 如果未安装，从 https://nodejs.org/ 下载安装

# 3. 检查OpenCode是否已安装
# 从 https://opencode.ai/ 下载安装
```

### 步骤2：安装插件

```bash
# 安装最新版本
npm install -g opencode-ai-novel-factory@1.2.0

# 验证安装
npm list -g opencode-ai-novel-factory
```

### 步骤3：配置OpenCode

```bash
# 运行配置脚本
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash

# 或者手动配置
# 创建 ~/.opencode/opencode.json 文件，内容：
# {
#   "plugin": ["opencode-ai-novel-factory"]
# }
```

### 步骤4：验证安装

```bash
# 下载并运行验证脚本
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/verify-plugin-function.sh | bash

# 预期输出：
# ✅ 插件已全局安装
# ✅ 插件已在配置中
# ✅ 找到 studio/ 目录
# ✅ 核心文件存在
# ✅ 插件元数据正常
```

### 步骤5：在OpenCode中测试

#### 测试1：项目状态检查

在OpenCode中输入：
```
请帮我查看AI Novel Factory项目状态
```

**预期结果**：
- AI识别到novel-status工具
- 显示详细的项目状态信息
- 包含当前章节、文件状态、下一步建议

#### 测试2：现有项目识别

在有studio目录的文件夹中，输入：
```
请帮我初始化 AI Novel Factory 项目
```

**预期结果**：
- AI识别到现有项目
- 显示项目状态而不是创建新项目
- 提供继续创作的选项

#### 测试3：新项目创建

在空目录中，输入：
```
请帮我初始化 AI Novel Factory 项目
```

**预期结果**：
- AI识别novel-init工具
- 创建完整的studio目录结构
- 生成所有必要的模板文件

#### 测试4：章节生成

在有项目的目录中，输入：
```
请帮我写下一章
```

**预期结果**：
- AI识别到创作意图
- 使用正确的工具和工作流
- 生成新的章节内容

## 🔍 功能验证清单

### 基础功能
- [ ] 插件正确安装到全局目录
- [ ] opencode.json正确配置插件
- [ ] OpenCode能识别插件
- [ ] AI能响应插件相关的引导语

### 项目管理
- [ ] novel-init工具能识别现有项目
- [ ] novel-init工具能创建新项目
- [ ] novel-status工具能显示项目状态
- [ ] 核心文件状态检查正常

### 创作功能
- [ ] @daily_pipeline能正常工作
- [ ] @story_architect能创建世界观
- [ ] @writer能写作章节
- [ ] @editor能进行质量检查

### 智能识别
- [ ] AI能区分"创建项目"和"继续创作"
- [ ] AI能根据目录状态选择正确的工具
- [ ] AI能提供合适的下一步建议

## 🎯 常见问题解决

### 问题1：AI不响应插件引导语

**症状**：输入引导语后，AI没有调用插件工具

**解决方案**：
1. 检查插件是否正确安装：`npm list -g opencode-ai-novel-factory`
2. 检查opencode.json配置：`cat ~/.opencode/opencode.json`
3. 重启OpenCode
4. 尝试更精确的引导语：
   ```
   使用novel-init工具初始化项目
   使用novel-status工具查看项目状态
   ```

### 问题2：AI总是创建新项目

**症状**：在有项目的目录中输入引导语，AI还是创建新项目

**解决方案**：
1. 确认使用的是v1.2.0版本：`npm list -g opencode-ai-novel-factory`
2. 更新到最新版本：`npm install -g opencode-ai-novel-factory@latest`
3. 检查studio目录结构是否完整
4. 尝试使用更明确的引导语：
   ```
   请帮我查看项目状态
   请帮我继续创作
   ```

### 问题3：插件安装后不生效

**症状**：安装完成后，AI仍然无法识别插件

**解决方案**：
1. 重新配置OpenCode：运行setup-opencode.sh
2. 重启OpenCode
3. 检查npm权限：`npm whoami`
4. 尝试本地安装：`npm install opencode-ai-novel-factory`

### 问题4：验证脚本报错

**症状**：运行verify-plugin-function.sh时出现错误

**解决方案**：
1. 确保脚本有执行权限：`chmod +x verify-plugin-function.sh`
2. 检查bash环境：`which bash`
3. 逐个检查验证步骤
4. 查看详细错误信息

## 📊 测试结果记录

### 环境信息
- 操作系统: ___________
- Node.js版本: ___________
- npm版本: ___________
- OpenCode版本: ___________
- 插件版本: ___________

### 测试结果
1. 插件安装: ✅ / ❌
2. OpenCode配置: ✅ / ❌
3. 项目识别: ✅ / ❌
4. 状态检查: ✅ / ❌
5. 章节生成: ✅ / ❌

### 问题和解决方案
记录遇到的问题和解决方案：

---

## 🚀 成功标志

当以下所有项目都为✅时，表示安装和配置成功：

- [x] 插件已全局安装
- [x] 插件已在opencode.json中配置
- [x] 验证脚本显示"总体评估：✅ 插件配置完整"
- [x] OpenCode能识别插件引导语
- [x] novel-status工具能正常工作
- [x] novel-init工具能识别现有项目
- [x] AI能根据项目状态提供正确的响应

## 📞 获取帮助

如果遇到问题：
1. 查看FAQ.md文档
2. 运行验证脚本诊断
3. 检查GitHub Issues: https://github.com/tianxia--/ai-novel-factory/issues
4. 联系技术支持：pengfei.chen <yongbatian@gmail.com>

---

**记住**：v1.2.0的主要改进是智能项目识别，现在AI应该能够正确区分新项目和现有项目！