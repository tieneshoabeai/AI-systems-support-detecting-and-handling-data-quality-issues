import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetSchema } from './infrastructure/persistence/dataset.schema';
import { DatasetRecordSchema } from './infrastructure/persistence/dataset-record.schema';
import { DatasetsRepository } from './infrastructure/persistence/datasets.repository';
import { DATASET_REPOSITORY_PORT } from './domain/ports/dataset.repository.port';
import { DatasetsService } from './application/datasets.service';
import { DatasetsController } from './infrastructure/http/datasets.controller';
import { SchemaInferenceService } from './application/services/schema-inference.service';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { OutboxModule } from '../../shared/application/outbox/outbox.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Dataset', schema: DatasetSchema },
      { name: 'DatasetRecord', schema: DatasetRecordSchema },
    ]),
    ProjectsModule,
    WorkspacesModule,
    StorageModule,
    OutboxModule,
  ],
  controllers: [DatasetsController],
  providers: [
    DatasetsRepository,
    { provide: DATASET_REPOSITORY_PORT, useExisting: DatasetsRepository },
    DatasetsService,
    SchemaInferenceService,
  ],
  exports: [DatasetsRepository, DATASET_REPOSITORY_PORT, DatasetsService, SchemaInferenceService],
})
export class DatasetsModule {}
