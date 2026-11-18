import * as crypto from 'crypto';
/**
 * RunAnalysisHandler — Use case: `runAnalysis()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { REALTIME_PORT, type RealtimePort } from '../../../realtime';
import {
  ANALYSIS_REPOSITORY_PORT,
  type AnalysisRepositoryPort,
} from '../../domain/ports/analysis.repository.port';
import { PROJECT_ACCESS_PORT, type ProjectAccessPort } from '../../../projects';
import { DATASET_REPOSITORY_PORT, type DatasetRepositoryPort } from '../../../datasets';
import { RECORD_QUERY_PORT, type RecordQueryPort } from '../../../datasets';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';
import {
  AnalyzableColumn,
  buildCorrelationMatrix,
  classifyColumn,
} from '../../domain/correlation.util';
import { computeVif } from '../../domain/vif.util';
import { buildCorrV1Prompt, type CorrV1Context } from '../../domain/ai-grounding.util';
import { ConfigService } from '@nestjs/config';
import { RagFewShotService } from '../services/rag-few-shot.service';
import {
  computeDq0102,
  computeDq03,
  detectOutliers,
  isMissingCell,
  isValidByType,
} from '../../domain/dq.util';
import { describeColumn, evaluateImbalance, analyzeTime } from '../../domain/stats.util';
import { toFiniteNumber } from '../../domain/correlation.util';
import { RunAnalysisInput } from '../analysis.types';
import { maskSampleValue } from '../analysis.utils';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import {
  assertAnalysisRowLimit,
  resolveAnalysisMaxRows,
} from '../analysis-limit.util';

@Injectable()
export class RunAnalysisHandler {
  private readonly logger = new Logger(RunAnalysisHandler.name);
  constructor(
    @Inject(PROJECT_ACCESS_PORT)
    private readonly projects: ProjectAccessPort,
    @Inject(DATASET_REPOSITORY_PORT)
    private readonly datasetsRepository: DatasetRepositoryPort,
    @Inject(ANALYSIS_REPOSITORY_PORT)
    private readonly analysisRepository: AnalysisRepositoryPort,
    @Inject(RECORD_QUERY_PORT)
    private readonly records: RecordQueryPort,
    @Optional()
    private readonly ragFewShot: RagFewShotService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(REALTIME_PORT)
    private readonly realtime: RealtimePort,
  ) {}

  private fingerprint(parts: Record<string, unknown>): string {
    return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  private async toApiShape(
    resultId: string,
    runId: string,
    fingerprint: string,
    jobId: string | null,
    promptPreview: string | null,
  ): Promise<Record<string, unknown>> {
    const result = await this.analysisRepository.findResultByRun(runId);
    if (!result) throw new NotFoundError('Không tìm thấy kết quả phân tích');
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

  async execute(
    projectId: string,
    dto: RunAnalysisInput,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) {
      throw new ValidationError('ID Dự án không hợp lệ');
    }
    const project = await this.projects.getProjectById(projectId);
    const dataset = await this.datasetsRepository.findByProject(projectId);
    if (!dataset) {
      throw new NotFoundError('Project chưa có dataset để phân tích');
    }

    // GĐ0 — chặn sớm theo số dòng, TRƯỚC khi đọc bất kỳ record nào từ MongoDB.
    // Xem `analysis-limit.util.ts` để hiểu vì sao cần lớp chặn này.
    assertAnalysisRowLimit(
      dataset.rowCount,
      resolveAnalysisMaxRows(this.configService.get('ANALYSIS_MAX_ROWS')),
    );

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
    const requestedCols =
      dto.selected_columns && dto.selected_columns.length > 0 ? dto.selected_columns : cfgSelected;
    if (requestedCols && requestedCols.length > 0) {
      selectedKeys = (requestedCols as string[])
        .map((k) => (known.has(k) ? k : (byKey.get(k) ?? knownOriginal.get(k) ?? k)))
        .filter((k) => known.has(k));
      if (selectedKeys.length === 0) {
        throw new ValidationError('selected_columns không khớp cột nào của dataset');
      }
    } else {
      selectedKeys = allInferable.map((c) => c.name);
    }
    if (selectedKeys.length === 0) {
      throw new ValidationError('Không có cột suy luận được để phân tích (toàn bộ là date/không hỗ trợ)',);
    }

    const colTypeByName = new Map(dataset.columns.map((c) => [c.name, c.dataType] as const));
    const labelColumn = cfgLabel && known.has(cfgLabel) ? cfgLabel : null;
    const labelDataType = labelColumn ? (colTypeByName.get(labelColumn) ?? null) : null;
    let timeColumn: string | null = null;
    if (cfgTime && known.has(cfgTime) && colTypeByName.get(cfgTime) === 'date')
      timeColumn = cfgTime;
    else {
      const dateCols = dataset.columns.filter((c) => c.dataType === 'date').map((c) => c.name);
      if (dateCols.length === 1) timeColumn = dateCols[0] as string;
    }
    const valueColumn =
      cfgValue && known.has(cfgValue) && colTypeByName.get(cfgValue) === 'number' ? cfgValue : null;
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
      startedAt,
    });

    try {
      // GĐ0b — Dọn bản sao trung gian để giảm peak-RAM.
      //
      // Trước đây chuỗi biến đổi tạo **3 bản sao** dữ liệu cho mỗi dòng:
      //   recordRows → records (mảng mới) → rows (object `named` mới)
      //                                    → rowWrappers (object `named` mới LẦN NỮA)
      // Với 100k dòng × N cột, phần `named` bị nhân đôi là nguồn peak-RAM lớn nhất.
      //
      // Nay: tạo `values` (object đã đổi tên key) **đúng một lần** rồi chia sẻ
      // giữa `rows` và `rowWrappers` — hai mảng này chỉ chứa *tham chiếu*.
      const recordRows = await this.records.listAllRecords(dataset.id);
      const keyToName = new Map((dataset?.columns ?? []).map((c) => [c.key, c.name] as const));

      /** Bọc dòng chuẩn hoá — `values` là object đã đổi tên key (dùng chung). */
      const rowWrappers: { rowIndex: number; values: Record<string, unknown> }[] = [];
      for (let i = 0; i < recordRows.length; i++) {
        const r = recordRows[i] as unknown as {
          row_index?: number;
          rowIndex?: number;
          props?: Record<string, unknown>;
          data?: Record<string, unknown>;
        };
        const props = (r.props ?? r.data ?? {}) as Record<string, unknown>;
        const named: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) named[keyToName.get(k) ?? k] = v;
        rowWrappers.push({
          rowIndex: typeof r.row_index === 'number' ? r.row_index : (r.rowIndex ?? i),
          values: named,
        });
      }
      /** Mảng dữ liệu phẳng — chỉ chứa tham chiếu tới `values`, không sao chép. */
      const rows: Record<string, unknown>[] = rowWrappers.map((w) => w.values);

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

      const piiColumnKeys = new Set(dataset.columns.filter((c) => c.isPii).map((c) => c.name));
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

      const dqBase = computeDq0102(selectedKeys, rowWrappers);
      const dq03Rows = computeDq03(
        selectedKeys.map((c) => ({ column: c, dataType: colTypeByName.get(c) ?? 'string' })),
        rowWrappers,
      );
      const dq03ByCol = new Map(dq03Rows.map((r) => [r.column, r]));
      const outlierByCol = new Map<
        string,
        { union: number[]; method: string; reason: string | null }
      >();
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
          outlierRate:
            rowWrappers.length > 0 ? Number((outlierCount / rowWrappers.length).toFixed(4)) : null,
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
          ...(dqBase.fullyMissingRows === rowWrappers.length && rowWrappers.length > 0
            ? ['toan bo dong thieu tren cac cot duoc chon']
            : []),
        ],
      };
      const descriptive = selectedKeys.map((c) =>
        describeColumn(
          c,
          colTypeByName.get(c) ?? 'string',
          rowWrappers.map((w) => w.values[c]),
        ),
      );
      const imbalance = evaluateImbalance(labelColumn, labelDataType, rows);
      const timeAnalysis = analyzeTime(
        timeColumn,
        valueColumn,
        rows,
        cfgGranularity as 'day' | 'week' | 'month' | 'year',
      );
      const evidenceDocs: {
        analysis_run_id: unknown;
        project_id: unknown;
        dataset_id: unknown;
        column: string;
        row_index: number;
        kind: 'missing' | 'duplicate' | 'invalid_type' | 'outlier';
        reason: string | null;
        value_masked: string | null;
      }[] = [];
      const perColCount = new Map<string, number>();
      const pushEv = (
        column: string,
        rowIndex: number,
        kind: 'missing' | 'duplicate' | 'invalid_type' | 'outlier',
        reason: string | null,
        raw: unknown,
      ): void => {
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
          pushEv(
            '__row__',
            g.rowIndexes[k] as number,
            'duplicate',
            g.hasPartialMissing ? 'dq02_duplicate_with_partial_missing' : 'dq02_duplicate',
            null,
          );
          dupPushed++;
        }
      }
      for (const [col, out] of outlierByCol) {
        for (const ri of out.union.slice(0, 20)) {
          const w = rowWrappers.find((x) => x.rowIndex === ri);
          pushEv(col, ri, 'outlier', out.reason ?? 'dq04_outlier', w?.values[col] ?? null);
        }
      }
      const insertedEvidence = await this.analysisRepository
        .insertEvidences(
          evidenceDocs as unknown as Partial<
            Parameters<AnalysisRepositoryPort['insertEvidences']>[0][number]
          >[],
        )
        .catch(() => 0);
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
          rows: vifComp.rows as unknown as CorrV1Context['vif'],
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
        this.realtime?.emitAnalysisLifecycle(projectId, run.id, 'analysis.completed', {
          status: 'succeeded',
        });
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
          this.realtime?.emitAnalysisLifecycle(projectId, failedRunId, 'analysis.failed', {
            status: 'failed',
          });
        } else {
          this.realtime?.emitToProject(projectId, 'analysis.failed', { status: 'failed' });
        }
      } catch {
        // bỏ qua lỗi realtime
      }
      throw err;
    }
  }
}
