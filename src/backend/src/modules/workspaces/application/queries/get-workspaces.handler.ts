/**
 * GetWorkspacesHandler — Use case: `getWorkspaces()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import type { CurrentUser } from '../../../../shared/casl/casl-ability.factory';

@Injectable()
export class GetWorkspacesHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async execute(user: CurrentUser): Promise<WorkspaceRecord[]> {
    if (user.role === 'admin') return this.workspaces.findAllActive();
    return this.workspaces.findByUser(user.userId);
  }
}
