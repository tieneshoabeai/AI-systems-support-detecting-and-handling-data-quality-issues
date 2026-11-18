/**
 * ListForUserHandler — Use case: `listForUser()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';
import type { Notification } from '../../domain/entities/notification.entity';
import { CursorCodec } from '../../../../shared/domain/pagination/cursor-codec';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { ListNotificationsInput } from '../notifications.types';
import { toResponse } from '../notifications.utils';
import { ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class ListForUserHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly repo: NotificationRepositoryPort,
  ) {}

  async execute(
    userId: string,
    query: ListNotificationsInput,
  ): Promise<{
    items: Record<string, unknown>[];
    meta: { nextCursor: string | null; hasMore: boolean };
    unreadCount: number;
  }> {
    let cursorCreatedAt: Date | undefined;
    let cursorId: string | undefined;
    if (query.cursor) {
      const decoded = CursorCodec.decode<{ createdAt?: string; id?: string }>(query.cursor);
      if (!decoded || !decoded.createdAt || !decoded.id || !isObjectIdHex(decoded.id)) {
        throw new ValidationError('Cursor không hợp lệ');
      }
      const d = new Date(decoded.createdAt);
      if (Number.isNaN(d.getTime())) throw new ValidationError('Cursor không hợp lệ');
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
      const last = page[page.length - 1] as Notification;
      nextCursor = CursorCodec.encode({
        createdAt: (last.createdAt as Date).toISOString(),
        id: last.id,
      });
    }
    const unreadCount = await this.repo.countUnread(userId);
    return { items: page.map(toResponse), meta: { nextCursor, hasMore }, unreadCount };
  }
}
