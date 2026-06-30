import { A as AutonomousNovelState } from './cli-types-dnbh9JaE.cjs';

type NovelDirectorCommand = {
    id: string;
    type: "advance";
    stage: string;
    reason: string;
    advanceFirst: true;
    parentCommandId?: string | null;
} | {
    id: string;
    type: "discuss";
    stage: string;
    message: string;
    reason: string;
} | {
    id: string;
    type: "retry_chapter";
    stage: string;
    chapterNumber: number;
    reason: string;
} | {
    id: string;
    type: "interrupt";
    stage: string;
    message: string;
    reason: string;
};
interface NovelDirectorInput {
    userMessage?: string;
    correctionMessage?: string;
}
declare function isGenericAutopilotMessage(message: string): boolean;
declare function shouldAdvanceBeforeDiscussion(state: AutonomousNovelState, initialMessage: string, correctionMessage: string): boolean;
declare function buildDirectorDiscussionMessage(state: AutonomousNovelState, initialMessage: string): string;
declare function decideNovelDirectorCommand(state: AutonomousNovelState, input?: NovelDirectorInput): NovelDirectorCommand;
declare function createFollowUpAdvanceCommand(state: AutonomousNovelState, parentCommand: NovelDirectorCommand, reason?: string): NovelDirectorCommand;
declare function createManualAdvanceCommand(state: AutonomousNovelState, reason?: string): NovelDirectorCommand;
declare function createManualRetryChapterCommand(state: AutonomousNovelState, chapterNumber: number, reason?: string): NovelDirectorCommand;
declare function createManualInterruptCommand(state: AutonomousNovelState, message: string, reason?: string): NovelDirectorCommand;

export { type NovelDirectorCommand, type NovelDirectorInput, buildDirectorDiscussionMessage, createFollowUpAdvanceCommand, createManualAdvanceCommand, createManualInterruptCommand, createManualRetryChapterCommand, decideNovelDirectorCommand, isGenericAutopilotMessage, shouldAdvanceBeforeDiscussion };
