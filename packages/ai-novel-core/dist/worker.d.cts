import { P as PublicProjectEnvStatus } from './env-manager-C1eYTzhS.cjs';
import { P as ProjectSnapshot, F as FactoryOperationalStatus } from './factory-db-V9WfwecY.cjs';
import { A as AutonomousNovelState, a as NovelStage, I as InterruptionReview, P as ProviderTestResult, b as AutopilotRuntime, C as ChapterTask, T as TaskStatus } from './cli-types-C4ri71cJ.cjs';
import './messages.cjs';

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
                status: TaskStatus;
                briefPath: string;
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
}>;
declare function runNovelAutopilotWorkerOnce(rootDir: string): Promise<{
    ok: boolean;
    service: string;
    rootDir: string;
    factory: FactoryOperationalStatus;
    envStatus: PublicProjectEnvStatus;
}>;
declare function runNovelAutopilotWorkerCli(args?: string[]): Promise<void>;

export { createWorkerWorkspacePayload, getNovelAutopilotWorkerStatus, runNovelAutopilotWorkerCli, runNovelAutopilotWorkerOnce, startNovelAutopilotWorker };
