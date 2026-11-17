import { z } from 'zod';
export declare const UpdateUserSchema: z.ZodObject<{
    first_name: z.ZodOptional<z.ZodString>;
    last_name: z.ZodOptional<z.ZodString>;
    avatar_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    first_name?: string | undefined;
    last_name?: string | undefined;
    avatar_url?: string | undefined;
}, {
    first_name?: string | undefined;
    last_name?: string | undefined;
    avatar_url?: string | undefined;
}>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
