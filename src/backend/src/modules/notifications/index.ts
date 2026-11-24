/** Public contract cua module NOTIFICATIONS (Template Simple). */
export {
  NOTIFICATION_REPOSITORY_PORT,
  type CreateNotificationRecord,
  type Notification,
  type NotificationDispatch,
  type NotificationListQuery,
  type NotificationPayload,
  type NotificationRepositoryPort,
  type NotificationType,
  NOTIFICATION_TYPES,
  MANDATORY_NOTIFICATION_TYPES,
  isMandatoryNotification,
  shouldDispatch,
  NOTIFICATION_EVENTS,
  type NotificationEventName,
  type NotificationProps,
  MAX_TITLE_LENGTH,
  MAX_SUMMARY_LENGTH,
  type ListNotificationsInput,
  type DispatchNotificationInput,
} from './notifications.types';
export { NotificationsService } from './notifications.service';
export { NotificationsRepository } from './notifications.repository';
export {
  ListNotificationsQuerySchema,
  UpdateNotificationPreferencesSchema,
  type ListNotificationsQueryDto,
  type UpdateNotificationPreferencesDto,
} from './notifications.controller';
export {
  dispatchNotificationViaPorts,
  type DispatchViaPortsInput,
} from './notification-dispatch.util';
