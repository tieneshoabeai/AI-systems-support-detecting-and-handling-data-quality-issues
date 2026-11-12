import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EVENT_PUBLISHER_PORT } from '../ports/event-publisher.port';
import { REALTIME_PORT } from '../../modules/realtime/domain/ports/realtime.port';
import { InProcessEventPublisher } from './in-process-event.publisher';
import { KafkaEventPublisher } from './kafka-event.publisher';
import { HybridEventPublisher } from './hybrid-event.publisher';
import { EventDispatcherService } from './event-dispatcher.service';
import { InboxService } from '../application/outbox/inbox.service';
import { KafkaConsumerService } from './kafka-consumer.service';

@Global()
@Module({
  providers: [
    InProcessEventPublisher,
    KafkaEventPublisher,
    {
      provide: HybridEventPublisher,
      useFactory: (cfg: ConfigService, local: InProcessEventPublisher, kafka: KafkaEventPublisher) =>
        new HybridEventPublisher(cfg, local, kafka),
      inject: [ConfigService, InProcessEventPublisher, KafkaEventPublisher],
    },
    { provide: EVENT_PUBLISHER_PORT, useExisting: HybridEventPublisher },
    {
      provide: EventDispatcherService,
      useFactory: (local: InProcessEventPublisher, inbox?: unknown, realtime?: unknown) =>
        new EventDispatcherService(local, realtime as never, inbox as never),
      inject: [InProcessEventPublisher, { token: InboxService, optional: true }, { token: REALTIME_PORT, optional: true }],
    },
    KafkaConsumerService,
  ],
  exports: [InProcessEventPublisher, KafkaEventPublisher, HybridEventPublisher, EVENT_PUBLISHER_PORT, EventDispatcherService, KafkaConsumerService],
})
export class EventsModule {}
