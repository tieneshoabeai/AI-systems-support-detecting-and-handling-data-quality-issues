import { z } from 'zod';

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên dự án không được để trống')
    .max(100, 'Tên dự án tối đa 100 ký tự'),
  description: z
    .string()
    .trim()
    .max(500, 'Mô tả tối đa 500 ký tự')
    .optional(),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
