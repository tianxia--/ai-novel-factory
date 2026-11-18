#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自动化词汇推荐集成工具
在章节生成时自动加载词汇推荐
"""

import json
import sys
from pathlib import Path

# 添加脚本目录到路径
SCRIPT_DIR = Path(__file__).parent
VOCAB_RECOMMENDER = SCRIPT_DIR / "vocabulary_recommender.py"

# 导入词汇推荐器
sys.path.insert(0, str(SCRIPT_DIR))
from vocabulary_recommender import VocabularyRecommender

class VocabularyIntegration:
    """词汇集成器"""

    def __init__(self):
        self.recommender = VocabularyRecommender()

    def get_vocabulary_for_chapter(self, chapter_plan):
        """
        根据章节计划获取推荐词汇

        Args:
            chapter_plan: 章节计划字典

        Returns:
            格式化的词汇参考 Markdown 文本
        """
        # 获取场景类型
        scene_type = chapter_plan.get("scene_type", "日常")
        keywords = chapter_plan.get("keywords", [])
        chapter_title = chapter_plan.get("title", "")
        chapter_number = chapter_plan.get("number", "")

        # 获取推荐词汇
        if keywords:
            words = self.recommender.recommend_by_keywords(keywords, top_n=50)
        else:
            words = self.recommender.recommend_by_scene(scene_type, top_n=50)

        # 格式化输出
        context = f"第{chapter_number}章 - {chapter_title}"
        vocabulary_reference = self.recommender.format_for_ai(words, context)

        return vocabulary_reference

    def append_to_chapter_plan(self, chapter_plan_path, vocabulary_reference):
        """
        将词汇推荐追加到章节计划文件

        Args:
            chapter_plan_path: 章节计划文件路径
            vocabulary_reference: 词汇参考文本
        """
        chapter_plan_path = Path(chapter_plan_path)

        if not chapter_plan_path.exists():
            print(f"错误：章节计划文件不存在: {chapter_plan_path}")
            return False

        # 读取章节计划
        with open(chapter_plan_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 追加词汇推荐
        updated_content = content + "\n\n" + "=" * 80 + "\n\n"
        updated_content += "# 词汇推荐参考\n\n"
        updated_content += "> 根据本章场景自动生成的词汇推荐\n\n"
        updated_content += "---\n\n"
        updated_content += vocabulary_reference

        # 写回文件
        with open(chapter_plan_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)

        print(f"已将词汇推荐追加到: {chapter_plan_path}")
        return True

def main():
    """主函数 - 演示如何使用"""
    import argparse

    parser = argparse.ArgumentParser(description="词汇推荐集成工具")
    parser.add_argument("--chapter", type=int, help="章节编号")
    parser.add_argument("--scene", type=str, help="场景类型")
    parser.add_argument("--keywords", type=str, nargs="+", help="关键词")
    parser.add_argument("--file", type=str, help="章节计划文件路径")

    args = parser.parse_args()

    integration = VocabularyIntegration()

    # 方式1：根据章节编号和场景类型获取词汇
    if args.chapter and args.scene:
        chapter_plan = {
            "number": args.chapter,
            "title": "示例章节",
            "scene_type": args.scene,
            "keywords": args.keywords or []
        }

        vocabulary_reference = integration.get_vocabulary_for_chapter(chapter_plan)
        print("\n" + "=" * 80)
        print(vocabulary_reference[:2000])
        print("\n" + "=" * 80)

    # 方式2：从章节计划文件读取并生成词汇推荐
    elif args.file:
        # 读取章节计划文件
        try:
            with open(args.file, 'r', encoding='utf-8') as f:
                # 这里简化处理，实际应该解析 JSON 或 Markdown
                chapter_plan = {
                    "number": "1",
                    "title": "示例",
                    "scene_type": args.scene or "日常",
                    "keywords": args.keywords or []
                }

            vocabulary_reference = integration.get_vocabulary_for_chapter(chapter_plan)

            # 追加到文件
            integration.append_to_chapter_plan(args.file, vocabulary_reference)

        except Exception as e:
            print(f"错误：处理文件失败 - {e}")

    else:
        print("使用说明：")
        print("  --chapter N      章节编号")
        print("  --scene TYPE     场景类型（战斗、对话、描写等）")
        print("  --keywords K1 K2 关键词列表")
        print("  --file PATH      章节计划文件路径")
        print("\n示例：")
        print('  python vocabulary_integration.py --chapter 1 --scene 战斗 --keywords 剑 刀')
        print('  python vocabulary_integration.py --file chapter_plan_1.md --scene 战斗')

if __name__ == "__main__":
    main()
