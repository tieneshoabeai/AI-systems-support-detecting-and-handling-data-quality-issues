"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueReport = void 0;
const issue_status_vo_1 = require("../value-objects/issue-status.vo");
class IssueReport {
    props;
    constructor(props) {
        this.props = props;
    }
    static create(props) {
        return new IssueReport({ ...props });
    }
    canTransitionTo(next) {
        const allowed = { new: ['in_progress'], in_progress: ['resolved', 'new'], resolved: ['closed'], closed: [] };
        return (allowed[this.props.status] ?? []).includes(next);
    }
    assertCanTransitionTo(next) {
        (0, issue_status_vo_1.assertAllowedIssueTransition)(this.props.status, next);
    }
}
exports.IssueReport = IssueReport;
//# sourceMappingURL=issue-report.entity.js.map