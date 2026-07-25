import {
  saveAutonomousState,
  upsertDiscussionInSuperGraph
} from "./chunk-EVOZRM5F.js";
import {
  generateAgentReply,
  throwIfStopped
} from "./chunk-PJFTMRLC.js";
import {
  retrieveKnowledge
} from "./chunk-YV6Y5W7F.js";
import {
  createLocalTextEmbedding
} from "./chunk-YFTWM6FA.js";
import {
  FactoryDb,
  makeAgentTurnId,
  makeRunId,
  targetToArtifactKind
} from "./chunk-CJRUVXRQ.js";
import {
  createAgentMessage,
  createArtifactMessage
} from "./chunk-GZKJNHMN.js";

// src/discussion.ts
import fs from "fs/promises";
import path from "path";

// src/context-budget.ts
var CONTEXT_BUDGET = {
  // 各类 Agent 的总上下文上限
  independent_total: 8e3,
  // World Architect / Author / Prose Stylist（独立视角，不累积他人发言）
  reviewer_total: 1e4,
  // Editor / Reviewer（需要看前面专家的核心意见）
  synthesis_total: 16e3,
  // Showrunner closing_synthesis（需要综合所有专家输出）
  opening_total: 8e3,
  // Showrunner opening_brief（需要看上一次讨论结论）
  // 各层独立上限
  story_core: 2e3,
  // Layer 1：小说核心（标题/主角/阶段/讨论目标）
  role_specific: 4e3,
  // Layer 3：角色专属内容（暂留给调用方控制）
  history: {
    independent: 0,
    // 独立视角专家：不传历史（避免锚定效应）
    reviewer: 1e3,
    // Editor/Reviewer：只看 World Architect + Author 的核心发言
    synthesis: 3e3,
    // Showrunner 综合：所有专家发言的精华摘要
    opening: 500
    // Showrunner 开场：上一轮最终结论摘要
  }
};
var NOISE_PATTERNS = [
  /\[LLM\s+REQUEST/i,
  /\[LLM\s+STREAM/i,
  /请求已送达\s*LLM/,
  /正在持续返回内容/,
  /LLM\s+已开始响应/,
  /LLM\s+返回完成/,
  /Status:\s*(in_progress|running|completed|error)/i,
  /step_\w+_(started|completed|streaming)/,
  /知识库召回/,
  /score:\s*[\d.]+/,
  /phase:\s*\w+/,
  /statusText:/,
  /statusDetail:/,
  /Agent.*消息会在模型返回/,
  /请求已提交给\s*LLM/,
  /等待模型开始响应/,
  /返回内容会持续合并/
];
function filterCreativeHistory(transcript, maxChars) {
  if (!transcript.trim() || maxChars <= 0) return "";
  const filtered = transcript.split("\n").filter((line) => !NOISE_PATTERNS.some((p) => p.test(line))).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!filtered) return "";
  if (filtered.length <= maxChars) return filtered;
  return "\u2026[\u5386\u53F2\u5DF2\u622A\u65AD\uFF0C\u4FDD\u7559\u6700\u65B0\u5185\u5BB9]\n" + filtered.slice(filtered.length - maxChars);
}
function classifyAgent(agentId, discussionStage) {
  if (agentId === "showrunner") {
    return discussionStage === "closing_synthesis" ? "synthesis" : "opening";
  }
  if (agentId === "editor" || agentId === "reviewer") return "reviewer";
  return "independent";
}
function buildHistoryForAgent(agentId, discussionStage, currentReplies, priorTranscript) {
  const cls = classifyAgent(agentId, discussionStage);
  const limit = CONTEXT_BUDGET.history[cls];
  if (limit <= 0) return "";
  if (cls === "opening") {
    return filterCreativeHistory(priorTranscript, limit);
  }
  if (cls === "reviewer") {
    const relevant = currentReplies.filter((r) => r.role === "World Architect" || r.role === "Author").map((r) => `### ${r.role}
${r.content.slice(0, 450)}`).join("\n\n");
    return relevant.slice(0, limit);
  }
  if (cls === "synthesis") {
    const all = currentReplies.filter((r) => r.role !== "Showrunner").map((r) => `### ${r.role}
${r.content.slice(0, 500)}`).join("\n\n");
    return all.slice(0, limit);
  }
  return "";
}
function buildStoryCoreContext(state, sanitizedConsensus, target, userMessage) {
  const bullets = sanitizedConsensus.split("\n").filter((line) => line.trim().startsWith("-")).slice(0, 8).join("\n");
  const parts = [
    `\u9879\u76EE\uFF1A${state.project.title}`,
    `\u6838\u5FC3\u521B\u610F\uFF1A${state.project.idea}`,
    `\u5DE5\u4F5C\u6D41\u9636\u6BB5\uFF1A${state.runtime.stage}`,
    `\u8BA1\u5212\u7AE0\u8282\u6570\uFF1A${state.plan.totalChapters}\uFF0C\u6BCF\u7AE0\u76EE\u6807\u5B57\u6570\uFF1A${state.plan.chapterWordTarget}`,
    "",
    `\u672C\u8F6E\u8BA8\u8BBA\u76EE\u6807\uFF1A${target.label}`,
    `\u5199\u56DE\u8D44\u4EA7\u8DEF\u5F84\uFF1A${target.assetPath}`,
    target.instruction ? `\u76EE\u6807\u6307\u4EE4\uFF1A${target.instruction}` : "",
    "",
    `\u7528\u6237\u5F53\u524D\u6D88\u606F\uFF1A${userMessage}`,
    "",
    bullets ? `\u6838\u5FC3\u5171\u8BC6\u8981\u70B9\uFF08\u6700\u591A 8 \u6761\uFF09\uFF1A
${bullets}` : ""
  ];
  const text = parts.filter(Boolean).join("\n").trim();
  if (text.length <= CONTEXT_BUDGET.story_core) return text;
  return text.slice(0, CONTEXT_BUDGET.story_core) + "\n\u2026[\u6838\u5FC3\u5C42\u5DF2\u622A\u65AD]";
}

// src/discussion.ts
var AGENT_FLOW = [
  { id: "showrunner", label: "Showrunner" },
  { id: "world-architect", label: "World Architect" },
  { id: "author", label: "Author" },
  { id: "editor", label: "Editor" },
  { id: "reviewer", label: "Reviewer" },
  { id: "prose-stylist", label: "Prose Stylist" }
];
var SPECIALIST_FLOW = AGENT_FLOW.filter((agent) => agent.id !== "showrunner");
function workspacePath(rootDir, ...parts) {
  return path.join(rootDir, ".ai-novel", ...parts);
}
async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}
async function readOptionalText(filePath) {
  try {
    return await readText(filePath);
  } catch {
    return "";
  }
}
async function readCharacterDossiers(filePath) {
  try {
    const parsed = JSON.parse(await readText(filePath));
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string") : [];
  } catch {
    return [];
  }
}
async function writeJsonFileAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${Date.now()}.tmp`);
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}
`);
  await fs.rename(tempPath, filePath);
}
function appendSection(current, heading, bullet) {
  if (current.includes(heading)) {
    return `${current.trimEnd()}
- ${bullet}
`;
  }
  return `${current.trimEnd()}

${heading}
- ${bullet}
`;
}
function appendUnique(values = [], next, limit = 10) {
  const normalized = next.trim();
  if (!normalized) return values.slice(0, limit);
  return [...values.filter((value) => value !== normalized), normalized].slice(-limit);
}
function compactList(values = [], limit = 3) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit).join("; ") || "pending";
}
function formatCharacterDossiersMarkdown(dossiers) {
  return [
    "# Character Dossiers",
    "",
    "This file is generated from the structured production character dossier state.",
    "",
    ...dossiers.slice(0, 12).map((dossier) => [
      `## ${dossier.canonicalName}`,
      `- id: ${dossier.id}`,
      `- role: ${dossier.role}`,
      `- aliases: ${dossier.aliases.join(", ") || "none"}`,
      `- identity and role: ${dossier.identityAndRole}`,
      `- core desire: ${dossier.coreDesire}`,
      `- fear or wound: ${dossier.fearOrWound}`,
      `- habits: ${compactList(dossier.behaviorHabits)}`,
      `- speech: ${compactList(dossier.speechMarkers)}`,
      `- relationship state: ${dossier.relationshipState}`,
      `- current chapter delta: ${dossier.currentChapterDelta}`,
      `- latest evidence: ${dossier.evidence.slice(-2).join(" | ") || "none"}`
    ].join("\n"))
  ].join("\n\n");
}
function summarizeDossiersForContext(dossiers = [], limit = 3) {
  const selected = [
    ...dossiers.filter((dossier) => dossier.role === "protagonist"),
    ...dossiers.filter((dossier) => dossier.role !== "protagonist")
  ].slice(0, limit);
  return selected.map((dossier) => [
    `- ${dossier.id} (${dossier.role}) name=${dossier.canonicalName}`,
    `  desire=${clipText(dossier.coreDesire, 90)}; wound=${clipText(dossier.fearOrWound, 90)}`,
    `  habit=${compactList(dossier.behaviorHabits, 2)}; speech=${compactList(dossier.speechMarkers, 2)}`,
    `  relation=${clipText(dossier.relationshipState, 120)}`,
    `  delta=${clipText(dossier.currentChapterDelta, 120)}`
  ].join("\n")).join("\n");
}
function extractDiscussionField(source, labels) {
  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
  const match = source.match(new RegExp(`(?:${labelPattern})\\s*(?:\u662F|\u4E3A|:|\uFF1A)?\\s*[\u300C\u201C"]?([^\uFF0C\u3002\uFF1B;\\n\u300D\u201D"]{2,80})`, "u"));
  return match?.[1]?.trim() || "";
}
function extractConfirmedProtagonistDetails(message) {
  const namePatterns = [
    /主角(?:姓名|名字)?\s*(?:冻结|确定|定为|设为|叫|是|为|:|：)?\s*(?:为|成|:|：)?\s*[「“"]?([\u4e00-\u9fff·]{2,8})/u,
    /(?:Canonical Protagonist|核心主角|主角姓名)[:：]\s*([\u4e00-\u9fff·]{2,8})/u
  ];
  const rawName = namePatterns.map((pattern) => message.match(pattern)?.[1] || "").find(Boolean) || "";
  const name = /^(?:姓名|名字|冻结|确定|待定|未命名|主角|角色)$/u.test(rawName) ? "" : rawName;
  if (!name) return null;
  return {
    name,
    identity: extractDiscussionField(message, ["\u8EAB\u4EFD", "\u8EAB\u4EFD\u662F", "\u89D2\u8272\u529F\u80FD", "\u804C\u4E1A"]),
    desire: extractDiscussionField(message, ["\u6838\u5FC3\u6B32\u671B", "\u6B32\u671B", "\u76EE\u6807"]),
    wound: extractDiscussionField(message, ["\u4F24\u53E3/\u6050\u60E7", "\u4F24\u53E3", "\u6050\u60E7"]),
    habit: extractDiscussionField(message, ["\u884C\u4E3A\u4E60\u60EF", "\u4E60\u60EF"]),
    speech: extractDiscussionField(message, ["\u8BF4\u8BDD\u65B9\u5F0F", "\u5BF9\u767D\u4E60\u60EF", "\u8BED\u8A00\u4E60\u60EF"]),
    relationship: extractDiscussionField(message, ["\u5173\u7CFB\u538B\u529B", "\u5173\u7CFB"])
  };
}
function formatProtagonistLockSection(details) {
  return [
    `Canonical Protagonist: ${details.name}`,
    details.identity ? `- identity: ${details.identity}` : "",
    details.desire ? `- core desire: ${details.desire}` : "",
    details.wound ? `- fear or wound: ${details.wound}` : "",
    details.habit ? `- behavior habit: ${details.habit}` : "",
    details.speech ? `- speech marker: ${details.speech}` : "",
    details.relationship ? `- relationship pressure: ${details.relationship}` : ""
  ].filter(Boolean).join("\n");
}
function updateCharacterDossiersFromDiscussion(input) {
  if (input.targetKind !== "character" && !/主角|角色|人物|性格|character|protagonist/i.test(input.message)) {
    return [];
  }
  const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const evidence = `discussion ${input.runId}: ${input.message}`.slice(0, 240);
  const continuityNote = `discussion ${input.runId}: ${input.summary.replace(/\s+/g, " ").slice(0, 220)}`;
  const protagonistDetails = extractConfirmedProtagonistDetails(input.message);
  return input.dossiers.map((dossier) => {
    const isProtagonist = dossier.role === "protagonist" || dossier.id === "protagonist";
    if (!isProtagonist) return dossier;
    const aliases = protagonistDetails?.name ? appendUnique(dossier.aliases || [], protagonistDetails.name, 6) : dossier.aliases;
    return {
      ...dossier,
      canonicalName: protagonistDetails?.name || dossier.canonicalName,
      aliases,
      identityAndRole: protagonistDetails?.identity || dossier.identityAndRole,
      coreDesire: protagonistDetails?.desire || dossier.coreDesire,
      fearOrWound: protagonistDetails?.wound || dossier.fearOrWound,
      behaviorHabits: protagonistDetails?.habit ? appendUnique(dossier.behaviorHabits || [], protagonistDetails.habit, 6) : dossier.behaviorHabits,
      speechMarkers: protagonistDetails?.speech ? appendUnique(dossier.speechMarkers || [], protagonistDetails.speech, 6) : dossier.speechMarkers,
      relationshipState: protagonistDetails?.relationship || dossier.relationshipState,
      currentChapterDelta: `discussion: ${input.message}`,
      continuityNotes: appendUnique(dossier.continuityNotes, continuityNote),
      evidence: appendUnique(dossier.evidence, evidence),
      updatedAt
    };
  });
}
function sanitizeConsensusForDiscussion(consensus) {
  const blockedPatterns = [
    /option b/i,
    /what is your choice/i,
    /i am standing by/i,
    /type your ideas/i,
    /type "option b"/i,
    /the fast track/i,
    /the custom path/i,
    /cannot move to/i,
    /reply with/i,
    /system status/i,
    /current task/i,
    /word count/i,
    /plot progress/i,
    /character update/i,
    /draft chapter/i,
    /the creative process is now fully autonomous/i,
    /chapter\s+\d+/i,
    /第\s*\d+\s*章/u
  ];
  const sanitizedLines = consensus.split("\n").filter((line) => !blockedPatterns.some((pattern) => pattern.test(line)));
  return sanitizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
function extractSummaryBullets(summary, limit = 8) {
  const bullets = summary.split("\n").map((line) => line.trim()).filter((line) => line.startsWith("-")).slice(0, limit);
  if (bullets.length > 0) {
    return bullets;
  }
  const meaningful = summary.split("\n").map((line) => line.trim()).filter(Boolean).filter((line) => !line.startsWith("###")).slice(0, 4);
  return meaningful.map((line) => `- ${line}`);
}
function buildCompactConsensus(state, latestSummary) {
  return [
    "# Global Consensus",
    "",
    `Project: ${state.project.title}`,
    `Core idea: ${state.project.idea}`,
    `Target chapters: ${state.plan.totalChapters}`,
    `Chapter word target: ${state.plan.chapterWordTarget}`,
    `Current workflow stage: ${state.runtime.stage}`,
    "",
    "Confirmed truths:",
    "- \u9ED8\u8BA4\u8F93\u51FA\u8BED\u8A00\u4E3A\u7B80\u4F53\u4E2D\u6587\u3002",
    "- \u6240\u6709\u8BA8\u8BBA\u5FC5\u987B\u4E0E\u5F53\u524D workflow stage \u4FDD\u6301\u540C\u6B65\u3002",
    "- \u5728\u672A\u8FDB\u5165 drafting \u524D\uFF0C\u4E0D\u5141\u8BB8\u4F2A\u88C5\u6210\u5DF2\u7ECF\u5728\u5199\u5177\u4F53\u7AE0\u8282\u6B63\u6587\u3002",
    "",
    "Latest discussion summary:",
    ...extractSummaryBullets(latestSummary),
    "",
    "Current open areas:",
    ...state.reactSetup.unansweredQuestions.map((question) => `- ${question}`)
  ].join("\n");
}
function safeArtifactName(value) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "discussion";
}
function messagePart(messageId, index, type, data, createdAt) {
  return {
    id: `${messageId}:part:${index}`,
    messageId,
    index,
    type,
    data,
    createdAt
  };
}
function discussionMessageParts(messageId, input) {
  return [
    messagePart(messageId, 0, "markdown", { text: input.content }, input.createdAt),
    messagePart(messageId, 1, "json", {
      role: input.role,
      discussionStage: input.discussionStage,
      target: input.target,
      currentStage: input.currentStage,
      source: "discussion_agent_turn"
    }, input.createdAt)
  ];
}
function discussionArtifactMessageParts(messageId, input) {
  const parts = [
    messagePart(messageId, 0, "markdown", { text: input.content }, input.createdAt)
  ];
  for (const artifact of input.artifacts) {
    parts.push(messagePart(messageId, parts.length, "artifact", {
      path: artifact.path,
      label: artifact.label,
      kind: artifact.kind,
      status: artifact.status || "completed"
    }, input.createdAt));
  }
  parts.push(messagePart(messageId, parts.length, "json", {
    target: input.target,
    currentStage: input.currentStage,
    source: input.source,
    artifacts: input.artifacts
  }, input.createdAt));
  return parts;
}
async function writeDiscussionConsensusArchive(rootDir, input) {
  const consensusDir = workspacePath(rootDir, "consensus");
  const fileName = `discussion-${safeArtifactName(input.runId)}.md`;
  const archivePath = path.join(consensusDir, fileName);
  await fs.mkdir(consensusDir, { recursive: true });
  const content = [
    "# Discussion Consensus Archive",
    "",
    `Run: ${input.runId}`,
    `Created at: ${input.startedAt}`,
    `Project: ${input.state.project.title}`,
    `Workflow stage: ${input.state.runtime.stage}`,
    `Target: ${input.target.label}`,
    `Asset: ${input.target.assetPath}`,
    `Transcript: ${input.transcriptRelativePath}`,
    `Context packet: ${input.contextPacketRelativePath}`,
    "",
    "## User Intent",
    "",
    input.message.trim(),
    "",
    "## Showrunner Final Consensus",
    "",
    input.summary.trim(),
    "",
    "## Agent Discussion Outputs",
    "",
    ...input.replies.flatMap((reply, index) => [
      `### ${index + 1}. ${reply.role}`,
      "",
      reply.content.trim(),
      ""
    ])
  ].join("\n").replace(/\n{4,}/g, "\n\n\n");
  await fs.writeFile(archivePath, `${content.trim()}
`);
  return {
    absolutePath: archivePath,
    relativePath: `.ai-novel/consensus/${fileName}`
  };
}
function stageInstructionFor(state, target) {
  if (state.runtime.stage === "worldbuilding_dialogue") {
    return `\u5F53\u524D\u4ECD\u5728\u4E16\u754C\u89C2/\u8BBE\u5B9A\u8BA8\u8BBA\u9636\u6BB5\u3002\u5141\u8BB8\u8BA8\u8BBA ${target.label}\uFF0C\u4F46\u4E0D\u5141\u8BB8\u58F0\u79F0\u5DF2\u7ECF\u8FDB\u5165\u7AE0\u8282\u6B63\u6587\u5199\u4F5C\u3001\u5177\u4F53\u7AE0\u6B21\u751F\u4EA7\u3001\u540E\u7EED\u5F27\u7EBF\u84DD\u56FE\u6216\u5168\u81EA\u52A8\u8FDE\u7EED\u6210\u7A3F\u3002\u53EA\u80FD\u8BF4\u201C\u5EFA\u8BAE\u4E0B\u4E00\u6B65\u63A8\u8FDB\u201D\uFF0C\u4E0D\u80FD\u8BF4\u201C\u5DF2\u8FDB\u5165\u4E0B\u4E00\u9636\u6BB5\u201D\u3002`;
  }
  if (state.runtime.stage === "setting_review") {
    return "\u5F53\u524D\u5728\u8BBE\u5B9A\u51BB\u7ED3\u9636\u6BB5\u3002\u5141\u8BB8\u6574\u7406\u548C\u6536\u655B\u8BBE\u5B9A\uFF0C\u4E0D\u5141\u8BB8\u76F4\u63A5\u5199\u6B63\u6587\uFF0C\u4E5F\u4E0D\u5141\u8BB8\u5BA3\u79F0\u5DF2\u8FDB\u5165\u4E3B\u7EBF\u89C4\u5212\u3001\u7AE0\u8282\u84DD\u56FE\u6216\u67D0\u5F27\u603B\u4F53\u89C4\u5212\u3002\u53EA\u80FD\u63D0\u51FA\u4E0B\u4E00\u6B65\u5EFA\u8BAE\uFF0C\u4E0D\u80FD\u66FF\u72B6\u6001\u673A\u5BA3\u5E03\u9636\u6BB5\u8DF3\u8F6C\u3002";
  }
  if (state.runtime.stage === "master_planning" || state.runtime.stage === "chapter_task_generation") {
    return "\u5F53\u524D\u5728\u89C4\u5212\u9636\u6BB5\u3002\u5141\u8BB8\u8BA8\u8BBA\u4E3B\u7EBF\u3001\u5377\u7EB2\u3001\u7AE0\u8282\u84DD\u56FE\uFF0C\u4E0D\u5141\u8BB8\u4F2A\u88C5\u6210\u5DF2\u7ECF\u5B8C\u6210\u6B63\u6587\u5199\u4F5C\uFF1B\u4E5F\u4E0D\u80FD\u5BA3\u79F0\u67D0\u9636\u6BB5\u6216\u67D0\u5F27\u5DF2\u7ECF\u5B8C\u6210\uFF0C\u9664\u975E\u7CFB\u7EDF\u72B6\u6001\u548C\u771F\u5B9E\u4EA7\u7269\u5DF2\u7ECF\u5199\u56DE\u3002";
  }
  if (state.runtime.stage === "drafting") {
    return "\u5F53\u524D\u5DF2\u8FDB\u5165 drafting\u3002\u53EF\u4EE5\u8BA8\u8BBA\u6B63\u6587\u63A8\u8FDB\u3001\u6DA6\u8272\u4E0E\u5BA1\u7A3F\uFF0C\u4F46\u4ECD\u9700\u548C\u771F\u5B9E\u7AE0\u8282\u4EFB\u52A1\u4FDD\u6301\u4E00\u81F4\u3002";
  }
  return "\u6240\u6709\u8F93\u51FA\u90FD\u5FC5\u987B\u4E0E\u5F53\u524D\u5DE5\u4F5C\u6D41\u9636\u6BB5\u4E25\u683C\u4FDD\u6301\u4E00\u81F4\u3002";
}
function detectDiscussionStageViolation(state, target, text) {
  const reasons = [];
  const currentStage = state.runtime.stage;
  const combined = text.trim();
  const positiveClaimText = combined.split("\n").map((line) => line.trim()).filter(Boolean).filter((line) => !/(不允许|不能|不得|不要|不可|如果|风险|留到|等待|必须等待|只能|建议下一步|准备进入|可进入|避免|防止|除非|guardrail|risk)/i.test(line)).join("\n");
  if (!combined || currentStage === "drafting") {
    return { blocked: false, reason: "" };
  }
  const claimsCurrentDrafting = [
    /(当前阶段|当前状态)\s*[:：]?\s*(drafting|正文写作|writing|写作阶段)/i,
    /(当前已|已进入|已经进入|正式进入|现在进入)\s*[:：]?\s*(drafting|正文写作|writing|写作阶段)/i,
    /(阶段切换确认|设定收敛已完成|设定冻结已完成|规划已完成).{0,40}(进入|切换到|转入)\s*(drafting|正文写作|writing)\s*阶段?/i
  ].some((pattern) => pattern.test(positiveClaimText));
  const claimsProducedDraft = /(本轮产出|已产出|产出|完成|生成)\s*[:：]?\s*第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,20}(初稿|草稿|正文)|第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,12}(初稿|草稿|正文).{0,20}(已完成|完成|生成|产出)/u.test(positiveClaimText);
  const hasChapterBodyHeading = /(^|\n)\s*(#{1,6}\s*)?第\s*[一二三四五六七八九十百千万\d]+\s*章\s*[·:：-]\s*\S{1,40}(\n|$)/u.test(positiveClaimText);
  const hasDraftBodyLabel = /(^|\n)\s*(正文|草稿正文|draft body)\s*[:：]\s*\S+/iu.test(positiveClaimText);
  const hasRuntimeStageCorrection = /STAGE_GUARD_CORRECTION:\s*true/i.test(combined);
  if (hasRuntimeStageCorrection) {
    reasons.push("\u6A21\u578B\u539F\u59CB\u8F93\u51FA\u89E6\u53D1\u8FD0\u884C\u65F6\u9636\u6BB5\u7EA0\u504F\uFF0C\u672C\u8F6E\u4E0D\u80FD\u5199\u5165\u751F\u4EA7\u5171\u8BC6\u3002");
  }
  if (claimsCurrentDrafting) {
    reasons.push(`\u5F53\u524D\u7CFB\u7EDF\u9636\u6BB5\u662F ${currentStage}\uFF0C\u4F46\u8BA8\u8BBA\u8F93\u51FA\u5BA3\u79F0\u5DF2\u7ECF\u8FDB\u5165 drafting/\u6B63\u6587\u5199\u4F5C\u3002`);
  }
  if (claimsProducedDraft) {
    reasons.push("\u8BA8\u8BBA\u8F93\u51FA\u5BA3\u79F0\u5DF2\u7ECF\u4EA7\u51FA\u5177\u4F53\u7AE0\u8282\u521D\u7A3F\uFF0C\u4F46\u751F\u4EA7\u7AE0\u8282\u53EA\u80FD\u7531 drafting \u9636\u6BB5\u7684\u7AE0\u8282\u6D41\u6C34\u7EBF\u5199\u5165\u3002");
  }
  if (hasChapterBodyHeading || hasDraftBodyLabel) {
    reasons.push("\u8BA8\u8BBA\u8F93\u51FA\u51FA\u73B0\u7AE0\u8282\u6B63\u6587\u6807\u9898\u6216\u6B63\u6587\u5757\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u8BBE\u5B9A/\u89C4\u5212\u9636\u6BB5\u7684\u6B63\u5F0F\u4EA7\u7269\u5199\u56DE\u3002");
  }
  if (currentStage === "setting_review" && /(当前已|已进入|进入|已经完成).{0,20}(master_planning|主线规划|章节蓝图|chapter_task_generation|总体规划|弧线蓝图)/i.test(positiveClaimText)) {
    reasons.push("\u5F53\u524D\u4ECD\u662F\u8BBE\u5B9A\u51BB\u7ED3\u9636\u6BB5\uFF0C\u4F46\u8BA8\u8BBA\u8F93\u51FA\u628A\u4E3B\u7EBF\u89C4\u5212\u6216\u7AE0\u8282\u84DD\u56FE\u63CF\u8FF0\u6210\u65E2\u6210\u72B6\u6001\u3002");
  }
  if (target.kind !== "chapter" && /第\s*[一二三四五六七八九十百千万\d]+\s*章.{0,20}(目标|冲突|场景|开篇|结尾|钩子)/u.test(positiveClaimText)) {
    reasons.push("\u5F53\u524D\u8BA8\u8BBA\u76EE\u6807\u4E0D\u662F\u7AE0\u8282\u84DD\u56FE\uFF0C\u5374\u8F93\u51FA\u4E86\u5177\u4F53\u7AE0\u6B21\u6267\u884C\u5185\u5BB9\u3002");
  }
  return {
    blocked: reasons.length > 0,
    reason: reasons.join("\uFF1B")
  };
}
function buildStageGuardSummary(state, target, reason) {
  return [
    "### \u9636\u6BB5\u5B88\u536B\u62E6\u622A",
    `- \u5F53\u524D\u7CFB\u7EDF\u9636\u6BB5\uFF1A${state.runtime.stage}`,
    `- \u5F53\u524D\u8BA8\u8BBA\u76EE\u6807\uFF1A${target.label}`,
    `- \u5199\u56DE\u8D44\u4EA7\uFF1A${target.assetPath}`,
    `- \u62E6\u622A\u539F\u56E0\uFF1A${reason}`,
    "",
    "### \u5904\u7406\u7ED3\u679C",
    "- \u672C\u8F6E\u8BA8\u8BBA\u539F\u6587\u53EA\u4FDD\u7559\u5728 transcript\uFF0C\u4F5C\u4E3A\u53EF\u5BA1\u8BA1\u8BB0\u5F55\u3002",
    "- \u672C\u8F6E\u5185\u5BB9\u4E0D\u4F1A\u5199\u5165 global consensus\u3001memory \u6216\u751F\u4EA7\u7AE0\u8282\u4EA7\u7269\u3002",
    "- \u6B63\u5F0F\u7AE0\u8282\u5FC5\u987B\u7B49\u5F85\u72B6\u6001\u673A\u8FDB\u5165 drafting\uFF0C\u5E76\u7531\u7AE0\u8282\u6D41\u6C34\u7EBF\u5199\u5165 `.ai-novel/chapters/` \u4E0E DB artifact\u3002",
    "",
    "### Next Step",
    "- \u56DE\u5230\u5F53\u524D\u9636\u6BB5\u7EE7\u7EED\u6536\u655B\u8BBE\u5B9A/\u89C4\u5212\uFF0C\u6216\u901A\u8FC7\u5DE5\u4F5C\u6D41\u63A8\u8FDB\u751F\u6210\u4E3B\u7EBF\u89C4\u5212\u548C\u7AE0\u8282\u84DD\u56FE\u3002"
  ].join("\n");
}
function buildAutonomousContext(state, target) {
  const dossierBrief = summarizeDossiersForContext(state.memory?.characterDossiers || []);
  return [
    "# Autonomous Creation Mode",
    "",
    `Project title: ${state.project.title}`,
    `Core idea seed: ${state.project.idea}`,
    `Current workflow stage: ${state.runtime.stage}`,
    `Scoped target: ${target.label}`,
    `Write-back asset: ${target.assetPath}`,
    "",
    "Structured character dossier snapshot:",
    dossierBrief || "- no structured character dossiers available yet",
    "",
    "Autonomy rules:",
    "- Do not wait for the user to choose paths or options.",
    "- If details are missing, infer strong working assumptions from the title, genre cues, and current target.",
    "- Present assumptions, recommendations, and a converged decision directly.",
    "- The system is expected to take over the creative process and keep moving.",
    "- The canonical workflow state is the runtime stage above. Do not announce a different current stage unless the system snapshot has changed.",
    "- When proposing stage movement, phrase it as a recommendation for the next advance step, not as completed progress.",
    `- Stage guardrail: ${stageInstructionFor(state, target)}`
  ].join("\n");
}
function clipText(value, maxLength) {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(normalized.length - maxLength).trim();
}
function extractRecentTranscript(transcript, blockLimit = 3) {
  const blocks = transcript.split(/^##\s+/m).map((block) => block.trim()).filter(Boolean);
  const userBlockIndexes = [];
  blocks.forEach((block, index) => {
    if (/^User:/m.test(block)) {
      userBlockIndexes.push(index);
    }
  });
  const selected = new Set(userBlockIndexes.slice(-3));
  blocks.forEach((_, index) => {
    if (index >= blocks.length - blockLimit) {
      selected.add(index);
    }
  });
  return [...selected].sort((left, right) => left - right).map((index) => `## ${blocks[index]}`).join("\n\n");
}
function buildContextPacketText(options) {
  const recentTranscript = extractRecentTranscript(options.priorTranscript);
  const consensusBullets = extractSummaryBullets(options.consensus, 8);
  const dossierBrief = summarizeDossiersForContext(options.state.memory?.characterDossiers || []);
  const recalledMemory = options.recalledMemory?.length ? options.recalledMemory.map((item) => `- [${String(item.kind || "memory")}] ${clipText(String(item.content || ""), 360)} (score: ${Number(item.score || 0)})`) : ["- No database memory recall matched this turn yet."];
  const recalledKnowledge = options.recalledKnowledge?.length ? options.recalledKnowledge.map((item) => {
    const source = item.source && typeof item.source === "object" ? item.source : {};
    return `- [${String(item.chunk_type || "knowledge")}] ${clipText(String(item.content || ""), 360)} (source: ${String(source.path || "")}, score: ${Number(item.score || 0).toFixed(2)})`;
  }) : ["- No writing knowledge resources matched this turn yet."];
  return [
    "# Current Context Packet",
    "",
    "Context hierarchy:",
    "1. System/developer protocol and role prompts.",
    "2. Original project mission and workflow stage.",
    "3. Global consensus and committed facts.",
    "4. Recent discussion transcript and user interventions.",
    "5. Super Graph checkpoints, assets, and drift constraints.",
    "6. Current user message for this turn.",
    "",
    "Original mission:",
    `- Project: ${options.state.project.title}`,
    `- Idea: ${options.state.project.idea}`,
    `- Target chapters: ${options.state.plan.totalChapters}`,
    `- Chapter word target: ${options.state.plan.chapterWordTarget}`,
    "",
    "Workflow state:",
    `- Stage: ${options.state.runtime.stage}`,
    `- Last action: ${options.state.runtime.lastAction}`,
    `- Last route: ${options.state.runtime.lastRoute}`,
    `- Autopilot running: ${Boolean(options.state.runtime.autopilot?.running)}`,
    "",
    "Current discussion:",
    `- Target: ${options.target.label}`,
    `- Asset: ${options.target.assetPath}`,
    `- User message: ${options.message}`,
    "",
    "Consensus carryover:",
    ...consensusBullets.length > 0 ? consensusBullets : ["- No compact consensus has been recorded yet."],
    "",
    "Structured character dossier carryover:",
    dossierBrief || "- No structured character dossiers have been recorded yet.",
    "",
    "Memory/RAG recall:",
    ...recalledMemory,
    "",
    "Writing knowledge/RAG recall:",
    ...recalledKnowledge,
    "",
    "Recent transcript carryover:",
    recentTranscript || "No previous discussion transcript has been recorded yet."
  ].join("\n");
}
async function writeCurrentContextPacket(rootDir, content) {
  const contextDir = workspacePath(rootDir, "context");
  const contextPath = path.join(contextDir, "current-context.md");
  await fs.mkdir(contextDir, { recursive: true });
  await fs.writeFile(contextPath, `${content.trim()}
`);
  return contextPath;
}
function inferDiscussionTarget(message) {
  const normalized = message.toLowerCase();
  if (normalized.includes("\u7B2C") && normalized.includes("\u7AE0") || normalized.includes("chapter")) {
    return {
      kind: "chapter",
      label: "chapter blueprint discussion",
      assetPath: ".ai-novel/plans/chapter-blueprints/",
      instruction: "Discuss one chapter blueprint only. Do not draft full prose or invent unrelated chapter titles."
    };
  }
  if (normalized.includes("\u4E3B\u89D2") || normalized.includes("\u89D2\u8272") || normalized.includes("character")) {
    return {
      kind: "character",
      label: "character design discussion",
      assetPath: ".ai-novel/memory/characters/core/protagonist.md",
      instruction: "Refine character setup, motivations, or relations only. Do not branch into unrelated world or chapter drafts."
    };
  }
  if (normalized.includes("\u6587\u98CE") || normalized.includes("\u8BED\u8A00") || normalized.includes("\u6DA6\u8272") || normalized.includes("style")) {
    return {
      kind: "style",
      label: "style guide discussion",
      assetPath: ".ai-novel/style/profile.md",
      instruction: "Refine style and voice only. Do not create new plot or chapter content."
    };
  }
  if (normalized.includes("\u60C5\u8282") || normalized.includes("\u5267\u60C5") || normalized.includes("\u4E3B\u7EBF") || normalized.includes("\u4F0F\u7B14") || normalized.includes("\u5927\u7EB2") || normalized.includes("plot")) {
    return {
      kind: "plot",
      label: "plot and outline discussion",
      assetPath: ".ai-novel/plans/master-outline.md",
      instruction: "Refine plot structure, outline beats, or foreshadowing only. Do not draft detached scenes."
    };
  }
  return {
    kind: "worldbuilding",
    label: "worldbuilding discussion",
    assetPath: ".ai-novel/prompts/global-consensus.md",
    instruction: "Refine world rules, factions, and setting truths only. Stay on the same topic until consensus is reached."
  };
}
function knowledgeSourceTypesForDiscussionTarget(target) {
  if (target.kind === "style") {
    return ["vocabulary", "style_guide", "example", "quality_rule"];
  }
  if (target.kind === "chapter") {
    return ["vocabulary", "example", "style_guide", "chapter", "plan", "memory", "consensus", "quality_rule"];
  }
  if (target.kind === "plot") {
    return ["vocabulary", "example", "style_guide", "plan", "memory", "consensus", "quality_rule"];
  }
  if (target.kind === "character") {
    return ["vocabulary", "example", "style_guide", "memory", "consensus", "agent_guide"];
  }
  return ["vocabulary", "example", "style_guide", "quality_rule", "consensus", "agent_guide"];
}
async function runMultiAgentDiscussion(rootDir, message, options = {}) {
  throwIfStopped(options.signal);
  const statePath = workspacePath(rootDir, "state.json");
  const consensusPath = workspacePath(rootDir, "prompts", "global-consensus.md");
  const protagonistPath = workspacePath(rootDir, "memory", "characters", "core", "protagonist.md");
  const characterDossiersPath = workspacePath(rootDir, "memory", "characters", "dossiers.json");
  const characterDossiersMarkdownPath = workspacePath(rootDir, "memory", "characters", "dossiers.md");
  const styleProfilePath = workspacePath(rootDir, "style", "profile.md");
  const discussionDir = workspacePath(rootDir, "chat");
  const discussionLogPath = path.join(discussionDir, "discussion-log.md");
  await fs.mkdir(discussionDir, { recursive: true });
  const rawConsensus = await readText(consensusPath);
  const state = JSON.parse(await readText(statePath));
  const discussionTarget = inferDiscussionTarget(message);
  const runId = options.runId ?? makeRunId("discussion");
  const factoryDb = options.factoryRootDir && options.projectId ? await FactoryDb.open(options.factoryRootDir) : null;
  const priorTranscript = await readOptionalText(discussionLogPath);
  const sanitizedConsensus = sanitizeConsensusForDiscussion(rawConsensus);
  const autonomousContext = buildAutonomousContext(state, discussionTarget);
  const recalledMemory = factoryDb && options.projectId ? factoryDb.recallMemory(options.projectId, `${message}
${discussionTarget.label}`, 6, {
    embedding: createLocalTextEmbedding(`${message}
${discussionTarget.label}`)
  }) : [];
  const recalledKnowledge = options.factoryRootDir && options.projectId ? await retrieveKnowledge({
    rootDir: options.factoryRootDir,
    projectId: options.projectId,
    query: `${message}
${discussionTarget.label}
${state.project.idea}`,
    scopes: ["project", "global"],
    sourceTypes: knowledgeSourceTypesForDiscussionTarget(discussionTarget),
    limit: 6,
    runId,
    recordCitation: true
  }).catch(() => []) : [];
  const currentContextPacket = buildContextPacketText({
    state,
    target: discussionTarget,
    message,
    consensus: sanitizedConsensus,
    priorTranscript,
    recalledMemory,
    recalledKnowledge
  });
  const contextPacketPath = await writeCurrentContextPacket(rootDir, currentContextPacket);
  const replies = [];
  const transcriptContext = [
    currentContextPacket,
    `Project: ${state.project.title}`,
    `Idea: ${state.project.idea}`,
    `Target: ${discussionTarget.label} -> ${discussionTarget.assetPath}`,
    `User: ${message}`
  ];
  const storyCoreDossierBrief = summarizeDossiersForContext(state.memory?.characterDossiers || []);
  const transcriptStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (factoryDb && options.projectId) {
    factoryDb.createRun({
      id: runId,
      projectId: options.projectId,
      projectRoot: rootDir,
      parentRunId: options.parentRunId ?? null,
      kind: "discussion",
      status: "running",
      goal: message,
      stage: state.runtime.stage
    });
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "context",
      path: ".ai-novel/context/current-context.md",
      status: "completed",
      metadata: { runId, target: discussionTarget, directorCommandId: options.directorCommandId ?? null }
    });
    factoryDb.recordEvent(options.projectId, runId, "DISCUSSION_STARTED", {
      message,
      target: discussionTarget,
      stage: state.runtime.stage,
      contextPacketPath,
      recalledMemoryCount: recalledMemory.length,
      recalledKnowledgeCount: recalledKnowledge.length,
      directorCommandId: options.directorCommandId ?? null
    });
  }
  await fs.appendFile(
    discussionLogPath,
    [
      `## ${transcriptStartedAt}`,
      ...transcriptContext,
      "Status: in_progress",
      ""
    ].join("\n")
  );
  async function runAgentTurn(agent, discussionStage) {
    throwIfStopped(options.signal);
    const turnIndex = replies.length + 1;
    const turnId = `${agent.id}-${turnIndex}`;
    const dbTurnId = makeAgentTurnId(runId, agent.id, turnIndex);
    const messageId = `${dbTurnId}:message`;
    const basePrompt = await readText(workspacePath(rootDir, "prompts", "agents", `${agent.id}.base.md`));
    const dynamicPrompt = await readText(workspacePath(rootDir, "prompts", "agents", `${agent.id}.dynamic.md`));
    factoryDb?.recordAgentTurn({
      runId,
      turnId: dbTurnId,
      role: agent.label,
      stage: discussionStage,
      status: "in_progress",
      input: {
        message,
        discussionTarget,
        currentStage: state.runtime.stage,
        priorTranscript: clipText(priorTranscript, 8e3),
        contextPacketPath
      }
    });
    await options.onStreamEvent?.({
      type: "agent_start",
      messageId,
      turnId,
      role: agent.label,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      phase: "request_sent",
      statusText: "\u8BF7\u6C42\u5DF2\u9001\u8FBE LLM\uFF0C\u7B49\u5F85\u6A21\u578B\u5F00\u59CB\u54CD\u5E94\u3002",
      statusDetail: "\u8FD9\u6761 agent \u6D88\u606F\u4F1A\u5728\u6A21\u578B\u8FD4\u56DE\u5185\u5BB9\u65F6\u7EE7\u7EED\u66F4\u65B0\u3002"
    });
    let reply = "";
    try {
      const storyCoreBase = buildStoryCoreContext(state, sanitizedConsensus, discussionTarget, message);
      const dossierSection = storyCoreDossierBrief ? `

\u7ED3\u6784\u5316\u89D2\u8272\u6863\u6848\u6458\u8981\uFF1A
${storyCoreDossierBrief}` : "";
      const dossierBudget = Math.min(500, Math.floor(CONTEXT_BUDGET.story_core * 0.25));
      const baseBudget = CONTEXT_BUDGET.story_core - dossierBudget;
      const compactStoryCoreBase = storyCoreBase.length > baseBudget ? `${storyCoreBase.slice(0, baseBudget)}
\u2026[\u6838\u5FC3\u5C42\u5DF2\u622A\u65AD]` : storyCoreBase;
      const storyCoreCtx = dossierSection ? `${compactStoryCoreBase}${dossierSection.slice(0, dossierBudget)}`.slice(0, CONTEXT_BUDGET.story_core) : storyCoreBase;
      const historyCtx = buildHistoryForAgent(agent.id, discussionStage, replies, priorTranscript);
      console.log(
        `[CTX BUDGET] Agent: ${agent.label} | Stage: ${discussionStage} | StoryCore: ${storyCoreCtx.length}\u5B57 | History: ${historyCtx.length}\u5B57 | Base: ${basePrompt.length}\u5B57 | Dynamic: ${dynamicPrompt.length}\u5B57`
      );
      reply = await generateAgentReply({
        roleName: agent.label,
        basePrompt,
        dynamicPrompt,
        consensus: storyCoreCtx,
        message,
        discussionStage,
        priorTranscript: historyCtx,
        discussionTarget,
        preferredLanguage: "zh-CN",
        currentStage: state.runtime.stage,
        stageInstruction: stageInstructionFor(state, discussionTarget),
        envRootDir: options.envRootDir ?? rootDir,
        signal: options.signal,
        onDelta: async (delta) => {
          await options.onStreamEvent?.({
            type: "agent_delta",
            messageId,
            turnId,
            role: agent.label,
            delta,
            phase: "streaming",
            statusText: "LLM \u6B63\u5728\u6301\u7EED\u8FD4\u56DE\u5185\u5BB9\u3002",
            statusDetail: "\u8FD4\u56DE\u5185\u5BB9\u4F1A\u6301\u7EED\u5408\u5E76\u5230\u8FD9\u4E00\u6761 agent \u6D88\u606F\u4E2D\u3002"
          });
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const failedAt = (/* @__PURE__ */ new Date()).toISOString();
      factoryDb?.recordAgentTurn({
        runId,
        turnId: dbTurnId,
        role: agent.label,
        stage: discussionStage,
        status: "failed",
        input: { message, discussionTarget, currentStage: state.runtime.stage },
        error: errorMessage
      });
      if (factoryDb && options.projectId) {
        factoryDb.recordMessage(
          createAgentMessage({
            messageId,
            conversationId: runId,
            projectId: options.projectId,
            runId,
            turnId: dbTurnId,
            agentLabel: agent.label,
            content: `LLM \u8BF7\u6C42\u5931\u8D25\uFF1A${errorMessage}`,
            status: "failed",
            phase: "failed",
            statusText: "LLM \u8BF7\u6C42\u5931\u8D25\uFF0C\u5DF2\u8BB0\u5F55\u9519\u8BEF\u3002",
            statusDetail: errorMessage,
            time: failedAt,
            metadata: {
              discussionStage,
              target: discussionTarget,
              source: "discussion_agent_turn",
              error: errorMessage
            }
          }),
          discussionMessageParts(messageId, {
            role: agent.label,
            content: `LLM \u8BF7\u6C42\u5931\u8D25\uFF1A${errorMessage}`,
            discussionStage,
            target: discussionTarget,
            currentStage: state.runtime.stage,
            createdAt: failedAt
          })
        );
      }
      await options.onStreamEvent?.({
        type: "agent_error",
        messageId,
        turnId,
        role: agent.label,
        content: `LLM \u8BF7\u6C42\u5931\u8D25\uFF1A${errorMessage}`,
        error: errorMessage,
        timestamp: failedAt,
        phase: "failed",
        statusText: "LLM \u8BF7\u6C42\u5931\u8D25\uFF0C\u5DF2\u8BB0\u5F55\u9519\u8BEF\u3002",
        statusDetail: errorMessage
      });
      throw error;
    }
    replies.push({ role: agent.label, content: reply });
    const completedAt = (/* @__PURE__ */ new Date()).toISOString();
    transcriptContext.push(`${agent.label}: ${reply}`);
    await fs.appendFile(
      discussionLogPath,
      [`## ${completedAt}`, `${agent.label}: ${reply}`, ""].join("\n")
    );
    factoryDb?.recordAgentTurn({
      runId,
      turnId: dbTurnId,
      role: agent.label,
      stage: discussionStage,
      status: "completed",
      input: { message, discussionTarget, currentStage: state.runtime.stage },
      output: reply
    });
    if (factoryDb && options.projectId) {
      factoryDb.recordMessage(
        createAgentMessage({
          messageId,
          conversationId: runId,
          projectId: options.projectId,
          runId,
          turnId: dbTurnId,
          agentLabel: agent.label,
          content: reply,
          status: "completed",
          time: completedAt,
          metadata: {
            discussionStage,
            target: discussionTarget,
            source: "discussion_agent_turn"
          }
        }),
        discussionMessageParts(messageId, {
          role: agent.label,
          content: reply,
          discussionStage,
          target: discussionTarget,
          currentStage: state.runtime.stage,
          createdAt: completedAt
        })
      );
    }
    await options.onStreamEvent?.({
      type: "agent_complete",
      messageId,
      turnId,
      role: agent.label,
      content: reply,
      timestamp: completedAt,
      phase: "completed",
      statusText: "LLM \u8FD4\u56DE\u5B8C\u6210\uFF0C\u5185\u5BB9\u5DF2\u4FDD\u5B58\u3002"
    });
    await options.onEvent?.({ role: agent.label, content: reply });
    return reply;
  }
  const showrunner = AGENT_FLOW[0];
  let synthesisReply = "";
  try {
    await runAgentTurn(showrunner, "opening_brief");
    for (const agent of SPECIALIST_FLOW) {
      await runAgentTurn(agent, "specialist_turn");
    }
    synthesisReply = await runAgentTurn(showrunner, "closing_synthesis");
    await fs.appendFile(discussionLogPath, "Status: complete\n\n");
    factoryDb?.updateRun(runId, "completed");
  } catch (error) {
    const message2 = error instanceof Error ? error.message : String(error);
    await fs.appendFile(discussionLogPath, `Status: error
Error: ${message2}

`);
    factoryDb?.updateRun(runId, "failed", { error: message2 });
    throw error;
  }
  const showrunnerReply = synthesisReply;
  const stageGuard = detectDiscussionStageViolation(
    state,
    discussionTarget,
    [
      message,
      ...replies.map((reply) => `${reply.role}: ${reply.content}`),
      showrunnerReply
    ].join("\n\n")
  );
  const guardedSummary = stageGuard.blocked ? buildStageGuardSummary(state, discussionTarget, stageGuard.reason) : showrunnerReply;
  const protagonistUpdate = message.includes("\u4E3B\u89D2") ? message : `Protagonist note: ${message}`;
  if (stageGuard.blocked) {
    state.runtime.lastRoute = discussionTarget.kind;
    state.runtime.lastAction = `discussion_guard_blocked:${discussionTarget.kind}`;
    state.runtime.statusMessage = `\u8BA8\u8BBA\u8F93\u51FA\u88AB\u9636\u6BB5\u5B88\u536B\u62E6\u622A\uFF0C\u672A\u5199\u5165\u751F\u4EA7\u5171\u8BC6\uFF1A${stageGuard.reason}`;
    await fs.appendFile(discussionLogPath, `Stage Guard: blocked
Reason: ${stageGuard.reason}

`);
    await saveAutonomousState(rootDir, state);
    if (factoryDb && options.projectId) {
      const blockedAt = (/* @__PURE__ */ new Date()).toISOString();
      const blockedMessageId = `${runId}:discussion-stage-guard-blocked`;
      const blockedArtifacts = [
        {
          path: ".ai-novel/chat/discussion-log.md",
          label: "discussion-log.md",
          kind: "transcript",
          status: "blocked"
        },
        {
          path: ".ai-novel/context/current-context.md",
          label: "current-context.md",
          kind: "context",
          status: "completed"
        }
      ];
      factoryDb.updateProjectState(options.projectId, state);
      factoryDb.recordArtifact({
        projectId: options.projectId,
        kind: "transcript",
        path: ".ai-novel/chat/discussion-log.md",
        status: "completed",
        metadata: { runId, target: discussionTarget, stageGuard: "blocked", directorCommandId: options.directorCommandId ?? null }
      });
      factoryDb.recordEvent(options.projectId, runId, "DISCUSSION_STAGE_GUARD_BLOCKED", {
        target: discussionTarget,
        stage: state.runtime.stage,
        reason: stageGuard.reason,
        transcriptPath: discussionLogPath,
        contextPacketPath,
        directorCommandId: options.directorCommandId ?? null
      });
      factoryDb.recordMessage(
        createArtifactMessage({
          messageId: blockedMessageId,
          conversationId: runId,
          projectId: options.projectId,
          runId,
          artifactPath: ".ai-novel/chat/discussion-log.md",
          label: "\u8BA8\u8BBA\u88AB\u9636\u6BB5\u5B88\u536B\u62E6\u622A",
          content: [
            "### \u8BA8\u8BBA\u88AB\u9636\u6BB5\u5B88\u536B\u62E6\u622A",
            "",
            `\u76EE\u6807\uFF1A${discussionTarget.label}`,
            `\u539F\u56E0\uFF1A${stageGuard.reason}`,
            "",
            "\u672C\u8F6E\u8BA8\u8BBA\u6CA1\u6709\u5199\u5165\u751F\u4EA7\u5171\u8BC6\uFF1B\u5DF2\u4FDD\u7559\u8BA8\u8BBA\u65E5\u5FD7\u548C\u4E0A\u4E0B\u6587\u5305\uFF0C\u65B9\u4FBF\u5C55\u5F00\u68C0\u67E5\u3002"
          ].join("\n"),
          status: "completed",
          time: blockedAt,
          metadata: {
            target: discussionTarget,
            source: "discussion_stage_guard_blocked",
            reason: stageGuard.reason
          }
        }),
        discussionArtifactMessageParts(blockedMessageId, {
          content: [
            "### \u8BA8\u8BBA\u88AB\u9636\u6BB5\u5B88\u536B\u62E6\u622A",
            "",
            `\u76EE\u6807\uFF1A${discussionTarget.label}`,
            `\u539F\u56E0\uFF1A${stageGuard.reason}`,
            "",
            "\u672C\u8F6E\u8BA8\u8BBA\u6CA1\u6709\u5199\u5165\u751F\u4EA7\u5171\u8BC6\uFF1B\u5DF2\u4FDD\u7559\u8BA8\u8BBA\u65E5\u5FD7\u548C\u4E0A\u4E0B\u6587\u5305\uFF0C\u65B9\u4FBF\u5C55\u5F00\u68C0\u67E5\u3002"
          ].join("\n"),
          artifacts: blockedArtifacts,
          target: discussionTarget,
          currentStage: state.runtime.stage,
          createdAt: blockedAt,
          source: "discussion_stage_guard_blocked"
        })
      );
      factoryDb.updateRun(runId, "blocked", { error: stageGuard.reason });
    }
    try {
      return {
        runId,
        target: discussionTarget,
        replies,
        transcriptPath: discussionLogPath,
        contextPacketPath,
        summary: guardedSummary,
        stageGuard: {
          status: "blocked",
          reason: stageGuard.reason,
          rawSummary: showrunnerReply
        },
        writebackSkipped: true
      };
    } finally {
      factoryDb?.close();
    }
  }
  const updatedConsensus = buildCompactConsensus(state, guardedSummary);
  const currentProtagonist = await readText(protagonistPath);
  const protagonistDetails = extractConfirmedProtagonistDetails(message);
  const updatedProtagonistBase = appendSection(currentProtagonist, "Discussion updates", protagonistUpdate);
  const updatedProtagonist = protagonistDetails ? appendSection(updatedProtagonistBase, "Canonical protagonist lock", formatProtagonistLockSection(protagonistDetails)) : updatedProtagonistBase;
  const currentDossiers = state.memory?.characterDossiers?.length ? state.memory.characterDossiers : await readCharacterDossiers(characterDossiersPath);
  const updatedDossiers = updateCharacterDossiersFromDiscussion({
    dossiers: currentDossiers,
    targetKind: discussionTarget.kind,
    message,
    summary: guardedSummary,
    runId
  });
  if (updatedDossiers.length) {
    state.memory = {
      ...state.memory || {},
      characterDossiers: updatedDossiers
    };
  }
  const currentStyle = await readText(styleProfilePath);
  const updatedStyle = appendSection(
    currentStyle,
    "Discussion-driven adjustments",
    "\u5F53\u524D\u8BA8\u8BBA\u5F3A\u8C03\u66F4\u50CF\u4EBA\u5199\u7684\u4E2D\u6587\u8868\u8FBE\uFF0C\u4EE5\u53CA\u4E25\u683C\u9075\u5B88\u5F53\u524D workflow \u9636\u6BB5\u3002"
  );
  const consensusArchive = await writeDiscussionConsensusArchive(rootDir, {
    runId,
    startedAt: transcriptStartedAt,
    state,
    target: discussionTarget,
    message,
    summary: guardedSummary,
    replies,
    transcriptRelativePath: ".ai-novel/chat/discussion-log.md",
    contextPacketRelativePath: ".ai-novel/context/current-context.md"
  });
  state.runtime.lastRoute = discussionTarget.kind;
  state.runtime.lastAction = `discussion:${discussionTarget.kind}`;
  state.runtime.statusMessage = `\u5DF2\u5B8C\u6210${discussionTarget.label}\uFF0C\u5171\u8BC6\u5DF2\u5199\u56DE ${discussionTarget.assetPath}\u3002`;
  await fs.writeFile(consensusPath, updatedConsensus);
  await fs.writeFile(protagonistPath, updatedProtagonist);
  if (updatedDossiers.length) {
    await writeJsonFileAtomic(characterDossiersPath, updatedDossiers);
    await fs.writeFile(characterDossiersMarkdownPath, `${formatCharacterDossiersMarkdown(updatedDossiers)}
`);
  }
  await fs.writeFile(styleProfilePath, updatedStyle);
  await saveAutonomousState(rootDir, state);
  if (factoryDb && options.projectId) {
    factoryDb.updateProjectState(options.projectId, state);
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "transcript",
      path: ".ai-novel/chat/discussion-log.md",
      status: "completed",
      metadata: { runId, target: discussionTarget, consensusArchivePath: consensusArchive.relativePath, directorCommandId: options.directorCommandId ?? null }
    });
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: targetToArtifactKind(discussionTarget),
      path: discussionTarget.assetPath,
      status: "completed",
      metadata: { runId, summary: guardedSummary, directorCommandId: options.directorCommandId ?? null }
    });
    if (updatedDossiers.length) {
      factoryDb.recordArtifact({
        projectId: options.projectId,
        kind: "memory",
        path: ".ai-novel/memory/characters/dossiers.json",
        status: "completed",
        metadata: { runId, target: discussionTarget, source: "discussion_writeback", directorCommandId: options.directorCommandId ?? null }
      });
    }
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "consensus",
      path: ".ai-novel/prompts/global-consensus.md",
      status: "completed",
      metadata: { runId, latestArchivePath: consensusArchive.relativePath, directorCommandId: options.directorCommandId ?? null }
    });
    factoryDb.recordArtifact({
      projectId: options.projectId,
      kind: "consensus",
      path: consensusArchive.relativePath,
      status: "completed",
      metadata: {
        runId,
        target: discussionTarget,
        source: "discussion_archive",
        transcriptPath: ".ai-novel/chat/discussion-log.md",
        contextPacketPath: ".ai-novel/context/current-context.md",
        directorCommandId: options.directorCommandId ?? null
      }
    });
    const memoryId = factoryDb.recordMemory(options.projectId, {
      source: `discussion:${runId}`,
      kind: discussionTarget.kind,
      content: guardedSummary,
      importance: 3,
      metadata: { target: discussionTarget }
    });
    factoryDb.upsertEmbedding(options.projectId, {
      ownerKind: "memory",
      ownerId: memoryId,
      model: "local-hash-v1",
      vector: createLocalTextEmbedding(guardedSummary)
    });
    factoryDb.recordEvent(options.projectId, runId, "CONSENSUS_UPDATED", {
      target: discussionTarget,
      transcriptPath: discussionLogPath,
      contextPacketPath,
      consensusArchivePath: consensusArchive.relativePath,
      directorCommandId: options.directorCommandId ?? null
    });
    const writebackAt = (/* @__PURE__ */ new Date()).toISOString();
    const writebackMessageId = `${runId}:discussion-writeback`;
    const writebackArtifacts = [
      {
        path: consensusArchive.relativePath,
        label: "discussion consensus archive",
        kind: "consensus",
        status: "completed"
      },
      {
        path: ".ai-novel/prompts/global-consensus.md",
        label: "global-consensus.md",
        kind: "consensus",
        status: "completed"
      },
      {
        path: discussionTarget.assetPath,
        label: discussionTarget.label,
        kind: targetToArtifactKind(discussionTarget),
        status: "completed"
      },
      {
        path: ".ai-novel/chat/discussion-log.md",
        label: "discussion-log.md",
        kind: "transcript",
        status: "completed"
      },
      {
        path: ".ai-novel/context/current-context.md",
        label: "current-context.md",
        kind: "context",
        status: "completed"
      },
      ...updatedDossiers.length ? [{
        path: ".ai-novel/memory/characters/dossiers.json",
        label: "character dossiers",
        kind: "memory",
        status: "completed"
      }] : []
    ];
    const writebackContent = [
      "### \u8BA8\u8BBA\u4EA7\u7269\u5DF2\u5199\u5165",
      "",
      `\u76EE\u6807\uFF1A${discussionTarget.label}`,
      `\u9636\u6BB5\uFF1A${state.runtime.stage}`,
      "",
      "\u672C\u8F6E\u8BA8\u8BBA\u5DF2\u5F62\u6210\u53EF\u5BA1\u6838\u4EA7\u7269\uFF0C\u540E\u7EED\u4E16\u754C\u89C2\u3001\u89D2\u8272\u3001\u4E3B\u7EBF\u548C\u7AE0\u8282\u84DD\u56FE\u53EA\u80FD\u4ECE\u8FD9\u4E9B\u6587\u4EF6\u7EE7\u7EED\u6D88\u8D39\u3002",
      "",
      ...writebackArtifacts.map((artifact) => `- ${artifact.label}: ${artifact.path}`)
    ].join("\n");
    factoryDb.recordMessage(
      createArtifactMessage({
        messageId: writebackMessageId,
        conversationId: runId,
        projectId: options.projectId,
        runId,
        artifactPath: consensusArchive.relativePath,
        label: "\u8BA8\u8BBA\u4EA7\u7269\u5DF2\u5199\u5165",
        content: writebackContent,
        status: "completed",
        time: writebackAt,
        metadata: {
          target: discussionTarget,
          source: "discussion_writeback_artifacts",
          artifactCount: writebackArtifacts.length
        }
      }),
      discussionArtifactMessageParts(writebackMessageId, {
        content: writebackContent,
        artifacts: writebackArtifacts,
        target: discussionTarget,
        currentStage: state.runtime.stage,
        createdAt: writebackAt,
        source: "discussion_writeback_artifacts"
      })
    );
  }
  try {
    await upsertDiscussionInSuperGraph(rootDir, {
      target: discussionTarget,
      summary: guardedSummary,
      transcriptPath: discussionLogPath
    }, {
      factoryRootDir: options.factoryRootDir,
      projectId: options.projectId
    });
  } catch {
  }
  try {
    return {
      runId,
      target: discussionTarget,
      replies,
      transcriptPath: discussionLogPath,
      contextPacketPath,
      consensusArchivePath: consensusArchive.absolutePath,
      summary: guardedSummary,
      stageGuard: {
        status: "ok",
        reason: ""
      },
      writebackSkipped: false
    };
  } finally {
    factoryDb?.close();
  }
}

export {
  runMultiAgentDiscussion
};
