import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Readable } from 'stream';
import * as crypto from 'crypto';
import { VersionsService } from '../src/modules/versions/versions.service';
import { VersionsRepository } from '../src/modules/versions/versions.repository';
import { DatasetsRepository } from '../src/modules/datasets/datasets.repository';
import { DatasetsService } from '../src/modules/datasets/datasets.service';
import { StorageService } from '../src/shared/storage/storage.service';
import { OutboxService } from '../src/shared/application/outbox/outbox.service';
import { IDataset } from '../src/modules/datasets/schemas/dataset.schema';
import { IDatasetVersion } from '../src/modules/versions/schemas/dataset-version.schema';

describe('VersionsService (Merkle Hash Chaining, Snapshot & Rollback)', () => {
  let service: VersionsService;
  let versionsRepository: jest.Mocked<Partial<VersionsRepository>>;
  let datasetsRepository: jest.Mocked<Partial<DatasetsRepository>>;
  let datasetsService: jest.Mocked<Partial<DatasetsService>>;
  let mockRecordModel: {
    find: jest.Mock;
    deleteMany: jest.Mock;
  };
  let storageService: jest.Mocked<Partial<StorageService>>;
  let outboxService: jest.Mocked<Partial<OutboxService>>;

  const mockDatasetId = new Types.ObjectId();
  const mockUserId = new Types.ObjectId();
  const mockDatasetDoc = {
    _id: mockDatasetId,
    name: 'test_dataset',
    columns: [
      { name: 'col1', data_type: 'string', original_name: 'col1', missing_count: 0 },
      { name: 'col2', data_type: 'string', original_name: 'col2', missing_count: 0 },
    ],
    current_version: 1,
    row_count: 2,
  } as unknown as IDataset;

  beforeEach(async () => {
    async function* mockCursorGenerator() {
      yield { data: { col1: 'val1', col2: 'val2' } };
      yield { data: { col1: 'val3', col2: 'val4' } };
    }

    mockRecordModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          cursor: jest.fn().mockImplementation(() => mockCursorGenerator()),
        }),
      }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
    };

    versionsRepository = {
      findLatestByDatasetId: jest.fn(),
      findByDatasetAndVersion: jest.fn(),
      findByDatasetId: jest.fn(),
      create: jest.fn(),
    };

    datasetsRepository = {
      updateById: jest.fn().mockResolvedValue(mockDatasetDoc),
      bulkInsertRecords: jest.fn().mockResolvedValue(2),
    };

    datasetsService = {
      getDatasetById: jest.fn().mockResolvedValue(mockDatasetDoc),
    };

    storageService = {
      uploadStream: jest.fn().mockImplementation(async (key: string, stream: Readable) => {
        for await (const _ of stream) {
          // drain stream to allow upload completion
        }
        return key;
      }),
      downloadStream: jest.fn().mockImplementation(async () => {
        return Readable.from(['col1,col2\nval1,val2\nval3,val4\n']);
      }),
    };

    outboxService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VersionsService,
        { provide: VersionsRepository, useValue: versionsRepository },
        { provide: DatasetsRepository, useValue: datasetsRepository },
        { provide: DatasetsService, useValue: datasetsService },
        { provide: getModelToken('DatasetRecord'), useValue: mockRecordModel },
        { provide: StorageService, useValue: storageService },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = module.get<VersionsService>(VersionsService);
  });

  describe('commitVersion (F7.1)', () => {
    it('should create initial version v1 with parent_hash of 64 zeros and valid Merkle root', async () => {
      (versionsRepository.findLatestByDatasetId as jest.Mock).mockResolvedValue(null);

      const createdVersionDoc = {
        _id: new Types.ObjectId(),
        dataset_id: mockDatasetId,
        version_number: 1,
        parent_hash: '0'.repeat(64),
        parent_version_id: null,
        rules_hash: '0'.repeat(64),
        data_checksum: 'checksum123',
        version_hash: 'merklehash123',
        snapshot_storage_key: `snapshots/${mockDatasetId.toHexString()}_v1.csv`,
        record_count: 2,
        change_summary: { description: 'Initial commit', rule_ids: [] },
        created_by: mockUserId,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as IDatasetVersion;

      (versionsRepository.create as jest.Mock).mockResolvedValue(createdVersionDoc);

      const result = await service.commitVersion(
        mockDatasetId.toHexString(),
        mockUserId.toHexString(),
        {
          description: 'Initial commit',
          rule_ids: [],
        }
      );

      expect(result).toBeDefined();
      expect(result.version_number).toBe(1);
      expect(storageService.uploadStream).toHaveBeenCalledWith(
        `snapshots/${mockDatasetId.toHexString()}_v1.csv`,
        expect.anything(),
        'text/csv'
      );
      expect(datasetsRepository.updateById).toHaveBeenCalledWith(
        mockDatasetId.toHexString(),
        expect.objectContaining({
          $set: expect.objectContaining({
            current_version: 1,
            row_count: 2,
          }),
        })
      );
      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregate_type: 'DATASET_VERSION',
          event_type: 'VERSION_COMMITTED',
        })
      );
    });

    it('should chain parent_hash from previous version for v2', async () => {
      const prevVersionDoc = {
        _id: new Types.ObjectId(),
        version_number: 1,
        version_hash: 'a'.repeat(64),
      } as unknown as IDatasetVersion;

      (versionsRepository.findLatestByDatasetId as jest.Mock).mockResolvedValue(prevVersionDoc);

      const createdV2Doc = {
        _id: new Types.ObjectId(),
        dataset_id: mockDatasetId,
        version_number: 2,
        parent_hash: 'a'.repeat(64),
        parent_version_id: prevVersionDoc._id,
        rules_hash: crypto.createHash('sha256').update(JSON.stringify(['rule-1'])).digest('hex'),
        data_checksum: 'checksum456',
        version_hash: 'merklehash456',
        snapshot_storage_key: `snapshots/${mockDatasetId.toHexString()}_v2.csv`,
        record_count: 2,
        change_summary: { description: 'Applied rule 1', rule_ids: ['rule-1'] },
        created_by: mockUserId,
        created_at: new Date(),
        updated_at: new Date(),
      } as unknown as IDatasetVersion;

      (versionsRepository.create as jest.Mock).mockResolvedValue(createdV2Doc);

      const result = await service.commitVersion(
        mockDatasetId.toHexString(),
        mockUserId.toHexString(),
        {
          description: 'Applied rule 1',
          rule_ids: ['rule-1'],
        }
      );

      expect(result.version_number).toBe(2);
      expect(result.parent_hash).toBe('a'.repeat(64));
    });
  });

  describe('getVersions (F7.2)', () => {
    it('should return paginated versions for a dataset', async () => {
      const mockItems = [
        {
          _id: new Types.ObjectId(),
          dataset_id: mockDatasetId,
          version_number: 2,
          parent_hash: 'parent_hash',
          parent_version_id: null,
          rules_hash: '0'.repeat(64),
          data_checksum: 'chk2',
          version_hash: 'hash2',
          snapshot_storage_key: 'key2',
          record_count: 10,
          change_summary: { description: 'v2', rule_ids: [] },
          created_by: mockUserId,
          created_at: new Date(),
        } as unknown as IDatasetVersion,
      ];

      (versionsRepository.findByDatasetId as jest.Mock).mockResolvedValue({
        items: mockItems,
        total: 1,
      });

      const res = await service.getVersions(mockDatasetId.toHexString(), { limit: 10, skip: 0 });

      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.items[0].version_number).toBe(2);
    });
  });

  describe('getVersionByNumber (F7.3)', () => {
    it('should throw NotFoundException if version does not exist', async () => {
      (versionsRepository.findByDatasetAndVersion as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getVersionByNumber(mockDatasetId.toHexString(), 999)
      ).rejects.toThrow('Không tìm thấy phiên bản 999');
    });

    it('should return version detail when version exists', async () => {
      const mockVersion = {
        _id: new Types.ObjectId(),
        dataset_id: mockDatasetId,
        version_number: 1,
        parent_hash: '0'.repeat(64),
        parent_version_id: null,
        rules_hash: '0'.repeat(64),
        data_checksum: 'chk',
        version_hash: 'vhash',
        snapshot_storage_key: 'key',
        record_count: 5,
        change_summary: { description: 'init', rule_ids: [] },
        created_by: mockUserId,
        created_at: new Date(),
      } as unknown as IDatasetVersion;

      (versionsRepository.findByDatasetAndVersion as jest.Mock).mockResolvedValue(mockVersion);

      const res = await service.getVersionByNumber(mockDatasetId.toHexString(), 1);

      expect(res).toBeDefined();
      expect(res.version_number).toBe(1);
      expect(res.record_count).toBe(5);
    });
  });

  describe('diffVersions (F7.4)', () => {
    it('should calculate structural and data difference between v1 and v2', async () => {
      const v1 = {
        _id: new Types.ObjectId(),
        dataset_id: mockDatasetId,
        version_number: 1,
        version_hash: 'hash1',
        data_checksum: 'checksum_identical',
        record_count: 100,
        change_summary: { description: 'v1', rule_ids: ['rule-a'] },
      } as unknown as IDatasetVersion;

      const v2 = {
        _id: new Types.ObjectId(),
        dataset_id: mockDatasetId,
        version_number: 2,
        version_hash: 'hash2',
        data_checksum: 'checksum_identical',
        record_count: 95,
        change_summary: { description: 'v2', rule_ids: ['rule-a', 'rule-b'] },
      } as unknown as IDatasetVersion;

      (versionsRepository.findByDatasetAndVersion as jest.Mock)
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const diff = await service.diffVersions(mockDatasetId.toHexString(), 1, 2);

      expect(diff.dataset_id).toBe(mockDatasetId.toHexString());
      expect(diff.record_count_diff).toBe(-5);
      expect(diff.is_data_identical).toBe(true);
      expect(diff.rules_added).toEqual(['rule-b']);
      expect(diff.rules_removed).toEqual([]);
    });
  });

  describe('rollbackVersion (F7.5)', () => {
    it('should download snapshot from R2, delete current records, bulkInsert restored records and emit event', async () => {
      const targetVersion = {
        _id: new Types.ObjectId(),
        dataset_id: mockDatasetId,
        version_number: 1,
        parent_hash: '0'.repeat(64),
        parent_version_id: null,
        rules_hash: '0'.repeat(64),
        data_checksum: 'target_chk',
        version_hash: 'target_vhash',
        snapshot_storage_key: 'snapshots/target.csv',
        record_count: 2,
        change_summary: { description: 'init', rule_ids: [] },
        created_by: mockUserId,
        created_at: new Date(),
      } as unknown as IDatasetVersion;

      (versionsRepository.findByDatasetAndVersion as jest.Mock).mockResolvedValue(targetVersion);

      const result = await service.rollbackVersion(
        mockDatasetId.toHexString(),
        1,
        mockUserId.toHexString()
      );

      expect(storageService.downloadStream).toHaveBeenCalledWith('snapshots/target.csv');
      expect(mockRecordModel.deleteMany).toHaveBeenCalledWith({
        dataset_id: expect.any(Types.ObjectId),
      });
      expect(datasetsRepository.bulkInsertRecords).toHaveBeenCalled();
      expect(datasetsRepository.updateById).toHaveBeenCalledWith(
        mockDatasetId.toHexString(),
        expect.objectContaining({
          $set: expect.objectContaining({
            current_version: 1,
            row_count: 2,
            file_checksum: 'target_chk',
          }),
        })
      );
      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregate_type: 'DATASET',
          event_type: 'VERSION_ROLLED_BACK',
        })
      );
      expect(result.message).toContain('Khôi phục thành công');
      expect(result.version.version_number).toBe(1);
    });
  });
});
