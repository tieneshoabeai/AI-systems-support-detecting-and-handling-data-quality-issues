"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryRecordsSchema = void 0;
const zod_1 = require("zod");
exports.QueryRecordsSchema = zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    sort_field: zod_1.z.string().optional(),
    sort_order: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
//# sourceMappingURL=query-records.dto.js.map