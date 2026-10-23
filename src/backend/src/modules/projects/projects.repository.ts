import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { BaseMongoRepository } from '../../shared/database/base-mongo.repository';
import { IProject } from './schemas/project.schema';
import { resolveMongoSession } from '../../shared/database/mongo-session-context';

@Injectable()
export class ProjectsRepository extends BaseMongoRepository<IProject> {
  constructor(
    @InjectModel('Project') private readonly projectModel: Model<IProject>
  ) {
    super(projectModel);
  }

  async findByWorkspace(
    workspaceId: string | Types.ObjectId,
    session?: ClientSession
  ): Promise<IProject[]> {
    const s = resolveMongoSession(session);
    return this.projectModel
      .find(
        {
          workspace_id: new Types.ObjectId(workspaceId),
          deleted_at: null,
        },
        null,
        { session: s }
      )
      .sort({ updated_at: -1 })
      .exec();
  }

  async setHasDataset(
    projectId: string | Types.ObjectId,
    hasDataset: boolean,
    session?: ClientSession
  ): Promise<boolean> {
    const s = resolveMongoSession(session);
    const result = await this.projectModel.updateOne(
      { _id: new Types.ObjectId(projectId), deleted_at: null },
      { $set: { has_dataset: hasDataset } },
      { session: s }
    );
    return result.modifiedCount > 0;
  }
}
