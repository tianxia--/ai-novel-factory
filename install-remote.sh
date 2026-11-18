#!/bin/bash
# OpenCode AI Novel Factory - 远程安装脚本
# 使用方法: curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-remote.sh | bash

set -e

INSTALL_DIR="${1:-./studio}"
REPO_URL="https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main"

echo "=========================================="
echo "   OpenCode AI Novel Factory 安装程序"
echo "=========================================="
echo ""
echo "安装目录: $INSTALL_DIR"
echo ""

mkdir -p "$INSTALL_DIR"/{agents,automation,memory,story,characters,style,production/chapters,state}

download_file() {
    local path=$1
    local url="$REPO_URL/$path"
    echo "  ⬇️  $path"
    curl -fsSL "$url" -o "$INSTALL_DIR/$path" 2>/dev/null || {
        echo "  ❌ 下载失败: $path"
        return 1
    }
}

echo ""
echo "📥 下载核心文件..."

download_file "studio/agents/story_architect.md"
download_file "studio/agents/volume_planner.md"
download_file "studio/agents/chapter_planner.md"
download_file "studio/agents/writer.md"
download_file "studio/agents/editor.md"
download_file "studio/agents/memory_keeper.md"
download_file "studio/agents/style_controller.md"

download_file "studio/automation/generate_next_chapter.md"
download_file "studio/automation/memory_update.md"
download_file "studio/automation/consistency_check.md"
download_file "studio/automation/daily_pipeline.md"

download_file "studio/memory/canon.md"
download_file "studio/memory/world_rules.md"
download_file "studio/memory/characters_evolution.md"
download_file "studio/memory/foreshadowing.md"

download_file "studio/story/world.md"
download_file "studio/story/master_outline.md"

download_file "studio/characters/protagonist.md"
download_file "studio/characters/character_template.md"

download_file "studio/style/tone.md"
download_file "studio/style/rhythm.md"
download_file "studio/style/dialogue.md"

download_file "studio/production/chapters/chapter_template.md"

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

download_file "studio/README.md"

echo ""
echo "=========================================="
echo "   ✅ 安装完成！"
echo "=========================================="
echo ""
echo "📖 快速开始:"
echo ""
echo "1. 填写基础设定:"
echo "   - $INSTALL_DIR/story/world.md"
echo "   - $INSTALL_DIR/story/master_outline.md"
echo "   - $INSTALL_DIR/characters/protagonist.md"
echo ""
echo "2. 开始创作: @daily_pipeline"
echo ""
