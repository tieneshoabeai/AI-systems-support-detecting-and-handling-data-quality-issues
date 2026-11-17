"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AnalysisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisService = void 0;
const common_1 = require("@nestjs/common");
const crypto = __importStar(require("crypto"));
const realtime_port_1 = require("../../realtime/domain/ports/realtime.port");
const analysis_repository_port_1 = require("../domain/ports/analysis.repository.port");
const projects_service_1 = require("../../projects/application/projects.service");
const dataset_repository_port_1 = require("../../datasets/domain/ports/dataset.repository.port");
const record_query_port_1 = require("../../data-view/domain/ports/record-query.port");
const object_id_util_1 = require("../../../shared/utils/object-id.util");
const correlation_util_1 = require("../domain/correlation.util");
const vif_util_1 = require("../domain/vif.util");
const ai_grounding_util_1 = require("../domain/ai-grounding.util");
const config_1 = require("@nestjs/config");
const rag_few_shot_service_1 = require("./services/rag-few-shot.service");
const pii_mask_util_1 = require("../domain/pii-mask.util");
const dq_util_1 = require("../domain/dq.util");
const stats_util_1 = require("../domain/stats.util");
const correlation_util_2 = require("../domain/correlation.util");
function maskSampleValue(value, columnMarkedPII) {
    const res = (0, pii_mask_util_1.maskCell)(value, columnMarkedPII);
    if (res.dropped)
        return null;
    if (res.value !== null)
        return res.value;
    return 'null';
}
let AnalysisService = AnalysisService_1 = class AnalysisService {
    analysisRepository;
    projectsService;
    datasetsRepository;
    records;
    configService;
    realtime;
    ragFewShot;
    logger = new common_1.Logger(AnalysisService_1.name);
    constructor(analysisRepository, projectsService, datasetsRepository, records, configService, realtime, ragFewShot) {
        this.analysisRepository = analysisRepository;
        this.projectsService = projectsService;
        this.datasetsRepository = datasetsRepository;
        this.records = records;
        this.configService = configService;
        this.realtime = realtime;
        this.ragFewShot = ragFewShot;
    }
    fingerprint(parts) {
        return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
    }
    async runAnalysis(projectId, dto, userId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId)) {
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        }
        const project = await this.projectsService.getProjectById(projectId);
        const dataset = await this.datasetsRepository.findByProject(projectId);
        if (!dataset) {
            throw new common_1.NotFoundException('Project chưa có dataset để phân tích');
        }
        const stored = await this.analysisRepository.findConfigByProject(projectId).catch(() => null);
        const cfgSelected = stored?.selectedColumns ?? null;
        const cfgLabel = stored?.labelColumn ?? null;
        const cfgTime = stored?.timeColumn ?? null;
        const cfgGranularity = stored?.timeGranularity ?? 'day';
        const cfgValue = stored?.valueColumn ?? null;
        const allInferable = dataset.columns.filter((c) => (0, correlation_util_1.classifyColumn)(c.dataType) !== 'excluded');
        const byKey = new Map(dataset.columns.map((c) => [c.key, c.name]));
        const known = new Set(dataset.columns.map((c) => c.name));
        const knownOriginal = new Map(dataset.columns.map((c) => [c.originalName, c.name]));
        let selectedKeys;
        const requestedCols = dto.selected_columns && dto.selected_columns.length > 0 ? dto.selected_columns : cfgSelected;
        if (requestedCols && requestedCols.length > 0) {
            selectedKeys = requestedCols
                .map((k) => (known.has(k) ? k : (byKey.get(k) ?? knownOriginal.get(k) ?? k)))
                .filter((k) => known.has(k));
            if (selectedKeys.length === 0) {
                throw new common_1.BadRequestException('selected_columns không khớp cột nào của dataset');
            }
        }
        else {
            selectedKeys = allInferable.map((c) => c.name);
        }
        if (selectedKeys.length === 0) {
            throw new common_1.BadRequestException('Không có cột suy luận được để phân tích (toàn bộ là date/không hỗ trợ)');
        }
        const colTypeByName = new Map(dataset.columns.map((c) => [c.name, c.dataType]));
        const labelColumn = cfgLabel && known.has(cfgLabel) ? cfgLabel : null;
        const labelDataType = labelColumn ? (colTypeByName.get(labelColumn) ?? null) : null;
        let timeColumn = null;
        if (cfgTime && known.has(cfgTime) && colTypeByName.get(cfgTime) === 'date')
            timeColumn = cfgTime;
        else {
            const dateCols = dataset.columns.filter((c) => c.dataType === 'date').map((c) => c.name);
            if (dateCols.length === 1)
                timeColumn = dateCols[0];
        }
        const valueColumn = cfgValue && known.has(cfgValue) && colTypeByName.get(cfgValue) === 'number' ? cfgValue : null;
        const config = {
            selected_column_keys: selectedKeys,
            correlation_method: dto.correlation_method,
            outlier_method: dto.outlier_method,
            top_n: dto.top_n,
            label_column: labelColumn,
            time_column: timeColumn,
            time_granularity: cfgGranularity,
            value_column: valueColumn,
        };
        const fp = this.fingerprint({
            dataset_id: dataset.id,
            file_checksum: dataset.fileChecksum,
            row_count: dataset.rowCount,
            config,
        });
        const startedAt = new Date();
        const run = await this.analysisRepository.create({
            projectId: project.id,
            workspaceId: project.workspaceId,
            datasetId: dataset.id,
            status: 'running',
            inputFingerprint: fp,
            config: config,
            startedBy: userId && (0, object_id_util_1.isObjectIdHex)(userId) ? userId : null,
            startedAt: startedAt,
        });
        try {
            const recordRows = await this.records.listAllRecords(dataset.id);
            const records = recordRows.map((r) => ({ row_index: r.rowIndex, props: r.props }));
            const keyToName = new Map((dataset?.columns ?? []).map((c) => [c.key, c.name]));
            const rows = records.map((r) => {
                const legacy = r;
                const props = (legacy.props ?? legacy.data ?? {});
                const named = {};
                for (const [k, v] of Object.entries(props))
                    named[keyToName.get(k) ?? k] = v;
                return named;
            });
            const analyzable = selectedKeys.map((key) => {
                const col = dataset.columns.find((c) => c.name === key);
                const role = (0, correlation_util_1.classifyColumn)(col?.dataType ?? 'string');
                return {
                    key,
                    role,
                    reason: role === 'excluded'
                        ? col?.dataType === 'date'
                            ? 'date_column_excluded_from_correlation_vif'
                            : `unsupported_data_type_${col?.dataType ?? 'unknown'}`
                        : null,
                };
            });
            const { cells, notes } = (0, correlation_util_1.buildCorrelationMatrix)(analyzable, rows, dto.correlation_method);
            const numericCols = analyzable.filter((c) => c.role === 'numeric').map((c) => c.key);
            const vifComp = (0, vif_util_1.computeVif)(numericCols, rows);
            const piiColumnKeys = new Set(dataset.columns.filter((c) => c.isPii).map((c) => c.name));
            const maskedSamples = {};
            for (const col of analyzable) {
                if (col.role === 'excluded')
                    continue;
                const samples = [];
                const markedPii = piiColumnKeys.has(col.key);
                for (const row of rows) {
                    if (samples.length >= 20)
                        break;
                    const v = row[col.key];
                    if (v === null || v === undefined || v === '')
                        continue;
                    const masked = maskSampleValue(v, markedPii);
                    if (masked === null)
                        continue;
                    samples.push(masked);
                }
                maskedSamples[col.key] = samples;
            }
            const usedPerColumn = new Map();
            for (const col of analyzable) {
                let used = 0;
                for (const row of rows) {
                    const v = row[col.key];
                    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === ''))
                        continue;
                    used++;
                }
                usedPerColumn.set(col.key, { used, excluded: rows.length - used });
            }
            const rowWrappers = records.map((r, i) => {
                const legacy = r;
                const props = (legacy.props ?? legacy.data ?? {});
                const named = {};
                for (const [k, v] of Object.entries(props))
                    named[keyToName.get(k) ?? k] = v;
                return { rowIndex: typeof legacy.row_index === 'number' ? legacy.row_index : i, values: named };
            });
            const dqBase = (0, dq_util_1.computeDq0102)(selectedKeys, rowWrappers);
            const dq03Rows = (0, dq_util_1.computeDq03)(selectedKeys.map((c) => ({ column: c, dataType: colTypeByName.get(c) ?? 'string' })), rowWrappers);
            const dq03ByCol = new Map(dq03Rows.map((r) => [r.column, r]));
            const outlierByCol = new Map();
            for (const key of selectedKeys) {
                if (colTypeByName.get(key) !== 'number')
                    continue;
                const vals = [];
                for (const w of rowWrappers) {
                    const v = w.values[key];
                    if ((0, dq_util_1.isMissingCell)(v))
                        continue;
                    const chk = (0, dq_util_1.isValidByType)(v, 'number');
                    if (!chk.valid)
                        continue;
                    const n = (0, correlation_util_2.toFiniteNumber)(v);
                    if (n !== null)
                        vals.push({ rowIndex: w.rowIndex, value: n });
                }
                const out = (0, dq_util_1.detectOutliers)(key, vals, dto.outlier_method);
                outlierByCol.set(key, { union: out.union, method: dto.outlier_method, reason: out.reason });
            }
            const dqColumns = dqBase.columns.map((c) => {
                const inv = dq03ByCol.get(c.column);
                const out = outlierByCol.get(c.column);
                const outlierCount = out ? out.union.length : 0;
                return {
                    ...c,
                    invalidCount: inv?.invalidCount ?? 0,
                    invalidRate: inv?.invalidRate ?? null,
                    outlierCount,
                    outlierRate: rowWrappers.length > 0 ? Number((outlierCount / rowWrappers.length).toFixed(4)) : null,
                    method: out ? `dq01_dq03_${out.method}` : c.method,
                    reason: out?.reason ?? c.reason,
                };
            });
            const dqSummary = {
                totalScanned: rowWrappers.length,
                columns: dqColumns,
                duplicateGroups: dqBase.duplicateGroups,
                duplicateRowCount: dqBase.duplicateRowCount,
                fullyMissingRows: dqBase.fullyMissingRows,
                partiallyMissingRows: dqBase.partiallyMissingRows,
                notes: [
                    'DQ-01: thieu = null/undefined/chuoi rong; 0/false/NA/null-chuoi khong phai thieu',
                    'DQ-02: so khop chinh xac tren toan bo cot duoc chon; dong thieu toan bo khong gom nhom',
                    'DQ-05 giu unassessed khi chua co quy tac duoc xac nhan; khong suy quy tac tu tuong quan/VIF/AI',
                    ...(dqBase.fullyMissingRows === rowWrappers.length && rowWrappers.length > 0 ? ['toan bo dong thieu tren cac cot duoc chon'] : []),
                ],
            };
            const descriptive = selectedKeys.map((c) => (0, stats_util_1.describeColumn)(c, colTypeByName.get(c) ?? 'string', rowWrappers.map((w) => w.values[c])));
            const imbalance = (0, stats_util_1.evaluateImbalance)(labelColumn, labelDataType, rows);
            const timeAnalysis = (0, stats_util_1.analyzeTime)(timeColumn, valueColumn, rows, cfgGranularity);
            const evidenceDocs = [];
            const perColCount = new Map();
            const pushEv = (column, rowIndex, kind, reason, raw) => {
                const used = perColCount.get(column) ?? 0;
                if (used >= 20)
                    return;
                perColCount.set(column, used + 1);
                const isPii = piiColumnKeys.has(column);
                let masked = null;
                if (kind === 'missing')
                    masked = null;
                else {
                    const mv = maskSampleValue(raw, isPii);
                    masked = mv ?? '***';
                }
                evidenceDocs.push({
                    analysis_run_id: run.id,
                    project_id: project.id,
                    dataset_id: dataset.id,
                    column,
                    row_index: rowIndex,
                    kind,
                    reason,
                    value_masked: masked,
                });
            };
            const rowIndexByPos = new Map(rowWrappers.map((w, i) => [i, w.rowIndex]));
            void rowIndexByPos;
            for (const c of selectedKeys) {
                let n = 0;
                for (const w of rowWrappers) {
                    if (n >= 20)
                        break;
                    if ((0, dq_util_1.isMissingCell)(w.values[c])) {
                        pushEv(c, w.rowIndex, 'missing', 'dq01_missing', null);
                        n++;
                    }
                }
            }
            for (const r of dq03Rows) {
                void r;
            }
            for (const c of selectedKeys) {
                let n = 0;
                for (const w of rowWrappers) {
                    if (n >= 20)
                        break;
                    const v = w.values[c];
                    if ((0, dq_util_1.isMissingCell)(v))
                        continue;
                    const chk = (0, dq_util_1.isValidByType)(v, colTypeByName.get(c) ?? 'string');
                    if (!chk.valid) {
                        pushEv(c, w.rowIndex, 'invalid_type', chk.reason, v);
                        n++;
                    }
                }
            }
            let dupPushed = 0;
            for (const g of dqBase.duplicateGroups) {
                if (dupPushed >= 20)
                    break;
                for (let k = 1; k < g.rowIndexes.length && dupPushed < 20; k++) {
                    pushEv('__row__', g.rowIndexes[k], 'duplicate', g.hasPartialMissing ? 'dq02_duplicate_with_partial_missing' : 'dq02_duplicate', null);
                    dupPushed++;
                }
            }
            for (const [col, out] of outlierByCol) {
                for (const ri of out.union.slice(0, 20)) {
                    const w = rowWrappers.find((x) => x.rowIndex === ri);
                    pushEv(col, ri, 'outlier', out.reason ?? 'dq04_outlier', w?.values[col] ?? null);
                }
            }
            const insertedEvidence = await this.analysisRepository.insertEvidences(evidenceDocs).catch(() => 0);
            const byKind = {};
            const byColumn = {};
            for (const e of evidenceDocs) {
                byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
                byColumn[e.column] = (byColumn[e.column] ?? 0) + 1;
            }
            const evidenceSummary = {
                total: evidenceDocs.length,
                byKind,
                byColumn,
                capped: Object.values(byColumn).some((v) => v >= 20) || dupPushed >= 20,
            };
            void insertedEvidence;
            const finishedAt = new Date();
            const durationMs = finishedAt.getTime() - startedAt.getTime();
            await this.analysisRepository.updateById(run.id, {
                $set: { status: 'succeeded', finished_at: finishedAt, duration_ms: durationMs },
            });
            const result = await this.analysisRepository.saveResult({
                analysis_run_id: run.id,
                project_id: project.id,
                dataset_id: dataset.id,
                input_fingerprint: fp,
                is_stale: false,
                stale_reason: null,
                dq05: { status: 'unassessed', reason: 'no_rule_confirmed', rules: [], violations: [] },
                correlationMatrix: {
                    method: dto.correlation_method,
                    columns: analyzable.filter((c) => c.role !== 'excluded').map((c) => c.key),
                    cells,
                    notes,
                    excludedColumns: analyzable
                        .filter((c) => c.role === 'excluded')
                        .map((c) => ({ column: c.key, reason: c.reason ?? 'unsupported_data_type' })),
                    totalScanned: rows.length,
                },
                vif: {
                    columns: vifComp.columns,
                    rows: vifComp.rows,
                    commonN: vifComp.commonN,
                    totalScanned: vifComp.totalScanned,
                    commonNRate: vifComp.commonNRate,
                    lossWarning: vifComp.lossWarning,
                    excluded: vifComp.excluded,
                },
                aiCorrelationAssessment: {
                    status: 'pending',
                    notablePairs: [],
                    highVif: [],
                    limits: [],
                    nextSteps: [],
                    modelId: null,
                    promptVersion: 'corr-v1',
                    error: null,
                    droppedClaims: [],
                },
                dq_summary: dqSummary,
                descriptive,
                imbalance,
                timeAnalysis,
                evidenceSummary,
            });
            let previewFewShotBlock = '';
            try {
                const wsId = project.workspaceId;
                if (this.ragFewShot) {
                    previewFewShotBlock = await this.ragFewShot.buildFewShotBlockFromText({
                        workspaceId: wsId,
                        queryText: this.ragFewShot.buildQueryText('corr-v1', analyzable.map((c) => c.key).join(','), dto.correlation_method),
                        language: 'vi',
                    });
                }
            }
            catch {
                previewFewShotBlock = '';
            }
            const promptPreview = (0, ai_grounding_util_1.buildCorrV1Prompt)({
                fewShotBlock: previewFewShotBlock,
                columns: analyzable
                    .filter((c) => c.role !== 'excluded')
                    .map((c) => ({
                    key: c.key,
                    role: c.role,
                    usedRows: usedPerColumn.get(c.key)?.used ?? 0,
                    excludedRows: usedPerColumn.get(c.key)?.excluded ?? 0,
                })),
                cells: cells,
                vif: {
                    columns: vifComp.columns,
                    rows: vifComp.rows,
                    commonN: vifComp.commonN,
                    totalScanned: vifComp.totalScanned,
                    commonNRate: vifComp.commonNRate,
                    lossWarning: vifComp.lossWarning,
                    excluded: vifComp.excluded,
                },
                maskedSamples,
                method: dto.correlation_method,
                excludedColumns: analyzable
                    .filter((c) => c.role === 'excluded')
                    .map((c) => ({ column: c.key, reason: c.reason ?? 'unsupported_data_type' })),
            });
            const job = await this.analysisRepository.createJob({
                analysis_run_id: run.id,
                project_id: project.id,
                dataset_id: dataset.id,
                input_fingerprint: fp,
                status: 'pending',
                attempt: 0,
                model_id: this.configService.get('AI_MODEL_ID') ?? null,
                prompt_version: 'corr-v1',
            });
            await this.analysisRepository.markResultsStale(projectId, run.id, 'config_changed');
            this.logger.log(`Analysis run ${run.id} project ${projectId}: ${cells.length} cells, VIF commonN=${vifComp.commonN}`);
            try {
                this.realtime?.emitAnalysisLifecycle(projectId, run.id, 'analysis.completed', { status: 'succeeded' });
            }
            catch {
            }
            return this.toApiShape(result.id, run.id, fp, job.id, promptPreview);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await this.analysisRepository.updateById(run.id, {
                $set: {
                    status: 'failed',
                    finished_at: new Date(),
                    duration_ms: new Date().getTime() - startedAt.getTime(),
                    error: { code: 'ANALYSIS_FAILED', message },
                },
            });
            try {
                const failedRunId = typeof run !== 'undefined' ? run.id.toString() : undefined;
                if (failedRunId) {
                    this.realtime?.emitAnalysisLifecycle(projectId, failedRunId, 'analysis.failed', { status: 'failed' });
                }
                else {
                    this.realtime?.emitToProject(projectId, 'analysis.failed', { status: 'failed' });
                }
            }
            catch {
            }
            throw err;
        }
    }
    async getResult(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId)) {
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        }
        await this.projectsService.getProjectById(projectId);
        const run = await this.analysisRepository.findLatestRunByProject(projectId);
        if (!run) {
            throw new common_1.NotFoundException('Chưa có lần phân tích nào cho project này');
        }
        const result = await this.analysisRepository.findResultByRun(run.id);
        if (!result) {
            throw new common_1.NotFoundException('Chưa có kết quả phân tích cho lần chạy mới nhất');
        }
        return this.toApiShape(result.id, run.id, result.inputFingerprint, null, null);
    }
    async getJob(jobId) {
        const job = await this.analysisRepository.findJobById(jobId);
        if (!job)
            throw new common_1.NotFoundException('Không tìm thấy AI job');
        return {
            jobId: job.id,
            analysisRunId: job.analysisRunId.toString(),
            status: job.status,
            attempt: job.attempt,
            modelId: job.modelId,
            promptVersion: job.promptVersion,
            error: job.error,
            heartbeatAt: job.heartbeatAt ?? null,
            leaseExpiresAt: job.leaseExpiresAt ?? null,
        };
    }
    async retryJob(jobId) {
        const job = await this.analysisRepository.findJobById(jobId);
        if (!job)
            throw new common_1.NotFoundException('Không tìm thấy AI job');
        const maxAttempts = (this.configService.get('AI_MAX_RETRIES') ?? 2) + 1;
        if (job.attempt >= maxAttempts) {
            throw new common_1.BadRequestException(`AI job đã hết lượt thử lại (tối đa ${maxAttempts - 1} lần retry)`);
        }
        const updated = await this.analysisRepository.updateJobById(jobId, {
            status: 'pending',
            attempt: job.attempt + 1,
            error: null,
            started_at: null,
            finished_at: null,
        });
        return {
            jobId: jobId,
            status: updated?.status ?? 'pending',
            attempt: updated?.attempt ?? job.attempt + 1,
        };
    }
    async ingestAiResult(jobId, raw, modelId) {
        const job = await this.analysisRepository.findJobById(jobId);
        if (!job)
            throw new common_1.NotFoundException('Không tìm thấy AI job');
        const result = await this.analysisRepository.findResultByRun(job.analysisRunId.toString());
        if (!result || !result.correlationMatrix || !result.vif) {
            throw new common_1.NotFoundException('Kết quả hệ thống chưa sẵn sàng để gắn nhận xét AI');
        }
        const grounded = (0, ai_grounding_util_1.groundAiAssessment)(raw, result.correlationMatrix.cells, result.vif.rows, modelId ?? job.modelId ?? null);
        const status = grounded.status === 'succeeded' ? 'succeeded' : 'failed';
        await this.analysisRepository.updateJobById(jobId, {
            status,
            finished_at: new Date(),
            error: grounded.error ? { code: 'AI_GROUNDING_FAILED', message: grounded.error, retryable: true } : null,
        });
        const updated = await this.analysisRepository.updateResultById(result.id, {
            aiCorrelationAssessment: grounded,
        });
        try {
            const runId = job.analysisRunId.toString();
            const projectId = job.projectId.toString();
            this.realtime?.emitAnalysisLifecycle(projectId, runId, 'ai.job.status', {
                status,
                jobId,
                attempt: job.attempt,
            });
        }
        catch {
        }
        return {
            jobId,
            status,
            assessment: updated?.aiCorrelationAssessment ?? grounded,
        };
    }
    async saveConfig(projectId, dto) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        const project = await this.projectsService.getProjectById(projectId);
        const dataset = await this.datasetsRepository.findByProject(projectId);
        const known = new Set((dataset?.columns ?? []).map((c) => c.name));
        const norm = (v) => {
            if (v === undefined || v === null)
                return null;
            return known.has(v) ? v : null;
        };
        const selected = dto.selected_columns === undefined || dto.selected_columns === null
            ? null
            : dto.selected_columns.filter((c) => known.has(c));
        if (dto.selected_columns && dto.selected_columns.length > 0 && (!selected || selected.length === 0)) {
            throw new common_1.BadRequestException('selected_columns không khớp cột nào của dataset');
        }
        const label = norm(dto.label_column ?? null);
        const time = norm(dto.time_column ?? null);
        const value = norm(dto.value_column ?? null);
        if (label && dataset) {
            const dt = dataset.columns.find((c) => c.name === label)?.dataType;
            if (dt === 'number' || dt === 'date')
                throw new common_1.BadRequestException('label_column phải là cột phân loại (string/boolean)');
        }
        if (time && dataset) {
            const dt = dataset.columns.find((c) => c.name === time)?.dataType;
            if (dt !== 'date')
                throw new common_1.BadRequestException('time_column phải là cột date');
        }
        if (value && dataset) {
            const dt = dataset.columns.find((c) => c.name === value)?.dataType;
            if (dt !== 'number')
                throw new common_1.BadRequestException('value_column phải là cột số');
        }
        const saved = await this.analysisRepository.upsertConfig(projectId, project.workspaceId.toString(), {
            project_id: project.id,
            selected_columns: selected,
            label_column: label,
            time_column: time,
            time_granularity: dto.time_granularity,
            value_column: value,
            correlation_method: dto.correlation_method,
            outlier_method: dto.outlier_method,
            top_n: dto.top_n,
        });
        await this.analysisRepository.markResultsStale(projectId, '000000000000000000000000', 'config_changed');
        return {
            projectId,
            selectedColumns: saved.selectedColumns,
            labelColumn: saved.labelColumn,
            timeColumn: saved.timeColumn,
            timeGranularity: saved.timeGranularity,
            valueColumn: saved.valueColumn,
            correlationMethod: saved.correlationMethod,
            outlierMethod: saved.outlierMethod,
            topN: saved.topN,
        };
    }
    async getConfig(projectId) {
        if (!(0, object_id_util_1.isObjectIdHex)(projectId))
            throw new common_1.BadRequestException('ID Dự án không hợp lệ');
        await this.projectsService.getProjectById(projectId);
        const saved = await this.analysisRepository.findConfigByProject(projectId);
        if (!saved) {
            return { projectId, selectedColumns: null, labelColumn: null, timeColumn: null, timeGranularity: 'day', valueColumn: null, correlationMethod: 'pearson', outlierMethod: 'iqr', topN: 10 };
        }
        return {
            projectId,
            selectedColumns: saved.selectedColumns,
            labelColumn: saved.labelColumn,
            timeColumn: saved.timeColumn,
            timeGranularity: saved.timeGranularity,
            valueColumn: saved.valueColumn,
            correlationMethod: saved.correlationMethod,
            outlierMethod: saved.outlierMethod,
            topN: saved.topN,
        };
    }
    async buildPromptForJob(jobId) {
        const job = await this.analysisRepository.findJobById(jobId);
        if (!job)
            throw new common_1.NotFoundException('Không tìm thấy AI job');
        const result = await this.analysisRepository.findResultByRun(job.analysisRunId.toString());
        if (!result || !result.correlationMatrix || !result.vif) {
            throw new common_1.NotFoundException('Kết quả hệ thống chưa sẵn sàng để dựng prompt AI');
        }
        if (!job.datasetId)
            throw new common_1.NotFoundException('AI job thiếu dataset');
        const dataset = await this.datasetsRepository.findById(job.datasetId);
        const recordRows2 = await this.records.listAllRecords(job.datasetId);
        const records = recordRows2.map((r) => ({ row_index: r.rowIndex, props: r.props }));
        const keyToName = new Map((dataset?.columns ?? []).map((c) => [c.key, c.name]));
        const rows = records.map((r) => {
            const legacy = r;
            const props = (legacy.props ?? legacy.data ?? {});
            const named = {};
            for (const [k, v] of Object.entries(props))
                named[keyToName.get(k) ?? k] = v;
            return named;
        });
        const roleByKey = new Map();
        if (dataset) {
            for (const c of dataset.columns) {
                roleByKey.set(c.name, (0, correlation_util_1.classifyColumn)(c.dataType));
            }
        }
        const piiColumnKeys = new Set((dataset?.columns ?? []).filter((c) => c.isPii).map((c) => c.name));
        const maskedSamples = {};
        for (const key of result.correlationMatrix.columns) {
            const samples = [];
            const markedPii = piiColumnKeys.has(key);
            for (const row of rows) {
                if (samples.length >= 20)
                    break;
                const v = row[key];
                if (v === null || v === undefined || v === '')
                    continue;
                const masked = maskSampleValue(v, markedPii);
                if (masked === null)
                    continue;
                samples.push(masked);
            }
            maskedSamples[key] = samples;
        }
        const columns = result.correlationMatrix.columns.map((key) => {
            let used = 0;
            for (const row of rows) {
                const v = row[key];
                if (v === null || v === undefined || (typeof v === 'string' && v.trim() === ''))
                    continue;
                used++;
            }
            return { key, role: roleByKey.get(key) ?? 'unknown', usedRows: used, excludedRows: rows.length - used };
        });
        const excludedColumns = (dataset?.columns ?? [])
            .filter((c) => (0, correlation_util_1.classifyColumn)(c.dataType) === 'excluded')
            .map((c) => ({
            column: c.name,
            reason: c.dataType === 'date'
                ? 'date_column_excluded_from_correlation_vif'
                : `unsupported_data_type_${c.dataType}`,
        }));
        let fewShotBlock = '';
        try {
            const run = await this.analysisRepository.findById(job.analysisRunId.toString());
            const workspaceId = run ? run.workspaceId.toString() : null;
            if (workspaceId && this.ragFewShot) {
                const queryText = this.ragFewShot.buildQueryText('corr-v1', columns.map((c) => c.key).join(','), result.correlationMatrix.method);
                fewShotBlock = await this.ragFewShot.buildFewShotBlockFromText({
                    workspaceId,
                    queryText,
                    language: 'vi',
                });
            }
        }
        catch {
            fewShotBlock = '';
        }
        return (0, ai_grounding_util_1.buildCorrV1Prompt)({
            columns,
            cells: result.correlationMatrix.cells,
            vif: { columns: result.vif.columns, rows: result.vif.rows, commonN: result.vif.commonN, totalScanned: result.vif.totalScanned, commonNRate: result.vif.commonNRate, lossWarning: result.vif.lossWarning, excluded: result.vif.excluded },
            maskedSamples,
            method: result.correlationMatrix.method,
            excludedColumns,
            fewShotBlock,
        });
    }
    async toApiShape(resultId, runId, fingerprint, jobId, promptPreview) {
        const result = await this.analysisRepository.findResultByRun(runId);
        if (!result)
            throw new common_1.NotFoundException('Không tìm thấy kết quả phân tích');
        return {
            analysisId: resultId,
            analysisRunId: runId,
            inputFingerprint: fingerprint,
            dq05: result.dq05,
            dqSummary: result.dq_summary ?? null,
            descriptive: result.descriptive ?? null,
            imbalance: result.imbalance ?? null,
            timeAnalysis: result.timeAnalysis ?? null,
            evidenceSummary: result.evidenceSummary ?? null,
            correlationMatrix: result.correlationMatrix,
            vif: result.vif,
            aiCorrelationAssessment: result.aiCorrelationAssessment,
            pollUrl: jobId ? `/api/v1/analysis/jobs/${jobId}` : undefined,
            corrV1PromptPreview: promptPreview ?? undefined,
        };
    }
};
exports.AnalysisService = AnalysisService;
exports.AnalysisService = AnalysisService = AnalysisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(analysis_repository_port_1.ANALYSIS_REPOSITORY_PORT)),
    __param(2, (0, common_1.Inject)(dataset_repository_port_1.DATASET_REPOSITORY_PORT)),
    __param(3, (0, common_1.Inject)(record_query_port_1.RECORD_QUERY_PORT)),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, common_1.Inject)(realtime_port_1.REALTIME_PORT)),
    __param(6, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, projects_service_1.ProjectsService, Object, Object, config_1.ConfigService, Object, rag_few_shot_service_1.RagFewShotService])
], AnalysisService);
//# sourceMappingURL=analysis.service.js.map