import { z } from 'zod';
export declare const RecordFilterOperatorSchema: z.ZodEnum<["equals", "notEquals", "contains", "notContains", "startsWith", "endsWith", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "between", "in", "isEmpty", "isNotEmpty"]>;
export type RecordFilterOperator = z.infer<typeof RecordFilterOperatorSchema>;
export declare const RecordFilterSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    column: z.ZodString;
    operator: z.ZodEnum<["equals", "notEquals", "contains", "notContains", "startsWith", "endsWith", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "between", "in", "isEmpty", "isNotEmpty"]>;
    value: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    column: string;
    operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
    value?: unknown;
}, {
    column: string;
    operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
    value?: unknown;
}>, {
    column: string;
    operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
    value?: unknown;
}, {
    column: string;
    operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
    value?: unknown;
}>, {
    column: string;
    operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
    value?: unknown;
}, {
    column: string;
    operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
    value?: unknown;
}>, {
    column: string;
    operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
    value?: unknown;
}, {
    column: string;
    operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
    value?: unknown;
}>;
export type RecordFilterDto = z.infer<typeof RecordFilterSchema>;
export declare const RecordSortSchema: z.ZodObject<{
    column: z.ZodString;
    order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
}, "strip", z.ZodTypeAny, {
    column: string;
    order: "asc" | "desc";
}, {
    column: string;
    order?: "asc" | "desc" | undefined;
}>;
export type RecordSortDto = z.infer<typeof RecordSortSchema>;
export declare const RecordSearchSchema: z.ZodObject<{
    columns: z.ZodArray<z.ZodString, "many">;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    columns: string[];
    value: string;
}, {
    columns: string[];
    value: string;
}>;
export type RecordSearchDto = z.infer<typeof RecordSearchSchema>;
export declare const QueryRecordsBodySchema: z.ZodObject<{
    filters: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
        column: z.ZodString;
        operator: z.ZodEnum<["equals", "notEquals", "contains", "notContains", "startsWith", "endsWith", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual", "between", "in", "isEmpty", "isNotEmpty"]>;
        value: z.ZodOptional<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }, {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }>, {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }, {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }>, {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }, {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }>, {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }, {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }>, "many">>>;
    sort: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        column: z.ZodString;
        order: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    }, "strip", z.ZodTypeAny, {
        column: string;
        order: "asc" | "desc";
    }, {
        column: string;
        order?: "asc" | "desc" | undefined;
    }>, "many">>>;
    search: z.ZodOptional<z.ZodObject<{
        columns: z.ZodArray<z.ZodString, "many">;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        columns: string[];
        value: string;
    }, {
        columns: string[];
        value: string;
    }>>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    filters: {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }[];
    sort: {
        column: string;
        order: "asc" | "desc";
    }[];
    search?: {
        columns: string[];
        value: string;
    } | undefined;
    cursor?: string | undefined;
    limit: number;
}, {
    filters?: {
        column: string;
        operator: "between" | "contains" | "endsWith" | "equals" | "greaterThan" | "greaterThanOrEqual" | "in" | "isEmpty" | "isNotEmpty" | "lessThan" | "lessThanOrEqual" | "notContains" | "notEquals" | "startsWith";
        value?: unknown;
    }[] | undefined;
    sort?: {
        column: string;
        order?: "asc" | "desc" | undefined;
    }[] | undefined;
    search?: {
        columns: string[];
        value: string;
    } | undefined;
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type QueryRecordsBodyDto = z.infer<typeof QueryRecordsBodySchema>;
