import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExportTaskSchema } from './schemas/export-task.schema';
import { DatasetRecordSchema } from '../datasets/schemas/dataset-record.schema';
import { ExportsRepository } from './exports.repository';
import { ExportsService } from './exports.service';
import { ExportsController } from './exports.controller';
import { DatasetsModule } from '../datasets/datasets.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { OutboxModule } from '../../shared/application/outbox/outbox.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ExportTask', schema: ExportTaskSchema },
      { name: 'DatasetRecord', schema: DatasetRecordSchema },
    ]),
    DatasetsModule,
    StorageModule,
    OutboxModule,
  ],
  controllers: [ExportsController],
  providers: [ExportsRepository, ExportsService],
  exports: [ExportsRepository, ExportsService],
})
export class ExportsModule {}
