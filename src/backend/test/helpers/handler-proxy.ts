/**
 * Helper cho unit test — proxy tới các handler (Command/Query pattern).
 *
 * Sau khi tách service thành các handler độc lập, test không thể inject
 * `XxxService` nữa. File này cung cấp:
 *   - `createHandlerProxy(moduleRef, handlers)`: trả về object có cùng API với
 *     service cũ (mỗi method gọi `handler.execute(...)`), giữ logic test nguyên vẹn.
 *   - `ProxyOf<T>`: suy luận type của proxy từ map handler, nên test vẫn được
 *     type-check đầy đủ (không cần `any`).
 */
import type { TestingModule } from '@nestjs/testing';

/** Bất kỳ class handler nào: có method `execute(...)`. */
export type HandlerClass = new (...args: never[]) => {
  execute: (...args: never[]) => unknown;
};

/** Suy luận type của proxy từ map `{ methodName: HandlerClass }`. */
export type ProxyOf<T extends Record<string, HandlerClass>> = {
  [K in keyof T]: T[K] extends new (...args: never[]) => {
    execute: (...args: infer A) => infer R;
  }
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

/**
 * Tạo proxy: mỗi key là tên method (đúng như service cũ), giá trị là hàm
 * gọi `handler.execute(...)` — resolve handler lazily để chỉ instantiate
 * những handler thực sự được dùng.
 */
export function createHandlerProxy<T extends Record<string, HandlerClass>>(
  moduleRef: TestingModule,
  handlers: T,
): ProxyOf<T> {
  const proxy: Record<string, unknown> = {};
  for (const [method, cls] of Object.entries(handlers)) {
    proxy[method] = (...args: never[]) => {
      const instance = moduleRef.get(cls, { strict: false });
      return (instance as { execute: (...a: never[]) => unknown }).execute(...args);
    };
  }
  return proxy as ProxyOf<T>;
}
