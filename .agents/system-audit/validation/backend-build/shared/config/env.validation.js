"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentSchema = void 0;
exports.validate = validate;
const zod_1 = require("zod");
const boolEnv = (defaultValue = false) => zod_1.z.preprocess((val) => {
    if (val === undefined || val === null || val === '')
        return defaultValue;
    if (typeof val === 'string')
        return val.toLowerCase() === 'true' || val === '1';
    return Boolean(val);
}, zod_1.z.boolean());
exports.EnvironmentSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().default(3000),
    API_PREFIX: zod_1.z.string().default('api/v1'),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:5173'),
    CLOUDFLARE_TUNNEL_ENABLED: boolEnv(true),
    CLOUDFLARE_PROXY_TRUST: boolEnv(true),
    CLOUDFLARE_TUNNEL_URL: zod_1.z.string().optional(),
    SSL_ENABLED: boolEnv(false),
    SSL_PORT: zod_1.z.coerce.number().default(443),
    SSL_KEY_PATH: zod_1.z.string().default('certs/privkey.pem'),
    SSL_CERT_PATH: zod_1.z.string().default('certs/fullchain.pem'),
    MONGODB_URI: zod_1.z.string().min(1, 'MONGODB_URI không được để trống'),
    S3_ENDPOINT: zod_1.z.string().optional(),
    S3_ACCESS_KEY_ID: zod_1.z.string().optional(),
    S3_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    S3_BUCKET_NAME: zod_1.z.string().default('data-quality-storage'),
    S3_REGION: zod_1.z.string().default('auto'),
    STORAGE_MAX_QUOTA_BYTES: zod_1.z.coerce.number().default(10 * 1024 * 1024 * 1024),
    WORKSPACE_STORAGE_QUOTA_BYTES: zod_1.z.coerce.number().default(500 * 1024 * 1024),
    STORAGE_WARN_THRESHOLD_RATIO: zod_1.z.coerce.number().min(0).max(1).default(0.9),
    JWT_ACCESS_SECRET: zod_1.z.string().min(16, 'JWT_ACCESS_SECRET phải có tối thiểu 16 ký tự'),
    JWT_ACCESS_EXPIRATION: zod_1.z.string().default('15m'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(16, 'JWT_REFRESH_SECRET phải có tối thiểu 16 ký tự'),
    JWT_REFRESH_EXPIRATION: zod_1.z.string().default('7d'),
    SALT_ROUNDS: zod_1.z.coerce.number().default(12),
    DATA_ENCRYPTION_KEY: zod_1.z.string().optional(),
    GEMINI_API_KEY: zod_1.z.string().optional(),
    AI_ENGINE: zod_1.z.enum(['vllm', 'ollama']).default('ollama'),
    AI_INFERENCE_BASE_URL: zod_1.z.string().optional(),
    AI_INFERENCE_API_KEY: zod_1.z.string().optional(),
    AI_MODEL_ID: zod_1.z.string().optional(),
    AI_JOB_TIMEOUT_MS: zod_1.z.coerce.number().int().min(1000).max(600000).default(180000),
    AI_WORKER_ENABLED: zod_1.z.preprocess((v) => {
        if (v === undefined || v === null || v === '')
            return false;
        if (typeof v === 'string')
            return v.toLowerCase() === 'true' || v === '1';
        return Boolean(v);
    }, zod_1.z.boolean()),
    AI_WORKER_INTERVAL_MS: zod_1.z.coerce.number().int().min(1000).max(600000).default(10000),
    REPORT_WORKER_ENABLED: zod_1.z.preprocess((v) => {
        if (v === undefined || v === null || v === '')
            return false;
        if (typeof v === 'string')
            return v.toLowerCase() === 'true' || v === '1';
        return Boolean(v);
    }, zod_1.z.boolean()),
    KAFKA_BROKERS: zod_1.z.string().default(''),
    OUTBOX_RELAY_ENABLED: boolEnv(true),
    WORKER_MODE: zod_1.z.enum(['api', 'worker', 'all']).default('all'),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    REDIS_KEY_PREFIX: zod_1.z.string().default('dq:'),
    AI_MODEL_PRIMARY: zod_1.z.string().default('qwen3-14b'),
    AI_MODEL_FAST: zod_1.z.string().default('qwen3-8b'),
    AI_MODEL_PATH: zod_1.z.string().default('/models'),
    AI_TIMEOUT_MS: zod_1.z.coerce.number().int().min(1000).max(600000).default(180000),
    AI_MAX_RETRIES: zod_1.z.coerce.number().int().min(0).max(5).default(2),
    AI_MAX_CONCURRENCY: zod_1.z.coerce.number().int().min(1).max(1).default(1),
    AI_MAX_EVIDENCE_PER_COLUMN: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    AI_MASK_PII_ENABLED: zod_1.z.preprocess((v) => {
        if (v === undefined || v === null || v === '')
            return true;
        if (typeof v === 'string')
            return v.toLowerCase() === 'true' || v === '1';
        return Boolean(v);
    }, zod_1.z.boolean()),
    AI_RAG_ENABLED: boolEnv(true),
    AI_RAG_TOP_K: zod_1.z.coerce.number().int().min(1).max(20).default(5),
    AI_RAG_MIN_TRUST_SCORE: zod_1.z.coerce.number().min(0).max(1).default(0.6),
    AI_RAM_GUARD_PERCENT: zod_1.z.coerce.number().int().min(1).max(100).default(85),
    AI_MIN_RAM_GB: zod_1.z.coerce.number().int().min(1).default(12),
    EMBEDDING_MODEL: zod_1.z.string().default('qwen3-embedding-0.6b'),
    EMBEDDING_DIM: zod_1.z.coerce.number().int().min(1).default(1024),
    SOCKET_ENABLED: boolEnv(true),
    SMTP_HOST: zod_1.z.string().optional(),
    SMTP_PORT: zod_1.z.coerce.number().default(587),
    SMTP_USER: zod_1.z.string().optional(),
    SMTP_PASS: zod_1.z.string().optional(),
    SMTP_FROM: zod_1.z.string().default('AI Data Quality Platform <noreply@data-quality.local>'),
    NTFY_ENABLED: boolEnv(false),
    NTFY_BASE_URL: zod_1.z.string().default('https://ntfy.sh'),
    NTFY_TOPIC: zod_1.z.string().optional(),
    NTFY_ACCESS_TOKEN: zod_1.z.string().optional(),
    NTFY_REQUEST_TIMEOUT_MS: zod_1.z.coerce.number().default(5000),
    ORGANIZATION_ID: zod_1.z.string().optional(),
    OWNER_EMAIL: zod_1.z.string().email().optional(),
    OWNER_PASSWORD: zod_1.z.string().min(6).optional(),
});
function validate(config) {
    const result = exports.EnvironmentSchema.safeParse(config);
    if (!result.success) {
        const errorMessages = result.error.errors
            .map((e) => `  - [${e.path.join('.')}] ${e.message}`)
            .join('\n');
        throw new Error(`\n[Config Validation Error] Sai cấu hình biến môi trường:\n${errorMessages}\n`);
    }
    return result.data;
}
//# sourceMappingURL=env.validation.js.map