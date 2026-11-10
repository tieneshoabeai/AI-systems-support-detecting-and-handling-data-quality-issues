import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { OutboxEventSchema } from '../application/outbox/outbox-event.schema';
import { OutboxService } from '../application/outbox/outbox.service';
import { MongooseTransactionService } from './mongoose-transaction.service';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        autoIndex: true,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 20,
        minPoolSize: 5,
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: 'OutboxEvent', schema: OutboxEventSchema },
    ]),
  ],
  providers: [OutboxService, MongooseTransactionService],
  exports: [MongooseModule, OutboxService, MongooseTransactionService],
})
export class DatabaseModule {}
