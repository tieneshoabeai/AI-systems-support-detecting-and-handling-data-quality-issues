import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { MongooseTransactionService } from './mongoose-transaction.service';
import { TRANSACTION_PORT } from '../../application/ports/transaction.port';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) : { uri: string | undefined; autoIndex: true; serverSelectionTimeoutMS: number; connectTimeoutMS: number; socketTimeoutMS: number; maxPoolSize: number; minPoolSize: number; } => ({
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
  ],
  providers: [
    MongooseTransactionService,
    { provide: TRANSACTION_PORT, useExisting: MongooseTransactionService },
  ],
  exports: [MongooseModule, MongooseTransactionService, TRANSACTION_PORT],
})
export class DatabaseModule {}
