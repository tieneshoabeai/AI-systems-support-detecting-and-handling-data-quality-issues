import { z } from 'zod';

export const ListNotificationsQuerySchema = z.object({
  cursor: z.string().min(1).max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  read: z.enum(['true', 'false', 'all']).default('all'),
});

export type ListNotificationsQueryDto = z.infer<typeof ListNotificationsQuerySchema>;
