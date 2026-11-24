/**
 * Nhóm 1 — kiểm thử hạ tầng vận hành:
 *   1) Realtime multi-instance  : Socket.IO Redis adapter (REDIS_URL)
 *   2) Event bus               : Hybrid publisher (KAFKA_BROKERS) + in-process fallback
 *   3) PDF report              : worker sinh PDF (REPORT_WORKER_ENABLED) + builder
 *
 * Các test dùng hạ tầng thật khi có sẵn (Redis/Kafka), nếu không thì bỏ qua
 * (skip) — để chạy được trên CI không cài Redis.
 */
import { ConfigService } from '@nestjs/config';
import { InProcessEventPublisher } from '../../../src/shared/infrastructure/events/in-process-event.publisher';
import { HybridEventPublisher } from '../../../src/shared/infrastructure/events/hybrid-event.publisher';
import { KafkaEventPublisher } from '../../../src/shared/infrastructure/events/kafka-event.publisher';
import { useRedisAdapterIfConfigured, closeRedisIoAdapterClients } from '../../../src/shared/infrastructure/adapters/redis-io.adapter';
import { buildReportPdfAsync } from '../../../src/modules/analysis/application/pdf-builder.util';
import type { DomainEventEnvelope } from '../../../src/shared/application/ports/event-publisher.port';

const REDIS_URL = (process.env.REDIS_URL ?? '').trim();

/**
 * Redis dùng cho test — ưu tiên `REDIS_URL` của môi trường; nếu không có thì
 * tự spawn một `redis-server` riêng trên cổng tự do (không đụng hạ tầng
 * đang chạy, không cần password).
 */
let spawnedRedis: { proc: import('node:child_process').ChildProcess; url: string } | null = null;

async function waitRedis(url: string, timeoutMs = 8000): Promise<boolean> {
  const { default: Redis } = await import('ioredis');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      connectTimeout: 1500,
    });
    client.on('error', () => undefined);
    try {
      await client.connect();
      await client.ping();
      await client.quit();
      return true;
    } catch {
      // Phải disconnect nếu không được — client treo giữ event loop → jest không thoát.
      try {
        client.disconnect();
      } catch {
        /* bỏ qua */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return false;
}

async function ensureRedis(): Promise<string | null> {
  if (REDIS_URL && (await waitRedis(REDIS_URL, 2000))) return REDIS_URL;
  // Tự spawn redis-server trên cổng ngẫu nhiên.
  const port = 6400 + Math.floor(Math.random() * 400);
  const url = `redis://127.0.0.1:${port}`;
  try {
    const { spawn } = await import('node:child_process');
    const proc = spawn('redis-server', ['--port', String(port), '--save', '', '--appendonly', 'no'], {
      stdio: 'ignore',
    });
    proc.unref();
    spawnedRedis = { proc, url };
    if (await waitRedis(url)) return url;
  } catch {
    /* không có redis-server trên máy → bỏ qua test multi-instance */
  }
  return null;
}

describe('Nhóm 1 — Realtime multi-instance (Socket.IO Redis adapter)', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    closeRedisIoAdapterClients();
    try {
      spawnedRedis?.proc.kill('SIGTERM');
    } catch {
      /* bỏ qua */
    }
    spawnedRedis = null;
  });

  it('REDIS_URL trống → fallback memory, KHÔNG crash', async () => {
    delete process.env.REDIS_URL;
    const app = { useWebSocketAdapter: jest.fn(), getHttpServer: jest.fn() } as never;
    const mode = await useRedisAdapterIfConfigured(app);
    expect(mode).toBe('memory');
  });

  it('REDIS_URL không kết nối được → fallback memory, KHÔNG crash', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6399'; // cổng không có gì
    const app = { useWebSocketAdapter: jest.fn(), getHttpServer: jest.fn() } as never;
    const mode = await useRedisAdapterIfConfigured(app);
    expect(mode).toBe('memory');
  });

  it('REDIS_URL hợp lệ → gắn Socket.IO Redis adapter (multi-instance)', async () => {
    const url = await ensureRedis();
    if (!url) {
      console.warn('[skip] Không có Redis khả dụng — bỏ qua test multi-instance');
      return;
    }
    process.env.REDIS_URL = url;
    const useWebSocketAdapter = jest.fn();
    const enableShutdownHooks = jest.fn();
    const app = { useWebSocketAdapter, enableShutdownHooks, getHttpServer: jest.fn() } as never;
    const mode = await useRedisAdapterIfConfigured(app);
    expect(mode).toBe('redis');
    expect(useWebSocketAdapter).toHaveBeenCalledTimes(1);
    expect(enableShutdownHooks).toHaveBeenCalled();
  });
});

describe('Nhóm 1 — Event bus (Kafka + in-process fallback)', () => {
  const makeEnvelope = (): DomainEventEnvelope => ({
    eventId: 'evt-1',
    eventType: 'DATASET_INGESTED',
    aggregateType: 'DATASET',
    aggregateId: 'ds-1',
    occurredAt: new Date().toISOString(),
    payload: { dataset_id: 'ds-1' },
  });

  it('KAFKA_BROKERS trống → chế độ in-process', () => {
    const cfg = { get: jest.fn().mockReturnValue('') } as unknown as ConfigService;
    const local = new InProcessEventPublisher();
    const kafka = new KafkaEventPublisher(cfg);
    const hybrid = new HybridEventPublisher(cfg, local, kafka);
    expect(hybrid.mode).toBe('in-process');
  });

  it('KAFKA_BROKERS có giá trị → chế độ kafka', () => {
    const cfg = { get: jest.fn().mockReturnValue('localhost:9092') } as unknown as ConfigService;
    const local = new InProcessEventPublisher();
    const kafka = new KafkaEventPublisher(cfg);
    const hybrid = new HybridEventPublisher(cfg, local, kafka);
    expect(hybrid.mode).toBe('kafka');
  });

  it('in-process: publish gọi tới handler đã đăng ký', async () => {
    const local = new InProcessEventPublisher();
    const seen: DomainEventEnvelope[] = [];
    local.onEvent((e: DomainEventEnvelope) => {
      seen.push(e);
    });
    await local.publish(makeEnvelope());
    expect(seen).toHaveLength(1);
    expect(seen[0]?.eventType).toBe('DATASET_INGESTED');
  });

  it('in-process: handler lỗi KHÔNG làm sập publish', async () => {
    const local = new InProcessEventPublisher();
    local.onEvent(() => {
      throw new Error('boom');
    });
    const seen: DomainEventEnvelope[] = [];
    local.onEvent((e: DomainEventEnvelope) => {
      seen.push(e);
    });
    await expect(local.publish(makeEnvelope())).resolves.toBeUndefined();
    expect(seen).toHaveLength(1);
  });

  it('Kafka publisher không cấu hình broker → báo KAFKA_DISABLED (fallback do Hybrid lo)', async () => {
    const cfg = { get: jest.fn().mockReturnValue('') } as unknown as ConfigService;
    const kafka = new KafkaEventPublisher(cfg);
    await expect(kafka.publish(makeEnvelope())).rejects.toThrow('KAFKA_DISABLED');
    expect(kafka.isEnabled()).toBe(false);
  });

  it('Hybrid chọn đúng publisher theo KAFKA_BROKERS', async () => {
    const cfgEmpty = { get: jest.fn().mockReturnValue('') } as unknown as ConfigService;
    const local = new InProcessEventPublisher();
    const seen: DomainEventEnvelope[] = [];
    local.onEvent((e: DomainEventEnvelope) => {
      seen.push(e);
    });
    const hybridEmpty = new HybridEventPublisher(cfgEmpty, local, new KafkaEventPublisher(cfgEmpty));
    await hybridEmpty.publish(makeEnvelope());
    expect(seen).toHaveLength(1); // in-process đã xử lý event
  });
});

describe('Nhóm 1 — PDF report', () => {
  it('buildReportPdfAsync trả về Buffer PDF hợp lệ (magic header %PDF-)', async () => {
    const pdf = await buildReportPdfAsync({
      title: 'Tong ket chat luong du lieu',
      sections: [{ heading: 'Phan tich', lines: ['Dong 1', 'Dong 2'] }],
    });
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('PDF có nội dung dài hơn 0 byte', async () => {
    const pdf = await buildReportPdfAsync({ title: 'x', sections: [{ heading: 'a', lines: ['b'] }] });
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('PDF nhiều trang vẫn sinh hợp lệ', async () => {
    const pdf = await buildReportPdfAsync({
      title: 'Nhieu trang',
      sections: Array.from({ length: 120 }, (_, i) => ({
        heading: `Muc ${i}`,
        lines: ['dong du lieu'],
      })),
    });
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
