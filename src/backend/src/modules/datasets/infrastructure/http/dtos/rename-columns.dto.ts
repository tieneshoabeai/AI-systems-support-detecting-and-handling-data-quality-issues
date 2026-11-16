import { z } from 'zod';

export const RenameColumnItemSchema = z.object({
  key: z.string().regex(/^c\d+$/, 'key cot phai co dang c{i} (vi du c0)'),
  name: z.string().trim().min(1, 'Ten cot khong duoc de trong').max(120),
});

export const RenameColumnsSchema = z.object({
  columns: z.array(RenameColumnItemSchema).min(1).max(1000),
});

export type RenameColumnItemDto = z.infer<typeof RenameColumnItemSchema>;
export type RenameColumnsDto = z.infer<typeof RenameColumnsSchema>;
