/**
 * NOTIFICATIONS — Hàm thuần dùng chung cho handlers.
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 *
 * **Bước 3 — Rich Domain Model:** `toResponse()` nhận **entity** `Notification`
 * và ánh xạ chủ động từng field — đảm bảo không lọt field nội bộ.
 */

import type { Notification } from '../domain/entities/notification.entity';

/** Shape trả về cho client — giữ nguyên hợp đồng cũ (camelCase). */
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
