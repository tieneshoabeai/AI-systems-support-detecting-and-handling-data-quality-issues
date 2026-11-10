import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetRecordSchema } from '../datasets/infrastructure/persistence/dataset-record.schema';
import { DataViewService } from './application/data-view.service';
import { DataViewController } from './infrastructure/http/data-view.controller';
import { DatasetsModule } from '../datasets/datasets.module';
import { RecordQueryRepository } from './infrastructure/persistence/record-query.repository';
import { RECORD_QUERY_PORT } from './domain/ports/record-query.port';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'DatasetRecord', schema: DatasetRecordSchema }]),
    DatasetsModule,
  ],
  controllers: [DataViewController],
  providers: [
    RecordQueryRepository,
    { provide: RECORD_QUERY_PORT, useExisting: RecordQueryRepository },
    DataViewService,
  ],
  exports: [DataViewService, RECORD_QUERY_PORT],
})
export class DataViewModule {}
