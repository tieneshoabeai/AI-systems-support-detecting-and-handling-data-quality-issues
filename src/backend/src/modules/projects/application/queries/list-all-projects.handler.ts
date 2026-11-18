/**
 * ListAllProjectsHandler — Use case: `listAllProjects()` (chỉ đọc) — PROJ-02b.
 *
 * Danh sách project **toàn hệ thống** (không giới hạn theo workspace) —
 * dùng cho màn hình "Danh sách dự án" của người dùng.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  PROJECT_REPOSITORY_PORT,
  type ProjectListInput,
  type ProjectRepositoryPort,
} from '../../domain/ports/project.repository.port';
import type { Project } from '../../domain/entities/project.entity';
import type { ListCursor } from '../../../../shared/domain/utils/list-cursor';
import {
  InvalidCursorError,
  parseListCursor,
} from '../../../../shared/domain/pagination/keyset-cursor';
import type { CursorMeta } from '../../../../shared/domain/pagination/cursor-paginated.response';
import { createCursorPage } from '../../../../shared/domain/pagination/cursor-paginated.response';
import { DEFAULT_LIMIT } from '../projects.types';
import { ValidationError } from '../../../../shared/domain/errors';

@Injectable()
export class ListAllProjectsHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
  ) {}

  async execute(
    userId: string,
    workspaceIds: string[],
    q: ProjectListInput,
    /** `true` = quản trị viên hệ thống → xem toàn bộ project, không lọc quyền. */
    isAdmin = false,
  ): Promise<{ items: Project[]; meta: CursorMeta }> {
    const limit = Math.min(100, Math.max(1, Number(q.limit) || DEFAULT_LIMIT));
    const sort = q.sort || 'last_accessed';

    let cursor: ListCursor | undefined;
    try {
      cursor = parseListCursor(q.cursor, sort);
    } catch (e: unknown) {
      if (e instanceof InvalidCursorError) {
        throw new ValidationError(e.message);
      }
      throw e;
    }

    const { items, nextCursor, hasMore } = await this.projects.findAllPaged(
      userId,
      workspaceIds,
      {
        ...q,
        sort,
        limit,
        cursor,
      },
      isAdmin,
    );
    return createCursorPage(items, limit, nextCursor, hasMore);
  }
}
