import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PassThrough, Readable } from 'stream';
import * as fastCsv from 'fast-csv';
import * as crypto from 'crypto';
import { DatasetsRepository } from './datasets.repository';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../../shared/storage/storage.service';
import { OutboxService } from '../../shared/application/outbox/outbox.service';
import { SchemaInferenceService } from './services/schema-inference.service';
import { IDataset, IColumnDefinition } from './schemas/dataset.schema';
import { UpdateDatasetDto } from './dto/update-dataset.dto';

@Injectable()
export class DatasetsService {
  private readonly logger = new Logger(DatasetsService.name);

  constructor(
    private readonly datasetsRepository: DatasetsRepository,
    private readonly projectsService: ProjectsService,
    private readonly storageService: StorageService,
    private readonly outboxService: OutboxService,
    private readonly schemaInferenceService: SchemaInferenceService
  ) {}

  /**
   * Xử lý tải lên dữ liệu dạng luồng (Streaming Ingestion với T-pipe song song)
   */
  async ingestDatasetStream(params: {
    projectId: string;
    fileStream: Readable;
    fileName: string;
    mimeType: string;
    contentLength?: number;
  }): Promise<IDataset> {
    const { projectId, fileStream, fileName, mimeType, contentLength = 0 } = params;

    // 1. Ràng buộc cứng: Kiểm tra 1 Project = 1 Dataset
    const project = await this.projectsService.getProjectById(projectId);
    if (project.has_dataset) {
      throw new ConflictException(
        'Mỗi Project chỉ được phép liên kết tối đa 1 Dataset hoạt động. Vui lòng xóa hoặc lưu trữ Dataset hiện tại trước khi tải lên dữ liệu mới.'
      );
    }

    // 2. R2 Quota Guard: Kiểm tra hạn mức dung lượng Cloud 10GB
    if (contentLength > 0) {
      const quota = await this.storageService.checkUploadQuota(contentLength);
      if (!quota.allowed) {
        throw new PayloadTooLargeException(
          'Dung lượng lưu trữ vượt quá giới hạn 10GB của Cloudflare R2 (Hard Block 100%).'
        );
      }
    }

    const datasetId = new Types.ObjectId();
    const datasetName = fileName.replace(/\.[^/.]+$/, '');
    const format = fileName.endsWith('.xlsx') ? 'xlsx' : fileName.endsWith('.json') ? 'json' : 'csv';

    // 3. Khởi tạo Dataset document với trạng thái INGESTING
    const initialDataset = await this.datasetsRepository.create({
      _id: datasetId,
      project_id: project._id,
      workspace_id: project.workspace_id,
      name: datasetName,
      original_file_name: fileName,
      file_format: format,
      file_size_bytes: contentLength,
      file_checksum: 'calculating...',
      storage_key: `raw_files/${datasetId.toHexString()}_temp.csv`,
      row_count: 0,
      column_count: 0,
      columns: [],
      current_version: 1,
      status: 'INGESTING',
    } as Partial<IDataset>);

    // 4. Thiết lập luồng T-Pipe đa nhánh song song
    const hashStream = crypto.createHash('sha256');
    const uploadPassThrough = new PassThrough();
    const parsePassThrough = new PassThrough();

    let bytesTransferred = 0;

    fileStream.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
      hashStream.update(chunk);
      uploadPassThrough.write(chunk);
      parsePassThrough.write(chunk);
    });

    fileStream.on('end', () => {
      uploadPassThrough.end();
      parsePassThrough.end();
    });

    fileStream.on('error', (err: unknown) => {
      uploadPassThrough.destroy(err instanceof Error ? err : new Error(String(err)));
      parsePassThrough.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    try {
      // 5. Chạy song song: Upload S3/R2 và Phân tích Parsing CSV
      const uploadPromise = this.storageService.uploadStream(
        `raw_files/${datasetId.toHexString()}.csv`,
        uploadPassThrough,
        mimeType
      );

      const parsePromise = this.processCsvStream(datasetId, parsePassThrough);

      const [storageKey, { totalRows, headers, sampleRows }] = await Promise.all([
        uploadPromise,
        parsePromise,
      ]);

      const fileChecksum = hashStream.digest('hex');

      // 6. Suy luận Schema Tầng 0
      const columns: IColumnDefinition[] = this.schemaInferenceService.inferSchema(
        headers,
        sampleRows
      );

      // 7. Cập nhật Dataset metadata hoàn tất
      const finalDataset = await this.datasetsRepository.updateById(datasetId, {
        $set: {
          file_checksum: fileChecksum,
          storage_key: storageKey,
          file_size_bytes: bytesTransferred,
          row_count: totalRows,
          column_count: columns.length,
          columns,
          status: 'READY',
        },
      });

      // 8. Đánh dấu Project đã có Dataset
      await this.projectsService.setHasDataset(projectId, true);

      // 9. Ghi Outbox Event đồng bộ đồ thị sang Neo4j AuraDB
      await this.outboxService.recordEvent({
        aggregate_type: 'DATASET',
        aggregate_id: datasetId.toHexString(),
        event_type: 'DATASET_INGESTED',
        payload: {
          dataset_id: datasetId.toHexString(),
          project_id: projectId,
          workspace_id: project.workspace_id.toString(),
          row_count: totalRows,
          column_count: columns.length,
          file_checksum: fileChecksum,
          storage_key: storageKey,
        },
      });

      this.logger.log(
        `Hoàn tất Streaming Ingestion Dataset: ${datasetName} (ID: ${datasetId.toHexString()}) - ${totalRows} dòng - Checksum: ${fileChecksum}`
      );

      return finalDataset ?? initialDataset;
    } catch (err: unknown) {
      await this.datasetsRepository.updateById(datasetId, {
        $set: { status: 'FAILED' },
      });
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Thất bại trong quá trình Ingestion Dataset ${datasetId.toHexString()}: ${msg}`);
      throw err;
    }
  }

  /**
   * Xử lý phân tích luồng CSV, suy luận 500 dòng đầu và bulkWrite 1.000 dòng/lô
   */
  private async processCsvStream(
    datasetId: Types.ObjectId,
    stream: Readable
  ): Promise<{
    totalRows: number;
    headers: string[];
    sampleRows: Record<string, unknown>[];
  }> {
    return new Promise((resolve, reject) => {
      let totalRows = 0;
      let headers: string[] = [];
      const sampleRows: Record<string, unknown>[] = [];
      let currentBatch: {
        dataset_id: Types.ObjectId;
        row_index: number;
        data: Record<string, unknown>;
        version_number: number;
      }[] = [];

      const csvStream = fastCsv.parse({ headers: true, trim: true });

      const flushBatch = async () => {
        if (currentBatch.length > 0) {
          const batchToInsert = currentBatch;
          currentBatch = [];
          await this.datasetsRepository.bulkInsertRecords(batchToInsert);
        }
      };

      csvStream.on('headers', (parsedHeaders: string[]) => {
        headers = parsedHeaders;
      });

      csvStream.on('data', (row: Record<string, unknown>) => {
        const rowIndex = totalRows;
        totalRows++;

        if (sampleRows.length < 500) {
          sampleRows.push(row);
        }

        currentBatch.push({
          dataset_id: datasetId,
          row_index: rowIndex,
          data: row,
          version_number: 1,
        });

        // Gom batch 1.000 records
        if (currentBatch.length >= 1000) {
          csvStream.pause();
          flushBatch()
            .then(() => csvStream.resume())
            .catch((err) => csvStream.destroy(err));
        }
      });

      csvStream.on('end', async () => {
        try {
          await flushBatch();
          resolve({ totalRows, headers, sampleRows });
        } catch (err) {
          reject(err);
        }
      });

      csvStream.on('error', (err) => reject(err));

      stream.pipe(csvStream);
    });
  }

  async getDatasetById(id: string): Promise<IDataset> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }
    const dataset = await this.datasetsRepository.findById(id);
    if (!dataset) {
      throw new NotFoundException('Không tìm thấy tập dữ liệu hoặc tập dữ liệu đã bị xóa');
    }
    return dataset;
  }

  async getDatasetByProjectId(projectId: string): Promise<IDataset | null> {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new BadRequestException('ID Dự án không hợp lệ');
    }
    return this.datasetsRepository.findByProject(projectId);
  }

  async getDatasetSchema(id: string): Promise<IColumnDefinition[]> {
    const dataset = await this.getDatasetById(id);
    return dataset.columns;
  }

  async updateDataset(id: string, dto: UpdateDatasetDto): Promise<IDataset> {
    await this.getDatasetById(id);
    const updated = await this.datasetsRepository.updateById(id, { $set: dto });
    if (!updated) {
      throw new NotFoundException('Không tìm thấy tập dữ liệu để cập nhật');
    }
    return updated;
  }

  async deleteDataset(id: string): Promise<boolean> {
    const dataset = await this.getDatasetById(id);
    const deleted = await this.datasetsRepository.softDeleteDatasetWithRecords(id);

    // Giải phóng cờ has_dataset trên Project để cho phép nạp dữ liệu mới
    await this.projectsService.setHasDataset(dataset.project_id.toString(), false);

    this.logger.log(`Đã xóa mềm Dataset ID: ${id} và giải phóng cờ Project ${dataset.project_id.toString()}`);
    return deleted;
  }
}
