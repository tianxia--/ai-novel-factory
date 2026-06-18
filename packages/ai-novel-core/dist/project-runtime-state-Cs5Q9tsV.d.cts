import { A as AutonomousNovelState, a as NovelStage } from './cli-types-sWRA2Cw2.cjs';

type ProjectWorkflowStage = NovelStage | "empty" | "unknown";
type ProjectProductionStatus = "not_started" | "worldbuilding" | "planning" | "ready_to_draft" | "drafting" | "reviewing" | "replanning" | "blocked" | "complete" | "unknown";
type ProjectExecutionStatus = "idle" | "running" | "paused" | "queued" | "blocked" | "stopping" | "unknown";
type ProjectPrimaryAction = "start" | "continue" | "resume" | "pause" | "retry_blocked" | "review" | "none";
type ProjectNextTarget = {
    type: "chapter";
    chapterNumber: number;
} | {
    type: "stage";
    stage: ProjectWorkflowStage;
} | {
    type: "project";
} | null;
interface ProjectChapterProgress {
    totalChapters: number;
    completedChapters: number;
    passedChapters: number;
    contiguousCompletedChapters: number;
    pendingChapters: number;
    inProgressChapters: number;
    blockedChapters: number;
    nextChapterNumber: number | null;
    progressPercent: number;
}
interface ProjectRuntimeState {
    workflowStage: ProjectWorkflowStage;
    rawWorkflowStage: string;
    productionStatus: ProjectProductionStatus;
    executionStatus: ProjectExecutionStatus;
    primaryAction: ProjectPrimaryAction;
    primaryActionLabel: string;
    nextTarget: ProjectNextTarget;
    reason: string;
    chapterProgress: ProjectChapterProgress;
    runningJobs: number;
    recoverableJobs: number;
    runnableJobs: number;
    activeJobs: number;
    updatedAt: string;
}
interface DeriveProjectRuntimeStateInput {
    state?: AutonomousNovelState | Record<string, any> | null;
    factorySnapshot?: Record<string, any> | null;
    now?: Date | string;
}
declare function deriveProjectRuntimeState(input?: DeriveProjectRuntimeStateInput): ProjectRuntimeState;

export { type DeriveProjectRuntimeStateInput as D, type ProjectRuntimeState as P, type ProjectChapterProgress as a, type ProjectExecutionStatus as b, type ProjectNextTarget as c, type ProjectPrimaryAction as d, type ProjectProductionStatus as e, type ProjectWorkflowStage as f, deriveProjectRuntimeState as g };
