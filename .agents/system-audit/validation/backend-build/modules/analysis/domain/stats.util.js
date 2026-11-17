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
exports.describeColumn = describeColumn;
exports.evaluateImbalance = evaluateImbalance;
exports.analyzeTime = analyzeTime;
const ss = __importStar(require("simple-statistics"));
const correlation_util_1 = require("./correlation.util");
const dq_util_1 = require("./dq.util");
function quantileSorted(sorted, q) {
    if (sorted.length === 0)
        return null;
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    if (next === undefined)
        return (0, correlation_util_1.round4)(sorted[base]);
    return (0, correlation_util_1.round4)(sorted[base] + rest * (next - sorted[base]));
}
function describeColumn(column, dataType, rawValues) {
    let missingCount = 0;
    let invalidCount = 0;
    const validNums = [];
    const validCats = [];
    for (const v of rawValues) {
        if ((0, dq_util_1.isMissingCell)(v)) {
            missingCount++;
            continue;
        }
        const r = (0, dq_util_1.isValidByType)(v, dataType);
        if (!r.valid) {
            invalidCount++;
            continue;
        }
        if (dataType === 'number') {
            const n = (0, correlation_util_1.toFiniteNumber)(v);
            if (n === null)
                invalidCount++;
            else
                validNums.push(n);
        }
        else {
            const c = (0, correlation_util_1.toCategory)(v);
            if (c === null)
                invalidCount++;
            else
                validCats.push(c);
        }
    }
    if (dataType === 'number') {
        if (validNums.length === 0) {
            return {
                column, dataType, count: 0, missingCount, invalidCount,
                mean: null, median: null, min: null, max: null, stdev: null, q1: null, q3: null,
                distinctCount: 0, topValues: null,
                reason: rawValues.length === 0 ? 'no_data_to_evaluate' : 'no_valid_numeric_values',
            };
        }
        const sorted = [...validNums].sort((a, b) => a - b);
        const sd = validNums.length >= 2 ? ss.standardDeviation(validNums) : 0;
        return {
            column, dataType, count: validNums.length, missingCount, invalidCount,
            mean: (0, correlation_util_1.round4)(ss.mean(validNums)),
            median: (0, correlation_util_1.round4)(ss.median(validNums)),
            min: (0, correlation_util_1.round4)(sorted[0]),
            max: (0, correlation_util_1.round4)(sorted[sorted.length - 1]),
            stdev: Number.isFinite(sd) ? (0, correlation_util_1.round4)(sd) : null,
            q1: quantileSorted(sorted, 0.25),
            q3: quantileSorted(sorted, 0.75),
            distinctCount: new Set(validNums.map((n) => String(n))).size,
            topValues: null,
            reason: null,
        };
    }
    const freq = new Map();
    for (const c of validCats)
        freq.set(c, (freq.get(c) ?? 0) + 1);
    const topValues = [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, count]) => ({ value, count }));
    return {
        column, dataType, count: validCats.length, missingCount, invalidCount,
        mean: null, median: null, min: null, max: null, stdev: null, q1: null, q3: null,
        distinctCount: freq.size, topValues,
        reason: validCats.length === 0 ? 'no_valid_categorical_values' : null,
    };
}
function evaluateImbalance(labelColumn, labelDataType, rows) {
    if (!labelColumn) {
        return {
            status: 'no_label', labelColumn: null, classes: [], classCount: 0,
            largest: [], smallest: [], imbalanceRatio: null, warning: null,
            validRows: 0, missingLabelRows: 0, reason: 'no_label_selected',
        };
    }
    if (labelDataType === 'number' || labelDataType === 'date') {
        return {
            status: 'not_applicable_continuous', labelColumn, classes: [], classCount: 0,
            largest: [], smallest: [], imbalanceRatio: null, warning: null,
            validRows: 0, missingLabelRows: 0, reason: 'label_continuous_not_applicable',
        };
    }
    const freq = new Map();
    let missing = 0;
    for (const r of rows) {
        const v = r[labelColumn];
        if ((0, dq_util_1.isMissingCell)(v)) {
            missing++;
            continue;
        }
        const c = (0, correlation_util_1.toCategory)(v);
        if (c === null) {
            missing++;
            continue;
        }
        freq.set(c, (freq.get(c) ?? 0) + 1);
    }
    const validRows = [...freq.values()].reduce((s, n) => s + n, 0);
    if (freq.size === 0) {
        return {
            status: 'no_valid_labels', labelColumn, classes: [], classCount: 0,
            largest: [], smallest: [], imbalanceRatio: null, warning: null,
            validRows: 0, missingLabelRows: missing, reason: 'no_valid_label_values',
        };
    }
    if (freq.size === 1) {
        const only = [...freq.entries()][0];
        return {
            status: 'single_class', labelColumn,
            classes: [{ value: only[0], count: only[1], rate: 1 }],
            classCount: 1, largest: [only[0]], smallest: [only[0]],
            imbalanceRatio: 1, warning: null, validRows, missingLabelRows: missing,
            reason: 'only_one_observed_class',
        };
    }
    const classes = [...freq.entries()].map(([value, count]) => ({
        value, count, rate: validRows > 0 ? (0, correlation_util_1.round4)(count / validRows) : null,
    })).sort((a, b) => b.count - a.count);
    const maxCount = classes[0].count;
    const minCount = classes[classes.length - 1].count;
    const largest = classes.filter((c) => c.count === maxCount).map((c) => c.value);
    const smallest = classes.filter((c) => c.count === minCount).map((c) => c.value);
    const ir = minCount > 0 ? (0, correlation_util_1.round4)(maxCount / minCount) : null;
    return {
        status: 'evaluated', labelColumn, classes, classCount: classes.length,
        largest, smallest, imbalanceRatio: ir,
        warning: ir !== null && ir >= 3 ? 'imbalance_ratio_gte_3_review_distribution' : null,
        validRows, missingLabelRows: missing, reason: null,
    };
}
function toDateKey(v) {
    if (v === null || v === undefined)
        return null;
    if (v instanceof Date)
        return Number.isNaN(v.getTime()) ? null : v;
    if (typeof v === 'string' || typeof v === 'number') {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}
function bucketKey(d, g) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (g === 'year')
        return `${y}`;
    if (g === 'month')
        return `${y}-${m}`;
    if (g === 'week') {
        const tmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dow = (tmp.getDay() + 6) % 7;
        tmp.setDate(tmp.getDate() - dow);
        const wy = tmp.getFullYear();
        const wm = String(tmp.getMonth() + 1).padStart(2, '0');
        const wd = String(tmp.getDate()).padStart(2, '0');
        return `${wy}-W${wm}-${wd}`;
    }
    return `${y}-${m}-${day}`;
}
function nextBucket(key, g) {
    if (g === 'year')
        return String(Number(key) + 1);
    if (g === 'month') {
        const [y, m] = key.split('-').map(Number);
        const nm = m % 12 + 1;
        const ny = y + (m === 12 ? 1 : 0);
        return `${ny}-${String(nm).padStart(2, '0')}`;
    }
    const d = new Date(key.length === 10 ? `${key}T00:00:00` : `${key.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime()))
        return key;
    if (g === 'week')
        d.setDate(d.getDate() + 7);
    else
        d.setDate(d.getDate() + 1);
    return bucketKey(d, 'day');
}
function analyzeTime(timeColumn, valueColumn, rows, granularity = 'day') {
    if (!timeColumn) {
        return {
            status: 'no_time_column', timeColumn: null, granularity, buckets: [],
            emptyBuckets: [], longestEmptyRun: 0, deltas: [], volatilePeriods: [], reason: 'no_suitable_time_column',
        };
    }
    const byBucket = new Map();
    let invalidDates = 0;
    let missingDates = 0;
    for (const r of rows) {
        const d = toDateKey(r[timeColumn]);
        if (d === null) {
            if ((0, dq_util_1.isMissingCell)(r[timeColumn]))
                missingDates++;
            else
                invalidDates++;
            continue;
        }
        const k = bucketKey(d, granularity);
        const slot = byBucket.get(k) ?? { dates: [], values: [], missing: 0, invalid: 0 };
        slot.dates.push(d);
        if (valueColumn) {
            const n = (0, correlation_util_1.toFiniteNumber)(r[valueColumn]);
            if (n === null) {
                if ((0, dq_util_1.isMissingCell)(r[valueColumn]))
                    slot.missing++;
                else
                    slot.invalid++;
            }
            else
                slot.values.push(n);
        }
        byBucket.set(k, slot);
    }
    if (byBucket.size === 0) {
        return {
            status: 'insufficient_data', timeColumn, granularity, buckets: [],
            emptyBuckets: [], longestEmptyRun: 0, deltas: [], volatilePeriods: [],
            reason: `no_valid_dates_missing_${missingDates}_invalid_${invalidDates}`,
        };
    }
    const sortedKeys = [...byBucket.keys()].sort();
    const start = sortedKeys[0];
    const end = sortedKeys[sortedKeys.length - 1];
    const fullKeys = [];
    let cur = start;
    let guard = 0;
    while (cur !== null && guard < 5000) {
        fullKeys.push(cur);
        if (cur === end)
            break;
        cur = nextBucket(cur, granularity);
        guard++;
    }
    const buckets = fullKeys.map((k) => {
        const slot = byBucket.get(k);
        if (!slot) {
            return {
                period: k, recordCount: 0, validCount: 0, missingCount: 0, invalidCount: 0,
                median: null, mean: null, min: null, max: null, sum: null,
            };
        }
        const vals = [...slot.values].sort((a, b) => a - b);
        return {
            period: k,
            recordCount: slot.dates.length,
            validCount: vals.length,
            missingCount: slot.missing,
            invalidCount: slot.invalid,
            median: vals.length > 0 ? (0, correlation_util_1.round4)(ss.median(vals)) : null,
            mean: vals.length > 0 ? (0, correlation_util_1.round4)(ss.mean(vals)) : null,
            min: vals.length > 0 ? (0, correlation_util_1.round4)(vals[0]) : null,
            max: vals.length > 0 ? (0, correlation_util_1.round4)(vals[vals.length - 1]) : null,
            sum: valueColumn && vals.length > 0 ? (0, correlation_util_1.round4)(vals.reduce((s, v) => s + v, 0)) : null,
        };
    });
    const emptyBuckets = buckets.filter((b) => b.recordCount === 0).map((b) => b.period);
    let longestEmptyRun = 0;
    let run = 0;
    for (const b of buckets) {
        if (b.recordCount === 0) {
            run++;
            longestEmptyRun = Math.max(longestEmptyRun, run);
        }
        else
            run = 0;
    }
    const deltas = [];
    for (let i = 1; i < buckets.length; i++) {
        const prev = buckets[i - 1];
        const curB = buckets[i];
        if (prev.recordCount === 0 || curB.recordCount === 0) {
            deltas.push({ period: curB.period, absChange: null, pctChange: null });
            continue;
        }
        const abs = curB.recordCount - prev.recordCount;
        const pct = prev.recordCount > 0 ? (0, correlation_util_1.round4)(abs / prev.recordCount) : null;
        deltas.push({ period: curB.period, absChange: abs, pctChange: pct });
    }
    const absVals = deltas.map((d) => d.absChange).filter((v) => typeof v === 'number');
    let volatilePeriods = [];
    let reason = invalidDates > 0 || missingDates > 0
        ? `excluded_invalid_dates_${invalidDates}_missing_${missingDates}_no_delete_no_impute`
        : null;
    if (absVals.length < 4) {
        reason = [reason, 'insufficient_deltas_for_iqr_screening'].filter(Boolean).join(';');
    }
    else {
        const s = [...absVals].sort((a, b) => a - b);
        const q1 = s[Math.floor((s.length - 1) * 0.25)];
        const q3 = s[Math.floor((s.length - 1) * 0.75)];
        const iqr = q3 - q1;
        if (!(iqr > 0)) {
            reason = [reason, 'iqr_zero_insufficient_dispersion_for_volatility'].filter(Boolean).join(';');
        }
        else {
            const lo = q1 - 1.5 * iqr;
            const hi = q3 + 1.5 * iqr;
            volatilePeriods = deltas.filter((d) => d.absChange !== null && (d.absChange < lo || d.absChange > hi)).map((d) => d.period);
        }
    }
    return {
        status: 'evaluated', timeColumn, granularity, buckets,
        emptyBuckets, longestEmptyRun, deltas, volatilePeriods, reason,
    };
}
//# sourceMappingURL=stats.util.js.map