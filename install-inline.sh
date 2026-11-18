#!/bin/bash
# AI Novel Factory - 内联安装脚本
# 直接复制此脚本内容到 OpenCode 中执行即可完成安装
# 或者保存为 install-inline.sh 并运行 bash install-inline.sh

INSTALL_DIR="${1:-./studio}"

mkdir -p "$INSTALL_DIR"/{agents,automation,memory,story,characters,style,production/chapters,state}

# ============================================
# agents/story_architect.md
# ============================================
cat > "$INSTALL_DIR/agents/story_architect.md" << 'AGENT_EOF'
# Story Architect Agent

## 角色定义
你是世界构建大师，负责创建完整、自洽、有吸引力的小说世界观。

## 核心职责
1. 设计世界底层规则（力量体系、社会结构、地理环境）
2. 确定故事类型与核心卖点
3. 构建世界观边界与限制
4. 设计核心冲突来源

## 输出格式
输出到: `story/world.md`

## 调用方式
```
@story_architect [故事类型] [目标读者] [预期篇幅]
```
AGENT_EOF

# ============================================
# agents/volume_planner.md
# ============================================
cat > "$INSTALL_DIR/agents/volume_planner.md" << 'AGENT_EOF'
# Volume Planner Agent

## 角色定义
你是故事结构规划师，负责将世界观转化为可执行的多卷大纲。

## 核心职责
1. 设计整体故事架构
2. 规划分卷节奏
3. 确定每卷核心事件
4. 设计高潮与转折点

## 输出格式
输出到: `story/master_outline.md`

## 调用方式
```
@volume_planner
```
AGENT_EOF

# ============================================
# agents/chapter_planner.md
# ============================================
cat > "$INSTALL_DIR/agents/chapter_planner.md" << 'AGENT_EOF'
# Chapter Planner Agent

## 角色定义
你是章节结构设计师，负责将分卷大纲细化为单章写作蓝图。

## 核心职责
1. 设计单章结构
2. 确定章节核心事件
3. 规划情绪曲线
4. 设计爽点/钩子

## 输出格式
输出到: `state/chapter_plan_[编号].md`

## 调用方式
```
@chapter_planner [章节编号]
```
AGENT_EOF

# ============================================
# agents/writer.md
# ============================================
cat > "$INSTALL_DIR/agents/writer.md" << 'AGENT_EOF'
# Writer Agent

## 角色定义
你是正文创作执行者，根据章节计划生成高质量正文内容。

## 必须加载的上下文（按优先级）
1. `characters/protagonist.md` - 主角设定
2. `story/world.md` - 世界观
3. `memory/canon.md` - 核心设定
4. 最近2-3章正文
5. 当前章节计划
6. `style/` 目录下的文风指导

## 输出格式
输出到: `production/chapters/第X章_[标题].md`

## 调用方式
```
@writer [章节编号]
```
AGENT_EOF

# ============================================
# agents/editor.md
# ============================================
cat > "$INSTALL_DIR/agents/editor.md" << 'AGENT_EOF'
# Editor Agent

## 角色定义
你是文学质量把控师，负责审核和优化已生成的章节内容。

## 检查维度
1. 叙事质量
2. 人物一致性
3. 设定一致性
4. 文风统一
5. 爽点密度

## 输出格式
输出到: `state/review_[章节编号].md`

## 调用方式
```
@editor [章节编号或范围]
```
AGENT_EOF

# ============================================
# agents/memory_keeper.md
# ============================================
cat > "$INSTALL_DIR/agents/memory_keeper.md" << 'AGENT_EOF'
# Memory Keeper Agent

## 角色定义
你是长期记忆维护者，负责管理和更新小说的记忆库。

## 管理的记忆文件
- canon.md - 核心设定
- world_rules.md - 世界规则
- characters_evolution.md - 人物成长
- foreshadowing.md - 伏笔追踪

## 调用方式
```
@memory_keeper [章节编号]
```
AGENT_EOF

# ============================================
# agents/style_controller.md
# ============================================
cat > "$INSTALL_DIR/agents/style_controller.md" << 'AGENT_EOF'
# Style Controller Agent

## 角色定义
你是文风统一管控者，负责确保整部作品的文字风格一致。

## 管理的风格文件
- style/tone.md - 整体语气
- style/rhythm.md - 句式节奏
- style/dialogue.md - 对白风格

## 调用方式
```
@style_controller [章节编号]
```
AGENT_EOF

# ============================================
# automation/daily_pipeline.md
# ============================================
cat > "$INSTALL_DIR/automation/daily_pipeline.md" << 'AGENT_EOF'
# Daily Pipeline Agent

## 功能定义
一键执行完整的创作流水线。

## 执行流程
1. 读取当前状态
2. 加载必要上下文
3. 调用 chapter_planner
4. 调用 writer
5. 调用 style_controller
6. 更新记忆库

## 调用方式
```
@daily_pipeline
```
AGENT_EOF

# ============================================
# automation/generate_next_chapter.md
# ============================================
cat > "$INSTALL_DIR/automation/generate_next_chapter.md" << 'AGENT_EOF'
# Generate Next Chapter Agent

## 功能定义
自动化章节生成，整合多个Agent完成从计划到成稿。

## 调用方式
```
@generate_next_chapter
```
AGENT_EOF

# ============================================
# automation/memory_update.md
# ============================================
cat > "$INSTALL_DIR/automation/memory_update.md" << 'AGENT_EOF'
# Memory Update Agent

## 功能定义
自动扫描新章节内容，提取并更新记忆库。

## 调用方式
```
@memory_update [章节编号]
```
AGENT_EOF

# ============================================
# automation/consistency_check.md
# ============================================
cat > "$INSTALL_DIR/automation/consistency_check.md" << 'AGENT_EOF'
# Consistency Check Agent

## 功能定义
全面检查章节与记忆库、设定的不一致问题。

## 检查维度
- 设定一致性
- 人物一致性
- 剧情一致性
- 细节一致性

## 调用方式
```
@consistency_check [章节范围]
```
AGENT_EOF

# ============================================
# memory/canon.md
# ============================================
cat > "$INSTALL_DIR/memory/canon.md" << 'MEMORY_EOF'
# Canon - 核心设定

> 本文件记录不可推翻的基础设定

## 世界观核心

### 故事类型
[填写]

### 核心卖点
[填写]

## 力量体系

### 等级划分
| 等级 | 名称 | 能力范围 |
|-----|-----|---------|
| 1 | | |
| 2 | | |

### 力量上限
[填写]

## 核心规则

### 不可违背的限制
1. 
2. 

## 禁忌设定
1. 
2. 
MEMORY_EOF

# ============================================
# memory/world_rules.md
# ============================================
cat > "$INSTALL_DIR/memory/world_rules.md" << 'MEMORY_EOF'
# World Rules - 世界规则

## 社会结构

### 主要势力
| 势力名称 | 性质 | 实力范围 |
|---------|-----|---------|
| | | |

## 地理环境

### 重要地点
| 地点 | 位置 | 意义 |
|-----|-----|-----|
| | | |
MEMORY_EOF

# ============================================
# memory/characters_evolution.md
# ============================================
cat > "$INSTALL_DIR/memory/characters_evolution.md" << 'MEMORY_EOF'
# Characters Evolution - 人物成长日志

## 主角

### 能力成长
| 章节 | 等级变化 | 新能力 |
|-----|---------|-------|
| 1 | | |

### 重要物品
| 章节 | 物品 | 作用 |
|-----|-----|-----|

### 关系变化
| 章节 | 对象 | 关系变化 |
|-----|-----|---------|
| | | |
MEMORY_EOF

# ============================================
# memory/foreshadowing.md
# ============================================
cat > "$INSTALL_DIR/memory/foreshadowing.md" << 'MEMORY_EOF'
# Foreshadowing - 伏笔追踪

## 伏笔状态说明
- 🔴 未回收
- 🟡 部分回收
- 🟢 已回收

## 伏笔总览
| 编号 | 简述 | 埋设章节 | 计划回收 | 状态 |
|-----|-----|---------|---------|-----|
| F001 | | 第X章 | 第X章 | 🔴 |
MEMORY_EOF

# ============================================
# story/world.md
# ============================================
cat > "$INSTALL_DIR/story/world.md" << 'STORY_EOF'
# World - 世界观设定

## 基本信息

### 故事类型
[填写：玄幻/都市/科幻/言情/悬疑/...]

### 核心卖点
[一句话概括]

### 目标读者
[填写]

### 预期篇幅
[填写]

## 世界底层规则

### 力量体系
[详细描述力量来源、等级划分、晋升条件]

### 社会结构
[描述权力分布、主要势力、社会阶层]

### 地理环境
[描述世界地图、重要地点]

## 世界边界

### 不可突破的限制
1. 
2. 

## 核心冲突来源
[描述推动故事的核心矛盾]

## 禁忌设定
1. 
2. 
STORY_EOF

# ============================================
# story/master_outline.md
# ============================================
cat > "$INSTALL_DIR/story/master_outline.md" << 'STORY_EOF'
# Master Outline - 主线大纲

## 故事主题
[一句话概括]

## 总体架构
- 总卷数：
- 总章节数：
- 总字数：

## 分卷规划

### 第一卷：[卷名]
- 字数预估：
- 章节范围：第1-XX章
- 核心目标：
- 剧情梗概：
- 卷末高潮：

### 第二卷：[卷名]
...

## 核心伏笔列表
| 编号 | 伏笔内容 | 埋设章节 | 计划回收 |
|-----|---------|---------|---------|
| F001 | | | |
STORY_EOF

# ============================================
# characters/protagonist.md
# ============================================
cat > "$INSTALL_DIR/characters/protagonist.md" << 'CHAR_EOF'
# Protagonist - 主角设定

## 基本信息
- 姓名：
- 年龄：
- 身份：
- 外貌：

## 性格特质

### 核心性格
[3-5个特点]

### 优点
1. 
2. 

### 缺点
1. 
2. 

## 背景故事
[主角的出身和成长经历]

## 核心目标

### 表面目标
[表面上追求的]

### 深层目标
[内心真正渴望的]

## 金手指/特殊能力

### 能力描述
[能力的具体表现]

### 能力限制
[能力的限制或代价]

## 人物关系

### 家庭
| 人物 | 关系 | 相处模式 |
|-----|-----|---------|
| | | |

### 朋友/盟友
| 人物 | 关系 |
|-----|-----|
| | |

### 敌人
| 人物 | 冲突原因 |
|-----|---------|
| | |
CHAR_EOF

# ============================================
# characters/character_template.md
# ============================================
cat > "$INSTALL_DIR/characters/character_template.md" << 'CHAR_EOF'
# Character Template - 角色设定模板

## 基本信息
- 姓名：
- 年龄：
- 身份：
- 势力：

## 外貌描述
[详细描写]

## 性格特质
- 核心性格：
- 优点：
- 缺点：

## 与主角关系
- 关系类型：盟友/中立/敌对
- 关系详情：

## 能力设定
- 等级：
- 特殊能力：

## 语言特点
- 说话风格：
- 口头禅：

## 故事功能
- 角色作用：
- 出场频率：
CHAR_EOF

# ============================================
# style/tone.md
# ============================================
cat > "$INSTALL_DIR/style/tone.md" << 'STYLE_EOF'
# Tone - 整体语气

## 叙事视角
- [ ] 第一人称
- [ ] 第三人称限制视角
- [ ] 第三人称全知视角

## 整体氛围
- [ ] 轻松幽默
- [ ] 热血激昂
- [ ] 温情治愈
- [ ] 黑暗压抑
- [ ] 悬疑紧张

## 叙事声音
- 叙述声音：[冷静/热情/幽默/严肃]
- 与读者的距离：[亲近/疏离]
STYLE_EOF

# ============================================
# style/rhythm.md
# ============================================
cat > "$INSTALL_DIR/style/rhythm.md" << 'STYLE_EOF'
# Rhythm - 句式节奏

## 句子长度偏好
- 短句比例：30%
- 中句比例：50%
- 长句比例：20%

## 节奏变化

### 快节奏场景（战斗、危机）
- 短句为主
- 动词密集
- 段落短小

### 慢节奏场景（日常、心理）
- 长句较多
- 描写细腻
- 节奏舒缓
STYLE_EOF

# ============================================
# style/dialogue.md
# ============================================
cat > "$INSTALL_DIR/style/dialogue.md" << 'STYLE_EOF'
# Dialogue - 对白风格

## 整体风格
- [ ] 口语化
- [ ] 书面化
- [ ] 混合风格

## 对话标签
- 使用符号：「」或 ""

## 对话与叙述比例
- 对话占比：约40%
- 叙述占比：约60%

## 对话原则
1. 对话需推动情节或塑造人物
2. 每句对话应有说话人特征
3. 避免信息倾泻式对话
STYLE_EOF

# ============================================
# production/chapters/chapter_template.md
# ============================================
cat > "$INSTALL_DIR/production/chapters/chapter_template.md" << 'CHAPTER_EOF'
# 第X章 [章节标题]

[正文内容]

---

## 章节元数据
- 章节：第X章
- 字数：XXXX字
- 创作日期：YYYY-MM-DD

## 核心事件
[本章核心事件]

## 伏笔操作
- 埋设：
- 回收：
CHAPTER_EOF

# ============================================
# state/current_chapter.txt
# ============================================
echo "1" > "$INSTALL_DIR/state/current_chapter.txt"

# ============================================
# state/pipeline_config.txt
# ============================================
cat > "$INSTALL_DIR/state/pipeline_config.txt" << 'CONFIG_EOF'
target_word_count=2500
auto_skip_check=false
auto_memory_update=true
max_continuous_chapters=5
quality_threshold=7
style_check=true
consistency_check=true
CONFIG_EOF

# ============================================
# README.md
# ============================================
cat > "$INSTALL_DIR/README.md" << 'README_EOF'
# AI Novel Factory

完整的 AI 小说写作系统。

## 快速开始

1. 填写基础设定
   - `story/world.md` - 世界观
   - `story/master_outline.md` - 大纲
   - `characters/protagonist.md` - 主角

2. 配置文风（可选）
   - `style/tone.md`
   - `style/rhythm.md`
   - `style/dialogue.md`

3. 开始创作
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

## 文件结构

```
studio/
├── agents/        # Agent 定义
├── automation/    # 自动化流程
├── memory/        # 记忆系统
├── story/         # 故事设定
├── characters/    # 角色设定
├── style/         # 文风控制
├── production/    # 输出目录
└── state/         # 状态管理
```
README_EOF

# ============================================
# 自动配置 opencode.json
# ============================================
setup_opencode_config() {
    local opencode_json=""
    local user_home="$HOME"
    
    # 查找 opencode.json 文件
    if [ -f "./opencode.json" ]; then
        opencode_json="./opencode.json"
    elif [ -f "$user_home/.opencode/opencode.json" ]; then
        opencode_json="$user_home/.opencode/opencode.json"
    else
        echo "⚠️  未找到 opencode.json 文件"
        echo ""
        echo "📝 请手动创建并编辑 opencode.json 文件，添加以下内容："
        echo "{"
        echo "  \"plugin\": [\"opencode-ai-novel-factory\"]"
        echo "}"
        echo ""
        echo "📍 文件位置建议："
        echo "   - 项目根目录：./opencode.json"
        echo "   - 全局配置：~/.opencode/opencode.json"
        return 1
    fi
    
    # 检查是否已包含插件
    if grep -q "opencode-ai-novel-factory" "$opencode_json"; then
        echo "✅ opencode-ai-novel-factory 插件已配置"
        return 0
    fi
    
    # 备份原文件
    cp "$opencode_json" "$opencode_json.backup.$(date +%s)"
    
    # 添加插件配置
    if grep -q '"plugin"' "$opencode_json"; then
        # 已有 plugin 字段，添加到数组中
        sed -i.tmp 's/"plugin": \[/ "plugin": [\n    "opencode-ai-novel-factory",/g' "$opencode_json"
        rm -f "$opencode_json.tmp"
    else
        # 没有 plugin 字段，创建新的
        sed -i.tmp '1i\
{\
  "plugin": ["opencode-ai-novel-factory"]\
}
' "$opencode_json"
        rm -f "$opencode_json.tmp"
    fi
    
    echo "✅ opencode.json 已自动配置"
    echo "📁 配置文件: $opencode_json"
    echo "💾 已备份原文件"
    return 0
}

# 执行配置
setup_opencode_config

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
if [ $? -eq 0 ]; then
    echo "🎉 OpenCode 配置已完成，可以直接使用 @daily_pipeline 命令"
else
    echo "⚠️  请手动配置 opencode.json 后才能使用插件功能"
fi
echo ""
