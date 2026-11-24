import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ClientSession } from 'mongoose';
import { MongoSessionContext } from './mongo-session-context';
import type { TransactionPort } from '../../application/ports/transaction.port';

/**
 * MongooseTransactionService — Bọc MongoDB multi-document transaction.
 *
 * **OPEN-09 (Conflict #4):** thao tác ghi chính (xoá mềm, cập nhật) và việc
 * ghi event/outbox phải **cùng thành công hoặc cùng rollback** — không bao
 * giờ để trạng thái "đã xoá nhưng event mất".
 *
 * Cơ chế: `MongoSessionContext.run(session, fn)` — mọi repository gọi
 * `resolveMongoSession()` sẽ tự động dùng session này ⇒ không cần truyền
 * `session` thủ công xuyên suốt chuỗi hàm.
 *
 * ⚠️ **Yêu cầu hạ tầng:** MongoDB phải chạy ở chế độ **replica set** (hoặc
 * `mongos`) mới hỗ trợ multi-document transaction. `.env.example` dùng
 * `mongodb+srv://...` (Atlas) ⇒ hỗ trợ ✔. Nếu chạy MongoDB standalone cục
 * bộ ⇒ `withTransaction` sẽ lỗi ⇒ mọi thao tác bọc transaction sẽ fail.
 */
@Injectable()
export class MongooseTransactionService implements TransactionPort {
  constructor(
    @InjectConnection() private readonly connection: Connection
  ) {}

  /**
   * Thực thi một khối nghiệp vụ trong MongoDB Multi-document Transaction an toàn.
   *
   * Tự động khởi tạo session, mở transaction, commit khi thành công và
   * rollback khi gặp lỗi. Lỗi được **ném lại** cho caller ⇒ caller quyết
   * định có báo lỗi cho người dùng hay không (OPEN-09 — strict).
   */
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await this.runOnce(session, fn);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Biến thể **có** tham số `session` — dành cho code thấp hơn (adapter,
   * repository) cần truyền session tường minh.
   */
  async runInTransactionWithSession<T>(
    fn: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await this.runOnce(session, fn);
    } finally {
      await session.endSession();
    }
  }

  private async runOnce<T>(
    session: ClientSession,
    fn: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    let result: T | undefined;
    let executed = false;

    await session.withTransaction(async () => {
      executed = false;
      result = await MongoSessionContext.run(session, () => fn(session));
      executed = true;
    });

    if (!executed) {
      throw new Error('Giao dịch hoàn tất nhưng callback không được thực thi thành công');
    }

    return result as T;
  }
}
