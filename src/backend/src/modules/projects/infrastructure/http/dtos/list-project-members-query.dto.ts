import { z } from 'zod';
import { PROJECT_MEMBER_SORT_OPTIONS } from '../../../domain/ports/project.repository.port';

/**
 * PROJ-09 — Query danh sách thành viên project.
 *
 * - `search`: tìm theo tên hoặc email (partial, không phân biệt hoa/thường).
 * - `role`: lọc theo vai trò (`owner` | `member` | `viewer`).
 * - `cursor` / `limit`: phân trang keyset (con trỏ opaque lấy từ `meta.nextCursor`).
 */
export const ListProjectMembersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: z.enum(['owner', 'member', 'viewer']).optional(),
  sort: z.enum(PROJECT_MEMBER_SORT_OPTIONS).default('name_asc'),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

export type ListProjectMembersQueryDto = z.infer<typeof ListProjectMembersQuerySchema>;
