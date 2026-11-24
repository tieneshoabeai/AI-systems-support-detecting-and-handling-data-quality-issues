/**
 * RemoveMemberHandler — Use case: `removeMember()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** invariant "không xoá được Owner" và
 * "user phải là thành viên" do chính entity `Workspace` bảo vệ
 * (`removeMember()`), không nằm ở handler nữa.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import type { Workspace } from '../../domain/entities/workspace.entity';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

@Injectable()
export class RemoveMemberHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(workspaceId: string, memberUserId: string): Promise<Workspace> {
    const workspace = await this.getWorkspaceByIdHandler.execute(workspaceId);

    // Entity tự kiểm tra invariant → ném ValidationError / NotFoundError.
    workspace.removeMember(memberUserId);

    await this.workspaces.removeMember(workspaceId, memberUserId);
    return this.getWorkspaceByIdHandler.execute(workspaceId);
  }
}
