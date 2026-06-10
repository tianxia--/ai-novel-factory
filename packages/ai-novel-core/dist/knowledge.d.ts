import { K as KnowledgeScope, a as KnowledgeRecallRow } from './factory-db-D-IFvtpa.js';
import './cli-types-B17O02vG.js';
import './messages.js';

interface KnowledgeChunkDraft {
    chunkType: string;
    content: string;
    metadata?: Record<string, unknown>;
}
interface IngestKnowledgeSourceOptions {
    rootDir: string;
    scope: KnowledgeScope;
    projectId?: string | null;
    sourceType: string;
    path: string;
    title?: string;
    content: string;
    version?: string;
    metadata?: Record<string, unknown>;
    chunkLimit?: number;
    chunkCharLimit?: number;
}
interface KnowledgeRetrieveOptions {
    rootDir: string;
    projectId?: string | null;
    query: string;
    scopes?: KnowledgeScope[];
    sourceTypes?: string[];
    chunkTypes?: string[];
    limit?: number;
    runId?: string | null;
    messageId?: string | null;
    recordCitation?: boolean;
}
interface KnowledgeRetrievalEvaluation {
    k: number;
    expectedChunkIds: string[];
    returnedChunkIds: string[];
    matchedChunkIds: string[];
    missedChunkIds: string[];
    unexpectedChunkIds: string[];
    hitAtK: number;
    recallAtK: number;
    precisionAtK: number;
}
interface KnowledgeBenchmarkCase {
    name: string;
    query: string;
    expectedChunkIds: string[];
    projectId?: string | null;
    scopes?: KnowledgeScope[];
    sourceTypes?: string[];
    chunkTypes?: string[];
    k?: number;
}
interface KnowledgeBenchmarkCaseResult extends KnowledgeRetrievalEvaluation {
    name: string;
    query: string;
}
interface KnowledgeBenchmarkResult {
    cases: KnowledgeBenchmarkCaseResult[];
    summary: {
        totalCases: number;
        hitRateAtK: number;
        meanRecallAtK: number;
        meanPrecisionAtK: number;
    };
}
declare function chunkKnowledgeContent(input: {
    content: string;
    sourceType: string;
    path?: string;
    chunkLimit?: number;
    chunkCharLimit?: number;
}): KnowledgeChunkDraft[];
declare function ingestKnowledgeSource(options: IngestKnowledgeSourceOptions): Promise<{
    sourceId: string;
    chunks: number;
    changed: boolean;
}>;
declare function ingestGlobalWritingResources(rootDir: string, options?: {
    limit?: number;
}): Promise<{
    sources: number;
    chunks: number;
}>;
declare function ingestProjectArtifact(options: {
    rootDir: string;
    projectId: string;
    projectRoot: string;
    artifactPath: string;
    kind: string;
    metadata?: Record<string, unknown>;
    content?: string;
    chunkLimit?: number;
}): Promise<{
    sourceId: string;
    chunks: number;
    changed: boolean;
}>;
declare function retrieveKnowledge(options: KnowledgeRetrieveOptions): Promise<KnowledgeRecallRow[]>;
declare function formatKnowledgeForPrompt(rows: KnowledgeRecallRow[], limit?: number): string;
declare function evaluateKnowledgeRetrieval(rows: Array<Record<string, unknown>>, expectedChunkIds: string[], k?: number): KnowledgeRetrievalEvaluation;
declare function evaluateKnowledgeBenchmark(rootDir: string, cases: KnowledgeBenchmarkCase[]): Promise<KnowledgeBenchmarkResult>;
declare function backfillPendingKnowledgeEmbeddings(rootDir: string, options?: {
    projectId?: string | null;
    limit?: number;
}): Promise<number>;

export { type IngestKnowledgeSourceOptions, type KnowledgeBenchmarkCase, type KnowledgeBenchmarkCaseResult, type KnowledgeBenchmarkResult, type KnowledgeChunkDraft, type KnowledgeRetrievalEvaluation, type KnowledgeRetrieveOptions, backfillPendingKnowledgeEmbeddings, chunkKnowledgeContent, evaluateKnowledgeBenchmark, evaluateKnowledgeRetrieval, formatKnowledgeForPrompt, ingestGlobalWritingResources, ingestKnowledgeSource, ingestProjectArtifact, retrieveKnowledge };
