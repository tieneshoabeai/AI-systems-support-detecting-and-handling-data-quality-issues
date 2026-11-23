/**
 * Helper cho unit test — proxy tới handler (Command/Query pattern)
 * HOẶC service gộp (Template Simple, ADR-0002).
 *
 * - Handler: mỗi key gọi `handler.execute(...)`.
 * - Service Simple (vd OverviewService/AuditService): mỗi key gọi
 *   `service.<method>(...)` — giữ logic test nguyên vẹn khi flatten.
 */
import type { TestingModule } from '@nestjs/testing';

/** Bất kỳ class nào (handler có `execute` hoặc service Simple có method cùng tên key). */
export type HandlerClass = abstract new (...args: never[]) => unknown;

/** Suy luận type của proxy từ map `{ methodName: HandlerClass }`. */
export type ProxyOf<T extends Record<string, HandlerClass>> = {
  [K in keyof T]: T[K] extends abstract new (...args: never[]) => {
    execute: (...args: infer A) => infer R;
  }
    ? (...args: A) => Promise<Awaited<R>>
    : (...args: unknown[]) => Promise<unknown>;
};

/**
 * Tạo proxy: mỗi key là tên method; resolve lazily để chỉ instantiate
 * những class thực sự được dùng. Ưu tiên `service[method]` (Simple),
 * fallback `handler.execute(...)` (Hexagonal).
 */
export function createHandlerProxy<T extends Record<string, HandlerClass>>(
  moduleRef: TestingModule,
  handlers: T,
): ProxyOf<T> {
  const proxy: Record<string, unknown> = {};
  for (const [method, cls] of Object.entries(handlers)) {
    proxy[method] = (...args: never[]) => {
      const instance = moduleRef.get(cls, { strict: false }) as {
        execute?: (...a: never[]) => unknown;
        [k: string]: unknown;
      };
      const direct = instance[method];
      if (typeof direct === 'function') {
        return (direct as (...a: never[]) => unknown).apply(instance, args);
      }
      if (typeof instance.execute === 'function') {
        return instance.execute(...args);
      }
      throw new Error(`Proxy: ${String((cls as { name?: string }).name ?? cls)} thieu method '${method}' va execute()`);
    };
  }
  return proxy as ProxyOf<T>;
}
