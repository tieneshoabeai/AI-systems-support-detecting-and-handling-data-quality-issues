/**
 * Cấu hình 5 model ứng viên + 9 chỉ số cho benchmark (Phần 12 v8 mục 3.15.5).
 *
 * Định dạng lượng tử chuẩn production: GGUF Q4_K_M.
 *  - 4 model lấy từ Ollama Registry (đã đóng gói sẵn Q4_K_M).
 *  - Gemma-3-12B: Ollama Registry trả HTTP 412 cho manifest → tải GGUF Q4_K_M từ
 *    HuggingFace (unsloth/gemma-3-12b-it-GGUF) rồi import bằng Modelfile.
 */
export const OLLAMA_BASE_URL = process.env.BENCH_OLLAMA_URL ?? 'http://127.0.0.1:11434';

/**
 * Tham số suy luận cố định cho mọi model (đặc tả: temperature=0.2, top_p=0.9, seed cố định).
 *
 * `num_predict` đặt 640 vì (đo thực tế trên VPS CPU-only, không GPU):
 *  - prompt eval ~4,8 tok/s → ~723 token prompt ≈ 150s
 *  - generate ~2,3 tok/s → 640 token ≈ 278s
 *  - ⇒ ~430s/lượt.
 *
 * ⚠️ **KHÔNG được hạ dưới 640**: đo thực tế với `num_predict=384` cho
 * `done_reason = "length"` ⇒ Ollama **cắt cụt JSON** (thiếu dấu `}`) ⇒
 * `json_valid_rate = 0` dù nội dung model trả về rất đúng.
 * JSON đầy đủ (notablePairs + highVif + issues + limits + nextSteps + giải thích
 * tiếng Việt) cần ~450–600 token.
 */
export const INFERENCE_PARAMS = Object.freeze({
  temperature: 0.2,
  top_p: 0.9,
  seed: 42,
  num_predict: 640,
  num_ctx: 8192,
});

/**
 * Số cột tối đa đưa vào ma trận tương quan của mừng mẫu vàng.
 *
 * Đo thực tế: prompt eval ~4,8 tok/s → mỗi cột thêm vào ma trận ~150 token.
 * Giới hạn 5 cột giữ prompt ở ~723 token (vẫn đủ phủ 5 nhóm DQ theo đặc tả
 * và khớp ràng buộc "số cột gửi tối đa 10" của Phần 12 v8 §3.9).
 */
export const MAX_COLUMNS_PER_SAMPLE = Number(process.env.BENCH_MAX_COLUMNS ?? 5);

/** Số lần lặp đo (Q4 không tất định tuyệt đối) → báo cáo mean ± std. */
export const REPEATS = Number(process.env.BENCH_REPEATS ?? 3);

/** Kích thước tập vàng. */
export const GOLD_SIZE = Number(process.env.BENCH_SAMPLES ?? 200);

/**
 * Timeout mỗi lượt.
 *
 * Đo thực tế trên máy này: prompt eval ~4,8 tok/s, generate ~2,3 tok/s.
 * Prompt ~723 token → ~150s đọc prompt + 640 token ≈ 278s sinh ≈ 430s/lượt.
 * → Timeout 900s để thu được số thay vì cắt ngang giữa chừng.
 * Trên VPS production trống (không chạy Cursor/Firefox) tốc độ cao hơn nhiều.
 */
export const REQUEST_TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS ?? 900000);

export interface CandidateModel {
  /** Khoá báo cáo M1..M5 */
  id: string;
  /** Tên model trong Ollama */
  ollama: string;
  /** Họ model (kiểm tra chi phí tái sử dụng tokenizer/embedding) */
  family: string;
  /** Quy mô tham số */
  params: string;
  /** Định dạng lượng tử */
  quant: string;
  /** Ghi chú */
  note: string;
}

/** 5 model ứng viên. */
export const CANDIDATES: readonly CandidateModel[] = Object.freeze([
  {
    id: 'M1',
    ollama: 'qwen3:14b',
    family: 'qwen3',
    params: '14B',
    quant: 'Q4_K_M',
    note: 'Ứng viên chính của hướng A (bật/tắt thinking mode).',
  },
  {
    id: 'M2',
    ollama: 'gemma3:12b',
    family: 'gemma3',
    params: '12B',
    quant: 'Q4_K_M',
    note: 'Gemma-3-12B-IT, import từ GGUF HuggingFace (Ollama Registry trả 412).',
  },
  {
    id: 'M3',
    ollama: 'qwen3:8b',
    family: 'qwen3',
    params: '8B',
    quant: 'Q4_K_M',
    note: 'Nhẹ nhất trong họ Qwen3.',
  },
  {
    id: 'M4',
    ollama: 'llama3.1:8b',
    family: 'llama3',
    params: '8B',
    quant: 'Q4_K_M',
    note: 'Họ khác tokenizer — kiểm tra chi phí chuyển đổi token.',
  },
  {
    id: 'M5',
    ollama: 'mistral:7b',
    family: 'mistral',
    params: '7B',
    quant: 'Q4_K_M',
    note: 'Nhẹ nhất, làm mốc sàn về chi phí tài nguyên.',
  },
]);

export type MetricDirection = 'higher' | 'lower';

export interface MetricSpec {
  key: string;
  group: string;
  label: string;
  weight: number;
  threshold: number;
  dir: MetricDirection;
}

/** 9 chỉ số / 5 nhóm, tổng trọng số = 100. */
export const METRICS: readonly MetricSpec[] = Object.freeze([
  { key: 'f1_micro', group: 'quality', label: 'F1 phát hiện (micro)', weight: 30, threshold: 0.75, dir: 'higher' },
  { key: 'f1_macro', group: 'quality', label: 'F1 macro theo DQ-01→DQ-05', weight: 10, threshold: 0.7, dir: 'higher' },
  { key: 'json_valid_rate', group: 'compliance', label: 'Tỉ lệ JSON hợp lệ', weight: 12, threshold: 0.98, dir: 'higher' },
  { key: 'hallucination_rate', group: 'compliance', label: 'Tỉ lệ ảo giác (grounding)', weight: 10, threshold: 0.02, dir: 'lower' },
  { key: 'explanation_quality', group: 'language', label: 'Chất lượng giải thích tiếng Việt', weight: 13, threshold: 4.0, dir: 'higher' },
  { key: 'p95_latency_ms', group: 'performance', label: 'p95 latency / 1 job', weight: 10, threshold: 180000, dir: 'lower' },
  { key: 'throughput_tok_s', group: 'performance', label: 'Throughput (tok/s)', weight: 5, threshold: 4, dir: 'higher' },
  { key: 'peak_rss_bytes', group: 'resource', label: 'RSS đỉnh', weight: 5, threshold: 11 * 1024 ** 3, dir: 'lower' },
  { key: 'failure_rate', group: 'ops', label: 'Độ ổn định (% lỗi/retry)', weight: 5, threshold: 0.02, dir: 'lower' },
]);

export type MetricScores = Record<string, number | null>;

/** Các ngưỡng tuyệt đối bị rớt → model bị loại khỏi vòng chốt. */
export function thresholdFailures(scores: MetricScores): string[] {
  return METRICS.filter((m) => {
    const v = scores[m.key];
    if (v === null || v === undefined || Number.isNaN(v)) return true;
    return m.dir === 'higher' ? v < m.threshold : v > m.threshold;
  }).map((m) => m.key);
}
