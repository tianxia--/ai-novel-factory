export type ProductionPhase =
  | "phase_0_init"
  | "phase_1_concept_dialogue"
  | "phase_2_core_seed"
  | "phase_3_character_dynamics"
  | "phase_4_initial_character_state"
  | "phase_5_world_matrix"
  | "phase_6_plot_architecture"
  | "phase_7_story_bible"
  | "phase_8_volume_strategy"
  | "phase_9_chapter_blueprints"
  | "phase_10_writing_plan"
  | "phase_11_style_evolution"
  | "phase_12_style_approval"
  | "phase_13_chapter_execution"
  | "phase_14_quality_repair"
  | "phase_15_finalize_complete"

export type ProductionGateStatus = "passed" | "blocked" | "warning"

export interface ProductionGateIssue {
  code: string
  severity: "critical" | "warning" | "info"
  message: string
  recoveryHint: string
}

export interface ProductionGateResult {
  status: ProductionGateStatus
  canProceed: boolean
  blockedReason: string | null
  issues: ProductionGateIssue[]
}

export interface ProductionReadinessItem {
  key: string
  label: string
  status: ProductionGateStatus
  detail: string
  issueCodes: string[]
  recoveryHint: string
}

export interface ProductionReadinessAsset {
  key: string
  label: string
  path: string
  status: ProductionGateStatus
  detail: string
}

export interface ProductionReadinessGroup {
  key: string
  label: string
  status: ProductionGateStatus
  summary: string
  assets: ProductionReadinessAsset[]
}

export interface ProductionReadinessSnapshot {
  status: ProductionGateStatus
  canProceed: boolean
  score: number
  summary: string
  blockedReason: string | null
  items: ProductionReadinessItem[]
  groups: ProductionReadinessGroup[]
  issues: ProductionGateIssue[]
}

export interface StyleEvolutionContract {
  loopProtocol?: {
    status?: "pending" | "running" | "ready" | "approved" | "blocked"
    requiredStages?: string[]
    completedStages?: string[]
    blockedStages?: string[]
    evidence?: Array<{
      key: string
      label: string
      status: "pending" | "passed" | "blocked" | "warning"
      summary: string
      evidence: string[]
      requiredForFreeze?: boolean
    }>
  }
  runtime?: {
    engine?: "Style Evolution Engine"
    runtime?: "Prompt Loop Runtime"
    gate?: "Style Contract Freeze Gate"
    verificationGate?: "Generation Verification Gate"
    lastRunId?: string
    lastRunStatus?: "idle" | "running" | "completed"
    lastStopReason?: "max_iterations_reached" | "ready_for_approval" | "stable_candidate" | "style_candidates_all_blocked" | "manual_stop"
    lastCompletedAt?: string
  }
  retryPolicy?: {
    maxLoopIterations?: number
    approvalScoreThreshold?: number
    approvalMinRounds?: number
    stabilityMinRounds?: number
    stabilityScoreDeltaMax?: number
    retryOnForbiddenHit?: boolean
    maxForbiddenHitCount?: number
  }
  freezer?: {
    verdict?: "block" | "continue" | "ready"
    summary?: string
    blockingReasons?: string[]
    version?: number
    checkedAt?: string
  }
  frozenBasePrompt?: string
  approval?: {
    status?: "pending" | "approved" | "rejected"
    approvedVersion?: number
    approvedAt?: string
    approvedBy?: "user" | "system"
    freezeSummary?: string
    acceptedAsBookStyle?: boolean
    rejectedVersion?: number
    rejectedAt?: string
    rejectionReason?: string
  }
  inheritance?: {
    status?: "pending" | "enforced"
    inheritedArtifacts?: string[]
    inheritedRules?: string[]
    promptSummary?: string
  }
  loop?: {
    status?: "idle" | "running" | "awaiting_user" | "stable_candidate" | "ready_for_approval" | "approved"
    convergence?: "unknown" | "exploring" | "improving" | "stable" | "ready"
    currentIteration?: number
    latestVersion?: number
    stableVersion?: number
    readyVersion?: number
    approvalVersion?: number
    autoIterations?: number
    stableRounds?: number
    stabilityScore?: number
    lastRunAt?: string
    lastVerdict?: "retry" | "candidate" | "approve"
    latestSummary?: string
    stableSummary?: string
    readySummary?: string
    stabilityReasons?: string[]
    readyReasons?: string[]
    convergenceEvidence?: string[]
    tighteningCount?: number
    verificationStatus?: "pending" | "passed" | "blocked" | "warning"
    verificationVersion?: number
    verificationSummary?: string
    verificationReasons?: string[]
  }
  verification?: {
    gate?: "Generation Verification Gate"
    status?: "pending" | "passed" | "blocked" | "warning"
    summary?: string
    reasons?: string[]
    score?: number | null
    threshold?: number | null
    highRiskCount?: number
    forbiddenHitCount?: number
    highRiskPreviews?: string[]
    version?: number
    checkedAt?: string
  }
  seedPrompt?: string
  userStylePrompt?: string
  referenceText?: string
  referenceWorks?: string[]
  desiredVibes?: string[]
  seedForbiddenPatterns?: string[]
  approvedSample?: string
  approvedSamplePath?: string
  approvedAt?: string
  styleContract?: {
    voice?: string
    sentenceRhythm?: string
    dialogueRules?: string[]
    descriptionRules?: string[]
    emotionRules?: string[]
    pacingRules?: string[]
    povRules?: string[]
    openingRules?: string[]
    endingHookRules?: string[]
    allowedDevices?: string[]
    forbiddenPatterns?: string[]
    positiveExamples?: string[]
    negativeExamples?: string[]
  }
  antiPatterns?: string[]
  evolutionHistory?: Array<{
    version: number
    prompt: string
    sample: string
    review: string
    createdAt?: string
    samplePath?: string
    iterationFeedback?: string
    source?: "manual" | "loop"
    readyForApproval?: boolean
    readyReasons?: string[]
    userDecision?: "pending" | "accepted_for_freeze" | "accepted" | "superseded"
    userDecisionAt?: string
    rejectionReason?: string
    contractTightening?: string[]
    convergenceNote?: string
    freezer?: {
      verdict?: "block" | "continue" | "ready"
      summary?: string
      blockingReasons?: string[]
      checkedAt?: string
    }
    verification?: {
      gate?: "Generation Verification Gate"
      status?: "pending" | "passed" | "blocked" | "warning"
      summary?: string
      reasons?: string[]
      score?: number | null
      threshold?: number | null
      highRiskCount?: number
      forbiddenHitCount?: number
      highRiskPreviews?: string[]
      version?: number
      checkedAt?: string
    }
    evaluation?: {
      source?: "heuristic" | "llm_critic"
      verdict?: "retry" | "candidate" | "approve"
      summary?: string
      scores?: {
        narrativeVoice?: number
        sentenceRhythm?: number
        dialogueTexture?: number
        informationDensity?: number
        emotionalTension?: number
        readability?: number
        requirementAlignment?: number
        forbiddenPatternRisk?: number
        overall?: number
      }
      strengths?: string[]
      deviations?: string[]
      forbiddenHits?: string[]
      nextFocus?: string[]
    }
    refinement?: {
      source?: "heuristic" | "llm_critic"
      summary?: string
      promptAdjustments?: string[]
      contractAdjustments?: string[]
      nextPrompt?: string
    }
  }>
}

export interface ChapterSceneCardContract {
  index: number
  goal: string
  conflict: string
  turn: string
  endHook: string
  requiredCharacters: string[]
  requiredFacts: string[]
  forbiddenFacts: string[]
}

export interface ChapterBlueprintContract {
  chapterNumber: number
  title: string
  chapterRole: string
  chapterPurpose: string
  macroBeat: "E" | "F" | "P" | "C"
  suspenseLevel: string
  foreshadowingOperation: string
  plotTwistLevel: number
  emotionTarget: string
  conflictLevel: number
  revealLevel: number
  targetWordCount: number
  mustAvoid: string[]
  allowedCharacters: string[]
  forbiddenCharacters: string[]
  allowedNewCharacters: string[]
  entranceProtocol: {
    newCharacterStage: "rumor" | "trace" | "meet" | "name_reveal"
    requiredIntroElements: string[]
  }
  sceneCards: ChapterSceneCardContract[]
  endingHook: string
  nextChapterEntryState: string
}

export interface WritingPlanChapterContract {
  chapterNumber: number
  title: string
  filePath: string
  status: "pending" | "in_progress" | "completed" | "failed" | "blocked"
  wordCount: number | null
  qualityPass: boolean | null
  retryCount: number
  selectedVersionId: string | null
}

export interface WritingPlanContract {
  version: 1
  novelName: string
  totalChapters: number
  minWordsPerChapter: number
  status: "planning" | "in_progress" | "completed" | "blocked"
  writingMode: "serial" | "batch" | "agent_team"
  chapters: WritingPlanChapterContract[]
}

export interface ProductionReadinessInput {
  consensusText?: string
  planningArtifactCount?: number
  planningRequiredAssetCount?: number
  planningRequiredAssets?: string[]
  planningMissingRequiredAssets?: string[]
  planningAssetDetails?: ProductionReadinessAsset[]
  storyFoundationApproved?: boolean
  storyFoundationApprovalPath?: string
  storyFoundationApprovedAt?: string
  storyFoundationApprovalFingerprint?: string
  storyFoundationAssetFingerprint?: string
  characterAssetDetails?: ProductionReadinessAsset[]
  executionAssetDetails?: ProductionReadinessAsset[]
  blueprintCount?: number
  totalChapters?: number
  characterDossierCount?: number
  characterDossierGaps?: string[]
  styleGate?: ProductionGateResult | null
  memoryRecallRows?: number
  memoryLag?: number
  contextBudgetPercent?: number
  contextOverBudget?: boolean
}

function isBlank(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0
}

function hasPlaceholder(value: string | undefined) {
  return !value
    || /\bpending\b|待定|暂无|未定|待补|缺失|placeholder|todo|tbd|still sparse|open questions?|unanswered questions?/iu.test(value)
    || /尚无|还没有|等待补充|需要补充|需要明确|无法确定/u.test(value)
}

function hasUsableStyleList(value: unknown) {
  return Array.isArray(value)
    && value.some((item) => typeof item === "string" && !hasPlaceholder(item))
}

function critical(code: string, message: string, recoveryHint: string): ProductionGateIssue {
  return { code, severity: "critical", message, recoveryHint }
}

function warning(code: string, message: string, recoveryHint: string): ProductionGateIssue {
  return { code, severity: "warning", message, recoveryHint }
}

function summarizeGate(issues: ProductionGateIssue[]): ProductionGateResult {
  const criticalIssue = issues.find((issue) => issue.severity === "critical")
  if (criticalIssue) {
    return {
      status: "blocked",
      canProceed: false,
      blockedReason: criticalIssue.message,
      issues,
    }
  }
  if (issues.length > 0) {
    return {
      status: "warning",
      canProceed: true,
      blockedReason: null,
      issues,
    }
  }
  return {
    status: "passed",
    canProceed: true,
    blockedReason: null,
    issues: [],
  }
}

export function evaluateStyleEvolutionGate(contract: StyleEvolutionContract | null | undefined): ProductionGateResult {
  const issues: ProductionGateIssue[] = []
  if (!contract) {
    return summarizeGate([
      critical(
        "style_contract_missing",
        "本书写法尚未生成，不能进入正文创作。",
        "先进入 Style Evolution Engine，生成样段并冻结本书写法合同。",
      ),
    ])
  }
  if (isBlank(contract.seedPrompt)) {
    issues.push(critical(
      "style_seed_missing",
      "Style Evolution Engine 缺少初始 prompt。",
      "补齐 style-seed.md 或让系统基于用户风格要求生成初始 prompt。",
    ))
  }
  if (isBlank(contract.approvedSample) && isBlank(contract.approvedSamplePath)) {
    issues.push(critical(
      "approved_sample_missing",
      "用户尚未确认任何小说写作样段。",
      "反复生成样段，直到用户确认一个可以冻结为全书统一写法合同的版本。",
    ))
  }
  if (isBlank(contract.approvedAt)) {
    issues.push(critical(
      "style_approval_missing",
      "本书写法尚未获得用户确认。",
      "用户需要在 Style Contract Freeze Gate 中确认采用当前写法，系统再冻结 style-contract。",
    ))
  }
  if (contract.approvedAt && contract.approval?.acceptedAsBookStyle !== true) {
    issues.push(critical(
      "style_approval_semantics_missing",
      "Style Contract Freeze Gate 缺少“作为全书基础写法”的冻结语义。",
      "用户确认的必须是整本书后续统一继承的写法，不是单次样段通过。",
    ))
  }
  if (contract.approvedAt && !contract.verification?.status) {
    issues.push(critical(
      "style_generation_verification_missing",
      "冻结写法合同缺少 Generation Verification Gate 结果。",
      "重新运行 Style Evolution Engine，完成 AIGC/禁忌命中验证并通过后，再冻结全书写法合同。",
    ))
  }
  if (contract.approvedAt && contract.verification?.status === "blocked") {
    issues.push(critical(
      "style_generation_verification_blocked",
      "冻结写法合同的 Generation Verification Gate 仍处于阻塞状态。",
      "重新运行 Style Evolution Engine，先通过 AIGC/禁忌命中验证，再冻结全书写法合同。",
    ))
  }
  if (contract.approvedAt && contract.verification?.status && contract.verification.status !== "passed" && contract.verification.status !== "blocked") {
    issues.push(critical(
      "style_generation_verification_not_passed",
      "冻结写法合同的 Generation Verification Gate 尚未通过。",
      "继续运行 Style Evolution Engine，直到样段验证状态为 passed，再冻结全书写法合同。",
    ))
  }
  if (contract.approvedAt && contract.freezer?.verdict !== "ready") {
    issues.push(critical(
      "style_freezer_not_ready",
      "Style Contract Freezer 尚未明确放行整书写法合同。",
      "继续运行 Style Evolution Engine，直到 Freezer verdict 为 ready，再允许章节生产继承该写法。",
    ))
  }
  if (contract.approvedAt) {
    const protocol = contract.loopProtocol
    const requiredStages = Array.isArray(protocol?.requiredStages) ? protocol.requiredStages : []
    const completedStages = Array.isArray(protocol?.completedStages) ? protocol.completedStages : []
    const requiredLoopStages = [
      "seed_prompt_builder",
      "candidate_generator",
      "evaluator_critic",
      "prompt_refiner",
      "loop_controller",
      "generation_verification",
      "user_approval_gate",
      "style_contract_freezer",
      "chapter_inheritance_adapter",
    ]
    const missingProtocolStages = requiredLoopStages.filter((stage) => !completedStages.includes(stage))
    if (!protocol || requiredStages.length === 0 || missingProtocolStages.length > 0) {
      issues.push(critical(
        "style_loop_protocol_incomplete",
        "冻结写法合同缺少完整 Loop Engineering 协议证据。",
        "重新加载或运行 Style Evolution Engine，让 Seed Prompt、候选生成、评估、Refiner、验证、用户确认、Freezer 和章节继承全部写入 loopProtocol。",
      ))
    }
    if (protocol?.status && protocol.status !== "approved") {
      issues.push(critical(
        "style_loop_protocol_not_approved",
        "Style Evolution Loop 协议尚未进入 approved 状态。",
        "只有完整闭环通过并由用户确认后，才能冻结为整书写法合同。",
      ))
    }
  }
  if (!contract.styleContract || hasPlaceholder(contract.styleContract.voice)) {
    issues.push(critical(
      "style_contract_voice_missing",
      "写法合同缺少明确叙述声音。",
      "从用户确认样段中提炼 voice、句式节奏、对话规则和禁用模式。",
    ))
  }
  if (!contract.styleContract || hasPlaceholder(contract.styleContract.sentenceRhythm)) {
    issues.push(critical(
      "style_contract_sentence_rhythm_missing",
      "写法合同缺少可执行的句式节奏规则。",
      "从用户确认样段中提炼句长、停顿、动作密度和情绪留白规则。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.dialogueRules)) {
    issues.push(critical(
      "style_contract_dialogue_rules_missing",
      "写法合同缺少可执行的对白规则。",
      "补齐对白长度、潜台词、关系压力和禁止解释腔等规则。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.descriptionRules)) {
    issues.push(critical(
      "style_contract_description_rules_missing",
      "写法合同缺少可执行的描写规则。",
      "补齐场景、物件、动作、感官和判断顺序等描写约束。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.emotionRules)) {
    issues.push(critical(
      "style_contract_emotion_rules_missing",
      "写法合同缺少可执行的情绪外化规则。",
      "补齐情绪如何通过动作、停顿、选择和细节呈现，避免直接解释人物心理。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.pacingRules)) {
    issues.push(critical(
      "style_contract_pacing_rules_missing",
      "写法合同缺少可执行的节奏推进规则。",
      "补齐压力进入、信息释放、场景推进和余波钩子的节奏约束。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.povRules)) {
    issues.push(critical(
      "style_contract_pov_rules_missing",
      "写法合同缺少可执行的视角规则。",
      "补齐视角边界、信息权限和不得越权泄露的规则。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.openingRules)) {
    issues.push(critical(
      "style_contract_opening_rules_missing",
      "写法合同缺少可执行的章节开场规则。",
      "补齐章节如何进入场景压力、人物动作和当前冲突。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.endingHookRules)) {
    issues.push(critical(
      "style_contract_ending_hook_rules_missing",
      "写法合同缺少可执行的章节结尾钩子规则。",
      "补齐每章结尾如何留下问题、关系裂缝或线索推进。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.forbiddenPatterns)) {
    issues.push(critical(
      "style_contract_forbidden_patterns_missing",
      "写法合同缺少冻结后的禁用模式。",
      "补齐必须规避的 AI 腔、模板腔、同质化对白和总结式表达。",
    ))
  }
  if (contract.styleContract && !Array.isArray(contract.styleContract.allowedDevices)) {
    issues.push(critical(
      "style_contract_allowed_devices_missing",
      "写法合同缺少 allowedDevices 数组字段。",
      "冻结前至少把 allowedDevices 标准化为空数组；如有可复用技法，应明确写入。",
    ))
  }
  if (!contract.styleContract || !hasUsableStyleList(contract.styleContract.positiveExamples)) {
    issues.push(critical(
      "style_contract_positive_examples_missing",
      "写法合同缺少用户确认样段中的正向例句。",
      "从用户满意样段中抽取可复用的正向写法片段，作为后续章节的风格参照。",
    ))
  }
  if (contract.styleContract && !Array.isArray(contract.styleContract.negativeExamples)) {
    issues.push(critical(
      "style_contract_negative_examples_missing",
      "写法合同缺少 negativeExamples 数组字段。",
      "冻结前至少把 negativeExamples 标准化为空数组；如有反例，应明确写入。",
    ))
  }
  if (contract.approvedAt && contract.inheritance?.status !== "enforced") {
    issues.push(warning(
      "style_inheritance_not_enforced",
      "写法合同尚未显式声明正文继承约束。",
      "冻结后要明确 base prompt、style contract、禁用模式和正例会强制继承到后续章节。",
    ))
  }
  if (!contract.antiPatterns || contract.antiPatterns.length === 0) {
    issues.push(warning(
      "anti_patterns_missing",
      "写法合同缺少反向禁用模式。",
      "补充禁止的 AI 味、套话、节奏和人物声音问题，后续审校会更稳。",
    ))
  }
  return summarizeGate(issues)
}

export function evaluateChapterBlueprintGate(blueprint: ChapterBlueprintContract | null | undefined): ProductionGateResult {
  const issues: ProductionGateIssue[] = []
  if (!blueprint) {
    return summarizeGate([
      critical(
        "chapter_blueprint_missing",
        "章节执行合同不存在，不能生成正文。",
        "先生成包含章节定位、节奏、场景卡和禁用项的章节蓝图。",
      ),
    ])
  }

  for (const [key, value] of [
    ["title", blueprint.title],
    ["chapterRole", blueprint.chapterRole],
    ["chapterPurpose", blueprint.chapterPurpose],
    ["suspenseLevel", blueprint.suspenseLevel],
    ["foreshadowingOperation", blueprint.foreshadowingOperation],
    ["emotionTarget", blueprint.emotionTarget],
    ["endingHook", blueprint.endingHook],
    ["nextChapterEntryState", blueprint.nextChapterEntryState],
  ] as Array<[string, string]>) {
    if (hasPlaceholder(value)) {
      issues.push(critical(
        `chapter_${key}_missing`,
        `章节蓝图缺少可执行字段：${key}。`,
        "重新生成或补齐章节执行合同，不能让 pending/待定 字段进入正文生产。",
      ))
    }
  }

  if (!["E", "F", "P", "C"].includes(blueprint.macroBeat)) {
    issues.push(critical(
      "chapter_macro_beat_invalid",
      "章节 macroBeat 必须是 E/F/P/C 之一。",
      "按 1234 叙事循环为本章指定唯一节拍，避免单章闭环。",
    ))
  }
  if (!Number.isFinite(blueprint.targetWordCount) || blueprint.targetWordCount < 1000) {
    issues.push(critical(
      "chapter_word_target_invalid",
      "章节目标字数无效。",
      "为章节执行合同设置合理 targetWordCount。",
    ))
  }
  if (!Array.isArray(blueprint.mustAvoid) || blueprint.mustAvoid.length === 0) {
    issues.push(critical(
      "chapter_must_avoid_missing",
      "章节执行合同缺少 mustAvoid 禁用项。",
      "补齐本章禁止越权、禁止提前揭示、禁止人物跑偏等限制。",
    ))
  }
  if (!Array.isArray(blueprint.allowedCharacters) || blueprint.allowedCharacters.length === 0) {
    issues.push(critical(
      "chapter_allowed_characters_missing",
      "章节执行合同缺少允许登场人物。",
      "从人物档案和章节任务中确定本章允许登场的人物清单。",
    ))
  }
  if (!Array.isArray(blueprint.sceneCards) || blueprint.sceneCards.length === 0) {
    issues.push(critical(
      "chapter_scene_cards_missing",
      "章节执行合同缺少 sceneCards。",
      "按场景拆分目标、冲突、转折和结尾钩子，再进入多场景生成。",
    ))
  } else {
    for (const scene of blueprint.sceneCards) {
      if (hasPlaceholder(scene.goal) || hasPlaceholder(scene.conflict) || hasPlaceholder(scene.turn) || hasPlaceholder(scene.endHook)) {
        issues.push(critical(
          `scene_card_${scene.index}_incomplete`,
          `第 ${scene.index} 个场景卡不完整。`,
          "补齐每个场景的 goal、conflict、turn、endHook。",
        ))
      }
    }
  }

  return summarizeGate(issues)
}

export function evaluateChapterExecutionReadiness(input: {
  style: StyleEvolutionContract | null | undefined
  blueprint: ChapterBlueprintContract | null | undefined
}): ProductionGateResult {
  const styleGate = evaluateStyleEvolutionGate(input.style)
  const blueprintGate = evaluateChapterBlueprintGate(input.blueprint)
  return summarizeGate([...styleGate.issues, ...blueprintGate.issues])
}

function readinessItem(input: {
  key: string
  label: string
  gate: ProductionGateResult
  passedDetail: string
  blockedDetail: string
  warningDetail?: string
}): ProductionReadinessItem {
  return {
    key: input.key,
    label: input.label,
    status: input.gate.status,
    detail: input.gate.status === "passed"
      ? input.passedDetail
      : input.gate.status === "warning"
        ? input.warningDetail || input.gate.issues[0]?.message || input.blockedDetail
        : input.gate.blockedReason || input.blockedDetail,
    issueCodes: input.gate.issues.map((issue) => issue.code),
    recoveryHint: input.gate.issues[0]?.recoveryHint || "",
  }
}

function readinessGroup(input: {
  key: string
  label: string
  assets: ProductionReadinessAsset[]
  emptySummary: string
}): ProductionReadinessGroup {
  const blocked = input.assets.filter((asset) => asset.status === "blocked").length
  const warningCount = input.assets.filter((asset) => asset.status === "warning").length
  const passed = input.assets.filter((asset) => asset.status === "passed").length
  return {
    key: input.key,
    label: input.label,
    status: blocked > 0 ? "blocked" : warningCount > 0 ? "warning" : "passed",
    summary: input.assets.length
      ? `${passed}/${input.assets.length} 已就绪${blocked ? `，${blocked} 项缺失` : warningCount ? `，${warningCount} 项待补强` : ""}`
      : input.emptySummary,
    assets: input.assets,
  }
}

export function evaluateProductionReadiness(input: ProductionReadinessInput): ProductionReadinessSnapshot {
  const totalChapters = Math.max(0, Number(input.totalChapters || 0))
  const blueprintCount = Math.max(0, Number(input.blueprintCount || 0))
  const planningArtifactCount = Math.max(0, Number(input.planningArtifactCount || 0))
  const planningRequiredAssetCount = Math.max(0, Number(input.planningRequiredAssetCount || 0))
  const planningRequiredAssets = Array.isArray(input.planningRequiredAssets) && input.planningRequiredAssets.length
    ? input.planningRequiredAssets
    : [
        "world-matrix.md",
        "plot-architecture.md",
        "story-bible.md",
        "volume-strategy.md",
        "foreshadowing-ledger.md",
        "character-dynamics.md",
        "story-foundation-contract.json",
        "world-matrix.json",
        "plot-architecture.json",
        "story-bible.json",
        "volume-strategy.json",
        "foreshadowing-ledger.json",
        "character-dynamics.json",
        "writing-plan.json",
      ]
  const planningMissingRequiredAssets = Array.isArray(input.planningMissingRequiredAssets)
    ? input.planningMissingRequiredAssets.filter(Boolean)
    : planningRequiredAssets.slice(planningRequiredAssetCount)
  const planningAssetDetails = Array.isArray(input.planningAssetDetails) && input.planningAssetDetails.length
    ? input.planningAssetDetails
    : planningRequiredAssets.map((asset) => ({
      key: asset.replace(/\.md$/u, "").replace(/[^a-z0-9]+/giu, "_"),
      label: asset,
      path: `.ai-novel/plans/${asset}`,
      status: planningMissingRequiredAssets.includes(asset) ? "blocked" as const : "passed" as const,
      detail: planningMissingRequiredAssets.includes(asset) ? "缺失" : "已生成",
    }))
  const planningRequiredTotal = planningRequiredAssets.length
  const blockedPlanningAssetLabels = Array.from(new Set([
    ...planningMissingRequiredAssets,
    ...planningAssetDetails
      .filter((asset) => asset.status === "blocked")
      .map((asset) => asset.label || asset.key)
      .filter(Boolean),
  ]))
  const readyPlanningAssetCount = planningAssetDetails.filter((asset) => asset.status === "passed").length
  const characterDossierCount = Math.max(0, Number(input.characterDossierCount || 0))
  const characterDossierGaps = Array.isArray(input.characterDossierGaps) ? input.characterDossierGaps : []
  const memoryRecallRows = Math.max(0, Number(input.memoryRecallRows || 0))
  const memoryLag = Math.max(0, Number(input.memoryLag || 0))
  const contextBudgetPercent = Math.max(0, Number(input.contextBudgetPercent || 0))

  const consensusGate = summarizeGate(String(input.consensusText || "").trim()
    ? []
    : [critical(
      "core_consensus_missing",
      "缺少可追踪的核心创作共识。",
      "先完成核心创意、读者承诺、主角压力和世界规则的统一讨论，并写入 consensus。",
    )])

  const planningGate = summarizeGate(readyPlanningAssetCount >= planningRequiredTotal && blockedPlanningAssetLabels.length === 0
    ? []
    : planningRequiredAssetCount > 0 || planningArtifactCount > 0
      ? [critical(
        "story_planning_assets_incomplete",
        `前置故事资产尚未完整，缺少或不可执行：${blockedPlanningAssetLabels.join("、") || "核心故事资产"}。`,
        "补齐 world-matrix、plot-architecture、story-bible、volume-strategy、foreshadowing-ledger、character-dynamics、对应 JSON 契约和 writing-plan 后再进入正文生产。",
      )]
      : [critical(
      "story_planning_assets_sparse",
      "世界观、主线、人物关系、伏笔账本和故事圣经尚未生成，不能进入正文生产。",
      "先生成世界矩阵、主线架构、故事圣经、分卷策略、伏笔账本、人物关系资产、结构化 JSON 契约和写作执行计划，再拆章节写正文。",
    )])
  const storyFoundationApprovalGate = summarizeGate(
    !input.storyFoundationApproved
      ? [critical(
        "story_foundation_approval_missing",
        "故事基建尚未由用户确认，不能进入正文生产。",
        "先补齐并审阅世界观、主线、人物关系、伏笔账本和写作计划，确认可执行后再解锁正文生产。",
      )]
      : input.storyFoundationApprovalFingerprint && input.storyFoundationAssetFingerprint && input.storyFoundationApprovalFingerprint !== input.storyFoundationAssetFingerprint
      ? [critical(
        "story_foundation_approval_stale",
        "故事基建已被修改，旧确认已失效。",
        "重新审阅世界观、主线、人物关系、伏笔账本和写作执行计划，并再次确认。",
      )]
      : [],
  )

  const characterGate = summarizeGate(characterDossierCount <= 0
    ? [critical(
      "character_dossiers_missing",
      "缺少可执行人物档案和人物关系。",
      "为主角、对抗力量和关键关系人物补齐欲望、伤口、行为习惯、说话方式、关系状态和变化轨迹。",
    )]
    : characterDossierGaps.length > 0
      ? [warning(
        "character_dossiers_incomplete",
        "人物档案仍有关键字段缺口。",
        "补齐人物欲望、伤口、行为习惯、说话方式和关系变化，避免正文人物扁平化。",
      )]
      : [])

  const blueprintGate = summarizeGate(totalChapters > 0 && blueprintCount >= totalChapters
    ? []
    : blueprintCount > 0
      ? [critical(
        "chapter_blueprints_partial",
        "章节蓝图尚未覆盖全书，不能进入正文生产。",
        "继续生成剩余章节蓝图，确保每章都有因果目标、场景卡、伏笔操作和交棒状态。",
      )]
      : [critical(
        "chapter_blueprints_missing",
        "缺少章节蓝图，不能稳定进入正文生产。",
        "先按故事圣经拆出章节执行合同，而不是直接让模型写正文。",
      )])

  const styleGate = input.styleGate || summarizeGate([critical(
    "style_gate_missing",
    "缺少 Style Contract Freeze Gate 结果。",
    "先运行 Style Evolution Engine，用户确认样段后再进入正文生产。",
  )])

  const memoryGate = summarizeGate(memoryRecallRows > 0 && memoryLag <= 1
    ? []
    : [warning(
      "memory_recall_sparse",
      "记忆/RAG 可召回内容不足。",
      "重新索引共识、人物档案、规划和已完成章节，确保后续章节能承接事实与伏笔。",
    )])

  const contextGate = summarizeGate(input.contextOverBudget || contextBudgetPercent >= 90
    ? [warning(
      "context_budget_pressure",
      "上下文预算接近或超过安全范围。",
      "压缩共识、拆分章节场景调用，保留当前场景必需事实，避免一次请求塞入过多资料。",
    )]
    : [])

  const itemInputs = [
    {
      key: "core_consensus",
      label: "核心共识",
      gate: consensusGate,
      passedDetail: "已有可追踪共识",
      blockedDetail: "缺少创作共识",
    },
    {
      key: "story_planning",
      label: "世界/主线",
      gate: planningGate,
      passedDetail: `${readyPlanningAssetCount}/${planningRequiredTotal} 个核心资产`,
      blockedDetail: "缺少世界观、主线和故事圣经",
      warningDetail: `${readyPlanningAssetCount}/${planningRequiredTotal} 个核心资产，${planningArtifactCount} 个规划产物`,
    },
    {
      key: "character_dynamics",
      label: "人物关系",
      gate: characterGate,
      passedDetail: `${characterDossierCount} 个档案`,
      blockedDetail: "缺少人物档案",
      warningDetail: `${characterDossierCount} 个档案，${characterDossierGaps.length} 个缺口`,
    },
    {
      key: "story_foundation_approval",
      label: "基建确认",
      gate: storyFoundationApprovalGate,
      passedDetail: input.storyFoundationApprovedAt ? `已确认 ${input.storyFoundationApprovedAt}` : "用户已确认",
      blockedDetail: "需要用户确认故事基建",
    },
    {
      key: "chapter_blueprints",
      label: "章节蓝图",
      gate: blueprintGate,
      passedDetail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} 个蓝图`,
      blockedDetail: "缺少章节执行合同",
      warningDetail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} 个蓝图`,
    },
    {
      key: "style_approval",
      label: "Style Freeze",
      gate: styleGate,
      passedDetail: "已冻结全书写法合同",
      blockedDetail: "需要完成 Loop 并冻结 style contract",
    },
    {
      key: "memory_recall",
      label: "记忆/RAG",
      gate: memoryGate,
      passedDetail: `${memoryRecallRows} 条可召回`,
      blockedDetail: "缺少可召回记忆",
      warningDetail: `${memoryRecallRows} 条可召回，滞后 ${memoryLag}`,
    },
    {
      key: "context_budget",
      label: "上下文预算",
      gate: contextGate,
      passedDetail: `${contextBudgetPercent}%`,
      blockedDetail: "上下文过载",
      warningDetail: `${contextBudgetPercent}%`,
    },
  ]

  const items = itemInputs.map(readinessItem)
  const characterAssetDetails = Array.isArray(input.characterAssetDetails) && input.characterAssetDetails.length
    ? input.characterAssetDetails
    : [
      {
        key: "character_dossiers",
        label: "人物档案",
        path: ".ai-novel/memory/characters/dossiers.json",
        status: characterGate.status,
        detail: characterGate.status === "passed" ? `${characterDossierCount} 个档案` : characterGate.blockedReason || "待补齐",
      },
    ]
  const executionAssetDetails = Array.isArray(input.executionAssetDetails) && input.executionAssetDetails.length
    ? input.executionAssetDetails
    : [
      {
        key: "chapter_blueprints",
        label: "章节蓝图",
        path: ".ai-novel/chapter-blueprints/",
        status: blueprintGate.status,
        detail: totalChapters > 0 ? `${blueprintCount}/${totalChapters}` : `${blueprintCount} 个蓝图`,
      },
      {
        key: "style_contract",
        label: "写法合同",
        path: ".ai-novel/style/evolution/style-contract.json",
        status: styleGate.status,
        detail: styleGate.status === "passed" ? "已冻结" : styleGate.blockedReason || "待确认",
      },
    ]
  const groups = [
    readinessGroup({
      key: "story_foundation",
      label: "故事基建",
      assets: [
        {
          key: "core_consensus",
          label: "核心共识",
          path: ".ai-novel/prompts/global-consensus.md",
          status: consensusGate.status,
          detail: consensusGate.status === "passed" ? "已生成" : consensusGate.blockedReason || "缺失",
        },
        ...planningAssetDetails,
        {
          key: "story_foundation_approval",
          label: "用户确认",
          path: input.storyFoundationApprovalPath || ".ai-novel/plans/story-foundation-approval.json",
          status: storyFoundationApprovalGate.status,
          detail: storyFoundationApprovalGate.status === "passed"
            ? input.storyFoundationApprovedAt ? `已确认 ${input.storyFoundationApprovedAt}` : "已确认"
            : storyFoundationApprovalGate.blockedReason || "待确认",
        },
      ],
      emptySummary: "尚未检查故事基建",
    }),
    readinessGroup({
      key: "character_system",
      label: "人物系统",
      assets: characterAssetDetails,
      emptySummary: "尚未检查人物系统",
    }),
    readinessGroup({
      key: "chapter_execution",
      label: "正文执行",
      assets: [
        ...executionAssetDetails,
        {
          key: "memory_recall",
          label: "记忆/RAG",
          path: ".ai-novel/memory/",
          status: memoryGate.status,
          detail: memoryGate.status === "passed" ? `${memoryRecallRows} 条可召回` : `${memoryRecallRows} 条可召回，滞后 ${memoryLag}`,
        },
        {
          key: "context_budget",
          label: "上下文预算",
          path: ".ai-novel/context/",
          status: contextGate.status,
          detail: `${contextBudgetPercent}%`,
        },
      ],
      emptySummary: "尚未检查正文执行条件",
    }),
  ]
  const issues = itemInputs.flatMap((item) => item.gate.issues)
  const blocked = items.filter((item) => item.status === "blocked").length
  const warningCount = items.filter((item) => item.status === "warning").length
  const passed = items.filter((item) => item.status === "passed").length
  const score = Math.round(((passed + warningCount * 0.5) / Math.max(1, items.length)) * 100)
  const gate = summarizeGate(issues)

  return {
    status: gate.status,
    canProceed: gate.canProceed,
    score,
    summary: blocked > 0
      ? `${blocked} 项阻塞正文生产`
      : warningCount > 0
        ? `${warningCount} 项建议补强`
        : "正文生产准备完成",
    blockedReason: gate.blockedReason,
    items,
    groups,
    issues,
  }
}
