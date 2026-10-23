import { Module, Global } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
import { CaslModule } from './casl/casl.module';

@Global()
@Module({
  imports: [DatabaseModule, StorageModule, CaslModule],
  providers: [],
  exports: [DatabaseModule, StorageModule, CaslModule],
})
export class SharedModule {}
