/**
 * OPEN-10 — **Quy ước số học** (chuẩn khoa học dữ liệu) + **ngưỡng cảnh báo**.
 *
 * Quyết định:
 * - Variance / độ lệch chuẩn: dùng **mẫu** (n−1).
 * - Quartile: nội suy **type 7** (chính là `simple-statistics` `ss.quantile`).
 * - Skewness: **mẫu** (`ss.sampleSkewness`).
 * - **Giữ nguyên** bộ ngưỡng cảnh báo hiện có (`impact.util.ts`):
 *   - DQ-01 / DQ-03: < 1% thấp; 1%–10% trung bình; > 10% cao.
 *   - DQ-02: < 0,5% thấp; 0,5%–5% trung bình; > 5% cao.
 *   - DQ-04: chỉ vượt IQR 1,5× thấp; vượt IQR 3× hoặc Modified Z > 3,5 trung bình;
 *     cả hai phương pháp cùng đánh dấu ⇒ cao.
 *
 * File này là **"khoá"** các quy ước này bằng test ⇒ đổi công thức sai sẽ
 * bị phát hiện ngay, không âm thầm làm lệch kết quả phân tích.
 */
import * as ss from 'simple-statistics';
import { describeColumn, skewnessOf } from '../src/modules/analysis/domain/stats.util';
import { detectOutliers } from '../src/modules/analysis/domain/dq.util';
import {
  outlierSeverity,
  rateSeverity,
  THRESHOLDS,
  type OutlierBreakdown,
} from '../src/modules/analysis/domain/impact.util';

describe('OPEN-10 — Độ lệch chuẩn & phương sai dùng MẪU (n−1)', () => {
  it('describeColumn().stdev khớp ss.sampleStandardDeviation (không phải ss.standardDeviation)', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const stat = describeColumn('x', 'number', values);

    // Mẫu (n−1): sd = 2,13809...
    expect(stat.stdev).toBeCloseTo(ss.sampleStandardDeviation(values), 4);
    // Toàn bộ (n): sd = 2,0 — khác mẫu ⇒ test này thực sự phân biệt 2 cách.
    expect(stat.stdev).not.toBeCloseTo(ss.standardDeviation(values), 4);
  });

  it('mẫu 2 phần tử: stdev = |a−b| / √2', () => {
    const stat = describeColumn('x', 'number', [10, 20]);
    expect(stat.stdev).toBeCloseTo(Math.sqrt(50), 4);
  });

  it('mẫu 1 phần tử: stdev = 0 (không NaN)', () => {
    const stat = describeColumn('x', 'number', [42]);
    expect(stat.stdev).toBe(0);
  });

  it('mẫu đều (tất cả bằng nhau): stdev = 0', () => {
    const stat = describeColumn('x', 'number', [5, 5, 5, 5]);
    expect(stat.stdev).toBe(0);
  });

  it('mẫu rỗng: stdev = null (kèm reason)', () => {
    const stat = describeColumn('x', 'number', []);
    expect(stat.stdev).toBeNull();
    expect(stat.reason).toBe('no_data_to_evaluate');
  });
});

describe('OPEN-10 — Quartile nội suy type 7', () => {
  it('q1/q3 khớp ss.quantile (type 7) trên mẫu 1..9', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const stat = describeColumn('x', 'number', values);

    // type 7: pos = (n−1)·q ⇒ q1 = 3, q3 = 7
    expect(stat.q1).toBeCloseTo(ss.quantile(values, 0.25), 4);
    expect(stat.q3).toBeCloseTo(ss.quantile(values, 0.75), 4);
    expect(stat.q1).toBe(3);
    expect(stat.q3).toBe(7);
  });

  it('mẫu chẵn (1..8): q1 = 2.75, q3 = 6.25 (nội suy, không phải trung vị của nửa)', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8];
    const stat = describeColumn('x', 'number', values);

    expect(stat.q1).toBeCloseTo(2.75, 4);
    expect(stat.q3).toBeCloseTo(6.25, 4);
    // Phân biệt với cách "trung vị nửa dưới" (3 và 6).
    expect(stat.q1).not.toBe(3);
    expect(stat.q3).not.toBe(6);
  });
});

describe('OPEN-10 — Skewness dùng MẪU', () => {
  it('skewnessOf khớp ss.sampleSkewness', () => {
    const values = [1, 1, 1, 1, 10];
    expect(skewnessOf(values)).toBeCloseTo(ss.sampleSkewness(values), 4);
  });

  it('phân phối lệch phải ⇒ skewness > 0', () => {
    expect(skewnessOf([1, 1, 1, 1, 10])).toBeGreaterThan(0);
  });

  it('phân phối đối xứng ⇒ skewness ≈ 0', () => {
    expect(skewnessOf([1, 2, 3, 4, 5])).toBeCloseTo(0, 4);
  });

  it('< 4 quan sát ⇒ null (mẫu quá nhỏ)', () => {
    expect(skewnessOf([1, 2, 3])).toBeNull();
  });

  it('tất cả bằng nhau (sd = 0) ⇒ null (không có phân tán để lệch)', () => {
    expect(skewnessOf([3, 3, 3, 3, 3])).toBeNull();
  });
});

describe('OPEN-10 — Ngưỡng cảnh báo DQ-01/02/03 (giữ nguyên)', () => {
  it('DQ-01: < 1% thấp; 1%–10% trung bình; > 10% cao', () => {
    expect(rateSeverity('DQ-01', 0)).toBe('low');
    expect(rateSeverity('DQ-01', 0.0099)).toBe('low');
    expect(rateSeverity('DQ-01', 0.01)).toBe('medium');
    expect(rateSeverity('DQ-01', 0.1)).toBe('medium');
    expect(rateSeverity('DQ-01', 0.1001)).toBe('high');
  });

  it('DQ-02: < 0,5% thấp; 0,5%–5% trung bình; > 5% cao', () => {
    expect(rateSeverity('DQ-02', 0.0049)).toBe('low');
    expect(rateSeverity('DQ-02', 0.005)).toBe('medium');
    expect(rateSeverity('DQ-02', 0.05)).toBe('medium');
    expect(rateSeverity('DQ-02', 0.0501)).toBe('high');
  });

  it('DQ-03: cùng ngưỡng với DQ-01', () => {
    expect(rateSeverity('DQ-03', 0.0099)).toBe('low');
    expect(rateSeverity('DQ-03', 0.05)).toBe('medium');
    expect(rateSeverity('DQ-03', 0.11)).toBe('high');
  });

  it('rate null / undefined / NaN ⇒ no_data (không áp ngưỡng)', () => {
    expect(rateSeverity('DQ-01', null)).toBe('no_data');
    expect(rateSeverity('DQ-01', undefined)).toBe('no_data');
    expect(rateSeverity('DQ-01', Number.NaN)).toBe('no_data');
  });

  it('THRESHOLDS mô tả đúng 4 quy tắc + DQ-05 chưa đánh giá', () => {
    const byDq = new Map(THRESHOLDS.map((t) => [t.dq, t.rule]));
    expect(byDq.get('DQ-01')).toContain('1%');
    expect(byDq.get('DQ-02')).toContain('0,5%');
    expect(byDq.get('DQ-04')).toContain('IQR');
    expect(byDq.get('DQ-05')).toContain('Chưa đánh giá');
  });
});

describe('OPEN-10 — Ngưỡng DQ-04 theo phương pháp đánh dấu', () => {
  const breakdown = (o: Partial<OutlierBreakdown>): OutlierBreakdown => ({
    iqr: 0,
    iqrExtreme: 0,
    zscore: 0,
    both: 0,
    ...o,
  });

  it('cả 2 phương pháp cùng đánh dấu ⇒ cao', () => {
    expect(outlierSeverity(breakdown({ iqr: 1, both: 1 }))).toBe('high');
    expect(outlierSeverity(breakdown({ zscore: 1, both: 1 }))).toBe('high');
  });

  it('chỉ IQR 1,5× ⇒ thấp', () => {
    expect(outlierSeverity(breakdown({ iqr: 1 }))).toBe('low');
  });

  it('IQR 3× hoặc Modified Z > 3,5 ⇒ trung bình', () => {
    expect(outlierSeverity(breakdown({ iqrExtreme: 1 }))).toBe('medium');
    expect(outlierSeverity(breakdown({ zscore: 1 }))).toBe('medium');
  });

  it('không có điểm nào ⇒ null (không phải vấn đề)', () => {
    expect(outlierSeverity(breakdown({}))).toBeNull();
    expect(outlierSeverity(null)).toBeNull();
    expect(outlierSeverity(undefined)).toBeNull();
  });
});

describe('OPEN-10 — DQ-04: ngưỡng IQR 1,5× / 3× và Modified Z-score 3,5', () => {
  // Bộ dữ liệu: 1..9 + 1 ngoại lệ rõ ràng (100).
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];

  it('IQR 1,5× đánh dấu giá trị 100', () => {
    const res = detectOutliers(
      'x',
      rows.map((v, i) => ({ rowIndex: i, value: v })),
      'iqr',
    );
    expect(res.iqrOutliers).toContain(9);
    expect(res.iqrExtremeOutliers).toContain(9);
    expect(res.iqrOutliers).not.toContain(0);
  });

  it('Modified Z-score 3,5 đánh dấu giá trị 100', () => {
    const res = detectOutliers(
      'x',
      rows.map((v, i) => ({ rowIndex: i, value: v })),
      'modified_zscore',
    );
    expect(res.zOutliers).toContain(9);
    expect(res.zOutliers).not.toContain(0);
  });

  it('< 4 quan sát ⇒ không kết luận (reason = insufficient_observations_min_4)', () => {
    const res = detectOutliers(
      'x',
      [1, 2, 3].map((v, i) => ({ rowIndex: i, value: v })),
      'both',
    );
    expect(res.reason).toBe('insufficient_observations_min_4');
    expect(res.iqrOutliers).toEqual([]);
    expect(res.zOutliers).toEqual([]);
  });

  it('IQR = 0 (dữ liệu phần lớn bằng nhau) ⇒ không kết luận ngoại lệ', () => {
    const res = detectOutliers(
      'x',
      [1, 1, 1, 1, 1, 1, 1, 1, 50].map((v, i) => ({ rowIndex: i, value: v })),
      'iqr',
    );
    expect(res.iqrDispersionOk).toBe(false);
    expect(res.reason).toBe('iqr_zero_insufficient_dispersion');
    expect(res.iqrOutliers).toEqual([]);
  });

  it('MAD = 0 ⇒ không kết luận theo Modified Z-score', () => {
    const res = detectOutliers(
      'x',
      [1, 1, 1, 1, 1, 1, 1, 1, 50].map((v, i) => ({ rowIndex: i, value: v })),
      'modified_zscore',
    );
    expect(res.madDispersionOk).toBe(false);
    expect(res.reason).toContain('mad_zero_insufficient_dispersion');
    expect(res.zOutliers).toEqual([]);
  });
});
