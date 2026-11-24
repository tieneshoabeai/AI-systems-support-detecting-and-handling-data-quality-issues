import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { RECORD_QUERY_PORT } from '../../../src/modules/datasets/domain/ports/record-query.port';
import { DATASET_REPOSITORY_PORT } from '../../../src/modules/datasets/domain/ports/dataset.repository.port';
import { CursorCodec } from '../../../src/shared/domain/pagination/cursor-codec';
import { createHandlerProxy, type ProxyOf } from '../../helpers/handler-proxy';
import { dataviewHandlers } from '../../helpers/module-handlers';
import { QueryRecordsBodySchema, QueryRecordsSchema } from '../../../src/modules/data-view/data-view.controller';

const mockDatasetId = new Types.ObjectId();
const mockDatasetDoc = {
  id: mockDatasetId.toHexString(),
  projectId: new Types.ObjectId().toHexString(),
  workspaceId: new Types.ObjectId().toHexString(),
  name: 'sales_data',
  originalFileName: 'sales.csv',
  fileFormat: 'csv',
  fileSizeBytes: 100,
  fileChecksum: 'abc',
  rowCount: 5,
  columnCount: 2,
  columns: [
    { key: 'c0', index: 0, name: 'amount', dataType: 'number', originalName: 'Amount', missingCount: 0, isPii: false },
    { key: 'c1', index: 1, name: 'customer', dataType: 'string', originalName: 'Customer', missingCount: 0, isPii: false },
  ],
  columnIssues: [],
  hasHeader: true,
  delimiter: ',',
  currentVersion: 1,
  status: 'READY',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRows = [
  { rowIndex: 0, props: { c0: 100, c1: 'Alice' } },
  { rowIndex: 1, props: { c0: 200, c1: 'Bob' } },
];

describe('DataViewService Wave4 (keyset props.cN, meta nextCursor/hasMore)', () => {
  let service: ProxyOf<typeof dataviewHandlers>;
  let records: { listRecords: jest.Mock; queryRecords: jest.Mock; getColumnStats: jest.Mock; listAllRecords: jest.Mock };
  let datasetsPort: { findById: jest.Mock };

  beforeEach(async () => {
    records = {
      listRecords: jest.fn().mockResolvedValue({ items: mockRows, hasMore: false }),
      queryRecords: jest.fn().mockResolvedValue({ items: [], hasMore: false }),
      getColumnStats: jest.fn().mockResolvedValue({
        columnKey: 'c0',
        columnName: 'amount',
        totalRecords: 2,
        nullCount: 0,
        missingRatio: 0,
        min: 100,
        max: 200,
        average: 150,
        histogram: Array.from({ length: 10 }, (_, i) => ({ bucketStart: i * 10, bucketEnd: i * 10 + 10, count: i === 0 ? 2 : 0 })),
      }),
      listAllRecords: jest.fn().mockResolvedValue(mockRows),
    };
    datasetsPort = { findById: jest.fn().mockResolvedValue(mockDatasetDoc) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(dataviewHandlers),
        { provide: RECORD_QUERY_PORT, useValue: records },
        { provide: DATASET_REPOSITORY_PORT, useValue: datasetsPort },
      ],
    }).compile();
    service = createHandlerProxy(module, dataviewHandlers);
  });

  it('getRecords tra { items, meta } khong co total/offset; cursor opaque', async () => {
    const result = await service.getRecords(mockDatasetId.toHexString(), { limit: 2, sort_order: 'asc' } as never);
    expect(result.items).toHaveLength(2);
    expect(result.meta).toBeDefined();
    expect(result.meta.hasMore).toBe(false);
    expect('total' in (result as unknown as Record<string, unknown>)).toBe(false);
    expect('offset' in (result as unknown as Record<string, unknown>)).toBe(false);
    expect(records.listRecords).toHaveBeenCalled();
  });

  it('cursor sai dinh dang -> VALIDATION_ERROR', async () => {
    await expect(
      service.getRecords(mockDatasetId.toHexString(), { limit: 10, cursor: '!!!not-base64!!!', sort_order: 'asc' } as never),
    ).rejects.toThrow(/Cursor khong hop le/);
  });

  it('queryRecords goi port voi limit chuan hoa', async () => {
    await service.queryRecords(mockDatasetId.toHexString(), {
      filters: [{ column: 'c0', operator: 'between', value: [10, 20] }],
      sort: [{ column: 'c1', order: 'desc' }],
      limit: 50,
    } as never);
    expect(records.queryRecords).toHaveBeenCalled();
    const input = records.queryRecords.mock.calls[0][1] as Record<string, unknown>;
    expect(input.limit).toBe(50);
  });

  it('chap nhan ten hien thi (amount) van goi port', async () => {
    await service.queryRecords(mockDatasetId.toHexString(), {
      filters: [{ column: 'amount', operator: 'equals', value: 100 }],
      sort: [],
      limit: 50,
    } as never);
    expect(records.queryRecords).toHaveBeenCalled();
  });

  it('cot khong ton tai -> BadRequestException', async () => {
    await expect(
      service.queryRecords(mockDatasetId.toHexString(), {
        filters: [{ column: 'khong_co', operator: 'equals', value: 1 }],
        sort: [],
        limit: 50,
      } as never),
    ).rejects.toThrow(/Cot khong ton tai/);
  });

  it('getColumnStats theo key c0, tra column_key bat bien', async () => {
    const stats = await service.getColumnStats(mockDatasetId.toHexString(), 'c0');
    expect(stats.column_key).toBe('c0');
    expect(stats.column_name).toBe('amount');
    expect(stats.min).toBe(100);
    expect(stats.histogram).toHaveLength(10);
  });

  it('getColumnStats chap nhan ten hien thi (amount -> c0)', async () => {
    const stats = await service.getColumnStats(mockDatasetId.toHexString(), 'amount');
    expect(stats.column_key).toBe('c0');
  });

  it('duyet trang co nextCursor opaque { row_index }', async () => {
    records.listRecords.mockResolvedValueOnce({
      items: [{ rowIndex: 0, props: {} }, { rowIndex: 1, props: {} }],
      hasMore: true,
    });
    const p1 = await service.getRecords(mockDatasetId.toHexString(), { limit: 2, sort_order: 'asc' } as never);
    expect(p1.items.map((x) => x.rowIndex)).toEqual([0, 1]);
    expect(p1.meta.hasMore).toBe(true);
    expect(p1.meta.nextCursor).toBeTruthy();
    const decoded = CursorCodec.decode<{ row_index: number }>(p1.meta.nextCursor as string);
    expect(decoded?.row_index).toBe(1);
    expect(records.listRecords).toHaveBeenCalled();
  });

  it('khong ton tai updateCell (S19/A13): service khong co phuong thuc ghi record', async () => {
    expect((service as unknown as Record<string, unknown>).updateCell).toBeUndefined();
  });

  // ── Phần 13 v15 mục 3.28 — đợt sửa data-view (Phần 7 v13 mục 3.23) ──────

  it('DVT-02: queryRecords cursor hong -> VALIDATION_ERROR, khong goi port', async () => {
    await expect(
      service.queryRecords(mockDatasetId.toHexString(), {
        filters: [],
        sort: [],
        cursor: '!!!not-base64!!!',
        limit: 50,
      } as never),
    ).rejects.toThrow(/Cursor khong hop le/);
    expect(records.queryRecords).not.toHaveBeenCalled();
  });

  it('DVT-03: cursor { row_index } dung cho truy van co sort -> VALIDATION_ERROR (ca 2 route)', async () => {
    const legacy = CursorCodec.encode({ row_index: 3 });
    await expect(
      service.queryRecords(mockDatasetId.toHexString(), {
        filters: [],
        sort: [{ column: 'amount', order: 'asc' }],
        cursor: legacy,
        limit: 50,
      } as never),
    ).rejects.toThrow(/Cursor khong khop/);
    await expect(
      service.getRecords(mockDatasetId.toHexString(), {
        limit: 10,
        cursor: legacy,
        sort_field: 'amount',
        sort_order: 'asc',
      } as never),
    ).rejects.toThrow(/Cursor khong khop/);
    expect(records.queryRecords).not.toHaveBeenCalled();
  });

  it('DVT-06: port nhan key cN da quy doi cho filters / sort / search', async () => {
    await service.queryRecords(mockDatasetId.toHexString(), {
      filters: [
        { column: 'c0', operator: 'equals', value: 100 },
        { column: 'amount', operator: 'equals', value: 200 },
        { column: 'Customer', operator: 'contains', value: 'A' },
      ],
      sort: [{ column: 'Amount', order: 'desc' }],
      search: { columns: ['customer', 'c0'], value: 'x' },
      limit: 50,
    } as never);
    const input = records.queryRecords.mock.calls[0][1] as {
      filters: { column: string }[];
      sort: { column: string; order: string }[];
      search: { columns: string[]; value: string };
    };
    expect(input.filters.map((f) => f.column)).toEqual(['c0', 'c0', 'c1']);
    expect(input.sort).toEqual([{ column: 'c0', order: 'desc' }]);
    expect(input.search).toEqual({ columns: ['c1', 'c0'], value: 'x' });
  });

  it('DV-2: co sort -> nextCursor lay tu port (gia tri sort cua dong cuoi), khong tu che { row_index }', async () => {
    records.queryRecords.mockResolvedValueOnce({
      items: [{ rowIndex: 9, props: {} }],
      hasMore: true,
      nextCursor: 'cursor-tu-port',
    });
    const res = await service.getRecords(mockDatasetId.toHexString(), {
      limit: 1,
      sort_field: 'amount',
      sort_order: 'desc',
    } as never);
    expect(res.meta.nextCursor).toBe('cursor-tu-port');
    expect(res.next_cursor).toBe('cursor-tu-port');
    const input = records.queryRecords.mock.calls[0][1] as { sort: unknown };
    expect(input.sort).toEqual([{ column: 'c0', order: 'desc' }]);
  });

  it('DV-2: het du lieu -> nextCursor null du port co tra cursor', async () => {
    records.queryRecords.mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: 'bo-qua' });
    const res = await service.queryRecords(mockDatasetId.toHexString(), {
      filters: [],
      sort: [{ column: 'c1', order: 'asc' }],
      limit: 50,
    } as never);
    expect(res.meta.nextCursor).toBeNull();
    expect(res.meta.hasMore).toBe(false);
  });

  it('DV-14: getColumnStats truyen kieu cot xuong port', async () => {
    await service.getColumnStats(mockDatasetId.toHexString(), 'customer');
    expect(records.getColumnStats).toHaveBeenCalledWith(mockDatasetId.toHexString(), 'c1', 'string');
  });
});

describe('DataView DTO (Zod) — Phần 7 v13 DV-1 / DV-6', () => {
  it('DVT-05: value la object (NoSQL operator) -> bi tu choi', () => {
    const bad = [
      { column: 'c1', operator: 'equals', value: { $ne: null } },
      { column: 'c1', operator: 'contains', value: { $regex: '(a+)+$' } },
      { column: 'c1', operator: 'in', value: [{ $gt: '' }] },
      { column: 'c1', operator: 'between', value: [1, { $gt: 0 }] },
    ];
    for (const f of bad) {
      expect(QueryRecordsBodySchema.safeParse({ filters: [f] }).success).toBe(false);
    }
  });

  it('DVT-05: value primitive / mang primitive -> hop le', () => {
    const good = [
      { column: 'c1', operator: 'equals', value: 'A' },
      { column: 'c0', operator: 'greaterThan', value: 5 },
      { column: 'c2', operator: 'equals', value: false },
      { column: 'c0', operator: 'between', value: [1, 10] },
      { column: 'c1', operator: 'in', value: ['a', 'b'] },
      { column: 'c1', operator: 'isEmpty' },
    ];
    for (const f of good) {
      expect(QueryRecordsBodySchema.safeParse({ filters: [f] }).success).toBe(true);
    }
  });

  it('DVT-05 / VIEW-004: limit 500 nhan, 501 tu choi (ca GET va POST)', () => {
    expect(QueryRecordsBodySchema.safeParse({ limit: 500 }).success).toBe(true);
    expect(QueryRecordsBodySchema.safeParse({ limit: 501 }).success).toBe(false);
    expect(QueryRecordsSchema.safeParse({ limit: '500' }).success).toBe(true);
    expect(QueryRecordsSchema.safeParse({ limit: '501' }).success).toBe(false);
    expect(QueryRecordsSchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(QueryRecordsSchema.safeParse({ limit: '2.5' }).success).toBe(false);
  });
});
