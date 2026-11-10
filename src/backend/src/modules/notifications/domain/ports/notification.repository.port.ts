/**
 * NOTIFICATION — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này.
 */

import type { NotificationType } from '../value-objects/notification-type.vo';

export const NOTIFICATION_REPOSITORY_PORT = Symbol('NotificationRepositoryPort');

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  sourceEventId?: string | null;
  isMandatory: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
  payload?: Record<string, unknown> | null;
  sourceEventId?: string | null;
  isMandatory: boolean;
}

export interface NotificationRepositoryPort {
  create(doc: CreateNotificationRecord): Promise<NotificationRecord>;
  findByIdForUser(id: string, userId: string): Promise<NotificationRecord | null>;
  listForUser(userId: string, opts: NotificationListQuery): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<NotificationRecord | null>;
  createIfEventNotExists(doc: CreateNotificationRecord): Promise<NotificationRecord | null>;
  existsByEvent(userId: string, sourceEventId: string): Promise<boolean>;
}
