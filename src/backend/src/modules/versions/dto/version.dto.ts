import { z } from 'zod';

export const CommitVersionSchema = z.object({
  description: z.string().trim().min(1, 'Mô tả phiên bản không được để trống').max(500, 'Mô tả tối đa 500 ký tự'),
  rule_ids: z.array(z.string().trim()).optional().default([]),
});

export type CommitVersionDto = z.infer<typeof CommitVersionSchema>;

export const DiffVersionsQuerySchema = z.object({
  v1: z.coerce.number().int().positive('Phiên bản v1 phải là số nguyên dương'),
  v2: z.coerce.number().int().positive('Phiên bản v2 phải là số nguyên dương'),
});

export type DiffVersionsQueryDto = z.infer<typeof DiffVersionsQuerySchema>;

export const ListVersionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  skip: z.coerce.number().int().min(0).optional().default(0),
});

export type ListVersionsQueryDto = z.infer<typeof ListVersionsQuerySchema>;

export interface VersionDetailDto {
  id: string;
  dataset_id: string;
  version_number: number;
  parent_hash: string;
  parent_version_id: string | null;
  rules_hash: string;
  data_checksum: string;
  version_hash: string;
  snapshot_storage_key: string;
  record_count: number;
  change_summary: {
    description: string;
    rule_ids: string[];
  };
  created_by: string;
  created_at: Date;
}

export interface VersionDiffResult {
  dataset_id: string;
  v1: {
    version_number: number;
    version_hash: string;
    record_count: number;
    data_checksum: string;
    rules_applied: string[];
  };
  v2: {
    version_number: number;
    version_hash: string;
    record_count: number;
    data_checksum: string;
    rules_applied: string[];
  };
  record_count_diff: number;
  is_data_identical: boolean;
  rules_added: string[];
  rules_removed: string[];
}
