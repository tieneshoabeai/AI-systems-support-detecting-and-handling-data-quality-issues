import { z } from 'zod';

/**
 * DTO cho `PATCH /datasets/:id` — cập nhật **tên hiển thị** dataset
 * (contract §3.13 #46 `VIEW-08`).
 *
 * Chỉ `name` — mô tả/metadata khác chưa có trong schema `dataset`.
 */
export const UpdateDatasetMetadataSchema = z.object({
  name: z.string().min(1, 'Tên không được rỗng').max(100, 'Tên tối đa 100 ký tự'),
});

export type UpdateDatasetMetadataDto = z.infer<typeof UpdateDatasetMetadataSchema>;
