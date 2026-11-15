import { z } from 'zod';

/**
 * G1 — Số điện thoại (E.164-ish): `+` hoặc không, 8–15 chữ số.
 * Ví dụ hợp lệ: `+84901234567`, `0901234567`.
 */
export const PHONE_REGEX = /^\+?[0-9]{8,15}$/;

export const UpdateUserSchema = z.object({
  first_name: z.string().min(1).max(50).trim().optional(),
  last_name: z.string().min(1).max(50).trim().optional(),
  avatar_url: z.string().url('Avatar URL không hợp lệ').optional(),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .refine(
      (v) => v === null || v === undefined || v === '' || PHONE_REGEX.test(v),
      'Số điện thoại không hợp lệ (8-15 chữ số, có thể bắt đầu bằng +)',
    ),
  bio: z
    .string()
    .trim()
    .max(500, 'Giới thiệu tối đa 500 ký tự')
    .optional()
    .nullable(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
