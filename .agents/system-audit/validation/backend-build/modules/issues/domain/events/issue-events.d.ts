export declare const ISSUE_EVENTS: {
    readonly CREATED: 'issue.created';
    readonly STATUS_CHANGED: 'issue.status_changed';
    readonly NEEDS_INFO: 'issue.needs_info';
    readonly RESOLVED: 'issue.resolved';
};
export type IssueEventName = (typeof ISSUE_EVENTS)[keyof typeof ISSUE_EVENTS];
