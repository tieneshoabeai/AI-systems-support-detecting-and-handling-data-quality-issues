import { z } from 'zod';
import {
  DEFAULT_EMBEDDING_DIM,
  MAX_EMBEDDING_DIM,
} from '../../domain/utils/embedding-dim.util';

// Helper chuyển đổi biến môi trường chuỗi sang boolean an toàn
const boolEnv = (defaultValue = false) : z.ZodEffects<z.ZodBoolean, boolean, unknown> =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return defaultValue;
    if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1';
    return Boolean(val);
  }, z.boolean());

export const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** URL gốc của ứng dụng web — dùng cho link trong email (VD: link đặt lại mật khẩu). */
  APP_URL: z.string().optional(),

  // Cloudflare Zero Trust Tunnel & SSL/TLS Configuration
  CLOUDFLARE_TUNNEL_ENABLED: boolEnv(true),
  CLOUDFLARE_PROXY_TRUST: boolEnv(true),
  CLOUDFLARE_TUNNEL_URL: z.string().optional(),
  SSL_ENABLED: boolEnv(false),
  SSL_PORT: z.coerce.number().default(443),
  SSL_KEY_PATH: z.string().default('certs/privkey.pem'),
  SSL_CERT_PATH: z.string().default('certs/fullchain.pem'),

  // MongoDB Atlas
  MONGODB_URI: z.string().min(1, 'MONGODB_URI không được để trống'),

  // Cloudflare R2 / S3 Storage (Optional for Local Fallback)
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().default('data-quality-storage'),
  S3_REGION: z.string().default('auto'),
  STORAGE_MAX_QUOTA_BYTES: z.coerce.number().default(10 * 1024 * 1024 * 1024), // 10 GB
  WORKSPACE_STORAGE_QUOTA_BYTES: z.coerce.number().default(500 * 1024 * 1024), // 500 MB/workspace (§3.8)
  STORAGE_WARN_THRESHOLD_RATIO: z.coerce.number().min(0).max(1).default(0.9), // Cảnh báo khi đạt 90%

  // JWT & Cryptography
  /**
   * OPEN-01 — **Admin bootstrap**.
   *
   * Không có endpoint công khai để tự phong admin. Tài khoản `admin` được tạo
   * **một lần** khi ứng dụng khởi động, từ `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
   *
   * - Bỏ trống cả hai → không tạo admin (hợp lệ ở môi trường dev).
   * - Có một mà thiếu cái kia → bị cảnh báo lúc khởi động, không tạo admin.
   */
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL phải là email hợp lệ').optional(),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD phải có tối thiểu 8 ký tự').optional(),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET phải có tối thiểu 16 ký tự'),  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET phải có tối thiểu 16 ký tự'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  /** Hạn phiên khi người dùng chọn "ghi nhớ đăng nhập" (remember me). */
  JWT_REFRESH_REMEMBER_EXPIRATION: z.string().default('30d'),
  SALT_ROUNDS: z.coerce.number().default(12),
  DATA_ENCRYPTION_KEY: z.string().optional(),

  // Google Gemini API (legacy, khong dung cho corr-v1)
  GEMINI_API_KEY: z.string().optional(),

  // ── Google OAuth 2.0 (AUTH-03 — đăng nhập bằng Google) ────────────────────
  // Cả 3 biến phải có đồng thời thì endpoint mới hoạt động;
  // thiếu bất kỳ biến nào → `GET /auth/google` trả 501 DEPENDENCY_UNAVAILABLE.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Redirect URI đã đăng ký trong Google Cloud Console.
   *  Google yêu cầu HTTPS, trừ `http://localhost` khi phát triển. */
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // AI suy luan cuc bo (corr-v1): vLLM prod / Ollama dev
  AI_ENGINE: z.enum(['vllm', 'ollama']).default('ollama'),
  AI_INFERENCE_BASE_URL: z.string().optional(),
  AI_INFERENCE_API_KEY: z.string().optional(),
  AI_MODEL_ID: z.string().optional(),
  AI_JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(180000),
  AI_WORKER_ENABLED: z.preprocess((v) : boolean => {
    if (v === undefined || v === null || v === '') return false;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    return Boolean(v);
  }, z.boolean()),
  AI_WORKER_INTERVAL_MS: z.coerce.number().int().min(1000).max(600000).default(10000),
  REPORT_WORKER_ENABLED: z.preprocess((v) : boolean => {
    if (v === undefined || v === null || v === '') return false;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    return Boolean(v);
  }, z.boolean()),

  KAFKA_BROKERS: z.string().default(''),
  OUTBOX_RELAY_ENABLED: boolEnv(true),
  WORKER_MODE: z.enum(['api', 'worker', 'all']).default('all'),

  // Redis (Phần 10 v6 §6.2b): BẮT BUỘC cho cache + rate-limit + Socket.IO adapter
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_KEY_PREFIX: z.string().default('dq:'),

  // AI suy luan cuc bo (Phần 10 v6): model + checksum + nguong RAM + RAG
  AI_MODEL_PRIMARY: z.string().default('qwen3-14b'),
  AI_MODEL_FAST: z.string().default('qwen3-8b'),
  AI_MODEL_PATH: z.string().default('/models'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(180000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
  AI_MAX_EVIDENCE_PER_COLUMN: z.coerce.number().int().min(1).max(100).default(20),
  AI_MASK_PII_ENABLED: z.preprocess((v) : boolean => {
    if (v === undefined || v === null || v === '') return true;
    if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
    return Boolean(v);
  }, z.boolean()),
  AI_RAG_ENABLED: boolEnv(true),
  AI_RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
  AI_RAG_MIN_TRUST_SCORE: z.coerce.number().min(0).max(1).default(0.6),
  AI_RAM_GUARD_PERCENT: z.coerce.number().int().min(1).max(100).default(90),
  AI_MIN_RAM_GB: z.coerce.number().int().min(1).default(4),
  /**
   * GĐ0 — ngưỡng an toàn chống quá tải máy khi phân tích AI.
   * Dataset có `rowCount` vượt ngưỡng này sẽ bị từ chối bằng HTTP 413
   * (`ANALYSIS_TOO_LARGE`) TRƯỚC khi đọc bất kỳ record nào từ MongoDB.
   * Lý do: `listAllRecords()` nạp toàn bộ dataset vào RAM, BSON deserialization
   * + biến đổi in-memory tạo peak-memory vài GB → OOM / quá nhiệt CPU.
   *
   * GĐ11 — mặc định hạ 100.000 → 50.000 (đo được peak RSS 568 MB trên dataset
   * 100.000 dòng thật). Vẫn cấu hình được qua biến môi trường này.
   * @see modules/analysis/application/commands/run-analysis.handler.ts
   */
  ANALYSIS_MAX_ROWS: z.coerce.number().int().min(1).max(5_000_000).default(50_000),
  /**
   * GĐ12 — số phân tích **đồng bộ** tối đa chạy cùng lúc trong một tiến trình.
   *
   * `POST /projects/:id/analysis` chạy inline trong request → mỗi lần chặn
   * event loop ~6 giây với dataset 100.000 dòng. Nếu nhiều request cùng lúc,
   * chúng xếp hàng và **mọi endpoint khác** của cùng instance bị chậm theo.
   *
   * Giới hạn số phân tích đồng thời + trả `429` khi đã đủ slot → event loop
   * không bị chặn bởi hàng đợi, **hợp đồng API không đổi**.
   *
   * Lưu ý: đây là giới hạn **trên mỗi instance**. Chạy N instance (replica)
   * → tổng số phân tích đồng thời = N × giá trị này.
   */
  ANALYSIS_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(1),
  /**
   * Chiều vector đặc trưng RAG few-shot.
   *
   * Mặc định lấy từ `DEFAULT_EMBEDDING_DIM` — **nguồn sự thật duy nhất**, dùng
   * chung với runtime (`RagFewShotService`) và script migration
   * `db:migrate:scrub-few-shot` (OPEN-FB-02).
   *
   * Lưu ý: `EMBEDDING_MODEL` là biến **chết** — `embedText` là hàm hash nội
   * bộ (FNV-1a), không gọi model embedding nào. Giữ lại để không phá tài liệu
   * cũ; giá trị `dim` chỉ là số phần tử của vector đặc trưng.
   */
  EMBEDDING_MODEL: z.string().default('qwen3-embedding-0.6b'),
  EMBEDDING_DIM: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_EMBEDDING_DIM)
    .default(DEFAULT_EMBEDDING_DIM),

  // Realtime WebSocket (Socket.io)
  SOCKET_ENABLED: boolEnv(true),

  // Email Alerting (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('AI Data Quality Platform <noreply@data-quality.local>'),

  // Push Notification (ntfy.sh)
  NTFY_ENABLED: boolEnv(false),
  NTFY_BASE_URL: z.string().default('https://ntfy.sh'),
  NTFY_TOPIC: z.string().optional(),
  NTFY_ACCESS_TOKEN: z.string().optional(),
  NTFY_REQUEST_TIMEOUT_MS: z.coerce.number().default(5000),

  // 10. Bootstrap / Seed Initial Data
  ORGANIZATION_ID: z.string().optional(),
  OWNER_EMAIL: z.string().email().optional(),
  OWNER_PASSWORD: z.string().min(6).optional(),
});

export type EnvironmentVariables = z.infer<typeof EnvironmentSchema>;

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const result = EnvironmentSchema.safeParse(config);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((e) => `  - [${e.path.join('.')}] ${e.message}`)
      .join('\n');
    throw new Error(`\n[Config Validation Error] Sai cấu hình biến môi trường:\n${errorMessages}\n`);
  }

  return result.data;
}
