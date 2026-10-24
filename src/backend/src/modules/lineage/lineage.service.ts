import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Neo4jService } from '../../shared/database/neo4j.service';
import { LineageCypherQueries } from './lineage-queries.cypher';
import {
  LineageGraphResponseDto,
  LineageNodeDto,
  LineageEdgeDto,
  UpstreamResponseDto,
  DownstreamResponseDto,
  VerifyIntegrityResponseDto,
} from './dto/lineage.dto';

interface Neo4jEntity {
  properties: Record<string, unknown>;
  labels?: string[];
  type?: string;
}

@Injectable()
export class LineageService {
  private readonly logger = new Logger(LineageService.name);

  constructor(private readonly neo4jService: Neo4jService) {}

  /**
   * Lấy toàn bộ đồ thị DAG của Dataset để hiển thị trên React Flow
   */
  async getLineageGraph(datasetId: string): Promise<LineageGraphResponseDto> {
    const result = await this.neo4jService.runQuery(LineageCypherQueries.GET_FULL_DAG, {
      dataset_id: datasetId,
    });

    if (result.records.length === 0) {
      throw new NotFoundException(`Không tìm thấy đồ thị phả hệ cho Dataset ID: ${datasetId}`);
    }

    const record = result.records[0];
    const datasetNode = record.get('d') as Neo4jEntity | null;

    if (!datasetNode) {
      throw new NotFoundException(`Không tìm thấy Dataset ${datasetId} trên Neo4j AuraDB`);
    }

    const datasetProps = datasetNode.properties;
    const datasetName = String(datasetProps.name ?? 'Dataset');

    const nodes: LineageNodeDto[] = [];
    const edges: LineageEdgeDto[] = [];

    // 1. Thêm Node gốc Dataset
    nodes.push({
      id: `dataset_${datasetId}`,
      label: datasetName,
      type: 'dataset',
      data: {
        id: datasetId,
        name: datasetName,
        projectId: datasetProps.project_id,
        workspaceId: datasetProps.workspace_id,
      },
      position: { x: 300, y: 50 },
    });

    // 2. Thêm các Node Version
    const rawVersions = (record.get('versions') as Neo4jEntity[]) || [];
    const sortedVersions = rawVersions
      .filter((v): v is Neo4jEntity => v !== null && typeof v === 'object')
      .sort((a, b) => {
        const numA = Number(a.properties.version_number ?? 0);
        const numB = Number(b.properties.version_number ?? 0);
        return numA - numB;
      });

    sortedVersions.forEach((v, index) => {
      const vProps = v.properties;
      const vId = String(vProps.id ?? `v_${index + 1}`);
      const vNumber = Number(vProps.version_number ?? index + 1);

      nodes.push({
        id: `version_${vId}`,
        label: `Version ${vNumber}`,
        type: 'version',
        data: {
          id: vId,
          versionNumber: vNumber,
          versionHash: vProps.version_hash,
          dataChecksum: vProps.data_checksum,
          rulesHash: vProps.rules_hash,
          createdAt: vProps.created_at,
        },
        position: { x: 300, y: 180 + index * 140 },
      });

      // Liên kết Version 1 với Dataset gốc
      if (index === 0) {
        edges.push({
          id: `edge_d_v_${vId}`,
          source: `dataset_${datasetId}`,
          target: `version_${vId}`,
          type: 'smoothstep',
          label: 'INITIAL_VERSION',
          animated: false,
        });
      }
    });

    // 3. Thêm các Edges DERIVED_FROM giữa các Version
    const rawVersionEdges = (record.get('version_edges') as Array<{ source?: string; target?: string; type?: string }>) || [];
    rawVersionEdges.forEach((e, idx) => {
      if (e.source && e.target) {
        edges.push({
          id: `edge_df_${idx}_${e.source}_${e.target}`,
          source: `version_${e.target}`, // Parent
          target: `version_${e.source}`, // Child
          type: 'smoothstep',
          label: 'DERIVED_FROM',
          animated: true,
        });
      }
    });

    // 4. Thêm các Node Transformation và Edges TRANSFORMED_BY
    const rawTransformations = (record.get('transformations') as Neo4jEntity[]) || [];
    rawTransformations
      .filter((t): t is Neo4jEntity => t !== null && typeof t === 'object')
      .forEach((t, idx) => {
        const tProps = t.properties;
        const tId = String(tProps.id ?? `trans_${idx}`);

        nodes.push({
          id: `trans_${tId}`,
          label: String(tProps.rule_type ?? 'Transformation'),
          type: 'transformation',
          data: {
            id: tId,
            ruleType: tProps.rule_type,
            description: tProps.description,
            parameters: tProps.parameters,
            appliedAt: tProps.applied_at,
          },
          position: { x: 580, y: 180 + idx * 100 },
        });
      });

    const rawTransformEdges = (record.get('transform_edges') as Array<{ source?: string; target?: string; type?: string }>) || [];
    rawTransformEdges.forEach((te, idx) => {
      if (te.source && te.target) {
        edges.push({
          id: `edge_tb_${idx}_${te.source}_${te.target}`,
          source: `version_${te.source}`,
          target: `trans_${te.target}`,
          type: 'smoothstep',
          label: 'APPLIED_RULE',
          animated: false,
        });
      }
    });

    return {
      dataset_id: datasetId,
      dataset_name: datasetName,
      nodes,
      edges,
      total_nodes: nodes.length,
      total_edges: edges.length,
    };
  }

  /**
   * Truy vết ngược nguồn gốc (Root Cause Analysis - Upstream)
   */
  async getUpstream(nodeId: string): Promise<UpstreamResponseDto> {
    const result = await this.neo4jService.runQuery(LineageCypherQueries.GET_UPSTREAM, {
      node_id: nodeId,
    });

    if (result.records.length === 0) {
      return {
        node_id: nodeId,
        root_version_id: null,
        hops_to_root: 0,
        upstream_versions: [],
        transformations: [],
      };
    }

    const record = result.records[0];
    const rawUpstream = (record.get('upstream_versions') as Neo4jEntity[]) || [];
    const rawTransforms = (record.get('transformations') as Neo4jEntity[]) || [];

    const upstreamVersions = rawUpstream.map((u) => (u?.properties ? (u.properties as Record<string, unknown>) : {}));
    const transformations = rawTransforms.map((t) => (t?.properties ? (t.properties as Record<string, unknown>) : {}));

    const rootVersion = upstreamVersions.length > 0 ? upstreamVersions[upstreamVersions.length - 1] : null;
    const rootId = rootVersion?.id ? String(rootVersion.id) : null;

    return {
      node_id: nodeId,
      root_version_id: rootId,
      hops_to_root: Math.max(0, upstreamVersions.length - 1),
      upstream_versions: upstreamVersions,
      transformations,
    };
  }

  /**
   * Phân tích tác động lan truyền (Downstream Impact Analysis)
   */
  async getDownstream(nodeId: string): Promise<DownstreamResponseDto> {
    const result = await this.neo4jService.runQuery(LineageCypherQueries.GET_DOWNSTREAM, {
      node_id: nodeId,
    });

    if (result.records.length === 0) {
      return {
        node_id: nodeId,
        downstream_count: 0,
        downstream_versions: [],
        affected_models_count: 0,
        affected_exports_count: 0,
      };
    }

    const record = result.records[0];
    const rawDownstream = (record.get('downstream_versions') as Neo4jEntity[]) || [];
    const downstreamVersions = rawDownstream.map((d) => (d?.properties ? (d.properties as Record<string, unknown>) : {}));

    return {
      node_id: nodeId,
      downstream_count: downstreamVersions.length,
      downstream_versions: downstreamVersions,
      affected_models_count: 0, // Sẽ liên kết ở Sprint B4 khi có AI Model training
      affected_exports_count: downstreamVersions.length > 0 ? 1 : 0,
    };
  }

  /**
   * Xác minh tính toàn vẹn chuỗi băm Merkle chống giả mạo
   * Công thức: version_hash = SHA256(data_checksum + parent_hash + rules_hash)
   */
  async verifyIntegrity(datasetId: string): Promise<VerifyIntegrityResponseDto> {
    const result = await this.neo4jService.runQuery(LineageCypherQueries.GET_CHAIN_FOR_VERIFY, {
      dataset_id: datasetId,
    });

    if (result.records.length === 0) {
      return {
        dataset_id: datasetId,
        is_valid: true,
        total_versions_checked: 0,
        broken_version_number: null,
        message: 'Dataset chưa có phiên bản nào được ghi nhận trên đồ thị.',
      };
    }

    const zeroParentHash = '0'.repeat(64);
    let previousVersionHash = zeroParentHash;

    for (let i = 0; i < result.records.length; i++) {
      const rec = result.records[i];
      const vNumber = Number(rec.get('version_number'));
      const storedVersionHash = String(rec.get('version_hash') ?? '');
      const dataChecksum = String(rec.get('data_checksum') ?? '');
      const rulesHash = String(rec.get('rules_hash') ?? '');
      const parentHashOnGraph = rec.get('parent_hash') ? String(rec.get('parent_hash')) : zeroParentHash;

      // 1. Kiểm tra liên kết cha-con giữa 2 phiên bản liên tiếp
      if (i > 0 && parentHashOnGraph !== previousVersionHash) {
        return {
          dataset_id: datasetId,
          is_valid: false,
          total_versions_checked: i + 1,
          broken_version_number: vNumber,
          message: `Phát hiện đứt gãy chuỗi băm tại Version ${vNumber}: parent_hash (${parentHashOnGraph.substring(0, 8)}...) không khớp với version_hash của phiên bản trước (${previousVersionHash.substring(0, 8)}...).`,
        };
      }

      // 2. Tái tính toán mã băm Merkle
      const calculatedHash = crypto
        .createHash('sha256')
        .update(dataChecksum + parentHashOnGraph + rulesHash)
        .digest('hex');

      if (calculatedHash !== storedVersionHash) {
        return {
          dataset_id: datasetId,
          is_valid: false,
          total_versions_checked: i + 1,
          broken_version_number: vNumber,
          message: `Phát hiện giả mạo dữ liệu tại Version ${vNumber}: version_hash lưu trữ không khớp với dữ liệu thực tế!`,
        };
      }

      previousVersionHash = storedVersionHash;
    }

    return {
      dataset_id: datasetId,
      is_valid: true,
      total_versions_checked: result.records.length,
      broken_version_number: null,
      message: `Toàn bộ chuỗi ${result.records.length} phiên bản toàn vẹn 100%, không phát hiện dấu hiệu can thiệp dữ liệu trái phép.`,
    };
  }
}
