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
