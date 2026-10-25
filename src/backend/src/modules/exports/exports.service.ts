import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from 'express';
import { PassThrough } from 'stream';
import * as fastCsv from 'fast-csv';
import * as crypto from 'crypto';
import { ExportsRepository } from './exports.repository';
import { DatasetsService } from '../datasets/datasets.service';
import { StorageService } from '../../shared/storage/storage.service';
import { OutboxService } from '../../shared/application/outbox/outbox.service';
import { IDatasetRecord } from '../datasets/schemas/dataset-record.schema';
import { IExportTask } from './schemas/export-task.schema';
import {
  SecureExportDto,
  ExportTaskDetailDto,
} from './dto/export.dto';
import { createAes256GcmEncryptStream } from '../../shared/crypto/crypto.util';

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);

  constructor(
    private readonly exportsRepository: ExportsRepository,
    private readonly datasetsService: DatasetsService,
    @InjectModel('DatasetRecord')
    private readonly recordModel: Model<IDatasetRecord>,
    private readonly storageService: StorageService,
    private readonly outboxService: OutboxService
  ) {}

  /**
   * F9.1: Xuất dữ liệu CSV sạch dạng luồng trực tiếp sang HTTP Response (RAM <= 20MB)
   */
  async exportCsvStream(
    datasetId: string,
    userId: string,
    version: number | undefined,
    res: Response
  ): Promise<void> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    const dataset = await this.datasetsService.getDatasetById(datasetId);
    if (!dataset) {
      throw new NotFoundException('Không tìm thấy tập dữ liệu hoặc tập dữ liệu đã bị xóa');
    }

    const sanitizedName = dataset.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileName = `${sanitizedName}${version ? `_v${version}` : ''}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );

    const headers =
      dataset.columns && dataset.columns.length > 0
        ? dataset.columns.map((c) => c.name)
        : true;

    const csvStream = fastCsv.format({ headers });
    csvStream.pipe(res);

    const finishPromise = new Promise<void>((resolve, reject) => {
      const resp = res as unknown as { writableEnded?: boolean; finished?: boolean };
      if (resp.writableEnded || resp.finished) {
        return resolve();
      }
      res.once('finish', () => resolve());
      res.once('close', () => resolve());
      res.once('error', (err: unknown) => reject(err));
    });

    const cursor = this.recordModel
      .find({
        dataset_id: new Types.ObjectId(datasetId),
        deleted_at: null,
      })
      .sort({ row_index: 1 })
      .cursor();

    let recordCount = 0;
    for await (const doc of cursor) {
      recordCount++;
      const ok = csvStream.write(doc.data ?? {});
      if (!ok) {
        await new Promise<void>((resolve) => {
          csvStream.once('drain', () => resolve());
        });
      }
    }
    csvStream.end();

    await finishPromise;

    // Ghi nhận nhật ký xuất dữ liệu
    const exportId = new Types.ObjectId();
    await this.exportsRepository.create({
      _id: exportId,
      dataset_id: new Types.ObjectId(datasetId),
      workspace_id: dataset.workspace_id,
      export_type: 'csv',
      file_name: fileName,
      storage_key: 'direct_stream',
      file_size_bytes: 0,
      record_count: recordCount,
      checksum_sha256: 'streamed_on_the_fly',
      is_encrypted: false,
      created_by: new Types.ObjectId(userId),
    } as Partial<IExportTask>);

    this.logger.log(
      `Đã hoàn tất xuất stream CSV cho Dataset ${datasetId} (${recordCount} bản ghi)`
    );
  }

  /**
   * F9.2: Xuất dữ liệu mã hóa luồng AES-256-GCM bảo vệ bằng mật khẩu, lưu R2 và stream tải về
   */
  async exportSecureStream(
    datasetId: string,
    userId: string,
    dto: SecureExportDto,
    res: Response
  ): Promise<void> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    const dataset = await this.datasetsService.getDatasetById(datasetId);
    if (!dataset) {
      throw new NotFoundException('Không tìm thấy tập dữ liệu hoặc tập dữ liệu đã bị xóa');
    }

    const exportId = new Types.ObjectId();
    const sanitizedName = dataset.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileName = `${sanitizedName}${dto.version ? `_v${dto.version}` : ''}.enc.csv`;
    const storageKey = `exports/${exportId.toHexString()}.enc.csv`;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`
    );
    res.setHeader('X-Export-Id', exportId.toHexString());

    const headers =
      dataset.columns && dataset.columns.length > 0
        ? dataset.columns.map((c) => c.name)
        : true;

    const csvStream = fastCsv.format({ headers });
    const encryptStream = createAes256GcmEncryptStream(dto.password);

    const uploadPassThrough = new PassThrough();
    const clientPassThrough = new PassThrough();
    const hashStream = crypto.createHash('sha256');

    let encryptedBytes = 0;

    encryptStream.on('data', (chunk: Buffer) => {
      encryptedBytes += chunk.length;
      hashStream.update(chunk);
      uploadPassThrough.write(chunk);
      clientPassThrough.write(chunk);
    });

    encryptStream.on('end', () => {
      uploadPassThrough.end();
      clientPassThrough.end();
    });

    encryptStream.on('error', (err: unknown) => {
      const errorInstance = err instanceof Error ? err : new Error(String(err));
      uploadPassThrough.destroy(errorInstance);
      clientPassThrough.destroy(errorInstance);
    });

    clientPassThrough.pipe(res);
    csvStream.pipe(encryptStream);

    // Upload bản sao mã hóa lên Cloudflare R2
    const uploadPromise = this.storageService.uploadStream(
      storageKey,
      uploadPassThrough,
      'application/octet-stream'
    );

    const finishPromise = new Promise<void>((resolve, reject) => {
      const resp = res as unknown as { writableEnded?: boolean; finished?: boolean };
      if (resp.writableEnded || resp.finished) {
        return resolve();
      }
      res.once('finish', () => resolve());
      res.once('close', () => resolve());
      res.once('error', (err: unknown) => reject(err));
    });

    const cursor = this.recordModel
      .find({
        dataset_id: new Types.ObjectId(datasetId),
        deleted_at: null,
      })
      .sort({ row_index: 1 })
      .cursor();

    let recordCount = 0;
    for await (const doc of cursor) {
      recordCount++;
      const ok = csvStream.write(doc.data ?? {});
      if (!ok) {
        await new Promise<void>((resolve) => {
          csvStream.once('drain', () => resolve());
        });
      }
    }
    csvStream.end();

    await Promise.all([uploadPromise, finishPromise]);

    const checksum = hashStream.digest('hex');

    // Lưu trữ metadata tác vụ xuất dữ liệu vào CSDL
    await this.exportsRepository.create({
      _id: exportId,
      dataset_id: new Types.ObjectId(datasetId),
      workspace_id: dataset.workspace_id,
      export_type: 'aes256_gcm',
      file_name: fileName,
      storage_key: storageKey,
      file_size_bytes: encryptedBytes,
      record_count: recordCount,
      checksum_sha256: checksum,
      is_encrypted: true,
      created_by: new Types.ObjectId(userId),
    } as Partial<IExportTask>);

    // Ghi sự kiện DATASET_EXPORTED vào Outbox Pattern
    await this.outboxService.recordEvent({
      aggregate_type: 'DATASET',
      aggregate_id: datasetId,
      event_type: 'DATASET_EXPORTED',
      payload: {
        export_id: exportId.toHexString(),
        dataset_id: datasetId,
        file_name: fileName,
        storage_key: storageKey,
        record_count: recordCount,
        file_size_bytes: encryptedBytes,
        checksum_sha256: checksum,
        is_encrypted: true,
        exported_by: userId,
      },
    });

    this.logger.log(
      `Đã hoàn tất xuất mã hóa AES-256-GCM Dataset ${datasetId} (Tệp: ${fileName}, SHA-256: ${checksum})`
    );
  }

  /**
   * Lấy lịch sử các tác vụ xuất dữ liệu của tập dữ liệu
   */
  async getExportHistory(datasetId: string): Promise<{ items: ExportTaskDetailDto[] }> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    await this.datasetsService.getDatasetById(datasetId);

    const tasks = await this.exportsRepository.findByDatasetId(datasetId);

    return {
      items: tasks.map((t) => ({
        id: t._id.toHexString(),
        dataset_id: t.dataset_id.toHexString(),
        workspace_id: t.workspace_id.toHexString(),
        export_type: t.export_type,
        file_name: t.file_name,
        storage_key: t.storage_key,
        file_size_bytes: t.file_size_bytes,
        record_count: t.record_count,
        checksum_sha256: t.checksum_sha256,
        is_encrypted: t.is_encrypted,
        created_by: t.created_by.toHexString(),
        created_at: t.created_at,
      })),
    };
  }
}
