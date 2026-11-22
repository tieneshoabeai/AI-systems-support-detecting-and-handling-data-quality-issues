/**
 * FindPagedHandler — Use case: `findPaged()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 *
 * **Bước 3 — Rich Domain Model:** trả entity `User[]`.
 *
 * **2026-11-18 (P3):** chuyển từ offset pagination (`page`/`limit`/`total`) sang
 * **keyset cursor** + `sortBy`/`sortOrder` để khớp hợp đồng §3.4 (giống
 * `/notifications`, `/issues`, `/admin/issues`).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  USER_REPOSITORY_PORT,
  type UserListInput,
  type UserRepositoryPort,
} from '../../domain/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';
import type { ListCursor } from '../../../../shared/domain/utils/list-cursor';
import {
  InvalidCursorError,
  parseListCursor,
} from '../../../../shared/domain/pagination/keyset-cursor';
import type { CursorMeta } from '../../../../shared/domain/pagination/cursor-paginated.response';
import { createCursorPage } from '../../../../shared/domain/pagination/cursor-paginated.response';
import { ValidationError } from '../../../../shared/domain/errors';

/** Số trang mặc định của danh sách hồ sơ (ADMIN-01). */
const DEFAULT_LIMIT = 15;

/** `sortBy` hợp lệ (hợp đồng §3.4). */
const ALLOWED_SORT_BY = ['createdAt', 'updatedAt', 'name', 'email', 'role', 'status'] as const;

/** Ánh xạ `sortBy` (hợp đồng) → mã sort nội bộ (repository). */
const SORT_BY_TO_INTERNAL: Record<(typeof ALLOWED_SORT_BY)[number], string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  name: 'name',
  email: 'email',
  role: 'role',
  status: 'status',
};

@Injectable()
export class FindPagedHandler {
  constructor(
    @Inject(USER_REPOSITORY_PORT)
    private readonly users: UserRepositoryPort,
  ) {}

  async execute(opts: UserListInput): Promise<{ items: User[]; meta: CursorMeta }> {
    const limit = Math.min(100, Math.max(1, Number(opts.limit) || DEFAULT_LIMIT));
    const sortOrder = opts.sortOrder === 'asc' ? 'asc' : 'desc';

    // `sortBy` không hợp lệ → VALIDATION_ERROR (không fallback im lặng) — §3.4.
    const rawSortBy = opts.sortBy ?? 'createdAt';
    if (!(ALLOWED_SORT_BY as readonly string[]).includes(rawSortBy)) {
      throw new ValidationError(`sortBy không hợp lệ. Chỉ chấp nhận: ${ALLOWED_SORT_BY.join(', ')}`, {
        allowedValues: ALLOWED_SORT_BY,
      });
    }
    const internalSort = SORT_BY_TO_INTERNAL[rawSortBy as (typeof ALLOWED_SORT_BY)[number]];

    // Mã sort đầy đủ (kèm chiều) là thành phần `s` của con trỏ → con trỏ sinh với
    // `sortBy=A&sortOrder=asc` không dùng được cho `sortBy=A&sortOrder=desc`.
    const sortCode = `${internalSort}_${sortOrder}`;

    let cursor: ListCursor | undefined;
    try {
      cursor = parseListCursor(opts.cursor, sortCode);
    } catch (e: unknown) {
      if (e instanceof InvalidCursorError) {
        throw new ValidationError(e.message);
      }
      throw e;
    }

    const { items, nextCursor, hasMore } = await this.users.findPaged({
      search: opts.search,
      role: opts.role,
      status: opts.status,
      sort: internalSort,
      sortOrder,
      cursor,
      limit,
    });

    return createCursorPage(items, limit, nextCursor, hasMore);
  }
}
