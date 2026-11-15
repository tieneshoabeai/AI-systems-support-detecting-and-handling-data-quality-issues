import { z } from 'zod';
import { WORKSPACE_MEMBER_SORT_OPTIONS } from '../../../domain/ports/workspace.repository.port';

/**
 * WS-06 — Query danh sách thành viên workspace.
 *
 * - `search`: tìm theo tên hoặc email (partial, không phân biệt hoa/thường).
 * - `role`: lọc theo vai trò (`owner` | `member`).
 * - `cursor` / `limit`: phân trang keyset (con trỏ opaque lấy từ `meta.nextCursor`).
 */
export const ListWorkspaceMembersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: z.enum(['owner', 'member']).optional(),
  sort: z.enum(WORKSPACE_MEMBER_SORT_OPTIONS).default('name_asc'),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

export type ListWorkspaceMembersQueryDto = z.infer<typeof ListWorkspaceMembersQuerySchema>;
