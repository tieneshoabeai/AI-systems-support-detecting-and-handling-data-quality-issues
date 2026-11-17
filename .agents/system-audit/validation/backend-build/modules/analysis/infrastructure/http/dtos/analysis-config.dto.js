"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisConfigSchema = void 0;
const zod_1 = require("zod");
exports.AnalysisConfigSchema = zod_1.z.object({
    selected_columns: zod_1.z.array(zod_1.z.string().min(1)).max(200).nullable().optional(),
    label_column: zod_1.z.string().min(1).max(120).nullable().optional(),
    time_column: zod_1.z.string().min(1).max(120).nullable().optional(),
    time_granularity: zod_1.z.enum(['day', 'week', 'month', 'year']).default('day'),
    value_column: zod_1.z.string().min(1).max(120).nullable().optional(),
    correlation_method: zod_1.z.enum(['pearson', 'spearman']).default('pearson'),
    outlier_method: zod_1.z.enum(['iqr', 'modified_zscore', 'both']).default('iqr'),
    top_n: zod_1.z.coerce.number().int().min(1).max(100).default(10),
});
//# sourceMappingURL=analysis-config.dto.js.map