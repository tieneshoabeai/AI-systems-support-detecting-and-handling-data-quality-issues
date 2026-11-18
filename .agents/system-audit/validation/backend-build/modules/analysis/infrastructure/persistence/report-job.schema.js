"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportJobSchema = void 0;
const mongoose_1 = require("mongoose");
exports.ReportJobSchema = new mongoose_1.Schema({
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    project_save_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProjectSave', default: null },
    status: { type: String, enum: ['pending', 'running', 'succeeded', 'failed'], required: true, default: 'pending', index: true },
    storage_key: { type: String, default: null },
    file_size_bytes: { type: Number, default: null },
    error: { type: mongoose_1.Schema.Types.Mixed, default: null },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.ReportJobSchema.index({ project_id: 1, created_at: -1 });
//# sourceMappingURL=report-job.schema.js.map