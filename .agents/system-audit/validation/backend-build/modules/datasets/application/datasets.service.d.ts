import { Readable } from 'stream';
import { type DatasetRecord, type DatasetRepositoryPort } from '../domain/ports/dataset.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { WorkspacesService } from '../../workspaces/application/workspaces.service';
import { ConfigService } from '@nestjs/config';
import { type StoragePort } from '../../../shared/ports/storage.port';
import { type OutboxPort } from '../../../shared/ports/outbox.port';
import { SchemaInferenceService } from './services/schema-inference.service';
export interface UpdateDatasetInput {
    name?: string;
}
export interface RenameColumnItemInput {
    key: string;
    name: string;
}
export interface RenameColumnsInput {
    columns: RenameColumnItemInput[];
}
export declare class DatasetsService {
    private readonly datasets;
    private readonly projectsService;
    private readonly storage;
    private readonly outbox;
    private readonly schemaInferenceService;
    private readonly workspacesService;
    private readonly configService;
    private readonly logger;
    constructor(datasets: DatasetRepositoryPort, projectsService: ProjectsService, storage: StoragePort, outbox: OutboxPort, schemaInferenceService: SchemaInferenceService, workspacesService: WorkspacesService, configService: ConfigService);
    ingestDatasetStream(params: {
        projectId: string;
        fileStream: Readable;
        fileName: string;
        mimeType: string;
        contentLength?: number;
    }): Promise<DatasetRecord>;
    private processCsvStream;
    getDatasetById(id: string): Promise<DatasetRecord>;
    getDatasetByProjectId(projectId: string): Promise<DatasetRecord | null>;
    downloadDatasetFile(id: string): Promise<{
        stream: Readable;
        filename: string;
        fileSizeBytes: number;
        contentType: string;
        workspaceId: string;
        projectId: string;
    }>;
    getDatasetSchema(id: string): Promise<DatasetRecord['columns']>;
    updateDataset(id: string, dto: UpdateDatasetInput): Promise<DatasetRecord>;
    renameColumns(id: string, dto: RenameColumnsInput): Promise<DatasetRecord>;
    resetColumnNames(id: string): Promise<DatasetRecord>;
    mapPropsToOriginalNames(columns: {
        key: string;
        originalName: string;
    }[], props: Record<string, unknown>): Record<string, unknown>;
    deleteDataset(id: string): Promise<boolean>;
}
