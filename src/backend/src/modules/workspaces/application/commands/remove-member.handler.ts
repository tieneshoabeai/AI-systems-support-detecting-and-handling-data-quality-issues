/**
 * RemoveMemberHandler — Use case: `removeMember()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

@Injectable()
export class RemoveMemberHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(workspaceId: string, memberUserId: string): Promise<WorkspaceRecord> {
    const workspace = await this.getWorkspaceByIdHandler.execute(workspaceId);
    if (workspace.ownerId === memberUserId) {
      throw new BadRequestException('Không thể xóa chủ sở hữu chính của không gian làm việc');
    }
    if (!workspace.members.some((m) => m.userId === memberUserId)) {
      throw new NotFoundException('Người dùng không thuộc danh sách thành viên của không gian này');
    }
    await this.workspaces.removeMember(workspaceId, memberUserId);
    return this.getWorkspaceByIdHandler.execute(workspaceId);
  }
}
