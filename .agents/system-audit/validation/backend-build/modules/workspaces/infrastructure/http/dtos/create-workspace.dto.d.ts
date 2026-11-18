import { z } from 'zod';
export declare const CreateWorkspaceSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
}>;
export type CreateWorkspaceDto = z.infer<typeof CreateWorkspaceSchema>;
