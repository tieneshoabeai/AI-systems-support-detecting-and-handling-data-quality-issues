/**
 * ListMineHandler — Use case: `listMine()`
 * (chỉ đọc) — theo §3.10 Command/Query pattern.
 *
 * Handler không biết HTTP: trả về kết quả hoặc ném lỗi nghiệp vụ.
 * Dependency chỉ qua port token — không inject adapter cụ thể.
 */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ISSUE_REPORT_REPOSITORY_PORT,
  type IssueReportRecord,
  type IssueReportRepositoryPort,
  type IssueListQuery,
} from '../../domain/ports/issue-report.repository.port';
import { CursorCodec } from '../../../../shared/pagination/cursor-codec';
import { isObjectIdHex } from '../../../../shared/utils/object-id.util';
import { ListIssuesInput } from '../issues.types';
import { toResponse } from '../issues.utils';

@Injectable()
export class ListMineHandler {
  constructor(
    @Inject(ISSUE_REPORT_REPOSITORY_PORT)
    private readonly repo: IssueReportRepositoryPort,
  ) {}

  private parseCursor(cursor: string | undefined): { createdAt?: Date; id?: string } {
    if (!cursor) return {};
    const decoded = CursorCodec.decode<{ createdAt?: string; id?: string }>(cursor);
    if (!decoded || !decoded.createdAt || !decoded.id || !isObjectIdHex(decoded.id)) {
      throw new BadRequestException('Cursor không hợp lệ');
    }
    const d = new Date(decoded.createdAt);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Cursor không hợp lệ');
    return { createdAt: d, id: decoded.id };
  }

  private buildPage(
    docs: IssueReportRecord[],
    limit: number,
  ): { items: Record<string, unknown>[]; meta: { nextCursor: string | null; hasMore: boolean } } {
    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1] as IssueReportRecord;
      nextCursor = CursorCodec.encode({
        createdAt: (last.createdAt as Date).toISOString(),
        id: last.id,
      });
    }
    return { items: page.map(toResponse), meta: { nextCursor, hasMore } };
  }

  async execute(
    userId: string,
    query: ListIssuesInput,
  ): Promise<{
    items: Record<string, unknown>[];
    meta: { nextCursor: string | null; hasMore: boolean };
  }> {
    const c = this.parseCursor(query.cursor);
    const q: IssueListQuery = {
      userId,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      status: query.status,
      cursorCreatedAt: c.createdAt,
      cursorId: c.id,
    };
    const docs = await this.repo.list(q);
    return this.buildPage(docs, query.limit);
  }
}
