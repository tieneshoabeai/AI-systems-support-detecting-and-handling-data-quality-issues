/**
 * ProjectPolicyLoader — Loader tài nguyên cho `@PolicyResource('Project', ...)`.
 *
 * Nạp project theo id để `PoliciesGuard` kiểm tra quyền ở TẦNG ĐỘNG
 * (instance check) — chặn IDOR trên project của workspace khác.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';

@Injectable()
export class ProjectPolicyLoader {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async load(id: string): Promise<unknown> {
    return this.projects.findById(id);
  }
}
