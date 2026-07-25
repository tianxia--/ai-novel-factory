import { P as ProviderTestResult, A as AutonomousNovelState, g as InitProjectOptions, a as NovelProjectRecord, h as InterruptOptions, I as InterruptionReview } from './cli-types-3z9cP1VA.js';
import { ProductionPipelineOptions } from './writing-pipeline.js';
import './factory-db-Db-lXjCB.js';
import { L as LlmApiMode } from './llm-config-Rvjshu2J.js';

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
    onProviderActivity?: () => void | Promise<void>;
    onUsage?: (usage: LlmUsageMetrics) => void | Promise<void>;
    discussionTarget?: {
        kind: string;
        label: string;
        assetPath: string;
        instruction: string;
    };
    preferredLanguage?: "zh-CN" | "en-US";
    currentStage?: string;
    stageInstruction?: string;
    responseMode?: "discussion" | "drafting" | "artifact";
    envRootDir?: string;
    temperature?: number;
    providerOverride?: ProviderOverrideOptions;
}
interface ProviderOverrideOptions {
    baseUrl?: string;
    apiKey?: string;
    modelName?: string;
    apiMode?: LlmApiMode;
    timeoutMs?: number;
}
interface LlmTextMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
interface LlmTextCompletionOptions {
    baseUrl: string;
    apiKey: string;
    modelName: string;
    apiMode: LlmApiMode;
    timeoutMs: number;
    temperature?: number;
    messages: LlmTextMessage[];
    stream?: boolean;
    maxTokens?: number;
    signal?: AbortSignal;
    onDelta?: (delta: string) => void | Promise<void>;
    onProviderActivity?: () => void | Promise<void>;
    onUsage?: (usage: LlmUsageMetrics) => void | Promise<void>;
}
interface LlmUsageMetrics {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens: number;
    cacheMissTokens: number;
    reasoningTokens: number;
    cacheHitRate: number;
}
declare function extractLlmUsageMetrics(payload: unknown): LlmUsageMetrics | null;
declare function requestLlmTextCompletion(options: LlmTextCompletionOptions): Promise<string>;
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
declare function prepareCoverGeneration(rootDir: string, options?: {
    factoryRootDir?: string;
    projectId?: string | null;
    reason?: string;
}): Promise<AutonomousNovelState>;
declare function reviewInterruption(options: InterruptOptions): Promise<InterruptionReview>;
declare function formatStatus(state: AutonomousNovelState): string;
declare function getWorkspaceSummary(rootDir: string): {
    rootDir: string;
    workspaceDir: string;
    slug: string;
};

export { type LlmUsageMetrics as L, advanceAutonomousProject as a, getWorkspaceSummary as b, createManagedAutonomousProject as c, deleteManagedAutonomousProject as d, extractLlmUsageMetrics as e, formatStatus as f, generateAgentReply as g, loadAutonomousState as h, initAutonomousProject as i, resolveManagedProjectRoot as j, retryChapterProduction as k, listAutonomousProjects as l, reviewInterruption as m, syncManagedProjectState as n, prepareCoverGeneration as p, requestLlmTextCompletion as r, saveAutonomousState as s, testProviderConnectivity as t };
