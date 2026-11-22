import { AsyncLocalStorage } from 'async_hooks';
import type { ClientSession } from 'mongoose';

const storage = new AsyncLocalStorage<ClientSession>();

/**
 * Ngữ cảnh quản lý phiên giao dịch MongoDB ngầm (Ambient Transaction Session)
 * Cho phép Mongoose repositories tự động gia nhập vào transaction đang chạy mà không cần truyền biến session thủ công
 */
export const MongoSessionContext = {
  run<T>(session: ClientSession, fn: () => T): T {
    return storage.run(session, fn);
  },

  /** Trả về ClientSession đang hoạt động nếu nằm trong transaction, ngược lại undefined */
  current(): ClientSession | undefined {
    return storage.getStore();
  },
};

export function resolveMongoSession(
  session?: ClientSession
): ClientSession | undefined {
  return session ?? MongoSessionContext.current();
}
