import { z } from 'zod';
export declare const RunAnalysisSchema: z.ZodObject<{
    selected_columns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    correlation_method: z.ZodDefault<z.ZodEnum<["pearson", "spearman"]>>;
    outlier_method: z.ZodDefault<z.ZodEnum<["iqr", "modified_zscore", "both"]>>;
    top_n: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    selected_columns?: string[] | undefined;
    correlation_method: "pearson" | "spearman";
    outlier_method: "both" | "iqr" | "modified_zscore";
    top_n: number;
}, {
    selected_columns?: string[] | undefined;
    correlation_method?: "pearson" | "spearman" | undefined;
    outlier_method?: "both" | "iqr" | "modified_zscore" | undefined;
    top_n?: number | undefined;
}>;
export type RunAnalysisDto = z.infer<typeof RunAnalysisSchema>;
