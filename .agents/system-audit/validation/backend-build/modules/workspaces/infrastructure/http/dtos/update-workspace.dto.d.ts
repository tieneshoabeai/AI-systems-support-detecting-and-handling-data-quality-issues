import { z } from 'zod';
export declare const UpdateWorkspaceSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    expectedVersion: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    expectedVersion?: number | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    expectedVersion?: number | undefined;
}>;
export type UpdateWorkspaceDto = z.infer<typeof UpdateWorkspaceSchema>;
