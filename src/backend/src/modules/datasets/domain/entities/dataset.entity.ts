/**
 * DATASET — Aggregate root.
 *
 * **Vì sao cần entity thay vì `DatasetRecord` (interface trần)?**
 * Trước Bước 3, các invariant của dataset nằm rải rác ở handler/service:
 *   - `ingest-dataset-stream.handler.ts`: chỉ `.csv`, ≤ 50 MB, ≤ 1000 cột,
 *     phải có header, 1 dataset/project.
 *   - `rename-columns.handler.ts`: key `c{i}` bất biến, phải tính lại
 *     `columnIssues` sau khi đổi tên.
 *   - `reset-column-names.handler.ts`: tên hiển thị phải trở về `originalName`.
 *   - `delete-dataset.handler.ts`: xoá dataset phải gỡ cờ `hasDataset` ở project.
 *
 * Rủi ro: thêm use-case mới → dễ quên một trong các quy tắc trên.
 * Entity gom hết vào **một chỗ**, tự bảo vệ (Phần 5 §3.3).
 *
 * **Quy tắc bất di bất dịch:**
 *   1. State riêng tư + getter công khai — không có setter tự do.
 *   2. `static create()` (tạo mới) và `static reconstitute()` (dựng lại từ DB).
 *   3. Invariant kiểm tra trong entity, ném `DomainError` — **không** ném
 *      `HttpException` (Bước 2) và **không** ném `Error` trần.
 */
import {
  BaseEntity,
  type BaseEntityProps,
} from '../../../../shared/domain/entities';
import {
  ConflictError,
  ValidationError,
} from '../../../../shared/domain/errors';
import {
  MAX_COLUMNS,
  MAX_FILE_BYTES,
  isCsvFile,
} from '../value-objects/dataset-limits.vo';
import {
  stableColumnKey,
  type ColumnDataType,
} from '../value-objects/column-type.vo';
import { DATASET_EVENTS } from '../events/dataset-events';

/** Trạng thái vòng đời dataset. */
export type DatasetStatus = 'INGESTING' | 'READY' | 'FAILED';

/** Dấu phân cách cột được hỗ trợ. */
export type DatasetDelimiter = ',' | ';' | '\t' | '|';

/** Loại lỗi tên cột phát hiện lúc suy luận schema. */
export type DatasetColumnIssueType = 'empty_name' | 'duplicate_name' | 'whitespace_only';

/** Một cột của dataset — thuộc về aggregate. */
export interface DatasetColumn {
  /** Khoá cột ổn định theo vị trí: `c0`, `c1`, … (S21) — bất biến khi đổi tên. */
  key: string;
  /** Vị trí cột trong file gốc, ≥ 0. */
  index: number;
  /** Tên hiển thị (sửa được, mặc định = tên gốc). */
  name: string;
  dataType: ColumnDataType;
  /** Tên gốc từ file CSV — dùng cho Reset (M15). */
  originalName: string;
  missingCount: number;
  /** Cột được đánh dấu PII → luôn che trước khi đưa vào prompt AI. */
  isPii: boolean;
}

/** Lỗi tên cột — chặn phân tích cho tới khi hết lỗi. */
export interface DatasetColumnIssue {
  columnKey: string | null;
  issue: DatasetColumnIssueType;
  message: string;
}

/** Props đầy đủ của aggregate dataset. */
export interface DatasetProps extends BaseEntityProps {
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
  columns: DatasetColumn[];
  columnIssues: DatasetColumnIssue[];
  hasHeader: boolean;
  delimiter: DatasetDelimiter;
  currentVersion: number;
  status: DatasetStatus;
}

/**
 * Aggregate root `Dataset`.
 *
 * Đặc tính:
 *   - **Key cột bất biến** — `c{i}` theo vị trí, đổi tên hiển thị không đổi key.
 *   - **`status` vòng đời** — `INGESTING` → `READY` | `FAILED`.
 *   - **`columnIssues`** — lỗi tên cột (rỗng/trùng/chỉ whitespace); dataset có
 *     lỗi tên cột thì **chưa được phân tích** (UC-08/§3.25).
 */
export class Dataset extends BaseEntity<DatasetProps> {
  private constructor(props: DatasetProps) {
    super(props);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get projectId(): string {
    return this.props.projectId;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get name(): string {
    return this.props.name;
  }

  get originalFileName(): string {
    return this.props.originalFileName;
  }

  get fileFormat(): 'csv' {
    return this.props.fileFormat;
  }

  get fileSizeBytes(): number {
    return this.props.fileSizeBytes;
  }

  get fileChecksum(): string {
    return this.props.fileChecksum;
  }

  /** Khoá lưu trữ trên R2 — **không** được lộ ra API (S14). */
  get storageKey(): string {
    return this.props.storageKey;
  }

  get rowCount(): number {
    return this.props.rowCount;
  }

  get columnCount(): number {
    return this.props.columnCount;
  }

  get columns(): ReadonlyArray<DatasetColumn> {
    return this.props.columns;
  }

  get columnIssues(): ReadonlyArray<DatasetColumnIssue> {
    return this.props.columnIssues;
  }

  get hasHeader(): boolean {
    return this.props.hasHeader;
  }

  get delimiter(): DatasetDelimiter {
    return this.props.delimiter;
  }

  get currentVersion(): number {
    return this.props.currentVersion;
  }

  get status(): DatasetStatus {
    return this.props.status;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  /**
   * Tạo dataset mới (bước đầu của quy trình ingestion).
   *
   * Dataset mới luôn ở trạng thái `INGESTING` — chỉ khi upload & suy luận schema
   * thành công mới chuyển `READY` (`markReady()`), hoặc `FAILED` (`markFailed()`).
   *
   * Phát domain event `dataset.ingested` khi hoàn tất — không phát lúc tạo.
   */
  static create(props: {
    id: string;
    projectId: string;
    workspaceId: string;
    name: string;
    originalFileName: string;
    fileSizeBytes: number;
    storageKey: string;
    hasHeader?: boolean;
    delimiter?: DatasetDelimiter;
    now?: Date;
  }): Dataset {
    const now = props.now ?? new Date();
    return new Dataset({
      id: props.id,
      projectId: props.projectId,
      workspaceId: props.workspaceId,
      name: props.name,
      originalFileName: props.originalFileName,
      fileFormat: 'csv',
      fileSizeBytes: props.fileSizeBytes,
      fileChecksum: 'calculating...',
      storageKey: props.storageKey,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      columnIssues: [],
      hasHeader: props.hasHeader ?? true,
      delimiter: props.delimiter ?? ',',
      currentVersion: 1,
      status: 'INGESTING',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 1,
    });
  }

  /**
   * Dựng lại dataset từ dữ liệu đã lưu — **không** phát event.
   */
  static reconstitute(props: DatasetProps): Dataset {
    return new Dataset({
      ...props,
      columns: props.columns.map((c) => ({ ...c })),
      columnIssues: props.columnIssues.map((i) => ({ ...i })),
    });
  }

  // ── Truy vấn ─────────────────────────────────────────────────────────────

  /** Cột theo key ổn định (`c{i}`). */
  columnByKey(key: string): DatasetColumn | undefined {
    return this.props.columns.find((c) => c.key === key);
  }

  /** Cột theo tên hiển thị. */
  columnByName(name: string): DatasetColumn | undefined {
    return this.props.columns.find((c) => c.name === name);
  }

  /** Dataset còn lỗi tên cột → chưa được phân tích (§3.25). */
  hasColumnIssues(): boolean {
    return this.props.columnIssues.length > 0;
  }

  /** Dataset đã sẵn sàng để phân tích. */
  isAnalyzable(): boolean {
    return this.props.status === 'READY' && !this.hasColumnIssues();
  }

  // ── Hành vi ──────────────────────────────────────────────────────────────

  /**
   * Kiểm tra tính hợp lệ của file trước khi ingest.
   *
   * Invariant (Phần 2 v11 §3.25/§3.31.2):
   *   - Chỉ `.csv` (M28/O34) → `ValidationError`.
   *   - ≤ 50 MB → `ValidationError`.
   *   - ≤ 1000 cột → `ValidationError`.
   *   - Phải có header → `ValidationError`.
   */
  assertIngestible(fileName?: string, contentLength?: number, columnCount?: number): void {
    const name = fileName ?? this.props.originalFileName;
    if (!isCsvFile(name)) {
      throw new ValidationError(`Chi ho tro file .csv (nhan duoc: ${name})`);
    }
    if (contentLength !== undefined && contentLength > MAX_FILE_BYTES) {
      throw new ValidationError(
        `File vuot qua gioi han ${MAX_FILE_BYTES} bytes (nhan duoc ${contentLength})`,
      );
    }
    const columns = columnCount ?? this.props.columnCount;
    if (columns > MAX_COLUMNS) {
      throw new ValidationError(
        `So cot vuot qua gioi han ${MAX_COLUMNS} (nhan duoc ${columns})`,
      );
    }
    if (columns === 0 && columnCount !== undefined) {
      throw new ValidationError('File CSV khong co header');
    }
  }

  /**
   * Đổi tên hiển thị của dataset.
   *
   * Invariant: tên rỗng hoặc quá 100 ký tự → `ValidationError`.
   */
  rename(name?: string): void {
    if (name === undefined) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Ten tap du lieu khong duoc de trong');
    }
    if (trimmed.length > 100) {
      throw new ValidationError('Ten tap du lieu khong duoc vuot qua 100 ky tu');
    }
    this.props.name = trimmed;
    this.props.updatedAt = new Date();
  }

  /**
   * Đổi tên hiển thị của một/nhiều cột — **key `c{i}` giữ nguyên** (S21).
   *
   * Invariant:
   *   - Key không tồn tại → `ValidationError`.
   *   - Tên rỗng → `ValidationError`.
   *   - Tên trùng nhau → `ConflictError`.
   *
   * Phát domain event `dataset.renamed`.
   */
  renameColumns(renames: Array<{ key: string; name: string }>): void {
    const unknownKey = renames.find((r) => !this.columnByKey(r.key));
    if (unknownKey) {
      throw new ValidationError(`Cot khong ton tai: ${unknownKey.key}`, {
        reason: 'unknown_column_key',
        key: unknownKey.key,
      });
    }
    for (const r of renames) {
      if (r.name.trim().length === 0) {
        throw new ValidationError(`Ten cot khong duoc de trong (cot ${r.key})`, {
          reason: 'empty_column_name',
          key: r.key,
        });
      }
    }
    // Kiểm tra trùng tên trên toàn bộ tập cột sau khi đổi.
    const seen = new Map<string, string>();
    for (const c of this.props.columns) {
      const nextName = renames.find((r) => r.key === c.key)?.name ?? c.name;
      const first = seen.get(nextName);
      if (first !== undefined) {
        throw new ConflictError(
          `Ten cot "${nextName}" bi trung (cot ${first} va cot ${c.key})`,
          { reason: 'duplicate_column_name', name: nextName },
        );
      }
      seen.set(nextName, c.key);
    }

    this.props.columns = this.props.columns.map((c) => {
      const rename = renames.find((r) => r.key === c.key);
      return rename ? { ...c, name: rename.name } : { ...c };
    });
    this.props.updatedAt = new Date();
    this.addDomainEvent({
      eventType: DATASET_EVENTS.RENAMED,
      aggregateId: this.props.id,
      payload: {
        renames: renames.map((r) => ({ key: r.key, name: r.name })),
      },
      occurredAt: this.props.updatedAt,
    });
  }

  /**
   * Khôi phục tên hiển thị của cột về tên gốc từ file CSV (M15).
   */
  resetColumnNames(): void {
    this.props.columns = this.props.columns.map((c) => ({
      ...c,
      name: c.originalName,
    }));
    this.props.columnIssues = [];
    this.props.updatedAt = new Date();
  }

  /**
   * Ghi nhận kết quả suy luận schema + chuyển trạng thái `READY`.
   *
   * Invariant:
   *   - Chỉ dataset `INGESTING` mới được chuyển `READY` → `ConflictError`.
   *   - Số cột phải khớp `columnCount` → `ValidationError`.
   *
   * Phát domain event `dataset.ingested`.
   */
  markReady(params: {
    fileChecksum: string;
    fileSizeBytes: number;
    rowCount: number;
    columns: DatasetColumn[];
    columnIssues: DatasetColumnIssue[];
  }): void {
    if (this.props.status !== 'INGESTING') {
      throw new ConflictError(
        `Chi dataset INGESTING moi co the chuyen sang READY (hien tai: ${this.props.status})`,
      );
    }
    if (params.columns.length > MAX_COLUMNS) {
      throw new ValidationError(
        `So cot vuot qua gioi han ${MAX_COLUMNS} (nhan duoc ${params.columns.length})`,
      );
    }
    // Key cột phải ổn định & đúng thứ tự vị trí (S21).
    params.columns.forEach((c, i) => {
      if (c.key !== stableColumnKey(i)) {
        throw new ValidationError(
          `Key cot phai on dinh theo vi tri (c${i}), nhan duoc: ${c.key}`,
          { reason: 'unstable_column_key', expected: stableColumnKey(i), actual: c.key },
        );
      }
    });

    this.props.fileChecksum = params.fileChecksum;
    this.props.fileSizeBytes = params.fileSizeBytes;
    this.props.rowCount = params.rowCount;
    this.props.columns = params.columns.map((c) => ({ ...c }));
    this.props.columnCount = params.columns.length;
    this.props.columnIssues = params.columnIssues.map((i) => ({ ...i }));
    this.props.status = 'READY';
    this.props.updatedAt = new Date();
    this.addDomainEvent({
      eventType: DATASET_EVENTS.INGESTED,
      aggregateId: this.props.id,
      payload: {
        rowCount: params.rowCount,
        columnCount: params.columns.length,
        fileChecksum: params.fileChecksum,
      },
      occurredAt: this.props.updatedAt,
    });
  }

  /**
   * Đánh dấu ingestion thất bại.
   *
   * Phát domain event `dataset.failed`.
   */
  markFailed(reason?: string): void {
    this.props.status = 'FAILED';
    this.props.updatedAt = new Date();
    this.addDomainEvent({
      eventType: DATASET_EVENTS.FAILED,
      aggregateId: this.props.id,
      payload: reason ? { reason } : {},
      occurredAt: this.props.updatedAt,
    });
  }

  /**
   * Cập nhật danh sách lỗi tên cột (tính lại sau khi đổi tên cột).
   */
  setColumnIssues(issues: DatasetColumnIssue[]): void {
    this.props.columnIssues = issues.map((i) => ({ ...i }));
    this.props.updatedAt = new Date();
  }

  /** Bản chụp props — dùng cho mapper chuyển entity → persistence. */
  toProps(): DatasetProps {
    return {
      id: this.props.id,
      projectId: this.props.projectId,
      workspaceId: this.props.workspaceId,
      name: this.props.name,
      originalFileName: this.props.originalFileName,
      fileFormat: this.props.fileFormat,
      fileSizeBytes: this.props.fileSizeBytes,
      fileChecksum: this.props.fileChecksum,
      storageKey: this.props.storageKey,
      rowCount: this.props.rowCount,
      columnCount: this.props.columnCount,
      columns: this.props.columns.map((c) => ({ ...c })),
      columnIssues: this.props.columnIssues.map((i) => ({ ...i })),
      hasHeader: this.props.hasHeader,
      delimiter: this.props.delimiter,
      currentVersion: this.props.currentVersion,
      status: this.props.status,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      deletedAt: this.props.deletedAt ?? null,
      version: this.props.version,
    };
  }
}
