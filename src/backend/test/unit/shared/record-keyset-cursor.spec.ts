/**
 * Phần 13 v15 mục 3.28 — DVT-03 / DVT-04: cursor keyset cho bản ghi dataset
 * (Phần 7 v13 mục 3.23, DV-2 / DV-3).
 * Phần 13 v18 mục 3.31 — DLT-01…DLT-04: ràng buộc cursor theo truy vấn + hạn 24 giờ
 * (Phần 7 v16 mục 3.26, DL-1…DL-4).
 */
import { CursorCodec } from '../../../src/shared/domain/pagination/cursor-codec';
import {
  bindRecordCursor,
  computeRecordQueryHash,
  decodeRecordCursor,
  RECORD_CURSOR_TTL_MS,
  unbindRecordCursor,
  encodeRecordCursor,
  type RecordSortSignature,
} from '../../../src/shared/domain/pagination/record-keyset-cursor';
import { ValidationError } from '../../../src/shared/domain/errors';

describe('record-keyset-cursor', () => {
  const sort: RecordSortSignature = [
    ['c1', 'asc'],
    ['c3', 'desc'],
    ['c0', 'asc'],
    ['c2', 'desc'],
  ];

  it('DVT-04: khứ hồi giữ đúng kiểu (số, Date, chuỗi, boolean, null)', () => {
    const date = new Date('2024-01-03T17:00:00.000Z');
    const cursor = encodeRecordCursor(sort, { values: [12.5, date, 'An', true], rowIndex: 42 });
    const decoded = decodeRecordCursor(cursor, sort);
    expect(decoded?.rowIndex).toBe(42);
    expect(decoded?.values[0]).toBe(12.5);
    expect(decoded?.values[1]).toBeInstanceOf(Date);
    expect((decoded?.values[1] as Date).getTime()).toBe(date.getTime());
    expect(decoded?.values[2]).toBe('An');
    expect(decoded?.values[3]).toBe(true);

    const withNull = encodeRecordCursor(sort, { values: [null, null, null, null], rowIndex: 0 });
    expect(decodeRecordCursor(withNull, sort)?.values).toEqual([null, null, null, null]);
  });

  it('DVT-04: số không hữu hạn vẫn khứ hồi được (JSON không biểu diễn Infinity)', () => {
    const one: RecordSortSignature = [['c1', 'asc']];
    const cursor = encodeRecordCursor(one, { values: [Infinity], rowIndex: 1 });
    expect(decodeRecordCursor(cursor, one)?.values[0]).toBe(Infinity);
  });

  it('không sort ⇒ dạng { row_index } (tương thích GET /records)', () => {
    const cursor = encodeRecordCursor([], { values: [], rowIndex: 7 });
    expect(CursorCodec.decode<{ row_index: number }>(cursor)).toEqual({ row_index: 7 });
    expect(decodeRecordCursor(cursor, [])).toEqual({ values: [], rowIndex: 7 });
  });

  it('không có cursor ⇒ undefined (trang đầu)', () => {
    expect(decodeRecordCursor(undefined, sort)).toBeUndefined();
    expect(decodeRecordCursor('', [])).toBeUndefined();
  });

  it.each([
    ['không phải base64/JSON', '!!!not-base64!!!'],
    ['thiếu row_index', CursorCodec.encode({ foo: 1 })],
    ['row_index âm', CursorCodec.encode({ row_index: -1 })],
    ['row_index không nguyên', CursorCodec.encode({ row_index: 1.5 })],
    ['row_index là chuỗi', CursorCodec.encode({ row_index: '3' })],
  ])('VIEW-005 (không sort): %s ⇒ ValidationError', (_label, cursor) => {
    expect(() => decodeRecordCursor(cursor, [])).toThrow(ValidationError);
    expect(() => decodeRecordCursor(cursor, [])).toThrow(/Cursor khong hop le/);
  });

  it.each([
    ['sai phiên bản', CursorCodec.encode({ v: 2, s: [['c1', 'asc']], k: [['f', '1']], r: 0 })],
    ['thiếu k', CursorCodec.encode({ v: 1, s: [['c1', 'asc']], r: 0 })],
    ['k sai độ dài', CursorCodec.encode({ v: 1, s: [['c1', 'asc']], k: [], r: 0 })],
    ['tag lạ', CursorCodec.encode({ v: 1, s: [['c1', 'asc']], k: [['x', 1]], r: 0 })],
    ['số hỏng', CursorCodec.encode({ v: 1, s: [['c1', 'asc']], k: [['f', 'abc']], r: 0 })],
    ['ngày hỏng', CursorCodec.encode({ v: 1, s: [['c1', 'asc']], k: [['d', 'khong-phai-ngay']], r: 0 })],
    ['r âm', CursorCodec.encode({ v: 1, s: [['c1', 'asc']], k: [['f', '1']], r: -3 })],
    ['JSON là mảng', Buffer.from('[1,2]', 'utf8').toString('base64url')],
    ['cursor { row_index } kèm v', CursorCodec.encode({ v: 1, row_index: 0 })],
  ])('VIEW-005 (có sort): %s ⇒ ValidationError', (_label, cursor) => {
    expect(() => decodeRecordCursor(cursor, [['c1', 'asc']])).toThrow(ValidationError);
  });

  it('DVT-03: cursor sinh từ sort khác ⇒ ValidationError "khong khop"', () => {
    const one: RecordSortSignature = [['c1', 'asc']];
    const cursor = encodeRecordCursor(one, { values: [1], rowIndex: 0 });
    expect(() => decodeRecordCursor(cursor, [['c1', 'desc']])).toThrow(/Cursor khong khop/);
    expect(() => decodeRecordCursor(cursor, [['c2', 'asc']])).toThrow(/Cursor khong khop/);
    expect(() => decodeRecordCursor(cursor, [['c1', 'asc'], ['c2', 'asc']])).toThrow(/Cursor khong khop/);
    expect(() => decodeRecordCursor(cursor, [])).toThrow(/Cursor khong khop/);
  });

  it('DVT-03: cursor { row_index } (không sort) dùng cho truy vấn có sort ⇒ "khong khop"', () => {
    const legacy = CursorCodec.encode({ row_index: 5 });
    expect(() => decodeRecordCursor(legacy, [['c1', 'asc']])).toThrow(/Cursor khong khop/);
  });
});

describe('record-keyset-cursor — ràng buộc truy vấn + hạn 24 giờ (v16 DL-1…DL-4)', () => {
  const T0 = Date.UTC(2026, 10, 25, 8, 0, 0);
  const filters = [
    { column: 'c0', operator: 'greaterThan', value: 10 },
    { column: 'c1', operator: 'in', value: ['A', 'B'] },
    { column: 'c2', operator: 'isEmpty' },
  ];
  const q = computeRecordQueryHash(filters, { columns: ['c1', 'c3'], value: 'x' });
  const inner = encodeRecordCursor([['c0', 'asc']], { values: [5], rowIndex: 9 });

  const reasonOf = (fn: () => unknown): unknown => {
    try {
      fn();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      return (err as ValidationError).details;
    }
    throw new Error('không ném lỗi');
  };

  it('DLT-01: mã băm không phụ thuộc thứ tự filters / search.columns', () => {
    const shuffled = computeRecordQueryHash([filters[2]!, filters[0]!, filters[1]!], {
      columns: ['c3', 'c1'],
      value: 'x',
    });
    expect(shuffled).toBe(q);
    expect(q).toMatch(/^[0-9a-f]{16}$/);
  });

  it('DLT-01: đổi toán tử / giá trị / cột / search.value ⇒ mã băm khác', () => {
    const variants = [
      computeRecordQueryHash([{ ...filters[0]!, operator: 'greaterThanOrEqual' }, filters[1]!, filters[2]!], {
        columns: ['c1', 'c3'],
        value: 'x',
      }),
      computeRecordQueryHash([{ ...filters[0]!, value: 11 }, filters[1]!, filters[2]!], {
        columns: ['c1', 'c3'],
        value: 'x',
      }),
      computeRecordQueryHash([{ ...filters[0]!, column: 'c4' }, filters[1]!, filters[2]!], {
        columns: ['c1', 'c3'],
        value: 'x',
      }),
      computeRecordQueryHash(filters, { columns: ['c1', 'c3'], value: 'y' }),
      computeRecordQueryHash(filters),
    ];
    for (const v of variants) expect(v).not.toBe(q);
  });

  it('DLT-01: search rỗng / toàn khoảng trắng = không tìm (DV-12)', () => {
    expect(computeRecordQueryHash([], { columns: ['c1'], value: '   ' })).toBe(computeRecordQueryHash([]));
    expect(computeRecordQueryHash([], { columns: ['c1'], value: ' a' })).not.toBe(
      computeRecordQueryHash([], { columns: ['c1'], value: 'a' }),
    );
  });

  it('DLT-02: bọc rồi gỡ cùng truy vấn trong 24 giờ ⇒ trả lại cursor trong', () => {
    const outer = bindRecordCursor(inner, { queryHash: q, now: T0 }) as string;
    expect(outer).not.toBe(inner);
    expect(unbindRecordCursor(outer, { queryHash: q, now: T0 + RECORD_CURSOR_TTL_MS })).toBe(inner);
    expect(decodeRecordCursor(unbindRecordCursor(outer, { queryHash: q, now: T0 }), [['c0', 'asc']])).toEqual({
      values: [5],
      rowIndex: 9,
    });
  });

  it('DLT-02: không có cursor trong ⇒ null; không có cursor ⇒ undefined', () => {
    expect(bindRecordCursor(null, { queryHash: q })).toBeNull();
    expect(bindRecordCursor(undefined, { queryHash: q })).toBeNull();
    expect(unbindRecordCursor(undefined, { queryHash: q })).toBeUndefined();
    expect(unbindRecordCursor('', { queryHash: q })).toBeUndefined();
  });

  it('DLT-03: quá 24 giờ ⇒ cursor_expired', () => {
    const outer = bindRecordCursor(inner, { queryHash: q, now: T0 }) as string;
    expect(reasonOf(() => unbindRecordCursor(outer, { queryHash: q, now: T0 + RECORD_CURSOR_TTL_MS + 1 }))).toEqual({
      reason: 'cursor_expired',
    });
  });

  it('DLT-03: cursor dạng cũ (cấp trước v16) ⇒ cursor_expired', () => {
    expect(reasonOf(() => unbindRecordCursor(CursorCodec.encode({ row_index: 3 }), { queryHash: q }))).toEqual({
      reason: 'cursor_expired',
    });
    expect(reasonOf(() => unbindRecordCursor(inner, { queryHash: q }))).toEqual({ reason: 'cursor_expired' });
  });

  it('DLT-03: lớp bọc sai kiểu / thời điểm cấp ở tương lai xa ⇒ không hợp lệ (không có reason)', () => {
    const bad = [
      '!!!not-base64!!!',
      CursorCodec.encode({ foo: 1 }),
      CursorCodec.encode({ b: 2, c: inner, q, t: T0 }),
      CursorCodec.encode({ b: 1, c: '', q, t: T0 }),
      CursorCodec.encode({ b: 1, c: inner, q: 5, t: T0 }),
      CursorCodec.encode({ b: 1, c: inner, q, t: 'hom-qua' }),
      CursorCodec.encode({ b: 1, c: inner, q, t: T0 + 60 * 60 * 1000 }),
    ];
    for (const c of bad) {
      expect(() => unbindRecordCursor(c, { queryHash: q, now: T0 })).toThrow(/Cursor khong hop le/);
      expect(reasonOf(() => unbindRecordCursor(c, { queryHash: q, now: T0 }))).toBeUndefined();
    }
  });

  it('DLT-04: lệch truy vấn ⇒ cursor_query_mismatch; hết hạn được kiểm tra trước', () => {
    const outer = bindRecordCursor(inner, { queryHash: q, now: T0 }) as string;
    const other = computeRecordQueryHash([]);
    expect(reasonOf(() => unbindRecordCursor(outer, { queryHash: other, now: T0 }))).toEqual({
      reason: 'cursor_query_mismatch',
    });
    expect(
      reasonOf(() => unbindRecordCursor(outer, { queryHash: other, now: T0 + RECORD_CURSOR_TTL_MS + 1 })),
    ).toEqual({ reason: 'cursor_expired' });
  });
});
