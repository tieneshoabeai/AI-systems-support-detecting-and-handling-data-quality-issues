import { z } from 'zod';

/**
 * OPEN-06 — Cấu hình phân tích **tự suy luận**.
 *
 * Không còn "cấu hình cột phân tích" thủ công: hệ thống tự suy ra cột đo /
 * cột phân loại / cột thời gian / cột nhãn từ schema + tên cột.
 *
 * Body chỉ còn **tham số phương pháp** (điều chỉnh được an toàn, không phụ
 * thuộc dữ liệu) → có thể gửi `{}`.
 */
export const RunAnalysisSchema = z.object({
  correlation_method: z.enum(['pearson', 'spearman']).default('pearson'),
  outlier_method: z.enum(['iqr', 'modified_zscore', 'both']).default('iqr'),
  top_n: z.coerce.number().int().min(1).max(100).default(10),
});

export type RunAnalysisDto = z.infer<typeof RunAnalysisSchema>;
