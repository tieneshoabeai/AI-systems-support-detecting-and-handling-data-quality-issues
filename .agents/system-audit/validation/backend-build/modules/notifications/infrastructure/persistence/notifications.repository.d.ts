import { Model } from 'mongoose';
import { INotification } from './notification.schema';
import { type CreateNotificationRecord, type NotificationListQuery, type NotificationRecord, type NotificationRepositoryPort } from '../../domain/ports/notification.repository.port';
export declare class NotificationsRepository implements NotificationRepositoryPort {
    private readonly model;
    constructor(model: Model<INotification>);
    create(doc: CreateNotificationRecord): Promise<NotificationRecord>;
    findByIdForUser(id: string, userId: string): Promise<NotificationRecord | null>;
    listForUser(userId: string, opts: NotificationListQuery): Promise<NotificationRecord[]>;
    countUnread(userId: string): Promise<number>;
    markAsRead(id: string, userId: string): Promise<NotificationRecord | null>;
    createIfEventNotExists(doc: CreateNotificationRecord): Promise<NotificationRecord | null>;
    existsByEvent(userId: string, sourceEventId: string): Promise<boolean>;
}
