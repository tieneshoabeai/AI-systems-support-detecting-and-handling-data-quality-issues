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
var DataViewService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataViewService = void 0;
const common_1 = require("@nestjs/common");
const dataset_repository_port_1 = require("../../datasets/domain/ports/dataset.repository.port");
const record_query_port_1 = require("../domain/ports/record-query.port");
const cursor_codec_1 = require("../../../shared/pagination/cursor-codec");
const record_query_vo_1 = require("../domain/value-objects/record-query.vo");
const cursor_paginated_response_1 = require("../../../shared/pagination/cursor-paginated.response");
function validationError(message) {
    return new common_1.BadRequestException({
        message,
        error: 'VALIDATION_ERROR',
    });
}
function isObjectIdHex(id) {
    return /^[a-fA-F0-9]{24}$/.test(id);
}
function decodeRowCursor(cursor) {
    if (!cursor)
        return undefined;
    const decoded = cursor_codec_1.CursorCodec.decode(cursor);
    if (!decoded ||
        typeof decoded.row_index !== 'number' ||
        !Number.isInteger(decoded.row_index) ||
        decoded.row_index < 0) {
        throw validationError('Cursor khong hop le (opaque cursor sai dinh dang)');
    }
    return decoded.row_index;
}
function toSnakeStats(domain) {
    return {
        column_key: domain.columnKey,
        column_name: domain.columnName,
        total_records: domain.totalRecords,
        null_count: domain.nullCount,
        missing_ratio: domain.missingRatio,
        min: domain.min,
        max: domain.max,
        average: domain.average,
        histogram: (domain.histogram ?? []).map((b) => ({
            bucket_start: b.bucketStart,
            bucket_end: b.bucketEnd,
            count: b.count,
        })),
    };
}
function resolveColumnKey(input, byKey, byName) {
    const hitKey = byKey.get(input);
    if (hitKey)
        return hitKey;
    const hitName = byName.get(input);
    if (hitName)
        return hitName;
    throw validationError(`Cot khong ton tai trong dataset: ${input}`);
}
let DataViewService = DataViewService_1 = class DataViewService {
    records;
    datasets;
    logger = new common_1.Logger(DataViewService_1.name);
    constructor(records, datasets) {
        this.records = records;
        this.datasets = datasets;
    }
    async getRecords(datasetId, query) {
        if (!isObjectIdHex(datasetId)) {
            throw new common_1.BadRequestException('ID Tap du lieu khong hop le');
        }
        const dataset = await this.datasets.findById(datasetId);
        if (!dataset) {
            throw new common_1.NotFoundException(`Khong tim thay tap du lieu ${datasetId}`);
        }
        const lastRowIndex = decodeRowCursor(query.cursor);
        const limit = (0, record_query_vo_1.normalizeRecordLimit)(query.limit);
        const cursorForPort = lastRowIndex !== undefined
            ? cursor_codec_1.CursorCodec.encode({ row_index: lastRowIndex })
            : undefined;
        const { items, hasMore } = await this.records.listRecords(datasetId, cursorForPort, limit);
        const withOverflow = hasMore ? [...items, ...items.slice(0, 0)] : items;
        void withOverflow;
        const page = hasMore ? items : items;
        const resultItems = page;
        let nextCursor = null;
        if (hasMore && resultItems.length > 0) {
            const last = resultItems[resultItems.length - 1];
            nextCursor = cursor_codec_1.CursorCodec.encode({ row_index: last.rowIndex });
        }
        return {
            items: resultItems,
            meta: { nextCursor, hasMore },
            next_cursor: nextCursor,
            has_more: hasMore,
        };
    }
    async queryRecords(datasetId, body) {
        if (!isObjectIdHex(datasetId)) {
            throw new common_1.BadRequestException('ID Tap du lieu khong hop le');
        }
        const dataset = await this.datasets.findById(datasetId);
        if (!dataset) {
            throw new common_1.NotFoundException(`Khong tim thay tap du lieu ${datasetId}`);
        }
        const byKey = new Map(dataset.columns.map((c) => [c.key, c.key]));
        const byName = new Map();
        for (const c of dataset.columns) {
            if (!byName.has(c.name))
                byName.set(c.name, c.key);
            if (!byName.has(c.originalName))
                byName.set(c.originalName, c.key);
        }
        const resolveKey = (col) => resolveColumnKey(col, byKey, byName);
        for (const f of body.filters ?? [])
            resolveKey(f.column);
        for (const s of body.sort ?? [])
            resolveKey(s.column);
        if (body.search) {
            for (const c of body.search.columns)
                resolveKey(c);
        }
        const limit = (0, record_query_vo_1.normalizeRecordLimit)(body.limit);
        const queryInput = {
            filters: (body.filters ?? []).map((f) => ({ column: f.column, operator: f.operator, value: f.value })),
            sort: (body.sort ?? []).map((s) => ({ column: s.column, order: s.order })),
            search: body.search,
            cursor: body.cursor,
            limit,
        };
        const { items, hasMore } = await this.records.queryRecords(datasetId, queryInput, dataset.columns.map((c) => ({
            key: c.key,
            name: c.name,
            originalName: c.originalName,
            dataType: c.dataType,
        })));
        void cursor_paginated_response_1.createCursorPaginatedResponse;
        let nextCursor = null;
        if (hasMore && items.length > 0) {
            nextCursor = cursor_codec_1.CursorCodec.encode({ row_index: items[items.length - 1].rowIndex });
        }
        return {
            items,
            meta: { nextCursor, hasMore },
            next_cursor: nextCursor,
            has_more: hasMore,
        };
    }
    async getColumnStats(datasetId, columnRef) {
        if (!isObjectIdHex(datasetId)) {
            throw new common_1.BadRequestException('ID Tap du lieu khong hop le');
        }
        const dataset = await this.datasets.findById(datasetId);
        if (!dataset) {
            throw new common_1.NotFoundException(`Khong tim thay tap du lieu ${datasetId}`);
        }
        const targetColumn = dataset.columns.find((c) => c.key === columnRef) ??
            dataset.columns.find((c) => c.name === columnRef) ??
            dataset.columns.find((c) => c.originalName === columnRef);
        if (!targetColumn) {
            throw new common_1.NotFoundException(`Khong tim thay cot ${columnRef} trong dataset ${datasetId}`);
        }
        const domain = await this.records.getColumnStats(datasetId, targetColumn.key);
        const snake = toSnakeStats({ ...domain, columnName: targetColumn.name });
        if (targetColumn.dataType !== 'number') {
            return { ...snake, min: undefined, max: undefined, average: undefined, histogram: [] };
        }
        return snake;
    }
};
exports.DataViewService = DataViewService;
exports.DataViewService = DataViewService = DataViewService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(record_query_port_1.RECORD_QUERY_PORT)),
    __param(1, (0, common_1.Inject)(dataset_repository_port_1.DATASET_REPOSITORY_PORT)),
    __metadata("design:paramtypes", [Object, Object])
], DataViewService);
//# sourceMappingURL=data-view.service.js.map