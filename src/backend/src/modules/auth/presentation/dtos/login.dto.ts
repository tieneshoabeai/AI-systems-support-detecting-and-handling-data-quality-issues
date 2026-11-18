import { z } from 'zod';
import { EmailSchema } from '../../../../shared/domain/validation/common-schemas';

/**
 * "Ghi nhớ đăng nhập" — hạn phiên 30 ngày (`JWT_REFRESH_REMEMBER_EXPIRATION`)
 * thay vì 7 ngày. Access token vẫn dùng hạn ngắn `JWT_ACCESS_EXPIRATION`.
 *
 * Hỗ trợ cả `remember_me` (chuẩn snake_case của module Auth) và `rememberMe`
 * (phong cách camelCase) để frontend không bị bất tiện khi tích hợp.
 */
export const LoginSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1, 'Mật khẩu không được để trống'),
    remember_me: z.boolean().optional(),
    rememberMe: z.boolean().optional(),
  })
  .transform((v) : { email: string; password: string; remember_me: boolean; } => ({
    email: v.email,
    password: v.password,
    remember_me: v.remember_me ?? v.rememberMe ?? false,
  }));

export type LoginDto = z.infer<typeof LoginSchema>;
