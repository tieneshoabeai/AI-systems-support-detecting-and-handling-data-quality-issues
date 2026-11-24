/**
 * Phần 13 v15 mục 3.28 — DVT-03 / DVT-04: cursor keyset cho bản ghi dataset
 * (Phần 7 v13 mục 3.23, DV-2 / DV-3).
 */
import { CursorCodec } from '../../../src/shared/domain/pagination/cursor-codec';
import {
  decodeRecordCursor,
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
