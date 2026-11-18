import { OnModuleInit } from '@nestjs/common';
import { InProcessEventPublisher } from './in-process-event.publisher';
import type { DomainEventEnvelope } from '../ports/event-publisher.port';
import type { RealtimePort } from '../../modules/realtime/domain/ports/realtime.port';
import type { InboxService } from '../application/outbox/inbox.service';
export declare class EventDispatcherService implements OnModuleInit {
    private readonly inProcess;
    private readonly realtime?;
    private readonly inbox?;
    private readonly logger;
    constructor(inProcess: InProcessEventPublisher, realtime?: RealtimePort | undefined, inbox?: InboxService | undefined);
    onModuleInit(): void;
    handle(envelope: DomainEventEnvelope): Promise<void>;
    private route;
}
