import { z } from 'zod';

export const SecureExportSchema = z.object({
  password: z
    .string()
    .trim()
    .min(8, 'Mật khẩu mã hóa phải có ít nhất 8 ký tự')
    .max(64, 'Mật khẩu mã hóa tối đa 64 ký tự'),
  version: z.coerce.number().int().positive('Số phiên bản phải là số nguyên dương').optional(),
});

export type SecureExportDto = z.infer<typeof SecureExportSchema>;

export const ExportQuerySchema = z.object({
  version: z.coerce.number().int().positive('Số phiên bản phải là số nguyên dương').optional(),
});

export type ExportQueryDto = z.infer<typeof ExportQuerySchema>;

export interface ExportTaskDetailDto {
  id: string;
  dataset_id: string;
  workspace_id: string;
  export_type: string;
  file_name: string;
  storage_key: string;
  file_size_bytes: number;
  record_count: number;
  checksum_sha256: string;
  is_encrypted: boolean;
  created_by: string;
  created_at: Date;
}
