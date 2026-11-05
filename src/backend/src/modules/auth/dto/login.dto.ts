import { z } from 'zod';
import { EmailSchema } from '../../../shared/validation/common-schemas';

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

export type LoginDto = z.infer<typeof LoginSchema>;
