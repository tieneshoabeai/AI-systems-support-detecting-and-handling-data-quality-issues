/**
 * DATASET — Domain repository port (hexagonal chuẩn).
 * Application chỉ gọi qua port này. Không mongoose, không schema.
 */

export const DATASET_REPOSITORY_PORT = Symbol('DatasetRepositoryPort');

export interface DatasetColumnRecord {
  key: string;
  index: number;
  name: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  originalName: string;
  missingCount: number;
  isPii: boolean;
}

export interface DatasetColumnIssueRecord {
  columnKey: string | null;
  issue: 'empty_name' | 'duplicate_name' | 'whitespace_only';
  message: string;
}

export interface DatasetRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  originalFileName: string;
  fileFormat: 'csv';
  fileSizeBytes: number;
  fileChecksum: string;
  storageKey: string;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumnRecord[];
  columnIssues: DatasetColumnIssueRecord[];
  hasHeader: boolean;
  delimiter: ',' | ';' | '\t' | '|';
  currentVersion: number;
  status: 'INGESTING' | 'READY' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordInsertDoc {
  datasetId: string;
  rowIndex: number;
  props: Record<string, unknown>;
}

export interface CreateDatasetRecord {
  projectId: string;
  workspaceId: string;
  name: string;
  originalFileName: string;
  fileFormat: 'csv';
  fileSizeBytes: number;
  fileChecksum: string;
  storageKey: string;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumnRecord[];
  columnIssues: DatasetColumnIssueRecord[];
  hasHeader: boolean;
  delimiter: ',' | ';' | '\t' | '|';
  status: 'INGESTING' | 'READY' | 'FAILED';
  currentVersion?: number;
}

export interface DatasetRepositoryPort {
  create(data: CreateDatasetRecord): Promise<DatasetRecord>;
  findById(id: string): Promise<DatasetRecord | null>;
  findByProject(projectId: string): Promise<DatasetRecord | null>;
  updateById(id: string, update: Partial<CreateDatasetRecord> & Record<string, unknown>): Promise<DatasetRecord | null>;
  bulkInsertRecords(records: RecordInsertDoc[]): Promise<number>;
  softDeleteDatasetWithRecords(datasetId: string): Promise<boolean>;
}
