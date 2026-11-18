import { z } from 'zod';

/**
 * PROJ-01 — Tạo dự án trong không gian làm việc.
 *
 * `owner_id` (F1): chỉ định Project Owner. Nếu bỏ trống → người tạo
 * (Workspace Owner) làm Project Owner. Người được chỉ định phải là
 * **thành viên của workspace** (F2), nếu không sẽ trả 400.
 */
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
  owner_id: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'owner_id không hợp lệ (phải là ObjectId hex 24 ký tự)')
    .optional(),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;
