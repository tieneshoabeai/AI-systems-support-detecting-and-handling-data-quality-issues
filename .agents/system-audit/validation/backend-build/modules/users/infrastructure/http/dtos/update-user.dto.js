"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserSchema = void 0;
const zod_1 = require("zod");
exports.UpdateUserSchema = zod_1.z.object({
    first_name: zod_1.z.string().min(1).max(50).trim().optional(),
    last_name: zod_1.z.string().min(1).max(50).trim().optional(),
    avatar_url: zod_1.z.string().url('Avatar URL không hợp lệ').optional(),
});
//# sourceMappingURL=update-user.dto.js.map