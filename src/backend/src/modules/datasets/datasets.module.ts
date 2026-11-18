import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetSchema } from './infrastructure/persistence/dataset.schema';
import { DatasetRecordSchema } from './infrastructure/persistence/dataset-record.schema';
import { DatasetsRepository } from './infrastructure/persistence/datasets.repository';
import { DATASET_REPOSITORY_PORT } from './domain/ports/dataset.repository.port';
import { RECORD_QUERY_PORT } from './domain/ports/record-query.port';
import { RecordQueryRepository } from './infrastructure/persistence/record-query.repository';
import { DatasetsController } from './presentation/controllers/datasets.controller';
import { SchemaInferenceService } from './application/services/schema-inference.service';
import { ProjectsModule } from '../projects/projects.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { StorageModule } from '../../shared/infrastructure/storage/storage.module';
import { OutboxModule } from '../../shared/infrastructure/outbox/outbox.module';
import { DeleteDatasetHandler } from './application/commands/delete-dataset.handler';
import { DownloadDatasetFileHandler } from './application/queries/download-dataset-file.handler';
import { GetDatasetByIdHandler } from './application/queries/get-dataset-by-id.handler';
import { GetDatasetByProjectIdHandler } from './application/queries/get-dataset-by-project-id.handler';
import { GetDatasetSchemaHandler } from './application/queries/get-dataset-schema.handler';
import { IngestDatasetStreamHandler } from './application/commands/ingest-dataset-stream.handler';
import { UpdateColumnPiiHandler } from './application/commands/update-column-pii.handler';
import { MapPropsToOriginalNamesHandler } from './application/commands/map-props-to-original-names.handler';
import { DatasetPolicyLoader } from './application/policy-loaders/dataset-policy.loader';
import { CascadeProjectDatasetsHandler } from './application/commands/cascade-project-datasets.handler';
import { CascadeDatasetEventSubscriber } from './application/commands/cascade-dataset-event.subscriber';

/**
 * DATASETS — Module sở hữu collection `datasets` + `dataset_records`.
 *
 * L2 (R3/CA6): schema Mongoose `DatasetRecordSchema` chỉ được khai báo ở đây.
 * Module khác (data-view, analysis) đọc bản ghi qua `RECORD_QUERY_PORT`.
 */
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
    RecordQueryRepository,
    { provide: RECORD_QUERY_PORT, useExisting: RecordQueryRepository },
    DeleteDatasetHandler,
    IngestDatasetStreamHandler,
    UpdateColumnPiiHandler,
    MapPropsToOriginalNamesHandler,
    DownloadDatasetFileHandler,
    GetDatasetByIdHandler,
    GetDatasetByProjectIdHandler,
    GetDatasetSchemaHandler,
    SchemaInferenceService,
    DatasetPolicyLoader,
    CascadeProjectDatasetsHandler,
    CascadeDatasetEventSubscriber,
  ],
  exports: [
    DatasetsRepository,
    DATASET_REPOSITORY_PORT,
    RECORD_QUERY_PORT,
    SchemaInferenceService,
    DatasetPolicyLoader,
  ],
})
export class DatasetsModule {}
