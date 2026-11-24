/**
 * Test helper — phát hiện hạ tầng test tích hợp (MongoDB replica set, Redis, MinIO).
 *
 * ── Vì sao cần? ────────────────────────────────────────────────────────────
 * `MongooseTransactionService` thật cần MongoDB **replica set** (multi-document
 * transaction). Unit test dùng `fakeTransaction()` nên **không** chứng minh
 * được rollback thật. Test tích hợp (B2) cần hạ tầng thật.
 *
 * Hạ tầng được bật bằng:
 * ```bash
 * pnpm run test:infra:up      # mongo:7 rs0 @27018, redis @6380, minio @9002
 * ```
 *
 * ── Triết lý "skip có thể đọc" ─────────────────────────────────────────────
 * Nếu hạ tầng không sẵn sàng, test **không fail** (để CI chạy nhanh) mà
 * `describe.skip` + in cảnh báo rõ ràng ⇒ không bao giờ có trạng thái
 * "test xanh nhưng chưa từng chạy" mà không ai biết.
 */
import mongoose, { type Connection } from 'mongoose';
import * as nodeOs from 'os';

/**
 * Bộ chuyển đổi runtime cho driver `mongodb`.
 *
 * ── Vì sao cần? ────────────────────────────────────────────────────────────
 * Driver `mongodb@7` dựng `client metadata` (bắt buộc cho handshake) bằng
 * `await import('os')` — một **dynamic import**. Trong Jest (CommonJS VM
 * sandbox) dynamic import không có `--experimental-vm-modules` nên **fail**:
 *
 * ```
 * A dynamic import callback was invoked without --experimental-vm-modules
 * ```
 *
 * Hệ quả: `client metadata` rỗng `{}` ⇒ MongoDB từ chối handshake với
 * `Missing required sub-document 'driver' in the client metadata document`.
 *
 * Lưu ý: đây là **giới hạn của môi trường test**, KHÔNG phải lỗi ứng dụng —
 * chạy Node thật thì dynamic import hoạt động bình thường. Nên test helper
 * truyền `runtimeAdapters.os` tường minh để handshake thành công trong Jest.
 */
const RUNTIME_ADAPTERS = { os: nodeOs };

export const TEST_MONGO_URI =
  process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27018/?replicaSet=rs0';
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6380';
export const TEST_MINIO_ENDPOINT = process.env.TEST_MINIO_ENDPOINT ?? 'http://127.0.0.1:9002';
export const TEST_MINIO_BUCKET = process.env.TEST_MINIO_BUCKET ?? 'data-quality-storage';

/** Kết quả detect hạ tầng. */
export interface InfraStatus {
  mongo: boolean;
  mongoIsReplicaSet: boolean;
  redis: boolean;
  minio: boolean;
}

/** Timeout ngắn cho các lệnh kiểm tra kết nối. */
const PROBE_TIMEOUT_MS = 2500;

async function probe(
  fn: () => Promise<unknown>,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      (timer as unknown as { unref?: () => void }).unref?.();
    });
    await Promise.race([fn(), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Kiểm tra MongoDB có chạy **replica set** hay không.
 *
 * `hello` trả về `setName` khi node thuộc replica set ⇒ đủ đi mở
 * multi-document transaction.
 */
export async function probeMongo(): Promise<{ ok: boolean; isReplicaSet: boolean }> {
  // Tạo connection TRƯỚC, rồi await — để luôn đóng được khi connect fail
  // (nếu không, mongoose tiếp tục reconnect ở nền ⇒ jest không thoát).
  let conn: Connection | null = null;
  try {
    const pending = mongoose.createConnection(TEST_MONGO_URI, {
      serverSelectionTimeoutMS: PROBE_TIMEOUT_MS,
      connectTimeoutMS: PROBE_TIMEOUT_MS,
      runtimeAdapters: RUNTIME_ADAPTERS,
    });
    conn = pending;
    await pending.asPromise();
    const db = conn.db;
    if (!db) return { ok: false, isReplicaSet: false };
    const admin = db.admin();
    const hello = (await admin.command({ hello: 1 })) as { setName?: string };
    return {
      ok: true,
      isReplicaSet: typeof hello.setName === 'string' && hello.setName.length > 0,
    };
  } catch {
    return { ok: false, isReplicaSet: false };
  } finally {
    await conn?.close().catch(() => undefined);
  }
}

/** Kiểm tra Redis có phản hồi `PING` không. */
export async function probeRedis(): Promise<boolean> {
  return probe(async () => {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(TEST_REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (): null => null,
    });
    client.on('error', () => undefined);
    try {
      await client.connect();
      const pong = await client.ping();
      if (pong !== 'PONG') throw new Error('PING không trả về PONG');
    } finally {
      client.disconnect();
    }
  });
}

/** Kiểm tra MinIO (S3-compatible) có phản hồi `ListBuckets` không. */
export async function probeMinio(): Promise<boolean> {
  return probe(async () => {
    const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'auto',
      endpoint: TEST_MINIO_ENDPOINT,
      credentials: {
        accessKeyId: process.env.TEST_MINIO_ACCESS_KEY ?? 'testminio',
        secretAccessKey: process.env.TEST_MINIO_SECRET_KEY ?? 'testminio123',
      },
    });
    try {
      await client.send(new ListBucketsCommand({}));
    } finally {
      client.destroy();
    }
  }, 4000);
}

let cached: InfraStatus | null = null;

/** Detect hạ tầng (có cache để không probe lại nhiều lần trong 1 test run). */
export async function detectInfra(): Promise<InfraStatus> {
  if (cached) return cached;
  const mongo = await probeMongo();
  const [redis, minio] = await Promise.all([probeRedis(), probeMinio()]);
  cached = {
    mongo: mongo.ok,
    mongoIsReplicaSet: mongo.isReplicaSet,
    redis,
    minio,
  };
  return cached;
}

/**
 * `describe` có điều kiện: nếu hạ tầng không sẵn sàng thì **skip** kèm cảnh báo.
 *
 * @param label Tên nhóm test (hiển thị trong log).
 * @param check Hàm kiểm tra điều kiện (nhận `InfraStatus`).
 */
export function describeWithInfra(
  label: string,
  check: (status: InfraStatus) => boolean,
): void {
  const state = { ready: false, status: null as InfraStatus | null };

  beforeAll(async () => {
    state.status = await detectInfra();
    state.ready = check(state.status);
    if (!state.ready) {
      const s = state.status;
      console.warn(
        `\n[INTEGRATION] BỎ QUA "${label}" — hạ tầng test chưa sẵn sàng.\n` +
          `  MongoDB : ${s?.mongo ? 'OK' : 'KHÔNG kết nối được'} ` +
          `(replica set: ${s?.mongoIsReplicaSet ? 'có' : 'KHÔNG'})\n` +
          `  Redis   : ${s?.redis ? 'OK' : 'KHÔNG kết nối được'}\n` +
          `  MinIO   : ${s?.minio ? 'OK' : 'KHÔNG kết nối được'}\n` +
          `  → Chạy: pnpm run test:infra:up\n`,
      );
    }
  });

  const wrapped = state.ready ? describe : describe.skip;
  wrapped(label, () => {
    it('hạ tầng test sẵn sàng', () => {
      expect(state.ready).toBe(true);
    });
  });
}

/** Tên database riêng cho test tích hợp (tránh đụng dữ liệu dev). */
export const TEST_DB_NAME = process.env.TEST_MONGO_DB ?? 'dq_integration_test';

/** Reset toàn bộ collection trong database test. */
export async function clearTestDb(conn: Connection): Promise<void> {
  const db = conn.db;
  if (!db) return;
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    await db.collection(c.name).deleteMany({});
  }
}

/**
 * Mở connection Mongoose tới database test (replica set `rs0`).
 *
 * Dùng `dbName` riêng ⇒ không đụng dữ liệu dev/prod.
 */
export async function openTestConnection(): Promise<Connection> {
  const conn = mongoose.createConnection(TEST_MONGO_URI, {
    dbName: TEST_DB_NAME,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    runtimeAdapters: RUNTIME_ADAPTERS,
  });
  try {
    await conn.asPromise();
    return conn;
  } catch (err) {
    await conn.close().catch(() => undefined);
    throw err;
  }
}
