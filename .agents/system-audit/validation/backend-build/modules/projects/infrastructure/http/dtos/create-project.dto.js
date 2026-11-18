"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProjectSchema = void 0;
const zod_1 = require("zod");
exports.CreateProjectSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .trim()
        .min(1, 'Tên dự án không được để trống')
        .max(100, 'Tên dự án tối đa 100 ký tự'),
    description: zod_1.z
        .string()
        .trim()
        .max(500, 'Mô tả tối đa 500 ký tự')
        .optional(),
});
//# sourceMappingURL=create-project.dto.js.map