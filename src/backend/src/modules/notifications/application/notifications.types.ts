/**
 * NOTIFICATIONS — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

import { type NotificationType } from '../domain/value-objects/notification-type.vo';

export interface ListNotificationsInput {
  cursor?: string;
  limit: number;
  sortOrder: 'asc' | 'desc';
  read: 'true' | 'false' | 'all';
}

export interface DispatchNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  summary?: string | null;
  payload?: { targetType?: string | null; targetId?: string | null; actionUrl?: string | null };
  sourceEventId?: string | null;
  isMandatory?: boolean;
}
