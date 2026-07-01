import { F as FactoryOperationalStatus, K as KnowledgeScope, D as DiscussionTarget } from './factory-db-tGpa3fau.js';
import { P as ProductionReadinessSnapshot, a as ProductionGateIssue, b as ProductionReadinessItem, c as ProductionReadinessGroup } from './production-contracts-C1il9ao8.js';
import { S as StyleEvolutionSnapshot, a as StyleLoopRuntimeIterationRecord, b as StyleEvolutionEvaluation, c as StyleEvolutionRefinement, d as StyleGenerationVerification, P as ProjectRuntimeState } from './production-style-evolution-B0dFU9D-.js';
import { P as PublicProjectEnvStatus, L as LlmApiMode } from './llm-config-Rvjshu2J.js';
import { N as NovelProjectRecord, A as AutonomousNovelState, C as CreativeProfile, a as NovelStage, I as InterruptionReview, P as ProviderTestResult, b as AutopilotRuntime, c as ChapterTask, d as CharacterDossier, e as AssetStatus, T as TaskStatus } from './cli-types-dnbh9JaE.js';
import { AigcDetectionResult, AigcBatchDetectionResult } from './aigc-detector.js';
import http from 'node:http';
import { KnowledgeBenchmarkResult } from './knowledge.js';
import './messages.js';

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
        projects: {
            id: any;
            slug: any;
            title: any;
            totalChapters: any;
            chapterWordTarget: any;
            summary: {
                stage: any;
                progressPercent: any;
                completedChapters: any;
                totalChapters: any;
                updatedAt: any;
            } | null;
        }[];
        envStatus: PublicProjectEnvStatus;
        activeProjectId?: undefined;
        project?: undefined;
        chapters?: undefined;
        currentChapterNumber?: undefined;
        lore?: undefined;
        characters?: undefined;
        memories?: undefined;
        graph?: undefined;
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        stats?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projects: {
            id: any;
            slug: any;
            title: any;
            totalChapters: any;
            chapterWordTarget: any;
            summary: {
                stage: any;
                progressPercent: any;
                completedChapters: any;
                totalChapters: any;
                updatedAt: any;
            } | null;
        }[];
        project: {
            id: string;
            title: any;
            idea: any;
            genre: any;
            totalChapters: number;
            chapterWordTarget: number;
            stage: string;
        };
        chapters: {
            chapterNumber: any;
            title: any;
            status: any;
            source: any;
            versionId: any;
            path: any;
            targetWords: any;
            wordCount: any;
            summary: any;
            qualityGate: any;
            aigcDetection: any;
            styleInheritanceVerification: any;
            publishReadiness: any;
            versionManifest: any;
            hasBody: boolean;
        }[];
        currentChapterNumber: number;
        lore: {
            activeWorldSlice: string;
            activeWorldSlicePath: string;
            settingFreeze: string;
            masterOutline: string;
            planBrief: string;
            globalConsensus: string;
            currentContext: string;
            storyFoundation: {
                contract: any;
                worldMatrix: any;
                plotArchitecture: any;
                storyBible: any;
                volumeStrategy: any;
                foreshadowingLedger: any;
                characterDynamics: any;
                writingPlan: any;
            };
        };
        characters: {
            dossiers: any;
            dossiersMarkdown: string;
            relationshipGraph: any;
            relations: string;
            evolution: string;
        };
        memories: {
            chapterNumber: number;
            title: string;
            content: string;
        }[];
        graph: {
            nodes: any;
            edges: any;
        };
        styleEvolution: StyleEvolutionSnapshot | null;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        } | null;
        stats: {
            totalChapters: number;
            readableChapters: number;
            completedChapters: number;
            totalWords: number;
        };
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        envStatus: PublicProjectEnvStatus;
        projects?: undefined;
        activeProjectId?: undefined;
        chapterNumber?: undefined;
        chapter?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        projects: {
            id: any;
            slug: any;
            title: any;
            totalChapters: any;
            chapterWordTarget: any;
            summary: {
                stage: any;
                progressPercent: any;
                completedChapters: any;
                totalChapters: any;
                updatedAt: any;
            } | null;
        }[];
        envStatus: PublicProjectEnvStatus;
        activeProjectId?: undefined;
        chapterNumber?: undefined;
        chapter?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        activeProjectId: string;
        chapterNumber: number;
        envStatus: PublicProjectEnvStatus;
        projects?: undefined;
        chapter?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        chapter: {
            chapterNumber: number;
            title: string;
            status: string;
            source: string;
            versionId: string;
            path: string;
            targetWords: number;
            wordCount: number;
            summary: string;
            qualityGate: any;
            aigcDetection: any;
            styleInheritanceVerification: {
                status: string;
                summary: string;
                chapterNumber: number;
                contractVersion: number;
                contractApproved: boolean;
                approvedAt: string;
                inheritanceStatus: string;
                chapterInheritanceAdapter: Record<string, any> | null;
                adapterReady: boolean;
                freezerVerdict: string;
                inheritedRuleCount: number;
                inheritedArtifactCount: number;
                freezeAssetsReady: boolean;
                inheritanceAssetsReady: boolean;
                styleFingerprintReady: boolean;
                styleFingerprint: string;
                styleConformanceDrift: Record<string, any>;
                styleDrift: {
                    status: string;
                    conformanceScore: number | null;
                    driftScore: number | null;
                    threshold: number;
                    rawConformanceScore: any;
                    rawDriftScore: any;
                    forbiddenHitCount: number;
                    matchedTerms: any[];
                    missingTerms: any[];
                    summary: string;
                };
                qualityGateStatus: string;
                qualityGateReason: string;
                publishBaseReady: boolean;
                publishBaseMissing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                aigc: {
                    status: string;
                    score: number | null;
                    threshold: number | null;
                    highRiskCount: number;
                    reason: string;
                } | null;
                verificationStatus: string;
                verificationSummary: string;
                evidence: any[];
                risks: any[];
            } | {
                status: "pending" | "blocked" | "warning" | "ready";
                summary: string;
                chapterNumber: number;
                contractVersion: number | undefined;
                contractApproved: boolean;
                approvedAt: string;
                inheritanceStatus: string;
                chapterInheritanceAdapter: Record<string, any> | null;
                adapterReady: boolean;
                freezerVerdict: string;
                inheritedRuleCount: number;
                inheritedArtifactCount: number;
                freezeAssetsReady: boolean;
                inheritanceAssetsReady: boolean;
                styleFingerprintReady: boolean;
                styleFingerprint: string;
                qualityGateStatus: string;
                qualityGateReason: string;
                publishBaseReady: boolean;
                publishBaseMissing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                aigc: {
                    status: string;
                    score: number | null;
                    threshold: number | null;
                    highRiskCount: number;
                    reason: string;
                } | null;
                verificationStatus: string;
                verificationSummary: string;
                evidence: any[];
                risks: any[];
                styleConformanceDrift?: undefined;
                styleDrift?: undefined;
            };
            publishReadiness: {
                ready: boolean;
                status: string;
                locked: boolean;
                selectedVersionId: string;
                checkedAt: string;
                missing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                checks: {
                    id: string;
                    label: string;
                    passed: boolean;
                    detail: string;
                }[];
                styleInheritanceVerification: {
                    status: string;
                    summary: string;
                    chapterNumber: number;
                    contractVersion: number;
                    contractApproved: boolean;
                    approvedAt: string;
                    inheritanceStatus: string;
                    chapterInheritanceAdapter: Record<string, any> | null;
                    adapterReady: boolean;
                    freezerVerdict: string;
                    inheritedRuleCount: number;
                    inheritedArtifactCount: number;
                    freezeAssetsReady: boolean;
                    inheritanceAssetsReady: boolean;
                    styleFingerprintReady: boolean;
                    styleFingerprint: string;
                    styleConformanceDrift: Record<string, any>;
                    styleDrift: {
                        status: string;
                        conformanceScore: number | null;
                        driftScore: number | null;
                        threshold: number;
                        rawConformanceScore: any;
                        rawDriftScore: any;
                        forbiddenHitCount: number;
                        matchedTerms: any[];
                        missingTerms: any[];
                        summary: string;
                    };
                    qualityGateStatus: string;
                    qualityGateReason: string;
                    publishBaseReady: boolean;
                    publishBaseMissing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    aigc: {
                        status: string;
                        score: number | null;
                        threshold: number | null;
                        highRiskCount: number;
                        reason: string;
                    } | null;
                    verificationStatus: string;
                    verificationSummary: string;
                    evidence: any[];
                    risks: any[];
                } | {
                    status: "pending" | "blocked" | "warning" | "ready";
                    summary: string;
                    chapterNumber: number;
                    contractVersion: number | undefined;
                    contractApproved: boolean;
                    approvedAt: string;
                    inheritanceStatus: string;
                    chapterInheritanceAdapter: Record<string, any> | null;
                    adapterReady: boolean;
                    freezerVerdict: string;
                    inheritedRuleCount: number;
                    inheritedArtifactCount: number;
                    freezeAssetsReady: boolean;
                    inheritanceAssetsReady: boolean;
                    styleFingerprintReady: boolean;
                    styleFingerprint: string;
                    qualityGateStatus: string;
                    qualityGateReason: string;
                    publishBaseReady: boolean;
                    publishBaseMissing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    aigc: {
                        status: string;
                        score: number | null;
                        threshold: number | null;
                        highRiskCount: number;
                        reason: string;
                    } | null;
                    verificationStatus: string;
                    verificationSummary: string;
                    evidence: any[];
                    risks: any[];
                    styleConformanceDrift?: undefined;
                    styleDrift?: undefined;
                };
            };
            versionManifest: {
                publishReadiness: {
                    ready: boolean;
                    status: string;
                    locked: boolean;
                    selectedVersionId: string;
                    checkedAt: string;
                    missing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    checks: {
                        id: string;
                        label: string;
                        passed: boolean;
                        detail: string;
                    }[];
                    styleInheritanceVerification: {
                        status: string;
                        summary: string;
                        chapterNumber: number;
                        contractVersion: number;
                        contractApproved: boolean;
                        approvedAt: string;
                        inheritanceStatus: string;
                        chapterInheritanceAdapter: Record<string, any> | null;
                        adapterReady: boolean;
                        freezerVerdict: string;
                        inheritedRuleCount: number;
                        inheritedArtifactCount: number;
                        freezeAssetsReady: boolean;
                        inheritanceAssetsReady: boolean;
                        styleFingerprintReady: boolean;
                        styleFingerprint: string;
                        styleConformanceDrift: Record<string, any>;
                        styleDrift: {
                            status: string;
                            conformanceScore: number | null;
                            driftScore: number | null;
                            threshold: number;
                            rawConformanceScore: any;
                            rawDriftScore: any;
                            forbiddenHitCount: number;
                            matchedTerms: any[];
                            missingTerms: any[];
                            summary: string;
                        };
                        qualityGateStatus: string;
                        qualityGateReason: string;
                        publishBaseReady: boolean;
                        publishBaseMissing: {
                            id: string;
                            label: string;
                            detail: string;
                        }[];
                        aigc: {
                            status: string;
                            score: number | null;
                            threshold: number | null;
                            highRiskCount: number;
                            reason: string;
                        } | null;
                        verificationStatus: string;
                        verificationSummary: string;
                        evidence: any[];
                        risks: any[];
                    } | {
                        status: "pending" | "blocked" | "warning" | "ready";
                        summary: string;
                        chapterNumber: number;
                        contractVersion: number | undefined;
                        contractApproved: boolean;
                        approvedAt: string;
                        inheritanceStatus: string;
                        chapterInheritanceAdapter: Record<string, any> | null;
                        adapterReady: boolean;
                        freezerVerdict: string;
                        inheritedRuleCount: number;
                        inheritedArtifactCount: number;
                        freezeAssetsReady: boolean;
                        inheritanceAssetsReady: boolean;
                        styleFingerprintReady: boolean;
                        styleFingerprint: string;
                        qualityGateStatus: string;
                        qualityGateReason: string;
                        publishBaseReady: boolean;
                        publishBaseMissing: {
                            id: string;
                            label: string;
                            detail: string;
                        }[];
                        aigc: {
                            status: string;
                            score: number | null;
                            threshold: number | null;
                            highRiskCount: number;
                            reason: string;
                        } | null;
                        verificationStatus: string;
                        verificationSummary: string;
                        evidence: any[];
                        risks: any[];
                        styleConformanceDrift?: undefined;
                        styleDrift?: undefined;
                    };
                };
                version: number;
                chapterNumber: number;
                chapterTitle: string;
                publishedVersionId: string;
                locked: boolean;
                status: string;
                writingMode: string;
                targetWords: number;
                wordCount: number;
                updatedAt: string;
                qualityGate: any;
                aigcDetection: any;
                chapterInheritanceAdapter: any;
                styleConformanceDrift: any;
                styleInheritanceVerification: any;
                artifacts: any;
                versions: {
                    id: string;
                    label: string;
                    source: string;
                    path: string;
                    wordCount: number;
                    status: string;
                    createdAt: string;
                }[];
            } | null;
            body: string;
        };
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        projects?: undefined;
        chapterNumber?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        envStatus: PublicProjectEnvStatus;
        projects?: undefined;
        activeProjectId?: undefined;
        chapterNumber?: undefined;
        publishedVersionId?: undefined;
        left?: undefined;
        right?: undefined;
        comparison?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        projects: {
            id: any;
            slug: any;
            title: any;
            totalChapters: any;
            chapterWordTarget: any;
            summary: {
                stage: any;
                progressPercent: any;
                completedChapters: any;
                totalChapters: any;
                updatedAt: any;
            } | null;
        }[];
        envStatus: PublicProjectEnvStatus;
        activeProjectId?: undefined;
        chapterNumber?: undefined;
        publishedVersionId?: undefined;
        left?: undefined;
        right?: undefined;
        comparison?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        activeProjectId: string;
        envStatus: PublicProjectEnvStatus;
        projects?: undefined;
        chapterNumber?: undefined;
        publishedVersionId?: undefined;
        left?: undefined;
        right?: undefined;
        comparison?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        chapterNumber: number;
        publishedVersionId: string;
        left: {
            title: string;
            wordCount: number;
            preview: string;
            id: string;
            label: string;
            source: string;
            path: string;
            status: string;
            createdAt: string;
        };
        right: {
            title: string;
            wordCount: number;
            preview: string;
            id: string;
            label: string;
            source: string;
            path: string;
            status: string;
            createdAt: string;
        };
        comparison: {
            unchangedParagraphs: number;
            removedParagraphs: number;
            addedParagraphs: number;
            leftParagraphs: number;
            rightParagraphs: number;
            removedPreview: string[];
            addedPreview: string[];
        };
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        projects?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string | null;
        query: string;
        results: never[];
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        projects?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        projects: {
            id: any;
            slug: any;
            title: any;
            totalChapters: any;
            chapterWordTarget: any;
            summary: {
                stage: any;
                progressPercent: any;
                completedChapters: any;
                totalChapters: any;
                updatedAt: any;
            } | null;
        }[];
        envStatus: PublicProjectEnvStatus;
        activeProjectId?: undefined;
        query?: undefined;
        results?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        query: string;
        results: {
            chapterNumber: number;
            title: string;
            source: string;
            path: string;
            wordCount: number;
            matchCount: number;
            snippet: string;
        }[];
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        projects?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        envStatus: PublicProjectEnvStatus;
        projects?: undefined;
        activeProjectId?: undefined;
        path?: undefined;
        publishReadiness?: undefined;
        success?: undefined;
        chapter?: undefined;
        snapshot?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        projects: {
            id: any;
            slug: any;
            title: any;
            totalChapters: any;
            chapterWordTarget: any;
            summary: {
                stage: any;
                progressPercent: any;
                completedChapters: any;
                totalChapters: any;
                updatedAt: any;
            } | null;
        }[];
        envStatus: PublicProjectEnvStatus;
        activeProjectId?: undefined;
        path?: undefined;
        publishReadiness?: undefined;
        success?: undefined;
        chapter?: undefined;
        snapshot?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        activeProjectId: string;
        envStatus: PublicProjectEnvStatus;
        projects?: undefined;
        path?: undefined;
        publishReadiness?: undefined;
        success?: undefined;
        chapter?: undefined;
        snapshot?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        activeProjectId: string;
        path: string;
        envStatus: PublicProjectEnvStatus;
        projects?: undefined;
        publishReadiness?: undefined;
        success?: undefined;
        chapter?: undefined;
        snapshot?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        activeProjectId: string;
        publishReadiness: {
            ready: boolean;
            status: string;
            locked: boolean;
            selectedVersionId: string;
            checkedAt: string;
            missing: {
                id: string;
                label: string;
                detail: string;
            }[];
            checks: {
                id: string;
                label: string;
                passed: boolean;
                detail: string;
            }[];
            styleInheritanceVerification: {
                status: string;
                summary: string;
                chapterNumber: number;
                contractVersion: number;
                contractApproved: boolean;
                approvedAt: string;
                inheritanceStatus: string;
                chapterInheritanceAdapter: Record<string, any> | null;
                adapterReady: boolean;
                freezerVerdict: string;
                inheritedRuleCount: number;
                inheritedArtifactCount: number;
                freezeAssetsReady: boolean;
                inheritanceAssetsReady: boolean;
                styleFingerprintReady: boolean;
                styleFingerprint: string;
                styleConformanceDrift: Record<string, any>;
                styleDrift: {
                    status: string;
                    conformanceScore: number | null;
                    driftScore: number | null;
                    threshold: number;
                    rawConformanceScore: any;
                    rawDriftScore: any;
                    forbiddenHitCount: number;
                    matchedTerms: any[];
                    missingTerms: any[];
                    summary: string;
                };
                qualityGateStatus: string;
                qualityGateReason: string;
                publishBaseReady: boolean;
                publishBaseMissing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                aigc: {
                    status: string;
                    score: number | null;
                    threshold: number | null;
                    highRiskCount: number;
                    reason: string;
                } | null;
                verificationStatus: string;
                verificationSummary: string;
                evidence: any[];
                risks: any[];
            } | {
                status: "pending" | "blocked" | "warning" | "ready";
                summary: string;
                chapterNumber: number;
                contractVersion: number | undefined;
                contractApproved: boolean;
                approvedAt: string;
                inheritanceStatus: string;
                chapterInheritanceAdapter: Record<string, any> | null;
                adapterReady: boolean;
                freezerVerdict: string;
                inheritedRuleCount: number;
                inheritedArtifactCount: number;
                freezeAssetsReady: boolean;
                inheritanceAssetsReady: boolean;
                styleFingerprintReady: boolean;
                styleFingerprint: string;
                qualityGateStatus: string;
                qualityGateReason: string;
                publishBaseReady: boolean;
                publishBaseMissing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                aigc: {
                    status: string;
                    score: number | null;
                    threshold: number | null;
                    highRiskCount: number;
                    reason: string;
                } | null;
                verificationStatus: string;
                verificationSummary: string;
                evidence: any[];
                risks: any[];
                styleConformanceDrift?: undefined;
                styleDrift?: undefined;
            };
        };
        envStatus: PublicProjectEnvStatus;
        projects?: undefined;
        path?: undefined;
        success?: undefined;
        chapter?: undefined;
        snapshot?: undefined;
    };
} | {
    status: number;
    payload: {
        success: boolean;
        activeProjectId: string;
        chapter: {
            chapterNumber: number;
            title: string;
            status: string;
            source: string;
            versionId: string;
            path: string;
            targetWords: number;
            wordCount: number;
            summary: string;
            qualityGate: any;
            aigcDetection: any;
            styleInheritanceVerification: {
                status: string;
                summary: string;
                chapterNumber: number;
                contractVersion: number;
                contractApproved: boolean;
                approvedAt: string;
                inheritanceStatus: string;
                chapterInheritanceAdapter: Record<string, any> | null;
                adapterReady: boolean;
                freezerVerdict: string;
                inheritedRuleCount: number;
                inheritedArtifactCount: number;
                freezeAssetsReady: boolean;
                inheritanceAssetsReady: boolean;
                styleFingerprintReady: boolean;
                styleFingerprint: string;
                styleConformanceDrift: Record<string, any>;
                styleDrift: {
                    status: string;
                    conformanceScore: number | null;
                    driftScore: number | null;
                    threshold: number;
                    rawConformanceScore: any;
                    rawDriftScore: any;
                    forbiddenHitCount: number;
                    matchedTerms: any[];
                    missingTerms: any[];
                    summary: string;
                };
                qualityGateStatus: string;
                qualityGateReason: string;
                publishBaseReady: boolean;
                publishBaseMissing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                aigc: {
                    status: string;
                    score: number | null;
                    threshold: number | null;
                    highRiskCount: number;
                    reason: string;
                } | null;
                verificationStatus: string;
                verificationSummary: string;
                evidence: any[];
                risks: any[];
            } | {
                status: "pending" | "blocked" | "warning" | "ready";
                summary: string;
                chapterNumber: number;
                contractVersion: number | undefined;
                contractApproved: boolean;
                approvedAt: string;
                inheritanceStatus: string;
                chapterInheritanceAdapter: Record<string, any> | null;
                adapterReady: boolean;
                freezerVerdict: string;
                inheritedRuleCount: number;
                inheritedArtifactCount: number;
                freezeAssetsReady: boolean;
                inheritanceAssetsReady: boolean;
                styleFingerprintReady: boolean;
                styleFingerprint: string;
                qualityGateStatus: string;
                qualityGateReason: string;
                publishBaseReady: boolean;
                publishBaseMissing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                aigc: {
                    status: string;
                    score: number | null;
                    threshold: number | null;
                    highRiskCount: number;
                    reason: string;
                } | null;
                verificationStatus: string;
                verificationSummary: string;
                evidence: any[];
                risks: any[];
                styleConformanceDrift?: undefined;
                styleDrift?: undefined;
            };
            publishReadiness: {
                ready: boolean;
                status: string;
                locked: boolean;
                selectedVersionId: string;
                checkedAt: string;
                missing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                checks: {
                    id: string;
                    label: string;
                    passed: boolean;
                    detail: string;
                }[];
                styleInheritanceVerification: {
                    status: string;
                    summary: string;
                    chapterNumber: number;
                    contractVersion: number;
                    contractApproved: boolean;
                    approvedAt: string;
                    inheritanceStatus: string;
                    chapterInheritanceAdapter: Record<string, any> | null;
                    adapterReady: boolean;
                    freezerVerdict: string;
                    inheritedRuleCount: number;
                    inheritedArtifactCount: number;
                    freezeAssetsReady: boolean;
                    inheritanceAssetsReady: boolean;
                    styleFingerprintReady: boolean;
                    styleFingerprint: string;
                    styleConformanceDrift: Record<string, any>;
                    styleDrift: {
                        status: string;
                        conformanceScore: number | null;
                        driftScore: number | null;
                        threshold: number;
                        rawConformanceScore: any;
                        rawDriftScore: any;
                        forbiddenHitCount: number;
                        matchedTerms: any[];
                        missingTerms: any[];
                        summary: string;
                    };
                    qualityGateStatus: string;
                    qualityGateReason: string;
                    publishBaseReady: boolean;
                    publishBaseMissing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    aigc: {
                        status: string;
                        score: number | null;
                        threshold: number | null;
                        highRiskCount: number;
                        reason: string;
                    } | null;
                    verificationStatus: string;
                    verificationSummary: string;
                    evidence: any[];
                    risks: any[];
                } | {
                    status: "pending" | "blocked" | "warning" | "ready";
                    summary: string;
                    chapterNumber: number;
                    contractVersion: number | undefined;
                    contractApproved: boolean;
                    approvedAt: string;
                    inheritanceStatus: string;
                    chapterInheritanceAdapter: Record<string, any> | null;
                    adapterReady: boolean;
                    freezerVerdict: string;
                    inheritedRuleCount: number;
                    inheritedArtifactCount: number;
                    freezeAssetsReady: boolean;
                    inheritanceAssetsReady: boolean;
                    styleFingerprintReady: boolean;
                    styleFingerprint: string;
                    qualityGateStatus: string;
                    qualityGateReason: string;
                    publishBaseReady: boolean;
                    publishBaseMissing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    aigc: {
                        status: string;
                        score: number | null;
                        threshold: number | null;
                        highRiskCount: number;
                        reason: string;
                    } | null;
                    verificationStatus: string;
                    verificationSummary: string;
                    evidence: any[];
                    risks: any[];
                    styleConformanceDrift?: undefined;
                    styleDrift?: undefined;
                };
            };
            versionManifest: {
                publishReadiness: {
                    ready: boolean;
                    status: string;
                    locked: boolean;
                    selectedVersionId: string;
                    checkedAt: string;
                    missing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    checks: {
                        id: string;
                        label: string;
                        passed: boolean;
                        detail: string;
                    }[];
                    styleInheritanceVerification: {
                        status: string;
                        summary: string;
                        chapterNumber: number;
                        contractVersion: number;
                        contractApproved: boolean;
                        approvedAt: string;
                        inheritanceStatus: string;
                        chapterInheritanceAdapter: Record<string, any> | null;
                        adapterReady: boolean;
                        freezerVerdict: string;
                        inheritedRuleCount: number;
                        inheritedArtifactCount: number;
                        freezeAssetsReady: boolean;
                        inheritanceAssetsReady: boolean;
                        styleFingerprintReady: boolean;
                        styleFingerprint: string;
                        styleConformanceDrift: Record<string, any>;
                        styleDrift: {
                            status: string;
                            conformanceScore: number | null;
                            driftScore: number | null;
                            threshold: number;
                            rawConformanceScore: any;
                            rawDriftScore: any;
                            forbiddenHitCount: number;
                            matchedTerms: any[];
                            missingTerms: any[];
                            summary: string;
                        };
                        qualityGateStatus: string;
                        qualityGateReason: string;
                        publishBaseReady: boolean;
                        publishBaseMissing: {
                            id: string;
                            label: string;
                            detail: string;
                        }[];
                        aigc: {
                            status: string;
                            score: number | null;
                            threshold: number | null;
                            highRiskCount: number;
                            reason: string;
                        } | null;
                        verificationStatus: string;
                        verificationSummary: string;
                        evidence: any[];
                        risks: any[];
                    } | {
                        status: "pending" | "blocked" | "warning" | "ready";
                        summary: string;
                        chapterNumber: number;
                        contractVersion: number | undefined;
                        contractApproved: boolean;
                        approvedAt: string;
                        inheritanceStatus: string;
                        chapterInheritanceAdapter: Record<string, any> | null;
                        adapterReady: boolean;
                        freezerVerdict: string;
                        inheritedRuleCount: number;
                        inheritedArtifactCount: number;
                        freezeAssetsReady: boolean;
                        inheritanceAssetsReady: boolean;
                        styleFingerprintReady: boolean;
                        styleFingerprint: string;
                        qualityGateStatus: string;
                        qualityGateReason: string;
                        publishBaseReady: boolean;
                        publishBaseMissing: {
                            id: string;
                            label: string;
                            detail: string;
                        }[];
                        aigc: {
                            status: string;
                            score: number | null;
                            threshold: number | null;
                            highRiskCount: number;
                            reason: string;
                        } | null;
                        verificationStatus: string;
                        verificationSummary: string;
                        evidence: any[];
                        risks: any[];
                        styleConformanceDrift?: undefined;
                        styleDrift?: undefined;
                    };
                };
                version: number;
                chapterNumber: number;
                chapterTitle: string;
                publishedVersionId: string;
                locked: boolean;
                status: string;
                writingMode: string;
                targetWords: number;
                wordCount: number;
                updatedAt: string;
                qualityGate: any;
                aigcDetection: any;
                chapterInheritanceAdapter: any;
                styleConformanceDrift: any;
                styleInheritanceVerification: any;
                artifacts: any;
                versions: {
                    id: string;
                    label: string;
                    source: string;
                    path: string;
                    wordCount: number;
                    status: string;
                    createdAt: string;
                }[];
            } | null;
            body: string;
        } | null | undefined;
        snapshot: {
            error: string;
            projects: {
                id: any;
                slug: any;
                title: any;
                totalChapters: any;
                chapterWordTarget: any;
                summary: {
                    stage: any;
                    progressPercent: any;
                    completedChapters: any;
                    totalChapters: any;
                    updatedAt: any;
                } | null;
            }[];
            envStatus: PublicProjectEnvStatus;
            activeProjectId?: undefined;
            project?: undefined;
            chapters?: undefined;
            currentChapterNumber?: undefined;
            lore?: undefined;
            characters?: undefined;
            memories?: undefined;
            graph?: undefined;
            styleEvolution?: undefined;
            styleEvolutionAssets?: undefined;
            stats?: undefined;
        } | {
            activeProjectId: string;
            projects: {
                id: any;
                slug: any;
                title: any;
                totalChapters: any;
                chapterWordTarget: any;
                summary: {
                    stage: any;
                    progressPercent: any;
                    completedChapters: any;
                    totalChapters: any;
                    updatedAt: any;
                } | null;
            }[];
            project: {
                id: string;
                title: any;
                idea: any;
                genre: any;
                totalChapters: number;
                chapterWordTarget: number;
                stage: string;
            };
            chapters: {
                chapterNumber: any;
                title: any;
                status: any;
                source: any;
                versionId: any;
                path: any;
                targetWords: any;
                wordCount: any;
                summary: any;
                qualityGate: any;
                aigcDetection: any;
                styleInheritanceVerification: any;
                publishReadiness: any;
                versionManifest: any;
                hasBody: boolean;
            }[];
            currentChapterNumber: number;
            lore: {
                activeWorldSlice: string;
                activeWorldSlicePath: string;
                settingFreeze: string;
                masterOutline: string;
                planBrief: string;
                globalConsensus: string;
                currentContext: string;
                storyFoundation: {
                    contract: any;
                    worldMatrix: any;
                    plotArchitecture: any;
                    storyBible: any;
                    volumeStrategy: any;
                    foreshadowingLedger: any;
                    characterDynamics: any;
                    writingPlan: any;
                };
            };
            characters: {
                dossiers: any;
                dossiersMarkdown: string;
                relationshipGraph: any;
                relations: string;
                evolution: string;
            };
            memories: {
                chapterNumber: number;
                title: string;
                content: string;
            }[];
            graph: {
                nodes: any;
                edges: any;
            };
            styleEvolution: StyleEvolutionSnapshot | null;
            styleEvolutionAssets: {
                freezePackage: {
                    approvedSample: {
                        path: string;
                        exists: boolean;
                        chars: number;
                        preview: string;
                    };
                    freezeLedger: {
                        path: string;
                        exists: boolean;
                        chars: number;
                        preview: string;
                    };
                    loopRuntime: {
                        path: string;
                        exists: boolean;
                        chars: number;
                        preview: string;
                    };
                    loopRuns: {
                        path: string;
                        exists: boolean;
                        chars: number;
                        preview: string;
                    };
                };
                chapterInheritance: {
                    rulebook: {
                        path: string;
                        exists: boolean;
                        chars: number;
                        preview: string;
                    };
                    references: {
                        path: string;
                        exists: boolean;
                        chars: number;
                        preview: string;
                    };
                    antiPatterns: {
                        path: string;
                        exists: boolean;
                        chars: number;
                        preview: string;
                    };
                };
            } | null;
            stats: {
                totalChapters: number;
                readableChapters: number;
                completedChapters: number;
                totalWords: number;
            };
            envStatus: PublicProjectEnvStatus;
            error?: undefined;
        } | null;
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        projects?: undefined;
        path?: undefined;
        publishReadiness?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        result: AigcDetectionResult | AigcBatchDetectionResult;
        error?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        configs: {
            api_key: string;
            api_key_configured: boolean;
        }[];
        routes: {
            capability: unknown;
            config_id: unknown;
            name: unknown;
            base_url: unknown;
            model_name: unknown;
            api_mode: {};
            updated_at: unknown;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        success: boolean;
        configs: {
            api_key: string;
            api_key_configured: boolean;
        }[];
        routes: {
            capability: unknown;
            config_id: unknown;
            name: unknown;
            base_url: unknown;
            model_name: unknown;
            api_mode: {};
            updated_at: unknown;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        projects: NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        projects: NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
        success?: undefined;
        deletedProject?: undefined;
        stoppedInProcess?: undefined;
        ok?: undefined;
        service?: undefined;
        checkedAt?: undefined;
        factory?: undefined;
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        styleEvolution: StyleEvolutionSnapshot;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        };
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        styleEvolution: StyleEvolutionSnapshot;
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        reason: string | undefined;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        styleEvolution: StyleEvolutionSnapshot;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        };
        loopRun: {
            runId: string;
            totalIterations: number;
            candidateCount: number;
            stopReason: string;
            status: "completed" | "running";
            startedAt: string;
            completedAt: string | undefined;
            iterations: StyleLoopRuntimeIterationRecord[];
            finalLoopStatus?: undefined;
            finalConvergence?: undefined;
        };
        modelRouting: {
            capability: string;
            configId: string | undefined;
            modelName: string;
            apiMode: LlmApiMode;
        };
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        styleEvolution: StyleEvolutionSnapshot;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        };
        generatedCandidate: {
            prompt: string;
            sample: string;
            version: number | undefined;
            candidateIndex: number | undefined;
        };
        loopIteration: {
            evaluation: StyleEvolutionEvaluation;
            refinement: StyleEvolutionRefinement;
            verification: StyleGenerationVerification;
            candidates: {
                candidateIndex: number;
                persistedVersion: number | undefined;
                sample: string;
                evaluation: StyleEvolutionEvaluation;
                refinement: StyleEvolutionRefinement;
                verification: StyleGenerationVerification;
                freezer: {
                    source: "llm_critic";
                    verdict: "ready" | "block" | "continue";
                    summary: string;
                    blockingReasons: string[];
                    checkedAt: string;
                } | {
                    source: "heuristic";
                    verdict: "ready" | "continue";
                    summary: string;
                    blockingReasons: string[];
                    checkedAt: string;
                };
                llmFallbackUsed: boolean;
                fallbackReasons: string[];
            }[];
            status: {
                status?: "idle" | "running" | "awaiting_user" | "stable_candidate" | "ready_for_approval" | "approved";
                convergence?: "unknown" | "exploring" | "improving" | "stable" | "ready";
                currentIteration?: number;
                latestVersion?: number;
                stableVersion?: number;
                readyVersion?: number;
                approvalVersion?: number;
                autoIterations?: number;
                stableRounds?: number;
                stabilityScore?: number;
                lastRunAt?: string;
                lastVerdict?: "retry" | "candidate" | "approve";
                latestSummary?: string;
                stableSummary?: string;
                readySummary?: string;
                stabilityReasons?: string[];
                readyReasons?: string[];
                convergenceEvidence?: string[];
                tighteningCount?: number;
                verificationStatus?: "pending" | "passed" | "blocked" | "warning";
                verificationVersion?: number;
                verificationSummary?: string;
                verificationReasons?: string[];
            } | null;
        };
        loopRun: {
            runId: string;
            totalIterations: number;
            candidateCount: number;
            stopReason: string;
            status: "completed" | "running";
            startedAt: string;
            completedAt: string | undefined;
            finalLoopStatus: "idle" | "running" | "approved" | "ready_for_approval" | "stable_candidate" | "awaiting_user" | undefined;
            finalConvergence: "unknown" | "ready" | "exploring" | "improving" | "stable" | undefined;
            iterations: {
                version: number;
                candidates: {
                    candidateIndex: number;
                    persistedVersion: number | undefined;
                    sample: string;
                    evaluation: StyleEvolutionEvaluation;
                    refinement: StyleEvolutionRefinement;
                    verification: StyleGenerationVerification;
                    freezer: {
                        source: "llm_critic";
                        verdict: "ready" | "block" | "continue";
                        summary: string;
                        blockingReasons: string[];
                        checkedAt: string;
                    } | {
                        source: "heuristic";
                        verdict: "ready" | "continue";
                        summary: string;
                        blockingReasons: string[];
                        checkedAt: string;
                    };
                    llmFallbackUsed: boolean;
                    fallbackReasons: string[];
                }[];
                evaluation: StyleEvolutionEvaluation;
                refinement: StyleEvolutionRefinement;
                verification: StyleGenerationVerification;
                freezer: {
                    source: "llm_critic";
                    verdict: "ready" | "block" | "continue";
                    summary: string;
                    blockingReasons: string[];
                    checkedAt: string;
                } | {
                    source: "heuristic";
                    verdict: "ready" | "continue";
                    summary: string;
                    blockingReasons: string[];
                    checkedAt: string;
                };
                freezerSource: "heuristic" | "llm_critic";
                llmFallbackUsed: boolean;
                fallbackReasons: string[];
            }[];
        };
        modelRouting: {
            capability: string;
            configId: string | undefined;
            modelName: string;
            apiMode: LlmApiMode;
        };
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        reason?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        styleEvolution: StyleEvolutionSnapshot;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        };
        freezePreview: {
            version: number | null;
            sample: string;
            frozenBasePrompt: string;
            freezeSummary: string;
            styleContract: {
                voice?: string;
                sentenceRhythm?: string;
                dialogueRules?: string[];
                descriptionRules?: string[];
                emotionRules?: string[];
                pacingRules?: string[];
                povRules?: string[];
                openingRules?: string[];
                endingHookRules?: string[];
                allowedDevices?: string[];
                forbiddenPatterns?: string[];
                positiveExamples?: string[];
                negativeExamples?: string[];
            };
            antiPatterns: string[];
            positiveExamples: string[];
            inheritedArtifacts: string[];
            inheritedRules: string[];
            evaluation: {
                source?: "heuristic" | "llm_critic";
                verdict?: "retry" | "candidate" | "approve";
                summary?: string;
                scores?: {
                    narrativeVoice?: number;
                    sentenceRhythm?: number;
                    dialogueTexture?: number;
                    informationDensity?: number;
                    emotionalTension?: number;
                    readability?: number;
                    requirementAlignment?: number;
                    forbiddenPatternRisk?: number;
                    overall?: number;
                };
                strengths?: string[];
                deviations?: string[];
                forbiddenHits?: string[];
                nextFocus?: string[];
            } | null;
            refinement: {
                source?: "heuristic" | "llm_critic";
                summary?: string;
                promptAdjustments?: string[];
                contractAdjustments?: string[];
                nextPrompt?: string;
            } | null;
            freezer: {
                source: "llm_critic";
                verdict: "ready" | "block" | "continue";
                summary: string;
                blockingReasons: string[];
                checkedAt: string;
            } | {
                source: "heuristic";
                verdict: "ready" | "continue";
                summary: string;
                blockingReasons: string[];
                checkedAt: string;
            };
            llmFallbackUsed: boolean;
            fallbackReasons: string[];
            contractExtractionSource: "llm_critic" | "local_fallback";
            freezeAdviceSource: "llm_critic" | "local_fallback";
            contractAdjustments: string[];
            approvalScope: string;
        };
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        styleEvolution: StyleEvolutionSnapshot;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        };
        projectRuntime: ProjectRuntimeState;
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        snapshotVersion: string;
        error: string;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        styleEvolution: StyleEvolutionSnapshot | null;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        } | null;
        projectRuntime: null;
        productionReadiness: null;
        factorySnapshot: null;
        snapshotVersion: null;
        error: string;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        styleEvolution: StyleEvolutionSnapshot;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        };
        freezePreview: {
            version: number | null;
            sample: string;
            frozenBasePrompt: string;
            freezeSummary: string;
            styleContract: {
                voice?: string;
                sentenceRhythm?: string;
                dialogueRules?: string[];
                descriptionRules?: string[];
                emotionRules?: string[];
                pacingRules?: string[];
                povRules?: string[];
                openingRules?: string[];
                endingHookRules?: string[];
                allowedDevices?: string[];
                forbiddenPatterns?: string[];
                positiveExamples?: string[];
                negativeExamples?: string[];
            };
            antiPatterns: string[];
            positiveExamples: string[];
            inheritedArtifacts: string[];
            inheritedRules: string[];
            evaluation: {
                source?: "heuristic" | "llm_critic";
                verdict?: "retry" | "candidate" | "approve";
                summary?: string;
                scores?: {
                    narrativeVoice?: number;
                    sentenceRhythm?: number;
                    dialogueTexture?: number;
                    informationDensity?: number;
                    emotionalTension?: number;
                    readability?: number;
                    requirementAlignment?: number;
                    forbiddenPatternRisk?: number;
                    overall?: number;
                };
                strengths?: string[];
                deviations?: string[];
                forbiddenHits?: string[];
                nextFocus?: string[];
            } | null;
            refinement: {
                source?: "heuristic" | "llm_critic";
                summary?: string;
                promptAdjustments?: string[];
                contractAdjustments?: string[];
                nextPrompt?: string;
            } | null;
            freezer: {
                source: "llm_critic";
                verdict: "ready" | "block" | "continue";
                summary: string;
                blockingReasons: string[];
                checkedAt: string;
            } | {
                source: "heuristic";
                verdict: "ready" | "continue";
                summary: string;
                blockingReasons: string[];
                checkedAt: string;
            };
            llmFallbackUsed: boolean;
            fallbackReasons: string[];
            contractExtractionSource: "llm_critic" | "local_fallback";
            freezeAdviceSource: "llm_critic" | "local_fallback";
            contractAdjustments: string[];
            approvalScope: string;
        } | null;
        styleFreezeApproval: {
            llmFallbackUsed: boolean;
            fallbackReasons: string[];
            contractExtractionSource: string;
            freezeAdviceSource: "llm_critic" | "local_fallback";
        };
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        error: string;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        chapterNumber: number;
        path: string;
        content: string;
        chapter: {
            chapterNumber: number;
            title: string;
            status: string;
            source: string;
            versionId: string;
            path: string;
            targetWords: number;
            wordCount: number;
            summary: string;
            qualityGate: any;
            aigcDetection: any;
            styleInheritanceVerification: {
                status: string;
                summary: string;
                chapterNumber: number;
                contractVersion: number;
                contractApproved: boolean;
                approvedAt: string;
                inheritanceStatus: string;
                chapterInheritanceAdapter: Record<string, any> | null;
                adapterReady: boolean;
                freezerVerdict: string;
                inheritedRuleCount: number;
                inheritedArtifactCount: number;
                freezeAssetsReady: boolean;
                inheritanceAssetsReady: boolean;
                styleFingerprintReady: boolean;
                styleFingerprint: string;
                styleConformanceDrift: Record<string, any>;
                styleDrift: {
                    status: string;
                    conformanceScore: number | null;
                    driftScore: number | null;
                    threshold: number;
                    rawConformanceScore: any;
                    rawDriftScore: any;
                    forbiddenHitCount: number;
                    matchedTerms: any[];
                    missingTerms: any[];
                    summary: string;
                };
                qualityGateStatus: string;
                qualityGateReason: string;
                publishBaseReady: boolean;
                publishBaseMissing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                aigc: {
                    status: string;
                    score: number | null;
                    threshold: number | null;
                    highRiskCount: number;
                    reason: string;
                } | null;
                verificationStatus: string;
                verificationSummary: string;
                evidence: any[];
                risks: any[];
            } | {
                status: "pending" | "blocked" | "warning" | "ready";
                summary: string;
                chapterNumber: number;
                contractVersion: number | undefined;
                contractApproved: boolean;
                approvedAt: string;
                inheritanceStatus: string;
                chapterInheritanceAdapter: Record<string, any> | null;
                adapterReady: boolean;
                freezerVerdict: string;
                inheritedRuleCount: number;
                inheritedArtifactCount: number;
                freezeAssetsReady: boolean;
                inheritanceAssetsReady: boolean;
                styleFingerprintReady: boolean;
                styleFingerprint: string;
                qualityGateStatus: string;
                qualityGateReason: string;
                publishBaseReady: boolean;
                publishBaseMissing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                aigc: {
                    status: string;
                    score: number | null;
                    threshold: number | null;
                    highRiskCount: number;
                    reason: string;
                } | null;
                verificationStatus: string;
                verificationSummary: string;
                evidence: any[];
                risks: any[];
                styleConformanceDrift?: undefined;
                styleDrift?: undefined;
            };
            publishReadiness: {
                ready: boolean;
                status: string;
                locked: boolean;
                selectedVersionId: string;
                checkedAt: string;
                missing: {
                    id: string;
                    label: string;
                    detail: string;
                }[];
                checks: {
                    id: string;
                    label: string;
                    passed: boolean;
                    detail: string;
                }[];
                styleInheritanceVerification: {
                    status: string;
                    summary: string;
                    chapterNumber: number;
                    contractVersion: number;
                    contractApproved: boolean;
                    approvedAt: string;
                    inheritanceStatus: string;
                    chapterInheritanceAdapter: Record<string, any> | null;
                    adapterReady: boolean;
                    freezerVerdict: string;
                    inheritedRuleCount: number;
                    inheritedArtifactCount: number;
                    freezeAssetsReady: boolean;
                    inheritanceAssetsReady: boolean;
                    styleFingerprintReady: boolean;
                    styleFingerprint: string;
                    styleConformanceDrift: Record<string, any>;
                    styleDrift: {
                        status: string;
                        conformanceScore: number | null;
                        driftScore: number | null;
                        threshold: number;
                        rawConformanceScore: any;
                        rawDriftScore: any;
                        forbiddenHitCount: number;
                        matchedTerms: any[];
                        missingTerms: any[];
                        summary: string;
                    };
                    qualityGateStatus: string;
                    qualityGateReason: string;
                    publishBaseReady: boolean;
                    publishBaseMissing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    aigc: {
                        status: string;
                        score: number | null;
                        threshold: number | null;
                        highRiskCount: number;
                        reason: string;
                    } | null;
                    verificationStatus: string;
                    verificationSummary: string;
                    evidence: any[];
                    risks: any[];
                } | {
                    status: "pending" | "blocked" | "warning" | "ready";
                    summary: string;
                    chapterNumber: number;
                    contractVersion: number | undefined;
                    contractApproved: boolean;
                    approvedAt: string;
                    inheritanceStatus: string;
                    chapterInheritanceAdapter: Record<string, any> | null;
                    adapterReady: boolean;
                    freezerVerdict: string;
                    inheritedRuleCount: number;
                    inheritedArtifactCount: number;
                    freezeAssetsReady: boolean;
                    inheritanceAssetsReady: boolean;
                    styleFingerprintReady: boolean;
                    styleFingerprint: string;
                    qualityGateStatus: string;
                    qualityGateReason: string;
                    publishBaseReady: boolean;
                    publishBaseMissing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    aigc: {
                        status: string;
                        score: number | null;
                        threshold: number | null;
                        highRiskCount: number;
                        reason: string;
                    } | null;
                    verificationStatus: string;
                    verificationSummary: string;
                    evidence: any[];
                    risks: any[];
                    styleConformanceDrift?: undefined;
                    styleDrift?: undefined;
                };
            };
            versionManifest: {
                publishReadiness: {
                    ready: boolean;
                    status: string;
                    locked: boolean;
                    selectedVersionId: string;
                    checkedAt: string;
                    missing: {
                        id: string;
                        label: string;
                        detail: string;
                    }[];
                    checks: {
                        id: string;
                        label: string;
                        passed: boolean;
                        detail: string;
                    }[];
                    styleInheritanceVerification: {
                        status: string;
                        summary: string;
                        chapterNumber: number;
                        contractVersion: number;
                        contractApproved: boolean;
                        approvedAt: string;
                        inheritanceStatus: string;
                        chapterInheritanceAdapter: Record<string, any> | null;
                        adapterReady: boolean;
                        freezerVerdict: string;
                        inheritedRuleCount: number;
                        inheritedArtifactCount: number;
                        freezeAssetsReady: boolean;
                        inheritanceAssetsReady: boolean;
                        styleFingerprintReady: boolean;
                        styleFingerprint: string;
                        styleConformanceDrift: Record<string, any>;
                        styleDrift: {
                            status: string;
                            conformanceScore: number | null;
                            driftScore: number | null;
                            threshold: number;
                            rawConformanceScore: any;
                            rawDriftScore: any;
                            forbiddenHitCount: number;
                            matchedTerms: any[];
                            missingTerms: any[];
                            summary: string;
                        };
                        qualityGateStatus: string;
                        qualityGateReason: string;
                        publishBaseReady: boolean;
                        publishBaseMissing: {
                            id: string;
                            label: string;
                            detail: string;
                        }[];
                        aigc: {
                            status: string;
                            score: number | null;
                            threshold: number | null;
                            highRiskCount: number;
                            reason: string;
                        } | null;
                        verificationStatus: string;
                        verificationSummary: string;
                        evidence: any[];
                        risks: any[];
                    } | {
                        status: "pending" | "blocked" | "warning" | "ready";
                        summary: string;
                        chapterNumber: number;
                        contractVersion: number | undefined;
                        contractApproved: boolean;
                        approvedAt: string;
                        inheritanceStatus: string;
                        chapterInheritanceAdapter: Record<string, any> | null;
                        adapterReady: boolean;
                        freezerVerdict: string;
                        inheritedRuleCount: number;
                        inheritedArtifactCount: number;
                        freezeAssetsReady: boolean;
                        inheritanceAssetsReady: boolean;
                        styleFingerprintReady: boolean;
                        styleFingerprint: string;
                        qualityGateStatus: string;
                        qualityGateReason: string;
                        publishBaseReady: boolean;
                        publishBaseMissing: {
                            id: string;
                            label: string;
                            detail: string;
                        }[];
                        aigc: {
                            status: string;
                            score: number | null;
                            threshold: number | null;
                            highRiskCount: number;
                            reason: string;
                        } | null;
                        verificationStatus: string;
                        verificationSummary: string;
                        evidence: any[];
                        risks: any[];
                        styleConformanceDrift?: undefined;
                        styleDrift?: undefined;
                    };
                };
                version: number;
                chapterNumber: number;
                chapterTitle: string;
                publishedVersionId: string;
                locked: boolean;
                status: string;
                writingMode: string;
                targetWords: number;
                wordCount: number;
                updatedAt: string;
                qualityGate: any;
                aigcDetection: any;
                chapterInheritanceAdapter: any;
                styleConformanceDrift: any;
                styleInheritanceVerification: any;
                artifacts: any;
                versions: {
                    id: string;
                    label: string;
                    source: string;
                    path: string;
                    wordCount: number;
                    status: string;
                    createdAt: string;
                }[];
            } | null;
            body: string;
        } | null | undefined;
        envStatus: PublicProjectEnvStatus;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        path: string;
        mimeType: string;
        dataUrl: string;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        repairedStoryAssets: string[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        repairedStoryAssets: string[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        storyFoundationApproval: {
            version: number;
            approved: boolean;
            approvedAt: string;
            approvedBy: string;
            note: string;
            assetPaths: string[];
            assetFingerprint: string;
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        storyFoundationApproval: {
            version: number;
            approved: boolean;
            approvedAt: string;
            approvedBy: string;
            note: string;
            assetPaths: string[];
            assetFingerprint: string;
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        settings: {
            bypassAigcGate: boolean;
            autoAigcRefinement: boolean;
            draftSubcallRoles: string[];
            aigcDetector: {
                provider: string;
                url: string;
                tokenConfigured: boolean;
                timeoutMs: number;
                threshold: number;
                requestTextField: string;
                headersJson: string;
                segmentMaxChars: number;
                segmentMinChars: number;
                gradioFnIndex: string;
                gradioSessionHashConfigured: boolean;
                gradioJoinUrl: string;
                gradioDataUrl: string;
                gradioSkipJoin: boolean;
                gradioInputsJson: string;
            };
        } | {
            bypassAigcGate: boolean;
            autoAigcRefinement: boolean;
            draftSubcallRoles: never[];
            aigcDetector: {
                provider: string;
                url: string;
                tokenConfigured: boolean;
                timeoutMs: number;
                threshold: number;
                requestTextField: string;
                headersJson: string;
                segmentMaxChars: number;
                segmentMinChars: number;
                gradioFnIndex: string;
                gradioSessionHashConfigured: boolean;
                gradioJoinUrl: string;
                gradioDataUrl: string;
                gradioSkipJoin: boolean;
                gradioInputsJson: string;
            };
        };
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        success: boolean;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        productionReadiness?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        styleEvolution: StyleEvolutionSnapshot;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        };
        projectRuntime: ProjectRuntimeState;
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        snapshotVersion: string;
        success: boolean;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        results: Record<number, any>;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        styleEvolution: StyleEvolutionSnapshot | null;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        } | null;
        projectRuntime: null;
        productionReadiness: null;
        factorySnapshot: null;
        snapshotVersion: null;
        success: boolean;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        results: Record<number, any>;
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        envStatus: PublicProjectEnvStatus;
        styleEvolution: StyleEvolutionSnapshot;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        };
        projectRuntime: ProjectRuntimeState;
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        snapshotVersion: string;
        success: boolean;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error: string;
        reason: string;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    } | {
        envStatus: PublicProjectEnvStatus;
        styleEvolution: StyleEvolutionSnapshot | null;
        styleEvolutionAssets: {
            freezePackage: {
                approvedSample: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                freezeLedger: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuntime: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                loopRuns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
            chapterInheritance: {
                rulebook: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                references: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
                antiPatterns: {
                    path: string;
                    exists: boolean;
                    chars: number;
                    preview: string;
                };
            };
        } | null;
        projectRuntime: null;
        productionReadiness: null;
        factorySnapshot: null;
        snapshotVersion: null;
        success: boolean;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error: string;
        reason: string;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
} | {
    status: number;
    payload: {
        success: boolean;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error: string | undefined;
        reason: string | undefined;
        productionReadiness: Record<string, any> | undefined;
        readerStats: any;
        blockedChapters: {
            chapterNumber: any;
            title: any;
            missing: any;
            styleInheritanceVerification: any;
        }[] | undefined;
        envStatus: PublicProjectEnvStatus;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        snapshotVersion?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        success: boolean;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
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
            memory: {
                characterDossiers: CharacterDossier[];
            } | undefined;
            assets: {
                cover: {
                    status: AssetStatus;
                    briefPath: string;
                    promptPath?: string;
                    imagePath?: string;
                    metadataPath?: string;
                    generatedAt?: string;
                    error?: string;
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
        productionReadiness: ProductionReadinessSnapshot | {
            status: "blocked";
            canProceed: boolean;
            blockedReason: string;
            summary: string;
            issues: (ProductionGateIssue | {
                code: string;
                severity: "critical";
                message: string;
                action: string;
            })[];
            score: number;
            items: ProductionReadinessItem[];
            groups: ProductionReadinessGroup[];
        };
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
        success: boolean;
        activeProjectId: string;
        projects: never[] | NovelProjectRecord[];
        error?: undefined;
        result?: undefined;
        configs?: undefined;
        routes?: undefined;
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
        styleEvolution?: undefined;
        styleEvolutionAssets?: undefined;
        reason?: undefined;
        loopRun?: undefined;
        modelRouting?: undefined;
        generatedCandidate?: undefined;
        loopIteration?: undefined;
        freezePreview?: undefined;
        styleFreezeApproval?: undefined;
        transcript?: undefined;
        notModified?: undefined;
        chapterNumber?: undefined;
        path?: undefined;
        content?: undefined;
        chapter?: undefined;
        message?: undefined;
        settings?: undefined;
        readerStats?: undefined;
        blockedChapters?: undefined;
    };
}>;
declare function startNovelStudioServer(options?: ServerOptions): Promise<{
    server: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
    port: number;
    close: () => Promise<void>;
}>;
declare function runNovelStudioServerCli(args?: string[]): Promise<void>;

export { handleNovelStudioApi, runNovelStudioServerCli, startNovelStudioServer, writeServerErrorResponse };
