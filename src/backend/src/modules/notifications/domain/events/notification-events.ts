export const NOTIFICATION_EVENTS = {
  CREATED: 'notification.created',
  READ: 'notification.read',
} as const;

export type NotificationEventName = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];
