import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';

const logger = new Logger('RedisIoAdapter');

/**
 * Client Redis đang mở của Socket.IO adapter — giữ tham chiếu để có thể đóng
 * tường minh (shutdown, test teardown). ioredis giữ socket mở nên nếu không
 * disconnect thì tiến trình Node không thoát sạch (jest bị treo sau khi test).
 */
const activeClients = new Set<{ disconnect(): void }>();

/**
 * Đóng toàn bộ client Redis của realtime adapter.
 * An toàn khi gọi nhiều lần. Dùng trong `onApplicationShutdown` và test teardown.
 */
export function closeRedisIoAdapterClients(): void {
  for (const client of activeClients) {
    try {
      client.disconnect();
    } catch {
      /* bỏ qua */
    }
  }
  activeClients.clear();
}

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
    activeClients.add(pubClient);
    activeClients.add(subClient);
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
        override createIOServer(port: number, opts?: Record<string, unknown>): unknown {
          const s: unknown = super.createIOServer(port, { ...(opts ?? {}) });
          const socketIoServer = s as { adapter?: (a: unknown) => void };
          // `key` = tiền tố cho kênh pub/sub của adapter. Mặc định là
          // `socket.io` ⇒ nhiều môi trường dùng chung một Redis sẽ **đụng
          // nhau** (event của app A lọt sang app B). Dùng `REDIS_KEY_PREFIX`
          // (mặc định `dq:`) để cô lập theo môi trường.
          const prefix = (process.env.REDIS_KEY_PREFIX ?? 'dq:').trim() || 'dq:';
          socketIoServer.adapter?.(createAdapter(pubClient, subClient, { key: `${prefix}socket.io` }));
          return s;
        }
      })(app.getHttpServer() as never),
    );
    logger.log('Realtime adapter: redis (Socket.IO Redis adapter)');
    // Đóng kết nối Redis khi app shutdown — nếu không, ioredis giữ socket mở
    // và tiến trình không thoát sạch (rò rỉ khi restart / rolling deploy).
    const shutdown = (): void => {
      closeRedisIoAdapterClients();
    };
    // `enableShutdownHooks` có thể không có trên app giả (unit test) → gọi có điều kiện.
    if (typeof (app as { enableShutdownHooks?: () => void }).enableShutdownHooks === 'function') {
      app.enableShutdownHooks();
    }
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
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
    if (pub) activeClients.delete(pub);
    if (sub) activeClients.delete(sub);
    return 'memory';
  }
}
