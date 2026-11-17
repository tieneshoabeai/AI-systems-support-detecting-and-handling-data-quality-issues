import { z } from 'zod';
export declare const ListWorkspacesQuerySchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["owner", "member"]>>;
    sort: z.ZodDefault<z.ZodEnum<["last_accessed", "updated", "name_asc", "name_desc", "joined"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    search?: string | undefined;
    role?: "member" | "owner" | undefined;
    sort: "joined" | "last_accessed" | "name_asc" | "name_desc" | "updated";
    page: number;
    limit: number;
}, {
    search?: string | undefined;
    role?: "member" | "owner" | undefined;
    sort?: "joined" | "last_accessed" | "name_asc" | "name_desc" | "updated" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
}>;
export type ListWorkspacesQueryDto = z.infer<typeof ListWorkspacesQuerySchema>;
