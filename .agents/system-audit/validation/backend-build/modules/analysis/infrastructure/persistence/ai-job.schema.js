"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiJobSchema = void 0;
const mongoose_1 = require("mongoose");
exports.AiJobSchema = new mongoose_1.Schema({
    analysis_run_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AnalysisRun', required: true, index: true },
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    dataset_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Dataset', required: true },
    input_fingerprint: { type: String, required: true, index: true },
    status: {
        type: String,
        enum: ['pending', 'running', 'succeeded', 'failed', 'skipped'],
        required: true,
        default: 'pending',
        index: true,
    },
    attempt: { type: Number, required: true, default: 0 },
    model_id: { type: String, default: null },
    prompt_version: { type: String, default: null },
    error: { type: mongoose_1.Schema.Types.Mixed, default: null },
    started_at: { type: Date, default: null },
    finished_at: { type: Date, default: null },
    duration_ms: { type: Number, default: null },
    heartbeat_at: { type: Date, default: null },
    lease_expires_at: { type: Date, default: null, index: true },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.AiJobSchema.index({ input_fingerprint: 1, status: 1 });
exports.AiJobSchema.index({ project_id: 1, created_at: -1 });
//# sourceMappingURL=ai-job.schema.js.map