/**
 * DATA-VIEW — Domain ports (hexagonal chuẩn).
 * Tầng Application truy vấn bản ghi qua port, không chạm Mongoose/Model.
 */

export const RECORD_QUERY_PORT = Symbol('RecordQueryPort');

export interface DatasetColumnRef {
  key: string;
  name: string;
  originalName: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
}

export interface RecordRow {
  rowIndex: number;
  props: Record<string, unknown>;
}

export type RecordFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'between'
  | 'in'
  | 'isEmpty'
  | 'isNotEmpty';

export interface RecordFilter {
  column: string;
  operator: RecordFilterOperator;
  value?: unknown;
}

export interface RecordSort {
  column: string;
  order: 'asc' | 'desc';
}

export interface RecordQueryInput {
  filters: RecordFilter[];
  sort: RecordSort[];
  search?: { columns: string[]; value: string };
  cursor?: string;
  limit?: number;
}

export interface ColumnStatsResult {
  columnKey: string;
  columnName: string;
  totalRecords: number;
  nullCount: number;
  missingRatio: number;
  min?: number;
  max?: number;
  average?: number;
  histogram: { bucketStart: number; bucketEnd: number; count: number }[];
}

export interface RecordQueryPort {
  listAllRecords(datasetId: string): Promise<RecordRow[]>;
  resolveColumnKey(column: string, keys: string[], names: string[]): string | null;
  listRecords(
    datasetId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: RecordRow[]; hasMore: boolean }>;
  queryRecords(
    datasetId: string,
    input: RecordQueryInput,
    columns: DatasetColumnRef[],
  ): Promise<{ items: RecordRow[]; hasMore: boolean }>;
  getColumnStats(datasetId: string, columnKey: string): Promise<ColumnStatsResult>;
}
