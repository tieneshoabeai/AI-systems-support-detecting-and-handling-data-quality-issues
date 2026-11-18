"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunAnalysisSchema = void 0;
const zod_1 = require("zod");
exports.RunAnalysisSchema = zod_1.z.object({
    selected_columns: zod_1.z.array(zod_1.z.string().min(1)).max(200).optional(),
    correlation_method: zod_1.z.enum(['pearson', 'spearman']).default('pearson'),
    outlier_method: zod_1.z.enum(['iqr', 'modified_zscore', 'both']).default('iqr'),
    top_n: zod_1.z.coerce.number().int().min(1).max(100).default(10),
});
//# sourceMappingURL=run-analysis.dto.js.map