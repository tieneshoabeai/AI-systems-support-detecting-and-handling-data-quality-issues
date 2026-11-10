import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutboxEventSchema } from './outbox-event.schema';
import { OutboxService } from './outbox.service';
import { OUTBOX_PORT } from '../../../shared/ports/outbox.port';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'OutboxEvent', schema: OutboxEventSchema }]),
  ],
  providers: [OutboxService, { provide: OUTBOX_PORT, useExisting: OutboxService }],
  exports: [OutboxService, OUTBOX_PORT],
})
export class OutboxModule {}
