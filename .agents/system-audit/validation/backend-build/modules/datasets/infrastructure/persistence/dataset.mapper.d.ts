import type { IDataset } from './dataset.schema';
import type { CreateDatasetRecord, DatasetRecord } from '../../domain/ports/dataset.repository.port';
export declare function toDatasetRecord(doc: IDataset): DatasetRecord;
export declare function toDatasetPersistence(data: CreateDatasetRecord & {
    id?: string;
}): Record<string, unknown>;
export declare function toDatasetUpdate(update: Partial<CreateDatasetRecord> & Record<string, unknown>): Record<string, unknown>;
