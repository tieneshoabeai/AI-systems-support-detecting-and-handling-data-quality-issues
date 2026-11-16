import * as fastCsv from 'fast-csv';
import { createHash } from 'node:crypto';
/**
 * IngestDatasetStreamHandler — Use case: `ingestDatasetStream()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PassThrough, Readable } from 'stream';
import {
  DATASET_REPOSITORY_PORT,
  type CreateDatasetRecord,
  type DatasetRecord,
  type DatasetRepositoryPort,
} from '../../domain/ports/dataset.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { WORKSPACE_ACCESS_PORT, type WorkspaceAccessPort } from '../../../workspaces';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PORT, type StoragePort } from '../../../../shared/ports/storage.port';
import { OUTBOX_PORT, type OutboxPort } from '../../../../shared/ports/outbox.port';
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
  validationError,
  unsupportedFileType,
  assertCsvMagicBytes,
  newHexId,
} from '../datasets.utils';

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

      const csvStream = fastCsv.parse({ headers: true, trim: false });

      const flushBatch = async (): Promise<void> => {
        if (currentBatch.length > 0) {
          const batchToInsert = currentBatch;
          currentBatch = [];
          await this.datasets.bulkInsertRecords(batchToInsert);
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

        const props: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          const raw = row[h];
          props[`c${i}`] = raw === '' || raw === undefined ? null : raw;
        });

        currentBatch.push({ datasetId, rowIndex, props });

        if (currentBatch.length >= IMPORT_BATCH_SIZE) {
          csvStream.pause();
          flushBatch()
            .then(() => csvStream.resume())
            .catch((err: unknown) => csvStream.destroy(err instanceof Error ? err : new Error(String(err))));
        }
      });

      csvStream.on('end', () => {
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
  }): Promise<DatasetRecord> {
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
      throw new BadRequestException({
        message: 'File Excel không được chấp nhận. Vui lòng xuất sang CSV.',
        error: 'VALIDATION_ERROR',
        details: { reason: 'excel_not_allowed', mimeType, fileName },
      } as never);
    }
    if (contentLength > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException({
        message: `File vuot qua gioi han 50MB (nhan duoc ${contentLength} bytes)`,
        error: 'FILE_TOO_LARGE',
      } as never);
    }

    const project = await this.projects.getProjectById(projectId);
    if (project.hasDataset) {
      throw new ConflictException(
        'Moi Project chi duoc phep lien ket toi da 1 Dataset hoat dong. Vui long xoa hoac luu tru Dataset hien tai truoc khi tai len du lieu moi.',
      );
    }

    if (contentLength > 0) {
      const quota = await this.storage.checkUploadQuota(contentLength);
      if (!quota.allowed) {
        throw new PayloadTooLargeException(
          'Dung luong luu tru vuot qua gioi han 10GB cua Cloudflare R2 (Hard Block 100%).',
        );
      }
      const wsQuota = Number(
        this.configService.get<number>('WORKSPACE_STORAGE_QUOTA_BYTES', 524288000),
      );
      await this.workspaces.checkWorkspaceUploadQuota(project.workspaceId, contentLength, wsQuota);
    }

    const datasetId = newHexId();
    const datasetName = datasetNameFromFile(fileName);
    const storageKey = storageKeyForDataset(datasetId);

    const initialDataset = await this.datasets.create({
      projectId: project.id,
      workspaceId: project.workspaceId,
      name: datasetName,
      originalFileName: fileName,
      fileFormat: 'csv',
      fileSizeBytes: contentLength,
      fileChecksum: 'calculating...',
      storageKey,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      columnIssues: [],
      hasHeader: true,
      delimiter: ',',
      status: 'INGESTING',
      currentVersion: 1,
    } as CreateDatasetRecord);

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
        const err = new PayloadTooLargeException({
          message: 'File vuot qua gioi han 50MB trong luc tai len',
          error: 'FILE_TOO_LARGE',
        } as never);
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
        throw new PayloadTooLargeException({
          message: 'File vuot qua gioi han 50MB',
          error: 'FILE_TOO_LARGE',
        } as never);
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

      const finalDataset = await this.datasets.updateById(datasetId, {
        fileChecksum,
        fileSizeBytes: bytesTransferred,
        rowCount: totalRows,
        columnCount: columns.length,
        columns,
        columnIssues: issues,
        status: 'READY',
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
        await this.datasets.updateById(datasetId, { status: 'FAILED' });
      } catch {
        /* best-effort */
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`That bai ingestion dataset ${datasetId}: ${msg}`);
      throw err;
    }
  }
}
