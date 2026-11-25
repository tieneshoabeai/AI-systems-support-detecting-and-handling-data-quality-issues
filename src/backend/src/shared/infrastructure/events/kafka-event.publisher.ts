import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import type { DomainEventEnvelope, EventPublisherPort } from '../../application/ports/event-publisher.port';
import { RealtimeRevocationEvents } from '../../domain/utils/realtime-events';

/**
 * Phân topic Kafka theo loại event.
 *
 * ── Vì sao cần hàm thuần, export ra ngoài? ───────────────────────────────
 * Trước đây hàm này là `private` (không export) ⇒ **không test được** ⇒
 * quy tắc phân topic chỉ được kiểm chứng bằng mắt. Export ra để có test
 * riêng (xem `test/unit/infra/kafka-topic-routing.spec.ts`).
 *
 * ── Quy tắc ───────────────────────────────────────────────────────────────
 * - `ai.*`          → topic `ai.jobs`          (job AI nặng, consumer riêng).
 * - `notification.*`, `email.*` → topic `notification.dispatch`.
 * - `realtime.*`    → topic `realtime.push`    (đẩy realtime, không xử lý nghiệp vụ).
 * - Event **thu hồi realtime** (`USER_BLOCKED`, `USER_REMOVED`) → `realtime.push`.
 *   Trước đây chúng rơi vào `domain.events` vì không có prefix `realtime.`
 *   ⇒ phân loại sai. Hiện chưa gây hỏng (consumer subscribe **cả 4** topic
 *   rồi đưa tất cả vào cùng một dispatcher), nhưng là tiền đề cho bug khi
 *   tách worker theo topic.
 * - Còn lại         → topic `domain.events`    (sự kiện nghiệp vụ + cascade).
 */
export function topicFor(eventType: string): string {
  if (eventType.startsWith('ai.')) return 'ai.jobs';
  if (eventType.startsWith('notification.') || eventType.startsWith('email.')) return 'notification.dispatch';
  if (eventType.startsWith('realtime.')) return 'realtime.push';
  if (eventType === RealtimeRevocationEvents.USER_BLOCKED) return 'realtime.push';
  if (eventType === RealtimeRevocationEvents.USER_REMOVED) return 'realtime.push';
  return 'domain.events';
}

@Injectable()
export class KafkaEventPublisher implements EventPublisherPort, OnModuleInit, OnModuleDestroy {
  readonly mode = 'kafka' as const;
  private readonly logger = new Logger(KafkaEventPublisher.name);
  private producer: Producer | null = null;
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const brokers = (this.config.get<string>('KAFKA_BROKERS') ?? '').trim();
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS chua cau hinh - Kafka publisher tat, dung in-process fallback.');
      return;
    }
    try {
      const kafka = new Kafka({ clientId: 'dq-api', brokers: brokers.split(',').map((s) => s.trim()).filter(Boolean) });
      this.producer = kafka.producer({ idempotent: true, maxInFlightRequests: 5, allowAutoTopicCreation: false });
      await this.producer.connect();
      this.enabled = true;
      this.logger.log(`Kafka publisher san sang (brokers=${brokers})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Kafka connect that bai, fallback in-process: ${msg}`);
      this.producer = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try { await this.producer?.disconnect(); } catch { /* bo qua */ }
  }

  isEnabled(): boolean { return this.enabled && this.producer !== null && this.producer !== undefined; }

  async publish(envelope: DomainEventEnvelope): Promise<void> {
    if (!this.isEnabled() || !this.producer) throw new Error('KAFKA_DISABLED');
    await this.producer.send({
      topic: topicFor(envelope.eventType),
      messages: [{ key: envelope.eventId, value: JSON.stringify(envelope) }],
      acks: -1,
    });
  }
}
