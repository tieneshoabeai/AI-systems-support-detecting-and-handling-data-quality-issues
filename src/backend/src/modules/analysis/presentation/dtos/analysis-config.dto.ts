import { z } from 'zod';

/**
 * GĐ7 — Ghi đè vai trò cột.
 *
 * Key là **key cột ổn định** (`c0`, `c1`, …) — KHÔNG phải tên hiển thị.
 * Dùng key bất biến để việc người dùng đổi tên cột không làm mất ghi đè.
 *
 * Giá trị là enum vai trò; tính hợp lệ theo **kiểu dữ liệu** của cột được
 * kiểm tra thêm ở `SaveConfigHandler` (vd `measure` chỉ hợp lệ với cột `number`).
 *
 * `null` → xoá hết ghi đè; `undefined` → giữ nguyên cấu hình cũ.
 */
export const ColumnRolesSchema = z
  .record(
    z.string().regex(/^c\d+$/, 'Key cột phải có dạng c0, c1, ...'),
    z.enum(['identifier', 'category', 'measure', 'text', 'datetime']),
  )
  .nullable()
  .optional();

export const AnalysisConfigSchema = z.object({
  selected_columns: z.array(z.string().min(1)).max(200).nullable().optional(),
  label_column: z.string().min(1).max(120).nullable().optional(),
  time_column: z.string().min(1).max(120).nullable().optional(),
  time_granularity: z.enum(['day', 'week', 'month', 'year']).default('day'),
  value_column: z.string().min(1).max(120).nullable().optional(),
  correlation_method: z.enum(['pearson', 'spearman']).default('pearson'),
  outlier_method: z.enum(['iqr', 'modified_zscore', 'both']).default('iqr'),
  top_n: z.coerce.number().int().min(1).max(100).default(10),
  /** GĐ7 — ghi đè vai trò cột: `{ [columnKey]: 'identifier' | ... }`. */
  column_roles: ColumnRolesSchema,
});

export type AnalysisConfigDto = z.infer<typeof AnalysisConfigSchema>;
