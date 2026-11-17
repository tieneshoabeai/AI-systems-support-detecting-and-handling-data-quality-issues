"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FewShotExampleSchema = void 0;
const mongoose_1 = require("mongoose");
exports.FewShotExampleSchema = new mongoose_1.Schema({
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    error_type: { type: String, required: true, index: true },
    column_traits: { type: String, required: true },
    description: { type: String, required: true },
    label: {
        type: String,
        enum: ['correct', 'false_positive', 'missed_issue'],
        required: true,
    },
    embedding: { type: [Number], required: true },
    trust_score: { type: Number, required: true, default: 0.6, min: 0, max: 1 },
    language: { type: String, required: true, default: 'vi' },
    agreement_count: { type: Number, required: true, default: 0, min: 0 },
    deleted_at: { type: Date, default: null, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
exports.FewShotExampleSchema.index({ workspace_id: 1, error_type: 1, created_at: -1 });
exports.FewShotExampleSchema.index({ workspace_id: 1, language: 1, trust_score: -1 });
//# sourceMappingURL=few-shot-example.schema.js.map