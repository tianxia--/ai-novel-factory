type AigcDetectorProvider = "disabled" | "generic-json" | "gradio-queue";
type AigcDetectionStatus = "ai_likely" | "human_likely" | "uncertain" | "unavailable";
interface AigcDetectorSegmentOptions {
    maxChars?: number;
    minChars?: number;
}
interface AigcDetectorGradioOptions {
    fnIndex?: number;
    sessionHash?: string;
    joinUrl?: string;
    dataUrl?: string;
    skipJoin?: boolean;
    inputs?: unknown[];
}
interface AigcDetectionConfig {
    provider?: AigcDetectorProvider;
    url?: string;
    token?: string;
    timeoutMs?: number;
    threshold?: number;
    headers?: Record<string, string>;
    requestTextField?: string;
    segment?: AigcDetectorSegmentOptions;
    gradio?: AigcDetectorGradioOptions;
    fetchImpl?: typeof fetch;
    throwOnError?: boolean;
}
interface AigcDetectionInput {
    text: string;
    id?: string;
    metadata?: Record<string, unknown>;
}
interface AigcTextSegment extends AigcDetectionInput {
    index: number;
    startOffset: number;
    endOffset: number;
}
interface AigcDetectionResult {
    ok: boolean;
    provider: AigcDetectorProvider;
    status: AigcDetectionStatus;
    score: number | null;
    label: string;
    confidence: number | null;
    raw: unknown;
    reason: string;
}
interface AigcSegmentDetectionResult extends AigcDetectionResult {
    segment: AigcTextSegment;
    charCount: number;
}
interface AigcBatchDetectionResult {
    ok: boolean;
    provider: AigcDetectorProvider;
    status: AigcDetectionStatus;
    score: number | null;
    confidence: number | null;
    threshold: number;
    totalSegments: number;
    highRiskSegments: AigcSegmentDetectionResult[];
    segments: AigcSegmentDetectionResult[];
    reason: string;
}
interface ServerSentEvent {
    event?: string;
    data: string;
}
declare function getAigcDetectorConfigFromEnv(env?: Record<string, string | undefined>): AigcDetectionConfig;
declare function getAigcDetectorConfig(rootDir?: string): AigcDetectionConfig;
declare function createAigcDetectorClient(config?: AigcDetectionConfig): {
    config: AigcDetectionConfig;
    detectText(input: string | AigcDetectionInput, override?: AigcDetectionConfig): Promise<AigcDetectionResult>;
    detectSegments(input: string | AigcDetectionInput | AigcTextSegment[], override?: AigcDetectionConfig): Promise<AigcBatchDetectionResult>;
    splitText(text: string, options?: AigcDetectorSegmentOptions): AigcTextSegment[];
};
declare function detectAigcText(input: string | AigcDetectionInput, config?: AigcDetectionConfig): Promise<AigcDetectionResult>;
declare function detectAigcSegments(input: string | AigcDetectionInput | AigcTextSegment[], config?: AigcDetectionConfig): Promise<AigcBatchDetectionResult>;
declare function splitAigcTextIntoSegments(text: string, options?: AigcDetectorSegmentOptions): AigcTextSegment[];
declare function parseAigcDetectorSse(payload: string): ServerSentEvent[];

export { type AigcBatchDetectionResult, type AigcDetectionConfig, type AigcDetectionInput, type AigcDetectionResult, type AigcDetectionStatus, type AigcDetectorGradioOptions, type AigcDetectorProvider, type AigcDetectorSegmentOptions, type AigcSegmentDetectionResult, type AigcTextSegment, createAigcDetectorClient, detectAigcSegments, detectAigcText, getAigcDetectorConfig, getAigcDetectorConfigFromEnv, parseAigcDetectorSse, splitAigcTextIntoSegments };
