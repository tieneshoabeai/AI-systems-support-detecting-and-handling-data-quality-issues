/**
 * GĐ2 — Nhóm NGHI VẤN + ký hiệu thiếu dùng chung + `dateOrderOf()` tích hợp vào DQ.
 *
 * Port từ `Vqd_BE` (Đợt G/H/I) nhưng test trực tiếp các hàm thuần trong `domain/`
 * (không qua service/CQRS) — đúng kiểu unit test của wave5 hiện có.
 */
import { isMissingToken, MISSING_TOKENS } from '../src/shared/domain/utils/missing-tokens.util';
import {
  detectSuspicions,
  type SuspicionColumn,
} from '../src/modules/analysis/domain/suspicion.util';
import {
  computeDq03,
  dateOrderOf,
  isMissingCell,
  isValidByType,
} from '../src/modules/analysis/domain/dq.util';
import { toCategory, computePairCell } from '../src/modules/analysis/domain/correlation.util';
import { describeColumn, evaluateImbalance } from '../src/modules/analysis/domain/stats.util';
import { maskForAi, toShapePattern } from '../src/modules/analysis/domain/pii-mask.util';

const sc = (
  name: string,
  dataType: string,
  role: SuspicionColumn['role'],
  isPii = false,
): SuspicionColumn => ({ name, dataType, role, isPii });

describe('GĐ2.1 — ký hiệu thiếu dùng chung (missing-tokens.util)', () => {
  it('nhận diện ký hiệu thiếu sau khi trim + lowercase', () => {
    expect(isMissingToken(' N/A ')).toBe(true);
    expect(isMissingToken('NA')).toBe(true);
    expect(isMissingToken('null')).toBe(true);
    expect(isMissingToken('None')).toBe(true);
    expect(isMissingToken('-')).toBe(true);
    expect(isMissingToken('?')).toBe(true);
    expect(isMissingToken('NaN')).toBe(true);
    expect(isMissingToken('#N/A')).toBe(true);
    expect(isMissingToken('undefined')).toBe(true);
    expect(isMissingToken('unknown')).toBe(true);
  });

  it('chuỗi rỗng KHÔNG phải ký hiệu (rỗng là thiếu theo DQ-01)', () => {
    expect(isMissingToken('')).toBe(false);
    expect(isMissingToken('   ')).toBe(false);
  });

  it('giá trị không phải chuỗi → không phải ký hiệu', () => {
    expect(isMissingToken(null)).toBe(false);
    expect(isMissingToken(undefined)).toBe(false);
    expect(isMissingToken(0)).toBe(false);
    expect(isMissingToken(false)).toBe(false);
  });

  it('tập ký hiệu dùng chung — không rỗng, không trùng', () => {
    expect(MISSING_TOKENS.size).toBeGreaterThan(0);
    expect(MISSING_TOKENS.has('')).toBe(false);
    for (const t of MISSING_TOKENS) expect(t).toBe(t.trim().toLowerCase());
  });

  it('DQ-01: ký hiệu thiếu KHÔNG được tính là ô thiếu', () => {
    expect(isMissingCell('NA')).toBe(false);
    expect(isMissingCell('null')).toBe(false);
    expect(isMissingCell('?')).toBe(false);
    expect(isMissingCell('')).toBe(true);
    expect(isMissingCell(null)).toBe(true);
  });
});

describe('GĐ2.2 — toCategory / tương quan: cột chữ giữ ký hiệu là một lớp', () => {
  it('cột KHÔNG phải chữ → ký hiệu thiếu bị coi là thiếu (null)', () => {
    expect(toCategory('NA')).toBeNull();
    expect(toCategory('?')).toBeNull();
    expect(toCategory(' x ')).toBe('x');
  });

  it('cột CHỮ → ký hiệu thiếu là một lớp hợp lệ, chỉ ô rỗng mới thiếu', () => {
    expect(toCategory('NA', true)).toBe('NA');
    expect(toCategory('?', true)).toBe('?');
    expect(toCategory('', true)).toBeNull();
    expect(toCategory('   ', true)).toBeNull();
  });

  it('cặp phân loại: cột chữ giữ "NA" trong tập dòng hợp lệ', () => {
    const rows = [
      { k: 'NA', v: 1 },
      { k: 'x', v: 2 },
      { k: 'x', v: 3 },
      { k: 'NA', v: 4 },
      { k: 'y', v: 5 },
    ];
    expect(computePairCell({ colA: 'k', roleA: 'categorical', colB: 'v', roleB: 'numeric', rows, textA: true }, 'pearson').n).toBe(5);
    expect(computePairCell({ colA: 'k', roleA: 'categorical', colB: 'v', roleB: 'numeric', rows }, 'pearson').n).toBe(3);
  });
});

describe('GĐ2.3 — dateOrderOf() tích hợp vào DQ-03', () => {
  it('phân định DD/MM khi có ngày > 12 ở phần đầu', () => {
    expect(dateOrderOf(['23/03/2024', '01/04/2024'])).toBe('dmy');
  });

  it('phân định MM/DD khi có ngày > 12 ở phần sau', () => {
    expect(dateOrderOf(['03/23/2024', '04/01/2024'])).toBe('mdy');
  });

  it('mơ hồ khi mọi ngày và tháng ≤ 12', () => {
    expect(dateOrderOf(['03/04/2019', '01/02/2019'])).toBe('either');
  });

  it('mâu thuẫn (cả hai phía > 12) → giữ DD/MM theo mặc định', () => {
    expect(dateOrderOf(['23/03/2024', '03/23/2024'])).toBe('dmy');
  });

  it('không có giá trị dạng DD/MM/YYYY → "either"', () => {
    expect(dateOrderOf(['2024-01-01'])).toBe('either');
    expect(dateOrderOf([])).toBe('either');
  });

  it('isValidByType dùng bộ đọc CHẶT, không dùng new Date()', () => {
    expect(isValidByType('2019-02-30', 'date').valid).toBe(false);
    expect(isValidByType('2019-02-30', 'date').reason).toBe('nonexistent_date');
    expect(isValidByType('March 5', 'date').valid).toBe(false);
    expect(isValidByType('2019-02-28', 'date').valid).toBe(true);
  });

  it('đọc theo thứ tự DD/MM xác định được', () => {
    // 03/04/2019 → hợp lệ ở cả DD/MM lẫn MM/DD → "either" chấp nhận
    expect(isValidByType('03/04/2019', 'date', 'either').valid).toBe(true);
    // 23/04/2019 → chỉ hợp lệ ở DD/MM
    expect(isValidByType('23/04/2019', 'date', 'dmy').valid).toBe(true);
    expect(isValidByType('23/04/2019', 'date', 'mdy').valid).toBe(false);
  });

  it('computeDq03 tính thứ tự ngày MỘT LẦN cho cả cột', () => {
    const rows = [
      { rowIndex: 0, values: { d: '23/04/2019' } },
      { rowIndex: 1, values: { d: '25/04/2019' } },
    ];
    // Cột này rõ ràng là DD/MM → cả hai dòng hợp lệ, invalidCount = 0
    const out = computeDq03([{ column: 'd', dataType: 'date' }], rows);
    expect(out[0]).toMatchObject({ validCount: 2, invalidCount: 0 });
  });

  it('cột CHỮ: ký hiệu NA là chuỗi hợp lệ, KHÔNG tính DQ-03', () => {
    const rows = [
      { rowIndex: 0, values: { s: 'NA' } },
      { rowIndex: 1, values: { s: 'x' } },
    ];
    const out = computeDq03([{ column: 's', dataType: 'string' }], rows);
    expect(out[0]).toMatchObject({ validCount: 2, invalidCount: 0 });
  });

  it('cột SỐ: ký hiệu NA vẫn bị tách riêng, không tính vào DQ-01', () => {
    const rows = [
      { rowIndex: 0, values: { n: 'NA' } },
      { rowIndex: 1, values: { n: '12' } },
    ];
    const out = computeDq03([{ column: 'n', dataType: 'number' }], rows);
    expect(out[0]?.invalidCount).toBe(1);
    expect(out[0]?.reasons['symbol_as_missing_excluded_from_dq01']).toBe(1);
  });
});

describe('GĐ2.4 — 15 loại Nghi vấn', () => {
  it('missing_token — ký hiệu thiếu ở cột chữ', () => {
    const rows = ['NA', 'x', 'N/A', 'null', 'y'].map((v) => ({ s: v }));
    const s = detectSuspicions([sc('s', 'string', 'category')], rows).find((x) => x.kind === 'missing_token');
    expect(s).toMatchObject({ column: 's', count: 3 });
    expect(s?.message).toContain('DQ-01');
  });

  it('whitespace — khoảng trắng thừa đầu/cuối', () => {
    const rows = [' x', 'y ', 'z'].map((v) => ({ s: v }));
    expect(detectSuspicions([sc('s', 'string', 'category')], rows).find((x) => x.kind === 'whitespace')?.count).toBe(2);
  });

  it('case_variant — cùng nghĩa viết khác hoa/thường', () => {
    const rows = ['Hanoi', 'hanoi', 'HANOI', 'Da Nang'].map((v) => ({ city: v }));
    const s = detectSuspicions([sc('city', 'string', 'category')], rows).find((x) => x.kind === 'case_variant');
    expect(s).toMatchObject({ column: 'city', count: 2 });
  });

  it('constant_column — cột chỉ có một giá trị', () => {
    const rows = Array.from({ length: 5 }, () => ({ s: 'A' }));
    expect(detectSuspicions([sc('s', 'string', 'category')], rows).find((x) => x.kind === 'constant_column')?.count).toBe(5);
  });

  it('ambiguous_date_format — không phân định được DD/MM hay MM/DD', () => {
    const rows = ['03/04/2019', '01/02/2019'].map((d) => ({ d }));
    expect(detectSuspicions([sc('d', 'date', 'datetime')], rows).some((x) => x.kind === 'ambiguous_date_format')).toBe(true);
  });

  it('identifier_not_unique — mã định danh lặp', () => {
    const rows = ['100001', '100002', '100004', '100004', '100005', '100006', '100006'].map((order_id) => ({ order_id }));
    const s = detectSuspicions([sc('order_id', 'number', 'identifier')], rows).find((x) => x.kind === 'identifier_not_unique');
    expect(s).toMatchObject({ column: 'order_id', count: 4 });
    expect(s?.examples).toHaveLength(2);
  });

  it('duplicate_key — trùng khóa nghiệp vụ nhưng khác cột còn lại', () => {
    const cols = [sc('customer_id', 'number', 'identifier'), sc('email', 'string', 'text'), sc('phone', 'number', 'identifier')];
    const rows = [
      { customer_id: 1001, email: 'u0@x.com', phone: '0915' },
      { customer_id: 2001, email: ' U0@X.COM ', phone: '0915' },
      { customer_id: 1003, email: 'u3@x.com', phone: '0999' },
      { customer_id: 1003, email: 'u3@x.com', phone: '0999' },
      { customer_id: 1004, email: 'u4@x.com', phone: '0888' },
      ...Array.from({ length: 15 }, (_, i) => ({ customer_id: 3000 + i, email: `k${i}@x.com`, phone: `07${i}` })),
    ];
    const s = detectSuspicions(cols, rows).find((x) => x.kind === 'duplicate_key');
    expect(s).toMatchObject({ column: 'email + phone', count: 2 });
    // chỉ một cột khóa là identifier → đã có identifier_not_unique, không báo trùng ở đây
    expect(detectSuspicions([sc('phone', 'number', 'identifier')], rows).some((x) => x.kind === 'duplicate_key')).toBe(false);
  });

  it('locale_number_format — số viết theo vùng / kèm tiền tệ', () => {
    const rows = ['231.36', '1.200,50', '$1,200', '12,5', 'abc', '300', '1.200,50', 'N/A'].map((price) => ({ price }));
    const s = detectSuspicions([sc('price', 'number', 'measure')], rows).find((x) => x.kind === 'locale_number_format');
    expect(s?.count).toBe(4);
    expect(s?.examples.join(' ')).not.toContain('abc');
  });

  it('leading_zero_numeric — mã có số 0 đầu, cùng độ dài', () => {
    const zips = ['03249', '88775', '42151', '01234', '00999', '70499'].map((zip_code) => ({ zip_code }));
    expect(detectSuspicions([sc('zip_code', 'number', 'identifier')], zips).find((x) => x.kind === 'leading_zero_numeric')?.count).toBe(3);
    const nums = ['123', '45678', '9', '0', '10'].map((zip_code) => ({ zip_code }));
    expect(detectSuspicions([sc('zip_code', 'number', 'measure')], nums).some((x) => x.kind === 'leading_zero_numeric')).toBe(false);
  });

  it('sentinel — mã quy ước nằm xa vùng dữ liệu', () => {
    const rows = [5079310, 3005718, 5734389, 2804813, 4746170, 4329835, -999].map((balance) => ({ balance }));
    expect(detectSuspicions([sc('balance', 'number', 'measure')], rows).find((x) => x.kind === 'sentinel')).toMatchObject({ count: 1 });
  });

  it('negative_in_positive — số âm lẫn trong cột gần như toàn dương', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ v: i === 0 ? -5 : i + 1 }));
    const s = detectSuspicions([sc('v', 'number', 'measure')], rows).find((x) => x.kind === 'negative_in_positive');
    expect(s).toMatchObject({ count: 1 });
  });

  it('zero_in_positive — số 0 lẫn trong cột toàn dương', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ v: i === 0 ? 0 : i + 1 }));
    const s = detectSuspicions([sc('v', 'number', 'measure')], rows).find((x) => x.kind === 'zero_in_positive');
    expect(s).toMatchObject({ count: 1 });
  });

  it('row_all_measures_missing — dòng trống toàn bộ cột số đo', () => {
    const rows = [
      { a: 1, b: 2, note: 'x' },
      { a: null, b: null, note: 'y' },
      { a: 3, b: 4, note: 'z' },
    ];
    const cols = [sc('a', 'number', 'measure'), sc('b', 'number', 'measure'), sc('note', 'string', 'text')];
    const s = detectSuspicions(cols, rows).find((x) => x.kind === 'row_all_measures_missing');
    expect(s).toMatchObject({ count: 1 });
  });

  it('conditional_missing — thiếu có cấu trúc theo nhóm phân loại', () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => ({ status: 'paid', paid_at: i === 0 ? '' : '2024-01-02', note: i % 4 === 0 ? '' : 'x' })),
      ...Array.from({ length: 10 }, (_, i) => ({ status: 'pending', paid_at: '', note: i % 4 === 0 ? '' : 'y' })),
      ...Array.from({ length: 10 }, (_, i) => ({ status: 'cancelled', paid_at: null, note: i % 4 === 0 ? '' : 'z' })),
    ];
    const cols = [sc('status', 'string', 'category'), sc('paid_at', 'date', 'datetime'), sc('note', 'string', 'text')];
    const out = detectSuspicions(cols, rows).filter((x) => x.kind === 'conditional_missing');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ column: 'paid_at', count: 21 });
    expect(out[0]?.message).toContain('20/21');
  });

  it('missing_in_filled_group — ô trống ở nhóm gần như luôn có giá trị', () => {
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => ({ status: 'paid', paid_at: i === 0 ? '' : '2024-01-02' })),
      ...Array.from({ length: 10 }, () => ({ status: 'pending', paid_at: '' })),
    ];
    const cols = [sc('status', 'string', 'category'), sc('paid_at', 'date', 'datetime')];
    const out = detectSuspicions(cols, rows).filter((x) => x.kind === 'missing_in_filled_group');
    expect(out).toHaveLength(1);
    expect(out[0]?.count).toBe(1);
  });

  it('mọi loại Nghi vấn đều có kind + message + recommendation', () => {
    const rows = ['NA', ' x', 'hanoi', 'Hanoi', '123', '1.200,50'].map((v, i) => ({ s: v, n: i }));
    const cols = [sc('s', 'string', 'category'), sc('n', 'number', 'measure')];
    for (const s of detectSuspicions(cols, rows)) {
      expect(typeof s.kind).toBe('string');
      expect(s.message.length).toBeGreaterThan(0);
      expect(s.recommendation.length).toBeGreaterThan(0);
      expect(s.count).toBeGreaterThan(0);
    }
  });
});

describe('GĐ2.5 — che PII theo vai trò trong ví dụ Nghi vấn', () => {
  it('cột đánh dấu PII → giá trị thật trong ví dụ bị che', () => {
    const rows = ['  x  ', 'y'].map((v) => ({ s: v }));
    const pii = detectSuspicions([sc('s', 'string', 'category', true)], rows).find((x) => x.kind === 'whitespace');
    expect(pii?.examples.join(' ')).not.toContain('x');
    expect(pii?.examples.join(' ')).toContain('***');
  });

  it('cột vai trò identifier/text → giá trị thành dạng mẫu', () => {
    expect(toShapePattern('Hanoi 12')).toBe('Aaaaa dd');
    expect(maskForAi('Binh An', { markedPii: false, role: 'text' })?.value).toBe('Aaaa Aa');
    expect(maskForAi('Binh An', { markedPii: false, role: null })?.value).toBe('Binh An');
  });

  it('giá trị rỗng / null → không có mẫu để che', () => {
    expect(maskForAi(null, { markedPii: false })).toBeNull();
    expect(maskForAi('   ', { markedPii: false })).toBeNull();
  });
});

describe('GĐ2.6 — đồng bộ DQ-01 / mô tả / cân bằng', () => {
  it('mô tả cột chữ: "NA" là một giá trị hợp lệ (đồng bộ DQ-03)', () => {
    const d = describeColumn('s', 'string', ['NA', 'x', '']);
    expect(d.count).toBe(2);
    expect(d.missingCount).toBe(1);
    expect(d.invalidCount).toBe(0);
  });

  it('cân bằng nhãn chữ: "NA" là một lớp, không phải dòng thiếu', () => {
    const im = evaluateImbalance('country', 'string', ['IN', 'NA', 'VN', 'NA'].map((country) => ({ country })));
    expect(im).toMatchObject({ status: 'evaluated', classCount: 3, missingLabelRows: 0, validRows: 4 });
  });

  it('mô tả cột ngày dùng thứ tự DD/MM đã phân định', () => {
    const d = describeColumn('d', 'date', ['23/04/2019', '25/04/2019']);
    expect(d.invalidCount).toBe(0);
    expect(d.count).toBe(2);
  });
});
