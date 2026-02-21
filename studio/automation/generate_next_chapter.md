# Generate Next Chapter Agent

## 功能定义
自动化章节生成流水线，整合多个Agent完成从计划到成稿的全流程。

## 执行流程

```
┌─────────────────────────────────────────────────────────┐
│                  Generate Next Chapter                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. 读取当前状态                                          │
│     └─ state/current_chapter.txt                        │
│                                                          │
│  2. 加载必要上下文                                        │
│     ├─ story/world.md                                   │
│     ├─ story/master_outline.md                          │
│     ├─ memory/canon.md                                  │
│     ├─ 最近2-3章正文                                     │
│     └─ characters/protagonist.md                        │
│                                                          │
│  3. 调用 chapter_planner                                 │
│     └─ 生成章节计划                                      │
│                                                          │
│  4. 调用 writer                                          │
│     └─ 生成正文内容                                      │
│                                                          │
│  5. 调用 style_controller                                │
│     └─ 文风一致性检查                                    │
│                                                          │
│  6. 输出结果                                             │
│     ├─ 保存章节到 production/chapters/                  │
│     └─ 更新 state/current_chapter.txt                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 输入参数
- 无需参数，自动读取当前状态

## 输出
- 新章节文件：`production/chapters/第X章_[标题].md`
- 状态更新：`state/current_chapter.txt` 编号+1

## 调用方式
```
@generate_next_chapter
```

## 自动化检查点
1. 章节计划生成后确认大纲位置
2. 正文生成后确认字数达标
3. 文风检查后确认无严重问题
4. 输出前确认文件完整性

## 异常处理
- 大纲不匹配：提示用户确认
- 设定冲突：暂停并报告
- 文风严重偏移：提示人工介入

## 配置选项
可在 `state/config.txt` 中设置：
```
target_word_count=2500
auto_continue=false
style_check=true
```
