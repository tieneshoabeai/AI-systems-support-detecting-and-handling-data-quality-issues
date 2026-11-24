/**
 * GĐ0 — Chống quá tải máy khi phân tích AI.
 *
 * Vấn đề gốc: `RecordQueryPort.listAllRecords()` nạp toàn bộ dataset vào RAM
 * (BSON → object → mảng `rows` → `rowWrappers`). Với dataset lớn, peak-RAM
 * vài GB → OOM / quá nhiệt CPU.
 *
 * Lớp phòng thủ mới: `assertAnalysisRowLimit()` chặn **trước khi** đọc bất kỳ
 * record nào từ MongoDB, dựa trên `ANALYSIS_MAX_ROWS` (mặc định 50.000 — GĐ11).
 */
import {
  assertAnalysisRowLimit,
  DEFAULT_ANALYSIS_MAX_ROWS,
  resolveAnalysisMaxRows,
} from '../src/modules/analysis/application/analysis-limit.util';
import { ERROR_CODES } from '../src/shared/domain/errors/error-codes';

describe('GĐ0 — chống quá tải máy (ANALYSIS_MAX_ROWS)', () => {
  describe('resolveAnalysisMaxRows', () => {
    it('dùng giá trị cấu hình hợp lệ', () => {
      expect(resolveAnalysisMaxRows(50_000)).toBe(50_000);
      expect(resolveAnalysisMaxRows('200000')).toBe(200_000);
    });

    it('fallback về mặc định khi cấu hình sai lệch', () => {
      expect(resolveAnalysisMaxRows(undefined)).toBe(DEFAULT_ANALYSIS_MAX_ROWS);
      expect(resolveAnalysisMaxRows(null)).toBe(DEFAULT_ANALYSIS_MAX_ROWS);
      expect(resolveAnalysisMaxRows(0)).toBe(DEFAULT_ANALYSIS_MAX_ROWS);
      expect(resolveAnalysisMaxRows(-5)).toBe(DEFAULT_ANALYSIS_MAX_ROWS);
      expect(resolveAnalysisMaxRows('abc')).toBe(DEFAULT_ANALYSIS_MAX_ROWS);
    });

    it('mặc định là 50.000 dòng (GĐ11 — hạ từ 100.000 sau khi đo peak RSS)', () => {
      expect(DEFAULT_ANALYSIS_MAX_ROWS).toBe(50_000);
    });
  });

  describe('assertAnalysisRowLimit', () => {
    it('cho phép khi rowCount == maxRows (biên trên)', () => {
      expect(() => assertAnalysisRowLimit(100_000, 100_000)).not.toThrow();
    });

    it('cho phép khi rowCount < maxRows', () => {
      expect(() => assertAnalysisRowLimit(999, 100_000)).not.toThrow();
    });

    it('ném lỗi nghiệp vụ khi rowCount > maxRows', () => {
      expect(() => assertAnalysisRowLimit(100_001, 100_000)).toThrow();
      try {
        assertAnalysisRowLimit(250_000, 100_000);
        throw new Error('phải ném lỗi');
      } catch (e) {
        const err = e as { code?: string; details?: { rowCount?: number; maxRows?: number } };
        expect(err.code).toBe(ERROR_CODES.ANALYSIS_TOO_LARGE);
        expect(err.details).toEqual({ rowCount: 250_000, maxRows: 100_000 });
      }
    });

    it('không ném khi rowCount không hữu lệ (NaN/0/âm)', () => {
      expect(() => assertAnalysisRowLimit(Number.NaN, 100_000)).not.toThrow();
      expect(() => assertAnalysisRowLimit(0, 100_000)).not.toThrow();
      expect(() => assertAnalysisRowLimit(-1, 100_000)).not.toThrow();
    });
  });
});
