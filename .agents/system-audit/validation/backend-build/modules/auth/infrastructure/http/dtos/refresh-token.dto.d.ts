import { z } from 'zod';
export declare const RefreshTokenSchema: z.ZodObject<{
    refresh_token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refresh_token: string;
}, {
    refresh_token: string;
}>;
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
