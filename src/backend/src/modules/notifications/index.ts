/**
 * Public contract của module NOTIFICATIONS.
 *
 * Các module khác chỉ được import qua file này (quy tắc CA8 — cross-module
 * import phải đi qua public contract), không import sâu vào
 * `domain/ports/...` hay `application/...`.
 */

export {
  NOTIFICATION_REPOSITORY_PORT,
  type CreateNotificationRecord,
  type Notification,
  type NotificationDispatch,
  type NotificationListQuery,
  type NotificationPayload,
  type NotificationRepositoryPort,
} from './domain/ports/notification.repository.port';

// ── Entities (Bước 3 — Rich Domain Model) ──────────────────────
export {
  Notification as NotificationEntity,
  MAX_SUMMARY_LENGTH,
  MAX_TITLE_LENGTH,
  type NotificationProps,
} from './domain/entities/notification.entity';

export {
  MANDATORY_NOTIFICATION_TYPES,
  NOTIFICATION_TYPES,
  isMandatoryNotification,
  shouldDispatch,
  type NotificationType,
} from './domain/value-objects/notification-type.vo';

// ── Handlers (Command/Query) ──────────────────────────
// ── Queries (đọc) ──────────────────────────────────────────────
export { CountUnreadHandler } from './application/queries/count-unread.handler';
export { GetDetailHandler } from './application/queries/get-detail.handler';
export { ListForUserHandler } from './application/queries/list-for-user.handler';

// ── Commands (ghi) ─────────────────────────────────────────────
export { DispatchHandler } from './application/commands/dispatch.handler';
export { MarkAsReadHandler } from './application/commands/mark-as-read.handler';
export { UpdatePreferencesHandler } from './application/commands/update-preferences.handler';
