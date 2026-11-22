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
import { resolveMongoSession } from '../../../../shared/infrastructure/database/mongo-session-context';

/**
 * DATASETS — Infrastructure adapter (driven).
 * Nơi duy nhất chạm Mongoose. Triển khai DATASET_REPOSITORY_PORT.
 * Trả về entity `Dataset`, không lo Document.
 * Wave 4 (S19/A13): dataset_record INSERT-only.
 *
 * ── OPEN-09: mọi thao tác GHI đều mang `session` ───────────────────────────
 * Nhờ `resolveMongoSession()`, khi handler bọc thao tác trong
 * `TransactionPort.runInTransaction()` thì lệnh ghi này **tự động** nằm
 * trong cùng transaction ⇒ thao tác chính và ghi event cùng thành công /
 * cùng rollback.
 */
@Injectable()
export class DatasetsRepository implements DatasetRepositoryPort {
  constructor(
    @InjectModel('Dataset') private readonly datasetModel: Model<IDataset>,
    @InjectModel('DatasetRecord') private readonly recordModel: Model<IDatasetRecord>,
  ) {}

  async create(data: CreateDatasetInput): Promise<Dataset> {
    const s = resolveMongoSession(undefined);
    const inst = new this.datasetModel(toDatasetPersistence(data));
    const saved = await inst.save({ session: s });
    return toDatasetEntity(saved);
  }

  async findById(id: string): Promise<Dataset | null> {
    if (!isObjectIdHex(id)) return null;
    const s = resolveMongoSession(undefined);
    const doc = await this.datasetModel
      .findOne({ _id: new Types.ObjectId(id), deleted_at: null }, null, { session: s })
      .exec();
    return doc ? toDatasetEntity(doc) : null;
  }

  async findByProject(projectId: string): Promise<Dataset | null> {
    if (!isObjectIdHex(projectId)) return null;
    const s = resolveMongoSession(undefined);
    const doc = await this.datasetModel
      .findOne({ project_id: new Types.ObjectId(projectId), deleted_at: null }, null, { session: s })
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
    const s = resolveMongoSession(undefined);
    const set = toDatasetUpdate(update);
    const doc = await this.datasetModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), deleted_at: null, status: 'INGESTING' },
        { $set: set },
        { new: true, session: s },
      )
      .exec();
    return doc ? toDatasetEntity(doc) : null;
  }

  /**
   * Ghi hàng loạt bản ghi.
   *
   * @transaction-excluded
   *
   * ⚠️ **Cố ý KHÔNG đưa vào transaction** (OPEN-09): khối lượng 50k dòng × 10
   * cột vượt trần ~16 MB của MongoDB transaction ⇒ sẽ ném
   * `TransactionTooLarge`. Bản ghi là dữ liệu thuần, idempotent khi retry.
   * Phần "đánh dấu READY + phát event" nằm ở transaction nhỏ phía sau.
   */
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
    // KHÔNG truyền `session` — cố ý ghi ngoài transaction (xem docblock trên).
    const result = await this.recordModel.bulkWrite(operations, { ordered: false });
    return result.insertedCount;
  }

  async deleteRecordsByDataset(datasetId: string): Promise<number> {
    if (!isObjectIdHex(datasetId)) return 0;
    const s = resolveMongoSession(undefined);
    const result = await this.recordModel.deleteMany(
      { dataset_id: new Types.ObjectId(datasetId) },
      { session: s },
    );
    return result.deletedCount ?? 0;
  }

  async softDeleteDatasetWithRecords(datasetId: string): Promise<boolean> {
    if (!isObjectIdHex(datasetId)) return false;
    const s = resolveMongoSession(undefined);
    const id = new Types.ObjectId(datasetId);
    const result = await this.datasetModel.updateOne(
      { _id: id, deleted_at: null },
      { $set: { deleted_at: new Date() } },
      { session: s },
    );
    if (result.modifiedCount > 0) {
      await this.recordModel.deleteMany({ dataset_id: id }, { session: s });
      return true;
    }
    return false;
  }

  /**
   * Cascade — soft-delete dataset thuộc project đã xóa, kèm xóa bản ghi.
   *
   * Trả về dataset nào đã bị xóa + dung lượng file tương ứng để caller trừ
   * `storage_used` của workspace.
   */
  async softDeleteByProject(
    projectId: string,
  ): Promise<Array<{ id: string; fileSizeBytes: number }>> {
    if (!isObjectIdHex(projectId)) return [];
    const s = resolveMongoSession(undefined);
    const pid = new Types.ObjectId(projectId);
    const docs = await this.datasetModel
      .find({ project_id: pid, deleted_at: null })
      .select('_id file_size_bytes')
      .lean()
      .exec();
    if (docs.length === 0) return [];
    const ids = docs.map((d) => d._id);
    await this.datasetModel.updateMany(
      { _id: { $in: ids }, deleted_at: null },
      { $set: { deleted_at: new Date() } },
      { session: s },
    );
    await this.recordModel.deleteMany({ dataset_id: { $in: ids } }, { session: s });
    return docs.map((d) => ({
      id: String(d._id),
      fileSizeBytes: (d as unknown as { file_size_bytes?: number }).file_size_bytes ?? 0,
    }));
  }
}
