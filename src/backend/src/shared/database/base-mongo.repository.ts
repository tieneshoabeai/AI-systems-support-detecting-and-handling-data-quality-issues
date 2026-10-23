import {
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  Types,
  ClientSession,
  ProjectionType,
} from 'mongoose';
import { resolveMongoSession } from './mongo-session-context';

export interface BaseEntity {
  _id: Types.ObjectId;
  deleted_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Base Repository tự động áp dụng ràng buộc xóa mềm { deleted_at: null }
 * và tự động gia nhập vào ambient MongoDB transaction session.
 */
export abstract class BaseMongoRepository<T extends Document & BaseEntity> {
  constructor(protected readonly model: Model<T>) {}

  /**
   * Tự động bổ sung điều kiện deleted_at: null vào bộ lọc
   */
  private applySoftDeleteFilter(filter: FilterQuery<T>): FilterQuery<T> {
    return {
      ...filter,
      deleted_at: null,
    };
  }

  async findById(
    id: string | Types.ObjectId,
    projection?: ProjectionType<T> | null,
    session?: ClientSession
  ): Promise<T | null> {
    const s = resolveMongoSession(session);
    return this.model
      .findOne(
        this.applySoftDeleteFilter({ _id: new Types.ObjectId(id) } as unknown as FilterQuery<T>),
        projection,
        { session: s }
      )
      .exec();
  }

  async findOne(
    filter: FilterQuery<T>,
    projection?: ProjectionType<T> | null,
    options?: QueryOptions,
    session?: ClientSession
  ): Promise<T | null> {
    const s = resolveMongoSession(session);
    return this.model
      .findOne(this.applySoftDeleteFilter(filter), projection, { ...options, session: s })
      .exec();
  }

  async find(
    filter: FilterQuery<T> = {},
    projection?: ProjectionType<T> | null,
    options?: QueryOptions,
    session?: ClientSession
  ): Promise<T[]> {
    const s = resolveMongoSession(session);
    return this.model
      .find(this.applySoftDeleteFilter(filter), projection, { ...options, session: s })
      .exec();
  }

  async count(filter: FilterQuery<T> = {}, session?: ClientSession): Promise<number> {
    const s = resolveMongoSession(session);
    return this.model.countDocuments(this.applySoftDeleteFilter(filter), { session: s }).exec();
  }

  async create(doc: Partial<T>, session?: ClientSession): Promise<T> {
    const s = resolveMongoSession(session);
    const [created] = await this.model.create([{ ...doc, deleted_at: null }], { session: s });
    return created;
  }

  async softDelete(id: string | Types.ObjectId, session?: ClientSession): Promise<boolean> {
    const s = resolveMongoSession(session);
    const result = await this.model.updateOne(
      this.applySoftDeleteFilter({ _id: new Types.ObjectId(id) } as unknown as FilterQuery<T>),
      { $set: { deleted_at: new Date() } } as UpdateQuery<T>,
      { session: s }
    );
    return result.modifiedCount > 0;
  }

  async updateById(
    id: string | Types.ObjectId,
    update: UpdateQuery<T>,
    session?: ClientSession
  ): Promise<T | null> {
    const s = resolveMongoSession(session);
    return this.model
      .findOneAndUpdate(
        this.applySoftDeleteFilter({ _id: new Types.ObjectId(id) } as unknown as FilterQuery<T>),
        update,
        { new: true, session: s }
      )
      .exec();
  }
}
