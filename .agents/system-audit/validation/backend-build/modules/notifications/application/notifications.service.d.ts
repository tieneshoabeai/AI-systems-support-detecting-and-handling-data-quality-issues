import { type NotificationRecord, type NotificationRepositoryPort } from '../domain/ports/notification.repository.port';
import { type NotificationType } from '../domain/value-objects/notification-type.vo';
import { type UserRepositoryPort } from '../../users/domain/ports/user.repository.port';
import { type RealtimePort } from '../../realtime/domain/ports/realtime.port';
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
    payload?: {
        targetType?: string | null;
        targetId?: string | null;
        actionUrl?: string | null;
    };
    sourceEventId?: string | null;
    isMandatory?: boolean;
}
export declare class NotificationsService {
    private readonly repo;
    private readonly users;
    private readonly realtime?;
    constructor(repo: NotificationRepositoryPort, users: UserRepositoryPort, realtime?: RealtimePort | undefined);
    listForUser(userId: string, query: ListNotificationsInput): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
        unreadCount: number;
    }>;
    countUnread(userId: string): Promise<{
        unreadCount: number;
    }>;
    getDetail(userId: string, id: string): Promise<Record<string, unknown>>;
    markAsRead(userId: string, id: string): Promise<Record<string, unknown>>;
    updatePreferences(userId: string, enabled: boolean): Promise<{
        notificationsEnabled: boolean;
    }>;
    dispatch(params: DispatchNotificationInput): Promise<NotificationRecord | null>;
}
