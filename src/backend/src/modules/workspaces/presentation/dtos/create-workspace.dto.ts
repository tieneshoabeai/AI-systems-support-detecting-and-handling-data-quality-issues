import { z } from 'zod';

export const CreateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên không gian làm việc không được để trống')
    .max(100, 'Tên không gian làm việc tối đa 100 ký tự'),
  description: z
    .string()
    .trim()
    .max(500, 'Mô tả tối đa 500 ký tự')
    .optional(),
  /**
   * H2 — Danh sách email thành viên được mời kèm lúc tạo workspace.
   * Email phải hợp lệ; email chưa có tài khoản sẽ bị báo lỗi rõ ràng (400).
   */
  member_emails: z
    .array(
      z
        .string()
        .trim()
        .email('Định dạng email không hợp lệ')
        .toLowerCase(),
    )
    .max(50, 'Tối đa 50 email thành viên')
    .optional(),
});

export type CreateWorkspaceDto = z.infer<typeof CreateWorkspaceSchema>;
