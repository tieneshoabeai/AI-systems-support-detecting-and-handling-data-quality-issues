import { z } from 'zod';

/**
 * DTO cho `PATCH /datasets/:id/columns` — đổi **tên hiển thị** của nhiều cột
 * trong một lần (contract §3.13 #47 `VIEW-08`).
 *
 * - `columnKey`: key cột ổn định `c{i}` (S21) — dùng key để không phụ thuộc
 *   tên hiển thị (tên có thể trùng/khoảng trắng).
 * - `name`: tên hiển thị mới — **không** tự trim/sanitize (UC-10 bước 1).
 */
export const UpdateColumnNamesSchema = z
  .object({
    columns: z
      .array(
        z.object({
          columnKey: z.string().min(1).max(64),
          name: z.string().min(1, 'Tên cột không được rỗng').max(100, 'Tên cột tối đa 100 ký tự'),
        }),
      )
      .min(1, 'Phải cung cấp ít nhất một cột')
      .max(200, 'Tối đa 200 cột mỗi lần cập nhật'),
  })
  .superRefine((v, ctx): void => {
    const seen = new Set<string>();
    for (const [i, c] of v.columns.entries()) {
      if (seen.has(c.columnKey)) {
        ctx.addIssue({
          code: 'custom',
          message: `Cột "${c.columnKey}" bị lặp trong payload`,
          path: ['columns', i, 'columnKey'],
        });
      }
      seen.add(c.columnKey);
    }
  });

export type UpdateColumnNamesDto = z.infer<typeof UpdateColumnNamesSchema>;
