"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationSchema = exports.MandatoryNotificationTypes = exports.NotificationTypes = void 0;
const mongoose_1 = require("mongoose");
exports.NotificationTypes = [
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
exports.MandatoryNotificationTypes = [
    'issue_needs_info',
    'security_alert',
];
const NotificationPayloadSchema = new mongoose_1.Schema({
    targetType: { type: String, default: null },
    targetId: { type: String, default: null },
    actionUrl: { type: String, default: null },
}, { _id: false });
exports.NotificationSchema = new mongoose_1.Schema({
    user_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: [...exports.NotificationTypes], required: true, index: true },
    is_mandatory: { type: Boolean, required: true, default: false },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    summary: { type: String, default: null, maxlength: 500 },
    payload: { type: NotificationPayloadSchema, default: undefined },
    source_event_id: { type: String, default: null, index: true },
    read_at: { type: Date, default: null, index: true },
    expires_at: { type: Date, default: null },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.NotificationSchema.index({ user_id: 1, read_at: 1, created_at: -1 });
exports.NotificationSchema.index({ user_id: 1, read_at: 1 });
exports.NotificationSchema.index({ user_id: 1, source_event_id: 1 }, { unique: true, partialFilterExpression: { source_event_id: { $ne: null } } });
exports.NotificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
//# sourceMappingURL=notification.schema.js.map