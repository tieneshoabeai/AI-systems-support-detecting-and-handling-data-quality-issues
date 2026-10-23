import { z } from 'zod';

// Helper chuyển đổi biến môi trường chuỗi sang boolean an toàn
const boolEnv = (defaultValue = false) =>
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

  // MongoDB Atlas
  MONGODB_URI: z.string().min(1, 'MONGODB_URI không được để trống'),

  // Neo4j AuraDB
  NEO4J_URI: z.string().min(1, 'NEO4J_URI không được để trống'),
  NEO4J_USERNAME: z.string().min(1, 'NEO4J_USERNAME không được để trống'),
  NEO4J_PASSWORD: z.string().min(1, 'NEO4J_PASSWORD không được để trống'),
  NEO4J_DATABASE: z.string().default('neo4j'),

  // Cloudflare R2 / S3 Storage (Optional for Local Fallback)
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().default('data-quality-storage'),
  S3_REGION: z.string().default('auto'),
  STORAGE_MAX_QUOTA_BYTES: z.coerce.number().default(10 * 1024 * 1024 * 1024), // 10 GB
  STORAGE_WARN_THRESHOLD_RATIO: z.coerce.number().min(0).max(1).default(0.9), // Cảnh báo khi đạt 90%

  // JWT & Cryptography
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET phải có tối thiểu 16 ký tự'),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET phải có tối thiểu 16 ký tự'),
  JWT_REFRESH_EXPIRATION: z.string().default('7d'),
  SALT_ROUNDS: z.coerce.number().default(12),
  DATA_ENCRYPTION_KEY: z.string().optional(),

  // Google Gemini API
  GEMINI_API_KEY: z.string().optional(),

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
