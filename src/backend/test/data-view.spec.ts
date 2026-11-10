import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { DataViewService } from '../src/modules/data-view/application/data-view.service';
import { DatasetsService } from '../src/modules/datasets/application/datasets.service';
import { RECORD_QUERY_PORT } from '../src/modules/data-view/domain/ports/record-query.port';
import { DATASET_REPOSITORY_PORT } from '../src/modules/datasets/domain/ports/dataset.repository.port';
import { CursorCodec } from '../src/shared/pagination/cursor-codec';

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
  let service: DataViewService;
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
        DataViewService,
        { provide: RECORD_QUERY_PORT, useValue: records },
        { provide: DATASET_REPOSITORY_PORT, useValue: datasetsPort },
        { provide: DatasetsService, useValue: {} },
      ],
    }).compile();
    service = module.get<DataViewService>(DataViewService);
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
});
