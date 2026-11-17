export declare const NOTIFICATION_EVENTS: {
    readonly CREATED: 'notification.created';
    readonly READ: 'notification.read';
};
export type NotificationEventName = (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];
