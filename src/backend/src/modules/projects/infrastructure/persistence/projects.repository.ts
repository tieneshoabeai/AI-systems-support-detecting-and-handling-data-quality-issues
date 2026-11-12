import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IProject } from './project.schema';
import {
  PROJECT_REPOSITORY_PORT,
  type AddProjectMemberRecord,
  type CreateProjectRecord,
  type ProjectListQuery,
  type ProjectMemberRole,
  type ProjectRecord,
  type ProjectRepositoryPort,
  type ProjectStatus,
} from '../../domain/ports/project.repository.port';
import { toProjectRecord } from './project.mapper';

/**
 * PROJECTS — Infrastructure adapter (driven).
 * Nơi duy nhất chạm Mongoose. Triển khai PROJECT_REPOSITORY_PORT.
 * Trả về ProjectRecord (camelCase, id string), không lộ Document.
 */
@Injectable()
export class ProjectsRepository implements ProjectRepositoryPort {
  constructor(@InjectModel('Project') private readonly model: Model<IProject>) {}

  async create(data: CreateProjectRecord): Promise<ProjectRecord> {
    const inst = new this.model({
      workspace_id: new Types.ObjectId(data.workspaceId),
      name: data.name.trim(),
      description: data.description ?? '',
      has_dataset: false,
      status: 'not_started',
      members: [{ user_id: new Types.ObjectId(data.createdBy), role: 'owner', joined_at: new Date() }],
      last_accessed_at: new Date(),
      created_by: new Types.ObjectId(data.createdBy),
      deleted_at: null,
    });
    const saved = await inst.save();
    return toProjectRecord(saved);
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
    const doc = await this.model.findOne({ _id: new Types.ObjectId(id), deleted_at: null }).exec();
    return doc ? toProjectRecord(doc) : null;
  }

  async findOneByWorkspaceAndName(workspaceId: string, name: string): Promise<ProjectRecord | null> {
    if (!/^[0-9a-fA-F]{24}$/.test(workspaceId)) return null;
    const doc = await this.model
      .findOne({ workspace_id: new Types.ObjectId(workspaceId), name: name.trim(), deleted_at: null })
      .exec();
    return doc ? toProjectRecord(doc) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<ProjectRecord[]> {
    if (!/^[0-9a-fA-F]{24}$/.test(workspaceId)) return [];
    const docs = await this.model
      .find({ workspace_id: new Types.ObjectId(workspaceId), deleted_at: null })
      .sort({ updated_at: -1 })
      .exec();
    return docs.map(toProjectRecord);
  }

  async findByWorkspacePaged(
    workspaceId: string,
    opts: ProjectListQuery = {},
  ): Promise<{ items: ProjectRecord[]; total: number }> {
    const filter: Record<string, unknown> = {
      workspace_id: new Types.ObjectId(workspaceId),
      deleted_at: null,
    };
    if (opts.search?.trim()) filter.name = { $regex: opts.search.trim(), $options: 'i' };
    if (opts.status) filter.status = opts.status;
    const page = Math.max(1, Number(opts.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || 15));
    const sortMap: Record<string, Record<string, 1 | -1>> = {
      last_accessed: { last_accessed_at: -1 },
      updated: { updated_at: -1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      joined: { created_at: -1 },
    };
    const sort = sortMap[opts.sort || 'last_accessed'] ?? { last_accessed_at: -1 };
    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items: items.map(toProjectRecord), total };
  }

  async updateById(
    id: string,
    update: { name?: string; description?: string },
    expectedVersion?: number,
  ): Promise<ProjectRecord | null> {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) return null;
    const set: Record<string, unknown> = {};
    if (update.name !== undefined) set.name = update.name.trim();
    if (update.description !== undefined) set.description = update.description;
    const filter: Record<string, unknown> = { _id: new Types.ObjectId(id), deleted_at: null };
    if (expectedVersion !== undefined) filter.version = expectedVersion;
    const doc = await this.model
      .findOneAndUpdate(filter, { $set: set, $inc: { version: 1 } }, { new: true })
      .exec();
    return doc ? toProjectRecord(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) return false;
    const r = await this.model
      .updateOne({ _id: new Types.ObjectId(id), deleted_at: null }, { $set: { deleted_at: new Date() } })
      .exec();
    return r.modifiedCount > 0;
  }

  async setHasDataset(projectId: string, hasDataset: boolean): Promise<boolean> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) return false;
    const r = await this.model
      .updateOne({ _id: new Types.ObjectId(projectId), deleted_at: null }, { $set: { has_dataset: hasDataset } })
      .exec();
    return r.modifiedCount > 0;
  }

  async markCompleted(projectId: string, expectedVersion: number): Promise<boolean | null> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) return false;
    const r = await this.model
      .updateOne(
        { _id: new Types.ObjectId(projectId), deleted_at: null, status: 'in_progress', version: expectedVersion },
        { $set: { status: 'completed' }, $inc: { version: 1 } },
      )
      .exec();
    if (r.modifiedCount > 0) return true;
    const exists = await this.model.findOne({ _id: new Types.ObjectId(projectId), deleted_at: null }).select('_id status version').lean().exec();
    if (exists) return null;
    return false;
  }

  async setStatus(projectId: string, status: ProjectStatus): Promise<boolean> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) return false;
    const r = await this.model
      .updateOne({ _id: new Types.ObjectId(projectId), deleted_at: null }, { $set: { status } })
      .exec();
    return r.modifiedCount > 0;
  }

  async touchLastAccessed(projectId: string): Promise<void> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId)) return;
    await this.model
      .updateOne({ _id: new Types.ObjectId(projectId), deleted_at: null }, { $set: { last_accessed_at: new Date() } })
      .exec();
  }

  async addMember(projectId: string, member: AddProjectMemberRecord): Promise<boolean> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId) || !/^[0-9a-fA-F]{24}$/.test(member.userId)) return false;
    const r = await this.model
      .updateOne(
        { _id: new Types.ObjectId(projectId), deleted_at: null },
        { $push: { members: { user_id: new Types.ObjectId(member.userId), role: member.role as ProjectMemberRole, joined_at: new Date() } } },
      )
      .exec();
    return r.modifiedCount > 0;
  }

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId) || !/^[0-9a-fA-F]{24}$/.test(userId)) return false;
    const r = await this.model
      .updateOne(
        { _id: new Types.ObjectId(projectId), deleted_at: null },
        { $pull: { members: { user_id: new Types.ObjectId(userId) } } },
      )
      .exec();
    return r.modifiedCount > 0;
  }

  async updateMemberRole(projectId: string, userId: string, role: ProjectMemberRole, expectedVersion?: number): Promise<boolean | null> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId) || !/^[0-9a-fA-F]{24}$/.test(userId)) return false;
    const filter: Record<string, unknown> = {
      _id: new Types.ObjectId(projectId),
      deleted_at: null,
      'members.user_id': new Types.ObjectId(userId),
    };
    if (expectedVersion !== undefined) filter.version = expectedVersion;
    const r = await this.model
      .updateOne(filter, { $set: { 'members.$.role': role }, $inc: { version: 1 } })
      .exec();
    if (r.modifiedCount > 0) return true;
    if (expectedVersion !== undefined) {
      const exists = await this.model.findOne({ _id: new Types.ObjectId(projectId), deleted_at: null }).select('_id version').lean().exec();
      if (exists) return null;
      return false;
    }
    return r.modifiedCount > 0;
  }

  async transferOwner(projectId: string, newOwnerId: string, expectedVersion?: number): Promise<boolean | null> {
    if (!/^[0-9a-fA-F]{24}$/.test(projectId) || !/^[0-9a-fA-F]{24}$/.test(newOwnerId)) return false;
    const prjId = new Types.ObjectId(projectId);
    const newId = new Types.ObjectId(newOwnerId);
    const scoped: Record<string, unknown> = { _id: prjId, deleted_at: null };
    if (expectedVersion !== undefined) scoped.version = expectedVersion;
    const demote = await this.model
      .updateOne(scoped, { $set: { 'members.$[o].role': 'member' }, $inc: { version: 1 } }, { arrayFilters: [{ 'o.role': 'owner' }] } as never)
      .exec();
    if (demote.matchedCount === 0) {
      if (expectedVersion !== undefined) {
        const exists = await this.model.findOne({ _id: prjId, deleted_at: null }).select('_id version').lean().exec();
        if (exists) return null;
        return false;
      }
      return false;
    }
    const r = await this.model
      .updateOne({ _id: prjId, deleted_at: null, 'members.user_id': newId }, { $set: { 'members.$.role': 'owner' } })
      .exec();
    return r.modifiedCount > 0;
  }
}

