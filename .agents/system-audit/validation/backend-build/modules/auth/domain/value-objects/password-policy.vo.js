"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PASSWORD_MAX_LENGTH = exports.PASSWORD_MIN_LENGTH = void 0;
exports.isPasswordLengthValid = isPasswordLengthValid;
exports.PASSWORD_MIN_LENGTH = 8;
exports.PASSWORD_MAX_LENGTH = 100;
function isPasswordLengthValid(password) {
    return password.length >= exports.PASSWORD_MIN_LENGTH && password.length <= exports.PASSWORD_MAX_LENGTH;
}
//# sourceMappingURL=password-policy.vo.js.map