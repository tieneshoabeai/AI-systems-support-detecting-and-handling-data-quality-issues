import { Module } from '@nestjs/common';
import { DataViewController } from './presentation/controllers/data-view.controller';
import { DatasetsModule } from '../datasets/datasets.module';
import { GetColumnStatsHandler } from './application/queries/get-column-stats.handler';
import { GetRecordsHandler } from './application/queries/get-records.handler';
import { QueryRecordsHandler } from './application/queries/query-records.handler';

/**
 * DATA-VIEW — Module Virtual Grid (đọc bản ghi dataset).
 *
 * L2 (R3/CA6): module này KHÔNG khai báo schema Mongoose `DatasetRecord`
 * và KHÔNG import schema của module khác. Nó đọc bản ghi qua `RECORD_QUERY_PORT`
 * do module `datasets` (chủ sở hữu collection) export.
 */
@Module({
  imports: [DatasetsModule],
  controllers: [DataViewController],
  providers: [GetRecordsHandler, QueryRecordsHandler, GetColumnStatsHandler],
  exports: [],
})
export class DataViewModule {}
