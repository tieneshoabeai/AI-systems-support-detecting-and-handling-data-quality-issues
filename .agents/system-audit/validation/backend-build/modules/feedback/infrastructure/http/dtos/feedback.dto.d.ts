import { z } from 'zod';
export declare const FeedbackLabelSchema: z.ZodEnum<["correct", "partially_correct", "false_positive", "missed_issue", "other"]>;
export declare const FeedbackSeveritySchema: z.ZodEnum<["low", "medium", "high", "critical"]>;
export declare const CreateFeedbackSchema: z.ZodEffects<z.ZodObject<{
    label: z.ZodEnum<["correct", "partially_correct", "false_positive", "missed_issue", "other"]>;
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    suggestedSeverity: z.ZodNullable<z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>>;
}, "strip", z.ZodTypeAny, {
    label: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct";
    reason?: string | null | undefined;
    suggestedSeverity?: "critical" | "high" | "low" | "medium" | null | undefined;
}, {
    label: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct";
    reason?: string | null | undefined;
    suggestedSeverity?: "critical" | "high" | "low" | "medium" | null | undefined;
}>, {
    label: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct";
    reason?: string | null | undefined;
    suggestedSeverity?: "critical" | "high" | "low" | "medium" | null | undefined;
}, {
    label: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct";
    reason?: string | null | undefined;
    suggestedSeverity?: "critical" | "high" | "low" | "medium" | null | undefined;
}>;
export type CreateFeedbackDto = z.infer<typeof CreateFeedbackSchema>;
export declare const UpdateFeedbackSchema: z.ZodEffects<z.ZodObject<{
    label: z.ZodOptional<z.ZodEnum<["correct", "partially_correct", "false_positive", "missed_issue", "other"]>>;
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    suggestedSeverity: z.ZodNullable<z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>>;
}, "strip", z.ZodTypeAny, {
    label?: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct" | undefined;
    reason?: string | null | undefined;
    suggestedSeverity?: "critical" | "high" | "low" | "medium" | null | undefined;
}, {
    label?: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct" | undefined;
    reason?: string | null | undefined;
    suggestedSeverity?: "critical" | "high" | "low" | "medium" | null | undefined;
}>, {
    label?: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct" | undefined;
    reason?: string | null | undefined;
    suggestedSeverity?: "critical" | "high" | "low" | "medium" | null | undefined;
}, {
    label?: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct" | undefined;
    reason?: string | null | undefined;
    suggestedSeverity?: "critical" | "high" | "low" | "medium" | null | undefined;
}>;
export type UpdateFeedbackDto = z.infer<typeof UpdateFeedbackSchema>;
export declare const ListFeedbackQuerySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodEnum<["correct", "partially_correct", "false_positive", "missed_issue", "other"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
    label?: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct" | undefined;
    sortOrder: "asc" | "desc";
}, {
    limit?: number | undefined;
    cursor?: string | undefined;
    label?: "correct" | "false_positive" | "missed_issue" | "other" | "partially_correct" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
}>;
export type ListFeedbackQueryDto = z.infer<typeof ListFeedbackQuerySchema>;
