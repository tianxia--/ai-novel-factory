interface ProjectEnvValues {
    LLM_BASE_URL?: string;
    LLM_API_KEY?: string;
    LLM_MODEL_ID?: string;
    OPENAI_BASE_URL?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL_NAME?: string;
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

export { type PublicProjectEnvStatus as P, type ProjectEnvStatus as a, type ProjectEnvValues as b, getProjectEnvPath as c, getProjectEnvStatus as d, getPublicProjectEnvStatus as e, resolveProjectEnvWritePath as f, getProjectEnvCandidatePaths as g, readProjectEnv as r, upsertProjectEnvValues as u };
