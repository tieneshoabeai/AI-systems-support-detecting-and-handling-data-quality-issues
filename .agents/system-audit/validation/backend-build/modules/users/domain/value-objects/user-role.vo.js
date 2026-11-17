"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_STATUSES = exports.USER_ROLES = void 0;
exports.isUserBlocked = isUserBlocked;
exports.isUserDeleted = isUserDeleted;
exports.canUserLogin = canUserLogin;
exports.normalizeEmail = normalizeEmail;
exports.USER_ROLES = ['admin', 'analyst'];
exports.USER_STATUSES = ['active', 'blocked'];
function isUserBlocked(status) {
    return status === 'blocked';
}
function isUserDeleted(deletedAt) {
    return deletedAt !== null && deletedAt !== undefined;
}
function canUserLogin(status, deletedAt) {
    return !isUserBlocked(status) && !isUserDeleted(deletedAt);
}
function normalizeEmail(email) {
    return email.toLowerCase().trim();
}
//# sourceMappingURL=user-role.vo.js.map