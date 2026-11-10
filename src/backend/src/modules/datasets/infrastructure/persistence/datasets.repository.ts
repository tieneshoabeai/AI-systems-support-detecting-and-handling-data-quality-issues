import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IDataset } from './dataset.schema';
import { IDatasetRecord } from './dataset-record.schema';
import {
  DATASET_REPOSITORY_PORT,
  type CreateDatasetRecord,
  type DatasetRecord,
  type DatasetRepositoryPort,
  type RecordInsertDoc,
} from '../../domain/ports/dataset.repository.port';
import {
  toDatasetPersistence,
  toDatasetRecord,
  toDatasetUpdate,
} from './dataset.mapper';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

/**
 * DATASETS — Infrastructure adapter (driven).
 * Noi duy nhat cham Mongoose. Trien khai DATASET_REPOSITORY_PORT.
 * Tra ve DatasetRecord (camelCase, id string), khong lo Document.
 * Wave 4 (S19/A13): dataset_record INSERT-ONLY.
 */
@Injectable()
export class DatasetsRepository implements DatasetRepositoryPort {
  constructor(
    @InjectModel('Dataset') private readonly datasetModel: Model<IDataset>,
    @InjectModel('DatasetRecord') private readonly recordModel: Model<IDatasetRecord>,
  ) {}

  async create(data: CreateDatasetRecord): Promise<DatasetRecord> {
    const inst = new this.datasetModel(toDatasetPersistence(data));
    const saved = await inst.save();
    return toDatasetRecord(saved);
  }

  async findById(id: string): Promise<DatasetRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.datasetModel
      .findOne({ _id: new Types.ObjectId(id), deleted_at: null })
      .exec();
    return doc ? toDatasetRecord(doc) : null;
  }

  async findByProject(projectId: string): Promise<DatasetRecord | null> {
    if (!isObjectIdHex(projectId)) return null;
    const doc = await this.datasetModel
      .findOne({ project_id: new Types.ObjectId(projectId), deleted_at: null })
      .sort({ created_at: -1 })
      .exec();
    return doc ? toDatasetRecord(doc) : null;
  }

  async updateById(
    id: string,
    update: Partial<CreateDatasetRecord> & Record<string, unknown>,
  ): Promise<DatasetRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const set = toDatasetUpdate(update);
    const doc = await this.datasetModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), deleted_at: null },
        { $set: set },
        { new: true },
      )
      .exec();
    return doc ? toDatasetRecord(doc) : null;
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

