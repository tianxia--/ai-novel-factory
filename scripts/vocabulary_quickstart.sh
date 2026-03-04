#!/bin/bash

# 词汇推荐系统 - 快速开始演示

echo "=========================================="
echo "   词汇推荐系统 - 快速开始演示"
echo "=========================================="
echo ""

# 1. 检查词汇数据库
echo "【步骤 1】检查词汇数据库..."
if [ -f "studio/style/vocabulary/vocabulary_index.json" ]; then
    echo "✓ 词汇数据库已存在"
    echo "  位置: studio/style/vocabulary/vocabulary_index.json"
else
    echo "✗ 词汇数据库不存在，需要先生成"
    echo "  请运行: python3 scripts/process_vocabulary.py"
    exit 1
fi
echo ""

# 2. 测试词汇推荐
echo "【步骤 2】测试词汇推荐功能..."
echo ""
echo "场景 1：战斗场景"
echo "----------------------------------------"
python3 scripts/vocabulary_integration.py --chapter 1 --scene 战斗 --keywords 剑 斩 杀 2>&1 | grep -A 20 "推荐词汇参考"
echo ""
echo "场景 2：宫廷场景"
echo "----------------------------------------"
python3 scripts/vocabulary_integration.py --chapter 2 --scene 宫廷 --keywords 王 朝 廷 2>&1 | grep -A 20 "推荐词汇参考"
echo ""

# 3. 显示文件结构
echo "【步骤 3】显示生成的文件结构..."
echo ""
ls -lh studio/style/vocabulary/
echo ""

# 4. 显示分类统计
echo "【步骤 4】显示词汇分类统计..."
echo ""
python3 -c "
import json
from pathlib import Path

index_file = Path('studio/style/vocabulary/vocabulary_index.json')
with open(index_file, 'r', encoding='utf-8') as f:
    index = json.load(f)

print(f'总词汇数: {index[\"metadata\"][\"total_words\"]:,}')
print()
print('各分类词汇数:')
print('-' * 40)
for cat_id, cat_info in index['categories'].items():
    print(f'  {cat_info[\"title\"]:12s} {cat_info[\"count\"]:7,} 个')
"
echo ""

# 5. 使用说明
echo "=========================================="
echo "   使用说明"
echo "=========================================="
echo ""
echo "1. 基本用法"
echo "   python3 scripts/vocabulary_integration.py --chapter 1 --scene 战斗"
echo ""
echo "2. 带关键词"
echo "   python3 scripts/vocabulary_integration.py --chapter 1 --scene 战斗 --keywords 剑 刀"
echo ""
echo "3. 追加到文件"
echo "   python3 scripts/vocabulary_integration.py --file chapter_plan.md --scene 对话"
echo ""
echo "4. Python API"
echo "   from scripts.vocabulary_recommender import VocabularyRecommender"
echo "   recommender = VocabularyRecommender()"
echo "   words = recommender.recommend_by_scene('战斗', top_n=50)"
echo ""
echo "=========================================="
echo "   更多信息请查看: docs/VOCABULARY_GUIDE.md"
echo "=========================================="
