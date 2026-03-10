# AI Novel Factory v1.6.0 - 更新说明

> 自动化写作风格指南，让 AI 知道如何正确写作

---

## ✨ 新功能

### 1. 🎯 自动创建写作风格指南

**novel-init 初始化时自动创建：**
- ✅ `studio/style/writing_style_guide.md` - 完整的写作风格指南

**写作风格指南包含：**
- 📖 写作风格总原则（可读性优先、层次丰富、自然流畅）
- 🎯 成语使用策略（与角色、场景关联的三维分析）
- 📖 文言文穿插策略（三个层次、比例表、词汇库）
- 🎭 角色差异化写作（按身份、性格、场合）
- 📝 写作流程（写作前、中、后）
- 🎯 写作模板（对话、叙述、文书）
- 💡 快速参考（关键要点、常用错误）

### 2. 🚀 让 AI 遵循写作风格指南写作

**现在你只需要一句话：**

```
写第X章，严格按照 studio/style/writing_style_guide.md 的风格指南执行
```

**AI 会自动：**
- ✅ 读取写作风格指南
- ✅ 分析当前场景和角色
- ✅ 选择合适的文言文比例
- ✅ 选择合适的成语密度
- ✅ 确保成语与上下文关联
- ✅ 保持全文风格统一

### 3. 📚 Vocabulary 自动下载

**novel-init 初始化时自动下载：**
- ✅ Vocabulary（264,406个中文词汇）
- ✅ 8个分类文件
- ✅ vocabulary_index.json（总索引）

### 4. 🔧 新增工具

**novel-download-vocabulary** - 手动下载或更新 Vocabulary
```
使用 opencode-ai-novel-factory 的 novel-download-vocabulary 工具
```

**novel-check-vocabulary** - 查看 Vocabulary 状态
```
使用 opencode-ai-novel-factory 的 novel-check-vocabulary 工具
```

**novel-status** - 查看项目状态（包含 Vocabulary 状态）
```
使用 opencode-ai-novel-factory 的 novel-status 工具
```

---

## 🎯 使用方法

### 第一步：初始化项目

```bash
# 在 OpenCode 中执行
使用 opencode-ai-novel-factory 的 novel-init 工具
```

**自动创建：**
- ✅ studio/style/writing_style_guide.md - 写作风格指南
- ✅ studio/style/vocabulary/ - Vocabulary（264,406个词汇）

---

### 第二步：填写设定文件

需要填写：
1. `studio/story/world.md` - 世界观设定
2. `studio/story/master_outline.md` - 故事大纲
3. `studio/characters/protagonist.md` - 主角设定

---

### 第三步：让 AI 遵循指南写作

**方式A：简短指令（推荐）**
```
写第X章，严格按照 studio/style/writing_style_guide.md 的风格指南执行
```

**方式B：详细指令**
```
写第X章，请按照以下要求执行：

1. 严格按照 studio/style/writing_style_guide.md 的风格指南
2. 根据当前场景选择合适的文言文比例
3. 根据角色身份选择成语使用策略
4. 确保成语与上下文有明确关联
5. 保持全文风格统一
6. 确保文章流畅自然，可读性强

当前场景：[描述场景]
主要角色：[描述角色]
```

---

## 📖 写作风格指南速查

### 成语使用密度

| 场合 | 成语密度 | 每段 | 每章 |
|------|---------|------|------|
| 正式奏章 | 高 | 2-3个 | 10-15个 |
| 正式对话 | 中 | 1-2个 | 5-8个 |
| 随意对话 | 低 | 0-1个 | 2-4个 |
| 战场指挥 | 低 | 1个 | 3-5个 |
| 私下交谈 | 低 | 0-1个 | 2-3个 |

### 文言文使用比例

| 文本类型 | 现代文 | 文言 | 适用场景 |
|---------|-------|------|---------|
| 普通叙述 | 80% | 20% | 日常叙述 |
| 对话（非正式）| 95% | 5% | 朋友聊天 |
| 对话（正式）| 60% | 40% | 官员交流 |
| 奏章文书 | 20% | 80% | 正式文书 |
| 古书信 | 30% | 70% | 文人书信 |
| 史书叙述 | 40% | 60% | 史书记载 |

### 角色差异

**文人/官员：**
- 文言：30-40%
- 成语：中等到高
- 风格：文雅、含蓄

**武将/粗人：**
- 文言：5-10%
- 成语：低
- 风格：直白、有力

**平民/百姓：**
- 文言：0-5%
- 成语：几乎不用
- 风格：日常、朴素

---

## 💡 最佳实践

### 技巧1：简短指令优先

```
✅ 写第X章，严格按照 studio/style/writing_style_guide.md 的风格指南执行

❌ 请帮我写第X章，注意不要用太多成语，文言文要适度，要符合角色身份
```

### 技巧2：明确场景和角色

```
✅ 写第X章，严格按照写作风格指南执行。
当前场景：朝堂，主要角色：李大人（文臣）

❌ 写第X章
```

### 技巧3：分步写作

```
步骤1：先用基础词汇写出内容
步骤2：根据角色和场景调整词汇
步骤3：在关键处使用成语

请逐一步骤执行，完成后告诉我进入下一步
```

---

## 🎯 常用场景模板

### 场景1：朝堂对话

```
写一段朝堂对话，角色是李大人（文臣）和皇帝。

严格按照 studio/style/writing_style_guide.md 执行：
- 李大人使用30-40%文言文
- 使用文雅成语，但要有关联
- 表达委婉有礼
- 符合正式场合的氛围
```

### 场景2：战场指挥

```
写一段战场指挥的场景，主角是张将军（武将）。

严格按照 studio/style/writing_style_guide.md 执行：
- 张将军使用5-10%文言文
- 成语简洁有力（如：临危不乱）
- 表达直接干脆
- 符合战场紧张的氛围
```

### 场景3：日常对话

```
写一段日常对话，角色是小明和朋友的聊天。

严格按照 studio/style/writing_style_guide.md 执行：
- 使用95%现代文，5%文言文
- 几乎不用成语
- 表达自然随意
- 符合日常生活的氛围
```

---

## 🔧 故障排除

### 问题1：AI 还是成语泛滥

**解决方案：**
```
请严格按照 studio/style/writing_style_guide.md 中的成语使用密度表执行：

当前场景：随意对话
成语密度：低（每段0-1个，每章2-4个）

请确保：
1. 成语有前文铺垫
2. 成语与上下文有明确关联
3. 不要堆砌成语
```

### 问题2：文言文比例不对

**解决方案：**
```
请严格按照 studio/style/writing_style_guide.md 中的文言文使用比例表执行：

当前场景：日常叙述
文言文比例：20%
现代文比例：80%

请确保：
1. 使用少量文言词汇
2. 保持现代文为主
3. 不要为了用文言而用文言
```

### 问题3：角色风格不统一

**解决方案：**
```
请严格按照 studio/style/writing_style_guide.md 中的角色差异化执行：

角色：李大人（文臣）
风格要求：
- 文言文比例：30-40%
- 成语密度：中等到高
- 词汇风格：文雅、含蓄
- 表达方式：委婉有礼

请确保全文保持一致
```

---

## 📝 完整示例

### 示例1：初始化项目

```bash
# 在 OpenCode 中执行
使用 opencode-ai-novel-factory 的 novel-init 工具
```

输出：
```
✅ AI Novel Factory 项目初始化完成！

📁 项目目录: /path/to/project

📋 创建的目录结构:
  ├── agents
  ├── automation
  ├── memory
  ├── story
  ├── characters
  ├── style/vocabulary
  ├── production/chapters
  ├── state
  ├── training/samples
  ├── training/iterations
  ├── training/reference

✅ 写作风格指南 (writing_style_guide.md) 创建成功
✅ Vocabulary (264,406 词汇) 下载成功

🎯 下一步:
1. 填写 studio/story/world.md - 世界观设定
2. 填写 studio/story/master_outline.md - 故事大纲
3. 填写 studio/characters/protagonist.md - 主角设定
4. 查看 studio/style/writing_style_guide.md - 写作风格指南
5. 使用 @daily_pipeline 开始创作

💡 重要提示:
- ✅ 插件已全局安装，无需再次执行 npm install
- ✅ 项目结构已创建，可以直接使用
- ✅ 写作风格指南已创建，AI 将自动遵循
- ✅ Vocabulary 包含 264,406 个中文词汇，自动集成到 AI 写作中
- ✅ AI 写作时将自动遵循写作风格指南，确保成语使用合理、文言穿插恰当
```

### 示例2：写作时遵循指南

```bash
# 在 OpenCode 中执行
写第1章，严格按照 studio/style/writing_style_guide.md 的风格指南执行
```

AI 会自动：
1. 读取写作风格指南
2. 分析第1章的场景和角色
3. 选择合适的文言文比例
4. 选择合适的成语密度
5. 按照指南写作

---

## 🎯 关键要点

### 写作前让 AI 知道：

```
请按照 studio/style/writing_style_guide.md 写作，具体要求：
1. 分析当前场景和角色
2. 选择合适的文言文比例
3. 选择合适的成语密度
4. 确保成语与上下文关联
5. 保持风格统一
```

### 写作后让 AI 检查：

```
请按照 studio/style/writing_style_guide.md 的检查清单自检：
- [ ] 成语是否符合角色身份？
- [ ] 成语是否符合性格特征？
- [ ] 成语是否符合场合氛围？
- [ ] 成语是否与前文有关联？
- [ ] 成语密度是否合理？
- [ ] 文言文比例是否合适？
- [ ] 风格是否统一？
- [ ] 是否保持可读性？
```

---

## 📦 更新日志

### v1.6.0 (2026-03-10)

**新增功能：**
- ✨ 自动创建写作风格指南（writing_style_guide.md）
- ✨ novel-init 时自动下载 Vocabulary
- ✨ 新增 novel-download-vocabulary 工具
- ✨ 新增 novel-check-vocabulary 工具
- ✨ novel-status 显示 Vocabulary 状态

**优化改进：**
- 🔧 AI 写作时自动遵循写作风格指南
- 🔧 成语使用策略与角色、场景关联
- 🔧 文言文穿插策略完整化
- 🔧 角色差异化写作指导

**文档更新：**
- 📖 写作风格指南完整版
- 📖 写作风格指南快速开始
- 📖 词汇使用对比 Demo v2.0
- 📖 文言文穿插使用指南

---

## 🚀 开始使用

### 安装更新

```bash
npm install -g opencode-ai-novel-factory@latest
```

### 初始化项目

```bash
# 在 OpenCode 中执行
使用 opencode-ai-novel-factory 的 novel-init 工具
```

### 开始写作

```bash
# 在 OpenCode 中执行
写第1章，严格按照 studio/style/writing_style_guide.md 的风格指南执行
```

---

**记住：AI 会自动读取写作风格指南，你只需要告诉它"按照指南写"即可！**
