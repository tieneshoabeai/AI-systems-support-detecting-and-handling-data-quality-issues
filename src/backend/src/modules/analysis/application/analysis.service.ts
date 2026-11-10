import { Inject, Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { REALTIME_PORT, type RealtimePort } from '../../realtime/domain/ports/realtime.port';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../datasets/domain/ports/dataset.repository.port';
import { RECORD_QUERY_PORT, type RecordQueryPort } from '../../data-view/domain/ports/record-query.port';
import { isObjectIdHex } from '../../../shared/utils/object-id.util';
import {
  AnalyzableColumn,
  buildCorrelationMatrix,
  classifyColumn,
} from '../domain/correlation.util';
import { computeVif } from '../domain/vif.util';
import {
  buildCorrV1Prompt,
  groundAiAssessment,
  type CorrV1Context,
  RawAiAssessment,
} from '../domain/ai-grounding.util';
/**
 * Application inputs — controller map DTO http (zod) sang, application khong import infrastructure.
 * Giu shape tuong thich de DTO hien tai truyen thang van type-check.
 */
export interface RunAnalysisInput {
  selected_columns?: string[];
  correlation_method: 'pearson' | 'spearman';
  outlier_method: 'iqr' | 'modified_zscore' | 'both';
  top_n: number;
}

export interface AnalysisConfigInput {
  selected_columns?: string[] | null;
  label_column?: string | null;
  time_column?: string | null;
  time_granularity: 'day' | 'week' | 'month' | 'year';
  value_column?: string | null;
  correlation_method: 'pearson' | 'spearman';
  outlier_method: 'iqr' | 'modified_zscore' | 'both';
  top_n: number;
}
import { ConfigService } from '@nestjs/config';
import { RagFewShotService } from './services/rag-few-shot.service';
import { maskCell } from '../domain/pii-mask.util';
import { computeDq0102, computeDq03, detectOutliers, isMissingCell, isValidByType } from '../domain/dq.util';
import { describeColumn, evaluateImbalance, analyzeTime } from '../domain/stats.util';
import { toFiniteNumber } from '../domain/correlation.util';

/**
 * Phần 12 v8 §3.6b #2 — Che PII trước khi đưa mẫu vào prompt AI.
 * Cột đánh dấu PII → luôn che. Ô không che được → loại khỏi prompt.
 */
function maskSampleValue(value: unknown, columnMarkedPII: boolean): string | null {
  const res = maskCell(value, columnMarkedPII);
  if (res.dropped) return null;
  if (res.value !== null) return res.value;
  return 'null';
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    private readonly projectsService: ProjectsService,
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasetsRepository: DatasetRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
    private readonly configService: ConfigService,
    @Optional() @Inject(REALTIME_PORT) private readonly realtime?: RealtimePort,
    @Optional() private readonly ragFewShot?: RagFewShotService,
  ) {}

  private fingerprint(parts: Record<string, unknown>): string {
    return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  async runAnalysis(projectId: string, dto: RunAnalysisInput, userId?: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) {
      throw new BadRequestException('ID Dự án không hợp lệ');
    }
    const project = await this.projectsService.getProjectById(projectId);
    const dataset = await this.datasetsRepository.findByProject(projectId);
    if (!dataset) {
      throw new NotFoundException('Project chưa có dataset để phân tích');
    }

    const stored = await this.analysisRepository.findConfigByProject(projectId).catch(() => null);
    const cfgSelected = stored?.selectedColumns ?? null;
    const cfgLabel = stored?.labelColumn ?? null;
    const cfgTime = stored?.timeColumn ?? null;
    const cfgGranularity = stored?.timeGranularity ?? 'day';
    const cfgValue = stored?.valueColumn ?? null;
    const allInferable = dataset.columns.filter((c) => classifyColumn(c.dataType) !== 'excluded');
    const byKey = new Map(dataset.columns.map((c) => [c.key, c.name] as const));
    const known = new Set(dataset.columns.map((c) => c.name));
    const knownOriginal = new Map(dataset.columns.map((c) => [c.originalName, c.name] as const));
    let selectedKeys: string[];
    const requestedCols = dto.selected_columns && dto.selected_columns.length > 0 ? dto.selected_columns : cfgSelected;
    if (requestedCols && requestedCols.length > 0) {
      selectedKeys = (requestedCols as string[])
        .map((k) => (known.has(k) ? k : (byKey.get(k) ?? knownOriginal.get(k) ?? k)))
        .filter((k) => known.has(k));
      if (selectedKeys.length === 0) {
        throw new BadRequestException('selected_columns không khớp cột nào của dataset');
      }
    } else {
      selectedKeys = allInferable.map((c) => c.name);
    }
    if (selectedKeys.length === 0) {
      throw new BadRequestException('Không có cột suy luận được để phân tích (toàn bộ là date/không hỗ trợ)');
    }

    const colTypeByName = new Map(dataset.columns.map((c) => [c.name, c.dataType] as const));
    const labelColumn = cfgLabel && known.has(cfgLabel) ? cfgLabel : null;
    const labelDataType = labelColumn ? (colTypeByName.get(labelColumn) ?? null) : null;
    let timeColumn: string | null = null;
    if (cfgTime && known.has(cfgTime) && colTypeByName.get(cfgTime) === 'date') timeColumn = cfgTime;
    else {
      const dateCols = dataset.columns.filter((c) => c.dataType === 'date').map((c) => c.name);
      if (dateCols.length === 1) timeColumn = dateCols[0] as string;
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
      config: config as Record<string, unknown>,
      startedBy: userId && isObjectIdHex(userId) ? userId : null,
      startedAt: startedAt,
    });

    try {
      const recordRows = await this.records.listAllRecords(dataset.id);
    const records = recordRows.map((r) => ({ row_index: r.rowIndex, props: r.props }));
      const keyToName = new Map((dataset?.columns ?? []).map((c) => [c.key, c.name] as const));
      const rows: Record<string, unknown>[] = records.map((r) => {
        const legacy = (r as unknown as { props?: Record<string, unknown>; data?: Record<string, unknown> });
        const props = ((legacy.props ?? legacy.data ?? {}) as Record<string, unknown>);
        const named: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) named[keyToName.get(k) ?? k] = v;
        return named;
      });

      const analyzable: AnalyzableColumn[] = selectedKeys.map((key) => {
        const col = dataset.columns.find((c) => c.name === key);
        const role = classifyColumn(col?.dataType ?? 'string');
        return {
          key,
          role,
          reason:
            role === 'excluded'
              ? col?.dataType === 'date'
                ? 'date_column_excluded_from_correlation_vif'
                : `unsupported_data_type_${col?.dataType ?? 'unknown'}`
              : null,
        };
      });

      const { cells, notes } = buildCorrelationMatrix(analyzable, rows, dto.correlation_method);
      const numericCols = analyzable.filter((c) => c.role === 'numeric').map((c) => c.key);
      const vifComp = computeVif(numericCols, rows);

      const piiColumnKeys = new Set(
        dataset.columns.filter((c) => c.isPii).map((c) => c.name),
      );
      const maskedSamples: Record<string, string[]> = {};
      for (const col of analyzable) {
        if (col.role === 'excluded') continue;
        const samples: string[] = [];
        const markedPii = piiColumnKeys.has(col.key);
        for (const row of rows) {
          if (samples.length >= 20) break;
          const v = row[col.key];
          if (v === null || v === undefined || v === '') continue;
          const masked = maskSampleValue(v, markedPii);
          if (masked === null) continue; // ô không che được → loại khỏi prompt
          samples.push(masked);
        }
        maskedSamples[col.key] = samples;
      }

      const usedPerColumn = new Map<string, { used: number; excluded: number }>();
      for (const col of analyzable) {
        let used = 0;
        for (const row of rows) {
          const v = row[col.key];
          if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) continue;
          used++;
        }
        usedPerColumn.set(col.key, { used, excluded: rows.length - used });
      }

      const rowWrappers = records.map((r, i) => {
        const legacy = (r as unknown as { row_index?: number; props?: Record<string, unknown>; data?: Record<string, unknown> });
        const props = ((legacy.props ?? legacy.data ?? {}) as Record<string, unknown>);
        const named: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) named[keyToName.get(k) ?? k] = v;
        return { rowIndex: typeof legacy.row_index === 'number' ? legacy.row_index : i, values: named };
      });
      const dqBase = computeDq0102(selectedKeys, rowWrappers);
      const dq03Rows = computeDq03(
        selectedKeys.map((c) => ({ column: c, dataType: colTypeByName.get(c) ?? 'string' })),
        rowWrappers,
      );
      const dq03ByCol = new Map(dq03Rows.map((r) => [r.column, r]));
      const outlierByCol = new Map<string, { union: number[]; method: string; reason: string | null }>();
      for (const key of selectedKeys) {
        if (colTypeByName.get(key) !== 'number') continue;
        const vals: { rowIndex: number; value: number }[] = [];
        for (const w of rowWrappers) {
          const v = w.values[key];
          if (isMissingCell(v)) continue;
          const chk = isValidByType(v, 'number');
          if (!chk.valid) continue;
          const n = toFiniteNumber(v);
          if (n !== null) vals.push({ rowIndex: w.rowIndex, value: n });
        }
        const out = detectOutliers(key, vals, dto.outlier_method);
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
      const descriptive = selectedKeys.map((c) =>
        describeColumn(c, colTypeByName.get(c) ?? 'string', rowWrappers.map((w) => w.values[c])),
      );
      const imbalance = evaluateImbalance(labelColumn, labelDataType, rows);
      const timeAnalysis = analyzeTime(timeColumn, valueColumn, rows, cfgGranularity as 'day' | 'week' | 'month' | 'year');
      const evidenceDocs: { analysis_run_id: unknown; project_id: unknown; dataset_id: unknown; column: string; row_index: number; kind: 'missing' | 'duplicate' | 'invalid_type' | 'outlier'; reason: string | null; value_masked: string | null }[] = [];
      const perColCount = new Map<string, number>();
      const pushEv = (column: string, rowIndex: number, kind: 'missing' | 'duplicate' | 'invalid_type' | 'outlier', reason: string | null, raw: unknown): void => {
        const used = perColCount.get(column) ?? 0;
        if (used >= 20) return;
        perColCount.set(column, used + 1);
        const isPii = piiColumnKeys.has(column);
        let masked: string | null = null;
        if (kind === 'missing') masked = null;
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
          if (n >= 20) break;
          if (isMissingCell(w.values[c])) {
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
          if (n >= 20) break;
          const v = w.values[c];
          if (isMissingCell(v)) continue;
          const chk = isValidByType(v, colTypeByName.get(c) ?? 'string');
          if (!chk.valid) {
            pushEv(c, w.rowIndex, 'invalid_type', chk.reason, v);
            n++;
          }
        }
      }
      let dupPushed = 0;
      for (const g of dqBase.duplicateGroups) {
        if (dupPushed >= 20) break;
        for (let k = 1; k < g.rowIndexes.length && dupPushed < 20; k++) {
          pushEv('__row__', g.rowIndexes[k] as number, 'duplicate', g.hasPartialMissing ? 'dq02_duplicate_with_partial_missing' : 'dq02_duplicate', null);
          dupPushed++;
        }
      }
      for (const [col, out] of outlierByCol) {
        for (const ri of out.union.slice(0, 20)) {
          const w = rowWrappers.find((x) => x.rowIndex === ri);
          pushEv(col, ri, 'outlier', out.reason ?? 'dq04_outlier', w?.values[col] ?? null);
        }
      }
      const insertedEvidence = await this.analysisRepository.insertEvidences(
        evidenceDocs as unknown as Partial<Parameters<AnalysisRepositoryPort['insertEvidences']>[0][number]>[],
      ).catch(() => 0);
      const byKind: Record<string, number> = {};
      const byColumn: Record<string, number> = {};
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
        // port nhan snake+camel linh hoat; cast unknown de truyen Mixed tu domain utils

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
      } as Partial<Parameters<AnalysisRepositoryPort['saveResult']>[0]>);

      let previewFewShotBlock = '';
      try {
        const wsId = project.workspaceId;
        if (this.ragFewShot) {
          previewFewShotBlock = await this.ragFewShot.buildFewShotBlockFromText({
            workspaceId: wsId,
            queryText: this.ragFewShot.buildQueryText(
              'corr-v1',
              analyzable.map((c) => c.key).join(','),
              dto.correlation_method,
            ),
            language: 'vi',
          });
        }
      } catch {
        previewFewShotBlock = '';
      }

      const promptPreview = buildCorrV1Prompt({
        fewShotBlock: previewFewShotBlock,
        columns: analyzable
          .filter((c) => c.role !== 'excluded')
          .map((c) => ({
            key: c.key,
            role: c.role,
            usedRows: usedPerColumn.get(c.key)?.used ?? 0,
            excludedRows: usedPerColumn.get(c.key)?.excluded ?? 0,
          })),
        cells: cells as unknown as CorrV1Context['cells'],
        vif: {
          columns: vifComp.columns,
          rows: vifComp.rows as unknown as CorrV1Context['vif'] extends infer V ? never : never,
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
      
      } as unknown as CorrV1Context);

      const job = await this.analysisRepository.createJob({
        analysis_run_id: run.id,
        project_id: project.id,
        dataset_id: dataset.id,
        input_fingerprint: fp,
        status: 'pending',
        attempt: 0,
        model_id: this.configService.get<string>('AI_MODEL_ID') ?? null,
        prompt_version: 'corr-v1',
      } as Partial<Parameters<AnalysisRepositoryPort['createJob']>[0]>);

      await this.analysisRepository.markResultsStale(projectId, run.id, 'config_changed');

      this.logger.log(
        `Analysis run ${run.id} project ${projectId}: ${cells.length} cells, VIF commonN=${vifComp.commonN}`,
      );
      try {
        this.realtime?.emitAnalysisLifecycle(
          projectId,
          run.id,
          'analysis.completed',
          { status: 'succeeded' },
        );
      } catch {
        // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
      }

      return this.toApiShape(result.id, run.id, fp, job.id, promptPreview);
    } catch (err: unknown) {
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
        const failedRunId = typeof run !== 'undefined' ? (run.id as string).toString() : undefined;
        if (failedRunId) {
          this.realtime?.emitAnalysisLifecycle(projectId, failedRunId, 'analysis.failed', { status: 'failed' });
        } else {
          this.realtime?.emitToProject(projectId, 'analysis.failed', { status: 'failed' });
        }
      } catch {
        // bỏ qua lỗi realtime
      }
      throw err;
    }
  }

  async getResult(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) {
      throw new BadRequestException('ID Dự án không hợp lệ');
    }
    await this.projectsService.getProjectById(projectId);
    const run = await this.analysisRepository.findLatestRunByProject(projectId);
    if (!run) {
      throw new NotFoundException('Chưa có lần phân tích nào cho project này');
    }
    const result = await this.analysisRepository.findResultByRun(run.id);
    if (!result) {
      throw new NotFoundException('Chưa có kết quả phân tích cho lần chạy mới nhất');
    }
    return this.toApiShape(result.id, run.id, result.inputFingerprint, null, null);
  }

  async getJob(jobId: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundException('Không tìm thấy AI job');
    return {
      jobId: job.id,
      analysisRunId: (job.analysisRunId as string).toString(),
      status: job.status,
      attempt: job.attempt,
      modelId: job.modelId,
      promptVersion: job.promptVersion,
      error: job.error,
      heartbeatAt: job.heartbeatAt ?? null,
      leaseExpiresAt: job.leaseExpiresAt ?? null,
    };
  }

  async retryJob(jobId: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundException('Không tìm thấy AI job');
    const maxAttempts = (this.configService.get<number>('AI_MAX_RETRIES') ?? 2) + 1;
    if (job.attempt >= maxAttempts) {
      throw new BadRequestException(`AI job đã hết lượt thử lại (tối đa ${maxAttempts - 1} lần retry)`);
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

  async ingestAiResult(jobId: string, raw: unknown, modelId?: string): Promise<Record<string, unknown>> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundException('Không tìm thấy AI job');
    const result = await this.analysisRepository.findResultByRun(
      (job.analysisRunId as string).toString(),
    );
    if (!result || !result.correlationMatrix || !result.vif) {
      throw new NotFoundException('Kết quả hệ thống chưa sẵn sàng để gắn nhận xét AI');
    }
    const grounded = groundAiAssessment(
      raw as RawAiAssessment,
      result.correlationMatrix.cells,
      result.vif.rows,
      modelId ?? job.modelId ?? null,
    );
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
      const runId = (job.analysisRunId as string).toString();
      const projectId = (job.projectId as string).toString();
      this.realtime?.emitAnalysisLifecycle(projectId, runId, 'ai.job.status', {
        status,
        jobId,
        attempt: job.attempt,
      });
    } catch {
      // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
    }
    return {
      jobId,
      status,
      assessment: updated?.aiCorrelationAssessment ?? grounded,
    };
  }

  async saveConfig(projectId: string, dto: AnalysisConfigInput): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    const project = await this.projectsService.getProjectById(projectId);
    const dataset = await this.datasetsRepository.findByProject(projectId);
    const known = new Set((dataset?.columns ?? []).map((c) => c.name));
    const norm = (v: string | null | undefined): string | null => {
      if (v === undefined || v === null) return null;
      return known.has(v) ? v : null;
    };
    const selected = dto.selected_columns === undefined || dto.selected_columns === null
      ? null
      : dto.selected_columns.filter((c) => known.has(c));
    if (dto.selected_columns && dto.selected_columns.length > 0 && (!selected || selected.length === 0)) {
      throw new BadRequestException('selected_columns không khớp cột nào của dataset');
    }
    const label = norm(dto.label_column ?? null);
    const time = norm(dto.time_column ?? null);
    const value = norm(dto.value_column ?? null);
    if (label && dataset) {
      const dt = dataset.columns.find((c) => c.name === label)?.dataType;
      if (dt === 'number' || dt === 'date') throw new BadRequestException('label_column phải là cột phân loại (string/boolean)');
    }
    if (time && dataset) {
      const dt = dataset.columns.find((c) => c.name === time)?.dataType;
      if (dt !== 'date') throw new BadRequestException('time_column phải là cột date');
    }
    if (value && dataset) {
      const dt = dataset.columns.find((c) => c.name === value)?.dataType;
      if (dt !== 'number') throw new BadRequestException('value_column phải là cột số');
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

  async getConfig(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
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

  async buildPromptForJob(jobId: string): Promise<string> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job) throw new NotFoundException('Không tìm thấy AI job');
    const result = await this.analysisRepository.findResultByRun(
      (job.analysisRunId as string).toString(),
    );
    if (!result || !result.correlationMatrix || !result.vif) {
      throw new NotFoundException('Kết quả hệ thống chưa sẵn sàng để dựng prompt AI');
    }
    if (!job.datasetId) throw new NotFoundException('AI job thiếu dataset');
    const dataset = await this.datasetsRepository.findById(job.datasetId);
    const recordRows2 = await this.records.listAllRecords(job.datasetId);
    const records = recordRows2.map((r) => ({ row_index: r.rowIndex, props: r.props }));
    const keyToName = new Map((dataset?.columns ?? []).map((c) => [c.key, c.name] as const));
      const rows: Record<string, unknown>[] = records.map((r) => {
        const legacy = (r as unknown as { props?: Record<string, unknown>; data?: Record<string, unknown> });
        const props = ((legacy.props ?? legacy.data ?? {}) as Record<string, unknown>);
        const named: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) named[keyToName.get(k) ?? k] = v;
        return named;
      });
    const roleByKey = new Map<string, string>();
    if (dataset) {
      for (const c of dataset.columns) {
        roleByKey.set(c.name, classifyColumn(c.dataType));
      }
    }
    const piiColumnKeys = new Set(
      (dataset?.columns ?? []).filter((c) => c.isPii).map((c) => c.name),
    );
    const maskedSamples: Record<string, string[]> = {};
    for (const key of result.correlationMatrix.columns) {
      const samples: string[] = [];
      const markedPii = piiColumnKeys.has(key);
      for (const row of rows) {
        if (samples.length >= 20) break;
        const v = row[key];
        if (v === null || v === undefined || v === '') continue;
        const masked = maskSampleValue(v, markedPii);
        if (masked === null) continue; // ô không che được → loại khỏi prompt
        samples.push(masked);
      }
      maskedSamples[key] = samples;
    }
    const columns = result.correlationMatrix.columns.map((key) => {
      let used = 0;
      for (const row of rows) {
        const v = row[key];
        if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) continue;
        used++;
      }
      return { key, role: roleByKey.get(key) ?? 'unknown', usedRows: used, excludedRows: rows.length - used };
    });
    const excludedColumns = (dataset?.columns ?? [])
      .filter((c) => classifyColumn(c.dataType) === 'excluded')
      .map((c) => ({
        column: c.name,
        reason:
          c.dataType === 'date'
            ? 'date_column_excluded_from_correlation_vif'
            : `unsupported_data_type_${c.dataType}`,
      }));
    let fewShotBlock = '';
    try {
      const run = await this.analysisRepository.findById((job.analysisRunId as string).toString());
      const workspaceId = run ? (run.workspaceId as string).toString() : null;
      if (workspaceId && this.ragFewShot) {
        const queryText = this.ragFewShot.buildQueryText(
          'corr-v1',
          columns.map((c) => c.key).join(','),
          result.correlationMatrix.method,
        );
        fewShotBlock = await this.ragFewShot.buildFewShotBlockFromText({
          workspaceId,
          queryText,
          language: 'vi',
        });
      }
    } catch {
      fewShotBlock = '';
    }
    return buildCorrV1Prompt({
      columns,
      cells: result.correlationMatrix.cells,
      vif: { columns: result.vif.columns, rows: result.vif.rows, commonN: result.vif.commonN, totalScanned: result.vif.totalScanned, commonNRate: result.vif.commonNRate, lossWarning: result.vif.lossWarning, excluded: result.vif.excluded },
      maskedSamples,
      method: result.correlationMatrix.method,
      excludedColumns,
      fewShotBlock,
    });
  }

  private async toApiShape(
    resultId: string,
    runId: string,
    fingerprint: string,
    jobId: string | null,
    promptPreview: string | null,
  ): Promise<Record<string, unknown>> {
    const result = await this.analysisRepository.findResultByRun(runId);
    if (!result) throw new NotFoundException('Không tìm thấy kết quả phân tích');
    return {
      analysisId: resultId,
      analysisRunId: runId,
      inputFingerprint: fingerprint,
      dq05: result.dq05,
      dqSummary: (result as unknown as { dq_summary?: unknown }).dq_summary ?? null,
      descriptive: (result as unknown as { descriptive?: unknown }).descriptive ?? null,
      imbalance: (result as unknown as { imbalance?: unknown }).imbalance ?? null,
      timeAnalysis: (result as unknown as { timeAnalysis?: unknown }).timeAnalysis ?? null,
      evidenceSummary: (result as unknown as { evidenceSummary?: unknown }).evidenceSummary ?? null,
      correlationMatrix: result.correlationMatrix,
      vif: result.vif,
      aiCorrelationAssessment: result.aiCorrelationAssessment,
      pollUrl: jobId ? `/api/v1/analysis/jobs/${jobId}` : undefined,
      corrV1PromptPreview: promptPreview ?? undefined,
    };
  }
}
