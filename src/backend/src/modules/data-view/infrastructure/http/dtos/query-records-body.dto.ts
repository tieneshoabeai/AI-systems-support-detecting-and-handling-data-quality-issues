import { z } from 'zod';

/**
 * Phần 7 v6 mục 3.7 — Bộ lọc Data Views.
 * Lọc + sắp xếp + tìm kiếm chạy phía server (MongoDB) để không tải toàn bộ
 * 200.000 bản ghi vào bộ nhớ/JS. Phân trang bằng cursor (keyset) theo row_index.
 */

export const RecordFilterOperatorSchema = z.enum([
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'between',
  'in',
  'isEmpty',
  'isNotEmpty',
]);

export type RecordFilterOperator = z.infer<typeof RecordFilterOperatorSchema>;

export const RecordFilterSchema = z
  .object({
    column: z.string().min(1).max(120),
    operator: RecordFilterOperatorSchema,
    value: z.unknown().optional(),
  })
  .refine(
    (f) =>
      f.operator === 'isEmpty' ||
      f.operator === 'isNotEmpty' ||
      (f.value !== undefined && f.value !== null && f.value !== ''),
    { message: 'Bộ lọc yêu cầu có value (trừ isEmpty/isNotEmpty)' },
  )
  .refine((f) => f.operator !== 'between' || (Array.isArray(f.value) && f.value.length === 2), {
    message: 'Bộ lọc "between" yêu cầu value là mảng 2 phần tử [min, max]',
  })
  .refine((f) => f.operator !== 'in' || (Array.isArray(f.value) && f.value.length > 0), {
    message: 'Bộ lọc "in" yêu cầu value là mảng khác rỗng',
  });

export type RecordFilterDto = z.infer<typeof RecordFilterSchema>;

export const RecordSortSchema = z.object({
  column: z.string().min(1).max(120),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type RecordSortDto = z.infer<typeof RecordSortSchema>;

export const RecordSearchSchema = z.object({
  columns: z.array(z.string().min(1).max(120)).min(1).max(20),
  value: z.string().max(200),
});

export type RecordSearchDto = z.infer<typeof RecordSearchSchema>;

export const QueryRecordsBodySchema = z.object({
  filters: z.array(RecordFilterSchema).max(30).optional().default([]),
  sort: z.array(RecordSortSchema).max(5).optional().default([]),
  search: RecordSearchSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type QueryRecordsBodyDto = z.infer<typeof QueryRecordsBodySchema>;
