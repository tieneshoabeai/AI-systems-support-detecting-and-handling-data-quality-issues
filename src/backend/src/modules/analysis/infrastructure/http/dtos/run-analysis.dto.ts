import { z } from 'zod';

export const RunAnalysisSchema = z.object({
  selected_columns: z.array(z.string().min(1)).max(200).optional(),
  correlation_method: z.enum(['pearson', 'spearman']).default('pearson'),
  outlier_method: z.enum(['iqr', 'modified_zscore', 'both']).default('iqr'),
  top_n: z.coerce.number().int().min(1).max(100).default(10),
});

export type RunAnalysisDto = z.infer<typeof RunAnalysisSchema>;
