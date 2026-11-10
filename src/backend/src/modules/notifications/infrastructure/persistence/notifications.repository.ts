import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { INotification } from './notification.schema';
import {
  NOTIFICATION_REPOSITORY_PORT,
  type CreateNotificationRecord,
  type NotificationListQuery,
  type NotificationRecord,
  type NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';
import { toNotificationPersistence, toNotificationRecord } from './notification.mapper';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

/**
 * NOTIFICATIONS — Infrastructure adapter (driven).
 * Nơi duy nhất chạm Mongoose. Triển khai NOTIFICATION_REPOSITORY_PORT.
 */
@Injectable()
export class NotificationsRepository implements NotificationRepositoryPort {
  constructor(@InjectModel('Notification') private readonly model: Model<INotification>) {}

  async create(doc: CreateNotificationRecord): Promise<NotificationRecord> {
    const inst = new this.model(toNotificationPersistence(doc));
    const saved = await inst.save();
    return toNotificationRecord(saved);
  }

  async findByIdForUser(id: string, userId: string): Promise<NotificationRecord | null> {
    if (!isObjectIdHex(id) || !isObjectIdHex(userId)) return null;
    const doc = await this.model
      .findOne({ _id: new Types.ObjectId(id), user_id: new Types.ObjectId(userId) })
      .exec();
    return doc ? toNotificationRecord(doc) : null;
  }

  async listForUser(userId: string, opts: NotificationListQuery): Promise<NotificationRecord[]> {
    if (!isObjectIdHex(userId)) return [];
    const filter: Record<string, unknown> = { user_id: new Types.ObjectId(userId) };
    if (opts.read === 'true') filter.read_at = { $ne: null };
    if (opts.read === 'false') filter.read_at = null;
    if (opts.cursorCreatedAt && opts.cursorId && isObjectIdHex(opts.cursorId)) {
      const cmp = opts.sortOrder === 'desc' ? '$lt' : '$gt';
      filter.$or = [
        { created_at: { [cmp]: opts.cursorCreatedAt } },
        { created_at: opts.cursorCreatedAt, _id: { [cmp]: new Types.ObjectId(opts.cursorId) } },
      ];
    }
    const dir = opts.sortOrder === 'desc' ? -1 : 1;
    const docs = await this.model
      .find(filter)
      .sort({ created_at: dir, _id: dir })
      .limit(opts.limit + 1)
      .exec();
    return docs.map(toNotificationRecord);
  }

  async countUnread(userId: string): Promise<number> {
    if (!isObjectIdHex(userId)) return 0;
    return this.model.countDocuments({ user_id: new Types.ObjectId(userId), read_at: null }).exec();
  }

  async markAsRead(id: string, userId: string): Promise<NotificationRecord | null> {
    if (!isObjectIdHex(id) || !isObjectIdHex(userId)) return null;
    const doc = await this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), user_id: new Types.ObjectId(userId) },
        { $set: { read_at: new Date() } },
        { new: true },
      )
      .exec();
    return doc ? toNotificationRecord(doc) : null;
  }

  async createIfEventNotExists(doc: CreateNotificationRecord): Promise<NotificationRecord | null> {
    if (!doc.sourceEventId) return this.create(doc);
    try {
      const inst = new this.model(toNotificationPersistence(doc));
      const saved = await inst.save();
      return toNotificationRecord(saved);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null ? (err as Record<string, unknown>).code : null;
      if (code === 11000) return null;
      throw err;
    }
  }

  async existsByEvent(userId: string, sourceEventId: string): Promise<boolean> {
    if (!isObjectIdHex(userId) || !sourceEventId) return false;
    const c = await this.model
      .countDocuments({ user_id: new Types.ObjectId(userId), source_event_id: sourceEventId })
      .exec();
    return c > 0;
  }
}

