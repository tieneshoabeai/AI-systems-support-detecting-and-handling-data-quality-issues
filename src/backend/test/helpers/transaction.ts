/**
 * Test helper — **TransactionPort giả** cho unit test.
 *
 * `MongooseTransactionService` thật cần MongoDB replica set ⇒ không dùng được
 * trong unit test. Helper này cung cấp một port "noop transaction":
 * - `runInTransaction(fn)` → chạy `fn` trực tiếp (không rollback).
 * - `fakeTransactionWithRollback` → chạy `fn` và **ném lại** lỗi, mô phỏng
 *   hành vi rollback của MongoDB (dùng để assert "lỗi ghi outbox ⇒ thao tác
 *   chính bị huỷ").
 */
import type { TransactionPort } from '../../src/shared/application/ports/transaction.port';

export const fakeTransaction = (): TransactionPort => ({
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  },
});

/**
 * Transaction giả **mô phỏng rollback**: đánh dấu `committed = false` khi `fn`
 * ném lỗi — dùng để kiểm tra logic "strict outbox" của OPEN-09.
 */
export const fakeTransactionWithRollback = (
  committed: { value: boolean }
): TransactionPort => ({
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      committed.value = true;
      return result;
    } catch (err) {
      committed.value = false;
      throw err;
    }
  },
});
