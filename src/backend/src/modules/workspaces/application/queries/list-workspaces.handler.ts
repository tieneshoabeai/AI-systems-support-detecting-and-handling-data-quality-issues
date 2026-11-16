/**
 * ListWorkspacesHandler — Use case: `listWorkspaces()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  WORKSPACE_REPOSITORY_PORT,
  type WorkspaceListInput,
  type WorkspaceRecord,
  type WorkspaceRepositoryPort,
} from '../../domain/ports/workspace.repository.port';
import type { CurrentUser } from '../../../../shared/casl/casl-ability.factory';
import type { ListCursor } from '../../../../shared/utils/list-cursor';
import {
  InvalidCursorError,
  encodeKeysetCursor,
  parseListCursor,
} from '../../../../shared/pagination/keyset-cursor';
import {
  compareBySort,
  isAfterCursor,
  sortValueOf,
} from '../../../../shared/pagination/keyset-memory.util';
import type { CursorMeta } from '../../../../shared/pagination/cursor-paginated.response';
import { createCursorPage } from '../../../../shared/pagination/cursor-paginated.response';
import { DEFAULT_LIMIT } from '../workspaces.types';

@Injectable()
export class ListWorkspacesHandler {
  constructor(
    @Inject(WORKSPACE_REPOSITORY_PORT)
    private readonly workspaces: WorkspaceRepositoryPort,
  ) {}

  async execute(
    user: CurrentUser,
    q: WorkspaceListInput,
  ): Promise<{ items: WorkspaceRecord[]; meta: CursorMeta }> {
    const limit = Math.min(100, Math.max(1, Number(q.limit) || DEFAULT_LIMIT));
    const sort = q.sort || 'last_accessed';

    // Cursor phải khớp với tham số sort hiện tại.
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

    if (user.role === 'admin') {
      // Admin xem toàn bộ workspace — vẫn phân trang keyset, nhưng logic lọc/sắp
      // xếp được thực hiện trong bộ nhớ (quy mô dataset nhỏ hơn người dùng thường).
      const all = await this.workspaces.findAllActive();
      let items = all;
      if (q.search?.trim()) {
        const s = q.search.trim().toLowerCase();
        items = items.filter((w) => w.name.toLowerCase().includes(s));
      }
      if (q.role === 'owner') items = items.filter((w) => w.ownerId === user.userId);
      if (q.role === 'member') items = items.filter((w) => w.ownerId !== user.userId);
      items = [...items].sort((a, b) => compareBySort(a, b, sort));

      const sliced = cursor ? items.filter((w) => isAfterCursor(w, cursor, sort)) : items;
      const hasMore = sliced.length > limit;
      const page = hasMore ? sliced.slice(0, limit) : sliced;
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last
          ? ((): string => {
              const sv = sortValueOf(last, sort);
              return encodeKeysetCursor({
                s: sort,
                k: sv.value,
                n: sv.isNull ? 1 : 0,
                id: last.id,
              });
            })()
          : null;

      return createCursorPage(page, limit, nextCursor, hasMore);
    }

    const { items, nextCursor, hasMore } = await this.workspaces.findByUserPaged(user.userId, {
      ...q,
      sort,
      limit,
      cursor,
    });
    return createCursorPage(items, limit, nextCursor, hasMore);
  }
}
