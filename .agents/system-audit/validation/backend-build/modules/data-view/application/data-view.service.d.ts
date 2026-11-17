import { type DatasetRepositoryPort } from '../../datasets/domain/ports/dataset.repository.port';
import { type RecordQueryPort, type RecordRow } from '../domain/ports/record-query.port';
import type { RecordFilterOperator } from '../domain/ports/record-query.port';
export interface GetRecordsInput {
    cursor?: string;
    limit?: number;
    sort_order?: 'asc' | 'desc';
    sort_field?: string;
}
export interface QueryRecordsBodyInput {
    filters?: Array<{
        column: string;
        operator: RecordFilterOperator;
        value?: unknown;
    }>;
    sort?: Array<{
        column: string;
        order: 'asc' | 'desc';
    }>;
    search?: {
        columns: string[];
        value: string;
    };
    cursor?: string;
    limit?: number;
}
import { type CursorPaginatedResponse } from '../../../shared/pagination/cursor-paginated.response';
export interface ColumnStatsResult {
    column_key: string;
    column_name: string;
    total_records: number;
    null_count: number;
    missing_ratio: number;
    min?: number;
    max?: number;
    average?: number;
    histogram: {
        bucket_start: number;
        bucket_end: number;
        count: number;
    }[];
}
export declare class DataViewService {
    private readonly records;
    private readonly datasets;
    private readonly logger;
    constructor(records: RecordQueryPort, datasets: DatasetRepositoryPort);
    getRecords(datasetId: string, query: GetRecordsInput): Promise<CursorPaginatedResponse<RecordRow>>;
    queryRecords(datasetId: string, body: QueryRecordsBodyInput): Promise<CursorPaginatedResponse<RecordRow>>;
    getColumnStats(datasetId: string, columnRef: string): Promise<ColumnStatsResult>;
}
