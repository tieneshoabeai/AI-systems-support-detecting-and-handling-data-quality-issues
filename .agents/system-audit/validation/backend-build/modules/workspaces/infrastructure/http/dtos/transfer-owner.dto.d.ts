import { z } from 'zod';
export declare const TransferOwnerSchema: z.ZodObject<{
    email: z.ZodString;
    expectedVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    email: string;
    expectedVersion: number;
}, {
    email: string;
    expectedVersion: number;
}>;
export type TransferOwnerDto = z.infer<typeof TransferOwnerSchema>;
