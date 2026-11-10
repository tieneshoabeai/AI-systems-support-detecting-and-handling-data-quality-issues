import { Inject, Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type CreateNotificationRecord,
  type NotificationRecord,
  type NotificationRepositoryPort,
} from '../domain/ports/notification.repository.port';
import { isMandatoryNotification, shouldDispatch, type NotificationType } from '../domain/value-objects/notification-type.vo';
import {
  USER_REPOSITORY_PORT,
  type UserRepositoryPort,
} from '../../users/domain/ports/user.repository.port';
import {
  REALTIME_PORT,
  type RealtimePort,
} from '../../realtime/domain/ports/realtime.port';
import { CursorCodec } from '../../../shared/pagination/cursor-codec';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';

/** Application input — controller map DTO sang (cùng shape, không import infrastructure). */
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

function toResponse(doc: NotificationRecord): Record<string, unknown> {
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

/**
 * NOTIFICATIONS — Application orchestrator.
 * Chỉ phụ thuộc domain ports (NOTIFICATION_REPOSITORY / USER_REPOSITORY / REALTIME).
 * Không import Mongoose, schema, repository cụ thể, DTO http.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly repo: NotificationRepositoryPort,
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Optional() @Inject(REALTIME_PORT)
    private readonly realtime?: RealtimePort,
  ) {}

  async listForUser(
    userId: string,
    query: ListNotificationsInput,
  ): Promise<{ items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean }; unreadCount: number }> {
    let cursorCreatedAt: Date | undefined;
    let cursorId: string | undefined;
    if (query.cursor) {
      const decoded = CursorCodec.decode<{ createdAt?: string; id?: string }>(query.cursor);
      if (!decoded || !decoded.createdAt || !decoded.id || !isObjectIdHex(decoded.id)) {
        throw new BadRequestException('Cursor không hợp lệ');
      }
      const d = new Date(decoded.createdAt);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('Cursor không hợp lệ');
      cursorCreatedAt = d;
      cursorId = decoded.id;
    }
    const docs = await this.repo.listForUser(userId, {
      read: query.read,
      limit: query.limit,
      cursorCreatedAt,
      cursorId,
      sortOrder: query.sortOrder,
    });
    const hasMore = docs.length > query.limit;
    const page = hasMore ? docs.slice(0, query.limit) : docs;
    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1] as NotificationRecord;
      nextCursor = CursorCodec.encode({
        createdAt: (last.createdAt as Date).toISOString(),
        id: last.id,
      });
    }
    const unreadCount = await this.repo.countUnread(userId);
    return { items: page.map(toResponse), meta: { nextCursor, hasMore }, unreadCount };
  }

  async countUnread(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.repo.countUnread(userId);
    return { unreadCount };
  }

  async getDetail(userId: string, id: string): Promise<Record<string, unknown>> {
    const doc = await this.repo.findByIdForUser(id, userId);
    if (!doc) throw new NotFoundException('Không tìm thấy thông báo');
    if (!doc.readAt) {
      const updated = await this.repo.markAsRead(id, userId);
      return toResponse(updated ?? doc);
    }
    return toResponse(doc);
  }

  async markAsRead(userId: string, id: string): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundException('Không tìm thấy thông báo');
    const updated = await this.repo.markAsRead(id, userId);
    if (!updated) throw new NotFoundException('Không tìm thấy thông báo');
    return toResponse(updated);
  }

  async updatePreferences(userId: string, enabled: boolean): Promise<{ notificationsEnabled: boolean }> {
    const ok = await this.users.updateNotificationPreferences(userId, enabled);
    if (!ok) throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    return { notificationsEnabled: enabled };
  }

  async dispatch(params: DispatchNotificationInput): Promise<NotificationRecord | null> {
    const user = await this.users.findById(params.userId);
    const enabled = user ? user.notificationsEnabled : undefined;
    const mandatory = isMandatoryNotification(params.type, params.isMandatory === true);
    if (!shouldDispatch(enabled, mandatory)) return null;
    const doc: CreateNotificationRecord = {
      userId: params.userId,
      type: params.type,
      title: params.title.trim().slice(0, 200),
      summary: params.summary ? params.summary.slice(0, 500) : null,
      payload: (params.payload as Record<string, unknown> | undefined) ?? null,
      sourceEventId: params.sourceEventId ?? null,
      isMandatory: mandatory,
    };
    const created = await this.repo.createIfEventNotExists(doc);
    if (created) {
      try {
        this.realtime?.emitToUser(params.userId, 'notification.created', {
          notificationId: created.id,
          notificationType: created.type,
        });
      } catch {
        // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
      }
    }
    return created;
  }
}
