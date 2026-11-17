"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_TTL_DAYS = exports.SESSION_TTL_MS = void 0;
exports.sessionExpiry = sessionExpiry;
exports.isSessionExpired = isSessionExpired;
exports.SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
exports.SESSION_TTL_DAYS = 7;
function sessionExpiry(from = new Date()) {
    return new Date(from.getTime() + exports.SESSION_TTL_MS);
}
function isSessionExpired(expiresAt, now = new Date()) {
    return expiresAt.getTime() <= now.getTime();
}
//# sourceMappingURL=session-policy.vo.js.map