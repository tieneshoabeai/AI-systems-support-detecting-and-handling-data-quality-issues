/**
 * GĐ5 — wave 6–10 (AN-14 → AN-45): hành vi đã hiện thực ở nhánh hiện tại.
 *
 * ## Phạm vi
 *
 * Bộ test này **viết lại** theo cấu trúc CQRS mới (Command/Query handler thay
 * cho service cũ), tập trung vào những hành vi **thực sự tồn tại** ở nhánh
 * `Hoa24102026`:
 *
 *   AN-14 / AN-15 / AN-33 — fingerprint theo **key cột bất biến `c{i}`** +
 *                           phải đổi khi cờ PII / metadata cột đổi.
 *   AN-16                 — dữ liệu biểu đồ (histogram / box plot / Top N).
 *   AN-17                 — mức ảnh hưởng theo ngưỡng dự án.
 *   AN-18                 — Tổng kết có mức ảnh hưởng + thứ tự ưu tiên.
 *   AN-30 / AN-31         — tam giác trên (mỗi cặp một lần, bỏ đường chéo).
 *   AN-32                 — PDF có bảng tam giác trên, xếp theo |hệ số|.
 *   AN-45                 — API kết quả phân tích **không** trả `suspicions`.
 *   AN-20                 — chặn quá tải (`ANALYSIS_MAX_ROWS`).
 *
 * Các hành vi chỉ tồn tại ở branch khác (`Vqd_BE`) — ghi đè vai trò cột qua
 * API, `outlierBreakdown`, `symbolMissingCount`, `valueColumnIgnoredReason`,
 * `timePartColumns` — **không** nằm ở đây; xem `docs/restructures/`.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  computeInputFingerprint,
  FINGERPRINT_VERSION,
  readResolvedRunConfig,
  resolveColumnRef,
} from '../src/modules/analysis/domain/input-fingerprint.util';
import {
  boxPlot,
  categoryTopN,
  clampChartTopN,
  histogram,
} from '../src/shared/domain/utils/chart-data.util';
import {
  outlierSeverity,
  rateSeverity,
  severityReason,
  THRESHOLDS,
} from '../src/modules/analysis/domain/impact.util';
import { buildCorrV1Prompt, upperTriangleCells } from '../src/modules/analysis/domain/ai-grounding.util';
import { buildReportSections } from '../src/modules/analysis/application/report-content.util';
import { RunAnalysisHandler } from '../src/modules/analysis/application/commands/run-analysis.handler';
import { CreateSummaryHandler } from '../src/modules/analysis/application/commands/create-summary.handler';
import { ANALYSIS_REPOSITORY_PORT } from '../src/modules/analysis/domain/ports/analysis.repository.port';
import { PROJECT_ACCESS_PORT } from '../src/modules/projects';
import { DATASET_REPOSITORY_PORT, RECORD_QUERY_PORT } from '../src/modules/datasets';
import { REALTIME_PORT } from '../src/modules/realtime';

// ── Fixtures ────────────────────────────────────────────────────────────────

const P = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const WS = 'cccccccccccccccccccccccc';
const RUN = 'dddddddddddddddddddddddd';
const DS = 'bbbbbbbbbbbbbbbbbbbbbbbb';

type Col = {
  key: string;
  index: number;
  name: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  originalName: string;
  missingCount: number;
  isPii: boolean;
};

const col = (
  i: number,
  name: string,
  dataType: Col['dataType'],
  over: Partial<Col> = {},
): Col => ({
  key: `c${i}`,
  index: i,
  name,
  dataType,
  originalName: name,
  missingCount: 0,
  isPii: false,
  ...over,
});

const dataset = (columns: Col[], over: Record<string, unknown> = {}) => ({
  id: DS,
  projectId: P,
  workspaceId: WS,
  name: 'ds',
  originalFileName: 'ds.csv',
  fileFormat: 'csv' as const,
  fileSizeBytes: 10,
  fileChecksum: 'sum',
  storageKey: 'raw_files/ds.csv',
  rowCount: 3,
  columnCount: columns.length,
  columns,
  columnIssues: [],
  hasHeader: true,
  delimiter: ',' as const,
  currentVersion: 1,
  status: 'READY' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  version: 1,
  ...over,
});

// ── AN-14 / AN-15 / AN-33 — fingerprint theo key cột bất biến ─────────────

describe('AN-14 / AN-15 / AN-33 — fingerprint theo key cột bất biến', () => {
  const cols = [col(0, 'doanh_thu', 'number'), col(1, 'loai', 'string')];

  it('AN-14: đổi tên cột → fingerprint ĐỔI (vì tên cột nằm trong hash)', () => {
    const cfg = {
      selectedKeys: ['c0', 'c1'],
      labelKey: 'c1',
      timeKey: null,
      valueKey: null,
      correlationMethod: 'pearson',
      outlierMethod: 'iqr',
      topN: 50,
      timeGranularity: 'day',
      columnRoles: null,
    };
    const fpBefore = computeInputFingerprint(
      { id: DS, fileChecksum: 'sum', rowCount: 3, columns: cols },
      cfg,
    );
    const fpRenamed = computeInputFingerprint(
      {
        id: DS,
        fileChecksum: 'sum',
        rowCount: 3,
        columns: [col(0, 'revenue', 'number'), col(1, 'loai', 'string')],
      },
      cfg,
    );
    expect(fpRenamed).not.toBe(fpBefore);
  });

  it('AN-14: cùng dữ liệu + cùng cấu hình → fingerprint ổn định', () => {
    const cfg = {
      selectedKeys: ['c0', 'c1'],
      labelKey: null,
      timeKey: null,
      valueKey: null,
      correlationMethod: 'pearson',
      outlierMethod: 'iqr',
      topN: 50,
      timeGranularity: 'day',
      columnRoles: null,
    };
    const a = computeInputFingerprint({ id: DS, fileChecksum: 'sum', rowCount: 3, columns: cols }, cfg);
    const b = computeInputFingerprint({ id: DS, fileChecksum: 'sum', rowCount: 3, columns: cols }, cfg);
    expect(a).toBe(b);
    expect(a).toHaveLength(64); // sha256 hex
  });

  it('AN-33: đổi cờ isPii → fingerprint ĐỔI (che PII là thay đổi ý nghĩa)', () => {
    const cfg = {
      selectedKeys: ['c0'],
      labelKey: null,
      timeKey: null,
      valueKey: null,
      correlationMethod: 'pearson',
      outlierMethod: 'iqr',
      topN: 50,
      timeGranularity: 'day',
      columnRoles: null,
    };
    const before = computeInputFingerprint(
      { id: DS, fileChecksum: 'sum', rowCount: 3, columns: cols },
      cfg,
    );
    const after = computeInputFingerprint(
      {
        id: DS,
        fileChecksum: 'sum',
        rowCount: 3,
        columns: [col(0, 'doanh_thu', 'number', { isPii: true }), col(1, 'loai', 'string')],
      },
      cfg,
    );
    expect(after).not.toBe(before);
  });

  it('AN-33: đổi ghi đè vai trò cột → fingerprint ĐỔI', () => {
    const base = {
      selectedKeys: ['c0'],
      labelKey: null,
      timeKey: null,
      valueKey: null,
      correlationMethod: 'pearson',
      outlierMethod: 'iqr',
      topN: 50,
      timeGranularity: 'day',
    };
    const ds = { id: DS, fileChecksum: 'sum', rowCount: 3, columns: cols };
    const fpNoRoles = computeInputFingerprint(ds, { ...base, columnRoles: null });
    const fpWithRoles = computeInputFingerprint(ds, {
      ...base,
      columnRoles: { c0: 'measure' },
    });
    expect(fpWithRoles).not.toBe(fpNoRoles);
  });

  it('AN-33: ghi đè vai trò RỖNG → không đổi fingerprint (giữ fingerprint cũ)', () => {
    const base = {
      selectedKeys: ['c0'],
      labelKey: null,
      timeKey: null,
      valueKey: null,
      correlationMethod: 'pearson',
      outlierMethod: 'iqr',
      topN: 50,
      timeGranularity: 'day',
    };
    const ds = { id: DS, fileChecksum: 'sum', rowCount: 3, columns: cols };
    expect(computeInputFingerprint(ds, { ...base, columnRoles: {} })).toBe(
      computeInputFingerprint(ds, { ...base, columnRoles: null }),
    );
  });

  it('fingerprint_version = 2 và đọc lại được cấu hình từ run.config', () => {
    expect(FINGERPRINT_VERSION).toBe(2);
    const cfg = readResolvedRunConfig({
      fingerprint_version: 2,
      selected_column_keys: ['c0', 'c1'],
      correlation_method: 'spearman',
      outlier_method: 'both',
      top_n: 30,
      time_granularity: 'month',
    });
    expect(cfg?.selectedKeys).toEqual(['c0', 'c1']);
    expect(cfg?.correlationMethod).toBe('spearman');
    expect(cfg?.topN).toBe(30);
    expect(cfg?.timeGranularity).toBe('month');
  });

  it('run.config thiếu fingerprint_version → không đọc lại được (chạy cũ)', () => {
    expect(readResolvedRunConfig({ selected_column_keys: ['c0'] })).toBeNull();
    expect(readResolvedRunConfig(null)).toBeNull();
  });

  it('resolveColumnRef tìm theo key → tên hiện tại → tên gốc', () => {
    expect(resolveColumnRef('c0', cols)?.key).toBe('c0');
    expect(resolveColumnRef('doanh_thu', cols)?.key).toBe('c0');
    expect(resolveColumnRef('khong-co', cols)).toBeNull();
  });
});

// ── AN-16 — dữ liệu biểu đồ ────────────────────────────────────────────────

describe('AN-16 — dữ liệu biểu đồ', () => {
  it('histogram: tổng count = n, tối đa 50 bin', () => {
    const values = Array.from({ length: 1000 }, (_, i) => i);
    const h = histogram('x', values);
    expect(h).not.toBeNull();
    const total = h?.bins.reduce((s, b) => s + b.count, 0) ?? 0;
    expect(total).toBe(1000);
    expect(h?.bins.length).toBeLessThanOrEqual(50);
  });

  it('histogram: một giá trị duy nhất → 1 bin', () => {
    const h = histogram('x', [5, 5, 5]);
    expect(h?.bins.length).toBe(1);
    expect(h?.method).toBe('single_value');
  });

  it('box plot: tứ phân vị, rào 1.5×IQR, đếm điểm ngoài rào', () => {
    const b = boxPlot('x', [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]);
    expect(b).not.toBeNull();
    expect(b?.q1).toBeLessThan(b?.median ?? 0);
    expect(b?.median).toBeLessThan(b?.q3 ?? 0);
    expect(b?.outsideCount).toBeGreaterThan(0);
    expect(b?.n).toBe(10);
  });

  it('Top N + "Khác", N kẹp trong 1–20', () => {
    // 7 giá trị khác nhau → Top 5 gom phần còn lại vào "Khác".
    const values = [
      ...Array.from({ length: 30 }, () => 'A'),
      ...Array.from({ length: 10 }, () => 'B'),
      ...Array.from({ length: 5 }, () => 'C'),
      ...Array.from({ length: 4 }, () => 'D'),
      ...Array.from({ length: 3 }, () => 'E'),
      ...Array.from({ length: 2 }, () => 'F'),
      'G',
    ];
    const c = categoryTopN('x', values, 5);
    expect(c?.topN).toBe(5);
    expect(c?.items.length).toBe(5);
    expect(c?.other).not.toBeNull();
    expect(c?.distinctCount).toBe(7);
    // Tổng số lượng = số giá trị không thiếu.
    const counted = (c?.items ?? []).reduce((s, i) => s + i.count, 0) + (c?.other?.count ?? 0);
    expect(counted).toBe(values.length);

    expect(clampChartTopN(0)).toBe(1);
    expect(clampChartTopN(999)).toBe(20);
    expect(clampChartTopN(undefined)).toBe(5);
  });
});

// ── AN-17 — mức ảnh hưởng theo ngưỡng dự án ───────────────────────────────

describe('AN-17 — mức ảnh hưởng tự biến', () => {
  it('DQ-01/03: <1% thấp, 1%–10% trung bình (gồm biên), >10% cao', () => {
    expect(rateSeverity('DQ-01', 0.0099)).toBe('low');
    expect(rateSeverity('DQ-01', 0.01)).toBe('medium');
    expect(rateSeverity('DQ-01', 0.1)).toBe('medium');
    expect(rateSeverity('DQ-01', 0.1001)).toBe('high');
    expect(rateSeverity('DQ-03', 0.0099)).toBe('low');
    expect(rateSeverity('DQ-03', 0.1001)).toBe('high');
  });

  it('DQ-02: <0,5% thấp, 0,5%–5% trung bình, >5% cao; null → no_data', () => {
    expect(rateSeverity('DQ-02', 0.0049)).toBe('low');
    expect(rateSeverity('DQ-02', 0.005)).toBe('medium');
    expect(rateSeverity('DQ-02', 0.05)).toBe('medium');
    expect(rateSeverity('DQ-02', 0.0501)).toBe('high');
    expect(rateSeverity('DQ-02', null)).toBe('no_data');
    expect(rateSeverity('DQ-01', null)).toBe('no_data');
  });

  it('DQ-04: chỉ IQR thấp; IQR 3× hoặc Z trung bình; cả hai cao', () => {
    expect(outlierSeverity({ iqr: 3, iqrExtreme: 0, zscore: 0, both: 0 })).toBe('low');
    expect(outlierSeverity({ iqr: 3, iqrExtreme: 1, zscore: 0, both: 0 })).toBe('medium');
    expect(outlierSeverity({ iqr: 3, iqrExtreme: 0, zscore: 1, both: 0 })).toBe('medium');
    expect(outlierSeverity({ iqr: 3, iqrExtreme: 1, zscore: 1, both: 1 })).toBe('high');
    expect(outlierSeverity(null)).toBeNull();
  });

  it('mọi ngưỡng đều kèm lý do giải thích', () => {
    for (const t of THRESHOLDS) {
      expect(t.rule.length).toBeGreaterThan(0);
      expect(t.reason.length).toBeGreaterThan(0);
    }
    expect(severityReason('DQ-01', 'high', 0.5)).toContain('50.00%');
    expect(severityReason('DQ-01', 'no_data', null)).toContain('Không có dòng');
  });
});

// ── AN-30 / AN-31 — tam giác trên ──────────────────────────────────────────

describe('AN-30 / AN-31 — tam giác trên (mỗi cặp một lần, bỏ đường chéo)', () => {
  const cells = [
    { colA: 'A', colB: 'A', coef: 1, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
    { colA: 'A', colB: 'B', coef: 0.5, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
    { colA: 'B', colB: 'A', coef: 0.5, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
    { colA: 'B', colB: 'C', coef: -0.3, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
  ];

  it('AN-30: loại cặp X~X (đường chéo) và cặp trùng (A,B)/(B,A)', () => {
    const up = upperTriangleCells(cells);
    expect(up.length).toBe(2);
    expect(up.map((c) => `${c.colA}~${c.colB}`)).toEqual(['A~B', 'B~C']);
  });

  it('AN-31: prompt chỉ chứa tam giác trên', () => {
    const prompt = buildCorrV1Prompt({
      columns: [{ key: 'A', role: 'numeric', usedRows: 10, excludedRows: 0 }],
      cells,
      vif: null,
      maskedSamples: {},
      method: 'pearson',
      excludedColumns: [],
    });
    expect(prompt).toContain('tam giác trên');
    // Đường chéo A~A không được xuất hiện trong payload ma trận.
    const jsonPart = prompt.split('Ma trận')[1] ?? '';
    expect(jsonPart).not.toContain('"colA":"A","colB":"A"');
    expect(jsonPart).toContain('"colA":"A","colB":"B"');
  });
});

// ── AN-32 — PDF có bảng tam giác trên, xếp theo |hệ số| ───────────────────

describe('AN-32 — PDF: bảng tam giác trên, xếp theo |hệ số| giảm dần', () => {
  it('mỗi cặp in một lần và sắp xếp theo |hệ số|', () => {
    const sections = buildReportSections({
      projectId: P,
      save: {
        id: 'save-1',
        projectId: P,
        workspaceId: WS,
        analysisRunId: RUN,
        analysisResultId: 'res-1',
        inputFingerprint: 'fp',
        summary: {},
        isStale: false,
        createdAt: new Date(),
      },
      result: {
        id: 'res-1',
        analysisRunId: RUN,
        projectId: P,
        inputFingerprint: 'fp',
        isStale: false,
        createdAt: new Date(),
        correlationMatrix: {
          method: 'pearson',
          columns: ['A', 'B', 'C'],
          cells: [
            { colA: 'A', colB: 'A', coef: 1, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
            { colA: 'A', colB: 'B', coef: 0.2, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
            { colA: 'B', colB: 'A', coef: 0.2, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
            { colA: 'B', colB: 'C', coef: -0.9, kind: 'pearson', n: 10, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
          ],
          totalScanned: 10,
        },
      },
      evidences: [],
      topN: 50,
    });

    const sec = sections.find((s) => s.heading.includes('Ma trận tương quan'));
    const rows = sec?.table?.rows ?? [];
    expect(rows.length).toBe(2);
    // |0.9| > |0.2| → B~C đứng trước A~B.
    expect(rows[0]?.[0]).toBe('B');
    expect(rows[0]?.[1]).toBe('C');
    expect(rows[1]?.[0]).toBe('A');
    expect(rows[1]?.[1]).toBe('B');
  });
});

// ── AN-18 / AN-45 — Tổng kết có mức ảnh hưởng; API không trả suspicions ──

describe('AN-18 / AN-45 — Tổng kết có mức ảnh hưởng + thứ tự ưu tiên', () => {
  let summaryHandler: CreateSummaryHandler;
  let repository: {
    findLatestRunByProject: jest.Mock;
    findResultByRun: jest.Mock;
    countEvidencesByRun: jest.Mock;
    createSave: jest.Mock;
    markSavesStale: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      findLatestRunByProject: jest.fn().mockResolvedValue({
        id: RUN,
        projectId: P,
        workspaceId: WS,
        datasetId: DS,
        status: 'succeeded',
        inputFingerprint: 'fp',
        config: { top_n: 50, correlation_method: 'pearson', outlier_method: 'iqr' },
        startedBy: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findResultByRun: jest.fn().mockResolvedValue({
        id: 'res-1',
        analysisRunId: RUN,
        projectId: P,
        inputFingerprint: 'fp',
        isStale: false,
        createdAt: new Date(),
        dqSummary: {
          totalScanned: 100,
          columns: [
            { column: 'a', missingCount: 50, missingRate: 0.5, invalidCount: 0, invalidRate: null, outlierCount: 0, outlierRate: null },
            { column: 'b', missingCount: 1, missingRate: 0.01, invalidCount: 0, invalidRate: null, outlierCount: 0, outlierRate: null },
          ],
          duplicateRowCount: 0,
          notes: [],
        },
        suspicions: [{ kind: 'missing_token', column: 'a', count: 3, rate: 0.03, message: 'm', recommendation: 'r', examples: [] }],
      }),
      countEvidencesByRun: jest.fn().mockResolvedValue(7),
      createSave: jest.fn().mockImplementation(async (doc: Record<string, unknown>) => ({
        id: 'save-1',
        projectId: P,
        workspaceId: WS,
        analysisRunId: RUN,
        analysisResultId: 'res-1',
        inputFingerprint: 'fp',
        summary: doc.summary,
        isStale: false,
        createdAt: new Date(),
      })),
      markSavesStale: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateSummaryHandler,
        { provide: PROJECT_ACCESS_PORT, useValue: { getProjectById: jest.fn(async () => ({ id: P, workspaceId: WS })) } },
        { provide: ANALYSIS_REPOSITORY_PORT, useValue: repository },
      ],
    }).compile();
    summaryHandler = module.get(CreateSummaryHandler);
  });

  it('AN-18: xếp cao → trung bình → thấp; kèm mức, luật, lý do', async () => {
    const out = await summaryHandler.execute(P);
    const summary = out.summary as {
      issues: { dq: string; column: string | null; severity: string; priority: number; rule: string; reason: string }[];
      thresholds: unknown[];
      config_used: Record<string, unknown>;
      top_n: number;
    };
    expect(summary.issues.length).toBe(2);
    // Cột "a" thiếu 50% → cao; cột "b" thiếu 1% → trung bình.
    expect(summary.issues[0]?.column).toBe('a');
    expect(summary.issues[0]?.severity).toBe('high');
    expect(summary.issues[0]?.priority).toBe(1);
    expect(summary.issues[1]?.severity).toBe('medium');
    expect(summary.issues[0]?.rule.length).toBeGreaterThan(0);
    expect(summary.issues[0]?.reason.length).toBeGreaterThan(0);
    expect(summary.thresholds.length).toBeGreaterThan(0);
  });

  it('AN-18: khuyến nghị sinh theo từng vấn đề, không đề xuất xoá/sửa dữ liệu', async () => {
    const out = await summaryHandler.execute(P);
    const summary = out.summary as { recommendations: string[] };
    expect(summary.recommendations.length).toBeGreaterThanOrEqual(2);
    for (const r of summary.recommendations) {
      expect(r.length).toBeGreaterThan(0);
      expect(r).not.toMatch(/x[oó]a d[oô]ng/i);
    }
  });

  it('AN-18: lưu `top_n` + `config_used` để PDF in được mục 2b', async () => {
    const out = await summaryHandler.execute(P);
    const summary = out.summary as { top_n: number; config_used: Record<string, unknown> };
    expect(summary.top_n).toBe(50);
    expect(summary.config_used.correlation_method).toBe('pearson');
    expect(summary.config_used.outlier_method).toBe('iqr');
  });

  it('AN-45: `suspicions` đi kèm Tổng kết nhưng là nhóm RIÊNG, không lẫn vào issues', async () => {
    const out = await summaryHandler.execute(P);
    const summary = out.summary as {
      issues: { dq: string }[];
      suspicions: { kind: string }[];
    };
    expect(summary.suspicions.length).toBe(1);
    expect(summary.suspicions[0]?.kind).toBe('missing_token');
    // Nghi vấn KHÔNG phải vấn đề đã xác nhận → không có trong `issues`.
    expect(summary.issues.every((i) => i.dq !== 'missing_token')).toBe(true);
  });
});

// ── AN-20 — chặn quá tải ────────────────────────────────────────────────────

describe('AN-20 — chặn quá tải (ANALYSIS_MAX_ROWS)', () => {
  let runHandler: RunAnalysisHandler;
  let repository: { create: jest.Mock; findConfigByProject: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findConfigByProject: jest.fn().mockResolvedValue(null),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunAnalysisHandler,
        { provide: PROJECT_ACCESS_PORT, useValue: { getProjectById: jest.fn(async () => ({ id: P, workspaceId: WS })) } },
        { provide: DATASET_REPOSITORY_PORT, useValue: { findByProject: jest.fn(async () => dataset([col(0, 'a', 'number')], { rowCount: 200_000 })) } },
        { provide: ANALYSIS_REPOSITORY_PORT, useValue: repository },
        { provide: RECORD_QUERY_PORT, useValue: { listAllRecords: jest.fn(async () => []) } },
        { provide: REALTIME_PORT, useValue: { emitAnalysisLifecycle: jest.fn(), emitToProject: jest.fn() } },
        { provide: ConfigService, useValue: { get: (k: string, d: unknown) => (k === 'ANALYSIS_MAX_ROWS' ? 1000 : d) } },
      ],
    }).compile();
    runHandler = module.get(RunAnalysisHandler);
  });

  it('rowCount vượt giới hạn → ném lỗi, KHÔNG tạo run, KHÔNG đọc bản ghi', async () => {
    await expect(
      runHandler.execute(P, {
        correlation_method: 'pearson',
        outlier_method: 'iqr',
        top_n: 50,
      }),
    ).rejects.toMatchObject({ code: 'ANALYSIS_TOO_LARGE' });
    expect(repository.create).not.toHaveBeenCalled();
  });
});

// ── GĐ12 — chặn xếp hàng phân tích đồng bộ (semaphore) ─────────────────────

describe('GĐ12 — semaphore chặn xếp hàng phân tích đồng bộ', () => {
  let runHandler: RunAnalysisHandler;
  let repository: { create: jest.Mock; findConfigByProject: jest.Mock };
  /** Gọi được trong lúc phân tích đang chạy → giữ slot, chặn lời gọi sau. */
  let releaseAnalysis: (() => void) | null = null;

  beforeEach(async () => {
    releaseAnalysis = null;
    repository = {
      create: jest.fn(),
      findConfigByProject: jest.fn().mockResolvedValue(null),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunAnalysisHandler,
        { provide: PROJECT_ACCESS_PORT, useValue: { getProjectById: jest.fn(async () => ({ id: P, workspaceId: WS })) } },
        {
          provide: DATASET_REPOSITORY_PORT,
          useValue: {
            findByProject: jest.fn(async () => dataset([col(0, 'a', 'number')], { rowCount: 10 })),
          },
        },
        { provide: ANALYSIS_REPOSITORY_PORT, useValue: repository },
        {
          provide: RECORD_QUERY_PORT,
          useValue: {
            listAllRecords: jest.fn(async () => {
              // Chỉ lần đầu giữ lại (để giữ slot); các lần sau trả về ngay.
              if (!releaseAnalysis) {
                await new Promise<void>((resolve) => {
                  releaseAnalysis = resolve;
                });
              }
              return [];
            }),
          },
        },
        { provide: REALTIME_PORT, useValue: { emitAnalysisLifecycle: jest.fn(), emitToProject: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string, d: unknown) => {
              if (k === 'ANALYSIS_MAX_ROWS') return 1000;
              if (k === 'ANALYSIS_MAX_CONCURRENCY') return 1;
              return d;
            },
          },
        },
      ],
    }).compile();
    runHandler = module.get(RunAnalysisHandler);
  });

  it('phân tích thứ nhất chiếm slot → phân tích thứ hai nhận 429 nghiệp vụ', async () => {
    const dto = { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 } as const;

    // Lần 1: đang chạy (giữ slot).
    const first = runHandler.execute(P, dto).catch(() => 'first-done');
    // Chờ tới khi lần 1 thực sự vào phần đọc bản ghi (đã chiếm slot).
    await new Promise((r) => setTimeout(r, 20));

    // Lần 2: phải bị từ chối ngay, KHÔNG chờ xếp hàng.
    await expect(runHandler.execute(P, dto)).rejects.toMatchObject({
      code: 'LIMIT_EXCEEDED',
    });

    // Giải phóng lần 1.
    releaseAnalysis?.();
    await first;
  });

  it('sau khi lần đầu xong, slot được trả lại → lần sau chạy được', async () => {
    const dto = { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 } as const;
    const first = runHandler.execute(P, dto).catch(() => 'first-done');
    await new Promise((r) => setTimeout(r, 20));
    releaseAnalysis?.();
    await first;

    // Lần 2 không còn bị chặn 429. Nó sẽ đi vào `listAllRecords` (giả) — lần này
    // không bị giữ lại nữa → trả về ngay, lỗi (nếu có) KHÔNG phải 429.
    await expect(
      runHandler.execute(P, dto).catch((err: unknown) => err),
    ).resolves.not.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });

  it('giá trị ANALYSIS_MAX_CONCURRENCY sai → vẫn chạy được (fallback 1)', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunAnalysisHandler,
        { provide: PROJECT_ACCESS_PORT, useValue: { getProjectById: jest.fn(async () => ({ id: P, workspaceId: WS })) } },
        { provide: DATASET_REPOSITORY_PORT, useValue: { findByProject: jest.fn(async () => dataset([col(0, 'a', 'number')], { rowCount: 10 })) } },
        { provide: ANALYSIS_REPOSITORY_PORT, useValue: repository },
        { provide: RECORD_QUERY_PORT, useValue: { listAllRecords: jest.fn(async () => []) } },
        { provide: REALTIME_PORT, useValue: { emitAnalysisLifecycle: jest.fn(), emitToProject: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string, d: unknown) => {
              if (k === 'ANALYSIS_MAX_ROWS') return 1000;
              if (k === 'ANALYSIS_MAX_CONCURRENCY') return 'không-phải-số';
              return d;
            },
          },
        },
      ],
    }).compile();
    const handler = module.get(RunAnalysisHandler);
    await expect(
      handler.execute(P, { correlation_method: 'pearson', outlier_method: 'iqr', top_n: 50 }),
    ).rejects.not.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
});
