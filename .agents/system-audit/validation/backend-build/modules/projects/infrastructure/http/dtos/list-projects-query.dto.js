"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListProjectsQuerySchema = void 0;
const zod_1 = require("zod");
exports.ListProjectsQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().max(100).optional(),
    status: zod_1.z.enum(['not_started', 'in_progress', 'completed']).optional(),
    sort: zod_1.z.enum(['last_accessed', 'updated', 'name_asc', 'name_desc', 'joined']).default('last_accessed'),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(15),
});
//# sourceMappingURL=list-projects-query.dto.js.map