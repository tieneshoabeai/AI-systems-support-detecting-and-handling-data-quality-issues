"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListFeedbackQuerySchema = exports.UpdateFeedbackSchema = exports.CreateFeedbackSchema = exports.FeedbackSeveritySchema = exports.FeedbackLabelSchema = void 0;
const zod_1 = require("zod");
exports.FeedbackLabelSchema = zod_1.z.enum([
    'correct',
    'partially_correct',
    'false_positive',
    'missed_issue',
    'other',
]);
exports.FeedbackSeveritySchema = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
exports.CreateFeedbackSchema = zod_1.z
    .object({
    label: exports.FeedbackLabelSchema,
    reason: zod_1.z.string().max(2000).optional().nullable(),
    suggestedSeverity: exports.FeedbackSeveritySchema.optional().nullable(),
})
    .superRefine((v, ctx) => {
    if ((v.label === 'false_positive' || v.label === 'missed_issue' || v.label === 'other') &&
        (!v.reason || v.reason.trim().length === 0)) {
        ctx.addIssue({
            code: 'custom',
            message: 'Nhãn này bắt buộc kèm lý do (reason)',
            path: ['reason'],
        });
    }
});
exports.UpdateFeedbackSchema = zod_1.z
    .object({
    label: exports.FeedbackLabelSchema.optional(),
    reason: zod_1.z.string().max(2000).optional().nullable(),
    suggestedSeverity: exports.FeedbackSeveritySchema.optional().nullable(),
})
    .refine((v) => v.label !== undefined || v.reason !== undefined || v.suggestedSeverity !== undefined, {
    message: 'Phải cung cấp ít nhất một trường để sửa',
});
exports.ListFeedbackQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    cursor: zod_1.z.string().optional(),
    label: exports.FeedbackLabelSchema.optional(),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
});
//# sourceMappingURL=feedback.dto.js.map