#!/bin/bash
# 新用户完整安装测试脚本

echo "🧪 模拟新用户安装 AI Novel Factory"
echo "======================================"
echo ""

# 1. 检查环境
echo "1️⃣ 检查环境..."
if command -v node &> /dev/null; then
    echo "✅ Node.js 已安装: $(node --version)"
else
    echo "❌ Node.js 未安装"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "✅ npm 已安装: $(npm --version)"
else
    echo "❌ npm 未安装"
    exit 1
fi

# 2. 安装插件
echo ""
echo "2️⃣ 安装插件..."
npm install -g opencode-ai-novel-factory

# 3. 配置 opencode.json
echo ""
echo "3️⃣ 配置 opencode.json..."

# 创建 .opencode 目录
mkdir -p ~/.opencode

# 创建配置文件
cat > ~/.opencode/opencode.json << 'EOF'
{
  "plugin": ["opencode-ai-novel-factory"]
}
EOF

echo "✅ opencode.json 已创建: ~/.opencode/opencode.json"

# 4. 验证安装
echo ""
echo "4️⃣ 验证安装..."
if npm list -g opencode-ai-novel-factory &> /dev/null; then
    echo "✅ 插件已全局安装"
else
    echo "❌ 插件安装失败"
    exit 1
fi

if grep -q "opencode-ai-novel-factory" ~/.opencode/opencode.json; then
    echo "✅ 插件已配置到 opencode.json"
else
    echo "❌ 插件配置失败"
    exit 1
fi

# 5. 显示使用说明
echo ""
echo "5️⃣ 🎉 安装完成！使用说明："
echo "================================"
echo ""
echo "在 OpenCode 中使用以下命令："
echo ""
echo "📋 初始化项目："
echo "请帮我初始化小说工厂项目"
echo ""
echo "🎯 创建世界观："
echo "请帮我创建小说世界观设定"
echo ""
echo "✍️ 开始写作："
echo "请帮我开始写小说"
echo ""
echo "📖 更多帮助："
echo "请帮我查看小说工厂的使用指南"
echo ""

# 6. 可选：下载安装脚本到用户目录
echo "6️⃣ 下载安装脚本（可选）..."
if command -v curl &> /dev/null; then
    curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-inline.sh -o ~/novel-factory-install.sh
    curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh -o ~/novel-factory-setup.sh
    chmod +x ~/novel-factory-install.sh ~/novel-factory-setup.sh
    echo "✅ 安装脚本已下载到用户目录"
    echo "   - ~/novel-factory-install.sh"
    echo "   - ~/novel-factory-setup.sh"
fi

echo ""
echo "🚀 现在可以在 OpenCode 中开始使用了！"