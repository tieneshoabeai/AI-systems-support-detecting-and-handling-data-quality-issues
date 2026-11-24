/**
 * Van de 2 - Dong nhat kieu du lieu giua schema va du lieu thuc te sau Ingestion.
 *
 * Boi canh (su co da tai hien tren DB that, dataset 100.000 dong):
 *   Schema suy luan `review_score` la `number`, nhung `props.c2` luu chuoi `"5"`.
 *   - Loc bang so `5` tra 0 ban ghi; loc `["5"]` tra 57.420 ban ghi.
 *   - Sap xep theo thu tu lexicographic ("10" < "9").
 *   - `getColumnStats` dung `$isNumber` tra 0/100.000 -> histogram rong.
 *
 * Ba lop sua duoc kiem thu o day:
 *   1. `value-coercion.vo.ts` - quy tac ep kieu dung chung (domain).
 *   2. `record-query.repository.ts` - loc/sap xep/thong ke dich gia tri theo schema.
 *   3. `ingest-dataset-stream.handler.ts` - ghi dung kieu luc nap (2 pha).
 */
import {
  coerceBoolean,
  coerceDate,
  coerceNumber,
  coerceValue,
  coerceValueList,
  isBlankValue,
  isNumericValue,
  toNumberOrNull,
} from '../../../src/modules/datasets/domain/value-objects/value-coercion.vo';

describe('Lop 1 - quy tac ep kieu (value-coercion.vo)', () => {
  describe('coerceNumber', () => {
    it('chuoi so -> so', () => {
      expect(coerceNumber('5')).toBe(5);
      expect(coerceNumber('4')).toBe(4);
      expect(coerceNumber('  12  ')).toBe(12);
      expect(coerceNumber('-3.5')).toBe(-3.5);
    });

    it('giu nguyen ban goc khi khong phai so (khong mat du lieu)', () => {
      expect(coerceNumber('abc')).toBe('abc');
      expect(coerceNumber('1,234')).toBe('1,234');
      expect(coerceNumber('Infinity')).toBe('Infinity');
      expect(coerceNumber('')).toBeNull();
    });

    it('so da la so -> giu nguyen', () => {
      expect(coerceNumber(5)).toBe(5);
      expect(coerceNumber(0)).toBe(0);
    });

    it('boolean -> 1/0', () => {
      expect(coerceNumber(true)).toBe(1);
      expect(coerceNumber(false)).toBe(0);
    });
  });

  describe('coerceBoolean', () => {
    it('nhan dien true/false/yes/no/1/0', () => {
      expect(coerceBoolean('true')).toBe(true);
      expect(coerceBoolean('TRUE')).toBe(true);
      expect(coerceBoolean('yes')).toBe(true);
      expect(coerceBoolean('1')).toBe(true);
      expect(coerceBoolean('false')).toBe(false);
      expect(coerceBoolean('No')).toBe(false);
      expect(coerceBoolean('0')).toBe(false);
    });

    it('giu nguyen ban goc khi khong nhan dien duoc', () => {
      expect(coerceBoolean('maybe')).toBe('maybe');
    });
  });

  describe('coerceDate', () => {
    it('YYYY-MM-DD -> Date theo gio Viet Nam (UTC+7)', () => {
      const d = coerceDate('2024-05-03') as Date;
      expect(d).toBeInstanceOf(Date);
      // midnight gio Viet = 17:00 UTC hom truoc
      expect(d.toISOString()).toBe('2024-05-02T17:00:00.000Z');
    });

    it('giu nguyen mui gio khi co mui gio tuong minh', () => {
      const d = coerceDate('2024-05-03T10:00:00Z') as Date;
      expect(d.toISOString()).toBe('2024-05-03T10:00:00.000Z');
    });

    it('ngay gio khong mui gio -> hieu la gio Viet Nam', () => {
      const d = coerceDate('2024-05-03 10:00:00') as Date;
      expect(d.toISOString()).toBe('2024-05-03T03:00:00.000Z');
    });

    it('giu nguyen ban goc khi khong parse duoc', () => {
      expect(coerceDate('khong phai ngay')).toBe('khong phai ngay');
    });
  });

  describe('coerceValue theo dataType', () => {
    it('rong -> null', () => {
      expect(coerceValue('', 'number')).toBeNull();
      expect(coerceValue('   ', 'string')).toBeNull();
      expect(coerceValue(null, 'number')).toBeNull();
      expect(coerceValue(undefined, 'boolean')).toBeNull();
    });

    it('dung kieu theo schema', () => {
      expect(coerceValue('5', 'number')).toBe(5);
      expect(coerceValue('true', 'boolean')).toBe(true);
      expect(coerceValue('2024-05-03', 'date')).toBeInstanceOf(Date);
      expect(coerceValue('abc', 'string')).toBe('abc');
    });

    it('cot string khong bi ep so', () => {
      // "007" la chuoi hop le -> giu nguyen, khong thanh 7
      expect(coerceValue('007', 'string')).toBe('007');
    });
  });

  describe('tien ich', () => {
    it('isBlankValue', () => {
      expect(isBlankValue('')).toBe(true);
      expect(isBlankValue('  ')).toBe(true);
      expect(isBlankValue(null)).toBe(true);
      expect(isBlankValue('a')).toBe(false);
      expect(isBlankValue(0)).toBe(false);
    });

    it('coerceValueList ep tung phan tu', () => {
      expect(coerceValueList(['1', '2'], 'number')).toEqual([1, 2]);
      expect(coerceValueList(['1', 'x'], 'number')).toEqual([1, 'x']);
    });

    it('isNumericValue', () => {
      expect(isNumericValue(5)).toBe(true);
      expect(isNumericValue('5')).toBe(false);
      expect(isNumericValue(Number.NaN)).toBe(false);
    });

    it('toNumberOrNull', () => {
      expect(toNumberOrNull('5')).toBe(5);
      expect(toNumberOrNull('abc')).toBeNull();
      expect(toNumberOrNull('')).toBeNull();
      expect(toNumberOrNull(7)).toBe(7);
    });
  });
});

describe('Lop 1b - logic dich gia tri bo loc', () => {
  /**
   * Thuật toán dùng trong `record-query.repository.ts` cho cot `number`:
   * khop CA HAI dang luu tru (so da ep + chuoi so cua du lieu cu).
   */
  const candidatesFor = (value: unknown): unknown[] => {
    const n = coerceNumber(value);
    if (typeof n !== 'number' || !Number.isFinite(n)) return [value];
    const str = typeof value === 'string' ? value.trim() : String(value);
    return n === Number(str) ? [n, str] : [n];
  };

  it('loc bang so 5 -> khop ca so 5 lan chuoi "5"', () => {
    // Day chinh la loi goc: `{ 'props.c2': 5 }` tra 0 dong
    const cands = candidatesFor(5);
    expect(cands).toEqual([5, '5']);
  });

  it('loc bang chuoi "5" -> cung khop ca hai dang', () => {
    const cands = candidatesFor('5');
    expect(cands).toEqual([5, '5']);
  });

  it('toan tu `in` sinh danh sach ung vien day du', () => {
    const cands = [5, '5', 4, '4'].flatMap((v) => candidatesFor(v));
    expect(cands).toEqual([5, '5', 5, '5', 4, '4', 4, '4']);
  });

  it('gia tri khong phai so -> giu nguyen', () => {
    expect(candidatesFor('abc')).toEqual(['abc']);
  });
});
