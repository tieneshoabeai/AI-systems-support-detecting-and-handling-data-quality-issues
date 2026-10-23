import { z } from 'zod';

export const UpdateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên không gian làm việc không được để trống')
    .max(100, 'Tên không gian làm việc tối đa 100 ký tự')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Mô tả tối đa 500 ký tự')
    .optional(),
});

export type UpdateWorkspaceDto = z.infer<typeof UpdateWorkspaceSchema>;
