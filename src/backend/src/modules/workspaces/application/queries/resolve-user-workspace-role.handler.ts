/**
 * ResolveUserWorkspaceRoleHandler — Use case: `resolveUserWorkspaceRole()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';

@Injectable()
export class ResolveUserWorkspaceRoleHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async execute(workspaceId: string, userId: string): Promise<'owner' | 'member' | null> {
    if (!isObjectIdHex(workspaceId)) return null;
    const workspace = await this.workspaces.findById(workspaceId);
    if (!workspace) return null;
    if (workspace.ownerId === userId) return 'owner';
    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) return null;
    if ((member.role as string) === 'editor' || (member.role as string) === 'viewer')
      return 'member';
    return member.role as 'owner' | 'member';
  }
}
