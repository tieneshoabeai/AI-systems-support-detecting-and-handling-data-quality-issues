export interface FewShotExample {
    errorType: string;
    columnTraits: string;
    description: string;
    label: 'correct' | 'false_positive' | 'missed_issue';
    embedding: number[];
    trustScore: number;
    language: string;
    createdAt: Date;
}
export interface RagQuery {
    embedding: number[];
    errorType?: string;
    language?: string;
    topK?: number;
    minTrustScore?: number;
    maxAgeDays?: number;
}
export declare const MAX_FEW_SHOT_STORE = 50000;
export declare const DEFAULT_MIN_TRUST_SCORE = 0.6;
export declare const DEFAULT_MAX_AGE_DAYS = 180;
export declare const DEFAULT_TOP_K = 5;
export declare function cosineSimilarity(a: number[], b: number[]): number;
export declare function rankFewShot(examples: FewShotExample[], query: RagQuery): FewShotExample[];
export declare function normalizeExample(input: {
    errorType: string;
    columnTraits: string;
    description: string;
    label: FewShotExample['label'];
    embedding: number[];
    trustScore?: number;
    language?: string;
    createdAt?: Date;
}): FewShotExample;
export declare function stripIdentifiers(text: string): string;
export declare function renderFewShotBlock(examples: FewShotExample[]): string;
export declare const KNOWN_ERROR_TYPES: readonly ['DQ-01', 'DQ-02', 'DQ-03', 'DQ-04', 'DQ-05'];
export declare function extractErrorType(findingId: string | null | undefined): string;
export declare function mapFeedbackLabelToExampleLabel(label: string): FewShotExample['label'] | null;
export declare function computeTrustScore(agreementCount: number): number;
export declare function isEligibleForStore(agreementCount: number, trustScore: number): boolean;
export declare function embedText(text: string, dim?: number): number[];
