"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWorkspaceSchema = void 0;
const zod_1 = require("zod");
exports.UpdateWorkspaceSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .trim()
        .min(1, 'Tên không gian làm việc không được để trống')
        .max(100, 'Tên không gian làm việc tối đa 100 ký tự')
        .optional(),
    description: zod_1.z
        .string()
        .trim()
        .max(500, 'Mô tả tối đa 500 ký tự')
        .optional(),
    expectedVersion: zod_1.z.number().int().min(1).optional(),
});
//# sourceMappingURL=update-workspace.dto.js.map