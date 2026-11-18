"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkCompletedSchema = exports.TransferProjectOwnerSchema = exports.UpdateProjectMemberSchema = exports.AddProjectMemberSchema = void 0;
const zod_1 = require("zod");
exports.AddProjectMemberSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Định dạng email không hợp lệ'),
    role: zod_1.z.enum(['member', 'viewer'], {
        errorMap: () => ({ message: 'Vai trò project phải là member hoặc viewer' }),
    }).default('viewer'),
});
exports.UpdateProjectMemberSchema = zod_1.z.object({
    role: zod_1.z.enum(['member', 'viewer'], {
        errorMap: () => ({ message: 'Vai trò project phải là member hoặc viewer' }),
    }),
    expectedVersion: zod_1.z.number().int().min(1, 'expectedVersion là bắt buộc'),
});
exports.TransferProjectOwnerSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Định dạng email không hợp lệ'),
    expectedVersion: zod_1.z.number().int().min(1, 'expectedVersion là bắt buộc'),
});
exports.MarkCompletedSchema = zod_1.z.object({
    expectedVersion: zod_1.z.number().int().min(1, 'expectedVersion là bắt buộc'),
});
//# sourceMappingURL=project-member.dto.js.map