import * as fastCsv from 'fast-csv';
import { createHash } from 'node:crypto';
/**
 * IngestDatasetStreamHandler — Use case: `ingestDatasetStream()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** dùng entity `Dataset` làm trạng thái chuẩn —
 * `Dataset.create()` (INGESTING) → `markReady()` (kèm schema) → `markFailed()`.
 * Invariant (chỉ `.csv`, ≤ 50 MB, ≤ 1000 cột, phải có header, key cột ổn định)
 * do entity kiểm tra, không phải handler.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PassThrough, Readable } from 'stream';
import {
  DATASET_REPOSITORY_PORT,
  type CreateDatasetInput,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { Dataset } from '../../domain/entities/dataset.entity';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/application/ports/storage.port';
import { OUTBOX_PORT, type OutboxPort } from '../../../../shared/application/ports/outbox.port';
import { SchemaInferenceService } from '../services/schema-inference.service';
import {
  IMPORT_BATCH_SIZE,
  MAX_COLUMNS,
  MAX_FILE_BYTES,
  SAMPLE_ROWS_CAP,
  assertCsvFile,
  datasetNameFromFile,
  storageKeyForDataset,
} from '../../domain/value-objects/dataset-limits.vo';
import {
  coerceValue,
  type ColumnDataType,
} from '../../domain/value-objects/value-coercion.vo';
import {
  validationError,
  unsupportedFileType,
  assertCsvMagicBytes,
  newHexId,
} from '../datasets.utils';
import { ConflictError, FileTooLargeError, ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class IngestDatasetStreamHandler {
  private readonly logger = new Logger(IngestDatasetStreamHandler.name);
  constructor(
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    private readonly configService: ConfigService,
    @Inject(WORKSPACE_ACCESS_PORT)
    private readonly workspaces: WorkspaceAccessPort,
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    private readonly schemaInferenceService: SchemaInferenceService,
    @Inject(OUTBOX_PORT)
    private readonly outbox: OutboxPort,
  ) {}

  /**
   * Đọc CSV theo **2 pha** để dữ liệu lưu vào MongoDB **khớp với schema**:
   *
   * - **Pha 1 — suy schema**: đọc `SAMPLE_ROWS_CAP` dòng đầu để suy `dataType`
   *   cho từng cột (dùng đúng `inferSchemaWithIssues` mà `execute()` dùng, nên
   *   kiểu lúc ghi **khớp** kiểu lưu trong schema).
   * - **Pha 2 — ép kiểu rồi ghi**: mọi dòng còn lại được ép về đúng kiểu cột
   *   (`number` → số, `boolean` → bool, `date` → `Date` theo giờ Việt Nam) trước
   *   khi `bulkInsertRecords`.
   *
   * Vì sao cần: trước đây `props` lưu **giá trị thô** từ CSV → cột schema là
   * `number` nhưng giá trị lưu là chuỗi `"4"`. MongoDB so sánh theo BSON type
   * nên lọc/sắp xếp/thống kê sai (xem `value-coercion.vo.ts`).
   *
   * Bộ nhớ được giới hạn: chỉ `SAMPLE_ROWS_CAP` dòng được giữ lại chờ schema,
   * phần còn lại ghi theo batch `IMPORT_BATCH_SIZE`.
   */
  private async processCsvStream(
    datasetId: string,
    stream: Readable,
  ): Promise<{
    totalRows: number;
    headers: string[];
    sampleRows: Record<string, unknown>[];
  }> {
    return new Promise((resolve, reject) => {
      let totalRows = 0;
      let headers: string[] = [];
      const sampleRows: Record<string, unknown>[] = [];
      let currentBatch: { datasetId: string; rowIndex: number; props: Record<string, unknown> }[] =
        [];

      /** Kiểu của từng cột — `null` = chưa suy xong schema (chưa thể ép kiểu). */
      let columnTypes: Map<string, ColumnDataType> | null = null;
      /** Các dòng đã đọc nhưng chưa ghi — chờ schema để biết kiểu cột. */
      let pendingRows: { rowIndex: number; raw: Record<string, unknown> }[] = [];

      const csvStream = fastCsv.parse({ headers: true, trim: false });

      /** Dựng `props` cho một dòng, ép kiểu theo schema nếu đã có. */
      const buildProps = (raw: Record<string, unknown>): Record<string, unknown> => {
        const props: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          const key = `c${i}`;
          const value = raw[h];
          if (value === '' || value === undefined) {
            props[key] = null;
            return;
          }
          const type = columnTypes?.get(key);
          props[key] = type ? coerceValue(value, type) : value;
        });
        return props;
      };

      const flushBatch = async (): Promise<void> => {
        if (currentBatch.length > 0) {
          const batchToInsert = currentBatch;
          currentBatch = [];
          await this.datasets.bulkInsertRecords(batchToInsert);
        }
      };

      /**
       * Suy schema từ sample và bật ép kiểu cho các dòng đang chờ.
       *
       * Dùng **đúng** `inferSchemaWithIssues` mà `execute()` dùng → kiểu cột lúc
       * ghi luôn khớp với kiểu cột lưu trong `dataset.columns`.
       */
      const activateSchema = (): void => {
        if (columnTypes) return;
        const { columns } = this.schemaInferenceService.inferSchemaWithIssues(
          headers,
          sampleRows,
        );
        columnTypes = new Map(columns.map((c) => [c.key, c.dataType] as const));
      };

      /** Chuyển các dòng đang chờ (chưa ghi) thành batch đã ép kiểu. */
      const drainPending = (): void => {
        if (pendingRows.length === 0) return;
        const rows = pendingRows;
        pendingRows = [];
        for (const r of rows) {
          currentBatch.push({
            datasetId,
            rowIndex: r.rowIndex,
            props: buildProps(r.raw),
          });
        }
      };

      csvStream.on('headers', (parsedHeaders: string[]) => {
        headers = parsedHeaders;
      });

      csvStream.on('data', (row: Record<string, unknown>) => {
        const rowIndex = totalRows;
        totalRows++;

        if (sampleRows.length < SAMPLE_ROWS_CAP) {
          sampleRows.push(row);
        }

        // ── Pha 1: chưa có schema → giữ dòng lại chờ ──────────────────────
        if (!columnTypes) {
          pendingRows.push({ rowIndex, raw: row });
          if (sampleRows.length >= SAMPLE_ROWS_CAP) {
            activateSchema();
            drainPending();
          }
          return;
        }

        // ── Pha 2: đã có schema → ép kiểu rồi ghi ─────────────────────────
        currentBatch.push({ datasetId, rowIndex, props: buildProps(row) });

        if (currentBatch.length >= IMPORT_BATCH_SIZE) {
          csvStream.pause();
          flushBatch()
            .then(() => csvStream.resume())
            .catch((err: unknown) => csvStream.destroy(err instanceof Error ? err : new Error(String(err))));
        }
      });

      csvStream.on('end', () => {
        // File có ít hơn `SAMPLE_ROWS_CAP` dòng → suy schema lúc kết thúc.
        if (!columnTypes) {
          activateSchema();
          drainPending();
        }
        flushBatch()
          .then(() => resolve({ totalRows, headers, sampleRows }))
          .catch((err) => reject(err));
      });

      csvStream.on('error', (err) => reject(err));

      stream.pipe(csvStream);
    });
  }

  async execute(params: {
    projectId: string;
    fileStream: Readable;
    fileName: string;
    mimeType: string;
    contentLength?: number;
  }): Promise<Dataset> {
    const { projectId, fileStream, fileName, mimeType, contentLength = 0 } = params;

    try {
      assertCsvFile(fileName);
    } catch {
      throw unsupportedFileType(fileName);
    }
    // Không tin Content-Type header: chặn Excel giả danh CSV ngay từ mimeType
    if (
      typeof mimeType === 'string' &&
      /excel|spreadsheet|officedocument|ms-excel/i.test(mimeType)
    ) {
      throw new ValidationError( 'File Excel không được chấp nhận. Vui lòng xuất sang CSV.', { reason: 'excel_not_allowed', mimeType, fileName });
    }
    if (contentLength > MAX_FILE_BYTES) {
      throw new FileTooLargeError( `File vuot qua gioi han 50MB (nhan duoc ${contentLength} bytes)`);
    }

    const project = await this.projects.getProjectById(projectId);
    if (project.hasDataset) {
      throw new ConflictError('Moi Project chi duoc phep lien ket toi da 1 Dataset hoat dong. Vui long xoa hoac luu tru Dataset hien tai truoc khi tai len du lieu moi.',);
    }

    if (contentLength > 0) {
      const quota = await this.storage.checkUploadQuota(contentLength);
      if (!quota.allowed) {
        throw new FileTooLargeError('Dung luong luu tru vuot qua gioi han 10GB cua Cloudflare R2 (Hard Block 100%).',);
      }
      const wsQuota = Number(
        this.configService.get<number>('WORKSPACE_STORAGE_QUOTA_BYTES', 524288000),
      );
      await this.workspaces.checkWorkspaceUploadQuota(project.workspaceId, contentLength, wsQuota);
    }

    const datasetId = newHexId();
    const datasetName = datasetNameFromFile(fileName);
    const storageKey = storageKeyForDataset(datasetId);

    // ── Tạo entity `Dataset` ở trạng thái INGESTING ───────────────────────
    const entity = Dataset.create({
      id: datasetId,
      projectId: project.id,
      workspaceId: project.workspaceId,
      name: datasetName,
      originalFileName: fileName,
      fileSizeBytes: contentLength,
      storageKey,
    });

    const initialDataset = await this.datasets.create({
      ...entity.toProps(),
      id: datasetId,
    } as CreateDatasetInput);

    const hashStream = createHash('sha256');
    const uploadPassThrough = new PassThrough();
    const parsePassThrough = new PassThrough();

    let bytesTransferred = 0;
    let uploadFailed = false;
    let headChecked = false;
    let headAcc = Buffer.alloc(0);
    let magicError: unknown = null;

    fileStream.on('data', (chunk: Buffer | string) => {
      if (magicError) return;
      const buf: Buffer =
        typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : (chunk as Buffer);
      if (!headChecked) {
        headAcc = Buffer.concat([headAcc, buf]).subarray(0, 32);
        // Đủ 8 bytes là có thể kết luận magic (PK/OOXML, OLE2, NUL)
        if (headAcc.length >= 8) {
          try {
            assertCsvMagicBytes(headAcc, fileName);
          } catch (e) {
            magicError = e;
            uploadFailed = true;
            uploadPassThrough.destroy(e as Error);
            parsePassThrough.destroy(e as Error);
            fileStream.destroy(e as never);
            return;
          }
          headChecked = true;
        }
      }
      bytesTransferred += buf.length;
      if (bytesTransferred > MAX_FILE_BYTES) {
        uploadFailed = true;
        const err = new FileTooLargeError( 'File vuot qua gioi han 50MB trong luc tai len');
        uploadPassThrough.destroy(err as never);
        parsePassThrough.destroy(err as never);
        fileStream.destroy(err as never);
        return;
      }
      hashStream.update(buf);
      uploadPassThrough.write(buf);
      parsePassThrough.write(buf);
    });

    fileStream.on('end', () => {
      if (!headChecked && !magicError && headAcc.length > 0) {
        try {
          assertCsvMagicBytes(headAcc, fileName);
        } catch (e) {
          magicError = e;
          uploadFailed = true;
          uploadPassThrough.destroy(e as Error);
          parsePassThrough.destroy(e as Error);
          return;
        }
        headChecked = true;
      }
      uploadPassThrough.end();
      parsePassThrough.end();
    });

    fileStream.on('error', (err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err));
      uploadPassThrough.destroy(e);
      parsePassThrough.destroy(e);
    });

    const cleanupOnFailure = async (): Promise<void> => {
      try {
        await this.storage.deleteFile(storageKey);
      } catch {
        /* best-effort */
      }
      try {
        await this.datasets.softDeleteDatasetWithRecords(datasetId);
      } catch {
        /* best-effort */
      }
    };

    try {
      if (magicError) throw magicError;
      const uploadPromise = this.storage.uploadStream(storageKey, uploadPassThrough, mimeType);
      const parsePromise = this.processCsvStream(datasetId, parsePassThrough);

      const [, { totalRows, headers, sampleRows }] = await Promise.all([
        uploadPromise,
        parsePromise,
      ]);

      if (uploadFailed || bytesTransferred > MAX_FILE_BYTES) {
        throw new FileTooLargeError( 'File vuot qua gioi han 50MB');
      }

      if (headers.length > MAX_COLUMNS) {
        throw validationError(
          `So cot vuot qua gioi han ${MAX_COLUMNS} (nhan duoc ${headers.length})`,
          { reason: 'too_many_columns', column_count: headers.length },
        );
      }
      if (headers.length === 0) {
        throw validationError('File CSV khong co header', { reason: 'missing_header' });
      }

      const { columns, issues } = this.schemaInferenceService.inferSchemaWithIssues(
        headers,
        sampleRows,
      );

      const fileChecksum = `sha256:${hashStream.digest('hex')}`;

      // ── Entity tự kiểm tra invariant rồi chuyển sang READY ───────────────
      entity.markReady({
        fileChecksum,
        fileSizeBytes: bytesTransferred,
        rowCount: totalRows,
        columns,
        columnIssues: issues,
      });

      const finalDataset = await this.datasets.updateById(datasetId, {
        fileChecksum: entity.fileChecksum,
        fileSizeBytes: entity.fileSizeBytes,
        rowCount: entity.rowCount,
        columnCount: entity.columnCount,
        columns: entity.columns.map((c) => ({ ...c })),
        columnIssues: entity.columnIssues.map((i) => ({ ...i })),
        status: entity.status,
      });

      await this.projects.setHasDataset(projectId, true);
      await this.workspaces.incrementStorageUsed(project.workspaceId, bytesTransferred);

      await this.outbox.recordEvent({
        aggregate_type: 'DATASET',
        aggregate_id: datasetId,
        event_type: 'DATASET_INGESTED',
        payload: {
          dataset_id: datasetId,
          project_id: projectId,
          workspace_id: project.workspaceId,
          row_count: totalRows,
          column_count: columns.length,
          file_checksum: fileChecksum,
        },
      });

      this.logger.log(
        `Hoan tat ingestion CSV: ${datasetName} (${datasetId}) - ${totalRows} dong x ${columns.length} cot`,
      );

      return finalDataset ?? initialDataset;
    } catch (err: unknown) {
      await cleanupOnFailure();
      try {
        entity.markFailed(err instanceof Error ? err.message : String(err));
        await this.datasets.updateById(datasetId, { status: entity.status });
      } catch {
        /* best-effort */
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`That bai ingestion dataset ${datasetId}: ${msg}`);
      throw err;
    }
  }
}
