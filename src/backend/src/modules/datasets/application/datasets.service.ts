import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { PassThrough, Readable } from 'stream';
import * as fastCsv from 'fast-csv';
import * as crypto from 'crypto';
import {
  DATASET_REPOSITORY_PORT,
  type CreateDatasetRecord,
  type DatasetRecord,
  type DatasetRepositoryPort,
} from '../domain/ports/dataset.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { WorkspacesService } from '../../workspaces/application/workspaces.service';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PORT, type StoragePort } from '../../../shared/ports/storage.port';
import { OUTBOX_PORT, type OutboxPort } from '../../../shared/ports/outbox.port';
import { SchemaInferenceService } from './services/schema-inference.service';
import {
  IMPORT_BATCH_SIZE,
  MAX_COLUMNS,
  MAX_FILE_BYTES,
  SAMPLE_ROWS_CAP,
  assertCsvFile,
  datasetNameFromFile,
  storageKeyForDataset,
} from '../domain/value-objects/dataset-limits.vo';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';

/** Application inputs — controller map DTO http sang, khong import DTO http. */
export interface UpdateDatasetInput {
  name?: string;
}

export interface RenameColumnItemInput {
  key: string;
  name: string;
}

export interface RenameColumnsInput {
  columns: RenameColumnItemInput[];
}

function validationError(message: string, details?: unknown): BadRequestException {
  return new BadRequestException({
    message,
    error: 'VALIDATION_ERROR',
    details,
  } as never);
}

function unsupportedFileType(fileName: string): BadRequestException {
  return new BadRequestException({
    message: `Chi ho tro file .csv (nhan duoc: ${fileName})`,
    error: 'UNSUPPORTED_FILE_TYPE',
  } as never);
}

function newHexId(): string {
  return crypto.randomBytes(12).toString('hex');
}

/**
 * DATASETS — Application orchestrator.
 * Chi phu thuoc domain ports (DATASET / STORAGE / OUTBOX) + peer application
 * (Projects / Workspaces). Khong import infrastructure/schema/mongoose/DTO http.
 * Tra ve DatasetRecord (camelCase, id string).
 */
@Injectable()
export class DatasetsService {
  private readonly logger = new Logger(DatasetsService.name);

  constructor(
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasets: DatasetRepositoryPort,
    private readonly projectsService: ProjectsService,
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
    @Inject(OUTBOX_PORT)
    private readonly outbox: OutboxPort,
    private readonly schemaInferenceService: SchemaInferenceService,
    private readonly workspacesService: WorkspacesService,
    private readonly configService: ConfigService,
  ) {}

  async ingestDatasetStream(params: {
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
    if (contentLength > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException({
        message: `File vuot qua gioi han 50MB (nhan duoc ${contentLength} bytes)`,
        error: 'FILE_TOO_LARGE',
      } as never);
    }

    const project = await this.projectsService.getProjectById(projectId);
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
      const wsQuota = Number(this.configService.get<number>('WORKSPACE_STORAGE_QUOTA_BYTES', 2147483648));
      await this.workspacesService.checkWorkspaceUploadQuota(
        project.workspaceId,
        contentLength,
        wsQuota,
      );
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

    const hashStream = crypto.createHash('sha256');
    const uploadPassThrough = new PassThrough();
    const parsePassThrough = new PassThrough();

    let bytesTransferred = 0;
    let uploadFailed = false;

    fileStream.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
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
      hashStream.update(chunk);
      uploadPassThrough.write(chunk);
      parsePassThrough.write(chunk);
    });

    fileStream.on('end', () => {
      uploadPassThrough.end();
      parsePassThrough.end();
    });

    fileStream.on('error', (err: unknown) => {
      const e = err instanceof Error ? err : new Error(String(err));
      uploadPassThrough.destroy(e);
      parsePassThrough.destroy(e);
    });

    const cleanupOnFailure = async () => {
      try {
        await this.storage.deleteFile(storageKey);
      } catch { /* best-effort */ }
      try {
        await this.datasets.softDeleteDatasetWithRecords(datasetId);
      } catch { /* best-effort */ }
    };

    try {
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

      const { columns, issues } = this.schemaInferenceService.inferSchemaWithIssues(headers, sampleRows);

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

      await this.projectsService.setHasDataset(projectId, true);
      await this.workspacesService.incrementStorageUsed(
        project.workspaceId,
        bytesTransferred,
      );

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
      } catch { /* best-effort */ }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`That bai ingestion dataset ${datasetId}: ${msg}`);
      throw err;
    }
  }

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
      let currentBatch: { datasetId: string; rowIndex: number; props: Record<string, unknown> }[] = [];

      const csvStream = fastCsv.parse({ headers: true, trim: false });

      const flushBatch = async () => {
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
            .catch((err) => csvStream.destroy(err));
        }
      });

      csvStream.on('end', () => {
        flushBatch().then(() => resolve({ totalRows, headers, sampleRows })).catch((err) => reject(err));
      });

      csvStream.on('error', (err) => reject(err));

      stream.pipe(csvStream);
    });
  }

  async getDatasetById(id: string): Promise<DatasetRecord> {
    if (!isObjectIdHex(id)) {
      throw new BadRequestException('ID Tap du lieu khong hop le');
    }
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    return dataset;
  }

  async getDatasetByProjectId(projectId: string): Promise<DatasetRecord | null> {
    if (!isObjectIdHex(projectId)) {
      throw new BadRequestException('ID Du an khong hop le');
    }
    return this.datasets.findByProject(projectId);
  }

  async getDatasetSchema(id: string): Promise<DatasetRecord['columns']> {
    const dataset = await this.getDatasetById(id);
    return dataset.columns;
  }

  async updateDataset(id: string, dto: UpdateDatasetInput): Promise<DatasetRecord> {
    await this.getDatasetById(id);
    const updated = await this.datasets.updateById(id, { name: dto.name } as Partial<CreateDatasetRecord>);
    if (!updated) {
      throw new NotFoundException('Khong tim thay tap du lieu de cap nhat');
    }
    return updated;
  }

  async renameColumns(id: string, dto: RenameColumnsInput): Promise<DatasetRecord> {
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    const byKey = new Map(dataset.columns.map((c) => [c.key, c]));
    for (const r of dto.columns) {
      const col = byKey.get(r.key);
      if (!col) {
        throw validationError(`Cot khong ton tai: ${r.key}`, { reason: 'unknown_column_key', key: r.key });
      }
      col.name = r.name;
    }
    const names = dataset.columns.map((c) => c.name);
    const issues = this.schemaInferenceService.detectColumnIssues(names).map((iss) => {
      if (!iss.columnKey) return iss;
      const idx = Number(String(iss.columnKey).replace('c', ''));
      const realKey = dataset.columns[idx]?.key ?? iss.columnKey;
      return { ...iss, columnKey: realKey };
    });
    const updated = await this.datasets.updateById(id, {
      columns: dataset.columns,
      columnIssues: issues,
    } as Partial<CreateDatasetRecord>);
    if (!updated) throw new NotFoundException('Khong tim thay tap du lieu de cap nhat');
    return updated;
  }

  async resetColumnNames(id: string): Promise<DatasetRecord> {
    const dataset = await this.datasets.findById(id);
    if (!dataset) {
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    for (const c of dataset.columns) {
      c.name = c.originalName;
    }
    const updated = await this.datasets.updateById(id, {
      columns: dataset.columns,
      columnIssues: [],
    } as Partial<CreateDatasetRecord>);
    if (!updated) throw new NotFoundException('Khong tim thay tap du lieu de cap nhat');
    return updated;
  }

  mapPropsToOriginalNames(
    columns: { key: string; originalName: string }[],
    props: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      out[c.originalName] = props[c.key] ?? null;
    }
    return out;
  }

  async deleteDataset(id: string): Promise<boolean> {
    const raw = await this.datasets.findById(id);
    if (!raw) {
      throw new NotFoundException('Khong tim thay tap du lieu hoac tap du lieu da bi xoa');
    }
    const deleted = await this.datasets.softDeleteDatasetWithRecords(id);

    await this.projectsService.setHasDataset(raw.projectId, false);
    await this.workspacesService.incrementStorageUsed(
      raw.workspaceId,
      -(raw.fileSizeBytes ?? 0),
    );

    this.logger.log(`Da xoa mem Dataset ID: ${id}`);
    return deleted;
  }
}
