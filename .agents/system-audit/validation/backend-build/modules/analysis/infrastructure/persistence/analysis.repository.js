"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisRepository = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const rag_few_shot_util_1 = require("../../domain/rag-few-shot.util");
const analysis_mapper_1 = require("./analysis.mapper");
const object_id_util_1 = require("../../../../shared/utils/object-id.util");
function oid(id) {
    return new mongoose_2.Types.ObjectId(id);
}
function pickStr(v) {
    if (typeof v === 'string' && v.length > 0)
        return v;
    if (v instanceof mongoose_2.Types.ObjectId)
        return v.toString();
    return null;
}
function getBoth(obj, camel, snake) {
    if (obj[camel] !== undefined)
        return obj[camel];
    return obj[snake];
}
function toRunSet(update) {
    const src = update.$set && typeof update.$set === 'object'
        ? update.$set
        : update;
    const map = {
        projectId: 'project_id', workspaceId: 'workspace_id', datasetId: 'dataset_id',
        inputFingerprint: 'input_fingerprint', startedBy: 'started_by', startedAt: 'started_at',
        finishedAt: 'finished_at', durationMs: 'duration_ms',
    };
    const set = {};
    for (const [k, v] of Object.entries(src)) {
        if (['id', '_id', 'createdAt', 'updatedAt'].includes(k))
            continue;
        if (map[k]) {
            if ((k === 'startedBy' || k === 'projectId' || k === 'workspaceId' || k === 'datasetId') && typeof v === 'string' && (0, object_id_util_1.isObjectIdHex)(v)) {
                set[map[k]] = oid(v);
            }
            else if (k === 'startedBy' && v === null)
                set[map[k]] = null;
            else
                set[map[k]] = v;
        }
        else {
            set[k] = v;
        }
    }
    for (const k of ['project_id', 'workspace_id', 'dataset_id', 'started_by']) {
        const v = set[k];
        if (typeof v === 'string' && (0, object_id_util_1.isObjectIdHex)(v))
            set[k] = oid(v);
    }
    return set;
}
let AnalysisRepository = class AnalysisRepository {
    runModel;
    resultModel;
    jobModel;
    fewShotModel;
    evidenceModel;
    saveModel;
    reportModel;
    configModel;
    constructor(runModel, resultModel, jobModel, fewShotModel, evidenceModel, saveModel, reportModel, configModel) {
        this.runModel = runModel;
        this.resultModel = resultModel;
        this.jobModel = jobModel;
        this.fewShotModel = fewShotModel;
        this.evidenceModel = evidenceModel;
        this.saveModel = saveModel;
        this.reportModel = reportModel;
        this.configModel = configModel;
    }
    async create(data) {
        const raw = data;
        const projectId = pickStr(raw.projectId ?? raw.project_id) ?? data.projectId;
        const workspaceId = pickStr(raw.workspaceId ?? raw.workspace_id) ?? data.workspaceId;
        const datasetId = pickStr(raw.datasetId ?? raw.dataset_id) ?? data.datasetId;
        const persisted = (0, analysis_mapper_1.toAnalysisRunPersistence)({
            projectId, workspaceId, datasetId,
            status: getBoth(raw, 'status', 'status') ?? 'running',
            inputFingerprint: String(getBoth(raw, 'inputFingerprint', 'input_fingerprint') ?? ''),
            config: getBoth(raw, 'config', 'config') ?? {},
            startedBy: pickStr(getBoth(raw, 'startedBy', 'started_by')),
            startedAt: getBoth(raw, 'startedAt', 'started_at') ?? null,
        });
        const extra = {};
        for (const [k, v] of Object.entries(raw)) {
            if (!(k in persisted) && !['projectId', 'workspaceId', 'datasetId', 'inputFingerprint', 'startedBy', 'startedAt', 'project_id', 'workspace_id', 'dataset_id', 'input_fingerprint', 'started_by', 'started_at'].includes(k)) {
                extra[k] = v;
            }
        }
        const inst = new this.runModel({ ...persisted, ...extra, deleted_at: null });
        const saved = await inst.save();
        return (0, analysis_mapper_1.toAnalysisRunRecord)(saved);
    }
    async findById(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.runModel.findOne({ _id: oid(id), deleted_at: null }).exec();
        return doc ? (0, analysis_mapper_1.toAnalysisRunRecord)(doc) : null;
    }
    async updateById(id, update) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const set = toRunSet(update);
        const doc = await this.runModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
        return doc ? (0, analysis_mapper_1.toAnalysisRunRecord)(doc) : null;
    }
    async findRunByFingerprint(fingerprint) {
        const doc = await this.runModel.findOne({ input_fingerprint: fingerprint, deleted_at: null, status: 'succeeded' }).sort({ created_at: -1 }).exec();
        return doc ? (0, analysis_mapper_1.toAnalysisRunRecord)(doc) : null;
    }
    async findLatestRunByProject(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return null;
        const doc = await this.runModel.findOne({ project_id: oid(projectId), deleted_at: null }).sort({ created_at: -1 }).exec();
        return doc ? (0, analysis_mapper_1.toAnalysisRunRecord)(doc) : null;
    }
    async saveResult(doc) {
        const raw = doc;
        const analysisRunId = pickStr(getBoth(raw, 'analysisRunId', 'analysis_run_id')) ?? '';
        const projectId = pickStr(getBoth(raw, 'projectId', 'project_id')) ?? '';
        const datasetId = pickStr(getBoth(raw, 'datasetId', 'dataset_id')) ?? '';
        const persistence = { ...raw, deleted_at: null };
        if ((0, object_id_util_1.isObjectIdHex)(analysisRunId))
            persistence.analysis_run_id = oid(analysisRunId);
        if ((0, object_id_util_1.isObjectIdHex)(projectId))
            persistence.project_id = oid(projectId);
        if ((0, object_id_util_1.isObjectIdHex)(datasetId))
            persistence.dataset_id = oid(datasetId);
        const inst = new this.resultModel(persistence);
        const saved = await inst.save();
        return (0, analysis_mapper_1.toAnalysisResultRecord)(saved);
    }
    async findResultByRun(runId) {
        if (!(0, object_id_util_1.isObjectIdHex)(runId))
            return null;
        const doc = await this.resultModel.findOne({ analysis_run_id: oid(runId), deleted_at: null }).exec();
        return doc ? (0, analysis_mapper_1.toAnalysisResultRecord)(doc) : null;
    }
    async updateResultById(id, update) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const set = update.$set && typeof update.$set === 'object'
            ? update.$set
            : update;
        const doc = await this.resultModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
        return doc ? (0, analysis_mapper_1.toAnalysisResultRecord)(doc) : null;
    }
    async markResultsStale(projectId, keepRunId, reason) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return { modifiedCount: 0 };
        const filter = { project_id: oid(projectId), deleted_at: null, is_stale: false };
        if ((0, object_id_util_1.isObjectIdHex)(keepRunId))
            filter.analysis_run_id = { $ne: oid(keepRunId) };
        return this.resultModel.updateMany(filter, { $set: { is_stale: true, stale_reason: reason } }).exec();
    }
    async createJob(doc) {
        const raw = doc;
        const persistence = { ...raw, deleted_at: null };
        for (const [camel, snake] of [['analysisRunId', 'analysis_run_id'], ['projectId', 'project_id'], ['datasetId', 'dataset_id'], ['inputFingerprint', 'input_fingerprint'], ['modelId', 'model_id'], ['promptVersion', 'prompt_version']]) {
            const v = raw[camel];
            if (v !== undefined)
                persistence[snake] = v;
        }
        for (const k of ['analysis_run_id', 'project_id', 'dataset_id']) {
            const v = persistence[k];
            if (typeof v === 'string' && (0, object_id_util_1.isObjectIdHex)(v))
                persistence[k] = oid(v);
        }
        const inst = new this.jobModel(persistence);
        const saved = await inst.save();
        return (0, analysis_mapper_1.toAiJobRecord)(saved);
    }
    async findJobById(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.jobModel.findOne({ _id: oid(id), deleted_at: null }).exec();
        return doc ? (0, analysis_mapper_1.toAiJobRecord)(doc) : null;
    }
    async updateJobById(id, update) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const set = update.$set && typeof update.$set === 'object'
            ? update.$set
            : update;
        const doc = await this.jobModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
        return doc ? (0, analysis_mapper_1.toAiJobRecord)(doc) : null;
    }
    async claimPendingJob(leaseMs = 600000) {
        const now = new Date();
        const doc = await this.jobModel.findOneAndUpdate({ deleted_at: null, $or: [{ status: 'pending' }, { status: 'running', lease_expires_at: { $lt: now } }] }, { $set: { status: 'running', started_at: now, heartbeat_at: now, lease_expires_at: new Date(now.getTime() + leaseMs) } }, { new: true, sort: { created_at: 1 } }).exec();
        return doc ? (0, analysis_mapper_1.toAiJobRecord)(doc) : null;
    }
    async skipStaleJobs(leaseMs = 600000) {
        const now = new Date();
        return this.jobModel.updateMany({ status: 'running', deleted_at: null, lease_expires_at: { $lt: now } }, { $set: { status: 'skipped', finished_at: now, error: { code: 'AI_LEASE_EXPIRED', message: 'Worker giu lease khong duoc cap nhat (timeout)', retryable: true } } }).exec();
    }
    async heartbeatJob(id, leaseMs = 600000) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const now = new Date();
        const doc = await this.jobModel.findOneAndUpdate({ _id: oid(id), status: 'running', deleted_at: null }, { $set: { heartbeat_at: now, lease_expires_at: new Date(now.getTime() + leaseMs) } }, { new: true }).exec();
        return doc ? (0, analysis_mapper_1.toAiJobRecord)(doc) : null;
    }
    async insertEvidences(docs) {
        if (docs.length === 0)
            return 0;
        const ops = docs.map((d) => {
            const analysisRunId = pickStr(d.analysisRunId ?? d.analysis_run_id);
            const projectId = pickStr(d.projectId ?? d.project_id);
            const datasetId = pickStr(d.datasetId ?? d.dataset_id);
            const rowIndex = (d.rowIndex ?? d.row_index);
            const persistence = {
                ...d,
                analysis_run_id: analysisRunId && (0, object_id_util_1.isObjectIdHex)(analysisRunId) ? oid(analysisRunId) : d.analysis_run_id,
                project_id: projectId && (0, object_id_util_1.isObjectIdHex)(projectId) ? oid(projectId) : d.project_id,
                dataset_id: datasetId && (0, object_id_util_1.isObjectIdHex)(datasetId) ? oid(datasetId) : d.dataset_id,
                column: d.column,
                row_index: rowIndex,
                kind: d.kind,
                reason: d.reason ?? null,
                value_masked: (d.valueMasked ?? d.value_masked ?? null),
                deleted_at: null,
            };
            return { insertOne: { document: persistence } };
        });
        const res = await this.evidenceModel.bulkWrite(ops, { ordered: false });
        return res.insertedCount ?? 0;
    }
    async countEvidencesByRun(runId) {
        if (!(0, object_id_util_1.isObjectIdHex)(runId))
            return 0;
        return this.evidenceModel.countDocuments({ analysis_run_id: oid(runId), deleted_at: null }).exec();
    }
    async findEvidencesByRun(runId, limit = 200) {
        if (!(0, object_id_util_1.isObjectIdHex)(runId))
            return [];
        const docs = await this.evidenceModel.find({ analysis_run_id: oid(runId), deleted_at: null }).sort({ column: 1, row_index: 1 }).limit(limit).exec();
        return docs.map(analysis_mapper_1.toCellEvidenceRecord);
    }
    async upsertConfig(projectId, workspaceId, doc) {
        const set = { ...doc };
        const camelMap = {
            selectedColumns: 'selected_columns', labelColumn: 'label_column', timeColumn: 'time_column',
            timeGranularity: 'time_granularity', valueColumn: 'value_column',
            correlationMethod: 'correlation_method', outlierMethod: 'outlier_method', topN: 'top_n',
        };
        for (const [camel, snake] of Object.entries(camelMap)) {
            if (set[camel] !== undefined && set[snake] === undefined) {
                set[snake] = set[camel];
                delete set[camel];
            }
        }
        if ((0, object_id_util_1.isObjectIdHex)(workspaceId))
            set.workspace_id = oid(workspaceId);
        const updated = await this.configModel.findOneAndUpdate({ project_id: oid(projectId), deleted_at: null }, { $set: set }, { new: true, upsert: true }).exec();
        return (0, analysis_mapper_1.toAnalysisConfigRecord)(updated);
    }
    async findConfigByProject(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return null;
        const doc = await this.configModel.findOne({ project_id: oid(projectId), deleted_at: null }).exec();
        return doc ? (0, analysis_mapper_1.toAnalysisConfigRecord)(doc) : null;
    }
    async createSave(doc) {
        const raw = doc;
        const persistence = { ...raw, deleted_at: null };
        const projectId = pickStr(raw.projectId ?? raw.project_id) ?? doc.projectId;
        const workspaceId = pickStr(raw.workspaceId ?? raw.workspace_id);
        const analysisRunId = pickStr(raw.analysisRunId ?? raw.analysis_run_id);
        const analysisResultId = pickStr(raw.analysisResultId ?? raw.analysis_result_id);
        persistence.project_id = oid(projectId);
        if (workspaceId && (0, object_id_util_1.isObjectIdHex)(workspaceId))
            persistence.workspace_id = oid(workspaceId);
        if (analysisRunId && (0, object_id_util_1.isObjectIdHex)(analysisRunId))
            persistence.analysis_run_id = oid(analysisRunId);
        if (analysisResultId && (0, object_id_util_1.isObjectIdHex)(analysisResultId))
            persistence.analysis_result_id = oid(analysisResultId);
        const inst = new this.saveModel(persistence);
        const saved = await inst.save();
        return (0, analysis_mapper_1.toProjectSaveRecord)(saved);
    }
    async findLatestSaveByProject(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return null;
        const doc = await this.saveModel.findOne({ project_id: oid(projectId), deleted_at: null }).sort({ created_at: -1 }).exec();
        return doc ? (0, analysis_mapper_1.toProjectSaveRecord)(doc) : null;
    }
    async markSavesStale(projectId, keepId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            return { modifiedCount: 0 };
        const filter = { project_id: oid(projectId), deleted_at: null, is_stale: false };
        if ((0, object_id_util_1.isObjectIdHex)(keepId))
            filter._id = { $ne: oid(keepId) };
        return this.saveModel.updateMany(filter, { $set: { is_stale: true } }).exec();
    }
    async createReportJob(doc) {
        const raw = doc;
        const persistence = { ...raw, deleted_at: null };
        const projectId = pickStr(raw.projectId ?? raw.project_id) ?? doc.projectId;
        const workspaceId = pickStr(raw.workspaceId ?? raw.workspace_id);
        const projectSaveId = pickStr(raw.projectSaveId ?? raw.project_save_id);
        persistence.project_id = oid(projectId);
        if (workspaceId && (0, object_id_util_1.isObjectIdHex)(workspaceId))
            persistence.workspace_id = oid(workspaceId);
        if (projectSaveId && (0, object_id_util_1.isObjectIdHex)(projectSaveId))
            persistence.project_save_id = oid(projectSaveId);
        else if (raw.project_save_id === null || raw.projectSaveId === null)
            persistence.project_save_id = null;
        const inst = new this.reportModel(persistence);
        const saved = await inst.save();
        return (0, analysis_mapper_1.toReportJobRecord)(saved);
    }
    async findReportById(id) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.reportModel.findOne({ _id: oid(id), deleted_at: null }).exec();
        return doc ? (0, analysis_mapper_1.toReportJobRecord)(doc) : null;
    }
    async updateReportById(id, update) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const raw = update.$set && typeof update.$set === 'object' ? update.$set : update;
        const set = { ...raw };
        if (typeof set.storageKey === 'string' && set.storage_key === undefined) {
            set.storage_key = set.storageKey;
            delete set.storageKey;
        }
        if (typeof set.fileSizeBytes === 'number' && set.file_size_bytes === undefined) {
            set.file_size_bytes = set.fileSizeBytes;
            delete set.fileSizeBytes;
        }
        const doc = await this.reportModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: set }, { new: true }).exec();
        return doc ? (0, analysis_mapper_1.toReportJobRecord)(doc) : null;
    }
    async claimPendingReport() {
        const doc = await this.reportModel.findOneAndUpdate({ status: 'pending', deleted_at: null }, { $set: { status: 'running' } }, { new: true, sort: { created_at: 1 } }).exec();
        return doc ? (0, analysis_mapper_1.toReportJobRecord)(doc) : null;
    }
    async saveFewShotExample(doc) {
        const raw = doc;
        const persistence = { ...raw, deleted_at: null };
        const ws = pickStr(raw.workspaceId ?? raw.workspace_id);
        const proj = pickStr(raw.projectId ?? raw.project_id);
        if (ws && (0, object_id_util_1.isObjectIdHex)(ws))
            persistence.workspace_id = oid(ws);
        if (proj && (0, object_id_util_1.isObjectIdHex)(proj))
            persistence.project_id = oid(proj);
        if (raw.errorType !== undefined)
            persistence.error_type = raw.errorType;
        if (raw.columnTraits !== undefined)
            persistence.column_traits = raw.columnTraits;
        if (raw.trustScore !== undefined)
            persistence.trust_score = raw.trustScore;
        if (raw.agreementCount !== undefined)
            persistence.agreement_count = raw.agreementCount;
        const inst = new this.fewShotModel(persistence);
        const saved = await inst.save();
        await this.enforceFewShotCap();
        return (0, analysis_mapper_1.toFewShotRecord)(saved);
    }
    async enforceFewShotCap(cap = rag_few_shot_util_1.MAX_FEW_SHOT_STORE) {
        const total = await this.fewShotModel.countDocuments({ deleted_at: null });
        const excess = total - cap;
        if (excess <= 0)
            return 0;
        const oldest = await this.fewShotModel.find({ deleted_at: null }).sort({ created_at: 1 }).limit(excess).select('_id').lean().exec();
        if (oldest.length === 0)
            return 0;
        const ids = oldest.map((d) => d._id);
        const res = await this.fewShotModel.updateMany({ _id: { $in: ids } }, { $set: { deleted_at: new Date() } }).exec();
        return res.modifiedCount ?? 0;
    }
    async findFewShotCandidates(params) {
        if (!(0, object_id_util_1.isObjectIdHex)(params.workspaceId))
            return [];
        const cutoff = new Date(Date.now() - params.maxAgeDays * 24 * 60 * 60 * 1000);
        const filter = {
            workspace_id: oid(params.workspaceId),
            deleted_at: null,
            trust_score: { $gte: params.minTrustScore },
            created_at: { $gte: cutoff },
        };
        if (params.errorType)
            filter.error_type = params.errorType;
        if (params.language)
            filter.language = params.language;
        const docs = await this.fewShotModel
            .find(filter)
            .sort({ trust_score: -1, created_at: -1 })
            .limit(params.limit)
            .exec();
        return docs.map(analysis_mapper_1.toFewShotRecord);
    }
    async findDuplicateExample(params) {
        if (!(0, object_id_util_1.isObjectIdHex)(params.workspaceId))
            return null;
        const doc = await this.fewShotModel.findOne({
            workspace_id: oid(params.workspaceId),
            error_type: params.errorType,
            description: params.description,
            label: params.label,
            deleted_at: null,
        }).exec();
        return doc ? (0, analysis_mapper_1.toFewShotRecord)(doc) : null;
    }
    async updateFewShotTrust(id, update) {
        if (!(0, object_id_util_1.isObjectIdHex)(id))
            return null;
        const doc = await this.fewShotModel.findOneAndUpdate({ _id: oid(id), deleted_at: null }, { $set: { agreement_count: update.agreementCount, trust_score: update.trustScore, embedding: update.embedding } }, { new: true }).exec();
        return doc ? (0, analysis_mapper_1.toFewShotRecord)(doc) : null;
    }
    async countFewShotExamples(workspaceId) {
        if (!(0, object_id_util_1.isObjectIdHex)(workspaceId))
            return 0;
        return this.fewShotModel.countDocuments({ workspace_id: oid(workspaceId), deleted_at: null }).exec();
    }
};
exports.AnalysisRepository = AnalysisRepository;
exports.AnalysisRepository = AnalysisRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('AnalysisRun')),
    __param(1, (0, mongoose_1.InjectModel)('AnalysisResult')),
    __param(2, (0, mongoose_1.InjectModel)('AiJob')),
    __param(3, (0, mongoose_1.InjectModel)('FewShotExample')),
    __param(4, (0, mongoose_1.InjectModel)('CellEvidence')),
    __param(5, (0, mongoose_1.InjectModel)('ProjectSave')),
    __param(6, (0, mongoose_1.InjectModel)('ReportJob')),
    __param(7, (0, mongoose_1.InjectModel)('AnalysisConfig')),
    __metadata("design:paramtypes", [mongoose_2.Model, mongoose_2.Model, mongoose_2.Model, mongoose_2.Model, mongoose_2.Model, mongoose_2.Model, mongoose_2.Model, mongoose_2.Model])
], AnalysisRepository);
//# sourceMappingURL=analysis.repository.js.map