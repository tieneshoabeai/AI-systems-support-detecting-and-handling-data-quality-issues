import { ConfigService } from '@nestjs/config';
import type { DomainEventEnvelope, EventPublisherPort } from '../ports/event-publisher.port';
import { InProcessEventPublisher } from './in-process-event.publisher';
import { KafkaEventPublisher } from './kafka-event.publisher';
export declare class HybridEventPublisher implements EventPublisherPort {
    private readonly cfg;
    private readonly local;
    private readonly kafka;
    constructor(cfg: ConfigService, local: InProcessEventPublisher, kafka: KafkaEventPublisher);
    get mode(): 'kafka' | 'in-process';
    publish(e: DomainEventEnvelope): Promise<void>;
}
