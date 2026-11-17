"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListNotificationsQuerySchema = void 0;
const zod_1 = require("zod");
exports.ListNotificationsQuerySchema = zod_1.z.object({
    cursor: zod_1.z.string().min(1).max(2000).optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
    sortBy: zod_1.z.enum(['createdAt']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    read: zod_1.z.enum(['true', 'false', 'all']).default('all'),
});
//# sourceMappingURL=list-notifications-query.dto.js.map