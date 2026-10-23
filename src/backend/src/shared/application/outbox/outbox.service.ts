import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { IOutboxEvent } from './outbox-event.schema';

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    @InjectModel('OutboxEvent') private readonly outboxModel: Model<IOutboxEvent>
  ) {}

  /**
   * Đăng ký một sự kiện đồng bộ vào Outbox trong cùng một MongoDB session
   */
  async recordEvent(
    data: {
      aggregate_type: 'DATASET' | 'DATASET_VERSION' | 'TRANSFORMATION';
      aggregate_id: string;
      event_type: string;
      payload: Record<string, unknown>;
    },
    session?: ClientSession
  ): Promise<IOutboxEvent> {
    const event = new this.outboxModel({
      ...data,
      status: 'PENDING',
      retry_count: 0,
    });

    return event.save({ session });
  }

  /**
   * Lấy danh sách các sự kiện đang chờ xử lý
   */
  async getPendingEvents(limit = 50): Promise<IOutboxEvent[]> {
    return this.outboxModel
      .find({
        status: 'PENDING',
        retry_count: { $lt: 5 }, // Tối đa 5 lần thử lại
      })
      .sort({ created_at: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Đánh dấu sự kiện đã đồng bộ thành công sang Neo4j AuraDB
   */
  async markAsProcessed(eventId: string): Promise<void> {
    await this.outboxModel.updateOne(
      { _id: eventId },
      {
        $set: {
          status: 'PROCESSED',
          processed_at: new Date(),
          error_message: null,
        },
      }
    );
  }

  /**
   * Ghi nhận lỗi khi đồng bộ thất bại và tăng retry_count
   */
  async markAsFailed(eventId: string, errorMessage: string): Promise<void> {
    const event = await this.outboxModel.findById(eventId);
    if (!event) return;

    const newRetryCount = event.retry_count + 1;
    const newStatus = newRetryCount >= 5 ? 'FAILED' : 'PENDING';

    await this.outboxModel.updateOne(
      { _id: eventId },
      {
        $set: {
          status: newStatus,
          retry_count: newRetryCount,
          error_message: errorMessage,
        },
      }
    );

    this.logger.warn(
      `Outbox Event ${eventId} failed (Retry: ${newRetryCount}/5): ${errorMessage}`
    );
  }
}
