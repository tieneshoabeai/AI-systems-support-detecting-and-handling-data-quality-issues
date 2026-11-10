import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { type IIssueReport } from './issue-report.schema';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type CreateIssueRecord,
  type IssueListQuery,
  type IssueReportRecord,
  type IssueReportRepositoryPort,
} from '../../domain/ports/issue-report.repository.port';
import type { IssueStatus } from '../../domain/value-objects/issue-status.vo';
import { toIssuePersistence, toIssueRecord } from './issue.mapper';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

/**
 * ISSUES — Infrastructure adapter (driven).
 * Nơi duy nhất chạm Mongoose. Triển khai ISSUE_REPORT_REPOSITORY_PORT.
 */
@Injectable()
export class IssuesRepository implements IssueReportRepositoryPort {
  constructor(@InjectModel('IssueReport') private readonly model: Model<IIssueReport>) {}

  async create(doc: CreateIssueRecord): Promise<IssueReportRecord> {
    const inst = new this.model(toIssuePersistence(doc));
    const saved = await inst.save();
    return toIssueRecord(saved);
  }

  async findById(id: string): Promise<IssueReportRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.model.findOne({ _id: new Types.ObjectId(id), deleted_at: null }).exec();
    return doc ? toIssueRecord(doc) : null;
  }

  async findByIdForUser(id: string, userId: string): Promise<IssueReportRecord | null> {
    if (!isObjectIdHex(id) || !isObjectIdHex(userId)) return null;
    const doc = await this.model
      .findOne({ _id: new Types.ObjectId(id), user_id: new Types.ObjectId(userId), deleted_at: null })
      .exec();
    return doc ? toIssueRecord(doc) : null;
  }

  async list(opts: IssueListQuery): Promise<IssueReportRecord[]> {
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
    return docs.map(toIssueRecord);
  }

  async updateStatus(id: string, status: IssueStatus, expectedVersion: number): Promise<IssueReportRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), version: expectedVersion, deleted_at: null },
        { $set: { status }, $inc: { version: 1 } },
        { new: true },
      )
      .exec();
    return doc ? toIssueRecord(doc) : null;
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

