/**
 * GĐ4 — `PATCH /datasets/:id/columns/pii`: bật/tắt cờ PII cho cột.
 *
 * Nguyên tắc bất biến dữ liệu: sau khi nạp, **nội dung dataset** không được
 * sửa (route đổi tên dataset / đổi tên cột / reset tên cột đã bị gỡ).
 *
 * Cờ `isPii` là *metadata phân loại cột* — nằm NGOÀI bản chụp dữ liệu — nên
 * vẫn cho phép cập nhật. Route này được tách riêng để ranh giới
 * "sửa nội dung" vs "sửa metadata" luôn rõ ràng.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { DATASET_REPOSITORY_PORT } from '../src/modules/datasets/domain/ports/dataset.repository.port';
import { STORAGE_PORT } from '../src/shared/application/ports/storage.port';
import { OUTBOX_PORT } from '../src/shared/application/ports/outbox.port';
import { SchemaInferenceService } from '../src/modules/datasets/application/services/schema-inference.service';
import { PROJECT_ACCESS_PORT } from '../src/modules/projects';
import { WORKSPACE_ACCESS_PORT } from '../src/modules/workspaces';
import { Dataset } from '../src/modules/datasets/domain/entities/dataset.entity';
import { createHandlerProxy, type ProxyOf } from './helpers/handler-proxy';
import { datasetsHandlers } from './helpers/module-handlers';

describe('GĐ4 — PATCH /datasets/:id/columns/pii', () => {
  let service: ProxyOf<typeof datasetsHandlers>;
  let datasetsRepository: Record<string, jest.Mock>;
  let findByIdMock: jest.Mock;
  let updateColumnPiiMock: jest.Mock;

  const mockDatasetId = new Types.ObjectId().toHexString();
  const mockProjectId = new Types.ObjectId().toHexString();
  const mockWorkspaceId = new Types.ObjectId().toHexString();

  const baseDatasetProps = {
    id: mockDatasetId,
    projectId: mockProjectId,
    workspaceId: mockWorkspaceId,
    name: 'f',
    originalFileName: 'f.csv',
    fileFormat: 'csv' as const,
    fileSizeBytes: 10,
    fileChecksum: 'sha256:abc',
    storageKey: 'raw_files/x.csv',
    rowCount: 2,
    columnCount: 2,
    status: 'READY' as const,
    columns: [
      {
        key: 'c0',
        index: 0,
        name: 'Ten',
        dataType: 'string' as const,
        originalName: 'Ten',
        missingCount: 0,
        isPii: false,
      },
      {
        key: 'c1',
        index: 1,
        name: 'CCCD',
        dataType: 'string' as const,
        originalName: 'CCCD',
        missingCount: 0,
        isPii: false,
      },
    ],
    columnIssues: [],
    hasHeader: true,
    delimiter: ',' as const,
    currentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
  };

  const buildDataset = (): Dataset => Dataset.reconstitute({ ...baseDatasetProps });

  beforeEach(async () => {
    findByIdMock = jest.fn().mockImplementation(async () => buildDataset());
    updateColumnPiiMock = jest
      .fn()
      .mockImplementation(async (_id: string, updates: Array<{ columnKey: string; isPii: boolean }>) => {
        const props = {
          ...baseDatasetProps,
          columns: baseDatasetProps.columns.map((c) => {
            const u = updates.find((x) => x.columnKey === c.key);
            return u ? { ...c, isPii: u.isPii } : { ...c };
          }),
        };
        return Dataset.reconstitute(props);
      });
    datasetsRepository = {
      create: jest.fn().mockResolvedValue(buildDataset()),
      updateById: jest.fn(),
      findById: findByIdMock,
      findByProject: jest.fn().mockResolvedValue(null),
      bulkInsertRecords: jest.fn().mockResolvedValue(2),
      softDeleteDatasetWithRecords: jest.fn().mockResolvedValue(true),
      // GĐ4 — chỉ cập nhật cờ PII, không đụng nội dung.
      updateColumnPii: updateColumnPiiMock,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...Object.values(datasetsHandlers),
        SchemaInferenceService,
        { provide: DATASET_REPOSITORY_PORT, useValue: datasetsRepository },
        { provide: PROJECT_ACCESS_PORT, useValue: { getProjectById: jest.fn() } },
        { provide: STORAGE_PORT, useValue: { checkUploadQuota: jest.fn() } },
        { provide: OUTBOX_PORT, useValue: { recordEvent: jest.fn().mockResolvedValue({}) } },
        { provide: WORKSPACE_ACCESS_PORT, useValue: { checkWorkspaceUploadQuota: jest.fn() } },
        { provide: ConfigService, useValue: { get: (_k: string, d: unknown) => d } },
      ],
    }).compile();
    service = createHandlerProxy(module, datasetsHandlers);
  });

  it('bật được cờ PII cho một cột', async () => {
    const res = await service.updateColumnPii(mockDatasetId, {
      columns: [{ columnKey: 'c1', isPii: true }],
    });
    const col = res.columns.find((c) => c.key === 'c1');
    expect(col?.isPii).toBe(true);
    expect(updateColumnPiiMock).toHaveBeenCalledWith(mockDatasetId, [
      { columnKey: 'c1', isPii: true },
    ]);
  });

  it('tắt được cờ PII', async () => {
    findByIdMock.mockImplementation(async () => {
      const props = {
        ...baseDatasetProps,
        columns: baseDatasetProps.columns.map((c, i) =>
          i === 1 ? { ...c, isPii: true } : { ...c },
        ),
      };
      return Dataset.reconstitute(props);
    });
    const res = await service.updateColumnPii(mockDatasetId, {
      columns: [{ columnKey: 'c1', isPii: false }],
    });
    const col = res.columns.find((c) => c.key === 'c1');
    expect(col?.isPii).toBe(false);
  });

  it('cập nhật được nhiều cột một lần', async () => {
    const res = await service.updateColumnPii(mockDatasetId, {
      columns: [
        { columnKey: 'c0', isPii: true },
        { columnKey: 'c1', isPii: true },
      ],
    });
    expect(res.columns.every((c) => c.isPii)).toBe(true);
  });

  it('ném VALIDATION_ERROR khi key cột không tồn tại', async () => {
    await expect(
      service.updateColumnPii(mockDatasetId, { columns: [{ columnKey: 'c99', isPii: true }] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('ném NOT_FOUND khi dataset không tồn tại', async () => {
    findByIdMock.mockResolvedValue(null);
    await expect(
      service.updateColumnPii(mockDatasetId, { columns: [{ columnKey: 'c0', isPii: true }] }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('ném VALIDATION_ERROR khi không có cột nào thay đổi', async () => {
    await expect(
      service.updateColumnPii(mockDatasetId, { columns: [{ columnKey: 'c0', isPii: false }] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('KHÔNG dùng updateById (tránh chạm nội dung dataset)', async () => {
    await service.updateColumnPii(mockDatasetId, {
      columns: [{ columnKey: 'c0', isPii: true }],
    });
    expect(datasetsRepository.updateById).not.toHaveBeenCalled();
  });
});
