/**
 * DispatchHandler — Use case: `dispatch()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type CreateNotificationRecord,
  type NotificationRecord,
  type NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';
import {
  isMandatoryNotification,
  shouldDispatch,
} from '../../domain/value-objects/notification-type.vo';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { REALTIME_PORT, type RealtimePort } from '../../../realtime';
import { DispatchNotificationInput } from '../notifications.types';

@Injectable()
export class DispatchHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(NOTIFICATION_REPOSITORY_PORT)
    private readonly repo: NotificationRepositoryPort,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
  ) {}

  async execute(params: DispatchNotificationInput): Promise<NotificationRecord | null> {
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
