#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能词汇推荐工具
根据小说场景自动推荐合适的词汇
"""

import json
import re
from pathlib import Path
from collections import defaultdict

# 基础目录
BASE_DIR = Path(__file__).parent.parent / "studio" / "style"
VOCAB_DIR = BASE_DIR / "vocabulary"
INDEX_FILE = VOCAB_DIR / "vocabulary_index.json"

# 场景类型映射
SCENE_TYPE_MAPPING = {
    "战斗": ["action_verbs", "military"],
    "冲突": ["action_verbs", "emotions"],
    "对话": ["emotions", "character_traits"],
    "描写": ["environment", "character_traits"],
    "宫廷": ["court_politics", "character_traits"],
    "战争": ["military", "action_verbs"],
    "日常": ["daily_life", "emotions"],
    "自然环境": ["environment", "cultural"],
    "心理活动": ["emotions"],
    "人物刻画": ["character_traits", "emotions"],
    "仪式庆典": ["court_politics", "cultural"],
    "训练修炼": ["action_verbs", "daily_life"],
    "探索冒险": ["action_verbs", "environment"],
    "权谋算计": ["court_politics", "emotions"],
    "感情戏": ["emotions", "character_traits"],
    "动作场面": ["action_verbs", "military"],
    "环境渲染": ["environment", "cultural"],
    "历史叙事": ["cultural", "court_politics"]
}

class VocabularyRecommender:
    """词汇推荐器"""

    def __init__(self):
        self.vocabulary_db = None
        self.index = None
        self.load_vocabulary()

    def load_vocabulary(self):
        """加载词汇数据库"""
        try:
            with open(INDEX_FILE, 'r', encoding='utf-8') as f:
                self.index = json.load(f)
            print(f"成功加载词汇数据库，共 {self.index['metadata']['total_words']} 个词汇")
        except FileNotFoundError:
            print(f"错误：词汇索引文件不存在: {INDEX_FILE}")
            self.index = None

    def recommend_by_scene(self, scene_type, keywords=None, top_n=50):
        """
        根据场景类型推荐词汇

        Args:
            scene_type: 场景类型（战斗、对话、描写等）
            keywords: 关键词列表，用于进一步筛选
            top_n: 返回推荐词汇的数量

        Returns:
            推荐词汇列表
        """
        if not self.index:
            return []

        # 获取场景类型对应的分类
        categories = SCENE_TYPE_MAPPING.get(scene_type, ["cultural"])

        # 收集相关词汇
        word_list = []

        for word, word_data in self.index["word_index"].items():
            # 检查是否属于目标分类
            if any(cat in word_data.get("categories", []) for cat in categories):
                word_list.append({
                    "word": word,
                    "definition": word_data.get("definition", ""),
                    "categories": word_data.get("categories", [])
                })

        # 根据关键词进一步筛选
        if keywords:
            filtered_words = []
            for word_data in word_list:
                # 检查词汇或释义中是否包含关键词
                for keyword in keywords:
                    if keyword in word_data["word"] or keyword in word_data["definition"]:
                        filtered_words.append(word_data)
                        break
            word_list = filtered_words

        # 返回前 top_n 个词汇
        return word_list[:top_n]

    def recommend_by_keywords(self, keywords, top_n=50):
        """
        根据关键词推荐词汇

        Args:
            keywords: 关键词列表
            top_n: 返回推荐词汇的数量

        Returns:
            推荐词汇列表
        """
        if not self.index:
            return []

        word_list = []

        for word, word_data in self.index["word_index"].items():
            # 检查词汇或释义中是否包含任意一个关键词
            for keyword in keywords:
                if keyword in word or keyword in word_data.get("definition", ""):
                    word_list.append({
                        "word": word,
                        "definition": word_data.get("definition", ""),
                        "categories": word_data.get("categories", [])
                    })
                    break

        # 返回前 top_n 个词汇
        return word_list[:top_n]

    def get_category_words(self, category, limit=100):
        """
        获取指定分类的词汇

        Args:
            category: 分类名称
            limit: 返回数量限制

        Returns:
            词汇列表
        """
        if not self.index:
            return []

        word_list = []

        for word, word_data in self.index["word_index"].items():
            if category in word_data.get("categories", []):
                word_list.append({
                    "word": word,
                    "definition": word_data.get("definition", ""),
                    "categories": word_data.get("categories", [])
                })

                if len(word_list) >= limit:
                    break

        return word_list

    def format_for_ai(self, word_list, context=""):
        """
        格式化词汇列表供 AI 使用

        Args:
            word_list: 词汇列表
            context: 上下文描述

        Returns:
            格式化的 Markdown 文本
        """
        if not word_list:
            return "未找到相关词汇"

        output = f"# 推荐词汇参考\n\n"
        output += f"> 上下文：{context}\n\n"
        output += "---\n\n"

        for word_data in word_list:
            word = word_data["word"]
            definition = word_data["definition"]

            # 清理定义
            clean_def = re.sub(r'^\d+\.?', '', definition)
            clean_def = clean_def.replace('\n', ' ').strip()

            output += f"## {word}\n\n"
            output += f"**释义**：{clean_def}\n\n"

        return output

    def check_idiom_relevance(self, idiom, context_text):
        """
        检查成语与上下文的关联性

        Args:
            idiom: 成语
            context_text: 上下文文本

        Returns:
            (是否关联, 关联原因, 关联度0-1)
        """
        # 简化的关联性检查
        if not self.index or not self.index.get("word_index"):
            return False, "词汇数据库未加载", 0.0

        idiom_data = self.index["word_index"].get(idiom, {})
        definition = idiom_data.get("definition", "")

        # 检查成语释义中的关键词是否在上下文中
        relevance_keywords = []
        if "战" in definition or "斗" in definition or "攻" in definition or "守" in definition:
            relevance_keywords.extend(["战", "斗", "打", "攻", "守", "兵", "军"])
        if "情" in definition or "感" in definition or "思" in definition or "想" in definition:
            relevance_keywords.extend(["情", "感", "思", "想", "心", "意"])
        if "景" in definition or "色" in definition or "光" in definition or "影" in definition:
            relevance_keywords.extend(["景", "色", "光", "影", "天", "地"])
        if "人" in definition or "言" in definition or "语" in definition or "行" in definition:
            relevance_keywords.extend(["人", "说", "道", "言", "行", "走"])

        # 计算关联度
        relevance_count = sum(1 for keyword in relevance_keywords if keyword in context_text)
        relevance_score = min(relevance_count / 3.0, 1.0) if relevance_keywords else 0

        if relevance_score > 0.5:
            return True, f"成语含义与上下文内容高度匹配（关联度：{relevance_score:.2f}）", relevance_score
        elif relevance_score > 0.2:
            return True, f"成语含义与上下文内容有一定关联（关联度：{relevance_score:.2f}）", relevance_score
        else:
            return False, f"成语含义与上下文内容关联度低（关联度：{relevance_score:.2f}）", relevance_score

    def recommend_idioms_with_context(self, context_text, scene_type, top_n=10):
        """
        根据上下文和场景推荐成语

        Args:
            context_text: 上下文文本
            scene_type: 场景类型
            top_n: 返回推荐数量

        Returns:
            [(成语, 定义, 是否关联, 关联原因, 关联度), ...]
        """
        if not self.index:
            return []

        # 获取场景对应的分类
        categories = SCENE_TYPE_MAPPING.get(scene_type, ["cultural"])

        # 收集成语（定义为4个字以上的词汇）
        idioms = []
        for word, word_data in self.index["word_index"].items():
            # 检查是否是成语（4个字以上）
            if len(word) >= 4:
                # 检查是否属于目标分类
                if any(cat in word_data.get("categories", []) for cat in categories):
                    idioms.append(word)

        # 检查每个成语与上下文的关联性
        idiom_relevance = []
        for idiom in idioms[:50]:  # 限制检查数量
            is_relevant, reason, score = self.check_idiom_relevance(idiom, context_text)
            idiom_relevance.append((idiom, is_relevant, reason, score))

        # 按关联度排序
        idiom_relevance.sort(key=lambda x: x[3], reverse=True)

        # 返回结果
        results = []
        for idiom, is_relevant, reason, score in idiom_relevance[:top_n]:
            idiom_data = self.index["word_index"][idiom]
            definition = idiom_data.get("definition", "")
            results.append((idiom, definition, is_relevant, reason, score))

        return results

    def generate_vocabulary_prompt(self, scene_type, context_text=""):
        """
        生成词汇推荐提示

        Args:
            scene_type: 场景类型
            context_text: 上下文文本

        Returns:
            Markdown 格式的提示文本
        """
        prompt = f"""## 📚 {scene_type}场景 - 词汇使用指南

### ⚠️ 核心原则：成语必须与文本关联

**成语使用的"三要三不要"：**

**三要：**
1. ✅ 要有前文铺垫
2. ✅ 要有逻辑关联
3. ✅ 要符合场景氛围

**三不要：**
1. ❌ 不要孤零零地使用
2. ❌ 不要堆砌叠加
3. ❌ 不要强行植入

### 📊 词汇使用金字塔

- 基础词汇: 50% - 保证可读性
- 进阶词汇: 30% - 丰富表达
- 高级词汇: 15% - 提升文采
- 稀有/成语: 5% - 点睛之笔

### 🎯 成语使用策略

**什么时候可以用成语？**
1. 有具体的内容描写在前（铺垫）
2. 成语与上下文有直接的逻辑关联
3. 成语起到总结、对比、强调的作用

**什么时候不要用成语？**
1. 孤零零的成语，没有前文铺垫
2. 成语与上下文内容无直接关联
3. 为了展示文采而强行使用

### 💡 写作检查清单

- [ ] 这段话有没有孤零零的成语？
- [ ] 成语是否与上下文有逻辑关联？
- [ ] 去掉成语后，句意是否完整？
- [ ] 是否为了用成语而用成语？

### 📝 推荐词汇（按使用优先级）

---

"""

        # 添加词汇推荐
        words = self.recommend_by_scene(scene_type, top_n=20)

        # 分类推荐
        level_1 = words[:10]  # 基础词汇
        level_2 = words[10:15]  # 进阶词汇
        level_3 = words[15:18]  # 高级词汇
        level_4 = words[18:20]  # 稀有/成语

        # 如果有上下文，推荐关联的成语
        if context_text:
            prompt += "### 🔍 成语关联性检查（基于当前上下文）\n\n"
            idioms = self.recommend_idioms_with_context(context_text, scene_type, top_n=5)

            if idioms:
                for idiom, definition, is_relevant, reason, score in idioms:
                    status = "✅ 推荐使用" if is_relevant else "⚠️  不推荐使用"
                    prompt += f"- **{idiom}**: {definition}\n"
                    prompt += f"  - 状态: {status}\n"
                    prompt += f"  - 关联度: {score:.2f}\n"
                    prompt += f"  - 原因: {reason}\n\n"
            else:
                prompt += "未找到高度相关的成语，建议使用基础词汇表达。\n\n"

            prompt += "---\n\n"

        # 添加按等级推荐的词汇
        prompt += "#### 基础词汇 (10个) - 优先使用\n"
        for word_data in level_1:
            word = word_data["word"]
            definition = word_data["definition"].split("\n")[0][:50]
            prompt += f"- {word}: {definition}\n"

        prompt += "\n#### 进阶词汇 (5个) - 适当使用\n"
        for word_data in level_2:
            word = word_data["word"]
            definition = word_data["definition"].split("\n")[0][:50]
            prompt += f"- {word}: {definition}\n"

        prompt += "\n#### 高级词汇 (3个) - 谨慎使用\n"
        for word_data in level_3:
            word = word_data["word"]
            definition = word_data["definition"].split("\n")[0][:50]
            prompt += f"- {word}: {definition}\n"

        prompt += "\n#### 稀有/成语 (2个) - 慎重使用\n"
        for word_data in level_4:
            word = word_data["word"]
            definition = word_data["definition"].split("\n")[0][:50]
            prompt += f"- {word}: {definition}\n"

        prompt += """

---

### 🎯 写作建议

1. **优先使用基础词汇**，保证文章流畅自然
2. **进阶词汇穿插使用**，丰富表达层次
3. **高级词汇谨慎使用**，确保不破坏文风
4. **成语慎重考虑**，确保与上下文有明确关联
5. **不要堆砌成语**，每段最多1个成语，每章不超过5个

### ✅ 优质写作示例

```
基础表达 + 基础词汇 + 进阶词汇 + 偶尔高级词汇 + 少量成语 = 自然流畅
```

**好的示例：**
```
他慢慢走到窗前，看着外面飘落的雪花。雪越下越大，整个城市都被白雪覆盖。
他想起了小时候在老家玩雪的日子，那时候真是无忧无虑。
                                          （成语在结尾，起到总结和升华作用，与前文内容有明确关联）
```

**不好的示例：**
```
他踱步至窗前，看着外面飘落的鹅毛大雪，真是瑞雪兆丰年啊。
 （成语"瑞雪兆丰年"与前面的描述没有直接关联，显得突兀）
```
"""

        return prompt

    def analyze_chapter_context(self, chapter_text):
        """
        分析章节文本，提取场景类型和关键词

        Args:
            chapter_text: 章节文本

        Returns:
            场景类型和关键词
        """
        # 简单的关键词提取
        scene_keywords = {
            "战斗": ["打", "杀", "攻", "守", "战", "斗", "剑", "刀", "枪", "兵器"],
            "对话": ["说", "道", "问", "答", "说", "道", "言", "语"],
            "描写": ["景", "色", "山", "水", "天", "地", "光", "影"],
            "宫廷": ["王", "皇", "帝", "君", "臣", "朝", "廷", "宫", "殿"],
            "战争": ["军", "兵", "征", "伐", "战", "阵", "营"],
            "日常": ["吃", "喝", "住", "行", "睡", "醒", "晨", "昏"],
            "自然环境": ["风", "雨", "雪", "云", "雾", "山", "水", "林"],
            "心理活动": ["思", "想", "念", "情", "感", "心", "意"],
            "人物刻画": ["貌", "颜", "容", "姿", "态", "神", "气"]
        }

        # 统计各场景类型的出现频率
        scene_scores = defaultdict(int)

        for scene_type, keywords in scene_keywords.items():
            for keyword in keywords:
                scene_scores[scene_type] += chapter_text.count(keyword)

        # 找出得分最高的场景类型
        if scene_scores:
            main_scene_type = max(scene_scores.items(), key=lambda x: x[1])[0]
        else:
            main_scene_type = "日常"

        # 提取其他关键词
        all_keywords = []
        for keywords in scene_keywords.values():
            all_keywords.extend(keywords)

        found_keywords = []
        for keyword in all_keywords:
            if keyword in chapter_text:
                found_keywords.append(keyword)

        return main_scene_type, list(set(found_keywords))[:20]

def main():
    """测试词汇推荐功能"""
    recommender = VocabularyRecommender()

    # 测试：根据场景类型推荐
    print("\n=== 测试 1：根据场景类型推荐 ===")
    scene_type = "战斗"
    words = recommender.recommend_by_scene(scene_type, top_n=10)
    print(f"\n场景类型：{scene_type}")
    print(f"推荐词汇数：{len(words)}")

    # 测试：根据关键词推荐
    print("\n=== 测试 2：根据关键词推荐 ===")
    keywords = ["剑", "刀"]
    words = recommender.recommend_by_keywords(keywords, top_n=10)
    print(f"\n关键词：{keywords}")
    print(f"推荐词汇数：{len(words)}")

    # 测试：获取分类词汇
    print("\n=== 测试 3：获取分类词汇 ===")
    category = "action_verbs"
    words = recommender.get_category_words(category, limit=10)
    print(f"\n分类：{category}")
    print(f"词汇数：{len(words)}")

    # 测试：格式化输出
    print("\n=== 测试 4：格式化输出 ===")
    if words:
        formatted = recommender.format_for_ai(words, "战斗场景")
        print(formatted[:500])

if __name__ == "__main__":
    main()
