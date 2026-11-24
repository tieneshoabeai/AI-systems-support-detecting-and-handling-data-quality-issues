/**
 * SHARED — Port cho **giao dịch MongoDB** (multi-document transaction).
 *
 * Vì sao cần port:
 * Tầng `application` **không được** import `mongoose` (quy tắc CA2) và cũng
 * không nên import thẳng `MongooseTransactionService` (thuộc `infrastructure`).
 * → Hạ tầng thực thi nằm ở `shared/infrastructure/database/`, còn hợp đồng
 * tối giản nằm ở đây.
 *
 * Vì sao không truyền `session` rõ ràng:
 * `MongoSessionContext` (AsyncLocalStorage) đã tự động gia nhận session cho
 * **mọi** repository gọi `resolveMongoSession()`. Handler chỉ cần bọc khối lệnh
 * vào `runInTransaction()` — không phải rải `session` khắp nơi (dễ quên ⇒ mất
 * tính nguyên tử).
 *
 * Vì sao quan trọng (OPEN-09):
 * Ghi event/outbox **phải nằm trong cùng transaction** với thao tác chính ⇒
 * không bao giờ xảy ra tình huống "đã xoá dữ liệu nhưng event không được gửi"
 * (cascade xoá project/dataset bị đứt).
 */
export const TRANSACTION_PORT = Symbol('TransactionPort');

export interface TransactionPort {
  /**
   * Chạy `fn` trong một MongoDB transaction.
   *
   * - Thành công ⇒ commit.
   * - `fn` ném lỗi ⇒ rollback **toàn bộ** thay đổi trong transaction và
   *   lỗi được ném lại cho caller.
   */
  runInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
