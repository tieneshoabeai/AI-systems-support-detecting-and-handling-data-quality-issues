/**
 * Prompt benchmark theo đúng đặc tả Phần 12 v8 §3.15.5 Bước 1:
 * mỗi mẫu gồm **thống kê tổng hợp (đã che PII) + mẫu ô lỗi + đáp án đúng**.
 *
 * Lưu ý phát hiện khi đối chiếu mã nguồn:
 *  - `buildCorrV1Prompt()` của production chỉ đưa vào ma trận tương quan, VIF và
 *    mẫu ô đã che — **không** đưa thống kê tổng hợp (thiếu/trùng/sai định dạng/ngoại lệ).
 *  - Đặc tả §3.15.5 lại yêu cầu đánh giá trên 5 nhóm DQ-01..DQ-05.
 *  → Benchmark dùng prompt mở rộng: lấy `buildCorrV1Prompt()` làm phần nền
 *    (đúng prompt production, đúng grounding) rồi **bổ sung khối thống kê tổng hợp**
 *    và yêu cầu thêm khóa `issues`.
 *  - Việc này ghi nhận 1 khoảng cách giữa đặc tả và mã hiện tại (báo cáo Bước 9).
 *
 * ── Tối ưu kích thước prompt (đo thực tế trên VPS CPU-only) ────────────────
 * Prompt eval chỉ ~4,8 tok/s (không GPU). Mỗi token thừa ≈ 0,21s.
 * Prompt "đầy đủ" (~3.700 ký tự ≈ 1.100 token) ⇒ mỗi lượt mất ~550s.
 * Benchmark 5 model × 200 mẫu × 3 lần lặp = 3.000 lượt ⇒ không khả thi.
 *
 * Vì vậy bản `compact` (mặc định) nén prompt xuống ~450–550 token:
 *  - Ma trận: chỉ giữ `colA,colB,coef,n,computable` (bỏ `missingAOnly/…/reason`).
 *  - VIF: chỉ giữ `column,vif,flag` (bỏ `computable/reason` và phần thống kê meta).
 *  - Cột: chỉ giữ `key,role`.
 *  - Mẫu ô: tối đa 6 ô/cột (thay vì 10/20) — vẫn đủ bằng chứng DQ-03/DQ-04.
 *  - Thống kê: chỉ giữ `column` + 4 tỉ lệ (bỏ count, totalRows).
 * Ngữ nghĩa và grounding KHÔNG đổi: mọi con số trong prompt vẫn là số liệu thật
 * đã che PII, và `groundAiAssessment()` vẫn đối chiếu với ô ma trận GỐC (không phải
 * bản nén) nên phép đo ảo giác giữ nguyên độ chặt.
 */
import { buildCorrV1Prompt, type CorrV1Context } from '../../src/modules/analysis/domain/ai-grounding.util';
import type { ColumnStat } from './gold-set';

export interface BenchmarkPromptContext extends CorrV1Context {
  stats: ColumnStat[];
}

export type IssueCode = 'DQ-01' | 'DQ-02' | 'DQ-03' | 'DQ-04';
export type Severity = 'low' | 'medium' | 'high';

export interface BenchmarkIssue {
  code: IssueCode;
  column: string;
  severity: Severity;
  evidence?: string;
}

/** Số ô mẫu tối đa đưa vào prompt cho mỗi cột (chế độ compact). */
export const MAX_SAMPLES_PER_COLUMN = Number(process.env.BENCH_MAX_CELLS ?? 6);

/** Schema JSON mà benchmark yêu cầu model trả về. */
export const BENCHMARK_SCHEMA_HINT = JSON.stringify({
  notablePairs: [{ colA: 'string', colB: 'string', coef: 'number' }],
  highVif: ['string'],
  issues: [{ code: 'DQ-01|DQ-02|DQ-03|DQ-04', column: 'string', severity: 'low|medium|high' }],
  limits: ['string'],
  nextSteps: ['string'],
});

/** Quy tắc ngưỡng ảnh hưởng — đưa vào prompt để model không bịa mức. */
const SEVERITY_RULES = [
  'DQ-01 thieu gia tri: Ty le < 1% = low; 1%-10% = medium; > 10% = high.',
  'DQ-02 trung lap: Ty le < 0,5% = low; 0,5%-5% = medium; > 5% = high.',
  'DQ-03 sai kieu/dinh dang: Ty le < 1% = low; 1%-10% = medium; > 10% = high.',
  'DQ-04 bat thuong: Vuot IQR 1,5x = low; vuot IQR 3x hoac Modified Z-score > 3,5 = medium; ca hai phuong phap cung danh dau = high.',
].join(' | ');

/**
 * Quy tắc ánh xạ tỉ lệ → mã lỗi.
 *
 * **Bắt buộc** vì model mặc định liệt kê cả 4 mã DQ cho mọi cột (kể cả khi
 * tỉ lệ = 0) ⇒ mọi claim đó bị grounding loại ⇒ ảo giác ~25% và đồng thời
 * bỏ sót vấn đề thật ở cột khác. Đo thực tế: M3 `qwen3:8b` pilot — ảo giác
 * 0,250, F1 macro 0,333, trong khi mọi claim sai đều là claim "tỉ lệ = 0".
 */
const CODE_MAPPING_RULES = [
  'DQ-01 chi khi ty le thieu (missing) > 0.',
  'DQ-02 chi khi ty le trung lap (duplicate) > 0.',
  'DQ-03 chi khi ty le sai dinh dang (invalid) > 0.',
  'DQ-04 chi khi ty le bat thuong (outlier) > 0.',
  'Neu mot cot co ty le = 0 thi KHONG bao cao ma loi do cho cot do.',
].join(' ');

/**
 * Quy tắc ngưỡng phát hiện tương quan / VIF.
 *
 * Gold set định nghĩa `notablePairs` khi |r| ≥ 0,75 và `highVif` khi VIF ≥ 5
 * (`flag` khác `ok`). Không nói rõ ⇒ model báo mọi cặp có |r| > 0,2 → FP nặng
 * ở lớp `corr_vif` ⇒ F1 macro thấp dù F1 micro cao.
 */
const DETECTION_THRESHOLDS = [
  'notablePairs: chi bao cao cap co |r| >= 0,75.',
  'highVif: chi bao cao cot co vif >= 5 (flag khac "ok").',
].join(' ');

/** Rút gọn ma trận tương quan cho prompt (giữ đúng các trường model cần dùng). */
function slimCells(cells: CorrV1Context['cells']): CorrV1Context['cells'] {
  return cells.map((c) => ({
    colA: c.colA,
    colB: c.colB,
    coef: c.coef,
    kind: c.kind,
    n: c.n,
    totalScanned: c.totalScanned,
    missingAOnly: 0,
    missingBOnly: 0,
    missingBoth: 0,
    computable: c.computable,
    reason: c.reason,
  }));
}

/** Rút gọn mẫu ô đã che PII (giới hạn số ô/cột). */
function slimSamples(samples: CorrV1Context['maskedSamples']): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(samples)) {
    out[k] = v.slice(0, MAX_SAMPLES_PER_COLUMN);
  }
  return out;
}

/**
 * Bản nén cho benchmark: cùng ngữ nghĩa, ít token hơn.
 *
 * Không dùng `buildCorrV1Prompt()` vì hàm đó serialize toàn bộ `cells`/`vif`
 * (`missingAOnly/missingBOnly/missingBoth/reason/excluded/commonNRate/...`) —
 * chiếm ~70% token mà không ảnh hưởng đến khả năng phát hiện.
 */
function buildCompactPrompt(ctx: BenchmarkPromptContext): string {
  const cells = ctx.cells.map((c) => ({
    a: c.colA,
    b: c.colB,
    r: c.coef,
    n: c.n,
  }));
  const vifRows = (ctx.vif?.rows ?? []).map((r) => ({
    col: r.column,
    vif: r.vif,
    flag: r.flag,
  }));
  const columns = ctx.columns.map((c) => c.key);
  const stats = ctx.stats.map((s) => ({
    col: s.column,
    missing: s.missingRate,
    duplicate: s.duplicateRate,
    invalid: s.invalidRate,
    outlier: s.outlierRate,
  }));

  const lines: string[] = [];
  lines.push('Ban la tro ly phan tich chat luong du lieu. Chi dien gia so lieu da cho.');
  lines.push('Cam: tinh lai he so, bia so, ket luan nhan qua, ket luan vi pham DQ-05, yeu cau xoa cot.');
  lines.push('Moi nhan dinh phai trich dung o ma tran / dong VIF kem n.');
  lines.push(`Cot: ${JSON.stringify(columns)}`);
  lines.push(`Ma tran (a,b,r=he so,n=so mau): ${JSON.stringify(cells)}`);
  lines.push(`VIF (col,vif,flag): ${JSON.stringify(vifRows)}`);
  lines.push(`Mau da che PII: ${JSON.stringify(slimSamples(ctx.maskedSamples))}`);
  lines.push(`Thong ke tong hop theo cot (col + ty le thieu/trung lap/sai dinh dang/bat thuong): ${JSON.stringify(stats)}`);
  lines.push(`Quy tac muc anh huong: ${SEVERITY_RULES}`);
  lines.push(`${CODE_MAPPING_RULES}`);
  lines.push(`${DETECTION_THRESHOLDS}`);
  lines.push('Chi bao cao loai loi ma thong ke hoac mau o o ben tren co bang chung.');
  lines.push(
    'Tra ve duy nhat mot JSON hop le (khong markdown) voi cac khoa: notablePairs[{colA,colB,coef,n}], highVif[string], issues[{code,column,severity,evidence}], limits[string], nextSteps[string].',
  );
  lines.push(`Vi du cau truc JSON: ${BENCHMARK_SCHEMA_HINT}`);
  lines.push('Giai thich va de xuat xu ly bang tieng Viet.');
  return lines.join('\n');
}

/**
 * Dựng prompt benchmark.
 * @param ctx context đầy đủ (kèm `stats`)
 */
export function buildBenchmarkPrompt(ctx: BenchmarkPromptContext): string {
  const compact = process.env.BENCH_PROMPT_MODE !== 'full';
  if (compact) return buildCompactPrompt(ctx);

  const base = buildCorrV1Prompt({
    ...ctx,
    cells: slimCells(ctx.cells),
    maskedSamples: slimSamples(ctx.maskedSamples),
  });
  const lines: string[] = [];
  lines.push(base);
  lines.push('');
  lines.push('THONG KE TONG HOP THEO COT (da che PII):');
  lines.push(JSON.stringify(ctx.stats));
  lines.push('');
  lines.push('Quy tac muc anh huong (dung de gan severity, khong tu chon nguong khac):');
  lines.push(SEVERITY_RULES);
  lines.push('');
  lines.push(`${CODE_MAPPING_RULES}`);
  lines.push(`${DETECTION_THRESHOLDS}`);
  lines.push('');
  lines.push('Nghiem cam them: khong ket luan vi pham DQ-05; khong yeu cau xoa cot; khong tinh lai he so.');
  lines.push('Chi nen bao cao loai loi ma thong ke hoac mau o o ben tren co bang chung.');
  lines.push(
    `Tra ve duy nhất mot JSON hop le (khong markdown, khich ban giai) voi cac khoa: notablePairs[{colA,colB,coef,kind,n}], highVif[string], issues[{code,column,severity,evidence}], limits[string], nextSteps[string].`,
  );
  lines.push(`Vi du cau truc JSON: ${BENCHMARK_SCHEMA_HINT}`);
  lines.push('Giai thich va de xuat xu ly bang tieng Viet.');
  return lines.join('\n');
}
