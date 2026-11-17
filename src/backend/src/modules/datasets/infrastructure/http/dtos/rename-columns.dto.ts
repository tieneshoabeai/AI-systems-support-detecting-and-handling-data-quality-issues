import { z } from 'zod';

/**
 * Wave 4: doi ten cot hien thi. Dot F (Phan 7 v8 muc 3.19): them `is_pii` de danh dau cot PII;
 * moi phan tu can it nhat mot trong `name` / `is_pii`.
 */
export const RenameColumnItemSchema = z
  .object({
    key: z.string().regex(/^c\d+$/, 'key cot phai co dang c{i} (vi du c0)'),
    name: z.string().trim().min(1, 'Ten cot khong duoc de trong').max(120).optional(),
    is_pii: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.is_pii !== undefined, {
    message: 'Can it nhat mot trong name / is_pii',
  });

export const RenameColumnsSchema = z.object({
  columns: z.array(RenameColumnItemSchema).min(1).max(1000),
});

export type RenameColumnItemDto = z.infer<typeof RenameColumnItemSchema>;
export type RenameColumnsDto = z.infer<typeof RenameColumnsSchema>;
