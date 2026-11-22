/**
 * DispatchHandler — Use case: `dispatch()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * Kênh phân phối (Phần 9 v3 §3.5.5):
 *   1. In-app  — ghi vào collection `notification` (luôn thực hiện).
 *   2. Realtime — đẩy qua Socket.IO (luôn thực hiện nếu có transport).
 *   3. Email   — gửi qua SMTP (bỏ qua nếu chưa cấu hình).
 *   4. Push    — gửi qua ntfy (bỏ qua nếu chưa cấu hình).
 *
 * Quy tắc bắt buộc:
 *   - Email bắt buộc gửi **bất kể** công tắc `notifications_enabled` (§3.5.5 quy tắc 4).
 *   - Lỗi gửi email/push **không** làm fail thao tác chính (§3.5.5 quy tắc 3).
 *   - KHÔNG log nội dung email (§3.5.5 quy tắc 2).
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type CreateNotificationRecord,
  type NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';
import {
  Notification,
  type Notification as NotificationEntity,
} from '../../domain/entities/notification.entity';
import { newObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import {
  isMandatoryNotification,
  shouldDispatch,
} from '../../domain/value-objects/notification-type.vo';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { REALTIME_PORT, type RealtimePort } from '../../../realtime';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '../../../../shared/application/ports/email.port';
import { PUSH_SENDER_PORT, type PushSenderPort } from '../../../../shared/application/ports/push.port';
import { DispatchNotificationInput } from '../notifications.types';
import {
  buildNotificationEmail,
  type NotificationEmailContext,
} from '../notification-email.mapper';

@Injectable()
export class DispatchHandler {
  private readonly logger = new Logger(DispatchHandler.name);
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

  async execute(params: DispatchNotificationInput): Promise<NotificationEntity | null> {
    const user = await this.users.findById(params.userId);
    const enabled = user ? user.notificationsEnabled : undefined;
    const mandatory = isMandatoryNotification(params.type, params.isMandatory === true);
    if (!shouldDispatch(enabled, mandatory)) return null;

    // Entity kiểm tra invariant: loại hợp lệ, title ≤ 200, summary ≤ 500.
    const entity = Notification.create({
      id: newObjectIdHex(),
      userId: params.userId,
      type: params.type,
      title: params.title,
      summary: params.summary ?? null,
      payload: (params.payload as NotificationEntity['payload'] | undefined) ?? null,
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
        // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
      }
      // Kênh ngoài (email/push) chạy song song — lỗi không ảnh hưởng luồng chính.
      void this.dispatchExternalChannels(params, created, user?.email ?? null);
    }
    return created;
  }

  /**
   * Gửi email + push cho một thông báo vừa tạo.
   *
   * Chạy ở chế độ fire-and-forget: mọi lỗi bị nuốt và chỉ ghi log cảnh báo.
   */
  private async dispatchExternalChannels(
    params: DispatchNotificationInput,
    created: NotificationEntity,
    userEmail: string | null,
  ): Promise<void> {
    const ctx: NotificationEmailContext = {
      appUrl: this.appUrl(),
      issueTitle: params.payload?.targetType === 'issue' ? params.title : null,
    };

    // ── Kênh email ────────────────────────────────────────────────────────
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

    // ── Kênh push (ntfy) ──────────────────────────────────────────────────
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

  /** URL gốc của ứng dụng web — dùng cho link trong email. */
  private appUrl(): string {
    const configured = process.env.APP_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');
    const cors = process.env.CORS_ORIGIN?.trim();
    if (cors) return cors.replace(/\/+$/, '');
    return 'http://localhost:5173';
  }
}
