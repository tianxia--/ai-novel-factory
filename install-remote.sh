#!/bin/bash
# OpenCode AI Novel Factory - 远程安装脚本
# 使用方法: curl -fsSL https://raw.githubusercontent.com/你的用户名/ai-novel-factory/main/install.sh | bash
# 或者: bash <(curl -fsSL https://raw.githubusercontent.com/你的用户名/ai-novel-factory/main/install.sh)

set -e

INSTALL_DIR="${1:-./studio}"
REPO_URL="https://raw.githubusercontent.com/你的用户名/ai-novel-factory/main"

echo "=========================================="
echo "   OpenCode AI Novel Factory 安装程序"
echo "=========================================="
echo ""
echo "安装目录: $INSTALL_DIR"
echo ""

# 创建目录结构
echo "📁 创建目录结构..."
mkdir -p "$INSTALL_DIR"/{agents,automation,memory,story,characters,style,production/chapters,state}

# 下载文件的函数
download_file() {
    local path=$1
    local url="$REPO_URL/$path"
    echo "  ⬇️  $path"
    curl -fsSL "$url" -o "$INSTALL_DIR/$path" 2>/dev/null || {
        echo "  ❌ 下载失败: $path"
        return 1
    }
}

# 下载所有文件
echo ""
echo "📥 下载核心文件..."

# Agent 文件
download_file "agents/story_architect.md"
download_file "agents/volume_planner.md"
download_file "agents/chapter_planner.md"
download_file "agents/writer.md"
download_file "agents/editor.md"
download_file "agents/memory_keeper.md"
download_file "agents/style_controller.md"

# 自动化文件
download_file "automation/generate_next_chapter.md"
download_file "automation/memory_update.md"
download_file "automation/consistency_check.md"
download_file "automation/daily_pipeline.md"

# 记忆系统
download_file "memory/canon.md"
download_file "memory/world_rules.md"
download_file "memory/characters_evolution.md"
download_file "memory/foreshadowing.md"

# 故事模板
download_file "story/world.md"
download_file "story/master_outline.md"

# 角色模板
download_file "characters/protagonist.md"
download_file "characters/character_template.md"

# 文风控制
download_file "style/tone.md"
download_file "style/rhythm.md"
download_file "style/dialogue.md"

# 章节模板
download_file "production/chapters/chapter_template.md"

# 状态文件
echo "1" > "$INSTALL_DIR/state/current_chapter.txt"
cat > "$INSTALL_DIR/state/pipeline_config.txt" << 'EOF'
target_word_count=2500
auto_skip_check=false
auto_memory_update=true
max_continuous_chapters=5
quality_threshold=7
style_check=true
consistency_check=true
EOF

# README
download_file "README.md"

echo ""
echo "=========================================="
echo "   ✅ 安装完成！"
echo "=========================================="
echo ""
echo "📖 快速开始:"
echo ""
echo "1. 进入目录并填写基础设定:"
echo "   - $INSTALL_DIR/story/world.md（世界观）"
echo "   - $INSTALL_DIR/story/master_outline.md（大纲）"
echo "   - $INSTALL_DIR/characters/protagonist.md（主角）"
echo ""
echo "2. 配置文风（可选）:"
echo "   - $INSTALL_DIR/style/tone.md"
echo "   - $INSTALL_DIR/style/rhythm.md"
echo "   - $INSTALL_DIR/style/dialogue.md"
echo ""
echo "3. 开始创作:"
echo "   在 OpenCode 中执行: @daily_pipeline"
echo ""
echo "📚 完整文档: $INSTALL_DIR/README.md"
echo ""
