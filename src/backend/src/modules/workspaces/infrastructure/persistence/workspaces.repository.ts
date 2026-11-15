import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IWorkspace } from './workspace.schema';
import { resolveMongoSession } from '../../../../shared/database/mongo-session-context';
import {
  type CreateWorkspaceRecord,
  type WorkspaceListQuery as DomainListQuery,
  type WorkspaceMemberRecord,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { toMemberPersistence, toWorkspaceRecord } from './workspace.mapper';
import {
  buildKeysetCondition,
  buildKeysetSort,
} from '../../../../shared/pagination/keyset-filter.util';
import { encodeKeysetCursor } from '../../../../shared/pagination/keyset-cursor';
import { extractSortValue } from '../../../../shared/pagination/keyset-value.util';
import {
  COMMON_SORT_SPECS,
  resolveSortSpec,
} from '../../../../shared/pagination/keyset-sort.util';

export type WorkspaceListQuery = DomainListQuery;

/** Số bản ghi mặc định cho mỗi trang. */
const DEFAULT_LIMIT = 15;

/**
 * WORKSPACES — Infrastructure adapter (driven).
 * Nơi duy nhất chạm Mongoose. Triển khai WORKSPACE_REPOSITORY_PORT.
 * Không extend BaseMongoRepository để tránh xung đột chữ ký port (record vs document).
 */
@Injectable()
export class WorkspacesRepository implements WorkspaceRepositoryPort {
  constructor(@InjectModel('Workspace') private readonly workspaceModel: Model<IWorkspace>) {}

  private toRecord(doc: IWorkspace): WorkspaceRecord {
    return toWorkspaceRecord(doc);
  }

  async create(data: CreateWorkspaceRecord): Promise<WorkspaceRecord> {
    const userObjectId = new Types.ObjectId(data.ownerId);
    const inst = new this.workspaceModel({
      name: data.name,
      description: data.description ?? '',
      owner_id: userObjectId,
      members: [{ user_id: userObjectId, role: 'owner', joined_at: new Date() }],
      storage_used_bytes: 0,
      last_accessed_at: new Date(),
      deleted_at: null,
    });
    const saved = await inst.save();
    return this.toRecord(saved);
  }

  async findById(id: string): Promise<WorkspaceRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.workspaceModel.findOne({ _id: new Types.ObjectId(id), deleted_at: null }).exec();
    return doc ? this.toRecord(doc) : null;
  }

  async updateById(
    id: string,
    update: { name?: string; description?: string },
    expectedVersion?: number,
  ): Promise<WorkspaceRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const filter: Record<string, unknown> =
      expectedVersion !== undefined
        ? { _id: new Types.ObjectId(id), deleted_at: null, version: expectedVersion }
        : { _id: new Types.ObjectId(id), deleted_at: null };
    const doc = await this.workspaceModel
      .findOneAndUpdate(filter, { $set: update, $inc: { version: 1 } }, { new: true })
      .exec();
    return doc ? this.toRecord(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(id)) return false;
    const r = await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(id), deleted_at: null },
      { $set: { deleted_at: new Date() } },
    );
    return r.modifiedCount > 0;
  }

  async findByUser(userId: string): Promise<WorkspaceRecord[]> {
    const s = resolveMongoSession(undefined);
    const userObjectId = new Types.ObjectId(userId);
    const docs = await this.workspaceModel
      .find({ deleted_at: null, $or: [{ owner_id: userObjectId }, { 'members.user_id': userObjectId }] }, null, { session: s })
      .sort({ updated_at: -1 })
      .exec();
    return docs.map((d) => this.toRecord(d));
  }

  async findAllActive(): Promise<WorkspaceRecord[]> {
    const s = resolveMongoSession(undefined);
    const docs = await this.workspaceModel.find({ deleted_at: null }, null, { session: s }).sort({ updated_at: -1 }).exec();
    return docs.map((d) => this.toRecord(d));
  }

  async countActive(): Promise<number> {
    const s = resolveMongoSession(undefined);
    return this.workspaceModel.countDocuments({ deleted_at: null }, { session: s }).exec();
  }

  async countOwnedByUser(userId: string): Promise<number> {
    const s = resolveMongoSession(undefined);
    return this.workspaceModel
      .countDocuments({ deleted_at: null, owner_id: new Types.ObjectId(userId) }, { session: s })
      .exec();
  }

  async countSharedByUser(userId: string): Promise<number> {
    const s = resolveMongoSession(undefined);
    return this.workspaceModel
      .countDocuments(
        { deleted_at: null, owner_id: { $ne: new Types.ObjectId(userId) }, 'members.user_id': new Types.ObjectId(userId) },
        { session: s },
      )
      .exec();
  }

  async findByUserPaged(
    userId: string,
    opts: DomainListQuery = {},
  ): Promise<{ items: WorkspaceRecord[]; nextCursor: string | null; hasMore: boolean }> {
    const s = resolveMongoSession(undefined);
    const userObjectId = new Types.ObjectId(userId);
    const conditions: Record<string, unknown>[] = [
      { deleted_at: null },
      { $or: [{ owner_id: userObjectId }, { 'members.user_id': userObjectId }] },
    ];
    if (opts.search?.trim()) {
      conditions.push({ name: { $regex: opts.search.trim(), $options: 'i' } });
    }
    if (opts.role === 'owner') {
      conditions.push({ owner_id: userObjectId });
    } else if (opts.role === 'member') {
      conditions.push({ 'members.user_id': userObjectId, 'members.role': 'member' });
    }

    const limit = Math.min(100, Math.max(1, Number(opts.limit) || DEFAULT_LIMIT));
    const { code, spec } = resolveSortSpec(COMMON_SORT_SPECS, opts.sort);

    // Điều kiện keyset: chỉ áp dụng khi có con trỏ hợp lệ.
    const cursor = opts.cursor;
    if (cursor) {
      conditions.push(
        buildKeysetCondition(spec, {
          value: cursor.value,
          isNull: cursor.isNull,
          id: cursor.id,
        }),
      );
    }

    // Lấy limit + 1 để biết còn dữ liệu hay không (không cần countDocuments).
    const docs = await this.workspaceModel
      .find({ $and: conditions }, null, { session: s })
      .sort(buildKeysetSort(spec))
      .limit(limit + 1)
      .exec();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    const items = page.map((d) => this.toRecord(d));

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = page[page.length - 1];
      if (last) {
        const raw = last as unknown as Record<string, unknown>;
        const sortValue = extractSortValue(spec, raw);
        nextCursor = encodeKeysetCursor({
          s: code,
          k: sortValue.value,
          n: sortValue.isNull ? 1 : 0,
          id: last._id.toString(),
        });
      }
    }

    return { items, nextCursor, hasMore };
  }

  async addMember(workspaceId: string, member: WorkspaceMemberRecord): Promise<boolean> {
    const s = resolveMongoSession(undefined);
    const result = await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId), deleted_at: null },
      { $push: { members: toMemberPersistence(member) } },
      { session: s },
    );
    return result.modifiedCount > 0;
  }

  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    const s = resolveMongoSession(undefined);
    const result = await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId), deleted_at: null },
      { $pull: { members: { user_id: new Types.ObjectId(userId) } } },
      { session: s },
    );
    return result.modifiedCount > 0;
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: 'owner' | 'member',
    expectedVersion?: number,
  ): Promise<boolean | null> {
    const s = resolveMongoSession(undefined);
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(workspaceId),
      deleted_at: null,
      'members.user_id': new Types.ObjectId(userId),
    };
    if (expectedVersion !== undefined) filter.version = expectedVersion;
    const result = await this.workspaceModel.updateOne(
      filter,
      { $set: { 'members.$.role': role }, $inc: { version: 1 } },
      { session: s },
    );
    if (result.modifiedCount > 0) return true;
    if (expectedVersion !== undefined) {
      const exists = await this.workspaceModel
        .findOne({ _id: new Types.ObjectId(workspaceId), deleted_at: null })
        .select('_id version')
        .lean()
        .exec();
      if (exists) return null;
      return false;
    }
    return result.modifiedCount > 0;
  }

  async touchLastAccessed(workspaceId: string): Promise<void> {
    const s = resolveMongoSession(undefined);
    await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId), deleted_at: null },
      { $set: { last_accessed_at: new Date() } },
      { session: s },
    ).exec();
  }

  async addStorageUsed(workspaceId: string, deltaBytes: number): Promise<void> {
    const s = resolveMongoSession(undefined);
    await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId), deleted_at: null },
      { $inc: { storage_used_bytes: deltaBytes } },
      { session: s },
    ).exec();
  }

  async transferOwner(workspaceId: string, newOwnerId: string, expectedVersion: number): Promise<boolean | null> {
    const s = resolveMongoSession(undefined);
    const wsId = new Types.ObjectId(workspaceId);
    const newId = new Types.ObjectId(newOwnerId);
    const scoped: Record<string, unknown> = { _id: wsId, deleted_at: null, version: expectedVersion };
    const demote = await this.workspaceModel.updateOne(
      scoped,
      { $set: { 'members.$[o].role': 'member' }, $inc: { version: 1 } },
      { arrayFilters: [{ 'o.role': 'owner' }], session: s } as never,
    ).exec();
    if (demote.matchedCount === 0) {
      const exists = await this.workspaceModel.findOne({ _id: wsId, deleted_at: null }).select('_id version').lean().exec();
      if (exists) return null;
      return false;
    }
    const r = await this.workspaceModel.updateOne(
      { _id: wsId, deleted_at: null, 'members.user_id': newId },
      { $set: { owner_id: newId, 'members.$.role': 'owner' } },
      { session: s },
    ).exec();
    return r.modifiedCount > 0;
  }
}
