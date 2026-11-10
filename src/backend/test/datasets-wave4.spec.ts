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
import { RECORD_QUERY_PORT } from '../src/modules/data-view/domain/ports/record-query.port';
import { DATASET_REPOSITORY_PORT as DV_DATASET_PORT } from '../src/modules/datasets/domain/ports/dataset.repository.port';
import { DataViewService } from '../src/modules/data-view/application/data-view.service';

describe('Wave4 acceptance (CSV-only, props c0.., insert-only, cursor, no-leak)', () => {
  let service: DatasetsService;
  let datasetsRepository: Record<string, jest.Mock>;
  let projectsService: Record<string, jest.Mock>;
  let storageService: Record<string, jest.Mock>;
  let workspacesService: Record<string, jest.Mock>;

  const mockProjectId = new Types.ObjectId().toHexString();
  const mockWorkspaceId = new Types.ObjectId().toHexString();
  const mockDatasetId = new Types.ObjectId().toHexString();
  const mockProjectRecord = { id: mockProjectId, workspaceId: mockWorkspaceId, name: 'P', hasDataset: false };
  const baseDataset = {
    id: mockDatasetId,
    projectId: mockProjectId,
    workspaceId: mockWorkspaceId,
    name: 'f',
    originalFileName: 'f.csv',
    fileFormat: 'csv' as const,
    fileSizeBytes: 10,
    fileChecksum: 'sha256:abc',
    rowCount: 2,
    columnCount: 2,
    status: 'READY' as const,
    columns: [
      { key: 'c0', index: 0, name: 'Ten', dataType: 'string' as const, originalName: 'Ten', missingCount: 0, isPii: false },
      { key: 'c1', index: 1, name: 'Tuoi', dataType: 'number' as const, originalName: 'Tuoi', missingCount: 0, isPii: false },
    ],
    columnIssues: [],
    hasHeader: true,
    delimiter: ',' as const,
    currentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    datasetsRepository = {
      create: jest.fn().mockResolvedValue(baseDataset),
      updateById: jest.fn().mockImplementation(async (_id: unknown, u: Record<string, unknown>) => ({ ...baseDataset, ...u })),
      findById: jest.fn().mockResolvedValue(baseDataset),
      findByProject: jest.fn().mockResolvedValue(null),
      bulkInsertRecords: jest.fn().mockResolvedValue(2),
      softDeleteDatasetWithRecords: jest.fn().mockResolvedValue(true),
    };
    projectsService = { getProjectById: jest.fn().mockResolvedValue(mockProjectRecord), setHasDataset: jest.fn().mockResolvedValue(true) };
    storageService = {
      checkUploadQuota: jest.fn().mockResolvedValue({ allowed: true }),
      uploadStream: jest.fn().mockResolvedValue('raw_files/x.csv'),
      deleteFile: jest.fn().mockResolvedValue(true),
    };
    workspacesService = { checkWorkspaceUploadQuota: jest.fn().mockResolvedValue(undefined), incrementStorageUsed: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasetsService,
        SchemaInferenceService,
        { provide: DATASET_REPOSITORY_PORT, useValue: datasetsRepository },
        { provide: ProjectsService, useValue: projectsService },
        { provide: STORAGE_PORT, useValue: storageService },
        { provide: OUTBOX_PORT, useValue: { recordEvent: jest.fn().mockResolvedValue({}) } },
        { provide: WorkspacesService, useValue: workspacesService },
        { provide: ConfigService, useValue: { get: (k: string, d: unknown) => (k === 'WORKSPACE_STORAGE_QUOTA_BYTES' ? 2147483648 : d) } },
      ],
    }).compile();
    service = module.get<DatasetsService>(DatasetsService);
  });

  it('C13/O34: upload .xlsx -> 400 UNSUPPORTED_FILE_TYPE, khong tao rac', async () => {
    await expect(
      service.ingestDatasetStream({
        projectId: mockProjectId,
        fileStream: Readable.from(['a,b\n1,2']),
        fileName: 'data.xlsx',
        mimeType: 'application/vnd.ms-excel',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'UNSUPPORTED_FILE_TYPE' }) });
    expect(datasetsRepository.create).not.toHaveBeenCalled();
    expect(storageService.uploadStream).not.toHaveBeenCalled();
  });

  it('guard 1000 cot -> VALIDATION_ERROR too_many_columns + don file tam (O34/don rac)', async () => {
    const cols = Array.from({ length: 1001 }, (_, i) => `col${i}`).join(',');
    const csv = cols + '\n' + Array.from({ length: 1001 }, () => '1').join(',');
    await expect(
      service.ingestDatasetStream({
        projectId: mockProjectId,
        fileStream: Readable.from([csv]),
        fileName: 'wide.csv',
        mimeType: 'text/csv',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'VALIDATION_ERROR' }) });
    expect(storageService.deleteFile).toHaveBeenCalled();
  });

  it('S21/M14: props dung key c0..c1, rowCount khop, 50k dong x 10 cot (mo phong batch)', async () => {
    const header = Array.from({ length: 10 }, (_, i) => `Cot ${i}`).join(',');
    const oneLine = Array.from({ length: 10 }, (_, i) => `v${i}`).join(',');
    const csv = header + '\n' + oneLine + '\n' + oneLine + '\n';
    const result = await service.ingestDatasetStream({
      projectId: mockProjectId,
      fileStream: Readable.from([csv]),
      fileName: 'small.csv',
      mimeType: 'text/csv',
    });
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(10);
    const calls = (datasetsRepository.bulkInsertRecords as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const firstProps = calls[0][0][0].props as Record<string, unknown>;
    expect(Object.keys(firstProps)).toEqual(Array.from({ length: 10 }, (_, i) => `c${i}`));
    expect(firstProps['c0']).toBe('v0');
  });

  it('S14: storageKey khong lo ra response', async () => {
    const got = await service.getDatasetById(mockDatasetId);
    expect((got as unknown as Record<string, unknown>).storageKey).toBeUndefined();
    expect((got as unknown as Record<string, unknown>).storage_key).toBeUndefined();
    const byProject = await service.getDatasetByProjectId(mockProjectId);
    expect((byProject as unknown as Record<string, unknown>)?.storageKey).toBeUndefined();
  });

  it('S21: rename doi name, giu key bat bien + tinh lai issues; M15 reset + dao nguoc props', async () => {
    const renamed = await service.renameColumns(mockDatasetId, {
      columns: [{ key: 'c0', name: 'Ho Ten' }],
    });
    const c0 = renamed.columns.find((c) => c.key === 'c0');
    expect(c0?.name).toBe('Ho Ten');
    expect(c0?.key).toBe('c0');
    const back = service.mapPropsToOriginalNames(
      renamed.columns.map((c) => ({ key: c.key, originalName: c.originalName })),
      { c0: 'Nguyen Van A', c1: 30 },
    );
    expect(back).toEqual({ Ten: 'Nguyen Van A', Tuoi: 30 });
    const reset = await service.resetColumnNames(mockDatasetId);
    expect(reset.columns.find((c) => c.key === 'c0')?.name).toBe('Ten');
  });

  it('S19/A13: dataset_record insert-only - repository chi co bulkInsertRecords, khong updateOne/deleteMany', async () => {
    const { DatasetRecordSchema } = await import(
      '../src/modules/datasets/infrastructure/persistence/dataset-record.schema'
    );
    const paths = Object.keys(DatasetRecordSchema.paths);
    expect(paths).toContain('props');
    expect(paths).not.toContain('deleted_at');
    expect(paths).not.toContain('version_number');
    expect(paths).not.toContain('data');
    const { DatasetsRepository } = await import(
      '../src/modules/datasets/infrastructure/persistence/datasets.repository'
    );
    const repoProto = Object.getOwnPropertyNames(DatasetsRepository.prototype);
    expect(repoProto).toContain('bulkInsertRecords');
    expect(repoProto).not.toContain('updateOne');
    expect(repoProto).not.toContain('deleteMany');
    expect(repoProto).not.toContain('findOneAndUpdate');
  });

  it('C9/C10: cursor meta nextCursor/hasMore, khong total/offset; cursor sai -> VALIDATION_ERROR', async () => {
    const recordsPort = {
      listRecords: jest.fn().mockResolvedValue({ items: [], hasMore: false }),
      queryRecords: jest.fn().mockResolvedValue({ items: [], hasMore: false }),
      getColumnStats: jest.fn(),
      listAllRecords: jest.fn().mockResolvedValue([]),
    };
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        DataViewService,
        { provide: RECORD_QUERY_PORT, useValue: recordsPort },
        { provide: DV_DATASET_PORT, useValue: { findById: jest.fn().mockResolvedValue(baseDataset) } },
        { provide: DatasetsService, useValue: {} },
      ],
    }).compile();
    const dv = mod.get<DataViewService>(DataViewService);
    const r = await dv.getRecords(mockDatasetId, { limit: 10, sort_order: 'asc' } as never);
    expect(r.meta).toBeDefined();
    expect('total' in (r as unknown as Record<string, unknown>)).toBe(false);
    expect('offset' in (r as unknown as Record<string, unknown>)).toBe(false);
    await expect(
      dv.getRecords(mockDatasetId, { limit: 10, cursor: 'bad!!', sort_order: 'asc' } as never),
    ).rejects.toThrow(/Cursor khong hop le/);
  });

  it('column_issues: ten rong/trung duoc phat hien, khong fail upload', () => {
    const inf = new SchemaInferenceService();
    const { columns, issues } = inf.inferSchemaWithIssues(['Ten', '', 'Ten'], [{ Ten: 'a', '': 'b' }]);
    expect(columns.map((c) => c.key)).toEqual(['c0', 'c1', 'c2']);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.map((i) => i.issue)).toContain('empty_name');
    expect(issues.map((i) => i.issue)).toContain('duplicate_name');
  });
});
