"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenSchema = void 0;
const zod_1 = require("zod");
exports.RefreshTokenSchema = zod_1.z.object({
    refresh_token: zod_1.z.string().min(1, 'Refresh token không được để trống'),
});
//# sourceMappingURL=refresh-token.dto.js.map