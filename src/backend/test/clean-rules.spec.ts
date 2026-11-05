import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CleanRulesService } from '../src/modules/clean-rules/clean-rules.service';
import { CleanRulesRepository } from '../src/modules/clean-rules/clean-rules.repository';
import { RuleExecutorService } from '../src/modules/clean-rules/services/rule-executor.service';
import { DatasetsService } from '../src/modules/datasets/datasets.service';
import { DatasetsRepository } from '../src/modules/datasets/datasets.repository';
import { VersionsService } from '../src/modules/versions/versions.service';
import { OutboxService } from '../src/shared/application/outbox/outbox.service';
import { IDataset } from '../src/modules/datasets/schemas/dataset.schema';
import { ICleanRule } from '../src/modules/clean-rules/schemas/clean-rule.schema';
import { VersionDetailDto } from '../src/modules/versions/dto/version.dto';

describe('CleanRules Module (4 Groups Deterministic Rule Engine, Preview & Apply)', () => {
  let cleanRulesService: CleanRulesService;
  let ruleExecutorService: RuleExecutorService;
  let cleanRulesRepository: jest.Mocked<Partial<CleanRulesRepository>>;
  let datasetsService: jest.Mocked<Partial<DatasetsService>>;
  let datasetsRepository: jest.Mocked<Partial<DatasetsRepository>>;
  let versionsService: jest.Mocked<Partial<VersionsService>>;
  let outboxService: jest.Mocked<Partial<OutboxService>>;
  let mockRecordModel: {
    find: jest.Mock;
    deleteMany: jest.Mock;
  };

  const mockDatasetId = new Types.ObjectId();
  const mockWorkspaceId = new Types.ObjectId();
  const mockUserId = new Types.ObjectId();

  const mockDatasetDoc = {
    _id: mockDatasetId,
    workspace_id: mockWorkspaceId,
    name: 'sales_dataset',
    current_version: 1,
    row_count: 3,
  } as unknown as IDataset;

  beforeEach(async () => {
    ruleExecutorService = new RuleExecutorService();

    cleanRulesRepository = {
      findByDatasetId: jest.fn(),
      bulkInsertRules: jest.fn(),
    };

    datasetsService = {
      getDatasetById: jest.fn().mockResolvedValue(mockDatasetDoc),
    };

    datasetsRepository = {
      bulkInsertRecords: jest.fn().mockResolvedValue(3),
      updateById: jest.fn().mockResolvedValue(mockDatasetDoc),
    };

    const mockVersionResult: VersionDetailDto = {
      id: new Types.ObjectId().toHexString(),
      dataset_id: mockDatasetId.toHexString(),
      version_number: 2,
      parent_hash: '0'.repeat(64),
      parent_version_id: null,
      rules_hash: 'rules_hash_123',
      data_checksum: 'checksum_123',
      version_hash: 'merkle_root_hash_123',
      snapshot_storage_key: `snapshots/${mockDatasetId.toHexString()}_v2.csv`,
      record_count: 2,
      change_summary: { description: 'Applied rules', rule_ids: ['rule1'] },
      created_by: mockUserId.toHexString(),
      created_at: new Date(),
    };

    versionsService = {
      commitVersion: jest.fn().mockResolvedValue(mockVersionResult),
    };

    outboxService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockRecordModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([
                { data: { name: '  Alice  ', age: null, email: 'alice@example.com' } },
                { data: { name: 'BOB', age: 25, email: 'bob@bad' } },
                { data: { name: '  Charlie ', age: 35, email: 'charlie@example.com' } },
              ]),
            }),
          }),
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([
              { data: { name: '  Alice  ', age: null, email: 'alice@example.com' } },
              { data: { name: 'BOB', age: 25, email: 'bob@bad' } },
              { data: { name: '  Charlie ', age: 35, email: 'charlie@example.com' } },
            ]),
          }),
        }),
      }),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 3 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanRulesService,
        { provide: RuleExecutorService, useValue: ruleExecutorService },
        { provide: CleanRulesRepository, useValue: cleanRulesRepository },
        { provide: DatasetsService, useValue: datasetsService },
        { provide: DatasetsRepository, useValue: datasetsRepository },
        { provide: VersionsService, useValue: versionsService },
        { provide: OutboxService, useValue: outboxService },
        { provide: getModelToken('DatasetRecord'), useValue: mockRecordModel },
      ],
    }).compile();

    cleanRulesService = module.get<CleanRulesService>(CleanRulesService);
  });

  describe('RuleExecutorService - In-memory Pure Engine', () => {
    it('1. Null Handling: should drop rows with null or fill default/mean/median', () => {
      const data = [
        { id: 1, val: null },
        { id: 2, val: 20 },
        { id: 3, val: 40 },
      ];

      // DROP_ROW
      const dropRes = ruleExecutorService.executeRules(data, [
        { category: 'null_handling', action: 'DROP_ROW', target_column: 'val', parameters: {} },
      ]);
      expect(dropRes.transformedRecords).toHaveLength(2);
      expect(dropRes.droppedRowsCount).toBe(1);

      // FILL_DEFAULT
      const fillDefRes = ruleExecutorService.executeRules(data, [
        {
          category: 'null_handling',
          action: 'FILL_DEFAULT',
          target_column: 'val',
          parameters: { default_value: 0 },
        },
      ]);
      expect(fillDefRes.transformedRecords[0].val).toBe(0);

      // FILL_MEAN
      const fillMeanRes = ruleExecutorService.executeRules(data, [
        { category: 'null_handling', action: 'FILL_MEAN', target_column: 'val', parameters: {} },
      ]);
      expect(fillMeanRes.transformedRecords[0].val).toBe(30);
    });

    it('2. Standardization: should trim, uppercase, lowercase, cast numeric and format date', () => {
      const data = [
        { name: '  john   doe  ', code: 'abc', date_str: '2026-10-25T08:00:00Z', price: '$1,250.50' },
      ];

      const res = ruleExecutorService.executeRules(data, [
        { category: 'standardization', action: 'TRIM', target_column: 'name', parameters: {} },
        { category: 'standardization', action: 'UPPERCASE', target_column: 'code', parameters: {} },
        { category: 'standardization', action: 'DATE_FORMAT', target_column: 'date_str', parameters: {} },
        { category: 'standardization', action: 'NUMERIC_CAST', target_column: 'price', parameters: {} },
      ]);

      const transformed = res.transformedRecords[0];
      expect(transformed.name).toBe('john doe');
      expect(transformed.code).toBe('ABC');
      expect(transformed.date_str).toBe('2026-10-25');
      expect(transformed.price).toBe(1250.5);
    });

    it('3. Deduplication: should drop duplicate rows based on key columns', () => {
      const data = [
        { email: 'user@test.com', name: 'User 1' },
        { email: 'user@test.com', name: 'User 1 duplicate' },
        { email: 'other@test.com', name: 'User 2' },
      ];

      const res = ruleExecutorService.executeRules(data, [
        {
          category: 'deduplication',
          action: 'DROP_DUPLICATES',
          target_columns: ['email'],
          parameters: { keep: 'first' },
        },
      ]);

      expect(res.transformedRecords).toHaveLength(2);
      expect(res.droppedRowsCount).toBe(1);
      expect(res.transformedRecords[0].email).toBe('user@test.com');
      expect(res.transformedRecords[1].email).toBe('other@test.com');
    });

    it('4. Regex Validation: should replace pattern or filter invalid rows', () => {
      const data = [
        { phone: '84-0901234567', email: 'valid@example.com' },
        { phone: '84-0987654321', email: 'invalid_email' },
      ];

      const res = ruleExecutorService.executeRules(data, [
        {
          category: 'regex',
          action: 'REPLACE_PATTERN',
          target_column: 'phone',
          parameters: { pattern: '^84-', replacement: '0' },
        },
        {
          category: 'regex',
          action: 'FILTER_PATTERN',
          target_column: 'email',
          parameters: { pattern: '^[^@]+@[^@]+\\.[^@]+$' },
        },
      ]);

      expect(res.transformedRecords).toHaveLength(1);
      expect(res.transformedRecords[0].phone).toBe('00901234567');
      expect(res.transformedRecords[0].email).toBe('valid@example.com');
    });
  });

  describe('CleanRulesService - F6.1 Preview (Dry-run)', () => {
    it('should preview transformations on 100 sample rows without touching database', async () => {
      const previewRes = await cleanRulesService.previewRules(mockDatasetId.toHexString(), {
        rules: [
          { category: 'standardization', action: 'TRIM', target_column: 'name', parameters: {} },
        ],
      });

      expect(previewRes).toBeDefined();
      expect(previewRes.total_sample_rows).toBe(3);
      expect(previewRes.sample_before[0].name).toBe('  Alice  ');
      expect(previewRes.sample_after[0].name).toBe('Alice');
      expect(previewRes.rule_stats).toHaveLength(1);

      // Verify no write operations were performed on MongoDB
      expect(mockRecordModel.deleteMany).not.toHaveBeenCalled();
      expect(datasetsRepository.bulkInsertRecords).not.toHaveBeenCalled();
      expect(versionsService.commitVersion).not.toHaveBeenCalled();
    });
  });

  describe('CleanRulesService - F6.2 Apply Rules (Batch Apply & Commit Version)', () => {
    it('should save rules, bulkWrite transformed records, commit version and record Outbox event', async () => {
      const mockSavedRules = [
        {
          _id: new Types.ObjectId(),
          dataset_id: mockDatasetId,
          workspace_id: mockWorkspaceId,
          name: 'Trim name',
          category: 'standardization',
          action: 'TRIM',
          target_column: 'name',
          target_columns: [],
          parameters: {},
          is_active: true,
          created_by: mockUserId,
          created_at: new Date(),
        } as unknown as ICleanRule,
      ];

      (cleanRulesRepository.bulkInsertRules as jest.Mock).mockResolvedValue(mockSavedRules);

      const applyRes = await cleanRulesService.applyRules(
        mockDatasetId.toHexString(),
        mockUserId.toHexString(),
        {
          description: 'Trimmed names',
          rules: [
            { category: 'standardization', action: 'TRIM', target_column: 'name', parameters: {} },
          ],
        }
      );

      expect(cleanRulesRepository.bulkInsertRules).toHaveBeenCalled();
      expect(mockRecordModel.deleteMany).toHaveBeenCalledWith({
        dataset_id: expect.any(Types.ObjectId),
      });
      expect(datasetsRepository.bulkInsertRecords).toHaveBeenCalled();
      expect(versionsService.commitVersion).toHaveBeenCalledWith(
        mockDatasetId.toHexString(),
        mockUserId.toHexString(),
        expect.objectContaining({
          description: 'Trimmed names',
          rule_ids: [mockSavedRules[0]._id.toHexString()],
        })
      );
      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregate_type: 'DATASET',
          event_type: 'RULES_APPLIED',
        })
      );
      expect(applyRes.version.version_number).toBe(2);
    });
  });

  describe('CleanRulesService - F6.3 Get Rules History', () => {
    it('should return list of saved rules for the dataset', async () => {
      const mockRule = {
        _id: new Types.ObjectId(),
        dataset_id: mockDatasetId,
        workspace_id: mockWorkspaceId,
        name: 'Trim names',
        category: 'standardization',
        action: 'TRIM',
        target_column: 'name',
        target_columns: [],
        parameters: {},
        is_active: true,
        created_by: mockUserId,
        created_at: new Date(),
      } as unknown as ICleanRule;

      (cleanRulesRepository.findByDatasetId as jest.Mock).mockResolvedValue([mockRule]);

      const res = await cleanRulesService.getRules(mockDatasetId.toHexString());
      expect(res.rules).toHaveLength(1);
      expect(res.rules[0].name).toBe('Trim names');
    });
  });
});
