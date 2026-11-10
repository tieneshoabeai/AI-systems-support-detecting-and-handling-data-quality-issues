export const ISSUE_STATUSES = ['new', 'in_progress', 'resolved', 'closed'] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ALLOWED_ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  new: ['in_progress'],
  in_progress: ['resolved', 'new'],
  resolved: ['closed'],
  closed: [],
};

export function isAllowedIssueTransition(from: IssueStatus, to: IssueStatus): boolean {
  return (ALLOWED_ISSUE_TRANSITIONS[from] ?? []).includes(to);
}

export function assertAllowedIssueTransition(from: IssueStatus, to: IssueStatus): void {
  if (!isAllowedIssueTransition(from, to)) {
    throw new Error(`Chuyen trang thai khong hop le: ${from} -> ${to}`);
  }
}
