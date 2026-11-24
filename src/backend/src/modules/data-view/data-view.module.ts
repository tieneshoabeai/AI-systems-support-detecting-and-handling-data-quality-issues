import { Module } from '@nestjs/common';
import { DataViewController } from './data-view.controller';
import { DataViewService } from './data-view.service';
import { DatasetsModule } from '../datasets/datasets.module';

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
  providers: [DataViewService],
  exports: [],
})
export class DataViewModule {}
