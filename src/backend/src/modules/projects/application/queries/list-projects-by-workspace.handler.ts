/**
 * ListProjectsByWorkspaceHandler — Use case: `listProjectsByWorkspace()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectListInput,
  type ProjectRecord,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../../../workspaces';
import type { ListCursor } from '../../../../shared/utils/list-cursor';
import {
  InvalidCursorError,
  parseListCursor,
} from '../../../../shared/pagination/keyset-cursor';
import type { CursorMeta } from '../../../../shared/pagination/cursor-paginated.response';
import { createCursorPage } from '../../../../shared/pagination/cursor-paginated.response';
import { DEFAULT_LIMIT } from '../projects.types';

@Injectable()
export class ListProjectsByWorkspaceHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(
    workspaceId: string,
    q: ProjectListInput,
  ): Promise<{ items: ProjectRecord[]; meta: CursorMeta }> {
    const ws = await this.workspaces.findById(workspaceId);
    if (!ws) throw new NotFoundException('Không tìm thấy không gian làm việc');

    const limit = Math.min(100, Math.max(1, Number(q.limit) || DEFAULT_LIMIT));
    const sort = q.sort || 'last_accessed';

    let cursor: ListCursor | undefined;
    try {
      cursor = parseListCursor(q.cursor, sort);
    } catch (e: unknown) {
      if (e instanceof InvalidCursorError) {
        throw new BadRequestException({
          message: e.message,
          error: 'VALIDATION_ERROR',
        } as never);
      }
      throw e;
    }

    const { items, nextCursor, hasMore } = await this.projects.findByWorkspacePaged(workspaceId, {
      ...q,
      sort,
      limit,
      cursor,
    });
    return createCursorPage(items, limit, nextCursor, hasMore);
  }
}
