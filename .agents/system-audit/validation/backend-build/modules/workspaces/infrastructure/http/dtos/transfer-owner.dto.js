"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferOwnerSchema = void 0;
const zod_1 = require("zod");
exports.TransferOwnerSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Định dạng email không hợp lệ'),
    expectedVersion: zod_1.z.number().int().min(1, 'expectedVersion là bắt buộc'),
});
//# sourceMappingURL=transfer-owner.dto.js.map