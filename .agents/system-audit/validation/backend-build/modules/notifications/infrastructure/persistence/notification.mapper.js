"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNotificationRecord = toNotificationRecord;
exports.toNotificationPersistence = toNotificationPersistence;
const mongoose_1 = require("mongoose");
function toNotificationRecord(doc) {
    return {
        id: doc._id.toString(),
        userId: doc.user_id.toString(),
        type: doc.type,
        title: doc.title,
        summary: doc.summary ?? null,
        payload: doc.payload ?? null,
        sourceEventId: doc.source_event_id ?? null,
        isMandatory: doc.is_mandatory ?? false,
        readAt: doc.read_at ?? null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toNotificationPersistence(data) {
    return {
        user_id: new mongoose_1.Types.ObjectId(data.userId),
        type: data.type,
        title: data.title.trim().slice(0, 200),
        summary: data.summary ? data.summary.slice(0, 500) : null,
        payload: data.payload ?? undefined,
        source_event_id: data.sourceEventId ?? null,
        is_mandatory: data.isMandatory,
        read_at: null,
    };
}
//# sourceMappingURL=notification.mapper.js.map