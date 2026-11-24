/**
 * GĐ7 — Ghi đè vai trò cột (`column_roles`) + phân rã ngoại lệ + skewness.
 *
 * Port từ `Vqd_BE` (Đợt F/G/H) nhưng test trực tiếp các hàm thuần trong
 * `domain/` — đúng kiểu unit test của wave5 hiện có.
 *
 * Ba nhóm kiểm thử:
 * 1. `inferColumnRoles()` — áp ghi đè của người dùng lên vai trò hệ thống.
 * 2. `sanitizeColumnRoles()` — chuẩn hoá map đọc từ Mongo (Mixed).
 * 3. `skewnessOf()` + `detectOutliers()` — số liệu giải thích cho DQ-04.
 */
import {
  ANALYSIS_ROLES,
  inferColumnRoles,
  isRoleAllowedForType,
} from '../../../src/modules/analysis/domain/column-role.util';
import { skewnessOf } from '../../../src/modules/analysis/domain/stats.util';
import { detectOutliers } from '../../../src/modules/analysis/domain/dq.util';

describe('GĐ7.1 — inferColumnRoles: vai trò do hệ thống suy (OPEN-06 — không còn ghi đè thủ công)', () => {
  const cols = [
    { key: 'c0', name: 'ma_so', dataType: 'number' },
    { key: 'c1', name: 'ten_san_pham', dataType: 'string' },
    { key: 'c2', name: 'so_luong', dataType: 'number' },
  ];

  it('không có ghi đè → vai trò do hệ thống suy, source = "system"', () => {
    const roles = inferColumnRoles(cols, []);
    expect(roles).toHaveLength(3);
    for (const r of roles) {
      expect(r.source).toBe('system');
      expect(r.reason).not.toBe('user_override');
    }
  });

  it('cột tên gợi ý định danh + dữ liệu duy nhất → identifier', () => {
    const cols = [
      { key: 'c0', name: 'review_id', dataType: 'string' },
      { key: 'c1', name: 'so_luong', dataType: 'number' },
    ];
    const rows = [
      { review_id: 'r1', so_luong: 5 },
      { review_id: 'r2', so_luong: 6 },
    ];
    const roles = inferColumnRoles(cols, rows);
    expect(roles.find((r) => r.key === 'c0')?.role).toBe('identifier');
    expect(roles.find((r) => r.key === 'c1')?.role).toBe('measure');
  });

  it('cột số nguyên lặp lại ít → category (uncertain)', () => {
    const rows = Array.from({ length: 10 }, () => ({
      ma_so: 1,
      ten_san_pham: 'A',
      so_luong: 3,
    }));
    const roles = inferColumnRoles(cols, rows);
    expect(roles.find((r) => r.key === 'c2')?.role).toBe('category');
  });
});

describe('GĐ7.2 — isRoleAllowedForType: vai trò phải khớp kiểu dữ liệu', () => {
  it('measure chỉ hợp lệ với cột number', () => {
    expect(isRoleAllowedForType('measure', 'number')).toBe(true);
    expect(isRoleAllowedForType('measure', 'string')).toBe(false);
    expect(isRoleAllowedForType('measure', 'date')).toBe(false);
  });

  it('datetime chỉ hợp lệ với cột date', () => {
    expect(isRoleAllowedForType('datetime', 'date')).toBe(true);
    expect(isRoleAllowedForType('datetime', 'string')).toBe(false);
    expect(isRoleAllowedForType('datetime', 'number')).toBe(false);
  });

  it('identifier / category / text không hợp lệ với cột date', () => {
    expect(isRoleAllowedForType('identifier', 'date')).toBe(false);
    expect(isRoleAllowedForType('category', 'date')).toBe(false);
    expect(isRoleAllowedForType('text', 'date')).toBe(false);
    expect(isRoleAllowedForType('identifier', 'number')).toBe(true);
    expect(isRoleAllowedForType('text', 'string')).toBe(true);
  });

  it('enum ANALYSIS_ROLES đúng 5 giá trị', () => {
    expect([...ANALYSIS_ROLES].sort()).toEqual([
      'category',
      'datetime',
      'identifier',
      'measure',
      'text',
    ]);
  });
});

describe('GĐ7.4 — skewnessOf: độ lệch mẫu để giải thích DQ-04', () => {
  it('mẫu < 4 giá trị → null (không đủ tin cậy)', () => {
    expect(skewnessOf([])).toBeNull();
    expect(skewnessOf([1])).toBeNull();
    expect(skewnessOf([1, 2, 3])).toBeNull();
  });

  it('tất cả giá trị bằng nhau → null (không có phân tán)', () => {
    expect(skewnessOf([5, 5, 5, 5, 5])).toBeNull();
  });

  it('phân phối đối xứng → skewness ≈ 0', () => {
    const sk = skewnessOf([1, 2, 3, 4, 5]);
    expect(sk).not.toBeNull();
    expect(Math.abs(sk as number)).toBeLessThan(0.01);
  });

  it('phân phối lệch phải → skewness > 0', () => {
    const sk = skewnessOf([1, 1, 1, 1, 1, 1, 1, 1, 20]);
    expect(sk).not.toBeNull();
    expect(sk as number).toBeGreaterThan(0);
  });

  it('phân phối lệch trái → skewness < 0', () => {
    const sk = skewnessOf([-20, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(sk).not.toBeNull();
    expect(sk as number).toBeLessThan(0);
  });
});

describe('GĐ7.5 — detectOutliers: phân rã theo phương pháp', () => {
  // 10 giá trị "bình thường" + 1 cực đại (100) + 1 lệch vừa (20).
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 100].map((value, i) => ({
    rowIndex: i,
    value,
  }));

  it('method=iqr → chỉ tính IQR, zscore không đóng góp', () => {
    const out = detectOutliers('c', values, 'iqr');
    expect(out.iqrOutliers.length).toBeGreaterThan(0);
    expect(out.zOutliers).toEqual([]);
    // Hành vi cố ý (giữ nguyên từ Vqd_BE): khi chỉ dùng **một** phương pháp,
    // `intersection` = `union` (tức "số ngoại lệ mà phương pháp đang dùng chỉ ra").
    // Nhờ vậy `breakdown.both` luôn có số để hiển thị, kể cả khi phương pháp
    // được cấu hình là `iqr` hoặc `modified_zscore`.
    expect(out.intersection).toEqual(out.union);
  });

  it('method=modified_zscore → chỉ tính Modified-Z', () => {
    const out = detectOutliers('c', values, 'modified_zscore');
    expect(out.zOutliers.length).toBeGreaterThan(0);
    expect(out.iqrOutliers).toEqual([]);
  });

  it('method=both → giao của IQR và Z được tính', () => {
    const out = detectOutliers('c', values, 'both');
    expect(out.iqrOutliers.length).toBeGreaterThan(0);
    expect(out.zOutliers.length).toBeGreaterThan(0);
    // Giao = các giá trị mà CẢ HAI phương pháp đều chỉ ra.
    expect(out.intersection.length).toBeLessThanOrEqual(Math.min(out.iqrOutliers.length, out.zOutliers.length));
    for (const r of out.intersection) {
      expect(out.iqrOutliers).toContain(r);
      expect(out.zOutliers).toContain(r);
    }
  });

  it('iqrExtreme (ngưỡng 3×IQR) là tập con của iqr (ngưỡng 1.5×IQR)', () => {
    const out = detectOutliers('c', values, 'both');
    for (const r of out.iqrExtremeOutliers) {
      expect(out.iqrOutliers).toContain(r);
    }
  });

  it('union = hợp của IQR và Z', () => {
    const out = detectOutliers('c', values, 'both');
    const union = new Set([...out.iqrOutliers, ...out.zOutliers]);
    expect(new Set(out.union)).toEqual(union);
  });

  it('mẫu < 4 quan sát → không kết luận, reason rõ ràng', () => {
    const out = detectOutliers(
      'c',
      [
        { rowIndex: 0, value: 1 },
        { rowIndex: 1, value: 2 },
        { rowIndex: 2, value: 3 },
      ],
      'both',
    );
    expect(out.reason).toBe('insufficient_observations_min_4');
    expect(out.union).toEqual([]);
    expect(out.iqrDispersionOk).toBe(false);
    expect(out.madDispersionOk).toBe(false);
  });

  it('IQR = 0 (mọi giá trị bằng nhau) → không kết luận outlier', () => {
    const out = detectOutliers(
      'c',
      [1, 1, 1, 1, 1].map((value, i) => ({ rowIndex: i, value })),
      'iqr',
    );
    expect(out.iqrDispersionOk).toBe(false);
    expect(out.reason).toBe('iqr_zero_insufficient_dispersion');
    expect(out.union).toEqual([]);
  });
});
