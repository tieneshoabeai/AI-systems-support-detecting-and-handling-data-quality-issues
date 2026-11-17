"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterSchema = void 0;
const zod_1 = require("zod");
const common_schemas_1 = require("../../../../../shared/validation/common-schemas");
exports.RegisterSchema = zod_1.z.object({
    email: common_schemas_1.EmailSchema,
    password: common_schemas_1.PasswordSchema,
    first_name: zod_1.z
        .string()
        .min(1, 'Họ không được để trống')
        .max(50, 'Họ không được vượt quá 50 ký tự')
        .trim(),
    last_name: zod_1.z
        .string()
        .min(1, 'Tên không được để trống')
        .max(50, 'Tên không được vượt quá 50 ký tự')
        .trim(),
    role: zod_1.z.enum(['admin', 'analyst']).default('analyst'),
});
//# sourceMappingURL=register.dto.js.map