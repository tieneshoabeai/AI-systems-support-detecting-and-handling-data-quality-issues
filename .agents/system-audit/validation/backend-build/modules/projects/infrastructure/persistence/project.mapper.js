"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toProjectRecord = toProjectRecord;
exports.toMemberPersistence = toMemberPersistence;
const mongoose_1 = require("mongoose");
function toProjectRecord(doc) {
    return {
        id: doc._id.toString(),
        workspaceId: doc.workspace_id.toString(),
        name: doc.name,
        description: doc.description ?? '',
        hasDataset: doc.has_dataset ?? false,
        status: doc.status,
        members: (doc.members ?? []).map((m) => ({
            userId: m.user_id.toString(),
            role: m.role,
            joinedAt: m.joined_at,
        })),
        lastAccessedAt: doc.last_accessed_at ?? null,
        version: doc.version ?? 1,
        createdBy: doc.created_by.toString(),
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toMemberPersistence(m) {
    return { user_id: new mongoose_1.Types.ObjectId(m.userId), role: m.role, joined_at: m.joinedAt };
}
//# sourceMappingURL=project.mapper.js.map