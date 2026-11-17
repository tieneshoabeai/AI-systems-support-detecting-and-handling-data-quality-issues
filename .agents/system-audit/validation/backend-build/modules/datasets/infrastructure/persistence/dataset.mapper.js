"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDatasetRecord = toDatasetRecord;
exports.toDatasetPersistence = toDatasetPersistence;
exports.toDatasetUpdate = toDatasetUpdate;
const mongoose_1 = require("mongoose");
function toColumnRecord(c) {
    return {
        key: c.key,
        index: c.index,
        name: c.name,
        dataType: c.data_type,
        originalName: c.original_name,
        missingCount: c.missing_count ?? 0,
        isPii: c.is_pii ?? false,
    };
}
function toColumnPersistence(c) {
    return {
        key: c.key,
        index: c.index,
        name: c.name,
        data_type: c.dataType,
        original_name: c.originalName,
        missing_count: c.missingCount ?? 0,
        is_pii: c.isPii ?? false,
    };
}
function toDatasetRecord(doc) {
    return {
        id: doc._id.toString(),
        projectId: doc.project_id.toString(),
        workspaceId: doc.workspace_id.toString(),
        name: doc.name,
        originalFileName: doc.original_file_name,
        fileFormat: doc.file_format,
        fileSizeBytes: doc.file_size_bytes ?? 0,
        fileChecksum: doc.file_checksum,
        storageKey: doc.storage_key ?? '',
        rowCount: doc.row_count ?? 0,
        columnCount: doc.column_count ?? 0,
        columns: (doc.columns ?? []).map(toColumnRecord),
        columnIssues: (doc.column_issues ?? []).map((i) => ({
            columnKey: i.column_key ?? null,
            issue: i.issue,
            message: i.message,
        })),
        hasHeader: doc.has_header ?? true,
        delimiter: doc.delimiter ?? ',',
        currentVersion: doc.current_version ?? 1,
        status: doc.status,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
    };
}
function toDatasetPersistence(data) {
    const out = {
        project_id: new mongoose_1.Types.ObjectId(data.projectId),
        workspace_id: new mongoose_1.Types.ObjectId(data.workspaceId),
        name: data.name,
        original_file_name: data.originalFileName,
        file_format: data.fileFormat,
        file_size_bytes: data.fileSizeBytes,
        file_checksum: data.fileChecksum,
        storage_key: data.storageKey,
        row_count: data.rowCount,
        column_count: data.columnCount,
        columns: (data.columns ?? []).map(toColumnPersistence),
        column_issues: (data.columnIssues ?? []).map((i) => ({
            column_key: i.columnKey,
            issue: i.issue,
            message: i.message,
        })),
        has_header: data.hasHeader,
        delimiter: data.delimiter,
        status: data.status,
    };
    if (data.id)
        out._id = new mongoose_1.Types.ObjectId(data.id);
    if (data.currentVersion !== undefined)
        out.current_version = data.currentVersion;
    return out;
}
function toDatasetUpdate(update) {
    const set = {};
    const map = {
        name: 'name',
        originalFileName: 'original_file_name',
        fileFormat: 'file_format',
        fileSizeBytes: 'file_size_bytes',
        fileChecksum: 'file_checksum',
        storageKey: 'storage_key',
        rowCount: 'row_count',
        columnCount: 'column_count',
        columns: 'columns',
        columnIssues: 'column_issues',
        hasHeader: 'has_header',
        delimiter: 'delimiter',
        currentVersion: 'current_version',
        status: 'status',
    };
    for (const [k, v] of Object.entries(update)) {
        if (k === '$set' && typeof v === 'object' && v !== null) {
            const inner = v;
            const conv = {};
            for (const [ik, iv] of Object.entries(inner)) {
                const mapped = map[ik] ?? ik;
                if (ik === 'columns' && Array.isArray(iv))
                    conv[mapped] = iv.map(toColumnPersistence);
                else if (ik === 'columnIssues' && Array.isArray(iv))
                    conv[mapped] = iv;
                else
                    conv[mapped] = iv;
            }
            Object.assign(set, conv);
        }
        else if (map[k]) {
            if (k === 'columns' && Array.isArray(v))
                set[map[k]] = v.map(toColumnPersistence);
            else
                set[map[k]] = v;
        }
        else if (!k.startsWith('$')) {
            set[k] = v;
        }
    }
    if (typeof update['$set'] === 'object' && update['$set'] !== null) {
        for (const [ik, iv] of Object.entries(update['$set'])) {
            if (ik.includes('_') && !(ik in set))
                set[ik] = iv;
        }
    }
    return set;
}
//# sourceMappingURL=dataset.mapper.js.map