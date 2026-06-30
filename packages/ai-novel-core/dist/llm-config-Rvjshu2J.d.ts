interface ProjectEnvValues {
    LLM_BASE_URL?: string;
    LLM_API_KEY?: string;
    LLM_MODEL_ID?: string;
    LLM_API_MODE?: string;
    OPENAI_BASE_URL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL_NAME?: string;
    OPENAI_API_MODE?: string;
    LLM_TIMEOUT_MS?: string;
    LLM_TEMPERATURE?: string;
    MAX_STEPS?: string;
    NOVEL_CHAPTER_WORD_TARGET?: string;
    [key: string]: string | undefined;
}
interface ProjectEnvStatus {
    envPath: string;
    exists: boolean;
    sourcePaths: string[];
    configured: boolean;
    missing: string[];
    values: ProjectEnvValues;
    resolved: {
        baseUrl: string | null;
        apiKeyPresent: boolean;
        modelName: string | null;
    };
}
type PublicProjectEnvStatus = ProjectEnvStatus & {
    values: ProjectEnvValues;
};
declare function getProjectEnvPath(rootDir?: string): string;
declare function getProjectEnvCandidatePaths(rootDir?: string): string[];
declare function readProjectEnv(rootDir?: string): {
    envPath: string;
    exists: boolean;
    sourcePaths: string[];
    values: ProjectEnvValues;
};
declare function resolveProjectEnvWritePath(rootDir?: string): string;
declare function getProjectEnvStatus(rootDir?: string): ProjectEnvStatus;
declare function getPublicProjectEnvStatus(rootDir?: string): PublicProjectEnvStatus;
declare function upsertProjectEnvValues(rootDir: string, updates: Record<string, string>): void;

interface LlmProviderConfig {
    provider: {
        baseUrl: string;
        apiKeyEnv: string;
        modelName: string;
        apiMode: LlmApiMode;
        timeoutMs: number;
        temperature: number;
        reactMaxSteps: number;
    };
    writing: {
        chapterWordTarget: number;
        chapterWordMinimum: number;
    };
}
type LlmApiMode = "chat" | "responses";
declare function loadLlmConfigFromEnv(rootDir?: string): LlmProviderConfig;
interface ActiveLlmConfig extends LlmProviderConfig {
    _dbApiKey?: string;
    _configId?: string;
    _capability?: string;
}
declare function getCachedActiveLlmConfig(): ActiveLlmConfig | null;
declare function setCachedActiveLlmConfig(config: ActiveLlmConfig | null): void;
type LlmCapability = "text" | "image" | "video" | "audio" | "embedding" | string;
declare function ensureEnvLlmConfigImported(rootDir?: string): Promise<void>;
declare function resolveFactoryRootDir(dir?: string): string;
declare function loadActiveLlmConfig(rootDir?: string): Promise<ActiveLlmConfig | null>;
declare function loadLlmConfigForCapability(rootDir?: string, capability?: LlmCapability): Promise<ActiveLlmConfig | null>;

export { type ActiveLlmConfig as A, type LlmApiMode as L, type PublicProjectEnvStatus as P, type LlmCapability as a, type LlmProviderConfig as b, type ProjectEnvStatus as c, type ProjectEnvValues as d, ensureEnvLlmConfigImported as e, getProjectEnvCandidatePaths as f, getCachedActiveLlmConfig as g, getProjectEnvPath as h, getProjectEnvStatus as i, getPublicProjectEnvStatus as j, loadLlmConfigForCapability as k, loadActiveLlmConfig as l, loadLlmConfigFromEnv as m, resolveFactoryRootDir as n, resolveProjectEnvWritePath as o, readProjectEnv as r, setCachedActiveLlmConfig as s, upsertProjectEnvValues as u };
