import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Readable } from 'stream';
import { DatasetsService } from '../src/modules/datasets/application/datasets.service';
import { DATASET_REPOSITORY_PORT } from '../src/modules/datasets/domain/ports/dataset.repository.port';
import { ProjectsService } from '../src/modules/projects/application/projects.service';
import { STORAGE_PORT } from '../src/shared/ports/storage.port';
import { OUTBOX_PORT } from '../src/shared/ports/outbox.port';
import { SchemaInferenceService } from '../src/modules/datasets/application/services/schema-inference.service';
import { WorkspacesService } from '../src/modules/workspaces/application/workspaces.service';
import { ConfigService } from '@nestjs/config';
import { ConflictException, PayloadTooLargeException } from '@nestjs/common';

describe('DatasetsService (Streaming Ingestion & R2 Quota Guard)', () => {
  let service: DatasetsService;
  let datasetsRepository: Record<string, jest.Mock>;
  let projectsService: Record<string, jest.Mock>;
  let storageService: Record<string, jest.Mock>;
  let outboxService: Record<string, jest.Mock>;
  let workspacesService: Record<string, jest.Mock>;

  const mockProjectId = new Types.ObjectId().toHexString();
  const mockWorkspaceId = new Types.ObjectId().toHexString();
  const mockDatasetId = new Types.ObjectId().toHexString();

  const mockProjectRecord = {
    id: mockProjectId,
    workspaceId: mockWorkspaceId,
    name: 'Customer Project',
    hasDataset: false,
  };

  const mockDatasetRecord = {
    id: mockDatasetId,
    projectId: mockProjectId,
    workspaceId: mockWorkspaceId,
    name: 'customers',
    originalFileName: 'customers.csv',
    fileFormat: 'csv' as const,
    fileSizeBytes: 100,
    fileChecksum: 'sha256:abc',
    rowCount: 3,
    columnCount: 4,
    columns: [],
    columnIssues: [],
    hasHeader: true,
    delimiter: ',' as const,
    currentVersion: 1,
    status: 'READY' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    datasetsRepository = {
      create: jest.fn().mockResolvedValue(mockDatasetRecord),
      updateById: jest.fn().mockResolvedValue(mockDatasetRecord),
      findById: jest.fn().mockResolvedValue(mockDatasetRecord),
      findByProject: jest.fn().mockResolvedValue(null),
      bulkInsertRecords: jest.fn().mockResolvedValue(3),
      softDeleteDatasetWithRecords: jest.fn().mockResolvedValue(true),
    };

    projectsService = {
      getProjectById: jest.fn().mockResolvedValue(mockProjectRecord),
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
      deleteFile: jest.fn().mockResolvedValue(true),
    };

    outboxService = { recordEvent: jest.fn().mockResolvedValue({}) };
    workspacesService = {
      checkWorkspaceUploadQuota: jest.fn().mockResolvedValue(undefined),
      incrementStorageUsed: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetsService,
        SchemaInferenceService,
        { provide: DATASET_REPOSITORY_PORT, useValue: datasetsRepository },
        { provide: ProjectsService, useValue: projectsService },
        { provide: STORAGE_PORT, useValue: storageService },
        { provide: OUTBOX_PORT, useValue: outboxService },
        { provide: WorkspacesService, useValue: workspacesService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: unknown) =>
              key === 'WORKSPACE_STORAGE_QUOTA_BYTES' ? 2147483648 : def,
          },
        },
      ],
    }).compile();

    service = module.get<DatasetsService>(DatasetsService);
  });

  it('ingestDatasetStream should reject upload when Project already has an active Dataset (1 Project = 1 Dataset)', async () => {
    projectsService.getProjectById = jest
      .fn()
      .mockResolvedValue({ ...mockProjectRecord, hasDataset: true });
    const stream = Readable.from(['id,name\n1,Alice']);
    await expect(
      service.ingestDatasetStream({
        projectId: mockProjectId,
        fileStream: stream,
        fileName: 'another_file.csv',
        mimeType: 'text/csv',
      }),
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
        projectId: mockProjectId,
        fileStream: stream,
        fileName: 'data.csv',
        mimeType: 'text/csv',
        contentLength: 5000000,
      }),
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
    expect(columns[0].dataType).toBe('number');
    expect(columns[1].dataType).toBe('boolean');
    expect(columns[2].dataType).toBe('date');
    expect(columns[3].dataType).toBe('string');
    expect(columns[3].missingCount).toBe(1);
  });

  it('ingestDatasetStream should stream, infer schema, bulkWrite records and trigger outbox event', async () => {
    const csvContent =
      'customer_id,is_active,birth_date,email\n' +
      '1,true,1990-05-12,alice@example.com\n' +
      '2,false,1985-08-25,bob@example.com\n' +
      '3,true,1995-12-01,charlie@example.com\n';
    const fileStream = Readable.from([Buffer.from(csvContent, 'utf8')]);
    const result = await service.ingestDatasetStream({
      projectId: mockProjectId,
      fileStream,
      fileName: 'customers.csv',
      mimeType: 'text/csv',
      contentLength: csvContent.length,
    });
    expect(result).toBeDefined();
    expect(storageService.uploadStream).toHaveBeenCalled();
    expect(datasetsRepository.bulkInsertRecords).toHaveBeenCalled();
    expect(projectsService.setHasDataset).toHaveBeenCalledWith(mockProjectId, true);
    expect(outboxService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ aggregate_type: 'DATASET', event_type: 'DATASET_INGESTED' }),
    );
  });
});
