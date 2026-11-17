"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLUMN_DATA_TYPES = void 0;
exports.stableColumnKey = stableColumnKey;
exports.COLUMN_DATA_TYPES = ['string', 'number', 'boolean', 'date'];
function stableColumnKey(index) {
    return `c${index}`;
}
//# sourceMappingURL=column-type.vo.js.map