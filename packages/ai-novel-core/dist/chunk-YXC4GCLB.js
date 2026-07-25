import {
  executeProductionChapterNode,
  inspectProductionChapterNode,
  listProductionChapterNodes
} from "./chunk-473UU5WW.js";
import {
  executeProductionPlanningNode,
  inspectProductionPlanningNode,
  listProductionPlanningNodes
} from "./chunk-5BNDTIGH.js";
import {
  executeProductionAdvanceThroughKernel,
  listProductionWorkflowNodes,
  resolveProductionWorkflowNode
} from "./chunk-VOQWLW5S.js";
import {
  advanceAutonomousProject,
  loadAutonomousState,
  resolveManagedProjectRoot
} from "./chunk-EVOZRM5F.js";
import {
  FactoryWorkflowTraceRecorder
} from "./chunk-ZWH2XUVC.js";

// src/production-workflow-sandbox.ts
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
var activeProductionWorkflowSandboxes = /* @__PURE__ */ new Set();
function assertSafeSandboxId(sandboxId) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/u.test(sandboxId)) {
    throw new Error("invalid_production_workflow_sandbox_id");
  }
  return sandboxId;
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function stateEvidence(state) {
  const tasks = state.plan.chapterTasks || [];
  return {
    stage: state.runtime.stage,
    statusMessage: state.runtime.statusMessage || null,
    lastAction: state.runtime.lastAction || null,
    chapterCounts: {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === "pending").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      complete: tasks.filter((task) => task.status === "complete").length,
      blocked: tasks.filter((task) => task.status === "blocked").length
    }
  };
}
async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}
`, "utf8");
  await fs.rename(temporaryPath, filePath);
}
var ProductionWorkflowSandboxManager = class {
  constructor(factoryRootDir) {
    this.factoryRootDir = factoryRootDir;
    this.sandboxesRoot = path.join(factoryRootDir, ".ai-novel-factory", "workflow-sandboxes");
    this.traceRecorder = new FactoryWorkflowTraceRecorder(factoryRootDir);
  }
  factoryRootDir;
  sandboxesRoot;
  traceRecorder;
  sandboxRoot(sandboxId) {
    return path.join(this.sandboxesRoot, assertSafeSandboxId(sandboxId));
  }
  manifestPath(sandboxId) {
    return path.join(this.sandboxRoot(sandboxId), "sandbox.json");
  }
  async create(projectId, sandboxId = `production_debug_${Date.now()}_${randomUUID().slice(0, 8)}`) {
    const sourceProjectRoot = await resolveManagedProjectRoot(this.factoryRootDir, projectId);
    const sandboxRoot = this.sandboxRoot(sandboxId);
    const sourceNovelRoot = path.join(sourceProjectRoot, ".ai-novel");
    const sandboxNovelRoot = path.join(sandboxRoot, ".ai-novel");
    await fs.access(sourceNovelRoot);
    await fs.mkdir(sandboxRoot, { recursive: true });
    await fs.cp(sourceNovelRoot, sandboxNovelRoot, { recursive: true, force: false, errorOnExist: true });
    const createdAt = nowIso();
    const manifest = {
      sandboxId,
      projectId,
      sourceProjectRoot,
      sandboxRoot,
      createdAt,
      updatedAt: createdAt,
      status: "ready",
      activeRunId: null,
      runs: []
    };
    await writeJsonAtomic(this.manifestPath(sandboxId), manifest);
    return this.inspect(sandboxId);
  }
  async loadManifest(sandboxId) {
    const raw = await fs.readFile(this.manifestPath(sandboxId), "utf8");
    return JSON.parse(raw);
  }
  async inspect(sandboxId) {
    const manifest = await this.loadManifest(sandboxId);
    const state = await loadAutonomousState(manifest.sandboxRoot);
    const planning = await inspectProductionPlanningNode(manifest.sandboxRoot, state);
    const chapter = await inspectProductionChapterNode(manifest.sandboxRoot, state);
    const currentNode = planning.currentNode || chapter.currentNode || resolveProductionWorkflowNode(state.runtime.stage);
    const latestRun = manifest.runs.at(-1) || null;
    let workflowEvidence = null;
    if (latestRun) {
      const trace = latestRun.trace || {
        projectId: manifest.projectId,
        runId: `manual_${latestRun.runId}`,
        stepId: `step_${latestRun.runId}`,
        attemptCount: 0,
        lastSyncedStatus: "running"
      };
      try {
        const evidence = await this.traceRecorder.loadEvidence(trace);
        if (evidence.run) workflowEvidence = evidence;
      } catch {
      }
    }
    let humanGate = null;
    if (state.runtime.stage === "setting_review") {
      const approvalPath = path.join(manifest.sandboxRoot, ".ai-novel", "plans", "setting-review-approval.json");
      let approval = null;
      try {
        approval = JSON.parse(await fs.readFile(approvalPath, "utf8"));
      } catch {
        approval = null;
      }
      if (approval?.approved !== true) {
        humanGate = {
          id: "setting-review",
          status: approval?.approved === false ? "rejected" : "required",
          reviewPath: ".ai-novel/plans/setting-freeze.md",
          approvalPath: ".ai-novel/plans/setting-review-approval.json"
        };
      } else {
        const protagonistPath = path.join(manifest.sandboxRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md");
        let protagonistProfile = "";
        try {
          protagonistProfile = await fs.readFile(protagonistPath, "utf8");
        } catch {
          protagonistProfile = "";
        }
        humanGate = {
          id: "protagonist-profile",
          status: /Status:\s*confirmed|Canonical Protagonist:\s*[^\s-]/iu.test(protagonistProfile) ? "approved" : "required",
          approvalPath: ".ai-novel/memory/characters/core/protagonist.md"
        };
      }
    }
    return {
      manifest,
      state,
      currentNode,
      nodes: [...listProductionWorkflowNodes(), ...listProductionPlanningNodes(), ...listProductionChapterNodes()],
      canExecuteCurrentNode: manifest.status !== "running" && !activeProductionWorkflowSandboxes.has(sandboxId) && humanGate?.status !== "required" && humanGate?.status !== "rejected",
      workflowEvidence,
      humanGate
    };
  }
  async approveSettingReview(sandboxId) {
    if (activeProductionWorkflowSandboxes.has(sandboxId)) throw new Error("production_workflow_sandbox_busy");
    const manifest = await this.loadManifest(sandboxId);
    if (manifest.status === "running") throw new Error("production_workflow_sandbox_has_unfinished_run");
    const state = await loadAutonomousState(manifest.sandboxRoot);
    if (state.runtime.stage !== "setting_review") {
      throw new Error(`production_workflow_setting_review_not_current:${state.runtime.stage}`);
    }
    const reviewPath = path.join(manifest.sandboxRoot, ".ai-novel", "plans", "setting-freeze.md");
    await fs.access(reviewPath);
    await writeJsonAtomic(path.join(manifest.sandboxRoot, ".ai-novel", "plans", "setting-review-approval.json"), {
      version: 1,
      status: "approved",
      approved: true,
      reviewedAt: nowIso(),
      reviewedBy: "flow-debug-user",
      note: "\u7528\u6237\u5728\u6B63\u5F0F\u6D41\u7A0B\u6C99\u76D2\u4E2D\u786E\u8BA4\u5F53\u524D setting review packet\uFF0C\u53EF\u7EE7\u7EED\u9A8C\u8BC1\u540E\u7EED\u751F\u4EA7\u8282\u70B9\u3002",
      rejectionReason: "",
      settingReviewPath: ".ai-novel/plans/setting-freeze.md",
      approvalScope: "setting_review"
    });
    return this.inspect(sandboxId);
  }
  async confirmProtagonistProfile(sandboxId, input) {
    if (activeProductionWorkflowSandboxes.has(sandboxId)) throw new Error("production_workflow_sandbox_busy");
    const manifest = await this.loadManifest(sandboxId);
    if (manifest.status === "running") throw new Error("production_workflow_sandbox_has_unfinished_run");
    const state = await loadAutonomousState(manifest.sandboxRoot);
    if (state.runtime.stage !== "setting_review") {
      throw new Error(`production_workflow_protagonist_profile_not_current:${state.runtime.stage}`);
    }
    const fields = {
      name: String(input.name || "").trim(),
      identity: String(input.identity || "").trim(),
      coreDesire: String(input.coreDesire || "").trim(),
      fearOrWound: String(input.fearOrWound || "").trim(),
      behaviorHabit: String(input.behaviorHabit || "").trim(),
      speechMarker: String(input.speechMarker || "").trim(),
      relationshipName: String(input.relationshipName || "").trim(),
      relationshipPressure: String(input.relationshipPressure || "").trim()
    };
    const missing = Object.entries(fields).filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) throw new Error(`production_workflow_protagonist_profile_incomplete:${missing.join(",")}`);
    const confirmedAt = nowIso();
    const markdown = [
      "# Confirmed Protagonist Profile",
      "",
      "Status: confirmed",
      `Confirmed At: ${confirmedAt}`,
      "Confirmed By: flow-debug-user",
      "",
      `Canonical Protagonist: ${fields.name}`,
      `\u6838\u5FC3\u4E3B\u89D2: ${fields.name}`,
      `\u4E3B\u89D2\u59D3\u540D: ${fields.name}`,
      "",
      `#### ${fields.name}\uFF08\u4E3B\u89D2 / protagonist\uFF09`,
      "",
      "- id: protagonist",
      "- role: protagonist",
      `- aliases: ${fields.name}\u3001\u4E3B\u89D2`,
      `- identity and role: ${fields.identity}`,
      `- core desire: ${fields.coreDesire}`,
      `- fear or wound: ${fields.fearOrWound}`,
      `- contradiction: ${fields.name} \u5FC5\u987B\u5728\u300C${fields.coreDesire}\u300D\u548C\u300C${fields.fearOrWound}\u300D\u4E4B\u95F4\u6301\u7EED\u505A\u9009\u62E9\u3002`,
      `- behavior habits: ${fields.behaviorHabit}`,
      `- speech markers: ${fields.speechMarker}`,
      `- named relationship pressure: ${fields.relationshipName} - ${fields.relationshipPressure}`,
      "",
      "## Production Contract",
      "",
      "- Master planning must use this concrete protagonist and must not replace the name with a role label.",
      "- Story foundation and chapter blueprints must preserve the named relationship pressure above."
    ].join("\n");
    const profilePath = path.join(manifest.sandboxRoot, ".ai-novel", "memory", "characters", "core", "protagonist.md");
    await fs.mkdir(path.dirname(profilePath), { recursive: true });
    await fs.writeFile(profilePath, `${markdown}
`, "utf8");
    return this.inspect(sandboxId);
  }
  async executeNode(sandboxId, requestedNodeId) {
    if (activeProductionWorkflowSandboxes.has(sandboxId)) throw new Error("production_workflow_sandbox_busy");
    const manifest = await this.loadManifest(sandboxId);
    if (manifest.status === "running") throw new Error("production_workflow_sandbox_has_unfinished_run");
    const beforeState = await loadAutonomousState(manifest.sandboxRoot);
    const planning = await inspectProductionPlanningNode(manifest.sandboxRoot, beforeState);
    const chapter = await inspectProductionChapterNode(manifest.sandboxRoot, beforeState);
    const currentNode = planning.currentNode || chapter.currentNode || resolveProductionWorkflowNode(beforeState.runtime.stage);
    if (requestedNodeId !== currentNode.id) {
      throw new Error(`production_workflow_node_not_current:requested=${requestedNodeId}:current=${currentNode.id}`);
    }
    const runId = `production_node_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const run = {
      runId,
      nodeId: currentNode.id,
      nodeName: currentNode.name,
      startedAt: nowIso(),
      completedAt: null,
      status: "running",
      beforeStage: beforeState.runtime.stage,
      afterStage: null,
      beforeState: stateEvidence(beforeState),
      afterState: null,
      trace: null,
      error: null
    };
    manifest.status = "running";
    manifest.activeRunId = runId;
    manifest.updatedAt = nowIso();
    manifest.runs.push(run);
    await writeJsonAtomic(this.manifestPath(sandboxId), manifest);
    activeProductionWorkflowSandboxes.add(sandboxId);
    try {
      const metadata = {
        isolatedProductionSandbox: true,
        sandboxId,
        sourceProjectRoot: manifest.sourceProjectRoot
      };
      const result = currentNode.id === "production.story-foundation" || currentNode.id === "production.chapter-blueprints" ? await executeProductionPlanningNode({
        projectRoot: manifest.sandboxRoot,
        factoryRootDir: this.factoryRootDir,
        projectId: manifest.projectId,
        state: beforeState,
        options: { envRootDir: manifest.sourceProjectRoot, preferDeterministicPlanning: process.env.AI_NOVEL_TEST_MODE === "1" },
        metadata
      }, currentNode.id, runId) : currentNode.id === "production.chapter-draft" || currentNode.id === "production.chapter-quality" || currentNode.id === "production.chapter-naturalness" || currentNode.id === "production.chapter-commit" ? await executeProductionChapterNode({
        projectRoot: manifest.sandboxRoot,
        factoryRootDir: this.factoryRootDir,
        projectId: manifest.projectId,
        state: beforeState,
        chapterNumber: chapter.chapterNumber,
        options: { envRootDir: manifest.sourceProjectRoot, writingMode: "quality" },
        metadata
      }, currentNode.id, runId) : await executeProductionAdvanceThroughKernel({
        rootDir: manifest.sandboxRoot,
        factoryRootDir: this.factoryRootDir,
        projectId: manifest.projectId,
        state: beforeState,
        executionMode: "manual",
        externalRunId: runId,
        enabled: true,
        metadata
      }, () => advanceAutonomousProject(manifest.sandboxRoot, {
        factoryRootDir: this.factoryRootDir,
        envRootDir: manifest.sourceProjectRoot
      }));
      run.status = "completed";
      run.completedAt = nowIso();
      run.afterStage = result.state.runtime.stage;
      run.afterState = stateEvidence(result.state);
      run.trace = result.trace;
      manifest.status = "ready";
      manifest.activeRunId = null;
      manifest.updatedAt = run.completedAt;
      await writeJsonAtomic(this.manifestPath(sandboxId), manifest);
      return this.inspect(sandboxId);
    } catch (error) {
      run.status = "failed";
      run.completedAt = nowIso();
      run.error = error instanceof Error ? error.message : String(error);
      manifest.status = "failed";
      manifest.activeRunId = null;
      manifest.updatedAt = run.completedAt;
      await writeJsonAtomic(this.manifestPath(sandboxId), manifest);
      throw error;
    } finally {
      activeProductionWorkflowSandboxes.delete(sandboxId);
    }
  }
};

export {
  ProductionWorkflowSandboxManager
};
