# 智能词汇推荐系统

基于 ci.csv 构建的智能词汇推荐系统，为 AI 小说创作提供丰富的表达参考。

## 📊 系统概览

- **总词汇数**：264,406 个
- **分类数量**：8 个主要分类
- **场景类型**：17 种场景映射
- **文件大小**：~75 MB（总）

## 🎯 核心功能

### 1. 智能分类
将词汇自动分为 8 大类：
- 动作词汇（40,352 个）
- 环境描写（77,929 个）
- 情感心理（71,484 个）
- 人物特征（95,377 个）
- 宫廷政治（59,607 个）
- 军事战争（39,200 个）
- 日常生活（70,110 个）
- 文化典籍（157,378 个）

### 2. 场景匹配
支持 17 种场景类型的自动词汇推荐：
```
战斗 → action_verbs, military
对话 → emotions, character_traits
描写 → environment, character_traits
宫廷 → court_politics, character_traits
战争 → military, action_verbs
日常 → daily_life, emotions
...
```

### 3. 精准推荐
- 根据场景类型推荐相关词汇
- 根据关键词精准匹配
- 自动排序，推荐最相关的词汇

## 🚀 快速开始

### 方式 1：命令行工具

```bash
# 基本用法
python3 scripts/vocabulary_integration.py --chapter 1 --scene 战斗

# 带关键词
python3 scripts/vocabulary_integration.py --chapter 1 --scene 战斗 --keywords 剑 刀 斩

# 追加到文件
python3 scripts/vocabulary_integration.py --file chapter_plan.md --scene 对话
```

### 方式 2：Python API

```python
from scripts.vocabulary_recommender import VocabularyRecommender

# 初始化
recommender = VocabularyRecommender()

# 根据场景推荐
words = recommender.recommend_by_scene("战斗", top_n=50)

# 根据关键词推荐
words = recommender.recommend_by_keywords(["剑", "刀"], top_n=50)

# 格式化输出
formatted = recommender.format_for_ai(words, context="第1章 - 少年觉醒")
print(formatted)
```

### 方式 3：快速演示

```bash
# 运行快速开始脚本
./scripts/vocabulary_quickstart.sh
```

## 📁 文件结构

```
studio/style/vocabulary/
├── vocabulary_index.json          # JSON 索引（48 MB）
├── action_verbs.md                # 动作词汇（5.8 MB）
├── environment.md                 # 环境描写（10 MB）
├── emotions.md                    # 情感心理（9.1 MB）
├── character_traits.md            # 人物特征（12 MB）
├── court_politics.md              # 宫廷政治（9.0 MB）
├── military.md                    # 军事战争（5.7 MB）
├── daily_life.md                  # 日常生活（9.4 MB）
└── cultural.md                    # 文化典籍（16 MB）

scripts/
├── process_vocabulary.py          # 词汇处理脚本
├── vocabulary_recommender.py      # 词汇推荐器
├── vocabulary_integration.py       # 集成工具
└── vocabulary_quickstart.sh       # 快速开始脚本

docs/
└── VOCABULARY_GUIDE.md            # 详细使用指南

studio/agents/
└── writer_enhanced.md             # 增强版 Writer Agent
```

## 💡 使用示例

### 战斗场景

**推荐词汇：**
- 斩（砍断，杀砍杀）
- 凌厉（气势猛烈，锐利）
- 骇然（惊讶的样子）
- 威慑（用武力或威势使对方害怕）

**使用示例：**
```
剑光如霜，凌厉无比，一剑斩下，威慑四方。
敌人骇然失色，难以置信地看着这一剑。
```

### 对话场景

**推荐词汇：**
- 沉思熟虑（深入思考）
- 踌躇满志（自满，得意）
- 义愤填膺（正义感强烈）

**使用示例：**
```
他深思熟虑后道："此事关系重大，需从长计议。"
众人义愤填膺，要求还受害者公道。
```

### 描写场景

**推荐词汇：**
- 暴雨如注（雨下得很大）
- 阳光明媚（天气晴朗）
- 狂风大作（风势猛烈）

**使用示例：**
```
窗外暴雨如注，雷声隆隆，仿佛天要塌下来。
次日清晨，阳光明媚，微风拂面。
```

## 🔄 工作流程

### 在 AI 写作中使用

1. **加载章节计划**
```python
chapter_plan = load_chapter_plan(chapter_number)
scene_type = chapter_plan.get("scene_type", "日常")
keywords = chapter_plan.get("keywords", [])
```

2. **获取词汇推荐**
```python
recommender = VocabularyRecommender()
words = recommender.recommend_by_scene(scene_type, keywords, top_n=50)
```

3. **格式化为 AI 提示**
```python
vocabulary_reference = recommender.format_for_ai(
    words,
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

## 📝 使用建议

### 词汇选择原则

1. **适度使用**
   - 每个场景推荐 5-10 个关键词汇
   - 不要在一段中密集使用高级词汇
   - 优先选择与场景高度相关的词汇

2. **自然融入**
   - 确保词汇符合人物说话习惯
   - 环境词汇要与场景氛围相符
   - 避免文白夹杂，保持文风统一

3. **语境适配**
   - 理解词汇的准确含义
   - 检查词汇是否适合当前时代背景
   - 考虑人物身份是否适合使用该词汇

### 避免滥用

1. **不要堆砌**
   - 避免为用词而用词
   - 确保每个词汇都有明确的表达目的
   - 保持文风一致性

2. **符合人设**
   - 不同人物使用不同的词汇风格
   - 确保词汇符合人物身份和教育背景
   - 保持人物语言的一致性

## 📊 性能说明

- **首次加载**：JSON 索引文件较大（48 MB），首次加载需要几秒钟
- **推荐速度**：基于内存查询，推荐速度极快（毫秒级）
- **缓存机制**：建议使用单例模式，避免重复加载

## 🔧 维护说明

### 重新生成词汇库

如果 ci.csv 有更新，可以重新生成：

```bash
# 重新处理词汇
python3 scripts/process_vocabulary.py

# 验证生成结果
./scripts/vocabulary_quickstart.sh
```

### 扩展词汇分类

编辑 `scripts/process_vocabulary.py`，修改 `CATEGORY_KEYWORDS` 和 `SCENE_TYPE_MAPPING`：

```python
CATEGORY_KEYWORDS = {
    "new_category": {
        "keywords": ["词1", "词2", "词3"],
        # ...
    }
}
```

## 📚 相关文档

- **详细使用指南**：[docs/VOCABULARY_GUIDE.md](docs/VOCABULARY_GUIDE.md)
- **Writer Agent**：[studio/agents/writer_enhanced.md](studio/agents/writer_enhanced.md)
- **原词汇库**：[ci.csv](ci.csv)

## 🎓 进阶功能

### 场景自动分析

```python
# 分析章节文本，自动识别场景类型
main_scene, keywords = recommender.analyze_chapter_context(chapter_text)

# 根据分析结果推荐词汇
words = recommender.recommend_by_scene(main_scene, keywords, top_n=50)
```

### 批量处理

```python
# 一次加载，多次使用
recommender = VocabularyRecommender()

# 处理多个章节
for chapter in chapters:
    words = recommender.recommend_by_scene(chapter.scene_type)
    # ...
```

## 🆘 常见问题

**Q: 词汇太多，如何选择？**
A: 优先选择前 10 个推荐词汇，这些通常是相关性最高的。

**Q: 如何确保词汇使用自然？**
A: 在写作时不要刻意使用，而是参考词汇的表达方式，用自己的话重新组织。

**Q: 某些词汇太生僻，怎么办？**
A: 选择常见的词汇，生僻词汇可以偶尔使用增加文采，但不要过多。

**Q: 如何避免词汇堆砌？**
A: 每个章节使用 5-10 个推荐词汇即可，确保每个词汇都有明确的表达目的。

## 📅 更新日志

### 2026-03-04
- ✅ 初始版本发布
- ✅ 解析 ci.csv，处理 264,406 个词汇
- ✅ 创建 8 个分类文件
- ✅ 构建 JSON 索引
- ✅ 实现智能词汇推荐算法
- ✅ 集成到 Writer Agent
- ✅ 创建使用文档和示例

## 📄 许可证

本系统基于 ci.csv 词汇库构建，用于 AI 小说创作辅助。

---

*最后更新：2026-03-04*
