import { z } from 'zod';

export const QueryRecordsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort_field: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

export type QueryRecordsDto = z.infer<typeof QueryRecordsSchema>;
