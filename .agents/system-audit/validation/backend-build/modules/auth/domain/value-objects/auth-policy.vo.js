"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SALT_ROUNDS = exports.REFRESH_TOKEN_BYTES = exports.REFRESH_TOKEN_TTL_MS = exports.ACCESS_TOKEN_TTL_SECONDS = void 0;
exports.refreshTokenExpiry = refreshTokenExpiry;
exports.isAccountLocked = isAccountLocked;
exports.ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
exports.REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
exports.REFRESH_TOKEN_BYTES = 40;
exports.DEFAULT_SALT_ROUNDS = 12;
function refreshTokenExpiry(from = new Date()) {
    return new Date(from.getTime() + exports.REFRESH_TOKEN_TTL_MS);
}
function isAccountLocked(status) {
    return status === 'blocked';
}
//# sourceMappingURL=auth-policy.vo.js.map