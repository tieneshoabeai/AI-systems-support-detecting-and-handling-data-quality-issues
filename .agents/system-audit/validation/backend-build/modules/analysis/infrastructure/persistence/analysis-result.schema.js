"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisResultSchema = void 0;
const mongoose_1 = require("mongoose");
exports.AnalysisResultSchema = new mongoose_1.Schema({
    analysis_run_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AnalysisRun', required: true, index: true },
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    dataset_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Dataset', required: true },
    input_fingerprint: { type: String, required: true, index: true },
    is_stale: { type: Boolean, required: true, default: false },
    stale_reason: { type: String, default: null },
    dq05: { type: mongoose_1.Schema.Types.Mixed, required: true },
    correlationMatrix: { type: mongoose_1.Schema.Types.Mixed, default: null },
    vif: { type: mongoose_1.Schema.Types.Mixed, default: null },
    aiCorrelationAssessment: { type: mongoose_1.Schema.Types.Mixed, default: null },
    dq_summary: { type: mongoose_1.Schema.Types.Mixed, default: null },
    descriptive: { type: mongoose_1.Schema.Types.Mixed, default: null },
    imbalance: { type: mongoose_1.Schema.Types.Mixed, default: null },
    timeAnalysis: { type: mongoose_1.Schema.Types.Mixed, default: null },
    evidenceSummary: { type: mongoose_1.Schema.Types.Mixed, default: null },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.AnalysisResultSchema.index({ project_id: 1, created_at: -1 });
exports.AnalysisResultSchema.index({ input_fingerprint: 1, is_stale: 1 });
//# sourceMappingURL=analysis-result.schema.js.map