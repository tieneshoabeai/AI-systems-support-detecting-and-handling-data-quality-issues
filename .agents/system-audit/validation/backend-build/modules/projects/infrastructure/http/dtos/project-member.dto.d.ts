import { z } from 'zod';
export declare const AddProjectMemberSchema: z.ZodObject<{
    email: z.ZodString;
    role: z.ZodDefault<z.ZodEnum<["member", "viewer"]>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    role: "member" | "viewer";
}, {
    email: string;
    role?: "member" | "viewer" | undefined;
}>;
export type AddProjectMemberDto = z.infer<typeof AddProjectMemberSchema>;
export declare const UpdateProjectMemberSchema: z.ZodObject<{
    role: z.ZodEnum<["member", "viewer"]>;
    expectedVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    role: "member" | "viewer";
    expectedVersion: number;
}, {
    role: "member" | "viewer";
    expectedVersion: number;
}>;
export type UpdateProjectMemberDto = z.infer<typeof UpdateProjectMemberSchema>;
export declare const TransferProjectOwnerSchema: z.ZodObject<{
    email: z.ZodString;
    expectedVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    email: string;
    expectedVersion: number;
}, {
    email: string;
    expectedVersion: number;
}>;
export type TransferProjectOwnerDto = z.infer<typeof TransferProjectOwnerSchema>;
export declare const MarkCompletedSchema: z.ZodObject<{
    expectedVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    expectedVersion: number;
}, {
    expectedVersion: number;
}>;
export type MarkCompletedDto = z.infer<typeof MarkCompletedSchema>;
