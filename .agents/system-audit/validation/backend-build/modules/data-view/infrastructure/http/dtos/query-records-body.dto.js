"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryRecordsBodySchema = exports.RecordSearchSchema = exports.RecordSortSchema = exports.RecordFilterSchema = exports.RecordFilterOperatorSchema = void 0;
const zod_1 = require("zod");
exports.RecordFilterOperatorSchema = zod_1.z.enum([
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'startsWith',
    'endsWith',
    'greaterThan',
    'greaterThanOrEqual',
    'lessThan',
    'lessThanOrEqual',
    'between',
    'in',
    'isEmpty',
    'isNotEmpty',
]);
exports.RecordFilterSchema = zod_1.z
    .object({
    column: zod_1.z.string().min(1).max(120),
    operator: exports.RecordFilterOperatorSchema,
    value: zod_1.z.unknown().optional(),
})
    .refine((f) => f.operator === 'isEmpty' ||
    f.operator === 'isNotEmpty' ||
    (f.value !== undefined && f.value !== null && f.value !== ''), { message: 'Bộ lọc yêu cầu có value (trừ isEmpty/isNotEmpty)' })
    .refine((f) => f.operator !== 'between' || (Array.isArray(f.value) && f.value.length === 2), {
    message: 'Bộ lọc "between" yêu cầu value là mảng 2 phần tử [min, max]',
})
    .refine((f) => f.operator !== 'in' || (Array.isArray(f.value) && f.value.length > 0), {
    message: 'Bộ lọc "in" yêu cầu value là mảng khác rỗng',
});
exports.RecordSortSchema = zod_1.z.object({
    column: zod_1.z.string().min(1).max(120),
    order: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
exports.RecordSearchSchema = zod_1.z.object({
    columns: zod_1.z.array(zod_1.z.string().min(1).max(120)).min(1).max(20),
    value: zod_1.z.string().max(200),
});
exports.QueryRecordsBodySchema = zod_1.z.object({
    filters: zod_1.z.array(exports.RecordFilterSchema).max(30).optional().default([]),
    sort: zod_1.z.array(exports.RecordSortSchema).max(5).optional().default([]),
    search: exports.RecordSearchSchema.optional(),
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
});
//# sourceMappingURL=query-records-body.dto.js.map