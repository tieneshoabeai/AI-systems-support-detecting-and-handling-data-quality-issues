/**
 * GĐ6 — Dữ liệu biểu đồ (E1): histogram / box plot / Top N.
 *
 * Bao phủ:
 *  - Cột số → histogram + box plot.
 *  - Cột phân loại → Top N + nhóm "Khác".
 *  - Tỷ lệ thiếu (không tự điền 0).
 *  - `top_n` mặc định 5, giới hạn 1–20.
 *  - Cột `date` chỉ báo tỷ lệ thiếu.
 *  - Bộ lọc theo `columns` (key / tên hiển thị / tên gốc).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { RECORD_QUERY_PORT } from '../src/modules/datasets/domain/ports/record-query.port';
import { DATASET_REPOSITORY_PORT } from '../src/modules/datasets/domain/ports/dataset.repository.port';
import {
  boxPlot,
  categoryTopN,
  clampChartTopN,
  histogram,
} from '../src/shared/domain/utils/chart-data.util';
import { DataViewService } from '../src/modules/data-view/data-view.service';

const datasetId = new Types.ObjectId().toHexString();

const mockDataset = {
  id: datasetId,
  projectId: new Types.ObjectId().toHexString(),
  workspaceId: new Types.ObjectId().toHexString(),
  name: 'sales',
  originalFileName: 'sales.csv',
  fileFormat: 'csv',
  fileSizeBytes: 100,
  fileChecksum: 'abc',
  rowCount: 10,
  columnCount: 4,
  columns: [
    { key: 'c0', index: 0, name: 'amount', dataType: 'number', originalName: 'Amount', missingCount: 0, isPii: false },
    { key: 'c1', index: 1, name: 'customer', dataType: 'string', originalName: 'Customer', missingCount: 0, isPii: false },
    { key: 'c2', index: 2, name: 'active', dataType: 'boolean', originalName: 'Active', missingCount: 0, isPii: false },
    { key: 'c3', index: 3, name: 'created_at', dataType: 'date', originalName: 'Created At', missingCount: 0, isPii: false },
  ],
  columnIssues: [],
  hasHeader: true,
  delimiter: ',',
  currentVersion: 1,
  status: 'READY',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('GĐ6 — chart-data.util (hàm thuần)', () => {
  it('histogram trả null khi không có giá trị hợp lệ', () => {
    expect(histogram('c0', [])).toBeNull();
    expect(histogram('c0', [NaN, Infinity])).toBeNull();
  });

  it('histogram một giá trị duy nhất -> method single_value', () => {
    const h = histogram('c0', [5]);
    expect(h?.method).toBe('single_value');
    expect(h?.bins).toHaveLength(1);
    expect(h?.bins[0]?.count).toBe(1);
  });

  it('histogram chia khoang theo Freedman-Diaconis, tong count = n', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const h = histogram('c0', values);
    expect(h).not.toBeNull();
    expect(h!.bins.length).toBeGreaterThan(1);
    expect(h!.bins.reduce((s, b) => s + b.count, 0)).toBe(100);
    // Khoang phải liên tục, tăng dần
    for (let i = 1; i < h!.bins.length; i++) {
      expect(h!.bins[i]!.from).toBeGreaterThanOrEqual(h!.bins[i - 1]!.to);
    }
  });

  it('histogram IQR = 0 -> fallback Sturges', () => {
    const h = histogram('c0', [1, 1, 1, 1, 1, 1, 1, 1]);
    // 8 giá trị bằng nhau -> min==max -> single_value
    expect(h?.method).toBe('single_value');
  });

  it('boxPlot tra tu phan va so diem ngoai rao', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
    const bp = boxPlot('c0', values);
    expect(bp).not.toBeNull();
    expect(bp!.n).toBe(10);
    expect(bp!.q1).toBeLessThanOrEqual(bp!.median);
    expect(bp!.median).toBeLessThanOrEqual(bp!.q3);
    // 1000 là ngoài rao
    expect(bp!.outsideCount).toBeGreaterThan(0);
  });

  it('boxPlot null khi rong', () => {
    expect(boxPlot('c0', [])).toBeNull();
  });

  it('categoryTopN gom phan con lai vao "Khac"', () => {
    const values = ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'e'];
    const cat = categoryTopN('c1', values, 2);
    expect(cat).not.toBeNull();
    expect(cat!.items.map((i) => i.value)).toEqual(['a', 'b']);
    expect(cat!.items[0]!.count).toBe(3);
    expect(cat!.items[0]!.rate).toBeCloseTo(3 / 8, 4);
    // Phần còn lại (c, d, e) = 3
    expect(cat!.other).not.toBeNull();
    expect(cat!.other!.count).toBe(3);
    expect(cat!.other!.rate).toBeCloseTo(3 / 8, 4);
    expect(cat!.distinctCount).toBe(5);
  });

  it('categoryTopN null khi rong', () => {
    expect(categoryTopN('c1', [], 5)).toBeNull();
  });

  it('clampChartTopN giu khoang 1..20, mac dinh 5', () => {
    expect(clampChartTopN(undefined)).toBe(5);
    expect(clampChartTopN(0)).toBe(1);
    expect(clampChartTopN(100)).toBe(20);
    expect(clampChartTopN(7)).toBe(7);
    expect(clampChartTopN('abc')).toBe(5);
  });
});

describe('GĐ6 — DataViewService.getChartData', () => {
  let handler: DataViewService;
  let records: { getColumnValues: jest.Mock };
  let datasetsPort: { findById: jest.Mock };

  const columnValues = (key: string, values: unknown[], total = values.length) => ({
    columnKey: key,
    values,
    totalRecords: total,
    sampledRecords: values.length,
    truncated: total > values.length,
  });

  beforeEach(async () => {
    records = {
      getColumnValues: jest.fn().mockImplementation(async (_ds: string, key: string) => {
        switch (key) {
          case 'c0':
            return columnValues('c0', [10, 20, 30, 40, 50, null]);
          case 'c1':
            return columnValues('c1', ['A', 'A', 'B', 'C', 'D', 'E']);
          case 'c2':
            return columnValues('c2', [true, false, true, null]);
          case 'c3':
            return columnValues('c3', [new Date(), null]);
          default:
            return columnValues(key, []);
        }
      }),
    };
    datasetsPort = { findById: jest.fn().mockResolvedValue(mockDataset) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataViewService,
        { provide: RECORD_QUERY_PORT, useValue: records },
        { provide: DATASET_REPOSITORY_PORT, useValue: datasetsPort },
      ],
    }).compile();

    handler = module.get(DataViewService);
  });

  it('ID dataset khong hop le -> ValidationError', async () => {
    await expect(handler.getChartData('khong-hop-le')).rejects.toThrow(/ID Tap du lieu khong hop le/);
  });

  it('dataset khong ton tai -> NotFoundError', async () => {
    datasetsPort.findById.mockResolvedValueOnce(null);
    await expect(handler.getChartData(datasetId)).rejects.toThrow(/Khong tim thay tap du lieu/);
  });

  it('cot so -> histogram + box_plot', async () => {
    const charts = await handler.getChartData(datasetId, { columns: ['c0'] });
    expect(charts).toHaveLength(1);
    const c = charts[0]!;
    expect(c.column_key).toBe('c0');
    expect(c.data_type).toBe('number');
    expect(c.histogram).toBeDefined();
    expect(c.box_plot).toBeDefined();
    expect(c.box_plot!.n).toBe(5);
    expect(c.category).toBeUndefined();
  });

  it('cot phan loai -> category Top N, khong co histogram', async () => {
    const charts = await handler.getChartData(datasetId, { columns: ['c1'], topN: 2 });
    const c = charts[0]!;
    expect(c.category).toBeDefined();
    expect(c.category!.top_n).toBe(2);
    expect(c.category!.items).toHaveLength(2);
    expect(c.category!.other).not.toBeNull();
    expect(c.histogram).toBeUndefined();
    expect(c.box_plot).toBeUndefined();
  });

  it('cot boolean -> category', async () => {
    const charts = await handler.getChartData(datasetId, { columns: ['c2'] });
    expect(charts[0]!.category).toBeDefined();
    expect(charts[0]!.category!.items.map((i) => i.value).sort()).toEqual(['false', 'true']);
  });

  it('cot date -> chi ty le thieu, khong co bieu do', async () => {
    const charts = await handler.getChartData(datasetId, { columns: ['c3'] });
    const c = charts[0]!;
    expect(c.data_type).toBe('date');
    expect(c.histogram).toBeUndefined();
    expect(c.box_plot).toBeUndefined();
    expect(c.category).toBeUndefined();
    expect(c.missing_count).toBe(1);
  });

  it('ty le thieu: dem gia tri null, khong tu dien 0', async () => {
    const charts = await handler.getChartData(datasetId, { columns: ['c0'] });
    const c = charts[0]!;
    expect(c.sampled_records).toBe(6);
    expect(c.missing_count).toBe(1);
    expect(c.missing_ratio).toBeCloseTo(1 / 6, 5);
  });

  it('top_n mac dinh = 5', async () => {
    const charts = await handler.getChartData(datasetId, { columns: ['c1'] });
    expect(charts[0]!.category!.top_n).toBe(5);
  });

  it('loc cot theo ten hien thi va ten goc', async () => {
    const byDisplay = await handler.getChartData(datasetId, { columns: ['amount'] });
    expect(byDisplay[0]!.column_key).toBe('c0');
    const byOriginal = await handler.getChartData(datasetId, { columns: ['Customer'] });
    expect(byOriginal[0]!.column_key).toBe('c1');
  });

  it('cot khong ton tai -> NotFoundError', async () => {
    await expect(handler.getChartData(datasetId, { columns: ['khong_co'] })).rejects.toThrow(
      /Khong tim thay cot nao/,
    );
  });

  it('khong loc -> tra ve moi cot cua dataset', async () => {
    const charts = await handler.getChartData(datasetId);
    expect(charts).toHaveLength(4);
    expect(charts.map((c) => c.column_key)).toEqual(['c0', 'c1', 'c2', 'c3']);
  });

  it('bao cao truncated khi du lieu bi gioi han', async () => {
    records.getColumnValues.mockResolvedValueOnce({
      columnKey: 'c0',
      values: [1, 2, 3],
      totalRecords: 1000,
      sampledRecords: 3,
      truncated: true,
    });
    const charts = await handler.getChartData(datasetId, { columns: ['c0'] });
    expect(charts[0]!.truncated).toBe(true);
    expect(charts[0]!.total_records).toBe(1000);
    expect(charts[0]!.sampled_records).toBe(3);
  });

  // ── Phần 13 v15 mục 3.28 — DVT-12 (Phần 7 v13 DV-11, DV-15) ─────────────

  it('DVT-12: missing_count tinh ca chuoi rong / toan khoang trang', async () => {
    records.getColumnValues.mockResolvedValueOnce(columnValues('c1', ['A', '', '   ', null, 'B']));
    const charts = await handler.getChartData(datasetId, { columns: ['c1'] });
    const c = charts[0]!;
    expect(c.missing_count).toBe(3);
    expect(c.missing_ratio).toBeCloseTo(3 / 5, 5);
    expect(c.category!.items.map((i) => i.value).sort()).toEqual(['A', 'B']);
  });

  it('DVT-12: cot boolean du lieu cu (True / 1 / yes / true) gop ve true / false', async () => {
    records.getColumnValues.mockResolvedValueOnce(
      columnValues('c2', [true, 'True', '1', 'yes', false, 'FALSE', 0, null]),
    );
    const charts = await handler.getChartData(datasetId, { columns: ['c2'] });
    const items = charts[0]!.category!.items;
    expect(items.map((i) => [i.value, i.count])).toEqual([
      ['true', 4],
      ['false', 3],
    ]);
    expect(charts[0]!.category!.distinct_count).toBe(2);
  });

  it('DVT-12: nhieu cot -> chi cot dau dem tong, cac cot sau nhan knownTotal', async () => {
    const charts = await handler.getChartData(datasetId);
    expect(charts.map((c) => c.column_key)).toEqual(['c0', 'c1', 'c2', 'c3']);
    const calls = records.getColumnValues.mock.calls;
    expect(calls).toHaveLength(4);
    expect(calls[0]![4]).toBeUndefined();
    for (const call of calls.slice(1)) expect(call[4]).toBe(6); // tổng của cột đầu (c0: 6 dòng)
  });

  it('max_rows duoc gioi han o MAX_CHART_SAMPLE_ROWS', async () => {
    await handler.getChartData(datasetId, { columns: ['c0'], maxRows: 999_999 });
    const call = records.getColumnValues.mock.calls[0]!;
    expect(call[3]).toBe(50_000);
  });
});
