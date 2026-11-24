import type {
  Dataset,
  DatasetColumn,
  DatasetColumnIssue,
  DatasetFinding,
} from '../../domain/entities/dataset.entity';

/**
 * DATASETS — Mapper entity domain → HTTP response.
 *
 * **Vì sao cần tầng này?**
 * Entity `Dataset` có state riêng tư + getter, không thể serialize thẳng
 * (`JSON.stringify(entity)` sẽ ra `{}` vì mọi thuộc tính nằm trong `props` riêng
 * tư). Tầng presentation phải **chủ động** ánh xạ từng trường — nhờ vậy hợp
 * đồng HTTP không vỡ khi entity thêm/bớt trường nội bộ.
 *
 * **S14 — không lộ `storageKey`:** khoá lưu trữ trên R2 là chi tiết hạ tầng,
 * tuyệt đối không đưa vào response (trước đây handler tự cắt — nay mapper
 * đảm nhiệm, để không thể quên).
 *
 * **Hợp đồng giữ nguyên:** các trường trả về giống hệt `DatasetRecord` cũ
 * (Phần 7 §3.2 — camelCase) → không vỡ frontend.
 */

/** Cột dataset trong response (khớp `DatasetColumnRecord` cũ). */
export interface DatasetColumnResponse {
  key: string;
  index: number;
  name: string;
  dataType: string;
  originalName: string;
  missingCount: number;
  isPii: boolean;
}

/** Lỗi tên cột trong response. */
export interface DatasetColumnIssueResponse {
  columnKey: string | null;
  issue: string;
  message: string;
}

/**
 * Phát hiện trong response — mục **"Phát hiện"** (OPEN-03/04/05).
 *
 * Luôn có **vị trí lỗi cụ thể** (key cột / số dòng) để người dùng biết chính
 * xác cần sửa ở đâu trong file CSV gốc.
 */
export interface DatasetFindingResponse {
  type: string;
  severity: string;
  columnKey: string | null;
  columnName: string | null;
  rowIndex: number | null;
  message: string;
  details?: Record<string, unknown>;
}

/** DTO trả về cho client — shape giống hệt `DatasetRecord` cũ (trừ `storageKey`). */
export interface DatasetResponse {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  originalFileName: string;
  fileFormat: 'csv';
  fileSizeBytes: number;
  fileChecksum: string;
  rowCount: number;
  columnCount: number;
  columns: DatasetColumnResponse[];
  columnIssues: DatasetColumnIssueResponse[];
  /** Mục "Phát hiện" (OPEN-03/04/05). */
  findings: DatasetFindingResponse[];
  hasHeader: boolean;
  delimiter: string;
  currentVersion: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

function toColumnResponse(column: DatasetColumn): DatasetColumnResponse {
  return {
    key: column.key,
    index: column.index,
    name: column.name,
    dataType: column.dataType,
    originalName: column.originalName,
    missingCount: column.missingCount,
    isPii: column.isPii,
  };
}

function toColumnIssueResponse(issue: DatasetColumnIssue): DatasetColumnIssueResponse {
  return {
    columnKey: issue.columnKey,
    issue: issue.issue,
    message: issue.message,
  };
}

function toFindingResponse(finding: DatasetFinding): DatasetFindingResponse {
  return {
    type: finding.type,
    severity: finding.severity,
    columnKey: finding.columnKey,
    columnName: finding.columnName,
    rowIndex: finding.rowIndex,
    message: finding.message,
    ...(finding.details ? { details: finding.details } : {}),
  };
}

/** Entity → response DTO. */
export function toDatasetResponse(dataset: Dataset): DatasetResponse {
  return {
    id: dataset.id,
    projectId: dataset.projectId,
    workspaceId: dataset.workspaceId,
    name: dataset.name,
    originalFileName: dataset.originalFileName,
    fileFormat: dataset.fileFormat,
    fileSizeBytes: dataset.fileSizeBytes,
    fileChecksum: dataset.fileChecksum,
    rowCount: dataset.rowCount,
    columnCount: dataset.columnCount,
    columns: dataset.columns.map(toColumnResponse),
    columnIssues: dataset.columnIssues.map(toColumnIssueResponse),
    findings: dataset.findings.map(toFindingResponse),
    hasHeader: dataset.hasHeader,
    delimiter: dataset.delimiter,
    currentVersion: dataset.currentVersion,
    status: dataset.status,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt,
  };
}
