/**
 * OPEN-05 (chốt 2026-11-19) — định dạng CSV được **thu hẹp** còn phẩy cách (`,`).
 *
 * - File dùng `;` / tab / `|` → **từ chối** kèm lý do cụ thể (không tự đoán).
 * - File phẩy cách → chấp nhận.
 * - Dấu phân cách nằm trong quoted field → không tính (tránh báo nhầm).
 */
import {
  assertCommaDelimitedCsv,
  countDelimiters,
  findForbiddenDelimiter,
  stripBom,
} from '../../../src/modules/datasets/domain/services/csv-delimiter.util';

describe('OPEN-05 — CSV chỉ phẩy cách', () => {
  describe('countDelimiters', () => {
    it('đếm dấu phân cách ngoài quoted field', () => {
      expect(countDelimiters('a,b,c')).toEqual({ ',': 2, ';': 0, '\t': 0, '|': 0 });
    });

    it('bỏ qua dấu phân cách bên trong ngoặc kép', () => {
      // `a` | "b,c" | d → 2 dấu phẩy cách (dấu trong quoted field bị bỏ)
      expect(countDelimiters('a,"b,c",d')[',']).toBe(2);
    });

    it('escape dấu ngoặc kép ("" ) không làm lệch đếm', () => {
      // `a` | "b""x,y" | c → dấu phẩy trong quoted field bị bỏ
      expect(countDelimiters('a,"b""x,y",c')[',']).toBe(2);
    });
  });

  describe('findForbiddenDelimiter', () => {
    it('CSV phẩy cách → null', () => {
      expect(findForbiddenDelimiter('a,b,c')).toBeNull();
    });

    it('CSV chấm phẩy → ";"', () => {
      expect(findForbiddenDelimiter('a;b;c')).toBe(';');
    });

    it('CSV tab → "\\t"', () => {
      expect(findForbiddenDelimiter('a\tb\tc')).toBe('\t');
    });

    it('CSV gạch dọc → "|"', () => {
      expect(findForbiddenDelimiter('a|b|c')).toBe('|');
    });

    it('header chỉ 1 cột → null (không có dấu phân cách nào)', () => {
      expect(findForbiddenDelimiter('a')).toBeNull();
    });

    it('dấu phân cách trong quoted field không bị tính', () => {
      expect(findForbiddenDelimiter('"a;b",c,d')).toBeNull();
    });
  });

  describe('assertCommaDelimitedCsv', () => {
    it('CSV phẩy cách → không ném', () => {
      expect(() => assertCommaDelimitedCsv('a,b,c')).not.toThrow();
    });

    it('CSV chấm phẩy → ném VALIDATION_ERROR kèm lý do', () => {
      expect(() => assertCommaDelimitedCsv('a;b;c')).toThrow(/phẩy cách/);
      try {
        assertCommaDelimitedCsv('a;b;c');
      } catch (e) {
        expect(e).toMatchObject({ code: 'VALIDATION_ERROR' });
        expect((e as { details?: Record<string, unknown> }).details).toMatchObject({
          reason: 'unsupported_delimiter',
          detectedDelimiter: ';',
        });
      }
    });

    it('CSV tab → ném lỗi', () => {
      expect(() => assertCommaDelimitedCsv('a\tb')).toThrow();
    });

    it('CSV gạch dọc → ném lỗi', () => {
      expect(() => assertCommaDelimitedCsv('a|b')).toThrow();
    });

    it('bỏ BOM trước khi kiểm tra', () => {
      expect(() => assertCommaDelimitedCsv('\uFEFFa,b')).not.toThrow();
    });

    it('bỏ CR cuối dòng (CRLF)', () => {
      expect(() => assertCommaDelimitedCsv('a,b\r')).not.toThrow();
    });
  });

  describe('stripBom', () => {
    it('bỏ BOM ở đầu', () => {
      expect(stripBom('\uFEFFabc')).toBe('abc');
    });

    it('không đụng chuỗi không có BOM', () => {
      expect(stripBom('abc')).toBe('abc');
    });
  });
});
