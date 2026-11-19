/**
 * GĐ12 — 3 endpoint metadata dataset (contract §3.13 v8 #46–#48):
 *   - `PATCH /datasets/:id`              → đổi tên dataset
 *   - `PATCH /datasets/:id/columns`      → đổi tên hiển thị của nhiều cột
 *   - `POST  /datasets/:id/columns/reset` → khôi phục tên cột về tên gốc
 *
 * **Không phải sửa nội dung dữ liệu** — chỉ sửa *metadata nhãn*. Key cột `c{i}`
 * bất biến nên không phải viết lại bản ghi nào; nguyên tắc bất biến (mục 3.40)
 * vẫn giữ nguyên.
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
import type {
  DatasetColumnIssue,
  DatasetProps,
} from '../src/modules/datasets/domain/entities/dataset.entity';
import { createHandlerProxy, type ProxyOf } from './helpers/handler-proxy';
import { datasetsHandlers } from './helpers/module-handlers';

describe('GĐ12 — 3 endpoint metadata dataset', () => {
  let service: ProxyOf<typeof datasetsHandlers>;
  let datasetsRepository: Record<string, jest.Mock>;
  let findByIdMock: jest.Mock;
  let updateNameMock: jest.Mock;
  let updateColumnNamesMock: jest.Mock;
  let resetColumnNamesMock: jest.Mock;

  const mockDatasetId = new Types.ObjectId().toHexString();
  const mockProjectId = new Types.ObjectId().toHexString();
  const mockWorkspaceId = new Types.ObjectId().toHexString();

  const baseDatasetProps: Omit<DatasetProps, 'columnIssues'> & {
    columnIssues: DatasetColumnIssue[];
  } = {
    id: mockDatasetId,
    projectId: mockProjectId,
    workspaceId: mockWorkspaceId,
    name: 'sales_2024',
    originalFileName: 'sales.csv',
    fileFormat: 'csv' as const,
    fileSizeBytes: 10,
    fileChecksum: 'sha256:abc',
    storageKey: 'raw_files/x.csv',
    rowCount: 2,
    columnCount: 3,
    status: 'READY' as const,
    columns: [
      {
        key: 'c0',
        index: 0,
        name: 'Amount',
        dataType: 'number' as const,
        originalName: 'Amount',
        missingCount: 0,
        isPii: false,
      },
      {
        key: 'c1',
        index: 1,
        name: 'Customer',
        dataType: 'string' as const,
        originalName: 'Customer',
        missingCount: 0,
        isPii: false,
      },
      {
        key: 'c2',
        index: 2,
        name: '',
        dataType: 'string' as const,
        originalName: '',
        missingCount: 0,
        isPii: false,
      },
    ],
    columnIssues: [
      { columnKey: 'c2', issue: 'empty_name' as const, message: 'Cot c2 co ten rong' },
    ],
    hasHeader: true,
    delimiter: ',' as const,
    currentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    version: 1,
  };

  const buildDataset = (overrides: Partial<typeof baseDatasetProps> = {}): Dataset =>
    Dataset.reconstitute({ ...baseDatasetProps, ...overrides });

  beforeEach(async () => {
    findByIdMock = jest.fn().mockImplementation(async () => buildDataset());
    updateNameMock = jest
      .fn()
      .mockImplementation(async (_id: string, name: string) => buildDataset({ name }));
    updateColumnNamesMock = jest
      .fn()
      .mockImplementation(
        async (
          _id: string,
          updates: Array<{ columnKey: string; name: string }>,
          columnIssues: DatasetColumnIssue[],
        ) => {
          const columns = baseDatasetProps.columns.map((c) => {
            const u = updates.find((x) => x.columnKey === c.key);
            return u ? { ...c, name: u.name } : { ...c };
          });
          return buildDataset({ columns, columnIssues });
        },
      );
    resetColumnNamesMock = jest
      .fn()
      .mockImplementation(
        async (
          _id: string,
          columnIssues: DatasetColumnIssue[],
        ) => {
          const columns = baseDatasetProps.columns.map((c) => ({
            ...c,
            name: c.originalName,
          }));
          return buildDataset({ columns, columnIssues });
        },
      );

    datasetsRepository = {
      create: jest.fn().mockResolvedValue(buildDataset()),
      updateById: jest.fn(),
      findById: findByIdMock,
      findByProject: jest.fn().mockResolvedValue(null),
      bulkInsertRecords: jest.fn().mockResolvedValue(2),
      softDeleteDatasetWithRecords: jest.fn().mockResolvedValue(true),
      updateColumnPii: jest.fn(),
      updateName: updateNameMock,
      updateColumnNames: updateColumnNamesMock,
      resetColumnNames: resetColumnNamesMock,
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

  // ── PATCH /datasets/:id ────────────────────────────────────────────────

  describe('PATCH /datasets/:id — đổi tên dataset', () => {
    it('đổi tên thành công', async () => {
      const res = await service.updateDatasetMetadata(mockDatasetId, { name: 'doanh thu 2024' });
      expect(res.name).toBe('doanh thu 2024');
      expect(updateNameMock).toHaveBeenCalledWith(mockDatasetId, 'doanh thu 2024');
    });

    it('tên rỗng -> VALIDATION_ERROR', async () => {
      await expect(
        service.updateDatasetMetadata(mockDatasetId, { name: '   ' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('dataset không tồn tại -> NOT_FOUND', async () => {
      findByIdMock.mockResolvedValue(null);
      await expect(
        service.updateDatasetMetadata(mockDatasetId, { name: 'x' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('ID không hợp lệ -> VALIDATION_ERROR', async () => {
      await expect(
        service.updateDatasetMetadata('khong-hop-le', { name: 'x' }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('KHÔNG dùng updateById (tránh chạm nội dung dataset)', async () => {
      await service.updateDatasetMetadata(mockDatasetId, { name: 'x' });
      expect(datasetsRepository.updateById).not.toHaveBeenCalled();
    });
  });

  // ── PATCH /datasets/:id/columns ────────────────────────────────────────

  describe('PATCH /datasets/:id/columns — đổi tên cột', () => {
    it('đổi tên hiển thị của một cột', async () => {
      const res = await service.updateColumnNames(mockDatasetId, {
        columns: [{ columnKey: 'c0', name: 'Doanh thu' }],
      });
      const col = res.columns.find((c) => c.key === 'c0');
      expect(col?.name).toBe('Doanh thu');
      // Key bất biến
      expect(col?.key).toBe('c0');
      expect(col?.originalName).toBe('Amount');
    });

    it('đổi tên nhiều cột trong một lần', async () => {
      const res = await service.updateColumnNames(mockDatasetId, {
        columns: [
          { columnKey: 'c0', name: 'Doanh thu' },
          { columnKey: 'c1', name: 'Khách hàng' },
        ],
      });
      expect(res.columns.find((c) => c.key === 'c0')?.name).toBe('Doanh thu');
      expect(res.columns.find((c) => c.key === 'c1')?.name).toBe('Khách hàng');
    });

    it('sửa lỗi tên cột rỗng -> columnIssues được tính lại (mở khoá phân tích)', async () => {
      const res = await service.updateColumnNames(mockDatasetId, {
        columns: [{ columnKey: 'c2', name: 'Ghi chú' }],
      });
      expect(res.columns.find((c) => c.key === 'c2')?.name).toBe('Ghi chú');
      expect(res.columnIssues).toHaveLength(0);
    });

    it('key cột không tồn tại -> VALIDATION_ERROR', async () => {
      await expect(
        service.updateColumnNames(mockDatasetId, { columns: [{ columnKey: 'c99', name: 'X' }] }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('tên mới rỗng -> VALIDATION_ERROR', async () => {
      await expect(
        service.updateColumnNames(mockDatasetId, { columns: [{ columnKey: 'c0', name: '' }] }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('tên mới trùng tên cột khác -> VALIDATION_ERROR', async () => {
      await expect(
        service.updateColumnNames(mockDatasetId, {
          columns: [{ columnKey: 'c0', name: 'Customer' }],
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('tên trùng chính nó (cùng cột) -> hợp lệ', async () => {
      const res = await service.updateColumnNames(mockDatasetId, {
        columns: [{ columnKey: 'c1', name: 'Customer' }],
      });
      expect(res.columns.find((c) => c.key === 'c1')?.name).toBe('Customer');
    });

    it('dataset không tồn tại -> NOT_FOUND', async () => {
      findByIdMock.mockResolvedValue(null);
      await expect(
        service.updateColumnNames(mockDatasetId, { columns: [{ columnKey: 'c0', name: 'X' }] }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('truyền columnIssues đã tính lại xuống repository', async () => {
      await service.updateColumnNames(mockDatasetId, {
        columns: [{ columnKey: 'c2', name: 'Ghi chú' }],
      });
      const call = updateColumnNamesMock.mock.calls[0]!;
      expect(call[2]).toEqual([]);
    });

    it('KHÔNG dùng updateById', async () => {
      await service.updateColumnNames(mockDatasetId, {
        columns: [{ columnKey: 'c0', name: 'X' }],
      });
      expect(datasetsRepository.updateById).not.toHaveBeenCalled();
    });
  });

  // ── POST /datasets/:id/columns/reset ───────────────────────────────────

  describe('POST /datasets/:id/columns/reset — khôi phục tên gốc', () => {
    it('khôi phục tên cột về tên gốc trong file CSV', async () => {
      findByIdMock.mockImplementation(async () =>
        buildDataset({
          columns: baseDatasetProps.columns.map((c, i) =>
            i === 0 ? { ...c, name: 'Doanh thu' } : { ...c },
          ),
        }),
      );
      const res = await service.resetColumnNames(mockDatasetId);
      expect(res.columns.find((c) => c.key === 'c0')?.name).toBe('Amount');
      expect(resetColumnNamesMock).toHaveBeenCalled();
    });

    it('không có cột nào khác tên gốc -> VALIDATION_ERROR (yêu cầu thừa)', async () => {
      await expect(service.resetColumnNames(mockDatasetId)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('dataset không tồn tại -> NOT_FOUND', async () => {
      findByIdMock.mockResolvedValue(null);
      await expect(service.resetColumnNames(mockDatasetId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('ID không hợp lệ -> VALIDATION_ERROR', async () => {
      await expect(service.resetColumnNames('khong-hop-le')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('KHÔNG dùng updateById', async () => {
      findByIdMock.mockImplementation(async () =>
        buildDataset({
          columns: baseDatasetProps.columns.map((c, i) =>
            i === 0 ? { ...c, name: 'Doanh thu' } : { ...c },
          ),
        }),
      );
      await service.resetColumnNames(mockDatasetId);
      expect(datasetsRepository.updateById).not.toHaveBeenCalled();
    });
  });
});
