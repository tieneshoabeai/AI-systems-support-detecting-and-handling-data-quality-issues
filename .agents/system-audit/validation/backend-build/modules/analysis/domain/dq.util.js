"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMissingCell = isMissingCell;
exports.computeDq0102 = computeDq0102;
exports.isValidByType = isValidByType;
exports.computeDq03 = computeDq03;
exports.detectOutliers = detectOutliers;
const ss = __importStar(require("simple-statistics"));
const correlation_util_1 = require("./correlation.util");
function isMissingCell(val) {
    if (val === null || val === undefined)
        return true;
    if (typeof val === 'string')
        return val.trim() === '';
    return false;
}
function fingerprintRow(row, cols) {
    const parts = [];
    let allMissing = true;
    for (const c of cols) {
        const v = row[c];
        if (!isMissingCell(v))
            allMissing = false;
        parts.push(JSON.stringify(v ?? null));
    }
    if (allMissing)
        return null;
    return parts.join('|');
}
function computeDq0102(columns, rows) {
    const total = rows.length;
    const colStats = columns.map((column) => {
        let missingCount = 0;
        for (const r of rows)
            if (isMissingCell(r.values[column]))
                missingCount++;
        return {
            column,
            missingCount,
            missingRate: total > 0 ? (0, correlation_util_1.round4)(missingCount / total) : null,
            invalidCount: 0,
            invalidRate: null,
            outlierCount: 0,
            outlierRate: null,
            checkedRows: total,
            excludedRows: 0,
            method: 'dq01_exact_missing',
            reason: total === 0 ? 'no_data_to_evaluate' : null,
        };
    });
    let fullyMissingRows = 0;
    let partiallyMissingRows = 0;
    for (const r of rows) {
        const miss = columns.filter((c) => isMissingCell(r.values[c])).length;
        if (columns.length > 0 && miss === columns.length)
            fullyMissingRows++;
        else if (miss > 0)
            partiallyMissingRows++;
    }
    const groups = new Map();
    const partialFlags = new Map();
    rows.forEach((r) => {
        const fp = fingerprintRow(r.values, columns);
        if (fp === null)
            return;
        const arr = groups.get(fp) ?? [];
        arr.push(r.rowIndex);
        groups.set(fp, arr);
        const hasMiss = columns.some((c) => isMissingCell(r.values[c]));
        partialFlags.set(fp, (partialFlags.get(fp) ?? false) || hasMiss);
    });
    const duplicateGroups = [...groups.entries()]
        .filter(([, idx]) => idx.length > 1)
        .map(([key, rowIndexes]) => ({
        key: key.slice(0, 200),
        rowIndexes: [...rowIndexes].sort((a, b) => a - b),
        count: rowIndexes.length,
        hasPartialMissing: partialFlags.get(key) ?? false,
    }));
    const duplicateRowCount = duplicateGroups.reduce((s, g) => s + (g.count - 1), 0);
    return { columns: colStats, duplicateGroups, duplicateRowCount, fullyMissingRows, partiallyMissingRows };
}
function isValidByType(val, dataType) {
    if (isMissingCell(val))
        return { valid: true, reason: null };
    if (dataType === 'number') {
        const n = (0, correlation_util_1.toFiniteNumber)(val);
        return n === null ? { valid: false, reason: 'invalid_number' } : { valid: true, reason: null };
    }
    if (dataType === 'boolean') {
        if (typeof val === 'boolean')
            return { valid: true, reason: null };
        if (typeof val === 'string') {
            const t = val.trim().toLowerCase();
            if (['true', 'false', 'yes', 'no', '1', '0'].includes(t))
                return { valid: true, reason: null };
        }
        if (typeof val === 'number' && (val === 0 || val === 1))
            return { valid: true, reason: null };
        return { valid: false, reason: 'invalid_boolean' };
    }
    if (dataType === 'date') {
        if (val instanceof Date) {
            return Number.isNaN(val.getTime()) ? { valid: false, reason: 'invalid_date' } : { valid: true, reason: null };
        }
        if (typeof val === 'string' || typeof val === 'number') {
            const d = new Date(val);
            return Number.isNaN(d.getTime()) ? { valid: false, reason: 'invalid_date' } : { valid: true, reason: null };
        }
        return { valid: false, reason: 'invalid_date' };
    }
    const c = (0, correlation_util_1.toCategory)(val);
    return c === null ? { valid: false, reason: 'invalid_string' } : { valid: true, reason: null };
}
function computeDq03(colTypes, rows) {
    return colTypes.map(({ column, dataType }) => {
        let validCount = 0;
        let invalidCount = 0;
        let missing = 0;
        const reasons = {};
        for (const r of rows) {
            const v = r.values[column];
            if (isMissingCell(v) || (0, correlation_util_1.isMissingValue)(v)) {
                if (isMissingCell(v))
                    missing++;
                else {
                    invalidCount++;
                    reasons['symbol_as_missing_excluded_from_dq01'] = (reasons['symbol_as_missing_excluded_from_dq01'] ?? 0) + 1;
                }
                continue;
            }
            const res = isValidByType(v, dataType);
            if (res.valid)
                validCount++;
            else {
                invalidCount++;
                const k = res.reason ?? 'invalid';
                reasons[k] = (reasons[k] ?? 0) + 1;
            }
        }
        const denom = validCount + invalidCount;
        void missing;
        return { column, validCount, invalidCount, invalidRate: denom > 0 ? (0, correlation_util_1.round4)(invalidCount / denom) : null, reasons };
    });
}
function quantileSorted(sorted, q) {
    if (sorted.length === 0)
        return NaN;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    if (next === undefined)
        return sorted[base];
    return sorted[base] + rest * (next - sorted[base]);
}
function detectOutliers(column, values, method = 'iqr') {
    const base = {
        column, method, iqrOutliers: [], iqrExtremeOutliers: [],
        zOutliers: [], union: [], intersection: [],
        usedRows: values.length, excludedRows: 0, iqrDispersionOk: true, madDispersionOk: true, reason: null,
    };
    if (values.length < 4)
        return { ...base, iqrDispersionOk: false, madDispersionOk: false, reason: 'insufficient_observations_min_4' };
    const nums = values.map((v) => v.value).sort((a, b) => a - b);
    const useIqr = method === 'iqr' || method === 'both';
    const useZ = method === 'modified_zscore' || method === 'both';
    let iqrSet = new Set();
    let extremeSet = new Set();
    if (useIqr) {
        const q1 = quantileSorted(nums, 0.25);
        const q3 = quantileSorted(nums, 0.75);
        const iqr = q3 - q1;
        if (!(iqr > 0)) {
            base.iqrDispersionOk = false;
            base.reason = 'iqr_zero_insufficient_dispersion';
        }
        else {
            const lo = q1 - 1.5 * iqr;
            const hi = q3 + 1.5 * iqr;
            const loX = q1 - 3 * iqr;
            const hiX = q3 + 3 * iqr;
            for (const v of values) {
                if (v.value < lo || v.value > hi)
                    iqrSet.add(v.rowIndex);
                if (v.value < loX || v.value > hiX)
                    extremeSet.add(v.rowIndex);
            }
        }
    }
    let zSet = new Set();
    if (useZ) {
        const med = ss.median(nums);
        const deviations = nums.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
        const mad = ss.median(deviations);
        if (!(mad > 0)) {
            base.madDispersionOk = false;
            base.reason = base.reason ? `${base.reason};mad_zero_insufficient_dispersion` : 'mad_zero_insufficient_dispersion';
        }
        else {
            for (const v of values) {
                const mz = (0.6745 * (v.value - med)) / mad;
                if (Math.abs(mz) > 3.5)
                    zSet.add(v.rowIndex);
            }
        }
    }
    void iqrSet;
    void extremeSet;
    void zSet;
    const iqrArr = [...iqrSet].sort((a, b) => a - b);
    const extArr = [...extremeSet].sort((a, b) => a - b);
    const zArr = [...zSet].sort((a, b) => a - b);
    const activeSets = [];
    if (useIqr)
        activeSets.push(iqrSet);
    if (useZ)
        activeSets.push(zSet);
    const union = new Set();
    for (const s of activeSets)
        for (const x of s)
            union.add(x);
    let intersection = [];
    if (activeSets.length === 2) {
        intersection = [...activeSets[0]].filter((x) => activeSets[1].has(x)).sort((a, b) => a - b);
    }
    else if (activeSets.length === 1) {
        intersection = [...union].sort((a, b) => a - b);
    }
    return {
        ...base,
        iqrOutliers: useIqr ? iqrArr : [],
        iqrExtremeOutliers: useIqr ? extArr : [],
        zOutliers: useZ ? zArr : [],
        union: [...union].sort((a, b) => a - b),
        intersection,
    };
}
//# sourceMappingURL=dq.util.js.map