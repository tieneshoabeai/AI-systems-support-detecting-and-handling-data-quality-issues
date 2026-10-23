import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DataViewService } from '../src/modules/data-view/data-view.service';
import { DatasetsService } from '../src/modules/datasets/datasets.service';
import { IDatasetRecord } from '../src/modules/datasets/schemas/dataset-record.schema';
import { IDataset } from '../src/modules/datasets/schemas/dataset.schema';

describe('DataViewService (Virtual Grid Cursor Pagination & Column Stats)', () => {
  let service: DataViewService;
  let mockRecordModel: {
    find: jest.Mock;
    countDocuments: jest.Mock;
    findOneAndUpdate: jest.Mock;
    aggregate: jest.Mock;
  };
  let datasetsService: jest.Mocked<Partial<DatasetsService>>;

  const mockDatasetId = new Types.ObjectId();
  const mockDatasetDoc = {
    _id: mockDatasetId,
    name: 'sales_data',
    columns: [
      { name: 'amount', data_type: 'number', original_name: 'Amount', missing_count: 0 },
      { name: 'customer', data_type: 'string', original_name: 'Customer', missing_count: 0 },
    ],
  } as unknown as IDataset;

  const mockRecords = [
    {
      _id: new Types.ObjectId(),
      dataset_id: mockDatasetId,
      row_index: 0,
      data: { amount: 100, customer: 'Alice' },
    },
    {
      _id: new Types.ObjectId(),
      dataset_id: mockDatasetId,
      row_index: 1,
      data: { amount: 200, customer: 'Bob' },
    },
  ];

  beforeEach(async () => {
    mockRecordModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockRecords),
            }),
          }),
        }),
      }),
      countDocuments: jest.fn().mockResolvedValue(2),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockRecords[0],
          data: { amount: 150, customer: 'Alice' },
        }),
      }),
      aggregate: jest.fn().mockResolvedValue([
        {
          total: 2,
          null_count: 0,
          numeric_values: [100, 200],
        },
      ]),
    };

    datasetsService = {
      getDatasetById: jest.fn().mockResolvedValue(mockDatasetDoc),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataViewService,
        { provide: getModelToken('DatasetRecord'), useValue: mockRecordModel },
        { provide: DatasetsService, useValue: datasetsService },
      ],
    }).compile();

    service = module.get<DataViewService>(DataViewService);
  });

  it('getRecords should return cursor paginated response with items and next_cursor', async () => {
    const result = await service.getRecords(mockDatasetId.toHexString(), {
      limit: 2,
      sort_order: 'asc',
    });

    expect(result).toBeDefined();
    expect(result.items).toHaveLength(2);
    expect(result.total_count).toBe(2);
    expect(datasetsService.getDatasetById).toHaveBeenCalledWith(mockDatasetId.toHexString());
  });

  it('updateCell should update in-place cell value for a specific row_index', async () => {
    const updated = await service.updateCell(mockDatasetId.toHexString(), 0, {
      field: 'amount',
      value: 150,
    });

    expect(updated).toBeDefined();
    expect(mockRecordModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        row_index: 0,
      }),
      expect.objectContaining({
        $set: { 'data.amount': 150 },
      }),
      expect.anything()
    );
  });

  it('getColumnStats should compute null count, min, max, avg, and 10 histogram buckets', async () => {
    const stats = await service.getColumnStats(mockDatasetId.toHexString(), 'amount');

    expect(stats).toBeDefined();
    expect(stats.column_name).toBe('amount');
    expect(stats.min).toBe(100);
    expect(stats.max).toBe(200);
    expect(stats.average).toBe(150);
    expect(stats.histogram).toHaveLength(10);
  });
});
