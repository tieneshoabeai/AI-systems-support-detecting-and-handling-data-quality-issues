import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BaseMongoRepository } from '../../shared/database/base-mongo.repository';
import { IDataset } from './schemas/dataset.schema';
import { IDatasetRecord } from './schemas/dataset-record.schema';
import { resolveMongoSession } from '../../shared/database/mongo-session-context';

@Injectable()
export class DatasetsRepository extends BaseMongoRepository<IDataset> {
  constructor(
    @InjectModel('Dataset') private readonly datasetModel: Model<IDataset>,
    @InjectModel('DatasetRecord') private readonly recordModel: Model<IDatasetRecord>
  ) {
    super(datasetModel);
  }

  async findByProject(
    projectId: string | Types.ObjectId,
    session?: ClientSession
  ): Promise<IDataset | null> {
    const s = resolveMongoSession(session);
    return this.datasetModel
      .findOne(
        {
          project_id: new Types.ObjectId(projectId),
          deleted_at: null,
        },
        null,
        { session: s }
      )
      .sort({ created_at: -1 })
      .exec();
  }

  async bulkInsertRecords(
    records: {
      dataset_id: Types.ObjectId;
      row_index: number;
      data: Record<string, unknown>;
      version_number: number;
    }[],
    session?: ClientSession
  ): Promise<number> {
    if (records.length === 0) return 0;
    const s = resolveMongoSession(session);
    const operations = records.map((record) => ({
      insertOne: {
        document: {
          ...record,
          deleted_at: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      },
    }));

    const result = await this.recordModel.bulkWrite(operations, {
      ordered: false,
      session: s,
    });

    return result.insertedCount;
  }

  async softDeleteDatasetWithRecords(
    datasetId: string | Types.ObjectId,
    session?: ClientSession
  ): Promise<boolean> {
    const s = resolveMongoSession(session);
    const id = new Types.ObjectId(datasetId);

    const result = await this.datasetModel.updateOne(
      { _id: id, deleted_at: null },
      { $set: { deleted_at: new Date() } },
      { session: s }
    );

    if (result.modifiedCount > 0) {
      // Đánh dấu xóa mềm tất cả records của dataset này
      await this.recordModel.updateMany(
        { dataset_id: id, deleted_at: null },
        { $set: { deleted_at: new Date() } },
        { session: s }
      );
      return true;
    }

    return false;
  }
}
