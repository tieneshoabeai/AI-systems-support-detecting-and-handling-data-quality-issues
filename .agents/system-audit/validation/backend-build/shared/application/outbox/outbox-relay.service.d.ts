import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from './outbox.service';
import type { EventPublisherPort } from '../../ports/event-publisher.port';
export declare class OutboxRelayService implements OnModuleInit {
    private readonly outbox;
    private readonly config;
    private readonly publisher?;
    private readonly logger;
    private timer;
    private busy;
    constructor(outbox: OutboxService, config: ConfigService, publisher?: EventPublisherPort | undefined);
    onModuleInit(): void;
    tick(): Promise<number>;
}
