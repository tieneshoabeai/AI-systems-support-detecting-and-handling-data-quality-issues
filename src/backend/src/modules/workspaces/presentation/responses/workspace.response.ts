import type { Workspace } from '../../domain/entities/workspace.entity';

/**
 * WORKSPACES — Mapper entity domain → HTTP response.
 *
 * **Vì sao cần tầng này?**
 * Entity `Workspace` có state riêng tư + getter, không thể serialize thẳng
 * (`JSON.stringify(entity)` sẽ ra `{}` vì mọi thuộc tính nằm trong `props` riêng
 * tư). Tầng presentation phải **chủ động** ánh xạ từng trường — nhờ vậy hợp
 * đồng HTTP không vỡ khi entity thêm/bớt trường nội bộ.
 *
 * **Hợp đồng giữ nguyên:** các trường trả về giống hệt `WorkspaceRecord` cũ
 * (Phần 7 §3.2 — camelCase, response thẳng dữ liệu) → không vỡ frontend.
 */
export interface WorkspaceResponse {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: Array<{
    userId: string;
    role: 'owner' | 'member';
    joinedAt: Date;
  }>;
  storageUsedBytes: number;
  lastAccessedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Entity → response DTO. */
export function toWorkspaceResponse(workspace: Workspace): WorkspaceResponse {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    ownerId: workspace.ownerId,
    members: workspace.members.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    storageUsedBytes: workspace.storageUsedBytes,
    lastAccessedAt: workspace.lastAccessedAt,
    version: workspace.version,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

/** Danh sách entity → danh sách response DTO. */
export function toWorkspaceResponses(workspaces: Workspace[]): WorkspaceResponse[] {
  return workspaces.map(toWorkspaceResponse);
}
