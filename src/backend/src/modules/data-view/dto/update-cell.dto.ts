import { z } from 'zod';

export const UpdateCellSchema = z.object({
  field: z.string().trim().min(1, 'Tên trường cần sửa không được để trống'),
  value: z.unknown(),
});

export type UpdateCellDto = z.infer<typeof UpdateCellSchema>;
