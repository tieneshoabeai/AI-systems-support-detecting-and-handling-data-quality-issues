import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DomainEventEnvelope, EventPublisherPort } from '../ports/event-publisher.port';
import { InProcessEventPublisher } from './in-process-event.publisher';
import { KafkaEventPublisher } from './kafka-event.publisher';

@Injectable()
export class HybridEventPublisher implements EventPublisherPort {
  constructor(private readonly cfg: ConfigService, private readonly local: InProcessEventPublisher, private readonly kafka: KafkaEventPublisher) {}
  get mode(): 'kafka' | 'in-process' { return (this.cfg.get<string>('KAFKA_BROKERS') ?? '').trim().length > 0 ? 'kafka' : 'in-process'; }
  publish(e: DomainEventEnvelope): Promise<void> {
    return ((this.cfg.get<string>('KAFKA_BROKERS') ?? '').trim().length > 0 ? this.kafka : this.local).publish(e);
  }
}
