import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PassThrough, Readable } from 'stream';
import { Response } from 'express';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExportsService } from '../src/modules/exports/exports.service';
import { ExportsRepository } from '../src/modules/exports/exports.repository';
import { ExportsController } from '../src/modules/exports/exports.controller';
import { DatasetsService } from '../src/modules/datasets/datasets.service';
import { StorageService } from '../src/shared/storage/storage.service';
import { OutboxService } from '../src/shared/application/outbox/outbox.service';
import { IDataset } from '../src/modules/datasets/schemas/dataset.schema';
import { IExportTask } from '../src/modules/exports/schemas/export-task.schema';
import { decryptAes256GcmBuffer, MAGIC_HEADER } from '../src/shared/crypto/crypto.util';
import { CurrentUserPayload } from '../src/shared/decorators/current-user.decorator';

class MockResponse extends PassThrough {
  headers: Record<string, string> = {};

  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  getHeader(name: string): string | undefined {
    return this.headers[name.toLowerCase()];
  }
}

describe('Exports Module (Streaming CSV, AES-256-GCM Secure Encrypted Export & History)', () => {
  let exportsService: ExportsService;
  let exportsController: ExportsController;
  let exportsRepository: jest.Mocked<Partial<ExportsRepository>>;
  let datasetsService: jest.Mocked<Partial<DatasetsService>>;
  let storageService: jest.Mocked<Partial<StorageService>>;
  let outboxService: jest.Mocked<Partial<OutboxService>>;
  let mockRecordModel: {
    find: jest.Mock;
  };

  const mockDatasetId = new Types.ObjectId();
  const mockWorkspaceId = new Types.ObjectId();
  const mockUserId = new Types.ObjectId();

  const mockDatasetDoc = {
    _id: mockDatasetId,
    workspace_id: mockWorkspaceId,
    name: 'customers_clean',
    columns: [
      { name: 'id', inferred_type: 'number' },
      { name: 'name', inferred_type: 'string' },
      { name: 'email', inferred_type: 'string' },
    ],
    current_version: 1,
    row_count: 2,
  } as unknown as IDataset;

  const mockRecords = [
    { row_index: 0, data: { id: 1, name: 'Alice', email: 'alice@example.com' } },
    { row_index: 1, data: { id: 2, name: 'Bob', email: 'bob@example.com' } },
  ];

  beforeEach(async () => {
    exportsRepository = {
      create: jest.fn().mockImplementation((data: Partial<IExportTask>) => Promise.resolve(data as IExportTask)),
      findByDatasetId: jest.fn(),
    };

    datasetsService = {
      getDatasetById: jest.fn().mockResolvedValue(mockDatasetDoc),
    };

    storageService = {
      uploadStream: jest.fn().mockImplementation((_key: string, stream: Readable) => {
        return new Promise<void>((resolve, reject) => {
          stream.on('data', () => {});
          stream.on('end', () => resolve());
          stream.on('error', (err: unknown) => reject(err));
        });
      }),
    };

    outboxService = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'outbox-1' } as unknown as never),
    };

    mockRecordModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          cursor: jest.fn().mockImplementation(() => {
            let index = 0;
            return {
              [Symbol.asyncIterator]() {
                return {
                  async next() {
                    if (index < mockRecords.length) {
                      return { value: mockRecords[index++], done: false };
                    }
                    return { value: undefined, done: true };
                  },
                };
              },
            };
          }),
        }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportsService,
        { provide: ExportsRepository, useValue: exportsRepository },
        { provide: DatasetsService, useValue: datasetsService },
        { provide: getModelToken('DatasetRecord'), useValue: mockRecordModel },
        { provide: StorageService, useValue: storageService },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    exportsService = module.get<ExportsService>(ExportsService);
    exportsController = new ExportsController(exportsService);
  });

  describe('F9.1: Stream CSV Export (exportCsvStream)', () => {
    it('should throw BadRequestException if datasetId is invalid', async () => {
      const mockRes = new MockResponse() as unknown as Response;
      await expect(
        exportsService.exportCsvStream('invalid-id', mockUserId.toHexString(), undefined, mockRes)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if dataset does not exist', async () => {
      datasetsService.getDatasetById = jest.fn().mockResolvedValue(null);
      const mockRes = new MockResponse() as unknown as Response;
      await expect(
        exportsService.exportCsvStream(
          new Types.ObjectId().toHexString(),
          mockUserId.toHexString(),
          undefined,
          mockRes
        )
      ).rejects.toThrow(NotFoundException);
    });

    it('should stream CSV records correctly with headers and record in repository', async () => {
      const mockRes = new MockResponse();
      const chunks: Buffer[] = [];

      mockRes.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      const exportPromise = exportsService.exportCsvStream(
        mockDatasetId.toHexString(),
        mockUserId.toHexString(),
        1,
        mockRes as unknown as Response
      );

      await exportPromise;

      const outputCsv = Buffer.concat(chunks).toString('utf8');
      expect(outputCsv).toContain('id,name,email');
      expect(outputCsv).toContain('1,Alice,alice@example.com');
      expect(outputCsv).toContain('2,Bob,bob@example.com');

      expect(mockRes.getHeader('content-type')).toBe('text/csv; charset=utf-8');
      expect(mockRes.getHeader('content-disposition')).toContain('customers_clean_v1.csv');

      expect(exportsRepository.create).toHaveBeenCalledTimes(1);
      const createdArgs = (exportsRepository.create as jest.Mock).mock.calls[0][0] as Partial<IExportTask>;
      expect(createdArgs.export_type).toBe('csv');
      expect(createdArgs.record_count).toBe(2);
      expect(createdArgs.is_encrypted).toBe(false);
    });
  });

  describe('F9.2: AES-256-GCM Secure Streaming Export (exportSecureStream)', () => {
    const password = 'StrongPassword123!';

    it('should throw BadRequestException for invalid datasetId', async () => {
      const mockRes = new MockResponse() as unknown as Response;
      await expect(
        exportsService.exportSecureStream('invalid-id', mockUserId.toHexString(), { password }, mockRes)
      ).rejects.toThrow(BadRequestException);
    });

    it('should stream encrypted binary data, upload copy to R2, and record outbox event', async () => {
      const mockRes = new MockResponse();
      const encryptedChunks: Buffer[] = [];

      mockRes.on('data', (chunk: Buffer) => {
        encryptedChunks.push(chunk);
      });

      await exportsService.exportSecureStream(
        mockDatasetId.toHexString(),
        mockUserId.toHexString(),
        { password, version: 1 },
        mockRes as unknown as Response
      );

      const encryptedBuffer = Buffer.concat(encryptedChunks);

      // 1. Kiểm tra Magic Header 8B: 'DATAQUAL'
      expect(encryptedBuffer.subarray(0, 8).equals(MAGIC_HEADER)).toBe(true);

      // 2. Giải mã bằng mật khẩu đúng và đối chiếu nội dung CSV
      const decryptedBuffer = decryptAes256GcmBuffer(encryptedBuffer, password);
      const decryptedCsv = decryptedBuffer.toString('utf8');
      expect(decryptedCsv).toContain('id,name,email');
      expect(decryptedCsv).toContain('1,Alice,alice@example.com');
      expect(decryptedCsv).toContain('2,Bob,bob@example.com');

      // 3. Giải mã bằng mật khẩu sai phải ném lỗi toàn vẹn
      expect(() => {
        decryptAes256GcmBuffer(encryptedBuffer, 'WrongPassword999!');
      }).toThrow();

      // 4. Kiểm tra headers
      expect(mockRes.getHeader('content-type')).toBe('application/octet-stream');
      expect(mockRes.getHeader('content-disposition')).toContain('customers_clean_v1.enc.csv');

      // 5. Kiểm tra upload R2 và ghi nhận Outbox
      expect(storageService.uploadStream).toHaveBeenCalledTimes(1);
      expect(exportsRepository.create).toHaveBeenCalledTimes(1);
      const taskArgs = (exportsRepository.create as jest.Mock).mock.calls[0][0] as Partial<IExportTask>;
      expect(taskArgs.is_encrypted).toBe(true);
      expect(taskArgs.export_type).toBe('aes256_gcm');
      expect(taskArgs.record_count).toBe(2);

      expect(outboxService.recordEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Export History (getExportHistory)', () => {
    it('should throw BadRequestException if datasetId is invalid', async () => {
      await expect(exportsService.getExportHistory('invalid-id')).rejects.toThrow(BadRequestException);
    });

    it('should return export tasks history for dataset', async () => {
      const mockTaskId = new Types.ObjectId();
      const mockTask: Partial<IExportTask> = {
        _id: mockTaskId,
        dataset_id: mockDatasetId,
        workspace_id: mockWorkspaceId,
        export_type: 'aes256_gcm',
        file_name: 'customers_clean.enc.csv',
        storage_key: 'exports/task-1.enc.csv',
        file_size_bytes: 1024,
        record_count: 2,
        checksum_sha256: 'mock-sha256',
        is_encrypted: true,
        created_by: mockUserId,
        created_at: new Date(),
      };

      exportsRepository.findByDatasetId = jest.fn().mockResolvedValue([mockTask as IExportTask]);

      const result = await exportsService.getExportHistory(mockDatasetId.toHexString());
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(mockTaskId.toHexString());
      expect(result.items[0].is_encrypted).toBe(true);
      expect(result.items[0].file_name).toBe('customers_clean.enc.csv');
    });
  });

  describe('ExportsController Delegation', () => {
    const mockUser: CurrentUserPayload = {
      userId: mockUserId.toHexString(),
      email: 'analyst@dataqual.io',
      role: 'analyst',
    };

    it('should delegate exportCsv to service', async () => {
      const spy = jest.spyOn(exportsService, 'exportCsvStream').mockResolvedValue(undefined);
      const mockRes = new MockResponse() as unknown as Response;

      await exportsController.exportCsv(
        mockDatasetId.toHexString(),
        mockUser,
        { version: 1 },
        mockRes
      );

      expect(spy).toHaveBeenCalledWith(
        mockDatasetId.toHexString(),
        mockUser.userId,
        1,
        mockRes
      );
    });

    it('should delegate exportSecure to service', async () => {
      const spy = jest.spyOn(exportsService, 'exportSecureStream').mockResolvedValue(undefined);
      const mockRes = new MockResponse() as unknown as Response;

      await exportsController.exportSecure(
        mockDatasetId.toHexString(),
        mockUser,
        { password: 'Password123!', version: 2 },
        mockRes
      );

      expect(spy).toHaveBeenCalledWith(
        mockDatasetId.toHexString(),
        mockUser.userId,
        { password: 'Password123!', version: 2 },
        mockRes
      );
    });

    it('should delegate getExportHistory to service', async () => {
      const spy = jest.spyOn(exportsService, 'getExportHistory').mockResolvedValue({ items: [] });

      const result = await exportsController.getExportHistory(mockDatasetId.toHexString());
      expect(spy).toHaveBeenCalledWith(mockDatasetId.toHexString());
      expect(result).toEqual({ items: [] });
    });
  });
});
