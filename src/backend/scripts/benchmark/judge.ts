/**
 * LLM-as-judge chấm chéo — chỉ số #5 (chất lượng giải thích tiếng Việt, thang 1..5).
 *
 * Đặc tả §3.15.5 yêu cầu **chấm chéo** (model khác họ model đang đánh giá).
 * Vì vậy judge KHÔNG được là model đang được đo, và phải chấm theo rubric cố định.
 *
 * ── Vì sao phải CHẮNG (chunk) ────────────────────────────────────────────────
 * Judge nhận `(thống kê + giải thích)` của **mọi** mẫu. Với 200 mẫu × ~600 ký tự
 * thống kê ⇒ ~120.000 ký tự ≈ 35.000 token ⇒ vượt `num_ctx = 8192` ⇒ Ollama cắt
 * hoặc báo lỗi ⇒ **mất toàn bộ điểm judge** (chỉ số #5 = null).
 * Vì vậy chia thành lô nhỏ (`JUDGE_BATCH_SIZE`), mỗi lô 1 request.
 *
 * ── Vì sao cần CHỐNG self-preference ────────────────────────────────────────
 * Nếu judge cùng họ với model được chấm (ví dụ judge = `qwen3:14b` chấm
 * `qwen3:14b`) thì điểm bị thiên lệch ⇒ chỉ số #5 không khách quan.
 * `resolveJudgeModel()` tự chọn model **khác họ** theo danh sách ứng viên.
 */
import { CANDIDATES, OLLAMA_BASE_URL, type CandidateModel } from './models';
import { postJson } from './http-client';

/** Timeout cho 1 lượt judge (judge chấm nhiều mẫu trong 1 lượt → cần lâu hơn). */
const JUDGE_TIMEOUT_MS = Number(process.env.BENCH_JUDGE_TIMEOUT_MS ?? 900000);

/**
 * Số mẫu chấm trong 1 request judge.
 *
 * 10 mẫu × ~700 ký tự ≈ 7.000 ký tự ≈ 2.000 token → an toàn với `num_ctx = 8192`.
 * 200 mẫu ⇒ 20 request.
 */
export const JUDGE_BATCH_SIZE = Number(process.env.BENCH_JUDGE_BATCH ?? 10);

export interface JudgeInput {
  sampleId: string;
  explanation: string;
  stats: unknown;
}

const RUBRIC = [
  'Bạn là giám khảo chấm chất lượng giải thích phân tích chất lượng dữ liệu bằng tiếng Việt.',
  'Cho mỗi phần giải thích một điểm số nguyên từ 1 đến 5 theo tiêu chí:',
  '5 = chính xác, cụ thể, bám số liệu đã cho, đề xuất xử lý khả thi, tiếng Việt tự nhiên.',
  '4 = đúng và rõ ràng nhưng thiếu chi tiết hoặc đề xuất chung chung.',
  '3 = đúng một phần, có điểm sai lệch nhỏ hoặc diễn đạt kém.',
  '2 = nhiều sai lệch, suy diễn, hoặc gần như không bám số liệu.',
  '1 = sai hoàn toàn, bịa số, hoặc không phải tiếng Việt.',
  'Trả về duy nhất một JSON: {"scores": {"<sampleId>": <điểm 1..5>}}',
].join('\n');

/**
 * Chọn model judge **khác họ** với model đang được chấm.
 *
 * @param requested tên model do CLI chỉ định (có thể rỗng)
 * @param target model đang được chấm
 * @returns tên model dùng làm judge
 */
export function resolveJudgeModel(requested: string | null, target: CandidateModel): string {
  const pool = CANDIDATES.filter((c) => c.family !== target.family);
  if (requested) {
    const match = CANDIDATES.find((c) => c.ollama === requested || c.id === requested);
    // Nếu yêu cầu model cùng họ với model đang chấm → cảnh báo, dùng model khác họ.
    if (match && match.family !== target.family) return match.ollama;
    if (!match) return requested;
  }
  // Ưu tiên model lớn hơn trong nhóm khác họ (chấm chéo công bằng hơn).
  const preferred =
    pool.find((c) => c.id === 'M2') ??
    pool.find((c) => c.id === 'M4') ??
    pool.find((c) => c.id === 'M5') ??
    pool[0];
  return preferred?.ollama ?? 'qwen3:8b';
}

/**
 * Chấm nhiều mẫu — tự chia lô để không vượt context window.
 */
export async function judgeExplanations(
  judgeModel: string,
  inputs: JudgeInput[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (inputs.length === 0) return result;

  for (let i = 0; i < inputs.length; i += JUDGE_BATCH_SIZE) {
    const batch = inputs.slice(i, i + JUDGE_BATCH_SIZE);
    const batchScores = await judgeBatch(judgeModel, batch);
    for (const [k, v] of batchScores) result.set(k, v);
  }
  return result;
}

/** Chấm 1 lô mẫu (1 request). */
async function judgeBatch(
  judgeModel: string,
  inputs: JudgeInput[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (inputs.length === 0) return result;

  const payload = inputs.map((i) => ({
    sampleId: i.sampleId,
    thongKe: i.stats,
    giaiThich: i.explanation.slice(0, 1200) || '(khong co giai thich)',
  }));

  const prompt = `${RUBRIC}\n\nDANH SACH CAN CHAM:\n${JSON.stringify(payload)}`;

  try {
    const res = await postJson(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: judgeModel,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: 'json',
        think: false,
        options: { temperature: 0, num_predict: 2048, num_ctx: 8192 },
      },
      JUDGE_TIMEOUT_MS,
    );
    if (res.error !== null || res.status < 200 || res.status >= 300) return result;
    const data = JSON.parse(res.body) as { message?: { content?: string } };
    const raw = data.message?.content ?? '';
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return result;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { scores?: Record<string, unknown> };
    const scores = parsed.scores ?? {};
    for (const [k, v] of Object.entries(scores)) {
      const num = Number(v);
      if (Number.isFinite(num) && num >= 1 && num <= 5) result.set(k, num);
    }
  } catch {
    // Judge lỗi → bỏ trống điểm judge (chỉ số #5 = null), không làm hỏng benchmark.
  }
  return result;
}
