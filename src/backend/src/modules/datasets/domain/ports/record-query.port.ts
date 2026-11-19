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
import type { ColumnDataType } from '../value-objects/column-type.vo';

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

/**
 * Tập giá trị của **một cột** để dựng biểu đồ (GĐ6).
 *
 * `null` trong `values` = giá trị thiếu (thiếu hoặc không đọc được).
 */
export interface ColumnValuesResult {
  columnKey: string;
  values: unknown[];
  /** Tổng số bản ghi của dataset (kể cả bản ghi bị cắt bởi `limit`). */
  totalRecords: number;
  /** Số bản ghi thực sự được đọc (có thể < `totalRecords` nếu bị giới hạn). */
  sampledRecords: number;
  /** `true` khi bị giới hạn → số liệu biểu đồ là trên **mẫu**, không phải toàn bộ. */
  truncated: boolean;
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
  /**
   * GĐ6 — đọc **giá trị của một cột** để dựng biểu đồ (histogram / box plot /
   * biểu đồ cột phân loại).
   *
   * Vì sao không dùng `listAllRecords()`: hàm đó tải **toàn bộ** bản ghi kèm
   * mọi cột → peak-RAM rất lớn với dataset lớn (xem GĐ0). Ở đây chỉ đọc
   * **một** cột (`$project`), và có `limit` để chặn.
   *
   * Giá trị được ép kiểu theo `dataType` phía server (`$convert`) → cột `number`
   * lưu chuỗi (dữ liệu cũ) vẫn tính đúng.
   */
  getColumnValues(
    datasetId: string,
    columnKey: string,
    dataType: ColumnDataType,
    limit: number,
  ): Promise<ColumnValuesResult>;
}
