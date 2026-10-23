import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetRecordSchema } from '../datasets/schemas/dataset-record.schema';
import { DataViewService } from './data-view.service';
import { DataViewController } from './data-view.controller';
import { DatasetsModule } from '../datasets/datasets.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'DatasetRecord', schema: DatasetRecordSchema }]),
    DatasetsModule,
  ],
  controllers: [DataViewController],
  providers: [DataViewService],
  exports: [DataViewService],
})
export class DataViewModule {}
