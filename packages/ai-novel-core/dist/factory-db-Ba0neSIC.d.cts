import { A as AutonomousNovelState, N as NovelProjectRecord, a as NovelStage } from './cli-types-sWRA2Cw2.cjs';
import { NovelMessage, MessagePart } from './messages.cjs';

type SuperGraphNodeType = "Project" | "Mission" | "WorkflowStage" | "Agent" | "Artifact" | "ChapterTask" | "Character" | "Location" | "Faction" | "Event" | "Scene" | "Foreshadowing" | "WorldRule" | "Decision" | "Conflict" | "Relationship" | "TimelinePoint" | "ContextLayer" | "Memory" | "KnowledgeChunk" | "ToolResult" | "Checkpoint" | "DriftGuard" | "DiscussionTurn";
type SuperGraphEdgeType = "HAS_MISSION" | "HAS_STAGE" | "HAS_AGENT" | "HAS_ARTIFACT" | "HAS_CHAPTER_TASK" | "CURRENT_STAGE" | "NEXT_STAGE" | "WRITES" | "READS" | "UPDATES" | "DERIVES_FROM" | "DECIDED_BY" | "CHECKS" | "VIOLATES" | "SUPPORTS" | "APPEARS_IN" | "BELONGS_TO" | "KNOWS" | "CAUSES" | "CONFLICTS_WITH" | "FORESHADOWS" | "PAYS_OFF" | "HAPPENS_BEFORE" | "HAPPENS_AFTER" | "RECALLS" | "USES_CONTEXT_LAYER" | "PRODUCED_TOOL_RESULT" | "SNAPSHOTTED";
interface SuperGraphNode {
    id: string;
    type: SuperGraphNodeType;
    label: string;
    properties: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
interface SuperGraphEdge {
    id: string;
    type: SuperGraphEdgeType;
    from: string;
    to: string;
    properties: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
interface SuperGraph {
    schemaVersion: number;
    projectId: string;
    generatedAt: string;
    nodes: SuperGraphNode[];
    edges: SuperGraphEdge[];
}
interface SuperGraphValidationIssue {
    severity: "warning" | "error";
    code: string;
    message: string;
    nodeId?: string;
    edgeId?: string;
}
declare function buildInitialSuperGraph(state: AutonomousNovelState): SuperGraph;
declare function loadSuperGraph(rootDir: string): Promise<SuperGraph>;
declare function loadSuperGraphForUpdate(rootDir: string, options?: {
    factoryRootDir?: string;
    projectId?: string | null;
}): Promise<SuperGraph>;
declare function superGraphFromDbRows(projectId: string, nodes: Array<Record<string, unknown>>, edges: Array<Record<string, unknown>>): SuperGraph;
declare function saveSuperGraph(rootDir: string, graph: SuperGraph, options?: {
    factoryRootDir?: string;
    projectId?: string | null;
}): Promise<void>;
declare function initializeSuperGraph(rootDir: string, state: AutonomousNovelState, options?: {
    factoryRootDir?: string;
    projectId?: string | null;
}): Promise<SuperGraph>;
declare function upsertDiscussionInSuperGraph(rootDir: string, discussion: {
    target?: {
        kind: string;
        label: string;
        assetPath: string;
    };
    summary?: string;
    transcriptPath?: string;
}, options?: {
    factoryRootDir?: string;
    projectId?: string | null;
}): Promise<SuperGraph>;
declare function upsertCheckpointInSuperGraph(rootDir: string, checkpoint: {
    path: string;
    label: string;
    drift?: {
        score?: number;
        status?: string;
        reason?: string;
    };
}, options?: {
    factoryRootDir?: string;
    projectId?: string | null;
}): Promise<SuperGraph>;
declare function buildSuperGraphIndex(graph: SuperGraph): {
    schemaVersion: number;
    generatedAt: string;
    counts: {
        nodes: number;
        edges: number;
    };
    nodeTypes: {
        [k: string]: number;
    };
    edgeTypes: {
        [k: string]: number;
    };
};
declare function validateSuperGraph(graph: SuperGraph): SuperGraphValidationIssue[];

interface DiscussionOptions {
    envRootDir?: string;
    factoryRootDir?: string;
    projectId?: string;
    runId?: string;
    parentRunId?: string | null;
    directorCommandId?: string | null;
    signal?: AbortSignal;
    onEvent?: (event: {
        role: string;
        content: string;
    }) => void | Promise<void>;
    onStreamEvent?: (event: {
        type: "agent_start";
        messageId?: string;
        turnId: string;
        role: string;
        timestamp?: string;
        phase?: string;
        statusText?: string;
        statusDetail?: string;
    } | {
        type: "agent_delta";
        messageId?: string;
        turnId: string;
        role: string;
        delta: string;
        timestamp?: string;
        phase?: string;
        statusText?: string;
        statusDetail?: string;
    } | {
        type: "agent_complete";
        messageId?: string;
        turnId: string;
        role: string;
        content: string;
        timestamp?: string;
        phase?: string;
        statusText?: string;
        statusDetail?: string;
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
interface DiscussionTarget {
    kind: "worldbuilding" | "character" | "plot" | "chapter" | "style";
    label: string;
    assetPath: string;
    instruction: string;
}
declare function runMultiAgentDiscussion(rootDir: string, message: string, options?: DiscussionOptions): Promise<{
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
}>;

type DbRecord = Record<string, unknown>;
type RunStatus = "idle" | "running" | "paused" | "blocked" | "failed" | "completed";
type StepStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
type JobStatus = RunStatus | "cancelled";
interface AgentTurnInput {
    runId: string;
    turnId: string;
    role: string;
    stage: "opening_brief" | "specialist_turn" | "closing_synthesis";
    status: StepStatus;
    input: unknown;
    output?: string | null;
    error?: string | null;
    model?: string | null;
}
interface WorkflowRunInput {
    id: string;
    projectId: string;
    projectRoot: string;
    kind: "discussion" | "autopilot" | "workflow_advance" | "interruption" | "cover";
    status: RunStatus;
    goal: string;
    stage: NovelStage;
    parentRunId?: string | null;
}
interface ArtifactRecordInput {
    projectId: string;
    kind: "state" | "consensus" | "transcript" | "context" | "chapter" | "plan" | "memory" | "style" | "graph" | "checkpoint";
    path: string;
    status?: StepStatus;
    version?: number;
    metadata?: unknown;
}
interface CheckpointInput {
    projectId: string;
    runId?: string | null;
    path: string;
    label: string;
    drift?: unknown;
    state?: unknown;
}
interface ProjectSnapshot {
    project: NovelProjectRecord | null;
    state: AutonomousNovelState | null;
    activeRuns: DbRecord[];
    latestRuns: DbRecord[];
    latestEvents: DbRecord[];
    artifacts: DbRecord[];
    artifactSummary: {
        total: number;
        blueprints: number;
        finalChapters: number;
        finalChapterFiles: number;
        passedFinalChapters: number;
        blockedFinalChapters: number;
        quarantinedFinalChapters: number;
        untrustedPassedGates: number;
        qualityReports: number;
        memoryUpdates: number;
        latestFinalPath: string;
    };
    chapterFacts: ChapterProductionFact[];
    checkpoints: DbRecord[];
    graphNodes: DbRecord[];
    graphEdges: DbRecord[];
    recentMemory: DbRecord[];
    recentMessages: DbRecord[];
    knowledge: {
        sources: DbRecord[];
        chunks: DbRecord[];
        citations: DbRecord[];
        jobs: DbRecord[];
        latestEvaluation: DbRecord | null;
        summary: {
            globalSources: number;
            projectSources: number;
            readyChunks: number;
            pendingChunks: number;
            failedChunks: number;
        };
    };
    activeJobs: DbRecord[];
    runnableJobs: DbRecord[];
}
interface MessageListOptions {
    conversationId?: string;
    limit?: number;
    offset?: number;
}
interface ChapterProductionFact {
    chapterNumber: number;
    status: "pending" | "in_progress" | "complete" | "blocked";
    contentQuality?: {
        status: "eligible" | "quarantined";
        reason: string;
        wordCount?: number;
        targetWords?: number;
        minimumWords?: number;
    } | null;
    qualityGate?: {
        status: "passed" | "needs_revision" | "blocked";
        score?: number;
        attempts?: number;
        reason?: string;
        wordCount?: number;
        targetWords?: number;
        updatedAt?: string;
    } | null;
    finalPath?: string;
    reportPath?: string;
    latestStep?: string;
    latestEventStatus?: string;
    latestEventAt?: string;
    recoveryQueuedAt?: string;
    resetAt?: string;
    latestTaskStatus?: "pending" | "in_progress" | "complete" | "blocked";
    latestTaskStatusAt?: string;
    updatedAt?: string;
    protagonistName?: string;
    consistency?: {
        status: "eligible" | "quarantined";
        reason: string;
        detectedNames: string[];
    } | null;
}
interface FactoryOperationalStatus {
    ok: boolean;
    checkedAt: string;
    projects: {
        total: number;
        running: number;
    };
    runs: {
        active: number;
    };
    jobs: {
        active: number;
        runnable: number;
        leased: number;
        latest: DbRecord[];
    };
    memory: {
        pendingEmbeddings: number;
        failedEmbeddings: number;
    };
    knowledge: {
        globalSources: number;
        projectSources: number;
        readyChunks: number;
        pendingEmbeddings: number;
        failedEmbeddings: number;
    };
    messages: {
        total: number;
    };
    latestEvents: DbRecord[];
}
type MemoryRecallRow = DbRecord & {
    metadata: unknown;
    score: number;
    updated_at?: unknown;
};
type KnowledgeScope = "global" | "project";
interface KnowledgeSourceInput {
    scope: KnowledgeScope;
    projectId?: string | null;
    sourceType: string;
    path: string;
    title: string;
    contentHash: string;
    version?: string;
    status?: "pending" | "ready" | "failed" | "superseded";
    metadata?: unknown;
}
interface KnowledgeChunkInput {
    id?: string;
    sourceId: string;
    scope: KnowledgeScope;
    projectId?: string | null;
    chunkType: string;
    content: string;
    contentHash: string;
    status?: "pending" | "ready" | "failed" | "superseded";
    metadata?: unknown;
    embedding?: {
        model: string;
        vector: number[];
    };
}
interface KnowledgeCitationInput {
    projectId: string;
    runId?: string | null;
    messageId?: string | null;
    query: string;
    filters?: unknown;
    results: unknown;
    usedChunkIds?: string[];
}
type KnowledgeRecallRow = DbRecord & {
    source?: DbRecord;
    metadata: unknown;
    sourceMetadata: unknown;
    score: number;
};
type KnowledgeChunkRow = DbRecord & {
    id: unknown;
    content: unknown;
    metadata: unknown;
};
declare function getFactoryDbPath(rootDir: string): string;
declare class FactoryDb {
    private readonly db;
    private constructor();
    static open(rootDir: string): Promise<FactoryDb>;
    close(): void;
    private migrate;
    private migrateColumn;
    private migrateGraphTablePrimaryKey;
    upsertProject(record: NovelProjectRecord, state: AutonomousNovelState): void;
    updateProjectState(projectId: string, state: AutonomousNovelState): boolean;
    deleteProject(projectId: string): boolean;
    listProjects(): NovelProjectRecord[];
    pruneProjectsExcept(projectIds: string[]): string[];
    getProject(projectId: string): NovelProjectRecord | null;
    createRun(input: WorkflowRunInput): void;
    updateRun(runId: string, status: RunStatus, patch?: {
        error?: string | null;
        stage?: NovelStage;
    }): void;
    recoverStaleRuns(options?: {
        olderThan?: Date;
        error?: string;
    }): number;
    recordAgentTurn(input: AgentTurnInput): void;
    recordArtifact(input: ArtifactRecordInput): void;
    recordMemory(projectId: string, input: {
        source: string;
        kind: string;
        content: string;
        importance?: number;
        metadata?: unknown;
        embedding?: {
            model: string;
            vector: number[];
        };
    }): string;
    upsertEmbedding(projectId: string, input: {
        id?: string;
        ownerKind: string;
        ownerId: string;
        model: string;
        vector: number[];
    }): string;
    markMemoryEmbeddingFailed(projectId: string, memoryId: string, error: string): void;
    listPendingMemoryForEmbedding(projectId?: string | null, limit?: number): DbRecord[];
    queryMemoryByEmbedding(projectId: string, queryVector: number[], limit?: number): MemoryRecallRow[];
    recallMemory(projectId: string, query?: string, limit?: number, options?: {
        embedding?: number[];
    }): MemoryRecallRow[];
    upsertKnowledgeSource(input: KnowledgeSourceInput): {
        id: string;
        changed: boolean;
    };
    replaceKnowledgeChunks(sourceId: string, chunks: KnowledgeChunkInput[]): string[];
    upsertKnowledgeEmbedding(chunkId: string, model: string, vector: number[]): string;
    markKnowledgeEmbeddingFailed(chunkId: string, error: string): void;
    listPendingKnowledgeChunks(options?: {
        projectId?: string | null;
        scope?: KnowledgeScope;
        limit?: number;
    }): KnowledgeChunkRow[];
    queryKnowledgeByEmbedding(queryVector: number[], options?: {
        projectId?: string | null;
        scopes?: KnowledgeScope[];
        sourceTypes?: string[];
        chunkTypes?: string[];
        limit?: number;
    }): KnowledgeRecallRow[];
    recallKnowledge(query?: string, options?: {
        projectId?: string | null;
        scopes?: KnowledgeScope[];
        sourceTypes?: string[];
        chunkTypes?: string[];
        limit?: number;
        embedding?: number[];
    }): KnowledgeRecallRow[];
    recordKnowledgeCitation(input: KnowledgeCitationInput): void;
    getKnowledgeSummary(projectId: string): {
        sources: DbRecord[];
        chunks: DbRecord[];
        citations: DbRecord[];
        jobs: (DbRecord & {
            payload: unknown;
        })[];
        latestEvaluation: {
            payload: {};
        } | null;
        summary: {
            globalSources: number;
            projectSources: number;
            readyChunks: number;
            pendingChunks: number;
            failedChunks: number;
        };
    };
    private listKnowledgeCandidateRows;
    private mapKnowledgeRecallRow;
    upsertGraph(projectId: string, nodes: SuperGraphNode[], edges: SuperGraphEdge[]): void;
    getGraph(projectId: string): {
        nodes: DbRecord[];
        edges: DbRecord[];
    };
    recordCheckpoint(input: CheckpointInput): void;
    recordEvent(projectId: string | null, runId: string | null, type: string, payload: unknown): void;
    recordMessage(message: NovelMessage, parts?: MessagePart[]): void;
    countMessages(projectId: string, options?: {
        conversationId?: string;
    }): number;
    listMessages(projectId: string, options?: MessageListOptions): {
        data: {};
        metadata: {};
        parts: {
            data: {};
        }[];
    }[];
    markStreamingMessagesFailed(projectId: string, options?: {
        conversationId?: string;
        chapterNumber?: number;
        reason?: string;
        limit?: number;
    }): number;
    createJob(input: {
        projectId: string;
        runId?: string | null;
        kind: string;
        status: JobStatus;
        payload?: unknown;
    }): string;
    updateJobPayload(jobId: string, payload: unknown): void;
    updateJob(jobId: string, status: JobStatus, patch?: {
        leaseOwner?: string | null;
        leaseExpiresAt?: string | null;
    }): void;
    listRunnableJobs(kind?: string, now?: Date, options?: {
        includeIdle?: boolean;
    }): (DbRecord & {
        payload: unknown;
    })[];
    claimJob(jobId: string, owner: string, leaseSeconds?: number, now?: Date, options?: {
        includeIdle?: boolean;
    }): {
        [x: string]: unknown;
        payload: unknown;
    } | null;
    heartbeatJob(jobId: string, owner: string, leaseSeconds?: number, now?: Date): string | null;
    releaseJobLease(jobId: string, reason?: string): void;
    completeJob(jobId: string, owner?: string | null): void;
    failJob(jobId: string, error: string, owner?: string | null): void;
    pauseJob(jobId: string, owner?: string | null): void;
    resumeJob(jobId: string, payload?: unknown): void;
    jobFailureLooksRecoverable(jobId: string): boolean;
    cancelJob(jobId: string, owner?: string | null): void;
    listProjectJobs(projectId: string, kind?: string): (DbRecord & {
        payload: unknown;
    })[];
    cancelProjectJobs(projectId: string, kind?: string): number;
    private finishJob;
    getChapterFacts(projectId: string, now?: Date): ChapterProductionFact[];
    getSnapshot(projectId: string): ProjectSnapshot;
    getOperationalStatus(now?: Date): FactoryOperationalStatus;
    listLlmConfigs(): DbRecord[];
    addLlmConfig(config: {
        name: string;
        baseUrl: string;
        apiKey: string;
        modelName: string;
        temperature?: number;
        timeoutMs?: number;
        isActive?: boolean;
    }): string;
    updateLlmConfig(id: string, config: {
        name: string;
        baseUrl: string;
        apiKey: string;
        modelName: string;
        temperature?: number;
        timeoutMs?: number;
    }): void;
    deleteLlmConfig(id: string): void;
    activateLlmConfig(id: string): void;
    getActiveLlmConfig(): DbRecord | null;
}
declare function withFactoryDb<T>(rootDir: string, callback: (db: FactoryDb) => T | Promise<T>): Promise<T>;
declare function makeRunId(kind: string): string;
declare function makeAgentTurnId(runId: string, agentId: string, index: number): string;
declare function targetToArtifactKind(target: DiscussionTarget): ArtifactRecordInput["kind"];

export { type AgentTurnInput as A, upsertDiscussionInSuperGraph as B, type ChapterProductionFact as C, type DiscussionTarget as D, validateSuperGraph as E, type FactoryOperationalStatus as F, withFactoryDb as G, type KnowledgeScope as K, type MessageListOptions as M, type ProjectSnapshot as P, type SuperGraph as S, type WorkflowRunInput as W, type KnowledgeRecallRow as a, type ArtifactRecordInput as b, type CheckpointInput as c, FactoryDb as d, type KnowledgeChunkInput as e, type KnowledgeChunkRow as f, type KnowledgeCitationInput as g, type KnowledgeSourceInput as h, type SuperGraphEdge as i, type SuperGraphEdgeType as j, type SuperGraphNode as k, type SuperGraphNodeType as l, type SuperGraphValidationIssue as m, buildInitialSuperGraph as n, buildSuperGraphIndex as o, getFactoryDbPath as p, initializeSuperGraph as q, loadSuperGraph as r, loadSuperGraphForUpdate as s, makeAgentTurnId as t, makeRunId as u, runMultiAgentDiscussion as v, saveSuperGraph as w, superGraphFromDbRows as x, targetToArtifactKind as y, upsertCheckpointInSuperGraph as z };
