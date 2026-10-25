import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BaseMongoRepository } from '../../shared/database/base-mongo.repository';
import { IDatasetVersion } from './schemas/dataset-version.schema';
import { resolveMongoSession } from '../../shared/database/mongo-session-context';

@Injectable()
export class VersionsRepository extends BaseMongoRepository<IDatasetVersion> {
  constructor(
    @InjectModel('DatasetVersion')
    versionModel: Model<IDatasetVersion>
  ) {
    super(versionModel);
  }

  /**
   * Lấy phiên bản mới nhất theo số thứ tự của một dataset
   */
  async findLatestByDatasetId(
    datasetId: string | Types.ObjectId,
    session?: ClientSession
  ): Promise<IDatasetVersion | null> {
    const s = resolveMongoSession(session);
    return this.model
      .findOne({
        dataset_id: new Types.ObjectId(datasetId),
        deleted_at: null,
      })
      .sort({ version_number: -1 })
      .session(s ?? null)
      .exec();
  }

  /**
   * Lấy phiên bản theo dataset_id và version_number
   */
  async findByDatasetAndVersion(
    datasetId: string | Types.ObjectId,
    versionNumber: number,
    session?: ClientSession
  ): Promise<IDatasetVersion | null> {
    const s = resolveMongoSession(session);
    return this.model
      .findOne({
        dataset_id: new Types.ObjectId(datasetId),
        version_number: versionNumber,
        deleted_at: null,
      })
      .session(s ?? null)
      .exec();
  }

  /**
   * Lấy danh sách các phiên bản của dataset có phân trang
   */
  async findByDatasetId(
    datasetId: string | Types.ObjectId,
    limit = 20,
    skip = 0,
    session?: ClientSession
  ): Promise<{ items: IDatasetVersion[]; total: number }> {
    const s = resolveMongoSession(session);
    const filter = {
      dataset_id: new Types.ObjectId(datasetId),
      deleted_at: null,
    };

    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ version_number: -1 })
        .skip(skip)
        .limit(limit)
        .session(s ?? null)
        .exec(),
      this.model.countDocuments(filter).session(s ?? null).exec(),
    ]);

    return { items, total };
  }
}
