"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginSchema = void 0;
const zod_1 = require("zod");
const common_schemas_1 = require("../../../../../shared/validation/common-schemas");
exports.LoginSchema = zod_1.z.object({
    email: common_schemas_1.EmailSchema,
    password: zod_1.z.string().min(1, 'Mật khẩu không được để trống'),
});
//# sourceMappingURL=login.dto.js.map