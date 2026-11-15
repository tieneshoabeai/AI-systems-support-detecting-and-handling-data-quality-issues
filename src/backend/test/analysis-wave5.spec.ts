import { computeDq0102, computeDq03, detectOutliers, isMissingCell, isValidByType } from '../src/modules/analysis/domain/dq.util';
import { describeColumn, evaluateImbalance, analyzeTime } from '../src/modules/analysis/domain/stats.util';
import * as fs from 'fs';
import * as path from 'path';

describe('Wave5 DQ-01: thieu chi la null/rong/whitespace', () => {
  it('0/false/NA-chuoi khong phai thieu', () => {
    expect(isMissingCell(0)).toBe(false);
    expect(isMissingCell(false)).toBe(false);
    expect(isMissingCell('NA')).toBe(false);
    expect(isMissingCell('null')).toBe(false);
    expect(isMissingCell(null)).toBe(true);
    expect(isMissingCell('   ')).toBe(true);
  });
  it('rong toan bo -> bao no_data, khong tra ty le 0%', () => {
    const out = computeDq0102(['a'], []);
    expect(out.columns[0]?.reason).toBe('no_data_to_evaluate');
    expect(out.columns[0]?.missingRate).toBeNull();
  });
  it('dem thieu theo cot + dong thieu 1 phan/toan bo', () => {
    const rows = [
      { rowIndex: 0, values: { a: 'x', b: 'y' } },
      { rowIndex: 1, values: { a: '', b: 'y' } },
      { rowIndex: 2, values: { a: '', b: '' } },
    ];
    const out = computeDq0102(['a', 'b'], rows);
    expect(out.columns.find((c) => c.column === 'a')?.missingCount).toBe(2);
    expect(out.fullyMissingRows).toBe(1);
    expect(out.partiallyMissingRows).toBe(1);
  });
});

describe('Wave5 DQ-02: trung khop chinh xac, loai dong thieu toan bo', () => {
  it('dong thieu toan bo khong gom nhom', () => {
    const rows = [
      { rowIndex: 0, values: { a: '', b: '' } },
      { rowIndex: 1, values: { a: '', b: '' } },
      { rowIndex: 2, values: { a: 'x', b: 'y' } },
      { rowIndex: 3, values: { a: 'x', b: 'y' } },
    ];
    const out = computeDq0102(['a', 'b'], rows);
    expect(out.duplicateGroups).toHaveLength(1);
    expect(out.duplicateGroups[0]?.rowIndexes).toEqual([2, 3]);
    expect(out.duplicateRowCount).toBe(1);
  });
  it('nhom co du lieu thieu 1 phan ghi chu rieng', () => {
    const rows = [
      { rowIndex: 0, values: { a: 'x', b: '' } },
      { rowIndex: 1, values: { a: 'x', b: '' } },
    ];
    const out = computeDq0102(['a', 'b'], rows);
    expect(out.duplicateGroups[0]?.hasPartialMissing).toBe(true);
  });
});

describe('Wave5 DQ-03: sai kieu theo data_type, khong dem thieu', () => {
  it('so khong parse duoc la invalid, o thieu khong phai loi kieu', () => {
    expect(isValidByType('', 'number').valid).toBe(true);
    expect(isValidByType('abc', 'number').valid).toBe(false);
    expect(isValidByType('12.5', 'number').valid).toBe(true);
  });
  it('mau so 0 -> invalidRate null', () => {
    const out = computeDq03([{ column: 'a', dataType: 'number' }], []);
    expect(out[0]?.invalidRate).toBeNull();
  });
});

describe('Wave5 DQ-04: IQR 1.5x/3x + Modified Z 3.5, IQR=0/MAD=0 khong ket luan', () => {
  it('hang so -> bao khong du phan tan', () => {
    const vals = Array.from({ length: 6 }, (_, i) => ({ rowIndex: i, value: 5 }));
    const out = detectOutliers('x', vals, 'both');
    expect(out.iqrDispersionOk).toBe(false);
    expect(out.madDispersionOk).toBe(false);
    expect(out.union).toHaveLength(0);
  });
  it('mau < 4 -> insufficient', () => {
    const out = detectOutliers('x', [{ rowIndex: 0, value: 1 }], 'iqr');
    expect(out.reason).toMatch(/insufficient/);
  });
  it('tach tap chi-iqr, chi-z va giao', () => {
    const vals = [10, 11, 10, 12, 11, 10, 12, 11, 10, 100].map((value, rowIndex) => ({ rowIndex, value }));
    const out = detectOutliers('x', vals, 'both');
    expect(out.union.length).toBeGreaterThan(0);
    expect(out.intersection.length).toBeLessThanOrEqual(out.union.length);
  });
});

describe('Wave5 ANALYSIS-04/06/07: mo ta / can bang / thoi gian', () => {
  it('mo ta so: mean/median/min/max tren gia tri hop le', () => {
    const s = describeColumn('n', 'number', [1, 2, 3, '', 'abc']);
    expect(s.count).toBe(3);
    expect(s.missingCount).toBe(1);
    expect(s.invalidCount).toBe(1);
    expect(s.mean).toBeCloseTo(2, 4);
  });
  it('chua chon nhan -> no_label; nhan so -> not_applicable', () => {
    expect(evaluateImbalance(null, null, []).status).toBe('no_label');
    expect(evaluateImbalance('age', 'number', [{ age: 1 }]).status).toBe('not_applicable_continuous');
  });
  it('IR >= 3 canh bao', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => ({ g: 'A' })),
      { g: 'B' },
    ];
    const out = evaluateImbalance('g', 'string', rows);
    expect(out.status).toBe('evaluated');
    expect(out.imbalanceRatio).toBe(9);
    expect(out.warning).toMatch(/gte_3/);
  });
  it('khong co cot thoi gian -> no_time_column, khong tu suy', () => {
    const out = analyzeTime(null, null, []);
    expect(out.status).toBe('no_time_column');
  });
  it('ky trong co recordCount 0, khong noi suy', () => {
    const out = analyzeTime('d', null, [{ d: '2026-01-01' }, { d: '2026-01-03' }], 'day');
    expect(out.status).toBe('evaluated');
    expect(out.buckets.find((b) => b.period === '2026-01-02')?.recordCount).toBe(0);
  });
});

describe('Wave5 I13: API khong chua ma sinh PDF', () => {
  it('report.controller khong import pdfkit/puppeteer', () => {
    const p = path.resolve(__dirname, '../src/modules/analysis/infrastructure/http/report.controller.ts');
    const src = fs.readFileSync(p, 'utf8').toLowerCase();
    expect(src).not.toMatch(/pdfkit|puppeteer|pdf-lib|html-pdf/);
  });
  it('report sinh file o worker service, khong o controller', () => {
    const worker = fs.readFileSync(path.resolve(__dirname, '../src/modules/analysis/application/report-worker.service.ts'), 'utf8');
    expect(worker).toMatch(/uploadStream/);
    const ctrl = fs.readFileSync(path.resolve(__dirname, '../src/modules/analysis/infrastructure/http/report.controller.ts'), 'utf8');
    expect(ctrl).not.toMatch(/uploadStream/);
  });
});
