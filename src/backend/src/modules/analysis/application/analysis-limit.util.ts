import { PayloadTooLargeError, RateLimitExceededError } from '../../../shared/domain/errors';

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

/**
 * Ngưỡng mặc định khi `ANALYSIS_MAX_ROWS` chưa được cấu hình.
 *
 * **GĐ11 — hạ từ 100.000 → 50.000.** Số đo thực tế trên dataset 100.000 dòng
 * thật (xem `docs/restructures/21_cardinality_guard_gd8_gd9.md`): peak RSS chỉ
 * **568 MB**, thời gian 7,33 giây. Với ngân sách RAM an toàn của máy 16 GB và
 * nhiều job AI chạy song song, 50.000 dòng là mức **an toàn hơn** mà vẫn bao
 * phủ được phần lớn dataset thực tế. Ngưỡng vẫn **cấu hình được** qua
 * `ANALYSIS_MAX_ROWS` — đây chỉ là mặc định.
 */
export const DEFAULT_ANALYSIS_MAX_ROWS = 50_000;

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

/**
 * GĐ12 — Số phân tích đồng thời tối đa trong một tiến trình.
 *
 * **Vấn đề gốc (đo được bằng k6, `docs/test-reports/perf-2026-11-19.md`).**
 * `POST /projects/:id/analysis` xử lý **đồng bộ** trong request handler: đọc
 * toàn bộ dataset, tính DQ/tương quan/VIF, ghi kết quả. Với dataset 100.000
 * dòng, một lần chạy mất **~6,4 s** và **chặn event loop** của Node trong
 * suốt thời gian đó.
 *
 * Hệ quả đo được: khi 10 VU gọi phân tích đồng thời, p95 của **các endpoint
 * khác** (`GET /datasets/:id/records`) nhảy từ **21 ms → 3,23 s** (~150×), vì
 * mọi request của cùng instance phải xếp hàng sau lần phân tích đang chạy.
 *
 * **Vì sao không tách sang worker (bất đồng bộ)?**
 * Đó là hướng đúng về kiến trúc nhưng **đổi hợp đồng API** (`200/201` → `202`).
 * Trong lúc chờ chốt hợp đồng, ta dùng lớp trung gian:
 *   - Giới hạn **số phân tích chạy đồng thời** (mặc định 1).
 *   - Khi đã đủ số phân tích đang chạy → trả `429` kèm `Retry-After`.
 *
 * Như vậy: (a) event loop không bị chặn bởi N lần phân tích xếp hàng,
 * (b) **hợp đồng API không đổi**, (c) người dùng biết chính xác khi nào thử lại.
 *
 * Cấu hình: `ANALYSIS_MAX_CONCURRENCY` (mặc định 1, tối đa 8).
 */
export const DEFAULT_ANALYSIS_MAX_CONCURRENCY = 1;

/** Ngưỡng cứng — trên mức này thì semaphore không còn ý nghĩa (hàng đợi vô hạn). */
export const MAX_ANALYSIS_CONCURRENCY_CEILING = 8;

/**
 * Đọc số phân tích đồng thời tối đa từ cấu hình.
 *
 * @param configured Giá trị thô từ cấu hình (có thể là string/number/undefined).
 * @returns Số slot (≥ 1, ≤ {@link MAX_ANALYSIS_CONCURRENCY_CEILING}).
 */
export function resolveAnalysisMaxConcurrency(configured: unknown): number {
  const n = Number(configured);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_ANALYSIS_MAX_CONCURRENCY;
  return Math.min(Math.floor(n), MAX_ANALYSIS_CONCURRENCY_CEILING);
}

/**
 * Semaphore đếm số phân tích đồng thời của **một tiến trình**.
 *
 * Dùng cho `POST /projects/:id/analysis` (đồng bộ). Mỗi instance có semaphore
 * riêng → khi chạy nhiều instance (Kubernetes/SaaS) thì tổng số phân tích
 * đồng thời = `số instance × ANALYSIS_MAX_CONCURRENCY`.
 *
 * **Không dùng cho AI job / report job** — hai loại đó đã chạy ở worker riêng
 * (`AiWorkerService`, `ReportWorkerService`) với cơ chế hàng đợi của hệ thống.
 */
export class AnalysisConcurrencyGuard {
  private running = 0;

  constructor(private readonly maxConcurrency: number) {}

  /** Số phân tích đang chạy tại thời điểm hiện tại. */
  get activeCount(): number {
    return this.running;
  }

  /** Số slot tối đa. */
  get limit(): number {
    return this.maxConcurrency;
  }

  /**
   * Thử chiếm một slot. Trả `true` nếu thành công.
   *
   * Dùng `tryAcquire` (không chờ) vì chờ sẽ **vẫn** chặn event loop — chờ
   * trong request đồng bộ chính là vấn đề ta đang giải quyết.
   */
  tryAcquire(): boolean {
    if (this.running >= this.maxConcurrency) return false;
    this.running++;
    return true;
  }

  /** Trả slot về. */
  release(): void {
    if (this.running > 0) this.running--;
  }

  /**
   * Bọc một tác vụ trong slot.
   *
   * @param task Tác vụ cần chạy.
   * @param retryAfterSeconds Số giây client nên chờ trước khi thử lại.
   * @throws {RateLimitExceededError} Khi đã đủ số phân tích đang chạy.
   */
  async run<T>(task: () => Promise<T>, retryAfterSeconds = 5): Promise<T> {
    if (!this.tryAcquire()) {
      throw new RateLimitExceededError(
        `Hệ thống đang xử lý ${this.maxConcurrency} phân tích đồng bộ. ` +
          'Vui lòng thử lại sau ít phút.',
        { maxConcurrency: this.maxConcurrency, activeCount: this.running, retryAfterSeconds },
      );
    }
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}
