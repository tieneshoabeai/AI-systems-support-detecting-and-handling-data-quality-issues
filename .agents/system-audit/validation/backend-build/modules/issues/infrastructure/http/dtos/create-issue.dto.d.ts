import { z } from 'zod';
export declare const CreateIssueSchema: z.ZodObject<{
    issueType: z.ZodEnum<["function_error", "display_error", "data_error", "feature_feedback", "other"]>;
    title: z.ZodString;
    description: z.ZodString;
    workspaceId: z.ZodOptional<z.ZodString>;
    apiPath: z.ZodOptional<z.ZodString>;
    errorMessage: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    issueType: "data_error" | "display_error" | "feature_feedback" | "function_error" | "other";
    title: string;
    description: string;
    workspaceId?: string | undefined;
    apiPath?: string | undefined;
    errorMessage?: string | undefined;
    occurredAt?: string | undefined;
}, {
    issueType: "data_error" | "display_error" | "feature_feedback" | "function_error" | "other";
    title: string;
    description: string;
    workspaceId?: string | undefined;
    apiPath?: string | undefined;
    errorMessage?: string | undefined;
    occurredAt?: string | undefined;
}>;
export type CreateIssueDto = z.infer<typeof CreateIssueSchema>;
export declare const ListIssuesQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt", "updatedAt", "status"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    status: z.ZodOptional<z.ZodEnum<["new", "in_progress", "resolved", "closed"]>>;
}, "strip", z.ZodTypeAny, {
    cursor?: string | undefined;
    limit: number;
    sortBy: "createdAt" | "status" | "updatedAt";
    sortOrder: "asc" | "desc";
    status?: "closed" | "in_progress" | "new" | "resolved" | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
    sortBy?: "createdAt" | "status" | "updatedAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    status?: "closed" | "in_progress" | "new" | "resolved" | undefined;
}>;
export type ListIssuesQueryDto = z.infer<typeof ListIssuesQuerySchema>;
export declare const AdminListIssuesQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt", "updatedAt", "status", "severity"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    status: z.ZodOptional<z.ZodEnum<["new", "in_progress", "resolved", "closed"]>>;
}, "strip", z.ZodTypeAny, {
    cursor?: string | undefined;
    limit: number;
    sortBy: "createdAt" | "severity" | "status" | "updatedAt";
    sortOrder: "asc" | "desc";
    status?: "closed" | "in_progress" | "new" | "resolved" | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
    sortBy?: "createdAt" | "severity" | "status" | "updatedAt" | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    status?: "closed" | "in_progress" | "new" | "resolved" | undefined;
}>;
export type AdminListIssuesQueryDto = z.infer<typeof AdminListIssuesQuerySchema>;
export declare const UpdateIssueStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["new", "in_progress", "resolved", "closed"]>;
    expectedVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "closed" | "in_progress" | "new" | "resolved";
    expectedVersion: number;
}, {
    status: "closed" | "in_progress" | "new" | "resolved";
    expectedVersion: number;
}>;
export type UpdateIssueStatusDto = z.infer<typeof UpdateIssueStatusSchema>;
