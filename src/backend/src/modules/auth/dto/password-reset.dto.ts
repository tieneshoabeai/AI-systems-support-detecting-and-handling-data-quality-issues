import { z } from 'zod';
import { EmailSchema, PasswordSchema } from '../../../shared/validation/common-schemas';

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token không được để trống'),
  new_password: PasswordSchema,
});

export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
