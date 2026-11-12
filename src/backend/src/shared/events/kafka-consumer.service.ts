import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventDispatcherService } from './event-dispatcher.service';
import type { DomainEventEnvelope } from '../ports/event-publisher.port';

/**
 * Nhom 4 - Kafka consumer (worker side). Tat khi khong co KAFKA_BROKERS.
 * Subscribe 4 topics do KafkaEventPublisher ghi: ai.jobs, notification.dispatch, realtime.push, domain.events.
 * Moi message -> dispatcher.handle (da co inbox idempotency) -> mai mai khong xu ly trung side-effect.
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private consumer: { disconnect(): Promise<void> } | null = null;
  private stopped = false;
  constructor(private readonly config: ConfigService, @Optional() private readonly dispatcher?: EventDispatcherService) {}
  async onModuleInit(): Promise<void> {
    const mode = (this.config.get<string>('WORKER_MODE') ?? 'all').toLowerCase();
    if (mode === 'api') { this.logger.log('Kafka consumer tat trong API process (WORKER_MODE=api)'); return; }
    const brokers = (this.config.get<string>('KAFKA_BROKERS') ?? '').trim();
    if (!brokers) { this.logger.log('KAFKA_BROKERS chua cau hinh - Kafka consumer tat'); return; }
    if (!this.dispatcher) { this.logger.warn('Thieu EventDispatcherService - Kafka consumer tat'); return; }
    try {
      const { Kafka } = await import('kafkajs');
      const kafka = new Kafka({ clientId: 'dq-worker', brokers: brokers.split(',').map((s) => s.trim()).filter(Boolean) });
      const consumer = kafka.consumer({ groupId: 'dq-worker-group', allowAutoTopicCreation: false });
      await consumer.connect();
      await consumer.subscribe({ topics: ['ai.jobs', 'notification.dispatch', 'realtime.push', 'domain.events'], fromBeginning: false });
      this.consumer = consumer;
      await consumer.run({
        autoCommit: true,
        eachMessage: async ({ message }) => {
          if (this.stopped || !message.value) return;
          try {
            const envelope = JSON.parse(message.value.toString()) as DomainEventEnvelope;
            if (envelope && envelope.eventId && envelope.eventType) await this.dispatcher?.handle(envelope);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Kafka message loi (bo qua, cho retry theo offset): ${msg}`);
          }
        },
      });
      this.logger.log(`Kafka consumer san sang (brokers=${brokers}, group=dq-worker-group)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Kafka consumer khoi dong that bai (van chay in-process fallback): ${msg}`);
      this.consumer = null;
    }
  }
  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    try { await this.consumer?.disconnect(); } catch { /* bo qua */ }
  }
}
