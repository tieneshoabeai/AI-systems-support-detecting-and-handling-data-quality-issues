import { z } from 'zod';
export declare const QueryRecordsSchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    sort_field: z.ZodOptional<z.ZodString>;
    sort_order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    cursor?: string | undefined;
    limit: number;
    sort_field?: string | undefined;
    sort_order: "asc" | "desc";
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
    sort_field?: string | undefined;
    sort_order?: "asc" | "desc" | undefined;
}>;
export type QueryRecordsDto = z.infer<typeof QueryRecordsSchema>;
