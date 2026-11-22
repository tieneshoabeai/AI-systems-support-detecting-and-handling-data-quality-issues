import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession, Types } from 'mongoose';
import { IOutboxEvent } from './outbox-event.schema';
import type { OutboxPort } from '../../application/ports/outbox.port';
import type { OutboxEventInput } from '../../application/ports/outbox.port';
import { resolveMongoSession } from '../database/mongo-session-context';

@Injectable()
export class OutboxService implements OutboxPort {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectModel('OutboxEvent') private readonly outboxModel: Model<IOutboxEvent>,
  ) {}

  /**
   * Ghi event vào outbox — **nguyên tử với transaction đang chạy** (OPEN-09).
   *
   * `resolveMongoSession()` tự gia nhập session từ `MongoSessionContext` nếu
   * không truyền `session` rõ ràng ⇒ ghi outbox nằm trong **cùng transaction**
   * với thao tác ghi chính. Nhờ vậy không bao giờ có trạng thái "đã xoá dữ liệu
   * nhưng event không được ghi".
   */
  async recordEvent(data: OutboxEventInput, session?: ClientSession): Promise<IOutboxEvent> {
    const s = resolveMongoSession(session);
    const event = new this.outboxModel({
      aggregate_type: data.aggregate_type,
      aggregate_id: data.aggregate_id,
      event_type: data.event_type,
      payload: data.payload ?? {},
      workspace_id: (data as unknown as Record<string, unknown>).workspace_id ?? null,
      project_id: (data as unknown as Record<string, unknown>).project_id ?? null,
      actor_id: (data as unknown as Record<string, unknown>).actor_id ?? null,
      status: 'PENDING',
      retry_count: 0,
    });
    return event.save({ session: s });
  }

  async getPendingEvents(limit = 50): Promise<IOutboxEvent[]> {
    return this.outboxModel
      .find({ status: 'PENDING', retry_count: { $lt: 5 } })
      .sort({ created_at: 1 })
      .limit(limit)
      .exec();
  }

  /** Relay claim: PENDING cu >60s hoac PUBLISHING het lease -> PUBLISHING voi lease 60s. */
  async claimForPublish(limit = 50): Promise<IOutboxEvent[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 60000);
    const docs = await this.outboxModel
      .find({
        $or: [
          { status: 'PENDING', created_at: { $lte: cutoff } },
          { status: 'PENDING' },
          { status: 'PUBLISHING', lease_expires_at: { $lte: now } },
        ],
        retry_count: { $lt: 5 },
      })
      .sort({ created_at: 1 })
      .limit(limit)
      .exec();
    const claimed: IOutboxEvent[] = [];
    for (const d of docs) {
      const r = await this.outboxModel
        .findOneAndUpdate(
          { _id: d._id, $or: [{ status: 'PENDING' }, { status: 'PUBLISHING', lease_expires_at: { $lte: now } }] },
          { $set: { status: 'PUBLISHING', lease_expires_at: new Date(now.getTime() + 60000) } },
          { new: true, session: resolveMongoSession(undefined) },
        )
        .exec();
      if (r) claimed.push(r);
    }
    return claimed;
  }

  async markAsPublished(eventId: string): Promise<void> {
    await this.outboxModel.updateOne(
      { _id: new Types.ObjectId(eventId) },
      { $set: { status: 'PUBLISHED', published_at: new Date(), lease_expires_at: null, error_message: null } },
      { session: resolveMongoSession(undefined) },
    );
  }

  async markAsProcessed(eventId: string): Promise<void> {
    await this.outboxModel.updateOne(
      { _id: eventId },
      { $set: { status: 'PROCESSED', processed_at: new Date(), error_message: null } },
      { session: resolveMongoSession(undefined) },
    );
  }

  async markAsFailed(eventId: string, errorMessage: string): Promise<void> {
    const event = await this.outboxModel.findById(eventId);
    if (!event) return;
    const newRetryCount = event.retry_count + 1;
    const newStatus = newRetryCount >= 5 ? 'FAILED' : 'PENDING';
    await this.outboxModel.updateOne(
      { _id: eventId },
      { $set: { status: newStatus, retry_count: newRetryCount, error_message: errorMessage, lease_expires_at: null } },
      { session: resolveMongoSession(undefined) },
    );
    this.logger.warn(`Outbox Event ${eventId} failed (Retry: ${newRetryCount}/5): ${errorMessage}`);
  }

  async reclaimStuckPublishing(): Promise<number> {
    const now = new Date();
    const r = await this.outboxModel.updateMany(
      { status: 'PUBLISHING', lease_expires_at: { $lte: now } },
      { $set: { status: 'PENDING', lease_expires_at: null } },
      { session: resolveMongoSession(undefined) },
    );
    return (r as unknown as { modifiedCount?: number }).modifiedCount ?? 0;
  }
}
