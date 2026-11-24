/** NOTIFICATIONS — Service (Template Simple). Gop 6 handler thanh NotificationsService. Giu nguyen logic + thu tu tham so. */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type CreateNotificationRecord,
  type Notification as NotificationEntityType,
  type NotificationRepositoryPort,
} from './notifications.types';
import {
  Notification,
  isMandatoryNotification,
  shouldDispatch,
  type DispatchNotificationInput,
  type ListNotificationsInput,
} from './notifications.types';
import { newObjectIdHex } from '../../shared/domain/utils/object-id.util';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../users';
import { REALTIME_PORT, type RealtimePort } from '../realtime';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '../../shared/application/ports/email.port';
import { PUSH_SENDER_PORT, type PushSenderPort } from '../../shared/application/ports/push.port';
import { CursorCodec } from '../../shared/domain/pagination/cursor-codec';
import { isObjectIdHex } from '../../shared/domain/utils/object-id.util';
import { NotFoundError, ValidationError } from '../../shared/domain/errors';
import { toResponse } from './notifications.utils';
import {
  buildNotificationEmail,
  type NotificationEmailContext,
} from './notification-email.mapper';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly repo: NotificationRepositoryPort,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
    @Optional()
    @Inject(EMAIL_SENDER_PORT)
    private readonly email: EmailSenderPort,
    @Optional()
    @Inject(PUSH_SENDER_PORT)
    private readonly push: PushSenderPort,
  ) {}

  async dispatch(params: DispatchNotificationInput): Promise<NotificationEntityType | null> {
    const user = await this.users.findById(params.userId);
    const enabled = user ? user.notificationsEnabled : undefined;
    const mandatory = isMandatoryNotification(params.type, params.isMandatory === true);
    if (!shouldDispatch(enabled, mandatory)) return null;

    // Entity kiem tra invariant: loai hop le, title <= 200, summary <= 500.
    const entity = Notification.create({
      id: newObjectIdHex(),
      userId: params.userId,
      type: params.type,
      title: params.title,
      summary: params.summary ?? null,
      payload: (params.payload as NotificationEntityType['payload'] | undefined) ?? null,
      sourceEventId: params.sourceEventId ?? null,
      isMandatory: mandatory,
    });

    const doc: CreateNotificationRecord = {
      userId: entity.userId,
      type: entity.type,
      title: entity.title,
      summary: entity.summary,
      payload: entity.payload,
      sourceEventId: entity.sourceEventId,
      isMandatory: entity.isMandatory,
    };
    const created = await this.repo.createIfEventNotExists(doc);
    if (created) {
      try {
        this.realtime?.emitToUser(params.userId, 'notification.created', {
          notificationId: created.id,
          notificationType: created.type,
        });
      } catch {
        // realtime khong bao gio lam hong luong nghiep vu chinh
      }
      // Kenh ngoai (email/push) chay song song — loi khong anh huong luong chinh.
      void this.dispatchExternalChannels(params, created, user?.email ?? null);
    }
    return created;
  }

  async markAsRead(userId: string, id: string): Promise<Record<string, unknown>> {
    const existing = await this.repo.findByIdForUser(id, userId);
    if (!existing) throw new NotFoundError('Không tìm thấy thông báo');
    // Idempotent: danh dau da doc 2 lan van tra ve cung ket qua (PATCH).
    // Entity van bao ve invariant "doc 1 lan" — handler chi goi khi chua doc.
    if (existing.isRead()) {
      return toResponse(existing);
    }
    existing.markAsRead();
    const updated = await this.repo.markAsRead(id, userId);
    if (!updated) throw new NotFoundError('Không tìm thấy thông báo');
    return toResponse(updated);
  }

  async updatePreferences(userId: string, enabled: boolean): Promise<{ notificationsEnabled: boolean }> {
    const ok = await this.users.updateNotificationPreferences(userId, enabled);
    if (!ok) throw new NotFoundError('Không tìm thấy tài khoản người dùng');
    return { notificationsEnabled: enabled };
  }

  async countUnread(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.repo.countUnread(userId);
    return { unreadCount };
  }

  async getDetail(userId: string, id: string): Promise<Record<string, unknown>> {
    const doc = await this.repo.findByIdForUser(id, userId);
    if (!doc) throw new NotFoundError('Không tìm thấy thông báo');
    if (doc.isUnread()) {
      const updated = await this.repo.markAsRead(id, userId);
      return toResponse(updated ?? doc);
    }
    return toResponse(doc);
  }

  async listForUser(
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
      const last = page[page.length - 1] as NotificationEntityType;
      nextCursor = CursorCodec.encode({
        createdAt: (last.createdAt as Date).toISOString(),
        id: last.id,
      });
    }
    const unreadCount = await this.repo.countUnread(userId);
    return { items: page.map(toResponse), meta: { nextCursor, hasMore }, unreadCount };
  }

  /**
   * Gui email + push cho mot thong bao vua tao.
   *
   * Chay o che do fire-and-forget: moi loi bi nuot va chi ghi log canh bao.
   */
  private async dispatchExternalChannels(
    params: DispatchNotificationInput,
    created: NotificationEntityType,
    userEmail: string | null,
  ): Promise<void> {
    const ctx: NotificationEmailContext = {
      appUrl: this.appUrl(),
      issueTitle: params.payload?.targetType === 'issue' ? params.title : null,
    };

    // ── Kenh email ────────────────────────────────────────────────────────
    if (this.email?.isConfigured() && userEmail) {
      try {
        const draft = buildNotificationEmail(
          params.type,
          created.title,
          created.summary ?? null,
          ctx,
        );
        if (draft) {
          const ok = await this.email.send({
            to: userEmail,
            template: draft.template,
            subject: draft.subject,
            html: draft.html,
            text: draft.text,
          });
          if (!ok) {
            this.logger.warn(
              `Gửi email thông báo [${params.type}] tới ${userEmail} không thành công.`,
            );
          }
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Lỗi khi gửi email thông báo [${params.type}]: ${msg}`);
      }
    }

    // ── Kenh push (ntfy) ──────────────────────────────────────────────────
    if (this.push?.isConfigured()) {
      try {
        const priority = params.isMandatory || created.isMandatory ? 'high' : 'default';
        await this.push.send({
          title: created.title,
          body: created.summary ?? created.title,
          priority,
          tags: [params.type],
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Lỗi khi gửi push thông báo [${params.type}]: ${msg}`);
      }
    }
  }

  /** URL goc cua ung dung web — dung cho link trong email. */
  private appUrl(): string {
    const configured = process.env.APP_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');
    const cors = process.env.CORS_ORIGIN?.trim();
    if (cors) return cors.replace(/\/+$/, '');
    return 'http://localhost:5173';
  }
}
