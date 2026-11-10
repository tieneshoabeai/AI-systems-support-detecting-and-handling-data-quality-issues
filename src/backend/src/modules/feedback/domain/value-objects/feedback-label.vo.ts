export const FEEDBACK_LABELS = [
  'correct',
  'partially_correct',
  'false_positive',
  'missed_issue',
  'other',
] as const;

export type FeedbackLabel = (typeof FEEDBACK_LABELS)[number];

export const FEEDBACK_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

export const LABELS_REQUIRING_REASON: FeedbackLabel[] = [
  'false_positive',
  'missed_issue',
  'other',
];

export function requiresReason(label: string): boolean {
  return (LABELS_REQUIRING_REASON as readonly string[]).includes(label);
}

export function assertReasonForLabel(label: string, reason: string | null | undefined): void {
  if (requiresReason(label) && !reason?.trim()) {
    throw new Error(`Nhan "${label}" yeu cau ly do (reason)`);
  }
}
