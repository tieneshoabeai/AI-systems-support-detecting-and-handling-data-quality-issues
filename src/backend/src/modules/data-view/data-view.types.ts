/** DATA-VIEW — Types (Template Simple). Gop application types + entity RecordQuery + VO limit/filter. */
/**
 * DATA-VIEW — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

export interface GetRecordsInput {
  cursor?: string;
  limit?: number;
  sort_order?: 'asc' | 'desc';
  sort_field?: string;
}

export interface QueryRecordsBodyInput {
  filters?: Array<{ column: string; operator: RecordFilterOperator; value?: unknown }>;
  sort?: Array<{ column: string; order: 'asc' | 'desc' }>;
  search?: { columns: string[]; value: string };
  cursor?: string;
  limit?: number;
}

export interface ColumnStatsResult {
  column_key: string;
  column_name: string;
  total_records: number;
  null_count: number;
  missing_ratio: number;
  min?: number;
  max?: number;
  average?: number;
  histogram: { bucket_start: number; bucket_end: number; count: number }[];
}

// ── GĐ6 — Dữ liệu biểu đồ (E1) ─────────────────────────────────────────

export interface ChartHistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface ChartHistogram {
  column_key: string;
  column_name: string;
  method: 'freedman_diaconis' | 'sturges' | 'single_value';
  bins: ChartHistogramBin[];
}

export interface ChartBoxPlot {
  column_key: string;
  column_name: string;
  q1: number;
  median: number;
  q3: number;
  whisker_low: number;
  whisker_high: number;
  /** Số giá trị nằm ngoài rào (IQR 1.5) — **không** mặc định là lỗi. */
  outside_count: number;
  n: number;
}

export interface ChartCategoryItem {
  value: string;
  count: number;
  rate: number;
}

export interface ChartCategory {
  column_key: string;
  column_name: string;
  top_n: number;
  items: ChartCategoryItem[];
  /** Nhóm "Khác" — phần còn lại ngoài Top N. `null` nếu không có. */
  other: { count: number; rate: number } | null;
  distinct_count: number;
  /** `true` khi cột PII bị ẩn giá trị Top N (chỉ trả missing/distinct). */
  masked?: boolean;
}

export interface ChartDataResult {
  column_key: string;
  column_name: string;
  data_type: 'string' | 'number' | 'boolean' | 'date';
  total_records: number;
  sampled_records: number;
  /** `true` khi số liệu biểu đồ tính trên **mẫu** chứ không phải toàn bộ. */
  truncated: boolean;
  missing_count: number;
  missing_ratio: number;
  /** Chỉ có với cột `number`. */
  histogram?: ChartHistogram;
  /** Chỉ có với cột `number`. */
  box_plot?: ChartBoxPlot;
  /** Chỉ có với cột `string` / `boolean`. */
  category?: ChartCategory;
}

// --- Gop tu domain/entities/record-query.entity.ts ---

export interface RecordQueryProps {
  datasetId: string;
  limit: number;
}

export class RecordQuery {
  private constructor(private readonly props: RecordQueryProps) {}

  static create(props: RecordQueryProps): RecordQuery {
    return new RecordQuery({ ...props, limit: normalizeRecordLimit(props.limit) });
  }

  get limit(): number {
    return this.props.limit;
  }

  static fieldPath(columnKey: string): string {
    return propsPath(columnKey);
  }
}

// --- Gop tu domain/value-objects/record-query.vo.ts ---
export const DEFAULT_RECORD_LIMIT = 50;

export const MAX_RECORD_LIMIT = 500;

export function normalizeRecordLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || (limit as number) <= 0) return DEFAULT_RECORD_LIMIT;
  return Math.min(Math.floor(limit as number), MAX_RECORD_LIMIT);
}

// --- Gop tu domain/value-objects/record-filter.vo.ts ---
/**
 * DATA-VIEW — Value objects pure (domain).
 * Khong phu thuoc NestJS/Mongoose. Chua operator hop le + props path + resolve key.
 */

export const RECORD_FILTER_OPERATORS = [
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'between',
  'in',
  'isEmpty',
  'isNotEmpty',
] as const;

export type RecordFilterOperator = (typeof RECORD_FILTER_OPERATORS)[number];

export function isValidOperator(op: string): op is RecordFilterOperator {
  return (RECORD_FILTER_OPERATORS as readonly string[]).includes(op);
}

export function propsPath(columnKey: string): string {
  return `props.${columnKey}`;
}

/** Giai key cot: uu tien key c{i}, sau do ten hien thi / ten goc. Pure, dung o application. */
export function resolveColumnKeyPure(
  input: string,
  keys: string[],
  names: Map<string, string>,
): string | null {
  if (keys.includes(input)) return input;
  const hit = names.get(input);
  return hit ?? null;
}
