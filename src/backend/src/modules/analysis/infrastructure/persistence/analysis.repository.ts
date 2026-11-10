import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IAnalysisRun } from './analysis-run.schema';
import { IAnalysisResult } from './analysis-result.schema';
import { IAiJob } from './ai-job.schema';
import { IFewShotExample } from './few-shot-example.schema';
import { ICellEvidence } from './cell-evidence.schema';
import { IProjectSave } from './project-save.schema';
import { IReportJob } from './report-job.schema';
import { IAnalysisConfig } from './analysis-config.schema';
import { MAX_FEW_SHOT_STORE } from '../../domain/rag-few-shot.util';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AiJobRecord,
  type AnalysisConfigRecord,
  type AnalysisRepositoryPort,
  type AnalysisResultRecord,
  type AnalysisRunRecord,
  type CellEvidenceRecord,
  type FewShotExampleRecord,
  type ProjectSaveRecord,
  type ReportJobRecord,
} from '../../domain/ports/analysis.repository.port';
import {
  toAiJobRecord,
  toAnalysisConfigRecord,
  toAnalysisResultRecord,
  toAnalysisRunRecord,
  toAnalysisRunPersistence,
  toCellEvidenceRecord,
  toFewShotRecord,
  toProjectSaveRecord,
  toReportJobRecord,
} from './analysis.mapper';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';

function oid(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function pickStr(v: unknown): string | null {
  if (typeof v === 'string' && v.length > 0) return v;
  if (v instanceof Types.ObjectId) return v.toString();
  return null;
}

function getBoth(obj: Record<string, unknown>, camel: string, snake: string): unknown {
  if (obj[camel] !== undefined) return obj[camel];
  return obj[snake];
}

/** Chuyen update camelCase/$set sang $set snake_case cho persistence. */
function toRunSet(update: Partial<AnalysisRunRecord> & Record<string, unknown>): Record<string, unknown> {
  const src = (update as Record<string, unknown>).$set && typeof (update as Record<string, unknown>).$set === 'object'
    ? (update as Record<string, unknown>).$set as Record<string, unknown>
    : (update as Record<string, unknown>);
  const map: Record<string, string> = {
    projectId: 'project_id', workspaceId: 'workspace_id', datasetId: 'dataset_id',
    inputFingerprint: 'input_fingerprint', startedBy: 'started_by', startedAt: 'started_at',
    finishedAt: 'finished_at', durationMs: 'duration_ms',
  };
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (['id', '_id', 'createdAt', 'updatedAt'].includes(k)) continue;
    if (map[k]) {
      if ((k === 'startedBy' || k === 'projectId' || k === 'workspaceId' || k === 'datasetId') && typeof v === 'string' && isObjectIdHex(v)) {
        set[map[k]] = oid(v);
      } else if (k === 'startedBy' && v === null) set[map[k]] = null;
      else set[map[k]] = v;
    } else {
      set[k] = v;
    }
  }
  // convert ObjectId-like strings for known snake keys
  for (const k of ['project_id', 'workspace_id', 'dataset_id', 'started_by']) {
    const v = set[k];
    if (typeof v === 'string' && isObjectIdHex(v)) set[k] = oid(v);
  }
  return set;
}

/**
 * ANALYSIS — Infrastructure adapter (driven).
 * Noi duy nhat cham Mongoose. Trien khai ANALYSIS_REPOSITORY_PORT.
 * Nhan input linh hoat (camelCase domain + snake_case cu), tra ve Record domain.
 */
@Injectable()
export class AnalysisRepository implements AnalysisRepositoryPort {
  constructor(
    @InjectModel('AnalysisRun') private readonly runModel: Model<IAnalysisRun>,
    @InjectModel('AnalysisResult') private readonly resultModel: Model<IAnalysisResult>,
    @InjectModel('AiJob') private readonly jobModel: Model<IAiJob>,
    @InjectModel('FewShotExample') private readonly fewShotModel: Model<IFewShotExample>,
    @InjectModel('CellEvidence') private readonly evidenceModel: Model<ICellEvidence>,
    @InjectModel('ProjectSave') private readonly saveModel: Model<IProjectSave>,
    @InjectModel('ReportJob') private readonly reportModel: Model<IReportJob>,
    @InjectModel('AnalysisConfig') private readonly configModel: Model<IAnalysisConfig>,
  ) {}

  // ---- Run ----
  async create(data: Partial<AnalysisRunRecord> & Record<string, unknown> & { projectId: string; workspaceId: string; datasetId: string }): Promise<AnalysisRunRecord> {
    const raw = data as unknown as Record<string, unknown>;
    const projectId = pickStr(raw.projectId ?? raw.project_id) ?? (data as { projectId: string }).projectId;
    const workspaceId = pickStr(raw.workspaceId ?? raw.workspace_id) ?? (data as { workspaceId: string }).workspaceId;
    const datasetId = pickStr(raw.datasetId ?? raw.dataset_id) ?? (data as { datasetId: string }).datasetId;
    const persisted = toAnalysisRunPersistence({
      projectId, workspaceId, datasetId,
      status: (getBoth(raw, 'status', 'status') as AnalysisRunRecord['status']) ?? 'running',
      inputFingerprint: String(getBoth(raw, 'inputFingerprint', 'input_fingerprint') ?? ''),
      config: (getBoth(raw, 'config', 'config') as Record<string, unknown>) ?? {},
      startedBy: pickStr(getBoth(raw, 'startedBy', 'started_by')),
      startedAt: (getBoth(raw, 'startedAt', 'started_at') as Date | null) ?? null,
    });
    // giu cac truong mo rong (finished_at, error...) neu service truyen
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!(k in persisted) && !['projectId', 'workspaceId', 'datasetId', 'inputFingerprint', 'startedBy', 'startedAt', 'project_id', 'workspace_id', 'dataset_id', 'input_fingerprint', 'started_by', 'started_at'].includes(k)) {
        extra[k] = v;
      }
    }
    const inst = new this.runModel({ ...persisted, ...extra, deleted_at: null });
    const saved = await inst.save();
    return toAnalysisRunRecord(saved);
  }

  async findById(id: string): Promise<AnalysisRunRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.runModel.findOne({ _id: oid(id), deleted_at: null }).exec();
    return doc ? toAnalysisRunRecord(doc) : null;
  }

  async updateById(id: string, update: Partial<AnalysisRunRecord> & Record<string, unknown>): Promise<AnalysisRunRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const set = toRunSet(update);
    const doc = await this.runModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
    return doc ? toAnalysisRunRecord(doc) : null;
  }

  async findRunByFingerprint(fingerprint: string): Promise<AnalysisRunRecord | null> {
    const doc = await this.runModel.findOne({ input_fingerprint: fingerprint, deleted_at: null, status: 'succeeded' }).sort({ created_at: -1 }).exec();
    return doc ? toAnalysisRunRecord(doc) : null;
  }

  async findLatestRunByProject(projectId: string): Promise<AnalysisRunRecord | null> {
    if (!isObjectIdHex(projectId)) return null;
    const doc = await this.runModel.findOne({ project_id: oid(projectId), deleted_at: null }).sort({ created_at: -1 }).exec();
    return doc ? toAnalysisRunRecord(doc) : null;
  }

  // ---- Result ----
  async saveResult(doc: Partial<AnalysisResultRecord> & Record<string, unknown>): Promise<AnalysisResultRecord> {
    const raw = doc as unknown as Record<string, unknown>;
    const analysisRunId = pickStr(getBoth(raw, 'analysisRunId', 'analysis_run_id')) ?? '';
    const projectId = pickStr(getBoth(raw, 'projectId', 'project_id')) ?? '';
    const datasetId = pickStr(getBoth(raw, 'datasetId', 'dataset_id')) ?? '';
    const persistence: Record<string, unknown> = { ...raw, deleted_at: null };
    if (isObjectIdHex(analysisRunId)) persistence.analysis_run_id = oid(analysisRunId);
    if (isObjectIdHex(projectId)) persistence.project_id = oid(projectId);
    if (isObjectIdHex(datasetId)) persistence.dataset_id = oid(datasetId);
    const inst = new this.resultModel(persistence);
    const saved = await inst.save();
    return toAnalysisResultRecord(saved);
  }

  async findResultByRun(runId: string): Promise<AnalysisResultRecord | null> {
    if (!isObjectIdHex(runId)) return null;
    const doc = await this.resultModel.findOne({ analysis_run_id: oid(runId), deleted_at: null }).exec();
    return doc ? toAnalysisResultRecord(doc) : null;
  }

  async updateResultById(id: string, update: Record<string, unknown>): Promise<AnalysisResultRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const set = (update as Record<string, unknown>).$set && typeof (update as Record<string, unknown>).$set === 'object'
      ? (update as Record<string, unknown>).$set as Record<string, unknown>
      : update;
    const doc = await this.resultModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
    return doc ? toAnalysisResultRecord(doc) : null;
  }

  async markResultsStale(projectId: string, keepRunId: string, reason: string): Promise<unknown> {
    if (!isObjectIdHex(projectId)) return { modifiedCount: 0 };
    const filter: Record<string, unknown> = { project_id: oid(projectId), deleted_at: null, is_stale: false };
    if (isObjectIdHex(keepRunId)) filter.analysis_run_id = { $ne: oid(keepRunId) };
    return this.resultModel.updateMany(filter, { $set: { is_stale: true, stale_reason: reason } }).exec();
  }

  // ---- AI job ----
  async createJob(doc: Partial<AiJobRecord> & Record<string, unknown>): Promise<AiJobRecord> {
    const raw = doc as unknown as Record<string, unknown>;
    const persistence: Record<string, unknown> = { ...raw, deleted_at: null };
    for (const [camel, snake] of [['analysisRunId', 'analysis_run_id'], ['projectId', 'project_id'], ['datasetId', 'dataset_id'], ['inputFingerprint', 'input_fingerprint'], ['modelId', 'model_id'], ['promptVersion', 'prompt_version']] as const) {
      const v = raw[camel];
      if (v !== undefined) persistence[snake] = v;
    }
    for (const k of ['analysis_run_id', 'project_id', 'dataset_id'] as const) {
      const v = persistence[k];
      if (typeof v === 'string' && isObjectIdHex(v)) persistence[k] = oid(v);
    }
    const inst = new this.jobModel(persistence);
    const saved = await inst.save();
    return toAiJobRecord(saved);
  }

  async findJobById(id: string): Promise<AiJobRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.jobModel.findOne({ _id: oid(id), deleted_at: null }).exec();
    return doc ? toAiJobRecord(doc) : null;
  }

  async updateJobById(id: string, update: Record<string, unknown>): Promise<AiJobRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const set = (update as Record<string, unknown>).$set && typeof (update as Record<string, unknown>).$set === 'object'
      ? (update as Record<string, unknown>).$set as Record<string, unknown>
      : update;
    const doc = await this.jobModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
    return doc ? toAiJobRecord(doc) : null;
  }

  async claimPendingJob(leaseMs = 600000): Promise<AiJobRecord | null> {
    const now = new Date();
    const doc = await this.jobModel.findOneAndUpdate(
      { deleted_at: null, $or: [{ status: 'pending' }, { status: 'running', lease_expires_at: { $lt: now } }] },
      { $set: { status: 'running', started_at: now, heartbeat_at: now, lease_expires_at: new Date(now.getTime() + leaseMs) } },
      { new: true, sort: { created_at: 1 } },
    ).exec();
    return doc ? toAiJobRecord(doc) : null;
  }

  async skipStaleJobs(leaseMs = 600000): Promise<unknown> {
    const now = new Date();
    return this.jobModel.updateMany(
      { status: 'running', deleted_at: null, lease_expires_at: { $lt: now } },
      { $set: { status: 'skipped', finished_at: now, error: { code: 'AI_LEASE_EXPIRED', message: 'Worker giu lease khong duoc cap nhat (timeout)', retryable: true } } },
    ).exec();
  }

  async heartbeatJob(id: string, leaseMs = 600000): Promise<AiJobRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const now = new Date();
    const doc = await this.jobModel.findOneAndUpdate(
      { _id: oid(id), status: 'running', deleted_at: null },
      { $set: { heartbeat_at: now, lease_expires_at: new Date(now.getTime() + leaseMs) } },
      { new: true },
    ).exec();
    return doc ? toAiJobRecord(doc) : null;
  }

  // ---- Cell evidence ----
  async insertEvidences(docs: Partial<CellEvidenceRecord>[]): Promise<number> {
    if (docs.length === 0) return 0;
    const ops = (docs as unknown as Record<string, unknown>[]).map((d) => {
      const analysisRunId = pickStr(d.analysisRunId ?? d.analysis_run_id);
      const projectId = pickStr(d.projectId ?? d.project_id);
      const datasetId = pickStr(d.datasetId ?? d.dataset_id);
      const rowIndex = (d.rowIndex ?? d.row_index) as number;
      const persistence: Record<string, unknown> = {
        ...d,
        analysis_run_id: analysisRunId && isObjectIdHex(analysisRunId) ? oid(analysisRunId) : d.analysis_run_id,
        project_id: projectId && isObjectIdHex(projectId) ? oid(projectId) : d.project_id,
        dataset_id: datasetId && isObjectIdHex(datasetId) ? oid(datasetId) : d.dataset_id,
        column: d.column,
        row_index: rowIndex,
        kind: d.kind,
        reason: d.reason ?? null,
        value_masked: (d.valueMasked ?? d.value_masked ?? null) as unknown,
        deleted_at: null,
      };
      return { insertOne: { document: persistence } };
    });
    const res = await this.evidenceModel.bulkWrite(ops, { ordered: false });
    return res.insertedCount ?? 0;
  }

  async countEvidencesByRun(runId: string): Promise<number> {
    if (!isObjectIdHex(runId)) return 0;
    return this.evidenceModel.countDocuments({ analysis_run_id: oid(runId), deleted_at: null }).exec();
  }

  async findEvidencesByRun(runId: string, limit = 200): Promise<CellEvidenceRecord[]> {
    if (!isObjectIdHex(runId)) return [];
    const docs = await this.evidenceModel.find({ analysis_run_id: oid(runId), deleted_at: null }).sort({ column: 1, row_index: 1 }).limit(limit).exec();
    return docs.map(toCellEvidenceRecord);
  }

  // ---- Config ----
  async upsertConfig(projectId: string, workspaceId: string, doc: Record<string, unknown>): Promise<AnalysisConfigRecord> {
    const set: Record<string, unknown> = { ...doc };
    // map camel -> snake neu service moi truyen camel
    const camelMap: Record<string, string> = {
      selectedColumns: 'selected_columns', labelColumn: 'label_column', timeColumn: 'time_column',
      timeGranularity: 'time_granularity', valueColumn: 'value_column',
      correlationMethod: 'correlation_method', outlierMethod: 'outlier_method', topN: 'top_n',
    };
    for (const [camel, snake] of Object.entries(camelMap)) {
      if (set[camel] !== undefined && set[snake] === undefined) { set[snake] = set[camel]; delete set[camel]; }
    }
    if (isObjectIdHex(workspaceId)) set.workspace_id = oid(workspaceId);
    const updated = await this.configModel.findOneAndUpdate(
      { project_id: oid(projectId), deleted_at: null },
      { $set: set },
      { new: true, upsert: true },
    ).exec();
    return toAnalysisConfigRecord(updated);
  }

  async findConfigByProject(projectId: string): Promise<AnalysisConfigRecord | null> {
    if (!isObjectIdHex(projectId)) return null;
    const doc = await this.configModel.findOne({ project_id: oid(projectId), deleted_at: null }).exec();
    return doc ? toAnalysisConfigRecord(doc) : null;
  }

  // ---- Project save ----
  async createSave(doc: Partial<ProjectSaveRecord> & Record<string, unknown> & { projectId: string }): Promise<ProjectSaveRecord> {
    const raw = doc as unknown as Record<string, unknown>;
    const persistence: Record<string, unknown> = { ...raw, deleted_at: null };
    const projectId = pickStr(raw.projectId ?? raw.project_id) ?? doc.projectId;
    const workspaceId = pickStr(raw.workspaceId ?? raw.workspace_id);
    const analysisRunId = pickStr(raw.analysisRunId ?? raw.analysis_run_id);
    const analysisResultId = pickStr(raw.analysisResultId ?? raw.analysis_result_id);
    persistence.project_id = oid(projectId);
    if (workspaceId && isObjectIdHex(workspaceId)) persistence.workspace_id = oid(workspaceId);
    if (analysisRunId && isObjectIdHex(analysisRunId)) persistence.analysis_run_id = oid(analysisRunId);
    if (analysisResultId && isObjectIdHex(analysisResultId)) persistence.analysis_result_id = oid(analysisResultId);
    const inst = new this.saveModel(persistence);
    const saved = await inst.save();
    return toProjectSaveRecord(saved);
  }

  async findLatestSaveByProject(projectId: string): Promise<ProjectSaveRecord | null> {
    if (!isObjectIdHex(projectId)) return null;
    const doc = await this.saveModel.findOne({ project_id: oid(projectId), deleted_at: null }).sort({ created_at: -1 }).exec();
    return doc ? toProjectSaveRecord(doc) : null;
  }

  async markSavesStale(projectId: string, keepId: string): Promise<unknown> {
    if (!isObjectIdHex(projectId)) return { modifiedCount: 0 };
    const filter: Record<string, unknown> = { project_id: oid(projectId), deleted_at: null, is_stale: false };
    if (isObjectIdHex(keepId)) filter._id = { $ne: oid(keepId) };
    return this.saveModel.updateMany(filter, { $set: { is_stale: true } }).exec();
  }

  // ---- Report job ----
  async createReportJob(doc: Partial<ReportJobRecord> & Record<string, unknown> & { projectId: string }): Promise<ReportJobRecord> {
    const raw = doc as unknown as Record<string, unknown>;
    const persistence: Record<string, unknown> = { ...raw, deleted_at: null };
    const projectId = pickStr(raw.projectId ?? raw.project_id) ?? doc.projectId;
    const workspaceId = pickStr(raw.workspaceId ?? raw.workspace_id);
    const projectSaveId = pickStr(raw.projectSaveId ?? raw.project_save_id);
    persistence.project_id = oid(projectId);
    if (workspaceId && isObjectIdHex(workspaceId)) persistence.workspace_id = oid(workspaceId);
    if (projectSaveId && isObjectIdHex(projectSaveId)) persistence.project_save_id = oid(projectSaveId);
    else if (raw.project_save_id === null || raw.projectSaveId === null) persistence.project_save_id = null;
    const inst = new this.reportModel(persistence);
    const saved = await inst.save();
    return toReportJobRecord(saved);
  }

  async findReportById(id: string): Promise<ReportJobRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.reportModel.findOne({ _id: oid(id), deleted_at: null }).exec();
    return doc ? toReportJobRecord(doc) : null;
  }

  async updateReportById(id: string, update: Record<string, unknown>): Promise<ReportJobRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const raw = update.$set && typeof update.$set === 'object' ? update.$set as Record<string, unknown> : update;
    const set: Record<string, unknown> = { ...raw };
    if (typeof set.storageKey === 'string' && set.storage_key === undefined) { set.storage_key = set.storageKey; delete set.storageKey; }
    if (typeof set.fileSizeBytes === 'number' && set.file_size_bytes === undefined) { set.file_size_bytes = set.fileSizeBytes; delete set.fileSizeBytes; }
    const doc = await this.reportModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
    return doc ? toReportJobRecord(doc) : null;
  }

  async claimPendingReport(): Promise<ReportJobRecord | null> {
    const doc = await this.reportModel.findOneAndUpdate(
      { status: 'pending', deleted_at: null },
      { $set: { status: 'running' } },
      { new: true, sort: { created_at: 1 } },
    ).exec();
    return doc ? toReportJobRecord(doc) : null;
  }

  // ---- Few-shot ----
  async saveFewShotExample(doc: Partial<FewShotExampleRecord> & Record<string, unknown>): Promise<FewShotExampleRecord> {
    const raw = doc as unknown as Record<string, unknown>;
    const persistence: Record<string, unknown> = { ...raw, deleted_at: null };
    const ws = pickStr(raw.workspaceId ?? raw.workspace_id);
    const proj = pickStr(raw.projectId ?? raw.project_id);
    if (ws && isObjectIdHex(ws)) persistence.workspace_id = oid(ws);
    if (proj && isObjectIdHex(proj)) persistence.project_id = oid(proj);
    if (raw.errorType !== undefined) persistence.error_type = raw.errorType;
    if (raw.columnTraits !== undefined) persistence.column_traits = raw.columnTraits;
    if (raw.trustScore !== undefined) persistence.trust_score = raw.trustScore;
    if (raw.agreementCount !== undefined) persistence.agreement_count = raw.agreementCount;
    const inst = new this.fewShotModel(persistence);
    const saved = await inst.save();
    await this.enforceFewShotCap();
    return toFewShotRecord(saved);
  }

  async enforceFewShotCap(cap = MAX_FEW_SHOT_STORE): Promise<number> {
    const total = await this.fewShotModel.countDocuments({ deleted_at: null });
    const excess = total - cap;
    if (excess <= 0) return 0;
    const oldest = await this.fewShotModel.find({ deleted_at: null }).sort({ created_at: 1 }).limit(excess).select('_id').lean().exec();
    if (oldest.length === 0) return 0;
    const ids = oldest.map((d) => d._id);
    const res = await this.fewShotModel.updateMany({ _id: { $in: ids } }, { $set: { deleted_at: new Date() } }).exec();
    return res.modifiedCount ?? 0;
  }

  async findFewShotCandidates(params: { workspaceId: string; errorType?: string; language?: string; minTrustScore: number; maxAgeDays: number; limit: number }): Promise<FewShotExampleRecord[]> {
    if (!isObjectIdHex(params.workspaceId)) return [];
    const cutoff = new Date(Date.now() - params.maxAgeDays * 24 * 60 * 60 * 1000);
    const filter: Record<string, unknown> = {
      workspace_id: oid(params.workspaceId),
      deleted_at: null,
      trust_score: { $gte: params.minTrustScore },
      created_at: { $gte: cutoff },
    };
    if (params.errorType) filter.error_type = params.errorType;
    if (params.language) filter.language = params.language;
    const docs = await this.fewShotModel
      .find(filter as unknown as Parameters<typeof this.fewShotModel.find>[0])
      .sort({ trust_score: -1, created_at: -1 })
      .limit(params.limit)
      .exec();
    return docs.map(toFewShotRecord);
  }

  async findDuplicateExample(params: { workspaceId: string; errorType: string; description: string; label: string }): Promise<FewShotExampleRecord | null> {
    if (!isObjectIdHex(params.workspaceId)) return null;
    const doc = await this.fewShotModel.findOne({
      workspace_id: oid(params.workspaceId),
      error_type: params.errorType,
      description: params.description,
      label: params.label,
      deleted_at: null,
    } as unknown as Record<string, unknown>).exec();
    return doc ? toFewShotRecord(doc as unknown as IFewShotExample) : null;
  }

  async updateFewShotTrust(id: string, update: { agreementCount: number; trustScore: number; embedding: number[] }): Promise<FewShotExampleRecord | null> {
    if (!isObjectIdHex(id)) return null;
    const doc = await this.fewShotModel.findOneAndUpdate(
      { _id: oid(id), deleted_at: null },
      { $set: { agreement_count: update.agreementCount, trust_score: update.trustScore, embedding: update.embedding } },
      { new: true },
    ).exec();
    return doc ? toFewShotRecord(doc as unknown as IFewShotExample) : null;
  }

  async countFewShotExamples(workspaceId: string): Promise<number> {
    if (!isObjectIdHex(workspaceId)) return 0;
    return this.fewShotModel.countDocuments({ workspace_id: oid(workspaceId), deleted_at: null }).exec();
  }
}

