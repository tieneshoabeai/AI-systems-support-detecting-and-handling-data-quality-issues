/**
 * Kiểm định thống kê bắt buộc trước khi tuyên bố model thắng (Phần 12 v8 §3.15.5 Bước 4).
 *
 *  - McNemar test: cặp đúng/sai phát hiện giữa hai model.
 *  - Wilcoxon signed-rank test: điểm judge giữa hai model.
 *  - Chỉ tuyên bố "tốt hơn" khi ΔF1 ≥ 0,03 và p < 0,05.
 */

/** Hàm phân phối chuẩn bậc hai (CDF) qua lỗi xấp xỉ Abramowitz–Stegun 7.1.26. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Chuẩn hoá phân phối chuẩn bằng hàm lỗi xấp xỉ (John D. Cook). */
function erfApprox(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export interface McNemarResult {
  /** Số mẫu mà A đúng, B sai. */
  b: number;
  /** Số mẫu mà A sai, B đúng. */
  c: number;
  /** p-value (exact binomial, hai phía). */
  pValue: number;
  /** Có khác biệt có ý nghĩa không. */
  significant: boolean;
}

/**
 * McNemar test (exact, hai phía) cho bảng thành phần 2×2:
 *   b = A đúng & B sai, c = A sai & B đúng.
 */
export function mcnemar(b: number, c: number): McNemarResult {
  const n = b + c;
  if (n === 0) {
    return { b, c, pValue: 1, significant: false };
  }
  const k = Math.min(b, c);
  // p = 2 * P(X <= k), X ~ Binomial(n, 0.5)
  let cumulative = 0;
  for (let i = 0; i <= k; i++) {
    cumulative += binomialPmf(i, n);
  }
  const pValue = Math.min(1, 2 * cumulative);
  return { b, c, pValue, significant: pValue < 0.05 };
}

function binomialPmf(k: number, n: number): number {
  let coeff = 1;
  for (let i = 0; i < k; i++) coeff = (coeff * (n - i)) / (i + 1);
  return coeff / 2 ** n;
}

export interface WilcoxonResult {
  /** Tổng hạng của các hiệu số dương. */
  wPlus: number;
  /** Tổng hạng của các hiệu số âm. */
  wMinus: number;
  /** p-value (xấp xỉ chuẩn với hiệu chỉnh). */
  pValue: number;
  /** Trung vị chênh lệch. */
  medianDiff: number;
  significant: boolean;
}

/**
 * Wilcoxon signed-rank test (thuật toán W của Wilcoxon, xấp xỉ chuẩn).
 * Dùng cho điểm judge của hai model trên cùng bộ mẫu.
 */
export function wilcoxonSignedRank(a: number[], b: number[]): WilcoxonResult {
  const n = Math.min(a.length, b.length);
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) diffs.push(d);
  }
  if (diffs.length === 0) {
    return { wPlus: 0, wMinus: 0, pValue: 1, medianDiff: 0, significant: false };
  }
  const absDiffs = diffs.map((d) => Math.abs(d));
  const order = absDiffs
    .map((v, i) => ({ v, i }))
    .sort((x, y) => x.v - y.v);
  const ranks = new Array<number>(diffs.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && (order[j + 1]?.v ?? 0) === (order[i]?.v ?? 0)) j += 1;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) {
      const idx = order[k]?.i;
      if (idx !== undefined) ranks[idx] = avgRank;
    }
    i = j + 1;
  }
  let wPlus = 0;
  let wMinus = 0;
  for (let k = 0; k < diffs.length; k++) {
    if ((diffs[k] ?? 0) > 0) wPlus += ranks[k] ?? 0;
    else wMinus += ranks[k] ?? 0;
  }
  const nEff = diffs.length;
  const mean = (nEff * (nEff + 1)) / 4;
  const sd = Math.sqrt((nEff * (nEff + 1) * (2 * nEff + 1)) / 24);
  const z = sd === 0 ? 0 : (wPlus - mean) / sd;
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  const sorted = [...diffs].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  const medianDiff =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);
  return { wPlus, wMinus, pValue, medianDiff, significant: pValue < 0.05 };
}

/** Ngưỡng chênh lệch F1 tối thiểu để coi là khác biệt thực chất. */
export const MIN_F1_DELTA = 0.03;

/** Kết luận so sánh 2 model theo quy tắc §3.15.5 Bước 4. */
export interface ComparisonVerdict {
  winner: 'A' | 'B' | 'tie';
  deltaF1: number;
  mcnemar: McNemarResult;
  wilcoxon: WilcoxonResult | null;
  /** true khi đủ điều kiện tuyên bố thắng. */
  canDeclareWinner: boolean;
  reason: string;
}

/**
 * So sánh 2 model.
 * @param aCorrect mảng boolean — model A đúng/sai theo từng mẫu
 * @param bCorrect mảng boolean — model B đúng/sai theo từng mẫu
 * @param judgeA điểm judge của A theo từng mẫu
 * @param judgeB điểm judge của B theo từng mẫu
 */
export function compareModels(
  aCorrect: boolean[],
  bCorrect: boolean[],
  judgeA: number[],
  judgeB: number[],
  truthPred?: { aTruth: boolean[]; aPred: boolean[]; bTruth: boolean[]; bPred: boolean[] },
): ComparisonVerdict {
  let b = 0;
  let c = 0;
  for (let i = 0; i < Math.min(aCorrect.length, bCorrect.length); i++) {
    const a = aCorrect[i] === true;
    const bv = bCorrect[i] === true;
    if (a && !bv) b += 1;
    else if (!a && bv) c += 1;
  }
  const m = mcnemar(b, c);
  const judgeAArr = judgeA.filter((x) => Number.isFinite(x));
  const judgeBArr = judgeB.filter((x) => Number.isFinite(x));
  const wilcoxon =
    judgeAArr.length > 0 && judgeBArr.length > 0
      ? wilcoxonSignedRank(judgeAArr, judgeBArr)
      : null;

  let f1A: number;
  let f1B: number;
  if (truthPred) {
    f1A = f1FromTruthPred(truthPred.aTruth, truthPred.aPred).f1;
    f1B = f1FromTruthPred(truthPred.bTruth, truthPred.bPred).f1;
  } else {
    f1A = f1From(aCorrect);
    f1B = f1From(bCorrect);
  }
  const deltaF1 = f1A - f1B;

  let winner: 'A' | 'B' | 'tie';
  if (Math.abs(deltaF1) < MIN_F1_DELTA) winner = 'tie';
  else winner = deltaF1 > 0 ? 'A' : 'B';

  const canDeclareWinner =
    winner !== 'tie' && m.significant && Math.abs(deltaF1) >= MIN_F1_DELTA;

  let reason: string;
  if (winner === 'tie') {
    reason = `ΔF1 = ${deltaF1.toFixed(3)} < ${MIN_F1_DELTA} → không coi là khác biệt, so tiếp chỉ số #3–#9.`;
  } else if (!m.significant) {
    reason = `ΔF1 = ${deltaF1.toFixed(3)} nhưng McNemar p = ${m.pValue.toFixed(4)} ≥ 0,05 → chưa đủ bằng chứng thống kê.`;
  } else {
    reason = `ΔF1 = ${deltaF1.toFixed(3)} ≥ ${MIN_F1_DELTA} và McNemar p = ${m.pValue.toFixed(4)} < 0,05.`;
  }

  return { winner, deltaF1, mcnemar: m, wilcoxon, canDeclareWinner, reason };
}

/**
 * F1 từ cặp (truthPositive, predPositive).
 *
 * `correct` chỉ là "predPositive == truthPositive" nên không đủ để tính F1
 * (ví dụ mẫu có vấn đề bị bỏ sót và mẫu sạch bị báo nhầm đều là `correct = false`).
 * Nếu không có cặp truth/pred thì fallback về xấp xỉ từ mảng boolean.
 */
export function f1FromTruthPred(
  truth: boolean[],
  pred: boolean[],
): { f1: number; tp: number; fp: number; fn: number } {
  const n = Math.min(truth.length, pred.length);
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (let i = 0; i < n; i++) {
    const t = truth[i] === true;
    const p = pred[i] === true;
    if (t && p) tp += 1;
    else if (!t && p) fp += 1;
    else if (t && !p) fn += 1;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { f1, tp, fp, fn };
}

/** F1 xấp xỉ từ mảng boolean đúng/sai (fallback khi thiếu cặp truth/pred). */
function f1From(correct: boolean[]): number {
  const tp = correct.filter((x) => x).length;
  const fp = correct.filter((x) => !x).length;
  const fn = 0;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

/** Chuẩn hoá điểm 0..100 theo min-max trên tập model (đảo chiều chỉ số "thấp là tốt"). */
export function normalizeScores(
  rows: { key: string; value: number | null; dir: 'higher' | 'lower' }[],
): Record<string, number | null> {
  const valid = rows.filter((r) => r.value !== null) as { key: string; value: number; dir: 'higher' | 'lower' }[];
  const out: Record<string, number | null> = {};
  if (valid.length === 0) return out;
  const min = Math.min(...valid.map((r) => r.value));
  const max = Math.max(...valid.map((r) => r.value));
  for (const r of rows) {
    if (r.value === null) {
      out[r.key] = null;
      continue;
    }
    const raw = max === min ? 1 : (r.value - min) / (max - min);
    out[r.key] = r.dir === 'higher' ? raw : 1 - raw;
  }
  return out;
}

/** Kiểm tra giả thuyết cho hàm erf dùng nội bộ. */
export function erfSelfTest(): boolean {
  return Math.abs(erfApprox(0) - 0) < 1e-9 && Math.abs(erfApprox(1) - 0.8427008) < 1e-5;
}
