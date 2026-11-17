"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameColumnsSchema = exports.RenameColumnItemSchema = void 0;
const zod_1 = require("zod");
exports.RenameColumnItemSchema = zod_1.z.object({
    key: zod_1.z.string().regex(/^c\d+$/, 'key cot phai co dang c{i} (vi du c0)'),
    name: zod_1.z.string().trim().min(1, 'Ten cot khong duoc de trong').max(120),
});
exports.RenameColumnsSchema = zod_1.z.object({
    columns: zod_1.z.array(exports.RenameColumnItemSchema).min(1).max(1000),
});
//# sourceMappingURL=rename-columns.dto.js.map