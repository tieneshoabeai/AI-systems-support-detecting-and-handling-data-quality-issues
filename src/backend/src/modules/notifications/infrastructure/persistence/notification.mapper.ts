import { Types } from 'mongoose';
import type { INotification } from './notification.schema';
import type { CreateNotificationRecord, NotificationRecord } from '../../domain/ports/notification.repository.port';

export function toNotificationRecord(doc: INotification): NotificationRecord {
  return {
    id: doc._id.toString(),
    userId: doc.user_id.toString(),
    type: doc.type,
    title: doc.title,
    summary: doc.summary ?? null,
    payload: (doc.payload as unknown as Record<string, unknown> | undefined) ?? null,
    sourceEventId: doc.source_event_id ?? null,
    isMandatory: doc.is_mandatory ?? false,
    readAt: doc.read_at ?? null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function toNotificationPersistence(data: CreateNotificationRecord): Record<string, unknown> {
  return {
    user_id: new Types.ObjectId(data.userId),
    type: data.type,
    title: data.title.trim().slice(0, 200),
    summary: data.summary ? data.summary.slice(0, 500) : null,
    payload: data.payload ?? undefined,
    source_event_id: data.sourceEventId ?? null,
    is_mandatory: data.isMandatory,
    read_at: null,
  };
}
