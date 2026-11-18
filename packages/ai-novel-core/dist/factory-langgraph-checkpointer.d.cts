import { BaseCheckpointSaver, SerializerProtocol, CheckpointTuple, CheckpointListOptions, Checkpoint, CheckpointMetadata, ChannelVersions, PendingWrite } from '@langchain/langgraph-checkpoint';
import { RunnableConfig } from '@langchain/core/runnables';

/** LangGraph BaseCheckpointSaver backed by the factory's existing SQLite DB. */
declare class FactoryLangGraphCheckpointer extends BaseCheckpointSaver {
    private readonly rootDir;
    private readonly projectId;
    private readonly runId;
    constructor(rootDir: string, projectId: string, runId?: string | null, serde?: SerializerProtocol);
    private serialize;
    private deserialize;
    private query;
    private tupleFromRow;
    getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined>;
    list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple>;
    put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, newVersions: ChannelVersions): Promise<RunnableConfig>;
    putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string): Promise<void>;
    deleteThread(threadId: string): Promise<void>;
}

export { FactoryLangGraphCheckpointer };
