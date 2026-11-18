import { z } from 'zod';
export declare const MongoIdSchema: z.ZodString;
export declare const EmailSchema: z.ZodString;
export declare const PasswordSchema: z.ZodString;
export declare const PaginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
export declare const CursorQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    sort_by: z.ZodOptional<z.ZodString>;
    order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    cursor?: string | undefined;
    limit: number;
    sort_by?: string | undefined;
    order: "asc" | "desc";
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
    sort_by?: string | undefined;
    order?: "asc" | "desc" | undefined;
}>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type CursorQuery = z.infer<typeof CursorQuerySchema>;
