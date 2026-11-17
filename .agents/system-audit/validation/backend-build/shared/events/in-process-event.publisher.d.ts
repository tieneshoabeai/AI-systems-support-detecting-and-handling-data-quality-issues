import type { DomainEventEnvelope, EventPublisherPort } from '../ports/event-publisher.port';
export declare class InProcessEventPublisher implements EventPublisherPort {
    readonly mode: 'in-process';
    private readonly logger;
    private handlers;
    onEvent(handler: (e: DomainEventEnvelope) => Promise<void> | void): void;
    publish(envelope: DomainEventEnvelope): Promise<void>;
}
