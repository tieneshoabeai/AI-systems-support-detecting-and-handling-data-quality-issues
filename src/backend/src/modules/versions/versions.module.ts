import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetVersionSchema } from './schemas/dataset-version.schema';
import { DatasetRecordSchema } from '../datasets/schemas/dataset-record.schema';
import { VersionsRepository } from './versions.repository';
import { VersionsService } from './versions.service';
import { VersionsController } from './versions.controller';
import { DatasetsModule } from '../datasets/datasets.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { OutboxModule } from '../../shared/application/outbox/outbox.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'DatasetVersion', schema: DatasetVersionSchema },
      { name: 'DatasetRecord', schema: DatasetRecordSchema },
    ]),
    DatasetsModule,
    StorageModule,
    OutboxModule,
  ],
  controllers: [VersionsController],
  providers: [VersionsRepository, VersionsService],
  exports: [VersionsRepository, VersionsService],
})
export class VersionsModule {}
