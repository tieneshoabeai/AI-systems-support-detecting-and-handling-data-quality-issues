"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisConfigSchema = void 0;
const mongoose_1 = require("mongoose");
exports.AnalysisConfigSchema = new mongoose_1.Schema({
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    selected_columns: { type: [String], default: null },
    label_column: { type: String, default: null },
    time_column: { type: String, default: null },
    time_granularity: { type: String, enum: ['day', 'week', 'month', 'year'], default: 'day' },
    value_column: { type: String, default: null },
    correlation_method: { type: String, enum: ['pearson', 'spearman'], default: 'pearson' },
    outlier_method: { type: String, enum: ['iqr', 'modified_zscore', 'both'], default: 'iqr' },
    top_n: { type: Number, default: 10 },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
//# sourceMappingURL=analysis-config.schema.js.map