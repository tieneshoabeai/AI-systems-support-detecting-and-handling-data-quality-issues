/**
 * Các câu truy vấn Cypher tham số hóa 100% (Parameterized Queries) cho Neo4j AuraDB.
 * Tuân thủ nghiêm ngặt Rule 6 (Security: Không ghép chuỗi) và Rule 8 (Domain: Tối ưu cho AuraDB Free Tier).
 */

export const LineageCypherQueries = {
  /**
   * Đồng bộ Node Dataset
   */
  SYNC_DATASET: `
    MERGE (d:Dataset { id: $dataset_id })
    SET d.name = $name,
        d.project_id = $project_id,
        d.workspace_id = $workspace_id,
        d.updated_at = datetime($updated_at)
    ON CREATE SET d.created_at = datetime($created_at)
    RETURN d.id AS dataset_id
  `,

  /**
   * Đồng bộ Node Version và liên kết DERIVED_FROM với phiên bản cha
   */
  SYNC_VERSION: `
    MATCH (d:Dataset { id: $dataset_id })
    MERGE (v:Version { id: $version_id })
    SET v.version_number = $version_number,
        v.version_hash = $version_hash,
        v.data_checksum = $data_checksum,
        v.rules_hash = $rules_hash,
        v.created_at = datetime($created_at)
    MERGE (d)-[:HAS_VERSION]->(v)
    WITH v
    OPTIONAL MATCH (parent:Version { id: $parent_version_id })
    FOREACH (_ IN CASE WHEN parent IS NOT NULL THEN [1] ELSE [] END |
      MERGE (v)-[:DERIVED_FROM { created_at: datetime($created_at) }]->(parent)
    )
    RETURN v.id AS version_id
  `,

  /**
   * Đồng bộ các Transformation và liên kết TRANSFORMED_BY
   */
  SYNC_TRANSFORMATION: `
    MATCH (v:Version { id: $version_id })
    UNWIND $rules AS r
    MERGE (t:Transformation { id: r.id })
    SET t.rule_type = r.rule_type,
        t.description = r.description,
        t.parameters = r.parameters,
        t.applied_at = datetime($applied_at)
    MERGE (v)-[:TRANSFORMED_BY]->(t)
    RETURN count(t) AS count
  `,

  /**
   * Lấy toàn bộ đồ thị DAG của Dataset (cho React Flow / UI)
   */
  GET_FULL_DAG: `
    MATCH (d:Dataset { id: $dataset_id })
    OPTIONAL MATCH (d)-[:HAS_VERSION]->(v:Version)
    OPTIONAL MATCH (v)-[df:DERIVED_FROM]->(pv:Version)
    OPTIONAL MATCH (v)-[tb:TRANSFORMED_BY]->(t:Transformation)
    RETURN d,
           collect(DISTINCT v) AS versions,
           collect(DISTINCT { source: v.id, target: pv.id, type: 'DERIVED_FROM' }) AS version_edges,
           collect(DISTINCT t) AS transformations,
           collect(DISTINCT { source: v.id, target: t.id, type: 'TRANSFORMED_BY' }) AS transform_edges
  `,

  /**
   * Phân tích nguyên nhân gốc rễ (Root Cause Analysis - Upstream)
   */
  GET_UPSTREAM: `
    MATCH (start:Version { id: $node_id })
    OPTIONAL MATCH path = (start)-[:DERIVED_FROM*]->(root:Version)
    OPTIONAL MATCH (start)-[:TRANSFORMED_BY]->(t:Transformation)
    RETURN start,
           nodes(path) AS upstream_versions,
           relationships(path) AS upstream_edges,
           collect(t) AS transformations
  `,

  /**
   * Phân tích mức độ ảnh hưởng lan truyền (Downstream Impact Analysis)
   */
  GET_DOWNSTREAM: `
    MATCH (start:Version { id: $node_id })
    OPTIONAL MATCH path = (downstream:Version)-[:DERIVED_FROM*]->(start)
    RETURN start,
           collect(DISTINCT downstream) AS downstream_versions,
           relationships(path) AS downstream_edges
  `,

  /**
   * Lấy toàn bộ chuỗi phiên bản để đối soát tính toàn vẹn (Integrity Verification)
   */
  GET_CHAIN_FOR_VERIFY: `
    MATCH (d:Dataset { id: $dataset_id })-[:HAS_VERSION]->(v:Version)
    OPTIONAL MATCH (v)-[:DERIVED_FROM]->(p:Version)
    RETURN v.id AS version_id,
           v.version_number AS version_number,
           v.version_hash AS version_hash,
           v.data_checksum AS data_checksum,
           v.rules_hash AS rules_hash,
           p.version_hash AS parent_hash
    ORDER BY v.version_number ASC
  `,
} as const;
