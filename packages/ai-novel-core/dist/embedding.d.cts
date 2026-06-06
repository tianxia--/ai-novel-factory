declare function createLocalTextEmbedding(text: string, dimensions?: number): number[];
declare function backfillPendingMemoryEmbeddings(rootDir: string, options?: {
    projectId?: string | null;
    limit?: number;
}): Promise<number>;

export { backfillPendingMemoryEmbeddings, createLocalTextEmbedding };
