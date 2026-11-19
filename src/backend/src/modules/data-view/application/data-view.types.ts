/**
 * DATA-VIEW — Kiểu dữ liệu tầng application (input/output contract).
 *
 * Tách ra khỏi service gốc khi áp dụng §3.10 Command/Query pattern.
 * Không import HTTP, không import infrastructure.
 */

import type { RecordFilterOperator } from '../../datasets';

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
