"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANDATORY_NOTIFICATION_TYPES = exports.NOTIFICATION_TYPES = void 0;
exports.isMandatoryNotification = isMandatoryNotification;
exports.shouldDispatch = shouldDispatch;
exports.NOTIFICATION_TYPES = [
    'project_created',
    'project_deleted',
    'project_member_added',
    'issue_needs_info',
    'issue_resolved',
    'analysis_completed',
    'analysis_failed',
    'ai_analysis_ready',
    'report_ready',
    'security_alert',
];
exports.MANDATORY_NOTIFICATION_TYPES = [
    'issue_needs_info',
    'security_alert',
];
function isMandatoryNotification(type, explicitFlag) {
    if (explicitFlag)
        return true;
    return exports.MANDATORY_NOTIFICATION_TYPES.includes(type);
}
function shouldDispatch(enabled, mandatory) {
    if (enabled === false && !mandatory)
        return false;
    return true;
}
//# sourceMappingURL=notification-type.vo.js.map