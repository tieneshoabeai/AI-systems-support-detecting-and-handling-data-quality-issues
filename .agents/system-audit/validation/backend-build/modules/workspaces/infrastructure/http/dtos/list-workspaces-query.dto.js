"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListWorkspacesQuerySchema = void 0;
const zod_1 = require("zod");
exports.ListWorkspacesQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().max(100).optional(),
    role: zod_1.z.enum(['owner', 'member']).optional(),
    sort: zod_1.z.enum(['last_accessed', 'updated', 'name_asc', 'name_desc', 'joined']).default('last_accessed'),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(15),
});
//# sourceMappingURL=list-workspaces-query.dto.js.map