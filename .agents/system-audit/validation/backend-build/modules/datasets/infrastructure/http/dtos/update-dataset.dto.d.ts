import { z } from 'zod';
export declare const UpdateDatasetSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
}, {
    name?: string | undefined;
}>;
export type UpdateDatasetDto = z.infer<typeof UpdateDatasetSchema>;
