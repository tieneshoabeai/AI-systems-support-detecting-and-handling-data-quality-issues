import { z } from 'zod';
import { EmailSchema, PasswordSchema } from '../../../shared/validation/common-schemas';

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  first_name: z
    .string()
    .min(1, 'Họ không được để trống')
    .max(50, 'Họ không được vượt quá 50 ký tự')
    .trim(),
  last_name: z
    .string()
    .min(1, 'Tên không được để trống')
    .max(50, 'Tên không được vượt quá 50 ký tự')
    .trim(),
  role: z.enum(['admin', 'analyst']).default('analyst'),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
