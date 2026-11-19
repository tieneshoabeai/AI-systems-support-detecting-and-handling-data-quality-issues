/**
 * GĐ12 — Semaphore giới hạn số phân tích **đồng bộ** chạy cùng lúc.
 *
 * **Bối cảnh (đo được bằng k6 — `docs/test-reports/perf-2026-11-19.md`).**
 * `POST /projects/:id/analysis` xử lý inline trong request handler → mỗi lần
 * chặn event loop ~6,4 s với dataset 100.000 dòng. Khi 10 VU gọi đồng thời,
 * p95 của `GET /datasets/:id/records` nhảy từ **21 ms → 3,23 s** (~150×).
 *
 * Semaphore giải quyết phần "xếp hàng": chỉ cho N phân tích chạy cùng lúc,
 * phần còn lại nhận `429` kèm `Retry-After` — **không đổi hợp đồng API**.
 */
import {
  AnalysisConcurrencyGuard,
  DEFAULT_ANALYSIS_MAX_CONCURRENCY,
  MAX_ANALYSIS_CONCURRENCY_CEILING,
  resolveAnalysisMaxConcurrency,
} from '../src/modules/analysis/application/analysis-limit.util';
import { ERROR_CODES } from '../src/shared/domain/errors/error-codes';

// ── resolveAnalysisMaxConcurrency ───────────────────────────────────────────

describe('GĐ12 — resolveAnalysisMaxConcurrency', () => {
  it('mặc định = 1 (chặn hàng đợi)', () => {
    expect(resolveAnalysisMaxConcurrency(undefined)).toBe(DEFAULT_ANALYSIS_MAX_CONCURRENCY);
    expect(resolveAnalysisMaxConcurrency(undefined)).toBe(1);
  });

  it('đọc được từ chuỗi số (env luôn là string)', () => {
    expect(resolveAnalysisMaxConcurrency('3')).toBe(3);
    expect(resolveAnalysisMaxConcurrency(2)).toBe(2);
  });

  it('giá trị sai (< 1, NaN, rỗng) → mặc định', () => {
    expect(resolveAnalysisMaxConcurrency(0)).toBe(1);
    expect(resolveAnalysisMaxConcurrency(-5)).toBe(1);
    expect(resolveAnalysisMaxConcurrency('abc')).toBe(1);
    expect(resolveAnalysisMaxConcurrency(null)).toBe(1);
  });

  it('chặn trần cứng (hàng đợi vô hạn vô nghĩa)', () => {
    expect(resolveAnalysisMaxConcurrency(999)).toBe(MAX_ANALYSIS_CONCURRENCY_CEILING);
    expect(resolveAnalysisMaxConcurrency(8)).toBe(8);
  });
});

// ── AnalysisConcurrencyGuard ────────────────────────────────────────────────

describe('GĐ12 — AnalysisConcurrencyGuard', () => {
  it('cho qua khi còn slot', async () => {
    const guard = new AnalysisConcurrencyGuard(2);
    await expect(guard.run(async () => 'ok')).resolves.toBe('ok');
    expect(guard.activeCount).toBe(0);
  });

  it('giữ slot suốt thời gian task chạy', async () => {
    const guard = new AnalysisConcurrencyGuard(1);
    let activeInside = 0;
    await guard.run(async () => {
      activeInside = guard.activeCount;
    });
    expect(activeInside).toBe(1);
    // Sau khi xong → trả slot về.
    expect(guard.activeCount).toBe(0);
  });

  it('đủ slot → ném lỗi 429 nghiệp vụ (LIMIT_EXCEEDED)', async () => {
    const guard = new AnalysisConcurrencyGuard(1);
    // Chiếm slot trước (mô phỏng một phân tích đang chạy).
    expect(guard.tryAcquire()).toBe(true);

    await expect(guard.run(async () => 'never')).rejects.toMatchObject({
      code: ERROR_CODES.LIMIT_EXCEEDED,
    });
  });

  it('lỗi kèm details: maxConcurrency, activeCount, retryAfterSeconds', async () => {
    const guard = new AnalysisConcurrencyGuard(2);
    guard.tryAcquire();
    guard.tryAcquire();

    try {
      await guard.run(async () => 'never');
      throw new Error('phải ném lỗi');
    } catch (err: unknown) {
      const e = err as { code: string; details: Record<string, unknown> };
      expect(e.code).toBe(ERROR_CODES.LIMIT_EXCEEDED);
      expect(e.details.maxConcurrency).toBe(2);
      expect(e.details.activeCount).toBe(2);
      expect(e.details.retryAfterSeconds).toBe(5);
    }
  });

  it('slot được giải phóng khi task ném lỗi (không rò slot)', async () => {
    const guard = new AnalysisConcurrencyGuard(1);
    await expect(
      guard.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(guard.activeCount).toBe(0);
    // Vẫn chạy được lần sau.
    await expect(guard.run(async () => 'ok')).resolves.toBe('ok');
  });

  it('nhiều task song song: không vượt quá số slot', async () => {
    const guard = new AnalysisConcurrencyGuard(2);
    let peak = 0;
    const task = async (): Promise<number> => {
      peak = Math.max(peak, guard.activeCount);
      await new Promise((r) => setTimeout(r, 5));
      return guard.activeCount;
    };
    const results = await Promise.allSettled([
      guard.run(task),
      guard.run(task),
      guard.run(task),
      guard.run(task),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(2);
    expect(rejected).toBe(2);
    expect(peak).toBe(2);
    expect(guard.activeCount).toBe(0);
  });

  it('release() không âm (gọi thừa vẫn an toàn)', () => {
    const guard = new AnalysisConcurrencyGuard(1);
    guard.release();
    guard.release();
    expect(guard.activeCount).toBe(0);
    expect(guard.tryAcquire()).toBe(true);
  });

  it('limit phản ánh cấu hình', () => {
    expect(new AnalysisConcurrencyGuard(3).limit).toBe(3);
  });
});
