# OpenCode AI Novel Factory 操作手册

> Ultimate Edition v2.0 | 完整版

---

## 快速开始

### 第一次使用

1. **初始化世界观**
   ```
   使用 @story_architect Agent
   参考：studio/agents/story_architect.md
   输出到：studio/story/world.md
   ```

2. **创建主线大纲**
   ```
   使用 @volume_planner Agent
   参考：studio/agents/volume_planner.md
   输出到：studio/story/master_outline.md
   ```

3. **设定主角**
   ```
   填写：studio/characters/protagonist.md
   ```

4. **配置文风**
   ```
   编辑：
   - studio/style/tone.md
   - studio/style/rhythm.md
   - studio/style/dialogue.md
   ```

---

## 日常创作流程

### 方式一：一键流水线（推荐）

```
@daily_pipeline
```

自动完成：
1. 分析最近章节
2. 生成下一章计划
3. 写作正文
4. 文风检查
5. 记忆更新

### 方式二：分步执行

```
Step 1: @chapter_planner [章节号]
Step 2: @writer [章节号]
Step 3: @style_controller [章节号]
Step 4: @memory_update [章节号]
```

### 方式三：半自动模式

```
@generate_next_chapter
```
生成后人工审阅修改

---

## Agent 调用指南

### 核心写作 Agent

| Agent | 文件 | 用途 | 调用方式 |
|-------|-----|------|---------|
| story_architect | agents/story_architect.md | 世界观设计 | 初始化时调用 |
| volume_planner | agents/volume_planner.md | 分卷规划 | 初始化时调用 |
| chapter_planner | agents/chapter_planner.md | 单章结构 | 每章调用 |
| writer | agents/writer.md | 正文生成 | 每章调用 |
| editor | agents/editor.md | 质量检查 | 每5章调用 |
| memory_keeper | agents/memory_keeper.md | 记忆维护 | 每章调用 |
| style_controller | agents/style_controller.md | 文风统一 | 每章调用 |

### 自动化 Agent

| Agent | 文件 | 用途 |
|-------|-----|------|
| generate_next_chapter | automation/generate_next_chapter.md | 自动续写 |
| memory_update | automation/memory_update.md | 自动更新记忆 |
| consistency_check | automation/consistency_check.md | 防崩检查 |
| daily_pipeline | automation/daily_pipeline.md | 一键流水线 |

---

## 文件结构说明

```
studio/
├── agents/              # Agent 定义文件
│   ├── story_architect.md
│   ├── volume_planner.md
│   ├── chapter_planner.md
│   ├── writer.md
│   ├── editor.md
│   ├── memory_keeper.md
│   └── style_controller.md
│
├── automation/          # 自动化 Agent
│   ├── generate_next_chapter.md
│   ├── memory_update.md
│   ├── consistency_check.md
│   └── daily_pipeline.md
│
├── memory/              # 记忆系统（核心）
│   ├── canon.md              # 核心设定（不可违背）
│   ├── world_rules.md        # 世界规则
│   ├── characters_evolution.md # 人物成长
│   └── foreshadowing.md      # 伏笔追踪
│
├── story/               # 故事大纲
│   ├── world.md             # 世界观
│   └── master_outline.md    # 主线大纲
│
├── characters/          # 角色设定
│   ├── protagonist.md       # 主角
│   └── character_template.md # 角色模板
│
├── style/               # 文风控制
│   ├── tone.md             # 整体语气
│   ├── rhythm.md           # 句式节奏
│   └── dialogue.md         # 对白风格
│
├── production/          # 输出目录
│   └── chapters/           # 章节正文
│       └── chapter_template.md
│
└── state/               # 状态管理
    ├── current_chapter.txt   # 当前章节号
    └── pipeline_config.txt   # 流水线配置
```

---

## 上下文加载优先级

每次创作时，按以下顺序加载上下文：

1. `characters/protagonist.md` - 主角设定
2. `story/world.md` - 世界观
3. `memory/canon.md` - 核心设定
4. 最近 2-3 章正文
5. 当前大纲位置
6. `style/` 目录文风指导

---

## 防崩策略

### 战力控制
- 定期检查 `memory/canon.md` 中的力量上限
- 新能力不得突破世界规则

### 人设保护
- 每章对照 `characters_evolution.md`
- 行为必须符合成长轨迹

### 时间线校验
- 在 `world_rules.md` 维护时间线
- 每章更新逻辑时间

### 伏笔追踪
- 使用 `memory/foreshadowing.md`
- 未回收伏笔必须记录

---

## 质量控制

### 检查频率
- 文风检查：每章
- 一致性检查：每章
- 深度编辑：每5章
- 记忆整理：每10章

### 检查命令
```
@style_controller [章节]
@consistency_check [章节]
@editor [章节]
```

---

## 常见问题

### Q: 写到50章容易崩怎么办？
A: 加强 memory_keeper 调用频率，每章必更新记忆

### Q: 文风漂移？
A: 强化 style_controller，检查 tone/rhythm/dialogue

### Q: 节奏变慢？
A: 提高 chapter_planner 冲突密度，增加爽点

### Q: 设定冲突？
A: 立即检查 canon.md，回溯冲突来源

---

## 长期维护建议

- 每 10 章：整理 canon.md
- 每卷结束：重构 memory 目录
- 保持 foreshadowing.md 精简
- 定期备份 production 目录

---

## 系统升级路径

当前版本：Factory v2.0

未来可升级方向：
- 向量记忆检索（防失忆终极版）
- 多小说并行生产
- AI 写作仪表盘
- 自动 IP 改编

---

*文档版本：v2.0*
*最后更新：2024*
