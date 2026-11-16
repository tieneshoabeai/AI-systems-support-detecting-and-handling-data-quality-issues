/**
 * NOTIFICATIONS — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 */

import { type NotificationRecord } from '../domain/ports/notification.repository.port';

export function toResponse(doc: NotificationRecord): Record<string, unknown> {
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
