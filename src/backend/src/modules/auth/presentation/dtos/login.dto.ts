import { z } from 'zod';
import { EmailSchema } from '../../../../shared/domain/validation/common-schemas';

/**
 * "Ghi nhớ đăng nhập" — hạn phiên 30 ngày (`JWT_REFRESH_REMEMBER_EXPIRATION`)
 * thay vì 7 ngày. Access token vẫn dùng hạn ngắn `JWT_ACCESS_EXPIRATION`.
 *
 * ## Tên field: `remember_me` là chuẩn duy nhất
 *
 * Toàn bộ module Auth dùng **snake_case** cho input (`first_name`, `last_name`,
 * `refresh_token`, `remember_me`). `rememberMe` chỉ là **alias camelCase** được
 * giữ lại để không phá vỡ client cũ — nó **không phải** một tính năng riêng.
 *
 * Quy tắc:
 * - Gửi `remember_me` → dùng giá trị này.
 * - Gửi `rememberMe` (alias) → vẫn chạy được, nhưng **deprecated**.
 * - Gửi **cả hai** với giá trị **khác nhau** → `400 VALIDATION_ERROR`.
 *   Trước đây hệ thống âm thầm ưu tiên `remember_me`, khiến client không biết
 *   mình đã bị bỏ qua `rememberMe`. Nay lỗi này được báo rõ ràng.
 * - Gửi cả hai với giá trị **giống nhau** → hợp lệ.
 * - Gửi cả hai với cùng giá trị `false` → hợp lệ.
 *
 * Lưu ý kỹ thuật: `superRefine` phải đứng **trước** `.transform()` — Zod không
 * cho phép `transform` chạy trên schema đã có hiệu ứng kiểm tra.
 */
export const LoginSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1, 'Mật khẩu không được để trống'),
    /** Chuẩn duy nhất — ưu tiên khi cả hai field cùng được gửi. */
    remember_me: z
      .boolean()
      .optional()
      .describe('Ghi nhớ đăng nhập: true → phiên 30 ngày, false/mặc định → 7 ngày.'),
    /** Alias camelCase — deprecated, dùng `remember_me` thay thế. */
    rememberMe: z
      .boolean()
      .optional()
      .describe(
        'Deprecated — alias của `remember_me`. Sẽ bị gỡ trong phiên bản sau. ' +
          'Không gửi cùng `remember_me` với giá trị khác nhau (sẽ trả 400).',
      ),
  })
  .superRefine((v, ctx) => {
    if (
      v.remember_me !== undefined &&
      v.rememberMe !== undefined &&
      v.remember_me !== v.rememberMe
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rememberMe'],
        message:
          'remember_me và rememberMe không được gửi cùng lúc với giá trị khác nhau. ' +
          'Chỉ dùng `remember_me`.',
      });
    }
  })
  .transform((v): { email: string; password: string; remember_me: boolean } => ({
    email: v.email,
    password: v.password,
    remember_me: v.remember_me ?? v.rememberMe ?? false,
  }));

export type LoginDto = z.infer<typeof LoginSchema>;
