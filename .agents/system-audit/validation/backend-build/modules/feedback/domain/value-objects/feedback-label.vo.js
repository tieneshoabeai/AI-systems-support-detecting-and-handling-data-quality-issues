"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LABELS_REQUIRING_REASON = exports.FEEDBACK_SEVERITIES = exports.FEEDBACK_LABELS = void 0;
exports.requiresReason = requiresReason;
exports.assertReasonForLabel = assertReasonForLabel;
exports.FEEDBACK_LABELS = [
    'correct',
    'partially_correct',
    'false_positive',
    'missed_issue',
    'other',
];
exports.FEEDBACK_SEVERITIES = ['low', 'medium', 'high', 'critical'];
exports.LABELS_REQUIRING_REASON = [
    'false_positive',
    'missed_issue',
    'other',
];
function requiresReason(label) {
    return exports.LABELS_REQUIRING_REASON.includes(label);
}
function assertReasonForLabel(label, reason) {
    if (requiresReason(label) && !reason?.trim()) {
        throw new Error(`Nhan "${label}" yeu cau ly do (reason)`);
    }
}
//# sourceMappingURL=feedback-label.vo.js.map