import { z } from 'zod';

export const LineageNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['dataset', 'version', 'transformation']),
  data: z.record(z.string(), z.unknown()),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type LineageNodeDto = z.infer<typeof LineageNodeSchema>;

export const LineageEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.string().default('smoothstep'),
  label: z.string().optional(),
  animated: z.boolean().default(false),
});
export type LineageEdgeDto = z.infer<typeof LineageEdgeSchema>;

export const LineageGraphResponseSchema = z.object({
  dataset_id: z.string(),
  dataset_name: z.string().optional(),
  nodes: z.array(LineageNodeSchema),
  edges: z.array(LineageEdgeSchema),
  total_nodes: z.number(),
  total_edges: z.number(),
});
export type LineageGraphResponseDto = z.infer<typeof LineageGraphResponseSchema>;

export const UpstreamResponseSchema = z.object({
  node_id: z.string(),
  root_version_id: z.string().nullable(),
  hops_to_root: z.number(),
  upstream_versions: z.array(z.record(z.string(), z.unknown())),
  transformations: z.array(z.record(z.string(), z.unknown())),
});
export type UpstreamResponseDto = z.infer<typeof UpstreamResponseSchema>;

export const DownstreamResponseSchema = z.object({
  node_id: z.string(),
  downstream_count: z.number(),
  downstream_versions: z.array(z.record(z.string(), z.unknown())),
  affected_models_count: z.number().default(0),
  affected_exports_count: z.number().default(0),
});
export type DownstreamResponseDto = z.infer<typeof DownstreamResponseSchema>;

export const VerifyIntegrityResponseSchema = z.object({
  dataset_id: z.string(),
  is_valid: z.boolean(),
  total_versions_checked: z.number(),
  broken_version_number: z.number().nullable(),
  message: z.string(),
});
export type VerifyIntegrityResponseDto = z.infer<typeof VerifyIntegrityResponseSchema>;
