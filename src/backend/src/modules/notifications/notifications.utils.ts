/** NOTIFICATIONS — Utils (Template Simple). Ham thuan toResponse, nhan entity Notification. */
import type { Notification } from './notifications.types';

/** Shape tra ve cho client — giu nguyen hop dong cu (camelCase). */
export function toResponse(doc: Notification): Record<string, unknown> {
  return {
    id: doc.id,
    userId: doc.userId,
    type: doc.type,
    isMandatory: doc.isMandatory,
    title: doc.title,
    summary: doc.summary ?? null,
    payload: doc.payload ?? null,
    sourceEventId: doc.sourceEventId ?? null,
    readAt: doc.readAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
