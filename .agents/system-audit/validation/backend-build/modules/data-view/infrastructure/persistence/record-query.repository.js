"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordQueryRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function toRow(doc) {
    const raw = doc;
    return { rowIndex: raw.row_index, props: raw.props ?? {} };
}
function decodeRowIndex(cursor) {
    if (!cursor)
        return undefined;
    try {
        const json = Buffer.from(cursor.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
        const decoded = JSON.parse(json);
        if (typeof decoded.row_index === 'number' && Number.isInteger(decoded.row_index) && decoded.row_index >= 0) {
            return decoded.row_index;
        }
        return undefined;
    }
    catch {
        return undefined;
    }
}
let RecordQueryRepository = class RecordQueryRepository {
    recordModel;
    constructor(recordModel) {
        this.recordModel = recordModel;
    }
    resolveColumnKey(column, keys, _names) {
        if (keys.includes(column))
            return column;
        return null;
    }
    async listRecords(datasetId, cursor, limit) {
        const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 50;
        const lastRowIndex = decodeRowIndex(cursor);
        const filter = { dataset_id: new mongoose_2.Types.ObjectId(datasetId) };
        if (lastRowIndex !== undefined)
            filter.row_index = { $gt: lastRowIndex };
        const docs = await this.recordModel.find(filter).sort({ row_index: 1 }).limit(safeLimit + 1).lean().exec();
        const hasMore = docs.length > safeLimit;
        const page = hasMore ? docs.slice(0, safeLimit) : docs;
        return { items: page.map(toRow), hasMore };
    }
    async listAllRecords(datasetId) {
        const docs = await this.recordModel.find({ dataset_id: new mongoose_2.Types.ObjectId(datasetId) }).sort({ row_index: 1 }).lean().exec();
        return docs.map(toRow);
    }
    async queryRecords(datasetId, input, columns) {
        const byKey = new Map(columns.map((c) => [c.key, c.key]));
        const byName = new Map();
        for (const c of columns) {
            if (!byName.has(c.name))
                byName.set(c.name, c.key);
            if (!byName.has(c.originalName))
                byName.set(c.originalName, c.key);
        }
        const resolveKey = (col) => {
            const hk = byKey.get(col);
            if (hk)
                return hk;
            const hn = byName.get(col);
            if (hn)
                return hn;
            throw new Error(`Cot khong ton tai trong dataset: ${col}`);
        };
        for (const f of input.filters)
            resolveKey(f.column);
        for (const s of input.sort)
            resolveKey(s.column);
        if (input.search)
            for (const c of input.search.columns)
                resolveKey(c);
        const lastRowIndex = decodeRowIndex(input.cursor);
        const base = { dataset_id: new mongoose_2.Types.ObjectId(datasetId) };
        const conditions = this.buildFilterConditions(input.filters, input.search, resolveKey);
        const filter = conditions.length > 0 ? { $and: [base, ...conditions] } : base;
        if (lastRowIndex !== undefined) {
            filter.row_index = { $gt: lastRowIndex };
        }
        const safeLimit = Number.isFinite(input.limit) && input.limit > 0
            ? Math.min(Math.floor(input.limit), 500)
            : 50;
        const sortSpec = {};
        for (const s of input.sort)
            sortSpec[`props.${resolveKey(s.column)}`] = s.order === 'desc' ? -1 : 1;
        sortSpec.row_index = 1;
        const docs = await this.recordModel.find(filter).sort(sortSpec).limit(safeLimit + 1).lean().exec();
        const hasMore = docs.length > safeLimit;
        const page = hasMore ? docs.slice(0, safeLimit) : docs;
        return { items: page.map(toRow), hasMore };
    }
    async getColumnStats(datasetId, columnKey) {
        const objectDatasetId = new mongoose_2.Types.ObjectId(datasetId);
        const fieldPath = `props.${columnKey}`;
        const res = await this.recordModel.aggregate([
            { $match: { dataset_id: objectDatasetId } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    null_count: {
                        $sum: {
                            $cond: [{ $or: [{ $eq: [`$${fieldPath}`, null] }, { $not: [`$${fieldPath}`] }] }, 1, 0],
                        },
                    },
                    numeric_values: {
                        $push: { $cond: [{ $isNumber: `$${fieldPath}` }, `$${fieldPath}`, '$$REMOVE'] },
                    },
                },
            },
        ]);
        const stats = res[0];
        const totalRecords = stats?.total ?? 0;
        const nullCount = stats?.null_count ?? 0;
        const missingRatio = totalRecords > 0 ? nullCount / totalRecords : 0;
        const numericValues = stats?.numeric_values ?? [];
        if (numericValues.length === 0) {
            return { columnKey, columnName: columnKey, totalRecords, nullCount, missingRatio, histogram: [] };
        }
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const sum = numericValues.reduce((acc, val) => acc + val, 0);
        const average = sum / numericValues.length;
        const bucketCount = 10;
        const range = max - min;
        const step = range > 0 ? range / bucketCount : 1;
        const histogram = [];
        for (let i = 0; i < bucketCount; i++) {
            const bStart = min + i * step;
            const bEnd = i === bucketCount - 1 ? max : min + (i + 1) * step;
            histogram.push({ bucketStart: Number(bStart.toFixed(2)), bucketEnd: Number(bEnd.toFixed(2)), count: 0 });
        }
        for (const val of numericValues) {
            const index = Math.min(Math.floor((val - min) / step), bucketCount - 1);
            if (index >= 0 && index < bucketCount)
                histogram[index].count++;
        }
        return { columnKey, columnName: columnKey, totalRecords, nullCount, missingRatio, min, max, average: Number(average.toFixed(2)), histogram };
    }
    buildFilterConditions(filters, search, resolveKey) {
        const conditions = [];
        const byColumn = new Map();
        for (const f of filters) {
            const list = byColumn.get(f.column) ?? [];
            list.push(f);
            byColumn.set(f.column, list);
        }
        for (const [column, columnFilters] of byColumn) {
            const key = resolveKey(column);
            const path = `props.${key}`;
            const orParts = [];
            for (const f of columnFilters) {
                const part = this.buildOneCondition(path, f.operator, f.value);
                if (part)
                    orParts.push(part);
            }
            if (orParts.length > 0)
                conditions.push(orParts.length === 1 ? orParts[0] : { $or: orParts });
        }
        if (search && search.value.length > 0) {
            const needle = search.value;
            const orParts = search.columns.map((column) => {
                const key = resolveKey(column);
                return { [`props.${key}`]: { $regex: escapeRegExp(needle), $options: 'i' } };
            });
            conditions.push(orParts.length === 1 ? orParts[0] : { $or: orParts });
        }
        return conditions;
    }
    buildOneCondition(path, operator, value) {
        switch (operator) {
            case 'equals': return { [path]: value };
            case 'notEquals': return { [path]: { $ne: value } };
            case 'contains': return { [path]: { $regex: escapeRegExp(String(value)), $options: 'i' } };
            case 'notContains': return { [path]: { $not: { $regex: escapeRegExp(String(value)), $options: 'i' } } };
            case 'startsWith': return { [path]: { $regex: `^${escapeRegExp(String(value))}`, $options: 'i' } };
            case 'endsWith': return { [path]: { $regex: `${escapeRegExp(String(value))}$`, $options: 'i' } };
            case 'greaterThan': return { [path]: { $gt: value } };
            case 'greaterThanOrEqual': return { [path]: { $gte: value } };
            case 'lessThan': return { [path]: { $lt: value } };
            case 'lessThanOrEqual': return { [path]: { $lte: value } };
            case 'between': {
                const arr = Array.isArray(value) ? value : [];
                return { [path]: { $gte: arr[0], $lte: arr[1] } };
            }
            case 'in': return { [path]: { $in: Array.isArray(value) ? value : [] } };
            case 'isEmpty':
                return { $or: [{ [path]: null }, { [path]: { $exists: false } }, { [path]: '' }] };
            case 'isNotEmpty':
                return { $and: [{ [path]: { $ne: null } }, { [path]: { $exists: true } }, { [path]: { $nin: ['', null] } }] };
            default: return null;
        }
    }
};
exports.RecordQueryRepository = RecordQueryRepository;
exports.RecordQueryRepository = RecordQueryRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('DatasetRecord')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], RecordQueryRepository);
//# sourceMappingURL=record-query.repository.js.map