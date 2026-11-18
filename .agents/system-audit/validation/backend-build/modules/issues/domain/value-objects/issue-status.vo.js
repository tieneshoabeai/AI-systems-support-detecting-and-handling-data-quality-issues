"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_ISSUE_TRANSITIONS = exports.ISSUE_STATUSES = void 0;
exports.isAllowedIssueTransition = isAllowedIssueTransition;
exports.assertAllowedIssueTransition = assertAllowedIssueTransition;
exports.ISSUE_STATUSES = ['new', 'in_progress', 'resolved', 'closed'];
exports.ALLOWED_ISSUE_TRANSITIONS = {
    new: ['in_progress'],
    in_progress: ['resolved', 'new'],
    resolved: ['closed'],
    closed: [],
};
function isAllowedIssueTransition(from, to) {
    return (exports.ALLOWED_ISSUE_TRANSITIONS[from] ?? []).includes(to);
}
function assertAllowedIssueTransition(from, to) {
    if (!isAllowedIssueTransition(from, to)) {
        throw new Error(`Chuyen trang thai khong hop le: ${from} -> ${to}`);
    }
}
//# sourceMappingURL=issue-status.vo.js.map