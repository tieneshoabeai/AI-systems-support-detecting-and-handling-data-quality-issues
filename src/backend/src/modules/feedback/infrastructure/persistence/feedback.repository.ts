import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IFindingFeedback } from './finding-feedback.schema';
import {
  FEEDBACK_REPOSITORY_PORT,
  type CreateFeedbackRecord,
  type FeedbackListQuery,
  type FeedbackRecord,
  type FeedbackRepositoryPort,
  type FeedbackScope,
} from '../../domain/ports/feedback.repository.port';
import { toFeedbackPersistence, toFeedbackRecord } from './feedback.mapper';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

function oid(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

/**
 * FEEDBACK — Infrastructure adapter (driven).
 * Noi duy nhat cham Mongoose. Trien khai FEEDBACK_REPOSITORY_PORT.
 * Nhan input linh hoat (camel + snake + ObjectId cu), tra ve FeedbackRecord domain.
 */
@Injectable()
export class FeedbackRepository implements FeedbackRepositoryPort {
  constructor(
    @InjectModel('FindingFeedback')
    private readonly model: Model<IFindingFeedback>,
  ) {}

  async create(doc: CreateFeedbackRecord): Promise<FeedbackRecord> {
    const raw = doc as unknown as Record<string, unknown>;
    // ho tro ca snake_case + ObjectId cu tu service chua refactor het
    const pickStr = (v: unknown): string | null => {
      if (typeof v === 'string' && v.length > 0) return v;
      if (v instanceof Types.ObjectId) return v.toString();
      return null;
    };
    const get = (camel: string, snake: string): unknown => (raw[camel] !== undefined ? raw[camel] : raw[snake]);
    const input: CreateFeedbackRecord = {
      analysisRunId: pickStr(get('analysisRunId', 'analysis_run_id')) ?? (doc as CreateFeedbackRecord).analysisRunId,
      projectId: pickStr(get('projectId', 'project_id')) ?? (doc as CreateFeedbackRecord).projectId,
      workspaceId: pickStr(get('workspaceId', 'workspace_id')) ?? (doc as CreateFeedbackRecord).workspaceId,
      findingId: (get('findingId', 'finding_id') as string | null) ?? null,
      findingKey: (get('findingKey', 'finding_key') as string | null) ?? null,
      authorId: pickStr(get('authorId', 'author_id')) ?? (doc as CreateFeedbackRecord).authorId,
      label: String(get('label', 'label') ?? (doc as CreateFeedbackRecord).label),
      reason: (get('reason', 'reason') as string | null) ?? null,
      suggestedSeverity: (get('suggestedSeverity', 'suggested_severity') as string | null) ?? null,
      aiConfidence: (get('aiConfidence', 'ai_confidence') as number | null) ?? null,
      aiRationale: (get('aiRationale', 'ai_rationale') as string | null) ?? null,
      authorRoleAtTime: (get('authorRoleAtTime', 'author_role_at_time') as string | null) ?? null,
    };
    const inst = new this.model({ ...toFeedbackPersistence(input), deleted_at: null });
    // giu model_id / prompt_version neu service cu truyen
    const extra: Record<string, unknown> = {};
    if (raw.model_id !== undefined) extra.model_id = raw.model_id;
    if (raw.prompt_version !== undefined) extra.prompt_version = raw.prompt_version;
    if (raw.modelId !== undefined && raw.model_id === undefined) extra.model_id = raw.modelId;
    if (raw.promptVersion !== undefined && raw.prompt_version === undefined) extra.prompt_version = raw.promptVersion;
    for (const [k, v] of Object.entries(extra)) (inst as unknown as Record<string, unknown>)[k] = v;
    const saved = await inst.save();
    return toFeedbackRecord(saved);
  }

  async listByScope(params: FeedbackListQuery): Promise<FeedbackRecord[]> {
    const raw = params as unknown as Record<string, unknown>;
    const analysisRunId = String(raw.analysisRunId ?? raw.analysis_run_id ?? params.analysisRunId);
    const findingId = (raw.findingId !== undefined ? raw.findingId : raw.finding_id) as string | null;
    const limit = Number(raw.limit ?? params.limit ?? 20);
    const label = (raw.label ?? params.label) as string | undefined;
    const sortOrder = String(raw.sortOrder ?? raw.sort_order ?? params.sortOrder ?? 'desc') as 'asc' | 'desc';
    const cursorCreatedAt = (raw.cursorCreatedAt ?? raw.cursor_created_at ?? params.cursorCreatedAt) as Date | undefined;
    const cursorId = String(raw.cursorId ?? raw.cursor_id ?? params.cursorId ?? '');
    if (!isObjectIdHex(analysisRunId)) return [];
    const filter: Record<string, unknown> = {
      analysis_run_id: oid(analysisRunId),
      finding_id: findingId ?? null,
      deleted_at: null,
    };
    if (label) filter.label = label;
    if (cursorCreatedAt && cursorId && isObjectIdHex(cursorId)) {
      const op = sortOrder === 'desc' ? '$lt' : '$gt';
      filter.$or = [
        { created_at: { [op]: cursorCreatedAt } },
        { created_at: cursorCreatedAt, _id: { [op]: oid(cursorId) } },
      ];
    }
    const sort: Record<string, 1 | -1> = sortOrder === 'desc' ? { created_at: -1, _id: -1 } : { created_at: 1, _id: 1 };
    const docs = await this.model
      .find(filter as unknown as Parameters<typeof this.model.find>[0])
      .sort(sort)
      .limit(limit + 1)
      .exec();
    return docs.map(toFeedbackRecord);
  }

  async listActiveByRun(analysisRunId: string): Promise<FeedbackRecord[]> {
    if (!isObjectIdHex(analysisRunId)) return [];
    const docs = await this.model.find({ analysis_run_id: oid(analysisRunId), deleted_at: null }).sort({ created_at: 1 }).exec();
    return docs.map(toFeedbackRecord);
  }

  async findByIdActive(id: string): Promise<FeedbackRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.model.findOne({ _id: oid(id), deleted_at: null }).exec();
    return doc ? toFeedbackRecord(doc) : null;
  }

  async updateById(id: string, update: Partial<CreateFeedbackRecord> & Record<string, unknown>): Promise<FeedbackRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const raw = (update as Record<string, unknown>).$set && typeof (update as Record<string, unknown>).$set === 'object'
      ? (update as Record<string, unknown>).$set as Record<string, unknown>
      : (update as Record<string, unknown>);
    const set: Record<string, unknown> = { ...raw };
    if (raw.label !== undefined) set.label = raw.label;
    if (raw.reason !== undefined) set.reason = raw.reason;
    if (raw.suggestedSeverity !== undefined) { set.suggested_severity = raw.suggestedSeverity; delete set.suggestedSeverity; }
    if (raw.suggested_severity !== undefined) set.suggested_severity = raw.suggested_severity;
    const doc = await this.model.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
    return doc ? toFeedbackRecord(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    if (!isObjectIdHex(id)) return false;
    const res = await this.model.updateOne({ _id: oid(id), deleted_at: null }, { $set: { deleted_at: new Date() } }).exec();
    return res.modifiedCount > 0;
  }

  async countByProject(projectId: string): Promise<number> {
    if (!isObjectIdHex(projectId)) return 0;
    return this.model.countDocuments({ project_id: oid(projectId), deleted_at: null }).exec();
  }

  async countDistinctAuthors(scope: FeedbackScope): Promise<number> {
    const raw = scope as unknown as Record<string, unknown>;
    const workspaceId = String(raw.workspaceId ?? raw.workspace_id ?? scope.workspaceId);
    const findingId = String(raw.findingId ?? raw.finding_id ?? scope.findingId);
    const label = String(raw.label ?? scope.label);
    if (!isObjectIdHex(workspaceId)) return 0;
    const ids = (await this.model.distinct('author_id', {
      workspace_id: oid(workspaceId),
      finding_id: findingId,
      label,
      deleted_at: null,
    } as unknown as Record<string, unknown>).exec()) as unknown[];
    return ids.length;
  }

  async countDistinctRuns(projectId: string): Promise<number> {
    if (!isObjectIdHex(projectId)) return 0;
    const ids = await this.model.distinct('analysis_run_id', { project_id: oid(projectId), deleted_at: null } as unknown as Record<string, unknown>).exec();
    return (ids as unknown[]).length;
  }

  async aggregateByProject(projectId: string): Promise<Array<{ label: string; count: number }>> {
    if (!isObjectIdHex(projectId)) return [];
    const rows = await this.model.aggregate([
      { $match: { project_id: oid(projectId), deleted_at: null } },
      { $group: { _id: '$label', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).exec() as Array<{ _id: string; count: number }>;
    return rows.map((r) => ({ label: r._id, count: r.count }));
  }
}

