/**
 * AddMemberHandler — Use case: `addMember()`
 * (thay đổi trạng thái) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import { AddWorkspaceMemberInput } from '../workspaces.types';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

@Injectable()
export class AddMemberHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(workspaceId: string, dto: AddWorkspaceMemberInput): Promise<WorkspaceRecord> {
    const workspace = await this.getWorkspaceByIdHandler.execute(workspaceId);
    const targetUser = await this.users.findByEmail(dto.email);
    if (!targetUser)
      throw new NotFoundException(`Không tìm thấy người dùng với email: ${dto.email}`);
    const targetUserIdStr = targetUser.id;
    if (workspace.members.some((m) => m.userId === targetUserIdStr)) {
      throw new ConflictException('Người dùng này đã là thành viên của không gian làm việc');
    }
    await this.workspaces.addMember(workspaceId, {
      userId: targetUserIdStr,
      role: dto.role ?? 'member',
      joinedAt: new Date(),
    });
    return this.getWorkspaceByIdHandler.execute(workspaceId);
  }
}
