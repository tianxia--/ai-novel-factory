#!/bin/bash
# AI Novel Factory - 完整AI引导安装脚本
# 包含环境检查、npm安装、配置、项目初始化的完整流程

ai_novel_factory_complete_install() {
    echo "🤖 AI Novel Factory 完整安装引导"
    echo "=================================="
    echo ""
    
    # 第一步：环境检查
    echo "📋 第一步：检查环境..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装"
        echo ""
        echo "请先安装 Node.js："
        echo "1. 访问 https://nodejs.org/"
        echo "2. 下载并安装 LTS 版本"
        echo "3. 重新运行此脚本"
        exit 1
    else
        echo "✅ Node.js: $(node --version)"
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm 未安装"
        echo "npm 通常随 Node.js 一起安装，请重新安装 Node.js"
        exit 1
    else
        echo "✅ npm: $(npm --version)"
    fi
    
    # 第二步：安装插件
    echo ""
    echo "📦 第二步：安装 OpenCode 插件..."
    echo "正在安装 opencode-ai-novel-factory..."
    
    if npm list -g opencode-ai-novel-factory &> /dev/null; then
        echo "✅ 插件已安装: $(npm list -g opencode-ai-novel-factory | grep opencode-ai-novel-factory)"
    else
        echo "正在全局安装插件..."
        npm install -g opencode-ai-novel-factory
        
        if [ $? -eq 0 ]; then
            echo "✅ 插件安装成功"
        else
            echo "❌ 插件安装失败，尝试使用本地安装..."
            npm install opencode-ai-novel-factory
        fi
    fi
    
    # 第三步：配置 OpenCode
    echo ""
    echo "⚙️ 第三步：配置 OpenCode..."
    
    setup_opencode_config() {
        local opencode_json=""
        local user_home="$HOME"
        local plugin_name="opencode-ai-novel-factory"
        
        # 查找 opencode.json 文件
        if [ -f "./opencode.json" ]; then
            opencode_json="./opencode.json"
            echo "✅ 在当前目录找到 opencode.json"
        elif [ -f "$user_home/.opencode/opencode.json" ]; then
            opencode_json="$user_home/.opencode/opencode.json"
            echo "✅ 在用户配置目录找到 opencode.json"
        else
            echo "⚠️  未找到 opencode.json，正在创建..."
            echo "请选择配置位置："
            echo "1) 当前项目目录 (./opencode.json)"
            echo "2) 全局配置目录 (~/.opencode/opencode.json)"
            echo "3) 让AI助手决定"
            
            read -p "请输入选择 (1-3): " choice
            
            case $choice in
                1)
                    mkdir -p "$(dirname "./opencode.json")"
                    echo '{"plugin": []}' > "./opencode.json"
                    opencode_json="./opencode.json"
                    ;;
                2)
                    mkdir -p "$user_home/.opencode"
                    echo '{"plugin": []}' > "$user_home/.opencode/opencode.json"
                    opencode_json="$user_home/.opencode/opencode.json"
                    ;;
                3)
                    echo "🤖 推荐使用全局配置，这样所有项目都能使用插件"
                    mkdir -p "$user_home/.opencode"
                    echo '{"plugin": []}' > "$user_home/.opencode/opencode.json"
                    opencode_json="$user_home/.opencode/opencode.json"
                    ;;
            esac
        fi
        
        # 检查是否已包含插件
        if grep -q "$plugin_name" "$opencode_json"; then
            echo "✅ 插件已配置到 opencode.json"
            return 0
        fi
        
        # 备份原文件
        cp "$opencode_json" "$opencode_json.backup.$(date +%s)"
        
        # 添加插件配置
        if grep -q '"plugin"' "$opencode_json"; then
            # 已有 plugin 字段，添加到数组中
            if grep -q '"plugin": \[\s*\]' "$opencode_json"; then
                sed -i.tmp "s/\"plugin\": \[\s*\]/\"plugin\": [\"$plugin_name\"]/" "$opencode_json"
            else
                sed -i.tmp "s/\"plugin\": \[/\"plugin\": [\"$plugin_name\", /" "$opencode_json"
            fi
            rm -f "$opencode_json.tmp"
        else
            # 没有 plugin 字段，创建新的配置
            echo "{ \"plugin\": [\"$plugin_name\"] }" > "$opencode_json"
        fi
        
        echo "✅ opencode.json 配置完成"
        echo "📁 配置文件: $opencode_json"
        echo "💾 已备份原文件"
        return 0
    }
    
    setup_opencode_config
    
    # 第四步：验证安装
    echo ""
    echo "🔍 第四步：验证安装..."
    
    if npm list -g opencode-ai-novel-factory &> /dev/null || npm list opencode-ai-novel-factory &> /dev/null; then
        echo "✅ 插件安装验证通过"
    else
        echo "❌ 插件安装验证失败"
        exit 1
    fi
    
    # 第五步：询问是否初始化项目
    echo ""
    echo "🎯 第五步：项目初始化"
    echo "安装完成！是否现在初始化小说工厂项目？"
    echo ""
    echo "选项："
    echo "1) 立即初始化 (推荐)"
    echo "2) 稍后在 OpenCode 中初始化"
    echo "3) 查看使用说明"
    
    read -p "请输入选择 (1-3): " init_choice
    
    case $init_choice in
        1)
            echo ""
            echo "🚀 正在初始化小说工厂项目..."
            
            # 调用项目初始化脚本
            if [ -f "install-inline.sh" ]; then
                bash install-inline.sh studio
            else
                echo "正在从远程下载项目模板..."
                curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/install-inline.sh | bash -s -- studio
            fi
            
            echo ""
            echo "🎉 项目初始化完成！"
            ;;
        2)
            echo ""
            echo "💡 稍后在 OpenCode 中初始化项目："
            echo "请输入：'请帮我初始化小说工厂项目'"
            ;;
        3)
            echo ""
            echo "📖 使用说明："
            echo ""
            echo "在 OpenCode 中使用以下命令："
            echo ""
            echo "🎯 初始化项目："
            echo "请帮我初始化小说工厂项目"
            echo ""
            echo "🌍 创建世界观："
            echo "请帮我创建小说世界观设定"
            echo ""
            echo "✍️ 开始写作："
            echo "请帮我开始写小说"
            echo ""
            echo "📚 查看帮助："
            echo "请帮我查看小说工厂的使用指南"
            ;;
    esac
    
    # 第六步：完成
    echo ""
    echo "🎊 AI Novel Factory 安装完成！"
    echo "================================"
    echo ""
    echo "🚀 现在可以在 OpenCode 中使用了："
    echo ""
    echo "📋 快速开始命令："
    echo "请帮我初始化小说工厂项目"
    echo ""
    echo "🌍 创建世界观："
    echo "请帮我创建小说世界观设定"
    echo ""
    echo "✍️ 开始写作："
    echo "请帮我开始写小说"
    echo ""
    echo "🔧 故障排除："
    echo "如果遇到问题，运行验证脚本："
    echo "curl -fsSL https://raw.githubusercontent.com/tianxia--/ai-novel-factory/main/verify-install.sh | bash"
    echo ""
    echo "📚 完整文档："
    echo "https://github.com/tianxia--/ai-novel-factory"
    echo ""
}

# 运行完整安装
ai_novel_factory_complete_install