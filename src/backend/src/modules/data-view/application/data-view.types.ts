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
