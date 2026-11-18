export declare const ISSUE_STATUSES: readonly ['new', 'in_progress', 'resolved', 'closed'];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export declare const ALLOWED_ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]>;
export declare function isAllowedIssueTransition(from: IssueStatus, to: IssueStatus): boolean;
export declare function assertAllowedIssueTransition(from: IssueStatus, to: IssueStatus): void;
