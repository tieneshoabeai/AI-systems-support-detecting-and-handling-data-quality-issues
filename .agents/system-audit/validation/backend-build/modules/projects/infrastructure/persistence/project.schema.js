"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSchema = exports.ProjectMemberSchema = void 0;
const mongoose_1 = require("mongoose");
exports.ProjectMemberSchema = new mongoose_1.Schema({
    user_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member', 'viewer'], required: true, default: 'viewer' },
    joined_at: { type: Date, default: Date.now },
}, { _id: false });
exports.ProjectSchema = new mongoose_1.Schema({
    workspace_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    has_dataset: { type: Boolean, required: true, default: false, index: true },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed'],
        required: true,
        default: 'not_started',
        index: true,
    },
    members: { type: [exports.ProjectMemberSchema], default: [] },
    last_accessed_at: { type: Date, default: null, index: true },
    created_by: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    deleted_at: { type: Date, default: null, index: true },
    version: { type: Number, required: true, default: 1 },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.ProjectSchema.index({ workspace_id: 1, deleted_at: 1 });
exports.ProjectSchema.index({ workspace_id: 1, name: 1, deleted_at: 1 });
exports.ProjectSchema.index({ workspace_id: 1, deleted_at: 1, last_accessed_at: -1 });
exports.ProjectSchema.index({ status: 1, deleted_at: 1 });
//# sourceMappingURL=project.schema.js.map