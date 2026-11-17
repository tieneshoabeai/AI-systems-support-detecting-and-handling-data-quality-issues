import { z } from 'zod';

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
});

export type AnalysisConfigDto = z.infer<typeof AnalysisConfigSchema>;
