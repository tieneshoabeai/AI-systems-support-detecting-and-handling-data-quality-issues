import { z } from 'zod';

/**
 * DTO cho `PATCH /datasets/:id/columns/pii` — GĐ4.
 *
 * **Vì sao route riêng thay vì sửa `PATCH /datasets/:id/columns`?**
 * Nguyên tắc bất biến dữ liệu của nhánh này: "dữ liệu nạp vào như nào thì
 * phải là như vậy" — sau khi nạp, **nội dung dataset không được sửa**. Route
 * `PATCH /datasets/:id/columns` (đổi tên cột) đã bị gỡ.
 *
 * Cờ `isPii` **không phải nội dung dữ liệu** — đó là *metadata phân loại cột*,
 * nằm ngoài bản chụp dữ liệu. Cho phép sửa nó giữ nguyên nguyên tắc bất biến,
 * đồng thời mở đường cho tính năng che PII trước khi đưa dữ liệu lên prompt AI.
 *
 * Route tách riêng (thay vì gộp vào route đổi tên) giữ ranh giới rõ ràng:
 *   - `PATCH /datasets/:id/columns`      → đổi tên cột  → **đã gỡ** (đụng nội dung)
 *   - `PATCH /datasets/:id/columns/pii`  → gắn cờ PII    → **giữ** (chỉ metadata)
 */

/**
 * Schema cập nhật cờ PII cho một hoặc nhiều cột.
 *
 * - `columnKey`: key cột ổn định `c{i}` (S21) — dùng key để không phụ thuộc
 *   tên hiển thị (tên có thể trùng/khoảng trắng).
 * - `isPii`: `true` = cột chứa dữ liệu nhạy cảm (luôn che trước khi gửi AI).
 */
export const UpdateColumnPiiSchema = z
  .object({
    columns: z
      .array(
        z.object({
          columnKey: z.string().min(1).max(64),
          isPii: z.boolean(),
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

export type UpdateColumnPiiDto = z.infer<typeof UpdateColumnPiiSchema>;
