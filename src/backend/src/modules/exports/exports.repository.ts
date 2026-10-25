import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BaseMongoRepository } from '../../shared/database/base-mongo.repository';
import { IExportTask } from './schemas/export-task.schema';
import { resolveMongoSession } from '../../shared/database/mongo-session-context';

@Injectable()
export class ExportsRepository extends BaseMongoRepository<IExportTask> {
  constructor(
    @InjectModel('ExportTask')
    exportTaskModel: Model<IExportTask>
  ) {
    super(exportTaskModel);
  }

  /**
   * Lấy lịch sử các lần xuất dữ liệu của tập dữ liệu
   */
  async findByDatasetId(
    datasetId: string | Types.ObjectId,
    session?: ClientSession
  ): Promise<IExportTask[]> {
    const s = resolveMongoSession(session);
    return this.model
      .find({
        dataset_id: new Types.ObjectId(datasetId),
        deleted_at: null,
      })
      .sort({ created_at: -1 })
      .session(s ?? null)
      .exec();
  }
}
