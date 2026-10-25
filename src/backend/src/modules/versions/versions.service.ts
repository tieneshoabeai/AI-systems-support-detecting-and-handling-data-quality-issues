import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PassThrough, Readable } from 'stream';
import * as fastCsv from 'fast-csv';
import * as crypto from 'crypto';
import { VersionsRepository } from './versions.repository';
import { DatasetsRepository } from '../datasets/datasets.repository';
import { DatasetsService } from '../datasets/datasets.service';
import { StorageService } from '../../shared/storage/storage.service';
import { OutboxService } from '../../shared/application/outbox/outbox.service';
import { IDatasetVersion } from './schemas/dataset-version.schema';
import { IDatasetRecord } from '../datasets/schemas/dataset-record.schema';
import {
  CommitVersionDto,
  ListVersionsQueryDto,
  VersionDetailDto,
  VersionDiffResult,
} from './dto/version.dto';

@Injectable()
export class VersionsService {
  private readonly logger = new Logger(VersionsService.name);

  constructor(
    private readonly versionsRepository: VersionsRepository,
    private readonly datasetsRepository: DatasetsRepository,
    private readonly datasetsService: DatasetsService,
    @InjectModel('DatasetRecord')
    private readonly recordModel: Model<IDatasetRecord>,
    private readonly storageService: StorageService,
    private readonly outboxService: OutboxService
  ) {}

  /**
   * F7.1: Commit phiên bản mới với Merkle root hash và snapshot CSV upload Cloudflare R2
   */
  async commitVersion(
    datasetId: string,
    userId: string,
    dto: CommitVersionDto
  ): Promise<VersionDetailDto> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    const dataset = await this.datasetsService.getDatasetById(datasetId);
    if (!dataset) {
      throw new NotFoundException('Không tìm thấy tập dữ liệu hoặc tập dữ liệu đã bị xóa');
    }

    // 1. Xác định phiên bản cha và số thứ tự phiên bản kế tiếp
    const latestVersion = await this.versionsRepository.findLatestByDatasetId(datasetId);
    const nextVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1;
    const parentHash = latestVersion ? latestVersion.version_hash : '0'.repeat(64);
    const parentVersionId = latestVersion ? latestVersion._id : null;

    // 2. Tính toán rules_hash (SHA256 của danh sách sorted rule IDs hoặc chuỗi rỗng 64 số 0)
    const ruleIds = dto.rule_ids && dto.rule_ids.length > 0 ? [...dto.rule_ids].sort() : [];
    const rulesHash =
      ruleIds.length > 0
        ? crypto.createHash('sha256').update(JSON.stringify(ruleIds)).digest('hex')
        : '0'.repeat(64);

    // 3. Thiết lập luồng streaming trích xuất toàn bộ records và upload CSV snapshot lên R2
    const snapshotStorageKey = `snapshots/${datasetId}_v${nextVersionNumber}.csv`;
    const cursor = this.recordModel
      .find({
        dataset_id: new Types.ObjectId(datasetId),
        deleted_at: null,
      })
      .sort({ row_index: 1 })
      .cursor();

    const headers =
      dataset.columns && dataset.columns.length > 0
        ? dataset.columns.map((c) => c.name)
        : true;

    const csvStream = fastCsv.format({ headers });
    const uploadPassThrough = new PassThrough();
    const hashStream = crypto.createHash('sha256');

    csvStream.on('data', (chunk: Buffer) => {
      hashStream.update(chunk);
    });

    csvStream.on('error', (err: unknown) => {
      const errorInstance = err instanceof Error ? err : new Error(String(err));
      uploadPassThrough.destroy(errorInstance);
    });

    csvStream.pipe(uploadPassThrough);

    const uploadPromise = this.storageService.uploadStream(
      snapshotStorageKey,
      uploadPassThrough,
      'text/csv'
    );

    let recordCount = 0;
    for await (const doc of cursor) {
      recordCount++;
      const shouldContinue = csvStream.write(doc.data ?? {});
      if (!shouldContinue) {
        await new Promise<void>((resolve) => {
          csvStream.once('drain', () => resolve());
        });
      }
    }
    csvStream.end();

    await uploadPromise;
    const dataChecksum = hashStream.digest('hex');

    // 4. Tính toán Merkle root hash: version_hash = SHA256(data_checksum + parent_hash + rules_hash)
    const versionHash = crypto
      .createHash('sha256')
      .update(`${dataChecksum}${parentHash}${rulesHash}`)
      .digest('hex');

    // 5. Lưu trữ metadata phiên bản vào dataset_versions
    const versionDoc = await this.versionsRepository.create({
      dataset_id: new Types.ObjectId(datasetId),
      version_number: nextVersionNumber,
      parent_hash: parentHash,
      parent_version_id: parentVersionId,
      rules_hash: rulesHash,
      data_checksum: dataChecksum,
      version_hash: versionHash,
      snapshot_storage_key: snapshotStorageKey,
      record_count: recordCount,
      change_summary: {
        description: dto.description,
        rule_ids: ruleIds,
      },
      created_by: new Types.ObjectId(userId),
    } as Partial<IDatasetVersion>);

    // 6. Cập nhật current_version và metadata cho dataset
    await this.datasetsRepository.updateById(datasetId, {
      $set: {
        current_version: nextVersionNumber,
        row_count: recordCount,
        file_checksum: dataChecksum,
      },
    });

    // 7. Ghi sự kiện VERSION_COMMITTED vào Outbox Pattern
    await this.outboxService.recordEvent({
      aggregate_type: 'DATASET_VERSION',
      aggregate_id: versionDoc._id.toHexString(),
      event_type: 'VERSION_COMMITTED',
      payload: {
        dataset_id: datasetId,
        version_number: nextVersionNumber,
        version_hash: versionHash,
        parent_hash: parentHash,
        record_count: recordCount,
        snapshot_storage_key: snapshotStorageKey,
        created_by: userId,
      },
    });

    this.logger.log(
      `Đã commit thành công phiên bản v${nextVersionNumber} cho Dataset ${datasetId} (Merkle Root: ${versionHash})`
    );

    return this.mapToDetailDto(versionDoc);
  }

  /**
   * F7.2: Lấy danh sách lịch sử các phiên bản có phân trang
   */
  async getVersions(
    datasetId: string,
    query: ListVersionsQueryDto
  ): Promise<{ items: VersionDetailDto[]; total: number }> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    await this.datasetsService.getDatasetById(datasetId);

    const limit = query.limit ?? 20;
    const skip = query.skip ?? 0;

    const { items, total } = await this.versionsRepository.findByDatasetId(
      datasetId,
      limit,
      skip
    );

    return {
      items: items.map((item) => this.mapToDetailDto(item)),
      total,
    };
  }

  /**
   * F7.3: Xem thông tin chi tiết của một phiên bản cụ thể
   */
  async getVersionByNumber(
    datasetId: string,
    versionNumber: number
  ): Promise<VersionDetailDto> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    await this.datasetsService.getDatasetById(datasetId);

    const version = await this.versionsRepository.findByDatasetAndVersion(
      datasetId,
      versionNumber
    );

    if (!version) {
      throw new NotFoundException(
        `Không tìm thấy phiên bản ${versionNumber} của tập dữ liệu`
      );
    }

    return this.mapToDetailDto(version);
  }

  /**
   * F7.4: So sánh sai khác cấu trúc và dữ liệu giữa 2 phiên bản
   */
  async diffVersions(
    datasetId: string,
    v1: number,
    v2: number
  ): Promise<VersionDiffResult> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    await this.datasetsService.getDatasetById(datasetId);

    const [v1Doc, v2Doc] = await Promise.all([
      this.versionsRepository.findByDatasetAndVersion(datasetId, v1),
      this.versionsRepository.findByDatasetAndVersion(datasetId, v2),
    ]);

    if (!v1Doc) {
      throw new NotFoundException(
        `Không tìm thấy phiên bản ${v1} của tập dữ liệu để so sánh`
      );
    }
    if (!v2Doc) {
      throw new NotFoundException(
        `Không tìm thấy phiên bản ${v2} của tập dữ liệu để so sánh`
      );
    }

    const rules1 = v1Doc.change_summary?.rule_ids ?? [];
    const rules2 = v2Doc.change_summary?.rule_ids ?? [];

    const rulesAdded = rules2.filter((r) => !rules1.includes(r));
    const rulesRemoved = rules1.filter((r) => !rules2.includes(r));

    return {
      dataset_id: datasetId,
      v1: {
        version_number: v1Doc.version_number,
        version_hash: v1Doc.version_hash,
        record_count: v1Doc.record_count,
        data_checksum: v1Doc.data_checksum,
        rules_applied: rules1,
      },
      v2: {
        version_number: v2Doc.version_number,
        version_hash: v2Doc.version_hash,
        record_count: v2Doc.record_count,
        data_checksum: v2Doc.data_checksum,
        rules_applied: rules2,
      },
      record_count_diff: v2Doc.record_count - v1Doc.record_count,
      is_data_identical: v1Doc.data_checksum === v2Doc.data_checksum,
      rules_added: rulesAdded,
      rules_removed: rulesRemoved,
    };
  }

  /**
   * F7.5: Khôi phục tại chỗ (In-place Rollback) về phiên bản trước đó
   */
  async rollbackVersion(
    datasetId: string,
    versionNumber: number,
    userId: string
  ): Promise<{ message: string; version: VersionDetailDto }> {
    if (!Types.ObjectId.isValid(datasetId)) {
      throw new BadRequestException('ID Tập dữ liệu không hợp lệ');
    }

    await this.datasetsService.getDatasetById(datasetId);

    const targetVersion = await this.versionsRepository.findByDatasetAndVersion(
      datasetId,
      versionNumber
    );

    if (!targetVersion) {
      throw new NotFoundException(
        `Không tìm thấy phiên bản ${versionNumber} của tập dữ liệu để khôi phục`
      );
    }

    // 1. Tải snapshot CSV stream từ Cloudflare R2 / Storage
    let fileStream: Readable;
    try {
      fileStream = await this.storageService.downloadStream(
        targetVersion.snapshot_storage_key
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        `Không thể tải bản sao lưu (snapshot) từ Cloudflare R2: ${msg}`
      );
    }

    // 2. Dọn sạch bản ghi hiện tại và nạp lại từ snapshot theo chunk 1.000 dòng
    await this.recordModel.deleteMany({
      dataset_id: new Types.ObjectId(datasetId),
    });

    let totalRows = 0;
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

    await new Promise<void>((resolve, reject) => {
      csvStream.on('data', (row: Record<string, unknown>) => {
        const rowIndex = totalRows;
        totalRows++;

        currentBatch.push({
          dataset_id: new Types.ObjectId(datasetId),
          row_index: rowIndex,
          data: row,
          version_number: targetVersion.version_number,
        });

        if (currentBatch.length >= 1000) {
          csvStream.pause();
          flushBatch()
            .then(() => csvStream.resume())
            .catch((err: unknown) => {
              csvStream.destroy(
                err instanceof Error ? err : new Error(String(err))
              );
            });
        }
      });

      csvStream.on('end', async () => {
        try {
          await flushBatch();
          resolve();
        } catch (err: unknown) {
          reject(err);
        }
      });

      csvStream.on('error', (err: unknown) => reject(err));

      fileStream.pipe(csvStream);
    });

    // 3. Cập nhật current_version và thông tin dòng của Dataset
    await this.datasetsRepository.updateById(datasetId, {
      $set: {
        current_version: targetVersion.version_number,
        row_count: targetVersion.record_count,
        file_checksum: targetVersion.data_checksum,
      },
    });

    // 4. Ghi Outbox Event VERSION_ROLLED_BACK
    await this.outboxService.recordEvent({
      aggregate_type: 'DATASET',
      aggregate_id: datasetId,
      event_type: 'VERSION_ROLLED_BACK',
      payload: {
        dataset_id: datasetId,
        rolled_back_to_version: versionNumber,
        version_hash: targetVersion.version_hash,
        record_count: targetVersion.record_count,
        restored_by: userId,
      },
    });

    this.logger.log(
      `Đã hoàn tất khôi phục In-place Rollback về phiên bản v${versionNumber} cho Dataset ${datasetId}`
    );

    return {
      message: `Khôi phục thành công về phiên bản v${versionNumber}`,
      version: this.mapToDetailDto(targetVersion),
    };
  }

  /**
   * Helper chuyển đổi IDatasetVersion sang VersionDetailDto
   */
  private mapToDetailDto(version: IDatasetVersion): VersionDetailDto {
    return {
      id: version._id.toHexString(),
      dataset_id: version.dataset_id.toHexString(),
      version_number: version.version_number,
      parent_hash: version.parent_hash,
      parent_version_id: version.parent_version_id
        ? version.parent_version_id.toHexString()
        : null,
      rules_hash: version.rules_hash,
      data_checksum: version.data_checksum,
      version_hash: version.version_hash,
      snapshot_storage_key: version.snapshot_storage_key,
      record_count: version.record_count,
      change_summary: {
        description: version.change_summary.description,
        rule_ids: version.change_summary.rule_ids || [],
      },
      created_by: version.created_by.toHexString(),
      created_at: version.created_at,
    };
  }
}
