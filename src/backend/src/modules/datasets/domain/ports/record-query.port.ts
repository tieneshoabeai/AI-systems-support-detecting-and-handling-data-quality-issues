/**
 * DATASETS — Domain port truy vấn bản ghi (Virtual Grid).
 *
 * Vì sao port này thuộc `datasets` chứ không phải `data-view`? (L2 — quy tắc R3/CA6)
 * -----------------------------------------------------------------------------
 * Collection `dataset_records` và schema Mongoose `DatasetRecordSchema` được
 * **sở hữu** bởi bounded context `datasets`. Module `data-view` và `analysis`
 * chỉ cần ĐỌC bản ghi — nếu chúng tự khai báo `MongooseModule.forFeature([
 * { name: 'DatasetRecord', schema: DatasetRecordSchema }])` và import schema
 * chéo module thì chúng sẽ phụ thuộc trực tiếp vào cấu trúc lưu trữ của
 * module khác (vi phạm CA6) và có thể ghi bẩn collection khi schema lệch phiên bản.
 *
 * → Vì vậy: schema + adapter nằm trong `datasets`; module khác chỉ inject
 * `RECORD_QUERY_PORT` qua public contract `modules/datasets/index.ts`.
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
