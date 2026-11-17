"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetSchema = exports.ColumnIssueSchema = exports.ColumnDefinitionSchema = void 0;
const mongoose_1 = require("mongoose");
exports.ColumnDefinitionSchema = new mongoose_1.Schema({
    key: { type: String, required: true },
    index: { type: Number, required: true },
    name: { type: String, required: true },
    data_type: {
        type: String,
        enum: ['string', 'number', 'boolean', 'date'],
        required: true,
        default: 'string',
    },
    original_name: { type: String, required: true },
    missing_count: { type: Number, required: true, default: 0 },
    is_pii: { type: Boolean, required: true, default: false },
}, { _id: false });
exports.ColumnIssueSchema = new mongoose_1.Schema({
    column_key: { type: String, default: null },
    issue: {
        type: String,
        enum: ['empty_name', 'duplicate_name', 'whitespace_only'],
        required: true,
    },
    message: { type: String, required: true },
}, { _id: false });
exports.DatasetSchema = new mongoose_1.Schema({
    project_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    original_file_name: { type: String, required: true },
    file_format: { type: String, enum: ['csv'], required: true, default: 'csv' },
    file_size_bytes: { type: Number, required: true, default: 0 },
    file_checksum: { type: String, required: true, index: true },
    storage_key: { type: String, required: true },
    row_count: { type: Number, required: true, default: 0 },
    column_count: { type: Number, required: true, default: 0 },
    columns: { type: [exports.ColumnDefinitionSchema], default: [] },
    column_issues: { type: [exports.ColumnIssueSchema], default: [] },
    has_header: { type: Boolean, default: true },
    delimiter: { type: String, enum: [',', ';', '\t', '|'], default: ',' },
    current_version: { type: Number, required: true, default: 1 },
    status: {
        type: String,
        enum: ['INGESTING', 'READY', 'FAILED'],
        required: true,
        default: 'INGESTING',
        index: true,
    },
    deleted_at: { type: Date, default: null, index: true },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.DatasetSchema.index({ project_id: 1, deleted_at: 1 });
exports.DatasetSchema.index({ workspace_id: 1, deleted_at: 1 });
//# sourceMappingURL=dataset.schema.js.map