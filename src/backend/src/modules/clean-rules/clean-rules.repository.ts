import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BaseMongoRepository } from '../../shared/database/base-mongo.repository';
import { ICleanRule } from './schemas/clean-rule.schema';
import { resolveMongoSession } from '../../shared/database/mongo-session-context';

@Injectable()
export class CleanRulesRepository extends BaseMongoRepository<ICleanRule> {
  constructor(
    @InjectModel('CleanRule')
    cleanRuleModel: Model<ICleanRule>
  ) {
    super(cleanRuleModel);
  }

  /**
   * Lấy danh sách các luật đã lưu của dataset
   */
  async findByDatasetId(
    datasetId: string | Types.ObjectId,
    session?: ClientSession
  ): Promise<ICleanRule[]> {
    const s = resolveMongoSession(session);
    return this.model
      .find({
        dataset_id: new Types.ObjectId(datasetId),
        deleted_at: null,
      })
      .sort({ created_at: 1 })
      .session(s ?? null)
      .exec();
  }

  /**
   * Chèn hàng loạt danh sách các luật vào database
   */
  async bulkInsertRules(
    rules: {
      dataset_id: Types.ObjectId;
      workspace_id: Types.ObjectId;
      name: string;
      category: string;
      action: string;
      target_column: string | null;
      target_columns: string[];
      parameters: Record<string, unknown>;
      created_by: Types.ObjectId;
    }[],
    session?: ClientSession
  ): Promise<ICleanRule[]> {
    if (rules.length === 0) return [];
    const s = resolveMongoSession(session);
    const docs = rules.map((r) => ({
      ...r,
      is_active: true,
      deleted_at: null,
    }));

    return this.model.insertMany(docs, { session: s ?? undefined });
  }
}
