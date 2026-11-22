import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { INotification } from './notification.schema';
import {
  type CreateNotificationRecord,
  type NotificationListQuery,
  type NotificationRepositoryPort,
} from '../../domain/ports/notification.repository.port';
import type { Notification } from '../../domain/entities/notification.entity';
import {
  toNotificationEntity,
  toNotificationPersistence,
} from './notification.mapper';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { resolveMongoSession } from '../../../../shared/infrastructure/database/mongo-session-context';

/**
 * NOTIFICATIONS — Infrastructure adapter (driven).
 * Nơi duy nhất chạm Mongoose. Triển khai NOTIFICATION_REPOSITORY_PORT.
 *
 * **Bước 3 — Rich Domain Model:** trả entity `Notification`.
 */
@Injectable()
export class NotificationsRepository implements NotificationRepositoryPort {
  constructor(@InjectModel('Notification') private readonly model: Model<INotification>) {}

  /**
   * Ghi thông báo vào DB.
   *
   * **OPEN-09:** tự gia nhập session từ `MongoSessionContext` ⇒ khi được gọi
   * bên trong transaction, thông báo nằm chung transaction với thao tác chính
   * ⇒ không bao giờ có trạng thái "thao tác chính thất bại nhưng thông báo đã
   * gửi tới người dùng".
   */
  async create(doc: CreateNotificationRecord): Promise<Notification> {
    const s = resolveMongoSession(undefined);
    const inst = new this.model(toNotificationPersistence(doc));
    const saved = await inst.save({ session: s });
    return toNotificationEntity(saved);
  }

  async findByIdForUser(id: string, userId: string): Promise<Notification | null> {
    if (!isObjectIdHex(id) || !isObjectIdHex(userId)) return null;
    const doc = await this.model
      .findOne({ _id: new Types.ObjectId(id), user_id: new Types.ObjectId(userId) })
      .exec();
    return doc ? toNotificationEntity(doc) : null;
  }

  async listForUser(userId: string, opts: NotificationListQuery): Promise<Notification[]> {
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
    return docs.map(toNotificationEntity);
  }

  async countUnread(userId: string): Promise<number> {
    if (!isObjectIdHex(userId)) return 0;
    return this.model.countDocuments({ user_id: new Types.ObjectId(userId), read_at: null }).exec();
  }

  async markAsRead(id: string, userId: string): Promise<Notification | null> {
    if (!isObjectIdHex(id) || !isObjectIdHex(userId)) return null;
    const doc = await this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), user_id: new Types.ObjectId(userId) },
        { $set: { read_at: new Date() } },
        { new: true, session: resolveMongoSession(undefined) },
      )
      .exec();
    return doc ? toNotificationEntity(doc) : null;
  }

  async createIfEventNotExists(doc: CreateNotificationRecord): Promise<Notification | null> {
    if (!doc.sourceEventId) return this.create(doc);
    try {
      const s = resolveMongoSession(undefined);
      const inst = new this.model(toNotificationPersistence(doc));
      const saved = await inst.save({ session: s });
      return toNotificationEntity(saved);
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
