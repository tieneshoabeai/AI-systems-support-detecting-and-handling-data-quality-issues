export const ISSUE_EVENTS = {
  CREATED: 'issue.created',
  STATUS_CHANGED: 'issue.status_changed',
  NEEDS_INFO: 'issue.needs_info',
  RESOLVED: 'issue.resolved',
} as const;

export type IssueEventName = (typeof ISSUE_EVENTS)[keyof typeof ISSUE_EVENTS];
