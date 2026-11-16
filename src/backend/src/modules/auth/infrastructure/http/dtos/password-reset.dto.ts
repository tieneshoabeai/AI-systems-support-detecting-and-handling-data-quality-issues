import { z } from 'zod';
import { EmailSchema, PasswordSchema } from '../../../../../shared/validation/common-schemas';

// AUTH-05: Quên mật khẩu — gửi OTP 6 số qua email
export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

// AUTH-06: Đặt lại mật khẩu bằng OTP (email + otp + mật khẩu mới)
export const ResetPasswordSchema = z.object({
  email: EmailSchema,
  otp: z.string().trim().regex(/^\d{6}$/, 'Mã OTP gồm đúng 6 chữ số'),
  new_password: PasswordSchema,
});

// AUTH-07: Đổi mật khẩu khi đã đăng nhập (xác minh mật khẩu hiện tại + 2 lần nhập khớp)
export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
  new_password: PasswordSchema,
  confirm_password: z.string().min(1, 'Xác nhận mật khẩu không được để trống'),
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
