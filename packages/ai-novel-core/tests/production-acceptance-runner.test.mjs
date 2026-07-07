import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const testFilePath = fileURLToPath(import.meta.url)
const repoRoot = path.resolve(path.dirname(testFilePath), "..", "..", "..")
const runnerEntry = path.join(repoRoot, "scripts", "run-production-acceptance.mjs")

async function loadRunner() {
  return import(`${pathToFileURL(runnerEntry).href}?ts=${Date.now()}`)
}

function richBody(chapterNumber) {
  return [
    `雨声贴着窗纸往下滑。沈砚把第 ${chapterNumber} 册账本推到灯下，指腹按住纸边，又把旧印扣在桌角。老周站在门槛外，袖口湿了一线，鞋尖向后退。`,
    `“谁动过这一页？”沈砚问。门外脚步停住，灯火压低，墨味从账册线里泛出来。他伸手合上账册，决定先留下缺页，不把证据交出去。`,
    `老周低声道：“少尹的人在外头。”权力追索已经压到门口。他抬眼看沈砚，手指攥紧袖口，像旧债还没清，又欠了一句话。沈砚听见雨打在门槛上，冷意从掌心爬上来。`,
    `他把印章推回灯下，拦住老周伸来的手。这个选择让关系裂开，也把风险留在屋里。章末只剩那道脚步声，谁会先来拿走缺页？`,
  ].join("\n\n")
}

function productionValidationFixture(chapterNumber) {
  const qualityGate = { status: "passed", passed: true, score: 8.8, attempts: 1, reason: "fixture production quality passed" }
  const aigcDetection = { status: "passed", score: 0.12, threshold: 0.8, highRiskSegments: [], highRiskCount: 0, reason: "fixture AIGC passed" }
  const styleConformanceDrift = {
    status: "conformant",
    conformanceScore: 8.6,
    driftScore: 1.2,
    reason: "fixture style remains conformant",
    evidence: ["短对白、动作先行和物件压力保持稳定。"],
    risks: [],
    metrics: { forbiddenHitCount: 0 },
  }
  const styleInheritanceVerification = {
    status: "ready",
    summary: "fixture chapter inherits frozen style contract",
    chapterNumber,
    contractVersion: 1,
    contractApproved: true,
    inheritanceStatus: "enforced",
    chapterInheritanceAdapter: { status: "ready", contractVersion: 1 },
    adapterReady: true,
    freezerVerdict: "ready",
    publishBaseReady: true,
    publishBaseMissing: [],
    qualityGateStatus: "passed",
    aigc: { status: "passed", score: 0.12, threshold: 0.8, highRiskCount: 0, reason: "fixture AIGC passed" },
    verificationStatus: "passed",
    styleConformanceDrift,
    styleDrift: { status: "conformant", conformanceScore: 86, driftScore: 12, threshold: 72 },
    evidence: ["质量门已通过。", "AIGC 检测已通过。", "章节继承链已标记为 enforced。"],
    risks: [],
  }
  const publishReadiness = {
    ready: true,
    status: "ready",
    missing: [],
    checks: [
      { id: "quality_gate", label: "质量门禁", passed: true, detail: "passed" },
      { id: "style_generation_verification", label: "写法生成验证", passed: true, detail: "passed" },
      { id: "style_contract_alignment", label: "写法继承验证", passed: true, detail: "ready" },
      { id: "aigc_gate", label: "AIGC 检测", passed: true, detail: "passed" },
    ],
    styleInheritanceVerification,
  }
  return {
    qualityGate,
    aigcDetection,
    styleConformanceDrift,
    styleInheritanceVerification,
    publishReadiness,
    versionManifest: {
      qualityGate,
      aigcDetection,
      styleConformanceDrift,
      styleInheritanceVerification,
      publishReadiness,
    },
  }
}

function richSnapshot() {
  const totalChapters = 4
  const chapters = Array.from({ length: totalChapters }, (_, index) => ({
    chapterNumber: index + 1,
    title: `第 ${index + 1} 章`,
    wordCount: 2500,
    body: richBody(index + 1),
    ...productionValidationFixture(index + 1),
  }))
  const plotChapters = chapters.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    causalObjective: "推进账册疑案并留下不可逆关系压力。",
  }))
  const stateDeltas = chapters.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    delta: "信任、债务或身份风险发生变化。",
  }))
  const foreshadowingEntries = chapters.map((chapter) => ({
    id: `foreshadowing-${chapter.chapterNumber}`,
    sourceChapter: chapter.chapterNumber,
    chapterNumber: chapter.chapterNumber,
    status: "planned",
    operation: "埋设并推进缺页账册、旧印章和门外脚步的关联。",
    expectedAdvance: "后续章节让缺页账册、印章和脚步声持续改变人物选择。",
    payoffMode: chapter.chapterNumber >= totalChapters - 1 ? "late_payoff" : "advance_or_reframe",
    linkedAnchors: ["缺页账册", "印章", "脚步"],
    payoff: "后续章节推进或回收缺页账册、印章和脚步声。",
  }))
  const relationshipEntries = [
    { from: "沈砚", to: "老周", pressure: "旧债隐瞒与欠话未清" },
    { from: "沈砚", to: "少尹", pressure: "少尹的人带来权力追索" },
  ]
  return {
    project: {
      title: "税册风声",
      idea: "一个长安小吏在诡异税册里追查王朝命数",
      totalChapters,
      chapterWordTarget: 2500,
    },
    chapters,
    lore: {
      storyFoundation: {
        contract: {
          genre: { readerPromise: "设定清晰、人物承压、情节持续钩住读者" },
          plot: { causalModel: "previous_input -> scene_objective -> protagonist_decision -> irreversible_change -> next_handoff", chapters: plotChapters },
          characters: { relationshipEntries, stateDeltas, requiredDossierFields: ["canonical name", "core desire", "speech marker"] },
          foreshadowing: { ledgerRules: ["必须有来源章节和回收方式"], entries: foreshadowingEntries },
          volumes: [{ id: "volume-1", requiredChange: "改变主角位置、关系网络或世界认知" }],
        },
        worldMatrix: { rules: ["世界规则服务核心创意"], continuityAnchors: ["缺页账册"] },
        plotArchitecture: { chapters: plotChapters, timeline: plotChapters, escalationRules: ["每 3-5 章升级压力"] },
        storyBible: { readerPromise: "设定清晰、人物承压、情节持续钩住读者", nonNegotiableContracts: ["不漂移题材"], characterStateDeltas: stateDeltas },
        volumeStrategy: { volumes: [{ id: "volume-1" }], contractRules: ["卷尾必须改变主角位置"] },
        foreshadowingLedger: { rules: ["每条伏笔必须可追踪"], entries: foreshadowingEntries },
        characterDynamics: { relationshipEntries, chapterStateDeltas: stateDeltas, relationshipRules: ["关系必须随章节变化"] },
        writingPlan: { totalChapters, writingMode: "serial", chapters: plotChapters },
      },
    },
    characters: {
      dossiers: [
        {
          id: "protagonist",
          canonicalName: "沈砚",
          role: "protagonist",
          coreDesire: "查清税册缺页背后的旧债",
          aliases: [],
          speechMarkers: ["谁动过"],
          behaviorHabits: ["按住纸边", "合上账册"],
          relationshipState: "与老周有旧债隐瞒，与少尹处于权力追索压力。",
        },
        {
          canonicalName: "老周",
          role: "supporting",
          coreDesire: "保住旧债秘密",
          aliases: [],
          speechMarkers: ["少尹的人"],
          behaviorHabits: ["攥紧袖口"],
          relationshipState: "对沈砚欠话未清，靠旧债隐瞒维持摇晃信任。",
        },
        {
          canonicalName: "少尹",
          role: "pressure-force",
          coreDesire: "夺回缺页账册",
          aliases: [],
          speechMarkers: [],
          behaviorHabits: ["派人守在门外"],
          relationshipState: "通过少尹的人和权力追索逼沈砚交出缺页账册。",
        },
      ],
      relationshipGraph: {
        characters: [{ name: "沈砚" }, { name: "老周" }, { name: "少尹" }],
      },
    },
  }
}

function structuralSnapshot(withMarkers = true) {
  const snapshot = richSnapshot()
  const totalChapters = 8
  const phasePlans = [
    "开端入局：沈砚第一次发现税册缺页，旧案被触发。",
    "调查延展：沈砚继续追问账册来历，关系压力加深。",
    "压力升级：老周的债务牵出少尹权力追索。",
    "中段转折：蓝色玻璃账页暴露真相，沈砚意识到代价已经不可逆。",
    "反转加压：少尹背叛旧约，主角位置改变。",
    "高潮逼近：缺页账册、旧印章和门外脚步开始集中回收。",
    "高潮摊牌：沈砚终于揭开王朝税册真相，不能再退。",
    "卷尾余波：新局打开，关系网络改变，下一阶段风险站在门外。",
  ]
  const genericPlan = "继续追查账册疑案，让人物保持压力并推动事件。"
  snapshot.project.totalChapters = totalChapters
  snapshot.chapters = Array.from({ length: totalChapters }, (_, index) => {
    const chapterNumber = index + 1
    const marker = withMarkers ? phasePlans[index] : "沈砚检查账册，老周站在门外，少尹派人追索。"
    return {
      chapterNumber,
      title: `第 ${chapterNumber} 章`,
      wordCount: 2500,
      body: `${richBody(chapterNumber)}\n\n${marker}`,
      ...productionValidationFixture(chapterNumber),
    }
  })
  const plotChapters = snapshot.chapters.map((chapter, index) => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    causalObjective: withMarkers ? phasePlans[index] : genericPlan,
  }))
  const stateDeltas = snapshot.chapters.map((chapter, index) => ({
    chapterNumber: chapter.chapterNumber,
    delta: withMarkers ? phasePlans[index] : "信任、债务或身份风险发生变化。",
  }))
  snapshot.lore.storyFoundation.contract.plot.chapters = plotChapters
  snapshot.lore.storyFoundation.plotArchitecture.chapters = plotChapters
  snapshot.lore.storyFoundation.plotArchitecture.timeline = plotChapters
  snapshot.lore.storyFoundation.writingPlan.totalChapters = totalChapters
  snapshot.lore.storyFoundation.writingPlan.chapters = plotChapters
  snapshot.lore.storyFoundation.contract.characters.stateDeltas = stateDeltas
  snapshot.lore.storyFoundation.storyBible.characterStateDeltas = stateDeltas
  snapshot.lore.storyFoundation.characterDynamics.chapterStateDeltas = stateDeltas
  return snapshot
}

function variedLongSnapshot() {
  const snapshot = structuralSnapshot(true)
  const openings = [
    "清晨的仓曹院先响起木鱼声，沈砚把缺页账册压在袖下，看见老周从廊柱后退了一步。",
    "西市的盐车堵住坊门，少尹的差役翻检货牌，沈砚听见老周在人群里咳了一声。",
    "午后的档库热得发闷，沈砚拆开旧印泥盒，里面压着一枚不该存在的户籍铜牌。",
    "雨停后，城门沟里浮出蓝色玻璃，沈砚第一次意识到税册缺页牵着另一条命案。",
    "夜审开在废庙里，老周把袖口摊开，少尹的人却先把灯吹灭了一半。",
    "南仓失火时，沈砚没有去救整本账册，只把夹在封皮里的空白页抽出来。",
    "鼓楼三更，少尹亲自站到门外，沈砚终于把旧印章扣在供桌中央。",
    "天亮以前，老周把伞留在桥头，沈砚看见伞柄上多了一道新刻的债字。",
  ]
  const middles = [
    "他选择先问人，不问账。这个选择让老周欠下第二次沉默，也让少尹知道缺页没有交出去。",
    "沈砚把盐价旧账递给摊主，只收回半句证词。人群散开时，账面上的潮痕已经变成新的线索。",
    "他按住铜牌边缘，决定把身份风险留在自己名下。老周看见了，却没有替他辩一句。",
    "玻璃边缘割破掌心，沈砚没有松手。那点血让账册里的空白变得像一份供词。",
    "庙门外脚步声一停，沈砚让老周先走。留下的人反而成了少尹必须追问的证人。",
    "火星落上纸边，沈砚把空白页藏进水缸，代价是整仓旧账再也不能复原。",
    "他拒绝交出旧印，转身把少尹逼到灯下。关系在这一刻翻面，谁欠谁已经说不清。",
    "桥下水声很低，沈砚收起那把伞，知道下一卷要追的不是账，而是留下伞的人。",
  ]
  const endings = [
    "章末，院门外有人轻轻敲了三下，敲的不是门，是账册木匣。",
    "结尾时，盐车忽然空了一辆，车辙却朝档库去了。",
    "最后，铜牌背面露出沈砚父亲的旧名，他没有立刻合上盒盖。",
    "章末的玻璃被雨水冲亮，里面映出的不是城门，而是一间废庙。",
    "尾声里，老周走出三步又停住，像终于想起自己还欠沈砚一条命。",
    "火灭以后，水缸里浮出一行浅墨：少尹只要活口。",
    "最后一盏灯灭前，旧印章自己裂开，裂纹正好穿过少尹二字。",
    "卷尾只剩桥头那把伞，伞面朝下，像替谁盖住了还没说出口的供词。",
  ]
  snapshot.project.totalChapters = openings.length
  snapshot.chapters = openings.map((opening, index) => ({
    chapterNumber: index + 1,
    title: `第 ${index + 1} 章`,
    wordCount: 2500,
    body: [opening, middles[index], endings[index]].join("\n\n"),
    ...productionValidationFixture(index + 1),
  }))
  return snapshot
}

test("production acceptance runner audits story foundation and narrative quality", async () => {
  const {
    auditStoryFoundationForAcceptance,
    auditReaderPurityForAcceptance,
    auditProductionValidationForAcceptance,
    auditWorldbuildingIntegrationForAcceptance,
    auditPlotExecutionForAcceptance,
    auditNarrativeQualityForAcceptance,
    auditProseTextureForAcceptance,
    auditLanguageCraftForAcceptance,
    auditSceneCompletenessForAcceptance,
    auditCrossChapterVariationForAcceptance,
    auditCharacterVoiceForAcceptance,
    auditCharacterArcForAcceptance,
    auditRelationshipArcForAcceptance,
    auditForeshadowingPayoffForAcceptance,
    auditFinalResolutionForAcceptance,
    auditContinuityForAcceptance,
  } = await loadRunner()
  const snapshot = richSnapshot()

  const foundationAudit = auditStoryFoundationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(foundationAudit.passed, true)
  assert.equal(foundationAudit.counts.plotChapters, 4)
  assert.equal(foundationAudit.counts.foreshadowingEntries, 4)

  const readerPurityAudit = auditReaderPurityForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(readerPurityAudit.passed, true)
  assert.equal(readerPurityAudit.summary.cleanChapters, 4)

  const productionValidationAudit = auditProductionValidationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(productionValidationAudit.passed, true)
  assert.equal(productionValidationAudit.summary.validatedChapters, 4)
  assert.equal(productionValidationAudit.summary.aigcPassedChapters, 4)

  const worldbuildingAudit = auditWorldbuildingIntegrationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(worldbuildingAudit.passed, true)
  assert.equal(worldbuildingAudit.summary.anchoredChapters, 4)
  assert.equal(worldbuildingAudit.summary.texturedChapters, 4)

  const plotExecutionAudit = auditPlotExecutionForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(plotExecutionAudit.passed, true)
  assert.equal(plotExecutionAudit.summary.executedChapters, 4)
  assert.equal(plotExecutionAudit.summary.anchoredChapters, 4)

  const narrativeAudit = auditNarrativeQualityForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(narrativeAudit.passed, true)
  assert.equal(narrativeAudit.summary.totalChapters, 4)
  assert.ok(narrativeAudit.summary.totalDialogue >= narrativeAudit.summary.requiredDialogue)
  assert.equal(narrativeAudit.summary.mentionedCast >= 2, true)

  const proseTextureAudit = auditProseTextureForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(proseTextureAudit.passed, true)
  assert.equal(proseTextureAudit.summary.sceneRichChapters, 4)
  assert.equal(proseTextureAudit.summary.variedRhythmChapters, 4)

  const languageCraftAudit = auditLanguageCraftForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(languageCraftAudit.passed, true)
  assert.equal(languageCraftAudit.summary.skipped, true)

  const sceneCompletenessAudit = auditSceneCompletenessForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(sceneCompletenessAudit.passed, true)
  assert.equal(sceneCompletenessAudit.summary.sceneCompleteChapters, 4)
  assert.equal(sceneCompletenessAudit.summary.interactionParagraphsTotal >= 4, true)

  const variationAudit = auditCrossChapterVariationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(variationAudit.passed, true)
  assert.equal(variationAudit.summary.skipped, true)

  const characterVoiceAudit = auditCharacterVoiceForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(characterVoiceAudit.passed, true)
  assert.equal(characterVoiceAudit.summary.voicedCharacters >= 2, true)
  assert.equal(characterVoiceAudit.summary.activeCharacters >= 3, true)

  const characterArcAudit = auditCharacterArcForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(characterArcAudit.passed, true)
  assert.equal(characterArcAudit.summary.protagonist, "沈砚")
  assert.equal(characterArcAudit.summary.activeSupporting >= 2, true)

  const relationshipArcAudit = auditRelationshipArcForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(relationshipArcAudit.passed, true)
  assert.equal(relationshipArcAudit.summary.activeRelationships, 2)
  assert.equal(relationshipArcAudit.summary.evolvingRelationships, 2)

  const foreshadowingAudit = auditForeshadowingPayoffForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(foreshadowingAudit.passed, true)
  assert.equal(foreshadowingAudit.summary.seededEntries >= 3, true)
  assert.equal(foreshadowingAudit.summary.advancedEntries >= 2, true)

  const finalResolutionAudit = auditFinalResolutionForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(finalResolutionAudit.passed, true)
  assert.equal(finalResolutionAudit.summary.skipped, true)

  const continuityAudit = auditContinuityForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(continuityAudit.passed, true)
  assert.equal(continuityAudit.summary.bridgedPairs, 3)
})

test("production acceptance runner resolves provider health targets from capability routes", async () => {
  const { findConfiguredLlm, buildProviderHealthTargets } = await loadRunner()
  const configs = [
    {
      id: "active-config",
      name: "Active fallback",
      api_key_configured: true,
      base_url: "https://relay.example/active",
      model_name: "active-model",
      api_mode: "chat",
      is_active: 1,
    },
    {
      id: "text-config",
      name: "Text route",
      api_key_configured: true,
      base_url: "https://relay.example/text",
      model_name: "text-model",
      api_mode: "responses",
      is_active: 0,
    },
    {
      id: "style-config",
      name: "Style route",
      api_key_configured: true,
      base_url: "https://relay.example/style",
      model_name: "style-model",
      api_mode: "responses",
      is_active: 0,
    },
  ]
  const routes = [
    { capability: "text", config_id: "text-config" },
    { capability: "style_evolution", config_id: "style-config" },
  ]

  const modelInfo = findConfiguredLlm({ configs, routes })
  const targets = buildProviderHealthTargets(modelInfo)

  assert.equal(modelInfo.active.id, "active-config")
  assert.equal(modelInfo.textConfig.id, "text-config")
  assert.equal(modelInfo.styleConfig.id, "style-config")
  assert.deepEqual(targets.map((target) => ({
    capabilities: target.capabilities,
    id: target.config.id,
  })), [
    { capabilities: ["text"], id: "text-config" },
    { capabilities: ["style_evolution"], id: "style-config" },
  ])
})

test("production acceptance runner merges provider health targets for shared routes", async () => {
  const { findConfiguredLlm, buildProviderHealthTargets } = await loadRunner()
  const configs = [
    {
      id: "shared-config",
      name: "Shared route",
      api_key_configured: true,
      base_url: "https://relay.example/shared",
      model_name: "shared-model",
      api_mode: "responses",
      is_active: 1,
    },
  ]
  const routes = [
    { capability: "text", config_id: "shared-config" },
    { capability: "style_evolution", config_id: "shared-config" },
  ]

  const modelInfo = findConfiguredLlm({ configs, routes })
  const targets = buildProviderHealthTargets(modelInfo)

  assert.equal(targets.length, 1)
  assert.deepEqual(targets[0].capabilities, ["text", "style_evolution"])
  assert.equal(targets[0].config.id, "shared-config")
})

test("production acceptance runner enables automatic AIGC refinement settings", async () => {
  const { buildAcceptanceWritingSettings } = await loadRunner()

  const defaultSettings = buildAcceptanceWritingSettings({ provider: "local-heuristic" })
  assert.equal(defaultSettings.autoAigcRefinement, true)
  assert.deepEqual(defaultSettings.aigcDetector, { provider: "local-heuristic" })

  const savedOnlySettings = buildAcceptanceWritingSettings({})
  assert.equal(savedOnlySettings.autoAigcRefinement, true)
  assert.equal("aigcDetector" in savedOnlySettings, false)
})

test("production acceptance runner rejects thin foundations and dry repeated prose", async () => {
  const {
    auditStoryFoundationForAcceptance,
    auditNarrativeQualityForAcceptance,
  } = await loadRunner()
  const snapshot = richSnapshot()
  snapshot.lore.storyFoundation.foreshadowingLedger.entries = []
  snapshot.lore.storyFoundation.characterDynamics.relationshipEntries = []
  snapshot.chapters[0].body = [
    "他知道事情非常严重，未来一定会出现更加复杂更加危险的局面。",
    "他知道事情非常严重，未来一定会出现更加复杂更加危险的局面。",
    "他知道事情非常严重，未来一定会出现更加复杂更加危险的局面。",
    "他知道事情非常严重，未来一定会出现更加复杂更加危险的局面。",
  ].join("\n\n")
  snapshot.chapters[0].wordCount = 700

  const foundationAudit = auditStoryFoundationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(foundationAudit.passed, false)
  assert.match(foundationAudit.issues.join("\n"), /foreshadowing entries|relationshipEntries/)

  const narrativeAudit = auditNarrativeQualityForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(narrativeAudit.passed, false)
  assert.match(narrativeAudit.issues.join("\n"), /repeated paragraph|weak action|word count/)
})

test("production acceptance runner rejects broken cross-chapter handoffs", async () => {
  const { auditContinuityForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  snapshot.chapters[1].body = [
    "晨潮从码头外升起。陌生商队清点蓝色玻璃，簿册里全是南方盐价，没有人提昨夜的屋檐，也没有人记得旧案。",
    "领队把货单卷好，吩咐伙计换旗。整段开场像换了一本书，前一章留下的关系压力、物件和问题都断在原地。",
  ].join("\n\n")

  const continuityAudit = auditContinuityForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(continuityAudit.passed, false)
  assert.match(continuityAudit.issues.join("\n"), /no visible handoff anchor|continuity coverage/)
})

test("production acceptance runner rejects chapters that ignore the planned plot", async () => {
  const { auditPlotExecutionForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  const offPlanChapters = snapshot.chapters.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    title: chapter.title,
    causalObjective: "蓝色玻璃、南方盐价和码头商队必须推动本章真相。",
  }))
  snapshot.lore.storyFoundation.contract.plot.chapters = offPlanChapters
  snapshot.lore.storyFoundation.plotArchitecture.chapters = offPlanChapters
  snapshot.lore.storyFoundation.writingPlan.chapters = offPlanChapters
  snapshot.lore.storyFoundation.characterDynamics.chapterStateDeltas = snapshot.chapters.map((chapter) => ({
    chapterNumber: chapter.chapterNumber,
    delta: "商队同盟背叛，盐价账目改变主角立场。",
  }))

  const plotExecutionAudit = auditPlotExecutionForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(plotExecutionAudit.passed, false)
  assert.match(plotExecutionAudit.issues.join("\n"), /planned objective anchors|state delta|plot execution coverage/)
})

test("production acceptance runner rejects split plot evidence without local causal execution", async () => {
  const { auditPlotExecutionForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "账册疑案、不可逆压力、信任债务身份都写在墙上的旧纸里。",
      "沈砚决定先把纸灯挪开，选择站到窗边。",
      "这让屋里更冷，因此留下灰尘，所有人意识到真相。",
      "雨滴继续落下，屋外没有新的动作。",
    ].join("\n\n")
  }

  const plotExecutionAudit = auditPlotExecutionForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(plotExecutionAudit.passed, false)
  assert.match(plotExecutionAudit.issues.join("\n"), /local plot execution evidence|plot execution coverage/)
})

test("production acceptance runner rejects missing worldbuilding anchors in prose", async () => {
  const { auditWorldbuildingIntegrationForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  snapshot.lore.storyFoundation.worldMatrix = {
    rules: ["蓝色玻璃控制南方盐价，码头商队按潮汐契约交换身份。"],
    continuityAnchors: ["蓝色玻璃", "南方盐价", "码头商队", "潮汐契约"],
  }
  snapshot.lore.storyFoundation.storyBible.readerPromise = "蓝色玻璃和南方盐价必须成为每章可见的世界规则压力。"
  snapshot.lore.storyFoundation.contract.genre.readerPromise = "蓝色玻璃、南方盐价、码头商队共同驱动世界观。"

  const worldbuildingAudit = auditWorldbuildingIntegrationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(worldbuildingAudit.passed, false)
  assert.match(worldbuildingAudit.issues.join("\n"), /world anchor|worldbuilding anchor chapter coverage|distinct worldbuilding anchors/)
})

test("production acceptance runner audits long-form structural progression", async () => {
  const { auditStructuralProgressionForAcceptance } = await loadRunner()
  const snapshot = structuralSnapshot(true)

  const structuralAudit = auditStructuralProgressionForAcceptance(snapshot, { chapters: 8, chapterWords: 2500 })
  assert.equal(structuralAudit.passed, true)
  assert.equal(structuralAudit.summary.passedPhases, 4)
  assert.equal(structuralAudit.phases.every((phase) => phase.planHits.length > 0 && phase.bodyHits.length > 0), true)
})

test("production acceptance runner rejects missing long-form structural progression", async () => {
  const { auditStructuralProgressionForAcceptance } = await loadRunner()
  const snapshot = structuralSnapshot(false)

  const structuralAudit = auditStructuralProgressionForAcceptance(snapshot, { chapters: 8, chapterWords: 2500 })
  assert.equal(structuralAudit.passed, false)
  assert.match(structuralAudit.issues.join("\n"), /structural phase|long-form structural progression/)
})

test("production acceptance runner audits cross-chapter variation", async () => {
  const { auditCrossChapterVariationForAcceptance } = await loadRunner()
  const snapshot = variedLongSnapshot()

  const variationAudit = auditCrossChapterVariationForAcceptance(snapshot, { chapters: 8, chapterWords: 2500 })
  assert.equal(variationAudit.passed, true)
  assert.equal(variationAudit.summary.distinctOpenings, 8)
  assert.equal(variationAudit.summary.distinctEndings, 8)
})

test("production acceptance runner audits long-form language craft", async () => {
  const { auditLanguageCraftForAcceptance } = await loadRunner()
  const snapshot = variedLongSnapshot()

  const languageCraftAudit = auditLanguageCraftForAcceptance(snapshot, { chapters: 8, chapterWords: 2500 })
  assert.equal(languageCraftAudit.passed, true)
  assert.equal(languageCraftAudit.summary.craftedChapters, 8)
  assert.equal(languageCraftAudit.summary.totalClicheSignals <= languageCraftAudit.summary.allowedTotalCliches, true)
})

test("production acceptance runner audits long-form final resolution", async () => {
  const { auditFinalResolutionForAcceptance } = await loadRunner()
  const snapshot = variedLongSnapshot()

  const finalResolutionAudit = auditFinalResolutionForAcceptance(snapshot, { chapters: 8, chapterWords: 2500 })
  assert.equal(finalResolutionAudit.passed, true)
  assert.equal(finalResolutionAudit.summary.resolvedFinalChapters, 2)
  assert.equal(finalResolutionAudit.summary.finalChapterResolved, true)
  assert.equal(finalResolutionAudit.summary.payoffAnchors >= 1, true)
})

test("production acceptance runner rejects repeated chapter templates", async () => {
  const { auditCrossChapterVariationForAcceptance } = await loadRunner()
  const snapshot = structuralSnapshot(false)

  const variationAudit = auditCrossChapterVariationForAcceptance(snapshot, { chapters: 8, chapterWords: 2500 })
  assert.equal(variationAudit.passed, false)
  assert.match(variationAudit.issues.join("\n"), /repeated chapter opening|repeated chapter ending|repeated long prose|distinct chapter/)
})

test("production acceptance runner rejects same-voice character dialogue", async () => {
  const { auditCharacterVoiceForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "雨声贴着窗纸往下滑。沈砚把缺页账本推到灯下，老周站在门槛外，少尹按住官印，三个人都在等同一个答案。",
      "沈砚道：“这件事很重要，我们必须继续调查。”他伸手合上账册，决定先藏住缺页。",
      "老周道：“这件事很重要，我们必须继续调查。”他低头退开，袖口却压着半枚湿印。",
      "少尹看向门外脚步，手指扣住官印，追问谁还隐瞒了旧账。这个选择让关系裂开，也把风险留在屋里。",
    ].join("\n\n")
  }

  const characterVoiceAudit = auditCharacterVoiceForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(characterVoiceAudit.passed, false)
  assert.match(characterVoiceAudit.issues.join("\n"), /same dialogue used across speakers|template dialogue ratio/)
})

test("production acceptance runner rejects core characters without dossier voice or habit evidence", async () => {
  const { auditCharacterVoiceForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "雨声贴着窗纸往下滑。沈砚把缺页账本推到灯下，老周站在门槛外，少尹站在廊下拦住去路。",
      "沈砚道：“这页账不该留在库里。”他伸手把纸册推向灯边，决定先藏住缺页。",
      "老周低声道：“外头已经有人查到仓曹院。”他退了一步，把湿袖压在身侧。",
      "少尹看着两人，扣住官印，逼他们交出旧账。这个选择让关系裂开，也把风险留在屋里。",
    ].join("\n\n")
  }

  const characterVoiceAudit = auditCharacterVoiceForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(characterVoiceAudit.passed, false)
  assert.match(characterVoiceAudit.issues.join("\n"), /dossier voice\/habit evidence missing/)
})

test("production acceptance runner rejects missing protagonist arc and supporting cast usage", async () => {
  const { auditCharacterArcForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  snapshot.chapters[1].body = [
    "陌生账吏把蓝色玻璃搬上码头，商队只谈南方盐价。",
    "他检查货单，决定先躲开雨棚，没人提沈砚、老周或少尹留下的问题。",
  ].join("\n\n")
  snapshot.chapters[2].body = [
    "码头掌柜翻开潮汐契约，陌生账吏听见远处鼓声。",
    "他选择把货单藏进箱底，新的商队线索把原本的人物弧切断。",
  ].join("\n\n")
  snapshot.chapters[3].body = [
    "南方盐价忽然翻倍，陌生账吏只看见账面数字。",
    "他把玻璃推回船舱，故事没有承接主角压力，也没有让关键配角参与。",
  ].join("\n\n")

  const characterArcAudit = auditCharacterArcForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(characterArcAudit.passed, false)
  assert.match(characterArcAudit.issues.join("\n"), /protagonist|supporting cast|character cast/)
})

test("production acceptance runner rejects missing relationship arc pressure", async () => {
  const { auditRelationshipArcForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "雨声贴着窗纸往下滑。沈砚把缺页账本推到灯下，指腹按住纸边，又把旧印扣在桌角。",
      "他决定先留下缺页，不把证据交出去。灯火压低，墨味从账册线里泛出来。",
      "他听见雨打在门槛上，冷意从掌心爬上来。这个选择把风险留在屋里。",
      "他把印章推回灯下，章末只剩那道脚步声，谁会先来拿走缺页？",
    ].join("\n\n")
  }

  const relationshipArcAudit = auditRelationshipArcForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(relationshipArcAudit.passed, false)
  assert.match(relationshipArcAudit.issues.join("\n"), /active relationship arcs|relationship pressure coverage|co-presence/)
})

test("production acceptance runner rejects generic relationship pressure without concrete state anchors", async () => {
  const { auditRelationshipArcForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "沈砚和老周站在屋里，信任出现裂缝，风险越来越近。",
      "少尹也走进来，三个人都做了选择，关系开始改变。",
      "他们互相看着，谁也没有提那些真正牵住他们的具体旧事。",
      "门外的雨还在落，屋里只剩泛泛的压力。",
    ].join("\n\n")
  }

  const relationshipArcAudit = auditRelationshipArcForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(relationshipArcAudit.passed, false)
  assert.match(relationshipArcAudit.issues.join("\n"), /state-change|evolving relationship arcs/)
})

test("production acceptance runner rejects foreshadowing that never reaches the prose", async () => {
  const { auditForeshadowingPayoffForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  snapshot.lore.storyFoundation.foreshadowingLedger.entries = [
    {
      id: "hidden-glass-1",
      sourceChapter: 1,
      operation: "埋设蓝色玻璃与南方盐价的秘密关系。",
      expectedAdvance: "第三章回收蓝色玻璃和南方盐价。",
      payoffMode: "late_payoff",
      linkedAnchors: ["蓝色玻璃", "南方盐价"],
    },
    {
      id: "hidden-glass-2",
      sourceChapter: 2,
      operation: "继续推进蓝色玻璃。",
      expectedAdvance: "第四章让蓝色玻璃改变真相。",
      payoffMode: "final_payoff",
      linkedAnchors: ["蓝色玻璃"],
    },
    {
      id: "hidden-glass-3",
      sourceChapter: 3,
      operation: "回收南方盐价。",
      expectedAdvance: "最终揭示南方盐价。",
      payoffMode: "final_payoff",
      linkedAnchors: ["南方盐价"],
    },
  ]

  const foreshadowingAudit = auditForeshadowingPayoffForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(foreshadowingAudit.passed, false)
  assert.match(foreshadowingAudit.issues.join("\n"), /seed evidence|advance\/payoff evidence|payoff/)
})

test("production acceptance runner rejects foreshadowing anchors without causal advancement", async () => {
  const { auditForeshadowingPayoffForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "雨声停在窗外。缺页账册、印章和脚步被旁白反复提到。",
      "缺页账册仍是缺页账册，印章仍是印章，脚步仍在门外。",
      "这些线索以后还会出现，但眼下只是被摆在句子里。",
      "结尾继续保留缺页账册、印章和脚步。",
    ].join("\n\n")
  }

  const foreshadowingAudit = auditForeshadowingPayoffForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(foreshadowingAudit.passed, false)
  assert.equal(foreshadowingAudit.summary.seededEntries >= 3, true)
  assert.equal(foreshadowingAudit.summary.advancedEntries, 0)
  assert.match(foreshadowingAudit.issues.join("\n"), /advance\/payoff evidence|payoff/)
})

test("production acceptance runner rejects dry outline-like prose", async () => {
  const { auditProseTextureForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "本章主要推进主线和人物关系，故事情节在这里发生重要变化，伏笔也会得到强化。",
      "角色非常紧张，情况很复杂，未来会更加危险，读者会意识到世界观设定并不简单。",
      "剧情继续发展，主角的选择带来关系变化，但文本保持概括说明，没有具体动作和场景。",
      "补充场景需要突出爽点和钩子，每段都必须推进主线，不能偏离写作目标。",
    ].join("\n\n")
  }

  const proseTextureAudit = auditProseTextureForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(proseTextureAudit.passed, false)
  assert.match(proseTextureAudit.issues.join("\n"), /dry outline|generic summary|scene-rich/)
})

test("production acceptance runner rejects cliche-heavy long-form language", async () => {
  const { auditLanguageCraftForAcceptance } = await loadRunner()
  const snapshot = structuralSnapshot(true)
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "这一刻，沈砚终于意识到事情非常严重，空气仿佛凝固，命运的齿轮开始转动。",
      "老周眼神复杂，内心深处有一种无法言说的情绪，少尹也感到震惊，未来只会更加危险。",
      "所有人都陷入沉思，复杂的情绪在每个人心里蔓延，他们知道一切都不简单。",
      "这一刻，沈砚终于意识到事情非常严重，空气仿佛凝固，命运的齿轮开始转动。",
    ].join("\n\n")
  }

  const languageCraftAudit = auditLanguageCraftForAcceptance(snapshot, { chapters: 8, chapterWords: 2500 })
  assert.equal(languageCraftAudit.passed, false)
  assert.match(languageCraftAudit.issues.join("\n"), /cliche|abstract emotion|language craft/)
})

test("production acceptance runner rejects open-ended long-form finales", async () => {
  const { auditFinalResolutionForAcceptance } = await loadRunner()
  const snapshot = variedLongSnapshot()
  for (const chapter of snapshot.chapters.slice(-2)) {
    chapter.body = [
      "沈砚站在雨里，知道后续还有更加危险的真相，所有伏笔都将在下一章继续推进。",
      "老周和少尹都没有给出答案，新的危机正在升级，未来只会更加复杂。",
      "这一切还没有结束，谜团进一步加深，关系也会在后续发生更大的变化。",
    ].join("\n\n")
  }

  const finalResolutionAudit = auditFinalResolutionForAcceptance(snapshot, { chapters: 8, chapterWords: 2500 })
  assert.equal(finalResolutionAudit.passed, false)
  assert.match(finalResolutionAudit.issues.join("\n"), /final resolution|open-ended|final chapter/)
})

test("production acceptance runner rejects non-novel reader metadata leaks", async () => {
  const { auditReaderPurityForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  snapshot.chapters[0].body = [
    richBody(1),
    "## Chapter Quality Report",
    "| Dimension | Score | Notes |",
    "| 情节推进 | 8/10 | ok |",
    "WORD_COUNT_CHECK: 2480/2500",
    "========== [LLM REQUEST SEND] ==========",
    "{\"qualityGate\":{\"status\":\"passed\"}}",
  ].join("\n")

  const readerPurityAudit = auditReaderPurityForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(readerPurityAudit.passed, false)
  assert.match(readerPurityAudit.issues.join("\n"), /non-novel reader metadata|quality gate heading|word count check|llm/i)
})

test("production acceptance runner rejects missing production validation evidence", async () => {
  const { auditProductionValidationForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  snapshot.chapters[0].aigcDetection = { status: "skipped", reason: "AIGC detector is not configured." }
  snapshot.chapters[0].versionManifest.aigcDetection = snapshot.chapters[0].aigcDetection
  snapshot.chapters[0].publishReadiness = {
    ...snapshot.chapters[0].publishReadiness,
    ready: false,
    missing: [{ id: "aigc_gate", label: "AIGC 检测", detail: "skipped" }],
    checks: snapshot.chapters[0].publishReadiness.checks.map((check) =>
      check.id === "aigc_gate" ? { ...check, passed: false, detail: "skipped" } : check,
    ),
  }

  const productionValidationAudit = auditProductionValidationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(productionValidationAudit.passed, false)
  assert.match(productionValidationAudit.issues.join("\n"), /AIGC gate|publish readiness|production validation/)
})

test("production acceptance runner rejects low-scored production validation evidence", async () => {
  const { auditProductionValidationForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  snapshot.chapters[0].qualityGate = {
    ...snapshot.chapters[0].qualityGate,
    status: "passed",
    passed: true,
    score: 7.4,
  }
  snapshot.chapters[0].versionManifest.qualityGate = snapshot.chapters[0].qualityGate
  snapshot.chapters[1].styleConformanceDrift = {
    ...snapshot.chapters[1].styleConformanceDrift,
    status: "conformant",
    conformanceScore: 6.8,
    driftScore: 3.2,
    risks: [],
  }
  snapshot.chapters[1].styleInheritanceVerification = {
    ...snapshot.chapters[1].styleInheritanceVerification,
    styleConformanceDrift: snapshot.chapters[1].styleConformanceDrift,
    styleDrift: { status: "conformant", conformanceScore: 68, driftScore: 32, threshold: 72 },
  }
  snapshot.chapters[1].versionManifest.styleConformanceDrift = snapshot.chapters[1].styleConformanceDrift
  snapshot.chapters[1].versionManifest.styleInheritanceVerification = snapshot.chapters[1].styleInheritanceVerification
  snapshot.chapters[1].publishReadiness = {
    ...snapshot.chapters[1].publishReadiness,
    styleInheritanceVerification: snapshot.chapters[1].styleInheritanceVerification,
  }

  const productionValidationAudit = auditProductionValidationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(productionValidationAudit.passed, false)
  assert.match(productionValidationAudit.issues.join("\n"), /quality gate score|style conformance score/)
})

test("production acceptance runner rejects chapters without complete scene beats", async () => {
  const { auditSceneCompletenessForAcceptance } = await loadRunner()
  const snapshot = richSnapshot()
  for (const chapter of snapshot.chapters) {
    chapter.body = [
      "本章的主要作用是让税册疑案继续推进，人物关系因此出现变化，世界观压力也被进一步展示。",
      "沈砚需要面对更复杂的局面，老周的态度会影响后续选择，少尹的追索让风险持续增加。",
      "这一段会保留伏笔和钩子，说明缺页账册、旧印章、门外脚步都将在后续章节继续发挥作用。",
      "结尾需要让读者感到紧张，并意识到下一章会出现新的危机和更大的真相。",
    ].join("\n\n")
  }

  const sceneCompletenessAudit = auditSceneCompletenessForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(sceneCompletenessAudit.passed, false)
  assert.match(sceneCompletenessAudit.issues.join("\n"), /complete scene paragraphs|character interaction|decision\/consequence|scene-complete/)
})

test("production acceptance runner writes resumable checkpoint reports", async () => {
  const { writeAcceptanceCheckpoint } = await loadRunner()
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ai-novel-acceptance-"))
  const reportPath = path.join(dir, "report.json")
  const report = {
    version: 1,
    status: "running",
    projectId: "project-123",
    steps: [{ step: "project_created", status: "completed" }],
    progress: [{ step: 3, complete: 2, total: 40 }],
  }

  const checkpoint = await writeAcceptanceCheckpoint(reportPath, report, {
    phase: "drafting_progress",
    advanceStep: 3,
    progress: { complete: 2, total: 40 },
  })
  const saved = JSON.parse(await fs.readFile(reportPath, "utf8"))

  assert.equal(checkpoint.phase, "drafting_progress")
  assert.equal(saved.lastCheckpoint.phase, "drafting_progress")
  assert.equal(saved.lastCheckpoint.projectId, "project-123")
  assert.equal(saved.checkpoints.length, 1)
  assert.deepEqual(saved.checkpoints[0].progress, { complete: 2, total: 40 })
})
