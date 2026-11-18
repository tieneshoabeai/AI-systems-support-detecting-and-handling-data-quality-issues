import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { NotificationsService } from '../../application/notifications.service';
import { ListNotificationsQueryDto } from './dtos/list-notifications-query.dto';
import { UpdateNotificationPreferencesDto } from './dtos/update-preferences.dto';
export declare class NotificationsController {
    private readonly notificationsService;
    constructor(notificationsService: NotificationsService);
    listNotifications(user: CurrentUserPayload, query: ListNotificationsQueryDto): Promise<{
        items: Record<string, unknown>[];
        meta: {
            nextCursor: string | null;
            hasMore: boolean;
        };
        unreadCount: number;
    }>;
    getUnreadCount(user: CurrentUserPayload): Promise<{
        unreadCount: number;
    }>;
    getDetail(user: CurrentUserPayload, id: string): Promise<Record<string, unknown>>;
    markAsRead(user: CurrentUserPayload, id: string): Promise<Record<string, unknown>>;
    updatePreferences(user: CurrentUserPayload, dto: UpdateNotificationPreferencesDto): Promise<{
        notificationsEnabled: boolean;
    }>;
}
