"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDatasetSchema = void 0;
const zod_1 = require("zod");
exports.UpdateDatasetSchema = zod_1.z.object({
    name: zod_1.z
        .string()
        .trim()
        .min(1, 'Tên tập dữ liệu không được để trống')
        .max(100, 'Tên tập dữ liệu tối đa 100 ký tự')
        .optional(),
});
//# sourceMappingURL=update-dataset.dto.js.map