import {
  createWorkerWorkspacePayload,
  getNovelAutopilotWorkerStatus,
  runNovelAutopilotWorkerCli,
  runNovelAutopilotWorkerOnce,
  startNovelAutopilotWorker
} from "./chunk-IKZLW2AP.js";
import {
  executeManualAdvanceCommand,
  executeManualInterruptCommand,
  executeManualRetryChapterCommand,
  recordDirectorCommandEvent
} from "./chunk-MR4WTTHR.js";
import {
  buildDirectorDiscussionMessage,
  createFollowUpAdvanceCommand,
  createManualAdvanceCommand,
  createManualInterruptCommand,
  createManualRetryChapterCommand,
  decideNovelDirectorCommand,
  isGenericAutopilotMessage,
  shouldAdvanceBeforeDiscussion
} from "./chunk-KBCA3TZL.js";
import {
  advanceAutonomousProject,
  buildInitialSuperGraph,
  buildSuperGraphIndex,
  createManagedAutonomousProject,
  deleteManagedAutonomousProject,
  formatStatus,
  getWorkspaceSummary,
  initAutonomousProject,
  initializeSuperGraph,
  listAutonomousProjects,
  loadAutonomousState,
  loadSuperGraph,
  loadSuperGraphForUpdate,
  prepareCoverGeneration,
  resolveManagedProjectRoot,
  retryChapterProduction,
  reviewInterruption,
  runMultiAgentDiscussion,
  saveAutonomousState,
  saveSuperGraph,
  superGraphFromDbRows,
  syncManagedProjectState,
  upsertCheckpointInSuperGraph,
  upsertDiscussionInSuperGraph,
  validateSuperGraph
} from "./chunk-AVBBWYBN.js";
import {
  createContinuityContract,
  createDetailedChapterBlueprint,
  createDraftBodyFromBlueprint,
  createProductionMasterOutline,
  evaluateNarrativeStyleQuality,
  evaluatePlotContinuityBridge,
  evaluateWritingResourceUsage,
  generateAgentReply,
  getProjectEnvCandidatePaths,
  getProjectEnvPath,
  getProjectEnvStatus,
  getPublicProjectEnvStatus,
  loadLlmConfigFromEnv,
  loadProductionWritingResources,
  parseQualityGate,
  readProjectEnv,
  resolveProjectEnvWritePath,
  runChapterProductionPipeline,
  testProviderConnectivity,
  upsertProjectEnvValues,
  writeAllDetailedChapterBlueprints,
  writeProductionMasterOutline,
  writeProductionWritingResourceArtifacts
} from "./chunk-5STCOAYV.js";
import {
  backfillPendingKnowledgeEmbeddings,
  chunkKnowledgeContent,
  evaluateKnowledgeBenchmark,
  evaluateKnowledgeRetrieval,
  formatKnowledgeForPrompt,
  ingestGlobalWritingResources,
  ingestKnowledgeSource,
  ingestProjectArtifact,
  retrieveKnowledge
} from "./chunk-SLEOECOV.js";
import {
  FactoryDb,
  backfillPendingMemoryEmbeddings,
  createLocalTextEmbedding,
  evaluateChapterConsistency,
  extractChinesePersonNames,
  getFactoryDbPath,
  inferLockedProtagonistName,
  makeAgentTurnId,
  makeRunId,
  targetToArtifactKind,
  withFactoryDb
} from "./chunk-LMBE7PPD.js";
import {
  agentLabelFromType,
  agentTypeFromLabel,
  createAgentMessage,
  createArtifactMessage,
  createBaseMessage,
  createImageMessage,
  createMessageId,
  createStatusMessage,
  createToolMessage,
  createUserMessage
} from "./chunk-GZKJNHMN.js";

// src/router.ts
function routeUserMessage(message, state) {
  const normalized = message.toLowerCase();
  if (normalized.includes("\u9636\u6BB5") || normalized.includes("\u8FDB\u5EA6") || normalized.includes("status") || normalized.includes("\u73B0\u5728\u8FDB\u884C\u5230")) {
    return {
      type: "status_query",
      reason: `The message asks about current progress while the project is at ${state.runtime.stage}.`
    };
  }
  if (normalized.includes("\u7EE7\u7EED") || normalized.includes("\u4E0B\u4E00\u6B65") || normalized.includes("advance") || normalized.includes("\u63A8\u8FDB")) {
    return {
      type: "workflow_control",
      reason: "The message requests moving the workflow forward."
    };
  }
  if (normalized.includes("\u6574\u4E2A\u6545\u4E8B") || normalized.includes("\u6539\u6210") || normalized.includes("\u91CD\u5199") || normalized.includes("\u98CE\u683C") || normalized.includes("genre")) {
    return {
      type: "interruption_change",
      reason: "The message suggests a change that may alter story direction or project-wide assumptions."
    };
  }
  return {
    type: "worldbuilding",
    reason: "The message adds or refines story content and should enter the multi-agent discussion flow."
  };
}
export {
  FactoryDb,
  advanceAutonomousProject,
  agentLabelFromType,
  agentTypeFromLabel,
  backfillPendingKnowledgeEmbeddings,
  backfillPendingMemoryEmbeddings,
  buildDirectorDiscussionMessage,
  buildInitialSuperGraph,
  buildSuperGraphIndex,
  chunkKnowledgeContent,
  createAgentMessage,
  createArtifactMessage,
  createBaseMessage,
  createContinuityContract,
  createDetailedChapterBlueprint,
  createDraftBodyFromBlueprint,
  createFollowUpAdvanceCommand,
  createImageMessage,
  createLocalTextEmbedding,
  createManagedAutonomousProject,
  createManualAdvanceCommand,
  createManualInterruptCommand,
  createManualRetryChapterCommand,
  createMessageId,
  createProductionMasterOutline,
  createStatusMessage,
  createToolMessage,
  createUserMessage,
  createWorkerWorkspacePayload,
  decideNovelDirectorCommand,
  deleteManagedAutonomousProject,
  evaluateChapterConsistency,
  evaluateKnowledgeBenchmark,
  evaluateKnowledgeRetrieval,
  evaluateNarrativeStyleQuality,
  evaluatePlotContinuityBridge,
  evaluateWritingResourceUsage,
  executeManualAdvanceCommand,
  executeManualInterruptCommand,
  executeManualRetryChapterCommand,
  extractChinesePersonNames,
  formatKnowledgeForPrompt,
  formatStatus,
  generateAgentReply,
  getFactoryDbPath,
  getNovelAutopilotWorkerStatus,
  getProjectEnvCandidatePaths,
  getProjectEnvPath,
  getProjectEnvStatus,
  getPublicProjectEnvStatus,
  getWorkspaceSummary,
  inferLockedProtagonistName,
  ingestGlobalWritingResources,
  ingestKnowledgeSource,
  ingestProjectArtifact,
  initAutonomousProject,
  initializeSuperGraph,
  isGenericAutopilotMessage,
  listAutonomousProjects,
  loadAutonomousState,
  loadLlmConfigFromEnv,
  loadProductionWritingResources,
  loadSuperGraph,
  loadSuperGraphForUpdate,
  makeAgentTurnId,
  makeRunId,
  parseQualityGate,
  prepareCoverGeneration,
  readProjectEnv,
  recordDirectorCommandEvent,
  resolveManagedProjectRoot,
  resolveProjectEnvWritePath,
  retrieveKnowledge,
  retryChapterProduction,
  reviewInterruption,
  routeUserMessage,
  runChapterProductionPipeline,
  runMultiAgentDiscussion,
  runNovelAutopilotWorkerCli,
  runNovelAutopilotWorkerOnce,
  saveAutonomousState,
  saveSuperGraph,
  shouldAdvanceBeforeDiscussion,
  startNovelAutopilotWorker,
  superGraphFromDbRows,
  syncManagedProjectState,
  targetToArtifactKind,
  testProviderConnectivity,
  upsertCheckpointInSuperGraph,
  upsertDiscussionInSuperGraph,
  upsertProjectEnvValues,
  validateSuperGraph,
  withFactoryDb,
  writeAllDetailedChapterBlueprints,
  writeProductionMasterOutline,
  writeProductionWritingResourceArtifacts
};
