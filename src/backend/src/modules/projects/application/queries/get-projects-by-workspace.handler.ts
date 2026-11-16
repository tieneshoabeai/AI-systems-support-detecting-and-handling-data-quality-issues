/**
 * GetProjectsByWorkspaceHandler — Use case: `getProjectsByWorkspace()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRecord,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../../../workspaces';

@Injectable()
export class GetProjectsByWorkspaceHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(workspaceId: string): Promise<ProjectRecord[]> {
    const ws = await this.workspaces.findById(workspaceId);
    if (!ws) throw new NotFoundException('Không tìm thấy không gian làm việc');
    return this.projects.findByWorkspace(workspaceId);
  }
}
