/**
 * ListMembersHandler — Use case: `listMembers()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  type WorkspaceMembersListInput,
  type WorkspaceMemberView,
} from '../../domain/ports/workspace.repository.port';
import { USER_REPOSITORY_PORT, type UserRepositoryPort } from '../../../users';
import type { ListCursor } from '../../../../shared/utils/list-cursor';
import {
  InvalidCursorError,
  encodeKeysetCursor,
  parseListCursor,
} from '../../../../shared/pagination/keyset-cursor';
import {
  compareGeneric,
  genericSortValue,
  isAfterGenericCursor,
} from '../../../../shared/pagination/keyset-generic-memory.util';
import type { CursorMeta } from '../../../../shared/pagination/cursor-paginated.response';
import { createCursorPage } from '../../../../shared/pagination/cursor-paginated.response';
import { DEFAULT_LIMIT } from '../workspaces.types';
import { memberSortSpec } from '../workspaces.utils';
import { GetWorkspaceByIdHandler } from '../queries/get-workspace-by-id.handler';

@Injectable()
export class ListMembersHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
    private readonly getWorkspaceByIdHandler: GetWorkspaceByIdHandler,
  ) {}

  async execute(
    workspaceId: string,
    q: WorkspaceMembersListInput,
  ): Promise<{ items: WorkspaceMemberView[]; meta: CursorMeta }> {
    const workspace = await this.getWorkspaceByIdHandler.execute(workspaceId);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || DEFAULT_LIMIT));
    const sort = q.sort || 'name_asc';

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

    // Populate hồ sơ (tên/email) cho các thành viên — E6.
    const userIds = workspace.members.map((m) => m.userId);
    const profiles = await this.users.findByIds(userIds);
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    let rows: WorkspaceMemberView[] = workspace.members.map((m) => {
      const p = profileById.get(m.userId);
      return {
        id: m.userId,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        email: p?.email ?? null,
        firstName: p?.firstName ?? null,
        lastName: p?.lastName ?? null,
        avatarUrl: p?.avatarUrl ?? null,
      };
    });

    // Lọc theo vai trò.
    if (q.role) rows = rows.filter((r) => r.role === q.role);

    // Tìm kiếm theo tên/email (partial, không phân biệt hoa/thường).
    if (q.search?.trim()) {
      const needle = q.search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const haystack = [
          r.email ?? '',
          r.firstName ?? '',
          r.lastName ?? '',
          `${r.firstName ?? ''} ${r.lastName ?? ''}`,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    const spec = memberSortSpec(sort);
    rows = [...rows].sort((a, b) => compareGeneric(a, b, spec));

    const sliced = cursor ? rows.filter((r) => isAfterGenericCursor(r, cursor, spec)) : rows;
    const hasMore = sliced.length > limit;
    const page = hasMore ? sliced.slice(0, limit) : sliced;

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = page[page.length - 1];
      if (last) {
        const sv = genericSortValue(last, spec.accessor);
        nextCursor = encodeKeysetCursor({
          s: sort,
          k: sv.value,
          n: sv.isNull ? 1 : 0,
          id: last.id,
        });
      }
    }

    return createCursorPage(page, limit, nextCursor, hasMore);
  }
}
