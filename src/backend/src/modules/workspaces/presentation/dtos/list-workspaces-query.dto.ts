import { z } from 'zod';
import { WORKSPACE_SORT_OPTIONS } from '../../domain/ports/workspace.repository.port';

/**
 * WS-02 — Query danh sách workspace.
 *
 * Phân trang dùng **keyset cursor** (không dùng `page`/`offset`):
 *   - `cursor`: con trỏ opaque (Base64) lấy từ `meta.nextCursor` của trang trước.
 *   - `limit`: số bản ghi tối đa mỗi trang (1..100).
 *
 * Lưu ý: con trỏ gắn với tham số `sort` của trang đó. Nếu đổi `sort` giữa các
 * lần gọi thì phải bắt đầu lại từ trang đầu (không truyền `cursor`).
 */
export const ListWorkspacesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(['owner', 'member']).optional(),
  sort: z.enum(WORKSPACE_SORT_OPTIONS).default('last_accessed'),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(15),
});

export type ListWorkspacesQueryDto = z.infer<typeof ListWorkspacesQuerySchema>;
