"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditChangeSchema = exports.AuditLogSchema = void 0;
const mongoose_1 = require("mongoose");
exports.AuditLogSchema = new mongoose_1.Schema({
    actor_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actor_role: { type: String, default: null },
    action: { type: String, required: true, index: true },
    target_type: { type: String, required: true },
    target_id: { type: String, default: null },
    target_label: { type: String, default: null, maxlength: 200 },
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', default: null },
    ip_address: { type: String, default: null, maxlength: 45 },
    user_agent: { type: String, default: null, maxlength: 500 },
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    expires_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false });
exports.AuditLogSchema.index({ actor_id: 1, created_at: -1 });
exports.AuditLogSchema.index({ target_type: 1, target_id: 1, created_at: -1 });
exports.AuditLogSchema.index({ workspace_id: 1, created_at: -1 });
exports.AuditLogSchema.index({ action: 1, created_at: -1 });
exports.AuditLogSchema.index({ created_at: -1 });
exports.AuditLogSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
exports.AuditChangeSchema = new mongoose_1.Schema({
    audit_log_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AuditLog', required: true, index: true },
    field: { type: String, required: true },
    before_value: { type: mongoose_1.Schema.Types.Mixed, default: null },
    after_value: { type: mongoose_1.Schema.Types.Mixed, default: null },
    expires_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false });
//# sourceMappingURL=audit-log.schema.js.map