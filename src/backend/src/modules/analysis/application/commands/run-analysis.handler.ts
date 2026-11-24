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
import {
  correlationExclusionReason,
  inferColumnRoles,
  type AnalysisRole,
} from '../../domain/column-role.util';
import { computeVif } from '../../domain/vif.util';
import { buildCorrV1Prompt, type CorrV1Context } from '../../domain/ai-grounding.util';
import { ConfigService } from '@nestjs/config';
import { RagFewShotService } from '../services/rag-few-shot.service';
import {
  computeDq0102,
  computeDq03,
  dateOrderOf,
  detectOutliers,
  isMissingCell,
  isValidByType,
} from '../../domain/dq.util';
import { detectSuspicions, type SuspicionColumn } from '../../domain/suspicion.util';
import { computeInputFingerprint } from '../../domain/input-fingerprint.util';
import {
  boxPlot,
  categoryTopN,
  clampChartTopN,
  histogram,
  type ChartData,
} from '../../../../shared/domain/utils/chart-data.util';
import { describeColumn, evaluateImbalance, analyzeTime, skewnessOf } from '../../domain/stats.util';
import { toFiniteNumber } from '../../domain/correlation.util';
import { RunAnalysisInput } from '../analysis.types';
import { maskSampleValue } from '../analysis.utils';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import {
  AnalysisConcurrencyGuard,
  assertAnalysisRowLimit,
  resolveAnalysisMaxConcurrency,
  resolveAnalysisMaxRows,
} from '../analysis-limit.util';

@Injectable()
export class RunAnalysisHandler {
  private readonly logger = new Logger(RunAnalysisHandler.name);
  /**
   * GĐ12 — semaphore giới hạn số phân tích đồng bộ chạy cùng lúc trong 1 tiến trình.
   *
   * Khởi tạo ở constructor vì `ANALYSIS_MAX_CONCURRENCY` là cấu hình ứng dụng
   * (đọc 1 lần khi khởi động, không đổi theo request).
   */
  private readonly concurrencyGuard: AnalysisConcurrencyGuard;

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
  ) {
    this.concurrencyGuard = new AnalysisConcurrencyGuard(
      resolveAnalysisMaxConcurrency(this.configService.get('ANALYSIS_MAX_CONCURRENCY')),
    );
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

  /**
   * GĐ12 — cổng vào của phân tích đồng bộ.
   *
   * Bọc toàn bộ việc tính toán trong {@link AnalysisConcurrencyGuard} để:
   *   1. Không cho quá N phân tích chạy đồng thời → **event loop không bị
   *      chặn bởi hàng đợi** (đo được: p95 endpoint khác nhảy 21 ms → 3,23 s
   *      khi 10 VU gọi phân tích đồng thời — xem `docs/test-reports/perf-2026-11-19.md`).
   *   2. Không đổi hợp đồng API: vẫn trả `201` khi thành công.
   *
   * Khi đã đủ slot → `RateLimitExceededError` → HTTP **429** kèm `Retry-After`.
   */
  async execute(
    projectId: string,
    dto: RunAnalysisInput,
    userId?: string,
  ): Promise<Record<string, unknown>> {
    return this.concurrencyGuard.run(() => this.executeAnalysis(projectId, dto, userId));
  }

  private async executeAnalysis(
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

    // GAP-003 — **gate lỗi tên cột**: dataset có cột rỗng / trùng / chỉ khoảng
    // trắng thì **không được phân tích** (UC-08 / §3.25).
    //
    // Vì sao chặn:
    // - Tên trùng → các bản đồ `key → tên` (label/time/value, role theo tên) sẽ
    //   đè lên nhau → tương quan tính nhầm cột, kết quả sai mà không báo lỗi.
    // - Tên rỗng → không hiển thị được trong báo cáo, người dùng không biết
    //   cột nào là cột nào.
    //
    // Vì sao **không** tự sửa: yêu cầu đã chốt là người dùng phải tự sửa tên
    // cột (hoặc reset về tên gốc) rồi mới chạy lại.
    //
    // Dùng `columnIssues.length` (không phải `hasColumnIssues()`) để tương thích
    // cả entity `Dataset` lẫn bản phẳng (một số adapter/test trả bản phẳng).
    const columnIssues = dataset.columnIssues ?? [];
    if (columnIssues.length > 0) {
      throw new ValidationError(
        `Dataset còn ${columnIssues.length} lỗi tên cột (rỗng/trùng/chỉ khoảng trắng) — cần sửa tên cột trước khi phân tích.`,
        {
          columnIssues: columnIssues.map((i) => ({
            columnKey: i.columnKey,
            issue: i.issue,
            message: i.message,
          })),
        },
      );
    }

    // GĐ0 — chặn sớm theo số dòng, TRƯỚC khi đọc bất kỳ record nào từ MongoDB.
    // Xem `analysis-limit.util.ts` để hiểu vì sao cần lớp chặn này.
    assertAnalysisRowLimit(
      dataset.rowCount,
      resolveAnalysisMaxRows(this.configService.get('ANALYSIS_MAX_ROWS')),
    );

    const allInferable = dataset.columns.filter((c) => classifyColumn(c.dataType) !== 'excluded');

    // OPEN-06 — cấu hình cột **tự suy luận**, không còn đọc từ DB.
    // Chọn toàn bộ cột suy luận được (loại cột kiểu không hỗ trợ tương quan).
    const selectedKeys = allInferable.map((c) => c.name);
    if (selectedKeys.length === 0) {
      throw new ValidationError('Không có cột suy luận được để phân tích (toàn bộ là date/không hỗ trợ)',);
    }

    const colTypeByName = new Map(dataset.columns.map((c) => [c.name, c.dataType] as const));

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

    // GĐ9 — Suy vai trò cột (đã port từ `Vqd_BE`: `column-role.util.ts`).
    //
    // Vì sao cần: trước đây mọi cột kiểu `string` đều được coi là `categorical`
    // và đưa vào tương quan. Với dataset thực tế (100k dòng, cột `review_id`
    // có ~99.000 giá trị khác nhau), Cramér V dựng ma trận `r × c` ≈ 9,8 tỷ ô
    // → V8 OOM (heap 4 GB) → sập server.
    //
    // Cột `identifier` / `text` / `datetime` **không có ý nghĩa thống kê** khi
    // tính tương quan, nên loại kèm lý do (đúng như `Vqd_BE` đang làm).
    //
    // OPEN-06: **không còn ghi đè vai trò thủ công** → `overrides = null`.
    const columnRoles = inferColumnRoles(
      dataset.columns.map((c) => ({ key: c.key, name: c.name, dataType: c.dataType })),
      rows,
    );
    const roleByName = new Map<string, AnalysisRole>(
      columnRoles.map((r) => [r.name, r.role] as const),
    );

    // ── Tự suy luận cột thời gian ─────────────────────────────────────────
    // Cột date duy nhất → chọn; nhiều hơn một → không tự chọn (tránh đoán bừa).
    const dateCols = dataset.columns.filter((c) => c.dataType === 'date').map((c) => c.name);
    const timeColumn = dateCols.length === 1 ? (dateCols[0] as string) : null;

    // ── Tự suy luận cột nhãn (phân loại) ─────────────────────────────────
    // Cột vai trò `category`, không phải cột thời gian. Chỉ chọn khi **đúng
    // một** cột phù hợp — nhiều hơn thì không đoán (để phân tích mất cân
    // bằng, vốn đã được báo ở `imbalance`).
    const labelCandidates = selectedKeys.filter(
      (name) => roleByName.get(name) === 'category' && name !== timeColumn,
    );
    const labelColumn = labelCandidates.length === 1 ? (labelCandidates[0] as string) : null;
    const labelDataType = labelColumn ? (colTypeByName.get(labelColumn) ?? null) : null;

    // ── Tự suy luận cột đo ────────────────────────────────────────────────
    // Cột vai trò `measure` (định lượng). Chỉ chọn khi **đúng một** cột.
    const measureCandidates = selectedKeys.filter((name) => roleByName.get(name) === 'measure');
    const valueColumn =
      measureCandidates.length === 1 ? (measureCandidates[0] as string) : null;

    const cfgGranularity = 'day' as const;
    const config = {
      selected_column_keys: selectedKeys,
      correlation_method: dto.correlation_method,
      outlier_method: dto.outlier_method,
      top_n: dto.top_n,
      chart_top_n: clampChartTopN(dto.chart_top_n),
      label_column: labelColumn,
      time_column: timeColumn,
      time_granularity: cfgGranularity,
      value_column: valueColumn,
    };
    // AN-33 — fingerprint phải đổi khi **cờ PII** hoặc **vai trò cột** của
    // người dùng đổi (nếu không, kết quả cũ vẫn "hiện hành" dù che PII đã
    // đổi → báo cáo có thể in dữ liệu đã đánh dấu PII).
    //
    // `computeInputFingerprint()` (domain/input-fingerprint.util.ts) băm theo
    // **key cột bất biến `c{i}`** + metadata cột (tên, kiểu, isPii) + cấu hình.
    const keyByName = new Map(dataset.columns.map((c) => [c.name, c.key] as const));
    const fp = computeInputFingerprint(
      {
        id: dataset.id,
        fileChecksum: dataset.fileChecksum,
        rowCount: dataset.rowCount,
        columns: dataset.columns.map((c) => ({
          key: c.key,
          name: c.name,
          originalName: c.originalName,
          dataType: c.dataType,
          isPii: c.isPii,
        })),
      },
      {
        selectedKeys: selectedKeys.map((n) => keyByName.get(n) ?? n),
        labelKey: labelColumn ? (keyByName.get(labelColumn) ?? null) : null,
        timeKey: timeColumn ? (keyByName.get(timeColumn) ?? null) : null,
        valueKey: valueColumn ? (keyByName.get(valueColumn) ?? null) : null,
        correlationMethod: dto.correlation_method,
        outlierMethod: dto.outlier_method,
        topN: dto.top_n,
        timeGranularity: cfgGranularity,
      },
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
      startedAt,
    });

    try {
      // GĐ9 — Lọc cột theo **vai trò** đã suy ở trên (`columnRoles`, `roleByName`).
      const analyzable: AnalyzableColumn[] = selectedKeys.map((key) => {
        const col = dataset.columns.find((c) => c.name === key);
        const typeRole = classifyColumn(col?.dataType ?? 'string');
        // Kiểu dữ liệu không hỗ trợ (date, unknown) → loại, trừ khi vai trò là datetime
        // (vẫn loại vì chưa chốt định nghĩa tương quan theo thời gian).
        if (typeRole === 'excluded') {
          return {
            key,
            role: 'excluded' as const,
            reason:
              col?.dataType === 'date'
                ? 'date_column_excluded_from_correlation_vif'
                : `unsupported_data_type_${col?.dataType ?? 'unknown'}`,
          };
        }
        // GĐ9 — loại theo vai trò suy ra được.
        const role = roleByName.get(key);
        const exclusion = role ? correlationExclusionReason(role) : null;
        if (exclusion) {
          return { key, role: 'excluded' as const, reason: exclusion };
        }
        return {
          key,
          role: role === 'measure' ? ('numeric' as const) : ('categorical' as const),
          reason: null,
          // GĐ2 — cột kiểu chữ: ký hiệu NA/None… là một lớp (chỉ ô trống là thiếu), đồng bộ DQ-01.
          textColumn: col?.dataType === 'string',
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
        // GĐ2 — role của cột để maskForAi quyết định raw/shape/***.
        const aiRole = roleByName.get(col.key) ?? null;
        for (const row of rows) {
          if (samples.length >= 20) break;
          const v = row[col.key];
          if (v === null || v === undefined || v === '') continue;
          const masked = maskSampleValue(v, markedPii, aiRole);
          if (masked === null) continue; // ô thiếu → bỏ qua
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
      // GĐ2 — thứ tự ngày/tháng (DD/MM hay MM/DD) của từng cột ngày; dùng chung cho DQ-03 / bằng chứng / mẫu AI.
      const dateOrderByCol = new Map(
        selectedKeys
          .filter((c) => colTypeByName.get(c) === 'date')
          .map((c) => [c, dateOrderOf(rowWrappers.map((w) => w.values[c]))] as const),
      );
      const dq03Rows = computeDq03(
        selectedKeys.map((c) => ({ column: c, dataType: colTypeByName.get(c) ?? 'string' })),
        rowWrappers,
      );
      const dq03ByCol = new Map(dq03Rows.map((r) => [r.column, r]));
      const outlierByCol = new Map<
        string,
        {
          union: number[];
          method: string;
          reason: string | null;
          /** GĐ7 — phân rã ngoại lệ theo từng phương pháp (IQR 1.5× / IQR 3× / Modified-Z / giao). */
          breakdown: {
            iqr: number;
            iqrExtreme: number;
            zscore: number;
            both: number;
          };
        }
      >();
      // GĐ7 — giá trị số hợp lệ theo cột (dùng cho skewness + giải thích DQ-04).
      const numericValues = new Map<string, number[]>();
      for (const key of selectedKeys) {
        if (colTypeByName.get(key) !== 'number') continue;
        const vals: { rowIndex: number; value: number }[] = [];
        const plain: number[] = [];
        for (const w of rowWrappers) {
          const v = w.values[key];
          if (isMissingCell(v)) continue;
          const chk = isValidByType(v, 'number');
          if (!chk.valid) continue;
          const n = toFiniteNumber(v);
          if (n !== null) {
            vals.push({ rowIndex: w.rowIndex, value: n });
            plain.push(n);
          }
        }
        numericValues.set(key, plain);
        const out = detectOutliers(key, vals, dto.outlier_method);
        outlierByCol.set(key, {
          union: out.union,
          method: dto.outlier_method,
          reason: out.reason,
          // GĐ7 — phân rã: `iqr` = ngưỡng 1.5×IQR, `iqrExtreme` = ngưỡng 3×IQR
          // (ngoại lệ "cực đoan"), `zscore` = Modified-Z 3.5, `both` = giao của
          // IQR 1.5× và Modified-Z (ngoại lệ mà **cả hai** phương pháp đều chỉ ra).
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
        // GĐ7 — chỉ cột `measure` mới có skewness (phân phối lệch chỉ có nghĩa
        // cho định lượng). Cột `identifier` toàn số 0/1 có skewness vô nghĩa.
        const xs = roleByName.get(c.column) === 'measure' ? (numericValues.get(c.column) ?? []) : [];
        const skewness = skewnessOf(xs);
        return {
          ...c,
          invalidCount: inv?.invalidCount ?? 0,
          invalidRate: inv?.invalidRate ?? null,
          // GĐ7 — số ô chứa ký hiệu trừ (vd "N/A", "-") bị loại khỏi DQ-01.
          // Quan trọng: ô này **không phải thiếu** theo DQ-01 (chuỗi khác rỗng),
          // nhưng cũng không phải giá trị hợp lệ → không được đếm vào mẫu số.
          symbolMissingCount: inv?.reasons['symbol_as_missing_excluded_from_dq01'] ?? 0,
          skewness,
          outlierCount,
          outlierRate:
            rowWrappers.length > 0 ? Number((outlierCount / rowWrappers.length).toFixed(4)) : null,
          // GĐ7 — phân rã ngoại lệ theo phương pháp (null = không có ngoại lệ nào).
          outlierBreakdown: out ? out.breakdown : null,
          // GĐ7 — vì sao cột số không có ngoại lệ: không phải cột định lượng.
          outlierSkippedReason:
            !out && colTypeByName.get(c.column) === 'number' ? 'not_measure_column' : null,
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
      // GĐ3 — dữ liệu biểu đồ cho phụ lục A của PDF báo cáo.
      //
      // Vẽ theo **vai trò cột** (GĐ9): cột đo (measure) → histogram/box plot;
      // cột phân loại (category) → Top N. Cột định danh/văn bản **không vẽ**
      // (không in tên người/mã định danh ra báo cáo) — cũng bỏ qua cột PII.
      const chartTopN = clampChartTopN(config.chart_top_n);
      const charts: ChartData = {
        missingRate: dqColumns.map((c) => ({
          column: c.column,
          missingRate: c.missingRate ?? null,
        })),
        histograms: [],
        boxPlots: [],
        categories: [],
        timeSeries: null,
      };
      // GĐ7 — `numericValues` đã được tính ở phần DQ-04 (phía trên) → dùng lại
      // cho biểu đồ, tránh quét lại toàn bộ dữ liệu lần nữa.
      for (const key of selectedKeys) {
        const role = roleByName.get(key);
        const dt = colTypeByName.get(key) ?? 'string';
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
      charts.timeSeries =
        timeAnalysis.status === 'evaluated'
          ? timeAnalysis.buckets.map((b) => ({
              period: b.period,
              recordCount: b.recordCount,
            }))
          : null;
      // GĐ2 — nhóm Nghi vấn: chỉ lưu nội bộ cho Tổng kết/PDF, KHÔNG trả trong API kết quả, KHÔNG gửi AI.
      const suspicionColumns: SuspicionColumn[] = selectedKeys.map((c) => {
        const col = dataset.columns.find((x) => x.name === c);
        return {
          name: c,
          dataType: colTypeByName.get(c) ?? 'string',
          role: roleByName.get(c) ?? null,
          isPii: Boolean(col?.isPii),
        };
      });
      const suspicions = detectSuspicions(suspicionColumns, rows);
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
          const mv = maskSampleValue(raw, isPii, roleByName.get(column) ?? null);
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
        // GĐ2 — nhóm Nghi vấn (nội bộ: Tổng kết/PDF; không trả trong API kết quả, không gửi AI).
        suspicions,
        // GĐ3 — vai trò cột + dữ liệu biểu đồ (phụ lục A của PDF báo cáo).
        columnRoles,
        charts,
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

      await this.analysisRepository.markResultsStale(projectId, run.id, 'superseded_by_new_run');

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
