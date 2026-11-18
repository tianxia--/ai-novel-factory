#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
词汇数据处理脚本
从 ci.csv 解析词汇并智能分类
"""

import csv
import json
import re
from pathlib import Path
from collections import defaultdict

# 基础目录
BASE_DIR = Path(__file__).parent.parent / "studio" / "style"
VOCAB_DIR = BASE_DIR / "vocabulary"

# 创建词汇目录
VOCAB_DIR.mkdir(exist_ok=True)

# 词汇分类关键词映射
CATEGORY_KEYWORDS = {
    "action_verbs": {
        "verbs": ["跑", "走", "跳", "飞", "打", "杀", "攻", "守", "进", "退",
                 "动", "持", "持", "握", "拔", "推", "拉", "投", "射", "追",
                 "逃", "躲", "袭", "击", "斩", "刺", "舞", "驰", "奔", "行",
                 "步", "进", "退", "转", "翻", "跃", "扑", "闪", "移", "攀"],
        "actions": ["打斗", "追击", "逃跑", "躲避", "攻击", "防守", "冲锋", "撤退"]
    },
    "environment": {
        "nature": ["山", "水", "天", "地", "风", "雨", "雪", "雷", "云", "雾",
                  "日", "月", "星", "辰", "林", "木", "花", "草", "树", "叶",
                  "河", "海", "江", "湖", "泉", "溪", "峰", "岭", "崖", "谷"],
        "weather": ["风", "雨", "雪", "雷", "电", "雾", "霾", "霜", "露", "晴",
                   "阴", "暴", "烈", "狂", "骤"],
        "building": ["宫", "殿", "楼", "阁", "亭", "台", "轩", "榭", "门", "墙",
                    "城", "阙", "廷", "院", "堂", "室", "房", "殿", "阙"],
        "scene": ["景", "色", "光", "影", "声", "响", "烟", "尘", "雾", "岚"]
    },
    "emotions": {
        "feelings": ["喜", "怒", "哀", "乐", "愁", "忧", "悲", "恐", "惊", "惧",
                    "爱", "恨", "怨", "愤", "嫉", "羡", "慕", "怜", "惜", "叹"],
        "mental": ["思", "想", "念", "念", "怀", "忆", "忘", "悟", "解", "知",
                 "觉", "感", "情", "意", "志", "愿", "欲", "求", "盼", "望"],
        "expression": ["眉", "目", "色", "颜", "面", "容", "神", "态", "笑", "哭",
                      "泣", "啸", "喊", "叫", "呼", "喝", "骂", "咒", "语", "言"]
    },
    "character_traits": {
        "appearance": ["眉", "目", "眼", "鼻", "口", "唇", "耳", "发", "鬓", "面",
                      "颜", "容", "姿", "态", "貌", "形", "影", "身", "躯", "体"],
        "personality": ["贤", "圣", "智", "勇", "仁", "义", "礼", "信", "忠", "孝",
                      "廉", "耻", "傲", "谦", "恭", "敬", "慈", "善", "恶", "毒",
                      "奸", "猾", "狡", "诈", "愚", "痴", "笨", "傻", "慧", "智"],
        "identity": ["王", "皇", "帝", "君", "臣", "相", "将", "兵", "民", "士",
                     "侯", "伯", "子", "男", "公", "卿", "大夫", "长", "尊", "卑"]
    },
    "court_politics": {
        "imperial": ["帝", "皇", "君", "王", "后", "妃", "太子", "公主", "御", "宸",
                    "圣", "诏", "旨", "敕", "命", "令", "谕", "宣", "册", "封"],
        "official": ["官", "员", "职", "位", "爵", "秩", "俸", "禄", "权", "势",
                    "政", "治", "朝", "廷", "阙", "廷", "官署", "衙门"],
        "ritual": ["礼", "仪", "制", "度", "典", "章", "法", "规", "矩", "范",
                 "祭祀", "朝贺", "觐见", "册封", "朝拜"]
    },
    "military": {
        "weapons": ["剑", "刀", "枪", "戟", "斧", "钺", "戈", "矛", "弓", "箭",
                   "矢", "弩", "盾", "甲", "胄", "兵", "器", "械"],
        "tactics": ["战", "攻", "守", "冲", "突", "袭", "伏", "围", "追", "撤",
                   "阵", "营", "垒", "塞", "堡", "关", "隘", "略", "策", "谋"],
        "actions": ["战", "斗", "打", "杀", "伐", "征", "讨", "剿", "平", "定"]
    },
    "daily_life": {
        "food": ["饭", "餐", "食", "饮", "酒", "茶", "菜", "肴", "肉", "鱼",
                "鸡", "鸭", "鹅", "蛋", "米", "面", "粮", "蔬", "果", "甜"],
        "clothing": ["衣", "裳", "服", "装", "袍", "褂", "裙", "带", "巾", "履",
                   "鞋", "袜", "帽", "冠", "簪", "钗", "佩", "饰", "锦", "绸"],
        "items": ["器", "物", "具", "用品", "家", "器皿", "碗", "杯", "盘", "碟",
                 "床", "榻", "案", "几", "桌", "椅", "凳", "箱", "柜", "盒"],
        "daily": ["晨", "昏", "昼", "夜", "睡", "醒", "起", "卧", "食", "饮",
                "行", "走", "坐", "立", "住", "行", "居", "宿"]
    },
    "cultural": {
        "idioms": ["之", "不", "无", "有", "为", "所", "其", "而", "者", "也"],
        "classics": ["经", "史", "子", "集", "诗", "书", "礼", "易", "春秋"],
        "allusions": ["喻", "喻", "比", "拟", "喻", "典故", "传说"]
    }
}

# 分类标题映射
CATEGORY_TITLES = {
    "action_verbs": "动作词汇",
    "environment": "环境描写",
    "emotions": "情感心理",
    "character_traits": "人物特征",
    "court_politics": "宫廷政治",
    "military": "军事战争",
    "daily_life": "日常生活",
    "cultural": "文化典籍"
}

# 词汇数据库结构
vocabulary_db = {
    "metadata": {
        "total_words": 0,
        "categories": list(CATEGORY_KEYWORDS.keys()),
        "created_at": "",
        "source": "ci.csv"
    },
    "vocabulary": defaultdict(list)
}

def classify_word(word, definition):
    """
    智能分类词汇
    """
    matched_categories = []

    for category, keywords in CATEGORY_KEYWORDS.items():
        for subcategory, keyword_list in keywords.items():
            for keyword in keyword_list:
                if keyword in word or keyword in definition:
                    matched_categories.append(category)
                    break
            if category in matched_categories:
                break

    # 如果没有匹配，根据词性进行基本分类
    if not matched_categories:
        # 常见动词结尾
        if word.endswith(("动", "行", "走", "跑", "跳", "飞", "击", "攻", "守")):
            matched_categories.append("action_verbs")
        # 常见情感词汇
        elif word.endswith(("情", "感", "思", "念", "意", "心", "怀")):
            matched_categories.append("emotions")
        # 常见环境词汇
        elif word.endswith(("景", "色", "光", "影", "风", "雨", "云", "雾")):
            matched_categories.append("environment")
        # 常见人物特征
        elif word.endswith(("貌", "颜", "容", "姿", "态", "性", "品", "格")):
            matched_categories.append("character_traits")
        else:
            # 默认归入文化典籍
            matched_categories.append("cultural")

    return matched_categories

def parse_csv(csv_path):
    """
    解析 CSV 文件
    """
    print(f"正在解析 CSV 文件: {csv_path}")

    word_count = 0

    # 尝试多种编码
    encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'big5']
    f = None

    for encoding in encodings:
        try:
            f = open(csv_path, 'r', encoding=encoding, errors='replace')
            print(f"使用编码: {encoding} (errors='replace')")
            break
        except Exception as e:
            print(f"尝试编码 {encoding} 失败: {e}")
            if f:
                f.close()
            continue

    if not f:
        print("错误：无法解码文件，尝试了所有常见编码")
        return

    reader = csv.reader(f)
    for row in reader:
        if len(row) >= 2:
            word = row[0].strip()
            definition = row[1].strip()

            if word and definition:
                # 智能分类
                categories = classify_word(word, definition)

                # 去重
                categories = list(set(categories))

                # 添加到数据库
                vocab_item = {
                    "word": word,
                    "definition": definition,
                    "categories": categories
                }

                vocabulary_db["vocabulary"][word] = vocab_item
                word_count += 1

                if word_count % 10000 == 0:
                    print(f"已处理 {word_count} 个词汇...")

    vocabulary_db["metadata"]["total_words"] = word_count
    print(f"解析完成！共处理 {word_count} 个词汇")

    f.close()

def generate_category_files():
    """
    生成分类文件
    """
    print("正在生成分类文件...")

    # 为每个分类生成 Markdown 文件
    for category, title in CATEGORY_TITLES.items():
        output_path = VOCAB_DIR / f"{category}.md"

        with open(output_path, 'w', encoding='utf-8') as f:
            # 写入标题
            f.write(f"# {title}\n\n")
            f.write(f"> {title}词汇库，为小说创作提供丰富的表达参考\n\n")
            f.write("---\n\n")

            # 收集该分类的所有词汇
            category_words = []
            for word, vocab in vocabulary_db["vocabulary"].items():
                if category in vocab["categories"]:
                    category_words.append((word, vocab["definition"]))

            # 按拼音排序
            category_words.sort(key=lambda x: x[0])

            # 写入词汇表
            for word, definition in category_words:
                # 清理定义（去除编号和换行）
                clean_def = re.sub(r'^\d+\.?', '', definition)
                clean_def = clean_def.replace('\n', ' ').strip()

                f.write(f"## {word}\n\n")
                f.write(f"**释义**：{clean_def}\n\n")

            print(f"已生成 {title} 文件，包含 {len(category_words)} 个词汇")

    # 生成索引文件
    generate_index_file()

def generate_index_file():
    """
    生成 JSON 索引文件
    """
    print("正在生成索引文件...")

    index_path = VOCAB_DIR / "vocabulary_index.json"

    # 准备索引数据
    index_data = {
        "metadata": vocabulary_db["metadata"],
        "categories": {},
        "word_index": {}
    }

    # 按分类统计
    for category, title in CATEGORY_TITLES.items():
        count = sum(1 for vocab in vocabulary_db["vocabulary"].values()
                   if category in vocab["categories"])
        index_data["categories"][category] = {
            "title": title,
            "count": count
        }

    # 词汇索引（按拼音首字母）
    for word, vocab in vocabulary_db["vocabulary"].items():
        if word:
            # 获取拼音首字母（简化处理）
            first_char = word[0] if word else "#"
            index_data["word_index"][word] = {
                "definition": vocab["definition"],
                "categories": vocab["categories"]
            }

    # 写入 JSON
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)

    print(f"索引文件已生成: {index_path}")

def main():
    """
    主函数
    """
    import datetime

    # 设置创建时间
    vocabulary_db["metadata"]["created_at"] = datetime.datetime.now().isoformat()

    # CSV 文件路径
    csv_path = Path(__file__).parent.parent / "ci.csv"

    # 检查文件是否存在
    if not csv_path.exists():
        print(f"错误：CSV 文件不存在: {csv_path}")
        return

    # 解析 CSV
    parse_csv(csv_path)

    # 生成分类文件
    generate_category_files()

    # 生成索引
    generate_index_file()

    print("\n处理完成！")
    print(f"总词汇数：{vocabulary_db['metadata']['total_words']}")
    print(f"输出目录：{VOCAB_DIR}")

if __name__ == "__main__":
    main()
