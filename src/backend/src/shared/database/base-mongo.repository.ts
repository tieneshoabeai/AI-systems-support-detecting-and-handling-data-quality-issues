import {
  Model,
  Document,
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

export type MongoFilter<T = unknown> = Record<string, unknown>;

/**
 * Base Repository tự động áp dụng ràng buộc xóa mềm { deleted_at: null }
 * và tự động gia nhập vào ambient MongoDB transaction session.
 */
export abstract class BaseMongoRepository<T extends Document & BaseEntity> {
  constructor(protected readonly model: Model<T>) {}

  /**
   * Tự động bổ sung điều kiện deleted_at: null vào bộ lọc
   */
  private applySoftDeleteFilter(filter: MongoFilter<T>): MongoFilter<T> {
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
        this.applySoftDeleteFilter({ _id: new Types.ObjectId(id) }),
        projection,
        { session: s }
      )
      .exec();
  }

  async findOne(
    filter: MongoFilter<T>,
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
    filter: MongoFilter<T> = {},
    projection?: ProjectionType<T> | null,
    options?: QueryOptions,
    session?: ClientSession
  ): Promise<T[]> {
    const s = resolveMongoSession(session);
    return this.model
      .find(this.applySoftDeleteFilter(filter), projection, { ...options, session: s })
      .exec();
  }

  async count(filter: MongoFilter<T> = {}, session?: ClientSession): Promise<number> {
    const s = resolveMongoSession(session);
    return this.model.countDocuments(this.applySoftDeleteFilter(filter), { session: s }).exec();
  }

  async create(doc: Partial<T>, session?: ClientSession): Promise<T> {
    const s = resolveMongoSession(session);
    const instance = new this.model({ ...doc, deleted_at: null });
    return instance.save({ session: s }) as unknown as Promise<T>;
  }

  async softDelete(id: string | Types.ObjectId, session?: ClientSession): Promise<boolean> {
    const s = resolveMongoSession(session);
    const result = await this.model.updateOne(
      this.applySoftDeleteFilter({ _id: new Types.ObjectId(id) }),
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
        this.applySoftDeleteFilter({ _id: new Types.ObjectId(id) }),
        update,
        { new: true, session: s }
      )
      .exec();
  }
}
