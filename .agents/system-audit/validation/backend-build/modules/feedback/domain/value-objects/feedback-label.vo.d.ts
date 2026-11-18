export declare const FEEDBACK_LABELS: readonly ['correct', 'partially_correct', 'false_positive', 'missed_issue', 'other'];
export type FeedbackLabel = (typeof FEEDBACK_LABELS)[number];
export declare const FEEDBACK_SEVERITIES: readonly ['low', 'medium', 'high', 'critical'];
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];
export declare const LABELS_REQUIRING_REASON: FeedbackLabel[];
export declare function requiresReason(label: string): boolean;
export declare function assertReasonForLabel(label: string, reason: string | null | undefined): void;
