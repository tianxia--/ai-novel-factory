#!/bin/bash
# AI Novel Factory 安装验证脚本

echo "🔍 AI Novel Factory 安装验证"
echo "=============================="
echo ""

# 检查 Node.js
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js 未安装"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

# 检查 npm
if command -v npm &> /dev/null; then
    echo "✅ npm: $(npm --version)"
else
    echo "❌ npm 未安装"
    exit 1
fi

# 检查插件安装
echo ""
echo "📦 检查插件安装..."
if npm list -g opencode-ai-novel-factory &> /dev/null; then
    echo "✅ 插件已全局安装: $(npm list -g opencode-ai-novel-factory | grep opencode-ai-novel-factory)"
else
    echo "❌ 插件未安装"
    echo "运行: npm install -g opencode-ai-novel-factory"
fi

# 检查 opencode.json 配置
echo ""
echo "⚙️ 检查 opencode.json 配置..."

# 查找配置文件
config_files=(
    "./opencode.json"
    "$HOME/.opencode/opencode.json"
)

config_found=false
for config_file in "${config_files[@]}"; do
    if [ -f "$config_file" ]; then
        echo "📁 找到配置文件: $config_file"
        if grep -q "opencode-ai-novel-factory" "$config_file"; then
            echo "✅ 插件已配置"
            config_found=true
        else
            echo "❌ 插件未在配置中"
        fi
        break
    fi
done

if [ "$config_found" = false ]; then
    echo "❌ 未找到 opencode.json 配置文件"
    echo "请让 AI 助手帮你配置：'请帮我配置 opencode.json 添加插件'"
fi

# 显示使用提示
echo ""
echo "📖 使用提示:"
echo "============"
echo ""
echo "如果安装和配置都正常，可以在 OpenCode 中使用："
echo ""
echo "🎯 初始化项目:"
echo "请帮我初始化小说工厂项目"
echo ""
echo "🌍 创建世界观:"
echo "请帮我创建小说世界观设定"
echo ""
echo "✍️ 开始写作:"
echo "请帮我开始写小说"
echo ""
echo "📚 查看帮助:"
echo "请帮我查看小说工厂的使用指南"
echo ""