#!/bin/bash

# OpenCode AI Novel Factory 安装脚本
# 使用方法: bash install.sh

echo "=========================================="
echo "   OpenCode AI Novel Factory 安装程序"
echo "=========================================="
echo ""

# 检查目录结构
if [ -d "studio" ]; then
    echo "✅ 检测到 studio 目录"
else
    echo "❌ 未找到 studio 目录，请确保在正确的目录下运行"
    exit 1
fi

# 检查必要文件
required_files=(
    "studio/README.md"
    "studio/agents/story_architect.md"
    "studio/agents/writer.md"
    "studio/memory/canon.md"
    "studio/story/world.md"
)

echo "检查必要文件..."
all_found=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (缺失)"
        all_found=false
    fi
done

if [ "$all_found" = false ]; then
    echo ""
    echo "❌ 部分文件缺失，请重新下载完整包"
    exit 1
fi

echo ""
echo "=========================================="
echo "   安装完成！"
echo "=========================================="
echo ""
echo "📖 使用指南:"
echo ""
echo "1. 初始化创作（首次使用）:"
echo "   - 填写 studio/story/world.md（世界观）"
echo "   - 填写 studio/story/master_outline.md（大纲）"
echo "   - 填写 studio/characters/protagonist.md（主角）"
echo "   - 配置 studio/style/ 目录（文风）"
echo ""
echo "2. 日常创作:"
echo "   @daily_pipeline"
echo ""
echo "3. 查看帮助:"
echo "   阅读 studio/README.md"
echo ""
