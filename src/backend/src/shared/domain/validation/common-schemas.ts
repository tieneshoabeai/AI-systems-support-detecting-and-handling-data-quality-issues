import { z } from 'zod';

export const MongoIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'ID không phải định dạng MongoDB ObjectId hợp lệ');

export const EmailSchema = z
  .string()
  .email('Định dạng email không hợp lệ')
  .toLowerCase()
  .trim();

export const PasswordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có độ dài tối thiểu 8 ký tự')
  .max(100, 'Mật khẩu không được vượt quá 100 ký tự');

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  sort_by: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type CursorQuery = z.infer<typeof CursorQuerySchema>;
