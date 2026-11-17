"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MASKED_TOKEN = void 0;
exports.detectPiiType = detectPiiType;
exports.maskCell = maskCell;
exports.maskColumnSamples = maskColumnSamples;
exports.MASKED_TOKEN = '***';
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^(?:\+?84|0)(?:\d[ .-]?){8,10}\d$/;
const CITIZEN_ID_RE = /^\d{9,13}$/;
function detectPiiType(value) {
    const trimmed = value.trim();
    if (EMAIL_RE.test(trimmed))
        return 'email';
    if (PHONE_RE.test(trimmed))
        return 'phone';
    if (CITIZEN_ID_RE.test(trimmed))
        return 'citizen_id';
    return null;
}
function maskCell(value, columnMarkedPII, dropUnmaskable = true) {
    if (value === null || value === undefined) {
        return { masked: false, dropped: false, value: null };
    }
    const s = String(value).trim();
    if (s === '') {
        return { masked: false, dropped: false, value: null };
    }
    if (columnMarkedPII) {
        return { masked: true, dropped: false, value: exports.MASKED_TOKEN };
    }
    if (detectPiiType(s) !== null) {
        return { masked: true, dropped: false, value: exports.MASKED_TOKEN };
    }
    if (dropUnmaskable) {
        return { masked: false, dropped: true, value: null };
    }
    return { masked: false, dropped: false, value: s };
}
function maskColumnSamples(values, columnMarkedPII, maxSamples = 20) {
    const samples = [];
    let droppedCount = 0;
    for (const v of values) {
        if (samples.length >= maxSamples)
            break;
        const res = maskCell(v, columnMarkedPII);
        if (res.dropped) {
            droppedCount++;
            continue;
        }
        if (res.value !== null)
            samples.push(res.value);
    }
    return { samples, droppedCount };
}
//# sourceMappingURL=pii-mask.util.js.map