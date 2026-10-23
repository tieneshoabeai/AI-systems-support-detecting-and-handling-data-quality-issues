import { CursorCodec } from './cursor-codec';

export interface CursorPaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
  total_count?: number;
}

export function createCursorPaginatedResponse<T>(
  items: T[],
  limit: number,
  getCursorPayload: (item: T) => Record<string, unknown>,
  totalCount?: number
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
    next_cursor: nextCursor,
    has_more: hasMore,
    total_count: totalCount,
  };
}
