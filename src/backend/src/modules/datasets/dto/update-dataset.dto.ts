import { z } from 'zod';

export const UpdateDatasetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên tập dữ liệu không được để trống')
    .max(100, 'Tên tập dữ liệu tối đa 100 ký tự')
    .optional(),
});

export type UpdateDatasetDto = z.infer<typeof UpdateDatasetSchema>;
