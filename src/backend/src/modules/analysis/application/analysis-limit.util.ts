import { PayloadTooLargeError } from '../../../shared/domain/errors';

/**
 * GĐ0 — Chống quá tải máy khi phân tích AI.
 *
 * **Vấn đề gốc.**
 * `RecordQueryPort.listAllRecords()` thực hiện truy vấn Mongo không giới hạn:
 * `.find({ dataset_id }).sort({ row_index: 1 }).lean().exec()` rồi deserialize
 * toàn bộ BSON về object JS. Với dataset lớn, chuỗi biến đổi trong bộ nhớ
 * (BSON → object → mảng `rows` → `rowWrappers`) tạo **peak-RAM vài GB**, đủ để
 * OOM hoặc khiến CPU nóng lên tới mức quá nhiệt (thermal throttling).
 *
 * **Chiến lược hai lớp.**
 *   1. *Chặn sớm theo số dòng* (`ANALYSIS_MAX_ROWS`) — kiểm tra **trước khi**
 *      đọc bất kỳ record nào từ MongoDB. Rẻ, xác định, trả lỗi rõ ràng.
 *   2. *Chặn lúc chạy theo RAM thực* (`SystemResourceGuardAdapter` đọc
 *      `/proc/meminfo`) — phủ trường hợp nhiều job chạy song song hoặc
 *      tài nguyên bị chiếm bởi tiến trình khác.
 *
 * Lớp 1 là lớp này; lớp 2 đã có sẵn trong `application/services/ai-worker.service.ts`.
 *
 * **Vì sao ném lỗi nghiệp vụ chứ không phải `HttpException`?**
 * Handler nằm ở tầng `application` — không được biết HTTP (xem
 * `shared/domain/errors/domain-error.ts`). Việc ánh xạ `ANALYSIS_TOO_LARGE`
 * → HTTP 413 do `shared/interfaces/errors/error-http-mapping.ts` đảm nhiệm.
 */

/** Ngưỡng mặc định khi `ANALYSIS_MAX_ROWS` chưa được cấu hình. */
export const DEFAULT_ANALYSIS_MAX_ROWS = 100_000;

/**
 * Đọc ngưỡng tối đa số dòng cho phép phân tích đồng bộ.
 *
 * @param configured Giá trị thô từ cấu hình (có thể là string/number/undefined).
 * @returns Ngưỡng hợp lệ (> 0). Trả về mặc định khi cấu hình sai lệch.
 */
export function resolveAnalysisMaxRows(configured: unknown): number {
  const n = Number(configured);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ANALYSIS_MAX_ROWS;
  return Math.floor(n);
}

/**
 * Kiểm tra số dòng dataset có vượt ngưỡng an toàn hay không.
 *
 * @param rowCount Số dòng của dataset (từ `dataset.rowCount`).
 * @param maxRows Ngưỡng tối đa (đã resolve qua {@link resolveAnalysisMaxRows}).
 * @throws {PayloadTooLargeError} Khi `rowCount > maxRows`.
 */
export function assertAnalysisRowLimit(rowCount: number, maxRows: number): void {
  if (!Number.isFinite(rowCount) || rowCount <= maxRows) return;
  throw new PayloadTooLargeError(
    `Dataset có ${rowCount.toLocaleString('vi-VN')} dòng, vượt giới hạn phân tích đồng bộ ${maxRows.toLocaleString('vi-VN')} dòng. ` +
      'Hãy tách nhỏ dataset hoặc dùng luồng phân tích bất đồng bộ.',
    { rowCount, maxRows },
  );
}
