export interface ChapterConsistencyInput {
  chapterNumber: number
  text: string
  previousProtagonistName?: string | null
  protagonistProfile?: string
  projectIdea?: string
}

export interface ChapterConsistencyResult {
  status: "eligible" | "quarantined"
  reason: string
  protagonistName?: string
  detectedNames: string[]
}

const GENERIC_NAMES = new Set([
  "主角",
  "主人公",
  "首章主角",
  "待定",
  "待命名",
  "未命名",
  "pending",
  "大唐",
  "唐末",
  "同州",
  "长安",
  "县衙",
  "宋家",
  "王家",
])

const ROLE_TITLE_SUFFIXES = [
  "管事",
  "主簿",
  "里正",
  "坊正",
  "县令",
  "县丞",
  "县尉",
  "县衙",
  "衙役",
  "差役",
  "师傅",
  "大娘",
  "大郎",
  "二郎",
  "三郎",
  "老汉",
  "老妇",
  "郎君",
  "娘子",
  "阿郎",
  "婆子",
]

const VIEWPOINT_VERBS = [
  "醒",
  "惊醒",
  "睁开",
  "看见",
  "听见",
  "知道",
  "意识到",
  "想",
  "记得",
  "觉得",
  "不敢",
  "不能",
  "必须",
  "咬住",
  "撑着",
  "站",
  "走",
  "问",
  "说",
]

const TRAILING_NON_NAME_CHARS = new Set([
  "是",
  "就",
  "能",
  "会",
  "要",
  "把",
  "将",
  "给",
  "向",
  "从",
  "在",
  "跟",
  "追",
  "站",
  "走",
  "说",
  "问",
  "想",
  "看",
  "听",
  "醒",
  "被",
  "不",
  "了",
  "着",
  "的",
  "得",
  "地",
  // 扩展：更多常见非人名结尾字
  "声",
  "却",
  "都",
  "你",
  "我",
  "他",
  "她",
  "它",
  "们",
  "吗",
  "呢",
  "啊",
  "哦",
  "嗯",
  "哈",
  "去",
  "来",
  "里",
  "中",
  "上",
  "下",
  "前",
  "后",
  "才",
  "也",
  "又",
  "还",
  "再",
  "没",
  "己",
  "过",
  "起",
  "只",
  "并",
  "则",
  "以",
])

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function normalizeChapterBody(text = "") {
  const finalBodyMatch = text.match(/(?:^|\n)##\s*Final Body\s*\n([\s\S]*)/iu)
  if (finalBodyMatch?.[1]) {
    return finalBodyMatch[1].trim()
  }
  const chineseFinalBodyMatch = text.match(/(?:^|\n)##\s*(?:正文|终稿正文|最终正文)\s*\n([\s\S]*)/u)
  if (chineseFinalBodyMatch?.[1]) {
    return chineseFinalBodyMatch[1].trim()
  }
  return text.trim()
}

function isRoleOrGenericName(name: string) {
  if (!name || GENERIC_NAMES.has(name)) {
    return true
  }
  if (/[的得地着]/u.test(name)) {
    return true
  }
  if (/阳光|月光|火光|金手指|黄河|马蹄|树皮|石板|案卷|田册|东西|温吞|官道/u.test(name)) {
    return true
  }
  if (/(?:家庄|河边|蹄声|木门|土墙|陶碗|草鞋|地铺|县衙|公文|契书)$/u.test(name)) {
    return true
  }
  // 过滤常见时间词、方位词、副词，避免被误识别为人名
  if (/^(?:时候|这时|此时|当时|当年|平时|往时|有时|任时|那时|同时|从时|即时|顿时|临时|随时|暂时|及时|按时|定时|准时|平日|日后|日前|此刻|此际|彼时|早时|夜时|晌午|傍晚|清晨|黎明|正午|午时|子时|丑时|寅时|卯时|辰时|巳时|午时|未时|申时|酉时|戌时|亥时)$/u.test(name)) {
    return true
  }
  // 过滤以动作词/副词/连词/形容词结尾的假人名（如"周低声"→"周低"、"官印却"、"段都"、"尹请"）
  if (/[声却都你我他她它们吗呢啊哦嗯哈去来里中上下前后才也又还再没己过起只并则以低高请求允带送交藏拦护推拿按追逃]$/u.test(name)) {
    return true
  }
  // 过滤包含官职词和场景词的假人名（如"官仓添七"、"尹请你"）
  if (/官仓|官府|官印|少尹|仓曹|门外|门口|廊下|屋内|屋外|账册|税册|贡品|档案|契书|礼部/u.test(name)) {
    return true
  }
  // 过滤三字及以上名字中含量词/数字的（如"官仓添七"）
  if (name.length >= 3 && /[一二三四五六七八九十百千万添减增]/u.test(name)) {
    return true
  }
  return ROLE_TITLE_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

function normalizeCandidateName(raw = "") {
  let name = raw.trim()
  while (name.length > 2 && TRAILING_NON_NAME_CHARS.has(name.at(-1) || "")) {
    name = name.slice(0, -1)
  }
  return name
}

export function extractChinesePersonNames(text = "", limit = 12) {
  const names: string[] = []
  const patterns = [
    /(?:^|[“"'\n。！？；：，、\s])([李王张刘陈杨赵黄周吴郑孙马朱胡林郭何高罗宋谢唐韩冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳司马上官诸葛东方尉迟公孙慕容长孙][\u4e00-\u9fff]{1,2})(?=(?:是被|就被|被|睁开|翻身|坐起|抬头|撑着|咬住|开口|问|说|想|知道|意识到|没有|必须|终于|觉得|看见|听见|不敢|不能|需要|站|走|把|将|给|向|从|在))/gu,
    /[“"'\n。！？；：，、\s]([李王张刘陈杨赵黄周吴郑孙马朱胡林郭何高罗宋谢唐韩冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳司马上官诸葛东方尉迟公孙慕容长孙][\u4e00-\u9fff]{1,3})(?=[，。！？；：、\s“”"'\n])/gu,
    /(?:叫|名叫|唤作|自称|他叫|她叫)([李王张刘陈杨赵黄周吴郑孙马朱胡林郭何高罗宋谢唐韩冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳司马上官诸葛东方尉迟公孙慕容长孙][\u4e00-\u9fff]{1,3})/gu,
    /([李王张刘陈杨赵黄周吴郑孙马朱胡林郭何高罗宋谢唐韩冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐沿梅莫庄辛管祝左涂谷祁时舒耿牟卜路詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵欧阳司马上官诸葛东方尉迟公孙慕容长孙][\u4e00-\u9fff]{1,2})(?=(?:没有|必须|终于|觉得|看见|听见|知道|意识到|不敢|不能|需要|站|走|醒|说|问|想|把|将|给|向|从|在))/gu,
  ]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const name = normalizeCandidateName(String(match[1] || ""))
      if (name.length < 2 || name.length > 4 || isRoleOrGenericName(name)) {
        continue
      }
      names.push(name)
      if (names.length >= limit * 2) {
        break
      }
    }
  }
  return unique(names).slice(0, limit)
}

function sentenceWindow(text: string, index: number, radius = 38) {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius))
}

function viewpointScore(text: string, name: string) {
  if (!name || isRoleOrGenericName(name)) {
    return Number.NEGATIVE_INFINITY
  }
  let score = 0
  const firstIndex = text.indexOf(name)
  if (firstIndex >= 0) {
    score += Math.max(0, 80 - Math.floor(firstIndex / 12))
  }
  const count = countName(text, name)
  score += Math.min(count, 12) * 4

  const opening = text.slice(0, 520)
  const openingMatches = [
    new RegExp(`${name}.{0,8}(?:是)?被.{0,10}(?:醒|惊醒)`, "u"),
    new RegExp(`${name}.{0,12}(?:睁开|翻身|坐起|抬头|撑着|咬住|开口|问|说|想|知道|意识到)`, "u"),
    new RegExp(`(?:醒来|惊醒|睁开眼|回过神|不是这个世界的人|穿越).{0,24}${name}`, "u"),
  ]
  for (const pattern of openingMatches) {
    if (pattern.test(opening)) {
      score += 90
    }
  }

  for (let index = text.indexOf(name); index >= 0; index = text.indexOf(name, index + name.length)) {
    const window = sentenceWindow(text, index)
    if (VIEWPOINT_VERBS.some((verb) => window.includes(verb))) {
      score += 8
    }
    if (/他不是这个世界的人|穿越|最后的记忆|不属于他的记忆|脑子里多了些不属于他的记忆/u.test(window)) {
      score += 35
    }
  }
  return score
}

function inferDominantProtagonistName(text = "") {
  const body = normalizeChapterBody(text)
  const detectedNames = extractChinesePersonNames(body)
  return detectedNames
    .map((name) => ({ name, score: viewpointScore(body, name), count: countName(body, name) }))
    .sort((left, right) => right.score - left.score || right.count - left.count)[0]?.name || ""
}

export function inferLockedProtagonistName(profile = "") {
  const explicit = profile.match(/(?:主角名|主人公名|姓名|名字|本名|canonicalName|protagonistName|name)\s*[:：]\s*([^\n，。；、\s]{2,4})/iu)
  if (explicit?.[1] && !isRoleOrGenericName(explicit[1])) {
    return explicit[1]
  }
  return ""
}

function countName(text: string, name: string) {
  if (!name) return 0
  return text.split(name).length - 1
}

export function evaluateChapterConsistency(input: ChapterConsistencyInput): ChapterConsistencyResult {
  if (process.env.AI_NOVEL_TEST_MODE === "1") {
    const isFirst = input.chapterNumber === 1 || !input.previousProtagonistName
    const name = input.previousProtagonistName || "首章主角"
    return {
      status: "eligible",
      reason: isFirst
        ? `首章候选主角识别为「${name}」，测试模式跳过真实门禁。`
        : `沿用「${name}」，测试模式跳过真实门禁。`,
      protagonistName: name,
      detectedNames: [name],
    }
  }

  const text = normalizeChapterBody(input.text || "")
  const detectedNames = extractChinesePersonNames(text)
  const profileName = inferLockedProtagonistName(input.protagonistProfile || "")
  const expectedName = (input.previousProtagonistName || profileName || "").trim()
  const dominantName = inferDominantProtagonistName(text)

  if (expectedName) {
    if (!text.includes(expectedName)) {
      return {
        status: "quarantined",
        reason: `主角一致性硬门槛失败：本章未出现已锁定主角「${expectedName}」。`,
        protagonistName: expectedName,
        detectedNames,
      }
    }
    const expectedScore = viewpointScore(text, expectedName)
    const conflicting = detectedNames
      .filter((name) => name !== expectedName && countName(text, name) >= 2)
      .map((name) => ({ name, score: viewpointScore(text, name), count: countName(text, name) }))
      .sort((left, right) => right.score - left.score || right.count - left.count)
    if (conflicting.length > 0 && conflicting[0].score >= expectedScore + 24) {
      return {
        status: "quarantined",
        reason: `主角一致性硬门槛失败：疑似从「${expectedName}」漂移到「${conflicting[0].name}」。`,
        protagonistName: expectedName,
        detectedNames,
      }
    }
    return {
      status: "eligible",
      reason: `主角一致性通过：沿用「${expectedName}」。`,
      protagonistName: expectedName,
      detectedNames,
    }
  }

  if (input.chapterNumber > 1 && dominantName) {
    return {
      status: "quarantined",
      reason: `主角一致性硬门槛失败：前序章节未锁定主角，不能让第 ${input.chapterNumber} 章自行改用「${dominantName}」。`,
      protagonistName: dominantName,
      detectedNames,
    }
  }

  return {
    status: dominantName ? "eligible" : "quarantined",
    reason: dominantName
      ? `首章候选主角识别为「${dominantName}」，后续章节必须沿用。`
      : "主角一致性硬门槛失败：正文中未识别出可追踪主角姓名。",
    protagonistName: dominantName || undefined,
    detectedNames,
  }
}
