import test from "node:test"
import assert from "node:assert/strict"
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
    chapterNumber: chapter.chapterNumber,
    status: "seeded",
    payoff: "后续章节推进或回收。",
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
    auditNarrativeQualityForAcceptance,
    auditCharacterVoiceForAcceptance,
    auditContinuityForAcceptance,
  } = await loadRunner()
  const snapshot = richSnapshot()

  const foundationAudit = auditStoryFoundationForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(foundationAudit.passed, true)
  assert.equal(foundationAudit.counts.plotChapters, 4)
  assert.equal(foundationAudit.counts.foreshadowingEntries, 4)

  const narrativeAudit = auditNarrativeQualityForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(narrativeAudit.passed, true)
  assert.equal(narrativeAudit.summary.totalChapters, 4)
  assert.ok(narrativeAudit.summary.totalDialogue >= narrativeAudit.summary.requiredDialogue)
  assert.equal(narrativeAudit.summary.mentionedCast >= 2, true)

  const characterVoiceAudit = auditCharacterVoiceForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(characterVoiceAudit.passed, true)
  assert.equal(characterVoiceAudit.summary.voicedCharacters >= 2, true)
  assert.equal(characterVoiceAudit.summary.activeCharacters >= 3, true)

  const continuityAudit = auditContinuityForAcceptance(snapshot, { chapters: 4, chapterWords: 2500 })
  assert.equal(continuityAudit.passed, true)
  assert.equal(continuityAudit.summary.bridgedPairs, 3)
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
