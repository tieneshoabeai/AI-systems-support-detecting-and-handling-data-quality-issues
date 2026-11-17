import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DomainEventEnvelope, EventPublisherPort } from '../ports/event-publisher.port';
export declare class KafkaEventPublisher implements EventPublisherPort, OnModuleInit, OnModuleDestroy {
    private readonly config;
    readonly mode: 'kafka';
    private readonly logger;
    private producer;
    private enabled;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    isEnabled(): boolean;
    publish(envelope: DomainEventEnvelope): Promise<void>;
}
