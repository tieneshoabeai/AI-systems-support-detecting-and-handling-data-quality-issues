import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_PUBLISHER_PORT } from '../../application/ports/event-publisher.port';
import { REALTIME_PORT } from '../../application/ports/realtime.port';
import { InProcessEventPublisher } from './in-process-event.publisher';
import { KafkaEventPublisher } from './kafka-event.publisher';
import { HybridEventPublisher } from './hybrid-event.publisher';
import { EventDispatcherService } from './event-dispatcher.service';
import { InboxService } from '../outbox/inbox.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { InMemoryDomainEventHandlerRegistry } from './domain-event-handler.registry';
import { DOMAIN_EVENT_HANDLER_REGISTRY } from '../../application/ports/domain-event-handler.port';

@Global()
@Module({
  providers: [
    InProcessEventPublisher,
    KafkaEventPublisher,
    {
      provide: HybridEventPublisher,
      useFactory: (cfg: ConfigService, local: InProcessEventPublisher, kafka: KafkaEventPublisher) : HybridEventPublisher =>
        new HybridEventPublisher(cfg, local, kafka),
      inject: [ConfigService, InProcessEventPublisher, KafkaEventPublisher],
    },
    { provide: EVENT_PUBLISHER_PORT, useExisting: HybridEventPublisher },
    {
      provide: DOMAIN_EVENT_HANDLER_REGISTRY,
      useExisting: InMemoryDomainEventHandlerRegistry,
    },
    InMemoryDomainEventHandlerRegistry,
    {
      provide: EventDispatcherService,
      useFactory: (local: InProcessEventPublisher, inbox?: unknown, realtime?: unknown, registry?: unknown) : EventDispatcherService =>
        new EventDispatcherService(local, realtime as never, inbox as never, registry as never),
      inject: [
        InProcessEventPublisher,
        { token: InboxService, optional: true },
        { token: REALTIME_PORT, optional: true },
        { token: DOMAIN_EVENT_HANDLER_REGISTRY, optional: true },
      ],
    },
    KafkaConsumerService,
  ],
  exports: [
    InProcessEventPublisher,
    KafkaEventPublisher,
    HybridEventPublisher,
    EVENT_PUBLISHER_PORT,
    DOMAIN_EVENT_HANDLER_REGISTRY,
    EventDispatcherService,
    KafkaConsumerService,
  ],
})
export class EventsModule {}
