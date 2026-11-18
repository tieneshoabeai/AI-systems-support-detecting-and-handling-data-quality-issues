import { Inject, Injectable, NotFoundException, BadRequestException, ConflictException, PayloadTooLargeException, Logger, Optional } from '@nestjs/common';
import { REALTIME_PORT, type RealtimePort } from '../../realtime/domain/ports/realtime.port';
import { OUTBOX_PORT, type OutboxPort } from '../../../shared/ports/outbox.port';
import { NotificationsService } from '../../notifications/application/notifications.service';
import { ANALYSIS_REPOSITORY_PORT, type AnalysisRepositoryPort } from '../domain/ports/analysis.repository.port';
import { ProjectsService } from '../../projects/application/projects.service';
import { ProjectAccessService } from './project-access.service';
import { StalenessService } from './staleness.service';
import {
  FINGERPRINT_VERSION,
  computeInputFingerprint,
  resolveColumnRef,
  type ResolvedRunConfig,
} from '../domain/input-fingerprint.util';
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
  chart_top_n?: number;
  /** Đợt F: ghi đè vai trò cột (key → vai trò). undefined → giữ ghi đè đã lưu; null → xóa. */
  column_roles?: Record<string, string> | null;
}
import { ConfigService } from '@nestjs/config';
import { RagFewShotService } from './services/rag-few-shot.service';
import { maskForAi } from '../domain/pii-mask.util';
import {
  correlationExclusionReason,
  inferColumnRoles,
  isRoleAllowedForType,
  type AnalysisRole,
  type ColumnRoleInfo,
} from '../domain/column-role.util';
import { computeDq0102, computeDq03, dateOrderOf, detectOutliers, isMissingCell, isValidByType } from '../domain/dq.util';
import { detectSuspicions } from '../domain/suspicion.util';
import { describeColumn, evaluateImbalance, analyzeTime, skewnessOf } from '../domain/stats.util';
import { toFiniteNumber } from '../domain/correlation.util';
import { boxPlot, categoryTopN, clampChartTopN, histogram, type ChartData } from '../domain/chart-data.util';

/** Đợt F: chỉ giữ ghi đè vai trò của cột còn trong dataset và hợp lệ với kiểu cột. */
function sanitizeRoleOverrides(
  roles: Record<string, string> | null | undefined,
  cols: { key: string; dataType: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, role] of Object.entries(roles ?? {})) {
    const c = cols.find((x) => x.key === key);
    if (c && isRoleAllowedForType(role as AnalysisRole, c.dataType)) out[key] = role;
  }
  return out;
}

/** Doi key cot (props) sang ten cot hien thi; ho tro ban ghi cu dung `data`. */
function toNamedRow(
  record: { props?: Record<string, unknown>; data?: Record<string, unknown> },
  keyToName: Map<string, string>,
): Record<string, unknown> {
  const props = record.props ?? record.data ?? {};
  const named: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) named[keyToName.get(k) ?? k] = v;
  return named;
}

/** AI-01 (Phan 2 v10 muc 3.41): chi job da ket thuc khong thanh cong moi duoc thu lai. */
const RETRYABLE_JOB_STATUSES = new Set(['failed', 'skipped']);

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
    private readonly projectAccess: ProjectAccessService,
    private readonly staleness: StalenessService,
    @Optional() @Inject(REALTIME_PORT) private readonly realtime?: RealtimePort,
    @Optional() private readonly ragFewShot?: RagFewShotService,
    @Optional() @Inject(OUTBOX_PORT) private readonly outbox?: OutboxPort,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  /**
   * E3 (Phan 9 v5 muc 3.12): ghi su kien outbox + thong bao cho nguoi chay phan tich.
   * Best-effort — loi outbox/thong bao KHONG lam hong luong nghiep vu chinh.
   * Realtime van phat truc tiep: khi WORKER_MODE=api, relay/dispatcher chay o process worker
   * nen realtime phat tu do khong toi client cua API.
   */
  private async publishLifecycle(params: {
    eventType: 'ANALYSIS_COMPLETED' | 'ANALYSIS_FAILED' | 'AI_JOB_SUCCEEDED' | 'AI_JOB_FAILED';
    projectId: string;
    workspaceId?: string | null;
    runId: string;
    actorId: string | null;
    jobId?: string;
    errorCode?: string | null;
  }): Promise<void> {
    const { eventType, projectId, runId, actorId, jobId } = params;
    try {
      await this.outbox?.recordEvent({
        aggregate_type: jobId ? 'AI_JOB' : 'ANALYSIS_RUN',
        aggregate_id: jobId ?? runId,
        event_type: eventType,
        project_id: projectId,
        workspace_id: params.workspaceId ?? null,
        actor_id: actorId,
        payload: {
          project_id: projectId,
          analysis_id: runId,
          ...(jobId ? { job_id: jobId } : {}),
          actor_id: actorId,
          ...(params.errorCode ? { error_code: params.errorCode } : {}),
        },
      });
    } catch (err: unknown) {
      this.logger.warn(`Ghi outbox ${eventType} that bai: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!actorId || !this.notifications) return;
    const copy = {
      ANALYSIS_COMPLETED: { type: 'analysis_completed', title: 'Phân tích dữ liệu đã hoàn tất' },
      ANALYSIS_FAILED: { type: 'analysis_failed', title: 'Phân tích dữ liệu thất bại — hãy chạy lại' },
      AI_JOB_SUCCEEDED: { type: 'ai_analysis_ready', title: 'Nhận xét AI về tương quan/VIF đã sẵn sàng' },
      AI_JOB_FAILED: { type: 'analysis_failed', title: 'Nhận xét AI thất bại — kết quả hệ thống vẫn dùng được, có thể thử lại AI' },
    } as const;
    try {
      await this.notifications.dispatch({
        userId: actorId,
        type: copy[eventType].type,
        title: copy[eventType].title,
        summary: params.errorCode ? `Mã lỗi: ${params.errorCode}` : null,
        payload: { targetType: jobId ? 'ai_job' : 'analysis_run', targetId: jobId ?? runId, actionUrl: `/projects/${projectId}/analysis` },
      });
    } catch (err: unknown) {
      this.logger.warn(`Gui thong bao ${eventType} that bai: ${err instanceof Error ? err.message : String(err)}`);
    }
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
    // E4 (Phan 10 v7 muc 3.17): phan tich dong bo nap toan bo dong vao RAM -> chan truoc khi nap
    const maxRows = Number(this.configService.get<number>('ANALYSIS_MAX_ROWS') ?? 200000);
    if (Number.isFinite(maxRows) && maxRows > 0 && dataset.rowCount > maxRows) {
      throw new PayloadTooLargeException({
        message: `Dataset có ${dataset.rowCount} dòng, vượt giới hạn phân tích đồng bộ ${maxRows} dòng`,
        error: 'ANALYSIS_TOO_LARGE',
        details: { rowCount: dataset.rowCount, maxRows },
      } as never);
    }

    const stored = await this.analysisRepository.findConfigByProject(projectId).catch(() => null);
    const cfgGranularity = stored?.timeGranularity ?? 'day';
    const cols = dataset.columns;
    // Dot G (RC-14, Phan 2 v12 muc 3.44): khong chon cot → MOI cot vao DQ (ke ca cot ngay).
    // Loc cot cho tuong quan/VIF lam rieng theo vai tro (datetime/identifier/text bi loai kem ly do).
    const allInferable = cols;
    // D2: cau hinh tham chieu cot bang KEY bat bien; van nhan ten hien tai/ten goc (du lieu cu, request)
    const requestedCols = dto.selected_columns && dto.selected_columns.length > 0 ? dto.selected_columns : stored?.selectedColumns ?? null;
    let selectedCols: typeof cols;
    if (requestedCols && requestedCols.length > 0) {
      const resolved = requestedCols.map((ref) => resolveColumnRef(ref, cols));
      const missing = requestedCols.filter((_, i) => !resolved[i]);
      if (missing.length > 0) {
        throw new BadRequestException(`selected_columns có cột không còn trong dataset: ${missing.join(', ')} — hãy cập nhật cấu hình phân tích`);
      }
      selectedCols = [...new Map(resolved.map((c) => [c!.key, c!] as const)).values()] as typeof cols;
    } else {
      selectedCols = allInferable;
    }
    if (selectedCols.length === 0) {
      throw new BadRequestException('Dataset không có cột nào để phân tích');
    }
    const selectedKeys = selectedCols.map((c) => c.name); // ten hien tai — dung noi bo cho tinh toan/hien thi

    const colTypeByName = new Map(cols.map((c) => [c.name, c.dataType] as const));
    const labelCol = resolveColumnRef(stored?.labelColumn ?? null, cols);
    const labelColumn = labelCol ? labelCol.name : null;
    const labelDataType = labelCol ? labelCol.dataType : null;
    let timeCol = resolveColumnRef(stored?.timeColumn ?? null, cols);
    if (timeCol && timeCol.dataType !== 'date') timeCol = null;
    if (!timeCol) {
      const dateCols = cols.filter((c) => c.dataType === 'date');
      if (dateCols.length === 1) timeCol = dateCols[0] ?? null;
    }
    const timeColumn = timeCol ? timeCol.name : null;
    let valueCol = resolveColumnRef(stored?.valueColumn ?? null, cols);
    if (valueCol && valueCol.dataType !== 'number') valueCol = null;
    const valueColumn = valueCol ? valueCol.name : null;
    const resolvedCfg: ResolvedRunConfig = {
      selectedKeys: selectedCols.map((c) => c.key),
      labelKey: labelCol?.key ?? null,
      timeKey: timeCol?.key ?? null,
      valueKey: valueCol?.key ?? null,
      correlationMethod: dto.correlation_method,
      outlierMethod: dto.outlier_method,
      topN: dto.top_n,
      timeGranularity: cfgGranularity,
      columnRoles: sanitizeRoleOverrides(stored?.columnRoles, cols),
    };
    const config = {
      fingerprint_version: FINGERPRINT_VERSION,
      selected_column_keys: resolvedCfg.selectedKeys,
      selected_column_names: selectedKeys,
      correlation_method: dto.correlation_method,
      outlier_method: dto.outlier_method,
      top_n: dto.top_n,
      chart_top_n: stored?.chartTopN ?? 5,
      label_column: labelColumn,
      label_column_key: resolvedCfg.labelKey,
      time_column: timeColumn,
      time_column_key: resolvedCfg.timeKey,
      time_granularity: cfgGranularity,
      value_column: valueColumn,
      value_column_key: resolvedCfg.valueKey,
      column_roles: resolvedCfg.columnRoles ?? {},
    };
    const fp = computeInputFingerprint(
      { id: dataset.id, fileChecksum: dataset.fileChecksum, rowCount: dataset.rowCount, columns: cols },
      resolvedCfg,
    );

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
      const keyToName = new Map(dataset.columns.map((c) => [c.key, c.name] as const));
      const rowWrappers = recordRows.map((r, i) => ({
        rowIndex: typeof r.rowIndex === 'number' ? r.rowIndex : i,
        values: toNamedRow(r as unknown as { props?: Record<string, unknown> }, keyToName),
      }));
      const rows: Record<string, unknown>[] = rowWrappers.map((w) => w.values);

      // Đợt F (Phần 12 v10 mục 3.19): vai trò cột quyết định tương quan / VIF / DQ-04
      const columnRoles: ColumnRoleInfo[] = inferColumnRoles(
        selectedCols.map((c) => ({ key: c.key, name: c.name, dataType: c.dataType })),
        rows,
        resolvedCfg.columnRoles,
      );
      const roleByName = new Map<string, AnalysisRole>(columnRoles.map((r) => [r.name, r.role] as const));
      // Đợt H: cột nhãn / cột giá trị có thể nằm ngoài danh sách chọn → suy vai trò riêng (có ghi đè người dùng)
      const roleOfAny = (col: { key: string; name: string; dataType: string } | null): AnalysisRole | null => {
        if (!col) return null;
        const known = roleByName.get(col.name);
        if (known) return known;
        return inferColumnRoles([{ key: col.key, name: col.name, dataType: col.dataType }], rows, resolvedCfg.columnRoles)[0]?.role ?? null;
      };
      const labelRole = roleOfAny(labelCol);
      const valueRole = roleOfAny(valueCol);
      const analyzable: AnalyzableColumn[] = selectedKeys.map((key) => {
        const col = dataset.columns.find((c) => c.name === key);
        const role = roleByName.get(key) ?? 'text';
        const typeRole = classifyColumn(col?.dataType ?? 'string');
        if (typeRole === 'excluded' && role !== 'datetime') {
          return { key, role: 'excluded', reason: `unsupported_data_type_${col?.dataType ?? 'unknown'}` };
        }
        const exclusion = correlationExclusionReason(role);
        if (exclusion) return { key, role: 'excluded', reason: exclusion };
        return { key, role: role === 'measure' ? 'numeric' : 'categorical', reason: null, textColumn: col?.dataType === 'string' };
      });

      const { cells, notes } = buildCorrelationMatrix(analyzable, rows, dto.correlation_method);
      // ANALYSIS-05: VIF chỉ trên cột định lượng, loại cột nhãn và định danh
      const numericCols = analyzable
        .filter((c) => c.role === 'numeric' && c.key !== labelColumn)
        .map((c) => c.key);
      const vifComp = computeVif(numericCols, rows);

      const piiColumnKeys = new Set(
        dataset.columns.filter((c) => c.isPii).map((c) => c.name),
      );
      const maskOf = (column: string, raw: unknown): string | null =>
        maskForAi(raw, { markedPii: piiColumnKeys.has(column), role: roleByName.get(column) ?? null })?.value ?? null;

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
      // Dot G: thu tu ngay/thang (DD/MM hay MM/DD) cua tung cot ngay, dung chung cho DQ-03 / bang chung / mau AI
      const dateOrderByCol = new Map(
        selectedKeys.filter((c) => colTypeByName.get(c) === 'date').map((c) => [c, dateOrderOf(rowWrappers.map((w) => w.values[c]))] as const),
      );
      const dq03Rows = computeDq03(
        selectedKeys.map((c) => ({ column: c, dataType: colTypeByName.get(c) ?? 'string' })),
        rowWrappers,
      );
      const dq03ByCol = new Map(dq03Rows.map((r) => [r.column, r]));
      const outlierByCol = new Map<string, { union: number[]; method: string; reason: string | null; breakdown: { iqr: number; iqrExtreme: number; zscore: number; both: number } }>();
      const numericValues = new Map<string, number[]>();
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
        numericValues.set(key, vals.map((x) => x.value));
        // Đợt F: DQ-04 chỉ chạy trên cột định lượng (không áp cho định danh / phân loại mã hóa số)
        if (roleByName.get(key) !== 'measure') continue;
        const out = detectOutliers(key, vals, dto.outlier_method);
        outlierByCol.set(key, {
          union: out.union,
          method: dto.outlier_method,
          reason: out.reason,
          // E2: muc anh huong DQ-04 theo phuong phap danh dau (Phan 2 muc 3.29)
          breakdown: {
            iqr: out.iqrOutliers.length,
            iqrExtreme: out.iqrExtremeOutliers.length,
            zscore: out.zOutliers.length,
            both: out.intersection.length,
          },
        });
      }
      const dqColumns = dqBase.columns.map((c) => {
        const inv = dq03ByCol.get(c.column);
        const out = outlierByCol.get(c.column);
        const outlierCount = out ? out.union.length : 0;
        // Đợt H (Phần 2 v13 mục 3.45): giải thích — không đổi số đếm/mức ảnh hưởng
        const xs = roleByName.get(c.column) === 'measure' ? numericValues.get(c.column) ?? [] : [];
        const skewness = skewnessOf(xs);
        return {
          ...c,
          invalidCount: inv?.invalidCount ?? 0,
          invalidRate: inv?.invalidRate ?? null,
          symbolMissingCount: inv?.reasons['symbol_as_missing_excluded_from_dq01'] ?? 0,
          skewness,
          outlierCount,
          outlierRate: rowWrappers.length > 0 ? Number((outlierCount / rowWrappers.length).toFixed(4)) : null,
          outlierBreakdown: out ? out.breakdown : null,
          outlierSkippedReason: !out && colTypeByName.get(c.column) === 'number' ? 'not_measure_column' : null,
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
      // E1 (spec 3.21): du lieu bieu do — cot ty le thieu, histogram/box plot cot so, Top N cot phan loai
      const chartTopN = clampChartTopN(config.chart_top_n);
      const charts: ChartData = {
        missingRate: dqColumns.map((c) => ({ column: c.column, missingRate: c.missingRate ?? null })),
        histograms: [],
        boxPlots: [],
        categories: [],
        timeSeries: null,
      };
      // Đợt F: biểu đồ theo vai trò cột — measure: histogram/box; category: Top N;
      // identifier/text: không vẽ (không in giá trị định danh/họ tên ra Top N của PDF)
      for (const key of selectedKeys) {
        const dt = colTypeByName.get(key) ?? 'string';
        const role = roleByName.get(key);
        if (role === 'measure') {
          const xs = numericValues.get(key) ?? [];
          const h = histogram(key, xs);
          const b = boxPlot(key, xs);
          if (h) charts.histograms.push(h);
          if (b) charts.boxPlots.push(b);
        } else if (role === 'category' && dt !== 'date' && !piiColumnKeys.has(key)) {
          const vs: string[] = [];
          for (const w of rowWrappers) {
            const v = w.values[key];
            if (!isMissingCell(v)) vs.push(String(v).trim());
          }
          const cat = categoryTopN(key, vs, chartTopN);
          if (cat) charts.categories.push(cat);
        }
      }
      const descriptive = selectedKeys.map((c) =>
        describeColumn(c, colTypeByName.get(c) ?? 'string', rowWrappers.map((w) => w.values[c]), roleByName.get(c) ?? null),
      );
      const imbalance = evaluateImbalance(labelColumn, labelDataType, rows, labelRole);
      // Đợt H: cột giá trị có vai trò định danh/văn bản → bỏ, chỉ đếm số dòng theo kỳ, ghi lý do
      const valueIgnoredReason = valueColumn && (valueRole === 'identifier' || valueRole === 'text')
        ? `value_column_is_${valueRole}` : null;
      const timeAnalysis = analyzeTime(
        timeColumn, valueIgnoredReason ? null : valueColumn, rows, cfgGranularity as 'day' | 'week' | 'month' | 'year',
        cols.map((c) => ({ name: c.name, dataType: c.dataType })),
        valueIgnoredReason,
      );
      // Dot G: nhom Nghi van — chi luu noi bo cho Tong ket/PDF, khong tra trong API ket qua, khong gui AI
      const suspicions = detectSuspicions(
        selectedCols.map((c) => ({ name: c.name, dataType: c.dataType, role: roleByName.get(c.name) ?? null, isPii: Boolean(c.isPii) })),
        rows,
      );
      charts.timeSeries = timeAnalysis.status === 'evaluated'
        ? timeAnalysis.buckets.map((b) => ({ period: b.period, recordCount: b.recordCount }))
        : null;
      const evidenceDocs: { analysis_run_id: unknown; project_id: unknown; dataset_id: unknown; column: string; row_index: number; kind: 'missing' | 'duplicate' | 'invalid_type' | 'outlier'; reason: string | null; value_masked: string | null }[] = [];
      const perColCount = new Map<string, number>();
      const pushEv = (column: string, rowIndex: number, kind: 'missing' | 'duplicate' | 'invalid_type' | 'outlier', reason: string | null, raw: unknown): void => {
        const used = perColCount.get(column) ?? 0;
        if (used >= 20) return;
        perColCount.set(column, used + 1);
        const masked: string | null = kind === 'missing' ? null : maskOf(column, raw);
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
      for (const c of selectedKeys) {
        let n = 0;
        for (const w of rowWrappers) {
          if (n >= 20) break;
          const v = w.values[c];
          if (isMissingCell(v)) continue;
          const chk = isValidByType(v, colTypeByName.get(c) ?? 'string', dateOrderByCol.get(c) ?? 'either');
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
      const wrapperByRowIndex = new Map(rowWrappers.map((w) => [w.rowIndex, w] as const));
      for (const [col, out] of outlierByCol) {
        for (const ri of out.union.slice(0, 20)) {
          pushEv(col, ri, 'outlier', out.reason ?? 'dq04_outlier', wrapperByRowIndex.get(ri)?.values[col] ?? null);
        }
      }
      // Đợt F: mẫu gửi AI = ô LỖI (sai kiểu, ngoại lệ, trùng) đã che, tối đa 20 ô/cột
      const maskedSamples: Record<string, string[]> = {};
      const dupRowIndexes = dqBase.duplicateGroups.flatMap((g) => g.rowIndexes as number[]);
      for (const col of analyzable) {
        if (col.role === 'excluded') continue;
        const samples: string[] = [];
        const add = (raw: unknown): void => {
          if (samples.length >= 20) return;
          const m = maskOf(col.key, raw);
          if (m !== null) samples.push(m);
        };
        const dt = colTypeByName.get(col.key) ?? 'string';
        for (const w of rowWrappers) {
          if (samples.length >= 20) break;
          const v = w.values[col.key];
          if (!isMissingCell(v) && !isValidByType(v, dt, dateOrderByCol.get(col.key) ?? 'either').valid) add(v);
        }
        for (const ri of outlierByCol.get(col.key)?.union ?? []) add(wrapperByRowIndex.get(ri)?.values[col.key]);
        for (const ri of dupRowIndexes) add(wrapperByRowIndex.get(ri)?.values[col.key]);
        maskedSamples[col.key] = samples;
      }
      await this.analysisRepository.insertEvidences(
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
        charts,
        column_roles: columnRoles,
        ai_samples: maskedSamples,
        suspicions,
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
            analysisRole: roleByName.get(c.key),
            usedRows: usedPerColumn.get(c.key)?.used ?? 0,
            excludedRows: usedPerColumn.get(c.key)?.excluded ?? 0,
          })),
        cells: cells as unknown as CorrV1Context['cells'],
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
      await this.publishLifecycle({
        eventType: 'ANALYSIS_COMPLETED',
        projectId,
        workspaceId: String(project.workspaceId),
        runId: run.id,
        actorId: run.startedBy ? String(run.startedBy) : null,
      });

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
      await this.publishLifecycle({
        eventType: 'ANALYSIS_FAILED',
        projectId,
        workspaceId: String(project.workspaceId),
        runId: run.id,
        actorId: run.startedBy ? String(run.startedBy) : null,
        errorCode: 'ANALYSIS_FAILED',
      });
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
    await this.staleness.assess(projectId, run, result); // D2: ghi is_stale neu dataset/cot da doi
    return this.toApiShape(result.id, run.id, result.inputFingerprint, null, null);
  }

  /**
   * Phan 6 v7 muc 3.20 — route `analysis/jobs/:jobId*` khong co projectId tren URL:
   * tai job -> project, kiem vai tro cua nguoi goi trong project. Khong du quyen -> 404
   * (khong lo su ton tai cua job). `write=true` doi hoi PROJ-MEMBER+ (Viewer khong duoc thu lai).
   */
  async assertJobAccess(
    jobId: string,
    actor: { userId: string; role?: string },
    write = false,
  ): Promise<void> {
    if (actor.role === 'admin') return;
    const job = await this.analysisRepository.findJobById(jobId);
    const projectId = job?.projectId ? String(job.projectId) : null;
    if (!job || !projectId) throw new NotFoundException('Không tìm thấy AI job');
    await this.projectAccess.assertProjectAccess(projectId, actor, write ? 'write' : 'read', 'Không tìm thấy AI job');
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
    if (!RETRYABLE_JOB_STATUSES.has(job.status)) {
      throw new ConflictException({
        message: `AI job đang ở trạng thái '${job.status}' — chỉ thử lại job failed/skipped`,
        error: 'AI_JOB_NOT_RETRYABLE',
        details: { jobId, status: job.status },
      } as never);
    }
    const runId = job.analysisRunId ? String(job.analysisRunId) : null;
    const result = runId ? await this.analysisRepository.findResultByRun(runId) : null;
    const run = runId ? await this.analysisRepository.findById(runId) : null;
    const fresh = result && job.projectId
      ? await this.staleness.assess(String(job.projectId), run, result)
      : { isStale: true, staleReason: 'result_missing' };
    if (!result || fresh.isStale) {
      throw new ConflictException({
        message: 'Kết quả phân tích đã lỗi thời — hãy chạy lại phân tích thay vì thử lại AI',
        error: 'ANALYSIS_RESULT_STALE',
        details: { jobId, staleReason: fresh.staleReason ?? 'result_missing' },
      } as never);
    }
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
    const runIdForEvent = String(job.analysisRunId);
    const runForEvent = await this.analysisRepository.findById(runIdForEvent).catch(() => null);
    await this.publishLifecycle({
      eventType: status === 'succeeded' ? 'AI_JOB_SUCCEEDED' : 'AI_JOB_FAILED',
      projectId: String(job.projectId),
      workspaceId: runForEvent ? String(runForEvent.workspaceId) : null,
      runId: runIdForEvent,
      actorId: runForEvent?.startedBy ? String(runForEvent.startedBy) : null,
      jobId,
      errorCode: status === 'succeeded' ? null : 'AI_GROUNDING_FAILED',
    });
    return {
      jobId,
      status,
      assessment: updated?.aiCorrelationAssessment ?? grounded,
    };
  }

  /**
   * Worker AI het luot: ghi danh gia AI `failed` (ket qua he thong van dung duoc) + su kien AI_JOB_FAILED.
   * Khong dung `ingestAiResult({})` — `{}` hop le theo schema corr-v1 nen bi ghi nham thanh `succeeded`.
   * Trang thai/ma loi cua job do worker ghi.
   */
  async markAiFailed(jobId: string, errorCode: string, message: string): Promise<void> {
    const job = await this.analysisRepository.findJobById(jobId);
    if (!job?.analysisRunId) return;
    const runId = String(job.analysisRunId);
    const result = await this.analysisRepository.findResultByRun(runId);
    if (result) {
      const prev = (result.aiCorrelationAssessment ?? {}) as Record<string, unknown>;
      await this.analysisRepository.updateResultById(result.id, {
        aiCorrelationAssessment: {
          status: 'failed',
          notablePairs: [],
          highVif: [],
          limits: [],
          nextSteps: [],
          modelId: job.modelId ?? null,
          promptVersion: prev.promptVersion ?? 'corr-v1',
          error: `${errorCode}: ${message}`.slice(0, 500),
          droppedClaims: [],
        },
      });
    }
    try {
      this.realtime?.emitAnalysisLifecycle(String(job.projectId), runId, 'ai.job.status', { status: 'failed', jobId, attempt: job.attempt });
    } catch {
      // realtime không bao giờ làm hỏng luồng nghiệp vụ chính
    }
    const run = await this.analysisRepository.findById(runId).catch(() => null);
    await this.publishLifecycle({
      eventType: 'AI_JOB_FAILED',
      projectId: String(job.projectId),
      workspaceId: run ? String(run.workspaceId) : null,
      runId,
      actorId: run?.startedBy ? String(run.startedBy) : null,
      jobId,
      errorCode,
    });
  }

  async saveConfig(projectId: string, dto: AnalysisConfigInput): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    const project = await this.projectsService.getProjectById(projectId);
    const dataset = await this.datasetsRepository.findByProject(projectId);
    const cols = dataset?.columns ?? [];
    // D2: nhan ten hien tai / key / ten goc; LUU KEY bat bien de doi ten cot khong lam hong cau hinh
    const toKey = (ref: string | null | undefined, field: string): string | null => {
      if (ref === undefined || ref === null || ref === '') return null;
      const c = resolveColumnRef(ref, cols);
      if (!c) throw new BadRequestException(`${field} không khớp cột nào của dataset: ${ref}`);
      return c.key;
    };
    let selected: string[] | null = null;
    if (dto.selected_columns !== undefined && dto.selected_columns !== null) {
      const missing = dto.selected_columns.filter((ref) => !resolveColumnRef(ref, cols));
      if (missing.length > 0) {
        throw new BadRequestException(`selected_columns không khớp cột nào của dataset: ${missing.join(', ')}`);
      }
      selected = [...new Set(dto.selected_columns.map((ref) => (resolveColumnRef(ref, cols) as { key: string }).key))];
    }
    const label = toKey(dto.label_column, 'label_column');
    const time = toKey(dto.time_column, 'time_column');
    const value = toKey(dto.value_column, 'value_column');
    const typeOf = (key: string | null): string | undefined => cols.find((c) => c.key === key)?.dataType;
    // Đợt H (Phần 7 v10 mục 3.21): nhãn được là cột số (vd 0/1); có đánh giá mất cân bằng hay không
    // quyết theo vai trò hiệu lực lúc chạy phân tích. Chỉ cột ngày bị từ chối.
    if (label && typeOf(label) === 'date') {
      throw new BadRequestException('label_column không được là cột ngày');
    }
    if (time && typeOf(time) !== 'date') throw new BadRequestException('time_column phải là cột date');
    if (value && typeOf(value) !== 'number') throw new BadRequestException('value_column phải là cột số');
    // Đợt F (Phần 7 v8 mục 3.19): ghi đè vai trò cột theo key
    let columnRoles: Record<string, string> | undefined;
    if (dto.column_roles !== undefined) {
      columnRoles = {};
      for (const [key, role] of Object.entries(dto.column_roles ?? {})) {
        const c = cols.find((x) => x.key === key);
        if (!c) {
          throw new BadRequestException({ message: `column_roles có key không tồn tại: ${key}`, error: 'unknown_column', details: { key } } as never);
        }
        if (!isRoleAllowedForType(role as AnalysisRole, c.dataType)) {
          throw new BadRequestException({
            message: `Vai trò ${role} không hợp lệ cho cột ${c.name} (kiểu ${c.dataType})`,
            error: 'invalid_column_role',
            details: { key, role, dataType: c.dataType },
          } as never);
        }
        columnRoles[key] = role;
      }
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
      chart_top_n: dto.chart_top_n ?? 5,
      ...(columnRoles !== undefined ? { column_roles: columnRoles } : {}),
    });
    await this.analysisRepository.markResultsStale(projectId, '000000000000000000000000', 'config_changed');
    return this.configShape(projectId, saved, cols);
  }

  async getConfig(projectId: string): Promise<Record<string, unknown>> {
    if (!isObjectIdHex(projectId)) throw new BadRequestException('ID Dự án không hợp lệ');
    await this.projectsService.getProjectById(projectId);
    const saved = await this.analysisRepository.findConfigByProject(projectId);
    if (!saved) {
      return {
        projectId, selectedColumns: null, selectedColumnRefs: null, labelColumn: null, labelColumnRef: null,
        timeColumn: null, timeColumnRef: null, timeGranularity: 'day', valueColumn: null, valueColumnRef: null,
        correlationMethod: 'pearson', outlierMethod: 'iqr', topN: 50, chartTopN: 5, columnRoles: {},
      };
    }
    const dataset = await this.datasetsRepository.findByProject(projectId).catch(() => null);
    return this.configShape(projectId, saved, dataset?.columns ?? []);
  }

  /**
   * Tra cau hinh voi TEN cot hien tai (tuong thich nguoc) + `*Ref` {key, name}.
   * Cau hinh cu luu theo ten van doc duoc (resolveColumnRef khop ten). Cot da mat -> name null.
   */
  private configShape(
    projectId: string,
    saved: { selectedColumns: string[] | null; labelColumn: string | null; timeColumn: string | null; timeGranularity: string; valueColumn: string | null; correlationMethod?: string; outlierMethod?: string; topN?: number; chartTopN?: number; columnRoles?: Record<string, string> | null },
    cols: { key: string; name: string; originalName?: string | null; dataType: string }[],
  ): Record<string, unknown> {
    const ref = (r: string | null): { key: string; name: string | null } | null => {
      if (!r) return null;
      const c = resolveColumnRef(r, cols);
      return c ? { key: c.key, name: c.name } : { key: r, name: null };
    };
    const selectedRefs = saved.selectedColumns ? saved.selectedColumns.map((r) => ref(r) as { key: string; name: string | null }) : null;
    const labelRef = ref(saved.labelColumn);
    const timeRef = ref(saved.timeColumn);
    const valueRef = ref(saved.valueColumn);
    return {
      projectId,
      selectedColumns: selectedRefs ? selectedRefs.map((r) => r.name).filter((n): n is string => n !== null) : null,
      selectedColumnRefs: selectedRefs,
      labelColumn: labelRef?.name ?? null,
      labelColumnRef: labelRef,
      timeColumn: timeRef?.name ?? null,
      timeColumnRef: timeRef,
      timeGranularity: saved.timeGranularity,
      valueColumn: valueRef?.name ?? null,
      valueColumnRef: valueRef,
      correlationMethod: saved.correlationMethod,
      outlierMethod: saved.outlierMethod,
      topN: saved.topN,
      chartTopN: saved.chartTopN ?? 5,
      columnRoles: saved.columnRoles ?? {},
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
    const recordRows = await this.records.listAllRecords(job.datasetId);
    const keyToName = new Map((dataset?.columns ?? []).map((c) => [c.key, c.name] as const));
    const rows: Record<string, unknown>[] = recordRows.map((r) =>
      toNamedRow(r as unknown as { props?: Record<string, unknown> }, keyToName),
    );
    const roleByKey = new Map<string, string>();
    if (dataset) {
      for (const c of dataset.columns) {
        roleByKey.set(c.name, classifyColumn(c.dataType));
      }
    }
    // Đợt F: vai trò cột + mẫu ô lỗi đã che lưu sẵn ở kết quả (kết quả cũ không có → không gửi mẫu)
    const analysisRoleByName = new Map<string, string>();
    if (Array.isArray(result.columnRoles)) {
      for (const r of result.columnRoles as { name?: unknown; role?: unknown }[]) {
        if (typeof r.name === 'string' && typeof r.role === 'string') analysisRoleByName.set(r.name, r.role);
      }
    }
    const maskedSamples: Record<string, string[]> = result.aiSamples ?? {};
    const columns = result.correlationMatrix.columns.map((key) => {
      let used = 0;
      for (const row of rows) {
        const v = row[key];
        if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) continue;
        used++;
      }
      const analysisRole = analysisRoleByName.get(key);
      const role = analysisRole ? (analysisRole === 'measure' ? 'numeric' : 'categorical') : roleByKey.get(key) ?? 'unknown';
      return { key, role, ...(analysisRole ? { analysisRole } : {}), usedRows: used, excludedRows: rows.length - used };
    });
    const storedExcluded = (result.correlationMatrix as { excludedColumns?: { column: string; reason: string }[] }).excludedColumns;
    const excludedColumns = Array.isArray(storedExcluded) ? storedExcluded : (dataset?.columns ?? [])
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
      isStale: result.isStale,
      staleReason: result.staleReason ?? null,
      dq05: result.dq05,
      dqSummary: (result as unknown as { dq_summary?: unknown }).dq_summary ?? null,
      descriptive: (result as unknown as { descriptive?: unknown }).descriptive ?? null,
      imbalance: (result as unknown as { imbalance?: unknown }).imbalance ?? null,
      timeAnalysis: (result as unknown as { timeAnalysis?: unknown }).timeAnalysis ?? null,
      charts: result.charts ?? null,
      columnRoles: result.columnRoles ?? null,
      evidenceSummary: (result as unknown as { evidenceSummary?: unknown }).evidenceSummary ?? null,
      correlationMatrix: result.correlationMatrix,
      vif: result.vif,
      aiCorrelationAssessment: result.aiCorrelationAssessment,
      pollUrl: jobId ? `/api/v1/analysis/jobs/${jobId}` : undefined,
      corrV1PromptPreview: promptPreview ?? undefined,
    };
  }
}
