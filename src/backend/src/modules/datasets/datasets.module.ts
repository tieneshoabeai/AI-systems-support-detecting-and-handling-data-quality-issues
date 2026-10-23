import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetSchema } from './schemas/dataset.schema';
import { DatasetRecordSchema } from './schemas/dataset-record.schema';
import { DatasetsRepository } from './datasets.repository';
import { DatasetsService } from './datasets.service';
import { DatasetsController } from './datasets.controller';
import { SchemaInferenceService } from './services/schema-inference.service';
import { ProjectsModule } from '../projects/projects.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { OutboxModule } from '../../shared/application/outbox/outbox.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Dataset', schema: DatasetSchema },
      { name: 'DatasetRecord', schema: DatasetRecordSchema },
    ]),
    ProjectsModule,
    StorageModule,
    OutboxModule,
  ],
  controllers: [DatasetsController],
  providers: [DatasetsRepository, DatasetsService, SchemaInferenceService],
  exports: [DatasetsRepository, DatasetsService, SchemaInferenceService],
})
export class DatasetsModule {}
