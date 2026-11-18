# AI Novel Factory - 快速FAQ

## 🤔 最常见问题

### Q1: 切换目录后需要重新安装插件吗？
**A: 不需要！**

- ✅ npm插件是全局安装的，一次安装永久使用
- ✅ 只需在第一次使用时安装：`npm install -g opencode-ai-novel-factory`
- ✅ 之后切换任何目录都能自动使用

### Q2: 每个新小说项目都需要做什么？
**A: 只需初始化项目一次**

- ✅ 对AI说：`请帮我初始化小说工厂项目`
- ✅ AI会自动创建studio目录和所有模板文件
- ✅ 然后就可以开始写作了

### Q3: 可以同时写多个小说吗？
**A: 可以！**

```
~/novels/
├── 玄幻-修仙之旅/  ← 项目1
├── 都市-职场奋斗/  ← 项目2
└── 科幻-星际探索/  ← 项目3
```

- ✅ 每个项目独立，互不干扰
- ✅ 一个插件服务所有项目
- ✅ 切换项目就像切换文件夹

### Q4: 换新电脑需要做什么？
**A: 只需3步**

```bash
# 步骤1：安装环境
npm install -g opencode-ai-novel-factory

# 步骤2：配置OpenCode
curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash

# 步骤3：复制小说项目
# 从旧电脑复制 studio/ 目录到新电脑
```

### Q5: 插件收费吗？
**A: 完全免费！**

- ✅ 开源项目，MIT许可证
- ✅ 任何人都可以免费使用
- ✅ GitHub: https://github.com/tianxia--/ai-novel-factory

## 🎯 一句话总结

### 安装（只需一次）
```
npm install -g opencode-ai-novel-factory
```

### 配置（只需一次）
```
请帮我配置 opencode.json 添加插件
```

### 新项目（每个项目一次）
```
请帮我初始化小说工厂项目
```

### 开始写作（无限次）
```
请帮我写下一章
```

## 📊 使用频率对照表

| 操作 | 频率 | 执行命令 |
|------|------|----------|
| 安装插件 | 一生一次 | `npm install -g opencode-ai-novel-factory` |
| 配置OpenCode | 一生一次 | 运行配置脚本 |
| 初始化项目 | 每个项目一次 | `请帮我初始化小说工厂项目` |
| 写作 | 无限次 | `请帮我写下一章` |

## 💡 关键概念

### 插件 vs 项目
- **插件**：像工具箱，买一次可以用到所有项目
- **项目**：像作业本，每个作业需要一个本子

### 全局 vs 项目级配置
- **全局配置**：一次配置，所有项目受益（推荐）
- **项目级配置**：每个项目单独配置（团队协作）

## 🚀 实际工作流示例

### 早上9点：开始写玄幻小说
```bash
cd ~/novels/玄幻-修仙之旅
# 在OpenCode中：请帮我写下一章
```

### 下午3点：切换到都市小说
```bash
cd ~/novels/都市-职场奋斗
# 在OpenCode中：请帮我写下一章
```

### 晚上8点：换到新电脑
```bash
# 1. 安装插件（首次）
npm install -g opencode-ai-novel-factory

# 2. 配置（首次）
curl -fsSL .../setup-opencode.sh | bash

# 3. 复制项目
cp -r ~/old-computer/novels ~/novels

# 4. 继续写作
cd ~/novels/玄幻-修仙之旅
# 在OpenCode中：请帮我写下一章
```

## 🔗 相关文档

- [详细安装指南](PLUGIN_INSTALLATION_GUIDE.md)
- [AI引导安装说明](AI_GUIDED_INSTALL.md)
- [完整使用手册](README.md)

## ❓ 还有问题？

1. 检查安装状态：运行验证脚本
2. 查看详细文档：参考上面链接
3. 提交问题：GitHub Issues

---

**记住**：插件只需安装一次，项目需要分别初始化！
就像买了工具箱后，每个新项目都能直接用工具。