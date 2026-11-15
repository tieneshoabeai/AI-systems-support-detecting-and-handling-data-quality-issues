import { Types } from 'mongoose';
import type { IDataset } from './dataset.schema';
import type {
  CreateDatasetRecord,
  DatasetColumnRecord,
  DatasetRecord,
} from '../../domain/ports/dataset.repository.port';
import type { IColumnDefinition } from './dataset.schema';

function toColumnRecord(c: IColumnDefinition): DatasetColumnRecord {
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

function toColumnPersistence(c: DatasetColumnRecord): IColumnDefinition {
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

export function toDatasetRecord(doc: IDataset): DatasetRecord {
  return {
    id: doc._id.toString(),
    projectId: doc.project_id.toString(),
    workspaceId: doc.workspace_id.toString(),
    name: doc.name,
    originalFileName: doc.original_file_name,
    fileFormat: doc.file_format,
    fileSizeBytes: doc.file_size_bytes ?? 0,
    fileChecksum: doc.file_checksum,
    storageKey: (doc as unknown as Record<string, unknown>).storage_key as string ?? '',
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

export function toDatasetPersistence(data: CreateDatasetRecord & { id?: string }): Record<string, unknown> {
  const out: Record<string, unknown> = {
    project_id: new Types.ObjectId(data.projectId),
    workspace_id: new Types.ObjectId(data.workspaceId),
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
  if (data.id) out._id = new Types.ObjectId(data.id);
  if (data.currentVersion !== undefined) out.current_version = data.currentVersion;
  return out;
}

export function toDatasetUpdate(update: Partial<CreateDatasetRecord> & Record<string, unknown>): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const map: Record<string, string> = {
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
      const inner = v as Record<string, unknown>;
      const conv: Record<string, unknown> = {};
      for (const [ik, iv] of Object.entries(inner)) {
        const mapped = map[ik] ?? ik;
        if (ik === 'columns' && Array.isArray(iv)) conv[mapped] = (iv as DatasetColumnRecord[]).map(toColumnPersistence);
        else if (ik === 'columnIssues' && Array.isArray(iv)) conv[mapped] = iv;
        else conv[mapped] = iv;
      }
      Object.assign(set, conv);
    } else if (map[k]) {
      if (k === 'columns' && Array.isArray(v)) set[map[k]] = (v as DatasetColumnRecord[]).map(toColumnPersistence);
      else set[map[k]] = v;
    } else if (!k.startsWith('$')) {
      set[k] = v;
    }
  }
  // allow raw snake keys passthrough (tests use $set with snake)
  if (typeof update['$set'] === 'object' && update['$set'] !== null) {
    for (const [ik, iv] of Object.entries(update['$set'] as Record<string, unknown>)) {
      if (ik.includes('_') && !(ik in set)) (set as Record<string, unknown>)[ik] = iv;
    }
  }
  return set;
}
