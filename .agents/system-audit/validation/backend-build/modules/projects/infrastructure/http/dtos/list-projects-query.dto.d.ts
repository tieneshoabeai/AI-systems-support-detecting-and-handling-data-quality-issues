import { z } from 'zod';
export declare const ListProjectsQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["not_started", "in_progress", "completed"]>>;
    sort: z.ZodDefault<z.ZodEnum<["last_accessed", "updated", "name_asc", "name_desc", "joined"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    status?: "completed" | "in_progress" | "not_started" | undefined;
    sort: "joined" | "last_accessed" | "name_asc" | "name_desc" | "updated";
    page: number;
    limit: number;
}, {
    search?: string | undefined;
    status?: "completed" | "in_progress" | "not_started" | undefined;
    sort?: "joined" | "last_accessed" | "name_asc" | "name_desc" | "updated" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type ListProjectsQueryDto = z.infer<typeof ListProjectsQuerySchema>;
