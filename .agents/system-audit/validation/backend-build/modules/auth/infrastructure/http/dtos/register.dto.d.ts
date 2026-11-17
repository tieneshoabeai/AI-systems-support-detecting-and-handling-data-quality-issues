import { z } from 'zod';
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    first_name: z.ZodString;
    last_name: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["admin", "analyst"]>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: "admin" | "analyst";
}, {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role?: "admin" | "analyst" | undefined;
}>;
export type RegisterDto = z.infer<typeof RegisterSchema>;
