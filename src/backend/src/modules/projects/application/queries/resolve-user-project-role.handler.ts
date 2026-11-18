/**
 * ResolveUserProjectRoleHandler — Use case: `resolveUserProjectRole()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { isObjectIdHex } from '../../../../shared/domain/utils/object-id.util';

@Injectable()
export class ResolveUserProjectRoleHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(
    projectId: string,
    userId: string,
    workspaceRole?: 'owner' | 'member' | null,
  ): Promise<'owner' | 'member' | 'viewer' | null> {
    if (!isObjectIdHex(projectId)) return null;
    const project = await this.projects.findById(projectId);
    if (!project) return null;
    const role = project.roleOf(userId);
    if (role) return role;
    if (workspaceRole === 'member') return 'viewer';
    if (workspaceRole === 'owner') return 'owner';
    return null;
  }
}
