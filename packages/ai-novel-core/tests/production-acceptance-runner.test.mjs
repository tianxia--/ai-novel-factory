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
    `老周低声道：“少尹的人在外头。”他抬眼看沈砚，手指攥紧袖口，像欠了一句话。沈砚听见雨打在门槛上，冷意从掌心爬上来。`,
    `他把印章推回灯下，拦住老周伸来的手。这个选择让关系裂开，也把风险留在屋里。章末只剩那道脚步声，谁会先来拿走缺页？`,
  ].join("\n\n")
}

function richSnapshot() {
  const totalChapters = 4
  const chapters = Array.from({ length: totalChapters }, (_, index) => ({
    chapterNumber: index + 1,
    title: `第 ${index + 1} 章`,
    wordCount: 2500,
    body: richBody(index + 1),
    publishReadiness: { ready: true },
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
    { from: "沈砚", to: "老周", pressure: "债务与隐瞒" },
    { from: "沈砚", to: "少尹", pressure: "权力追索" },
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
        { canonicalName: "沈砚", aliases: [] },
        { canonicalName: "老周", aliases: [] },
        { canonicalName: "少尹", aliases: [] },
      ],
      relationshipGraph: {
        characters: [{ name: "沈砚" }, { name: "老周" }, { name: "少尹" }],
      },
    },
  }
}

test("production acceptance runner audits story foundation and narrative quality", async () => {
  const {
    auditStoryFoundationForAcceptance,
    auditPlotExecutionForAcceptance,
    auditNarrativeQualityForAcceptance,
    auditProseTextureForAcceptance,
    auditCharacterVoiceForAcceptance,
    auditForeshadowingPayoffForAcceptance,
    auditContinuityForAcceptance,
  } = await loadRunner()
  const snapshot = richSnapshot()

  const foundationAudit = auditStoryFoundationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(foundationAudit.passed, true)
  assert.equal(foundationAudit.counts.plotChapters, 4)
  assert.equal(foundationAudit.counts.foreshadowingEntries, 4)

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

  const characterVoiceAudit = auditCharacterVoiceForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(characterVoiceAudit.passed, true)
  assert.equal(characterVoiceAudit.summary.voicedCharacters >= 2, true)
  assert.equal(characterVoiceAudit.summary.activeCharacters >= 3, true)

  const foreshadowingAudit = auditForeshadowingPayoffForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(foreshadowingAudit.passed, true)
  assert.equal(foreshadowingAudit.summary.seededEntries >= 3, true)
  assert.equal(foreshadowingAudit.summary.advancedEntries >= 2, true)

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
