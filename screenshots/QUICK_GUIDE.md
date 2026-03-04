# 🚀 如何发布截图到GitHub

## 📸 截图目录已创建

截图目录结构已创建完成：
```
screenshots/
├── README.md - 截图使用指南
├── 01-installation/ - 安装相关截图
├── 02-configuration/ - 配置相关截图
├── 03-verification/ - 验证相关截图
├── 04-project-status/ - 项目状态截图
├── 05-project-init/ - 项目初始化截图
├── 06-world-building/ - 世界观创建截图
├── 07-chapter-generation/ - 章节生成截图
├── 08-quality-check/ - 质量检查截图
├── 09-memory-update/ - 记忆更新截图
├── 10-daily-pipeline/ - 一键流水线截图
├── 11-multi-project/ - 多项目管理截图
└── 12-training/ - 训练工作流截图
```

## 📋 添加截图的步骤

### 步骤1：准备截图
1. 使用截图工具截取需要的图片
2. 按照命名规范重命名：`[编号]-[功能名称]-[描述].png`
3. 放置到对应的分类目录

### 步骤2：添加到Git
```bash
# 添加screenshots目录
git add screenshots/

# 查看要提交的文件
git status

# 提交更改
git commit -m "添加截图目录和相关图片"

# 推送到GitHub
git push origin main
```

### 步骤3：验证上传
1. 打开你的GitHub仓库：https://github.com/tianxia--/ai-novel-factory
2. 查看 `screenshots/` 目录
3. 确认图片都已上传

### 步骤4：在README中使用
在根目录README中添加截图：
```markdown
## 📸 截图展示

### 安装界面
![插件安装](https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/01-installation/01-install-success.png)

### 配置界面
![OpenCode配置](https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/02-configuration/02-opencode-config.png)

### 项目状态
![项目状态](https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/screenshots/04-project-status/04-status-display.png)
```

## 🎯 推荐的截图内容

### 重要截图
1. ✅ `01-installation/01-install-success.png` - 插件安装成功
2. ✅ `02-configuration/02-opencode-config.png` - OpenCode配置
3. ✅ `04-project-status/04-status-display.png` - 项目状态显示
4. ✅ `05-project-init/05-init-complete.png` - 项目初始化完成
5. ✅ `07-chapter-generation/07-chapter-result.png` - 章节生成结果

### 功能展示
1. 🌟 `06-world-building/06-world-creation.png` - 世界观创建界面
2. 🌟 `10-daily-pipeline/10-pipeline-process.png` - 一键流水线过程
3. 🌟 `11-multi-project/11-project-switch.png` - 项目切换界面

## 💡 截图建议

### 技术要求
- **格式**: PNG或JPG
- **分辨率**: 1920x1080 或更高
- **大小**: 单个文件不超过2MB
- **清晰度**: 文字和按钮清晰可见

### 内容要求
- **完整性**: 显示完整的界面
- **相关性**: 突出重点功能
- **美观性**: 整体美观大方
- **隐私**: 隐藏敏感信息

## 🔗 快速链接

- **GitHub仓库**: https://github.com/tianxia--/ai-novel-factory
- **截图目录**: https://github.com/tianxia--/ai-novel-factory/tree/main/screenshots
- **README更新指南**: https://docs.github.com/en/get-started/writing-on-github/managing-files-in-a-repository/editing-files

## 🎉 下一步

1. **添加截图**: 将你的截图放置到对应目录
2. **提交到Git**: 使用上面的命令提交
3. **更新README**: 在根目录README中添加截图链接
4. **验证效果**: 查看GitHub上的显示效果

---

**记住**: 好的截图能显著提升文档质量和用户体验！