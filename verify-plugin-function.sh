#!/bin/bash
# AI Novel Factory - 插件功能验证脚本

echo "🧪 AI Novel Factory 插件功能验证"
echo "===================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查1：插件安装状态
echo "📦 检查1：插件安装状态"
if npm list -g opencode-ai-novel-factory &> /dev/null; then
    VERSION=$(npm list -g opencode-ai-novel-factory | grep opencode-ai-novel-factory)
    echo -e "${GREEN}✅${NC} 插件已全局安装"
    echo "   $VERSION"
else
    echo -e "${RED}❌${NC} 插件未安装"
    echo "   请执行: npm install -g opencode-ai-novel-factory"
    exit 1
fi
echo ""

# 检查2：opencode.json配置
echo "⚙️  检查2：OpenCode配置检查"
OPENCODE_CONFIG_FOUND=false
CONFIG_PATH=""

if [ -f "./opencode.json" ]; then
    CONFIG_PATH="./opencode.json"
    OPENCODE_CONFIG_FOUND=true
elif [ -f "$HOME/.opencode/opencode.json" ]; then
    CONFIG_PATH="$HOME/.opencode/opencode.json"
    OPENCODE_CONFIG_FOUND=true
fi

if [ "$OPENCODE_CONFIG_FOUND" = true ]; then
    echo -e "${GREEN}✅${NC} 找到配置文件: $CONFIG_PATH"
    if grep -q "opencode-ai-novel-factory" "$CONFIG_PATH"; then
        echo -e "${GREEN}✅${NC} 插件已在配置中"
    else
        echo -e "${YELLOW}⚠️${NC} 插件未在配置中，需要添加"
        echo "   请运行: curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash"
    fi
else
    echo -e "${YELLOW}⚠️${NC} 未找到 opencode.json 配置文件"
    echo "   请运行: curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/setup-opencode.sh | bash"
fi
echo ""

# 检查3：项目结构
echo "🏭 检查3：AI Novel Factory项目结构检查"
STUDIO_FOUND=false
if [ -d "./studio" ]; then
    STUDIO_FOUND=true
    echo -e "${GREEN}✅${NC} 找到 studio/ 目录"

    # 检查核心文件
    REQUIRED_FILES=(
        "studio/state/current_chapter.txt"
        "studio/story/world.md"
        "studio/characters/protagonist.md"
    )

    FILES_EXIST=true
    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo -e "${GREEN}✅${NC} $file 存在"
        else
            echo -e "${RED}❌${NC} $file 不存在"
            FILES_EXIST=false
        fi
    done

    if [ "$FILES_EXIST" = true ]; then
        echo ""
        CURRENT_CHAPTER=$(cat studio/state/current_chapter.txt)
        echo "📊 项目状态:"
        echo "   当前章节: 第${CURRENT_CHAPTER}章"
        echo "   项目完整: 是"
    fi
else
    echo -e "${YELLOW}⚠️${NC} 未找到 studio/ 目录"
    echo "   当前目录: $(pwd)"
    echo "   如果是第一次使用，请说: 请帮我初始化 AI Novel Factory 项目"
fi
echo ""

# 检查4：插件版本和关键词
echo "🔍 检查4：插件元数据检查"
if command -v npm &> /dev/null; then
    if npm view opencode-ai-novel-factory keywords &> /dev/null; then
        echo -e "${GREEN}✅${NC} 插件元数据正常"
        KEYWORDS=$(npm view opencode-ai-novel-factory keywords)
        echo "   关键词: $KEYWORDS"
    else
        echo -e "${YELLOW}⚠️${NC} 无法获取插件元数据"
    fi
else
    echo -e "${YELLOW}⚠️${NC} npm 命令不可用"
fi
echo ""

# 测试建议
echo "🎯 测试建议"
echo "==========="
echo ""
echo "在OpenCode中尝试以下命令："
echo ""
echo "1. 测试项目识别："
echo "   请帮我查看AI Novel Factory项目状态"
echo ""
echo "2. 如果没有项目，创建新项目："
echo "   请帮我初始化 AI Novel Factory 项目"
echo ""
echo "3. 如果已有项目，继续创作："
echo "   请帮我写下一章"
echo ""

# 总体评估
echo "📊 总体评估"
echo "==========="
echo ""

ALL_CHECKS_PASSED=true

if [ "$OPENCODE_CONFIG_FOUND" = false ]; then
    ALL_CHECKS_PASSED=false
fi

if ! grep -q "opencode-ai-novel-factory" "$CONFIG_PATH" 2>/dev/null; then
    ALL_CHECKS_PASSED=false
fi

if [ "$ALL_CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}✅${NC} 插件配置完整，可以正常使用"
    echo ""
    echo "🎉 AI Novel Factory 已就绪！"
    echo ""
    echo "现在可以在OpenCode中使用以下功能："
    echo "   @daily_pipeline - 一键生成章节"
    echo "   @story_architect - 创建世界观"
    echo "   @writer - 写作指定章节"
    echo "   @editor - 质量检查"
    echo ""
else
    echo -e "${YELLOW}⚠️${NC} 部分检查未通过，请按照上述提示修复"
    echo ""
    echo "🔧 修复建议："
    echo "   1. 确保插件已安装: npm install -g opencode-ai-novel-factory"
    echo "   2. 配置OpenCode: 运行 setup-opencode.sh 脚本"
    echo "   3. 验证配置: 重新运行此验证脚本"
    echo ""
fi