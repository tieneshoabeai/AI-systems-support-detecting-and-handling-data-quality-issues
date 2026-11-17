import type { INotification } from './notification.schema';
import type { CreateNotificationRecord, NotificationRecord } from '../../domain/ports/notification.repository.port';
export declare function toNotificationRecord(doc: INotification): NotificationRecord;
export declare function toNotificationPersistence(data: CreateNotificationRecord): Record<string, unknown>;
