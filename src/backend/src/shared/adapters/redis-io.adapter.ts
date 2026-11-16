import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';

const logger = new Logger('RedisIoAdapter');

/**
 * Gắn Socket.IO Redis adapter nếu cấu hình REDIS_URL và kết nối thành công.
 * - Hỗ trợ REDIS_PASSWORD riêng: nếu URL chưa có credentials thì tự chèn vào.
 * - Mọi lỗi (NOAUTH, ECONNREFUSED, timeout 5s) đều fallback về 'memory', KHÔNG crash app.
 * - Bắt buộc gắn error handler cho pub/sub để tránh "missing 'error' handler" làm sập Node.
 */
export async function useRedisAdapterIfConfigured(app: INestApplication): Promise<'redis' | 'memory'> {
  const rawUrl = (process.env.REDIS_URL ?? '').trim();
  if (!rawUrl) {
    logger.log('REDIS_URL trống — dùng realtime memory (single-instance)');
    return 'memory';
  }
  // Cho phép đặt mật khẩu qua REDIS_PASSWORD thay vì nhúng vào URL (tránh lộ secret trong log).
  let url = rawUrl;
  const pwd = (process.env.REDIS_PASSWORD ?? '').trim();
  if (pwd && !url.match(/:\/\/[^/]*@/)) {
    url = url.replace('://', `://:${encodeURIComponent(pwd)}@`);
  }
  let pub: { on(e: string, h: () => void): void; connect(): Promise<unknown>; ping(): Promise<unknown>; disconnect(): void } | null = null;
  let sub: { on(e: string, h: () => void): void; connect(): Promise<unknown>; disconnect(): void } | null = null;
  try {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const { default: Redis } = await import('ioredis');
    const opts = {
      maxRetriesPerRequest: null as null,
      lazyConnect: true,
      enableReadyCheck: true,
      // Thử lại tối đa 3 lần lúc khởi động, sau đó bỏ để fallback memory nhanh.
      retryStrategy: (times: number): number | null => (times > 3 ? null : Math.min(times * 200, 1000)),
    };
    const pubClient = new Redis(url, opts);
    const subClient = new Redis(url, opts);
    pub = pubClient;
    sub = subClient;
    // Chặn crash "missing error handler" — ioredis ném 'error' event bất đồng bộ.
    pubClient.on('error', () => undefined);
    subClient.on('error', () => undefined);
    // Timeout 5s: Redis lỗi/chậm thì fallback memory, không treo bootstrap.
    await Promise.race([
      (async (): Promise<void> => {
        await pubClient.connect();
        await subClient.connect();
        await pubClient.ping();
      })(),
      new Promise<never>((_, reject) => {
        const t = setTimeout(() => reject(new Error('Redis connect timeout 5s')), 5000);
        (t as unknown as { unref?: () => void }).unref?.();
      }),
    ]);
    app.useWebSocketAdapter(
      new (class extends IoAdapter {
        createIOServer(port: number, opts?: Record<string, unknown>) {
          const s = super.createIOServer(port, { ...(opts ?? {}) });
          (s as unknown as { adapter(a: unknown): void }).adapter(createAdapter(pubClient, subClient));
          return s;
        }
      })(app.getHttpServer()),
    );
    logger.log('Realtime adapter: redis (Socket.IO Redis adapter)');
    return 'redis';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Redis realtime không khả dụng (${msg}) — fallback về memory (single-instance). Kiểm tra REDIS_URL/REDIS_PASSWORD.`);
    try {
      (pub as unknown as { disconnect(): void } | null)?.disconnect();
    } catch { /* bỏ qua */ }
    try {
      (sub as unknown as { disconnect(): void } | null)?.disconnect();
    } catch { /* bỏ qua */ }
    return 'memory';
  }
}
