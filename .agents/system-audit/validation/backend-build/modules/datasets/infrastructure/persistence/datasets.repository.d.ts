import { Model } from 'mongoose';
import { IDataset } from './dataset.schema';
import { IDatasetRecord } from './dataset-record.schema';
import { type CreateDatasetRecord, type DatasetRecord, type DatasetRepositoryPort, type RecordInsertDoc } from '../../domain/ports/dataset.repository.port';
export declare class DatasetsRepository implements DatasetRepositoryPort {
    private readonly datasetModel;
    private readonly recordModel;
    constructor(datasetModel: Model<IDataset>, recordModel: Model<IDatasetRecord>);
    create(data: CreateDatasetRecord): Promise<DatasetRecord>;
    findById(id: string): Promise<DatasetRecord | null>;
    findByProject(projectId: string): Promise<DatasetRecord | null>;
    updateById(id: string, update: Partial<CreateDatasetRecord> & Record<string, unknown>): Promise<DatasetRecord | null>;
    bulkInsertRecords(records: RecordInsertDoc[]): Promise<number>;
    softDeleteDatasetWithRecords(datasetId: string): Promise<boolean>;
}
