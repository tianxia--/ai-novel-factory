#!/bin/bash
# AI Novel Factory - 项目初始化脚本（仅初始化项目，不涉及npm install）

echo "🏭 AI Novel Factory - 项目初始化"
echo "================================"
echo ""

INSTALL_DIR="${1:-./studio}"

# 检查插件是否已安装
echo "🔍 检查环境..."
if npm list -g opencode-ai-novel-factory &> /dev/null; then
    echo "✅ 插件已全局安装"
elif npm list opencode-ai-novel-factory &> /dev/null; then
    echo "✅ 插件已本地安装"
else
    echo "⚠️  插件未安装"
    echo ""
    echo "📦 请先安装插件（只需一次）:"
    echo "npm install -g opencode-ai-novel-factory"
    echo ""
    read -p "是否现在安装？(y/n): " install_confirm
    if [[ $install_confirm =~ ^[Yy]$ ]]; then
        echo "正在安装插件..."
        npm install -g opencode-ai-novel-factory
        if [ $? -eq 0 ]; then
            echo "✅ 插件安装成功"
        else
            echo "❌ 插件安装失败，无法继续初始化项目"
            exit 1
        fi
    else
        echo "❌ 需要先安装插件才能初始化项目"
        exit 1
    fi
fi

echo ""
echo "📁 创建项目结构..."
mkdir -p "$INSTALL_DIR"/{agents,automation,memory,story,characters,style,production/chapters,state}

# 创建模板文件
echo "📋 生成模板文件..."

# 生成 README
cat > "$INSTALL_DIR/README.md" << 'README_EOF'
# AI Novel Factory

完整的 AI 小说写作系统。

## 快速开始

1. 填写基础设定
   - `story/world.md` - 世界观
   - `story/master_outline.md` - 大纲
   - `characters/protagonist.md` - 主角

2. 开始创作
   ```
   @daily_pipeline
   ```

## 可用命令

| 命令 | 功能 |
|------|------|
| `@daily_pipeline` | 一键生成下一章 |
| `@story_architect` | 创建世界观 |
| `@volume_planner` | 生成分卷大纲 |
| `@writer [章节]` | 写作章节 |
| `@editor [章节]` | 质量检查 |

## 💡 重要提示

- ✅ 插件已全局安装，无需再次执行 npm install
- ✅ 项目结构已创建，可以直接使用
- ✅ 只需填写设定文件即可开始创作
README_EOF

echo ""
echo "=========================================="
echo "   ✅ AI Novel Factory 项目初始化完成！"
echo "=========================================="
echo ""
echo "📁 项目目录: $INSTALL_DIR"
echo ""
echo "📖 下一步:"
echo "1. 填写 $INSTALL_DIR/story/world.md"
echo "2. 填写 $INSTALL_DIR/story/master_outline.md"
echo "3. 填写 $INSTALL_DIR/characters/protagonist.md"
echo "4. 执行 @daily_pipeline 开始创作"
echo ""
echo "💡 重要提示:"
echo "- ✅ 插件已全局安装，无需再次执行 npm install"
echo "- ✅ 项目结构已创建，可以直接使用"
echo "- ✅ 只需填写设定文件即可开始创作"
echo ""
echo "🎉 现在可以在 OpenCode 中使用了！"
echo "   对AI说：'请帮我创建小说的世界观设定'"
echo ""