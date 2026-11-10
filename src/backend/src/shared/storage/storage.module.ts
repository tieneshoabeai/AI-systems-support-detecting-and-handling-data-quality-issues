import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { STORAGE_PORT } from '../ports/storage.port';

@Global()
@Module({
  providers: [StorageService, { provide: STORAGE_PORT, useExisting: StorageService }],
  exports: [StorageService, STORAGE_PORT],
})
export class StorageModule {}
