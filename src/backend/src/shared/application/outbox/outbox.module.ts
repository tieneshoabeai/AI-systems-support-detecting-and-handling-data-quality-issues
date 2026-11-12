import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutboxEventSchema } from './outbox-event.schema';
import { ProcessedEventSchema } from './processed-event.schema';
import { OutboxService } from './outbox.service';
import { InboxService } from './inbox.service';
import { OutboxRelayService } from './outbox-relay.service';
import { OUTBOX_PORT } from '../../ports/outbox.port';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'OutboxEvent', schema: OutboxEventSchema },
      { name: 'ProcessedEvent', schema: ProcessedEventSchema },
    ]),
  ],
  providers: [OutboxService, InboxService, OutboxRelayService, { provide: OUTBOX_PORT, useExisting: OutboxService }],
  exports: [OutboxService, InboxService, OutboxRelayService, OUTBOX_PORT],
})
export class OutboxModule {}
