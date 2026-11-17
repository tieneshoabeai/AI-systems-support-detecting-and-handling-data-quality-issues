import { z } from 'zod';
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const ResetPasswordSchema: z.ZodObject<{
    email: z.ZodString;
    otp: z.ZodString;
    new_password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    otp: string;
    new_password: string;
}, {
    email: string;
    otp: string;
    new_password: string;
}>;
export declare const ChangePasswordSchema: z.ZodObject<{
    current_password: z.ZodString;
    new_password: z.ZodString;
    confirm_password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    current_password: string;
    new_password: string;
    confirm_password: string;
}, {
    current_password: string;
    new_password: string;
    confirm_password: string;
}>;
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;
