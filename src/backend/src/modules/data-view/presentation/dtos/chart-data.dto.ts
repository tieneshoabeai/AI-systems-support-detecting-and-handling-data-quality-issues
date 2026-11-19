import { z } from 'zod';

/**
 * GĐ6 — Tham số truy vấn dữ liệu biểu đồ.
 *
 * `top_n` mặc định 5, giới hạn 1–20 (mục 3.21 feature catalog).
 */
export const ChartDataSchema = z.object({
  columns: z.string().optional(),
  top_n: z.coerce.number().int().min(1).max(20).default(5),
  max_rows: z.coerce.number().int().min(1).max(50_000).optional(),
});

export type ChartDataDto = z.infer<typeof ChartDataSchema>;
