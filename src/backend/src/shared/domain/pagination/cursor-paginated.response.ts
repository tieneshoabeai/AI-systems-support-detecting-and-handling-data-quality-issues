import { CursorCodec } from './cursor-codec';

export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
  /** Số bản ghi tối đa của trang (echo lại `limit` của request). */
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  meta: CursorMeta;
  /** @deprecated chi giu de tuong thich test cu, khong su dung trong response moi */
  next_cursor?: string | null;
  /** @deprecated chi giu de tuong thich test cu, khong su dung trong response moi */
  has_more?: boolean;
}

export function createCursorPaginatedResponse<T>(
  items: T[],
  limit: number,
  getCursorPayload: (item: T) => Record<string, unknown>,
): CursorPaginatedResponse<T> {
  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  if (hasMore && resultItems.length > 0) {
    const lastItem = resultItems[resultItems.length - 1];
    if (lastItem !== undefined) {
      nextCursor = CursorCodec.encode(getCursorPayload(lastItem));
    }
  }

  return {
    items: resultItems,
    meta: { nextCursor, hasMore, limit },
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

/**
 * Dựng response phân trang cursor khi repository ĐÃ tính sẵn `nextCursor`/`hasMore`
 * (trường hợp keyset pagination — cursor phụ thuộc tham số sort nên không thể
 * suy ra lại từ phần tử cuối một cách generic).
 *
 * Hàm này giữ đúng một shape response duy nhất cho toàn hệ thống:
 * `{ items, meta: { nextCursor, hasMore, limit } }`.
 */
export function createCursorPage<T>(
  items: T[],
  limit: number,
  nextCursor: string | null,
  hasMore: boolean,
): CursorPaginatedResponse<T> {
  return {
    items,
    meta: { nextCursor, hasMore, limit },
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}
