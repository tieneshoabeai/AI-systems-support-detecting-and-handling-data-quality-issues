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
import { WORKSPACE_REPOSITORY_PORT, type WorkspaceRepositoryPort } from '../../../workspaces';

@Injectable()
export class ListAllProjectsHandler {
  constructor(
    @Inject(PROJECT_REPOSITORY_PORT)
    private readonly projects: ProjectRepositoryPort,
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
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

    // Lớp phòng thủ: loại project thuộc workspace đã bị xóa.
    // Cascade event (`WORKSPACE_DELETED`) sẽ xóa project thật, nhưng giữa lúc
    // phát event và lúc worker xử lý, project mồ côi vẫn còn `deleted_at: null`
    // → nếu không lọc ở đây, người dùng vẫn thấy chúng.
    let excludedWorkspaceIds: string[] = [];
    try {
      excludedWorkspaceIds = await this.workspaces.findDeletedIds();
    } catch {
      // Lỗi hạ tầng → không chặn request; cascade event vẫn sẽ dọn dẹp.
      excludedWorkspaceIds = [];
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
      excludedWorkspaceIds,
    );
    return createCursorPage(items, limit, nextCursor, hasMore);
  }
}
