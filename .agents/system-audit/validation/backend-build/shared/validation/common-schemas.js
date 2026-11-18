"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorQuerySchema = exports.PaginationQuerySchema = exports.PasswordSchema = exports.EmailSchema = exports.MongoIdSchema = void 0;
const zod_1 = require("zod");
exports.MongoIdSchema = zod_1.z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'ID không phải định dạng MongoDB ObjectId hợp lệ');
exports.EmailSchema = zod_1.z
    .string()
    .email('Định dạng email không hợp lệ')
    .toLowerCase()
    .trim();
exports.PasswordSchema = zod_1.z
    .string()
    .min(8, 'Mật khẩu phải có độ dài tối thiểu 8 ký tự')
    .max(100, 'Mật khẩu không được vượt quá 100 ký tự');
exports.PaginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.CursorQuerySchema = zod_1.z.object({
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(500).default(50),
    sort_by: zod_1.z.string().optional(),
    order: zod_1.z.enum(['asc', 'desc']).default('asc'),
});
//# sourceMappingURL=common-schemas.js.map