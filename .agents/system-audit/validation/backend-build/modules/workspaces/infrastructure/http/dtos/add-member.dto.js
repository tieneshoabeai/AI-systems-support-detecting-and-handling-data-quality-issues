"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMemberSchema = void 0;
const zod_1 = require("zod");
exports.AddMemberSchema = zod_1.z.object({
    email: zod_1.z
        .string()
        .trim()
        .email('Định dạng email thành viên không hợp lệ'),
    role: zod_1.z.enum(['owner', 'member'], {
        errorMap: () => ({ message: 'Vai trò workspace phải là owner hoặc member' }),
    }).default('member'),
});
//# sourceMappingURL=add-member.dto.js.map