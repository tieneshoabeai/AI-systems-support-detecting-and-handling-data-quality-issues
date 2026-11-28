import { z } from 'zod';

export const EvidenceSampleKindSchema = z.enum([
  'missing',
  'duplicate',
  'invalid_type',
  'outlier',
]);

export const ListEvidenceSamplesQuerySchema = z.object({
  findingId: z.string().trim().min(1).max(256).optional(),
  kind: EvidenceSampleKindSchema.optional(),
  column: z.string().trim().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().regex(/^[a-f\d]{24}$/i, 'Cursor không hợp lệ').optional(),
});

export type ListEvidenceSamplesQueryDto = z.infer<typeof ListEvidenceSamplesQuerySchema>;
