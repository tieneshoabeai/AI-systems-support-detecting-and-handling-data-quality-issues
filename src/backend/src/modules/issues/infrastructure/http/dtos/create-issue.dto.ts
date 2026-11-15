import { z } from 'zod';

export const CreateIssueSchema = z.object({
  issueType: z.enum(['function_error', 'display_error', 'data_error', 'feature_feedback', 'other']),
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(200),
  description: z.string().trim().min(1, 'Mô tả không được để trống').max(5000),
  workspaceId: z.string().min(1).max(100).optional(),
  apiPath: z.string().max(200).optional(),
  errorMessage: z.string().max(1000).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

export type CreateIssueDto = z.infer<typeof CreateIssueSchema>;

export const ListIssuesQuerySchema = z.object({
  cursor: z.string().min(1).max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['new', 'needs_info', 'in_progress', 'resolved', 'closed']).optional(),
});

export type ListIssuesQueryDto = z.infer<typeof ListIssuesQuerySchema>;

export const AdminListIssuesQuerySchema = z.object({
  cursor: z.string().min(1).max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['createdAt', 'updatedAt', 'status', 'severity']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(['new', 'needs_info', 'in_progress', 'resolved', 'closed']).optional(),
});

export type AdminListIssuesQueryDto = z.infer<typeof AdminListIssuesQuerySchema>;

export const UpdateIssueStatusSchema = z.object({
  status: z.enum(['new', 'needs_info', 'in_progress', 'resolved', 'closed']),
  expectedVersion: z.number().int().min(1, 'expectedVersion là bắt buộc'),
});

export type UpdateIssueStatusDto = z.infer<typeof UpdateIssueStatusSchema>;

/**
 * ISSUE-EDIT — Người dùng tự sửa báo cáo của chính mình khi admin yêu cầu bổ sung
 * (`status = needs_info`). Chỉ cho sửa `title`, `description`, `attachments`.
 * KHÔNG cho sửa `issueType` (bản chất sự cố không đổi) và KHÔNG cho sửa `status`
 * (luồng gửi lại tự quay về `in_progress`).
 */
export const UpdateMyIssueSchema = z.object({
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(200).optional(),
  description: z.string().trim().min(1, 'Mô tả không được để trống').max(5000).optional(),
  /** Danh sách id tệp đính kèm cần gỡ khỏi báo cáo. */
  removeAttachmentIds: z.array(z.string().min(1).max(64)).max(10).optional(),
  expectedVersion: z.number().int().min(1, 'expectedVersion là bắt buộc'),
}).refine(
  (v) => v.title !== undefined || v.description !== undefined || (v.removeAttachmentIds?.length ?? 0) > 0,
  {
    message: 'Cần cung cấp ít nhất một trong: title, description, removeAttachmentIds',
    path: ['title'],
  },
);

export type UpdateMyIssueDto = z.infer<typeof UpdateMyIssueSchema>;
