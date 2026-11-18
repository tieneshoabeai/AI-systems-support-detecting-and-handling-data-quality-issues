"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RECORD_LIMIT = exports.DEFAULT_RECORD_LIMIT = void 0;
exports.normalizeRecordLimit = normalizeRecordLimit;
exports.DEFAULT_RECORD_LIMIT = 50;
exports.MAX_RECORD_LIMIT = 500;
function normalizeRecordLimit(limit) {
    if (!Number.isFinite(limit) || limit <= 0)
        return exports.DEFAULT_RECORD_LIMIT;
    return Math.min(Math.floor(limit), exports.MAX_RECORD_LIMIT);
}
//# sourceMappingURL=record-query.vo.js.map