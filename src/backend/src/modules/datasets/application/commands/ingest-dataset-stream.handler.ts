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
import {
  TRANSACTION_PORT,
  type TransactionPort,
} from '../../../../shared/application/ports/transaction.port';
import { SchemaInferenceService } from '../services/schema-inference.service';
import { DatasetFindingService } from '../services/dataset-finding.service';
import {
  makeFinding,
  type DatasetFinding,
} from '../../domain/services/finding.util';
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
import {
  assertCommaDelimitedCsv,
  stripBom,
} from '../../domain/services/csv-delimiter.util';
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
    private readonly findingService: DatasetFindingService,
    @Inject(OUTBOX_PORT)
    private readonly outbox: OutboxPort,
    @Inject(TRANSACTION_PORT)
    private readonly tx: TransactionPort,
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
    findings: DatasetFinding[];
  }> {
    return new Promise((resolve, reject) => {
      let totalRows = 0;
      let headers: string[] = [];
      const sampleRows: Record<string, unknown>[] = [];
      /** Phát hiện thu thập trong lúc đọc (OPEN-03/05). */
      const findings: DatasetFinding[] = [];
      let currentBatch: { datasetId: string; rowIndex: number; props: Record<string, unknown> }[] =
        [];

      /** Kiểu của từng cột — `null` = chưa suy xong schema (chưa thể ép kiểu). */
      let columnTypes: Map<string, ColumnDataType> | null = null;
      /** Các dòng đã đọc nhưng chưa ghi — chờ schema để biết kiểu cột. */
      let pendingRows: { rowIndex: number; cells: string[] }[] = [];

      /**
       * OPEN-05: chỉ nhận CSV phẩy cách — `delimiter` cố định là `,`.
       * `ignoreEmpty: false` giữ nguyên dòng rỗng (trailing blank row) để đưa
       * vào mục Phát hiện thay vì tự xoá.
       *
       * `headers: false` — tự quản lý header thay vì để `fast-csv` làm:
       * `fast-csv` **throw** khi header trùng ("Duplicate headers found"), nhưng
       * theo OPEN-03 tên cột trùng phải được **chấp nhận** và báo thành *phát
       * hiện* (chặn phân tích), không phải từ chối cả file.
       */
      const csvStream = fastCsv.parse({
        headers: false,
        trim: false,
        delimiter: ',',
        ignoreEmpty: false,
      });

      /**
       * Dựng `props` cho một dòng, ép kiểu theo schema nếu đã có.
       *
       * Dùng **mảng ô theo chỉ số** (không theo tên) → an toàn khi tên cột
       * trùng nhau (mỗi cột vẫn giữ riêng theo key ổn định `c{i}`).
       */
      const buildProps = (cells: string[]): Record<string, unknown> => {
        const props: Record<string, unknown> = {};
        headers.forEach((_h, i) => {
          const key = `c${i}`;
          const value = cells[i];
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
            props: buildProps(r.cells),
          });
        }
      };

      csvStream.on('data', (cells: string[]) => {
        // ── Dòng đầu tiên là HEADER ────────────────────────────────────────
        if (headers.length === 0) {
          // Bỏ BOM UTF-8 ở đầu tên cột đầu tiên (nếu có) — nếu không, cột đầu
          // sẽ mang tiền tố BOM và bị coi là lỗi tên cột.
          headers = cells.map((h, i) => (i === 0 ? stripBom(h) : h));
          return;
        }

        const rowIndex = totalRows;
        totalRows++;

        /**
         * Dòng lệch header (thiếu/thừa ô) ⇒ **phát hiện**, không tự cắt bớt
         * (OPEN-05: không chuẩn hoá dữ liệu theo suy đoán).
         */
        if (cells.length !== headers.length) {
          findings.push(
            makeFinding(
              'row_column_mismatch',
              'medium',
              `Dòng ${rowIndex + 2} có ${cells.length} ô nhưng header có ${headers.length} cột.`,
              {
                columnKey: null,
                columnName: null,
                rowIndex,
                details: { csvLine: rowIndex + 2, expected: headers.length, actual: cells.length },
              },
            ),
          );
        }

        /** Dòng hoàn toàn rỗng (trailing blank row) ⇒ phát hiện, không tự xoá. */
        const allEmpty = cells.every((c) => c === undefined || c.trim() === '');
        if (allEmpty) {
          findings.push(
            makeFinding(
              'blank_row',
              'low',
              `Dòng ${rowIndex + 2} trống hoàn toàn.`,
              { columnKey: null, columnName: null, rowIndex, details: { csvLine: rowIndex + 2 } },
            ),
          );
        }

        // Dựng row theo header (dùng chỉ số → an toàn với tên cột trùng).
        const row: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          row[h] = cells[i];
        });

        if (sampleRows.length < SAMPLE_ROWS_CAP) {
          sampleRows.push(row);
        }

        // ── Pha 1: chưa có schema → giữ dòng lại chờ ──────────────────────
        if (!columnTypes) {
          pendingRows.push({ rowIndex, cells });
          if (sampleRows.length >= SAMPLE_ROWS_CAP) {
            activateSchema();
            drainPending();
          }
          return;
        }

        // ── Pha 2: đã có schema → ép kiểu rồi ghi ─────────────────────────
        currentBatch.push({ datasetId, rowIndex, props: buildProps(cells) });

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
          .then(() => resolve({ totalRows, headers, sampleRows, findings }))
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
    /** Buffer dòng header đầu tiên (để kiểm tra dấu phân cách — OPEN-05). */
    let headerLineAcc = '';
    let delimiterChecked = false;

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
      // ── OPEN-05: kiểm tra dấu phân cách trên dòng header đầu tiên ────────
      if (!delimiterChecked) {
        headerLineAcc += buf.toString('utf-8');
        const nl = headerLineAcc.indexOf('\n');
        if (nl >= 0) {
          delimiterChecked = true;
          try {
            assertCommaDelimitedCsv(headerLineAcc.slice(0, nl));
          } catch (e) {
            magicError = e;
            uploadFailed = true;
            uploadPassThrough.destroy(e as Error);
            parsePassThrough.destroy(e as Error);
            fileStream.destroy(e as never);
            return;
          }
        } else if (headerLineAcc.length > 64 * 1024) {
          // Header quá dài (> 64 KB) → không phải CSV hợp lệ, cho qua bước này.
          delimiterChecked = true;
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

    /**
     * Dọn dẹp khi ingestion thất bại.
     *
     * ⚠️ **Vì sao KHÔNG soft-delete dataset ở đây?**
     *
     * Bản ghi (`dataset_records`) được ghi **ngoài transaction** (Đoạn A) vì
     * khối lượng 50k dòng vượt trần ~16 MB của MongoDB transaction. Do đó
     * transaction không thể rollback các bản ghi này ⇒ phải **xóa tay**.
     *
     * Còn lại dataset được **giữ lại** ở trạng thái `FAILED` (không soft-delete)
     * để người dùng tra cứu được nguyên nhân thất bại. Việc này cũng giữ đúng
     * bất biến "dataset đã nạp xong/thất bại là bản chụp bất biến".
     */
    const cleanupOnFailure = async (): Promise<void> => {
      try {
        await this.storage.deleteFile(storageKey);
      } catch {
        /* best-effort */
      }
      try {
        await this.datasets.deleteRecordsByDataset(datasetId);
      } catch {
        /* best-effort */
      }
    };

    try {
      if (magicError) throw magicError;

      // ─═══════════════════════════════════════════════════════════════════
      // ĐOẠN A — ghi bản ghi thô (NGOÀI transaction)
      //
      // ⚠️ Cố ý KHÔNG bọc transaction: 50k dòng × 10 cột vượt trần ~16 MB
      //    của MongoDB transaction ⇒ `TransactionTooLarge`. Bản ghi là dữ liệu
      //    thuần, insert-only nên idempotent khi retry.
      //
      //    Nếu Đoạn A thất bại → `cleanupOnFailure()` xóa bản ghi đã ghi dở.
      // ════════════════════════════════════════════════════════════════════
      const uploadPromise = this.storage.uploadStream(storageKey, uploadPassThrough, mimeType);
      const parsePromise = this.processCsvStream(datasetId, parsePassThrough);

      const [, { totalRows, headers, sampleRows, findings: streamFindings }] = await Promise.all([
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

      // ── Mục "Phát hiện" (OPEN-03/04/05) ────────────────────────────────
      // Gom: lỗi tên cột (chặn phân tích) + vấn đề phát hiện lúc đọc file.
      const findings = this.findingService.merge([
        ...this.findingService.fromColumnIssues(issues, columns),
        ...streamFindings,
      ]);

      const fileChecksum = `sha256:${hashStream.digest('hex')}`;

      // ── Entity tự kiểm tra invariant rồi chuyển sang READY ───────────────
      entity.markReady({
        fileChecksum,
        fileSizeBytes: bytesTransferred,
        rowCount: totalRows,
        columns,
        columnIssues: issues,
        findings,
      });

      // ════════════════════════════════════════════════════════════════════
      // ĐOẠN B — ghi metadata + cập nhật project/workspace + ghi event
      //          (TRONG transaction)
      //
      // Khối này **nhỏ** (vài trăm byte) nên vừa trong transaction ⇒ ghi
      // dataset + cập nhật project/workspace + ghi event DATASET_INGESTED là
      // **nguyên tử**: không bao giờ có trạng thái "dataset đã READY nhưng event
      // DATASET_INGESTED không được gửi" (⇒ cascade/thống kê bị lệch).
      //
      // Lỗi ở bất kỳ bước nào ⇒ rollback toàn bộ Đoạn B ⇒ dataset vẫn ở
      // `INGESTING` ⇒ `cleanupOnFailure()` xóa bản ghi ⇒ không còn rác.
      // ════════════════════════════════════════════════════════════════════
      const finalDataset = await this.tx.runInTransaction(async () => {
        const updated = await this.datasets.updateById(datasetId, {
          fileChecksum: entity.fileChecksum,
          fileSizeBytes: entity.fileSizeBytes,
          rowCount: entity.rowCount,
          columnCount: entity.columnCount,
          columns: entity.columns.map((c) => ({ ...c })),
          columnIssues: entity.columnIssues.map((i) => ({ ...i })),
          findings: entity.findings.map((f) => ({ ...f })),
          status: entity.status,
        });

        await this.projects.setHasDataset(projectId, true);
        await this.workspaces.incrementStorageUsed(project.workspaceId, bytesTransferred);

        // Nghiêm (strict): lỗi ghi event ⇒ ném ra ⇒ rollback toàn bộ.
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

        return updated;
      });

      this.logger.log(
        `Hoan tat ingestion CSV: ${datasetName} (${datasetId}) - ${totalRows} dong x ${columns.length} cot`,
      );

      return finalDataset ?? initialDataset;
    } catch (err: unknown) {
      // 1) Dọn bản ghi đã ghi dở ở Đoạn A + xoá file trên storage.
      await cleanupOnFailure();
      // 2) Đánh dấu dataset `FAILED` để người dùng tra cứu nguyên nhân.
      //    `updateById` chỉ nhận dataset đang `INGESTING` ⇒ chỉ chạy được khi
      //    Đoạn B đã rollback (hoặc chưa chạy), tuyệt đối không sửa dataset
      //    `READY` (bất biến dữ liệu).
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
