import { z } from 'zod';
export declare const RenameColumnItemSchema: z.ZodObject<{
    key: z.ZodString;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
    name: string;
}, {
    key: string;
    name: string;
}>;
export declare const RenameColumnsSchema: z.ZodObject<{
    columns: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        name: string;
    }, {
        key: string;
        name: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    columns: {
        key: string;
        name: string;
    }[];
}, {
    columns: {
        key: string;
        name: string;
    }[];
}>;
export type RenameColumnItemDto = z.infer<typeof RenameColumnItemSchema>;
export type RenameColumnsDto = z.infer<typeof RenameColumnsSchema>;
