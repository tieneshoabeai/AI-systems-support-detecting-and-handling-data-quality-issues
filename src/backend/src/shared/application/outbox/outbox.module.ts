import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OutboxEventSchema } from './outbox-event.schema';
import { OutboxService } from './outbox.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'OutboxEvent', schema: OutboxEventSchema }]),
  ],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
