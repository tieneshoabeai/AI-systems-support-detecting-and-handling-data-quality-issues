/**
 * GĐ3 — `report-content.util.ts`: dựng nội dung PDF báo cáo Tổng kết.
 *
 * Hàm thuần (không I/O) → test độc lập với worker. Trọng tâm:
 *   1. Đủ các section theo đúng thứ tự hợp đồng.
 *   2. Nghi vấn (GĐ2) nằm ở mục riêng "3b", KHÔNG lẫn vào Top phát hiện.
 *   3. Ma trận tương quan: mỗi cặp in một lần, bỏ đường chéo, xếp |coef| giảm dần.
 *   4. Bằng chứng đã che PII (chỉ in `valueMasked`).
 *   5. Không có kết quả phân tích → dừng ở mục 4, không crash.
 */
import { buildReportSections } from '../../../src/modules/analysis/application/report-content.util';
import type { PdfTable } from '../../../src/modules/analysis/application/pdf-builder.util';
import type {
  AnalysisResultRecord,
  CellEvidenceRecord,
  ProjectSaveRecord,
} from '../../../src/modules/analysis/domain/ports/analysis.repository.port';

// ── Helpers ─────────────────────────────────────────────────────────────────

const SAVE_ID = '65f0000000000000000000a1';
const PROJECT_ID = '65f0000000000000000000b2';

function buildSave(summary: Record<string, unknown> = {}): ProjectSaveRecord {
  return {
    id: SAVE_ID,
    projectId: PROJECT_ID,
    workspaceId: '65f0000000000000000000c3',
    analysisRunId: '65f0000000000000000000d4',
    analysisResultId: '65f0000000000000000000e5',
    inputFingerprint: 'abcdef0123456789abcdef0123456789',
    summary,
    isStale: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

function buildResult(over: Partial<AnalysisResultRecord> = {}): AnalysisResultRecord {
  return {
    id: '65f0000000000000000000e5',
    analysisRunId: '65f0000000000000000000d4',
    projectId: PROJECT_ID,
    datasetId: '65f0000000000000000000f6',
    inputFingerprint: 'abcdef0123456789',
    dq05: { status: 'unassessed', reason: 'no_rule_confirmed' },
    descriptive: [
      {
        column: 'Tuoi',
        dataType: 'number',
        count: 100,
        missingCount: 3,
        invalidCount: 1,
        mean: 30.5,
        median: 30,
        min: 18,
        max: 60,
        stdev: 8.1,
      },
    ],
    correlationMatrix: {
      method: 'pearson',
      columns: ['Tuoi', 'Luong'],
      cells: [
        { colA: 'Tuoi', colB: 'Tuoi', coef: 1, kind: 'pearson', n: 100, totalScanned: 100, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
        { colA: 'Tuoi', colB: 'Luong', coef: 0.42, kind: 'pearson', n: 98, totalScanned: 100, missingAOnly: 1, missingBOnly: 0, missingBoth: 1, computable: true, reason: null },
        { colA: 'Luong', colB: 'Tuoi', coef: 0.42, kind: 'pearson', n: 98, totalScanned: 100, missingAOnly: 1, missingBOnly: 0, missingBoth: 1, computable: true, reason: null },
        { colA: 'Luong', colB: 'Luong', coef: 1, kind: 'pearson', n: 100, totalScanned: 100, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
      ],
      excludedColumns: [{ column: 'MaDH', reason: 'identifier_not_unique' }],
      totalScanned: 100,
    },
    vif: {
      columns: ['Tuoi'],
      rows: [{ column: 'Tuoi', vif: 1.2, flag: 'ok', computable: true, reason: null }],
      commonN: 98,
      totalScanned: 100,
      commonNRate: 0.98,
      lossWarning: null,
      excluded: [],
    },
    imbalance: null,
    timeAnalysis: null,
    aiCorrelationAssessment: { status: 'succeeded', notablePairs: [], highVif: [], limits: [], nextSteps: [] },
    isStale: false,
    createdAt: new Date('2026-01-01'),
    ...over,
  };
}

const headings = (sections: { heading: string }[]): string[] => sections.map((s) => s.heading);

const findSection = (
  sections: { heading: string; lines: string[]; table?: PdfTable }[],
  needle: string,
) => sections.find((s) => s.heading.includes(needle));

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GĐ3 — buildReportSections: cấu trúc báo cáo', () => {
  it('có đủ các mục theo đúng thứ tự hợp đồng', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const hs = headings(sections);
    expect(hs[0]).toContain('Tổng quan');
    expect(hs.some((h) => h.includes('Top phát hiện'))).toBe(true);
    expect(hs.some((h) => h.includes('Khuyến nghị'))).toBe(true);
    expect(hs.some((h) => h.includes('nghi vấn'))).toBe(true);
    expect(hs.some((h) => h.includes('Ma trận tương quan'))).toBe(true);
    expect(hs.some((h) => h.includes('Đa cộng tuyến'))).toBe(true);
    expect(hs.some((h) => h.includes('Nhận xét AI'))).toBe(true);
    expect(hs.some((h) => h.includes('Thống kê mô tả'))).toBe(true);
    expect(hs.some((h) => h.includes('Bằng chứng'))).toBe(true);
    expect(hs.some((h) => h.includes('Ngưỡng và quy tắc'))).toBe(true);
  });

  it('mục Tổng quan nêu project, save, fingerprint, số bằng chứng', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave({ evidence_refs: 42, overview: 'Tóm tắt' }),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const overview = findSection(sections, 'Tổng quan');
    const text = overview?.lines.join('\n') ?? '';
    expect(text).toContain(PROJECT_ID);
    expect(text).toContain(SAVE_ID);
    expect(text).toContain('abcdef0123456789');
    expect(text).toContain('42');
    expect(text).toContain('Tóm tắt');
  });

  it('bản Tổng kết đã lỗi thời (isStale) được ghi rõ', () => {
    const save = buildSave();
    save.isStale = true;
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save,
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const text = findSection(sections, 'Tổng quan')?.lines.join('\n') ?? '';
    expect(text).toContain('LỖI THỜI');
  });
});

describe('GĐ3 — mục 2: Top phát hiện', () => {
  it('giới hạn theo top_n và có bảng đầy đủ', () => {
    const issues = Array.from({ length: 30 }, (_, i) => ({
      dq: 'DQ-01',
      column: `c${i}`,
      count: 100 - i,
      rate: 0.5,
      severity: 'high',
      priority: i + 1,
      rule: 'rule',
      reason: 'reason',
    }));
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave({ issues }),
      result: buildResult(),
      evidences: [],
      topN: 5,
    });
    const top = findSection(sections, 'Top phát hiện');
    expect(top?.table?.rows.length).toBe(5);
    expect(top?.table?.headers).toContain('Mức ảnh hưởng');
    // "Cao" là nhãn tiếng Việt của severity 'high'.
    expect(top?.table?.rows[0]?.[3]).toBe('Cao');
  });

  it('cột null hiển thị "(toàn bảng)"', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave({
        issues: [{ dq: 'DQ-02', column: null, count: 3, rate: 0.03, severity: 'medium', priority: 1, rule: 'r', reason: 'x' }],
      }),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const top = findSection(sections, 'Top phát hiện');
    expect(top?.table?.rows[0]?.[2]).toBe('(toàn bảng)');
  });
});

describe('GĐ3 — GĐ2: nghi vấn nằm ở mục riêng, không lẫn vào Top phát hiện', () => {
  const suspicions = [
    {
      kind: 'missing_token',
      column: 'Ten',
      count: 12,
      rate: 0.12,
      message: 'Cột "Ten" chứa ký hiệu thiếu (NA, null…)',
      recommendation: 'Xác nhận quy ước ký hiệu thiếu tại nguồn',
      examples: ['"NA" ×2', '"null" ×1'],
    },
  ];

  it('có mục 3b riêng với bảng nghi vấn', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave({ suspicions }),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const sec = findSection(sections, 'nghi vấn');
    expect(sec).toBeDefined();
    expect(sec?.table?.headers[0]).toBe('Loại');
    // Nhãn tiếng Việt của kind.
    expect(sec?.table?.rows[0]?.[0]).toBe('Ký hiệu thiếu');
    expect(sec?.lines.join('\n')).toContain('CHƯA phải lỗi đã xác nhận');
  });

  it('nghi vấn KHÔNG nằm trong bảng Top phát hiện', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave({
        suspicions,
        issues: [{ dq: 'DQ-01', column: 'Ten', count: 5, rate: 0.05, severity: 'medium', priority: 1, rule: 'r', reason: 'x' }],
      }),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const top = findSection(sections, 'Top phát hiện');
    const flat = (top?.table?.rows ?? []).flat().join(' ');
    expect(flat).not.toContain('Ký hiệu thiếu');
    expect(top?.table?.rows.length).toBe(1);
  });

  it('không có nghi vấn → ghi rõ "Không có điểm nghi vấn"', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave({ suspicions: [] }),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const sec = findSection(sections, 'nghi vấn');
    expect(sec?.lines.join('\n')).toContain('Không có điểm nghi vấn');
    expect(sec?.table).toBeUndefined();
  });
});

describe('GĐ3 — mục 4: ma trận tương quan', () => {
  it('mỗi cặp in một lần, bỏ đường chéo', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const sec = findSection(sections, 'Ma trận tương quan');
    const rows = sec?.table?.rows ?? [];
    expect(rows.length).toBe(1);
    expect(rows[0]?.[0]).toBe('Tuoi');
    expect(rows[0]?.[1]).toBe('Luong');
  });

  it('ghi cột bị loại kèm lý do', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const text = findSection(sections, 'Ma trận tương quan')?.lines.join('\n') ?? '';
    expect(text).toContain('MaDH');
    expect(text).toContain('identifier_not_unique');
  });

  it('cặp không tính được vẫn in kèm lý do', () => {
    const result = buildResult();
    result.correlationMatrix = {
      method: 'pearson',
      columns: ['A', 'B'],
      cells: [
        { colA: 'A', colB: 'B', coef: null, kind: 'pearson', n: 0, totalScanned: 10, missingAOnly: 0, missingBOnly: 0, missingBoth: 10, computable: false, reason: 'khong_co_du_lieu' },
      ],
      totalScanned: 10,
    };
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result,
      evidences: [],
      topN: 50,
    });
    const row = findSection(sections, 'Ma trận tương quan')?.table?.rows[0];
    expect(row?.[2]).toBe('-');
    expect(row?.[5]).toBe('khong_co_du_lieu');
  });
});

describe('GĐ3 — mục 5: VIF', () => {
  it('in bảng VIF kèm mức đánh giá', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const sec = findSection(sections, 'Đa cộng tuyến');
    expect(sec?.table?.rows[0]?.[0]).toBe('Tuoi');
    expect(sec?.table?.rows[0]?.[2]).toBe('OK');
    expect(sec?.lines.join('\n')).toContain('98');
  });
});

describe('GĐ3 — phụ lục D: bằng chứng đã che PII', () => {
  const evidences: CellEvidenceRecord[] = [
    { analysisRunId: 'r1', column: 'CCCD', rowIndex: 12, reason: 'dq01_missing', kind: 'missing', valueMasked: null },
    { analysisRunId: 'r1', column: 'Ten', rowIndex: 30, reason: 'dq03_invalid', kind: 'invalid_type', valueMasked: '***' },
    { analysisRunId: 'r1', column: '__row__', rowIndex: 44, reason: 'dq02_duplicate', kind: 'duplicate', valueMasked: null },
  ];

  it('in cột, dòng, loại, lý do và giá trị đã che', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result: buildResult(),
      evidences,
      topN: 50,
    });
    const rows = findSection(sections, 'Bằng chứng')?.table?.rows ?? [];
    expect(rows.length).toBe(3);
    expect(rows[0]?.[0]).toBe('CCCD');
    expect(rows[0]?.[1]).toBe('12');
    expect(rows[0]?.[2]).toBe('Thiếu (DQ-01)');
    expect(rows[1]?.[2]).toBe('Sai kiểu (DQ-03)');
    expect(rows[1]?.[4]).toBe('***');
    // Cột "__row__" hiển thị "(toàn dòng)".
    expect(rows[2]?.[0]).toBe('(toàn dòng)');
    expect(rows[2]?.[2]).toBe('Trùng (DQ-02)');
  });

  it('KHÔNG in giá trị thô (chỉ giá trị đã che)', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result: buildResult(),
      evidences: [{ analysisRunId: 'r1', column: 'Ten', rowIndex: 1, reason: 'r', kind: 'invalid_type', valueMasked: 'Aaaa aa' }],
      topN: 50,
    });
    const text = JSON.stringify(findSection(sections, 'Bằng chứng')?.table?.rows ?? []);
    expect(text).toContain('Aaaa aa');
    expect(text).not.toContain('Nguyen Van A');
  });
});

describe('GĐ3 — không có kết quả phân tích', () => {
  it('dừng ở mục 4 và không crash', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result: null,
      evidences: [],
      topN: 50,
    });
    const text = findSection(sections, 'Kết quả phân tích chi tiết')?.lines.join('\n') ?? '';
    expect(text).toContain('Không tìm thấy kết quả phân tích');
    // Không có các mục phụ thuộc kết quả.
    expect(headings(sections).some((h) => h.includes('Ma trận tương quan'))).toBe(false);
    expect(headings(sections).some((h) => h.includes('Đa cộng tuyến'))).toBe(false);
  });
});

describe('GĐ3 — mục 2b: cấu hình phân tích đã dùng', () => {
  it('in cấu hình khi summary có config_used', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave({
        config_used: {
          selected_columns: ['Tuoi', 'Luong'],
          label_column: 'Nhan',
          time_column: 'Ngay',
          time_granularity: 'day',
          value_column: 'Luong',
          correlation_method: 'pearson',
          outlier_method: 'iqr',
          top_n: 50,
          chart_top_n: 5,
        },
      }),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    const text = findSection(sections, 'Cấu hình phân tích')?.lines.join('\n') ?? '';
    expect(text).toContain('Tuoi, Luong');
    expect(text).toContain('pearson');
  });

  it('bỏ qua mục 2b khi không có config_used', () => {
    const sections = buildReportSections({
      projectId: PROJECT_ID,
      save: buildSave(),
      result: buildResult(),
      evidences: [],
      topN: 50,
    });
    expect(headings(sections).some((h) => h.includes('Cấu hình phân tích'))).toBe(false);
  });
});
