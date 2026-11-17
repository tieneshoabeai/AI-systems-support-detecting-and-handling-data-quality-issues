"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisRunSchema = void 0;
const mongoose_1 = require("mongoose");
exports.AnalysisRunSchema = new mongoose_1.Schema({
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    dataset_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Dataset', required: true },
    status: {
        type: String,
        enum: ['pending', 'running', 'succeeded', 'failed'],
        required: true,
        default: 'pending',
        index: true,
    },
    input_fingerprint: { type: String, required: true, index: true },
    config: { type: mongoose_1.Schema.Types.Mixed, required: true },
    started_by: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    started_at: { type: Date, default: null },
    finished_at: { type: Date, default: null },
    duration_ms: { type: Number, default: null },
    error: { type: mongoose_1.Schema.Types.Mixed, default: null },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.AnalysisRunSchema.index({ project_id: 1, created_at: -1 });
exports.AnalysisRunSchema.index({ input_fingerprint: 1, status: 1 });
//# sourceMappingURL=analysis-run.schema.js.map