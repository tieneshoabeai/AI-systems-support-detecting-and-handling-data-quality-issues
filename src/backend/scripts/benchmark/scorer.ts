/**
 * Chấm điểm 9 chỉ số theo Phần 12 v8 §3.15.5 Bước 3.
 *
 * Vấn đề lịch sử (đã sửa): hàm `groundAiAssessment()` của production dùng schema
 * Zod `.strict()` cho corr-v1 → nếu đưa nguyên phản hồi có khóa `issues` vào thì
 * **toàn bộ phản hồi bị loại** ⇒ F1 luôn = 0. Benchmark phải TÁCH phần corr-v1
 * (notablePairs/highVif/limits/nextSteps) đưa qua `groundAiAssessment()` — đúng
 * grounding của production — rồi grounding riêng cho khối `issues` theo thống kê
 * đã gửi.
 *
 * Grounding khối `issues` (không được bịa):
 *  - `column` phải tồn tại trong `stats` đã gửi.
 *  - `code` phải khớp với tình trạng thật của cột đó:
 *      DQ-01 ⇔ missingRate > 0 · DQ-02 ⇔ duplicateRate > 0
 *      DQ-03 ⇔ invalidRate  > 0 · DQ-04 ⇔ outlierRate  > 0
 *  - Claim sai ⇒ đếm vào `droppedClaims` (ảo giác).
 */
import { groundAiAssessment, type ICorrelationCell, type IVifRow } from '../../src/modules/analysis/domain/ai-grounding.util';
import type { GoldSample } from './gold-set';

export interface InferenceOutcome {
  /** Thời gian xử lý một lượt (ms). */
  durationMs: number;
  /** Số token sinh ra. */
  evalTokens: number;
  /** Số token đầu vào. */
  promptTokens: number;
  /** Token/giây (chỉ phần sinh). */
  tokensPerSecond: number;
  /** Phản hồi thô. */
  rawText: string;
  /** JSON có parse được ngay không. */
  jsonValid: boolean;
  /** JSON đã parse (null nếu không hợp lệ). */
  parsed: Record<string, unknown> | null;
  /** Lỗi nếu request thất bại. */
  error: string | null;
  /** Có cần retry không (lỗi tạm thời). */
  retryable: boolean;
  /** RSS engine tại thời điểm đo (bytes). */
  engineRssBytes: number;
  /** Ollama cắt cụt output do chạm `num_predict` (JSON thường không parse được). */
  truncated?: boolean;
  /**
   * Lỗi HẠ TẦNG (không phải lỗi model): OOM-killer giết engine, hết RAM máy,
   * Ollama crash. Loại lỗi này **không tính vào `failure_rate`** vì đặc tả §3.15.5
   * #9 đo "độ ổn định của model", không đo sức khỏe của máy chủ.
   *
   * Thực tế: pilot M3 trên máy dev đã bị `oom-kill: task=ollama` ⇒ `socket hang up`
   * ⇒ nếu tính vào `failure_rate` thì model bị phạt oan 33% lỗi.
   */
  infraError?: boolean;
}

/** 5 lớp dùng cho F1 macro (Phần 12 v8 §3.15.5 #2). */
export const DETECTION_CLASSES = ['corr_vif', 'DQ-01', 'DQ-02', 'DQ-03', 'DQ-04'] as const;
export type DetectionClass = (typeof DETECTION_CLASSES)[number];

export interface ClassScore {
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export interface ScoredSample {
  sampleId: string;
  kind: GoldSample['kind'];
  truthPositive: boolean;
  predPositive: boolean;
  correct: boolean;
  falsePositive: boolean;
  missedIssue: boolean;
  droppedClaims: number;
  totalClaims: number;
  correctPairs: number;
  claimedPairs: number;
  truthPairs: number;
  correctVif: number;
  truthVif: number;
  judgeScore: number | null;
  explanation: string;
  /** Điểm theo từng lớp để tính F1 macro. */
  classScores: Record<DetectionClass, ClassScore>;
  /** Số issue đúng (code + cột) / số issue model khai báo. */
  correctIssues: number;
  claimedIssues: number;
  truthIssues: number;
}

export interface MetricAggregate {
  f1_micro: number | null;
  f1_macro: number | null;
  json_valid_rate: number | null;
  hallucination_rate: number | null;
  explanation_quality: number | null;
  p95_latency_ms: number | null;
  throughput_tok_s: number | null;
  peak_rss_bytes: number | null;
  failure_rate: number | null;
}

function prf(tp: number, fp: number, fn: number): { precision: number; recall: number; f1: number } {
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

/** Chuẩn hoá tên cặp (không phân biệt thứ tự) — giống `pairKey` của production. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('||');
}

/** Khóa lớp của một claim issue (DQ-01..DQ-04; DQ-05 bị cấm nên không chấm). */
const DQ_CODES = ['DQ-01', 'DQ-02', 'DQ-03', 'DQ-04'] as const;
type DqClass = (typeof DQ_CODES)[number];

interface RawIssue {
  code?: unknown;
  column?: unknown;
  severity?: unknown;
  evidence?: unknown;
}

function emptyClassScores(): Record<DetectionClass, ClassScore> {
  const out = {} as Record<DetectionClass, ClassScore>;
  for (const c of DETECTION_CLASSES) out[c] = { tp: 0, fp: 0, fn: 0, tn: 0 };
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Chấm 1 mẫu: đối chiếu phản hồi AI với đáp án vàng.
 */
export function scoreSample(sample: GoldSample, outcome: InferenceOutcome): ScoredSample {
  const classScores = emptyClassScores();
  const base: ScoredSample = {
    sampleId: sample.id,
    kind: sample.kind,
    truthPositive: sample.expected.hasIssue,
    predPositive: false,
    correct: false,
    falsePositive: false,
    missedIssue: false,
    droppedClaims: 0,
    totalClaims: 0,
    correctPairs: 0,
    claimedPairs: 0,
    truthPairs: sample.expected.notablePairs.length,
    correctVif: 0,
    truthVif: sample.expected.highVif.length,
    judgeScore: null,
    explanation: '',
    classScores,
    correctIssues: 0,
    claimedIssues: 0,
    truthIssues: sample.expected.issues.length,
  };

  if (!outcome.jsonValid || outcome.parsed === null) {
    base.predPositive = false;
    base.missedIssue = base.truthPositive;
    base.correct = !base.truthPositive;
    // Mọi lớp có ground truth đều bị bỏ sót.
    for (const c of DETECTION_CLASSES) {
      if (truthHasClass(sample, c)) classScores[c].fn += 1;
      else classScores[c].tn += 1;
    }
    return base;
  }

  // ── 1. Grounding phần corr-v1 bằng đúng hàm của production ────────────
  const parsed = outcome.parsed;
  const corrPart: Record<string, unknown> = {
    notablePairs: Array.isArray(parsed['notablePairs']) ? parsed['notablePairs'] : [],
    highVif: Array.isArray(parsed['highVif']) ? parsed['highVif'] : [],
    limits: Array.isArray(parsed['limits']) ? parsed['limits'] : [],
    nextSteps: Array.isArray(parsed['nextSteps']) ? parsed['nextSteps'] : [],
  };
  const cells = sample.payload.cells as ICorrelationCell[];
  const vifRows = sample.payload.vif?.rows ?? ([] as IVifRow[]);
  const grounded = groundAiAssessment(corrPart, cells, vifRows, null);

  const claimedPairs = grounded.notablePairs.length;
  const claimedVif = grounded.highVif.length;
  let droppedClaims = grounded.droppedClaims.length;

  const truthPairKeys = new Set(
    sample.expected.notablePairs.map((p) => pairKey(p.colA, p.colB)),
  );
  let correctPairs = 0;
  for (const p of grounded.notablePairs) {
    if (truthPairKeys.has(pairKey(p.colA, p.colB))) correctPairs += 1;
  }
  const truthVifSet = new Set(sample.expected.highVif);
  const correctVif = grounded.highVif.filter((c) => truthVifSet.has(c)).length;

  // ── 2. Grounding khối `issues` theo thống kê đã gửi ────────────────────
  const statsByColumn = new Map(sample.payload.stats.map((s) => [s.column, s]));
  const truthIssueKeys = new Set(
    sample.expected.issues.map((i) => `${i.code}||${i.column}`),
  );
  const rawIssues = Array.isArray(parsed['issues']) ? (parsed['issues'] as RawIssue[]) : [];
  let claimedIssues = 0;
  let correctIssues = 0;
  const claimedIssueClasses = new Set<DqClass>();
  const truthIssueClasses = new Set<DqClass>(
    sample.expected.issues.map((i) => i.code as DqClass),
  );

  for (const raw of rawIssues) {
    if (!isPlainObject(raw)) {
      droppedClaims += 1;
      continue;
    }
    const code = typeof raw['code'] === 'string' ? raw['code'] : '';
    const column = typeof raw['column'] === 'string' ? raw['column'] : '';
    claimedIssues += 1;
    const stat = statsByColumn.get(column);
    const codeOk = (DQ_CODES as readonly string[]).includes(code);
    if (!codeOk || !stat) {
      // Bịa mã lỗi hoặc bịa cột không tồn tại → ảo giác.
      droppedClaims += 1;
      continue;
    }
    // Kiểm tra code có khớp tình trạng thật của cột không.
    const matches =
      (code === 'DQ-01' && stat.missingRate > 0) ||
      (code === 'DQ-02' && stat.duplicateRate > 0) ||
      (code === 'DQ-03' && stat.invalidRate > 0) ||
      (code === 'DQ-04' && stat.outlierRate > 0);
    if (!matches) {
      droppedClaims += 1;
      continue;
    }
    claimedIssueClasses.add(code as DqClass);
    if (truthIssueKeys.has(`${code}||${column}`)) correctIssues += 1;
  }

  // ── 3. Cập nhật điểm theo 5 lớp ───────────────────────────────────────
  const corrPredicted = claimedPairs > 0 || claimedVif > 0;
  const corrTruth = sample.expected.notablePairs.length > 0 || sample.expected.highVif.length > 0;
  applyClass(classScores, 'corr_vif', corrTruth, corrPredicted);

  for (const code of DQ_CODES) {
    const truth = truthIssueClasses.has(code);
    const pred = claimedIssueClasses.has(code);
    applyClass(classScores, code, truth, pred);
  }
  const totalClaims = claimedPairs + claimedVif + claimedIssues;
  base.claimedPairs = claimedPairs;
  base.totalClaims = totalClaims;
  base.droppedClaims = droppedClaims;
  base.correctPairs = correctPairs;
  base.correctVif = correctVif;
  base.correctIssues = correctIssues;
  base.claimedIssues = claimedIssues;

  const limits = grounded.limits.join(' ');
  const nextSteps = grounded.nextSteps.join(' ');
  base.predPositive = totalClaims > 0 || limits.length > 0 || nextSteps.length > 0;
  base.correct = base.predPositive === base.truthPositive;
  base.falsePositive = !base.truthPositive && base.predPositive;
  base.missedIssue = base.truthPositive && !base.predPositive;
  base.explanation = `${limits} ${nextSteps}`.trim();
  return base;
}

/** Một lớp có ground truth hay không (dùng khi phản hồi hỏng). */
function truthHasClass(sample: GoldSample, cls: DetectionClass): boolean {
  if (cls === 'corr_vif') {
    return sample.expected.notablePairs.length > 0 || sample.expected.highVif.length > 0;
  }
  return sample.expected.issues.some((i) => i.code === cls);
}

/** Cộng 1 quan sát vào ma trận nhầm lẫn của một lớp. */
function applyClass(
  scores: Record<DetectionClass, ClassScore>,
  cls: DetectionClass,
  truth: boolean,
  pred: boolean,
): void {
  const s = scores[cls];
  if (truth && pred) s.tp += 1;
  else if (!truth && pred) s.fp += 1;
  else if (truth && !pred) s.fn += 1;
  else s.tn += 1;
}

/** Tính 9 chỉ số từ tập kết quả đã chấm. */
export function aggregate(scored: ScoredSample[], outcomes: InferenceOutcome[]): MetricAggregate {
  const n = scored.length;
  if (n === 0 || outcomes.length === 0) {
    return {
      f1_micro: null,
      f1_macro: null,
      json_valid_rate: null,
      hallucination_rate: null,
      explanation_quality: null,
      p95_latency_ms: null,
      throughput_tok_s: null,
      peak_rss_bytes: null,
      failure_rate: null,
    };
  }

  const tp = scored.filter((s) => s.truthPositive && s.predPositive).length;
  const fp = scored.filter((s) => s.falsePositive).length;
  const fn = scored.filter((s) => s.missedIssue).length;
  const f1_micro = prf(tp, fp, fn).f1;

  const f1_macro = macroF1(scored);

  const json_valid_rate = outcomes.filter((o) => o.jsonValid).length / outcomes.length;

  const totalClaims = scored.reduce((s, x) => s + x.totalClaims, 0);
  const dropped = scored.reduce((s, x) => s + x.droppedClaims, 0);
  const hallucination_rate = totalClaims === 0 ? 0 : dropped / totalClaims;

  const judged = scored.filter((s) => s.judgeScore !== null);
  const explanation_quality =
    judged.length === 0
      ? null
      : judged.reduce((s, x) => s + (x.judgeScore ?? 0), 0) / judged.length;

  const durations = outcomes.map((o) => o.durationMs).sort((a, b) => a - b);
  const p95_latency_ms = percentile(durations, 0.95);

  const tps = outcomes.filter((o) => o.tokensPerSecond > 0).map((o) => o.tokensPerSecond);
  const throughput_tok_s =
    tps.length === 0 ? null : tps.reduce((a, b) => a + b, 0) / tps.length;

  const rssList = outcomes.map((o) => o.engineRssBytes).filter((x) => x > 0);
  const peak_rss_bytes = rssList.length === 0 ? null : Math.max(...rssList);

  const failures = outcomes.filter((o) => o.error !== null && o.infraError !== true).length;
  const failure_rate = failures / outcomes.length;

  return {
    f1_micro,
    f1_macro,
    json_valid_rate,
    hallucination_rate,
    explanation_quality,
    p95_latency_ms,
    throughput_tok_s,
    peak_rss_bytes,
    failure_rate,
  };
}

/**
 * F1 macro trên 5 lớp: `corr_vif`, DQ-01, DQ-02, DQ-03, DQ-04.
 *
 * Lớp nào không có mẫu positive nào trong tập đo → bỏ qua khỏi trung bình
 * (tránh F1 = 0 do lớp vắng mặt làm sai lệch điểm).
 */
export function macroF1(scored: ScoredSample[]): number | null {
  const scores: number[] = [];
  for (const cls of DETECTION_CLASSES) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const s of scored) {
      const c = s.classScores[cls];
      tp += c.tp;
      fp += c.fp;
      fn += c.fn;
    }
    if (tp + fn === 0) continue; // lớp không xuất hiện trong ground truth
    scores.push(prf(tp, fp, fn).f1);
  }
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Phân vị (linear interpolation). */
export function percentile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower] ?? null;
  const lo = sorted[lower] ?? 0;
  const hi = sorted[upper] ?? 0;
  return lo + (hi - lo) * (pos - lower);
}
