import {
  InvalidCursorError,
  decodeKeysetCursor,
  encodeKeysetCursor,
  parseListCursor,
} from '../src/shared/pagination/keyset-cursor';
import {
  buildKeysetCondition,
  buildKeysetSort,
  type KeysetSortSpec,
} from '../src/shared/pagination/keyset-filter.util';
import { extractSortValue } from '../src/shared/pagination/keyset-value.util';
import {
  COMMON_SORT_SPECS,
  resolveSortSpec,
} from '../src/shared/pagination/keyset-sort.util';
import {
  compareBySort,
  isAfterCursor,
  sortValueOf,
  type InMemorySortable,
} from '../src/shared/pagination/keyset-memory.util';

describe('Keyset Cursor — encode/decode', () => {
  it('encode → decode giữ nguyên payload', () => {
    const cursor = encodeKeysetCursor({ s: 'updated', k: '2026-01-01T00:00:00.000Z', n: 0, id: 'abc' });
    const decoded = decodeKeysetCursor(cursor);
    expect(decoded).toEqual({
      s: 'updated',
      k: '2026-01-01T00:00:00.000Z',
      n: 0,
      id: 'abc',
    });
  });

  it('decode trả null khi cursor hỏng', () => {
    expect(decodeKeysetCursor('!!!khong-phai-base64!!!')).toBeNull();
    expect(decodeKeysetCursor(Buffer.from('{"s":"x"}').toString('base64url'))).toBeNull();
  });

  it('cursor là opaque base64url (không chứa JSON thô)', () => {
    const cursor = encodeKeysetCursor({ s: 'updated', k: 'k', n: 0, id: 'i' });
    expect(cursor).not.toContain('{');
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('Keyset Cursor — parseListCursor', () => {
  it('undefined → undefined (trang đầu)', () => {
    expect(parseListCursor(undefined, 'updated')).toBeUndefined();
  });

  it('giải mã con trỏ hợp lệ', () => {
    const cursor = encodeKeysetCursor({ s: 'updated', k: 'k', n: 1, id: 'i' });
    const parsed = parseListCursor(cursor, 'updated');
    expect(parsed).toEqual({ sortCode: 'updated', value: 'k', isNull: true, id: 'i' });
  });

  it('ném InvalidCursorError khi cursor hỏng', () => {
    expect(() => parseListCursor('garbage', 'updated')).toThrow(InvalidCursorError);
  });

  it('ném InvalidCursorError khi cursor sinh từ sort khác', () => {
    const cursor = encodeKeysetCursor({ s: 'name_asc', k: 'k', n: 0, id: 'i' });
    expect(() => parseListCursor(cursor, 'updated')).toThrow(InvalidCursorError);
  });
});

describe('Keyset — điều kiện MongoDB', () => {
  const dateSpec: KeysetSortSpec = { field: 'last_accessed_at', direction: -1, isDate: true };
  const nameSpec: KeysetSortSpec = { field: 'name', direction: 1, isDate: false };

  it('sort giảm dần theo ngày: null nằm SAU mọi giá trị ngày', () => {
    const cond = buildKeysetCondition(dateSpec, {
      value: '2026-01-01T00:00:00.000Z',
      isNull: false,
      id: 'id1',
    });
    const or = (cond.$or as Record<string, unknown>[]).slice();
    expect(or).toContainEqual({ last_accessed_at: null });
  });

  it('sort tăng dần theo ngày: null nằm TRƯỚC mọi giá trị ngày', () => {
    const cond = buildKeysetCondition({ ...dateSpec, direction: 1 }, {
      value: '2026-01-01T00:00:00.000Z',
      isNull: false,
      id: 'id1',
    });
    const or = cond.$or as Record<string, unknown>[];
    expect(or.some((x) => 'last_accessed_at' in x && !('$or' in x))).toBe(true);
  });

  it('con trỏ trỏ vào nhóm null + sort tăng dần → chỉ còn giá trị ngày', () => {
    const cond = buildKeysetCondition({ ...dateSpec, direction: 1 }, {
      value: '',
      isNull: true,
      id: 'id1',
    });
    expect(cond).toEqual({ $or: [{ last_accessed_at: null, _id: { $gt: 'id1' } }, { last_accessed_at: { $ne: null } }] });
  });

  it('con trỏ trỏ vào nhóm null + sort giảm dần → chỉ còn null với _id nhỏ hơn', () => {
    const cond = buildKeysetCondition(dateSpec, { value: '', isNull: true, id: 'id1' });
    expect(cond).toEqual({ last_accessed_at: null, _id: { $lt: 'id1' } });
  });

  it('sort theo chuỗi tăng dần dùng $gt + tiebreaker _id', () => {
    const cond = buildKeysetCondition(nameSpec, { value: 'abc', isNull: false, id: 'id1' });
    expect(cond).toEqual({
      $or: [{ name: { $gt: 'abc' } }, { name: 'abc', _id: { $gt: 'id1' } }],
    });
  });

  it('buildKeysetSort luôn kèm tiebreaker _id cùng chiều', () => {
    expect(buildKeysetSort(nameSpec)).toEqual({ name: 1, _id: 1 });
    expect(buildKeysetSort(dateSpec)).toEqual({ last_accessed_at: -1, _id: -1 });
  });
});

describe('Keyset — extractSortValue', () => {
  it('ngày hợp lệ → ISO-8601', () => {
    const d = new Date('2026-05-04T03:02:01.000Z');
    const out = extractSortValue({ field: 'updated_at', direction: -1, isDate: true }, { updated_at: d });
    expect(out).toEqual({ value: '2026-05-04T03:02:01.000Z', isNull: false });
  });

  it('null → isNull = true', () => {
    const out = extractSortValue({ field: 'updated_at', direction: -1, isDate: true }, { updated_at: null });
    expect(out.isNull).toBe(true);
  });

  it('chuỗi → giữ nguyên', () => {
    const out = extractSortValue({ field: 'name', direction: 1, isDate: false }, { name: 'Alpha' });
    expect(out).toEqual({ value: 'Alpha', isNull: false });
  });
});

describe('Keyset — resolveSortSpec', () => {
  it('mã sort hợp lệ → trả đặc tả', () => {
    const { code, spec } = resolveSortSpec(COMMON_SORT_SPECS, 'name_asc');
    expect(code).toBe('name_asc');
    expect(spec.field).toBe('name');
  });

  it('mã sort lạ → fallback về mặc định', () => {
    const { code } = resolveSortSpec(COMMON_SORT_SPECS, 'khong-ton-tai');
    expect(code).toBe('last_accessed');
  });
});

describe('Keyset — in-memory (admin path)', () => {
  const mk = (id: string, name: string, lastAccessedAt: Date | null): InMemorySortable => ({
    id,
    name,
    lastAccessedAt,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  it('compareBySort: name_asc tăng dần', () => {
    const a = mk('a', 'Alpha', null);
    const b = mk('b', 'Beta', null);
    expect(compareBySort(a, b, 'name_asc')).toBeLessThan(0);
    expect(compareBySort(b, a, 'name_asc')).toBeGreaterThan(0);
  });

  it('compareBySort: last_accessed giảm dần, null nằm cuối', () => {
    const withDate = mk('a', 'A', new Date('2026-02-01T00:00:00.000Z'));
    const withNull = mk('b', 'B', null);
    expect(compareBySort(withDate, withNull, 'last_accessed')).toBeLessThan(0);
  });

  it('sortValueOf trả ISO + cờ isNull', () => {
    expect(sortValueOf(mk('a', 'A', null), 'last_accessed')).toEqual({ value: '', isNull: true });
    expect(sortValueOf(mk('a', 'A', null), 'name_asc')).toEqual({ value: 'A', isNull: false });
  });

  it('isAfterCursor lọc đúng các bản ghi phía sau', () => {
    const cursor = { sortCode: 'name_asc', value: 'Beta', isNull: false, id: 'b' };
    expect(isAfterCursor(mk('a', 'Alpha', null), cursor, 'name_asc')).toBe(false);
    expect(isAfterCursor(mk('c', 'Gamma', null), cursor, 'name_asc')).toBe(true);
  });

  it('isAfterCursor dùng tiebreaker _id khi giá trị sort bằng nhau', () => {
    const cursor = { sortCode: 'name_asc', value: 'Beta', isNull: false, id: 'b' };
    expect(isAfterCursor(mk('a', 'Beta', null), cursor, 'name_asc')).toBe(false);
    expect(isAfterCursor(mk('c', 'Beta', null), cursor, 'name_asc')).toBe(true);
  });
});
