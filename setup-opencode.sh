#!/bin/bash
# OpenCode AI Novel Factory - 插件配置脚本
# 用于配置 opencode.json 插件设置

setup_opencode_plugin() {
    local opencode_json=""
    local user_home="$HOME"
    local plugin_name="opencode-ai-novel-factory"
    
    echo "🔍 正在查找 opencode.json 文件..."
    
    # 查找 opencode.json 文件
    if [ -f "./opencode.json" ]; then
        opencode_json="./opencode.json"
        echo "✅ 在当前目录找到 opencode.json"
    elif [ -f "$user_home/.opencode/opencode.json" ]; then
        opencode_json="$user_home/.opencode/opencode.json"
        echo "✅ 在用户配置目录找到 opencode.json"
    else
        echo "❌ 未找到 opencode.json 文件"
        echo ""
        echo "请选择配置方式："
        echo "1) 在当前项目创建 opencode.json"
        echo "2) 在全局配置目录创建 (~/.opencode/)"
        echo "3) 手动配置指南"
        echo ""
        read -p "请输入选择 (1-3): " choice
        
        case $choice in
            1)
                opencode_json="./opencode.json"
                echo "{\n  \"plugin\": []\n}" > "$opencode_json"
                echo "✅ 已在当前目录创建 opencode.json"
                ;;
            2)
                mkdir -p "$user_home/.opencode"
                opencode_json="$user_home/.opencode/opencode.json"
                echo "{\n  \"plugin\": []\n}" > "$opencode_json"
                echo "✅ 已在全局配置目录创建 opencode.json"
                ;;
            3)
                echo ""
                echo "📋 手动配置指南："
                echo "1. 创建 opencode.json 文件"
                echo "2. 添加以下内容："
                echo "{"
                echo "  \"plugin\": [\"opencode-ai-novel-factory\"]"
                echo "}"
                echo ""
                echo "📍 推荐位置："
                echo "   - 项目级：./opencode.json (仅当前项目生效)"
                echo "   - 全局级：~/.opencode/opencode.json (所有项目生效)"
                return 1
                ;;
            *)
                echo "❌ 无效选择"
                return 1
                ;;
        esac
    fi
    
    # 显示当前配置
    echo ""
    echo "📄 当前配置内容："
    cat "$opencode_json"
    echo ""
    
    # 检查是否已包含插件
    if grep -q "$plugin_name" "$opencode_json"; then
        echo "✅ $plugin_name 插件已配置"
        echo ""
        echo "🎉 配置完成！可以直接使用 AI Novel Factory 功能："
        echo "   @daily_pipeline - 一键生成章节"
        echo "   @story_architect - 创建世界观"
        echo "   @writer [章节] - 写作指定章节"
        return 0
    fi
    
    # 确认配置
    read -p "是否添加 $plugin_name 插件到配置文件？(y/n): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo "❌ 配置已取消"
        return 1
    fi
    
    # 备份原文件
    local backup_file="$opencode_json.backup.$(date +%s)"
    cp "$opencode_json" "$backup_file"
    echo "💾 已备份原文件到: $backup_file"
    
    # 添加插件配置
    if grep -q '"plugin"' "$opencode_json"; then
        # 已有 plugin 字段，添加到数组中
        if grep -q '"plugin": \[\s*\]' "$opencode_json"; then
            # 空数组，直接添加
            sed -i.tmp "s/\"plugin\": \[\s*\]/\"plugin\": [\"$plugin_name\"]/" "$opencode_json"
        else
            # 非空数组，添加到第一个位置
            sed -i.tmp "s/\"plugin\": \[/\"plugin\": [\"$plugin_name\", /" "$opencode_json"
        fi
        rm -f "$opencode_json.tmp"
    else
        # 没有 plugin 字段，创建新的配置
        if [ -s "$opencode_json" ]; then
            # 文件非空，添加插件配置
            sed -i.tmp "1i\
{\
  \"plugin\": [\"$plugin_name\"]\
}\
" "$opencode_json"
            mv "$opencode_json.tmp" "$opencode_json".new && mv "$opencode_json".new "$opencode_json"
        else
            # 空文件，直接写入
            echo "{ \"plugin\": [\"$plugin_name\"] }" > "$opencode_json"
        fi
    fi
    
    echo ""
    echo "✅ 插件配置已添加"
    echo "📁 配置文件: $opencode_json"
    echo ""
    echo "📋 新配置内容："
    cat "$opencode_json"
    echo ""
    echo "🎉 配置完成！重启 OpenCode 后即可使用 AI Novel Factory 功能："
    echo "   @daily_pipeline - 一键生成章节"
    echo "   @story_architect - 创建世界观"
    echo "   @writer [章节] - 写作指定章节"
    echo "   @editor [章节] - 质量检查"
}

# 检查是否有 Node.js 和 npm
if ! command -v node &> /dev/null; then
    echo "⚠️  未检测到 Node.js，请先安装 Node.js"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "⚠️  未检测到 npm，请先安装 npm"
    exit 1
fi

# 检查是否已安装插件
if ! npm list -g opencode-ai-novel-factory &> /dev/null && ! npm list opencode-ai-novel-factory &> /dev/null; then
    echo "⚠️  未检测到 opencode-ai-novel-factory 插件"
    echo ""
    read -p "是否现在安装？(y/n): " install_confirm
    if [[ $install_confirm =~ ^[Yy]$ ]]; then
        echo "📦 正在安装 opencode-ai-novel-factory..."
        npm install -g opencode-ai-novel-factory
        if [ $? -eq 0 ]; then
            echo "✅ 插件安装成功"
        else
            echo "❌ 插件安装失败，请检查网络连接"
            exit 1
        fi
    else
        echo "⚠️  请先安装插件：npm install -g opencode-ai-novel-factory"
        exit 1
    fi
fi

# 执行配置
setup_opencode_plugin