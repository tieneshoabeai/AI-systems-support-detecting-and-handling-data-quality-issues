"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isObjectIdHex = isObjectIdHex;
function isObjectIdHex(id) {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}
//# sourceMappingURL=object-id.util.js.map