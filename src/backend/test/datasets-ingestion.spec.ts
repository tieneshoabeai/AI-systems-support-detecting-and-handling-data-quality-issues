import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Readable } from 'stream';
import { DatasetsService } from '../src/modules/datasets/datasets.service';
import { DatasetsRepository } from '../src/modules/datasets/datasets.repository';
import { ProjectsService } from '../src/modules/projects/projects.service';
import { StorageService } from '../src/shared/storage/storage.service';
import { OutboxService } from '../src/shared/application/outbox/outbox.service';
import { SchemaInferenceService } from '../src/modules/datasets/services/schema-inference.service';
import { ConflictException, PayloadTooLargeException } from '@nestjs/common';
import { IDataset } from '../src/modules/datasets/schemas/dataset.schema';

describe('DatasetsService (Streaming Ingestion & R2 Quota Guard)', () => {
  let service: DatasetsService;
  let datasetsRepository: jest.Mocked<Partial<DatasetsRepository>>;
  let projectsService: jest.Mocked<Partial<ProjectsService>>;
  let storageService: jest.Mocked<Partial<StorageService>>;
  let outboxService: jest.Mocked<Partial<OutboxService>>;

  const mockProjectId = new Types.ObjectId();
  const mockWorkspaceId = new Types.ObjectId();
  const mockDatasetId = new Types.ObjectId();

  const mockProjectDoc = {
    _id: mockProjectId,
    workspace_id: mockWorkspaceId,
    name: 'Customer Project',
    has_dataset: false,
  };

  const mockDatasetDoc = {
    _id: mockDatasetId,
    project_id: mockProjectId,
    workspace_id: mockWorkspaceId,
    name: 'customers',
    original_file_name: 'customers.csv',
    row_count: 3,
    column_count: 4,
    status: 'READY' as const,
  } as unknown as IDataset;

  beforeEach(async () => {
    datasetsRepository = {
      create: jest.fn().mockResolvedValue(mockDatasetDoc),
      updateById: jest.fn().mockResolvedValue(mockDatasetDoc),
      findById: jest.fn().mockResolvedValue(mockDatasetDoc),
      bulkInsertRecords: jest.fn().mockResolvedValue(3),
      softDeleteDatasetWithRecords: jest.fn().mockResolvedValue(true),
    };

    projectsService = {
      getProjectById: jest.fn().mockResolvedValue(mockProjectDoc as never),
      setHasDataset: jest.fn().mockResolvedValue(true),
    };

    storageService = {
      checkUploadQuota: jest.fn().mockResolvedValue({
        allowed: true,
        isWarning: false,
        currentBytes: 1000,
        maxBytes: 10737418240,
        usageRatio: 0.0001,
      }),
      uploadStream: jest.fn().mockResolvedValue('raw_files/test_storage_key.csv'),
    };

    outboxService = {
      recordEvent: jest.fn().mockResolvedValue({} as never),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetsService,
        SchemaInferenceService,
        { provide: DatasetsRepository, useValue: datasetsRepository },
        { provide: ProjectsService, useValue: projectsService },
        { provide: StorageService, useValue: storageService },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = module.get<DatasetsService>(DatasetsService);
  });

  it('ingestDatasetStream should reject upload when Project already has an active Dataset (1 Project = 1 Dataset)', async () => {
    projectsService.getProjectById = jest.fn().mockResolvedValue({
      ...mockProjectDoc,
      has_dataset: true,
    } as never);

    const stream = Readable.from(['id,name\n1,Alice']);

    await expect(
      service.ingestDatasetStream({
        projectId: mockProjectId.toHexString(),
        fileStream: stream,
        fileName: 'another_file.csv',
        mimeType: 'text/csv',
      })
    ).rejects.toThrow(ConflictException);
  });

  it('ingestDatasetStream should reject upload when R2 storage quota reaches 100%', async () => {
    storageService.checkUploadQuota = jest.fn().mockResolvedValue({
      allowed: false,
      isWarning: true,
      currentBytes: 10737418240,
      maxBytes: 10737418240,
      usageRatio: 1.0,
    });

    const stream = Readable.from(['id,name\n1,Alice']);

    await expect(
      service.ingestDatasetStream({
        projectId: mockProjectId.toHexString(),
        fileStream: stream,
        fileName: 'data.csv',
        mimeType: 'text/csv',
        contentLength: 5000000,
      })
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('SchemaInferenceService should accurately detect types (number, boolean, date, string)', () => {
    const inference = new SchemaInferenceService();
    const headers = ['id', 'is_vip', 'joined_date', 'notes'];
    const sampleRows = [
      { id: '101', is_vip: 'true', joined_date: '2026-01-15', notes: 'VIP Customer' },
      { id: '102', is_vip: 'false', joined_date: '2026-02-20', notes: 'Standard' },
      { id: '103', is_vip: 'true', joined_date: '2026-03-10', notes: '' },
    ];

    const columns = inference.inferSchema(headers, sampleRows);

    expect(columns).toHaveLength(4);
    expect(columns[0].data_type).toBe('number');
    expect(columns[1].data_type).toBe('boolean');
    expect(columns[2].data_type).toBe('date');
    expect(columns[3].data_type).toBe('string');
    expect(columns[3].missing_count).toBe(1);
  });

  it('ingestDatasetStream should stream, infer schema, bulkWrite records and trigger outbox event', async () => {
    const csvContent =
      'customer_id,is_active,birth_date,email\n' +
      '1,true,1990-05-12,alice@example.com\n' +
      '2,false,1985-08-25,bob@example.com\n' +
      '3,true,1995-12-01,charlie@example.com\n';

    const fileStream = Readable.from([Buffer.from(csvContent, 'utf8')]);

    const result = await service.ingestDatasetStream({
      projectId: mockProjectId.toHexString(),
      fileStream,
      fileName: 'customers.csv',
      mimeType: 'text/csv',
      contentLength: csvContent.length,
    });

    expect(result).toBeDefined();
    expect(storageService.uploadStream).toHaveBeenCalled();
    expect(datasetsRepository.bulkInsertRecords).toHaveBeenCalled();
    expect(projectsService.setHasDataset).toHaveBeenCalledWith(mockProjectId.toHexString(), true);
    expect(outboxService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregate_type: 'DATASET',
        event_type: 'DATASET_INGESTED',
      })
    );
  });
});
