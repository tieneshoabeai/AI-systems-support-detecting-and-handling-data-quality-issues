import { z } from 'zod';
import { ANALYSIS_ROLES } from '../../../domain/column-role.util';

export const AnalysisConfigSchema = z.object({
  selected_columns: z.array(z.string().min(1)).max(200).nullable().optional(),
  label_column: z.string().min(1).max(120).nullable().optional(),
  time_column: z.string().min(1).max(120).nullable().optional(),
  time_granularity: z.enum(['day', 'week', 'month', 'year']).default('day'),
  value_column: z.string().min(1).max(120).nullable().optional(),
  correlation_method: z.enum(['pearson', 'spearman']).default('pearson'),
  outlier_method: z.enum(['iqr', 'modified_zscore', 'both']).default('iqr'),
  top_n: z.coerce.number().int().min(1).max(100).default(50),
  /** Spec 3.21: Top N gia tri pho bien cho bieu do cot phan loai (1–20, mac dinh 5). */
  chart_top_n: z.coerce.number().int().min(1).max(20).default(5),
  /** Đợt F (Phần 7 v8 mục 3.19): ghi đè vai trò cột theo key `c{i}`. */
  column_roles: z
    .record(z.string().regex(/^c\d+$/, 'key cot phai co dang c{i}'), z.enum(ANALYSIS_ROLES))
    .nullable()
    .optional(),
});

export type AnalysisConfigDto = z.infer<typeof AnalysisConfigSchema>;
