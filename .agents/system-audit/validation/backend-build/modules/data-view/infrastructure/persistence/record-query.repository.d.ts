import { Model } from 'mongoose';
import type { IDatasetRecord } from '../../../datasets/infrastructure/persistence/dataset-record.schema';
import type { ColumnStatsResult, DatasetColumnRef, RecordQueryInput, RecordQueryPort, RecordRow } from '../../domain/ports/record-query.port';
export declare class RecordQueryRepository implements RecordQueryPort {
    private readonly recordModel;
    constructor(recordModel: Model<IDatasetRecord>);
    resolveColumnKey(column: string, keys: string[], _names: string[]): string | null;
    listRecords(datasetId: string, cursor: string | undefined, limit: number): Promise<{
        items: RecordRow[];
        hasMore: boolean;
    }>;
    listAllRecords(datasetId: string): Promise<RecordRow[]>;
    queryRecords(datasetId: string, input: RecordQueryInput, columns: DatasetColumnRef[]): Promise<{
        items: RecordRow[];
        hasMore: boolean;
    }>;
    getColumnStats(datasetId: string, columnKey: string): Promise<ColumnStatsResult>;
    private buildFilterConditions;
    private buildOneCondition;
}
