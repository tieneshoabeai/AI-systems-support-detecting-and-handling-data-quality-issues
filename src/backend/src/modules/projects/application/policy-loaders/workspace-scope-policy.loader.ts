/**
 * WorkspaceScopePolicyLoader — Loader "phạm vi" cho các endpoint định tuyến
 * theo `:workspaceId` nhưng kiểm tra quyền trên subject con (Project).
 *
 * Ví dụ: `POST /workspaces/:workspaceId/projects` (UC-05 — chỉ `WS-OWNER`
 * được tạo project) và `GET /workspaces/:workspaceId/projects` (PROJ-02 —
 * `WS-OWNER` và `WS-MEMBER` đều xem được).
 *
 * Loader trả về đối tượng phạm vi chứa `workspace_id` để rule CASL tầng
 * workspace (`WS-OWNER`: `Manage Project theo workspace_id`) được áp dụng.
 * Nhờ đó `WS-OWNER` của workspace A không tạo được project trong workspace B.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../../workspaces';

@Injectable()
export class WorkspaceScopePolicyLoader {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async load(id: string): Promise<unknown> {
    const workspace = await this.workspaces.findById(id);
    if (!workspace) return null;
    return {
      id: workspace.id,
      workspace_id: workspace.id,
      owner_id: workspace.ownerId,
    };
  }
}
