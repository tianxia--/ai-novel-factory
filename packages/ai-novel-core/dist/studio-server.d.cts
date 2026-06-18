import { F as FactoryOperationalStatus, K as KnowledgeScope, D as DiscussionTarget } from './factory-db-Ba0neSIC.cjs';
import { P as ProjectRuntimeState } from './project-runtime-state-Cs5Q9tsV.cjs';
import { P as PublicProjectEnvStatus } from './env-manager-BY-bHMi5.cjs';
import { N as NovelProjectRecord, A as AutonomousNovelState, C as CreativeProfile, a as NovelStage, I as InterruptionReview, P as ProviderTestResult, b as AutopilotRuntime, c as ChapterTask, T as TaskStatus } from './cli-types-sWRA2Cw2.cjs';
import { AigcDetectionResult, AigcBatchDetectionResult } from './aigc-detector.cjs';
import http from 'node:http';
import { KnowledgeBenchmarkResult } from './knowledge.cjs';
import './messages.cjs';

interface ServerOptions {
    rootDir?: string;
    port?: number;
    staticDir?: string;
    embeddedWorker?: boolean;
}
interface ApiCallOptions {
    projectId?: string | null;
    embeddedWorker?: boolean;
    onStreamEvent?: (event: {
        role: string;
        content: string;
    }) => void | Promise<void>;
    onAgentStreamEvent?: (event: {
        type: "agent_start";
        messageId?: string;
        turnId: string;
        role: string;
        timestamp?: string;
    } | {
        type: "agent_delta";
        messageId?: string;
        turnId: string;
        role: string;
        delta: string;
        timestamp?: string;
    } | {
        type: "agent_complete";
        messageId?: string;
        turnId: string;
        role: string;
        content: string;
        timestamp?: string;
    } | {
        type: "agent_error";
        messageId?: string;
        turnId: string;
        role: string;
        content: string;
        error: string;
        timestamp?: string;
        phase?: string;
        statusText?: string;
        statusDetail?: string;
    }) => void | Promise<void>;
}
declare function writeServerErrorResponse(response: Pick<http.ServerResponse, "headersSent" | "writableEnded" | "writeHead" | "write" | "end">, error: unknown): void;
declare function handleNovelStudioApi(rootDir: string, method: string, pathname: string, body?: Record<string, unknown>, options?: ApiCallOptions): Promise<{
    status: number;
    payload: {
        error: string;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        projects?: undefined;
        envStatus?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        result: AigcDetectionResult | AigcBatchDetectionResult;
        error?: undefined;
        configs?: undefined;
        success?: undefined;
        projects?: undefined;
        envStatus?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        configs: {
            api_key: string;
            api_key_configured: boolean;
        }[];
        error?: undefined;
        result?: undefined;
        success?: undefined;
        projects?: undefined;
        envStatus?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        success: boolean;
        configs: {
            api_key: string;
            api_key_configured: boolean;
        }[];
        error?: undefined;
        result?: undefined;
        projects?: undefined;
        envStatus?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        projects: NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        projects: NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        deletedProject: {
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
        stoppedInProcess: boolean;
        projects: NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        ok: boolean;
        service: string;
        checkedAt: string;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        projects?: undefined;
        envStatus?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        ok: boolean;
        service: string;
        factory: FactoryOperationalStatus;
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        projects?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        checkedAt?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        ok: boolean;
        service: string;
        error: string;
        checkedAt: string;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        projects?: undefined;
        envStatus?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projectId: string;
        projects: NovelProjectRecord[];
        kickoffQueued: boolean;
        autopilotJobId: null;
        autopilotQueued: boolean;
        state: AutonomousNovelState;
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        nodes: any[];
        edges: any[];
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        transcript: string;
        projects: never[] | NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        notModified: boolean;
        snapshotVersion: string;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        projects?: undefined;
        envStatus?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        transcript: string;
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        pagination: {
            limit: number;
            offset: number;
            returned: number;
            totalMessages: number;
            hasMore: boolean;
            nextOffset: number | null;
            conversationId: string | null;
        };
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            messageId: string;
            conversationId: string;
            runId: string;
            turnId: string;
            type: string;
            status: string;
            role: string;
            content: string;
            timestamp: string;
            time: string;
            data: Record<string, unknown>;
            parts: {
                id: string;
                messageId: string;
                index: number;
                type: string;
                data: object;
                createdAt: string;
            }[];
            metadata: object;
            artifactPath: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
            source: string;
        };
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        messages: never[] | {
            data: {};
            metadata: {};
            parts: {
                data: {};
            }[];
        }[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        chapterNumber: number;
        path: string;
        projects: never[] | NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        chapterNumber: number;
        path: string;
        content: string;
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        path: string;
        projects: never[] | NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        path: string;
        content: string;
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
    } | {
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        recoveryLimited: boolean;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        recoveryLimited: boolean;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        queuedKnowledgeJobs: {
            id: string;
            kind: string;
            artifactPath?: string;
        }[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        queuedKnowledgeJobs: {
            id: string;
            kind: string;
            artifactPath?: string;
        }[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        message: string;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        knowledgeSearch: {
            query: string;
            filters: {
                scopes: KnowledgeScope[];
                sourceTypes: string[];
                chunkTypes: string[];
                limit: number;
            };
            total: number;
            rows: {
                id: string;
                chunkId: string;
                score: number;
                chunkType: string;
                content: string;
                preview: string;
                metadata: {};
                source: {
                    id: string;
                    scope: string;
                    sourceType: string;
                    path: string;
                    title: string;
                };
            }[];
            searchedAt: string;
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        knowledgeSearch: {
            query: string;
            filters: {
                scopes: KnowledgeScope[];
                sourceTypes: string[];
                chunkTypes: string[];
                limit: number;
            };
            total: number;
            rows: {
                id: string;
                chunkId: string;
                score: number;
                chunkType: string;
                content: string;
                preview: string;
                metadata: {};
                source: {
                    id: string;
                    scope: string;
                    sourceType: string;
                    path: string;
                    title: string;
                };
            }[];
            searchedAt: string;
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        knowledgeEvaluation: KnowledgeBenchmarkResult;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        knowledgeEvaluation: KnowledgeBenchmarkResult;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string | null;
        projects: never[] | NovelProjectRecord[];
        result: ProviderTestResult;
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        projects?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        activeProjectId?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        state?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        discussion: {
            runId: string;
            target: DiscussionTarget;
            replies: {
                role: string;
                content: string;
            }[];
            transcriptPath: string;
            contextPacketPath: string;
            summary: string;
            stageGuard: {
                status: "blocked";
                reason: string;
                rawSummary: string;
            };
            writebackSkipped: boolean;
            consensusArchivePath?: undefined;
        } | {
            runId: string;
            target: DiscussionTarget;
            replies: {
                role: string;
                content: string;
            }[];
            transcriptPath: string;
            contextPacketPath: string;
            consensusArchivePath: string;
            summary: string;
            stageGuard: {
                status: "ok";
                reason: string;
                rawSummary?: undefined;
            };
            writebackSkipped: boolean;
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        discussion: {
            runId: string;
            target: DiscussionTarget;
            replies: {
                role: string;
                content: string;
            }[];
            transcriptPath: string;
            contextPacketPath: string;
            summary: string;
            stageGuard: {
                status: "blocked";
                reason: string;
                rawSummary: string;
            };
            writebackSkipped: boolean;
            consensusArchivePath?: undefined;
        } | {
            runId: string;
            target: DiscussionTarget;
            replies: {
                role: string;
                content: string;
            }[];
            transcriptPath: string;
            contextPacketPath: string;
            consensusArchivePath: string;
            summary: string;
            stageGuard: {
                status: "ok";
                reason: string;
                rawSummary?: undefined;
            };
            writebackSkipped: boolean;
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        events: never[];
        discussion: {
            summary: string;
            target: string;
            writebackSkipped: boolean;
            replies: never[];
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        events: never[];
        discussion: {
            summary: string;
            target: string;
            writebackSkipped: boolean;
            replies: never[];
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        entries: {
            key: string;
            role: string;
            content: string;
        }[];
        meta: {
            totalEntries: number;
            returnedEntries: number;
            truncated: boolean;
            transcriptBytes: number;
        };
        snapshotVersion: string;
        transcript: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        events: {
            role: string;
            content: string;
        }[];
        discussion: {
            runId: string;
            target: DiscussionTarget;
            replies: {
                role: string;
                content: string;
            }[];
            transcriptPath: string;
            contextPacketPath: string;
            summary: string;
            stageGuard: {
                status: "blocked";
                reason: string;
                rawSummary: string;
            };
            writebackSkipped: boolean;
            consensusArchivePath?: undefined;
        } | {
            runId: string;
            target: DiscussionTarget;
            replies: {
                role: string;
                content: string;
            }[];
            transcriptPath: string;
            contextPacketPath: string;
            consensusArchivePath: string;
            summary: string;
            stageGuard: {
                status: "ok";
                reason: string;
                rawSummary?: undefined;
            };
            writebackSkipped: boolean;
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        snapshotVersion: string;
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
                    status: TaskStatus;
                    briefPath: string;
                };
                comic: {
                    status: TaskStatus;
                    planPath: string;
                };
            };
        } | null;
        projectRuntime: ProjectRuntimeState;
        consensus: string;
        contextPacket: string;
        graphIndex: any;
        graphViolations: any;
        factorySnapshot: {
            latestRuns: {
                [x: string]: unknown;
            }[];
            latestEvents: {
                [x: string]: unknown;
            }[];
            artifacts: {
                [x: string]: unknown;
            }[];
            recentMemory: {
                [x: string]: unknown;
            }[];
            checkpoints: {
                [x: string]: unknown;
            }[];
            graphNodes: {
                [x: string]: unknown;
            }[];
            graphEdges: {
                [x: string]: unknown;
            }[];
        } | null;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        events: {
            role: string;
            content: string;
        }[];
        discussion: {
            runId: string;
            target: DiscussionTarget;
            replies: {
                role: string;
                content: string;
            }[];
            transcriptPath: string;
            contextPacketPath: string;
            summary: string;
            stageGuard: {
                status: "blocked";
                reason: string;
                rawSummary: string;
            };
            writebackSkipped: boolean;
            consensusArchivePath?: undefined;
        } | {
            runId: string;
            target: DiscussionTarget;
            replies: {
                role: string;
                content: string;
            }[];
            transcriptPath: string;
            contextPacketPath: string;
            consensusArchivePath: string;
            summary: string;
            stageGuard: {
                status: "ok";
                reason: string;
                rawSummary?: undefined;
            };
            writebackSkipped: boolean;
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        projectId?: undefined;
        kickoffQueued?: undefined;
        autopilotJobId?: undefined;
        autopilotQueued?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        message?: undefined;
    };
}>;
declare function startNovelStudioServer(options?: ServerOptions): Promise<{
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    port: number;
    close: () => Promise<void>;
}>;
declare function runNovelStudioServerCli(args?: string[]): Promise<void>;

export { handleNovelStudioApi, runNovelStudioServerCli, startNovelStudioServer, writeServerErrorResponse };
