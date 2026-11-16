import { z } from 'zod';

export const FeedbackLabelSchema = z.enum([
  'correct',
  'partially_correct',
  'false_positive',
  'missed_issue',
  'other',
]);

export const FeedbackSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const CreateFeedbackSchema = z
  .object({
    label: FeedbackLabelSchema,
    reason: z.string().max(2000).optional().nullable(),
    suggestedSeverity: FeedbackSeveritySchema.optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (
      (v.label === 'false_positive' || v.label === 'missed_issue' || v.label === 'other') &&
      (!v.reason || v.reason.trim().length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Nhãn này bắt buộc kèm lý do (reason)',
        path: ['reason'],
      });
    }
  });

export type CreateFeedbackDto = z.infer<typeof CreateFeedbackSchema>;

export const UpdateFeedbackSchema = z
  .object({
    label: FeedbackLabelSchema.optional(),
    reason: z.string().max(2000).optional().nullable(),
    suggestedSeverity: FeedbackSeveritySchema.optional().nullable(),
  })
  .refine((v) => v.label !== undefined || v.reason !== undefined || v.suggestedSeverity !== undefined, {
    message: 'Phải cung cấp ít nhất một trường để sửa',
  });

export type UpdateFeedbackDto = z.infer<typeof UpdateFeedbackSchema>;

export const ListFeedbackQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  label: FeedbackLabelSchema.optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListFeedbackQueryDto = z.infer<typeof ListFeedbackQuerySchema>;
