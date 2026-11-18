"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueReportSchema = exports.IssueStatuses = exports.IssueTypes = void 0;
const mongoose_1 = require("mongoose");
exports.IssueTypes = ['function_error', 'display_error', 'data_error', 'feature_feedback', 'other'];
exports.IssueStatuses = ['new', 'in_progress', 'resolved', 'closed'];
const IssueAttachmentSchema = new mongoose_1.Schema({
    id: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true, maxlength: 255 },
    storage_key: { type: String, required: true },
    size_bytes: { type: Number, required: true, max: 10 * 1024 * 1024 },
    content_type: { type: String, required: true },
}, { _id: false });
const IssueContextSchema = new mongoose_1.Schema({
    api_path: { type: String, default: null, maxlength: 200 },
    error_message: { type: String, default: null, maxlength: 1000 },
    occurred_at: { type: Date, default: null },
}, { _id: false });
exports.IssueReportSchema = new mongoose_1.Schema({
    user_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
    issue_type: { type: String, enum: [...exports.IssueTypes], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: [...exports.IssueStatuses], required: true, default: 'new', index: true },
    attachments: { type: [IssueAttachmentSchema], default: [] },
    context: { type: IssueContextSchema, default: undefined },
    version: { type: Number, required: true, default: 1 },
    deleted_at: { type: Date, default: null, index: true },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.IssueReportSchema.index({ user_id: 1, status: 1, created_at: -1 });
exports.IssueReportSchema.index({ status: 1, created_at: -1 });
exports.IssueReportSchema.index({ workspace_id: 1, created_at: -1 });
//# sourceMappingURL=issue-report.schema.js.map