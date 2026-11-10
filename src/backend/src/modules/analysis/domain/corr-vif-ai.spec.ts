import { buildCorrelationMatrix, computePairCell } from './correlation.util';
import { computeVif } from './vif.util';
import { groundAiAssessment } from './ai-grounding.util';
import { maskCell, maskColumnSamples } from './pii-mask.util';
import {
  computeTrustScore,
  cosineSimilarity,
  embedText,
  extractErrorType,
  isEligibleForStore,
  mapFeedbackLabelToExampleLabel,
  normalizeExample,
  rankFewShot,
  renderFewShotBlock,
} from './rag-few-shot.util';

describe('correlation.util (3.23.1)', () => {
  const rows = [
    { a: 1, b: 2, g: 'x' },
    { a: 2, b: 4, g: 'x' },
    { a: 3, b: 6, g: 'y' },
    { a: 4, b: 8, g: 'y' },
    { a: 5, b: 10, g: 'y' },
  ];
  it('pearson số–số hoàn hảo ≈ 1 kèm n pairwise', () => {
    const cell = computePairCell({ colA: 'a', roleA: 'numeric', colB: 'b', roleB: 'numeric', rows }, 'pearson');
    expect(cell.computable).toBe(true);
    expect(cell.coef).toBeCloseTo(1, 4);
    expect(cell.n).toBe(5);
  });
  it('thiếu ở cột thứ ba không loại cặp (pairwise)', () => {
    const r2 = [...rows, { a: 1, b: null, c: 9 }];
    const { cells } = buildCorrelationMatrix(
      [
        { key: 'a', role: 'numeric', reason: null },
        { key: 'b', role: 'numeric', reason: null },
      ],
      r2,
      'pearson',
    );
    const ab = cells.find((c) => c.colA === 'a' && c.colB === 'b' && c.computable);
    expect(ab?.n).toBe(5);
  });
  it('cột hằng → không tính được, không trả 0', () => {
    const r2 = rows.map((r) => ({ ...r, h: 7 }));
    const cell = computePairCell({ colA: 'a', roleA: 'numeric', colB: 'h', roleB: 'numeric', rows: r2 }, 'pearson');
    expect(cell.computable).toBe(false);
    expect(cell.coef).toBeNull();
  });
});

describe('vif.util (3.23.2)', () => {
  it('VIF > 10 cho cộng tuyến gần hoàn hảo, flag high', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ x1: i + 1, x2: (i + 1) * 2 + 0.0001 * (i % 2) }));
    const out = computeVif(['x1', 'x2'], rows);
    expect(out.commonN).toBe(20);
    const flags = out.rows.map((r) => r.flag);
    expect(flags).toContain('high');
  });
  it('phụ thuộc tuyến tính hoàn hảo → singular, không bịa số', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ x1: i + 1, x2: (i + 1) * 2 }));
    const out = computeVif(['x1', 'x2'], rows);
    expect(out.singular).toBe(true);
    expect(out.rows.every((r) => r.vif === null)).toBe(true);
    expect(out.rows[0].reason).toMatch(/perfect_linear_dependency/);
  });
  it('cột hằng bị loại riêng, không âm thầm bỏ', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ x1: i + 1, x2: 5, x3: i * 2 + 1 }));
    const out = computeVif(['x1', 'x2', 'x3'], rows);
    expect(out.excluded.map((e) => e.column)).toContain('x2');
  });
});

describe('ai-grounding (3.23.3 — corr-v1)', () => {
  const cells = [
    { colA: 'a', colB: 'b', coef: 0.82, kind: 'pearson' as const, n: 1200, totalScanned: 1200, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
  ];
  const vifRows = [{ column: 'b', vif: 6.4, flag: 'review' as const, computable: true, reason: null }];
  it('giữ claim khớp số, loại claim bịa', () => {
    const g = groundAiAssessment(
      { notablePairs: [{ colA: 'a', colB: 'b', coef: 0.82 }], highVif: ['b', 'bịa'], limits: ['ok'], nextSteps: ['x'] },
      cells,
      vifRows,
      'qwen3-14B',
    );
    expect(g.status).toBe('succeeded');
    expect(g.notablePairs).toHaveLength(1);
    expect(g.highVif).toEqual(['b']);
    expect(g.droppedClaims.join(' ')).toMatch(/bịa/);
  });
  it('DQ-05 không bị suy ra từ tương quan/VIF: grounding không sinh rule', () => {
    const g = groundAiAssessment({ notablePairs: [], highVif: [] }, cells, vifRows, null);
    expect('rules' in g).toBe(false);
  });
});

describe('han che #2: pairwise missing breakdown', () => {
  it('bao ro mat o cot A / cot B / ca hai', () => {
    const rows = [
      { a: 1, b: 1 },
      { a: null, b: 2 },
      { a: 3, b: null },
      { a: null, b: null },
      { a: 5, b: 5 },
      { a: 6, b: 6 },
    ];
    const cell = computePairCell({ colA: 'a', roleA: 'numeric', colB: 'b', roleB: 'numeric', rows }, 'pearson');
    expect(cell.n).toBe(3);
    expect(cell.totalScanned).toBe(6);
    expect(cell.missingAOnly).toBe(1);
    expect(cell.missingBOnly).toBe(1);
    expect(cell.missingBoth).toBe(1);
  });
});

describe('han che #3: VIF commonNRate + lossWarning', () => {
  it('mat >20% dong thi co canh bao', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      x1: i + 1,
      x2: i % 3 === 0 ? null : (i + 1) * 1.7 + (i % 2) * 0.3,
    }));
    const out = computeVif(['x1', 'x2'], rows);
    expect(out.totalScanned).toBe(10);
    expect(out.commonN).toBeLessThan(10);
    expect(out.commonNRate).not.toBeNull();
    expect(out.lossWarning).not.toBeNull();
  });
  it('mat >=50% dong thi canh bao manh', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ x1: i + 1, x2: i < 5 ? null : i * 2 + 1 }));
    const out = computeVif(['x1', 'x2'], rows);
    expect(out.lossWarning ?? '').toMatch(/kem_tin/);
  });
});

describe('han che #4: cot date bi loai ro ly do', () => {
  it('matrix notes neu ro cot date bi loai', () => {
    const { notes } = buildCorrelationMatrix(
      [
        { key: 'd', role: 'excluded', reason: 'date_column_excluded_from_correlation_vif' },
        { key: 'a', role: 'numeric', reason: null },
      ],
      [{ d: '2024-01-01', a: 1 }],
      'pearson',
    );
    expect(notes.join(' ')).toMatch(/date/);
  });
});

describe('v8: Zod strict + sap xep + giu toan bo (nhom A)', () => {
  const cells = [
    { colA: 'a', colB: 'b', coef: 0.5, kind: 'pearson' as const, n: 100, totalScanned: 100, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
    { colA: 'a', colB: 'c', coef: -0.9, kind: 'pearson' as const, n: 100, totalScanned: 100, missingAOnly: 0, missingBOnly: 0, missingBoth: 0, computable: true, reason: null },
  ];
  const vifRows = [
    { column: 'b', vif: 6.0, flag: 'review' as const, computable: true, reason: null },
    { column: 'c', vif: 12.5, flag: 'high' as const, computable: true, reason: null },
  ];
  it('thieu truong / sai kieu -> failed invalid_corr_v1_shape', () => {
    const g1 = groundAiAssessment({ notablePairs: [{ colA: 'a', coef: 0.5 }] }, cells, vifRows, null);
    expect(g1.status).toBe('failed');
    expect(g1.error ?? '').toMatch(/invalid_corr_v1_shape/);
    const g2 = groundAiAssessment({ notablePairs: 'khong-phai-mang' }, cells, vifRows, null);
    expect(g2.status).toBe('failed');
  });
  it('sai so > 0.01 -> loai claim, dung so he thong', () => {
    const g = groundAiAssessment({ notablePairs: [{ colA: 'a', colB: 'b', coef: 0.99 }] }, cells, vifRows, null);
    expect(g.notablePairs).toHaveLength(0);
    expect(g.droppedClaims.join(' ')).toMatch(/a–b/);
  });
  it('sap xep notablePairs theo |coef| giam dan, highVif theo VIF giam dan', () => {
    const g = groundAiAssessment(
      { notablePairs: [{ colA: 'a', colB: 'b', coef: 0.5 }, { colA: 'a', colB: 'c', coef: -0.9 }], highVif: ['b', 'c'] },
      cells, vifRows, null,
    );
    expect(g.notablePairs.map((x) => x.colB)).toEqual(['c', 'b']);
    expect(g.highVif).toEqual(['c', 'b']);
  });
  it('giu toan bo limits/nextSteps, khong cat 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => `limit-${i}`);
    const g = groundAiAssessment({ notablePairs: [], highVif: [], limits: many, nextSteps: many }, cells, vifRows, null);
    expect(g.limits).toHaveLength(30);
    expect(g.nextSteps).toHaveLength(30);
  });
  it('lam tron domain 4 chu so, chan NaN/Infinity', () => {
    const cell = computePairCell({ colA: 'a', roleA: 'numeric', colB: 'b', roleB: 'numeric', rows: [{ a: 1, b: 2 }, { a: 2, b: 4 }, { a: 3, b: 6 }] }, 'pearson');
    expect(cell.coef).toBeCloseTo(1, 4);
    if (cell.coef !== null) {
      expect(String(cell.coef).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
      expect(Number.isFinite(cell.coef)).toBe(true);
    }
    const out = computeVif(['x1', 'x2'], [{ x1: 1, x2: 2 }, { x1: 2, x2: 4 }, { x1: 3, x2: 6.001 }]);
    for (const r of out.rows) {
      if (r.vif !== null) {
        expect(Number.isFinite(r.vif)).toBe(true);
        expect(r.vif).toBeGreaterThanOrEqual(0);
      }
    }
    if (out.commonNRate !== null) expect(out.commonNRate).toBeCloseTo(out.commonN / out.totalScanned, 4);
  });
});

describe('v8: che PII (regex + cot danh dau PII)', () => {
  it('email / dien thoai / CCCD kiem regex → thay bang ***', () => {
    expect(maskCell('user@example.com', false).value).toBe('***');
    expect(maskCell('0901234567', false).value).toBe('***');
    expect(maskCell('079123456789', false).value).toBe('***');
  });
  it('cot duoc danh dau PII → luon che du gia tri khop regex', () => {
    const res = maskCell('Binh An', true);
    expect(res.masked).toBe(true);
    expect(res.value).toBe('***');
  });
  it('o khong che duoc → loai khoi prompt (dropped)', () => {
    const res = maskCell('Binh An', false);
    expect(res.dropped).toBe(true);
    expect(res.value).toBeNull();
  });
  it('null / rong → khong phai PII, khong loai', () => {
    expect(maskCell(null, false).dropped).toBe(false);
    expect(maskCell('   ', false).dropped).toBe(false);
  });
  it('maskColumnSamples bo o khong che duoc, giu lai toan bo gia tri da che', () => {
    const out = maskColumnSamples(['a@b.com', 'Binh An', '0901234567'], false);
    expect(out.samples).toEqual(['***', '***']);
    expect(out.droppedCount).toBe(1);
  });
});

describe('v8: RAG few-shot (cosine trong MongoDB, cap 50k FIFO)', () => {
  const mk = (over: Partial<import('./rag-few-shot.util').FewShotExample> = {}) => ({
    errorType: 'DQ-03',
    columnTraits: 'cot trang thai dung 5 ma viet tat',
    description: 'khong phai loi',
    label: 'false_positive' as const,
    embedding: [1, 0, 0],
    trustScore: 0.9,
    language: 'vi',
    createdAt: new Date(),
    ...over,
  });

  it('cosineSimilarity: vector giong nhau → 1, truc giao → 0', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });

  it('loc theo loai loi, ngon ngu, diem tin cay va tuoi', () => {
    const examples = [
      mk({ embedding: [1, 0, 0] }),
      mk({ errorType: 'DQ-01', embedding: [0.99, 0.1, 0] }),
      mk({ language: 'en', embedding: [1, 0, 0] }),
      mk({ trustScore: 0.3, embedding: [1, 0, 0] }),
      mk({ createdAt: new Date(Date.now() - 200 * 86400000), embedding: [1, 0, 0] }),
    ];
    const out = rankFewShot(examples, { embedding: [1, 0, 0], errorType: 'DQ-03', language: 'vi' });
    expect(out).toHaveLength(1);
    expect(out[0].errorType).toBe('DQ-03');
  });

  it('top-k = 5 mac dinh, sap xep theo score giam dan', () => {
    const examples = Array.from({ length: 10 }, (_, i) =>
      mk({ embedding: [1, i * 0.01, 0] }),
    );
    const out = rankFewShot(examples, { embedding: [1, 0, 0] });
    expect(out.length).toBeLessThanOrEqual(5);
  });

  it('normalizeExample bo PII truoc khi luo vao kho', () => {
    const ex = normalizeExample({
      errorType: 'DQ-03',
      columnTraits: 'khach hang anh@example.com',
      description: 'so 0901234567 khong phai loi',
      label: 'false_positive',
      embedding: [1, 0],
    });
    expect(ex.columnTraits).not.toContain('@example.com');
    expect(ex.description).not.toContain('0901234567');
    expect(ex.description).toContain('***');
  });

  it('renderFewShotBlock tao khoi "Cac truong hop da biet"', () => {
    const block = renderFewShotBlock([mk()]);
    expect(block).toContain('Cac truong hop da biet');
    expect(block).toContain('Mau sai');
  });

  it('renderFewShotBlock rong khi khong co mau', () => {
    expect(renderFewShotBlock([])).toBe('');
  });
});
describe('Full T1: chuan hoa + agreement + embedding', () => {
  it('extractErrorType trich DQ tu findingId', () => {
    expect(extractErrorType('DQ-01:ten-cot')).toBe('DQ-01');
    expect(extractErrorType('DQ-03')).toBe('DQ-03');
    expect(extractErrorType('dq-02:col')).toBe('DQ-02');
    expect(extractErrorType('corr:pair')).toBe('general');
    expect(extractErrorType(null)).toBe('general');
  });

  it('mapFeedbackLabelToExampleLabel anh xa nhan', () => {
    expect(mapFeedbackLabelToExampleLabel('correct')).toBe('correct');
    expect(mapFeedbackLabelToExampleLabel('partially_correct')).toBe('correct');
    expect(mapFeedbackLabelToExampleLabel('false_positive')).toBe('false_positive');
    expect(mapFeedbackLabelToExampleLabel('missed_issue')).toBe('missed_issue');
    expect(mapFeedbackLabelToExampleLabel('other')).toBeNull();
  });

  it('computeTrustScore don dieu, >= 3 nguoi du dieu kien', () => {
    expect(computeTrustScore(0)).toBeLessThan(0.6);
    expect(computeTrustScore(1)).toBeLessThan(0.6);
    expect(computeTrustScore(2)).toBeGreaterThanOrEqual(0.6);
    expect(computeTrustScore(3)).toBeGreaterThanOrEqual(0.8);
    expect(computeTrustScore(5)).toBeGreaterThan(computeTrustScore(3));
    expect(isEligibleForStore(3, 0.4)).toBe(true);
    expect(isEligibleForStore(1, 0.5)).toBe(false);
    expect(isEligibleForStore(1, 0.7)).toBe(true);
  });

  it('embedText xac dinh, chuan hoa L2, text rong → vector 0', () => {
    const a = embedText('DQ-01 | cot trang thai | khong phai loi', 64);
    const b = embedText('DQ-01 | cot trang thai | khong phai loi', 64);
    expect(a).toHaveLength(64);
    expect(a).toEqual(b);
    const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 6);
    const z = embedText('   ', 64);
    expect(z.every((x) => x === 0)).toBe(true);
    const c = embedText('DQ-02 | cot khac | trung lap', 64);
    expect(cosineSimilarity(a, c)).toBeLessThan(0.99);
  });
});
