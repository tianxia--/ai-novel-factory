import { P as PublicProjectEnvStatus, L as LlmApiMode } from './llm-config-Rvjshu2J.js';
import { P as ProjectSnapshot, F as FactoryOperationalStatus } from './factory-db-tGpa3fau.js';
import { A as AutonomousNovelState, C as CreativeProfile, a as NovelStage, I as InterruptionReview, P as ProviderTestResult, b as AutopilotRuntime, c as ChapterTask, e as AssetStatus, T as TaskStatus } from './cli-types-dnbh9JaE.js';
import './messages.js';

declare function createWorkerWorkspacePayload(projectRoot: string, state?: AutonomousNovelState | null, options?: {
    rootDir?: string;
    projectId?: string | null;
}): Promise<{
    state: {
        project: {
            title: string;
            idea: string;
            createdAt: string;
            workspaceVersion: number;
            autoMode?: "full" | "semi";
            creativeProfile?: CreativeProfile;
        };
        runtime: {
            stage: NovelStage;
            statusMessage: string;
            lastUpdatedAt: string;
            lastInterruption: InterruptionReview | null;
            lastRoute?: string;
            lastAction?: string;
            lastProviderCheck?: ProviderTestResult | null;
            autopilot?: AutopilotRuntime;
        };
        reactSetup: {
            discussionGoals: string[];
            unansweredQuestions: string[];
        };
        plan: {
            totalChapters: number;
            chapterWordTarget: number;
            pendingChapters: number;
            chapterTasks: ChapterTask[];
        };
        assets: {
            cover: {
                status: AssetStatus;
                briefPath: string;
                promptPath?: string;
                imagePath?: string;
                metadataPath?: string;
                generatedAt?: string;
                error?: string;
            };
            comic: {
                status: TaskStatus;
                planPath: string;
            };
        };
    } | null;
    transcript: string;
    consensus: string;
    contextPacket: string;
    graphIndex: null;
    graphViolations: never[];
    factorySnapshot: ProjectSnapshot | null;
    projectRoot: string;
}>;
declare function startNovelAutopilotWorker(options: {
    rootDir: string;
    pollMs?: number;
}): Promise<{
    close: () => void;
}>;
declare function getNovelAutopilotWorkerStatus(rootDir: string): Promise<{
    ok: boolean;
    service: string;
    rootDir: string;
    factory: FactoryOperationalStatus;
    envStatus: PublicProjectEnvStatus;
    llm: {
        capability: string;
        configId: string | null;
        baseUrl: string;
        modelName: string;
        apiMode: LlmApiMode;
        source: string;
    } | {
        capability: string;
        configId: null;
        baseUrl: string;
        modelName: string;
        apiMode: string;
        source: string;
    };
}>;
declare function runNovelAutopilotWorkerOnce(rootDir: string): Promise<{
    ok: boolean;
    service: string;
    rootDir: string;
    factory: FactoryOperationalStatus;
    envStatus: PublicProjectEnvStatus;
    llm: {
        capability: string;
        configId: string | null;
        baseUrl: string;
        modelName: string;
        apiMode: LlmApiMode;
        source: string;
    } | {
        capability: string;
        configId: null;
        baseUrl: string;
        modelName: string;
        apiMode: string;
        source: string;
    };
}>;
declare function runNovelAutopilotWorkerCli(args?: string[]): Promise<void>;

export { createWorkerWorkspacePayload, getNovelAutopilotWorkerStatus, runNovelAutopilotWorkerCli, runNovelAutopilotWorkerOnce, startNovelAutopilotWorker };
