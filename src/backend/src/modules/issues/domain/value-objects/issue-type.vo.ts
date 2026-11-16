export const ISSUE_TYPES = [
  'function_error',
  'display_error',
  'data_error',
  'feature_feedback',
  'other',
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
