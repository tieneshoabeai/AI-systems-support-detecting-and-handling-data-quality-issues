/**
 * Phân loại lỗi của benchmark.
 *
 * Tách riêng khỏi `run-models.ts` để **không import được** file runner
 * (runner tự gọi `main()` ở module level ⇒ import sẽ kích hoạt cả benchmark).
 */

/**
 * Phân biệt lỗi HẠ TẦNG (OOM / engine chết) với lỗi của model.
 *
 * Engine bị OOM-killer giết ⇒ socket đóng đột ngột (`socket hang up` /
 * `ECONNRESET`). Đây **không phải** lỗi model ⇒ không tính vào `failure_rate`.
 *
 * Thực tế: pilot M3 (`qwen3:8b`) trên máy dev bị `oom-kill: task=ollama`
 * ⇒ nếu tính vào `failure_rate` thì model bị phạt oan 33% lỗi.
 */
export function isInfraError(message: string): boolean {
  return /socket hang up|ECONNRESET|EPIPE|OOM|out of memory|cannot allocate|ENOMEM/i.test(
    message,
  );
}
