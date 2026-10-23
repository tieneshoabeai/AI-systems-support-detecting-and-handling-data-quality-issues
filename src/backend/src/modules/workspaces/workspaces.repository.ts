import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BaseMongoRepository } from '../../shared/database/base-mongo.repository';
import { IWorkspace, IWorkspaceMember } from './schemas/workspace.schema';
import { resolveMongoSession } from '../../shared/database/mongo-session-context';

@Injectable()
export class WorkspacesRepository extends BaseMongoRepository<IWorkspace> {
  constructor(
    @InjectModel('Workspace') private readonly workspaceModel: Model<IWorkspace>
  ) {
    super(workspaceModel);
  }

  async findByUser(userId: string | Types.ObjectId, session?: ClientSession): Promise<IWorkspace[]> {
    const s = resolveMongoSession(session);
    const userObjectId = new Types.ObjectId(userId);
    return this.workspaceModel
      .find(
        {
          deleted_at: null,
          $or: [{ owner_id: userObjectId }, { 'members.user_id': userObjectId }],
        },
        null,
        { session: s }
      )
      .sort({ updated_at: -1 })
      .exec();
  }

  async findAllActive(session?: ClientSession): Promise<IWorkspace[]> {
    const s = resolveMongoSession(session);
    return this.workspaceModel
      .find({ deleted_at: null }, null, { session: s })
      .sort({ updated_at: -1 })
      .exec();
  }

  async addMember(
    workspaceId: string | Types.ObjectId,
    member: IWorkspaceMember,
    session?: ClientSession
  ): Promise<boolean> {
    const s = resolveMongoSession(session);
    const result = await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId), deleted_at: null },
      { $push: { members: member } },
      { session: s }
    );
    return result.modifiedCount > 0;
  }

  async removeMember(
    workspaceId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    session?: ClientSession
  ): Promise<boolean> {
    const s = resolveMongoSession(session);
    const result = await this.workspaceModel.updateOne(
      { _id: new Types.ObjectId(workspaceId), deleted_at: null },
      { $pull: { members: { user_id: new Types.ObjectId(userId) } } },
      { session: s }
    );
    return result.modifiedCount > 0;
  }

  async updateMemberRole(
    workspaceId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    role: 'owner' | 'editor' | 'viewer',
    session?: ClientSession
  ): Promise<boolean> {
    const s = resolveMongoSession(session);
    const result = await this.workspaceModel.updateOne(
      {
        _id: new Types.ObjectId(workspaceId),
        deleted_at: null,
        'members.user_id': new Types.ObjectId(userId),
      },
      { $set: { 'members.$.role': role } },
      { session: s }
    );
    return result.modifiedCount > 0;
  }
}
