import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IWorkspace } from './workspace.schema';
import { resolveMongoSession } from '../../../../shared/database/mongo-session-context';
import {
  WORKSPACE_REPOSITORY_PORT,
  type CreateWorkspaceRecord,
  type WorkspaceListQuery as DomainListQuery,
  type WorkspaceMemberRecord,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { toMemberPersistence, toWorkspaceRecord } from './workspace.mapper';

export interface WorkspaceListQuery extends DomainListQuery {}

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

  async updateById(id: string, update: { name?: string; description?: string }): Promise<WorkspaceRecord | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const doc = await this.workspaceModel
      .findOneAndUpdate({ _id: new Types.ObjectId(id), deleted_at: null }, { $set: update }, { new: true })
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

  async findByUserPaged(userId: string, opts: DomainListQuery = {}): Promise<{ items: WorkspaceRecord[]; total: number }> {
    const s = resolveMongoSession(undefined);
    const userObjectId = new Types.ObjectId(userId);
    const filter: Record<string, unknown> = { deleted_at: null, $or: [{ owner_id: userObjectId }, { 'members.user_id': userObjectId }] };
    if (opts.search?.trim()) filter.name = { $regex: opts.search.trim(), $options: 'i' };
    if (opts.role === 'owner') filter.owner_id = userObjectId;
    else if (opts.role === 'member') { filter['members.user_id'] = userObjectId; filter['members.role'] = 'member'; }
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 15));
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      last_accessed: { last_accessed_at: -1 }, updated: { updated_at: -1 },
      name_asc: { name: 1 }, name_desc: { name: -1 }, joined: { created_at: -1 },
    };
    const sort = sortMap[opts.sort || 'last_accessed'] ?? { last_accessed_at: -1 };
    const [items, total] = await Promise.all([
      this.workspaceModel.find(filter, null, { session: s }).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
      this.workspaceModel.countDocuments(filter).exec(),
    ]);
    return { items: items.map((d) => this.toRecord(d)), total };
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

  async updateMemberRole(workspaceId: string, userId: string, role: 'owner' | 'member'): Promise<boolean> {
    const s = resolveMongoSession(undefined);
    const result = await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId), deleted_at: null, 'members.user_id': new Types.ObjectId(userId) },
      { $set: { 'members.$.role': role } },
      { session: s },
    );
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

  async transferOwner(workspaceId: string, newOwnerId: string): Promise<boolean> {
    const s = resolveMongoSession(undefined);
    const wsId = new Types.ObjectId(workspaceId);
    const newId = new Types.ObjectId(newOwnerId);
    await this.workspaceModel.updateOne(
      { _id: wsId, deleted_at: null },
      { $set: { 'members.$[o].role': 'member' } },
      { arrayFilters: [{ 'o.role': 'owner' }], session: s } as never,
    ).exec();
    const r = await this.workspaceModel.updateOne(
      { _id: wsId, deleted_at: null, 'members.user_id': newId },
      { $set: { owner_id: newId, 'members.$.role': 'owner' } },
      { session: s },
    ).exec();
    return r.modifiedCount > 0;
  }
}
