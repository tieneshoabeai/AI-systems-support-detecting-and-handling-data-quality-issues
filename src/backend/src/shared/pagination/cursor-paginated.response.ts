import { CursorCodec } from './cursor-codec';

export interface CursorMeta {
  nextCursor: string | null;
  hasMore: boolean;
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
    nextCursor = CursorCodec.encode(getCursorPayload(lastItem));
  }

  return {
    items: resultItems,
    meta: { nextCursor, hasMore },
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}
