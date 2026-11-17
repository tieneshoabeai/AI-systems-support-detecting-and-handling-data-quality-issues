import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventDispatcherService } from './event-dispatcher.service';
export declare class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly dispatcher?;
    private readonly logger;
    private consumer;
    private stopped;
    constructor(config: ConfigService, dispatcher?: EventDispatcherService | undefined);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
