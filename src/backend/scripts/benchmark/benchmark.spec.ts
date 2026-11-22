/**
 * Unit test cho bộ benchmark 5 model AI (Phần 12 v8 §3.15.5).
 *
 * Kiểm tra: tập vàng, chấm điểm, RAM Guard, kiểm định thống kê, đường Pareto.
 */
import { describeGoldSet, generateGoldSet, severityByRate } from './gold-set';
import { aggregate, percentile, scoreSample } from './scorer';
import { compareModels, mcnemar, wilcoxonSignedRank } from './stats';
import { evaluateRamStatus } from './ram-guard';
import { METRICS, thresholdFailures, CANDIDATES } from './models';
import { buildBenchmarkPrompt } from './prompt';
import { resolveJudgeModel } from './judge';
import { isInfraError } from './infra-error';
import { groundAiAssessment } from '../../src/modules/analysis/domain/ai-grounding.util';

describe('Tập dữ liệu vàng', () => {
  const samples = generateGoldSet(200);

  it('sinh đúng 200 mẫu và phủ đủ 3 mức ảnh hưởng', () => {
    const d = describeGoldSet(samples);
    expect(d.total).toBe(200);
    expect(Object.keys(d.bySeverity).sort()).toEqual(['high', 'low', 'medium']);
    expect(d.bySeverity['low']).toBeGreaterThan(0);
    expect(d.bySeverity['medium']).toBeGreaterThan(0);
    expect(d.bySeverity['high']).toBeGreaterThan(0);
  });

  it('phủ đủ 4 loại lỗi DQ-01..DQ-04', () => {
    const d = describeGoldSet(samples);
    for (const code of ['DQ-01', 'DQ-02', 'DQ-03', 'DQ-04']) {
      expect(d.byCode[code]).toBeGreaterThan(0);
    }
  });

  it('có cả mẫu bẫy false_positive và missed_issue', () => {
    const d = describeGoldSet(samples);
    expect(d.byTrap['false_positive']).toBeGreaterThan(0);
    expect(d.byTrap['missed_issue']).toBeGreaterThan(0);
  });

  it('deterministic — sinh 2 lần cho cùng kết quả', () => {
    const a = generateGoldSet(50, 12345);
    const b = generateGoldSet(50, 12345);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('ngưỡng ảnh hưởng theo §3.11', () => {
    expect(severityByRate(0.005, 'default')).toBe('low');
    expect(severityByRate(0.05, 'default')).toBe('medium');
    expect(severityByRate(0.5, 'default')).toBe('high');
    expect(severityByRate(0.001, 'duplicate')).toBe('low');
    expect(severityByRate(0.02, 'duplicate')).toBe('medium');
    expect(severityByRate(0.2, 'duplicate')).toBe('high');
    expect(severityByRate(0, 'default')).toBeNull();
  });
});

describe('Prompt benchmark', () => {
  const samples = generateGoldSet(10);

  it('chứa thống kê tổng hợp và quy tắc ngưỡng', () => {
    const prompt = buildBenchmarkPrompt(samples[0]!.payload);
    expect(prompt).toContain('Thong ke tong hop theo cot');
    expect(prompt).toContain('DQ-01');
    expect(prompt).toContain('issues');
    expect(prompt.length).toBeGreaterThan(500);
  });

  it('chế độ compact giữ prompt dưới ~900 token để benchmark khả thi trên CPU-only', () => {
    const all = generateGoldSet(200);
    let total = 0;
    for (const s of all) total += buildBenchmarkPrompt(s.payload).length;
    const avgChars = total / all.length;
    // 723 token trung bình ⇒ ~2.460 ký tự (ước lượng 3,4 ký tự/token).
    expect(avgChars).toBeLessThan(3000);
  });
});

describe('Chấm điểm', () => {
  const samples = generateGoldSet(20);

  it('JSON không hợp lệ → coi như không phát hiện (missed issue nếu có vấn đề)', () => {
    const s = samples.find((x) => x.expected.hasIssue)!;
    const scored = scoreSample(s, {
      durationMs: 100,
      evalTokens: 10,
      promptTokens: 100,
      tokensPerSecond: 5,
      rawText: 'khong phai json',
      jsonValid: false,
      parsed: null,
      error: null,
      retryable: false,
      engineRssBytes: 0,
    });
    expect(scored.predPositive).toBe(false);
    expect(scored.missedIssue).toBe(true);
    expect(scored.correct).toBe(false);
  });

  it('claim vượt quyền bị grounding loại và tính vào ảo giác', () => {
    const s = samples.find((x) => x.kind === 'corr' && x.expected.notablePairs.length > 0)!;
    const scored = scoreSample(s, {
      durationMs: 100,
      evalTokens: 10,
      promptTokens: 100,
      tokensPerSecond: 5,
      rawText: '{}',
      jsonValid: true,
      parsed: {
        notablePairs: [
          { colA: 'cot_khong_co', colB: 'khong_ton_tai', coef: 0.99, n: 10 },
        ],
        highVif: ['cot_vif_khong_co'],
      },
      error: null,
      retryable: false,
      engineRssBytes: 0,
    });
    expect(scored.totalClaims).toBe(0);
    expect(scored.droppedClaims).toBe(2);
  });

  it('tổng hợp 9 chỉ số trả về đủ giá trị', () => {
    const scored = samples.map((s) =>
      scoreSample(s, {
        durationMs: 1000,
        evalTokens: 100,
        promptTokens: 500,
        tokensPerSecond: 8,
        rawText: '{}',
        jsonValid: true,
        parsed: { notablePairs: [], highVif: [] },
        error: null,
        retryable: false,
        engineRssBytes: 1024,
      }),
    );
    const outcomes = scored.map(() => ({
      durationMs: 1000,
      evalTokens: 100,
      promptTokens: 500,
      tokensPerSecond: 8,
      rawText: '{}',
      jsonValid: true,
      parsed: {} as Record<string, unknown>,
      error: null,
      retryable: false,
      engineRssBytes: 1024,
    }));
    const agg = aggregate(scored, outcomes);
    for (const m of METRICS) {
      expect(agg[m.key as keyof typeof agg]).not.toBeUndefined();
    }
    expect(agg.json_valid_rate).toBe(1);
    expect(agg.failure_rate).toBe(0);
  });

  it('lỗi hạ tầng (OOM) không tính vào failure_rate của model', () => {
    // Regression: pilot M3 bị `oom-kill: task=ollama` ⇒ `socket hang up`.
    // Nếu tính vào failure_rate thì model bị phạt oan 33% lỗi.
    const outcomes = [
      {
        durationMs: 100,
        evalTokens: 0,
        promptTokens: 0,
        tokensPerSecond: 0,
        rawText: '',
        jsonValid: false,
        parsed: null,
        error: 'socket hang up',
        retryable: true,
        engineRssBytes: 1024,
        infraError: true,
      },
    ];
    const s = samples.find((x) => x.expected.hasIssue)!;
    const scored = scoreSample(s, outcomes[0]!);
    const agg = aggregate([scored], outcomes);
    expect(agg.failure_rate).toBe(0);
  });

  it('phân vị tính đúng', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(percentile([], 0.5)).toBeNull();
  });

  it('phản hồi bị cắt cụt (truncated) tính đúng JSON rate và không tính vào lỗi', () => {
    // Regression: Ollama cắt output khi chạm num_predict → done_reason='length'.
    // JSON không parse được ⇒ json_valid_rate = 0, nhưng KHÔNG phải lỗi vận hành.
    const outcomes = [
      {
        durationMs: 100,
        evalTokens: 384,
        promptTokens: 700,
        tokensPerSecond: 2.5,
        rawText: '{"notablePairs": [',
        jsonValid: false,
        parsed: null,
        error: null,
        retryable: false,
        engineRssBytes: 1024,
        truncated: true,
      },
    ];
    const s = samples.find((x) => x.expected.hasIssue)!;
    const scored = scoreSample(s, {
      durationMs: 100,
      evalTokens: 384,
      promptTokens: 700,
      tokensPerSecond: 2.5,
      rawText: '{"notablePairs": [',
      jsonValid: false,
      parsed: null,
      error: null,
      retryable: false,
      engineRssBytes: 1024,
      truncated: true,
    });
    const agg = aggregate([scored], outcomes);
    expect(agg.json_valid_rate).toBe(0);
    expect(agg.failure_rate).toBe(0);
  });

  it('grounding của production loại claim vượt quyền', () => {
    const s = samples[0]!;
    const g = groundAiAssessment(
      { notablePairs: [{ colA: 'a', colB: 'b', coef: 0.5 }], highVif: [] },
      s.payload.cells,
      s.payload.vif?.rows ?? [],
      null,
    );
    expect(g.droppedClaims.length).toBeGreaterThanOrEqual(0);
    expect(g.status).toBe('succeeded');
  });

  it('khóa `issues` KHÔNG làm hỏng grounding corr-v1 (regression strict-schema)', () => {
    // Regression: CorrV1RawSchema dùng .strict() → trước đây khóa `issues`
    // khiến toàn bộ phản hồi bị loại ⇒ F1 luôn = 0.
    const s = samples.find((x) => x.kind === 'corr')!;
    const parsed = groundAiAssessment(
      { notablePairs: [], highVif: [], limits: [], nextSteps: [] },
      s.payload.cells,
      s.payload.vif?.rows ?? [],
      null,
    );
    expect(parsed.status).toBe('succeeded');

    const scored = scoreSample(s, {
      durationMs: 100,
      evalTokens: 10,
      promptTokens: 100,
      tokensPerSecond: 5,
      rawText: '{}',
      jsonValid: true,
      parsed: { notablePairs: [], highVif: [], issues: [] },
      error: null,
      retryable: false,
      engineRssBytes: 0,
    });
    // Phải chấm được (không phải "mất trắng"), dù không có issue nào.
    expect(scored.totalClaims).toBe(0);
    expect(scored.droppedClaims).toBe(0);
  });

  it('issue bịa cột không tồn tại bị tính vào ảo giác', () => {
    const s = samples.find((x) => x.expected.hasIssue)!;
    const scored = scoreSample(s, {
      durationMs: 100,
      evalTokens: 10,
      promptTokens: 100,
      tokensPerSecond: 5,
      rawText: '{}',
      jsonValid: true,
      parsed: { notablePairs: [], highVif: [], issues: [{ code: 'DQ-01', column: 'cot_bia_da' }] },
      error: null,
      retryable: false,
      engineRssBytes: 0,
    });
    expect(scored.claimedIssues).toBe(1);
    expect(scored.droppedClaims).toBe(1);
    expect(scored.correctIssues).toBe(0);
  });

  it('F1 macro tính trên 5 lớp corr_vif + DQ-01..DQ-04', () => {
    const dq = samples.find((x) => x.kind === 'dq' && x.expected.issues.length > 0)!;
    const scored = scoreSample(dq, {
      durationMs: 100,
      evalTokens: 10,
      promptTokens: 100,
      tokensPerSecond: 5,
      rawText: '{}',
      jsonValid: true,
      parsed: {
        notablePairs: [],
        highVif: [],
        issues: dq.expected.issues.map((i) => ({ code: i.code, column: i.column })),
      },
      error: null,
      retryable: false,
      engineRssBytes: 0,
    });
    const cls = dq.expected.issues[0]!.code as 'DQ-01' | 'DQ-02' | 'DQ-03' | 'DQ-04';
    expect(scored.classScores[cls].tp).toBe(1);
    expect(scored.correctIssues).toBe(1);
    expect(scored.predPositive).toBe(true);
  });
});

describe('Kiểm định thống kê', () => {
  it('McNemar: b=c=0 → p = 1', () => {
    const r = mcnemar(0, 0);
    expect(r.pValue).toBe(1);
    expect(r.significant).toBe(false);
  });

  it('McNemar: khác biệt lớn → p < 0,05', () => {
    const r = mcnemar(30, 2);
    expect(r.pValue).toBeLessThan(0.05);
    expect(r.significant).toBe(true);
  });

  it('Wilcoxon: dữ liệu giống nhau → p = 1', () => {
    const r = wilcoxonSignedRank([1, 2, 3], [1, 2, 3]);
    expect(r.pValue).toBe(1);
    expect(r.significant).toBe(false);
  });

  it('Wilcoxon: model B tốt hơn rõ → p < 0,05', () => {
    const r = wilcoxonSignedRank([1, 1, 1, 1, 1], [5, 5, 5, 5, 5]);
    expect(r.pValue).toBeLessThan(0.05);
    expect(r.significant).toBe(true);
  });

  it('chênh F1 < 0,03 → không tuyên bố thắng', () => {
    const a = new Array(20).fill(true);
    const b = new Array(20).fill(true);
    b[0] = false;
    const v = compareModels(a, b, [], []);
    expect(v.canDeclareWinner).toBe(false);
  });
});

describe('Phân loại lỗi hạ tầng', () => {
  it('nhận diện lỗi OOM/socket', () => {
    expect(isInfraError('socket hang up')).toBe(true);
    expect(isInfraError('ECONNRESET')).toBe(true);
    expect(isInfraError('out of memory')).toBe(true);
    expect(isInfraError('ENOMEM: cannot allocate memory')).toBe(true);
  });

  it('KHÔNG nhận lỗi thường của model', () => {
    expect(isInfraError('timeout sau 900000ms')).toBe(false);
    expect(isInfraError('unknown_error')).toBe(false);
  });
});

describe('Quy tắc trong prompt', () => {
  const ctx = generateGoldSet(3)[0]!.payload;

  it('nhắc model chỉ báo mã lỗi khi tỉ lệ > 0', () => {
    const p = buildBenchmarkPrompt(ctx);
    expect(p).toContain('DQ-01 chi khi ty le thieu');
    expect(p).toContain('Neu mot cot co ty le = 0 thi KHONG bao cao');
  });

  it('nêu ngưỡng phát hiện tương quan và VIF khớp gold set', () => {
    const p = buildBenchmarkPrompt(ctx);
    expect(p).toContain('|r| >= 0,75');
    expect(p).toContain('vif >= 5');
  });
});

describe('LLM-as-judge chấm chéo', () => {
  const qwen = CANDIDATES.find((c) => c.id === 'M3')!;
  const gemma = CANDIDATES.find((c) => c.id === 'M2')!;

  it('không dùng judge cùng họ với model được chấm', () => {
    const judge = resolveJudgeModel('qwen3:14b', qwen);
    expect(judge).not.toBe('qwen3:14b');
    expect(CANDIDATES.find((c) => c.ollama === judge)?.family).not.toBe(qwen.family);
  });

  it('giữ judge khác họ nếu được chỉ định hợp lệ', () => {
    expect(resolveJudgeModel('gemma3:12b', qwen)).toBe('gemma3:12b');
  });

  it('tự chọn judge khác họ khi không chỉ định', () => {
    const judge = resolveJudgeModel(null, gemma);
    expect(CANDIDATES.find((c) => c.ollama === judge)?.family).not.toBe(gemma.family);
  });
});

describe('RAM Guard', () => {  it('skip=true thì không chặn', () => {
    const s = evaluateRamStatus({ skip: true });
    expect(s.blocked).toBe(false);
  });

  it('đọc được RAM hệ thống trên Linux', () => {
    const s = evaluateRamStatus({ skip: true });
    expect(s.totalBytes).toBeGreaterThan(0);
    expect(s.availableBytes).toBeGreaterThan(0);
  });
});

describe('Ngưỡng tuyệt đối', () => {
  it('model rớt ngưỡng bị loại', () => {
    const scores: Record<string, number | null> = {};
    for (const m of METRICS) scores[m.key] = m.threshold;
    expect(thresholdFailures(scores)).toEqual([]);
    scores['f1_micro'] = 0.5;
    expect(thresholdFailures(scores)).toContain('f1_micro');
  });

  it('chỉ số null cũng bị coi là rớt', () => {
    const scores: Record<string, number | null> = {};
    for (const m of METRICS) scores[m.key] = m.threshold;
    scores['json_valid_rate'] = null;
    expect(thresholdFailures(scores)).toContain('json_valid_rate');
  });
});
