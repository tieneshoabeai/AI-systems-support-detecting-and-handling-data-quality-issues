"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FindingFeedbackSchema = exports.LabelsRequiringReason = exports.FeedbackLabels = void 0;
const mongoose_1 = require("mongoose");
exports.FeedbackLabels = [
    'correct',
    'partially_correct',
    'false_positive',
    'missed_issue',
    'other',
];
exports.LabelsRequiringReason = [
    'false_positive',
    'missed_issue',
    'other',
];
exports.FindingFeedbackSchema = new mongoose_1.Schema({
    analysis_run_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'AnalysisRun',
        required: true,
        index: true,
    },
    finding_id: { type: String, default: null, index: true },
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    label: { type: String, enum: [...exports.FeedbackLabels], required: true, index: true },
    reason: { type: String, default: null, maxlength: 2000 },
    suggested_severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: null,
    },
    ai_confidence: { type: Number, default: null },
    ai_rationale: { type: String, default: null, maxlength: 1000 },
    author_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    author_role_at_time: { type: String, required: true },
    model_id: { type: String, default: null, index: true },
    prompt_version: { type: String, default: null },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.FindingFeedbackSchema.index({ analysis_run_id: 1, finding_id: 1, created_at: -1 });
exports.FindingFeedbackSchema.index({ project_id: 1, created_at: -1 });
exports.FindingFeedbackSchema.index({ label: 1, created_at: -1 });
exports.FindingFeedbackSchema.index({ model_id: 1, created_at: -1 });
exports.FindingFeedbackSchema.index({ author_id: 1, created_at: -1 });
exports.FindingFeedbackSchema.index({ created_at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
//# sourceMappingURL=finding-feedback.schema.js.map