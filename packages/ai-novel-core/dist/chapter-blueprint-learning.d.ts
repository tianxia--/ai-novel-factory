type ChapterBlueprintLearningScope = "project" | "system" | "model";
type ChapterBlueprintLearningStatus = "candidate" | "promoted" | "deprecated";
interface ChapterBlueprintStateSnapshot {
    runId: string;
    volumeId: string;
    startChapter: number;
    endChapter: number;
    batchExitState: string;
    unresolvedRisks: string[];
    endingHook: string;
    nextChapterEntryState: string;
    nextChapterHandoff: string;
}
interface ChapterBlueprintLearningExperience {
    id: string;
    fingerprint: string;
    errorCode: string;
    scope: ChapterBlueprintLearningScope;
    title: string;
    instruction: string;
    status: ChapterBlueprintLearningStatus;
    confidence: number;
    seenCount: number;
    successfulRepairs: number;
    failedRepairs: number;
    projectIds: string[];
    modelKeys: string[];
    sourceRunIds: string[];
    createdAt: string;
    updatedAt: string;
}
interface ChapterBlueprintLearningAttempt {
    runId: string;
    round: number;
    createdAt: string;
    beforeFingerprints: string[];
    afterFingerprints: string[];
    resolvedFingerprints: string[];
    introducedFingerprints: string[];
    remainingFingerprints: string[];
    passed: boolean;
}
interface ChapterBlueprintLearningConflict {
    id: string;
    kind: "canon_conflict" | "repair_oscillation" | "no_progress";
    status: "open" | "resolved";
    fingerprints: string[];
    message: string;
    sourceRunIds: string[];
    createdAt: string;
    updatedAt: string;
}
interface ChapterBlueprintLearningContext {
    schemaVersion: 1;
    promptVersion: string;
    projectId: string;
    projectLabel: string;
    modelKey: string;
    loadedAt: string;
    activeExperiences: ChapterBlueprintLearningExperience[];
    candidateExperiences: ChapterBlueprintLearningExperience[];
    attempts: ChapterBlueprintLearningAttempt[];
    conflicts: ChapterBlueprintLearningConflict[];
    stateLedger: ChapterBlueprintStateSnapshot[];
    memoryPaths: {
        project: string;
        system: string;
        model: string;
    };
}
interface ErrorKnowledge {
    fingerprint: string;
    errorCode: string;
    title: string;
    instruction: string;
}
declare function deriveChapterBlueprintProjectIdentity(storyBible: Record<string, unknown>): {
    projectId: string;
    projectLabel: string;
};
declare function classifyChapterBlueprintError(error: string): ErrorKnowledge;
declare function loadChapterBlueprintLearningContext(input: {
    rootDir: string;
    storyBible: Record<string, unknown>;
    modelName: string;
    runId: string;
    stateLedger?: ChapterBlueprintStateSnapshot[];
}): Promise<{
    schemaVersion: 1;
    promptVersion: string;
    projectId: string;
    projectLabel: string;
    modelKey: string;
    loadedAt: string;
    activeExperiences: ChapterBlueprintLearningExperience[];
    candidateExperiences: ChapterBlueprintLearningExperience[];
    attempts: ChapterBlueprintLearningAttempt[];
    conflicts: ChapterBlueprintLearningConflict[];
    stateLedger: ChapterBlueprintStateSnapshot[];
    memoryPaths: {
        project: string;
        system: string;
        model: string;
    };
}>;
declare function recordChapterBlueprintLearningAttempt(input: {
    rootDir: string;
    context: ChapterBlueprintLearningContext;
    runId: string;
    round: number;
    beforeErrors: string[];
    afterErrors: string[];
    passed: boolean;
}): Promise<{
    promptVersion: string;
    activeExperiences: ChapterBlueprintLearningExperience[];
    candidateExperiences: ChapterBlueprintLearningExperience[];
    attempts: ChapterBlueprintLearningAttempt[];
    conflicts: ChapterBlueprintLearningConflict[];
    schemaVersion: 1;
    projectId: string;
    projectLabel: string;
    modelKey: string;
    loadedAt: string;
    stateLedger: ChapterBlueprintStateSnapshot[];
    memoryPaths: {
        project: string;
        system: string;
        model: string;
    };
}>;
declare function recordChapterBlueprintStateSnapshot(input: {
    context: ChapterBlueprintLearningContext;
    snapshot: ChapterBlueprintStateSnapshot;
}): Promise<{
    stateLedger: ChapterBlueprintStateSnapshot[];
    schemaVersion: 1;
    promptVersion: string;
    projectId: string;
    projectLabel: string;
    modelKey: string;
    loadedAt: string;
    activeExperiences: ChapterBlueprintLearningExperience[];
    candidateExperiences: ChapterBlueprintLearningExperience[];
    attempts: ChapterBlueprintLearningAttempt[];
    conflicts: ChapterBlueprintLearningConflict[];
    memoryPaths: {
        project: string;
        system: string;
        model: string;
    };
}>;
declare function compileChapterBlueprintLearningPrompt(context: ChapterBlueprintLearningContext): string;
declare function chapterBlueprintLearningShouldStop(context: ChapterBlueprintLearningContext, runId: string): {
    stop: boolean;
    reason: string;
    conflict: ChapterBlueprintLearningConflict;
} | {
    stop: boolean;
    reason: string;
    conflict?: undefined;
};
declare const chapterBlueprintBuiltinLearningRules: {
    fingerprint: string;
    errorCode: string;
    title: string;
    instruction: string;
}[];

export { type ChapterBlueprintLearningAttempt, type ChapterBlueprintLearningConflict, type ChapterBlueprintLearningContext, type ChapterBlueprintLearningExperience, type ChapterBlueprintLearningScope, type ChapterBlueprintLearningStatus, type ChapterBlueprintStateSnapshot, chapterBlueprintBuiltinLearningRules, chapterBlueprintLearningShouldStop, classifyChapterBlueprintError, compileChapterBlueprintLearningPrompt, deriveChapterBlueprintProjectIdentity, loadChapterBlueprintLearningContext, recordChapterBlueprintLearningAttempt, recordChapterBlueprintStateSnapshot };
