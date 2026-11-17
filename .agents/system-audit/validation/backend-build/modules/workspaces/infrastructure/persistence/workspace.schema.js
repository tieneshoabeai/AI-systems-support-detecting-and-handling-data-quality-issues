"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceSchema = exports.WorkspaceMemberSchema = void 0;
const mongoose_1 = require("mongoose");
exports.WorkspaceMemberSchema = new mongoose_1.Schema({
    user_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], required: true, default: 'member' },
    joined_at: { type: Date, default: Date.now },
}, { _id: false });
exports.WorkspaceSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    owner_id: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [exports.WorkspaceMemberSchema], default: [] },
    storage_used_bytes: { type: Number, required: true, default: 0 },
    last_accessed_at: { type: Date, default: null, index: true },
    deleted_at: { type: Date, default: null, index: true },
    version: { type: Number, required: true, default: 1 },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});
exports.WorkspaceSchema.index({ owner_id: 1, deleted_at: 1 });
exports.WorkspaceSchema.index({ 'members.user_id': 1, deleted_at: 1 });
exports.WorkspaceSchema.index({ name: 1 });
exports.WorkspaceSchema.index({ last_accessed_at: -1, deleted_at: 1 });
//# sourceMappingURL=workspace.schema.js.map