"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIssueRecord = toIssueRecord;
exports.toIssuePersistence = toIssuePersistence;
const mongoose_1 = require("mongoose");
function toIssueRecord(doc) {
    return {
        id: doc._id.toString(),
        userId: doc.user_id.toString(),
        workspaceId: doc.workspace_id ? doc.workspace_id.toString() : null,
        issueType: doc.issue_type,
        title: doc.title,
        description: doc.description,
        status: doc.status,
        attachments: (doc.attachments ?? []).map((a) => ({
            id: a.id.toString(),
            filename: a.filename,
            storageKey: a.storage_key,
            sizeBytes: a.size_bytes,
            contentType: a.content_type,
        })),
        context: doc.context
            ? { apiPath: doc.context.api_path ?? null, errorMessage: doc.context.error_message ?? null, occurredAt: doc.context.occurred_at ?? null }
            : null,
        version: doc.version,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toIssuePersistence(data) {
    return {
        user_id: new mongoose_1.Types.ObjectId(data.userId),
        workspace_id: data.workspaceId ? new mongoose_1.Types.ObjectId(data.workspaceId) : null,
        issue_type: data.issueType,
        title: data.title.trim(),
        description: data.description.trim(),
        status: 'new',
        attachments: [],
        context: data.context
            ? { api_path: data.context.apiPath ?? null, error_message: data.context.errorMessage ?? null, occurred_at: data.context.occurredAt ?? null }
            : undefined,
        version: 1,
        deleted_at: null,
    };
}
//# sourceMappingURL=issue.mapper.js.map