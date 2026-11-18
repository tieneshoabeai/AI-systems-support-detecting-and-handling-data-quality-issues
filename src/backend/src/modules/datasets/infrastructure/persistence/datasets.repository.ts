import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IDataset } from './dataset.schema';
import { IDatasetRecord } from './dataset-record.schema';
import {
  type CreateDatasetInput,
  type DatasetRepositoryPort,
  type RecordInsertDoc,
} from '../../domain/ports/dataset.repository.port';
import type { Dataset } from '../../domain/entities/dataset.entity';
import {
  toDatasetEntity,
  toDatasetPersistence,
  toDatasetUpdate,
} from './dataset.mapper';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';

/**
 * DATASETS — Infrastructure adapter (driven).
 * Noi duy nhat cham Mongoose. Trien khai DATASET_REPOSITORY_PORT.
 * Tra ve entity `Dataset`, khong lo Document.
 * Wave 4 (S19/A13): dataset_record INSERT-only.
 */
@Injectable()
export class DatasetsRepository implements DatasetRepositoryPort {
  constructor(
    @InjectModel('Dataset') private readonly datasetModel: Model<IDataset>,
    @InjectModel('DatasetRecord') private readonly recordModel: Model<IDatasetRecord>,
  ) {}

  async create(data: CreateDatasetInput): Promise<Dataset> {
    const inst = new this.datasetModel(toDatasetPersistence(data));
    const saved = await inst.save();
    return toDatasetEntity(saved);
  }

  async findById(id: string): Promise<Dataset | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.datasetModel
      .findOne({ _id: new Types.ObjectId(id), deleted_at: null })
      .exec();
    return doc ? toDatasetEntity(doc) : null;
  }

  async findByProject(projectId: string): Promise<Dataset | null> {
    if (!isObjectIdHex(projectId)) return null;
    const doc = await this.datasetModel
      .findOne({ project_id: new Types.ObjectId(projectId), deleted_at: null })
      .sort({ created_at: -1 })
      .exec();
    return doc ? toDatasetEntity(doc) : null;
  }

  /**
   * Cập nhật dataset — **chỉ trong lúc nạp** (`status = INGESTING`).
   *
   * BẤT BIẾN DỮ LIỆU: một dataset đã nạp xong (`READY`) hoặc thất bại
   * (`FAILED`) là bản chụp bất biến — không được sửa tên, tên cột, số dòng,
   * số cột hay bất kì thuộc tính nội dung nào sau đó. Các route chỉnh sửa
   * (`PATCH /datasets/:id`, `PATCH /datasets/:id/columns`,
   * `POST /datasets/:id/columns/reset`) đã bị gỡ khỏi API; guard ở đây là
   * lớp phòng thủ cuối cùng để không nơi nào (kể cả nội bộ) sửa được nội dung
   * đã nạp.
   *
   * Lưu ý: `ingest-dataset-stream.handler` gọi `updateById` để ghi kết quả
   * suy luận schema khi dataset còn `INGESTING` → vẫn đi qua được.
   */
  async updateById(
    id: string,
    update: Partial<CreateDatasetInput> & Record<string, unknown>,
  ): Promise<Dataset | null> {
    if (!isObjectIdHex(id)) return null;
    const set = toDatasetUpdate(update);
    const doc = await this.datasetModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), deleted_at: null, status: 'INGESTING' },
        { $set: set },
        { new: true },
      )
      .exec();
    return doc ? toDatasetEntity(doc) : null;
  }

  /**
   * GĐ4 — cập nhật chỉ cờ PII của các cột (`columns[].is_pii`).
   *
   * Dùng `$set` với **đường dẫn dot-notation** (`columns.0.is_pii`) nên không
   * ghi đè bất kỳ trường nội dung nào khác của dataset — kể cả khi dataset đã
   * `READY` (khác với `updateById` chỉ chạy được ở `INGESTING`).
   *
   * Đây là **metadata**, không phải nội dung dữ liệu → không vi phạm nguyên tắc
   * bất biến ("dữ liệu nạp vào như nào thì giữ nguyên như vậy").
   */
  async updateColumnPii(
    id: string,
    updates: Array<{ columnKey: string; isPii: boolean }>,
  ): Promise<Dataset | null> {
    if (!isObjectIdHex(id) || updates.length === 0) return null;
    const doc = await this.datasetModel
      .findOne({ _id: new Types.ObjectId(id), deleted_at: null })
      .exec();
    if (!doc) return null;

    const columns = doc.columns ?? [];
    const setOps: Record<string, boolean> = {};
    let changed = 0;
    for (const u of updates) {
      const idx = columns.findIndex((c) => c.key === u.columnKey);
      if (idx < 0) continue;
      const current = columns[idx];
      if (!current) continue;
      if ((current.is_pii ?? false) === u.isPii) continue;
      setOps[`columns.${idx}.is_pii`] = u.isPii;
      changed++;
    }
    if (changed === 0) return toDatasetEntity(doc);

    const updated = await this.datasetModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), deleted_at: null },
        { $set: { ...setOps, updated_at: new Date() } },
        { new: true },
      )
      .exec();
    return updated ? toDatasetEntity(updated) : null;
  }

  async bulkInsertRecords(records: RecordInsertDoc[]): Promise<number> {
    if (records.length === 0) return 0;
    const operations = records.map((record) => ({
      insertOne: {
        document: {
          dataset_id: new Types.ObjectId(record.datasetId),
          row_index: record.rowIndex,
          props: record.props,
          created_at: new Date(),
          updated_at: new Date(),
        },
      },
    }));
    const result = await this.recordModel.bulkWrite(operations, { ordered: false });
    return result.insertedCount;
  }

  async softDeleteDatasetWithRecords(datasetId: string): Promise<boolean> {
    if (!isObjectIdHex(datasetId)) return false;
    const id = new Types.ObjectId(datasetId);
    const result = await this.datasetModel.updateOne(
      { _id: id, deleted_at: null },
      { $set: { deleted_at: new Date() } },
    );
    if (result.modifiedCount > 0) {
      await this.recordModel.deleteMany({ dataset_id: id });
      return true;
    }
    return false;
  }
}
