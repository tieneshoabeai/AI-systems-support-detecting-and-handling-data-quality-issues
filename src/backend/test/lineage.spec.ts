import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { LineageService } from '../src/modules/lineage/lineage.service';
import { LineageController } from '../src/modules/lineage/lineage.controller';
import { OutboxProcessorWorker } from '../src/modules/lineage/services/outbox-processor.worker';
import { Neo4jService } from '../src/shared/database/neo4j.service';
import { OutboxService } from '../src/shared/application/outbox/outbox.service';
import { IOutboxEvent } from '../src/shared/application/outbox/outbox-event.schema';
import { Types } from 'mongoose';

import { JwtAuthGuard } from '../src/shared/guards/jwt-auth.guard';
import { PoliciesGuard } from '../src/shared/casl/policies.guard';

describe('Lineage Module (Neo4j AuraDB & Merkle DAG)', () => {
  let lineageService: LineageService;
  let lineageController: LineageController;
  let outboxWorker: OutboxProcessorWorker;

  const mockNeo4jService = {
    runQuery: jest.fn(),
  };

  const mockOutboxService = {
    getPendingEvents: jest.fn(),
    markAsProcessed: jest.fn(),
    markAsFailed: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LineageController],
      providers: [
        LineageService,
        OutboxProcessorWorker,
        { provide: Neo4jService, useValue: mockNeo4jService },
        { provide: OutboxService, useValue: mockOutboxService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PoliciesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    lineageService = module.get<LineageService>(LineageService);
    lineageController = module.get<LineageController>(LineageController);
    outboxWorker = module.get<OutboxProcessorWorker>(OutboxProcessorWorker);
  });

  describe('LineageService - getLineageGraph', () => {
    it('should throw NotFoundException if dataset not found on Neo4j', async () => {
      mockNeo4jService.runQuery.mockResolvedValueOnce({ records: [] });

      await expect(lineageService.getLineageGraph('non_existent')).rejects.toThrow(
        NotFoundException
      );
    });

    it('should format full DAG graph with dataset, versions, and transformations for React Flow', async () => {
      const mockRecord = {
        get: jest.fn((key: string) => {
          if (key === 'd') {
            return {
              properties: {
                id: 'ds_100',
                name: 'Customer Clean Dataset',
                project_id: 'prj_1',
                workspace_id: 'ws_1',
              },
            };
          }
          if (key === 'versions') {
            return [
              {
                properties: {
                  id: 'v_1',
                  version_number: 1,
                  version_hash: 'hash_v1',
                  data_checksum: 'chk_1',
                  rules_hash: 'rules_1',
                  created_at: '2026-10-24T00:00:00Z',
                },
              },
              {
                properties: {
                  id: 'v_2',
                  version_number: 2,
                  version_hash: 'hash_v2',
                  data_checksum: 'chk_2',
                  rules_hash: 'rules_2',
                  created_at: '2026-10-24T01:00:00Z',
                },
              },
            ];
          }
          if (key === 'version_edges') {
            return [{ source: 'v_2', target: 'v_1', type: 'DERIVED_FROM' }];
          }
          if (key === 'transformations') {
            return [
              {
                properties: {
                  id: 'trans_1',
                  rule_type: 'DROP_DUPLICATES',
                  description: 'Remove duplicated emails',
                  parameters: '{"columns":["email"]}',
                  applied_at: '2026-10-24T01:00:00Z',
                },
              },
            ];
          }
          if (key === 'transform_edges') {
            return [{ source: 'v_2', target: 'trans_1', type: 'TRANSFORMED_BY' }];
          }
          return null;
        }),
      };

      mockNeo4jService.runQuery.mockResolvedValueOnce({ records: [mockRecord] });

      const result = await lineageController.getLineageGraph('ds_100');

      expect(result.dataset_id).toBe('ds_100');
      expect(result.dataset_name).toBe('Customer Clean Dataset');
      expect(result.total_nodes).toBe(4); // 1 dataset + 2 versions + 1 transformation
      expect(result.total_edges).toBe(3); // 1 initial + 1 derived + 1 applied rule

      const datasetNode = result.nodes.find((n) => n.type === 'dataset');
      expect(datasetNode).toBeDefined();
      expect(datasetNode?.id).toBe('dataset_ds_100');

      const versionNodes = result.nodes.filter((n) => n.type === 'version');
      expect(versionNodes).toHaveLength(2);
    });
  });

  describe('LineageService - Upstream & Downstream Analysis', () => {
    it('should compute hops_to_root and root_version_id for upstream trace', async () => {
      const mockRecord = {
        get: jest.fn((key: string) => {
          if (key === 'upstream_versions') {
            return [
              { properties: { id: 'v_3', version_number: 3 } },
              { properties: { id: 'v_2', version_number: 2 } },
              { properties: { id: 'v_1', version_number: 1 } },
            ];
          }
          if (key === 'transformations') {
            return [{ properties: { id: 't_1', rule_type: 'FILL_DEFAULT' } }];
          }
          return [];
        }),
      };

      mockNeo4jService.runQuery.mockResolvedValueOnce({ records: [mockRecord] });

      const upstream = await lineageController.getUpstream('v_3');
      expect(upstream.node_id).toBe('v_3');
      expect(upstream.root_version_id).toBe('v_1');
      expect(upstream.hops_to_root).toBe(2);
      expect(upstream.upstream_versions).toHaveLength(3);
    });

    it('should return downstream count for impact analysis', async () => {
      const mockRecord = {
        get: jest.fn((key: string) => {
          if (key === 'downstream_versions') {
            return [
              { properties: { id: 'v_2', version_number: 2 } },
              { properties: { id: 'v_3', version_number: 3 } },
            ];
          }
          return [];
        }),
      };

      mockNeo4jService.runQuery.mockResolvedValueOnce({ records: [mockRecord] });

      const downstream = await lineageController.getDownstream('v_1');
      expect(downstream.node_id).toBe('v_1');
      expect(downstream.downstream_count).toBe(2);
      expect(downstream.affected_exports_count).toBe(1);
    });
  });

  describe('LineageService - Merkle Integrity Verification', () => {
    it('should return is_valid: true when Merkle hashes match strictly', async () => {
      const zeroParent = '0'.repeat(64);
      const dataChecksum1 = 'chk1';
      const rulesHash1 = 'rules1';
      const hash1 = crypto
        .createHash('sha256')
        .update(dataChecksum1 + zeroParent + rulesHash1)
        .digest('hex');

      const dataChecksum2 = 'chk2';
      const rulesHash2 = 'rules2';
      const hash2 = crypto
        .createHash('sha256')
        .update(dataChecksum2 + hash1 + rulesHash2)
        .digest('hex');

      const mockRecords = [
        {
          get: jest.fn((key: string) => {
            if (key === 'version_number') return 1;
            if (key === 'version_hash') return hash1;
            if (key === 'data_checksum') return dataChecksum1;
            if (key === 'rules_hash') return rulesHash1;
            if (key === 'parent_hash') return null;
            return null;
          }),
        },
        {
          get: jest.fn((key: string) => {
            if (key === 'version_number') return 2;
            if (key === 'version_hash') return hash2;
            if (key === 'data_checksum') return dataChecksum2;
            if (key === 'rules_hash') return rulesHash2;
            if (key === 'parent_hash') return hash1;
            return null;
          }),
        },
      ];

      mockNeo4jService.runQuery.mockResolvedValueOnce({ records: mockRecords });

      const verifyRes = await lineageController.verifyIntegrityGet('ds_valid');
      expect(verifyRes.is_valid).toBe(true);
      expect(verifyRes.total_versions_checked).toBe(2);
      expect(verifyRes.broken_version_number).toBeNull();
    });

    it('should detect tampering and return is_valid: false with broken version number', async () => {
      const zeroParent = '0'.repeat(64);
      const dataChecksum1 = 'chk1';
      const rulesHash1 = 'rules1';
      const hash1 = crypto
        .createHash('sha256')
        .update(dataChecksum1 + zeroParent + rulesHash1)
        .digest('hex');

      // Giả lập Version 2 bị chỉnh sửa trộm data checksum nhưng hash không khớp
      const mockRecords = [
        {
          get: jest.fn((key: string) => {
            if (key === 'version_number') return 1;
            if (key === 'version_hash') return hash1;
            if (key === 'data_checksum') return dataChecksum1;
            if (key === 'rules_hash') return rulesHash1;
            if (key === 'parent_hash') return null;
            return null;
          }),
        },
        {
          get: jest.fn((key: string) => {
            if (key === 'version_number') return 2;
            if (key === 'version_hash') return 'TAMPERED_HASH_VAL';
            if (key === 'data_checksum') return 'tampered_data';
            if (key === 'rules_hash') return 'rules2';
            if (key === 'parent_hash') return hash1;
            return null;
          }),
        },
      ];

      mockNeo4jService.runQuery.mockResolvedValueOnce({ records: mockRecords });

      const verifyRes = await lineageController.verifyIntegrityPost('ds_tampered');
      expect(verifyRes.is_valid).toBe(false);
      expect(verifyRes.broken_version_number).toBe(2);
      expect(verifyRes.message).toContain('Phát hiện giả mạo');
    });
  });

  describe('OutboxProcessorWorker', () => {
    it('should process DATASET_INGESTED event and mark as processed', async () => {
      const fakeEvent = {
        _id: new Types.ObjectId(),
        event_type: 'DATASET_INGESTED',
        payload: {
          dataset_id: 'ds_test',
          name: 'Sales Q3',
          project_id: 'p_1',
          workspace_id: 'w_1',
          version_id: 'v_1',
          version_number: 1,
          version_hash: 'vh_1',
          data_checksum: 'dc_1',
          rules_hash: 'rh_1',
        },
      } as unknown as IOutboxEvent;

      mockOutboxService.getPendingEvents.mockResolvedValueOnce([fakeEvent]);
      mockNeo4jService.runQuery.mockResolvedValue({ records: [] });

      const count = await outboxWorker.processBatch();

      expect(count).toBe(1);
      expect(mockNeo4jService.runQuery).toHaveBeenCalledTimes(2); // sync dataset + sync version
      expect(mockOutboxService.markAsProcessed).toHaveBeenCalledWith(fakeEvent._id.toString());
    });

    it('should mark event as failed when Neo4j query throws error', async () => {
      const fakeEvent = {
        _id: new Types.ObjectId(),
        event_type: 'DATASET_INGESTED',
        payload: { dataset_id: 'ds_err' },
      } as unknown as IOutboxEvent;

      mockOutboxService.getPendingEvents.mockResolvedValueOnce([fakeEvent]);
      mockNeo4jService.runQuery.mockRejectedValueOnce(new Error('Neo4j connection timeout'));

      const count = await outboxWorker.processBatch();

      expect(count).toBe(0);
      expect(mockOutboxService.markAsFailed).toHaveBeenCalledWith(
        fakeEvent._id.toString(),
        expect.stringContaining('Neo4j connection timeout')
      );
    });
  });
});
