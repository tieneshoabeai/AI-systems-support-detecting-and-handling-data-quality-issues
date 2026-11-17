"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFeedbackRecord = toFeedbackRecord;
exports.toFeedbackPersistence = toFeedbackPersistence;
const mongoose_1 = require("mongoose");
function oid(v) {
    if (v instanceof mongoose_1.Types.ObjectId)
        return v.toString();
    return String(v ?? '');
}
function toFeedbackRecord(doc) {
    const raw = doc;
    return {
        id: oid(doc._id),
        analysisRunId: oid(doc.analysis_run_id),
        projectId: oid(doc.project_id),
        workspaceId: oid(doc.workspace_id),
        findingId: doc.finding_id ?? null,
        findingKey: raw.finding_key ?? null,
        authorId: oid(doc.author_id),
        label: doc.label,
        reason: doc.reason ?? null,
        suggestedSeverity: doc.suggested_severity ?? null,
        aiConfidence: doc.ai_confidence ?? null,
        aiRationale: doc.ai_rationale ?? null,
        authorRoleAtTime: doc.author_role_at_time ?? null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toFeedbackPersistence(data) {
    return {
        analysis_run_id: new mongoose_1.Types.ObjectId(data.analysisRunId),
        project_id: new mongoose_1.Types.ObjectId(data.projectId),
        workspace_id: new mongoose_1.Types.ObjectId(data.workspaceId),
        finding_id: data.findingId,
        finding_key: data.findingKey ?? null,
        author_id: new mongoose_1.Types.ObjectId(data.authorId),
        label: data.label,
        reason: data.reason ?? null,
        suggested_severity: data.suggestedSeverity ?? null,
        ai_confidence: data.aiConfidence ?? null,
        ai_rationale: data.aiRationale ?? null,
        author_role_at_time: data.authorRoleAtTime ?? null,
    };
}
//# sourceMappingURL=feedback.mapper.js.map