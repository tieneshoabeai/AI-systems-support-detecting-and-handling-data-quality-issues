import { Model, Document, UpdateQuery, QueryOptions, Types, ClientSession, ProjectionType } from 'mongoose';
export interface BaseEntity {
    _id: Types.ObjectId;
    deleted_at?: Date | null;
    created_at?: Date;
    updated_at?: Date;
}
export type MongoFilter<T = unknown> = Record<string, unknown>;
export declare abstract class BaseMongoRepository<T extends Document & BaseEntity> {
    protected readonly model: Model<T>;
    constructor(model: Model<T>);
    private applySoftDeleteFilter;
    findById(id: string | Types.ObjectId, projection?: ProjectionType<T> | null, session?: ClientSession): Promise<T | null>;
    findOne(filter: MongoFilter<T>, projection?: ProjectionType<T> | null, options?: QueryOptions, session?: ClientSession): Promise<T | null>;
    find(filter?: MongoFilter<T>, projection?: ProjectionType<T> | null, options?: QueryOptions, session?: ClientSession): Promise<T[]>;
    count(filter?: MongoFilter<T>, session?: ClientSession): Promise<number>;
    create(doc: Partial<T>, session?: ClientSession): Promise<T>;
    softDelete(id: string | Types.ObjectId, session?: ClientSession): Promise<boolean>;
    updateById(id: string | Types.ObjectId, update: UpdateQuery<T>, session?: ClientSession): Promise<T | null>;
}
