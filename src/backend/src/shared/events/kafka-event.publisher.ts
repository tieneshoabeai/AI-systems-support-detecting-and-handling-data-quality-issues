import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import type { DomainEventEnvelope, EventPublisherPort } from '../ports/event-publisher.port';
import { EVENT_PUBLISHER_PORT } from '../ports/event-publisher.port';

function topicFor(eventType: string): string {
  if (eventType.startsWith('ai.')) return 'ai.jobs';
  if (eventType.startsWith('notification.') || eventType.startsWith('email.')) return 'notification.dispatch';
  if (eventType.startsWith('realtime.')) return 'realtime.push';
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

  isEnabled(): boolean { return this.enabled && !!this.producer; }

  async publish(envelope: DomainEventEnvelope): Promise<void> {
    if (!this.isEnabled() || !this.producer) throw new Error('KAFKA_DISABLED');
    await this.producer.send({
      topic: topicFor(envelope.eventType),
      messages: [{ key: envelope.eventId, value: JSON.stringify(envelope) }],
      acks: -1,
    });
  }
}
