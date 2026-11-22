/**
 * B2.5 — Test tích hợp hạ tầng phụ: **Redis** và **MinIO** thật.
 *
 * ── Vì sao cần? ────────────────────────────────────────────────────────────
 * `RedisIoAdapter` và `StorageService` có đường **fallback** (memory / local
 * filesystem). Nhờ đó unit test luôn xanh ⇒ che mất hỏng hạ tầng thật.
 * Test này chứng minh adapter thật hoạt động đúng khi có hạ tầng:
 *
 *   1. Redis: `PING` thành công, `SET/GET` hoạt động, adapter gắn được.
 *   2. MinIO: tạo bucket, upload file, đọc lại, xóa — qua `StorageService`
 *      (chế độ CLOUD, tức là **không** dùng fallback filesystem).
 *
 * Yêu cầu hạ tầng:
 * ```bash
 * pnpm run test:infra:up   # redis @6380, minio @9002
 * ```
 */
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { StorageService } from '../../src/shared/infrastructure/storage/storage.service';
import {
  closeRedisIoAdapterClients,
  useRedisAdapterIfConfigured,
} from '../../src/shared/infrastructure/adapters/redis-io.adapter';
import {
  TEST_MINIO_BUCKET,
  TEST_MINIO_ENDPOINT,
  TEST_REDIS_URL,
  detectInfra,
  probeMinio,
  probeRedis,
} from '../helpers/test-infra';

describe('B2.5 — Redis thật', () => {
  let redisOk = false;

  beforeAll(async () => {
    const infra = await detectInfra();
    redisOk = infra.redis;
    if (!redisOk) {
      throw new Error(
        '[B2.5] Thiếu hạ tầng test: Redis chưa sẵn sàng. ' +
          'Chạy `pnpm run test:infra:up` trước khi chạy test tích hợp.',
      );
    }
  });

  it('PING trả về PONG', async () => {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(TEST_REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    client.on('error', () => undefined);
    try {
      await client.connect();
      await expect(client.ping()).resolves.toBe('PONG');
    } finally {
      client.disconnect();
    }
  });

  it('SET / GET / DEL hoạt động như mong đợi', async () => {
    const { default: Redis } = await import('ioredis');
    const client = new Redis(TEST_REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    client.on('error', () => undefined);
    try {
      await client.connect();
      const key = `dq:test:${Date.now()}`;
      await expect(client.set(key, 'xin-chao')).resolves.toBe('OK');
      await expect(client.get(key)).resolves.toBe('xin-chao');
      await expect(client.del(key)).resolves.toBe(1);
      await expect(client.get(key)).resolves.toBeNull();
    } finally {
      client.disconnect();
    }
  });

  it('probeRedis() xác nhận hạ tầng sẵn sàng', async () => {
    await expect(probeRedis()).resolves.toBe(true);
  });

  it('useRedisAdapterIfConfigured() gắn được Socket.IO Redis adapter khi Redis thật', async () => {
    const originalUrl = process.env.REDIS_URL;
    const originalPassword = process.env.REDIS_PASSWORD;
    process.env.REDIS_URL = TEST_REDIS_URL;
    // Xoá mật khẩu để không ghép sai credential vào URL của test.
    delete process.env.REDIS_PASSWORD;

    const app = {
      useWebSocketAdapter: jest.fn(),
      getHttpServer: jest.fn(() => ({}) as never),
      enableShutdownHooks: jest.fn(),
    } as unknown as INestApplication;

    try {
      const mode = await useRedisAdapterIfConfigured(app);
      expect(mode).toBe('redis');
      expect(app.useWebSocketAdapter).toHaveBeenCalledTimes(1);
    } finally {
      closeRedisIoAdapterClients();
      if (originalUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = originalUrl;
      if (originalPassword === undefined) delete process.env.REDIS_PASSWORD;
      else process.env.REDIS_PASSWORD = originalPassword;
    }
  }, 20000);

  it('useRedisAdapterIfConfigured() fallback về memory khi REDIS_URL trống', async () => {
    const originalUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;

    const app = {
      useWebSocketAdapter: jest.fn(),
      getHttpServer: jest.fn(() => ({}) as never),
      enableShutdownHooks: jest.fn(),
    } as unknown as INestApplication;

    try {
      const mode = await useRedisAdapterIfConfigured(app);
      expect(mode).toBe('memory');
      expect(app.useWebSocketAdapter).not.toHaveBeenCalled();
    } finally {
      if (originalUrl === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = originalUrl;
    }
  });
});

describe('B2.5 — MinIO thật (StorageService chế độ CLOUD)', () => {
  beforeAll(async () => {
    const infra = await detectInfra();
    if (!infra.minio) {
      throw new Error(
        '[B2.5] Thiếu hạ tầng test: MinIO chưa sẵn sàng. ' +
          'Chạy `pnpm run test:infra:up` trước khi chạy test tích hợp.',
      );
    }
  });

  it('StorageService chuyển sang CLOUD MODE khi có endpoint + credentials', () => {
    const config = {
      get: (key: string, def?: unknown): unknown => {
        const map: Record<string, unknown> = {
          S3_ENDPOINT: TEST_MINIO_ENDPOINT,
          S3_ACCESS_KEY_ID: 'testminio',
          S3_SECRET_ACCESS_KEY: 'testminio123',
          S3_BUCKET_NAME: TEST_MINIO_BUCKET,
          S3_REGION: 'auto',
        };
        return map[key] ?? def;
      },
    } as unknown as ConfigService;

    const svc = new StorageService(config);
    expect(svc.getCloudStatus().isCloudMode).toBe(true);
  });

  it('upload → download → delete trên MinIO thật', async () => {
    const config = {
      get: (key: string, def?: unknown): unknown => {
        const map: Record<string, unknown> = {
          S3_ENDPOINT: TEST_MINIO_ENDPOINT,
          S3_ACCESS_KEY_ID: 'testminio',
          S3_SECRET_ACCESS_KEY: 'testminio123',
          S3_BUCKET_NAME: TEST_MINIO_BUCKET,
          S3_REGION: 'auto',
        };
        return map[key] ?? def;
      },
    } as unknown as ConfigService;

    const svc = new StorageService(config);

    // Bảo đảm bucket tồn tại (tạo nếu chưa có).
    const { S3Client, CreateBucketCommand, HeadBucketCommand } = await import(
      '@aws-sdk/client-s3'
    );
    const client = new S3Client({
      region: 'auto',
      endpoint: TEST_MINIO_ENDPOINT,
      credentials: { accessKeyId: 'testminio', secretAccessKey: 'testminio123' },
    });
    try {
      await client.send(new HeadBucketCommand({ Bucket: TEST_MINIO_BUCKET })).catch(async () => {
        await client.send(new CreateBucketCommand({ Bucket: TEST_MINIO_BUCKET }));
      });
    } finally {
      client.destroy();
    }

    const key = `test/b2-${Date.now()}.csv`;
    const content = 'a,b\n1,2\n';

    const uploaded = await svc.uploadStream(key, Readable.from([Buffer.from(content)]), 'text/csv');
    expect(uploaded).toBe(key);
    await expect(svc.fileExists(key)).resolves.toBe(true);

    const stream = await svc.downloadStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
    expect(Buffer.concat(chunks).toString('utf8')).toBe(content);

    await expect(svc.deleteFile(key)).resolves.toBe(true);
    await expect(svc.fileExists(key)).resolves.toBe(false);
  }, 30000);

  it('probeMinio() xác nhận hạ tầng sẵn sàng', async () => {
    await expect(probeMinio()).resolves.toBe(true);
  });
});

describe('B2.5 — cấu hình hạ tầng', () => {
  it('URL test trỏ tới cổng của docker-compose.test.yml', () => {
    expect(TEST_REDIS_URL).toContain('6380');
    expect(TEST_MINIO_ENDPOINT).toContain('9002');
  });
});
