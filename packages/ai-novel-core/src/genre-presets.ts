export interface GenrePreset {
  genreName: string
  readerPromise: string
  narrationStrategy: string
  pacingAndRhythm: string
  chapterStructure: string
  characterPressure: string
  poisonPoints: string[]
  naturalnessRules: string[]
  contextPriority: string[]
  vocabularyScenes: string[]
}

export const GENRE_PRESETS: GenrePreset[] = [
  {
    genreName: "玄幻",
    readerPromise: "力量进阶、世界观奇观、跨阶御敌的极致爽感。",
    narrationStrategy: "旁白要强调规则边界、代价、奇观感与境界压力；战斗场景用动作动词和感官细节，不堆砌无意义的境界大字与招式名字。",
    pacingAndRhythm: "小节奏以危机压迫为主，大节奏以境界突破与地位攀升为高潮；突出爽点前的情感压抑与反击释放。",
    chapterStructure: "起笔必须有环境与危机逼迫，中段通过战斗、交易或领悟推进，尾声设立新的高境界威胁或阶段成果。",
    characterPressure: "宗门规则、资源争夺、弱肉强食的丛林法则压迫。",
    poisonPoints: [
      "强行弱智化对手以显得主角聪明",
      "境界贬值过快，战斗全靠大喊功法招式",
      "主角无代价升级，缺乏成长阻力与因果磨练",
      "主角优柔寡断、圣母心过度发作",
      "战力体系彻底崩溃（如低阶凡人无底牌一拳打死神帝）",
      "啰嗦冗长的街头式扯皮对骂与反复嘲讽"
    ],
    naturalnessRules: [
      "拒绝连续 3 个以上的抽象功法玄学词堆砌",
      "战斗过程必须包含物理受创与环境交互破坏的细节",
      "越阶反杀必须展现惨痛代价（如献祭生命本源、经脉重创、法宝碎裂）",
      "动作描写必须有强烈的视听冲击力"
    ],
    contextPriority: ["主角境界与金手指设定", "当前对手与势力矛盾", "装备法宝规则"],
    vocabularyScenes: ["战斗", "修炼", "自然环境", "心理活动"]
  },
  {
    genreName: "修仙/仙侠",
    readerPromise: "逆天改命的出尘感、天道无情的修行代价与人情冷暖。",
    narrationStrategy: "半文白夹杂的典雅旁白，突出“道心”与“代价”；描写环境时融合禅意与空灵感，战斗注重气机博弈与天地元气交互。",
    pacingAndRhythm: "长线闭关心境感悟与短线因果纠缠交织，爽点在于参透玄机、心境突破与因果斩断。",
    chapterStructure: "开场强调修真环境或心魔悸动，中段推进因果争端、掠夺机缘，结尾揭示因果锁链的下一步走向或雷劫预兆。",
    characterPressure: "天道寿元大限、雷劫临头、同门背叛、凡尘因果斩不断带来的心魔纠缠压力。",
    poisonPoints: [
      "修仙者动辄因鸡毛砂皮像市井流氓般无脑辱骂",
      "修行没有感悟与历练，全靠疯狂吃药平推",
      "活了数千年的老怪表现得毫无心智深度与城府（反派低智化）",
      "无节制滥杀无辜且毫无天道誓言与因果逻辑约束"
    ],
    naturalnessRules: [
      "避免堆砌如“道韵”、“法则”、“天道”等抽象大词",
      "凡人与修士、低阶与高阶对话必须有明确 of 身份尊卑和信息差",
      "修行突破与雷劫必须有强烈的肉体淬炼或神魂博弈细节"
    ],
    contextPriority: ["天道规则与修行代价", "道心契约与因果誓言", "角色寿命与法力状态"],
    vocabularyScenes: ["天道感悟", "战斗", "仙山洞府", "对话"]
  },
  {
    genreName: "悬疑",
    readerPromise: "烧脑解谜的智商博弈、信息茧房拆除的震撼、危机降临的压迫恐惧感。",
    narrationStrategy: "冷静客观、克制内敛的旁白；着力刻画微表情与环境物件的暗号线索；避免上帝视角提前剧透。",
    pacingAndRhythm: "信息挤压式节奏，前半段不断抛出谜题和认知偏差，后半段通过细节汇聚实现惊人反转或真相收拢。",
    chapterStructure: "起笔以异常现象、凶案现场或难解谜题切入，中段进行线索查证与认知对抗，尾声锁定在新的破坏性线索或人身危险中。",
    characterPressure: "追猎者的迫近、凶手的心理诱导、时间限制、身边盟友不可信的背叛压力。",
    poisonPoints: [
      "侦探主角强行通过灵光一现解决所有谜题，缺乏证据链支撑",
      "犯罪动机极度弱智，破案全靠反派降智自己招供",
      "前面埋下的关键线索到最后毫无用处，烂尾或选择性失忆",
      "严禁机械降神：绝不允许在最后关头凭空冒出前文从未提及的新人物、新线索或超自然力量破局",
      "反派在最后关头像动漫角色般滔滔不绝主动交代犯罪过程"
    ],
    naturalnessRules: [
      "每一个被描写的微小反常物件，在后续 3 章内必须有功能性交代或回收",
      "拒绝直白心理独白‘原来是这样’，改用线索重组的行动去呈现判断",
      "冰山信息控制：揭露信息必须通过微表情、失言或异样侧面展现，真相切成碎片每次只给 10%",
      "心理高压渲染：不要直白说恐惧，聚焦感官细节（如秒针跳动、喉咙干燥血腥味、水管异响）",
      "严格的第三人称限知视角：主角未看未听的不允许出现在正文中"
    ],
    contextPriority: ["核心案件线索链", "已知疑点与人物认知差", "案发时间线与隐藏动机"],
    vocabularyScenes: ["犯罪现场", "对话", "心理对抗", "环境渲染"]
  },
  {
    genreName: "都市/现实",
    readerPromise: "现代职场/生活的强烈代入感、人情往来的情绪共鸣、逆袭规则的爽感。",
    narrationStrategy: "极具生活质感的现代旁白，注重刻画职场阶层张力、金钱诱惑与社会潜规则；语言保持自然客观。",
    pacingAndRhythm: "高压的现代生存节奏，爽点在于专业技能的碾压突破、阶层跨越的畅快或人情冷暖的反转。",
    chapterStructure: "起笔于具体的职场/家庭生活危机或社会冲突，中段通过利益交涉、专业手段过招推进，结尾落脚于关系转变或更大的利益钩子。",
    characterPressure: "房贷车贷财务红线、职场排挤、阶层壁垒、家庭矛盾与人际社交的虚伪包装。",
    poisonPoints: [
      "强行塞入低端、反智的嘲讽打脸套路",
      "主角专业技能漏洞百出，脱离现实社会常识",
      "职场合作写成儿戏般的小学宫斗"
    ],
    naturalnessRules: [
      "对白高度口语化，严禁人物像念教科书说明书般说话",
      "关于金钱、消费水平及行业规则的数据必须精准且符合时代常理"
    ],
    contextPriority: ["主角职业背景与核心利益", "社会关系网络与财务债务", "当前博弈目标"],
    vocabularyScenes: ["日常", "对话", "心理活动", "都市环境"]
  },
  {
    genreName: "言情/情感",
    readerPromise: "情感戏的过山车张力、拉扯感与宿命救赎感。",
    narrationStrategy: "细腻敏感的旁白，高度聚焦生理反应、视线交互与情绪波动；着意放大两人之间的距离与试探性接触。",
    pacingAndRhythm: "推拉式情感节奏。以日常互动与性格冲突积累荷尔蒙张力，爽点在于关系确认或患难见真情的情感释放。",
    chapterStructure: "起笔必须建立两人在狭小空间或心理事件的交集，中段通过观念碰撞或外界阻力产生拉扯，尾声落脚于情感关系的一步变化。",
    characterPressure: "身份差距悬殊、心口不一的自尊、过去情感创伤带来的阻抗、以及外界竞争的嫉妒压力。",
    poisonPoints: [
      "男女主角强行降智陷入小学级误会，形成憋屈憋宝",
      "强行堆砌工业糖精，缺乏情感因果递进和相互救赎的立足点",
      "为了虐而虐，撕碎人物底线尊严"
    ],
    naturalnessRules: [
      "严禁使用抽象的爱情/情绪词汇堆叠",
      "亲密接触或情感变化必须由具体动作、脸红、心跳、呼吸等身体反应呈现"
    ],
    contextPriority: ["两人核心冲突与情感纽带", "过去的情感创伤与伤口", "恋爱关系进展阶段"],
    vocabularyScenes: ["感情戏", "心理活动", "对话", "日常"]
  },
  {
    genreName: "历史/古代",
    readerPromise: "宏大的时代沧桑感、与历史名臣名将博弈的智谋交锋、以超前心智重塑古风秩序的逆袭爽感。",
    narrationStrategy: "古风厚重的旁白，融合古代政治制度、礼仪习惯、衣食住行考据，使用符合时代的雅致称谓与文白词汇。",
    pacingAndRhythm: "天下大势与主角生计、地方治理相互嵌套，爽点在于运用现代智识解决古代顽疾，或在历史关键节点上的大手笔博弈。",
    chapterStructure: "起笔突出具体的封建宗族压力、地方灾荒或官场威逼，中段运用古人博弈格局与谋略破局，结尾挂钩天下局势或地缘军事危机。",
    characterPressure: "皇权天威不可忤逆、宗族伦理道德牌坊、乱世战祸、小人谗言以及落后信息交通下的生存压力。",
    poisonPoints: [
      "古代历史人物满口现代网络烂梗与超前政治用语",
      "历史背景漏洞百出，称谓度量衡极度反智",
      "强行让历史英烈名臣沦为主角降智的陪衬"
    ],
    naturalnessRules: [
      "官职、典章制度、度量衡必须高度严谨",
      "文白用词控制在 10% 以内，只起渲染质感作用，严禁晦涩堆词"
    ],
    contextPriority: ["朝堂局势与时代重大危机", "地方县志考据与经济命脉", "历史走向与核心名人"],
    vocabularyScenes: ["历史场景", "对话", "仪式庆典", "日常"]
  },
  {
    genreName: "科幻/赛博",
    readerPromise: "硬核理论降维打击的震撼、宇宙尺度下的存在主义思考、以及高科技奇观的冰冷震撼。",
    narrationStrategy: "冷静、理性的工程感旁白，将繁复的技术概念巧妙转化为人物具体的感官细节与生存代价；避免技术说教。",
    pacingAndRhythm: "智性思考与物理危机并行的节奏，爽点在于技术悖论的精妙解开，或高维文明法则的宏大体现。",
    chapterStructure: "起笔呈现技术异变或物理生存资源急剧告急，中段展开技术排查、阵营认知冲突，结尾展示更广阔的星空图景或技术引力波效应。",
    characterPressure: "物理定律底线无法违背、飞船系统过载崩溃、高维智慧的冷漠蔑视、以及真空环境的生理压力。",
    poisonPoints: [
      "技术概念解释完全脱离基本数理逻辑，沦为民科狂想",
      "宇宙背景下依然只是换了马甲的物理原始砍杀",
      "技术仅仅作为背景，对人物生存状态和道德抉择无实际约束"
    ],
    naturalnessRules: [
      "物理学、工程学概念必须具有基本的逻辑闭环",
      "避免纯理论长篇大论，技术概念必须通过设备运转、警报或身体异状传达"
    ],
    contextPriority: ["飞船/基地物理受损与资源数据", "底层物理定律与技术机制", "AI或高维生命体运行法则"],
    vocabularyScenes: ["技术现场", "飞船城市", "对话", "数据分析"]
  },
  {
    genreName: "无限流",
    readerPromise: "诡异规则极限拆解的智谋快感、生死绝境下的人性多面性、以及跨副本能力碰撞的无限可能。",
    narrationStrategy: "高度聚焦局域超自然规则、副本核心判定机制与生存点数变化；旁白冷峻并充斥着限制视角的未知恐惧感。",
    pacingAndRhythm: "紧凑的生死限时逃杀节奏，爽点在于巧妙洞穿规则漏洞实现弱克强、以及副本通关时的点数与技能奖励结算。",
    chapterStructure: "起笔宣布新副本机制或关卡规则推移，中段展开规则摸索、智谋战与团队内讧博弈，结尾落在生死一线的关头抉择或逆转。",
    characterPressure: "主神/系统无情的抹杀惩罚、未知的致死性规则触发点、不可信赖的临时队友的生存压力。",
    poisonPoints: [
      "主角一进入副本就如同拿到剧本般无所不能，缺乏探索的悬念",
      "副本规则名存实亡，沦为主角无脑秀个人武力的沙盒",
      "队友智商全部下线，既无对抗思维也无自救能力"
    ],
    naturalnessRules: [
      "副本的基础死亡规则 and 限制条件在章节内必须被角色频繁审视",
      "主角持有的奇特技能兑换，每次使用必须显式描述其肉体或精神代价"
    ],
    contextPriority: ["当前副本规则与主神主线任务", "主角所持卡牌技能与冷却代价", "队友的底牌及明暗立场"],
    vocabularyScenes: ["副本探索", "战斗", "对话", "诡异异变"]
  }
];

export function findGenrePreset(searchText: string): GenrePreset | undefined {
  const normalized = searchText.toLowerCase();
  
  if (/仙侠|修仙|修行|修炼|成仙|天道|雷劫|洞府|筑基|金丹|元神|渡劫|immortal|xianxia/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "修仙/仙侠");
  }
  if (/玄幻|魔法|斗气|武魂|魂兽|神魔|奇幻|fantasy|xuanhuan/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "玄幻");
  }
  if (/权谋|宫廷|朝堂|帝王|宰相|夺嫡|臣|court|palace|politic/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "历史/古代");
  }
  if (/悬疑|谜|案|侦探|推理|凶手|线索|凶杀|破案|mystery|crime|thriller|suspense|detective/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "悬疑");
  }
  if (/言情|爱情|恋爱|情侣|暖婚|总裁|纯爱|romance|love/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "言情/情感");
  }
  if (/历史|古代|大明|大唐|秦朝|三国|穿越历史|historical|dynasty|period/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "历史/古代");
  }
  if (/科幻|赛博|星际|未来|机甲|高科技|物理定律|宇宙飞船|sci-fi|science fiction/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "科幻/赛博");
  }
  if (/无限流|主神|副本|游戏系统|限时任务|抹杀|infinite flow/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "无限流");
  }
  if (/都市|现实|职场|商业|老板|打工|city|urban/u.test(normalized)) {
    return GENRE_PRESETS.find(p => p.genreName === "都市/现实");
  }
  
  return undefined;
}
