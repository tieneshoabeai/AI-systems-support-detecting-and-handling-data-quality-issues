/**
 * LeaveWorkspaceHandler — Use case: `leaveWorkspace()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

@Injectable()
export class LeaveWorkspaceHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(workspaceId: string, userId: string): Promise<{ left: boolean }> {
    const workspace = await this.getWorkspaceByIdHandler.execute(workspaceId);
    if (workspace.ownerId === userId)
      throw new BadRequestException('Workspace Owner phải nhượng quyền trước khi rời (WS-09)');
    if (!workspace.members.some((m) => m.userId === userId))
      throw new NotFoundException('Bạn không phải thành viên workspace này');
    await this.workspaces.removeMember(workspaceId, userId);
    return { left: true };
  }
}
