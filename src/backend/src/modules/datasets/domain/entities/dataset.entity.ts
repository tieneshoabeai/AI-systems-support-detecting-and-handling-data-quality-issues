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

/** Độ dài tối đa của tên dataset (khớp `DatasetSchema.name.maxlength`). */
export const MAX_DATASET_NAME_LENGTH = 100;

/** Độ dài tối đa của tên hiển thị cột. */
export const MAX_COLUMN_NAME_LENGTH = 100;

/**
 * Phát hiện lỗi tên cột — **thuần**, dùng chung cho lúc suy luận schema và sau
 * khi đổi tên cột (mục 3.6.2 rule 2: `column_issues` phải được tính lại).
 *
 * So sánh trùng lặp **chính xác** (phân biệt hoa thường và khoảng trắng) —
 * khớp với `SchemaInferenceService.detectColumnIssues()` và UC-10 bước 1
 * ("không tự trim hay đổi hoa thường").
 */
export function detectColumnIssues(columns: ReadonlyArray<DatasetColumn>): DatasetColumnIssue[] {
  const issues: DatasetColumnIssue[] = [];
  const seen = new Map<string, number>();
  columns.forEach((c, i) => {
    if (c.name === '') {
      issues.push({ columnKey: c.key, issue: 'empty_name', message: `Cot ${c.key} co ten rong` });
    } else if (/^\s+$/.test(c.name)) {
      issues.push({
        columnKey: c.key,
        issue: 'whitespace_only',
        message: `Cot ${c.key} chi chua khoang trang`,
      });
    }
    const first = seen.get(c.name);
    if (first !== undefined && c.name !== '') {
      issues.push({
        columnKey: c.key,
        issue: 'duplicate_name',
        message: `Ten cot "${c.name}" bi trung (cot c${first} va ${c.key})`,
      });
    } else if (first === undefined) {
      seen.set(c.name, i);
    }
  });
  return issues;
}

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

  /**
   * Bật/tắt cờ PII cho một hoặc nhiều cột — GĐ4.
   *
   * **Đây KHÔNG phải sửa nội dung dữ liệu.** `isPii` là *metadata phân loại cột*,
   * nằm ngoài bản chụp dữ liệu — nên vẫn tuân thủ nguyên tắc bất biến
   * ("dữ liệu nạp vào như nào thì giữ nguyên như vậy").
   *
   * Invariant:
   *   - Key cột không tồn tại → `ValidationError`.
   *   - Không có cột nào thay đổi → `ValidationError` (payload rỗng về nghĩa).
   *
   * Phát domain event `dataset.pii_updated` để audit log ghi lại thay đổi.
   */
  setColumnPii(updates: Array<{ columnKey: string; isPii: boolean }>): void {
    if (updates.length === 0) {
      throw new ValidationError('Khong co cot nao duoc cap nhat');
    }
    const unknown = updates.find((u) => !this.columnByKey(u.columnKey));
    if (unknown) {
      throw new ValidationError(`Cot khong ton tai: ${unknown.columnKey}`, {
        reason: 'unknown_column_key',
        key: unknown.columnKey,
      });
    }
    const changed: Array<{ columnKey: string; isPii: boolean }> = [];
    for (const u of updates) {
      const col = this.columnByKey(u.columnKey);
      if (!col) continue;
      if (col.isPii === u.isPii) continue; // không đổi → bỏ qua
      col.isPii = u.isPii;
      changed.push({ columnKey: u.columnKey, isPii: u.isPii });
    }
    if (changed.length === 0) {
      throw new ValidationError('Khong co cot nao thay doi', {
        reason: 'no_column_changed',
      });
    }
    this.props.updatedAt = new Date();
    this.addDomainEvent({
      eventType: DATASET_EVENTS.PII_UPDATED,
      aggregateId: this.props.id,
      payload: { changes: changed },
      occurredAt: this.props.updatedAt,
    });
  }

  /**
   * Đổi tên hiển thị của dataset — **metadata**, không phải nội dung dữ liệu.
   *
   * `PATCH /datasets/{id}` (contract §3.13 #46 `VIEW-08`).
   *
   * Invariant:
   *   - Tên rỗng / chỉ khoảng trắng → `ValidationError`.
   *   - Tên vượt 100 ký tự → `ValidationError`.
   *
   * Không đụng tới `props` của bản ghi, không đụng số dòng/số cột → **không**
   * vi phạm nguyên tắc bất biến dữ liệu (mục 3.40).
   */
  rename(newName: string): void {
    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Ten tap du lieu khong duoc rong');
    }
    if (trimmed.length > MAX_DATASET_NAME_LENGTH) {
      throw new ValidationError(
        `Ten tap du lieu toi da ${MAX_DATASET_NAME_LENGTH} ky tu (nhan duoc ${trimmed.length})`,
      );
    }
    this.props.name = trimmed;
    this.props.updatedAt = new Date();
  }

  /**
   * Đổi tên hiển thị của một hoặc nhiều cột — **metadata**, không phải nội
   * dữ liệu (key `c{i}` và giá trị ô giữ nguyên).
   *
   * `PATCH /datasets/{id}/columns` (contract §3.13 #47 `VIEW-08`).
   *
   * Invariant (UC-10 — "Nhập hoặc chỉnh sửa tên cột rỗng/trùng"):
   *   - Key cột không tồn tại → `ValidationError`.
   *   - Tên mới rỗng / chỉ khoảng trắng → `ValidationError`.
   *   - Tên mới trùng với tên của cột khác trong cùng dataset → `ValidationError`.
   *   - Sau khi đổi → **tính lại** `columnIssues` (mục 3.6.2 rule 2 của schema).
   *
   * Lưu ý: tên **không** được trim/sanitize tự động (UC-10 bước 1) — so sánh
   * trùng lặp phân biệt hoa/thường và khoảng trắng, giống hệt
   * `SchemaInferenceService.detectColumnIssues()`.
   */
  renameColumns(updates: Array<{ columnKey: string; newName: string }>): void {
    if (updates.length === 0) {
      throw new ValidationError('Khong co cot nao duoc cap nhat');
    }
    for (const u of updates) {
      if (!this.columnByKey(u.columnKey)) {
        throw new ValidationError(`Cot khong ton tai: ${u.columnKey}`, {
          reason: 'unknown_column_key',
          key: u.columnKey,
        });
      }
      if (u.newName.trim().length === 0) {
        throw new ValidationError(`Ten cot moi khong duoc rong: ${u.columnKey}`, {
          reason: 'empty_new_name',
          key: u.columnKey,
        });
      }
      if (u.newName.length > MAX_COLUMN_NAME_LENGTH) {
        throw new ValidationError(
          `Ten cot toi da ${MAX_COLUMN_NAME_LENGTH} ky tu (nhan duoc ${u.newName.length})`,
          { reason: 'name_too_long', key: u.columnKey },
        );
      }
    }
    // Kiểm tra trùng lặp trên **tập tên sau khi đổi** (UC-10 bước 1).
    const finalNames = this.props.columns.map((c) => {
      const upd = updates.find((u) => u.columnKey === c.key);
      return upd ? upd.newName : c.name;
    });
    for (let i = 0; i < finalNames.length; i++) {
      const name = finalNames[i] as string;
      for (let j = i + 1; j < finalNames.length; j++) {
        if (name === finalNames[j]) {
          throw new ValidationError(
            `Ten cot bi trung: "${name}" (cot c${i} va cot c${j})`,
            { reason: 'duplicate_name', columns: [this.props.columns[i]?.key, this.props.columns[j]?.key] },
          );
        }
      }
    }
    for (const u of updates) {
      const col = this.columnByKey(u.columnKey);
      if (col) col.name = u.newName;
    }
    this.props.columnIssues = detectColumnIssues(this.props.columns);
    this.props.updatedAt = new Date();
  }

  /**
   * Khôi phục tên hiển thị của cột về **tên gốc** trong file CSV.
   *
   * `POST /datasets/{id}/columns/reset` (contract §3.13 #48 `VIEW-07`).
   *
   * Đây là hành vi duy nhất còn lại của "Reset Dataset" sau khi thu hẹp
   * (mục 3.12 / 3.40.5): **khôi phục tên cột**, không khôi phục dữ liệu.
   *
   * Invariant:
   *   - Không có cột nào khác tên gốc → `ValidationError` (yêu cầu thừa).
   *
   * Không làm mất hiệu lực kết quả phân tích: `input_fingerprint` không chứa
   * tên cột (mục 3.28).
   */
  resetColumnNames(): void {
    const changed = this.props.columns.filter((c) => c.name !== c.originalName);
    if (changed.length === 0) {
      throw new ValidationError('Khong co cot nao can khoi phuc ten goc', {
        reason: 'no_column_changed',
      });
    }
    for (const col of this.props.columns) {
      col.name = col.originalName;
    }
    this.props.columnIssues = detectColumnIssues(this.props.columns);
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
