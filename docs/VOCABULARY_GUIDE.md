# 词汇推荐系统使用指南

## 概述

词汇推荐系统是基于 ci.csv 词汇库构建的智能工具，可以根据小说场景自动推荐合适的词汇，为 AI 小说创作提供丰富的表达参考。

## 系统组成

### 1. 词汇数据库
- **总词汇数**：264,406 个
- **分类数量**：8 个主要分类
- **文件大小**：约 48 MB（JSON 索引）

### 2. 分类体系

| 分类 | 文件名 | 词汇数量 | 说明 |
|------|--------|---------|------|
| 动作词汇 | action_verbs.md | 40,352 | 动作、行为、动态描述 |
| 环境描写 | environment.md | 77,929 | 自然环境、景物、场景 |
| 情感心理 | emotions.md | 71,484 | 情绪、心理、神态 |
| 人物特征 | character_traits.md | 95,377 | 外貌、性格、身份 |
| 宫廷政治 | court_politics.md | 59,607 | 宫廷、礼仪、政治 |
| 军事战争 | military.md | 39,200 | 兵器、战法、军事 |
| 日常生活 | daily_life.md | 70,110 | 饮食、服饰、习俗 |
| 文化典籍 | cultural.md | 157,378 | 成语、典故、文化 |

### 3. 场景类型映射

系统支持 17 种场景类型的自动词汇推荐：

```
战斗     → action_verbs, military
对话     → emotions, character_traits
描写     → environment, character_traits
宫廷     → court_politics, character_traits
战争     → military, action_verbs
日常     → daily_life, emotions
自然环境 → environment, cultural
心理活动 → emotions
人物刻画 → character_traits, emotions
仪式庆典 → court_politics, cultural
训练修炼 → action_verbs, daily_life
探索冒险 → action_verbs, environment
权谋算计 → court_politics, emotions
感情戏   → emotions, character_traits
动作场面 → action_verbs, military
环境渲染 → environment, cultural
历史叙事 → cultural, court_politics
```

## 使用方法

### 方法 1：命令行工具（推荐用于开发调试）

#### 基本用法

```bash
# 根据场景类型获取词汇推荐
python3 scripts/vocabulary_integration.py --chapter 1 --scene 战斗

# 根据场景类型和关键词获取词汇推荐
python3 scripts/vocabulary_integration.py --chapter 1 --scene 战斗 --keywords 剑 刀 斩

# 将词汇推荐追加到章节计划文件
python3 scripts/vocabulary_integration.py --file chapter_plan_1.md --scene 战斗
```

#### 参数说明

- `--chapter N`: 章节编号
- `--scene TYPE`: 场景类型（必填）
- `--keywords K1 K2 ...`: 关键词列表（可选）
- `--file PATH`: 章节计划文件路径（可选）

#### 输出示例

```markdown
# 推荐词汇参考

> 上下文：第1章 - 示例章节

---

## 斩

**释义**：砍断。  2.杀，砍杀。

## 凌厉

**释义**：气势猛烈；锐利。

## 骇然

**释义**：惊讶的样子。

## 威慑

**释义**：用武力或威势使对方感到害怕。

## 剑

**释义**：古代兵器，长条形，两端有柄，可以挥舞砍杀。

---
```

### 方法 2：Python API（推荐用于自动化集成）

#### 基本用法

```python
from scripts.vocabulary_recommender import VocabularyRecommender

# 初始化推荐器
recommender = VocabularyRecommender()

# 根据场景类型推荐
words = recommender.recommend_by_scene("战斗", top_n=50)

# 根据关键词推荐
words = recommender.recommend_by_keywords(["剑", "刀"], top_n=50)

# 获取特定分类的词汇
words = recommender.get_category_words("action_verbs", limit=100)

# 格式化输出
formatted = recommender.format_for_ai(words, context="第1章 - 少年觉醒")
print(formatted)
```

#### 高级用法

```python
# 分析章节文本，自动识别场景类型和关键词
main_scene, keywords = recommender.analyze_chapter_context(chapter_text)

# 根据分析结果推荐词汇
words = recommender.recommend_by_scene(main_scene, keywords, top_n=50)
```

### 方法 3：集成到 AI 写作流程（推荐用于生产环境）

#### 在 Writer Agent 中使用

1. **加载章节计划**
```python
chapter_plan = load_chapter_plan(chapter_number)
scene_type = chapter_plan.get("scene_type", "日常")
keywords = chapter_plan.get("keywords", [])
```

2. **获取词汇推荐**
```python
recommender = VocabularyRecommender()
recommended_words = recommender.recommend_by_scene(
    scene_type, keywords, top_n=50
)
```

3. **格式化为 AI 提示**
```python
vocabulary_reference = recommender.format_for_ai(
    recommended_words,
    context=f"第{chapter_number}章 - {chapter_plan.get('title', '')}"
)
```

4. **AI 写作时参考**
```
请根据以下章节计划创作正文，参考词汇推荐丰富表达。

【章节计划】
...

【词汇推荐参考】
[词汇推荐内容]

请开始创作...
```

## 使用建议

### 1. 词汇选择原则

**适度使用**
- 每个场景推荐 5-10 个关键词汇即可
- 不要在一段中密集使用高级词汇
- 优先选择与场景高度相关的词汇

**自然融入**
- 确保词汇符合人物说话习惯
- 环境词汇要与场景氛围相符
- 避免文白夹杂，保持文风统一

**语境适配**
- 理解词汇的准确含义
- 检查词汇是否适合当前时代背景
- 考虑人物身份是否适合使用该词汇

### 2. 不同场景的使用技巧

**战斗场景**
```markdown
推荐词汇：
- 斩（砍断，杀砍杀）
- 凌厉（气势猛烈，锐利）
- 骇然（惊讶的样子）
- 威慑（用武力或威势使对方害怕）

使用示例：
剑光如霜，凌厉无比，一剑斩下，威慑四方。
```

**对话场景**
```markdown
推荐词汇：
- 沉思熟虑（深入思考）
- 踌躇满志（自满，得意）
- 义愤填膺（正义感强烈）

使用示例：
他深思熟虑后道："此事关系重大，需从长计议。"
```

**描写场景**
```markdown
推荐词汇：
- 暴雨如注（雨下得很大）
- 阳光明媚（天气晴朗）
- 狂风大作（风势猛烈）

使用示例：
窗外暴雨如注，雷声隆隆，仿佛天要塌下来。
```

**心理场景**
```markdown
推荐词汇：
- 痛彻心扉（极度痛苦）
- 提心吊胆（非常担心）
- 悲喜交加（既悲伤又欢喜）

使用示例：
听到这个消息，他痛彻心扉，难以置信。
```

### 3. 常见问题

**Q: 词汇太多，如何选择？**
A: 优先选择前 10 个推荐词汇，这些通常是相关性最高的。

**Q: 如何确保词汇使用自然？**
A: 在写作时不要刻意使用，而是参考词汇的表达方式，用自己的话重新组织。

**Q: 某些词汇太生僻，怎么办？**
A: 选择常见的词汇，生僻词汇可以偶尔使用增加文采，但不要过多。

**Q: 如何避免词汇堆砌？**
A: 每个章节使用 5-10 个推荐词汇即可，确保每个词汇都有明确的表达目的。

## 性能优化

### 1. 首次加载
- JSON 索引文件较大（48 MB），首次加载需要几秒钟
- 建议在系统启动时加载一次，之后复用

### 2. 缓存机制
```python
# 使用单例模式，避免重复加载
class VocabularyRecommender:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
```

### 3. 批量处理
```python
# 一次加载，多次使用
recommender = VocabularyRecommender()

# 处理多个章节
for chapter in chapters:
    words = recommender.recommend_by_scene(chapter.scene_type)
    # ...
```

## 文件结构

```
studio/style/vocabulary/
├── vocabulary_index.json          # JSON 索引（48 MB）
├── action_verbs.md                # 动作词汇
├── environment.md                 # 环境描写
├── emotions.md                    # 情感心理
├── character_traits.md            # 人物特征
├── court_politics.md              # 宫廷政治
├── military.md                    # 军事战争
├── daily_life.md                  # 日常生活
└── cultural.md                    # 文化典籍

scripts/
├── process_vocabulary.py          # 词汇处理脚本
├── vocabulary_recommender.py      # 词汇推荐器
└── vocabulary_integration.py       # 集成工具

studio/agents/
├── writer.md                      # 原始 Writer Agent
└── writer_enhanced.md             # 增强版 Writer Agent
```

## 更新日志

### 2026-03-04
- 初始版本发布
- 解析 ci.csv，处理 264,406 个词汇
- 创建 8 个分类文件
- 构建 JSON 索引
- 实现智能词汇推荐算法
- 集成到 Writer Agent

## 技术支持

如遇问题，请检查：
1. CSV 文件是否完整
2. JSON 索引是否生成成功
3. Python 版本（推荐 3.6+）
4. 文件编码（UTF-8）

---

*最后更新：2026-03-04*
