"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/novel-director.ts
var novel_director_exports = {};
__export(novel_director_exports, {
  buildDirectorDiscussionMessage: () => buildDirectorDiscussionMessage,
  createFollowUpAdvanceCommand: () => createFollowUpAdvanceCommand,
  createManualAdvanceCommand: () => createManualAdvanceCommand,
  createManualInterruptCommand: () => createManualInterruptCommand,
  createManualRetryChapterCommand: () => createManualRetryChapterCommand,
  decideNovelDirectorCommand: () => decideNovelDirectorCommand,
  isGenericAutopilotMessage: () => isGenericAutopilotMessage,
  shouldAdvanceBeforeDiscussion: () => shouldAdvanceBeforeDiscussion
});
module.exports = __toCommonJS(novel_director_exports);
function makeDirectorCommandId() {
  return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function isGenericAutopilotMessage(message) {
  return /^(开始|继续|go|start|continue|run|resume)$/i.test(message.trim());
}
function shouldAdvanceBeforeDiscussion(state, initialMessage, correctionMessage) {
  if (correctionMessage.trim()) {
    return false;
  }
  const trimmedInitialMessage = initialMessage.trim();
  if (trimmedInitialMessage && !isGenericAutopilotMessage(trimmedInitialMessage)) {
    return false;
  }
  if (state.runtime.stage === "complete" && !state.plan.chapterTasks.every((task) => task.status === "complete")) {
    return true;
  }
  return [
    "setting_review",
    "master_planning",
    "chapter_task_generation",
    "drafting",
    "reviewing"
  ].includes(state.runtime.stage);
}
function buildDirectorDiscussionMessage(state, initialMessage) {
  const trimmedInitialMessage = initialMessage.trim();
  if (trimmedInitialMessage && !isGenericAutopilotMessage(trimmedInitialMessage)) {
    return trimmedInitialMessage;
  }
  if (state.runtime.stage === "worldbuilding_dialogue") {
    return "\u8BF7\u7EE7\u7EED\u81EA\u4E3B\u6536\u655B\u4E16\u754C\u89C2\u3001\u4E3B\u89D2\u6838\u5FC3\u3001\u51B2\u7A81\u5F15\u64CE\u548C\u4E0D\u53EF\u8FDD\u80CC\u89C4\u5219\uFF0C\u5F62\u6210\u53EF\u5199\u56DE\u7684\u7EDF\u4E00\u7ED3\u8BBA\u3002";
  }
  if (state.runtime.stage === "setting_review") {
    return "\u8BF7\u5BA1\u9605\u5DF2\u51BB\u7ED3\u8BBE\u5B9A\uFF0C\u6307\u51FA\u8BBE\u5B9A\u6F0F\u6D1E\u3001\u89D2\u8272\u52A8\u673A\u98CE\u9669\u548C\u8FDB\u5165\u4E3B\u7EBF\u89C4\u5212\u524D\u5FC5\u987B\u9501\u5B9A\u7684\u5185\u5BB9\u3002";
  }
  if (state.runtime.stage === "master_planning") {
    return "\u8BF7\u56F4\u7ED5\u4E3B\u7EBF\u89C4\u5212\u7EE7\u7EED\u8BA8\u8BBA\uFF0C\u6536\u655B\u957F\u7EBF\u7ED3\u6784\u3001\u5173\u952E\u4F0F\u7B14\u3001\u5206\u5377\u538B\u529B\u548C\u7ED3\u5C40\u60C5\u611F\u627F\u8BFA\u3002";
  }
  if (state.runtime.stage === "chapter_task_generation") {
    return "\u8BF7\u68C0\u67E5\u7AE0\u8282\u84DD\u56FE\u662F\u5426\u80FD\u652F\u6491\u8FDE\u7EED\u5199\u4F5C\uFF0C\u660E\u786E\u4E0B\u4E00\u6B65\u8FDB\u5165\u6B63\u6587\u5199\u4F5C\u65F6\u7684\u6267\u884C\u91CD\u70B9\u3002";
  }
  if (state.runtime.stage === "drafting") {
    const nextTask = state.plan.chapterTasks.find((task) => task.status === "pending");
    return nextTask ? `\u8BF7\u56F4\u7ED5\u7B2C ${nextTask.chapterNumber} \u7AE0\u7EE7\u7EED\u521B\u4F5C\u524D\u8BA8\u8BBA\uFF0C\u660E\u786E\u672C\u7AE0\u76EE\u6807\u3001\u51B2\u7A81\u3001\u60C5\u7EEA\u63A8\u8FDB\u548C\u5BA1\u6821\u98CE\u9669\u3002` : "\u8BF7\u68C0\u67E5\u5168\u4E66\u7AE0\u8282\u4EFB\u52A1\u662F\u5426\u5DF2\u7ECF\u5B8C\u6210\uFF0C\u5E76\u6536\u675F\u6700\u7EC8\u72B6\u6001\u3002";
  }
  if (state.runtime.stage === "reviewing") {
    const blockedTask = state.plan.chapterTasks.find((task) => task.status === "blocked");
    return blockedTask ? `\u7B2C ${blockedTask.chapterNumber} \u7AE0\u8D28\u91CF\u95E8\u7981\u672A\u901A\u8FC7\uFF0C\u8BF7\u57FA\u4E8E\u6700\u8FD1\u8D28\u68C0\u539F\u56E0\u5236\u5B9A\u8FD4\u5DE5\u91CD\u70B9\uFF0C\u7136\u540E\u81EA\u52A8\u6062\u590D\u8BE5\u7AE0\u751F\u4EA7\u3002` : "\u8BF7\u68C0\u67E5\u5BA1\u6821\u9636\u6BB5\u662F\u5426\u4ECD\u6709\u963B\u585E\u7AE0\u8282\uFF1B\u5982\u679C\u6CA1\u6709\uFF0C\u8BF7\u6062\u590D\u5230\u540E\u7EED\u6B63\u6587\u5199\u4F5C\u3002";
  }
  if (state.runtime.stage === "replanning") {
    return "\u8BF7\u6839\u636E\u6700\u8FD1\u7684\u7528\u6237\u4E2D\u65AD\u91CD\u65B0\u89C4\u5212\u53D7\u5F71\u54CD\u8D44\u4EA7\uFF0C\u5E76\u7ED9\u51FA\u6062\u590D\u8FDE\u7EED\u5199\u4F5C\u7684\u7EDF\u4E00\u8DEF\u5F84\u3002";
  }
  return "\u8BF7\u6839\u636E\u5F53\u524D\u9879\u76EE\u72B6\u6001\u7EE7\u7EED\u81EA\u4E3B\u63A8\u8FDB\u5C0F\u8BF4\u521B\u4F5C\u6D41\u7A0B\u3002";
}
function decideNovelDirectorCommand(state, input = {}) {
  const userMessage = input.userMessage ?? "";
  const correctionMessage = input.correctionMessage ?? "";
  if (shouldAdvanceBeforeDiscussion(state, userMessage, correctionMessage)) {
    return {
      id: makeDirectorCommandId(),
      type: "advance",
      stage: state.runtime.stage,
      reason: "\u5F53\u524D\u9636\u6BB5\u5DF2\u6709\u8DB3\u591F\u4E0A\u4E0B\u6587\uFF0C\u4F18\u5148\u63A8\u8FDB\u751F\u4EA7\u72B6\u6001\u673A\u3002",
      advanceFirst: true,
      parentCommandId: null
    };
  }
  const message = correctionMessage || buildDirectorDiscussionMessage(state, userMessage);
  return {
    id: makeDirectorCommandId(),
    type: "discuss",
    stage: state.runtime.stage,
    message,
    reason: correctionMessage.trim() ? "\u9636\u6BB5\u5B88\u536B\u8981\u6C42\u5148\u7EA0\u504F\u8BA8\u8BBA\u3002" : "\u5F53\u524D\u9636\u6BB5\u9700\u8981\u5148\u5F62\u6210\u6216\u4FEE\u6B63 agent \u5171\u8BC6\u3002"
  };
}
function createFollowUpAdvanceCommand(state, parentCommand, reason = "\u8BA8\u8BBA\u7ED3\u8BBA\u5DF2\u5199\u56DE\uFF0C\u81EA\u52A8\u63A8\u8FDB\u5DE5\u4F5C\u6D41\u3002") {
  return {
    id: makeDirectorCommandId(),
    type: "advance",
    stage: state.runtime.stage,
    reason,
    advanceFirst: true,
    parentCommandId: parentCommand.id
  };
}
function createManualAdvanceCommand(state, reason = "\u7528\u6237\u624B\u52A8\u8BF7\u6C42\u63A8\u8FDB\u5DE5\u4F5C\u6D41\u3002") {
  return {
    id: makeDirectorCommandId(),
    type: "advance",
    stage: state.runtime.stage,
    reason,
    advanceFirst: true,
    parentCommandId: null
  };
}
function createManualRetryChapterCommand(state, chapterNumber, reason = "\u7528\u6237\u624B\u52A8\u8BF7\u6C42\u91CD\u8BD5\u963B\u585E\u7AE0\u8282\u3002") {
  return {
    id: makeDirectorCommandId(),
    type: "retry_chapter",
    stage: state.runtime.stage,
    chapterNumber,
    reason
  };
}
function createManualInterruptCommand(state, message, reason = "\u7528\u6237\u624B\u52A8\u63D0\u4EA4\u4E2D\u65AD\u53D8\u66F4\uFF0C\u8FDB\u5165\u5F71\u54CD\u8303\u56F4\u8BC4\u4F30\u3002") {
  return {
    id: makeDirectorCommandId(),
    type: "interrupt",
    stage: state.runtime.stage,
    message,
    reason
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildDirectorDiscussionMessage,
  createFollowUpAdvanceCommand,
  createManualAdvanceCommand,
  createManualInterruptCommand,
  createManualRetryChapterCommand,
  decideNovelDirectorCommand,
  isGenericAutopilotMessage,
  shouldAdvanceBeforeDiscussion
});
