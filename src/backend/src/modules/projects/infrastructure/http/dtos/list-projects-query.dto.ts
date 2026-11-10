import { z } from 'zod';

export const ListProjectsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  sort: z.enum(['last_accessed', 'updated', 'name_asc', 'name_desc', 'joined']).default('last_accessed'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

export type ListProjectsQueryDto = z.infer<typeof ListProjectsQuerySchema>;
