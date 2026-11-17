import { z } from 'zod';
export declare const AnalysisConfigSchema: z.ZodObject<{
    selected_columns: z.ZodOptional<z.ZodNullable<z.ZodArray<z.ZodString, "many">>>;
    label_column: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    time_column: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    time_granularity: z.ZodDefault<z.ZodEnum<["day", "week", "month", "year"]>>;
    value_column: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    correlation_method: z.ZodDefault<z.ZodEnum<["pearson", "spearman"]>>;
    outlier_method: z.ZodDefault<z.ZodEnum<["iqr", "modified_zscore", "both"]>>;
    top_n: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    selected_columns?: string[] | null | undefined;
    label_column?: string | null | undefined;
    time_column?: string | null | undefined;
    time_granularity: "day" | "month" | "week" | "year";
    value_column?: string | null | undefined;
    correlation_method: "pearson" | "spearman";
    outlier_method: "both" | "iqr" | "modified_zscore";
    top_n: number;
}, {
    selected_columns?: string[] | null | undefined;
    label_column?: string | null | undefined;
    time_column?: string | null | undefined;
    time_granularity?: "day" | "month" | "week" | "year" | undefined;
    value_column?: string | null | undefined;
    correlation_method?: "pearson" | "spearman" | undefined;
    outlier_method?: "both" | "iqr" | "modified_zscore" | undefined;
    top_n?: number | undefined;
}>;
export type AnalysisConfigDto = z.infer<typeof AnalysisConfigSchema>;
