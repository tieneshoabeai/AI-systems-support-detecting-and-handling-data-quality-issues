"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordSchema = exports.ResetPasswordSchema = exports.ForgotPasswordSchema = void 0;
const zod_1 = require("zod");
const common_schemas_1 = require("../../../../../shared/validation/common-schemas");
exports.ForgotPasswordSchema = zod_1.z.object({
    email: common_schemas_1.EmailSchema,
});
exports.ResetPasswordSchema = zod_1.z.object({
    email: common_schemas_1.EmailSchema,
    otp: zod_1.z.string().trim().regex(/^\d{6}$/, 'Mã OTP gồm đúng 6 chữ số'),
    new_password: common_schemas_1.PasswordSchema,
});
exports.ChangePasswordSchema = zod_1.z.object({
    current_password: zod_1.z.string().min(1, 'Mật khẩu hiện tại không được để trống'),
    new_password: common_schemas_1.PasswordSchema,
    confirm_password: zod_1.z.string().min(1, 'Xác nhận mật khẩu không được để trống'),
});
//# sourceMappingURL=password-reset.dto.js.map