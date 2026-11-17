import { z } from 'zod';
export declare const ListNotificationsQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    read: z.ZodDefault<z.ZodEnum<["true", "false", "all"]>>;
}, "strip", z.ZodTypeAny, {
    cursor?: string | undefined;
    limit: number;
    sortBy: "createdAt";
    sortOrder: "asc" | "desc";
    read: "all" | "false" | "true";
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
    sortBy?: "createdAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    read?: "all" | "false" | "true" | undefined;
}>;
export type ListNotificationsQueryDto = z.infer<typeof ListNotificationsQuerySchema>;
