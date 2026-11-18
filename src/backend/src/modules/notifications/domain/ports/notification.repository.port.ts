/**
 * NOTIFICATION — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này.
 *
 * **Bước 3 — Rich Domain Model:** port trả **entity** `Notification`
 * (không phải record trần) → handler có thể gọi hành vi của entity
 * (`markAsRead()`, `isUnread()`, …).
 */

import type { Notification } from '../entities/notification.entity';
import type { NotificationPayload } from '../entities/notification.entity';
import type { NotificationType } from '../value-objects/notification-type.vo';

export const NOTIFICATION_REPOSITORY_PORT = Symbol('NotificationRepositoryPort');

export type { Notification, NotificationPayload } from '../entities/notification.entity';

export interface NotificationListQuery {
  read: 'true' | 'false' | 'all';
  limit: number;
  cursorCreatedAt?: Date;
  cursorId?: string;
  sortOrder: 'asc' | 'desc';
}

export interface NotificationDispatch {
  userId: string;
  type: NotificationType;
  title: string;
}

export interface CreateNotificationRecord {
  userId: string;
  type: string;
  title: string;
  summary?: string | null;
  payload?: NotificationPayload | null;
  sourceEventId?: string | null;
  isMandatory: boolean;
  expiresAt?: Date | null;
}

export interface NotificationRepositoryPort {
  create(doc: CreateNotificationRecord): Promise<Notification>;
  findByIdForUser(id: string, userId: string): Promise<Notification | null>;
  listForUser(userId: string, opts: NotificationListQuery): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<Notification | null>;
  /** Tạo thông báo chỉ khi `sourceEventId` chưa tồn tại (idempotency). */
  createIfEventNotExists(doc: CreateNotificationRecord): Promise<Notification | null>;
  existsByEvent(userId: string, sourceEventId: string): Promise<boolean>;
}
