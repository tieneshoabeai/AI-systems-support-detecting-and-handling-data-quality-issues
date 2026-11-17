"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSaveSchema = void 0;
const mongoose_1 = require("mongoose");
exports.ProjectSaveSchema = new mongoose_1.Schema({
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    analysis_run_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AnalysisRun', default: null },
    analysis_result_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'AnalysisResult', default: null },
    input_fingerprint: { type: String, default: null },
    is_stale: { type: Boolean, required: true, default: false },
    summary: { type: mongoose_1.Schema.Types.Mixed, required: true },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.ProjectSaveSchema.index({ project_id: 1, created_at: -1 });
//# sourceMappingURL=project-save.schema.js.map