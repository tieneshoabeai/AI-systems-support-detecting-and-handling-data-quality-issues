import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { type IIssueReport } from './issue-report.schema';
import {
  type CreateIssueRecord,
  type IssueListQuery,
  type IssueReportRepositoryPort,
  type UpdateIssueByUserInput,
} from '../../domain/ports/issue-report.repository.port';
import type { IssueReport, IssueAttachment } from '../../domain/entities/issue-report.entity';
import type { IssueStatus } from '../../domain/value-objects/issue-status.vo';
import { toIssueEntity, toIssuePersistence } from './issue.mapper';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import { resolveMongoSession } from '../../../../shared/infrastructure/database/mongo-session-context';

/**
 * ISSUES — Infrastructure adapter (driven).
 * Nơi duy nhất chạm Mongoose. Triển khai ISSUE_REPORT_REPOSITORY_PORT.
 *
 * **Bước 3 — Rich Domain Model:** trả entity `IssueReport`.
 */
@Injectable()
export class IssuesRepository implements IssueReportRepositoryPort {
  constructor(@InjectModel('IssueReport') private readonly model: Model<IIssueReport>) {}

  async create(doc: CreateIssueRecord): Promise<IssueReport> {
    const inst = new this.model(toIssuePersistence(doc));
    const s = resolveMongoSession(undefined);
    const saved = await inst.save({ session: s });
    return toIssueEntity(saved);
  }

  async findById(id: string): Promise<IssueReport | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.model.findOne({ _id: new Types.ObjectId(id), deleted_at: null }).exec();
    return doc ? toIssueEntity(doc) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<IssueReport | null> {
    if (!isObjectIdHex(id) || !isObjectIdHex(userId)) return null;
    const doc = await this.model
      .findOne({ _id: new Types.ObjectId(id), user_id: new Types.ObjectId(userId), deleted_at: null })
      .exec();
    return doc ? toIssueEntity(doc) : null;
  }

  async list(opts: IssueListQuery): Promise<IssueReport[]> {
    const filter: Record<string, unknown> = { deleted_at: null };
    if (opts.userId) {
      if (!isObjectIdHex(opts.userId)) return [];
      filter.user_id = new Types.ObjectId(opts.userId);
    }
    if (opts.status) filter.status = opts.status;
    if (opts.cursorCreatedAt && opts.cursorId && isObjectIdHex(opts.cursorId)) {
      const cmp = opts.sortOrder === 'desc' ? '$lt' : '$gt';
      filter.$or = [
        { created_at: { [cmp]: opts.cursorCreatedAt } },
        { created_at: opts.cursorCreatedAt, _id: { [cmp]: new Types.ObjectId(opts.cursorId) } },
      ];
    }
    const dir = opts.sortOrder === 'desc' ? -1 : 1;
    const sortField = opts.sortBy === 'updatedAt' ? 'updated_at' : opts.sortBy === 'status' ? 'status' : 'created_at';
    const sort: Record<string, 1 | -1> = {};
    sort[sortField] = dir;
    (sort as Record<string, 1 | -1>)['_id'] = dir;
    const docs = await this.model.find(filter).sort(sort).limit(opts.limit + 1).exec();
    return docs.map(toIssueEntity);
  }

  async addAttachment(id: string, attachment: IssueAttachment): Promise<IssueReport | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), deleted_at: null },
        {
          $push: {
            attachments: {
              id: new Types.ObjectId(attachment.id),
              filename: attachment.filename,
              storage_key: attachment.storageKey,
              size_bytes: attachment.sizeBytes,
              content_type: attachment.contentType,
            },
          },
        },
        { returnDocument: 'after', session: resolveMongoSession(undefined) },
      )
      .exec();
    return doc ? toIssueEntity(doc) : null;
  }

  async updateStatus(id: string, status: IssueStatus, expectedVersion: number): Promise<IssueReport | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), version: expectedVersion, deleted_at: null },
        { $set: { status }, $inc: { version: 1 } },
        { returnDocument: 'after', session: resolveMongoSession(undefined) },
      )
      .exec();
    return doc ? toIssueEntity(doc) : null;
  }

  async updateByUser(id: string, input: UpdateIssueByUserInput): Promise<IssueReport | null> {
    if (!isObjectIdHex(id) || !isObjectIdHex(input.userId)) return null;

    const set: Record<string, unknown> = { status: 'in_progress' };
    if (input.title !== undefined) set.title = input.title.trim();
    if (input.description !== undefined) set.description = input.description.trim();

    const update: Record<string, unknown> = { $set: set, $inc: { version: 1 } };

    // Gỡ tệp đính kèm theo yêu cầu của người dùng.
    const removeIds = (input.removeAttachmentIds ?? []).filter((aid) => isObjectIdHex(aid));
    if (removeIds.length > 0) {
      update.$pull = { attachments: { id: { $in: removeIds.map((aid) => new Types.ObjectId(aid)) } } };
    }

    const doc = await this.model
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          user_id: new Types.ObjectId(input.userId),
          status: 'needs_info',
          version: input.expectedVersion,
          deleted_at: null,
        },
        update,
        { returnDocument: 'after', session: resolveMongoSession(undefined) },
      )
      .exec();
    return doc ? toIssueEntity(doc) : null;
  }

  async findStatusById(id: string): Promise<IssueStatus | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.model
      .findOne({ _id: new Types.ObjectId(id), deleted_at: null })
      .select('status')
      .lean()
      .exec();
    return (doc?.status as IssueStatus | undefined) ?? null;
  }
}
