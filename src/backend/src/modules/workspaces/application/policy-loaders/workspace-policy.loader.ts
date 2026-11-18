/**
 * WorkspacePolicyLoader — Loader tài nguyên cho `@PolicyResource('Workspace', ...)`.
 *
 * Nạp workspace theo id để `PoliciesGuard` kiểm tra quyền ở TẦNG ĐỘNG
 * (instance check) — chống IDOR: user có quyền "đọc Workspace" nhưng chỉ được
 * đọc workspace **của mình**, không đọc được workspace của người khác.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';

@Injectable()
export class WorkspacePolicyLoader {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async load(id: string): Promise<unknown> {
    return this.workspaces.findById(id);
  }
}
