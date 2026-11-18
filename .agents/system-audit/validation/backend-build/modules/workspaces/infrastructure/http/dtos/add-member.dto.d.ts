import { z } from 'zod';
export declare const AddMemberSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["owner", "member"]>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: "member" | "owner";
}, {
    email: string;
    role?: "member" | "owner" | undefined;
}>;
export type AddMemberDto = z.infer<typeof AddMemberSchema>;
