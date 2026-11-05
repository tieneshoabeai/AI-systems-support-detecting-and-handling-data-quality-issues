import { z } from 'zod';

export const RuleCategorySchema = z.enum([
  'null_handling',
  'standardization',
  'deduplication',
  'regex',
]);

export const RuleDefinitionSchema = z.object({
  name: z.string().trim().max(150).optional(),
  category: RuleCategorySchema,
  action: z.string().trim().min(1, 'Hành động quy tắc không được để trống'),
  target_column: z.string().trim().optional(),
  target_columns: z.array(z.string().trim()).optional(),
  parameters: z.record(z.unknown()).optional(),
});

export type RuleDefinitionDto = z.infer<typeof RuleDefinitionSchema>;

export const PreviewRulesSchema = z.object({
  rules: z.array(RuleDefinitionSchema).min(1, 'Cần ít nhất 1 quy tắc để chạy xem trước'),
});

export type PreviewRulesDto = z.infer<typeof PreviewRulesSchema>;

export const ApplyRulesSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Mô tả mục tiêu áp dụng luật không được để trống')
    .max(500, 'Mô tả tối đa 500 ký tự'),
  rules: z.array(RuleDefinitionSchema).min(1, 'Cần ít nhất 1 quy tắc để áp dụng'),
});

export type ApplyRulesDto = z.infer<typeof ApplyRulesSchema>;

export interface RuleExecutionStat {
  action: string;
  category: string;
  target_column?: string;
  modified_cells_count: number;
}

export interface PreviewRulesResultDto {
  total_sample_rows: number;
  affected_rows_count: number;
  dropped_rows_count: number;
  sample_before: Record<string, unknown>[];
  sample_after: Record<string, unknown>[];
  rule_stats: RuleExecutionStat[];
}

export interface ApplyRulesResultDto {
  message: string;
  applied_rules_count: number;
  affected_rows_count: number;
  dropped_rows_count: number;
  version: {
    version_number: number;
    version_hash: string;
    record_count: number;
    data_checksum: string;
  };
}

export interface CleanRuleDetailDto {
  id: string;
  dataset_id: string;
  workspace_id: string;
  name: string;
  category: string;
  action: string;
  target_column: string | null;
  target_columns: string[];
  parameters: Record<string, unknown>;
  is_active: boolean;
  created_by: string;
  created_at: Date;
}
