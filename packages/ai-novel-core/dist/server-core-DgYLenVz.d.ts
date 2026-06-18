import { P as ProviderTestResult, A as AutonomousNovelState, f as InitProjectOptions, N as NovelProjectRecord, g as InterruptOptions, I as InterruptionReview } from './cli-types-sWRA2Cw2.js';
import { ProductionPipelineOptions } from './writing-pipeline.js';
import './factory-db-am8z7hMk.js';
import './env-manager-BY-bHMi5.js';

interface AgentReplyOptions {
    roleName: string;
    basePrompt: string;
    dynamicPrompt: string;
    consensus: string;
    message: string;
    signal?: AbortSignal;
    discussionStage?: "opening_brief" | "specialist_turn" | "closing_synthesis";
    priorTranscript?: string;
    onDelta?: (delta: string) => void | Promise<void>;
    discussionTarget?: {
        kind: string;
        label: string;
        assetPath: string;
        instruction: string;
    };
    preferredLanguage?: "zh-CN" | "en-US";
    currentStage?: string;
    stageInstruction?: string;
    envRootDir?: string;
    temperature?: number;
}
interface ProviderOverrideOptions {
    baseUrl?: string;
    apiKey?: string;
    modelName?: string;
}
declare function generateAgentReply(options: AgentReplyOptions): Promise<string>;
declare function testProviderConnectivity(overrides?: ProviderOverrideOptions, rootDir?: string): Promise<ProviderTestResult>;

declare function initAutonomousProject(options: InitProjectOptions): Promise<AutonomousNovelState>;
declare function listAutonomousProjects(rootDir: string): Promise<NovelProjectRecord[]>;
declare function deleteManagedAutonomousProject(rootDir: string, projectId: string): Promise<{
    project: {
        projectRoot: string;
        id: string;
        slug: string;
        title: string;
        idea: string;
        createdAt: string;
        totalChapters: number;
        chapterWordTarget: number;
        summary?: {
            source: "db" | "state" | "empty";
            stage: string;
            progressPercent: number;
            totalChapters: number;
            completedChapters: number;
            pendingChapters: number;
            inProgressChapters: number;
            blockedChapters: number;
            activeJobs: number;
            runnableJobs: number;
            latestEventType: string;
            latestEventAt: string;
            updatedAt: string;
        };
    };
} | null>;
declare function resolveManagedProjectRoot(rootDir: string, projectId: string): Promise<string>;
declare function createManagedAutonomousProject(options: InitProjectOptions): Promise<{
    project: NovelProjectRecord;
    state: AutonomousNovelState;
}>;
declare function loadAutonomousState(rootDir: string): Promise<AutonomousNovelState>;
declare function saveAutonomousState(rootDir: string, state: AutonomousNovelState): Promise<void>;
declare function syncManagedProjectState(rootDir: string, projectId: string, state: AutonomousNovelState): Promise<void>;
declare function advanceAutonomousProject(rootDir: string, options?: ProductionPipelineOptions): Promise<AutonomousNovelState>;
declare function retryChapterProduction(rootDir: string, chapterNumber: number, options?: ProductionPipelineOptions & {
    runNow?: boolean;
    maxRecoveryAttempts?: number;
}): Promise<AutonomousNovelState>;
declare function prepareCoverGeneration(rootDir: string): Promise<AutonomousNovelState>;
declare function reviewInterruption(options: InterruptOptions): Promise<InterruptionReview>;
declare function formatStatus(state: AutonomousNovelState): string;
declare function getWorkspaceSummary(rootDir: string): {
    rootDir: string;
    workspaceDir: string;
    slug: string;
};

export { advanceAutonomousProject as a, getWorkspaceSummary as b, createManagedAutonomousProject as c, deleteManagedAutonomousProject as d, loadAutonomousState as e, formatStatus as f, generateAgentReply as g, retryChapterProduction as h, initAutonomousProject as i, reviewInterruption as j, syncManagedProjectState as k, listAutonomousProjects as l, prepareCoverGeneration as p, resolveManagedProjectRoot as r, saveAutonomousState as s, testProviderConnectivity as t };
