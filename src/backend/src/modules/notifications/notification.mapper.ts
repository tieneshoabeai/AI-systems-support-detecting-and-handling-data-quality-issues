/** NOTIFICATIONS — Mapper infrastructure <-> domain entity (Template Simple). GIU RIENG, KHONG gop voi email mapper. */
import { Types } from 'mongoose';
import type { INotification } from './notifications.schema';
import type { CreateNotificationRecord } from './notifications.types';
import { Notification } from './notifications.types';

/** Document Mongoose -> entity `Notification`. */
export function toNotificationEntity(doc: INotification): Notification {
  return Notification.reconstitute({
    id: doc._id.toString(),
    userId: doc.user_id.toString(),
    type: doc.type,
    title: doc.title,
    summary: doc.summary ?? null,
    payload: (doc.payload as Notification['payload'] | undefined) ?? null,
    sourceEventId: doc.source_event_id ?? null,
    isMandatory: doc.is_mandatory ?? false,
    readAt: doc.read_at ?? null,
    expiresAt: doc.expires_at ?? null,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    deletedAt: null,
    version: 1,
  });
}

/** Du lieu tao moi -> shape luu tru (Mongoose). */
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
    expires_at: data.expiresAt ?? null,
  };
}
