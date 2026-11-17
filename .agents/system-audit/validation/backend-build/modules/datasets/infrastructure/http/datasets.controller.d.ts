import { Request, Response } from 'express';
import { DatasetsService } from '../../application/datasets.service';
import { AuditService } from '../../../audit/application/audit.service';
import { CurrentUserPayload } from '../../../../shared/decorators/current-user.decorator';
import { UpdateDatasetDto } from './dtos/update-dataset.dto';
import { RenameColumnsDto } from './dtos/rename-columns.dto';
export declare class DatasetsController {
    private readonly datasetsService;
    private readonly audit;
    constructor(datasetsService: DatasetsService, audit: AuditService);
    uploadDataset(projectId: string, req: Request): Promise<unknown>;
    getDatasetByProject(projectId: string): Promise<{
        dataset: import("../../domain/ports/dataset.repository.port").DatasetRecord | null;
    }>;
    getDatasetById(id: string): Promise<{
        dataset: import("../../domain/ports/dataset.repository.port").DatasetRecord;
    }>;
    updateDataset(id: string, dto: UpdateDatasetDto): Promise<{
        message: string;
        dataset: import("../../domain/ports/dataset.repository.port").DatasetRecord;
    }>;
    renameColumns(id: string, dto: RenameColumnsDto): Promise<{
        dataset: import("../../domain/ports/dataset.repository.port").DatasetRecord;
    }>;
    resetColumnNames(id: string): Promise<{
        dataset: import("../../domain/ports/dataset.repository.port").DatasetRecord;
    }>;
    deleteDataset(id: string): Promise<void>;
    downloadDatasetFile(id: string, actor: CurrentUserPayload, req: Request, res: Response): Promise<void>;
    getDatasetSchema(id: string): Promise<{
        columns: import("../../domain/ports/dataset.repository.port").DatasetColumnRecord[];
    }>;
}
