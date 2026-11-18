"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CellEvidenceSchema = void 0;
const mongoose_1 = require("mongoose");
exports.CellEvidenceSchema = new mongoose_1.Schema({
    analysis_run_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AnalysisRun', required: true, index: true },
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    dataset_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
    column: { type: String, required: true },
    row_index: { type: Number, required: true },
    kind: { type: String, enum: ['missing', 'duplicate', 'invalid_type', 'outlier'], required: true },
    reason: { type: String, default: null },
    value_masked: { type: String, default: null },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.CellEvidenceSchema.index({ analysis_run_id: 1, column: 1, row_index: 1 });
//# sourceMappingURL=cell-evidence.schema.js.map