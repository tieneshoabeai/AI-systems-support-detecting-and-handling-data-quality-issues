"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMemberRecord = toMemberRecord;
exports.toWorkspaceRecord = toWorkspaceRecord;
exports.toMemberPersistence = toMemberPersistence;
const mongoose_1 = require("mongoose");
function toMemberRecord(m) {
    return {
        userId: m.user_id.toString(),
        role: m.role,
        joinedAt: m.joined_at,
    };
}
function toWorkspaceRecord(doc) {
    return {
        id: doc._id.toString(),
        name: doc.name,
        description: doc.description ?? '',
        ownerId: doc.owner_id.toString(),
        members: (doc.members ?? []).map(toMemberRecord),
        storageUsedBytes: doc.storage_used_bytes ?? 0,
        lastAccessedAt: doc.last_accessed_at ?? null,
        version: doc.version ?? 1,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toMemberPersistence(m) {
    return {
        user_id: new mongoose_1.Types.ObjectId(m.userId),
        role: m.role,
        joined_at: m.joinedAt,
    };
}
//# sourceMappingURL=workspace.mapper.js.map